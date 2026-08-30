import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeDomainInventory, recordDigest } from './domain-implementation-inventory.mjs';

const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(qualificationRoot, 'domain-implementation-validation-evidence.json');
const report = JSON.parse(fs.readFileSync(target, 'utf8'));
const fail = (detail) => { throw new Error(`KSTACK_DOMAIN_IMPLEMENTATION_EVIDENCE_INVALID: ${detail}`); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
if (!same(Object.keys(report).sort(), [
  'aggregate', 'completedAt', 'evidenceDigest', 'inventory', 'rows', 'schema',
  'startedAt', 'testExecution', 'testExecutionDigest', 'validationFiles'
].sort())) fail('closed schema');
if (report.schema !== 'kstack-domain-implementation-validation-v1' || report.aggregate !== 'PASS') fail('aggregate');
if (Date.parse(report.completedAt) <= Date.parse(report.startedAt)
    || Date.now() - Date.parse(report.completedAt) > 7 * 86_400_000) fail('time window');
const inventory = materializeDomainInventory();
if (!same(report.inventory, inventory)) fail('inventory drift');
const validationFiles = [...new Set(inventory.flatMap((row) => row.validationFiles.map((entry) => entry.file)))].sort();
if (!same(report.validationFiles, validationFiles)
    || report.testExecution.status !== 0 || report.testExecution.signal !== null || report.testExecution.errorCode !== null
    || report.testExecutionDigest !== recordDigest(report.testExecution)) fail('test execution');
const rows = inventory.map((row) => ({
  itemId: row.itemId, maturity: row.maturity,
  implementationDigest: recordDigest(row.implementationFiles),
  validationReceiptDigest: recordDigest({ itemId: row.itemId, testExecutionDigest: report.testExecutionDigest, validationFiles: row.validationFiles }),
  implemented: true, current: true, qualified: false, activated: false
}));
if (!same(report.rows, rows)) fail('row replay');
const body = { ...report }; delete body.evidenceDigest;
if (report.evidenceDigest !== recordDigest(body)) fail('top-level digest');
process.stdout.write(`${JSON.stringify({
  result: 'PASS', evidenceDigest: report.evidenceDigest, items: rows.length,
  coreItems: rows.filter((row) => row.maturity === 'CORE_IMPLEMENTED').length,
  candidatePacks: rows.filter((row) => row.maturity === 'CANDIDATE_ONLY').length,
  completedAt: report.completedAt
}, null, 2)}\n`);
