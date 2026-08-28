import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOfflineDispatchManifestV1,
  canonicalizeOfflineDispatchManifestV1,
  KCRP_DISPATCH_MANIFEST_BOUNDARY,
  parseOfflineDispatchManifestV1
} from '../plugins/kstack/scripts/kstack-kcrp-dispatch-manifest.mjs';
import { KCRP_LIMITS } from '../plugins/kstack/scripts/kstack-kcrp-core.mjs';
import { bytesSha256, canonicalJsonBytes, parseCanonicalJson } from '../plugins/kstack/scripts/kstack-kcrp-json.mjs';

const failure = {
  code: 'KCRP_MAP_STALE',
  stage: 'map',
  evidenceSha256: 'a'.repeat(64)
};

function reducedInput() {
  return {
    invocationId: 'invocation-1',
    threadId: 'thread-1',
    phase: 'design',
    round: 3,
    purpose: 'remediation',
    route: 'reduced',
    reductionFailure: null,
    requestedItemIds: ['ITEM_B'],
    includedItemIds: ['ITEM_B', 'ITEM_A'],
    omittedItemIds: ['ITEM_C'],
    artifacts: [
      { artifactId: 'ART_B', bytes: Buffer.from('bravo') },
      { artifactId: 'ART_A', bytes: Buffer.from('alpha') }
    ],
    packetBytes: Buffer.from('packet')
  };
}

function errorCode(code) {
  return (error) => error?.code === code;
}

test('offline manifest construction is canonical, deterministic, detached-hash bound, and non-dispatching', () => {
  const left = buildOfflineDispatchManifestV1(reducedInput());
  const reordered = reducedInput();
  reordered.includedItemIds.reverse();
  reordered.artifacts.reverse();
  const right = buildOfflineDispatchManifestV1(reordered);
  assert.equal(left.manifestBytes.equals(right.manifestBytes), true);
  assert.equal(left.dispatchManifestSha256, right.dispatchManifestSha256);
  assert.equal(left.dispatchEligible, false);
  assert.equal(left.boundary, 'OFFLINE_SUBSET_ONLY');
  assert.deepEqual(left.manifest.artifacts.map(({ artifactId }) => artifactId), ['ART_A', 'ART_B']);
  assert.deepEqual(left.manifest.includedItemIds, ['ITEM_A', 'ITEM_B']);
  assert.deepEqual(left.manifest.providerUsage, {
    U: null, W: null, R: null, P: null,
    closedReason: 'OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT'
  });
  assert.equal(KCRP_DISPATCH_MANIFEST_BOUNDARY.dispatchAuthority, 'NONE');
  assert.equal(KCRP_DISPATCH_MANIFEST_BOUNDARY.finalR2eManifestImplemented, false);
  const parsed = parseOfflineDispatchManifestV1(left.manifestBytes, {
    expectedDispatchManifestSha256: left.dispatchManifestSha256
  });
  assert.deepEqual(parsed.manifest, left.manifest);
  assert.equal(Object.isFrozen(left.manifest), true);
  assert.equal(Object.isFrozen(left.manifest.artifacts), true);
  assert.throws(() => { left.manifest.round = 4; }, TypeError);
});

test('DM1 validates and emits one provider-usage getter snapshot', () => {
  const source = structuredClone(buildOfflineDispatchManifestV1(reducedInput()).manifest);
  let reads = 0;
  Object.defineProperty(source.providerUsage, 'U', {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return reads === 1 ? null : 777;
    }
  });
  const result = canonicalizeOfflineDispatchManifestV1(source);
  assert.equal(reads, 1);
  assert.equal(result.manifest.providerUsage.U, null);
  assert.deepEqual(parseCanonicalJson(result.manifestBytes), result.manifest);
  assert.equal(canonicalJsonBytes(result.manifest).equals(result.manifestBytes), true);
  assert.equal(Object.isFrozen(result.manifest.providerUsage), true);
  assert.throws(() => { result.manifest.providerUsage.U = 777; }, TypeError);
});

test('DM1 snapshots proxy-controlled schema, authority, route, bounds, and identities exactly once', () => {
  const source = structuredClone(buildOfflineDispatchManifestV1(reducedInput()).manifest);
  const secondValues = {
    schemaVersion: 2,
    dispatchAuthority: 'FORGED',
    route: 'full-required',
    packetByteLength: KCRP_LIMITS.packetBytes + 1,
    packetSha256: '0'.repeat(64)
  };
  const topReads = new Map();
  const proxied = new Proxy(source, {
    get(target, property, receiver) {
      if (Object.hasOwn(secondValues, property)) {
        const count = (topReads.get(property) ?? 0) + 1;
        topReads.set(property, count);
        if (count > 1) return secondValues[property];
      }
      return Reflect.get(target, property, receiver);
    }
  });
  const artifact = source.artifacts[0];
  let artifactShaReads = 0;
  source.artifacts[0] = new Proxy(artifact, {
    get(target, property, receiver) {
      if (property === 'sha256') {
        artifactShaReads += 1;
        if (artifactShaReads > 1) return '0'.repeat(64);
      }
      return Reflect.get(target, property, receiver);
    }
  });

  const result = canonicalizeOfflineDispatchManifestV1(proxied);
  assert.deepEqual(Object.fromEntries(topReads), {
    dispatchAuthority: 1,
    packetByteLength: 1,
    packetSha256: 1,
    route: 1,
    schemaVersion: 1
  });
  assert.equal(artifactShaReads, 1);
  assert.deepEqual(parseCanonicalJson(result.manifestBytes), result.manifest);
  assert.equal(canonicalJsonBytes(result.manifest).equals(result.manifestBytes), true);
  assert.equal(Object.isFrozen(result.manifest), true);
  assert.equal(Object.isFrozen(result.manifest.artifacts), true);
  assert.equal(Object.isFrozen(result.manifest.artifacts[0]), true);

  source.schemaVersion = 9;
  artifact.sha256 = 'f'.repeat(64);
  assert.equal(result.manifest.schemaVersion, 1);
  assert.notEqual(result.manifest.artifacts[0].sha256, artifact.sha256);
  assert.throws(() => { result.manifest.artifacts[0].sha256 = 'f'.repeat(64); }, TypeError);
});

test('strict parsing rejects duplicate keys, noncanonical key order, missing fields, and unknown fields', () => {
  const built = buildOfflineDispatchManifestV1(reducedInput());
  const canonical = built.manifestBytes.toString('utf8');
  const duplicate = Buffer.from(`{"round":3,${canonical.slice(1)}`);
  assert.throws(() => parseOfflineDispatchManifestV1(duplicate), errorCode('KCRP_JSON_DUPLICATE_KEY'));
  const reverseKeyOrder = Object.fromEntries(Object.entries(built.manifest).reverse());
  assert.throws(() => parseOfflineDispatchManifestV1(Buffer.from(JSON.stringify(reverseKeyOrder))), errorCode('KCRP_JSON_NONCANONICAL'));

  const missing = structuredClone(built.manifest);
  delete missing.packetSha256;
  assert.throws(() => canonicalizeOfflineDispatchManifestV1(missing), errorCode('KCRP_DISPATCH_MANIFEST_SCHEMA_INVALID'));
  const unknown = structuredClone(built.manifest);
  unknown.extra = 'forbidden';
  assert.throws(() => canonicalizeOfflineDispatchManifestV1(unknown), errorCode('KCRP_DISPATCH_MANIFEST_SCHEMA_INVALID'));
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, { extra: 'forbidden' }),
    errorCode('KCRP_DISPATCH_OPTIONS_INVALID')
  );
});

test('FULL_CONTEXT_REQUIRED and fallback-reason states are explicit and fail closed', () => {
  const full = reducedInput();
  Object.assign(full, {
    purpose: 'closure', route: 'full-required', requestedItemIds: [],
    includedItemIds: [], omittedItemIds: [], reductionFailure: null
  });
  const builtFull = buildOfflineDispatchManifestV1(full);
  assert.equal(builtFull.manifest.contextRequirement, 'FULL_CONTEXT_REQUIRED');

  const fallback = reducedInput();
  Object.assign(fallback, {
    route: 'full-fallback', includedItemIds: [], omittedItemIds: [], reductionFailure: failure
  });
  const builtFallback = buildOfflineDispatchManifestV1(fallback);
  assert.equal(builtFallback.manifest.contextRequirement, 'FULL_CONTEXT_REQUIRED');
  assert.deepEqual(builtFallback.manifest.reductionFailure, failure);

  for (const mutate of [
    (manifest) => { manifest.contextRequirement = 'REDUCED_CONTEXT_PERMITTED'; },
    (manifest) => { manifest.reductionFailure = null; },
    (manifest) => { manifest.omittedItemIds = ['ITEM_C']; },
    (manifest) => { manifest.purpose = 'closure'; manifest.route = 'reduced'; }
  ]) {
    const changed = structuredClone(builtFallback.manifest);
    mutate(changed);
    assert.throws(() => canonicalizeOfflineDispatchManifestV1(changed));
  }
  const reducedWithFallback = structuredClone(buildOfflineDispatchManifestV1(reducedInput()).manifest);
  reducedWithFallback.reductionFailure = failure;
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(reducedWithFallback),
    errorCode('KCRP_DISPATCH_FALLBACK_REASON_INVALID')
  );
});

test('identity binding rejects stale artifact, packet, and detached manifest digests', () => {
  const built = buildOfflineDispatchManifestV1(reducedInput());
  const artifacts = { ART_A: Buffer.from('alpha'), ART_B: Buffer.from('changed') };
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, { artifactBytesById: artifacts }),
    errorCode('KCRP_DISPATCH_ARTIFACT_STALE')
  );
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, { packetBytes: Buffer.from('changed') }),
    errorCode('KCRP_DISPATCH_PACKET_STALE')
  );
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, { expectedDispatchManifestSha256: '0'.repeat(64) }),
    errorCode('KCRP_DISPATCH_MANIFEST_STALE')
  );
});

test('ordering and set validators reject swaps, duplicates, overlap, and incomplete reduced context', () => {
  const built = buildOfflineDispatchManifestV1(reducedInput());
  for (const mutate of [
    (manifest) => { manifest.artifacts.reverse(); },
    (manifest) => { manifest.includedItemIds.reverse(); },
    (manifest) => { manifest.includedItemIds = ['ITEM_A', 'ITEM_A']; },
    (manifest) => { manifest.omittedItemIds = ['ITEM_A']; },
    (manifest) => { manifest.omittedItemIds = []; },
    (manifest) => { manifest.requestedItemIds = ['ITEM_D']; }
  ]) {
    const changed = structuredClone(built.manifest);
    mutate(changed);
    assert.throws(() => canonicalizeOfflineDispatchManifestV1(changed));
  }
});

test('count and byte bounds accept equality and reject max plus one', () => {
  const atMaximum = reducedInput();
  atMaximum.packetBytes = Buffer.alloc(KCRP_LIMITS.packetBytes, 0x61);
  assert.equal(buildOfflineDispatchManifestV1(atMaximum).manifest.packetByteLength, KCRP_LIMITS.packetBytes);
  const over = reducedInput();
  over.packetBytes = Buffer.alloc(KCRP_LIMITS.packetBytes + 1, 0x61);
  assert.throws(() => buildOfflineDispatchManifestV1(over), errorCode('KCRP_REDUCED_TOO_LARGE'));

  const tooManyArtifacts = reducedInput();
  tooManyArtifacts.artifacts = Array.from({ length: KCRP_LIMITS.artifacts + 1 }, (_, index) => ({
    artifactId: `ART_${String(index).padStart(3, '0')}`,
    bytes: Buffer.alloc(0)
  }));
  assert.throws(() => buildOfflineDispatchManifestV1(tooManyArtifacts), errorCode('KCRP_DISPATCH_ARTIFACT_COUNT_INVALID'));
  const tooManyRequested = reducedInput();
  tooManyRequested.requestedItemIds = Array.from(
    { length: KCRP_LIMITS.requestedItems + 1 },
    (_, index) => `ITEM_${String(index).padStart(3, '0')}`
  );
  assert.throws(() => buildOfflineDispatchManifestV1(tooManyRequested), errorCode('KCRP_DISPATCH_ITEM_IDS_INVALID'));
  for (const key of ['includedItemIds', 'omittedItemIds']) {
    const tooMany = reducedInput();
    tooMany[key] = Array.from(
      { length: KCRP_LIMITS.includedItems + 1 },
      (_, index) => `ITEM_${String(index).padStart(4, '0')}`
    );
    assert.throws(() => buildOfflineDispatchManifestV1(tooMany), errorCode('KCRP_DISPATCH_ITEM_IDS_INVALID'));
  }
  assert.throws(
    () => parseOfflineDispatchManifestV1(Buffer.alloc(KCRP_LIMITS.manifestBytes + 1, 0x7b)),
    errorCode('KCRP_JSON_TOO_LARGE')
  );
});

test('DM2 build and revalidation share typed route-aware packet overflow behavior', () => {
  const routeInputs = [
    {
      purpose: 'remediation', route: 'reduced', reductionFailure: null,
      code: 'KCRP_REDUCED_TOO_LARGE', fallbackAllowed: true, nextRoute: 'full-fallback'
    },
    {
      purpose: 'closure', route: 'full-required', reductionFailure: null,
      code: 'KCRP_FULL_TOO_LARGE', fallbackAllowed: false, nextRoute: null
    },
    {
      purpose: 'remediation', route: 'full-fallback', reductionFailure: failure,
      code: 'KCRP_FULL_TOO_LARGE', fallbackAllowed: false, nextRoute: null
    }
  ];
  const assertTypedFailure = (error, row) => {
    assert.equal(error.code, row.code);
    assert.equal(error.fallbackAllowed, row.fallbackAllowed);
    assert.equal(error.nextRoute, row.nextRoute);
    assert.equal(error.packetSizeFailure.kind, 'kstack-kcrp-dispatch-packet-size-failure-v1');
    assert.equal(error.packetSizeFailure.code, row.code);
    assert.equal(error.packetSizeFailure.actualBytes, KCRP_LIMITS.packetBytes + 1);
    assert.equal(error.packetSizeFailure.maximumBytes, KCRP_LIMITS.packetBytes);
    assert.equal(Object.isFrozen(error.packetSizeFailure), true);
    assert.ok(canonicalJsonBytes(error.packetSizeFailure).length < 4096);
    assert.equal(
      error.packetSizeFailureSha256,
      bytesSha256(canonicalJsonBytes(error.packetSizeFailure))
    );
  };

  for (const row of routeInputs) {
    const atMaximum = reducedInput();
    Object.assign(atMaximum, {
      purpose: row.purpose,
      route: row.route,
      reductionFailure: row.reductionFailure,
      packetBytes: Buffer.alloc(KCRP_LIMITS.packetBytes, 0x61)
    });
    if (row.route !== 'reduced') Object.assign(atMaximum, { includedItemIds: [], omittedItemIds: [] });
    const built = buildOfflineDispatchManifestV1(atMaximum);
    assert.equal(built.manifest.packetByteLength, KCRP_LIMITS.packetBytes);
    assert.doesNotThrow(() => canonicalizeOfflineDispatchManifestV1(built.manifest, {
      packetBytes: atMaximum.packetBytes
    }));

    const oversized = { ...atMaximum, packetBytes: Buffer.alloc(KCRP_LIMITS.packetBytes + 1, 0x61) };
    let buildError;
    assert.throws(() => buildOfflineDispatchManifestV1(oversized), (error) => {
      buildError = error;
      return error.code === row.code;
    });
    assertTypedFailure(buildError, row);

    let verifyError;
    assert.throws(() => canonicalizeOfflineDispatchManifestV1(built.manifest, {
      packetBytes: oversized.packetBytes
    }), (error) => {
      verifyError = error;
      return error.code === row.code;
    });
    assertTypedFailure(verifyError, row);

    if (row.route === 'reduced') {
      assert.deepEqual(Object.keys(buildError.reductionFailure).sort(), ['code', 'evidenceSha256', 'stage']);
      assert.equal(buildError.reductionFailure.code, 'KCRP_REDUCED_TOO_LARGE');
      assert.equal(buildError.block, null);
    } else {
      assert.deepEqual(buildError.block, {
        code: 'KCRP_FULL_TOO_LARGE', stage: 'size', evidenceSha256: buildError.packetSizeFailure.evidenceSha256
      });
    }
    if (row.route === 'full-fallback') {
      const priorBytes = canonicalJsonBytes(failure);
      assert.equal(canonicalJsonBytes(buildError.reductionFailure).equals(priorBytes), true);
      assert.equal(canonicalJsonBytes(verifyError.reductionFailure).equals(priorBytes), true);
      assert.deepEqual(buildError.reductionFailure, failure);
      assert.deepEqual(verifyError.reductionFailure, failure);
    }
  }
});

test('DM2 keeps purpose-route validation ahead of packet overflow classification', () => {
  const invalidRoute = reducedInput();
  invalidRoute.route = 'forged';
  invalidRoute.reductionFailure = undefined;
  invalidRoute.packetBytes = Buffer.alloc(KCRP_LIMITS.packetBytes + 1, 0x61);
  assert.throws(
    () => buildOfflineDispatchManifestV1(invalidRoute),
    errorCode('KCRP_DISPATCH_PURPOSE_ROUTE_INVALID')
  );

  const invalidFailure = reducedInput();
  invalidFailure.route = 'full-fallback';
  invalidFailure.reductionFailure = { code: 'FORGED' };
  invalidFailure.packetBytes = Buffer.alloc(KCRP_LIMITS.packetBytes + 1, 0x61);
  assert.throws(
    () => buildOfflineDispatchManifestV1(invalidFailure),
    errorCode('KCRP_DISPATCH_FALLBACK_REASON_INVALID')
  );
});

test('DM3 enforces artifact max and max plus one with typed route behavior in build and revalidation', () => {
  const exactArtifact = Buffer.alloc(KCRP_LIMITS.sourceArtifactBytes, 0x61);
  const oversizedArtifact = Buffer.alloc(KCRP_LIMITS.sourceArtifactBytes + 1, 0x61);
  const routes = [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null, fallbackAllowed: true },
    { purpose: 'closure', route: 'full-required', reductionFailure: null, fallbackAllowed: false },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: failure, fallbackAllowed: false }
  ];
  for (const row of routes) {
    const exact = reducedInput();
    Object.assign(exact, {
      purpose: row.purpose,
      route: row.route,
      reductionFailure: row.reductionFailure,
      artifacts: [{ artifactId: 'ART_A', bytes: exactArtifact }]
    });
    if (row.route !== 'reduced') Object.assign(exact, { includedItemIds: [], omittedItemIds: [] });
    const built = buildOfflineDispatchManifestV1(exact);
    assert.equal(built.manifest.artifacts[0].byteLength, KCRP_LIMITS.sourceArtifactBytes);
    assert.doesNotThrow(() => canonicalizeOfflineDispatchManifestV1(built.manifest, {
      artifactBytesById: { ART_A: exactArtifact }
    }));

    const over = { ...exact, artifacts: [{ artifactId: 'ART_A', bytes: oversizedArtifact }] };
    for (const operation of [
      () => buildOfflineDispatchManifestV1(over),
      () => canonicalizeOfflineDispatchManifestV1(built.manifest, {
        artifactBytesById: { ART_A: oversizedArtifact }
      })
    ]) {
      let observed;
      assert.throws(operation, (error) => {
        observed = error;
        return error.code === (row.route === 'reduced' ? 'KCRP_REDUCED_TOO_LARGE' : 'KCRP_FULL_TOO_LARGE');
      });
      assert.equal(observed.domain, 'artifact');
      assert.equal(observed.artifactId, 'ART_A');
      assert.equal(observed.actualBytes, KCRP_LIMITS.sourceArtifactBytes + 1);
      assert.equal(observed.maximumBytes, KCRP_LIMITS.sourceArtifactBytes);
      assert.equal(observed.fallbackAllowed, row.fallbackAllowed);
      assert.equal(observed.nextRoute, row.route === 'reduced' ? 'full-fallback' : null);
      assert.equal(observed.artifactSizeFailure.kind, 'kstack-kcrp-dispatch-artifact-size-failure-v1');
      assert.equal(Object.isFrozen(observed.artifactSizeFailure), true);
      assert.ok(canonicalJsonBytes(observed.artifactSizeFailure).length < 4096);
      assert.equal(
        observed.artifactSizeFailureSha256,
        bytesSha256(canonicalJsonBytes(observed.artifactSizeFailure))
      );
      if (row.route === 'full-fallback') {
        assert.equal(canonicalJsonBytes(observed.reductionFailure).equals(canonicalJsonBytes(failure)), true);
        assert.deepEqual(observed.reductionFailure, failure);
      }
    }
  }
});

test('DM3 stops supplied plain-object admission at expected plus one without reading excess values', () => {
  const input = reducedInput();
  input.artifacts = [{ artifactId: 'ART_A', bytes: Buffer.from('alpha') }];
  const built = buildOfflineDispatchManifestV1(input);
  const supplied = { ART_A: Buffer.from('alpha') };
  let getterReads = 0;
  for (let index = 0; index < 1000; index += 1) {
    Object.defineProperty(supplied, `EXTRA_${String(index).padStart(4, '0')}`, {
      enumerable: true,
      get() { getterReads += 1; return Buffer.from('forbidden'); }
    });
  }
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, { artifactBytesById: supplied }),
    errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
  );
  assert.equal(getterReads, 0);
});

test('DM3 rejects artifact accessors, proxies, and non-ordinary supplied objects before value access', () => {
  const input = reducedInput();
  input.artifacts = [{ artifactId: 'ART_A', bytes: Buffer.from('alpha') }];
  const built = buildOfflineDispatchManifestV1(input);
  let getterReads = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'ART_A', {
    enumerable: true,
    get() { getterReads += 1; return Buffer.from('alpha'); }
  });
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, { artifactBytesById: accessor }),
    errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
  );
  assert.equal(getterReads, 0);

  let proxyOwnKeys = 0;
  const proxied = new Proxy({ ART_A: Buffer.from('alpha') }, {
    ownKeys(target) { proxyOwnKeys += 1; return Reflect.ownKeys(target); }
  });
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, { artifactBytesById: proxied }),
    errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
  );
  assert.equal(proxyOwnKeys, 0);
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, {
      artifactBytesById: Object.assign(Object.create(null), { ART_A: Buffer.from('alpha') })
    }),
    errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
  );
  class HostileMap extends Map {}
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(built.manifest, {
      artifactBytesById: new HostileMap([['ART_A', Buffer.from('alpha')]])
    }),
    errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
  );

  const proxiedArtifact = reducedInput();
  proxiedArtifact.artifacts = [new Proxy({ artifactId: 'ART_A', bytes: Buffer.from('alpha') }, {})];
  assert.throws(
    () => buildOfflineDispatchManifestV1(proxiedArtifact),
    errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
  );
});

test('DM3 declared identity and order failures precede supplied-map admission', () => {
  const built = buildOfflineDispatchManifestV1(reducedInput());
  const tooLargeIdentity = structuredClone(built.manifest);
  tooLargeIdentity.artifacts[0].byteLength = KCRP_LIMITS.sourceArtifactBytes + 1;
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(tooLargeIdentity),
    errorCode('KCRP_DISPATCH_ARTIFACT_INVALID')
  );

  let suppliedGetterReads = 0;
  const supplied = {};
  Object.defineProperty(supplied, 'ART_A', {
    enumerable: true,
    get() { suppliedGetterReads += 1; return Buffer.from('alpha'); }
  });
  const unordered = structuredClone(built.manifest);
  unordered.artifacts.reverse();
  assert.throws(
    () => canonicalizeOfflineDispatchManifestV1(unordered, { artifactBytesById: supplied }),
    errorCode('KCRP_DISPATCH_ARTIFACT_ORDER_INVALID')
  );
  assert.equal(suppliedGetterReads, 0);
});

test('DM3-1 and DM2-REG-1 reject shadowed and subclass byte views on every route without invoking getters', () => {
  const routes = [
    { purpose: 'remediation', route: 'reduced', reductionFailure: null },
    { purpose: 'closure', route: 'full-required', reductionFailure: null },
    { purpose: 'remediation', route: 'full-fallback', reductionFailure: failure }
  ];
  let shadowReads = 0;
  const shadowedArtifact = Buffer.alloc(KCRP_LIMITS.sourceArtifactBytes + 1, 0x61);
  const shadowedPacket = Buffer.alloc(KCRP_LIMITS.packetBytes + 1, 0x61);
  for (const value of [shadowedArtifact, shadowedPacket]) {
    Object.defineProperty(value, 'byteLength', {
      configurable: true,
      get() { shadowReads += 1; return 1; }
    });
  }
  let togglingReads = 0;
  class TogglingBytes extends Uint8Array {
    get byteLength() { togglingReads += 1; return togglingReads % 2 === 1 ? 1 : super.byteLength; }
  }
  class BenignBytes extends Uint8Array {}
  const toggling = new TogglingBytes(8);
  const benign = new BenignBytes(8);

  for (const row of routes) {
    const baseline = reducedInput();
    Object.assign(baseline, row);
    if (row.route !== 'reduced') Object.assign(baseline, { includedItemIds: [], omittedItemIds: [] });
    const built = buildOfflineDispatchManifestV1(baseline);
    for (const value of [toggling, benign]) {
      const artifactInput = { ...baseline, artifacts: [{ artifactId: 'ART_A', bytes: value }] };
      assert.throws(
        () => buildOfflineDispatchManifestV1(artifactInput),
        errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
      );
      assert.throws(
        () => canonicalizeOfflineDispatchManifestV1(built.manifest, {
          artifactBytesById: { ART_A: value, ART_B: Buffer.from('bravo') }
        }),
        errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
      );
      assert.throws(
        () => buildOfflineDispatchManifestV1({ ...baseline, packetBytes: value }),
        errorCode('KCRP_DISPATCH_PACKET_BYTES_INVALID')
      );
      assert.throws(
        () => canonicalizeOfflineDispatchManifestV1(built.manifest, { packetBytes: value }),
        errorCode('KCRP_DISPATCH_PACKET_BYTES_INVALID')
      );
    }
    for (const [domain, operation] of [
      ['artifact', () => buildOfflineDispatchManifestV1({
        ...baseline, artifacts: [{ artifactId: 'ART_A', bytes: shadowedArtifact }]
      })],
      ['artifact', () => canonicalizeOfflineDispatchManifestV1(built.manifest, {
        artifactBytesById: { ART_A: shadowedArtifact, ART_B: Buffer.from('bravo') }
      })],
      ['packet', () => buildOfflineDispatchManifestV1({ ...baseline, packetBytes: shadowedPacket })],
      ['packet', () => canonicalizeOfflineDispatchManifestV1(built.manifest, { packetBytes: shadowedPacket })]
    ]) {
      let observed;
      assert.throws(operation, (error) => {
        observed = error;
        return error.code === (row.route === 'reduced' ? 'KCRP_REDUCED_TOO_LARGE' : 'KCRP_FULL_TOO_LARGE');
      });
      assert.equal(observed.domain, domain);
      assert.equal(observed.fallbackAllowed, row.route === 'reduced');
      if (row.route === 'full-fallback') {
        assert.equal(canonicalJsonBytes(observed.reductionFailure).equals(canonicalJsonBytes(failure)), true);
      }
    }
  }
  assert.equal(shadowReads, 0);
  assert.equal(togglingReads, 0);
});

test('exact ordinary Buffer and offset Uint8Array views hash and declare only their admitted bytes', () => {
  const artifactBacking = Uint8Array.from([0x78, 0x61, 0x6c, 0x70, 0x68, 0x61, 0x79]);
  const packetBacking = Uint8Array.from([0x78, 0x70, 0x61, 0x63, 0x6b, 0x65, 0x74, 0x79]);
  const artifactView = new Uint8Array(artifactBacking.buffer, 1, 5);
  const packetView = new Uint8Array(packetBacking.buffer, 1, 6);
  assert.equal(Object.getPrototypeOf(artifactView), Uint8Array.prototype);
  assert.equal(Object.getPrototypeOf(packetView), Uint8Array.prototype);
  const input = reducedInput();
  input.artifacts = [
    { artifactId: 'ART_A', bytes: artifactView },
    { artifactId: 'ART_B', bytes: Buffer.from('bravo') }
  ];
  input.packetBytes = packetView;
  const built = buildOfflineDispatchManifestV1(input);
  assert.deepEqual(built.manifest.artifacts, [
    { artifactId: 'ART_A', byteLength: 5, sha256: bytesSha256(Buffer.from('alpha')) },
    { artifactId: 'ART_B', byteLength: 5, sha256: bytesSha256(Buffer.from('bravo')) }
  ]);
  assert.equal(built.manifest.packetByteLength, 6);
  assert.equal(built.manifest.packetSha256, bytesSha256(Buffer.from('packet')));
  assert.doesNotThrow(() => canonicalizeOfflineDispatchManifestV1(built.manifest, {
    artifactBytesById: { ART_A: artifactView, ART_B: Buffer.from('bravo') },
    packetBytes: packetView
  }));
});

test('shared and resizable backing stores fail typed byte-view admission in build and revalidation', () => {
  const built = buildOfflineDispatchManifestV1(reducedInput());
  const rejectedViews = [];
  if (typeof SharedArrayBuffer !== 'undefined') {
    rejectedViews.push(new Uint8Array(new SharedArrayBuffer(8)));
    const growable = new SharedArrayBuffer(8, { maxByteLength: 16 });
    if (growable.growable) rejectedViews.push(new Uint8Array(growable));
  }
  const resizable = new ArrayBuffer(8, { maxByteLength: 16 });
  if (resizable.resizable) rejectedViews.push(new Uint8Array(resizable));
  for (const value of rejectedViews) {
    assert.throws(
      () => buildOfflineDispatchManifestV1({ ...reducedInput(), packetBytes: value }),
      errorCode('KCRP_DISPATCH_PACKET_BYTES_INVALID')
    );
    assert.throws(
      () => canonicalizeOfflineDispatchManifestV1(built.manifest, { packetBytes: value }),
      errorCode('KCRP_DISPATCH_PACKET_BYTES_INVALID')
    );
    const artifactInput = reducedInput();
    artifactInput.artifacts = [{ artifactId: 'ART_A', bytes: value }];
    assert.throws(
      () => buildOfflineDispatchManifestV1(artifactInput),
      errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
    );
    assert.throws(
      () => canonicalizeOfflineDispatchManifestV1(built.manifest, {
        artifactBytesById: { ART_A: value, ART_B: Buffer.from('bravo') }
      }),
      errorCode('KCRP_DISPATCH_ARTIFACT_BYTES_INVALID')
    );
  }
});

test('unsafe numbers, malformed identities, token estimates, and opaque output cannot enter the manifest', () => {
  const built = buildOfflineDispatchManifestV1(reducedInput());
  for (const mutate of [
    (manifest) => { manifest.round = Number.MAX_SAFE_INTEGER + 1; },
    (manifest) => { manifest.artifacts[0].sha256 = 'A'.repeat(64); },
    (manifest) => { manifest.providerUsage.U = 1; },
    (manifest) => { manifest.providerUsage.estimate = 10; },
    (manifest) => { manifest.opaqueResult = 'secret'; }
  ]) {
    const changed = structuredClone(built.manifest);
    mutate(changed);
    assert.throws(() => canonicalizeOfflineDispatchManifestV1(changed));
  }

  const extraInput = reducedInput();
  extraInput.opaquePayload = 'secret';
  assert.throws(() => buildOfflineDispatchManifestV1(extraInput), errorCode('KCRP_DISPATCH_BUILD_INPUT_INVALID'));
  const nonStringId = reducedInput();
  nonStringId.requestedItemIds = [null];
  assert.throws(() => buildOfflineDispatchManifestV1(nonStringId), errorCode('KCRP_DISPATCH_ITEM_IDS_INVALID'));
});
