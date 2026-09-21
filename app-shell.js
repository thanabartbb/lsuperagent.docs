(function () {
  const root = document.querySelector('[data-app-shell]');
  if (!root) return;

  const page = document.body.dataset.shellPage || '';
  const profileEl = root.querySelector('[data-shell-profile]');
  const ownerLink = root.querySelector('[data-shell-nav="dev"]');
  const menuBtn = root.querySelector('.shell-menu-btn');
  const panel = document.getElementById('shell-mobile-panel');
  const desktopNav = root.querySelector('.shell-nav');
  const desktopLogout = root.querySelector('.shell-logout');

  function markCurrentNav() {
    root.querySelectorAll('[data-shell-nav]').forEach((link) => {
      if (link.dataset.shellNav === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function rebuildMobileNav() {
    if (!panel || !desktopNav) return;
    panel.innerHTML = '';
    const mobileNav = document.createElement('nav');
    mobileNav.className = 'shell-mobile-nav';
    mobileNav.setAttribute('aria-label', 'เมนูมือถือ');
    desktopNav.querySelectorAll('a').forEach((link) => {
      if (link.hidden) return;
      mobileNav.append(link.cloneNode(true));
    });
    if (desktopLogout) mobileNav.append(desktopLogout.cloneNode(true));
    panel.append(mobileNav);
  }

  markCurrentNav();
  rebuildMobileNav();

  if (menuBtn && panel) {
    menuBtn.addEventListener('click', () => {
      const open = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
    });
  }

  fetch('/api/auth/session', { credentials: 'same-origin' })
    .then((response) => response.json())
    .then((data) => {
      if (!data.authenticated) {
        const returnTo = location.pathname + location.search;
        location.replace('/login?return_to=' + encodeURIComponent(returnTo));
        return;
      }

      const user = data.user || {};
      const label = user.name || user.login || user.email || 'Signed in';

      if (profileEl) {
        profileEl.textContent = '';
        if (user.avatar) {
          const img = document.createElement('img');
          img.src = user.avatar;
          img.alt = '';
          img.className = 'shell-avatar';
          img.width = 28;
          img.height = 28;
          profileEl.append(img);
        }
        const name = document.createElement('span');
        name.className = 'shell-profile-name';
        name.textContent = label;
        profileEl.append(name);
      }

      if (data.owner_google && ownerLink) {
        ownerLink.hidden = false;
        markCurrentNav();
        rebuildMobileNav();
      }
    })
    .catch(() => {});
})();
