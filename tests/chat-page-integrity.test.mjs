import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../src/firebase-worker.js';

test('chat browser script is valid JavaScript', async () => {
  const source = await readFile(new URL('../assets/chat.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(source));
});

test('chat keeps the intended LLM development hint', async () => {
  const source = await readFile(new URL('../assets/chat.js', import.meta.url), 'utf8');
  assert.match(source, /\$\('hint'\)\.textContent = 'กำลังพัฒนา ระบบ LLM';/);
});

test('legacy /chat.html redirects to the canonical /chat page and preserves the query', async () => {
  const response = await worker.fetch(new Request('https://agents-sdk.space/chat.html?mode=code'), {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/chat?mode=code');
});
