import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOfflineDispatchManifestV1 } from '../plugins/kstack/scripts/kstack-kcrp-dispatch-manifest.mjs';
import { KCRP_LIMITS } from '../plugins/kstack/scripts/kstack-kcrp-core.mjs';
import { bytesSha256, canonicalJsonBytes } from '../plugins/kstack/scripts/kstack-kcrp-json.mjs';
import {
  KCRP_BYTE_BENCHMARK_BOUNDARY,
  KCRP_BYTE_BENCHMARK_LIMITS,
  KCRP_BYTE_BENCHMARK_PAIR_ERROR_PRECEDENCE,
  runOfflineKcrpByteBenchmarkV1
} from '../plugins/kstack/scripts/kstack-kcrp-byte-benchmark.mjs';

const objectiveSha256 = 'a'.repeat(64);
const reviewerSha256 = 'b'.repeat(64);
const governanceSha256 = 'c'.repeat(64);
const identity = { objectiveSha256, phase: 'design', reviewerSha256, governanceSha256 };
const reductionFailure = { code: 'KCRP_MAP_STALE', stage: 'map', evidenceSha256: 'd'.repeat(64) };

function manifest(route, packetText, suffix) {
  const full = route === 'full-required';
  const built = buildOfflineDispatchManifestV1({
    invocationId: `invocation-${suffix}`,
    threadId: `thread-${suffix}`,
    phase: 'design',
    round: 1,
    purpose: full ? 'initial' : 'remediation',
    route,
    reductionFailure: route === 'full-fallback' ? reductionFailure : null,
    requestedItemIds: [`ITEM_${suffix}`],
    includedItemIds: [`ITEM_${suffix}`],
    omittedItemIds: route === 'reduced' ? [`OMIT_${suffix}`] : [],
    artifacts: [{ artifactId: `ART_${suffix}`, bytes: Buffer.from(`artifact-${suffix}`) }],
    packetBytes: Buffer.from(packetText)
  });
  return {
    ...identity,
    dispatchManifestSha256: built.dispatchManifestSha256,
    manifestBytes: Buffer.from(built.manifestBytes),
    packetSha256: built.manifest.packetSha256,
    packetBytes: Buffer.from(packetText)
  };
}

function pair(pairId, route = 'reduced', fullText = 'FULL-CONTEXT', treatmentText = 'r') {
  return {
    pairId,
    full: manifest('full-required', fullText, `${pairId}_F`),
    treatment: manifest(route, treatmentText, `${pairId}_T`)
  };
}

function input(pairs) {
  return { benchmarkId: 'BENCHMARK-1', ...identity, pairs };
}

function blockedPair(pairId) {
  return {
    pairId,
    full: manifest('full-required', 'FULL-CONTEXT', `${pairId}_F`),
    treatment: { ...identity, status: 'BLOCKED', reason: 'REDUCTION_BLOCKED' }
  };
}

function errorCode(code) {
  return (error) => error?.code === code;
}

function pairFailure(pairs) {
  try { runOfflineKcrpByteBenchmarkV1(input(pairs)); }
  catch (error) {
    return {
      code: error.code,
      evidenceBytes: canonicalJsonBytes(error.evidence),
      evidenceSha256: error.evidenceSha256
    };
  }
  assert.fail('expected pair admission failure');
}

function gcd(left, right) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

test('offline benchmark is deterministic, aggregate-only, and reports exact byte savings', () => {
  const left = pair('PAIR_B', 'reduced', 'F'.repeat(200), 'r');
  const right = pair('PAIR_A', 'reduced', 'F'.repeat(100), 'rr');
  const forward = runOfflineKcrpByteBenchmarkV1(input([left, right]));
  const reverse = runOfflineKcrpByteBenchmarkV1(input([right, left]));
  assert.equal(forward.reportBytes.equals(reverse.reportBytes), true);
  assert.equal(forward.reportSha256, reverse.reportSha256);
  assert.equal(forward.boundary, 'OFFLINE_SUBSET_ONLY');
  assert.equal(forward.report.dispatchAuthority, 'NONE');
  assert.deepEqual(forward.report.providerUsage, {
    U: null, W: null, R: null, P: null,
    closedReason: 'OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT'
  });
  assert.deepEqual(forward.report.providerClaims, {
    tokenSavings: null, costSavings: null, quality: null,
    closedReason: 'OFFLINE_CANONICAL_BYTE_BENCHMARK_ONLY'
  });
  assert.equal(forward.report.providerMeasurementAvailable, false);
  const full = BigInt(forward.report.full.totalBytes);
  const delta = BigInt(forward.report.savings.deltaBytes);
  const divisor = gcd(delta, full);
  assert.deepEqual(forward.report.savings.exactRational, {
    numerator: (delta / divisor).toString(), denominator: (full / divisor).toString()
  });
  const basisDivisor = gcd(delta * 10_000n, full);
  assert.deepEqual(forward.report.savings.basisPoints, {
    numerator: ((delta * 10_000n) / basisDivisor).toString(), denominator: (full / basisDivisor).toString()
  });
  assert.equal(JSON.stringify(forward.report).includes('PAIR_A'), false);
  assert.equal(JSON.stringify(forward.report).includes('FULL-CONTEXT'), false);
  assert.equal(Object.isFrozen(forward.report.providerClaims), true);
  assert.equal(bytesSha256(forward.reportBytes), forward.reportSha256);

  const pairA = pair('PAIR_A_BAD');
  pairA.treatment.governanceSha256 = 'e'.repeat(64);
  const pairZ = pair('PAIR_Z_BAD');
  pairZ.treatment.packetBytes[0] ^= 1;
  for (const order of [[pairA, pairZ], [pairZ, pairA]]) {
    assert.throws(
      () => runOfflineKcrpByteBenchmarkV1(input(order)),
      errorCode('KCRP_BYTE_BENCHMARK_IDENTITY_MISMATCH')
    );
  }
});

test('invalid-pair precedence and evidence are invariant under caller permutations', () => {
  assert.deepEqual(KCRP_BYTE_BENCHMARK_PAIR_ERROR_PRECEDENCE, [
    'PAIR_ID_MISSING',
    'PAIR_ID_DESCRIPTOR_INVALID',
    'PAIR_ID_INVALID',
    'PAIR_ENVELOPE_INVALID'
  ]);
  assert.equal(Object.isFrozen(KCRP_BYTE_BENCHMARK_PAIR_ERROR_PRECEDENCE), true);

  const malformed = pair('PAIR_MALFORMED');
  malformed.unexpectedRawField = 'must-not-enter-evidence';
  const invalidId = pair('PAIR_INVALID');
  invalidId.pairId = '?raw-invalid-id';
  const missingId = pair('PAIR_MISSING');
  delete missingId.pairId;
  const orders = [
    [malformed, invalidId, missingId],
    [missingId, malformed, invalidId],
    [invalidId, missingId, malformed]
  ];
  const failures = orders.map(pairFailure);
  for (const failure of failures) {
    assert.equal(failure.code, 'KCRP_BYTE_BENCHMARK_PAIR_ID_MISSING');
    assert.equal(failure.evidenceBytes.equals(failures[0].evidenceBytes), true);
    assert.equal(failure.evidenceSha256, failures[0].evidenceSha256);
    assert.equal(failure.evidenceBytes.includes(Buffer.from('must-not-enter-evidence')), false);
    assert.equal(failure.evidenceBytes.includes(Buffer.from('?raw-invalid-id')), false);
  }

  const invalidFirst = pairFailure([malformed, invalidId]);
  const invalidReversed = pairFailure([invalidId, malformed]);
  assert.equal(invalidFirst.code, 'KCRP_BYTE_BENCHMARK_PAIR_ID_INVALID');
  assert.equal(invalidFirst.evidenceBytes.equals(invalidReversed.evidenceBytes), true);
  assert.equal(invalidFirst.evidenceSha256, invalidReversed.evidenceSha256);

  let getterCalls = 0;
  const descriptorInvalid = pair('PAIR_DESCRIPTOR');
  Object.defineProperty(descriptorInvalid, 'pairId', {
    enumerable: true,
    get() { getterCalls += 1; return 'PAIR_DESCRIPTOR'; }
  });
  const descriptorFailure = pairFailure([malformed, descriptorInvalid]);
  assert.equal(descriptorFailure.code, 'KCRP_BYTE_BENCHMARK_PAIR_ID_INVALID');
  assert.equal(JSON.parse(descriptorFailure.evidenceBytes).diagnosticClass, 'PAIR_ID_DESCRIPTOR_INVALID');
  assert.equal(getterCalls, 0);
});

test('full fallback is intention-to-treat, blocked is unavailable, and no reduction is explicit', () => {
  const fallback = runOfflineKcrpByteBenchmarkV1(input([pair('PAIR_F', 'full-fallback', 'same', 'same')]));
  assert.equal(fallback.report.status, 'MEASURED_WITH_FULL_FALLBACK');
  assert.equal(fallback.report.outcomeCounts.fullFallback, 1);
  assert.ok(['FULL_FALLBACK_INCLUDED', 'NO_REDUCTION'].includes(fallback.report.reason));

  const blocked = runOfflineKcrpByteBenchmarkV1(input([blockedPair('PAIR_B')]));
  assert.equal(blocked.report.status, 'UNAVAILABLE');
  assert.equal(blocked.report.reason, 'BLOCKED_PAIR_PRESENT');
  assert.equal(blocked.report.treatment, null);
  assert.equal(blocked.report.savings, null);

  const noReduction = runOfflineKcrpByteBenchmarkV1(input([
    pair('PAIR_N', 'reduced', 'x', 'TREATMENT-IS-LONGER-THAN-FULL')
  ]));
  assert.equal(noReduction.report.reason, 'NO_REDUCTION');
  assert.ok(noReduction.report.savings.deltaBytes <= 0);
});

test('objective, phase, reviewer, and governance identities must match', () => {
  for (const key of ['objectiveSha256', 'phase', 'reviewerSha256', 'governanceSha256']) {
    const candidate = input([pair(`PAIR_${key.toUpperCase()}`)]);
    candidate.pairs[0].treatment[key] = key === 'phase' ? 'qc' : 'e'.repeat(64);
    assert.throws(() => runOfflineKcrpByteBenchmarkV1(candidate), errorCode('KCRP_BYTE_BENCHMARK_IDENTITY_MISMATCH'));
  }
});

test('manifest and packet tamper, wrong routes, duplicate pairing, and overlapping aliases fail closed', () => {
  const manifestTamper = input([pair('PAIR_MT')]);
  manifestTamper.pairs[0].treatment.manifestBytes[0] ^= 1;
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(manifestTamper), errorCode('KCRP_BYTE_BENCHMARK_MANIFEST_STALE'));

  const packetTamper = input([pair('PAIR_PT')]);
  packetTamper.pairs[0].treatment.packetBytes[0] ^= 1;
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(packetTamper), errorCode('KCRP_BYTE_BENCHMARK_PACKET_STALE'));

  const wrongFull = pair('PAIR_WF');
  wrongFull.full = manifest('reduced', 'r', 'PAIR_WF_WRONG');
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(input([wrongFull])), errorCode('KCRP_BYTE_BENCHMARK_ROUTE_INVALID'));
  const wrongTreatment = pair('PAIR_WT');
  wrongTreatment.treatment = manifest('full-required', 'full', 'PAIR_WT_WRONG');
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(input([wrongTreatment])), errorCode('KCRP_BYTE_BENCHMARK_ROUTE_INVALID'));

  const duplicate = pair('PAIR_DUP');
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([duplicate, pair('PAIR_DUP')])),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_ID_INVALID')
  );

  const aliased = pair('PAIR_ALIAS');
  aliased.treatment.packetBytes = aliased.full.packetBytes;
  aliased.treatment.packetSha256 = aliased.full.packetSha256;
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(input([aliased])), errorCode('KCRP_BYTE_BENCHMARK_ALIAS_INVALID'));
});

test('pair count and byte bounds are enforced before element or shadow-property access', () => {
  const pairs = new Array(KCRP_BYTE_BENCHMARK_LIMITS.pairs + 1);
  let pairGetterCalls = 0;
  Object.defineProperty(pairs, '0', { enumerable: true, get() { pairGetterCalls += 1; return pair('PAIR_X'); } });
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(input(pairs)), errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID'));
  assert.equal(pairGetterCalls, 0);

  const oversized = pair('PAIR_BIG');
  const bytes = Buffer.alloc(1_048_577, 0x61);
  let shadowCalls = 0;
  Object.defineProperty(bytes, 'byteLength', { configurable: true, get() { shadowCalls += 1; return 1; } });
  oversized.treatment.packetBytes = bytes;
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([oversized])),
    errorCode('KCRP_BYTE_BENCHMARK_PACKET_BYTES_INVALID')
  );
  assert.equal(shadowCalls, 0);

  const exact = pair('PAIR_EXACT', 'reduced', 'full', 'r'.repeat(KCRP_LIMITS.packetBytes));
  const exactResult = runOfflineKcrpByteBenchmarkV1(input([exact]));
  assert.equal(exactResult.report.treatment.packetBytes, KCRP_LIMITS.packetBytes);
});

test('pairs container admits only exact plain dense arrays without invoking hostile elements', () => {
  const dense = [pair('PAIR_DENSE_A'), pair('PAIR_DENSE_B')];
  const accepted = runOfflineKcrpByteBenchmarkV1(input(dense));
  assert.equal(accepted.report.pairCount, 2);

  const hiddenExtra = [pair('PAIR_HIDDEN_EXTRA')];
  Object.defineProperty(hiddenExtra, 'hiddenExtra', { value: true, enumerable: false });
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input(hiddenExtra)),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID')
  );

  const symbolExtra = [pair('PAIR_SYMBOL_EXTRA')];
  symbolExtra[Symbol('extra')] = true;
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input(symbolExtra)),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID')
  );

  class PairArray extends Array {}
  const subclass = new PairArray(pair('PAIR_SUBCLASS_ARRAY'));
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input(subclass)),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID')
  );

  const hole = new Array(2);
  hole[0] = pair('PAIR_HOLE');
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input(hole)),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID')
  );

  let elementGetterCalls = 0;
  const accessor = [pair('PAIR_ACCESSOR_ARRAY')];
  Object.defineProperty(accessor, '0', {
    enumerable: true,
    get() { elementGetterCalls += 1; return pair('PAIR_ACCESSOR_ARRAY'); }
  });
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input(accessor)),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID')
  );
  assert.equal(elementGetterCalls, 0);

  const hiddenElement = [pair('PAIR_HIDDEN_ELEMENT')];
  Object.defineProperty(hiddenElement, '0', { ...Object.getOwnPropertyDescriptor(hiddenElement, '0'), enumerable: false });
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input(hiddenElement)),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID')
  );

  let ownKeysCalls = 0;
  const proxied = new Proxy([pair('PAIR_PROXY_ARRAY')], {
    ownKeys() { ownKeysCalls += 1; return ['length', '0', '0']; }
  });
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input(proxied)),
    errorCode('KCRP_BYTE_BENCHMARK_PAIR_COUNT_INVALID')
  );
  assert.equal(ownKeysCalls, 0);
});

test('ordinary offset byte views work without alias escape; exotic byte views fail closed', () => {
  const candidate = pair('PAIR_VIEW', 'reduced', 'full', 'r');
  const backing = new ArrayBuffer(8);
  new Uint8Array(backing).set(Buffer.from('xxrxxxxx'));
  candidate.treatment.packetBytes = new Uint8Array(backing, 2, 1);
  const measured = runOfflineKcrpByteBenchmarkV1(input([candidate]));
  assert.equal(measured.report.outcomeCounts.reduced, 1);

  const proxied = pair('PAIR_PROXY');
  proxied.treatment.packetBytes = new Proxy(proxied.treatment.packetBytes, {});
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([proxied])),
    errorCode('KCRP_BYTE_BENCHMARK_PACKET_BYTES_INVALID')
  );
  class Bytes extends Uint8Array {}
  const subclassed = pair('PAIR_SUB');
  subclassed.treatment.packetBytes = new Bytes(Buffer.from('r'));
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([subclassed])),
    errorCode('KCRP_BYTE_BENCHMARK_PACKET_BYTES_INVALID')
  );
  if (typeof SharedArrayBuffer !== 'undefined') {
    const shared = pair('PAIR_SHARED');
    shared.treatment.packetBytes = new Uint8Array(new SharedArrayBuffer(1));
    assert.throws(
      () => runOfflineKcrpByteBenchmarkV1(input([shared])),
      errorCode('KCRP_BYTE_BENCHMARK_PACKET_BYTES_INVALID')
    );
  }
  const detached = pair('PAIR_DETACHED');
  const detachedBuffer = new ArrayBuffer(1);
  const detachedView = new Uint8Array(detachedBuffer);
  structuredClone(detachedBuffer, { transfer: [detachedBuffer] });
  detached.treatment.packetBytes = detachedView;
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([detached])),
    errorCode('KCRP_BYTE_BENCHMARK_PACKET_BYTES_INVALID')
  );
});

test('schemas are closed and accessors/proxies cannot alter a benchmark snapshot', () => {
  const unknown = input([pair('PAIR_UNKNOWN')]);
  unknown.extra = true;
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(unknown), errorCode('KCRP_BYTE_BENCHMARK_INPUT_INVALID'));

  const accessor = input([pair('PAIR_GETTER')]);
  let calls = 0;
  Object.defineProperty(accessor, 'benchmarkId', { enumerable: true, get() { calls += 1; return 'BENCHMARK-1'; } });
  assert.throws(() => runOfflineKcrpByteBenchmarkV1(accessor), errorCode('KCRP_BYTE_BENCHMARK_INPUT_INVALID'));
  assert.equal(calls, 0);
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(new Proxy(input([pair('PAIR_PROXY_INPUT')]), {})),
    errorCode('KCRP_BYTE_BENCHMARK_INPUT_INVALID')
  );

  const invalidBlock = blockedPair('PAIR_BLOCK');
  invalidBlock.treatment.reason = 'arbitrary';
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([invalidBlock])),
    errorCode('KCRP_BYTE_BENCHMARK_BLOCK_INVALID')
  );
  assert.equal(KCRP_BYTE_BENCHMARK_BOUNDARY.providerMeasurementAvailable, false);
});

test('B2 rejects complete top-level and pair own-key surfaces without invoking descriptors', () => {
  for (const decorate of [
    (value) => Object.defineProperty(value, 'hiddenExtra', { value: 'raw', enumerable: false }),
    (value) => { value[Symbol('raw-extra')] = true; }
  ]) {
    const top = input([pair('PAIR_TOP_B2')]);
    decorate(top);
    assert.throws(() => runOfflineKcrpByteBenchmarkV1(top), errorCode('KCRP_BYTE_BENCHMARK_INPUT_INVALID'));

    const pairWrapper = pair('PAIR_WRAPPER_B2');
    decorate(pairWrapper);
    const failure = pairFailure([pairWrapper]);
    assert.equal(failure.code, 'KCRP_BYTE_BENCHMARK_PAIR_INVALID');
    assert.equal(JSON.parse(failure.evidenceBytes).diagnosticClass, 'PAIR_ENVELOPE_INVALID');
    assert.equal(failure.evidenceBytes.includes(Buffer.from('raw')), false);
  }

  let fullGetterCalls = 0;
  const hostilePair = pair('PAIR_HOSTILE_B2');
  Object.defineProperty(hostilePair, 'full', {
    enumerable: true,
    get() { fullGetterCalls += 1; return null; }
  });
  assert.equal(pairFailure([hostilePair]).code, 'KCRP_BYTE_BENCHMARK_PAIR_INVALID');
  assert.equal(fullGetterCalls, 0);

  let ownKeysCalls = 0;
  const proxiedPair = new Proxy(pair('PAIR_PROXY_B2'), {
    ownKeys() { ownKeysCalls += 1; return ['pairId', 'pairId']; }
  });
  assert.equal(pairFailure([proxiedPair]).code, 'KCRP_BYTE_BENCHMARK_PAIR_INVALID');
  assert.equal(ownKeysCalls, 0);
});

test('B2 rejects nested available-arm and blocked-wrapper descriptor surfaces', () => {
  const availableCases = [];
  const symbolArm = pair('PAIR_ARM_SYMBOL');
  symbolArm.full[Symbol('extra')] = true;
  availableCases.push(symbolArm);
  const hiddenArm = pair('PAIR_ARM_HIDDEN');
  Object.defineProperty(hiddenArm.treatment, 'hiddenExtra', { value: true, enumerable: false });
  availableCases.push(hiddenArm);
  const prototypeArm = pair('PAIR_ARM_PROTO');
  Object.setPrototypeOf(prototypeArm.full, { inherited: true });
  availableCases.push(prototypeArm);
  for (const candidate of availableCases) {
    assert.throws(
      () => runOfflineKcrpByteBenchmarkV1(input([candidate])),
      errorCode('KCRP_BYTE_BENCHMARK_ARM_INVALID')
    );
  }

  let identityGetterCalls = 0;
  const accessorArm = pair('PAIR_ARM_ACCESSOR');
  Object.defineProperty(accessorArm.treatment, 'objectiveSha256', {
    enumerable: true,
    get() { identityGetterCalls += 1; return objectiveSha256; }
  });
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([accessorArm])),
    errorCode('KCRP_BYTE_BENCHMARK_ARM_INVALID')
  );
  assert.equal(identityGetterCalls, 0);

  let nestedOwnKeysCalls = 0;
  const proxiedArm = pair('PAIR_ARM_PROXY');
  proxiedArm.full = new Proxy(proxiedArm.full, {
    ownKeys() { nestedOwnKeysCalls += 1; return ['objectiveSha256', 'objectiveSha256']; }
  });
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([proxiedArm])),
    errorCode('KCRP_BYTE_BENCHMARK_ARM_INVALID')
  );
  assert.equal(nestedOwnKeysCalls, 0);

  for (const decorate of [
    (value) => Object.defineProperty(value, 'hiddenExtra', { value: true, enumerable: false }),
    (value) => { value[Symbol('extra')] = true; }
  ]) {
    const blocked = blockedPair('PAIR_BLOCK_WRAPPER');
    decorate(blocked.treatment);
    assert.throws(
      () => runOfflineKcrpByteBenchmarkV1(input([blocked])),
      errorCode('KCRP_BYTE_BENCHMARK_BLOCK_INVALID')
    );
  }

  let statusGetterCalls = 0;
  const hostileBlock = blockedPair('PAIR_BLOCK_ACCESSOR');
  Object.defineProperty(hostileBlock.treatment, 'status', {
    enumerable: true,
    get() { statusGetterCalls += 1; return 'BLOCKED'; }
  });
  assert.throws(
    () => runOfflineKcrpByteBenchmarkV1(input([hostileBlock])),
    errorCode('KCRP_BYTE_BENCHMARK_BLOCK_INVALID')
  );
  assert.equal(statusGetterCalls, 0);
});
