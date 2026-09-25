# Single-owner session continuity pilot

Status: **design only — no database or runtime binding exists yet**.

## Goal

Build a single-owner resume flow so the owner can return after a refresh, a network interruption, a Worker restart, or a fresh login, inspect the last confirmed work, and continue with the same conversation context. This is a persistence and recovery feature, not merely a longer-lived login cookie.

## Current verified baseline

- `src/index.js` verifies the six-hour signed `lsuperagen_trial_session` cookie before `/chat` and `/api/chat`.
- `src/firebase-worker.js` verifies Firebase ID tokens before issuing the same app cookie for email sign-in. Google/GitHub OAuth also issues this cookie.
- `assets/chat.js` keeps turns in a JavaScript array; a reload loses them. The Worker receives recent turns from that array and does not store them.
- `wrangler.toml` has an `ASSETS` binding and no durable database binding. No per-user conversation history, server-side session revocation, or resumable request ledger is implemented.

## Identity and data contract

The pilot uses **one existing email/password account**. Configure an owner allowlist by provider and immutable account ID in Worker environment configuration; do not compare display names or accept a claimed user ID from request JSON. Derive `owner_key` from the server-verified cookie as `${provider}:${id}`. A different login method may produce a different ID; account linking is outside this pilot. If the cookie expires, the owner signs in again and the same `owner_key` recovers the work.

| Field | Type | Source | Purpose |
|---|---|---|---|
| `owner_key` | string | verified signed cookie, server-side | Scope every database query to the owner. |
| `conversation_id` | UUID string | server | Locate a conversation. |
| `message_id` | UUID string | server | Identify an ordered user or assistant message. |
| `request_id` | UUID string | client, unique constraint server-side | Make repeated submits of one action safe to identify. |
| `state` | `accepted`, `completed`, `failed`, `unknown` | server ledger | Show what was saved and what needs inspection. |
| `goal`, `next_step` | strings, nullable | confirmed checkpoint | Explain where the owner stopped; never fabricate them from an incomplete response. |
| `created_at`, `updated_at` | UTC timestamp | server | Order and diagnose work. |

Store conversations, ordered messages, a request ledger, and optional confirmed checkpoints in one durable database. Index conversations by `(owner_key, updated_at)` and messages by `(conversation_id, sequence)`. Every read and write must check both `owner_key` and `conversation_id`. Do not save passwords, provider API keys, OAuth tokens, or a raw session cookie in the database.

## Proposed minimal runtime

Use one Cloudflare D1 database bound to the existing Worker as `CONTINUITY_DB`, with an explicit SQL migration. D1 is a proposed resource, **not yet created or approved**. Keep the existing Firebase login, signed cookie, and OpenAI route; do not migrate auth providers.

1. `GET /api/conversations`: list only the signed-in owner's conversations.
2. `POST /api/conversations`: create a conversation for that owner.
3. `GET /api/conversations/:id`: fetch its messages, ledger states, and confirmed checkpoint, always scoped to the owner.
4. `POST /api/conversations/:id/turns`: accept `{request_id, message}`. Atomically record the user message and an `accepted` ledger entry **before** calling the model. A duplicate `request_id` returns the existing state instead of inserting another turn.
5. Build the AI context from saved messages and the confirmed checkpoint. On a successful model result, save the assistant message and mark the request `completed` **before** returning success to the browser. On a known failure, mark it `failed` with a safe code.
6. On page reload, fetch the saved conversation. A stale `accepted` request is displayed as `unknown`; allow an explicit retry with a new request ID after the owner checks it. Do not claim that an interrupted provider call completed.
7. Save `goal` and `next_step` only when they were explicitly confirmed by the owner or returned in a completed, validated response. Inject the latest confirmed checkpoint on the next model request.

The current `/api/chat` can stay available while the pilot uses these new routes. Once the pilot passes end-to-end checks, the chat UI can switch to the durable flow. For this one-owner pilot, keep a small context window and a bounded number of saved turns to limit model costs.

## Acceptance checks

- Sign in as the allowed account, send two turns, reload the page, and see the same ordered conversation and checkpoint.
- Turn off mobile data after the request is accepted, return online, and see the server's saved state without a duplicate user message.
- Repeat the exact `request_id`; the database has one corresponding user message.
- Restart/cold-start the Worker; sign in again after the six-hour cookie expires; recover the same conversation.
- An unauthenticated request gets `401`; a different account gets `403` or `404` and cannot list or read the owner's content.
- If the model or Worker fails after acceptance, the UI shows `failed` or `unknown`, with no invented assistant response.
- Track rows read/written and storage. Stop the pilot if the chosen free-plan limits are approached.

## Practical limit

No online system can guarantee recovery of bytes that never reached durable storage. A provider may also finish a request just as the Worker fails, leaving its result unknown; retries can consume additional provider usage. The promise is to recover **confirmed saved state** and report uncertain state honestly, not "100% of all possible interruptions".

## Activation gate

Before creating the D1 resource or enabling the new routes in production, the owner must explicitly authorize one D1 database and its Worker binding, because `AGENTS.md` forbids creating D1/R2/KV resources without that authorization. Review the SQL migration, the one-account allowlist, and the cost limit first. Until then this file is a reviewable design, not a live feature.
