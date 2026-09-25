import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function visibleHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function visibleText(html) {
  return visibleHtml(html)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

test('login offers email, Google, GitHub, reset and signup without guest access', async () => {
  const html = await read('login.html');
  const visible = visibleHtml(html);
  const text = visibleText(html);

  assert.match(text, /LSUPERAGENT/);
  assert.match(text, /เข้าสู่ระบบด้วย Google/);
  assert.match(html, /href=["']\/auth\/google\?return_to=\/chat["']/i);
  assert.match(html, /href=["']\/auth\/github\?return_to=\/chat["']/i);
  assert.match(html, /data-email-login/);
  assert.match(html, /href=["']\/forgot-password["']/);
  assert.match(html, /href=["']\/signup["']/);
  assert.doesNotMatch(visible, /Guest|ทดลองแชท/i);
});

test('reset page invokes the existing password reset endpoint', async () => {
  const html = await read('forgot-password.html');
  assert.match(html, /data-email-reset/);
  assert.match(html, /data-password-reset/);
  const source = await read('firebase-auth.js');
  assert.match(source, /attachPasswordReset\(resetForm\)/);
});

test('authenticated home is guarded by the worker and links to chat', async () => {
  const worker = await read('src/index.js');
  const home = await read('home.html');
  assert.match(worker, /\['\/home', '\/home'\]/);
  assert.match(home, /href="\/chat"/);
  assert.match(home, /\/api\/auth\/session/);
});

test('firebase auth client uses platform email login and reset endpoints', async () => {
  const source = await read('firebase-auth.js');
  assert.match(source, /\/api\/auth\/platform\/login/);
  assert.match(source, /\/api\/auth\/platform\/password-reset/);
  assert.match(source, /\/api\/auth\/platform\/register/);
  assert.match(source, /\[data-email-login\]/);
  assert.match(source, /\[data-password-reset\]/);
  assert.match(source, /\[data-email-register\]/);
});
