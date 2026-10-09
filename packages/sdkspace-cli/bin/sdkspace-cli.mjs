#!/usr/bin/env node
import { cp, mkdtemp, readFile, rename, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.2.0';
const TEMPLATES = Object.freeze({ next: 'Next.js 16 application with an authenticated, server-side SDKSPACE chat route', worker: 'Cloudflare Worker API with a protected SDKSPACE chat route' });
const PROJECT_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const USAGE = `SDKSPACE CLI v${VERSION}

Usage:
  sdkspace init <project-name> [--template next|worker]
  sdkspace templates
  sdkspace health
  sdkspace me
  sdkspace chat <message>
  sdkspace image <prompt>
  sdkspace version
  sdkspace help

API commands use SDKSPACE_API_KEY from the environment (except health).
The project generator never fetches or embeds credentials. Templates are local and versioned.
`;

function failure(message) { throw new Error(message); }
function baseUrl() {
  const value = process.env.SDKSPACE_API_BASE_URL || 'https://agents-sdk.space';
  let url;
  try { url = new URL(value); } catch { failure('Invalid SDKSPACE_API_BASE_URL'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    failure('SDKSPACE_API_BASE_URL must be an HTTPS origin (HTTP only for localhost)');
  }
  return url.origin;
}

async function api(command, args) {
  const routes = { health: ['GET', '/v1/health'], me: ['GET', '/v1/me'], chat: ['POST', '/v1/chat'], image: ['POST', '/v1/image'] };
  const [method, route] = routes[command];
  const headers = { accept: 'application/json' };
  if (command !== 'health') {
    const key = process.env.SDKSPACE_API_KEY;
    if (!key || !key.startsWith('lsg_')) failure('Set a signed lsg_ key in SDKSPACE_API_KEY. Create it at https://agents-sdk.space/keys');
    headers.authorization = `Bearer ${key}`;
  }
  let body;
  if (method === 'POST') {
    const value = args.join(' ').trim();
    if (!value) failure(`Provide a ${command === 'chat' ? 'message' : 'prompt'}`);
    headers['content-type'] = 'application/json';
    body = JSON.stringify(command === 'chat' ? { message: value, stream: false } : { prompt: value });
  }
  const response = await fetch(`${baseUrl()}${route}`, { method, headers, body, signal: AbortSignal.timeout(120000) });
  console.log(await response.text());
  if (!response.ok) process.exitCode = 1;
}

async function init(args) {
  const name = args[0];
  if (!name || !PROJECT_NAME.test(name) || name.length > 64) failure('Project name must be 1-64 lowercase letters, digits and hyphens, starting with a letter');
  let template = 'next';
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--template' && args[i + 1]) { template = args[++i]; continue; }
    failure(`Unknown init argument: ${args[i]}`);
  }
  if (!Object.hasOwn(TEMPLATES, template)) failure(`Unknown template: ${template}. Run sdkspace templates`);
  const target = path.join(process.cwd(), name);
  if (existsSync(target)) failure(`Target already exists: ${target}. No files were overwritten.`);
  const source = fileURLToPath(new URL(`../templates/${template}/`, import.meta.url));
  if (!(await stat(source)).isDirectory()) failure(`Template files not found: ${template}`);
  const temp = await mkdtemp(path.join(process.cwd(), '.sdkspace-create-'));
  const staged = path.join(temp, 'payload');
  try {
    await cp(source, staged, { recursive: true, force: false, errorOnExist: true });
    const pkgPath = path.join(staged, 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    pkg.name = name;
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    await rename(path.join(staged, 'gitignore.template'), path.join(staged, '.gitignore'));
    for (const filename of template === 'worker' ? ['README.md', 'wrangler.toml'] : ['README.md']) {
      const f = path.join(staged, filename);
      await writeFile(f, (await readFile(f, 'utf8')).replaceAll('__PROJECT_NAME__', name));
    }
    if (existsSync(target)) failure(`Target already exists: ${target}. No files were overwritten.`);
    await rename(staged, target);
    console.log(`Created ${name} from SDKSPACE ${template} template.\ncd ${name}\nnpm install\nSee README.md for credentials and launch steps.`);
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  if (command === 'help' || command === '--help' || command === '-h') { console.log(USAGE); return; }
  if (command === 'version' || command === '--version' || command === '-v') { console.log(VERSION); return; }
  if (command === 'templates') { for (const [name, description] of Object.entries(TEMPLATES)) console.log(`${name}: ${description}`); return; }
  if (command === 'init' || command === 'create') { await init(args); return; }
  if (['health', 'me', 'chat', 'image'].includes(command)) { await api(command, args); return; }
  failure(`Unknown command: ${command}\n${USAGE}`);
}

try { await main(); } catch (error) { console.error(`sdkspace: ${error.message}`); process.exitCode = 1; }
