# SDKSPACE CLI

Prepared npm package for https://agents-sdk.space. Registry publication is pending an authorized npm account for the @sdkbank scope. Do not assume this package is already installed or published.

Requires Node.js 20+. Run directly with `node bin/sdkspace-cli.mjs health`, or install the package locally with `npm install -g ./packages/sdkspace-cli` and use `sdkspace health`.

Commands: `health`, `me`, `chat <message>`, `image <prompt>`.

Set `SDKSPACE_API_KEY` in your environment for protected commands. Create the signed key at https://agents-sdk.space/keys after signing in. Never put a provider key in this variable. Chat and image consume real account quota. The CLI does not automatically retry POST requests, save keys or print them.

API documentation: https://agents-sdk.space/developers

Release: an authorized maintainer must run `npm publish --access public` from this directory with the required npm authentication. Confirm package scope ownership first. Registry publication and a permissive license are product-owner decisions; no third-party code is bundled.
