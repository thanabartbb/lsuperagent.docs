/* Presentation only. Requests, providers and session rules stay with existing runtimes. */
(() => {
  const main = document.querySelector('main');
  if (main && !document.querySelector('.lp-skip, .sdk-skip')) {
    if (!main.id) main.id = 'main-content';
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'sdk-skip';
    skip.href = '#' + main.id;
    skip.textContent = 'ข้ามไปเนื้อหา';
    document.body.prepend(skip);
  }

  // Code examples and wide tables stay scrollable and reachable with a keyboard.
  function enableScrollAccess(root) {
    root.querySelectorAll('pre, .table-wrap').forEach(el => {
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.title || (el.matches('pre') ? 'โค้ดตัวอย่าง' : 'ตารางข้อมูล'));
    });
  }
  enableScrollAccess(document);
  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length)) enableScrollAccess(document);
  }).observe(document.body, { childList: true, subtree: true });

  document.querySelectorAll('[role="tablist"]').forEach(list => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    if (!tabs.length) return;
    const sync = () => {
      const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0];
      tabs.forEach(tab => { tab.tabIndex = tab === active ? 0 : -1; });
    };
    sync();
    new MutationObserver(sync).observe(list, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    list.addEventListener('keydown', event => {
      const current = tabs.indexOf(event.target);
      if (current < 0) return;
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
      else return;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    });
  });

  document.querySelectorAll('.sdk-auth input[type="password"]').forEach((input, index) => {
    const field = input.closest('.field');
    if (!field) return;
    if (!input.id) input.id = 'account-password-' + index;
    field.classList.add('has-password-toggle');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-controls', input.id);
    toggle.setAttribute('aria-pressed', 'false');
    const label = field.querySelector('.field-label')?.textContent || 'รหัสผ่าน';
    const update = () => {
      const visible = input.type === 'text';
      toggle.textContent = visible ? 'ซ่อน' : 'แสดง';
      toggle.setAttribute('aria-label', (visible ? 'ซ่อน' : 'แสดง') + label);
      toggle.setAttribute('aria-pressed', String(visible));
    };
    toggle.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; update(); });
    update();
    field.append(toggle);
  });

  // The email runtime already signals aria-busy. Make that state visible and prevent repeats.
  document.querySelectorAll('[data-email-login], [data-email-register], [data-email-reset]').forEach(form => {
    const button = form.querySelector('button[type="submit"], [data-password-reset]');
    if (!button) return;
    new MutationObserver(() => { button.disabled = button.getAttribute('aria-busy') === 'true'; })
      .observe(button, { attributes: true, attributeFilter: ['aria-busy'] });
    form.addEventListener('submit', event => {
      if (button.getAttribute('aria-busy') === 'true') { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    if (button.matches('[data-password-reset]')) button.addEventListener('click', event => {
      if (!form.reportValidity() || button.getAttribute('aria-busy') === 'true') {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
  });

  const menu = document.querySelector('.lp-mobile-menu');
  if (menu) {
    const summary = menu.querySelector('summary');
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); }
    });
    document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  }
})();
