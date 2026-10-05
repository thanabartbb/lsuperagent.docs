import readline from 'node:readline';

const mode = process.env.FAKE_CODEX_MODE || 'normal';
if (mode === 'early-exit') process.exit(7);

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let initialized = false;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function rpcError(id, message) {
  send({ id, error: { code: -32600, message } });
}

for await (const line of rl) {
  if (!line.trim()) continue;
  const message = JSON.parse(line);

  if (message.method === 'initialize') {
    const info = message.params?.clientInfo;
    if (info?.name !== 'sdkspace' || info?.title !== 'SDKSPACE' || info?.version !== '0.1.0-phase0') {
      rpcError(message.id, 'bad initialize metadata');
      continue;
    }
    send({ id: message.id, result: { userAgent: 'fake-codex/phase0' } });
    continue;
  }

  if (message.method === 'initialized') {
    if ('params' in message) {
      process.stdout.write('{not-json}\n');
      continue;
    }
    initialized = true;
    continue;
  }

  if (message.method === 'thread/start') {
    if (!initialized) {
      rpcError(message.id, 'not initialized');
      continue;
    }
    const p = message.params || {};
    if (p.sandbox !== 'read-only' || p.approvalPolicy !== 'never' || p.ephemeral !== true || !p.cwd) {
      rpcError(message.id, 'bad thread params');
      continue;
    }
    send({ id: message.id, result: { thread: { id: 'thread-phase0' } } });
    continue;
  }

  if (message.method === 'turn/start') {
    const p = message.params || {};
    if (p.threadId !== 'thread-phase0' || p.input?.[0]?.type !== 'text' || typeof p.input?.[0]?.text !== 'string') {
      rpcError(message.id, 'bad turn params');
      continue;
    }
    send({ id: message.id, result: { turn: { id: 'turn-phase0' } } });

    if (mode === 'server-request') {
      send({ id: 9001, method: 'item/commandExecution/requestApproval', params: { threadId: 'thread-phase0', turnId: 'turn-phase0' } });
      continue;
    }
    if (mode === 'malformed-output') {
      process.stdout.write('{bad-json}\n');
      continue;
    }
    if (mode === 'no-completion') {
      send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-phase0', turnId: 'turn-phase0', itemId: 'item-1', delta: 'waiting' } });
      continue;
    }

    send({ method: 'item/agentMessage/delta', params: { threadId: 'other-thread', turnId: 'other-turn', itemId: 'noise', delta: 'SHOULD_NOT_APPEAR' } });
    send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-phase0', turnId: 'turn-phase0', itemId: 'item-1', delta: 'SDKSPACE_' } });
    send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-phase0', turnId: 'turn-phase0', itemId: 'item-1', delta: 'PHASE0_OK' } });
    const status = mode === 'failed-turn' ? 'failed' : mode === 'interrupted-turn' ? 'interrupted' : 'completed';
    send({
      method: 'turn/completed',
      params: {
        threadId: 'thread-phase0',
        turn: { id: 'turn-phase0', items: [], itemsView: 'full', status, error: status === 'completed' ? null : { message: `${status} for test` }, startedAt: 1, completedAt: 2, durationMs: 1 }
      }
    });
    continue;
  }

  if ('id' in message) rpcError(message.id, `unsupported method: ${message.method}`);
}
