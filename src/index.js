function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

function withHtmlHeaders(response, tag) {
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('x-lsuperagen-control', tag);
  return headers;
}

function addBodyClass(html, classes) {
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/class\s*=/.test(attrs)) {
      return '<body' + attrs.replace(/class=["']([^"']*)["']/i, (classMatch, current) => {
        const merged = Array.from(new Set((current + ' ' + classes).trim().split(/\s+/))).join(' ');
        return 'class="' + merged + '"';
      }) + '>';
    }
    return '<body class="' + classes + '"' + attrs + '>';
  });
}

function addChatToFirstHeaderNav(html) {
  return html.replace(/<nav([^>]*)>([\s\S]*?)<\/nav>/i, (match, attrs, inner) => {
    const navShape = attrs + inner.slice(0, 240);
    if (!/(primary-nav|pnav|class="nav|เมนูหลัก|main navigation)/i.test(navShape)) return match;
    if (/href=["'](?:\/)?chat(?:\.html)?["']/i.test(inner)) return match;
    return '<nav' + attrs + '>' + inner + '<a href="chat.html">Chat</a></nav>';
  });
}

function addChatToFooter(html) {
  return html.replace(/<footer([^>]*)>([\s\S]*?)<\/footer>/i, (match, attrs, inner) => {
    if (/href=["'](?:\/)?chat(?:\.html)?["']/i.test(inner)) return match;
    const link = '<div class="ls-footer-chat"><a href="chat.html">Chat</a><span>Public Chat V1</span></div>';
    return '<footer' + attrs + '>' + inner + link + '</footer>';
  });
}

function addMobilePolish(html, normalizedPath) {
  const isWorkspace = normalizedPath === '/workspace' || normalizedPath === '/workspace.html';
  html = addBodyClass(html, 'ls-mobile-public-polish-v1' + (isWorkspace ? ' ls-page-workspace' : ''));
  html = addChatToFirstHeaderNav(html);
  html = addChatToFooter(html);

  if (html.includes('data-ls-mobile-public-polish="v1"')) return html;

  const style = `
<style data-ls-mobile-public-polish="v1">
.ls-footer-chat{max-width:1200px;margin:10px auto 0;padding:0 clamp(16px,4vw,40px);display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.74rem;color:var(--fg3,var(--fg-muted,#7c828c))}
.ls-footer-chat a{display:inline-flex;align-items:center;border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:999px;padding:6px 10px;color:var(--fg,var(--fg-primary,#f5f7f9));text-decoration:none;background:var(--surf-in,var(--surface-inset,#0a0a0b))}
.ls-footer-chat span{color:var(--fg3,var(--fg-muted,#7c828c))}
#ls-menu-backdrop{position:fixed;inset:0;z-index:199;background:rgba(0,0,0,.62);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity 160ms ease}
#ls-mobile-drawer{position:fixed;z-index:200;top:10px;right:10px;bottom:10px;width:min(330px,calc(100vw - 20px));transform:translateX(calc(100% + 18px));transition:transform 180ms cubic-bezier(.2,.6,.2,1);border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:16px;background:linear-gradient(180deg,rgba(18,19,22,.98),rgba(6,6,6,.98));box-shadow:-18px 0 50px rgba(0,0,0,.45);padding:16px;display:flex;flex-direction:column;gap:14px}
body.ls-menu-open #ls-menu-backdrop{opacity:1;pointer-events:auto}
body.ls-menu-open #ls-mobile-drawer{transform:translateX(0)}
.ls-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--bd,var(--border-subtle,#1c1e22));padding-bottom:12px}
.ls-drawer-title{font-weight:800;letter-spacing:-.02em;color:var(--fg,var(--fg-primary,#f5f7f9))}.ls-drawer-sub{font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.68rem;color:var(--fg3,var(--fg-muted,#7c828c));letter-spacing:.12em;margin-top:2px}.ls-drawer-close{width:38px;height:38px;border-radius:10px;border:1px solid var(--bd2,var(--border-default,#26292f));background:var(--surf-in,var(--surface-inset,#0a0a0b));color:var(--fg,var(--fg-primary,#f5f7f9));cursor:pointer}.ls-drawer-links{display:grid;gap:8px}.ls-drawer-links a{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--bd,var(--border-subtle,#1c1e22));border-radius:12px;padding:12px 13px;background:var(--surf-in,var(--surface-inset,#0a0a0b));color:var(--fg2,var(--fg-secondary,#a2a7b0));text-decoration:none}.ls-drawer-links a:hover,.ls-drawer-links a[aria-current="page"]{border-color:var(--acc,#63b3ff);background:rgba(99,179,255,.06);color:var(--fg,var(--fg-primary,#f5f7f9))}.ls-drawer-note{margin-top:auto;border-left:2px solid var(--acc,#63b3ff);padding-left:10px;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.7rem;line-height:1.6;color:var(--fg3,var(--fg-muted,#7c828c))}.ls-menu-fab{position:fixed;z-index:198;right:14px;top:14px;width:42px;height:42px;border-radius:12px;border:1px solid var(--bd2,var(--border-default,#26292f));background:rgba(10,10,11,.9);backdrop-filter:blur(12px);color:var(--fg,var(--fg-primary,#f5f7f9));display:none;place-items:center}.ls-menu-fab svg{width:20px;height:20px}.ls-menu-fab.is-hidden{display:none!important}
@media(max-width:899px){.ls-menu-fab{display:grid}.primary-nav,.pnav,.nav{display:none!important}.menu-btn,.mbtn{display:grid!important}}
@media(min-width:900px){#ls-menu-backdrop,#ls-mobile-drawer,.ls-menu-fab{display:none!important}}
@media(max-width:720px){.ws-tabs{overflow-x:auto!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;box-shadow:inset -34px 0 26px -24px rgba(6,6,6,.92)}.ws-tabs::-webkit-scrollbar{display:none}.ws-tab{flex:0 0 auto!important}.sniff-table-wrap{overflow:visible!important;border:0!important;background:transparent!important}.sniff-table{width:100%!important;min-width:0!important;border-collapse:separate!important;border-spacing:0 10px!important}.sniff-table thead{display:none!important}.sniff-table tbody,.sniff-table tr,.sniff-table td{display:block!important;width:100%!important}.sniff-table tr{border:1px solid var(--border-subtle,var(--bd,#1c1e22));border-radius:12px;background:var(--surface-inset,var(--surf-in,#0a0a0b));padding:12px;margin:0 0 10px;overflow:hidden}.sniff-table td{border:0!important;padding:3px 0!important;color:var(--fg-secondary,var(--fg2,#a2a7b0))!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}.sniff-table td:nth-child(1){font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));color:var(--accent-strong,var(--acc2,#8ec6ff))!important;font-weight:700}.sniff-table td:nth-child(1)::before{content:"Gate ";color:var(--fg-muted,var(--fg3,#7c828c));font-weight:500}.sniff-table td:nth-child(2)::before{content:"Name: ";font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(3)::before{content:"Status: ";font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(4)::before{content:"Evidence: ";display:block;margin-top:4px;font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(4){margin-top:4px;padding-top:8px!important;border-top:1px solid var(--border-subtle,var(--bd,#1c1e22))!important}.tbar{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}.tbar::-webkit-scrollbar{display:none}}
@media(max-width:560px){.ls-footer-chat{display:grid;grid-template-columns:1fr;gap:8px}.ls-footer-chat a{justify-content:center}.sniff-table td{font-size:.84rem!important}}
</style>`;

  const drawer = `
<div id="ls-menu-backdrop" aria-hidden="true"></div>
<button id="ls-menu-fab" class="ls-menu-fab" type="button" aria-label="เปิดเมนู" aria-controls="ls-mobile-drawer" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
<aside id="ls-mobile-drawer" aria-label="Mobile navigation" aria-hidden="true">
  <div class="ls-drawer-head"><div><div class="ls-drawer-title">lsuperagen.docs</div><div class="ls-drawer-sub">PUBLIC NAV</div></div><button class="ls-drawer-close" type="button" aria-label="ปิดเมนู">×</button></div>
  <nav class="ls-drawer-links" aria-label="เมนูมือถือ">
    <a href="index.html">หน้าแรก <span>→</span></a>
    <a href="chat.html">Chat <span>→</span></a>
    <a href="getting-started.html">Docs <span>→</span></a>
    <a href="guides.html">Guides <span>→</span></a>
    <a href="api.html">API <span>→</span></a>
    <a href="tools.html">Tools <span>→</span></a>
    <a href="examples.html">SDK Plug Tools <span>→</span></a>
    <a href="workspace.html">Workspace <span>→</span></a>
    <a href="changelog.html">Changelog <span>→</span></a>
  </nav>
  <div class="ls-drawer-note">Mobile Public Polish V1 · Visual identity preserved · no layout rebuild</div>
</aside>`;

  const script = `
<script data-ls-mobile-public-polish="v1">
(function(){
  var body=document.body,drawer=document.getElementById('ls-mobile-drawer'),backdrop=document.getElementById('ls-menu-backdrop'),fab=document.getElementById('ls-menu-fab');
  if(!drawer||!backdrop)return;
  var toggles=Array.prototype.slice.call(document.querySelectorAll('.menu-btn,.mbtn,[aria-label*="เมนู"],[aria-label*="menu"],[aria-label*="Menu"]')).filter(function(el){return el.id!=='ls-menu-fab'&&!el.classList.contains('ls-drawer-close')});
  if(toggles.length&&fab)fab.classList.add('is-hidden');
  function setOpen(open){body.classList.toggle('ls-menu-open',open);drawer.setAttribute('aria-hidden',open?'false':'true');(fab?[fab]:[]).concat(toggles).forEach(function(btn){btn.setAttribute('aria-expanded',open?'true':'false');btn.setAttribute('aria-controls','ls-mobile-drawer');});}
  function openMenu(e){if(e)e.preventDefault();setOpen(true)}
  function closeMenu(e){if(e)e.preventDefault();setOpen(false)}
  toggles.forEach(function(btn){btn.addEventListener('click',openMenu)});
  if(fab)fab.addEventListener('click',openMenu);
  backdrop.addEventListener('click',closeMenu);
  drawer.querySelector('.ls-drawer-close').addEventListener('click',closeMenu);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu(e)});
  var path=(location.pathname.replace(/\/$/,'')||'/').replace(/^\//,'');
  var map={'':'index.html','index':'index.html','chat':'chat.html','getting-started':'getting-started.html','guides':'guides.html','api':'api.html','tools':'tools.html','examples':'examples.html','workspace':'workspace.html','changelog':'changelog.html'};
  var cur=map[path]||path+'.html';
  drawer.querySelectorAll('a').forEach(function(a){if(a.getAttribute('href')===cur)a.setAttribute('aria-current','page')});
})();
</script>`;

  html = html.replace(/<\/head>/i, style + '\n</head>');
  html = html.replace(/<\/body>/i, drawer + '\n' + script + '\n</body>');
  return html;
}

function applyHomeEnhancements(html) {
  if (!html.includes('href="chat.html"') && !html.includes('href="/chat"')) {
    const marker = '<a class="btn btn-s thai" href="getting-started.html">ดูเอกสารทั้งหมด</a>';
    const chatCta = '<a class="btn btn-s thai" href="chat.html">เปิด Public Chat <svg class="arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>';
    html = html.replace(marker, marker + '\n' + chatCta);
  }

  if (!html.includes('pnpm add @lsuperagen/sdk')) {
    const marker = '</div>\n<ul style="display:flex;flex-wrap:wrap;gap:var(--sp6) var(--sp8);margin:var(--sp10) 0 0;padding:0;list-style:none">';
    const sdkBlock = `</div>
<div aria-label="SDK install command" style="margin-top:var(--sp4);max-width:560px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:12px 14px;background:var(--surf-in);border:1px solid var(--bd2);border-left:2px solid var(--acc);border-radius:var(--r2);font-family:var(--fm);font-size:.82rem;color:var(--s300)">
<span style="font-size:.68rem;letter-spacing:.18em;color:var(--fg3)">SDK INSTALL</span>
<code style="font-family:var(--fm);color:#fff;word-break:break-word">pnpm add @lsuperagen/sdk</code>
</div>
<ul style="display:flex;flex-wrap:wrap;gap:var(--sp6) var(--sp8);margin:var(--sp10) 0 0;padding:0;list-style:none">`;
    html = html.replace(marker, sdkBlock);
  }

  return html;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS' && normalizedPath === '/api/chat') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': url.origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type'
        }
      });
    }

    if (normalizedPath === '/api/chat') {
      if (request.method !== 'POST') {
        return json({
          ok: false,
          status: 'method_not_allowed',
          message: 'Use POST /api/chat.'
        }, 405, { 'allow': 'POST, OPTIONS' });
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        body = {};
      }

      return json({
        ok: false,
        status: 'runtime_not_wired',
        message: 'Runtime not wired. No fake AI response generated. Set Cloudflare Secret and enable provider router before public model output.',
        requested: {
          mode: body.mode || 'fast',
          provider: body.provider || 'OpenAI route',
          has_message: typeof body.message === 'string' && body.message.trim().length > 0
        },
        readiness: {
          frontend: true,
          api_route: true,
          provider_router: false,
          secret_detected: Boolean(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.DEEPSEEK_API_KEY),
          model_output: false
        }
      }, 503, { 'x-lsuperagen-runtime': 'not-wired' });
    }

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      let html = await response.text();
      if (normalizedPath === '/' || normalizedPath === '/index') {
        html = applyHomeEnhancements(html);
      }
      html = addMobilePolish(html, normalizedPath);
      return new Response(html, { status: response.status, headers: withHtmlHeaders(response, 'mobile-public-polish-v1') });
    }

    return response;
  }
};
