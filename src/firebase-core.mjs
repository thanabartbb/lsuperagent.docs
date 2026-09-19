const REQUIRED_PUBLIC_FIREBASE_ENV = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
];

const AUTH_COOKIE = 'lsuperagen_trial_session';
const AUTH_SESSION_TTL_SECONDS = 6 * 60 * 60;
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

function clean(env, key) {
  return typeof env?.[key] === 'string' ? env[key].trim() : '';
}

export function firebaseConfigFromEnv(env = {}) {
  const missing = REQUIRED_PUBLIC_FIREBASE_ENV.filter((key) => !clean(env, key));
  if (missing.length) return { configured: false, missing, config: null };

  const config = {
    apiKey: clean(env, 'FIREBASE_API_KEY'),
    authDomain: clean(env, 'FIREBASE_AUTH_DOMAIN'),
    projectId: clean(env, 'FIREBASE_PROJECT_ID'),
    appId: clean(env, 'FIREBASE_APP_ID'),
  };

  const optional = {
    storageBucket: clean(env, 'FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: clean(env, 'FIREBASE_MESSAGING_SENDER_ID'),
    measurementId: clean(env, 'FIREBASE_MEASUREMENT_ID'),
  };
  for (const [key, value] of Object.entries(optional)) if (value) config[key] = value;

  return { configured: true, missing: [], config };
}

export function firebaseProviderFromClaims(claims = {}) {
  const provider = String(claims?.firebase?.sign_in_provider || '').toLowerCase();
  if (provider === 'google.com') return 'google';
  if (provider === 'github.com') return 'github';
  return 'firebase';
}

export function validateFirebaseClaims(claims, projectId, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!claims || typeof claims !== 'object') throw new Error('Firebase token claims missing');
  if (!projectId) throw new Error('Firebase project ID missing');
  if (claims.aud !== projectId) throw new Error('Firebase token audience mismatch');
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Firebase token issuer mismatch');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) throw new Error('Firebase token subject invalid');
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds) throw new Error('Firebase token expired');
  if (!Number.isFinite(claims.iat) || claims.iat > nowSeconds + 300) throw new Error('Firebase token issued-at invalid');
  if (claims.auth_time !== undefined && (!Number.isFinite(claims.auth_time) || claims.auth_time > nowSeconds + 300)) {
    throw new Error('Firebase token auth_time invalid');
  }
  return claims;
}

function b64urlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlToJson(value) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(value)));
}

function bytesToB64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToB64url(new Uint8Array(signature));
}

export async function verifyFirebaseIdToken(idToken, projectId, fetchImpl = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Firebase ID token malformed');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = b64urlToJson(encodedHeader);
  const claims = b64urlToJson(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Firebase token header invalid');

  const jwksResponse = await fetchImpl(FIREBASE_JWKS_URL, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!jwksResponse.ok) throw new Error('Firebase signing keys unavailable');
  const jwks = await jwksResponse.json();
  const jwk = jwks?.[header.kid];
  if (!jwk) throw new Error('Firebase signing key not found');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new Error('Firebase token signature invalid');

  return validateFirebaseClaims(claims, projectId, nowSeconds);
}

export function sessionFromFirebaseClaims(claims) {
  const provider = firebaseProviderFromClaims(claims);
  const email = typeof claims.email === 'string' ? claims.email : '';
  return {
    provider,
    id: claims.sub,
    login: email || claims.name || claims.sub,
    email,
    email_verified: claims.email_verified === true,
    name: typeof claims.name === 'string' ? claims.name : '',
    picture: typeof claims.picture === 'string' ? claims.picture : '',
    firebase_uid: claims.sub,
  };
}

export async function createLegacySessionCookie(session, sessionSecret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!sessionSecret) throw new Error('AUTH_SESSION_SECRET missing');
  const payload = {
    typ: 'auth_session',
    iat: nowSeconds,
    exp: nowSeconds + AUTH_SESSION_TTL_SECONDS,
    ...session,
  };
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSign(body, sessionSecret);
  const token = `${body}.${signature}`;
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; Max-Age=${AUTH_SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
