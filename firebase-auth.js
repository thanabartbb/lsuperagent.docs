import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  getRedirectResult,
  GithubAuthProvider,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const RETURN_TO_KEY = 'lsuperagen.firebase.return_to';

function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/chat';
  if (!value.startsWith('/') || value.startsWith('//') || /[\r\n]/.test(value)) return '/chat';
  return value.slice(0, 180);
}

async function fetchFirebaseConfig() {
  const response = await fetch('/api/firebase/config', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.ok && payload?.config ? payload.config : null;
}

async function exchangeSession(user) {
  const idToken = await user.getIdToken(true);
  const response = await fetch('/api/auth/firebase/session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.error || 'firebase_session_exchange_failed');
  }
  return response.json();
}

function providerFor(name) {
  if (name === 'google') return new GoogleAuthProvider();
  if (name === 'github') return new GithubAuthProvider();
  throw new Error('unsupported_firebase_provider');
}

function authErrorUrl(error) {
  const code = String(error?.code || error?.message || 'unknown').replace(/^auth\//, '').slice(0, 100);
  return `/login?auth_error=${encodeURIComponent(`firebase_${code}`)}`;
}

function authMessage(error) {
  const code = String(error?.code || error?.message || '').replace(/^auth\//, '');
  if (/invalid-credential|wrong-password|user-not-found/i.test(code)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (/invalid-email/i.test(code)) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (/too-many-requests/i.test(code)) return 'มีการลองเข้าสู่ระบบหลายครั้ง กรุณารอสักครู่แล้วลองใหม่';
  if (/operation-not-allowed/i.test(code)) return 'ระบบอีเมลและรหัสผ่านยังไม่ได้เปิดใช้งาน';
  return 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง';
}

function setNotice(message, state = 'error') {
  const notice = document.getElementById('auth-notice');
  if (!notice) return;
  notice.textContent = message || '';
  if (message) notice.dataset.state = state;
  else delete notice.dataset.state;
}

function setBusy(element, busy) {
  if (!element) return;
  if (busy) element.setAttribute('aria-busy', 'true');
  else element.removeAttribute('aria-busy');
}

function attachUnavailableEmailFallback(form, resetButton) {
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    setNotice('ระบบอีเมลยังไม่พร้อมใช้งาน กรุณาใช้ Google หรือ GitHub');
  });
  resetButton?.addEventListener('click', () => {
    setNotice('ระบบรีเซ็ตรหัสผ่านยังไม่พร้อมใช้งาน');
  });
}

async function main() {
  const form = document.querySelector('[data-email-login]');
  const resetButton = document.querySelector('[data-password-reset]');
  const config = await fetchFirebaseConfig();
  if (!config) {
    attachUnavailableEmailFallback(form, resetButton);
    return;
  }

  const app = initializeApp(config);
  const auth = getAuth(app);

  const redirectResult = await getRedirectResult(auth);
  if (redirectResult?.user) {
    await exchangeSession(redirectResult.user);
    const returnTo = safeReturnTo(sessionStorage.getItem(RETURN_TO_KEY));
    sessionStorage.removeItem(RETURN_TO_KEY);
    window.location.replace(returnTo);
    return;
  }

  const queryReturnTo = safeReturnTo(new URLSearchParams(window.location.search).get('return_to'));

  for (const link of document.querySelectorAll('[data-firebase-provider]')) {
    link.addEventListener('click', async (event) => {
      const providerName = link.getAttribute('data-firebase-provider');
      if (!providerName) return;
      event.preventDefault();
      sessionStorage.setItem(RETURN_TO_KEY, queryReturnTo);
      setBusy(link, true);
      try {
        await signInWithRedirect(auth, providerFor(providerName));
      } catch (error) {
        setBusy(link, false);
        window.location.assign(authErrorUrl(error));
      }
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const email = String(new FormData(form).get('email') || '').trim();
    const password = String(new FormData(form).get('password') || '');

    if (!email || !password) {
      setNotice('กรอกอีเมลและรหัสผ่านให้ครบ');
      return;
    }

    setNotice('');
    setBusy(submit, true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await exchangeSession(credential.user);
      window.location.replace(queryReturnTo);
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      setBusy(submit, false);
    }
  });

  resetButton?.addEventListener('click', async () => {
    const emailInput = form?.querySelector('input[name="email"]');
    const email = String(emailInput?.value || '').trim();
    if (!email) {
      setNotice('กรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน');
      emailInput?.focus();
      return;
    }

    setBusy(resetButton, true);
    try {
      await sendPasswordResetEmail(auth, email);
      setNotice('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว', 'success');
    } catch (error) {
      setNotice(authMessage(error));
    } finally {
      setBusy(resetButton, false);
    }
  });
}

main().catch((error) => {
  console.warn('[firebase-auth] setup unavailable; keeping existing OAuth fallback', error);
});
