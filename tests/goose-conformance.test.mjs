import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hostAddress } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  GOOSE_FIXTURE_GROUPS,
  adjudicateGooseFixture,
  advanceGooseExecution,
  buildGooseAdvisoryFixtureSet,
  classifyGooseDependencyGate,
  deriveGooseOperationStatus,
  evaluateGooseDependencyGateSet,
  requiredGooseDependencies,
  sealGooseConformancePlan,
  sealGooseEvidenceSet,
  sealGooseExecution,
  sealGooseFixtureSet,
  sealGooseObserverReceipt,
  validateGooseDependencyGate,
  validateGooseDependencyGateSet,
  validateGooseExecution,
  validateGooseFixture,
  validateGooseFixtureSet,
  validateGooseObserverReceipt
} from '../plugins/kstack/scripts/kstack-goose-conformance.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;
const START = '2026-08-29T15:00:00.000Z';
const END = '2026-08-29T15:00:01.000Z';
const EXPIRY = '2026-08-29T16:00:00.000Z';
const PROFILE = D('1');
const pythonOracle = fileURLToPath(new URL('./helpers/goose-conformance-python-oracle.py', import.meta.url));

function gateRow(hpItemId, status = 'SATISFIED') {
  const reasons = {
    SATISFIED: 'DEPENDENCY_SATISFIED', MISSING: 'DEPENDENCY_MISSING', STALE: 'DEPENDENCY_STALE',
    MISMATCH: 'DEPENDENCY_MISMATCH', NOT_IMPLEMENTED: 'DEPENDENCY_NOT_IMPLEMENTED'
  };
  return {
    schemaId: 'kstack.goose-conformance-dependency-gate.v1', schemaVersion: 1, hpItemId,
    requiredImplementationDigest: D('2'), requiredValidationReceiptDigest: D('3'),
    activeSetMembershipProofDigest: D('4'), currentnessEvidenceDigest: D('5'),
    status, reasonCode: reasons[status]
  };
}

function gateSet(family = 'ADVISORY', statusById = {}) {
  return evaluateGooseDependencyGateSet({
    operationProfileId: 'goose.advisory.v1', operationProfileDigest: PROFILE, operationFamily: family,
    rows: requiredGooseDependencies(family).map((id) => gateRow(id, statusById[id] ?? 'SATISFIED')),
    evaluatedAt: START, expiresAt: EXPIRY
  });
}

function fixture(group, polarity) {
  return {
    schemaId: 'kstack.goose-conformance-fixture.v1', schemaVersion: 1,
    fixtureId: `${group}.${polarity.toLowerCase()}.v1`, fixtureGroupId: group, polarity,
    operationProfileDigest: PROFILE, preconditionDigest: D('6'), inputArtifactDigests: [D('7')],
    expectedNativeEventSequence: ['EVENT_START', 'EVENT_END'], expectedDecisionCode: polarity === 'POSITIVE' ? 'ALLOW' : 'DENY',
    observerExpectationDigests: [D('8')], maximumPermittedSideEffectsDigest: D('9'),
    deadlineMs: 10_000, cleanupContractDigest: D('a'), stableFailureCodes: ['FIXTURE_FAILED']
  };
}

function fixtures() {
  return GOOSE_FIXTURE_GROUPS.flatMap((group) => ['NEGATIVE', 'POSITIVE'].map((polarity) => fixture(group, polarity)))
    .sort((left, right) => left.fixtureId < right.fixtureId ? -1 : left.fixtureId > right.fixtureId ? 1 : 0);
}

function planAndFixtures() {
  const gates = gateSet();
  const sealedFixtures = sealGooseFixtureSet({ operationProfileDigest: PROFILE, requiredGroupIds: [...GOOSE_FIXTURE_GROUPS], fixtures: fixtures() });
  const planInput = {
    hostId: 'goose', runningHostBuildDigest: D('b'), hostExecutableIdentityDigest: D('c'), adapterDigest: D('d'),
    activeSetDigest: D('e'), policyDigest: D('f'), registrySetDigest: D('0'), operationProfileDigest: PROFILE,
    dependencyGateSetDigest: gates.gateSetDigest, environmentMeasurementProfileDigest: D('2'), harnessDigest: D('3'),
    observerSetDigest: D('4'), fixtureSetDigest: sealedFixtures.fixtureSetDigest, bypassInventoryDigest: D('5'),
    isolationTargetDigest: D('6'), sideEffectBudgetDigest: D('7'), authoritativeClockDigest: D('8'),
    plannedAt: START, expiresAt: EXPIRY
  };
  const sealedPlan = sealGooseConformancePlan(planInput, gates.gateSet);
  return { ...sealedPlan, ...sealedFixtures, gates };
}

function planAndAdvisoryFixtures() {
  const gates = gateSet();
  const sealedFixtures = buildGooseAdvisoryFixtureSet(PROFILE);
  const planInput = {
    hostId: 'goose', runningHostBuildDigest: D('b'), hostExecutableIdentityDigest: D('c'), adapterDigest: D('d'),
    activeSetDigest: D('e'), policyDigest: D('f'), registrySetDigest: D('0'), operationProfileDigest: PROFILE,
    dependencyGateSetDigest: gates.gateSetDigest, environmentMeasurementProfileDigest: D('2'), harnessDigest: D('3'),
    observerSetDigest: D('4'), fixtureSetDigest: sealedFixtures.fixtureSetDigest, bypassInventoryDigest: D('5'),
    isolationTargetDigest: D('6'), sideEffectBudgetDigest: D('7'), authoritativeClockDigest: D('8'),
    plannedAt: START, expiresAt: EXPIRY
  };
  return { ...sealGooseConformancePlan(planInput, gates.gateSet), ...sealedFixtures, gates };
}

function observerReceipt(fixtureId, overrides = {}) {
  return sealGooseObserverReceipt({
    fixtureId, observerId: 'protected.observer.1', observerKind: 'HOST_NATIVE_EVENTS',
    observationDigest: D('c'), observedAt: END, owner: 'PROTECTED_HARNESS',
    subjectWritable: false, available: true, contradicted: false, ...overrides
  }).observerReceipt;
}

function execution(fixtureValue, planDigest, overrides = {}) {
  return sealGooseExecution({
    fixtureId: fixtureValue.fixtureId,
    fixtureDigest: hostAddress('KSTACK-GOOSE-CONFORMANCE-FIXTURE-V1', fixtureValue),
    attemptId: `attempt.${fixtureValue.fixtureId}`, state: 'PASS', planDigest,
    environmentStartDigest: D('9'), environmentEndDigest: D('9'), currentnessMeasurementDigest: D('a'),
    observerReceiptDigests: [hostAddress('KSTACK-TEST-OBSERVER-RECEIPT-V1', { fixtureId: fixtureValue.fixtureId })],
    startedAt: START, completedAt: END, cleanupEvidenceDigest: D('b'), oraclePassed: true,
    observersAgree: true, forbiddenSideEffects: false, limitsPassed: true, cleanupPassed: true,
    actionBoundaryCrossed: false, outcomeProven: true, failureCode: null, ...overrides
  });
}

test('dependency sets are exact and operation-specific', () => {
  assert.deepEqual(requiredGooseDependencies('ADVISORY'), ['HP-TC01', 'HP-TC02', 'HP-TC03', 'HP-TC04', 'HP-TC05', 'HP-TC06', 'HP-TC11']);
  assert.ok(requiredGooseDependencies('PUBLIC_MCP').includes('HP-TC09'));
  assert.ok(requiredGooseDependencies('REPOSITORY_WRITE').includes('HP-TC08'));
  assert.ok(requiredGooseDependencies('ASK_REVIEWER').includes('HP-TC10'));
  assert.ok(requiredGooseDependencies('PRIVILEGED_LOCAL_MUTATION').includes('HP-TC08'));
  assert.equal(requiredGooseDependencies('PRIVILEGED_SIDE_EFFECT').includes('HP-TC08'), false);
});

test('dependency gate fails closed on missing, stale, mismatched, and unimplemented rows', () => {
  for (const status of ['MISSING', 'STALE', 'MISMATCH', 'NOT_IMPLEMENTED']) {
    const evaluated = gateSet('ADVISORY', { 'HP-TC04': status });
    assert.equal(evaluated.gateSet.executable, false);
    assert.deepEqual(validateGooseDependencyGateSet(evaluated.gateSet), evaluated.gateSet);
  }
  const missing = gateSet().gateSet.rows.slice(1);
  assert.throws(() => evaluateGooseDependencyGateSet({ operationProfileId: 'goose.advisory.v1', operationProfileDigest: PROFILE, operationFamily: 'ADVISORY', rows: missing, evaluatedAt: START, expiresAt: EXPIRY }),
    (error) => error?.code === 'KSTACK_GOOSE_DEPENDENCY_GATE_INCOMPLETE');
  assert.throws(() => validateGooseDependencyGate({ ...gateRow('HP-TC01'), reasonCode: 'DEPENDENCY_MISSING' }));
});

test('dependency observations derive status without trusting a caller-provided verdict', () => {
  const base = {
    hpItemId: 'HP-TC01', requiredImplementationDigest: D('1'), requiredValidationReceiptDigest: D('2'),
    requiredActiveSetMembershipProofDigest: D('3'), requiredCurrentnessEvidenceDigest: D('4'),
    observedImplementationDigest: D('1'), observedValidationReceiptDigest: D('2'),
    observedActiveSetMembershipProofDigest: D('3'), observedCurrentnessEvidenceDigest: D('4'),
    implemented: true, current: true
  };
  assert.equal(classifyGooseDependencyGate(base).status, 'SATISFIED');
  assert.equal(classifyGooseDependencyGate({ ...base, implemented: false }).status, 'NOT_IMPLEMENTED');
  assert.equal(classifyGooseDependencyGate({ ...base, observedValidationReceiptDigest: null }).status, 'MISSING');
  assert.equal(classifyGooseDependencyGate({ ...base, observedImplementationDigest: D('0') }).status, 'MISMATCH');
  assert.equal(classifyGooseDependencyGate({ ...base, current: false }).status, 'STALE');
});

test('one-profile plan cannot become executable with an unsatisfied or substituted gate', () => {
  const { plan, gates } = planAndFixtures();
  assert.equal(plan.hostId, 'goose');
  const unsatisfied = gateSet('ADVISORY', { 'HP-TC01': 'NOT_IMPLEMENTED' });
  assert.throws(() => sealGooseConformancePlan(Object.fromEntries(Object.entries(plan).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))), unsatisfied.gateSet),
    (error) => error?.code === 'KSTACK_GOOSE_DEPENDENCIES_UNSATISFIED');
  const substituted = structuredClone(gates.gateSet); substituted.rows[0].requiredImplementationDigest = D('0');
  assert.throws(() => sealGooseConformancePlan(Object.fromEntries(Object.entries(plan).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))), substituted));
});

test('fixture set requires positive and negative coverage for each registered group', () => {
  const sealed = sealGooseFixtureSet({ operationProfileDigest: PROFILE, requiredGroupIds: [...GOOSE_FIXTURE_GROUPS], fixtures: fixtures() });
  assert.equal(sealed.fixtureSet.fixtures.length, 20);
  assert.deepEqual(validateGooseFixtureSet(sealed.fixtureSet), sealed.fixtureSet);
  const incomplete = fixtures().filter((entry) => entry.fixtureId !== 'workspace.negative.v1');
  assert.throws(() => sealGooseFixtureSet({ operationProfileDigest: PROFILE, requiredGroupIds: [...GOOSE_FIXTURE_GROUPS], fixtures: incomplete }),
    (error) => error?.code === 'KSTACK_GOOSE_FIXTURE_COVERAGE_INCOMPLETE');
  assert.throws(() => validateGooseFixture({ ...fixture('workspace', 'POSITIVE'), observerExpectationDigests: [] }));
});

test('the advisory campaign freezes exactly one positive and negative strategy for all ten groups', () => {
  const sealed = buildGooseAdvisoryFixtureSet(PROFILE);
  assert.equal(sealed.fixtureSet.fixtures.length, 20);
  assert.deepEqual(sealed.fixtureSet.requiredGroupIds, [...GOOSE_FIXTURE_GROUPS]);
  for (const group of GOOSE_FIXTURE_GROUPS) {
    const rows = sealed.fixtureSet.fixtures.filter((fixtureValue) => fixtureValue.fixtureGroupId === group);
    assert.deepEqual(rows.map((row) => row.polarity).sort(), ['NEGATIVE', 'POSITIVE']);
    assert.deepEqual(rows.map((row) => row.expectedDecisionCode).sort(), ['ALLOW', 'DENY']);
  }
});

test('protected observer receipts, not caller verdicts, adjudicate positive and expected-denial fixtures', () => {
  const context = planAndAdvisoryFixtures();
  for (const fixtureValue of [
    context.fixtureSet.fixtures.find((row) => row.fixtureId === 'instruction-package.positive.v1'),
    context.fixtureSet.fixtures.find((row) => row.fixtureId === 'instruction-package.negative.v1')
  ]) {
    const receipt = observerReceipt(fixtureValue.fixtureId);
    assert.deepEqual(validateGooseObserverReceipt(receipt), receipt);
    const result = adjudicateGooseFixture({
      fixture: fixtureValue, plan: context.plan, attemptId: `attempt.${fixtureValue.fixtureId}`,
      observedDecisionCode: fixtureValue.expectedDecisionCode,
      nativeEventSequence: fixtureValue.expectedNativeEventSequence,
      observerReceipts: [receipt], environmentStartDigest: D('9'), environmentEndDigest: D('9'),
      currentnessMeasurementDigest: D('a'), startedAt: START, completedAt: END,
      cleanupEvidenceDigest: D('b'), forbiddenSideEffects: false, limitsPassed: true,
      cleanupPassed: true, actionBoundaryCrossed: false, outcomeProven: true, failureCode: null
    });
    assert.equal(result.execution.state, 'PASS');
    assert.equal(result.execution.oraclePassed, true);
  }
});

test('adjudication rejects subject-writable observers, event drift, and out-of-window receipts', () => {
  const context = planAndAdvisoryFixtures();
  const fixtureValue = context.fixtureSet.fixtures.find((row) => row.fixtureId === 'workspace.positive.v1');
  const base = {
    fixture: fixtureValue, plan: context.plan, attemptId: 'attempt.workspace.positive.v1',
    observedDecisionCode: 'ALLOW', nativeEventSequence: fixtureValue.expectedNativeEventSequence,
    observerReceipts: [observerReceipt(fixtureValue.fixtureId)],
    environmentStartDigest: D('9'), environmentEndDigest: D('9'), currentnessMeasurementDigest: D('a'),
    startedAt: START, completedAt: END, cleanupEvidenceDigest: D('b'), forbiddenSideEffects: false,
    limitsPassed: true, cleanupPassed: true, actionBoundaryCrossed: false, outcomeProven: true,
    failureCode: null
  };
  assert.throws(() => adjudicateGooseFixture({
    ...base,
    observerReceipts: [observerReceipt(fixtureValue.fixtureId, { subjectWritable: true })]
  }));
  assert.throws(() => adjudicateGooseFixture({ ...base, nativeEventSequence: ['REPOSITORY_UNCHANGED'], failureCode: null }));
  assert.throws(() => adjudicateGooseFixture({
    ...base,
    observerReceipts: [observerReceipt(fixtureValue.fixtureId, { observedAt: '2026-08-29T15:00:02.000Z' })]
  }));
});

test('execution lifecycle is closed and PASS requires observers, limits, cleanup, and stable environment', () => {
  assert.equal(advanceGooseExecution('DECLARED', 'DEPENDENCIES_SATISFIED'), 'DEPENDENCIES_SATISFIED');
  assert.equal(advanceGooseExecution('DEPENDENCIES_SATISFIED', 'ENVIRONMENT_BOUND'), 'ENVIRONMENT_BOUND');
  assert.equal(advanceGooseExecution('ENVIRONMENT_BOUND', 'RUNNING'), 'RUNNING');
  assert.equal(advanceGooseExecution('RUNNING', 'PASS', { oraclePassed: true, observersAgree: true, forbiddenSideEffects: false, limitsPassed: true, cleanupPassed: true }), 'PASS');
  assert.throws(() => advanceGooseExecution('DECLARED', 'PASS', {}));
  const context = planAndFixtures();
  const base = execution(context.fixtureSet.fixtures[0], context.planDigest);
  assert.deepEqual(validateGooseExecution(base.execution), base.execution);
  assert.throws(() => execution(context.fixtureSet.fixtures[0], context.planDigest, { cleanupPassed: false }));
  assert.throws(() => execution(context.fixtureSet.fixtures[0], context.planDigest, { actionBoundaryCrossed: true, outcomeProven: false }));
});

test('evidence membership is exact and derives PASS only for the full immutable set', () => {
  const context = planAndFixtures();
  const executions = context.fixtureSet.fixtures.map((entry) => execution(entry, context.planDigest).execution);
  const observers = [...new Set(executions.flatMap((entry) => entry.observerReceiptDigests))].sort();
  const input = {
    plan: context.plan, fixtureSet: context.fixtureSet, executions, observerReceiptDigests: observers,
    startMeasurementDigest: D('9'), endMeasurementDigest: D('9'), currentnessMeasurementDigest: D('a'),
    cleanupEvidenceDigest: D('b'), expiresAt: EXPIRY
  };
  const sealed = sealGooseEvidenceSet(input);
  assert.equal(sealed.evidenceSet.aggregate, 'PASS');
  assert.equal(sealed.evidenceSet.executionDigests.length, 20);
  assert.throws(() => sealGooseEvidenceSet({ ...input, executions: executions.slice(1) }),
    (error) => error?.code === 'KSTACK_GOOSE_EVIDENCE_MEMBERSHIP_INVALID');
  assert.throws(() => sealGooseEvidenceSet({ ...input, observerReceiptDigests: observers.slice(1) }),
    (error) => error?.code === 'KSTACK_GOOSE_OBSERVER_MEMBERSHIP_INVALID');
  assert.throws(() => sealGooseEvidenceSet({ ...input, endMeasurementDigest: D('8') }),
    (error) => error?.code === 'KSTACK_GOOSE_ENVIRONMENT_CHANGED');
});

function statusInput(overrides = {}) {
  return {
    operationId: 'advisory', operationProfileId: 'goose.advisory.v1', profileClass: 'FULL', registeredAlternate: false,
    hostBuildDigest: D('1'), adapterDigest: D('2'), platformDigest: D('3'), activeSetDigest: D('4'), policyDigest: D('5'),
    evidenceSetDigest: D('6'), fixtureSetDigest: D('7'), observerSetDigest: D('8'), evaluatedAt: START, expiresAt: EXPIRY,
    aggregate: 'PASS', revoked: false, drifted: false, contradicted: false, missingRequirementIds: [], bypassIds: [], ...overrides
  };
}

test('status is operation-scoped and never promotes an incomplete or unregistered profile', () => {
  const full = deriveGooseOperationStatus(statusInput()).operationStatus;
  assert.equal(full.status, 'FULL'); assert.equal(full.hostId, 'goose'); assert.equal(full.maximumClaim, 'OPERATION_SCOPED_ONLY');
  assert.equal(deriveGooseOperationStatus(statusInput({ profileClass: 'ALTERNATE', registeredAlternate: true })).operationStatus.status, 'DEGRADED_REGISTERED');
  assert.equal(deriveGooseOperationStatus(statusInput({ profileClass: 'ALTERNATE' })).operationStatus.status, 'UNSUPPORTED');
  assert.equal(deriveGooseOperationStatus(statusInput({ missingRequirementIds: ['HP-TC09'] })).operationStatus.status, 'UNSUPPORTED');
  assert.equal(deriveGooseOperationStatus(statusInput({ bypassIds: ['direct-shell'] })).operationStatus.status, 'UNSUPPORTED');
  assert.equal(deriveGooseOperationStatus(statusInput({ revoked: true })).operationStatus.status, 'QUARANTINED');
  assert.equal(deriveGooseOperationStatus(statusInput({ drifted: true })).operationStatus.status, 'QUARANTINED');
});

test('closed schemas reject extra fields and mutation of every major binding', () => {
  const context = planAndFixtures();
  assert.throws(() => validateGooseDependencyGate({ ...gateRow('HP-TC01'), extra: true }));
  assert.throws(() => validateGooseFixture({ ...context.fixtureSet.fixtures[0], extra: true }));
  const mutated = structuredClone(context.fixtureSet); mutated.fixtures[0].operationProfileDigest = D('0');
  assert.throws(() => validateGooseFixtureSet(mutated));
});

test('independent Python canonical oracle agrees on gates, plans, fixtures, executions, and evidence', () => {
  const context = planAndFixtures();
  const executionValue = execution(context.fixtureSet.fixtures[0], context.planDigest);
  const vectors = [
    ['KSTACK-GOOSE-CONFORMANCE-DEPENDENCY-GATE-SET-V1', context.gates.gateSet, context.gates.gateSetDigest],
    ['KSTACK-GOOSE-CONFORMANCE-PLAN-V1', context.plan, context.planDigest],
    ['KSTACK-GOOSE-CONFORMANCE-FIXTURE-SET-V1', context.fixtureSet, context.fixtureSetDigest],
    ['KSTACK-GOOSE-CONFORMANCE-EXECUTION-V1', executionValue.execution, executionValue.executionDigest]
  ];
  for (const [domain, value, expected] of vectors) {
    const result = spawnSync('python3', [pythonOracle], { input: JSON.stringify({ domain, value }), encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false, env: {} });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).digest, expected);
  }
});
