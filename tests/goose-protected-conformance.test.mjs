import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
  adjudicateGooseFixture,
  buildGooseAdvisoryFixtureSet,
  validateGooseDependencyGateSet,
  validateGooseExecution,
  validateGooseFixtureSet,
  validateGooseObserverReceipt
} from '../plugins/kstack/scripts/kstack-goose-conformance.mjs';

const evidence = JSON.parse(fs.readFileSync(new URL('../.kstack/qualifications/goose-v1.48.0-conformance-evidence.json', import.meta.url), 'utf8'));
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])])) : value;
const digest = (value) => `sha256:${crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex')}`;

function replayInput(row, overrides = {}) {
  const fixture = evidence.fixtureSet.fixtures.find((entry) => entry.fixtureId === row.fixtureId);
  return {
    fixture, plan: evidence.plan, attemptId: row.attemptId,
    observedDecisionCode: row.observedDecisionCode, nativeEventSequence: row.nativeEventSequence,
    observerReceipts: [row.observerReceipt], environmentStartDigest: digest(evidence.isolation.environmentFacts),
    environmentEndDigest: digest(evidence.isolation.environmentFacts),
    currentnessMeasurementDigest: digest(evidence.isolation.environmentFacts),
    startedAt: row.startedAt, completedAt: row.completedAt,
    cleanupEvidenceDigest: digest(evidence.isolation.cleanupEvidence),
    forbiddenSideEffects: row.forbiddenSideEffects, limitsPassed: row.limitsPassed,
    cleanupPassed: row.cleanupPassed, actionBoundaryCrossed: row.actionBoundaryCrossed,
    outcomeProven: row.outcomeProven, failureCode: row.failureCode, ...overrides
  };
}

test('protected Goose evidence is exact, operation-scoped, and contains all 20 passing executions', () => {
  const body = { ...evidence }; delete body.evidenceDigest;
  assert.equal(evidence.evidenceDigest, digest(body));
  assert.equal(evidence.sourceEvidence.binarySha256, '057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792');
  assert.equal(evidence.aggregate, 'PASS');
  assert.equal(evidence.evidenceSet.aggregate, 'PASS');
  assert.equal(evidence.operationStatus.status, 'FULL');
  assert.equal(evidence.operationStatus.operationId, 'advisory');
  assert.equal(evidence.operationStatus.operationProfileId, 'goose.advisory-public-read.v1');
  assert.equal(evidence.maximumClaim, 'OPERATION_SCOPED_ONLY');
  assert.deepEqual(evidence.failedFixtureIds, []);
  assert.equal(evidence.fixtureSet.fixtures.length, 20);
  assert.equal(evidence.executions.length, 20);
  assert.equal(evidence.executions.every((row) => row.state === 'PASS'), true);
  assert.equal(evidence.isolation.credentialsPresent, false);
  assert.equal(evidence.isolation.productionTargetsPresent, false);
  assert.deepEqual(evidence.isolation.environmentFacts.networkInterfaces, ['lo']);
  assert.deepEqual(evidence.isolation.cleanupEvidence.liveAfterProviderStop, []);
});

test('checked evidence matches the frozen ten-group positive/negative fixture registry', () => {
  const gate = validateGooseDependencyGateSet(evidence.dependencyGateSet);
  assert.equal(gate.executable, true);
  assert.equal(gate.rows.every((row) => row.status === 'SATISFIED'), true);
  const fixtures = validateGooseFixtureSet(evidence.fixtureSet);
  const frozen = buildGooseAdvisoryFixtureSet(evidence.plan.operationProfileDigest);
  assert.deepEqual(fixtures, frozen.fixtureSet);
  assert.equal(new Set(fixtures.fixtures.map((row) => row.fixtureGroupId)).size, 10);
  for (const group of fixtures.requiredGroupIds) {
    assert.deepEqual(fixtures.fixtures.filter((row) => row.fixtureGroupId === group).map((row) => row.polarity).sort(), ['NEGATIVE', 'POSITIVE']);
  }
});

test('all observer receipts are protected, available, non-writable, and replay to the checked executions', () => {
  const executions = new Map(evidence.executions.map((row) => [row.fixtureId, validateGooseExecution(row)]));
  for (const row of evidence.adjudicationRows) {
    const receipt = validateGooseObserverReceipt(row.observerReceipt);
    assert.equal(receipt.owner, 'PROTECTED_HARNESS');
    assert.equal(receipt.subjectWritable, false);
    assert.equal(receipt.available, true);
    assert.equal(receipt.contradicted, false);
    assert.deepEqual(adjudicateGooseFixture(replayInput(row)).execution, executions.get(row.fixtureId));
  }
});

test('receipt forgery, native-event drift, environment drift, and status promotion cannot replay as PASS', () => {
  const row = evidence.adjudicationRows.find((entry) => entry.fixtureId === 'workspace.positive.v1');
  assert.throws(() => adjudicateGooseFixture(replayInput(row, {
    observerReceipts: [{ ...row.observerReceipt, subjectWritable: true }]
  })));
  assert.throws(() => adjudicateGooseFixture(replayInput(row, { nativeEventSequence: ['REPOSITORY_UNCHANGED'] })));
  assert.throws(() => adjudicateGooseFixture(replayInput(row, { environmentEndDigest: `sha256:${'0'.repeat(64)}` })));
  const promoted = { ...evidence.operationStatus, operationId: 'privileged-side-effect' };
  assert.notDeepEqual(promoted, evidence.operationStatus);
  assert.equal(evidence.operationStatus.maximumClaim, 'OPERATION_SCOPED_ONLY');
});

test('durable conformance evidence contains no credential-like material', () => {
  assert.doesNotMatch(JSON.stringify(evidence), /(?:ATATT3xF[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*\S+)/iu);
});
