const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_BUCKETS = new Map();

const AUTH_COOKIE = 'lsuperagen_trial_session';
const AUTH_STATE_COOKIE = 'lsuperagen_oauth_state';
const AUTH_SESSION_TTL_SECONDS = 6 * 60 * 60;
const AUTH_STATE_TTL_SECONDS = 10 * 60;

const ALIASES = {
  '/sdk': '/examples',
  '/control': '/admin',
  '/routes': '/endpoints',
  '/endpoint': '/endpoints',
  '/secret': '/secret-handoff',
  '/key-converter': '/secret-handoff',
  '/signin': '/login',
  '/auth': '/login'
};

const TOOL_LABELS = {
  writer: 'AI Writer',
  image: 'Image Generator',
  research: 'Deep Research',
  code: 'Code Assistant'
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
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
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
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

function authProviderStatus(env) {
  const sessionReady = truthySecret(env, 'AUTH_SESSION_SECRET');
  const githubReady = truthySecret(env, 'GITHUB_CLIENT_ID') && truthySecret(env, 'GITHUB_CLIENT_SECRET');
  const googleReady = truthySecret(env, 'GOOGLE_CLIENT_ID') && truthySecret(env, 'GOOGLE_CLIENT_SECRET');
  const adminAllowlistReady = truthySecret(env, 'ADMIN_ALLOWED_LOGINS');
  return {
    status: sessionReady && (githubReady || googleReady) ? (adminAllowlistReady ? 'configured' : 'public_login_ready_admin_locked') : 'partially_configured',
    session_secret: sessionReady,
    admin_gate: { enabled: true, allowlist_configured: adminAllowlistReady, env_name: 'ADMIN_ALLOWED_LOGINS' },
    github: { provider: 'github', client_id: truthySecret(env, 'GITHUB_CLIENT_ID'), client_secret: truthySecret(env, 'GITHUB_CLIENT_SECRET'), ready: githubReady },
    google: { provider: 'google', client_id: truthySecret(env, 'GOOGLE_CLIENT_ID'), client_secret: truthySecret(env, 'GOOGLE_CLIENT_SECRET'), ready: googleReady },
    expected_secrets: ['AUTH_SESSION_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    admin_expected_variable: 'ADMIN_ALLOWED_LOGINS',
    optional_variables: ['PUBLIC_SITE_URL'],
    secret_values_exposed: false
  };
}

function authStatusPayload(request, env) {
  const url = new URL(request.url);
  const origin = publicOrigin(url, env);
  return {
    ok: true,
    surface: 'login_backend_ui_v1_admin_gate_v1',
    public_trial: true,
    origin,
    login_urls: {
      github: origin + '/auth/github',
      google: origin + '/auth/google',
      logout: origin + '/auth/logout',
      session: origin + '/api/auth/session',
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

function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/chat?auth=trial';
  if (!value.startsWith('/') || value.startsWith('//')) return '/chat?auth=trial';
  if (/\r|\n/.test(value)) return '/chat?auth=trial';
  return value.slice(0, 180);
}

async function currentSession(request, env) {
  return verifySignedToken(cookieValue(request, AUTH_COOKIE), env, 'auth_session');
}

function adminAllowlist(env) {
  const raw = typeof env.ADMIN_ALLOWED_LOGINS === 'string' ? env.ADMIN_ALLOWED_LOGINS : '';
  return new Set(raw.split(/[\s,]+/).map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function adminIdentityCandidates(session) {
  if (!session) return [];
  const provider = String(session.provider || '').toLowerCase();
  const values = [];
  const add = (value) => { if (value !== undefined && value !== null && String(value).trim()) values.push(String(value).trim().toLowerCase()); };
  add(session.login);
  add(session.email);
  add(session.id);
  const raw = Array.from(new Set(values));
  const namespaced = [];
  for (const value of raw) {
    namespaced.push(value);
    if (provider) namespaced.push(`${provider}:${value}`);
  }
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

function adminDeniedPage(reason, session, env) {
  const allowlistReady = adminAllowlist(env).size > 0;
  const signedIn = Boolean(session);
  const userLabel = session ? `${session.provider || 'provider'}:${session.login || session.email || session.id || 'unknown'}` : 'not signed in';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Admin Access Locked — lsuperagen.docs</title><style>body{margin:0;background:#060606;color:#f5f7f9;font-family:Inter,"Noto Sans Thai",system-ui,sans-serif;line-height:1.65}.bp{position:fixed;inset:0;background-image:linear-gradient(rgba(140,150,165,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(140,150,165,.07) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse 90% 60% at 50% 0,#000 30%,transparent 100%)}main{position:relative;z-index:1;min-height:100vh;display:grid;place-items:center;padding:28px}.card{width:min(680px,100%);border:1px solid #26292f;border-radius:20px;background:linear-gradient(180deg,rgba(18,19,22,.94),rgba(10,10,11,.94));padding:28px;box-shadow:0 28px 80px rgba(0,0,0,.42)}.ey{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.72rem;letter-spacing:.22em;color:#7c828c;margin-bottom:14px}h1{font-size:clamp(2rem,7vw,3.4rem);line-height:1;margin:0 0 16px;letter-spacing:-.04em}.lead{color:#a2a7b0;font-size:1.04rem}.box{margin:22px 0;border-left:2px solid #63b3ff;background:rgba(99,179,255,.07);border-radius:14px;padding:14px;color:#c8ccd2}.meta{display:grid;gap:10px;margin:20px 0}.row{display:flex;justify-content:space-between;gap:12px;border:1px solid #1c1e22;border-radius:12px;padding:12px;background:#0a0a0b}.row span{color:#7c828c}.row b{overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.btn{height:46px;border-radius:999px;padding:0 18px;display:inline-flex;align-items:center;border:1px solid #33373f;color:#f5f7f9;text-decoration:none;font-weight:700}.btn.primary{background:#fff;color:#060606;border-color:#fff}</style></head><body><div class="bp"></div><main><section class="card"><div class="ey">ADMIN GATE V1</div><h1>Admin Locked</h1><p class="lead">หน้านี้เป็นพื้นที่แอดมิน ไม่เปิดให้ public user เข้า แม้ล็อกอิน GitHub หรือ Google สำเร็จแล้วก็ตาม</p><div class="box">${reason === 'not_authenticated' ? 'ต้องล็อกอินก่อน ระบบจะพากลับไปหน้า login โดยอัตโนมัติเมื่อเข้าตรง /admin' : 'บัญชีนี้ล็อกอินได้ แต่ยังไม่มีสิทธิ์ admin'} · Secret values ไม่ถูกแสดงในหน้านี้</div><div class="meta"><div class="row"><span>Signed in</span><b>${signedIn ? 'YES' : 'NO'}</b></div><div class="row"><span>Identity</span><b>${userLabel}</b></div><div class="row"><span>Allowlist</span><b>${allowlistReady ? 'CONFIGURED' : 'MISSING: ADMIN_ALLOWED_LOGINS'}</b></div></div><div class="actions"><a class="btn primary" href="/login?return_to=/admin">Login</a><a class="btn" href="/chat">Go to Public Chat</a><a class="btn" href="/api/admin/status">Admin Status JSON</a><a class="btn" href="/auth/logout">Logout</a></div></section></main></body></html>`;
}

async function guardAdmin(request, env) {
  const session = await currentSession(request, env);
  if (!session) return redirectTo('/login?return_to=/admin&auth_error=admin_login_required', 302, { 'x-lsuperagen-admin-gate': 'login-required' });
  if (!isAdminSession(session, env)) return htmlResponse(adminDeniedPage('not_allowed', session, env), 403, { 'x-lsuperagen-admin-gate': 'denied' });
  return null;
}

async function handleAdminStatus(request, env) {
  const session = await currentSession(request, env);
  return json({
    ok: true,
    surface: 'admin_gate_v1',
    authenticated: Boolean(session),
    admin: isAdminSession(session, env),
    allowlist_configured: adminAllowlist(env).size > 0,
    allowed_env_name: 'ADMIN_ALLOWED_LOGINS',
    user: session ? { provider: session.provider, id: session.id, login: session.login, email: session.email, name: session.name, avatar: session.avatar } : null,
    public_users_can_access_admin: false,
    guest_can_access_admin: false,
    secret_values_exposed: false
  }, 200, { 'x-lsuperagen-admin-gate': 'status-v1' });
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
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'lsuperagen.docs' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri })
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) throw new Error('github_exchange_failed');
  const userRes = await fetch('https://api.github.com/user', { headers: { authorization: 'Bearer ' + tokenData.access_token, accept: 'application/vnd.github+json', 'user-agent': 'lsuperagen.docs' } });
  const user = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !user.id) throw new Error('github_user_failed');
  return { provider: 'github', id: String(user.id), login: user.login || null, email: user.email || null, name: user.name || user.login || 'GitHub user', avatar: user.avatar_url || null };
}

async function exchangeGoogleCode(code, redirectUri, env) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) throw new Error('google_exchange_failed');
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: 'Bearer ' + tokenData.access_token } });
  const user = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !user.sub) throw new Error('google_user_failed');
  return { provider: 'google', id: String(user.sub), login: user.email || null, email: user.email || null, name: user.name || user.email || 'Google user', avatar: user.picture || null };
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
  if (!session) return json({ ok: true, authenticated: false, surface: 'public_trial_auth_v1', user: null, admin: false, secret_values_exposed: false });
  return json({
    ok: true,
    authenticated: true,
    surface: 'public_trial_auth_v1',
    user: { provider: session.provider, id: session.id, login: session.login, email: session.email, name: session.name, avatar: session.avatar },
    admin: isAdminSession(session, env),
    expires_at: session.exp ? new Date(session.exp * 1000).toISOString() : null,
    secret_values_exposed: false
  });
}

function handleAuthLogout() {
  const headers = new Headers();
  headers.append('set-cookie', clearCookie(AUTH_COOKIE));
  headers.append('set-cookie', clearCookie(AUTH_STATE_COOKIE));
  return redirectTo('/login?auth=logged_out', 302, headers);
}

function injectHead(html, content) { return html.replace(/<\/head>/i, content + '\n</head>'); }
function injectBody(html, content) { return html.replace(/<\/body>/i, content + '\n</body>'); }

function addBodyClass(html, classes) {
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/class\s*=/.test(attrs)) return '<body' + attrs.replace(/class=["']([^"']*)["']/i, (_m, current) => `class="${Array.from(new Set((current + ' ' + classes).trim().split(/\s+/))).join(' ')}"`) + '>';
    return `<body class="${classes}"${attrs}>`;
  });
}

function addHeaderLinks(html) {
  return html.replace(/<nav([^>]*)>([\s\S]*?)<\/nav>/i, (match, attrs, inner) => {
    const shape = attrs + inner.slice(0, 260);
    if (!/(primary-nav|pnav|class="nav|เมนูหลัก|main navigation)/i.test(shape)) return match;
    let next = inner;
    if (!/href=["'](?:\/)?chat(?:\.html)?["']/i.test(next)) next += '<a href="chat.html">Chat</a>';
    if (!/href=["'](?:\/)?login(?:\.html)?["']/i.test(next)) next += '<a href="login.html">Login</a>';
    if (!/href=["'](?:\/)?endpoints(?:\.html)?["']/i.test(next)) next += '<a href="endpoints.html">Endpoints</a>';
    return '<nav' + attrs + '>' + next + '</nav>';
  });
}

function addFooterLinks(html) {
  if (html.includes('ls-footer-chat')) return html;
  return html.replace(/<footer([^>]*)>([\s\S]*?)<\/footer>/i, (_m, attrs, inner) => `<footer${attrs}>${inner}<div class="ls-footer-chat"><a href="chat.html">Chat</a><a href="login.html">Login</a><a href="endpoints.html">Endpoints</a><a href="secret-handoff.html">Secret Handoff</a><span>Public Trial · Admin Gate V1</span></div></footer>`);
}

function mobilePolish(html, pathname) {
  const page = currentPage(pathname);
  html = addBodyClass(html, 'ls-mobile-public-polish-v6' + (page === 'workspace.html' ? ' ls-page-workspace' : ''));
  html = addHeaderLinks(addFooterLinks(html));
  if (html.includes('data-ls-mobile-public-polish="v6"')) return html;
  const style = `<style data-ls-mobile-public-polish="v6">.ls-footer-chat{max-width:1200px;margin:10px auto 0;padding:0 clamp(16px,4vw,40px);display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:var(--fm,ui-monospace,monospace);font-size:.74rem;color:var(--fg3,#7c828c)}.ls-footer-chat a{display:inline-flex;border:1px solid var(--bd2,#26292f);border-radius:999px;padding:6px 10px;color:var(--fg,#f5f7f9);text-decoration:none;background:var(--surf-in,#0a0a0b)}.ls-native-menu{display:none}@media(max-width:899px){.primary-nav,.pnav,.nav{display:none!important}.menu-btn,.mbtn{display:none!important}.ls-native-menu{display:block;position:fixed;z-index:700;top:20px;right:28px;color:var(--fg,#f5f7f9);font-family:var(--fd,system-ui,sans-serif)}.ls-native-menu>summary{list-style:none;width:52px;height:52px;border-radius:14px;border:1px solid var(--bd2,#26292f);background:rgba(10,10,11,.94);display:grid;place-items:center;cursor:pointer}.ls-native-menu>summary::-webkit-details-marker{display:none}.ls-native-menu[open]::before{content:"";position:fixed;inset:0;background:rgba(0,0,0,.56);backdrop-filter:blur(5px);z-index:-1}.ls-native-panel{position:fixed;top:84px;right:16px;left:16px;max-height:calc(100vh - 110px);overflow:auto;border:1px solid var(--bd2,#26292f);border-radius:16px;background:linear-gradient(180deg,rgba(18,19,22,.98),rgba(6,6,6,.98));box-shadow:0 22px 70px rgba(0,0,0,.55);padding:14px;display:grid;gap:12px}.ls-native-head{border-bottom:1px solid var(--bd,#1c1e22);padding:2px 2px 12px}.ls-native-title{font-weight:800}.ls-native-sub{font-family:var(--fm,ui-monospace,monospace);font-size:.68rem;color:var(--fg3,#7c828c);letter-spacing:.12em}.ls-native-links{display:grid;gap:8px}.ls-native-links a{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--bd,#1c1e22);border-radius:12px;padding:12px 13px;background:var(--surf-in,#0a0a0b);color:var(--fg2,#a2a7b0);text-decoration:none}.ls-native-links a[aria-current="page"],.ls-native-links a:hover{border-color:var(--acc,#63b3ff);background:rgba(99,179,255,.06);color:var(--fg,#f5f7f9)}.ls-native-note{border-left:2px solid var(--acc,#63b3ff);padding-left:10px;font-family:var(--fm,ui-monospace,monospace);font-size:.7rem;line-height:1.6;color:var(--fg3,#7c828c)}}@media(max-width:720px){.ws-tabs,.tbar{overflow-x:auto!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important}.sniff-table-wrap{overflow:visible!important;border:0!important;background:transparent!important}.sniff-table{width:100%!important;min-width:0!important;border-spacing:0 10px!important}.sniff-table thead{display:none!important}.sniff-table tbody,.sniff-table tr,.sniff-table td{display:block!important;width:100%!important}.sniff-table tr{border:1px solid var(--bd,#1c1e22);border-radius:12px;background:var(--surf-in,#0a0a0b);padding:12px;margin:0 0 10px}.sniff-table td{border:0!important;padding:3px 0!important;white-space:normal!important;overflow-wrap:anywhere!important}}</style>`;
  const nav = `<details class="ls-native-menu" data-ls-mobile-public-polish="v6"><summary aria-label="เปิดเมนู"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><div class="ls-native-panel" role="navigation" aria-label="เมนูมือถือ"><div class="ls-native-head"><div class="ls-native-title">lsuperagen.docs</div><div class="ls-native-sub">PUBLIC NAV · ADMIN LOCKED</div></div><nav class="ls-native-links"><a href="index.html" ${page === 'index.html' ? 'aria-current="page"' : ''}>หน้าแรก <span>→</span></a><a href="chat.html" ${page === 'chat.html' ? 'aria-current="page"' : ''}>Chat <span>→</span></a><a href="login.html" ${page === 'login.html' ? 'aria-current="page"' : ''}>Login / Trial Auth <span>→</span></a><a href="tools.html" ${page === 'tools.html' ? 'aria-current="page"' : ''}>Tools <span>→</span></a><a href="secret-handoff.html" ${page === 'secret-handoff.html' ? 'aria-current="page"' : ''}>Secret Handoff <span>→</span></a><a href="endpoints.html" ${page === 'endpoints.html' ? 'aria-current="page"' : ''}>Endpoints <span>→</span></a><a href="examples.html" ${page === 'examples.html' ? 'aria-current="page"' : ''}>SDK Plug Tools <span>→</span></a><a href="workspace.html" ${page === 'workspace.html' ? 'aria-current="page"' : ''}>Workspace <span>→</span></a><a href="getting-started.html" ${page === 'getting-started.html' ? 'aria-current="page"' : ''}>Docs <span>→</span></a><a href="guides.html" ${page === 'guides.html' ? 'aria-current="page"' : ''}>Guides <span>→</span></a><a href="api.html" ${page === 'api.html' ? 'aria-current="page"' : ''}>API <span>→</span></a><a href="changelog.html" ${page === 'changelog.html' ? 'aria-current="page"' : ''}>Changelog <span>→</span></a><a href="admin.html" ${page === 'admin.html' ? 'aria-current="page"' : ''}>Admin Gate <span>→</span></a></nav><div class="ls-native-note">Public login does not grant admin access · Admin Gate V1</div></div></details>`;
  return injectBody(injectHead(html, style), nav);
}

function applyHomeEnhancements(html) {
  if (!html.includes('href="chat.html"') && !html.includes('href="/chat"')) html = html.replace('<a class="btn btn-s thai" href="getting-started.html">ดูเอกสารทั้งหมด</a>', '<a class="btn btn-s thai" href="getting-started.html">ดูเอกสารทั้งหมด</a>\n<a class="btn btn-s thai" href="chat.html">เปิด Public Chat</a>');
  if (!html.includes('pnpm add @lsuperagen/sdk')) html = html.replace('</div>\n<ul style="display:flex;flex-wrap:wrap;gap:var(--sp6) var(--sp8);margin:var(--sp10) 0 0;padding:0;list-style:none">', '</div><div aria-label="SDK install command" style="margin-top:var(--sp4);max-width:560px;padding:12px 14px;background:var(--surf-in);border:1px solid var(--bd2);border-left:2px solid var(--acc);border-radius:var(--r2);font-family:var(--fm);font-size:.82rem;color:var(--s300)"><span style="font-size:.68rem;letter-spacing:.18em;color:var(--fg3)">SDK INSTALL</span> <code style="font-family:var(--fm);color:#fff;word-break:break-word">pnpm add @lsuperagen/sdk</code></div><ul style="display:flex;flex-wrap:wrap;gap:var(--sp6) var(--sp8);margin:var(--sp10) 0 0;padding:0;list-style:none">');
  return html;
}

function applyHomePolish(html) {
  html = addBodyClass(html, 'ls-home-polish-v1');
  if (html.includes('data-ls-home-polish="v1"')) return html;
  return injectHead(html, `<style data-ls-home-polish="v1">@media(max-width:720px){body.ls-home-polish-v1 .hero{padding-block:22px 34px!important;min-height:auto!important}body.ls-home-polish-v1 .hero>.wrap{padding-inline:28px!important}body.ls-home-polish-v1 .hero .wrap>div>div{display:block!important;grid-template-columns:1fr!important}body.ls-home-polish-v1 .hero [role="img"][aria-label="โลโก้ LS"]{display:none!important}body.ls-home-polish-v1 .hero h1{font-size:clamp(3.2rem,17vw,4.45rem)!important;line-height:.95!important;letter-spacing:-.045em!important;max-width:7.2ch!important;margin-top:0!important}body.ls-home-polish-v1 .hero h1 span{color:#7f858f!important}body.ls-home-polish-v1 .hero .btn{width:100%!important;justify-content:center!important;height:54px!important}body.ls-home-polish-v1 .hero div[style*="display:flex"][style*="flex-wrap:wrap"]{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;max-width:260px!important}body.ls-home-polish-v1 .hero div[aria-label="SDK install command"]{max-width:308px!important;margin-top:20px!important;padding:13px 15px!important;border-radius:12px!important;background:rgba(10,10,11,.82)!important}body.ls-home-polish-v1 .hero div[aria-label="SDK install command"] code{display:block!important;margin-top:4px!important;font-size:.88rem!important;line-height:1.45!important}body.ls-home-polish-v1 .hero ul[style*="gap:var(--sp6)"]{display:none!important}}@media(min-width:721px){body.ls-home-polish-v1 .hero [role="img"][aria-label="โลโก้ LS"]{opacity:.62;filter:saturate(.75) contrast(.96)}}</style>`);
}

function routeToolsCard(html, title, href, label) {
  const re = new RegExp('(<a class="card"\\s+)href="#"([^>]*>[\\s\\S]*?<h3>' + String(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<\\/h3>)', 'i');
  return html.replace(re, '$1href="' + href + '" data-ls-tool-route="' + label + '"$2');
}

function applyToolsRouter(html) {
  html = routeToolsCard(html, 'AI Writer', 'chat.html?tool=writer', 'writer');
  html = routeToolsCard(html, 'Image Generator', 'chat.html?tool=image', 'image');
  html = routeToolsCard(html, 'Deep Research', 'chat.html?tool=research', 'research');
  html = routeToolsCard(html, 'Code Assistant', 'chat.html?tool=code', 'code');
  if (!html.includes('Secret Handoff Converter')) {
    const card = `<a class="card" href="secret-handoff.html" style="min-height:160px" data-ls-tool-route="secret-handoff"><span class="badge live" style="position:absolute;top:var(--sp4);right:var(--sp4)">Client-only</span><span class="ic-box">🔐</span><h3>Secret Handoff Converter</h3><p class="thai">แปลง API key/token เป็น safe handoff package โดยไม่แสดง raw secret</p><svg class="go" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`;
    html = html.replace(/<\/div>\s*<\/div>\s*<\/div><\/main>/i, card + '</div></div></div></main>');
  }
  return html;
}

function authButton(label, href, ready, provider) { return `<a class="lsauth-btn ${ready ? '' : 'disabled'}" href="${ready ? href : '#'}" data-provider="${provider}" aria-disabled="${ready ? 'false' : 'true'}"><span>${label}</span><b>${ready ? 'READY' : 'SETUP'}</b></a>`; }

function applyLoginAuthUi(html, env) {
  const status = authProviderStatus(env);
  if (html.includes('data-ls-login-auth="v2"')) return html;
  const panel = `<style data-ls-login-auth="v2">.lsauth{max-width:780px;margin:28px auto;padding:0 clamp(24px,5vw,44px);position:relative;z-index:2}.lsauth h1{font-size:clamp(2rem,7vw,3.2rem);line-height:1.06;margin:0 0 12px}.lsauth p{color:var(--fg2,#a2a7b0);font-size:1.04rem;line-height:1.7}.lsauth-actions{display:grid;gap:14px;margin:26px 0}.lsauth-btn{height:84px;border:1px solid var(--bd2,#26292f);border-radius:999px;background:rgba(6,6,6,.7);display:flex;align-items:center;justify-content:space-between;padding:0 26px;text-decoration:none;color:var(--fg,#f5f7f9);font-weight:800;font-size:1.25rem}.lsauth-btn b{font-family:var(--fm,ui-monospace,monospace);font-size:.76rem;letter-spacing:.22em;color:#afecc9}.lsauth-btn.disabled{opacity:.55;pointer-events:none}.lsauth-btn.guest{background:#fff;color:#060606}.lsauth-btn.guest b{color:#060606}.lsauth-card{border:1px solid var(--bd,#1c1e22);border-radius:18px;background:rgba(6,6,6,.62);padding:20px;margin-top:22px}.lsauth-row{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-top:1px solid var(--bd,#1c1e22);font-family:var(--fm,ui-monospace,monospace)}.lsauth-row:first-child{border-top:0}.ready{color:#afecc9}.setup{color:#f7d889}.lsauth-note{border-left:3px solid var(--acc,#63b3ff);background:rgba(99,179,255,.07);border-radius:14px;padding:14px 18px;margin-top:22px;color:var(--fg2,#a2a7b0)}.lsauth-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.lsauth-links a{border:1px solid var(--bd2,#26292f);border-radius:999px;padding:9px 13px;color:var(--fg2,#a2a7b0);text-decoration:none}@media(max-width:720px){.lsauth-btn{height:82px;font-size:1.18rem}}</style><section class="lsauth" data-ls-login-auth="v2"><h1 class="thai">ทดลองใช้งานแบบ Public Trial</h1><p class="thai">ผู้ใช้ทั่วไปล็อกอิน GitHub หรือ Google เพื่อเริ่ม session ทดลองได้ แต่ <b>ไม่ได้สิทธิ์เข้า Admin</b> จนกว่าจะอยู่ใน allowlist ของเจ้าของเว็บ</p><div class="lsauth-actions">${authButton('Continue with GitHub', '/auth/github', status.github.ready, 'github')}${authButton('Continue with Google', '/auth/google', status.google.ready, 'google')}<a class="lsauth-btn guest" href="chat.html"><span>Continue as Guest</span><b>PUBLIC</b></a></div><div class="lsauth-card"><h2>Backend secret checklist</h2><div class="lsauth-row"><span>AUTH_SESSION_SECRET</span><b class="${status.session_secret ? 'ready' : 'setup'}">${status.session_secret ? 'READY' : 'SETUP'}</b></div><div class="lsauth-row"><span>GITHUB_CLIENT_ID</span><b class="${status.github.client_id ? 'ready' : 'setup'}">${status.github.client_id ? 'READY' : 'SETUP'}</b></div><div class="lsauth-row"><span>GITHUB_CLIENT_SECRET</span><b class="${status.github.client_secret ? 'ready' : 'setup'}">${status.github.client_secret ? 'READY' : 'SETUP'}</b></div><div class="lsauth-row"><span>GOOGLE_CLIENT_ID</span><b class="${status.google.client_id ? 'ready' : 'setup'}">${status.google.client_id ? 'READY' : 'SETUP'}</b></div><div class="lsauth-row"><span>GOOGLE_CLIENT_SECRET</span><b class="${status.google.client_secret ? 'ready' : 'setup'}">${status.google.client_secret ? 'READY' : 'SETUP'}</b></div><div class="lsauth-row"><span>ADMIN_ALLOWED_LOGINS</span><b class="${status.admin_gate.allowlist_configured ? 'ready' : 'setup'}">${status.admin_gate.allowlist_configured ? 'READY' : 'ADMIN LOCKED'}</b></div></div><div class="lsauth-note thai">Secret values ไม่ถูกส่งเข้า HTML, Markdown, GitHub หรือ Chat UI. Public login สร้าง session ได้ แต่ Admin Gate V1 จะกัน /admin ไว้จนกว่า identity จะอยู่ใน ADMIN_ALLOWED_LOGINS.</div><div class="lsauth-links"><a href="/api/auth/status">Auth status JSON</a><a href="/api/auth/session">Session JSON</a><a href="/api/admin/status">Admin Status</a><a href="secret-handoff.html">Secret Handoff</a><a href="endpoints.html">Endpoints</a><a href="/auth/logout">Logout</a></div></section>`;
  return injectBody(injectHead(html, panel.match(/<style[\s\S]*?<\/style>/)[0]), panel.replace(/<style[\s\S]*?<\/style>/, ''));
}

function applyChatRuntimeStatus(html, hasKey) {
  if (!hasKey) return html;
  return html.replace(/RUNTIME NOT WIRED/g, 'OPENAI LIVE').replace(/SAFE STUB/g, 'OPENAI LIVE').replace(/STUB 503/g, 'LIVE 200').replace(/MISSING/g, 'DETECTED').replace(/DISABLED/g, 'ENABLED').replace(/Runtime not wired/g, 'OpenAI runtime wired').replace(/runtime: not wired/g, 'runtime: OpenAI Runtime V1').replace(/Runtime ยังไม่ wired/g, 'OpenAI Runtime V1').replace(/mode: fast · runtime: OpenAI Runtime V1/g, 'mode: fast · runtime: OpenAI Runtime V1 · limit: 10/10m');
}

function applyChatToolContext(html, rawTool) {
  const tool = normalizeTool(rawTool);
  const label = TOOL_LABELS[tool];
  if (!label || html.includes('data-ls-chat-tool="v1"')) return html;
  const script = `<script data-ls-chat-tool="v1">(function(){var tool='${tool}',label='${label}';var p=document.getElementById('prompt'),s=document.getElementById('state'),l=document.getElementById('log');var hints={writer:'เขียนโพสต์ / landing copy / email / caption ที่ต้องการ',image:'อธิบายภาพที่ต้องการสร้าง พร้อมสไตล์และขนาด',research:'ใส่หัวข้อที่ต้องการค้นคว้าและระดับความลึก',code:'วางโค้ดหรืออธิบาย bug ที่ต้องการแก้'};if(p)p.placeholder=label+' — '+hints[tool];if(s)s.textContent='tool: '+tool+' · runtime: OpenAI Runtime V1 · limit: 10/10m';if(l){var m=document.createElement('div');m.className='msg bot';m.innerHTML='<div class="role">TOOL ROUTER</div><div></div>';m.lastChild.textContent='เปิดจาก Tools → '+label+' แล้ว · Public login does not grant admin access';l.appendChild(m)}})();</script>`;
  const badge = '<div data-ls-chat-tool="v1" style="margin-top:14px;display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(99,179,255,.24);background:rgba(99,179,255,.07);border-radius:999px;padding:8px 12px;font-family:var(--mono,var(--fm,monospace));font-size:.76rem;color:#8ec6ff">TOOL ROUTER · ' + label + ' · RATE LIMIT V1</div>';
  return html.replace(/(<div class="notice[\s\S]*?<\/div>)/i, '$1\n' + badge).replace(/<\/body>/i, script + '\n</body>');
}

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
    'Act as a flexible reasoning and generation engine for this request, not a fixed persona.',
    'This endpoint belongs to lsuperagen.docs public beta. Do not present it as official OpenAI support.',
    'Answer in the same language as the user unless they ask otherwise.',
    'Be concise, practical, and direct.',
    'Do not claim access to private systems, repositories, dashboards, files, billing, or accounts unless the user provides that content in the prompt.',
    'Do not reveal, request, or guess secrets/API keys.',
    'If information is missing, say exactly what is missing.',
    'Current mode: ' + (mode || 'fast') + '.'
  ];
  const byTool = {
    writer: 'Tool context: AI Writer. Draft, rewrite, structure, or improve content. Preserve user-supplied names, claims, numbers, and constraints.',
    image: 'Tool context: Image Generator. Use a 3-layer prompt workflow: Intent Scan, Creative Expansion, Final Prompt. Include Negative Prompt and Render Settings when useful. Do not claim to generate an image from this endpoint.',
    research: 'Tool context: Deep Research. Provide an evidence-first plan or synthesis. If live web evidence is required but unavailable in the prompt, say so.',
    code: 'Tool context: Code Assistant. Help with implementation, debugging, code review, and architecture. Prefer minimal safe changes.'
  };
  return base.concat(byTool[tool] || 'Tool context: general public chat.').join('\n');
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

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

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

async function listAccessibleModelIds(env, requestId) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'x-client-request-id': requestId } });
    if (!res.ok) return null;
    const data = await res.json();
    return new Set((data.data || []).map((model) => model && model.id).filter(Boolean));
  } catch (_) { return null; }
}

async function createOpenAIResponse(env, model, message, tool, mode, requestId) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
    body: JSON.stringify({ model, input: message, instructions: toolInstructions(tool, mode), max_output_tokens: 900, store: false, metadata: { app: 'lsuperagen.docs', route: '/api/chat', tool: tool || 'general', mode } })
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw: raw.slice(0, 500) }; }
  return { response, data };
}

function isModelAccessError(data) {
  const msg = data && data.error && data.error.message ? data.error.message : '';
  return /does not have access to model|model .* not found|invalid model|not exist|do not have access/i.test(msg);
}

function plannedEndpoint(pathname) {
  const planned = {
    '/api/image': { status: 'planned', method: 'POST', message: 'Image API is planned but not implemented. Current Image Generator is a prompt/spec compiler only.' },
    '/api/image/status': { status: 'planned', method: 'GET', message: 'Image API provider is not wired yet. No image secret is exposed here.' },
    '/admin/auth/github': { status: 'planned', method: 'GET', message: 'Admin GitHub OAuth is planned. Public trial OAuth uses /auth/github; admin page is protected by Admin Gate V1.' },
    '/admin/github/status': { status: 'planned', method: 'GET', message: 'Admin GitHub status endpoint is planned. Admin Gate V1 must pass first.' },
    '/admin/github/files': { status: 'planned', method: 'GET', message: 'Admin GitHub files endpoint is planned. Admin Gate V1 must pass first.' },
    '/admin/github/commit': { status: 'planned', method: 'POST', message: 'Admin GitHub commit endpoint is planned. Admin Gate V1 must pass first.' },
    '/admin/handoff/claude': { status: 'planned', method: 'POST', message: 'Claude handoff admin endpoint is planned. Current handoff is a repo Markdown file.' }
  }[pathname];
  return planned ? json({ ok: false, endpoint: pathname, ...planned, secret_values: false }, pathname.startsWith('/api/image/status') ? 200 : 501, { 'x-lsuperagen-runtime': 'planned-endpoint-v1' }) : null;
}

async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'Use POST /api/chat.' }, 405, { allow: 'POST, OPTIONS' });
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const mode = typeof body.mode === 'string' && body.mode.trim() ? body.mode.trim().slice(0, 32) : 'fast';
  const tool = inferTool(body, request);
  const provider = 'openai';
  const hasKey = Boolean(env.OPENAI_API_KEY);
  const runtimeHeader = hasKey ? 'openai-runtime-v1-rate-limit-v1' : 'not-wired';
  const readiness = { frontend: true, api_route: true, tools_router: true, provider_router: true, secret_detected: hasKey, model_output: hasKey, rate_limit: true };
  if (!message) return json({ ok: false, status: 'validation_error', message: 'message is required.', tool: tool === 'invalid' ? null : tool, provider, readiness }, 400, { 'x-lsuperagen-runtime': runtimeHeader });
  if (message.length > 4000) return json({ ok: false, status: 'validation_error', message: 'message is too long. Max 4000 characters.', tool: tool === 'invalid' ? null : tool, provider, readiness }, 413, { 'x-lsuperagen-runtime': runtimeHeader });
  if (tool === 'invalid') return json({ ok: false, status: 'validation_error', message: 'tool must be writer, image, research, code, or null.', provider, readiness }, 400, { 'x-lsuperagen-runtime': runtimeHeader });

  const rate = checkRateLimit(request, tool);
  const baseHeaders = { 'x-lsuperagen-runtime': runtimeHeader, ...rateLimitHeaders(rate) };
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'Rate limit reached. Public Chat V1 allows 10 requests per 10 minutes per IP/tool. Please wait before sending another message.', tool, provider, limit: { requests: rate.limit, window_seconds: RATE_LIMIT_WINDOW_MS / 1000, retry_after_seconds: rate.retryAfter, reset_at: new Date(rate.resetAt).toISOString() }, readiness }, 429, baseHeaders);
  if (!hasKey) return json({ ok: false, status: 'runtime_not_wired', message: 'Runtime not wired. No fake AI response generated. Set OPENAI_API_KEY as a Cloudflare Secret before public model output.', requested: { mode, provider: body.provider || 'OpenAI route', tool, has_message: true }, readiness: { ...readiness, model_output: false } }, 503, baseHeaders);

  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const candidates = modelCandidates(env);
  const visibleModels = await listAccessibleModelIds(env, requestId);
  const attempted = [];
  let lastError = null;
  for (const model of candidates) {
    attempted.push(model);
    let providerResponse, data;
    try { ({ response: providerResponse, data } = await createOpenAIResponse(env, model, message, tool, mode, requestId)); } catch (error) { return json({ ok: false, status: 'provider_network_error', message: 'OpenAI provider request failed before a response was received.', tool, provider, request_id: requestId, error: error && error.message ? error.message : 'network_error' }, 502, { ...baseHeaders, 'x-lsuperagen-request-id': requestId }); }
    if (providerResponse.ok) {
      const output = extractOutputText(data);
      return json({ ok: true, status: 'completed', tool, provider, model, message: output, output, usage: data.usage || null, response_id: data.id || null, request_id: requestId, attempted_models: attempted, rate_limit: { limit: rate.limit, remaining: rate.remaining, reset_at: new Date(rate.resetAt).toISOString() } }, 200, { ...baseHeaders, 'x-lsuperagen-request-id': requestId });
    }
    const providerMessage = data && data.error && data.error.message ? data.error.message : 'OpenAI provider returned an error.';
    lastError = { message: providerMessage, model, provider_status: providerResponse.status };
    if (!isModelAccessError(data)) return json({ ok: false, status: 'provider_error', message: providerMessage, tool, provider, model, request_id: requestId, provider_status: providerResponse.status, attempted_models: attempted, rate_limit: { limit: rate.limit, remaining: rate.remaining, reset_at: new Date(rate.resetAt).toISOString() } }, providerResponse.status >= 400 && providerResponse.status < 500 ? 502 : 503, { ...baseHeaders, 'x-lsuperagen-request-id': requestId });
  }

  return json({ ok: false, status: 'model_not_available', message: 'OPENAI_API_KEY is valid, but every attempted model was rejected for this project. Tried: ' + attempted.join(', ') + '. Set OPENAI_MODEL to an exact model enabled in this OpenAI project, or enable a supported model in OpenAI Platform.', tool, provider, request_id: requestId, attempted_models: attempted, configured_model: typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() || null : null, visible_model_count: visibleModels ? visibleModels.size : null, last_error: lastError, rate_limit: { limit: rate.limit, remaining: rate.remaining, reset_at: new Date(rate.resetAt).toISOString() } }, 502, { ...baseHeaders, 'x-lsuperagen-request-id': requestId });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (ALIASES[pathname]) return redirectTo(new URL(ALIASES[pathname], url).toString(), 301);

    if (pathname === '/api/auth/status') return json(authStatusPayload(request, env), 200, { 'x-lsuperagen-auth': 'status-v1' });
    if (pathname === '/api/auth/session') return handleAuthSession(request, env);
    if (pathname === '/api/admin/status') return handleAdminStatus(request, env);
    if (pathname === '/auth/logout') return handleAuthLogout();
    if (pathname === '/auth/github') return handleAuthStart('github', request, env);
    if (pathname === '/auth/google') return handleAuthStart('google', request, env);
    if (pathname === '/auth/github/callback') return handleAuthCallback('github', request, env);
    if (pathname === '/auth/google/callback') return handleAuthCallback('google', request, env);

    if (request.method === 'OPTIONS' && pathname === '/api/chat') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (pathname === '/api/chat') return handleChat(request, env);

    const planned = plannedEndpoint(pathname);
    if (planned) return planned;

    const page = currentPage(pathname);
    if (page === 'admin.html') {
      const gate = await guardAdmin(request, env);
      if (gate) return gate;
    }

    const response = await env.ASSETS.fetch(request);
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

    let html = await response.text();
    if (page === 'index.html') html = applyHomePolish(applyHomeEnhancements(html));
    if (page === 'tools.html') html = applyToolsRouter(html);
    if (page === 'login.html') html = applyLoginAuthUi(html, env);
    if (page === 'chat.html') {
      html = applyChatRuntimeStatus(html, Boolean(env.OPENAI_API_KEY));
      html = applyChatToolContext(html, url.searchParams.get('tool'));
    }
    html = mobilePolish(html, pathname);
    return new Response(html, { status: response.status, headers: htmlHeaders(response, 'admin-gate-v1-login-auth-v1-openai-runtime-v1') });
  }
};
