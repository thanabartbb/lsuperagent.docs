// Compare a proposed change against its base. This audits code only; it never edits files.
// Existing UI files are immutable. Adding a new file is allowed, but replacing an
// existing UI document, theme, navigation, route or chat adapter is not.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const specific = new Set([
  '.assetsignore', '_headers', '_redirects', 'wrangler.toml',
  'app.css', 'app-shell.js', 'firebase-auth.js',
  'logo.svg', 'src/agent-ui.js', 'src/public-resources.js'
]);

export function isProtectedExistingUIPath(file) {
  if (specific.has(file)) return true;
  if (/^(assets|next-app|docs-content|vendor)\//.test(file)) return true;
  if (/^(?:public|static)\//.test(file)) return true;
  if (/^[^/]+\.(?:html|css|svg|png|jpe?g|webp|gif|ico|woff2?)$/i.test(file)) return true;
  return false;
}

const uiRoutes = /(?:^|["'\x60])\/(?:chat|home|loading|login|signup|forgot-password|agent-ui|docs|tools|guide|keys|news|exa|dev)(?:["'\x60/?]|$)/;
const uiHandlers = /\b(?:handleAgentUI|legacyChatFallback|adaptAgentHtml|adaptAgentScript|agentRuntimeBindingReady|publicResource|currentPage|renderPage)\b/;

export function isProtectedUIRouterChange(line) {
  return uiRoutes.test(line) || uiHandlers.test(line);
}

export function evaluateDiff(changed, routerLines = []) {
  const violations = [];
  for (const { status, file } of changed) {
    // New pages may be added, but no tracked UI file can be removed, renamed
    // or modified, even via CSS-only changes.
    if (status !== 'A' && isProtectedExistingUIPath(file)) {
      violations.push('Existing UI is locked: ' + status + ' ' + file);
    }
  }
  for (const line of routerLines) {
    if (isProtectedUIRouterChange(line)) violations.push('Existing UI route/adapter changed: ' + line.slice(0, 200));
  }
  return violations;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function changes(base, head) {
  const raw = git(['diff', '--no-renames', '--name-status', '-z', base, head]);
  const tokens = raw.split('\0');
  const changed = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    if (!tokens[i]) break;
    changed.push({ status: tokens[i].charAt(0), file: tokens[i + 1] });
  }
  return changed;
}

function changedRouterLines(base, head) {
  const patch = git(['diff', '--no-ext-diff', '--unified=0', base, head, '--', 'src/index.js', 'src/firebase-worker.js']);
  return patch.split('\n')
    .filter(line => (line.startsWith('+') && !line.startsWith('+++'))
                 || (line.startsWith('-') && !line.startsWith('---')))
    .map(line => line.slice(1));
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const base = process.argv[2], head = process.argv[3] || 'HEAD';
  if (!base || !/^[a-f0-9]{7,40}$/.test(base) || !/^[a-f0-9]{7,40}$/.test(head)) {
    console.error('Usage: node scripts/check-ui-freeze.mjs BASE_SHA HEAD_SHA');
    process.exitCode = 2;
  } else {
    try {
      const changed = changes(base, head);
      const violations = evaluateDiff(changed, changedRouterLines(base, head));
      console.log('UI Freeze: audited ' + changed.length + ' changed files against ' + base.slice(0, 12));
      if (violations.length) {
        console.error(violations.join('\n'));
        console.error('The original UI is locked. Rework as backend-only or request separate UI approval.');
        process.exitCode = 1;
      } else {
        console.log('UI Freeze: PASS (no existing UI file or protected UI route modified).');
      }
    } catch (error) {
      console.error('UI Freeze: unable to inspect git diff: ' + String(error.message).slice(0, 300));
      process.exitCode = 2;
    }
  }
}
