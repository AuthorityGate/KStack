import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EFFECT_FAMILIES,
  ProtectedHarnessKernel,
  advanceFixtureExecution,
  aggregateConformanceRun,
  buildHostBypassInventory,
  classifyEffectTermination,
  createEvidenceProducerHandoff,
  evaluateCoverageClosure,
  evaluateEffectChokePointClosure,
  evaluateHarnessProfile,
  evaluateObserverSet,
  sealConformanceRunPlan
} from '../plugins/kstack/scripts/kstack-host-harness.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;
const SCHEMA = D('a');
const HOST = D('b');
const ENV = D('c');
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-harness-reference/Cargo.toml', import.meta.url));

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, expected);
}

function harnessInput() {
  return {
    schemaSetDigest: SCHEMA,
    profileId: 'linux-userns-reference',
    platformDigest: D('1'),
    isolationBackendDigest: D('2'),
    launcherDigest: D('3'),
    supervisorDigest: D('4'),
    observerSetDigest: D('5'),
    trustedTimeProfileDigest: D('6'),
    replayProfileDigest: D('7'),
    environmentProfileDigest: D('8'),
    activeSetDigest: D('9'),
    policyDigest: D('d'),
    artifactLimitsDigest: D('e'),
    cleanupContractDigest: D('f'),
    networkPolicyDigest: D('0'),
    disposableTargetProfileDigest: D('1'),
    fakeProviderRegistryDigest: D('2'),
    qualificationVectorSetDigest: D('3'),
    primitiveOutcomes: {
      isolation: 'PROVEN', launcher: 'PROVEN', observerSet: 'PROVEN', trustedTime: 'PROVEN',
      replay: 'PROVEN', environmentMeasurement: 'PROVEN', cleanup: 'PROVEN',
      networkEnforcement: 'PROVEN', disposableTarget: 'PROVEN', fakeProvider: 'PROVEN'
    },
    ownership: {
      activeSet: true, clock: true, config: true, evidenceCatalog: true, expectedOutcomes: true,
      fixtureVerdict: true, observerState: true, policy: true, signingKey: true
    }
  };
}

function closureInput() {
  return {
    schemaSetDigest: SCHEMA,
    hostTupleDigest: HOST,
    executableClosureDigest: D('1'),
    buildManifestDigest: D('2'),
    runtimeRegistryDigest: D('3'),
    loaderPolicyDigest: D('4'),
    nativeExtensionRegistryDigest: D('5'),
    executableMemoryPolicyDigest: D('6'),
    sandboxProfileDigest: D('7'),
    kernelMediationProfileDigest: D('8'),
    brokerMediationProfileDigest: D('9'),
    effectFamilyRegistryDigest: D('d'),
    coverageVectorSetDigest: D('e'),
    environmentSnapshotDigest: ENV,
    operationProfileIds: ['op.read', 'op.write'],
    executableLayer: {
      buildProvenanceComplete: true,
      buildGraphComplete: true,
      loaderObserved: true,
      denyUnregisteredCode: true,
      denyWritableExecutable: true,
      denyRuntimeDownloads: true,
      denyAlternateInterpreters: true,
      allLoadedDigestsRegistered: true,
      eventOverflow: false,
      contradiction: false
    },
    effectLayer: EFFECT_FAMILIES.map((familyId) => ({
      familyId,
      boundaryAvailable: true,
      boundaryMediated: true,
      observerIndependent: true,
      registryComplete: true,
      eventOverflow: false,
      contradiction: false
    })),
    reachabilityRows: EFFECT_FAMILIES.map((familyId) => ({
      familyId,
      operationProfileIds: familyId === 'filesystem-mutation' ? ['op.write'] : ['op.read', 'op.write'],
      reachabilityProven: true
    }))
  };
}

function inventoryInput(closure) {
  const surface = { surfaceId: 'builtin.write', familyId: 'filesystem-mutation', descriptorDigest: D('4') };
  return {
    schemaSetDigest: SCHEMA,
    hostTupleDigest: HOST,
    closure,
    operationProfileIds: ['op.read', 'op.write'],
    sourceInventories: ['DOCUMENTED', 'DYNAMIC', 'LIVE', 'STATIC'].map((sourceKind, index) => ({
      sourceKind,
      sourceDigest: D(String(index + 5)),
      surfaces: [surface]
    })),
    registrations: [{
      surfaceId: 'builtin.write',
      familyId: 'filesystem-mutation',
      registrationDigest: D('9'),
      reachableOperationProfileIds: ['op.write'],
      mediationPointId: 'broker.filesystem',
      observerIds: ['obs.fs', 'obs.handle'],
      positiveFixtureIds: ['fixture.write'],
      negativeFixtureIds: ['fixture.escape'],
      requestedStatus: 'COVERED',
      disabledProofDigest: null,
      unreachableProofDigest: null,
      effectObserved: true,
      mediationObserved: true,
      limitationCodes: []
    }]
  };
}

function coverageInput(inventory) {
  return {
    schemaSetDigest: SCHEMA,
    hostTupleDigest: HOST,
    inventory,
    requirements: [{
      operationProfileId: 'op.write', capabilityId: 'file-write', bypassSurfaceId: 'builtin.write',
      observerIds: ['obs.fs', 'obs.handle'], environmentSelectorId: 'linux', intrinsicallyNegative: false
    }],
    fixtures: [
      { fixtureId: 'fixture.escape', kind: 'NEGATIVE', observerIds: ['obs.fs', 'obs.handle'] },
      { fixtureId: 'fixture.write', kind: 'POSITIVE', observerIds: ['obs.fs', 'obs.handle'] }
    ],
    rows: [{
      operationProfileId: 'op.write', capabilityId: 'file-write', bypassSurfaceId: 'builtin.write',
      observerIds: ['obs.fs', 'obs.handle'], environmentSelectorId: 'linux',
      positiveFixtureIds: ['fixture.write'], negativeFixtureIds: ['fixture.escape']
    }],
    executedFixtureIds: ['fixture.escape', 'fixture.write'],
    environmentStartDigest: ENV,
    environmentEndDigest: ENV
  };
}

function fixture(fixtureId, overrides = {}) {
  return {
    fixtureId,
    status: 'PASS',
    oraclePassed: true,
    observersAgree: true,
    forbiddenSideEffects: false,
    limitsPassed: true,
    cleanupPassed: true,
    actionBoundaryCrossed: false,
    outcomeProven: true,
    ...overrides
  };
}

function aggregateInput(closure, inventory, matrix) {
  return {
    schemaSetDigest: SCHEMA,
    planDigest: D('f'),
    attemptId: 'attempt-1',
    closure,
    inventory,
    coverageMatrix: matrix,
    fixtureResults: [fixture('fixture.escape'), fixture('fixture.write')],
    observerStatuses: ['VALID', 'VALID'],
    environmentStartDigest: ENV,
    environmentEndDigest: ENV,
    cleanupSucceeded: true,
    logsComplete: true,
    startedAt: '2026-08-29T04:00:00.000Z',
    completedAt: '2026-08-29T04:01:00.000Z'
  };
}

test('protected harness qualification requires every primitive and ownership boundary', () => {
  const proven = evaluateHarnessProfile(harnessInput());
  assert.equal(proven.qualificationOutcome, 'PROVEN');
  assert.match(proven.profileDigest, /^sha256:[0-9a-f]{64}$/u);

  const writable = harnessInput();
  writable.ownership.expectedOutcomes = false;
  assert.equal(evaluateHarnessProfile(writable).qualificationOutcome, 'UNKNOWN');

  const unavailable = harnessInput();
  unavailable.primitiveOutcomes.isolation = 'UNAVAILABLE';
  assert.equal(evaluateHarnessProfile(unavailable).qualificationOutcome, 'UNAVAILABLE');

  const contradictory = harnessInput();
  contradictory.primitiveOutcomes.observerSet = 'CONTRADICTORY';
  assert.equal(evaluateHarnessProfile(contradictory).qualificationOutcome, 'CONTRADICTORY');
  code('KSTACK_HARNESS_PROFILE_INVALID', () => evaluateHarnessProfile({ ...harnessInput(), trustSubject: true }));
});

test('observer joins require protected ownership and independent capture points', () => {
  const profile = (observerId, authorityId, capturePointId) => ({
    observerId,
    role: 'filesystem',
    implementationDigest: D('1'),
    configDigest: D('2'),
    platformDigest: D('3'),
    isolationBackendDigest: D('4'),
    eventSchemaDigest: D('5'),
    authorityId,
    capturePointId,
    limitsDigest: D('6'),
    failureCodes: [],
    negativeVectorIds: ['vector.omission'],
    subjectWritable: false,
    qualificationOutcome: 'PROVEN'
  });
  const report = (observerId) => ({
    observerId,
    factId: 'write.outcome',
    factDigest: D('7'),
    eventSchemaDigest: D('5'),
    status: 'VALID',
    protectedAttestationDigest: D('8')
  });
  const base = {
    schemaSetDigest: SCHEMA,
    observerSetDigest: D('9'),
    requiredObserverIds: ['observer.handle', 'observer.kernel'],
    profiles: [
      profile('observer.handle', 'authority.handle', 'capture.handle'),
      profile('observer.kernel', 'authority.kernel', 'capture.kernel')
    ],
    reports: [report('observer.handle'), report('observer.kernel')],
    minimumIndependentCapturePoints: 2,
    singleSourceExceptions: []
  };
  assert.deepEqual(evaluateObserverSet(base).evaluation.observerStatuses, ['VALID']);

  const subjectWritable = structuredClone(base);
  subjectWritable.profiles[0].subjectWritable = true;
  assert.ok(evaluateObserverSet(subjectWritable).evaluation.observerStatuses.includes('SUBJECT_WRITABLE'));

  const contradiction = structuredClone(base);
  contradiction.reports[1].factDigest = D('d');
  assert.equal(evaluateObserverSet(contradiction).evaluation.outcome, 'CONTRADICTORY');

  for (const status of ['TRUNCATED', 'LATE', 'SCHEMA_INVALID']) {
    const damaged = structuredClone(base);
    damaged.reports[0].status = status;
    assert.ok(evaluateObserverSet(damaged).evaluation.observerStatuses.includes(status), status);
  }
  const omitted = structuredClone(base);
  omitted.reports = [omitted.reports[0]];
  assert.ok(evaluateObserverSet(omitted).evaluation.observerStatuses.includes('MISSING'));
  const forgedSchema = structuredClone(base);
  forgedSchema.reports[0].eventSchemaDigest = D('f');
  assert.ok(evaluateObserverSet(forgedSchema).evaluation.observerStatuses.includes('SCHEMA_INVALID'));

  const oneSource = structuredClone(base);
  oneSource.requiredObserverIds = ['observer.handle'];
  oneSource.profiles = [oneSource.profiles[0]];
  oneSource.reports = [oneSource.reports[0]];
  assert.ok(evaluateObserverSet(oneSource).evaluation.observerStatuses.includes('INSUFFICIENT_INDEPENDENCE'));
  oneSource.singleSourceExceptions = [{
    factId: 'write.outcome', authoritativeObserverId: 'observer.handle',
    mutationVectorDigest: D('e'), requirementProfileAccepts: true
  }];
  assert.deepEqual(evaluateObserverSet(oneSource).evaluation.observerStatuses, ['VALID']);
});

test('executable and OS effect layers must both close before any family is proven', () => {
  const proven = evaluateEffectChokePointClosure(closureInput());
  assert.equal(proven.closure.outcome, 'PROVEN');
  assert.ok(proven.closure.familyOutcomes.every((row) => row.outcome === 'PROVEN'));

  for (const key of [
    'buildProvenanceComplete', 'buildGraphComplete', 'loaderObserved', 'denyUnregisteredCode',
    'denyWritableExecutable', 'denyRuntimeDownloads', 'denyAlternateInterpreters', 'allLoadedDigestsRegistered'
  ]) {
    const mutated = closureInput();
    mutated.executableLayer[key] = false;
    const result = evaluateEffectChokePointClosure(mutated).closure;
    assert.equal(result.outcome, 'UNKNOWN', key);
    assert.ok(result.familyOutcomes.every((row) => row.blockedOperationProfileIds.length > 0), key);
  }

  const missingBoundary = closureInput();
  missingBoundary.effectLayer.find((row) => row.familyId === 'network').boundaryAvailable = false;
  const unavailable = evaluateEffectChokePointClosure(missingBoundary).closure;
  assert.equal(unavailable.outcome, 'UNAVAILABLE');
  assert.equal(unavailable.familyOutcomes.find((row) => row.familyId === 'network').outcome, 'UNAVAILABLE');

  const unknownReachability = closureInput();
  unknownReachability.effectLayer.find((row) => row.familyId === 'filesystem-mutation').registryComplete = false;
  unknownReachability.reachabilityRows.find((row) => row.familyId === 'filesystem-mutation').reachabilityProven = false;
  assert.deepEqual(
    evaluateEffectChokePointClosure(unknownReachability).closure.familyOutcomes.find((row) => row.familyId === 'filesystem-mutation').blockedOperationProfileIds,
    ['op.read', 'op.write']
  );

  for (const familyId of EFFECT_FAMILIES) {
    for (const [field, replacement, expected] of [
      ['boundaryMediated', false, 'UNKNOWN'],
      ['observerIndependent', false, 'UNKNOWN'],
      ['registryComplete', false, 'UNKNOWN'],
      ['eventOverflow', true, 'UNKNOWN'],
      ['contradiction', true, 'CONTRADICTORY']
    ]) {
      const mutated = closureInput();
      mutated.effectLayer.find((row) => row.familyId === familyId)[field] = replacement;
      const row = evaluateEffectChokePointClosure(mutated).closure.familyOutcomes.find((entry) => entry.familyId === familyId);
      assert.equal(row.outcome, expected, `${familyId}:${field}`);
      assert.ok(row.blockedOperationProfileIds.length > 0, `${familyId}:${field}:blocked`);
    }
  }
});

test('four-source bypass inventory retains discrepancies and cannot self-promote', () => {
  const closure = evaluateEffectChokePointClosure(closureInput()).closure;
  const covered = buildHostBypassInventory(inventoryInput(closure)).inventory;
  assert.equal(covered.surfaces[0].status, 'COVERED');

  const omitted = inventoryInput(closure);
  omitted.sourceInventories[0].surfaces = [];
  assert.equal(buildHostBypassInventory(omitted).inventory.surfaces[0].status, 'UNKNOWN');

  const bypass = inventoryInput(closure);
  bypass.registrations[0].mediationObserved = false;
  const bypassResult = buildHostBypassInventory(bypass).inventory.surfaces[0];
  assert.equal(bypassResult.status, 'BYPASS_FOUND');
  assert.ok(bypassResult.limitationCodes.includes('KSTACK_BYPASS_FOUND'));

  const unobservable = inventoryInput(closure);
  unobservable.registrations[0].observerIds = [];
  assert.equal(buildHostBypassInventory(unobservable).inventory.surfaces[0].status, 'UNOBSERVABLE');

  const unproven = closureInput();
  unproven.executableLayer.denyRuntimeDownloads = false;
  assert.equal(buildHostBypassInventory(inventoryInput(evaluateEffectChokePointClosure(unproven).closure)).inventory.surfaces[0].status, 'UNKNOWN');
});

test('coverage uses exact set equality and rejects orphan, observer, execution, and environment drift', () => {
  const closure = evaluateEffectChokePointClosure(closureInput()).closure;
  const inventory = buildHostBypassInventory(inventoryInput(closure)).inventory;
  assert.equal(evaluateCoverageClosure(coverageInput(inventory)).matrix.complete, true);

  const mutations = [
    (value) => { value.rows = []; },
    (value) => { value.executedFixtureIds = ['fixture.write']; },
    (value) => { value.fixtures[0].observerIds = ['obs.handle']; },
    (value) => { value.environmentEndDigest = D('d'); },
    (value) => { value.fixtures.push({ fixtureId: 'fixture.orphan', kind: 'NEGATIVE', observerIds: ['obs.fs', 'obs.handle'] }); },
    (value) => { value.rows.push(structuredClone(value.rows[0])); }
  ];
  for (const mutate of mutations) {
    const candidate = coverageInput(inventory);
    mutate(candidate);
    assert.equal(evaluateCoverageClosure(candidate).matrix.complete, false);
  }

  const intrinsicallyNegative = coverageInput(inventory);
  intrinsicallyNegative.requirements[0].intrinsicallyNegative = true;
  intrinsicallyNegative.rows[0].positiveFixtureIds = [];
  assert.ok(evaluateCoverageClosure(intrinsicallyNegative).matrix.reasonCodes.includes('KSTACK_COVERAGE_FIXTURE_MISSING'));
});

test('fixture transitions and post-effect termination are conservative', () => {
  assert.equal(advanceFixtureExecution('DECLARED', 'DEPENDENCIES_SATISFIED'), 'DEPENDENCIES_SATISFIED');
  assert.equal(advanceFixtureExecution('DEPENDENCIES_SATISFIED', 'ENVIRONMENT_BOUND'), 'ENVIRONMENT_BOUND');
  assert.equal(advanceFixtureExecution('ENVIRONMENT_BOUND', 'RUNNING'), 'RUNNING');
  assert.equal(advanceFixtureExecution('RUNNING', 'PASS', {
    oraclePassed: true, observersAgree: true, forbiddenSideEffects: false, limitsPassed: true, cleanupPassed: true
  }), 'PASS');
  code('KSTACK_HARNESS_FIXTURE_TRANSITION_INVALID', () => advanceFixtureExecution('DECLARED', 'PASS'));
  code('KSTACK_HARNESS_FIXTURE_PASS_INVALID', () => advanceFixtureExecution('RUNNING', 'PASS', {
    oraclePassed: true, observersAgree: false, forbiddenSideEffects: false, limitsPassed: true, cleanupPassed: true
  }));
  assert.equal(classifyEffectTermination({ termination: 'CRASHED', actionBoundaryCrossed: true, outcomeProven: false, harnessIntegrity: true }), 'AMBIGUOUS');
  assert.equal(classifyEffectTermination({ termination: 'CRASHED', actionBoundaryCrossed: false, outcomeProven: false, harnessIntegrity: true }), 'FAIL');
  assert.equal(classifyEffectTermination({ termination: 'DEADLINE', actionBoundaryCrossed: false, outcomeProven: false, harnessIntegrity: false }), 'HARNESS_ERROR');
});

test('aggregate precedence is HARNESS_ERROR, AMBIGUOUS, FAIL, INCOMPLETE, PASS', () => {
  const closure = evaluateEffectChokePointClosure(closureInput()).closure;
  const inventory = buildHostBypassInventory(inventoryInput(closure)).inventory;
  const matrix = evaluateCoverageClosure(coverageInput(inventory)).matrix;
  const base = aggregateInput(closure, inventory, matrix);
  assert.equal(aggregateConformanceRun(base).result.aggregate, 'PASS');

  const incomplete = structuredClone(base);
  incomplete.logsComplete = false;
  assert.equal(aggregateConformanceRun(incomplete).result.aggregate, 'INCOMPLETE');

  const failed = structuredClone(incomplete);
  failed.fixtureResults[0] = fixture('fixture.escape', { status: 'FAIL', oraclePassed: false });
  assert.equal(aggregateConformanceRun(failed).result.aggregate, 'FAIL');

  const ambiguous = structuredClone(failed);
  ambiguous.fixtureResults[1] = fixture('fixture.write', { status: 'AMBIGUOUS', actionBoundaryCrossed: true, outcomeProven: false });
  assert.equal(aggregateConformanceRun(ambiguous).result.aggregate, 'AMBIGUOUS');

  const harnessError = structuredClone(ambiguous);
  harnessError.observerStatuses = ['MISSING'];
  assert.equal(aggregateConformanceRun(harnessError).result.aggregate, 'HARNESS_ERROR');

  for (let mask = 0; mask < 16; mask += 1) {
    const candidate = structuredClone(base);
    if (mask & 1) candidate.observerStatuses = ['MISSING'];
    if (mask & 2) candidate.fixtureResults[0] = fixture('fixture.escape', { status: 'AMBIGUOUS', actionBoundaryCrossed: true, outcomeProven: false });
    if (mask & 4) candidate.fixtureResults[1] = fixture('fixture.write', { status: 'FAIL', oraclePassed: false });
    if (mask & 8) candidate.logsComplete = false;
    const expected = mask & 1 ? 'HARNESS_ERROR' : mask & 2 ? 'AMBIGUOUS' : mask & 4 ? 'FAIL' : mask & 8 ? 'INCOMPLETE' : 'PASS';
    assert.equal(aggregateConformanceRun(candidate).result.aggregate, expected, `precedence-mask-${mask}`);
  }
});

test('sealed plans and evidence handoffs bind the exact immutable candidate', () => {
  const closure = evaluateEffectChokePointClosure(closureInput()).closure;
  const inventory = buildHostBypassInventory(inventoryInput(closure)).inventory;
  const matrix = evaluateCoverageClosure(coverageInput(inventory)).matrix;
  const sealed = sealConformanceRunPlan({
    schemaSetDigest: SCHEMA,
    planId: 'plan-1',
    hostTupleDigest: HOST,
    hostBuildDigest: D('1'),
    adapterDigest: D('2'),
    platformDigest: D('3'),
    activeSetDigest: D('4'),
    policyDigest: D('5'),
    operationProfileDigest: D('6'),
    requirementProfileDigest: D('7'),
    environmentSnapshotDigest: ENV,
    harnessProfileDigest: D('8'),
    observerSetDigest: D('9'),
    bypassInventoryDigest: D('d'),
    coverageMatrixDigest: D('e'),
    isolationTargetDigest: D('f'),
    sideEffectBudgetDigest: D('0'),
    fakeProviderSetDigest: D('1'),
    trustedTimeSampleDigest: D('2'),
    declaredAt: '2026-08-29T04:00:00.000Z',
    expiresAt: '2026-08-29T05:00:00.000Z'
  });
  const run = aggregateConformanceRun({ ...aggregateInput(closure, inventory, matrix), planDigest: sealed.planDigest }).result;
  const handoff = createEvidenceProducerHandoff({
    schemaSetDigest: SCHEMA,
    result: run,
    planDigest: sealed.planDigest,
    environmentDigest: ENV,
    observerOwnershipDigest: D('3'),
    protectedBackendAttestationDigest: D('4')
  });
  assert.equal(handoff.handoff.aggregate, 'PASS');
  assert.match(handoff.handoffDigest, /^sha256:[0-9a-f]{64}$/u);
  code('KSTACK_HARNESS_HANDOFF_INVALID', () => createEvidenceProducerHandoff({
    schemaSetDigest: SCHEMA,
    result: run,
    planDigest: D('9'),
    environmentDigest: ENV,
    observerOwnershipDigest: D('3'),
    protectedBackendAttestationDigest: D('4')
  }));
});

test('protected supervisor alone appends immutable attempt transitions', async () => {
  const records = [];
  const kernel = new ProtectedHarnessKernel({
    schemaSetDigest: SCHEMA,
    allowTestBackend: true,
    backend: {
      descriptor: {
        protectionClass: 'test-only', repositoryWritable: false, agentWritable: false,
        durable: true, atomicPublication: true, appendOnlyAudit: true,
        observerStateProtected: true, expectedOutcomeProtected: true
      },
      append: async (record) => { records.push(record); return D(String(records.length % 10)); }
    }
  });
  const plan = sealConformanceRunPlan({
    schemaSetDigest: SCHEMA, planId: 'protected-plan', hostTupleDigest: HOST,
    hostBuildDigest: D('1'), adapterDigest: D('2'), platformDigest: D('3'), activeSetDigest: D('4'),
    policyDigest: D('5'), operationProfileDigest: D('6'), requirementProfileDigest: D('7'),
    environmentSnapshotDigest: ENV, harnessProfileDigest: D('8'), observerSetDigest: D('9'),
    bypassInventoryDigest: D('d'), coverageMatrixDigest: D('e'), isolationTargetDigest: D('f'),
    sideEffectBudgetDigest: D('0'), fakeProviderSetDigest: D('1'), trustedTimeSampleDigest: D('2'),
    declaredAt: '2026-08-29T04:00:00.000Z', expiresAt: '2026-08-29T05:00:00.000Z'
  }).plan;
  await kernel.declareAttempt({ attemptId: 'attempt-protected', plan, fixtureIds: ['fixture.write'], environmentDigest: ENV });
  await kernel.transition({ attemptId: 'attempt-protected', fixtureId: 'fixture.write', nextState: 'DEPENDENCIES_SATISFIED', facts: {} });
  await kernel.transition({ attemptId: 'attempt-protected', fixtureId: 'fixture.write', nextState: 'ENVIRONMENT_BOUND', facts: {} });
  await kernel.transition({ attemptId: 'attempt-protected', fixtureId: 'fixture.write', nextState: 'RUNNING', facts: {} });
  await kernel.transition({
    attemptId: 'attempt-protected', fixtureId: 'fixture.write', nextState: 'PASS',
    facts: { oraclePassed: true, observersAgree: true, forbiddenSideEffects: false, limitsPassed: true, cleanupPassed: true }
  });
  assert.equal(kernel.snapshot('attempt-protected').fixtureStates[0].state, 'PASS');
  assert.equal(records.length, 5);
  await assert.rejects(kernel.declareAttempt({ attemptId: 'attempt-protected', plan, fixtureIds: ['fixture.write'], environmentDigest: ENV }), (error) => error?.code === 'KSTACK_HARNESS_PLAN_INVALID');
  await assert.rejects(kernel.transition({ attemptId: 'attempt-protected', fixtureId: 'fixture.write', nextState: 'RUNNING', facts: {} }), (error) => error?.code === 'KSTACK_HARNESS_FIXTURE_TRANSITION_INVALID');
  code('KSTACK_HARNESS_UNAVAILABLE', () => new ProtectedHarnessKernel({
    schemaSetDigest: SCHEMA,
    allowTestBackend: true,
    backend: {
      descriptor: {
        protectionClass: 'test-only', repositoryWritable: true, agentWritable: false,
        durable: true, atomicPublication: true, appendOnlyAudit: true,
        observerStateProtected: true, expectedOutcomeProtected: true
      },
      append: async () => D('1')
    }
  }));
});

test('lockfile-pinned native Rust oracle independently matches aggregate precedence', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-harness-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(build.status, 0, build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-harness-reference${process.platform === 'win32' ? '.exe' : ''}`);
    const base = {
      actionUnproven: false,
      bypassFound: false,
      cleanupSucceeded: true,
      closureOutcome: 'PROVEN',
      coverageComplete: true,
      environmentEqual: true,
      fixtureAmbiguous: false,
      fixtureFailed: false,
      fixtureIncomplete: false,
      inventoryUnknown: false,
      logsComplete: true,
      observerContradiction: false,
      observerIntegrityError: false
    };
    const vectors = [
      [base, 'PASS'],
      [{ ...base, logsComplete: false }, 'INCOMPLETE'],
      [{ ...base, logsComplete: false, fixtureFailed: true }, 'FAIL'],
      [{ ...base, fixtureFailed: true, actionUnproven: true }, 'AMBIGUOUS'],
      [{ ...base, actionUnproven: true, observerIntegrityError: true }, 'HARNESS_ERROR'],
      [{ ...base, closureOutcome: 'UNAVAILABLE' }, 'INCOMPLETE'],
      [{ ...base, closureOutcome: 'CONTRADICTORY' }, 'HARNESS_ERROR']
    ];
    for (const [vector, aggregate] of vectors) {
      const result = spawnSync(binary, [], { input: JSON.stringify(vector), encoding: 'utf8', timeout: 30_000, maxBuffer: 65_536, shell: false });
      assert.equal(result.status, 0, result.error?.message || result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { aggregate });
    }
    const malformed = spawnSync(binary, [], {
      input: JSON.stringify({ ...base, preferredAggregate: 'PASS' }), encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(malformed.status, 2);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
