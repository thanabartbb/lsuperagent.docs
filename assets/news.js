// /news: renders GET /api/feed?source=... using textContent only; upstream text is never parsed as HTML.
(() => {
  const TAB_KEY = 'lsuperagent_news_tab';
  const REFRESH_MS = 60_000;
  const LABELS = { openai: 'OpenAI', anthropic: 'Anthropic', claude: 'Claude', grok: 'Grok', ai: 'AI News', community: 'Community' };
  const tabs = [...document.querySelectorAll('.tab[data-source]')];
  const list = document.getElementById('news-list');
  const status = document.getElementById('news-status');
  let current = 'all';
  let seq = 0;
  let timer = null;

  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (tabs.some((t) => t.dataset.source === saved)) current = saved;
  } catch (_) {}

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function timeAgo(ms) {
    if (!ms) return '';
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' นาทีที่แล้ว';
    if (s < 86400) return Math.round(s / 3600) + ' ชั่วโมงที่แล้ว';
    return Math.round(s / 86400) + ' วันที่แล้ว';
  }

  function render(feed) {
    list.replaceChildren();
    if (!feed.items.length) {
      list.append(el('li', 'empty', 'ยังไม่มีข่าวจากแหล่งนี้'));
      return;
    }
    for (const item of feed.items) {
      const li = el('li', 'item');
      const a = el('a');
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.append(el('div', 'src', LABELS[item.source] || item.source));
      a.append(el('h2', '', item.repo || item.title));
      if (item.description) a.append(el('p', 'desc', item.description));
      const meta = [item.meta, item.stars != null ? '★ ' + item.stars.toLocaleString() : '', timeAgo(item.time)].filter(Boolean).join(' · ');
      if (meta) a.append(el('div', 'meta', meta));
      li.append(a);
      list.append(li);
    }
  }

  async function load() {
    const mine = ++seq;
    status.className = 'status';
    status.textContent = 'กำลังโหลด…';
    try {
      const res = await fetch('/api/feed?source=' + encodeURIComponent(current), { credentials: 'same-origin' });
      if (res.status === 401) { location.href = '/login?return_to=%2Fnews'; return; }
      const feed = await res.json();
      if (mine !== seq) return;
      render({ items: feed.items || [] });
      const failed = (feed.errors || []).map((e) => LABELS[e.source] || e.source);
      if (!res.ok && !feed.items) throw new Error(feed.message || 'HTTP ' + res.status);
      status.textContent = 'อัปเดต ' + new Date(feed.fetchedAt || Date.now()).toLocaleTimeString('th-TH') + (failed.length ? ' · โหลดไม่ได้: ' + failed.join(', ') : '');
      if (failed.length) status.className = 'status bad';
    } catch (err) {
      if (mine !== seq) return;
      status.className = 'status bad';
      status.textContent = 'โหลดข่าวไม่สำเร็จ: ' + (err && err.message || err);
    }
  }

  function select(source) {
    current = source;
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.source === source));
    try { localStorage.setItem(TAB_KEY, source); } catch (_) {}
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  }

  for (const t of tabs) t.addEventListener('click', () => select(t.dataset.source));
  select(current);
})();
