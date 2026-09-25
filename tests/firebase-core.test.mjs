import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firebaseConfigFromEnv,
  firebaseProviderFromClaims,
  identityToolkitUserMessage,
  validateFirebaseClaims,
  createLegacySessionCookie,
  verifyFirebaseIdToken,
} from '../src/firebase-core.mjs';

test('firebaseConfigFromEnv returns missing keys instead of partial config', () => {
  const result = firebaseConfigFromEnv({ FIREBASE_PROJECT_ID: 'demo-project' });
  assert.equal(result.configured, false);
  assert.deepEqual(result.missing.sort(), [
    'FIREBASE_API_KEY',
    'FIREBASE_APP_ID',
    'FIREBASE_AUTH_DOMAIN',
  ]);
  assert.equal(result.config, null);
});

test('firebaseConfigFromEnv returns public web config when required values exist', () => {
  const result = firebaseConfigFromEnv({
    FIREBASE_API_KEY: 'public-api-key',
    FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'demo-project',
    FIREBASE_APP_ID: '1:123:web:abc',
    FIREBASE_STORAGE_BUCKET: 'demo.firebasestorage.app',
    FIREBASE_MESSAGING_SENDER_ID: '123',
    FIREBASE_MEASUREMENT_ID: 'G-TEST',
  });
  assert.equal(result.configured, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.config.projectId, 'demo-project');
  assert.equal(result.config.apiKey, 'public-api-key');
  assert.equal(result.config.measurementId, 'G-TEST');
});

test('firebaseProviderFromClaims maps Firebase provider IDs to existing app provider names', () => {
  assert.equal(firebaseProviderFromClaims({ firebase: { sign_in_provider: 'google.com' } }), 'google');
  assert.equal(firebaseProviderFromClaims({ firebase: { sign_in_provider: 'github.com' } }), 'github');
  assert.equal(firebaseProviderFromClaims({ firebase: { sign_in_provider: 'password' } }), 'email');
});

test('identityToolkitUserMessage maps common Firebase email auth errors to Thai copy', () => {
  assert.match(identityToolkitUserMessage('EMAIL_NOT_FOUND'), /อีเมลหรือรหัสผ่าน/);
  assert.match(identityToolkitUserMessage('EMAIL_EXISTS'), /มีบัญชีอยู่แล้ว/);
});

test('validateFirebaseClaims accepts a current token for the configured project', () => {
  const now = 1_800_000_000;
  const claims = {
    aud: 'demo-project',
    iss: 'https://securetoken.google.com/demo-project',
    sub: 'uid-123',
    iat: now - 60,
    exp: now + 3600,
  };
  assert.doesNotThrow(() => validateFirebaseClaims(claims, 'demo-project', now));
});

test('validateFirebaseClaims rejects wrong audience and expired tokens', () => {
  const now = 1_800_000_000;
  assert.throws(() => validateFirebaseClaims({
    aud: 'other-project',
    iss: 'https://securetoken.google.com/demo-project',
    sub: 'uid-123',
    iat: now - 60,
    exp: now + 3600,
  }, 'demo-project', now), /audience/i);

  assert.throws(() => validateFirebaseClaims({
    aud: 'demo-project',
    iss: 'https://securetoken.google.com/demo-project',
    sub: 'uid-123',
    iat: now - 3600,
    exp: now - 1,
  }, 'demo-project', now), /expired/i);
});

test('verifyFirebaseIdToken accepts a signed token with Google JWKS keys array', async () => {
  const now = 1_800_000_000;
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'test-kid' };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = [
    encode({ alg: 'RS256', kid: 'test-kid' }),
    encode({ aud: 'demo-project', iss: 'https://securetoken.google.com/demo-project', sub: 'uid-123', iat: now - 60, exp: now + 3600 }),
  ].join('.');
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(unsigned));
  const token = unsigned + '.' + Buffer.from(signature).toString('base64url');
  const fetchImpl = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });

  const claims = await verifyFirebaseIdToken(token, 'demo-project', fetchImpl, now);
  assert.equal(claims.sub, 'uid-123');
  await assert.rejects(
    verifyFirebaseIdToken(token + 'x', 'demo-project', fetchImpl, now),
    /signature invalid/,
  );
});

test('createLegacySessionCookie creates the existing auth cookie without exposing the secret', async () => {
  const cookie = await createLegacySessionCookie({
    provider: 'google',
    id: 'uid-123',
    email: 'bank@example.com',
    email_verified: true,
  }, 'test-session-secret', 1_800_000_000);
  assert.match(cookie, /^lsuperagen_trial_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /test-session-secret/);
});
