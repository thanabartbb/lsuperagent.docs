// Docs sidebar. To add a page: create docs-content/<slug>.html, then add { slug, title, icon } below.
// Group order and page order here are also the reading order used for the prev/next links.
export const NAV = [
  {
    title: 'เริ่มต้นใช้งาน',
    icon: 'rocket',
    pages: [
      { slug: 'introduction', title: 'การแนะนำ', icon: 'home' },
      { slug: 'installation', title: 'การติดตั้ง', icon: 'download' },
      { slug: 'quickstart', title: 'เริ่มต้นใน 5 นาที', icon: 'zap' },
      { slug: 'api-keys', title: 'API key', icon: 'key' }
    ]
  },
  {
    title: 'แนวคิดหลัก',
    icon: 'brain',
    pages: [
      { slug: 'client', title: 'การตั้งค่า client', icon: 'settings' },
      { slug: 'errors', title: 'การจัดการข้อผิดพลาด', icon: 'alert' },
      { slug: 'retries', title: 'Retry และ timeout', icon: 'refresh' },
      { slug: 'runtimes', title: 'Runtime ที่รองรับ', icon: 'layers' }
    ]
  },
  {
    title: 'API reference',
    icon: 'book',
    pages: [
      { slug: 'api-health', title: 'GET /health', icon: 'pulse' },
      { slug: 'api-me', title: 'GET /me', icon: 'user' },
      { slug: 'api-chat', title: 'POST /chat', icon: 'chat' },
      { slug: 'api-image', title: 'POST /image', icon: 'image' }
    ]
  },
  {
    title: 'แพลตฟอร์ม',
    icon: 'server',
    pages: [
      { slug: 'architecture', title: 'โครงสร้างระบบ (core)', icon: 'tree' },
      { slug: 'add-docs-page', title: 'เพิ่มหน้าเอกสาร', icon: 'pencil' },
      { slug: 'troubleshooting', title: 'การแก้ไขปัญหา', icon: 'wrench' },
      { slug: 'changelog', title: 'Changelog', icon: 'clock' }
    ]
  }
];

// 24x24 stroke icons (Lucide-style paths).
export const ICONS = {
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M15 8l2 2"/>',
  brain: '<path d="M12 5a3 3 0 0 0-6 .5A3 3 0 0 0 4 11a3 3 0 0 0 1 5 3 3 0 0 0 5 2 2 2 0 0 0 2-1V5zm0 0a3 3 0 0 1 6 .5 3 3 0 0 1 2 5.5 3 3 0 0 1-1 5 3 3 0 0 1-5 2 2 2 0 0 1-2-1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16m0 5v-5h5M3 12a9 9 0 0 1 15.5-6.2L21 8m0-5v5h-5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zm20 0h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  pulse: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/>',
  tree: '<path d="M4 4h6v5H4zM14 15h6v5h-6zM14 4h6v5h-6zM7 9v8.5h7M7 6.5h7"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};

export function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
