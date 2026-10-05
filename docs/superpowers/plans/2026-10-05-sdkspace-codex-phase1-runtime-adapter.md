# SDKSPACE Codex Phase 1 Runtime Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small SDKSPACE-owned runtime adapter that hides Codex App Server JSON-RPC/process details behind a stable code-agent interface that Phase 2 can call from `/api/chat` without changing production routing yet.

**Architecture:** Build one Node ESM adapter above the already-proven `runtime/codex-app-server/client.mjs`. The adapter owns SDKSPACE session-to-Codex-thread reuse, validates its public inputs, normalizes successful results, maps Codex/runtime failures to stable SDKSPACE error codes, and disposes runtime sessions cleanly. Tests use the existing deterministic fake Codex App Server so Phase 1 does not require live credentials.

**Tech Stack:** Node.js ESM, `node:test`, `node:assert/strict`, existing `runtime/codex-app-server/client.mjs`, existing fake Codex App Server fixture. No new npm dependency.

**Spec:** `docs/superpowers/specs/2026-10-05-sdkspace-codex-app-server-runtime-design.md`

## Global Constraints

- Work only on branch `feat/codex-app-server-runtime`.
- Do not modify `src/index.js`, `src/firebase-worker.js`, `/chat`, `assets/chat.js`, auth, D1, quota, provider selection, GitHub actions, Wrangler config, or production hosting in Phase 1.
- Do not deploy.
- Do not expose Codex App Server directly to the browser or public internet.
- Do not leak raw JSON-RPC request/response objects or credential/config values through the adapter result or error surface.
- Preserve the existing Phase 0 Codex client and protocol tests.
- Keep the adapter provider-specific internally but expose an SDKSPACE-owned contract so the Worker is not coupled to Codex protocol details.
- A session may reuse its Codex thread only while it remains bound to the same absolute workspace path.
- Changing a session's workspace path must dispose the previous runtime session and create a fresh thread rather than silently reusing the old thread.

## Review Focus

1. **Session collision:** two SDKSPACE session IDs must never share a Codex client/thread accidentally.
2. **Workspace rebinding:** reusing one session ID with a different workspace must tear down the old runtime before starting the new one.
3. **Runtime failure leakage:** raw stderr, environment variables, JSON-RPC payloads, or secret-like values must not appear in the public adapter error object.
4. **Concurrent turns on one session:** Phase 1 must reject a second overlapping turn for the same SDKSPACE session with a stable `runtime_busy` error instead of interleaving events.
5. **Dispose race:** disposing a session while idle must be idempotent; `disposeAll()` must not fail if some clients are already exited/disposed.

---

## File Structure

- Create `runtime/sdkspace-codex-adapter.mjs` — SDKSPACE-facing runtime boundary and session registry.
- Create `tests/sdkspace-codex-adapter.test.mjs` — adapter contract, lifecycle, isolation, normalization, concurrency, and error-mapping tests.
- Reuse `runtime/codex-app-server/client.mjs` — no protocol change required in Phase 1 unless a failing adapter test exposes a real defect.
- Reuse `tests/fixtures/fake-codex-app-server.mjs` and `tests/fixtures/codex-workspace/PROBE.txt` for deterministic integration proof.

No production Worker/browser file is modified by this plan.

### Task 1: SDKSPACE Adapter Contract and Session Registry

**Files:**
- Create: `runtime/sdkspace-codex-adapter.mjs`
- Test: `tests/sdkspace-codex-adapter.test.mjs`

**Interfaces:**
- Consumes: `startCodexAppServer(options)` from `runtime/codex-app-server/client.mjs`.
- Produces: `createSdkspaceCodexAdapter(options)`.
- `options` supports `{ clientFactory, requestTimeoutMs, turnTimeoutMs }` where `clientFactory` defaults to `startCodexAppServer`.
- Adapter methods:
  - `runCodeTurn({ sessionId, workspacePath, message }) -> Promise<{ ok: true, runtime: "codex", sessionId, threadId, turnId, status: "completed", message }>`
  - `disposeSession(sessionId) -> Promise<void>`
  - `disposeAll() -> Promise<void>`
- Produces `SdkspaceRuntimeError` with public fields `{ code, retryable }` and a user-safe message.
- Public error codes for Phase 1:
  - `runtime_invalid_request`
  - `runtime_busy`
  - `runtime_unavailable`
  - `runtime_timeout`
  - `runtime_turn_failed`
  - `runtime_unsupported_request`
  - `runtime_internal`

- [ ] **Step 1: Write failing validation and success-contract tests**

Create tests named:
- `adapter rejects missing session id, workspace path, or message`
- `adapter returns normalized completed result without raw protocol objects`

Validation must require a non-empty string `sessionId`, an absolute `workspacePath`, and a non-empty string `message`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/sdkspace-codex-adapter.test.mjs
```

Expected: FAIL because `runtime/sdkspace-codex-adapter.mjs` does not exist.

- [ ] **Step 3: Implement minimal adapter creation, validation, and first-turn lifecycle**

Implement `createSdkspaceCodexAdapter()` using an internal `Map` keyed by SDKSPACE `sessionId`. On first use, create a Codex client, call `initialize()`, call `startThread({ cwd: workspacePath })`, then call `runTurn({ threadId, text: message })`. Return only the normalized result contract.

- [ ] **Step 4: Add session isolation and reuse tests**

Add tests named:
- `adapter reuses one Codex thread for sequential turns in the same session and workspace`
- `adapter keeps different session ids isolated`
- `adapter rebinding to a different workspace disposes the old client and starts a fresh thread`

Assert that same-session/same-workspace sequential calls reuse one client/thread; different session IDs do not share; workspace change disposes old client before replacement.

- [ ] **Step 5: Add concurrency and disposal tests**

Add tests named:
- `adapter rejects an overlapping turn for one session with runtime_busy`
- `disposeSession is idempotent and removes the session`
- `disposeAll disposes every active client and tolerates already-disposed clients`

- [ ] **Step 6: Implement busy guard and disposal behavior**

Track an `inFlight` flag per session entry. Reject an overlapping call before sending a second `turn/start`. Make `disposeSession` and `disposeAll` idempotent and remove disposed entries from the registry.

- [ ] **Step 7: Run Task 1 tests**

Run:

```bash
node --test tests/sdkspace-codex-adapter.test.mjs
```

Expected: all Task 1 tests PASS, zero failures.

- [ ] **Step 8: Commit Task 1**

```bash
git add runtime/sdkspace-codex-adapter.mjs tests/sdkspace-codex-adapter.test.mjs
git commit -m "feat: add sdkspace codex runtime adapter"
```

### Task 2: Stable Error Normalization and Fake App-Server Integration

**Files:**
- Modify: `runtime/sdkspace-codex-adapter.mjs`
- Modify: `tests/sdkspace-codex-adapter.test.mjs`
- Reuse: `tests/fixtures/fake-codex-app-server.mjs`
- Reuse: `tests/fixtures/codex-workspace/PROBE.txt`

**Interfaces:**
- Consumes: Task 1 adapter contract unchanged.
- Produces: stable SDKSPACE error mapping while preserving the same adapter methods and normalized success shape.

**Required error mapping:**
- Codex/client code `turn_timeout` -> `runtime_timeout`, retryable `true`.
- `codex_process_start` or `codex_process_exit` -> `runtime_unavailable`, retryable `true`.
- `codex_turn_failed` -> `runtime_turn_failed`, retryable `true`.
- `unsupported_server_request` -> `runtime_unsupported_request`, retryable `false`.
- validation failures -> `runtime_invalid_request`, retryable `false`.
- unknown errors -> `runtime_internal`, retryable `false`.

- [ ] **Step 1: Write failing error-mapping tests**

Create tests named:
- `adapter maps turn timeout to runtime_timeout without leaking raw details`
- `adapter maps missing or exited codex process to runtime_unavailable`
- `adapter maps failed turn to runtime_turn_failed`
- `adapter maps unsupported server request to runtime_unsupported_request`
- `adapter maps unknown errors to runtime_internal`

For every error assert:
- instance is `SdkspaceRuntimeError`;
- `code` and `retryable` match the table;
- message is user-safe;
- serialized/public fields do not contain `env`, `token`, `apiKey`, raw JSON-RPC request objects, or stderr payloads.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/sdkspace-codex-adapter.test.mjs
```

Expected: new error-normalization tests FAIL before mapping is implemented.

- [ ] **Step 3: Implement error normalization at the adapter boundary**

Add one internal mapping function in `runtime/sdkspace-codex-adapter.mjs`. It must convert lower-level errors into `SdkspaceRuntimeError` and must not copy arbitrary lower-level properties/data onto the public error object.

- [ ] **Step 4: Add deterministic integration test against the existing fake app-server process**

Add test:
- `adapter completes a real child-process app-server turn and returns SDKSPACE_PHASE0_OK`

Use:
- `clientFactory` that calls `startCodexAppServer({ command: process.execPath, commandArgs: [fakeServerPath], ... })`;
- absolute workspace `tests/fixtures/codex-workspace`;
- prompt `Read PROBE.txt from the current workspace. Return the exact marker from that file in your final answer.`

Assert normalized result contains `runtime: "codex"`, status `completed`, and message containing `SDKSPACE_PHASE0_OK`; assert no raw JSON-RPC object is returned.

- [ ] **Step 5: Run all Phase 0 + Phase 1 automated tests**

Run:

```bash
node --test tests/codex-app-server-jsonl.test.mjs tests/codex-app-server-client.test.mjs tests/sdkspace-codex-adapter.test.mjs
```

Expected: all tests PASS, zero failures.

- [ ] **Step 6: Run repository regression suite**

Run:

```bash
node --check src/index.js
node --check src/firebase-worker.js
node --test tests/*.test.mjs
```

Expected: all tests PASS; Phase 1 does not modify production source files.

- [ ] **Step 7: Verify branch diff contains no production routing/UI change**

Compare `main...feat/codex-app-server-runtime` and verify Phase 1 adds only runtime/test/docs files. Specifically confirm no Phase 1 changes to `src/index.js`, `src/firebase-worker.js`, `assets/chat.js`, `wrangler.toml`, login/auth code, D1 schema, or GitHub action routes.

- [ ] **Step 8: Commit Task 2**

```bash
git add runtime/sdkspace-codex-adapter.mjs tests/sdkspace-codex-adapter.test.mjs
git commit -m "test: harden sdkspace codex adapter boundary"
```

## Phase 1 Exit Gate

Do not begin `/api/chat` code-mode routing until all of these are true:

- adapter contract tests pass;
- session isolation/reuse tests pass;
- busy/disposal tests pass;
- error normalization tests pass;
- fake child-process integration test passes through the SDKSPACE adapter;
- Phase 0 tests remain green;
- full repository regression remains green;
- no production Worker/browser file changed in Phase 1;
- no deploy occurred.

After this gate passes, create a separate Phase 2 plan for feature-flagged `mode=code` routing and fallback behavior in `src/index.js`.
