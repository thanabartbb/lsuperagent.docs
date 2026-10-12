import { BLOG_POSTS, BLOG_CATEGORIES, BLOG_RESOURCE_GROUPS } from './blog-content.js';
const origin = 'https://agents-sdk.space';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = value => new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(value + 'T00:00:00Z'));
const postPath = post => '/blogs/' + post.slug;
const category = post => BLOG_CATEGORIES[post.category];
const sourceLinks = post => post.sources.map(source => `<li><a href="${escape(source.url)}" rel="noopener noreferrer">${escape(source.title)} <span aria-hidden="true">↗</span></a></li>`).join('');
const card = post => `<article class="blog-card"><p class="blog-eyebrow">${escape(category(post))}</p><h3><a href="${postPath(post)}">${escape(post.title)}</a></h3><p>${escape(post.excerpt)}</p><p class="blog-meta"><time datetime="${post.published}">${date(post.published)}</time> · ${post.minutes} นาที</p><a class="blog-read" href="${postPath(post)}" aria-label="อ่าน ${escape(post.title)}">อ่านบทความ <span aria-hidden="true">→</span></a></article>`;
export const blogUrls = () => [{ path: '/blogs', updated: '2026-10-12' }, ...BLOG_POSTS.map(post => ({ path: postPath(post), updated: post.updated }))];
export function featuredBlogsMarkup() {
  return `<section class="blog-featured" aria-labelledby="blog-featured-title"><div class="blog-section-heading"><div><p class="blog-eyebrow">LEARN IN PUBLIC</p><h2 id="blog-featured-title">เรียนจากงานจริง แชร์ให้คนต่อยอด</h2><p>บทเรียน โค้ดตัวอย่าง และแหล่งอัปเดตสำหรับ Developer</p></div><a class="blog-read" href="/blogs">ดู Blogs ทั้งหมด <span aria-hidden="true">→</span></a></div><div class="blog-grid">${BLOG_POSTS.slice(0, 3).map(card).join('')}</div></section>`;
}
function blocksHtml(post) {
  let heading = 0;
  return post.blocks.map(block => block.type === 'heading' ? `<h2 id="section-${++heading}">${escape(block.text)}</h2>` : block.type === 'code' ? `<figure class="blog-example"><figcaption>ตัวอย่าง · ${escape(block.language)}</figcaption><pre tabindex="0" aria-label="ตัวอย่าง ${escape(block.language)} เลื่อนได้ในแนวนอน"><code>${escape(block.text)}</code></pre></figure>` : `<p>${escape(block.text)}</p>`).join('');
}
function markdown(post) {
  return `# ${post.title}\n\nSDKSPACE editorial · ${post.published}\n\n${post.blocks.map(block => block.type === 'heading' ? '## ' + block.text : block.type === 'code' ? '```' + block.language + '\n' + block.text + '\n```' : block.text).join('\n\n')}\n\n## แหล่งอ้างอิง\n\n${post.sources.map(s => `- [${s.title}](${s.url})`).join('\n')}\n`;
}
function document(path, title, description, content, post) {
  const schema = post ? { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.excerpt, datePublished: post.published, dateModified: post.updated, inLanguage: 'th', author: { '@type': 'Organization', name: 'SDKSPACE' }, publisher: { '@type': 'Organization', name: 'SDKSPACE' }, mainEntityOfPage: origin + path, citation: post.sources.map(s => s.url) } : { '@context': 'https://schema.org', '@type': 'Blog', name: 'SDKSPACE Blogs', url: origin + '/blogs', inLanguage: 'th' };
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#000000"><title>${escape(title)} · SDKSPACE</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${origin + escape(path)}"><meta property="og:type" content="${post ? 'article' : 'website'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${origin + escape(path)}"><meta property="og:image" content="${origin}/assets/sdkspace-logo.svg"><link rel="icon" href="/assets/sdkspace-logo.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/theme.css?v=4"><link rel="stylesheet" href="/assets/theme-modes.css?v=3"><link rel="stylesheet" href="/assets/sdkspace-ui.css?v=1"><link rel="stylesheet" href="/assets/blogs.css?v=1"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head><body data-sdkspace-public class="blog-page"><a class="sdk-skip" href="#main-content">ข้ามไปเนื้อหา</a><header class="blog-header"><a class="blog-brand" href="/home"><img src="/assets/sdkspace-logo.svg" width="26" height="26" alt="">SDKSPACE</a><nav aria-label="เมนูหลัก"><a href="/home">Home</a><a href="/blogs" aria-current="page">Blogs</a><a href="/developers">API</a><a href="/login">เข้าสู่ระบบ</a></nav><button class="theme-toggle" type="button" data-theme-toggle>Docs mode</button></header><main id="main-content" tabindex="-1">${content}</main><footer class="blog-footer"><p>SDKSPACE · เรียนรู้และแชร์จากงานพัฒนา</p><nav aria-label="ข้อมูลเว็บไซต์"><a href="/about">เกี่ยวกับ</a><a href="/privacy">ความเป็นส่วนตัว</a><a href="/contact">ติดต่อ</a><a href="https://devstack.bid">devstack.bid ↗</a></nav></footer><script src="/assets/theme-modes.js" defer></script><script src="/assets/sdkspace-ui.js" defer></script></body></html>`;
}
function resourcesMarkup() {
  return `<section class="blog-resources" aria-labelledby="blog-resources-title"><h2 id="blog-resources-title">คู่มือและแหล่งอ้างอิง</h2><p>เริ่มจากคู่มือ SDKSPACE แล้วต่อยอดด้วยเอกสาร OpenAI และ Cloudflare</p><div class="blog-grid">${BLOG_RESOURCE_GROUPS.map(group => `<section class="blog-card"><h3>${escape(group.title)}</h3><ul>${group.links.map(([title, url]) => `<li><a href="${escape(url)}">${escape(title)}${url.startsWith('https:') ? ' ↗' : ''}</a></li>`).join('')}</ul></section>`).join('')}</div></section>`;
}
function index(url) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 160);
  const selected = Object.hasOwn(BLOG_CATEGORIES, url.searchParams.get('category')) ? url.searchParams.get('category') : '';
  const posts = BLOG_POSTS.filter(post => (!selected || post.category === selected) && (!query || [post.title, post.excerpt, ...post.blocks.map(b => b.text)].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const filters = Object.entries(BLOG_CATEGORIES).map(([key, value]) => `<option value="${key}"${selected === key ? ' selected' : ''}>${escape(value)}</option>`).join('');
  return { posts, content: `<section class="blog-hero"><p class="blog-eyebrow">SDKSPACE / DEVELOPER NOTES</p><h1>เรียนจากของจริง<br><span>แชร์สิ่งที่นำไปใช้ได้</span></h1><p class="blog-lead">บันทึกจากงานพัฒนา ตัวอย่างโค้ด และข้อมูล OpenAI ที่มีแหล่งอ้างอิง</p><p class="blog-meta">เขียนโดย SDKSPACE · ตรวจเนื้อหา ${date('2026-10-12')}</p></section><form class="blog-filters" action="/blogs" method="get" role="search" aria-label="ค้นหาบทความ"><div><label for="blog-query">ค้นหาบทความ</label><input id="blog-query" name="q" type="search" value="${escape(query)}" maxlength="160" placeholder="เช่น Responses API หรือ CSS"></div><div><label for="blog-category">ประเภทบทความ</label><select id="blog-category" name="category"><option value="">ทั้งหมด</option>${filters}</select></div><button type="submit">ค้นหา</button></form><section class="blog-results" aria-labelledby="blog-results-title"><div class="blog-section-heading"><h2 id="blog-results-title">${query || selected ? 'ผลการค้นหา' : 'บทความล่าสุด'}</h2><p>${posts.length} บทความ</p></div>${posts.length ? `<div class="blog-grid">${posts.map(card).join('')}</div>` : '<div class="blog-empty"><h3>ยังไม่พบบทความ</h3><p>ลองคำค้นอื่นหรือดูบทความทั้งหมด</p><a href="/blogs">ล้างตัวกรอง</a></div>'}</section>${resourcesMarkup()}` };
}
export function blogResource(request, path) {
  if (!['/blog', '/blog/', '/blogs', '/blogs/'].includes(path) && !path.startsWith('/blogs/')) return null;
  const url = new URL(request.url);
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff', vary: 'Accept' };
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers: { allow: 'GET, HEAD', 'content-type': 'application/json' } });
  if (path === '/blog' || path === '/blog/' || path.endsWith('/')) return new Response(null, { status: 308, headers: { location: (path.startsWith('/blog/') && path !== '/blog/' ? path : path === '/blog/' || path === '/blog' ? '/blogs' : path.replace(/\/+$/, '')) + url.search } });
  const post = BLOG_POSTS.find(post => postPath(post) === path);
  const accept = (request.headers.get('accept') || '').split(',').map(part => { const [type, ...params] = part.trim().split(';'); return { type, q: Number(params.find(p => p.trim().startsWith('q='))?.trim().slice(2) ?? 1) }; });
  const prefersMarkdown = Math.max(0, ...accept.filter(p => p.type === 'text/markdown').map(p => p.q)) > 0 && Math.max(0, ...accept.filter(p => p.type === 'text/markdown').map(p => p.q)) >= Math.max(0, ...accept.filter(p => p.type === 'text/html').map(p => p.q));
  let body, status = 200;
  if (path !== '/blogs' && !post) {
    status = 404; headers['cache-control'] = 'no-store';
    body = document(path, 'ไม่พบบทความ', 'ไม่พบบทความที่ร้องขอ', '<section class="blog-hero"><h1>ไม่พบบทความ</h1><p>บทความนี้อาจถูกย้ายหรือไม่มีอยู่</p><a href="/blogs">กลับไป Blogs</a></section>');
  } else if (prefersMarkdown) {
    headers['content-type'] = 'text/markdown; charset=utf-8';
    body = post ? markdown(post) : '# SDKSPACE Blogs\n\n' + index(url).posts.map(post => `## [${post.title}](${postPath(post)})\n\n${post.excerpt}`).join('\n\n');
  } else if (post) {
    let n = 0;
    const toc = post.blocks.filter(b => b.type === 'heading').map(b => `<li><a href="#section-${++n}">${escape(b.text)}</a></li>`).join('');
    const content = `<nav class="blog-breadcrumb" aria-label="เส้นทางหน้า"><a href="/blogs">Blogs</a><span aria-hidden="true">/</span><span>${escape(category(post))}</span></nav><article class="blog-article"><header><p class="blog-eyebrow">${escape(category(post))}</p><h1>${escape(post.title)}</h1><p class="blog-lead">${escape(post.excerpt)}</p><p class="blog-meta">SDKSPACE editorial · <time datetime="${post.published}">${date(post.published)}</time> · ${post.minutes} นาที</p></header><nav class="blog-toc" aria-label="สารบัญบทความ"><h2>ในบทความนี้</h2><ol>${toc}</ol></nav><div class="blog-prose">${blocksHtml(post)}<section aria-labelledby="blog-sources-title"><h2 id="blog-sources-title">แหล่งอ้างอิง</h2><p class="blog-meta">ทบทวนเมื่อ <time datetime="${post.updated}">${date(post.updated)}</time></p><ul>${sourceLinks(post)}</ul></section></div><a class="blog-read" href="/blogs">← บทความทั้งหมด</a></article>`;
    body = document(path, post.title, post.excerpt, content, post);
  } else body = document('/blogs', 'Blogs', 'บทเรียน โค้ดตัวอย่าง และข้อมูล OpenAI สำหรับ Developer', index(url).content);
  return new Response(request.method === 'HEAD' ? null : body, { status, headers });
}
