import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ORIGIN = 'https://agents-sdk.space';
const SESSION_SECRET = 'test-session-secret';
let ip = 20;

function b64url(value) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function cookie() {
  const body = b64url(JSON.stringify({
    typ: 'auth_session',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
    provider: 'google',
    id: 'codex-route-user',
    email: 'route@example.com',
    name: 'Route user'
  }));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = b64url(String.fromCharCode(
    ...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  ));
  return `lsuperagen_trial_session=${encodeURIComponent(`${body}.${signature}`)}`;
}

async function chat(body, env) {
  return worker.fetch(new Request(ORIGIN + '/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `198.51.100.${++ip}`,
      cookie: await cookie(),
    },
    body: JSON.stringify(body),
  }), env);
}

async function withFetchStub(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

function openAIResult(text = 'fallback answer') {
  return new Response(JSON.stringify({ output_text: text }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function runtimeBinding(handler) {
  return { fetch: handler };
}

test('eligible OpenAI code request uses private Codex runtime without requiring Worker OpenAI key', async () => {
  let providerCalled = false;
  let runtimeRequest;
  const env = {
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'true',
    CODEX_RUNTIME: runtimeBinding(async (request) => {
      runtimeRequest = {
        url: request.url,
        body: await request.json(),
      };
      return Response.json({
        ok: true,
        runtime: 'codex',
        threadId: 'thread-route-1',
        turnId: 'turn-route-1',
        status: 'completed',
        message: 'workspace-grounded answer',
      });
    }),
  };

  await withFetchStub(async () => {
    providerCalled = true;
    return openAIResult('must not be used');
  }, async () => {
    const response = await chat({
      message: 'inspect this project',
      mode: 'code',
      tool: 'code',
      provider: 'openai',
      workspace_id: 'workspace-1',
      conversation_id: 'conversation-1',
    }, env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual({
      ok: body.ok,
      status: body.status,
      message: body.message,
      output: body.output,
      sources: body.sources,
      runtime: body.runtime,
      thread_id: body.thread_id,
      turn_id: body.turn_id,
    }, {
      ok: true,
      status: 'completed',
      message: 'workspace-grounded answer',
      output: 'workspace-grounded answer',
      sources: [],
      runtime: 'codex',
      thread_id: 'thread-route-1',
      turn_id: 'turn-route-1',
    });
  });

  assert.equal(providerCalled, false);
  assert.equal(runtimeRequest.url, 'https://sdkspace-runtime.internal/v1/code/turn');
  assert.equal(runtimeRequest.body.workspaceId, 'workspace-1');
  assert.equal(runtimeRequest.body.message, 'inspect this project');
  assert.match(runtimeRequest.body.sessionId, /^sdkspace_[A-Za-z0-9_-]+$/);
  assert.equal(runtimeRequest.body.sessionId.includes('codex-route-user'), false);
  assert.equal(typeof runtimeRequest.body.requestId, 'string');
});

test('flag disabled preserves existing OpenAI code path', async () => {
  let runtimeCalled = false;
  const env = {
    OPENAI_API_KEY: 'test-openai',
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'false',
    CODEX_RUNTIME: runtimeBinding(async () => {
      runtimeCalled = true;
      return Response.json({ ok: false });
    }),
  };
  await withFetchStub(async (url) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    return openAIResult('legacy code answer');
  }, async () => {
    const response = await chat({
      message: 'write code',
      tool: 'code',
      mode: 'code',
      workspace_id: 'workspace-1',
    }, env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.message, 'legacy code answer');
    assert.equal('runtime' in body, false);
  });
  assert.equal(runtimeCalled, false);
});

test('missing workspace id preserves existing OpenAI code path even when runtime is enabled', async () => {
  let runtimeCalled = false;
  const env = {
    OPENAI_API_KEY: 'test-openai',
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'true',
    CODEX_RUNTIME: runtimeBinding(async () => {
      runtimeCalled = true;
      return Response.json({ ok: false });
    }),
  };
  await withFetchStub(async () => openAIResult('legacy no workspace'), async () => {
    const response = await chat({ message: 'write code', tool: 'code', mode: 'code' }, env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'legacy no workspace');
  });
  assert.equal(runtimeCalled, false);
});

test('retryable runtime availability failure falls back once to current OpenAI code path', async () => {
  let runtimeCalls = 0;
  let providerCalls = 0;
  const env = {
    OPENAI_API_KEY: 'test-openai',
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'true',
    CODEX_RUNTIME: runtimeBinding(async () => {
      runtimeCalls += 1;
      return Response.json({ ok: false, code: 'runtime_unavailable', retryable: true }, { status: 503 });
    }),
  };
  await withFetchStub(async () => {
    providerCalls += 1;
    return openAIResult('fallback after runtime');
  }, async () => {
    const response = await chat({
      message: 'inspect',
      tool: 'code',
      mode: 'code',
      workspace_id: 'workspace-1',
    }, env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.message, 'fallback after runtime');
    assert.equal('runtime' in body, false);
  });
  assert.equal(runtimeCalls, 1);
  assert.equal(providerCalls, 1);
});

test('runtime_busy returns 409 and never falls back to provider', async () => {
  let providerCalls = 0;
  const env = {
    OPENAI_API_KEY: 'test-openai',
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'true',
    CODEX_RUNTIME: runtimeBinding(async () =>
      Response.json({ ok: false, code: 'runtime_busy', retryable: true, message: 'internal' }, { status: 409 })
    ),
  };
  await withFetchStub(async () => {
    providerCalls += 1;
    return openAIResult();
  }, async () => {
    const response = await chat({
      message: 'inspect',
      tool: 'code',
      mode: 'code',
      workspace_id: 'workspace-1',
    }, env);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.status, 'runtime_busy');
    assert.equal(JSON.stringify(body).includes('internal'), false);
  });
  assert.equal(providerCalls, 0);
});

test('non-retryable runtime error returns safe 502 and never falls back', async () => {
  let providerCalls = 0;
  const env = {
    OPENAI_API_KEY: 'test-openai',
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'true',
    CODEX_RUNTIME: runtimeBinding(async () =>
      Response.json({ ok: false, code: 'runtime_unsupported_request', retryable: false, stderr: 'secret' }, { status: 502 })
    ),
  };
  await withFetchStub(async () => {
    providerCalls += 1;
    return openAIResult();
  }, async () => {
    const response = await chat({
      message: 'inspect',
      tool: 'code',
      mode: 'code',
      workspace_id: 'workspace-1',
    }, env);
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.status, 'runtime_unsupported_request');
    assert.equal(JSON.stringify(body).includes('secret'), false);
  });
  assert.equal(providerCalls, 0);
});

test('invalid supplied workspace id is rejected before runtime or provider calls', async () => {
  let runtimeCalls = 0;
  let providerCalls = 0;
  const env = {
    OPENAI_API_KEY: 'test-openai',
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'true',
    CODEX_RUNTIME: runtimeBinding(async () => {
      runtimeCalls += 1;
      return Response.json({ ok: true });
    }),
  };
  await withFetchStub(async () => {
    providerCalls += 1;
    return openAIResult();
  }, async () => {
    const response = await chat({
      message: 'inspect',
      tool: 'code',
      mode: 'code',
      workspace_id: '../escape',
    }, env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).status, 'validation_error');
  });
  assert.equal(runtimeCalls, 0);
  assert.equal(providerCalls, 0);
});

test('Claude code request bypasses Codex runtime', async () => {
  let runtimeCalls = 0;
  const env = {
    ANTHROPIC_API_KEY: 'test-anthropic',
    AUTH_SESSION_SECRET: SESSION_SECRET,
    CODEX_RUNTIME_ENABLED: 'true',
    CODEX_RUNTIME: runtimeBinding(async () => {
      runtimeCalls += 1;
      return Response.json({ ok: true });
    }),
  };
  await withFetchStub(async (url) => {
    assert.equal(String(url), 'https://api.anthropic.com/v1/messages');
    return Response.json({
      content: [{ type: 'text', text: 'claude code answer' }],
      stop_reason: 'end_turn',
    });
  }, async () => {
    const response = await chat({
      message: 'write code',
      tool: 'code',
      mode: 'code',
      provider: 'claude',
      workspace_id: 'workspace-1',
    }, env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'claude code answer');
  });
  assert.equal(runtimeCalls, 0);
});
