import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startCodexAppServer } from '../runtime/codex-app-server/client.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const defaultWorkspace = resolve(dirname(scriptPath), '../tests/fixtures/codex-workspace');
const PROBE_PROMPT = 'Read PROBE.txt from the current workspace. Return the exact marker from that file in your final answer.';
const PROBE_MARKER = 'SDKSPACE_PHASE0_OK';

export async function runProtocolProbe({
  codexBin = process.env.CODEX_BIN || 'codex',
  codexArgs = ['app-server', '--listen', 'stdio://'],
  workspace = defaultWorkspace,
  requestTimeoutMs = 30000,
  turnTimeoutMs = 120000,
} = {}) {
  const absoluteWorkspace = resolve(workspace);
  const client = startCodexAppServer({
    command: codexBin,
    commandArgs: codexArgs,
    cwd: absoluteWorkspace,
    env: process.env,
    requestTimeoutMs,
    turnTimeoutMs,
  });

  try {
    await client.initialize();
    const { threadId } = await client.startThread({ cwd: absoluteWorkspace });
    const result = await client.runTurn({ threadId, text: PROBE_PROMPT });
    if (result.status !== 'completed') {
      throw new Error(`Codex probe ended with status ${result.status}`);
    }
    if (!result.message.includes(PROBE_MARKER)) {
      const error = new Error(`Codex probe completed without marker ${PROBE_MARKER}`);
      error.code = 'codex_probe_marker_missing';
      throw error;
    }
    return { ok: true, ...result };
  } finally {
    await client.dispose();
  }
}

async function main() {
  try {
    const result = await runProtocolProbe();
    process.stdout.write(`${JSON.stringify({
      ok: result.ok,
      threadId: result.threadId,
      turnId: result.turnId,
      status: result.status,
      message: result.message,
    })}\n`);
  } catch (error) {
    const label = error?.code || error?.name || 'Error';
    const message = String(error?.message || 'Codex protocol probe failed').replace(/[\r\n]+/g, ' ').slice(0, 1200);
    process.stderr.write(`${label}: ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  await main();
}
