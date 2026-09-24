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

test('login uses the supplied visual layout and existing Google OAuth route', async () => {
  const html = await read('login.html');
  const visible = visibleHtml(html);
  const text = visibleText(html);

  assert.match(text, /LSUPERAGENT/);
  assert.match(text, /เข้าสู่ระบบด้วย Google/);
  assert.match(html, /href=["']\/auth\/google\?return_to=\/chat["']/i);
  assert.doesNotMatch(visible, /Continue with GitHub|Continue with Email|Sign Up/i);
  assert.doesNotMatch(visible, /Guest|ทดลองแชท/i);
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
