import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ProtectedActivationKernel,
  assertFreshReverseGeneration,
  classifyActivationRecovery,
  createActivationGenerationPlan,
  createOperationLease,
  createRestrictionEvent,
  evaluateActionFence,
  validateActivationExecutionClosure,
  validateActivationStoreProfile,
  validateActiveSet,
  validateActiveSetCandidate,
  validateBackgroundChildLease,
  validateLeaseRenewal
} from '../plugins/kstack/scripts/kstack-host-activation.mjs';

const D = (character) => `sha256:${character.repeat(64)}`; const SCHEMA = D('a');
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-activation-reference/Cargo.toml', import.meta.url));

function activeSet(overrides = {}) {
  const keys = ['hostContractSchemaSetDigest', 'resolverSetDigest', 'invariantRegistryDigest', 'vectorSetDigest', 'kernelDigest', 'protectedComponentDigest', 'adapterRegistryDigest', 'selectedAdapterDigest', 'brokerDigest', 'policyDigest', 'requirementRegistryDigest', 'eligibilityRegistryDigest', 'receiptRegistryDigest', 'evidenceRootDigest', 'evidenceProfileDigest', 'harnessDigest', 'observerSetDigest', 'bypassSetDigest', 'environmentMeasurementProfileDigest', 'mcpBackendDigest', 'mutationBackendDigest', 'migrationProfileDigest', 'compatibilityEntryDigest', 'qualificationEvidenceDigest'];
  return { schemaId: 'kstack.active-set.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, activeSetId: 'candidate-v1', ...Object.fromEntries(keys.map((key, index) => [key, D(String((index % 9) + 1))])), ...overrides };
}

function closure(activeSetDigest) {
  return {
    schemaId: 'kstack.activation-execution-closure.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, activeSetDigest,
    loadedResourceClosureDigest: D('1'), processImageDigest: D('2'), brokerInstanceProfileDigest: D('3'), mutationInstanceProfileDigest: D('4'),
    mcpInstanceProfileDigest: D('5'), adapterRegistryDigest: D('6'), policyRegistryDigest: D('7'), evidenceRegistryDigest: D('8'),
    executableIdentitySetDigest: D('9'), compatibilityFactsDigest: D('a'), readinessVectorDigest: D('b'), retentionReferenceDigests: [D('1'), D('2')]
  };
}

function storeProfile(overrides = {}) {
  return {
    profileId: 'linux-protected-root-v1', profileDigest: D('1'), implementationDigest: D('2'), platformDigest: D('3'), filesystemDigest: D('4'),
    protectionClass: 'test-only', atomicGenerationRootReplace: true, compareAndSwap: true, durabilityBarrier: true, rollbackDetection: true,
    appendOnlyJournal: true, consumerHandlePinning: true, repositoryWritable: false, agentWritable: false,
    faultVectorDigests: [D('1'), D('2')], qualifiedOutcome: 'PROVEN', ...overrides
  };
}

function plan(executionClosureDigest, activeSetDigest, overrides = {}) {
  return {
    schemaSetDigest: SCHEMA, activeSetDigest, executionClosureDigest, generationSequence: 5, currentRootDigest: D('1'), currentRootSequence: 4,
    immediatePriorGenerationDigest: D('2'), restrictionEpoch: 7, eligibilityEpoch: 9, hostBindingSnapshotDigest: D('3'), hostBindingVersionDigest: D('4'),
    migrationGateDigest: D('5'), instanceReadinessReceiptDigest: D('6'), activationDirection: 'FORWARD', targetHistoricalGenerationDigest: null,
    preparedAt: '2026-08-29T07:00:00.000Z', expiresAt: '2026-08-29T07:10:00.000Z', retirementPolicyDigest: D('7'), ...overrides
  };
}

function lease(overrides = {}) {
  return createOperationLease({
    schemaSetDigest: SCHEMA, leaseSequence: 1, requestDigest: D('1'), attemptDigest: D('2'), operationId: 'jira-comment', operationClassId: 'ASK_SIDE_EFFECT',
    principalDigest: D('3'), hostSessionDigest: D('4'), repositoryContextDigest: D('5'), rootIdentityDigest: D('6'), requirementProfileDigest: D('7'),
    eligibilityDigest: D('8'), eligibilityEpoch: 9, evidenceAdmissionSnapshotDigest: D('9'), environmentSnapshotDigest: D('a'), hostBindingVersionDigest: D('b'),
    authorityEnvelopeDigest: D('c'), activeSetDigest: D('0'), generationDigest: D('d'), generationSequence: 5, policyDigest: D('e'), restrictionEpoch: 7, quarantineHeadDigest: D('f'),
    revocationSequence: 3, idempotencyKeyDigest: D('1'), nonceDigest: D('2'), actionFenceProfileDigest: D('3'),
    issuedAt: '2026-08-29T07:00:00.000Z', expiresAt: '2026-08-29T07:05:00.000Z', state: 'ADMITTED', ...overrides
  }).lease;
}

function snapshot(overrides = {}) {
  return {
    generationDigest: D('d'), generationSequence: 5, activeSetDigest: D('0'), policyDigest: D('e'), eligibilityDigest: D('8'), eligibilityEpoch: 9,
    environmentSnapshotDigest: D('a'), hostBindingVersionDigest: D('b'), restrictionEpoch: 7, quarantineHeadDigest: D('f'), revocationSequence: 3,
    repositoryContextDigest: D('5'), rootIdentityDigest: D('6'), hostSessionDigest: D('4'), trustedTime: '2026-08-29T07:01:00.000Z', ...overrides
  };
}

function measurement(overrides = {}) {
  return { hostBindingVersionDigest: D('b'), environmentSnapshotDigest: D('a'), changeSourceDigest: D('1'), eventOverflowed: false, orderingQualified: true, observedAt: '2026-08-29T07:01:00.000Z', ...overrides };
}

function actionBinding(source = lease(), overrides = {}) {
  return { requestDigest: source.requestDigest, attemptDigest: source.attemptDigest, operationId: source.operationId, operationClassId: source.operationClassId, authorityEnvelopeDigest: source.authorityEnvelopeDigest, idempotencyKeyDigest: source.idempotencyKeyDigest, actionFenceProfileDigest: source.actionFenceProfileDigest, actionPayloadDigest: D('4'), effectScopeDigest: D('5'), ...overrides };
}

function candidate(activeSetDigest) {
  return { schemaId: 'kstack.active-set-candidate.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, candidateActiveSetDigest: activeSetDigest, priorActiveSetDigest: D('1'), compatibilityEntryDigest: D('2'), schemaSelectionDigest: D('3'), externalHostConstraintDigest: D('4'), hostEnvironmentSnapshotDigest: D('3'), hostBindingVersionDigest: D('4'), implementationValidationReceiptDigests: [D('1'), D('2')], migrationGateDigest: D('5'), stagedAt: '2026-08-29T07:00:00.000Z', expiresAt: '2026-08-29T07:10:00.000Z' };
}

test('active sets and execution closures are exact, complete, and content addressed', () => {
  const active = validateActiveSet(activeSet()); const closed = validateActivationExecutionClosure(closure(active.activeSetDigest));
  assert.match(active.activeSetDigest, /^sha256:/u); assert.match(closed.executionClosureDigest, /^sha256:/u);
  assert.throws(() => validateActiveSet({ ...activeSet(), alias: 'latest' }), (error) => error?.code === 'KSTACK_ACTIVE_SET_INVALID');
  assert.throws(() => validateActivationExecutionClosure({ ...closure(active.activeSetDigest), retentionReferenceDigests: [D('2'), D('1')] }), (error) => error?.code === 'KSTACK_ACTIVATION_CLOSURE_INVALID');
});

test('activation storage requires one protected durable generation-root primitive', () => {
  assert.doesNotThrow(() => validateActivationStoreProfile(storeProfile()));
  for (const mutation of [{ atomicGenerationRootReplace: false }, { durabilityBarrier: false }, { consumerHandlePinning: false }, { repositoryWritable: true }, { rollbackDetection: false }]) {
    assert.throws(() => validateActivationStoreProfile(storeProfile(mutation)), (error) => error?.code === 'KSTACK_ACTIVATION_STORE_UNQUALIFIED');
  }
});

test('generation plans bind current root, monotonic sequence, epochs, readiness, and direction', () => {
  const active = validateActiveSet(activeSet()); const closed = validateActivationExecutionClosure(closure(active.activeSetDigest));
  assert.match(validateActiveSetCandidate(candidate(active.activeSetDigest)).candidateDigest, /^sha256:/u);
  assert.throws(() => validateActiveSetCandidate({ ...candidate(active.activeSetDigest), implementationValidationReceiptDigests: [] }), (error) => error?.code === 'KSTACK_ACTIVE_SET_CANDIDATE_INVALID');
  assert.match(createActivationGenerationPlan(plan(closed.executionClosureDigest, active.activeSetDigest)).planDigest, /^sha256:/u);
  assert.throws(() => createActivationGenerationPlan(plan(closed.executionClosureDigest, active.activeSetDigest, { generationSequence: 4 })), (error) => error?.code === 'KSTACK_ACTIVATION_GENERATION_INVALID');
  assert.throws(() => createActivationGenerationPlan(plan(closed.executionClosureDigest, active.activeSetDigest, { targetHistoricalGenerationDigest: D('8') })), (error) => error?.code === 'KSTACK_ACTIVATION_GENERATION_INVALID');
});

test('reverse activation reuses only the closure and requires fresh lineage, epochs, gate, host, and readiness', () => {
  const currentRoot = { rootDigest: D('1'), root: { rootSequence: 8, generationSequence: 8, generationDigest: D('2') } };
  const historicalGeneration = { generationDigest: D('3'), generation: { restrictionEpoch: 4, eligibilityEpoch: 5, hostBindingSnapshotDigest: D('4'), hostBindingVersionDigest: D('5'), migrationGateDigest: D('6'), instanceReadinessReceiptDigest: D('7') } };
  const reversePlan = plan(D('8'), D('9'), { generationSequence: 9, currentRootSequence: 8, currentRootDigest: D('1'), immediatePriorGenerationDigest: D('2'), activationDirection: 'REVERSE', targetHistoricalGenerationDigest: D('3'), restrictionEpoch: 10, eligibilityEpoch: 11, hostBindingSnapshotDigest: D('a'), hostBindingVersionDigest: D('b'), migrationGateDigest: D('c'), instanceReadinessReceiptDigest: D('d') });
  assert.doesNotThrow(() => assertFreshReverseGeneration({ currentRoot, historicalGeneration, historicalExecutionClosureDigest: D('8'), reversePlan }));
  assert.throws(() => assertFreshReverseGeneration({ currentRoot, historicalGeneration, historicalExecutionClosureDigest: D('8'), reversePlan: { ...reversePlan, restrictionEpoch: 4 } }), (error) => error?.code === 'KSTACK_ACTIVATION_REVERSE_STALE');
});

test('recovery accepts only exact prior-no-receipt or exact durable candidate predicates', () => {
  const base = { rootRelation: 'CANDIDATE', replacementReceiptState: 'DURABLE', intentValid: true, rootIntegrityValid: true, lineageValid: true, closureReady: true, durabilityValid: true };
  assert.equal(classifyActivationRecovery(base), 'ACTIVE');
  assert.equal(classifyActivationRecovery({ ...base, rootRelation: 'PRIOR', replacementReceiptState: 'ABSENT' }), 'RECOVERED_PRIOR');
  for (const mutation of [{ rootRelation: 'HISTORICAL' }, { rootRelation: 'OTHER' }, { replacementReceiptState: 'INVALID' }, { lineageValid: false }, { closureReady: false }, { durabilityValid: false }, { rootIntegrityValid: false }]) assert.equal(classifyActivationRecovery({ ...base, ...mutation }), 'ACTIVATION_AMBIGUOUS');
});

test('leases are exact, single-attempt, bounded, and cannot renew in place', () => {
  const first = lease(); assert.match(createOperationLease(Object.fromEntries(Object.entries(first).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key)))).leaseDigest, /^sha256:/u);
  assert.throws(() => createOperationLease({ ...Object.fromEntries(Object.entries(first).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))), expiresAt: first.issuedAt }), (error) => error?.code === 'KSTACK_LEASE_INVALID');
  const renewed = lease({ leaseSequence: 2, nonceDigest: D('4'), authorityEnvelopeDigest: D('5'), issuedAt: '2026-08-29T07:02:00.000Z', expiresAt: '2026-08-29T07:06:00.000Z' });
  assert.doesNotThrow(() => validateLeaseRenewal({ priorLease: first, newLease: renewed, ownerApprovalRequired: true }));
  assert.throws(() => validateLeaseRenewal({ priorLease: first, newLease: { ...renewed, authorityEnvelopeDigest: first.authorityEnvelopeDigest }, ownerApprovalRequired: true }), (error) => error?.code === 'KSTACK_BACKGROUND_APPROVAL_REQUIRED');
});

test('background controller leases cannot authorize an effecting child or reuse stale approval', () => {
  const controller = lease({ operationId: 'background-controller', operationClassId: 'BACKGROUND' });
  const child = lease({ leaseSequence: 2, requestDigest: D('4'), attemptDigest: D('5'), nonceDigest: D('6'), authorityEnvelopeDigest: D('7') });
  assert.doesNotThrow(() => validateBackgroundChildLease({ controllerLease: controller, childLease: child, effecting: true }));
  assert.throws(() => validateBackgroundChildLease({ controllerLease: controller, childLease: { ...child, authorityEnvelopeDigest: null }, effecting: true }), (error) => error?.code === 'KSTACK_BACKGROUND_APPROVAL_REQUIRED');
  assert.throws(() => validateBackgroundChildLease({ controllerLease: controller, childLease: controller, effecting: true }), (error) => error?.code === 'KSTACK_BACKGROUND_CHILD_INVALID');
});

test('the action fence compares every live lease binding and shortest expiry', () => {
  const activeLease = lease(); const base = { lease: activeLease, current: snapshot(), hostRemeasurement: measurement(), actionBinding: actionBinding(activeLease) };
  assert.equal(evaluateActionFence(base).disposition, 'DISPATCH_COMMITTED');
  const fields = ['activeSetDigest', 'generationDigest', 'generationSequence', 'policyDigest', 'eligibilityDigest', 'eligibilityEpoch', 'environmentSnapshotDigest', 'hostBindingVersionDigest', 'restrictionEpoch', 'quarantineHeadDigest', 'revocationSequence', 'repositoryContextDigest', 'rootIdentityDigest', 'hostSessionDigest'];
  for (const key of fields) assert.equal(evaluateActionFence({ ...base, current: { ...base.current, [key]: typeof base.current[key] === 'number' ? base.current[key] + 1 : D('7') } }).disposition, 'FENCED', key);
  assert.equal(evaluateActionFence({ ...base, current: { ...base.current, trustedTime: base.lease.expiresAt } }).disposition, 'FENCED');
  for (const key of ['requestDigest', 'attemptDigest', 'operationId', 'operationClassId', 'authorityEnvelopeDigest', 'idempotencyKeyDigest', 'actionFenceProfileDigest']) {
    const value = key === 'operationId' ? 'other-operation' : key === 'operationClassId' ? 'LOCAL_WRITE' : D('0');
    assert.equal(evaluateActionFence({ ...base, actionBinding: { ...base.actionBinding, [key]: value } }).disposition, 'FENCED', key);
  }
});

test('event overflow, unqualified ordering, or independent host drift always fences', () => {
  const activeLease = lease(); const base = { lease: activeLease, current: snapshot(), hostRemeasurement: measurement(), actionBinding: actionBinding(activeLease) };
  for (const mutation of [{ eventOverflowed: true }, { orderingQualified: false }, { hostBindingVersionDigest: D('0') }, { environmentSnapshotDigest: D('0') }]) assert.equal(evaluateActionFence({ ...base, hostRemeasurement: measurement(mutation) }).disposition, 'FENCED');
});

function backendFixture({ invokeThrows = false, consumerWorkAccepted = false, publicationDigestMismatch = false } = {}) {
  const calls = []; const generations = new Map(); let root = null;
  const backend = {
    descriptor: storeProfile(),
    append: async (entry) => { calls.push(`append:${entry.event}`); return D(String((calls.length % 9) + 1)); },
    prepareGeneration: async (generationPlan) => { calls.push('prepareGeneration'); return { executionClosureDigest: generationPlan.executionClosureDigest, readinessReceiptDigest: generationPlan.instanceReadinessReceiptDigest, consumerWorkAccepted }; },
    activationTransaction: async (input) => { calls.push('activationTransaction'); root = input.candidateRoot; generations.set(input.generationDigest, input.generation); return { rootReplacementReceiptDigest: D('2'), durabilityReceiptDigest: D('3'), publishedRootDigest: publicationDigestMismatch ? D('0') : input.candidateRootDigest }; },
    loadRoot: async () => root, resolveGeneration: async (generationDigest) => generations.get(generationDigest),
    withFenceTransaction: async (callback) => { calls.push('fence:start'); const result = await callback(); calls.push('fence:end'); return result; },
    snapshotFenceInputs: async () => { calls.push('snapshotFenceInputs'); return snapshot(); }, measureHostBinding: async () => { calls.push('measureHostBinding'); return measurement(); },
    invokeAction: async () => { calls.push('invokeAction'); if (invokeThrows) throw new Error('lost'); return { outcome: 'RESPONSE_CAPTURED', responseDigest: D('4') }; },
    invalidateLeases: async () => { calls.push('invalidateLeases'); }, cancelDescendants: async () => { calls.push('cancelDescendants'); }
  };
  return {
    backend,
    calls,
    mutateRoot: (mutator) => { root = mutator(root); },
    mutateGeneration: (generationDigest, mutator) => { generations.set(generationDigest, mutator(generations.get(generationDigest))); }
  };
}

test('one root transaction publishes an already-ready generation and handles pin its closure', async () => {
  const active = validateActiveSet(activeSet()); const closed = validateActivationExecutionClosure(closure(active.activeSetDigest)); const adapter = backendFixture();
  const kernel = new ProtectedActivationKernel({ schemaSetDigest: SCHEMA, storeId: 'activation-store', backend: adapter.backend, allowTestBackend: true });
  const activated = await kernel.activate({ candidate: candidate(active.activeSetDigest), plan: plan(closed.executionClosureDigest, active.activeSetDigest) }); assert.match(activated.generation.generationDigest, /^sha256:/u);
  assert.deepEqual(adapter.calls.slice(0, 4), ['prepareGeneration', 'append:COMMIT_INTENT', 'activationTransaction', 'append:ACTIVE']);
  const handle = await kernel.acquireHandle(); assert.equal(handle.executionClosureDigest, closed.executionClosureDigest); assert.equal(handle.generationDigest, activated.generation.generationDigest);
  adapter.mutateGeneration(activated.generation.generationDigest, (generation) => ({ ...generation, executionClosureDigest: D('0') }));
  await assert.rejects(() => kernel.acquireHandle(), (error) => error?.code === 'KSTACK_ACTIVATION_HANDLE_INVALID');
  adapter.mutateGeneration(activated.generation.generationDigest, () => activated.generation.generation);
  adapter.mutateRoot((root) => ({ ...root, restrictionEpoch: root.restrictionEpoch + 1 }));
  await assert.rejects(() => kernel.acquireHandle(), (error) => error?.code === 'KSTACK_ACTIVATION_HANDLE_INVALID');
});

test('activation rejects mismatched candidates, pre-publication work, and false publication identity', async () => {
  const active = validateActiveSet(activeSet()); const closed = validateActivationExecutionClosure(closure(active.activeSetDigest)); const planValue = plan(closed.executionClosureDigest, active.activeSetDigest);
  const mismatch = backendFixture(); const mismatchKernel = new ProtectedActivationKernel({ schemaSetDigest: SCHEMA, storeId: 'activation-store', backend: mismatch.backend, allowTestBackend: true });
  await assert.rejects(() => mismatchKernel.activate({ candidate: candidate(D('0')), plan: planValue }), (error) => error?.code === 'KSTACK_ACTIVE_SET_CANDIDATE_INVALID');
  const accepting = backendFixture({ consumerWorkAccepted: true }); const acceptingKernel = new ProtectedActivationKernel({ schemaSetDigest: SCHEMA, storeId: 'activation-store', backend: accepting.backend, allowTestBackend: true });
  await assert.rejects(() => acceptingKernel.activate({ candidate: candidate(active.activeSetDigest), plan: planValue }), (error) => error?.code === 'KSTACK_ACTIVATION_PREPARE_INVALID');
  assert.deepEqual(accepting.calls, ['prepareGeneration']);
  const falsePublication = backendFixture({ publicationDigestMismatch: true }); const falseKernel = new ProtectedActivationKernel({ schemaSetDigest: SCHEMA, storeId: 'activation-store', backend: falsePublication.backend, allowTestBackend: true });
  await assert.rejects(() => falseKernel.activate({ candidate: candidate(active.activeSetDigest), plan: planValue }), (error) => error?.code === 'KSTACK_ACTIVATION_PUBLICATION_INVALID');
  assert.equal(falsePublication.calls.includes('append:ACTIVE'), false);
});

test('dispatch is durably committed before one action; response loss reconciles without retry', async () => {
  const adapter = backendFixture(); const kernel = new ProtectedActivationKernel({ schemaSetDigest: SCHEMA, storeId: 'activation-store', backend: adapter.backend, allowTestBackend: true });
  const activeLease = lease(); const result = await kernel.commitAction({ lease: activeLease, actionBinding: actionBinding(activeLease) }); assert.equal(result.disposition, 'DISPATCH_COMMITTED');
  assert.ok(adapter.calls.indexOf('append:DISPATCH_COMMITTED') < adapter.calls.indexOf('invokeAction')); assert.equal(adapter.calls.filter((entry) => entry === 'invokeAction').length, 1);
  const lost = backendFixture({ invokeThrows: true }); const lostKernel = new ProtectedActivationKernel({ schemaSetDigest: SCHEMA, storeId: 'activation-store', backend: lost.backend, allowTestBackend: true });
  assert.equal((await lostKernel.commitAction({ lease: activeLease, actionBinding: actionBinding(activeLease) })).disposition, 'RECONCILE'); assert.equal(lost.calls.filter((entry) => entry === 'invokeAction').length, 1);
});

test('restriction epoch is durable before lease invalidation and descendant cancellation', async () => {
  const adapter = backendFixture(); const kernel = new ProtectedActivationKernel({ schemaSetDigest: SCHEMA, storeId: 'activation-store', backend: adapter.backend, allowTestBackend: true });
  const input = { schemaSetDigest: SCHEMA, scopeDigest: D('1'), oldRestrictionEpoch: 7, newRestrictionEpoch: 8, sourceType: 'HOST_BINDING_CHANGE', sourceDigest: D('2'), reasonCode: 'KSTACK_FENCE_HOST_BINDING_CHANGED', affectedOperationIds: ['jira-comment'], affectedLeaseDigests: [D('3')], effectiveAt: '2026-08-29T07:01:00.000Z', protectedAnchorDigest: D('4') };
  assert.match(createRestrictionEvent(input).eventDigest, /^sha256:/u); await kernel.restrict(input);
  assert.ok(adapter.calls.indexOf('append:RESTRICTION_ADVANCED') < adapter.calls.indexOf('invalidateLeases')); assert.ok(adapter.calls.indexOf('invalidateLeases') < adapter.calls.indexOf('cancelDescendants'));
});

test('independent Rust oracle matches the complete recovery predicate space', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-activation-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], { encoding: 'utf8' }); assert.equal(build.status, 0, build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-activation-reference${process.platform === 'win32' ? '.exe' : ''}`); const vectors = [];
    for (const rootRelation of ['CANDIDATE', 'HISTORICAL', 'OTHER', 'PRIOR']) for (const replacementReceiptState of ['ABSENT', 'DURABLE', 'INVALID']) for (let mask = 0; mask < 32; mask += 1) vectors.push({ rootRelation, replacementReceiptState, intentValid: !!(mask & 1), rootIntegrityValid: !!(mask & 2), lineageValid: !!(mask & 4), closureReady: !!(mask & 8), durabilityValid: !!(mask & 16) });
    const input = vectors.map((value) => [value.rootRelation, value.replacementReceiptState, ...['intentValid', 'rootIntegrityValid', 'lineageValid', 'closureReady', 'durabilityValid'].map((key) => value[key] ? '1' : '0')].join(',')).join('\n');
    const oracle = spawnSync(binary, [input], { encoding: 'utf8' }); assert.equal(oracle.status, 0, oracle.stderr); const rows = oracle.stdout.trim().split('\n');
    vectors.forEach((vector, index) => assert.equal(rows[index], classifyActivationRecovery(vector), JSON.stringify(vector))); assert.equal(spawnSync(binary, ['bad'], { encoding: 'utf8' }).status, 2);
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
});
