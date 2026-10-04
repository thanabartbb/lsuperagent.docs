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
    $('hint').textContent = 'AI เสนอสร้าง repo หรือ commit ไป GitHub ได้ ต้องเชื่อมบัญชีที่หน้าเครื่องมือและกดยืนยันทุกครั้ง · อย่าใส่รหัสผ่านหรือ API key';
  }
  const turns = [];
  const MAX_TURNS = 20;
  const historyPanel = $('history');
  const historyToggle = $('history-toggle');
  let conversationId = new URLSearchParams(location.search).get('c');
  let historyAvailable = false;

  function setConversation(id) {
    conversationId = id || null;
    const params = new URLSearchParams(location.search);
    if (conversationId) params.set('c', conversationId); else params.delete('c');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : ''));
    historyPanel.querySelectorAll('.history-row').forEach((row) => row.classList.toggle('current', row.dataset.id === conversationId));
  }

  function resetChat(message) {
    turns.length = 0;
    chat.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.id = 'empty';
    empty.textContent = message;
    chat.append(empty);
  }

  async function loadHistoryList() {
    const response = await fetch('/api/chats', { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    historyPanel.innerHTML = '';
    if (!response.ok || !result.ok) {
      const note = document.createElement('p');
      note.className = 'history-empty';
      note.textContent = result.message || 'โหลดประวัติแชตไม่สำเร็จ';
      historyPanel.append(note);
      return;
    }
    if (!result.conversations.length) {
      const note = document.createElement('p');
      note.className = 'history-empty';
      note.textContent = 'ยังไม่มีประวัติแชต';
      historyPanel.append(note);
      return;
    }
    for (const item of result.conversations) {
      const row = document.createElement('div');
      row.className = 'history-row' + (item.id === conversationId ? ' current' : '');
      row.dataset.id = item.id;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'history-open';
      open.textContent = item.title;
      const when = document.createElement('small');
      when.textContent = new Date(item.updated_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
      open.append(when);
      open.addEventListener('click', () => openConversation(item.id));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'history-del';
      del.textContent = 'ลบ';
      del.setAttribute('aria-label', 'ลบแชต ' + item.title);
      del.addEventListener('click', () => removeConversation(item.id, item.title));
      row.append(open, del);
      historyPanel.append(row);
    }
  }

  async function openConversation(id) {
    const response = await fetch('/api/chats/' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      if (response.status === 401) return toLogin();
      setConversation(null);
      bubble('e', result.message || 'เปิดแชตนี้ไม่ได้');
      return;
    }
    resetChat('แชตนี้ยังไม่มีข้อความ');
    for (const item of result.conversation.messages) bubble(item.role === 'user' ? 'u' : 'a', item.content);
    turns.push(...result.conversation.messages.slice(-MAX_TURNS));
    if (turns[0]?.role !== 'user') turns.shift();
    setConversation(id);
  }

  async function removeConversation(id, title) {
    if (!confirm('ลบแชต "' + title + '" ถาวร?')) return;
    const response = await fetch('/api/chats/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' });
    if (!response.ok) {
      bubble('e', 'ลบแชตไม่สำเร็จ ลองใหม่อีกครั้ง');
      return;
    }
    if (id === conversationId) {
      setConversation(null);
      resetChat('ลบแชตแล้ว เริ่มแชทใหม่ได้เลย');
    }
    await loadHistoryList();
  }

  historyToggle.addEventListener('click', async () => {
    const opening = historyPanel.hidden;
    historyPanel.hidden = !opening;
    historyToggle.setAttribute('aria-expanded', String(opening));
    if (opening) await loadHistoryList();
  });

  // Attachments: images are shrunk in the browser before upload; PDFs are sent as-is.
  const MAX_FILES = 4;
  const MAX_IMAGE_SIDE = 1600;
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const pending = [];
  let preparing = 0;
  let sending = false;
  const pendingBox = $('pending');
  const attachButton = $('attach');
  const fileInput = $('file');

  const readDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  function drawJpeg(bitmap, maxSide, quality) {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  // Returns the upload data plus a small thumbnail for the page, so full-size data is not kept in the DOM.
  // GIFs are always flattened to one frame: vision models reject animated GIFs.
  async function prepareImage(file, type) {
    const bitmap = await createImageBitmap(file);
    try {
      const small = Math.max(bitmap.width, bitmap.height) <= MAX_IMAGE_SIDE && file.size <= 1024 * 1024;
      const data = small && type !== 'image/gif' ? await readDataUrl(new Blob([file], { type })) : drawJpeg(bitmap, MAX_IMAGE_SIDE, 0.85);
      return { data, thumb: drawJpeg(bitmap, 320, 0.8) };
    } finally {
      bitmap.close();
    }
  }

  // Some browsers/OSes leave File.type empty; fall back to the extension.
  const EXTENSION_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
  function fileType(file) {
    if (file.type) return file.type;
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1];
    return ext ? EXTENSION_TYPES[ext.toLowerCase()] || '' : '';
  }

  function renderPending() {
    pendingBox.innerHTML = '';
    pendingBox.hidden = !pending.length;
    pending.forEach((item, index) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      if (item.kind === 'image') {
        const img = document.createElement('img');
        img.src = item.thumb;
        img.alt = '';
        chip.append(img);
      } else {
        const icon = document.createElement('div');
        icon.className = 'pdf';
        icon.textContent = 'PDF';
        chip.append(icon);
      }
      const name = document.createElement('span');
      name.textContent = item.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'เอา ' + item.name + ' ออก');
      remove.disabled = sending;
      remove.addEventListener('click', () => { if (!sending) { pending.splice(index, 1); renderPending(); } });
      chip.append(name, remove);
      pendingBox.append(chip);
    });
  }

  function syncControls() {
    send.disabled = sending || preparing > 0 || input.disabled;
    attachButton.disabled = sending || input.disabled;
  }

  // Batches are prepared one after another, so the 4-file limit is checked against settled results.
  let intake = Promise.resolve();
  function addFiles(files) {
    if (sending) return intake;
    preparing += 1;
    syncControls();
    intake = intake.then(() => addFilesNow(files)).catch(() => {}).finally(() => {
      preparing -= 1;
      syncControls();
    });
    return intake;
  }

  async function addFilesNow(files) {
    for (const file of files) {
      if (pending.length >= MAX_FILES) { bubble('e', 'แนบได้สูงสุด ' + MAX_FILES + ' ไฟล์ต่อข้อความ'); break; }
      const type = fileType(file);
      try {
        if (IMAGE_TYPES.includes(type)) {
          pending.push({ kind: 'image', name: file.name || 'image', ...(await prepareImage(file, type)) });
        } else if (type === 'application/pdf') {
          if (file.size > MAX_PDF_BYTES) { bubble('e', file.name + ': ไฟล์ PDF ต้องไม่เกิน 10 MB'); continue; }
          pending.push({ kind: 'pdf', name: file.name || 'document.pdf', data: await readDataUrl(new Blob([file], { type })) });
        } else {
          bubble('e', (file.name || 'ไฟล์') + ': รองรับเฉพาะรูปภาพ (PNG, JPEG, WebP, GIF) และ PDF');
        }
      } catch (_) {
        bubble('e', (file.name || 'ไฟล์') + ': อ่านไฟล์ไม่ได้');
      }
    }
    renderPending();
  }

  attachButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    await addFiles(Array.from(fileInput.files || []));
    fileInput.value = '';
  });
  input.addEventListener('paste', (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length || attachButton.disabled) return;
    event.preventDefault();
    addFiles(files);
  });
  // File drags are always cancelled (anywhere on the page) so a drop never opens the file and loses the chat.
  const isFileDrag = (event) => Boolean(event.dataTransfer?.types.includes('Files'));
  window.addEventListener('dragover', (event) => { if (isFileDrag(event)) event.preventDefault(); });
  window.addEventListener('drop', (event) => { if (isFileDrag(event)) event.preventDefault(); });
  chat.addEventListener('dragover', (event) => {
    if (isFileDrag(event) && !attachButton.disabled) chat.classList.add('dragging');
  });
  chat.addEventListener('dragleave', () => chat.classList.remove('dragging'));
  chat.addEventListener('drop', (event) => {
    chat.classList.remove('dragging');
    if (attachButton.disabled || !event.dataTransfer?.files.length) return;
    addFiles(Array.from(event.dataTransfer.files));
  });

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

  function githubProposalCard(proposal) {
    const node = bubble('a', '');
    node.classList.add('github-tool-proposal');
    const title = document.createElement('strong');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const preview = document.createElement('pre');
    const approve = document.createElement('button');
    const result = document.createElement('p');
    const args = proposal.arguments || {};
    const creating = proposal.name === 'create_repository';
    title.textContent = creating ? `ขออนุมัติสร้าง repo ${args.name || ''}` : `ขออนุมัติ commit ${args.owner || ''}/${args.repo || ''}`;
    summary.textContent = creating ? (args.description || 'repo ส่วนตัว') : `${args.message || 'Commit'} · ${(args.files || []).length} ไฟล์ · branch ${args.branch || 'main'}`;
    preview.textContent = creating ? JSON.stringify(args, null, 2) : (args.files || []).map((file) => `--- ${file.path} ---\n${file.content}`).join('\n\n');
    approve.type = 'button';
    approve.textContent = 'อนุมัติและดำเนินการ';
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      result.textContent = 'กำลังส่งคำสั่งไป GitHub…';
      try {
        const response = await fetch('/api/github/actions', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: proposal.name, ...args }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || data.message || `GitHub error (${response.status})`);
        result.textContent = proposal.name === 'create_repository' ? `สร้าง ${data.repository.full_name} แล้ว` : `Commit ${data.commit?.sha || 'สำเร็จ'} แล้ว`;
        if (turns[turns.length - 1]?.role === 'assistant') turns[turns.length - 1].content = result.textContent;
        if (data.repository?.html_url && data.repository.html_url.startsWith('https://github.com/')) {
          const link = document.createElement('a'); link.href = data.repository.html_url; link.textContent = 'เปิด repo'; link.target = '_blank'; link.rel = 'noopener'; result.append(' · ', link);
        }
      } catch (error) {
        result.textContent = `ทำรายการไม่สำเร็จ: ${error.message}`;
        approve.disabled = false;
      }
    });
    details.append(summary, preview);
    node.append(title, details, approve, result);
    return node;
  }

  // AI provider picker: lists only providers the server has a key for; remembers the choice per browser.
  const PROVIDER_KEY = 'lsuperagent-chat-provider';
  async function loadProviders() {
    let providers = [{ id: 'openai', label: 'OpenAI', available: true }];
    try {
      const response = await fetch('/api/chat-providers', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (response.ok && Array.isArray(result.providers)) providers = result.providers.filter((item) => item.available);
    } catch (_) { /* keep the OpenAI default */ }
    if (!providers.length) providers = [{ id: 'openai', label: 'OpenAI' }];
    model.innerHTML = '';
    for (const item of providers) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      model.append(option);
    }
    let saved = null;
    try { saved = localStorage.getItem(PROVIDER_KEY); } catch (_) { /* storage may be blocked */ }
    if (saved && providers.some((item) => item.id === saved)) model.value = saved;
    model.disabled = providers.length < 2;
  }
  model.addEventListener('change', () => {
    try { localStorage.setItem(PROVIDER_KEY, model.value); } catch (_) { /* storage may be blocked */ }
  });

  function toLogin() {
    location.replace('/login?return_to=%2Fchat');
  }

  $('signout').addEventListener('click', () => {
    location.assign('/auth/logout');
  });

  $('clear').addEventListener('click', () => {
    setConversation(null);
    resetChat(mode === 'code' ? 'เริ่มโจทย์โค้ดใหม่ได้เลย' : 'เริ่มแชทใหม่ได้เลย');
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
    if (send.disabled || preparing > 0) return;
    const files = pending.splice(0);
    const typed = input.value.trim();
    const text = typed || (files.length ? 'ช่วยดูไฟล์ที่แนบมา' : '');
    if (!text) {
      pending.push(...files);
      return;
    }

    input.value = '';
    input.style.height = 'auto';
    renderPending();
    const userNode = bubble('u', text);
    if (files.length) {
      const strip = document.createElement('div');
      strip.className = 'files';
      for (const item of files) {
        if (item.kind === 'image') {
          const img = document.createElement('img');
          img.src = item.thumb;
          img.alt = item.name;
          strip.append(img);
        } else {
          const label = document.createElement('span');
          label.className = 'file-name';
          label.textContent = '📎 ' + item.name;
          strip.append(label);
        }
      }
      userNode.prepend(strip);
    }
    // On failure, put the typed prompt and the attachments back so a retry sends the same request.
    // Attaching is locked while this request runs, so the failed set comes back whole.
    const restoreFiles = () => {
      if (typed && !input.value.trim()) input.value = typed;
      if (!files.length) return;
      pending.unshift(...files);
      renderPending();
    };
    const userTurn = { role: 'user', content: text };
    turns.push(userTurn);
    while (turns.length > MAX_TURNS) turns.shift();
    if (turns[0]?.role !== 'user') turns.shift();

    sending = true;
    const providerLabel = (model.selectedOptions[0] && model.selectedOptions[0].textContent) || 'AI';
    syncControls();
    renderPending();
    const wait = bubble('a', 'กำลังคิด');
    wait.classList.add('thinking');
    let answerNode = null;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, messages: turns, mode, stream: mode !== 'code', ...(conversationId ? { conversation_id: conversationId } : {}), ...(files.length ? { attachments: files.map(({ name, data }) => ({ name, data })) } : {}), ...(mode === 'code' ? { tool: 'code' } : {}), provider: model.value || 'openai' }),
      });
      // Prefer the daily account quota; fall back to the short burst guard when no quota applies (e.g. owner).
      const dailyLeft = response.headers.get('x-lsuperagen-quota-remaining');
      const dailyLimit = response.headers.get('x-lsuperagen-quota-limit');
      const remaining = response.headers.get('x-lsuperagen-rate-remaining');
      const limit = response.headers.get('x-lsuperagen-rate-limit');
      if (dailyLeft !== null && dailyLimit) quota.textContent = 'วันนี้เหลือ ' + dailyLeft + '/' + dailyLimit + ' ข้อความ';
      else if (remaining !== null && limit) quota.textContent = 'เหลือในรอบนี้ ' + remaining + '/' + limit;
      if (mode === 'code' && (response.headers.get('content-type') || '').includes('application/json')) {
        const result = await response.json().catch(() => ({}));
        wait.remove();
        if (!response.ok || !result.ok) {
          turns.pop(); restoreFiles();
          if (response.status === 401) return toLogin();
          bubble('e', result.message || result.error || 'ส่งข้อความไม่สำเร็จ (' + response.status + ')');
          return;
        }
        if (result.tool_proposal) {
          const prompt = result.tool_proposal.name === 'create_repository' ? 'ตรวจรายละเอียด repo แล้วกดยืนยันเพื่อสร้าง' : 'ตรวจ path และเนื้อหาไฟล์ในรายละเอียด แล้วกดยืนยันเพื่อ commit';
          turns.push({ role: 'assistant', content: prompt });
          githubProposalCard(result.tool_proposal);
        } else {
          const answer = result.output || result.message || '';
          turns.push({ role: 'assistant', content: answer });
          bubble('a', answer, providerLabel);
        }
        if (result.conversation_id) { setConversation(result.conversation_id); if (!historyPanel.hidden) loadHistoryList(); }
        return;
      }
      if (!response.ok || !(response.headers.get('content-type') || '').includes('ndjson')) {
        const result = await response.json().catch(() => ({}));
        wait.remove();
        turns.pop();
        restoreFiles();
        if (response.status === 401) return toLogin();
        bubble('e', result.message || 'ส่งข้อความไม่สำเร็จ (' + response.status + ')');
        return;
      }

      // Stream: render each delta as it arrives; only a "done" event commits the turn.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamed = '';
      let final = null;
      const onEvent = (event) => {
        if (event.type === 'delta' && typeof event.text === 'string') {
          if (!answerNode) {
            wait.remove();
            answerNode = bubble('a', '');
          }
          streamed += event.text;
          answerNode.textContent = streamed;
          chat.scrollTop = chat.scrollHeight;
        } else if (event.type === 'done' || event.type === 'error') {
          final = event;
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, cut).trim();
          buffer = buffer.slice(cut + 1);
          if (!line) continue;
          try { onEvent(JSON.parse(line)); } catch (_) { /* ignore a malformed line */ }
        }
      }
      wait.remove();
      if (!final || !final.ok) {
        turns.pop();
        restoreFiles();
        if (answerNode) answerNode.classList.add('e');
        bubble('e', (final && final.message) || 'การเชื่อมต่อขาดกลางคัน ลองใหม่อีกครั้ง');
        return;
      }
      const answer = final.output || streamed;
      // Later turns only carry the file names, matching what chat history stores.
      if (files.length) {
        const noted = text + '\n\n📎 ' + files.map((item) => item.name).join(', ');
        if (noted.length <= 12000) userTurn.content = noted;
      }
      turns.push({ role: 'assistant', content: answer });
      if (final.conversation_id) {
        setConversation(final.conversation_id);
        if (!historyPanel.hidden) loadHistoryList();
      }
      if (!answerNode) answerNode = bubble('a', '');
      answerNode.textContent = answer;
      const label = document.createElement('span');
      label.className = 'meta';
      label.textContent = final.truncated ? providerLabel + ' · คำตอบยาวเกินกำหนด ระบบตัดไว้ พิมพ์ "ต่อ" เพื่อให้ตอบส่วนที่เหลือ' : providerLabel;
      answerNode.append(label);
      chat.scrollTop = chat.scrollHeight;
    } catch (_) {
      wait.remove();
      if (answerNode) answerNode.classList.add('e');
      turns.pop();
      restoreFiles();
      bubble('e', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      sending = false;
      syncControls();
      renderPending();
      input.focus();
    }
  });

  (async () => {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const session = await response.json();
      if (!session.authenticated) return toLogin();
      $('who').textContent = session.user?.name || session.user?.email || 'Signed in';
      await loadProviders();
      input.disabled = false;
      syncControls();
      const probe = await fetch('/api/chats', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
      historyAvailable = Boolean(probe && probe.ok);
      historyToggle.hidden = !historyAvailable;
      if (historyAvailable) $('hint').textContent = mode === 'code'
        ? 'แชตบันทึกในบัญชี · เชื่อม GitHub ที่หน้าเครื่องมือ และกดยืนยันทุกครั้งก่อนสร้าง repo หรือ commit · อย่าใส่รหัสผ่านหรือ API key'
        : 'แชตจะถูกบันทึกในบัญชีของคุณ ลบได้จากปุ่ม "ประวัติ" · อย่าใส่รหัสผ่านหรือ API key';
      if (historyAvailable && conversationId) await openConversation(conversationId);
      else if (conversationId) setConversation(null);
    } catch (_) {
      bubble('e', 'ตรวจสอบการเข้าสู่ระบบไม่ได้ ลองรีเฟรชหน้า');
    }
  })();
})();
