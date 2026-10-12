# SDKSPACE: Cloudflare workflow brief

Owner requirements captured on 12 October 2026. This is a specification for a follow-up service implementation, not an active resource configuration. Canonical product: https://agents-sdk.space. Related platform: https://devstack.bid.

## Required automated workflows

1. R2 Event Triggering: automatically process object uploads to R2.
2. AI Vector Embedding: generate embeddings using Workers AI and store vectors in Vectorize.
3. Email Lifecycle Triggers: use an email service to respond to user lifecycle events.

Use the current production entrypoint and preserve existing routing, authentication, provider contracts and data. Main currently uses `wrangler.toml`, Worker `lsuperagent-docs`, entrypoint `src/firebase-worker.js`, D1 `DB`, and the external `ChatAgent` on `agent-starter`. An empty workflow array does not enable a workflow. Do not add a competing `wrangler.jsonc` beside the active TOML or rename a deployed Worker as a documentation side effect.

The owner's JSONC shape is retained as documentation:

```jsonc
{
  "workflows": [
    // กำหนดค่า Workflows ที่นี่
  ]
}
```

Actual entries require a workflow name, binding, exported class and any selected script ownership. Select those identifiers with the owner before provisioning.

## Placement settings

| Field | Type | Owner requirement |
| --- | --- | --- |
| `host` | string | Hostname and port of a single-homed layer 4 service, e.g. `my_database_host.com:5432`; place the Worker near that service. |
| `hostname` | string | Hostname of a single-homed layer 7 service, e.g. `my_api_server.com`; place the Worker near that service. |

These fields belong under `placement`. Examples are not production destinations. Verify the deployed Wrangler version/schema before applying a placement mode or combining options.

## Durable Object exports

The top-level `exports` map is keyed by exported Durable Object class name. Retain all supplied lifecycle fields:

| Field | Type | Required / condition | Meaning |
| --- | --- | --- | --- |
| `type` | string | Required | `durable-object` for a Durable Object class. |
| `state` | string | Optional | `created` (default live class), `deleted`, `renamed`, `transferred`, or `expecting-transfer`. |
| `storage` | string | Required when `created` or `expecting-transfer` | `sqlite` is recommended and required for new namespaces; `legacy-kv` is only for existing KV-backed namespaces. |
| `renamed_to` | string | Required when `renamed` | Destination class, also present as a live entry in the same exports map. |
| `transferred_to` | string | Required when `transferred` | Destination Worker receiving the namespace. |
| `transfer_from` | string | Required when `expecting-transfer` | Source Worker transferring the namespace. |
| `container` | string | Optional | Matches a top-level containers entry `name`; requires sqlite and state `created` or `expecting-transfer`. Use instead of class_name in the container entry. |

Do not use declarative `exports` and legacy `migrations` together. Do not create, rename, delete or transfer the existing `ChatAgent` namespace in this task. It is supplied by a different Worker, not exported by the docs entrypoint.

## Hyperdrive

Hyperdrive connects a Worker to a Postgres database. Required configuration:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `binding` | string | Yes | Binding name used by Worker code. |
| `id` | string | Yes | Identifier of the actual Hyperdrive configuration. |

No production Postgres destination or Hyperdrive configuration ID was supplied. Blogs use versioned editorial content in Git and do not require a new database.

## Documentation/navigation index

Keep the owner's information hierarchy. Map entries to actual pages or primary reference URLs; do not invent product features or dead links.

| Group | Entries | Current reference / implementation |
| --- | --- | --- |
| Get started | Overview | `/about`, `/home` |
| Get started | API | Public `/developers`, `/openapi.json`; protected SDK APIs keep their contracts. |
| Get started | Agent configuration | Existing `/docs/client` and `/guide` require a session. A dedicated agent-configuration page is not present in the current docs index. |
| Get started | Directory | Article directory `/blogs`; a separate agent/tool registry is not implemented by this change. |
| Get started | Changelog | OpenAI API changelog; repo commits for SDKSPACE changes. |
| Get started | Support | `/contact` and GitHub issues. |
| Developer tools | Cloudflare CLI | Official Wrangler documentation. |
| Developer tools | Build | Existing Worker build/check flow. |
| Developer tools | Protect and connect | Existing auth and bindings; official Cloudflare security/connection references. |
| Manage and observe | Observability | Current Wrangler observability configuration; verify dashboard state separately. |
| Manage and observe | Analytics | Official Workers analytics reference; no new analytics system claimed. |
| Manage and observe | Web analytics | Official Cloudflare Web Analytics; no new beacon installed. |
| Manage and observe | Log Explorer | Official log/observability references; account access needed for real logs. |
| Manage and observe | Health check | Existing public `/v1/health`; does not make a provider generation request. |

## Implementation order and acceptance criteria

1. Choose one R2 bucket/prefix, allowed file types, maximum size, ownership rules, Queue and Workflow names. Provision an isolated preview pipeline.
2. Implement R2 object-create → Queue consumer → Workflow with deduplication by object version/event, bounded reads, retry policy and dead-letter handling.
3. Select embedding model and matching Vectorize dimensions/metric. Chunk text, upsert with deterministic IDs, handle replacement/deletion and enforce account ownership on retrieval.
4. Select lifecycle events, email provider, verified sender and consent/unsubscribe requirements. Trigger transactionally and deduplicate sends; never attach this to a public endpoint without verification.
5. Evaluate Hyperdrive only when a real Postgres requirement exists; preserve the existing D1 tables otherwise.

Preview checks must cover duplicate notifications, unsupported/oversized uploads, transient failures, deletes/overwrites, cross-account access and duplicate email suppression. Real embedding and email tests require the configured resources and service authorization. Unit mocks alone cannot prove service readiness. Production provisioning/deployment is a separate step.

## Verified references

- https://developers.cloudflare.com/r2/buckets/event-notifications/
- https://developers.cloudflare.com/workflows/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- https://developers.cloudflare.com/vectorize/get-started/embeddings/
- https://developers.cloudflare.com/hyperdrive/

The references were checked while preparing this brief. Validate them again against the actual Wrangler schema and account services when implementation starts.
