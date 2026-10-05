# SDKSPACE Codex Phase 2 Code-Mode Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route eligible existing `/api/chat` code-mode requests through a Worker-safe private Codex runtime gateway behind a default-off feature flag, while preserving the current request/response contract and existing provider fallback.

**Architecture:** The Cloudflare Worker must not import `runtime/sdkspace-codex-adapter.mjs` because that module owns a native `codex app-server` child process and Linux filesystem lifecycle. Phase 2 therefore adds a Worker-safe gateway that calls a private `env.CODEX_RUNTIME` service binding. The private runtime service is expected to translate logical SDKSPACE session/workspace IDs into an absolute workspace and call the Phase 1 adapter. `src/index.js` only decides eligibility, charges existing quota, calls the gateway, and falls back to the current code-mode provider path when Codex is disabled/ineligible or a retryable runtime failure occurs.

**Tech Stack:** Cloudflare Worker ES modules, Service Binding `fetch`, existing `/api/chat`, existing quota/history/session helpers, Node `node:test` for pure gateway tests. No new npm dependency.

**Spec:** `docs/superpowers/specs/2026-10-05-sdkspace-codex-app-server-runtime-design.md`

## Global Constraints

- Work only on branch `feat/codex-app-server-runtime`.
- Do not modify `assets/chat.js`, HTML/UI, Firebase auth, D1 schema, GitHub action routes, provider/model menus, or login redirects in Phase 2.
- Do not deploy and do not modify production Cloudflare bindings in `wrangler.toml` yet.
- `CODEX_RUNTIME_ENABLED` is default-off; only exact values `1` or `true` (case-insensitive) enable routing.
- The Worker never imports `runtime/sdkspace-codex-adapter.mjs`, `node:child_process`, or Codex JSON-RPC code.
- The browser never calls Codex App Server or the private runtime binding directly.
- Preserve current quota behavior: an eligible Codex turn consumes the existing chat quota exactly once; provider fallback must reuse that same quota charge rather than double-charge.
- Preserve current history behavior: a successful Codex result is recorded through the existing `recordHistory` callback exactly like a normal non-stream chat completion.
- Preserve existing non-code modes and Claude code mode unchanged.
- Requests with attachments continue through the existing provider path in Phase 2; attachment transfer to runtime is a later phase.
- No external GitHub write is added in Phase 2.

## Runtime Eligibility Contract

A request may use Codex runtime only when all are true:

1. `tool === 'code'`;
2. `provider === 'openai'`;
3. `CODEX_RUNTIME_ENABLED` is enabled;
4. `env.CODEX_RUNTIME` exists and exposes `fetch`;
5. `body.workspace_id` is a non-empty safe logical ID;
6. there are no attachments.

Otherwise, the current code-mode provider flow is used unchanged.

`workspace_id` is a logical identifier only. The Worker must never send or construct an absolute filesystem path. Workspace-to-path resolution belongs to the private runtime service in Phase 3/5.

## Private Runtime Request Contract

Worker -> `env.CODEX_RUNTIME.fetch()`:

```json
{
  "sessionId": "<stable signed-user + conversation/request key>",
  "workspaceId": "<validated logical workspace id>",
  "message": "<current user message>",
  "requestId": "<server correlation id>"
}
```

Endpoint path: `/v1/code/turn` on the private Service Binding request URL.

Expected success payload:

```json
{
  "ok": true,
  "runtime": "codex",
  "threadId": "...",
  "turnId": "...",
  "status": "completed",
  "message": "..."
}
```

The Worker must normalize that to the current `/api/chat` success shape:

```json
{
  "ok": true,
  "status": "completed",
  "message": "...",
  "output": "...",
  "sources": [],
  "runtime": "codex"
}
```

plus existing history metadata.

## Fallback Policy

- Flag disabled / no binding / no workspace / attachments / provider Claude: do not call runtime; use existing provider flow.
- Runtime network failure, 5xx, `runtime_unavailable`, `runtime_timeout`, or `runtime_turn_failed`: if current provider credentials are available, fall back to the existing OpenAI code-mode path using the already-acquired quota.
- `runtime_busy`: return HTTP 409 with a safe retryable runtime error; do not start a second provider answer for the same logical turn.
- `runtime_invalid_request` or `runtime_unsupported_request`: return HTTP 502 with a safe runtime error; do not silently hide a contract/programming error through fallback.
- Never expose raw runtime stderr, stack, environment, binding details, JSON-RPC payloads, token values, or internal workspace paths.

## Review Focus

1. **Worker/runtime coupling:** `src/index.js` must not import Node-native Phase 1 runtime modules.
2. **Quota double-charge:** provider fallback after a failed runtime attempt must not call `takeQuota` a second time.
3. **History duplication:** only the final successful Codex or provider result may be recorded once.
4. **Missing workspace:** ordinary existing code mode without `workspace_id` must behave exactly as before.
5. **Runtime busy:** a busy runtime must return a retryable 409 instead of silently starting an unrelated provider completion.

---

### Task 1: Worker-Safe Codex Runtime Gateway

**Files:**
- Create: `src/codex-runtime-gateway.js`
- Create: `tests/codex-runtime-gateway.test.mjs`

**Interfaces:**
- Produces `codexRuntimeEnabled(env) -> boolean`.
- Produces `validWorkspaceId(value) -> string | null`.
- Produces `shouldUseCodexRuntime({ env, tool, provider, workspaceId, attachmentCount }) -> boolean`.
- Produces `callCodexRuntime({ env, sessionId, workspaceId, message, requestId }) -> Promise<{ ok, runtime, threadId, turnId, status, message }>`.
- Produces `CodexRuntimeGatewayError` with public fields `{ code, retryable, httpStatus }` only.

- [ ] **Step 1: Write failing eligibility tests**

Tests:
- `codex runtime flag is disabled by default`
- `codex runtime requires code tool openai provider private binding workspace id and zero attachments`
- `workspace id rejects empty traversal-like and oversized values`

Safe workspace ID format for Phase 2: `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`, and reject `.` / `..` exactly.

- [ ] **Step 2: Run RED**

```bash
node --test tests/codex-runtime-gateway.test.mjs
```

Expected: FAIL because `src/codex-runtime-gateway.js` does not exist.

- [ ] **Step 3: Implement eligibility helpers only**

No fetch logic beyond what tests require.

- [ ] **Step 4: Add private binding request tests**

Tests:
- `gateway posts only logical runtime identifiers and message to private binding`
- `gateway normalizes successful runtime result`
- `gateway rejects malformed success response`
- `gateway maps runtime_busy to retryable 409`
- `gateway maps retryable runtime failures without leaking raw details`
- `gateway maps binding fetch failure to runtime_unavailable`

Use an in-memory fake object with `fetch(request)`; no network and no live Codex credentials.

- [ ] **Step 5: Implement `callCodexRuntime`**

Use `env.CODEX_RUNTIME.fetch(new Request('https://sdkspace-runtime.internal/v1/code/turn', ...))`. Send only `sessionId`, `workspaceId`, `message`, `requestId`. Validate the returned JSON before exposing it.

- [ ] **Step 6: Run Task 1 tests**

```bash
node --test tests/codex-runtime-gateway.test.mjs
```

Expected: all PASS, zero failures.

- [ ] **Step 7: Commit Task 1**

```bash
git add src/codex-runtime-gateway.js tests/codex-runtime-gateway.test.mjs
git commit -m "feat: add worker codex runtime gateway"
```

### Task 2: Feature-Flagged `/api/chat` Code Routing

**Files:**
- Modify: `src/index.js`
- Create: `tests/codex-code-routing.test.mjs`
- Reuse: `src/codex-runtime-gateway.js`

**Interfaces:**
- Consumes Task 1 `shouldUseCodexRuntime` and `callCodexRuntime`.
- Existing `/api/chat` public request/response remains compatible.
- New optional request field: `workspace_id` logical identifier; old clients that omit it keep existing behavior.

- [ ] **Step 1: Write failing routing guard tests**

Pin these behaviors:
- `chat research url writer and image paths do not reference codex runtime routing`;
- `Claude code mode remains on existing provider path`;
- `OpenAI code mode without workspace_id remains on existing provider path`;
- `OpenAI code mode with attachments remains on existing provider path`;
- `eligible OpenAI code mode checks runtime after validation and quota setup but before provider execution`.

Where full Worker invocation is cumbersome, expose one small pure helper from `src/codex-runtime-gateway.js` and use a narrow source-contract assertion only for insertion ordering in `src/index.js`; do not replace behavioral tests with broad regex snapshots.

- [ ] **Step 2: Run RED**

```bash
node --test tests/codex-code-routing.test.mjs
```

Expected: FAIL because `src/index.js` does not yet wire the gateway.

- [ ] **Step 3: Wire the gateway into `handleChat`**

Add the Worker-safe import. Validate/normalize `body.workspace_id`. Preserve all existing validation and attachment parsing. Acquire the existing chat quota once. Attempt Codex only when eligibility is true.

The runtime session key must be server-derived, not trusted from the browser. Build it from the signed SDKSPACE identity plus `body.conversation_id` when present; when conversation ID is absent, include the current `requestId` so unrelated new conversations never share a thread accidentally.

- [ ] **Step 4: Normalize Codex success to current chat shape**

On success:
- require a non-empty runtime message;
- call existing `recordHistory(message)` exactly once;
- return HTTP 200 with `{ ok:true, status:'completed', message, output:message, sources:[], runtime:'codex', ...historyMetadata }` and existing quota headers.

- [ ] **Step 5: Add fallback/error tests**

Tests:
- `retryable runtime unavailable falls back to existing provider without second quota charge`;
- `runtime timeout falls back when OpenAI provider is available`;
- `runtime busy returns 409 and does not invoke provider fallback`;
- `runtime unsupported request returns safe 502 and does not invoke provider fallback`;
- `Codex success records one history exchange`;
- `Codex failure plus provider success records only provider result`.

- [ ] **Step 6: Implement fallback policy**

Do not refund quota before a successful provider fallback. If runtime retryable failure occurs but the existing OpenAI provider is unavailable, refund quota and return the current safe service-unavailable/error contract rather than leaking runtime internals.

- [ ] **Step 7: Run focused Phase 2 tests**

```bash
node --test tests/codex-runtime-gateway.test.mjs tests/codex-code-routing.test.mjs
```

Expected: all PASS, zero failures.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/index.js src/codex-runtime-gateway.js tests/codex-runtime-gateway.test.mjs tests/codex-code-routing.test.mjs
git commit -m "feat: route eligible code turns to codex runtime"
```

### Task 3: Regression and Build-Safety Gate

**Files:**
- No new production feature files unless a failing test proves a required fix.

- [ ] **Step 1: Run Phase 0-2 focused tests**

```bash
node --test \
  tests/codex-app-server-jsonl.test.mjs \
  tests/codex-app-server-client.test.mjs \
  tests/sdkspace-codex-adapter.test.mjs \
  tests/codex-runtime-gateway.test.mjs \
  tests/codex-code-routing.test.mjs
```

Expected: all PASS, zero failures.

- [ ] **Step 2: Run full repository regression**

```bash
node --check src/index.js
node --check src/firebase-worker.js
node --test tests/*.test.mjs
```

Expected: all PASS, zero failures.

- [ ] **Step 3: Run Worker bundling dry-run**

```bash
npx wrangler deploy --dry-run
```

Expected: build succeeds without a Node `child_process`/native-module import error. This specifically proves the Worker did not accidentally import Phase 1 native runtime code.

- [ ] **Step 4: Verify diff and no deploy**

Confirm Phase 2 changes are limited to `src/index.js`, `src/codex-runtime-gateway.js`, Phase 2 tests, and docs. Confirm `wrangler.toml` remains unchanged and no live deploy occurred.

## Phase 2 Exit Gate

Do not enable the flag in production, add a service binding, alter UI, or provision real workspaces until all are true:

- Worker-safe gateway tests pass;
- code-mode routing/fallback tests pass;
- Phase 0 and Phase 1 tests remain green;
- full repository regression passes;
- Wrangler dry-run succeeds with no Node-native import in Worker bundle;
- ordinary code mode without `workspace_id` remains unchanged;
- Claude code mode remains unchanged;
- Codex success preserves current chat response/history/quota contract;
- runtime failure cannot double-charge quota or duplicate history;
- no deployment occurred.

After this gate passes, create Phase 3 for workspace provisioning/source selection and the private runtime service handler that maps `workspaceId` to an isolated absolute path before calling the Phase 1 adapter.
