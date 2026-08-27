import crypto from 'node:crypto';

export const CHECKPOINT_CONSTANTS = Object.freeze({
  GATE_DEADLINE_MS: 326_000,
  GATE_REQUIRED_MARGIN_MS: 10_000,
  GATE_ACQUISITION_ATTEMPTS_MAX: 3,
  GATE_RETRY_DELAY_MAX_MS: 1_000,
  APPEND_FIFO_MAX_PARTICIPANTS: 3,
  APPEND_FIFO_MAX_GATES: 1,
  VERIFIER_LOCK_HOLD_MAX_MS: 62_000,
  WRITER_LOCK_HOLD_MAX_MS: 96_000,
  K_R: 128,
  K_B: 8_388_608,
  K_EVENT: 80,
  K_INTERVAL: 384,
  E_MAX: 1_048_576,
  L_MAX: 258,
  R_ROTATION_MAX: 2,
  R_REJECTION_SUCCESSOR_MAX: 2,
  RECOVERY_EVENT_JCS_MAX: 4_096,
  RECOVERY_ROTATION_EXACT_MAX: 2_709,
  RECOVERY_REJECTION_SUCCESSOR_EXACT_MAX: 2_508,
  VERIFIER_SET_CARDINALITY_MAX: 8,
  CHECKPOINT_HEADER_MAX: 65_536,
  CHECKPOINT_DELTA_MAX: 8_388_608,
  CHECKPOINT_RESERVE_BYTES: 16_777_216,
  VERIFIER_MIRROR_RESERVE_BYTES: 33_554_432,
  CANONICAL_PARSE_HASH_MIN_BYTES_PER_S: 1_048_576,
  SEQUENTIAL_HASH_MIN_BYTES_PER_S: 4_194_304,
  FILE_BARRIER_MAX_MS: 30,
  DIRECTORY_BARRIER_MAX_MS: 500,
  SELECTED_BYTES_MAX: 67_108_864,
  CHECKPOINT_PAGE_BYTES: 65_536,
  CHECKPOINT_PAGE_COUNT_MAX: 128,
  RECOVERY_TAIL_MAX_EVENTS: 262,
  RECOVERY_TAIL_MAX_BYTES: 20_004_864,
  ORDINARY_TAIL_MAX_BYTES: 19_988_480,
  ORDINARY_TAIL_MAP_KEY_CHARGE_MAX: 848,
  GATE_READ_ORDINARY_MAX_BYTES: 27_013_120,
  GATE_READ_MAX_BYTES: 27_029_504,
  COMPLETE_VERIFIER_TURN_FLOOR_MS: 61_319,
  GATE_AGGREGATE_RECOVERY_MS: 315_649,
  GATE_QUEUE_TURNAROUND_MS: 314_649,
  CALLER_VISIBLE_GATE_MAX_MS: 980_000,
  BROKER_COW_MAX_MS: 9_860
});

export const EMPTY_RECORD_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const SIGNATURE_PLACEHOLDER = 'A'.repeat(86);
export const SIGNING_DOMAIN = 'KSTACK-CHAIN-V2-SIGNED-EVENT';
export const SIGNING_SCHEMA_VERSION = 2;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;
const BASE64URL_86 = /^[A-Za-z0-9_-]{86}$/;
const CLOSED_CODE = /^[A-Z0-9_]{1,32}$/;
const MAX_SAFE_INTEGER = 9_007_199_254_740_991;

const CHECKPOINT_VERIFIED_FIELDS = Object.freeze([
  'schemaVersion', 'eventType', 'storeId', 'projectId', 'sequence',
  'previousRecordSha256', 'genesisAuthoritySha256', 'chargedJcsBytes',
  'checkpointId', 'checkpointEventSequence', 'checkpointEventSha256',
  'previousVerifiedCheckpointId', 'previousVerifiedReceiptSha256',
  'coverageFirstSequence', 'coverageTailSequence',
  'coverageTailRecordSequence', 'coverageTailRecordSha256',
  'coverageRecordCount', 'coverageChargedJcsBytes',
  'coverageDistinctMapKeys', 'compactedLiveGenerationRoot',
  'foldedSupersededGenerationRoot', 'usedDispatchIdsRoot',
  'publicationArtifactBijectionRoot', 'deltaPageManifestSha256',
  'deltaPageCount', 'deltaPageBytes', 'rawPruneManifestRoot',
  'writerStateSha256', 'verifierSetId', 'verifierSetDigest',
  'verifierVersion', 'signerKeyId', 'verifierSignature'
]);

export { CHECKPOINT_VERIFIED_FIELDS };

const SIGNATURE_FIELDS = Object.freeze(['algorithm', 'keyId', 'signatureBase64Url']);
const VERIFIER_KEY_FIELDS = Object.freeze(['algorithm', 'publicKeyBase64Url', 'verifierKeyId']);
const REBINDING_FIELDS = Object.freeze([
  'candidateCheckpointId', 'candidateEventSequence', 'candidateEventSha256',
  'oldVerifierSetId', 'oldVerifierSetDigest', 'newVerifierSetId',
  'newVerifierSetDigest'
]);
const SUCCESSOR_FIELDS = Object.freeze([
  'checkpointEventSequence', 'checkpointId', 'compactedLiveGenerationRoot',
  'coverageChargedJcsBytes', 'coverageDistinctMapKeys',
  'coverageFirstSequence', 'coverageRecordCount',
  'coverageTailRecordSequence', 'coverageTailRecordSha256',
  'coverageTailSequence', 'deltaPageManifestSha256',
  'foldedSupersededGenerationRoot', 'previousVerifiedCheckpointId',
  'previousVerifiedReceiptSha256', 'publicationArtifactBijectionRoot',
  'usedDispatchIdsRoot', 'verifierSetDigest', 'verifierSetId',
  'writerStateSha256'
]);
const ROTATION_REQUIRED_FIELDS = Object.freeze([
  'chargedJcsBytes', 'eventType', 'genesisAuthoritySha256', 'newVerifierKeys',
  'newVerifierSetDigest', 'newVerifierSetId', 'nonceBase64Url',
  'oldVerifierSetDigest', 'oldVerifierSetId', 'operatorRootSignature',
  'previousRecordSha256', 'reasonCode', 'schemaVersion', 'sequence',
  'setGeneration', 'signerKeyId', 'threshold'
]);
const REJECTION_REQUIRED_FIELDS = Object.freeze([
  'chargedJcsBytes', 'eventType', 'evidenceSha256',
  'genesisAuthoritySha256', 'previousRecordSha256',
  'rejectedCheckpointEventSequence', 'rejectedCheckpointEventSha256',
  'rejectedCheckpointId', 'rejectionReasonCode', 'schemaVersion', 'sequence',
  'signerKeyId', 'successorCheckpoint', 'verifierSetDigest', 'verifierSetId',
  'verifierSignature'
]);

const CHAIN_NATIVE_TYPES = new Set([
  'prune', 'checkpoint', 'checkpoint-verified', 'verifier-set-update',
  'checkpoint-rejection-successor'
]);
const RECOVERY_TYPES = new Set(['verifier-set-update', 'checkpoint-rejection-successor']);

export const EVENT_FANOUT_MAXIMA = Object.freeze({
  claim: 5,
  supersede: 7,
  terminal: 6,
  prune: 0,
  'corruption-override': 7,
  'member-published': 5,
  'attempt-published': 5,
  'recovery-published': 5,
  'decision-read-published': 5,
  'ready-published': 5,
  'phase-entry-published': 5,
  'gate-input-published': 5,
  'reservation-published': 6,
  'prompt-published': 5,
  'spawn-occurred': 5,
  checkpoint: 0,
  'checkpoint-verified': 0,
  'verifier-set-update': 0,
  'checkpoint-rejection-successor': 0,
  'namespace-migration-resolution': 64
});

export class ProtocolError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProtocolError(code, message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertUnicodeScalarString(value, label) {
  if (typeof value !== 'string') fail('INVALID_SCHEMA', `${label} must be a string`);
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('INVALID_UNICODE', `${label} contains an unpaired surrogate`);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      fail('INVALID_UNICODE', `${label} contains an unpaired surrogate`);
    }
  }
}

function canonicalValue(value, path = '$') {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assertUnicodeScalarString(value, path);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) fail('INVALID_JCS_NUMBER', `${path} must be a safe integer`);
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map((item, index) => canonicalValue(item, `${path}[${index}]`)).join(',')}]`;
  if (!isPlainObject(value)) fail('INVALID_JCS_VALUE', `${path} is not a JSON value`);
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => {
    assertUnicodeScalarString(key, `${path} key`);
    if (value[key] === undefined) fail('INVALID_JCS_VALUE', `${path}.${key} is undefined`);
    return `${JSON.stringify(key)}:${canonicalValue(value[key], `${path}.${key}`)}`;
  }).join(',')}}`;
}

export function jcs(value) {
  return canonicalValue(value);
}

export function jcsBytes(value) {
  return Buffer.from(jcs(value), 'utf8');
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assertExactKeys(value, required, optional = [], label = 'object') {
  if (!isPlainObject(value)) fail('INVALID_SCHEMA', `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  const extra = actual.filter((key) => !allowed.has(key));
  if (missing.length || extra.length) {
    fail('INVALID_SCHEMA', `${label} exact keys failed; missing=${missing.join(',') || '-'} extra=${extra.join(',') || '-'}`);
  }
}

function assertSafeInteger(value, label, maximum = MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) fail('INVALID_SCHEMA', `${label} must be a nonnegative safe integer <= ${maximum}`);
}

function assertUuid(value, label, { allowVirtual = false } = {}) {
  if (allowVirtual && value === 'VIRTUAL-GENESIS') return;
  if (!UUID_V4.test(value)) fail('INVALID_SCHEMA', `${label} must be a lowercase RFC-4122 UUIDv4`);
}

function assertHash(value, label) {
  if (!SHA256_HEX.test(value)) fail('INVALID_SCHEMA', `${label} must be a lowercase SHA-256 hex digest`);
}

function assertKeyId(value, label) {
  assertUuid(value, label);
}

function assertSignatureObject(signature, label) {
  assertExactKeys(signature, SIGNATURE_FIELDS, [], label);
  if (signature.algorithm !== 'Ed25519') fail('INVALID_SIGNATURE_ALGORITHM', `${label}.algorithm must be Ed25519`);
  assertKeyId(signature.keyId, `${label}.keyId`);
  if (!BASE64URL_86.test(signature.signatureBase64Url)) fail('INVALID_SIGNATURE_LENGTH', `${label}.signatureBase64Url must be 86 unpadded base64url bytes`);
  let decoded;
  try { decoded = Buffer.from(signature.signatureBase64Url, 'base64url'); } catch { fail('INVALID_SIGNATURE', `${label} is not base64url`); }
  if (decoded.length !== 64) fail('INVALID_SIGNATURE_LENGTH', `${label} must decode to 64 bytes`);
}

function assertVerifierKey(key, label) {
  assertExactKeys(key, VERIFIER_KEY_FIELDS, [], label);
  if (key.algorithm !== 'Ed25519') fail('INVALID_SCHEMA', `${label}.algorithm must be Ed25519`);
  if (!BASE64URL_43.test(key.publicKeyBase64Url)) fail('INVALID_SCHEMA', `${label}.publicKeyBase64Url must contain 43 base64url bytes`);
  assertKeyId(key.verifierKeyId, `${label}.verifierKeyId`);
}

function assertCoverageFields(value, prefix = '') {
  const get = (name) => value[`${prefix}${name}`];
  for (const name of ['FirstSequence', 'TailSequence', 'TailRecordSequence', 'RecordCount', 'ChargedJcsBytes', 'DistinctMapKeys']) {
    assertSafeInteger(get(name), `${prefix}${name}`);
  }
  assertHash(get('TailRecordSha256'), `${prefix}TailRecordSha256`);
  const recordCount = get('RecordCount');
  const recordSequence = get('TailRecordSequence');
  const recordHash = get('TailRecordSha256');
  const zeroTuple = recordSequence === 0 && recordHash === EMPTY_RECORD_SHA256;
  if ((recordCount === 0) !== zeroTuple) fail('INVALID_COVERAGE', 'coverage zero-record biconditional failed');
  if (recordCount > 0) {
    if (recordSequence < get('FirstSequence') || recordSequence > get('TailSequence')) {
      fail('INVALID_COVERAGE', 'coverage tail record sequence is outside coverage');
    }
  }
  if (get('TailSequence') > 0 && get('FirstSequence') < 1) fail('INVALID_COVERAGE', 'positive coverage must start at sequence >= 1');
  if (get('TailSequence') < get('FirstSequence') && get('TailSequence') !== 0) fail('INVALID_COVERAGE', 'coverage tail precedes first sequence');
}

export function signingProjection(event, signatureMember) {
  if (!isPlainObject(event) || !isPlainObject(event[signatureMember])) fail('INVALID_SCHEMA', `missing ${signatureMember}`);
  if (!Object.hasOwn(event[signatureMember], 'signatureBase64Url')) fail('INVALID_SCHEMA', `${signatureMember}.signatureBase64Url is required`);
  const unsignedEvent = structuredClone(event);
  delete unsignedEvent[signatureMember].signatureBase64Url;
  return {
    signingDomain: SIGNING_DOMAIN,
    signingSchemaVersion: SIGNING_SCHEMA_VERSION,
    eventType: event.eventType,
    unsignedEvent
  };
}

export function signingPreimage(event, signatureMember) {
  return jcsBytes(signingProjection(event, signatureMember));
}

export function stabilizeChargedJcsBytes(event, signatureMember) {
  if (!isPlainObject(event) || !isPlainObject(event[signatureMember])) fail('INVALID_SCHEMA', `missing ${signatureMember}`);
  if (Buffer.byteLength(SIGNATURE_PLACEHOLDER, 'utf8') !== 86) fail('INTERNAL_ERROR', 'invalid signature placeholder');
  if (event[signatureMember].signatureBase64Url !== SIGNATURE_PLACEHOLDER) fail('INVALID_SIGNATURE_PLACEHOLDER', 'signing input must use the exact 86-A placeholder');
  let x = 0;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const candidate = structuredClone(event);
    candidate.chargedJcsBytes = x;
    candidate[signatureMember].signatureBase64Url = SIGNATURE_PLACEHOLDER;
    const y = jcsBytes(candidate).length;
    if (y === x) return candidate;
    if (y < x) fail('SIGNED_LENGTH_DID_NOT_CONVERGE', 'signed length decreased');
    x = y;
  }
  fail('SIGNED_LENGTH_DID_NOT_CONVERGE', 'signed length did not converge in eight iterations');
}

export function signEvent(event, signatureMember, privateKey) {
  const stable = stabilizeChargedJcsBytes(event, signatureMember);
  const signature = crypto.sign(null, signingPreimage(stable, signatureMember), privateKey).toString('base64url');
  if (signature.length !== 86) fail('INVALID_SIGNATURE_LENGTH', 'Ed25519 signature was not 86 base64url bytes');
  stable[signatureMember].signatureBase64Url = signature;
  if (jcsBytes(stable).length !== stable.chargedJcsBytes) fail('SIGNED_LENGTH_DID_NOT_CONVERGE', 'signed event length changed after signing');
  return stable;
}

export function verifySignedEvent(event, { signatureMember, authorityKeys, expectedSignerKeyId } = {}) {
  assertSignatureObject(event?.[signatureMember], signatureMember);
  assertKeyId(event?.signerKeyId, 'signerKeyId');
  if (event[signatureMember].keyId !== event.signerKeyId) fail('SIGNER_KEY_ID_MISMATCH', 'nested signature keyId must equal signed signerKeyId');
  if (expectedSignerKeyId !== undefined && event.signerKeyId !== expectedSignerKeyId) fail('UNAUTHORIZED_SIGNER', 'signerKeyId is not the required authority');
  const publicKey = authorityKeys instanceof Map ? authorityKeys.get(event.signerKeyId) : authorityKeys?.[event.signerKeyId];
  if (!publicKey) fail('UNAUTHORIZED_SIGNER', 'signerKeyId is not in the chain-bound authority set');
  if (jcsBytes(event).length !== event.chargedJcsBytes) fail('CHARGED_BYTES_MISMATCH', 'chargedJcsBytes does not equal exact event bytes');
  const signature = Buffer.from(event[signatureMember].signatureBase64Url, 'base64url');
  if (!crypto.verify(null, signingPreimage(event, signatureMember), publicKey, signature)) fail('INVALID_SIGNATURE', 'Ed25519 verification failed');
  return true;
}

function assertCommonSignedFields(event, expectedType) {
  if (event.eventType !== expectedType || event.schemaVersion !== 2) fail('INVALID_SCHEMA', `expected signed v2 ${expectedType}`);
  assertSafeInteger(event.sequence, 'sequence');
  assertHash(event.previousRecordSha256, 'previousRecordSha256');
  assertHash(event.genesisAuthoritySha256, 'genesisAuthoritySha256');
  assertSafeInteger(event.chargedJcsBytes, 'chargedJcsBytes', CHECKPOINT_CONSTANTS.E_MAX);
  assertKeyId(event.signerKeyId, 'signerKeyId');
}

function assertRebinding(rebinding) {
  assertExactKeys(rebinding, REBINDING_FIELDS, [], 'candidateAuthorityRebinding');
  assertUuid(rebinding.candidateCheckpointId, 'candidateCheckpointId');
  assertSafeInteger(rebinding.candidateEventSequence, 'candidateEventSequence');
  assertHash(rebinding.candidateEventSha256, 'candidateEventSha256');
  for (const field of ['oldVerifierSetId', 'newVerifierSetId']) assertUuid(rebinding[field], field);
  for (const field of ['oldVerifierSetDigest', 'newVerifierSetDigest']) assertHash(rebinding[field], field);
}

export function validateVerifierSetUpdate(event) {
  const optional = Object.hasOwn(event, 'candidateAuthorityRebinding') ? ['candidateAuthorityRebinding'] : [];
  assertExactKeys(event, ROTATION_REQUIRED_FIELDS, optional, 'verifier-set-update');
  assertCommonSignedFields(event, 'verifier-set-update');
  for (const field of ['oldVerifierSetId', 'newVerifierSetId']) assertUuid(event[field], field);
  for (const field of ['oldVerifierSetDigest', 'newVerifierSetDigest']) assertHash(event[field], field);
  assertSafeInteger(event.setGeneration, 'setGeneration');
  if (!Array.isArray(event.newVerifierKeys) || event.newVerifierKeys.length < 1 || event.newVerifierKeys.length > CHECKPOINT_CONSTANTS.VERIFIER_SET_CARDINALITY_MAX) fail('INVALID_VERIFIER_SET', 'new verifier set must contain 1-8 keys');
  event.newVerifierKeys.forEach((key, index) => assertVerifierKey(key, `newVerifierKeys[${index}]`));
  if (new Set(event.newVerifierKeys.map((key) => key.verifierKeyId)).size !== event.newVerifierKeys.length) fail('INVALID_VERIFIER_SET', 'verifier key IDs must be unique');
  if (event.threshold !== 1) fail('INVALID_VERIFIER_SET', 'v2 threshold must be exactly 1');
  if (!CLOSED_CODE.test(event.reasonCode)) fail('INVALID_SCHEMA', 'reasonCode is outside the closed alphabet');
  if (!BASE64URL_43.test(event.nonceBase64Url)) fail('INVALID_SCHEMA', 'nonceBase64Url must contain 43 base64url bytes');
  if (event.candidateAuthorityRebinding) assertRebinding(event.candidateAuthorityRebinding);
  assertSignatureObject(event.operatorRootSignature, 'operatorRootSignature');
  if (event.chargedJcsBytes > CHECKPOINT_CONSTANTS.RECOVERY_ROTATION_EXACT_MAX) fail('RECOVERY_EVENT_TOO_LARGE', 'rotation exceeds its exact schema maximum');
  if (event.chargedJcsBytes > CHECKPOINT_CONSTANTS.RECOVERY_EVENT_JCS_MAX) fail('RECOVERY_EVENT_TOO_LARGE', 'rotation exceeds recovery envelope');
  return true;
}

function assertSuccessor(successor) {
  assertExactKeys(successor, SUCCESSOR_FIELDS, [], 'successorCheckpoint');
  assertUuid(successor.checkpointId, 'successorCheckpoint.checkpointId');
  for (const field of ['checkpointEventSequence', 'coverageChargedJcsBytes', 'coverageDistinctMapKeys', 'coverageFirstSequence', 'coverageRecordCount', 'coverageTailRecordSequence', 'coverageTailSequence']) assertSafeInteger(successor[field], `successorCheckpoint.${field}`);
  for (const field of ['compactedLiveGenerationRoot', 'coverageTailRecordSha256', 'deltaPageManifestSha256', 'foldedSupersededGenerationRoot', 'previousVerifiedReceiptSha256', 'publicationArtifactBijectionRoot', 'usedDispatchIdsRoot', 'verifierSetDigest', 'writerStateSha256']) assertHash(successor[field], `successorCheckpoint.${field}`);
  assertUuid(successor.previousVerifiedCheckpointId, 'successorCheckpoint.previousVerifiedCheckpointId', { allowVirtual: true });
  assertUuid(successor.verifierSetId, 'successorCheckpoint.verifierSetId');
  assertCoverageFields(successor, 'coverage');
  if (successor.coverageRecordCount > 262 || successor.coverageChargedJcsBytes > 20_004_864 || successor.coverageDistinctMapKeys > 848) fail('INVALID_COVERAGE', 'recovery successor coverage exceeds the closed tail maxima');
}

export function validateCheckpointRejectionSuccessor(event) {
  const rebindingSequence = Object.hasOwn(event, 'candidateRebindingEventSequence');
  const rebindingHash = Object.hasOwn(event, 'candidateRebindingEventSha256');
  if (rebindingSequence !== rebindingHash) fail('INVALID_SCHEMA', 'candidate rebinding fields must appear together');
  const optional = rebindingSequence ? ['candidateRebindingEventSequence', 'candidateRebindingEventSha256'] : [];
  assertExactKeys(event, REJECTION_REQUIRED_FIELDS, optional, 'checkpoint-rejection-successor');
  assertCommonSignedFields(event, 'checkpoint-rejection-successor');
  assertUuid(event.rejectedCheckpointId, 'rejectedCheckpointId');
  assertSafeInteger(event.rejectedCheckpointEventSequence, 'rejectedCheckpointEventSequence');
  assertHash(event.rejectedCheckpointEventSha256, 'rejectedCheckpointEventSha256');
  if (rebindingSequence) {
    assertSafeInteger(event.candidateRebindingEventSequence, 'candidateRebindingEventSequence');
    assertHash(event.candidateRebindingEventSha256, 'candidateRebindingEventSha256');
  }
  if (!CLOSED_CODE.test(event.rejectionReasonCode)) fail('INVALID_SCHEMA', 'rejectionReasonCode is outside the closed alphabet');
  assertHash(event.evidenceSha256, 'evidenceSha256');
  assertUuid(event.verifierSetId, 'verifierSetId');
  assertHash(event.verifierSetDigest, 'verifierSetDigest');
  assertSuccessor(event.successorCheckpoint);
  assertSignatureObject(event.verifierSignature, 'verifierSignature');
  if (event.chargedJcsBytes > CHECKPOINT_CONSTANTS.RECOVERY_REJECTION_SUCCESSOR_EXACT_MAX) fail('RECOVERY_EVENT_TOO_LARGE', 'rejection-successor exceeds its exact schema maximum');
  if (event.chargedJcsBytes > CHECKPOINT_CONSTANTS.RECOVERY_EVENT_JCS_MAX) fail('RECOVERY_EVENT_TOO_LARGE', 'rejection-successor exceeds recovery envelope');
  return true;
}

export function validateCheckpointVerified(event, { candidate, previousVerified, verifierAuthorityKeys, mirrorReceiptBytes } = {}) {
  assertExactKeys(event, CHECKPOINT_VERIFIED_FIELDS, [], 'checkpoint-verified');
  assertCommonSignedFields(event, 'checkpoint-verified');
  if (typeof event.storeId !== 'string' || !event.storeId || typeof event.projectId !== 'string' || !event.projectId) fail('INVALID_SCHEMA', 'storeId and projectId are required');
  assertUuid(event.checkpointId, 'checkpointId');
  assertSafeInteger(event.checkpointEventSequence, 'checkpointEventSequence');
  assertHash(event.checkpointEventSha256, 'checkpointEventSha256');
  assertUuid(event.previousVerifiedCheckpointId, 'previousVerifiedCheckpointId', { allowVirtual: true });
  assertHash(event.previousVerifiedReceiptSha256, 'previousVerifiedReceiptSha256');
  assertCoverageFields(event, 'coverage');
  for (const field of ['compactedLiveGenerationRoot', 'foldedSupersededGenerationRoot', 'usedDispatchIdsRoot', 'publicationArtifactBijectionRoot', 'deltaPageManifestSha256', 'rawPruneManifestRoot', 'writerStateSha256', 'verifierSetDigest']) assertHash(event[field], field);
  assertSafeInteger(event.deltaPageCount, 'deltaPageCount', CHECKPOINT_CONSTANTS.CHECKPOINT_PAGE_COUNT_MAX);
  assertSafeInteger(event.deltaPageBytes, 'deltaPageBytes', CHECKPOINT_CONSTANTS.CHECKPOINT_DELTA_MAX);
  if (event.deltaPageBytes !== event.deltaPageCount * CHECKPOINT_CONSTANTS.CHECKPOINT_PAGE_BYTES) fail('INVALID_DELTA_ENVELOPE', 'deltaPageBytes must equal deltaPageCount*65,536');
  assertUuid(event.verifierSetId, 'verifierSetId');
  if (typeof event.verifierVersion !== 'string' || !event.verifierVersion) fail('INVALID_SCHEMA', 'verifierVersion is required');
  assertSignatureObject(event.verifierSignature, 'verifierSignature');

  if (!candidate) fail('INVALID_DISPOSITION', 'exactly one SEALED candidate is required');
  const candidatePairs = [
    ['checkpointId', 'checkpointId'],
    ['eventSequence', 'checkpointEventSequence'],
    ['eventSha256', 'checkpointEventSha256'],
    ['coverageFirstSequence', 'coverageFirstSequence'],
    ['coverageTailSequence', 'coverageTailSequence'],
    ['coverageTailRecordSequence', 'coverageTailRecordSequence'],
    ['coverageTailRecordSha256', 'coverageTailRecordSha256'],
    ['coverageRecordCount', 'coverageRecordCount'],
    ['coverageChargedJcsBytes', 'coverageChargedJcsBytes'],
    ['coverageDistinctMapKeys', 'coverageDistinctMapKeys'],
    ['compactedLiveGenerationRoot', 'compactedLiveGenerationRoot'],
    ['foldedSupersededGenerationRoot', 'foldedSupersededGenerationRoot'],
    ['usedDispatchIdsRoot', 'usedDispatchIdsRoot'],
    ['publicationArtifactBijectionRoot', 'publicationArtifactBijectionRoot'],
    ['deltaPageManifestSha256', 'deltaPageManifestSha256'],
    ['deltaPageCount', 'deltaPageCount'],
    ['deltaPageBytes', 'deltaPageBytes'],
    ['rawPruneManifestRoot', 'rawPruneManifestRoot'],
    ['writerStateSha256', 'writerStateSha256']
  ];
  for (const [candidateKey, eventKey] of candidatePairs) if (candidate[candidateKey] !== event[eventKey]) fail('INVALID_DISPOSITION', `${eventKey} does not match SEALED candidate`);
  const authority = candidate.rebinding ?? candidate;
  if (event.verifierSetId !== authority.verifierSetId || event.verifierSetDigest !== authority.verifierSetDigest) fail('INVALID_DISPOSITION', 'receipt set does not match candidate authority/rebinding');
  if (previousVerified) {
    if (event.previousVerifiedCheckpointId !== previousVerified.checkpointId || event.previousVerifiedReceiptSha256 !== previousVerified.receiptSha256) fail('INVALID_DISPOSITION', 'previous VERIFIED receipt chain mismatch');
  }
  verifySignedEvent(event, { signatureMember: 'verifierSignature', authorityKeys: verifierAuthorityKeys });
  if (mirrorReceiptBytes !== undefined && !Buffer.from(mirrorReceiptBytes).equals(jcsBytes(event))) fail('MIRROR_RECEIPT_MISMATCH', 'mirror receipt must be byte-identical to the chain event');
  return true;
}

export function computeVerifierSetDigest(verifierSet) {
  return sha256Hex(jcsBytes(verifierSet));
}

export function emptySparseMerkleRoot(domain) {
  assertUnicodeScalarString(domain, 'domain');
  let current = sha256Hex(Buffer.from(`KSTACK-SMT-V2\0${domain}\0EMPTY-LEAF`, 'utf8'));
  for (let depth = 255; depth >= 0; depth -= 1) current = sha256Hex(Buffer.from(`KSTACK-SMT-V2\0${domain}\0${depth}\0${current}\0${current}`, 'utf8'));
  return current;
}

export function virtualGenesis(storeId, projectId) {
  return Object.freeze({
    checkpointId: 'VIRTUAL-GENESIS',
    sequence: 0,
    storeId,
    projectId,
    coverageFirstSequence: 1,
    coverageTailSequence: 0,
    coverageTailRecordSequence: 0,
    coverageRecordCount: 0,
    coverageChargedJcsBytes: 0,
    coverageDistinctMapKeys: 0,
    coverageTailRecordSha256: EMPTY_RECORD_SHA256,
    compactedLiveGenerationRoot: emptySparseMerkleRoot('compacted-live-generation'),
    foldedSupersededGenerationRoot: emptySparseMerkleRoot('folded-superseded-generation'),
    usedDispatchIdsRoot: emptySparseMerkleRoot('used-dispatch-ids'),
    publicationArtifactBijectionRoot: emptySparseMerkleRoot('publication-artifact-bijection')
  });
}

export function validateGenesis(genesis) {
  const required = ['schemaVersion', 'eventType', 'storeId', 'projectId', 'operatorRootPublicKey', 'writerIdentityId', 'verifierSetId', 'verifierSetGeneration', 'verifierKeys', 'threshold', 'nonceBase64Url'];
  assertExactKeys(genesis, required, [], 'genesis');
  if (genesis.schemaVersion !== 2 || genesis.eventType !== 'genesis') fail('INVALID_GENESIS', 'genesis must be schema v2');
  assertExactKeys(genesis.operatorRootPublicKey, ['algorithm', 'keyId', 'publicKeyBase64Url'], [], 'operatorRootPublicKey');
  if (genesis.operatorRootPublicKey.algorithm !== 'Ed25519' || !BASE64URL_43.test(genesis.operatorRootPublicKey.publicKeyBase64Url)) fail('INVALID_GENESIS', 'invalid operator root key');
  assertKeyId(genesis.operatorRootPublicKey.keyId, 'operatorRootPublicKey.keyId');
  assertKeyId(genesis.writerIdentityId, 'writerIdentityId');
  assertUuid(genesis.verifierSetId, 'verifierSetId');
  assertSafeInteger(genesis.verifierSetGeneration, 'verifierSetGeneration');
  if (!Array.isArray(genesis.verifierKeys) || genesis.verifierKeys.length < 1 || genesis.verifierKeys.length > 8) fail('INVALID_GENESIS', 'genesis verifier set must contain 1-8 members');
  genesis.verifierKeys.forEach((key, index) => assertVerifierKey(key, `verifierKeys[${index}]`));
  if (genesis.threshold !== 1 || !BASE64URL_43.test(genesis.nonceBase64Url)) fail('INVALID_GENESIS', 'invalid threshold or nonce');
  const identities = [genesis.operatorRootPublicKey.keyId, genesis.writerIdentityId, ...genesis.verifierKeys.map((key) => key.verifierKeyId)];
  if (new Set(identities).size !== identities.length) fail('INVALID_GENESIS', 'operator, writer, and verifier identities must be pairwise distinct');
  return sha256Hex(jcsBytes(genesis));
}

export function intervalAfterAppend(interval, { chargedJcsBytes, mapKeys = [] }) {
  assertSafeInteger(chargedJcsBytes, 'chargedJcsBytes', CHECKPOINT_CONSTANTS.E_MAX);
  if (!Array.isArray(mapKeys) || mapKeys.some((key) => typeof key !== 'string')) fail('INVALID_MAP_KEYS', 'mapKeys must be strings');
  if (new Set(mapKeys).size > CHECKPOINT_CONSTANTS.K_EVENT) fail('EVENT_KEY_FANOUT_EXCEEDED', 'event exceeds K_event');
  const current = interval ?? { physicalEventCount: 0, chargedJcsBytes: 0, distinctMapKeys: [] };
  const distinct = new Set(current.distinctMapKeys ?? []);
  for (const key of mapKeys) distinct.add(key);
  if (current.physicalEventCount > 0 && distinct.size > CHECKPOINT_CONSTANTS.K_INTERVAL) {
    return {
      closedPrevious: true,
      next: { physicalEventCount: 1, chargedJcsBytes, distinctMapKeys: [...new Set(mapKeys)].sort(), intervalClosed: false }
    };
  }
  const next = {
    physicalEventCount: current.physicalEventCount + 1,
    chargedJcsBytes: current.chargedJcsBytes + chargedJcsBytes,
    distinctMapKeys: [...distinct].sort()
  };
  next.intervalClosed = next.physicalEventCount === CHECKPOINT_CONSTANTS.K_R || next.chargedJcsBytes >= CHECKPOINT_CONSTANTS.K_B || next.distinctMapKeys.length >= CHECKPOINT_CONSTANTS.K_INTERVAL;
  return { closedPrevious: false, next };
}

export function validateEventFanout(eventType, mapKeys, { migrationSourceCount } = {}) {
  if (!Array.isArray(mapKeys)) fail('INVALID_MAP_KEYS', 'mapKeys must be an array');
  const count = new Set(mapKeys).size;
  if (count > CHECKPOINT_CONSTANTS.K_EVENT) fail('EVENT_KEY_FANOUT_EXCEEDED', 'event exceeds K_event');
  if (!Object.hasOwn(EVENT_FANOUT_MAXIMA, eventType)) fail('INVALID_EVENT_TYPE', `unknown event type ${eventType}`);
  let schemaMaximum = EVENT_FANOUT_MAXIMA[eventType];
  if (eventType === 'namespace-migration-resolution') {
    assertSafeInteger(migrationSourceCount, 'migrationSourceCount', 32);
    schemaMaximum = 2 * migrationSourceCount;
  }
  if (count > schemaMaximum) fail('EVENT_KEY_FANOUT_EXCEEDED', `${eventType} exceeds its closed fanout inventory`);
  if (CHAIN_NATIVE_TYPES.has(eventType) && count !== 0) fail('INVALID_MAP_KEYS', `${eventType} is chain-native and touches no compact-map keys`);
  return count;
}

function mapKeyChargeForAppend(interval, mapKeys) {
  const eventKeys = new Set(mapKeys);
  const currentKeys = new Set(interval?.distinctMapKeys ?? []);
  const combinedKeys = new Set([...currentKeys, ...eventKeys]);
  if ((interval?.physicalEventCount ?? 0) > 0 && combinedKeys.size > CHECKPOINT_CONSTANTS.K_INTERVAL) return eventKeys.size;
  let charge = 0;
  for (const key of eventKeys) if (!currentKeys.has(key)) charge += 1;
  return charge;
}

function tailEventSummary(event, mapKeys, mapKeyCharge) {
  return {
    sequence: event.sequence,
    eventType: event.eventType,
    chargedJcsBytes: event.chargedJcsBytes,
    mapKeys: [...new Set(mapKeys)].sort(),
    mapKeyCharge
  };
}

function summarizeTailEvents(tailEvents) {
  let chargedJcsBytes = 0;
  let mapKeyCharge = 0;
  for (const summary of tailEvents) {
    chargedJcsBytes += summary.chargedJcsBytes;
    mapKeyCharge += summary.mapKeyCharge;
  }
  return { chargedJcsBytes, mapKeyCharge };
}

function setTailEvents(state, tailEvents) {
  const accounting = summarizeTailEvents(tailEvents);
  state.tailEvents = tailEvents;
  state.tailChargedJcsBytes = accounting.chargedJcsBytes;
  state.tailMapKeyCharge = accounting.mapKeyCharge;
  return accounting;
}

function projectedTailAccounting(state, event, mapKeys, mapKeyCharge, coverageTailSequence) {
  let tailEvents = [...state.tailEvents, tailEventSummary(event, mapKeys, mapKeyCharge)];
  if (coverageTailSequence !== undefined) tailEvents = tailEvents.filter((summary) => summary.sequence > coverageTailSequence);
  return { tailEvents, ...summarizeTailEvents(tailEvents) };
}

function tailLimitRefusal(accounting, bytesMaximum) {
  if (accounting.chargedJcsBytes > bytesMaximum) {
    return refusal('TAIL_BYTES_EXCEEDED', `projected tail exceeds ${bytesMaximum} charged JCS bytes`);
  }
  if (accounting.mapKeyCharge > CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAP_KEY_CHARGE_MAX) {
    return refusal('TAIL_KEYS_EXCEEDED', `projected tail exceeds ${CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAP_KEY_CHARGE_MAX} compact-map proof-key charges`);
  }
  return null;
}

export function initialCheckpointState(overrides = {}) {
  const state = {
    headSequence: 0,
    headRecordSha256: overrides.genesisAuthoritySha256 ?? EMPTY_RECORD_SHA256,
    genesisAuthoritySha256: overrides.genesisAuthoritySha256 ?? EMPTY_RECORD_SHA256,
    lastVerifiedCoverageTailSequence: 0,
    sealedCandidate: null,
    aboveBoundaryRotationCount: 0,
    aboveBoundaryRejectionSuccessorCount: 0,
    sealRequired: false,
    interval: { physicalEventCount: 0, chargedJcsBytes: 0, distinctMapKeys: [], intervalClosed: false },
    tailEvents: [],
    tailChargedJcsBytes: 0,
    tailMapKeyCharge: 0,
    ...structuredClone(overrides)
  };
  if (Object.hasOwn(overrides, 'tailEvents')) setTailEvents(state, structuredClone(overrides.tailEvents));
  return state;
}

export function assertReplayState(state) {
  for (const field of ['headSequence', 'lastVerifiedCoverageTailSequence', 'aboveBoundaryRotationCount', 'aboveBoundaryRejectionSuccessorCount']) assertSafeInteger(state[field], field);
  if (state.lastVerifiedCoverageTailSequence > state.headSequence) fail('INVALID_REPLAY_STATE', 'VERIFIED coverage is newer than head');
  const lag = state.headSequence - state.lastVerifiedCoverageTailSequence;
  const candidateCount = state.sealedCandidate ? 1 : 0;
  if (candidateCount === 0 && lag >= 256 && lag <= 262) fail('INVALID_REPLAY_STATE', 'zero-SEALED boundary state is unreachable');
  if (state.aboveBoundaryRotationCount > 2 || state.aboveBoundaryRejectionSuccessorCount > 2) fail('INVALID_REPLAY_STATE', 'recovery counter exceeds envelope');
  if (!Array.isArray(state.tailEvents)) fail('INVALID_REPLAY_STATE', 'tail accounting must contain replay-derived event summaries');
  let previousTailSequence = state.lastVerifiedCoverageTailSequence;
  let replayInterval = { physicalEventCount: 0, chargedJcsBytes: 0, distinctMapKeys: [], intervalClosed: false };
  for (const summary of state.tailEvents) {
    assertExactKeys(summary, ['sequence', 'eventType', 'chargedJcsBytes', 'mapKeys', 'mapKeyCharge'], [], 'tail event summary');
    assertSafeInteger(summary.sequence, 'tail event sequence');
    if (typeof summary.eventType !== 'string' || !summary.eventType) fail('INVALID_REPLAY_STATE', 'tail event summary eventType is required');
    assertSafeInteger(summary.chargedJcsBytes, 'tail event chargedJcsBytes', CHECKPOINT_CONSTANTS.E_MAX);
    if (summary.sequence !== previousTailSequence + 1 || summary.sequence > state.headSequence) fail('INVALID_REPLAY_STATE', 'tail event summaries must contiguously cover the post-coverage suffix');
    if (!Array.isArray(summary.mapKeys) || summary.mapKeys.some((key) => typeof key !== 'string') || new Set(summary.mapKeys).size !== summary.mapKeys.length) fail('INVALID_REPLAY_STATE', 'tail event map keys must be a distinct string array');
    assertSafeInteger(summary.mapKeyCharge, 'tail event mapKeyCharge', summary.mapKeys.length);
    if (summary.mapKeyCharge !== mapKeyChargeForAppend(replayInterval, summary.mapKeys)) fail('INVALID_REPLAY_STATE', 'tail event map-key charge does not match interval replay');
    replayInterval = intervalAfterAppend(replayInterval, { chargedJcsBytes: summary.chargedJcsBytes, mapKeys: summary.mapKeys }).next;
    if (summary.eventType === 'checkpoint' || summary.eventType === 'checkpoint-rejection-successor') replayInterval = intervalAfterAppend(null, { chargedJcsBytes: summary.chargedJcsBytes, mapKeys: [] }).next;
    previousTailSequence = summary.sequence;
  }
  if (previousTailSequence !== state.headSequence) fail('INVALID_REPLAY_STATE', 'tail event summaries do not reach the physical head');
  const tailAccounting = summarizeTailEvents(state.tailEvents);
  if (state.tailChargedJcsBytes !== tailAccounting.chargedJcsBytes || state.tailMapKeyCharge !== tailAccounting.mapKeyCharge) fail('INVALID_REPLAY_STATE', 'tail accounting cache does not match replay summaries');
  const tailBytesMaximum = lag > CHECKPOINT_CONSTANTS.L_MAX ? CHECKPOINT_CONSTANTS.RECOVERY_TAIL_MAX_BYTES : CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAX_BYTES;
  if (tailAccounting.chargedJcsBytes > tailBytesMaximum || tailAccounting.mapKeyCharge > CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAP_KEY_CHARGE_MAX) fail('INVALID_REPLAY_STATE', 'tail accounting exceeds the closed byte/key envelope');
  if (lag <= CHECKPOINT_CONSTANTS.L_MAX && (state.aboveBoundaryRotationCount !== 0 || state.aboveBoundaryRejectionSuccessorCount !== 0)) fail('INVALID_REPLAY_STATE', 'low-lag state cannot carry above-boundary quota');
  if (lag > CHECKPOINT_CONSTANTS.L_MAX) {
    if (!state.sealedCandidate) fail('INVALID_REPLAY_STATE', 'above-boundary state requires one SEALED candidate');
    if (lag > CHECKPOINT_CONSTANTS.RECOVERY_TAIL_MAX_EVENTS) fail('INVALID_REPLAY_STATE', 'lag exceeds recovery envelope');
    if (state.aboveBoundaryRotationCount + state.aboveBoundaryRejectionSuccessorCount !== lag - CHECKPOINT_CONSTANTS.L_MAX) fail('INVALID_REPLAY_STATE', 'lag and recovery counters are inconsistent');
  }
  return true;
}

function rejectionCandidate(event) {
  const successor = event.successorCheckpoint ?? {};
  return {
    checkpointId: successor.checkpointId,
    eventSequence: successor.checkpointEventSequence ?? event.sequence,
    eventSha256: successor.checkpointEventSha256 ?? sha256Hex(jcsBytes(event)),
    ...structuredClone(successor)
  };
}

function candidateFromCheckpoint(event) {
  return {
    checkpointId: event.checkpointId,
    eventSequence: event.sequence,
    eventSha256: event.eventSha256 ?? sha256Hex(jcsBytes(event)),
    coverageFirstSequence: event.coverageFirstSequence,
    coverageTailSequence: event.coverageTailSequence,
    coverageTailRecordSequence: event.coverageTailRecordSequence,
    coverageTailRecordSha256: event.coverageTailRecordSha256,
    coverageRecordCount: event.coverageRecordCount,
    coverageChargedJcsBytes: event.coverageChargedJcsBytes,
    coverageDistinctMapKeys: event.coverageDistinctMapKeys,
    compactedLiveGenerationRoot: event.compactedLiveGenerationRoot,
    foldedSupersededGenerationRoot: event.foldedSupersededGenerationRoot,
    usedDispatchIdsRoot: event.usedDispatchIdsRoot,
    publicationArtifactBijectionRoot: event.publicationArtifactBijectionRoot,
    deltaPageManifestSha256: event.deltaPageManifestSha256,
    rawPruneManifestRoot: event.rawPruneManifestRoot,
    writerStateSha256: event.writerStateSha256,
    verifierSetId: event.verifierSetId,
    verifierSetDigest: event.verifierSetDigest
  };
}

function refusal(code, message) {
  return { admitted: false, code, message, mutated: false };
}

export function evaluateAdmission(stateInput, event, { mapKeys = [], validDisposition = false, validAuthority = false } = {}) {
  const state = structuredClone(stateInput);
  try { assertReplayState(state); } catch (error) { return refusal(error.code, error.message); }
  if (!Number.isSafeInteger(event.sequence) || event.sequence !== state.headSequence + 1) return refusal('INVALID_SEQUENCE', 'event must be the contiguous next sequence');
  const mapKeyCount = new Set(mapKeys).size;
  if (mapKeyCount > CHECKPOINT_CONSTANTS.K_EVENT) return refusal('EVENT_KEY_FANOUT_EXCEEDED', 'event exceeds K_event');
  const charged = event.chargedJcsBytes;
  if (!Number.isSafeInteger(charged) || charged < 0 || charged > CHECKPOINT_CONSTANTS.E_MAX) return refusal('EVENT_TOO_LARGE', 'event exceeds E_max');
  const oldLag = state.headSequence - state.lastVerifiedCoverageTailSequence;
  const projectedMapKeyCharge = mapKeyChargeForAppend(state.interval, mapKeys);

  if (event.eventType === 'checkpoint-verified') {
    if (!state.sealedCandidate || !validDisposition || !validAuthority) return refusal('INVALID_DISPOSITION', 'VERIFIED requires one complete valid chain-authorized disposition');
    const postPromotionLag = event.sequence - event.coverageTailSequence;
    if (postPromotionLag > CHECKPOINT_CONSTANTS.L_MAX) return refusal('VERIFIER_LAG', 'post-promotion lag exceeds L_max');
    const projectedTail = projectedTailAccounting(state, event, mapKeys, projectedMapKeyCharge, event.coverageTailSequence);
    const tailRefusal = tailLimitRefusal(projectedTail, CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAX_BYTES);
    if (tailRefusal) return tailRefusal;
    state.headSequence = event.sequence;
    state.headRecordSha256 = event.eventSha256 ?? sha256Hex(jcsBytes(event));
    state.lastVerifiedCoverageTailSequence = event.coverageTailSequence;
    state.sealedCandidate = null;
    state.aboveBoundaryRotationCount = 0;
    state.aboveBoundaryRejectionSuccessorCount = 0;
    setTailEvents(state, projectedTail.tailEvents);
    const intervalResult = intervalAfterAppend(state.interval, { chargedJcsBytes: charged, mapKeys });
    state.interval = intervalResult.next;
    state.sealRequired = state.sealRequired || intervalResult.closedPrevious || state.interval.intervalClosed;
    return { admitted: true, code: 'ADMITTED', nextState: state, mutated: true };
  }

  const projectedLag = event.sequence - state.lastVerifiedCoverageTailSequence;
  const intervalClosed = Boolean(state.sealRequired || state.interval?.intervalClosed);
  const sealDue = !state.sealedCandidate && (intervalClosed || projectedLag >= CHECKPOINT_CONSTANTS.L_MAX);
  if (sealDue) {
    if (event.eventType !== 'checkpoint') return refusal('CHECKPOINT_REQUIRED', 'a checkpoint is the only admissible next event');
    if (projectedLag > CHECKPOINT_CONSTANTS.L_MAX) return refusal('VERIFIER_LAG', 'checkpoint would exceed L_max');
    if (event.coverageTailSequence !== event.sequence - 1) return refusal('INVALID_CHECKPOINT_COVERAGE', 'forced checkpoint must cover its immediate predecessor');
  }

  let recoveryCounter;
  const projectedTail = projectedTailAccounting(state, event, mapKeys, projectedMapKeyCharge);
  if (projectedLag <= CHECKPOINT_CONSTANTS.L_MAX) {
    if (event.eventType === 'checkpoint' && state.sealedCandidate) return refusal('CHECKPOINT_CANDIDATE_EXISTS', 'at most one SEALED candidate is permitted');
    const tailRefusal = tailLimitRefusal(projectedTail, CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAX_BYTES);
    if (tailRefusal) return tailRefusal;
  } else {
    if (oldLag < CHECKPOINT_CONSTANTS.L_MAX || oldLag > 261 || projectedLag !== oldLag + 1 || projectedLag > 262) return refusal('VERIFIER_LAG', 'event is outside the recovery envelope');
    if (!RECOVERY_TYPES.has(event.eventType)) return refusal('VERIFIER_LAG', 'ordinary event above L_max is refused');
    if (charged > CHECKPOINT_CONSTANTS.RECOVERY_EVENT_JCS_MAX || mapKeyCount !== 0) return refusal('RECOVERY_EVENT_TOO_LARGE', 'above-boundary recovery must be <=4096 bytes and touch zero map keys');
    if (!state.sealedCandidate) return refusal('INVALID_REPLAY_STATE', 'above-boundary recovery requires one SEALED candidate');
    if (!validAuthority) return refusal('UNAUTHORIZED_SIGNER', 'recovery authority is invalid');
    const tailRefusal = tailLimitRefusal(projectedTail, CHECKPOINT_CONSTANTS.RECOVERY_TAIL_MAX_BYTES);
    if (tailRefusal) return tailRefusal;
    if (event.eventType === 'verifier-set-update') {
      recoveryCounter = 'aboveBoundaryRotationCount';
      if (state[recoveryCounter] >= CHECKPOINT_CONSTANTS.R_ROTATION_MAX) return refusal('RECOVERY_QUOTA_EXCEEDED', 'rotation recovery quota exhausted');
      if (!event.candidateAuthorityRebinding) return refusal('INVALID_REBINDING', 'above-boundary rotation requires exact candidate rebinding');
    } else {
      recoveryCounter = 'aboveBoundaryRejectionSuccessorCount';
      if (state[recoveryCounter] >= CHECKPOINT_CONSTANTS.R_REJECTION_SUCCESSOR_MAX) return refusal('RECOVERY_QUOTA_EXCEEDED', 'rejection-successor recovery quota exhausted');
      if (!validDisposition) return refusal('INVALID_DISPOSITION', 'rejection-successor must atomically reject the sole candidate and create its successor');
    }
  }

  state.headSequence = event.sequence;
  state.headRecordSha256 = event.eventSha256 ?? sha256Hex(jcsBytes(event));
  setTailEvents(state, projectedTail.tailEvents);
  if (recoveryCounter) state[recoveryCounter] += 1;
  if (event.eventType === 'checkpoint') {
    state.sealedCandidate = candidateFromCheckpoint(event);
    state.sealRequired = false;
    state.interval = intervalAfterAppend(null, { chargedJcsBytes: charged, mapKeys: [] }).next;
  } else if (event.eventType === 'checkpoint-rejection-successor') {
    if (!validDisposition) return refusal('INVALID_DISPOSITION', 'rejection-successor is not a valid atomic replacement');
    state.sealedCandidate = rejectionCandidate(event);
    state.sealRequired = false;
    state.interval = intervalAfterAppend(null, { chargedJcsBytes: charged, mapKeys: [] }).next;
  } else {
    if (event.eventType === 'verifier-set-update' && event.candidateAuthorityRebinding && state.sealedCandidate) {
      state.sealedCandidate.rebinding = {
        verifierSetId: event.newVerifierSetId,
        verifierSetDigest: event.newVerifierSetDigest,
        eventSequence: event.sequence,
        eventSha256: state.headRecordSha256
      };
    }
    const intervalResult = intervalAfterAppend(state.interval, { chargedJcsBytes: charged, mapKeys });
    state.interval = intervalResult.next;
    state.sealRequired = state.sealRequired || intervalResult.closedPrevious || state.interval.intervalClosed;
  }
  return { admitted: true, code: 'ADMITTED', nextState: state, mutated: true };
}

export function completeAdmissionTurn({ state, event, eventOptions = {}, mandatoryCheckpoint }) {
  const primary = evaluateAdmission(state, event, eventOptions);
  if (!primary.admitted) return { ...primary, acknowledgementAllowed: false };
  const checkpointOwed = primary.nextState.sealRequired && !primary.nextState.sealedCandidate;
  if (!checkpointOwed) return { ...primary, acknowledgementAllowed: true };
  if (!mandatoryCheckpoint) {
    return {
      admitted: false,
      code: 'CHECKPOINT_APPEND_REQUIRED',
      primaryCommitted: true,
      acknowledgementAllowed: false,
      repairState: primary.nextState,
      mutated: true
    };
  }
  const sealed = evaluateAdmission(primary.nextState, mandatoryCheckpoint, { mapKeys: [] });
  if (!sealed.admitted) {
    return {
      admitted: false,
      code: sealed.code,
      primaryCommitted: true,
      acknowledgementAllowed: false,
      repairState: primary.nextState,
      mutated: true
    };
  }
  return {
    admitted: true,
    code: 'ADMITTED',
    primaryCommitted: true,
    checkpointCommitted: true,
    acknowledgementAllowed: true,
    nextState: sealed.nextState,
    mutated: true
  };
}

export function repairSealBeforeCaller(state, mandatoryCheckpoint) {
  if (!state.sealRequired || state.sealedCandidate) fail('NO_SEAL_REPAIR_REQUIRED', 'replay state does not require seal repair');
  const repaired = evaluateAdmission(state, mandatoryCheckpoint, { mapKeys: [] });
  if (!repaired.admitted) return { ...repaired, acknowledgementAllowed: false };
  return {
    admitted: false,
    code: 'RETRY_AFTER_REPAIR',
    checkpointCommitted: true,
    acknowledgementAllowed: false,
    nextState: repaired.nextState,
    mutated: true
  };
}

export function admitEvent(state, event, context = {}) {
  const before = jcs(state);
  try {
    if (!isPlainObject(event)) fail('INVALID_SCHEMA', 'event must be an object');
    assertSafeInteger(event.chargedJcsBytes, 'chargedJcsBytes', CHECKPOINT_CONSTANTS.E_MAX);
    if (jcsBytes(event).length !== event.chargedJcsBytes) fail('CHARGED_BYTES_MISMATCH', 'chargedJcsBytes does not equal exact event bytes');
    if (event.previousRecordSha256 !== state.headRecordSha256) fail('INVALID_PREDECESSOR', 'previousRecordSha256 does not match head');
    if (event.genesisAuthoritySha256 !== state.genesisAuthoritySha256) fail('INVALID_GENESIS_AUTHORITY', 'genesisAuthoritySha256 does not match chain genesis');
    let validAuthority = false;
    let validDisposition = false;
    let completeRecoveryCandidate;
    if (event.eventType === 'verifier-set-update') {
      validateVerifierSetUpdate(event);
      verifySignedEvent(event, { signatureMember: 'operatorRootSignature', authorityKeys: context.operatorRootKeys, expectedSignerKeyId: context.operatorRootKeyId });
      if (state.sealedCandidate) {
        const rebinding = event.candidateAuthorityRebinding;
        const candidateAuthority = state.sealedCandidate.rebinding ?? state.sealedCandidate;
        validAuthority = Boolean(rebinding)
          && rebinding.candidateCheckpointId === state.sealedCandidate.checkpointId
          && rebinding.candidateEventSequence === state.sealedCandidate.eventSequence
          && rebinding.candidateEventSha256 === state.sealedCandidate.eventSha256
          && rebinding.oldVerifierSetId === candidateAuthority.verifierSetId
          && rebinding.oldVerifierSetDigest === candidateAuthority.verifierSetDigest
          && rebinding.newVerifierSetId === event.newVerifierSetId
          && rebinding.newVerifierSetDigest === event.newVerifierSetDigest;
      } else {
        validAuthority = !event.candidateAuthorityRebinding;
      }
      if (typeof context.validateVerifierSetTransition !== 'function' || context.validateVerifierSetTransition(state, event) !== true) fail('INVALID_VERIFIER_SET', 'old/new set digests, generation, threshold, and identities did not validate');
      if (validAuthority && context.validateRebinding) validAuthority = context.validateRebinding(state, event) === true;
    } else if (event.eventType === 'checkpoint-rejection-successor') {
      validateCheckpointRejectionSuccessor(event);
      verifySignedEvent(event, { signatureMember: 'verifierSignature', authorityKeys: context.verifierAuthorityKeys });
      const candidate = state.sealedCandidate;
      const authority = candidate?.rebinding ?? candidate;
      const hasRebinding = Boolean(candidate?.rebinding);
      const rebindingMatches = hasRebinding
        ? event.candidateRebindingEventSequence === candidate.rebinding.eventSequence
          && event.candidateRebindingEventSha256 === candidate.rebinding.eventSha256
        : !Object.hasOwn(event, 'candidateRebindingEventSequence')
          && !Object.hasOwn(event, 'candidateRebindingEventSha256');
      validAuthority = Boolean(candidate)
        && event.verifierSetId === authority?.verifierSetId
        && event.verifierSetDigest === authority?.verifierSetDigest;
      validDisposition = validAuthority
        && rebindingMatches
        && event.rejectedCheckpointId === candidate.checkpointId
        && event.rejectedCheckpointEventSequence === candidate.eventSequence
        && event.rejectedCheckpointEventSha256 === candidate.eventSha256
        && event.successorCheckpoint.checkpointEventSequence === event.sequence
        && event.successorCheckpoint.verifierSetId === authority.verifierSetId
        && event.successorCheckpoint.verifierSetDigest === authority.verifierSetDigest;
      if (typeof context.validateRejectionSuccessor !== 'function') fail('INVALID_DISPOSITION', 'rejection-successor requires full replay/root/evidence validation');
      if (validDisposition) {
        const validation = context.validateRejectionSuccessor(state, event);
        validDisposition = validation?.valid === true;
        completeRecoveryCandidate = validation?.completeCandidate;
        if (validDisposition) {
          if (!isPlainObject(completeRecoveryCandidate)) fail('INVALID_DISPOSITION', 'recovery validation must return the complete derived candidate');
          for (const field of ['deltaPageCount', 'deltaPageBytes']) assertSafeInteger(completeRecoveryCandidate[field], `completeCandidate.${field}`);
          assertHash(completeRecoveryCandidate.rawPruneManifestRoot, 'completeCandidate.rawPruneManifestRoot');
          if (completeRecoveryCandidate.deltaPageBytes !== completeRecoveryCandidate.deltaPageCount * 65_536 || completeRecoveryCandidate.deltaPageBytes > CHECKPOINT_CONSTANTS.CHECKPOINT_DELTA_MAX) fail('INVALID_DELTA_ENVELOPE', 'derived recovery candidate page envelope is invalid');
        }
      }
    } else if (event.eventType === 'checkpoint-verified') {
      if (!context.previousVerified) fail('INVALID_DISPOSITION', 'VERIFIED receipt-chain predecessor is required');
      if (typeof context.validateCandidateReplay !== 'function' || context.validateCandidateReplay(state.sealedCandidate, event) !== true) fail('INVALID_DISPOSITION', 'candidate chain/pages/roots did not independently replay');
      validateCheckpointVerified(event, {
        candidate: state.sealedCandidate,
        previousVerified: context.previousVerified,
        verifierAuthorityKeys: context.verifierAuthorityKeys,
        mirrorReceiptBytes: context.mirrorReceiptBytes
      });
      validAuthority = true;
      validDisposition = true;
    } else if (event.eventType === 'namespace-migration-resolution') {
      // FOLLOW-UP REQUIREMENT (intentionally out of scope here): code-own the
      // closed namespace-migration-resolution schema validator. Until then,
      // admission fails closed unless the caller supplies that validator.
      if (typeof context.validateEventSchema !== 'function' || context.validateEventSchema(event) !== true) fail('INVALID_SCHEMA', 'namespace migration requires its closed migration validator');
      verifySignedEvent(event, { signatureMember: 'operatorRootSignature', authorityKeys: context.operatorRootKeys, expectedSignerKeyId: context.operatorRootKeyId });
      validAuthority = true;
    } else {
      if (typeof context.validateEventSchema !== 'function' || context.validateEventSchema(event) !== true) fail('INVALID_SCHEMA', `no closed validator for ${event.eventType}`);
      validAuthority = context.validateAuthority?.(event, state) === true;
      if (!validAuthority) fail('UNAUTHORIZED_SIGNER', 'event authority failed');
    }
    const mapKeys = context.expandMapKeys ? context.expandMapKeys(event) : [];
    validateEventFanout(event.eventType, mapKeys, { migrationSourceCount: context.migrationSourceCount });
    const decision = evaluateAdmission(state, event, { mapKeys, validAuthority, validDisposition });
    if (decision.admitted && event.eventType === 'checkpoint-rejection-successor') {
      decision.nextState.sealedCandidate = {
        ...decision.nextState.sealedCandidate,
        deltaPageCount: completeRecoveryCandidate.deltaPageCount,
        deltaPageBytes: completeRecoveryCandidate.deltaPageBytes,
        rawPruneManifestRoot: completeRecoveryCandidate.rawPruneManifestRoot
      };
    }
    if (!decision.admitted && jcs(state) !== before) fail('MUTATION_ON_REFUSAL', 'admission refusal mutated state');
    return decision;
  } catch (error) {
    if (jcs(state) !== before) fail('MUTATION_ON_REFUSAL', 'validation failure mutated state');
    if (error instanceof ProtocolError) return refusal(error.code, error.message);
    throw error;
  }
}

export function deriveDeltaPageEnvelope({ distinctMapKeys = 384, physicalEventCount = 128 } = {}) {
  assertSafeInteger(distinctMapKeys, 'distinctMapKeys', CHECKPOINT_CONSTANTS.K_INTERVAL);
  assertSafeInteger(physicalEventCount, 'physicalEventCount', CHECKPOINT_CONSTANTS.K_R);
  const branchRecords = distinctMapKeys * 256;
  const branchBytes = branchRecords * 64;
  const leafBytes = distinctMapKeys * 4_096;
  const branchIndexBytes = branchRecords * 4;
  const auxiliaryUsedBytes = distinctMapKeys * 16 + 120 * 48 + physicalEventCount * 64 + 4 * 96 + 4 * 4_096;
  const supermanifestUsedBytes = 127 * 48 + 4_096 + 2_048 + 4 * 96 + 2_048 + 512 + 1_200;
  const ceilPages = (bytes) => Math.ceil(bytes / CHECKPOINT_CONSTANTS.CHECKPOINT_PAGE_BYTES);
  const pageCounts = {
    branch: ceilPages(branchBytes),
    leaf: ceilPages(leafBytes),
    index: ceilPages(branchIndexBytes),
    auxiliary: ceilPages(auxiliaryUsedBytes),
    manifest: ceilPages(supermanifestUsedBytes)
  };
  const pageCount = Object.values(pageCounts).reduce((sum, value) => sum + value, 0);
  const pageBytes = pageCount * CHECKPOINT_CONSTANTS.CHECKPOINT_PAGE_BYTES;
  if (pageCount > 128 || pageBytes > CHECKPOINT_CONSTANTS.CHECKPOINT_DELTA_MAX) fail('INVALID_DELTA_ENVELOPE', 'delta pages exceed the closed envelope');
  return { branchRecords, branchBytes, leafBytes, branchIndexBytes, auxiliaryUsedBytes, supermanifestUsedBytes, pageCounts, pageCount, pageBytes };
}

export function encodeDeltaPage({ domain, ordinal, payload }) {
  assertUnicodeScalarString(domain, 'domain');
  assertSafeInteger(ordinal, 'ordinal', 127);
  const used = Buffer.from(payload);
  if (used.length > CHECKPOINT_CONSTANTS.CHECKPOINT_PAGE_BYTES) fail('INVALID_DELTA_ENVELOPE', 'page payload exceeds 65,536 bytes');
  const page = Buffer.alloc(CHECKPOINT_CONSTANTS.CHECKPOINT_PAGE_BYTES, 0);
  used.copy(page);
  return Object.freeze({
    domain,
    ordinal,
    usedByteCount: used.length,
    pageSha256: sha256Hex(page),
    page
  });
}

export function validateDeltaPage(pageRecord, descriptor) {
  assertExactKeys(descriptor, ['domain', 'ordinal', 'usedByteCount', 'pageSha256'], [], 'page descriptor');
  if (!Buffer.isBuffer(pageRecord) || pageRecord.length !== CHECKPOINT_CONSTANTS.CHECKPOINT_PAGE_BYTES) fail('INVALID_DELTA_ENVELOPE', 'delta page must be exactly 65,536 bytes');
  assertUnicodeScalarString(descriptor.domain, 'descriptor.domain');
  assertSafeInteger(descriptor.ordinal, 'descriptor.ordinal', 127);
  assertSafeInteger(descriptor.usedByteCount, 'descriptor.usedByteCount', 65_536);
  assertHash(descriptor.pageSha256, 'descriptor.pageSha256');
  if (!pageRecord.subarray(descriptor.usedByteCount).equals(Buffer.alloc(65_536 - descriptor.usedByteCount))) fail('INVALID_DELTA_ENVELOPE', 'unused page bytes must be canonical zeros');
  if (sha256Hex(pageRecord) !== descriptor.pageSha256) fail('INVALID_DELTA_ENVELOPE', 'page digest mismatch');
  return true;
}

export function replayDerivedCheckpointState({ lastVerifiedCoverageTailSequence = 0, events, expandMapKeys }) {
  assertSafeInteger(lastVerifiedCoverageTailSequence, 'lastVerifiedCoverageTailSequence');
  if (!Array.isArray(events)) fail('INVALID_REPLAY_STATE', 'events must be an array');
  if (typeof expandMapKeys !== 'function') fail('INVALID_REPLAY_STATE', 'replay requires the closed map-key expander');
  let state = initialCheckpointState({ lastVerifiedCoverageTailSequence });
  state.headSequence = lastVerifiedCoverageTailSequence;
  for (const event of events) {
    if (event.sequence !== state.headSequence + 1) fail('INVALID_SEQUENCE', 'replay events must be contiguous');
    const mapKeys = expandMapKeys(event);
    validateEventFanout(event.eventType, mapKeys, { migrationSourceCount: event.migrationSourceCount });
    const mapKeyCharge = mapKeyChargeForAppend(state.interval, mapKeys);
    const intervalResult = intervalAfterAppend(state.interval, { chargedJcsBytes: event.chargedJcsBytes, mapKeys });
    state.interval = intervalResult.next;
    state.sealRequired = state.sealRequired || intervalResult.closedPrevious || state.interval.intervalClosed;
    state.headSequence = event.sequence;
    state.headRecordSha256 = event.eventSha256 ?? sha256Hex(jcsBytes(event));
    setTailEvents(state, [...state.tailEvents, tailEventSummary(event, mapKeys, mapKeyCharge)]);
    if (event.eventType === 'checkpoint') {
      if (state.sealedCandidate) fail('INVALID_REPLAY_STATE', 'replay found a second SEALED candidate');
      if (event.coverageTailSequence !== event.sequence - 1) fail('INVALID_CHECKPOINT_COVERAGE', 'checkpoint does not cover its immediate predecessor');
      state.sealedCandidate = candidateFromCheckpoint(event);
      state.sealRequired = false;
      state.interval = intervalAfterAppend(null, { chargedJcsBytes: event.chargedJcsBytes, mapKeys: [] }).next;
    } else if (event.eventType === 'checkpoint-rejection-successor') {
      if (!state.sealedCandidate) fail('INVALID_REPLAY_STATE', 'rejection has no SEALED candidate');
      state.sealedCandidate = rejectionCandidate(event);
      state.sealRequired = false;
      state.interval = intervalAfterAppend(null, { chargedJcsBytes: event.chargedJcsBytes, mapKeys: [] }).next;
    } else if (event.eventType === 'checkpoint-verified') {
      if (!state.sealedCandidate) fail('INVALID_REPLAY_STATE', 'VERIFIED has no SEALED candidate');
      state.lastVerifiedCoverageTailSequence = event.coverageTailSequence;
      setTailEvents(state, state.tailEvents.filter((summary) => summary.sequence > event.coverageTailSequence));
      state.sealedCandidate = null;
      state.aboveBoundaryRotationCount = 0;
      state.aboveBoundaryRejectionSuccessorCount = 0;
    } else if (event.eventType === 'verifier-set-update' && event.sequence - state.lastVerifiedCoverageTailSequence > 258) {
      state.aboveBoundaryRotationCount += 1;
    }
    if (event.eventType === 'checkpoint-rejection-successor' && event.sequence - state.lastVerifiedCoverageTailSequence > 258) state.aboveBoundaryRejectionSuccessorCount += 1;
    const replayLag = state.headSequence - state.lastVerifiedCoverageTailSequence;
    const replayTailMaximum = replayLag > CHECKPOINT_CONSTANTS.L_MAX ? CHECKPOINT_CONSTANTS.RECOVERY_TAIL_MAX_BYTES : CHECKPOINT_CONSTANTS.ORDINARY_TAIL_MAX_BYTES;
    const replayTailRefusal = tailLimitRefusal({ chargedJcsBytes: state.tailChargedJcsBytes, mapKeyCharge: state.tailMapKeyCharge }, replayTailMaximum);
    if (replayTailRefusal) fail(replayTailRefusal.code, replayTailRefusal.message);
  }
  assertReplayState(state);
  return state;
}

export function validateSubtreeTransition({ subtreeRoot, metadataBytes, witnessBytes, objectDurable }) {
  if (!Buffer.isBuffer(subtreeRoot) || subtreeRoot.length !== 32) fail('INVALID_SUBTREE_ROOT', 'subtree root must be 32 bytes');
  assertSafeInteger(metadataBytes, 'metadataBytes', 4_096 - 32);
  assertSafeInteger(witnessBytes, 'witnessBytes', CHECKPOINT_CONSTANTS.E_MAX);
  if (!objectDurable) fail('SUBTREE_NOT_DURABLE', 'subtree object must be durable before event append');
  return true;
}

export function validateSelectedSubtreeRead({ membershipProofBytes, selectedObjectBytes }) {
  assertSafeInteger(membershipProofBytes, 'membershipProofBytes', CHECKPOINT_CONSTANTS.SELECTED_BYTES_MAX);
  assertSafeInteger(selectedObjectBytes, 'selectedObjectBytes', CHECKPOINT_CONSTANTS.SELECTED_BYTES_MAX);
  if (membershipProofBytes + selectedObjectBytes > CHECKPOINT_CONSTANTS.SELECTED_BYTES_MAX) fail('SELECTED_BYTES_EXCEEDED', 'selected subtree read exceeds 64 MiB row');
  return membershipProofBytes + selectedObjectBytes;
}

export function validateCheckpointReserves({ projectAvailableBytes, mirrorAvailableBytes, deltaPageBytes, checkpointHeaderBytes, recoveryEventCount = 4 }) {
  for (const [label, value] of Object.entries({ projectAvailableBytes, mirrorAvailableBytes, deltaPageBytes, checkpointHeaderBytes, recoveryEventCount })) assertSafeInteger(value, label);
  if (deltaPageBytes > CHECKPOINT_CONSTANTS.CHECKPOINT_DELTA_MAX || checkpointHeaderBytes > CHECKPOINT_CONSTANTS.CHECKPOINT_HEADER_MAX || recoveryEventCount > 4) fail('CHECKPOINT_RESERVE_EXHAUSTED', 'checkpoint material exceeds the closed envelope');
  const requiredProject = deltaPageBytes + checkpointHeaderBytes + recoveryEventCount * CHECKPOINT_CONSTANTS.RECOVERY_EVENT_JCS_MAX;
  const requiredMirror = deltaPageBytes + checkpointHeaderBytes + recoveryEventCount * CHECKPOINT_CONSTANTS.RECOVERY_EVENT_JCS_MAX;
  if (projectAvailableBytes < CHECKPOINT_CONSTANTS.CHECKPOINT_RESERVE_BYTES || projectAvailableBytes < requiredProject) fail('CHECKPOINT_RESERVE_EXHAUSTED', 'project reserve is insufficient');
  if (mirrorAvailableBytes < CHECKPOINT_CONSTANTS.VERIFIER_MIRROR_RESERVE_BYTES || mirrorAvailableBytes < requiredMirror) fail('CHECKPOINT_RESERVE_EXHAUSTED', 'mirror reserve is insufficient');
  return { requiredProject, requiredMirror };
}

export function validatePruneEligibility({ lifecycle, mirror, checkpointGeneration, newestVerifiedGeneration }) {
  if (lifecycle !== 'VERIFIED') fail('PRUNE_NOT_VERIFIED', 'raw unlink requires VERIFIED lifecycle');
  assertSafeInteger(checkpointGeneration, 'checkpointGeneration');
  assertSafeInteger(newestVerifiedGeneration, 'newestVerifiedGeneration');
  assertExactKeys(mirror, ['headerDurable', 'pagesDurable', 'manifestDurable', 'receiptDurable', 'rawEvidenceDurableThroughGeneration'], [], 'mirror state');
  if (!mirror.headerDurable || !mirror.pagesDurable || !mirror.manifestDurable || !mirror.receiptDurable) fail('MIRROR_NOT_DURABLE', 'complete root-owned mirror must predate prune');
  assertSafeInteger(mirror.rawEvidenceDurableThroughGeneration, 'rawEvidenceDurableThroughGeneration');
  if (newestVerifiedGeneration < checkpointGeneration + 1 || mirror.rawEvidenceDurableThroughGeneration < checkpointGeneration + 1) fail('MIRROR_RETENTION_INCOMPLETE', 'one additional VERIFIED generation of raw evidence is required');
  return true;
}

export function selectGreatestVerifiedAnchor({ anchors, capturedHeadSequence, validateAnchor, virtual }) {
  if (!Array.isArray(anchors) || typeof validateAnchor !== 'function') fail('INVALID_ANCHOR_SET', 'anchors and validator are required');
  assertSafeInteger(capturedHeadSequence, 'capturedHeadSequence');
  const ordered = [...anchors]
    .filter((anchor) => Number.isSafeInteger(anchor.sequence) && anchor.sequence <= capturedHeadSequence)
    .sort((left, right) => right.sequence - left.sequence);
  for (const anchor of ordered) if (validateAnchor(anchor) === true) return anchor;
  if (!virtual || virtual.checkpointId !== 'VIRTUAL-GENESIS' || virtual.sequence !== 0) fail('NO_VALID_VERIFIED_ANCHOR', 'no valid VERIFIED anchor or virtual genesis');
  return virtual;
}

export function reconcileBrokerAcknowledgements({ acknowledgements, replayedUsedIds, capturedHeadSequence }) {
  if (!Array.isArray(acknowledgements) || !(replayedUsedIds instanceof Map)) fail('INVALID_BROKER_REPLAY', 'acknowledgements and replayed used-ID map are required');
  assertSafeInteger(capturedHeadSequence, 'capturedHeadSequence');
  for (const acknowledgement of acknowledgements) {
    assertExactKeys(acknowledgement, ['authorizationId', 'action', 'projectId', 'sequence'], [], 'broker acknowledgement');
    assertSafeInteger(acknowledgement.sequence, 'acknowledgement.sequence');
    if (acknowledgement.sequence > capturedHeadSequence) fail('BROKER_CORRUPT', 'acknowledgement is newer than captured head');
    const replayed = replayedUsedIds.get(acknowledgement.authorizationId);
    if (!replayed || replayed.action !== acknowledgement.action || replayed.projectId !== acknowledgement.projectId) fail('BROKER_CORRUPT', 'durable acknowledgement is absent or differently bound in replay');
  }
  return true;
}

export function publicationBijectionKeys({ canonicalArtifactSha256, contentSha256 }) {
  assertHash(canonicalArtifactSha256, 'canonicalArtifactSha256');
  assertHash(contentSha256, 'contentSha256');
  return [
    sha256Hex(`KSTACK-PUBLICATION-V2\0artifact-to-content\0${canonicalArtifactSha256}\0slot-0`),
    sha256Hex(`KSTACK-PUBLICATION-V2\0artifact-to-content\0${canonicalArtifactSha256}\0slot-1`),
    sha256Hex(`KSTACK-PUBLICATION-V2\0content-to-artifact\0${contentSha256}\0slot-0`),
    sha256Hex(`KSTACK-PUBLICATION-V2\0content-to-artifact\0${contentSha256}\0slot-1`)
  ];
}

const ceilRateMs = (bytes, bytesPerSecond) => Math.ceil((1_000 * bytes) / bytesPerSecond);

export function chainValidationCostMs(eventCount, chargedBytes) {
  assertSafeInteger(eventCount, 'eventCount');
  assertSafeInteger(chargedBytes, 'chargedBytes');
  return 110 * eventCount + ceilRateMs(chargedBytes, CHECKPOINT_CONSTANTS.CANONICAL_PARSE_HASH_MIN_BYTES_PER_S);
}

export function verifierEligibilityArithmetic() {
  const components = {
    recoveryTail: chainValidationCostMs(262, 20_004_864),
    candidateBundleReadHash: ceilRateMs(8_388_608, 4_194_304),
    headerParseHash: ceilRateMs(65_536, 1_048_576),
    aggregateJoins: ceilRateMs(6_946_816, 4_194_304),
    rootCompareAndEd25519: 250,
    mirrorCopyHashDurability: ceilRateMs(8_454_144, 4_194_304) + 129 * 30 + 2 * 500,
    dispositionAppend: 4 + 2 * 30 + 2 * 500,
    schemaSetSchedulerReserve: 1_500
  };
  const totalMs = Object.values(components).reduce((sum, value) => sum + value, 0);
  return {
    components,
    totalMs,
    verifierSlackMs: CHECKPOINT_CONSTANTS.VERIFIER_LOCK_HOLD_MAX_MS - totalMs,
    recoveryAggregateMs: 267_750 + components.recoveryTail,
    recoveryMarginMs: CHECKPOINT_CONSTANTS.GATE_DEADLINE_MS - (267_750 + components.recoveryTail),
    queuedGateMs: 62_000 + 96_000 + 10_000 + components.recoveryTail + 30_000 + 64_000 + 4_750,
    queuedGateMarginMs: CHECKPOINT_CONSTANTS.GATE_DEADLINE_MS - (62_000 + 96_000 + 10_000 + components.recoveryTail + 30_000 + 64_000 + 4_750)
  };
}

export function gateBoundaryArithmetic() {
  const ordinaryChainMs = chainValidationCostMs(258, 19_988_480);
  const recoveryChainMs = chainValidationCostMs(262, 20_004_864);
  const hypothetical259Bytes = 21_037_056;
  const hypothetical259ChainMs = chainValidationCostMs(259, hypothetical259Bytes);
  return {
    ordinaryChainMs,
    ordinaryTotalMs: 267_750 + ordinaryChainMs,
    ordinaryMarginMs: 326_000 - (267_750 + ordinaryChainMs),
    recoveryChainMs,
    recoveryTotalMs: 267_750 + recoveryChainMs,
    recoveryMarginMs: 326_000 - (267_750 + recoveryChainMs),
    hypothetical259Bytes,
    hypothetical259ChainMs,
    hypothetical259TotalMs: 267_750 + hypothetical259ChainMs,
    requiredMarginDeadlineMs: 326_000 - 10_000
  };
}

export function qualifyVerifierProbe(probe) {
  const required = ['implementationSha256', 'fixtureVersion', 'filesystemClass', 'durationMs', 'keyId', 'canonicalParseHashBytesPerSecond', 'sequentialHashBytesPerSecond', 'fileBarrierMaxMs', 'directoryBarrierMaxMs', 'primitiveCryptoMaxMs', 'completeFixture'];
  assertExactKeys(probe, required, [], 'qualification probe');
  assertHash(probe.implementationSha256, 'implementationSha256');
  if (typeof probe.fixtureVersion !== 'string' || !probe.fixtureVersion || typeof probe.filesystemClass !== 'string' || !probe.filesystemClass) fail('QUALIFICATION_FAILED', 'fixtureVersion and filesystemClass are required');
  assertKeyId(probe.keyId, 'keyId');
  for (const field of ['durationMs', 'canonicalParseHashBytesPerSecond', 'sequentialHashBytesPerSecond', 'fileBarrierMaxMs', 'directoryBarrierMaxMs', 'primitiveCryptoMaxMs']) assertSafeInteger(probe[field], field);
  if (probe.completeFixture !== true || probe.canonicalParseHashBytesPerSecond < 1_048_576 || probe.sequentialHashBytesPerSecond < 4_194_304 || probe.fileBarrierMaxMs > 30 || probe.directoryBarrierMaxMs > 500 || probe.primitiveCryptoMaxMs > 250 || probe.durationMs > 62_000) fail('QUALIFICATION_FAILED', 'verifier probe does not meet the deployment floor/ceilings');
  return Object.freeze({ ...probe, qualified: true });
}

export class QualificationRegistry {
  #records = new Map();

  qualify(probe) {
    const record = qualifyVerifierProbe(probe);
    this.#records.set(`${record.implementationSha256}\0${record.fixtureVersion}\0${record.filesystemClass}\0${record.keyId}`, record);
    return record;
  }

  isEligible({ implementationSha256, fixtureVersion, filesystemClass, keyId }) {
    return this.#records.has(`${implementationSha256}\0${fixtureVersion}\0${filesystemClass}\0${keyId}`);
  }

  schedule(workers) {
    if (!Array.isArray(workers)) fail('INVALID_WORKERS', 'workers must be an array');
    const worker = workers.find((candidate) => this.isEligible(candidate));
    if (!worker) fail('NO_ELIGIBLE_VERIFIER', 'no locally qualified verifier may be scheduled');
    return worker;
  }
}

export class AppendFifo {
  #holder = null;
  #queue = [];

  join(type, token) {
    if (!['verifier', 'writer', 'gate'].includes(type)) fail('INVALID_PARTICIPANT', 'unknown FIFO participant type');
    const participants = [this.#holder, ...this.#queue].filter(Boolean);
    if (participants.some((entry) => entry.type === type)) return { admitted: false, code: 'LOCK_QUEUE_FULL' };
    if (participants.length >= CHECKPOINT_CONSTANTS.APPEND_FIFO_MAX_PARTICIPANTS) return { admitted: false, code: 'LOCK_QUEUE_FULL' };
    const entry = { type, token };
    if (!this.#holder) this.#holder = entry;
    else this.#queue.push(entry);
    return { admitted: true, position: this.#holder === entry ? 0 : this.#queue.length };
  }

  release(token) {
    if (!this.#holder || this.#holder.token !== token) fail('FIFO_RELEASE_MISMATCH', 'only the holder may release');
    const released = this.#holder;
    this.#holder = this.#queue.shift() ?? null;
    return { released, holder: this.#holder };
  }

  snapshot() {
    return structuredClone({ holder: this.#holder, queue: this.#queue });
  }
}

const RETRIABLE_GATE_RESULTS = new Set(['LOCK_QUEUE_FULL', 'RETRY_AFTER_REPAIR', 'RETRY_AFTER_QUANTUM']);

export async function runGateWithBoundedRetries({ operationToken, acquire, delay = async () => {}, retryDelayMs = () => 1_000 }) {
  if (typeof operationToken !== 'string' || !operationToken) fail('INVALID_OPERATION_TOKEN', 'stable operation token is required');
  if (typeof acquire !== 'function' || typeof delay !== 'function') fail('INVALID_RETRY_HANDLER', 'acquire and delay functions are required');
  const reasons = [];
  let elapsedMs = 0;
  for (let attempt = 1; attempt <= CHECKPOINT_CONSTANTS.GATE_ACQUISITION_ATTEMPTS_MAX; attempt += 1) {
    const outcome = await acquire({ operationToken, attempt });
    const durationMs = outcome?.durationMs ?? 0;
    assertSafeInteger(durationMs, 'durationMs', CHECKPOINT_CONSTANTS.GATE_DEADLINE_MS);
    elapsedMs += durationMs;
    if (outcome?.code === 'SUCCESS') return { ...outcome, operationToken, attempts: attempt, reasons, elapsedMs };
    if (!RETRIABLE_GATE_RESULTS.has(outcome?.code)) return { ...outcome, operationToken, attempts: attempt, reasons, elapsedMs };
    reasons.push(outcome.code);
    if (attempt < CHECKPOINT_CONSTANTS.GATE_ACQUISITION_ATTEMPTS_MAX) {
      const retryMs = retryDelayMs({ operationToken, attempt, reason: outcome.code });
      assertSafeInteger(retryMs, 'retryDelayMs', CHECKPOINT_CONSTANTS.GATE_RETRY_DELAY_MAX_MS);
      elapsedMs += retryMs;
      await delay(retryMs);
    }
  }
  return { code: 'GATE_RETRY_EXHAUSTED', retriable: false, operationToken, attempts: 3, reasons, elapsedMs };
}

export function brokerCowDurabilityMs(fileBarriers = 262, directoryBarriers = 4) {
  assertSafeInteger(fileBarriers, 'fileBarriers');
  assertSafeInteger(directoryBarriers, 'directoryBarriers');
  return fileBarriers * CHECKPOINT_CONSTANTS.FILE_BARRIER_MAX_MS + directoryBarriers * CHECKPOINT_CONSTANTS.DIRECTORY_BARRIER_MAX_MS;
}

export function validateBrokerDurabilityTrace(trace) {
  const required = ['append-chain-event', 'fsync-event', 'fsync-head', 'fsync-parent-directories', 'commit-broker-ack', 'return-ack'];
  if (!Array.isArray(trace) || trace.length !== required.length || trace.some((step, index) => step !== required[index])) fail('INVALID_BROKER_DURABILITY_ORDER', 'broker acknowledgement durability order is invalid');
  if (brokerCowDurabilityMs() !== CHECKPOINT_CONSTANTS.BROKER_COW_MAX_MS) fail('INTERNAL_ERROR', 'broker durability row is inconsistent');
  return true;
}

function maxUuid(last = '0') {
  return `00000000-0000-4000-8000-00000000000${last}`;
}

export function maximumRecoveryFixtures() {
  const hash = 'f'.repeat(64);
  const key = 'A'.repeat(43);
  const signature = { algorithm: 'Ed25519', keyId: maxUuid(), signatureBase64Url: SIGNATURE_PLACEHOLDER };
  const rebinding = {
    candidateCheckpointId: maxUuid(),
    candidateEventSequence: MAX_SAFE_INTEGER,
    candidateEventSha256: hash,
    newVerifierSetDigest: hash,
    newVerifierSetId: maxUuid(),
    oldVerifierSetDigest: hash,
    oldVerifierSetId: maxUuid()
  };
  const rotation = stabilizeChargedJcsBytes({
    candidateAuthorityRebinding: rebinding,
    chargedJcsBytes: 0,
    eventType: 'verifier-set-update',
    genesisAuthoritySha256: hash,
    newVerifierKeys: Array.from({ length: 8 }, (_, index) => ({ algorithm: 'Ed25519', publicKeyBase64Url: key, verifierKeyId: maxUuid(String(index + 1)) })),
    newVerifierSetDigest: hash,
    newVerifierSetId: maxUuid(),
    nonceBase64Url: key,
    oldVerifierSetDigest: hash,
    oldVerifierSetId: maxUuid(),
    operatorRootSignature: signature,
    previousRecordSha256: hash,
    reasonCode: 'R'.repeat(32),
    schemaVersion: 2,
    sequence: MAX_SAFE_INTEGER,
    setGeneration: MAX_SAFE_INTEGER,
    signerKeyId: maxUuid(),
    threshold: 1
  }, 'operatorRootSignature');
  const rejection = stabilizeChargedJcsBytes({
    candidateRebindingEventSequence: MAX_SAFE_INTEGER,
    candidateRebindingEventSha256: hash,
    chargedJcsBytes: 0,
    eventType: 'checkpoint-rejection-successor',
    evidenceSha256: hash,
    genesisAuthoritySha256: hash,
    previousRecordSha256: hash,
    rejectedCheckpointEventSequence: MAX_SAFE_INTEGER,
    rejectedCheckpointEventSha256: hash,
    rejectedCheckpointId: maxUuid(),
    rejectionReasonCode: 'R'.repeat(32),
    schemaVersion: 2,
    sequence: MAX_SAFE_INTEGER,
    signerKeyId: maxUuid(),
    successorCheckpoint: {
      checkpointEventSequence: MAX_SAFE_INTEGER,
      checkpointId: maxUuid(),
      compactedLiveGenerationRoot: hash,
      coverageChargedJcsBytes: 20_004_864,
      coverageDistinctMapKeys: 848,
      coverageFirstSequence: MAX_SAFE_INTEGER,
      coverageRecordCount: 262,
      coverageTailRecordSequence: MAX_SAFE_INTEGER,
      coverageTailRecordSha256: hash,
      coverageTailSequence: MAX_SAFE_INTEGER,
      deltaPageManifestSha256: hash,
      foldedSupersededGenerationRoot: hash,
      previousVerifiedCheckpointId: maxUuid(),
      previousVerifiedReceiptSha256: hash,
      publicationArtifactBijectionRoot: hash,
      usedDispatchIdsRoot: hash,
      verifierSetDigest: hash,
      verifierSetId: maxUuid(),
      writerStateSha256: hash
    },
    verifierSetDigest: hash,
    verifierSetId: maxUuid(),
    verifierSignature: signature
  }, 'verifierSignature');
  return { rotation, rejection };
}

function jcsFieldContributions(value) {
  const contributions = { 'outer braces': 2 };
  Object.keys(value).sort().forEach((key, index) => {
    const encoded = `${index === 0 ? '' : ','}${JSON.stringify(key)}:${jcs(value[key])}`;
    contributions[key] = Buffer.byteLength(encoded, 'utf8');
  });
  return contributions;
}

export function recoveryFixtureAccounting() {
  const { rotation, rejection } = maximumRecoveryFixtures();
  const rotationTopLevel = jcsFieldContributions(rotation);
  const rejectionTopLevel = jcsFieldContributions(rejection);
  const sum = (accounting) => Object.values(accounting).reduce((total, bytes) => total + bytes, 0);
  return {
    rotation: {
      topLevel: rotationTopLevel,
      rebinding: jcsFieldContributions(rotation.candidateAuthorityRebinding),
      verifierKey: jcsFieldContributions(rotation.newVerifierKeys[0]),
      signature: jcsFieldContributions(rotation.operatorRootSignature),
      exactJcsBytes: sum(rotationTopLevel),
      authoritativeExactMaximum: CHECKPOINT_CONSTANTS.RECOVERY_ROTATION_EXACT_MAX
    },
    rejectionSuccessor: {
      topLevel: rejectionTopLevel,
      successor: jcsFieldContributions(rejection.successorCheckpoint),
      signature: jcsFieldContributions(rejection.verifierSignature),
      exactJcsBytes: sum(rejectionTopLevel),
      authoritativeExactMaximum: CHECKPOINT_CONSTANTS.RECOVERY_REJECTION_SUCCESSOR_EXACT_MAX
    }
  };
}
