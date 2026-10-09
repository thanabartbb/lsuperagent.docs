# SDKSPACE self-hosted sandbox — Cloudflare Containers

Independent Cloudflare Worker handling **signed OpenAI Agents API webhooks** and
provisioning **one sandbox executor per session**. This does not deploy automatically,
does not alter the existing site's UI, and does not replace `agent-starter`.

## Security and access

- One OpenAI session ID maps to one named Durable Object / Container.
- An OpenAI Standard Webhooks signature is required on `POST /webhook`.
- Webhook payload is only a hint: retrieve the session from OpenAI and check
  `OPENAI_AGENT_ID` before provisioning.
- Only the restricted **environment key** enters a container as `CODEX_API_KEY`.
  Your application key is not passed to the container.
- Executor remote URL is used unchanged but restricted to HTTPS api.openai.com.
- Container filesystem is **ephemeral** and not a persistent user file store.
- Container network is enabled for outbound API/WebSocket; agent-generated commands
  also have outbound access. Harden egress before allowing untrusted tenants.
- `DELETE /executors/:session_id` requires a separate strong bearer cleanup secret.
- `GET /health` reports only configuration booleans.

## Prerequisites

Cloudflare Workers Paid with Containers enabled, Node 24+, Docker (or use
Cloudflare Workers Builds), OpenAI Agents API project access and three secrets:

1. `OPENAI_API_KEY`: application/controller key with Agents read.
2. `OPENAI_EXECUTOR_API_KEY`: **restricted** environment key for Codex,
   belonging to the same organization/project/owner.
3. `OPENAI_WEBHOOK_SECRET`: signing secret received during webhook registration.

Also set `OPENAI_AGENT_ID` to a real reusable agent ID and
`EXECUTOR_CLIENT_SECRET` to a randomly generated cleanup secret.

## Manual deployment (requires a separate future approval)

```sh
cd services/sdkspace-sandbox
npm install
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put OPENAI_EXECUTOR_API_KEY
npx wrangler secret put OPENAI_AGENT_ID
npx wrangler secret put EXECUTOR_CLIENT_SECRET
# Webhook secret is added once the endpoint is registered:
npx wrangler deploy
```

Register `https://<sandbox-worker>.workers.dev/webhook` in the **same OpenAI
project**; subscribe to `agent.session.created`,
`agent.session.action_required`, `agent.session.in_progress`,
`agent.session.idle` and `agent.session.failed`. Add the real signed
`OPENAI_WEBHOOK_SECRET` via `wrangler secret put` after registration.

`GET /health` must return `configured: true` and
`webhook_configured: true`. Never paste secret values in issue comments or logs.

## Website backend

The root Worker retains its original `wrangler.toml`, `/chat`, authentication,
chat/image routes, and design. An opt-in, **owner-Google-only** backend is added
at `/api/sandbox/sessions`; it starts closed until
`SANDBOX_ENABLED=true`, `OPENAI_API_KEY`, `OPENAI_AGENT_ID`, the owner
allowlist and the D1 migration are configured on the **root** Worker.

```sh
# Explicitly approved database step, NOT performed by this branch:
npx wrangler d1 migrations apply agentssdkspace --remote
```

Example same-origin requests after login (browser or authenticated client):

```js
const json = async (path, method, body, headers = {}) => {
  const response = await fetch(path, {
    method, credentials: "same-origin",
    headers: { "content-type": "application/json", ...headers },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
const created = await json("/api/sandbox/sessions", "POST", {});
const sid = created.session_id;
// Start SSE GET /api/sandbox/sessions/:sid/events before submitting input.
const key = crypto.randomUUID();
await json("/api/sandbox/sessions/" + sid + "/messages", "POST",
  { message: "Write hello to /workspace/hello.txt and read it." },
  { "Idempotency-Key": key });
```

GET `/api/sandbox/sessions` lists sessions owned by the signed-in user;
GET `/:id` retrieves status; GET `/:id/items` fetches saved outputs;
GET `/:id/events` streams session events; POST `/:id/cancel` requests
turn cancellation. Use the **same** Idempotency-Key when retrying a message.

**No deletion endpoint is exposed on the public website yet.** Administrative
session deletion must explicitly clean up both OpenAI state and the Container.

## MCP configuration

For the existing **read-only public MCP discovery endpoint** on SDKSPACE,
a valid HTTP MCP client configuration is:

```json
{
  "agentssdkspace": {
    "type": "http",
    "url": "https://agents-sdk.space/mcp"
  }
}
```

`mcp.agents-sdk.space.mcp` is not an absolute URL and is not currently
configured here as a new hostname. This public MCP endpoint does **not**
grant access to private sandbox commands or user files.

## Acceptance before any deploy

- Validate standard-webhooks HMAC, replay-window, owner allowlist and D1 ownership.
- Run root Node tests plus `tests/self-hosted-sandbox.test.mjs`.
- Build the image as linux/amd64 and verify `codex exec-server --help`.
- Create a real test session and confirm `environment.connected` in SSE.
- Verify 2 accounts cannot see each other's sessions; no secrets in responses.
- Verify reconnect, interrupt, cleanup, and expected cost ceilings.
- Deploy sandbox Worker **separately first**. Only then enable root Worker opt-in.
- Do not merge into main or deploy without explicit follow-up approval.

Sources: https://developers.openai.com/api/docs/guides/agents-api/environments/providers/cloudflare
https://developers.cloudflare.com/sandbox/coding-agents/openai-agents-api/
