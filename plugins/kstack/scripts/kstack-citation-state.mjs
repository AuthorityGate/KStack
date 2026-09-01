import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseKStackConfigDocument } from './secret-broker/config-document-v2.mjs';

export const OPEN_PROFILE_EXCEPTIONS = Object.freeze([
  'readCitationGroundingModeSelectorV1',
  'kstack-citation-native-bootstrap-open-v1',
  'kstack-citation-coordinator-heartbeat-v1',
  'kstack-citation-instance-store-procfs-v1'
]);

export const EXHAUSTION_LEASE_MS = 14 * 24 * 60 * 60 * 1000;
export const CANONICAL_EXHAUSTION_POLICY = Object.freeze({
  name: 'Canonical Exhaustion Predicate',
  authenticatedSourceRequired: true,
  fingerprintMustMatch: true,
  startsThisCycle: 3,
  storedResultMustNotBe: 'pass',
  leaseMilliseconds: EXHAUSTION_LEASE_MS,
  boundary: 'strictly-before'
});

export const STAGE_ONE_TOKENS = Object.freeze([
  'STATE_NOT_QUALIFIED',
  'QUALIFICATION_ABSENT',
  'MUTATION_IN_PROGRESS',
  'STATE_EXPIRED',
  'STATE_RUN_LIMIT_REACHED'
]);

export const TOP_LEVEL_REASONS = Object.freeze([
  'LOCK_CONTENTION',
  'PLATFORM_PRECONDITION_FAILED',
  'STATE_MALFORMED',
  'STATE_EXPIRED',
  'STATE_RUN_LIMIT_REACHED',
  'STATE_NOT_QUALIFIED'
]);

export const PLATFORM_DETAILS = Object.freeze([
  'DIRECTORY_FSYNC_REJECTED',
  'INODE_IDENTITY_UNSTABLE',
  'O_EXCL_BROKEN',
  'RENAME_REPLACE_BROKEN',
  'PATH_TIMESTAMP_UPDATE_BROKEN',
  'INHERITED_FD_UNLINK_READ_BROKEN',
  'MODE_OWNERSHIP_UNENFORCEABLE',
  'STAGING_DEVICE_MISMATCH',
  'LOCAL_INSTANCE_STORE_UNAVAILABLE',
  'UNSUPPORTED_FILESYSTEM_TYPE',
  'NATIVE_ADDON_UNAVAILABLE',
  'VERSION_PROBE_FAILED',
  'TEMP_NAME_EXHAUSTED',
  'PROBE_IO_ERROR'
]);

export const STATE_NOT_QUALIFIED_DETAILS = Object.freeze([
  'MUTATION_IN_PROGRESS',
  'GIT_CHECK_IMPOSSIBLE',
  'FINGERPRINT_MISMATCH',
  'PLATFORM_RECEIPT_MISMATCH',
  'QUALIFICATION_ABSENT',
  'SMOKE_ATTEMPTS_EXHAUSTED'
]);

const HARD_LINUX_TYPES = new Set(['linux-ext', 'linux-xfs', 'linux-btrfs', 'linux-tmpfs', 'linux-overlay', 'linux-ntfs3', 'linux-exfat']);
const LINUX_FILESYSTEM_TYPES = new Map([
  [0x01021997n, 'linux-9p'],
  [0x0000ef53n, 'linux-ext'],
  [0x58465342n, 'linux-xfs'],
  [0x9123683en, 'linux-btrfs'],
  [0x01021994n, 'linux-tmpfs'],
  [0x794c7630n, 'linux-overlay'],
  [0x00006969n, 'linux-nfs'],
  [0xff534d42n, 'linux-cifs'],
  [0x65735546n, 'linux-fuse'],
  [0x7366746en, 'linux-ntfs3'],
  [0x2011bab0n, 'linux-exfat']
]);
const authenticatedRecords = new WeakSet();
const MAX_PROC_BYTES = 1_048_576;
export const MAX_CONFIG_BYTES = 1_048_576;
export const MAX_STATE_BYTES = 16_384;
export const STATE_SCHEMA_VERSION = 'kstack-citation-state-v2';
export const RECEIPT_ENCODING_VERSION = 'kstack-receipt-binding-v1';
export const RECEIPT_DIGEST_VERSION = 'kstack-receipt-binding-digest-v1';
export const PLATFORM_RECEIPT_BINDING_VERSION = 'kstack-platform-receipt-state-binding-v1';
export const INSTANCE_BINDING_VERSION = 'kstack-local-gate-instance-binding-v1';

const HEX_32 = /^[0-9a-f]{32}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const LINUX_STATE_TYPES = new Set(LINUX_FILESYSTEM_TYPES.values());

function stateError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function u64(value) {
  const result = Buffer.alloc(8);
  result.writeBigUInt64BE(BigInt(value));
  return result;
}

function framed(value) {
  return Buffer.concat([u64(value.length), value]);
}

function isUnicodeScalarSequence(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function jsonString(value) {
  if (typeof value !== 'string' || !isUnicodeScalarSequence(value)) throw stateError('STATE_CANONICAL_JSON_INVALID');
  return `"${value.replace(/["\\\u0000-\u001f]/gu, (character) => {
    const short = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' };
    return short[character] ?? `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
  })}"`;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return jsonString(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw stateError('STATE_CANONICAL_JSON_INVALID');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw stateError('STATE_CANONICAL_JSON_INVALID');
  const keys = Object.keys(value).sort(compareUtf8);
  return `{${keys.map((key) => `${jsonString(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function stateWithoutMac(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw stateError('STATE_MALFORMED');
  const copy = {};
  for (const [key, value] of Object.entries(record)) if (key !== 'stateRecordMac') copy[key] = value;
  return copy;
}

function exactOwnKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).sort(compareUtf8).join('\0') === [...keys].sort(compareUtf8).join('\0');
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !TIMESTAMP.test(value) || value.startsWith('0000-')) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validNativeBinding(value) {
  return exactOwnKeys(value, ['abiVersion', 'artifactDigest', 'packageName', 'packageVersion', 'targetTriple'])
    && value.abiVersion === 'kstack-citation-fs-native-abi-v2'
    && HEX_64.test(value.artifactDigest)
    && value.packageName === '@kstack/citation-fs-native'
    && typeof value.packageVersion === 'string' && value.packageVersion.length > 0 && value.packageVersion.length <= 64
    && ['linux-x64-gnu', 'linux-arm64-gnu'].includes(value.targetTriple);
}

export function validatePlatformReceiptV1(value) {
  const keys = ['encodingVersion', 'preconditionVersion', 'nativeAddonBinding', 'stateDirectoryPath', 'stateDirectoryDevice', 'filesystemType', 'buildCacheRoot', 'buildCacheDevice', 'buildCacheFilesystemType', 'deploymentFingerprint'];
  return exactOwnKeys(value, keys)
    && value.encodingVersion === RECEIPT_ENCODING_VERSION
    && value.preconditionVersion === 'kstack-citation-filesystem-precondition-v1'
    && validNativeBinding(value.nativeAddonBinding)
    && typeof value.stateDirectoryPath === 'string' && path.isAbsolute(value.stateDirectoryPath)
    && /^(0|[1-9][0-9]*)$/.test(value.stateDirectoryDevice)
    && LINUX_STATE_TYPES.has(value.filesystemType)
    && typeof value.buildCacheRoot === 'string' && path.isAbsolute(value.buildCacheRoot)
    && /^(0|[1-9][0-9]*)$/.test(value.buildCacheDevice)
    && HARD_LINUX_TYPES.has(value.buildCacheFilesystemType)
    && HEX_64.test(value.deploymentFingerprint);
}

export function receiptDigestV1(receipt) {
  if (!validatePlatformReceiptV1(receipt)) throw stateError('PLATFORM_RECEIPT_MISMATCH');
  const tag = Buffer.from(RECEIPT_DIGEST_VERSION, 'ascii');
  const bytes = Buffer.from(canonicalJson(receipt), 'utf8');
  return crypto.createHash('sha256').update(Buffer.concat([framed(tag), framed(bytes)])).digest('hex');
}

export function platformReceiptBindingV1(receipt) {
  const receiptDigest = receiptDigestV1(receipt);
  return {
    bindingVersion: PLATFORM_RECEIPT_BINDING_VERSION,
    receiptEncodingVersion: RECEIPT_ENCODING_VERSION,
    receiptDigestVersion: RECEIPT_DIGEST_VERSION,
    receiptDigest,
    preconditionVersion: receipt.preconditionVersion,
    nativeAddonBinding: structuredClone(receipt.nativeAddonBinding),
    stateDirectoryPath: receipt.stateDirectoryPath,
    stateDirectoryDevice: receipt.stateDirectoryDevice,
    filesystemType: receipt.filesystemType,
    buildCacheRoot: receipt.buildCacheRoot,
    buildCacheDevice: receipt.buildCacheDevice,
    buildCacheFilesystemType: receipt.buildCacheFilesystemType
  };
}

export function localGateInstanceIdBindingV1(rawKey) {
  const key = ownedKey(rawKey);
  const tag = Buffer.from('kstack-local-gate-instance-binding-digest-v1', 'ascii');
  try {
    return { bindingVersion: INSTANCE_BINDING_VERSION, instanceIdDigest: crypto.createHash('sha256').update(Buffer.concat([framed(tag), framed(key)])).digest('hex') };
  } finally {
    key.fill(0);
  }
}

function validPlatformBinding(value) {
  return exactOwnKeys(value, ['bindingVersion', 'receiptEncodingVersion', 'receiptDigestVersion', 'receiptDigest', 'preconditionVersion', 'nativeAddonBinding', 'stateDirectoryPath', 'stateDirectoryDevice', 'filesystemType', 'buildCacheRoot', 'buildCacheDevice', 'buildCacheFilesystemType'])
    && value.bindingVersion === PLATFORM_RECEIPT_BINDING_VERSION
    && value.receiptEncodingVersion === RECEIPT_ENCODING_VERSION
    && value.receiptDigestVersion === RECEIPT_DIGEST_VERSION
    && HEX_64.test(value.receiptDigest)
    && value.preconditionVersion === 'kstack-citation-filesystem-precondition-v1'
    && validNativeBinding(value.nativeAddonBinding)
    && typeof value.stateDirectoryPath === 'string' && path.isAbsolute(value.stateDirectoryPath)
    && /^(0|[1-9][0-9]*)$/.test(value.stateDirectoryDevice)
    && LINUX_STATE_TYPES.has(value.filesystemType)
    && typeof value.buildCacheRoot === 'string' && path.isAbsolute(value.buildCacheRoot)
    && /^(0|[1-9][0-9]*)$/.test(value.buildCacheDevice)
    && HARD_LINUX_TYPES.has(value.buildCacheFilesystemType);
}

function validSmoke(value) {
  const keys = ['result', 'smokeStartsThisCycle', 'attemptOrdinal', 'fixtureHash', 'startedAt', 'completedAt', 'providerResultHashes', 'providerStructuralCompleteness', 'providerExactMatchCounts', 'combinedExactMatchCount', 'providerOrdinaryProseMismatchCounts', 'combinedOrdinaryProseMismatchCount'];
  if (!exactOwnKeys(value, keys) || !['not_run', 'pass', 'fail'].includes(value.result)
      || !Number.isInteger(value.smokeStartsThisCycle) || value.smokeStartsThisCycle < 0 || value.smokeStartsThisCycle > 3
      || !Number.isInteger(value.attemptOrdinal) || value.attemptOrdinal < 1 || value.attemptOrdinal > 3
      || !HEX_64.test(value.fixtureHash) || !validTimestamp(value.startedAt)
      || !(value.completedAt === null || validTimestamp(value.completedAt))
      || !Array.isArray(value.providerResultHashes) || value.providerResultHashes.length !== 2 || !value.providerResultHashes.every((item) => item === null || HEX_64.test(item))
      || !Array.isArray(value.providerStructuralCompleteness) || value.providerStructuralCompleteness.length !== 2 || !value.providerStructuralCompleteness.every((item) => typeof item === 'boolean')
      || !Array.isArray(value.providerExactMatchCounts) || value.providerExactMatchCounts.length !== 2 || !value.providerExactMatchCounts.every((item) => Number.isInteger(item) && item >= 0 && item <= 50)
      || !Array.isArray(value.providerOrdinaryProseMismatchCounts) || value.providerOrdinaryProseMismatchCounts.length !== 2 || !value.providerOrdinaryProseMismatchCounts.every((item) => Number.isInteger(item) && item >= 0 && item <= 30)
      || !Number.isInteger(value.combinedExactMatchCount) || value.combinedExactMatchCount !== value.providerExactMatchCounts[0] + value.providerExactMatchCounts[1]
      || !Number.isInteger(value.combinedOrdinaryProseMismatchCount) || value.combinedOrdinaryProseMismatchCount !== value.providerOrdinaryProseMismatchCounts[0] + value.providerOrdinaryProseMismatchCounts[1]) return false;
  if (value.result === 'not_run') return value.completedAt === null && value.providerResultHashes.every((item) => item === null)
    && value.providerStructuralCompleteness.every((item) => item === false) && value.combinedExactMatchCount === 0 && value.combinedOrdinaryProseMismatchCount === 0;
  if (value.completedAt === null || Date.parse(value.completedAt) < Date.parse(value.startedAt)) return false;
  const pass = value.providerStructuralCompleteness.every(Boolean) && value.providerResultHashes.every((item) => item !== null)
    && value.providerExactMatchCounts.every((item) => item >= 49) && value.providerOrdinaryProseMismatchCounts.every((item) => item === 0);
  return value.result === (pass ? 'pass' : 'fail') && (value.result !== 'pass' || value.smokeStartsThisCycle === 0);
}

const SHADOW_REASONS = ['no_material_loss', 'material_loss', 'semantic_distortion', 'invocation_instability', 'overlay_unusable', 'other_review_needed'];
function validShadow(value) {
  if (!exactOwnKeys(value, ['judgment', 'dualRuns', 'reasonCodes', 'completedAt']) || !['not_run', 'go', 'no-go'].includes(value.judgment)
      || !Array.isArray(value.reasonCodes) || value.reasonCodes.length > 8 || !value.reasonCodes.every((item) => SHADOW_REASONS.includes(item))) return false;
  if (value.reasonCodes.some((item, index) => index && SHADOW_REASONS.indexOf(item) < SHADOW_REASONS.indexOf(value.reasonCodes[index - 1]))) return false;
  return value.judgment === 'not_run'
    ? value.dualRuns === 0 && value.reasonCodes.length === 0 && value.completedAt === null
    : Number.isInteger(value.dualRuns) && value.dualRuns >= 5 && value.dualRuns <= 10 && validTimestamp(value.completedAt);
}

export function validateStateRecordV2(record) {
  const keys = ['stateSchemaVersion', 'deploymentFingerprint', 'stateRecordMac', 'platformReceiptBinding', 'localGateInstanceIdBinding', 'stateGeneration', 'mutationInProgress', 'smoke', 'shadow', 'advisoryRunsSinceGo'];
  return exactOwnKeys(record, keys) && record.stateSchemaVersion === STATE_SCHEMA_VERSION && HEX_64.test(record.deploymentFingerprint) && HEX_64.test(record.stateRecordMac)
    && validPlatformBinding(record.platformReceiptBinding)
    && exactOwnKeys(record.localGateInstanceIdBinding, ['bindingVersion', 'instanceIdDigest'])
    && record.localGateInstanceIdBinding.bindingVersion === INSTANCE_BINDING_VERSION && HEX_64.test(record.localGateInstanceIdBinding.instanceIdDigest)
    && Number.isSafeInteger(record.stateGeneration) && record.stateGeneration >= 0
    && (record.mutationInProgress === null || (exactOwnKeys(record.mutationInProgress, ['kind', 'mutationId', 'startedAt']) && ['smoke', 'shadow'].includes(record.mutationInProgress.kind) && HEX_32.test(record.mutationInProgress.mutationId) && validTimestamp(record.mutationInProgress.startedAt)))
    && validSmoke(record.smoke) && validShadow(record.shadow)
    && Number.isInteger(record.advisoryRunsSinceGo) && record.advisoryRunsSinceGo >= 0 && record.advisoryRunsSinceGo <= 50;
}

export function parseCanonicalStateRecordV2(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (bytes.length === 0 || bytes.length > MAX_STATE_BYTES) throw stateError('STATE_MALFORMED');
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw stateError('STATE_MALFORMED'); }
  if (!validateStateRecordV2(parsed) || canonicalJson(parsed) !== bytes.toString('utf8')) throw stateError('STATE_MALFORMED');
  return parsed;
}

export function parseCanonicalReceiptV1(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw stateError('PLATFORM_RECEIPT_MISMATCH'); }
  if (!validatePlatformReceiptV1(parsed) || canonicalJson(parsed) !== bytes.toString('utf8')) throw stateError('PLATFORM_RECEIPT_MISMATCH');
  return parsed;
}

function ownedKey(rawKey) {
  if (!Buffer.isBuffer(rawKey) || rawKey.length !== 16) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  return Buffer.from(rawKey);
}

function stateMacFromOwnedKey(record, key, onZeroize) {
  const keyDomain = Buffer.from('kstack-state-record-mac-key-v1', 'ascii');
  const messageDomain = Buffer.from('kstack-state-record-mac-message-v1', 'ascii');
  let stateKey;
  try {
    stateKey = crypto.createHmac('sha256', key).update(framed(keyDomain)).digest();
    const content = Buffer.from(canonicalJson(stateWithoutMac(record)), 'utf8');
    return crypto.createHmac('sha256', stateKey).update(Buffer.concat([framed(messageDomain), framed(content)])).digest();
  } finally {
    if (stateKey) {
      stateKey.fill(0);
      onZeroize?.('Kstate', stateKey);
    }
  }
}

export function signStateRecordV1(record, rawKey, options = {}) {
  const key = ownedKey(rawKey);
  try {
    const unsigned = structuredClone(stateWithoutMac(record));
    const mac = stateMacFromOwnedKey(unsigned, key, options.onZeroize);
    try {
      return { ...unsigned, stateRecordMac: mac.toString('hex') };
    } finally {
      mac.fill(0);
    }
  } finally {
    key.fill(0);
    options.onZeroize?.('K', key);
  }
}

export function createStateMacTelemetryV1() {
  return { stateMacVerificationFailures: 0, eventLines: [] };
}

function recordMacFailure(options) {
  const telemetry = options.telemetry;
  if (!telemetry) return;
  if (!Number.isSafeInteger(telemetry.stateMacVerificationFailures) || telemetry.stateMacVerificationFailures < 0 || !Array.isArray(telemetry.eventLines)) {
    throw stateError('STATE_MAC_TELEMETRY_INVALID');
  }
  const firstFailure = telemetry.stateMacVerificationFailures === 0;
  telemetry.stateMacVerificationFailures += 1;
  if (firstFailure) {
    const line = 'CITATION_GROUNDING_STATE_MAC_INVALID';
    telemetry.eventLines.push(line);
    options.onEvent?.(line);
  }
}

export function authenticateStateRecordV1(record, rawKey, options = {}) {
  const key = ownedKey(rawKey);
  try {
    if (typeof record?.stateRecordMac !== 'string' || !/^[0-9a-f]{64}$/.test(record.stateRecordMac)) {
      recordMacFailure(options);
      return { status: 'authenticated-absence', macInvalid: true };
    }
    const expected = stateMacFromOwnedKey(record, key, options.onZeroize);
    const observed = Buffer.from(record.stateRecordMac, 'hex');
    let valid;
    try {
      valid = crypto.timingSafeEqual(expected, observed);
    } finally {
      expected.fill(0);
      observed.fill(0);
    }
    if (!valid) {
      recordMacFailure(options);
      return { status: 'authenticated-absence', macInvalid: true };
    }
    const authenticated = Object.freeze({ status: 'authenticated', record: structuredClone(record) });
    authenticatedRecords.add(authenticated);
    return authenticated;
  } finally {
    key.fill(0);
    options.onZeroize?.('K', key);
  }
}

function authenticatedRecord(value) {
  return value && authenticatedRecords.has(value) ? value.record : null;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw stateError('STATE_MALFORMED');
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value || value.startsWith('0000-')) throw stateError('STATE_MALFORMED');
  return milliseconds;
}

export function canonicalExhaustionPredicate(authenticatedState, currentFingerprint, now = new Date()) {
  const record = authenticatedRecord(authenticatedState);
  if (!record) return false;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) throw stateError('STATE_MALFORMED');
  const result = record.smoke?.result;
  const persistedTimes = [record.smoke?.startedAt, record.smoke?.completedAt, record.shadow?.completedAt, record.mutationInProgress?.startedAt].filter((value) => value !== null && value !== undefined);
  if (persistedTimes.some((value) => timestamp(value) > nowMs)) throw stateError('STATE_MALFORMED');
  if (result === 'pass') return false;
  if (!['fail', 'not_run'].includes(result)) throw stateError('STATE_MALFORMED');
  const anchor = timestamp(result === 'fail' ? record.smoke.completedAt : record.smoke.startedAt);
  return record.deploymentFingerprint === currentFingerprint
    && record.smoke.smokeStartsThisCycle === CANONICAL_EXHAUSTION_POLICY.startsThisCycle
    && nowMs < anchor + CANONICAL_EXHAUSTION_POLICY.leaseMilliseconds;
}

export function nextSmokeCycleCountersV1(authenticatedState, currentFingerprint, now = new Date()) {
  const record = authenticatedRecord(authenticatedState);
  if (!record) return { smokeStartsThisCycle: 1, attemptOrdinal: 1, stateGeneration: 1 };
  if (canonicalExhaustionPredicate(authenticatedState, currentFingerprint, now)) throw stateError('SMOKE_ATTEMPTS_EXHAUSTED');
  const result = record.smoke?.result;
  const anchor = result === 'fail' ? record.smoke?.completedAt : record.smoke?.startedAt;
  const newCycle = result === 'pass' || record.deploymentFingerprint !== currentFingerprint || (anchor && Number(now) >= timestamp(anchor) + EXHAUSTION_LEASE_MS);
  const count = newCycle ? 1 : record.smoke.smokeStartsThisCycle + 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 3) throw stateError('STATE_MALFORMED');
  return {
    smokeStartsThisCycle: count,
    attemptOrdinal: count,
    stateGeneration: Math.min(record.stateGeneration + 1, Number.MAX_SAFE_INTEGER)
  };
}

function qualificationExpired(record, nowMs) {
  const timestamps = [];
  if (record.smoke?.result === 'pass') timestamps.push(record.smoke.completedAt);
  if (record.shadow?.judgment === 'go') timestamps.push(record.shadow.completedAt);
  return timestamps.some((value) => timestamp(value) + EXHAUSTION_LEASE_MS <= nowMs);
}

export function stageOneAdvisoryPrefilterV1(record, now = new Date()) {
  const telemetry = Object.freeze({ stateMacVerificationFailures: 0, macInvalidEvent: false });
  if (record === null || record === undefined) return { outcome: 'reject', token: 'STATE_NOT_QUALIFIED', telemetry };
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) throw stateError('STATE_MALFORMED');
  if (qualificationExpired(record, nowMs)) return { outcome: 'reject', token: 'STATE_EXPIRED', telemetry };
  if (record.advisoryRunsSinceGo === 50) return { outcome: 'reject', token: 'STATE_RUN_LIMIT_REACHED', telemetry };
  if (record.mutationInProgress !== null) return { outcome: 'reject', token: 'MUTATION_IN_PROGRESS', telemetry };
  if (record.smoke?.result !== 'pass' || record.shadow?.judgment !== 'go') return { outcome: 'reject', token: 'QUALIFICATION_ABSENT', telemetry };
  return { outcome: 'candidate', telemetry };
}

export function formatOrdinaryAdvisoryLine({ stageOneToken, reason, detail } = {}) {
  if (stageOneToken !== undefined) {
    if (!STAGE_ONE_TOKENS.includes(stageOneToken)) throw stateError('ORDINARY_ADVISORY_REASON_INVALID');
    return `CITATION_GROUNDING_ADVISORY_INACTIVE ${stageOneToken}`;
  }
  if (!TOP_LEVEL_REASONS.includes(reason)) throw stateError('ORDINARY_ADVISORY_REASON_INVALID');
  if (reason === 'LOCK_CONTENTION') {
    if (detail !== undefined) throw stateError('ORDINARY_ADVISORY_REASON_INVALID');
    return 'CITATION_GROUNDING_ADVISORY_UNAVAILABLE LOCK_CONTENTION';
  }
  if (reason === 'PLATFORM_PRECONDITION_FAILED') {
    if (!PLATFORM_DETAILS.includes(detail)) throw stateError('ORDINARY_ADVISORY_REASON_INVALID');
    if (detail === 'NATIVE_ADDON_UNAVAILABLE') return 'CITATION_GROUNDING_ADVISORY_UNAVAILABLE NATIVE_ADDON_UNAVAILABLE';
    return `CITATION_GROUNDING_ADVISORY_UNAVAILABLE PLATFORM_PRECONDITION_FAILED ${detail}`;
  }
  if (['STATE_MALFORMED', 'STATE_EXPIRED', 'STATE_RUN_LIMIT_REACHED'].includes(reason)) {
    if (detail !== undefined) throw stateError('ORDINARY_ADVISORY_REASON_INVALID');
    return `CITATION_GROUNDING_ADVISORY_INACTIVE ${reason}`;
  }
  if (reason === 'STATE_NOT_QUALIFIED') {
    if (detail !== undefined && !STATE_NOT_QUALIFIED_DETAILS.includes(detail)) throw stateError('ORDINARY_ADVISORY_REASON_INVALID');
    return `CITATION_GROUNDING_ADVISORY_INACTIVE STATE_NOT_QUALIFIED${detail ? ` ${detail}` : ''}`;
  }
  throw stateError('ORDINARY_ADVISORY_REASON_INVALID');
}

function rawFilesystemType(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
}

function sameNodeIdentity(left, right) {
  return left.isDirectory() === right.isDirectory() && left.isFile() === right.isFile() && left.dev === right.dev && left.ino === right.ino;
}

export function readCitationGroundingModeSelectorV1(checkoutRoot, { fsImpl = fs } = {}) {
  const configPath = path.join(checkoutRoot, '.kstack', 'config.json');
  let fd;
  try {
    const before = fsImpl.lstatSync(configPath, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > BigInt(MAX_CONFIG_BYTES)) return 'invalid';
    const noFollow = fsImpl.constants.O_NOFOLLOW ?? 0;
    fd = fsImpl.openSync(configPath, fsImpl.constants.O_RDONLY | noFollow);
    const heldBefore = fsImpl.fstatSync(fd, { bigint: true });
    if (!sameNodeIdentity(before, heldBefore) || heldBefore.nlink !== 1n || heldBefore.size > BigInt(MAX_CONFIG_BYTES)) return 'invalid';
    const bytes = readBoundedFd(fsImpl, fd, MAX_CONFIG_BYTES);
    const heldAfter = fsImpl.fstatSync(fd, { bigint: true });
    const after = fsImpl.lstatSync(configPath, { bigint: true });
    if (!sameNodeIdentity(heldBefore, heldAfter) || !sameNodeIdentity(heldAfter, after)
        || heldBefore.size !== heldAfter.size || heldAfter.size !== BigInt(bytes.length)
        || heldBefore.mtimeNs !== heldAfter.mtimeNs || heldBefore.ctimeNs !== heldAfter.ctimeNs) return 'invalid';
    const parsed = parseKStackConfigDocument(bytes);
    const designGate = parsed?.workflow?.designGate;
    if (!designGate || !Object.hasOwn(designGate, 'citationGrounding') || designGate.citationGrounding === 'off') return 'legacy-off';
    return designGate.citationGrounding === 'advisory' ? 'candidate-advisory' : 'invalid';
  } catch (error) {
    return error?.code === 'ENOENT' ? 'legacy-off' : 'invalid';
  } finally {
    if (fd !== undefined) fsImpl.closeSync(fd);
  }
}

function openReconciled(fsImpl, file, flags, expected) {
  const before = fsImpl.lstatSync(file, { bigint: true });
  if ((expected === 'directory' && !before.isDirectory()) || (expected === 'file' && !before.isFile()) || before.isSymbolicLink()) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  const noFollow = fsImpl.constants.O_NOFOLLOW;
  if (!noFollow) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  const fd = fsImpl.openSync(file, flags | noFollow | (expected === 'directory' ? fsImpl.constants.O_DIRECTORY : 0));
  try {
    const held = fsImpl.fstatSync(fd, { bigint: true });
    const after = fsImpl.lstatSync(file, { bigint: true });
    if (!sameNodeIdentity(before, held) || !sameNodeIdentity(held, after)) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    return { fd, held };
  } catch (error) {
    fsImpl.closeSync(fd);
    throw error;
  }
}

function recheckOpened(fsImpl, file, opened) {
  const held = fsImpl.fstatSync(opened.fd, { bigint: true });
  const pathState = fsImpl.lstatSync(file, { bigint: true });
  if (!sameNodeIdentity(opened.held, held) || !sameNodeIdentity(held, pathState)) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
}

function readBoundedFd(fsImpl, fd, byteLimit = MAX_PROC_BYTES) {
  const chunks = [];
  let total = 0;
  let position = 0;
  while (true) {
    const chunk = Buffer.alloc(Math.min(65_536, byteLimit + 1 - total));
    const count = fsImpl.readSync(fd, chunk, 0, chunk.length, position);
    if (count === 0) break;
    chunks.push(chunk.subarray(0, count));
    total += count;
    position += count;
    if (total > byteLimit) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  }
  return Buffer.concat(chunks);
}

function readProcFile(fsImpl, file) {
  const opened = openReconciled(fsImpl, file, fsImpl.constants.O_RDONLY, 'file');
  try {
    if (opened.held.nlink !== 1n || opened.held.size > BigInt(MAX_PROC_BYTES)) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    const bytes = readBoundedFd(fsImpl, opened.fd);
    const after = fsImpl.fstatSync(opened.fd, { bigint: true });
    if (!sameNodeIdentity(opened.held, after) || after.size !== opened.held.size) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    return bytes;
  } finally {
    fsImpl.closeSync(opened.fd);
  }
}

function parseMountId(fdinfo) {
  const matches = fdinfo.toString('utf8').split('\n').filter((line) => line.startsWith('mnt_id:'));
  if (matches.length !== 1) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  const value = matches[0].match(/^mnt_id:\s*(0|[1-9][0-9]*)$/)?.[1];
  if (!value) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  return value;
}

function unescapeMount(value) {
  return value.replace(/\\(040|011|012|134)/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function selectMountRecord(mountinfo, mountId) {
  const matches = mountinfo.toString('utf8').trimEnd().split('\n').map((raw) => {
    const separator = raw.indexOf(' - ');
    if (separator < 0) return null;
    const before = raw.slice(0, separator).split(' ');
    const after = raw.slice(separator + 3).split(' ');
    return before[0] === mountId ? { raw, device: before[2], mountPoint: unescapeMount(before[4] ?? ''), mountOptions: before[5]?.split(',') ?? [], filesystemType: after[0], superOptions: after[2]?.split(',') ?? [] } : null;
  }).filter(Boolean);
  if (matches.length !== 1) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  return matches[0];
}

function selectProcMountRecord(mountinfo, device) {
  const matches = mountinfo.toString('utf8').trimEnd().split('\n').map((raw) => {
    const separator = raw.indexOf(' - ');
    if (separator < 0) return null;
    const before = raw.slice(0, separator).split(' ');
    const after = raw.slice(separator + 3).split(' ');
    return unescapeMount(before[4] ?? '') === '/proc' && before[2] === device && after[0] === 'proc'
      ? { mountPoint: '/proc', filesystemType: 'proc' }
      : null;
  }).filter(Boolean);
  if (matches.length !== 1) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  return matches[0];
}

function linuxDeviceText(deviceId) {
  const major = ((deviceId >> 8n) & 0xfffn) | ((deviceId >> 32n) & 0xfffff000n);
  const minor = (deviceId & 0xffn) | ((deviceId >> 12n) & 0xffffff00n);
  return `${major}:${minor}`;
}

function pathIsOnMount(candidate, mountPoint) {
  return candidate === mountPoint || candidate.startsWith(mountPoint === '/' ? '/' : `${mountPoint}/`);
}

function mountinfoType(type) {
  if (['ext2', 'ext3', 'ext4'].includes(type)) return 'linux-ext';
  if (type === 'xfs') return 'linux-xfs';
  if (type === 'btrfs') return 'linux-btrfs';
  if (type === 'tmpfs') return 'linux-tmpfs';
  if (type === 'overlay') return 'linux-overlay';
  if (type === '9p') return 'linux-9p';
  if (type === 'nfs' || type === 'nfs4') return 'linux-nfs';
  if (type === 'cifs' || type === 'smb3') return 'linux-cifs';
  if (type === 'fuse' || type.startsWith('fuse.')) return 'linux-fuse';
  if (type === 'ntfs3') return 'linux-ntfs3';
  if (type === 'exfat') return 'linux-exfat';
  return null;
}

function inspectShape(result) {
  const keys = result && typeof result === 'object' ? Object.keys(result).sort() : [];
  if (!result || keys.join('\0') !== ['abiVersion', 'deviceId', 'fileIdentity', 'filesystemTypeRaw', 'pathRaw', 'platform'].sort().join('\0')
      || result.abiVersion !== 'kstack-citation-fs-native-abi-v2' || result.platform !== 'linux'
      || typeof result.pathRaw !== 'string' || typeof result.deviceId !== 'bigint' || result.deviceId < 0n
      || typeof result.fileIdentity !== 'bigint' || result.fileIdentity < 0n || typeof result.filesystemTypeRaw !== 'bigint' || result.filesystemTypeRaw < 0n) {
    throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  }
  return result;
}

export function classifyInstanceKeyStoreV1({ addon, heldAncestorFd, fsImpl = fs, pid = process.pid }) {
  if (!Number.isSafeInteger(heldAncestorFd) || heldAncestorFd < 0 || !Number.isSafeInteger(pid) || pid <= 0 || String(pid) !== `${pid}`) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  if (!addon || typeof addon.inspectDirectoryFd !== 'function') throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  const ancestor = inspectShape(addon.inspectDirectoryFd(heldAncestorFd));
  const filesystemType = LINUX_FILESYSTEM_TYPES.get(rawFilesystemType(ancestor.filesystemTypeRaw));
  if (!HARD_LINUX_TYPES.has(filesystemType)) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  const proc = openReconciled(fsImpl, '/proc', fsImpl.constants.O_RDONLY, 'directory');
  const pidDirectory = openReconciled(fsImpl, `/proc/${pid}`, fsImpl.constants.O_RDONLY, 'directory');
  const fdinfoDirectory = openReconciled(fsImpl, `/proc/${pid}/fdinfo`, fsImpl.constants.O_RDONLY, 'directory');
  try {
    const procBefore = inspectShape(addon.inspectDirectoryFd(proc.fd));
    if (rawFilesystemType(procBefore.filesystemTypeRaw) !== 0x00009fa0n) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    const procStatfs = fsImpl.statfsSync('/proc', { bigint: true });
    if (rawFilesystemType(procStatfs.type) !== 0x00009fa0n) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    const fdinfoPath = `/proc/${pid}/fdinfo/${heldAncestorFd}`;
    const mountinfoPath = `/proc/${pid}/mountinfo`;
    const firstFdinfo = readProcFile(fsImpl, fdinfoPath);
    const firstMountinfo = readProcFile(fsImpl, mountinfoPath);
    const secondFdinfo = readProcFile(fsImpl, fdinfoPath);
    const secondMountinfo = readProcFile(fsImpl, mountinfoPath);
    if (!firstFdinfo.equals(secondFdinfo) || !firstMountinfo.equals(secondMountinfo)) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    const mountId = parseMountId(firstFdinfo);
    const record = selectMountRecord(firstMountinfo, mountId);
    if (mountinfoType(record.filesystemType) !== filesystemType || record.device !== linuxDeviceText(ancestor.deviceId)
        || !pathIsOnMount(ancestor.pathRaw, record.mountPoint)) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    selectProcMountRecord(firstMountinfo, linuxDeviceText(procBefore.deviceId));
    const procAfter = inspectShape(addon.inspectDirectoryFd(proc.fd));
    if (procAfter.deviceId !== procBefore.deviceId || procAfter.fileIdentity !== procBefore.fileIdentity || rawFilesystemType(procAfter.filesystemTypeRaw) !== 0x00009fa0n) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    const ancestorAfter = inspectShape(addon.inspectDirectoryFd(heldAncestorFd));
    if (ancestorAfter.pathRaw !== ancestor.pathRaw || ancestorAfter.deviceId !== ancestor.deviceId
        || ancestorAfter.fileIdentity !== ancestor.fileIdentity || ancestorAfter.filesystemTypeRaw !== ancestor.filesystemTypeRaw) throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
    recheckOpened(fsImpl, '/proc', proc);
    recheckOpened(fsImpl, `/proc/${pid}`, pidDirectory);
    recheckOpened(fsImpl, `/proc/${pid}/fdinfo`, fdinfoDirectory);
    return Object.freeze({ filesystemType, mountId, mountOptions: Object.freeze([...record.mountOptions]), superOptions: Object.freeze([...record.superOptions]), noexecIgnoredForDataRole: true });
  } catch (error) {
    if (error?.code === 'LOCAL_INSTANCE_STORE_UNAVAILABLE') throw error;
    throw stateError('LOCAL_INSTANCE_STORE_UNAVAILABLE');
  } finally {
    fsImpl.closeSync(fdinfoDirectory.fd);
    fsImpl.closeSync(pidDirectory.fd);
    fsImpl.closeSync(proc.fd);
  }
}
