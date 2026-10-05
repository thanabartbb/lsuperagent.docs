// Chat UI from BASE-CLAUDE, adapted to the existing signed session.
(function () {
  const $ = (id) => document.getElementById(id);
  const chat = $('chat');
  const input = $('input');
  const send = $('send');
  const model = $('provider');
  const modelChoice = $('model-choice');
  const toolChoice = $('tool-choice');
  const toolsMenu = $('chat-tools-menu');
  const attachFileButton = $('choose-file');
  const toolDescription = $('tool-description');
  const quota = $('quota');
  const supportedModes = ['chat', 'code', 'research', 'url', 'writer', 'image'];
  const requestedMode = new URLSearchParams(location.search).get('mode');
  let mode = requestedMode === 'write' ? 'writer' : supportedModes.includes(requestedMode) ? requestedMode : 'chat';
  const modeLabel = $('mode-label');
  const MODE_LABELS = { chat: 'แชต', code: 'เขียนโค้ด', research: 'ค้นคว้า', url: 'อ่าน URL', writer: 'เขียนเนื้อหา', image: 'สร้างภาพ' };
  const MODE_HINTS = {
    chat: 'แชตจะถูกบันทึกในบัญชีของคุณ ลบได้จากปุ่ม “ประวัติ” · อย่าใส่รหัสผ่านหรือ API key',
    code: 'AI ช่วยเขียนและตรวจโค้ด; การสร้าง repo หรือ commit ต้องเชื่อม GitHub และกดยืนยันก่อนทุกครั้ง',
    research: 'ค้นคว้าจากเว็บพร้อมแหล่งอ้างอิง · ใช้ได้กับ OpenAI',
    url: 'วาง URL ที่ต้องการให้อ่านและถามต่อ · ใช้ได้กับ OpenAI',
    writer: 'ร่างหรือปรับเนื้อหาให้ตรงเป้าหมาย แล้วคัดลอกคำตอบไปใช้',
    image: 'อธิบายภาพที่ต้องการสร้าง · ใช้โมเดลสร้างภาพของ OpenAI'
  };
  let availableProviders = [];
  let modelsByProvider = {};
  let availableImageModels = [];
  let availableWebModels = [];
  function updateModeUI() {
    if (toolChoice) toolChoice.value = mode;
    if (modeLabel) modeLabel.textContent = MODE_LABELS[mode] || MODE_LABELS.chat;
    const hint = $('hint');
    if (hint) hint.textContent = MODE_HINTS[mode] || MODE_HINTS.chat;
    if (toolDescription) toolDescription.textContent = MODE_HINTS[mode] || MODE_HINTS.chat;
    const empty = $('empty');
    const emptyText = { chat: 'ลองถามอะไรก็ได้เกี่ยวกับ AI SDK', code: 'ส่งโจทย์หรือวางโค้ดเพื่อให้ AI ช่วยเขียน ตรวจ และอธิบาย', research: 'ถามเรื่องที่ต้องการค้นคว้า พร้อมดูแหล่งอ้างอิง', url: 'วาง URL แล้วถามสิ่งที่ต้องการทราบ', writer: 'บอกเนื้อหาที่ต้องการร่างหรือปรับ', image: 'อธิบายภาพที่ต้องการสร้าง' };
    if (empty) empty.textContent = emptyText[mode] || emptyText.chat;
    if (attachFileButton) attachFileButton.disabled = mode === 'image';
  }
  const turns = [];
  const MAX_TURNS = 20;
  updateModeUI();
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
  const closeToolsButton = $('close-tools-menu');
  const openToolsMenu = (open) => {
    toolsMenu.hidden = !open;
    attachButton.setAttribute('aria-expanded', String(open));
    if (open) toolChoice.focus();
  };
  attachButton.addEventListener('click', () => openToolsMenu(toolsMenu.hidden));
  closeToolsButton.addEventListener('click', () => { openToolsMenu(false); attachButton.focus(); });
  attachFileButton.addEventListener('click', () => {
    if (mode === 'image') return;
    openToolsMenu(false);
    fileInput.click();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!toolsMenu.hidden && !toolsMenu.contains(event.target) && !attachButton.contains(event.target)) openToolsMenu(false);
  });
  toolsMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { openToolsMenu(false); attachButton.focus(); }
  });
  toolChoice.addEventListener('change', () => {
    const nextMode = toolChoice.value;
    if (!supportedModes.includes(nextMode)) { toolChoice.value = mode; return; }
    if (nextMode === 'image' && pending.length) {
      bubble('e', 'นำไฟล์แนบออกก่อน แล้วจึงเลือกสร้างภาพ');
      toolChoice.value = mode;
      return;
    }
    mode = nextMode;
    updateModeUI();
    if (availableProviders.length) syncProviderOptions(model.value);
  });

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
    if (attachFileButton) attachFileButton.disabled = sending || input.disabled || mode === 'image';
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

  // Provider and model choices come from the Worker, so the menu only offers configured providers.
  const PROVIDER_KEY = 'lsuperagent-chat-provider';
  const MODEL_KEY = 'lsuperagent-chat-model';
  function syncModelOptions() {
    const models = mode === 'image' ? availableImageModels : ['research', 'url'].includes(mode) ? availableWebModels : (modelsByProvider[model.value] || []);
    const savedKey = MODEL_KEY + ':' + (mode === 'image' ? 'image' : model.value);
    let saved = '';
    try { saved = localStorage.getItem(savedKey) || ''; } catch (_) { /* storage may be blocked */ }
    modelChoice.replaceChildren();
    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = 'อัตโนมัติ · เลือกสำรองให้';
    modelChoice.append(auto);
    for (const id of models) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = id;
      modelChoice.append(option);
    }
    modelChoice.value = models.includes(saved) ? saved : '';
    modelChoice.disabled = false;
  }

  function syncProviderOptions(preferred = '') {
    const openAIOnly = ['research', 'url', 'image'].includes(mode);
    const providers = availableProviders.filter((item) => item.available && (!openAIOnly || item.id === 'openai'));
    model.replaceChildren();
    for (const item of providers) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      model.append(option);
    }
    if (!providers.length) {
      const option = document.createElement('option');
      option.value = 'openai';
      option.textContent = 'OpenAI';
      model.append(option);
    }
    model.value = providers.some((item) => item.id === preferred) ? preferred : providers[0]?.id || 'openai';
    model.disabled = providers.length < 2;
    syncModelOptions();
  }

  async function loadProviders() {
    let result = {};
    try {
      const response = await fetch('/api/chat-providers', { credentials: 'same-origin', cache: 'no-store' });
      result = await response.json();
      if (!response.ok) result = {};
    } catch (_) { /* use the public defaults; API will return a clear unavailable response */ }
    availableProviders = Array.isArray(result.providers) ? result.providers : [{ id: 'openai', label: 'OpenAI', available: true }];
    modelsByProvider = result.models && typeof result.models === 'object' ? result.models : {};
    availableImageModels = Array.isArray(result.image_models) ? result.image_models : [];
    availableWebModels = Array.isArray(result.web_search_models) ? result.web_search_models : [];
    let savedProvider = '';
    try { savedProvider = localStorage.getItem(PROVIDER_KEY) || ''; } catch (_) { /* storage may be blocked */ }
    syncProviderOptions(savedProvider);
  }

  model.addEventListener('change', () => {
    try { localStorage.setItem(PROVIDER_KEY, model.value); } catch (_) { /* storage may be blocked */ }
    syncModelOptions();
  });
  modelChoice.addEventListener('change', () => {
    const key = MODEL_KEY + ':' + (mode === 'image' ? 'image' : model.value);
    try { if (modelChoice.value) localStorage.setItem(key, modelChoice.value); else localStorage.removeItem(key); } catch (_) { /* storage may be blocked */ }
  });

  function toLogin() {
    location.replace('/login?return_to=%2Fchat');
  }

  $('signout').addEventListener('click', () => {
    location.assign('/auth/logout');
  });

  $('clear').addEventListener('click', () => {
    setConversation(null);
    resetChat(mode === 'code' ? 'เริ่มโจทย์โค้ดใหม่ได้เลย' : mode === 'image' ? 'อธิบายภาพที่ต้องการสร้างได้เลย' : 'เริ่มแชทใหม่ได้เลย');
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
    if (mode === 'image' && pending.length) {
      bubble('e', 'โหมดสร้างภาพรับคำสั่งข้อความก่อน กรุณานำไฟล์แนบออก');
      return;
    }
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
    const providerLabel = ((model.selectedOptions[0] && model.selectedOptions[0].textContent) || 'AI') + (modelChoice.value ? ' · ' + modelChoice.value : '');
    syncControls();
    renderPending();
    const wait = bubble('a', 'กำลังคิด');
    wait.classList.add('thinking');
    let answerNode = null;
    try {
      const response = await fetch(mode === 'image' ? '/api/image' : '/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'image'
          ? { prompt: text, ...(modelChoice.value ? { model: modelChoice.value } : {}) }
          : { message: text, messages: turns, mode, stream: !['code', 'research', 'url'].includes(mode), ...(conversationId ? { conversation_id: conversationId } : {}), ...(files.length ? { attachments: files.map(({ name, data }) => ({ name, data })) } : {}), ...(mode === 'chat' ? {} : { tool: mode }), provider: model.value || 'openai', ...(modelChoice.value ? { model: modelChoice.value } : {}) }),
      });
      // Prefer the daily account quota; fall back to the short burst guard when no quota applies (e.g. owner).
      const dailyLeft = response.headers.get('x-lsuperagen-quota-remaining');
      const dailyLimit = response.headers.get('x-lsuperagen-quota-limit');
      const remaining = response.headers.get('x-lsuperagen-rate-remaining');
      const limit = response.headers.get('x-lsuperagen-rate-limit');
      if (dailyLeft !== null && dailyLimit) quota.textContent = 'วันนี้เหลือ ' + dailyLeft + '/' + dailyLimit + ' ข้อความ';
      else if (remaining !== null && limit) quota.textContent = 'เหลือในรอบนี้ ' + remaining + '/' + limit;
      if (mode === 'image') {
        const result = await response.json().catch(() => ({}));
        wait.remove();
        if (!response.ok || !result.ok || !result.image?.data_base64) {
          turns.pop();
          restoreFiles();
          if (response.status === 401) return toLogin();
          bubble('e', result.message || 'สร้างภาพไม่สำเร็จ (' + response.status + ')');
          return;
        }
        turns.pop();
        const output = document.createElement('div');
        output.className = 'bubble a image-result';
        const image = document.createElement('img');
        image.src = 'data:' + (result.image.mime_type || 'image/png') + ';base64,' + result.image.data_base64;
        image.alt = text;
        const download = document.createElement('a');
        download.href = image.src;
        download.download = result.image.filename || 'sdkspace-image.png';
        download.textContent = 'ดาวน์โหลดภาพ';
        output.append(image, download);
        chat.append(output);
        chat.scrollTop = chat.scrollHeight;
        return;
      }
      if (['code', 'research', 'url'].includes(mode) && (response.headers.get('content-type') || '').includes('application/json')) {
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
          const answerNode = bubble('a', answer, providerLabel);
          for (const source of Array.isArray(result.sources) ? result.sources : []) {
            if (!source || typeof source.url !== 'string' || !/^https?:\/\//i.test(source.url)) continue;
            const link = document.createElement('a');
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = source.title || source.url;
            answerNode.append(document.createElement('br'), link);
          }
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
      if (historyAvailable && mode === 'chat') $('hint').textContent = 'กำลังพัฒนา ระบบ LLM';
      if (historyAvailable && conversationId) await openConversation(conversationId);
      else if (conversationId) setConversation(null);
    } catch (_) {
      bubble('e', 'ตรวจสอบการเข้าสู่ระบบไม่ได้ ลองรีเฟรชหน้า');
    }
  })();
})();
