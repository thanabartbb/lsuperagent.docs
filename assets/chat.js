// Chat UI from BASE-CLAUDE, adapted to the existing signed session.
(function () {
  const $ = (id) => document.getElementById(id);
  const chat = $('chat');
  const input = $('input');
  const send = $('send');
  const model = $('provider');
  const quota = $('quota');
  const mode = new URLSearchParams(location.search).get('mode') === 'code' ? 'code' : 'chat';
  const modeLabel = $('mode-label');
  if (modeLabel) modeLabel.textContent = mode === 'code' ? 'โหมดโค้ด' : 'แชท';
  if (mode === 'code') {
    $('empty').textContent = 'ส่งโจทย์หรือวางโค้ดเพื่อให้ AI ช่วยเขียน ตรวจ และอธิบาย';
    $('hint').textContent = 'AI ตอบเป็นโค้ดในแชท ยังไม่แก้ไฟล์ใน GitHub · ประวัติแชทยังไม่บันทึกถาวร · อย่าใส่รหัสผ่านหรือ API key';
  }
  const turns = [];
  const MAX_TURNS = 20;

  function bubble(kind, text, meta) {
    $('empty')?.remove();
    const node = document.createElement('div');
    node.className = 'bubble ' + kind;
    node.textContent = text;
    if (meta) {
      const label = document.createElement('span');
      label.className = 'meta';
      label.textContent = meta;
      node.append(label);
    }
    chat.append(node);
    chat.scrollTop = chat.scrollHeight;
    return node;
  }

  function toLogin() {
    location.replace('/login?return_to=%2Fchat');
  }

  $('signout').addEventListener('click', () => {
    location.assign('/auth/logout');
  });

  $('clear').addEventListener('click', () => {
    turns.length = 0;
    chat.innerHTML = '<div class="empty" id="empty">' + (mode === 'code' ? 'เริ่มโจทย์โค้ดใหม่ได้เลย' : 'เริ่มแชทใหม่ได้เลย') + '</div>';
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !matchMedia('(pointer: coarse)').matches) {
      event.preventDefault();
      $('composer').requestSubmit();
    }
  });

  $('composer').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;

    input.value = '';
    input.style.height = 'auto';
    bubble('u', text);
    turns.push({ role: 'user', content: text });
    while (turns.length > MAX_TURNS) turns.shift();
    if (turns[0]?.role !== 'user') turns.shift();

    send.disabled = true;
    const wait = bubble('a', 'กำลังคิด');
    wait.classList.add('thinking');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, messages: turns, mode, ...(mode === 'code' ? { tool: 'code' } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      wait.remove();
      if (!response.ok || !result.ok) {
        turns.pop();
        if (response.status === 401) return toLogin();
        bubble('e', result.message || 'ส่งข้อความไม่สำเร็จ (' + response.status + ')');
        return;
      }
      const answer = result.output || result.message;
      turns.push({ role: 'assistant', content: answer });
      bubble('a', answer, result.model || 'AI');
      const remaining = response.headers.get('x-lsuperagen-rate-remaining');
      const limit = response.headers.get('x-lsuperagen-rate-limit');
      if (remaining !== null && limit) quota.textContent = 'เหลือในรอบนี้ ' + remaining + '/' + limit;
    } catch (_) {
      wait.remove();
      turns.pop();
      bubble('e', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  (async () => {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const session = await response.json();
      if (!session.authenticated) return toLogin();
      $('who').textContent = session.user?.name || session.user?.email || 'Signed in';
      model.innerHTML = '<option>OpenAI</option>';
      input.disabled = false;
      send.disabled = false;
    } catch (_) {
      bubble('e', 'ตรวจสอบการเข้าสู่ระบบไม่ได้ ลองรีเฟรชหน้า');
    }
  })();
})();
