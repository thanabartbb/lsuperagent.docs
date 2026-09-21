# Public AI Workspace Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `lsuperagent.docs` as a public, single-workspace AI product that can chat, write content, edit large code, research with clickable sources, read URLs, and generate downloadable images using the existing Cloudflare Worker and existing OpenAI Responses API connection.

**Architecture:** Keep one Cloudflare Worker and the current `OPENAI_API_KEY` server-side connection. Extend the existing public API behavior rather than add a second backend: text/code/writer/research/url work through `/api/chat`; image generation replaces the existing planned `/api/image` placeholder with a real Responses `image_generation` tool call. The public shell becomes one full-screen workspace and hides developer/provider/runtime state.

**Tech Stack:** Cloudflare Worker ES modules, static HTML/CSS/JS, OpenAI Responses API built-in `web_search` and `image_generation`, Node built-in test runner.

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
- Image mode must return real image bytes/base64 from an `image_generation_call`; prompt-only text is failure.
- Public UI must not expose `/api/*`, secret/readiness labels, provider readiness, owner/admin/dev links, planned/blocked badges, or development copy.
- Mobile and desktop must use the same capability set and provide understandable loading/success/error plus Copy/Download actions.

---

### Task 1: Regression tests for audited failures

**Files:**
- Create: `tests/public-product.test.mjs`

**Interfaces:**
- Consumes: current public files and Worker source.
- Produces: regression assertions that define the new public contract.

- [ ] Write failing tests asserting root/public shell has no developer/runtime copy, chat has Copy action and six user modes, legacy tools page is not primary navigation, source supports research/url/image behavior, and large input limit exceeds 4,000.
- [ ] Run `node --test tests/*.test.mjs` and confirm failures describe the audited gaps.

### Task 2: Real server capabilities on existing Worker

**Files:**
- Modify: `src/index.js`
- Test: `tests/public-product.test.mjs`

**Interfaces:**
- Consumes: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, existing rate limiter and Responses API connection.
- Produces: `/api/chat` text/code/writer/research/url results with citations; `/api/image` real image generation result.

- [ ] Extend tool contract to `writer`, `research`, `url`, `code`; image is handled by `/api/image`.
- [ ] Raise bounded message capacity for large code and increase output budget for code while retaining validation and rate limits.
- [ ] For `research` and `url`, add Responses `tools:[{type:'web_search'}]`, `tool_choice:'required'`, and `include:['web_search_call.action.sources']`.
- [ ] Extract URL citation annotations and web-search sources into a normalized `sources` array without exposing internal IDs/secrets.
- [ ] Replace planned `/api/image` behavior with a POST handler using Responses `image_generation` and force the image tool; return MIME type, base64 image payload, and a safe filename.
- [ ] Preserve existing provider/network/model error mapping and return user-safe messages.
- [ ] Run test suite green.

### Task 3: Single public workspace UI

**Files:**
- Modify: `chat.html`
- Modify: `app.css`
- Modify: `index.html` or Worker root asset routing so `/` opens the workspace immediately.
- Modify: `tools.html` only as needed to remove it from primary public product flow.
- Test: `tests/public-product.test.mjs`

**Interfaces:**
- Consumes: `/api/chat`, `/api/image` response contracts.
- Produces: one end-user workspace with Chat, Code, Image, Research, Read URL, Write.

- [ ] Remove provider selector, runtime/readiness/secret/output labels, endpoint labels, owner/admin/dev links and developer copy from public UI.
- [ ] Add six end-user modes: Chat, Code, Image, Research, Read URL, Write.
- [ ] Send text modes to `/api/chat` internally without displaying endpoint names; send Image to `/api/image` internally.
- [ ] Render loading, success, and plain-language error states.
- [ ] Render research/url citations as clickable links using returned citation/source metadata.
- [ ] Add Copy on text answers and Download on generated images.
- [ ] Add optional local code/text file import for large code without adding storage/backend.
- [ ] Ensure `#000000/#FFFFFF/#0FA3D9`, no horizontal overflow, keyboard focus, labels and `aria-live`.
- [ ] Run tests green.

### Task 4: Root and public-surface hygiene

**Files:**
- Modify: `src/index.js` only if routing is required.
- Modify: `index.html` / `tools.html` / injected public navigation as needed.
- Test: `tests/public-product.test.mjs`

**Interfaces:**
- Produces: root goes directly to product, no public developer dashboard/navigation surface.

- [ ] Make `/` reach the main workspace immediately without a marketing/developer landing step.
- [ ] Remove legacy public injected Docs/API/Guides/Changelog/Admin/Owner navigation from product pages.
- [ ] Keep non-product reference files reachable only by direct URL if retained, but not linked from primary product UI.
- [ ] Run full suite green.

### Task 5: Build/runtime verification and checkpoint

**Files:**
- Update repo contract docs only after runtime behavior is verified.

**Interfaces:**
- Consumes: Cloudflare build/deployment from GitHub main.
- Produces: reversible commit checkpoint and evidence table.

- [ ] Run `node --check` on Worker/browser JS where applicable and `node --test tests/*.test.mjs`.
- [ ] Verify no secret-like values were added and no public source contains internal readiness/debug copy.
- [ ] Commit validated changes as a reversible checkpoint.
- [ ] Verify Cloudflare target URL serves the new root/workspace on mobile and desktop.
- [ ] Exercise real text, code, research, URL and image flows UI→Worker→OpenAI→user. If tooling cannot issue a live POST, finish all source/runtime deployment verification then request exactly one manual user action as the final blocker.
- [ ] Grade every required flow PASS/FAIL/BLOCKED using the Audit Contract evidence table.
