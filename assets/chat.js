/* Request: message:string (user, 1..4000), mode:enum (user selection), provider:'openai' (route contract).
   Reply: message/output:string (API only). UI status: idle/pending/error (request lifecycle).
   No provider/secret readiness is inferred from static markup. */
(() => {
  const $ = id => document.getElementById(id);
  const prompt = $('prompt'), send = $('send'), log = $('log');
  let pending = null;
  function resize() { prompt.style.height = 'auto'; prompt.style.height = Math.min(prompt.scrollHeight,160)+'px'; send.disabled = !!pending || !prompt.value.trim(); }
  function feedback(text, error = false) { $('feedback').textContent = text; $('feedback').hidden = !text; $('feedback').dataset.error = String(error); }
  function add(role, text) {
    $('empty').hidden = true;
    const message = document.createElement('p');
    message.className = 'message ' + role;
    message.setAttribute('aria-label', role === 'user' ? 'คุณ' : 'ผู้ช่วย');
    message.textContent = text;
    log.append(message);
    $('conversation').scrollTop = $('conversation').scrollHeight;
  }
  function busy(value) { $('stop').hidden = !value; $('send').hidden = value; $('clear').disabled = value; $('mode').disabled = value; resize(); }
  for (const [trigger, target] of [['open-menu','menu'],['open-settings','settings']]) {
    $(trigger).addEventListener('click', () => $(target).showModal());
    $(target).querySelector('.close').addEventListener('click', () => $(target).close());
  }
  $('mode').addEventListener('change', () => { $('mode-label').textContent = $('mode').selectedOptions[0].textContent; $('settings').close(); });
  $('clear').addEventListener('click', () => { if(pending) return; log.replaceChildren(); $('empty').hidden = false; feedback(''); prompt.value = ''; resize(); prompt.focus(); });
  $('stop').addEventListener('click', () => pending?.abort());
  prompt.addEventListener('input', resize);
  prompt.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !matchMedia('(pointer: coarse)').matches) { event.preventDefault(); $('form').requestSubmit(); }
  });
  $('form').addEventListener('submit', async event => {
    event.preventDefault();
    const message = prompt.value.trim();
    if(pending || !message || message.length > 4000) return;
    const controller = new AbortController(); pending = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
    add('user',message); prompt.value=''; busy(true); feedback('กำลังตอบ…');
    try {
      const response = await fetch('/api/chat', {method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({message,mode:$('mode').value,provider:'openai'})});
      const data = await response.json().catch(() => { throw new Error('อ่านคำตอบจากเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง'); });
      if(!response.ok || data.ok === false) throw new Error(data.message || 'ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง');
      const output = data.message || data.output;
      if(typeof output !== 'string' || !output.trim()) throw new Error('เซิร์ฟเวอร์ไม่ได้ส่งข้อความตอบกลับ กรุณาลองอีกครั้ง');
      add('assistant',output); feedback('');
    } catch(error) {
      const stopped = error.name === 'AbortError' && !timedOut;
      feedback(stopped ? 'หยุดรอคำตอบแล้ว' : timedOut ? 'รอนานเกินไป กรุณาลองอีกครั้ง' : error.message || 'เชื่อมต่อไม่สำเร็จ', !stopped);
      if(!prompt.value) prompt.value = message;
    } finally { clearTimeout(timeout); pending = null; busy(false); }
  });
  resize();
})();
