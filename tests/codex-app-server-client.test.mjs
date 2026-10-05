import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startCodexAppServer } from '../runtime/codex-app-server/client.mjs';
import { runProtocolProbe } from '../scripts/codex-app-server-smoke.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fakeServer = resolve(here, 'fixtures/fake-codex-app-server.mjs');
const workspace = resolve(here, 'fixtures/codex-workspace');

function startFake(mode = 'normal', overrides = {}) {
  return startCodexAppServer({
    command: process.execPath,
    commandArgs: [fakeServer],
    cwd: workspace,
    env: { ...process.env, FAKE_CODEX_MODE: mode },
    requestTimeoutMs: overrides.requestTimeoutMs ?? 300,
    turnTimeoutMs: overrides.turnTimeoutMs ?? 100,
  });
}

test('codex client sends initialize then initialized then starts an ephemeral read-only thread', async () => {
  const client = startFake();
  try {
    const init = await client.initialize();
    assert.equal(init.userAgent, 'fake-codex/phase0');
    const thread = await client.startThread({ cwd: workspace });
    assert.equal(thread.threadId, 'thread-phase0');
  } finally {
    await client.dispose();
  }
});

test('codex client starts a turn and returns only matching agent message deltas', async () => {
  const client = startFake();
  try {
    await client.initialize();
    const { threadId } = await client.startThread({ cwd: workspace });
    const result = await client.runTurn({ threadId, text: 'read the marker' });
    assert.deepEqual(result, {
      threadId: 'thread-phase0',
      turnId: 'turn-phase0',
      status: 'completed',
      message: 'SDKSPACE_PHASE0_OK',
    });
  } finally {
    await client.dispose();
  }
});

test('codex client rejects failed or interrupted turns', async () => {
  for (const mode of ['failed-turn', 'interrupted-turn']) {
    const client = startFake(mode);
    try {
      await client.initialize();
      const { threadId } = await client.startThread({ cwd: workspace });
      await assert.rejects(client.runTurn({ threadId, text: 'fail' }), new RegExp(mode.split('-')[0], 'i'));
    } finally {
      await client.dispose();
    }
  }
});

test('codex client rejects when app-server exits before initialization', async () => {
  const client = startFake('early-exit');
  try {
    await assert.rejects(client.initialize(), /exit.*7|code.*7/i);
  } finally {
    await client.dispose();
  }
});

test('codex client times out when matching turn/completed never arrives', async () => {
  const client = startFake('no-completion', { turnTimeoutMs: 25 });
  try {
    await client.initialize();
    const { threadId } = await client.startThread({ cwd: workspace });
    await assert.rejects(client.runTurn({ threadId, text: 'hang' }), (error) => {
      assert.equal(error.code, 'turn_timeout');
      assert.match(error.message, /turn.*timed out/i);
      return true;
    });
    await assert.rejects(client.startThread({ cwd: workspace }), /closed|exit|disposed/i);
  } finally {
    await client.dispose();
  }
});

test('codex client rejects unsupported server requests without answering them', async () => {
  const client = startFake('server-request');
  try {
    await client.initialize();
    const { threadId } = await client.startThread({ cwd: workspace });
    await assert.rejects(client.runTurn({ threadId, text: 'approval please' }), (error) => {
      assert.equal(error.code, 'unsupported_server_request');
      assert.match(error.message, /requestApproval/);
      return true;
    });
  } finally {
    await client.dispose();
  }
});

test('protocol probe succeeds against the controlled fake app-server', async () => {
  const result = await runProtocolProbe({
    codexBin: process.execPath,
    codexArgs: [fakeServer],
    workspace,
    requestTimeoutMs: 300,
    turnTimeoutMs: 100,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.match(result.message, /SDKSPACE_PHASE0_OK/);
});

test('protocol probe rejects a missing codex binary without hanging', async () => {
  await assert.rejects(
    runProtocolProbe({
      codexBin: '/definitely/missing/codex',
      workspace,
      requestTimeoutMs: 100,
      turnTimeoutMs: 100,
    }),
    (error) => {
      assert.equal(error.code, 'codex_process_start');
      assert.match(error.message, /failed to start codex app-server/i);
      return true;
    },
  );
});
