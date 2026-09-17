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

    if ((normalizedPath === '/' || normalizedPath === '/index') && contentType.includes('text/html')) {
      let html = await response.text();

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

      return new Response(html, { status: response.status, headers: withHtmlHeaders(response, 'public-chat-v1') });
    }

    return response;
  }
};
