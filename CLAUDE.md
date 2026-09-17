# CLAUDE ROUTER — lsuperagen.docs

> Purpose: install this file at the repository root so Claude / Claude Code can understand the current project, the ChatGPT-side bridge, the safe execution boundaries, and the next valid work routes.

## 0. Identity

Project: `lsuperagen.docs`
Repository: `thanabartbb/lsuperagent.docs`
Public site: `https://agents-sdk.space`
Runtime surface: Cloudflare Workers Static Assets + `src/index.js`
Current status: `V11 · Public Beta`

This project is moving from a launch/docs surface toward a public AI chat product. Keep the design identity stable and evolve functionality in small, evidence-backed gates.

## 1. Current architecture

```txt
User / Public visitor
  ↓
agents-sdk.space static HTML pages
  ↓
Cloudflare Worker: src/index.js
  ├─ static asset passthrough via env.ASSETS.fetch(request)
  ├─ HTML injection layer for mobile polish / navigation / tools routing
  └─ /api/chat safe runtime stub
```

Important existing pages:

```txt
index.html             — launch homepage / hero
chat.html              — Public Chat V1 surface
admin.html             — Control page for owner workflow
tools.html             — public tools catalog
examples.html          — SDK Plug Tools catalog
workspace.html         — protocol/workspace reference surface
getting-started.html   — docs entry
api.html               — API docs
changelog.html         — release notes
src/index.js           — Worker runtime and injection router
wrangler.toml          — Cloudflare Worker config
_redirects             — clean route aliases
_headers               — response headers for static assets
```

## 2. Current bridge model

The working bridge is:

```txt
ChatGPT conversation
  → user sends LSUPERAGEN.DOCS CONTROL REQUEST
  → ChatGPT edits GitHub repo
  → Cloudflare auto-deploys from GitHub
  → agents-sdk.space updates
```

Claude should treat GitHub as the source of truth. Claude cannot read the ChatGPT conversation directly unless the user pastes context. Use this file and the repo state as the shared coordination layer.

## 3. Current functional state

Completed:

```txt
✓ Static site opens publicly
✓ /admin control surface exists
✓ /chat exists
✓ /api/chat exists as safe stub
✓ Tools Router V1 exists
✓ Mobile Public Polish V3 exists
✓ Main tool cards route into /chat?tool=...
```

Tools Router V1:

```txt
AI Writer        → /chat?tool=writer
Image Generator  → /chat?tool=image
Deep Research    → /chat?tool=research
Code Assistant   → /chat?tool=code
Coming Soon cards → show clear Coming Soon status, no blank page
```

Not completed:

```txt
✗ Real provider output is not enabled
✗ OPENAI_API_KEY is not confirmed in Cloudflare Worker secret env
✗ Anthropic / Gemini / DeepSeek provider router not implemented
✗ Rate limit / quota / anti-bot not implemented
✗ Login / account memory not implemented
✗ @lsuperagen/sdk package is not confirmed as published to npm
```

## 4. Non-negotiable rules

```txt
NO secrets in GitHub.
NO API keys in HTML, client JS, screenshots, comments, or logs.
NO fake AI responses.
NO fake metrics, fake users, fake clients, fake testimonials, or fake production readiness.
NO redesign unless explicitly requested.
NO Supabase unless explicitly approved in the current task.
NO Cloudflare Abuse Reports API for chat runtime; it is unrelated.
Preserve the visual identity: dark premium, graphite/black, ice-blue accent, blueprint grid, clean mobile readability.
Prefer small patches over rewrites.
Every completion report must include files changed, commands run, evidence, and remaining risks.
```

## 5. Task router

When the user gives a vague request, classify it into one of these routes.

### Route A — Visual / mobile polish

Use when request mentions screenshots, mobile, hamburger, overflow, cards, footer, spacing, or readability.

Allowed files:

```txt
src/index.js
*.html only when Worker injection is not enough
```

Rules:

```txt
Do not change brand system.
Fix UX defects with minimal CSS/JS injection.
Keep public pages readable on 393px-wide Android screens.
```

### Route B — Tools Router

Use when request mentions tools, AI Writer, Image Generator, Deep Research, Code Assistant, plugin cards, or Coming Soon behavior.

Expected routing:

```txt
writer   → /chat?tool=writer
image    → /chat?tool=image
research → /chat?tool=research
code     → /chat?tool=code
```

Rules:

```txt
Do not claim the tools generate real output until /api/chat is wired to a provider.
Coming Soon must be explicit.
```

### Route C — Public Chat Runtime V1

Use when request asks for real AI output.

Goal:

```txt
Implement OpenAI-only provider route first.
Keep runtime_not_wired when OPENAI_API_KEY is absent.
```

Required behavior:

```txt
POST /api/chat
Request body: { message, mode?, provider?, tool? }
Validate message exists.
Limit message length.
Allow tool: writer | image | research | code | null.
If env.OPENAI_API_KEY is missing: return 503 runtime_not_wired.
If present: call OpenAI from the Worker server side only.
Return structured JSON: ok, status, provider, tool, output, usage if available.
Do not expose raw secrets.
```

Do not add Claude/Gemini/DeepSeek until OpenAI route is proven.

### Route D — Cloudflare deployment / secrets

Use when request mentions Worker deploy, wrangler, secrets, runtime logs, or Cloudflare dashboard.

Claude may run:

```bash
npm install
npx wrangler deploy
npx wrangler secret put OPENAI_API_KEY
```

Only run secret commands locally/remote where the user controls the environment. Never ask the user to paste secret values into GitHub or public chat.

Verify:

```bash
curl -I https://agents-sdk.space/
curl -I https://agents-sdk.space/chat
curl -s -X POST https://agents-sdk.space/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"ping","tool":"writer"}'
```

### Route E — Documentation / public wording

Use when request mentions explaining the product, launch copy, docs, wording, onboarding, README, or changelog.

Rules:

```txt
Be honest about Beta state.
Avoid saying features are production-ready unless they are actually wired.
Mark runtime state clearly.
```

## 6. Public Chat Runtime V1 specification

Minimum acceptable implementation:

```txt
1. Do not alter visual identity.
2. Keep /chat usable without login.
3. Keep /api/chat server-side only.
4. Add request validation.
5. OpenAI first provider only.
6. No database requirement for V1.
7. No user account requirement for V1.
8. If secret is absent, preserve runtime_not_wired response.
9. If provider call fails, return a clear provider_error response.
10. Log minimal operational data only; never log message bodies with secrets.
```

Suggested response schema:

```json
{
  "ok": true,
  "status": "completed",
  "provider": "openai",
  "tool": "writer",
  "output": "...",
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0
  }
}
```

Suggested safe failure schema:

```json
{
  "ok": false,
  "status": "runtime_not_wired",
  "message": "Runtime not wired. Set Cloudflare Secret and enable provider router before public model output.",
  "readiness": {
    "frontend": true,
    "api_route": true,
    "provider_router": false,
    "secret_detected": false,
    "model_output": false
  }
}
```

## 7. Coordination protocol with ChatGPT

When Claude finishes a task, report in this format:

```txt
LSUPERAGEN.DOCS CLAUDE REPORT
Task:
Files changed:
Commands run:
Verification:
Evidence:
Remaining risks:
Next one task:
```

If Claude needs the ChatGPT-side agent to patch GitHub, output a control request like this:

```txt
LSUPERAGEN.DOCS CONTROL REQUEST
Target: <specific target>
Change: <specific change>
Rule: แก้ใน repo thanabartbb/lsuperagent.docs แล้วให้ Cloudflare deploy อัตโนมัติ
```

## 8. Immediate recommended next route

Next valid route:

```txt
PUBLIC CHAT RUNTIME V1 — OpenAI first provider only
```

Do not start with auth, database, memory, multi-model routing, or npm publishing. Finish the first real server-side provider route, verify it, then expand.
