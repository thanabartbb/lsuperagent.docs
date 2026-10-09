# __PROJECT_NAME__ · SDKSPACE Cloudflare Worker Template

Working Cloudflare Worker server-to-server proxy to the current SDKSPACE `POST /v1/chat` endpoint. Does not fabricate AI responses. Protected with a separate application access token (this is not user authentication).

```sh
npm install
cp .env.example .dev.vars
# Set SDKSPACE_API_KEY (lsg_ signed key) and APP_ACCESS_TOKEN (20+ random chars)
npm run dev
curl http://localhost:8787/health
curl -X POST http://localhost:8787/chat -H 'content-type: application/json' -H "authorization: Bearer $APP_ACCESS_TOKEN" -d '{"message":"Hello SDKSPACE"}'
```

Create SDKSPACE_API_KEY at https://agents-sdk.space/keys. For **Cloudflare deployment**, set secrets on this Worker (`npx wrangler secret put SDKSPACE_API_KEY` and `npx wrangler secret put APP_ACCESS_TOKEN`) and then run `npm run deploy`. Never put secrets in `wrangler.toml`, source files, git, or client-side code. The `.dev.vars` file is ignored by Git.

`APP_ACCESS_TOKEN` is the secret that your *backend* caller passes to the Worker. Do not expose it in a public browser app. Add proper per-user authentication, rate limits and billing controls before serving public requests. The SDKSPACE account's quota applies to upstream requests. API docs: https://agents-sdk.space/developers.
