// Crawls every HTML file in public/ and checks all same-origin href/src targets against a running server.
// Usage: node scripts/check-links.mjs http://127.0.0.1:8799
import fs from 'node:fs'; import path from 'node:path';
const base = process.argv[2] || 'http://127.0.0.1:8787';
const files = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } }; walk('public');
const targets = new Map();
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="(\/(?!\/)[^"#?]*)/g)) { const u = m[1]; if (!targets.has(u)) targets.set(u, f); }
}
const bad = [];
await Promise.all([...targets].map(async ([u, f]) => {
  const r = await fetch(base + u, { redirect: 'manual' });
  // 2xx ok; 3xx ok only if it is an auth gate (to /login) or a declared redirect; 401 = login-gated API
  const ownerGate = r.status === 503 && (u === '/dev' || u === '/api/dev/status'); // needs OWNER_GOOGLE_EMAIL secret (prod only)
  if (r.status >= 400 && r.status !== 401 && !ownerGate) bad.push(`${r.status} ${u}  (from ${f})`);
}));
console.log(`checked ${targets.size} unique internal URLs from ${files.length} HTML files`);
if (bad.length) { console.log('BROKEN:\n' + bad.sort().join('\n')); process.exit(1); } else console.log('no broken links');
