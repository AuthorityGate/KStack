import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { artifactHead, hostAddress } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import { EVIDENCE_IDENTITIES, evidenceHead } from '../plugins/kstack/scripts/kstack-host-evidence.mjs';
import {
  ELIGIBILITY_IDENTITIES,
  ELIGIBILITY_REASON_CODES,
  ProtectedEligibilityKernel,
  assertEligibilityFence,
  eligibilityHead,
  evaluateOperationEligibility,
  safeEligibilityDiagnostic,
  validateEligibilityInvalidation,
  validateEligibilityPolicy
} from '../plugins/kstack/scripts/kstack-host-eligibility.mjs';

const D = (value) => hostAddress('KSTACK-TEST-V1', { value });
const SCHEMA_SET = D('schema-set');
const HOST = D('host');
const PLATFORM = D('platform');
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-eligibility-reference/Cargo.toml', import.meta.url));
const VOCABULARY = Object.freeze({
  operationIds: ['inspect'],
  capabilityIds: ['cap.a', 'cap.b'],
  reasonCodes: ELIGIBILITY_REASON_CODES,
  operationProfileIds: ['alternate.safe'],
  quarantineSubjectTypes: ['producer']
});

function policy(overrides = {}) {
  return {
    ...eligibilityHead('EligibilityPolicyV1', SCHEMA_SET),
    activeSetDigest: D('active'),
    basePolicyDigest: D('base-policy'),
    repositoryPolicyDigest: D('repo-policy'),
    operationRows: [{
      operationId: 'inspect',
      operationClassId: 'read',
      requirementProfileDigest: D('requirement'),
      absoluteDeny: false,
      permittedHostDigests: [HOST],
      permittedPlatformDigests: [PLATFORM],
      requiredReasonCodes: [],
      forbiddenReasonCodes: [],
      alternatePermission: true,
      orderedAlternateProfileIds: ['alternate.safe'],
      alternateRegistrations: [{
        profileId: 'alternate.safe', requirementProfileDigest: D('alternate-requirement'),
        maximumStatus: 'DEGRADED_REGISTERED',
        semanticEffectSubsetProofDigest: D('subset-proof'), authorityCeilingDigest: D('authority-ceiling')
      }],
      alternateEligibleReasonCodes: ['KSTACK_ELIGIBILITY_REQUIREMENT_MISSING'],
      maximumResultLifetimeMs: 300_000,
      policyEpoch: 1,
      ...overrides
    }],
    expiresAt: '2026-08-29T00:20:00.000Z'
  };
}

function input(overrides = {}) {
  const eligibilityPolicy = overrides.policy || policy();
  const policyDigest = hostAddress(ELIGIBILITY_IDENTITIES.EligibilityPolicyV1.domain, eligibilityPolicy);
  const evidenceEvaluation = overrides.evidenceEvaluation || evidenceEvaluationArtifact('VALID');
  const evidenceEvaluationDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceEvaluationV1.domain, evidenceEvaluation);
  const evidenceAdmissionSnapshot = overrides.evidenceAdmissionSnapshot || {
    ...evidenceHead('EvidenceAdmissionSnapshotV1', SCHEMA_SET),
    environmentSnapshotDigest: D('environment'), measurementSequence: 1,
    activeSetDigest: D('active'), policyDigest: D('policy'), rootGeneration: 1,
    revocationSequence: 0, evidenceEpoch: 1, catalogHeadDigest: D('catalog-head'),
    catalogSequence: 1, requirementProfileDigest: D('requirement'),
    selectedEvidenceDigests: [D('selected-evidence')], evaluationDigest: evidenceEvaluationDigest,
    trustedTimeSampleDigest: D('time'), expiresAt: '2026-08-29T00:19:00.000Z'
  };
  const evidenceAdmissionSnapshotDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceAdmissionSnapshotV1.domain, evidenceAdmissionSnapshot);
  const contextBindings = {
    operationId: 'inspect', operationClassId: 'read', requirementProfileDigest: D('requirement'),
    activeSetDigest: D('active'), policyDigest: D('policy'),
    evidenceAdmissionSnapshotDigest, evidenceEvaluationDigest,
    revocationSequence: 0, evidenceEpoch: 1, eligibilityEpoch: 1
  };
  return {
    snapshot: {
      ...eligibilityHead('EligibilityInputSnapshotV1', SCHEMA_SET),
      ...contextBindings,
      trustedRequestContextDigest: D('context'),
      eligibilityPolicyDigest: policyDigest,
      quarantineHeadDigest: D('quarantine-head'),
      trustedTimeSampleDigest: D('time'),
      evaluatedAt: '2026-08-29T00:10:00.000Z'
    },
    policy: eligibilityPolicy,
    requirementProfile: {
      operationId: 'inspect', operationClassId: 'read', requirementProfileDigest: D('requirement'),
      capabilityIds: ['cap.a', 'cap.b'], alternateProfileIds: ['alternate.safe']
    },
    evidenceAdmissionSnapshot,
    evidenceEvaluation,
    primaryPartition: { provenCapabilityIds: ['cap.a', 'cap.b'], missingCapabilityIds: [] },
    primaryReasonCodes: [],
    alternates: [],
    activeQuarantines: [],
    hostDigest: HOST,
    platformDigest: PLATFORM,
    contextBindings,
    expiryCandidates: ['2026-08-29T00:19:00.000Z'],
    vocabulary: VOCABULARY,
    ...overrides,
    policy: eligibilityPolicy
  };
}

function evidenceEvaluationArtifact(outcome) {
  const valid = outcome === 'VALID';
  return {
    ...evidenceHead('EvidenceEvaluationV1', SCHEMA_SET), outcome,
    reasonCodes: outcome === 'INVALID' ? ['KSTACK_EVIDENCE_SIGNATURE_INVALID']
      : outcome === 'CONTRADICTORY' ? ['KSTACK_EVIDENCE_CONTRADICTORY']
        : outcome === 'STALE' ? ['KSTACK_EVIDENCE_STALE']
          : outcome === 'UNAVAILABLE' ? ['KSTACK_EVIDENCE_UNAVAILABLE'] : [],
    selectedEvidenceDigests: valid ? [D('selected-evidence')] : [],
    evidenceSetDigest: valid ? D('evidence-set') : null,
    evaluatedAt: '2026-08-29T00:10:00.000Z'
  };
}

test('valid current primary closure yields FULL with an exact capability partition', () => {
  const result = evaluateOperationEligibility(input());
  assert.deepEqual(result.record.reasonCodes, []);
  assert.equal(result.record.status, 'FULL');
  assert.equal(result.record.alternateProfileId, null);
  assert.deepEqual(result.record.provenCapabilityIds, ['cap.a', 'cap.b']);
  assert.equal(result.record.expiresAt, '2026-08-29T00:15:00.000Z');
});

test('invalid or contradictory evidence and active quarantine dominate policy and alternates', () => {
  for (const [outcome, reason] of [
    ['INVALID', 'KSTACK_ELIGIBILITY_EVIDENCE_INVALID'],
    ['CONTRADICTORY', 'KSTACK_ELIGIBILITY_EVIDENCE_CONTRADICTORY']
  ]) {
    const result = evaluateOperationEligibility(input({
      evidenceEvaluation: evidenceEvaluationArtifact(outcome),
      primaryPartition: { provenCapabilityIds: ['cap.a'], missingCapabilityIds: ['cap.b'] },
      alternates: [alternate()]
    }));
    assert.equal(result.record.status, 'QUARANTINED');
    assert.ok(result.record.reasonCodes.includes(reason));
    assert.equal(result.record.alternateProfileId, null);
  }
  assert.equal(evaluateOperationEligibility(input({ activeQuarantines: [D('event')] })).record.status, 'QUARANTINED');
});

test('absolute deny is UNSUPPORTED and cannot be weakened by valid evidence', () => {
  const deniedPolicy = policy({ absoluteDeny: true });
  const result = evaluateOperationEligibility(input({ policy: deniedPolicy }));
  assert.equal(result.record.status, 'UNSUPPORTED');
  assert.ok(result.record.reasonCodes.includes('KSTACK_ELIGIBILITY_POLICY_DENIED'));
});

function alternate(overrides = {}) {
  return {
    profileId: 'alternate.safe', requirementProfileDigest: D('alternate-requirement'),
    independentEvidenceOutcome: 'VALID',
    partition: { provenCapabilityIds: ['cap.a'], missingCapabilityIds: [] },
    reasonCodes: [], expiresAt: '2026-08-29T00:18:00.000Z', ...overrides
  };
}

test('only an ordered registered independently proven lower-authority alternate degrades', () => {
  const base = input({
    primaryPartition: { provenCapabilityIds: ['cap.a'], missingCapabilityIds: ['cap.b'] },
    alternates: [alternate()]
  });
  const result = evaluateOperationEligibility(base);
  assert.equal(result.record.status, 'DEGRADED_REGISTERED');
  assert.equal(result.record.alternateProfileId, 'alternate.safe');
  assert.deepEqual(result.record.missingCapabilityIds, ['cap.b']);
  assert.equal(evaluateOperationEligibility({ ...base, alternates: [alternate({ independentEvidenceOutcome: 'UNAVAILABLE' })] }).record.status, 'UNSUPPORTED');
});

test('the complete evidence/deny/quarantine/missing/alternate matrix is monotonic restrictive', () => {
  const rank = { QUARANTINED: 0, UNSUPPORTED: 1, DEGRADED_REGISTERED: 2, FULL: 3 };
  for (const evidenceOutcome of ['VALID', 'INVALID', 'CONTRADICTORY', 'STALE', 'UNAVAILABLE']) {
    for (const absoluteDeny of [false, true]) for (const quarantined of [false, true]) {
      for (const primaryMissing of [false, true]) for (const alternateValid of [false, true]) {
        const evaluated = evaluateOperationEligibility(input({
          policy: policy({ absoluteDeny }),
          evidenceEvaluation: evidenceEvaluationArtifact(evidenceOutcome),
          primaryPartition: primaryMissing
            ? { provenCapabilityIds: ['cap.a'], missingCapabilityIds: ['cap.b'] }
            : { provenCapabilityIds: ['cap.a', 'cap.b'], missingCapabilityIds: [] },
          alternates: alternateValid ? [alternate()] : [],
          activeQuarantines: quarantined ? [D('active-quarantine')] : []
        })).record.status;
        const expected = quarantined || ['INVALID', 'CONTRADICTORY'].includes(evidenceOutcome)
          ? 'QUARANTINED'
          : absoluteDeny || ['STALE', 'UNAVAILABLE'].includes(evidenceOutcome)
            ? 'UNSUPPORTED'
            : !primaryMissing ? 'FULL' : alternateValid ? 'DEGRADED_REGISTERED' : 'UNSUPPORTED';
        assert.equal(evaluated, expected, JSON.stringify({ evidenceOutcome, absoluteDeny, quarantined, primaryMissing, alternateValid }));
        assert.ok(rank[evaluated] <= rank.FULL);
      }
    }
  }
});

test('binding drift, partition overlap, duplicate policy rows, and expired intersections fail closed', () => {
  const drift = input();
  drift.snapshot = { ...drift.snapshot, policyDigest: D('drift') };
  assert.equal(evaluateOperationEligibility(drift).record.status, 'QUARANTINED');
  const evaluationSubstitution = input();
  evaluationSubstitution.evidenceEvaluation = {
    ...evaluationSubstitution.evidenceEvaluation, evaluatedAt: '2026-08-29T00:10:00.001Z'
  };
  assert.equal(evaluateOperationEligibility(evaluationSubstitution).record.status, 'QUARANTINED');
  assert.throws(() => evaluateOperationEligibility(input({
    primaryPartition: { provenCapabilityIds: ['cap.a'], missingCapabilityIds: ['cap.a'] }
  })), { code: 'KSTACK_ELIGIBILITY_INPUT_INVALID' });
  const duplicate = policy();
  duplicate.operationRows = [duplicate.operationRows[0], duplicate.operationRows[0]];
  assert.throws(() => validateEligibilityPolicy(duplicate), { code: 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE' });
  assert.throws(() => evaluateOperationEligibility(input({
    expiryCandidates: ['2026-08-29T00:10:00.000Z']
  })), { code: 'KSTACK_ELIGIBILITY_EXPIRED' });
});

test('public eligibility diagnostics are closed and contain only safe IDs, counts, and digests', () => {
  const diagnostic = safeEligibilityDiagnostic({
    status: 'UNSUPPORTED', reasonCodes: ['KSTACK_ELIGIBILITY_POLICY_DENIED'],
    provenCount: 1, missingCount: 1, alternateProfileId: null, correlationDigest: D('correlation')
  });
  assert.doesNotMatch(JSON.stringify(diagnostic), /path|token|principal|exception|credential/iu);
  assert.throws(() => safeEligibilityDiagnostic({ ...diagnostic, rawPath: '/secret' }), {
    code: 'KSTACK_ELIGIBILITY_INPUT_INVALID'
  });
});

function eligibilityBackend() {
  let audit = D('audit-genesis');
  return {
    descriptor: {
      protectionClass: 'test-only', repositoryWritable: false, agentWritable: false,
      durable: true, atomicPublication: true, nonExportableKeys: true, appendOnlyAudit: true
    },
    async append(transaction) {
      const rereadDigests = transaction.objects.map((entry) => entry.digest).sort();
      audit = hostAddress('KSTACK-TEST-AUDIT-V1', { audit, rereadDigests });
      return { committed: true, rereadDigests, auditReceiptDigest: audit };
    },
    async verifyProtectedAnchor(anchorDigest) { return anchorDigest === D('protected-anchor'); },
    async verifyTrustedTimeSample(sample) { return sample?.sampleDigest === D('time'); },
    async verifyRemediation() { return true; },
    async revocationStillEnforced() { return true; },
    async verifyEligibilityPolicy() { return true; },
    async verifyInputSnapshot() { return true; },
    async quarantineReasonPolicy() { return { automaticExpiryAllowed: false }; }
  };
}

test('protected quarantine and eligibility epoch advance publish atomically and fence stale action handoff', async () => {
  const repositoryContextDigest = D('repository-context');
  const kernel = new ProtectedEligibilityKernel({
    schemaSetDigest: SCHEMA_SET, repositoryContextDigest, backend: eligibilityBackend(),
    vocabulary: VOCABULARY, allowTestBackend: true
  });
  const event = {
    ...artifactHead('QuarantineEventV1', SCHEMA_SET),
    subjectType: 'producer', subjectDigest: D('producer'), scopeOperationIds: ['inspect'],
    reasonCode: 'KSTACK_ELIGIBILITY_EVIDENCE_INVALID', sourceEvidenceDigest: D('source-evidence'),
    previousEligibilityDigests: [], effectiveAt: '2026-08-29T00:11:00.000Z', expiresAt: null,
    eventAnchorDigest: D('protected-anchor')
  };
  const invalidation = {
    ...eligibilityHead('EligibilityInvalidationV1', SCHEMA_SET),
    repositoryContextDigest, scopeOperationIds: ['inspect'], priorEligibilityEpoch: 1, newEligibilityEpoch: 2,
    changedSubjectType: 'producer', changedSubjectDigest: D('producer'),
    reasonCode: 'KSTACK_ELIGIBILITY_EVIDENCE_INVALID', affectedEligibilityDigests: [D('old-eligibility')],
    effectiveAt: '2026-08-29T00:11:00.000Z', trustedTimeSampleDigest: D('time'),
    protectedAnchorDigest: D('protected-anchor')
  };
  assert.equal(validateEligibilityInvalidation(invalidation).newEligibilityEpoch, 2);
  const appended = await kernel.appendQuarantineAndInvalidate({
    event, invalidation, timeSample: { sampleDigest: D('time'), wallTime: '2026-08-29T00:11:00.000Z' }
  });
  assert.equal(kernel.eligibilityEpoch('inspect'), 2);
  assert.deepEqual(kernel.activeQuarantineDigests('inspect', '2026-08-29T00:12:00.000Z'), [appended.eventDigest]);
  const eligibilityFence = {
    eligibilityDigest: D('eligibility'), eligibilityEpoch: 2, activeSetDigest: D('active'), policyDigest: D('policy'),
    evidenceAdmissionSnapshotDigest: D('admission'), environmentSequence: 1, revocationSequence: 0,
    quarantineHeadDigest: kernel.quarantineHeadDigest, expiresAt: '2026-08-29T00:20:00.000Z'
  };
  const { expiresAt: _expiresAt, ...currentFence } = eligibilityFence;
  assert.equal(assertEligibilityFence(eligibilityFence, {
    ...currentFence, trustedNow: '2026-08-29T00:12:00.000Z'
  }), true);
  assert.throws(() => assertEligibilityFence(eligibilityFence, {
    ...currentFence, eligibilityEpoch: 3, trustedNow: '2026-08-29T00:12:00.000Z'
  }), { code: 'KSTACK_ELIGIBILITY_EPOCH_CHANGED' });
  await kernel.appendResolution({
    ...eligibilityHead('QuarantineResolutionV1', SCHEMA_SET),
    quarantineEventDigest: appended.eventDigest, subjectType: 'producer', subjectDigest: D('producer'),
    scopeOperationIds: ['inspect'], incidentEvidenceDigest: D('incident'), remediationEvidenceDigest: D('remediation'),
    replacementDigest: D('replacement'), independentVerificationDigest: D('independent-verification'),
    newEvidenceEpoch: 2, newPolicyEpoch: 2, newEligibilityEpoch: 3,
    resolvedAt: '2026-08-29T00:13:00.000Z', trustedTimeSampleDigest: D('time'),
    resolverId: 'security.admin', protectedAnchorDigest: D('protected-anchor')
  });
  assert.equal(kernel.eligibilityEpoch('inspect'), 3);
  assert.deepEqual(kernel.activeQuarantineDigests('inspect', '2026-08-29T00:14:00.000Z'), []);
  const protectedInput = input();
  protectedInput.snapshot = {
    ...protectedInput.snapshot, eligibilityEpoch: 3, quarantineHeadDigest: kernel.quarantineHeadDigest
  };
  protectedInput.contextBindings = { ...protectedInput.contextBindings, eligibilityEpoch: 3 };
  const publishedEligibility = await kernel.evaluateAndPublish(protectedInput);
  const cacheCurrent = {
    eligibilityEpoch: 3, activeSetDigest: D('active'), policyDigest: D('policy'),
    evidenceAdmissionSnapshotDigest: protectedInput.snapshot.evidenceAdmissionSnapshotDigest,
    environmentSequence: 1, revocationSequence: 0, quarantineHeadDigest: kernel.quarantineHeadDigest,
    trustedNow: '2026-08-29T00:14:30.000Z'
  };
  assert.equal(kernel.reuseCached(publishedEligibility.recordDigest, cacheCurrent)?.record.status, 'FULL');
  const race = [1, 2].map((index) => kernel.appendQuarantineAndInvalidate({
    event: {
      ...event, subjectDigest: D(`producer-race-${index}`), sourceEvidenceDigest: D(`source-race-${index}`),
      effectiveAt: '2026-08-29T00:15:00.000Z'
    },
    invalidation: {
      ...invalidation, priorEligibilityEpoch: 3, newEligibilityEpoch: 4,
      changedSubjectDigest: D(`producer-race-${index}`), affectedEligibilityDigests: [],
      effectiveAt: '2026-08-29T00:15:00.000Z'
    },
    timeSample: { sampleDigest: D('time'), wallTime: '2026-08-29T00:15:00.000Z' }
  }));
  const settled = await Promise.allSettled(race);
  assert.equal(settled.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(settled.filter((entry) => entry.status === 'rejected' && entry.reason?.code === 'KSTACK_ELIGIBILITY_EPOCH_CHANGED').length, 1);
  assert.equal(kernel.eligibilityEpoch('inspect'), 4);
  assert.equal(kernel.reuseCached(publishedEligibility.recordDigest, {
    ...cacheCurrent, eligibilityEpoch: 4, quarantineHeadDigest: kernel.quarantineHeadDigest
  }), null);
});

test('lockfile-pinned native Rust independently matches restrictive eligibility precedence', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-eligibility-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(build.status, 0, build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-eligibility-reference${process.platform === 'win32' ? '.exe' : ''}`);
    const vectors = [
      [{ evidenceOutcome: 'VALID', absoluteDeny: false, contextMismatch: false, activeQuarantine: false, primaryMissing: false, alternateValid: false }, 'FULL'],
      [{ evidenceOutcome: 'VALID', absoluteDeny: false, contextMismatch: false, activeQuarantine: false, primaryMissing: true, alternateValid: true }, 'DEGRADED_REGISTERED'],
      [{ evidenceOutcome: 'VALID', absoluteDeny: true, contextMismatch: false, activeQuarantine: false, primaryMissing: false, alternateValid: true }, 'UNSUPPORTED'],
      [{ evidenceOutcome: 'STALE', absoluteDeny: false, contextMismatch: false, activeQuarantine: false, primaryMissing: true, alternateValid: true }, 'UNSUPPORTED'],
      [{ evidenceOutcome: 'INVALID', absoluteDeny: true, contextMismatch: false, activeQuarantine: false, primaryMissing: true, alternateValid: true }, 'QUARANTINED'],
      [{ evidenceOutcome: 'VALID', absoluteDeny: false, contextMismatch: true, activeQuarantine: true, primaryMissing: false, alternateValid: false }, 'QUARANTINED']
    ];
    for (const [vector, status] of vectors) {
      const result = spawnSync(binary, [], { input: JSON.stringify(vector), encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { status });
    }
    const malformed = spawnSync(binary, [], {
      input: JSON.stringify({ ...vectors[0][0], preferredStatus: 'FULL' }), encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(malformed.status, 2);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
