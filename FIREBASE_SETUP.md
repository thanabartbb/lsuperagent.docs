# Firebase setup for lsuperagen.docs

This integration adds Firebase Authentication as a progressive auth layer in front of the existing Cloudflare Worker session model. Existing `/auth/google` and `/auth/github` routes remain the fallback when Firebase is not configured or the browser module cannot initialize.

## Runtime contract

Cloudflare Worker entrypoint: `src/firebase-worker.js`

Public endpoints:

- `GET /api/firebase/status` — reports configuration readiness without returning secret values.
- `GET /api/firebase/config` — returns the Firebase Web configuration only when all required public values exist.
- `POST /api/auth/firebase/session` — verifies a Firebase ID token against Google's signing keys and converts it into the existing `lsuperagen_trial_session` cookie.
- `POST /api/auth/platform/login` — email/password login on the web form (Identity Toolkit → session cookie). Does not redirect to Google.
- `POST /api/auth/platform/register` — creates an email/password account and signs the user in.
- `POST /api/auth/platform/password-reset` — sends Firebase password reset email.
- `POST /api/auth/firebase/logout` — clears the compatible app session cookie.

## Required Cloudflare variables

Do not commit these values into the repository. Configure them in the Cloudflare Worker environment used by `agents-sdk.space`:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

Optional Firebase Web values:

- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_MEASUREMENT_ID`

The existing `AUTH_SESSION_SECRET` is also required for Firebase sessions to become compatible with the current Worker auth/session gate.

## Firebase Console

1. Create or select the Firebase project that should own this app.
2. Register a Web app and copy the Web configuration values into the Cloudflare environment variables above.
3. In Authentication > Sign-in method, enable **Email/Password**, **Google**, and **GitHub**.
4. Add `agents-sdk.space` to Authentication > Settings > Authorized domains.
5. For GitHub, configure the OAuth client ID/secret in Firebase and use the Firebase-provided callback handler URL shown in the provider setup.

## Verification

After deploy:

1. `GET /api/firebase/status` should return `status: "configured"` and `firebase_session_bridge: true`.
2. Open `/login.html` and sign in with Google or GitHub.
3. After Firebase redirects back, `/api/auth/firebase/session` should set `lsuperagen_trial_session`.
4. `GET /api/auth/session` should show the existing app session populated from Firebase identity claims.
5. If Firebase config is absent, the original `/auth/google` and `/auth/github` links continue to work as before.

Firebase Web SDK pinned for this integration: `12.19.0`.
