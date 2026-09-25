import legacyWorker from './index.js';
import {
  createLegacySessionCookie,
  firebaseConfigFromEnv,
  identityToolkitUserMessage,
  platformEmailPasswordReset,
  platformEmailSignIn,
  platformEmailSignUp,
  sessionFromFirebaseClaims,
  verifyFirebaseIdToken,
} from './firebase-core.mjs';

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/home';
  if (!value.startsWith('/') || value.startsWith('//') || /[\r\n]/.test(value)) return '/home';
  return value.slice(0, 180);
}

function clearLegacyAuthCookie() {
  return 'lsuperagen_trial_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax';
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}

async function sessionResponseFromIdToken(idToken, env, returnTo) {
  const state = firebaseConfigFromEnv(env);
  if (!state.configured) {
    return json({ ok: false, error: 'firebase_not_configured', missing: state.missing }, 503);
  }
  if (!env.AUTH_SESSION_SECRET) {
    return json({ ok: false, error: 'auth_session_secret_missing' }, 503);
  }

  const claims = await verifyFirebaseIdToken(idToken, state.config.projectId);
  const session = sessionFromFirebaseClaims(claims);
  const cookie = await createLegacySessionCookie(session, env.AUTH_SESSION_SECRET);
  return json({
    ok: true,
    surface: 'platform_email_auth_v1',
    return_to: safeReturnTo(returnTo),
    session: {
      provider: session.provider,
      id: session.id,
      email: session.email,
      email_verified: session.email_verified,
      name: session.name,
    },
    secret_values_exposed: false,
  }, 200, { 'set-cookie': cookie, 'x-lsuperagen-auth': 'platform-email-v1' });
}

async function handleFirebaseConfig(env) {
  const state = firebaseConfigFromEnv(env);
  if (!state.configured) {
    return json({
      ok: false,
      status: 'firebase_not_configured',
      missing: state.missing,
      secret_values_exposed: false,
    }, 503);
  }
  return json({ ok: true, sdk_version: '12.19.0', config: state.config });
}

function handleFirebaseStatus(env) {
  const state = firebaseConfigFromEnv(env);
  return json({
    ok: true,
    status: state.configured ? 'configured' : 'not_configured',
    firebase_web_config: state.configured,
    firebase_session_bridge: Boolean(state.configured && env.AUTH_SESSION_SECRET),
    platform_email_auth: Boolean(state.configured && env.AUTH_SESSION_SECRET),
    missing: state.missing,
    auth_session_secret: Boolean(env.AUTH_SESSION_SECRET),
    secret_values_exposed: false,
  });
}

async function readIdToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;

  const body = await readJsonBody(request);
  return typeof body?.idToken === 'string' ? body.idToken.trim() : '';
}

async function handleFirebaseSession(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });

  const idToken = await readIdToken(request);
  if (!idToken) return json({ ok: false, error: 'firebase_id_token_missing' }, 400);

  try {
    return await sessionResponseFromIdToken(idToken, env, '/home');
  } catch (error) {
    return json({
      ok: false,
      error: 'firebase_token_invalid',
      message: error instanceof Error ? error.message : 'Firebase token validation failed',
    }, 401);
  }
}

async function handlePlatformEmailLogin(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const state = firebaseConfigFromEnv(env);
  if (!state.configured) {
    return json({ ok: false, error: 'firebase_not_configured', missing: state.missing, message: 'ตั้งค่า Firebase บน Worker ก่อนใช้งานอีเมล' }, 503);
  }
  const body = await readJsonBody(request);
  const email = body?.email;
  const password = body?.password;
  const returnTo = safeReturnTo(body?.return_to);
  try {
    const result = await platformEmailSignIn(env, email, password);
    const idToken = result?.idToken;
    if (!idToken) throw new Error('missing_id_token');
    return await sessionResponseFromIdToken(idToken, env, returnTo);
  } catch (error) {
    const code = error?.code || error?.message || 'login_failed';
    return json({
      ok: false,
      error: 'platform_login_failed',
      code,
      message: identityToolkitUserMessage(code),
      secret_values_exposed: false,
    }, 400);
  }
}

async function handlePlatformEmailRegister(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const state = firebaseConfigFromEnv(env);
  if (!state.configured) {
    return json({ ok: false, error: 'firebase_not_configured', missing: state.missing, message: 'ตั้งค่า Firebase บน Worker ก่อนสมัครด้วยอีเมล' }, 503);
  }
  const body = await readJsonBody(request);
  const email = body?.email;
  const password = body?.password;
  const returnTo = safeReturnTo(body?.return_to || '/home');
  try {
    const result = await platformEmailSignUp(env, email, password);
    const idToken = result?.idToken;
    if (!idToken) throw new Error('missing_id_token');
    return await sessionResponseFromIdToken(idToken, env, returnTo);
  } catch (error) {
    const code = error?.code || error?.message || 'register_failed';
    return json({
      ok: false,
      error: 'platform_register_failed',
      code,
      message: identityToolkitUserMessage(code),
      secret_values_exposed: false,
    }, 400);
  }
}

async function handlePlatformEmailPasswordReset(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const state = firebaseConfigFromEnv(env);
  if (!state.configured) {
    return json({ ok: false, error: 'firebase_not_configured', missing: state.missing }, 503);
  }
  const body = await readJsonBody(request);
  try {
    await platformEmailPasswordReset(env, body?.email);
    return json({ ok: true, message: 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว', secret_values_exposed: false });
  } catch (error) {
    const code = error?.code || error?.message || 'reset_failed';
    return json({
      ok: false,
      error: 'platform_password_reset_failed',
      code,
      message: identityToolkitUserMessage(code),
      secret_values_exposed: false,
    }, 400);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/api/firebase/config') return handleFirebaseConfig(env);
    if (pathname === '/api/firebase/status') return handleFirebaseStatus(env);
    if (pathname === '/api/auth/firebase/session') return handleFirebaseSession(request, env);
    if (pathname === '/api/auth/platform/login') return handlePlatformEmailLogin(request, env);
    if (pathname === '/api/auth/platform/register') return handlePlatformEmailRegister(request, env);
    if (pathname === '/api/auth/platform/password-reset') return handlePlatformEmailPasswordReset(request, env);
    if (pathname === '/api/auth/firebase/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': clearLegacyAuthCookie(), 'x-lsuperagen-auth': 'firebase-session-bridge-v1' });
    }

    return legacyWorker.fetch(request, env, ctx);
  },
};
