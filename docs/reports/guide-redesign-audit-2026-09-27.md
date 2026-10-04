# Guide redesign audit — 2026-09-27

## Scope

ตรวจหน้า `/guide` ของ `thanabartbb/lsuperagent.docs` เทียบกับ repository contract, commit history, tests ที่บันทึกไว้ และพฤติกรรมของ production route

## ข้อเท็จจริงที่ยืนยันแล้ว

- Production `https://agents-sdk.space/guide` ตอบกลับโดยส่งผู้ใช้ที่ยังไม่เข้าสู่ระบบไป `/login?return_to=%2Fguide`.
- พฤติกรรมนี้ตรงกับ `AGENTS.md`, `README.md`, `LSUPERAGENT.md`, `assets/guide.js` และ `tests/sdk-guide.test.mjs`: `/guide` เป็น route ที่ต้องมี signed session.
- `/guide` เป็น Playground ของ `lsupergen-sdk@0.1.0`; ไม่ใช่แพ็กเกจ `npmjs.sdk-space@1.0.1`. ขอบเขตนี้ถูกบันทึกชัดเจนใน commit `c3c913218d4528a426213a5409d9f81fd063ff10`.
- การย้ายการสร้าง API key ไป `/keys` และให้ Guide รับเฉพาะ key ที่ผู้ใช้วางเองอยู่ใน commit `0194a9fb46cd5cad12f354c5dd9d95d89e85f08d`.
- commit `9e089194e15f6af425056a8d65db3aa46673b237` บันทึกว่า existing Node tests ผ่าน 41 รายการ แต่ deployed visual verification ยัง pending.
- commit ล่าสุดก่อน audit (`c3c913218d4528a426213a5409d9f81fd063ff10`) ไม่มี GitHub Actions workflow run หรือ commit status ที่รายงานผ่าน GitHub API.

## ข้อผิดพลาดที่พบและแก้แล้ว

ปุ่ม `button.run` และ `button.primary` ใช้พื้นหลัง copper `#e9a077` กับตัวอักษรขาว `#ffffff` มี contrast ประมาณ 2.15:1 ซึ่งต่ำเกินไปสำหรับข้อความปกติ

แก้ใน `guide.html` ให้ใช้ตัวอักษร `#0d0e18`; contrast เพิ่มเป็นประมาณ 8.93:1.

Commit: `97e15ba997baf89e6a7542bb413cc266edf26a5e`

## ขั้นตอนที่ทำ

1. ตรวจ commit ล่าสุดและ commit ที่เกี่ยวข้องกับ Guide, layout, key flow และ palette.
2. ตรวจ source ของ `guide.html`, `assets/guide.js`, code-window assets และ repository contracts.
3. เปิด production route แบบไม่เข้าสู่ระบบเพื่อยืนยัน redirect behavior.
4. เทียบชื่อแพ็กเกจและขอบเขต `lsupergen-sdk` กับ `npmjs.sdk-space`; ไม่เปลี่ยนชื่อเพราะเป็นคนละแพ็กเกจตาม contract.
5. คำนวณ contrast ของปุ่มและแก้ค่าที่ผิดใน branch `main`.
6. ตรวจว่าไฟล์บน `main` รับ commit ใหม่แล้ว.

## สิ่งที่ยังควรทำ

- ตรวจภาพจริงหลัง deploy ด้วย signed-in test session ที่ 390px และ 1280px: header wrap, horizontal overflow, focus ring, tab panels, code blocks, และปุ่ม run.
- รัน `node --test tests/*.test.mjs` ใน CI หรือ checkout ที่เชื่อถือได้สำหรับ commit ใหม่.
- ทดสอบ flow จริง: `/keys` สร้าง/คัดลอก key → `/guide` วาง key → Run all → Proof report 5/5.
- พิจารณานำ IDE code window component มาใช้กับ Guide ด้วย ถ้าเป้าหมาย redesign ต้องการให้ code blocks สอดคล้องกับ Docs; ปัจจุบัน component ถูกยืนยันว่าใช้กับ Docs แต่ Guide ยังใช้ `.code > pre` และปุ่ม copy แบบเดิม.

## ข้อสงสัย/ข้อจำกัด

- ยังยืนยัน visual ของหน้า Guide หลัง login ไม่ได้ เพราะ audit นี้ไม่มี signed-in test session และจะไม่ขอหรือใช้ credential.
- ยังยืนยัน deployment ของ commit `97e15ba997baf89e6a7542bb413cc266edf26a5e` ไม่ได้จาก GitHub status เพราะ repository ไม่มี workflow/status ที่รายงานสำหรับ commit ก่อนหน้า.
- คำว่า “Guide” กับ “Playground” ใช้ปะปนกันในชื่อ task และ UI แต่ repository contract ระบุ `/guide` เป็น Playground; จึงไม่เปลี่ยน label โดยไม่มี product decision.


## Update — CORE SDK theme integration

ตรวจพบ commit `0595ebe6292ecb9402b1106330e0471facbd5500` เพิ่ม `assets/guide-core.css` แต่ไม่มี reference จาก `guide.html` หรือ `assets/guide.js`; ดังนั้นไฟล์ถูก deploy ได้แต่ browser ไม่โหลด และ visual redesign ไม่เกิดขึ้นจริง

แก้แล้วโดยเพิ่ม `<link rel="stylesheet" href="/assets/guide-core.css?v=1">` หลัง shared `theme.css` ใน `guide.html` เพื่อให้ page-scoped overrides ทำงานตามลำดับ cascade

Commit แก้ไข: `0f3dfa8bb5b066ba2c0bd2f97a09151963551ec5`

ตรวจค่า contrast ของปุ่มหลังธีมใหม่: ขาวบน `#6c21ff` ประมาณ 6.37:1 และ hover `#7c32ff` ประมาณ 5.59:1 ผ่านเกณฑ์ข้อความปกติ จึงไม่ย้อนการกำหนดสีปุ่มของธีมใหม่

ยังต้องตรวจ visual หลัง deploy ด้วย signed-in session และ viewport 390px/1280px ตามรายการเดิม ไม่มี GitHub Actions run หรือ commit status สำหรับ commit ธีมในเวลาที่ตรวจ


## Update — two-mode theme and live verification

ตรวจ commits `b2573ad9156a3a235bd0301731614d6a96ffc191`, `45750bdf2169de6c8ce5673e6204e36890cfc529` และ `8589f754acc6cff193f381601d2727ea0311b9be` แล้ว:

- เพิ่ม Normal/Docs mode ร่วมกันบน `/loading` และ `/guide` ผ่าน `assets/theme-modes.css` และ `assets/theme-modes.js`.
- ใช้ canvas และ tab/card surfaces เป็น `#000000` แบบ opaque; Normal ใช้ blue-gray และ Docs ใช้ muted purple.
- เพิ่ม cache-busting version ให้ CSS ที่เปลี่ยน และเพิ่ม static contract tests ใน `tests/public-product.test.mjs`.
- Production `/loading` ถูกตรวจผ่าน browser จริง: computed body background เป็น `rgb(0, 0, 0)`, logo container เป็น 88×88px, toggle เปลี่ยนจาก Normal ไป Docs ได้, Docs toggle เป็น `rgb(102, 81, 129)` กับตัวอักษรขาว และหลัง reload ยังคง Docs mode อยู่.
- ยังไม่มี GitHub Actions workflow run หรือ commit status สำหรับ commit ล่าสุด จึงถือว่า static tests มีอยู่ใน source แต่ยังไม่มี CI execution evidence.

แก้ factual error ใน comment ของ `assets/guide-core.css`: ไฟล์ถูกโหลดโดย `guide.html` ไม่ใช่ `assets/guide.js`.

Commit แก้ comment: `cd9879c100c5838b6219416084a4d9953e70c6cb`.

ข้อจำกัดที่เหลือ: `/guide` ต้องมี signed session จึงยังไม่ได้ตรวจ computed styles และ interaction ของหน้า Guide ที่ deploy จริง รวมถึง viewport 390px/1280px และ flow `/keys → /guide → Run all`.


## Update — CORE SDK electric violet restored

ตรวจ commit `a768ab1ed6657ac7fb4d18d741cc1985f2f372f5` แล้ว พบว่าเปลี่ยน `assets/guide-core.css` โดยตั้งใจคืน electric violet (`#6c21ff`) ให้ visual layer ของ CORE SDK บน `/guide` และลบ mode-specific accent variables ที่เคยเป็น blue-gray/muted purple ออกจากไฟล์นี้

ข้อเท็จจริงจาก CSS cascade ปัจจุบัน:

- `assets/theme-modes.css` ถูกโหลดหลัง `assets/guide-core.css` จึงยังทำให้ปุ่ม Run/Primary ใน Normal mode เป็นพื้นดำตาม selector ที่เฉพาะกว่า
- ใน Docs mode ปุ่ม `.primary` ของ Guide, focus ring, hover, step number และ selected tabs ใช้ electric violet จาก `guide-core.css`; selected tabs ถูกบังคับเป็น violet ในทั้งสอง mode
- สีข้อความขาวบน `#6c21ff` มี contrast ประมาณ 6.37:1 และบน hover `#7c32ff` ประมาณ 5.59:1 จึงยังผ่าน WCAG AA สำหรับข้อความปกติ
- commit นี้ไม่มี GitHub Actions workflow run หรือ commit status ที่รายงานผ่าน GitHub API ณ เวลาตรวจ

ไม่ได้แก้ย้อน เพราะชื่อ commit และชุดการเปลี่ยนแปลงบ่งชี้ว่าเป็น product/brand decision โดยตรง และไม่พบ accessibility regression เชิง contrast จากค่าที่เปลี่ยน อย่างไรก็ตาม ผลลัพธ์นี้ทำให้คำอธิบายก่อนหน้าว่า `/guide` ใช้ Normal blue-gray / Docs muted purple ไม่ครบถ้วนแล้ว

สิ่งที่ควรยืนยันต่อ: product owner ต้องเลือกให้ชัดว่า electric violet เป็น accent เฉพาะ CORE SDK ที่ควร override theme mode หรือ theme mode ต้องควบคุม accent ทั้งหมด; จากนั้นเพิ่ม static test สำหรับ precedence นี้ และตรวจ visual จริงหลัง login ที่ 390px/1280px


## Update — sitewide editorial refresh and stale palette assertion

ตรวจ commit `8a8e3a7cb167ac3eb60d283fa25173411f2fcc96` ซึ่งปรับข้อความและ compact branding ทั่วเว็บ รวมถึง `/guide`:

- `guide.html` ยังโหลด `guide-core.css?v=3` ก่อน `theme-modes.css?v=2` และยังคง IDs/scripts ที่ใช้กับการทดสอบจริง
- เปลี่ยนข้อความนำของ Guide ให้เน้นขั้นตอนและผลลัพธ์ และเพิ่ม `assets/editorial.css?v=1`; contract ของ auth/API ไม่ได้เปลี่ยน
- ผู้ทำ commit รายงาน targeted checks ผ่าน 33/34 และยังไม่ได้ตรวจ browser/live deployment
- ข้อที่ล้มเกิดจาก test บังคับ literal `background:#000000` แต่ `assets/guide-core.css` ใช้ shorthand `background:#000` ซึ่งเป็นค่าสีเดียวกัน ไม่ใช่ visual regression

แก้ assertion ใน `tests/public-product.test.mjs` ให้ยอมรับทั้ง `#000` และ `#000000` โดยยังคงตรวจ `!important` และ opacity เดิม

Commit แก้ test: `dff72afbb3423cf92d9663c4b01c531d3c69c8fe`.

ยังไม่มี GitHub Actions workflow run หรือ commit status สำหรับ editorial commit; การตรวจ browser หลัง login ที่ 390px/1280px และ flow `/keys → /guide → Run all` ยังเป็นข้อจำกัดเดิม


## Update — Next.js migration merged into main

ตรวจ merge commit `e2ee7c46aeccfe254d56fdcdb9c277096989d6f7` (PR #17) แล้ว:

- เริ่ม migration แบบแยกส่วนใน `next-app/`; มีเพียง `/loading` ที่เป็น React/Next.js native ในระยะนี้
- production เดิมยังเป็น Worker/static site และ `.assetsignore` กัน `next-app/**` ไม่ให้ปะปนกับ legacy static deployment
- navigation ของ route ที่ยังไม่ย้ายชี้กลับ `https://agents-sdk.space`; local `/chat` และ `/api/chat` ตั้งใจให้ 404 เพื่อไม่ทำ auth/API ซ้ำ
- `next-app/package.json` pin `next@16.3.6`, `react@19.3.0`, `react-dom@19.3.0`, Node `>=20.9.0`
- commit ต้นทาง `ef22facadb33cce11da9d23f58394c8a3d5737f7` ระบุว่า build, HTTP smoke และ legacy Node tests 75/75 ผ่าน แต่ local browser test ถูกบล็อกเพราะ Chromium download ไม่สมบูรณ์
- workflow `.github/workflows/next-app-verify.yml` มี build และ Playwright สำหรับ PR/branch migration อย่างไรก็ตาม GitHub API ยังไม่แสดง commit status หรือ workflow run สำหรับ merge commit ล่าสุด จึงยังไม่นับว่า browser suite ผ่าน
- ก่อน merge Next.js มีงาน `/chat` streaming และ D1 chat history ถูก merge เข้า `main` ผ่าน PR #18/#19; เป็นการเปลี่ยน backend/client contract ที่ควร regression-test แยกจาก visual migration แม้ไม่แก้ `/guide` โดยตรง

ไม่พบ regression ที่พิสูจน์ได้ใน `/guide` จาก merge นี้ และไม่ได้ย้อนโค้ด migration

สิ่งที่ควรทำต่อ:

1. รัน/ยืนยัน GitHub Actions ของ `next-app` ให้มีหลักฐาน build + Playwright บน SHA ที่อยู่ใน `main`
2. เปิด preview แยก origin และตรวจ `/loading` ที่ 390px/1280px: theme persistence, copy button, overflow, links และ console errors
3. ห้ามชี้โดเมน production เข้า `next-app` จนกว่าจะย้าย auth/session-aware routes และเลิก root redirect ชั่วคราว เพราะเอกสาร migration ระบุว่าจะเกิด redirect loop
4. ก่อนย้าย `/guide` ให้ล็อก contract เดิม: signed session, `/keys → /guide`, `lsupergen-sdk@0.1.0` และ Proof report 5/5
5. ทดสอบร่วมกับการเปลี่ยน chat ใหม่: NDJSON stream ขาดกลางคัน, conversation ownership ใน D1, reload จาก `?c=` และ storage failure ที่ต้องไม่ทำให้คำตอบจริงหาย


## Update — backend feature merges and unwired modules

ตรวจการเปลี่ยนแปลงหลัง Next.js migration จนถึง merge `9364845ab7c32a0aca47d4e5a3dbc6161a322826`:

- `/api/chat` เพิ่ม Claude เป็น provider ทางเลือก พร้อม provider picker, streaming interpreter, attachments, quota refund และ history contract
- ก่อนหน้านั้นมี per-account D1 quota, image/PDF attachments และการคืน prompt เมื่อส่งล้มเหลว
- GitHub API ยังไม่แสดง commit status หรือ workflow run สำหรับ merge ล่าสุด จึงยังไม่ถือว่า test suite ผ่านบน `main`
- การเปลี่ยนเหล่านี้ไม่แก้ `guide.html` โดยตรง แต่เพิ่ม regression surface ของ session, quota, storage และ streaming ที่ต้องตรวจร่วมก่อน migration ของ `/guide`

พบข้อผิดพลาดด้านสถานะการเชื่อมต่อใน commit `625585888290528fe65033e67ab38920d1808797`:

- เพิ่ม `src/multi-model-chat.js`, `src/github-integration.js` และ `src/deep-research.js`
- code search บน default branch พบ handler อยู่เฉพาะในไฟล์ของตัวเอง; `src/index.js` ไม่มี import/route จึงเป็น dead code และยังใช้งานจริงไม่ได้
- GitHub module มีทางรับ `github_token` จาก request body และ deep-research มีการ fetch URL โดยยังไม่มี SSRF/private-network guard; ห้าม wire เข้าสู่ public route ในสภาพปัจจุบัน

แก้สถานะให้ตรงข้อเท็จจริงแล้วโดยเพิ่ม `NOT WIRED YET` และ safety gates ที่หัวทั้งสามไฟล์:

- `32fee824467b9696434c7d3e4a45f4b6a670ee05` — multi-model
- `77760eda6cef4577eeb1583db486de3a7cbaeaba` — GitHub integration
- `00ff90c029d3d66edc66090db176670eca92e600` — deep research

ยังไม่ได้เชื่อม route หรือเปิดความสามารถดังกล่าว เพราะต้องมี signed-session, quota/ownership, token provenance, CSRF, repo/branch allowlist, audit log, SSRF blocking, timeout/size limits และ contract tests ก่อน


Security follow-up: ลบการรับ `github_token` จาก request body แล้วใน commit `f3d830ae2872de6928c7499191b15a38045bb1f0`; helper จะอ่านได้เฉพาะ token จาก verified server-side session เท่านั้น โมดูลยังคง `NOT WIRED YET` จนกว่า safety gates ที่เหลือจะครบ


## Update — Next.js landing assembly on main

ตรวจ commit `1cf5e1cd2c450a90c2d4c9bee156b59ddd952ebb` แล้ว:

- `next-app/app/page.jsx` และ `next-app/app/loading/page.jsx` ใช้ component กลาง `components/landing-page.jsx` ชุดเดียวกัน ลด markup ซ้ำ
- ไม่แก้ไฟล์ stylesheet หรือค่าสี จึงไม่พบ color/UI regression จาก diff นี้
- เพิ่ม redirect จาก preview สำหรับ `/guide`, `/keys`, `/chat`, auth/docs และ workspace routes กลับไป production origin เดิม พร้อมคง query string ตาม contract ของ Next.js
- `/guide` ยังไม่ถูก migrate หรือ duplicate; signed-session boundary และ flow `/keys → /guide` ยังคงอยู่ที่ production
- เปิด workflow push ให้ทำงานบน branch `main` แล้ว แต่ GitHub API ยังไม่พบ workflow run หรือ commit status สำหรับ SHA นี้
- หลักฐานใน commit ระบุ production build ผ่าน, HTTP route tests 2 configuration ผ่าน และ repository Node test files 13/13 ผ่าน แต่ full browser UI suite ยังไม่ยืนยันเพราะ Chromium download ไม่สมบูรณ์

ไม่พบข้อผิดพลาดที่พิสูจน์ได้และไม่แก้โค้ดเพิ่มในรอบนี้

สิ่งที่ควรทำต่อ: รอ/ตรวจ workflow บน `main`, ทดสอบ preview ที่ 390px/1280px, ยืนยัน theme persistence และ query-preserving redirects จาก browser จริง และยังไม่ cut over production domain จนกว่า OAuth/backend integration พร้อม


## Update — production-only repository cleanup

ตรวจ commit `a0d38bba8e06586b35394c95686d3fd4f409b22f` ตามคำสั่งให้คัดสิ่งที่ไม่เกี่ยวกับ production `lsuperagent.docs` ออก:

- ลบ 59 ไฟล์ที่เป็น Agents SDK Lab แยก, integration prototype ที่ไม่ถูก wire, หน้า/แผนออกแบบเก่า, snapshot สถานะ และ archive
- คง runtime production ที่มี route/import จริง: Firebase/OAuth, D1 history/quota, SDK Guide, Exa, tests และ `next-app/` ซึ่งเป็น migration ที่เจ้าของอนุมัติ
- เปลี่ยน `.assetsignore` เป็น allowlist ของ browser assets โดยตรง ทำให้ source, tests, migrations, CI, notes และ `next-app/` ไม่ถูกอัปโหลดเป็น static assets
- `guide.html`, `assets/guide.js`, vendored `lsupergen-sdk@0.1.0`, signed-session check และ flow `/keys → /guide → Proof report` ยังอยู่
- commit ระบุผลตรวจ 111 Node tests, syntax checks, Next.js production build, Playwright 4 desktop/mobile checks, Wrangler dry-run, public asset boundary 53 ไฟล์ และไม่มี dangling links
- ไม่พบ regression ที่พิสูจน์ได้ใน `/guide` จาก source ที่ตรวจ จึงไม่แก้ runtime เพิ่ม
- GitHub API ยังไม่แสดง commit status หรือ workflow run สำหรับ commit นี้ และข้อความ commit ระบุเองว่ายังไม่ได้ยืนยัน production deployment

สิ่งที่ควรทำต่อ: ตรวจ deployment จริงว่า public asset allowlist ไม่ตัดไฟล์ที่ route production ต้องใช้, เปิด `/guide` ด้วย signed session ที่ 390px/1280px, และรัน `/keys → /guide → Run all` ให้ได้ Proof report 5/5 ก่อนถือว่า cleanup ปิดงานได้

## Update — SDKSPACE page integration, Worker route and live 502

ตรวจการเปลี่ยนแปลง production หลัง commit `10b5179f434f878203604ef2a29e9bfba24783f4`:

- `2361ca937bf18123eee43598fa732dcd321fde38` เปลี่ยน Wrangler target ชั่วคราวเป็น `sdkspace`, อัปเดต compatibility date และ Static Assets handling.
- `7929804a4d14a1c03df52e471f68bcad69d801b0` แก้ชื่อ Worker กลับเป็น `lsuperagent-docs` ให้ตรงกับ connected target.
- `fd3e5ae5d19f57026e886e7fe705459cd64bae83` นำหน้า SDKSPACE ที่เจ้าของให้มาใช้กับ `home.html`, `loading.html` และ Docs introduction พร้อม navigation/session script.
- `3f002bdf0ba4b891f96559b448eb2c4e2eaaf848` ประกาศ `agents-sdk.space` เป็น custom domain ใน `wrangler.toml`.

พบ accessibility regression จาก CSS cascade ของหน้าใหม่:

- `home.html` และ `loading.html` กำหนดปุ่มเป็นข้อความขาวก่อน แต่ selector ท้ายไฟล์ override เป็น `#06101e`. จุดมืดของ gradient `#2f6fe0` เหลือ contrast ประมาณ 4.06:1 ซึ่งต่ำกว่า WCAG AA สำหรับข้อความปกติ.
- `assets/sdkspace-docs-intro.css` override ข้อความเป็น `#090909` บน gradient `#33526b → #1c2f3f`; contrast อยู่ประมาณ 2.43:1 ถึง 1.45:1.

แก้แล้ว:

- `b54ecc5a92b87342c0ec0e88ed7d625164d48e46` — คืนข้อความ CTA ของ Home เป็น `#ffffff`.
- `43a1aa7ab8526a4b3dd07f44fd1335abcdd64eb0` — คืนข้อความ CTA ของ intro/loading เป็น `#ffffff`.
- `1b01a479353159d1853b146ea325cef57ba1adb5` — ใช้ `#eef2f5` บน Docs intro; contrast กับ gradient อยู่ประมาณ 7.29:1 ถึง 12.21:1.
- `385eafd5a81a638131499622ddac968cd74b94f4` — เพิ่ม static regression test เพื่อล็อกสี CTA ทั้งสาม surface.

ตรวจ production แบบ read-only วันที่ 2026-10-02 แล้ว `https://agents-sdk.space/loading` และ `/home` ตอบ `502 Bad Gateway` พร้อม `[Errno 111] Connection refused`. ดังนั้นยังยืนยัน visual หรือ auth flow หลัง deploy ไม่ได้ และปัญหานี้ไม่สามารถแก้จาก CSS/repository อย่างเดียวได้.

ข้อเท็จจริงที่ต้องดำเนินการนอก repository: ยืนยันว่า Cloudflare Worker `lsuperagent-docs` ถูก deploy จริง, custom domain ผูกกับ Worker ตัวเดียวกัน, D1 binding และ secrets เดิมยังอยู่ และ Git integration/build trigger เชื่อมอยู่. Operator รายงานก่อนหน้านี้ว่าได้ถอด repository ออกจาก Cloudflare; commit ใน GitHub จึงไม่ใช่หลักฐานว่า production deploy แล้ว.

GitHub API ยังไม่แสดง Actions run หรือ commit status สำหรับชุด commit production นี้.



## Update — custom-domain outage isolated from healthy Worker runtime

ตรวจแบบ read-only วันที่ 2026-10-03 แล้ว:

- `https://agents-sdk.space/loading` ยังตอบ `502 Bad Gateway` พร้อม `[Errno 111] Connection refused`.
- `https://lsuperagent-docs.thanabartb.workers.dev/loading` ตอบสำเร็จและแสดงหน้า SDKSPACE พร้อม navigation/CTA ตาม source ปัจจุบัน.
- `/docs/quickstart` บนปลายทาง Worker ตอบและ redirect ผู้ใช้ที่ยังไม่เข้าสู่ระบบไป `/login?return_to=%2Fdocs%2Fquickstart`; จึงยืนยันได้ว่า Worker runtime และ session-aware routing ทำงาน ไม่ใช่ Worker ล่มทั้งตัว.
- commit ล่าสุดยังเป็น `9634d13ee9c2c48be0ec77f5de42fa1d38b32e03`; GitHub API ยังไม่แสดง workflow run หรือ commit status.

ข้อสรุปจากหลักฐาน: เหตุขัดข้องถูกจำกัดอยู่ที่ชั้น custom domain / Cloudflare routing (รวมถึง DNS, certificate หรือ Worker association ที่เกี่ยวข้อง) ไม่ใช่ source code หรือ runtime ที่ปลายทาง `workers.dev`. จึงไม่แก้ `wrangler.toml` หรือโค้ดแบบคาดเดา เพราะอาจทำให้ Worker ที่ยังทำงานอยู่เสียหาย.

สิ่งที่ควรทำต่อโดยผู้ดูแล Cloudflare: ตรวจว่า custom domain `agents-sdk.space` ผูกกับ Worker `lsuperagent-docs` ตัวที่กำลัง serve `workers.dev`; ถอดและเพิ่ม custom domain ใหม่เมื่อ association ค้าง, ตรวจ DNS/certificate status แล้วทดสอบ `/loading` และ signed-session routes อีกครั้ง. การแก้ repository อย่างเดียวไม่สามารถซ่อม routing ที่ detached อยู่ได้.


## Update — custom domain recovered and auth gates verified

ตรวจ production แบบ read-only วันที่ 2026-10-03 แล้ว:

- `https://agents-sdk.space/loading` กลับมาตอบสำเร็จและแสดงหน้า SDKSPACE; ไม่พบ `502 Bad Gateway` ที่เคยเกิดในรอบก่อน.
- `https://agents-sdk.space/home` ส่งผู้ใช้ที่ยังไม่เข้าสู่ระบบไป `/login?return_to=%2Fhome`.
- `https://agents-sdk.space/guide` ส่งผู้ใช้ที่ยังไม่เข้าสู่ระบบไป `/login?return_to=%2Fguide`.
- commit ล่าสุดก่อนบันทึกผลยังเป็น `c4636634456cfa65e6248c6a69831f6d389aeafb` ซึ่งแก้เฉพาะรายงาน; ไม่มี application commit หรือ CI/status ใหม่.

ข้อสรุป: custom-domain routing ฟื้นตัวแล้ว และ public/auth boundary ที่ตรวจได้ทำงานตาม contract. เนื่องจากไม่มี application commit ใหม่ระหว่างเหตุขัดข้องกับการฟื้นตัว จึงมีแนวโน้มว่าเป็นการแก้หรือการ propagate ที่ชั้น Cloudflare/domain มากกว่าการเปลี่ยน source code แต่ยังไม่มีหลักฐาน dashboard/deployment log เพียงพอจะระบุสาเหตุสุดท้าย.

ยังไม่ปิดงาน Guide redesign: ต้องใช้ signed-in test session เพื่อตรวจ `/guide` ที่ 390px/1280px และทดสอบ `/keys → /guide → Run all → Proof report 5/5`. ไม่แก้ runtime เพิ่มในรอบนี้เพราะเส้นทาง public และ auth gate ที่ตรวจพบถูกต้อง.


## Update — CTA regression selector corrected

ตรวจ commit `67245d3938d400978ece15286883b862d1342de3` วันที่ 2026-10-04 แล้ว:

- แก้เฉพาะ `tests/public-product.test.mjs`; ไม่มี production HTML, CSS, JavaScript, Worker route หรือ deployment config เปลี่ยน
- regex เดิมใช้ `\\\\.` ภายใน regex literal ทำให้ค้นหาอักขระ backslash ตามด้วยอักขระใด ๆ แทนที่จะจับจุดใน CSS selector จึงไม่ตรงกับ `a.btn-primary` และ `.sdkspace-intro a.btn-primary`
- regex ใหม่ใช้ `\\.` ซึ่งเป็นรูปแบบที่ถูกต้องสำหรับ literal dot ใน JavaScript regex และยังคงล็อกค่าสี CTA เดิม
- production `https://agents-sdk.space/loading` ยังเปิดสำเร็จและแสดงหน้า SDKSPACE; ไม่พบการกลับมาของเหตุ 502
- GitHub API ยังไม่แสดง workflow run หรือ commit status สำหรับ SHA นี้ จึงยืนยันได้เฉพาะความถูกต้องของ diff และ live public route ไม่อ้างว่า test suite ทั้งชุดผ่านบน CI

ไม่แก้ runtime เพิ่ม เพราะ commit นี้แก้ false-negative ใน test เท่านั้นและไม่พบ production regression ใหม่

สิ่งที่ยังเหลือเหมือนเดิม: signed-in visual verification ของ `/guide` ที่ 390px/1280px และ flow `/keys → /guide → Run all → Proof report 5/5`.


## Update — mobile viewport fill fix

ตรวจ commit `64983be4eb73bb9378d0f26d408f8ac79a7e1a9a` วันที่ 2026-10-04 แล้ว:

- เพิ่ม media query ที่ความกว้างไม่เกิน 600px ใน `assets/sdkspace-reference-modes.css`
- สำหรับ `body[data-sdkspace-page]` ยกเลิก padding และกำหนด `min-height:100svh`
- สำหรับ container `.phone` ยกเลิก max-width, border และ border-radius พร้อมกำหนด `min-height:100svh`; จึงแก้กรอบจำลองโทรศัพท์ที่ทำให้หน้า Home/Intro ไม่เต็มจอบนมือถือ
- `home.html` และ `loading.html` มี viewport meta, body data attribute และโหลด stylesheet นี้ทั้งคู่ จึงเข้า selector ตามที่ตั้งใจ
- ตรวจ production `/loading` แล้วหน้า SDKSPACE ยังทำงาน และ stylesheet ที่โหลดจริงมี mobile rule ใหม่ แม้ URL ยังคงเป็น `sdkspace-reference-modes.css?v=1`
- GitHub API ยังไม่มี workflow run หรือ commit status และ browser ที่ใช้ตรวจมี viewport 1363px จึงยังไม่อ้างว่า visual 390px ผ่านครบถ้วน

ไม่พบ regression ใหม่และไม่แก้ runtime เพิ่ม จุดที่ควรทำต่อคือเพิ่ม mobile viewport test ที่ 390px สำหรับ Home/Intro และตรวจ signed-in `/guide` ตาม acceptance เดิม.


## Update — approved GitHub code tools and private-repository safety gate

ตรวจ merge `6387aae4d4617923073ef9ad4dd1ddec30f4a71a` (PR #24) วันที่ 2026-10-04 แล้ว:

- เพิ่ม GitHub App OAuth แยกจาก login OAuth, เก็บ access/refresh token แบบ AES-GCM encrypted ใน D1 และไม่ส่ง token กลับ browser
- การสร้าง repo/commit ต้องมี signed session, GitHub connection, same-origin POST และการกดอนุมัติจาก proposal card
- จำกัด commit ไว้ที่ repository ซึ่ง owner ตรงกับ GitHub login ที่เชื่อม, สูงสุด 20 ไฟล์, 200 KB ต่อไฟล์และรวมไม่เกิน 1 MB; ปฏิเสธ path traversal, duplicate paths และ force update
- UI แสดง path/content ก่อนอนุมัติด้วย `textContent` ไม่ใช้ HTML injection
- ต้องมี migration `0003_github_app.sql` และ secrets `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY` ก่อนเปิดใช้จริง

พบ safety mismatch: tool contract ระบุว่าสร้างเฉพาะ private repository แต่ endpoint เดิมยอมรับ `private:false` จาก request body ได้

แก้แล้ว:

- `6d82e1a6aef0f21f9945643a18c9733fed663cee` — ฝั่ง Worker บังคับ `private:true` เสมอ
- `c285ccd3d4227c7378c1ce2076e8ac9102d8c709` — เพิ่ม regression test ส่ง `private:false` แล้วตรวจว่า payload ไป GitHub ยังคงเป็น private

Security review ไม่พบ critical issue เพิ่มจาก diff ที่ตรวจ แต่ยังไม่ถือว่า production-ready แบบยืนยันครบ เพราะ GitHub API ไม่แสดง workflow/status และยังไม่ได้ทดสอบ signed-in end-to-end หลัง deploy: connect → proposal → approve → private repo/commit → audit result.

ขั้นถัดไป: apply D1 migration, deploy secrets/config, รัน Node tests บน SHA ล่าสุด และทดสอบด้วย repository ทดสอบที่ไม่มีข้อมูลสำคัญก่อนอนุญาตให้เขียน production repository.
