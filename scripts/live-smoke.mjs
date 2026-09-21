const origin = 'https://lsuperagent-docs.thanabartb.workers.dev';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(flow, status, detail = '') {
  console.log(`${flow}: ${status}${detail ? ` — ${detail}` : ''}`);
}

async function waitForRelease() {
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      const response = await fetch(`${origin}/chat`, { signal: AbortSignal.timeout(10000) });
      const html = await response.text();
      if (response.ok && html.includes('สร้างงานด้วย AI') && html.includes('Read URL') && html.includes('Download')) {
        log('release', 'PASS', `attempt ${attempt}`);
        return;
      }
    } catch (_) {}
    log('release', 'WAIT', `attempt ${attempt}/24`);
    await sleep(10000);
  }
  throw new Error('production_not_updated_to_audited_workspace');
}

async function post(path, body, timeout = 90000) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const classification = [data.error_code, data.error_type, data.provider_status].filter((value) => value !== null && value !== undefined && value !== '').join('/');
    throw new Error(`${path} HTTP ${response.status}: ${data.status || 'error'} ${data.message || ''}${classification ? ` [${classification}]` : ''}`.trim());
  }
  return data;
}

function requireText(flow, data) {
  if (!data || data.ok !== true || typeof data.message !== 'string' || data.message.trim().length === 0) {
    throw new Error(`${flow}_missing_text_result`);
  }
  log(flow, 'PASS');
}

await waitForRelease();

const chat = await post('/api/chat', { message: 'ตอบคำเดียวว่า READY', mode: 'chat' });
requireText('chat', chat);

const write = await post('/api/chat', { message: 'เขียนหัวข้อสั้น ๆ 1 บรรทัดเกี่ยวกับการเรียนรู้', mode: 'write', tool: 'writer' });
requireText('write', write);

const longCode = `โปรดตรวจข้อความโค้ดตัวอย่างนี้และตอบคำเดียวว่า OK\n${'const x = 1; // pad\n'.repeat(300)}`;
if (longCode.length <= 4000) throw new Error('code_probe_not_large_enough');
const code = await post('/api/chat', { message: longCode, mode: 'code', tool: 'code' });
requireText('code-large-input', code);

const research = await post('/api/chat', { message: 'ค้นคว้าข่าวเทคโนโลยีล่าสุดหนึ่งเรื่องและสรุปสั้น ๆ พร้อมแหล่งอ้างอิง', mode: 'research', tool: 'research' }, 120000);
requireText('research', research);
if (!Array.isArray(research.sources) || research.sources.length === 0 || !research.sources.every((source) => typeof source.url === 'string' && source.url.startsWith('http'))) {
  throw new Error('research_missing_sources');
}
log('research-sources', 'PASS', `${research.sources.length} source(s)`);

const urlRead = await post('/api/chat', { message: 'อ่าน https://example.com/ แล้วบอกชื่อหัวข้อหลักของหน้าเว็บสั้น ๆ', mode: 'url', tool: 'url' }, 120000);
requireText('read-url', urlRead);
if (!Array.isArray(urlRead.sources) || urlRead.sources.length === 0) throw new Error('read_url_missing_sources');
log('read-url-sources', 'PASS', `${urlRead.sources.length} source(s)`);

const image = await post('/api/image', { prompt: 'A simple flat blue circle centered on a pure black background, no text, square composition.' }, 180000);
if (!image || image.ok !== true || !image.image || image.image.mime_type !== 'image/png' || typeof image.image.data_base64 !== 'string' || image.image.data_base64.length < 1000) {
  throw new Error('image_missing_downloadable_result');
}
log('image', 'PASS', `base64-bytes>${Math.floor(image.image.data_base64.length * 0.75)}`);

console.log('LIVE_SMOKE_PASS');
