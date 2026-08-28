import { types as utilTypes } from 'node:util';
import { KCRP_LIMITS } from './kstack-kcrp-core.mjs';
import { parseOfflineDispatchManifestV1 } from './kstack-kcrp-dispatch-manifest.mjs';
import {
  KCRP_CONTROL_JSON_MAX_BYTES, bytesSha256, canonicalJsonBytes, parseCanonicalJson
} from './kstack-kcrp-json.mjs';

export const KCRP_BYTE_BENCHMARK_BOUNDARY = Object.freeze({
  status: 'OFFLINE_SUBSET_ONLY',
  kind: 'kstack-kcrp-byte-benchmark-offline-subset-v1',
  dispatchAuthority: 'NONE',
  providerMeasurementAvailable: false
});

export const KCRP_BYTE_BENCHMARK_LIMITS = Object.freeze({ pairs: 256 });

export const KCRP_BYTE_BENCHMARK_PAIR_ERROR_PRECEDENCE = Object.freeze([
  'PAIR_ID_MISSING',
  'PAIR_ID_DESCRIPTOR_INVALID',
  'PAIR_ID_INVALID',
  'PAIR_ENVELOPE_INVALID'
]);

const INPUT_KEYS = ['benchmarkId', 'objectiveSha256', 'phase', 'reviewerSha256', 'governanceSha256', 'pairs'];
const PAIR_KEYS = ['pairId', 'full', 'treatment'];
const ARM_KEYS = [
  'objectiveSha256', 'phase', 'reviewerSha256', 'governanceSha256',
  'dispatchManifestSha256', 'manifestBytes', 'packetSha256', 'packetBytes'
];
const BLOCK_KEYS = [
  'objectiveSha256', 'phase', 'reviewerSha256', 'governanceSha256',
  'status', 'reason'
];
const HASH = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PHASES = new Set(['design', 'qc', 'review']);
const BLOCK_REASONS = new Set(['REDUCTION_BLOCKED', 'FULL_FALLBACK_BLOCKED', 'QUALIFICATION_UNAVAILABLE']);
const PAIR_DIAGNOSTICS = Object.freeze({
  PAIR_ID_MISSING: Object.freeze({ rank: 0, code: 'KCRP_BYTE_BENCHMARK_PAIR_ID_MISSING' }),
  PAIR_ID_DESCRIPTOR_INVALID: Object.freeze({ rank: 1, code: 'KCRP_BYTE_BENCHMARK_PAIR_ID_INVALID' }),
  PAIR_ID_INVALID: Object.freeze({ rank: 2, code: 'KCRP_BYTE_BENCHMARK_PAIR_ID_INVALID' }),
  PAIR_ENVELOPE_INVALID: Object.freeze({ rank: 3, code: 'KCRP_BYTE_BENCHMARK_PAIR_INVALID' }),
  VALID: Object.freeze({ rank: 4, code: null })
});
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteLength').get;
const TYPED_ARRAY_BYTE_OFFSET = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteOffset').get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'buffer').get;
const ARRAY_BUFFER_BYTE_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const ARRAY_BUFFER_RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get ?? null;
const ARRAY_BUFFER_DETACHED = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached')?.get ?? null;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function snapshot(value) {
  return deepFreeze(parseCanonicalJson(canonicalJsonBytes(value)));
}

function ordinaryRecord(value) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) return false;
  try { return !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
  catch { return false; }
}

function closedDescriptors(value, keys, code) {
  if (!ordinaryRecord(value)) fail(code);
  let ownKeys;
  try { ownKeys = Reflect.ownKeys(value); }
  catch { fail(code); }
  if (ownKeys.length !== keys.length) fail(code);
  const seen = new Set();
  const descriptors = new Map();
  for (const key of ownKeys) {
    if (typeof key !== 'string' || !keys.includes(key) || seen.has(key)) fail(code);
    seen.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')
      || Object.hasOwn(descriptor, 'get') || Object.hasOwn(descriptor, 'set')) fail(code);
    descriptors.set(key, descriptor);
  }
  if (seen.size !== keys.length || keys.some((key) => !seen.has(key))) fail(code);
  return descriptors;
}

function exactRecord(value, keys, code) {
  const descriptors = closedDescriptors(value, keys, code);
  const output = {};
  for (const key of keys) {
    output[key] = descriptors.get(key).value;
  }
  return output;
}

function boundedArray(value, maximum, code) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) fail(code);
  let prototype;
  try { prototype = Object.getPrototypeOf(value); }
  catch { fail(code); }
  if (!Array.isArray(value) || prototype !== Array.prototype) fail(code);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (!lengthDescriptor || lengthDescriptor.enumerable || !Object.hasOwn(lengthDescriptor, 'value')
    || Object.hasOwn(lengthDescriptor, 'get') || Object.hasOwn(lengthDescriptor, 'set')) fail(code);
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 1 || length > maximum) fail(code);

  let ownKeys;
  try { ownKeys = Reflect.ownKeys(value); }
  catch { fail(code); }
  if (ownKeys.length !== length + 1) fail(code);
  const descriptors = new Array(length);
  let sawLength = false;
  for (const key of ownKeys) {
    if (typeof key !== 'string') fail(code);
    if (key === 'length') {
      if (sawLength) fail(code);
      sawLength = true;
      continue;
    }
    if (key.length > String(maximum - 1).length || !/^(0|[1-9][0-9]*)$/.test(key)) fail(code);
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key
      || descriptors[index] !== undefined) fail(code);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')
      || Object.hasOwn(descriptor, 'get') || Object.hasOwn(descriptor, 'set')) fail(code);
    descriptors[index] = descriptor;
  }
  if (!sawLength || descriptors.includes(undefined)) fail(code);
  return descriptors.map((descriptor) => descriptor.value);
}

function pairDiagnostic(classification, pairId = '') {
  const diagnostic = PAIR_DIAGNOSTICS[classification];
  return Object.freeze({
    classification,
    rank: diagnostic.rank,
    sortKey: classification === 'VALID' || classification === 'PAIR_ENVELOPE_INVALID' ? pairId : '',
    code: diagnostic.code
  });
}

function preAdmitPair(value) {
  if (!ordinaryRecord(value)) {
    return Object.freeze({ diagnostic: pairDiagnostic('PAIR_ENVELOPE_INVALID'), pair: null });
  }
  const pairIdDescriptor = Object.getOwnPropertyDescriptor(value, 'pairId');
  if (!pairIdDescriptor) {
    return Object.freeze({ diagnostic: pairDiagnostic('PAIR_ID_MISSING'), pair: null });
  }
  if (!pairIdDescriptor.enumerable || !Object.hasOwn(pairIdDescriptor, 'value')) {
    return Object.freeze({ diagnostic: pairDiagnostic('PAIR_ID_DESCRIPTOR_INVALID'), pair: null });
  }
  const pairId = pairIdDescriptor.value;
  if (typeof pairId !== 'string' || pairId.length > 128 || !ID.test(pairId)) {
    return Object.freeze({ diagnostic: pairDiagnostic('PAIR_ID_INVALID'), pair: null });
  }

  let ownKeys;
  try { ownKeys = Reflect.ownKeys(value); }
  catch { return Object.freeze({ diagnostic: pairDiagnostic('PAIR_ENVELOPE_INVALID', pairId), pair: null }); }
  const seen = new Set();
  let surfaceInvalid = ownKeys.length !== PAIR_KEYS.length;
  for (const key of ownKeys) {
    if (typeof key !== 'string' || !PAIR_KEYS.includes(key) || seen.has(key)) surfaceInvalid = true;
    else seen.add(key);
  }
  const fullDescriptor = Object.getOwnPropertyDescriptor(value, 'full');
  const treatmentDescriptor = Object.getOwnPropertyDescriptor(value, 'treatment');
  const envelopeInvalid = surfaceInvalid || seen.size !== PAIR_KEYS.length
    || !fullDescriptor || !fullDescriptor.enumerable || !Object.hasOwn(fullDescriptor, 'value')
    || Object.hasOwn(fullDescriptor, 'get') || Object.hasOwn(fullDescriptor, 'set')
    || !treatmentDescriptor || !treatmentDescriptor.enumerable || !Object.hasOwn(treatmentDescriptor, 'value')
    || Object.hasOwn(treatmentDescriptor, 'get') || Object.hasOwn(treatmentDescriptor, 'set');
  if (envelopeInvalid) {
    return Object.freeze({ diagnostic: pairDiagnostic('PAIR_ENVELOPE_INVALID', pairId), pair: null });
  }
  return Object.freeze({
    diagnostic: pairDiagnostic('VALID', pairId),
    pair: Object.freeze({ pairId, full: fullDescriptor.value, treatment: treatmentDescriptor.value })
  });
}

function comparePairAdmissions(left, right) {
  if (left.diagnostic.rank !== right.diagnostic.rank) return left.diagnostic.rank - right.diagnostic.rank;
  return asciiCompare(left.diagnostic.sortKey, right.diagnostic.sortKey);
}

function throwPairDiagnostic(diagnostic) {
  const evidence = snapshot({
    schemaVersion: 1,
    kind: 'kstack-kcrp-byte-benchmark-pair-diagnostic-v1',
    code: diagnostic.code,
    diagnosticClass: diagnostic.classification,
    precedenceRank: diagnostic.rank
  });
  const evidenceBytes = canonicalJsonBytes(evidence);
  const error = new Error(diagnostic.code);
  Object.assign(error, {
    code: diagnostic.code,
    evidence,
    evidenceSha256: bytesSha256(evidenceBytes)
  });
  throw error;
}

function readBytes(value, maximumBytes, code, ranges) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Buffer.prototype && prototype !== Uint8Array.prototype) fail(code);
  let byteLength;
  let byteOffset;
  let buffer;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH.call(value);
    byteOffset = TYPED_ARRAY_BYTE_OFFSET.call(value);
    buffer = TYPED_ARRAY_BUFFER.call(value);
  } catch { fail(code); }
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > maximumBytes
    || !Number.isSafeInteger(byteOffset) || byteOffset < 0
    || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) fail(code);
  let backingLength;
  try {
    if ((ARRAY_BUFFER_RESIZABLE && ARRAY_BUFFER_RESIZABLE.call(buffer))
      || (ARRAY_BUFFER_DETACHED && ARRAY_BUFFER_DETACHED.call(buffer))) fail(code);
    backingLength = ARRAY_BUFFER_BYTE_LENGTH.call(buffer);
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  }
  if (byteOffset > Number.MAX_SAFE_INTEGER - byteLength || byteOffset + byteLength > backingLength) fail(code);
  for (const key of ['byteLength', 'byteOffset', 'buffer']) if (Object.hasOwn(value, key)) fail(code);
  for (const prior of ranges) {
    if (prior.buffer === buffer && byteOffset < prior.end && prior.start < byteOffset + byteLength) {
      fail('KCRP_BYTE_BENCHMARK_ALIAS_INVALID');
    }
  }
  ranges.push({ buffer, start: byteOffset, end: byteOffset + byteLength });
  try { return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength)); }
  catch { fail(code); }
}

function validateIdentity(value, pattern, code) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code);
}

function sameIdentity(arm, benchmark) {
  if (arm.objectiveSha256 !== benchmark.objectiveSha256
    || arm.phase !== benchmark.phase
    || arm.reviewerSha256 !== benchmark.reviewerSha256
    || arm.governanceSha256 !== benchmark.governanceSha256) {
    fail('KCRP_BYTE_BENCHMARK_IDENTITY_MISMATCH');
  }
}

function availableArm(value, benchmark, expectedRoutes, ranges) {
  const arm = exactRecord(value, ARM_KEYS, 'KCRP_BYTE_BENCHMARK_ARM_INVALID');
  sameIdentity(arm, benchmark);
  validateIdentity(arm.dispatchManifestSha256, HASH, 'KCRP_BYTE_BENCHMARK_MANIFEST_IDENTITY_INVALID');
  validateIdentity(arm.packetSha256, HASH, 'KCRP_BYTE_BENCHMARK_PACKET_IDENTITY_INVALID');
  const manifestBytes = readBytes(
    arm.manifestBytes,
    KCRP_CONTROL_JSON_MAX_BYTES,
    'KCRP_BYTE_BENCHMARK_MANIFEST_BYTES_INVALID',
    ranges
  );
  if (bytesSha256(manifestBytes) !== arm.dispatchManifestSha256) fail('KCRP_BYTE_BENCHMARK_MANIFEST_STALE');
  const packetBytes = readBytes(
    arm.packetBytes,
    KCRP_LIMITS.packetBytes,
    'KCRP_BYTE_BENCHMARK_PACKET_BYTES_INVALID',
    ranges
  );
  if (bytesSha256(packetBytes) !== arm.packetSha256) fail('KCRP_BYTE_BENCHMARK_PACKET_STALE');
  const parsed = parseOfflineDispatchManifestV1(manifestBytes, {
    expectedDispatchManifestSha256: arm.dispatchManifestSha256,
    packetBytes
  });
  if (!expectedRoutes.has(parsed.manifest.route)) fail('KCRP_BYTE_BENCHMARK_ROUTE_INVALID');
  if (parsed.manifest.phase !== benchmark.phase) fail('KCRP_BYTE_BENCHMARK_IDENTITY_MISMATCH');
  return Object.freeze({
    route: parsed.manifest.route,
    manifestByteLength: manifestBytes.length,
    packetByteLength: packetBytes.length,
    totalByteLength: manifestBytes.length + packetBytes.length
  });
}

function blockedArm(value, benchmark) {
  const arm = exactRecord(value, BLOCK_KEYS, 'KCRP_BYTE_BENCHMARK_BLOCK_INVALID');
  sameIdentity(arm, benchmark);
  if (arm.status !== 'BLOCKED' || !BLOCK_REASONS.has(arm.reason)) fail('KCRP_BYTE_BENCHMARK_BLOCK_INVALID');
  return Object.freeze({ status: arm.status, reason: arm.reason });
}

function asciiCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'ascii'), Buffer.from(right, 'ascii'));
}

function gcd(left, right) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function ratio(numerator, denominator) {
  if (denominator <= 0n) fail('KCRP_BYTE_BENCHMARK_ARITHMETIC_INVALID');
  const divisor = gcd(numerator, denominator);
  return Object.freeze({
    numerator: (numerator / divisor).toString(),
    denominator: (denominator / divisor).toString()
  });
}

function addSafe(total, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0 || total > Number.MAX_SAFE_INTEGER - amount) {
    fail('KCRP_BYTE_BENCHMARK_ARITHMETIC_INVALID');
  }
  return total + amount;
}

export function runOfflineKcrpByteBenchmarkV1(input) {
  const admitted = exactRecord(input, INPUT_KEYS, 'KCRP_BYTE_BENCHMARK_INPUT_INVALID');
  validateIdentity(admitted.benchmarkId, ID, 'KCRP_BYTE_BENCHMARK_ID_INVALID');
  validateIdentity(admitted.objectiveSha256, HASH, 'KCRP_BYTE_BENCHMARK_IDENTITY_INVALID');
  validateIdentity(admitted.reviewerSha256, HASH, 'KCRP_BYTE_BENCHMARK_IDENTITY_INVALID');
  validateIdentity(admitted.governanceSha256, HASH, 'KCRP_BYTE_BENCHMARK_IDENTITY_INVALID');
  if (!PHASES.has(admitted.phase)) fail('KCRP_BYTE_BENCHMARK_PHASE_INVALID');
  const benchmark = Object.freeze({
    objectiveSha256: admitted.objectiveSha256,
    phase: admitted.phase,
    reviewerSha256: admitted.reviewerSha256,
    governanceSha256: admitted.governanceSha256
  });
  const pairs = boundedArray(admitted.pairs, KCRP_BYTE_BENCHMARK_LIMITS.pairs, 'KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID');
  const pairAdmissions = pairs.map((pairValue) => preAdmitPair(pairValue));
  pairAdmissions.sort(comparePairAdmissions);
  if (pairAdmissions[0].diagnostic.classification !== 'VALID') {
    throwPairDiagnostic(pairAdmissions[0].diagnostic);
  }
  const seenIds = new Set();
  const pairRecords = [];
  for (const admission of pairAdmissions) {
    const pair = admission.pair;
    if (seenIds.has(pair.pairId)) fail('KCRP_BYTE_BENCHMARK_PAIR_ID_INVALID');
    seenIds.add(pair.pairId);
    pairRecords.push(pair);
  }
  const ranges = [];
  const observations = [];
  for (const pair of pairRecords) {
    const full = availableArm(pair.full, benchmark, new Set(['full-required']), ranges);
    if (!pair.treatment || typeof pair.treatment !== 'object' || utilTypes.isProxy(pair.treatment)) {
      fail('KCRP_BYTE_BENCHMARK_TREATMENT_INVALID');
    }
    const statusDescriptor = Object.getOwnPropertyDescriptor(pair.treatment, 'status');
    const treatment = statusDescriptor
      ? blockedArm(pair.treatment, benchmark)
      : availableArm(pair.treatment, benchmark, new Set(['reduced', 'full-fallback']), ranges);
    observations.push(Object.freeze({ pairId: pair.pairId, full, treatment }));
  }

  let fullManifestBytes = 0;
  let fullPacketBytes = 0;
  let treatmentManifestBytes = 0;
  let treatmentPacketBytes = 0;
  let reduced = 0;
  let fullFallback = 0;
  let blocked = 0;
  for (const observation of observations) {
    fullManifestBytes = addSafe(fullManifestBytes, observation.full.manifestByteLength);
    fullPacketBytes = addSafe(fullPacketBytes, observation.full.packetByteLength);
    if (observation.treatment.status === 'BLOCKED') { blocked += 1; continue; }
    treatmentManifestBytes = addSafe(treatmentManifestBytes, observation.treatment.manifestByteLength);
    treatmentPacketBytes = addSafe(treatmentPacketBytes, observation.treatment.packetByteLength);
    if (observation.treatment.route === 'reduced') reduced += 1;
    else fullFallback += 1;
  }
  const fullTotalBytes = addSafe(fullManifestBytes, fullPacketBytes);
  const treatmentTotalBytes = blocked === 0 ? addSafe(treatmentManifestBytes, treatmentPacketBytes) : null;
  const delta = treatmentTotalBytes === null ? null : fullTotalBytes - treatmentTotalBytes;
  const exactSavings = delta === null ? null : ratio(BigInt(delta), BigInt(fullTotalBytes));
  const basisPoints = delta === null ? null : ratio(BigInt(delta) * 10_000n, BigInt(fullTotalBytes));
  const reason = blocked > 0 ? 'BLOCKED_PAIR_PRESENT'
    : delta <= 0 ? 'NO_REDUCTION'
      : fullFallback > 0 ? 'FULL_FALLBACK_INCLUDED' : 'BYTE_SAVINGS_MEASURED';
  const status = blocked > 0 ? 'UNAVAILABLE'
    : fullFallback > 0 ? 'MEASURED_WITH_FULL_FALLBACK' : 'MEASURED';

  const report = snapshot({
    schemaVersion: 1,
    kind: KCRP_BYTE_BENCHMARK_BOUNDARY.kind,
    boundary: KCRP_BYTE_BENCHMARK_BOUNDARY.status,
    dispatchAuthority: KCRP_BYTE_BENCHMARK_BOUNDARY.dispatchAuthority,
    providerMeasurementAvailable: false,
    benchmarkId: admitted.benchmarkId,
    objectiveSha256: admitted.objectiveSha256,
    phase: admitted.phase,
    reviewerSha256: admitted.reviewerSha256,
    governanceSha256: admitted.governanceSha256,
    status,
    reason,
    pairCount: observations.length,
    outcomeCounts: { reduced, fullFallback, blocked },
    full: { manifestBytes: fullManifestBytes, packetBytes: fullPacketBytes, totalBytes: fullTotalBytes },
    treatment: treatmentTotalBytes === null ? null : {
      manifestBytes: treatmentManifestBytes,
      packetBytes: treatmentPacketBytes,
      totalBytes: treatmentTotalBytes
    },
    savings: treatmentTotalBytes === null ? null : {
      deltaBytes: delta,
      exactRational: exactSavings,
      basisPoints
    },
    providerUsage: {
      U: null, W: null, R: null, P: null,
      closedReason: 'OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT'
    },
    providerClaims: {
      tokenSavings: null, costSavings: null, quality: null,
      closedReason: 'OFFLINE_CANONICAL_BYTE_BENCHMARK_ONLY'
    }
  });
  const reportBytes = canonicalJsonBytes(report);
  return Object.freeze({
    report,
    reportBytes,
    reportSha256: bytesSha256(reportBytes),
    boundary: KCRP_BYTE_BENCHMARK_BOUNDARY.status
  });
}
