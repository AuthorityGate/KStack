import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { assertOutboundSecretScan, sanitize } from './kstack-safety-matchers.mjs';

export { assertOutboundSecretScan, sanitize } from './kstack-safety-matchers.mjs';

const outputLimit = 4 * 1024 * 1024;

export function readCapped(file) {
  if (!fs.existsSync(file)) return '';
  const handle = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(outputLimit + 1);
    const bytes = fs.readSync(handle, buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, Math.min(bytes, outputLimit)).toString('utf8');
    return bytes > outputLimit ? `${text}\n[OUTPUT TRUNCATED]\n` : text;
  } finally {
    fs.closeSync(handle);
  }
}

export function claudeInvocationArgs(modelConfig, options = {}) {
  const args = [
    '-p', '--model', modelConfig.model || options.defaultModel,
    '--effort', modelConfig.effort || 'high',
    '--no-session-persistence', '--permission-mode', 'plan', '--tools', '',
    '--disable-slash-commands'
  ];
  if (options.hardened) args.push('--safe-mode', '--restricted', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}');
  if (options.jsonSchema) {
    args.push('--json-schema', JSON.stringify(options.jsonSchema), '--output-format', 'json');
  }
  return [...modelConfig.args, ...args];
}

export function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    let timedOut = false;
    let settled = false;
    let child;
    let stdinFd;
    let stdoutFd;
    let stderrFd;

    const finish = (details) => ({
      ...details,
      startedAt,
      durationMs: Date.now() - started,
      stdout: readCapped(options.stdoutFile),
      stderr: readCapped(options.stderrFile)
    });

    try {
      if (options.stdinFile) stdinFd = fs.openSync(options.stdinFile, 'r');
      stdoutFd = fs.openSync(options.stdoutFile, 'w', 0o600);
      stderrFd = fs.openSync(options.stderrFile, 'w', 0o600);
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: [stdinFd ?? 'ignore', stdoutFd, stderrFd],
        windowsHide: true,
        detached: options.killProcessTree === true && process.platform !== 'win32'
      });
      if (stdinFd !== undefined) fs.closeSync(stdinFd);
      fs.closeSync(stdoutFd);
      fs.closeSync(stderrFd);
      stdinFd = undefined;
      stdoutFd = undefined;
      stderrFd = undefined;
    } catch (error) {
      if (stdinFd !== undefined) fs.closeSync(stdinFd);
      if (stdoutFd !== undefined) fs.closeSync(stdoutFd);
      if (stderrFd !== undefined) fs.closeSync(stderrFd);
      resolve(finish({ status: 'unavailable', error: error.message }));
      return;
    }

    const terminate = (signal) => {
      try {
        if (options.killProcessTree === true && process.platform !== 'win32' && Number.isSafeInteger(child?.pid)) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {}
    };
    const timer = setTimeout(() => {
      timedOut = true;
      terminate('SIGTERM');
      setTimeout(() => terminate('SIGKILL'), 2000).unref();
    }, options.timeoutMs);

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(finish({ status: 'unavailable', error: error.message }));
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(finish({ status: timedOut ? 'timeout' : code === 0 ? 'complete' : 'failed', exitCode: code, signal }));
    });
  });
}

function spawnPreparedUnit(unit) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const state = {
    phase: 'initial', activeRequestId: unit.requestId, acceptanceGeneration: 0,
    committed: false, terminalKind: null, recoveryCause: null, stagingReference: unit.stdinPath,
    createdConfirmed: false, terminalObserved: false, exitCode: null, signalCode: null
  };
  let child;
  let stdoutFd;
  let stderrFd;
  try {
    stdoutFd = fs.openSync(unit.stdoutFile, 'wx', 0o600);
    stderrFd = fs.openSync(unit.stderrFile, 'wx', 0o600);
    child = spawn(unit.command, unit.args, {
      cwd: unit.cwd, env: unit.env, shell: false,
      stdio: [unit.stdinFd, stdoutFd, stderrFd], windowsHide: true
    });
    fs.closeSync(stdoutFd); fs.closeSync(stderrFd);
    stdoutFd = undefined; stderrFd = undefined;
  } catch (error) {
    if (stdoutFd !== undefined) fs.closeSync(stdoutFd);
    if (stderrFd !== undefined) fs.closeSync(stderrFd);
    state.terminalObserved = true;
    return { state, error, child: null, result: Promise.resolve({ status: 'unavailable', error: error.message, startedAt, durationMs: Date.now() - started, stdout: '', stderr: '' }) };
  }
  child.once('spawn', () => { state.createdConfirmed = true; });
  child.once('error', () => { state.terminalObserved = true; });
  child.once('exit', (code, signal) => { state.terminalObserved = true; state.exitCode = code; state.signalCode = signal; });
  const result = new Promise((resolve) => {
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 2000).unref(); }, unit.timeoutMs);
    child.once('error', (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ status: 'unavailable', error: error.message, startedAt, durationMs: Date.now() - started, stdout: readCapped(unit.stdoutFile), stderr: readCapped(unit.stderrFile) });
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ status: timedOut ? 'timeout' : code === 0 ? 'complete' : 'failed', exitCode: code, signal, startedAt, durationMs: Date.now() - started, stdout: readCapped(unit.stdoutFile), stderr: readCapped(unit.stderrFile) });
    });
  });
  return { state, child, result };
}

export async function runJointProcesses(units) {
  if (!Array.isArray(units) || units.length !== 2) throw new Error('joint provider activation requires exactly two units');
  const prepared = units.map(spawnPreparedUnit);
  await new Promise((resolve) => setImmediate(resolve));
  const canActivate = prepared.every((unit) => unit.child && unit.state.createdConfirmed && !unit.state.terminalObserved && unit.state.exitCode === null && unit.state.signalCode === null);
  if (!canActivate) {
    for (const unit of prepared) if (unit.child && !unit.state.terminalObserved) unit.child.kill('SIGTERM');
    const results = await Promise.all(prepared.map((unit) => unit.result));
    return { activated: false, states: prepared.map((unit) => Object.freeze({ ...unit.state })), results };
  }
  for (const unit of prepared) unit.state.phase = 'v2_in_flight';
  const results = await Promise.all(prepared.map((unit) => unit.result));
  results.forEach((result, index) => {
    const state = prepared[index].state;
    state.committed = true;
    state.terminalKind = result.status === 'complete' ? 'success' : 'failure';
    state.phase = result.status === 'complete' ? 'v2_committed' : 'v2_failure_committed';
  });
  return { activated: true, states: prepared.map((unit) => Object.freeze({ ...unit.state })), results };
}
