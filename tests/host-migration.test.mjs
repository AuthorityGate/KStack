import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ProtectedMigrationKernel,
  classifyRollbackInvalidation,
  classifyHpQ3Predicate,
  createMigrationPlan,
  createPersistedArtifactInventory,
  evaluateHpQ3Gate,
  validateMigrationQualification,
  validateMigrationBackendProfile,
  validateMigrationTransition,
  validateRollbackAvailability,
  validateRetentionRelease,
  validateRolloutSeam,
  validateShadowRun
} from '../plugins/kstack/scripts/kstack-host-migration.mjs';

const D = (character) => `sha256:${character.repeat(64)}`; const SCHEMA = D('a');
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-migration-reference/Cargo.toml', import.meta.url));

function artifact(artifactId, disposition = 'AUTHORITATIVE', overrides = {}) {
  const derived = disposition === 'DERIVED_REBUILDABLE'; const external = disposition === 'EXTERNAL_EFFECT';
  return {
    artifactId, authorityClassId: 'PERSISTED_STATE', ownerComponentId: 'replay-kernel', locationIdentityDigest: D('1'), schemaVersionId: 'schema-v1', semanticVersionId: 'semantic-v1',
    readerSetDigest: D('2'), writerSetDigest: D('3'), retentionProfileDigest: D('4'), confidentialityClassId: 'PROTECTED', encryptionProfileDigest: D('5'), keyGenerationDigest: D('6'),
    consistencyGroupId: 'group-a', snapshotMethodId: 'protected-snapshot', mutationProfileDigest: D('7'), externalStateCorrelationDigest: external ? D('8') : null,
    migrationTransformDigest: D('9'), restoreReplayTransformDigest: D('b'), validationOracleDigest: D('c'), disposition,
    derivedSourceTruthDigest: derived ? D('d') : null, derivedRebuildImplementationDigest: derived ? D('e') : null, derivedEqualityVectorDigest: derived ? D('f') : null,
    derivedAuthorityIsolationProven: derived, ...overrides
  };
}

function inventory(overrides = {}) {
  return {
    schemaSetDigest: SCHEMA, currentActiveSetDigest: D('1'), candidateActiveSetDigest: D('2'), declaredArtifactIds: ['audit', 'cache', 'external', 'replay'],
    staticArtifactIds: ['audit', 'cache'], registryArtifactIds: ['replay'], openedStoreArtifactIds: ['audit', 'replay'], catalogArtifactIds: ['cache'], providerArtifactIds: ['external'], dynamicWriteArtifactIds: ['replay'],
    rows: [artifact('audit', 'PROTECTED_AUDIT'), artifact('cache', 'DERIVED_REBUILDABLE'), artifact('external', 'EXTERNAL_EFFECT'), artifact('replay', 'REPLAY_SAFETY')], ...overrides
  };
}

function classification(artifactId, kind, overrides = {}) {
  return {
    artifactId, consistencyGroupId: 'group-a', classification: kind, fixtureSetDigest: D('1'), oracleDigest: D('2'),
    priorReadProven: ['UNCHANGED_BACKWARD_READABLE', 'CHANGED_BACKWARD_READABLE'].includes(kind), priorWriteProven: ['UNCHANGED_BACKWARD_READABLE', 'CHANGED_BACKWARD_READABLE'].includes(kind),
    snapshotRestoreProven: kind === 'RESTORE_AND_REPLAY_VERIFIED', candidateWriteReplayProven: kind === 'RESTORE_AND_REPLAY_VERIFIED', forwardRecoveryProven: kind === 'FORWARD_RECOVERY_VERIFIED',
    rebuildProven: kind === 'DERIVED_REBUILD_VERIFIED', ephemeralDropProven: kind === 'EPHEMERAL_DROP_VERIFIED', ...overrides
  };
}

function plan(overrides = {}) {
  return {
    schemaSetDigest: SCHEMA, priorActiveSetDigest: D('1'), candidateActiveSetDigest: D('2'), recoveryActiveSetDigest: D('3'), inventoryDigest: D('4'), compatibilityEntryDigest: D('5'),
    sourceVersionSetDigest: D('6'), targetVersionSetDigest: D('7'), transformSetDigest: D('8'), consistencyGroupOrder: ['group-a'], resourceLimitDigest: D('9'), writeFenceProfileDigest: D('b'),
    snapshotProfileDigest: D('c'), restoreReplayProfileDigest: D('d'), expectedStateDigest: D('e'), oracleFixtureSetDigest: D('f'), cleanupProfileDigest: D('0'),
    expiresAt: '2026-08-29T08:00:00.000Z', rollbackWindowEndsAt: '2026-08-30T08:00:00.000Z',
    classifications: [classification('audit', 'RESTORE_AND_REPLAY_VERIFIED'), classification('cache', 'DERIVED_REBUILD_VERIFIED'), classification('external', 'FORWARD_RECOVERY_VERIFIED'), classification('replay', 'RESTORE_AND_REPLAY_VERIFIED')], ...overrides
  };
}

function qualification(planDigest, overrides = {}) {
  return {
    schemaId: 'kstack.migration-qualification.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, planDigest, inventoryDigest: D('4'), inputFixtureDigest: D('1'), outputFixtureDigest: D('2'), oracleSetDigest: D('3'),
    environmentDigest: D('4'), resourceMeasurementDigest: D('5'), artifactResultDigest: D('6'), completeArtifactIds: ['audit', 'cache', 'external', 'replay'], recoveryDurationMs: 1000,
    limitationsDigest: D('7'), harnessIndependent: true, subjectCouldWriteEvidence: false, outcome: 'PASS', qualifiedAt: '2026-08-29T07:00:00.000Z', expiresAt: '2026-08-29T08:00:00.000Z', ...overrides
  };
}

function rollback(planDigest, overrides = {}) {
  return {
    schemaId: 'kstack.rollback-availability.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, planDigest, strategy: 'RESTORE_REPLAY', artifactCoverageDigest: D('1'), priorActiveSetDigest: D('1'), recoveryActiveSetDigest: D('3'),
    snapshotDigest: D('4'), changeJournalDigest: D('5'), lastVerifiedStoreDigest: D('6'), lastVerifiedStoreSequence: 8, candidateWritesAccepted: true, expiresAt: '2026-08-30T07:00:00.000Z',
    invalidatorSetDigest: D('7'), estimatedRecoveryMs: 2000, dataLossClaim: 'ZERO_PROVEN', status: 'AVAILABLE', retainedDependencySetDigest: D('8'), ...overrides
  };
}

test('inventory is complete across every source and every row is exact', () => {
  assert.match(createPersistedArtifactInventory(inventory()).inventoryDigest, /^sha256:/u);
  assert.throws(() => createPersistedArtifactInventory(inventory({ dynamicWriteArtifactIds: ['hidden', 'replay'] })), (error) => error?.code === 'KSTACK_MIGRATION_INVENTORY_SET_MISMATCH');
  assert.throws(() => createPersistedArtifactInventory(inventory({ rows: [...inventory().rows, artifact('secret')] })), (error) => error?.code === 'KSTACK_MIGRATION_INVENTORY_SET_MISMATCH');
});

test('derived state defaults closed unless rebuild and authority isolation are all proven', () => {
  assert.throws(() => createPersistedArtifactInventory(inventory({ rows: [artifact('audit', 'PROTECTED_AUDIT'), artifact('cache', 'DERIVED_REBUILDABLE', { derivedEqualityVectorDigest: null }), artifact('external', 'EXTERNAL_EFFECT'), artifact('replay', 'REPLAY_SAFETY')] })), (error) => error?.code === 'KSTACK_MIGRATION_INVENTORY_INVALID');
  assert.throws(() => createPersistedArtifactInventory(inventory({ rows: [artifact('audit', 'PROTECTED_AUDIT', { derivedSourceTruthDigest: D('0') }), ...inventory().rows.slice(1)] })), (error) => error?.code === 'KSTACK_MIGRATION_INVENTORY_INVALID');
});

test('migration plan covers one ordered classification per artifact and rejects unsupported proof claims', () => {
  assert.match(createMigrationPlan(plan()).planDigest, /^sha256:/u);
  assert.throws(() => createMigrationPlan(plan({ classifications: [classification('audit', 'RESTORE_AND_REPLAY_VERIFIED', { candidateWriteReplayProven: false }), ...plan().classifications.slice(1)] })), (error) => error?.code === 'KSTACK_MIGRATION_PLAN_INVALID');
  assert.throws(() => createMigrationPlan(plan({ classifications: [...plan().classifications].reverse() })), (error) => error?.code === 'KSTACK_MIGRATION_PLAN_INVALID');
});

test('qualification is independent, bounded, complete, and cannot be self-authored', () => {
  const addressed = createMigrationPlan(plan()); assert.doesNotThrow(() => validateMigrationQualification(qualification(addressed.planDigest)));
  assert.throws(() => validateMigrationQualification(qualification(addressed.planDigest, { subjectCouldWriteEvidence: true })), (error) => error?.code === 'KSTACK_MIGRATION_QUALIFICATION_INVALID');
  assert.throws(() => validateMigrationQualification(qualification(addressed.planDigest, { harnessIndependent: false })), (error) => error?.code === 'KSTACK_MIGRATION_QUALIFICATION_INVALID');
});

test('locked HP-Q3 permits artifact changes only with current complete zero-loss recovery', () => {
  const addressed = createMigrationPlan(plan()); const base = { artifactChanging: true, operationalPointerRollback: true, inventoryArtifactIds: ['audit', 'cache', 'external', 'replay'], plan: plan(), qualification: qualification(addressed.planDigest), rollback: rollback(addressed.planDigest), trustedTime: '2026-08-29T07:30:00.000Z' };
  assert.equal(evaluateHpQ3Gate(base).disposition, 'ACTIVATION_READY');
  for (const mutation of [{ status: 'INVALIDATED' }, { dataLossClaim: 'UNKNOWN' }, { strategy: 'NONE', snapshotDigest: null, changeJournalDigest: null }]) assert.equal(evaluateHpQ3Gate({ ...base, rollback: rollback(addressed.planDigest, mutation) }).disposition, 'BLOCKED');
  assert.equal(evaluateHpQ3Gate({ ...base, qualification: qualification(addressed.planDigest, { outcome: 'FAIL' }) }).disposition, 'BLOCKED');
  assert.equal(evaluateHpQ3Gate({ ...base, qualification: qualification(addressed.planDigest, { inventoryDigest: D('0') }) }).disposition, 'BLOCKED');
  assert.equal(evaluateHpQ3Gate({ ...base, rollback: rollback(addressed.planDigest, { priorActiveSetDigest: D('0') }) }).disposition, 'BLOCKED');
});

test('nonchanging activation discloses unavailable rollback instead of claiming it', () => {
  const addressed = createMigrationPlan(plan()); const result = evaluateHpQ3Gate({ artifactChanging: false, operationalPointerRollback: false, inventoryArtifactIds: ['audit', 'cache', 'external', 'replay'], plan: plan(), qualification: qualification(addressed.planDigest), rollback: rollback(addressed.planDigest), trustedTime: '2026-08-29T07:30:00.000Z' });
  assert.equal(result.disposition, 'ROLLBACK_UNAVAILABLE');
});

test('migration state graph rejects pointer-only and mixed-writer shortcuts', () => {
  for (const pair of [['PLANNED', 'WRITES_FENCED'], ['TARGET_VERIFIED', 'ACTIVATION_READY'], ['CANDIDATE_ACTIVE', 'ROLLBACK_FENCED'], ['ROLLBACK_FENCED', 'PRIOR_ACTIVE']]) assert.doesNotThrow(() => validateMigrationTransition({ from: pair[0], to: pair[1] }));
  for (const pair of [['PLANNED', 'CANDIDATE_ACTIVE'], ['MIGRATING', 'PRIOR_ACTIVE'], ['CANDIDATE_ACTIVE', 'PRIOR_ACTIVE']]) assert.throws(() => validateMigrationTransition({ from: pair[0], to: pair[1] }), (error) => error?.code === 'KSTACK_MIGRATION_TRANSITION_INVALID');
});

test('every rollback invalidator fences immediately and retention release requires zero live references', () => {
  const base = { trustedTime: '2026-08-29T07:00:00.000Z', expiresAt: '2026-08-30T07:00:00.000Z', changeJournalMissing: false, externalStateContradiction: false, keyChanged: false, qualificationExpired: false, recoverySetMissing: false, schemaChanged: false, snapshotInvalid: false, transformChanged: false, unjournaledWrite: false };
  assert.equal(classifyRollbackInvalidation(base), 'AVAILABLE'); for (const key of Object.keys(base).filter((key) => typeof base[key] === 'boolean')) assert.equal(classifyRollbackInvalidation({ ...base, [key]: true }), 'INVALIDATED', key); assert.equal(classifyRollbackInvalidation({ ...base, trustedTime: base.expiresAt }), 'EXPIRED');
  const release = { schemaSetDigest: SCHEMA, planDigest: D('1'), retainedDependencySetDigest: D('2'), rollbackWindowConclusive: true, liveReferenceCount: 0, policyRetentionPermits: true, protectedAction: true, auditReceiptDigest: D('3') }; assert.doesNotThrow(() => validateRetentionRelease(release)); assert.throws(() => validateRetentionRelease({ ...release, liveReferenceCount: 1 }), (error) => error?.code === 'KSTACK_ROLLBACK_RETENTION_RELEASE_INVALID');
});

function seam(seamType, overrides = {}) { return { schemaId: 'kstack.rollout-seam.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, seamId: seamType === 'H3A_SKILL_PROJECTION' ? 'skill-shadow' : 'mcp-shadow', seamType, candidateActiveSetDigest: D('1'), allowedMethods: seamType === 'H3A_SKILL_PROJECTION' ? [] : ['resources/list', 'resources/read'], publicResourceSetDigest: seamType === 'H3A_SKILL_PROJECTION' ? null : D('2'), isolatedEnvironmentDigest: D('3'), brokerAvailable: false, credentialsAvailable: false, writeHandlesAvailable: false, productionRepositoryAvailable: false, privateResourcesAvailable: false, toolsAvailable: false, promptsAvailable: false, subscriptionsAvailable: false, samplingAvailable: false, elicitationAvailable: false, identityPromotionAllowed: false, downstreamEvidenceAllowed: false, ...overrides }; }

test('H3a and H3b seams are separately closed and never inherit authority', () => {
  assert.doesNotThrow(() => validateRolloutSeam(seam('H3A_SKILL_PROJECTION'))); assert.doesNotThrow(() => validateRolloutSeam(seam('H3B_READ_ONLY_MCP')));
  for (const mutation of [{ brokerAvailable: true }, { credentialsAvailable: true }, { writeHandlesAvailable: true }, { identityPromotionAllowed: true }, { downstreamEvidenceAllowed: true }]) assert.throws(() => validateRolloutSeam(seam('H3A_SKILL_PROJECTION', mutation)), (error) => error?.code === 'KSTACK_ROLLOUT_SEAM_INVALID');
  assert.throws(() => validateRolloutSeam(seam('H3B_READ_ONLY_MCP', { allowedMethods: ['resources/list', 'tools/call'] })), (error) => error?.code === 'KSTACK_ROLLOUT_SEAM_INVALID');
});

test('shadow outcomes retain mismatches and make any side effect terminal', () => {
  const value = { schemaId: 'kstack.shadow-run.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, seamDigest: D('1'), candidateActiveSetDigest: D('2'), priorActiveSetDigest: D('3'), inputSetDigest: D('4'), syntheticOrSanitized: true, isolatedEnvironmentDigest: D('5'), outputSchemaDigest: D('6'), comparisonOracleDigest: D('7'), sideEffectDenialObserverDigest: D('8'), limitProfileDigest: D('9'), startMeasurementDigest: D('b'), endMeasurementDigest: D('c'), sideEffectDetected: false, outcome: 'MISMATCH' };
  assert.equal(validateShadowRun(value).outcome, 'MISMATCH'); assert.throws(() => validateShadowRun({ ...value, sideEffectDetected: true }), (error) => error?.code === 'KSTACK_SHADOW_INVALID');
  assert.equal(validateShadowRun({ ...value, sideEffectDetected: true, outcome: 'SIDE_EFFECT_DETECTED' }).outcome, 'SIDE_EFFECT_DETECTED');
});

test('closed HP-Q3 predicate precedence is deterministic', () => {
  const base = { artifactChanging: true, complete: true, current: true, supported: true, qualificationPass: true, bindingsMatch: true, rollbackAvailable: true, zeroLossProven: true, strategyPresent: true, operationalPointerRollback: true };
  assert.equal(classifyHpQ3Predicate(base), 'ACTIVATION_READY'); assert.equal(classifyHpQ3Predicate({ ...base, complete: false, zeroLossProven: false }), 'BLOCKED_EVIDENCE'); assert.equal(classifyHpQ3Predicate({ ...base, zeroLossProven: false }), 'BLOCKED_ZERO_LOSS'); assert.equal(classifyHpQ3Predicate({ ...base, artifactChanging: false, operationalPointerRollback: false }), 'ROLLBACK_UNAVAILABLE');
});

function backendProfile(overrides = {}) { return { profileId: 'test-protected-migration', profileDigest: D('1'), implementationDigest: D('2'), platformDigest: D('3'), protectionClass: 'test-only', protectedWriterFence: true, durableJournal: true, protectedSnapshot: true, changeJournal: true, independentOracle: true, activationOrderDomain: true, externalRewriteDisabled: true, repositoryWritable: false, agentWritable: false, qualifiedOutcome: 'PASS', ...overrides }; }

function backendFixture({ transformFails = false, recoveryFails = false, gateDrift = false, replayMismatch = false } = {}) {
  const calls = []; const backend = {
    descriptor: backendProfile(),
    withMigrationTransaction: async (callback) => { calls.push('transaction:start'); const value = await callback(); calls.push('transaction:end'); return value; },
    append: async (event) => { calls.push(`append:${event.event}`); return D(String((calls.length % 9) + 1)); },
    fenceWriters: async () => { calls.push('fenceWriters'); return D('1'); },
    reconcileInFlight: async () => { calls.push('reconcileInFlight'); return { settled: true, ambiguousCount: 0, receiptDigest: D('2') }; },
    captureSnapshot: async () => { calls.push('captureSnapshot'); return { snapshotDigest: D('4'), consistencyGroupDigest: D('3'), durabilityReceiptDigest: D('4') }; },
    startChangeJournal: async () => { calls.push('startChangeJournal'); return D('5'); },
    runTransformGroup: async ({ consistencyGroupId }) => { calls.push('runTransformGroup'); if (transformFails) { const error = new Error('failed'); error.code = 'KSTACK_MIGRATION_TRANSFORM_FAILED'; throw error; } return { consistencyGroupId, targetGroupDigest: D('6'), mutationEvidenceDigest: D('7'), externalRewriteAttempted: false }; },
    verifyTarget: async () => { calls.push('verifyTarget'); return { expectedStateDigest: D('e'), completeConsistencyGroupIds: ['group-a'], independent: true, oracleReceiptDigest: D('8') }; },
    snapshotActivationGate: async () => { calls.push('snapshotActivationGate'); const p = createMigrationPlan(plan()); const q = qualification(p.planDigest); const r = rollback(p.planDigest); return { planDigest: p.planDigest, qualificationDigest: D('0'), rollbackDigest: D('0'), priorActiveSetDigest: D('1'), candidateActiveSetDigest: D('2'), writerFenceHeld: true, eventOverflowed: gateDrift, hostBindingCurrent: true, restrictionEpochCurrent: true, eligibilityEpochCurrent: true, migrationGateCurrent: true, _qualification: q, _rollback: r }; },
    activateCandidate: async ({ candidateActiveSetDigest }) => { calls.push('activateCandidate'); return { activeSetDigest: candidateActiveSetDigest, activationReceiptDigest: D('9') }; },
    recoverPreActivation: async () => { calls.push('recoverPreActivation'); if (recoveryFails) throw new Error('lost'); return { disposition: 'PRIOR_RESTORED', zeroLossProven: true, recoveryReceiptDigest: D('8') }; },
    releaseWriters: async () => { calls.push('releaseWriters'); },
    captureJournalEnd: async () => { calls.push('captureJournalEnd'); return { changeJournalDigest: D('6'), acceptedWriteCount: 3, captureReceiptDigest: D('7') }; },
    revalidatePriorCompatibility: async () => { calls.push('revalidatePriorCompatibility'); return { priorActiveSetDigest: D('1'), readWriteRoundtripProven: true, compatibilityReceiptDigest: D('8') }; },
    restoreSnapshot: async () => { calls.push('restoreSnapshot'); return { restoreReceiptDigest: D('8'), snapshotDigest: D('4') }; },
    replayCandidateWrites: async () => { calls.push('replayCandidateWrites'); return { acceptedWriteCount: 3, replayedWriteCount: replayMismatch ? 2 : 3, duplicateWriteCount: 0, zeroLossProven: true, replayReceiptDigest: D('9') }; },
    forwardRecover: async () => { calls.push('forwardRecover'); return { recoveryActiveSetDigest: D('3'), recoveryReceiptDigest: D('8') }; },
    verifyRecoveryTarget: async ({ targetActiveSetDigest }) => { calls.push('verifyRecoveryTarget'); return { targetActiveSetDigest, independent: true, zeroLossProven: true, verificationReceiptDigest: D('8') }; },
    activateRecoveryTarget: async ({ targetActiveSetDigest }) => { calls.push('activateRecoveryTarget'); return { activeSetDigest: targetActiveSetDigest, activationReceiptDigest: D('9') }; }
  };
  return { backend, calls };
}

function executionInput() { const addressed = createMigrationPlan(plan()); return { artifactChanging: true, operationalPointerRollback: true, rollbackLimitationDisplayed: false, inventoryArtifactIds: ['audit', 'cache', 'external', 'replay'], plan: plan(), qualification: qualification(addressed.planDigest), rollback: rollback(addressed.planDigest), trustedTime: '2026-08-29T07:30:00.000Z' }; }

function bindGateDigests(adapter, input) {
  const original = adapter.backend.snapshotActivationGate; adapter.backend.snapshotActivationGate = async () => {
    const value = await original(); const { _qualification, _rollback, ...closed } = value;
    const { hostAddress } = await import('../plugins/kstack/scripts/kstack-host-contract.mjs');
    return { ...closed, qualificationDigest: hostAddress('KSTACK-MIGRATION-QUALIFICATION-V1', input.qualification), rollbackDigest: hostAddress('KSTACK-ROLLBACK-AVAILABILITY-V1', input.rollback) };
  };
}

test('migration backend requires every protected ownership and ordering primitive', () => {
  assert.doesNotThrow(() => validateMigrationBackendProfile(backendProfile())); for (const mutation of [{ protectionClass: 'named-only' }, { protectedWriterFence: false }, { independentOracle: false }, { activationOrderDomain: false }, { externalRewriteDisabled: false }, { repositoryWritable: true }]) assert.throws(() => validateMigrationBackendProfile(backendProfile(mutation)), (error) => error?.code === 'KSTACK_MIGRATION_BACKEND_UNQUALIFIED');
  const adapter = backendFixture();
  assert.throws(() => new ProtectedMigrationKernel({ schemaSetDigest: SCHEMA, backend: { ...adapter.backend, descriptor: { ...adapter.backend.descriptor, profileId: 'production-looking-name' } }, allowTestBackend: false }), { code: 'KSTACK_MIGRATION_BACKEND_INVALID' });
});

test('protected execution holds one fence through snapshot, transform, verification, and activation', async () => {
  const input = executionInput(); const adapter = backendFixture(); bindGateDigests(adapter, input); const kernel = new ProtectedMigrationKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true }); const result = await kernel.execute(input); assert.equal(result.disposition, 'CANDIDATE_ACTIVE');
  const order = ['fenceWriters', 'append:WRITES_FENCED', 'reconcileInFlight', 'captureSnapshot', 'startChangeJournal', 'append:SNAPSHOT_VERIFIED', 'append:MIGRATING', 'runTransformGroup', 'append:GROUP_VERIFIED', 'verifyTarget', 'append:TARGET_VERIFIED', 'snapshotActivationGate', 'append:ACTIVATION_READY', 'activateCandidate', 'append:CANDIDATE_ACTIVE', 'releaseWriters'];
  let cursor = -1; for (const entry of order) { const next = adapter.calls.indexOf(entry); assert.ok(next > cursor, entry); cursor = next; }
});

test('pre-activation failure restores zero-loss state before writer release', async () => {
  const input = executionInput(); const adapter = backendFixture({ transformFails: true }); bindGateDigests(adapter, input); const kernel = new ProtectedMigrationKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true }); assert.equal((await kernel.execute(input)).disposition, 'FAILED_SAFE'); assert.ok(adapter.calls.indexOf('recoverPreActivation') < adapter.calls.indexOf('releaseWriters'));
  const ambiguous = backendFixture({ transformFails: true, recoveryFails: true }); bindGateDigests(ambiguous, input); const ambiguousKernel = new ProtectedMigrationKernel({ schemaSetDigest: SCHEMA, backend: ambiguous.backend, allowTestBackend: true }); assert.equal((await ambiguousKernel.execute(input)).disposition, 'OUTCOME_AMBIGUOUS'); assert.equal(ambiguous.calls.includes('releaseWriters'), false);
});

test('post-activation restore replays every accepted write exactly once before prior activation', async () => {
  const input = executionInput(); const adapter = backendFixture(); bindGateDigests(adapter, input); const kernel = new ProtectedMigrationKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true }); const result = await kernel.rollback({ plan: input.plan, rollback: input.rollback, trustedTime: input.trustedTime }); assert.equal(result.disposition, 'PRIOR_ACTIVE');
  const ordered = ['fenceWriters', 'append:ROLLBACK_FENCED', 'captureJournalEnd', 'restoreSnapshot', 'replayCandidateWrites', 'verifyRecoveryTarget', 'activateRecoveryTarget', 'append:PRIOR_ACTIVE', 'releaseWriters']; let cursor = -1; for (const entry of ordered) { const next = adapter.calls.indexOf(entry); assert.ok(next > cursor, entry); cursor = next; }
});

test('rollback replay mismatch remains fenced and never activates a pointer', async () => {
  const input = executionInput(); const adapter = backendFixture({ replayMismatch: true }); bindGateDigests(adapter, input); const kernel = new ProtectedMigrationKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true }); assert.equal((await kernel.rollback({ plan: input.plan, rollback: input.rollback, trustedTime: input.trustedTime })).disposition, 'OUTCOME_AMBIGUOUS'); assert.equal(adapter.calls.includes('activateRecoveryTarget'), false); assert.equal(adapter.calls.includes('releaseWriters'), false);
});

test('independent Rust oracle matches all 1024 locked HP-Q3 predicate combinations', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-migration-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], { encoding: 'utf8' }); assert.equal(build.status, 0, build.stderr); const binary = path.join(target, 'debug', `kstack-host-migration-reference${process.platform === 'win32' ? '.exe' : ''}`); const keys = ['artifactChanging', 'complete', 'current', 'supported', 'qualificationPass', 'bindingsMatch', 'rollbackAvailable', 'zeroLossProven', 'strategyPresent', 'operationalPointerRollback']; const vectors = [];
    for (let mask = 0; mask < 1024; mask += 1) vectors.push(Object.fromEntries(keys.map((key, index) => [key, !!(mask & (1 << index))]))); const input = vectors.map((vector) => keys.map((key) => vector[key] ? '1' : '0').join(',')).join('\n'); const oracle = spawnSync(binary, [input], { encoding: 'utf8' }); assert.equal(oracle.status, 0, oracle.stderr); const rows = oracle.stdout.trim().split('\n'); vectors.forEach((vector, index) => assert.equal(rows[index], classifyHpQ3Predicate(vector), JSON.stringify(vector))); assert.equal(spawnSync(binary, ['bad'], { encoding: 'utf8' }).status, 2);
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
});
