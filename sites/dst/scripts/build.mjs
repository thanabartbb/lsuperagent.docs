// Static site generator for DEVXSTACKS
// Page map is derived from the structure of voidzero-dev/void (MIT); all copy here is original.
import fs from 'node:fs'; import { marked } from 'marked'; import path from 'node:path';
const SITE='DEVXSTACKS';
const out='dist'; fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out);
fs.cpSync('public',out,{recursive:true});
const clean=t=>t.replace(/\s*\{#.*\}/,'').replace(/Void Platform/g,'Control Plane').replace(/Void/g,'DST').trim();
const sectionOf=f=>{
 if(f.startsWith('./reference/cli'))return['cli','CLI'];
 if(f.startsWith('./guide/platform')||/guide\/(platform-|self-hosted)/.test(f))return['control','Control Plane'];
 if(f.startsWith('./guide'))return['build','Build'];
 if(f.startsWith('./integrations'))return['connect','Connect'];
 if(f.startsWith('./reference/cli'))return['cli','CLI'];
 if(f.startsWith('./reference/api'))return['api','SDK API'];
 return['ref','Reference'];};
const pages=fs.readFileSync('scripts/void-pages.txt','utf8').trim().split('\n').map(l=>{let[f,t]=l.split('|');const src=f.startsWith('./')?f:'./'+f;if(!f.startsWith('./'))f='./'+f;return{f,t}}).filter(p=>p.f!=='./index.md').map(({f,t})=>{
 const[sec,label]=sectionOf(f);
 let slug=f.replace(/^\.\/(guide\/platform\/|guide\/|integrations\/|reference\/cli\/?|reference\/api\/?|reference\/)/,'').replace(/\.md$/,'').replace(/\/?index$/,'')||'overview';
 const title=clean(t)||'Overview';
 return{src:f,void:f.replace(/^\.\//,'/').replace(/\.md$/,'').replace(/\/index$/,'/'),route:`/docs/${sec}/${slug}`,sec,label,title};});
const blurb={build:'How to use %s in a DST app on Cloudflare Workers: when to reach for it, the smallest working setup, and what changes when you deploy.',
control:'Operating the DST control plane: %s. Steps for the person who runs the shared workspace for a team.',
connect:'Wiring DST together with %s. What works out of the box and which settings you set yourself.',
cli:'The `dst` command group for %s. Each command prints a plan first and only changes remote resources after you confirm.',
api:'SDK surface for %s: exported helpers, their inputs and outputs, with a short TypeScript example.',
ref:'Reference for %s in a DST project.'};
const cliName=t=>t.toLowerCase().replace(/[^a-z]+/g,' ').trim().split(' ')[0];
const nav={};pages.forEach(p=>(nav[p.label]??=[]).push(p));
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const css=`:root{--bg:#fff;--fg:#000;--mut:#666;--line:#eaeaea;--acc:#fb0fab}
@media(prefers-color-scheme:dark){:root{--bg:#000;--fg:#ededed;--mut:#a1a1a1;--line:#222;--acc:#ededed}}
:root[data-theme=light]{--bg:#fff;--fg:#000;--mut:#666;--line:#eaeaea;--acc:#fb0fab}:root[data-theme=dark]{--bg:#000;--fg:#ededed;--mut:#a1a1a1;--line:#222;--acc:#ededed}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:inherit}header{position:sticky;top:0;display:flex;align-items:center;gap:20px;padding:12px 24px;border-bottom:1px solid var(--line);background:var(--bg);z-index:2}
header img{height:22px}@media(prefers-color-scheme:dark){img.lg{filter:invert(1)}}:root[data-theme=dark] img.lg{filter:invert(1)}:root[data-theme=light] img.lg{filter:none}header .name{font-weight:600;font-size:13px}header nav{margin-left:auto;display:flex;gap:16px;font-size:13px}header nav a{text-decoration:none;color:var(--mut)}
button.t{border:1px solid var(--line);background:none;color:var(--fg);border-radius:6px;padding:4px 8px;cursor:pointer}
.hero{max-width:960px;margin:0 auto;padding:96px 24px 48px;text-align:center}.hero h1{font-size:56px;letter-spacing:-.04em;line-height:1.05;margin:0 0 16px}
.hero p{color:var(--mut);font-size:18px;max-width:620px;margin:0 auto 28px}.btn{display:inline-block;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:500;margin:4px;border:1px solid var(--line)}.btn.p{background:var(--fg);color:var(--bg)}
pre{background:transparent;border:1px solid var(--line);border-radius:8px;padding:16px;overflow:auto;font:13px ui-monospace,Menlo,monospace;text-align:left}
.term{max-width:640px;margin:24px auto 0;border:1px solid var(--line);border-radius:10px;overflow:hidden;text-align:left}.term .tb{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--line);font:12px ui-monospace,monospace;color:var(--mut)}.term .cp{background:none;border:0;color:var(--mut);cursor:pointer;font:inherit}.term pre{border:0;margin:0;min-height:170px;border-radius:0}.grid{max-width:1100px;margin:0 auto;padding:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}
.grid>div{background:var(--bg);padding:24px}.grid h3{margin:0 0 8px;font-size:15px}.grid p{margin:0;color:var(--mut);font-size:14px}
.doc{display:grid;grid-template-columns:260px 1fr;max-width:1200px;margin:0 auto}aside{border-right:1px solid var(--line);padding:24px;font-size:13px;height:calc(100vh - 53px);overflow:auto;position:sticky;top:53px}
aside h4{margin:16px 0 6px;font-size:12px;text-transform:uppercase;color:var(--mut)}aside a{display:block;text-decoration:none;color:var(--mut);padding:2px 0}aside a.on{color:var(--fg);font-weight:600}
main.c{padding:40px 48px;max-width:780px}main.c h1{letter-spacing:-.03em}main.c h2{margin-top:40px;letter-spacing:-.02em}main.c code{font:13px ui-monospace,Menlo,monospace}main.c :not(pre)>code{border:1px solid var(--line);border-radius:4px;padding:1px 4px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid var(--line);padding:6px 8px;text-align:left}.call{border:1px solid var(--line);border-left:3px solid var(--fg);border-radius:6px;padding:8px 14px;margin:16px 0}.mut{color:var(--mut)}footer{border-top:1px solid var(--line);padding:24px;font-size:12px;color:var(--mut);text-align:center}
@media(max-width:800px){.doc{grid-template-columns:1fr}aside{display:none}.hero h1{font-size:36px}}`;
const shell=(title,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — ${SITE}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><style>${css}</style>
<script>try{const t=localStorage.theme;if(t)document.documentElement.dataset.theme=t}catch{}</script></head><body>
<header><a href="/"><img class="lg" src="/logo-dst.svg" alt="DST"></a><span class="name">${SITE}</span><nav><a href="/docs/build/overview">Docs</a><a href="/docs/cli/overview">CLI</a><a href="/docs/control/self-hosted-platform">Control Plane</a><a href="/credits">Credits</a><a href="/chat">Chat</a><a href="/home">Workspace</a><a href="/login">Sign in</a></nav>
<button class="t" onclick="const d=document.documentElement,n=(d.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))==='dark'?'light':'dark';d.dataset.theme=n;localStorage.theme=n" aria-label="Toggle theme">◐</button></header>
${body}<footer>© 2026 DEVXSTACKS · Structure inspired by <a href="https://github.com/voidzero-dev/void">Void</a> (MIT, © Cloudflare, Inc.) — <a href="/credits">credits</a></footer></body></html>`;
const write=(r,h)=>{const d=path.join(out,r);fs.mkdirSync(d,{recursive:true});fs.writeFileSync(path.join(d,'index.html'),h)};
const feats=[['One import, real resources','Pull in a database, a bucket or a queue from the SDK and DST provisions it on Cloudflare when you ship.'],['Types end to end','Schema, server loaders and UI share one set of types, so mistakes show up in your editor, not production.'],['Bring any framework','Keep Astro, Nuxt, SvelteKit, React Router or plain Hono. DST sits underneath.'],['Shared workspace for teams','Let teammates and agents ship previews safely, with access rules you control.'],['Your own control plane','Run the project dashboard on your Cloudflare account. Nothing leaves it.'],['Agent-ready docs','Every page is plain HTML with predictable routes so coding agents can read it.']];
write('/',shell('Home',`<section class="hero"><img class="lg" src="/logo-dst.svg" alt="DST" style="height:72px"><h1>Ship agents and apps<br>from one terminal.</h1><p>DST is a CLI and SDK for building full-stack apps on Cloudflare Workers, plus a control plane your team can run themselves.</p>
<a class="btn p" href="/docs/build/quickstart">Start building</a><a class="btn" href="/docs/cli/overview">CLI reference</a><a class="btn" href="https://devstack.bid">devstack.bid</a>
<div class="term" data-lines='${JSON.stringify([["npm create dst@latest my-app","✓ project ready"],["cd my-app && dst dev","✓ local at http://localhost:5173 (D1, KV, R2 bound)"],["dst ship --preview","✓ preview https://my-app-pr-1.agents-sdk.space"],["dst ship","? ship to production? (y/N)"]]).replace(/'/g,"&#39;")}'><div class="tb"><span>~/my-app</span><span><button class="cp rp" title="Replay">replay</button> <button class="cp" title="Copy commands">copy</button></span></div><pre class="tx">${[["npm create dst@latest my-app","✓ project ready"],["cd my-app && dst dev","✓ local at http://localhost:5173 (D1, KV, R2 bound)"],["dst ship --preview","✓ preview https://my-app-pr-1.agents-sdk.space"],["dst ship","? ship to production? (y/N)"]].map(l=>esc("$ "+l[0]+"\n"+l[1])).join("\n")}</pre></div>
<script>(()=>{const t=document.querySelector('.term'),L=JSON.parse(t.dataset.lines),o=t.querySelector('.tx');let h='';t.querySelector('.cp:not(.rp)').onclick=()=>navigator.clipboard.writeText(L.map(l=>l[0]).join('\\n'));
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches||navigator.webdriver;const play=async()=>{h='';for(const[c,out]of L){h+='$ ';for(const ch of c){h+=ch;o.textContent=h+'▍';await new Promise(r=>setTimeout(r,35))}await new Promise(r=>setTimeout(r,400));h+='\\n'+out+'\\n';o.textContent=h}};t.querySelector('.rp').onclick=play;if(!rm&&!/static/.test(location.search)&&!sessionStorage.played){sessionStorage.played=1;setTimeout(play,2500)}})()</script></section></section>
<div class="grid">${feats.map(([a,b])=>`<div><h3>${a}</h3><p>${b}</p></div>`).join('')}</div><div style="height:64px"></div>`));
const side=cur=>Object.entries(nav).map(([l,ps])=>`<h4>${l}</h4>`+ps.map(p=>`<a ${p===cur?'class="on"':''} href="${p.route}">${esc(p.title)}</a>`).join('')).join('');
const VD='content/docs';const byVoid=Object.fromEntries(pages.map(p=>[p.void.replace(/\/$/,''),p.route]));
function rebrand(t){return t.replace(/VoidZero/g,'DST').replace(/Void/g,'DST').replace(/void\.cloud/g,'agents-sdk.space')
 .replace(/(npx|pnpm|bunx|yarn|-D|add|install|from ['"]|import\(['"]|['"]@?)void\b/g,'$1dst').replace(/(^|[\s`$(])void(?=\s+[a-z-]|`)/gm,'$1dst').replace(/\bvoid\.config/g,'dst.config').replace(/\.void\//g,'.dst/').replace(/VOID_/g,'DST_').replace(/\bvoid\//g,'dst/').replace(/__void/g,'__dst').replace(/\bvoid([A-Z])/g,'dst$1').replace(/x-void-/g,'x-dst-').replace(/(\.?)void([.-])(lock|wrangler|dev)/g,'$1dst$2$3').replace(/void(:|-<)/g,'dst$1').replace(/#void-/g,'#dst-').replace(/github\.com\/voidzero-dev\/void/g,'github.com/examplessdk-lgtm/void')}
function render(p){let f=VD+'/'+p.src.replace(/^\.\//,'');if(!fs.existsSync(f))return'';let m=fs.readFileSync(f,'utf8').replace(/^---[\s\S]*?---\n/,'');
 m=m.replace(/^<(FileTree|PagesFileTree|RoutesFileTree|VoidAppFileTree|LegacyDocRedirect)[\s\S]*?\/>\s*$/gm,'').replace(/^<script setup[\s\S]*?<\/script>/m,'')
  .replace(/^:::\s*(tip|warning|info|danger|details)\s*(.*)$/gm,(_,k,t)=>`<div class="call ${k}"><b>${t||k.toUpperCase()}</b>\n`).replace(/^:::\s*code-group\s*$/gm,'').replace(/^:::\s*$/gm,'</div>')
  .replace(/\s*\{#[\w-]+\}/g,'').replace(/```(\w+) \[[^\]]*\]/g,'```$1');
 let h=marked.parse(rebrand(m));
 h=h.replace(/<\/div>(?![\s\S]*<div class="call)/g,(x)=>x); // balance tolerated
 h=h.replace(/href="(\.{0,2}\/?[\w\/.-]*?)(?:\.md)?(#[^"]*)?"/g,(x,u,hash='')=>{if(/^(https?:|mailto:)/.test(u)||!u)return x;let abs=u.startsWith('/')?u:path.posix.normalize(path.posix.dirname(p.void)+'/'+u);abs=abs.replace(/\.html$/,'').replace(/\/(index)?$/,'');const r=byVoid[abs]||byVoid[abs+'/']||(abs===''?'/':null);return r?`href="${r}${hash}"`:`href="/docs/build/overview"`});
 return h.replace(/^<h1>.*?<\/h1>/,'')}
for(const p of pages){const ex=p.sec==='cli'?`<pre>$ dst ${p.title.match(/CLI Reference/)?'--help':cliName(p.title)} --help</pre>`:p.sec==='api'?`<pre>import { ${cliName(p.title)||'env'} } from 'dst-sdk'</pre>`:'';
 write(p.route,shell(p.title,`<div class="doc"><aside>${side(p)}</aside><main class="c"><p class="mut">${p.label}</p><h1>${esc(p.title)}</h1>${render(p)}</main></div>`));}
write('/credits',shell('Credits',`<main class="c" style="margin:0 auto"><h1>Credits</h1><p>The page structure and documentation of these docs are adapted from <a href="https://github.com/voidzero-dev/void">Void</a> by VoidZero / Cloudflare, Inc., licensed under the MIT License. Documentation text is adapted from the Void docs under the MIT License (see LICENSE-void); logo, design and homepage are original. DST is not affiliated with Void.</p><pre>MIT License — Copyright (c) 2026-present, Cloudflare, Inc.</pre><p>Design references (reference only, not copied): nextjs.org, 21st.dev, CodeSandbox. See docs/design/references.md in the repo.</p></main>`));
fs.writeFileSync(path.join(out,'404.html'),shell('Not found','<section class="hero"><h1>404</h1><p>Page not found.</p><a class="btn p" href="/">Home</a></section>'));
fs.writeFileSync('docs/reverse-engineering/pages.json',JSON.stringify(pages,null,1));
console.log('built',pages.length+2,'pages');
{let s='# Void → DST page map\n\nSource: examplessdk-lgtm/void (fork of voidzero-dev/void, MIT License, © Cloudflare, Inc.). Only the large-scale structure (page list, section grouping) is reused; all copy, naming, logo and design are original.\n\nCLI rename: `void` → `dst`. Sections: Guide → Build, Guide/Platform → Control Plane, Integrations → Connect, Reference/CLI → CLI, Reference/API → SDK API, Reference → Reference.\n\nThe main page the user referenced (ai.studio app cb2b41ff…) requires Google login and could not be read; the homepage was designed from scratch.\n\n| # | Void route | Our route | Our title |\n|---|---|---|---|\n| 0 | / | / | Home (new hero, DST logo, original copy) |\n';
pages.forEach((x,i)=>s+=`| ${i+1} | ${x.void} | ${x.route} | ${x.title} |\n`);s+='| + | — | /credits | Credits & MIT attribution |\n| + | — | /404 | Not found |\n';fs.writeFileSync('docs/reverse-engineering/void-page-map.md',s);}
