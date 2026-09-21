# Public AI Workspace Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `lsuperagent.docs` as a public, single-workspace AI product that can chat, write content, edit large code, research with clickable sources, read URLs, and generate downloadable images using the existing Cloudflare Worker and existing OpenAI connection.

**Architecture:** Keep one Cloudflare Worker and the current server-side OpenAI key connection. Text/code/writer/research/url work through the existing chat route with the Responses API; research and URL reading force real web search. Image generation uses the existing image route with the OpenAI Images API and GPT Image models, returning PNG base64 for browser download. The public shell is one full-screen workspace and hides developer/provider/runtime state.

**Tech Stack:** Cloudflare Worker ES modules, static HTML/CSS/JS, OpenAI Responses API with `web_search`, OpenAI Images API, Node built-in test runner, Playwright production smoke tests.

**Spec:** Current chat AUDIT CONTRACT (2026-09-21) is binding and supersedes older repo design docs where they conflict.

## Global Constraints

- Public canvas `#000000`, primary text `#FFFFFF`, interaction accent `#0FA3D9`.
- Root URL opens the main work surface immediately.
- Public UI contains end-user copy only: no endpoint paths, provider keys/names as readiness UI, runtime/debug/deployment state, codenames, or developer readiness.
- Do not expose secret values.
- Do not create a duplicate app/backend/config.
- Do not show unavailable capabilities; remove them from public navigation until verified.
- No placeholder/mock response may be reported as live.
- Existing `/dev` and auth internals remain isolated from public product flow unless a task explicitly needs them.
- Every production behavior gets a failing test first, then minimal implementation, then full test suite.

## Review Focus

- A 4,001+ character code request must no longer fail solely because of the old 4k limit; a bounded larger limit still protects cost.
- Research/URL modes must invoke real web search and return source metadata; a plain model-only answer is failure.
- Image mode must return real PNG bytes/base64 from the Images API; prompt-only text is failure.
- Public UI must not expose internal endpoint details, secret/readiness labels, provider readiness, owner/admin/dev links, planned/blocked badges, or development copy.
- Mobile and desktop must use the same capability set and provide understandable loading/success/error plus Copy/Download actions.

---

### Task 1: Regression tests for audited failures

**Files:**
- Create: `tests/public-product.test.mjs`

**Interfaces:**
- Consumes: current public files and Worker source.
- Produces: regression assertions that define the new public contract.

- [x] Write failing tests asserting root/public shell has no developer/runtime copy, chat has Copy action and six user modes, legacy tools page is not primary navigation, source supports research/url/image behavior, and large input limit exceeds 4,000.
- [x] Run `node --test tests/*.test.mjs` and confirm failures describe the audited gaps before implementation.

### Task 2: Real server capabilities on existing Worker

**Files:**
- Modify: `src/index.js`
- Test: `tests/public-product.test.mjs`
- Test: `tests/worker-runtime.test.mjs`

**Interfaces:**
- Consumes: existing server-side OpenAI key, optional model configuration, existing rate limiter and Worker runtime.
- Produces: text/code/writer/research/url results with citations and real image generation results.

- [x] Extend tool contract to `writer`, `research`, `url`, `code`; image is handled by the existing image route.
- [x] Raise bounded message capacity for large code while retaining validation and rate limits.
- [x] For `research` and `url`, add Responses web search with required tool usage and source inclusion.
- [x] Extract URL citation annotations and web-search sources into a normalized `sources` array without exposing internal IDs/secrets.
- [x] Replace planned image behavior with a POST handler using the OpenAI Images API; return MIME type, base64 image payload, and a safe filename.
- [x] Preserve provider/network error mapping and return user-safe messages.
- [x] Run unit/source test suite green.

### Task 3: Single public workspace UI

**Files:**
- Modify: `chat.html`
- Modify: `app.css`
- Modify: `index.html` / Worker root routing.
- Modify: `tools.html` only to keep the public product surface clean.
- Test: `tests/public-product.test.mjs`

**Interfaces:**
- Consumes: text and image response contracts.
- Produces: one end-user workspace with Chat, Code, Image, Research, Read URL, Write.

- [x] Remove provider selector, runtime/readiness/secret/output labels, endpoint labels, owner/admin/dev links and developer copy from public UI.
- [x] Add six end-user modes: Chat, Code, Image, Research, Read URL, Write.
- [x] Route text and image modes internally without displaying endpoint names.
- [x] Render loading, success, and plain-language error states.
- [x] Render research/url citations as clickable links using returned source metadata.
- [x] Add Copy on text answers and Download on generated images.
- [x] Add optional local code/text file import without adding storage/backend.
- [x] Enforce `#000000/#FFFFFF/#0FA3D9`, no horizontal overflow, keyboard focus, labels and live status messaging.
- [x] Run source tests green.

### Task 4: Root and public-surface hygiene

**Files:**
- Modify: `src/index.js`
- Modify: public HTML surfaces as needed.
- Test: `tests/public-product.test.mjs`

**Interfaces:**
- Produces: root goes directly to product, no public developer dashboard/navigation surface.

- [x] Make `/` reach the main workspace immediately without a marketing/developer landing step.
- [x] Remove legacy Docs/API/Guides/Changelog/Admin/Owner navigation from the primary product UI.
- [x] Keep non-product reference files out of primary public navigation.
- [x] Run full source suite green.

### Task 5: Build/runtime verification and checkpoint

**Interfaces:**
- Consumes: Cloudflare deployment from GitHub main.
- Produces: reversible commit checkpoint and evidence for the Audit Contract.

- [x] Run Worker/browser syntax checks and `node --test tests/*.test.mjs` in CI.
- [x] Verify no secret-like values were added and public source excludes internal readiness/debug copy.
- [x] Commit validated changes as reversible checkpoints.
- [x] Verify the target root serves the workspace.
- [ ] Run the final post-deploy service smoke for Chat, Write, >4k Code, Research+sources, Read URL+sources, and Image+downloadable PNG.
- [ ] Run the final production browser smoke for desktop and 393×852 mobile.
- [ ] Grade every required flow PASS/FAIL/BLOCKED using the Audit Contract evidence table.

Verification checkpoint 2026-09-21: text chat, writing, >4k code, Deep Research with 20 sources, and URL reading with a source already passed real Worker→OpenAI smoke. Image request schema was isolated as the remaining failure and has been changed to the direct Images API with green unit/runtime contract tests. This commit triggers the final post-deploy service and browser verification.
