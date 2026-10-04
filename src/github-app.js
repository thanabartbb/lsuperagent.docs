const MAX_FILES = 20;
const MAX_FILE_BYTES = 200_000;
const MAX_TOTAL_BYTES = 1_000_000;
const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'SDKSPACE-Code-Tools';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

async function stateToken(payload, secret) {
  const body = base64url(new TextEncoder().encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 })));
  return `${body}.${await sign(body, secret)}`;
}

async function verifyState(token, secret) {
  if (!token || !token.includes('.') || !secret) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature || signature !== await sign(body, secret)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch (_) { return null; }
}

function sessionKey(session) {
  return session && session.provider && session.id ? `${session.provider}:${session.id}` : null;
}

function cookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function secureCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name) { return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`; }

function configReady(env) {
  return Boolean(env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_CLIENT_SECRET && env.GITHUB_TOKEN_ENCRYPTION_KEY && env.AUTH_SESSION_SECRET && env.DB);
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), new TextEncoder().encode(JSON.stringify(value)));
  return { iv: base64url(iv), ciphertext: base64url(new Uint8Array(ciphertext)) };
}

async function unseal(record, secret) {
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64url(record.iv) }, await encryptionKey(secret), fromBase64url(record.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function saveConnection(env, key, login, tokenData) {
  const encrypted = await seal({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token }, env.GITHUB_TOKEN_ENCRYPTION_KEY);
  const expiresAt = Date.now() + Math.max(60, Number(tokenData.expires_in) || 0) * 1000;
  const refreshExpiresAt = Date.now() + Math.max(60, Number(tokenData.refresh_token_expires_in) || 0) * 1000;
  await env.DB.prepare(`INSERT INTO github_connections (user_key, github_login, token_iv, token_ciphertext, access_expires_at, refresh_expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_key) DO UPDATE SET github_login=excluded.github_login, token_iv=excluded.token_iv, token_ciphertext=excluded.token_ciphertext, access_expires_at=excluded.access_expires_at, refresh_expires_at=excluded.refresh_expires_at, updated_at=excluded.updated_at`)
    .bind(key, login, encrypted.iv, encrypted.ciphertext, expiresAt, refreshExpiresAt, Date.now()).run();
}

async function getConnection(env, key) {
  const row = await env.DB.prepare('SELECT * FROM github_connections WHERE user_key = ?').bind(key).first();
  if (!row) return null;
  return { row, tokens: await unseal({ iv: row.token_iv, ciphertext: row.token_ciphertext }, env.GITHUB_TOKEN_ENCRYPTION_KEY) };
}

async function githubToken(env, key) {
  let connection = await getConnection(env, key);
  if (!connection) return { error: 'github_not_connected' };
  if (connection.row.access_expires_at > Date.now() + 60_000) return { token: connection.tokens.access_token, login: connection.row.github_login };
  if (!connection.tokens.refresh_token || connection.row.refresh_expires_at <= Date.now()) return { error: 'github_reconnect_required' };
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': USER_AGENT },
    body: JSON.stringify({ client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: connection.tokens.refresh_token })
  });
  const refreshed = await response.json().catch(() => ({}));
  if (!response.ok || !refreshed.access_token) return { error: 'github_reconnect_required' };
  await saveConnection(env, key, connection.row.github_login, refreshed);
  connection = await getConnection(env, key);
  return { token: connection.tokens.access_token, login: connection.row.github_login };
}

async function exchangeCode(code, redirectUri, env) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': USER_AGENT },
    body: JSON.stringify({ client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, code, redirect_uri: redirectUri })
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) throw new Error('github_token_exchange_failed');
  const userResponse = await fetch(`${GITHUB_API}/user`, { headers: githubHeaders(token.access_token) });
  const user = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !user.login) throw new Error('github_user_lookup_failed');
  return { user, token };
}

function githubHeaders(token) {
  return { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': USER_AGENT, 'x-github-api-version': '2022-11-28' };
}

async function githubRequest(token, path, init = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, { ...init, headers: { ...githubHeaders(token), ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function bodyJson(request, limit = 1_100_000) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > limit) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
}

function validRepoName(name) { return typeof name === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(name) && name !== '.' && name !== '..'; }

function validateFiles(files) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) return 'invalid_files';
  let total = 0;
  const seen = new Set();
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') return 'invalid_files';
    const path = file.path;
    if (!path || path.length > 240 || path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..') || /[\u0000-\u001f]/.test(path)) return 'invalid_path';
    if (seen.has(path)) return 'duplicate_path';
    seen.add(path);
    const size = new TextEncoder().encode(file.content).length;
    if (size > MAX_FILE_BYTES) return 'file_too_large';
    total += size;
  }
  return total <= MAX_TOTAL_BYTES ? null : 'payload_too_large';
}

export async function handleGithubApp(request, env, pathname, session) {
  const key = sessionKey(session);
  if (!key) return json({ ok: false, error: 'authentication_required' }, 401);
  if (!configReady(env)) return json({ ok: false, error: 'github_app_not_configured' }, 503);

  if (pathname === '/api/github/status' && request.method === 'GET') {
    try {
      const connection = await env.DB.prepare('SELECT github_login FROM github_connections WHERE user_key = ?').bind(key).first();
      return json({ ok: true, connected: Boolean(connection), login: connection?.github_login || null });
    } catch (_) { return json({ ok: false, error: 'github_storage_unavailable' }, 503); }
  }

  if (pathname === '/api/github/connect' && request.method === 'GET') {
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/auth/github/connect/callback`;
    const state = await stateToken({ user_key: key, nonce: crypto.randomUUID() }, env.AUTH_SESSION_SECRET);
    const target = new URL('https://github.com/login/oauth/authorize');
    target.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID.trim());
    target.searchParams.set('redirect_uri', redirectUri);
    target.searchParams.set('state', state);
    return new Response(null, { status: 302, headers: { location: target.toString(), 'cache-control': 'no-store', 'set-cookie': secureCookie('sdkspace_github_state', state, 600) } });
  }

  if (pathname === '/auth/github/connect/callback' && request.method === 'GET') {
    const url = new URL(request.url);
    const state = url.searchParams.get('state') || '';
    const payload = await verifyState(state, env.AUTH_SESSION_SECRET);
    if (!payload || payload.user_key !== key || state !== cookie(request, 'sdkspace_github_state')) return json({ ok: false, error: 'github_state_rejected' }, 400);
    if (url.searchParams.get('error')) return new Response(null, { status: 302, headers: { location: '/tools?github=cancelled', 'set-cookie': clearCookie('sdkspace_github_state'), 'cache-control': 'no-store' } });
    const code = url.searchParams.get('code');
    if (!code) return json({ ok: false, error: 'github_code_missing' }, 400);
    try {
      const { user, token } = await exchangeCode(code, `${url.origin}/auth/github/connect/callback`, env);
      await saveConnection(env, key, user.login, token);
      return new Response(null, { status: 302, headers: { location: '/tools?github=connected', 'set-cookie': clearCookie('sdkspace_github_state'), 'cache-control': 'no-store' } });
    } catch (_) {
      return new Response(null, { status: 302, headers: { location: '/tools?github=failed', 'set-cookie': clearCookie('sdkspace_github_state'), 'cache-control': 'no-store' } });
    }
  }

  if (pathname === '/api/github/disconnect' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({ ok: false, error: 'origin_rejected' }, 403);
    try {
      await env.DB.prepare('DELETE FROM github_connections WHERE user_key = ?').bind(key).run();
      return json({ ok: true, connected: false });
    } catch (_) { return json({ ok: false, error: 'github_storage_unavailable' }, 503); }
  }

  if (pathname === '/api/github/actions' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({ ok: false, error: 'origin_rejected' }, 403);
    const body = await bodyJson(request);
    if (!body || typeof body.action !== 'string') return json({ ok: false, error: 'invalid_request' }, 400);
    const auth = await githubToken(env, key);
    if (auth.error) return json({ ok: false, error: auth.error }, auth.error === 'github_not_connected' ? 409 : 401);

    if (body.action === 'create_repository') {
      if (!validRepoName(body.name)) return json({ ok: false, error: 'invalid_repository_name' }, 400);
      const description = typeof body.description === 'string' ? body.description.trim().slice(0, 350) : '';
      const { response, data } = await githubRequest(auth.token, '/user/repos', { method: 'POST', body: JSON.stringify({ name: body.name, description, private: true, auto_init: true }) });
      if (!response.ok) return json({ ok: false, error: response.status === 403 ? 'github_permission_denied' : response.status === 422 ? 'repository_name_unavailable' : 'github_api_error', status: response.status });
      return json({ ok: true, action: 'create_repository', repository: { full_name: data.full_name, html_url: data.html_url, private: data.private, default_branch: data.default_branch } }, 201);
    }

    if (body.action === 'commit_files') {
      const owner = typeof body.owner === 'string' ? body.owner.trim() : '';
      const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
      const branch = typeof body.branch === 'string' && body.branch.trim() ? body.branch.trim() : 'main';
      const message = typeof body.message === 'string' ? body.message.trim().slice(0, 200) : '';
      const filesError = validateFiles(body.files);
      if (owner.toLowerCase() !== auth.login.toLowerCase() || !validRepoName(repo) || !/^[A-Za-z0-9._/-]{1,200}$/.test(branch) || branch.includes('..') || !message || !Array.isArray(body.files) || filesError) return json({ ok: false, error: filesError || 'invalid_commit_request' }, 400);
      const [repoResult, refResult] = await Promise.all([
        githubRequest(auth.token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`),
        githubRequest(auth.token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`)
      ]);
      if (!repoResult.response.ok || !refResult.response.ok) return json({ ok: false, error: repoResult.response.status === 404 || refResult.response.status === 404 ? 'repository_or_branch_not_found' : 'github_api_error' }, repoResult.response.status === 403 ? 403 : 404);
      const headSha = refResult.data.object?.sha;
      const headResult = await githubRequest(auth.token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${headSha}`);
      if (!headResult.response.ok || !headResult.data.tree?.sha) return json({ ok: false, error: 'repository_read_failed' }, 502);
      const tree = [];
      for (const file of body.files) {
        const blob = await githubRequest(auth.token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: file.content, encoding: 'utf-8' }) });
        if (!blob.response.ok || !blob.data.sha) return json({ ok: false, error: 'github_blob_create_failed' }, 502);
        tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.data.sha });
      }
      const treeResult = await githubRequest(auth.token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: headResult.data.tree.sha, tree }) });
      if (!treeResult.response.ok || !treeResult.data.sha) return json({ ok: false, error: 'github_tree_create_failed' }, 502);
      const commit = await githubRequest(auth.token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: treeResult.data.sha, parents: [headSha] }) });
      if (!commit.response.ok || !commit.data.sha) return json({ ok: false, error: 'github_commit_create_failed' }, 502);
      const update = await githubRequest(auth.token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.data.sha, force: false }) });
      if (!update.response.ok) return json({ ok: false, error: update.response.status === 409 ? 'branch_changed_retry' : 'github_ref_update_failed' }, update.response.status === 409 ? 409 : 502);
      return json({ ok: true, action: 'commit_files', repository: `${owner}/${repo}`, branch, commit: { sha: commit.data.sha, html_url: commit.data.html_url }, files: body.files.map(({ path }) => path) }, 201);
    }
    return json({ ok: false, error: 'unsupported_github_action' }, 400);
  }

  return json({ ok: false, error: 'method_not_allowed' }, 405);
}

export const githubAppInternals = { validRepoName, validateFiles, seal, unseal, stateToken, verifyState };
