import assert from 'node:assert/strict';
import test from 'node:test';
import { bytesSha256 } from '../plugins/kstack/scripts/kstack-kcrp-json.mjs';
import {
  KCRP_LIMITS, buildKcrpSourcePacketV1, canonicalizeArtifactBytes,
  verifyKcrpSourcePacketV1
} from '../plugins/kstack/scripts/kstack-kcrp-core.mjs';

function errorCode(code) { return (error) => error?.code === code; }

function artifactBinding(artifactId, role, repositoryRelativePath, bytes) {
  const canonical = canonicalizeArtifactBytes(bytes);
  return {
    artifactId, role, repositoryRelativePath, canonicalization: 'kstack-utf8-lf-v1',
    byteLength: canonical.length, sha256: bytesSha256(canonical)
  };
}

function artifactEntry(artifactId, role, repositoryRelativePath, bytes) {
  return { binding: artifactBinding(artifactId, role, repositoryRelativePath, bytes), bytes };
}

function source(entry, { sourceId = 'KCRP_I000001_S000001', label = 'ITEM_A', role = 'design-under-review', inclusion = 'excerpt', byteStart = 0, byteLength = entry.binding.byteLength } = {}) {
  const canonical = canonicalizeArtifactBytes(entry.bytes);
  return {
    schemaVersion: 1, kind: 'kstack-kcrp-source-record-v1', sourceId, label, role, inclusion,
    artifact: structuredClone(entry.binding),
    span: { byteStart, byteLength, sha256: bytesSha256(canonical.subarray(byteStart, byteStart + byteLength)) }
  };
}

function recordLength(spec, contentLength) {
  const idLength = Buffer.byteLength(spec.sourceId);
  const labelLength = Buffer.byteLength(spec.label);
  return Buffer.byteLength(
    `KSTACK-SOURCE-RECORD-V1\nID ${idLength}\n${spec.sourceId}\nLABEL ${labelLength}\n${spec.label}\nROLE ${spec.role}\nINCLUSION ${spec.inclusion}\nCONTENT ${contentLength}\n`,
    'utf8'
  ) + contentLength + Buffer.byteLength('\nEND KSTACK-SOURCE-RECORD-V1\n', 'ascii');
}

function rawRecord(spec, content) {
  const prefix = Buffer.from(
    `KSTACK-SOURCE-RECORD-V1\nID ${Buffer.byteLength(spec.sourceId)}\n${spec.sourceId}\nLABEL ${Buffer.byteLength(spec.label)}\n${spec.label}\nROLE ${spec.role}\nINCLUSION ${spec.inclusion}\nCONTENT ${content.length}\n`,
    'utf8'
  );
  return { bytes: Buffer.concat([prefix, content, Buffer.from('\nEND KSTACK-SOURCE-RECORD-V1\n')]), contentByteStart: prefix.length };
}

const priorReductionFailure = Object.freeze({ code: 'KCRP_MAP_STALE', stage: 'map', evidenceSha256: 'a'.repeat(64) });

test('reduced, full-required, and full-fallback source packets reconstruct exactly and remain offline', () => {
  const entry = artifactEntry('ART_A', 'primary', 'design/main.md', Buffer.from('alpha\nbravo\n'));
  const contexts = { ART_A: entry };
  const spec = source(entry, { inclusion: 'full' });
  for (const state of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null },
    { purpose: 'closure', route: 'full-required', reductionFailure: null },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorReductionFailure }
  ]) {
    const built = buildKcrpSourcePacketV1({ ...state, sources: [spec], artifacts: contexts });
    assert.equal(built.dispatchEligible, false);
    assert.equal(built.implementationBoundary, 'OFFLINE_SUBSET_ONLY');
    assert.equal(built.binding.packetSha256, bytesSha256(built.packetBytes));
    assert.deepEqual(Object.keys(built.binding.sources[0]).sort(), [
      'artifact', 'contentByteLength', 'contentByteStart', 'inclusion', 'kind', 'label',
      'recordByteLength', 'recordByteStart', 'recordSha256', 'role', 'schemaVersion',
      'sourceId', 'sourceSha256', 'span'
    ].sort());
    const verified = verifyKcrpSourcePacketV1(built.packetBytes, built.binding, { ...state, artifacts: contexts, expectedSources: [spec] });
    assert.equal(verified.packetSha256, built.binding.packetSha256);
    assert.equal(verified.packetBytes.equals(built.packetBytes), true);
  }
});

test('source schema and record header are closed and field ordered', () => {
  const entry = artifactEntry('ART_A', 'primary', 'design/main.md', Buffer.from('alpha\n'));
  const spec = source(entry, { inclusion: 'full' });
  const built = buildKcrpSourcePacketV1({ purpose: 'closure', route: 'full-required', sources: [spec], artifacts: { ART_A: entry } });
  assert.match(built.packetBytes.toString('utf8'), /^KSTACK-SOURCE-RECORD-V1\nID [0-9]+\nKCRP_I000001_S000001\nLABEL [0-9]+\nITEM_A\nROLE design-under-review\nINCLUSION full\nCONTENT [0-9]+\nalpha\n\nEND KSTACK-SOURCE-RECORD-V1\n$/);
  const extra = { ...spec, extra: true };
  assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'closure', route: 'full-required', sources: [extra], artifacts: { ART_A: entry } }), errorCode('KCRP_SOURCE_SCHEMA_INVALID'));
  const missing = structuredClone(spec); delete missing.span;
  assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'closure', route: 'full-required', sources: [missing], artifacts: { ART_A: entry } }), errorCode('KCRP_SOURCE_SCHEMA_INVALID'));
  const changedHeader = Buffer.from(built.packetBytes.toString().replace('\nROLE ', '\nINCLUSION ').replace('\nINCLUSION full\n', '\nROLE full\n'));
  const forged = structuredClone(built.binding); forged.packetByteLength = changedHeader.length; forged.packetSha256 = bytesSha256(changedHeader);
  assert.throws(() => verifyKcrpSourcePacketV1(changedHeader, forged, { purpose: 'closure', route: 'full-required', artifacts: { ART_A: entry }, expectedSources: [spec] }), errorCode('KCRP_SOURCE_SERIALIZATION_INVALID'));
});

test('source order, duplicate identities, reversed spans, overlap, and stale spans fail closed', () => {
  const entry = artifactEntry('ART_A', 'primary', 'design/main.md', Buffer.from('aaaaabbbbbccccc'));
  const artifacts = { ART_A: entry };
  const first = source(entry, { sourceId: 'KCRP_I000001_S000001', byteStart: 0, byteLength: 5 });
  const second = source(entry, { sourceId: 'KCRP_I000002_S000001', byteStart: 5, byteLength: 5 });
  assert.doesNotThrow(() => buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: [first, second], artifacts }));
  assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: [second, first], artifacts }), errorCode('KCRP_SOURCE_ORDER_INVALID'));
  assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: [first, { ...second, sourceId: first.sourceId }], artifacts }), errorCode('KCRP_SOURCE_ORDER_INVALID'));
  const reversed = [first, source(entry, { sourceId: 'KCRP_I000002_S000001', byteStart: 0, byteLength: 4 })];
  assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: reversed, artifacts }), errorCode('KCRP_SOURCE_ORDER_INVALID'));
  const overlap = [first, source(entry, { sourceId: 'KCRP_I000002_S000001', byteStart: 4, byteLength: 5 })];
  assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: overlap, artifacts }), errorCode('KCRP_SOURCE_SPAN_OVERLAP'));
  const stale = structuredClone(first); stale.span.sha256 = '0'.repeat(64);
  assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: [stale], artifacts }), errorCode('KCRP_SOURCE_STALE'));

  const expectedPacket = buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: [first], artifacts });
  const reselected = source(entry, { sourceId: first.sourceId, byteStart: 5, byteLength: 5 });
  const rehashedPacket = buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources: [reselected], artifacts });
  assert.notEqual(rehashedPacket.binding.packetSha256, expectedPacket.binding.packetSha256);
  assert.throws(() => verifyKcrpSourcePacketV1(rehashedPacket.packetBytes, rehashedPacket.binding, {
    purpose: 'remediation', route: 'reduced', artifacts, expectedSources: [first]
  }), errorCode('KCRP_SOURCE_BINDING_INVALID'));
});

test('forged packet, source, record, span, and packet digests never validate', () => {
  const entry = artifactEntry('ART_A', 'primary', 'design/main.md', Buffer.from('alpha\nbravo\n'));
  const artifacts = { ART_A: entry };
  const expected = source(entry, { inclusion: 'full' });
  const built = buildKcrpSourcePacketV1({ purpose: 'closure', route: 'full-required', sources: [expected], artifacts });
  for (const mutate of [
    (copy) => { copy.packetSha256 = '0'.repeat(64); },
    (copy) => { copy.sources[0].sourceSha256 = '0'.repeat(64); },
    (copy) => { copy.sources[0].recordSha256 = '0'.repeat(64); },
    (copy) => { copy.sources[0].span.sha256 = '0'.repeat(64); },
    (copy) => { copy.sources[0].contentByteLength += 1; }
  ]) {
    const forged = structuredClone(built.binding);
    mutate(forged);
    assert.throws(() => verifyKcrpSourcePacketV1(built.packetBytes, forged, { purpose: 'closure', route: 'full-required', artifacts, expectedSources: [expected] }));
  }
  const changedPacket = Buffer.from(built.packetBytes);
  changedPacket[built.binding.sources[0].contentByteStart] ^= 1;
  const fullyRehashed = structuredClone(built.binding);
  fullyRehashed.packetSha256 = bytesSha256(changedPacket);
  fullyRehashed.sources[0].sourceSha256 = bytesSha256(changedPacket.subarray(
    fullyRehashed.sources[0].contentByteStart,
    fullyRehashed.sources[0].contentByteStart + fullyRehashed.sources[0].contentByteLength
  ));
  fullyRehashed.sources[0].recordSha256 = bytesSha256(changedPacket);
  assert.throws(() => verifyKcrpSourcePacketV1(changedPacket, fullyRehashed, { purpose: 'closure', route: 'full-required', artifacts, expectedSources: [expected] }), errorCode('KCRP_SOURCE_BINDING_INVALID'));
});

test('authoritative artifact binding rejects path, role, canonicalization, and byte drift', () => {
  const entry = artifactEntry('ART_A', 'primary', 'design/main.md', Buffer.from('alpha\n'));
  const artifacts = { ART_A: entry };
  for (const mutate of [
    (copy) => { copy.artifact.repositoryRelativePath = 'design/other.md'; },
    (copy) => { copy.artifact.role = 'decision'; },
    (copy) => { copy.artifact.canonicalization = 'other'; }
  ]) {
    const changed = source(entry, { inclusion: 'full' });
    mutate(changed);
    assert.throws(() => buildKcrpSourcePacketV1({ purpose: 'closure', route: 'full-required', sources: [changed], artifacts }), errorCode('KCRP_SOURCE_BINDING_INVALID'));
  }
  const expected = source(entry, { inclusion: 'full' });
  const built = buildKcrpSourcePacketV1({ purpose: 'closure', route: 'full-required', sources: [expected], artifacts });
  const changedArtifacts = { ART_A: { binding: entry.binding, bytes: Buffer.from('Alpha\n') } };
  assert.throws(() => verifyKcrpSourcePacketV1(built.packetBytes, built.binding, { purpose: 'closure', route: 'full-required', artifacts: changedArtifacts, expectedSources: [expected] }), errorCode('KCRP_ARTIFACT_STALE'));
});

test('M1 canonicalizes each referenced artifact once, orders before content work, and seals aliases', () => {
  const artifactBytes = new Uint8Array(Buffer.from('aaaaabbbbbccccc'));
  const entry = artifactEntry('ART_A', 'primary', 'design/repeated.md', artifactBytes);
  const artifacts = { ART_A: entry };
  const sources = [
    source(entry, { sourceId: 'KCRP_I000001_S000001', byteStart: 0, byteLength: 5 }),
    source(entry, { sourceId: 'KCRP_I000002_S000001', byteStart: 5, byteLength: 5 })
  ];
  const originalFrom = Buffer.from;
  let artifactConversions = 0;
  Buffer.from = (value, ...rest) => {
    if (value === artifactBytes) artifactConversions += 1;
    return originalFrom(value, ...rest);
  };
  let built;
  try {
    built = buildKcrpSourcePacketV1({ purpose: 'remediation', route: 'reduced', sources, artifacts });
  } finally { Buffer.from = originalFrom; }
  assert.equal(artifactConversions, 1);

  artifactConversions = 0;
  Buffer.from = (value, ...rest) => {
    if (value === artifactBytes) artifactConversions += 1;
    return originalFrom(value, ...rest);
  };
  const callerBinding = structuredClone(built.binding);
  let verified;
  try {
    verified = verifyKcrpSourcePacketV1(built.packetBytes, callerBinding, {
      purpose: 'remediation', route: 'reduced', artifacts, expectedSources: sources
    });
  } finally { Buffer.from = originalFrom; }
  assert.equal(artifactConversions, 1);

  const reversed = [sources[1], sources[0]];
  artifactConversions = 0;
  Buffer.from = (value, ...rest) => {
    if (value === artifactBytes) artifactConversions += 1;
    return originalFrom(value, ...rest);
  };
  try {
    assert.throws(() => buildKcrpSourcePacketV1({
      purpose: 'remediation', route: 'reduced', sources: reversed, artifacts
    }), errorCode('KCRP_SOURCE_ORDER_INVALID'));
    const invalidSchema = [structuredClone(reversed[0]), reversed[1]];
    invalidSchema[0].extra = true;
    assert.throws(() => buildKcrpSourcePacketV1({
      purpose: 'remediation', route: 'reduced', sources: invalidSchema, artifacts
    }), errorCode('KCRP_SOURCE_SCHEMA_INVALID'));
  } finally { Buffer.from = originalFrom; }
  assert.equal(artifactConversions, 0);

  const packetSnapshot = Buffer.from(built.packetBytes);
  const sourceSnapshot = structuredClone(built.binding.sources[0]);
  artifactBytes[0] ^= 1;
  sources[0].artifact.repositoryRelativePath = 'design/mutated.md';
  sources[0].span.byteLength = 1;
  callerBinding.sources[0].artifact.repositoryRelativePath = 'design/caller-mutated.md';
  assert.equal(built.packetBytes.equals(packetSnapshot), true);
  assert.deepEqual(built.binding.sources[0], sourceSnapshot);
  assert.equal(verified.sources[0].artifact.repositoryRelativePath, 'design/repeated.md');
  assert.equal(Object.isFrozen(built.binding.sources[0].artifact), true);
  assert.equal(Object.isFrozen(built.binding.sources[0].span), true);
  assert.equal(Object.isFrozen(verified.sources[0].artifact), true);
  assert.equal(Object.isFrozen(verified.sources[0].span), true);
});

test('M1 rejects over-limit artifact bytes before conversion and accepts the exact admission bound', () => {
  const overBytes = new Uint8Array(KCRP_LIMITS.sourceArtifactBytes + 1).fill(0x61);
  const overEntry = artifactEntry('ART_OVER', 'primary', 'design/over.md', overBytes);
  const overSource = source(overEntry, { sourceId: 'KCRP_I000001_S000001', byteLength: 1 });
  const exactBytes = new Uint8Array(KCRP_LIMITS.sourceArtifactBytes).fill(0x61);
  const exactEntry = artifactEntry('ART_EXACT', 'primary', 'design/exact.md', exactBytes);
  const exactSource = source(exactEntry, { sourceId: 'KCRP_I000001_S000001', byteLength: 1 });
  const originalFrom = Buffer.from;
  let overConversions = 0;
  let exactConversions = 0;
  Buffer.from = (value, ...rest) => {
    if (value === overBytes) overConversions += 1;
    if (value === exactBytes) exactConversions += 1;
    return originalFrom(value, ...rest);
  };
  try {
    assert.throws(() => buildKcrpSourcePacketV1({
      purpose: 'closure', route: 'full-required', sources: [overSource], artifacts: { ART_OVER: overEntry }
    }), errorCode('KCRP_ARTIFACT_BYTES_INVALID'));
    assert.doesNotThrow(() => buildKcrpSourcePacketV1({
      purpose: 'closure', route: 'full-required', sources: [exactSource], artifacts: { ART_EXACT: exactEntry }
    }));
  } finally { Buffer.from = originalFrom; }
  assert.equal(overConversions, 0);
  assert.equal(exactConversions, 1);
});

test('one source record accepts exact maximum and route-specific max+1 preserves fallback semantics', () => {
  const templateEntry = artifactEntry('ART_A', 'primary', 'design/large.md', Buffer.from('a'));
  const template = source(templateEntry, { inclusion: 'full' });
  let contentLength = KCRP_LIMITS.sourceRecordBytes;
  while (recordLength(template, contentLength) > KCRP_LIMITS.sourceRecordBytes) contentLength -= 1;
  assert.equal(recordLength(template, contentLength), KCRP_LIMITS.sourceRecordBytes);

  const exactBytes = Buffer.alloc(contentLength, 0x61);
  const exactEntry = artifactEntry('ART_A', 'primary', 'design/large.md', exactBytes);
  const exact = source(exactEntry, { inclusion: 'full' });
  const built = buildKcrpSourcePacketV1({ purpose: 'closure', route: 'full-required', sources: [exact], artifacts: { ART_A: exactEntry } });
  assert.equal(built.binding.sources[0].recordByteLength, KCRP_LIMITS.sourceRecordBytes);
  assert.equal(built.binding.packetByteLength, KCRP_LIMITS.sourceRecordBytes);
  assert.doesNotThrow(() => verifyKcrpSourcePacketV1(built.packetBytes, built.binding, { purpose: 'closure', route: 'full-required', artifacts: { ART_A: exactEntry }, expectedSources: [exact] }));

  const overBytes = Buffer.alloc(contentLength + 1, 0x61);
  const overEntry = artifactEntry('ART_A', 'primary', 'design/large.md', overBytes);
  const over = source(overEntry, { inclusion: 'full' });
  for (const state of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_SOURCE_RECORD_TOO_LARGE', fallback: true },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_SOURCE_RECORD_TOO_LARGE', fallback: false },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorReductionFailure, code: 'KCRP_FULL_SOURCE_RECORD_TOO_LARGE', fallback: false }
  ]) assert.throws(() => buildKcrpSourcePacketV1({ ...state, sources: [over], artifacts: { ART_A: overEntry } }), (error) => error.code === state.code
    && error.fallbackAllowed === state.fallback
    && (state.route !== 'full-fallback' || error.reductionFailure === priorReductionFailure));

  const raw = rawRecord(over, overBytes);
  const sourceBinding = {
    ...over, recordByteStart: 0, recordByteLength: raw.bytes.length,
    contentByteStart: raw.contentByteStart, contentByteLength: overBytes.length,
    sourceSha256: bytesSha256(overBytes), recordSha256: bytesSha256(raw.bytes)
  };
  const packetBinding = {
    packetCanonicalizationVersion: 'kstack-packet-utf8-lf-v1',
    packetSerializationVersion: 'kstack-source-record-v1', packetFramingVersion: 'kstack-frame-token-v1',
    packetByteLength: raw.bytes.length, packetSha256: bytesSha256(raw.bytes), sources: [sourceBinding]
  };
  for (const state of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_TOO_LARGE' },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_TOO_LARGE' },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorReductionFailure, code: 'KCRP_FULL_TOO_LARGE' }
  ]) assert.throws(() => verifyKcrpSourcePacketV1(raw.bytes, packetBinding, { ...state, artifacts: { ART_A: overEntry }, expectedSources: [over] }), (error) => error.code === state.code);

  const malformedTail = Buffer.concat([built.packetBytes, Buffer.from('x')]);
  const fullyRehashedTailBinding = structuredClone(built.binding);
  fullyRehashedTailBinding.packetByteLength = malformedTail.length;
  fullyRehashedTailBinding.packetSha256 = bytesSha256(malformedTail);
  for (const state of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_TOO_LARGE', fallback: true },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_TOO_LARGE', fallback: false },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorReductionFailure, code: 'KCRP_FULL_TOO_LARGE', fallback: false }
  ]) assert.throws(() => verifyKcrpSourcePacketV1(malformedTail, fullyRehashedTailBinding, {
    ...state, artifacts: { ART_A: exactEntry }, expectedSources: [exact]
  }), (error) => error.code === state.code
    && error.fallbackAllowed === state.fallback
    && (state.route !== 'full-fallback' || error.reductionFailure === priorReductionFailure));
});

test('SR1 rejects framed record and remaining packet overflow before forbidden concat', () => {
  const templateEntry = artifactEntry('ART_A', 'primary', 'design/large.md', Buffer.from('a'));
  const template = source(templateEntry, { inclusion: 'full' });
  let maximumContent = KCRP_LIMITS.sourceRecordBytes;
  while (recordLength(template, maximumContent) > KCRP_LIMITS.sourceRecordBytes) maximumContent -= 1;
  const overBytes = Buffer.alloc(maximumContent + 1, 0x61);
  const overEntry = artifactEntry('ART_A', 'primary', 'design/large.md', overBytes);
  const over = source(overEntry, { inclusion: 'full' });

  const originalConcat = Buffer.concat;
  let concatCalls = 0;
  Buffer.concat = (...args) => { concatCalls += 1; return originalConcat(...args); };
  try {
    assert.throws(() => buildKcrpSourcePacketV1({
      purpose: 'remediation', route: 'reduced', sources: [over], artifacts: { ART_A: overEntry }
    }), errorCode('KCRP_REDUCED_SOURCE_RECORD_TOO_LARGE'));
  } finally { Buffer.concat = originalConcat; }
  assert.equal(concatCalls, 0);

  const leftEntry = artifactEntry('ART_A', 'primary', 'design/a.md', Buffer.alloc(600_000, 0x61));
  const rightEntry = artifactEntry('ART_B', 'decision', 'design/b.md', Buffer.alloc(600_000, 0x62));
  const sources = [
    source(leftEntry, { sourceId: 'KCRP_I000001_S000001', inclusion: 'full' }),
    source(rightEntry, { sourceId: 'KCRP_I000002_S000001', inclusion: 'full' })
  ];
  const artifacts = { ART_A: leftEntry, ART_B: rightEntry };
  concatCalls = 0;
  Buffer.concat = (...args) => { concatCalls += 1; return originalConcat(...args); };
  try {
    assert.throws(() => buildKcrpSourcePacketV1({
      purpose: 'remediation', route: 'reduced', sources, artifacts
    }), errorCode('KCRP_REDUCED_TOO_LARGE'));
  } finally { Buffer.concat = originalConcat; }
  assert.equal(concatCalls, 2);

  for (const state of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_TOO_LARGE' },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_TOO_LARGE' },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorReductionFailure, code: 'KCRP_FULL_TOO_LARGE' }
  ]) assert.throws(() => buildKcrpSourcePacketV1({ ...state, sources, artifacts }), (error) => error.code === state.code);
});

test('SR1 bounded verify classifies max+1 packet before conversion, digest, or syntax', () => {
  const oversized = new Uint8Array(KCRP_LIMITS.packetBytes + 1);
  const originalFrom = Buffer.from;
  let convertedOversizedInput = false;
  Buffer.from = (value, ...rest) => {
    if (value === oversized) convertedOversizedInput = true;
    return originalFrom(value, ...rest);
  };
  try {
    for (const state of [
      { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_TOO_LARGE', fallback: true },
      { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_TOO_LARGE', fallback: false },
      { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorReductionFailure, code: 'KCRP_FULL_TOO_LARGE', fallback: false }
    ]) assert.throws(() => verifyKcrpSourcePacketV1(oversized, {}, state), (error) => error.code === state.code
      && error.fallbackAllowed === state.fallback
      && (state.route !== 'full-fallback' || error.reductionFailure === priorReductionFailure));
  } finally { Buffer.from = originalFrom; }
  assert.equal(convertedOversizedInput, false);
});

test('SR1-R2-1 caps UTF-8 string evidence and preserves exact boundary and surrogate encoding', () => {
  const originalEncodeInto = TextEncoder.prototype.encodeInto;
  const originalFrom = Buffer.from;
  const observations = [];
  let oversizedStringConverted = false;
  TextEncoder.prototype.encodeInto = function (source, destination) {
    const result = originalEncodeInto.call(this, source, destination);
    observations.push({ sourceLength: source.length, destinationLength: destination.length, ...result });
    return result;
  };

  const oversizedCases = [
    'x'.repeat(KCRP_LIMITS.packetBytes + 4096),
    '€'.repeat(KCRP_LIMITS.packetBytes),
    '\ud800'.repeat(KCRP_LIMITS.packetBytes)
  ];
  Buffer.from = (value, ...rest) => {
    if (typeof value === 'string' && value.length >= KCRP_LIMITS.packetBytes) oversizedStringConverted = true;
    return originalFrom(value, ...rest);
  };
  try {
    for (const packet of oversizedCases) assert.throws(() => verifyKcrpSourcePacketV1(packet, {}, {
      purpose: 'remediation', route: 'reduced', reductionFailure: null
    }), (error) => error.code === 'KCRP_REDUCED_TOO_LARGE' && error.fallbackAllowed === true);
  } finally {
    TextEncoder.prototype.encodeInto = originalEncodeInto;
    Buffer.from = originalFrom;
  }
  assert.equal(oversizedStringConverted, false);
  assert.equal(observations.length, oversizedCases.length);
  for (const observation of observations) {
    assert.ok(observation.destinationLength <= KCRP_LIMITS.packetBytes + 1);
    assert.ok(observation.written <= KCRP_LIMITS.packetBytes + 1);
    assert.ok(observation.read < observation.sourceLength || observation.written === KCRP_LIMITS.packetBytes + 1);
  }

  const templateEntry = artifactEntry('ART_A', 'primary', 'design/string-boundary.md', Buffer.from('a'));
  const template = source(templateEntry, { inclusion: 'full' });
  let contentLength = KCRP_LIMITS.packetBytes;
  while (recordLength(template, contentLength) > KCRP_LIMITS.packetBytes) contentLength -= 1;
  const exactEntry = artifactEntry('ART_A', 'primary', 'design/string-boundary.md', Buffer.alloc(contentLength, 0x61));
  const exact = source(exactEntry, { inclusion: 'full' });
  const built = buildKcrpSourcePacketV1({
    purpose: 'closure', route: 'full-required', sources: [exact], artifacts: { ART_A: exactEntry }
  });
  const packetString = built.packetBytes.toString('utf8');
  assert.equal(Buffer.byteLength(packetString, 'utf8'), KCRP_LIMITS.packetBytes);
  assert.doesNotThrow(() => verifyKcrpSourcePacketV1(packetString, built.binding, {
    purpose: 'closure', route: 'full-required', artifacts: { ART_A: exactEntry }, expectedSources: [exact]
  }));

  const exactTyped = new Uint8Array(built.packetBytes.buffer, built.packetBytes.byteOffset, built.packetBytes.length);
  const malformedTyped = new Uint8Array(exactTyped);
  malformedTyped[0] ^= 1;
  const malformedBinding = structuredClone(built.binding);
  malformedBinding.packetSha256 = bytesSha256(malformedTyped);
  const typedOriginalFrom = Buffer.from;
  const converted = new Set();
  Buffer.from = (value, ...rest) => {
    if (value === exactTyped || value === malformedTyped) converted.add(value);
    return typedOriginalFrom(value, ...rest);
  };
  try {
    assert.doesNotThrow(() => verifyKcrpSourcePacketV1(exactTyped, built.binding, {
      purpose: 'closure', route: 'full-required', artifacts: { ART_A: exactEntry }, expectedSources: [exact]
    }));
    assert.throws(() => verifyKcrpSourcePacketV1(malformedTyped, malformedBinding, {
      purpose: 'closure', route: 'full-required', artifacts: { ART_A: exactEntry }, expectedSources: [exact]
    }), errorCode('KCRP_SOURCE_SERIALIZATION_INVALID'));
  } finally { Buffer.from = typedOriginalFrom; }
  assert.equal(converted.has(exactTyped), true);
  assert.equal(converted.has(malformedTyped), true);

  const malformedSurrogate = '\ud800';
  assert.equal(Buffer.from(malformedSurrogate, 'utf8').equals(Buffer.from('\ufffd', 'utf8')), true);
  assert.throws(() => verifyKcrpSourcePacketV1(malformedSurrogate, {}, {
    purpose: 'closure', route: 'full-required', reductionFailure: null
  }), errorCode('KCRP_SOURCE_BINDING_INVALID'));
});

test('source count max+1 selects its exact route-specific boundary before record construction', () => {
  const entry = artifactEntry('ART_A', 'primary', 'design/main.md', Buffer.from('a'));
  const oversized = Array(KCRP_LIMITS.sourceRecords + 1).fill(source(entry));
  for (const state of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_SOURCE_COUNT_LIMIT' },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_SOURCE_COUNT_LIMIT' },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorReductionFailure, code: 'KCRP_FULL_SOURCE_COUNT_LIMIT' }
  ]) assert.throws(() => buildKcrpSourcePacketV1({ ...state, sources: oversized, artifacts: { ART_A: entry } }), (error) => error.code === state.code);
});
