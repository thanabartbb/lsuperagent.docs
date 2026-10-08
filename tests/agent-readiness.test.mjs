import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/firebase-worker.js';
const request=(path,headers={},method='GET')=>new Request('https://agents-sdk.space'+path,{headers,method});
test('public product and trust pages are meaningful without scripts or authentication',async()=>{
 for(const path of ['/','/developers','/about','/contact','/privacy']){
  const res=await worker.fetch(request(path),{});assert.equal(res.status,200);const html=await res.text();
  const text=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,'');
  assert.ok(text.length>500);assert.match(html,/<h1>/);assert.match(html,/rel="canonical"/);assert.match(html,/application\/ld\+json/);
 }
});
test('homepage negotiates real Markdown and HTML, respects q=0, and HEAD has no body',async()=>{
 for(const [accept,type] of [['text/markdown','text/markdown'],['text/html','text/html'],['text/markdown;q=0,text/html','text/html']]){
  const res=await worker.fetch(request('/',{accept}),{});assert.equal(res.status,200);assert.ok(res.headers.get('content-type').startsWith(type));assert.equal(res.headers.get('vary'),'Accept');assert.ok((await res.text()).length>500);
 }
 const head=await worker.fetch(request('/',{},'HEAD'),{});assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('OpenAPI describes existing authenticated operations and tools match request schemas',async()=>{
 const spec=await (await worker.fetch(request('/openapi.json'),{})).json();
 assert.equal(spec.openapi,'3.1.0');assert.equal(spec.paths['/v1/health'].get.security.length,0);
 for(const [path,method] of [['/v1/me','get'],['/v1/chat','post'],['/v1/image','post']])assert.deepEqual(spec.paths[path][method].security,[{bearerAuth:[]}]);
 const tools=await (await worker.fetch(request('/tools.json'),{})).json();assert.equal(tools.length,2);
 assert.deepEqual(tools[0].function.parameters,spec.paths['/v1/chat'].post.requestBody.content['application/json'].schema);
 const denied=await worker.fetch(request('/v1/me'),{});assert.equal(denied.status,401);
});
test('discovery, sitemap and unknown API errors are machine readable',async()=>{
 assert.match(await (await worker.fetch(request('/llms.txt'),{})).text(),/When to use/);
 const sitemap=await (await worker.fetch(request('/sitemap.xml'),{})).text();assert.match(sitemap,/<urlset/);assert.equal(sitemap.includes('/chat'),false);
 assert.match(await (await worker.fetch(request('/robots.txt'),{})).text(),/Sitemap:/);
 const unknown=await worker.fetch(request('/api/nonexistent'),{});assert.equal(unknown.status,404);assert.equal((await unknown.json()).error,'not_found');
 const bad=await worker.fetch(request('/openapi.json',{},'POST'),{});assert.equal(bad.status,405);
 const cli=await worker.fetch(request('/sdkspace-cli.mjs'),{});assert.equal(cli.status,200);assert.match(await cli.text(),/SDKSPACE_API_KEY/);
});

test('public headings do not absorb paragraphs and developer links stay actionable',async()=>{
 const html=await (await worker.fetch(request('/'),{})).text();
 assert.match(html,/<h2[^>]*>What you can do<\/h2>\s*<p>Sign in/);
 assert.match(html,/<a href="\/openapi.json">OpenAPI<\/a>/);
});
