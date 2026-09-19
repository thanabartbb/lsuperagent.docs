import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firebaseConfigFromEnv,
  firebaseProviderFromClaims,
  validateFirebaseClaims,
  createLegacySessionCookie,
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
  assert.equal(firebaseProviderFromClaims({ firebase: { sign_in_provider: 'password' } }), 'firebase');
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
