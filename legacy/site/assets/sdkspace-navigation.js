const toggle = document.querySelector('.burger');
const nav = document.querySelector('#site-nav');
if (toggle && nav) {
  function setNavigation(open, returnFocus = false) {
    nav.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    setNavigation(nav.hidden);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !nav.hidden) setNavigation(false, true);
  });
  document.addEventListener('click', event => {
    if (!nav.hidden && !nav.contains(event.target) && !toggle.contains(event.target)) setNavigation(false);
  });
}
nav?.querySelectorAll('a').forEach(link => {
  if (new URL(link.href).pathname === location.pathname) link.setAttribute('aria-current', 'page');
});
const modeButton = document.querySelector('[data-theme-toggle]');
function setMode(mode) {
  document.documentElement.dataset.theme = mode;
  if (modeButton) {
    modeButton.textContent = mode === 'docs' ? 'Normal mode' : 'Docs mode';
    modeButton.setAttribute('aria-pressed', String(mode === 'docs'));
  }
}
let savedMode = 'normal';
try { savedMode = localStorage.getItem('lsuperagent-color-mode') === 'docs' ? 'docs' : 'normal'; } catch {}
setMode(savedMode);
modeButton?.addEventListener('click', () => {
  const mode = document.documentElement.dataset.theme === 'docs' ? 'normal' : 'docs';
  setMode(mode);
  try { localStorage.setItem('lsuperagent-color-mode', mode); } catch {}
});
(async () => {
  const who = document.getElementById('who');
  try {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) throw new Error('session_unavailable');
    const data = await response.json();
    // Browsing the existing home is public; private APIs still require an account.
    if (!data.authenticated) {
      const signIn = document.createElement('a');
      signIn.href = '/login';
      signIn.textContent = 'Sign in';
      nav?.prepend(signIn);
      return;
    }
    document.querySelector('[data-signout]').hidden = !data.authenticated;
    if (data.authenticated && document.body.dataset.sdkspacePage === 'home') {
      who.hidden = false;
      who.textContent = data.user?.email || data.user?.login || 'Signed in';
    }
  } catch {
    // Network errors must not prevent visitors from browsing home.
  }
})();
