import { repoFile } from './_paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = (path) => readFile(repoFile(path), 'utf8');

for (const path of ['home.html', 'loading.html']) {
  test(path + ' keeps chat entry and opens an existing workspace or sign-in route', async () => {
    const html = await load(path);
    assert.match(html, /<a class="mini-card guide-link" href="\/chat" aria-label="Build Faster/);
    assert.match(html, path === 'home.html' ? /<a class="btn-primary" href="\/tools">Open Workspace<\/a>/ : /<a class="btn-primary" href="\/login">Get started<\/a>/);
    assert.doesNotMatch(html, /<a class="btn-primary" href="\/chat"/);
    assert.match(html, /<a class="mini-card guide-link" href="\/docs"/);
  });
}

test('native Next.js home matches the production chat entry behavior', async () => {
  const source = await load('next-app/app/home/page.jsx');
  assert.match(source, /<a className="home-mini" href="\/chat" aria-label="Build Faster/);
  assert.match(source, /<button className="home-primary" type="button" disabled>Coming Soon<\/button>/);
  assert.doesNotMatch(source, /<a className="home-primary" href="\/chat"/);
});
