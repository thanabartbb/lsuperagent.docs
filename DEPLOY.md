# Deploy lsuperagent.docs

Use Cloudflare Workers Static Assets. The configured Worker name is `lsuperagent-docs`; entrypoint is `src/firebase-worker.js` and assets binding is `ASSETS`. The connected Cloudflare build targets this existing Worker; SDKSPACE remains the site name.

```sh
node --test tests/*.test.mjs
npx wrangler deploy --dry-run
npx wrangler login
npx wrangler deploy
```

Deployment targets the configured Worker in the authenticated Cloudflare account. Keep its existing domain routing and secrets. Keep the existing database; this configuration change does not include a database migration.

D1 binding `DB` refers to the existing `agentssdkspace` database in `wrangler.toml`. Keep `migrations/0001_chat_history.sql` and `migrations/0002_usage_quota.sql`; apply a migration only when its schema change is intended. This cleanup changes no database schema.

`.assetsignore` includes browser HTML, CSS/JS, docs fragments, logo, vendor assets and static header/redirect configuration. Worker modules are bundled separately. Tests, migrations, CI, repository notes and `next-app/` are not public assets.

After deployment, verify `/loading`, the anonymous `/` → `/login` handoff, authenticated `/` → `/home`, chat history, provider availability, `/guide` and docs with the existing account. `scripts/live-smoke.mjs` and `browser-tests/product.spec.mjs` cover the production entry and user flows. A successful build or commit alone does not verify deployment.
