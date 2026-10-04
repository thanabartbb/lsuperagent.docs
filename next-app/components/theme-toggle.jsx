'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mode, setMode] = useState('normal');
  useEffect(() => {
    let saved = 'normal';
    try { saved = localStorage.getItem('lsuperagent-color-mode'); } catch {}
    const next = saved === 'docs' ? 'docs' : 'normal';
    setMode(next);
    document.documentElement.dataset.theme = next;
  }, []);
  function toggle() {
    const next = mode === 'normal' ? 'docs' : 'normal';
    setMode(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('lsuperagent-color-mode', next); } catch {}
  }
  return <button className="theme-toggle" type="button" data-theme-toggle="" onClick={toggle}
    aria-pressed={mode === 'docs'} title={`Current mode: ${mode === 'docs' ? 'Docs' : 'Normal'}`}
    aria-label={`Switch to ${mode === 'docs' ? 'normal blue-black' : 'Docs purple'} color mode`}>
    {mode === 'docs' ? 'NORMAL MODE' : 'DOCS MODE'}
  </button>;
}
