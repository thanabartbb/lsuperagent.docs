# AGENTS.md

AI Framework: **LSUPERAGENT Public Workspace Operating Instructions**

Last updated: **2026-09-30T14:27:14+07:00 Asia/Bangkok**
Last update task: **Assemble the existing Next.js intro as the main preview page, preserve all UI colors, and connect workspace route handoffs.**

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
exa_search_endpoint: POST /api/exa/search (signed session; Cloudflare Worker EXA_API_KEY)
owner_workspace: /dev
control_reference: /dev/control-plane/
control_alias: /control -> /dev
database_storage: d1_agentssdkspace_binding_DB_chat_history_and_usage_quota  # approved 2026-09-28; schema migrations/0001_chat_history.sql, 0002_usage_quota.sql
continuity_pilot_storage:
  D1: active_for_chat_history_and_usage_quota; further use needs schema_cost_review_and_tests
attachment_storage: none  # attachments reach the model only; history keeps file names
usage_quota: d1_usage_counters  # 50 chat / 10 image per account per day, 2000 site-wide; reset 00:00 Asia/Bangkok
forbidden_without_approval:
  - unrelated_R2_or_KV_resources
  - new auth platform migration
  - new Supabase auth bridge
  - new Vercel migration
  - new Railway migration
  - unrelated markdown template overwrite
```

Storage policy clarified by the owner on 2026-09-25: "not yet installed" does **not** mean "prohibited." The one-owner session-continuity request authorizes choosing a small, suitable persistent store such as one D1 database. Before provisioning or wiring it, write the schema and migration, ownership rules, cost estimate, rollback path, and meaningful recovery tests. Do not ask for another generic D1 permission gate for this already authorized pilot. The current proposal in `docs/session-continuity-pilot.md` remains design-only until the resource, runtime, and end-to-end behavior are verified.

Public route policy: `/loading` is a public informational page linked from the brand on `/login` and `/home`; its primary action uses `/` to select the existing login or home route. Its color switch and the matching switch on `/guide` persist the selected `normal` or `docs` mode in browser local storage. Both pages use an opaque `#000000` canvas; Normal uses black/white with a restrained blue-gray accent, and Docs uses black with a muted purple accent. `loading.html` uses the existing logo at 88×88 CSS pixels. `/` opens `/login` without a valid signed session and `/home` with one; successful login defaults to `/home`, while explicit links to `/chat` still work. `/home`, `/chat`, `/tools`, `/guide`, `/docs`, `/docs/:page`, `/docs-shell`, `/docs-content/*`, `/api/chat`, `/api/image`, and `POST /api/sdk/keys` require that session. Public auth pages `/login`, `/signup`, and `/forgot-password` expose email/password and the existing Google/GitHub OAuth routes. Email auth uses the Firebase Identity Toolkit integration; GitHub login uses `read:user user:email` only and does not grant repository write access. `chat.html` uses `/api/auth/session` and `/api/chat`. Sessions are six-hour signed cookies; historical session storage is not installed. No guest path is allowed.

Code entry contract: `/tools` Code links to `/chat?mode=code`; `assets/chat.js` sends `mode: "code"`, `tool: "code"` and recent turns to `/api/chat`. The Worker asks OpenAI for a code-oriented text response; it cannot edit repository files. `mode` is `chat` or `code` from the page query, source `assets/chat.js`, required in the request; `quota_remaining` is an optional number from response headers, source `src/index.js`, and shows the account's remaining daily quota from D1 (`src/quota.js`: 50 chat units per day, 10 images, 2000 site-wide, reset 00:00 Asia/Bangkok, owner exempt), falling back to the in-memory burst guard of 10 requests per 10 minutes when no quota applies. Signed-in chat history persists per account in D1 (binding `DB`, `src/chat-store.js`); answers stream as NDJSON; image/PDF attachments reach the model but are not stored (history keeps file names only). Verification of a real paid model response still requires an authenticated live test. No secret values are exposed by this page contract.

SDK and docs contract: `/docs/:page` serves `docs-shell.html`, which loads `/docs-content/<slug>` (login required; 401 JSON without a session) using the sidebar list in `assets/docs-nav.js`; adding a page means a new `docs-content/<slug>.html` plus one entry there, and `tests/docs-site.test.mjs` checks both stay in sync. `/guide` is the `lsupergen-sdk` playground (`guide.html`, `assets/guide.js`, vendored npm build under `vendor/lsupergen-sdk/0.1.0/`, sha256 pinned in `tests/sdk-guide.test.mjs`). `POST /api/sdk/keys` (same-origin, signed session) returns a stateless `lsg_` key: an HMAC token signed with `AUTH_SESSION_SECRET`, typ `sdk_key`, 30-day expiry, no storage, not individually revocable. `GET /v1/health` is public; `GET /v1/me`, `POST /v1/chat`, and `POST /v1/image` require `Authorization: Bearer lsg_…` and reuse the `/api/chat` and `/api/image` handlers, including the 10 requests / 10 minutes in-memory rate guard. `/sdk` redirects to `/guide`.

Package boundary: `npmjs.sdk-space@1.0.1` is a separate npm package that currently exports only `npmjsSdkSpace()` as a version-string function. `/guide` remains the `lsupergen-sdk` API client. Do not describe these as interchangeable.

Exa Search contract: `/tools` links to authenticated `/exa`, whose browser form posts `{ query, numResults }` to same-origin `POST /api/exa/search`. The Worker validates query length, clamps results to 1–10, requests Exa highlights, and returns only title, HTTP(S) URL, optional publication date, and up to three highlights per result. `EXA_API_KEY` is read from the Cloudflare Worker environment and never returned to the browser. Requests use the existing per-isolate in-memory limit of 10 per 10 minutes; this is not a durable quota or spend cap. The route is not part of the public `/v1` SDK.

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


## Editorial contract — 2026-09-27

Build task-oriented page copy so visitors can identify an input, follow an approach, and use the resulting output. Across page shells and docs, lead with reusable steps and outcomes; keep personal biography and internal prohibition/status banners out of product introductions. Preserve operational errors and accurate technical reference details. Use the canonical logo in one or two brand positions per page and compact header names. The intro heading is owner-supplied copy: “React following deveguide by Next.js”; it describes editorial direction, not a migration from the pinned static frontend.

Content fields: heading and lead are static strings sourced from each HTML page; required on content pages. Brand asset is /logo.svg. Font preference is a CSS family from assets/editorial.css and assets/theme.css. Kantalad Cnd Bold is a local-font trial only; no licensed webfont file is present, so other devices use the fallback stack. Code retains monospace. Auth and API contracts are unchanged.

Acceptance: remove the entire AI WORKSPACE intro row; reduce header brand size and spacing; revise all docs introductions toward application and outcome; preserve form IDs, action URLs and runtime scripts. Deployment is unverified until a live check confirms the new revision.


## Next.js migration — 2026-09-28

The owner authorized beginning the Next.js migration. `next-app/` is the isolated migration app; production remains the existing Worker/static site until cutover is verified. `/loading` is native React with shared header/footer, React theme state and a React copyable code window. See `next-app/README.md` for run commands, route/data contract, evidence and next stages. This authorization changes the frontend direction only; it does not migrate hosting or authentication. `.assetsignore` excludes the entire migration app from the existing Worker static asset upload.


## Next.js page assembly — 2026-09-30

Owner requested combining the existing main files with Next.js while preserving all UI colors. Preview `/` and `/loading` now share `next-app/components/landing-page.jsx`; no stylesheet was modified. This is a public introduction only: Open Workspace still goes through the production signed-session entry. Local workspace/docs/auth URLs redirect to the existing origin, preserving queries. `/blog` hands off to actual `/news`; `/showcase` opens the existing features grid. Production root/auth/API routing is unchanged. No hosting or authentication migration is authorized by this assembly.

Fields: surface (string, existing intro JSX); color_mode (normal|docs, existing localStorage preference); destination (fixed HTTPS route, next.config.mjs); evidence (build/browser checks in commit report); secret_values_exposed (boolean, false). Acceptance: root/intro render identical content, both color modes persist, protected route handoffs retain queries, CSS remains byte-identical.
