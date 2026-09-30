# Next.js migration: integrated main and intro

Build the existing `/loading` surface as native React so the owner can begin migrating the site while preserving its current design and working authentication service.

## Run

Use Node.js 20.9 or newer (CI uses Node 22). From the repository root:

```sh
cd next-app
npm ci
npm run dev
```

Open http://localhost:3000/loading. Open `/` or `/loading` for the shared native React landing page. Open Workspace still uses the existing production origin to select login or home from its signed session.

```sh
npm run build
npx playwright install chromium
npm test
# Or serve the production build manually instead of running the tests:
npm start
```

Next.js, React and Playwright versions are pinned in package.json and package-lock.json. No environment secrets are needed for this public route.

## What is migrated

- `components/landing-page.jsx`: shared native JSX from the existing intro. `app/page.jsx` and `app/loading/page.jsx` render it without duplicating markup. All styles and color values remain unchanged.
- `app/layout.jsx`: metadata, document shell and ordered styles.
- `components/site-header.jsx` and `site-footer.jsx`: reusable structure.
- `components/theme-toggle.jsx`: React state with the existing normal/docs preference key.
- `components/code-window.jsx`: React copy interaction and existing syntax tokenization.
- `styles/`: the existing page styles copied as the migration starting point.
- `public/logo.svg`: existing brand asset. The page uses two brand logos.

There is no iframe or HTML-string injection. Existing static pages remain the production source until their own migration is complete; subsequent design edits must be reconciled between both versions during this transition.

## Route and data contract

| Field | Type | Source | Rule |
| --- | --- | --- | --- |
| heading, sections | static JSX/string | loading.html at d84645e | Existing editorial content |
| color_mode | normal or docs | localStorage: lsuperagent-color-mode | Validate stored value; default normal; black canvas |
| code | string | Existing quickstart example | Render as text; copy exactly; never execute |
| workspace links | HTTPS URL | Existing agents-sdk.space routes | Full navigation to the existing Worker |
| brand | SVG | Repository logo.svg | Public static asset |
| secret_values_exposed | boolean | No runtime credentials used | false |

`/` and `/loading` render the same public introduction. Protected workspace pages remain on the existing production origin. Explicit local `/home`, auth pages, `/chat`, `/tools`, `/guide`, `/keys`, `/news`, `/exa` and `/docs/:path*` redirect there with query strings preserved. `/blog` links to the real `/news` page; `/showcase` opens the existing feature grid at `/#features`. No fabricated articles, dead subscribe form, or Next.js/Vercel branding is imported from the supplied clone.

The Open Workspace action still targets `https://agents-sdk.space/`, whose signed session selects login or home. No cookies, API credentials or auth implementation are copied into the preview. Local `/api/chat` remains unavailable. No API proxy exists.

Keep this app on a separate preview origin until verified backend and OAuth integration supports a domain cutover. Production HTML, Worker routing and CSS are unchanged by this assembly.

Acceptance: both public landing routes render; protected routes redirect to the real backend; queries survive; styles remain byte-identical; copy and both saved color modes work on mobile and desktop; no secret values exposed.

## Verification

- Next.js production build passed locally.
- Root/intro and route handoff are covered by the Playwright desktop/mobile suite. Local `/api/chat` remains 404.
- Existing repository Node test files: 13/13 passed for this assembly.
- Playwright desktop/mobile suite covers theme persistence, copy behavior (clipboard stub only), horizontal overflow, console errors and workspace links.
- Assembly verification: production build passed; 2 HTTP route tests passed (desktop/mobile project configurations). CSS is byte-identical and shared intro JSX differs only in component name/import paths. Browser UI execution remains unverified because the Chromium download returned truncated archives; CI runs the full suite.
- No live AI request, deployment or domain cutover has been performed.

## Next migration stages

1. Verify the first route visually at mobile and desktop widths.
2. Move login/signup/reset UI and connect the existing auth contract on a reviewed preview origin; verify cookies, OAuth callback URLs and CSRF protections.
3. Migrate home, chat, tools, Exa and keys using reusable components and the existing server API contracts.
4. Migrate docs and guide, preserving SDK examples and authenticated access.
5. Choose and test the Next.js production runtime, migrate routing, then verify all public/protected/API paths before switching the domain.

Rollback for this first step is simply to stop using the preview: production HTML and Worker files were not modified. `.assetsignore` prevents the migration source, dependencies and build output from being uploaded as legacy static assets.
