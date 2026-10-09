# SDKSPACE Agent Chat — UI-first, backend unchanged

This is deliberately **phase 1 only**, based on the current user's screenshot
of the already-connected Agent Starter chat at `agents-sdk.space/chat`.

## Scope
- Modern dark mobile presentation for the existing Cloudflare Agent Starter:
  condensed top bar, wider conversation area, reduced visual clutter in tool
  outputs, taller bottom composer, accessible icon spacing and safe-area padding.
- All existing Cloudflare Agent Starter controls remain accessible, including
  the debug switch, status, theme toggle, MCP, Clear, tool approvals and
  stop-generation button. No fake buttons are added.
- Existing WebSocket, `ChatAgent`, per-user Agent instances, streaming,
  existing persisted **current conversation**, image attachment handler and
  React event handlers remain exactly as before.
- Files changed: **`src/agent-ui.js`**, new
  `assets/agent-chat-ui-only.css`, focused tests and this document.
- Only the original signed-in Agent Starter HTML includes the CSS.
  Anonymous Classic Chat, login, homepage, provider routes and all backend
  source remain unchanged.
- The CSS intentionally respects the existing light/dark theme toggle.

## Important gaps — not part of UI phase
- Missing list of *multiple independent* prior conversations: the Agent Starter
  current-session history is not the same as multi-conversation history.
  Backend thread/user mapping and persistence must be designed/tested **later**.
- Multi-model dropdown requires actual backend provider/model switching.
  No fake selector is added here.
- Cloudflare Workers AI image generation belongs to a separate step.
- The prior PR #46 includes an additional JS-generated history/model overlay;
  it is **not** the source of this focused UI-only branch, and it should not
  be merged alongside this one without reviewing overlap.

## Remote Desktop Commander reference search
On 2026-10-09 both registered remote devices (`localhost` and
`double-fluid-cfsb`) were unresponsive/offline when attempting to list
sessions, recent calls, and device config. No old sessions were inspected.
Revisit after reconnecting the desired device before any work that depends
on its local files or unpublished progress.

## Acceptance before merge/deploy
1. GitHub CI and Agent Starter bridge tests pass.
2. Browser QA on the live compatible Agent Starter HTML (mobile/desktop).
3. Confirm React event handlers still send, stream, stop, attach and approve.
4. Confirm refresh retains the current Agent conversation and /chat privacy.
5. Only after separate owner confirmation consider PR readiness/deployment.
   This branch is for review; no merge, deploy or Cloudflare config change.
