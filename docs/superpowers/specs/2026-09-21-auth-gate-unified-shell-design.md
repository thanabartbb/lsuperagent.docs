# Auth Gate + Unified App Shell Design

Date: 2026-09-21
Repo: `thanabartbb/lsuperagent.docs`
Target: `https://agents-sdk.space`
Status: approved design, implementation not yet applied

## Feature goal

Build one deterministic entry and navigation flow so visitors cannot bounce between legacy landing/docs/login surfaces, authenticated users always enter the AI workspace, and every primary surface shares one visual/auth contract.

## User-visible contract

### Entry routing

| Request | No valid session | Valid session |
|---|---|---|
| `/` | `302 -> /login` | `302 -> /chat` |
| `/home` | `302 -> /login` | `302 -> /chat` |
| `/index.html` | `302 -> /login` | `302 -> /chat` |
| `/login` / `/login.html` | render login | `302 -> /chat` |
| `/chat` / `/chat.html` | `302 -> /login?return_to=/chat` | render chat |
| `/tools` / `/tools.html` | `302 -> /login?return_to=/tools` | render tools |
| `/dev` | owner Google gate | owner workspace |
| `/auth/logout` | clear session then `302 -> /login?auth=logged_out` | same |

`/control -> /dev` remains unchanged.

### Authentication policy

- Remove the public Guest bypass from the login page.
- Keep the already-wired Google and GitHub authentication routes; do not add a new auth provider or storage layer.
- Preserve the existing signed session cookie contract and existing owner Google gate.
- `return_to` must remain same-origin path-only and use the existing safe-return validation.
- Logout must be visible from authenticated app navigation and must call the existing `/auth/logout` route.
- The authenticated header may show session identity (name/login/avatar/provider) only from `/api/auth/session`; it must not invent an AI/user identity.

## Primary application flow

```text
request / or /home
        |
        v
currentSession()
   |           |
 invalid      valid
   |           |
 /login      /chat
                |
                +--> /tools
                +--> /dev (owner gate)
                +--> /auth/logout
```

The current `Build with AI. Without the noise.` landing is no longer an entry surface. The source may remain temporarily during migration, but `/`, `/home`, and `/index.html` must never render it after this change.

## Navigation contract

### Logged out

Login surface contains only:

- `lsuperagen.docs` brand
- Google sign-in
- GitHub sign-in
- registration link only if the existing registration surface remains functional

No Guest-to-chat link. No owner/dev links. No docs/guides navigation.

### Logged in

Primary app shell contains:

- brand
- Chat
- Tools
- Owner workspace only where current policy allows the link
- compact authenticated profile state
- Logout

Mobile and desktop menus must expose the same route set and auth state. There must not be separate legacy menu definitions with different destinations.

## Visual contract

Primary surfaces use a single token set:

```css
--bg: #000000;
--text: #FFFFFF;
--accent: #0FA3D9;
```

Supporting neutrals may be derived from black/white for surfaces, borders, muted copy and disabled states, but no page-level alternate blue theme (`#63b3ff`, `#8ec6ff`) or `#060606` canvas may remain on the primary login/chat/tools shell.

Required visual behavior:

- exact black canvas (`#000000`)
- white primary text (`#FFFFFF`)
- `#0FA3D9` for interaction/focus/accent only
- same logo treatment, spacing scale, border language and mobile header across login/chat/tools
- no daily accent theme
- no docs-first/guide visual system in primary navigation

## Legacy surfaces

The following files/routes are not deleted in this task:

- `/guides`
- `/getting-started`
- legacy reference/API/changelog surfaces

They are removed from the primary navigation and must not participate in the root/login/chat flow. Their later retirement or restyling is a separate task.

## Components and responsibilities

### `src/index.js`

Single source of truth for route gating.

Responsibilities:

- normalize `/`, `/home`, `/index.html`, `/login`, `/chat`, `/tools`
- call the existing session verifier before serving protected primary surfaces
- redirect deterministically based on session state
- preserve `/dev` owner Google behavior and `/control -> /dev`
- preserve `/auth/logout`
- never expose secret values

### `login.html`

Single logged-out entry UI.

Responsibilities:

- use unified app tokens
- Google/GitHub auth actions only
- no Guest bypass
- no diagnostics or owner data

### `app.css`

Canonical primary-shell design tokens and shared header/menu/profile styles.

### `chat.html` and `tools.html`

Use the canonical shell and authenticated navigation. Session-derived profile/logout behavior should be shared rather than independently reimplemented where practical.

## Data contract

```yaml
fields:
  - name: authenticated
    type: boolean
    source: verified signed session cookie via currentSession()
    required: true
  - name: route
    type: string
    source: request pathname
    required: true
  - name: return_to
    type: safe_path_string
    source: validated query/path intent
    required: false
  - name: user.provider
    type: string
    source: verified session
    required: false
  - name: user.name
    type: string_or_null
    source: verified session
    required: false
  - name: user.login
    type: string_or_null
    source: verified session
    required: false
  - name: user.avatar
    type: url_or_null
    source: verified session
    required: false
  - name: secret_values_exposed
    type: boolean
    source: route/API contract
    required: true
    must_equal: false
```

## Error handling

- Invalid/expired sessions behave as logged out; do not render a partially authenticated shell.
- A failed login remains on `/login` with a non-secret status message.
- A failed session API request in an already-rendered authenticated shell must not fabricate profile data; show neutral authenticated UI or force a fresh gate on navigation.
- Owner gate failures retain the existing protected `/dev` response path.

## Acceptance criteria

```gherkin
Given no valid session exists
When GET /, /home, or /index.html is requested
Then the response redirects to /login

Given a valid non-owner session exists
When GET / or /home is requested
Then the response redirects to /chat

Given a valid session exists
When GET /login is requested
Then the response redirects to /chat

Given no valid session exists
When GET /chat or /tools is requested
Then the response redirects to /login with a safe return_to path

Given a valid session exists
When the primary mobile or desktop menu is opened
Then Chat, Tools, profile state, and Logout use the same route contract

Given Logout is activated
When /auth/logout completes
Then auth cookies are cleared and the user returns to /login

Given login/chat/tools are rendered
Then the canvas is #000000, primary text is #FFFFFF, and interaction accent is #0FA3D9
And no Guest bypass is present
And no legacy Guides/Getting Started link is present in the primary navigation
And /control still redirects to /dev
And /dev still uses the owner Google gate
And no secret/token/signed URL is committed
```

## Verification plan

1. Add/adjust Node route tests before implementation for root/home/login/chat/tools session permutations.
2. Add regression assertions that login has no Guest bypass and primary files do not contain legacy primary-theme tokens.
3. Run `node --check src/index.js` and relevant browser JS syntax checks.
4. Run `node --test tests/*.test.mjs`.
5. Run secret-pattern scan and `git diff --check` equivalent where available.
6. After Cloudflare build, verify the new version before promoting traffic.
7. Production smoke checks: `/`, `/home`, `/login`, `/chat`, `/tools`, `/auth/logout`, `/dev`, `/control`.

## Out of scope

- MCP implementation
- provider/model routing changes
- Firebase/Supabase migration or new auth bridge
- D1/R2/KV
- deleting legacy docs/reference files
- redesigning the actual chat conversation interaction beyond shared shell/auth state
- Cloudflare secret changes

## Negative constraints

- Do not change `/control` away from `/dev`.
- Do not weaken the owner Google `/dev` gate.
- Do not create a second session format.
- Do not add Guest access to protected workspace routes.
- Do not hardcode user/profile data.
- Do not restore daily color themes or alternate primary palettes.
- Do not claim production success until the active Cloudflare deployment is verified.