import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  AppendFifo,
  CHECKPOINT_CONSTANTS,
  CHECKPOINT_VERIFIED_FIELDS,
  EMPTY_RECORD_SHA256,
  EVENT_FANOUT_MAXIMA,
  QualificationRegistry,
  SIGNATURE_PLACEHOLDER,
  admitEvent,
  assertReplayState,
  brokerCowDurabilityMs,
  chainValidationCostMs,
  completeAdmissionTurn,
  deriveDeltaPageEnvelope,
  encodeDeltaPage,
  evaluateAdmission,
  gateBoundaryArithmetic,
  initialCheckpointState,
  intervalAfterAppend,
  jcsBytes,
  maximumRecoveryFixtures,
  qualifyVerifierProbe,
  recoveryFixtureAccounting,
  reconcileBrokerAcknowledgements,
  replayDerivedCheckpointState,
  runGateWithBoundedRetries,
  publicationBijectionKeys,
  repairSealBeforeCaller,
  selectGreatestVerifiedAnchor,
  sha256Hex,
  signEvent,
  stabilizeChargedJcsBytes,
  validateBrokerDurabilityTrace,
  validateCheckpointRejectionSuccessor,
  validateCheckpointVerified,
  validateEventFanout,
  validateCheckpointReserves,
  validateDeltaPage,
  validatePruneEligibility,
  validateSelectedSubtreeRead,
  validateSubtreeTransition,
  validateVerifierSetUpdate,
  verifierEligibilityArithmetic,
  verifySignedEvent,
  virtualGenesis
} from '../plugins/kstack/scripts/kstack-checkpoint.mjs';

const UUID = '00000000-0000-4000-8000-000000000000';
const OTHER_UUID = '00000000-0000-4000-8000-000000000001';
const HASH = 'f'.repeat(64);

function tailSummaries(firstSequence, lastSequence) {
  return Array.from({ length: lastSequence - firstSequence + 1 }, (_, index) => ({
    sequence: firstSequence + index,
    eventType: 'fixture',
    chargedJcsBytes: 1,
    mapKeys: [],
    mapKeyCharge: 0
  }));
}

function boundaryState(lag, rotations = 0, successors = 0) {
  return initialCheckpointState({
    headSequence: lag,
    lastVerifiedCoverageTailSequence: 0,
    sealedCandidate: {
      checkpointId: UUID,
      eventSequence: 129,
      eventSha256: HASH,
      verifierSetId: UUID,
      verifierSetDigest: HASH
    },
    aboveBoundaryRotationCount: rotations,
    aboveBoundaryRejectionSuccessorCount: successors,
    interval: { physicalEventCount: 1, chargedJcsBytes: 1, distinctMapKeys: [], intervalClosed: false },
    tailEvents: tailSummaries(1, lag)
  });
}

function boundaryEvent(state, kind) {
  const common = { eventType: kind, sequence: state.headSequence + 1, chargedJcsBytes: 1 };
  if (kind === 'verifier-set-update') {
    return {
      ...common,
      newVerifierSetId: OTHER_UUID,
      newVerifierSetDigest: HASH,
      candidateAuthorityRebinding: {
        candidateCheckpointId: state.sealedCandidate.checkpointId,
        candidateEventSequence: state.sealedCandidate.eventSequence,
        candidateEventSha256: state.sealedCandidate.eventSha256
      }
    };
  }
  return {
    ...common,
    successorCheckpoint: {
      checkpointId: OTHER_UUID,
      checkpointEventSequence: common.sequence,
      verifierSetId: UUID,
      verifierSetDigest: HASH
    }
  };
}

function assertProtocolCode(operation, code) {
  assert.throws(operation, (error) => error?.code === code);
}

test('closed constants and arithmetic preserve the L_max and gate proof', () => {
  assert.equal(CHECKPOINT_CONSTANTS.L_MAX, 258);
  assert.equal(CHECKPOINT_CONSTANTS.GATE_DEADLINE_MS, 326_000);
  assert.equal(CHECKPOINT_CONSTANTS.VERIFIER_LOCK_HOLD_MAX_MS, 62_000);
  assert.equal(CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAX_BYTES, 19_988_480);
  assert.equal(CHECKPOINT_CONSTANTS.RECOVERY_TAIL_MAX_BYTES, 20_004_864);
  assert.equal(chainValidationCostMs(262, 20_004_864), 47_899);
  const arithmetic = verifierEligibilityArithmetic();
  assert.deepEqual(arithmetic.components, {
    recoveryTail: 47_899,
    candidateBundleReadHash: 2_000,
    headerParseHash: 63,
    aggregateJoins: 1_657,
    rootCompareAndEd25519: 250,
    mirrorCopyHashDurability: 6_886,
    dispositionAppend: 1_064,
    schemaSetSchedulerReserve: 1_500
  });
  assert.equal(arithmetic.totalMs, 61_319);
  assert.equal(arithmetic.verifierSlackMs, 681);
  assert.equal(arithmetic.recoveryAggregateMs, 315_649);
  assert.equal(arithmetic.recoveryMarginMs, 10_351);
  assert.equal(arithmetic.queuedGateMs, 314_649);
  assert.equal(arithmetic.queuedGateMarginMs, 11_351);
  const boundary = gateBoundaryArithmetic();
  assert.equal(boundary.ordinaryChainMs, 47_443);
  assert.equal(boundary.ordinaryTotalMs, 315_193);
  assert.equal(boundary.ordinaryMarginMs, 10_807);
  assert.equal(boundary.recoveryTotalMs, 315_649);
  assert.equal(boundary.hypothetical259ChainMs, 48_553);
  assert.equal(boundary.hypothetical259TotalMs, 316_303);
  assert.ok(boundary.hypothetical259TotalMs > boundary.requiredMarginDeadlineMs);
});

test('delta-page accounting closes at exactly 128 pages and has no hidden page', () => {
  const envelope = deriveDeltaPageEnvelope();
  assert.equal(envelope.branchRecords, 98_304);
  assert.equal(envelope.branchBytes, 6_291_456);
  assert.equal(envelope.leafBytes, 1_572_864);
  assert.equal(envelope.branchIndexBytes, 393_216);
  assert.equal(envelope.auxiliaryUsedBytes, 36_864);
  assert.equal(envelope.supermanifestUsedBytes, 16_384);
  assert.deepEqual(envelope.pageCounts, { branch: 96, leaf: 24, index: 6, auxiliary: 1, manifest: 1 });
  assert.equal(envelope.pageCount, 128);
  assert.equal(envelope.pageBytes, 8_388_608);
  const encoded = encodeDeltaPage({ domain: 'branch', ordinal: 0, payload: Buffer.from('payload') });
  assert.equal(encoded.page.length, 65_536);
  assert.equal(encoded.usedByteCount, 7);
  assert.equal(validateDeltaPage(encoded.page, {
    domain: encoded.domain,
    ordinal: encoded.ordinal,
    usedByteCount: encoded.usedByteCount,
    pageSha256: encoded.pageSha256
  }), true);
  const nonzeroPadding = Buffer.from(encoded.page);
  nonzeroPadding[65_535] = 1;
  assertProtocolCode(() => validateDeltaPage(nonzeroPadding, {
    domain: encoded.domain,
    ordinal: encoded.ordinal,
    usedByteCount: encoded.usedByteCount,
    pageSha256: sha256Hex(nonzeroPadding)
  }), 'INVALID_DELTA_ENVELOPE');
});

test('interval closure is event/byte/key forced and key crossing starts a new interval', () => {
  const byEvent = intervalAfterAppend({ physicalEventCount: 127, chargedJcsBytes: 127, distinctMapKeys: [] }, { chargedJcsBytes: 1 });
  assert.equal(byEvent.next.intervalClosed, true);
  const byBytes = intervalAfterAppend({ physicalEventCount: 1, chargedJcsBytes: CHECKPOINT_CONSTANTS.K_B - 1, distinctMapKeys: [] }, { chargedJcsBytes: 1 });
  assert.equal(byBytes.next.intervalClosed, true);
  const keys = Array.from({ length: 380 }, (_, index) => `old-${index}`);
  const crossing = intervalAfterAppend({ physicalEventCount: 10, chargedJcsBytes: 10, distinctMapKeys: keys }, { chargedJcsBytes: 1, mapKeys: Array.from({ length: 10 }, (_, index) => `new-${index}`) });
  assert.equal(crossing.closedPrevious, true);
  assert.equal(crossing.next.physicalEventCount, 1);
  assert.equal(crossing.next.distinctMapKeys.length, 10);
});

test('cumulative tail byte and key backpressure rejects overflow after an early second closure', () => {
  let byteState = initialCheckpointState();
  for (let sequence = 1; sequence <= 7; sequence += 1) {
    const result = evaluateAdmission(byteState, { eventType: 'claim', sequence, chargedJcsBytes: CHECKPOINT_CONSTANTS.E_MAX }, { mapKeys: [] });
    assert.equal(result.admitted, true);
    byteState = result.nextState;
  }
  const firstByteClosure = completeAdmissionTurn({
    state: byteState,
    event: { eventType: 'claim', sequence: 8, chargedJcsBytes: CHECKPOINT_CONSTANTS.E_MAX },
    eventOptions: { mapKeys: [] },
    mandatoryCheckpoint: {
      eventType: 'checkpoint', sequence: 9, chargedJcsBytes: CHECKPOINT_CONSTANTS.CHECKPOINT_HEADER_MAX,
      checkpointId: UUID, coverageTailSequence: 8
    }
  });
  assert.equal(firstByteClosure.admitted, true);
  byteState = firstByteClosure.nextState;
  for (let sequence = 10; sequence <= 20; sequence += 1) {
    const result = evaluateAdmission(byteState, { eventType: 'claim', sequence, chargedJcsBytes: CHECKPOINT_CONSTANTS.E_MAX }, { mapKeys: [] });
    assert.equal(result.admitted, true, `byte sequence ${sequence}`);
    byteState = result.nextState;
  }
  assert.equal(byteState.tailChargedJcsBytes, CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAX_BYTES);
  assert.ok(byteState.headSequence < CHECKPOINT_CONSTANTS.L_MAX);
  assert.ok(byteState.sealedCandidate);
  const byteSnapshot = structuredClone(byteState);
  const byteOverflow = evaluateAdmission(byteState, { eventType: 'claim', sequence: 21, chargedJcsBytes: 1 }, { mapKeys: [] });
  assert.equal(byteOverflow.code, 'TAIL_BYTES_EXCEEDED');
  assert.equal(byteOverflow.mutated, false);
  assert.deepEqual(byteState, byteSnapshot);

  let keyState = initialCheckpointState();
  const nextKeys = (offset, count) => Array.from({ length: count }, (_, index) => `key-${offset + index}`);
  for (let sequence = 1; sequence <= 4; sequence += 1) {
    keyState = evaluateAdmission(keyState, { eventType: 'claim', sequence, chargedJcsBytes: 1 }, { mapKeys: nextKeys((sequence - 1) * 80, 80) }).nextState;
  }
  const firstKeyClosure = completeAdmissionTurn({
    state: keyState,
    event: { eventType: 'claim', sequence: 5, chargedJcsBytes: 1 },
    eventOptions: { mapKeys: nextKeys(320, 80) },
    mandatoryCheckpoint: {
      eventType: 'checkpoint', sequence: 6, chargedJcsBytes: 1,
      checkpointId: UUID, coverageTailSequence: 5
    }
  });
  assert.equal(firstKeyClosure.admitted, true);
  keyState = firstKeyClosure.nextState;
  for (let sequence = 7; sequence <= 11; sequence += 1) {
    const offset = (sequence - 7) * 80;
    const result = evaluateAdmission(keyState, { eventType: 'claim', sequence, chargedJcsBytes: 1 }, { mapKeys: nextKeys(offset, 80) });
    assert.equal(result.admitted, true, `key sequence ${sequence}`);
    keyState = result.nextState;
  }
  assert.equal(new Set(keyState.tailEvents.flatMap((summary) => summary.mapKeys)).size, 400);
  assert.equal(keyState.tailMapKeyCharge, 800);
  const atKeyCeiling = evaluateAdmission(keyState, { eventType: 'claim', sequence: 12, chargedJcsBytes: 1 }, { mapKeys: nextKeys(400, 48) });
  assert.equal(atKeyCeiling.admitted, true);
  keyState = atKeyCeiling.nextState;
  assert.equal(keyState.tailMapKeyCharge, CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAP_KEY_CHARGE_MAX);
  assert.ok(keyState.headSequence < CHECKPOINT_CONSTANTS.L_MAX);
  assert.ok(keyState.sealedCandidate);
  const keySnapshot = structuredClone(keyState);
  const keyOverflow = evaluateAdmission(keyState, { eventType: 'claim', sequence: 13, chargedJcsBytes: 1 }, { mapKeys: nextKeys(448, 1) });
  assert.equal(keyOverflow.code, 'TAIL_KEYS_EXCEEDED');
  assert.equal(keyOverflow.mutated, false);
  assert.deepEqual(keyState, keySnapshot);
});

test('forced seal survives reconstructed closure and admits a full 65,536-byte checkpoint', () => {
  const state = initialCheckpointState({
    headSequence: 10,
    lastVerifiedCoverageTailSequence: 0,
    sealRequired: true,
    interval: { physicalEventCount: 128, chargedJcsBytes: 10, distinctMapKeys: [], intervalClosed: true },
    tailEvents: tailSummaries(1, 10)
  });
  const ordinary = evaluateAdmission(state, { eventType: 'claim', sequence: 11, chargedJcsBytes: 10 }, { mapKeys: ['a'] });
  assert.equal(ordinary.code, 'CHECKPOINT_REQUIRED');
  assert.equal(ordinary.mutated, false);
  assert.deepEqual(state.headSequence, 10);
  const checkpoint = evaluateAdmission(state, {
    eventType: 'checkpoint', sequence: 11, chargedJcsBytes: 65_536,
    checkpointId: UUID, coverageTailSequence: 10
  }, { mapKeys: [] });
  assert.equal(checkpoint.admitted, true);
  assert.equal(checkpoint.nextState.sealedCandidate.checkpointId, UUID);
  assert.equal(checkpoint.nextState.sealRequired, false);
});

test('sealRequired is replay-derived after a crash at the interval-closing append', () => {
  const events = Array.from({ length: 128 }, (_, index) => ({
    eventType: 'claim',
    sequence: index + 1,
    chargedJcsBytes: 1
  }));
  const reconstructed = replayDerivedCheckpointState({
    events,
    expandMapKeys: () => []
  });
  assert.equal(reconstructed.sealRequired, true);
  const refused = evaluateAdmission(reconstructed, { eventType: 'claim', sequence: 129, chargedJcsBytes: 1 }, { mapKeys: [] });
  assert.equal(refused.code, 'CHECKPOINT_REQUIRED');
  const repaired = repairSealBeforeCaller(reconstructed, {
    eventType: 'checkpoint', sequence: 129, chargedJcsBytes: 65_536,
    checkpointId: UUID, coverageTailSequence: 128
  });
  assert.equal(repaired.code, 'RETRY_AFTER_REPAIR');
  assert.equal(repaired.checkpointCommitted, true);
  assert.equal(repaired.acknowledgementAllowed, false);
});

test('an interval-closing writer turn cannot acknowledge before its mandatory checkpoint', () => {
  const state = initialCheckpointState({
    headSequence: 127,
    lastVerifiedCoverageTailSequence: 0,
    interval: { physicalEventCount: 127, chargedJcsBytes: 127, distinctMapKeys: [], intervalClosed: false },
    tailEvents: tailSummaries(1, 127)
  });
  const primary = { eventType: 'claim', sequence: 128, chargedJcsBytes: 1 };
  const interrupted = completeAdmissionTurn({ state, event: primary, eventOptions: { mapKeys: [] } });
  assert.equal(interrupted.code, 'CHECKPOINT_APPEND_REQUIRED');
  assert.equal(interrupted.primaryCommitted, true);
  assert.equal(interrupted.acknowledgementAllowed, false);
  const complete = completeAdmissionTurn({
    state,
    event: primary,
    eventOptions: { mapKeys: [] },
    mandatoryCheckpoint: {
      eventType: 'checkpoint', sequence: 129, chargedJcsBytes: 65_536,
      checkpointId: UUID, coverageTailSequence: 128
    }
  });
  assert.equal(complete.admitted, true);
  assert.equal(complete.checkpointCommitted, true);
  assert.equal(complete.acknowledgementAllowed, true);
});

test('replay rejects every synthesized zero-SEALED boundary state at lags 256-262', () => {
  for (let lag = 256; lag <= 262; lag += 1) {
    const state = initialCheckpointState({ headSequence: lag, lastVerifiedCoverageTailSequence: 0, sealedCandidate: null, tailEvents: tailSummaries(1, lag) });
    assertProtocolCode(() => assertReplayState(state), 'INVALID_REPLAY_STATE');
  }
});

test('ordinary admission stops byte-identically after lag 258', () => {
  const at257 = boundaryState(257);
  const admitted = evaluateAdmission(at257, { eventType: 'claim', sequence: 258, chargedJcsBytes: 10 }, { mapKeys: ['one'] });
  assert.equal(admitted.admitted, true);
  const snapshot = structuredClone(admitted.nextState);
  const refused = evaluateAdmission(admitted.nextState, { eventType: 'claim', sequence: 259, chargedJcsBytes: 10 }, { mapKeys: ['two'] });
  assert.equal(refused.code, 'VERIFIER_LAG');
  assert.equal(refused.mutated, false);
  assert.deepEqual(admitted.nextState, snapshot);
});

test('all six recovery orderings reach lag 262 and a fifth event is refused', () => {
  for (const ordering of ['RRSS', 'RSRS', 'RSSR', 'SRRS', 'SRSR', 'SSRR']) {
    let state = boundaryState(258);
    for (const symbol of ordering) {
      const event = boundaryEvent(state, symbol === 'R' ? 'verifier-set-update' : 'checkpoint-rejection-successor');
      const result = evaluateAdmission(state, event, { validAuthority: true, validDisposition: true });
      assert.equal(result.admitted, true, `${ordering} at ${state.headSequence}`);
      state = result.nextState;
      assertReplayState(state);
    }
    assert.equal(state.headSequence, 262);
    assert.equal(state.aboveBoundaryRotationCount, 2);
    assert.equal(state.aboveBoundaryRejectionSuccessorCount, 2);
    const fifth = evaluateAdmission(state, boundaryEvent(state, 'verifier-set-update'), { validAuthority: true, validDisposition: true });
    assert.equal(fifth.code, 'VERIFIER_LAG');
  }
});

test('boundary counter state space and need-driven advancing actions are complete', () => {
  const pairsByLag = new Map([
    [259, [[1, 0], [0, 1]]],
    [260, [[2, 0], [1, 1], [0, 2]]],
    [261, [[2, 1], [1, 2]]],
    [262, [[2, 2]]]
  ]);
  for (const [lag, pairs] of pairsByLag) {
    for (const [rotations, successors] of pairs) {
      const state = boundaryState(lag, rotations, successors);
      assertReplayState(state);
      const verified = evaluateAdmission(state, { eventType: 'checkpoint-verified', sequence: lag + 1, chargedJcsBytes: 1, coverageTailSequence: 128 }, { validAuthority: true, validDisposition: true });
      assert.equal(verified.admitted, true, `VFY lag=${lag} pair=${rotations},${successors}`);
      assert.equal(verified.nextState.aboveBoundaryRotationCount, 0);
      assert.equal(verified.nextState.aboveBoundaryRejectionSuccessorCount, 0);
      if (lag < 262 && rotations < 2) {
        const rotation = evaluateAdmission(state, boundaryEvent(state, 'verifier-set-update'), { validAuthority: true });
        assert.equal(rotation.admitted, true, `R lag=${lag} pair=${rotations},${successors}`);
      }
      if (lag < 262 && successors < 2) {
        const successor = evaluateAdmission(state, boundaryEvent(state, 'checkpoint-rejection-successor'), { validAuthority: true, validDisposition: true });
        assert.equal(successor.admitted, true, `S lag=${lag} pair=${rotations},${successors}`);
      }
    }
  }
});

test('low-lag recovery consumes no quota and each third above-boundary type fails', () => {
  let state = boundaryState(256);
  let result = evaluateAdmission(state, boundaryEvent(state, 'verifier-set-update'), { validAuthority: true });
  assert.equal(result.admitted, true);
  assert.equal(result.nextState.aboveBoundaryRotationCount, 0);
  state = result.nextState;
  result = evaluateAdmission(state, boundaryEvent(state, 'checkpoint-rejection-successor'), { validAuthority: true, validDisposition: true });
  assert.equal(result.admitted, true);
  assert.equal(result.nextState.aboveBoundaryRejectionSuccessorCount, 0);

  state = boundaryState(258);
  for (let index = 0; index < 2; index += 1) state = evaluateAdmission(state, boundaryEvent(state, 'verifier-set-update'), { validAuthority: true }).nextState;
  assert.equal(evaluateAdmission(state, boundaryEvent(state, 'verifier-set-update'), { validAuthority: true }).code, 'RECOVERY_QUOTA_EXCEEDED');
  state = boundaryState(258);
  for (let index = 0; index < 2; index += 1) state = evaluateAdmission(state, boundaryEvent(state, 'checkpoint-rejection-successor'), { validAuthority: true, validDisposition: true }).nextState;
  assert.equal(evaluateAdmission(state, boundaryEvent(state, 'checkpoint-rejection-successor'), { validAuthority: true, validDisposition: true }).code, 'RECOVERY_QUOTA_EXCEEDED');
});

test('fanout inventory fails before mutation and migration remains within 64 keys', () => {
  for (const [eventType, maximum] of Object.entries(EVENT_FANOUT_MAXIMA)) {
    const count = eventType === 'namespace-migration-resolution' ? 64 : maximum;
    const keys = Array.from({ length: count }, (_, index) => `${eventType}-${index}`);
    assert.equal(validateEventFanout(eventType, keys, { migrationSourceCount: 32 }), count);
  }
  assertProtocolCode(() => validateEventFanout('claim', Array.from({ length: 81 }, (_, index) => String(index))), 'EVENT_KEY_FANOUT_EXCEEDED');
});

test('namespace migration remains fail-closed on its explicitly deferred caller-supplied schema validator', () => {
  const state = initialCheckpointState({ genesisAuthoritySha256: HASH, headRecordSha256: HASH });
  const event = stabilizeChargedJcsBytes({
    schemaVersion: 2,
    eventType: 'namespace-migration-resolution',
    sequence: 1,
    previousRecordSha256: HASH,
    genesisAuthoritySha256: HASH,
    chargedJcsBytes: 0,
    signerKeyId: UUID,
    operatorRootSignature: { algorithm: 'Ed25519', keyId: UUID, signatureBase64Url: SIGNATURE_PLACEHOLDER }
  }, 'operatorRootSignature');
  const before = structuredClone(state);
  const result = admitEvent(state, event, {});
  assert.equal(result.code, 'INVALID_SCHEMA');
  assert.equal(result.mutated, false);
  assert.deepEqual(state, before);
});

test('recovery serializer is exact JCS, fixed-point stable, and equals the authoritative maxima', () => {
  const { rotation, rejection } = maximumRecoveryFixtures();
  assert.equal(rotation.chargedJcsBytes, 2_709);
  assert.equal(jcsBytes(rotation).length, 2_709);
  assert.equal(rejection.chargedJcsBytes, 2_508);
  assert.equal(jcsBytes(rejection).length, 2_508);
  assert.equal(rotation.chargedJcsBytes, CHECKPOINT_CONSTANTS.RECOVERY_ROTATION_EXACT_MAX);
  assert.equal(rejection.chargedJcsBytes, CHECKPOINT_CONSTANTS.RECOVERY_REJECTION_SUCCESSOR_EXACT_MAX);
  validateVerifierSetUpdate(rotation);
  validateCheckpointRejectionSuccessor(rejection);
  const accounting = recoveryFixtureAccounting();
  assert.equal(accounting.rotation.exactJcsBytes, 2_709);
  assert.equal(accounting.rotation.authoritativeExactMaximum, 2_709);
  assert.equal(Object.values(accounting.rotation.topLevel).reduce((sum, bytes) => sum + bytes, 0), 2_709);
  assert.equal(Object.values(accounting.rotation.rebinding).reduce((sum, bytes) => sum + bytes, 0), 492);
  assert.equal(Object.values(accounting.rotation.verifierKey).reduce((sum, bytes) => sum + bytes, 0), 145);
  assert.equal(Object.values(accounting.rotation.signature).reduce((sum, bytes) => sum + bytes, 0), 180);
  assert.equal(accounting.rejectionSuccessor.exactJcsBytes, 2_508);
  assert.equal(accounting.rejectionSuccessor.authoritativeExactMaximum, 2_508);
  assert.equal(Object.values(accounting.rejectionSuccessor.successor).reduce((sum, bytes) => sum + bytes, 0), 1_289);
  assert.equal(Object.values(accounting.rejectionSuccessor.signature).reduce((sum, bytes) => sum + bytes, 0), 180);
  const extended = structuredClone(rotation);
  extended.extension = 'x'.repeat(4_097);
  assertProtocolCode(() => validateVerifierSetUpdate(extended), 'INVALID_SCHEMA');
});

test('signing binds top-level signer ID, nested key ID, and algorithm', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const template = maximumRecoveryFixtures().rotation;
  template.signerKeyId = UUID;
  template.operatorRootSignature.keyId = UUID;
  template.operatorRootSignature.signatureBase64Url = SIGNATURE_PLACEHOLDER;
  const signed = signEvent(template, 'operatorRootSignature', privateKey);
  assert.equal(verifySignedEvent(signed, { signatureMember: 'operatorRootSignature', authorityKeys: new Map([[UUID, publicKey]]), expectedSignerKeyId: UUID }), true);
  const top = structuredClone(signed);
  top.signerKeyId = OTHER_UUID;
  assertProtocolCode(() => verifySignedEvent(top, { signatureMember: 'operatorRootSignature', authorityKeys: new Map([[UUID, publicKey], [OTHER_UUID, publicKey]]) }), 'SIGNER_KEY_ID_MISMATCH');
  const nested = structuredClone(signed);
  nested.operatorRootSignature.keyId = OTHER_UUID;
  assertProtocolCode(() => verifySignedEvent(nested, { signatureMember: 'operatorRootSignature', authorityKeys: new Map([[UUID, publicKey], [OTHER_UUID, publicKey]]) }), 'SIGNER_KEY_ID_MISMATCH');
  const algorithm = structuredClone(signed);
  algorithm.operatorRootSignature.algorithm = 'ed25519';
  assertProtocolCode(() => verifySignedEvent(algorithm, { signatureMember: 'operatorRootSignature', authorityKeys: new Map([[UUID, publicKey]]) }), 'INVALID_SIGNATURE_ALGORITHM');
});

test('fixed-point procedure crosses decimal widths and rejects alternate signature projections', () => {
  const template = (payloadLength) => ({
    chargedJcsBytes: 0,
    eventType: 'fixture',
    payload: 'x'.repeat(payloadLength),
    schemaVersion: 2,
    signerKeyId: UUID,
    verifierSignature: { algorithm: 'Ed25519', keyId: UUID, signatureBase64Url: SIGNATURE_PLACEHOLDER }
  });
  for (const boundary of [1_000, 10_000]) {
    let below;
    let atOrAbove;
    for (let length = Math.max(0, boundary - 400); length <= boundary; length += 1) {
      const stable = stabilizeChargedJcsBytes(template(length), 'verifierSignature');
      if (stable.chargedJcsBytes < boundary) below = stable;
      if (!atOrAbove && stable.chargedJcsBytes >= boundary) atOrAbove = stable;
    }
    assert.ok(below && atOrAbove);
    assert.equal(jcsBytes(below).length, below.chargedJcsBytes);
    assert.equal(jcsBytes(atOrAbove).length, atOrAbove.chargedJcsBytes);
  }
  const alternate = template(1);
  alternate.verifierSignature.signatureBase64Url = 'B'.repeat(86);
  assertProtocolCode(() => stabilizeChargedJcsBytes(alternate, 'verifierSignature'), 'INVALID_SIGNATURE_PLACEHOLDER');
  const nulled = template(1);
  nulled.verifierSignature.signatureBase64Url = null;
  assertProtocolCode(() => stabilizeChargedJcsBytes(nulled, 'verifierSignature'), 'INVALID_SIGNATURE_PLACEHOLDER');
  const omitted = template(1);
  delete omitted.verifierSignature;
  assertProtocolCode(() => stabilizeChargedJcsBytes(omitted, 'verifierSignature'), 'INVALID_SCHEMA');
});

function verifiedFixture() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const event = {
    schemaVersion: 2,
    eventType: 'checkpoint-verified',
    storeId: 'store',
    projectId: 'project',
    sequence: 2,
    previousRecordSha256: HASH,
    genesisAuthoritySha256: HASH,
    chargedJcsBytes: 0,
    checkpointId: UUID,
    checkpointEventSequence: 1,
    checkpointEventSha256: HASH,
    previousVerifiedCheckpointId: 'VIRTUAL-GENESIS',
    previousVerifiedReceiptSha256: EMPTY_RECORD_SHA256,
    coverageFirstSequence: 1,
    coverageTailSequence: 1,
    coverageTailRecordSequence: 1,
    coverageTailRecordSha256: HASH,
    coverageRecordCount: 1,
    coverageChargedJcsBytes: 100,
    coverageDistinctMapKeys: 1,
    compactedLiveGenerationRoot: HASH,
    foldedSupersededGenerationRoot: HASH,
    usedDispatchIdsRoot: HASH,
    publicationArtifactBijectionRoot: HASH,
    deltaPageManifestSha256: HASH,
    deltaPageCount: 128,
    deltaPageBytes: 8_388_608,
    rawPruneManifestRoot: HASH,
    writerStateSha256: HASH,
    verifierSetId: UUID,
    verifierSetDigest: HASH,
    verifierVersion: 'fixture-v1',
    signerKeyId: UUID,
    verifierSignature: { algorithm: 'Ed25519', keyId: UUID, signatureBase64Url: SIGNATURE_PLACEHOLDER }
  };
  const signed = signEvent(event, 'verifierSignature', privateKey);
  const candidate = {
    checkpointId: UUID,
    eventSequence: 1,
    eventSha256: HASH,
    coverageFirstSequence: 1,
    coverageTailSequence: 1,
    coverageTailRecordSequence: 1,
    coverageTailRecordSha256: HASH,
    coverageRecordCount: 1,
    coverageChargedJcsBytes: 100,
    coverageDistinctMapKeys: 1,
    compactedLiveGenerationRoot: HASH,
    foldedSupersededGenerationRoot: HASH,
    usedDispatchIdsRoot: HASH,
    publicationArtifactBijectionRoot: HASH,
    deltaPageManifestSha256: HASH,
    deltaPageCount: 128,
    deltaPageBytes: 8_388_608,
    rawPruneManifestRoot: HASH,
    writerStateSha256: HASH,
    verifierSetId: UUID,
    verifierSetDigest: HASH
  };
  const context = {
    candidate,
    previousVerified: { checkpointId: 'VIRTUAL-GENESIS', receiptSha256: EMPTY_RECORD_SHA256 },
    verifierAuthorityKeys: new Map([[UUID, publicKey]])
  };
  return { signed, context };
}

test('checkpoint-verified inventory is exact and mirror receipt is byte-identical', () => {
  const { signed, context } = verifiedFixture();
  assert.deepEqual(Object.keys(signed).sort(), [...CHECKPOINT_VERIFIED_FIELDS].sort());
  assert.equal(validateCheckpointVerified(signed, { ...context, mirrorReceiptBytes: jcsBytes(signed) }), true);
  for (const field of CHECKPOINT_VERIFIED_FIELDS) {
    const missing = structuredClone(signed);
    delete missing[field];
    assertProtocolCode(() => validateCheckpointVerified(missing, context), 'INVALID_SCHEMA');
  }
  const added = structuredClone(signed);
  added.extra = true;
  assertProtocolCode(() => validateCheckpointVerified(added, context), 'INVALID_SCHEMA');
  assertProtocolCode(() => validateCheckpointVerified(signed, { ...context, mirrorReceiptBytes: Buffer.from('different') }), 'MIRROR_RECEIPT_MISMATCH');
});

test('receipt verification is host-independent while production scheduling uses local qualification', () => {
  const { signed, context } = verifiedFixture();
  const emptyHost = new QualificationRegistry();
  const otherHost = new QualificationRegistry();
  assert.equal(validateCheckpointVerified(signed, context), true);
  assert.equal(validateCheckpointVerified(signed, context), true);
  assertProtocolCode(() => emptyHost.schedule([{ implementationSha256: HASH, fixtureVersion: 'v1', filesystemClass: 'xfs', keyId: UUID }]), 'NO_ELIGIBLE_VERIFIER');
  const probe = {
    implementationSha256: HASH,
    fixtureVersion: 'v1',
    filesystemClass: 'xfs',
    durationMs: 62_000,
    keyId: UUID,
    canonicalParseHashBytesPerSecond: 1_048_576,
    sequentialHashBytesPerSecond: 4_194_304,
    fileBarrierMaxMs: 30,
    directoryBarrierMaxMs: 500,
    primitiveCryptoMaxMs: 250,
    completeFixture: true
  };
  otherHost.qualify(probe);
  assert.equal(otherHost.schedule([probe]), probe);
  assertProtocolCode(() => qualifyVerifierProbe({ ...probe, durationMs: 62_001 }), 'QUALIFICATION_FAILED');
});

test('validated VERIFIED admission requires independent candidate replay but no local qualification record', () => {
  const { signed, context } = verifiedFixture();
  const state = initialCheckpointState({
    headSequence: 1,
    headRecordSha256: HASH,
    genesisAuthoritySha256: HASH,
    lastVerifiedCoverageTailSequence: 0,
    sealedCandidate: context.candidate,
    tailEvents: tailSummaries(1, 1)
  });
  const admitted = admitEvent(state, signed, {
    ...context,
    mirrorReceiptBytes: jcsBytes(signed),
    validateCandidateReplay: () => true,
    expandMapKeys: () => []
  });
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.nextState.lastVerifiedCoverageTailSequence, 1);
  assert.equal(admitted.nextState.sealedCandidate, null);
  const withoutReplay = admitEvent(state, signed, {
    ...context,
    mirrorReceiptBytes: jcsBytes(signed),
    expandMapKeys: () => []
  });
  assert.equal(withoutReplay.code, 'INVALID_DISPOSITION');
});

test('subtrees stay outside checkpoint pages and fail closed on durability/read bounds', () => {
  assert.equal(validateSubtreeTransition({ subtreeRoot: Buffer.alloc(32), metadataBytes: 4_064, witnessBytes: 1_048_576, objectDurable: true }), true);
  assertProtocolCode(() => validateSubtreeTransition({ subtreeRoot: Buffer.alloc(32), metadataBytes: 1, witnessBytes: 1, objectDurable: false }), 'SUBTREE_NOT_DURABLE');
  assert.equal(validateSelectedSubtreeRead({ membershipProofBytes: 1, selectedObjectBytes: 67_108_863 }), 67_108_864);
  assertProtocolCode(() => validateSelectedSubtreeRead({ membershipProofBytes: 2, selectedObjectBytes: 67_108_863 }), 'SELECTED_BYTES_EXCEEDED');
  assert.equal(deriveDeltaPageEnvelope({ distinctMapKeys: 384, physicalEventCount: 128 }).pageCount, 128);
});

test('reserves and mirror-before-prune rules fail closed', () => {
  assert.deepEqual(validateCheckpointReserves({
    projectAvailableBytes: 16_777_216,
    mirrorAvailableBytes: 33_554_432,
    deltaPageBytes: 8_388_608,
    checkpointHeaderBytes: 65_536,
    recoveryEventCount: 4
  }), { requiredProject: 8_470_528, requiredMirror: 8_470_528 });
  assertProtocolCode(() => validateCheckpointReserves({
    projectAvailableBytes: 16_777_215,
    mirrorAvailableBytes: 33_554_432,
    deltaPageBytes: 8_388_608,
    checkpointHeaderBytes: 65_536
  }), 'CHECKPOINT_RESERVE_EXHAUSTED');
  const mirror = {
    headerDurable: true,
    pagesDurable: true,
    manifestDurable: true,
    receiptDurable: true,
    rawEvidenceDurableThroughGeneration: 2
  };
  assert.equal(validatePruneEligibility({ lifecycle: 'VERIFIED', mirror, checkpointGeneration: 1, newestVerifiedGeneration: 2 }), true);
  assertProtocolCode(() => validatePruneEligibility({ lifecycle: 'SEALED', mirror, checkpointGeneration: 1, newestVerifiedGeneration: 2 }), 'PRUNE_NOT_VERIFIED');
  assertProtocolCode(() => validatePruneEligibility({ lifecycle: 'VERIFIED', mirror: { ...mirror, rawEvidenceDurableThroughGeneration: 1 }, checkpointGeneration: 1, newestVerifiedGeneration: 2 }), 'MIRROR_RETENTION_INCOMPLETE');
});

test('gate anchor selection and broker restart never omit durable acknowledgements', () => {
  const virtual = virtualGenesis('store', 'project');
  const selected = selectGreatestVerifiedAnchor({
    anchors: [{ sequence: 4, valid: false }, { sequence: 3, valid: true }, { sequence: 8, valid: true }],
    capturedHeadSequence: 5,
    validateAnchor: (anchor) => anchor.valid,
    virtual
  });
  assert.equal(selected.sequence, 3);
  assert.equal(selectGreatestVerifiedAnchor({ anchors: [], capturedHeadSequence: 0, validateAnchor: () => false, virtual }).checkpointId, 'VIRTUAL-GENESIS');
  const acknowledgements = [{ authorizationId: 'id-1', action: 'spawn', projectId: 'project', sequence: 5 }];
  assert.equal(reconcileBrokerAcknowledgements({ acknowledgements, replayedUsedIds: new Map([['id-1', { action: 'spawn', projectId: 'project' }]]), capturedHeadSequence: 5 }), true);
  assertProtocolCode(() => reconcileBrokerAcknowledgements({ acknowledgements, replayedUsedIds: new Map(), capturedHeadSequence: 5 }), 'BROKER_CORRUPT');
  assertProtocolCode(() => reconcileBrokerAcknowledgements({ acknowledgements, replayedUsedIds: new Map([['id-1', { action: 'other', projectId: 'project' }]]), capturedHeadSequence: 5 }), 'BROKER_CORRUPT');
});

test('application publication pairs consume exactly four bidirectional map keys', () => {
  const keys = publicationBijectionKeys({ canonicalArtifactSha256: HASH, contentSha256: 'e'.repeat(64) });
  assert.equal(keys.length, 4);
  assert.equal(new Set(keys).size, 4);
  keys.forEach((key) => assert.match(key, /^[0-9a-f]{64}$/));
});

test('FIFO admits at most one of each participant and never bypasses an existing gate', () => {
  const fifo = new AppendFifo();
  assert.equal(fifo.join('gate', 'g').admitted, true);
  assert.equal(fifo.join('verifier', 'v').position, 1);
  assert.equal(fifo.join('writer', 'w').position, 2);
  assert.equal(fifo.join('writer', 'w2').code, 'LOCK_QUEUE_FULL');
  assert.equal(fifo.snapshot().holder.token, 'g');
  assert.equal(fifo.release('g').holder.token, 'v');
  assert.equal(fifo.release('v').holder.token, 'w');
});

test('gate retries all starvation outcomes at most three times and 980,000 ms', async () => {
  const outcomes = ['LOCK_QUEUE_FULL', 'RETRY_AFTER_REPAIR', 'RETRY_AFTER_QUANTUM'];
  const permutations = [
    outcomes,
    [outcomes[0], outcomes[2], outcomes[1]],
    [outcomes[1], outcomes[0], outcomes[2]],
    [outcomes[1], outcomes[2], outcomes[0]],
    [outcomes[2], outcomes[0], outcomes[1]],
    [outcomes[2], outcomes[1], outcomes[0]]
  ];
  for (const order of permutations) {
    let calls = 0;
    const delays = [];
    const result = await runGateWithBoundedRetries({
      operationToken: 'stable-token',
      acquire: async ({ operationToken, attempt }) => {
        assert.equal(operationToken, 'stable-token');
        assert.equal(attempt, calls + 1);
        return { code: order[calls++], durationMs: 326_000 };
      },
      delay: async (ms) => delays.push(ms),
      retryDelayMs: () => 1_000
    });
    assert.equal(result.code, 'GATE_RETRY_EXHAUSTED');
    assert.equal(result.retriable, false);
    assert.equal(result.attempts, 3);
    assert.deepEqual(result.reasons, order);
    assert.deepEqual(delays, [1_000, 1_000]);
    assert.equal(result.elapsedMs, 980_000);
  }
  let calls = 0;
  const success = await runGateWithBoundedRetries({
    operationToken: 'success-token',
    acquire: async () => ({ code: calls++ === 2 ? 'SUCCESS' : 'LOCK_QUEUE_FULL', durationMs: 1 }),
    retryDelayMs: () => 1,
    delay: async () => {}
  });
  assert.equal(success.code, 'SUCCESS');
  assert.equal(success.attempts, 3);
});

test('broker durability row is 262 file plus four directory barriers in normative order', () => {
  assert.equal(brokerCowDurabilityMs(), 9_860);
  assert.equal(validateBrokerDurabilityTrace([
    'append-chain-event', 'fsync-event', 'fsync-head',
    'fsync-parent-directories', 'commit-broker-ack', 'return-ack'
  ]), true);
  assertProtocolCode(() => validateBrokerDurabilityTrace([
    'append-chain-event', 'commit-broker-ack', 'fsync-event',
    'fsync-head', 'fsync-parent-directories', 'return-ack'
  ]), 'INVALID_BROKER_DURABILITY_ORDER');
});

test('virtual genesis has byte-defined coverage and four domain-separated empty roots', () => {
  const genesis = virtualGenesis('store', 'project');
  assert.equal(genesis.checkpointId, 'VIRTUAL-GENESIS');
  assert.equal(genesis.coverageFirstSequence, 1);
  assert.equal(genesis.coverageTailSequence, 0);
  assert.equal(genesis.coverageTailRecordSequence, 0);
  assert.equal(genesis.coverageTailRecordSha256, EMPTY_RECORD_SHA256);
  const roots = [genesis.compactedLiveGenerationRoot, genesis.foldedSupersededGenerationRoot, genesis.usedDispatchIdsRoot, genesis.publicationArtifactBijectionRoot];
  assert.equal(new Set(roots).size, 4);
  roots.forEach((root) => assert.match(root, /^[0-9a-f]{64}$/));
});

test('validated admission refuses without mutating the caller state', () => {
  const state = initialCheckpointState({ genesisAuthoritySha256: HASH, headRecordSha256: HASH });
  const event = {
    eventType: 'claim',
    sequence: 1,
    previousRecordSha256: HASH,
    genesisAuthoritySha256: HASH,
    chargedJcsBytes: 1
  };
  const before = structuredClone(state);
  const result = admitEvent(state, event, {
    validateEventSchema: () => true,
    validateAuthority: () => true,
    expandMapKeys: () => ['key']
  });
  assert.equal(result.code, 'CHARGED_BYTES_MISMATCH');
  assert.deepEqual(state, before);
});
