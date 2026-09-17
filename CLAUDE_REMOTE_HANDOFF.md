# CLAUDE REMOTE HANDOFF — lsuperagen.docs

> Purpose: give Claude / Claude Code a clean, token-free handoff so it can continue work from this repository through its own GitHub remote, SSH key, or GitHub integration. Do not paste GitHub tokens, OpenAI keys, Cloudflare tokens, or any private secret into Claude chat.

## 0. TARGET LOCK — READ THIS FIRST

```txt
TARGET PROJECT: lsuperagen.docs
TARGET REPOSITORY: thanabartbb/lsuperagent.docs
TARGET PUBLIC SITE: https://agents-sdk.space
TARGET CLOUDFLARE WORKER: lsuperagent-docs
TARGET BRANCH: main
```

This handoff is **ONLY** for `lsuperagen.docs` / `agents-sdk.space`.

Do **not** treat this as any other project:

```txt
NOT S-AGENTS
NOT AGENTS-SDK-LAB
NOT tha-abatb-agents-sdk-lab
NOT s-agents.thanabartb.workers.dev
NOT a Supabase app migration
NOT a Railway/Vercel migration
```

If Claude sees old context mentioning S-AGENTS, AGENTS-SDK-LAB, Railway, Supabase migration, or another repo, treat it as historical noise unless the owner explicitly starts a new task for that project.

The current active project is:

```txt
lsuperagen.docs → agents-sdk.space → Cloudflare Worker Static Assets → src/index.js → OpenAI Runtime V1
```

## 1. Project identity

```txt
Project: lsuperagen.docs
Repository: thanabartbb/lsuperagent.docs
Public site: https://agents-sdk.space
Primary branch: main
Cloudflare Worker: lsuperagent-docs
Runtime file: src/index.js
Current public runtime: OpenAI Runtime V1 + Rate Limit V1
Current status: V11 · Public Beta
```

This repository is the current clean source of truth. Treat older account/workflow context as historical only unless the owner explicitly provides it again.

## 2. Remote setup Claude should use

Preferred Git remote:

```bash
git remote add origin git@github.com:thanabartbb/lsuperagent.docs.git
```

If `origin` already exists:

```bash
git remote set-url origin git@github.com:thanabartbb/lsuperagent.docs.git
```

Claude should authenticate through one of these safe paths:

```txt
1. Claude's own GitHub integration, if connected by the owner.
2. SSH key already installed in Claude Code / local environment.
3. A GitHub device/browser authorization flow handled by the owner in the UI.
```

Claude must not ask the owner to paste raw GitHub tokens into the conversation.

## 3. Files Claude must read first

Before editing, read these files in order:

```txt
CLAUDE_REMOTE_HANDOFF.md
CLAUDE.md
LSUPERAGENT.md
src/index.js
wrangler.toml
```

For UI tasks, inspect the target page too:

```txt
index.html
login.html
chat.html
tools.html
examples.html
workspace.html
getting-started.html
guides.html
api.html
changelog.html
admin.html
```

## 4. Current architecture

```txt
Browser
  ↓
https://agents-sdk.space
  ↓
Cloudflare Workers Static Assets
  ↓
src/index.js
  ├─ serves static HTML assets
  ├─ injects mobile navigation / homepage polish / tools routing
  ├─ handles POST /api/chat
  ├─ checks Rate Limit V1 before provider call
  └─ calls OpenAI Responses API server-side when OPENAI_API_KEY exists
```

Current `/api/chat` behavior:

```txt
POST /api/chat
Body: { message, mode?, provider?, tool? }
Allowed tools: writer | image | research | code | null
Message max length: 4000 characters
Rate limit: 10 requests / 10 minutes / IP / tool
Provider: OpenAI only for V1
Model: env.OPENAI_MODEL first, then fallback candidates
Secret source: Cloudflare Runtime Secret OPENAI_API_KEY
```

## 5. What is already working

```txt
✓ Public static site is live.
✓ /chat opens publicly.
✓ /api/chat is wired to OpenAI Runtime V1.
✓ OpenAI model access was fixed via project Model Usage allowlist.
✓ /chat successfully returned a real assistant response.
✓ Rate Limit V1 is implemented in src/index.js.
✓ Mobile Public Polish V3 is implemented.
✓ Tools Router V1 is implemented.
✓ Homepage Polish V1 is implemented.
✓ CLAUDE_REMOTE_HANDOFF.md target is locked to lsuperagen.docs only.
```

## 6. What is not yet production-grade

```txt
✗ Login page is still visually a login form; auth is not wired.
✗ No persistent user accounts.
✗ No database-backed memory.
✗ No KV/Durable Object-backed global rate limit yet.
✗ Image Generator currently compiles image prompts/specs; it does not yet call an image generation endpoint.
✗ Deep Research has no live web search pipeline yet.
✗ Multi-provider routing for Claude/Gemini/DeepSeek is not implemented.
✗ Zapier/LINE/X integrations are not active in this runtime path.
```

## 7. Non-negotiable safety rules

```txt
NO secrets in GitHub.
NO API keys in HTML, client JS, Markdown examples, screenshots, comments, logs, or test payloads.
NO fake AI responses.
NO fake login/session state.
NO fake user accounts.
NO fake metrics, testimonials, client logos, or production claims.
NO broad redesign unless the owner explicitly asks.
NO Supabase unless the owner explicitly approves it in the current task.
NO Cloudflare D1/KV/R2/Durable Object creation unless explicitly approved.
Do not replace the current GitHub → Cloudflare path without approval.
Preserve dark premium / graphite / ice-blue visual identity unless the owner asks for a redesign.
```

## 8. Recommended Claude work routes

### Route A — Public Access login cleanup

Use when the owner says login page is confusing or asks what public users should enter.

```txt
Convert login.html from fake account login into Public Access / Guest Access.
Primary action: Open Public Chat
Secondary action: Try Image Prompt Engine
Tertiary action: View Tools
Remove or hide password, forgot password, and magic link until auth is real.
```

### Route B — Image Prompt Engine V1

Use when the owner asks to improve Image Generator behavior.

```txt
Do not lock the assistant into a fixed persona.
Use a flexible workflow engine:
1. Intent Scan
2. Creative Expansion
3. Final Image Prompt
4. Negative Prompt
5. Render Settings
```

The Image Generator may output high-quality image prompts/specs, but must not claim it generated an image unless an actual image API route is implemented and verified.

### Route C — Image API V1

Use only when the owner explicitly asks to wire real image generation.

```txt
Add a server-side image generation endpoint.
Keep API key server-side only.
Validate prompt length and image size.
Return clear provider_error / rate_limited / validation_error states.
Do not expose raw provider responses containing secrets.
```

### Route D — Runtime hardening

Use when the owner asks to protect credits/costs/security.

```txt
Improve rate limit UX.
Add debug-safe /api/chat/status.
Add stricter payload validation.
Add request body size cap.
Add abuse-safe error messages.
```

### Route E — Visual polish

Use when the owner sends screenshots and says a page looks strange/หลอน.

```txt
Patch narrowly.
Prefer src/index.js injection for small display fixes.
Edit HTML only when the source page itself is wrong.
Verify mobile width around 393px.
Do not disturb working /api/chat.
```

## 9. Verification commands

Run what is possible in the environment. At minimum, inspect changed files and test public endpoints after deploy.

```bash
git status
npm install
npx wrangler deploy --dry-run
```

After deployment:

```bash
curl -I https://agents-sdk.space/
curl -I https://agents-sdk.space/chat
curl -s -X POST https://agents-sdk.space/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"ping","tool":"writer"}'
```

Expected healthy `/api/chat` shape:

```json
{
  "ok": true,
  "status": "completed",
  "provider": "openai",
  "tool": "writer",
  "output": "...",
  "rate_limit": {
    "limit": 10,
    "remaining": 9,
    "reset_at": "..."
  }
}
```

## 10. Report format back to owner / ChatGPT

When finished, report in this exact structure:

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

If Claude cannot complete a task because account access or secrets are required, say exactly which dashboard action the owner must do and do not invent a fake completion.

## 11. One-line instruction for Claude

```txt
Continue ONLY from repo thanabartbb/lsuperagent.docs using SSH/GitHub integration, read CLAUDE_REMOTE_HANDOFF.md + CLAUDE.md + LSUPERAGENT.md first, target agents-sdk.space only, ignore S-AGENTS/AGENTS-SDK-LAB unless the owner explicitly starts that separate project, preserve the working OpenAI Runtime V1 + Rate Limit V1 path, and never request or store raw secrets in chat or repo.
```
