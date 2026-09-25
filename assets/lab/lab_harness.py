"""AGENTS-SDK-LAB minimal vertical slice (verified against openai-agents 0.22.3).

Run offline (no API key, deterministic ScriptedModel):   python lab_harness.py --offline
Run against OpenAI (needs OPENAI_API_KEY):                python lab_harness.py

The two tools are SIMULATED: they return fixed text and change nothing.
"""
from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from agents import Agent, AgentHookContext, RunContextWrapper, RunHooks, Runner, function_tool


# ---------------------------------------------------------------- Plane 1: contracts
class ActionLadderLevel(str, Enum):
    OBSERVE = "OBSERVE"
    DRAFT = "DRAFT"
    PREPARE = "PREPARE"
    EXECUTE = "EXECUTE"


class IntentEnvelope(BaseModel):
    goal: str
    constraints: list[str] = Field(default_factory=list)
    risk_tier: str = "LOW"  # LOW | MEDIUM | HIGH
    autonomy_level: int = 1  # 1-4
    evidence_burden: str = "STRICT"  # STRICT | MODERATE | MINIMAL
    latency_budget_ms: int = 5000


class PlanContract(BaseModel):
    task_id: str
    action_type: ActionLadderLevel
    target_tool: str
    parameters: dict[str, Any]
    requires_approval: bool
    evidence_rationale: str


# ---------------------------------------------------------------- Plane 2: single state owner
@dataclass
class StateOwnership:
    owner_id: str
    owner_type: str  # SDK_SESSION | CONVERSATION_ID | PREVIOUS_RESPONSE_ID
    is_active: bool = True


class StateOwnershipGate:
    """Exactly one active owner per conversation (R2)."""

    def __init__(self) -> None:
        self._ownership: StateOwnership | None = None

    def acquire(self, owner_id: str, owner_type: str) -> StateOwnership:
        if self._ownership and self._ownership.is_active:
            raise RuntimeError(f"state already owned by {self._ownership.owner_id}")
        self._ownership = StateOwnership(owner_id, owner_type)
        return self._ownership

    def release(self, owner_id: str) -> bool:
        if self._ownership and self._ownership.owner_id == owner_id:
            self._ownership.is_active = False
            return True
        return False


# ---------------------------------------------------------------- Plane 6: evidence spine
class EvidenceSpineHooks(RunHooks):
    """Records every lifecycle event; signatures match agents.RunHooks in 0.22.3."""

    def __init__(self) -> None:
        self.evidence_ledger: list[dict[str, Any]] = []

    async def on_agent_start(self, context: AgentHookContext, agent: Agent) -> None:
        self.evidence_ledger.append({"event": "agent_start", "agent": agent.name})

    async def on_tool_start(self, context: RunContextWrapper, agent: Agent, tool: Any) -> None:
        self.evidence_ledger.append({"event": "tool_start", "agent": agent.name, "tool": tool.name})

    async def on_tool_end(self, context: RunContextWrapper, agent: Agent, tool: Any, result: object) -> None:
        self.evidence_ledger.append(
            {"event": "tool_end", "agent": agent.name, "tool": tool.name, "output_evidence": str(result)}
        )

    async def on_agent_end(self, context: AgentHookContext, agent: Agent, output: Any) -> None:
        self.evidence_ledger.append({"event": "agent_end", "agent": agent.name, "final_claim": str(output)})


# ---------------------------------------------------------------- Plane 4: capability leasing
@function_tool
def read_system_status(service_name: str) -> str:
    """Read a service's status (OBSERVE). SIMULATED: returns fixed text."""
    return f"[SIMULATED] service '{service_name}' is healthy"


@function_tool(needs_approval=True)
def restart_production_service(service_name: str) -> str:
    """Restart a production service (EXECUTE). SIMULATED: nothing is restarted."""
    return f"[SIMULATED] restart of '{service_name}' accepted"


class CapabilityLeaseBroker:
    """Lease only the tools allowed at the plan's Action Ladder level (R1, R9)."""

    @staticmethod
    def get_tools_for_level(level: ActionLadderLevel) -> list[Any]:
        if level in (ActionLadderLevel.OBSERVE, ActionLadderLevel.DRAFT):
            return [read_system_status]
        if level in (ActionLadderLevel.PREPARE, ActionLadderLevel.EXECUTE):
            return [restart_production_service]
        return []  # unknown level: lease nothing (fail-closed, R7)


# ---------------------------------------------------------------- Plane 5 + 6: harness
class MinimalAgentHarness:
    def __init__(self, model: Any = None, approve: Any = None) -> None:
        self.hooks = EvidenceSpineHooks()
        self.state_gate = StateOwnershipGate()
        self.model = model  # None -> SDK default model (or OPENAI_DEFAULT_MODEL)
        self.approve = approve or (lambda plan: input(f"approve {plan.target_tool}? (yes/no): ").strip().lower() == "yes")

    def action_classifier(self, intent: IntentEnvelope) -> PlanContract:
        if "restart" in intent.goal.lower():
            return PlanContract(
                task_id="TASK-9901", action_type=ActionLadderLevel.EXECUTE,
                target_tool="restart_production_service", parameters={"service_name": "payment-gateway"},
                requires_approval=True, evidence_rationale="request changes real system state",
            )
        return PlanContract(
            task_id="TASK-9902", action_type=ActionLadderLevel.OBSERVE,
            target_tool="read_system_status", parameters={"service_name": "payment-gateway"},
            requires_approval=False, evidence_rationale="read-only request",
        )

    def trace_grader(self) -> dict[str, Any]:
        ledger = self.hooks.evidence_ledger
        starts = sum(e["event"] == "tool_start" for e in ledger)
        ends = sum(e["event"] == "tool_end" for e in ledger)
        has_claim = any(e["event"] == "agent_end" for e in ledger)
        passed = starts == ends and has_claim
        return {"trace_score": 1.0 if passed else 0.0, "trace_status": "PASS" if passed else "FAIL", "entries": len(ledger)}

    async def execute_slice(self, intent: IntentEnvelope) -> dict[str, Any]:
        self.hooks.evidence_ledger.clear()
        owner = self.state_gate.acquire(f"run-{intent.goal[:12]}", "SDK_SESSION")
        try:
            plan = self.action_classifier(intent)
            # Gate 1 (plan level, R3): refuse before any tool is leased.
            if plan.requires_approval and not self.approve(plan):
                return {"status": "ABORTED", "level": plan.action_type.value, "gate": "plan"}
            worker = Agent(
                name="SpecialistWorker",
                instructions="Use only the leased tools. Base the answer on tool output.",
                tools=CapabilityLeaseBroker.get_tools_for_level(plan.action_type),
                **({"model": self.model} if self.model is not None else {}),
            )
            task = f"Run {plan.target_tool} with {plan.parameters}"
            result = await Runner.run(worker, input=task, hooks=self.hooks)
            # Gate 2 (tool level): needs_approval=True pauses the run; resume from RunState.
            while result.interruptions:
                state = result.to_state()
                for item in result.interruptions:
                    (state.approve if self.approve(plan) else state.reject)(item)
                result = await Runner.run(worker, state, hooks=self.hooks)
            return {"status": "DONE", "level": plan.action_type.value, "output": result.final_output, **self.trace_grader()}
        finally:
            self.state_gate.release(owner.owner_id)


def offline_model(level: str) -> Any:
    """Deterministic model script: call the leased tool once, then answer."""
    from agents.testing import ScriptedModel, assistant_message, function_call

    tool = "restart_production_service" if level == "EXECUTE" else "read_system_status"
    return ScriptedModel([
        [function_call(tool, {"service_name": "payment-gateway"}, call_id="call-1")],
        [assistant_message(f"{tool} finished for payment-gateway")],
    ])


async def main() -> None:
    offline = "--offline" in sys.argv
    if not offline and not os.environ.get("OPENAI_API_KEY"):
        sys.exit("Set OPENAI_API_KEY or run with --offline")
    cases = [
        IntentEnvelope(goal="check payment-gateway status", risk_tier="LOW"),
        IntentEnvelope(goal="restart payment-gateway to fix latency", risk_tier="HIGH"),
    ]
    for intent in cases:
        level = "EXECUTE" if "restart" in intent.goal else "OBSERVE"
        harness = MinimalAgentHarness(
            model=offline_model(level) if offline else None,
            approve=(lambda plan: True) if offline else None,
        )
        print(intent.goal, "->", await harness.execute_slice(intent))


if __name__ == "__main__":
    asyncio.run(main())
