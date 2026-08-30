import {
  assertAsciiId,
  assertCollectionOrder,
  assertRegistryId,
  assertTimestamp,
  hostAddress,
  hostCanonicalBytes
} from './kstack-host-contract.mjs';
import { HOST_ASSURANCE_LEVELS, HOST_OPERATION_CLASSES } from './kstack-host-request-context.mjs';

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value, code = 'KSTACK_REPLAY_OBJECT_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  return value;
}

function exact(value, keys, code = 'KSTACK_REPLAY_OBJECT_INVALID') {
  plain(value, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return value;
}

function digest(value, code = 'KSTACK_REPLAY_OBJECT_INVALID') {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(code);
  return value;
}

function nullableDigest(value, code) {
  if (value !== null) digest(value, code);
  return value;
}

function uint(value, positive = false, code = 'KSTACK_REPLAY_OBJECT_INVALID') {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > MAX_SAFE) fail(code);
  return value;
}

function decimal(value, code = 'KSTACK_TIME_SOURCE_UNAVAILABLE') {
  if (typeof value !== 'string' || !DECIMAL.test(value) || BigInt(value) > 18_446_744_073_709_551_615n) fail(code);
  return value;
}

function member(value, values, code = 'KSTACK_REPLAY_OBJECT_INVALID') {
  if (!values.includes(value)) fail(code);
  return value;
}

function time(value, code = 'KSTACK_TIME_SOURCE_UNAVAILABLE') {
  try { return assertTimestamp(value); } catch { fail(code); }
}

function nullableTime(value, code) {
  if (value !== null) time(value, code);
  return value;
}

function immutable(value) {
  if (value && typeof value === 'object') {
    if (Buffer.isBuffer(value)) return value;
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function same(left, right) {
  return hostCanonicalBytes(left).equals(hostCanonicalBytes(right));
}

function asciiOrder(left, right) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length - rightBytes.length || Buffer.compare(leftBytes, rightBytes);
}

export const REPLAY_TIME_STATUSES = Object.freeze([
  'TRUSTED', 'ROLLBACK_DETECTED', 'FORWARD_JUMP', 'SOURCE_UNAVAILABLE', 'CORRUPT'
]);

export const REPLAY_NONCE_STATES = Object.freeze(['RESERVED', 'BOUND', 'BURNED', 'EXPIRED']);

export const REPLAY_ATTEMPT_STATES = Object.freeze([
  'RESERVED', 'REQUEST_BOUND', 'ADMITTED', 'DENIED', 'CANCELLED_PRE_ACTION', 'PREPARED',
  'DISPATCH_STARTED', 'OUTCOME_KNOWN', 'OUTCOME_AMBIGUOUS', 'RECONCILING', 'CLOSED'
]);

export const REPLAY_REASON_CODES = Object.freeze([
  'KSTACK_REPLAY_NONCE_DUPLICATE', 'KSTACK_REPLAY_NONCE_BURNED', 'KSTACK_REPLAY_SCOPE_IN_FLIGHT',
  'KSTACK_REPLAY_RESULT_RECORDED', 'KSTACK_REPLAY_RECONCILIATION_REQUIRED', 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS',
  'KSTACK_REPLAY_EFFECT_SCOPE_INVALID', 'KSTACK_REPLAY_RETENTION_UNSAFE', 'KSTACK_REPLAY_LEDGER_UNAVAILABLE',
  'KSTACK_REPLAY_LEDGER_CORRUPT', 'KSTACK_TIME_SOURCE_UNAVAILABLE', 'KSTACK_TIME_ROLLBACK_DETECTED',
  'KSTACK_TIME_FORWARD_JUMP', 'KSTACK_TIME_OBJECT_EXPIRED', 'KSTACK_TIME_PROFILE_MISMATCH'
]);

export const REPLAY_IDENTITIES = immutable({
  TrustedTimeSourceProfileV1: { schemaId: 'kstack.trusted-time-source-profile.v1', domain: 'KSTACK-TRUSTED-TIME-SOURCE-PROFILE-V1' },
  TrustedTimeHighWaterV1: { schemaId: 'kstack.trusted-time-high-water.v1', domain: 'KSTACK-TRUSTED-TIME-HIGH-WATER-V1' },
  TrustedTimeSampleV1: { schemaId: 'kstack.trusted-time-sample.v1', domain: 'KSTACK-TRUSTED-TIME-SAMPLE-V1' },
  FreshnessPolicyV1: { schemaId: 'kstack.freshness-policy.v1', domain: 'KSTACK-FRESHNESS-POLICY-V1' },
  NonceReservationV1: { schemaId: 'kstack.nonce-reservation.v1', domain: 'KSTACK-NONCE-RESERVATION-V1' },
  EffectScopeV1: { schemaId: 'kstack.effect-scope.v1', domain: 'KSTACK-EFFECT-SCOPE-V1' },
  AttemptRecordV1: { schemaId: 'kstack.attempt-record.v1', domain: 'KSTACK-ATTEMPT-RECORD-V1' },
  AmbiguityRecordV1: { schemaId: 'kstack.ambiguity-record.v1', domain: 'KSTACK-AMBIGUITY-RECORD-V1' },
  ReconciliationPlanV1: { schemaId: 'kstack.reconciliation-plan.v1', domain: 'KSTACK-RECONCILIATION-PLAN-V1' },
  ReplayTombstoneV1: { schemaId: 'kstack.replay-tombstone.v1', domain: 'KSTACK-REPLAY-TOMBSTONE-V1' },
  ReplayLedgerCheckpointV1: { schemaId: 'kstack.replay-ledger-checkpoint.v1', domain: 'KSTACK-REPLAY-LEDGER-CHECKPOINT-V1' }
});

export function replayHead(name, schemaSetDigest) {
  const identity = REPLAY_IDENTITIES[name];
  if (!identity) fail('KSTACK_REPLAY_OBJECT_INVALID');
  return immutable({ schemaId: identity.schemaId, schemaVersion: 1, schemaSetDigest: digest(schemaSetDigest) });
}

function validateHead(name, value, fields) {
  const identity = REPLAY_IDENTITIES[name];
  if (!identity) fail('KSTACK_REPLAY_OBJECT_INVALID');
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', ...fields]);
  if (value.schemaId !== identity.schemaId || value.schemaVersion !== 1) fail('KSTACK_REPLAY_OBJECT_INVALID');
  digest(value.schemaSetDigest);
}

function addressed(name, value) {
  const copy = clone(value);
  hostCanonicalBytes(copy);
  const validator = REPLAY_VALIDATORS[name];
  if (!validator) fail('KSTACK_REPLAY_OBJECT_INVALID');
  validator(copy);
  return immutable({ value: copy, digest: hostAddress(REPLAY_IDENTITIES[name].domain, copy) });
}

export function validateReplayArtifact(name, value) {
  const artifact = addressed(name, value);
  return immutable({ canonicalBytes: hostCanonicalBytes(artifact.value), objectDigest: artifact.digest });
}

function validateTimeProfile(value) {
  const fields = [
    'profileId', 'implementationDigest', 'configurationDigest', 'wallClockSourceDigest', 'monotonicSourceDigest',
    'bootIdentitySourceDigest', 'highWaterStoreDigest', 'durabilityPrimitiveId', 'maximumForwardJumpMs', 'testVectorSetDigest'
  ];
  validateHead('TrustedTimeSourceProfileV1', value, fields);
  assertAsciiId(value.profileId);
  for (const field of fields.slice(1, 7)) digest(value[field], 'KSTACK_TIME_PROFILE_MISMATCH');
  assertRegistryId(value.durabilityPrimitiveId);
  uint(value.maximumForwardJumpMs, true, 'KSTACK_TIME_PROFILE_MISMATCH');
  digest(value.testVectorSetDigest, 'KSTACK_TIME_PROFILE_MISMATCH');
}

function validateHighWater(value) {
  const fields = [
    'sourceProfileDigest', 'sequence', 'acceptedWallUtc', 'bootIdentityDigest', 'monotonicNanoseconds',
    'previousHighWaterDigest', 'durabilityCheckpointDigest'
  ];
  validateHead('TrustedTimeHighWaterV1', value, fields);
  digest(value.sourceProfileDigest, 'KSTACK_TIME_PROFILE_MISMATCH');
  uint(value.sequence, true, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  time(value.acceptedWallUtc, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  digest(value.bootIdentityDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  decimal(value.monotonicNanoseconds, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  nullableDigest(value.previousHighWaterDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  digest(value.durabilityCheckpointDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  if ((value.sequence === 1) !== (value.previousHighWaterDigest === null)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
}

const TIME_REASON_BY_STATUS = Object.freeze({
  TRUSTED: null,
  ROLLBACK_DETECTED: 'KSTACK_TIME_ROLLBACK_DETECTED',
  FORWARD_JUMP: 'KSTACK_TIME_FORWARD_JUMP',
  SOURCE_UNAVAILABLE: 'KSTACK_TIME_SOURCE_UNAVAILABLE',
  CORRUPT: 'KSTACK_REPLAY_LEDGER_CORRUPT'
});

function validateTimeSample(value) {
  const fields = [
    'sourceProfileDigest', 'bootIdentityDigest', 'monotonicNanoseconds', 'wallUtc', 'persistedHighWaterUtc',
    'sequence', 'sampledAtMonotonicNanoseconds', 'status', 'reasonCode'
  ];
  validateHead('TrustedTimeSampleV1', value, fields);
  digest(value.sourceProfileDigest, 'KSTACK_TIME_PROFILE_MISMATCH');
  nullableDigest(value.bootIdentityDigest, 'KSTACK_TIME_SOURCE_UNAVAILABLE');
  if (value.monotonicNanoseconds !== null) decimal(value.monotonicNanoseconds);
  nullableTime(value.wallUtc, 'KSTACK_TIME_SOURCE_UNAVAILABLE');
  nullableTime(value.persistedHighWaterUtc, 'KSTACK_TIME_SOURCE_UNAVAILABLE');
  uint(value.sequence, false, 'KSTACK_TIME_SOURCE_UNAVAILABLE');
  if (value.sampledAtMonotonicNanoseconds !== null) decimal(value.sampledAtMonotonicNanoseconds);
  member(value.status, REPLAY_TIME_STATUSES, 'KSTACK_TIME_SOURCE_UNAVAILABLE');
  if (value.reasonCode !== TIME_REASON_BY_STATUS[value.status]) fail('KSTACK_TIME_SOURCE_UNAVAILABLE');
  if (value.status === 'TRUSTED' && [value.bootIdentityDigest, value.monotonicNanoseconds, value.wallUtc,
    value.persistedHighWaterUtc, value.sampledAtMonotonicNanoseconds].some((entry) => entry === null)) fail('KSTACK_TIME_SOURCE_UNAVAILABLE');
}

function validateFreshnessPolicy(value) {
  validateHead('FreshnessPolicyV1', value, ['policyId', 'activeSetDigest', 'rows']);
  assertAsciiId(value.policyId); digest(value.activeSetDigest);
  if (!Array.isArray(value.rows) || value.rows.length !== HOST_OPERATION_CLASSES.length) fail('KSTACK_TIME_PROFILE_MISMATCH');
  for (const row of value.rows) {
    exact(row, ['operationClassId', 'requestTtlMs', 'approvalTtlMs', 'reservationTtlMs', 'retentionFloorMs'], 'KSTACK_TIME_PROFILE_MISMATCH');
    member(row.operationClassId, HOST_OPERATION_CLASSES, 'KSTACK_TIME_PROFILE_MISMATCH');
    uint(row.requestTtlMs, true, 'KSTACK_TIME_PROFILE_MISMATCH');
    if (row.approvalTtlMs !== null) uint(row.approvalTtlMs, true, 'KSTACK_TIME_PROFILE_MISMATCH');
    uint(row.reservationTtlMs, true, 'KSTACK_TIME_PROFILE_MISMATCH');
    uint(row.retentionFloorMs, true, 'KSTACK_REPLAY_RETENTION_UNSAFE');
  }
  assertCollectionOrder(value.rows, { mode: 'SET_BY_FIELDS', keyFields: ['operationClassId'], keyKinds: ['ASCII'] });
  if (new Set(value.rows.map((row) => row.operationClassId)).size !== HOST_OPERATION_CLASSES.length) fail('KSTACK_TIME_PROFILE_MISMATCH');
}

function validateEffectScope(value) {
  const fields = [
    'principalDigest', 'repositoryContextDigest', 'worktreeIdentityDigest', 'operationId', 'operationSchemaDigest',
    'requirementProfileDigest', 'operationClassId', 'externalAudienceDigest', 'externalTargetDigest',
    'semanticEffectDigest', 'idempotencyScopeVersion'
  ];
  validateHead('EffectScopeV1', value, fields);
  nullableDigest(value.principalDigest, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
  for (const field of ['repositoryContextDigest', 'worktreeIdentityDigest', 'operationSchemaDigest', 'requirementProfileDigest', 'semanticEffectDigest']) digest(value[field], 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
  assertRegistryId(value.operationId);
  member(value.operationClassId, HOST_OPERATION_CLASSES, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
  nullableDigest(value.externalAudienceDigest, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
  nullableDigest(value.externalTargetDigest, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
  uint(value.idempotencyScopeVersion, true, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
}

function validateNonceReservation(value) {
  const fields = [
    'nonceDigest', 'contextDraftDigest', 'protectedSessionContextDigest', 'principalDigest', 'repositoryContextDigest',
    'operationSchemaDigest', 'requirementProfileDigest', 'issuedAt', 'expiresAt', 'trustedTimeSampleDigest',
    'reservationSequence', 'state', 'requestDigest'
  ];
  validateHead('NonceReservationV1', value, fields);
  for (const field of ['nonceDigest', 'contextDraftDigest', 'protectedSessionContextDigest', 'repositoryContextDigest',
    'operationSchemaDigest', 'requirementProfileDigest', 'trustedTimeSampleDigest']) digest(value[field]);
  nullableDigest(value.principalDigest, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
  time(value.issuedAt); time(value.expiresAt);
  if (value.issuedAt >= value.expiresAt) fail('KSTACK_TIME_OBJECT_EXPIRED');
  uint(value.reservationSequence, true, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  member(value.state, REPLAY_NONCE_STATES);
  nullableDigest(value.requestDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  if ((value.state === 'BOUND') !== (value.requestDigest !== null)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
}

const ATTEMPT_FIELDS = [
  'ledgerId', 'sequence', 'previousRecordDigest', 'attemptId', 'nonceReservationDigest', 'idempotencyKeyDigest',
  'effectScopeDigest', 'requestDigest', 'approvalSubjectDigest', 'authorityEnvelopeDigest', 'operationId',
  'operationClassId', 'principalDigest', 'repositoryContextDigest', 'activeSetDigest', 'policyDigest', 'state',
  'stateEvidenceDigest', 'providerAttemptDigest', 'providerReceiptDigest', 'localResultDigest', 'ambiguityDigest',
  'trustedTimeSampleDigest', 'recordedAt'
];

function validateAttempt(value) {
  validateHead('AttemptRecordV1', value, ATTEMPT_FIELDS);
  assertAsciiId(value.ledgerId); uint(value.sequence, true, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  nullableDigest(value.previousRecordDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  if ((value.sequence === 1) !== (value.previousRecordDigest === null)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  assertAsciiId(value.attemptId);
  for (const field of ['nonceReservationDigest', 'idempotencyKeyDigest', 'effectScopeDigest', 'repositoryContextDigest',
    'activeSetDigest', 'policyDigest', 'stateEvidenceDigest', 'trustedTimeSampleDigest']) digest(value[field]);
  for (const field of ['requestDigest', 'approvalSubjectDigest', 'authorityEnvelopeDigest', 'principalDigest',
    'providerAttemptDigest', 'providerReceiptDigest', 'localResultDigest', 'ambiguityDigest']) nullableDigest(value[field], 'KSTACK_REPLAY_LEDGER_CORRUPT');
  assertRegistryId(value.operationId); member(value.operationClassId, HOST_OPERATION_CLASSES);
  member(value.state, REPLAY_ATTEMPT_STATES); time(value.recordedAt);
  if (value.state === 'RESERVED' && value.requestDigest !== null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (value.state !== 'RESERVED' && value.requestDigest === null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (value.state === 'OUTCOME_AMBIGUOUS' && value.ambiguityDigest === null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
}

function validateAmbiguity(value) {
  validateHead('AmbiguityRecordV1', value, [
    'attemptId', 'effectScopeDigest', 'idempotencyKeyDigest', 'dispatchRecordDigest', 'observedEvidenceDigest',
    'reconciliationPlanDigest', 'firstObservedAt', 'lastObservedAt', 'retentionUntil'
  ]);
  assertAsciiId(value.attemptId);
  for (const field of ['effectScopeDigest', 'idempotencyKeyDigest', 'dispatchRecordDigest', 'observedEvidenceDigest']) digest(value[field]);
  nullableDigest(value.reconciliationPlanDigest, 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
  time(value.firstObservedAt); time(value.lastObservedAt); nullableTime(value.retentionUntil, 'KSTACK_REPLAY_RETENTION_UNSAFE');
  if (value.lastObservedAt < value.firstObservedAt || (value.retentionUntil !== null && value.retentionUntil <= value.lastObservedAt)) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
}

function validateReconciliationPlan(value) {
  validateHead('ReconciliationPlanV1', value, [
    'planId', 'operationId', 'requirementProfileDigest', 'providerQueryProtocolId', 'idempotencyScopeVersion',
    'receiptProfileDigest', 'maximumAttempts', 'deadlineMs', 'sameKeyCallMode', 'terminalMappings'
  ]);
  assertAsciiId(value.planId); assertRegistryId(value.operationId); digest(value.requirementProfileDigest);
  assertRegistryId(value.providerQueryProtocolId); uint(value.idempotencyScopeVersion, true); digest(value.receiptProfileDigest);
  uint(value.maximumAttempts, true); uint(value.deadlineMs, true);
  member(value.sameKeyCallMode, ['QUERY_ONLY', 'IDEMPOTENT_QUERY_OR_RETURN_EXISTING']);
  if (!Array.isArray(value.terminalMappings) || value.terminalMappings.length < 1 || value.terminalMappings.length > 32) fail('KSTACK_REPLAY_OBJECT_INVALID');
  for (const row of value.terminalMappings) {
    exact(row, ['providerStatusId', 'disposition']); assertRegistryId(row.providerStatusId);
    member(row.disposition, ['OUTCOME_KNOWN', 'OUTCOME_AMBIGUOUS']);
  }
  assertCollectionOrder(value.terminalMappings, { mode: 'SET_BY_FIELDS', keyFields: ['providerStatusId'], keyKinds: ['ASCII'] });
}

function validateTombstone(value) {
  validateHead('ReplayTombstoneV1', value, [
    'ledgerId', 'nonceDigest', 'idempotencyKeyDigest', 'requestDigest', 'effectScopeDigest', 'finalRecordDigest',
    'archivedObjectDigest', 'retentionUntil', 'createdAt'
  ]);
  assertAsciiId(value.ledgerId);
  for (const field of ['nonceDigest', 'idempotencyKeyDigest', 'requestDigest', 'effectScopeDigest', 'finalRecordDigest', 'archivedObjectDigest']) digest(value[field]);
  nullableTime(value.retentionUntil, 'KSTACK_REPLAY_RETENTION_UNSAFE'); time(value.createdAt);
  if (value.retentionUntil !== null && value.retentionUntil <= value.createdAt) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
}

function validateCheckpoint(value) {
  validateHead('ReplayLedgerCheckpointV1', value, [
    'ledgerId', 'committedSequence', 'headRecordDigest', 'nonceIndexDigest', 'scopeIndexDigest', 'requestIndexDigest',
    'attemptIndexDigest', 'highWaterSequence', 'durabilityPrimitiveId', 'committedAt'
  ]);
  assertAsciiId(value.ledgerId); uint(value.committedSequence, false, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  nullableDigest(value.headRecordDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  for (const field of ['nonceIndexDigest', 'scopeIndexDigest', 'requestIndexDigest', 'attemptIndexDigest']) digest(value[field], 'KSTACK_REPLAY_LEDGER_CORRUPT');
  uint(value.highWaterSequence, true, 'KSTACK_REPLAY_LEDGER_CORRUPT'); assertRegistryId(value.durabilityPrimitiveId); time(value.committedAt);
  if ((value.committedSequence === 0) !== (value.headRecordDigest === null)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
}

const REPLAY_VALIDATORS = Object.freeze({
  TrustedTimeSourceProfileV1: validateTimeProfile,
  TrustedTimeHighWaterV1: validateHighWater,
  TrustedTimeSampleV1: validateTimeSample,
  FreshnessPolicyV1: validateFreshnessPolicy,
  NonceReservationV1: validateNonceReservation,
  EffectScopeV1: validateEffectScope,
  AttemptRecordV1: validateAttempt,
  AmbiguityRecordV1: validateAmbiguity,
  ReconciliationPlanV1: validateReconciliationPlan,
  ReplayTombstoneV1: validateTombstone,
  ReplayLedgerCheckpointV1: validateCheckpoint
});

function requireFunction(value) {
  if (typeof value !== 'function') fail('KSTACK_TIME_SOURCE_UNAVAILABLE');
  return value;
}

function timeSampleValue(schemaSetDigest, profileDigest, status, observation = {}, highWater = null) {
  return {
    ...replayHead('TrustedTimeSampleV1', schemaSetDigest),
    sourceProfileDigest: profileDigest,
    bootIdentityDigest: observation.bootIdentityDigest ?? null,
    monotonicNanoseconds: observation.monotonicNanoseconds ?? null,
    wallUtc: observation.wallUtc ?? null,
    persistedHighWaterUtc: highWater?.value.acceptedWallUtc ?? null,
    sequence: highWater?.value.sequence ?? 0,
    sampledAtMonotonicNanoseconds: observation.sampledAtMonotonicNanoseconds ?? null,
    status,
    reasonCode: TIME_REASON_BY_STATUS[status]
  };
}

export class ProtectedTimeService {
  #schemaSetDigest;
  #profile;
  #profileDigest;
  #dependencies;
  #lastTrusted = null;
  #lastHighWater = null;

  constructor(options) {
    exact(options, ['schemaSetDigest', 'sourceProfile', 'dependencies'], 'KSTACK_TIME_PROFILE_MISMATCH');
    this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_TIME_PROFILE_MISMATCH');
    this.#profile = addressed('TrustedTimeSourceProfileV1', options.sourceProfile);
    if (this.#profile.value.schemaSetDigest !== this.#schemaSetDigest) fail('KSTACK_TIME_PROFILE_MISMATCH');
    this.#profileDigest = this.#profile.digest;
    const names = ['readHighWater', 'commitHighWater', 'readClock'];
    exact(options.dependencies, names, 'KSTACK_TIME_SOURCE_UNAVAILABLE');
    this.#dependencies = Object.freeze(Object.fromEntries(
      names.map((name) => [name, requireFunction(options.dependencies[name])])
    ));
  }

  get sourceProfileDigest() {
    return this.#profileDigest;
  }

  #status(status, observation = {}, highWater = null) {
    return addressed('TrustedTimeSampleV1', timeSampleValue(
      this.#schemaSetDigest, this.#profileDigest, status, observation, highWater
    ));
  }

  async sample() {
    let highWater;
    try {
      const loaded = await this.#dependencies.readHighWater(this.#profileDigest);
      if (loaded === null) return this.#status('SOURCE_UNAVAILABLE');
      highWater = addressed('TrustedTimeHighWaterV1', loaded);
      if (highWater.value.schemaSetDigest !== this.#schemaSetDigest
          || highWater.value.sourceProfileDigest !== this.#profileDigest) return this.#status('CORRUPT', {}, highWater);
      if (this.#lastHighWater
          && (highWater.value.sequence < this.#lastHighWater.sequence
            || (highWater.value.sequence === this.#lastHighWater.sequence && highWater.digest !== this.#lastHighWater.digest))) {
        return this.#status('CORRUPT', {}, highWater);
      }
    } catch {
      return this.#status('CORRUPT');
    }

    let observation;
    try {
      observation = clone(await this.#dependencies.readClock());
      exact(observation, ['bootIdentityDigest', 'monotonicNanoseconds', 'wallUtc', 'sampledAtMonotonicNanoseconds'], 'KSTACK_TIME_SOURCE_UNAVAILABLE');
      digest(observation.bootIdentityDigest, 'KSTACK_TIME_SOURCE_UNAVAILABLE');
      decimal(observation.monotonicNanoseconds); decimal(observation.sampledAtMonotonicNanoseconds);
      time(observation.wallUtc);
      if (BigInt(observation.sampledAtMonotonicNanoseconds) < BigInt(observation.monotonicNanoseconds)) fail('KSTACK_TIME_SOURCE_UNAVAILABLE');
      if (highWater.value.bootIdentityDigest === observation.bootIdentityDigest
          && BigInt(observation.monotonicNanoseconds) < BigInt(highWater.value.monotonicNanoseconds)) fail('KSTACK_TIME_SOURCE_UNAVAILABLE');
      if (this.#lastTrusted?.bootIdentityDigest === observation.bootIdentityDigest
          && BigInt(observation.monotonicNanoseconds) < BigInt(this.#lastTrusted.monotonicNanoseconds)) fail('KSTACK_TIME_SOURCE_UNAVAILABLE');
    } catch {
      return this.#status('SOURCE_UNAVAILABLE', {}, highWater);
    }

    const wallMs = Date.parse(observation.wallUtc);
    const highWaterMs = Date.parse(highWater.value.acceptedWallUtc);
    if (wallMs < highWaterMs) return this.#status('ROLLBACK_DETECTED', observation, highWater);
    if (wallMs - highWaterMs > this.#profile.value.maximumForwardJumpMs) return this.#status('FORWARD_JUMP', observation, highWater);

    const proposed = {
      ...replayHead('TrustedTimeHighWaterV1', this.#schemaSetDigest),
      sourceProfileDigest: this.#profileDigest,
      sequence: highWater.value.sequence + 1,
      acceptedWallUtc: observation.wallUtc,
      bootIdentityDigest: observation.bootIdentityDigest,
      monotonicNanoseconds: observation.monotonicNanoseconds,
      previousHighWaterDigest: highWater.digest
    };
    let committed;
    try {
      committed = addressed('TrustedTimeHighWaterV1', await this.#dependencies.commitHighWater(clone(proposed)));
    } catch {
      return this.#status('SOURCE_UNAVAILABLE', observation, highWater);
    }
    const { durabilityCheckpointDigest, ...committedEcho } = committed.value;
    if (!same(committedEcho, proposed) || !DIGEST.test(durabilityCheckpointDigest)) return this.#status('CORRUPT', observation, highWater);
    this.#lastTrusted = clone(observation);
    this.#lastHighWater = { sequence: committed.value.sequence, digest: committed.digest };
    return addressed('TrustedTimeSampleV1', {
      ...timeSampleValue(this.#schemaSetDigest, this.#profileDigest, 'TRUSTED', observation, committed),
      persistedHighWaterUtc: committed.value.acceptedWallUtc
    });
  }
}

export const DEFAULT_FRESHNESS_ROWS = immutable([
  ['LOCAL_READ', 900_000, null, 900_000, 86_400_000],
  ['ADVISORY', 900_000, null, 900_000, 86_400_000],
  ['LOCAL_WRITE', 300_000, null, 300_000, 2_592_000_000],
  ['ASK_SIDE_EFFECT', 120_000, 120_000, 120_000, 31_536_000_000],
  ['PRIVILEGED_SIDE_EFFECT', 120_000, 120_000, 120_000, 31_536_000_000],
  ['BACKGROUND', 300_000, null, 300_000, 2_592_000_000]
].map(([operationClassId, requestTtlMs, approvalTtlMs, reservationTtlMs, retentionFloorMs]) => ({
  operationClassId, requestTtlMs, approvalTtlMs, reservationTtlMs, retentionFloorMs
})).sort((left, right) => asciiOrder(left.operationClassId, right.operationClassId)));

export function deriveFreshnessWindow(options) {
  exact(options, ['sample', 'policy', 'operationClassId', 'requestedTtls', 'inputExpiries', 'approvalRequired']);
  const sample = addressed('TrustedTimeSampleV1', options.sample).value;
  if (sample.status !== 'TRUSTED' || sample.wallUtc === null) fail(sample.reasonCode || 'KSTACK_TIME_SOURCE_UNAVAILABLE');
  const policy = addressed('FreshnessPolicyV1', options.policy).value;
  member(options.operationClassId, HOST_OPERATION_CLASSES, 'KSTACK_TIME_PROFILE_MISMATCH');
  const rows = policy.rows.filter((row) => row.operationClassId === options.operationClassId);
  if (rows.length !== 1) fail('KSTACK_TIME_PROFILE_MISMATCH');
  const row = rows[0];
  exact(options.requestedTtls, ['requestTtlMs', 'approvalTtlMs', 'reservationTtlMs'], 'KSTACK_TIME_PROFILE_MISMATCH');
  for (const field of ['requestTtlMs', 'reservationTtlMs']) uint(options.requestedTtls[field], true, 'KSTACK_TIME_PROFILE_MISMATCH');
  if (options.requestedTtls.approvalTtlMs !== null) uint(options.requestedTtls.approvalTtlMs, true, 'KSTACK_TIME_PROFILE_MISMATCH');
  if (typeof options.approvalRequired !== 'boolean' || !Array.isArray(options.inputExpiries)
      || options.inputExpiries.length > 128) fail('KSTACK_TIME_PROFILE_MISMATCH');
  for (const expiry of options.inputExpiries) time(expiry, 'KSTACK_TIME_PROFILE_MISMATCH');
  const start = Date.parse(sample.wallUtc);
  const requestTtl = Math.min(row.requestTtlMs, options.requestedTtls.requestTtlMs);
  const reservationTtl = Math.min(row.reservationTtlMs, options.requestedTtls.reservationTtlMs);
  let approvalTtl = null;
  if (options.approvalRequired) {
    if (row.approvalTtlMs === null || options.requestedTtls.approvalTtlMs === null) fail('KSTACK_TIME_PROFILE_MISMATCH');
    approvalTtl = Math.min(row.approvalTtlMs, options.requestedTtls.approvalTtlMs);
  }
  const inputCaps = options.inputExpiries.map((expiry) => Date.parse(expiry));
  const cap = (ttl) => new Date(Math.min(start + ttl, ...inputCaps, Number.MAX_SAFE_INTEGER)).toISOString();
  return immutable({
    issuedAt: sample.wallUtc,
    requestExpiresAt: cap(requestTtl),
    approvalExpiresAt: approvalTtl === null ? null : cap(approvalTtl),
    reservationExpiresAt: cap(reservationTtl)
  });
}

export function assertTrustedFresh(sampleValue, expiresAt) {
  const sample = addressed('TrustedTimeSampleV1', sampleValue).value;
  time(expiresAt, 'KSTACK_TIME_OBJECT_EXPIRED');
  if (sample.status !== 'TRUSTED') fail(sample.reasonCode || 'KSTACK_TIME_SOURCE_UNAVAILABLE');
  if (sample.wallUtc >= expiresAt) fail('KSTACK_TIME_OBJECT_EXPIRED');
  return true;
}

export function evaluateTimeUse(options) {
  exact(options, [
    'sample', 'operationClassId', 'assuranceLevel', 'approvalRequired', 'authorityExpiresAt', 'evidenceExpiries'
  ], 'KSTACK_TIME_PROFILE_MISMATCH');
  const sample = addressed('TrustedTimeSampleV1', options.sample).value;
  member(options.operationClassId, HOST_OPERATION_CLASSES, 'KSTACK_TIME_PROFILE_MISMATCH');
  member(options.assuranceLevel, HOST_ASSURANCE_LEVELS, 'KSTACK_TIME_PROFILE_MISMATCH');
  if (typeof options.approvalRequired !== 'boolean' || !Array.isArray(options.evidenceExpiries)
      || options.evidenceExpiries.length > 128) fail('KSTACK_TIME_PROFILE_MISMATCH');
  nullableTime(options.authorityExpiresAt, 'KSTACK_TIME_PROFILE_MISMATCH');
  for (const expiry of options.evidenceExpiries) time(expiry, 'KSTACK_TIME_PROFILE_MISMATCH');
  if (sample.status === 'TRUSTED') return immutable({ admitted: true, mode: 'TRUSTED_TIME', diagnosticReasonCode: null });
  const explicitlyPublicNonexpiring = options.assuranceLevel === 'PUBLIC_UNAUTHENTICATED'
    && ['LOCAL_READ', 'ADVISORY'].includes(options.operationClassId)
    && options.approvalRequired === false
    && options.authorityExpiresAt === null
    && options.evidenceExpiries.length === 0;
  if (explicitlyPublicNonexpiring) return immutable({
    admitted: true, mode: 'PUBLIC_NONEXPIRING', diagnosticReasonCode: sample.reasonCode
  });
  fail(sample.reasonCode || 'KSTACK_TIME_SOURCE_UNAVAILABLE');
}

export function deriveReplayRetention(options) {
  exact(options, [
    'policy', 'operationClassId', 'recordedAt', 'providerReconciliationWindowMs', 'providerIdempotencyWindowMs',
    'receiptRetentionMs', 'ambiguityRetentionMs', 'requestedRetentionMs'
  ], 'KSTACK_REPLAY_RETENTION_UNSAFE');
  const policy = addressed('FreshnessPolicyV1', options.policy).value;
  member(options.operationClassId, HOST_OPERATION_CLASSES, 'KSTACK_REPLAY_RETENTION_UNSAFE');
  time(options.recordedAt, 'KSTACK_REPLAY_RETENTION_UNSAFE');
  for (const field of ['providerReconciliationWindowMs', 'providerIdempotencyWindowMs', 'receiptRetentionMs',
    'ambiguityRetentionMs', 'requestedRetentionMs']) uint(options[field], true, 'KSTACK_REPLAY_RETENTION_UNSAFE');
  const row = policy.rows.find((entry) => entry.operationClassId === options.operationClassId);
  if (!row) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
  const minimumRetentionMs = Math.max(
    row.retentionFloorMs,
    options.providerReconciliationWindowMs,
    options.providerIdempotencyWindowMs,
    options.receiptRetentionMs,
    options.ambiguityRetentionMs
  );
  if (options.requestedRetentionMs < minimumRetentionMs) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
  const retentionUntilMs = Date.parse(options.recordedAt) + options.requestedRetentionMs;
  if (!Number.isSafeInteger(retentionUntilMs) || Math.abs(retentionUntilMs) > 8_640_000_000_000_000) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
  return immutable({
    minimumRetentionMs,
    retentionUntil: new Date(retentionUntilMs).toISOString()
  });
}

export const REPLAY_TRANSITIONS = immutable({
  RESERVED: ['REQUEST_BOUND'],
  REQUEST_BOUND: ['ADMITTED'],
  ADMITTED: ['DENIED', 'CANCELLED_PRE_ACTION', 'PREPARED'],
  DENIED: ['CLOSED'],
  CANCELLED_PRE_ACTION: ['CLOSED'],
  PREPARED: ['CANCELLED_PRE_ACTION', 'DISPATCH_STARTED'],
  DISPATCH_STARTED: ['OUTCOME_KNOWN', 'OUTCOME_AMBIGUOUS'],
  OUTCOME_KNOWN: ['CLOSED'],
  OUTCOME_AMBIGUOUS: ['RECONCILING'],
  RECONCILING: ['OUTCOME_KNOWN', 'OUTCOME_AMBIGUOUS'],
  CLOSED: []
});

const ATTEMPT_IDENTITY_FIELDS = Object.freeze([
  'ledgerId', 'attemptId', 'idempotencyKeyDigest', 'effectScopeDigest', 'operationId', 'operationClassId',
  'principalDigest', 'repositoryContextDigest', 'activeSetDigest', 'policyDigest'
]);

export function validateAttemptTransition(previousValue, nextValue, ledgerPosition) {
  const previous = addressed('AttemptRecordV1', previousValue);
  const next = addressed('AttemptRecordV1', nextValue);
  exact(ledgerPosition, ['headRecordDigest', 'nextSequence'], 'KSTACK_REPLAY_LEDGER_CORRUPT');
  nullableDigest(ledgerPosition.headRecordDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  uint(ledgerPosition.nextSequence, true, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  if (next.value.sequence !== ledgerPosition.nextSequence
      || next.value.previousRecordDigest !== ledgerPosition.headRecordDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  for (const field of ATTEMPT_IDENTITY_FIELDS) {
    if (next.value[field] !== previous.value[field]) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  }
  if (!REPLAY_TRANSITIONS[previous.value.state].includes(next.value.state)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (previous.value.state !== 'RESERVED' && next.value.nonceReservationDigest !== previous.value.nonceReservationDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (previous.value.requestDigest !== null && next.value.requestDigest !== previous.value.requestDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (previous.value.approvalSubjectDigest !== null && next.value.approvalSubjectDigest !== previous.value.approvalSubjectDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (previous.value.authorityEnvelopeDigest !== null && next.value.authorityEnvelopeDigest !== previous.value.authorityEnvelopeDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  for (const field of ['providerAttemptDigest', 'providerReceiptDigest', 'localResultDigest']) {
    if (previous.value[field] !== null && next.value[field] !== previous.value[field]) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  }
  if (next.value.state === 'REQUEST_BOUND' && next.value.requestDigest === null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (next.value.state === 'OUTCOME_KNOWN' && next.value.providerReceiptDigest === null && next.value.localResultDigest === null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  if (next.value.state === 'OUTCOME_AMBIGUOUS' && next.value.ambiguityDigest === null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  return immutable({ previousDigest: previous.digest, nextDigest: next.digest });
}

export function replayDuplicateDisposition(state) {
  member(state, REPLAY_ATTEMPT_STATES, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  if (state === 'RESERVED') return 'KSTACK_REPLAY_NONCE_DUPLICATE';
  if (['REQUEST_BOUND', 'ADMITTED', 'PREPARED'].includes(state)) return 'KSTACK_REPLAY_SCOPE_IN_FLIGHT';
  if (state === 'DISPATCH_STARTED') return 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS';
  if (['OUTCOME_AMBIGUOUS', 'RECONCILING'].includes(state)) return 'KSTACK_REPLAY_RECONCILIATION_REQUIRED';
  return 'KSTACK_REPLAY_RESULT_RECORDED';
}

export function validateReplayLedgerSnapshot(value, schemaSetDigest) {
  exact(value, [
    'ledgerId', 'generation', 'checkpointDigest', 'effectScopes', 'reservations', 'records', 'ambiguities', 'tombstones'
  ], 'KSTACK_REPLAY_LEDGER_CORRUPT');
  assertAsciiId(value.ledgerId); uint(value.generation, false, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  nullableDigest(value.checkpointDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
  for (const field of ['effectScopes', 'reservations', 'records', 'ambiguities', 'tombstones']) {
    if (!Array.isArray(value[field]) || value[field].length > 100_000) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  }
  const scopes = new Map();
  for (const scopeValue of value.effectScopes) {
    const scope = addressed('EffectScopeV1', scopeValue);
    if (scope.value.schemaSetDigest !== schemaSetDigest || scopes.has(scope.digest)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    scopes.set(scope.digest, scope.value);
  }
  const reservations = new Map();
  for (const reservationValue of value.reservations) {
    const reservation = addressed('NonceReservationV1', reservationValue);
    if (reservation.value.schemaSetDigest !== schemaSetDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const versions = reservations.get(reservation.value.nonceDigest) || [];
    if (versions.some((entry) => entry.value.reservationSequence >= reservation.value.reservationSequence)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const previous = versions.at(-1);
    if (previous) {
      for (const field of ['contextDraftDigest', 'protectedSessionContextDigest', 'principalDigest', 'repositoryContextDigest',
        'operationSchemaDigest', 'requirementProfileDigest', 'issuedAt', 'expiresAt']) {
        if (reservation.value[field] !== previous.value[field]) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      }
      if (previous.value.state !== 'RESERVED' || !['BOUND', 'BURNED', 'EXPIRED'].includes(reservation.value.state)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    } else if (reservation.value.state !== 'RESERVED') fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    versions.push(reservation); reservations.set(reservation.value.nonceDigest, versions);
  }
  const ambiguityDigests = new Set();
  for (const ambiguityValue of value.ambiguities) {
    const ambiguity = addressed('AmbiguityRecordV1', ambiguityValue);
    if (ambiguity.value.schemaSetDigest !== schemaSetDigest || ambiguityDigests.has(ambiguity.digest)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    ambiguityDigests.add(ambiguity.digest);
  }
  const attempts = new Map();
  const referencedScopeDigests = new Set();
  const referencedReservationDigests = new Set();
  const referencedAmbiguityDigests = new Set();
  let headRecordDigest = null;
  for (let index = 0; index < value.records.length; index += 1) {
    const record = addressed('AttemptRecordV1', value.records[index]);
    if (record.value.schemaSetDigest !== schemaSetDigest || record.value.ledgerId !== value.ledgerId
        || record.value.sequence !== index + 1 || record.value.previousRecordDigest !== headRecordDigest
        || !scopes.has(record.value.effectScopeDigest)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    if (reservationsForDigest(reservations, record.value.nonceReservationDigest) === null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const previousAttempt = attempts.get(record.value.attemptId);
    if (previousAttempt) validateAttemptTransition(previousAttempt.value, record.value, {
      headRecordDigest,
      nextSequence: index + 1
    });
    else if (record.value.state !== 'RESERVED') fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    attempts.set(record.value.attemptId, record);
    referencedScopeDigests.add(record.value.effectScopeDigest);
    referencedReservationDigests.add(record.value.nonceReservationDigest);
    if (record.value.ambiguityDigest !== null) referencedAmbiguityDigests.add(record.value.ambiguityDigest);
    headRecordDigest = record.digest;
  }
  if ([...scopes.keys()].some((entry) => !referencedScopeDigests.has(entry))) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  for (const versions of reservations.values()) {
    if (!referencedReservationDigests.has(versions[0].digest)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const latest = versions.at(-1);
    if (latest.value.state === 'BOUND' && !referencedReservationDigests.has(latest.digest)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  }
  if ([...ambiguityDigests].some((entry) => !referencedAmbiguityDigests.has(entry))) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  const scopeAttempts = new Map();
  const requestAttempts = new Map();
  for (const record of attempts.values()) {
    const existing = scopeAttempts.get(record.value.idempotencyKeyDigest);
    if (existing && existing !== record.value.attemptId) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    scopeAttempts.set(record.value.idempotencyKeyDigest, record.value.attemptId);
    if (record.value.requestDigest !== null) {
      const requestAttempt = requestAttempts.get(record.value.requestDigest);
      if (requestAttempt && requestAttempt !== record.value.attemptId) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      requestAttempts.set(record.value.requestDigest, record.value.attemptId);
    }
    if (record.value.ambiguityDigest !== null && !ambiguityDigests.has(record.value.ambiguityDigest)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  }
  const tombstoneKeys = Object.fromEntries(
    ['nonceDigest', 'idempotencyKeyDigest', 'requestDigest', 'effectScopeDigest', 'finalRecordDigest'].map((field) => [field, new Set()])
  );
  for (const tombstoneValue of value.tombstones) {
    const tombstone = addressed('ReplayTombstoneV1', tombstoneValue);
    if (tombstone.value.schemaSetDigest !== schemaSetDigest || tombstone.value.ledgerId !== value.ledgerId) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    for (const [field, values] of Object.entries(tombstoneKeys)) {
      if (values.has(tombstone.value[field])) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      values.add(tombstone.value[field]);
    }
    const attempt = [...attempts.values()].find((entry) =>
      entry.value.idempotencyKeyDigest === tombstone.value.idempotencyKeyDigest
      || entry.value.effectScopeDigest === tombstone.value.effectScopeDigest
      || entry.value.requestDigest === tombstone.value.requestDigest
    );
    if (attempt) {
      const nonceDigest = reservationsForDigest(reservations, attempt.value.nonceReservationDigest);
      if (attempt.value.state !== 'CLOSED' || attempt.digest !== tombstone.value.finalRecordDigest
          || attempt.value.idempotencyKeyDigest !== tombstone.value.idempotencyKeyDigest
          || attempt.value.effectScopeDigest !== tombstone.value.effectScopeDigest
          || attempt.value.requestDigest !== tombstone.value.requestDigest
          || nonceDigest !== tombstone.value.nonceDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    }
  }
  if ((value.generation === 0) !== (value.checkpointDigest === null)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  return { scopes, reservations, attempts, headRecordDigest };
}

function reservationsForDigest(reservations, reservationDigest) {
  for (const [nonceDigest, versions] of reservations) {
    if (versions.some((entry) => entry.digest === reservationDigest)) return nonceDigest;
  }
  return null;
}

function idempotencyDigest(effectScopeDigest) {
  return hostAddress('KSTACK-IDEMPOTENCY-KEY-V1', { effectScopeDigest });
}

export class ProtectedReplayKernel {
  #schemaSetDigest;
  #ledgerId;
  #dependencies;

  constructor(options) {
    exact(options, ['schemaSetDigest', 'ledgerId', 'dependencies'], 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    assertAsciiId(options.ledgerId); this.#ledgerId = options.ledgerId;
    const names = ['readLedger', 'commitLedger', 'sampleTime', 'mintNonceDigest', 'mintAttemptId'];
    exact(options.dependencies, names, 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    this.#dependencies = Object.freeze(Object.fromEntries(
      names.map((name) => [name, requireFunction(options.dependencies[name])])
    ));
  }

  async #snapshot() {
    const value = clone(await this.#dependencies.readLedger(this.#ledgerId));
    const indexes = validateReplayLedgerSnapshot(value, this.#schemaSetDigest);
    if (value.ledgerId !== this.#ledgerId) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    return { value, indexes };
  }

  async #time() {
    const value = clone(await this.#dependencies.sampleTime());
    const sample = addressed('TrustedTimeSampleV1', value);
    if (sample.value.schemaSetDigest !== this.#schemaSetDigest || sample.value.status !== 'TRUSTED') {
      fail(sample.value.reasonCode || 'KSTACK_TIME_SOURCE_UNAVAILABLE');
    }
    return sample;
  }

  async reserve(input) {
    exact(input, [
      'contextDraftDigest', 'protectedSessionContextDigest', 'principalDigest', 'repositoryContextDigest',
      'operationId', 'operationSchemaDigest', 'requirementProfileDigest', 'operationClassId', 'effectScope',
      'expiresAt', 'activeSetDigest', 'policyDigest', 'stateEvidenceDigest'
    ], 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
    for (const field of ['contextDraftDigest', 'protectedSessionContextDigest', 'repositoryContextDigest',
      'operationSchemaDigest', 'requirementProfileDigest', 'activeSetDigest', 'policyDigest', 'stateEvidenceDigest']) {
      digest(input[field], 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
    }
    nullableDigest(input.principalDigest, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
    assertRegistryId(input.operationId);
    member(input.operationClassId, HOST_OPERATION_CLASSES, 'KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
    time(input.expiresAt, 'KSTACK_TIME_OBJECT_EXPIRED');
    const effectScope = addressed('EffectScopeV1', input.effectScope);
    if (effectScope.value.schemaSetDigest !== this.#schemaSetDigest
        || effectScope.value.principalDigest !== input.principalDigest
        || effectScope.value.repositoryContextDigest !== input.repositoryContextDigest
        || effectScope.value.operationId !== input.operationId
        || effectScope.value.operationSchemaDigest !== input.operationSchemaDigest
        || effectScope.value.requirementProfileDigest !== input.requirementProfileDigest
        || effectScope.value.operationClassId !== input.operationClassId) fail('KSTACK_REPLAY_EFFECT_SCOPE_INVALID');
    const keyDigest = idempotencyDigest(effectScope.digest);
    const sample = await this.#time();
    assertTrustedFresh(sample.value, input.expiresAt);
    let nonceDigest;
    let attemptId;
    try {
      nonceDigest = digest(await this.#dependencies.mintNonceDigest(), 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
      attemptId = await this.#dependencies.mintAttemptId();
      assertAsciiId(attemptId);
    } catch (error) {
      if (error?.code === 'KSTACK_REPLAY_LEDGER_UNAVAILABLE') throw error;
      fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    }

    return this.#reserveTransaction({ input, effectScope, keyDigest, sample, nonceDigest, attemptId });
  }

  async #reserveTransaction(values) {
    const { input, effectScope, keyDigest, sample, nonceDigest, attemptId } = values;
    for (let retry = 0; retry < 4; retry += 1) {
      const snapshot = await this.#snapshot();
      const existing = [...snapshot.indexes.attempts.values()].find(
        (entry) => entry.value.idempotencyKeyDigest === keyDigest
      );
      if (existing) return immutable({
        reserved: false,
        disposition: replayDuplicateDisposition(existing.value.state),
        attemptId: existing.value.attemptId,
        attemptRecordDigest: existing.digest,
        nonceDigest: null,
        idempotencyKeyDigest: keyDigest,
        effectScopeDigest: effectScope.digest
      });
      if (snapshot.value.tombstones.some((entry) => entry.idempotencyKeyDigest === keyDigest
          || entry.effectScopeDigest === effectScope.digest)) return immutable({
        reserved: false,
        disposition: 'KSTACK_REPLAY_RESULT_RECORDED',
        attemptId: null,
        attemptRecordDigest: null,
        nonceDigest: null,
        idempotencyKeyDigest: keyDigest,
        effectScopeDigest: effectScope.digest
      });
      if (snapshot.indexes.reservations.has(nonceDigest)
          || snapshot.value.tombstones.some((entry) => entry.nonceDigest === nonceDigest)) fail('KSTACK_REPLAY_NONCE_DUPLICATE');
      const reservation = this.#reservation(input, sample, nonceDigest, snapshot.value.reservations.length + 1);
      const record = this.#initialRecord(input, effectScope, keyDigest, sample, attemptId, reservation, snapshot);
      const committed = await this.#dependencies.commitLedger({
        ledgerId: this.#ledgerId,
        expectedGeneration: snapshot.value.generation,
        expectedCheckpointDigest: snapshot.value.checkpointDigest,
        effectScope: clone(effectScope.value),
        reservation: clone(reservation.value),
        record: clone(record.value),
        ambiguity: null,
        tombstone: null
      });
      if (committed === null) continue;
      validateReplayLedgerSnapshot(clone(committed), this.#schemaSetDigest);
      return immutable({
        reserved: true,
        disposition: null,
        attemptId,
        attemptRecordDigest: record.digest,
        nonceDigest,
        nonceReservationDigest: reservation.digest,
        idempotencyKeyDigest: keyDigest,
        effectScopeDigest: effectScope.digest,
        trustedTimeSampleDigest: sample.digest,
        expiresAt: input.expiresAt
      });
    }
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }

  #reservation(input, sample, nonceDigest, reservationSequence) {
    return addressed('NonceReservationV1', {
      ...replayHead('NonceReservationV1', this.#schemaSetDigest),
      nonceDigest,
      contextDraftDigest: input.contextDraftDigest,
      protectedSessionContextDigest: input.protectedSessionContextDigest,
      principalDigest: input.principalDigest,
      repositoryContextDigest: input.repositoryContextDigest,
      operationSchemaDigest: input.operationSchemaDigest,
      requirementProfileDigest: input.requirementProfileDigest,
      issuedAt: sample.value.wallUtc,
      expiresAt: input.expiresAt,
      trustedTimeSampleDigest: sample.digest,
      reservationSequence,
      state: 'RESERVED',
      requestDigest: null
    });
  }

  #initialRecord(input, effectScope, keyDigest, sample, attemptId, reservation, snapshot) {
    return addressed('AttemptRecordV1', {
      ...replayHead('AttemptRecordV1', this.#schemaSetDigest),
      ledgerId: this.#ledgerId,
      sequence: snapshot.value.records.length + 1,
      previousRecordDigest: snapshot.indexes.headRecordDigest,
      attemptId,
      nonceReservationDigest: reservation.digest,
      idempotencyKeyDigest: keyDigest,
      effectScopeDigest: effectScope.digest,
      requestDigest: null,
      approvalSubjectDigest: null,
      authorityEnvelopeDigest: null,
      operationId: input.operationId,
      operationClassId: input.operationClassId,
      principalDigest: input.principalDigest,
      repositoryContextDigest: input.repositoryContextDigest,
      activeSetDigest: input.activeSetDigest,
      policyDigest: input.policyDigest,
      state: 'RESERVED',
      stateEvidenceDigest: input.stateEvidenceDigest,
      providerAttemptDigest: null,
      providerReceiptDigest: null,
      localResultDigest: null,
      ambiguityDigest: null,
      trustedTimeSampleDigest: sample.digest,
      recordedAt: sample.value.wallUtc
    });
  }

  async bindRequest(input) {
    exact(input, [
      'nonceDigest', 'contextDraftDigest', 'protectedSessionContextDigest', 'principalDigest', 'repositoryContextDigest',
      'requestDigest', 'approvalSubjectDigest', 'authorityEnvelopeDigest', 'activeSetDigest', 'policyDigest',
      'stateEvidenceDigest'
    ], 'KSTACK_REPLAY_NONCE_DUPLICATE');
    for (const field of ['nonceDigest', 'contextDraftDigest', 'protectedSessionContextDigest', 'repositoryContextDigest',
      'requestDigest', 'activeSetDigest', 'policyDigest', 'stateEvidenceDigest']) digest(input[field], 'KSTACK_REPLAY_NONCE_DUPLICATE');
    nullableDigest(input.principalDigest, 'KSTACK_REPLAY_NONCE_DUPLICATE');
    nullableDigest(input.approvalSubjectDigest, 'KSTACK_REPLAY_NONCE_DUPLICATE');
    nullableDigest(input.authorityEnvelopeDigest, 'KSTACK_REPLAY_NONCE_DUPLICATE');
    if ((input.approvalSubjectDigest === null) !== (input.authorityEnvelopeDigest === null)) fail('KSTACK_REPLAY_NONCE_DUPLICATE');

    for (let retry = 0; retry < 4; retry += 1) {
      const sample = await this.#time();
      const snapshot = await this.#snapshot();
      const versions = snapshot.indexes.reservations.get(input.nonceDigest);
      if (!versions || versions.length === 0) {
        if (snapshot.value.tombstones.some((entry) => entry.nonceDigest === input.nonceDigest)) fail('KSTACK_REPLAY_NONCE_BURNED');
        fail('KSTACK_REPLAY_NONCE_DUPLICATE');
      }
      const reservation = versions.at(-1);
      if (reservation.value.state === 'BURNED' || reservation.value.state === 'EXPIRED') fail('KSTACK_REPLAY_NONCE_BURNED');
      if (reservation.value.state === 'BOUND') {
        if (reservation.value.requestDigest === input.requestDigest) return immutable({
          bound: false, disposition: 'KSTACK_REPLAY_RESULT_RECORDED', nonceDigest: input.nonceDigest,
          requestDigest: input.requestDigest
        });
        fail('KSTACK_REPLAY_NONCE_DUPLICATE');
      }
      if (sample.value.wallUtc >= reservation.value.expiresAt) {
        if (await this.#consumeReservation(snapshot, reservation, sample, 'EXPIRED')) fail('KSTACK_TIME_OBJECT_EXPIRED');
        continue;
      }
      if (reservation.value.contextDraftDigest !== input.contextDraftDigest
          || reservation.value.protectedSessionContextDigest !== input.protectedSessionContextDigest
          || reservation.value.principalDigest !== input.principalDigest
          || reservation.value.repositoryContextDigest !== input.repositoryContextDigest) {
        if (await this.#consumeReservation(snapshot, reservation, sample, 'BURNED')) fail('KSTACK_REPLAY_NONCE_DUPLICATE');
        continue;
      }
      const attempt = [...snapshot.indexes.attempts.values()].find(
        (entry) => entry.value.nonceReservationDigest === reservation.digest
      );
      if (!attempt || attempt.value.state !== 'RESERVED'
          || attempt.value.activeSetDigest !== input.activeSetDigest
          || attempt.value.policyDigest !== input.policyDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      const duplicateRequest = [...snapshot.indexes.attempts.values()].find(
        (entry) => entry.value.attemptId !== attempt.value.attemptId && entry.value.requestDigest === input.requestDigest
      );
      if (duplicateRequest) {
        if (await this.#consumeReservation(snapshot, reservation, sample, 'BURNED')) fail('KSTACK_REPLAY_NONCE_DUPLICATE');
        continue;
      }
      const boundReservation = addressed('NonceReservationV1', {
        ...clone(reservation.value),
        reservationSequence: snapshot.value.reservations.length + 1,
        state: 'BOUND',
        requestDigest: input.requestDigest,
        trustedTimeSampleDigest: sample.digest
      });
      const boundRecord = addressed('AttemptRecordV1', {
        ...clone(attempt.value),
        sequence: snapshot.value.records.length + 1,
        previousRecordDigest: snapshot.indexes.headRecordDigest,
        nonceReservationDigest: boundReservation.digest,
        requestDigest: input.requestDigest,
        approvalSubjectDigest: input.approvalSubjectDigest,
        authorityEnvelopeDigest: input.authorityEnvelopeDigest,
        state: 'REQUEST_BOUND',
        stateEvidenceDigest: input.stateEvidenceDigest,
        trustedTimeSampleDigest: sample.digest,
        recordedAt: sample.value.wallUtc
      });
      validateAttemptTransition(attempt.value, boundRecord.value, {
        headRecordDigest: snapshot.indexes.headRecordDigest,
        nextSequence: snapshot.value.records.length + 1
      });
      const committed = await this.#dependencies.commitLedger({
        ledgerId: this.#ledgerId,
        expectedGeneration: snapshot.value.generation,
        expectedCheckpointDigest: snapshot.value.checkpointDigest,
        effectScope: null,
        reservation: clone(boundReservation.value),
        record: clone(boundRecord.value),
        ambiguity: null,
        tombstone: null
      });
      if (committed === null) continue;
      validateReplayLedgerSnapshot(clone(committed), this.#schemaSetDigest);
      return immutable({
        bound: true,
        disposition: null,
        attemptId: attempt.value.attemptId,
        attemptRecordDigest: boundRecord.digest,
        nonceDigest: input.nonceDigest,
        nonceReservationDigest: boundReservation.digest,
        requestDigest: input.requestDigest,
        idempotencyKeyDigest: attempt.value.idempotencyKeyDigest
      });
    }
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }

  async #consumeReservation(snapshot, reservation, sample, state) {
    const consumed = addressed('NonceReservationV1', {
      ...clone(reservation.value),
      reservationSequence: snapshot.value.reservations.length + 1,
      state,
      requestDigest: null,
      trustedTimeSampleDigest: sample.digest
    });
    const committed = await this.#dependencies.commitLedger({
      ledgerId: this.#ledgerId,
      expectedGeneration: snapshot.value.generation,
      expectedCheckpointDigest: snapshot.value.checkpointDigest,
      effectScope: null,
      reservation: clone(consumed.value),
      record: null,
      ambiguity: null,
      tombstone: null
    });
    if (committed === null) return false;
    validateReplayLedgerSnapshot(clone(committed), this.#schemaSetDigest);
    return true;
  }

  async burnReservation(input) {
    exact(input, ['nonceDigest'], 'KSTACK_REPLAY_NONCE_DUPLICATE');
    digest(input.nonceDigest, 'KSTACK_REPLAY_NONCE_DUPLICATE');
    for (let retry = 0; retry < 4; retry += 1) {
      const sample = await this.#time();
      const snapshot = await this.#snapshot();
      const versions = snapshot.indexes.reservations.get(input.nonceDigest);
      if (!versions || versions.length === 0) {
        if (snapshot.value.tombstones.some((entry) => entry.nonceDigest === input.nonceDigest)) {
          return immutable({ burned: false, disposition: 'KSTACK_REPLAY_RESULT_RECORDED', nonceDigest: input.nonceDigest });
        }
        fail('KSTACK_REPLAY_NONCE_DUPLICATE');
      }
      const reservation = versions.at(-1);
      if (reservation.value.state === 'BURNED' || reservation.value.state === 'EXPIRED') {
        return immutable({ burned: false, disposition: 'KSTACK_REPLAY_NONCE_BURNED', nonceDigest: input.nonceDigest });
      }
      if (reservation.value.state === 'BOUND') {
        return immutable({ burned: false, disposition: 'KSTACK_REPLAY_RESULT_RECORDED', nonceDigest: input.nonceDigest });
      }
      if (await this.#consumeReservation(snapshot, reservation, sample, 'BURNED')) {
        return immutable({ burned: true, disposition: null, nonceDigest: input.nonceDigest });
      }
    }
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }

  async advance(input) {
    return this.#advance(input, false);
  }

  async #advance(input, allowReconciliation) {
    exact(input, [
      'attemptId', 'toState', 'stateEvidenceDigest', 'providerAttemptDigest', 'providerReceiptDigest',
      'localResultDigest', 'ambiguity'
    ], 'KSTACK_REPLAY_LEDGER_CORRUPT');
    assertAsciiId(input.attemptId); member(input.toState, REPLAY_ATTEMPT_STATES, 'KSTACK_REPLAY_LEDGER_CORRUPT');
    if (input.toState === 'RECONCILING' && !allowReconciliation) fail('KSTACK_REPLAY_RECONCILIATION_REQUIRED');
    digest(input.stateEvidenceDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
    for (const field of ['providerAttemptDigest', 'providerReceiptDigest', 'localResultDigest']) {
      nullableDigest(input[field], 'KSTACK_REPLAY_LEDGER_CORRUPT');
    }
    if (input.ambiguity !== null) {
      exact(input.ambiguity, ['observedEvidenceDigest', 'reconciliationPlanDigest', 'retentionUntil'], 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
      digest(input.ambiguity.observedEvidenceDigest, 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
      nullableDigest(input.ambiguity.reconciliationPlanDigest, 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
      if (input.ambiguity.retentionUntil !== null) time(input.ambiguity.retentionUntil, 'KSTACK_REPLAY_RETENTION_UNSAFE');
    }

    for (let retry = 0; retry < 4; retry += 1) {
      const sample = await this.#time();
      const snapshot = await this.#snapshot();
      const previous = snapshot.indexes.attempts.get(input.attemptId);
      if (!previous) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      if (previous.value.state === input.toState) return immutable({
        advanced: false,
        disposition: replayDuplicateDisposition(previous.value.state),
        attemptId: input.attemptId,
        attemptRecordDigest: previous.digest,
        state: previous.value.state
      });
      let ambiguity = null;
      if (input.toState === 'OUTCOME_AMBIGUOUS') {
        if (input.ambiguity === null) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
        const dispatchValue = [...snapshot.value.records].reverse().find(
          (entry) => entry.attemptId === input.attemptId && entry.state === 'DISPATCH_STARTED'
        );
        if (!dispatchValue) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
        const dispatch = addressed('AttemptRecordV1', dispatchValue);
        const priorAmbiguity = previous.value.ambiguityDigest === null ? null : snapshot.value.ambiguities.find(
          (entry) => validateReplayArtifact('AmbiguityRecordV1', entry).objectDigest === previous.value.ambiguityDigest
        );
        ambiguity = addressed('AmbiguityRecordV1', {
          ...replayHead('AmbiguityRecordV1', this.#schemaSetDigest),
          attemptId: input.attemptId,
          effectScopeDigest: previous.value.effectScopeDigest,
          idempotencyKeyDigest: previous.value.idempotencyKeyDigest,
          dispatchRecordDigest: dispatch.digest,
          observedEvidenceDigest: input.ambiguity.observedEvidenceDigest,
          reconciliationPlanDigest: input.ambiguity.reconciliationPlanDigest,
          firstObservedAt: priorAmbiguity?.firstObservedAt ?? sample.value.wallUtc,
          lastObservedAt: sample.value.wallUtc,
          retentionUntil: input.ambiguity.retentionUntil
        });
      } else if (input.ambiguity !== null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      const record = addressed('AttemptRecordV1', {
        ...clone(previous.value),
        sequence: snapshot.value.records.length + 1,
        previousRecordDigest: snapshot.indexes.headRecordDigest,
        state: input.toState,
        stateEvidenceDigest: input.stateEvidenceDigest,
        providerAttemptDigest: input.providerAttemptDigest ?? previous.value.providerAttemptDigest,
        providerReceiptDigest: input.providerReceiptDigest ?? previous.value.providerReceiptDigest,
        localResultDigest: input.localResultDigest ?? previous.value.localResultDigest,
        ambiguityDigest: ambiguity?.digest ?? previous.value.ambiguityDigest,
        trustedTimeSampleDigest: sample.digest,
        recordedAt: sample.value.wallUtc
      });
      validateAttemptTransition(previous.value, record.value, {
        headRecordDigest: snapshot.indexes.headRecordDigest,
        nextSequence: snapshot.value.records.length + 1
      });
      const committed = await this.#dependencies.commitLedger({
        ledgerId: this.#ledgerId,
        expectedGeneration: snapshot.value.generation,
        expectedCheckpointDigest: snapshot.value.checkpointDigest,
        effectScope: null,
        reservation: null,
        record: clone(record.value),
        ambiguity: ambiguity ? clone(ambiguity.value) : null,
        tombstone: null
      });
      if (committed === null) continue;
      validateReplayLedgerSnapshot(clone(committed), this.#schemaSetDigest);
      return immutable({
        advanced: true,
        disposition: null,
        attemptId: input.attemptId,
        attemptRecordDigest: record.digest,
        state: input.toState,
        ambiguityDigest: ambiguity?.digest ?? null
      });
    }
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }

  async beginReconciliation(input) {
    exact(input, ['attemptId', 'plan', 'stateEvidenceDigest'], 'KSTACK_REPLAY_RECONCILIATION_REQUIRED');
    assertAsciiId(input.attemptId);
    digest(input.stateEvidenceDigest, 'KSTACK_REPLAY_RECONCILIATION_REQUIRED');
    const plan = addressed('ReconciliationPlanV1', input.plan);
    if (plan.value.schemaSetDigest !== this.#schemaSetDigest) fail('KSTACK_REPLAY_RECONCILIATION_REQUIRED');
    const snapshot = await this.#snapshot();
    const current = snapshot.indexes.attempts.get(input.attemptId);
    if (!current || current.value.state !== 'OUTCOME_AMBIGUOUS' || current.value.ambiguityDigest === null) {
      fail('KSTACK_REPLAY_RECONCILIATION_REQUIRED');
    }
    const scopeValue = snapshot.value.effectScopes.find(
      (entry) => addressed('EffectScopeV1', entry).digest === current.value.effectScopeDigest
    );
    const ambiguityValue = snapshot.value.ambiguities.find(
      (entry) => addressed('AmbiguityRecordV1', entry).digest === current.value.ambiguityDigest
    );
    if (!scopeValue || !ambiguityValue) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const scope = addressed('EffectScopeV1', scopeValue);
    const ambiguity = addressed('AmbiguityRecordV1', ambiguityValue);
    if (plan.value.operationId !== current.value.operationId
        || plan.value.requirementProfileDigest !== scope.value.requirementProfileDigest
        || plan.value.idempotencyScopeVersion !== scope.value.idempotencyScopeVersion
        || ambiguity.value.reconciliationPlanDigest !== plan.digest) fail('KSTACK_REPLAY_RECONCILIATION_REQUIRED');
    const result = await this.#advance({
      attemptId: input.attemptId,
      toState: 'RECONCILING',
      stateEvidenceDigest: input.stateEvidenceDigest,
      providerAttemptDigest: current.value.providerAttemptDigest,
      providerReceiptDigest: null,
      localResultDigest: null,
      ambiguity: null
    }, true);
    return immutable({ ...clone(result), reconciliationPlanDigest: plan.digest });
  }

  async recordTombstone(input) {
    exact(input, ['attemptId', 'archivedObjectDigest', 'retentionUntil'], 'KSTACK_REPLAY_RETENTION_UNSAFE');
    assertAsciiId(input.attemptId);
    digest(input.archivedObjectDigest, 'KSTACK_REPLAY_RETENTION_UNSAFE');
    if (input.retentionUntil !== null) time(input.retentionUntil, 'KSTACK_REPLAY_RETENTION_UNSAFE');
    for (let retry = 0; retry < 4; retry += 1) {
      const sample = await this.#time();
      if (input.retentionUntil !== null && input.retentionUntil <= sample.value.wallUtc) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
      const snapshot = await this.#snapshot();
      const current = snapshot.indexes.attempts.get(input.attemptId);
      if (!current || current.value.state !== 'CLOSED' || current.value.requestDigest === null) fail('KSTACK_REPLAY_RETENTION_UNSAFE');
      const existing = snapshot.value.tombstones.find(
        (entry) => entry.finalRecordDigest === current.digest || entry.idempotencyKeyDigest === current.value.idempotencyKeyDigest
      );
      if (existing) return immutable({
        recorded: false,
        disposition: 'KSTACK_REPLAY_RESULT_RECORDED',
        tombstoneDigest: addressed('ReplayTombstoneV1', existing).digest
      });
      const nonceDigest = reservationsForDigest(snapshot.indexes.reservations, current.value.nonceReservationDigest);
      if (nonceDigest === null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      const tombstone = addressed('ReplayTombstoneV1', {
        ...replayHead('ReplayTombstoneV1', this.#schemaSetDigest),
        ledgerId: this.#ledgerId,
        nonceDigest,
        idempotencyKeyDigest: current.value.idempotencyKeyDigest,
        requestDigest: current.value.requestDigest,
        effectScopeDigest: current.value.effectScopeDigest,
        finalRecordDigest: current.digest,
        archivedObjectDigest: input.archivedObjectDigest,
        retentionUntil: input.retentionUntil,
        createdAt: sample.value.wallUtc
      });
      const committed = await this.#dependencies.commitLedger({
        ledgerId: this.#ledgerId,
        expectedGeneration: snapshot.value.generation,
        expectedCheckpointDigest: snapshot.value.checkpointDigest,
        effectScope: null,
        reservation: null,
        record: null,
        ambiguity: null,
        tombstone: clone(tombstone.value)
      });
      if (committed === null) continue;
      validateReplayLedgerSnapshot(clone(committed), this.#schemaSetDigest);
      return immutable({ recorded: true, disposition: null, tombstoneDigest: tombstone.digest });
    }
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }

  async recordInterruption(input) {
    exact(input, [
      'attemptId', 'stateEvidenceDigest', 'observedEvidenceDigest', 'reconciliationPlanDigest', 'retentionUntil'
    ], 'KSTACK_REPLAY_LEDGER_CORRUPT');
    assertAsciiId(input.attemptId); digest(input.stateEvidenceDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
    digest(input.observedEvidenceDigest, 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
    nullableDigest(input.reconciliationPlanDigest, 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
    if (input.retentionUntil !== null) time(input.retentionUntil, 'KSTACK_REPLAY_RETENTION_UNSAFE');
    const snapshot = await this.#snapshot();
    const current = snapshot.indexes.attempts.get(input.attemptId);
    if (!current) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    if (['ADMITTED', 'PREPARED'].includes(current.value.state)) return this.advance({
      attemptId: input.attemptId,
      toState: 'CANCELLED_PRE_ACTION',
      stateEvidenceDigest: input.stateEvidenceDigest,
      providerAttemptDigest: current.value.providerAttemptDigest,
      providerReceiptDigest: null,
      localResultDigest: null,
      ambiguity: null
    });
    if (current.value.state === 'DISPATCH_STARTED') return this.advance({
      attemptId: input.attemptId,
      toState: 'OUTCOME_AMBIGUOUS',
      stateEvidenceDigest: input.stateEvidenceDigest,
      providerAttemptDigest: current.value.providerAttemptDigest,
      providerReceiptDigest: null,
      localResultDigest: null,
      ambiguity: {
        observedEvidenceDigest: input.observedEvidenceDigest,
        reconciliationPlanDigest: input.reconciliationPlanDigest,
        retentionUntil: input.retentionUntil
      }
    });
    return immutable({
      advanced: false,
      disposition: replayDuplicateDisposition(current.value.state),
      attemptId: input.attemptId,
      attemptRecordDigest: current.digest,
      state: current.value.state
    });
  }

  async recover(input) {
    exact(input, ['stateEvidenceDigest', 'observedEvidenceDigest', 'reconciliationPlanDigest', 'retentionUntil'], 'KSTACK_REPLAY_LEDGER_CORRUPT');
    digest(input.stateEvidenceDigest, 'KSTACK_REPLAY_LEDGER_CORRUPT');
    digest(input.observedEvidenceDigest, 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
    nullableDigest(input.reconciliationPlanDigest, 'KSTACK_REPLAY_OUTCOME_AMBIGUOUS');
    if (input.retentionUntil !== null) time(input.retentionUntil, 'KSTACK_REPLAY_RETENTION_UNSAFE');
    const snapshot = await this.#snapshot();
    const dispatchStarted = [...snapshot.indexes.attempts.values()].filter(
      (entry) => entry.value.state === 'DISPATCH_STARTED'
    ).map((entry) => entry.value.attemptId);
    const prepared = [...snapshot.indexes.attempts.values()].filter(
      (entry) => entry.value.state === 'PREPARED'
    ).map((entry) => entry.value.attemptId).sort(asciiOrder);
    const ambiguous = [];
    for (const attemptId of dispatchStarted.sort(asciiOrder)) {
      const result = await this.recordInterruption({ attemptId, ...clone(input) });
      if (result.state === 'OUTCOME_AMBIGUOUS') ambiguous.push(attemptId);
    }
    return immutable({ prepared, ambiguous, recovered: ambiguous.length });
  }
}
