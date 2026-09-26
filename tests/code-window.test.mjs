import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tokenize, detectLang } from '../assets/code-window.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const types = (code, lang) => tokenize(code, lang).filter((t) => t.type).map((t) => [t.type, t.text]);

test('tokenize is lossless for every language', () => {
  const samples = {
    python: read('assets/lab/lab_harness.py'),
    js: read('assets/code-window.js'),
    bash: '$ npm install lsupergen-sdk\n$ curl -s "$BASE/v1/health" --header x # note',
    json: '{ "ok": true, "items": [1, 2.5, null], "name": "x" }',
    text: 'plain <b>text</b> & more',
  };
  for (const [lang, code] of Object.entries(samples)) {
    assert.equal(tokenize(code, lang).map((t) => t.text).join(''), code, lang);
  }
});

test('python tokens', () => {
  const got = types('@dataclass\nclass A:\n    def run(self) -> None:  # go\n        return "hi"', 'python');
  assert.deepEqual(got.slice(0, 3), [['decorator', '@dataclass'], ['def', 'class'], ['def', 'def']]);
  assert.ok(got.some(([t, v]) => t === 'func' && v === 'run'));
  assert.ok(got.some(([t, v]) => t === 'constant' && v === 'None'));
  assert.ok(got.some(([t, v]) => t === 'comment' && v === '# go'));
  assert.ok(got.some(([t, v]) => t === 'string' && v === '"hi"'));
});

test('strings and comments win over keywords inside them', () => {
  assert.deepEqual(types("x = 'return if class'", 'python'), [['string', "'return if class'"]]);
  assert.deepEqual(types('// const await', 'js'), [['comment', '// const await']]);
});

test('js, bash and json tokens', () => {
  const js = types("import { Lsupergen } from 'lsupergen-sdk';\nconst me = await client.get('/me');", 'js');
  assert.ok(js.some(([t, v]) => t === 'keyword' && v === 'await'));
  assert.ok(js.some(([t, v]) => t === 'func' && v === 'get'));
  assert.ok(js.some(([t, v]) => t === 'type' && v === 'Lsupergen'));
  const sh = types('$ npm install --save x', 'bash');
  assert.deepEqual(sh.slice(0, 3), [['prompt', '$'], ['func', 'npm'], ['flag', '--save']]);
  const json = types('{"ok": true}', 'json');
  assert.deepEqual(json, [['property', '"ok"'], ['constant', 'true']]);
});

test('detectLang uses the file name first, then the content', () => {
  assert.equal(detectLang('lab_harness.py'), 'python');
  assert.equal(detectLang('typed.ts'), 'ts');
  assert.equal(detectLang('client.mjs'), 'js');
  assert.equal(detectLang('JSON', '{}'), 'json');
  assert.equal(detectLang('terminal', 'pip install x'), 'bash');
  assert.equal(detectLang('curl', 'curl -s https://x'), 'bash');
  assert.equal(detectLang('', 'from agents import Agent\n'), 'python');
  assert.equal(detectLang('', "const a = await f();"), 'js');
  assert.equal(detectLang('flow', 'agent_start → tool_end'), 'text');
});

test('docs and landing page load the code window', () => {
  assert.match(read('assets/docs.js'), /import \{ enhanceCodeBlocks \} from '\/assets\/code-window\.js'/);
  assert.match(read('docs-shell.html'), /href="\/assets\/code-window\.css"/);
  const landing = read('loading.html');
  assert.match(landing, /<pre data-code-window/);
  assert.match(landing, /<script type="module" src="\/assets\/code-window\.js"><\/script>/);
  assert.doesNotMatch(read('assets/code-window.js'), /innerHTML|insertAdjacentHTML|document\.write/);
});
