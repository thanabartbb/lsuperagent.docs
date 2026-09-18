# EXA_REF_OPENAI_PRODUCTION_AGENT_ARCHITECTURE_2026-09-19

Source type: Exa Markdown Reference
Primary source family: OpenAI API Docs
Status: Reference only

## Purpose

Use this reference to turn OpenAI official guidance on agents, tools, guardrails, approvals, tracing, evals, safety, and compaction into explicit architecture planes for AGENTS-SDK-LAB.

AGENTS-SDK-LAB must not be only a chat app. It should be a Production Agent Control Plane with visible runtime planes and evidence gates.

## Primary URLs

- https://developers.openai.com/api/docs/guides/agents
- https://developers.openai.com/api/docs/guides/tools
- https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- https://developers.openai.com/api/docs/guides/agent-evals
- https://developers.openai.com/api/docs/guides/compaction

## Architecture Lock

```text
AGENTS-SDK-LAB Evidence-Gated Control Plane

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

| Plane | Purpose | Storage |
| --- | --- | --- |
| Runtime Plane | Choose Agents SDK, Responses API, MCP bridge, or external operator per workflow. | code + config |
| Tool Plane | Catalog tools, MCP servers, Zapier actions, Remote SDK operators, GitHub actions, endpoint contracts. | D1 index + KV flags |
| Guardrail Plane | Validate input, output, tool arguments, policy scope, redaction, and risk before side effects. | D1 rules + events |
| Approval Plane | Pause high-risk actions for owner approval or rejection with resumable state. | D1 |
| Trace Plane | Record run-level events: model call, tool call, handoff, guardrail, interruption. | D1 index + R2 snapshot |
| Eval Plane | Run graders, datasets, eval runs, and regression checks. | D1 |
| Evidence Plane | Store proof of real execution: logs, screenshots, source bundles, deploy results. | R2 + D1 pointer |
| Compaction Plane | Reduce long-running context into durable state summaries and handoff packets. | D1 summary + R2 archive |
| Secrets Plane | Keep API keys, OAuth secrets, MCP tokens, signed URLs. | Cloudflare/Base44/Zapier secrets only |

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
Tool executes
↓
Evidence is captured
↓
Trace and eval data update
```

## Storage Rule

### D1

Use D1 for structured records:

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

### R2

Use R2 for large artifacts:

```text
evidence/traces/
evidence/logs/
evidence/source-bundles/
evidence/screenshots/
evidence/eval-runs/
```

### KV

Use KV for small operational config:

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

## Current Implementation Pointer

- Dev page: `/dev/control-plane/`
- Page file: `dev/control-plane/index.html`

## Non-goals

- Do not create D1/R2 without concrete schema and data owner.
- Do not mark Remote SDK/Zapier actions as live until tested.
- Do not expose MCP tokens or signed URLs.
- Do not turn this into a decorative dashboard with fake statuses.
