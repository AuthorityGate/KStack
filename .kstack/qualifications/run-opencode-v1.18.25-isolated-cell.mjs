import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [binaryPath] = process.argv.slice(2);
if (!binaryPath || !path.isAbsolute(binaryPath)) {
  process.stderr.write('usage: run-opencode-v1.18.25-isolated-cell.mjs ABSOLUTE_OPENCODE_BINARY\n');
  process.exit(2);
}

const child = fileURLToPath(new URL('./opencode-v1.18.25-isolated-cell-child.mjs', import.meta.url));
const reaperSource = fileURLToPath(new URL('./kstack-pid1-reaper.c', import.meta.url));
const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-opencode-reaper-'));
const reaper = path.join(buildRoot, 'kstack-pid1-reaper');
const compile = spawnSync('/usr/bin/cc', ['-O2', '-Wall', '-Wextra', '-Werror', '-std=c11', '-o', reaper, reaperSource], {
  encoding: 'utf8', timeout: 20_000, windowsHide: true
});
if (compile.error) throw compile.error;
if (compile.status !== 0) throw new Error(`PID-1 reaper compilation failed: ${compile.stderr}`);
const result = spawnSync('/usr/bin/unshare', [
  '--user', '--map-root-user', '--net', '--mount', '--pid', '--fork', '--mount-proc',
  reaper, process.execPath, child, binaryPath
], {
  cwd: path.dirname(child),
  env: { HOME: '/tmp', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC' },
  encoding: 'utf8',
  timeout: 240_000,
  maxBuffer: 16 * 1024 * 1024,
  killSignal: 'SIGKILL',
  windowsHide: true
});
fs.rmSync(buildRoot, { recursive: true, force: true });
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'isolated OpenCode cell failed without output\n');
  process.exit(result.status ?? 2);
}
const report = JSON.parse(result.stdout);
if (report.aggregate !== 'PASS') {
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  throw new Error('isolated OpenCode cell did not pass');
}
if (report.binary.sha256 !== 'd91e0d33676d0839f7cde87924cd4127ea88c9d6784eea9f009a7d08bdc60eeb') throw new Error('isolated OpenCode cell binary mismatch');
if (report.discoveryObservation.outcome !== 'OBSERVED' || report.sessionEvidence.length !== 2 || !report.loopbackOnly) throw new Error('isolated OpenCode evidence incomplete');
fs.writeFileSync(new URL('./opencode-v1.18.25-isolated-cell-evidence.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  result: 'PASS',
  evidenceDigest: report.evidenceDigest,
  discoveryObservationDigest: report.discoveryObservationDigest,
  sessions: report.sessionEvidence.length,
  providerRequests: report.providerRequestCount,
  loopbackOnly: report.loopbackOnly,
  maximumClaim: report.maximumClaim
}, null, 2)}\n`);
