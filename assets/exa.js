(() => {
  const form = document.getElementById('exa-form');
  const queryInput = document.getElementById('exa-query');
  const status = document.getElementById('exa-status');
  const results = document.getElementById('exa-results');
  const button = form.querySelector('button[type="submit"]');
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const query = queryInput.value.trim();
    if (pending || !query) return;
    pending = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    results.setAttribute('aria-busy', 'true');
    status.textContent = 'กำลังค้นหา…';
    results.replaceChildren();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch('/api/exa/search', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, numResults: 5 }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'ค้นหาไม่สำเร็จ กรุณาลองใหม่');
      const items = Array.isArray(data.results) ? data.results : [];
      for (const result of items) {
        let url;
        try { url = new URL(result.url); } catch { continue; }
        if (!['https:', 'http:'].includes(url.protocol)) continue;
        const article = document.createElement('article');
        article.className = 'exa-result';
        const heading = document.createElement('h2');
        const link = document.createElement('a');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = result.title || url.hostname;
        heading.append(link);
        article.append(heading);
        if (result.published_date) {
          const time = document.createElement('time');
          time.textContent = result.published_date;
          article.append(time);
        }
        for (const highlight of result.highlights || []) {
          const text = document.createElement('p');
          text.textContent = highlight;
          article.append(text);
        }
        results.append(article);
      }
      status.textContent = results.children.length ? `พบ ${results.children.length} ผลลัพธ์` : 'ไม่พบผลลัพธ์';
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'ค้นหาใช้เวลานาน กรุณาลองใหม่' : error.message || 'ค้นหาไม่สำเร็จ กรุณาลองใหม่';
    } finally {
      clearTimeout(timeout);
      pending = false;
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      results.setAttribute('aria-busy', 'false');
    }
  });
})();
