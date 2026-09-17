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

function htmlHeaders(response, tag) {
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('x-lsuperagen-control', tag);
  return headers;
}

function addBodyClass(html, classes) {
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/class\s*=/.test(attrs)) {
      return '<body' + attrs.replace(/class=["']([^"']*)["']/i, (_m, current) => {
        const merged = Array.from(new Set((current + ' ' + classes).trim().split(/\s+/))).join(' ');
        return 'class="' + merged + '"';
      }) + '>';
    }
    return '<body class="' + classes + '"' + attrs + '>';
  });
}

function addChatToFirstHeaderNav(html) {
  return html.replace(/<nav([^>]*)>([\s\S]*?)<\/nav>/i, (match, attrs, inner) => {
    const navShape = attrs + inner.slice(0, 260);
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

function currentPageClass(normalizedPath) {
  if (normalizedPath === '/') return 'index.html';
  return normalizedPath.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '') + '.html';
}

function mobilePolish(html, normalizedPath) {
  const isWorkspace = normalizedPath === '/workspace' || normalizedPath === '/workspace.html';
  html = addBodyClass(html, 'ls-mobile-public-polish-v2' + (isWorkspace ? ' ls-page-workspace' : ''));
  html = addChatToFirstHeaderNav(html);
  html = addChatToFooter(html);

  const page = currentPageClass(normalizedPath);
  if (html.includes('data-ls-mobile-public-polish="v2"')) return html;

  const style = `
<style data-ls-mobile-public-polish="v2">
.ls-footer-chat{max-width:1200px;margin:10px auto 0;padding:0 clamp(16px,4vw,40px);display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.74rem;color:var(--fg3,var(--fg-muted,#7c828c))}
.ls-footer-chat a{display:inline-flex;align-items:center;border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:999px;padding:6px 10px;color:var(--fg,var(--fg-primary,#f5f7f9));text-decoration:none;background:var(--surf-in,var(--surface-inset,#0a0a0b))}
.ls-footer-chat span{color:var(--fg3,var(--fg-muted,#7c828c))}
.ls-native-menu{display:none}
@media(max-width:899px){
  .primary-nav,.pnav,.nav{display:none!important}
  .menu-btn,.mbtn{display:none!important}
  .ls-native-menu{display:block;position:fixed;z-index:600;top:20px;right:28px;color:var(--fg,var(--fg-primary,#f5f7f9));font-family:var(--fd,var(--font-body,"Inter","Noto Sans Thai",system-ui,sans-serif))}
  .ls-native-menu>summary{list-style:none;width:52px;height:52px;border-radius:14px;border:1px solid var(--bd2,var(--border-default,#26292f));background:rgba(10,10,11,.94);box-shadow:0 0 0 1px rgba(99,179,255,.05),0 10px 28px rgba(0,0,0,.24);backdrop-filter:blur(14px);display:grid;place-items:center;cursor:pointer;user-select:none}
  .ls-native-menu>summary::-webkit-details-marker{display:none}
  .ls-native-menu>summary:focus-visible{outline:2px solid var(--acc,#63b3ff);outline-offset:3px}
  .ls-native-menu[open]>summary{background:rgba(35,82,105,.92);border-color:rgba(99,179,255,.35)}
  .ls-native-menu[open]::before{content:"";position:fixed;inset:0;background:rgba(0,0,0,.56);backdrop-filter:blur(5px);z-index:-1}
  .ls-native-panel{position:fixed;top:84px;right:16px;left:16px;max-height:calc(100vh - 110px);overflow:auto;border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:16px;background:linear-gradient(180deg,rgba(18,19,22,.98),rgba(6,6,6,.98));box-shadow:0 22px 70px rgba(0,0,0,.55);padding:14px;display:grid;gap:12px}
  .ls-native-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--bd,var(--border-subtle,#1c1e22));padding:2px 2px 12px}
  .ls-native-title{font-weight:800;letter-spacing:-.02em}.ls-native-sub{font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.68rem;color:var(--fg3,var(--fg-muted,#7c828c));letter-spacing:.12em;margin-top:2px}
  .ls-native-links{display:grid;gap:8px}.ls-native-links a{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--bd,var(--border-subtle,#1c1e22));border-radius:12px;padding:12px 13px;background:var(--surf-in,var(--surface-inset,#0a0a0b));color:var(--fg2,var(--fg-secondary,#a2a7b0));text-decoration:none}.ls-native-links a[aria-current="page"],.ls-native-links a:hover{border-color:var(--acc,#63b3ff);background:rgba(99,179,255,.06);color:var(--fg,var(--fg-primary,#f5f7f9))}
  .ls-native-note{border-left:2px solid var(--acc,#63b3ff);padding-left:10px;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.7rem;line-height:1.6;color:var(--fg3,var(--fg-muted,#7c828c))}
}
@media(min-width:900px){.ls-native-menu{display:none!important}}
@media(max-width:720px){
  .ws-tabs{overflow-x:auto!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;box-shadow:inset -34px 0 26px -24px rgba(6,6,6,.92)}.ws-tabs::-webkit-scrollbar{display:none}.ws-tab{flex:0 0 auto!important}
  .tbar{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}.tbar::-webkit-scrollbar{display:none}
  .sniff-table-wrap{overflow:visible!important;border:0!important;background:transparent!important}.sniff-table{width:100%!important;min-width:0!important;border-collapse:separate!important;border-spacing:0 10px!important}.sniff-table thead{display:none!important}.sniff-table tbody,.sniff-table tr,.sniff-table td{display:block!important;width:100%!important}.sniff-table tr{border:1px solid var(--border-subtle,var(--bd,#1c1e22));border-radius:12px;background:var(--surface-inset,var(--surf-in,#0a0a0b));padding:12px;margin:0 0 10px;overflow:hidden}.sniff-table td{border:0!important;padding:3px 0!important;color:var(--fg-secondary,var(--fg2,#a2a7b0))!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}.sniff-table td:nth-child(1){font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));color:var(--accent-strong,var(--acc2,#8ec6ff))!important;font-weight:700}.sniff-table td:nth-child(1)::before{content:"Gate ";color:var(--fg-muted,var(--fg3,#7c828c));font-weight:500}.sniff-table td:nth-child(2)::before{content:"Name: ";font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(3)::before{content:"Status: ";font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(4)::before{content:"Evidence: ";display:block;margin-top:4px;font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(4){margin-top:4px;padding-top:8px!important;border-top:1px solid var(--border-subtle,var(--bd,#1c1e22))!important}
}
@media(max-width:560px){.ls-footer-chat{display:grid;grid-template-columns:1fr;gap:8px}.ls-footer-chat a{justify-content:center}.sniff-table td{font-size:.84rem!important}}
</style>`;

  const nativeMenu = `
<details class="ls-native-menu" data-ls-mobile-public-polish="v2">
  <summary aria-label="เปิดเมนู"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary>
  <div class="ls-native-panel" role="navigation" aria-label="เมนูมือถือ">
    <div class="ls-native-head"><div><div class="ls-native-title">lsuperagen.docs</div><div class="ls-native-sub">PUBLIC NAV</div></div></div>
    <nav class="ls-native-links">
      <a href="index.html" ${page === 'index.html' ? 'aria-current="page"' : ''}>หน้าแรก <span>→</span></a>
      <a href="chat.html" ${page === 'chat.html' ? 'aria-current="page"' : ''}>Chat <span>→</span></a>
      <a href="getting-started.html" ${page === 'getting-started.html' ? 'aria-current="page"' : ''}>Docs <span>→</span></a>
      <a href="guides.html" ${page === 'guides.html' ? 'aria-current="page"' : ''}>Guides <span>→</span></a>
      <a href="api.html" ${page === 'api.html' ? 'aria-current="page"' : ''}>API <span>→</span></a>
      <a href="tools.html" ${page === 'tools.html' ? 'aria-current="page"' : ''}>Tools <span>→</span></a>
      <a href="examples.html" ${page === 'examples.html' ? 'aria-current="page"' : ''}>SDK Plug Tools <span>→</span></a>
      <a href="workspace.html" ${page === 'workspace.html' ? 'aria-current="page"' : ''}>Workspace <span>→</span></a>
      <a href="changelog.html" ${page === 'changelog.html' ? 'aria-current="page"' : ''}>Changelog <span>→</span></a>
    </nav>
    <div class="ls-native-note">Mobile Public Polish V2 · native menu fallback · no fake runtime</div>
  </div>
</details>`;

  html = html.replace(/<\/head>/i, style + '\n</head>');
  html = html.replace(/<\/body>/i, nativeMenu + '\n</body>');
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
        return json({ ok: false, status: 'method_not_allowed', message: 'Use POST /api/chat.' }, 405, { allow: 'POST, OPTIONS' });
      }

      let body = {};
      try { body = await request.json(); } catch (_) { body = {}; }

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

    if (!contentType.includes('text/html')) return response;

    let html = await response.text();
    if (normalizedPath === '/' || normalizedPath === '/index' || normalizedPath === '/index.html') {
      html = applyHomeEnhancements(html);
    }
    html = mobilePolish(html, normalizedPath);

    return new Response(html, { status: response.status, headers: htmlHeaders(response, 'mobile-public-polish-v2') });
  }
};
