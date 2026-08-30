import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  materializeHostInventory,
  recordDigest
} from './host-implementation-inventory.mjs';

const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(qualificationRoot, 'host-implementation-validation-evidence.json');
const report = JSON.parse(fs.readFileSync(target, 'utf8'));
const fail = (detail) => { throw new Error(`KSTACK_HOST_IMPLEMENTATION_EVIDENCE_INVALID: ${detail}`); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const keys = (value) => Object.keys(value).sort();
if (!same(keys(report), [
  'aggregate', 'completedAt', 'evidenceDigest', 'inventory', 'rows', 'schema',
  'startedAt', 'testExecution', 'testExecutionDigest', 'validationFiles'
].sort())) fail('closed schema');
if (report.schema !== 'kstack-host-implementation-validation-v1' || report.aggregate !== 'PASS') fail('aggregate');
if (Date.parse(report.completedAt) <= Date.parse(report.startedAt)
    || Date.now() - Date.parse(report.completedAt) > 7 * 86_400_000) fail('time window');
const inventory = materializeHostInventory();
if (!same(report.inventory, inventory)) fail('inventory drift');
const validationFiles = [...new Set(inventory.flatMap((row) => row.validationFiles.map((entry) => entry.file)))].sort();
if (!same(report.validationFiles, validationFiles)) fail('validation inventory');
if (report.testExecution.status !== 0 || report.testExecution.signal !== null || report.testExecution.errorCode !== null
    || report.testExecutionDigest !== recordDigest(report.testExecution)) fail('test execution');
const rows = inventory.map((row) => ({
  itemId: row.itemId,
  implementationDigest: recordDigest(row.implementationFiles),
  validationReceiptDigest: recordDigest({
    itemId: row.itemId,
    testExecutionDigest: report.testExecutionDigest,
    validationFiles: row.validationFiles,
    validationSupportFiles: row.validationSupportFiles
  }),
  implemented: true,
  current: true
}));
if (!same(report.rows, rows)) fail('row replay');
const body = { ...report };
delete body.evidenceDigest;
if (report.evidenceDigest !== recordDigest(body)) fail('top-level digest');
process.stdout.write(`${JSON.stringify({
  result: 'PASS', evidenceDigest: report.evidenceDigest,
  items: rows.length, validationFiles: validationFiles.length,
  completedAt: report.completedAt
}, null, 2)}\n`);
