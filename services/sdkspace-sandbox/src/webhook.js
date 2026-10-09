// Standard Webhooks (webhook-id, webhook-timestamp, webhook-signature).
// Pure WebCrypto implementation: no Node polyfills or runtime dependencies.
export async function verifyWebhook(rawBody, headers, secret, now = Date.now()) {
  const id = headers.get('webhook-id') || '';
  const timestamp = headers.get('webhook-timestamp') || '';
  const signatures = headers.get('webhook-signature') || '';
  if (!/^whsec_[A-Za-z0-9+/_=-]{16,}$/.test(secret || '')) return false;
  if (!id || id.length > 256 || !/^\d{10}$/.test(timestamp) || !signatures) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  let bytes;
  try {
    const b64 = secret.slice(6).replace(/-/g, '+').replace(/_/g, '/');
    bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  } catch (_) { return false; }
  const key = await crypto.subtle.importKey(
    'raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const payload = new TextEncoder().encode(id + '.' + timestamp + '.' + rawBody);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  for (const entry of signatures.split(' ')) {
    if (!entry.startsWith('v1,')) continue;
    let claimed;
    try { claimed = Uint8Array.from(atob(entry.slice(3)), c => c.charCodeAt(0)); }
    catch (_) { continue; }
    if (claimed.length !== digest.length) continue;
    let mismatch = 0;
    for (let i = 0; i < digest.length; i++) mismatch |= digest[i] ^ claimed[i];
    if (!mismatch) return true;
  }
  return false;
}
