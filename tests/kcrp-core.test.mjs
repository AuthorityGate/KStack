import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KCRP_CONTROL_JSON_MAX_BYTES, KCRP_JSON_MAX_DEPTH, bytesSha256,
  canonicalJsonBytes, canonicalJsonEncode, parseCanonicalJson
} from '../plugins/kstack/scripts/kstack-kcrp-json.mjs';
import {
  KCRP_LIMITS, KCRP_OFFLINE_BOUNDARIES, buildDeclaredClosure, canonicalizeArtifactBytes,
  frameReviewInputV1, offlineClosureInputEligibleV1, validateItemMap,
  verifyDeclaredClosure, verifyReductionDiagnosticsV1, verifyReviewInputV1
} from '../plugins/kstack/scripts/kstack-kcrp-core.mjs';

function errorCode(code) { return (error) => error?.code === code; }

function binding(artifactId, role, repositoryRelativePath, bytes) {
  const canonical = canonicalizeArtifactBytes(bytes);
  return {
    artifactId, role, repositoryRelativePath, canonicalization: 'kstack-utf8-lf-v1',
    byteLength: canonical.length, sha256: bytesSha256(canonical)
  };
}

function span(bytes, byteStart, byteLength) {
  const canonical = canonicalizeArtifactBytes(bytes);
  return { byteStart, byteLength, sha256: bytesSha256(canonical.subarray(byteStart, byteStart + byteLength)) };
}

function item(itemId, artifactId, spans, dependsOn = [], overrides = {}) {
  return {
    itemId, artifactId, spans, dependsOn, risk: 'ordinary', status: 'open',
    reductionEligibility: 'reducible', mechanismGroupId: null, ...overrides
  };
}

function fixture() {
  const artifacts = {
    ART_A: Buffer.from('alpha\nbravo\ncharlie\ndelta\n'),
    ART_B: Buffer.from('one\ntwo\nthree\n')
  };
  const itemMap = {
    schemaVersion: 1, kind: 'kstack-kcrp-item-map-v1', canonicalizationVersion: 'kstack-kcrp-json-v1',
    threadId: 'thread-1', phase: 'design',
    artifactSet: [
      binding('ART_A', 'primary', 'design/main.md', artifacts.ART_A),
      binding('ART_B', 'decision', 'design/prior.md', artifacts.ART_B)
    ],
    items: [
      item('ITEM_A', 'ART_A', [span(artifacts.ART_A, 0, 5)], ['ITEM_B']),
      item('ITEM_B', 'ART_A', [span(artifacts.ART_A, 6, 5)]),
      item('ITEM_C', 'ART_B', [span(artifacts.ART_B, 0, 3)])
    ]
  };
  return { artifacts, itemMap };
}

function exactBoundFixture() {
  const artifactBytes = Buffer.alloc(KCRP_LIMITS.items, 0x61);
  const artifactId = 'ART_BOUND';
  const itemIds = Array.from({ length: KCRP_LIMITS.items }, (_, index) => `ITEM_${String(index).padStart(6, '0')}`);
  const oneByteSha256 = bytesSha256(Buffer.from('a'));
  const items = itemIds.map((itemId, index) => ({
    itemId, artifactId,
    spans: [{ byteStart: index, byteLength: 1, sha256: oneByteSha256 }],
    dependsOn: index === 0 ? itemIds.slice(1, KCRP_LIMITS.dependenciesPerItem + 1) : [],
    risk: 'ordinary', status: 'open', reductionEligibility: 'reducible', mechanismGroupId: null
  }));
  return {
    artifacts: { [artifactId]: artifactBytes }, itemIds,
    itemMap: {
      schemaVersion: 1, kind: 'kstack-kcrp-item-map-v1', canonicalizationVersion: 'kstack-kcrp-json-v1',
      threadId: 'm3-exact-bounds', phase: 'design',
      artifactSet: [binding(artifactId, 'primary', 'design/bounds.md', artifactBytes)], items
    }
  };
}

function rawReviewInput(manifest, { preamble = Buffer.alloc(0), packet = Buffer.alloc(0) } = {}) {
  const manifestBytes = canonicalJsonBytes(manifest);
  return Buffer.concat([
    Buffer.from('KSTACK-KCRP-REVIEW-INPUT-V1\n', 'ascii'),
    Buffer.from(`MANIFEST-SHA256 64\n${bytesSha256(manifestBytes).toUpperCase()}\n`, 'ascii'),
    Buffer.from(`MANIFEST ${manifestBytes.length}\n`, 'ascii'), manifestBytes, Buffer.from('\n', 'ascii'),
    Buffer.from(`PREAMBLE ${preamble.length}\n`, 'ascii'), preamble, Buffer.from('\n', 'ascii'),
    Buffer.from(`PACKET ${packet.length}\n`, 'ascii'), packet, Buffer.from('\n', 'ascii'),
    Buffer.from('END KSTACK-KCRP-REVIEW-INPUT-V1\n', 'ascii')
  ]);
}

test('kstack-kcrp-json-v1 encodes exact UTF-8 key order without normalization', () => {
  const decomposed = 'e\u0301';
  const composed = '\u00e9';
  const encoded = canonicalJsonEncode({ [composed]: 2, z: 3, [decomposed]: 1, control: '\n', quote: '"', slash: '\\' });
  assert.equal(encoded, '{"control":"\\u000a","é":1,"quote":"\\\"","slash":"\\\\","z":3,"é":2}');
  assert.deepEqual(parseCanonicalJson(Buffer.from(encoded)), { control: '\n', [decomposed]: 1, quote: '"', slash: '\\', z: 3, [composed]: 2 });
});

test('canonical parser rejects duplicate keys, invalid UTF-8, alternative escapes, unsafe numbers, whitespace, and key-order drift', () => {
  const rejected = [
    Buffer.from('{"a":1,"a":2}'), Buffer.from('{"a":{"b":1,"b":2}}'),
    Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0xc3, 0x28, 0x7d]),
    Buffer.from('{"a":"\\n"}'), Buffer.from('{"a":"\\/"}'), Buffer.from('{"a":"\\uD83D\\uDE00"}'),
    Buffer.from('{"a":9007199254740992}'), Buffer.from('{"a":-0}'), Buffer.from('{"a":1.0}'),
    Buffer.from('{ "a":1}'), Buffer.from('{"b":1,"a":2}')
  ];
  for (const bytes of rejected) assert.throws(() => parseCanonicalJson(bytes));
  assert.throws(() => canonicalJsonEncode(Number.MAX_SAFE_INTEGER + 1), errorCode('KCRP_JSON_NUMBER_INVALID'));
  assert.throws(() => canonicalJsonEncode(-0), errorCode('KCRP_JSON_NUMBER_INVALID'));
});

test('canonical parser accepts only exact lowercase control escapes and canonical raw scalars', () => {
  assert.deepEqual(parseCanonicalJson(Buffer.from('{"a":"\\u000a","emoji":"😀"}')), { a: '\n', emoji: '😀' });
  assert.throws(() => parseCanonicalJson(Buffer.from('{"a":"\\u000A"}')), errorCode('KCRP_JSON_NONCANONICAL'));
  assert.throws(() => parseCanonicalJson(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), errorCode('KCRP_JSON_BOM_FORBIDDEN'));
});

test('item-map validation permits equal offsets across artifacts and rejects same-artifact overlap', () => {
  const { artifacts, itemMap } = fixture();
  assert.match(validateItemMap(itemMap, { artifacts }).itemMapSha256, /^[0-9a-f]{64}$/);
  const overlap = structuredClone(itemMap);
  overlap.items[1].spans[0] = span(artifacts.ART_A, 4, 4);
  assert.throws(() => validateItemMap(overlap, { artifacts }), errorCode('KCRP_SPAN_OVERLAP'));
  const crossArtifact = structuredClone(itemMap);
  crossArtifact.items[1].artifactId = 'ART_B';
  crossArtifact.items[1].spans = [span(artifacts.ART_B, 4, 3)];
  assert.doesNotThrow(() => validateItemMap(crossArtifact, { artifacts }));
});

test('item-map arrays reject adjacent order swaps and duplicate dependency edges', () => {
  const { artifacts, itemMap } = fixture();
  const itemSwap = structuredClone(itemMap);
  [itemSwap.items[0], itemSwap.items[1]] = [itemSwap.items[1], itemSwap.items[0]];
  assert.throws(() => validateItemMap(itemSwap, { artifacts }), errorCode('KCRP_ITEM_ORDER_INVALID'));
  const artifactSwap = structuredClone(itemMap);
  artifactSwap.artifactSet.reverse();
  assert.throws(() => validateItemMap(artifactSwap, { artifacts }), errorCode('KCRP_ARTIFACT_ORDER_INVALID'));
  const duplicateEdge = structuredClone(itemMap);
  duplicateEdge.items[0].dependsOn = ['ITEM_B', 'ITEM_B'];
  assert.throws(() => validateItemMap(duplicateEdge, { artifacts }), errorCode('KCRP_DEPENDENCY_AMBIGUOUS'));
  const duplicateArtifact = structuredClone(itemMap);
  duplicateArtifact.artifactSet[1].artifactId = 'ART_A';
  assert.throws(() => validateItemMap(duplicateArtifact, { artifacts }), errorCode('KCRP_ARTIFACT_ORDER_INVALID'));
});

test('declared closure is deterministic and independently rejects missing, rejected, and stale dependencies', () => {
  const { artifacts, itemMap } = fixture();
  const claim = buildDeclaredClosure(itemMap, { artifacts, requestedItemIds: ['ITEM_A'] });
  assert.deepEqual(claim.includedItemIds, ['ITEM_A', 'ITEM_B']);
  assert.deepEqual(claim.omittedItemIds, ['ITEM_C']);
  assert.equal(claim.route, 'reduced');
  assert.equal(verifyDeclaredClosure(itemMap, claim, { artifacts, expectedItemMapSha256: claim.itemMapSha256 }), true);

  const missing = structuredClone(itemMap);
  missing.items[0].dependsOn = ['ITEM_D'];
  assert.throws(() => validateItemMap(missing, { artifacts }), errorCode('KCRP_DEPENDENCY_MISSING'));
  const rejected = structuredClone(itemMap);
  rejected.items[1].status = 'rejected';
  assert.throws(() => validateItemMap(rejected, { artifacts }), errorCode('KCRP_DEPENDENCY_REJECTED'));
  assert.throws(() => validateItemMap(itemMap, { artifacts, expectedItemMapSha256: '0'.repeat(64) }), errorCode('KCRP_MAP_STALE'));
  const changedArtifacts = { ...artifacts, ART_A: Buffer.from('Alpha\nbravo\ncharlie\ndelta\n') };
  assert.throws(() => validateItemMap(itemMap, { artifacts: changedArtifacts }), errorCode('KCRP_ARTIFACT_STALE'));
});

test('cycles form exact SCC mechanism groups and reachable entanglement forces nonclosing fallback', () => {
  const { artifacts, itemMap } = fixture();
  const cyclic = structuredClone(itemMap);
  cyclic.items[0].mechanismGroupId = 'MG_AB';
  cyclic.items[1].dependsOn = ['ITEM_A'];
  cyclic.items[1].mechanismGroupId = 'MG_AB';
  cyclic.items[1].reductionEligibility = 'entangled';
  const claim = buildDeclaredClosure(cyclic, { artifacts, requestedItemIds: ['ITEM_A'] });
  assert.deepEqual(claim.components, [
    { memberItemIds: ['ITEM_A', 'ITEM_B'], mechanismGroupId: 'MG_AB' },
    { memberItemIds: ['ITEM_C'], mechanismGroupId: null }
  ]);
  assert.deepEqual(claim.reachableEntangledItemIds, ['ITEM_B']);
  assert.equal(claim.route, 'full-fallback');
  assert.equal(claim.reductionFailure.code, 'KCRP_ENTANGLED_REACHABLE');
  assert.deepEqual(Object.keys(claim.reductionFailure).sort(), ['code', 'evidenceSha256', 'stage']);
  assert.equal(claim.reductionFailure.stage, 'closure');
  assert.equal(claim.reductionFailure.evidenceSha256, bytesSha256(canonicalJsonBytes(claim.diagnosticSet)));
  assert.deepEqual(claim.diagnosticEvidence[0].body.detail, {
    reachableEntangledItemIds: ['ITEM_B'], affectedMechanismGroupIds: ['MG_AB']
  });
  assert.equal(verifyDeclaredClosure(cyclic, claim, { artifacts }), true);

  const splitGroup = structuredClone(cyclic);
  splitGroup.items[1].mechanismGroupId = 'MG_OTHER';
  assert.throws(() => validateItemMap(splitGroup, { artifacts }), errorCode('KCRP_MECHANISM_GROUP_INVALID'));
  const singletonGroup = structuredClone(itemMap);
  singletonGroup.items[2].mechanismGroupId = 'MG_C';
  assert.throws(() => validateItemMap(singletonGroup, { artifacts }), errorCode('KCRP_MECHANISM_GROUP_INVALID'));
});

test('independent verifier detects closure, proof, component, and detached digest mutation', () => {
  const { artifacts, itemMap } = fixture();
  const claim = buildDeclaredClosure(itemMap, { artifacts, requestedItemIds: ['ITEM_A'] });
  for (const mutate of [
    (copy) => { copy.includedItemIds = ['ITEM_A']; },
    (copy) => { copy.omittedItemIds = ['ITEM_B', 'ITEM_C']; },
    (copy) => { copy.closureProof[0].dependsOn = []; },
    (copy) => { copy.components.reverse(); },
    (copy) => { copy.itemMapSha256 = '0'.repeat(64); }
  ]) {
    const changed = structuredClone(claim);
    mutate(changed);
    assert.throws(() => verifyDeclaredClosure(itemMap, changed, { artifacts }), errorCode('KCRP_CLOSURE_PROOF_INVALID'));
  }
});

test('review-input framing reconstructs exact canonical manifest and detects length, body, digest, and whole-input mutation', () => {
  const manifest = { schemaVersion: 1, kind: 'offline-test-only', includedItemIds: ['ITEM_A'] };
  const framingState = { purpose: 'remediation', route: 'reduced', reductionFailure: null };
  const framed = frameReviewInputV1({ ...framingState, manifest, preamble: 'rules', packet: 'evidence' });
  assert.equal(framed.dispatchEligible, false);
  assert.equal(framed.implementationBoundary, 'OFFLINE_SUBSET_ONLY');
  const verified = verifyReviewInputV1(framed.reviewInput, { ...framingState, expectedReviewInputSha256: framed.reviewInputSha256 });
  assert.deepEqual(verified.manifest, manifest);
  assert.equal(verified.preambleBytes.toString(), 'rules');
  assert.equal(verified.packetBytes.toString(), 'evidence');

  const badDigest = Buffer.from(framed.reviewInput);
  const digestOffset = badDigest.indexOf(Buffer.from(framed.manifestSha256.toUpperCase()));
  badDigest[digestOffset] = badDigest[digestOffset] === 0x30 ? 0x31 : 0x30;
  assert.throws(() => verifyReviewInputV1(badDigest, framingState), errorCode('KCRP_MANIFEST_DIGEST_MISMATCH'));
  const badBody = Buffer.from(framed.reviewInput);
  const bodyOffset = badBody.indexOf(framed.manifestBytes);
  badBody[bodyOffset + 2] ^= 1;
  assert.throws(() => verifyReviewInputV1(badBody, framingState));
  const badLength = Buffer.from(framed.reviewInput.toString().replace(`MANIFEST ${framed.manifestBytes.length}\n`, `MANIFEST ${framed.manifestBytes.length + 1}\n`));
  assert.throws(() => verifyReviewInputV1(badLength, framingState), errorCode('KCRP_REVIEW_INPUT_INVALID'));
  const nonAsciiHeader = Buffer.from(framed.reviewInput);
  nonAsciiHeader[0] |= 0x80;
  assert.throws(() => verifyReviewInputV1(nonAsciiHeader, framingState), errorCode('KCRP_REVIEW_INPUT_INVALID'));
  assert.throws(() => verifyReviewInputV1(framed.reviewInput, { ...framingState, expectedReviewInputSha256: 'f'.repeat(64) }), errorCode('KCRP_REVIEW_INPUT_STALE'));
});

test('purpose and route validation accepts every frozen full purpose and rejects unsafe cross-field combinations', () => {
  const manifest = { kind: 'offline-test-only', schemaVersion: 1 };
  for (const purpose of ['initial', 'clarification', 'closure', 'readiness', 'user-full']) {
    const framed = frameReviewInputV1({ purpose, route: 'full-required', manifest });
    assert.doesNotThrow(() => verifyReviewInputV1(framed.reviewInput, { purpose, route: 'full-required' }));
  }
  for (const row of [
    { purpose: 'closure', route: 'reduced', reductionFailure: null },
    { purpose: 'closure', route: 'full-fallback', reductionFailure: { code: 'KCRP_MAP_STALE', stage: 'map', evidenceSha256: 'a'.repeat(64) } },
    { purpose: 'remediation', route: 'full-required', reductionFailure: null },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: null }
  ]) assert.throws(() => frameReviewInputV1({ ...row, manifest }), errorCode('KCRP_PURPOSE_ROUTE_INVALID'));
});

test('only closure/full-required with complete fresh evidence is eligible in the offline predicate subset', () => {
  const eligible = {
    purpose: 'closure', route: 'full-required', reductionFailure: null, block: null,
    requestedItemIds: [], includedItemIds: ['ITEM_A', 'ITEM_B'], omittedItemIds: [],
    currentItemIds: ['ITEM_A', 'ITEM_B'], completeRootCoverage: true,
    bindingsFreshAndReconstructible: true, scanStatus: 'pass', runnerOutcome: 'complete',
    responseReceiptExact: true, invocationCurrent: true, invocationUnconsumed: true
  };
  assert.equal(offlineClosureInputEligibleV1(eligible), true);
  for (const mutation of [
    { route: 'reduced' }, { route: 'full-fallback' }, { purpose: 'remediation' },
    { omittedItemIds: ['ITEM_B'], includedItemIds: ['ITEM_A'] },
    { completeRootCoverage: false }, { bindingsFreshAndReconstructible: false },
    { scanStatus: 'block' }, { runnerOutcome: 'timeout' }, { responseReceiptExact: false },
    { invocationCurrent: false }, { invocationUnconsumed: false }
  ]) assert.equal(offlineClosureInputEligibleV1({ ...eligible, ...mutation }), false);
});

test('offline tranche exposes its unavailable boundaries and cannot claim dispatch', () => {
  assert.equal(KCRP_OFFLINE_BOUNDARIES.status, 'OFFLINE_SUBSET_ONLY');
  assert.ok(KCRP_OFFLINE_BOUNDARIES.unimplemented.includes('provider-execution'));
  assert.ok(KCRP_OFFLINE_BOUNDARIES.unimplemented.includes('complete-dispatch-manifest-schema'));
  assert.ok(KCRP_OFFLINE_BOUNDARIES.unimplemented.includes('activation'));
});

test('canonical artifact transformation is fatal UTF-8, one leading BOM removal, and LF-only', () => {
  assert.equal(canonicalizeArtifactBytes(Buffer.from('\ufeffa\r\nb\rc')).toString(), 'a\nb\nc');
  assert.throws(() => canonicalizeArtifactBytes(Buffer.from([0xc3, 0x28])), errorCode('KCRP_ARTIFACT_UTF8_INVALID'));
});

test('canonical byte reconstruction and digest are stable under object insertion order', () => {
  const left = canonicalJsonBytes({ z: [3, 2, 1], a: { y: true, x: null } });
  const right = canonicalJsonBytes({ a: { x: null, y: true }, z: [3, 2, 1] });
  assert.equal(left.equals(right), true);
  assert.equal(bytesSha256(left), bytesSha256(right));
});

test('stale map wins the frozen collision precedence while complete diagnostics retain missing dependencies', () => {
  const { artifacts, itemMap } = fixture();
  const collision = structuredClone(itemMap);
  collision.items[0].dependsOn = ['ITEM_D'];
  const result = buildDeclaredClosure(collision, {
    artifacts, expectedItemMapSha256: '0'.repeat(64), requestedItemIds: ['ITEM_A']
  });
  assert.equal(result.route, 'full-fallback');
  assert.deepEqual(Object.keys(result.reductionFailure).sort(), ['code', 'evidenceSha256', 'stage']);
  assert.equal(result.reductionFailure.code, 'KCRP_MAP_STALE');
  assert.equal(result.reductionFailure.stage, 'map');
  assert.equal(result.reductionFailure.evidenceSha256, result.diagnosticSetSha256);
  assert.deepEqual(result.diagnosticSet.diagnostics.map(({ precedenceOrdinal, code }) => [precedenceOrdinal, code]), [
    [2, 'KCRP_MAP_STALE'], [4, 'KCRP_DEPENDENCY_MISSING']
  ]);
  for (const entry of result.diagnosticEvidence) assert.equal(entry.evidenceSha256, bytesSha256(canonicalJsonBytes(entry.body)));
  assert.equal(result.diagnosticSetSha256, bytesSha256(canonicalJsonBytes(result.diagnosticSet)));
  assert.equal(verifyReductionDiagnosticsV1(result), true);
  for (const mutate of [
    (copy) => { copy.diagnosticEvidence[0].body.detail.expectedItemMapSha256 = 'f'.repeat(64); },
    (copy) => { copy.diagnosticSet.diagnostics[0].code = 'KCRP_DEPENDENCY_MISSING'; },
    (copy) => { copy.reductionFailure.evidenceSha256 = 'f'.repeat(64); },
    (copy) => { copy.diagnosticSet.diagnostics.reverse(); }
  ]) {
    const changed = structuredClone(result);
    mutate(changed);
    assert.throws(() => verifyReductionDiagnosticsV1(changed), errorCode('KCRP_DIAGNOSTIC_INVALID'));
  }
});

test('M3 hard bounds stop before attacker-sized maps, filters, dependency traversal, or artifact validation', () => {
  const base = fixture();
  const oversizedItems = structuredClone(base.itemMap);
  oversizedItems.items = Array(KCRP_LIMITS.items + 1).fill(base.itemMap.items[0]);
  const oversizedRequest = Array(KCRP_LIMITS.requestedItems + 1).fill('ITEM_A');
  const oversizedDependencies = structuredClone(base.itemMap);
  oversizedDependencies.items[0].dependsOn = Array(KCRP_LIMITS.dependenciesPerItem + 1).fill('ITEM_B');
  const oversizedMap = structuredClone(base.itemMap);
  oversizedMap.threadId = 'x'.repeat(KCRP_CONTROL_JSON_MAX_BYTES);

  const originalFilter = Array.prototype.filter;
  const originalIterator = Array.prototype[Symbol.iterator];
  let hostileFilterReached = false;
  let dependencyTraversalReached = false;
  let artifactValidationReached = false;
  Array.prototype.filter = function (...args) {
    if (this === oversizedItems.items || this === oversizedRequest || this === oversizedMap.items) hostileFilterReached = true;
    return originalFilter.apply(this, args);
  };
  Array.prototype[Symbol.iterator] = function (...args) {
    if (this === oversizedDependencies.items[0].dependsOn) dependencyTraversalReached = true;
    return originalIterator.apply(this, args);
  };
  const guardedArtifacts = new Proxy({}, {
    ownKeys() { artifactValidationReached = true; throw new Error('M3_FULL_BUILDER_REACHED'); },
    getOwnPropertyDescriptor() { artifactValidationReached = true; throw new Error('M3_FULL_BUILDER_REACHED'); }
  });
  let itemResult;
  let requestResult;
  let dependencyResult;
  let mapResult;
  try {
    itemResult = buildDeclaredClosure(oversizedItems, { artifacts: guardedArtifacts, requestedItemIds: ['ITEM_A'] });
    requestResult = buildDeclaredClosure(base.itemMap, {
      artifacts: guardedArtifacts, expectedItemMapSha256: '0'.repeat(64), requestedItemIds: oversizedRequest
    });
    dependencyResult = buildDeclaredClosure(oversizedDependencies, { artifacts: guardedArtifacts, requestedItemIds: ['ITEM_A'] });
    mapResult = buildDeclaredClosure(oversizedMap, { artifacts: guardedArtifacts, requestedItemIds: oversizedRequest });
  } finally {
    Array.prototype.filter = originalFilter;
    Array.prototype[Symbol.iterator] = originalIterator;
  }

  assert.equal(hostileFilterReached, false);
  assert.equal(dependencyTraversalReached, false);
  assert.equal(artifactValidationReached, false);
  assert.equal(itemResult.reductionFailure.code, 'KCRP_ITEM_COUNT_LIMIT');
  assert.deepEqual(itemResult.diagnosticSet.diagnostics.map((entry) => entry.code), ['KCRP_ITEM_COUNT_LIMIT']);
  assert.equal(requestResult.reductionFailure.code, 'KCRP_MAP_STALE');
  assert.deepEqual(requestResult.diagnosticSet.diagnostics.map((entry) => entry.code), [
    'KCRP_MAP_STALE', 'KCRP_CLOSURE_COUNT_LIMIT'
  ]);
  assert.deepEqual(requestResult.requestedItemIds, []);
  assert.equal(dependencyResult.reductionFailure.code, 'KCRP_DEPENDENCY_COUNT_LIMIT');
  assert.deepEqual(dependencyResult.diagnosticEvidence[0].body.detail, {
    observedCode: 'KCRP_DEPENDENCY_COUNT_LIMIT', itemId: 'ITEM_A',
    dependencyCount: KCRP_LIMITS.dependenciesPerItem + 1, maximum: KCRP_LIMITS.dependenciesPerItem
  });
  assert.ok(canonicalJsonBytes(dependencyResult.diagnosticSet).length < 1024);
  assert.equal(mapResult.reductionFailure.code, 'KCRP_MAP_TOO_LARGE');
  assert.deepEqual(mapResult.diagnosticSet.diagnostics.map((entry) => entry.code), ['KCRP_MAP_TOO_LARGE']);
  assert.deepEqual(mapResult.requestedItemIds, []);
  for (const result of [itemResult, requestResult, dependencyResult, mapResult]) {
    assert.equal(result.route, 'full-fallback');
    assert.equal(verifyReductionDiagnosticsV1(result), true);
  }
  assert.equal(KCRP_OFFLINE_BOUNDARIES.status, 'OFFLINE_SUBSET_ONLY');
  assert.ok(KCRP_OFFLINE_BOUNDARIES.unimplemented.includes('provider-execution'));
});

test('M3 dependency-count overflow keeps its exact public code behind stale-map precedence', () => {
  const { artifacts, itemMap } = fixture();
  itemMap.items[0].dependsOn = Array(KCRP_LIMITS.dependenciesPerItem + 1).fill('ITEM_B');
  assert.throws(() => validateItemMap(itemMap, { artifacts }), errorCode('KCRP_DEPENDENCY_COUNT_LIMIT'));
  const result = buildDeclaredClosure(itemMap, {
    artifacts, expectedItemMapSha256: '0'.repeat(64), requestedItemIds: ['ITEM_A']
  });
  assert.equal(result.reductionFailure.code, 'KCRP_MAP_STALE');
  assert.deepEqual(result.diagnosticSet.diagnostics.map(({ precedenceOrdinal, code }) => [precedenceOrdinal, code]), [
    [2, 'KCRP_MAP_STALE'], [6, 'KCRP_DEPENDENCY_COUNT_LIMIT']
  ]);
  assert.equal(verifyReductionDiagnosticsV1(result), true);
});

test('M3 accepts exact item, dependency, and request bounds without fallback', () => {
  const { artifacts, itemIds, itemMap } = exactBoundFixture();
  const validated = validateItemMap(itemMap, { artifacts });
  assert.equal(validated.itemsById.size, KCRP_LIMITS.items);
  assert.equal(validated.itemsById.get(itemIds[0]).dependsOn.length, KCRP_LIMITS.dependenciesPerItem);
  const requestedItemIds = itemIds.slice(0, KCRP_LIMITS.requestedItems);
  const result = buildDeclaredClosure(itemMap, { artifacts, requestedItemIds });
  assert.equal(result.route, 'reduced');
  assert.equal(result.reductionFailure, null);
  assert.equal(result.requestedItemIds.length, KCRP_LIMITS.requestedItems);
  assert.ok(result.includedItemIds.length <= KCRP_LIMITS.includedItems);
});

test('M3 caps dependency diagnostic retention while reporting the deterministic total', () => {
  const { artifacts, itemMap } = fixture();
  const missing = Array.from({ length: KCRP_LIMITS.dependenciesPerItem }, (_, index) => `MISSING_${String(index).padStart(6, '0')}`);
  itemMap.items[0].dependsOn = missing;
  itemMap.items[1].dependsOn = missing;
  const result = buildDeclaredClosure(itemMap, { artifacts, requestedItemIds: ['ITEM_A'] });
  assert.equal(result.reductionFailure.code, 'KCRP_DEPENDENCY_MISSING');
  const detail = result.diagnosticEvidence.find((entry) => entry.body.code === 'KCRP_DEPENDENCY_MISSING').body.detail;
  assert.equal(detail.missingDependencyEdges.length, KCRP_LIMITS.dependenciesPerItem);
  assert.equal(detail.totalMissingDependencyEdgeCount, KCRP_LIMITS.dependenciesPerItem * 2);
  assert.ok(canonicalJsonBytes(detail).length < KCRP_CONTROL_JSON_MAX_BYTES);
  assert.equal(verifyReductionDiagnosticsV1(result), true);
});

test('M3 retains only 256 deterministic ambiguous item ids and reports the exact total', () => {
  const itemCount = KCRP_LIMITS.dependenciesPerItem + 44;
  const artifactId = 'ART_AMBIGUOUS';
  const artifactBytes = Buffer.alloc(itemCount, 0x61);
  const oneByteSha256 = bytesSha256(Buffer.from('a'));
  const itemIds = Array.from({ length: itemCount }, (_, index) => `ITEM_${String(index).padStart(6, '0')}`);
  const itemMap = {
    schemaVersion: 1, kind: 'kstack-kcrp-item-map-v1', canonicalizationVersion: 'kstack-kcrp-json-v1',
    threadId: 'm3-ambiguous-retention', phase: 'design',
    artifactSet: [binding(artifactId, 'primary', 'design/ambiguous.md', artifactBytes)],
    items: itemIds.map((itemId, index) => ({
      itemId, artifactId, spans: [{ byteStart: index, byteLength: 1, sha256: oneByteSha256 }],
      dependsOn: [itemId], risk: 'ordinary', status: 'open', reductionEligibility: 'reducible', mechanismGroupId: null
    }))
  };
  const result = buildDeclaredClosure(itemMap, {
    artifacts: { [artifactId]: artifactBytes }, requestedItemIds: [itemIds[0]]
  });
  assert.equal(result.reductionFailure.code, 'KCRP_DEPENDENCY_AMBIGUOUS');
  const detail = result.diagnosticEvidence.find((entry) => entry.body.code === 'KCRP_DEPENDENCY_AMBIGUOUS').body.detail;
  assert.deepEqual(detail.ambiguousDependencyItemIds, itemIds.slice(0, KCRP_LIMITS.dependenciesPerItem));
  assert.equal(detail.ambiguousDependencyItemIds.length, KCRP_LIMITS.dependenciesPerItem);
  assert.equal(detail.totalAmbiguousDependencyItemCount, itemCount);
  assert.equal(verifyReductionDiagnosticsV1(result), true);
});

test('route-specific packet overflow permits one reduced fallback and terminally blocks both full routes', () => {
  const manifest = { kind: 'offline-test-only', schemaVersion: 1 };
  const oversizedPacket = Buffer.alloc(KCRP_LIMITS.packetBytes + 1, 0x61);
  let reduced;
  assert.throws(() => frameReviewInputV1({ purpose: 'remediation', route: 'reduced', manifest, packet: oversizedPacket }), (error) => {
    reduced = error;
    return error.code === 'KCRP_REDUCED_TOO_LARGE';
  });
  assert.equal(reduced.fallbackAllowed, true);
  assert.equal(reduced.nextRoute, 'full-fallback');
  assert.equal(reduced.block, null);
  assert.deepEqual(Object.keys(reduced.reductionFailure).sort(), ['code', 'evidenceSha256', 'stage']);

  let closure;
  assert.throws(() => frameReviewInputV1({ purpose: 'closure', route: 'full-required', manifest, packet: oversizedPacket }), (error) => {
    closure = error;
    return error.code === 'KCRP_FULL_TOO_LARGE';
  });
  assert.equal(closure.fallbackAllowed, false);
  assert.equal(closure.nextRoute, null);
  assert.equal(closure.reductionFailure, null);
  assert.deepEqual(closure.block, { code: 'KCRP_FULL_TOO_LARGE', stage: 'size', evidenceSha256: closure.diagnosticSetSha256 });

  let fallback;
  assert.throws(() => frameReviewInputV1({ purpose: 'remediation', route: 'full-fallback', reductionFailure: reduced.reductionFailure, manifest, packet: oversizedPacket }), (error) => {
    fallback = error;
    return error.code === 'KCRP_FULL_TOO_LARGE';
  });
  assert.equal(fallback.fallbackAllowed, false);
  assert.deepEqual(fallback.reductionFailure, reduced.reductionFailure);
  assert.deepEqual(fallback.block, { code: 'KCRP_FULL_TOO_LARGE', stage: 'size', evidenceSha256: fallback.diagnosticSetSha256 });

  const raw = rawReviewInput(manifest, { packet: oversizedPacket });
  assert.ok(raw.length <= KCRP_LIMITS.reviewInputBytes);
  for (const row of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_TOO_LARGE' },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_TOO_LARGE' },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: reduced.reductionFailure, code: 'KCRP_FULL_TOO_LARGE' }
  ]) assert.throws(() => verifyReviewInputV1(raw, row), (error) => error.code === row.code);
});

test('manifest and exact-input overflow use their frozen reduced/full codes without recursive fallback', () => {
  const hugeManifest = { value: 'a'.repeat(KCRP_CONTROL_JSON_MAX_BYTES) };
  const priorFailure = { code: 'KCRP_MAP_STALE', stage: 'map', evidenceSha256: 'a'.repeat(64) };
  for (const row of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_MANIFEST_TOO_LARGE', fallback: true },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_MANIFEST_TOO_LARGE', fallback: false },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorFailure, code: 'KCRP_FULL_MANIFEST_TOO_LARGE', fallback: false }
  ]) assert.throws(() => frameReviewInputV1({ ...row, manifest: hugeManifest }), (error) => error.code === row.code
    && error.fallbackAllowed === row.fallback
    && (row.route !== 'full-fallback' || error.reductionFailure === priorFailure));

  const smallManifest = { kind: 'offline-test-only', schemaVersion: 1 };
  const base = frameReviewInputV1({ purpose: 'closure', route: 'full-required', manifest: smallManifest });
  let preambleLength = KCRP_LIMITS.reviewInputBytes - base.reviewInputByteLength;
  for (let attempt = 0; attempt < 3; attempt += 1) preambleLength = KCRP_LIMITS.reviewInputBytes - base.reviewInputByteLength - (String(preambleLength).length - 1);
  const preambleAtMaximum = Buffer.alloc(preambleLength, 0x61);
  const exact = frameReviewInputV1({ purpose: 'closure', route: 'full-required', manifest: smallManifest, preamble: preambleAtMaximum });
  assert.equal(exact.reviewInputByteLength, KCRP_LIMITS.reviewInputBytes);
  assert.doesNotThrow(() => verifyReviewInputV1(exact.reviewInput, { purpose: 'closure', route: 'full-required' }));
  const oneOver = Buffer.concat([preambleAtMaximum, Buffer.from('x')]);
  for (const row of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_TOO_LARGE', fallback: true },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_TOO_LARGE', fallback: false },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorFailure, code: 'KCRP_FULL_TOO_LARGE', fallback: false }
  ]) assert.throws(() => frameReviewInputV1({ ...row, manifest: smallManifest, preamble: oneOver }), (error) => error.code === row.code
    && error.fallbackAllowed === row.fallback
    && (row.route !== 'full-fallback' || error.reductionFailure === priorFailure));

  const oversizedRawInput = Buffer.alloc(KCRP_LIMITS.reviewInputBytes + 1);
  for (const row of [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, code: 'KCRP_REDUCED_TOO_LARGE' },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, code: 'KCRP_FULL_TOO_LARGE' },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: priorFailure, code: 'KCRP_FULL_TOO_LARGE' }
  ]) assert.throws(() => verifyReviewInputV1(oversizedRawInput, row), (error) => error.code === row.code);

  assert.doesNotThrow(() => frameReviewInputV1({
    purpose: 'closure', route: 'full-required', manifest: smallManifest,
    packet: Buffer.alloc(KCRP_LIMITS.packetBytes)
  }));
});

test('control JSON accepts the exact byte maximum, rejects max+1 before decode, and bounds hostile depth', () => {
  const exact = Buffer.from(`"${'a'.repeat(KCRP_CONTROL_JSON_MAX_BYTES - 2)}"`);
  assert.equal(exact.length, KCRP_CONTROL_JSON_MAX_BYTES);
  assert.equal(parseCanonicalJson(exact).length, KCRP_CONTROL_JSON_MAX_BYTES - 2);
  assert.equal(canonicalJsonBytes('a'.repeat(KCRP_CONTROL_JSON_MAX_BYTES - 2)).length, KCRP_CONTROL_JSON_MAX_BYTES);
  const oversized = Buffer.from(`"${'a'.repeat(KCRP_CONTROL_JSON_MAX_BYTES - 1)}"`);
  assert.throws(() => parseCanonicalJson(oversized), (error) => error.code === 'KCRP_JSON_TOO_LARGE' && error.actualBytes === KCRP_CONTROL_JSON_MAX_BYTES + 1);

  let permitted = 0;
  for (let depth = 0; depth < KCRP_JSON_MAX_DEPTH; depth += 1) permitted = [permitted];
  assert.doesNotThrow(() => canonicalJsonBytes(permitted));
  let hostile = permitted;
  hostile = [hostile];
  assert.throws(() => canonicalJsonBytes(hostile), errorCode('KCRP_JSON_DEPTH_LIMIT'));
  const hostileBytes = Buffer.from(`${'['.repeat(KCRP_JSON_MAX_DEPTH + 1)}0${']'.repeat(KCRP_JSON_MAX_DEPTH + 1)}`);
  assert.throws(() => parseCanonicalJson(hostileBytes), errorCode('KCRP_JSON_DEPTH_LIMIT'));
  const cyclic = []; cyclic.push(cyclic);
  assert.throws(() => canonicalJsonBytes(cyclic), errorCode('KCRP_JSON_VALUE_INVALID'));
});

test('M2 rejects oversized control JSON typed arrays before conversion and preserves exact-bound parsing', () => {
  const oversized = new Uint8Array(KCRP_CONTROL_JSON_MAX_BYTES + 1);
  const exactBuffer = Buffer.from(`"${'a'.repeat(KCRP_CONTROL_JSON_MAX_BYTES - 2)}"`);
  const exact = new Uint8Array(exactBuffer.buffer, exactBuffer.byteOffset, exactBuffer.length);
  const malformed = new Uint8Array(KCRP_CONTROL_JSON_MAX_BYTES);
  const originalFrom = Buffer.from;
  const converted = new Set();
  Buffer.from = (value, ...rest) => {
    if (value === oversized || value === exact || value === malformed) converted.add(value);
    return originalFrom(value, ...rest);
  };
  try {
    assert.throws(() => parseCanonicalJson(oversized), (error) => error.code === 'KCRP_JSON_TOO_LARGE'
      && error.actualBytes === KCRP_CONTROL_JSON_MAX_BYTES + 1);
    assert.equal(parseCanonicalJson(exact).length, KCRP_CONTROL_JSON_MAX_BYTES - 2);
    assert.throws(() => parseCanonicalJson(malformed), errorCode('KCRP_JSON_SYNTAX_INVALID'));
  } finally { Buffer.from = originalFrom; }
  assert.equal(converted.has(oversized), false);
  assert.equal(converted.has(exact), true);
  assert.equal(converted.has(malformed), true);
});

test('closed reduction-failure registry rejects invented rehashed codes and stage substitutions', () => {
  const forged = structuredClone(buildDeclaredClosure(null, { artifacts: {}, requestedItemIds: ['ITEM_A'] }));
  const invented = 'KCRP_INVENTED_REDUCTION';
  forged.diagnosticEvidence[0].body.code = invented;
  forged.diagnosticEvidence[0].evidenceSha256 = bytesSha256(canonicalJsonBytes(forged.diagnosticEvidence[0].body));
  forged.diagnosticSet.diagnostics[0].code = invented;
  forged.diagnosticSet.diagnostics[0].evidenceSha256 = forged.diagnosticEvidence[0].evidenceSha256;
  forged.diagnosticSetSha256 = bytesSha256(canonicalJsonBytes(forged.diagnosticSet));
  forged.reductionFailure.code = invented;
  forged.reductionFailure.evidenceSha256 = forged.diagnosticSetSha256;
  assert.throws(() => verifyReductionDiagnosticsV1(forged), errorCode('KCRP_REDUCTION_FAILURE_INVALID'));
  assert.throws(() => frameReviewInputV1({
    purpose: 'remediation', route: 'full-fallback', reductionFailure: forged.reductionFailure,
    manifest: { schemaVersion: 1 }
  }), errorCode('KCRP_REDUCTION_FAILURE_INVALID'));

  const wrongStage = structuredClone(buildDeclaredClosure(null, { artifacts: {}, requestedItemIds: ['ITEM_A'] }));
  wrongStage.reductionFailure.stage = 'closure';
  assert.throws(() => verifyReductionDiagnosticsV1(wrongStage), errorCode('KCRP_REDUCTION_FAILURE_INVALID'));
});

test('validated and rejected requested items produce sealed deterministic fallback', () => {
  for (const status of ['validated', 'rejected']) {
    const { artifacts, itemMap } = fixture();
    itemMap.items[2].status = status;
    const result = buildDeclaredClosure(itemMap, { artifacts, requestedItemIds: ['ITEM_C'] });
    assert.equal(result.route, 'full-fallback');
    assert.equal(result.reductionFailure.code, 'KCRP_DEPENDENCY_AMBIGUOUS');
    assert.equal(result.reductionFailure.stage, 'closure');
    assert.equal(result.reductionFailure.evidenceSha256, result.diagnosticSetSha256);
    assert.equal(verifyReductionDiagnosticsV1(result), true);
    assert.deepEqual(result.diagnosticSet.diagnostics.map((entry) => entry.precedenceOrdinal), [status === 'rejected' ? 5 : 6]);
  }
});

test('encoder and review framing reject before accessing or concatenating oversized output', () => {
  let secondElementRead = false;
  const hostile = ['a'.repeat(KCRP_CONTROL_JSON_MAX_BYTES)];
  Object.defineProperty(hostile, 1, { enumerable: true, get() { secondElementRead = true; throw new Error('UNREACHABLE'); } });
  assert.throws(() => canonicalJsonBytes(hostile), errorCode('KCRP_JSON_TOO_LARGE'));
  assert.equal(secondElementRead, false);

  const originalConcat = Buffer.concat;
  let concatCalls = 0;
  Buffer.concat = (...args) => { concatCalls += 1; return originalConcat(...args); };
  try {
    assert.throws(() => frameReviewInputV1({
      purpose: 'closure', route: 'full-required', manifest: { schemaVersion: 1 },
      preamble: Buffer.alloc(700_000), packet: Buffer.alloc(600_000)
    }), errorCode('KCRP_FULL_TOO_LARGE'));
  } finally { Buffer.concat = originalConcat; }
  assert.equal(concatCalls, 0);
});

test('canonical encoder rejects sparse arrays and extra array properties', () => {
  const sparse = [];
  sparse.length = 1;
  assert.throws(() => canonicalJsonBytes(sparse), errorCode('KCRP_JSON_VALUE_INVALID'));
  const extended = [1];
  extended.extra = 2;
  assert.throws(() => canonicalJsonBytes(extended), errorCode('KCRP_JSON_VALUE_INVALID'));
});
