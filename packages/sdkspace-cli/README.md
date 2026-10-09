# SDKSPACE CLI

Versioned, dependency-free command-line tooling for the **live SDKSPACE API** and two real project templates. Canonical source: `thanabartbb/lsuperagent.docs/packages/sdkspace-cli`.

Node.js >= 20.9 required. Registry publication of `@sdkbank/sdkspace-cli` has **not been confirmed**; do not assume the package is available on npm until the owner publishes it.

## Run from this repository

```sh
node bin/sdkspace-cli.mjs templates
node bin/sdkspace-cli.mjs init my-space --template next
node bin/sdkspace-cli.mjs init my-worker --template worker
node bin/sdkspace-cli.mjs health
```

After registry release:

```sh
npx @sdkbank/sdkspace-cli init my-space --template next
# or: npm install -g @sdkbank/sdkspace-cli && sdkspace init my-space --template worker
```

`next`: authenticated server-side Next.js 16 starter (`/api/chat` calls `/v1/chat`); `worker`: authenticated Cloudflare Worker server-to-server starter. Both have source code, configuration, local run instructions and env samples. **Neither includes an SDK key or model-provider secret**, sends traffic without configured credentials, or automatically installs packages/deploys infrastructure.

## Current API commands

```sh
sdkspace health
# Obtain an lsg_ key at https://agents-sdk.space/keys then set SDKSPACE_API_KEY privately
sdkspace me
sdkspace chat "Summarize the project"
sdkspace image "Minimal dark tech logo"
```

API calls target `https://agents-sdk.space` and send `SDKSPACE_API_KEY` only as a server-side Bearer token. For controlled local API tests use `SDKSPACE_API_BASE_URL=http://localhost:PORT`; non-local HTTP is rejected. Chat/image consume real quota; protected calls fail early if a signed key is missing. The CLI never retries POST requests or records credentials.

## Quality gate & publication

```sh
npm test
npm run pack:check
```

The GitHub code commit is **not** an npm registry release. Before publishing verify that the `@sdkbank` scope is controlled by the owner, adopt the intended license, authenticate to npm, and publish the approved version. Do not store npm tokens in Git. Do not merge unrelated chat UI PRs as part of this CLI release.
