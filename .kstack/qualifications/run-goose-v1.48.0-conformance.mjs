import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [binaryPath] = process.argv.slice(2);
if (!binaryPath || !path.isAbsolute(binaryPath)) {
  process.stderr.write('usage: run-goose-v1.48.0-conformance.mjs ABSOLUTE_GOOSE_BINARY\n');
  process.exit(2);
}

const child = fileURLToPath(new URL('./goose-v1.48.0-conformance-child.mjs', import.meta.url));
const reaperSource = fileURLToPath(new URL('./kstack-pid1-reaper.c', import.meta.url));
const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-goose-conformance-reaper-'));
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
  encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024,
  killSignal: 'SIGKILL', windowsHide: true
});
fs.rmSync(buildRoot, { recursive: true, force: true });
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'protected Goose conformance campaign failed without output\n');
  process.exit(result.status ?? 2);
}
const report = JSON.parse(result.stdout);
const attemptName = `goose-v1.48.0-conformance-attempt-${report.evidenceDigest.slice('sha256:'.length)}.json`;
const attemptPath = new URL(`./${attemptName}`, import.meta.url);
if (!fs.existsSync(attemptPath)) fs.writeFileSync(attemptPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
if (report.aggregate !== 'PASS' || report.evidenceSet.aggregate !== 'PASS'
    || report.fixtureSet.fixtures.length !== 20 || report.executions.length !== 20
    || report.operationStatus.status !== 'FULL' || report.maximumClaim !== 'OPERATION_SCOPED_ONLY') {
  process.stderr.write(`${JSON.stringify({
    aggregate: report.aggregate, failedFixtureIds: report.failedFixtureIds,
    failedRows: report.adjudicationRows.filter((row) => row.failureCode !== null)
  }, null, 2)}\n`);
  throw new Error('protected Goose conformance campaign did not pass');
}
fs.writeFileSync(new URL('./goose-v1.48.0-conformance-evidence.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  result: 'PASS', evidenceDigest: report.evidenceDigest,
  evidenceSetDigest: report.evidenceSetDigest, operationStatusDigest: report.operationStatusDigest,
  fixtureCount: report.fixtureSet.fixtures.length, executionCount: report.executions.length,
  status: report.operationStatus.status, maximumClaim: report.maximumClaim
}, null, 2)}\n`);
