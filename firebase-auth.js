import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  getRedirectResult,
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithRedirect,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const RETURN_TO_KEY = 'lsuperagen.firebase.return_to';

function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return '/chat?auth=firebase';
  if (!value.startsWith('/') || value.startsWith('//') || /[\r\n]/.test(value)) return '/chat?auth=firebase';
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
  return `/login.html?auth_error=${encodeURIComponent(`firebase_${code}`)}`;
}

async function main() {
  const config = await fetchFirebaseConfig();
  if (!config) return;

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
      link.setAttribute('aria-busy', 'true');
      try {
        await signInWithRedirect(auth, providerFor(providerName));
      } catch (error) {
        window.location.assign(authErrorUrl(error));
      }
    });
  }
}

main().catch((error) => {
  console.warn('[firebase-auth] setup unavailable; keeping existing OAuth fallback', error);
});
