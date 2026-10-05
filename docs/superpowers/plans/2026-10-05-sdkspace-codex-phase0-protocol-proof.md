# SDKSPACE Codex Phase 0 Protocol Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove, on the isolated `feat/codex-app-server-runtime` branch and without touching production routing, that SDKSPACE-owned Node code can start or connect to `codex app-server`, complete `initialize -> initialized -> thread/start -> turn/start`, receive `item/agentMessage/delta`, and finish on `turn/completed` against a controlled workspace.

**Architecture:** Phase 0 is a standalone runtime proof, not a Cloudflare Worker integration. A small Node JSONL-RPC transport wraps Codex App Server stdio; a higher-level client owns the Codex lifecycle; a smoke script points that client at a controlled fixture workspace. Unit/integration tests use a fake app-server process so repository tests do not require live OpenAI credentials. A separate manual smoke command uses a real Codex binary and the operator's existing Codex authentication.

**Tech Stack:** Node.js ESM (`node:test`, `node:assert/strict`, `node:child_process`, Node streams); OpenAI Codex App Server stdio JSON-RPC; existing repository test conventions. No new npm dependency.

**Spec:** `docs/superpowers/specs/2026-10-05-sdkspace-codex-app-server-runtime-design.md`

## Global Constraints

- Work only on branch `feat/codex-app-server-runtime`; do not write to `main` during Phase 0.
- Do not deploy to `agents-sdk.space` during Phase 0.
- Do not change `/chat`, `assets/chat.js`, `src/index.js`, `src/firebase-worker.js`, auth, D1, quota, provider selection, UI colors, login redirects, or GitHub write behavior in this plan.
- Use Codex App Server through its protocol; do not modify OpenAI Codex Rust source.
- Use private stdio transport only for the proof; do not expose a Codex WebSocket listener publicly.
- Use a controlled local fixture workspace; do not clone or mutate a user's live repository in Phase 0.
- Use `sandbox: "read-only"`, `approvalPolicy: "never"`, and `ephemeral: true` for the Phase 0 thread.
- Do not print environment variables, provider keys, GitHub tokens, or Codex credential contents.
- Preserve repository convention: tests run with Node's built-in test runner and no root npm package is required.

## Review Focus

1. **Malformed stdout JSONL:** one malformed non-empty line must fail the RPC peer deterministically and reject all pending requests instead of hanging.
2. **Codex process exits early:** initialization/turn promises must reject with a process-exit error that includes exit code/signal but not environment contents.
3. **Cross-turn event leakage:** `item/agentMessage/delta` and `turn/completed` from another turn/thread must not be appended to the active result.
4. **Turn never completes:** the high-level client must time out, tear down the child process, and reject rather than wait forever.
5. **Unexpected server request:** Phase 0 must fail closed with an explicit unsupported-server-request error rather than silently approve or answer approval/user-input requests.

---

## File Structure

- Create `runtime/codex-app-server/jsonl-rpc.mjs` — generic line-delimited JSON-RPC peer over provided readable/writable streams.
- Create `runtime/codex-app-server/client.mjs` — Codex-specific process/lifecycle wrapper using stdio transport.
- Create `tests/codex-app-server-jsonl.test.mjs` — transport contract and malformed/timeout tests.
- Create `tests/fixtures/fake-codex-app-server.mjs` — deterministic fake child process implementing the minimal Codex Phase 0 protocol.
- Create `tests/codex-app-server-client.test.mjs` — initialize/thread/turn lifecycle, turn scoping, early-exit, unsupported server request tests.
- Create `tests/fixtures/codex-workspace/PROBE.txt` — controlled marker file with `SDKSPACE_PHASE0_OK`.
- Create `scripts/codex-app-server-smoke.mjs` — manual real-binary protocol proof; not part of production Worker routing.

No existing production source file is modified by this plan.

### Task 1: JSONL-RPC Transport

**Files:**
- Create: `runtime/codex-app-server/jsonl-rpc.mjs`
- Test: `tests/codex-app-server-jsonl.test.mjs`

**Interfaces:**
- Consumes: Node readable/writable streams that carry one JSON object per line.
- Produces: `createJsonlRpcPeer({ readable, writable, requestTimeoutMs })` returning `{ request, notify, subscribe, close }`.
- Produces: `CodexRpcError` with public fields `code` and `data` for JSON-RPC error responses.
- `request(method, params)` returns a Promise for the `result` matching its generated numeric `id`.
- `notify(method, params?)` writes a JSON-RPC notification with no `id`; when `params` is omitted it must omit the `params` key.
- `subscribe(listener)` delivers parsed server notifications and server-initiated requests; returns an unsubscribe function.
- `close(error?)` rejects all pending requests and prevents new writes.

- [ ] **Step 1: Write transport tests for request correlation and notification serialization**

Create tests named:
- `jsonl rpc correlates out-of-order responses by id`
- `jsonl rpc initialized notification omits params when omitted`

Assertions must prove two concurrent requests resolve to the correct responses even when responses arrive in reverse order, and `notify('initialized')` writes exactly an object equivalent to `{ method: 'initialized' }` plus the terminating newline.

- [ ] **Step 2: Run the focused tests and verify they fail before implementation**

Run:

```bash
node --test tests/codex-app-server-jsonl.test.mjs
```

Expected: FAIL because `runtime/codex-app-server/jsonl-rpc.mjs` does not exist.

- [ ] **Step 3: Implement `createJsonlRpcPeer` and `CodexRpcError`**

Implement in `runtime/codex-app-server/jsonl-rpc.mjs` using only Node built-ins. Parse arbitrary stream chunk boundaries into newline-delimited frames; ignore blank lines; keep a monotonically increasing numeric request id; correlate response objects by `id`.

- [ ] **Step 4: Add failure-mode tests for malformed JSON, request timeout, JSON-RPC errors, and close**

Add tests named:
- `jsonl rpc rejects pending requests on malformed non-empty line`
- `jsonl rpc rejects one request after requestTimeoutMs`
- `jsonl rpc exposes json-rpc error code and data`
- `jsonl rpc close rejects all pending requests`

For malformed JSON, assert all pending promises reject and later `request()` calls reject immediately.

- [ ] **Step 5: Run transport tests**

Run:

```bash
node --test tests/codex-app-server-jsonl.test.mjs
```

Expected: all tests PASS, zero failures.

- [ ] **Step 6: Commit Task 1**

```bash
git add runtime/codex-app-server/jsonl-rpc.mjs tests/codex-app-server-jsonl.test.mjs
git commit -m "feat: add codex jsonl rpc transport"
```

### Task 2: Codex App Server Lifecycle Client

**Files:**
- Create: `runtime/codex-app-server/client.mjs`
- Create: `tests/fixtures/fake-codex-app-server.mjs`
- Test: `tests/codex-app-server-client.test.mjs`

**Interfaces:**
- Consumes: `createJsonlRpcPeer` from Task 1.
- Produces: `startCodexAppServer(options)` where options are `{ command, commandArgs, cwd, env, requestTimeoutMs, turnTimeoutMs, spawnImpl }`.
- Default `command` is `process.env.CODEX_BIN || 'codex'`.
- Default `commandArgs` is `['app-server', '--listen', 'stdio://']`.
- Produces client methods:
  - `initialize() -> Promise<InitializeResult>`
  - `startThread({ cwd }) -> Promise<{ threadId }>`
  - `runTurn({ threadId, text }) -> Promise<{ threadId, turnId, status, message }>`
  - `dispose() -> Promise<void>`
- `initialize()` sends `initialize` with `{ clientInfo: { name: 'sdkspace', title: 'SDKSPACE', version: '0.1.0-phase0' } }`, waits for the result, then sends `initialized` with no params.
- `startThread({ cwd })` sends `thread/start` with `{ cwd, sandbox: 'read-only', approvalPolicy: 'never', ephemeral: true }` and returns `result.thread.id`.
- `runTurn({ threadId, text })` sends `turn/start` with `{ threadId, input: [{ type: 'text', text }] }`; reads `result.turn.id`; concatenates only matching `item/agentMessage/delta.params.delta`; completes only on matching `turn/completed` whose `params.turn.id` is that turn id.
- Only final status `completed` resolves successfully. `failed` or `interrupted` rejects with a Codex turn error.
- Any server-initiated request object containing both `id` and `method` during Phase 0 rejects the active operation with error code/name `unsupported_server_request`; Phase 0 must not auto-approve it.

- [ ] **Step 1: Write a deterministic fake app-server fixture**

`tests/fixtures/fake-codex-app-server.mjs` must read stdin JSONL and implement exactly the minimum Phase 0 sequence:
- reply to `initialize` with a result object,
- accept the `initialized` notification,
- reply to `thread/start` with `{ thread: { id: 'thread-phase0' } }`,
- reply to `turn/start` with `{ turn: { id: 'turn-phase0' } }`,
- emit one unrelated delta for another turn, then matching deltas `SDKSPACE_` and `PHASE0_OK`, then `turn/completed` with matching `threadId` and a turn object whose status is `completed`.

Support fixture modes selected through environment variables for early exit, no completion, malformed output, failed turn, interrupted turn, and server request.

- [ ] **Step 2: Write lifecycle tests against the fake child process**

Create tests named:
- `codex client sends initialize then initialized then starts an ephemeral read-only thread`
- `codex client starts a turn and returns only matching agent message deltas`
- `codex client rejects failed or interrupted turns`
- `codex client rejects when app-server exits before initialization`
- `codex client times out when matching turn/completed never arrives`
- `codex client rejects unsupported server requests without answering them`

Use `process.execPath` as `command` and `[pathToFakeServer]` as `commandArgs` so tests do not require a real Codex installation or network access.

- [ ] **Step 3: Run lifecycle tests and verify they fail before implementation**

Run:

```bash
node --test tests/codex-app-server-client.test.mjs
```

Expected: FAIL because `runtime/codex-app-server/client.mjs` does not exist.

- [ ] **Step 4: Implement `startCodexAppServer`**

Use `node:child_process` `spawn` with stdio pipes. Wrap stdin/stdout with Task 1's peer. Keep stderr only as a bounded diagnostic tail for errors; never include `env` values in thrown messages. Track process `error`, `exit`, and explicit `dispose()`; make disposal idempotent.

- [ ] **Step 5: Implement lifecycle, turn scoping, and fatal turn timeout**

Implement the exact method contracts above. Filter deltas by both `threadId` and `turnId`. Filter completion by `threadId` and `params.turn.id`. Apply a separate `turnTimeoutMs` timer after `turn/start` returns; when it expires, reject with a stable `turn_timeout` error and dispose/terminate the child process so no hung runtime remains alive.

- [ ] **Step 6: Run Task 1 + Task 2 tests**

Run:

```bash
node --test tests/codex-app-server-jsonl.test.mjs tests/codex-app-server-client.test.mjs
```

Expected: all tests PASS, zero failures.

- [ ] **Step 7: Commit Task 2**

```bash
git add runtime/codex-app-server/client.mjs tests/fixtures/fake-codex-app-server.mjs tests/codex-app-server-client.test.mjs
git commit -m "feat: prove codex app-server lifecycle"
```

### Task 3: Controlled Workspace Real-Binary Smoke Probe

**Files:**
- Create: `tests/fixtures/codex-workspace/PROBE.txt`
- Create: `scripts/codex-app-server-smoke.mjs`
- Test: extend `tests/codex-app-server-client.test.mjs` only for probe orchestration that can run against the fake fixture; do not make automated tests depend on live Codex credentials.

**Interfaces:**
- Consumes: `startCodexAppServer` from Task 2.
- Produces: `runProtocolProbe({ codexBin, codexArgs, workspace, requestTimeoutMs, turnTimeoutMs }) -> Promise<{ ok, threadId, turnId, status, message }>` exported from `scripts/codex-app-server-smoke.mjs`.
- `codexBin` defaults to `process.env.CODEX_BIN || 'codex'`.
- `codexArgs` defaults to `['app-server', '--listen', 'stdio://']`; automated tests may replace it with `[pathToFakeServer]` while using `process.execPath` as `codexBin`.
- CLI invocation: `CODEX_BIN=/absolute/path/to/codex node scripts/codex-app-server-smoke.mjs`.
- Optional `CODEX_HOME` is inherited from the operator environment; the script must never print its contents or credential files.
- Default workspace: repository-local `tests/fixtures/codex-workspace` resolved to an absolute path.
- Probe prompt: `Read PROBE.txt from the current workspace. Return the exact marker from that file in your final answer.`
- Success requires: turn status `completed` and returned message contains `SDKSPACE_PHASE0_OK`.
- CLI exits `0` on success; exits non-zero on binary missing, initialize failure, authentication/runtime error, timeout, unsupported server request, or missing marker.
- Importing the module from tests must not execute the CLI; only direct execution may run `main()`.

- [ ] **Step 1: Add the controlled workspace marker**

Create `tests/fixtures/codex-workspace/PROBE.txt` containing exactly:

```text
SDKSPACE_PHASE0_OK
```

- [ ] **Step 2: Write probe orchestration test with the fake server**

Add a test calling `runProtocolProbe({ codexBin: process.execPath, codexArgs: [pathToFakeServer], workspace: fixtureWorkspace, ... })` and assert it returns `ok: true`, status `completed`, and a message containing `SDKSPACE_PHASE0_OK`.

- [ ] **Step 3: Run the probe test and verify it fails before script implementation**

Run:

```bash
node --test tests/codex-app-server-client.test.mjs
```

Expected: FAIL only for the new probe-orchestration test because the smoke module/export does not exist.

- [ ] **Step 4: Implement `runProtocolProbe` and guarded CLI output**

The function must initialize, create the read-only ephemeral thread at the absolute fixture workspace path, run the probe turn, validate the marker, and dispose in `finally`.

Guard direct CLI execution so importing `runProtocolProbe` from a test has no side effects.

The CLI success output must be one JSON object with only these fields:

```json
{"ok":true,"threadId":"...","turnId":"...","status":"completed","message":"..."}
```

On failure, print one user-safe line to stderr with an error name/code and message; do not dump process environment, request payload credentials, or full Codex config.

- [ ] **Step 5: Run all Phase 0 automated tests**

Run:

```bash
node --test tests/codex-app-server-jsonl.test.mjs tests/codex-app-server-client.test.mjs
```

Expected: all tests PASS, zero failures.

- [ ] **Step 6: Run the existing repository regression suite**

Run:

```bash
node --check src/index.js
node --check src/firebase-worker.js
node --test tests/*.test.mjs
```

Expected: all pre-existing tests plus the new Phase 0 tests PASS. No production source file should differ from `main` as a result of Phase 0.

- [ ] **Step 7: Run a real Codex App Server smoke test in a Linux environment with an authenticated Codex CLI**

First verify the binary:

```bash
"$CODEX_BIN" --version
```

Then run:

```bash
CODEX_BIN="$CODEX_BIN" node scripts/codex-app-server-smoke.mjs
```

Expected success signal: exit code `0`; JSON output has `ok: true`, `status: "completed"`, and `message` contains `SDKSPACE_PHASE0_OK`.

If the environment is not authenticated, record that as `BLOCKED: codex authentication` rather than weakening the test or substituting a normal Responses API call.

- [ ] **Step 8: Commit Task 3**

```bash
git add tests/fixtures/codex-workspace/PROBE.txt scripts/codex-app-server-smoke.mjs tests/codex-app-server-client.test.mjs
git commit -m "test: add real codex app-server protocol probe"
```

## Phase 0 Exit Gate

Do not begin Worker routing, `/api/chat` integration, GitHub checkout, write-capable sandboxing, Cloudflare Container/Sandbox hosting, UI progress rendering, or deployment until all of these are true:

- automated JSONL transport tests pass;
- fake-process lifecycle tests pass;
- repository regression tests pass;
- a real `codex app-server --listen stdio://` probe reaches `turn/completed`;
- the real probe's final answer contains the controlled workspace marker `SDKSPACE_PHASE0_OK`;
- no file under the current production browser/Worker path was changed for this proof;
- no production deploy occurred.

After this gate passes, write a separate Phase 1 implementation plan for the private SDKSPACE runtime service/adapter boundary. Do not extend this Phase 0 plan in place.
