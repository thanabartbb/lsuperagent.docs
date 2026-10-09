import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adaptAgentHtml, adaptAgentScript, agentAssetPath } from '../src/agent-ui.js';

const read = filename => readFile(new URL('../' + filename, import.meta.url), 'utf8');
const html = '<!doctype html><html><head><title>Agent Starter</title></head><body><div id="root"></div><script type="module" src="/assets/index-demo.js"></script></body></html>';

test('same-origin Agent Starter HTML includes only a visual stylesheet', () => {
  const response = adaptAgentHtml(html);
  assert.match(response, /sdkspace-chat-viewport/);
  assert.match(response, /\/assets\/agent-chat-ui-only\.css\?v=1/);
  assert.equal((response.match(/agent-chat-ui-only\.css/g) || []).length, 1);
  assert.match(response, /\/agent-ui\/assets\/index-demo\.js/);
  assert.doesNotMatch(response, /agent-chat-reference\.js/);
  assert.doesNotMatch(response, /\/api\/chat/);
});

test('Agent Starter bundle adapter and instance scoping are unchanged', () => {
  const t = String.fromCharCode(96);
  const source = 'const agent=On({agent:' + t + 'ChatAgent' + t + ',onOpen:()=>{}});';
  const userA = adaptAgentScript(source, 'u_' + 'a'.repeat(24));
  const userB = adaptAgentScript(source, 'u_' + 'b'.repeat(24));
  assert.notEqual(userA, userB);
  assert.match(userA, /host:location\.host/);
  assert.throws(() => adaptAgentScript(source, 'default'));
  assert.equal(agentAssetPath('/agent-ui/assets/index-demo.js'), '/assets/index-demo.js');
});

test('UI-only styles never hide or replace send, attachments, tools or history', async () => {
  const style = await read('assets/agent-chat-ui-only.css');
  assert.match(style, /aria-label="Send message"/);
  assert.match(style, /aria-label="Attach images"/);
  assert.match(style, /aria-label="Stop generation"/);
  assert.match(style, /html\[data-mode="dark"\]/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /safe-area-inset-bottom/);
  assert.doesNotMatch(style, /display:\s*none[^}]*button/i);
  assert.doesNotMatch(style, /url\(\s*['"]?https?:\/\//);
});

test('UI-only patch does not touch the original website or backend endpoints', async () => {
  const adapter = await read('src/agent-ui.js');
  assert.doesNotMatch(adapter, /fetch\(|WebSocket|\/api\/chat|\/api\/image/);
  assert.match(adapter, /CHAT_UI_ONLY_CSS/);
  assert.match(adapter, /export function adaptAgentScript/);
});
