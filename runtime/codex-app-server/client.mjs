import { spawn } from 'node:child_process';
import { createJsonlRpcPeer } from './jsonl-rpc.mjs';

function makeProcessExitError(code, signal, stderrTail) {
  const suffix = code !== null ? `code ${code}` : `signal ${signal || 'unknown'}`;
  const detail = stderrTail ? `: ${stderrTail.trim().slice(-1000)}` : '';
  const error = new Error(`Codex app-server exited with ${suffix}${detail}`);
  error.code = 'codex_process_exit';
  return error;
}

function makeUnsupportedServerRequestError(method) {
  const error = new Error(`Unsupported Codex app-server request in Phase 0: ${method}`);
  error.code = 'unsupported_server_request';
  return error;
}

export function startCodexAppServer({
  command = process.env.CODEX_BIN || 'codex',
  commandArgs = ['app-server', '--listen', 'stdio://'],
  cwd = process.cwd(),
  env = process.env,
  requestTimeoutMs = 30000,
  turnTimeoutMs = 120000,
  spawnImpl = spawn,
} = {}) {
  const child = spawnImpl(command, commandArgs, {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderrTail = '';
  let fatalError = null;
  let disposed = false;
  let exited = false;
  let resolveExit;
  const exitObserved = new Promise((resolve) => { resolveExit = resolve; });

  child.stderr?.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-4096);
  });

  const peer = createJsonlRpcPeer({
    readable: child.stdout,
    writable: child.stdin,
    requestTimeoutMs,
  });

  child.on('error', (error) => {
    exited = true;
    resolveExit?.();
    fatalError = new Error(`Failed to start Codex app-server: ${error.message}`);
    fatalError.code = 'codex_process_start';
    peer.close(fatalError);
  });

  child.on('exit', (code, signal) => {
    exited = true;
    resolveExit?.();
    if (!disposed) {
      fatalError = makeProcessExitError(code, signal, stderrTail);
      peer.close(fatalError);
    }
  });

  async function rpcRequest(method, params) {
    try {
      return await peer.request(method, params);
    } catch (error) {
      if (!fatalError && /readable stream closed/i.test(error?.message || '')) {
        await Promise.race([
          exitObserved,
          new Promise((resolve) => {
            const timer = setTimeout(resolve, 25);
            timer.unref?.();
          }),
        ]);
      }
      if (fatalError) throw fatalError;
      throw error;
    }
  }

  function assertUsable() {
    if (disposed) throw new Error('Codex app-server client disposed');
    if (fatalError) throw fatalError;
  }

  async function initialize() {
    assertUsable();
    const result = await rpcRequest('initialize', {
      clientInfo: {
        name: 'sdkspace',
        title: 'SDKSPACE',
        version: '0.1.0-phase0',
      },
    });
    assertUsable();
    peer.notify('initialized');
    return result;
  }

  async function startThread({ cwd: threadCwd }) {
    assertUsable();
    const result = await rpcRequest('thread/start', {
      cwd: threadCwd,
      sandbox: 'read-only',
      approvalPolicy: 'never',
      ephemeral: true,
    });
    assertUsable();
    const threadId = result?.thread?.id;
    if (!threadId) throw new Error('Codex thread/start returned no thread id');
    return { threadId };
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    peer.close(new Error('Codex app-server client disposed'));
    if (exited) return;
    try { child.stdin?.end(); } catch {}
    try { child.kill('SIGTERM'); } catch {}
    await new Promise((resolve) => {
      if (exited) return resolve();
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
        resolve();
      }, 500);
      timer.unref?.();
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async function runTurn({ threadId, text }) {
    assertUsable();
    let turnId = null;
    let message = '';
    let settled = false;
    let completionResolve;
    let completionReject;
    const buffered = [];
    const completion = new Promise((resolve, reject) => {
      completionResolve = resolve;
      completionReject = reject;
    });

    function fail(error, tearDown = false) {
      if (settled) return;
      settled = true;
      if (tearDown) void dispose();
      completionReject(error);
    }

    function handle(messageObject) {
      if (settled) return;
      if (messageObject && Object.prototype.hasOwnProperty.call(messageObject, 'id') && messageObject.method) {
        fail(makeUnsupportedServerRequestError(messageObject.method), true);
        return;
      }
      if (!messageObject?.method) return;
      if (!turnId) {
        buffered.push(messageObject);
        return;
      }
      const params = messageObject.params || {};
      if (messageObject.method === 'item/agentMessage/delta') {
        if (params.threadId === threadId && params.turnId === turnId && typeof params.delta === 'string') {
          message += params.delta;
        }
        return;
      }
      if (messageObject.method === 'turn/completed') {
        if (params.threadId !== threadId || params.turn?.id !== turnId) return;
        const status = params.turn?.status;
        if (status !== 'completed') {
          const error = new Error(`Codex turn ${status || 'failed'}: ${params.turn?.error?.message || 'turn did not complete'}`);
          error.code = 'codex_turn_failed';
          fail(error);
          return;
        }
        settled = true;
        completionResolve({ threadId, turnId, status, message });
      }
    }

    const unsubscribe = peer.subscribe(handle);
    let timeout = null;
    try {
      const started = await rpcRequest('turn/start', {
        threadId,
        input: [{ type: 'text', text }],
      });
      assertUsable();
      turnId = started?.turn?.id;
      if (!turnId) throw new Error('Codex turn/start returned no turn id');
      for (const event of buffered.splice(0)) handle(event);
      if (!settled) {
        timeout = setTimeout(() => {
          const error = new Error(`Codex turn timed out after ${turnTimeoutMs}ms`);
          error.code = 'turn_timeout';
          fail(error, true);
        }, turnTimeoutMs);
      }
      return await completion;
    } catch (error) {
      if (!settled) fail(error);
      return await completion;
    } finally {
      if (timeout) clearTimeout(timeout);
      unsubscribe();
    }
  }

  return { initialize, startThread, runTurn, dispose };
}
