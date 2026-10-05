import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CodexRuntimeGatewayError,
  codexRuntimeEnabled,
  validWorkspaceId,
  shouldUseCodexRuntime,
  callCodexRuntime,
} from '../src/codex-runtime-gateway.js';

function binding(handler) {
  return { fetch: handler };
}

async function captureError(promise) {
  try {
    await promise;
    assert.fail('expected rejection');
  } catch (error) {
    return error;
  }
}

function assertGatewayError(error, { code, retryable, httpStatus }) {
  assert.ok(error instanceof CodexRuntimeGatewayError);
  assert.equal(error.code, code);
  assert.equal(error.retryable, retryable);
  assert.equal(error.httpStatus, httpStatus);
  const publicError = JSON.stringify(error);
  assert.deepEqual(Object.keys(JSON.parse(publicError)).sort(), ['code', 'httpStatus', 'retryable']);
  for (const forbidden of ['stderr', 'stack', 'token', 'apiKey', 'workspacePath', 'JSON-RPC']) {
    assert.equal(publicError.includes(forbidden), false, `leaked ${forbidden}`);
  }
}

test('codex runtime flag is disabled by default', () => {
  assert.equal(codexRuntimeEnabled({}), false);
  assert.equal(codexRuntimeEnabled({ CODEX_RUNTIME_ENABLED: '0' }), false);
  assert.equal(codexRuntimeEnabled({ CODEX_RUNTIME_ENABLED: 'yes' }), false);
  assert.equal(codexRuntimeEnabled({ CODEX_RUNTIME_ENABLED: '1' }), true);
  assert.equal(codexRuntimeEnabled({ CODEX_RUNTIME_ENABLED: 'TRUE' }), true);
});

test('codex runtime requires code tool openai provider private binding workspace id and zero attachments', () => {
  const env = { CODEX_RUNTIME_ENABLED: 'true', CODEX_RUNTIME: binding(async () => new Response()) };
  const eligible = { env, tool: 'code', provider: 'openai', workspaceId: 'project-1', attachmentCount: 0 };
  assert.equal(shouldUseCodexRuntime(eligible), true);
  assert.equal(shouldUseCodexRuntime({ ...eligible, tool: 'chat' }), false);
  assert.equal(shouldUseCodexRuntime({ ...eligible, provider: 'claude' }), false);
  assert.equal(shouldUseCodexRuntime({ ...eligible, env: { CODEX_RUNTIME_ENABLED: 'true' } }), false);
  assert.equal(shouldUseCodexRuntime({ ...eligible, workspaceId: '' }), false);
  assert.equal(shouldUseCodexRuntime({ ...eligible, attachmentCount: 1 }), false);
});

test('workspace id rejects empty traversal-like and oversized values', () => {
  for (const value of [undefined, null, '', '.', '..', '../x', 'a/b', '/tmp/x', 'a\\b', 'x'.repeat(129), '-starts-dash']) {
    assert.equal(validWorkspaceId(value), null, String(value));
  }
  assert.equal(validWorkspaceId('workspace_01.alpha-beta'), 'workspace_01.alpha-beta');
  assert.equal(validWorkspaceId('A'), 'A');
});

test('gateway posts only logical runtime identifiers and message to private binding', async () => {
  let seen;
  const env = {
    CODEX_RUNTIME: binding(async (request) => {
      seen = {
        url: request.url,
        method: request.method,
        contentType: request.headers.get('content-type'),
        body: await request.json(),
      };
      return Response.json({
        ok: true,
        runtime: 'codex',
        threadId: 'thread-1',
        turnId: 'turn-1',
        status: 'completed',
        message: 'done',
      });
    }),
  };

  await callCodexRuntime({
    env,
    sessionId: 'user:123:conversation:abc',
    workspaceId: 'project-1',
    message: 'inspect repo',
    requestId: 'req-1',
  });

  assert.equal(seen.url, 'https://sdkspace-runtime.internal/v1/code/turn');
  assert.equal(seen.method, 'POST');
  assert.match(seen.contentType, /^application\/json\b/);
  assert.deepEqual(seen.body, {
    sessionId: 'user:123:conversation:abc',
    workspaceId: 'project-1',
    message: 'inspect repo',
    requestId: 'req-1',
  });
  assert.equal(Object.keys(seen.body).some((key) => /path|token|secret/i.test(key)), false);
});

test('gateway normalizes successful runtime result', async () => {
  const env = {
    CODEX_RUNTIME: binding(async () => Response.json({
      ok: true,
      runtime: 'codex',
      threadId: 'thread-1',
      turnId: 'turn-1',
      status: 'completed',
      message: '  grounded answer  ',
      raw: { hidden: true },
    })),
  };
  const result = await callCodexRuntime({ env, sessionId: 's1', workspaceId: 'w1', message: 'go', requestId: 'r1' });
  assert.deepEqual(result, {
    ok: true,
    runtime: 'codex',
    threadId: 'thread-1',
    turnId: 'turn-1',
    status: 'completed',
    message: 'grounded answer',
  });
});

test('gateway rejects malformed success response', async () => {
  const env = { CODEX_RUNTIME: binding(async () => Response.json({ ok: true, runtime: 'codex', status: 'completed', message: '' })) };
  const error = await captureError(callCodexRuntime({ env, sessionId: 's1', workspaceId: 'w1', message: 'go', requestId: 'r1' }));
  assertGatewayError(error, { code: 'runtime_invalid_response', retryable: false, httpStatus: 502 });
});

test('gateway maps runtime_busy to retryable 409', async () => {
  const env = { CODEX_RUNTIME: binding(async () => Response.json({ ok: false, code: 'runtime_busy', message: 'busy internal detail', retryable: true }, { status: 409 })) };
  const error = await captureError(callCodexRuntime({ env, sessionId: 's1', workspaceId: 'w1', message: 'go', requestId: 'r1' }));
  assertGatewayError(error, { code: 'runtime_busy', retryable: true, httpStatus: 409 });
  assert.equal(error.message.includes('internal detail'), false);
});

for (const [runtimeCode, status, expectedStatus] of [
  ['runtime_unavailable', 503, 503],
  ['runtime_timeout', 504, 504],
  ['runtime_turn_failed', 502, 502],
]) {
  test(`gateway maps retryable ${runtimeCode} without leaking raw details`, async () => {
    const env = {
      CODEX_RUNTIME: binding(async () => Response.json({
        ok: false,
        code: runtimeCode,
        retryable: true,
        message: 'stderr token apiKey /workspace/secret',
        stderr: 'very secret',
      }, { status })),
    };
    const error = await captureError(callCodexRuntime({ env, sessionId: 's1', workspaceId: 'w1', message: 'go', requestId: 'r1' }));
    assertGatewayError(error, { code: runtimeCode, retryable: true, httpStatus: expectedStatus });
  });
}

test('gateway maps binding fetch failure to runtime_unavailable', async () => {
  const env = { CODEX_RUNTIME: binding(async () => { throw new Error('socket failed with token secret'); }) };
  const error = await captureError(callCodexRuntime({ env, sessionId: 's1', workspaceId: 'w1', message: 'go', requestId: 'r1' }));
  assertGatewayError(error, { code: 'runtime_unavailable', retryable: true, httpStatus: 503 });
});
