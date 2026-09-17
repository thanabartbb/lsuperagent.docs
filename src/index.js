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

const TOOL_LABELS = { writer: 'AI Writer', image: 'Image Generator', research: 'Deep Research', code: 'Code Assistant' };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

function redirectTo(location, status = 302, extraHeaders = {}) {
  const headers = extraHeaders instanceof Headers ? new Headers(extraHeaders) : new Headers(extraHeaders);
  headers.set('location', location);
  headers.set('cache-control', 'no-store');
  return new Response(null, { status, headers });
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

function injectHead(html, content) { return html.replace(/<\/head>/i, content + '\n</head>'); }
function injectBody(html, content) { return html.replace(/<\/body>/i, content + '\n</body>'); }

function addBodyClass(html, classes) {
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/class\s*=/.test(attrs)) return '<body' + attrs.replace(/class=["']([^"']*)["']/i, (_m, current) => `class="${Array.from(new Set((current + ' ' + classes).trim().split(/\s+/))).join(' ')}"`) + '>';
    return `<body class="${classes}"${attrs}>`;
  });
}

function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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
  return html.replace(/<footer([^>]*)>([\s\S]*?)<\/footer>/i, (_m, attrs, inner) => `<footer${attrs}>${inner}<div class="ls-footer-chat"><a href="chat.html">Chat</a><a href="login.html">Login</a><a href="endpoints.html">Endpoints</a><a href="secret-handoff.html">Secret Handoff</a><span>Public Chat V1 · Login Auth Surface V1</span></div></footer>`);
}

function mobilePolish(html, pathname) {
  const page = currentPage(pathname);
  html = addBodyClass(html, 'ls-mobile-public-polish-v5' + (page === 'workspace.html' ? ' ls-page-workspace' : ''));
  html = addHeaderLinks(addFooterLinks(html));
  if (html.includes('data-ls-mobile-public-polish="v5"')) return html;
  const style = `<style data-ls-mobile-public-polish="v5">
.ls-footer-chat{max-width:1200px;margin:10px auto 0;padding:0 clamp(16px,4vw,40px);display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.74rem;color:var(--fg3,var(--fg-muted,#7c828c))}.ls-footer-chat a{display:inline-flex;align-items:center;border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:999px;padding:6px 10px;color:var(--fg,var(--fg-primary,#f5f7f9));text-decoration:none;background:var(--surf-in,var(--surface-inset,#0a0a0b))}.ls-native-menu{display:none}
@media(max-width:899px){.primary-nav,.pnav,.nav{display:none!important}.menu-btn,.mbtn{display:none!important}.ls-native-menu{display:block;position:fixed;z-index:700;top:20px;right:28px;color:var(--fg,var(--fg-primary,#f5f7f9));font-family:var(--fd,var(--font-body,"Inter","Noto Sans Thai",system-ui,sans-serif))}.ls-native-menu>summary{list-style:none;width:52px;height:52px;border-radius:14px;border:1px solid var(--bd2,var(--border-default,#26292f));background:rgba(10,10,11,.94);box-shadow:0 10px 28px rgba(0,0,0,.24);backdrop-filter:blur(14px);display:grid;place-items:center;cursor:pointer}.ls-native-menu>summary::-webkit-details-marker{display:none}.ls-native-menu[open]>summary{background:rgba(35,82,105,.92);border-color:rgba(99,179,255,.35)}.ls-native-menu[open]::before{content:"";position:fixed;inset:0;background:rgba(0,0,0,.56);backdrop-filter:blur(5px);z-index:-1}.ls-native-panel{position:fixed;top:84px;right:16px;left:16px;max-height:calc(100vh - 110px);overflow:auto;border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:16px;background:linear-gradient(180deg,rgba(18,19,22,.98),rgba(6,6,6,.98));box-shadow:0 22px 70px rgba(0,0,0,.55);padding:14px;display:grid;gap:12px}.ls-native-head{border-bottom:1px solid var(--bd,var(--border-subtle,#1c1e22));padding:2px 2px 12px}.ls-native-title{font-weight:800;letter-spacing:-.02em}.ls-native-sub{font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.68rem;color:var(--fg3,var(--fg-muted,#7c828c));letter-spacing:.12em;margin-top:2px}.ls-native-links{display:grid;gap:8px}.ls-native-links a{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--bd,var(--border-subtle,#1c1e22));border-radius:12px;padding:12px 13px;background:var(--surf-in,var(--surface-inset,#0a0a0b));color:var(--fg2,var(--fg-secondary,#a2a7b0));text-decoration:none}.ls-native-links a[aria-current="page"],.ls-native-links a:hover{border-color:var(--acc,#63b3ff);background:rgba(99,179,255,.06);color:var(--fg,var(--fg-primary,#f5f7f9))}.ls-native-note{border-left:2px solid var(--acc,#63b3ff);padding-left:10px;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.7rem;line-height:1.6;color:var(--fg3,var(--fg-muted,#7c828c))}}
@media(max-width:720px){.ws-tabs,.tbar{overflow-x:auto!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important}.sniff-table-wrap{overflow:visible!important;border:0!important;background:transparent!important}.sniff-table{width:100%!important;min-width:0!important;border-spacing:0 10px!important}.sniff-table thead{display:none!important}.sniff-table tbody,.sniff-table tr,.sniff-table td{display:block!important;width:100%!important}.sniff-table tr{border:1px solid var(--border-subtle,var(--bd,#1c1e22));border-radius:12px;background:var(--surface-inset,var(--surf-in,#0a0a0b));padding:12px;margin:0 0 10px}.sniff-table td{border:0!important;padding:3px 0!important;white-space:normal!important;overflow-wrap:anywhere!important}.sniff-table td:nth-child(4)::before{content:"Evidence: ";display:block;margin-top:4px;font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(4){margin-top:4px;padding-top:8px!important;border-top:1px solid var(--border-subtle,var(--bd,#1c1e22))!important}}
</style>`;
  const nav = `<details class="ls-native-menu" data-ls-mobile-public-polish="v5"><summary aria-label="เปิดเมนู"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><div class="ls-native-panel" role="navigation" aria-label="เมนูมือถือ"><div class="ls-native-head"><div class="ls-native-title">lsuperagen.docs</div><div class="ls-native-sub">PUBLIC NAV</div></div><nav class="ls-native-links"><a href="index.html" ${page === 'index.html' ? 'aria-current="page"' : ''}>หน้าแรก <span>→</span></a><a href="chat.html" ${page === 'chat.html' ? 'aria-current="page"' : ''}>Chat <span>→</span></a><a href="login.html" ${page === 'login.html' ? 'aria-current="page"' : ''}>Login / Trial Auth <span>→</span></a><a href="tools.html" ${page === 'tools.html' ? 'aria-current="page"' : ''}>Tools <span>→</span></a><a href="secret-handoff.html" ${page === 'secret-handoff.html' ? 'aria-current="page"' : ''}>Secret Handoff <span>→</span></a><a href="endpoints.html" ${page === 'endpoints.html' ? 'aria-current="page"' : ''}>Endpoints <span>→</span></a><a href="examples.html" ${page === 'examples.html' ? 'aria-current="page"' : ''}>SDK Plug Tools <span>→</span></a><a href="workspace.html" ${page === 'workspace.html' ? 'aria-current="page"' : ''}>Workspace <span>→</span></a><a href="getting-started.html" ${page === 'getting-started.html' ? 'aria-current="page"' : ''}>Docs <span>→</span></a><a href="guides.html" ${page === 'guides.html' ? 'aria-current="page"' : ''}>Guides <span>→</span></a><a href="api.html" ${page === 'api.html' ? 'aria-current="page"' : ''}>API <span>→</span></a><a href="changelog.html" ${page === 'changelog.html' ? 'aria-current="page"' : ''}>Changelog <span>→</span></a><a href="admin.html" ${page === 'admin.html' ? 'aria-current="page"' : ''}>Admin <span>→</span></a></nav><div class="ls-native-note">Mobile Public Polish V5 · Login Auth Surface V1 · Endpoint Surface V1</div></div></details>`;
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
  const re = new RegExp('(<a class="card"\\s+)href="#"([^>]*>[\\s\\S]*?<h3>' + escapeRegExp(title) + '<\\/h3>)', 'i');
  return html.replace(re, '$1href="' + href + '" data-ls-tool-route="' + label + '"$2');
}

function applyToolsRouter(html) {
  html = routeToolsCard(html, 'AI Writer', 'chat.html?tool=writer', 'writer');
  html = routeToolsCard(html, 'Image Generator', 'chat.html?tool=image', 'image');
  html = routeToolsCard(html, 'Deep Research', 'chat.html?tool=research', 'research');
  html = routeToolsCard(html, 'Code Assistant', 'chat.html?tool=code', 'code');
  if (html.includes('data-ls-tools-router="v2"') || html.includes('TOOLS SURFACE V2')) return html;
  const style = '<style data-ls-tools-router="v2">.ls-coming-soon-toast{position:fixed;left:16px;right:16px;bottom:88px;z-index:900;display:none;max-width:520px;margin:auto;padding:14px 16px;border-radius:14px;border:1px solid rgba(247,201,106,.28);background:rgba(14,12,8,.96);box-shadow:0 16px 44px rgba(0,0,0,.45);color:var(--fg2,#a2a7b0);line-height:1.55}.ls-coming-soon-toast.show{display:block}.ls-coming-soon-toast b{display:block;color:#f7c96a;font-family:var(--fm,monospace);font-size:.72rem;letter-spacing:.12em;margin-bottom:4px}[data-ls-tool-route]{border-color:rgba(99,179,255,.22)!important}</style>';
  const toast = '<div id="ls-coming-soon-toast" class="ls-coming-soon-toast" role="status" aria-live="polite"><b>COMING SOON</b><span>เครื่องมือนี้ยังไม่เปิดใน Public Chat V1 — ตอนนี้เปิดใช้ก่อนเฉพาะ AI Writer, Image Generator, Deep Research, Code Assistant และ Secret Handoff</span></div>';
  const script = '<script data-ls-tools-router="v2">(function(){var t=document.getElementById("ls-coming-soon-toast");document.addEventListener("click",function(e){var a=e.target.closest("a.card[href=\\\"#\\\"]");if(!a)return;e.preventDefault();if(t){t.classList.add("show");setTimeout(function(){t.classList.remove("show")},3600)}})})();</script>';
  return injectBody(injectHead(html, style), toast + '\n' + script);
}

function truthySecret(env, name) { return typeof env[name] === 'string' && env[name].trim().length > 0; }

function authProviderStatus(env) {
  const sessionSecret = truthySecret(env, 'AUTH_SESSION_SECRET');
  const github = { provider: 'github', client_id: truthySecret(env, 'GITHUB_CLIENT_ID'), client_secret: truthySecret(env, 'GITHUB_CLIENT_SECRET'), ready: sessionSecret && truthySecret(env, 'GITHUB_CLIENT_ID') && truthySecret(env, 'GITHUB_CLIENT_SECRET') };
  const google = { provider: 'google', client_id: truthySecret(env, 'GOOGLE_CLIENT_ID'), client_secret: truthySecret(env, 'GOOGLE_CLIENT_SECRET'), ready: sessionSecret && truthySecret(env, 'GOOGLE_CLIENT_ID') && truthySecret(env, 'GOOGLE_CLIENT_SECRET') };
  return { status: github.ready || google.ready ? 'partially_configured' : 'not_configured', mode: 'public_trial_auth_v1', session_secret: sessionSecret, github, google, expected_secrets: ['AUTH_SESSION_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], optional_variables: ['PUBLIC_SITE_URL'], secret_values_exposed: false };
}

function publicOrigin(url, env) { try { if (typeof env.PUBLIC_SITE_URL === 'string' && env.PUBLIC_SITE_URL.trim()) return new URL(env.PUBLIC_SITE_URL.trim()).origin; } catch (_) {} return url.origin; }

function authStatusPayload(request, env) {
  const url = new URL(request.url);
  const origin = publicOrigin(url, env);
  return { ok: true, surface: 'login_backend_ui_v1', public_trial: true, origin, login_urls: { github: origin + '/auth/github', google: origin + '/auth/google', logout: origin + '/auth/logout', session: origin + '/api/auth/session' }, ...authProviderStatus(env) };
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

function setCookie(name, value, maxAge) { return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`; }
function clearCookie(name) { return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`; }
function safeReturnTo(value) { return value && typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/\r|\n/.test(value) ? value.slice(0, 160) : '/chat?auth=trial'; }

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
  return { provider: 'github', id: String(user.id), login: user.login || null, email: user.email || null, name: user.name || user.login || 'GitHub user', avatar: user.avatar_url || null };
}

async function exchangeGoogleCode(code, redirectUri, env) {
  const params = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params });
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
  const session = await verifySignedToken(cookieValue(request, AUTH_COOKIE), env, 'auth_session');
  if (!session) return json({ ok: true, authenticated: false, surface: 'public_trial_auth_v1', user: null, secret_values_exposed: false });
  return json({ ok: true, authenticated: true, surface: 'public_trial_auth_v1', user: { provider: session.provider, id: session.id, login: session.login, email: session.email, name: session.name, avatar: session.avatar }, expires_at: session.exp ? new Date(session.exp * 1000).toISOString() : null, secret_values_exposed: false });
}

function handleAuthLogout() {
  const headers = new Headers();
  headers.append('set-cookie', clearCookie(AUTH_COOKIE));
  headers.append('set-cookie', clearCookie(AUTH_STATE_COOKIE));
  return redirectTo('/login?auth=logged_out', 302, headers);
}

function authButton(label, href, ready, provider) { return `<a class="lsauth-btn ${ready ? '' : 'disabled'}" href="${href}" data-provider="${provider}" aria-disabled="${ready ? 'false' : 'true'}"><span>${label}</span><b>${ready ? 'READY' : 'SETUP'}</b></a>`; }
function readyTag(ok) { return `<span class="${ok ? 'lsauth-ok' : 'lsauth-warn'}">${ok ? 'READY' : 'MISSING'}</span>`; }

function applyLoginAuthUi(html, env) {
  html = addBodyClass(html, 'ls-login-auth-surface-v1');
  if (html.includes('data-ls-login-auth-surface="v1"')) return html;
  const status = authProviderStatus(env);
  const style = `<style data-ls-login-auth-surface="v1">.lsauth{width:100%;max-width:430px}.lsauth h1{font-size:1.65rem!important;line-height:1.12!important}.lsauth .lead{color:var(--fg2,#a2a7b0);margin:9px 0 22px;line-height:1.65}.lsauth-stack{display:grid;gap:11px}.lsauth-btn{height:52px;border-radius:999px;border:1px solid var(--bd2,#26292f);background:var(--surf-in,#0a0a0b);color:var(--fg,#f5f7f9);display:flex;align-items:center;justify-content:space-between;padding:0 16px;text-decoration:none;font-weight:700}.lsauth-btn:hover{border-color:var(--acc,#63b3ff);background:rgba(99,179,255,.07)}.lsauth-btn b{font-family:var(--fm,monospace);font-size:.66rem;letter-spacing:.12em;color:var(--fg3,#7c828c)}.lsauth-btn.primary{background:#fff;color:#070708;border-color:#fff}.lsauth-btn.primary b{color:#444}.lsauth-btn.disabled{opacity:.62}.lsauth-card{border:1px solid var(--bd,#1c1e22);border-radius:14px;background:rgba(6,6,6,.5);padding:14px;margin-top:16px}.lsauth-card h2{font-size:.9rem;margin:0 0 10px}.lsauth-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--bd,#1c1e22);padding:9px 0;color:var(--fg2,#a2a7b0);font-size:.84rem}.lsauth-row:first-of-type{border-top:0}.lsauth-row code{font-family:var(--fm,monospace);font-size:.76rem;color:#dfe3e8;overflow-wrap:anywhere}.lsauth-ok{color:#9de7bf}.lsauth-warn{color:#f7d889}.lsauth-note{border-left:2px solid var(--acc,#63b3ff);background:rgba(99,179,255,.06);border-radius:12px;padding:12px 13px;margin-top:16px;color:var(--fg2,#a2a7b0);font-size:.84rem;line-height:1.65}.lsauth-error{display:none;border:1px solid rgba(255,107,107,.24);background:rgba(255,107,107,.08);color:#ffb2b2;border-radius:12px;padding:11px 13px;margin:0 0 14px;font-size:.84rem}.lsauth-error.show{display:block}.lsauth-mini{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.lsauth-mini a{font-size:.78rem;color:var(--fg2,#a2a7b0);border:1px solid var(--bd,#1c1e22);border-radius:999px;padding:6px 10px;text-decoration:none}.lsauth-session{margin-top:14px;color:var(--fg3,#7c828c);font-family:var(--fm,monospace);font-size:.72rem;line-height:1.55}@media(max-width:720px){body.ls-login-auth-surface-v1 .lbrand .ldial{opacity:.18!important}body.ls-login-auth-surface-v1 .lform-wrap{align-items:flex-start!important;padding-top:30px!important}}</style>`;
  const panel = `<div class="lsauth" data-ls-login-auth-surface="v1"><div id="lsauth-error" class="lsauth-error"></div><h1 class="thai">ทดลองใช้งานแบบ Public Trial</h1><p class="lead thai">เลือก GitHub หรือ Google เพื่อเริ่ม session ทดลอง ระบบอ่าน client id / client secret จาก Cloudflare Secret เท่านั้น และไม่แสดง secret ในหน้าเว็บ</p><div class="lsauth-stack">${authButton('Continue with GitHub', '/auth/github', status.github.ready, 'github')}${authButton('Continue with Google', '/auth/google', status.google.ready, 'google')}<a class="lsauth-btn primary" href="chat.html"><span>Continue as Guest</span><b>PUBLIC</b></a></div><div class="lsauth-card"><h2>Backend secret checklist</h2><div class="lsauth-row"><code>AUTH_SESSION_SECRET</code>${readyTag(status.session_secret)}</div><div class="lsauth-row"><code>GITHUB_CLIENT_ID</code>${readyTag(status.github.client_id)}</div><div class="lsauth-row"><code>GITHUB_CLIENT_SECRET</code>${readyTag(status.github.client_secret)}</div><div class="lsauth-row"><code>GOOGLE_CLIENT_ID</code>${readyTag(status.google.client_id)}</div><div class="lsauth-row"><code>GOOGLE_CLIENT_SECRET</code>${readyTag(status.google.client_secret)}</div></div><div class="lsauth-note thai">Secret values ไม่ถูกส่งเข้า HTML, Markdown, GitHub หรือ Chat UI. ปุ่ม OAuth จะเริ่มทำงานเมื่อใส่ Secret ครบใน Cloudflare Runtime Variables and Secrets.</div><div class="lsauth-mini"><a href="/api/auth/status">Auth status JSON</a><a href="/api/auth/session">Session JSON</a><a href="secret-handoff.html">Secret Handoff</a><a href="endpoints.html">Endpoints</a><a href="/auth/logout">Logout</a></div><div id="lsauth-session" class="lsauth-session">session: checking…</div></div>`;
  const replaceScript = `<script data-ls-login-auth-surface="v1-replace">(function(){var mount=document.querySelector('.lform-wrap');if(mount){mount.innerHTML=${JSON.stringify(panel)};}})();</script>`;
  const script = `<script data-ls-login-auth-surface="v1">(function(){var params=new URLSearchParams(location.search);var err=params.get('auth_error');var box=document.getElementById('lsauth-error');if(err&&box){box.textContent='AUTH ERROR: '+err;box.classList.add('show')}document.addEventListener('click',function(e){var a=e.target.closest('.lsauth-btn.disabled');if(!a)return;e.preventDefault();if(box){box.textContent='Provider ยังไม่พร้อม: ต้องใส่ client id/client secret + AUTH_SESSION_SECRET ใน Cloudflare ก่อน';box.classList.add('show')}});fetch('/api/auth/session',{cache:'no-store'}).then(function(r){return r.json()}).then(function(s){var el=document.getElementById('lsauth-session');if(!el)return;el.textContent=s.authenticated?'session: signed in via '+s.user.provider+' · '+(s.user.login||s.user.email||s.user.name):'session: guest / not signed in'}).catch(function(){var el=document.getElementById('lsauth-session');if(el)el.textContent='session: unavailable'})})();</script>`;
  return injectBody(injectHead(html, style), replaceScript + '\n' + script);
}

function applyEndpointsAuthBlock(html) {
  if (html.includes('data-ls-auth-endpoints="v1"')) return html;
  const block = `<div class="wrap grid" data-ls-auth-endpoints="v1"><section class="section"><h2>Login Auth Backend UI</h2><p>OAuth endpoints สำหรับ Public Trial Login. Secret ทั้งหมดต้องอยู่ใน Cloudflare Runtime Secrets เท่านั้น</p><div class="table"><div class="row"><div class="path">GET /api/auth/status</div><div class="kind">Worker API</div><div class="desc">แสดงสถานะ GitHub/Google/Auth secret โดยไม่คืนค่า secret จริง</div><div class="tag LIVE">LIVE</div></div><div class="row"><div class="path">GET /api/auth/session</div><div class="kind">Worker API</div><div class="desc">ตรวจ signed HttpOnly session cookie สำหรับ public trial</div><div class="tag LIVE">LIVE</div></div><div class="row"><div class="path">GET /auth/github</div><div class="kind">OAuth start</div><div class="desc">เริ่ม GitHub login เมื่อ GITHUB_CLIENT_ID/SECRET พร้อม</div><div class="tag LIVE">LIVE</div></div><div class="row"><div class="path">GET /auth/github/callback</div><div class="kind">OAuth callback</div><div class="desc">แลก code ฝั่ง server แล้วออก signed session cookie ไม่คืน raw token</div><div class="tag LIVE">LIVE</div></div><div class="row"><div class="path">GET /auth/google</div><div class="kind">OAuth start</div><div class="desc">เริ่ม Google login เมื่อ GOOGLE_CLIENT_ID/SECRET พร้อม</div><div class="tag LIVE">LIVE</div></div><div class="row"><div class="path">GET /auth/google/callback</div><div class="kind">OAuth callback</div><div class="desc">แลก code ฝั่ง server แล้วออก signed session cookie ไม่คืน raw token</div><div class="tag LIVE">LIVE</div></div><div class="row"><div class="path">GET /auth/logout</div><div class="kind">session</div><div class="desc">ล้าง public trial session cookie</div><div class="tag LIVE">LIVE</div></div></div></section></div>`;
  return html.replace(/<\/main>/i, block + '\n</main>');
}

function applyChatRuntimeStatus(html, hasKey) {
  if (!hasKey) return html;
  return html.replace(/RUNTIME NOT WIRED/g, 'OPENAI LIVE').replace(/SAFE STUB/g, 'OPENAI LIVE').replace(/STUB 503/g, 'LIVE 200').replace(/MISSING/g, 'DETECTED').replace(/DISABLED/g, 'ENABLED').replace(/Runtime not wired/g, 'OpenAI runtime wired').replace(/runtime: not wired/g, 'runtime: OpenAI Runtime V1').replace(/Runtime ยังไม่ wired/g, 'OpenAI Runtime V1').replace(/ตอนนี้ยังไม่ต่อ API key จริง ระบบจะส่ง request ไป \/api\/chat และคืนสถานะ backend เท่านั้น/g, 'พร้อมรับ prompt แล้ว แต่ระบบจะคุม Rate Limit V1 ก่อนส่งเข้า OpenAI เพื่อกันเครดิตไหล').replace(/mode: fast · runtime: OpenAI Runtime V1/g, 'mode: fast · runtime: OpenAI Runtime V1 · limit: 10/10m');
}

function applyChatToolContext(html, rawTool) {
  const tool = normalizeTool(rawTool);
  const label = TOOL_LABELS[tool];
  if (!label || html.includes('data-ls-chat-tool="v1"')) return html;
  const script = `<script data-ls-chat-tool="v1">(function(){var tool='${tool}',label='${label}';var p=document.getElementById('prompt'),s=document.getElementById('state'),l=document.getElementById('log');var hints={writer:'เขียนโพสต์ / landing copy / email / caption ที่ต้องการ',image:'อธิบายภาพที่ต้องการสร้าง พร้อมสไตล์และขนาด',research:'ใส่หัวข้อที่ต้องการค้นคว้าและระดับความลึก',code:'วางโค้ดหรืออธิบาย bug ที่ต้องการแก้'};if(p)p.placeholder=label+' — '+hints[tool];if(s)s.textContent='tool: '+tool+' · runtime: OpenAI Runtime V1 · limit: 10/10m';if(l){var m=document.createElement('div');m.className='msg bot';m.innerHTML='<div class="role">TOOL ROUTER</div><div></div>';m.lastChild.textContent='เปิดจาก Tools → '+label+' แล้ว · Provider: OpenAI Runtime V1 · Rate Limit V1';l.appendChild(m)}})();</script>`;
  const badge = '<div data-ls-chat-tool="v1" style="margin-top:14px;display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(99,179,255,.24);background:rgba(99,179,255,.07);border-radius:999px;padding:8px 12px;font-family:var(--mono,var(--fm,monospace));font-size:.76rem;color:#8ec6ff">TOOL ROUTER · ' + label + ' · RATE LIMIT V1</div>';
  return injectBody(html.replace(/(<div class="notice[\s\S]*?<\/div>)/i, '$1\n' + badge), script);
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
  const base = ['Act as a flexible reasoning and generation engine for this request, not a fixed persona.', 'This endpoint belongs to lsuperagen.docs public beta. Do not present it as official OpenAI support.', 'Answer in the same language as the user unless they ask otherwise.', 'Be concise, practical, and direct.', 'Do not claim access to private systems, repositories, dashboards, files, billing, or accounts unless the user provides that content in the prompt.', 'Do not reveal, request, or guess secrets/API keys.', 'If information is missing, say exactly what is missing.', 'Current mode: ' + (mode || 'fast') + '.'];
  const byTool = { writer: 'Tool context: AI Writer. Draft, rewrite, structure, or improve content. Preserve user-supplied names, claims, numbers, and constraints.', image: 'Tool context: Image Generator. Use a 3-layer prompt workflow: Intent Scan, Creative Expansion, Final Prompt. Include Negative Prompt and Render Settings when useful. Do not claim to generate an image from this endpoint.', research: 'Tool context: Deep Research. Provide an evidence-first plan or synthesis. If live web evidence is required but unavailable in the prompt, say so.', code: 'Tool context: Code Assistant. Help with implementation, debugging, code review, and architecture. Prefer minimal safe changes.' };
  return base.concat(byTool[tool] || 'Tool context: general public chat.').join('\n');
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const chunks = [];
  for (const item of data.output || []) for (const c of item.content || []) { if (typeof c.text === 'string') chunks.push(c.text); if (typeof c.output_text === 'string') chunks.push(c.output_text); }
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

function rateLimitHeaders(result) { return { 'x-lsuperagen-rate-limit': String(result.limit), 'x-lsuperagen-rate-remaining': String(result.remaining), 'x-lsuperagen-rate-reset': new Date(result.resetAt).toISOString(), ...(result.limited ? { 'retry-after': String(result.retryAfter) } : {}) }; }

async function listAccessibleModelIds(env, requestId) {
  try { const res = await fetch('https://api.openai.com/v1/models', { headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'x-client-request-id': requestId } }); if (!res.ok) return null; const data = await res.json(); return new Set((data.data || []).map((model) => model && model.id).filter(Boolean)); } catch (_) { return null; }
}

async function createOpenAIResponse(env, model, message, tool, mode, requestId) {
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId }, body: JSON.stringify({ model, input: message, instructions: toolInstructions(tool, mode), max_output_tokens: 900, store: false, metadata: { app: 'lsuperagen.docs', route: '/api/chat', tool: tool || 'general', mode } }) });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw: raw.slice(0, 500) }; }
  return { response, data };
}

function isModelAccessError(data) { const msg = data && data.error && data.error.message ? data.error.message : ''; return /does not have access to model|model .* not found|invalid model|not exist|do not have access/i.test(msg); }

function plannedEndpoint(pathname) {
  const planned = { '/api/image': { status: 'planned', method: 'POST', message: 'Image API is planned but not implemented. Current Image Generator is a prompt/spec compiler only.' }, '/api/image/status': { status: 'planned', method: 'GET', message: 'Image API provider is not wired yet. No image secret is exposed here.' }, '/admin/auth/github': { status: 'planned', method: 'GET', message: 'Admin GitHub OAuth is planned. Public trial OAuth uses /auth/github.' }, '/admin/github/status': { status: 'planned', method: 'GET', message: 'Admin GitHub status endpoint is planned. Not active yet.' }, '/admin/github/files': { status: 'planned', method: 'GET', message: 'Admin GitHub files endpoint is planned. Not active yet.' }, '/admin/github/commit': { status: 'planned', method: 'POST', message: 'Admin GitHub commit endpoint is planned. Not active yet.' }, '/admin/handoff/claude': { status: 'planned', method: 'POST', message: 'Claude handoff admin endpoint is planned. Current handoff is a repo Markdown file.' } }[pathname];
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
    if (providerResponse.ok) { const output = extractOutputText(data); return json({ ok: true, status: 'completed', tool, provider, model, message: output, output, usage: data.usage || null, response_id: data.id || null, request_id: requestId, attempted_models: attempted, rate_limit: { limit: rate.limit, remaining: rate.remaining, reset_at: new Date(rate.resetAt).toISOString() } }, 200, { ...baseHeaders, 'x-lsuperagen-request-id': requestId }); }
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
    if (pathname === '/auth/logout') return handleAuthLogout();
    if (pathname === '/auth/github') return handleAuthStart('github', request, env);
    if (pathname === '/auth/google') return handleAuthStart('google', request, env);
    if (pathname === '/auth/github/callback') return handleAuthCallback('github', request, env);
    if (pathname === '/auth/google/callback') return handleAuthCallback('google', request, env);

    if (request.method === 'OPTIONS' && pathname === '/api/chat') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (pathname === '/api/chat') return handleChat(request, env);
    const planned = plannedEndpoint(pathname);
    if (planned) return planned;

    const response = await env.ASSETS.fetch(request);
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;
    let html = await response.text();
    const page = currentPage(pathname);
    if (page === 'index.html') html = applyHomePolish(applyHomeEnhancements(html));
    if (page === 'tools.html') html = applyToolsRouter(html);
    if (page === 'login.html') html = applyLoginAuthUi(html, env);
    if (page === 'endpoints.html') html = applyEndpointsAuthBlock(html);
    if (page === 'chat.html') {
      html = applyChatRuntimeStatus(html, Boolean(env.OPENAI_API_KEY));
      html = applyChatToolContext(html, url.searchParams.get('tool'));
    }
    html = mobilePolish(html, pathname);
    return new Response(html, { status: response.status, headers: htmlHeaders(response, 'login-auth-surface-v1-openai-runtime-v1-rate-limit-v1') });
  }
};
