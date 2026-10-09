import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const expected = process.env.APP_ACCESS_TOKEN;
  const supplied = request.headers.get('authorization');
  if (!expected || expected.length < 20 || !supplied || supplied !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  const apiKey = process.env.SDKSPACE_API_KEY;
  if (!apiKey?.startsWith('lsg_')) return NextResponse.json({ ok: false, message: 'Configure SDKSPACE_API_KEY on the server' }, { status: 503 });
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 16000) throw Error('too-large');
    body = await request.json();
  } catch { return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 }); }
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 12000) return NextResponse.json({ ok: false, message: 'Message must be 1–12000 characters' }, { status: 400 });
  try {
    const origin = new URL(process.env.SDKSPACE_API_BASE_URL || 'https://agents-sdk.space');
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error('Invalid API origin');
    const upstream = await fetch(`${origin.origin}/v1/chat`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ message, stream: false }), cache: 'no-store', signal: AbortSignal.timeout(120000) });
    const data = await upstream.json().catch(() => ({ ok: false, message: 'Invalid SDKSPACE API response' }));
    return NextResponse.json(data, { status: upstream.status, headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ ok: false, message: 'SDKSPACE API unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } }); }
}
