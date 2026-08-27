import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findOutboundSecret, sanitize } from './kstack-safety-matchers.mjs';

const WORKER_OUTPUT_LIMIT = 64 * 1024;
const WORKER_TIMEOUT_MS = 120_000;
export const SAFETY_EXECUTOR_ERROR_CODES = Object.freeze([
  'KSG-CREDENTIAL-STORE-UNAVAILABLE-001', 'KSG-CREDENTIAL-STORE-UNTRUSTED-001',
  'KSG-CREDENTIAL-STORE-MALFORMED-001', 'KSG-CREDENTIAL-TARGET-001',
  'KSG-CREDENTIAL-NOT-USED-001', 'KSG-GIT-EXECUTE-001', 'KSG-GIT-PUSH-FAILED-001',
  'KSG-GIT-COMMIT-FAILED-001',
  'KSG-WORKER-PROTOCOL-001', 'KSG-WORKER-ISOLATION-001',
  'KSG-EXECUTOR-ACTION-UNAVAILABLE-001', 'KSG-EXECUTE-FAILED-001'
]);
const EXECUTOR_CODES = new Set(SAFETY_EXECUTOR_ERROR_CODES);
const WORKER_FILE = fileURLToPath(new URL('./kstack-safety-worker.mjs', import.meta.url));

export class SafetyExecutorError extends Error {
  constructor(code, { ambiguous = false } = {}) {
    super(EXECUTOR_CODES.has(code) ? code : 'KSG-EXECUTE-FAILED-001');
    this.name = 'SafetyExecutorError';
    this.code = this.message;
    this.ambiguous = ambiguous === true;
  }
}

function fail(code, options) { throw new SafetyExecutorError(code, options); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, keys) { return plain(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0'); }

export function defaultGitPushCredentialPath(environment = process.env, platform = process.platform) {
  let base = null;
  if (platform === 'win32') base = environment.APPDATA;
  else if (typeof environment.XDG_CONFIG_HOME === 'string' && path.isAbsolute(environment.XDG_CONFIG_HOME)) base = environment.XDG_CONFIG_HOME;
  else if (typeof environment.HOME === 'string' && path.isAbsolute(environment.HOME)) base = path.join(environment.HOME, '.config');
  return typeof base === 'string' && path.isAbsolute(base) ? path.join(base, 'kstack', 'credentials', 'git-push.json') : null;
}

function defaultGitBinary(platform = process.platform) {
  const candidates = platform === 'win32'
    ? []
    : ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'];
  return candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  }) ?? null;
}

function minimalWorkerEnvironment(platform = process.platform) {
  if (platform === 'win32') return Object.freeze({});
  return Object.freeze({ PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', KSTACK_SAFETY_WORKER: '1' });
}

function collect(stream, state, child) {
  stream.on('data', (chunk) => {
    if (state.overflow) return;
    state.bytes += chunk.length;
    if (state.bytes > WORKER_OUTPUT_LIMIT) {
      state.overflow = true;
      state.chunks.length = 0;
      child.kill('SIGKILL');
      return;
    }
    state.chunks.push(chunk);
  });
}

function closedWorkerResult(stdout, stderr, childPid, status, signal, overflow, request, spawned) {
  // Potential child output is never propagated. Run it through the shared
  // matcher/sanitizer before even considering the closed JSON protocol.
  const outputHasSecret = [stdout, stderr].some((bytes) => {
    if (findOutboundSecret(bytes, { byteDomain: true })) return true;
    try { sanitize(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return true; }
    return false;
  });
  if (overflow || outputHasSecret || status !== 0 || signal !== null || stderr.length !== 0) fail('KSG-WORKER-PROTOCOL-001', { ambiguous: spawned });
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(stdout)); } catch { fail('KSG-WORKER-PROTOCOL-001', { ambiguous: spawned }); }
  if (!exactKeys(value, value?.ok === true ? ['version', 'ok', 'workerPid', 'receipt'] : ['version', 'ok', 'workerPid', 'code', 'ambiguous']) || value.version !== 1 || value.workerPid !== childPid) fail('KSG-WORKER-ISOLATION-001', { ambiguous: spawned });
  if (value.ok === false) {
    if (!EXECUTOR_CODES.has(value.code) || typeof value.ambiguous !== 'boolean') fail('KSG-WORKER-PROTOCOL-001', { ambiguous: spawned });
    fail(value.code, { ambiguous: value.ambiguous });
  }
  if (request.action === 'git-push') {
    const expectedRefs = request.payload.updates.map((update) => update.destinationRef);
    if (!exactKeys(value.receipt, ['action', 'outcome', 'updateCount', 'destinationRefs']) || value.receipt.action !== 'git-push' || value.receipt.outcome !== 'pushed' || value.receipt.updateCount !== expectedRefs.length || !Array.isArray(value.receipt.destinationRefs) || value.receipt.destinationRefs.length !== expectedRefs.length || value.receipt.destinationRefs.some((item, index) => item !== expectedRefs[index])) fail('KSG-WORKER-PROTOCOL-001', { ambiguous: spawned });
    return Object.freeze({ receipt: Object.freeze({ ...value.receipt, destinationRefs: Object.freeze([...value.receipt.destinationRefs]) }) });
  }
  if (!exactKeys(value.receipt, ['action', 'outcome', 'commitOid', 'headRef']) || value.receipt.action !== 'git-commit' || value.receipt.outcome !== 'committed' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value.receipt.commitOid) || value.receipt.headRef !== request.targetId) fail('KSG-WORKER-PROTOCOL-001', { ambiguous: spawned });
  return Object.freeze({ receipt: Object.freeze({ ...value.receipt }) });
}

function killExecutionGroup(child) {
  if (!Number.isSafeInteger(child?.pid)) return;
  try {
    if (process.platform === 'win32') child.kill('SIGKILL');
    else process.kill(-child.pid, 'SIGKILL');
  } catch {}
}

async function invokeWorker(request, options) {
  if (!options.gitBinary || !path.isAbsolute(options.gitBinary)) fail('KSG-WORKER-ISOLATION-001');
  if (request.action === 'git-push' && (!options.credentialPath || !path.isAbsolute(options.credentialPath))) fail('KSG-CREDENTIAL-STORE-UNAVAILABLE-001');
  const workerFile = options.testOnlyWorkerPath ?? WORKER_FILE;
  if (!path.isAbsolute(workerFile)) fail('KSG-WORKER-ISOLATION-001');
  if (options.testOnlyWorkerPath !== undefined && process.env.NODE_ENV !== 'test') fail('KSG-WORKER-ISOLATION-001');
  const envelopeValue = { version: 1, request, gitBinary: options.gitBinary, ...(request.action === 'git-push' ? { credentialPath: options.credentialPath } : {}) };
  const envelope = Buffer.from(JSON.stringify(envelopeValue), 'utf8');
  if (envelope.length > 128 * 1024) fail('KSG-WORKER-PROTOCOL-001');
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(process.execPath, [workerFile], {
        cwd: os.tmpdir(), env: minimalWorkerEnvironment(), shell: false,
        stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32'
      });
    } catch { reject(new SafetyExecutorError('KSG-WORKER-ISOLATION-001')); return; }
    if (!Number.isSafeInteger(child.pid) || child.pid === process.pid) { child.kill('SIGKILL'); reject(new SafetyExecutorError('KSG-WORKER-ISOLATION-001')); return; }
    const stdout = { bytes: 0, chunks: [], overflow: false };
    const stderr = { bytes: 0, chunks: [], overflow: false };
    collect(child.stdout, stdout, child); collect(child.stderr, stderr, child);
    let settled = false;
    let spawned = false;
    child.once('spawn', () => { spawned = true; });
    const timer = setTimeout(() => { killExecutionGroup(child); }, options.timeoutMs);
    timer.unref?.();
    child.once('error', () => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      killExecutionGroup(child);
      reject(new SafetyExecutorError('KSG-WORKER-ISOLATION-001'));
    });
    child.once('close', (status, signal) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      killExecutionGroup(child);
      try { resolve(closedWorkerResult(Buffer.concat(stdout.chunks), Buffer.concat(stderr.chunks), child.pid, status, signal, stdout.overflow || stderr.overflow, request, spawned)); }
      catch (error) { reject(error instanceof SafetyExecutorError ? error : new SafetyExecutorError('KSG-WORKER-PROTOCOL-001')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(envelope);
  });
}

export function createProductionSafetyExecutor(options = {}) {
  const credentialPath = options.credentialPath ?? defaultGitPushCredentialPath();
  const gitBinary = options.gitBinary ?? defaultGitBinary();
  const timeoutMs = options.timeoutMs ?? WORKER_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > WORKER_TIMEOUT_MS) fail('KSG-WORKER-PROTOCOL-001');
  const closed = Object.freeze({ credentialPath, gitBinary, timeoutMs, ...(options.testOnlyWorkerPath ? { testOnlyWorkerPath: path.resolve(options.testOnlyWorkerPath) } : {}) });
  return async function productionSafetyExecutor(request) {
    if (!plain(request) || !['git-push', 'git-commit'].includes(request.action)) fail('KSG-EXECUTOR-ACTION-UNAVAILABLE-001');
    return invokeWorker(request, closed);
  };
}
