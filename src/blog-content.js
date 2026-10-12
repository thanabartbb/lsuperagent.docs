// Editorial content is reviewed in Git. No generated story or unverified service status.
const p = text => ({ type: 'paragraph', text });
const h = text => ({ type: 'heading', text });
const code = (language, text) => ({ type: 'code', language, text });
export const BLOG_CATEGORIES = { til: 'Today I Learned', 'how-to': 'How-to', updates: 'OpenAI Updates', architecture: 'Architecture' };
export const BLOG_RESOURCE_GROUPS = [
  { title: 'เริ่มต้นใช้งาน', links: [
    ['ภาพรวม', '/about'], ['API', '/developers'], ['การตั้งค่าเอเจนต์ · Guide', '/guide'], ['ไดเร็กทอรีบทความ', '/blogs'], ['บันทึกการเปลี่ยนแปลง OpenAI', 'https://developers.openai.com/api/docs/changelog'], ['การสนับสนุน', '/contact'],
  ] },
  { title: 'เครื่องมือสำหรับนักพัฒนา', links: [
    ['Cloudflare CLI · Wrangler', 'https://developers.cloudflare.com/workers/wrangler/'], ['สร้าง · Workers Builds', 'https://developers.cloudflare.com/workers/ci-cd/builds/'], ['ปกป้องและเชื่อมต่อ · Bindings', 'https://developers.cloudflare.com/workers/runtime-apis/bindings/'],
  ] },
  { title: 'จัดการและสังเกต', links: [
    ['ความสามารถในการสังเกต', 'https://developers.cloudflare.com/workers/observability/'], ['การวิเคราะห์', 'https://developers.cloudflare.com/workers/observability/metrics-and-analytics/'], ['การวิเคราะห์เว็บ', 'https://developers.cloudflare.com/web-analytics/'], ['บันทึก · Workers Logs', 'https://developers.cloudflare.com/workers/observability/logs/workers-logs/'], ['การตรวจสุขภาพ SDKSPACE', '/v1/health'],
  ] },
];
export const BLOG_POSTS = [
  {
    slug: 'css-cascade-contrast', category: 'til', title: 'TIL: ปุ่มดูถูกต้องใน CSS แต่สีที่แสดงจริงอาจผิด',
    excerpt: 'บทเรียนจากการปรับ frontend ของ SDKSPACE: ตรวจ computed style หลังโหลดธีม แล้ววัด contrast จากสีที่ผู้ใช้เห็นจริง',
    published: '2026-10-12', updated: '2026-10-12', minutes: 4,
    blocks: [
      p('บทความนี้พาดูวิธีตรวจปุ่มหลัง CSS ทุกชั้นทำงานแล้ว จากงาน frontend ของ SDKSPACE ที่รวมเข้า main ผ่าน PR #51 คุณจะได้แนวทางหาต้นเหตุของสีที่ถูกทับ และวิธีตรวจให้มั่นใจว่าอ่านข้อความบนปุ่มได้จริงทั้งมือถือและ desktop'),
      h('ปัญหา'),
      p('เราเพิ่ม design tokens และกำหนดสีปุ่มไว้ใน stylesheet ชั้นใหม่ แต่ปุ่มเข้าสู่ระบบยังใช้ gradient และข้อความขาวจาก selector เดิม การเปิดไฟล์แล้วเห็นค่าสีใหม่จึงยังไม่พิสูจน์ว่า browser เลือกกฎนั้น อันดับของกฎขึ้นกับ specificity, importance และตำแหน่งที่โหลด ไม่ใช่ลำดับไฟล์อย่างเดียว'),
      p('การตรวจอัตโนมัติบางรายการประเมิน contrast บนพื้นหลัง gradient ได้ไม่ครบ จึงต้องดูภาพที่ render จริงร่วมกับค่าที่ browser คำนวณ อย่าหยุดที่การเห็น test suite เป็นสีเขียว'),
      h('วิธีแก้'),
      p('ใช้ DevTools ดู matched rules ของปุ่มก่อน แล้วปรับ selector ให้เจาะจงธีมและ component ที่ต้องการ ระวังการเพิ่ม !important ไปทุกจุด เพราะจะทำให้ตามหากฎต้นทางในรอบถัดไปยากขึ้น ควรให้สีข้อความและพื้นหลังมาจาก token คู่เดียวกัน'),
      code('javascript', 'const button = document.querySelector(".btn-primary");\nconst style = getComputedStyle(button);\nconsole.table({\n  foreground: style.color,\n  background: style.backgroundColor,\n  image: style.backgroundImage\n});'),
      p('ใน browser test ให้รอธีมที่เลือกและ document.fonts.ready ก่อนวัดสี หากต้องตรวจค่าหลัง transition สิ้นสุด ให้รอ animation จบหรือใช้ reduced motion ในการตรวจค่าปลายทาง การทดสอบนี้ควรแยกจากการตรวจว่าการเคลื่อนไหวระหว่างใช้งานทำงานถูกต้อง'),
      h('ข้อควรจำ'),
      p('ตรวจทั้ง Normal และ Docs mode เพราะ selector และสีต่างกัน ทดสอบ keyboard focus และ disabled state เพิ่มด้วย ผลรอบ frontend ที่ผ่าน 370 browser checks เป็นหลักฐานของขอบเขตนั้น ไม่ใช่ใบรับรอง WCAG ทั้งเว็บไซต์ และไม่ได้ยืนยันการเข้าสู่ระบบหรือเรียก AI จริง'),
    ],
    sources: [{ title: 'SDKSPACE frontend PR #51', url: 'https://github.com/thanabartbb/lsuperagent.docs/pull/51' }, { title: 'Material Design 3 — Color', url: 'https://m3.material.io/styles/color/overview' }],
  },
  {
    slug: 'responses-api-server', category: 'how-to', title: 'เริ่มใช้ Responses API โดยเก็บคีย์ไว้ฝั่ง server',
    excerpt: 'ตัวอย่าง Node.js แบบเล็ก พร้อมแยก OpenAI API ออกจาก SDKSPACE API และแนวทางรับมือข้อผิดพลาด',
    published: '2026-10-12', updated: '2026-10-12', minutes: 5,
    blocks: [
      p('ตัวอย่างนี้ช่วยให้ Developer เริ่มเรียก OpenAI Responses API จาก server ได้ โดยใช้ official SDK และคีย์จาก environment เหมาะสำหรับทดลองความเข้าใจเรื่อง input, output และ error ก่อนนำไปต่อในแอปของคุณ ตัวอย่างเป็นโค้ดสำหรับรันเอง ไม่ใช่ผลการเรียกบริการที่เว็บไซต์ทดสอบแล้ว'),
      h('ปัญหา'),
      p('การวาง provider key ใน JavaScript ฝั่ง browser ทำให้ผู้ใช้ดึงคีย์ออกไปได้ แม้ซ่อนช่องกรอกหรือทำ minify แล้วก็ตาม ให้ browser เรียก endpoint ของแอป และให้ server ตรวจบัญชี จำกัดการใช้ และเรียก provider แทน'),
      h('วิธีแก้'),
      p('ติดตั้ง official SDK ในโปรเจกต์ทดลอง Node.js แล้วตั้ง OPENAI_API_KEY ผ่าน secret ของ environment ที่ใช้ โค้ดด้านล่างอ่าน OPENAI_MODEL จาก environment เช่นกัน เพื่อไม่ผูกตัวอย่างกับชื่อรุ่นที่อาจเปลี่ยน availability ของบัญชี ตรวจรุ่นที่รองรับจาก model catalog ก่อนรัน'),
      code('sh', 'npm install openai\n# ตั้ง OPENAI_API_KEY และ OPENAI_MODEL ใน secret environment\nnode server-example.mjs'),
      code('javascript', 'import OpenAI from "openai";\n\nif (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {\n  throw new Error("Set OPENAI_API_KEY and OPENAI_MODEL on the server");\n}\nconst client = new OpenAI({ timeout: 30_000, maxRetries: 0 });\ntry {\n  const response = await client.responses.create({\n    model: process.env.OPENAI_MODEL,\n    input: "อธิบาย HTTP status 429 สำหรับ Developer"\n  });\n  console.log(response.output_text);\n} catch (error) {\n  console.error("Request failed", {\n    status: error.status, requestId: error.request_id\n  });\n  process.exitCode = 1;\n}'),
      p('แยกข้อความที่ส่งคืนผู้ใช้ออกจากรายละเอียดสำหรับ debug อย่าส่งคีย์หรือข้อมูล exception ทั้งก้อนกลับไปในหน้าเว็บ ถ้าเจอ 429 ให้ตรวจ rate limit และคำแนะนำการ retry ของบริการ การ retry ต้องคำนึงถึงค่าใช้จ่ายและการส่งงานซ้ำ โดยเฉพาะคำขอที่สร้างข้อมูล'),
      h('ข้อควรจำ'),
      p('OpenAI API และ SDKSPACE API เป็นคนละ contract เว็บไซต์นี้มี /v1/chat ที่ใช้ SDKSPACE key ส่วนตัวอย่างข้างบนเรียก OpenAI โดยตรงจาก server ของ Developer อย่าเปลี่ยน SDKSPACE route ให้เป็น /v1/responses โดยไม่มีการออกแบบ contract ใหม่ สำหรับ Web Search ให้ดูรายชื่อโมเดลที่รองรับ tools: [{ type: "web_search" }] และแสดง citation ที่กดเปิดได้เมื่อใช้ผลค้นหา'),
    ],
    sources: [{ title: 'OpenAI text generation — Responses API', url: 'https://developers.openai.com/api/docs/guides/text' }, { title: 'Official OpenAI Node SDK', url: 'https://github.com/openai/openai-node' }, { title: 'OpenAI model catalog', url: 'https://developers.openai.com/api/docs/models' }],
  },
  {
    slug: 'openai-update-checklist', category: 'updates', title: 'อ่านข่าว OpenAI ให้แยกประกาศ ฟีเจอร์ และตัวอย่างโค้ดออกจากกัน',
    excerpt: 'ชุดตรวจข่าวสำหรับ Developer พร้อมแหล่งทางการ และตัวอย่างความเข้าใจคลาดเคลื่อนเรื่อง Composer predictions',
    published: '2026-10-12', updated: '2026-10-12', minutes: 4,
    blocks: [
      p('ก่อนนำข่าว AI ไปเปลี่ยนโค้ดหรือแชร์ต่อ ให้แยกวันที่ประกาศ วันที่เริ่มใช้ และเงื่อนไขของบัญชี บทความนี้เป็นรายการตรวจสอบที่ทบทวนเมื่อ 12 ตุลาคม 2026 ไม่ใช่ feed ข่าวสดและไม่รับประกันว่าทุกวันต้องมีประกาศใหม่'),
      h('ปัญหา'),
      p('โพสต์สรุปมักรวมชื่อโมเดล ฟีเจอร์ใน ChatGPT และ API ไว้ในย่อหน้าเดียว จนดูเหมือนใช้แทนกันได้ทั้งหมด ชื่อที่ปรากฏในเครื่องมือเขียนโค้ดไม่ได้บอกว่าบัญชี API ของเรามีสิทธิใช้แล้ว และข้อความว่าเร็วหรือถูกลงต้องดูราคาและเงื่อนไขที่เปรียบเทียบจริง'),
      h('วิธีตรวจ'),
      p('เริ่มจาก API Changelog เพื่อดูสิ่งที่เปลี่ยน ตามด้วย model catalog และหน้าราคา ใช้ Deprecations ตรวจวันปิดบริการและเส้นทางย้ายระบบ สำหรับข่าวใหญ่ใช้ประกาศบริษัทเป็นบริบท แล้วกลับไปหาเอกสาร API ที่อธิบาย input, output และข้อจำกัด แยกโพสต์ของสมาชิกชุมชนออกจากประกาศของทีมงาน'),
      p('ตัวอย่างที่ควรแก้ก่อนแชร์: Composer predictions ใน Codex เสนอข้อความถัดไปที่คุณอาจส่งให้ Codex จากบทสนทนา ไม่ใช่การเติมโค้ดบรรทัดถัดไป การกด Tab รับคำแนะนำจึงเป็นการรับข้อความใน composer แล้วผู้ใช้ยังตรวจและแก้ก่อนส่งได้'),
      p('อีกตัวอย่างคือ Web Search: อย่าเขียนว่า gpt-4o หรือ gpt-4o-mini ทุกรุ่นค้นเว็บได้โดยตรง เอกสารปัจจุบันแยก specialized search model ใน Chat Completions กับ hosted web_search tool ใน Responses API โมเดล search-preview รุ่นเก่ามีประกาศเลิกใช้งานแล้ว ให้เลือกตามเอกสารของ API ที่เรียกจริง'),
      h('ข้อควรจำ'),
      p('บันทึก source URL และวันที่ตรวจทุกครั้ง ถ้าลิงก์หลักเปิดไม่ได้ให้ระบุว่ายังไม่ยืนยัน แทนการคัดลอกข้ออ้างจากโพสต์รอง การเผยแพร่บทความนี้ไม่ได้เปลี่ยนโมเดลหรือคอนฟิกของ SDKSPACE และไม่มีการส่ง provider request เพื่อทดสอบบทความ'),
    ],
    sources: [{ title: 'OpenAI API Changelog', url: 'https://developers.openai.com/api/docs/changelog' }, { title: 'OpenAI Deprecations', url: 'https://developers.openai.com/api/docs/deprecations' }, { title: 'Composer predictions — official help', url: 'https://help.openai.com/en/articles/20001601-composer-predictions-in-codex' }, { title: 'Web Search API guide', url: 'https://developers.openai.com/api/docs/guides/tools-web-search' }, { title: 'Developer Community announcements', url: 'https://community.openai.com/c/announcements/6' }, { title: 'DevDay 2026 Recap — 29 September 2026', url: 'https://openai.com/index/devday-2026-recap/' }],
  },
  {
    slug: 'cloudflare-workflows-map', category: 'architecture', title: 'จาก R2 upload สู่ Workflows และ Vectorize: แผนที่ก่อนเชื่อมบริการ',
    excerpt: 'จัดลำดับ R2 events, embeddings, email lifecycle และ configuration โดยแยกแผนพัฒนาออกจากบริการที่เปิดใช้งานจริง',
    published: '2026-10-12', updated: '2026-10-12', minutes: 6,
    blocks: [
      p('บทความนี้จัดลำดับข้อกำหนดที่เจ้าของ SDKSPACE ส่งมา เพื่อให้ Developer เห็นส่วนที่ต้องประกอบเข้าด้วยกัน หน้าเว็บและ OpenAI เป็นพื้นฐานเดิม ส่วน R2, Workers AI, Vectorize, Workflows และ lifecycle email เป็นการเพิ่มระบบ ไม่ใช่สิ่งที่เปิดทำงานแล้วจากการเพิ่มหน้า Blogs'),
      h('ปัญหา'),
      p('การใส่ workflows: [] ใน Wrangler เพียงอย่างเดียวไม่ได้สร้าง workflow และการประกาศ exports โดยไม่มี class ที่ Worker ส่งออกจริงไม่ใช่ขั้นตอนเชื่อม Durable Object ต้องแยก configuration, handler, trigger และการสร้าง resource ให้ตรวจได้คนละส่วน'),
      h('ลำดับการพัฒนา'),
      p('เส้นทางไฟล์เริ่มจาก R2 object-create notification ส่ง message เข้า Queue จากนั้น consumer ตรวจชนิดไฟล์ ขนาด และสิทธิของเจ้าของก่อนเริ่ม Workflow ใช้ตัวระบุ event/object version ป้องกันประมวลผลซ้ำ และกำหนดพฤติกรรมเมื่ออัปโหลดทับหรือลบไฟล์ เมื่อแตกข้อความเป็น chunks แล้วจึงให้ Workers AI สร้าง embeddings และ upsert ลง Vectorize โดยใช้ dimensions ที่ตรงกับโมเดล'),
      p('Email lifecycle แยกจาก pipeline ไฟล์ เลือกเหตุการณ์บัญชีให้ชัด ตรวจการยินยอมและการยกเลิกติดตามก่อนส่งอีเมลที่ไม่ใช่ transactional ตั้ง retry และ idempotency เพื่อไม่ส่งซ้ำ ต้องมีบริการอีเมลและ sender ที่ยืนยันแล้วก่อนเรียกส่งจริง'),
      p('Placement host ใช้ hostname พร้อม port ของบริการ layer 4 ที่มีจุดเชื่อมต่อเดียว ส่วน hostname ใช้ host ของบริการ layer 7 การตั้งค่าเหล่านี้ไม่ได้ทำให้ Worker กลายเป็นบริการนั้น และไม่ควรเติมค่าตัวอย่างลง production โดยไม่มีบริการปลายทาง'),
      h('Durable Object และฐานข้อมูล'),
      p('exports ระบุ class และ lifecycle: created, deleted, renamed, transferred หรือ expecting-transfer สำหรับ class ใหม่เลือก sqlite ส่วน legacy-kv ใช้กับ namespace เดิมตามเงื่อนไขของเอกสาร การ rename หรือ transfer ต้องวางแผนรักษาข้อมูลก่อน SDKSPACE ปัจจุบันผูก ChatAgent จาก Worker agent-starter จึงไม่ควรประกาศ class นี้ใหม่ใน docs Worker โดยอัตโนมัติ'),
      p('Hyperdrive ใช้เชื่อม Postgres ผ่าน binding และ configuration id ของบริการจริง ไม่ใช่สิ่งที่ต้องเพิ่มเพื่อเปิด Blogs ซึ่งเก็บเนื้อหาใน Git ได้อยู่แล้ว เอกสารส่งมามีรายละเอียด field ครบใน docs/cloudflare-workflows-brief-20261012.md ของ review branch'),
      h('ข้อควรจำ'),
      p('เริ่มจาก pipeline ที่ทดสอบได้หนึ่งชุดก่อน แล้วตรวจซ้ำ failure, retry, deletion, ownership และค่าใช้จ่าย อย่าแสดงว่างานเสร็จเพียงเพราะ config parse ผ่าน ไม่มี resource หรือ secrets ใดถูกสร้างจากการเผยแพร่บทความนี้'),
    ],
    sources: [{ title: 'R2 Event notifications', url: 'https://developers.cloudflare.com/r2/buckets/event-notifications/' }, { title: 'Cloudflare Workflows', url: 'https://developers.cloudflare.com/workflows/' }, { title: 'Vectorize with Workers AI', url: 'https://developers.cloudflare.com/vectorize/get-started/embeddings/' }, { title: 'Wrangler configuration', url: 'https://developers.cloudflare.com/workers/wrangler/configuration/' }, { title: 'Hyperdrive', url: 'https://developers.cloudflare.com/hyperdrive/' }],
  },
];
