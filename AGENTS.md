# AGENTS.md

AI Framework: **ChatGPT + GitHub Operating Instructions**

Last updated: **2026-09-20T02:58:01+07:00 Asia/Bangkok**
Last update task: **Stabilize public HTML delivery with selective Worker-first routing.**

This file is the first file every AI agent must read before modifying this repository. It defines the repo memory boundary, write protocol, data contract discipline, and negative constraints.

## Authority Order

Agents must resolve conflicts in this order:

1. Current owner instruction in the active chat.
2. Verified GitHub repository state and latest commit.
3. `AGENTS.md` and `README.md`.
4. Other docs in this repository.
5. Prior assistant summaries or model memory.
6. General model knowledge.

If the current chat and this file disagree, obey the current owner instruction but update this file if the change is meant to persist.

## Pinned Stack

Do not change these defaults without explicit owner approval in the current task.

```yaml
repo: thanabartbb/lsuperagent.docs
site: https://agents-sdk.space
host: Cloudflare Workers Static Assets
worker: lsuperagent-docs
entrypoint: src/firebase-worker.js -> src/index.js
asset_routing: public_asset_first; api_auth_and_protected_routes_worker_first
frontend: static_html_css_js
primary_runtime_endpoint: /api/chat
owner_workspace: /dev
control_reference: /dev/control-plane/
control_alias: /control -> /dev
database_storage: none_by_default
forbidden_without_approval:
  - D1
  - R2
  - KV
  - new Firebase auth bridge
  - new Supabase auth bridge
  - new Vercel migration
  - new Railway migration
  - unrelated markdown template overwrite
```

## Feature Goal Template

Every task must restate the feature goal in one sentence before editing:

```text
Build [specific surface] so [specific user] can [specific action] with [verifiable outcome].
```

Example:

```text
Build a Cloudflare OAuth docs connector plan so the owner can review read-only integration scope before any runtime secret or write action exists.
```

## Data Contract Template

Before implementing any page/API/tool, declare fields in this shape:

```yaml
fields:
  - name: surface
    type: string
    source: static_page_or_api_response
    required: true
  - name: status
    type: enum
    allowed: [docs, planned, ready, live, blocked, retired]
    source: route_contract_or_runtime_check
    required: true
  - name: last_updated_at
    type: iso_datetime_with_timezone
    source: agent_update
    required: true
  - name: evidence
    type: string
    source: commit_sha_file_path_route_or_observed_result
    required: true
  - name: secret_values_exposed
    type: boolean
    source: explicit_response_or_docs_statement
    required: true
    must_equal: false
```

No placeholder may be promoted to production data. Mock data must be labelled as mock fixture.

## Acceptance Criteria Template

Every task must produce yes/no acceptance criteria.

```gherkin
Given the repository is read at the latest main commit
When the task is implemented
Then the edited files match the stated feature goal
And data fields are declared with type and source
And no unrelated platform or framework is introduced
And no secret value is committed
And no route policy is changed accidentally
And no "coming soon" text is used as completion
And the final report includes changed files, commit SHA, and unresolved risks
```

## Negative Constraints

Keep these near the end of prompts because agents may over-weight recent instructions.

```yaml
negative_constraints:
  - Do not commit secrets, tokens, OAuth client secrets, signed URLs, or private credentials.
  - Do not create D1/R2/KV resources unless the owner explicitly asks in the active task.
  - Do not create or migrate to Firebase/Supabase/Vercel/Railway unless explicitly requested in the active task.
  - Do not overwrite index.html with unrelated landing page templates.
  - Do not change /control away from /dev without explicit route-policy approval.
  - Do not mark docs-only references as live runtime.
  - Do not claim Cloudflare deploy success unless verified.
  - Do not use "coming soon" as a substitute for state, evidence, or acceptance criteria.
  - Do not write from a different ChatGPT thread unless README.md, AGENTS.md, and latest commit were read first.
  - Do not assume public repo means public write access; write access comes only from authorized accounts, apps, or tokens.
```

## GitHub Write Protocol

Before writing:

1. Read the latest `README.md`.
2. Read the latest `AGENTS.md`.
3. Inspect the latest commit touching the target files.
4. State the target files and intended outcome.
5. Apply the smallest safe patch.
6. Report the exact commit SHA.

After writing:

1. Re-read the changed file if possible.
2. Confirm no secrets were introduced.
3. Confirm route policy still matches the intended state.
4. Update `last_updated_at` and `last_update_task` when the change affects repo contract or agent behavior.

## Loop Update Slots

The following slots are maintained by scheduled loops.

```yaml
repo_contract_loop:
  cadence: every_6_hours
  target_files:
    - README.md
    - AGENTS.md
  last_run_at: 2026-09-19T16:07:00+07:00
  last_run_task: Initial contract creation
  required_action: write_real_timestamp_and_task_summary

prompt_stack_loop:
  cadence: every_6_hours
  target_sections:
    - Pinned Stack
    - Feature Goal Template
    - Data Contract Template
    - Acceptance Criteria Template
    - Negative Constraints
  last_run_at: 2026-09-19T16:07:00+07:00
  last_run_task: Initial five-layer AI framework lock
  required_action: keep_contract_current_and_write_actual_update
```
