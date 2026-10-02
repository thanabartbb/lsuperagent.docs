const toggle = document.querySelector('.burger');
const nav = document.querySelector('#site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    nav.hidden = !nav.hidden;
    toggle.setAttribute('aria-expanded', String(!nav.hidden));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      nav.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}
const modeButton = document.querySelector('[data-theme-toggle]');
function setMode(mode) {
  document.documentElement.dataset.theme = mode;
  if (modeButton) modeButton.textContent = mode === 'docs' ? 'Normal mode' : 'Docs mode';
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
    if (!data.authenticated && document.body.dataset.sdkspacePage === 'home') {
      location.replace('/login?return_to=/home');
      return;
    }
    document.querySelector('[data-signout]').hidden = !data.authenticated;
    if (data.authenticated && document.body.dataset.sdkspacePage === 'home') {
      who.hidden = false;
      who.textContent = data.user?.email || data.user?.login || 'Signed in';
    }
  } catch {
    if (document.body.dataset.sdkspacePage === 'home') {
      who.hidden = false;
      who.textContent = 'ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองโหลดหน้าใหม่';
    }
  }
})();
