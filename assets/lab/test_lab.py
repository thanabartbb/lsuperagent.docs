import asyncio, pytest
from agents import Agent, Runner
from agents.exceptions import ModelBehaviorError
from agents.testing import ScriptedModel, assistant_message, function_call
from lab_harness import (MinimalAgentHarness, IntentEnvelope, StateOwnershipGate, offline_model,
                         ToolAccessBroker, ActionLadderLevel)

OBSERVE = IntentEnvelope(goal="check payment-gateway status")
EXECUTE = IntentEnvelope(goal="restart payment-gateway", risk_tier="HIGH")

def run(c): return asyncio.run(c)

def test_observe_runs_without_approval_and_passes_grader():
    asked = []
    h = MinimalAgentHarness(model=offline_model("OBSERVE"), approve=lambda p: asked.append(p) or True)
    r = run(h.execute_slice(OBSERVE))
    assert r["status"] == "DONE" and r["trace_status"] == "PASS" and asked == []
    events = [e["event"] for e in h.hooks.evidence_ledger]
    assert events == ["agent_start", "tool_start", "tool_end", "agent_end"]
    assert "healthy" in h.hooks.evidence_ledger[2]["output_evidence"]

def test_execute_asks_twice_plan_gate_then_needs_approval_interruption():
    asked = []
    h = MinimalAgentHarness(model=offline_model("EXECUTE"), approve=lambda p: asked.append(p.target_tool) or True)
    r = run(h.execute_slice(EXECUTE))
    assert asked == ["restart_production_service"] * 2   # gate 1 (plan) + gate 2 (tool interruption)
    assert r["status"] == "DONE" and r["trace_status"] == "PASS"
    assert any(e["event"] == "tool_end" and "restart" in e["output_evidence"] for e in h.hooks.evidence_ledger)

def test_plan_gate_reject_aborts_before_any_tool_or_model_call():
    model = offline_model("EXECUTE")
    h = MinimalAgentHarness(model=model, approve=lambda p: False)
    r = run(h.execute_slice(EXECUTE))
    assert r == {"status": "ABORTED", "level": "EXECUTE", "gate": "plan"}
    assert h.hooks.evidence_ledger == [] and model.calls == ()

def test_tool_gate_reject_never_executes_the_side_effect():
    answers = iter([True, False])  # approve plan, reject tool call
    h = MinimalAgentHarness(model=offline_model("EXECUTE"), approve=lambda p: next(answers))
    r = run(h.execute_slice(EXECUTE))
    assert r["status"] == "DONE"
    assert not any(e["event"] == "tool_end" and "restart" in e.get("output_evidence", "") and "requested" in e.get("output_evidence", "") for e in h.hooks.evidence_ledger)

def test_tool_without_access_is_refused_fail_closed():
    tools = ToolAccessBroker.get_tools_for_level(ActionLadderLevel.OBSERVE)
    assert [t.name for t in tools] == ["read_system_status"]
    model = ScriptedModel([[function_call("restart_production_service", {"service_name": "x"}, call_id="c1")]])
    agent = Agent(name="w", tools=tools, model=model)
    with pytest.raises(ModelBehaviorError):
        run(Runner.run(agent, "go"))

def test_state_gate_allows_exactly_one_owner():
    g = StateOwnershipGate()
    g.acquire("a", "SDK_SESSION")
    with pytest.raises(RuntimeError):
        g.acquire("b", "SDK_SESSION")
    assert g.release("a") and g.acquire("b", "SDK_SESSION").owner_id == "b"
