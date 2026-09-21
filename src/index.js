const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_BUCKETS = new Map();

const AUTH_COOKIE = 'lsuperagen_trial_session';
const AUTH_STATE_COOKIE = 'lsuperagen_oauth_state';
const AUTH_SESSION_TTL_SECONDS = 6 * 60 * 60;
const AUTH_STATE_TTL_SECONDS = 10 * 60;

const ALIASES = {
  '/sdk': '/examples',
  '/control': '/dev',
  '/owner': '/dev',
  '/routes': '/endpoints',
  '/endpoint': '/endpoints',
  '/registry': '/system-registry.html',
  '/secret': '/secret-handoff',
  '/key-converter': '/secret-handoff',
  '/signin': '/login',
  '/auth': '/login',
  '/providers': '/provider-connect',
  '/provider': '/provider-connect',
  '/ai-providers': '/provider-connect',
  '/dev-code-drop': '/dev-code-drop.html'
};

const TOOL_LABELS = {
  writer: 'Write',
  research: 'Research',
  url: 'Read URL',
  code: 'Code'
};

const PUBLIC_PRODUCT_V2 = true;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

function redirectTo(location, status = 302, extraHeaders = {}) {
  const headers = extraHeaders instanceof Headers ? new Headers(extraHeaders) : new Headers(extraHeaders);
  headers.set('location', location);
  headers.set('cache-control', 'no-store');
  return new Response(null, { status, headers });
}

function htmlResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

function htmlHeaders(response, tag) {
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('x-lsuperagen-control', tag);
  return headers;
}

function currentPage(pathname) {
  if (pathname === '/') return 'index.html';
  return pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '') + '.html';
}

function publicOrigin(url, env) {
  try {
    if (typeof env.PUBLIC_SITE_URL === 'string' && env.PUBLIC_SITE_URL.trim()) return new URL(env.PUBLIC_SITE_URL.trim()).origin;
  } catch (_) {}
  return url.origin;
}

function truthySecret(env, key) {
  return Boolean(typeof env[key] === 'string' && env[key].trim());
}

function splitEnvList(value) {
  return new Set(String(value || '').split(/[\s,]+/).map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function ownerEmails(env) { return splitEnvList(env.OWNER_GOOGLE_EMAIL); }
function ownerSubs(env) { return splitEnvList(env.OWNER_GOOGLE_SUB); }
function ownerGoogleConfigured(env) { return ownerEmails(env).size > 0 || ownerSubs(env).size > 0; }

function authProviderStatus(env) {
  const sessionReady = truthySecret(env, 'AUTH_SESSION_SECRET');
  const githubReady = truthySecret(env, 'GITHUB_CLIENT_ID') && truthySecret(env, 'GITHUB_CLIENT_SECRET');
  const googleReady = truthySecret(env, 'GOOGLE_CLIENT_ID') && truthySecret(env, 'GOOGLE_CLIENT_SECRET');
  const adminAllowlistReady = truthySecret(env, 'ADMIN_ALLOWED_LOGINS');
  return {
    status: sessionReady && (githubReady || googleReady) ? (adminAllowlistReady ? 'configured' : 'public_login_ready_admin_locked') : 'partially_configured',
    session_secret: sessionReady,
    admin_gate: { enabled: true, allowlist_configured: adminAllowlistReady, env_name: 'ADMIN_ALLOWED_LOGINS' },
    owner_google_gate: { enabled: true, configured: ownerGoogleConfigured(env), required_provider: 'google', email_env_name: 'OWNER_GOOGLE_EMAIL', sub_env_name: 'OWNER_GOOGLE_SUB' },
    github: { provider: 'github', client_id: truthySecret(env, 'GITHUB_CLIENT_ID'), client_secret: truthySecret(env, 'GITHUB_CLIENT_SECRET'), ready: githubReady },
    google: { provider: 'google', client_id: truthySecret(env, 'GOOGLE_CLIENT_ID'), client_secret: truthySecret(env, 'GOOGLE_CLIENT_SECRET'), ready: googleReady },
    expected_secrets: ['AUTH_SESSION_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    admin_expected_variable: 'ADMIN_ALLOWED_LOGINS',
    owner_expected_variable: 'OWNER_GOOGLE_EMAIL',
    optional_variables: ['PUBLIC_SITE_URL', 'OWNER_GOOGLE_SUB'],
    secret_values_exposed: false
  };
}

function authStatusPayload(request, env) {
  const url = new URL(request.url);
  const origin = publicOrigin(url, env);
  return {
    ok: true,
    surface: 'login_backend_ui_v1_owner_google_dev_gate_v1_mobile_fix_v1',
    public_trial: true,
    origin,
    login_urls: {
      github: origin + '/auth/github',
      google: origin + '/auth/google',
      owner_dev_google: origin + '/auth/google?return_to=/dev',
      logout: origin + '/auth/logout',
      session: origin + '/api/auth/session',
      dev_status: origin + '/api/dev/status',
      admin_status: origin + '/api/admin/status'
    },
    ...authProviderStatus(env)
  };
}

function b64urlEncode(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(String(input));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(value) {
  const pad = value.length % 4 ? '='.repeat(4 - (value.length % 4)) : '';
  const binary = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

async function createSignedToken(payload, env, typ, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode(JSON.stringify({ typ, iat: now, exp: now + ttlSeconds, ...payload }));
  return body + '.' + await hmacSign(body, env.AUTH_SESSION_SECRET || 'missing-session-secret');
}

async function verifySignedToken(token, env, typ) {
  if (!token || !truthySecret(env, 'AUTH_SESSION_SECRET') || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (sig !== await hmacSign(body, env.AUTH_SESSION_SECRET)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(body)); } catch (_) { return null; }
  if (!payload || payload.typ !== typ) return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function cookieValue(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';').map((p) => p.trim())) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx) === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return '';
}

function setCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearAuthHeaders(extra = {}) {
  const headers = new Headers(extra);
  headers.append('set-cookie', clearCookie(AUTH_COOKIE));
  headers.append('set-cookie', clearCookie(AUTH_STATE_COOKIE));
  headers.set('cache-control', 'no-store');
  return headers;
}

function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/chat?auth=trial';
  if (!value.startsWith('/') || value.startsWith('//')) return '/chat?auth=trial';
  if (/\r|\n/.test(value)) return '/chat?auth=trial';
  return value.slice(0, 180);
}

async function currentSession(request, env) { return verifySignedToken(cookieValue(request, AUTH_COOKIE), env, 'auth_session'); }
function adminAllowlist(env) { return splitEnvList(env.ADMIN_ALLOWED_LOGINS); }

function adminIdentityCandidates(session) {
  if (!session) return [];
  const provider = String(session.provider || '').toLowerCase();
  const values = [];
  const add = (value) => { if (value !== undefined && value !== null && String(value).trim()) values.push(String(value).trim().toLowerCase()); };
  add(session.login); add(session.email); add(session.id);
  const raw = Array.from(new Set(values));
  const namespaced = [];
  for (const value of raw) { namespaced.push(value); if (provider) namespaced.push(`${provider}:${value}`); }
  if (provider && session.id) namespaced.push(`${provider}:id:${String(session.id).toLowerCase()}`);
  if (provider && session.login) namespaced.push(`${provider}:login:${String(session.login).toLowerCase()}`);
  if (provider && session.email) namespaced.push(`${provider}:email:${String(session.email).toLowerCase()}`);
  return Array.from(new Set(namespaced));
}

function isAdminSession(session, env) {
  const allowed = adminAllowlist(env);
  if (!session || allowed.size === 0) return false;
  return adminIdentityCandidates(session).some((candidate) => allowed.has(candidate));
}

function isOwnerGoogleSession(session, env) {
  if (!session || String(session.provider || '').toLowerCase() !== 'google') return false;
  const emails = ownerEmails(env);
  const subs = ownerSubs(env);
  if (emails.size === 0 && subs.size === 0) return false;
  const email = String(session.email || session.login || '').trim().toLowerCase();
  const sub = String(session.id || '').trim().toLowerCase();
  const emailVerified = session.email_verified === true || session.email_verified === 'true';
  return Boolean((emailVerified && email && emails.has(email)) || (sub && subs.has(sub)));
}

function devDeniedPage(reason, session, env) {
  const reasonText = {
    not_configured: 'OWNER_GOOGLE_EMAIL ยังไม่ได้ตั้งค่าใน Cloudflare Secret',
    not_google: 'session นี้ไม่ใช่ Google owner session จึงถูกบล็อกและล้าง session',
    not_owner: 'Google account นี้ไม่ตรงกับ OWNER_GOOGLE_EMAIL / OWNER_GOOGLE_SUB',
    not_verified: 'Google email ยังไม่ผ่าน email_verified',
    not_authenticated: 'ต้องล็อกอินด้วย Google owner ก่อน'
  }[reason] || 'Owner gate blocked';
  const identity = session ? `${session.provider || 'provider'}:${session.email || session.login || session.id || 'unknown'}` : 'not signed in';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Owner Dev Gate — lsuperagen.docs</title><style>body{margin:0;background:#060606;color:#f5f7f9;font-family:Inter,"Noto Sans Thai",system-ui,sans-serif;line-height:1.65}.bp{position:fixed;inset:0;background-image:linear-gradient(rgba(140,150,165,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(140,150,165,.07) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse 90% 60% at 50% 0,#000 30%,transparent 100%)}main{position:relative;z-index:1;min-height:100vh;display:grid;place-items:center;padding:28px}.card{width:min(680px,100%);border:1px solid #26292f;border-radius:20px;background:linear-gradient(180deg,rgba(18,19,22,.94),rgba(10,10,11,.94));padding:28px;box-shadow:0 28px 80px rgba(0,0,0,.42)}.ey{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.72rem;letter-spacing:.22em;color:#7c828c;margin-bottom:14px}h1{font-size:clamp(2rem,7vw,3.4rem);line-height:1;margin:0 0 16px;letter-spacing:-.04em}.lead{color:#a2a7b0;font-size:1.04rem}.box{margin:22px 0;border-left:2px solid #63b3ff;background:rgba(99,179,255,.07);border-radius:14px;padding:14px;color:#c8ccd2}.meta{display:grid;gap:10px;margin:20px 0}.row{display:flex;justify-content:space-between;gap:12px;border:1px solid #1c1e22;border-radius:12px;padding:12px;background:#0a0a0b}.row span{color:#7c828c}.row b{overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.btn{min-height:46px;border-radius:999px;padding:0 18px;display:inline-flex;align-items:center;border:1px solid #33373f;color:#f5f7f9;text-decoration:none;font-weight:700}.btn.primary{background:#fff;color:#060606;border-color:#fff}</style></head><body><div class="bp"></div><main><section class="card"><div class="ey">OWNER GOOGLE DEV GATE V1</div><h1>Dev Locked</h1><p class="lead">พื้นที่ /dev เปิดเฉพาะ Google account ของเจ้าของระบบเท่านั้น ไม่ใช้ GitHub session และไม่เปิด contacts scope ในรอบนี้</p><div class="box">${reasonText}</div><div class="meta"><div class="row"><span>Identity</span><b>${identity}</b></div><div class="row"><span>OWNER_GOOGLE_EMAIL</span><b>${ownerEmails(env).size ? 'CONFIGURED' : 'MISSING'}</b></div><div class="row"><span>OWNER_GOOGLE_SUB</span><b>${ownerSubs(env).size ? 'CONFIGURED' : 'OPTIONAL'}</b></div></div><div class="actions"><a class="btn primary" href="/auth/google?return_to=/dev">Login with Owner Google</a><a class="btn" href="/auth/logout">Clear Session</a><a class="btn" href="/chat">Public Chat</a></div></section></main></body></html>`;
}

async function guardOwnerDev(request, env, responseMode = 'html') {
  const session = await currentSession(request, env);
  if (!ownerGoogleConfigured(env)) {
    if (responseMode === 'json') return json({ ok: false, status: 'owner_google_not_configured', required_secret: 'OWNER_GOOGLE_EMAIL', secret_values_exposed: false }, 503, { 'x-lsuperagen-dev-gate': 'not-configured' });
    return htmlResponse(devDeniedPage('not_configured', session, env), 503, { 'x-lsuperagen-dev-gate': 'not-configured' });
  }
  if (!session) {
    if (responseMode === 'json') return json({ ok: false, status: 'not_authenticated', login: '/auth/google?return_to=/dev', secret_values_exposed: false }, 401, { 'x-lsuperagen-dev-gate': 'login-required' });
    return redirectTo('/auth/google?return_to=/dev', 302, { 'x-lsuperagen-dev-gate': 'login-required' });
  }
  if (String(session.provider || '').toLowerCase() !== 'google') {
    const headers = clearAuthHeaders({ 'x-lsuperagen-dev-gate': 'blocked-non-google' });
    if (responseMode === 'json') return json({ ok: false, status: 'blocked_non_google_session', action: 'session_cleared', secret_values_exposed: false }, 403, headers);
    return htmlResponse(devDeniedPage('not_google', session, env), 403, headers);
  }
  const emailVerified = session.email_verified === true || session.email_verified === 'true';
  if (!emailVerified && ownerEmails(env).size > 0) {
    const headers = clearAuthHeaders({ 'x-lsuperagen-dev-gate': 'blocked-email-unverified' });
    if (responseMode === 'json') return json({ ok: false, status: 'blocked_google_email_unverified', action: 'session_cleared', secret_values_exposed: false }, 403, headers);
    return htmlResponse(devDeniedPage('not_verified', session, env), 403, headers);
  }
  if (!isOwnerGoogleSession(session, env)) {
    const headers = clearAuthHeaders({ 'x-lsuperagen-dev-gate': 'blocked-not-owner' });
    if (responseMode === 'json') return json({ ok: false, status: 'blocked_not_owner_google', action: 'session_cleared', provider: session.provider, secret_values_exposed: false }, 403, headers);
    return htmlResponse(devDeniedPage('not_owner', session, env), 403, headers);
  }
  return null;
}

async function handleAdminStatus(request, env) {
  const session = await currentSession(request, env);
  return json({
    ok: true,
    surface: 'admin_gate_v1_owner_google_dev_gate_v1',
    authenticated: Boolean(session),
    admin: isAdminSession(session, env),
    owner_google: isOwnerGoogleSession(session, env),
    allowlist_configured: adminAllowlist(env).size > 0,
    owner_google_configured: ownerGoogleConfigured(env),
    allowed_env_name: 'ADMIN_ALLOWED_LOGINS',
    owner_env_name: 'OWNER_GOOGLE_EMAIL',
    user: session ? { provider: session.provider, id: session.id, login: session.login, email: session.email, email_verified: session.email_verified, name: session.name, avatar: session.avatar } : null,
    public_users_can_access_admin: false,
    public_users_can_access_dev: false,
    guest_can_access_admin: false,
    secret_values_exposed: false
  }, 200, { 'x-lsuperagen-admin-gate': 'status-v1' });
}

async function handleDevStatus(request, env) {
  const gate = await guardOwnerDev(request, env, 'json');
  if (gate) return gate;
  const session = await currentSession(request, env);
  return json({
    ok: true,
    surface: 'owner_google_dev_gate_v1',
    owner_google: true,
    provider_required: 'google',
    email_verified_required: ownerEmails(env).size > 0,
    session: { provider: session.provider, email: session.email, email_verified: session.email_verified, name: session.name },
    contacts_scope_enabled: false,
    contacts_scope_note: 'Contacts are intentionally not requested in Owner Google Dev Gate V1.',
    secret_values_exposed: false
  }, 200, { 'x-lsuperagen-dev-gate': 'owner' });
}

async function handleAuthStart(provider, request, env) {
  const url = new URL(request.url);
  const providerStatus = authProviderStatus(env)[provider];
  if (!providerStatus || !providerStatus.ready) return redirectTo(`/login?auth_error=${provider}_not_configured`);
  const origin = publicOrigin(url, env);
  const redirectUri = `${origin}/auth/${provider}/callback`;
  const returnTo = safeReturnTo(url.searchParams.get('return_to') || '/chat?auth=' + provider);
  const state = await createSignedToken({ provider, return_to: returnTo, nonce: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) }, env, 'oauth_state', AUTH_STATE_TTL_SECONDS);
  const authUrl = provider === 'github' ? new URL('https://github.com/login/oauth/authorize') : new URL('https://accounts.google.com/o/oauth2/v2/auth');
  if (provider === 'github') {
    authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'read:user user:email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('allow_signup', 'true');
  } else {
    authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID.trim());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
  }
  return redirectTo(authUrl.toString(), 302, { 'set-cookie': setCookie(AUTH_STATE_COOKIE, state, AUTH_STATE_TTL_SECONDS), 'x-lsuperagen-auth': provider + '-start-v1' });
}

async function exchangeGithubCode(code, redirectUri, env) {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'lsuperagen.docs' }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }) });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) throw new Error('github_exchange_failed');
  const userRes = await fetch('https://api.github.com/user', { headers: { authorization: 'Bearer ' + tokenData.access_token, accept: 'application/vnd.github+json', 'user-agent': 'lsuperagen.docs' } });
  const user = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !user.id) throw new Error('github_user_failed');
  return { provider: 'github', id: String(user.id), login: user.login || null, email: user.email || null, email_verified: null, name: user.name || user.login || 'GitHub user', avatar: user.avatar_url || null };
}

async function exchangeGoogleCode(code, redirectUri, env) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) throw new Error('google_exchange_failed');
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: 'Bearer ' + tokenData.access_token } });
  const user = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !user.sub) throw new Error('google_user_failed');
  return { provider: 'google', id: String(user.sub), login: user.email || null, email: user.email || null, email_verified: user.email_verified === true, name: user.name || user.email || 'Google user', avatar: user.picture || null };
}

async function handleAuthCallback(provider, request, env) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) return redirectTo(`/login?auth_error=${provider}_${encodeURIComponent(error)}`);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = cookieValue(request, AUTH_STATE_COOKIE);
  if (!code || !state || !cookieState || state !== cookieState) return redirectTo(`/login?auth_error=${provider}_invalid_state`);
  const payload = await verifySignedToken(state, env, 'oauth_state');
  if (!payload || payload.provider !== provider) return redirectTo(`/login?auth_error=${provider}_state_rejected`);
  let user;
  try {
    const redirectUri = `${publicOrigin(url, env)}/auth/${provider}/callback`;
    user = provider === 'github' ? await exchangeGithubCode(code, redirectUri, env) : await exchangeGoogleCode(code, redirectUri, env);
  } catch (err) {
    return redirectTo(`/login?auth_error=${encodeURIComponent(err && err.message ? err.message : provider + '_failed')}`, 302, { 'set-cookie': clearCookie(AUTH_STATE_COOKIE) });
  }
  const session = await createSignedToken(user, env, 'auth_session', AUTH_SESSION_TTL_SECONDS);
  const headers = new Headers();
  headers.append('set-cookie', clearCookie(AUTH_STATE_COOKIE));
  headers.append('set-cookie', setCookie(AUTH_COOKIE, session, AUTH_SESSION_TTL_SECONDS));
  headers.set('x-lsuperagen-auth', provider + '-callback-v1');
  return redirectTo(safeReturnTo(payload.return_to || '/chat?auth=' + provider), 302, headers);
}

async function handleAuthSession(request, env) {
  const session = await currentSession(request, env);
  if (!session) return json({ ok: true, authenticated: false, surface: 'public_trial_auth_v1', user: null, admin: false, owner_google: false, secret_values_exposed: false });
  return json({ ok: true, authenticated: true, surface: 'public_trial_auth_v1', user: { provider: session.provider, id: session.id, login: session.login, email: session.email, email_verified: session.email_verified, name: session.name, avatar: session.avatar }, admin: isAdminSession(session, env), owner_google: isOwnerGoogleSession(session, env), expires_at: session.exp ? new Date(session.exp * 1000).toISOString() : null, secret_values_exposed: false });
}

function handleAuthLogout() { return redirectTo('/login?auth=logged_out', 302, clearAuthHeaders()); }

function normalizeTool(value) {
  if (value === undefined || value === null || value === '') return null;
  const tool = String(value).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TOOL_LABELS, tool) ? tool : 'invalid';
}

function inferTool(body, request) {
  const direct = normalizeTool(body.tool);
  if (direct !== null) return direct;
  try { return normalizeTool(new URL(request.headers.get('referer') || '').searchParams.get('tool')); } catch (_) { return null; }
}

function toolInstructions(tool, mode) {
  const base = [
    'Act as a practical AI work assistant for the user request.',
    'Answer in the same language as the user unless they ask otherwise.',
    'Be accurate, useful, and direct.',
    'Do not invent sources, private-system access, files, or account data.',
    'Do not reveal, request, or guess secrets or API keys.',
    'Current mode: ' + (mode || 'chat') + '.'
  ];
  const byTool = {
    writer: 'Tool context: Write. Draft, rewrite, structure, or improve content while preserving user-supplied facts and constraints.',
    research: 'Tool context: Research. Use web search for current evidence. Synthesize findings and ground factual claims in the returned sources. Never invent citations.',
    url: 'Tool context: Read URL. Use web search to open or inspect the exact URL supplied by the user first. Answer from that page when accessible, cite it, and state clearly if the page cannot be read.',
    code: 'Tool context: Code. Handle substantial implementation, debugging, refactoring, review, and edits. Preserve working code unless the requested change requires otherwise.'
  };
  return base.concat(byTool[tool] || 'Tool context: Chat. Help with the request directly.').join('\n');
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const chunks = [];
  for (const item of data.output || []) for (const c of item.content || []) {
    if (typeof c.text === 'string') chunks.push(c.text);
    if (typeof c.output_text === 'string') chunks.push(c.output_text);
  }
  return chunks.join('\n').trim();
}

function modelCandidates(env) {
  const configured = typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() : '';
  return Array.from(new Set([configured, 'gpt-6-astra', 'gpt-5-nano-2025-08-07', 'gpt-5.3-codex', 'gpt-4.1', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o-mini', 'gpt-5-nano', 'gpt-5-mini'].filter(Boolean)));
}

function clientIp(request) { return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; }

function checkRateLimit(request, tool) {
  const now = Date.now();
  const key = ['public-chat-v1', clientIp(request), tool || 'general'].join(':');
  const current = RATE_LIMIT_BUCKETS.get(key);
  const resetAt = current && current.resetAt > now ? current.resetAt : now + RATE_LIMIT_WINDOW_MS;
  const count = current && current.resetAt > now ? current.count : 0;
  const nextCount = count + 1;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - nextCount);
  RATE_LIMIT_BUCKETS.set(key, { count: nextCount, resetAt });
  if (RATE_LIMIT_BUCKETS.size > 1000) for (const [bucketKey, bucket] of RATE_LIMIT_BUCKETS) if (!bucket || bucket.resetAt <= now) RATE_LIMIT_BUCKETS.delete(bucketKey);
  return { limited: nextCount > RATE_LIMIT_MAX_REQUESTS, limit: RATE_LIMIT_MAX_REQUESTS, remaining, resetAt, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

function rateLimitHeaders(result) {
  return { 'x-lsuperagen-rate-limit': String(result.limit), 'x-lsuperagen-rate-remaining': String(result.remaining), 'x-lsuperagen-rate-reset': new Date(result.resetAt).toISOString(), ...(result.limited ? { 'retry-after': String(result.retryAfter) } : {}) };
}

async function createOpenAIResponse(env, model, message, tool, mode, requestId) {
  const usesWeb = tool === 'research' || tool === 'url';
  const payload = {
    model,
    input: message,
    instructions: toolInstructions(tool, mode),
    max_output_tokens: tool === 'code' ? 8000 : usesWeb ? 5000 : 4000,
    store: false,
    metadata: { app: 'lsuperagen.docs', surface: 'public-workspace', tool: tool || 'chat', mode }
  };
  if (usesWeb) {
    payload.tools = [{ type: 'web_search' }];
    payload.tool_choice = 'required';
    payload.include = ['web_search_call.action.sources'];
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
    body: JSON.stringify(payload)
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
  return { response, data };
}

function extractSources(data) {
  const collected = [];
  const add = (source) => {
    if (!source || typeof source.url !== 'string' || !source.url.startsWith('http')) return;
    collected.push({ title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : source.url, url: source.url });
  };
  for (const item of data.output || []) {
    if (item && item.type === 'web_search_call' && item.action && Array.isArray(item.action.sources)) {
      for (const source of item.action.sources) add(source);
    }
    for (const content of item && Array.isArray(item.content) ? item.content : []) {
      for (const annotation of content && Array.isArray(content.annotations) ? content.annotations : []) {
        if (annotation && annotation.type === 'url_citation') add({ title: annotation.title, url: annotation.url });
      }
    }
  }
  const seen = new Set();
  return collected.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 20);
}

function extractGeneratedImage(data) {
  for (const item of data.output || []) {
    if (item && item.type === 'image_generation_call' && typeof item.result === 'string' && item.result) {
      return { data_base64: item.result, revised_prompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : null };
    }
  }
  return null;
}

function isModelAccessError(data) {
  const msg = data && data.error && data.error.message ? data.error.message : '';
  return /does not have access to model|model .* not found|invalid model|not exist|do not have access/i.test(msg);
}

async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST, OPTIONS' });
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const mode = typeof body.mode === 'string' && body.mode.trim() ? body.mode.trim().slice(0, 32) : 'chat';
  const tool = inferTool(body, request);
  if (!message) return json({ ok: false, status: 'validation_error', message: 'กรุณาใส่ข้อความก่อนส่ง' }, 400);
  if (message.length > 120000) return json({ ok: false, status: 'validation_error', message: 'ข้อความยาวเกินขีดจำกัด 120,000 ตัวอักษร กรุณาแบ่งเป็นส่วนย่อย' }, 413);
  if (tool === 'invalid') return json({ ok: false, status: 'validation_error', message: 'โหมดที่ส่งมาไม่ถูกต้อง' }, 400);
  const rate = checkRateLimit(request, tool);
  const baseHeaders = rateLimitHeaders(rate);
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง' }, 429, baseHeaders);
  if (!env.OPENAI_API_KEY) return json({ ok: false, status: 'service_unavailable', message: 'บริการ AI ยังไม่พร้อมใช้งานในขณะนี้' }, 503, baseHeaders);

  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const webMode = tool === 'research' || tool === 'url';
  const candidates = webMode
    ? Array.from(new Set(['gpt-6-astra', 'gpt-4.1', typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() : ''].filter(Boolean)))
    : modelCandidates(env);
  let lastStatus = 502;
  for (const model of candidates) {
    let providerResponse, data;
    try {
      ({ response: providerResponse, data } = await createOpenAIResponse(env, model, message, tool, mode, requestId));
    } catch (_) {
      return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อบริการ AI ไม่สำเร็จ กรุณาลองใหม่' }, 502, baseHeaders);
    }
    if (providerResponse.ok) {
      const output = extractOutputText(data);
      if (!output) return json({ ok: false, status: 'empty_result', message: 'บริการ AI ไม่ได้ส่งข้อความกลับมา กรุณาลองใหม่' }, 502, baseHeaders);
      return json({ ok: true, status: 'completed', message: output, output, sources: extractSources(data) }, 200, baseHeaders);
    }
    lastStatus = providerResponse.status;
    if (!isModelAccessError(data)) break;
  }
  return json({ ok: false, status: 'service_error', message: lastStatus === 429 ? 'บริการ AI ถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง' : 'บริการ AI ไม่สามารถทำคำขอนี้ได้ในขณะนี้' }, lastStatus === 429 ? 429 : 502, baseHeaders);
}

async function handleImage(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST, OPTIONS' });
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return json({ ok: false, status: 'validation_error', message: 'กรุณาอธิบายภาพที่ต้องการสร้าง' }, 400);
  if (prompt.length > 12000) return json({ ok: false, status: 'validation_error', message: 'คำอธิบายภาพยาวเกินขีดจำกัด 12,000 ตัวอักษร' }, 413);
  const rate = checkRateLimit(request, 'image');
  const baseHeaders = rateLimitHeaders(rate);
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง' }, 429, baseHeaders);
  if (!env.OPENAI_API_KEY) return json({ ok: false, status: 'service_unavailable', message: 'บริการสร้างภาพยังไม่พร้อมใช้งานในขณะนี้' }, 503, baseHeaders);
  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
    body: JSON.stringify({
      model: 'gpt-6-astra',
      input: prompt,
      tools: [{ type: 'image_generation', model: 'gpt-image-2.5-flare', action: 'generate' }],
      tool_choice: { type: 'image_generation' },
      store: false,
      metadata: { app: 'lsuperagen.docs', surface: 'public-workspace', tool: 'image' }
    })
  }).catch(() => null);
  if (!response) return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อบริการสร้างภาพไม่สำเร็จ กรุณาลองใหม่' }, 502, baseHeaders);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
  if (!response.ok) return json({ ok: false, status: 'service_error', message: response.status === 429 ? 'บริการสร้างภาพถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง' : 'ไม่สามารถสร้างภาพจากคำขอนี้ได้ กรุณาลองปรับคำอธิบาย' }, response.status === 429 ? 429 : 502, baseHeaders);
  const image = extractGeneratedImage(data);
  if (!image) return json({ ok: false, status: 'empty_result', message: 'บริการสร้างภาพไม่ได้ส่งไฟล์ภาพกลับมา กรุณาลองใหม่' }, 502, baseHeaders);
  return json({ ok: true, status: 'completed', image: { mime_type: 'image/png', data_base64: image.data_base64, filename: 'lsuperagen-image.png', revised_prompt: image.revised_prompt } }, 200, baseHeaders);
}

function plannedEndpoint(pathname) {
  const planned = {
    '/admin/auth/github': { status: 'retired', method: 'GET', message: 'Use /dev.' },
    '/admin/github/status': { status: 'retired', method: 'GET', message: 'Use /dev.' },
    '/admin/github/files': { status: 'retired', method: 'GET', message: 'Use /dev.' },
    '/admin/github/commit': { status: 'retired', method: 'POST', message: 'Use /dev.' },
    '/admin/handoff/claude': { status: 'planned', method: 'POST', message: 'Use /dev.' }
  }[pathname];
  return planned ? json({ ok: false, endpoint: pathname, ...planned, secret_values: false }, 501) : null;
}

function injectHead(html, content) {
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, content + '\n</head>') : content + html;
}

function injectBody(html, content) {
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, content + '\n</body>') : html + content;
}

function publicMobileLinks(page) {
  const items = [
    ['/chat', 'Workspace', 'chat.html'],
    ['/tools', 'Tools', 'tools.html']
  ];
  return items.map(([href, label, file]) => `<a href="${href}" ${page === file ? 'aria-current="page"' : ''}>${label}<span>→</span></a>`).join('');
}

function enhancePublicHtml(html, pathname) {
  return html;
}

function isDevOnlyPath(pathname) {
  return pathname === '/dev' || pathname === '/dev.html' || pathname === '/dev-code-drop' || pathname === '/dev-code-drop.html';
}

async function fetchAsset(request, env, pathname) {
  if (pathname === '/dev' || pathname === '/dev.html') {
    const assetUrl = new URL(request.url);
    assetUrl.pathname = '/dev.html';
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }
  if (pathname === '/dev-code-drop') {
    const assetUrl = new URL(request.url);
    assetUrl.pathname = '/dev-code-drop.html';
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/' || pathname === '/home' || pathname === '/index.html') return redirectTo('/chat', 302);
    const legacyPublic = new Set(['/examples','/examples.html','/getting-started','/getting-started.html','/api','/api.html','/guides','/guides.html','/changelog','/changelog.html','/workspace','/workspace.html','/provider-connect','/provider-connect.html','/secret-handoff','/secret-handoff.html','/endpoints','/endpoints.html','/system-registry','/system-registry.html']);
    if (legacyPublic.has(pathname)) return redirectTo('/chat', 302);
    if (pathname === '/admin' || pathname === '/admin.html') return redirectTo('/dev', 302, { 'x-lsuperagen-admin-gate': 'redirect-to-dev-v1' });
    if (ALIASES[pathname]) return redirectTo(new URL(ALIASES[pathname], url).toString(), 301);

    if (pathname === '/api/auth/status') return json(authStatusPayload(request, env), 200, { 'x-lsuperagen-auth': 'status-v1' });
    if (pathname === '/api/auth/session') return handleAuthSession(request, env);
    if (pathname === '/api/admin/status') return handleAdminStatus(request, env);
    if (pathname === '/api/dev/status') return handleDevStatus(request, env);
    if (pathname === '/auth/logout') return handleAuthLogout();
    if (pathname === '/auth/github') return handleAuthStart('github', request, env);
    if (pathname === '/auth/google') return handleAuthStart('google', request, env);
    if (pathname === '/auth/github/callback') return handleAuthCallback('github', request, env);
    if (pathname === '/auth/google/callback') return handleAuthCallback('google', request, env);

    if (request.method === 'OPTIONS' && (pathname === '/api/chat' || pathname === '/api/image')) return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (pathname === '/api/chat') return handleChat(request, env);
    if (pathname === '/api/image') return handleImage(request, env);

    const planned = plannedEndpoint(pathname);
    if (planned) return planned;

    if (isDevOnlyPath(pathname)) {
      const gate = await guardOwnerDev(request, env, 'html');
      if (gate) return gate;
    }

    const response = await fetchAsset(request, env, pathname);
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;
    let html = await response.text();
    if (!isDevOnlyPath(pathname)) html = enhancePublicHtml(html, pathname);
    return new Response(html, { status: response.status, headers: htmlHeaders(response, 'owner-google-dev-gate-v1-openai-runtime-v1-mobile-fix-v1') });
  }
};
