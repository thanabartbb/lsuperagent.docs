# lsuperagent.docs

AI Framework: **AGENTS-SDK-LAB / lsuperagen.docs**

Last updated: **2026-09-19T16:07:00+07:00 Asia/Bangkok**  
Last update task: **Create repository-level AI operating contract for ChatGPT + GitHub workflows.**

This repository is the docs/reference and control-surface source for AGENTS-SDK-LAB. It is not a playground for unrelated templates, Firebase experiments, or cross-chat prototype work unless the target path is explicitly declared first.

## AI Framework Contract

### 1. Pinned Stack

Agents working in this repository must treat this stack as pinned unless the owner explicitly changes it in the current task:

| Layer | Pinned decision |
|---|---|
| Repository | `thanabartbb/lsuperagent.docs` |
| Public target | `https://agents-sdk.space` |
| Runtime host | Cloudflare Workers Static Assets |
| Worker name | `lsuperagent-docs` |
| Worker entry | `src/index.js` |
| Frontend surface | Static HTML/CSS/JS files |
| Primary runtime endpoint | `POST /api/chat` |
| Auth surfaces | GitHub OAuth, Google OAuth, Owner Google Dev Gate |
| Owner workspace | `/dev` |
| Control-plane reference | `/dev/control-plane/` |
| Route decision | `/control` redirects to `/dev` |
| Database/storage | No D1/R2/KV unless owner approves a data model |
| Design base | Dark technical, near-black, graphite, petroleum/oxidized accent system |
| Deployment rule | Do not claim live/deployed without verifiable evidence |

### 2. Feature Goal

Build and maintain a real docs/reference control surface that helps the owner inspect, document, and safely evolve AGENTS-SDK-LAB without fake runtime claims or accidental cross-project writes.

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
And /control remains aligned with the route policy
And /dev remains owner workspace
And /dev/control-plane/ remains docs/reference unless explicitly changed
```

### 5. Negative Constraints

Agents must not do the following:

- Do not push unrelated templates into `main`.
- Do not add Firebase, Supabase, Vercel, Railway, D1, R2, KV, or any new platform binding unless the current task explicitly asks for it.
- Do not overwrite `index.html` with generic landing-page templates.
- Do not change `/control` away from `/dev` unless the owner explicitly changes route policy.
- Do not expose secrets or ask the owner to paste secrets into chat.
- Do not mark a feature as live when it is docs-only, planned, or blocked.
- Do not add "coming soon" as a fake completion state.
- Do not write to GitHub from another ChatGPT session without rereading `README.md`, `AGENTS.md`, and the latest commit first.
- Do not use public repository visibility as evidence that writes are safe. Public means readable; writes still require authorized apps/tokens.

## ChatGPT + GitHub Safety Lock

The GitHub connector should remain in **Always ask** mode unless the owner intentionally changes it. Any future automation that writes to this repo must treat GitHub writes as privileged actions and must verify the latest repo state before writing.

## Update Loop Contract

Two maintenance loops exist conceptually for this repository:

1. **Repo Contract Loop** — every 6 hours, update `README.md` and `AGENTS.md` with the latest timestamp, latest observed task, route policy, and GitHub safety state.
2. **Prompt Stack Loop** — every 6 hours, update the AI framework layers: pinned stack, feature goal, data contract, acceptance criteria, and negative constraints.

Both loops must write real updates when there is a real state change. If there is no state change, the loop must still update the audit timestamp and say `No material change observed`.
