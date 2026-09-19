# Clean chat UI

Updated: 2026-09-19T22:53:21+07:00

Goal: Build a full-screen chat so users can send a message without operational instructions occupying the conversation.

Scope: chat.html, assets/chat.css, assets/chat.js, assets/ls-mascot.png, index.html, the responsive-navigation exemption in src/index.js, README.md and AGENTS.md.

## Data contract

| Field | Type | Source | Required |
|---|---|---|---|
| surface | string: clean_chat_v2 | chat.html | yes |
| status | enum: ready | local implementation, not deployment | yes |
| last_updated_at | ISO datetime with timezone | this update | yes |
| evidence | string | source files and validation below | yes |
| secret_values_exposed | boolean: false | no credential UI or added credential data | yes |
| message | string, 1–4000 chars | user textarea | yes |
| mode | fast/research/creative/code | user selection | yes |
| provider | string: openai | existing route contract | yes |
| message/output | string | POST /api/chat response | on success |

## Design

Audience: users of agents-sdk.space. Primary action: send a message.
Hierarchy: compact brand/navigation, conversation, composer.
Locked: route policies, runtime contracts, existing palette, public docs.
Editable: homepage copy density, chat layout, icons, interaction disclosure.
Layout: dynamic viewport height, scrollable transcript, bottom composer, native modal dialogs.
Components: supplied mascot, inline SVG action icons, textarea, mode selector, feedback region.
Visual direction: near-black and graphite, silver/white type, existing blue chat interaction color; homepage daily themes retained.
Responsive: 393px mobile through desktop; safe-area padding and bounded textarea height.
Accessibility: labels, focus rings, Escape/focus handling via native dialog, live transcript, 44px targets, no animation dependency.
Negative constraints: no invented responses, live-status badges, new dependencies, secrets, or infrastructure.

## Acceptance criteria

- Given initial entry, then transcript is empty and no model request runs.
- Given a mode/menu button click, then the corresponding dialog opens; Escape closes it.
- Given a message, then exactly one POST targets /api/chat using the selected mode.
- Given an API failure or empty output, then feedback appears without an invented assistant reply, and the draft is restored.
- Given a pending request, then duplicate sends/new-chat actions cannot race it.
- Given cancellation, then waiting stops; this does not promise provider-side cancellation.
- Given mobile or desktop, then the composer remains within the viewport.
- Given /control, then redirect remains /dev.

## Limits

Existing backend processes each message independently. It does not search the web or route other providers. No production deployment or live provider output is claimed. wrangler.toml currently enters through src/firebase-worker.js, which delegates to src/index.js; this pre-existing discrepancy with the pinned entrypoint is not altered in this UI change.

## Validation

- PASS: node --test tests/*.test.mjs — 8 tests, including Worker navigation isolation, /control redirect, and unsupported-provider guard.
- PASS: JavaScript syntax checks and git diff --check.
- Observed: https://agents-sdk.space returned HTTP 200 before this change.
- BLOCKED: browser viewport/interaction QA; Chromium is absent and the download timed out. Responsive styles were inspected in source only.
- Not performed: live model request, production deployment.

Status: NEEDS REVISION until browser visual/interaction QA completes.
