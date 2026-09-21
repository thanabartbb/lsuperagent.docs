# LSUPERAGENT

AI Framework: **LSUPERAGENT public AI workspace**

Last updated: **2026-09-22T02:33:54+07:00 Asia/Bangkok**
Last update task: **Lock the reference-matched login and account-first authentication surface.**

This repository powers the public LSUPERAGENT AI Workspace. Users authenticate before they can use chat, code, research, URL reading, or image generation. The current login surface supports Firebase email/password when configured, Google OAuth, and GitHub OAuth. The visible Gmail option routes through Google OAuth; it is not a separate auth provider.

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
| Auth surfaces | Firebase email/password when configured, Google OAuth, GitHub OAuth, signed user session, Owner Google Dev Gate |
| Owner workspace | `/dev` |
| Control-plane reference | `/dev/control-plane/` |
| Route decision | `/control` redirects to `/dev` |
| Database/storage | No D1/R2/KV unless owner approves a data model |
| Design base | Pure black, white, `#0FA3D9` blue accent; reference-matched dark cinematic login |
| Deployment rule | Do not claim live/deployed without verifiable evidence |

### 2. Feature Goal

Build a public AI Workspace so authenticated users can safely use real AI capabilities without an anonymous access path, with `/login` as the public entry surface.

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
| `return_to` | relative path | login query/state | Must remain an internal, safe path and defaults to `/chat`. |

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
And anonymous users are redirected from the workspace to `/login`
And the public login offers email/password when configured plus Google and GitHub account authentication
And the visible Gmail option remains an alias to Google OAuth rather than a separate provider claim
And no guest authentication bypass exists
And /control remains aligned with the route policy
And /dev remains owner workspace
And /dev/control-plane/ remains docs/reference unless explicitly changed
```

### 5. Negative Constraints

Agents must not do the following:

- Do not push unrelated templates into `main`.
- Do not migrate auth to a different platform or add Supabase/Vercel/Railway/D1/R2/KV/new platform bindings unless the current task explicitly asks for it.
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
