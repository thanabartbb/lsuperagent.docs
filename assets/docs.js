// Docs runtime: renders the sidebar from docs-nav.js, loads /docs-content/<slug>.html into the page,
// and builds the "on this page" list, prev/next links, copy buttons and search.
import { NAV, icon } from '/assets/docs-nav.js';

const PAGES = NAV.flatMap((group) => group.pages.map((page) => ({ ...page, group: group.title })));
const $ = (selector) => document.querySelector(selector);
const content = $('#content');
const sidebar = $('#sidebar');
const toc = $('#toc');
const menuToggle = $('#menu-toggle');
const cache = new Map();

function slugFromPath(pathname) {
  const match = /^\/docs\/([a-z0-9-]+)\/?$/.exec(pathname);
  return match ? match[1] : 'introduction';
}

function renderSidebar(current) {
  sidebar.innerHTML = NAV.map((group) => `
    <section class="nav-group">
      <h2>${icon(group.icon)}${group.title}</h2>
      <ul>${group.pages.map((page) => `<li><a href="/docs/${page.slug}" data-slug="${page.slug}"${page.slug === current ? ' aria-current="page"' : ''}>${icon(page.icon)}${page.title}</a></li>`).join('')}</ul>
    </section>`).join('');
}

function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
}

async function fetchPage(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const request = fetch(`/docs-content/${slug}`, { cache: 'no-cache' }).then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return response.text();
  });
  cache.set(slug, request);
  request.catch(() => cache.delete(slug));
  return request;
}

function slugify(text, used) {
  let id = text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
  while (used.has(id)) id += '-';
  used.add(id);
  return id;
}

function enhance() {
  const used = new Set();
  const headings = [...content.querySelectorAll('h2, h3')];
  for (const heading of headings) if (!heading.id) heading.id = slugify(heading.textContent, used);
  toc.innerHTML = headings.length
    ? `<h2>ในหน้านี้</h2>${headings.map((h) => `<a href="#${h.id}" class="${h.tagName === 'H3' ? 'sub' : ''}">${h.textContent}</a>`).join('')}`
    : '';
  for (const pre of content.querySelectorAll('pre')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'คัดลอก';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? pre.textContent);
        button.textContent = 'คัดลอกแล้ว';
      } catch (_) {
        button.textContent = 'คัดลอกไม่ได้';
      }
      setTimeout(() => { button.textContent = 'คัดลอก'; }, 1400);
    });
    pre.append(button);
  }
  const base = `${location.origin}/v1`;
  content.querySelectorAll('[data-base]').forEach((el) => { el.textContent = base; });
  content.querySelectorAll('pre code').forEach((el) => { el.textContent = el.textContent.replaceAll('{{BASE}}', base); });
}

function renderPager(slug) {
  const index = PAGES.findIndex((page) => page.slug === slug);
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  const nav = document.createElement('nav');
  nav.className = 'pager';
  nav.setAttribute('aria-label', 'หน้าก่อนหน้าและถัดไป');
  nav.innerHTML = `${prev ? `<a class="prev" href="/docs/${prev.slug}"><small>← ก่อนหน้า</small>${prev.title}</a>` : ''}${next ? `<a class="next" href="/docs/${next.slug}"><small>ถัดไป →</small>${next.title}</a>` : ''}`;
  content.append(nav);
}

async function show(slug, { push = false, hash = '' } = {}) {
  const page = PAGES.find((p) => p.slug === slug);
  if (push) history.pushState({}, '', `/docs/${slug}${hash}`);
  renderSidebar(slug);
  setMenu(false);
  if (!page) {
    document.title = 'ไม่พบหน้า · LSUPERAGENT Docs';
    content.innerHTML = `<h1>ไม่พบหน้านี้</h1><p class="lead">ไม่มีเอกสาร <code>${slug}</code> ลองเลือกจากเมนู หรือกลับไปที่ <a href="/docs/introduction">การแนะนำ</a></p>`;
    toc.innerHTML = '';
    return;
  }
  try {
    const html = await fetchPage(slug);
    content.innerHTML = `<div class="crumb">${page.group}</div>${html}`;
  } catch (_) {
    content.innerHTML = '<h1>โหลดเอกสารไม่สำเร็จ</h1><p class="lead">กรุณาลองโหลดหน้าใหม่อีกครั้ง</p>';
  }
  document.title = `${page.title} · LSUPERAGENT Docs`;
  enhance();
  renderPager(slug);
  if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  else window.scrollTo(0, 0);
  if (push) content.focus({ preventScroll: true });
}

// In-app navigation for /docs/* links; everything else loads normally.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || link.target) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || !/^\/docs\/[a-z0-9-]+\/?$/.test(url.pathname)) return;
  event.preventDefault();
  closeSearch();
  const slug = slugFromPath(url.pathname);
  if (slug === slugFromPath(location.pathname) && url.hash) {
    history.pushState({}, '', url.hash);
    document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
    return;
  }
  show(slug, { push: true, hash: url.hash });
});
window.addEventListener('popstate', () => show(slugFromPath(location.pathname), { hash: location.hash }));
menuToggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));

// Search: loads every page once, then matches titles and body text.
const searchEl = $('#search');
const searchInput = $('#search-input');
const results = $('#search-results');
let index = null;
let selected = 0;

async function buildIndex() {
  if (index) return index;
  index = await Promise.all(PAGES.map(async (page) => {
    let text = '';
    try {
      const doc = new DOMParser().parseFromString(await fetchPage(page.slug), 'text/html');
      text = doc.body.textContent.replace(/\s+/g, ' ').trim();
    } catch (_) {}
    return { ...page, text };
  }));
  return index;
}

function snippet(text, query) {
  const at = text.toLowerCase().indexOf(query);
  if (at < 0) return text.slice(0, 110);
  const start = Math.max(0, at - 40);
  return (start ? '…' : '') + text.slice(start, at + query.length + 70) + '…';
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function runSearch() {
  const query = searchInput.value.trim().toLowerCase();
  const pages = await buildIndex();
  const hits = query
    ? pages.filter((p) => p.title.toLowerCase().includes(query) || p.text.toLowerCase().includes(query))
      .sort((a, b) => Number(b.title.toLowerCase().includes(query)) - Number(a.title.toLowerCase().includes(query)))
    : pages;
  selected = 0;
  results.innerHTML = hits.length
    ? hits.slice(0, 12).map((p, i) => `<li><a href="/docs/${p.slug}"${i === 0 ? ' aria-selected="true"' : ''}>${escapeHtml(p.group)} › ${escapeHtml(p.title)}<small>${escapeHtml(snippet(p.text, query))}</small></a></li>`).join('')
    : '<li class="muted" style="padding:12px">ไม่พบผลลัพธ์</li>';
}

function openSearch() {
  searchEl.hidden = false;
  searchInput.value = '';
  searchInput.focus();
  runSearch();
}

function closeSearch() {
  searchEl.hidden = true;
}

function moveSelection(step) {
  const links = [...results.querySelectorAll('a')];
  if (!links.length) return;
  selected = (selected + step + links.length) % links.length;
  links.forEach((a, i) => a.setAttribute('aria-selected', String(i === selected)));
  links[selected].scrollIntoView({ block: 'nearest' });
}

$('#search-open').addEventListener('click', openSearch);
searchInput.addEventListener('input', runSearch);
searchEl.addEventListener('click', (event) => { if (event.target === searchEl) closeSearch(); });
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); return; }
  if (searchEl.hidden) { if (event.key === 'Escape') setMenu(false); return; }
  if (event.key === 'Escape') closeSearch();
  else if (event.key === 'ArrowDown') { event.preventDefault(); moveSelection(1); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); moveSelection(-1); }
  else if (event.key === 'Enter') { event.preventDefault(); results.querySelectorAll('a')[selected]?.click(); }
});

show(slugFromPath(location.pathname), { hash: location.hash });
