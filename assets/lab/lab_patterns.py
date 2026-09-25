"""AGENTS-SDK-LAB patterns: Action Ladder dispatcher and compaction trigger (openai-agents 0.22.3)."""
from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from lab_harness import ActionLadderLevel, PlanContract


# ---------------------------------------------------------------- Action Ladder dispatcher
@runtime_checkable
class ActionHandler(Protocol):
    def can_handle(self, level: ActionLadderLevel) -> bool: ...
    def execute(self, plan: PlanContract) -> dict[str, Any]: ...


class ReadOnlyHandler:
    """OBSERVE and DRAFT: read-only lane, no approval."""

    def can_handle(self, level: ActionLadderLevel) -> bool:
        return level in (ActionLadderLevel.OBSERVE, ActionLadderLevel.DRAFT)

    def execute(self, plan: PlanContract) -> dict[str, Any]:
        return {"lane": "read-only", "task_id": plan.task_id}


class SideEffectHandler:
    """PREPARE and EXECUTE: side-effect lane, refuses plans that skipped approval."""

    def __init__(self, approved_task_ids: set[str]) -> None:
        self.approved_task_ids = approved_task_ids

    def can_handle(self, level: ActionLadderLevel) -> bool:
        return level in (ActionLadderLevel.PREPARE, ActionLadderLevel.EXECUTE)

    def execute(self, plan: PlanContract) -> dict[str, Any]:
        if plan.task_id not in self.approved_task_ids:
            raise PermissionError(f"{plan.task_id} has no recorded approval")  # fail-closed (R7)
        return {"lane": "side-effect", "task_id": plan.task_id}


class ActionLadderDispatcher:
    def __init__(self, handlers: list[ActionHandler]) -> None:
        self.handlers = handlers

    def dispatch(self, plan: PlanContract) -> dict[str, Any]:
        for handler in self.handlers:
            if handler.can_handle(plan.action_type):
                return handler.execute(plan)
        raise ValueError(f"no handler for {plan.action_type}")


# ---------------------------------------------------------------- Context budget ledger
def make_compaction_trigger(context_window_tokens: int, ratio: float = 0.8):
    """Build a should_trigger_compaction hook for OpenAIResponsesCompactionSession.

    The SDK passes a dict with `session_items` and `compaction_candidate_items`; it does not
    pass a token count, so this estimates ~4 characters per token.
    """

    def should_trigger(context: dict[str, Any]) -> bool:
        chars = sum(len(str(item)) for item in context["session_items"])
        return chars / 4 > ratio * context_window_tokens

    return should_trigger
