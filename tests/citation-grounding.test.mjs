import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDecisionPacket,
  evaluateGroundingOverlay,
  frameDecisionPacket,
  parseDecisionPacket,
  sha256,
  verifyDecisionPacket
} from '../plugins/kstack/scripts/kstack-citation-grounding.mjs';
import {
  CANONICAL_EXHAUSTION_POLICY,
  OPEN_PROFILE_EXCEPTIONS,
  PLATFORM_DETAILS,
  STATE_NOT_QUALIFIED_DETAILS,
  STAGE_ONE_TOKENS,
  TOP_LEVEL_REASONS,
  authenticateStateRecordV1,
  canonicalJson,
  canonicalExhaustionPredicate,
  classifyInstanceKeyStoreV1,
  createStateMacTelemetryV1,
  formatOrdinaryAdvisoryLine,
  nextSmokeCycleCountersV1,
  parseCanonicalStateRecordV2,
  readCitationGroundingModeSelectorV1,
  signStateRecordV1,
  stageOneAdvisoryPrefilterV1
} from '../plugins/kstack/scripts/kstack-citation-state.mjs';
import { runCitationShadowV1, runCitationSmokeV1 } from '../plugins/kstack/scripts/kstack-citation-runtime.mjs';
import { runDualReview } from '../plugins/kstack/scripts/kstack-dual-review.mjs';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import { verifyCitationNativeManifestV1 } from '../plugins/kstack/scripts/kstack-citation-native.mjs';
import { evaluateDesignGate } from '../plugins/kstack/scripts/kstack-design-gate.mjs';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the narrow mode selector returns only its closed outcomes and rejects a symlink', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-mode-selector-'));
  const configDirectory = path.join(root, '.kstack');
  const config = path.join(configDirectory, 'config.json');
  fs.mkdirSync(configDirectory);
  assert.equal(readCitationGroundingModeSelectorV1(root), 'legacy-off');
  fs.writeFileSync(config, '{"workflow":{"designGate":{"citationGrounding":"advisory"}}}');
  assert.equal(readCitationGroundingModeSelectorV1(root), 'candidate-advisory');
  fs.writeFileSync(config, '{not json');
  assert.equal(readCitationGroundingModeSelectorV1(root), 'invalid');
  fs.unlinkSync(config);
  fs.symlinkSync('/dev/null', config);
  assert.equal(readCitationGroundingModeSelectorV1(root), 'invalid');
});

function packetFixture() {
  return buildDecisionPacket([
    { sourceId: 'SRC-DESIGN', label: 'Design', role: 'design-under-review', inclusion: 'full', content: Buffer.from('\uFEFFLine one.\r\nGrounded fact.\r') },
    { sourceId: 'SRC-CHECKS', label: 'Checks', role: 'checks-artifact', inclusion: 'full', content: Buffer.from('check: pass\n') }
  ]);
}

function reviewFixture(quotedText = 'Grounded fact.', sourceId = 'SRC-DESIGN') {
  return {
    decision: 'approve',
    confidence: 95,
    failedChecks: [],
    securityFindings: [],
    materialDissent: [],
    recommendation: { text: 'Proceed with the stated control.', groundKind: 'assertion' },
    strongestObjection: { text: 'No substantive objection identified.', groundKind: 'absence' },
    unresolvedQuestions: [],
    citations: [{ id: 'CIT-1', target: { field: 'recommendation' }, sourceId, claim: 'The packet states the fact.', quotedText }]
  };
}

test('packet canonicalization, serialization, independent parsing, and binding round-trip', () => {
  const packet = packetFixture();
  const verified = verifyDecisionPacket(packet.packetBytes, packet.binding);
  assert.equal(verified.sources[0].content.toString(), 'Line one.\nGrounded fact.\n');
  assert.deepEqual(parseDecisionPacket(packet.packetBytes).sources.map((source) => source.sourceId), ['SRC-DESIGN', 'SRC-CHECKS']);
  const tamperedBinding = structuredClone(packet.binding);
  tamperedBinding.sources[0].contentByteStart += 1;
  assert.throws(() => verifyDecisionPacket(packet.packetBytes, tamperedBinding), { code: 'PACKET_METADATA_MISMATCH' });
});

test('grounding matches only exact source content, not record metadata or another claimed file', () => {
  const packet = packetFixture();
  const verified = verifyDecisionPacket(packet.packetBytes, packet.binding);
  const good = evaluateGroundingOverlay(reviewFixture(), verified);
  assert.equal(good.anchorVerified, 1);
  assert.equal(good.wouldBlock, 0);

  const metadataOnly = evaluateGroundingOverlay(reviewFixture('Design'), verified);
  assert.equal(metadataOnly.anchorVerified, 0, 'a source label is not citable content');
  assert.ok(metadataOnly.outcomes.some((outcome) => outcome.code === 'GROUNDING_QUOTE_NOT_FOUND'));

  const fabricated = evaluateGroundingOverlay(reviewFixture('Grounded fact.', 'SRC-NOT-A-FILE'), verified);
  assert.equal(fabricated.anchorVerified, 0);
  assert.ok(fabricated.outcomes.some((outcome) => outcome.code === 'GROUNDING_SOURCE_NOT_FOUND'));
});

test('framing retries collisions and fails after the bounded 32 attempts', () => {
  const packet = packetFixture();
  const collidingToken = 'A'.repeat(64);
  const collisionBytes = Buffer.concat([packet.packetBytes, Buffer.from(`<<<KSTACK:PACKET:BEGIN:${collidingToken}>>>`)]);
  const framed = frameDecisionPacket(collisionBytes, (counter) => counter === 0 ? collidingToken : 'B'.repeat(64));
  assert.equal(framed.counter, 1);
  assert.throws(() => frameDecisionPacket(collisionBytes, () => collidingToken), { code: 'PACKET_FRAME_COLLISION_EXHAUSTED' });
});

function stateFixture(overrides = {}) {
  return {
    stateSchemaVersion: 'kstack-citation-state-v2',
    deploymentFingerprint: 'f'.repeat(64),
    platformReceiptBinding: {},
    localGateInstanceIdBinding: {},
    stateGeneration: 7,
    mutationInProgress: null,
    smoke: {
      result: 'fail',
      smokeStartsThisCycle: 3,
      attemptOrdinal: 3,
      startedAt: '2026-08-01T00:00:00.000Z',
      completedAt: '2026-08-02T00:00:00.000Z'
    },
    shadow: { judgment: 'not_run', completedAt: null },
    advisoryRunsSinceGo: 50,
    ...overrides
  };
}

function authenticate(record, key = Buffer.alloc(16, 7)) {
  return authenticateStateRecordV1(signStateRecordV1(record, key), key);
}

test('the one canonical exhaustion predicate requires all four legs and authenticated state', () => {
  assert.equal(CANONICAL_EXHAUSTION_POLICY.name, 'Canonical Exhaustion Predicate');
  const before = new Date('2026-08-15T23:59:59.999Z');
  const boundary = new Date('2026-08-16T00:00:00.000Z');
  const base = stateFixture();
  assert.equal(canonicalExhaustionPredicate(authenticate(base), 'f'.repeat(64), before), true);
  assert.equal(canonicalExhaustionPredicate(authenticate(base), '0'.repeat(64), before), false);
  assert.equal(canonicalExhaustionPredicate(authenticate(stateFixture({ smoke: { ...base.smoke, smokeStartsThisCycle: 2 } })), 'f'.repeat(64), before), false);
  assert.equal(canonicalExhaustionPredicate(authenticate(stateFixture({ smoke: { ...base.smoke, result: 'pass' } })), 'f'.repeat(64), before), false);
  assert.equal(canonicalExhaustionPredicate(authenticate(base), 'f'.repeat(64), boundary), false);
  assert.equal(canonicalExhaustionPredicate({ status: 'authenticated', record: base }, 'f'.repeat(64), before), false, 'raw or forged wrappers have no authority');
  assert.throws(() => nextSmokeCycleCountersV1(authenticate(base), 'f'.repeat(64), before), { code: 'SMOKE_ATTEMPTS_EXHAUSTED' });
  assert.deepEqual(nextSmokeCycleCountersV1(authenticate(base), 'f'.repeat(64), boundary), {
    smokeStartsThisCycle: 1,
    attemptOrdinal: 1,
    stateGeneration: 8
  });
});

test('MAC failure is authenticated absence for exhaustion and successor counts', () => {
  const key = Buffer.alloc(16, 9);
  const signed = signStateRecordV1(stateFixture(), key);
  signed.stateRecordMac = '0'.repeat(64);
  const failed = authenticateStateRecordV1(signed, key);
  assert.deepEqual(failed, { status: 'authenticated-absence', macInvalid: true });
  assert.equal(canonicalExhaustionPredicate(failed, 'f'.repeat(64), new Date('2026-08-03T00:00:00.000Z')), false);
  assert.deepEqual(nextSmokeCycleCountersV1(failed, 'f'.repeat(64), new Date('2026-08-03T00:00:00.000Z')), {
    smokeStartsThisCycle: 1,
    attemptOrdinal: 1,
    stateGeneration: 1
  });
});

test('MAC-verifying reads count each failure but emit one payload-free event per command', () => {
  const key = Buffer.alloc(16, 5);
  const signed = signStateRecordV1(stateFixture(), key);
  signed.stateRecordMac = '0'.repeat(64);
  const telemetry = createStateMacTelemetryV1();
  authenticateStateRecordV1(signed, key, { telemetry });
  authenticateStateRecordV1(signed, key, { telemetry });
  assert.equal(telemetry.stateMacVerificationFailures, 2);
  assert.deepEqual(telemetry.eventLines, ['CITATION_GROUNDING_STATE_MAC_INVALID']);
});

test('owned raw and derived key buffers are zero-filled on success and failure', () => {
  const observations = [];
  const key = Buffer.alloc(16, 3);
  signStateRecordV1(stateFixture(), key, { onZeroize: (name, buffer) => observations.push([name, [...buffer]]) });
  assert.deepEqual(observations.map(([name]) => name).sort(), ['K', 'Kstate']);
  assert.ok(observations.every(([, bytes]) => bytes.every((byte) => byte === 0)));
  assert.ok(key.every((byte) => byte === 3), 'the caller-owned key is not silently mutated');
  assert.throws(() => signStateRecordV1({ bad: -1 }, key, { onZeroize: (name, buffer) => observations.push([name, [...buffer]]) }), { code: 'STATE_CANONICAL_JSON_INVALID' });
  assert.ok(observations.at(-1)[1].every((byte) => byte === 0));
});

test('strict v2 state reader enforces the exact ten-member canonical record', () => {
  const key = Buffer.alloc(16, 4);
  const receipt = {
    bindingVersion: 'kstack-platform-receipt-state-binding-v1', receiptEncodingVersion: 'kstack-receipt-binding-v1',
    receiptDigestVersion: 'kstack-receipt-binding-digest-v1', receiptDigest: '1'.repeat(64),
    preconditionVersion: 'kstack-citation-filesystem-precondition-v1',
    nativeAddonBinding: { abiVersion: 'kstack-citation-fs-native-abi-v2', artifactDigest: '2'.repeat(64), packageName: '@kstack/citation-fs-native', packageVersion: '1.0.0', targetTriple: 'linux-x64-gnu' },
    stateDirectoryPath: '/tmp/state', stateDirectoryDevice: '1', filesystemType: 'linux-ext',
    buildCacheRoot: '/tmp/cache', buildCacheDevice: '1', buildCacheFilesystemType: 'linux-ext'
  };
  const record = signStateRecordV1({
    stateSchemaVersion: 'kstack-citation-state-v2', deploymentFingerprint: '3'.repeat(64), platformReceiptBinding: receipt,
    localGateInstanceIdBinding: { bindingVersion: 'kstack-local-gate-instance-binding-v1', instanceIdDigest: '4'.repeat(64) },
    stateGeneration: 1, mutationInProgress: null,
    smoke: { result: 'not_run', smokeStartsThisCycle: 1, attemptOrdinal: 1, fixtureHash: '5'.repeat(64), startedAt: '2026-08-23T00:00:00.000Z', completedAt: null, providerResultHashes: [null, null], providerStructuralCompleteness: [false, false], providerExactMatchCounts: [0, 0], combinedExactMatchCount: 0, providerOrdinaryProseMismatchCounts: [0, 0], combinedOrdinaryProseMismatchCount: 0 },
    shadow: { judgment: 'not_run', dualRuns: 0, reasonCodes: [], completedAt: null }, advisoryRunsSinceGo: 0
  }, key);
  const bytes = Buffer.from(canonicalJson(record));
  assert.equal(Object.keys(parseCanonicalStateRecordV2(bytes)).length, 10);
  assert.throws(() => parseCanonicalStateRecordV2(Buffer.from(JSON.stringify({ ...record, unexpected: true }))), { code: 'STATE_MALFORMED' });
  assert.throws(() => parseCanonicalStateRecordV2(Buffer.from(`${bytes}\n`)), { code: 'STATE_MALFORMED' });
});

test('the checked-in native manifest pins the exact vendored node-gyp 11.4.2 closure', () => {
  const verified = verifyCitationNativeManifestV1(path.join(repositoryRoot, 'plugins', 'kstack'));
  assert.equal(verified.manifest.nodeGypVersion, '11.4.2');
  assert.equal(JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'plugins', 'kstack', 'vendor', 'node-gyp-11.4.2', 'package.json'))).version, '11.4.2');
  assert.ok(verified.manifest.files.filter((entry) => entry.role === 'node-gyp-vendor').length > 1000);
});

test('stage one is reject-only and emits no authentication or tamper signal', () => {
  const result = stageOneAdvisoryPrefilterV1(stateFixture(), new Date('2026-08-03T00:00:00.000Z'));
  assert.equal(result.token, 'STATE_RUN_LIMIT_REACHED');
  assert.deepEqual(result.telemetry, { stateMacVerificationFailures: 0, macInvalidEvent: false });
});

test('ordinary advisory emission is total for the six top-level reasons', () => {
  assert.deepEqual(TOP_LEVEL_REASONS, ['LOCK_CONTENTION', 'PLATFORM_PRECONDITION_FAILED', 'STATE_MALFORMED', 'STATE_EXPIRED', 'STATE_RUN_LIMIT_REACHED', 'STATE_NOT_QUALIFIED']);
  for (const token of STAGE_ONE_TOKENS) assert.equal(formatOrdinaryAdvisoryLine({ stageOneToken: token }), `CITATION_GROUNDING_ADVISORY_INACTIVE ${token}`);
  for (const detail of PLATFORM_DETAILS) {
    const expected = detail === 'NATIVE_ADDON_UNAVAILABLE'
      ? 'CITATION_GROUNDING_ADVISORY_UNAVAILABLE NATIVE_ADDON_UNAVAILABLE'
      : `CITATION_GROUNDING_ADVISORY_UNAVAILABLE PLATFORM_PRECONDITION_FAILED ${detail}`;
    assert.equal(formatOrdinaryAdvisoryLine({ reason: 'PLATFORM_PRECONDITION_FAILED', detail }), expected);
  }
  for (const detail of STATE_NOT_QUALIFIED_DETAILS) {
    assert.equal(formatOrdinaryAdvisoryLine({ reason: 'STATE_NOT_QUALIFIED', detail }), `CITATION_GROUNDING_ADVISORY_INACTIVE STATE_NOT_QUALIFIED ${detail}`);
  }
  assert.equal(formatOrdinaryAdvisoryLine({ reason: 'STATE_MALFORMED' }), 'CITATION_GROUNDING_ADVISORY_INACTIVE STATE_MALFORMED');
  assert.equal(formatOrdinaryAdvisoryLine({ reason: 'PLATFORM_PRECONDITION_FAILED', detail: 'LOCAL_INSTANCE_STORE_UNAVAILABLE' }), 'CITATION_GROUNDING_ADVISORY_UNAVAILABLE PLATFORM_PRECONDITION_FAILED LOCAL_INSTANCE_STORE_UNAVAILABLE');
  assert.equal(formatOrdinaryAdvisoryLine({ reason: 'PLATFORM_PRECONDITION_FAILED', detail: 'NATIVE_ADDON_UNAVAILABLE' }), 'CITATION_GROUNDING_ADVISORY_UNAVAILABLE NATIVE_ADDON_UNAVAILABLE');
  assert.equal(formatOrdinaryAdvisoryLine({ reason: 'LOCK_CONTENTION' }), 'CITATION_GROUNDING_ADVISORY_UNAVAILABLE LOCK_CONTENTION');
  assert.equal(formatOrdinaryAdvisoryLine({ reason: 'STATE_EXPIRED' }), 'CITATION_GROUNDING_ADVISORY_INACTIVE STATE_EXPIRED');
  assert.equal(formatOrdinaryAdvisoryLine({ reason: 'STATE_RUN_LIMIT_REACHED' }), 'CITATION_GROUNDING_ADVISORY_INACTIVE STATE_RUN_LIMIT_REACHED');
  assert.equal(formatOrdinaryAdvisoryLine({ reason: 'STATE_NOT_QUALIFIED', detail: 'FINGERPRINT_MISMATCH' }), 'CITATION_GROUNDING_ADVISORY_INACTIVE STATE_NOT_QUALIFIED FINGERPRINT_MISMATCH');
  assert.equal(formatOrdinaryAdvisoryLine({ stageOneToken: 'QUALIFICATION_ABSENT' }), 'CITATION_GROUNDING_ADVISORY_INACTIVE QUALIFICATION_ABSENT');
});

test('the post-addon procfs profile is the fourth exhaustive exception and key-store type is descriptor-bound', { skip: process.platform !== 'linux' }, () => {
  assert.deepEqual(OPEN_PROFILE_EXCEPTIONS, [
    'readCitationGroundingModeSelectorV1',
    'kstack-citation-native-bootstrap-open-v1',
    'kstack-citation-coordinator-heartbeat-v1',
    'kstack-citation-instance-store-procfs-v1'
  ]);
  const directory = fs.openSync(os.tmpdir(), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
  const ancestorFilesystemType = fs.statfsSync(os.tmpdir(), { bigint: true }).type;
  const statfsPaths = [];
  const fsImpl = {
    ...fs,
    constants: fs.constants,
    statfsSync(candidate, options) {
      statfsPaths.push(candidate);
      return fs.statfsSync(candidate, options);
    }
  };
  let ancestorCalls = 0;
  const addon = {
    inspectDirectoryFd(fd) {
      const stats = fs.fstatSync(fd, { bigint: true });
      const isAncestor = fd === directory;
      if (isAncestor) ancestorCalls += 1;
      return {
        abiVersion: 'kstack-citation-fs-native-abi-v2',
        platform: 'linux',
        pathRaw: fs.realpathSync(os.tmpdir()),
        deviceId: stats.dev,
        fileIdentity: stats.ino,
        filesystemTypeRaw: isAncestor ? ancestorFilesystemType : 0x00009fa0n
      };
    }
  };
  try {
    const result = classifyInstanceKeyStoreV1({ addon, heldAncestorFd: directory, fsImpl });
    assert.equal(ancestorCalls, 2);
    assert.deepEqual(statfsPaths, ['/proc'], 'pathname statfs is authorized only for the redundant procfs authenticity sample');
    assert.equal(result.noexecIgnoredForDataRole, true);
    assert.ok(result.filesystemType.startsWith('linux-'));
  } finally {
    fs.closeSync(directory);
  }
});

test('actual dual-review entry point wires smoke, shadow, authenticated reservation, protected staging, joint activation, v2 packet, and evaluator end to end', { skip: process.platform !== 'linux' }, async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-citation-e2e-'));
  fs.mkdirSync(path.join(project, '.kstack'));
  const config = structuredClone(defaultConfig);
  config.project.name = 'citation-e2e';
  config.workflow.designGate.citationGrounding = 'advisory';
  delete config.workflow.designGate.reviewSequence;
  delete config.workflow.designGate.secondaryReview;
  config.models.codex.command = process.execPath;
  config.models.codex.args = [path.join(repositoryRoot, 'tests', 'fixtures', 'fake-codex.mjs')];
  config.models.opus.command = process.execPath;
  config.models.opus.args = [path.join(repositoryRoot, 'tests', 'fixtures', 'fake-claude.mjs')];
  config.models.codex.timeoutSeconds = 5;
  config.models.opus.timeoutSeconds = 5;
  const configFile = path.join(project, '.kstack', 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
  const configBytes = fs.readFileSync(configFile);
  const key = Buffer.alloc(16, 0x5a);
  let nativeInspections = 0;
  const nativeContext = {
    addon: {
      inspectDirectoryFd(fd) {
        nativeInspections += 1;
        const stat = fs.fstatSync(fd, { bigint: true });
        return { abiVersion: 'kstack-citation-fs-native-abi-v2', platform: 'linux', pathRaw: fs.realpathSync(`/proc/self/fd/${fd}`), deviceId: stat.dev, fileIdentity: stat.ino, filesystemTypeRaw: fs.statfsSync(`/proc/self/fd/${fd}`, { bigint: true }).type };
      }
    },
    buildCacheRoot: project,
    buildCacheDevice: fs.statSync(project, { bigint: true }).dev.toString(),
    buildCacheFilesystemType: 'linux-ext',
    nativeAddonBinding: { abiVersion: 'kstack-citation-fs-native-abi-v2', artifactDigest: 'a'.repeat(64), packageName: '@kstack/citation-fs-native', packageVersion: '1.0.0', targetTriple: 'linux-x64-gnu' }
  };
  const runtime = {
    nativeContext, instanceKey: key, gitProof: true,
    authorizedProviders: ['codex', 'opus'].map((providerId) => ({
      providerId, executablePath: process.execPath, canonicalCwd: project,
      argv: [...config.models[providerId].args], cliSdkVersion: process.version,
      executableDigest: 'b'.repeat(64)
    }))
  };
  const missingPrompt = path.join(project, 'missing-state.md');
  fs.writeFileSync(missingPrompt, 'Legacy-only before qualification.');
  const diagnostics = [];
  const missing = await runDualReview({ projectRoot: project, promptFile: missingPrompt, outDir: path.join(project, 'missing-review'), citationRuntimeOptions: runtime, onCitationDiagnostic(line) { diagnostics.push(line); } });
  assert.equal(missing.citationGroundingEffectiveRoute, 'legacy_direct');
  assert.deepEqual(diagnostics, ['CITATION_GROUNDING_ADVISORY_INACTIVE STATE_NOT_QUALIFIED']);
  assert.equal(nativeInspections, 0, 'stage-one rejection must not touch the native boundary');

  const now = new Date();
  const smoke = await runCitationSmokeV1({
    projectRoot: project, config, configBytes, fixtureBytes: Buffer.from('{"fixture":"e2e"}'), now, ...runtime,
    async runProviders() {
      return [0, 1].map((index) => ({ rawBytes: Buffer.from(`provider-${index}-perfect`), structurallyComplete: true, exactMatchCount: 50, ordinaryProseMismatchCount: 0 }));
    }
  });
  assert.equal(smoke.status, 'pass');
  const shadow = await runCitationShadowV1({ projectRoot: project, config, configBytes, dualRuns: 5, judgment: 'go', reasonCodes: ['no_material_loss'], now, ...runtime, async runRepresentative() {} });
  assert.equal(shadow.status, 'go');

  const promptFile = path.join(project, 'decision.md');
  fs.copyFileSync(path.join(repositoryRoot, 'tests', 'fixtures', 'valid-10k-design.md'), promptFile);
  const outDir = path.join(project, 'review');
  const manifest = await runDualReview({ projectRoot: project, promptFile, outDir, citationRuntimeOptions: runtime, onCitationDiagnostic() {} });
  assert.equal(manifest.citationGroundingEffectiveRoute, 'grounding_v2');
  assert.equal(manifest.citationGroundingMode, 'advisory');
  assert.equal(manifest.citationGroundingJointActivation, 'committed');
  assert.equal(manifest.providers.codex.route, 'grounding_v2');
  assert.equal(manifest.providers.opus.route, 'grounding_v2');
  for (const reviewer of ['codex', 'opus']) assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, `${reviewer}.json`))).schemaVersion, 2);
  const persisted = parseCanonicalStateRecordV2(fs.readFileSync(path.join(project, '.kstack', 'state', 'citation-grounding-v1.json')));
  assert.equal(persisted.advisoryRunsSinceGo, 1, 'the ordinary run is durably reserved before provider dispatch');
  assert.equal(authenticateStateRecordV1(persisted, key).status, 'authenticated');
  assert.ok(nativeInspections >= 3, 'smoke, shadow, and ordinary stage two crossed the native path');
  const checksFile = path.join(project, 'checks.json');
  fs.writeFileSync(checksFile, JSON.stringify({ schemaVersion: 1, designDigest: sha256(fs.readFileSync(promptFile)), checks: config.workflow.designGate.requiredChecks.map((id) => ({ id, status: 'pass', evidence: 'e2e fixture' })) }));
  const gate = evaluateDesignGate({ designFile: promptFile, reviewDir: outDir, checksFile, configFile });
  assert.equal(gate.status, 'READY_FOR_USER_APPROVAL');
  assert.equal(gate.citationGrounding.anchorVerified, 2);
  assert.equal(gate.citationGrounding.citationFailed, 0);
  assert.equal(gate.citationGrounding.wouldBlock, 0);
});
