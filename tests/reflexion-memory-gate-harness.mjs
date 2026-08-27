import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = fs.realpathSync.native(path.join(root, 'tests', 'reflexion-memory-gate.mjs'));
if (!target.startsWith(`${root}${path.sep}`) || !fs.lstatSync(target).isFile()) {
  process.stderr.write('KSTACK_REFLEXION_MEMORY_GATE_TARGET\n');
  process.exitCode = 1;
} else {
  const environment = { ...process.env };
  for (const name of ['NODE_OPTIONS', 'NODE_PATH', 'NODE_ICU_DATA']) delete environment[name];
  const child = spawn(process.execPath, ['--expose-gc', target], { cwd: root, shell: false, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let combined = 0;
  let stderrBytes = 0;
  let retained = Buffer.alloc(0);
  let terminal = null;
  let killTimer;
  const deadline = setTimeout(() => {
    terminal ??= 'KSTACK_REFLEXION_MEMORY_GATE_TIMEOUT';
    child.kill('SIGTERM');
    killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
    killTimer.unref();
  }, 120_000);
  deadline.unref();
  const consume = (chunk, isStderr) => {
    combined += chunk.length;
    if (isStderr) stderrBytes += chunk.length;
    if (combined > 1_048_576 || stderrBytes > 65_536) {
      terminal ??= 'KSTACK_REFLEXION_MEMORY_GATE_OUTPUT_LIMIT';
      child.kill('SIGTERM');
      return;
    }
    if (retained.length < 1_048_576) retained = Buffer.concat([retained, chunk]).subarray(0, 1_048_576);
  };
  child.stdout.on('data', (chunk) => consume(chunk, false));
  child.stderr.on('data', (chunk) => consume(chunk, true));
  child.on('error', () => { terminal ??= 'KSTACK_REFLEXION_MEMORY_GATE_SPAWN'; });
  child.on('close', (code, signal) => {
    clearTimeout(deadline);
    if (killTimer) clearTimeout(killTimer);
    if (terminal || code !== 0 || signal) {
      process.stderr.write(`${terminal ?? 'KSTACK_REFLEXION_MEMORY_GATE_CHILD'}\n`);
      if (retained.length) process.stderr.write(retained);
      process.exitCode = 1;
    }
  });
}

