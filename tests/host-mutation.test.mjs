import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hostAddress } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  MUTATION_KINDS,
  ProtectedMutationKernel,
  advanceMutationState,
  assertDistinctRelativeTargets,
  classifyMutationRecovery,
  createCleanupIntent,
  createLocalMutationEvidence,
  validateLocalMutationPlan,
  validateMutationBackendProfile,
  validateNamespaceFootprint,
  validateRelativeTarget
} from '../plugins/kstack/scripts/kstack-host-mutation.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;
const SCHEMA = D('a');
const ROOT = D('b');
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-mutation-reference/Cargo.toml', import.meta.url));
const absent = () => ({ type: 'ABSENT', identityDigest: null, contentDigest: null, metadataDigest: null });
const regular = (character) => ({ type: 'REGULAR', identityDigest: D(character), contentDigest: D(character), metadataDigest: D('f') });
const directory = (character) => ({ type: 'DIRECTORY', identityDigest: D(character), contentDigest: null, metadataDigest: D('f') });

function entry(role, preState, postState, operation, index) {
  return {
    entryId: `entry.${role.toLowerCase()}`,
    parentIdentityDigest: D(String(index + 1)),
    parentGeneration: 4,
    role,
    phase: role === 'STAGING' ? 'PREPARE' : 'COMMIT',
    permittedNativeOperation: operation,
    preState,
    postState,
    agentAccessible: !['STAGING', 'RECOVERY'].includes(role)
  };
}

function footprint(operationKind) {
  const old = regular('1'); const desired = regular('2'); const oldDir = directory('3'); const preparedDir = directory('4');
  const rows = {
    CREATE_FILE: [entry('TARGET', absent(), desired, 'rename-noreplace', 0), entry('STAGING', desired, absent(), 'rename-noreplace', 1)],
    REPLACE_FILE: [entry('TARGET', old, desired, 'atomic-exchange', 0), entry('STAGING', desired, old, 'atomic-exchange', 1)],
    DELETE_FILE: [entry('TARGET', old, absent(), 'rename-noreplace', 0), entry('RECOVERY', absent(), old, 'rename-noreplace', 1)],
    CREATE_DIRECTORY: [entry('TARGET', absent(), preparedDir, 'rename-noreplace', 0), entry('STAGING', preparedDir, absent(), 'rename-noreplace', 1)],
    DELETE_EMPTY_DIRECTORY: [entry('TARGET', oldDir, absent(), 'rename-noreplace', 0), entry('RECOVERY', absent(), oldDir, 'rename-noreplace', 1)],
    RENAME_WITHIN_ROOT: [entry('SOURCE', old, absent(), 'rename-noreplace', 0), entry('TARGET', absent(), old, 'rename-noreplace', 1)]
  }[operationKind];
  return {
    schemaId: 'kstack.namespace-footprint.v1', schemaVersion: 1, schemaSetDigest: SCHEMA,
    operationKind, rootIdentityDigest: ROOT, entries: rows
  };
}

function backendProfile(overrides = {}) {
  return {
    profileId: 'linux-openat2', profileDigest: D('3'), assurance: 'EXCLUSIVE_MEDIATED',
    platformDigest: D('4'), filesystemDigest: D('5'), implementationDigest: D('6'),
    handleRelative: true, noFollow: true, beneathRoot: true, sameVolume: true,
    exclusiveMediation: true, atomicNoReplace: true, atomicExchange: true,
    directoryDurability: true, stableFileIdentity: true, aclIsolationProven: true,
    qualifiedOutcome: 'PROVEN', ...overrides
  };
}

function plan(operationKind = 'CREATE_FILE', requestCharacter = '1') {
  const namespace = footprint(operationKind);
  return {
    schemaId: 'kstack.local-mutation-plan.v1', schemaVersion: 1, schemaSetDigest: SCHEMA,
    requestDigest: D(requestCharacter), attemptDigest: D('2'), operationKind,
    repositoryContextDigest: D('3'), rootIdentityDigest: ROOT,
    sourceRelativeTargetDigest: operationKind === 'RENAME_WITHIN_ROOT' ? D('4') : null,
    targetRelativeTargetDigest: D('5'),
    namespaceFootprintDigest: hostAddress('KSTACK-NAMESPACE-FOOTPRINT-V1', namespace),
    expectedSourceStateDigest: operationKind === 'RENAME_WITHIN_ROOT' ? D('6') : null,
    expectedTargetStateDigest: D('7'),
    desiredContentArtifactDigest: ['CREATE_FILE', 'REPLACE_FILE'].includes(operationKind) ? D('8') : null,
    desiredMetadataProfileDigest: ['CREATE_FILE', 'REPLACE_FILE', 'CREATE_DIRECTORY'].includes(operationKind) ? D('9') : null,
    backendProfileDigest: D('3'), mutationIsolationEvidenceDigest: D('d'), eligibilityDigest: D('e'),
    eligibilityEpoch: 2, activeSetDigest: D('f'), policyDigest: D('0'), environmentSnapshotDigest: D('1'),
    brokerEvaluationDigest: D('2'), actionFenceProfileDigest: D('3'), deadline: 5000, byteLimit: 1_048_576,
    createdAt: '2026-08-29T05:00:00.000Z', expiresAt: '2026-08-29T05:10:00.000Z'
  };
}

test('relative targets are component-closed, platform-bound, and case-collision safe', () => {
  const platformProfile = { platformId: 'windows', caseMode: 'INSENSITIVE', normalizationMode: 'NFC_CASEFOLD', profileDigest: D('1') };
  const first = validateRelativeTarget({ schemaSetDigest: SCHEMA, targetId: 'one', components: ['Src', 'File.txt'], platformProfile }).target;
  const second = validateRelativeTarget({ schemaSetDigest: SCHEMA, targetId: 'two', components: ['src', 'file.TXT'], platformProfile }).target;
  assert.throws(() => assertDistinctRelativeTargets([first, second]), (error) => error?.code === 'KSTACK_MUTATION_CASE_ALIAS');
  for (const value of ['', '.', '..', 'a/b', 'a\\b', 'CON', 'file.', 'file ', 'name:stream', 'e\u0301']) {
    assert.throws(() => validateRelativeTarget({ schemaSetDigest: SCHEMA, targetId: 'bad', components: [value], platformProfile }), (error) => error?.code === 'KSTACK_MUTATION_PATH_INVALID', value);
  }
  const linux = { ...platformProfile, platformId: 'linux', caseMode: 'SENSITIVE', normalizationMode: 'NFC' };
  assert.doesNotThrow(() => assertDistinctRelativeTargets([
    validateRelativeTarget({ schemaSetDigest: SCHEMA, targetId: 'upper', components: ['A'], platformProfile: linux }).target,
    validateRelativeTarget({ schemaSetDigest: SCHEMA, targetId: 'lower', components: ['a'], platformProfile: linux }).target
  ]));
});

test('only qualified exclusive-mediated handle-relative backends are admissible', () => {
  assert.doesNotThrow(() => validateMutationBackendProfile(backendProfile(), { operationKind: 'REPLACE_FILE' }));
  for (const mutation of [
    { assurance: 'COOPERATIVE_DETECT' }, { exclusiveMediation: false }, { handleRelative: false },
    { noFollow: false }, { beneathRoot: false }, { sameVolume: false }, { aclIsolationProven: false },
    { qualifiedOutcome: 'UNKNOWN' }
  ]) assert.throws(() => validateMutationBackendProfile(backendProfile(mutation)), (error) => error?.code === 'KSTACK_MUTATION_ISOLATION_UNAVAILABLE');
  assert.throws(() => validateMutationBackendProfile(backendProfile({ atomicExchange: false }), { operationKind: 'REPLACE_FILE' }), (error) => error?.code === 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
});

test('all six namespace footprints bind one exact native commit operation', () => {
  for (const kind of MUTATION_KINDS) assert.doesNotThrow(() => validateNamespaceFootprint(footprint(kind)), kind);
  for (const kind of MUTATION_KINDS) {
    const mutated = footprint(kind);
    mutated.entries[0].postState = regular('9');
    assert.throws(() => validateNamespaceFootprint(mutated), (error) => error?.code === 'KSTACK_MUTATION_FOOTPRINT_INVALID', kind);
  }
  const emulatedExchange = footprint('REPLACE_FILE');
  emulatedExchange.entries.forEach((row) => { row.permittedNativeOperation = 'rename-noreplace'; });
  assert.throws(() => validateNamespaceFootprint(emulatedExchange), (error) => error?.code === 'KSTACK_MUTATION_FOOTPRINT_INVALID');
  const extra = footprint('CREATE_FILE'); extra.entries.push(structuredClone(extra.entries[0])); extra.entries[2].entryId = 'entry.extra';
  assert.throws(() => validateNamespaceFootprint(extra), (error) => error?.code === 'KSTACK_MUTATION_FOOTPRINT_INVALID');
});

test('plans bind every governance, footprint, content, and fence input with exact nullability', () => {
  for (const kind of MUTATION_KINDS) assert.doesNotThrow(() => validateLocalMutationPlan(plan(kind)), kind);
  assert.throws(() => validateLocalMutationPlan({ ...plan('CREATE_FILE'), sourceRelativeTargetDigest: D('1') }), (error) => error?.code === 'KSTACK_MUTATION_PLAN_INVALID');
  assert.throws(() => validateLocalMutationPlan({ ...plan('RENAME_WITHIN_ROOT'), desiredContentArtifactDigest: D('1') }), (error) => error?.code === 'KSTACK_MUTATION_PLAN_INVALID');
  assert.throws(() => validateLocalMutationPlan({ ...plan(), eligibilityEpoch: 0 }), (error) => error?.code === 'KSTACK_MUTATION_PLAN_INVALID');
  assert.throws(() => validateLocalMutationPlan({ ...plan(), expiresAt: '2026-08-29T05:00:00.000Z' }), (error) => error?.code === 'KSTACK_MUTATION_PLAN_INVALID');
});

test('transition graph makes intent terminal-or-ambiguous and cleanup terminal-after-abort', () => {
  assert.equal(advanceMutationState('PLANNED', 'LOCKED'), 'LOCKED');
  assert.equal(advanceMutationState('LOCKED', 'PREPARED'), 'PREPARED');
  assert.equal(advanceMutationState('PREPARED', 'COMMIT_INTENT'), 'COMMIT_INTENT');
  for (const state of ['COMMITTED', 'ABORTED', 'OUTCOME_AMBIGUOUS']) assert.equal(advanceMutationState('COMMIT_INTENT', state), state);
  assert.equal(advanceMutationState('ABORTED', 'CLEANUP_INTENT'), 'CLEANUP_INTENT');
  assert.equal(advanceMutationState('CLEANUP_INTENT', 'CLEANED'), 'CLEANED');
  assert.throws(() => advanceMutationState('COMMIT_INTENT', 'PREPARED'), (error) => error?.code === 'KSTACK_MUTATION_STATE_INVALID');
  assert.throws(() => advanceMutationState('CLEANED', 'COMMIT_INTENT'), (error) => error?.code === 'KSTACK_MUTATION_STATE_INVALID');
});

test('post-intent recovery is exhaustive and conservative for every operation kind', () => {
  for (const operationKind of MUTATION_KINDS) {
    const base = { operationKind, durableState: 'COMMIT_INTENT', parentIdentitiesValid: true, observerAgreement: true, ledgerValid: true };
    assert.equal(classifyMutationRecovery({ ...base, namespacePredicate: 'NO_OP' }), 'ABORTED');
    assert.equal(classifyMutationRecovery({ ...base, namespacePredicate: 'COMMITTED' }), 'COMMITTED');
    assert.equal(classifyMutationRecovery({ ...base, namespacePredicate: 'OTHER' }), 'OUTCOME_AMBIGUOUS');
    for (const field of ['parentIdentitiesValid', 'observerAgreement', 'ledgerValid']) assert.equal(classifyMutationRecovery({ ...base, namespacePredicate: 'COMMITTED', [field]: false }), 'OUTCOME_AMBIGUOUS');
  }
});

test('abort cleanup is terminal-first and restart-idempotent only for exact staging predicates', () => {
  for (const operationKind of ['CREATE_FILE', 'REPLACE_FILE', 'CREATE_DIRECTORY']) {
    const base = { operationKind, parentIdentitiesValid: true, observerAgreement: true, ledgerValid: true };
    assert.equal(classifyMutationRecovery({ ...base, durableState: 'ABORTED', namespacePredicate: 'STAGING_PRESENT' }), 'CLEANUP_INTENT');
    assert.equal(classifyMutationRecovery({ ...base, durableState: 'CLEANUP_INTENT', namespacePredicate: 'STAGING_PRESENT' }), 'CLEANUP_INTENT');
    assert.equal(classifyMutationRecovery({ ...base, durableState: 'CLEANUP_INTENT', namespacePredicate: 'STAGING_ABSENT' }), 'CLEANED');
    assert.equal(classifyMutationRecovery({ ...base, durableState: 'CLEANED', namespacePredicate: 'STAGING_ABSENT' }), 'CLEANED');
    assert.equal(classifyMutationRecovery({ ...base, durableState: 'ABORTED', namespacePredicate: 'STAGING_ABSENT' }), 'OUTCOME_AMBIGUOUS');
  }
  for (const operationKind of ['DELETE_FILE', 'DELETE_EMPTY_DIRECTORY', 'RENAME_WITHIN_ROOT']) {
    assert.equal(classifyMutationRecovery({ operationKind, durableState: 'ABORTED', namespacePredicate: 'NO_OP', parentIdentitiesValid: true, observerAgreement: true, ledgerValid: true }), 'ABORTED');
  }
  const cleanup = createCleanupIntent({
    schemaSetDigest: SCHEMA, abortedRecordDigest: D('1'), footprintDigest: D('2'), stagingIdentityDigest: D('3'),
    postAbortStateDigest: D('4'), removalPrimitiveId: 'unlink-handle-relative', durabilityBarrierDigest: D('5'), cleanupSequence: 4
  });
  assert.match(cleanup.intentDigest, /^sha256:[0-9a-f]{64}$/u);
});

test('local evidence is content-free, exact, and does not claim provider receipt authority', () => {
  const evidence = createLocalMutationEvidence({
    schemaSetDigest: SCHEMA, planDigest: D('1'), attemptDigest: D('2'), preStateDigest: D('3'), postStateDigest: D('4'),
    ledgerTransitionDigests: [D('5'), D('6')], backendProfileDigest: D('7'), isolationEvidenceDigest: D('8'),
    eligibilityDigest: D('9'), fenceDigest: D('d'), nativeOperationId: 'rename-noreplace', observerDigest: D('e'),
    cleanupState: 'CLEANED', recoveryState: 'NONE', startedAt: '2026-08-29T05:00:00.000Z',
    completedAt: '2026-08-29T05:01:00.000Z', outcome: 'COMMITTED'
  });
  assert.match(evidence.evidenceDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(Object.hasOwn(evidence.evidence, 'providerReceipt'), false);
  const { schemaId: _schemaId, schemaVersion: _schemaVersion, ...evidenceInput } = evidence.evidence;
  assert.doesNotThrow(() => createLocalMutationEvidence({ ...evidenceInput, ledgerTransitionDigests: [D('6'), D('5')] }));
  assert.throws(() => createLocalMutationEvidence({ ...evidenceInput, ledgerTransitionDigests: [D('5'), D('5')] }), (error) => error?.code === 'KSTACK_MUTATION_EVIDENCE_INVALID');
});

function protectedBackend({ revalidated = true, predicate = 'COMMITTED', commitThrows = false, cleanupThrowsAfterRemoval = false } = {}) {
  const calls = [];
  let currentPredicate = predicate; let cleanupFailed = false;
  return {
    calls,
    backend: {
      descriptor: {
        protectionClass: 'test-only', repositoryWritable: false, agentWritable: false, durable: true,
        appendOnlyAudit: true, exclusiveMediation: true, handleRelative: true, atomicPublication: true
      },
      append: async (record) => { calls.push(`append:${record.event}`); return D(String((calls.length % 9) + 1)); },
      revalidate: async () => { calls.push('revalidate'); return revalidated; },
      atomicCommit: async () => { calls.push('atomicCommit'); if (commitThrows) throw new Error('transport-lost'); },
      inspect: async () => { calls.push('inspect'); return { namespacePredicate: currentPredicate, footprintStateDigest: D('7'), parentIdentitiesValid: true, observerAgreement: true }; },
      cleanup: async () => {
        calls.push('cleanup'); currentPredicate = 'STAGING_ABSENT';
        if (cleanupThrowsAfterRemoval && !cleanupFailed) { cleanupFailed = true; throw new Error('crash-after-removal'); }
      },
      durabilityBarrier: async () => { calls.push('durabilityBarrier'); }
    }
  };
}

test('protected kernel durably records intent before one atomic operation and never retries ambiguity', async () => {
  const adapter = protectedBackend();
  const kernel = new ProtectedMutationKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true });
  const mutationPlan = plan('CREATE_FILE');
  const registered = await kernel.register({ plan: mutationPlan, footprint: footprint('CREATE_FILE'), backendProfile: backendProfile() });
  await kernel.advance(registered.planDigest, 'LOCKED'); await kernel.advance(registered.planDigest, 'PREPARED');
  const result = await kernel.commit({ planDigest: registered.planDigest, fenceDigest: D('1'), currentBindingDigest: D('2') });
  assert.equal(result.state, 'COMMITTED');
  assert.ok(adapter.calls.indexOf('append:COMMIT_INTENT') < adapter.calls.indexOf('atomicCommit'));
  assert.equal(adapter.calls.filter((entry) => entry === 'atomicCommit').length, 1);
  await assert.rejects(kernel.commit({ planDigest: registered.planDigest, fenceDigest: D('1'), currentBindingDigest: D('2') }), (error) => error?.code === 'KSTACK_MUTATION_COMMIT_INVALID');

  const ambiguousAdapter = protectedBackend({ commitThrows: true });
  const ambiguousKernel = new ProtectedMutationKernel({ schemaSetDigest: SCHEMA, backend: ambiguousAdapter.backend, allowTestBackend: true });
  const second = await ambiguousKernel.register({ plan: plan('CREATE_FILE', '8'), footprint: footprint('CREATE_FILE'), backendProfile: backendProfile() });
  await ambiguousKernel.advance(second.planDigest, 'LOCKED'); await ambiguousKernel.advance(second.planDigest, 'PREPARED');
  const ambiguous = await ambiguousKernel.commit({ planDigest: second.planDigest, fenceDigest: D('1'), currentBindingDigest: D('2') });
  assert.equal(ambiguous.state, 'OUTCOME_AMBIGUOUS');
  assert.equal(ambiguousAdapter.calls.filter((entry) => entry === 'atomicCommit').length, 1);
});

test('failed pre-intent revalidation aborts without invoking the native operation', async () => {
  const adapter = protectedBackend({ revalidated: false });
  const kernel = new ProtectedMutationKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true });
  const registered = await kernel.register({ plan: plan(), footprint: footprint('CREATE_FILE'), backendProfile: backendProfile() });
  await kernel.advance(registered.planDigest, 'LOCKED'); await kernel.advance(registered.planDigest, 'PREPARED');
  const result = await kernel.commit({ planDigest: registered.planDigest, fenceDigest: D('1'), currentBindingDigest: D('2') });
  assert.equal(result.state, 'ABORTED');
  assert.equal(adapter.calls.includes('atomicCommit'), false);
});

test('protected cleanup records intent before removal and resumes idempotently after removal crash', async () => {
  const adapter = protectedBackend({ revalidated: false, predicate: 'STAGING_PRESENT', cleanupThrowsAfterRemoval: true });
  const kernel = new ProtectedMutationKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true });
  const mutationFootprint = footprint('CREATE_FILE');
  const registered = await kernel.register({ plan: plan(), footprint: mutationFootprint, backendProfile: backendProfile() });
  await kernel.advance(registered.planDigest, 'LOCKED'); await kernel.advance(registered.planDigest, 'PREPARED');
  assert.equal((await kernel.commit({ planDigest: registered.planDigest, fenceDigest: D('1'), currentBindingDigest: D('2') })).state, 'ABORTED');
  const aborted = kernel.snapshot(registered.planDigest);
  const cleanupIntent = createCleanupIntent({
    schemaSetDigest: SCHEMA, abortedRecordDigest: aborted.lastRecordDigest,
    footprintDigest: hostAddress('KSTACK-NAMESPACE-FOOTPRINT-V1', mutationFootprint), stagingIdentityDigest: D('2'),
    postAbortStateDigest: D('7'), removalPrimitiveId: 'unlink-handle-relative', durabilityBarrierDigest: D('8'),
    cleanupSequence: aborted.sequence + 1
  }).intent;
  await assert.rejects(kernel.cleanup({ planDigest: registered.planDigest, cleanupIntent }), (error) => error?.code === 'KSTACK_MUTATION_CLEANUP_BLOCKED');
  assert.equal(kernel.snapshot(registered.planDigest).state, 'CLEANUP_INTENT');
  const result = await kernel.cleanup({ planDigest: registered.planDigest, cleanupIntent });
  assert.equal(result.state, 'CLEANED');
  assert.ok(adapter.calls.indexOf('append:CLEANUP_INTENT') < adapter.calls.indexOf('cleanup'));
  assert.ok(adapter.calls.indexOf('cleanup') < adapter.calls.indexOf('durabilityBarrier'));
  assert.ok(adapter.calls.indexOf('durabilityBarrier') < adapter.calls.indexOf('append:CLEANED'));
  assert.equal(adapter.calls.filter((entry) => entry === 'cleanup').length, 1);
  assert.equal(adapter.calls.includes('atomicCommit'), false);
});

test('independent Rust oracle agrees for every recovery state, predicate, and integrity fault', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-mutation-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], { encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-mutation-reference${process.platform === 'win32' ? '.exe' : ''}`);
    const states = ['COMMIT_INTENT', 'ABORTED', 'CLEANUP_INTENT', 'CLEANED'];
    const predicates = ['NO_OP', 'COMMITTED', 'STAGING_PRESENT', 'STAGING_ABSENT', 'OTHER'];
    const vectors = [];
    for (const operationKind of MUTATION_KINDS) for (const durableState of states) for (const namespacePredicate of predicates) {
      for (const integrity of [
        { parentIdentitiesValid: true, observerAgreement: true, ledgerValid: true },
        { parentIdentitiesValid: false, observerAgreement: true, ledgerValid: true },
        { parentIdentitiesValid: true, observerAgreement: false, ledgerValid: true },
        { parentIdentitiesValid: true, observerAgreement: true, ledgerValid: false }
      ]) {
        const input = { operationKind, durableState, namespacePredicate, ...integrity };
        vectors.push(input);
      }
    }
    const oracle = spawnSync(binary, [], { input: JSON.stringify(vectors), encoding: 'utf8' });
    assert.equal(oracle.status, 0, oracle.stderr);
    const results = JSON.parse(oracle.stdout);
    assert.equal(results.length, vectors.length);
    vectors.forEach((input, index) => assert.equal(results[index].state, classifyMutationRecovery(input), JSON.stringify(input)));
    const invalid = spawnSync(binary, [], { input: JSON.stringify({ operationKind: 'CREATE_FILE' }), encoding: 'utf8' });
    assert.equal(invalid.status, 2);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
