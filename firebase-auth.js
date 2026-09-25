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

async function platformRequest(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
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

function authMessageFromPayload(data, fallback) {
  if (data?.message) return data.message;
  return fallback || 'ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง';
}

async function loadFirebaseOAuth() {
  const config = await fetchFirebaseConfig();
  if (!config) return null;

  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
  const {
    getAuth,
    getRedirectResult,
    GithubAuthProvider,
    GoogleAuthProvider,
    signInWithRedirect,
  } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');

  const app = initializeApp(config);
  const auth = getAuth(app);
  return { auth, GoogleAuthProvider, GithubAuthProvider, getRedirectResult, signInWithRedirect };
}

async function exchangeFirebaseSession(user) {
  const idToken = await user.getIdToken(true);
  const { response, data } = await platformRequest('/api/auth/firebase/session', { idToken });
  if (!response.ok) throw new Error(data?.message || data?.error || 'firebase_session_exchange_failed');
  return data;
}

function authErrorUrl(error) {
  const code = String(error?.code || error?.message || 'unknown').replace(/^auth\//, '').slice(0, 100);
  return `/login?auth_error=${encodeURIComponent(`firebase_${code}`)}`;
}

function providerFor(name, { GoogleAuthProvider, GithubAuthProvider }) {
  if (name === 'google') return new GoogleAuthProvider();
  if (name === 'github') return new GithubAuthProvider();
  throw new Error('unsupported_firebase_provider');
}

function attachEmailLogin(form, queryReturnTo) {
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
      const { response, data } = await platformRequest('/api/auth/platform/login', {
        email,
        password,
        return_to: queryReturnTo,
      });
      if (!response.ok || !data.ok) {
        setNotice(authMessageFromPayload(data, 'เข้าสู่ระบบไม่สำเร็จ'));
        return;
      }
      window.location.replace(data.return_to || queryReturnTo);
    } catch (_) {
      setNotice('เชื่อมต่อระบบเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(submit, false);
    }
  });
}

function attachPasswordReset(form) {
  const resetButton = form?.querySelector('[data-password-reset]');
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
      const { response, data } = await platformRequest('/api/auth/platform/password-reset', { email });
      if (!response.ok || !data.ok) {
        setNotice(authMessageFromPayload(data, 'ส่งลิงก์รีเซ็ตไม่สำเร็จ'));
        return;
      }
      setNotice(data.message || 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว', 'success');
    } catch (_) {
      setNotice('เชื่อมต่อระบบรีเซ็ตรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(resetButton, false);
    }
  });
}

function attachEmailRegister(form, queryReturnTo) {
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const email = String(new FormData(form).get('email') || '').trim();
    const password = String(new FormData(form).get('password') || '');
    const confirm = String(new FormData(form).get('password_confirm') || '');

    if (!email || !password) {
      setNotice('กรอกอีเมลและรหัสผ่านให้ครบ');
      return;
    }
    if (password !== confirm) {
      setNotice('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setNotice('');
    setBusy(submit, true);
    try {
      const { response, data } = await platformRequest('/api/auth/platform/register', {
        email,
        password,
        return_to: queryReturnTo,
      });
      if (!response.ok || !data.ok) {
        setNotice(authMessageFromPayload(data, 'สมัครสมาชิกไม่สำเร็จ'));
        return;
      }
      window.location.replace(data.return_to || queryReturnTo);
    } catch (_) {
      setNotice('เชื่อมต่อระบบสมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(submit, false);
    }
  });
}

async function attachOAuthProviders(queryReturnTo) {
  const oauth = await loadFirebaseOAuth();
  for (const link of document.querySelectorAll('[data-firebase-provider]')) {
    if (!oauth) continue;
    link.addEventListener('click', async (event) => {
      const providerName = link.getAttribute('data-firebase-provider');
      if (!providerName) return;
      event.preventDefault();
      sessionStorage.setItem(RETURN_TO_KEY, queryReturnTo);
      setBusy(link, true);
      try {
        await oauth.signInWithRedirect(oauth.auth, providerFor(providerName, oauth));
      } catch (error) {
        setBusy(link, false);
        window.location.assign(authErrorUrl(error));
      }
    });
  }

  if (!oauth) return;

  const redirectResult = await oauth.getRedirectResult(oauth.auth);
  if (redirectResult?.user) {
    await exchangeFirebaseSession(redirectResult.user);
    const returnTo = safeReturnTo(sessionStorage.getItem(RETURN_TO_KEY));
    sessionStorage.removeItem(RETURN_TO_KEY);
    window.location.replace(returnTo);
  }
}

async function main() {
  const queryReturnTo = safeReturnTo(new URLSearchParams(window.location.search).get('return_to'));
  for (const link of document.querySelectorAll('a[href^="/auth/google"], a[href^="/auth/github"]')) {
    const target = new URL(link.href, window.location.origin);
    target.searchParams.set('return_to', queryReturnTo);
    link.href = target.pathname + target.search;
  }
  for (const link of document.querySelectorAll('a[href="/signup"], a[href="/login"]')) {
    if (queryReturnTo !== '/chat') link.href += '?return_to=' + encodeURIComponent(queryReturnTo);
  }
  const loginForm = document.querySelector('[data-email-login]');
  const registerForm = document.querySelector('[data-email-register]');
  const resetForm = document.querySelector('[data-email-reset]');

  if (loginForm) attachEmailLogin(loginForm, queryReturnTo);
  if (registerForm) attachEmailRegister(registerForm, queryReturnTo);
  if (resetForm) attachPasswordReset(resetForm);
  if (document.querySelector('[data-firebase-provider]')) await attachOAuthProviders(queryReturnTo);
}

main().catch((error) => {
  console.warn('[firebase-auth] setup error', error);
});
