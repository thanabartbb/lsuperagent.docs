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
