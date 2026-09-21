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

test('login matches the locked lsuperagen.docs mobile-first spec', async () => {
  const html = await read('login.html');
  const visible = visibleHtml(html);
  const text = visibleText(html);

  for (const copy of [
    'lsuperagen.docs',
    'YOUR AI WORKSPACE',
    'เริ่มต้นใช้งาน',
    'เพื่อพัฒนาทักษะเขียนโค้ด สร้างภาพ และอื่นๆ',
    'ด้วย lsuperagent.docs',
    'ลืมรหัสผ่าน?',
    'เข้าสู่ระบบ',
    'หรือ',
    'Google',
    'GitHub',
    'Gmail',
    'ยังไม่มีบัญชีใช่ไหม?',
    'สมัครใช้งาน',
  ]) {
    assert.equal(text.includes(copy), true, `missing locked login copy: ${copy}`);
  }

  assert.match(html, /name=["']email["'][^>]*placeholder=["']อีเมล["']/i);
  assert.match(html, /name=["']password["'][^>]*type=["']password["'][^>]*placeholder=["']รหัสผ่าน["']/i);
  assert.match(html, /href=["']\/auth\/google/i);
  assert.match(html, /href=["']\/auth\/github/i);
  assert.match(html, /href=["']\/signup(?:\.html)?["']/i);
  assert.doesNotMatch(visible, /Guest|ทดลองแชท/i);
});

test('firebase auth client supports real email password sign-in and reset', async () => {
  const source = await read('firebase-auth.js');
  assert.match(source, /signInWithEmailAndPassword/);
  assert.match(source, /sendPasswordResetEmail/);
  assert.match(source, /\[data-email-login\]/);
  assert.match(source, /\[data-password-reset\]/);
});
