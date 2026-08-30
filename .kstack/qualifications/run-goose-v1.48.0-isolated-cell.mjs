import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [binaryPath] = process.argv.slice(2);
if (!binaryPath || !path.isAbsolute(binaryPath)) {
  process.stderr.write('usage: run-goose-v1.48.0-isolated-cell.mjs ABSOLUTE_GOOSE_BINARY\n');
  process.exit(2);
}
const child = fileURLToPath(new URL('./goose-v1.48.0-isolated-cell-child.mjs', import.meta.url));
const reaperSource = fileURLToPath(new URL('./kstack-pid1-reaper.c', import.meta.url));
const buildRoot = fs.mkdtempSync(path.join('/tmp', 'kstack-goose-isolated-reaper-'));
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
  timeout: 120_000,
  maxBuffer: 8 * 1024 * 1024,
  killSignal: 'SIGKILL',
  windowsHide: true
});
fs.rmSync(buildRoot, { recursive: true, force: true });
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || 'isolated Goose cell failed without stderr\n');
  process.exit(result.status ?? 2);
}
const report = JSON.parse(result.stdout);
if (report.aggregate !== 'PASS') {
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  throw new Error('isolated Goose cell did not pass');
}
if (report.binarySha256 !== '057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792') throw new Error('isolated Goose cell binary mismatch');
if (report.observations.length !== 4 || report.providerRequestCount !== 2 || !report.loopbackOnly) throw new Error('isolated Goose cell evidence incomplete');
fs.writeFileSync(new URL('./goose-v1.48.0-isolated-cell-evidence.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ result: 'PASS', evidenceDigest: report.evidenceDigest, operations: report.observations.length, providerRequests: report.providerRequestCount, loopbackOnly: report.loopbackOnly }, null, 2)}\n`);
