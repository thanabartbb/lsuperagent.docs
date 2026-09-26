// /keys: creates an SDK key via POST /api/sdk/keys. The full key is never rendered on the page;
// it lives only in this module's memory until the user copies or discards it.
const $ = (selector) => (typeof document === 'undefined' ? null : document.querySelector(selector));
const createBtn = $('#create');
const copyBtn = $('#copy');
const status = $('#status');
const created = $('#created');
let secret = '';

/** "lsg_eyJ0eXAi…BwFk" style preview: prefix plus the last 4 characters. */
export function maskKey(key) {
  if (typeof key !== 'string' || key.length < 12) return 'lsg_••••';
  return `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}`;
}

function setStatus(text, kind = '') {
  status.className = `status ${kind}`.trim();
  status.textContent = text;
}

function discard() {
  secret = '';
  created.hidden = true;
  $('#mask').textContent = '';
  setStatus('');
}

createBtn?.addEventListener('click', async () => {
  createBtn.disabled = true;
  setStatus('กำลังสร้าง key…');
  try {
    const response = await fetch('/api/sdk/keys', { method: 'POST', headers: { accept: 'application/json' }, credentials: 'same-origin' });
    if (response.status === 401) { location.replace('/login?return_to=%2Fkeys'); return; }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.api_key) throw new Error(body.message || `HTTP ${response.status}`);
    secret = body.api_key;
    $('#mask').textContent = maskKey(secret);
    $('#kid').textContent = `id: ${body.key?.id || '-'}`;
    $('#exp').textContent = `หมดอายุ: ${body.key?.expires_at ? new Date(body.key.expires_at).toLocaleString('th-TH') : '-'}`;
    created.hidden = false;
    copyBtn.textContent = 'คัดลอก key';
    setStatus('สร้าง key แล้ว กดคัดลอกแล้วนำไปเก็บทันที', 'ok');
    copyBtn.focus();
  } catch (err) {
    setStatus(`สร้าง key ไม่สำเร็จ: ${err && err.message || err}`, 'bad');
  } finally {
    createBtn.disabled = false;
  }
});

copyBtn?.addEventListener('click', async () => {
  if (!secret) return;
  try {
    await navigator.clipboard.writeText(secret);
    copyBtn.textContent = 'คัดลอกแล้ว ✓';
    setStatus('คัดลอกแล้ว นำไปวางใน .env หรือช่อง API key ของ Playground', 'ok');
  } catch (_) {
    setStatus('คัดลอกไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตการเข้าถึงคลิปบอร์ด', 'bad');
  }
});

$('#discard')?.addEventListener('click', discard);
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { secret = ''; });

(async () => {
  const who = $('#who');
  if (!who) return;
  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const data = await response.json();
    if (!data.authenticated) { location.replace('/login?return_to=%2Fkeys'); return; }
    who.textContent = `บัญชี: ${data.user?.email || data.user?.login || 'เข้าสู่ระบบแล้ว'}`;
  } catch (_) {
    who.textContent = 'ตรวจสอบบัญชีไม่สำเร็จ';
  }
})();
