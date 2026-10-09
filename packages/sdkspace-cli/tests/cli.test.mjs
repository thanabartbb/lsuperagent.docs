import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../bin/sdkspace-cli.mjs', import.meta.url));
async function sandbox(callback) { const dir = await mkdtemp(path.join(os.tmpdir(), 'sdkspace-cli-test-')); try { await callback(dir); } finally { await rm(dir, { recursive: true, force: true }); } }
function run(dir, ...args) { return spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, SDKSPACE_API_KEY: '' } }); }
test('help, version, templates expose scaffold commands', () => sandbox(async dir => {
  assert.match(run(dir, 'help').stdout, /sdkspace init/);
  assert.equal(run(dir, 'version').stdout.trim(), '0.2.0');
  assert.match(run(dir, 'templates').stdout, /worker:/);
}));
test('next scaffold is complete, credential-free and properly named', () => sandbox(async dir => {
  const r = run(dir, 'init', 'bank-agent', '--template', 'next'); assert.equal(r.status, 0, r.stderr);
  const p = path.join(dir, 'bank-agent');
  assert.equal(JSON.parse(await readFile(path.join(p, 'package.json'), 'utf8')).name, 'bank-agent');
  const route = await readFile(path.join(p, 'app/api/chat/route.js'), 'utf8');
  assert.match(route, /\/v1\/chat/); assert.match(route, /APP_ACCESS_TOKEN/);
  assert.match(await readFile(path.join(p, '.env.example'), 'utf8'), /SDKSPACE_API_KEY=/);
  assert.match(await readFile(path.join(p, '.gitignore'), 'utf8'), /\.env\*/);
  assert.match(await readFile(path.join(p, 'README.md'), 'utf8'), /bank-agent/);
  assert.equal(run(dir, 'init', 'bank-agent').status, 1, 'existing target must not be overwritten');
}));
test('worker scaffold has protected endpoint and Wrangler configuration', () => sandbox(async dir => {
  const r = run(dir, 'init', 'bank-worker', '--template', 'worker'); assert.equal(r.status, 0, r.stderr);
  const p = path.join(dir, 'bank-worker');
  assert.match(await readFile(path.join(p, 'wrangler.toml'), 'utf8'), /name = "bank-worker"/);
  const source = await readFile(path.join(p, 'src/index.mjs'), 'utf8');
  assert.match(source, /APP_ACCESS_TOKEN/); assert.match(source, /\/v1\/chat/);
  assert.match(await readFile(path.join(p, '.gitignore'), 'utf8'), /\.dev\.vars/);
}));
test('invalid templates, arguments, paths and missing keys fail closed', () => sandbox(async dir => {
  for (const args of [['init', '../escape'], ['init', 'hello', '--template', 'unknown'], ['init', 'HELLO'], ['init', 'hello', '--wrong'], ['chat', 'hi'], ['image', 'prompt']]) {
    const result = run(dir, ...args); assert.equal(result.status, 1, `${args.join(' ')} unexpectedly succeeded`);
  }
  assert.equal((await readdir(dir)).length, 0);
}));
test('template packages have parser-valid JS and safe secret defaults', () => sandbox(async dir => {
  const r = run(dir, 'init', 'test-worker', '--template', 'worker'); assert.equal(r.status, 0);
  const source = path.join(dir, 'test-worker/src/index.mjs');
  const syntax = spawnSync(process.execPath, ['--check', source], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.doesNotMatch(await readFile(path.join(dir, 'test-worker/.env.example'), 'utf8'), /lsg_[a-zA-Z0-9]{16}/);
}));
