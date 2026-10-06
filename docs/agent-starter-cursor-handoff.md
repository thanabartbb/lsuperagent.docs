# Cursor handoff — SDKSPACE ↔ Agent Starter

Status: bridge prepared on SDKSPACE side. Do not switch the production `/chat` UI until the acceptance checks below pass.

## Existing runtimes

### SDKSPACE
- Production origin: `https://agents-sdk.space`
- Worker: `lsuperagent-docs`
- Entry: `src/firebase-worker.js` → `src/index.js`
- Existing production chat remains `POST /api/chat` and is intentionally unchanged.

### Agent Starter
The Cursor-exported source shows:
- Worker: `agent-starter`
- Entry: `src/server.ts`
- Durable Object class: `ChatAgent extends AIChatAgent<Env>`
- Frontend: `useAgent<ChatAgent>({ agent: "ChatAgent" })` + `useAgentChat({ agent })`
- Current model: Workers AI `@cf/moonshotai/kimi-k2.7-code`
- The starter currently omits `name`, which means the Cloudflare Agents client would use the shared `default` instance.
- `onStart()` tries to add `https://agents-sdk.space/mcp` and catches connection failure.

At handoff time, `https://agents-sdk.space/mcp` returns 404. This bridge does not fake an MCP server. ChatAgent can still run because the MCP connect is inside a try/catch.

## SDKSPACE bridge that is ready

`wrangler.toml` now declares an internal Service Binding:

```toml
[[services]]
binding = "AGENT_STARTER"
service = "agent-starter"
```

Cloudflare keeps this Worker-to-Worker hop internal; the browser does not need to call the `workers.dev` hostname.

### 1. Runtime config

Signed-in clients call:

```http
GET /api/agent-runtime/config
```

Response shape:

```json
{
  "ok": true,
  "transport": "cloudflare-agents",
  "agent": "ChatAgent",
  "name": "u_<opaque-per-user-id>",
  "path": "/agents",
  "connected": true,
  "service_binding": "AGENT_STARTER",
  "legacy_chat": "/api/chat"
}
```

The `name` is an HMAC-derived opaque value from the signed SDKSPACE session. It is stable for that user while the auth signing secret is unchanged and does not expose email/provider ID.

### 2. Agent WebSocket/HTTP proxy

SDKSPACE accepts only the signed-in user's assigned ChatAgent instance:

```text
/agents/chat-agent/<name>
/agents/chat-agent/<name>/...
```

Requests are forwarded through `env.AGENT_STARTER.fetch(...)`.

Safety rules:
- SDKSPACE login is required.
- `/agents/chat-agent/default` is rejected.
- Any instance name other than the value from `/api/agent-runtime/config` is rejected.
- SDKSPACE `cookie` and `authorization` headers are removed before forwarding.
- WebSocket/Agent headers and the request path/query are otherwise preserved.
- If the Service Binding is unavailable, the route fails closed with HTTP 503.

### 3. OAuth callback forwarding

`/oauth/*` is also forwarded to Agent Starter for Agents/MCP OAuth popup callbacks. It requires the SDKSPACE signed session and strips the SDKSPACE auth cookie before the downstream call.

## Cursor task — connect the visible chat

Do not call `https://agent-starter.thanabartb.workers.dev` directly from the browser.

1. Keep `ChatAgent`, its Durable Object binding, SQLite migration, scheduling, tracing, tools, and existing secrets unchanged.
2. In the SDKSPACE chat client, load `GET /api/agent-runtime/config` with same-origin credentials after login.
3. Do not use the Agent default instance.
4. Initialize the Cloudflare Agents client with the config values. The important part is:
   ```tsx
   const runtime = await fetch("/api/agent-runtime/config", {
     credentials: "same-origin",
     cache: "no-store"
   }).then((r) => r.json());

   const agent = useAgent<ChatAgent>({
     agent: runtime.agent,
     name: runtime.name
   });

   const chat = useAgentChat({ agent });
   ```
   When the client is served from `agents-sdk.space`, the default same-origin host/path is the intended route. If Cursor introduces an explicit host/path, keep it on `agents-sdk.space` and `/agents`.
5. Preserve `onMcpUpdate`, approval UI, scheduled-task notifications, reconnect behavior, image input, and `useAgentChat` streaming.
6. Keep the existing SDKSPACE `POST /api/chat` code in place as fallback until the Agent path is verified in production.
7. Do not copy SDKSPACE cookies, API keys, Cloudflare secrets, or provider secrets into Agent Starter source or browser code.
8. Do not add `name: "default"` anywhere in the production client.
9. Treat MCP as a separate follow-up. The current SDKSPACE `/mcp` endpoint is not implemented yet; the Agent's existing try/catch means this must not block chat cutover.

## Acceptance checks before replacing the old chat transport

- Signed-out request to `/api/agent-runtime/config` is rejected.
- Two different SDKSPACE users receive different opaque Agent instance names.
- One user cannot open another user's Agent instance through the SDKSPACE proxy.
- Agent WebSocket connects through `agents-sdk.space`, not the `workers.dev` hostname.
- A message streams from ChatAgent and persists after reconnect/reload.
- Approval tools still require approval.
- Scheduled-task broadcast still reaches the client.
- Sign-out prevents subsequent Agent connections.
- SDKSPACE session cookie is not forwarded to Agent Starter.
- Old `POST /api/chat` still works until the final cutover.
- Failure of `https://agents-sdk.space/mcp` does not prevent normal ChatAgent replies.

## Cutover rule

Only after all checks pass:
- switch the visible `/chat` composer from the legacy `POST /api/chat` transport to `useAgentChat`;
- keep a rollback path to the existing transport for the first production release;
- do not change the Agent Durable Object migration or delete old D1 chat data during this cutover.
