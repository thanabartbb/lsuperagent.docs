// SDKSPACE Worker starter: server-to-server API only; no public anonymous AI proxy.
const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/health') return json({ ok: true, template: 'sdkspace-worker', api: '/chat' });
    if (pathname !== '/chat') return json({ ok: false, message: 'Not found' }, 404);
    if (request.method !== 'POST') return json({ ok: false, message: 'POST required' }, 405);
    if (!env.APP_ACCESS_TOKEN || env.APP_ACCESS_TOKEN.length < 20 || request.headers.get('authorization') !== `Bearer ${env.APP_ACCESS_TOKEN}`) return json({ ok: false, message: 'Unauthorized' }, 401);
    if (!env.SDKSPACE_API_KEY?.startsWith('lsg_')) return json({ ok: false, message: 'Missing SDKSPACE_API_KEY secret' }, 503);
    let body;
    try { if (Number(request.headers.get('content-length') || 0) > 16000) throw Error('too-large'); body = await request.json(); }
    catch { return json({ ok: false, message: 'Invalid JSON' }, 400); }
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 12000) return json({ ok: false, message: 'Message must be 1–12000 characters' }, 400);
    try {
      const origin = new URL(env.SDKSPACE_API_BASE_URL || 'https://agents-sdk.space');
      if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash) throw Error('Invalid API origin');
      const response = await fetch(`${origin.origin}/v1/chat`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.SDKSPACE_API_KEY}` }, body: JSON.stringify({ message, stream: false }), signal: AbortSignal.timeout(120000) });
      return new Response(response.body, { status: response.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    } catch { return json({ ok: false, message: 'SDKSPACE API unavailable' }, 502); }
  }
};
