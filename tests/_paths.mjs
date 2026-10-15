// Legacy static pages moved to legacy/site/ (see README). Resolve a repo path, preferring legacy/site/.
import { existsSync } from 'node:fs';
export const repoFile = (p) => {
  const legacy = new URL(`../legacy/site/${p}`, import.meta.url);
  return existsSync(legacy) ? legacy : new URL(`../${p}`, import.meta.url);
};
