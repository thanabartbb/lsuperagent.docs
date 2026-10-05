import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSdkspaceCodexAdapter,
  SdkspaceRuntimeError,
} from '../runtime/sdkspace-codex-adapter.mjs';
import { startCodexAppServer } from '../runtime/codex-app-server/client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.join(__dirname, 'fixtures', 'codex-workspace');
const otherWorkspace = path.join(__dirname, 'fixtures');

function makeClientFactory({ runTurnImpl, disposeImpl } = {}) {
  const clients = [];
  const factory = async () => {
    const index = clients.length + 1;
    const state = { initialized: 0, starts: 0, turns: 0, disposed: 0 };
    const client = {
      state,
      async initialize() { state.initialized += 1; },
      async startThread({ cwd }) {
        state.starts += 1;
        return { threadId: `thread-${index}-${path.basename(cwd)}` };
      },
      async runTurn(args) {
        state.turns += 1;
        if (runTurnImpl) return runTurnImpl(args, state);
        return {
          threadId: args.threadId,
          turnId: `turn-${index}-${state.turns}`,
          status: 'completed',
          message: `reply-${index}-${state.turns}`,
        };
      },
      async dispose() {
        state.disposed += 1;
        if (disposeImpl) return disposeImpl(state);
      },
    };
    clients.push(client);
    return client;
  };
  factory.clients = clients;
  return factory;
}

async function captureError(promise) {
  try {
    await promise;
    assert.fail('expected rejection');
  } catch (error) {
    return error;
  }
}

function assertSafeRuntimeError(error, code, retryable) {
  assert.ok(error instanceof SdkspaceRuntimeError);
  assert.equal(error.code, code);
  assert.equal(error.retryable, retryable);
  const serialized = JSON.stringify(error);
  for (const forbidden of ['apiKey', 'token', 'stderr', '"env"', '"request"']) {
    assert.equal(serialized.includes(forbidden), false, `public error leaked ${forbidden}`);
  }
}

test('adapter rejects missing session id, workspace path, or message', async () => {
  const adapter = createSdkspaceCodexAdapter({ clientFactory: makeClientFactory() });
  for (const input of [
    { workspacePath: workspace, message: 'hello' },
    { sessionId: 's1', workspacePath: 'relative/path', message: 'hello' },
    { sessionId: 's1', workspacePath: workspace, message: '   ' },
  ]) {
    const error = await captureError(adapter.runCodeTurn(input));
    assertSafeRuntimeError(error, 'runtime_invalid_request', false);
  }
});

test('adapter returns normalized completed result without raw protocol objects', async () => {
  const adapter = createSdkspaceCodexAdapter({ clientFactory: makeClientFactory() });
  const result = await adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'hello' });
  assert.deepEqual(Object.keys(result).sort(), ['message', 'ok', 'runtime', 'sessionId', 'status', 'threadId', 'turnId'].sort());
  assert.equal(result.ok, true);
  assert.equal(result.runtime, 'codex');
  assert.equal(result.sessionId, 's1');
  assert.equal(result.status, 'completed');
});

test('adapter reuses one Codex thread for sequential turns in the same session and workspace', async () => {
  const factory = makeClientFactory();
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  const first = await adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'one' });
  const second = await adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'two' });
  assert.equal(factory.clients.length, 1);
  assert.equal(first.threadId, second.threadId);
  assert.equal(factory.clients[0].state.initialized, 1);
  assert.equal(factory.clients[0].state.starts, 1);
  assert.equal(factory.clients[0].state.turns, 2);
});

test('adapter keeps different session ids isolated', async () => {
  const factory = makeClientFactory();
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  const a = await adapter.runCodeTurn({ sessionId: 'a', workspacePath: workspace, message: 'one' });
  const b = await adapter.runCodeTurn({ sessionId: 'b', workspacePath: workspace, message: 'two' });
  assert.equal(factory.clients.length, 2);
  assert.notEqual(a.threadId, b.threadId);
});

test('adapter rebinding to a different workspace disposes the old client and starts a fresh thread', async () => {
  const factory = makeClientFactory();
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  const first = await adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'one' });
  const second = await adapter.runCodeTurn({ sessionId: 's1', workspacePath: otherWorkspace, message: 'two' });
  assert.equal(factory.clients.length, 2);
  assert.equal(factory.clients[0].state.disposed, 1);
  assert.notEqual(first.threadId, second.threadId);
});

test('adapter rejects an overlapping turn for one session with runtime_busy', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const factory = makeClientFactory({
    runTurnImpl: async ({ threadId }) => {
      await gate;
      return { threadId, turnId: 'turn-slow', status: 'completed', message: 'done' };
    },
  });
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  const first = adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'one' });
  await new Promise((resolve) => setImmediate(resolve));
  const error = await captureError(adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'two' }));
  assertSafeRuntimeError(error, 'runtime_busy', true);
  release();
  await first;
});

test('disposeSession is idempotent and removes the session', async () => {
  const factory = makeClientFactory();
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  await adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'one' });
  await adapter.disposeSession('s1');
  await adapter.disposeSession('s1');
  assert.equal(factory.clients[0].state.disposed, 1);
  await adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'two' });
  assert.equal(factory.clients.length, 2);
});

test('disposeAll disposes every active client and tolerates already-disposed clients', async () => {
  const factory = makeClientFactory();
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  await adapter.runCodeTurn({ sessionId: 'a', workspacePath: workspace, message: 'one' });
  await adapter.runCodeTurn({ sessionId: 'b', workspacePath: workspace, message: 'two' });
  await adapter.disposeSession('a');
  await adapter.disposeAll();
  await adapter.disposeAll();
  assert.equal(factory.clients[0].state.disposed, 1);
  assert.equal(factory.clients[1].state.disposed, 1);
});

for (const [name, lowerCode, publicCode, retryable] of [
  ['turn timeout', 'turn_timeout', 'runtime_timeout', true],
  ['missing or exited codex process', 'codex_process_exit', 'runtime_unavailable', true],
  ['failed turn', 'codex_turn_failed', 'runtime_turn_failed', true],
  ['unsupported server request', 'unsupported_server_request', 'runtime_unsupported_request', false],
]) {
  test(`adapter maps ${name} without leaking raw details`, async () => {
    const factory = makeClientFactory({
      runTurnImpl: async () => {
        const error = new Error('secret stderr token apiKey');
        error.code = lowerCode;
        error.stderr = 'secret';
        error.env = { SECRET: 'secret' };
        throw error;
      },
    });
    const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
    const error = await captureError(adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'hello' }));
    assertSafeRuntimeError(error, publicCode, retryable);
  });
}

test('adapter maps codex process start failure to runtime_unavailable', async () => {
  const factory = async () => {
    const error = new Error('spawn secret');
    error.code = 'codex_process_start';
    throw error;
  };
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  const error = await captureError(adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'hello' }));
  assertSafeRuntimeError(error, 'runtime_unavailable', true);
});

test('adapter maps unknown errors to runtime_internal', async () => {
  const factory = makeClientFactory({ runTurnImpl: async () => { throw new Error('unknown secret token'); } });
  const adapter = createSdkspaceCodexAdapter({ clientFactory: factory });
  const error = await captureError(adapter.runCodeTurn({ sessionId: 's1', workspacePath: workspace, message: 'hello' }));
  assertSafeRuntimeError(error, 'runtime_internal', false);
});

test('adapter completes a real child-process app-server turn and returns SDKSPACE_PHASE0_OK', async () => {
  const fakeServerPath = path.join(__dirname, 'fixtures', 'fake-codex-app-server.mjs');
  const adapter = createSdkspaceCodexAdapter({
    clientFactory: (options) => startCodexAppServer({
      ...options,
      command: process.execPath,
      commandArgs: [fakeServerPath],
    }),
  });
  try {
    const result = await adapter.runCodeTurn({
      sessionId: 'integration',
      workspacePath: workspace,
      message: 'Read PROBE.txt from the current workspace. Return the exact marker from that file in your final answer.',
    });
    assert.equal(result.runtime, 'codex');
    assert.equal(result.status, 'completed');
    assert.match(result.message, /SDKSPACE_PHASE0_OK/);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'raw'), false);
  } finally {
    await adapter.disposeAll();
  }
});

test('adapter rejects a second turn while the same session is still initializing', async () => {
  let releaseFactory;
  const factoryGate = new Promise((resolve) => { releaseFactory = resolve; });
  let factoryCalls = 0;
  const clientFactory = async () => {
    factoryCalls += 1;
    const index = factoryCalls;
    await factoryGate;
    return {
      async initialize() {},
      async startThread() { return { threadId: `thread-${index}` }; },
      async runTurn({ threadId }) { return { threadId, turnId: `turn-${index}`, status: 'completed', message: 'ok' }; },
      async dispose() {},
    };
  };
  const adapter = createSdkspaceCodexAdapter({ clientFactory });
  const first = adapter.runCodeTurn({ sessionId: 'race', workspacePath: workspace, message: 'one' });
  await new Promise((resolve) => setImmediate(resolve));
  const secondErrorPromise = captureError(adapter.runCodeTurn({ sessionId: 'race', workspacePath: workspace, message: 'two' }));
  await new Promise((resolve) => setImmediate(resolve));
  releaseFactory();
  const secondError = await secondErrorPromise;
  assertSafeRuntimeError(secondError, 'runtime_busy', true);
  await first;
  assert.equal(factoryCalls, 1);
});

test('adapter evicts a failed runtime session so a retry gets a fresh client', async () => {
  const clients = [];
  const clientFactory = async () => {
    const index = clients.length + 1;
    const state = { disposed: 0 };
    const client = {
      state,
      async initialize() {},
      async startThread() { return { threadId: `thread-${index}` }; },
      async runTurn({ threadId }) {
        if (index === 1) {
          const error = new Error('timed out');
          error.code = 'turn_timeout';
          throw error;
        }
        return { threadId, turnId: `turn-${index}`, status: 'completed', message: 'recovered' };
      },
      async dispose() { state.disposed += 1; },
    };
    clients.push(client);
    return client;
  };
  const adapter = createSdkspaceCodexAdapter({ clientFactory });
  const firstError = await captureError(adapter.runCodeTurn({ sessionId: 'retry', workspacePath: workspace, message: 'one' }));
  assertSafeRuntimeError(firstError, 'runtime_timeout', true);
  const recovered = await adapter.runCodeTurn({ sessionId: 'retry', workspacePath: workspace, message: 'two' });
  assert.equal(recovered.message, 'recovered');
  assert.equal(clients.length, 2);
  assert.equal(clients[0].state.disposed, 1);
})
