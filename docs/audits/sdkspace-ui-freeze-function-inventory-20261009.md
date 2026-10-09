# SDKSPACE — UI Freeze + Functional Code Inventory

Audit date: 2026-10-09 (Asia/Bangkok)
Repository: thanabartbb/lsuperagent.docs
Observed `main` SHA: `eff7bbd32e0aafb0e864d521e58a7d659e95a921`

## Nonnegotiable UI freeze

Owner reports production UI was rolled back. The precise live rollback deployment ID
was **not obtainable during this audit**. Do not claim the GitHub `main` HTML/CSS is
byte-identical to that live rollback. Use the owner's approved deployment as the
visual baseline; obtain its asset manifest and hashes before any future visual work.

Until that baseline is identified:
- NO changes to existing HTML, CSS, browser JS, brand assets, responsive layout,
  page navigation, docs fragments, `next-app/`, or UI adapter.
- NO switching `/chat` between Classic Chat and Agent Starter.
- NO changing the homepage renderer, redirect rules, public product pages or worker
  route ownership. Backend routes may be **added**; existing UI routes may not be changed.
- NO entire-branch merges or broad cherry-picks from old branches to production.
- NO merge, deploy, D1 migration, secret modification or DNS changes without
  separate owner approval. Do not force-push or delete historical branches.

The independent `UI Freeze Verify` workflow checks changes to already-tracked UI
files and protected UI routing lines. It does not inspect actual pixels, prove the
live rollback matches `main`, or guarantee enforcement when branch protection is
missing. To enforce: GitHub Settings -> Rules -> Rulesets -> protect `main`, require
pull requests + `ui-freeze` status check and disallow direct/bypass merges.
Cloudflare production auto-deploy must also be gated to approved production changes.

## Why the UI changed / reversion risk

- PR #41 (`feat/sdkspace-homepage-redesign`) added `assets/homepage.css`
  and modified `src/public-resources.js`, which **renders public homepage markup**.
  This PR demonstrably changes the public homepage.
- `src/index.js` serves `/chat` through `env.AGENT_STARTER` with
  `src/agent-ui.js` rewriting UI HTML/assets/compiled script; the UI may change
  when that independent upstream Worker changes, even if local CSS stays identical.
  Classic chat is a fallback, not necessarily the active UI.
- PR #43 (`feat/self-hosted-cloudflare-sandbox`) was merged into `main` at
  `eff7bbd`, despite its previously draft-only intent. It added backend code
  and did **not** edit HTML/CSS. It is not evidence that Containers were deployed.
- The current `main` has no GitHub rulesets or branch protection.
- Root workflow `Public Product Verify` is red: at SHA `eff7bbd`,
  154/155 tests passed; one existing `agent-readiness.test.mjs` expects
  the pre-redesign English heading `What you can do`, while current homepage
  markup uses Thai text. This same failure existed at previous main SHA `b80d4fa`.
  A passing backend test does not establish deployed functionality.

## Functional inventory on main — code already present, not live entitlement

| Feature | Source | Status | Safe path |
|---|---|---|---|
| Email + Google/GitHub login | `src/firebase-worker.js`, `src/index.js`, `src/firebase-core.mjs` | Implemented; requires secrets and live auth checks | Keep as-is |
| Chat, code/writer, model/provider | `src/index.js`, `assets/chat.js` | Implemented API; visible /chat may use Agent Starter | Keep routes + UI unchanged |
| Research + URL reading | `src/index.js` | Provider calls implemented; needs configured model credentials | Reuse existing POST /api/chat modes |
| Image generation | `src/index.js` | Implemented API, quota and SDK endpoint | Preserve /api/image and /v1/image |
| Image/PDF attachments | `assets/chat.js`, `src/index.js` | Implemented request handling | Avoid changing composer |
| History + daily quota | `src/chat-store.js`, `src/quota.js`, `migrations/0001*,0002*` | Implemented with D1 ownership checks | Preserve D1 schema/data |
| GitHub code tools | `src/github-app.js`, `assets/github-tools.js`, `migrations/0003*` | Implemented with separate GitHub App OAuth and explicit approval | Use current backend; do not auto-commit |
| Exa search and AI news | `src/index.js`, `src/feeds.js` | Implemented routes; external service/network availability unverified | Reuse as-is |
| SDK client, signed keys and CLI | `src/index.js`, `src/public-resources.js`, `packages/sdkspace-cli` | Endpoints/CLI source present; npm registry publication not proven | Keep existing contracts |
| Public MCP read-only discovery | `src/index.js` | Implements stateless/legacy MCP discovery; not tool execution | Keep https://agents-sdk.space/mcp |
| Agent Starter chat | `src/index.js`, `src/agent-ui.js`, Service Binding `AGENT_STARTER` | Depends on independent `agent-starter` Worker; changes visible /chat | Do not switch or alter current UI |

## Candidate code — NOT ready for production integration

| Candidate | Location | Classification | Missing gate |
|---|---|---|---|
| Codex App Server protocol + runtime adapter | `feat/codex-app-server-runtime`: `runtime/**`, `src/codex-runtime-gateway.js`, `src/codex-chat-routing.js`, `tests/codex*.mjs` | **Best backend-only candidate**: 24 branch-only commits and 18 changed files vs main | Isolated compute service, authentication, storage/tenant mapping, live protocol verification; enable only code mode, opt-in |
| Python Image and Research Orchestrator | `services/image-research-agent/` on main | Private CLI, NOT website HTTP backend | Persistent service, authenticated Worker integration, per-user sessions/quotas, protected artifact handling, live API test |
| Cloudflare Containers executor | `services/sdkspace-sandbox/` and `src/openai-agent-sessions.js` on main | Skeleton with offline tests; **not deployed** | Compare against official Cloudflare template, validate webhooks, startup, cleanup, egress, OpenAI permissions, D1 migration, live session |
| Red chat tools branch | `audit/chat-tools-menu-red` | UI-changing: includes `chat.html` and `assets/chat-tools.js` | Do not import under UI freeze |
| Public workspace audit branch | `audit/public-ai-workspace` | UI-changing: modifies chat.html/index.html/app.css | Do not import |
| Old Codex/UI rewrite branches | `codex/clean-fullscreen-chat`, `codex/home-color-black-white-blue`, `codex/hotfix-public-html-500` | UI-changing and far behind | Do not merge |
| Next.js migration | `next-app/` and older branches | Separate migration, not current production runtime | Do not cut over domain or pages |

Every branch in the current branch listing was compared with `main`; most
feature branches are already ancestors/behind. The isolated Codex App Server
branch is the strongest reusable functional-only candidate; cherry-pick the
specific reviewed backend modules after a test plan, **never the whole branch**.

## Acceptance criteria for subsequent backend changes

1. UI Freeze check passes with zero modifications to existing protected files.
2. Existing auth, /home, /chat, /login, /loading and old /api/chat behavior
   remain stable; no externally hosted UI substitutes silently.
3. Every new API endpoint requires current authentication and prevents
   cross-user access, credential leakage and unsafe external mutations.
4. Existing Node tests and new targeted tests pass; fix the independent
   homepage heading test only in a separate, explicitly authorized review
   because the live approved UI baseline is not yet pinned.
5. Real provider tests, Sandbox connection, quota/cost/cleanup, failure paths
   and Cloudflare routing are verified before enabling any feature flag.
6. Work on a separate review branch, not `main`; deploy requires a second approval.

## Sources

- https://github.com/thanabartbb/lsuperagent.docs/pull/41/files
- https://github.com/thanabartbb/lsuperagent.docs/pull/43/files
- https://github.com/thanabartbb/lsuperagent.docs/tree/feat/codex-app-server-runtime
- https://developers.cloudflare.com/sandbox/coding-agents/openai-agents-api/
- https://developers.openai.com/api/docs/guides/agents-api/environments/self-hosted
