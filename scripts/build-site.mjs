// Assembles the Worker asset directory `public/` (git-ignored) from:
//   legacy/site/  -> existing lsuperagent.docs pages, served at their ORIGINAL URLs (/login, /home, /chat, /docs/<page> ...)
//   sites/dst/    -> new DST site (built to sites/dst/dist), served at / plus /docs/<section>/<page> and /credits
// The original legacy index.html (a redirect to /home) is kept as /legacy.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public');
const dst = path.join(root, 'sites/dst');

execSync('npm run build', { cwd: dst, stdio: 'inherit' });

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'legacy/site'), out, { recursive: true });
fs.renameSync(path.join(out, 'index.html'), path.join(out, 'legacy.html'));

const dist = path.join(dst, 'dist');
for (const entry of fs.readdirSync(dist)) {
  const target = path.join(out, entry);
  if (fs.existsSync(target) && entry !== 'docs') throw new Error(`asset collision: ${entry}`);
  fs.cpSync(path.join(dist, entry), target, { recursive: true });
}
console.log('public/ assembled: legacy + DST');
