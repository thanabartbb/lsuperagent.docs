import { adaptAgentHtml, adaptAgentScript, agentAssetPath } from './agent-ui.js';
import { errorPayload } from './api-errors.js';
import { publicResource } from './public-resources.js';
import { getFeed, SOURCES as FEED_SOURCES } from './feeds.js';
import { historyEnabled, userKey, listConversations, getConversation, deleteConversation, saveExchange } from './chat-store.js';
import { takeQuota, quotaHeaders, quotaMessage } from './quota.js';
import { handleGithubApp } from './github-app.js';
import { handleSandboxApi } from './openai-agent-sessions.js';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_BUCKETS = new Map();

const AUTH_COOKIE = 'lsuperagen_trial_session';
const AUTH_STATE_COOKIE = 'lsuperagen_oauth_state';
const AUTH_SESSION_TTL_SECONDS = 6 * 60 * 60;
const AUTH_STATE_TTL_SECONDS = 10 * 60;

const ALIASES = {
  '/sdk': '/guide',
  '/control': '/dev',
  '/dev/control-plane': '/dev',
  '/dev/control-plane/index.html': '/dev',
  '/api/providers/status': '/api/chat-providers',
  '/api/claude/status': '/api/chat-providers',
  '/provider-status': '/api/chat-providers',
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
  return new Response(JSON.stringify(errorPayload(data, status), null, 2), {
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
    exa_search: { configured: truthySecret(env, 'EXA_API_KEY'), env_name: 'EXA_API_KEY' },
    github: { provider: 'github', client_id: truthySecret(env, 'GITHUB_CLIENT_ID'), client_secret: truthySecret(env, 'GITHUB_CLIENT_SECRET'), ready: githubReady },
    github_code_tools: { ready: truthySecret(env, 'GITHUB_APP_CLIENT_ID') && truthySecret(env, 'GITHUB_APP_CLIENT_SECRET') && truthySecret(env, 'GITHUB_TOKEN_ENCRYPTION_KEY'), secret_values_exposed: false },
    google: { provider: 'google', client_id: truthySecret(env, 'GOOGLE_CLIENT_ID'), client_secret: truthySecret(env, 'GOOGLE_CLIENT_SECRET'), ready: googleReady },
    expected_secrets: ['AUTH_SESSION_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'GITHUB_TOKEN_ENCRYPTION_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    admin_expected_variable: 'ADMIN_ALLOWED_LOGINS',
    owner_expected_variable: 'OWNER_GOOGLE_EMAIL',
    optional_variables: ['PUBLIC_SITE_URL', 'OWNER_GOOGLE_SUB', 'EXA_API_KEY'],
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
    ...authProviderStatus(env),
    github_code_tools: {
      ...authProviderStatus(env).github_code_tools,
      callback: origin + '/auth/github/connect/callback'
    }
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
  if (!value || typeof value !== 'string') return '/home';
  if (!value.startsWith('/') || value.startsWith('//')) return '/home';
  if (/\r|\n/.test(value)) return '/home';
  return value.slice(0, 180);
}

async function currentSession(request, env) { return verifySignedToken(cookieValue(request, AUTH_COOKIE), env, 'auth_session'); }

function agentRuntimeBindingReady(env) {
  return Boolean(env.AGENT_STARTER && typeof env.AGENT_STARTER.fetch === 'function');
}

async function agentRuntimeInstance(session, env) {
  const provider = String(session?.provider || 'unknown').trim().toLowerCase();
  const subject = String(session?.id || session?.email || session?.login || '').trim().toLowerCase();
  const signature = await hmacSign(`agent-runtime-v1:${provider}:${subject}`, env.AUTH_SESSION_SECRET || 'missing-session-secret');
  return 'u_' + signature.slice(0, 32);
}

async function handleAgentRuntimeConfig(request, env) {
  if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed', message: 'Use GET' }, 405, { allow: 'GET' });
  const session = await currentSession(request, env);
  if (!session) return json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนเชื่อม Agent runtime' }, 401);
  return json({
    ok: true,
    transport: 'cloudflare-agents',
    agent: 'ChatAgent',
    name: await agentRuntimeInstance(session, env),
    path: '/agents',
    connected: agentRuntimeBindingReady(env),
    service_binding: 'AGENT_STARTER',
    legacy_chat: '/api/chat'
  });
}

async function handleAgentRuntimeProxy(request, env, pathname) {
  const session = await currentSession(request, env);
  if (!session) return json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนเชื่อม Agent runtime' }, 401);
  if (!agentRuntimeBindingReady(env)) return json({ ok: false, error: 'agent_runtime_unavailable', message: 'Agent runtime service binding is not available' }, 503);

  if (pathname.startsWith('/agents/')) {
    const match = /^\/agents\/chat-agent\/([^/]+)(?:\/|$)/.exec(pathname);
    if (!match) return json({ ok: false, error: 'agent_route_not_allowed', message: 'Only the ChatAgent runtime is exposed through SDKSPACE' }, 404);
    let requestedInstance = '';
    try { requestedInstance = decodeURIComponent(match[1]); } catch (_) { return json({ ok: false, error: 'invalid_agent_instance' }, 400); }
    const expectedInstance = await agentRuntimeInstance(session, env);
    if (requestedInstance !== expectedInstance) {
      return json({ ok: false, error: 'agent_instance_mismatch', message: 'Use /api/agent-runtime/config to obtain the current signed-in Agent instance' }, 403);
    }
  }

  const headers = new Headers(request.headers);
  const rawCookie = headers.get('cookie') || '';
  if (rawCookie) {
    const forwardedCookies = rawCookie
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => {
        const name = part.split('=', 1)[0];
        return name !== AUTH_COOKIE && name !== AUTH_STATE_COOKIE;
      });
    if (forwardedCookies.length) headers.set('cookie', forwardedCookies.join('; '));
    else headers.delete('cookie');
  }
  headers.delete('authorization');
  headers.set('x-sdkspace-agent-bridge', 'v1');
  return env.AGENT_STARTER.fetch(new Request(request, { headers }));
}
async function handleAgentUI(request, env, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) return json({error:'method_not_allowed'}, 405, {allow:'GET, HEAD'});
  const session = await currentSession(request, env);
  if (!session) return pathname === '/chat' ? redirectTo('/login?return_to=%2Fchat', 302) : json({error:'authentication_required'}, 401);
  if (!agentRuntimeBindingReady(env)) return pathname === '/chat' ? legacyChatFallback(request, env) : json({error:'agent_runtime_unavailable'}, 503);
  const asset = pathname === '/chat' ? '/' : agentAssetPath(pathname);
  if (!asset) return json({error:'not_found'}, 404);
  try {
    const upstream = await env.AGENT_STARTER.fetch(new Request('https://agent-starter.internal' + asset));
    if (!upstream.ok) return pathname === '/chat' ? legacyChatFallback(request, env) : json({error:'agent_ui_unavailable'}, 502);
    const headers = new Headers({
      'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'same-origin'
    });
    let body;
    if (asset === '/') {
      headers.set('content-type','text/html; charset=utf-8');
      headers.set('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' " + new URL(request.url).origin.replace('https:', 'wss:') + "; frame-ancestors 'none'");
      body = adaptAgentHtml(await upstream.text());
    } else if (asset.endsWith('.js')) {
      headers.set('content-type','text/javascript; charset=utf-8');
      const entryResponse = await env.AGENT_STARTER.fetch(new Request('https://agent-starter.internal/'));
      if (!entryResponse.ok) throw new Error('Missing UI entry');
      const entryHtml = await entryResponse.text();
      const entry = /src="(\/assets\/[^" ]+\.js)"/.exec(entryHtml)?.[1];
      if (!entry) throw new Error('Missing UI module');
      const script = await upstream.text();
      body = asset === entry ? adaptAgentScript(script, await agentRuntimeInstance(session, env)) : script;
    } else body = upstream.body;
    return new Response(request.method === 'HEAD' ? null : body, {headers});
  } catch (_) { return pathname === '/chat' ? legacyChatFallback(request, env) : json({error:'agent_ui_build_incompatible', message:'Agent Starter UI requires a compatible build. Please try again later.'}, 503); }
}
async function legacyChatFallback(request, env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') return json({ error: 'chat_unavailable' }, 503);
  const url = new URL(request.url);
  url.pathname = '/chat.html';
  const response = await env.ASSETS.fetch(new Request(url.toString(), { method: request.method, headers: request.headers }));
  const headers = htmlHeaders(response, 'legacy-chat-fallback-v1');
  headers.set('cache-control', 'private, no-store');
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers });
}

const MCP_PROTOCOL_VERSION = '2025-11-25';
const MCP_STATELESS_VERSION = '2026-07-28';
const MCP_SERVER_INFO = { name: 'sdkspace', version: '1.0.0' };
const MCP_CACHE_TTL_MS = 30000;
const MCP_TOOLS = [
  { name: 'sdkspace_overview', description: 'อธิบายว่า SDKSPACE คืออะไรและผู้ใช้เริ่มต้นใช้งานอย่างไร', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'sdkspace_capabilities', description: 'แสดงความสามารถและเส้นทาง API สาธารณะของ SDKSPACE พร้อมบอกว่าเส้นทางใดต้องลงชื่อเข้าใช้', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'sdkspace_connection_check', description: 'ตรวจว่า MCP server ของ SDKSPACE พร้อมตอบสนองและมีเครื่องมือกี่รายการ', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }
];

function mcpEnvelope(request, result, modern = false) {
  const responseResult = modern
    ? { resultType: 'complete', ...result, _meta: { 'io.modelcontextprotocol/serverInfo': MCP_SERVER_INFO } }
    : result;
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: responseResult }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': modern ? 'public, max-age=30' : 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-method, mcp-name',
      'access-control-max-age': '86400',
      'x-content-type-options': 'nosniff'
    }
  });
}

function mcpError(id, code, message, status = 200, data) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-method, mcp-name', 'x-content-type-options': 'nosniff' }
  });
}

function mcpToolPayload(name) {
  if (name === 'sdkspace_overview') {
    return {
      name: 'SDKSPACE',
      description: 'พื้นที่ทำงานสำหรับใช้ AI และ SDK ของ lsuperagen',
      getting_started: [
        { step: 1, action: 'สร้างบัญชีหรือเข้าสู่ระบบที่ https://agents-sdk.space/login' },
        { step: 2, action: 'เปิด /chat เพื่อสนทนา เขียนโค้ด ค้นคว้า หรืออ่าน URL' },
        { step: 3, action: 'เปิด /guide เพื่อดู SDK และสร้าง API key สำหรับเชื่อมแอป' }
      ],
      public_pages: ['/guide', '/docs', '/v1/health'],
      note: 'MCP นี้ให้ข้อมูลสาธารณะเท่านั้น ไม่เข้าถึงประวัติแชท บัญชี หรือคีย์ของผู้ใช้'
    };
  }
  if (name === 'sdkspace_capabilities') {
    return {
      capabilities: [
        { name: 'AI chat', path: '/api/chat', method: 'POST', authentication: 'signed-in session', description: 'สนทนา เขียนโค้ด ค้นคว้า และอ่าน URL' },
        { name: 'Image generation', path: '/api/image', method: 'POST', authentication: 'signed-in session', description: 'สร้างภาพด้วย AI' },
        { name: 'SDK health', path: '/v1/health', method: 'GET', authentication: 'public', description: 'ตรวจสถานะ API' },
        { name: 'SDK chat', path: '/v1/chat', method: 'POST', authentication: 'signed lsg_ SDK key', description: 'เรียก AI chat จากแอปที่เชื่อมต่อ' },
        { name: 'SDK image', path: '/v1/image', method: 'POST', authentication: 'signed lsg_ SDK key', description: 'เรียกสร้างภาพจากแอปที่เชื่อมต่อ' },
        { name: 'Developer guide', path: '/guide', method: 'GET', authentication: 'signed-in session', description: 'อ่านคู่มือ SDK และจัดการ API key' }
      ],
      limits: 'การเรียก API ที่สร้างเนื้อหาต้องมี session หรือ SDK key และอยู่ภายใต้โควตาของบัญชี'
    };
  }
  if (name === 'sdkspace_connection_check') {
    return { ok: true, server: MCP_SERVER_INFO.name, protocols: [MCP_STATELESS_VERSION, MCP_PROTOCOL_VERSION], tools_available: MCP_TOOLS.length, checked_at: new Date().toISOString() };
  }
  return null;
}

async function handleMcp(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-method, mcp-name',
    'access-control-max-age': '86400', 'cache-control': 'no-store'
  } });
  const origin = request.headers.get('origin');
  if (origin) {
    const allowedOrigins = new Set([new URL(request.url).origin, 'https://agents-sdk.space', 'https://agent-starter.thanabartb.workers.dev']);
    if (!allowedOrigins.has(origin)) return new Response(null, { status: 403, headers: { 'cache-control': 'no-store' } });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST, OPTIONS', 'cache-control': 'no-store' } });
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) return mcpError(null, -32700, 'Content-Type must be application/json', 415);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 65536) return mcpError(null, -32600, 'Request body is too large', 413);

  let payload;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 65536) return mcpError(null, -32600, 'Request body is too large', 413);
    payload = JSON.parse(body);
  } catch (_) { return mcpError(null, -32700, 'Parse error'); }
  if (!payload || Array.isArray(payload) || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') return mcpError(payload?.id, -32600, 'Invalid JSON-RPC request');

  const meta = payload.params?._meta;
  const headerVersion = request.headers.get('mcp-protocol-version');
  const modern = headerVersion === MCP_STATELESS_VERSION;
  if (modern) {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return mcpError(payload.id, -32602, 'Required MCP request metadata is missing', 400);
    if (meta['io.modelcontextprotocol/protocolVersion'] !== MCP_STATELESS_VERSION ||
        !meta['io.modelcontextprotocol/clientCapabilities'] ||
        typeof meta['io.modelcontextprotocol/clientCapabilities'] !== 'object' ||
        Array.isArray(meta['io.modelcontextprotocol/clientCapabilities'])) {
      return mcpError(payload.id, -32602, 'Required MCP request metadata is invalid', 400);
    }
    if (request.headers.get('mcp-method') !== payload.method ||
        headerVersion !== meta['io.modelcontextprotocol/protocolVersion']) {
      return mcpError(payload.id, -32020, 'MCP request headers do not match the JSON-RPC body', 400);
    }
    const name = payload.params?.name;
    const nameHeader = request.headers.get('mcp-name');
    if (payload.method === 'tools/call' && nameHeader !== name) return mcpError(payload.id, -32020, 'Mcp-Name must match params.name', 400);
    if (payload.method !== 'tools/call' && nameHeader !== null) return mcpError(payload.id, -32020, 'Unexpected Mcp-Name header', 400);
  }

  if (payload.method.startsWith('notifications/')) {
    if (modern) return mcpError(payload.id, -32601, 'Notifications are not supported by the stateless endpoint', 404);
    return new Response(null, { status: 202, headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'id')) return mcpError(null, -32600, 'Requests must include an id');

  if (payload.method === 'initialize' && !modern) {
    const requested = payload.params?.protocolVersion;
    const version = requested === '2025-06-18' ? '2025-06-18' : MCP_PROTOCOL_VERSION;
    return mcpEnvelope(payload, {
      protocolVersion: version,
      capabilities: { tools: { listChanged: false } },
      serverInfo: MCP_SERVER_INFO,
      instructions: 'SDKSPACE MCP provides public, read-only information about the SDKSPACE product and API capabilities.'
    });
  }
  if (payload.method === 'server/discover' && modern) {
    return mcpEnvelope(payload, {
      supportedVersions: [MCP_STATELESS_VERSION],
      capabilities: { tools: {} },
      instructions: 'SDKSPACE MCP provides public, read-only information about the SDKSPACE product and API capabilities.',
      ttlMs: MCP_CACHE_TTL_MS,
      cacheScope: 'public'
    }, true);
  }
  if (payload.method === 'tools/list') {
    const cursor = payload.params?.cursor;
    if (cursor) return mcpEnvelope(payload, modern ? { tools: [], nextCursor: null, ttlMs: MCP_CACHE_TTL_MS, cacheScope: 'public' } : { tools: [] }, modern);
    return mcpEnvelope(payload, modern ? { tools: MCP_TOOLS, ttlMs: MCP_CACHE_TTL_MS, cacheScope: 'public' } : { tools: MCP_TOOLS }, modern);
  }
  if (payload.method === 'tools/call') {
    const result = mcpToolPayload(payload.params?.name);
    if (!result) return mcpEnvelope(payload, modern
      ? { content: [{ type: 'text', text: 'Unknown tool: ' + String(payload.params?.name || '') }], isError: true, ttlMs: MCP_CACHE_TTL_MS, cacheScope: 'public' }
      : { content: [{ type: 'text', text: 'Unknown tool: ' + String(payload.params?.name || '') }], isError: true }, modern);
    return mcpEnvelope(payload, modern
      ? { content: [{ type: 'text', text: JSON.stringify(result) }], ttlMs: MCP_CACHE_TTL_MS, cacheScope: 'public' }
      : { content: [{ type: 'text', text: JSON.stringify(result) }] }, modern);
  }
  return mcpError(payload.id, -32601, 'Method not found: ' + payload.method, 404);
}

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
  const returnTo = safeReturnTo(url.searchParams.get('return_to') || '/home');
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
  return redirectTo(safeReturnTo(payload.return_to || '/home'), 302, headers);
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

// Chat attachments: images and PDFs sent inline as base64 data URLs with the current user turn.
// They go to the model only; chat history stores just their names (no file storage).
const ATTACHMENT_MAX_COUNT = 4;
const ATTACHMENT_MAX_BYTES = { image: 5 * 1024 * 1024, pdf: 10 * 1024 * 1024 };
const ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_KINDS = { 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image', 'application/pdf': 'pdf' };
const DATA_URL_PATTERN = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/;

function parseAttachments(value) {
  if (value === undefined || value === null) return { items: [] };
  if (!Array.isArray(value) || value.length > ATTACHMENT_MAX_COUNT) return { error: 'แนบไฟล์ได้สูงสุด ' + ATTACHMENT_MAX_COUNT + ' ไฟล์ต่อข้อความ' };
  const items = [];
  let total = 0;
  for (const entry of value) {
    const match = entry && typeof entry.data === 'string' ? DATA_URL_PATTERN.exec(entry.data) : null;
    const kind = match ? ATTACHMENT_KINDS[match[1]] : null;
    if (!kind) return { error: 'รองรับเฉพาะรูปภาพ (PNG, JPEG, WebP, GIF) และ PDF' };
    const base64 = match[2];
    if (base64.length % 4) return { error: 'ข้อมูลไฟล์แนบไม่ถูกต้อง' };
    const bytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    if (!bytes) return { error: 'ไฟล์แนบว่างเปล่า' };
    if (bytes > ATTACHMENT_MAX_BYTES[kind]) return { error: kind === 'pdf' ? 'ไฟล์ PDF ต้องไม่เกิน 10 MB' : 'รูปภาพต้องไม่เกิน 5 MB' };
    total += bytes;
    if (total > ATTACHMENT_MAX_TOTAL_BYTES) return { error: 'ไฟล์แนบรวมกันต้องไม่เกิน 20 MB' };
    const fallbackName = kind === 'pdf' ? 'document.pdf' : 'image';
    const name = typeof entry.name === 'string' ? entry.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || fallbackName : fallbackName;
    items.push({ kind, name, data: entry.data });
  }
  return { items };
}

function withAttachments(input, message, attachments) {
  if (!attachments.length) return input;
  const content = [{ type: 'input_text', text: message }].concat(attachments.map((item) => item.kind === 'image'
    ? { type: 'input_image', image_url: item.data, detail: 'auto' }
    : { type: 'input_file', filename: item.name, file_data: item.data }));
  return Array.isArray(input) ? input.slice(0, -1).concat({ role: 'user', content }) : [{ role: 'user', content }];
}

// History turns are capped at 12,000 characters, so the note is dropped rather than overflow a turn.
const HISTORY_TURN_MAX = 12000;
function attachmentNote(message, attachments) {
  if (!attachments.length) return message;
  const noted = message + '\n\n📎 ' + attachments.map((item) => item.name).join(', ');
  return noted.length <= HISTORY_TURN_MAX ? noted : message;
}

// Only errors saying the model cannot take image/file input justify trying another model.
function isAttachmentSupportError(data) {
  const msg = data && data.error && data.error.message ? String(data.error.message) : '';
  return /(image|file|pdf|input_image|input_file|content type)[^.]*(not supported|unsupported|only supported|not allowed|does not support)|(does not support|doesn't support|not support)[^.]*(image|file|pdf|vision)/i.test(msg);
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
  return { 'ratelimit-limit': String(result.limit), 'ratelimit-remaining': String(result.remaining), 'ratelimit-reset': String(result.retryAfter), 'ratelimit-policy': '10;w=600', 'x-lsuperagen-rate-limit': String(result.limit), 'x-lsuperagen-rate-remaining': String(result.remaining), 'x-lsuperagen-rate-reset': new Date(result.resetAt).toISOString(), ...(result.limited ? { 'retry-after': String(result.retryAfter) } : {}) };
}

const GITHUB_CHAT_TOOLS = [
  { type: 'function', name: 'create_repository', description: 'Propose creating a private GitHub repository for the connected account. Never claim it was created until the user approves.', strict: true, parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name', 'description'], additionalProperties: false } },
  { type: 'function', name: 'commit_files', description: 'Propose committing the complete generated file set to a repository owned by the connected GitHub account. Never claim it was committed until the user approves.', strict: true, parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, branch: { type: 'string' }, message: { type: 'string' }, files: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false } } }, required: ['owner', 'repo', 'branch', 'message', 'files'], additionalProperties: false } }
];

export function githubProposal(data) {
  const call = (data?.output || []).find((item) => item?.type === 'function_call' && ['create_repository', 'commit_files'].includes(item.name));
  if (!call) return null;
  try { return { name: call.name, arguments: JSON.parse(call.arguments) }; } catch (_) { return null; }
}

async function createOpenAIResponse(env, model, input, tool, mode, requestId, stream = false, githubTools = false) {
  const usesWeb = tool === 'research' || tool === 'url';
  const payload = {
    model,
    input,
    instructions: toolInstructions(tool, mode),
    max_output_tokens: tool === 'code' ? 8000 : usesWeb ? 5000 : 4000,
    store: false,
    metadata: { app: 'lsuperagen.docs', surface: 'public-workspace', tool: tool || 'chat', mode }
  };
  if (stream) payload.stream = true;
  if (usesWeb) {
    payload.tools = [{ type: 'web_search' }];
    payload.tool_choice = 'required';
    payload.include = ['web_search_call.action.sources'];
  }
  if (githubTools) payload.tools = GITHUB_CHAT_TOOLS;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
    body: JSON.stringify(payload)
  });
  // A streamed success is returned unread so the caller can pipe it; errors are always plain JSON.
  if (stream && response.ok) return { response, data: null };
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
  return { response, data };
}

function isOutputCutOff(response) {
  return Boolean(response && response.incomplete_details && response.incomplete_details.reason === 'max_output_tokens');
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

// --- Claude (Anthropic Messages API) as a second chat provider ---------------------------------
// Raw fetch like the OpenAI calls: this Worker ships without npm dependencies.
const CLAUDE_DEFAULT_MODEL = 'claude-opus-5-5';
// Models that accept server-side refusal fallbacks (fallbacks: "default").
const CLAUDE_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
// Models that accept output_config.effort (Haiku 4.5 and older reject it).
const CLAUDE_EFFORT_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-fable-5', 'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6']);

function claudeModel(env) {
  const configured = typeof env.ANTHROPIC_MODEL === 'string' ? env.ANTHROPIC_MODEL.trim() : '';
  return configured || CLAUDE_DEFAULT_MODEL;
}

function chatModelOptions(env, provider) {
  if (provider === 'openai') return modelCandidates(env);
  const configured = typeof env.ANTHROPIC_MODEL === 'string' ? env.ANTHROPIC_MODEL.trim() : '';
  return Array.from(new Set([configured, CLAUDE_DEFAULT_MODEL, ...CLAUDE_FALLBACK_MODELS, ...CLAUDE_EFFORT_MODELS].filter(Boolean)));
}

const IMAGE_MODEL_OPTIONS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'];

function imageModelOptions() { return IMAGE_MODEL_OPTIONS.slice(); }

function webSearchModelOptions(env) {
  const configured = typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() : '';
  return Array.from(new Set([configured, 'gpt-6-astra', 'gpt-4.1'].filter(Boolean)));
}

function chatProviders(env) {
  return [
    { id: 'openai', label: 'OpenAI', available: Boolean(env.OPENAI_API_KEY) },
    { id: 'claude', label: 'Claude', available: Boolean(env.ANTHROPIC_API_KEY) }
  ];
}

// Same turns as the OpenAI path; attachments become image/document blocks placed before the text.
function claudeMessages(history, message, attachments) {
  const turns = history ? history.map(({ role, content }) => ({ role, content: content.trim() })) : [{ role: 'user', content: message }];
  if (attachments.length) {
    const blocks = attachments.map((item) => {
      const comma = item.data.indexOf(',');
      const mediaType = item.data.slice(5, item.data.indexOf(';'));
      const source = { type: 'base64', media_type: mediaType, data: item.data.slice(comma + 1) };
      return item.kind === 'image' ? { type: 'image', source } : { type: 'document', source };
    });
    turns[turns.length - 1] = { role: 'user', content: blocks.concat({ type: 'text', text: message }) };
  }
  return turns;
}

async function createClaudeMessage(env, messages, tool, mode, stream, selectedModel = '') {
  const model = selectedModel || claudeModel(env);
  const payload = {
    model,
    max_tokens: tool === 'code' ? 32000 : 16000,
    system: toolInstructions(tool, mode),
    messages
  };
  if (CLAUDE_EFFORT_MODELS.has(model)) payload.output_config = { effort: tool === 'code' ? 'high' : 'medium' };
  const headers = { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  if (CLAUDE_FALLBACK_MODELS.has(model)) {
    // If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model.
    payload.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  if (stream) payload.stream = true;
  const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(payload) });
  if (stream && response.ok) return { response, data: null };
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
  return { response, data };
}

async function chatWithClaude({ env, history, message, attachments, tool, mode, stream, quota, recordHistory, headers, selectedModel = '' }) {
  let providerResponse, data;
  try {
    ({ response: providerResponse, data } = await createClaudeMessage(env, claudeMessages(history, message, attachments), tool, mode, stream, selectedModel));
  } catch (_) {
    await quota.refund();
    return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อ Claude ไม่สำเร็จ กรุณาลองใหม่' }, 502, headers);
  }
  if (providerResponse.ok && stream) return streamChatResponse(providerResponse, headers, { onComplete: recordHistory, onFail: quota.refund, interpret: claudeStreamEvent });
  if (!providerResponse.ok) {
    await quota.refund();
    const busy = providerResponse.status === 429 || providerResponse.status === 529;
    return json({ ok: false, status: 'service_error', message: busy ? 'Claude ถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง' : 'Claude ไม่สามารถทำคำขอนี้ได้ในขณะนี้' }, busy ? 429 : 502, headers);
  }
  if (data.stop_reason === 'refusal') {
    await quota.refund();
    return json({ ok: false, status: 'refused', message: 'Claude ไม่สามารถตอบคำขอนี้ได้ ลองเปลี่ยนคำถามหรือเลือก OpenAI' }, 422, headers);
  }
  const output = (Array.isArray(data.content) ? data.content : []).filter((block) => block && block.type === 'text').map((block) => block.text).join('').trim();
  if (!output) {
    await quota.refund();
    return json({ ok: false, status: 'empty_result', message: 'Claude ไม่ได้ส่งข้อความกลับมา กรุณาลองใหม่' }, 502, headers);
  }
  const extra = recordHistory ? await recordHistory(output) : {};
  return json({ ok: true, status: 'completed', message: output, output, sources: [], ...(data.stop_reason === 'max_tokens' ? { truncated: true } : {}), ...extra }, 200, headers);
}

// Provider stream interpreters: turn one parsed SSE event into
// { delta } | { done: { output, sources, truncated } } | { fail: 'error' | 'refused' } | null (ignore).
// state.text holds the text streamed so far.
function openAIStreamEvent(event, state) {
  if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') return { delta: event.delta };
  // An answer cut off at the output-token cap is still a real answer: deliver it, flagged truncated.
  if ((event.type === 'response.completed' || (event.type === 'response.incomplete' && isOutputCutOff(event.response))) && event.response) {
    return { done: { output: extractOutputText(event.response) || state.text.trim(), sources: extractSources(event.response), truncated: event.type === 'response.incomplete' } };
  }
  if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error') return { fail: 'error' };
  return null;
}

function claudeStreamEvent(event, state) {
  if (event.type === 'content_block_delta' && event.delta && event.delta.type === 'text_delta' && typeof event.delta.text === 'string') return { delta: event.delta.text };
  if (event.type === 'message_delta' && event.delta && event.delta.stop_reason) {
    state.stopReason = event.delta.stop_reason;
    return null;
  }
  if (event.type === 'message_stop') {
    if (state.stopReason === 'refusal') return { fail: 'refused' };
    return { done: { output: state.text.trim(), sources: [], truncated: state.stopReason === 'max_tokens' } };
  }
  if (event.type === 'error') return { fail: 'error' };
  return null;
}

// Streamed chat: relays a provider's SSE stream as NDJSON lines the browser can read incrementally.
//   {"type":"delta","text":"..."}                       zero or more
//   {"type":"done","ok":true,"output":"...","sources":[]}   exactly one on success
//   {"type":"error","ok":false,"message":"..."}          exactly one on failure (no fake output)
// onComplete(output) runs before the done event and may add fields; onFail() runs when no answer was produced.
function streamChatResponse(providerResponse, headers, { onComplete, onFail, interpret = openAIStreamEvent } = {}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const emit = (event) => writer.write(encoder.encode(JSON.stringify(event) + '\n'));
  (async () => {
    let buffer = '';
    const state = { text: '' };
    let finished = false;
    const handle = async (event) => {
      const action = interpret(event, state);
      if (!action) return;
      if (action.delta !== undefined) {
        state.text += action.delta;
        await emit({ type: 'delta', text: action.delta });
      } else if (action.done) {
        const { output, sources, truncated } = action.done;
        finished = true;
        if (!output) {
          if (onFail) await onFail();
          await emit({ type: 'error', ok: false, status: 'empty_result', message: 'บริการ AI ไม่ได้ส่งข้อความกลับมา กรุณาลองใหม่' });
          return;
        }
        const extra = onComplete ? await onComplete(output) : {};
        await emit({ type: 'done', ok: true, status: 'completed', output, sources: sources || [], ...(truncated ? { truncated: true } : {}), ...extra });
      } else if (action.fail) {
        finished = true;
        if (onFail) await onFail();
        await emit(action.fail === 'refused'
          ? { type: 'error', ok: false, status: 'refused', message: 'Claude ไม่สามารถตอบคำขอนี้ได้ ลองเปลี่ยนคำถามหรือเลือก OpenAI' }
          : { type: 'error', ok: false, status: 'service_error', message: 'บริการ AI ตอบไม่ครบ กรุณาลองใหม่' });
      }
    };
    try {
      const reader = providerResponse.body.getReader();
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while (!finished && (cut = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, cut).trim();
          buffer = buffer.slice(cut + 1);
          if (!line.startsWith('data:')) continue;
          let event;
          try { event = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
          await handle(event);
        }
      }
      if (finished) reader.cancel().catch(() => {});
      else {
        if (onFail) await onFail();
        await emit({ type: 'error', ok: false, status: 'service_error', message: 'การเชื่อมต่อกับบริการ AI ขาดกลางคัน กรุณาลองใหม่' });
      }
    } catch (_) {
      if (!finished) {
        if (onFail) await onFail().catch(() => {});
        await emit({ type: 'error', ok: false, status: 'service_error', message: 'การเชื่อมต่อกับบริการ AI ขาดกลางคัน กรุณาลองใหม่' }).catch(() => {});
      }
    } finally {
      await writer.close().catch(() => {});
    }
  })();
  return new Response(readable, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers }
  });
}

// Saves a finished exchange for a signed-in /api/chat user. History is best effort:
// a storage failure never hides a real answer, it only reports history_saved: false.
function historyRecorder(env, session, conversationId, userText) {
  if (!session || !historyEnabled(env)) return null;
  return async (output) => {
    try {
      return { conversation_id: await saveExchange(env, userKey(session), conversationId, userText, output), history_saved: true };
    } catch (_) {
      return { history_saved: false };
    }
  };
}

// 20 MB of attachments is ~27 MB as base64, plus up to 120,000 characters of history.
const CHAT_BODY_MAX_BYTES = 28 * 1024 * 1024;

// Reads a JSON body but stops as soon as it exceeds maxBytes, whatever content-length claims.
async function readJsonLimited(request, maxBytes) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > maxBytes) return { tooLarge: true };
  if (!request.body) return { body: {} };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return { body: JSON.parse(new TextDecoder().decode(bytes)) || {} }; } catch (_) { return { body: {} }; }
}

// session: signed-in /api/chat user (history is saved). quotaIdentity: whose daily quota to charge —
// the session for /api/chat, the SDK key's account for /v1/chat.
async function handleChat(request, env, session = null, quotaIdentity = session) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST, OPTIONS' });
  const parsed = await readJsonLimited(request, CHAT_BODY_MAX_BYTES).catch(() => ({ body: {} }));
  if (parsed.tooLarge) return json({ ok: false, status: 'payload_too_large', message: 'คำขอใหญ่เกินกำหนด (ไฟล์แนบรวมต้องไม่เกิน 20 MB)' }, 413);
  const body = parsed.body && typeof parsed.body === 'object' ? parsed.body : {};
  const history = body.messages;
  if (history !== undefined && (
    !Array.isArray(history) || history.length < 1 || history.length > 20 ||
    history.some((turn, index) => !turn || turn.role !== (index % 2 ? 'assistant' : 'user') ||
      typeof turn.content !== 'string' || !turn.content.trim() || turn.content.length > 12000) ||
    history[history.length - 1].role !== 'user' ||
    history.reduce((sum, turn) => sum + turn.content.length, 0) > 120000
  )) return json({ ok: false, status: 'validation_error', message: 'ประวัติแชทไม่ถูกต้องหรือยาวเกินกำหนด' }, 400);
  const message = history ? history[history.length - 1].content.trim() : typeof body.message === 'string' ? body.message.trim() : '';
  const mode = typeof body.mode === 'string' && body.mode.trim() ? body.mode.trim().slice(0, 32) : 'chat';
  const tool = inferTool(body, request);
  const provider = body.provider === undefined || body.provider === null || body.provider === '' ? 'openai' : body.provider;
  const selectedModel = typeof body.model === 'string' ? body.model.trim() : '';
  const stream = body.stream === true && tool !== 'code';
  if (provider !== 'openai' && provider !== 'claude') return json({ ok: false, status: 'validation_error', message: 'ผู้ให้บริการ AI ที่เลือกไม่ถูกต้อง' }, 400);
  if (body.model !== undefined && body.model !== null && typeof body.model !== 'string') return json({ ok: false, status: 'validation_error', message: 'รูปแบบโมเดลไม่ถูกต้อง' }, 400);
  const modelOptions = provider === 'openai' && ['research', 'url'].includes(tool) ? webSearchModelOptions(env) : chatModelOptions(env, provider);
  if (selectedModel && !modelOptions.includes(selectedModel)) return json({ ok: false, status: 'validation_error', message: 'โมเดลนี้ใช้กับเครื่องมือที่เลือกไม่ได้' }, 400);
  if (!message) return json({ ok: false, status: 'validation_error', message: 'กรุณาใส่ข้อความก่อนส่ง' }, 400);
  if (message.length > 120000) return json({ ok: false, status: 'validation_error', message: 'ข้อความยาวเกินขีดจำกัด 120,000 ตัวอักษร กรุณาแบ่งเป็นส่วนย่อย' }, 413);
  if (tool === 'invalid') return json({ ok: false, status: 'validation_error', message: 'โหมดที่ส่งมาไม่ถูกต้อง' }, 400);
  if (provider === 'claude' && (tool === 'research' || tool === 'url')) return json({ ok: false, status: 'validation_error', message: 'โหมดค้นเว็บ/อ่าน URL ใช้ได้กับ OpenAI เท่านั้น' }, 400);
  const rate = checkRateLimit(request, tool);
  const baseHeaders = rateLimitHeaders(rate);
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง' }, 429, baseHeaders);
  // Attachments are scanned only after the request has counted against the rate limit.
  const attachments = parseAttachments(body.attachments);
  if (attachments.error) return json({ ok: false, status: 'validation_error', message: attachments.error }, 400, baseHeaders);
  const input = withAttachments(history ? history.map(({ role, content }) => ({ role, content: content.trim() })) : message, message, attachments.items);
  const recordHistory = historyRecorder(env, session, body.conversation_id, attachmentNote(message, attachments.items));
  if (provider === 'claude' ? !env.ANTHROPIC_API_KEY : !env.OPENAI_API_KEY) return json({ ok: false, status: 'service_unavailable', message: provider === 'claude' ? 'Claude ยังไม่พร้อมใช้งานในขณะนี้' : 'บริการ AI ยังไม่พร้อมใช้งานในขณะนี้' }, 503, baseHeaders);
  // Daily quota: a message costs 1, or 2 when it carries attachments.
  const quota = await takeQuota(env, quotaIdentity, 'chat', attachments.items.length ? 2 : 1, { exempt: isOwnerGoogleSession(quotaIdentity, env) });
  Object.assign(baseHeaders, quotaHeaders(quota));
  if (!quota.ok) return json({ ok: false, status: 'quota_exceeded', message: quotaMessage(quota, 'ข้อความ'), reset_at: new Date(quota.resetAt).toISOString() }, 429, { ...baseHeaders, 'retry-after': String(Math.max(1, Math.ceil((quota.resetAt - Date.now()) / 1000))) });

  if (provider === 'claude') return chatWithClaude({ env, history, message, attachments: attachments.items, tool, mode, stream, quota, recordHistory, headers: baseHeaders, selectedModel });

  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const githubTools = tool === 'code' && Boolean(session?.provider && session?.id && env.DB && env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_CLIENT_SECRET && env.GITHUB_TOKEN_ENCRYPTION_KEY)
    ? Boolean(await env.DB.prepare('SELECT 1 FROM github_connections WHERE user_key = ?').bind(`${session.provider}:${session.id}`).first().catch(() => null))
    : false;
  const useStream = stream && !(tool === 'code' && githubTools);
  const webMode = tool === 'research' || tool === 'url';
  const candidates = selectedModel
    ? [selectedModel]
    : webMode
      ? Array.from(new Set(['gpt-6-astra', 'gpt-4.1', typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() : ''].filter(Boolean)))
      : modelCandidates(env);
  let lastStatus = 502;
  for (const model of candidates) {
    let providerResponse, data;
    try {
      ({ response: providerResponse, data } = await createOpenAIResponse(env, model, input, tool, mode, requestId, useStream, githubTools));
    } catch (_) {
      await quota.refund();
      return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อบริการ AI ไม่สำเร็จ กรุณาลองใหม่' }, 502, baseHeaders);
    }
    if (providerResponse.ok && useStream) return streamChatResponse(providerResponse, baseHeaders, { onComplete: recordHistory, onFail: quota.refund });
    if (providerResponse.ok) {
      const proposal = githubProposal(data);
      if (proposal) {
        const extra = recordHistory ? await recordHistory(`เสนอเครื่องมือ GitHub: ${proposal.name}`) : {};
        return json({ ok: true, status: 'tool_pending', tool_proposal: proposal, ...extra }, 200, baseHeaders);
      }
      const output = extractOutputText(data);
      if (!output) {
        await quota.refund();
        return json({ ok: false, status: 'empty_result', message: 'บริการ AI ไม่ได้ส่งข้อความกลับมา กรุณาลองใหม่' }, 502, baseHeaders);
      }
      const extra = recordHistory ? await recordHistory(output) : {};
      const truncated = data.status === 'incomplete' && isOutputCutOff(data) ? { truncated: true } : {};
      return json({ ok: true, status: 'completed', message: output, output, sources: extractSources(data), ...truncated, ...extra }, 200, baseHeaders);
    }
    lastStatus = providerResponse.status;
    // A model that cannot read images/PDFs rejects the input; try the next one. Other errors stop here.
    if (!isModelAccessError(data) && !(attachments.items.length && isAttachmentSupportError(data))) break;
  }
  await quota.refund();
  return json({ ok: false, status: 'service_error', message: lastStatus === 429 ? 'บริการ AI ถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง' : 'บริการ AI ไม่สามารถทำคำขอนี้ได้ในขณะนี้' }, lastStatus === 429 ? 429 : 502, baseHeaders);
}

async function handleChatHistory(request, env, pathname) {
  const session = await currentSession(request, env);
  if (!session) return json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนดูประวัติแชต' }, 401);
  if (!historyEnabled(env)) return json({ ok: false, status: 'service_unavailable', message: 'ระบบประวัติแชตยังไม่พร้อมใช้งาน' }, 503);
  const key = userKey(session);
  const id = pathname === '/api/chats' ? null : decodeURIComponent(pathname.slice('/api/chats/'.length));
  try {
    if (!id) {
      if (request.method !== 'GET') return json({ ok: false, status: 'method_not_allowed' }, 405, { allow: 'GET' });
      return json({ ok: true, conversations: await listConversations(env, key) });
    }
    if (request.method === 'GET') {
      const conversation = await getConversation(env, key, id);
      return conversation ? json({ ok: true, conversation }) : json({ ok: false, status: 'not_found', message: 'ไม่พบแชตนี้' }, 404);
    }
    if (request.method === 'DELETE') {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'forbidden_origin' }, 403);
      return await deleteConversation(env, key, id) ? json({ ok: true, deleted: id }) : json({ ok: false, status: 'not_found', message: 'ไม่พบแชตนี้' }, 404);
    }
    return json({ ok: false, status: 'method_not_allowed' }, 405, { allow: 'GET, DELETE' });
  } catch (_) {
    return json({ ok: false, status: 'service_error', message: 'อ่านประวัติแชตไม่สำเร็จ กรุณาลองใหม่' }, 502);
  }
}

async function handleImage(request, env, quotaIdentity = null) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST, OPTIONS' });
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const selectedModel = typeof body.model === 'string' ? body.model.trim() : '';
  if (body.model !== undefined && body.model !== null && typeof body.model !== 'string') return json({ ok: false, status: 'validation_error', message: 'รูปแบบโมเดลภาพไม่ถูกต้อง' }, 400);
  if (selectedModel && !imageModelOptions().includes(selectedModel)) return json({ ok: false, status: 'validation_error', message: 'โมเดลภาพที่เลือกไม่รองรับ' }, 400);
  if (!prompt) return json({ ok: false, status: 'validation_error', message: 'กรุณาอธิบายภาพที่ต้องการสร้าง' }, 400);
  if (prompt.length > 12000) return json({ ok: false, status: 'validation_error', message: 'คำอธิบายภาพยาวเกินขีดจำกัด 12,000 ตัวอักษร' }, 413);
  const rate = checkRateLimit(request, 'image');
  const baseHeaders = rateLimitHeaders(rate);
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง' }, 429, baseHeaders);
  if (!env.OPENAI_API_KEY) return json({ ok: false, status: 'service_unavailable', message: 'บริการสร้างภาพยังไม่พร้อมใช้งานในขณะนี้' }, 503, baseHeaders);
  const quota = await takeQuota(env, quotaIdentity, 'image', 1, { exempt: isOwnerGoogleSession(quotaIdentity, env) });
  Object.assign(baseHeaders, quotaHeaders(quota));
  if (!quota.ok) return json({ ok: false, status: 'quota_exceeded', message: quotaMessage(quota, 'การสร้างภาพ'), reset_at: new Date(quota.resetAt).toISOString() }, 429, { ...baseHeaders, 'retry-after': String(Math.max(1, Math.ceil((quota.resetAt - Date.now()) / 1000))) });

  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const models = selectedModel ? [selectedModel] : imageModelOptions();
  let lastData = {};
  let lastStatus = 502;
  for (const model of models) {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
      body: JSON.stringify({ model, prompt })
    }).catch(() => null);
    if (!response) {
      await quota.refund();
      return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อบริการสร้างภาพไม่สำเร็จ กรุณาลองใหม่' }, 502, baseHeaders);
    }

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
    if (response.ok) {
      const item = Array.isArray(data.data) ? data.data[0] : null;
      const imageBase64 = item && typeof item.b64_json === 'string' ? item.b64_json : '';
      if (!imageBase64) {
        await quota.refund();
        return json({ ok: false, status: 'empty_result', message: 'บริการสร้างภาพไม่ได้ส่งไฟล์ภาพกลับมา กรุณาลองใหม่' }, 502, baseHeaders);
      }
      return json({ ok: true, status: 'completed', image: { mime_type: 'image/png', data_base64: imageBase64, filename: 'lsuperagen-image.png', revised_prompt: item && typeof item.revised_prompt === 'string' ? item.revised_prompt : null } }, 200, baseHeaders);
    }
    lastData = data;
    lastStatus = response.status;
    const providerCode = data && data.error && data.error.code ? String(data.error.code) : '';
    const providerMessage = data && data.error && data.error.message ? String(data.error.message) : '';
    const modelUnavailable = /model_not_found|invalid model|model .* not found|does not have access/i.test(providerCode + ' ' + providerMessage);
    if (response.status === 401 || response.status === 429 || (response.status >= 400 && response.status < 500 && !modelUnavailable)) break;
  }
  await quota.refund();
  return json({
    ok: false,
    status: 'service_error',
    message: lastStatus === 429 ? 'บริการสร้างภาพถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง' : 'ไม่สามารถสร้างภาพจากคำขอนี้ได้ กรุณาลองปรับคำอธิบาย',
    error_code: lastData && lastData.error && lastData.error.code ? String(lastData.error.code).slice(0, 80) : null,
    error_type: lastData && lastData.error && lastData.error.type ? String(lastData.error.type).slice(0, 80) : null,
    error_param: lastData && lastData.error && lastData.error.param ? String(lastData.error.param).slice(0, 80) : null,
    provider_status: lastStatus
  }, lastStatus === 429 ? 429 : 502, baseHeaders);
}

async function handleExaSearch(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'forbidden_origin', message: 'ค้นหาได้จากเว็บไซต์นี้เท่านั้น' }, 403);
  if (!await currentSession(request, env)) return json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนค้นหา' }, 401);
  let body = {};
  try { body = await request.json(); } catch (_) { return json({ ok: false, status: 'validation_error', message: 'รูปแบบคำขอไม่ถูกต้อง' }, 400); }
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) return json({ ok: false, status: 'validation_error', message: 'กรุณาใส่คำค้นหา' }, 400);
  if (query.length > 1000) return json({ ok: false, status: 'validation_error', message: 'คำค้นหายาวเกินขีดจำกัด 1,000 ตัวอักษร' }, 413);
  const requestedCount = Number(body.numResults);
  const numResults = Number.isInteger(requestedCount) ? Math.min(10, Math.max(1, requestedCount)) : 5;
  const type = ['auto', 'neural', 'keyword', 'fast', 'instant'].includes(body.type) ? body.type : 'auto';
  if (!truthySecret(env, 'EXA_API_KEY')) return json({ ok: false, status: 'service_unavailable', message: 'ยังไม่ได้ตั้งค่า Exa ใน Worker' }, 503);
  const rate = checkRateLimit(request, 'exa-search');
  const baseHeaders = rateLimitHeaders(rate);
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' }, 429, baseHeaders);
  let response;
  try {
    response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': env.EXA_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ query, type, numResults, contents: { highlights: true } })
    });
  } catch (_) {
    return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อ Exa ไม่สำเร็จ กรุณาลองใหม่' }, 502, baseHeaders);
  }
  if (!response.ok) return json({ ok: false, status: response.status === 429 ? 'rate_limited' : 'service_error', message: response.status === 429 ? 'Exa กำลังถูกใช้งานหนาแน่น กรุณาลองใหม่' : 'Exa ไม่สามารถทำคำค้นหานี้ได้' }, response.status === 429 ? 429 : 502, baseHeaders);
  let data;
  try { data = await response.json(); } catch (_) { return json({ ok: false, status: 'service_error', message: 'Exa ส่งผลลัพธ์ที่อ่านไม่ได้กลับมา' }, 502, baseHeaders); }
  const results = (Array.isArray(data.results) ? data.results : []).slice(0, numResults).filter((item) => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url)).map((item) => ({
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 500) : item.url,
    url: item.url,
    published_date: typeof item.publishedDate === 'string' ? item.publishedDate : null,
    highlights: Array.isArray(item.highlights) ? item.highlights.filter((text) => typeof text === 'string').slice(0, 3).map((text) => text.slice(0, 2000)) : []
  }));
  return json({ ok: true, status: 'completed', query, results, secret_values_exposed: false }, 200, baseHeaders);
}

const SDK_KEY_PREFIX = 'lsg_';
const SDK_KEY_TYP = 'sdk_key';
const SDK_KEY_TTL_DAYS = 30;
const SDK_PACKAGE = { name: 'lsupergen-sdk', version: '0.1.0', npm: 'https://www.npmjs.com/package/lsupergen-sdk' };
const SDK_CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
  'access-control-expose-headers': 'ratelimit-limit, ratelimit-remaining, ratelimit-reset, ratelimit-policy, retry-after, x-lsuperagen-rate-limit, x-lsuperagen-rate-remaining, x-lsuperagen-rate-reset',
  'access-control-max-age': '600'
};

function sdkJson(data, status = 200, headers = {}) {
  return json(data, status, { ...SDK_CORS_HEADERS, 'x-lsuperagen-api': 'v1', ...headers });
}

function withSdkHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SDK_CORS_HEADERS)) headers.set(key, value);
  headers.set('x-lsuperagen-api', 'v1');
  return new Response(response.body, { status: response.status, headers });
}

function bearerToken(request) {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '');
  return match ? match[1] : '';
}

async function sdkKeyFromRequest(request, env) {
  const raw = bearerToken(request);
  if (!raw.startsWith(SDK_KEY_PREFIX)) return null;
  return verifySignedToken(raw.slice(SDK_KEY_PREFIX.length), env, SDK_KEY_TYP);
}

function sdkKeyInfo(key) {
  return { id: key.kid, issued_at: new Date(key.iat * 1000).toISOString(), expires_at: new Date(key.exp * 1000).toISOString() };
}

async function handleSdkKeyCreate(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'forbidden_origin', message: 'สร้าง API key ได้จากหน้า Guide ของเว็บไซต์นี้เท่านั้น' }, 403);
  const session = await currentSession(request, env);
  if (!session) return json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนสร้าง API key' }, 401);
  const kid = 'key_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : String(Date.now()));
  const token = await createSignedToken({ kid, provider: session.provider, id: session.id, email: session.email || null, name: session.name || null }, env, SDK_KEY_TYP, SDK_KEY_TTL_DAYS * 24 * 60 * 60);
  const key = await verifySignedToken(token, env, SDK_KEY_TYP);
  return json({ ok: true, api_key: SDK_KEY_PREFIX + token, key: sdkKeyInfo(key), base_url: publicOrigin(new URL(request.url), env) + '/v1', package: SDK_PACKAGE }, 201);
}

async function handleSdkApi(request, env, pathname) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
  if (pathname === '/v1' || pathname === '/v1/health') {
    if (request.method !== 'GET') return sdkJson({ ok: false, error: 'method_not_allowed', message: 'Use GET' }, 405, { allow: 'GET, OPTIONS' });
    return sdkJson({ ok: true, service: 'lsupergen-api', api_version: 'v1', ai_ready: truthySecret(env, 'OPENAI_API_KEY'), auth_ready: truthySecret(env, 'AUTH_SESSION_SECRET'), package: SDK_PACKAGE, time: new Date().toISOString() });
  }
  const routes = { '/v1/me': 'GET', '/v1/chat': 'POST', '/v1/image': 'POST' };
  if (!routes[pathname]) return sdkJson({ ok: false, error: 'not_found', message: 'Unknown endpoint: ' + pathname }, 404);
  const key = await sdkKeyFromRequest(request, env);
  if (!key) return sdkJson({ ok: false, error: 'invalid_api_key', message: 'Missing, invalid, or expired API key. Create one at /keys.' }, 401, { 'www-authenticate': 'Bearer' });
  if (request.method !== routes[pathname]) return sdkJson({ ok: false, error: 'method_not_allowed', message: 'Use ' + routes[pathname] }, 405, { allow: routes[pathname] + ', OPTIONS' });
  if (pathname === '/v1/me') return sdkJson({ ok: true, user: { provider: key.provider, id: key.id, email: key.email, name: key.name }, key: sdkKeyInfo(key) });
  // SDK calls are charged to the key owner's daily quota; they never save chat history.
  return withSdkHeaders(pathname === '/v1/chat' ? await handleChat(request, env, null, key) : await handleImage(request, env, key));
}

async function handleFeed(request, env, url) {
  if (request.method !== 'GET') return json({ ok: false, status: 'method_not_allowed', message: 'Use GET' }, 405, { allow: 'GET' });
  if (!await currentSession(request, env)) return json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนอ่านข่าว' }, 401);
  const source = url.searchParams.get('source') || 'all';
  if (source !== 'all' && !Object.hasOwn(FEED_SOURCES, source)) return json({ ok: false, error: 'unknown_source', message: 'Unknown source: ' + source }, 400);
  try {
    const feed = await getFeed(source, { githubToken: env.GITHUB_TOKEN });
    const status = feed.items.length || !feed.errors.length ? 200 : 502;
    return json({ ok: status === 200, ...feed }, status, { 'cache-control': 'private, max-age=60' });
  } catch (err) {
    return json({ ok: false, error: 'upstream_failed', message: String(err && err.message || err) }, 502);
  }
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

    if ((pathname === '/' || pathname === '/index.html') && !request.headers.get('accept')?.includes('text/markdown') && await currentSession(request, env)) return redirectTo('/home', 302);
    const publicResponse = publicResource(request, pathname);
    if (publicResponse) return publicResponse;
    const legacyPublic = new Set(['/auth-all','/auth-all.html','/examples','/examples.html','/getting-started','/getting-started.html','/api','/api.html','/guides','/guides.html','/changelog','/changelog.html','/workspace','/workspace.html','/provider-connect','/provider-connect.html','/secret-handoff','/secret-handoff.html','/endpoints','/endpoints.html','/system-registry','/system-registry.html']);
    if (legacyPublic.has(pathname)) return redirectTo(await currentSession(request, env) ? '/home' : '/login', 302);
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

    if (pathname.startsWith('/api/github/') || pathname === '/auth/github/connect/callback') {
      return handleGithubApp(request, env, pathname, await currentSession(request, env));
    }

    if (pathname === '/mcp') return handleMcp(request);

    if (pathname === '/agent-chat') return redirectTo('/chat' + url.search, 308);
    if (pathname === '/chat.html') return redirectTo('/chat' + url.search, 308);
    if (pathname === '/chat' || pathname.startsWith('/agent-ui/')) return handleAgentUI(request, env, pathname);
    if (pathname === '/api/agent-runtime/config') return handleAgentRuntimeConfig(request, env);
    if (pathname === '/api/sandbox/sessions' || pathname.startsWith('/api/sandbox/sessions/')) return handleSandboxApi(request, env, await currentSession(request, env));
    if (pathname.startsWith('/agents/') || pathname.startsWith('/oauth/')) return handleAgentRuntimeProxy(request, env, pathname);

    if (request.method === 'OPTIONS' && (pathname === '/api/chat' || pathname === '/api/image' || pathname === '/api/exa/search')) return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (pathname === '/api/chat' || pathname === '/api/image') {
      if (!await currentSession(request, env)) return json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน AI Workspace' }, 401);
    }
    if (pathname === '/api/chat') return handleChat(request, env, await currentSession(request, env));
    if (pathname === '/api/chats' || pathname.startsWith('/api/chats/')) return handleChatHistory(request, env, pathname);
    if (pathname === '/api/chat-providers') {
      if (!await currentSession(request, env)) return json({ ok: false, error: 'authentication_required' }, 401);
      return json({
        ok: true,
        providers: chatProviders(env),
        models: { openai: chatModelOptions(env, 'openai'), claude: chatModelOptions(env, 'claude') },
        image_models: imageModelOptions(),
        web_search_models: webSearchModelOptions(env),
        default: 'openai'
      });
    }
    if (pathname === '/api/image') return handleImage(request, env, await currentSession(request, env));
    if (pathname === '/api/exa/search') return handleExaSearch(request, env);

    if (pathname === '/api/feed') return handleFeed(request, env, url);

    if (pathname === '/api/sdk/keys') return handleSdkKeyCreate(request, env);
    if (pathname === '/v1' || pathname.startsWith('/v1/')) return handleSdkApi(request, env, pathname);

    if (isDevOnlyPath(pathname)) {
      const gate = await guardOwnerDev(request, env, 'html');
      if (gate) return gate;
    }

    const workspacePaths = new Map([
      ['/home', '/home'], ['/home.html', '/home'],
      ['/chat', '/chat'], ['/chat.html', '/chat'],
      ['/tools', '/tools'], ['/tools.html', '/tools'],
      ['/exa', '/exa'], ['/exa.html', '/exa'],
      ['/guide', '/guide'], ['/guide.html', '/guide'],
      ['/news', '/news'], ['/news.html', '/news'],
      ['/keys', '/keys'], ['/keys.html', '/keys']
    ]);
    if (workspacePaths.has(pathname) && !await currentSession(request, env)) {
      return redirectTo(`/login?return_to=${encodeURIComponent(workspacePaths.get(pathname))}`, 302);
    }
    if ((pathname === '/login' || pathname === '/login.html') && await currentSession(request, env)) return redirectTo('/home', 302);

    if (pathname === '/docs-shell' || pathname === '/docs-shell.html' || pathname.startsWith('/docs-content/')) {
      if (!await currentSession(request, env)) {
        return pathname.startsWith('/docs-content/')
          ? json({ ok: false, error: 'authentication_required', message: 'กรุณาเข้าสู่ระบบก่อนอ่านเอกสาร' }, 401)
          : redirectTo('/login?return_to=%2Fdocs', 302);
      }
    }
    const docsPage = pathname === '/docs' ? 'introduction' : (/^\/docs\/([a-z0-9-]+)$/.exec(pathname) || [])[1];
    if (docsPage) {
      if (!await currentSession(request, env)) return redirectTo(`/login?return_to=${encodeURIComponent('/docs/' + docsPage)}`, 302);
      if (pathname === '/docs') return redirectTo('/docs/introduction', 302);
      const shellUrl = new URL(request.url);
      shellUrl.pathname = '/docs-shell';
      const shell = await env.ASSETS.fetch(new Request(shellUrl.toString(), request));
      return new Response(shell.body, { status: shell.status, headers: htmlHeaders(shell, 'docs-shell-v1') });
    }

    if (pathname.startsWith('/api/')) return json({ ok: false, error: 'not_found', message: 'Unknown API endpoint. See /openapi.json.' }, 404);
    const response = await fetchAsset(request, env, pathname);
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;
    const html = await response.text();
    return new Response(html, { status: response.status, headers: htmlHeaders(response, 'owner-google-dev-gate-v1-openai-runtime-v1-mobile-fix-v1') });
  }
};
