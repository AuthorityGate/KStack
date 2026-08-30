import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_FRESHNESS_ROWS,
  ProtectedReplayKernel,
  ProtectedTimeService,
  REPLAY_ATTEMPT_STATES,
  REPLAY_IDENTITIES,
  REPLAY_REASON_CODES,
  REPLAY_TRANSITIONS,
  assertTrustedFresh,
  deriveFreshnessWindow,
  deriveReplayRetention,
  evaluateTimeUse,
  replayDuplicateDisposition,
  replayHead,
  validateAttemptTransition,
  validateReplayArtifact,
  validateReplayLedgerSnapshot
} from '../plugins/kstack/scripts/kstack-host-replay.mjs';
import { ProtectedReplayFileStore } from '../plugins/kstack/scripts/kstack-host-replay-store.mjs';
import { createReplayAdmissionBridge } from '../plugins/kstack/scripts/kstack-host-request-replay.mjs';
import { hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';

const digest = (character = 'a') => `sha256:${character.repeat(64)}`;
const schemaSetDigest = digest('f');

function temporaryStoreRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-replay-'));
  fs.chmodSync(root, 0o700);
  return root;
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, expected);
}

function timeFixture(options = {}) {
  const sourceProfile = {
    ...replayHead('TrustedTimeSourceProfileV1', schemaSetDigest),
    profileId: 'protected-clock',
    implementationDigest: digest('1'),
    configurationDigest: digest('2'),
    wallClockSourceDigest: digest('3'),
    monotonicSourceDigest: digest('4'),
    bootIdentitySourceDigest: digest('5'),
    highWaterStoreDigest: digest('6'),
    durabilityPrimitiveId: 'fsync-rename-directory-fsync',
    maximumForwardJumpMs: 3_600_000,
    testVectorSetDigest: digest('7')
  };
  const profileDigest = validateReplayArtifact('TrustedTimeSourceProfileV1', sourceProfile).objectDigest;
  const state = {
    clock: {
      bootIdentityDigest: digest('8'),
      monotonicNanoseconds: '1000000000',
      wallUtc: '2026-08-29T03:00:00.000Z',
      sampledAtMonotonicNanoseconds: '1000000100'
    },
    highWater: {
      ...replayHead('TrustedTimeHighWaterV1', schemaSetDigest),
      sourceProfileDigest: profileDigest,
      sequence: 1,
      acceptedWallUtc: '2026-08-29T02:59:00.000Z',
      bootIdentityDigest: digest('8'),
      monotonicNanoseconds: '900000000',
      previousHighWaterDigest: null,
      durabilityCheckpointDigest: digest('9')
    },
    commitCount: 0,
    failCommit: false
  };
  const dependencies = {
    readHighWater: async () => structuredClone(options.missing ? null : state.highWater),
    readClock: async () => {
      if (options.sourceThrows) throw new Error('host supplied secret text');
      return structuredClone(state.clock);
    },
    commitHighWater: async (proposed) => {
      state.commitCount += 1;
      if (state.failCommit) throw new Error('undurable');
      state.highWater = { ...structuredClone(proposed), durabilityCheckpointDigest: digest('a') };
      return structuredClone(state.highWater);
    }
  };
  return {
    service: new ProtectedTimeService({ schemaSetDigest, sourceProfile, dependencies }),
    state, sourceProfile, profileDigest
  };
}

function trustedSample(wallUtc = '2026-08-29T03:00:00.000Z') {
  return {
    ...replayHead('TrustedTimeSampleV1', schemaSetDigest),
    sourceProfileDigest: digest('1'),
    bootIdentityDigest: digest('2'),
    monotonicNanoseconds: '100',
    wallUtc,
    persistedHighWaterUtc: wallUtc,
    sequence: 2,
    sampledAtMonotonicNanoseconds: '101',
    status: 'TRUSTED',
    reasonCode: null
  };
}

function freshnessPolicy() {
  return {
    ...replayHead('FreshnessPolicyV1', schemaSetDigest),
    policyId: 'default',
    activeSetDigest: digest('3'),
    rows: structuredClone(DEFAULT_FRESHNESS_ROWS)
  };
}

function reconciliationPlan(changes = {}) {
  return {
    ...replayHead('ReconciliationPlanV1', schemaSetDigest),
    planId: 'provider-query', operationId: 'publish', requirementProfileDigest: digest('9'),
    providerQueryProtocolId: 'query-by-key', idempotencyScopeVersion: 1,
    receiptProfileDigest: digest('a'), maximumAttempts: 3, deadlineMs: 60_000,
    sameKeyCallMode: 'QUERY_ONLY',
    terminalMappings: [
      { providerStatusId: 'absent', disposition: 'OUTCOME_AMBIGUOUS' },
      { providerStatusId: 'complete', disposition: 'OUTCOME_KNOWN' }
    ],
    ...changes
  };
}

function attempt(state = 'RESERVED', changes = {}) {
  return {
    ...replayHead('AttemptRecordV1', schemaSetDigest),
    ledgerId: 'protected-ledger', sequence: 1, previousRecordDigest: null, attemptId: 'attempt-1',
    nonceReservationDigest: digest('1'), idempotencyKeyDigest: digest('2'), effectScopeDigest: digest('3'),
    requestDigest: null, approvalSubjectDigest: null, authorityEnvelopeDigest: null, operationId: 'publish',
    operationClassId: 'ASK_SIDE_EFFECT', principalDigest: digest('4'), repositoryContextDigest: digest('5'),
    activeSetDigest: digest('6'), policyDigest: digest('7'), state, stateEvidenceDigest: digest('8'),
    providerAttemptDigest: null, providerReceiptDigest: null, localResultDigest: null, ambiguityDigest: null,
    trustedTimeSampleDigest: digest('9'), recordedAt: '2026-08-29T03:00:00.000Z', ...changes
  };
}

function replayFixture() {
  const state = {
    ledger: {
      ledgerId: 'protected-ledger', generation: 0, checkpointDigest: null,
      effectScopes: [], reservations: [], records: [], ambiguities: [], tombstones: []
    },
    nonceCount: 0,
    attemptCount: 0,
    conflictCount: 0
  };
  const sample = trustedSample();
  const dependencies = {
    readLedger: async () => structuredClone(state.ledger),
    commitLedger: async (transaction) => {
      if (transaction.expectedGeneration !== state.ledger.generation
          || transaction.expectedCheckpointDigest !== state.ledger.checkpointDigest) {
        state.conflictCount += 1;
        return null;
      }
      if (transaction.effectScope !== null && !state.ledger.effectScopes.some((entry) => validateReplayArtifact('EffectScopeV1', entry).objectDigest
          === validateReplayArtifact('EffectScopeV1', transaction.effectScope).objectDigest)) {
        state.ledger.effectScopes.push(structuredClone(transaction.effectScope));
      }
      if (transaction.reservation !== null) state.ledger.reservations.push(structuredClone(transaction.reservation));
      if (transaction.record !== null) state.ledger.records.push(structuredClone(transaction.record));
      if (transaction.ambiguity) state.ledger.ambiguities.push(structuredClone(transaction.ambiguity));
      if (transaction.tombstone) state.ledger.tombstones.push(structuredClone(transaction.tombstone));
      state.ledger.generation += 1;
      state.ledger.checkpointDigest = digest(String(state.ledger.generation));
      return structuredClone(state.ledger);
    },
    sampleTime: async () => structuredClone(sample),
    mintNonceDigest: async () => {
      state.nonceCount += 1;
      return digest(String(state.nonceCount % 10 || 1));
    },
    mintAttemptId: async () => {
      state.attemptCount += 1;
      return `attempt-${state.attemptCount}`;
    }
  };
  return {
    kernel: new ProtectedReplayKernel({ schemaSetDigest, ledgerId: 'protected-ledger', dependencies }),
    state, sample, dependencies,
    input: {
      contextDraftDigest: digest('4'), protectedSessionContextDigest: digest('5'), principalDigest: digest('6'),
      repositoryContextDigest: digest('7'), operationId: 'publish', operationSchemaDigest: digest('8'),
      requirementProfileDigest: digest('9'), operationClassId: 'ASK_SIDE_EFFECT',
      effectScope: {
        ...replayHead('EffectScopeV1', schemaSetDigest), principalDigest: digest('6'), repositoryContextDigest: digest('7'),
        worktreeIdentityDigest: digest('a'), operationId: 'publish', operationSchemaDigest: digest('8'),
        requirementProfileDigest: digest('9'), operationClassId: 'ASK_SIDE_EFFECT', externalAudienceDigest: digest('b'),
        externalTargetDigest: digest('c'), semanticEffectDigest: digest('d'), idempotencyScopeVersion: 1
      },
      expiresAt: '2026-08-29T03:01:00.000Z', activeSetDigest: digest('e'), policyDigest: digest('1'),
      stateEvidenceDigest: digest('2')
    }
  };
}

async function reserveAndBind(current) {
  const reserved = await current.kernel.reserve(current.input);
  const binding = {
    nonceDigest: reserved.nonceDigest,
    contextDraftDigest: current.input.contextDraftDigest,
    protectedSessionContextDigest: current.input.protectedSessionContextDigest,
    principalDigest: current.input.principalDigest,
    repositoryContextDigest: current.input.repositoryContextDigest,
    requestDigest: digest('3'), approvalSubjectDigest: digest('4'), authorityEnvelopeDigest: digest('5'),
    activeSetDigest: current.input.activeSetDigest, policyDigest: current.input.policyDigest,
    stateEvidenceDigest: digest('6')
  };
  return { reserved, binding, bound: await current.kernel.bindRequest(binding) };
}

function bridgeReserveInput(current) {
  return {
    proposalDigest: current.input.contextDraftDigest,
    contextDraftDigest: current.input.contextDraftDigest,
    protectedSessionContextDigest: current.input.protectedSessionContextDigest,
    principalDigest: current.input.principalDigest,
    repositoryContextDigest: current.input.repositoryContextDigest,
    worktreeIdentityDigest: current.input.effectScope.worktreeIdentityDigest,
    operationId: current.input.operationId,
    operationSchemaDigest: current.input.operationSchemaDigest,
    requirementProfileDigest: current.input.requirementProfileDigest,
    operationClassId: current.input.operationClassId,
    inputs: [], limits: { deadlineMs: 1, maxInputBytes: 1, maxOutputBytes: 1 },
    expiresAt: current.input.expiresAt,
    activeSetDigest: current.input.activeSetDigest,
    policyDigest: current.input.policyDigest,
    stateEvidenceDigest: current.input.stateEvidenceDigest
  };
}

test('HP-TC03 publishes the closed replay/time artifact inventory and stable code sets', () => {
  assert.deepEqual(Object.keys(REPLAY_IDENTITIES).sort(), [
    'AmbiguityRecordV1', 'AttemptRecordV1', 'EffectScopeV1', 'FreshnessPolicyV1', 'NonceReservationV1',
    'ReconciliationPlanV1', 'ReplayLedgerCheckpointV1', 'ReplayTombstoneV1', 'TrustedTimeHighWaterV1',
    'TrustedTimeSampleV1', 'TrustedTimeSourceProfileV1'
  ]);
  assert.equal(REPLAY_REASON_CODES.length, 15);
  assert.equal(REPLAY_ATTEMPT_STATES.length, 11);
  assert.equal(new Set(REPLAY_REASON_CODES).size, REPLAY_REASON_CODES.length);
});

test('protected time advances a durable high-water record before returning TRUSTED', async () => {
  const current = timeFixture();
  const prior = structuredClone(current.state.highWater);
  const sample = await current.service.sample();
  assert.equal(sample.value.status, 'TRUSTED');
  assert.equal(sample.value.reasonCode, null);
  assert.equal(sample.value.sequence, 2);
  assert.equal(sample.value.persistedHighWaterUtc, current.state.clock.wallUtc);
  assert.equal(current.state.commitCount, 1);
  assert.equal(current.state.highWater.sequence, 2);
  assert.equal(current.state.highWater.previousHighWaterDigest,
    validateReplayArtifact('TrustedTimeHighWaterV1', prior).objectDigest);
});

test('wall rollback and excessive forward jumps never advance protected time', async () => {
  const rollback = timeFixture();
  rollback.state.clock.wallUtc = '2026-08-29T02:58:59.999Z';
  const rolled = await rollback.service.sample();
  assert.equal(rolled.value.status, 'ROLLBACK_DETECTED');
  assert.equal(rolled.value.reasonCode, 'KSTACK_TIME_ROLLBACK_DETECTED');
  assert.equal(rollback.state.commitCount, 0);

  const forward = timeFixture();
  forward.state.clock.wallUtc = '2026-08-29T04:59:00.001Z';
  const jumped = await forward.service.sample();
  assert.equal(jumped.value.status, 'FORWARD_JUMP');
  assert.equal(jumped.value.reasonCode, 'KSTACK_TIME_FORWARD_JUMP');
  assert.equal(forward.state.commitCount, 0);
});

test('missing, corrupt, unavailable, and undurable time state fail closed without host text', async () => {
  const missing = timeFixture({ missing: true });
  assert.equal((await missing.service.sample()).value.status, 'SOURCE_UNAVAILABLE');

  const source = timeFixture({ sourceThrows: true });
  const unavailable = await source.service.sample();
  assert.equal(unavailable.value.status, 'SOURCE_UNAVAILABLE');
  assert.equal(JSON.stringify(unavailable).includes('host supplied secret text'), false);

  const undurable = timeFixture();
  undurable.state.failCommit = true;
  assert.equal((await undurable.service.sample()).value.status, 'SOURCE_UNAVAILABLE');

  const corrupt = timeFixture();
  corrupt.state.highWater.previousHighWaterDigest = digest('0');
  assert.equal((await corrupt.service.sample()).value.status, 'CORRUPT');
});

test('same-boot monotonic rollback is unavailable and never advances high water', async () => {
  const current = timeFixture();
  assert.equal((await current.service.sample()).value.status, 'TRUSTED');
  current.state.clock.wallUtc = '2026-08-29T03:00:01.000Z';
  current.state.clock.monotonicNanoseconds = '999999999';
  current.state.clock.sampledAtMonotonicNanoseconds = '1000000000';
  assert.equal((await current.service.sample()).value.status, 'SOURCE_UNAVAILABLE');
  assert.equal(current.state.commitCount, 1);
});

test('restart checks monotonic time against persisted same-boot state and detects high-water rollback', async () => {
  const sameBoot = timeFixture();
  sameBoot.state.clock.monotonicNanoseconds = '899999999';
  sameBoot.state.clock.sampledAtMonotonicNanoseconds = '900000000';
  assert.equal((await sameBoot.service.sample()).value.status, 'SOURCE_UNAVAILABLE');
  assert.equal(sameBoot.state.commitCount, 0);

  const newBoot = timeFixture();
  newBoot.state.clock.bootIdentityDigest = digest('0');
  newBoot.state.clock.monotonicNanoseconds = '1';
  newBoot.state.clock.sampledAtMonotonicNanoseconds = '2';
  assert.equal((await newBoot.service.sample()).value.status, 'TRUSTED');

  const rolled = timeFixture();
  const older = structuredClone(rolled.state.highWater);
  assert.equal((await rolled.service.sample()).value.status, 'TRUSTED');
  rolled.state.highWater = older;
  rolled.state.clock.wallUtc = '2026-08-29T03:00:01.000Z';
  rolled.state.clock.monotonicNanoseconds = '1100000000';
  rolled.state.clock.sampledAtMonotonicNanoseconds = '1100000001';
  assert.equal((await rolled.service.sample()).value.status, 'CORRUPT');
  assert.equal(rolled.state.commitCount, 1);
});

test('freshness is the tightest protected/request/input cap and expiry is inclusive', () => {
  const sample = trustedSample();
  const window = deriveFreshnessWindow({
    sample,
    policy: freshnessPolicy(),
    operationClassId: 'ASK_SIDE_EFFECT',
    requestedTtls: { requestTtlMs: 60_000, approvalTtlMs: 90_000, reservationTtlMs: 100_000 },
    inputExpiries: ['2026-08-29T03:00:45.000Z'],
    approvalRequired: true
  });
  assert.deepEqual(window, {
    issuedAt: '2026-08-29T03:00:00.000Z',
    requestExpiresAt: '2026-08-29T03:00:45.000Z',
    approvalExpiresAt: '2026-08-29T03:00:45.000Z',
    reservationExpiresAt: '2026-08-29T03:00:45.000Z'
  });
  assert.equal(assertTrustedFresh(sample, '2026-08-29T03:00:00.001Z'), true);
  code('KSTACK_TIME_OBJECT_EXPIRED', () => assertTrustedFresh(sample, sample.wallUtc));
});

test('freshness rejects an approval-bearing class whose policy or request omits approval TTL', () => {
  const base = {
    sample: trustedSample(), policy: freshnessPolicy(), operationClassId: 'ASK_SIDE_EFFECT',
    requestedTtls: { requestTtlMs: 60_000, approvalTtlMs: null, reservationTtlMs: 60_000 },
    inputExpiries: [], approvalRequired: true
  };
  code('KSTACK_TIME_PROFILE_MISMATCH', () => deriveFreshnessWindow(base));
  const policy = freshnessPolicy();
  policy.rows.find((row) => row.operationClassId === 'ASK_SIDE_EFFECT').approvalTtlMs = null;
  code('KSTACK_TIME_PROFILE_MISMATCH', () => deriveFreshnessWindow({
    ...base, policy, requestedTtls: { ...base.requestedTtls, approvalTtlMs: 60_000 }
  }));
});

test('untrusted time permits only an explicitly public non-expiring read or advisory operation', async () => {
  const unavailable = (await timeFixture({ missing: true }).service.sample()).value;
  const publicRead = {
    sample: unavailable, operationClassId: 'LOCAL_READ', assuranceLevel: 'PUBLIC_UNAUTHENTICATED',
    approvalRequired: false, authorityExpiresAt: null, evidenceExpiries: []
  };
  assert.deepEqual(evaluateTimeUse(publicRead), {
    admitted: true, mode: 'PUBLIC_NONEXPIRING', diagnosticReasonCode: 'KSTACK_TIME_SOURCE_UNAVAILABLE'
  });
  for (const mutation of [
    { operationClassId: 'LOCAL_WRITE' }, { assuranceLevel: 'AUTHENTICATED_LOCAL' }, { approvalRequired: true },
    { authorityExpiresAt: '2026-08-29T03:01:00.000Z' }, { evidenceExpiries: ['2026-08-29T03:01:00.000Z'] }
  ]) {
    code('KSTACK_TIME_SOURCE_UNAVAILABLE', () => evaluateTimeUse({ ...publicRead, ...mutation }));
  }
  assert.equal(evaluateTimeUse({ ...publicRead, sample: trustedSample() }).mode, 'TRUSTED_TIME');
});

test('replay retention applies class floors and every provider, receipt, and ambiguity safety window', () => {
  const base = {
    policy: freshnessPolicy(), operationClassId: 'ASK_SIDE_EFFECT', recordedAt: '2026-08-29T03:00:00.000Z',
    providerReconciliationWindowMs: 1_000, providerIdempotencyWindowMs: 2_000,
    receiptRetentionMs: 3_000, ambiguityRetentionMs: 4_000, requestedRetentionMs: 31_536_000_000
  };
  assert.deepEqual(deriveReplayRetention(base), {
    minimumRetentionMs: 31_536_000_000,
    retentionUntil: '2027-08-29T03:00:00.000Z'
  });
  code('KSTACK_REPLAY_RETENTION_UNSAFE', () => deriveReplayRetention({
    ...base, requestedRetentionMs: 31_535_999_999
  }));

  const providerBound = {
    ...base, operationClassId: 'LOCAL_READ', providerReconciliationWindowMs: 172_800_000,
    requestedRetentionMs: 172_800_000
  };
  assert.equal(deriveReplayRetention(providerBound).minimumRetentionMs, 172_800_000);
  code('KSTACK_REPLAY_RETENTION_UNSAFE', () => deriveReplayRetention({
    ...providerBound, requestedRetentionMs: 172_799_999
  }));
  code('KSTACK_REPLAY_RETENTION_UNSAFE', () => deriveReplayRetention({
    ...base, recordedAt: '275760-09-13T00:00:00.000Z', requestedRetentionMs: 31_536_000_000
  }));
});

test('closed artifacts reject unknown fields and state-dependent nullability faults', () => {
  const sample = trustedSample();
  code('KSTACK_REPLAY_OBJECT_INVALID', () => validateReplayArtifact('TrustedTimeSampleV1', {
    ...sample, hostTime: 'trusted'
  }));
  code('KSTACK_TIME_SOURCE_UNAVAILABLE', () => validateReplayArtifact('TrustedTimeSampleV1', {
    ...sample, reasonCode: 'KSTACK_TIME_ROLLBACK_DETECTED'
  }));
});

test('attempt transitions are hash-linked, monotonic, closed, and ambiguity safe', () => {
  const reserved = attempt();
  const reservedDigest = validateReplayArtifact('AttemptRecordV1', reserved).objectDigest;
  const bound = attempt('REQUEST_BOUND', {
    sequence: 2,
    previousRecordDigest: reservedDigest,
    requestDigest: digest('a'),
    recordedAt: '2026-08-29T03:00:01.000Z'
  });
  const secondPosition = { headRecordDigest: reservedDigest, nextSequence: 2 };
  assert.equal(validateAttemptTransition(reserved, bound, secondPosition).previousDigest, reservedDigest);

  const boundDigest = validateReplayArtifact('AttemptRecordV1', bound).objectDigest;
  code('KSTACK_REPLAY_LEDGER_CORRUPT', () => validateAttemptTransition(bound, {
    ...bound,
    sequence: 3,
    previousRecordDigest: boundDigest,
    state: 'DISPATCH_STARTED',
    recordedAt: '2026-08-29T03:00:02.000Z'
  }, { headRecordDigest: boundDigest, nextSequence: 3 }));
  code('KSTACK_REPLAY_LEDGER_CORRUPT', () => validateAttemptTransition(reserved, {
    ...bound,
    previousRecordDigest: digest('0')
  }, secondPosition));
});

test('the closed transition graph has no path from possibly-acted ambiguity back to dispatch', () => {
  const paths = [];
  const visit = (state, path, depth) => {
    const next = REPLAY_TRANSITIONS[state];
    assert.ok(Array.isArray(next), state);
    if (depth === 0 || next.length === 0) {
      paths.push(path);
      return;
    }
    for (const target of next) visit(target, [...path, target], depth - 1);
  };
  visit('RESERVED', ['RESERVED'], 16);
  assert.ok(paths.length > 0);
  for (const path of paths) {
    const ambiguity = path.indexOf('OUTCOME_AMBIGUOUS');
    if (ambiguity !== -1) assert.equal(path.slice(ambiguity + 1).includes('DISPATCH_STARTED'), false, path.join(' -> '));
    const dispatch = path.indexOf('DISPATCH_STARTED');
    if (dispatch !== -1) {
      assert.equal(path.slice(dispatch + 1).includes('PREPARED'), false, path.join(' -> '));
      assert.equal(path.slice(dispatch + 1).includes('CANCELLED_PRE_ACTION'), false, path.join(' -> '));
    }
  }
});

test('duplicate dispositions never map an in-flight or ambiguous effect back to execution', () => {
  assert.equal(replayDuplicateDisposition('RESERVED'), 'KSTACK_REPLAY_NONCE_DUPLICATE');
  for (const state of ['REQUEST_BOUND', 'ADMITTED', 'PREPARED']) {
    assert.equal(replayDuplicateDisposition(state), 'KSTACK_REPLAY_SCOPE_IN_FLIGHT');
  }
  assert.equal(replayDuplicateDisposition('DISPATCH_STARTED'), 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
  for (const state of ['OUTCOME_AMBIGUOUS', 'RECONCILING']) {
    assert.equal(replayDuplicateDisposition(state), 'KSTACK_REPLAY_RECONCILIATION_REQUIRED');
  }
  for (const state of ['DENIED', 'CANCELLED_PRE_ACTION', 'OUTCOME_KNOWN', 'CLOSED']) {
    assert.equal(replayDuplicateDisposition(state), 'KSTACK_REPLAY_RESULT_RECORDED');
  }
});

test('protected file store survives reopen and rejects permission or root substitution', async () => {
  const root = temporaryStoreRoot();
  const link = `${root}-link`;
  try {
    const base = timeFixture();
    const store = new ProtectedReplayFileStore({
      root,
      schemaSetDigest,
      durabilityPrimitiveId: base.sourceProfile.durabilityPrimitiveId
    });
    store.provisionHighWater({
      sourceProfileDigest: base.profileDigest,
      acceptedWallUtc: '2026-08-29T02:59:00.000Z',
      bootIdentityDigest: digest('8'),
      monotonicNanoseconds: '900000000'
    });
    const service = new ProtectedTimeService({
      schemaSetDigest,
      sourceProfile: base.sourceProfile,
      dependencies: {
        readHighWater: (profileDigest) => store.readHighWater(profileDigest),
        commitHighWater: (proposed) => store.commitHighWater(proposed),
        readClock: async () => structuredClone(base.state.clock)
      }
    });
    assert.equal((await service.sample()).value.status, 'TRUSTED');
    const reopened = new ProtectedReplayFileStore({
      root,
      schemaSetDigest,
      durabilityPrimitiveId: base.sourceProfile.durabilityPrimitiveId
    });
    assert.equal(reopened.readHighWater(base.profileDigest).sequence, 2);

    fs.symlinkSync(root, link, 'dir');
    code('KSTACK_REPLAY_LEDGER_UNAVAILABLE', () => new ProtectedReplayFileStore({
      root: link,
      schemaSetDigest,
      durabilityPrimitiveId: base.sourceProfile.durabilityPrimitiveId
    }));

    fs.chmodSync(path.join(root, 'trusted-time-high-water.json'), 0o644);
    code('KSTACK_REPLAY_LEDGER_CORRUPT', () => reopened.readHighWater(base.profileDigest));
  } finally {
    try { fs.unlinkSync(link); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('protected reservation binds one nonce, scope, attempt, and durable ledger head', async () => {
  const current = replayFixture();
  const reserved = await current.kernel.reserve(current.input);
  assert.equal(reserved.reserved, true);
  assert.equal(reserved.disposition, null);
  assert.equal(current.state.ledger.generation, 1);
  assert.equal(current.state.ledger.effectScopes.length, 1);
  assert.equal(current.state.ledger.reservations.length, 1);
  assert.equal(current.state.ledger.records.length, 1);
  assert.equal(current.state.ledger.records[0].state, 'RESERVED');
  assert.equal(current.state.ledger.records[0].idempotencyKeyDigest, reserved.idempotencyKeyDigest);

  const duplicate = await current.kernel.reserve(structuredClone(current.input));
  assert.equal(duplicate.reserved, false);
  assert.equal(duplicate.disposition, 'KSTACK_REPLAY_NONCE_DUPLICATE');
  assert.equal(duplicate.nonceDigest, null);
  assert.equal(current.state.ledger.records.length, 1);
});

test('production admission bridge composes request admission with the actual replay kernel', async () => {
  const admitted = replayFixture();
  let projectionInput;
  const admittedBridge = createReplayAdmissionBridge({
    kernel: admitted.kernel,
    deriveEffectScope: async (value) => {
      projectionInput = structuredClone(value);
      return structuredClone(admitted.input.effectScope);
    }
  });
  const reservation = await admittedBridge.reserveReplayBindings(bridgeReserveInput(admitted));
  assert.equal(projectionInput.worktreeIdentityDigest, admitted.input.effectScope.worktreeIdentityDigest);
  const requestDigest = digest('3');
  const binding = await admittedBridge.bindReplayRequest({
    nonceDigest: reservation.nonceDigest,
    contextDraftDigest: admitted.input.contextDraftDigest,
    protectedSessionContextDigest: admitted.input.protectedSessionContextDigest,
    principalDigest: admitted.input.principalDigest,
    repositoryContextDigest: admitted.input.repositoryContextDigest,
    requestDigest, approvalSubjectDigest: digest('4'), authorityEnvelopeDigest: digest('5'),
    activeSetDigest: admitted.input.activeSetDigest, policyDigest: admitted.input.policyDigest,
    stateEvidenceDigest: digest('6')
  });
  assert.deepEqual(binding, { attemptId: reservation.attemptId, requestDigest });
  assert.deepEqual(await admittedBridge.recordReplayAdmission({
    attemptId: reservation.attemptId, admitted: true, stateEvidenceDigest: digest('7')
  }), { attemptId: reservation.attemptId, state: 'ADMITTED' });
  assert.equal(admitted.state.ledger.records.at(-1).state, 'ADMITTED');

  const denied = replayFixture();
  const deniedBridge = createReplayAdmissionBridge({
    kernel: denied.kernel, deriveEffectScope: async () => structuredClone(denied.input.effectScope)
  });
  const deniedReservation = await deniedBridge.reserveReplayBindings(bridgeReserveInput(denied));
  await deniedBridge.bindReplayRequest({
    nonceDigest: deniedReservation.nonceDigest,
    contextDraftDigest: denied.input.contextDraftDigest,
    protectedSessionContextDigest: denied.input.protectedSessionContextDigest,
    principalDigest: denied.input.principalDigest,
    repositoryContextDigest: denied.input.repositoryContextDigest,
    requestDigest, approvalSubjectDigest: digest('4'), authorityEnvelopeDigest: digest('5'),
    activeSetDigest: denied.input.activeSetDigest, policyDigest: denied.input.policyDigest,
    stateEvidenceDigest: digest('6')
  });
  assert.deepEqual(await deniedBridge.recordReplayAdmission({
    attemptId: deniedReservation.attemptId, admitted: false, stateEvidenceDigest: digest('7')
  }), { attemptId: deniedReservation.attemptId, state: 'DENIED' });
  assert.deepEqual(denied.state.ledger.records.slice(-2).map((entry) => entry.state), ['ADMITTED', 'DENIED']);
});

test('simultaneous same-scope reservations serialize to one authoritative attempt', async () => {
  const current = replayFixture();
  const [left, right] = await Promise.all([
    current.kernel.reserve(structuredClone(current.input)),
    current.kernel.reserve(structuredClone(current.input))
  ]);
  assert.equal([left, right].filter((entry) => entry.reserved).length, 1);
  assert.equal([left, right].filter((entry) => !entry.reserved)[0].disposition, 'KSTACK_REPLAY_NONCE_DUPLICATE');
  assert.equal(current.state.ledger.records.length, 1);
  assert.equal(current.state.conflictCount, 1);
});

test('different scopes may interleave while preserving one global sequence and hash chain', async () => {
  const current = replayFixture();
  const firstInput = structuredClone(current.input);
  const secondInput = structuredClone(current.input);
  secondInput.effectScope.semanticEffectDigest = digest('0');
  const first = await current.kernel.reserve(firstInput);
  const second = await current.kernel.reserve(secondInput);
  const bind = (reserved, input, requestDigest) => current.kernel.bindRequest({
    nonceDigest: reserved.nonceDigest,
    contextDraftDigest: input.contextDraftDigest,
    protectedSessionContextDigest: input.protectedSessionContextDigest,
    principalDigest: input.principalDigest,
    repositoryContextDigest: input.repositoryContextDigest,
    requestDigest, approvalSubjectDigest: null, authorityEnvelopeDigest: null,
    activeSetDigest: input.activeSetDigest, policyDigest: input.policyDigest,
    stateEvidenceDigest: digest('6')
  });
  await bind(second, secondInput, digest('4'));
  await bind(first, firstInput, digest('3'));
  assert.deepEqual(current.state.ledger.records.map((record) => record.sequence), [1, 2, 3, 4]);
  let previous = null;
  for (const record of current.state.ledger.records) {
    assert.equal(record.previousRecordDigest, previous);
    previous = validateReplayArtifact('AttemptRecordV1', record).objectDigest;
  }
  assert.equal(new Set(current.state.ledger.records.map((record) => record.attemptId)).size, 2);
  assert.equal(new Set(current.state.ledger.records.map((record) => record.idempotencyKeyDigest)).size, 2);
});

test('request index uniqueness burns a second nonce instead of creating another request authority', async () => {
  const current = replayFixture();
  const firstInput = structuredClone(current.input);
  const secondInput = structuredClone(current.input);
  secondInput.effectScope.semanticEffectDigest = digest('0');
  const first = await current.kernel.reserve(firstInput);
  const second = await current.kernel.reserve(secondInput);
  const binding = (reserved, input) => ({
    nonceDigest: reserved.nonceDigest,
    contextDraftDigest: input.contextDraftDigest,
    protectedSessionContextDigest: input.protectedSessionContextDigest,
    principalDigest: input.principalDigest,
    repositoryContextDigest: input.repositoryContextDigest,
    requestDigest: digest('3'), approvalSubjectDigest: null, authorityEnvelopeDigest: null,
    activeSetDigest: input.activeSetDigest, policyDigest: input.policyDigest,
    stateEvidenceDigest: digest('6')
  });
  await current.kernel.bindRequest(binding(first, firstInput));
  await assert.rejects(() => current.kernel.bindRequest(binding(second, secondInput)),
    (error) => error?.code === 'KSTACK_REPLAY_NONCE_DUPLICATE');
  assert.equal(current.state.ledger.reservations.at(-1).state, 'BURNED');
  assert.equal(current.state.ledger.records.filter((record) => record.requestDigest === digest('3')).length, 1);
});

test('snapshot reconstruction rejects orphan scope, reservation, ambiguity, and duplicate request indexes', async () => {
  const current = replayFixture();
  const { reserved } = await reserveAndBind(current);
  const orphanScope = structuredClone(current.state.ledger);
  orphanScope.effectScopes.push({ ...structuredClone(orphanScope.effectScopes[0]), semanticEffectDigest: digest('0') });
  code('KSTACK_REPLAY_LEDGER_CORRUPT', () => validateReplayLedgerSnapshot(orphanScope, schemaSetDigest));

  const orphanReservation = structuredClone(current.state.ledger);
  orphanReservation.reservations.push({
    ...structuredClone(orphanReservation.reservations[0]), nonceDigest: digest('0'), reservationSequence: 3
  });
  code('KSTACK_REPLAY_LEDGER_CORRUPT', () => validateReplayLedgerSnapshot(orphanReservation, schemaSetDigest));

  const orphanAmbiguity = structuredClone(current.state.ledger);
  orphanAmbiguity.ambiguities.push({
    ...replayHead('AmbiguityRecordV1', schemaSetDigest), attemptId: reserved.attemptId,
    effectScopeDigest: reserved.effectScopeDigest, idempotencyKeyDigest: reserved.idempotencyKeyDigest,
    dispatchRecordDigest: digest('0'), observedEvidenceDigest: digest('1'), reconciliationPlanDigest: null,
    firstObservedAt: '2026-08-29T03:00:00.000Z', lastObservedAt: '2026-08-29T03:00:00.000Z',
    retentionUntil: '2027-08-29T03:00:00.000Z'
  });
  code('KSTACK_REPLAY_LEDGER_CORRUPT', () => validateReplayLedgerSnapshot(orphanAmbiguity, schemaSetDigest));
});

test('effect scope cannot be widened by a mismatched caller context', async () => {
  const current = replayFixture();
  current.input.effectScope.principalDigest = digest('0');
  await assert.rejects(() => current.kernel.reserve(current.input),
    (error) => error?.code === 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
  assert.equal(current.state.ledger.records.length, 0);
});

test('final request binding advances the same reservation and attempt exactly once', async () => {
  const current = replayFixture();
  const reserved = await current.kernel.reserve(current.input);
  const binding = {
    nonceDigest: reserved.nonceDigest,
    contextDraftDigest: current.input.contextDraftDigest,
    protectedSessionContextDigest: current.input.protectedSessionContextDigest,
    principalDigest: current.input.principalDigest,
    repositoryContextDigest: current.input.repositoryContextDigest,
    requestDigest: digest('3'),
    approvalSubjectDigest: digest('4'),
    authorityEnvelopeDigest: digest('5'),
    activeSetDigest: current.input.activeSetDigest,
    policyDigest: current.input.policyDigest,
    stateEvidenceDigest: digest('6')
  };
  const bound = await current.kernel.bindRequest(binding);
  assert.equal(bound.bound, true);
  assert.equal(current.state.ledger.records.length, 2);
  assert.equal(current.state.ledger.records[1].state, 'REQUEST_BOUND');
  assert.equal(current.state.ledger.records[1].requestDigest, binding.requestDigest);
  assert.equal(current.state.ledger.reservations.length, 2);
  assert.equal(current.state.ledger.reservations[1].state, 'BOUND');

  const duplicate = await current.kernel.bindRequest(structuredClone(binding));
  assert.equal(duplicate.bound, false);
  assert.equal(duplicate.disposition, 'KSTACK_REPLAY_RESULT_RECORDED');
  await assert.rejects(() => current.kernel.bindRequest({ ...binding, requestDigest: digest('0') }),
    (error) => error?.code === 'KSTACK_REPLAY_NONCE_DUPLICATE');
  assert.equal(current.state.ledger.records.length, 2);
});

test('reservation expiry and context substitution burn request binding closed', async () => {
  const expired = replayFixture();
  const expiredReservation = await expired.kernel.reserve(expired.input);
  expired.sample.wallUtc = expired.input.expiresAt;
  expired.sample.persistedHighWaterUtc = expired.input.expiresAt;
  await assert.rejects(() => expired.kernel.bindRequest({
    nonceDigest: expiredReservation.nonceDigest,
    contextDraftDigest: expired.input.contextDraftDigest,
    protectedSessionContextDigest: expired.input.protectedSessionContextDigest,
    principalDigest: expired.input.principalDigest,
    repositoryContextDigest: expired.input.repositoryContextDigest,
    requestDigest: digest('3'), approvalSubjectDigest: null, authorityEnvelopeDigest: null,
    activeSetDigest: expired.input.activeSetDigest, policyDigest: expired.input.policyDigest,
    stateEvidenceDigest: digest('4')
  }), (error) => error?.code === 'KSTACK_TIME_OBJECT_EXPIRED');
  assert.equal(expired.state.ledger.reservations.at(-1).state, 'EXPIRED');

  const substituted = replayFixture();
  const reservation = await substituted.kernel.reserve(substituted.input);
  await assert.rejects(() => substituted.kernel.bindRequest({
    nonceDigest: reservation.nonceDigest,
    contextDraftDigest: digest('0'),
    protectedSessionContextDigest: substituted.input.protectedSessionContextDigest,
    principalDigest: substituted.input.principalDigest,
    repositoryContextDigest: substituted.input.repositoryContextDigest,
    requestDigest: digest('3'), approvalSubjectDigest: null, authorityEnvelopeDigest: null,
    activeSetDigest: substituted.input.activeSetDigest, policyDigest: substituted.input.policyDigest,
    stateEvidenceDigest: digest('4')
  }), (error) => error?.code === 'KSTACK_REPLAY_NONCE_DUPLICATE');
  assert.equal(substituted.state.ledger.reservations.at(-1).state, 'BURNED');
});

test('an explicitly aborted pre-approval reservation is durably burned and cannot bind later', async () => {
  const current = replayFixture();
  const reserved = await current.kernel.reserve(current.input);
  assert.deepEqual(await current.kernel.burnReservation({ nonceDigest: reserved.nonceDigest }), {
    burned: true, disposition: null, nonceDigest: reserved.nonceDigest
  });
  assert.equal(current.state.ledger.reservations.at(-1).state, 'BURNED');
  assert.deepEqual(await current.kernel.burnReservation({ nonceDigest: reserved.nonceDigest }), {
    burned: false, disposition: 'KSTACK_REPLAY_NONCE_BURNED', nonceDigest: reserved.nonceDigest
  });
  await assert.rejects(() => current.kernel.bindRequest({
    nonceDigest: reserved.nonceDigest,
    contextDraftDigest: current.input.contextDraftDigest,
    protectedSessionContextDigest: current.input.protectedSessionContextDigest,
    principalDigest: current.input.principalDigest,
    repositoryContextDigest: current.input.repositoryContextDigest,
    requestDigest: digest('3'), approvalSubjectDigest: null, authorityEnvelopeDigest: null,
    activeSetDigest: current.input.activeSetDigest, policyDigest: current.input.policyDigest,
    stateEvidenceDigest: digest('4')
  }), (error) => error?.code === 'KSTACK_REPLAY_NONCE_BURNED');
});

test('protected randomness failures expose only the stable unavailable code and commit nothing', async () => {
  const current = replayFixture();
  const kernel = new ProtectedReplayKernel({
    schemaSetDigest, ledgerId: 'protected-ledger',
    dependencies: {
      ...current.dependencies,
      mintNonceDigest: async () => { throw new Error('host random source secret text'); }
    }
  });
  await assert.rejects(() => kernel.reserve(current.input), (error) => {
    assert.equal(error?.code, 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    assert.equal(error?.message, 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    return true;
  });
  assert.equal(current.state.ledger.generation, 0);
});

test('attempt lifecycle records prepare and dispatch before ambiguity and never blind retries', async () => {
  const current = replayFixture();
  const { reserved } = await reserveAndBind(current);
  const plan = reconciliationPlan();
  const planDigest = validateReplayArtifact('ReconciliationPlanV1', plan).objectDigest;
  const advance = (toState, changes = {}) => current.kernel.advance({
    attemptId: reserved.attemptId,
    toState,
    stateEvidenceDigest: digest('7'),
    providerAttemptDigest: null,
    providerReceiptDigest: null,
    localResultDigest: null,
    ambiguity: null,
    ...changes
  });
  await advance('ADMITTED');
  await advance('PREPARED');
  await advance('DISPATCH_STARTED', { providerAttemptDigest: digest('8') });
  await assert.rejects(() => advance('CANCELLED_PRE_ACTION'),
    (error) => error?.code === 'KSTACK_REPLAY_LEDGER_CORRUPT');
  const ambiguous = await advance('OUTCOME_AMBIGUOUS', {
    providerAttemptDigest: digest('8'),
    ambiguity: {
      observedEvidenceDigest: digest('9'),
      reconciliationPlanDigest: planDigest,
      retentionUntil: '2027-08-29T03:00:00.000Z'
    }
  });
  assert.match(ambiguous.ambiguityDigest, /^sha256:/u);
  await assert.rejects(() => advance('RECONCILING', { providerAttemptDigest: digest('8') }),
    (error) => error?.code === 'KSTACK_REPLAY_RECONCILIATION_REQUIRED');
  const reconciling = await current.kernel.beginReconciliation({
    attemptId: reserved.attemptId, plan, stateEvidenceDigest: digest('7')
  });
  assert.equal(reconciling.reconciliationPlanDigest, planDigest);
  await advance('OUTCOME_KNOWN', { providerAttemptDigest: digest('8'), providerReceiptDigest: digest('b') });
  await advance('CLOSED', { providerAttemptDigest: digest('8'), providerReceiptDigest: digest('b') });
  assert.deepEqual(current.state.ledger.records.map((entry) => entry.state), [
    'RESERVED', 'REQUEST_BOUND', 'ADMITTED', 'PREPARED', 'DISPATCH_STARTED',
    'OUTCOME_AMBIGUOUS', 'RECONCILING', 'OUTCOME_KNOWN', 'CLOSED'
  ]);
  assert.equal(current.state.ledger.ambiguities.length, 1);
  assert.equal((await advance('CLOSED', {
    providerAttemptDigest: digest('8'), providerReceiptDigest: digest('b')
  })).disposition, 'KSTACK_REPLAY_RESULT_RECORDED');
});

test('reconciliation refuses unregistered, mismatched, and action-capable plans', async () => {
  const current = replayFixture();
  const { reserved } = await reserveAndBind(current);
  const plan = reconciliationPlan();
  const planDigest = validateReplayArtifact('ReconciliationPlanV1', plan).objectDigest;
  const advance = (toState, changes = {}) => current.kernel.advance({
    attemptId: reserved.attemptId, toState, stateEvidenceDigest: digest('7'), providerAttemptDigest: null,
    providerReceiptDigest: null, localResultDigest: null, ambiguity: null, ...changes
  });
  await advance('ADMITTED'); await advance('PREPARED');
  await advance('DISPATCH_STARTED', { providerAttemptDigest: digest('8') });
  await advance('OUTCOME_AMBIGUOUS', {
    providerAttemptDigest: digest('8'), ambiguity: {
      observedEvidenceDigest: digest('9'), reconciliationPlanDigest: planDigest,
      retentionUntil: '2027-08-29T03:00:00.000Z'
    }
  });
  await assert.rejects(() => current.kernel.beginReconciliation({
    attemptId: reserved.attemptId,
    plan: reconciliationPlan({ requirementProfileDigest: digest('0') }),
    stateEvidenceDigest: digest('7')
  }), (error) => error?.code === 'KSTACK_REPLAY_RECONCILIATION_REQUIRED');
  code('KSTACK_REPLAY_OBJECT_INVALID', () => validateReplayArtifact('ReconciliationPlanV1',
    reconciliationPlan({ sameKeyCallMode: 'RETRY_EFFECT' })));
  assert.equal(current.state.ledger.records.at(-1).state, 'OUTCOME_AMBIGUOUS');
});

test('closed attempts produce permanent non-replay tombstones with safe retention', async () => {
  const current = replayFixture();
  const { reserved } = await reserveAndBind(current);
  const advance = (toState, changes = {}) => current.kernel.advance({
    attemptId: reserved.attemptId, toState, stateEvidenceDigest: digest('7'), providerAttemptDigest: null,
    providerReceiptDigest: null, localResultDigest: null, ambiguity: null, ...changes
  });
  await assert.rejects(() => current.kernel.recordTombstone({
    attemptId: reserved.attemptId, archivedObjectDigest: digest('8'), retentionUntil: '2027-08-29T03:00:00.000Z'
  }), (error) => error?.code === 'KSTACK_REPLAY_RETENTION_UNSAFE');
  await advance('ADMITTED'); await advance('PREPARED');
  await advance('DISPATCH_STARTED', { providerAttemptDigest: digest('8') });
  await advance('OUTCOME_KNOWN', { providerAttemptDigest: digest('8'), providerReceiptDigest: digest('9') });
  await advance('CLOSED', { providerAttemptDigest: digest('8'), providerReceiptDigest: digest('9') });
  await assert.rejects(() => current.kernel.recordTombstone({
    attemptId: reserved.attemptId, archivedObjectDigest: digest('a'), retentionUntil: current.sample.wallUtc
  }), (error) => error?.code === 'KSTACK_REPLAY_RETENTION_UNSAFE');
  const recorded = await current.kernel.recordTombstone({
    attemptId: reserved.attemptId, archivedObjectDigest: digest('a'), retentionUntil: '2027-08-29T03:00:00.000Z'
  });
  assert.equal(recorded.recorded, true);
  assert.equal(current.state.ledger.tombstones.length, 1);
  assert.equal((await current.kernel.recordTombstone({
    attemptId: reserved.attemptId, archivedObjectDigest: digest('a'), retentionUntil: '2027-08-29T03:00:00.000Z'
  })).disposition, 'KSTACK_REPLAY_RESULT_RECORDED');

  current.state.ledger.records = [];
  current.state.ledger.reservations = [];
  current.state.ledger.effectScopes = [];
  const archivedReplay = await current.kernel.reserve(structuredClone(current.input));
  assert.equal(archivedReplay.reserved, false);
  assert.equal(archivedReplay.disposition, 'KSTACK_REPLAY_RESULT_RECORDED');

  const changedScope = structuredClone(current.input);
  changedScope.effectScope.semanticEffectDigest = digest('0');
  current.state.nonceCount = 0;
  await assert.rejects(() => current.kernel.reserve(changedScope),
    (error) => error?.code === 'KSTACK_REPLAY_NONCE_DUPLICATE');
});

test('state machine refuses action dispatch without a durable PREPARED record', async () => {
  const current = replayFixture();
  const { reserved } = await reserveAndBind(current);
  await current.kernel.advance({
    attemptId: reserved.attemptId, toState: 'ADMITTED', stateEvidenceDigest: digest('7'),
    providerAttemptDigest: null, providerReceiptDigest: null, localResultDigest: null, ambiguity: null
  });
  await assert.rejects(() => current.kernel.advance({
    attemptId: reserved.attemptId, toState: 'DISPATCH_STARTED', stateEvidenceDigest: digest('8'),
    providerAttemptDigest: digest('9'), providerReceiptDigest: null, localResultDigest: null, ambiguity: null
  }), (error) => error?.code === 'KSTACK_REPLAY_LEDGER_CORRUPT');
  assert.equal(current.state.ledger.records.at(-1).state, 'ADMITTED');
});

test('file journal durably commits replay transactions and reconstructs indexes after reopen', async () => {
  const root = temporaryStoreRoot();
  try {
    const fixture = replayFixture();
    const store = new ProtectedReplayFileStore({
      root, schemaSetDigest, durabilityPrimitiveId: 'fsync-rename-directory-fsync'
    });
    store.provisionLedger('protected-ledger');
    let nonceCount = 0;
    let attemptCount = 0;
    const dependencies = {
      readLedger: (ledgerId) => store.readLedger(ledgerId),
      commitLedger: (transaction) => store.commitLedger(transaction),
      sampleTime: async () => structuredClone(fixture.sample),
      mintNonceDigest: async () => digest(String(++nonceCount)),
      mintAttemptId: async () => `file-attempt-${++attemptCount}`
    };
    fixture.kernel = new ProtectedReplayKernel({ schemaSetDigest, ledgerId: 'protected-ledger', dependencies });
    const { reserved } = await reserveAndBind(fixture);
    const advance = (toState) => fixture.kernel.advance({
      attemptId: reserved.attemptId, toState, stateEvidenceDigest: digest('7'), providerAttemptDigest: null,
      providerReceiptDigest: null, localResultDigest: null, ambiguity: null
    });
    await advance('ADMITTED'); await advance('DENIED'); await advance('CLOSED');
    await fixture.kernel.recordTombstone({
      attemptId: reserved.attemptId, archivedObjectDigest: digest('8'), retentionUntil: '2027-08-29T03:00:00.000Z'
    });
    assert.equal(store.readLedger('protected-ledger').generation, 6);

    const reopened = new ProtectedReplayFileStore({
      root, schemaSetDigest, durabilityPrimitiveId: 'fsync-rename-directory-fsync'
    });
    const recovered = reopened.readLedger('protected-ledger');
    assert.equal(recovered.records.length, 5);
    assert.equal(recovered.records.at(-1).state, 'CLOSED');
    assert.equal(recovered.tombstones.length, 1);
    const duplicateKernel = new ProtectedReplayKernel({
      schemaSetDigest,
      ledgerId: 'protected-ledger',
      dependencies: {
        ...dependencies,
        readLedger: (ledgerId) => reopened.readLedger(ledgerId),
        commitLedger: (transaction) => reopened.commitLedger(transaction)
      }
    });
    const duplicate = await duplicateKernel.reserve(structuredClone(fixture.input));
    assert.equal(duplicate.disposition, 'KSTACK_REPLAY_RESULT_RECORDED');
    assert.equal(duplicate.attemptId, reserved.attemptId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('file journal recovers a committed transaction after snapshot crash and rejects committed corruption', async () => {
  const root = temporaryStoreRoot();
  try {
    const fixture = replayFixture();
    const store = new ProtectedReplayFileStore({
      root, schemaSetDigest, durabilityPrimitiveId: 'fsync-rename-directory-fsync'
    });
    const genesis = store.provisionLedger('protected-ledger');
    fixture.kernel = new ProtectedReplayKernel({
      schemaSetDigest,
      ledgerId: 'protected-ledger',
      dependencies: {
        readLedger: (ledgerId) => store.readLedger(ledgerId),
        commitLedger: (transaction) => store.commitLedger(transaction),
        sampleTime: async () => structuredClone(fixture.sample),
        mintNonceDigest: async () => digest('1'),
        mintAttemptId: async () => 'crash-attempt'
      }
    });
    await fixture.kernel.reserve(fixture.input);
    const ledgerDirectory = path.join(root, fs.readdirSync(root).find((name) => name.startsWith('ledger-')));
    const statePath = path.join(ledgerDirectory, 'state.json');
    fs.writeFileSync(statePath, hostCanonicalBytes(genesis));
    const pending = path.join(ledgerDirectory, 'transactions', '.pending-00000000-0000-4000-8000-000000000000');
    fs.writeFileSync(pending, 'incomplete', { mode: 0o600 });

    const recovered = store.readLedger('protected-ledger');
    assert.equal(recovered.generation, 1);
    assert.equal(recovered.records.length, 1);
    assert.equal(fs.existsSync(pending), false);
    assert.equal(fs.readFileSync(statePath).equals(hostCanonicalBytes(recovered)), true);

    const transaction = path.join(ledgerDirectory, 'transactions', '000000000001.json');
    fs.chmodSync(transaction, 0o644);
    code('KSTACK_REPLAY_LEDGER_CORRUPT', () => store.readLedger('protected-ledger'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('file journal rejects state-index disagreement, forked sequence names, and unprovable locks', async () => {
  const root = temporaryStoreRoot();
  try {
    const fixture = replayFixture();
    const store = new ProtectedReplayFileStore({
      root, schemaSetDigest, durabilityPrimitiveId: 'fsync-rename-directory-fsync'
    });
    store.provisionLedger('protected-ledger');
    fixture.kernel = new ProtectedReplayKernel({
      schemaSetDigest, ledgerId: 'protected-ledger',
      dependencies: {
        readLedger: (ledgerId) => store.readLedger(ledgerId),
        commitLedger: (transaction) => store.commitLedger(transaction),
        sampleTime: async () => structuredClone(fixture.sample),
        mintNonceDigest: async () => digest('1'),
        mintAttemptId: async () => 'integrity-attempt'
      }
    });
    await fixture.kernel.reserve(fixture.input);
    const ledgerDirectory = path.join(root, fs.readdirSync(root).find((name) => name.startsWith('ledger-')));
    const statePath = path.join(ledgerDirectory, 'state.json');
    const original = fs.readFileSync(statePath);
    const changed = JSON.parse(original.toString('utf8'));
    changed.records[0].policyDigest = digest('0');
    fs.writeFileSync(statePath, hostCanonicalBytes(changed));
    code('KSTACK_REPLAY_LEDGER_CORRUPT', () => store.readLedger('protected-ledger'));
    fs.writeFileSync(statePath, original);

    const transactions = path.join(ledgerDirectory, 'transactions');
    fs.copyFileSync(path.join(transactions, '000000000001.json'), path.join(transactions, '000000000003.json'));
    code('KSTACK_REPLAY_LEDGER_CORRUPT', () => store.readLedger('protected-ledger'));
    fs.unlinkSync(path.join(transactions, '000000000003.json'));

    const lock = path.join(root, 'transaction.lock');
    fs.writeFileSync(lock, hostCanonicalBytes({ ownerToken: '00000000-0000-4000-8000-000000000000' }), { mode: 0o600 });
    code('KSTACK_REPLAY_LEDGER_UNAVAILABLE', () => store.readLedger('protected-ledger'));
    fs.unlinkSync(lock);
    assert.equal(store.readLedger('protected-ledger').generation, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('interruption is cancelled only before dispatch and becomes durable ambiguity after dispatch', async () => {
  const before = replayFixture();
  const beforeBound = await reserveAndBind(before);
  const transition = (current, attemptId, toState, changes = {}) => current.kernel.advance({
    attemptId, toState, stateEvidenceDigest: digest('7'), providerAttemptDigest: null,
    providerReceiptDigest: null, localResultDigest: null, ambiguity: null, ...changes
  });
  await transition(before, beforeBound.reserved.attemptId, 'ADMITTED');
  await transition(before, beforeBound.reserved.attemptId, 'PREPARED');
  const cancelled = await before.kernel.recordInterruption({
    attemptId: beforeBound.reserved.attemptId,
    stateEvidenceDigest: digest('8'), observedEvidenceDigest: digest('9'),
    reconciliationPlanDigest: null, retentionUntil: null
  });
  assert.equal(cancelled.state, 'CANCELLED_PRE_ACTION');
  assert.equal(before.state.ledger.ambiguities.length, 0);

  const after = replayFixture();
  const afterBound = await reserveAndBind(after);
  await transition(after, afterBound.reserved.attemptId, 'ADMITTED');
  await transition(after, afterBound.reserved.attemptId, 'PREPARED');
  await transition(after, afterBound.reserved.attemptId, 'DISPATCH_STARTED', { providerAttemptDigest: digest('a') });
  const ambiguous = await after.kernel.recordInterruption({
    attemptId: afterBound.reserved.attemptId,
    stateEvidenceDigest: digest('b'), observedEvidenceDigest: digest('c'),
    reconciliationPlanDigest: null, retentionUntil: null
  });
  assert.equal(ambiguous.state, 'OUTCOME_AMBIGUOUS');
  assert.equal(after.state.ledger.ambiguities.length, 1);
  assert.equal(after.state.ledger.ambiguities[0].retentionUntil, null);
});

test('startup recovery converts every orphaned DISPATCH_STARTED attempt to ambiguity', async () => {
  const current = replayFixture();
  const { reserved } = await reserveAndBind(current);
  const advance = (toState, changes = {}) => current.kernel.advance({
    attemptId: reserved.attemptId, toState, stateEvidenceDigest: digest('7'), providerAttemptDigest: null,
    providerReceiptDigest: null, localResultDigest: null, ambiguity: null, ...changes
  });
  await advance('ADMITTED');
  await advance('PREPARED');
  await advance('DISPATCH_STARTED', { providerAttemptDigest: digest('8') });
  const recovery = await current.kernel.recover({
    stateEvidenceDigest: digest('9'), observedEvidenceDigest: digest('a'),
    reconciliationPlanDigest: null, retentionUntil: null
  });
  assert.deepEqual(recovery, { prepared: [], ambiguous: [reserved.attemptId], recovered: 1 });
  assert.equal(current.state.ledger.records.at(-1).state, 'OUTCOME_AMBIGUOUS');
});
