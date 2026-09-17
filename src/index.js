function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders }
  });
}

function htmlHeaders(response, tag) {
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('x-lsuperagen-control', tag);
  return headers;
}

function currentPage(pathname) {
  if (pathname === '/') return 'index.html';
  return pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, '') + '.html';
}

function addBodyClass(html, classes) {
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/class\s*=/.test(attrs)) {
      return '<body' + attrs.replace(/class=["']([^"']*)["']/i, (_m, current) => {
        return 'class="' + Array.from(new Set((current + ' ' + classes).trim().split(/\s+/))).join(' ') + '"';
      }) + '>';
    }
    return '<body class="' + classes + '"' + attrs + '>';
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addChatToFirstHeaderNav(html) {
  return html.replace(/<nav([^>]*)>([\s\S]*?)<\/nav>/i, (match, attrs, inner) => {
    const shape = attrs + inner.slice(0, 260);
    if (!/(primary-nav|pnav|class="nav|เมนูหลัก|main navigation)/i.test(shape)) return match;
    if (/href=["'](?:\/)?chat(?:\.html)?["']/i.test(inner)) return match;
    return '<nav' + attrs + '>' + inner + '<a href="chat.html">Chat</a></nav>';
  });
}

function addChatToFooter(html) {
  return html.replace(/<footer([^>]*)>([\s\S]*?)<\/footer>/i, (match, attrs, inner) => {
    if (/href=["'](?:\/)?chat(?:\.html)?["']/i.test(inner)) return match;
    return '<footer' + attrs + '>' + inner + '<div class="ls-footer-chat"><a href="chat.html">Chat</a><span>Public Chat V1</span></div></footer>';
  });
}

function mobilePolish(html, pathname) {
  const page = currentPage(pathname);
  html = addBodyClass(html, 'ls-mobile-public-polish-v3' + (page === 'workspace.html' ? ' ls-page-workspace' : ''));
  html = addChatToFirstHeaderNav(html);
  html = addChatToFooter(html);
  if (html.includes('data-ls-mobile-public-polish="v3"')) return html;

  const style = `<style data-ls-mobile-public-polish="v3">
.ls-footer-chat{max-width:1200px;margin:10px auto 0;padding:0 clamp(16px,4vw,40px);display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.74rem;color:var(--fg3,var(--fg-muted,#7c828c))}.ls-footer-chat a{display:inline-flex;align-items:center;border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:999px;padding:6px 10px;color:var(--fg,var(--fg-primary,#f5f7f9));text-decoration:none;background:var(--surf-in,var(--surface-inset,#0a0a0b))}
.ls-native-menu{display:none}@media(max-width:899px){.primary-nav,.pnav,.nav{display:none!important}.menu-btn,.mbtn{display:none!important}.ls-native-menu{display:block;position:fixed;z-index:700;top:20px;right:28px;color:var(--fg,var(--fg-primary,#f5f7f9));font-family:var(--fd,var(--font-body,"Inter","Noto Sans Thai",system-ui,sans-serif))}.ls-native-menu>summary{list-style:none;width:52px;height:52px;border-radius:14px;border:1px solid var(--bd2,var(--border-default,#26292f));background:rgba(10,10,11,.94);box-shadow:0 10px 28px rgba(0,0,0,.24);backdrop-filter:blur(14px);display:grid;place-items:center;cursor:pointer}.ls-native-menu>summary::-webkit-details-marker{display:none}.ls-native-menu[open]>summary{background:rgba(35,82,105,.92);border-color:rgba(99,179,255,.35)}.ls-native-menu[open]::before{content:"";position:fixed;inset:0;background:rgba(0,0,0,.56);backdrop-filter:blur(5px);z-index:-1}.ls-native-panel{position:fixed;top:84px;right:16px;left:16px;max-height:calc(100vh - 110px);overflow:auto;border:1px solid var(--bd2,var(--border-default,#26292f));border-radius:16px;background:linear-gradient(180deg,rgba(18,19,22,.98),rgba(6,6,6,.98));box-shadow:0 22px 70px rgba(0,0,0,.55);padding:14px;display:grid;gap:12px}.ls-native-head{border-bottom:1px solid var(--bd,var(--border-subtle,#1c1e22));padding:2px 2px 12px}.ls-native-title{font-weight:800;letter-spacing:-.02em}.ls-native-sub{font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.68rem;color:var(--fg3,var(--fg-muted,#7c828c));letter-spacing:.12em;margin-top:2px}.ls-native-links{display:grid;gap:8px}.ls-native-links a{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--bd,var(--border-subtle,#1c1e22));border-radius:12px;padding:12px 13px;background:var(--surf-in,var(--surface-inset,#0a0a0b));color:var(--fg2,var(--fg-secondary,#a2a7b0));text-decoration:none}.ls-native-links a[aria-current="page"],.ls-native-links a:hover{border-color:var(--acc,#63b3ff);background:rgba(99,179,255,.06);color:var(--fg,var(--fg-primary,#f5f7f9))}.ls-native-note{border-left:2px solid var(--acc,#63b3ff);padding-left:10px;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.7rem;line-height:1.6;color:var(--fg3,var(--fg-muted,#7c828c))}}
@media(max-width:720px){.ws-tabs,.tbar{overflow-x:auto!important;white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important}.ws-tabs::-webkit-scrollbar,.tbar::-webkit-scrollbar{display:none}.ws-tab{flex:0 0 auto!important}.sniff-table-wrap{overflow:visible!important;border:0!important;background:transparent!important}.sniff-table{width:100%!important;min-width:0!important;border-collapse:separate!important;border-spacing:0 10px!important}.sniff-table thead{display:none!important}.sniff-table tbody,.sniff-table tr,.sniff-table td{display:block!important;width:100%!important}.sniff-table tr{border:1px solid var(--border-subtle,var(--bd,#1c1e22));border-radius:12px;background:var(--surface-inset,var(--surf-in,#0a0a0b));padding:12px;margin:0 0 10px}.sniff-table td{border:0!important;padding:3px 0!important;white-space:normal!important;overflow-wrap:anywhere!important}.sniff-table td:nth-child(1)::before{content:"Gate ";color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(4)::before{content:"Evidence: ";display:block;margin-top:4px;font-family:var(--font-mono,var(--fm,"IBM Plex Mono",monospace));font-size:.72rem;color:var(--fg-muted,var(--fg3,#7c828c))}.sniff-table td:nth-child(4){margin-top:4px;padding-top:8px!important;border-top:1px solid var(--border-subtle,var(--bd,#1c1e22))!important}}
</style>`;

  const nav = `<details class="ls-native-menu" data-ls-mobile-public-polish="v3"><summary aria-label="เปิดเมนู"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><div class="ls-native-panel" role="navigation" aria-label="เมนูมือถือ"><div class="ls-native-head"><div class="ls-native-title">lsuperagen.docs</div><div class="ls-native-sub">PUBLIC NAV</div></div><nav class="ls-native-links"><a href="index.html" ${page === 'index.html' ? 'aria-current="page"' : ''}>หน้าแรก <span>→</span></a><a href="chat.html" ${page === 'chat.html' ? 'aria-current="page"' : ''}>Chat <span>→</span></a><a href="tools.html" ${page === 'tools.html' ? 'aria-current="page"' : ''}>Tools <span>→</span></a><a href="examples.html" ${page === 'examples.html' ? 'aria-current="page"' : ''}>SDK Plug Tools <span>→</span></a><a href="workspace.html" ${page === 'workspace.html' ? 'aria-current="page"' : ''}>Workspace <span>→</span></a><a href="getting-started.html" ${page === 'getting-started.html' ? 'aria-current="page"' : ''}>Docs <span>→</span></a><a href="guides.html" ${page === 'guides.html' ? 'aria-current="page"' : ''}>Guides <span>→</span></a><a href="api.html" ${page === 'api.html' ? 'aria-current="page"' : ''}>API <span>→</span></a><a href="changelog.html" ${page === 'changelog.html' ? 'aria-current="page"' : ''}>Changelog <span>→</span></a></nav><div class="ls-native-note">Mobile Public Polish V3 · Tools Router V1 · OpenAI Runtime V1</div></div></details>`;
  return html.replace(/<\/head>/i, style + '\n</head>').replace(/<\/body>/i, nav + '\n</body>');
}

function applyHomeEnhancements(html) {
  if (!html.includes('href="chat.html"') && !html.includes('href="/chat"')) {
    const marker = '<a class="btn btn-s thai" href="getting-started.html">ดูเอกสารทั้งหมด</a>';
    html = html.replace(marker, marker + '\n<a class="btn btn-s thai" href="chat.html">เปิด Public Chat</a>');
  }
  if (!html.includes('pnpm add @lsuperagen/sdk')) {
    const marker = '</div>\n<ul style="display:flex;flex-wrap:wrap;gap:var(--sp6) var(--sp8);margin:var(--sp10) 0 0;padding:0;list-style:none">';
    const block = '</div><div aria-label="SDK install command" style="margin-top:var(--sp4);max-width:560px;padding:12px 14px;background:var(--surf-in);border:1px solid var(--bd2);border-left:2px solid var(--acc);border-radius:var(--r2);font-family:var(--fm);font-size:.82rem;color:var(--s300)"><span style="font-size:.68rem;letter-spacing:.18em;color:var(--fg3)">SDK INSTALL</span> <code style="font-family:var(--fm);color:#fff;word-break:break-word">pnpm add @lsuperagen/sdk</code></div><ul style="display:flex;flex-wrap:wrap;gap:var(--sp6) var(--sp8);margin:var(--sp10) 0 0;padding:0;list-style:none">';
    html = html.replace(marker, block);
  }
  return html;
}

function routeToolsCard(html, title, href, label) {
  const re = new RegExp('(<a class="card"\\s+)href="#"([^>]*>[\\s\\S]*?<h3>' + escapeRegExp(title) + '<\\/h3>)', 'i');
  return html.replace(re, '$1href="' + href + '" data-ls-tool-route="' + label + '"$2');
}

function applyToolsRouter(html) {
  html = routeToolsCard(html, 'AI Writer', 'chat.html?tool=writer', 'writer');
  html = routeToolsCard(html, 'Image Generator', 'chat.html?tool=image', 'image');
  html = routeToolsCard(html, 'Deep Research', 'chat.html?tool=research', 'research');
  html = routeToolsCard(html, 'Code Assistant', 'chat.html?tool=code', 'code');
  if (html.includes('data-ls-tools-router="v1"')) return html;
  const style = '<style data-ls-tools-router="v1">.ls-coming-soon-toast{position:fixed;left:16px;right:16px;bottom:88px;z-index:900;display:none;max-width:520px;margin:auto;padding:14px 16px;border-radius:14px;border:1px solid rgba(247,201,106,.28);background:rgba(14,12,8,.96);box-shadow:0 16px 44px rgba(0,0,0,.45);color:var(--fg2,var(--fg-secondary,#a2a7b0));font-family:var(--fd,var(--font-body,"Inter","Noto Sans Thai",system-ui,sans-serif));line-height:1.55}.ls-coming-soon-toast.show{display:block}.ls-coming-soon-toast b{display:block;color:#f7c96a;font-family:var(--fm,var(--font-mono,"IBM Plex Mono",monospace));font-size:.72rem;letter-spacing:.12em;margin-bottom:4px}[data-ls-tool-route]{border-color:rgba(99,179,255,.22)!important}</style>';
  const toast = '<div id="ls-coming-soon-toast" class="ls-coming-soon-toast" role="status" aria-live="polite"><b>COMING SOON</b><span>เครื่องมือนี้ยังไม่เปิดใน Public Chat V1 — ตอนนี้เปิดใช้ก่อนเฉพาะ AI Writer, Image Generator, Deep Research และ Code Assistant</span></div>';
  const script = '<script data-ls-tools-router="v1">(function(){var t=document.getElementById("ls-coming-soon-toast");document.addEventListener("click",function(e){var a=e.target.closest("a.card[href=\\\"#\\\"]");if(!a)return;e.preventDefault();if(t){t.classList.add("show");setTimeout(function(){t.classList.remove("show")},3600)}})})();</script>';
  return html.replace(/<\/head>/i, style + '\n</head>').replace(/<\/body>/i, toast + '\n' + script + '\n</body>');
}

function applyChatRuntimeStatus(html, hasKey) {
  if (!hasKey) return html;
  return html.replace(/RUNTIME NOT WIRED/g, 'OPENAI LIVE').replace(/SAFE STUB/g, 'OPENAI LIVE').replace(/STUB 503/g, 'LIVE 200').replace(/MISSING/g, 'DETECTED').replace(/DISABLED/g, 'ENABLED').replace(/Runtime not wired/g, 'OpenAI runtime wired').replace(/runtime: not wired/g, 'runtime: OpenAI Runtime V1').replace(/ตอนนี้ยังไม่ต่อ API key จริง ระบบจะแสดงสถานะ Runtime not wired จนกว่าจะตั้งค่า Cloudflare Secret และเปิด provider router ฝั่ง Worker/g, 'ตอนนี้เชื่อม OpenAI Runtime V1 ผ่าน Cloudflare Worker แล้ว ค่า API key อยู่ใน Secret ฝั่ง server เท่านั้น');
}

function applyChatToolContext(html, tool) {
  const allowed = { writer: 'AI Writer', image: 'Image Generator', research: 'Deep Research', code: 'Code Assistant' };
  const label = allowed[tool];
  if (!label || html.includes('data-ls-chat-tool="v1"')) return html;
  const script = `<script data-ls-chat-tool="v1">(function(){var tool='${tool}',label='${label}';var p=document.getElementById('prompt'),s=document.getElementById('state'),l=document.getElementById('log');var hints={writer:'เขียนโพสต์ / landing copy / email / caption ที่ต้องการ',image:'อธิบายภาพที่ต้องการสร้าง พร้อมสไตล์และขนาด',research:'ใส่หัวข้อที่ต้องการค้นคว้าและระดับความลึก',code:'วางโค้ดหรืออธิบาย bug ที่ต้องการแก้'};if(p)p.placeholder=label+' — '+hints[tool];if(s)s.textContent='tool: '+tool+' · runtime: OpenAI Runtime V1';if(l){var m=document.createElement('div');m.className='msg bot';m.innerHTML='<div class="role">TOOL ROUTER</div><div></div>';m.lastChild.textContent='เปิดจาก Tools → '+label+' แล้ว · Provider: OpenAI Runtime V1';l.appendChild(m)}})();</script>`;
  const badge = '<div data-ls-chat-tool="v1" style="margin-top:14px;display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(99,179,255,.24);background:rgba(99,179,255,.07);border-radius:999px;padding:8px 12px;font-family:var(--mono,var(--fm,monospace));font-size:.76rem;color:#8ec6ff">TOOL ROUTER · ' + label + '</div>';
  return html.replace(/(<div class="notice[\s\S]*?<\/div>)/i, '$1\n' + badge).replace(/<\/body>/i, script + '\n</body>');
}

const TOOL_LABELS = { writer: 'AI Writer', image: 'Image Generator', research: 'Deep Research', code: 'Code Assistant' };

function normalizeTool(value) {
  if (value === undefined || value === null || value === '') return null;
  const tool = String(value).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TOOL_LABELS, tool) ? tool : 'invalid';
}

function inferTool(body, request) {
  const direct = normalizeTool(body.tool);
  if (direct !== null) return direct;
  try { return normalizeTool(new URL(request.headers.get('referer') || '').searchParams.get('tool')); } catch (_) { return null; }
}

function toolInstructions(tool, mode) {
  const base = [
    'You are LS Chat Surface for lsuperagen.docs.',
    'Answer in the same language as the user unless they ask otherwise.',
    'Be concise, practical, and direct.',
    'Do not claim access to private systems, repositories, dashboards, files, billing, or accounts unless the user provides that content in the prompt.',
    'Do not reveal, request, or guess secrets/API keys.',
    'If information is missing, say exactly what is missing.',
    'Current mode: ' + (mode || 'fast') + '.'
  ];
  const byTool = {
    writer: 'Tool context: AI Writer. Draft, rewrite, structure, or improve content. Preserve user-supplied names, claims, numbers, and constraints.',
    image: 'Tool context: Image Generator. Turn visual ideas into clear image prompts/specs. Do not claim to generate an image from this endpoint.',
    research: 'Tool context: Deep Research. Provide an evidence-first plan or synthesis. If live web evidence is required but unavailable in the prompt, say so.',
    code: 'Tool context: Code Assistant. Help with implementation, debugging, code review, and architecture. Prefer minimal safe changes.'
  };
  return base.concat(byTool[tool] || 'Tool context: general public chat.').join('\n');
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const chunks = [];
  for (const item of data.output || []) for (const c of item.content || []) {
    if (typeof c.text === 'string') chunks.push(c.text);
    if (typeof c.output_text === 'string') chunks.push(c.output_text);
  }
  return chunks.join('\n').trim();
}

function modelCandidates(env) {
  const configured = typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() : '';
  const list = [configured, 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5-nano', 'gpt-5-mini', 'gpt-4o-mini'].filter(Boolean);
  return Array.from(new Set(list));
}

async function listAccessibleModelIds(env, requestId) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'x-client-request-id': requestId }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return new Set((data.data || []).map((model) => model && model.id).filter(Boolean));
  } catch (_) {
    return null;
  }
}

async function createOpenAIResponse(env, model, message, tool, mode, requestId) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
    body: JSON.stringify({ model, input: message, instructions: toolInstructions(tool, mode), max_output_tokens: 900, store: false, metadata: { app: 'lsuperagen.docs', route: '/api/chat', tool: tool || 'general', mode } })
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw: raw.slice(0, 500) }; }
  return { response, data };
}

function isModelAccessError(data) {
  const msg = data && data.error && data.error.message ? data.error.message : '';
  return /does not have access to model|model .* not found|invalid model|not exist|do not have access/i.test(msg);
}

async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'Use POST /api/chat.' }, 405, { allow: 'POST, OPTIONS' });
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const mode = typeof body.mode === 'string' && body.mode.trim() ? body.mode.trim().slice(0, 32) : 'fast';
  const tool = inferTool(body, request);
  const provider = 'openai';
  const hasKey = Boolean(env.OPENAI_API_KEY);
  const runtimeHeader = hasKey ? 'openai-runtime-v1' : 'not-wired';
  const readiness = { frontend: true, api_route: true, tools_router: true, provider_router: true, secret_detected: hasKey, model_output: hasKey };

  if (!message) return json({ ok: false, status: 'validation_error', message: 'message is required.', tool: tool === 'invalid' ? null : tool, provider, readiness }, 400, { 'x-lsuperagen-runtime': runtimeHeader });
  if (message.length > 4000) return json({ ok: false, status: 'validation_error', message: 'message is too long. Max 4000 characters.', tool: tool === 'invalid' ? null : tool, provider, readiness }, 413, { 'x-lsuperagen-runtime': runtimeHeader });
  if (tool === 'invalid') return json({ ok: false, status: 'validation_error', message: 'tool must be writer, image, research, code, or null.', provider, readiness }, 400, { 'x-lsuperagen-runtime': runtimeHeader });

  if (!hasKey) return json({
    ok: false,
    status: 'runtime_not_wired',
    message: 'Runtime not wired. No fake AI response generated. Set OPENAI_API_KEY as a Cloudflare Secret before public model output.',
    requested: { mode, provider: body.provider || 'OpenAI route', tool, has_message: true },
    readiness: { ...readiness, model_output: false }
  }, 503, { 'x-lsuperagen-runtime': runtimeHeader });

  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const configuredCandidates = modelCandidates(env);
  const modelIds = await listAccessibleModelIds(env, requestId);
  const candidates = modelIds ? configuredCandidates.filter((model) => modelIds.has(model)) : configuredCandidates;
  const attempted = [];
  let lastError = null;

  for (const model of candidates) {
    attempted.push(model);
    let providerResponse;
    let data;
    try {
      ({ response: providerResponse, data } = await createOpenAIResponse(env, model, message, tool, mode, requestId));
    } catch (error) {
      return json({ ok: false, status: 'provider_network_error', message: 'OpenAI provider request failed before a response was received.', tool, provider, request_id: requestId, error: error && error.message ? error.message : 'network_error' }, 502, { 'x-lsuperagen-runtime': 'openai-runtime-v1', 'x-lsuperagen-request-id': requestId });
    }

    if (providerResponse.ok) {
      const output = extractOutputText(data);
      return json({ ok: true, status: 'completed', tool, provider, model, message: output, output, usage: data.usage || null, response_id: data.id || null, request_id: requestId, attempted_models: attempted }, 200, { 'x-lsuperagen-runtime': 'openai-runtime-v1', 'x-lsuperagen-request-id': requestId });
    }

    const providerMessage = data && data.error && data.error.message ? data.error.message : 'OpenAI provider returned an error.';
    lastError = { message: providerMessage, model, provider_status: providerResponse.status };
    if (!isModelAccessError(data)) {
      return json({ ok: false, status: 'provider_error', message: providerMessage, tool, provider, model, request_id: requestId, provider_status: providerResponse.status, attempted_models: attempted }, providerResponse.status >= 400 && providerResponse.status < 500 ? 502 : 503, { 'x-lsuperagen-runtime': 'openai-runtime-v1', 'x-lsuperagen-request-id': requestId });
    }
  }

  return json({
    ok: false,
    status: 'model_not_available',
    message: 'OPENAI_API_KEY is valid, but this project does not expose any supported default chat model to the Worker. Set Cloudflare runtime variable OPENAI_MODEL to a model enabled in the OpenAI project, or enable a supported model in OpenAI Platform.',
    tool,
    provider,
    request_id: requestId,
    attempted_models: attempted.length ? attempted : configuredCandidates,
    visible_model_count: modelIds ? modelIds.size : null,
    last_error: lastError
  }, 502, { 'x-lsuperagen-runtime': 'openai-runtime-v1', 'x-lsuperagen-request-id': requestId });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS' && pathname === '/api/chat') {
      return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    }
    if (pathname === '/api/chat') return handleChat(request, env);

    const response = await env.ASSETS.fetch(request);
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

    let html = await response.text();
    const page = currentPage(pathname);
    if (page === 'index.html') html = applyHomeEnhancements(html);
    if (page === 'tools.html') html = applyToolsRouter(html);
    if (page === 'chat.html') {
      html = applyChatRuntimeStatus(html, Boolean(env.OPENAI_API_KEY));
      html = applyChatToolContext(html, url.searchParams.get('tool'));
    }
    html = mobilePolish(html, pathname);
    return new Response(html, { status: response.status, headers: htmlHeaders(response, 'openai-runtime-v1-model-fallback') });
  }
};