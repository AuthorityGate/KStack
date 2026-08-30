import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostAddress } from '../../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  adjudicateGooseFixture,
  buildGooseAdvisoryFixtureSet,
  deriveGooseOperationStatus,
  sealGooseEvidenceSet,
  validateGooseConformancePlan,
  validateGooseDependencyGateSet,
  validateGooseExecution,
  validateGooseFixtureSet,
  validateGooseObserverReceipt
} from '../../plugins/kstack/scripts/kstack-goose-conformance.mjs';

const [evidenceArgument, binaryArgument] = process.argv.slice(2);
const qualificationRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(qualificationRoot, '..', '..');
const evidencePath = evidenceArgument ? path.resolve(evidenceArgument) : path.join(qualificationRoot, 'goose-v1.48.0-conformance-evidence.json');
const binaryPath = binaryArgument ? path.resolve(binaryArgument) : '/tmp/kstack-goose-rebuild-target/release/goose';

const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])])) : value;
const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
const digest = (value) => `sha256:${sha256Hex(Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)))}`;
const recordDigest = (value) => digest(JSON.stringify(canonical(value)));
const fileDigest = (relative) => digest(fs.readFileSync(path.join(sourceRoot, relative)));
function fail(message) { throw new Error(`KSTACK_GOOSE_CONFORMANCE_EVIDENCE_INVALID: ${message}`); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function exact(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} is not an object`);
  const actual = Object.keys(value).sort(compare); const expected = [...keys].sort(compare);
  if (!same(actual, expected)) fail(`${name} schema drift`);
}

const report = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
exact(report, [
  'schema', 'sourceEvidence', 'isolation', 'dependencyGateSet', 'dependencyGateSetDigest',
  'plan', 'planDigest', 'fixtureSet', 'fixtureSetDigest', 'observerReceipts',
  'adjudicationRows', 'executions', 'evidenceSet', 'evidenceSetDigest', 'operationStatus',
  'operationStatusDigest', 'providerRequestCount', 'providerRequestDigest', 'failedFixtureIds',
  'fixtureDiagnostics', 'maximumClaim', 'aggregate', 'evidenceDigest'
], 'report');
if (report.schema !== 'kstack-goose-v1.48.0-protected-conformance-v1') fail('schema');
exact(report.sourceEvidence, [
  'releaseTag', 'binarySha256', 'supplyChainEvidenceDigest', 'reproducibleBuildEvidenceDigest'
], 'source evidence');
if (report.sourceEvidence.releaseTag !== 'v1.48.0'
    || report.sourceEvidence.binarySha256 !== '057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792') fail('pinned release identity');
if (sha256Hex(fs.readFileSync(binaryPath)) !== report.sourceEvidence.binarySha256) fail('binary bytes');
if (report.sourceEvidence.supplyChainEvidenceDigest !== fileDigest('.kstack/qualifications/goose-v1.48.0-supply-chain-2026-08-29.md')
    || report.sourceEvidence.reproducibleBuildEvidenceDigest !== fileDigest('.kstack/qualifications/goose-v1.48.0-reproducible-build-2026-08-29.md')) fail('source evidence drift');
if (report.isolation.credentialsPresent !== false || report.isolation.productionTargetsPresent !== false
    || report.isolation.environmentFacts.networkInterfaces.length !== 1
    || report.isolation.environmentFacts.networkInterfaces[0] !== 'lo'
    || report.isolation.cleanupEvidence.liveAfterProviderStop.length !== 0
    || report.isolation.cleanupEvidence.fixtureCount !== 20
    || report.isolation.cleanupEvidence.fixtureCleanupPassed !== true) fail('isolation or cleanup');
if (report.isolation.environmentFacts.adapterDigest !== fileDigest('plugins/kstack/scripts/kstack-goose-adapter.mjs')
    || report.isolation.environmentFacts.conformanceDigest !== fileDigest('plugins/kstack/scripts/kstack-goose-conformance.mjs')
    || report.isolation.environmentFacts.providerScriptDigest !== fileDigest('.kstack/qualifications/goose-v1.48.0-conformance-provider.mjs')
    || report.isolation.environmentFacts.pid1ReaperSourceDigest !== fileDigest('.kstack/qualifications/kstack-pid1-reaper.c')
    || report.isolation.environmentFacts.supplyChainEvidenceDigest !== report.sourceEvidence.supplyChainEvidenceDigest
    || report.isolation.environmentFacts.reproducibleBuildEvidenceDigest !== report.sourceEvidence.reproducibleBuildEvidenceDigest) fail('adapter/conformance/provider/reaper/source drift');

const gate = validateGooseDependencyGateSet(report.dependencyGateSet);
if (!gate.executable || gate.rows.some((row) => row.status !== 'SATISFIED')
    || hostAddress('KSTACK-GOOSE-CONFORMANCE-DEPENDENCY-GATE-SET-V1', gate) !== report.dependencyGateSetDigest) fail('dependency gate');
const plan = validateGooseConformancePlan(report.plan);
if (hostAddress('KSTACK-GOOSE-CONFORMANCE-PLAN-V1', plan) !== report.planDigest
    || plan.dependencyGateSetDigest !== report.dependencyGateSetDigest
    || plan.activeSetDigest !== fileDigest('plugins/kstack/install-health-audit-manifest-v1.json')
    || plan.harnessDigest !== fileDigest('.kstack/qualifications/goose-v1.48.0-conformance-child.mjs')
    || Date.parse(plan.expiresAt) <= Date.now()) fail('plan binding/currentness');
const fixtureSet = validateGooseFixtureSet(report.fixtureSet);
const frozenFixtureSet = buildGooseAdvisoryFixtureSet(plan.operationProfileDigest);
if (!same(fixtureSet, frozenFixtureSet.fixtureSet) || report.fixtureSetDigest !== frozenFixtureSet.fixtureSetDigest
    || fixtureSet.fixtures.length !== 20) fail('fixture set');

if (!Array.isArray(report.observerReceipts) || report.observerReceipts.length !== 20
    || !Array.isArray(report.adjudicationRows) || report.adjudicationRows.length !== 20
    || !Array.isArray(report.executions) || report.executions.length !== 20
    || !Array.isArray(report.fixtureDiagnostics) || report.fixtureDiagnostics.length !== 20) fail('campaign membership');
const fixtures = new Map(fixtureSet.fixtures.map((fixture) => [fixture.fixtureId, fixture]));
const executions = new Map(report.executions.map((execution) => [execution.fixtureId, validateGooseExecution(execution)]));
const receipts = new Map(report.observerReceipts.map((receipt) => [receipt.fixtureId, validateGooseObserverReceipt(receipt)]));
const diagnostics = new Map(report.fixtureDiagnostics.map((row) => [row.fixtureId, row]));
if ([fixtures, executions, receipts, diagnostics].some((mapping) => mapping.size !== 20)) fail('duplicate campaign member');
const environmentDigest = recordDigest(report.isolation.environmentFacts);
const cleanupEvidenceDigest = recordDigest(report.isolation.cleanupEvidence);
const replayed = [];
for (const row of report.adjudicationRows) {
  exact(row, [
    'fixtureId', 'observedDecisionCode', 'nativeEventSequence', 'observerReceipt', 'attemptId',
    'startedAt', 'completedAt', 'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed',
    'actionBoundaryCrossed', 'outcomeProven', 'failureCode', 'detailDigest'
  ], `adjudication row ${row.fixtureId}`);
  const fixture = fixtures.get(row.fixtureId); const receipt = receipts.get(row.fixtureId); const diagnostic = diagnostics.get(row.fixtureId);
  if (!fixture || !receipt || !diagnostic || !same(row.observerReceipt, receipt)
      || diagnostic.passed !== (row.failureCode === null)
      || row.detailDigest !== recordDigest(diagnostic.details)
      || receipt.observationDigest !== row.detailDigest) fail(`adjudication evidence ${row.fixtureId}`);
  const result = adjudicateGooseFixture({
    fixture, plan, attemptId: row.attemptId, observedDecisionCode: row.observedDecisionCode,
    nativeEventSequence: row.nativeEventSequence, observerReceipts: [receipt],
    environmentStartDigest: environmentDigest, environmentEndDigest: environmentDigest,
    currentnessMeasurementDigest: environmentDigest, startedAt: row.startedAt, completedAt: row.completedAt,
    cleanupEvidenceDigest, forbiddenSideEffects: row.forbiddenSideEffects, limitsPassed: row.limitsPassed,
    cleanupPassed: row.cleanupPassed, actionBoundaryCrossed: row.actionBoundaryCrossed,
    outcomeProven: row.outcomeProven, failureCode: row.failureCode
  }).execution;
  if (!same(result, executions.get(row.fixtureId))) fail(`execution replay ${row.fixtureId}`);
  replayed.push(result);
}
const observerReceiptDigests = report.observerReceipts.map((receipt) => hostAddress('KSTACK-GOOSE-CONFORMANCE-OBSERVER-RECEIPT-V1', receipt)).sort();
const evidence = sealGooseEvidenceSet({
  plan, fixtureSet, executions: replayed, observerReceiptDigests,
  startMeasurementDigest: environmentDigest, endMeasurementDigest: environmentDigest,
  currentnessMeasurementDigest: environmentDigest, cleanupEvidenceDigest, expiresAt: plan.expiresAt
});
if (!same(evidence.evidenceSet, report.evidenceSet) || evidence.evidenceSetDigest !== report.evidenceSetDigest
    || evidence.evidenceSet.aggregate !== 'PASS') fail('evidence set replay');
const statusInput = Object.fromEntries(Object.entries(report.operationStatus).filter(([key]) => ![
  'schemaId', 'schemaVersion', 'hostId', 'maximumClaim', 'status', 'reasonCodes'
].includes(key)));
const status = deriveGooseOperationStatus(statusInput);
if (!same(status.operationStatus, report.operationStatus) || status.operationStatusDigest !== report.operationStatusDigest
    || status.operationStatus.status !== 'FULL' || status.operationStatus.operationId !== 'advisory'
    || report.maximumClaim !== 'OPERATION_SCOPED_ONLY' || report.aggregate !== 'PASS'
    || report.failedFixtureIds.length !== 0) fail('operation-scoped status');
const withoutDigest = Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'evidenceDigest'));
if (recordDigest(withoutDigest) !== report.evidenceDigest) fail('top-level digest');
const durableText = JSON.stringify(report);
if (/(?:ATATT3xF[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*\S+)/iu.test(durableText)) fail('secret-like durable evidence');

process.stdout.write(`${JSON.stringify({
  result: 'PASS', evidenceDigest: report.evidenceDigest, evidenceSetDigest: report.evidenceSetDigest,
  operationStatusDigest: report.operationStatusDigest, fixtures: fixtureSet.fixtures.length,
  executions: replayed.length, status: report.operationStatus.status, expiresAt: plan.expiresAt
}, null, 2)}\n`);
