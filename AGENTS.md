# lsuperagent.docs

Last updated: 2026-10-01T09:48:48+07:00
Last update task: Remove unrelated project material and retired prototypes while preserving production dependencies.

Current owner instructions take priority. Read `README.md`, `wrangler.toml` and the latest commit before editing. Use verified source code as the current architecture; other projects and historical assistant summaries do not change this repository's runtime.

## Production

- Repository: `thanabartbb/lsuperagent.docs`; domain: `https://agents-sdk.space`.
- Cloudflare Workers Static Assets; Wrangler target `lsuperagent-docs`, matching the connected Cloudflare build. SDKSPACE remains the site name.
- Entry: `src/firebase-worker.js` delegates to `src/index.js`.
- Frontend: static HTML/CSS/JS. Shared colors and layout live in `assets/theme.css`, `assets/theme-modes.css`, `assets/layout.css` and `assets/editorial.css`.
- Email/password uses Firebase Identity Toolkit. Google/GitHub OAuth and six-hour signed sessions use the existing Worker handlers. GitHub login does not grant repository write access.
- `/` serves public product HTML/Markdown for anonymous requests; signed-in HTML requests go to `/home`. Successful login still defaults to `/home`. Public discovery and trust resources live in `src/public-resources.js`; private workspace routes retain authentication.
- `/home`, `/chat`, `/tools`, `/guide`, `/news`, `/exa`, `/keys`, `/docs` and docs fragments require a signed session. `/dev` and `/dev-code-drop` retain the owner Google gate. `/control` still goes to `/dev`.
- Chat/image/search run server-side. OpenAI is the default chat provider; Claude is optional through the existing `/api/chat` handler. Exa uses `POST /api/exa/search`.
- D1 binding `DB`, database `agentssdkspace`: chat history and usage quota; keep `migrations/` and account ownership checks. Attachments reach the model; history stores names only.
- `/v1/health` is public. `/v1/me`, `/v1/chat`, `/v1/image` require a signed `lsg_` SDK key created by `POST /api/sdk/keys`.
- `/guide` uses the pinned vendored `lsupergen-sdk/0.1.0`. Its code and license are production dependencies.
- `next-app/` is the owner's authorized migration toward this same site. Keep its production handoffs, build configuration and tests; it remains outside the current Worker asset upload until cutover.

## Changes and checks

Preserve runtime dependencies, integrations, auth checks, database schema, API contracts and production tests. Remove other-project materials and code with no production route/import/caller. Keep old route redirects where they preserve existing entry points. Do not alter UI colors, hosting, provider selection, secrets or storage as a side effect of cleanup.

Run `node --check src/index.js`, `node --check src/firebase-worker.js`, `node --test tests/*.test.mjs`, and relevant build/browser checks. Keep `.assetsignore` limited to browser files; source code, tests, CI, migrations, notes and the isolated migration app must not become public static assets.

Never commit secrets or signed URLs. Report the actual commit and checks; deployment is verified separately. Standing owner authorization permits validated fast-forward commits to `main` for the current requested work. Do not force-push, delete branches/data, change account permissions or modify secrets without an explicit instruction for that action.
