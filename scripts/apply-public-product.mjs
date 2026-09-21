import { readFile, writeFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const write = (path, content) => writeFile(path, content, 'utf8');

function replaceRange(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`replace markers not found: ${startMarker} -> ${endMarker}`);
  return source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`replacement target missing: ${label}`);
  return source.replace(before, after);
}

let worker = await read('src/index.js');

if (!worker.includes('PUBLIC_PRODUCT_V2')) {
  worker = replaceRange(worker, 'const TOOL_LABELS = {', 'function json(', `const TOOL_LABELS = {
  writer: 'Write',
  research: 'Research',
  url: 'Read URL',
  code: 'Code'
};

const PUBLIC_PRODUCT_V2 = true;`);

  worker = replaceRange(worker, 'function toolInstructions(', 'function extractOutputText(', `function toolInstructions(tool, mode) {
  const base = [
    'Act as a practical AI work assistant for the user request.',
    'Answer in the same language as the user unless they ask otherwise.',
    'Be accurate, useful, and direct.',
    'Do not invent sources, private-system access, files, or account data.',
    'Do not reveal, request, or guess secrets or API keys.',
    'Current mode: ' + (mode || 'chat') + '.'
  ];
  const byTool = {
    writer: 'Tool context: Write. Draft, rewrite, structure, or improve content while preserving user-supplied facts and constraints.',
    research: 'Tool context: Research. Use web search for current evidence. Synthesize findings and ground factual claims in the returned sources. Never invent citations.',
    url: 'Tool context: Read URL. Use web search to open or inspect the exact URL supplied by the user first. Answer from that page when accessible, cite it, and state clearly if the page cannot be read.',
    code: 'Tool context: Code. Handle substantial implementation, debugging, refactoring, review, and edits. Preserve working code unless the requested change requires otherwise.'
  };
  return base.concat(byTool[tool] || 'Tool context: Chat. Help with the request directly.').join('\\n');
}`);

  worker = replaceRange(worker, 'async function createOpenAIResponse(', 'function isModelAccessError(', `async function createOpenAIResponse(env, model, message, tool, mode, requestId) {
  const usesWeb = tool === 'research' || tool === 'url';
  const payload = {
    model,
    input: message,
    instructions: toolInstructions(tool, mode),
    max_output_tokens: tool === 'code' ? 8000 : usesWeb ? 5000 : 4000,
    store: false,
    metadata: { app: 'lsuperagen.docs', surface: 'public-workspace', tool: tool || 'chat', mode }
  };
  if (usesWeb) {
    payload.tools = [{ type: 'web_search' }];
    payload.tool_choice = 'required';
    payload.include = ['web_search_call.action.sources'];
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
    body: JSON.stringify(payload)
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
  return { response, data };
}

function extractSources(data) {
  const collected = [];
  const add = (source) => {
    if (!source || typeof source.url !== 'string' || !source.url.startsWith('http')) return;
    collected.push({ title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : source.url, url: source.url });
  };
  for (const item of data.output || []) {
    if (item && item.type === 'web_search_call' && item.action && Array.isArray(item.action.sources)) {
      for (const source of item.action.sources) add(source);
    }
    for (const content of item && Array.isArray(item.content) ? item.content : []) {
      for (const annotation of content && Array.isArray(content.annotations) ? content.annotations : []) {
        if (annotation && annotation.type === 'url_citation') add({ title: annotation.title, url: annotation.url });
      }
    }
  }
  const seen = new Set();
  return collected.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 20);
}

function extractGeneratedImage(data) {
  for (const item of data.output || []) {
    if (item && item.type === 'image_generation_call' && typeof item.result === 'string' && item.result) {
      return { data_base64: item.result, revised_prompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : null };
    }
  }
  return null;
}`);

  worker = replaceRange(worker, 'async function handleChat(', 'function injectHead(', `async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST, OPTIONS' });
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const mode = typeof body.mode === 'string' && body.mode.trim() ? body.mode.trim().slice(0, 32) : 'chat';
  const tool = inferTool(body, request);
  if (!message) return json({ ok: false, status: 'validation_error', message: 'กรุณาใส่ข้อความก่อนส่ง' }, 400);
  if (message.length > 120000) return json({ ok: false, status: 'validation_error', message: 'ข้อความยาวเกินขีดจำกัด 120,000 ตัวอักษร กรุณาแบ่งเป็นส่วนย่อย' }, 413);
  if (tool === 'invalid') return json({ ok: false, status: 'validation_error', message: 'โหมดที่ส่งมาไม่ถูกต้อง' }, 400);
  const rate = checkRateLimit(request, tool);
  const baseHeaders = rateLimitHeaders(rate);
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง' }, 429, baseHeaders);
  if (!env.OPENAI_API_KEY) return json({ ok: false, status: 'service_unavailable', message: 'บริการ AI ยังไม่พร้อมใช้งานในขณะนี้' }, 503, baseHeaders);

  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const webMode = tool === 'research' || tool === 'url';
  const candidates = webMode
    ? Array.from(new Set(['gpt-6-astra', 'gpt-4.1', typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() : ''].filter(Boolean)))
    : modelCandidates(env);
  let lastStatus = 502;
  for (const model of candidates) {
    let providerResponse, data;
    try {
      ({ response: providerResponse, data } = await createOpenAIResponse(env, model, message, tool, mode, requestId));
    } catch (_) {
      return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อบริการ AI ไม่สำเร็จ กรุณาลองใหม่' }, 502, baseHeaders);
    }
    if (providerResponse.ok) {
      const output = extractOutputText(data);
      if (!output) return json({ ok: false, status: 'empty_result', message: 'บริการ AI ไม่ได้ส่งข้อความกลับมา กรุณาลองใหม่' }, 502, baseHeaders);
      return json({ ok: true, status: 'completed', message: output, output, sources: extractSources(data) }, 200, baseHeaders);
    }
    lastStatus = providerResponse.status;
    if (!isModelAccessError(data)) break;
  }
  return json({ ok: false, status: 'service_error', message: lastStatus === 429 ? 'บริการ AI ถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง' : 'บริการ AI ไม่สามารถทำคำขอนี้ได้ในขณะนี้' }, lastStatus === 429 ? 429 : 502, baseHeaders);
}

async function handleImage(request, env) {
  if (request.method !== 'POST') return json({ ok: false, status: 'method_not_allowed', message: 'ส่งคำขอด้วย POST เท่านั้น' }, 405, { allow: 'POST, OPTIONS' });
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return json({ ok: false, status: 'validation_error', message: 'กรุณาอธิบายภาพที่ต้องการสร้าง' }, 400);
  if (prompt.length > 12000) return json({ ok: false, status: 'validation_error', message: 'คำอธิบายภาพยาวเกินขีดจำกัด 12,000 ตัวอักษร' }, 413);
  const rate = checkRateLimit(request, 'image');
  const baseHeaders = rateLimitHeaders(rate);
  if (rate.limited) return json({ ok: false, status: 'rate_limited', message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง' }, 429, baseHeaders);
  if (!env.OPENAI_API_KEY) return json({ ok: false, status: 'service_unavailable', message: 'บริการสร้างภาพยังไม่พร้อมใช้งานในขณะนี้' }, 503, baseHeaders);
  const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'x-client-request-id': requestId },
    body: JSON.stringify({
      model: 'gpt-6-astra',
      input: prompt,
      tools: [{ type: 'image_generation', model: 'gpt-image-2.5-flare', action: 'generate' }],
      tool_choice: { type: 'image_generation' },
      store: false,
      metadata: { app: 'lsuperagen.docs', surface: 'public-workspace', tool: 'image' }
    })
  }).catch(() => null);
  if (!response) return json({ ok: false, status: 'service_error', message: 'เชื่อมต่อบริการสร้างภาพไม่สำเร็จ กรุณาลองใหม่' }, 502, baseHeaders);
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
  if (!response.ok) return json({ ok: false, status: 'service_error', message: response.status === 429 ? 'บริการสร้างภาพถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้ง' : 'ไม่สามารถสร้างภาพจากคำขอนี้ได้ กรุณาลองปรับคำอธิบาย' }, response.status === 429 ? 429 : 502, baseHeaders);
  const image = extractGeneratedImage(data);
  if (!image) return json({ ok: false, status: 'empty_result', message: 'บริการสร้างภาพไม่ได้ส่งไฟล์ภาพกลับมา กรุณาลองใหม่' }, 502, baseHeaders);
  return json({ ok: true, status: 'completed', image: { mime_type: 'image/png', data_base64: image.data_base64, filename: 'lsuperagen-image.png', revised_prompt: image.revised_prompt } }, 200, baseHeaders);
}

function plannedEndpoint(pathname) {
  const planned = {
    '/admin/auth/github': { status: 'retired', method: 'GET', message: 'Use /dev.' },
    '/admin/github/status': { status: 'retired', method: 'GET', message: 'Use /dev.' },
    '/admin/github/files': { status: 'retired', method: 'GET', message: 'Use /dev.' },
    '/admin/github/commit': { status: 'retired', method: 'POST', message: 'Use /dev.' },
    '/admin/handoff/claude': { status: 'planned', method: 'POST', message: 'Use /dev.' }
  }[pathname];
  return planned ? json({ ok: false, endpoint: pathname, ...planned, secret_values: false }, 501) : null;
}`);

  worker = replaceRange(worker, 'function publicMobileLinks(', 'function isDevOnlyPath(', `function publicMobileLinks(page) {
  const items = [
    ['/chat', 'Workspace', 'chat.html'],
    ['/tools', 'Tools', 'tools.html']
  ];
  return items.map(([href, label, file]) => \`<a href="\${href}" \${page === file ? 'aria-current="page"' : ''}>\${label}<span>→</span></a>\`).join('');
}

function enhancePublicHtml(html, pathname) {
  return html;
}`);

  worker = replaceOnce(worker,
`    if (pathname === '/admin' || pathname === '/admin.html') return redirectTo('/dev', 302, { 'x-lsuperagen-admin-gate': 'redirect-to-dev-v1' });
    if (ALIASES[pathname]) return redirectTo(new URL(ALIASES[pathname], url).toString(), 301);`,
`    if (pathname === '/' || pathname === '/home' || pathname === '/index.html') return redirectTo('/chat', 302);
    const legacyPublic = new Set(['/examples','/examples.html','/getting-started','/getting-started.html','/api','/api.html','/guides','/guides.html','/changelog','/changelog.html','/workspace','/workspace.html','/provider-connect','/provider-connect.html','/secret-handoff','/secret-handoff.html','/endpoints','/endpoints.html','/system-registry','/system-registry.html']);
    if (legacyPublic.has(pathname)) return redirectTo('/chat', 302);
    if (pathname === '/admin' || pathname === '/admin.html') return redirectTo('/dev', 302, { 'x-lsuperagen-admin-gate': 'redirect-to-dev-v1' });
    if (ALIASES[pathname]) return redirectTo(new URL(ALIASES[pathname], url).toString(), 301);`,
    'root and legacy public routing');

  worker = replaceOnce(worker,
`    if (request.method === 'OPTIONS' && pathname === '/api/chat') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (pathname === '/api/chat') return handleChat(request, env);`,
`    if (request.method === 'OPTIONS' && (pathname === '/api/chat' || pathname === '/api/image')) return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
    if (pathname === '/api/chat') return handleChat(request, env);
    if (pathname === '/api/image') return handleImage(request, env);`,
    'public API routing');
}

await write('src/index.js', worker);

await write('index.html', `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/chat"><title>lsuperagen.docs</title><link rel="canonical" href="/chat"></head><body style="margin:0;background:#000;color:#fff;font-family:system-ui"><p><a href="/chat" style="color:#0FA3D9">เปิดพื้นที่ AI</a></p></body></html>\n`);

await write('app.css', `:root{color-scheme:dark;--bg:#000000;--surface:#08090b;--surface2:#0d1014;--line:#1d2229;--line2:#303842;--text:#FFFFFF;--muted:#9aa3ad;--accent:#0FA3D9;--accent-soft:rgba(15,163,217,.13);--danger:#ff7d86;--sans:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,"Noto Sans Thai","Segoe UI",sans-serif;--mono:"SFMono-Regular",Consolas,monospace;--content:1120px}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:var(--sans);overflow-x:hidden}button,textarea,input{font:inherit}button,a{outline:none}button:focus-visible,a:focus-visible,textarea:focus-visible{box-shadow:0 0 0 3px rgba(15,163,217,.38)}a{color:inherit;text-decoration:none}.container{width:min(calc(100% - 28px),var(--content));margin-inline:auto}.product-header{height:58px;border-bottom:1px solid var(--line);display:flex;align-items:center;background:rgba(0,0,0,.94);position:sticky;top:0;z-index:20}.header-inner{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:flex;align-items:center;gap:10px;font-weight:850;letter-spacing:-.035em}.brand-mark{width:34px;height:34px;border:1px solid var(--line2);border-radius:9px;display:grid;place-items:center;color:var(--accent);font:800 .72rem var(--mono);background:var(--surface)}.brand-copy span{color:var(--muted);font-weight:600}.header-link{color:var(--muted);font-weight:750;font-size:.86rem;padding:8px 10px;border-radius:8px}.header-link:hover{color:var(--text);background:var(--surface2)}.workspace{height:calc(100dvh - 58px);display:grid;grid-template-columns:230px minmax(0,1fr)}.mode-panel{border-right:1px solid var(--line);padding:18px 14px;background:#040506;overflow-y:auto}.mode-title{font:750 .66rem var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}.mode-list{display:grid;gap:6px}.mode-button{border:1px solid transparent;border-radius:10px;background:transparent;color:var(--muted);padding:11px 12px;text-align:left;font-weight:760;cursor:pointer}.mode-button:hover{color:var(--text);background:var(--surface)}.mode-button.on{color:var(--text);border-color:rgba(15,163,217,.35);background:var(--accent-soft)}.mode-help{margin:18px 4px 0;color:var(--muted);font-size:.8rem;line-height:1.55}.chat-main{min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto}.workspace-top{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:54px;padding:10px 18px;border-bottom:1px solid var(--line)}.workspace-title{font-weight:850}.workspace-mode{color:var(--accent);font:750 .68rem var(--mono)}.mobile-modes{display:none;border:0;background:transparent;color:var(--text);font-weight:780}.chat-log{min-height:0;overflow-y:auto;padding:26px max(16px,calc((100% - 820px)/2));scroll-behavior:smooth}.empty{max-width:660px;margin:8vh auto 0;text-align:center}.empty-mark{width:54px;height:54px;margin:auto;display:grid;place-items:center;border:1px solid var(--line2);border-radius:15px;background:var(--surface);color:var(--accent);font:850 .8rem var(--mono)}.empty h1{font-size:clamp(2.2rem,7vw,4.6rem);line-height:.94;letter-spacing:-.06em;margin:20px 0 0}.empty p{max-width:560px;margin:14px auto 0;color:var(--muted);line-height:1.65}.message{max-width:820px;margin:0 auto 18px}.message-role{font:750 .62rem var(--mono);letter-spacing:.12em;color:var(--muted);margin-bottom:7px}.message-body{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:15px 16px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}.message.user .message-body{width:fit-content;max-width:90%;margin-left:auto;background:#fff;color:#000;border-color:#fff}.message.user .message-role{text-align:right}.message-actions{display:flex;gap:8px;margin-top:8px}.action-button{border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--muted);padding:7px 10px;cursor:pointer;font-weight:700;font-size:.78rem}.action-button:hover{color:var(--text);border-color:var(--line2)}.sources{display:grid;gap:7px;margin-top:12px}.source-link{display:flex;gap:8px;align-items:flex-start;color:#b9e9f8;font-size:.82rem;text-decoration:underline;text-underline-offset:3px}.image-result{display:block;max-width:min(100%,720px);height:auto;border-radius:14px;border:1px solid var(--line);background:var(--surface)}.status-line{min-height:22px;color:var(--muted);font-size:.78rem;margin:0 4px 6px}.composer-shell{padding:10px max(12px,calc((100% - 860px)/2)) 14px;background:linear-gradient(180deg,transparent,#000 22%)}.composer{border:1px solid var(--line2);border-radius:16px;background:var(--surface);padding:9px;box-shadow:0 18px 60px rgba(0,0,0,.38)}.composer textarea{width:100%;min-height:62px;max-height:260px;resize:none;border:0;background:transparent;color:var(--text);padding:10px;line-height:1.55}.composer textarea::placeholder{color:#6f7984}.composer-bar{display:flex;align-items:center;gap:8px;padding:3px}.file-button,.clear-button,.send-button{min-height:38px;border-radius:9px;font-weight:800;cursor:pointer}.file-button,.clear-button{border:1px solid var(--line);background:transparent;color:var(--muted);padding:0 11px}.send-button{margin-left:auto;border:0;background:var(--accent);color:#001219;padding:0 16px}.send-button:disabled{opacity:.5;cursor:not-allowed}.tools-page{min-height:100vh}.tools-main{padding:54px 0 80px}.tools-head h1{font-size:clamp(2.5rem,9vw,6rem);line-height:.9;letter-spacing:-.07em;margin:0}.tools-head p{color:var(--muted);max-width:640px;line-height:1.65}.tool-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:32px}.tool-card{min-height:190px;border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:20px;display:flex;flex-direction:column}.tool-card:hover{border-color:rgba(15,163,217,.48)}.tool-card .kicker{font:750 .65rem var(--mono);letter-spacing:.12em;color:var(--accent)}.tool-card h2{font-size:1.35rem;margin:14px 0 0}.tool-card p{color:var(--muted);font-size:.9rem;line-height:1.55}.tool-card .go{margin-top:auto;color:var(--accent);font-weight:800}@media(max-width:860px){.workspace{grid-template-columns:1fr}.mode-panel{display:none}.mobile-modes{display:block}.tool-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.container{width:min(calc(100% - 20px),var(--content))}.brand-copy{font-size:.92rem}.header-link{font-size:.8rem}.chat-log{padding:18px 10px}.empty{margin-top:4vh}.empty h1{font-size:2.55rem}.workspace-top{padding-inline:12px}.composer-shell{padding:7px 8px 10px}.tool-grid{grid-template-columns:1fr}.tools-main{padding-top:36px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\n`);

await write('chat.html', `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>lsuperagen.docs — AI Workspace</title><meta name="description" content="พื้นที่ AI สำหรับแชท เขียนโค้ด สร้างภาพ ค้นคว้า อ่านเว็บ และเขียนคอนเทนต์"><link rel="stylesheet" href="/app.css"></head>
<body class="chat-page" data-ls-mobile-menu-fix="v1"><header class="product-header"><div class="container header-inner"><a class="brand" href="/chat"><span class="brand-mark">LS</span><span class="brand-copy">lsuperagen<span>.docs</span></span></a><a class="header-link" href="/tools">Tools</a></div></header>
<main class="workspace"><aside class="mode-panel" aria-label="โหมดทำงาน"><p class="mode-title">Choose a mode</p><div class="mode-list" id="modes"><button class="mode-button on" data-mode="chat">Chat</button><button class="mode-button" data-mode="code">Code</button><button class="mode-button" data-mode="image">Image</button><button class="mode-button" data-mode="research">Research</button><button class="mode-button" data-mode="url">Read URL</button><button class="mode-button" data-mode="write">Write</button></div><p class="mode-help" id="modeHelp">ถาม พัฒนาไอเดีย หรือแก้ปัญหาได้จากพื้นที่เดียว</p></aside>
<section class="chat-main" aria-label="AI workspace"><div class="workspace-top"><div><div class="workspace-title">AI Workspace</div><div class="workspace-mode" id="modeLabel">Chat</div></div><select class="mobile-modes" id="mobileMode" aria-label="เลือกโหมด"><option value="chat">Chat</option><option value="code">Code</option><option value="image">Image</option><option value="research">Research</option><option value="url">Read URL</option><option value="write">Write</option></select></div>
<div class="chat-log" id="log" aria-live="polite"><div class="empty" id="empty"><div class="empty-mark">LS</div><h1>สร้างงานด้วย AI</h1><p>เลือกโหมดแล้วพิมพ์สิ่งที่ต้องการ ระบบจะแสดงคำตอบ แหล่งอ้างอิง หรือไฟล์ภาพในพื้นที่เดียว</p></div></div>
<div class="composer-shell"><div class="status-line" id="status" role="status" aria-live="polite"></div><form class="composer" id="form"><textarea id="prompt" aria-label="ข้อความถึง AI" placeholder="พิมพ์สิ่งที่ต้องการ…" required></textarea><input id="file" type="file" accept=".txt,.md,.js,.mjs,.cjs,.ts,.tsx,.jsx,.json,.html,.css,.py,.go,.rs,.java,.kt,.swift,.php,.rb,.cpp,.c,.h,.hpp,.sql,.yaml,.yml" hidden><div class="composer-bar"><button class="file-button" id="attach" type="button">ไฟล์ข้อความ</button><button class="clear-button" id="clear" type="button">ล้าง</button><button class="send-button" id="send" type="submit">ส่ง</button></div></form></div></section></main>
<script>
(function(){
const modes={chat:{label:'Chat',tool:null,help:'ถาม พัฒนาไอเดีย หรือแก้ปัญหาได้จากพื้นที่เดียว',placeholder:'พิมพ์สิ่งที่ต้องการ…'},code:{label:'Code',tool:'code',help:'เขียน ตรวจ แก้ และรีแฟกเตอร์โค้ดขนาดใหญ่',placeholder:'วางโค้ดหรือบอกสิ่งที่ต้องการแก้…'},image:{label:'Image',tool:'image',help:'อธิบายภาพที่ต้องการ แล้วรับไฟล์ภาพกลับมา',placeholder:'อธิบายภาพที่ต้องการสร้าง…'},research:{label:'Research',tool:'research',help:'ค้นคว้าจากเว็บและดูแหล่งอ้างอิงที่ใช้',placeholder:'หัวข้อที่ต้องการค้นคว้า…'},url:{label:'Read URL',tool:'url',help:'ส่ง URL แล้วถามสิ่งที่ต้องการรู้จากหน้านั้น',placeholder:'วาง URL พร้อมคำถาม…'},write:{label:'Write',tool:'writer',help:'ร่าง เขียนใหม่ หรือปรับคอนเทนต์',placeholder:'บอกประเภทคอนเทนต์และสิ่งที่ต้องการ…'}};
let mode='chat',controller=null;const log=document.getElementById('log'),form=document.getElementById('form'),prompt=document.getElementById('prompt'),send=document.getElementById('send'),status=document.getElementById('status'),mobileMode=document.getElementById('mobileMode');
function clearEmpty(){const e=document.getElementById('empty');if(e)e.remove()}
function setStatus(text){status.textContent=text||''}
function addMessage(role,text,sources){clearEmpty();const article=document.createElement('article');article.className='message '+(role==='คุณ'?'user':'assistant');const label=document.createElement('div');label.className='message-role';label.textContent=role;const body=document.createElement('div');body.className='message-body';body.textContent=text;article.append(label,body);if(role!=='คุณ'){const actions=document.createElement('div');actions.className='message-actions';const copy=document.createElement('button');copy.type='button';copy.className='action-button';copy.textContent='Copy';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',1200)}catch(_){setStatus('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง')}});actions.append(copy);article.append(actions)}if(Array.isArray(sources)&&sources.length){const box=document.createElement('div');box.className='sources';sources.forEach((source,index)=>{if(!source||!source.url)return;const a=document.createElement('a');a.className='source-link';a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=(index+1)+'. '+(source.title||source.url);box.append(a)});article.append(box)}log.append(article);log.scrollTop=log.scrollHeight}
function addImage(image){clearEmpty();const article=document.createElement('article');article.className='message assistant';const label=document.createElement('div');label.className='message-role';label.textContent='AI';const img=document.createElement('img');img.className='image-result';img.alt='ภาพที่สร้างโดย AI';img.src='data:'+(image.mime_type||'image/png')+';base64,'+image.data_base64;const actions=document.createElement('div');actions.className='message-actions';const link=document.createElement('a');link.className='action-button';link.textContent='Download';link.download=image.filename||'lsuperagen-image.png';link.href=img.src;actions.append(link);article.append(label,img,actions);log.append(article);log.scrollTop=log.scrollHeight}
function selectMode(value){mode=modes[value]?value:'chat';document.querySelectorAll('.mode-button').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));mobileMode.value=mode;document.getElementById('modeLabel').textContent=modes[mode].label;document.getElementById('modeHelp').textContent=modes[mode].help;prompt.placeholder=modes[mode].placeholder;prompt.focus()}
document.getElementById('modes').addEventListener('click',e=>{const b=e.target.closest('.mode-button');if(b)selectMode(b.dataset.mode)});mobileMode.addEventListener('change',()=>selectMode(mobileMode.value));document.getElementById('clear').addEventListener('click',()=>{log.innerHTML='<div class="empty" id="empty"><div class="empty-mark">LS</div><h1>สร้างงานด้วย AI</h1><p>เลือกโหมดแล้วพิมพ์สิ่งที่ต้องการ ระบบจะแสดงคำตอบ แหล่งอ้างอิง หรือไฟล์ภาพในพื้นที่เดียว</p></div>';setStatus('')});
document.getElementById('attach').addEventListener('click',()=>document.getElementById('file').click());document.getElementById('file').addEventListener('change',async function(){const f=this.files&&this.files[0];if(!f)return;if(f.size>350000){setStatus('ไฟล์ใหญ่เกินไป กรุณาใช้ไฟล์ข้อความไม่เกิน 350 KB');this.value='';return}try{const text=await f.text();prompt.value=(prompt.value?prompt.value+'\\n\\n':'')+'ไฟล์ '+f.name+':\\n'+text;setStatus('เพิ่มไฟล์ '+f.name+' แล้ว')}catch(_){setStatus('อ่านไฟล์นี้ไม่สำเร็จ')}this.value='' });
form.addEventListener('submit',async e=>{e.preventDefault();const text=prompt.value.trim();if(!text)return;addMessage('คุณ',text);prompt.value='';send.disabled=true;setStatus(mode==='image'?'กำลังสร้างภาพ…':mode==='research'||mode==='url'?'กำลังค้นคว้า…':'กำลังประมวลผล…');controller=new AbortController();try{if(mode==='image'){const response=await fetch('/api/image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:text}),signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok||!data.image)throw new Error(data.message||'สร้างภาพไม่สำเร็จ');addImage(data.image)}else{const response=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,mode:mode,tool:modes[mode].tool}),signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'ส่งคำขอไม่สำเร็จ');addMessage('AI',data.message||data.output||'',data.sources||[])}setStatus('เสร็จแล้ว')}catch(err){if(err.name!=='AbortError'){addMessage('AI','ขออภัย '+err.message);setStatus('เกิดข้อผิดพลาด กรุณาลองใหม่')}}finally{send.disabled=false;controller=null}});
const q=new URLSearchParams(location.search).get('mode')||new URLSearchParams(location.search).get('tool');const aliases={writer:'write'};selectMode(aliases[q]||q||'chat');
})();
</script></body></html>\n`);

await write('tools.html', `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Tools — lsuperagen.docs</title><meta name="description" content="เครื่องมือ AI สำหรับแชท โค้ด ภาพ ค้นคว้า อ่านเว็บ และเขียนคอนเทนต์"><link rel="stylesheet" href="/app.css"></head><body class="tools-page" data-ls-mobile-menu-fix="v1"><header class="product-header"><div class="container header-inner"><a class="brand" href="/chat"><span class="brand-mark">LS</span><span class="brand-copy">lsuperagen<span>.docs</span></span></a><a class="header-link" href="/chat">Workspace</a></div></header><main class="tools-main"><div class="container"><div class="tools-head"><h1>เลือกงานที่ต้องการ</h1><p>ทุกเครื่องมือเปิดในพื้นที่ AI เดียวกัน เลือกประเภทงานแล้วเริ่มพิมพ์ได้ทันที</p></div><section class="tool-grid" aria-label="AI tools"><a class="tool-card" href="/chat?mode=chat"><span class="kicker">CHAT</span><h2>Chat</h2><p>ถาม อธิบาย คิดงาน และแก้ปัญหา</p><span class="go">เปิด →</span></a><a class="tool-card" href="/chat?mode=code"><span class="kicker">CODE</span><h2>Code</h2><p>เขียน ตรวจ แก้ และรีแฟกเตอร์โค้ด</p><span class="go">เปิด →</span></a><a class="tool-card" href="/chat?mode=image"><span class="kicker">IMAGE</span><h2>Image</h2><p>สร้างภาพและดาวน์โหลดไฟล์ผลลัพธ์</p><span class="go">เปิด →</span></a><a class="tool-card" href="/chat?mode=research"><span class="kicker">RESEARCH</span><h2>Research</h2><p>ค้นคว้าจากเว็บพร้อมแหล่งอ้างอิง</p><span class="go">เปิด →</span></a><a class="tool-card" href="/chat?mode=url"><span class="kicker">URL</span><h2>Read URL</h2><p>อ่านหน้าเว็บจากลิงก์และถามต่อ</p><span class="go">เปิด →</span></a><a class="tool-card" href="/chat?mode=write"><span class="kicker">WRITE</span><h2>Write</h2><p>ร่างและปรับคอนเทนต์ พร้อมคัดลอกผลลัพธ์</p><span class="go">เปิด →</span></a></section></div></main></body></html>\n`);

console.log('Applied PUBLIC_PRODUCT_V2 patch');
