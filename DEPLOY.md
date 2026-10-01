# Deploy lsuperagent.docs

Use the existing Cloudflare Worker, not a new static Pages project. The configured Worker is `lsuperagent-docs`; entrypoint is `src/firebase-worker.js` and assets binding is `ASSETS`.

```sh
node --test tests/*.test.mjs
npx wrangler deploy --dry-run
npx wrangler login
npx wrangler deploy
```

Deployment updates the Worker in the authenticated Cloudflare account. Keep its existing domain routing and secrets. A new project, account, database or domain is not created by these instructions.

D1 binding `DB` refers to the existing `agentssdkspace` database in `wrangler.toml`. Keep `migrations/0001_chat_history.sql` and `migrations/0002_usage_quota.sql`; apply a migration only when its schema change is intended. This cleanup changes no database schema.

`.assetsignore` includes browser HTML, CSS/JS, docs fragments, logo, vendor assets and static header/redirect configuration. Worker modules are bundled separately. Tests, migrations, CI, repository notes and `next-app/` are not public assets.

After deployment, verify `/loading`, the anonymous `/` → `/login` handoff, authenticated `/` → `/home`, chat history, provider availability, `/guide` and docs with the existing account. `scripts/live-smoke.mjs` and `browser-tests/product.spec.mjs` cover the production entry and user flows. A successful build or commit alone does not verify deployment.
