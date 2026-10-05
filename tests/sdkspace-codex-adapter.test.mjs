import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCodexAppServer } from '../runtime/codex-app-server/client.mjs';
import { createSdkspaceCodexAdapter, SdkspaceRuntimeError } from '../runtime/sdkspace-codex-adapter.mjs';

const A = resolve('/tmp/sdkspace-a');
const B = resolve('/tmp/sdkspace-b');
const here = dirname(fileURLToPath(import.meta.url));
const fake = resolve(here, 'fixtures/fake-codex-app-server.mjs');
const fixture = resolve(here, 'fixtures/codex-workspace');

function gate() {
  let release;
  const promise = new Promise((r) => { release = r; });
  return { promise, release };
}

function factory({ run } = {}) {
  const clients = [];
  const make = () => {
    const id = clients.length + 1;
    const calls = { init: 0, thread: [], turn: [], dispose: 0 };
    const client = {
      calls,
      async initialize() { calls.init++; },
      async startThread({ cwd }) { calls.thread.push(cwd); return { threadId: `thread-${id}` }; },
      async runTurn(input) {
        calls.turn.push(input);
        return run ? run({ id, input }) : { threadId: input.threadId, turnId: `turn-${id}-${calls.turn.length}`, status: 'completed', message: `reply-${id}` };
      },
      async dispose() { calls.dispose++; },
    };
    clients.push(client);
    return client;
  };
  make.clients = clients;
  return make;
}

async function runtimeError(promise, code, retryable) {
  await assert.rejects(promise, (e) => e instanceof SdkspaceRuntimeError && e.code === code && (retryable === undefined || e.retryable === retryable));
}

test('adapter rejects missing session id, workspace path, or message', async () => {
  const a = createSdkspaceCodexAdapter({ clientFactory: factory() });
  await runtimeError(a.runCodeTurn({ sessionId: '', workspacePath: A, message: 'x' }), 'runtime_invalid_request');
  await runtimeError(a.runCodeTurn({ sessionId: 's', workspacePath: 'relative', message: 'x' }), 'runtime_invalid_request');
  await runtimeError(a.runCodeTurn({ sessionId: 's', workspacePath: A, message: ' ' }), 'runtime_invalid_request');
});

test('adapter returns normalized completed result without raw protocol objects', async () => {
  const result = await createSdkspaceCodexAdapter({ clientFactory: factory() }).runCodeTurn({ sessionId: 's', workspacePath: A, message: 'x' });
  assert.deepEqual(result, { ok: true, runtime: 'codex', sessionId: 's', threadId: 'thread-1', turnId: 'turn-1-1', status: 'completed', message: 'reply-1' });
  for (const key of ['request', 'response', 'params', 'result', 'jsonrpc']) assert.equal(key in result, false);
});

test('adapter reuses one Codex thread for sequential turns in the same session and workspace', async () => {
  const f = factory(), a = createSdkspaceCodexAdapter({ clientFactory: f });
  const r1 = await a.runCodeTurn({ sessionId: 's', workspacePath: A, message: '1' });
  const r2 = await a.runCodeTurn({ sessionId: 's', workspacePath: A, message: '2' });
  assert.equal(f.clients.length, 1); assert.equal(f.clients[0].calls.init, 1); assert.deepEqual(f.clients[0].calls.thread, [A]); assert.equal(r1.threadId, r2.threadId); assert.equal(f.clients[0].calls.turn.length, 2);
});

test('adapter keeps different session ids isolated', async () => {
  const f = factory(), a = createSdkspaceCodexAdapter({ clientFactory: f });
  const x = await a.runCodeTurn({ sessionId: 'a', workspacePath: A, message: '1' });
  const y = await a.runCodeTurn({ sessionId: 'b', workspacePath: A, message: '2' });
  assert.equal(f.clients.length, 2); assert.notEqual(x.threadId, y.threadId);
});

test('adapter rebinding to a different workspace disposes the old client and starts a fresh thread', async () => {
  const order = []; let id = 0;
  const a = createSdkspaceCodexAdapter({ clientFactory: () => {
    const n = ++id;
    return { async initialize() { order.push(`init-${n}`); }, async startThread({ cwd }) { order.push(`thread-${n}:${cwd}`); return { threadId: `thread-${n}` }; }, async runTurn({ threadId }) { return { threadId, turnId: `turn-${n}`, status: 'completed', message: 'ok' }; }, async dispose() { order.push(`dispose-${n}`); } };
  } });
  await a.runCodeTurn({ sessionId: 's', workspacePath: A, message: '1' });
  const r = await a.runCodeTurn({ sessionId: 's', workspacePath: B, message: '2' });
  assert.equal(r.threadId, 'thread-2'); assert.deepEqual(order, ['init-1', `thread-1:${A}`, 'dispose-1', 'init-2', `thread-2:${B}`]);
});

test('adapter rejects an overlapping turn for one session with runtime_busy', async () => {
  const g = gate(), f = factory({ run: async ({ input }) => { await g.promise; return { threadId: input.threadId, turnId: 'slow', status: 'completed', message: 'ok' }; } });
  const a = createSdkspaceCodexAdapter({ clientFactory: f });
  const first = a.runCodeTurn({ sessionId: 's', workspacePath: A, message: '1' });
  await new Promise(setImmediate);
  await runtimeError(a.runCodeTurn({ sessionId: 's', workspacePath: A, message: '2' }), 'runtime_busy', true);
  g.release(); await first; assert.equal(f.clients[0].calls.turn.length, 1);
});

test('disposeSession is idempotent and removes the session', async () => {
  const f = factory(), a = createSdkspaceCodexAdapter({ clientFactory: f });
  await a.runCodeTurn({ sessionId: 's', workspacePath: A, message: '1' }); await a.disposeSession('s'); await a.disposeSession('s');
  assert.equal(f.clients[0].calls.dispose, 1); await a.runCodeTurn({ sessionId: 's', workspacePath: A, message: '2' }); assert.equal(f.clients.length, 2);
});

test('disposeAll disposes every active client and tolerates already-disposed clients', async () => {
  const f = factory(), a = createSdkspaceCodexAdapter({ clientFactory: f });
  await a.runCodeTurn({ sessionId: 'a', workspacePath: A, message: '1' }); await a.runCodeTurn({ sessionId: 'b', workspacePath: A, message: '2' });
  await a.disposeSession('a'); await a.disposeAll(); await a.disposeAll(); assert.deepEqual(f.clients.map((c) => c.calls.dispose), [1, 1]);
});

function low(code) { const e = new Error('raw token=SECRET apiKey=SECRET stderr={"method":"turn/start"}'); e.code = code; e.data = { env: { OPENAI_API_KEY: 'SECRET' } }; return e; }
function throwing(error, stage = 'run') { return () => ({ async initialize() { if (stage === 'init') throw error; }, async startThread() { return { threadId: 'thread' }; }, async runTurn() { if (stage === 'run') throw error; return { threadId: 'thread', turnId: 'turn', status: 'completed', message: 'ok' }; }, async dispose() {} }); }
async function mapped(code, expected, retryable, stage = 'run') {
  const a = createSdkspaceCodexAdapter({ clientFactory: throwing(low(code), stage) });
  let e; try { await a.runCodeTurn({ sessionId: code, workspacePath: A, message: 'x' }); } catch (x) { e = x; }
  assert.ok(e instanceof SdkspaceRuntimeError); assert.equal(e.code, expected); assert.equal(e.retryable, retryable);
  const publicShape = JSON.stringify({ message: e.message, code: e.code, retryable: e.retryable });
  for (const bad of ['SECRET', 'apiKey', 'OPENAI_API_KEY', 'stderr=', 'token=', 'turn/start']) assert.equal(publicShape.includes(bad), false);
  assert.deepEqual(Object.keys(e).sort(), ['code', 'name', 'retryable'].sort());
}

test('adapter maps turn timeout to runtime_timeout without leaking raw details', () => mapped('turn_timeout', 'runtime_timeout', true));
test('adapter maps missing or exited codex process to runtime_unavailable', async () => { await mapped('codex_process_start', 'runtime_unavailable', true, 'init'); await mapped('codex_process_exit', 'runtime_unavailable', true, 'init'); });
test('adapter maps failed turn to runtime_turn_failed', () => mapped('codex_turn_failed', 'runtime_turn_failed', true));
test('adapter maps unsupported server request to runtime_unsupported_request', () => mapped('unsupported_server_request', 'runtime_unsupported_request', false));
test('adapter maps unknown errors to runtime_internal', () => mapped('mystery', 'runtime_internal', false));

test('adapter completes a real child-process app-server turn and returns SDKSPACE_PHASE0_OK', async () => {
  const a = createSdkspaceCodexAdapter({ clientFactory: ({ requestTimeoutMs, turnTimeoutMs }) => startCodexAppServer({ command: process.execPath, commandArgs: [fake], requestTimeoutMs, turnTimeoutMs }), requestTimeoutMs: 1000, turnTimeoutMs: 1000 });
  try {
    const r = await a.runCodeTurn({ sessionId: 'integration', workspacePath: fixture, message: 'Read PROBE.txt from the current workspace. Return the exact marker from that file in your final answer.' });
    assert.equal(r.runtime, 'codex'); assert.equal(r.status, 'completed'); assert.match(r.message, /SDKSPACE_PHASE0_OK/);
    for (const key of ['request', 'response', 'params', 'result', 'jsonrpc']) assert.equal(key in r, false);
  } finally { await a.disposeAll(); }
});
