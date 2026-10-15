(function () {
  const status = document.getElementById('github-status');
  const connect = document.getElementById('github-connect');
  const disconnect = document.getElementById('github-disconnect');
  if (!status || !connect || !disconnect) return;

  async function load() {
    try {
      const response = await fetch('/api/github/status', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { status.textContent = 'กรุณาเข้าสู่ระบบก่อนเชื่อม GitHub'; connect.hidden = true; return; }
      if (!response.ok) { status.textContent = 'ตัวเชื่อม GitHub ยังตั้งค่าไม่ครบ'; connect.hidden = true; return; }
      status.textContent = data.connected ? `เชื่อมแล้ว: @${data.login}` : 'ยังไม่ได้เชื่อม GitHub';
      connect.hidden = Boolean(data.connected);
      disconnect.hidden = !data.connected;
    } catch (_) { status.textContent = 'ตรวจสถานะ GitHub ไม่สำเร็จ'; }
  }

  connect.addEventListener('click', () => { location.assign('/api/github/connect'); });
  disconnect.addEventListener('click', async () => {
    disconnect.disabled = true;
    try {
      const response = await fetch('/api/github/disconnect', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (response.ok) await load(); else status.textContent = 'ยกเลิกการเชื่อมไม่สำเร็จ';
    } catch (_) { status.textContent = 'ยกเลิกการเชื่อมไม่สำเร็จ'; }
    finally { disconnect.disabled = false; }
  });

  const outcome = new URLSearchParams(location.search).get('github');
  if (outcome === 'connected') status.textContent = 'เชื่อม GitHub สำเร็จ กำลังตรวจสถานะ…';
  else if (outcome === 'failed') status.textContent = 'เชื่อม GitHub ไม่สำเร็จ ลองเชื่อมใหม่';
  else if (outcome === 'cancelled') status.textContent = 'ยกเลิกการเชื่อม GitHub แล้ว';
  load();
})();
