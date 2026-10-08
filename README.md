# LSUPERAGENT

Production source for `https://agents-sdk.space` in `thanabartbb/lsuperagent.docs`.

Last updated: 2026-10-01T09:48:48+07:00
Last update task: Remove unrelated project material and retired prototypes while preserving production dependencies.

## Runtime

`wrangler.toml` targets Worker `lsuperagent-docs` from `src/firebase-worker.js`, which handles Firebase email authentication and delegates to `src/index.js` for signed sessions, Google/GitHub OAuth, chat, image generation, Exa, SDK APIs, quota and page routing. The Cloudflare build is connected to this Worker. SDKSPACE remains the site name.

| Surface | Route / source |
| --- | --- |
| Public authentication | `/login`, `/signup`, `/forgot-password`; `firebase-auth.js` |
| Public introduction | `/loading`; session-aware action goes through `/` |
| Signed-in home | `/home`; successful login and authenticated root default here |
| Chat / code / research / URL / writing | `/chat`, `assets/chat.js`, `POST /api/chat` |
| Image generation | `POST /api/image` |
| Tools | `/tools` |
| Search | `/exa`, `POST /api/exa/search`; server-side `EXA_API_KEY` |
| AI news | `/news`, `assets/news.js`, `src/feeds.js`, `/api/feed` |
| SDK playground and keys | `/guide`, `/keys`, `POST /api/sdk/keys` |
| SDK client API | `/v1/health`, `/v1/me`, `/v1/chat`, `/v1/image` |
| Documentation | `/docs/:page`, `/docs-content/:slug`, `assets/docs-nav.js` |
| Owner diagnostics / code preparation | `/dev`, `/dev-code-drop`; owner Google gate |

The workspace, docs and AI APIs require the existing signed session. SDK APIs except health require the signed `lsg_` Bearer token. Google/GitHub callbacks remain `/auth/google/callback` and `/auth/github/callback`. GitHub login is identity-only (`read:user user:email`); no repository write token is stored. Session cookies expire after six hours.

GitHub code tools use a separate GitHub App OAuth flow at `/api/github/connect` with callback `/auth/github/connect/callback`. Its expiring user token is AES-GCM encrypted in D1 and is never returned to the browser. Configure `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and a random `GITHUB_TOKEN_ENCRYPTION_KEY` as Worker secrets. Apply migration `0003_github_app.sql` before enabling it. In code mode, the model can propose creating a private repository or committing a bounded set of files. The user sees the proposal and must explicitly approve it before an authenticated, same-origin request performs the action. Commits are restricted to the connected GitHub login and validated file paths.

OpenAI is the default chat provider; Claude is an optional choice through the same `/api/chat` route when configured. The browser calls same-origin server endpoints and never receives provider secrets. Answers support NDJSON streaming. Attached images/PDFs reach the model but are not stored as files.

## Data and quota

D1 `agentssdkspace` is bound as `DB`. `src/chat-store.js` enforces per-account history ownership; `src/quota.js` and `migrations/` implement daily usage accounting. Limits are 50 chat units and 10 images per account per day, with a 2000-unit site cap and reset at 00:00 Asia/Bangkok; owner exemption remains. A separate per-isolate burst guard limits 10 requests per 10 minutes. SDK keys are stateless signed tokens lasting 30 days.

## Frontend and SDK

Keep the current colors and layout in `assets/theme.css`, `assets/theme-modes.css`, `assets/layout.css` and `assets/editorial.css`. Normal mode follows the blue-black SDKSPACE reference palette; Docs mode keeps its opaque black canvas and muted-purple accent. Code rendering and docs navigation use the existing assets.

`/guide` uses vendored `lsupergen-sdk/0.1.0`; preserve its build, integrity tests and license. `npmjs.sdk-space` is a separate package linked from the introduction, not this API client.

`next-app/` is the authorized migration toward this same production site. It keeps existing production auth/workspace route handoffs; current production still runs the Worker/static frontend. No cutover is performed by this cleanup.

## Verify and deploy

```sh
node --check src/index.js
node --check src/firebase-worker.js
node --test tests/*.test.mjs
npx wrangler deploy --dry-run
npx wrangler deploy
```

See `DEPLOY.md` and `FIREBASE_SETUP.md` for the existing deployment/auth setup. `.assetsignore` uploads only browser files. Worker modules are bundled through the configured entrypoint; CI, tests, source, migrations, notes and `next-app/` remain in the repository without being published as static assets.

Legacy page URLs keep their existing redirects. The retired control-plane reference redirects to `/dev`; old provider-status links go to the signed-in `/api/chat-providers` response. The unrelated lab documentation, Python harness, static status snapshots, unimported feature prototypes, stale archive and local-only Zapier configuration panel have been removed. Production deployment requires a separate live check.

## Public agent discovery (2026-10-08)

Anonymous `/` now serves product information in raw HTML or Markdown through Accept negotiation. Signed-in HTML visitors still go to `/home`. Public `/developers`, `/about`, `/contact`, `/privacy`, `/openapi.json`, `/tools.json`, `/llms.txt`, `/robots.txt`, `/sitemap.xml` and `/sdkspace-cli.mjs` are generated by `src/public-resources.js`. Workspace, user data and generation endpoints keep existing authentication. API keys and provider credentials are never embedded in these resources. Node package metadata declares ES modules for repeatable checks.

The downloadable CLI uses Node 20+ with no dependencies. Function definitions require a host HTTP dispatcher and a signed SDK key; they do not imply a public MCP server. Unknown `/api/` routes return JSON 404. Generation burst headers now expose RateLimit-* alongside existing quota headers.

Cloudflare Access/WAF challenges are upstream of this Worker and require separate account-level review. Do not disable protection globally to improve a scan. Brand/search discoverability and scanner scores must be verified after publication; locally passing tests do not guarantee all external checks pass.
