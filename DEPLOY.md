# Deploy agents-sdk.space → Cloudflare Pages

## ขั้นตอนที่ 1 — ติดตั้ง Wrangler (ถ้ายังไม่มี)

```bash
npm install -g wrangler
```

ตรวจสอบ:
```bash
wrangler --version
```

---

## ขั้นตอนที่ 2 — Login Cloudflare

```bash
wrangler login
```

เบราว์เซอร์จะเปิดมา กด Authorize แล้วกลับมา terminal

---

## ขั้นตอนที่ 3 — สร้าง Pages Project ใหม่ + Deploy

ทำครั้งเดียว (สร้าง project + deploy พร้อมกัน):

```bash
wrangler pages deploy . --project-name agents-sdk-space
```

รอสักครู่ จะได้ URL แบบนี้:
```
https://agents-sdk-space.pages.dev
```

---

## ขั้นตอนที่ 4 — ผูก Custom Domain

1. เปิด https://dash.cloudflare.com
2. ไปที่ **Workers & Pages** → `agents-sdk-space`
3. แท็บ **Custom domains** → กด **Set up a custom domain**
4. พิมพ์ `agents-sdk.space` → กด Continue
5. Cloudflare จะตั้งค่า DNS ให้อัตโนมัติ (เพราะ nameserver ชี้มาที่ Cloudflare แล้ว)
6. รอ ~2 นาที → สถานะเป็น **Active**

---

## ขั้นตอนที่ 5 — Deploy ครั้งถัดไป

```bash
wrangler pages deploy . --project-name agents-sdk-space
```

แค่นี้เลย ไม่ต้องตั้งค่าอีก

---

## Routes ที่ใช้งานได้หลัง deploy

| URL | หน้า |
|---|---|
| agents-sdk.space/ | Homepage |
| agents-sdk.space/login | Login |
| agents-sdk.space/getting-started | Getting Started |
| agents-sdk.space/guides | Guides |
| agents-sdk.space/api | API Reference |
| agents-sdk.space/tools | Tools |
| agents-sdk.space/examples | SDK Plug Tools |
| agents-sdk.space/changelog | Changelog |
| agents-sdk.space/workspace | Workspace / Protocol Studio |

---

## หมายเหตุ

- ไฟล์ทั้งหมดต้องอยู่ในโฟลเดอร์เดียวกัน (ไม่มี subfolder)
- `_headers` และ `_redirects` ต้องอยู่ใน root เดียวกับ index.html
- Cloudflare Pages รองรับ `_redirects` native ไม่ต้องเขียน Worker เพิ่ม
