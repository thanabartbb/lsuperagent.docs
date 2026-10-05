import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createJsonlRpcPeer, CodexRpcError } from '../runtime/codex-app-server/jsonl-rpc.mjs';

function linesFrom(stream) {
  let buffer = '';
  const lines = [];
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    for (;;) {
      const idx = buffer.indexOf('\n');
      if (idx < 0) break;
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line) lines.push(JSON.parse(line));
    }
  });
  return lines;
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('jsonl rpc correlates out-of-order responses by id', async () => {
  const serverToClient = new PassThrough();
  const clientToServer = new PassThrough();
  const outbound = linesFrom(clientToServer);
  const peer = createJsonlRpcPeer({ readable: serverToClient, writable: clientToServer, requestTimeoutMs: 500 });

  const first = peer.request('first', { n: 1 });
  const second = peer.request('second', { n: 2 });
  await tick();

  assert.equal(outbound.length, 2);
  assert.equal(outbound[0].id, 1);
  assert.equal(outbound[1].id, 2);

  serverToClient.write(JSON.stringify({ id: 2, result: 'two' }) + '\n');
  serverToClient.write(JSON.stringify({ id: 1, result: 'one' }) + '\n');

  assert.equal(await first, 'one');
  assert.equal(await second, 'two');
  peer.close();
});

test('jsonl rpc initialized notification omits params when omitted', async () => {
  const serverToClient = new PassThrough();
  const clientToServer = new PassThrough();
  const outbound = linesFrom(clientToServer);
  const peer = createJsonlRpcPeer({ readable: serverToClient, writable: clientToServer, requestTimeoutMs: 500 });

  peer.notify('initialized');
  await tick();

  assert.deepEqual(outbound, [{ method: 'initialized' }]);
  peer.close();
});

test('jsonl rpc rejects pending requests on malformed non-empty line', async () => {
  const serverToClient = new PassThrough();
  const clientToServer = new PassThrough();
  const peer = createJsonlRpcPeer({ readable: serverToClient, writable: clientToServer, requestTimeoutMs: 500 });

  const pending = peer.request('wait', {});
  serverToClient.write('{not-json}\n');

  await assert.rejects(pending, /malformed jsonl/i);
  await assert.rejects(() => peer.request('later', {}), /closed/i);
});

test('jsonl rpc rejects one request after requestTimeoutMs', async () => {
  const serverToClient = new PassThrough();
  const clientToServer = new PassThrough();
  const peer = createJsonlRpcPeer({ readable: serverToClient, writable: clientToServer, requestTimeoutMs: 20 });

  await assert.rejects(peer.request('never', {}), /timed out/i);
  peer.close();
});

test('jsonl rpc exposes json-rpc error code and data', async () => {
  const serverToClient = new PassThrough();
  const clientToServer = new PassThrough();
  const peer = createJsonlRpcPeer({ readable: serverToClient, writable: clientToServer, requestTimeoutMs: 500 });

  const pending = peer.request('bad', {});
  serverToClient.write(JSON.stringify({ id: 1, error: { code: -32600, message: 'bad request', data: { kind: 'invalid' } } }) + '\n');

  await assert.rejects(pending, (error) => {
    assert.ok(error instanceof CodexRpcError);
    assert.equal(error.code, -32600);
    assert.deepEqual(error.data, { kind: 'invalid' });
    return true;
  });
  peer.close();
});

test('jsonl rpc close rejects all pending requests', async () => {
  const serverToClient = new PassThrough();
  const clientToServer = new PassThrough();
  const peer = createJsonlRpcPeer({ readable: serverToClient, writable: clientToServer, requestTimeoutMs: 500 });

  const first = peer.request('a', {});
  const second = peer.request('b', {});
  peer.close(new Error('closed for test'));

  await assert.rejects(first, /closed for test/);
  await assert.rejects(second, /closed for test/);
});
