import legacyWorker from './index.js';
import {
  createLegacySessionCookie,
  firebaseConfigFromEnv,
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

function clearLegacyAuthCookie() {
  return 'lsuperagen_trial_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax';
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
    missing: state.missing,
    auth_session_secret: Boolean(env.AUTH_SESSION_SECRET),
    secret_values_exposed: false,
  });
}

async function readIdToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return '';
  }
  return typeof body?.idToken === 'string' ? body.idToken.trim() : '';
}

async function handleFirebaseSession(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });

  const state = firebaseConfigFromEnv(env);
  if (!state.configured) return json({ ok: false, error: 'firebase_not_configured', missing: state.missing }, 503);
  if (!env.AUTH_SESSION_SECRET) return json({ ok: false, error: 'auth_session_secret_missing' }, 503);

  const idToken = await readIdToken(request);
  if (!idToken) return json({ ok: false, error: 'firebase_id_token_missing' }, 400);

  try {
    const claims = await verifyFirebaseIdToken(idToken, state.config.projectId);
    const session = sessionFromFirebaseClaims(claims);
    const cookie = await createLegacySessionCookie(session, env.AUTH_SESSION_SECRET);
    return json({
      ok: true,
      session: {
        provider: session.provider,
        id: session.id,
        email: session.email,
        email_verified: session.email_verified,
        name: session.name,
      },
    }, 200, { 'set-cookie': cookie, 'x-lsuperagen-auth': 'firebase-session-bridge-v1' });
  } catch (error) {
    return json({
      ok: false,
      error: 'firebase_token_invalid',
      message: error instanceof Error ? error.message : 'Firebase token validation failed',
    }, 401);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/api/firebase/config') return handleFirebaseConfig(env);
    if (pathname === '/api/firebase/status') return handleFirebaseStatus(env);
    if (pathname === '/api/auth/firebase/session') return handleFirebaseSession(request, env);
    if (pathname === '/api/auth/firebase/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': clearLegacyAuthCookie(), 'x-lsuperagen-auth': 'firebase-session-bridge-v1' });
    }

    return legacyWorker.fetch(request, env, ctx);
  },
};
