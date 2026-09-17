# LSUPERAGENT.md — Project Router / Source-of-Truth

> Universal router for `lsuperagen.docs` / `agents-sdk.space`.
> Use this file in Claude, ChatGPT, Codex, or any AI coding session.
> Do not rely on stale memory. Do not assume Supabase/Auth/Gateway are active.

---

## 0. Read Order

```txt
1. LSUPERAGENT.md        ← current source-of-truth router
2. CLAUDE.md             ← Claude-specific pointer only
3. src/index.js          ← Cloudflare Worker runtime + HTML injection
4. chat.html             ← Public Chat UI
5. tools.html            ← Public tools catalog
6. workspace.html        ← gates / protocol reference
7. wrangler.toml         ← Cloudflare Worker config
```

If another file conflicts with this router, stop and ask the owner before changing architecture.

---

## 1. Project Identity

```txt
Project:        lsuperagen.docs / AGENTS-SDK.SPACE
Owner label:    THNB SMK / Bank
Repo:           thanabartbb/lsuperagent.docs
Public domain:  https://agents-sdk.space
Runtime:        Cloudflare Workers Static Assets + src/index.js
Version:        V11 · Public Beta
Status:         public docs/site live; chat UI live; OpenAI Runtime V1 wired in code
```

This is a public docs + launch + control surface being evolved into a public AI chat product.

---

## 2. Active Architecture — CURRENT ONLY

```txt
Public visitor
  ↓
https://agents-sdk.space
  ↓
Cloudflare Worker: src/index.js
  ├─ serves static HTML via env.ASSETS.fetch(request)
  ├─ injects safe UI enhancements
  ├─ routes Tools cards into /chat?tool=...
  └─ handles /api/chat as OpenAI Runtime V1 when OPENAI_API_KEY exists
```

### Current runtime path

```txt
Browser
  ↓
/chat or /chat?tool=writer|image|research|code
  ↓
POST /api/chat
  ↓
Cloudflare Worker src/index.js
  ↓
OpenAI Responses API via server-side Cloudflare Secret: OPENAI_API_KEY
```

If `OPENAI_API_KEY` is missing, `/api/chat` must return `runtime_not_wired`.

No fake AI response is allowed.

---

## 3. Explicitly Not Active

```txt
Supabase
Firebase Auth
Trusted Gateway
Anthropic/Claude provider as first runtime provider
Gemini provider
DeepSeek provider
Zapier MCP runtime integration
R2 / D1 / KV persistence
```

Rules:

```txt
Do not wire Supabase.
Do not wire Firebase.
Do not add Auth.
Do not require Trusted Gateway.
Do not use Claude/Anthropic as first provider.
Do not create D1/KV/R2 unless explicitly approved.
Do not rotate, print, commit, or expose secrets.
```

These may be future modules only after explicit approval.

---

## 4. Completed State

```txt
✓ Static site publicly available
✓ Cloudflare Worker serves static assets
✓ /admin exists as owner control surface
✓ /chat exists as Public Chat V1 UI
✓ Tools Router V1 exists
✓ Mobile Public Polish V3 exists
✓ OPENAI_API_KEY Cloudflare Secret has been set by owner
✓ /api/chat OpenAI Runtime V1 code is wired in src/index.js
```

Tools Router V1:

```txt
AI Writer        → /chat?tool=writer
Image Generator  → /chat?tool=image
Deep Research    → /chat?tool=research
Code Assistant   → /chat?tool=code
Coming Soon      → show clear Coming Soon status
```

---

## 5. File Map

```txt
index.html             homepage / launch hero
chat.html              Public Chat V1 UI
tools.html             public tools catalog
examples.html          SDK Plug Tools catalog
workspace.html         protocol / release gates / workspace reference
getting-started.html   docs entry
guides.html            guides page
api.html               API docs page
changelog.html         release notes
admin.html             owner control request surface
src/index.js           Cloudflare Worker runtime + OpenAI Runtime V1
wrangler.toml          Cloudflare Worker config
_redirects             clean route aliases
_headers               static response headers
CLAUDE.md              Claude-specific pointer
LSUPERAGENT.md         canonical reusable router
```

---

## 6. Active Work Unit

Current priority:

```txt
PUBLIC CHAT RUNTIME V1 VERIFICATION
```

Verification checklist:

```txt
1. GET / works
2. GET /tools works
3. GET /chat works
4. POST /api/chat without secret returns safe runtime_not_wired
5. POST /api/chat with Cloudflare Secret returns real OpenAI model output
6. No secret appears in repo, logs, screenshots, or UI
```

Runtime JSON success shape:

```json
{
  "ok": true,
  "status": "completed",
  "tool": "writer",
  "provider": "openai",
  "model": "gpt-5-mini",
  "message": "...",
  "output": "...",
  "usage": null
}
```

Safe error shape when secret is absent:

```json
{
  "ok": false,
  "status": "runtime_not_wired",
  "message": "Runtime not wired. No fake AI response generated.",
  "readiness": {
    "frontend": true,
    "api_route": true,
    "tools_router": true,
    "provider_router": true,
    "secret_detected": false,
    "model_output": false
  }
}
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
No API key in HTML.
No API key in client-side JS.
No API key in GitHub.
No API key in screenshots or logs.
No direct browser-to-provider calls.
No broad rewrite without approval.
One work unit at a time.
```

Provider calls must be server-side inside Cloudflare Worker only.

---

## 9. Release Gates

```txt
R1  Static site loads                         DONE
R2  Chat UI exists                            DONE
R3  Tools Router V1                           DONE
R4  /api/chat validation                      DONE IN CODE
R5  OpenAI provider with Cloudflare Secret    DONE IN CODE / VERIFY LIVE
R6  Runtime verification                      CURRENT
R7  Rate limit / abuse guard                  FUTURE
R8  Auth / memory / persistence               FUTURE, not current
```

Do not mark Public Chat Runtime V1 fully complete until live POST verification succeeds.

---

## 10. External AI Instructions

```txt
1. Read LSUPERAGENT.md first.
2. Summarize current architecture before editing.
3. State exactly one work unit.
4. Make the smallest possible code change.
5. Do not introduce Supabase/Auth/Gateway unless owner explicitly approves.
6. Do not change visual identity.
7. Run or request verification.
8. Report files changed, commands run, and evidence.
```

---

## 11. Last Updated

```txt
2026-09-17
Router mode: Cloudflare + OpenAI-first
Runtime status: OpenAI Runtime V1 wired in code; live verification pending
Supabase status: not active / future only
```