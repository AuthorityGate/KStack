import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  artifactHead,
  hostAddress,
  hostCanonicalBytes,
  validateHostArtifact
} from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  EVIDENCE_IDENTITIES,
  ProtectedEvidenceKernel,
  assertEvidenceActionHandoff,
  collectEnvironmentSnapshot,
  createTestProtectedEvidenceBackend,
  evidenceAnchorTranscript,
  evidenceHead,
  exportEd25519PublicKey,
  protectedAdministrationTranscript,
  rootTransitionStatementDigest,
  selectHostEvidence,
  signEvidenceAnchor,
  validateEvidenceTrustRoot,
  verifyEvidenceRootTransition,
  validateHostConformanceEvidenceClosure
} from '../plugins/kstack/scripts/kstack-host-evidence.mjs';

const D = (value) => hostAddress('KSTACK-TEST-V1', { value });
const SCHEMA_SET = D('schema-set');
const BODY_SCHEMA = D('body-schema');
const PRODUCER = D('producer');
const OBSERVER_IMPLEMENTATION = D('observer-implementation');
const OBSERVERS = hostAddress('KSTACK-EVIDENCE-OBSERVER-PROFILE-SET-V1', {
  observerImplementationDigests: [OBSERVER_IMPLEMENTATION]
});
const VOCABULARY = Object.freeze({ capabilityIds: ['cap.a'], fixtureIds: ['fixture.a'] });
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-contract-reference/Cargo.toml', import.meta.url));

function keyPair() {
  const pair = crypto.generateKeyPairSync('ed25519');
  return { ...pair, publicEncoded: exportEd25519PublicKey(pair.publicKey) };
}

function rootFixture() {
  const admins = [keyPair(), keyPair(), keyPair()];
  const signer = keyPair();
  const root = {
    ...evidenceHead('EvidenceTrustRootV1', SCHEMA_SET),
    trustDomainId: 'local.host',
    rootGeneration: 1,
    previousRootDigest: null,
    rootAdminPublicKeys: admins.map((pair, index) => ({ keyId: `admin.${index + 1}`, publicKey: pair.publicEncoded })),
    threshold: 2,
    onlineSignerProfiles: [{
      keyId: 'signer.1',
      publicKey: signer.publicEncoded,
      role: 'host-evidence',
      producerProfileDigests: [PRODUCER],
      allowedEvidenceSchemaDigests: [BODY_SCHEMA],
      maximumEvidenceLifetimeMs: 3_600_000,
      issuanceStart: '2026-08-29T00:00:00.000Z',
      issuanceEnd: '2026-08-30T00:00:00.000Z',
      state: 'ISSUING'
    }],
    evidenceEpoch: 1,
    notBefore: '2026-08-29T00:00:00.000Z',
    notAfter: '2026-08-30T00:00:00.000Z',
    trustedTimeProfileDigest: D('time-profile'),
    transitionProofDigest: null
  };
  return { root, admins, signer };
}

const SNAPSHOT_BINDINGS = Object.freeze({
  hostInstanceDigest: D('host'),
  runningProcessIdentityDigest: D('process'),
  onDiskExecutableIdentityDigest: D('executable'),
  platformKernelDigest: D('kernel'),
  adapterDigest: D('adapter'),
  nativePermissionModeDigest: D('permissions'),
  hostModeDigest: D('host-mode'),
  hostConfigDigest: D('host-config'),
  pluginSetDigest: D('plugins'),
  customToolSetDigest: D('tools'),
  subagentSetDigest: D('subagents'),
  mcpEndpointSetDigest: D('mcp'),
  toolRegistryDigest: D('tool-registry'),
  repositoryRootSetDigest: D('roots'),
  worktreeSetDigest: D('worktrees'),
  mountCaseProfileDigest: D('mount-case'),
  shellWrapperSetDigest: D('shells'),
  formatterLspSetDigest: D('formatters'),
  backgroundFacilitySetDigest: D('background'),
  brokerProfileDigest: D('broker'),
  activeSetDigest: D('active-set'),
  policyDigest: D('policy'),
  observerProfileSetDigest: OBSERVERS,
  secretMeasurementKeyGeneration: 1
});

function environmentSnapshot(overrides = {}) {
  return {
    ...evidenceHead('EnvironmentSnapshotV1', SCHEMA_SET),
    measurementProfileDigest: D('measurement-profile'),
    ...SNAPSHOT_BINDINGS,
    relevantEnvironmentDigest: D('environment-values'),
    measurementSequence: 1,
    measuredAt: '2026-08-29T00:10:00.000Z',
    expiresAt: '2026-08-29T00:20:00.000Z',
    trustedTimeSampleDigest: D('time-sample'),
    ...overrides
  };
}

function evidenceFixture(options = {}) {
  const { root, signer } = options.rootFixture || rootFixture();
  const environment = options.environment || environmentSnapshot();
  const environmentDigest = hostAddress(EVIDENCE_IDENTITIES.EnvironmentSnapshotV1.domain, environment);
  const result = {
    capabilityId: 'cap.a',
    fixtureId: 'fixture.a',
    outcome: options.outcome || 'PASS',
    evidenceDigest: options.resultEvidenceDigest || D(`result-${options.outcome || 'PASS'}`)
  };
  const body = {
    ...artifactHead('HostConformanceEvidenceBodyV1', SCHEMA_SET),
    hostInstanceDigest: SNAPSHOT_BINDINGS.hostInstanceDigest,
    hostBuildDigest: D('host-build'),
    adapterDigest: SNAPSHOT_BINDINGS.adapterDigest,
    harnessDigest: D('harness'),
    fixtureSetDigest: D('fixture-set'),
    environmentDigest,
    results: [result],
    issuedAt: options.issuedAt || '2026-08-29T00:10:00.000Z',
    expiresAt: options.expiresAt || '2026-08-29T00:20:00.000Z'
  };
  const bodyDigest = validateHostArtifact('HostConformanceEvidenceBodyV1', body, { vocabulary: VOCABULARY }).objectDigest;
  const rootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, root);
  const unsignedAnchor = {
    ...evidenceHead('EvidenceAnchorV1', SCHEMA_SET),
    payloadDigest: bodyDigest,
    payloadSchemaDigest: BODY_SCHEMA,
    producerProfileDigest: PRODUCER,
    signerKeyId: 'signer.1',
    signerRole: 'host-evidence',
    trustRootDigest: rootDigest,
    rootGeneration: root.rootGeneration,
    evidenceEpoch: root.evidenceEpoch,
    environmentSnapshotDigest: environmentDigest,
    independentObservationSetDigest: OBSERVERS,
    issuedAt: body.issuedAt,
    expiresAt: body.expiresAt
  };
  const anchor = signEvidenceAnchor(unsignedAnchor, signer.privateKey);
  const anchorDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceAnchorV1.domain, anchor);
  const wrapper = {
    ...artifactHead('HostConformanceEvidenceV1', SCHEMA_SET),
    ...Object.fromEntries(Object.keys(body).filter((key) => !['schemaId', 'schemaVersion', 'schemaSetDigest'].includes(key)).map((key) => [key, body[key]])),
    anchorDigest
  };
  return {
    root, environmentSnapshot: environment, body, anchor, wrapper,
    bodySchemaDigest: BODY_SCHEMA,
    expectedProducerProfileDigest: PRODUCER,
    expectedObserverSetDigest: OBSERVERS,
    currentEvidenceEpoch: root.evidenceEpoch,
    vocabulary: VOCABULARY
  };
}

function requirement() {
  return {
    hostInstanceDigest: SNAPSHOT_BINDINGS.hostInstanceDigest,
    hostBuildDigest: D('host-build'),
    adapterDigest: SNAPSHOT_BINDINGS.adapterDigest,
    fixtureSetDigest: D('fixture-set'),
    producerProfileDigests: [PRODUCER],
    observerProfileSetDigest: OBSERVERS,
    requiredScopes: [{ capabilityId: 'cap.a', fixtureId: 'fixture.a' }],
    activeSetDigest: SNAPSHOT_BINDINGS.activeSetDigest,
    policyDigest: SNAPSHOT_BINDINGS.policyDigest,
    requirementScopeDigest: D('requirement-scope'),
    fixtureScopeDigest: D('fixture-scope'),
    requirementProfileDigest: D('requirement-profile')
  };
}

function signedAdminObject(object, domain, admins) {
  const placeholder = {
    ...object,
    signatures: [
      { keyId: 'admin.1', signature: Buffer.alloc(64).toString('base64url') },
      { keyId: 'admin.2', signature: Buffer.alloc(64).toString('base64url') }
    ]
  };
  const transcript = protectedAdministrationTranscript(domain, placeholder);
  return {
    ...object,
    signatures: admins.slice(0, 2).map((pair, index) => ({
      keyId: `admin.${index + 1}`,
      signature: crypto.sign(null, transcript, pair.privateKey).toString('base64url')
    }))
  };
}

function transitionRows(pairs, prefix, candidate) {
  const transcript = Buffer.concat([
    Buffer.from('KSTACK-EVIDENCE-ROOT-TRANSITION-SIGNATURE-V1', 'ascii'), Buffer.from([0]),
    hostCanonicalBytes(candidate)
  ]);
  return pairs.slice(0, 2).map((pair, index) => ({
    keyId: `${prefix}.${index + 1}`,
    signature: crypto.sign(null, transcript, pair.privateKey).toString('base64url')
  }));
}

test('trust roots require exactly three distinct administrators, threshold two, and disjoint online keys', () => {
  const fixture = rootFixture();
  assert.equal(validateEvidenceTrustRoot(fixture.root).rootGeneration, 1);
  assert.throws(() => validateEvidenceTrustRoot({ ...fixture.root, threshold: 1 }), { code: 'KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID' });
  assert.throws(() => validateEvidenceTrustRoot({
    ...fixture.root,
    onlineSignerProfiles: [{ ...fixture.root.onlineSignerProfiles[0], publicKey: fixture.root.rootAdminPublicKeys[0].publicKey }]
  }), { code: 'KSTACK_EVIDENCE_ROOT_KEY_INVALID' });
  assert.throws(() => validateEvidenceTrustRoot({ ...fixture.root, algorithm: 'negotiable' }), { code: 'KSTACK_EVIDENCE_ROOT_INVALID' });
});

test('root rotation requires two current signatures and two candidate possession proofs', () => {
  const current = rootFixture();
  const next = rootFixture();
  const candidateBase = {
    ...next.root,
    rootGeneration: 2,
    previousRootDigest: hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, current.root),
    rootAdminPublicKeys: next.root.rootAdminPublicKeys.map((entry, index) => ({ ...entry, keyId: `next.${index + 1}` })),
    evidenceEpoch: 2,
    transitionProofDigest: D('placeholder')
  };
  const candidate = { ...candidateBase, transitionProofDigest: rootTransitionStatementDigest(current.root, candidateBase) };
  const authorizations = {
    currentAdminSignatures: transitionRows(current.admins, 'admin', candidate),
    candidateAdminPossessionSignatures: transitionRows(next.admins, 'next', candidate)
  };
  assert.equal(verifyEvidenceRootTransition(current.root, candidate, authorizations).rootGeneration, 2);
  assert.throws(() => verifyEvidenceRootTransition(current.root, candidate, {
    ...authorizations,
    candidateAdminPossessionSignatures: authorizations.candidateAdminPossessionSignatures.slice(0, 1)
  }), { code: 'KSTACK_EVIDENCE_ROOT_THRESHOLD_INVALID' });
});

test('body to signed anchor to wrapper is acyclic, exact, and substitution resistant', () => {
  const fixture = evidenceFixture();
  const closure = validateHostConformanceEvidenceClosure(fixture);
  assert.equal(closure.anchorDigest, fixture.wrapper.anchorDigest);
  assert.throws(() => validateHostConformanceEvidenceClosure({
    ...fixture,
    wrapper: { ...fixture.wrapper, harnessDigest: D('substituted') }
  }), { code: 'KSTACK_EVIDENCE_SCHEMA_INVALID' });
  assert.throws(() => validateHostConformanceEvidenceClosure({
    ...fixture,
    anchor: { ...fixture.anchor, payloadDigest: validateHostArtifact('HostConformanceEvidenceV1', fixture.wrapper, { vocabulary: VOCABULARY }).objectDigest }
  }), { code: 'KSTACK_EVIDENCE_SCOPE_MISMATCH' });
  const tamperedAnchor = {
    ...fixture.anchor,
    signature: `${fixture.anchor.signature[0] === 'A' ? 'B' : 'A'}${fixture.anchor.signature.slice(1)}`
  };
  assert.throws(() => validateHostConformanceEvidenceClosure({
    ...fixture,
    anchor: tamperedAnchor,
    wrapper: { ...fixture.wrapper, anchorDigest: hostAddress(EVIDENCE_IDENTITIES.EvidenceAnchorV1.domain, tamperedAnchor) }
  }), (error) => ['KSTACK_EVIDENCE_SIGNATURE_INVALID', 'KSTACK_EVIDENCE_SIGNATURE_MALFORMED'].includes(error.code));
});

test('lockfile-pinned native Rust independently verifies the exact Ed25519 anchor transcript', () => {
  const fixture = evidenceFixture();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-evidence-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(build.status, 0, build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-contract-reference${process.platform === 'win32' ? '.exe' : ''}`);
    const vector = {
      publicKey: fixture.root.onlineSignerProfiles[0].publicKey,
      signature: fixture.anchor.signature,
      messageHex: evidenceAnchorTranscript(fixture.anchor).toString('hex')
    };
    const accepted = spawnSync(binary, [], { input: JSON.stringify({ ed25519: vector }), encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false });
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(JSON.parse(accepted.stdout), { valid: true });
    const rejected = spawnSync(binary, [], {
      input: JSON.stringify({ ed25519: { ...vector, messageHex: `${vector.messageHex.slice(0, -2)}00` } }),
      encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(rejected.status, 0, rejected.stderr);
    assert.deepEqual(JSON.parse(rejected.stdout), { valid: false });
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('live measurement opens declared sources, HMACs secrets, and rejects ambiguity or replacement', async () => {
  const profile = {
    ...evidenceHead('EnvironmentMeasurementProfileV1', SCHEMA_SET),
    operationProfileDigest: D('operation-profile'),
    hostPlatformDigest: D('platform'),
    selectors: [
      { selectorId: 'config.public', valueKind: 'PUBLIC', mutable: true, mandatory: true, maximumAgeMs: 60_000, maximumBytes: 256, sourceIds: ['source.primary'] },
      { selectorId: 'secret.token', valueKind: 'SECRET', mutable: true, mandatory: true, maximumAgeMs: 30_000, maximumBytes: 256, sourceIds: ['source.primary'] }
    ],
    maximumMeasurementAgeMs: 120_000,
    observerImplementationDigests: [OBSERVER_IMPLEMENTATION],
    activeSetDigest: SNAPSHOT_BINDINGS.activeSetDigest
  };
  const reads = [];
  const sources = {
    'source.primary': {
      async open(selectorId) {
        const identityDigest = D(`identity-${selectorId}`);
        return {
          identityDigest,
          async read() { reads.push(selectorId); return selectorId === 'secret.token' ? 'do-not-persist' : { enabled: true }; },
          async revalidate() { return identityDigest; },
          async close() {}
        };
      }
    }
  };
  const snapshot = await collectEnvironmentSnapshot({
    profile,
    binding: SNAPSHOT_BINDINGS,
    sources,
    timeSample: { sampleDigest: D('time-sample'), wallTime: '2026-08-29T00:10:00.000Z' },
    measurementSequence: 1,
    protectedHmac: async (_generation, bytes) => `sha256:${crypto.createHmac('sha256', 'protected-test-key').update(bytes).digest('hex')}`
  });
  assert.deepEqual(reads, ['config.public', 'secret.token']);
  assert.equal(snapshot.expiresAt, '2026-08-29T00:10:30.000Z');
  assert.doesNotMatch(JSON.stringify(snapshot), /do-not-persist/u);

  const ambiguous = {
    ...profile,
    selectors: [{ ...profile.selectors[0], sourceIds: ['source.primary', 'source.secondary'] }]
  };
  await assert.rejects(() => collectEnvironmentSnapshot({
    profile: ambiguous,
    binding: SNAPSHOT_BINDINGS,
    sources: { ...sources, 'source.secondary': sources['source.primary'] },
    timeSample: { sampleDigest: D('time-sample'), wallTime: '2026-08-29T00:10:00.000Z' },
    measurementSequence: 2,
    protectedHmac: async () => D('hmac')
  }), { code: 'KSTACK_ENVIRONMENT_SOURCE_AMBIGUOUS' });

  await assert.rejects(() => collectEnvironmentSnapshot({
    profile: { ...profile, selectors: [profile.selectors[0]] },
    binding: SNAPSHOT_BINDINGS,
    sources: {
      'source.primary': { async open() { return { identityDigest: D('before'), async read() { return true; }, async revalidate() { return D('after'); } }; } }
    },
    timeSample: { sampleDigest: D('time-sample'), wallTime: '2026-08-29T00:10:00.000Z' },
    measurementSequence: 2,
    protectedHmac: async () => D('hmac')
  }), { code: 'KSTACK_ENVIRONMENT_CHANGED' });
});

test('selection is insertion-order independent and fail-closed for missing, failing, contradictory, stale, and unavailable evidence', () => {
  const shared = rootFixture();
  const pass = evidenceFixture({ rootFixture: shared, resultEvidenceDigest: D('pass-1') });
  const pass2 = evidenceFixture({ rootFixture: shared, resultEvidenceDigest: D('pass-2') });
  const base = {
    requirement: requirement(), root: shared.root, revocations: [], supersessions: [],
    liveEnvironmentSnapshot: pass.environmentSnapshot,
    trustedNow: '2026-08-29T00:11:00.000Z', bodySchemaDigest: BODY_SCHEMA,
    currentEvidenceEpoch: shared.root.evidenceEpoch, vocabulary: VOCABULARY
  };
  const first = selectHostEvidence({ ...base, candidates: [pass, pass2] });
  const reversed = selectHostEvidence({ ...base, candidates: [pass2, pass] });
  assert.equal(first.outcome, 'VALID');
  assert.deepEqual(first, reversed);
  assert.equal(selectHostEvidence({ ...base, candidates: [] }).outcome, 'UNAVAILABLE');
  assert.equal(selectHostEvidence({ ...base, candidates: [evidenceFixture({ rootFixture: shared, outcome: 'FAIL' })] }).outcome, 'INVALID');
  assert.equal(selectHostEvidence({
    ...base, candidates: [pass, evidenceFixture({ rootFixture: shared, outcome: 'FAIL', resultEvidenceDigest: D('fail-2') })]
  }).outcome, 'CONTRADICTORY');
  assert.equal(selectHostEvidence({ ...base, candidates: [pass], trustedNow: '2026-08-29T00:21:00.000Z' }).outcome, 'STALE');
  assert.equal(selectHostEvidence({
    ...base,
    candidates: [evidenceFixture({ rootFixture: shared, outcome: 'HARNESS_ERROR' })]
  }).outcome, 'UNAVAILABLE');
});

test('signed revocation invalidates cached evidence and unsigned supersession cannot hide a failure', () => {
  const shared = rootFixture();
  const pass = evidenceFixture({ rootFixture: shared });
  const rootDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceTrustRootV1.domain, shared.root);
  const revocation = signedAdminObject({
    ...evidenceHead('EvidenceRevocationV1', SCHEMA_SET),
    trustRootDigest: rootDigest,
    rootGeneration: 1,
    revocationSequence: 1,
    revokedKeyDigests: [],
    revokedRootDigests: [],
    revokedProducerDigests: [PRODUCER],
    revokedProfileDigests: [],
    invalidFrom: '2026-08-29T00:10:30.000Z',
    reasonCode: 'producer-compromised',
    replacementDigest: null,
    newEvidenceEpoch: 2,
    trustedTimeSampleDigest: D('time-sample')
  }, 'KSTACK-EVIDENCE-REVOCATION-SIGNATURE-V1', shared.admins);
  const base = {
    candidates: [pass], requirement: requirement(), root: shared.root, revocations: [revocation], supersessions: [],
    liveEnvironmentSnapshot: pass.environmentSnapshot, trustedNow: '2026-08-29T00:11:00.000Z',
    bodySchemaDigest: BODY_SCHEMA, currentEvidenceEpoch: 2, vocabulary: VOCABULARY
  };
  assert.equal(selectHostEvidence(base).outcome, 'INVALID');

  const fail = evidenceFixture({ rootFixture: shared, outcome: 'FAIL', resultEvidenceDigest: D('failure') });
  const forgedSupersession = {
    ...evidenceHead('EvidenceSupersessionV1', SCHEMA_SET),
    trustRootDigest: rootDigest,
    oldEvidenceDigest: validateHostArtifact('HostConformanceEvidenceV1', fail.wrapper, { vocabulary: VOCABULARY }).objectDigest,
    newEvidenceDigest: validateHostArtifact('HostConformanceEvidenceV1', pass.wrapper, { vocabulary: VOCABULARY }).objectDigest,
    requirementScopeDigest: requirement().requirementScopeDigest,
    fixtureScopeDigest: requirement().fixtureScopeDigest,
    environmentSnapshotDigest: hostAddress(EVIDENCE_IDENTITIES.EnvironmentSnapshotV1.domain, pass.environmentSnapshot),
    rootCauseReasonCode: 'corrected-run',
    correctiveChangeDigest: D('change'),
    newIndependentRunDigest: D('run'),
    effectiveAt: '2026-08-29T00:10:30.000Z',
    evidenceEpoch: 1,
    signatures: [
      { keyId: 'admin.1', signature: Buffer.alloc(64).toString('base64url') },
      { keyId: 'admin.2', signature: Buffer.alloc(64).toString('base64url') }
    ]
  };
  assert.equal(selectHostEvidence({
    ...base, candidates: [fail, pass], revocations: [], supersessions: [forgedSupersession], currentEvidenceEpoch: 1
  }).outcome, 'INVALID');
});

test('protected kernel rejects ordinary storage and publishes only after atomic reread', async () => {
  const shared = rootFixture();
  assert.throws(() => new ProtectedEvidenceKernel({
    schemaSetDigest: SCHEMA_SET,
    backend: createTestProtectedEvidenceBackend(),
    vocabulary: VOCABULARY,
    allowTestBackend: false
  }), { code: 'KSTACK_EVIDENCE_UNAVAILABLE' });
  let protectedSources;
  const kernel = new ProtectedEvidenceKernel({
    schemaSetDigest: SCHEMA_SET,
    backend: createTestProtectedEvidenceBackend({
      hmacKey: Buffer.alloc(32, 7),
      measurementBinding: async () => SNAPSHOT_BINDINGS,
      measurementSources: async () => protectedSources
    }),
    vocabulary: VOCABULARY,
    allowTestBackend: true
  });
  await kernel.enrollGenesis(shared.root, { ownerAdminQuorum: true, protectedAuditReceiptDigest: D('genesis-receipt') });
  assert.equal(kernel.state.enrolled, true);
  assert.equal(kernel.state.rootGeneration, 1);
  assert.equal(kernel.state.publicationSequence, 0);

  const profile = {
    ...evidenceHead('EnvironmentMeasurementProfileV1', SCHEMA_SET),
    operationProfileDigest: D('operation-profile'),
    hostPlatformDigest: D('platform'),
    selectors: [{
      selectorId: 'host.mode', valueKind: 'PUBLIC', mutable: true, mandatory: true,
      maximumAgeMs: 600_000, maximumBytes: 256, sourceIds: ['source.protected']
    }],
    maximumMeasurementAgeMs: 600_000,
    observerImplementationDigests: [OBSERVER_IMPLEMENTATION],
    activeSetDigest: SNAPSHOT_BINDINGS.activeSetDigest
  };
  const timeSample = { sampleDigest: D('time-sample'), wallTime: '2026-08-29T00:10:00.000Z' };
  let measuredMode = 'test';
  protectedSources = {
    'source.protected': {
      async open() {
        const identityDigest = D('protected-source');
        return { identityDigest, async read() { return { mode: measuredMode }; }, async revalidate() { return identityDigest; } };
      }
    }
  };
  const measurement = await kernel.measureEnvironment(profile, timeSample);
  assert.equal(kernel.state.measurementSequence, 1);
  const candidate = evidenceFixture({ rootFixture: shared, environment: measurement.snapshot, expiresAt: '2026-08-29T00:15:00.000Z' });
  const { root: _root, vocabulary: _vocabulary, currentEvidenceEpoch: _epoch, ...publishInput } = candidate;
  const publication = await kernel.publishHostConformance(publishInput, timeSample);
  assert.equal(publication.publicationSequence, 1);
  assert.equal(kernel.state.publicationSequence, 1);
  await kernel.freezeCatalog({
    environmentSnapshotDigest: measurement.snapshotDigest,
    activeSetDigest: SNAPSHOT_BINDINGS.activeSetDigest,
    policyDigest: SNAPSHOT_BINDINGS.policyDigest,
    producerRegistryDigest: D('producer-registry'),
    schemaResolverSetDigest: D('schema-resolver-set'),
    trustedTimeSampleDigest: timeSample.sampleDigest,
    expiresAt: '2026-08-29T00:20:00.000Z'
  });
  assert.equal(kernel.select({
    requirement: requirement(), liveEnvironmentSnapshot: measurement.snapshot,
    trustedNow: '2026-08-29T00:11:00.000Z', bodySchemaDigest: BODY_SCHEMA
  }).outcome, 'VALID');
  const admission = await kernel.admit({
    requirement: requirement(), liveEnvironmentSnapshot: measurement.snapshot,
    trustedNow: '2026-08-29T00:11:00.000Z', bodySchemaDigest: BODY_SCHEMA
  });
  assert.equal(admission.evaluation.outcome, 'VALID');
  assert.ok(admission.admissionSnapshot);
  assert.equal(admission.admissionSnapshot.expiresAt, '2026-08-29T00:15:00.000Z');
  assert.equal(assertEvidenceActionHandoff(admission.admissionSnapshot, {
    environmentSnapshotDigest: measurement.snapshotDigest,
    measurementSequence: 1,
    activeSetDigest: SNAPSHOT_BINDINGS.activeSetDigest,
    policyDigest: SNAPSHOT_BINDINGS.policyDigest,
    rootGeneration: 1,
    revocationSequence: 0,
    evidenceEpoch: 1,
    catalogHeadDigest: kernel.state.catalogHeadDigest,
    catalogSequence: 1,
    trustedNow: '2026-08-29T00:11:30.000Z'
  }), true);
  assert.throws(() => assertEvidenceActionHandoff(admission.admissionSnapshot, {
    environmentSnapshotDigest: measurement.snapshotDigest,
    measurementSequence: 1,
    activeSetDigest: SNAPSHOT_BINDINGS.activeSetDigest,
    policyDigest: D('changed-policy'),
    rootGeneration: 1,
    revocationSequence: 0,
    evidenceEpoch: 1,
    catalogHeadDigest: kernel.state.catalogHeadDigest,
    catalogSequence: 1,
    trustedNow: '2026-08-29T00:11:30.000Z'
  }), { code: 'KSTACK_ENVIRONMENT_CHANGED' });

  const remeasured = await kernel.remeasureAndAdmit({
    profile,
    timeSample: { sampleDigest: D('time-sample-2'), wallTime: '2026-08-29T00:12:00.000Z' },
    requirement: requirement(), bodySchemaDigest: BODY_SCHEMA
  });
  assert.equal(remeasured.evaluation.outcome, 'VALID');
  measuredMode = 'changed';
  const changed = await kernel.remeasureAndAdmit({
    profile,
    timeSample: { sampleDigest: D('time-sample-3'), wallTime: '2026-08-29T00:13:00.000Z' },
    requirement: requirement(), bodySchemaDigest: BODY_SCHEMA
  });
  assert.equal(changed.evaluation.outcome, 'STALE');
});
