# SDKSPACE Agent Chat – screenshot-inspired mobile UI (draft)

This branch adds an **optional presentation layer** to the existing service-bound
`/chat` Agent Starter UI. It uses the user's screenshots as layout references,
not as live source code or proof of backend capabilities.

## What actually changes
- Dark minimal top toolbar, centered first-message state, suggestions from
  the existing Agent Starter, taller mobile-first composer, fixed attachment
  button and model indicator.
- Responsive drawer for the active Agent chat, new-chat and clear-current-chat.
- Existing Agent Starter React callbacks for send, streaming, scheduled tools,
  approvals, image attachments and `clearHistory` stay in charge.
- Existing signed-in `/chat` route, `AGENT_STARTER` Service Binding,
  `/agents/chat-agent/<opaque name>` proxy and auth protections are unchanged.
- A CSS/JS presentation layer is injected by `src/agent-ui.js` into the
  **already proxied** Agent Starter HTML. It never replaces or bundles the
  upstream Agent Starter build and does not patch its React event handlers.
- Existing classic `chat.html` plus its provider selector/PDF support stays
  unchanged as a fallback. Guest login-on-send flow stays unchanged.

## Important functional limits — do not claim features that are not wired
1. **Model selection:** The existing Agent Starter backend controls its model.
   Latest documented default is `@cf/moonshotai/kimi-k2.7-code`.
   The interface shows a factual *current model indicator*, not a multi-model
   picker. Choosing other OpenAI/Claude/DeepSeek models needs a separate
   authenticated backend implementation in the **agent-starter Worker**,
   which is not modified by this PR.
2. **History:** Cloudflare `useAgentChat` already persists messages and resumes
   the current Agent conversation. The new drawer operates on this current
   conversation using its existing Clear button. It is **not** a new list of
   independently stored conversations, and 'new chat' clears the current one.
   Multiple named conversations require Agent-side thread/user mapping.
3. **Files:** Agent Starter currently supports image attachments. PDF attachments
   are supported by classic `/api/chat` fallback but are not implemented in
   the Agent Starter frontend. This PR does **not** advertise PDF support inside
   the Agent interface.
4. **Version compatibility:** This UI uses current Cloudflare agents-starter
   semantic structure and controls. The adapter is presentation-only and
   gracefully does nothing if the expected React DOM structure isn't available.
   Runtime visual QA on the actual `agent-starter` build is needed before deploy.

## Change scope and rollout
- Added: `assets/agent-chat-reference.css`,
  `assets/agent-chat-reference.js`, focused tests, and this document.
- Modified: only `src/agent-ui.js` to inject the two new static assets.
- Not modified: `src/index.js`, `src/firebase-worker.js`,
  `wrangler.toml`, `chat.html`, `assets/chat.js`, CSS for other pages,
  login, D1, any OpenAI or Cloudflare executor source.
- No merge, deployment, Cloudflare secret/DNS change or UI cutover has been
  executed; owner review is mandatory before release.

## QA checklist
- Open the signed-in `/chat` on a real mobile device: dark header, hero,
  composer, existing suggestion chip actions and scrolling work.
- Send a streaming message; reload and verify the Agent's original persistence.
- Open/close drawer, press New Chat and Clear and verify confirmation/agent
  callback; reconnect and check history reflects the cleared current session.
- Attach/send one image through the original native image picker; no files
  should be uploaded by the companion UI script.
- Verify tools needing approval, cancellation, debugging and MCP controls
  still function through the original Agent app.
- Verify no page other than authenticated Agent Starter `/chat` is styled.
- Compare snapshots at 360, 390, 430, 768 and desktop viewport widths.
- Test unsupported Agent Starter build: the enhancement should not alter its
  transport or cause a redirect/login loop.
- Do **not** deploy before obtaining the exact owner-approved rollback UI
  baseline and explicit release authorization.

References:
- https://github.com/cloudflare/agents-starter/blob/main/src/app.tsx
- https://github.com/cloudflare/agents-starter/blob/main/src/server.ts
- https://github.com/thanabartbb/lsuperagent.docs/blob/main/docs/agent-starter-cursor-handoff.md
