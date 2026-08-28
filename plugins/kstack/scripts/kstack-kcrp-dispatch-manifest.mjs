import { bytesSha256, canonicalJsonBytes, parseCanonicalJson } from './kstack-kcrp-json.mjs';
import { KCRP_LIMITS, validateReductionFailure } from './kstack-kcrp-core.mjs';
import { types as utilTypes } from 'node:util';

export const KCRP_DISPATCH_MANIFEST_BOUNDARY = Object.freeze({
  status: 'OFFLINE_SUBSET_ONLY',
  kind: 'kstack-kcrp-dispatch-manifest-offline-subset-v1',
  dispatchAuthority: 'NONE',
  finalR2eManifestImplemented: false
});

const MANIFEST_KEYS = [
  'schemaVersion', 'kind', 'boundary', 'dispatchAuthority',
  'manifestCanonicalizationVersion', 'invocationId', 'threadId', 'phase',
  'round', 'purpose', 'route', 'contextRequirement', 'reductionFailure',
  'requestedItemIds', 'includedItemIds', 'omittedItemIds', 'artifacts',
  'packetByteLength', 'packetSha256', 'providerUsage'
];
const BUILD_KEYS = [
  'invocationId', 'threadId', 'phase', 'round', 'purpose', 'route',
  'reductionFailure', 'requestedItemIds', 'includedItemIds', 'omittedItemIds',
  'artifacts', 'packetBytes'
];
const VALIDATE_OPTION_KEYS = ['expectedDispatchManifestSha256', 'artifactBytesById', 'packetBytes'];
const ID = /^[A-Z][A-Z0-9_-]{0,63}$/;
const CONTEXT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const HASH = /^[0-9a-f]{64}$/;
const PHASES = new Set(['design', 'qc', 'review']);
const FULL_PURPOSES = new Set(['initial', 'clarification', 'closure', 'readiness', 'user-full']);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteLength').get;
const TYPED_ARRAY_BYTE_OFFSET = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteOffset').get;
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'buffer').get;
const ARRAY_BUFFER_BYTE_LENGTH = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const ARRAY_BUFFER_RESIZABLE = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get ?? null;
const ARRAY_BUFFER_DETACHED = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached')?.get ?? null;

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const keys = Object.keys(value);
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) fail(code);
}

function asBytes(value, code) {
  if ((Buffer.isBuffer(value) || value instanceof Uint8Array)
    && typeof SharedArrayBuffer !== 'undefined' && value.buffer instanceof SharedArrayBuffer) fail(code);
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  fail(code);
}

function admitTypedByteView(value, { code, maximumBytes, onOverflow }) {
  if (!value || typeof value !== 'object' || utilTypes.isProxy(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Buffer.prototype && prototype !== Uint8Array.prototype) fail(code);
  let byteLength;
  let byteOffset;
  let backingBuffer;
  try {
    byteLength = TYPED_ARRAY_BYTE_LENGTH.call(value);
    byteOffset = TYPED_ARRAY_BYTE_OFFSET.call(value);
    backingBuffer = TYPED_ARRAY_BUFFER.call(value);
  } catch {
    fail(code);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 0
    || !Number.isSafeInteger(byteOffset) || byteOffset < 0
    || Object.getPrototypeOf(backingBuffer) !== ArrayBuffer.prototype) fail(code);
  let backingByteLength;
  try {
    if ((ARRAY_BUFFER_RESIZABLE && ARRAY_BUFFER_RESIZABLE.call(backingBuffer))
      || (ARRAY_BUFFER_DETACHED && ARRAY_BUFFER_DETACHED.call(backingBuffer))) fail(code);
    backingByteLength = ARRAY_BUFFER_BYTE_LENGTH.call(backingBuffer);
  } catch (error) {
    if (error?.code === code) throw error;
    fail(code);
  }
  if (byteOffset > Number.MAX_SAFE_INTEGER - byteLength
    || byteOffset + byteLength > backingByteLength) fail(code);
  if (byteLength > maximumBytes) onOverflow(byteLength);
  for (const key of ['byteLength', 'byteOffset', 'buffer']) {
    if (Object.hasOwn(value, key)) fail(code);
  }
  let snapshot;
  try { snapshot = Buffer.from(new Uint8Array(backingBuffer, byteOffset, byteLength)); }
  catch { fail(code); }
  if (snapshot.length !== byteLength) fail(code);
  return snapshot;
}

function asciiCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'ascii'), Buffer.from(right, 'ascii'));
}

function validateSortedIds(values, maximum) {
  if (!Array.isArray(values) || values.length > maximum) fail('KCRP_DISPATCH_ITEM_IDS_INVALID');
  let previous = null;
  for (const value of values) {
    if (typeof value !== 'string' || !ID.test(value) || (previous !== null && asciiCompare(previous, value) >= 0)) {
      fail('KCRP_DISPATCH_ITEM_IDS_INVALID');
    }
    previous = value;
  }
}

function validatePurposeRoute(manifest) {
  const fullRequired = manifest.route === 'full-required';
  const reduced = manifest.route === 'reduced';
  const fullFallback = manifest.route === 'full-fallback';
  if ((!fullRequired && !reduced && !fullFallback)
    || (fullRequired && !FULL_PURPOSES.has(manifest.purpose))
    || ((reduced || fullFallback) && manifest.purpose !== 'remediation')) {
    fail('KCRP_DISPATCH_PURPOSE_ROUTE_INVALID');
  }
  if (manifest.contextRequirement !== (reduced ? 'REDUCED_CONTEXT_PERMITTED' : 'FULL_CONTEXT_REQUIRED')) {
    fail('KCRP_DISPATCH_CONTEXT_REQUIREMENT_INVALID');
  }
  if (fullFallback) {
    try { validateReductionFailure(manifest.reductionFailure); }
    catch { fail('KCRP_DISPATCH_FALLBACK_REASON_INVALID'); }
  } else if (manifest.reductionFailure !== null) {
    fail('KCRP_DISPATCH_FALLBACK_REASON_INVALID');
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalSnapshot(value) {
  return deepFreeze(parseCanonicalJson(canonicalJsonBytes(value)));
}

function throwPacketSizeFailure({ purpose, route, reductionFailure, actualBytes }) {
  const code = route === 'reduced' ? 'KCRP_REDUCED_TOO_LARGE' : 'KCRP_FULL_TOO_LARGE';
  const evidence = canonicalSnapshot({
    schemaVersion: 1,
    kind: 'kstack-kcrp-dispatch-packet-size-evidence-v1',
    code,
    stage: 'size',
    purpose,
    route,
    domain: 'packet',
    actualBytes,
    maximumBytes: KCRP_LIMITS.packetBytes
  });
  const evidenceSha256 = bytesSha256(canonicalJsonBytes(evidence));
  const preservedReductionFailure = route === 'full-fallback'
    ? canonicalSnapshot(reductionFailure)
    : null;
  const effectiveReductionFailure = route === 'reduced'
    ? deepFreeze({ code, stage: 'size', evidenceSha256 })
    : preservedReductionFailure;
  const block = route === 'reduced'
    ? null
    : deepFreeze({ code, stage: 'size', evidenceSha256 });
  const packetSizeFailure = canonicalSnapshot({
    schemaVersion: 1,
    kind: 'kstack-kcrp-dispatch-packet-size-failure-v1',
    code,
    stage: 'size',
    purpose,
    route,
    domain: 'packet',
    actualBytes,
    maximumBytes: KCRP_LIMITS.packetBytes,
    fallbackAllowed: route === 'reduced',
    nextRoute: route === 'reduced' ? 'full-fallback' : null,
    reductionFailure: effectiveReductionFailure,
    block,
    evidenceSha256
  });
  const error = new Error(code);
  Object.assign(error, {
    code,
    purpose,
    route,
    domain: 'packet',
    actualBytes,
    maximumBytes: KCRP_LIMITS.packetBytes,
    fallbackAllowed: packetSizeFailure.fallbackAllowed,
    nextRoute: packetSizeFailure.nextRoute,
    reductionFailure: packetSizeFailure.reductionFailure,
    block: packetSizeFailure.block,
    evidence,
    packetSizeFailure,
    packetSizeFailureSha256: bytesSha256(canonicalJsonBytes(packetSizeFailure))
  });
  throw error;
}

function throwArtifactSizeFailure({ purpose, route, reductionFailure, artifactId, actualBytes }) {
  const code = route === 'reduced' ? 'KCRP_REDUCED_TOO_LARGE' : 'KCRP_FULL_TOO_LARGE';
  const evidence = canonicalSnapshot({
    schemaVersion: 1,
    kind: 'kstack-kcrp-dispatch-artifact-size-evidence-v1',
    code,
    stage: 'size',
    purpose,
    route,
    domain: 'artifact',
    artifactId,
    actualBytes,
    maximumBytes: KCRP_LIMITS.sourceArtifactBytes
  });
  const evidenceSha256 = bytesSha256(canonicalJsonBytes(evidence));
  const preservedReductionFailure = route === 'full-fallback'
    ? canonicalSnapshot(reductionFailure)
    : null;
  const effectiveReductionFailure = route === 'reduced'
    ? deepFreeze({ code, stage: 'size', evidenceSha256 })
    : preservedReductionFailure;
  const block = route === 'reduced'
    ? null
    : deepFreeze({ code, stage: 'size', evidenceSha256 });
  const artifactSizeFailure = canonicalSnapshot({
    schemaVersion: 1,
    kind: 'kstack-kcrp-dispatch-artifact-size-failure-v1',
    code,
    stage: 'size',
    purpose,
    route,
    domain: 'artifact',
    artifactId,
    actualBytes,
    maximumBytes: KCRP_LIMITS.sourceArtifactBytes,
    fallbackAllowed: route === 'reduced',
    nextRoute: route === 'reduced' ? 'full-fallback' : null,
    reductionFailure: effectiveReductionFailure,
    block,
    evidenceSha256
  });
  const error = new Error(code);
  Object.assign(error, {
    code,
    purpose,
    route,
    domain: 'artifact',
    artifactId,
    actualBytes,
    maximumBytes: KCRP_LIMITS.sourceArtifactBytes,
    fallbackAllowed: artifactSizeFailure.fallbackAllowed,
    nextRoute: artifactSizeFailure.nextRoute,
    reductionFailure: artifactSizeFailure.reductionFailure,
    block: artifactSizeFailure.block,
    evidence,
    artifactSizeFailure,
    artifactSizeFailureSha256: bytesSha256(canonicalJsonBytes(artifactSizeFailure))
  });
  throw error;
}

function admitArtifactBytes(value, state, artifactId) {
  return admitTypedByteView(value, {
    code: 'KCRP_DISPATCH_ARTIFACT_BYTES_INVALID',
    maximumBytes: KCRP_LIMITS.sourceArtifactBytes,
    onOverflow(actualBytes) {
      throwArtifactSizeFailure({ ...state, artifactId, actualBytes });
    }
  });
}

function admitPacketBytes(value, state) {
  return admitTypedByteView(value, {
    code: 'KCRP_DISPATCH_PACKET_BYTES_INVALID',
    maximumBytes: KCRP_LIMITS.packetBytes,
    onOverflow(actualBytes) { throwPacketSizeFailure({ ...state, actualBytes }); }
  });
}

function validateArtifactIdentities(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length < 1 || artifacts.length > KCRP_LIMITS.artifacts) {
    fail('KCRP_DISPATCH_ARTIFACT_COUNT_INVALID');
  }
  let previous = null;
  for (const artifact of artifacts) {
    exactKeys(artifact, ['artifactId', 'byteLength', 'sha256'], 'KCRP_DISPATCH_ARTIFACT_INVALID');
    if (!ID.test(artifact.artifactId) || !Number.isSafeInteger(artifact.byteLength)
      || artifact.byteLength < 0 || artifact.byteLength > KCRP_LIMITS.sourceArtifactBytes
      || !HASH.test(artifact.sha256)) fail('KCRP_DISPATCH_ARTIFACT_INVALID');
    if (previous !== null && asciiCompare(previous, artifact.artifactId) >= 0) fail('KCRP_DISPATCH_ARTIFACT_ORDER_INVALID');
    previous = artifact.artifactId;
  }
}

function validateProviderUsage(usage) {
  exactKeys(usage, ['U', 'W', 'R', 'P', 'closedReason'], 'KCRP_DISPATCH_PROVIDER_USAGE_INVALID');
  if (usage.U !== null || usage.W !== null || usage.R !== null || usage.P !== null
    || usage.closedReason !== 'OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT') {
    fail('KCRP_DISPATCH_PROVIDER_USAGE_INVALID');
  }
}

function validateSetRelationships(manifest) {
  const included = new Set(manifest.includedItemIds);
  if (manifest.omittedItemIds.some((itemId) => included.has(itemId))) fail('KCRP_DISPATCH_ITEM_SET_INVALID');
  if (manifest.route === 'reduced') {
    if (manifest.requestedItemIds.length === 0 || manifest.includedItemIds.length === 0
      || manifest.omittedItemIds.length === 0
      || manifest.requestedItemIds.some((itemId) => !included.has(itemId))) fail('KCRP_DISPATCH_ITEM_SET_INVALID');
  } else if (manifest.omittedItemIds.length !== 0) {
    fail('KCRP_DISPATCH_ITEM_SET_INVALID');
  }
  if (manifest.purpose === 'user-full' && manifest.requestedItemIds.length !== 0) fail('KCRP_DISPATCH_ITEM_SET_INVALID');
}

function validateManifestObject(manifest) {
  exactKeys(manifest, MANIFEST_KEYS, 'KCRP_DISPATCH_MANIFEST_SCHEMA_INVALID');
  if (manifest.schemaVersion !== 1
    || manifest.kind !== KCRP_DISPATCH_MANIFEST_BOUNDARY.kind
    || manifest.boundary !== KCRP_DISPATCH_MANIFEST_BOUNDARY.status
    || manifest.dispatchAuthority !== KCRP_DISPATCH_MANIFEST_BOUNDARY.dispatchAuthority
    || manifest.manifestCanonicalizationVersion !== 'kstack-kcrp-json-v1'
    || !CONTEXT_ID.test(manifest.invocationId) || !CONTEXT_ID.test(manifest.threadId)
    || !PHASES.has(manifest.phase) || !Number.isSafeInteger(manifest.round) || manifest.round < 1) {
    fail('KCRP_DISPATCH_MANIFEST_SCHEMA_INVALID');
  }
  validatePurposeRoute(manifest);
  validateSortedIds(manifest.requestedItemIds, KCRP_LIMITS.requestedItems);
  validateSortedIds(manifest.includedItemIds, KCRP_LIMITS.includedItems);
  validateSortedIds(manifest.omittedItemIds, KCRP_LIMITS.includedItems);
  validateSetRelationships(manifest);
  validateArtifactIdentities(manifest.artifacts);
  if (!Number.isSafeInteger(manifest.packetByteLength) || manifest.packetByteLength < 0
    || manifest.packetByteLength > KCRP_LIMITS.packetBytes || !HASH.test(manifest.packetSha256)) {
    fail('KCRP_DISPATCH_PACKET_IDENTITY_INVALID');
  }
  validateProviderUsage(manifest.providerUsage);
  return manifest;
}

function toArtifactMap(value, expectedCount, state) {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > KCRP_LIMITS.artifacts
    || utilTypes.isProxy(value)) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
  const admitted = new Map();
  if (value instanceof Map) {
    if (Object.getPrototypeOf(value) !== Map.prototype) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    const mapSize = Object.getOwnPropertyDescriptor(Map.prototype, 'size').get.call(value);
    if (mapSize !== expectedCount || mapSize > KCRP_LIMITS.artifacts) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    for (const [artifactId, candidate] of Map.prototype.entries.call(value)) {
      if (admitted.size >= expectedCount || typeof artifactId !== 'string' || admitted.has(artifactId)) {
        fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
      }
      admitted.set(artifactId, admitArtifactBytes(candidate, state, artifactId));
    }
    return admitted;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
  let observedCount = 0;
  for (const artifactId in value) {
    if (!Object.hasOwn(value, artifactId)) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    observedCount += 1;
    if (observedCount > expectedCount || observedCount > KCRP_LIMITS.artifacts) {
      fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, artifactId);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    }
  }
  if (observedCount !== expectedCount) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
  for (const artifactId in value) {
    const descriptor = Object.getOwnPropertyDescriptor(value, artifactId);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    }
    admitted.set(artifactId, admitArtifactBytes(descriptor.value, state, artifactId));
  }
  return admitted;
}

function validateBoundBytes(manifest, options) {
  const suppliedArtifactBytesById = options.artifactBytesById;
  if (suppliedArtifactBytesById !== undefined) {
    const supplied = toArtifactMap(suppliedArtifactBytesById, manifest.artifacts.length, {
      purpose: manifest.purpose,
      route: manifest.route,
      reductionFailure: manifest.reductionFailure
    });
    for (const artifact of manifest.artifacts) {
      if (!supplied.has(artifact.artifactId)) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
      const bytes = supplied.get(artifact.artifactId);
      if (bytes.byteLength !== artifact.byteLength || bytesSha256(bytes) !== artifact.sha256) fail('KCRP_DISPATCH_ARTIFACT_STALE');
    }
  }
  const suppliedPacketBytes = options.packetBytes;
  if (suppliedPacketBytes !== undefined) {
    const bytes = admitPacketBytes(suppliedPacketBytes, {
      purpose: manifest.purpose,
      route: manifest.route,
      reductionFailure: manifest.reductionFailure
    });
    if (bytes.byteLength !== manifest.packetByteLength || bytesSha256(bytes) !== manifest.packetSha256) fail('KCRP_DISPATCH_PACKET_STALE');
  }
}

function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || utilTypes.isProxy(options)
    || Object.getPrototypeOf(options) !== Object.prototype) {
    fail('KCRP_DISPATCH_OPTIONS_INVALID');
  }
  const keys = Object.keys(options);
  if (keys.some((key) => !VALIDATE_OPTION_KEYS.includes(key))) fail('KCRP_DISPATCH_OPTIONS_INVALID');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('KCRP_DISPATCH_OPTIONS_INVALID');
  }
}

export function canonicalizeOfflineDispatchManifestV1(manifest, options = {}) {
  validateOptions(options);
  const manifestBytes = canonicalJsonBytes(manifest);
  const immutableManifest = deepFreeze(parseCanonicalJson(manifestBytes));
  validateManifestObject(immutableManifest);
  validateBoundBytes(immutableManifest, options);
  const dispatchManifestSha256 = bytesSha256(manifestBytes);
  if (options.expectedDispatchManifestSha256 !== undefined
    && (!HASH.test(options.expectedDispatchManifestSha256)
      || options.expectedDispatchManifestSha256 !== dispatchManifestSha256)) {
    fail('KCRP_DISPATCH_MANIFEST_STALE');
  }
  return Object.freeze({
    manifest: immutableManifest,
    manifestBytes,
    dispatchManifestSha256,
    dispatchEligible: false,
    boundary: KCRP_DISPATCH_MANIFEST_BOUNDARY.status
  });
}

export function parseOfflineDispatchManifestV1(input, options = {}) {
  const bytes = asBytes(input, 'KCRP_DISPATCH_MANIFEST_BYTES_INVALID');
  const manifest = parseCanonicalJson(bytes);
  const result = canonicalizeOfflineDispatchManifestV1(manifest, options);
  if (!result.manifestBytes.equals(bytes)) fail('KCRP_DISPATCH_MANIFEST_NONCANONICAL');
  return result;
}

export function buildOfflineDispatchManifestV1(input) {
  exactKeys(input, BUILD_KEYS, 'KCRP_DISPATCH_BUILD_INPUT_INVALID');
  const purpose = input.purpose;
  const route = input.route;
  if ((route !== 'reduced' && route !== 'full-required' && route !== 'full-fallback')
    || (route === 'full-required' && !FULL_PURPOSES.has(purpose))
    || ((route === 'reduced' || route === 'full-fallback') && purpose !== 'remediation')) {
    fail('KCRP_DISPATCH_PURPOSE_ROUTE_INVALID');
  }
  const suppliedReductionFailure = input.reductionFailure;
  let reductionFailure = null;
  if (suppliedReductionFailure !== null) {
    try { reductionFailure = canonicalSnapshot(suppliedReductionFailure); }
    catch { fail('KCRP_DISPATCH_FALLBACK_REASON_INVALID'); }
  }
  const routeState = Object.freeze({ purpose, route, reductionFailure });
  validatePurposeRoute({
    purpose: routeState.purpose,
    route: routeState.route,
    contextRequirement: routeState.route === 'reduced' ? 'REDUCED_CONTEXT_PERMITTED' : 'FULL_CONTEXT_REQUIRED',
    reductionFailure: routeState.reductionFailure
  });
  if (utilTypes.isProxy(input.artifacts) || !Array.isArray(input.artifacts)
    || input.artifacts.length < 1 || input.artifacts.length > KCRP_LIMITS.artifacts) {
    fail('KCRP_DISPATCH_ARTIFACT_COUNT_INVALID');
  }
  const identities = [];
  const artifactBytesById = new Map();
  for (let artifactIndex = 0; artifactIndex < input.artifacts.length; artifactIndex += 1) {
    const arrayDescriptor = Object.getOwnPropertyDescriptor(input.artifacts, String(artifactIndex));
    if (!arrayDescriptor || !Object.hasOwn(arrayDescriptor, 'value')) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    const artifact = arrayDescriptor.value;
    if (utilTypes.isProxy(artifact)) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    exactKeys(artifact, ['artifactId', 'bytes'], 'KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    const artifactIdDescriptor = Object.getOwnPropertyDescriptor(artifact, 'artifactId');
    const bytesDescriptor = Object.getOwnPropertyDescriptor(artifact, 'bytes');
    if (!artifactIdDescriptor || !Object.hasOwn(artifactIdDescriptor, 'value')
      || !bytesDescriptor || !Object.hasOwn(bytesDescriptor, 'value')) fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    const artifactId = artifactIdDescriptor.value;
    if (typeof artifactId !== 'string' || !ID.test(artifactId) || artifactBytesById.has(artifactId)) {
      fail('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID');
    }
    const bytes = admitArtifactBytes(bytesDescriptor.value, routeState, artifactId);
    artifactBytesById.set(artifactId, bytes);
    identities.push({ artifactId, byteLength: bytes.byteLength, sha256: bytesSha256(bytes) });
  }
  identities.sort((left, right) => asciiCompare(left.artifactId, right.artifactId));

  const packetBytes = admitPacketBytes(input.packetBytes, routeState);
  const sortedIds = (values, maximum) => {
    if (!Array.isArray(values) || values.length > maximum) fail('KCRP_DISPATCH_ITEM_IDS_INVALID');
    for (const value of values) {
      if (typeof value !== 'string' || !ID.test(value)) fail('KCRP_DISPATCH_ITEM_IDS_INVALID');
    }
    return [...values].sort(asciiCompare);
  };
  const manifest = {
    schemaVersion: 1,
    kind: KCRP_DISPATCH_MANIFEST_BOUNDARY.kind,
    boundary: KCRP_DISPATCH_MANIFEST_BOUNDARY.status,
    dispatchAuthority: KCRP_DISPATCH_MANIFEST_BOUNDARY.dispatchAuthority,
    manifestCanonicalizationVersion: 'kstack-kcrp-json-v1',
    invocationId: input.invocationId,
    threadId: input.threadId,
    phase: input.phase,
    round: input.round,
    purpose: routeState.purpose,
    route: routeState.route,
    contextRequirement: routeState.route === 'reduced' ? 'REDUCED_CONTEXT_PERMITTED' : 'FULL_CONTEXT_REQUIRED',
    reductionFailure: routeState.reductionFailure,
    requestedItemIds: sortedIds(input.requestedItemIds, KCRP_LIMITS.requestedItems),
    includedItemIds: sortedIds(input.includedItemIds, KCRP_LIMITS.includedItems),
    omittedItemIds: sortedIds(input.omittedItemIds, KCRP_LIMITS.includedItems),
    artifacts: identities,
    packetByteLength: packetBytes.byteLength,
    packetSha256: bytesSha256(packetBytes),
    providerUsage: {
      U: null,
      W: null,
      R: null,
      P: null,
      closedReason: 'OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT'
    }
  };
  return canonicalizeOfflineDispatchManifestV1(manifest);
}
