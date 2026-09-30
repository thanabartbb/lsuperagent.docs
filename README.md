# LSUPERAGENT

AI Framework: **LSUPERAGENT public AI workspace**

Last updated: **2026-09-30T14:27:14+07:00 Asia/Bangkok**
Last update task: **Assemble the existing Next.js intro as the main preview page, preserve all UI colors, and connect workspace route handoffs.**

The proposed one-owner session continuity system is specified in [`docs/session-continuity-pilot.md`](docs/session-continuity-pilot.md). Signed-in chat history now persists in D1 (see Chat contract below); the rest of that continuity design is not built.

Feature goal: Build a Code chat entry so the signed-in owner can ask for code and receive a code-oriented AI response, with no claim that the page edits GitHub files. `/tools` links to `/chat?mode=code`; `assets/chat.js` sends `mode: "code"` and `tool: "code"` to `/api/chat`. The result is text in the chat. It is not a repository editor or a verified live-model end-to-end run. Each account gets a daily quota stored in D1: 50 chat messages (a message with attachments counts 2) and 10 generated images, plus a site-wide cap of 2000 units; it resets at 00:00 Thai time and the owner is exempt. An in-memory burst guard (10 requests per 10 minutes per IP and tool) still applies. Answers cut off at the output-token cap are shown with a note instead of being dropped. Answers stream as NDJSON; signed-in chats are saved per account in D1 and reopen from the History panel or `?c=`.

Exa Search: `/tools` links to authenticated `/exa`. It calls `POST /api/exa/search`; the Cloudflare Worker reads `EXA_API_KEY` from its environment and makes the Exa request server-side. Set `EXA_API_KEY` as a Worker secret to enable search. The browser never receives the key. Search is login-gated and the Worker rate limit is temporary, not a spend cap.

This repository powers the public LSUPERAGENT AI Workspace. The login UI presents email/password, Google OAuth, and GitHub OAuth. The chat UI uses the existing signed session and server-side `/api/chat` route. Email/password depends on Firebase Web configuration and the Email/Password provider being enabled. GitHub OAuth depends on the existing Worker client ID/secret. Each login issues a six-hour signed cookie; historical session storage and server-side session revocation are not implemented.

Published package note: `npmjs.sdk-space@1.0.1` (npm registry, checked 2026-09-26) is a separate CommonJS package from `lsupergen-sdk`. Its tarball exports `npmjsSdkSpace()` and returns the string `npmjs.sdk-space v1.0.0`; it is not the `/v1` API client used in `/guide`.

## AI Framework Contract

### 1. Pinned Stack

Agents working in this repository must treat this stack as pinned unless the owner explicitly changes it in the current task:

| Layer | Pinned decision |
|---|---|
| Repository | `thanabartbb/lsuperagent.docs` |
| Public target | `https://agents-sdk.space` |
| Runtime host | Cloudflare Workers Static Assets |
| Worker name | `lsuperagent-docs` |
| Worker entry | `src/firebase-worker.js` → `src/index.js` |
| Frontend surface | Static HTML/CSS/JS files |
| Primary runtime endpoint | `POST /api/chat` |
| SDK API | `GET /v1/health` (public); `GET /v1/me`, `POST /v1/chat`, `POST /v1/image` with a Bearer `lsg_` key from `POST /api/sdk/keys` |
| Docs and playground | `/docs/:page` (docs site, login required) and `/guide` (`lsupergen-sdk` playground, login required) |
| Auth surfaces | Public UI: email/password, Google OAuth, GitHub OAuth; runtime: existing signed user session and Owner Google Dev Gate |
| Owner workspace | `/dev` |
| Control-plane reference | `/dev/control-plane/` |
| Route decision | `/control` redirects to `/dev` |
| Database/storage | D1 `agentssdkspace` bound as `DB` for chat history (`migrations/0001_chat_history.sql`); no R2/KV; attachments are not stored |
| Design base | Opaque #000000 canvas; Normal black/white with restrained blue-gray accent; Docs black with muted purple accent |
| Deployment rule | Do not claim live/deployed without verifiable evidence |

### 2. Feature Goal

Build a public AI Workspace so authenticated users can safely use real AI capabilities without an anonymous access path, with `/login` as the public entry surface.

The public auth pages are `login.html`, `signup.html`, and `forgot-password.html`. Brand links on `/login` and `/home` open the public `/loading` intro page adapted from the supplied HTML. Its primary action goes through `/` to `/login` or `/home` according to the signed session; the chat action uses the guarded `/chat`. The header and lower Docs action use `/docs`; the lower SDK action uses `/guide`. Its news cards link to external publisher pages and are static links, not a live feed. Successful sign-in and the authenticated root default to `/home`; direct links to `/chat` remain available. Authenticated `/home` links to `/chat`, `/tools`, `/docs`, and `/guide`. The docs site (`docs-shell.html`, `assets/docs*.{js,css}`, `docs-content/*.html`) and its content route `/docs-content/*` require the signed session. `assets/chat.js` checks `/api/auth/session` and sends conversation to `POST /api/chat`. Google and GitHub callbacks remain `/auth/google/callback` and `/auth/github/callback`. GitHub login uses `read:user user:email` only; it does not authorize repository writes or save a GitHub access token.

The public `/loading` intro and authenticated `/guide` expose a persistent two-mode color switch. Both use fully opaque `#000000` page and tab backgrounds. Normal mode uses white text and a restrained blue-gray accent (`#91A7BD`); Docs mode uses black with muted purple (`#70568F`). The selected mode is stored in browser local storage. The Loading logo uses the existing `/logo.svg` asset at 88×88 CSS pixels.

### 3. Data Contract

Every feature or page must declare its data contract before implementation.

| Field | Type | Source | Rule |
|---|---:|---|---|
| `surface` | string | static page or API response | Must identify the active surface/version. |
| `status` | string | API response, docs state, or route contract | Must be one of `docs`, `planned`, `ready`, `live`, `blocked`, `retired`. |
| `last_updated_at` | ISO datetime | manual update or automation update | Must include timezone when written by an agent. |
| `last_update_task` | string | agent-written update log | Must state the concrete task performed. |
| `route` | string | `src/index.js`, `_redirects`, or static link | Must match the actual route used in the repo. |
| `source_path` | string | repository path | Must point to the file being described. |
| `evidence` | string | commit SHA, file path, route, or observed result | Must not be invented. |
| `secret_values_exposed` | boolean | API response/docs statement | Must be `false` for any public or docs-only surface. |
| `authenticated` | boolean | signed session cookie verification | Must be `true` before `/chat`, `/tools`, `/api/chat`, or `/api/image` are available. |
| `intro_links` | static URLs | `loading.html` | Brand route `/loading`, session-aware CTA `/`, guarded `/chat`, guarded `/docs` and `/guide`, and external news sources. |
| `color_mode` | enum `normal`, `docs` | `assets/theme-modes.js` local storage preference | Sets accent colors while keeping page and tab canvases opaque black. |
| `return_to` | relative path | login query/state | Must remain an internal, safe path and defaults to `/home`; explicit `/chat` is preserved. |
| `mode` | enum `chat`, `code` | `/chat` query and `assets/chat.js` request | Code entry sends `tool: "code"` to the Worker. |
| `docs_page` | slug `[a-z0-9-]+` | `/docs/:page`, `assets/docs-nav.js` | Must have a matching `docs-content/<slug>.html`; unknown slugs render a not-found message. |
| `api_key` | string `lsg_…` | `POST /api/sdk/keys` | Stateless signed token, 30-day expiry, shown once; never stored or logged. |
| `quota_remaining` | number or unavailable | `/api/chat` headers `x-lsuperagen-quota-remaining` / `-limit` / `-reset` | Today's remaining units for the signed-in account (D1). Absent for the owner or without D1; the page then falls back to the burst-guard count. |
| `quota_exceeded` | 429 response, `status` value | `/api/chat`, `/api/image`, `/v1/chat`, `/v1/image` | Daily limit reached (`reset_at` = next 00:00 Asia/Bangkok, plus `retry-after`). No provider call is made. |
| `provider` | enum `openai` (default), `claude`; optional | `/api/chat` request body, `/chat` picker (`assets/chat.js`, remembered in localStorage) | `claude` needs the `ANTHROPIC_API_KEY` secret (else 503) and only chat/code modes (web tools → 400). Options come from `GET /api/chat-providers`, which returns availability booleans only. |
| `truncated` | boolean, response only | `/api/chat` response / `done` event | `true` when the answer stopped at the output-token cap; the partial answer is real and is shown with a "type 'ต่อ' to continue" note. |
| `stream` | boolean, optional | `/api/chat` request body, `assets/chat.js` | `true` returns `application/x-ndjson` (`delta`* then one `done` or `error`); omitted keeps the single JSON response. |
| `conversation_id` | string `c_` + 32 hex, optional | `/api/chat` request and response, `src/chat-store.js` | Request: continue that conversation only if the caller owns it. Response: present only when the exchange was saved. |
| `history_saved` | boolean, response only | `/api/chat` response / `done` event | Present only for signed-in `/api/chat` with D1 bound; `false` means the answer is real but was not stored. |
| `attachments` | array, optional, 0–4 items | `/api/chat` request body, `assets/chat.js` | Current user turn only; ≤20 MB decoded total; whole request body ≤28 MB (else 413). Invalid → 400 `validation_error`, no provider call. |
| `attachments[].data` | string, required | base64 `data:` URL built in the browser | MIME `image/png`, `image/jpeg`, `image/webp`, `image/gif` (≤5 MB) or `application/pdf` (≤10 MB); base64 length a multiple of 4. Never stored. |
| `attachments[].name` | string, optional | file name from the browser | Control characters removed, ≤120 characters, default `image` / `document.pdf`. Stored in history as `📎 name` only when the turn stays ≤12,000 characters. |

Mock fixtures are allowed only when named as fixtures. Placeholder content must not be presented as live functionality.

### 4. Acceptance Criteria

A change is acceptable only when all of these are true:

```gherkin
Given an agent edits this repository
When the edit is committed
Then README.md and AGENTS.md must still describe the current repo contract
And the update must include a real timestamp and task description
And no secret, token, OAuth client secret, API key, signed URL, or private credential is committed
And no unrelated framework is introduced without owner approval
And no page claims "coming soon" as a substitute for a real state
And no page claims live production behavior unless verified
And /loading and /guide render on opaque #000000 canvases in either saved color mode
And the selected color mode persists between /loading and /guide without changing route or auth behavior
And anonymous users are redirected from the workspace to `/login`
And the public login offers a working Google OAuth entry
And the chat calls `/api/auth/session` and `/api/chat` using the existing signed session
And no guest authentication bypass exists
And /control remains aligned with the route policy
And /dev remains owner workspace
And /dev/control-plane/ remains docs/reference unless explicitly changed
```

### 5. Negative Constraints

Agents must not do the following:

- Do not push unrelated templates into `main`.
- Do not migrate auth or platforms to Supabase/Vercel/Railway without a current owner instruction. D1 is approved by the owner (2026-09-28) for chat history and the per-account daily quota; `agentssdkspace` is bound as `DB`.
- Do not overwrite `index.html` with generic landing-page templates.
- Do not change `/control` away from `/dev` unless the owner explicitly changes route policy.
- Do not expose secrets or ask the owner to paste secrets into chat.
- Do not mark a feature as live when it is docs-only, planned, or blocked.
- Do not add "coming soon" as a fake completion state.
- Do not write to GitHub from another ChatGPT session without rereading `README.md`, `AGENTS.md`, and the latest commit first.
- Do not use public repository visibility as evidence that writes are safe. Public means readable; writes still require authorized apps/tokens.

## ChatGPT + GitHub Safety Lock

Standing owner authorization is active as of **2026-09-21**. ChatGPT may automatically create validated, fast-forward commits to `main` for changes the owner explicitly requests in the active chat, without asking for separate per-commit confirmation. The authorization is limited to `thanabartbb/lsuperagent.docs`. Every write must still verify the latest repository state and pass relevant checks. Force-pushes, deletion, permission changes, and secret changes require explicit action-specific approval.

## Update Loop Contract

Two maintenance loops exist conceptually for this repository:

1. **Repo Contract Loop** — every 6 hours, update `README.md` and `AGENTS.md` with the latest timestamp, latest observed task, route policy, and GitHub safety state.
2. **Prompt Stack Loop** — every 6 hours, update the AI framework layers: pinned stack, feature goal, data contract, acceptance criteria, and negative constraints.

Both loops must write real updates when there is a real state change. If there is no state change, the loop must still update the audit timestamp and say `No material change observed`.

## Shared layout

All 26 complete HTML page shells load `assets/layout.css` last. The root session redirect has no visual layout; docs fragments inherit `docs-shell.html`.

| Field | Type | Source / value |
|---|---|---|
| surface | string | Static HTML page shells |
| status | enum | ready (source checked; deployed rendering unverified) |
| max_width | CSS length | `assets/layout.css`: 1080px including gutters |
| gutter | CSS length | 16px below 768px; 24px otherwise |
| header_height | CSS length | 56px below 768px; 64px otherwise |
| evidence | string | 41 existing Node tests pass; scripts, forms and IDs preserved across 26 pages |
| secret_values_exposed | boolean | false |

Auth forms retain a 380px inner width. Docs keeps its sidebar; Chat keeps a flexible conversation area. Browser visual verification remains pending because Chromium download failed in the editing environment.


## Editorial contract — 2026-09-27

Build task-oriented page copy so visitors can identify an input, follow an approach, and use the resulting output. Across page shells and docs, lead with reusable steps and outcomes; keep personal biography and internal prohibition/status banners out of product introductions. Preserve operational errors and accurate technical reference details. Use the canonical logo in one or two brand positions per page and compact header names. The intro heading is owner-supplied copy: “React following deveguide by Next.js”; it describes editorial direction, not a migration from the pinned static frontend.

Content fields: heading and lead are static strings sourced from each HTML page; required on content pages. Brand asset is /logo.svg. Font preference is a CSS family from assets/editorial.css and assets/theme.css. Kantalad Cnd Bold is a local-font trial only; no licensed webfont file is present, so other devices use the fallback stack. Code retains monospace. Auth and API contracts are unchanged.

Acceptance: remove the entire AI WORKSPACE intro row; reduce header brand size and spacing; revise all docs introductions toward application and outcome; preserve form IDs, action URLs and runtime scripts. Deployment is unverified until a live check confirms the new revision.


## Chat contract — 2026-09-28

`POST /api/chat` (login required) accepts `stream: true` and then returns `application/x-ndjson`: `delta` events, then exactly one `done` or `error` event. Signed-in exchanges are saved to D1 and the response adds `conversation_id` and `history_saved`; `GET /api/chats`, `GET /api/chats/:id` and `DELETE /api/chats/:id` serve only the caller's own conversations. `attachments` (up to 4 base64 data URLs: PNG/JPEG/WebP/GIF ≤5 MB, PDF ≤10 MB, ≤20 MB total) go to the model as `input_image` / `input_file` for the current turn only; history keeps just the file names. Field-level contract: the `stream`, `conversation_id`, `history_saved` and `attachments` rows in §3 Data Contract above. The SDK route `/v1/chat` does not save history.

## Next.js migration — 2026-09-28

The owner authorized beginning the Next.js migration. `next-app/` is the isolated migration app; production remains the existing Worker/static site until cutover is verified. `/loading` is native React with shared header/footer, React theme state and a React copyable code window. See `next-app/README.md` for run commands, route/data contract, evidence and next stages. This authorization changes the frontend direction only; it does not migrate hosting or authentication. `.assetsignore` excludes the entire migration app from the existing Worker static asset upload.


## Next.js page assembly — 2026-09-30

Owner requested combining the existing main files with Next.js while preserving all UI colors. Preview `/` and `/loading` now share `next-app/components/landing-page.jsx`; no stylesheet was modified. This is a public introduction only: Open Workspace still goes through the production signed-session entry. Local workspace/docs/auth URLs redirect to the existing origin, preserving queries. `/blog` hands off to actual `/news`; `/showcase` opens the existing features grid. Production root/auth/API routing is unchanged. No hosting or authentication migration is authorized by this assembly.

Fields: surface (string, existing intro JSX); color_mode (normal|docs, existing localStorage preference); destination (fixed HTTPS route, next.config.mjs); evidence (build/browser checks in commit report); secret_values_exposed (boolean, false). Acceptance: root/intro render identical content, both color modes persist, protected route handoffs retain queries, CSS remains byte-identical.
