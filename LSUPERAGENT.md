# LSUPERAGENT.md — Project Router / Source-of-Truth

> Universal router for `lsuperagen.docs` / `agents-sdk.space`.
> Use this file in Claude, ChatGPT, Codex, or any AI coding session.
> Do not rely on stale memory. Do not assume Supabase/Auth/Gateway are active.

---

## 0. Read Order

Read in this order before doing work:

```txt
1. LSUPERAGENT.md        ← this file; current source-of-truth router
2. CLAUDE.md             ← Claude-specific pointer only
3. src/index.js          ← Cloudflare Worker runtime and HTML injection layer
4. chat.html             ← Public Chat UI
5. tools.html            ← Public tools catalog
6. workspace.html        ← release gates / protocol reference
7. wrangler.toml         ← Cloudflare Worker config
```

If any source conflicts with this file, stop and ask the owner before changing architecture.

---

## 1. Project Identity

```txt
Project:        lsuperagen.docs / AGENTS-SDK.SPACE
Owner label:    THNB SMK / Bank
Repo:           thanabartbb/lsuperagent.docs
Public domain:  https://agents-sdk.space
Runtime:        Cloudflare Workers Static Assets + src/index.js
Version:        V11 · Public Beta
Status:         public docs/site live; chat UI live; AI runtime not wired
```

This is currently a public docs + launch + control surface that is being evolved into a public AI chat product.

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
  └─ handles /api/chat as a safe runtime endpoint
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
OpenAI provider route — FUTURE, only when OPENAI_API_KEY exists as Cloudflare Secret
```

### Current behavior

If `OPENAI_API_KEY` is missing, `/api/chat` must return `runtime_not_wired`.

No fake AI response is allowed.

---

## 3. Explicitly Not Active

The following are not active in the current work unit:

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
Do not use Claude/Anthropic as the first provider.
Do not create D1/KV/R2 unless explicitly approved.
Do not rotate, print, commit, or expose secrets.
```

These may be future modules only after explicit approval.

---

## 4. Completed State

```txt
✓ Static site publicly available
✓ Cloudflare Worker serves static assets
✓ src/index.js exists
✓ /admin exists as owner control surface
✓ /chat exists as Public Chat V1 UI
✓ /api/chat exists as safe runtime_not_wired endpoint
✓ Tools Router V1 exists
✓ Mobile Public Polish V3 exists
✓ Main Tools route into chat query modes
```

Tools Router V1:

```txt
AI Writer        → /chat?tool=writer
Image Generator  → /chat?tool=image
Deep Research    → /chat?tool=research
Code Assistant   → /chat?tool=code
Coming Soon      → show clear Coming Soon status; do not navigate to a broken page
```

---

## 5. File Map

```txt
index.html             homepage / launch hero
chat.html              Public Chat V1 UI; runtime not wired
admin.html             owner control request surface
tools.html             public tools catalog
examples.html          SDK Plug Tools catalog
workspace.html         protocol / release gates / workspace reference
getting-started.html   docs entry
guides.html            guides page
api.html               API docs page
changelog.html         release notes
src/index.js           Cloudflare Worker runtime + injection router
wrangler.toml          Cloudflare Worker config
_redirects             clean route aliases
_headers               static response headers
CLAUDE.md              Claude-specific pointer to this router
LSUPERAGENT.md         canonical reusable router
```

---

## 6. Active Work Unit

Current priority:

```txt
PUBLIC CHAT RUNTIME V1
```

Scope:

```txt
1. Keep visual design stable.
2. Use src/index.js only unless a new support file is clearly required.
3. Add request validation for /api/chat.
4. Support tool values: writer, image, research, code, or null.
5. Connect OpenAI first provider only when OPENAI_API_KEY exists in Cloudflare env.
6. If secret is missing, keep runtime_not_wired.
7. Return structured JSON.
8. Do not add login, database, Supabase, Firebase, or Trusted Gateway.
```

Expected JSON shape:

```json
{
  "ok": true,
  "status": "completed",
  "tool": "writer",
  "provider": "openai",
  "output": "...",
  "usage": null
}
```

Safe error shape:

```json
{
  "ok": false,
  "status": "runtime_not_wired",
  "message": "Runtime not wired. No fake AI response generated.",
  "readiness": {
    "frontend": true,
    "api_route": true,
    "tools_router": true,
    "provider_router": false,
    "secret_detected": false,
    "model_output": false
  }
}
```

---

## 7. Design System Lock

Design identity:

```txt
Dark Premium Street × Gaming × Editorial × Minimal
NEWGENRETIN v0.2
```

Palette:

```txt
Carbon Black          85%   canvas / page background
Gunmetal / Graphite   10%   cards / panels
Ice Blue #63b3ff       4%   focus / active / indicators
White                  1%   high contrast text
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

Hard rules:

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

Current practical gates:

```txt
R1  Static site loads                         DONE
R2  Chat UI exists                            DONE
R3  Tools Router V1                           DONE
R4  /api/chat validation                      NEXT
R5  OpenAI provider with Cloudflare Secret    NEXT
R6  Runtime verification                      BLOCKED until secret/deploy evidence
R7  Rate limit / abuse guard                  FUTURE
R8  Auth / memory / persistence               FUTURE, not current
```

Do not mark Public Chat Runtime V1 complete until:

```txt
GET / works
GET /tools works
GET /chat works
POST /api/chat without secret returns safe runtime_not_wired
POST /api/chat with Cloudflare Secret returns real model output
No secret appears in repo, logs, or UI
```

---

## 10. Claude / External AI Instructions

When Claude or another AI works on this repo:

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

If an instruction conflicts with this file, stop and ask.

---

## 11. Prompt for Claude Code

Use this prompt when handing work to Claude:

```txt
Read LSUPERAGENT.md first. It is the current source-of-truth router.
Ignore older instructions that treat Supabase/Auth/Trusted Gateway as active.

Work Unit: PUBLIC CHAT RUNTIME V1

Goal:
Wire /api/chat in src/index.js to an OpenAI server-side provider route only when OPENAI_API_KEY exists as a Cloudflare Secret.

Hard rules:
- Do not add Supabase.
- Do not add Firebase.
- Do not add Auth.
- Do not require Trusted Gateway.
- Do not use Claude/Anthropic as first provider.
- Do not put secrets in repo, HTML, client JS, logs, or screenshots.
- If OPENAI_API_KEY is missing, keep runtime_not_wired.
- No fake AI response.
- Keep visual identity unchanged.

Validation:
- message is required
- max message length must be enforced
- tool must be writer, image, research, code, or null
- response JSON must include ok/status/tool/provider/output/usage when completed

Report:
- files changed
- commands run
- deploy status
- verification evidence
```

---

## 12. Last Updated

```txt
2026-09-17
Router mode: Cloudflare + OpenAI-first
Supabase status: not active / future only
```