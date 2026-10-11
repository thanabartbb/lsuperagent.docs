import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adaptAgentHtml, adaptAgentScript, agentAssetPath } from '../src/agent-ui.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const entry = '<!doctype html><html><head><title>Agent Starter</title></head><body><div id="root"></div><script type="module" src="/assets/index-build.js"></script></body></html>';

test('agent chat loads a presentation-only layer on the existing same-origin Agent Starter', () => {
  const html = adaptAgentHtml(entry);
  assert.match(html, /id="sdkspace-chat-viewport"/);
  assert.match(html, /assets\/agent-chat-reference\.css\?v=1/);
  assert.match(html, /assets\/agent-chat-reference\.js\?v=1/);
  assert.match(html, /\/agent-ui\/assets\/index-build\.js/);
  assert.equal((html.match(/agent-chat-reference\.css/g) || []).length, 1);
  assert.equal((html.match(/agent-chat-reference\.js/g) || []).length, 1);
  assert.equal(agentAssetPath('/agent-ui/assets/index-build.js'), '/assets/index-build.js');
});

test('adapter does not change Cloudflare Agent transport or per-user instance isolation', () => {
  const source = 'const agent=On({agent:' + String.fromCharCode(96) + 'ChatAgent' + String.fromCharCode(96) + ',onOpen:()=>{}});';
  const one = adaptAgentScript(source, 'u_' + 'a'.repeat(24));
  const two = adaptAgentScript(source, 'u_' + 'b'.repeat(24));
  assert.notEqual(one, two);
  assert.match(one, /agent:/);
  assert.match(one, /host:location\.host/);
  assert.throws(() => adaptAgentScript(source, 'default'));
});

test('the UI preserves original send, upload, streaming, approval and clear handlers', async () => {
  const js = await read('assets/agent-chat-reference.js');
  assert.match(js, /button\.click\(\)/); // delegates to original React clearHistory button
  assert.match(js, /SDKSPACE Agent Chat/);
  assert.match(js, /api\/auth\/session/);
  assert.match(js, /nativeClear\(\)/);
  assert.doesNotMatch(js, /sendMessage\(|useAgentChat\(|new WebSocket\(|\/api\/chat['"]/);
  assert.doesNotMatch(js, /addEventListener\(['"]submit['"]/);
  assert.doesNotMatch(js, /fetch\(['"]\/agents\//);
});

test('mobile layout is explicitly scoped to the existing Agent Starter UI', async () => {
  const css = await read('assets/agent-chat-reference.css');
  const js = await read('assets/agent-chat-reference.js');
  assert.match(css, /html\.sdkspace-agent-reference/);
  assert.match(css, /#sdkspace-agent-history/);
  assert.match(css, /#sdkspace-agent-current-model/);
  assert.match(css, /@media\(max-width: 640px\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(js, /classList\.add\('sdkspace-agent-reference'\)/);
  assert.match(js, /MODEL = 'Kimi K2\.7 Code'/);
  assert.match(js, /โมเดลอื่นต้องรองรับที่ Agent ก่อน/);
});
