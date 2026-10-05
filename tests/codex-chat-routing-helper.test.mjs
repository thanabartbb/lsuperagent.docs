import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWorkspaceId,
  deriveRuntimeSessionId,
  runtimeFailurePolicy,
  runtimeSuccessPayload,
} from '../src/codex-chat-routing.js';

test('workspace id is optional but invalid supplied values are rejected', () => {
  assert.equal(normalizeWorkspaceId(undefined), null);
  assert.equal(normalizeWorkspaceId(null), null);
  assert.equal(normalizeWorkspaceId(''), null);
  assert.equal(normalizeWorkspaceId(' workspace-1 '), 'workspace-1');
  for (const value of ['../x', 'a/b', '..', '.', '-bad', 'x'.repeat(129), 123]) {
    assert.throws(() => normalizeWorkspaceId(value), (error) => error?.code === 'runtime_invalid_request');
  }
});

test('runtime session id is stable for the same identity conversation and workspace', async () => {
  const input = { identityKey: 'google:123', conversationId: 'chat-1', workspaceId: 'workspace-1', requestId: 'req-a' };
  const a = await deriveRuntimeSessionId(input);
  const b = await deriveRuntimeSessionId({ ...input, requestId: 'req-b' });
  assert.equal(a, b);
  assert.match(a, /^sdkspace_[A-Za-z0-9_-]{20,}$/);
  assert.equal(a.includes('google'), false);
  assert.equal(a.includes('chat-1'), false);
});

test('runtime session id uses request id when conversation id is absent', async () => {
  const a = await deriveRuntimeSessionId({ identityKey: 'google:123', conversationId: '', workspaceId: 'workspace-1', requestId: 'req-a' });
  const b = await deriveRuntimeSessionId({ identityKey: 'google:123', conversationId: '', workspaceId: 'workspace-1', requestId: 'req-b' });
  assert.notEqual(a, b);
});

test('runtime failure policy only falls back for retryable availability failures', () => {
  for (const code of ['runtime_unavailable', 'runtime_timeout', 'runtime_turn_failed']) {
    assert.deepEqual(runtimeFailurePolicy({ code, retryable: true }), { action: 'fallback', httpStatus: null });
  }
  assert.deepEqual(runtimeFailurePolicy({ code: 'runtime_busy', retryable: true, httpStatus: 409 }), { action: 'return', httpStatus: 409 });
  assert.deepEqual(runtimeFailurePolicy({ code: 'runtime_invalid_request', retryable: false, httpStatus: 502 }), { action: 'return', httpStatus: 502 });
  assert.deepEqual(runtimeFailurePolicy({ code: 'runtime_unsupported_request', retryable: false, httpStatus: 502 }), { action: 'return', httpStatus: 502 });
  assert.deepEqual(runtimeFailurePolicy({ code: 'anything', retryable: true, httpStatus: 500 }), { action: 'return', httpStatus: 502 });
});

test('runtime success payload preserves existing chat shape without raw protocol data', () => {
  const payload = runtimeSuccessPayload({
    message: ' grounded ',
    threadId: 'thread-1',
    turnId: 'turn-1',
    raw: { should: 'drop' },
  });
  assert.deepEqual(payload, {
    ok: true,
    status: 'completed',
    message: 'grounded',
    output: 'grounded',
    sources: [],
    runtime: 'codex',
    thread_id: 'thread-1',
    turn_id: 'turn-1',
  });
});
