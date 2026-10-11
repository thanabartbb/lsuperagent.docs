// Presentation-only adapter for the existing Cloudflare ChatAgent UI.
// This file never calls AI APIs, sends messages or replaces React handlers.
(() => {
  'use strict';
  const ROOT_SELECTOR = '#root > div';
  const MODEL = 'Kimi K2.7 Code'; // Agent Starter backend's currently hard-coded model.
  let installed = false;
  let scheduled = false;

  function node(tag, attrs, text) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function matchRoot() {
    const app = document.querySelector(ROOT_SELECTOR);
    if (!app) return null;
    const header = app.querySelector(':scope > header');
    const form = [...app.querySelectorAll('form')].find(candidate => candidate.querySelector('textarea'));
    const viewport = app.querySelector(':scope > div.flex-1.overflow-y-auto');
    if (!header || !form || !viewport) return null;
    return { app, header, form, viewport };
  }

  function nativeClear() {
    const header = document.querySelector(ROOT_SELECTOR + ' > header');
    return [...(header?.querySelectorAll('button') || [])]
      .find(button => button.textContent.trim().toLowerCase() === 'clear');
  }

  function closePanels() {
    document.getElementById('sdkspace-agent-history')?.setAttribute('hidden', '');
    document.getElementById('sdkspace-agent-model-panel')?.setAttribute('hidden', '');
    document.getElementById('sdkspace-agent-menu-trigger')?.setAttribute('aria-expanded', 'false');
    document.getElementById('sdkspace-agent-current-model')?.setAttribute('aria-expanded', 'false');
  }

  function buildControls() {
    const controls = node('div', { id: 'sdkspace-agent-ui-extras' });
    const toggle = node('button', {
      id: 'sdkspace-agent-menu-trigger', type: 'button',
      'aria-label': 'เปิดประวัติแชท', 'aria-controls': 'sdkspace-agent-history',
      'aria-expanded': 'false'
    });
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/></svg>';
    const model = node('button', {
      id: 'sdkspace-agent-current-model', type: 'button', 'aria-expanded': 'false',
      'aria-controls': 'sdkspace-agent-model-panel',
      'aria-label': 'ดูโมเดลของ Agent ที่กำลังใช้งาน'
    }, MODEL + '  ▾');
    const modelPanel = node('div', {
      id: 'sdkspace-agent-model-panel', role: 'region',
      'aria-label': 'โมเดลของ Agent', hidden: ''
    });
    modelPanel.append(
      node('strong', {}, 'โมเดลที่ใช้งานจริง'),
      node('span', { class: 'sdkspace-model-active' }, MODEL + '  ✓'),
      node('p', {}, 'Agent Starter ปัจจุบันกำหนดโมเดลนี้ใน Backend การสลับไปโมเดลอื่นต้องรองรับที่ Agent ก่อน')
    );

    const history = node('div', {
      id: 'sdkspace-agent-history', role: 'dialog',
      'aria-modal': 'true', 'aria-label': 'แผงแชทและประวัติ', hidden: ''
    });
    const backdrop = node('button', {
      id: 'sdkspace-agent-history-backdrop', type: 'button', 'aria-label': 'ปิดแผง'
    });
    const side = node('aside', {});
    const title = node('h2', {}, 'SDKSPACE');
    const close = node('button', { type: 'button', 'aria-label': 'ปิดแผง' }, '✕  ปิดแผง');
    const home = node('a', { href: '/home' }, '⌂  หน้าแรก');
    const newChat = node('button', { type: 'button' }, '✎  แชทใหม่');
    const clear = node('button', { type: 'button' }, '▤  ลบข้อความในการสนทนานี้');
    const category = node('div', { class: 'sdkspace-history-label' }, 'ประวัติ');
    const current = node('p', { class: 'sdkspace-history-note' },
      'ข้อความในการสนทนาปัจจุบันเก็บอยู่กับ Cloudflare Agent เดิม และจะปรากฏอีกครั้งเมื่อกลับมาเปิดแชทนี้');
    const account = node('div', { class: 'sdkspace-account' }, 'บัญชีที่เข้าสู่ระบบ');
    side.append(title, close, home, newChat, clear, category, current, account);
    history.append(backdrop, side);
    controls.append(toggle, model, modelPanel, history);
    document.body.append(controls);

    toggle.addEventListener('click', () => {
      const open = history.hasAttribute('hidden');
      closePanels();
      if (open) {
        history.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
        close.focus();
      }
    });
    close.addEventListener('click', () => { closePanels(); toggle.focus(); });
    backdrop.addEventListener('click', () => { closePanels(); toggle.focus(); });
    model.addEventListener('click', () => {
      const open = modelPanel.hasAttribute('hidden');
      closePanels();
      if (open) {
        modelPanel.removeAttribute('hidden');
        model.setAttribute('aria-expanded', 'true');
      }
    });
    function clearCurrent(action) {
      const button = nativeClear();
      if (!button) {
        current.textContent = 'ระบบจัดการบทสนทนายังไม่พร้อม กรุณาลองใหม่อีกครั้ง';
        return;
      }
      const message = action === 'new'
        ? 'เริ่มแชทใหม่และล้างข้อความในการสนทนานี้หรือไม่?'
        : 'ลบข้อความทั้งหมดในการสนทนานี้หรือไม่? การกระทำนี้ย้อนกลับไม่ได้';
      if (!window.confirm(message)) return;
      button.click(); // Calls React's existing clearHistory, not a new transport.
      closePanels();
      toggle.focus();
    }
    newChat.addEventListener('click', () => clearCurrent('new'));
    clear.addEventListener('click', () => clearCurrent('delete'));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closePanels();
    });
    document.addEventListener('pointerdown', event => {
      if (!modelPanel.hasAttribute('hidden') && !modelPanel.contains(event.target) && event.target !== model) {
        modelPanel.setAttribute('hidden', '');
        model.setAttribute('aria-expanded', 'false');
      }
    });

    // Use SDKSPACE's existing signed session; never read auth cookies or keys.
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.authenticated) return;
        const user = data.user || {};
        account.textContent = user.name || user.email || user.login || 'บัญชีที่เข้าสู่ระบบ';
      })
      .catch(() => {});
  }

  function decorateEmpty(viewport) {
    const box = viewport.firstElementChild;
    if (!box) return;
    const candidates = box.querySelectorAll('h1,h2,h3,h4,p,span,div');
    const title = [...candidates].find(element => {
      const text = element.textContent?.trim();
      return (text === 'Start a conversation' || text === 'ฉันสามารถช่วยอะไรได้บ้าง?')
        && element.childElementCount === 0;
    });
    if (!title) {
      box.classList.remove('sdkspace-empty-view');
      return;
    }
    box.classList.add('sdkspace-empty-view');
    title.setAttribute('data-sdkspace-empty-heading', '');
    if (title.textContent !== 'ฉันสามารถช่วยอะไรได้บ้าง?') title.textContent = 'ฉันสามารถช่วยอะไรได้บ้าง?';
  }

  function decorate() {
    scheduled = false;
    const match = matchRoot();
    if (!match) return;
    if (!installed) {
      installed = true;
      document.documentElement.classList.add('sdkspace-agent-reference');
      buildControls();
    }
    // Never remove or rewrite React-managed children in the original header.
    const title = match.header.querySelector('h1');
    if (title) title.setAttribute('aria-label', 'SDKSPACE Agent Chat');
    decorateEmpty(match.viewport);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorate);
  }
  const observe = () => {
    const mount = document.getElementById('root');
    if (!mount) return;
    const observer = new MutationObserver(schedule);
    observer.observe(mount, { childList: true, subtree: true });
    schedule();
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})();
