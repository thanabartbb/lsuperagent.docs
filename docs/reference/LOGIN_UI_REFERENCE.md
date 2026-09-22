# Public login UI reference

Canonical visual target for `login.html` on https://agents-sdk.space.

| Field | Value |
|---|---|
| surface | `login.html` |
| status | docs |
| source_path | `docs/reference/public-login-reference.png` |
| route | `/login` (entry via `/` when no session) |
| secret_values_exposed | false |

## Locked copy (regression: `tests/login-visual.test.mjs`)

- Brand: `lsuperagen.docs`, tagline `YOUR AI WORKSPACE`
- Heading: `เริ่มต้นใช้งาน`
- Subcopy: coding / image skills + `lsuperagent.docs`
- Fields: `อีเมล`, `รหัสผ่าน`, `ลืมรหัสผ่าน?`, `เข้าสู่ระบบ`
- OAuth row: Google, GitHub, Gmail (Gmail → same Google OAuth route)
- Footer: `สมัครใช้งาน` → `/signup`
- No Guest / ทดลองแชท bypass

## Tokens

- Canvas `#000000`, text `#FFFFFF`, accent `#0FA3D9` / `#10b8ff`

If the owner supplies a newer spec file, replace `public-login-reference.png` and update this note with commit evidence.
