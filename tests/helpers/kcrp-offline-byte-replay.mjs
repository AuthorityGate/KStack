import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bytesSha256,
  canonicalJsonBytes
} from '../../plugins/kstack/scripts/kstack-kcrp-json.mjs';
import {
  KCRP_LIMITS,
  buildDeclaredClosure,
  buildKcrpSourcePacketV1,
  canonicalizeArtifactBytes,
  frameReviewInputV1,
  validateItemMap,
  verifyDeclaredClosure,
  verifyKcrpSourcePacketV1
} from '../../plugins/kstack/scripts/kstack-kcrp-core.mjs';
import {
  buildOfflineDispatchManifestV1,
  parseOfflineDispatchManifestV1
} from '../../plugins/kstack/scripts/kstack-kcrp-dispatch-manifest.mjs';
import {
  KCRP_BYTE_BENCHMARK_LIMITS,
  runOfflineKcrpByteBenchmarkV1
} from '../../plugins/kstack/scripts/kstack-kcrp-byte-benchmark.mjs';

const HELPER_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(HELPER_PATH), '../..');
const MEMORY_CONFIG = 'tests/fixtures/kcrp-memory-byte-replay-v1.json';
const ECR_CONFIG = 'tests/fixtures/kcrp-ecr-closure-replay-v1.json';
const REPOSITORY_REAL_ROOT = fs.realpathSync.native(REPOSITORY_ROOT);

export const KCRP_REPLAY_FILE_SURFACES = Object.freeze({
  CONFIG: 'CONFIG',
  SOURCE: 'SOURCE',
  GOVERNANCE: 'GOVERNANCE'
});

const FILE_SURFACE_LIMITS = Object.freeze({
  CONFIG: KCRP_LIMITS.itemMapBytes,
  SOURCE: KCRP_LIMITS.sourceArtifactBytes,
  GOVERNANCE: KCRP_LIMITS.sourceArtifactBytes
});

export class KcrpReplayFileError extends Error {
  constructor(surface, reason) {
    super('KCRP_REPLAY_FILE_REJECTED');
    this.name = 'KcrpReplayFileError';
    this.code = 'KCRP_REPLAY_FILE_REJECTED';
    this.evidence = Object.freeze({ surface, reason });
  }
}

function asciiCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(message) {
  throw new Error(`KCRP_REPLAY_INVALID: ${message}`);
}

function rejectFile(surface, reason) {
  throw new KcrpReplayFileError(surface, reason);
}

function portablePathEqual(left, right) {
  const normalize = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  return normalize(path.resolve(left)) === normalize(path.resolve(right));
}

function pathContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function validateRelativePath(relativePath, surface) {
  if (typeof relativePath !== 'string' || relativePath.length < 1 || relativePath.length > 4096
    || relativePath.includes('\0') || relativePath.includes('\\')
    || path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    rejectFile(surface, 'PATH_INVALID');
  }
  const parts = relativePath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) rejectFile(surface, 'PATH_TRAVERSAL');
  const candidate = path.resolve(REPOSITORY_ROOT, ...parts);
  if (!pathContained(REPOSITORY_ROOT, candidate)) rejectFile(surface, 'PATH_TRAVERSAL');
  return Object.freeze({ candidate, parts });
}

function verifyNoLinkComponents(parts, surface) {
  let current = REPOSITORY_ROOT;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    let actual;
    try {
      stat = fs.lstatSync(current, { bigint: true });
      actual = fs.realpathSync.native(current);
    } catch {
      rejectFile(surface, 'PATH_UNAVAILABLE');
    }
    if (stat.isSymbolicLink() || !portablePathEqual(actual, current)) rejectFile(surface, 'LINK_COMPONENT_REJECTED');
  }
}

function statIdentity(stat) {
  return Object.freeze({
    dev: String(stat.dev),
    ino: String(stat.ino),
    size: String(stat.size),
    mtime: String(stat.mtimeNs ?? BigInt(Math.trunc(Number(stat.mtimeMs) * 1_000_000)))
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino
    && left.size === right.size && left.mtime === right.mtime;
}

export function readBoundedRepositoryFile(relativePath, {
  surface,
  testAfterOpen = null
} = {}) {
  if (!Object.hasOwn(FILE_SURFACE_LIMITS, surface)) rejectFile('UNKNOWN', 'SURFACE_INVALID');
  const maximumBytes = FILE_SURFACE_LIMITS[surface];
  const { candidate, parts } = validateRelativePath(relativePath, surface);
  verifyNoLinkComponents(parts, surface);
  let beforeRealPath;
  try { beforeRealPath = fs.realpathSync.native(candidate); }
  catch { rejectFile(surface, 'PATH_UNAVAILABLE'); }
  if (!pathContained(REPOSITORY_REAL_ROOT, beforeRealPath)) rejectFile(surface, 'PATH_ESCAPE');

  const noFollow = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
  let descriptor;
  try { descriptor = fs.openSync(candidate, fs.constants.O_RDONLY | noFollow); }
  catch { rejectFile(surface, 'OPEN_REJECTED'); }
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile()) rejectFile(surface, 'NOT_REGULAR_FILE');
    if (before.size < 0n || before.size > BigInt(maximumBytes)) rejectFile(surface, 'SIZE_LIMIT');
    verifyNoLinkComponents(parts, surface);
    const pathBefore = fs.lstatSync(candidate, { bigint: true });
    if (!pathBefore.isFile() || !sameIdentity(statIdentity(before), statIdentity(pathBefore))) {
      rejectFile(surface, 'IDENTITY_CHANGED');
    }
    const openedRealPath = fs.realpathSync.native(candidate);
    if (!pathContained(REPOSITORY_REAL_ROOT, openedRealPath)) rejectFile(surface, 'PATH_ESCAPE');

    if (testAfterOpen !== null) {
      if (typeof testAfterOpen !== 'function') rejectFile(surface, 'TEST_SEAM_INVALID');
      try { testAfterOpen(); }
      catch { rejectFile(surface, 'IDENTITY_CHANGED'); }
    }

    const expectedLength = Number(before.size);
    const bytes = Buffer.alloc(expectedLength);
    let offset = 0;
    while (offset < expectedLength) {
      const count = fs.readSync(descriptor, bytes, offset, expectedLength - offset, offset);
      if (count === 0) rejectFile(surface, 'IDENTITY_CHANGED');
      offset += count;
    }
    const overflowProbe = Buffer.alloc(1);
    if (fs.readSync(descriptor, overflowProbe, 0, 1, offset) !== 0) rejectFile(surface, 'SIZE_LIMIT');

    const after = fs.fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(statIdentity(before), statIdentity(after))) rejectFile(surface, 'IDENTITY_CHANGED');
    verifyNoLinkComponents(parts, surface);
    const pathAfter = fs.lstatSync(candidate, { bigint: true });
    if (!pathAfter.isFile() || !sameIdentity(statIdentity(after), statIdentity(pathAfter))) {
      rejectFile(surface, 'IDENTITY_CHANGED');
    }
    const afterRealPath = fs.realpathSync.native(candidate);
    if (!pathContained(REPOSITORY_REAL_ROOT, afterRealPath)
      || !portablePathEqual(openedRealPath, afterRealPath)) rejectFile(surface, 'PATH_ESCAPE');
    return bytes;
  } catch (error) {
    if (error instanceof KcrpReplayFileError) throw error;
    rejectFile(surface, 'READ_REJECTED');
  } finally {
    try { fs.closeSync(descriptor); } catch { /* descriptor is already unusable */ }
  }
}

function readConfig(relativePath, expectedKind) {
  const configBytes = readBoundedRepositoryFile(relativePath, { surface: KCRP_REPLAY_FILE_SURFACES.CONFIG });
  let config;
  try { config = JSON.parse(configBytes.toString('utf8')); }
  catch { fail(`invalid config JSON: ${relativePath}`); }
  if (config?.schemaVersion !== 1 || config?.kind !== expectedKind) fail(`wrong config kind: ${relativePath}`);
  return Object.freeze({
    config,
    configRelativePath: relativePath,
    configSha256: bytesSha256(configBytes),
    canonicalConfigSha256: bytesSha256(canonicalJsonBytes(config))
  });
}

function verifyLimits(config, includeBenchmark) {
  const expected = {
    artifacts: KCRP_LIMITS.artifacts,
    items: KCRP_LIMITS.items,
    spansPerItem: KCRP_LIMITS.spansPerItem,
    totalSpans: KCRP_LIMITS.totalSpans,
    dependenciesPerItem: KCRP_LIMITS.dependenciesPerItem,
    requestedItems: KCRP_LIMITS.requestedItems,
    includedItems: KCRP_LIMITS.includedItems,
    sourceRecords: KCRP_LIMITS.sourceRecords,
    sourceRecordBytes: KCRP_LIMITS.sourceRecordBytes,
    sourceArtifactBytes: KCRP_LIMITS.sourceArtifactBytes,
    itemMapBytes: KCRP_LIMITS.itemMapBytes,
    manifestBytes: KCRP_LIMITS.manifestBytes,
    packetBytes: KCRP_LIMITS.packetBytes,
    reviewInputBytes: KCRP_LIMITS.reviewInputBytes
  };
  if (includeBenchmark) expected.benchmarkPairs = KCRP_BYTE_BENCHMARK_LIMITS.pairs;
  assert.deepEqual(config.limits, expected, 'fixture limits drifted from closed modules');
}

function loadSources(config) {
  if (!Array.isArray(config.sources) || config.sources.length < 1 || config.sources.length > KCRP_LIMITS.artifacts) {
    fail('source count invalid');
  }
  const artifactBytes = {};
  const bindings = [];
  const items = [];
  const sourceSpecs = [];
  const sourcesByItemId = new Map();
  const defaults = config.sourceDefaults;
  for (const source of config.sources) {
    const raw = readBoundedRepositoryFile(source.relativePath, { surface: KCRP_REPLAY_FILE_SURFACES.SOURCE });
    const canonical = canonicalizeArtifactBytes(raw);
    if (canonical.length !== source.byteLength || bytesSha256(canonical) !== source.sha256) {
      fail(`source identity mismatch: ${source.itemId}`);
    }
    const span = source.span ?? { byteStart: 0, byteLength: source.byteLength, sha256: source.sha256 };
    const binding = {
      artifactId: source.artifactId,
      role: source.artifactRole ?? defaults.artifactRole,
      repositoryRelativePath: source.relativePath,
      canonicalization: 'kstack-utf8-lf-v1',
      byteLength: canonical.length,
      sha256: bytesSha256(canonical)
    };
    const item = {
      itemId: source.itemId,
      artifactId: source.artifactId,
      spans: [structuredClone(span)],
      dependsOn: [...source.dependsOn],
      risk: source.risk ?? defaults.risk,
      status: source.status ?? defaults.status,
      reductionEligibility: source.reductionEligibility ?? defaults.reductionEligibility,
      mechanismGroupId: source.mechanismGroupId ?? defaults.mechanismGroupId
    };
    const spec = source.sourceId ? {
      schemaVersion: 1,
      kind: 'kstack-kcrp-source-record-v1',
      sourceId: source.sourceId,
      label: source.label,
      role: source.sourceRole ?? defaults.sourceRole,
      inclusion: source.inclusion ?? defaults.inclusion,
      artifact: structuredClone(binding),
      span: structuredClone(span)
    } : null;
    artifactBytes[source.artifactId] = Buffer.from(canonical);
    bindings.push(binding);
    items.push(item);
    if (spec) sourceSpecs.push(spec);
    sourcesByItemId.set(source.itemId, Object.freeze({ source, binding, item, spec, bytes: Buffer.from(canonical) }));
  }
  bindings.sort((left, right) => asciiCompare(left.artifactId, right.artifactId));
  items.sort((left, right) => asciiCompare(left.itemId, right.itemId));
  sourceSpecs.sort((left, right) => asciiCompare(left.sourceId, right.sourceId));
  return Object.freeze({ artifactBytes, bindings, items, sourceSpecs, sourcesByItemId });
}

function itemMapFor(config, loaded) {
  return {
    schemaVersion: 1,
    kind: 'kstack-kcrp-item-map-v1',
    canonicalizationVersion: 'kstack-kcrp-json-v1',
    threadId: config.threadId,
    phase: config.phase,
    artifactSet: loaded.bindings,
    items: loaded.items
  };
}

function buildClosure(config, loaded) {
  const itemMap = itemMapFor(config, loaded);
  const validated = validateItemMap(itemMap, { artifacts: loaded.artifactBytes });
  const closure = buildDeclaredClosure(itemMap, {
    artifacts: loaded.artifactBytes,
    expectedItemMapSha256: validated.itemMapSha256,
    requestedItemIds: config.requestedItemIds
  });
  verifyDeclaredClosure(itemMap, closure, {
    artifacts: loaded.artifactBytes,
    expectedItemMapSha256: validated.itemMapSha256
  });
  return Object.freeze({ itemMap, itemMapSha256: validated.itemMapSha256, closure });
}

function verifyExpectedClosure(config, replay) {
  assert.equal(replay.itemMapSha256, config.expected.itemMapSha256, 'item-map digest drift');
  assert.deepEqual(replay.closure.includedItemIds, config.expected.includedItemIds, 'included closure drift');
  assert.deepEqual(replay.closure.omittedItemIds, config.expected.omittedItemIds, 'omitted closure drift');
}

function digestFraming(identityFraming, verifyExpected) {
  const reviewer = identityFraming.reviewer;
  const reviewerSha256 = bytesSha256(canonicalJsonBytes({ domain: reviewer.domain, fields: reviewer.fields }));
  if (verifyExpected) assert.equal(reviewerSha256, reviewer.expectedSha256, 'reviewer framing digest drift');

  const governance = identityFraming.governance;
  for (const module of governance.modules) {
    const bytes = readBoundedRepositoryFile(module.path, { surface: KCRP_REPLAY_FILE_SURFACES.GOVERNANCE });
    assert.equal(bytesSha256(bytes), module.sha256, `governance module drift: ${module.role}`);
  }
  const governanceSha256 = bytesSha256(canonicalJsonBytes({ domain: governance.domain, modules: governance.modules }));
  if (verifyExpected) assert.equal(governanceSha256, governance.expectedSha256, 'governance framing digest drift');
  return Object.freeze({ reviewerSha256, governanceSha256 });
}

function packetFor(config, loaded, itemIds, dispatch) {
  const selected = new Set(itemIds);
  const sources = loaded.sourceSpecs.filter((spec) => {
    const record = [...loaded.sourcesByItemId.values()].find((entry) => entry.spec?.sourceId === spec.sourceId);
    return selected.has(record.item.itemId);
  });
  const artifacts = Object.fromEntries(
    [...loaded.sourcesByItemId.values()]
      .filter((entry) => selected.has(entry.item.itemId))
      .map((entry) => [entry.binding.artifactId, { binding: entry.binding, bytes: Buffer.from(entry.bytes) }])
  );
  const built = buildKcrpSourcePacketV1({
    purpose: dispatch.purpose,
    route: dispatch.route,
    reductionFailure: dispatch.reductionFailure,
    sources,
    artifacts
  });
  verifyKcrpSourcePacketV1(built.packetBytes, built.binding, {
    purpose: dispatch.purpose,
    route: dispatch.route,
    reductionFailure: dispatch.reductionFailure,
    artifacts,
    expectedSources: sources
  });
  return Object.freeze({ ...built, artifacts });
}

function manifestFor(config, loaded, closure, packet, dispatch, includedItemIds, omittedItemIds) {
  const included = new Set(includedItemIds);
  const artifacts = [...loaded.sourcesByItemId.values()]
    .filter((entry) => included.has(entry.item.itemId))
    .map((entry) => ({ artifactId: entry.binding.artifactId, bytes: Buffer.from(entry.bytes) }));
  const built = buildOfflineDispatchManifestV1({
    invocationId: dispatch.invocationId,
    threadId: config.threadId,
    phase: config.phase,
    round: dispatch.round,
    purpose: dispatch.purpose,
    route: dispatch.route,
    reductionFailure: dispatch.reductionFailure,
    requestedItemIds: closure.requestedItemIds,
    includedItemIds,
    omittedItemIds,
    artifacts,
    packetBytes: Buffer.from(packet.packetBytes)
  });
  parseOfflineDispatchManifestV1(built.manifestBytes, {
    expectedDispatchManifestSha256: built.dispatchManifestSha256
  });
  return built;
}

function benchmarkArm(identity, manifest, packet) {
  return {
    ...identity,
    dispatchManifestSha256: manifest.dispatchManifestSha256,
    manifestBytes: Buffer.from(manifest.manifestBytes),
    packetSha256: packet.binding.packetSha256,
    packetBytes: Buffer.from(packet.packetBytes)
  };
}

function expectedMemory(replay) {
  return {
    itemMapSha256: replay.itemMapSha256,
    includedItemIds: replay.closure.includedItemIds,
    omittedItemIds: replay.closure.omittedItemIds,
    full: replay.full,
    reduced: replay.reduced,
    reportSha256: replay.reportSha256
  };
}

function verifyExpectedMemory(config, replay) {
  verifyExpectedClosure(config, replay);
  assert.deepEqual(expectedMemory(replay), config.expected, 'memory replay evidence drift');
}

export function replayMemory({ configRelativePath = MEMORY_CONFIG, verifyExpected = true } = {}) {
  const loadedConfig = readConfig(configRelativePath, 'kstack-kcrp-offline-byte-replay-config-v1');
  const { config } = loadedConfig;
  verifyLimits(config, true);
  const loaded = loadSources(config);
  const closureReplay = buildClosure(config, loaded);
  if (closureReplay.closure.route !== 'reduced' || closureReplay.closure.reductionFailure !== null) {
    fail('memory closure did not qualify for reduction');
  }
  const identities = digestFraming(config.identityFraming, verifyExpected);
  const objective = loaded.sourcesByItemId.get(config.objectiveItemId);
  if (!objective) fail('objective item missing');
  const benchmarkIdentity = Object.freeze({
    objectiveSha256: objective.binding.sha256,
    phase: config.phase,
    reviewerSha256: identities.reviewerSha256,
    governanceSha256: identities.governanceSha256
  });

  const allItemIds = loaded.items.map(({ itemId }) => itemId);
  const fullPacket = packetFor(config, loaded, allItemIds, config.dispatch.full);
  const reducedPacket = packetFor(config, loaded, closureReplay.closure.includedItemIds, config.dispatch.reduced);
  const fullManifest = manifestFor(config, loaded, closureReplay.closure, fullPacket, config.dispatch.full, allItemIds, []);
  const reducedManifest = manifestFor(
    config, loaded, closureReplay.closure, reducedPacket, config.dispatch.reduced,
    closureReplay.closure.includedItemIds, closureReplay.closure.omittedItemIds
  );
  const fullReviewInput = frameReviewInputV1({
    purpose: fullManifest.manifest.purpose,
    route: fullManifest.manifest.route,
    reductionFailure: fullManifest.manifest.reductionFailure,
    manifest: fullManifest.manifest,
    packet: fullPacket.packetBytes
  });
  const reducedReviewInput = frameReviewInputV1({
    purpose: reducedManifest.manifest.purpose,
    route: reducedManifest.manifest.route,
    reductionFailure: reducedManifest.manifest.reductionFailure,
    manifest: reducedManifest.manifest,
    packet: reducedPacket.packetBytes
  });
  const benchmarkInput = {
    benchmarkId: config.benchmark.benchmarkId,
    ...benchmarkIdentity,
    pairs: [{
      pairId: config.benchmark.pairId,
      full: benchmarkArm(benchmarkIdentity, fullManifest, fullPacket),
      treatment: benchmarkArm(benchmarkIdentity, reducedManifest, reducedPacket)
    }]
  };
  const first = runOfflineKcrpByteBenchmarkV1(benchmarkInput);
  const second = runOfflineKcrpByteBenchmarkV1({
    ...benchmarkInput,
    pairs: benchmarkInput.pairs.map((pair) => ({
      pairId: pair.pairId,
      full: { ...pair.full, manifestBytes: Buffer.from(pair.full.manifestBytes), packetBytes: Buffer.from(pair.full.packetBytes) },
      treatment: { ...pair.treatment, manifestBytes: Buffer.from(pair.treatment.manifestBytes), packetBytes: Buffer.from(pair.treatment.packetBytes) }
    }))
  });
  assert.equal(first.reportBytes.equals(second.reportBytes), true, 'benchmark replay is not byte-identical');

  const replay = Object.freeze({
    ...loadedConfig,
    itemMapSha256: closureReplay.itemMapSha256,
    closure: closureReplay.closure,
    identities: Object.freeze({ objectiveSha256: objective.binding.sha256, ...identities }),
    full: Object.freeze({
      packetBytes: fullPacket.packetBytes.length,
      packetSha256: fullPacket.binding.packetSha256,
      manifestBytes: fullManifest.manifestBytes.length,
      manifestSha256: fullManifest.dispatchManifestSha256
    }),
    reduced: Object.freeze({
      packetBytes: reducedPacket.packetBytes.length,
      packetSha256: reducedPacket.binding.packetSha256,
      manifestBytes: reducedManifest.manifestBytes.length,
      manifestSha256: reducedManifest.dispatchManifestSha256
    }),
    trialArms: Object.freeze({
      A: Object.freeze({
        reviewInput: Buffer.from(fullReviewInput.reviewInput),
        reviewInputDigest: fullReviewInput.reviewInputSha256,
        packetDigest: fullPacket.binding.packetSha256,
        manifestDigest: fullManifest.dispatchManifestSha256
      }),
      B3: Object.freeze({
        reviewInput: Buffer.from(reducedReviewInput.reviewInput),
        reviewInputDigest: reducedReviewInput.reviewInputSha256,
        packetDigest: reducedPacket.binding.packetSha256,
        manifestDigest: reducedManifest.dispatchManifestSha256
      })
    }),
    report: first.report,
    reportBytes: first.reportBytes,
    reportSha256: first.reportSha256
  });
  if (verifyExpected) verifyExpectedMemory(config, replay);
  return replay;
}

export function replayEcr({ configRelativePath = ECR_CONFIG, verifyExpected = true } = {}) {
  const loadedConfig = readConfig(configRelativePath, 'kstack-kcrp-ecr-closure-replay-config-v1');
  const { config } = loadedConfig;
  verifyLimits(config, false);
  const loaded = loadSources(config);
  const closureReplay = buildClosure(config, loaded);
  if (closureReplay.closure.route !== 'reduced' || closureReplay.closure.reductionFailure !== null) {
    fail('ECR closure did not validate');
  }
  const replay = Object.freeze({
    ...loadedConfig,
    itemMapSha256: closureReplay.itemMapSha256,
    closure: closureReplay.closure,
    reducedArmAvailable: closureReplay.closure.omittedItemIds.length > 0
  });
  if (verifyExpected) verifyExpectedClosure(config, replay);
  return replay;
}

function aggregateMemory(replay) {
  return {
    configSha256: replay.configSha256,
    canonicalConfigSha256: replay.canonicalConfigSha256,
    itemMapSha256: replay.itemMapSha256,
    objectiveSha256: replay.identities.objectiveSha256,
    reviewerSha256: replay.identities.reviewerSha256,
    governanceSha256: replay.identities.governanceSha256,
    closure: {
      requestedCount: replay.closure.requestedItemIds.length,
      includedCount: replay.closure.includedItemIds.length,
      omittedCount: replay.closure.omittedItemIds.length,
      route: replay.closure.route
    },
    full: replay.full,
    reduced: replay.reduced,
    benchmark: {
      reportSha256: replay.reportSha256,
      status: replay.report.status,
      reason: replay.report.reason,
      pairCount: replay.report.pairCount,
      outcomeCounts: replay.report.outcomeCounts,
      full: replay.report.full,
      treatment: replay.report.treatment,
      savings: replay.report.savings,
      providerUsage: replay.report.providerUsage,
      providerClaims: replay.report.providerClaims
    }
  };
}

function aggregateEcr(replay) {
  return {
    configSha256: replay.configSha256,
    canonicalConfigSha256: replay.canonicalConfigSha256,
    itemMapSha256: replay.itemMapSha256,
    closure: {
      requestedCount: replay.closure.requestedItemIds.length,
      includedCount: replay.closure.includedItemIds.length,
      omittedCount: replay.closure.omittedItemIds.length,
      route: replay.closure.route,
      reducedArmAvailable: replay.reducedArmAvailable
    }
  };
}

export function replayAll({ verifyExpected = true } = {}) {
  const memory = replayMemory({ verifyExpected });
  const ecr = replayEcr({ verifyExpected });
  const report = Object.freeze({
    schemaVersion: 1,
    kind: 'kstack-kcrp-offline-byte-replay-evidence-v1',
    boundary: 'OFFLINE_SUBSET_ONLY',
    dispatchAuthority: 'NONE',
    replayRuns: 2,
    replayByteIdentical: true,
    memory: aggregateMemory(memory),
    ecr: aggregateEcr(ecr),
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
  return Object.freeze({ report, reportBytes, reportSha256: bytesSha256(reportBytes) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === HELPER_PATH) {
  const replay = replayAll({ verifyExpected: true });
  process.stdout.write(replay.reportBytes);
  process.stdout.write('\n');
}
