import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  materializeDomainInventory,
  recordDigest,
  sha256Hex,
  sourceRoot
} from './domain-implementation-inventory.mjs';

const inventory = materializeDomainInventory();
const validationFiles = [...new Set(inventory.flatMap((row) => row.validationFiles.map((entry) => entry.file)))].sort();
const startedAt = new Date().toISOString();
const run = spawnSync(process.execPath, ['--test', ...validationFiles], {
  cwd: sourceRoot,
  env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC' },
  encoding: 'utf8', timeout: 300_000, maxBuffer: 64 * 1024 * 1024,
  killSignal: 'SIGKILL', shell: false
});
const completedAt = new Date(Math.max(Date.now(), Date.parse(startedAt) + 1)).toISOString();
const testCaseNames = (run.stdout || '').split(/\r?\n/u).flatMap((line) => {
  const match = line.match(/^[✔✖] (.+) \([0-9.]+ms\)$/u);
  return match ? [match[1]] : [];
});
const summary = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map((label) => {
  const match = (run.stdout || '').match(new RegExp(`^ℹ ${label} ([0-9]+)$`, 'mu'));
  return [label, match ? Number(match[1]) : null];
}));
const testExecution = {
  command: [process.execPath, '--test', ...validationFiles],
  runtime: { nodeVersion: process.version, platform: process.platform, arch: process.arch },
  status: Number.isInteger(run.status) ? run.status : null,
  signal: run.signal,
  errorCode: run.error?.code ?? null,
  testCount: summary.tests,
  tapAssertionCount: summary.tests,
  passCount: summary.pass,
  failCount: summary.fail,
  cancelledCount: summary.cancelled,
  skippedCount: summary.skipped,
  todoCount: summary.todo,
  stdoutSha256: sha256Hex(run.stdout || ''),
  stderrSha256: sha256Hex(run.stderr || '')
};
const testExecutionDigest = recordDigest(testExecution);
const passed = run.status === 0 && run.signal === null && !run.error
  && Number.isSafeInteger(summary.tests) && summary.tests > 0
  && summary.fail === 0 && summary.pass === summary.tests;
const rows = inventory.map((row) => ({
  itemId: row.itemId,
  maturity: row.maturity,
  implementationDigest: recordDigest(row.implementationFiles),
  validationCaseNames: testCaseNames.filter((name) => row.validationCasePrefixes.some((prefix) => name.startsWith(prefix))),
  validationReceiptDigest: recordDigest({
    itemId: row.itemId, testExecutionDigest, validationFiles: row.validationFiles,
    validationCaseNames: testCaseNames.filter((name) => row.validationCasePrefixes.some((prefix) => name.startsWith(prefix)))
  }),
  implemented: true,
  current: passed,
  qualified: false,
  activated: false
}));
for (const row of rows) if (row.validationCaseNames.length < 1) row.current = false;
const aggregatePassed = passed && rows.every((row) => row.current);
const report = {
  schema: 'kstack-domain-implementation-validation-v1',
  startedAt, completedAt, inventory, validationFiles, testExecution,
  testExecutionDigest, rows, aggregate: aggregatePassed ? 'PASS' : 'FAIL'
};
report.evidenceDigest = recordDigest(report);
fs.writeFileSync(new URL('./domain-implementation-validation-evidence.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
if (!aggregatePassed) {
  process.stderr.write(run.stderr || run.stdout || 'domain implementation validation failed without output\n');
  process.exit(run.status ?? 2);
}
process.stdout.write(`${JSON.stringify({
  result: 'PASS', evidenceDigest: report.evidenceDigest, items: rows.length,
  coreItems: rows.filter((row) => row.maturity === 'CORE_IMPLEMENTED').length,
  candidatePacks: rows.filter((row) => row.maturity === 'CANDIDATE_ONLY').length,
  validationFiles: validationFiles.length, testExecutionDigest
}, null, 2)}\n`);
