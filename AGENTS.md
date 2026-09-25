# AGENTS.md

AI Framework: **LSUPERAGENT Public Workspace Operating Instructions**

Last updated: **2026-09-25T10:38:47+07:00 Asia/Bangkok**
Last update task: **Clarify D1 is allowed for the requested one-owner continuity pilot, subject to a data model and tests.**

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
frontend: static_html_css_js
primary_runtime_endpoint: /api/chat
owner_workspace: /dev
control_reference: /dev/control-plane/
control_alias: /control -> /dev
database_storage: none_currently
continuity_pilot_storage:
  D1: allowed_for_one_owner_pilot_with_schema_cost_review_and_tests
forbidden_without_approval:
  - unrelated_R2_or_KV_resources
  - new auth platform migration
  - new Supabase auth bridge
  - new Vercel migration
  - new Railway migration
  - unrelated markdown template overwrite
```

Storage policy clarified by the owner on 2026-09-25: "not yet installed" does **not** mean "prohibited." The one-owner session-continuity request authorizes choosing a small, suitable persistent store such as one D1 database. Before provisioning or wiring it, write the schema and migration, ownership rules, cost estimate, rollback path, and meaningful recovery tests. Do not ask for another generic D1 permission gate for this already authorized pilot. The current proposal in `docs/session-continuity-pilot.md` remains design-only until the resource, runtime, and end-to-end behavior are verified.

Public route policy: `/loading` is a public informational page linked from the brand on `/login` and `/home`; its primary action uses `/` to select the existing login or home route. `/` opens `/login` without a valid signed session and `/home` with one; successful login defaults to `/home`, while explicit links to `/chat` still work. `/home`, `/chat`, `/tools`, `/api/chat`, and `/api/image` require that session. Public auth pages `/login`, `/signup`, and `/forgot-password` expose email/password and the existing Google/GitHub OAuth routes. Email auth uses the Firebase Identity Toolkit integration; GitHub login uses `read:user user:email` only and does not grant repository write access. `chat.html` uses `/api/auth/session` and `/api/chat`. Sessions are six-hour signed cookies; historical session storage is not installed. No guest path is allowed.

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
  - Do not create storage without a user-requested feature, a concrete data model, cost boundary, and recovery tests. One D1 database is allowed for the current one-owner continuity pilot; unrelated storage still needs a separate reason.
  - Do not migrate authentication to a different platform unless explicitly requested in the active task.
  - Do not create or migrate to Supabase/Vercel/Railway unless explicitly requested in the active task.
  - Do not overwrite index.html with unrelated landing page templates.
  - Do not change /control away from /dev without explicit route-policy approval.
  - Do not mark docs-only references as live runtime.
  - Do not claim Cloudflare deploy success unless verified.
  - Do not use "coming soon" as a substitute for state, evidence, or acceptance criteria.
  - Do not write from a different ChatGPT thread unless README.md, AGENTS.md, and latest commit were read first.
  - Do not assume public repo means public write access; write access comes only from authorized accounts, apps, or tokens.
```

## GitHub Write Protocol

Standing owner authorization (effective 2026-09-21): ChatGPT may create validated, fast-forward commits to `main` automatically for changes the owner explicitly requests in the active chat. No separate per-commit confirmation is required. This authorization applies only to `thanabartbb/lsuperagent.docs`. Force-pushes, branch or data deletion, permission changes, and secret changes still require explicit action-specific approval.

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
  last_run_at: 2026-09-22T02:33:54+07:00
  last_run_task: Lock reference-matched login and account-first authentication surface
  required_action: write_real_timestamp_and_task_summary

prompt_stack_loop:
  cadence: every_6_hours
  target_sections:
    - Pinned Stack
    - Feature Goal Template
    - Data Contract Template
    - Acceptance Criteria Template
    - Negative Constraints
  last_run_at: 2026-09-22T02:33:54+07:00
  last_run_task: Align public-entry contract with email/password plus Google/GitHub authentication
  required_action: keep_contract_current_and_write_actual_update
```
