# BASE44 / LAB PLUG / LSUPERAGEN.DOCS — MASTER SUMMARY

> เอกสารนี้สรุปไฟล์ทั้งหมดที่เกี่ยวข้องกับงาน Base44 + LAB Plug + lsuperagen.docs ที่ตรวจในบทสนทนานี้  
> จุดประสงค์: ให้เปิดไฟล์เดียวแล้วเข้าใจว่า “ตัวไหนทำอะไร / เชื่อมกันยังไง / อะไรซ้ำ / อะไรอันตราย / อะไรควรเอาไปใช้กับ LAB Plug”

---

## 1) ภาพรวมสั้นที่สุด

ชุดไฟล์ที่ตรวจ **ไม่ใช่ปลั๊กอินกองเดียว** แต่แบ่งเป็น 6 กลุ่มใหญ่:

1. **lsuperagen.docs REF** — หน้าเว็บอ้างอิง/ดีไซน์เดิม
2. **Base44 Local CLI** — คำสั่งสร้าง/เชื่อม/พัฒนา/ซิงก์/deploy โปรเจ็กต์
3. **Base44 SDK Runtime** — API ที่แอปเรียกใช้ตอนทำงานจริง
4. **Base44 Remote Sandbox / MCP Skills** — ให้ coding agent เข้าไปอ่าน/แก้/รันใน sandbox ระยะไกล
5. **LAB Control Plane** — schema + guard สำหรับ authority/evidence/deployment/protocol ของฝั่งเรา
6. **package.7z** — snapshot codebase LSUPERAGENT แยกจาก Base44 docs

ดังนั้นสิ่งสำคัญที่สุดคือ **อย่าเอาทั้งหมดมารวมเป็น “tool เดียว”**  
ควรทำให้เป็น “ชั้น” และให้ LAB Plug เป็นตัวกลางคุมความสามารถ สิทธิ์ ความเสี่ยง และหลักฐาน

---

# 2) สถาปัตยกรรมที่เห็นจากไฟล์ทั้งหมด

```text
                        ┌─────────────────────────────┐
                        │        HUMAN / AGENT        │
                        └──────────────┬──────────────┘
                                       │
                         ┌─────────────▼─────────────┐
                         │       LAB PLUG CORE       │
                         │ registry / authority / QC │
                         └─────────────┬─────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
┌───────▼────────┐          ┌──────────▼─────────┐          ┌────────▼────────┐
│ Base44 LOCAL   │          │ Base44 REMOTE/MCP │          │ Base44 SDK      │
│ CLI workflow   │          │ Cloud Sandbox     │          │ Runtime API     │
└───────┬────────┘          └──────────┬─────────┘          └────────┬────────┘
        │                              │                              │
 create/link/dev/deploy        read/edit/run/checkpoint       auth/entities/agents
 push/pull/sync                auto-commit/auto-sync          functions/AI/connectors
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │  Base44 App / Data │
                            │ Agents / Functions │
                            │ OAuth / AI Gateway │
                            └─────────────────────┘
```

---

# 3) กฎใหญ่ข้อแรก: LOCAL กับ REMOTE SANDBOX คนละ workflow

## 3.1 Local Project Workflow

ใช้เมื่อมีไฟล์โปรเจ็กต์อยู่ในเครื่อง/CI และใช้ CLI แบบ project-level

```text
create / scaffold / link
        ↓
login / whoami
        ↓
define entities / agents / auth / connectors
        ↓
dev
        ↓
push หรือ deploy
        ↓
logs / dashboard / verify
```

คำสั่งสำคัญ:

- `base44 create` — สร้าง app/project ใหม่
- `base44 scaffold` — มี app อยู่แล้ว แต่ต้องการ local project
- `base44 link` — มี config local แล้ว แต่ยังไม่ได้ผูก app
- `base44 dev` — local backend + frontend (ถ้ากำหนด serveCommand)
- `base44 deploy` — deploy resources หลายประเภทพร้อมกัน
- `entities push` / `agents push` / `connectors push` / `auth push` — sync เฉพาะ resource

## 3.2 Remote Sandbox / MCP Workflow

ใช้เมื่อ coding agent เข้าไปทำงานใน Base44 cloud sandbox โดยตรง

```text
connect MCP / sandbox CLI
        ↓
list / read / grep
        ↓
edit_file / write_file
        ↓
auto-commit (~5s)
        ↓
resource auto-sync / auto-deploy
        ↓
build / tsc / lint / preview
        ↓
checkpoint
```

**กฎสำคัญ:** ใน sandbox การ “เขียนไฟล์ resource” คือการ ship/sync แล้ว  
ไม่ควรรัน `base44 deploy`, `entities push`, `agents push`, `create`, `scaffold` ซ้ำ

ข้อยกเว้นหลักคือ **Connectors** ซึ่งเป็น OAuth state ของ app และจัดการผ่าน MCP connector tools หรือ projectless connector CLI

---

# 4) Base44 SDK Runtime — แอปใช้ทำอะไรได้บ้าง

## 4.1 Client

Client เป็นจุดเข้า SDK

```ts
createClient({ appId })
createClientFromRequest(req)
```

โหมดหลัก:

- Anonymous — public data
- User — สิทธิ์ตามผู้ใช้
- Service Role — backend/admin context

ข้อควรจำ: parameter คือ `appId` ไม่ใช่ `clientId` หรือ `id`

---

## 4.2 Auth

ครอบคลุม:

- register
- email/password login
- OAuth login
- OTP verify/resend
- me / updateMe
- logout
- password reset/change
- invite user
- token/session

แยกสองเรื่อง:

**CLI authentication**
- `base44 login`
- `base44 logout`
- `base44 whoami`

ใช้ยืนยันตัวตนของ developer/CLI

**App authentication**
- password-login
- social-login
- SSO
- auth push/pull

ใช้กำหนดวิธีที่ผู้ใช้ app จะล็อกอิน

ข้อควรระวัง:
- SSO กับ Social Login ใน config ชุดนี้เป็น mutually exclusive
- `auth pull` overwrite local config
- `auth push` อาจทำให้ผู้ใช้ล็อกอินไม่ได้ ถ้าส่ง config ที่ไม่มี login method

---

# 5) Entities — Data Layer

Entity อยู่ใน:

```text
base44/entities/*.jsonc
```

กติกาหลัก:

- Entity name: PascalCase
- File name: kebab-case
- Field name: snake_case
- schema รูปแบบ JSON Schema-like

ตัวอย่าง:

```jsonc
{
  "name": "Task",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["todo", "doing", "done"]
    }
  },
  "required": ["title"]
}
```

Runtime SDK รองรับ:

- list / filter / get
- create / update / delete
- bulkCreate / bulkUpdate
- updateMany / deleteMany
- importEntities
- subscribe realtime

## Security ของ Entities

มีสองชั้น:

- **RLS** — คุม record/row
- **FLS** — คุม field

จุดสำคัญจากเอกสาร: ถ้า entity ไม่มี RLS ตาม reference ที่ตรวจ จะเปิดกว้างกว่าที่ควร จึงควรกำหนด access rule โดยตั้งใจ

---

# 6) Agents — มี 2 โลกที่ต้องแยก

## 6.1 Agent Configuration

ไฟล์:

```text
base44/agents/<agent_name>.jsonc
```

โครงสร้างหลัก:

```text
Agent
├── name
├── description
├── instructions
├── tool_configs
│   ├── Entity tool + allowed_operations
│   └── Backend function tool
├── memory_config
└── whatsapp_greeting
```

`allowed_operations` สามารถกำหนดได้ถึง:
- read
- create
- update
- delete

`memory_config` รองรับ:
- enabled
- global
- user
- both
- include_other_conversation_context
- memory instructions

## 6.2 Managed Conversational Agents (`base44.agents`)

Base44 เป็นคนคุม conversation loop

รองรับ:

- createConversation
- getConversations
- getConversation
- listConversations
- subscribeToConversation
- addMessage
- WhatsApp connect URL

Realtime subscription จะลดรายละเอียด tool-call บางส่วนเพื่อประสิทธิภาพ ส่วน `getConversation()` ใช้ดึงข้อมูลเต็มภายหลัง

---

# 7) AI มี 3 Surface — ห้ามปนกัน

## A. InvokeLLM

```text
integrations.Core.InvokeLLM
```

เหมาะกับ:
- model call เดียว
- text / JSON
- ไม่มี tool loop

## B. Managed Agent

```text
base44.agents
```

เหมาะกับ:
- chat/conversation
- platform คุม loop
- user คุยกับ agent โดยตรง

## C. AI Gateway / Code Agent

```text
base44.aiGateway.connection()
```

เหมาะกับ:
- backend code agent
- เราคุม tool loop เอง
- ใช้ OpenAI-compatible SDK
- Vercel AI SDK / Mastra / OpenAI-compatible clients

AI Gateway ส่งคืน:

```text
baseURL
token
```

ข้อสำคัญ:
- backend only
- no streaming ตามเอกสารชุดนี้
- ทุก step ใช้ credit
- ต้อง bound loop
- user-mode ควรเคารพ caller permissions
- service-role ต้อง scope input/tool ให้แน่นมาก

---

# 8) Functions

Backend functions:

```text
base44/functions/
```

Runtime ใช้:

```ts
base44.functions.invoke(name, data)
base44.functions.fetch(path, init)
```

Backend ใช้ `Deno.serve()` และ `createClientFromRequest(req)`

ข้อสำคัญ:
- `invoke()` ให้ response แบบ Axios-style; JSON หลักอยู่ที่ `.data`
- non-2xx จะ throw
- service-role ใช้ได้ใน backend สำหรับงาน admin
- remote sandbox mode เขียน `entry.ts` แล้ว platform sync/deploy ให้ ไม่ต้อง project deploy

---

# 9) Integrations

แบ่งเป็น:

## Core integrations

- InvokeLLM
- GenerateImage
- SendEmail
- UploadFile
- UploadPrivateFile
- CreateFileSignedUrl
- ExtractDataFromUploadedFile

## Custom integration

```ts
base44.integrations.custom.call(...)
```

ใช้ OpenAPI-style operation id เช่น:

```text
get:/contacts
post:/users/{id}
```

---

# 10) Connectors / OAuth

Connectors คือ OAuth bridge ไป third-party services

ตัวอย่างประเภทที่พบใน reference:

- GitHub
- Gmail
- Google Calendar
- Google Drive
- Google Docs
- Google Sheets
- Google Slides
- Slack / Slack Bot
- Notion
- Linear
- Microsoft Teams
- OneDrive
- SharePoint
- Salesforce
- HubSpot
- Dropbox
- Box
- Airtable
- Wix
- ฯลฯ

## Connector model

```text
Discover
   ↓
Configure type + scopes
   ↓
OAuth Human Consent
   ↓
Connected
   ↓
Backend getConnection()
   ↓
Use accessToken with external API
```

Service-role connector:

```ts
base44.asServiceRole.connectors.getConnection(type)
```

คืนค่า:
- accessToken
- connectionConfig

Base44 refresh token ให้ แต่โค้ดเราเป็นคนเรียก API ปลายทาง

### สำคัญมาก

Connector ฝั่ง service-role ที่ตรวจในเอกสารเป็น **app-scoped**  
คือบัญชีที่เชื่อมหนึ่งบัญชีอาจถูกใช้ร่วมกันทั้ง app

ใน remote/MCP mode:
- list current connectors/scopes ก่อน
- scope update เป็น declarative replacement ไม่ใช่ merge
- OAuth consent ต้องให้มนุษย์เปิด URL เอง

---

# 11) Analytics / Logs / Observability

## `analytics`

ใช้ custom event:

```text
track({ eventName, properties })
```

และมี automatic:
- initialization
- heartbeat
- session duration

## `appLogs`

ใช้:
- logUserInApp
- fetchLogs
- getStats

เหมาะกับ activity/page/feature usage

## CLI project logs

ใช้ troubleshooting backend function:

- filter error
- filter function
- time range
- preview/prod environment
- follow live logs

มี skill `base44-troubleshooter` สำหรับ flow ตรวจปัญหาโดยเฉพาะ

---

# 12) Remote Dev / MCP

Base44 remote-dev skill ระบุ MCP endpoint และ sandbox tools เช่น:

- list_directory
- read_file
- grep
- write_file
- edit_file
- run_command
- create_checkpoint
- get_app_preview_url
- get_app_status
- list_user_apps

สิทธิ์แยกประมาณ:

```text
apps:read      → อ่าน
sandbox:write  → แก้ไฟล์ / shell / checkpoint
apps:write     → connector action บางประเภท
```

Guardrails ที่สำคัญ:

- confined path
- protected `.agents/`
- mutation rate limit
- command rate limit
- builder กับ external agent เขียนพร้อมกันไม่ได้
- `BUILDER_BUSY`
- edit มี dry-run
- checkpoint มี commit hash
- auto-commit ประมาณ 5 วินาที

นี่เป็น reference ที่เหมาะมากสำหรับ LAB Plug Remote Workspace Adapter

---

# 13) Local CLI Project Lifecycle

## `create`

สร้าง app ใหม่

## `scaffold`

ใช้เมื่อ app มีอยู่แล้ว และต้องการเอา local project มาผูก

## `link`

ใช้เมื่อมี `base44/config.jsonc` แล้ว แต่ยังไม่มี `.app.jsonc`

สรุปง่าย ๆ:

```text
ไม่มี app            → create
มี app แต่ไม่มี local → scaffold
มี local config แต่ยังไม่ link → link
```

---

# 14) Deployment / Sync และระดับความเสี่ยง

| Operation | ความหมาย | Risk |
|---|---|---|
| list / whoami / dashboard | อ่าน/ตรวจสถานะ | LOW |
| dev | local execution | LOW–MEDIUM |
| auth pull | remote → local overwrite | MEDIUM |
| connectors pull | remote → local overwrite/delete | MEDIUM–HIGH |
| entities push | remote schema create/update/delete | HIGH |
| agents push | remote agent create/update/delete | HIGH |
| connectors push | OAuth + remote sync + possible delete | HIGH |
| auth push | เปลี่ยน login policy | HIGH |
| deploy | deploy หลาย resource พร้อมกัน | VERY HIGH |
| secrets delete | ลบ secret ถาวร | VERY HIGH |
| service-role actions | admin-level action | VERY HIGH |

LAB Plug จึงไม่ควรใช้ permission แค่ `read/write`

ควรแยกอย่างน้อย:

```text
READ
CREATE
MODIFY
DELETE
AUTH
SECRET
DEPLOY
SERVICE_ROLE
EXTERNAL_OAUTH
SHELL_EXEC
```

---

# 15) LAB Control Plane ที่มีอยู่แล้ว

`control-plane-agents-sdk-lab.zip` เป็นคนละส่วนกับ Base44

มันมีแนวคิดหลัก:

- Evidence
- Authority
- Entity graph
- Protocol lifecycle
- Deployment verification
- Conflict guard

ตัวอย่าง guard ที่เคยตรวจ:

- ห้าม agent สองตัวถือ MODIFY authority บน entity เดียวโดยไม่จัด conflict
- DECLARE_DONE ต้องมี validated evidence
- deployment VERIFIED ต้องมี provider/deployment evidence
- authoritative evidence มี priority

นี่เหมาะเป็น **policy/control layer ที่ครอบ Base44/MCP/SDK/plugin อื่น ๆ**

---

# 16) LAB Plug ที่ควรสกัดจากทั้งหมด

แนวคิดเป้าหมาย:

```text
LAB PLUG
│
├── Capability Registry
│   ├── id
│   ├── provider
│   ├── operations
│   ├── runtime
│   └── version
│
├── Auth / Permission Contract
│   ├── user
│   ├── owner
│   ├── service-role
│   ├── oauth scopes
│   └── destructive permission
│
├── Execution Adapter
│   ├── MCP
│   ├── OpenAPI
│   ├── SDK
│   ├── JSON-RPC
│   └── native connector
│
├── Risk Guard
│   ├── read
│   ├── write
│   ├── delete
│   ├── deploy
│   ├── secret
│   └── shell
│
├── Evidence
│   ├── runtime trace
│   ├── deployment log
│   ├── CI
│   ├── schema
│   └── API contract
│
└── Result Envelope
    ├── status
    ├── data
    ├── error
    ├── evidence
    └── side_effects
```

---

# 17) lsuperagen.docs REF — เก็บแยก

Canonical REF:

```text
index.html
changelog.html
examples.html
api.html
getting-started.html
login.html
wrangler.toml
```

หน้าที่คือ:
- UI/reference
- docs presentation
- Cloudflare/static assets configuration

**ไม่ควรเอาไปปนกับ Base44 plugin/runtime inventory**

ไฟล์ที่เคยพบซ้ำแน่นอน:
- `changelog-1.html` = `changelog.html`
- `getting-started-1.html` = `getting-started.html`

---

# 18) Duplicate Audit

ตัวซ้ำที่ยืนยันแล้ว:

- `changelog-1.html` ↔ `changelog.html`
- `getting-started-1.html` ↔ `getting-started.html`
- `base44-logo.png` จำนวน 3 copies
- `entities-push.md` จำนวน 2 copies
- `entities-create.md` จำนวน 2 copies
- `eject.md` จำนวน 2 copies
- `dev.md` จำนวน 2 copies
- `deploy.md` จำนวน 2 copies
- `agents-push.md` มีการส่งซ้ำ
- `QUICK_REFERENCE.md` มีการส่งซ้ำ

### `SKILL.md` ไม่ควร dedupe จากชื่อไฟล์

ไฟล์ชื่อเหมือนกัน แต่เป็นคนละ skill:

```text
base44-remote-dev/SKILL.md
base44-sandbox/SKILL.md
base44-sdk/SKILL.md
base44-troubleshooter/SKILL.md
```

ต้องแยกตาม `name:` ใน frontmatter ไม่ใช่ basename

---

# 19) Source Map — ตัวไหนเป็นตัวไหน

## A. Base44 CLI / Configuration

| File | หน้าที่ |
|---|---|
| `create.md` | สร้าง app/project ใหม่ |
| `scaffold.md` | setup local project สำหรับ app ที่มีอยู่ |
| `link.md` | link local config กับ remote app |
| `dev.md` | local development |
| `deploy.md` | deploy resources |
| `dashboard.md` | เปิด management dashboard |
| `eject.md` | ดาวน์โหลด/clone managed project |
| `entities-create.md` | schema authoring |
| `entities-push.md` | local → remote schema sync |
| `rls-examples.md` | RLS patterns |
| `agents-push.md` | local → remote agent sync |
| `connectors-create.md` | connector config |
| `connectors-list-available.md` | catalog discovery |
| `connectors-push.md` | local → remote connector sync/OAuth |
| `connectors-pull.md` | remote → local connector sync |
| `auth-login.md` | CLI login |
| `auth-logout.md` | CLI logout |
| `auth-whoami.md` | CLI identity check |
| `auth-password-login.md` | app password auth config |
| `auth-social-login.md` | app social OAuth config |
| `auth-sso.md` | app SSO/OIDC config |
| `auth-push.md` | local auth config → remote |
| `auth-pull.md` | remote auth config → local |
| `secrets-list.md` | list secret names |
| `secrets-delete.md` | delete secret |
| `project-logs.md` | backend function logs |

## B. Base44 SDK Runtime References

| File | หน้าที่ |
|---|---|
| `QUICK_REFERENCE.md` | method cheat-sheet |
| `client.md` | SDK client setup/auth modes |
| `auth.md` | user auth SDK |
| `entities.md` | CRUD/realtime data SDK |
| `functions.md` | backend function invocation |
| `integrations.md` | core/custom integrations |
| `base44-agents.md` | managed agent conversations |
| `ai-gateway.md` | code-agent gateway |
| `connectors.md` | service-role OAuth connectors |
| `sso.md` | service-role SSO token |
| `users.md` | user invitations |
| `analytics.md` | custom analytics |
| `app-logs.md` | activity logs/stats |

## C. Skills

| Skill | หน้าที่ |
|---|---|
| `base44-sdk` | เขียน feature ด้วย SDK แบบตรวจ API จริงก่อน |
| `base44-remote-dev` | เชื่อม MCP/sandbox และ remote coding workflow |
| `base44-sandbox` | กฎ author resource ใน cloud sandbox |
| `base44-troubleshooter` | ตรวจ production/backend function logs |

## D. ฝั่งเรา

| File | หน้าที่ |
|---|---|
| `control-plane-agents-sdk-lab.zip` | LAB authority/evidence/protocol/deployment control plane |
| `package.7z` | LSUPERAGENT code snapshot จาก Drive; แยกจาก Base44 docs |
| `lsuperagen.docs REF` | UI/docs reference set; แยกจาก runtime/plugin |

---

# 20) สิ่งที่ยัง “ห้ามสรุปเกินหลักฐาน”

จากไฟล์ชุดนี้เรายืนยันได้ว่า Base44 มี catalog connectors หลายประเภท และ reference `connectors.md` แสดงรายชื่อจำนวนมาก

แต่ยัง **ไม่ควรพูดว่า “มีปลั๊กอินหลายร้อยตัว”** จากหลักฐานชุดนี้อย่างเดียว

คำว่า:
- plugin
- skill
- connector
- SDK method
- CLI command
- integration
- tool
- agent capability

เป็นคนละหน่วย ต้องนับแยกกันก่อน

---

# 21) สรุปสุดท้ายสำหรับคนเปิดมาอ่านครั้งแรก

Base44 ในไฟล์ชุดนี้คือ platform ที่มี:

```text
Project lifecycle
+ Authentication
+ Data/Entities
+ Backend Functions
+ Managed AI Agents
+ Code Agents / AI Gateway
+ OAuth Connectors
+ Integrations
+ Analytics / Logs
+ Remote MCP Sandbox
+ Skills สำหรับ coding agent
```

ส่วน LAB ของเราควรอยู่ **เหนือ provider** เพื่อทำ:

```text
Normalize capability
→ Check authority
→ Assess risk
→ Execute through adapter
→ Capture evidence
→ Verify result
→ Record side effects
```

ดังนั้นทิศทางที่เหมาะที่สุดไม่ใช่ “copy Base44”

แต่คือใช้ Base44 เป็น **หนึ่ง provider/reference implementation** ของระบบ:

> **Universal Plugin Runtime + Control Plane**

ที่วันหลังสามารถเสียบ Base44, MCP, OpenAPI, GitHub, Google, Slack, custom server หรือ provider อื่นโดยไม่ทำให้ architecture แตกเป็นกอง

---

# 22) Canonical Rules ที่ควรล็อกไว้ต่อจากนี้

1. อ่าน source ก่อนเขียน code
2. แยก Local CLI กับ Remote Sandbox เสมอ
3. ห้ามเดา method name
4. Read ก่อน Write
5. ทุก destructive action ต้องรู้ side effect
6. OAuth ต้องรู้ scope และ account owner
7. Service Role ต้องถือเป็น privileged execution
8. Push/Pull ไม่ได้แปลว่า harmless sync
9. Skill identity ดูจาก `name:` ไม่ใช่ `SKILL.md`
10. Docs REF / Base44 / LAB Control Plane / LSUPERAGENT codebase ต้องแยก namespace
11. ถ้ายังไม่ได้ทดสอบ ให้ระบุว่า “ยังไม่ยืนยัน”
12. Deployment verification ต้องใช้ evidence ไม่ใช่แค่เห็นหน้าเว็บเปิดได้

---

## END

สถานะเอกสาร: **Human-readable architecture summary**
โหมดการสรุป: **Source-derived; ไม่เติม capability ที่ไฟล์ไม่ได้รองรับ**
