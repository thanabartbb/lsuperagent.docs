import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  platformEmailSignIn,
  platformEmailSignUp,
} from '../src/firebase-core.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('worker exposes platform email auth routes', async () => {
  const source = await read('src/firebase-worker.js');
  assert.match(source, /\/api\/auth\/platform\/login/);
  assert.match(source, /\/api\/auth\/platform\/register/);
  assert.match(source, /\/api\/auth\/platform\/password-reset/);
});

test('platformEmailSignIn calls Identity Toolkit signInWithPassword', async () => {
  let capturedUrl = '';
  let capturedBody = null;
  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ idToken: 'mock-id-token', localId: 'uid-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await platformEmailSignIn({
    FIREBASE_API_KEY: 'test-api-key',
  }, 'user@example.com', 'secret12', fetchImpl);

  assert.match(capturedUrl, /signInWithPassword/);
  assert.match(capturedUrl, /test-api-key/);
  assert.equal(capturedBody.email, 'user@example.com');
  assert.equal(capturedBody.returnSecureToken, true);
  assert.equal(result.idToken, 'mock-id-token');
});

test('signup page includes platform email registration form', async () => {
  const html = await read('signup.html');
  assert.match(html, /data-email-register/);
  assert.match(html, /name=["']password_confirm["']/);
});
