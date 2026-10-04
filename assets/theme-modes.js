(() => {
  const root = document.documentElement;
  const storageKey = 'lsuperagent-color-mode';
  const allowed = new Set(['normal', 'docs']);

  function applyMode(mode) {
    const active = allowed.has(mode) ? mode : 'normal';
    root.dataset.theme = active;
    try { localStorage.setItem(storageKey, active); } catch {}
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const next = active === 'normal' ? 'docs' : 'normal';
      button.textContent = next === 'docs' ? 'DOCS MODE' : 'NORMAL MODE';
      button.setAttribute('aria-label', `Switch to ${next === 'docs' ? 'Docs purple' : 'normal blue-black'} color mode`);
      button.setAttribute('aria-pressed', String(active === 'docs'));
      button.title = `Current mode: ${active === 'docs' ? 'Docs' : 'Normal'}`;
    });
  }

  let saved = 'normal';
  try { saved = localStorage.getItem(storageKey) || 'normal'; } catch {}
  applyMode(saved);

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      applyMode(root.dataset.theme === 'docs' ? 'normal' : 'docs');
    });
  });
})();
