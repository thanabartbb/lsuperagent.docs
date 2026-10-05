const WORKSPACE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const RUNTIME_URL = 'https://sdkspace-runtime.internal/v1/code/turn';

const ERROR_POLICY = Object.freeze({
  runtime_busy: { retryable: true, httpStatus: 409, message: 'The code runtime is busy. Please retry shortly.' },
  runtime_unavailable: { retryable: true, httpStatus: 503, message: 'The code runtime is temporarily unavailable.' },
  runtime_timeout: { retryable: true, httpStatus: 504, message: 'The code runtime timed out.' },
  runtime_turn_failed: { retryable: true, httpStatus: 502, message: 'The code runtime could not complete this turn.' },
  runtime_invalid_request: { retryable: false, httpStatus: 502, message: 'The code runtime rejected the request.' },
  runtime_unsupported_request: { retryable: false, httpStatus: 502, message: 'The code runtime requested an unsupported operation.' },
  runtime_invalid_response: { retryable: false, httpStatus: 502, message: 'The code runtime returned an invalid response.' },
  runtime_internal: { retryable: false, httpStatus: 502, message: 'The code runtime failed.' },
});

export class CodexRuntimeGatewayError extends Error {
  constructor(code, message, retryable = false, httpStatus = 502) {
    super(message);
    this.name = 'CodexRuntimeGatewayError';
    this.code = code;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
  }

  toJSON() {
    return {
      code: this.code,
      retryable: this.retryable,
      httpStatus: this.httpStatus,
    };
  }
}

function gatewayError(code) {
  const policy = ERROR_POLICY[code] || ERROR_POLICY.runtime_invalid_response;
  const safeCode = ERROR_POLICY[code] ? code : 'runtime_invalid_response';
  return new CodexRuntimeGatewayError(safeCode, policy.message, policy.retryable, policy.httpStatus);
}

export function codexRuntimeEnabled(env) {
  const value = typeof env?.CODEX_RUNTIME_ENABLED === 'string'
    ? env.CODEX_RUNTIME_ENABLED.trim().toLowerCase()
    : '';
  return value === '1' || value === 'true';
}

export function validWorkspaceId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized === '.' || normalized === '..') return null;
  return WORKSPACE_ID_RE.test(normalized) ? normalized : null;
}

export function shouldUseCodexRuntime({ env, tool, provider, workspaceId, attachmentCount } = {}) {
  return Boolean(
    tool === 'code' &&
    provider === 'openai' &&
    codexRuntimeEnabled(env) &&
    env?.CODEX_RUNTIME &&
    typeof env.CODEX_RUNTIME.fetch === 'function' &&
    validWorkspaceId(workspaceId) &&
    attachmentCount === 0
  );
}

function validateRuntimeCall({ env, sessionId, workspaceId, message, requestId } = {}) {
  if (!env?.CODEX_RUNTIME || typeof env.CODEX_RUNTIME.fetch !== 'function') throw gatewayError('runtime_unavailable');
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw gatewayError('runtime_invalid_request');
  const safeWorkspaceId = validWorkspaceId(workspaceId);
  if (!safeWorkspaceId) throw gatewayError('runtime_invalid_request');
  if (typeof message !== 'string' || !message.trim()) throw gatewayError('runtime_invalid_request');
  if (typeof requestId !== 'string' || !requestId.trim()) throw gatewayError('runtime_invalid_request');
  return {
    sessionId: sessionId.trim(),
    workspaceId: safeWorkspaceId,
    message,
    requestId: requestId.trim(),
  };
}

function normalizeSuccess(data) {
  if (
    !data ||
    data.ok !== true ||
    data.runtime !== 'codex' ||
    data.status !== 'completed' ||
    typeof data.threadId !== 'string' || !data.threadId.trim() ||
    typeof data.turnId !== 'string' || !data.turnId.trim() ||
    typeof data.message !== 'string' || !data.message.trim()
  ) throw gatewayError('runtime_invalid_response');

  return {
    ok: true,
    runtime: 'codex',
    threadId: data.threadId.trim(),
    turnId: data.turnId.trim(),
    status: 'completed',
    message: data.message.trim(),
  };
}

export async function callCodexRuntime(input) {
  const payload = validateRuntimeCall(input);
  let response;
  try {
    response = await input.env.CODEX_RUNTIME.fetch(new Request(RUNTIME_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    }));
  } catch {
    throw gatewayError('runtime_unavailable');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw gatewayError('runtime_invalid_response');
  }

  if (response.ok) return normalizeSuccess(data);
  throw gatewayError(typeof data?.code === 'string' ? data.code : 'runtime_invalid_response');
}
