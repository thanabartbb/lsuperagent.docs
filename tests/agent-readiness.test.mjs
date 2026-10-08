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

test('API errors have stable codes and actionable resolution hints',async()=>{
 for (const path of ['/v1/me','/v1/missing','/api/missing']) {
  const res=await worker.fetch(request(path),{});const data=await res.json();
  assert.equal(typeof data.error,'string');assert.ok(data.resolution.hint.length>20);assert.equal(data.resolution.docs,'/developers');
 }
 const method=await worker.fetch(request('/openapi.json',{},'POST'),{});assert.equal((await method.json()).resolution.docs,'/developers');
});
test('OpenAPI has unique operation descriptions, examples and correct health package schema',async()=>{
 const spec=await (await worker.fetch(request('/openapi.json'),{})).json();const ids=[];
 for(const methods of Object.values(spec.paths))for(const operation of Object.values(methods)){
  assert.ok(operation.description.length>30);ids.push(operation.operationId);
  for(const res of Object.values(operation.responses)){assert.ok(res.description);assert.ok(res.content['application/json'].schema);}
 }
 assert.equal(ids.length,new Set(ids).size);
 assert.equal(spec.paths['/v1/health'].get.responses[200].content['application/json'].schema.properties.package.type,'object');
 assert.ok(spec.paths['/v1/chat'].post.requestBody.content['application/json'].example.message);
 assert.ok(spec.paths['/v1/chat'].post.responses[429].headers['Retry-After']);
 const docs=await (await worker.fetch(request('/developers'),{})).text();assert.match(docs,/Quickstart/);assert.match(docs,/Read-only sandbox/);
});
test('prepared npm CLI matches the live download and rejects missing credentials without networking',async()=>{
 const {readFile}=await import('node:fs/promises');const {spawnSync}=await import('node:child_process');
 const file=new URL('../packages/sdkspace-cli/bin/sdkspace-cli.mjs',import.meta.url);
 const source=await readFile(file,'utf8');assert.equal(source,await (await worker.fetch(request('/sdkspace-cli.mjs'),{})).text());
 const env={...process.env};delete env.SDKSPACE_API_KEY;
 for(const args of [['me'],['unknown']]){const r=spawnSync(process.execPath,[file.pathname,...args],{env,encoding:'utf8'});assert.equal(r.status,1);assert.ok(r.stderr.length>0);}
 const pkg=JSON.parse(await readFile(new URL('../packages/sdkspace-cli/package.json',import.meta.url),'utf8'));assert.equal(pkg.homepage,'https://agents-sdk.space/developers');assert.equal(pkg.bin.sdkspace,'bin/sdkspace-cli.mjs');
});
