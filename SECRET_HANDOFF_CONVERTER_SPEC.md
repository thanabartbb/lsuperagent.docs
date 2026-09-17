# Secret Handoff Converter Spec V1 — lsuperagen.docs

> Target project: `lsuperagen.docs` / `https://agents-sdk.space`  
> Status: Specification only. No raw secret storage. No provider write integration.  
> Primary goal: let a public user convert a real API key or token into a safe, copyable AI handoff package without exposing the raw secret to AI chat, GitHub, logs, screenshots, or the site owner.

---

## 0. Target lock

This spec belongs only to this project:

```txt
Project: lsuperagen.docs
Repository: thanabartbb/lsuperagent.docs
Public site: https://agents-sdk.space
Admin surface: https://agents-sdk.space/admin
Runtime: Cloudflare Worker + Static Assets
```

It is not for S-AGENTS, AGENTS-SDK-LAB, Railway migration, Supabase migration, or any unrelated app unless the owner explicitly starts a separate task.

---

## 1. Product name

Use this public tool name:

```txt
Secret Handoff Converter
```

Avoid these names in UI copy:

```txt
API Key Converter
Token Decoder
Secret Translator
Key Unlocker
```

Reason: the tool must not imply it can safely reveal, decode, or transform a secret into another secret. The product converts a raw secret into a safe instruction package for humans and AI tools.

---

## 2. Core concept

The user pastes a real key into a local-only input. The page generates a copyable handoff package that describes how to store and use the key without including the key itself.

```txt
Raw secret entered by user
  ↓
Client-side validation and classification
  ↓
Mask preview + fingerprint + target env name
  ↓
Safe AI handoff package
  ↓
User copies package to Claude / ChatGPT / Cursor / admin workflow
```

The raw secret must never be included in the generated handoff package.

---

## 3. V1 operating mode

V1 must be browser-local by default.

```txt
Mode: Safe Public Mode
Storage: none
Network submission: none
Server logging: none
Database: none
Cloudflare KV/D1/R2: none
Owner visibility: none
```

The raw key may exist only in the user's browser memory while the page is open. The user can clear it manually, and the page should clear it after package generation when possible.

---

## 4. Non-negotiable security rules

```txt
NO raw key in generated output.
NO raw key sent to /api.
NO raw key in URL query params.
NO raw key in localStorage.
NO raw key in sessionStorage.
NO raw key in cookies.
NO raw key in analytics.
NO raw key in GitHub commits.
NO raw key in Markdown docs.
NO raw key in screenshots or visible preview after generation.
NO base64-as-security.
NO reversible obfuscation marketed as safe.
```

Base64 is not encryption. Hashing is not encryption. A masked preview is not a secret. A fingerprint is only for identification.

---

## 5. Supported providers V1

V1 should support common provider profiles without requiring live validation.

```txt
OpenAI
GitHub
Cloudflare
Railway
Supabase
Firebase
LINE
Zapier
Anthropic
Google / Gemini
Custom
```

Provider detection may be heuristic. If uncertain, the UI must say `Provider: Custom / Unknown` instead of guessing with high confidence.

---

## 6. Provider profile fields

Each provider profile should define:

```txt
provider_id
provider_label
default_env_name
key_pattern_hint
public_docs_label
target_storage_options
risk_notes
```

Example provider profiles:

```json
{
  "openai": {
    "provider_label": "OpenAI",
    "default_env_name": "OPENAI_API_KEY",
    "key_pattern_hint": "sk- or sk-proj- prefix",
    "target_storage_options": ["Cloudflare Secret", "GitHub Actions Secret", "Railway Variable", "Local .env"],
    "risk_notes": "Use only server-side. Never expose in browser code."
  },
  "github": {
    "provider_label": "GitHub",
    "default_env_name": "GITHUB_TOKEN",
    "key_pattern_hint": "ghp_, github_pat_, ghs_, or fine-grained token pattern",
    "target_storage_options": ["GitHub Actions Secret", "Cloudflare Secret", "Local .env"],
    "risk_notes": "Prefer GitHub App or SSH for repository operations. Avoid broad personal access tokens."
  },
  "cloudflare": {
    "provider_label": "Cloudflare",
    "default_env_name": "CLOUDFLARE_API_TOKEN",
    "key_pattern_hint": "account-scoped API token",
    "target_storage_options": ["Local .env", "GitHub Actions Secret", "CI Secret"],
    "risk_notes": "Use least-privilege tokens. Do not put Cloudflare tokens in public runtime."
  }
}
```

---

## 7. Public UI surface

Recommended public route:

```txt
/tools/secret-handoff
```

Fallback static page if routing stays simple:

```txt
secret-handoff.html
```

Admin entry point may link to the same tool:

```txt
/admin → Secret Handoff Converter
```

Public page sections:

```txt
1. What this tool does
2. Provider selector
3. Secret input box
4. Target selector
5. Environment variable name
6. Generate Safe Handoff button
7. Safe output panel
8. Copy button
9. Clear secret button
10. Security notes
```

---

## 8. Input form V1

Required fields:

```txt
Provider: select
Secret value: password textarea/input
Target storage: select
Environment variable name: text input
```

Optional fields:

```txt
Project name
Runtime target
Allowed AI tool name
Owner note
Expiry reminder
```

Default selections:

```txt
Provider: OpenAI
Target storage: Cloudflare Worker Secret
Environment variable name: OPENAI_API_KEY
Runtime target: Cloudflare Worker
```

---

## 9. Local-only processing requirements

The page JavaScript may calculate:

```txt
masked_preview
secret_length
secret_prefix_family
sha256_fingerprint
created_at
package_id
```

Use Web Crypto API for SHA-256 in the browser.

Pseudo flow:

```js
const raw = secretInput.value;
const fingerprint = await sha256(raw);
const preview = maskSecret(raw);
const handoff = buildSafePackage({ provider, target, envName, preview, fingerprint });
secretInput.value = '';
render(handoff);
```

Important: do not send `raw` to any server endpoint in V1.

---

## 10. Masking rules

The masked preview should expose only enough to help the user identify which key was used.

Recommended format:

```txt
<prefix>••••••••••••<last4>
```

Examples:

```txt
sk-proj-••••••••••••7KpQ
github_pat_••••••••••••9x4A
cf_••••••••••••a8D2
```

If the secret is very short, do not show last characters.

```txt
••••••••
```

---

## 11. Fingerprint rules

Fingerprint format:

```txt
sha256:<first12>...<last12>
```

Example:

```txt
sha256:0b8a6fc12091...d93cbac441e2
```

The fingerprint is used only so the user can verify they are talking about the same secret later. It cannot be used as the key.

---

## 12. Handoff output format V1

The generated output should be copyable Markdown:

```txt
SAFE SECRET HANDOFF — RAW SECRET NOT INCLUDED

Provider: OpenAI
Target storage: Cloudflare Worker Secret
Runtime target: Cloudflare Worker
Environment variable name: OPENAI_API_KEY
Secret preview: sk-proj-••••••••••••7KpQ
Secret fingerprint: sha256:0b8a6fc12091...d93cbac441e2
Package created: 2026-09-18T00:00:00.000Z

Storage instruction:
Store the raw secret only in the selected secret manager as OPENAI_API_KEY.
Do not put the raw secret into chat, GitHub, HTML, client JavaScript, screenshots, logs, or docs.

Developer / AI instruction:
Use the secret only through env.OPENAI_API_KEY or the runtime's server-side environment binding.
Never ask the user to paste the raw secret.
Never print the raw secret.
Never commit the raw secret.
Never move the raw secret into frontend code.
If the secret is not available at runtime, report exactly which secret name is missing.

Status:
This handoff package does not contain the raw secret.
```

---

## 13. AI-readable compact format

The tool may also produce JSON for AI/developer tools:

```json
{
  "type": "safe_secret_handoff",
  "version": "v1",
  "raw_secret_included": false,
  "provider": "openai",
  "target_storage": "cloudflare_worker_secret",
  "runtime_target": "cloudflare_worker",
  "env_name": "OPENAI_API_KEY",
  "secret_preview": "sk-proj-••••••••••••7KpQ",
  "secret_fingerprint": "sha256:0b8a6fc12091...d93cbac441e2",
  "instructions": [
    "Use only server-side environment access.",
    "Never request or print the raw secret.",
    "Never commit the raw secret.",
    "Report missing secret by env_name only."
  ]
}
```

---

## 14. What AI tools should do when receiving the handoff

Claude / ChatGPT / Cursor should interpret the package as an instruction contract, not as a credential.

Correct behavior:

```txt
Read provider, target, env name, and constraints.
Write code that reads the secret from runtime env.
Tell the owner where to store the raw secret.
Never ask for the raw secret again unless the task explicitly requires dashboard setup guidance.
```

Incorrect behavior:

```txt
Ask the user to paste the raw API key.
Treat the fingerprint as a usable credential.
Try to decode the masked preview.
Suggest putting the key into client-side code.
Log the env value for debugging.
```

---

## 15. Threat model V1

Primary risks:

```txt
1. User accidentally pastes raw key into AI chat.
2. User commits raw key into GitHub.
3. UI stores raw key locally and leaks later.
4. Browser extension or screenshot captures visible key.
5. Server logs capture key if submitted to backend.
6. AI misunderstands masked preview as usable key.
```

V1 mitigations:

```txt
1. Local-only processing.
2. Password-style input by default.
3. Clear input immediately after generation.
4. Output never contains raw secret.
5. Security warnings shown near copy button.
6. Handoff states raw_secret_included=false.
```

Known V1 limitations:

```txt
Browser-local processing cannot protect against compromised devices or malicious browser extensions.
Fingerprint identifies the secret but does not validate provider permissions.
The tool cannot verify whether the secret works unless a future optional server-side validation mode is added.
```

---

## 16. Copy states

Copy button states:

```txt
Copy Safe Handoff
Copied
Copy failed — select manually
```

Clear button states:

```txt
Clear Secret
Secret cleared from this page
```

Warning text near output:

```txt
ตรวจแล้ว: output นี้ไม่มี raw secret ใช้ส่งให้ AI/dev tool ได้ แต่ยังต้องเก็บ key จริงใน secret manager เอง
```

---

## 17. Implementation plan

### Step 1 — Spec only

```txt
Create this spec.
Do not change runtime behavior.
Do not collect secrets.
```

### Step 2 — Static public page

```txt
Create secret-handoff.html.
Add client-only JS.
No API route.
No external network request.
Add link from tools.html and /admin.
```

### Step 3 — Admin integration

```txt
Add /admin card linking to Secret Handoff Converter.
Keep admin GitHub auth separate.
Do not mix public converter with admin write actions.
```

### Step 4 — Optional Sealed Secret V2

```txt
Add asymmetric encryption using a public key for a specific receiving runtime.
Only the server/runtime with the private key can decrypt.
Do not build V2 until V1 is stable.
```

---

## 18. Acceptance criteria for V1 page

V1 page is acceptable only if all are true:

```txt
✓ Works offline after page load.
✓ Does not call fetch/XHR/WebSocket/sendBeacon with raw secret.
✓ Does not store raw secret in localStorage/sessionStorage/cookie.
✓ Generated Markdown contains no raw secret.
✓ Generated JSON contains raw_secret_included=false.
✓ Clear button removes the input value.
✓ UI explicitly says this does not install the secret automatically.
✓ UI explains where the user must store the real secret.
✓ Page works on 393px mobile width.
```

---

## 19. Recommended first public copy

Hero headline:

```txt
Secret Handoff Converter
```

Hero subcopy:

```txt
แปลง API key ให้เป็นชุดคำสั่งส่งต่อให้ AI/dev tools โดยไม่แนบ secret จริง
```

Primary CTA:

```txt
Generate Safe Handoff
```

Security line:

```txt
Local-only · no storage · raw secret not included
```

Thai helper text:

```txt
วาง key เพื่อสร้าง preview + fingerprint + วิธีตั้งค่า env เท่านั้น ระบบจะไม่บันทึกและไม่ส่ง key เข้า server ใน V1
```

---

## 20. One-line instruction for future implementation

```txt
Build Secret Handoff Converter V1 as a client-only public tool that turns a pasted raw secret into a masked, fingerprinted, AI-readable handoff package, without sending, storing, logging, or outputting the raw secret.
```
