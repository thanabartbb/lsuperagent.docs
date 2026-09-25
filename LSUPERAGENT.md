# LSUPERAGENT.md — Project Router / Source-of-Truth

> Universal router for `lsuperagen.docs` / `agents-sdk.space`.
> Use this file in Claude, ChatGPT, Codex, or any AI coding session.
> Do not rely on stale memory. This file describes what the code does now.

---

## 0. Read Order

```txt
1. LSUPERAGENT.md          ← current source-of-truth router
2. CLAUDE.md               ← Claude-specific pointer only
3. wrangler.toml           ← Cloudflare Worker config (entry = src/firebase-worker.js)
4. src/firebase-worker.js  ← Worker entry: Firebase auth bridge, then delegates
5. src/firebase-core.mjs   ← Firebase config, ID-token verification, email auth helpers
6. src/index.js            ← main runtime: routing, sessions, OpenAI chat/image, HTML injection
7. login.html / signup.html / firebase-auth.js  ← auth UI
8. chat.html / tools.html  ← AI Workspace UI (login required)
```

If another file conflicts with this router, stop and ask the owner before changing architecture.

---

## 1. Project Identity

```txt
Project:        lsuperagen.docs / AGENTS-SDK.SPACE
Owner label:    THNB SMK / Bank
Repo:           thanabartbb/lsuperagent.docs
Public domain:  https://agents-sdk.space
Worker name:    lsuperagent-docs
Runtime:        Cloudflare Workers Static Assets (run_worker_first) + src/firebase-worker.js
Status:         login-gated AI Workspace live; Firebase + Google OAuth auth; OpenAI chat/image
```

---

## 2. Active Architecture — CURRENT ONLY

```txt
Visitor
  ↓
https://agents-sdk.space
  ↓
Cloudflare Worker "lsuperagent-docs"
  ↓
src/firebase-worker.js
  ├─ /api/firebase/config                 public Firebase web config (503 if not configured)
  ├─ /api/firebase/status                 which Firebase pieces are configured (booleans only)
  ├─ /api/auth/firebase/session   POST    Firebase ID token → signed session cookie
  ├─ /api/auth/platform/login     POST    email + password via Firebase Identity Toolkit
  ├─ /api/auth/platform/register  POST    email sign-up via Firebase Identity Toolkit
  ├─ /api/auth/platform/password-reset POST
  ├─ /api/auth/firebase/logout    POST    clears session cookie
  └─ everything else → src/index.js
        ├─ /  /home                       → /chat if signed in, else /login
        ├─ legacy docs pages              → /chat or /login (examples, guides, api, workspace, ...)
        ├─ /auth/google(/callback)        direct Google OAuth (GOOGLE_CLIENT_ID/SECRET)
        ├─ /auth/github(/callback)        direct GitHub OAuth
        ├─ /auth/logout, /api/auth/status, /api/auth/session
        ├─ /chat, /tools                  login required → /login?return_to=...
        ├─ /api/chat   POST               login required → OpenAI Responses API
        ├─ /api/image  POST               login required → OpenAI Images API
        ├─ /guide  (/sdk → /guide)        login required → lsupergen-sdk guide with live "run" checks
        ├─ /api/sdk/keys POST             login required, same-origin → stateless signed API key (lsg_…, 30 days)
        ├─ /v1/health GET                 public status for the lsupergen-sdk API (CORS *)
        ├─ /v1/me GET, /v1/chat POST, /v1/image POST   Bearer lsg_ key → same handlers as /api/chat, /api/image
        ├─ /dev, /dev-code-drop           owner-only (OWNER_GOOGLE_EMAIL / OWNER_GOOGLE_SUB)
        ├─ /admin                         → /dev
        └─ static assets via env.ASSETS + safe HTML enhancements
```

### Session model

All sign-in paths end in the same HMAC-signed cookie `lsuperagen_trial_session`,
signed with `AUTH_SESSION_SECRET`:

```txt
login.html  → /auth/google        (direct Google OAuth, current public login button)
signup.html → firebase-auth.js    (Firebase client SDK) → /api/auth/firebase/session
email form  → /api/auth/platform/login | register (server-side Firebase Identity Toolkit)
```

### SDK API (lsupergen-sdk)

```txt
npm package:  lsupergen-sdk (thanabartbb/npm-lsupergen-sdk)
Base URL:     https://agents-sdk.space/v1   (SDK default api.lsupergen.com is NOT this site)
API key:      POST /api/sdk/keys from /guide → HMAC token signed with AUTH_SESSION_SECRET, typ "sdk_key"
              no storage; expires in 30 days; rotating AUTH_SESSION_SECRET revokes all keys (and sessions)
Guide page:   guide.html + assets/guide.js, runs vendor/lsupergen-sdk/0.1.0/index.js
              (byte-identical npm dist, sha256 pinned in tests/sdk-guide.test.mjs)
0.1.0 caveat: browsers / Workers need `fetch: (...args) => fetch(...args)` (unbound fetch → Illegal invocation)
```

### AI runtime path

```txt
/chat (signed in)
  ↓
POST /api/chat          rate limit: 10 requests / 10 min (in-memory, per isolate)
  ↓
OpenAI Responses API    model: OPENAI_MODEL first, then built-in fallback list
                        research/url tools use a web-capable model list

POST /api/image → OpenAI Images API (gpt-image-* fallback list)
```

If `OPENAI_API_KEY` is missing, `/api/chat` and `/api/image` return
`503 { ok: false, status: "service_unavailable" }`. No fake AI response is allowed.

---

## 3. Cloudflare Configuration (names only — never commit values)

```txt
Firebase (public web config, plain vars):
  FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID   (required)
  FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_MEASUREMENT_ID (optional)

Secrets:
  AUTH_SESSION_SECRET      session cookie signing (required for any login)
  OPENAI_API_KEY           chat + image
  GOOGLE_CLIENT_SECRET     direct Google OAuth
  GITHUB_CLIENT_SECRET     direct GitHub OAuth

Other vars:
  GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID
  OPENAI_MODEL             preferred chat model
  OWNER_GOOGLE_EMAIL, OWNER_GOOGLE_SUB, ADMIN_ALLOWED_LOGINS   owner/dev gate
  PUBLIC_SITE_URL
```

See `FIREBASE_SETUP.md` for Firebase console → Cloudflare variable steps.

---

## 4. Explicitly Not Active

```txt
Supabase
Trusted Gateway
Anthropic/Claude provider as first runtime provider
Gemini provider
DeepSeek provider
Zapier MCP runtime integration
R2 / D1 / KV persistence (no server-side user DB; sessions are cookies only)
Firestore / Firebase Admin SDK
```

Rules:

```txt
Do not wire Supabase.
Do not require Trusted Gateway.
Do not use Claude/Anthropic as first provider.
Do not create D1/KV/R2 or Firestore unless explicitly approved.
Firebase is used for authentication only — do not expand its scope without approval.
Do not rotate, print, commit, or expose secrets.
```

---

## 5. File Map

```txt
wrangler.toml            Worker config; main = src/firebase-worker.js
src/firebase-worker.js   Worker entry: Firebase/platform-email routes, delegates to index.js
src/firebase-core.mjs    Firebase env config, JWKS ID-token verification, Identity Toolkit calls
src/index.js             routing, OAuth, sessions, rate limit, OpenAI chat/image, HTML injection
index.html               homepage (Worker redirects / to /chat or /login)
login.html               public login (Google)
signup.html              sign-up (Firebase client SDK)
firebase-auth.js         Firebase client SDK glue
auth-all.html            all-in-one auth surface
chat.html                AI Workspace chat UI (login required)
guide.html               lsupergen-sdk guide (login required); assets/guide.js runs live checks
vendor/lsupergen-sdk/    vendored npm build served same-origin (CSP allows 'self' scripts only)
tools.html               tools catalog (login required)
dev.html / dev-code-drop.html   owner-only dev surfaces
admin.html               legacy, redirected to /dev
tests/*.test.mjs         node --test suite
scripts/live-smoke.mjs   live smoke check against the deployed site
_redirects, _headers     static aliases / headers
CLAUDE.md                Claude-specific pointer
LSUPERAGENT.md           canonical reusable router
```

---

## 6. Verification

```txt
Local:  node --test tests/*.test.mjs
Live:   node scripts/live-smoke.mjs
```

Live checklist:

```txt
1. GET /            → 302 to /login (signed out) or /chat (signed in)
2. GET /login       → 200
3. GET /chat        → 302 to /login when signed out
4. GET /api/firebase/status → configured: true, secret_values_exposed: false
5. POST /api/chat signed out → 401 authentication_required
6. POST /api/chat signed in  → real model output, ok: true
6b. /guide signed in → create API key → "รันทั้งหมด" → Proof report PASS 5/5 (chat needs OPENAI_API_KEY)
7. No secret appears in repo, logs, screenshots, or UI
```

Chat success shape:

```json
{ "ok": true, "status": "completed", "message": "...", "output": "...", "sources": [] }
```

---

## 7. Design System Lock

```txt
Dark Premium Street × Gaming × Editorial × Minimal
NEWGENRETIN v0.2
Carbon Black 85% / Gunmetal 10% / Ice Blue #63b3ff 4% / White 1%
```

Rules:

```txt
Do not redesign the site.
Do not add white backgrounds.
Do not add casino-style bloom/fog/smoke.
Do not spread chrome/metallic styling across the full page.
Keep card radius restrained, around <=14px.
Use thin borders and clean mobile-first hierarchy.
```

---

## 8. Safety / Security Rules

```txt
No fake AI response.
No fake metrics.
No fake customer logos.
No fake testimonials.
No API key or secret in HTML, client-side JS, GitHub, screenshots, or logs.
Firebase web config is public by design; AUTH_SESSION_SECRET and provider keys are not.
No direct browser-to-provider AI calls.
No broad rewrite without approval.
One work unit at a time.
```

Provider calls must be server-side inside the Cloudflare Worker only.

---

## 9. Release Gates

```txt
R1  Static site loads                         DONE
R2  Chat UI exists                            DONE
R3  Tools Router V1                           DONE
R4  /api/chat validation                      DONE
R5  OpenAI provider with Cloudflare Secret    DONE IN CODE / VERIFY LIVE
R6  Auth: Google OAuth + Firebase             DONE IN CODE / VERIFY LIVE
R7  Rate limit / abuse guard                  PARTIAL (in-memory per isolate)
R8  Memory / persistence                      FUTURE, not current
```

---

## 10. External AI Instructions

```txt
1. Read LSUPERAGENT.md first.
2. Summarize current architecture before editing.
3. State exactly one work unit.
4. Make the smallest possible code change.
5. Do not introduce Supabase/Gateway/persistence unless owner explicitly approves.
6. Do not change visual identity.
7. Run node --test tests/*.test.mjs and request live verification.
8. Report files changed, commands run, and evidence.
```

---

## 11. Last Updated

```txt
2026-09-24
Router mode: Cloudflare + Firebase auth + OpenAI-first
Entry: src/firebase-worker.js → src/index.js
Auth status: active (Google OAuth + Firebase); /chat, /tools, /api/chat, /api/image require login
Supabase status: not active / future only
```
