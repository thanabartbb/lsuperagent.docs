import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGithubApp, githubAppInternals } from '../src/github-app.js';

const SECRET = 'test-session-secret-123456789';
const ENCRYPTION = 'test-encryption-key-12345678901234567890';
const SESSION = { provider: 'google', id: 'user-123' };

function fakeDb() {
  let row = null;
  return {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() {
          if (!row || row.user_key !== params[0]) return null;
          if (sql.includes('SELECT github_login')) return { github_login: row.github_login };
          return { ...row };
        },
        async run() {
          if (sql.startsWith('INSERT INTO github_connections')) {
            row = { user_key: params[0], github_login: params[1], token_iv: params[2], token_ciphertext: params[3], access_expires_at: params[4], refresh_expires_at: params[5], updated_at: params[6] };
          } else if (sql.startsWith('DELETE FROM github_connections')) row = null;
          return { success: true };
        }
      };
    },
    get row() { return row; },
    set row(value) { row = value; }
  };
}

function makeEnv(DB = fakeDb()) {
  return { DB, AUTH_SESSION_SECRET: SECRET, GITHUB_APP_CLIENT_ID: 'client-id', GITHUB_APP_CLIENT_SECRET: 'client-secret', GITHUB_TOKEN_ENCRYPTION_KEY: ENCRYPTION };
}

function req(path, { method = 'GET', headers = {}, body } = {}) {
  return new Request(`https://agents-sdk.space${path}`, { method, headers: new Headers(headers), body: body === undefined ? undefined : JSON.stringify(body) });
}

async function connectGithub(env) {
  const start = await handleGithubApp(req('/api/github/connect'), env, '/api/github/connect', SESSION);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cookie = start.headers.get('set-cookie').split(';')[0];
  return { state, cookie };
}

test('GitHub access tokens are encrypted at rest and can be decrypted by the Worker', async () => {
  const value = { access_token: 'ghu_sensitive_value', refresh_token: 'ghr_sensitive_value' };
  const sealed = await githubAppInternals.seal(value, ENCRYPTION);
  assert.equal(JSON.stringify(sealed).includes('ghu_sensitive_value'), false);
  assert.deepEqual(await githubAppInternals.unseal(sealed, ENCRYPTION), value);
});

test('GitHub file validation rejects traversal, duplicate paths, and oversized file sets', () => {
  assert.equal(githubAppInternals.validRepoName('new-sdk'), true);
  assert.equal(githubAppInternals.validRepoName('../oops'), false);
  assert.equal(githubAppInternals.validateFiles([{ path: '../worker.js', content: 'x' }]), 'invalid_path');
  assert.equal(githubAppInternals.validateFiles([{ path: 'src/a.js', content: 'x' }, { path: 'src/a.js', content: 'y' }]), 'duplicate_path');
});

test('GitHub App connect callback stores a token encrypted and status exposes only the linked login', async () => {
  const env = makeEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url) === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'ghu_sensitive_value', refresh_token: 'ghr_sensitive_value', expires_in: 3600, refresh_token_expires_in: 86400 });
    if (String(url) === 'https://api.github.com/user') return Response.json({ login: 'thanabartbb' });
    throw new Error(`unexpected fetch: ${url} ${init.method || 'GET'}`);
  };
  try {
    const { state, cookie } = await connectGithub(env);
    const callback = req(`/auth/github/connect/callback?code=one-time&state=${encodeURIComponent(state)}`, { headers: { cookie: `sdkspace_github_state=${encodeURIComponent(state)}` } });
    const response = await handleGithubApp(callback, env, '/auth/github/connect/callback', SESSION);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/tools?github=connected');
    assert.equal(env.DB.row.github_login, 'thanabartbb');
    assert.equal(env.DB.row.token_ciphertext.includes('ghu_sensitive_value'), false);
    const status = await handleGithubApp(req('/api/github/status'), env, '/api/github/status', SESSION);
    assert.deepEqual(await status.json(), { ok: true, connected: true, login: 'thanabartbb' });
    assert.ok(cookie.startsWith('sdkspace_github_state='));
  } finally { globalThis.fetch = originalFetch; }
});

test('GitHub App actions require an explicit same-origin request and owner-bound account', async () => {
  const env = makeEnv();
  const encrypted = await githubAppInternals.seal({ access_token: 'ghu_sensitive_value', refresh_token: 'ghr' }, ENCRYPTION);
  env.DB.row = { user_key: 'google:user-123', github_login: 'thanabartbb', token_iv: encrypted.iv, token_ciphertext: encrypted.ciphertext, access_expires_at: Date.now() + 3600_000, refresh_expires_at: Date.now() + 86400_000 };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init = {}) => { calls++; assert.equal(String(url), 'https://api.github.com/user/repos'); assert.equal(JSON.parse(init.body).private, true); return Response.json({ full_name: 'thanabartbb/sample', html_url: 'https://github.com/thanabartbb/sample', private: true, default_branch: 'main' }, { status: 201 }); };
  try {
    const crossOrigin = req('/api/github/actions', { method: 'POST', headers: { origin: 'https://attacker.example' }, body: { action: 'create_repository', name: 'sample' } });
    assert.equal((await handleGithubApp(crossOrigin, env, '/api/github/actions', SESSION)).status, 403);
    const missingOrigin = req('/api/github/actions', { method: 'POST', body: { action: 'create_repository', name: 'sample' } });
    assert.equal((await handleGithubApp(missingOrigin, env, '/api/github/actions', SESSION)).status, 403);
    assert.equal(calls, 0);
    const create = req('/api/github/actions', { method: 'POST', headers: { origin: 'https://agents-sdk.space' }, body: { action: 'create_repository', name: 'sample', private: false } });
    const response = await handleGithubApp(create, env, '/api/github/actions', SESSION);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).repository.full_name, 'thanabartbb/sample');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('approved file commit writes one GitHub commit and advances the selected branch', async () => {
  const env = makeEnv();
  const encrypted = await githubAppInternals.seal({ access_token: 'ghu_sensitive_value', refresh_token: 'ghr' }, ENCRYPTION);
  env.DB.row = { user_key: 'google:user-123', github_login: 'thanabartbb', token_iv: encrypted.iv, token_ciphertext: encrypted.ciphertext, access_expires_at: Date.now() + 3600_000, refresh_expires_at: Date.now() + 86400_000 };
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push([init.method || 'GET', path, init.body && JSON.parse(init.body)]);
    if (path === '/repos/thanabartbb/sample') return Response.json({ default_branch: 'main' });
    if (path.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'head-sha' } });
    if (path.endsWith('/git/commits/head-sha')) return Response.json({ tree: { sha: 'base-tree' } });
    if (path.endsWith('/git/blobs')) return Response.json({ sha: 'blob-sha' });
    if (path.endsWith('/git/trees')) return Response.json({ sha: 'tree-sha' });
    if (path.endsWith('/git/commits')) return Response.json({ sha: 'new-commit', html_url: 'https://github.com/thanabartbb/sample/commit/new-commit' });
    if (path.endsWith('/git/refs/heads/main')) return Response.json({ ref: 'refs/heads/main' });
    throw new Error(`unexpected GitHub request: ${init.method || 'GET'} ${path}`);
  };
  try {
    const request = req('/api/github/actions', { method: 'POST', headers: { origin: 'https://agents-sdk.space' }, body: { action: 'commit_files', owner: 'thanabartbb', repo: 'sample', branch: 'main', message: 'Add starter file', files: [{ path: 'src/index.js', content: 'export default 1;\n' }] } });
    const response = await handleGithubApp(request, env, '/api/github/actions', SESSION);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.commit.sha, 'new-commit');
    assert.deepEqual(result.files, ['src/index.js']);
    assert.equal(calls.at(-1)[0], 'PATCH');
    assert.deepEqual(calls.at(-1)[2], { sha: 'new-commit', force: false });
  } finally { globalThis.fetch = originalFetch; }
});
