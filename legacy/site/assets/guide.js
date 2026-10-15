// SDK Guide: every "run" button calls the published lsupergen-sdk@0.1.0 build (vendored, byte-identical to npm).
import * as sdk from '/vendor/lsupergen-sdk/0.1.0/index.js';

const { Lsupergen, APIError, LsupergenError, VERSION } = sdk;
const BASE_URL = `${location.origin}/v1`;
const $ = (selector) => document.querySelector(selector);
const keyInput = $('#api-key');
let lastReport = null;

// lsupergen-sdk 0.1.0 calls the stored fetch unbound, which browsers reject ("Illegal invocation"),
// so the guide passes a wrapper exactly as documented in step 3.
function client(apiKey = keyInput.value.trim(), options = {}) {
  return new Lsupergen({ apiKey: apiKey || 'lsg_not_set', baseURL: BASE_URL, timeout: 90_000, fetch: (...args) => fetch(...args), ...options });
}

function setBadge(name, state, text) {
  const badge = document.querySelector(`[data-badge="${name}"]`);
  if (!badge) return;
  badge.className = `badge ${state}`;
  badge.textContent = text;
}

function show(name, meta, data) {
  const out = document.querySelector(`[data-out="${name}"]`);
  if (!out) return;
  out.hidden = false;
  out.replaceChildren();
  const metaEl = document.createElement('div');
  metaEl.className = 'meta';
  metaEl.textContent = meta;
  const pre = document.createElement('pre');
  pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  out.append(metaEl, pre);
}

function errorDetail(err) {
  if (err instanceof APIError) return { error: err.name, status: err.status, message: err.message, body: err.body };
  return { error: err && err.name, message: err && err.message };
}

function requireKey() {
  if (!keyInput.value.trim().startsWith('lsg_')) throw new Error('ยังไม่มี API key — สร้างที่หน้า /keys แล้ววางในขั้นที่ 2');
}

// Each check returns { pass, data } and throws only on unexpected failures.
const checks = {
  async install() {
    const exported = ['Lsupergen', 'APIError', 'TimeoutError', 'ConnectionError', 'LsupergenError', 'VERSION'];
    const missing = exported.filter((name) => !(name in sdk));
    return { pass: missing.length === 0 && VERSION === '0.1.0', data: { package: 'lsupergen-sdk', version: VERSION, exports: Object.keys(sdk).sort(), missing } };
  },
  async health() {
    const data = await client().get('/health');
    return { pass: data.ok === true && data.api_version === 'v1', data };
  },
  async me() {
    requireKey();
    const data = await client().get('/me');
    return { pass: data.ok === true && Boolean(data.user) && Boolean(data.key && data.key.expires_at), data };
  },
  async chat() {
    requireKey();
    const message = $('#chat-message').value.trim() || 'สวัสดี';
    const data = await client().post('/chat', { body: { message } });
    return { pass: data.ok === true && typeof data.message === 'string' && data.message.trim().length > 0, data };
  },
  async errors() {
    try {
      await client('lsg_invalid.key', { maxRetries: 0 }).get('/me');
      return { pass: false, data: { error: 'expected APIError 401 but request succeeded' } };
    } catch (err) {
      const pass = err instanceof APIError && err instanceof LsupergenError && err.status === 401;
      return { pass, data: { instanceof_APIError: err instanceof APIError, instanceof_LsupergenError: err instanceof LsupergenError, ...errorDetail(err) } };
    }
  }
};

async function runCheck(name) {
  const started = performance.now();
  setBadge(name, 'run', 'กำลังรัน…');
  let result;
  try {
    result = await checks[name]();
  } catch (err) {
    result = { pass: false, status: err instanceof APIError ? err.status : undefined, data: errorDetail(err) };
  }
  const ms = Math.round(performance.now() - started);
  setBadge(name, result.pass ? 'pass' : 'fail', result.pass ? 'PASS' : 'FAIL');
  show(name, `${result.pass ? 'PASS' : 'FAIL'} · ${ms} ms · ${new Date().toISOString()}`, result.data);
  return { step: name, pass: result.pass, ms, data: result.data };
}

async function runAll(button) {
  const steps = ['install', 'health', 'me', 'chat', 'errors'];
  const summary = $('#summary');
  summary.hidden = false;
  summary.replaceChildren();
  setBadge('all', 'run', 'กำลังรัน…');
  const results = [];
  for (const step of steps) {
    const result = await runCheck(step);
    results.push(result);
    const row = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = `${step} · ${result.ms} ms`;
    const status = document.createElement('span');
    status.textContent = result.pass ? 'PASS' : 'FAIL';
    status.style.color = result.pass ? 'var(--ok)' : 'var(--bad)';
    row.append(label, status);
    summary.append(row);
  }
  const passed = results.every((r) => r.pass);
  lastReport = {
    report: 'lsupergen-sdk guide verification',
    package: `lsupergen-sdk@${VERSION}`,
    base_url: BASE_URL,
    generated_at: new Date().toISOString(),
    user_agent: navigator.userAgent,
    result: passed ? 'PASS' : 'FAIL',
    steps: results
  };
  setBadge('all', passed ? 'pass' : 'fail', passed ? `PASS ${results.length}/${results.length}` : `FAIL ${results.filter((r) => r.pass).length}/${results.length}`);
  show('all', `Proof report · ${lastReport.generated_at}`, lastReport);
  $('#copy-report').disabled = false;
  button.disabled = false;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'คัดลอกแล้ว';
    setTimeout(() => { button.textContent = original; }, 1400);
  } catch (_) {
    button.textContent = 'คัดลอกไม่สำเร็จ';
  }
}

function fillTemplates() {
  document.querySelectorAll('[data-template]').forEach((el) => { el.textContent = el.textContent.replaceAll('{{BASE}}', BASE_URL); });
  document.querySelectorAll('[data-base]').forEach((el) => { el.textContent = BASE_URL; });
  $('#base-url').textContent = BASE_URL;
  $('#sdk-version').textContent = `v${VERSION}`;
  document.querySelectorAll('.code').forEach((block) => {
    const pre = block.querySelector('pre');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'คัดลอก';
    button.addEventListener('click', () => copyText(pre.textContent, button));
    block.append(button);
  });
}

function wireTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    document.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
  }));
}

async function loadAccount() {
  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    const data = await response.json();
    if (!data.authenticated) { location.replace('/login?return_to=/guide'); return; }
    $('#who').textContent = data.user?.email || data.user?.login || 'เข้าสู่ระบบแล้ว';
  } catch (_) {
    $('#who').textContent = 'ตรวจสอบบัญชีไม่สำเร็จ';
  }
}

document.querySelectorAll('[data-run]').forEach((button) => {
  button.addEventListener('click', async () => {
    const name = button.dataset.run;
    button.disabled = true;
    if (name === 'all') {
      if (!keyInput.value.trim().startsWith('lsg_')) {
        setBadge('all', 'fail', 'ต้องมี key');
        show('all', 'FAIL', 'ยังไม่มี API key — สร้างที่หน้า /keys แล้ววางในขั้นที่ 2 ก่อนรันทั้งหมด');
        button.disabled = false;
        return;
      }
      await runAll(button);
      return;
    }
    await runCheck(name);
    button.disabled = false;
  });
});

function updateKeyState() {
  const value = keyInput.value.trim();
  const badge = $('#key-state');
  if (!badge) return;
  const ok = /^lsg_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
  badge.className = `badge ${value ? (ok ? 'pass' : 'fail') : ''}`.trim();
  badge.textContent = value ? (ok ? 'วาง key แล้ว' : 'รูปแบบ key ไม่ถูกต้อง') : 'ยังไม่มี key';
}
keyInput.addEventListener('input', updateKeyState);
$('#clear-key').addEventListener('click', () => { keyInput.value = ''; updateKeyState(); keyInput.focus(); });
$('#copy-report').addEventListener('click', (event) => { if (lastReport) copyText(JSON.stringify(lastReport, null, 2), event.currentTarget); });

fillTemplates();
wireTabs();
loadAccount();
