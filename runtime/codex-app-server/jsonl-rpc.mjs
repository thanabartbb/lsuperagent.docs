export class CodexRpcError extends Error {
  constructor(message, code, data) {
    super(message || 'Codex JSON-RPC error');
    this.name = 'CodexRpcError';
    this.code = code;
    this.data = data;
  }
}

export function createJsonlRpcPeer({ readable, writable, requestTimeoutMs = 30000 }) {
  let nextId = 1;
  let closed = false;
  let closeError = null;
  let buffer = '';
  const pending = new Map();
  const listeners = new Set();

  function rejectAll(error) {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  }

  function close(error = new Error('JSONL RPC peer closed')) {
    if (closed) return;
    closed = true;
    closeError = error?.message?.includes('closed') ? error : new Error(`JSONL RPC peer closed: ${error?.message || 'unknown error'}`);
    rejectAll(closeError);
  }

  function writeObject(object) {
    if (closed) throw closeError || new Error('JSONL RPC peer closed');
    writable.write(`${JSON.stringify(object)}\n`);
  }

  function request(method, params) {
    if (closed) return Promise.reject(closeError || new Error('JSONL RPC peer closed'));
    const id = nextId++;
    const message = { id, method };
    if (params !== undefined) message.params = params;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, requestTimeoutMs);
      pending.set(id, { resolve, reject, timer });
      try {
        writeObject(message);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  function notify(method, params) {
    const message = { method };
    if (params !== undefined) message.params = params;
    writeObject(message);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function handleMessage(message) {
    if (Object.prototype.hasOwnProperty.call(message, 'id') && !Object.prototype.hasOwnProperty.call(message, 'method')) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) {
        entry.reject(new CodexRpcError(message.error.message, message.error.code, message.error.data));
      } else {
        entry.resolve(message.result);
      }
      return;
    }
    for (const listener of listeners) listener(message);
  }

  readable.on('data', (chunk) => {
    if (closed) return;
    buffer += chunk.toString();
    for (;;) {
      const idx = buffer.indexOf('\n');
      if (idx < 0) break;
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        close(new Error(`Malformed JSONL from Codex app-server: ${error.message}`));
        return;
      }
      handleMessage(parsed);
    }
  });

  readable.on('error', (error) => close(error));
  writable.on('error', (error) => close(error));
  readable.on('end', () => close(new Error('JSONL RPC readable stream closed')));

  return { request, notify, subscribe, close };
}
