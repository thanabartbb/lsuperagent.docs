import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const BASE = 'https://agents-sdk.space';

function mcpRequest(payload, headers = {}) {
  return new Request(BASE + '/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload)
  });
}

test('legacy MCP clients initialize, list public tools, and call a tool', async () => {
  const initialized = await worker.fetch(mcpRequest({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } }
  }), {});
  assert.equal(initialized.status, 200);
  const init = await initialized.json();
  assert.equal(init.result.protocolVersion, '2025-11-25');
  assert.equal(init.result.serverInfo.name, 'sdkspace');

  const listed = await worker.fetch(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), {});
  const list = await listed.json();
  assert.deepEqual(list.result.tools.map((tool) => tool.name), [
    'sdkspace_overview', 'sdkspace_capabilities', 'sdkspace_connection_check'
  ]);

  const called = await worker.fetch(mcpRequest({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'sdkspace_connection_check', arguments: {} }
  }), {});
  const call = await called.json();
  assert.equal(JSON.parse(call.result.content[0].text).ok, true);
});

test('stateless MCP discovery and tool calls include the required envelope', async () => {
  const discover = await worker.fetch(mcpRequest(
    { jsonrpc: '2.0', id: 'discover', method: 'server/discover', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': {} } } },
    { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'server/discover' }
  ), {});
  assert.equal(discover.status, 200);
  const discovery = await discover.json();
  assert.equal(discovery.result.resultType, 'complete');
  assert.ok(discovery.result.supportedVersions.includes('2026-07-28'));
  assert.equal(discovery.result.cacheScope, 'public');
  assert.equal(discovery.result._meta['io.modelcontextprotocol/serverInfo'].name, 'sdkspace');

  const list = await worker.fetch(mcpRequest(
    { jsonrpc: '2.0', id: 'list', method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } },
    { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list' }
  ), {});
  const tools = await list.json();
  assert.equal(tools.result.resultType, 'complete');
  assert.equal(tools.result.tools.length, 3);
  assert.equal(tools.result.cacheScope, 'public');
  assert.equal(tools.result._meta['io.modelcontextprotocol/serverInfo'].name, 'sdkspace');

  const call = await worker.fetch(mcpRequest(
    { jsonrpc: '2.0', id: 'call', method: 'tools/call', params: { name: 'sdkspace_overview', arguments: {}, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } },
    { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call', 'mcp-name': 'sdkspace_overview' }
  ), {});
  const result = await call.json();
  assert.equal(result.result.resultType, 'complete');
  assert.match(result.result.content[0].text, /SDKSPACE/);
  assert.equal(result.result._meta['io.modelcontextprotocol/serverInfo'].name, 'sdkspace');
});

test('MCP endpoint is read-only, handles preflight, and rejects invalid requests', async () => {
  const options = await worker.fetch(new Request(BASE + '/mcp', { method: 'OPTIONS' }), {});
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), '*');

  const rejectedOrigin = await worker.fetch(mcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { origin: 'https://untrusted.example' }
  ), {});
  assert.equal(rejectedOrigin.status, 403);

  const get = await worker.fetch(new Request(BASE + '/mcp'), {});
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST, OPTIONS');

  const mismatch = await worker.fetch(mcpRequest(
    { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } },
    { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call' }
  ), {});
  assert.equal(mismatch.status, 400);
  assert.equal((await mismatch.json()).error.code, -32020);

  const modernInitialize = await worker.fetch(mcpRequest(
    { jsonrpc: '2.0', id: 'init', method: 'initialize', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } },
    { 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'initialize' }
  ), {});
  assert.equal(modernInitialize.status, 404);
});
