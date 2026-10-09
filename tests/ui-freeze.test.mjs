import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDiff, isProtectedExistingUIPath, isProtectedUIRouterChange } from '../scripts/check-ui-freeze.mjs';

test('UI freeze locks existing HTML CSS scripts icons and Worker-served home', () => {
  for (const f of [
    'home.html', 'login.html', 'chat.html', 'assets/chat.js',
    'assets/homepage.css', 'assets/sdkspace-logo.svg',
    'src/agent-ui.js', 'src/public-resources.js',
    'next-app/app/home/page.jsx', 'wrangler.toml', '.assetsignore'
  ]) assert.equal(isProtectedExistingUIPath(f), true, f);
});

test('UI freeze allows new backend functionality and documentation', () => {
  for (const f of [
    'src/new-agent-backend.js', 'services/new-agent/src/index.js',
    'runtime/codex-app-server/client.mjs', 'tests/agents.test.mjs',
    'docs/audits/new-report.md', 'migrations/0005_feature.sql'
  ]) assert.equal(isProtectedExistingUIPath(f), false, f);
  assert.deepEqual(evaluateDiff([
    { status: 'A', file: 'services/new-agent/src/index.js' },
    { status: 'M', file: 'src/index.js' },
    { status: 'A', file: 'new-tool.html' }
  ], ["if (pathname === '/api/new-agent') return handleNewAgent(request, env);"]), []);
});

test('UI freeze rejects replacement, removal and rename of existing pages', () => {
  assert.equal(evaluateDiff([{ status: 'M', file: 'chat.html' }]).length, 1);
  assert.equal(evaluateDiff([{ status: 'D', file: 'assets/theme.css' }]).length, 1);
  assert.equal(evaluateDiff([{ status: 'D', file: 'login.html' },
    { status: 'A', file: 'login-new.html' }]).length, 1);
});

test('UI freeze rejects edits to existing UI routing, even in backend file', () => {
  for (const line of [
    "if (pathname === '/chat') return handleAgentUI(request, env, pathname);",
    "if (pathname === '/home') return redirectTo('/loading');",
    'return legacyChatFallback(request, env);',
    'return publicResource(request, env);'
  ]) assert.equal(isProtectedUIRouterChange(line), true, line);
  assert.equal(isProtectedUIRouterChange("if (pathname === '/api/sandbox/sessions') return sandboxApi(request, env);"), false);
  assert.equal(isProtectedUIRouterChange("if (pathname === '/api/chat') return handleChat(request, env);"), false);
});
