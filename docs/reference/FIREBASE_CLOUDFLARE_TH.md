# ตั้ง Firebase บน Cloudflare (ภาษาไทย)

ใช้เมื่อมีไฟล์/PDF จาก Firebase Console ที่เป็น `firebaseConfig` หรือ `<script type="module">` แบบ SDK 12.x

## ใช่ไหม — ไฟล์แบบไหนถูก?

| ถูก | ไม่ใช่ |
|-----|--------|
| Firebase Web config (`apiKey`, `authDomain`, `projectId`, `appId`) | Google OAuth `client_secret_*.json` |
| PDF/screenshot จาก Project settings → Web app | Base44 SDK docs |
| `google-services.json` (ดึง 4 ค่าเดียวกัน) | ไอคอน Android `ic_*.xml` |

**ห้าม** commit ค่าจริงลง GitHub — ใส่ใน Cloudflare เท่านั้น

## แปลงจาก PDF/script → ชื่อใน Cloudflare

ใน Firebase Console มักเขียนแบบ camelCase ใน Worker ใช้ชื่อตัวแปรนี้:

| ในไฟล์ Firebase | ชื่อใน Cloudflare Worker |
|-----------------|---------------------------|
| `apiKey` | `FIREBASE_API_KEY` |
| `authDomain` | `FIREBASE_AUTH_DOMAIN` |
| `projectId` | `FIREBASE_PROJECT_ID` |
| `appId` | `FIREBASE_APP_ID` |
| `storageBucket` (ถ้ามี) | `FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` (ถ้ามี) | `FIREBASE_MESSAGING_SENDER_ID` |
| `measurementId` (ถ้ามี) | `FIREBASE_MEASUREMENT_ID` |

ต้องมีอยู่แล้วจาก OAuth/AI (ไม่ใช่จาก PDF):

| ชื่อใน Cloudflare | ใช้ทำอะไร |
|-------------------|-----------|
| `AUTH_SESSION_SECRET` | คุกกี้ session หลังล็อกอิน |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ปุ่ม Google/Gmail (Worker OAuth) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ปุ่ม GitHub |

## ขั้นตอนใน Cloudflare (มือถือได้)

1. **Workers & Pages** → **`lsuperagent-docs`** → **Settings**
2. **Variables and Secrets** → **Add** (แต่ละตัว Encrypt ได้)
3. ใส่ 4 ตัว `FIREBASE_*` ตามตารางด้านบน
4. **Save** แล้ว **Redeploy** (หรือ push `main` ให้ build ใหม่)

## ขั้นตอนใน Firebase Console

1. **Authentication** → **Sign-in method** → เปิด **Email/Password**
2. **Authentication** → **Settings** → **Authorized domains** → เพิ่ม `agents-sdk.space`
3. ยืนยันว่า Web app ใน PDF อยู่ใน **โปรเจกต์ที่ต้องการใช้ production** (เช่น `gen-lang-client-…` ต้องตั้งใจใช้จริง)

## ทดสอบหลัง deploy

1. เปิด `https://agents-sdk.space/api/firebase/status`  
   - ต้องการ: `"status": "configured"` และ `"platform_email_auth": true`
2. เปิด `https://agents-sdk.space/signup` → สมัครด้วยอีเมล
3. เปิด `https://agents-sdk.space/login` → เข้าด้วยอีเมล (ไม่เด้ง Google จากช่องอีเมล)

## โปรเจกต Git ที่ deploy

Worker ควร build จาก repo **`thanabartbb/lsuperagent.docs`** branch **`main`**.  
ถ้า Cloudflare ชี้ repo อื่น โค้ดบนเว็บจะไม่ตรงกับเอกสารนี้

## evidence

- `source_path`: `docs/reference/FIREBASE_CLOUDFLARE_TH.md`
- `secret_values_exposed`: false (เอกสารไม่มีค่าจริง)
