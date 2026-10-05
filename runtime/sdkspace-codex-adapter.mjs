import path from 'node:path';
import { startCodexAppServer } from './codex-app-server/client.mjs';

const ERROR_MAP = new Map([
  ['turn_timeout', ['runtime_timeout', true, 'The code runtime timed out. Please retry.']],
  ['codex_process_start', ['runtime_unavailable', true, 'The code runtime is unavailable. Please retry.']],
  ['codex_process_exit', ['runtime_unavailable', true, 'The code runtime is unavailable. Please retry.']],
  ['codex_turn_failed', ['runtime_turn_failed', true, 'The code runtime could not complete this request. Please retry.']],
  ['unsupported_server_request', ['runtime_unsupported_request', false, 'The code runtime requested an unsupported operation.']],
]);

export class SdkspaceRuntimeError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'SdkspaceRuntimeError';
    this.code = code;
    this.retryable = retryable;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      retryable: this.retryable,
      message: this.message,
    };
  }
}

function invalid(message) {
  return new SdkspaceRuntimeError('runtime_invalid_request', message, false);
}

function normalizeRuntimeError(error) {
  if (error instanceof SdkspaceRuntimeError) return error;
  const mapped = ERROR_MAP.get(error?.code);
  if (mapped) {
    const [code, retryable, message] = mapped;
    return new SdkspaceRuntimeError(code, message, retryable);
  }
  return new SdkspaceRuntimeError(
    'runtime_internal',
    'The code runtime encountered an internal error.',
    false,
  );
}

function validateTurnInput(input) {
  if (!input || typeof input !== 'object') throw invalid('A code runtime request is required.');
  if (typeof input.sessionId !== 'string' || !input.sessionId.trim()) {
    throw invalid('A non-empty sessionId is required.');
  }
  if (typeof input.workspacePath !== 'string' || !path.isAbsolute(input.workspacePath)) {
    throw invalid('workspacePath must be an absolute path.');
  }
  if (typeof input.message !== 'string' || !input.message.trim()) {
    throw invalid('A non-empty message is required.');
  }
  return {
    sessionId: input.sessionId.trim(),
    workspacePath: path.resolve(input.workspacePath),
    message: input.message,
  };
}

export function createSdkspaceCodexAdapter({
  clientFactory = startCodexAppServer,
  requestTimeoutMs = 30000,
  turnTimeoutMs = 120000,
} = {}) {
  const sessions = new Map();

  async function createEntry(sessionId, workspacePath) {
    const entry = {
      sessionId,
      workspacePath,
      client: null,
      threadId: null,
      inFlight: true,
    };
    sessions.set(sessionId, entry);
    try {
      entry.client = await clientFactory({ requestTimeoutMs, turnTimeoutMs });
      await entry.client.initialize();
      const { threadId } = await entry.client.startThread({ cwd: workspacePath });
      entry.threadId = threadId;
      return entry;
    } catch (error) {
      if (sessions.get(sessionId) === entry) sessions.delete(sessionId);
      try { await entry.client?.dispose?.(); } catch {}
      throw normalizeRuntimeError(error);
    }
  }

  async function disposeEntry(entry) {
    if (!entry) return;
    if (sessions.get(entry.sessionId) === entry) sessions.delete(entry.sessionId);
    try {
      await entry.client?.dispose?.();
    } catch {
      // Disposal is best-effort at this boundary. The registry entry is already removed.
    }
  }

  function busyError() {
    return new SdkspaceRuntimeError(
      'runtime_busy',
      'A code runtime request is already running for this session.',
      true,
    );
  }

  async function runCodeTurn(input) {
    const { sessionId, workspacePath, message } = validateTurnInput(input);
    let entry = sessions.get(sessionId);

    if (entry?.inFlight) throw busyError();

    try {
      if (entry && entry.workspacePath !== workspacePath) {
        await disposeEntry(entry);
        entry = null;
      }

      if (!entry) {
        entry = await createEntry(sessionId, workspacePath);
      } else {
        entry.inFlight = true;
      }

      const result = await entry.client.runTurn({ threadId: entry.threadId, text: message });
      return {
        ok: true,
        runtime: 'codex',
        sessionId,
        threadId: result.threadId,
        turnId: result.turnId,
        status: 'completed',
        message: typeof result.message === 'string' ? result.message : '',
      };
    } catch (error) {
      if (entry && sessions.get(sessionId) === entry) {
        await disposeEntry(entry);
      }
      throw normalizeRuntimeError(error);
    } finally {
      if (entry && sessions.get(sessionId) === entry) {
        entry.inFlight = false;
      }
    }
  }

  async function disposeSession(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId.trim()) return;
    await disposeEntry(sessions.get(sessionId.trim()));
  }

  async function disposeAll() {
    const active = [...sessions.values()];
    sessions.clear();
    await Promise.all(active.map(async (entry) => {
      try { await entry.client?.dispose?.(); } catch {}
    }));
  }

  return { runCodeTurn, disposeSession, disposeAll };
}
