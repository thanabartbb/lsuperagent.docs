import pytest
from agents import OpenAIResponsesCompactionSession, OpenAIConversationsSession, SQLiteSession
from lab_harness import ActionLadderLevel, PlanContract
from lab_patterns import ActionLadderDispatcher, ReadOnlyHandler, SideEffectHandler, make_compaction_trigger

def plan(level, task="T1"):
    return PlanContract(task_id=task, action_type=level, target_tool="x", parameters={}, requires_approval=level in ("PREPARE", "EXECUTE"), evidence_rationale="")

def test_dispatcher_routes_by_ladder_and_fails_closed():
    d = ActionLadderDispatcher([ReadOnlyHandler(), SideEffectHandler({"OK"})])
    assert d.dispatch(plan(ActionLadderLevel.OBSERVE))["lane"] == "read-only"
    assert d.dispatch(plan(ActionLadderLevel.DRAFT))["lane"] == "read-only"
    assert d.dispatch(plan(ActionLadderLevel.EXECUTE, "OK"))["lane"] == "side-effect"
    with pytest.raises(PermissionError):
        d.dispatch(plan(ActionLadderLevel.PREPARE, "NOPE"))
    with pytest.raises(ValueError):
        ActionLadderDispatcher([ReadOnlyHandler()]).dispatch(plan(ActionLadderLevel.EXECUTE))

def test_compaction_trigger_fires_at_80_percent():
    trig = make_compaction_trigger(1000)
    assert not trig({"session_items": ["x" * 3000], "compaction_candidate_items": []})
    assert trig({"session_items": ["x" * 3300], "compaction_candidate_items": []})

def test_compaction_session_wraps_sdk_session_not_conversations(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-used")
    s = OpenAIResponsesCompactionSession("s1", SQLiteSession("s1"), should_trigger_compaction=make_compaction_trigger(128_000))
    assert s.session_id == "s1"
    with pytest.raises(ValueError, match="cannot wrap OpenAIConversationsSession"):
        OpenAIResponsesCompactionSession("s2", OpenAIConversationsSession(conversation_id="conv_x"))

def test_output_guardrails_conflict_with_server_managed_state():
    import asyncio
    from agents import Agent, Runner, GuardrailFunctionOutput, output_guardrail
    from agents.exceptions import UserError
    from agents.testing import ScriptedModel, assistant_message

    @output_guardrail
    async def evidence_check(ctx, agent, output):
        return GuardrailFunctionOutput(output_info=None, tripwire_triggered=False)

    def agent():
        return Agent(name="a", model=ScriptedModel([[assistant_message("ok")]]), output_guardrails=[evidence_check])
    with pytest.raises(UserError, match="cannot be combined"):
        asyncio.run(Runner.run(agent(), "hi", previous_response_id="resp_1"))
    assert asyncio.run(Runner.run(agent(), "hi", session=SQLiteSession("g1"))).final_output == "ok"
