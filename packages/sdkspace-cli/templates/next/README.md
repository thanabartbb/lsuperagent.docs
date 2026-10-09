# __PROJECT_NAME__ · SDKSPACE Next.js Template

Working Next.js starter that calls the current `POST /v1/chat` on `https://agents-sdk.space` from a server route. It uses **real SDKSPACE responses**, not mocked AI. Requires Node.js >= 20.9.

```sh
npm install
cp .env.example .env.local
# Edit .env.local and set both SDKSPACE_API_KEY and APP_ACCESS_TOKEN
npm run dev
```

1. Sign in at https://agents-sdk.space/keys and create a signed `lsg_` SDK key. Store it only in `.env.local` (`SDKSPACE_API_KEY`), never in client components or committed files.
2. Generate a random `APP_ACCESS_TOKEN` of 20+ characters, e.g. `openssl rand -hex 32`, and set it in `.env.local`.
3. Visit http://localhost:3000, enter `APP_ACCESS_TOKEN` in the access-token field and send a message.
4. For deployment, configure both values as **server-side secrets** on your hosting platform. The API key must never be prefixed `NEXT_PUBLIC_`.

This is a **single-user protected starter**, not a multi-user identity or production billing implementation. Before opening the app to a team or the public, replace the shared access token with per-user authentication, abuse prevention and appropriate usage accounting. The upstream SDKSPACE account's quota and signed SDK key still apply. The app has no client-side provider API calls or secret storage.

Available endpoints: `POST /api/chat` (requires bearer `APP_ACCESS_TOKEN`); SDKSPACE API docs: https://agents-sdk.space/developers.
