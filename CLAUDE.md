# CLAUDE.md — Claude Entry Pointer

> Claude / Claude Code: read `LSUPERAGENT.md` first.
> `LSUPERAGENT.md` is the current reusable project router and source-of-truth.

## Required read order

```txt
1. LSUPERAGENT.md   ← canonical current router
2. src/index.js     ← Cloudflare Worker runtime
3. chat.html        ← Public Chat UI
4. tools.html       ← Tools Router surface
5. workspace.html   ← gates / protocol reference
```

## Current correction

Older context that makes Supabase, Firebase Auth, Trusted Gateway, or Claude/Anthropic the active first provider is not current.

Current active work path:

```txt
Cloudflare Worker src/index.js
→ /api/chat
→ OpenAI first provider only when OPENAI_API_KEY exists as Cloudflare Secret
```

Hard rules:

```txt
Do not wire Supabase unless explicitly approved.
Do not wire Firebase unless explicitly approved.
Do not add Auth unless explicitly approved.
Do not require Trusted Gateway unless explicitly approved.
Do not use Claude/Anthropic as first provider.
Do not expose or commit secrets.
No fake AI response.
Keep visual identity unchanged.
```

## Handoff prompt

```txt
Read LSUPERAGENT.md first. Treat it as the source-of-truth router.
Summarize current architecture before editing.
Work on exactly one approved work unit.
Report files changed, commands run, and verification evidence.
```
