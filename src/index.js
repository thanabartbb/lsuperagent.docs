export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
    const contentType = response.headers.get('content-type') || '';

    if ((normalizedPath === '/' || normalizedPath === '/index') && contentType.includes('text/html')) {
      let html = await response.text();

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

      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('x-lsuperagen-control', 'hero-sdk-install-v1');
      return new Response(html, { status: response.status, headers });
    }

    return response;
  }
};
