import test from 'node:test';
import assert from 'node:assert/strict';
import { publicResource } from '../src/public-resources.js';

test('HTML homepage uses the Thai SDKSPACE landing page and server-side API example', async () => {
  const response = publicResource(new Request('https://agents-sdk.space/'), '/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();

  for (const text of [
    '<html lang="th">',
    'SDKSPACE',
    'พร้อมต่อยอดเป็น Agent',
    'href="/login"',
    'href="/developers"',
    '/assets/homepage.css?v=1',
    'https://agents-sdk.space/v1/chat',
    'process.env.SDKSPACE_API_KEY',
    'aria-label="เมนูหลัก"',
  ]) assert.ok(html.includes(text), `homepage should include ${text}`);

  assert.doesNotMatch(html, /rolldown|voidzero/i);
});

test('homepage Markdown remains available to content-aware clients', async () => {
  const response = publicResource(new Request('https://agents-sdk.space/', {
    headers: { accept: 'text/markdown' },
  }), '/');
  assert.match(response.headers.get('content-type'), /text\/markdown/);
  const markdown = await response.text();
  assert.match(markdown, /^# SDKSPACE/m);
  assert.match(markdown, /Developer documentation/);
  assert.doesNotMatch(markdown, /พร้อมต่อยอดเป็น Agent/);
});

test('homepage supports HEAD without returning a body', () => {
  const response = publicResource(new Request('https://agents-sdk.space/', {
    method: 'HEAD',
  }), '/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  return response.text().then(body => assert.equal(body, ''));
});
