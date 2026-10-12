# SDKSPACE Home frontend — 2026-10-12

Base: origin/main 3996afc. Branch: feat/home-material-20261012.
Scope: Home presentation and a navigation Escape fix. Production is unchanged.

## Implemented
- Home-scoped role tokens and responsive layout: full viewport shell, one content column below 840px, hero/cards in two columns above it; feature cards stack below 480px.
- Self-hosted Space Grotesk and Noto Sans Thai, weights 400–700, downloaded from Google Fonts with both SIL OFL licenses. No third-party font requests at runtime.
- More readable text, 48px navigation/primary control targets, visible focus outlines, semantic section headings, and reduced-motion decoration.
- Existing logo, page destinations, disabled Coming Soon status and auth/API behavior preserved.
- Escape closes only an open navigation, restores focus, and does not steal focus when navigation is already closed.

## Verification
- Worker entrypoints and navigation JavaScript syntax: passed.
- node --test tests/*.test.mjs: 175 passed, 0 failed.
- git diff --check: passed.
- Calculated foreground/background contrast: normal secondary 10.53:1, normal accent 10.72:1, Docs secondary 9.59:1, Docs accent 10.31:1. This does not verify all rendered backgrounds, hover states or the complete page's accessibility.
- Browser regression spec added for 320, 393, 600, 839, 840 and 1280px, both themes, menu keyboard behavior, overflow and reduced motion.
- Browser spec NOT RUN: the cloud browser could not reach the local preview server; Chromium download returned an invalid archive. Visual layout, actual font rendering and browser interactions remain unverified.

## Review / next step
Run npx playwright test browser-tests/home-layout.spec.mjs in an environment with @playwright/test and Chromium installed. Inspect Home at phone and desktop widths in both themes, including copy-code, then review before any production publication.
References: https://m3.material.io/ and https://fonts.google.com/specimen/Space+Grotesk
devstack.bid is deferred.
