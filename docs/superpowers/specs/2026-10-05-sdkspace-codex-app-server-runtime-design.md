# SDKSPACE Codex App Server Runtime — Design Spec

Date: 2026-10-05
Status: Design approved in chat; implementation not started
Branch: `feat/codex-app-server-runtime`
Production repository: `thanabartbb/lsuperagent.docs`
Production domain: `https://agents-sdk.space`

## 1. Goal

Upgrade the existing SDKSPACE `/chat` code mode from an LLM-only coding assistant into a real software-agent workflow that can operate on a project workspace using OpenAI Codex App Server, while preserving the current production UI, authentication, D1 history/quota, provider selection, GitHub App approval flow, and all non-code chat modes.

The user experience must stay on the existing `/chat` surface. No new page is required for the first release.

Success means a signed-in user can ask the existing code mode to inspect a real project, run bounded commands/builds/tests, produce a grounded result from the workspace, and request approval before any external GitHub write action.

## 2. Current production baseline

The current production site is a Cloudflare Worker/static-assets application:

- Worker entry: `src/firebase-worker.js`
- Main runtime/router: `src/index.js`
- Chat UI: `/chat` with `assets/chat.js`
- Chat endpoint: `POST /api/chat`
- Existing modes: chat, code, research, url, writer, image
- Existing auth/session, D1 chat history, quota, attachments, model/provider selection
- Existing GitHub App connection and explicit user approval for repository creation and bounded commits
- `next-app/` remains a migration target but is not the current production runtime

This design must not change hosting, route ownership, UI palette, login redirect, session format, D1 schema, existing non-code mode behavior, or current GitHub secret handling as a side effect.

## 3. Approaches considered

### A. Replace `/api/chat` entirely with Codex App Server

Rejected for V1. This has the highest regression risk because chat, research, URL, writer, image, quota, history, and provider behavior currently share the existing endpoint.

### B. Add a second page dedicated to Codex

Rejected for V1. It creates duplicate product surfaces and makes SDKSPACE feel more fragmented. The product requirement is to keep one existing chat surface.

### C. Route only existing `mode=code` through a Codex runtime adapter

Selected. This preserves the production chat contract for all existing modes and limits the first Codex integration to one bounded capability path.

## 4. Target architecture

```text
Browser: existing /chat
        |
        | POST /api/chat  { mode: "code", ... }
        v
Cloudflare Worker / SDKSPACE Gateway
        |
        | authenticated, quota checked, request validated
        v
Codex Runtime Adapter
        |
        | private RPC transport
        v
Codex App Server
        |
        v
Per-session Project Workspace
        |
        +-- read/search files
        +-- run bounded shell commands
        +-- run build/test commands
        +-- create file diffs
        +-- emit progress/events
```

The browser must never connect directly to Codex App Server and must never receive provider/runtime secrets.

## 5. Runtime boundary

Codex App Server is treated as an execution/runtime dependency, not as the public SDKSPACE API.

SDKSPACE owns:

- authentication
- authorization
- rate/quota enforcement
- user-to-runtime session mapping
- project/workspace ownership
- request validation
- event normalization
- external GitHub write approvals
- production API contract

Codex App Server owns:

- agent thread/turn lifecycle
- workspace-aware coding execution
- command/file tool events
- model interaction inside the Codex runtime

The first implementation should use the App Server protocol rather than modifying Codex Rust source code.

## 6. Integration with existing `/api/chat`

Existing non-code behavior remains unchanged.

Pseudo-routing:

```text
POST /api/chat
  -> validate signed session
  -> parse request
  -> enforce quota
  -> if mode/tool != code:
       run existing provider path unchanged
  -> if mode/tool == code and codex runtime enabled:
       call Codex Runtime Adapter
  -> otherwise:
       fall back to current code-mode implementation
```

A feature flag/runtime binding must allow Codex code mode to be disabled without reverting unrelated chat code.

## 7. Codex protocol lifecycle

For each runtime connection:

1. Start/connect to `codex app-server` privately.
2. Send `initialize` with SDKSPACE client metadata.
3. Send `initialized`.
4. Create or resume a Codex thread for the active SDKSPACE coding conversation/workspace.
5. For each code request send `turn/start`.
6. Consume item/turn events until `turn/completed` or failure.
7. Normalize events into the SDKSPACE response/event format.

The adapter must not expose raw internal protocol objects directly to the browser. This leaves room to change runtime implementation later.

## 8. Workspace model

V1 requires a project workspace that is isolated from the Worker/static asset repository and isolated between users/sessions.

Workspace requirements:

- project files exist in an ephemeral or explicitly persisted runtime filesystem
- one user's workspace cannot be referenced by another user's session
- path traversal outside the workspace root is rejected
- secrets are not written into project files by default
- destructive commands are denied or approval-gated
- workspace lifecycle has a clear expiry/cleanup policy

Initial project sources may be added incrementally. The runtime interface should support a future source descriptor such as:

```json
{
  "source": "github",
  "owner": "example",
  "repo": "project",
  "ref": "main"
}
```

The first protocol spike may use a controlled local fixture workspace before live GitHub checkout is enabled.

## 9. Runtime hosting

The current Cloudflare Worker cannot be assumed to provide a persistent native process/filesystem suitable for running Codex App Server directly.

Therefore V1 architecture separates:

```text
Cloudflare Worker = public gateway / auth / routing
Runtime service    = Codex process + filesystem + git/node/tooling
```

The runtime service may later be hosted in a Cloudflare Container/Sandbox or another Linux container environment, but the SDKSPACE Worker must communicate with it through a private authenticated service interface.

Hosting selection is an implementation decision and must not leak into the browser API.

## 10. Security and approval rules

Required invariants:

- no Codex App Server public listener exposed directly to the internet
- Worker-to-runtime requests must be authenticated
- runtime session IDs must not be trusted as authorization by themselves
- all file operations remain under the assigned workspace root
- shell execution uses an allow/deny policy and resource limits
- external GitHub write operations continue to require the existing explicit browser approval flow
- provider keys and GitHub user tokens remain server-side
- never store plaintext GitHub user access tokens in browser storage or chat history
- never auto-push generated changes during initial integration

V1 may allow read/inspect/build/test behavior before write/push behavior.

## 11. Existing GitHub integration

Do not replace the current GitHub App OAuth and approval implementation.

Codex may propose changes and produce a diff/workspace result. External repository mutation continues through SDKSPACE's existing approved GitHub action path.

Target flow:

```text
Codex edits workspace
    -> SDKSPACE presents result/diff
    -> user explicitly approves external write
    -> existing /api/github/actions path performs validated GitHub action
```

This retains the current permission boundary instead of giving Codex unrestricted repository credentials.

## 12. Event model for the UI

The existing UI should remain usable even before richer event rendering is added.

Initial normalized events can include:

- `runtime.started`
- `workspace.ready`
- `agent.reading`
- `agent.command.started`
- `agent.command.completed`
- `agent.file.changed`
- `agent.message.delta`
- `agent.completed`
- `agent.failed`

V1 is allowed to collapse these into a final answer first if necessary to prove the runtime connection. Streaming progress is the next increment, not a prerequisite for the first protocol test.

## 13. Failure and fallback behavior

If the Codex runtime is unavailable, malformed, times out, or fails initialization:

- do not break `/chat`
- return a clear code-runtime error or use the existing code-mode fallback when the feature flag permits
- preserve the user's typed prompt for retry
- do not consume an external GitHub write approval
- log a server-side request/runtime correlation ID without secrets

Non-code modes must be unaffected by Codex runtime failures.

## 14. Implementation phases

### Phase 0 — Protocol proof

Build a runtime adapter test that proves:

`initialize -> initialized -> thread/start -> turn/start -> completed result`

Use a controlled fixture workspace. No production routing and no deploy.

### Phase 1 — SDKSPACE adapter

Create a small runtime module/service boundary that hides Codex JSON-RPC details from `src/index.js`.

### Phase 2 — Code-mode routing

Route only `mode=code` to the adapter behind a feature flag. Preserve current `/api/chat` request/response compatibility.

### Phase 3 — Workspace execution

Enable file inspection, bounded commands, build/test execution, and diff production inside an isolated project workspace.

### Phase 4 — UI progress and approval

Map normalized runtime events into the current chat UI and reuse the existing approval pattern for external GitHub mutations.

### Phase 5 — Production runtime hosting

Connect the Worker to a private Linux/container runtime, run end-to-end tests, then consider deployment.

## 15. Non-goals for this project slice

Do not add these during the first Codex integration:

- a new chat page
- redesign of `/chat`
- new color system or branding changes
- general multi-model bus rewrite
- Claude/Gemini agent runtimes
- plugin marketplace
- MCP marketplace UI
- autonomous repo push
- migration from Worker/static frontend to `next-app/`
- replacement of D1 history/quota

These can be layered later after the Codex runtime path is proven.

## 16. Testing strategy

Before production integration, require tests for:

- adapter protocol initialization
- thread creation/resume behavior
- successful turn completion
- runtime failure/timeouts
- malformed event handling
- workspace path traversal rejection
- command policy rejection
- `/api/chat` non-code regression behavior
- code-mode fallback behavior
- authentication and quota checks remain active
- GitHub external write still requires explicit approval

Repository baseline checks remain required:

```sh
node --check src/index.js
node --check src/firebase-worker.js
node --test tests/*.test.mjs
npx wrangler deploy --dry-run
```

No live deploy is part of the initial implementation proof.

## 17. Rollback strategy

The integration must be reversible without rolling back unrelated production changes.

Required controls:

- isolated feature branch during implementation
- feature flag around Codex code-mode routing
- existing code mode remains available as fallback until Codex path is proven
- no D1 destructive migration required for first integration
- no changes to login/OAuth contracts required for first integration

Disabling the feature flag restores the current code-mode behavior.

## 18. Acceptance criteria

The first milestone is accepted only when all of the following are true in a non-production test environment:

1. SDKSPACE adapter starts/connects to Codex App Server.
2. `initialize` succeeds.
3. A Codex thread is created.
4. A user coding instruction starts a turn.
5. Codex inspects a controlled workspace rather than answering from prompt context alone.
6. The turn completes and SDKSPACE receives a normalized answer.
7. A build/test command can be executed under the command policy.
8. Runtime failure does not affect ordinary chat mode.
9. No direct public Codex listener is required.
10. No production deploy has occurred merely to prove the protocol.

## 19. Product statement after V1

Once the workspace execution milestone is complete, SDKSPACE can accurately describe its core capability as:

> SDKSPACE is an AI developer workspace where you can give an agent a real software project and ask it to inspect code, investigate problems, run builds/tests, prepare changes, and carry approved work forward from one chat workspace.

That statement must only be used once the corresponding runtime capabilities are actually verified.
