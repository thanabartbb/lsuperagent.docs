import { validWorkspaceId } from './codex-runtime-gateway.js';

class CodexChatRoutingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CodexChatRoutingError';
    this.code = code;
  }
}

function invalidWorkspace() {
  return new CodexChatRoutingError('runtime_invalid_request', 'workspace_id is invalid.');
}

export function normalizeWorkspaceId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw invalidWorkspace();
  const normalized = validWorkspaceId(value);
  if (!normalized) throw invalidWorkspace();
  return normalized;
}

function b64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function deriveRuntimeSessionId({ identityKey, conversationId, workspaceId, requestId } = {}) {
  if (typeof identityKey !== 'string' || !identityKey.trim()) {
    throw new CodexChatRoutingError('runtime_invalid_request', 'Runtime identity is unavailable.');
  }
  const safeWorkspaceId = validWorkspaceId(workspaceId);
  if (!safeWorkspaceId) throw invalidWorkspace();
  const conversationScope = typeof conversationId === 'string' && conversationId.trim()
    ? `conversation:${conversationId.trim()}`
    : `request:${String(requestId || '').trim()}`;
  if (conversationScope === 'request:') {
    throw new CodexChatRoutingError('runtime_invalid_request', 'Runtime request id is unavailable.');
  }
  const material = `${identityKey.trim()}\n${conversationScope}\nworkspace:${safeWorkspaceId}`;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material)));
  return `sdkspace_${b64url(digest)}`;
}

const FALLBACK_CODES = new Set(['runtime_unavailable', 'runtime_timeout', 'runtime_turn_failed']);

export function runtimeFailurePolicy(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (FALLBACK_CODES.has(code) && error?.retryable === true) {
    return { action: 'fallback', httpStatus: null };
  }
  if (code === 'runtime_busy') return { action: 'return', httpStatus: 409 };
  if (code === 'runtime_invalid_request' || code === 'runtime_unsupported_request') {
    return { action: 'return', httpStatus: 502 };
  }
  return { action: 'return', httpStatus: 502 };
}

export function runtimeSuccessPayload(result) {
  const message = typeof result?.message === 'string' ? result.message.trim() : '';
  const threadId = typeof result?.threadId === 'string' ? result.threadId.trim() : '';
  const turnId = typeof result?.turnId === 'string' ? result.turnId.trim() : '';
  if (!message || !threadId || !turnId) {
    throw new CodexChatRoutingError('runtime_invalid_response', 'The code runtime returned an invalid response.');
  }
  return {
    ok: true,
    status: 'completed',
    message,
    output: message,
    sources: [],
    runtime: 'codex',
    thread_id: threadId,
    turn_id: turnId,
  };
}
