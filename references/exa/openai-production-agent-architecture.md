# EXA_REF_OPENAI_PRODUCTION_AGENT_ARCHITECTURE_2026-09-19

Source type: Exa Markdown Reference
Primary source family: OpenAI API Docs
Status: Reference only / docs-only architecture

## Scope Lock

This reference is documentation only.

It does not create D1, R2, KV, secrets, runtime actions, Zapier actions, Remote SDK actions, public completion status, or production claims.

AGENTS-SDK-LAB must not be only a chat app. It should become a Production Agent Control Plane, but the current artifact is a docs/reference layer.

A public release is not complete until every public category is genuinely usable, tested, and has evidence. UI cards, labels, links, or planned routes do not count as completion.

## Primary URLs

- https://developers.openai.com/api/docs/guides/agents
- https://developers.openai.com/api/docs/guides/tools
- https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- https://developers.openai.com/api/docs/guides/agent-evals
- https://developers.openai.com/api/docs/guides/compaction

## Architecture Lock

```text
AGENTS-SDK-LAB Production Agent Control Plane

Runtime
Tools
Guardrails
Approvals
Traces
Evals
Evidence
Compaction
```

## Explicit Planes

| Plane | Purpose | Current status |
| --- | --- | --- |
| Runtime Plane | Define where Agents SDK, Responses API, MCP bridge, or external operators fit. | Docs only |
| Tool Plane | Catalog tools, MCP servers, Zapier actions, Remote SDK operators, GitHub actions, endpoint contracts. | Docs only |
| Guardrail Plane | Define input, output, tool-argument, redaction, policy, and risk checks. | Docs only |
| Approval Plane | Define pause/approve/reject flow for high-risk actions. | Docs only |
| Trace Plane | Define what a run-level trace should record: model call, tool call, handoff, guardrail, interruption. | Docs only |
| Eval Plane | Define grader, dataset, eval run, and regression criteria. | Docs only |
| Evidence Plane | Define proof requirements for real execution: logs, screenshots, source bundles, deploy results. | Docs only |
| Compaction Plane | Define state summaries and handoff packets for long-running work. | Docs only |
| Secrets Plane | Define where secrets may live. | Provider secret stores only |

## Runtime Rule

Do not let an agent execute sensitive side effects directly.

```text
Agent proposes action
↓
Guardrail validates action
↓
Approval item is created if risk exists
↓
Owner approves or rejects
↓
Tool executes only after approval
↓
Evidence is captured
↓
Trace and eval data update
```

## Public Completion Rule

A public category is complete only when it has:

```text
1. A real route
2. A real action or clearly static documentation purpose
3. Real error states
4. Real evidence or verification output
5. No fake live labels
6. No hidden secret exposure
7. A tested mobile path
```

## Future Storage Notes

Storage is future architecture, not current implementation.

### D1 later only when there is a concrete schema and data owner

Possible structured records:

```text
approval_requests
tool_runs
trace_index
eval_results
guardrail_events
evidence_index
runtime_sessions
compaction_summaries
```

### R2 later only when there are real artifacts

Possible large artifacts:

```text
evidence/traces/
evidence/logs/
evidence/source-bundles/
evidence/screenshots/
evidence/eval-runs/
```

### KV later only for operational config

Possible small config:

```text
feature_flags
tool_availability
route_status
provider_labels
```

### Secrets

Never store secrets in D1, R2, KV, GitHub, public HTML, screenshots, or Exa references.

Use provider secret stores only:

```text
Cloudflare Secrets
Base44 Secrets
Zapier connection auth
GitHub encrypted secrets
```

## Visual Direction

```text
Core: #000000 absolute black
Surface: #050505 / #0A0A0A
Grid: #1A1A1A
Risk: #E11D48 rose red
Approved: #22C55E control green
Live: #A3FF12 lime signal
Text: #EDEDED / #C8C8C8 / #8A8A8A
```

## Current Docs Pointer

- Docs page: `/dev/control-plane/`
- Page file: `dev/control-plane/index.html`

## Non-goals

- Do not create D1/R2/KV from this reference alone.
- Do not mark Remote SDK/Zapier actions as live until tested.
- Do not expose MCP tokens or signed URLs.
- Do not call public completion until every public category actually works.
- Do not turn this into a decorative dashboard with fake statuses.
