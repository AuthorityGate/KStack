import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  materializeHostInventory,
  recordDigest,
  sha256Hex,
  sourceRoot
} from './host-implementation-inventory.mjs';

const inventory = materializeHostInventory();
const validationFiles = [...new Set(inventory.flatMap((row) => row.validationFiles.map((entry) => entry.file)))].sort();
const startedAt = new Date().toISOString();
const run = spawnSync(process.execPath, ['--test', ...validationFiles], {
  cwd: sourceRoot,
  env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC' },
  encoding: 'utf8',
  timeout: 300_000,
  maxBuffer: 64 * 1024 * 1024,
  killSignal: 'SIGKILL',
  shell: false
});
const completedAt = new Date(Math.max(Date.now(), Date.parse(startedAt) + 1)).toISOString();
const testExecution = {
  status: Number.isInteger(run.status) ? run.status : null,
  signal: run.signal,
  errorCode: run.error?.code ?? null,
  stdoutSha256: sha256Hex(run.stdout || ''),
  stderrSha256: sha256Hex(run.stderr || '')
};
const testExecutionDigest = recordDigest(testExecution);
const passed = run.status === 0 && run.signal === null && !run.error;
const rows = inventory.map((row) => ({
  itemId: row.itemId,
  implementationDigest: recordDigest(row.implementationFiles),
  validationReceiptDigest: recordDigest({
    itemId: row.itemId,
    testExecutionDigest,
    validationFiles: row.validationFiles,
    validationSupportFiles: row.validationSupportFiles
  }),
  implemented: true,
  current: passed
}));
const report = {
  schema: 'kstack-host-implementation-validation-v1',
  startedAt,
  completedAt,
  inventory,
  validationFiles,
  testExecution,
  testExecutionDigest,
  rows,
  aggregate: passed ? 'PASS' : 'FAIL'
};
report.evidenceDigest = recordDigest(report);
const output = new URL('./host-implementation-validation-evidence.json', import.meta.url);
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
if (!passed) {
  process.stderr.write(run.stderr || run.stdout || 'host implementation validation failed without output\n');
  process.exit(run.status ?? 2);
}
process.stdout.write(`${JSON.stringify({
  result: 'PASS',
  evidenceDigest: report.evidenceDigest,
  items: rows.length,
  validationFiles: validationFiles.length,
  testExecutionDigest
}, null, 2)}\n`);
