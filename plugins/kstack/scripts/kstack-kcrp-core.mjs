import {
  KCRP_CONTROL_JSON_MAX_BYTES, bytesSha256, canonicalJsonBytes, parseCanonicalJson
} from './kstack-kcrp-json.mjs';

export const KCRP_OFFLINE_BOUNDARIES = Object.freeze({
  status: 'OFFLINE_SUBSET_ONLY',
  implemented: Object.freeze(['canonical-json-v1', 'item-map-validation', 'declared-closure', 'source-record-serialization', 'review-input-framing', 'offline-closure-eligibility']),
  unimplemented: Object.freeze([
    'qualified-safe-file-discovery', 'governance-policy-resolution',
    'complete-dispatch-manifest-schema', 'outbound-scan', 'provider-execution',
    'receipt-chain', 'gate-integration', 'configuration', 'activation'
  ])
});

export const KCRP_LIMITS = Object.freeze({
  artifacts: 256, items: 4096, spansPerItem: 64, totalSpans: 16384,
  dependenciesPerItem: 256, requestedItems: 256, includedItems: 4096,
  sourceRecords: 32768, sourceRecordBytes: 1048576, sourceArtifactBytes: KCRP_CONTROL_JSON_MAX_BYTES,
  itemMapBytes: KCRP_CONTROL_JSON_MAX_BYTES, manifestBytes: KCRP_CONTROL_JSON_MAX_BYTES, packetBytes: 1048576,
  reviewInputBytes: 1200000
});

const ID = /^[A-Z][A-Z0-9_-]{0,63}$/;
const THREAD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const GROUP_ID = /^MG_[A-Z0-9_-]{1,60}$/;
const HASH = /^[0-9a-f]{64}$/;
const SOURCE_ROLES = new Set(['design-under-review', 'checks-artifact', 'counter-evidence', 'context']);
const SOURCE_INCLUSIONS = new Set(['full', 'excerpt']);
const ROLES = new Set(['primary', 'objective', 'approved-design', 'final-plan', 'diff', 'verification', 'rollback', 'decision', 'governance']);
const PHASES = new Set(['design', 'qc', 'review']);
const RISKS = new Set(['ordinary', 'high']);
const STATUSES = new Set(['open', 'validated', 'rejected']);
const ELIGIBILITY = new Set(['reducible', 'entangled']);
const PURPOSES = new Set(['initial', 'clarification', 'remediation', 'closure', 'readiness', 'user-full']);
const ROUTES = new Set(['reduced', 'full-required', 'full-fallback']);
const REDUCTION_STAGES = new Set(['map', 'closure', 'slice', 'size']);
const REDUCTION_FAILURE_CODE_STAGE = new Map([
  ['KCRP_MAP_MISSING', 'map'], ['KCRP_MAP_STALE', 'map'], ['KCRP_MAP_TOO_LARGE', 'map'],
  ['KCRP_ARTIFACT_COUNT_LIMIT', 'map'], ['KCRP_ITEM_COUNT_LIMIT', 'map'],
  ['KCRP_DEPENDENCY_MISSING', 'closure'], ['KCRP_DEPENDENCY_AMBIGUOUS', 'closure'],
  ['KCRP_ENTANGLED_REACHABLE', 'closure'], ['KCRP_CLOSURE_COUNT_LIMIT', 'closure'],
  ['KCRP_SCOPE_EXPANDED', 'closure'], ['KCRP_DEPENDENCY_COUNT_LIMIT', 'closure'],
  ['KCRP_SLICE_INVALID', 'slice'], ['KCRP_SPAN_COUNT_LIMIT', 'slice'], ['KCRP_SPAN_OVERLAP', 'slice'],
  ['KCRP_REDUCED_MANIFEST_TOO_LARGE', 'size'], ['KCRP_REDUCED_SOURCE_COUNT_LIMIT', 'size'],
  ['KCRP_REDUCED_SOURCE_RECORD_TOO_LARGE', 'size'], ['KCRP_REDUCED_TOO_LARGE', 'size']
]);
const DIAGNOSTIC_CODE_STAGE = new Map([
  ...REDUCTION_FAILURE_CODE_STAGE,
  ['KCRP_FULL_MANIFEST_TOO_LARGE', 'size'], ['KCRP_FULL_SOURCE_COUNT_LIMIT', 'size'],
  ['KCRP_FULL_SOURCE_RECORD_TOO_LARGE', 'size'], ['KCRP_FULL_TOO_LARGE', 'size']
]);

function fail(code, detail = code) {
  const error = new Error(detail);
  error.code = code;
  throw error;
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) fail(code);
}

function safeInteger(value, { positive = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail('KCRP_INTEGER_INVALID');
  return value;
}

function asciiCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'ascii'), Buffer.from(right, 'ascii'));
}

function assertSortedUnique(values, pattern, code, { allowEmpty = true, maximum = Infinity } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0) || values.length > maximum) fail(code);
  let previous = null;
  for (const value of values) {
    if (typeof value !== 'string' || !pattern.test(value)) fail(code);
    if (previous !== null && asciiCompare(previous, value) >= 0) fail(code);
    previous = value;
  }
}

export function validateReductionFailure(value) {
  exactKeys(value, ['code', 'stage', 'evidenceSha256'], 'KCRP_REDUCTION_FAILURE_INVALID');
  if (typeof value.code !== 'string' || !REDUCTION_STAGES.has(value.stage)
    || REDUCTION_FAILURE_CODE_STAGE.get(value.code) !== value.stage || !HASH.test(value.evidenceSha256)) fail('KCRP_REDUCTION_FAILURE_INVALID');
  return value;
}

function sealDiagnosticSet(observations, { reductionPrimary = true } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) fail('KCRP_DIAGNOSTIC_INVALID');
  const ordered = [...observations].sort((left, right) => left.precedenceOrdinal - right.precedenceOrdinal || asciiCompare(left.code, right.code));
  const evidence = ordered.map((observation) => {
    if (!Number.isSafeInteger(observation.precedenceOrdinal) || observation.precedenceOrdinal < 1 || observation.precedenceOrdinal > 10
      || DIAGNOSTIC_CODE_STAGE.get(observation.code) !== observation.stage) fail('KCRP_DIAGNOSTIC_INVALID');
    const body = {
      schemaVersion: 1, kind: 'kstack-kcrp-reduction-diagnostic-evidence-v1',
      precedenceOrdinal: observation.precedenceOrdinal, code: observation.code,
      stage: observation.stage, detail: observation.detail
    };
    let bytes;
    try { bytes = canonicalJsonBytes(body); } catch (error) {
      if (error?.code === 'KCRP_JSON_TOO_LARGE') fail('KCRP_DIAGNOSTIC_TOO_LARGE');
      throw error;
    }
    return Object.freeze({ body, evidenceSha256: bytesSha256(bytes) });
  });
  const diagnosticSet = {
    schemaVersion: 1, kind: 'kstack-kcrp-reduction-diagnostic-set-v1',
    diagnostics: evidence.map((entry) => ({
      precedenceOrdinal: entry.body.precedenceOrdinal, code: entry.body.code,
      stage: entry.body.stage, evidenceSha256: entry.evidenceSha256
    }))
  };
  let diagnosticSetBytes;
  try { diagnosticSetBytes = canonicalJsonBytes(diagnosticSet); } catch (error) {
    if (error?.code === 'KCRP_JSON_TOO_LARGE') fail('KCRP_DIAGNOSTIC_TOO_LARGE');
    throw error;
  }
  const diagnosticSetSha256 = bytesSha256(diagnosticSetBytes);
  const primary = ordered[0];
  const reductionFailure = reductionPrimary
    ? Object.freeze({ code: primary.code, stage: primary.stage, evidenceSha256: diagnosticSetSha256 })
    : null;
  if (reductionFailure) validateReductionFailure(reductionFailure);
  return Object.freeze({ reductionFailure, diagnosticSet, diagnosticSetSha256, diagnosticEvidence: Object.freeze(evidence) });
}

export function verifyReductionDiagnosticsV1({ reductionFailure, diagnosticSet, diagnosticSetSha256, diagnosticEvidence }) {
  validateReductionFailure(reductionFailure);
  if (!HASH.test(diagnosticSetSha256) || reductionFailure.evidenceSha256 !== diagnosticSetSha256) fail('KCRP_DIAGNOSTIC_INVALID');
  exactKeys(diagnosticSet, ['schemaVersion', 'kind', 'diagnostics'], 'KCRP_DIAGNOSTIC_INVALID');
  if (diagnosticSet.schemaVersion !== 1 || diagnosticSet.kind !== 'kstack-kcrp-reduction-diagnostic-set-v1'
    || !Array.isArray(diagnosticSet.diagnostics) || diagnosticSet.diagnostics.length === 0
    || !Array.isArray(diagnosticEvidence) || diagnosticEvidence.length !== diagnosticSet.diagnostics.length) fail('KCRP_DIAGNOSTIC_INVALID');
  let previous = null;
  for (let index = 0; index < diagnosticSet.diagnostics.length; index += 1) {
    const diagnostic = diagnosticSet.diagnostics[index];
    const evidence = diagnosticEvidence[index];
    exactKeys(diagnostic, ['precedenceOrdinal', 'code', 'stage', 'evidenceSha256'], 'KCRP_DIAGNOSTIC_INVALID');
    exactKeys(evidence, ['body', 'evidenceSha256'], 'KCRP_DIAGNOSTIC_INVALID');
    exactKeys(evidence.body, ['schemaVersion', 'kind', 'precedenceOrdinal', 'code', 'stage', 'detail'], 'KCRP_DIAGNOSTIC_INVALID');
    if (!Number.isSafeInteger(diagnostic.precedenceOrdinal) || diagnostic.precedenceOrdinal < 1 || diagnostic.precedenceOrdinal > 10
      || typeof diagnostic.code !== 'string' || REDUCTION_FAILURE_CODE_STAGE.get(diagnostic.code) !== diagnostic.stage
      || !HASH.test(diagnostic.evidenceSha256) || evidence.body.schemaVersion !== 1
      || evidence.body.kind !== 'kstack-kcrp-reduction-diagnostic-evidence-v1') fail('KCRP_DIAGNOSTIC_INVALID');
    const orderingKey = { precedenceOrdinal: diagnostic.precedenceOrdinal, code: diagnostic.code };
    if (previous !== null && (previous.precedenceOrdinal > orderingKey.precedenceOrdinal
      || (previous.precedenceOrdinal === orderingKey.precedenceOrdinal && asciiCompare(previous.code, orderingKey.code) >= 0))) fail('KCRP_DIAGNOSTIC_INVALID');
    previous = orderingKey;
    if (evidence.body.precedenceOrdinal !== diagnostic.precedenceOrdinal || evidence.body.code !== diagnostic.code
      || evidence.body.stage !== diagnostic.stage || evidence.evidenceSha256 !== diagnostic.evidenceSha256
      || bytesSha256(canonicalJsonBytes(evidence.body)) !== evidence.evidenceSha256) fail('KCRP_DIAGNOSTIC_INVALID');
  }
  if (bytesSha256(canonicalJsonBytes(diagnosticSet)) !== diagnosticSetSha256) fail('KCRP_DIAGNOSTIC_INVALID');
  const primary = diagnosticSet.diagnostics[0];
  if (reductionFailure.code !== primary.code || reductionFailure.stage !== primary.stage) fail('KCRP_DIAGNOSTIC_INVALID');
  return true;
}

function sizeDiagnostic(code, route, domain, actual, maximum) {
  return sealDiagnosticSet(
    [{ precedenceOrdinal: route === 'reduced' ? 8 : 9, code, stage: 'size', detail: { route, domain, actual, maximum } }],
    { reductionPrimary: route === 'reduced' }
  );
}

function asArtifactMap(artifacts) {
  if (artifacts instanceof Map) return artifacts;
  if (artifacts && typeof artifacts === 'object' && !Array.isArray(artifacts)) return new Map(Object.entries(artifacts));
  fail('KCRP_ARTIFACT_BYTES_INVALID');
}

export function canonicalizeArtifactBytes(input) {
  let bytes;
  if (Buffer.isBuffer(input)) bytes = input;
  else if (input instanceof Uint8Array) bytes = Buffer.from(input);
  else if (typeof input === 'string') bytes = Buffer.from(input, 'utf8');
  else fail('KCRP_ARTIFACT_BYTES_INVALID');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail('KCRP_ARTIFACT_UTF8_INVALID'); }
  if (text.startsWith('\ufeff')) text = text.slice(1);
  if (!text.isWellFormed()) fail('KCRP_ARTIFACT_UTF8_INVALID');
  return Buffer.from(text.replace(/\r\n?/g, '\n'), 'utf8');
}

function validateArtifactBindingShape(binding) {
  exactKeys(binding, ['artifactId', 'role', 'repositoryRelativePath', 'canonicalization', 'byteLength', 'sha256'], 'KCRP_ARTIFACT_BINDING_INVALID');
  if (!ID.test(binding.artifactId) || !ROLES.has(binding.role) || binding.canonicalization !== 'kstack-utf8-lf-v1') fail('KCRP_ARTIFACT_BINDING_INVALID');
  const relativePath = binding.repositoryRelativePath;
  if (typeof relativePath !== 'string' || !/^[\x21-\x7e]+$/.test(relativePath) || relativePath.startsWith('/') || relativePath.includes('\\') || relativePath.split('/').some((part) => part === '' || part === '.' || part === '..')) fail('KCRP_ARTIFACT_PATH_INVALID');
  safeInteger(binding.byteLength);
  if (!HASH.test(binding.sha256)) fail('KCRP_ARTIFACT_BINDING_INVALID');
}

function validateArtifactBinding(binding, bytesById) {
  validateArtifactBindingShape(binding);
  if (!bytesById.has(binding.artifactId)) fail('KCRP_ARTIFACT_MISSING');
  const canonical = canonicalizeArtifactBytes(bytesById.get(binding.artifactId));
  if (canonical.length !== binding.byteLength || bytesSha256(canonical) !== binding.sha256) fail('KCRP_ARTIFACT_STALE');
  return canonical;
}

function artifactOrder(left, right) {
  return asciiCompare(left.artifactId, right.artifactId) || asciiCompare(left.role, right.role) || asciiCompare(left.repositoryRelativePath, right.repositoryRelativePath);
}

const SOURCE_BINDING_KEYS = [
  'schemaVersion', 'kind', 'sourceId', 'label', 'role', 'inclusion', 'artifact', 'span',
  'recordByteStart', 'recordByteLength', 'contentByteStart', 'contentByteLength',
  'sourceSha256', 'recordSha256'
];
const SOURCE_SPEC_KEYS = ['schemaVersion', 'kind', 'sourceId', 'label', 'role', 'inclusion', 'artifact', 'span'];
const SOURCE_PACKET_BINDING_KEYS = [
  'packetCanonicalizationVersion', 'packetSerializationVersion', 'packetFramingVersion',
  'packetByteLength', 'packetSha256', 'sources'
];

function freezeSourceRecord(value) {
  return Object.freeze({
    ...value,
    artifact: Object.freeze({ ...value.artifact }),
    span: Object.freeze({ ...value.span })
  });
}

function validateSourceLabel(value) {
  if (typeof value !== 'string' || !value.isWellFormed() || [...value].length < 1 || [...value].length > 200
    || /[\u0000-\u001f\uFEFF]/u.test(value)) fail('KCRP_SOURCE_SCHEMA_INVALID');
}

function validateSourceSpanShape(span) {
  exactKeys(span, ['byteStart', 'byteLength', 'sha256'], 'KCRP_SOURCE_SPAN_INVALID');
  const start = safeInteger(span.byteStart);
  const length = safeInteger(span.byteLength, { positive: true });
  if (!HASH.test(span.sha256) || start > Number.MAX_SAFE_INTEGER - length) fail('KCRP_SOURCE_SPAN_INVALID');
  return { start, length };
}

function validateSourceSpan(span, artifactBytes) {
  const { start, length } = validateSourceSpanShape(span);
  if (start + length > artifactBytes.length) fail('KCRP_SOURCE_SPAN_INVALID');
  const content = artifactBytes.subarray(start, start + length);
  if (bytesSha256(content) !== span.sha256) fail('KCRP_SOURCE_STALE');
  const end = start + length;
  if ((start > 0 && (artifactBytes[start] & 0xc0) === 0x80)
    || (end < artifactBytes.length && (artifactBytes[end] & 0xc0) === 0x80)) fail('KCRP_SOURCE_SPAN_INVALID');
  return content;
}

function checkedByteSum(...values) {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || total > Number.MAX_SAFE_INTEGER - value) fail('KCRP_INTEGER_INVALID');
    total += value;
  }
  return total;
}

function sourceRecordLayout(spec, contentByteLength) {
  const idByteLength = Buffer.byteLength(spec.sourceId, 'utf8');
  const labelByteLength = Buffer.byteLength(spec.label, 'utf8');
  const prefixByteLength = checkedByteSum(
    Buffer.byteLength('KSTACK-SOURCE-RECORD-V1\n', 'ascii'),
    Buffer.byteLength(`ID ${idByteLength}\n`, 'ascii'), idByteLength, 1,
    Buffer.byteLength(`LABEL ${labelByteLength}\n`, 'ascii'), labelByteLength, 1,
    Buffer.byteLength(`ROLE ${spec.role}\n`, 'ascii'),
    Buffer.byteLength(`INCLUSION ${spec.inclusion}\n`, 'ascii'),
    Buffer.byteLength(`CONTENT ${contentByteLength}\n`, 'ascii')
  );
  const suffixByteLength = Buffer.byteLength('\nEND KSTACK-SOURCE-RECORD-V1\n', 'ascii');
  return Object.freeze({
    idByteLength, labelByteLength, contentByteLength, prefixByteLength,
    recordByteLength: checkedByteSum(prefixByteLength, contentByteLength, suffixByteLength)
  });
}

function sourceRecordBytes(spec, content, layout = sourceRecordLayout(spec, content.length)) {
  const prefix = Buffer.concat([
    Buffer.from('KSTACK-SOURCE-RECORD-V1\n', 'ascii'),
    Buffer.from(`ID ${layout.idByteLength}\n`, 'ascii'), Buffer.from(spec.sourceId, 'utf8'), Buffer.from('\n', 'ascii'),
    Buffer.from(`LABEL ${layout.labelByteLength}\n`, 'ascii'), Buffer.from(spec.label, 'utf8'), Buffer.from('\n', 'ascii'),
    Buffer.from(`ROLE ${spec.role}\n`, 'ascii'), Buffer.from(`INCLUSION ${spec.inclusion}\n`, 'ascii'),
    Buffer.from(`CONTENT ${layout.contentByteLength}\n`, 'ascii')
  ], layout.prefixByteLength);
  const suffix = Buffer.from('\nEND KSTACK-SOURCE-RECORD-V1\n', 'ascii');
  const bytes = Buffer.concat([prefix, content, suffix], layout.recordByteLength);
  if (prefix.length !== layout.prefixByteLength || bytes.length !== layout.recordByteLength) fail('KCRP_SOURCE_RECONSTRUCTION_MISMATCH');
  return { bytes, contentOffset: layout.prefixByteLength };
}

function sourceLimitFailure({ purpose, route, reductionFailure, domain, actual }) {
  const count = domain === 'source-count';
  const code = route === 'reduced'
    ? count ? 'KCRP_REDUCED_SOURCE_COUNT_LIMIT' : 'KCRP_REDUCED_SOURCE_RECORD_TOO_LARGE'
    : count ? 'KCRP_FULL_SOURCE_COUNT_LIMIT' : 'KCRP_FULL_SOURCE_RECORD_TOO_LARGE';
  const maximum = count ? KCRP_LIMITS.sourceRecords : KCRP_LIMITS.sourceRecordBytes;
  const sealed = sealDiagnosticSet([{ precedenceOrdinal: route === 'reduced' ? 8 : 9, code, stage: 'size', detail: { route, domain, actual, maximum } }], { reductionPrimary: route === 'reduced' });
  const error = new Error(code);
  error.code = code;
  error.purpose = purpose;
  error.route = route;
  error.domain = domain;
  error.diagnosticSet = sealed.diagnosticSet;
  error.diagnosticSetSha256 = sealed.diagnosticSetSha256;
  error.diagnosticEvidence = sealed.diagnosticEvidence;
  if (route === 'reduced') {
    error.reductionFailure = sealed.reductionFailure;
    error.nextRoute = 'full-fallback';
    error.fallbackAllowed = true;
    error.block = null;
  } else {
    error.reductionFailure = route === 'full-fallback' ? reductionFailure : null;
    error.nextRoute = null;
    error.fallbackAllowed = false;
    error.block = { code, stage: 'size', evidenceSha256: sealed.diagnosticSetSha256 };
  }
  throw error;
}

function asSourceArtifactMap(artifacts) {
  const supplied = asArtifactMap(artifacts);
  const prepared = new Map();
  for (const [artifactId, entry] of supplied) {
    exactKeys(entry, ['binding', 'bytes'], 'KCRP_SOURCE_BINDING_INVALID');
    if (entry.binding?.artifactId !== artifactId) fail('KCRP_SOURCE_BINDING_INVALID');
    prepared.set(artifactId, {
      binding: Object.freeze({ ...entry.binding }), input: entry.bytes, canonical: null
    });
  }
  return prepared;
}

function canonicalSourceArtifact(entry) {
  if (entry.canonical !== null) return entry.canonical;
  let admittedByteLength;
  if (Buffer.isBuffer(entry.input) || entry.input instanceof Uint8Array) admittedByteLength = entry.input.length;
  else if (typeof entry.input === 'string') admittedByteLength = boundedUtf8ByteLength(entry.input, KCRP_LIMITS.sourceArtifactBytes);
  else fail('KCRP_ARTIFACT_BYTES_INVALID');
  if (admittedByteLength > KCRP_LIMITS.sourceArtifactBytes) fail('KCRP_ARTIFACT_BYTES_INVALID');
  const bytes = canonicalizeArtifactBytes(entry.input);
  if (bytes.length > KCRP_LIMITS.sourceArtifactBytes) fail('KCRP_ARTIFACT_BYTES_INVALID');
  entry.canonical = Object.freeze({ bytes, sha256: bytesSha256(bytes) });
  return entry.canonical;
}

function validateSourceArtifactBinding(binding, entry) {
  validateArtifactBindingShape(binding);
  const canonical = canonicalSourceArtifact(entry);
  if (binding.byteLength !== canonical.bytes.length || binding.sha256 !== canonical.sha256) fail('KCRP_ARTIFACT_STALE');
  return canonical.bytes;
}

function validateSourceSpecMetadata(spec, artifacts) {
  exactKeys(spec, SOURCE_SPEC_KEYS, 'KCRP_SOURCE_SCHEMA_INVALID');
  if (spec.schemaVersion !== 1 || spec.kind !== 'kstack-kcrp-source-record-v1'
    || !ID.test(spec.sourceId) || !SOURCE_ROLES.has(spec.role) || !SOURCE_INCLUSIONS.has(spec.inclusion)) fail('KCRP_SOURCE_SCHEMA_INVALID');
  validateSourceLabel(spec.label);
  validateSourceSpanShape(spec.span);
  const expected = artifacts.get(spec.artifact?.artifactId);
  if (!expected || !canonicalJsonBytes(spec.artifact).equals(canonicalJsonBytes(expected.binding))) fail('KCRP_SOURCE_BINDING_INVALID');
  return expected;
}

function validateSourceSpecContent(spec, expected) {
  const artifactBytes = validateSourceArtifactBinding(spec.artifact, expected);
  const content = validateSourceSpan(spec.span, artifactBytes);
  if (spec.inclusion === 'full' && (spec.span.byteStart !== 0 || spec.span.byteLength !== artifactBytes.length)) fail('KCRP_SOURCE_SPAN_INVALID');
  return { artifactBytes, content };
}

function assertSourceOrdering(sources) {
  let previousSourceId = null;
  const priorByArtifact = new Map();
  const bindingByArtifact = new Map();
  for (const source of sources) {
    if (previousSourceId !== null && asciiCompare(previousSourceId, source.sourceId) >= 0) fail('KCRP_SOURCE_ORDER_INVALID');
    previousSourceId = source.sourceId;
    const artifactBytes = canonicalJsonBytes(source.artifact);
    const priorBinding = bindingByArtifact.get(source.artifact.artifactId);
    if (priorBinding && !priorBinding.equals(artifactBytes)) fail('KCRP_SOURCE_BINDING_INVALID');
    bindingByArtifact.set(source.artifact.artifactId, artifactBytes);
    const prior = priorByArtifact.get(source.artifact.artifactId);
    if (prior) {
      if (prior.byteStart > source.span.byteStart
        || (prior.byteStart === source.span.byteStart && prior.byteLength >= source.span.byteLength)) fail('KCRP_SOURCE_ORDER_INVALID');
      if (prior.byteStart + prior.byteLength > source.span.byteStart) fail('KCRP_SOURCE_SPAN_OVERLAP');
    }
    priorByArtifact.set(source.artifact.artifactId, source.span);
  }
}

export function buildKcrpSourcePacketV1({ purpose, route, reductionFailure = null, sources, artifacts }) {
  validatePurposeRoute(purpose, route, reductionFailure);
  if (!Array.isArray(sources) || sources.length === 0) fail('KCRP_SOURCE_COUNT_INVALID');
  if (sources.length > KCRP_LIMITS.sourceRecords) sourceLimitFailure({ purpose, route, reductionFailure, domain: 'source-count', actual: sources.length });
  const artifactMap = asSourceArtifactMap(artifacts);
  const expectedArtifacts = sources.map((source) => validateSourceSpecMetadata(source, artifactMap));
  assertSourceOrdering(sources);
  const validatedSources = sources.map((source, index) => validateSourceSpecContent(source, expectedArtifacts[index]));
  const records = [];
  const bindings = [];
  let packetByteLength = 0;
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const { content } = validatedSources[index];
    const layout = sourceRecordLayout(source, content.length);
    if (layout.recordByteLength > KCRP_LIMITS.sourceRecordBytes) sourceLimitFailure({ purpose, route, reductionFailure, domain: 'source-record', actual: layout.recordByteLength });
    const candidatePacketByteLength = checkedByteSum(packetByteLength, layout.recordByteLength);
    if (layout.recordByteLength > KCRP_LIMITS.packetBytes - packetByteLength) throwSizeFailure({ purpose, route, reductionFailure, domain: 'packet', actual: candidatePacketByteLength, maximum: KCRP_LIMITS.packetBytes });
    const record = sourceRecordBytes(source, content, layout);
    const recordByteStart = packetByteLength;
    packetByteLength = candidatePacketByteLength;
    records.push(record.bytes);
    bindings.push(freezeSourceRecord({
      ...source, recordByteStart, recordByteLength: record.bytes.length,
      contentByteStart: recordByteStart + record.contentOffset, contentByteLength: content.length,
      sourceSha256: bytesSha256(content), recordSha256: bytesSha256(record.bytes)
    }));
  }
  const packetBytes = Buffer.concat(records, packetByteLength);
  return Object.freeze({
    packetBytes,
    binding: Object.freeze({
      packetCanonicalizationVersion: 'kstack-packet-utf8-lf-v1',
      packetSerializationVersion: 'kstack-source-record-v1',
      packetFramingVersion: 'kstack-frame-token-v1',
      packetByteLength, packetSha256: bytesSha256(packetBytes), sources: Object.freeze(bindings)
    }),
    dispatchEligible: false, implementationBoundary: KCRP_OFFLINE_BOUNDARIES.status
  });
}

function sourceReadLine(bytes, state) {
  const end = bytes.indexOf(0x0a, state.offset);
  if (end < 0) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  const lineBytes = bytes.subarray(state.offset, end);
  if (lineBytes.some((byte) => byte > 0x7f)) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  state.offset = end + 1;
  return lineBytes.toString('ascii');
}

function sourceReadLength(bytes, state, name) {
  const match = new RegExp(`^${name} (0|[1-9][0-9]*)$`).exec(sourceReadLine(bytes, state));
  if (!match) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value)) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  return value;
}

function sourceReadBytes(bytes, state, name) {
  const length = sourceReadLength(bytes, state, name);
  if (length === 0 || state.offset > Number.MAX_SAFE_INTEGER - length || state.offset + length >= bytes.length) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  const value = bytes.subarray(state.offset, state.offset + length);
  state.offset += length;
  if (bytes[state.offset] !== 0x0a) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  state.offset += 1;
  return value;
}

function sourceDecodeUtf8(bytes) {
  try {
    const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!value.isWellFormed()) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
    return value;
  } catch (error) {
    if (error?.code) throw error;
    fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  }
}

function parseSourceRecord(bytes, state, { purpose, route, reductionFailure }) {
  const recordByteStart = state.offset;
  if (sourceReadLine(bytes, state) !== 'KSTACK-SOURCE-RECORD-V1') fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  const sourceId = sourceDecodeUtf8(sourceReadBytes(bytes, state, 'ID'));
  const label = sourceDecodeUtf8(sourceReadBytes(bytes, state, 'LABEL'));
  const roleLine = sourceReadLine(bytes, state);
  const inclusionLine = sourceReadLine(bytes, state);
  if (!roleLine.startsWith('ROLE ') || !inclusionLine.startsWith('INCLUSION ')) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  const role = roleLine.slice(5);
  const inclusion = inclusionLine.slice(10);
  const contentByteLength = sourceReadLength(bytes, state, 'CONTENT');
  if (contentByteLength === 0 || state.offset > Number.MAX_SAFE_INTEGER - contentByteLength || state.offset + contentByteLength >= bytes.length) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  const contentByteStart = state.offset;
  const content = bytes.subarray(state.offset, state.offset + contentByteLength);
  state.offset += contentByteLength;
  if (bytes[state.offset] !== 0x0a) fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  state.offset += 1;
  if (sourceReadLine(bytes, state) !== 'END KSTACK-SOURCE-RECORD-V1') fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  const recordBytes = bytes.subarray(recordByteStart, state.offset);
  if (recordBytes.length > KCRP_LIMITS.sourceRecordBytes) sourceLimitFailure({ purpose, route, reductionFailure, domain: 'source-record', actual: recordBytes.length });
  return { sourceId, label, role, inclusion, content, recordBytes, recordByteStart, contentByteStart, contentByteLength };
}

function boundedSourcePacketBytes(packet, { purpose, route, reductionFailure }) {
  let packetByteLength;
  if (Buffer.isBuffer(packet) || packet instanceof Uint8Array) packetByteLength = packet.length;
  else if (typeof packet === 'string') packetByteLength = boundedUtf8ByteLength(packet, KCRP_LIMITS.packetBytes);
  else fail('KCRP_SOURCE_SERIALIZATION_INVALID');
  if (packetByteLength > KCRP_LIMITS.packetBytes) throwSizeFailure({
    purpose, route, reductionFailure, domain: 'packet', actual: packetByteLength, maximum: KCRP_LIMITS.packetBytes
  });
  return asBytes(packet, 'KCRP_SOURCE_SERIALIZATION_INVALID');
}

export function verifyKcrpSourcePacketV1(packet, binding, { purpose, route, reductionFailure = null, artifacts, expectedSources }) {
  validatePurposeRoute(purpose, route, reductionFailure);
  const bytes = boundedSourcePacketBytes(packet, { purpose, route, reductionFailure });
  exactKeys(binding, SOURCE_PACKET_BINDING_KEYS, 'KCRP_SOURCE_BINDING_INVALID');
  if (binding.packetCanonicalizationVersion !== 'kstack-packet-utf8-lf-v1'
    || binding.packetSerializationVersion !== 'kstack-source-record-v1'
    || binding.packetFramingVersion !== 'kstack-frame-token-v1'
    || !Number.isSafeInteger(binding.packetByteLength) || binding.packetByteLength !== bytes.length
    || !HASH.test(binding.packetSha256) || binding.packetSha256 !== bytesSha256(bytes)
    || !Array.isArray(binding.sources) || binding.sources.length === 0) fail('KCRP_SOURCE_BINDING_INVALID');
  if (binding.sources.length > KCRP_LIMITS.sourceRecords) sourceLimitFailure({ purpose, route, reductionFailure, domain: 'source-count', actual: binding.sources.length });
  const artifactMap = asSourceArtifactMap(artifacts);
  if (!Array.isArray(expectedSources) || expectedSources.length !== binding.sources.length) fail('KCRP_SOURCE_BINDING_INVALID');
  const expectedArtifacts = expectedSources.map((source) => validateSourceSpecMetadata(source, artifactMap));
  assertSourceOrdering(expectedSources);
  for (let index = 0; index < expectedSources.length; index += 1) validateSourceSpecContent(expectedSources[index], expectedArtifacts[index]);
  const parsed = [];
  const state = { offset: 0 };
  while (state.offset < bytes.length) parsed.push(parseSourceRecord(bytes, state, { purpose, route, reductionFailure }));
  if (parsed.length !== binding.sources.length) fail('KCRP_SOURCE_BINDING_INVALID');
  const specs = [];
  const rebuiltRecords = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const actual = parsed[index];
    const expected = binding.sources[index];
    exactKeys(expected, SOURCE_BINDING_KEYS, 'KCRP_SOURCE_BINDING_INVALID');
    const spec = Object.fromEntries(SOURCE_SPEC_KEYS.map((key) => [key, expected[key]]));
    if (!canonicalJsonBytes(spec).equals(canonicalJsonBytes(expectedSources[index]))) fail('KCRP_SOURCE_BINDING_INVALID');
    const { content } = validateSourceSpecContent(spec, expectedArtifacts[index]);
    if (actual.sourceId !== spec.sourceId || actual.label !== spec.label || actual.role !== spec.role || actual.inclusion !== spec.inclusion
      || !actual.content.equals(content) || expected.recordByteStart !== actual.recordByteStart
      || expected.recordByteLength !== actual.recordBytes.length || expected.contentByteStart !== actual.contentByteStart
      || expected.contentByteLength !== actual.contentByteLength || expected.sourceSha256 !== bytesSha256(actual.content)
      || expected.recordSha256 !== bytesSha256(actual.recordBytes)) fail('KCRP_SOURCE_BINDING_INVALID');
    const rebuilt = sourceRecordBytes(spec, content);
    if (!rebuilt.bytes.equals(actual.recordBytes)) fail('KCRP_SOURCE_RECONSTRUCTION_MISMATCH');
    specs.push(spec);
    rebuiltRecords.push(rebuilt.bytes);
  }
  assertSourceOrdering(specs);
  if (!Buffer.concat(rebuiltRecords, bytes.length).equals(bytes)) fail('KCRP_SOURCE_RECONSTRUCTION_MISMATCH');
  const verifiedSources = Object.freeze(binding.sources.map((source) => freezeSourceRecord(source)));
  return Object.freeze({
    packetBytes: bytes, packetSha256: binding.packetSha256, sources: verifiedSources,
    dispatchEligible: false, implementationBoundary: KCRP_OFFLINE_BOUNDARIES.status
  });
}

function stronglyConnectedComponents(itemsById) {
  const ids = [...itemsById.keys()].sort(asciiCompare);
  const seen = new Set();
  const finished = [];
  for (const root of ids) {
    if (seen.has(root)) continue;
    seen.add(root);
    const stack = [{ id: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edges = itemsById.get(frame.id).dependsOn;
      if (frame.next < edges.length) {
        const dependency = edges[frame.next++];
        if (!seen.has(dependency)) { seen.add(dependency); stack.push({ id: dependency, next: 0 }); }
      } else {
        finished.push(frame.id);
        stack.pop();
      }
    }
  }
  const reverse = new Map(ids.map((id) => [id, []]));
  for (const item of itemsById.values()) for (const dependency of item.dependsOn) reverse.get(dependency).push(item.itemId);
  for (const edges of reverse.values()) edges.sort(asciiCompare);
  const assigned = new Set();
  const components = [];
  for (const root of finished.reverse()) {
    if (assigned.has(root)) continue;
    assigned.add(root);
    const members = [];
    const stack = [root];
    while (stack.length) {
      const id = stack.pop();
      members.push(id);
      for (const predecessor of reverse.get(id)) if (!assigned.has(predecessor)) { assigned.add(predecessor); stack.push(predecessor); }
    }
    members.sort(asciiCompare);
    components.push(members);
  }
  return components.sort((left, right) => asciiCompare(left[0], right[0]));
}

function validateMechanismGroups(components, itemsById) {
  const groups = new Map();
  for (const members of components) {
    const groupIds = new Set(members.map((id) => itemsById.get(id).mechanismGroupId));
    if (members.length === 1) {
      if (groupIds.size !== 1 || !groupIds.has(null)) fail('KCRP_MECHANISM_GROUP_INVALID');
      continue;
    }
    if (groupIds.size !== 1 || groupIds.has(null)) fail('KCRP_MECHANISM_GROUP_INVALID');
    const [groupId] = groupIds;
    if (!GROUP_ID.test(groupId) || groups.has(groupId)) fail('KCRP_MECHANISM_GROUP_INVALID');
    groups.set(groupId, members);
  }
}

export function validateItemMap(itemMap, { artifacts, expectedItemMapSha256 = null } = {}) {
  exactKeys(itemMap, ['schemaVersion', 'kind', 'canonicalizationVersion', 'threadId', 'phase', 'artifactSet', 'items'], 'KCRP_ITEM_MAP_SCHEMA_INVALID');
  if (itemMap.schemaVersion !== 1 || itemMap.kind !== 'kstack-kcrp-item-map-v1' || itemMap.canonicalizationVersion !== 'kstack-kcrp-json-v1' || !THREAD_ID.test(itemMap.threadId) || !PHASES.has(itemMap.phase)) fail('KCRP_ITEM_MAP_SCHEMA_INVALID');
  let bodyBytes;
  try { bodyBytes = canonicalJsonBytes(itemMap); } catch (error) {
    if (error?.code === 'KCRP_JSON_TOO_LARGE') fail('KCRP_MAP_TOO_LARGE');
    throw error;
  }
  const itemMapSha256 = bytesSha256(bodyBytes);
  if (expectedItemMapSha256 !== null && expectedItemMapSha256 !== itemMapSha256) fail('KCRP_MAP_STALE');
  if (!Array.isArray(itemMap.artifactSet) || itemMap.artifactSet.length === 0 || itemMap.artifactSet.length > KCRP_LIMITS.artifacts) fail('KCRP_ARTIFACT_COUNT_LIMIT');
  if (!Array.isArray(itemMap.items) || itemMap.items.length === 0 || itemMap.items.length > KCRP_LIMITS.items) fail('KCRP_ITEM_COUNT_LIMIT');
  const supplied = asArtifactMap(artifacts);
  const artifactBytes = new Map();
  const artifactIds = new Set();
  let previousArtifact = null;
  for (const binding of itemMap.artifactSet) {
    if (previousArtifact && artifactOrder(previousArtifact, binding) >= 0) fail('KCRP_ARTIFACT_ORDER_INVALID');
    previousArtifact = binding;
    if (artifactIds.has(binding.artifactId)) fail('KCRP_ARTIFACT_ORDER_INVALID');
    artifactIds.add(binding.artifactId);
    artifactBytes.set(binding.artifactId, validateArtifactBinding(binding, supplied));
  }
  const itemsById = new Map();
  let priorItemId = null;
  let totalSpans = 0;
  for (const item of itemMap.items) {
    exactKeys(item, ['itemId', 'artifactId', 'spans', 'dependsOn', 'risk', 'status', 'reductionEligibility', 'mechanismGroupId'], 'KCRP_ITEM_SCHEMA_INVALID');
    if (!ID.test(item.itemId) || (priorItemId !== null && asciiCompare(priorItemId, item.itemId) >= 0)) fail('KCRP_ITEM_ORDER_INVALID');
    priorItemId = item.itemId;
    if (!artifactBytes.has(item.artifactId) || !RISKS.has(item.risk) || !STATUSES.has(item.status) || !ELIGIBILITY.has(item.reductionEligibility)) fail('KCRP_ITEM_SCHEMA_INVALID');
    if (item.mechanismGroupId !== null && (typeof item.mechanismGroupId !== 'string' || !GROUP_ID.test(item.mechanismGroupId))) fail('KCRP_ITEM_SCHEMA_INVALID');
    if (!Array.isArray(item.spans) || item.spans.length === 0 || item.spans.length > KCRP_LIMITS.spansPerItem) fail('KCRP_SPAN_COUNT_LIMIT');
    if (!Array.isArray(item.dependsOn)) fail('KCRP_DEPENDENCY_AMBIGUOUS');
    if (item.dependsOn.length > KCRP_LIMITS.dependenciesPerItem) fail('KCRP_DEPENDENCY_COUNT_LIMIT');
    assertSortedUnique(item.dependsOn, ID, 'KCRP_DEPENDENCY_AMBIGUOUS');
    let previousSpan = null;
    const bytes = artifactBytes.get(item.artifactId);
    for (const span of item.spans) {
      exactKeys(span, ['byteStart', 'byteLength', 'sha256'], 'KCRP_SPAN_INVALID');
      const start = safeInteger(span.byteStart);
      const length = safeInteger(span.byteLength, { positive: true });
      if (!HASH.test(span.sha256) || start > Number.MAX_SAFE_INTEGER - length || start + length > bytes.length) fail('KCRP_SPAN_INVALID');
      if (previousSpan && (previousSpan.byteStart > start || (previousSpan.byteStart === start && previousSpan.byteLength >= length))) fail('KCRP_SPAN_ORDER_INVALID');
      previousSpan = span;
      if (bytesSha256(bytes.subarray(start, start + length)) !== span.sha256) fail('KCRP_SPAN_STALE');
      totalSpans += 1;
    }
    itemsById.set(item.itemId, item);
  }
  if (totalSpans > KCRP_LIMITS.totalSpans) fail('KCRP_SPAN_COUNT_LIMIT');
  for (const item of itemMap.items) {
    for (const dependency of item.dependsOn) {
      if (dependency === item.itemId) fail('KCRP_DEPENDENCY_AMBIGUOUS');
      const target = itemsById.get(dependency);
      if (!target) fail('KCRP_DEPENDENCY_MISSING');
      if (target.status === 'rejected') fail('KCRP_DEPENDENCY_REJECTED');
    }
  }
  const allSpans = new Map();
  for (const item of itemMap.items) {
    const list = allSpans.get(item.artifactId) ?? [];
    for (const span of item.spans) list.push({ ...span, itemId: item.itemId });
    allSpans.set(item.artifactId, list);
  }
  for (const spans of allSpans.values()) {
    spans.sort((left, right) => left.byteStart - right.byteStart || left.byteLength - right.byteLength || asciiCompare(left.itemId, right.itemId));
    for (let position = 1; position < spans.length; position += 1) {
      const prior = spans[position - 1];
      if (prior.byteStart + prior.byteLength > spans[position].byteStart) fail('KCRP_SPAN_OVERLAP');
    }
  }
  const components = stronglyConnectedComponents(itemsById);
  validateMechanismGroups(components, itemsById);
  return Object.freeze({ itemMap, bodyBytes, itemMapSha256, artifactBytes, itemsById, components });
}

function validateRequest(requestedItemIds, itemsById) {
  assertSortedUnique(requestedItemIds, ID, 'KCRP_REQUEST_INVALID', { allowEmpty: false, maximum: KCRP_LIMITS.requestedItems });
  for (const id of requestedItemIds) {
    const item = itemsById.get(id);
    if (!item || item.status !== 'open') fail('KCRP_REQUEST_INVALID');
  }
}

function collectReductionPreflight(itemMap, { artifacts, expectedItemMapSha256, requestedItemIds }) {
  const observations = [];
  const add = (precedenceOrdinal, code, stage, detail) => {
    if (!observations.some((entry) => entry.precedenceOrdinal === precedenceOrdinal && entry.code === code)) observations.push({ precedenceOrdinal, code, stage, detail });
  };
  const finish = (validated = null) => {
    observations.sort((left, right) => left.precedenceOrdinal - right.precedenceOrdinal || asciiCompare(left.code, right.code));
    return { observations, validated };
  };
  if (itemMap === null || itemMap === undefined) {
    add(1, 'KCRP_MAP_MISSING', 'map', { mapState: 'missing' });
    return finish();
  }
  let actualMapSha256 = null;
  try { actualMapSha256 = bytesSha256(canonicalJsonBytes(itemMap)); }
  catch (error) {
    add(2, error?.code === 'KCRP_JSON_TOO_LARGE' ? 'KCRP_MAP_TOO_LARGE' : 'KCRP_MAP_STALE', 'map', { observedCode: error?.code ?? 'KCRP_ITEM_MAP_SCHEMA_INVALID' });
    return finish();
  }
  if (actualMapSha256 !== null && expectedItemMapSha256 !== null && actualMapSha256 !== expectedItemMapSha256) {
    add(2, 'KCRP_MAP_STALE', 'map', { actualItemMapSha256: actualMapSha256, expectedItemMapSha256 });
  }
  const items = Array.isArray(itemMap?.items) ? itemMap.items : [];
  let hardBoundInvalid = false;
  if (Array.isArray(itemMap?.artifactSet) && itemMap.artifactSet.length > KCRP_LIMITS.artifacts) {
    add(2, 'KCRP_ARTIFACT_COUNT_LIMIT', 'map', { artifactCount: itemMap.artifactSet.length, maximum: KCRP_LIMITS.artifacts });
    hardBoundInvalid = true;
  }
  if (Array.isArray(itemMap?.items) && itemMap.items.length > KCRP_LIMITS.items) {
    add(2, 'KCRP_ITEM_COUNT_LIMIT', 'map', { itemCount: itemMap.items.length, maximum: KCRP_LIMITS.items });
    hardBoundInvalid = true;
  }
  if (Array.isArray(requestedItemIds) && requestedItemIds.length > KCRP_LIMITS.requestedItems) {
    add(10, 'KCRP_CLOSURE_COUNT_LIMIT', 'closure', { requestedItemCount: requestedItemIds.length, maximum: KCRP_LIMITS.requestedItems });
    hardBoundInvalid = true;
  }
  if (hardBoundInvalid) return finish();
  for (const item of items) {
    if (Array.isArray(item?.dependsOn) && item.dependsOn.length > KCRP_LIMITS.dependenciesPerItem) {
      add(6, 'KCRP_DEPENDENCY_COUNT_LIMIT', 'closure', {
        observedCode: 'KCRP_DEPENDENCY_COUNT_LIMIT', itemId: typeof item.itemId === 'string' ? item.itemId : null,
        dependencyCount: item.dependsOn.length, maximum: KCRP_LIMITS.dependenciesPerItem
      });
      return finish();
    }
  }
  const itemById = new Map();
  for (const entry of items) if (entry && typeof entry.itemId === 'string') itemById.set(entry.itemId, entry);
  let requestInvalid = !Array.isArray(requestedItemIds) || requestedItemIds.length === 0;
  if (Array.isArray(requestedItemIds)) {
    let previous = null;
    for (const id of requestedItemIds) {
      if (typeof id !== 'string' || !ID.test(id) || (previous !== null && asciiCompare(previous, id) >= 0)) requestInvalid = true;
      previous = typeof id === 'string' ? id : previous;
    }
  }
  if (requestInvalid) add(6, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure', { requestState: 'invalid' });
  const unknownRequestedItemIds = Array.isArray(requestedItemIds) ? requestedItemIds.filter((id) => typeof id === 'string' && ID.test(id) && !itemById.has(id)).sort(asciiCompare) : [];
  if (unknownRequestedItemIds.length) add(3, 'KCRP_DEPENDENCY_MISSING', 'closure', { unknownRequestedItemIds });
  const rejectedRequestedItemIds = Array.isArray(requestedItemIds) ? requestedItemIds.filter((id) => itemById.get(id)?.status === 'rejected').sort(asciiCompare) : [];
  const validatedRequestedItemIds = Array.isArray(requestedItemIds) ? requestedItemIds.filter((id) => itemById.get(id)?.status === 'validated').sort(asciiCompare) : [];
  if (rejectedRequestedItemIds.length) add(5, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure', { rejectedRequestedItemIds });
  if (validatedRequestedItemIds.length) add(6, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure', { validatedRequestedItemIds });
  const missingDependencyEdges = [];
  const rejectedDependencyEdges = [];
  const ambiguousDependencyItemIds = new Set();
  let missingDependencyEdgeCount = 0;
  let rejectedDependencyEdgeCount = 0;
  for (const item of items) {
    if (!item || typeof item.itemId !== 'string' || !Array.isArray(item.dependsOn)) continue;
    let previous = null;
    for (const dependency of item.dependsOn) {
      if (typeof dependency !== 'string') { ambiguousDependencyItemIds.add(item.itemId); continue; }
      if (dependency === item.itemId || (previous !== null && asciiCompare(previous, dependency) >= 0)) ambiguousDependencyItemIds.add(item.itemId);
      previous = dependency;
      const target = itemById.get(dependency);
      if (!target) {
        missingDependencyEdgeCount += 1;
        if (missingDependencyEdges.length < KCRP_LIMITS.dependenciesPerItem) missingDependencyEdges.push(`${item.itemId}->${dependency}`);
      } else if (target.status === 'rejected') {
        rejectedDependencyEdgeCount += 1;
        if (rejectedDependencyEdges.length < KCRP_LIMITS.dependenciesPerItem) rejectedDependencyEdges.push(`${item.itemId}->${dependency}`);
      }
    }
  }
  missingDependencyEdges.sort(asciiCompare);
  rejectedDependencyEdges.sort(asciiCompare);
  const allAmbiguousIds = [...ambiguousDependencyItemIds].sort(asciiCompare);
  const ambiguousIds = allAmbiguousIds.slice(0, KCRP_LIMITS.dependenciesPerItem);
  if (missingDependencyEdgeCount) add(4, 'KCRP_DEPENDENCY_MISSING', 'closure', {
    missingDependencyEdges,
    ...(missingDependencyEdgeCount > missingDependencyEdges.length ? { totalMissingDependencyEdgeCount: missingDependencyEdgeCount } : {})
  });
  if (rejectedDependencyEdgeCount) add(5, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure', {
    rejectedDependencyEdges,
    ...(rejectedDependencyEdgeCount > rejectedDependencyEdges.length ? { totalRejectedDependencyEdgeCount: rejectedDependencyEdgeCount } : {})
  });
  if (ambiguousIds.length) add(6, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure', {
    ambiguousDependencyItemIds: ambiguousIds,
    totalAmbiguousDependencyItemCount: allAmbiguousIds.length
  });
  let validated = null;
  try { validated = validateItemMap(itemMap, { artifacts }); }
  catch (error) {
    const mapping = {
      KCRP_ARTIFACT_STALE: [2, 'KCRP_MAP_STALE', 'map'], KCRP_SPAN_STALE: [2, 'KCRP_MAP_STALE', 'map'],
      KCRP_MAP_TOO_LARGE: [2, 'KCRP_MAP_TOO_LARGE', 'map'], KCRP_ARTIFACT_COUNT_LIMIT: [2, 'KCRP_ARTIFACT_COUNT_LIMIT', 'map'],
      KCRP_ITEM_COUNT_LIMIT: [2, 'KCRP_ITEM_COUNT_LIMIT', 'map'], KCRP_DEPENDENCY_MISSING: [4, 'KCRP_DEPENDENCY_MISSING', 'closure'],
      KCRP_DEPENDENCY_REJECTED: [5, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure'], KCRP_DEPENDENCY_AMBIGUOUS: [6, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure'],
      KCRP_DEPENDENCY_COUNT_LIMIT: [6, 'KCRP_DEPENDENCY_COUNT_LIMIT', 'closure'],
      KCRP_MECHANISM_GROUP_INVALID: [6, 'KCRP_DEPENDENCY_AMBIGUOUS', 'closure'], KCRP_SPAN_INVALID: [8, 'KCRP_SLICE_INVALID', 'slice'],
      KCRP_SPAN_ORDER_INVALID: [8, 'KCRP_SLICE_INVALID', 'slice'], KCRP_SPAN_COUNT_LIMIT: [8, 'KCRP_SPAN_COUNT_LIMIT', 'slice'],
      KCRP_SPAN_OVERLAP: [9, 'KCRP_SPAN_OVERLAP', 'slice']
    };
    const [ordinal, code, stage] = mapping[error?.code] ?? [2, 'KCRP_MAP_STALE', 'map'];
    add(ordinal, code, stage, { observedCode: error?.code ?? 'KCRP_ITEM_MAP_SCHEMA_INVALID' });
  }
  return finish(validated);
}

export function buildDeclaredClosure(itemMap, { artifacts, expectedItemMapSha256 = null, requestedItemIds } = {}) {
  const preflight = collectReductionPreflight(itemMap, { artifacts, expectedItemMapSha256, requestedItemIds });
  if (preflight.observations.length) {
    const sealed = sealDiagnosticSet(preflight.observations);
    return Object.freeze({
      itemMapSha256: preflight.validated?.itemMapSha256 ?? null,
      requestedItemIds: Array.isArray(requestedItemIds) && requestedItemIds.length <= KCRP_LIMITS.requestedItems ? [...requestedItemIds] : [],
      includedItemIds: [], omittedItemIds: [], closureProof: [], components: [], reachableEntangledItemIds: [],
      route: 'full-fallback', ...sealed
    });
  }
  const validated = preflight.validated;
  validateRequest(requestedItemIds, validated.itemsById);
  const queue = [...requestedItemIds];
  const reached = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (reached.has(id)) continue;
    reached.add(id);
    for (const dependency of validated.itemsById.get(id).dependsOn) queue.push(dependency);
  }
  const includedItemIds = [...reached].sort(asciiCompare);
  if (includedItemIds.length > KCRP_LIMITS.includedItems) fail('KCRP_CLOSURE_COUNT_LIMIT');
  const omittedItemIds = [...validated.itemsById.keys()].filter((id) => !reached.has(id)).sort(asciiCompare);
  const closureProof = includedItemIds.map((itemId) => ({ itemId, dependsOn: [...validated.itemsById.get(itemId).dependsOn] }));
  const components = validated.components.map((memberItemIds) => ({ memberItemIds: [...memberItemIds], mechanismGroupId: validated.itemsById.get(memberItemIds[0]).mechanismGroupId }));
  const reachableEntangledItemIds = includedItemIds.filter((id) => validated.itemsById.get(id).reductionEligibility === 'entangled');
  const affectedMechanismGroupIds = [...new Set(reachableEntangledItemIds.map((id) => validated.itemsById.get(id).mechanismGroupId).filter(Boolean))].sort(asciiCompare);
  const sealed = reachableEntangledItemIds.length === 0 ? null : sealDiagnosticSet([{
    precedenceOrdinal: 7, code: 'KCRP_ENTANGLED_REACHABLE', stage: 'closure',
    detail: { reachableEntangledItemIds, affectedMechanismGroupIds }
  }]);
  return Object.freeze({
    itemMapSha256: validated.itemMapSha256, requestedItemIds: [...requestedItemIds], includedItemIds,
    omittedItemIds, closureProof, components, reachableEntangledItemIds,
    route: sealed === null ? 'reduced' : 'full-fallback', reductionFailure: sealed?.reductionFailure ?? null,
    diagnosticSet: sealed?.diagnosticSet ?? null, diagnosticSetSha256: sealed?.diagnosticSetSha256 ?? null,
    diagnosticEvidence: sealed?.diagnosticEvidence ?? Object.freeze([])
  });
}

function verifyClaimedComponents(components, itemsById) {
  if (!Array.isArray(components) || components.length === 0) fail('KCRP_CLOSURE_PROOF_INVALID');
  const reverse = new Map([...itemsById.keys()].map((id) => [id, []]));
  for (const item of itemsById.values()) for (const dependency of item.dependsOn) reverse.get(dependency).push(item.itemId);
  const owner = new Map();
  let priorFirst = null;
  for (const [componentIndex, component] of components.entries()) {
    exactKeys(component, ['memberItemIds', 'mechanismGroupId'], 'KCRP_CLOSURE_PROOF_INVALID');
    assertSortedUnique(component.memberItemIds, ID, 'KCRP_CLOSURE_PROOF_INVALID', { allowEmpty: false });
    if (priorFirst !== null && asciiCompare(priorFirst, component.memberItemIds[0]) >= 0) fail('KCRP_CLOSURE_PROOF_INVALID');
    priorFirst = component.memberItemIds[0];
    for (const id of component.memberItemIds) {
      if (!itemsById.has(id) || owner.has(id)) fail('KCRP_CLOSURE_PROOF_INVALID');
      owner.set(id, componentIndex);
      if (itemsById.get(id).mechanismGroupId !== component.mechanismGroupId) fail('KCRP_CLOSURE_PROOF_INVALID');
    }
    const allowed = new Set(component.memberItemIds);
    const walk = (adjacency) => {
      const reached = new Set([component.memberItemIds[0]]);
      for (const id of reached) for (const next of adjacency(id)) if (allowed.has(next)) reached.add(next);
      return reached.size === allowed.size;
    };
    if (!walk((id) => itemsById.get(id).dependsOn) || !walk((id) => reverse.get(id))) fail('KCRP_CLOSURE_PROOF_INVALID');
  }
  if (owner.size !== itemsById.size) fail('KCRP_CLOSURE_PROOF_INVALID');
  const edges = components.map(() => new Set());
  const indegree = components.map(() => 0);
  for (const item of itemsById.values()) for (const dependency of item.dependsOn) {
    const from = owner.get(item.itemId); const to = owner.get(dependency);
    if (from !== to && !edges[from].has(to)) { edges[from].add(to); indegree[to] += 1; }
  }
  const queue = indegree.map((degree, index) => ({ degree, index })).filter(({ degree }) => degree === 0).map(({ index }) => index);
  let consumed = 0;
  while (queue.length) {
    const index = queue.shift(); consumed += 1;
    for (const target of edges[index]) { indegree[target] -= 1; if (indegree[target] === 0) queue.push(target); }
  }
  if (consumed !== components.length) fail('KCRP_CLOSURE_PROOF_INVALID');
  return components;
}

function sameJson(left, right) {
  return canonicalJsonBytes(left).equals(canonicalJsonBytes(right));
}

export function verifyDeclaredClosure(itemMap, claim, { artifacts, expectedItemMapSha256 = null } = {}) {
  const validated = validateItemMap(itemMap, { artifacts, expectedItemMapSha256 });
  exactKeys(claim, ['itemMapSha256', 'requestedItemIds', 'includedItemIds', 'omittedItemIds', 'closureProof', 'components', 'reachableEntangledItemIds', 'route', 'reductionFailure', 'diagnosticSet', 'diagnosticSetSha256', 'diagnosticEvidence'], 'KCRP_CLOSURE_PROOF_INVALID');
  validateRequest(claim.requestedItemIds, validated.itemsById);
  const reached = new Set(claim.requestedItemIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of itemMap.items) {
      if (!reached.has(item.itemId)) continue;
      for (const dependency of item.dependsOn) if (!reached.has(dependency)) { reached.add(dependency); changed = true; }
    }
  }
  const included = [...reached].sort(asciiCompare);
  const omitted = itemMap.items.map((item) => item.itemId).filter((id) => !reached.has(id));
  const proof = included.map((itemId) => ({ itemId, dependsOn: [...validated.itemsById.get(itemId).dependsOn] }));
  const components = verifyClaimedComponents(claim.components, validated.itemsById);
  const entangled = included.filter((id) => validated.itemsById.get(id).reductionEligibility === 'entangled');
  const affected = [...new Set(entangled.map((id) => validated.itemsById.get(id).mechanismGroupId).filter(Boolean))].sort(asciiCompare);
  const sealed = entangled.length ? sealDiagnosticSet([{
    precedenceOrdinal: 7, code: 'KCRP_ENTANGLED_REACHABLE', stage: 'closure',
    detail: { reachableEntangledItemIds: entangled, affectedMechanismGroupIds: affected }
  }]) : null;
  const expected = {
    itemMapSha256: validated.itemMapSha256, requestedItemIds: [...claim.requestedItemIds], includedItemIds: included,
    omittedItemIds: omitted, closureProof: proof, components, reachableEntangledItemIds: entangled,
    route: sealed === null ? 'reduced' : 'full-fallback', reductionFailure: sealed?.reductionFailure ?? null,
    diagnosticSet: sealed?.diagnosticSet ?? null, diagnosticSetSha256: sealed?.diagnosticSetSha256 ?? null,
    diagnosticEvidence: sealed?.diagnosticEvidence ?? []
  };
  if (!sameJson(claim, expected)) fail('KCRP_CLOSURE_PROOF_INVALID');
  return true;
}

function asBytes(value, code) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  fail(code);
}

function byteLength(value, code) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value.length;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  fail(code);
}

function boundedUtf8ByteLength(value, maximum) {
  const capacity = value.length > Math.floor((maximum + 1) / 3) ? maximum + 1 : value.length * 3;
  const evidence = Buffer.allocUnsafe(capacity);
  const { read, written } = new TextEncoder().encodeInto(value, evidence);
  return read < value.length || written > maximum ? maximum + 1 : written;
}

function decimal(value) {
  return Buffer.from(String(safeInteger(value)), 'ascii');
}

function validatePurposeRoute(purpose, route, reductionFailure) {
  if (!PURPOSES.has(purpose) || !ROUTES.has(route)) fail('KCRP_PURPOSE_ROUTE_INVALID');
  if (route === 'reduced') {
    if (purpose !== 'remediation' || reductionFailure !== null) fail('KCRP_PURPOSE_ROUTE_INVALID');
    return;
  }
  if (route === 'full-fallback') {
    if (purpose !== 'remediation' || reductionFailure === null) fail('KCRP_PURPOSE_ROUTE_INVALID');
    validateReductionFailure(reductionFailure);
    return;
  }
  if (purpose === 'remediation' || reductionFailure !== null) fail('KCRP_PURPOSE_ROUTE_INVALID');
}

function throwSizeFailure({ purpose, route, reductionFailure, domain, actual, maximum }) {
  const reducedCode = domain === 'manifest' ? 'KCRP_REDUCED_MANIFEST_TOO_LARGE' : 'KCRP_REDUCED_TOO_LARGE';
  const fullCode = domain === 'manifest' ? 'KCRP_FULL_MANIFEST_TOO_LARGE' : 'KCRP_FULL_TOO_LARGE';
  const code = route === 'reduced' ? reducedCode : fullCode;
  const sealed = sizeDiagnostic(code, route, domain, actual, maximum);
  const error = new Error(code);
  error.code = code;
  error.purpose = purpose;
  error.route = route;
  error.domain = domain;
  error.diagnosticSet = sealed.diagnosticSet;
  error.diagnosticSetSha256 = sealed.diagnosticSetSha256;
  error.diagnosticEvidence = sealed.diagnosticEvidence;
  if (route === 'reduced') {
    error.reductionFailure = sealed.reductionFailure;
    error.nextRoute = 'full-fallback';
    error.fallbackAllowed = true;
    error.block = null;
  } else {
    error.reductionFailure = route === 'full-fallback' ? reductionFailure : null;
    error.nextRoute = null;
    error.fallbackAllowed = false;
    error.block = { code, stage: 'size', evidenceSha256: sealed.diagnosticSetSha256 };
  }
  throw error;
}

export function frameReviewInputV1({ purpose, route, reductionFailure = null, manifest, preamble = Buffer.alloc(0), packet = Buffer.alloc(0) }) {
  validatePurposeRoute(purpose, route, reductionFailure);
  let manifestBytes;
  try { manifestBytes = canonicalJsonBytes(manifest); } catch (error) {
    if (error?.code === 'KCRP_JSON_TOO_LARGE') throwSizeFailure({ purpose, route, reductionFailure, domain: 'manifest', actual: error.actualBytes, maximum: KCRP_LIMITS.manifestBytes });
    throw error;
  }
  const preambleByteLength = byteLength(preamble, 'KCRP_PREAMBLE_INVALID');
  if (preambleByteLength > KCRP_LIMITS.reviewInputBytes) throwSizeFailure({ purpose, route, reductionFailure, domain: 'review-input', actual: preambleByteLength, maximum: KCRP_LIMITS.reviewInputBytes });
  const packetByteLength = byteLength(packet, 'KCRP_PACKET_INVALID');
  if (packetByteLength > KCRP_LIMITS.packetBytes) throwSizeFailure({ purpose, route, reductionFailure, domain: 'packet', actual: packetByteLength, maximum: KCRP_LIMITS.packetBytes });
  const manifestSha256 = bytesSha256(manifestBytes);
  const sectionLength = (name, length) => Buffer.byteLength(name, 'ascii') + 1 + String(length).length + 1 + length + 1;
  const calculatedReviewInputByteLength = Buffer.byteLength('KSTACK-KCRP-REVIEW-INPUT-V1\n', 'ascii')
    + Buffer.byteLength(`MANIFEST-SHA256 64\n${manifestSha256.toUpperCase()}\n`, 'ascii')
    + sectionLength('MANIFEST', manifestBytes.length)
    + sectionLength('PREAMBLE', preambleByteLength)
    + sectionLength('PACKET', packetByteLength)
    + Buffer.byteLength('END KSTACK-KCRP-REVIEW-INPUT-V1\n', 'ascii');
  if (!Number.isSafeInteger(calculatedReviewInputByteLength) || calculatedReviewInputByteLength > KCRP_LIMITS.reviewInputBytes) throwSizeFailure({ purpose, route, reductionFailure, domain: 'review-input', actual: calculatedReviewInputByteLength, maximum: KCRP_LIMITS.reviewInputBytes });
  const preambleBytes = asBytes(preamble, 'KCRP_PREAMBLE_INVALID');
  const packetBytes = asBytes(packet, 'KCRP_PACKET_INVALID');
  const parts = [
    Buffer.from('KSTACK-KCRP-REVIEW-INPUT-V1\n', 'ascii'),
    Buffer.from(`MANIFEST-SHA256 64\n${manifestSha256.toUpperCase()}\n`, 'ascii'),
    Buffer.from('MANIFEST ', 'ascii'), decimal(manifestBytes.length), Buffer.from('\n', 'ascii'), manifestBytes, Buffer.from('\n', 'ascii'),
    Buffer.from('PREAMBLE ', 'ascii'), decimal(preambleBytes.length), Buffer.from('\n', 'ascii'), preambleBytes, Buffer.from('\n', 'ascii'),
    Buffer.from('PACKET ', 'ascii'), decimal(packetBytes.length), Buffer.from('\n', 'ascii'), packetBytes, Buffer.from('\n', 'ascii'),
    Buffer.from('END KSTACK-KCRP-REVIEW-INPUT-V1\n', 'ascii')
  ];
  const reviewInputByteLength = parts.reduce((total, part) => total + part.length, 0);
  if (reviewInputByteLength !== calculatedReviewInputByteLength) fail('KCRP_REVIEW_INPUT_INVALID');
  const reviewInput = Buffer.concat(parts, reviewInputByteLength);
  return Object.freeze({
    purpose, route, reductionFailure, manifestBytes, manifestSha256, preambleBytes, packetBytes, reviewInput,
    reviewInputSha256: bytesSha256(reviewInput), reviewInputByteLength: reviewInput.length,
    dispatchEligible: false, implementationBoundary: KCRP_OFFLINE_BOUNDARIES.status
  });
}

function readLine(bytes, state) {
  const end = bytes.indexOf(0x0a, state.offset);
  if (end < 0) fail('KCRP_REVIEW_INPUT_INVALID');
  const lineBytes = bytes.subarray(state.offset, end);
  if (lineBytes.some((value) => value > 0x7f)) fail('KCRP_REVIEW_INPUT_INVALID');
  const line = lineBytes.toString('ascii');
  state.offset = end + 1;
  return line;
}

function readSection(bytes, state, name) {
  const line = readLine(bytes, state);
  const match = new RegExp(`^${name} (0|[1-9][0-9]*)$`).exec(line);
  if (!match) fail('KCRP_REVIEW_INPUT_INVALID');
  const length = Number(match[1]);
  if (!Number.isSafeInteger(length) || state.offset + length >= bytes.length) fail('KCRP_REVIEW_INPUT_INVALID');
  const value = bytes.subarray(state.offset, state.offset + length);
  state.offset += length;
  if (bytes[state.offset] !== 0x0a) fail('KCRP_REVIEW_INPUT_INVALID');
  state.offset += 1;
  return value;
}

export function verifyReviewInputV1(input, { purpose, route, reductionFailure = null, expectedReviewInputSha256 = null } = {}) {
  validatePurposeRoute(purpose, route, reductionFailure);
  const bytes = asBytes(input, 'KCRP_REVIEW_INPUT_INVALID');
  if (bytes.length > KCRP_LIMITS.reviewInputBytes) throwSizeFailure({ purpose, route, reductionFailure, domain: 'review-input', actual: bytes.length, maximum: KCRP_LIMITS.reviewInputBytes });
  const state = { offset: 0 };
  if (readLine(bytes, state) !== 'KSTACK-KCRP-REVIEW-INPUT-V1') fail('KCRP_REVIEW_INPUT_INVALID');
  if (readLine(bytes, state) !== 'MANIFEST-SHA256 64') fail('KCRP_REVIEW_INPUT_INVALID');
  const declaredDigest = readLine(bytes, state);
  if (!/^[0-9A-F]{64}$/.test(declaredDigest)) fail('KCRP_REVIEW_INPUT_INVALID');
  const manifestBytes = readSection(bytes, state, 'MANIFEST');
  const preambleBytes = readSection(bytes, state, 'PREAMBLE');
  const packetBytes = readSection(bytes, state, 'PACKET');
  if (readLine(bytes, state) !== 'END KSTACK-KCRP-REVIEW-INPUT-V1' || state.offset !== bytes.length) fail('KCRP_REVIEW_INPUT_INVALID');
  if (packetBytes.length > KCRP_LIMITS.packetBytes) throwSizeFailure({ purpose, route, reductionFailure, domain: 'packet', actual: packetBytes.length, maximum: KCRP_LIMITS.packetBytes });
  if (manifestBytes.length > KCRP_LIMITS.manifestBytes) throwSizeFailure({ purpose, route, reductionFailure, domain: 'manifest', actual: manifestBytes.length, maximum: KCRP_LIMITS.manifestBytes });
  const actualManifestSha256 = bytesSha256(manifestBytes);
  if (declaredDigest !== actualManifestSha256.toUpperCase()) fail('KCRP_MANIFEST_DIGEST_MISMATCH');
  const manifest = parseCanonicalJson(manifestBytes);
  if (Object.hasOwn(manifest, 'purpose') && manifest.purpose !== purpose) fail('KCRP_PURPOSE_ROUTE_INVALID');
  if (Object.hasOwn(manifest, 'route') && manifest.route !== route) fail('KCRP_PURPOSE_ROUTE_INVALID');
  const reviewInputSha256 = bytesSha256(bytes);
  if (expectedReviewInputSha256 !== null && expectedReviewInputSha256 !== reviewInputSha256) fail('KCRP_REVIEW_INPUT_STALE');
  return Object.freeze({ manifest, manifestBytes, manifestSha256: actualManifestSha256, preambleBytes, packetBytes, reviewInputSha256, reviewInputByteLength: bytes.length });
}

export function offlineClosureInputEligibleV1(input) {
  exactKeys(input, [
    'purpose', 'route', 'reductionFailure', 'block', 'requestedItemIds', 'includedItemIds',
    'omittedItemIds', 'currentItemIds', 'completeRootCoverage', 'bindingsFreshAndReconstructible',
    'scanStatus', 'runnerOutcome', 'responseReceiptExact', 'invocationCurrent', 'invocationUnconsumed'
  ], 'KCRP_ELIGIBILITY_INPUT_INVALID');
  for (const field of ['requestedItemIds', 'includedItemIds', 'omittedItemIds', 'currentItemIds']) assertSortedUnique(input[field], ID, 'KCRP_ELIGIBILITY_INPUT_INVALID');
  return input.purpose === 'closure'
    && input.route === 'full-required'
    && input.reductionFailure === null
    && input.block === null
    && input.requestedItemIds.length === 0
    && input.omittedItemIds.length === 0
    && sameJson(input.includedItemIds, input.currentItemIds)
    && input.completeRootCoverage === true
    && input.bindingsFreshAndReconstructible === true
    && input.scanStatus === 'pass'
    && input.runnerOutcome === 'complete'
    && input.responseReceiptExact === true
    && input.invocationCurrent === true
    && input.invocationUnconsumed === true;
}
