(() => {
  if (document.documentElement.dataset.responsiveNav === 'v2') return;
  if (document.querySelector('[data-ls-mobile-menu-fix="v1"]')) return;
  if (document.querySelector('.ls-native-menu, .mobile-menu')) return;

  const links = [
    ['/', 'Home'],
    ['/chat', 'Chat'],
    ['/login', 'Login'],
    ['/tools', 'Tools'],
    ['/examples', 'Examples'],
    ['/getting-started', 'Docs'],
    ['/api', 'API'],
    ['/guides', 'Guides'],
    ['/changelog', 'Changelog'],
  ];
  const normalizedPath = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  const items = links.map(([href, label]) => {
    const current = normalizedPath === href ? ' aria-current="page"' : '';
    return `<a href="${href}"${current}>${label}<span aria-hidden="true">→</span></a>`;
  }).join('');

  const menu = document.createElement('details');
  menu.className = 'ls-mobile-menu';
  menu.dataset.lsMobileMenuFix = 'v1';
  menu.innerHTML = `<summary aria-label="เปิดเมนู"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary><div class="ls-mobile-panel" role="navigation" aria-label="Mobile menu"><div><div class="ls-mobile-title">lsuperagen.docs</div><div class="ls-mobile-sub">PUBLIC NAV · MOBILE FIX V1</div></div><nav class="ls-mobile-links">${items}</nav><div class="ls-mobile-note">Private /dev ไม่อยู่ใน public menu</div></div>`;
  document.body.append(menu);
})();
