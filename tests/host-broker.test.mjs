import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  BROKER_REASON_CODES,
  deriveBrokerClassification,
  evaluateBackgroundApprovalWindow,
  evaluateBrokerStructuralRequirement
} from '../plugins/kstack/scripts/kstack-host-broker.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;
const SCHEMA = D('a');
const BINDING = D('b');
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-broker-reference/Cargo.toml', import.meta.url));

function provenance() {
  return ['active-set', 'operation-registry', 'override-revocation', 'policy', 'target-classification'].map((sourceId, index) => ({
    sourceId,
    sourceDigest: D(String(index + 1)),
    trustRootDigest: D('9'),
    outcome: 'PROVEN',
    closureControlled: false,
    rollbackDetected: false
  }));
}

function classificationInput(overrides = {}) {
  return {
    schemaSetDigest: SCHEMA,
    operationId: 'repo.write',
    operationKind: 'write',
    executionMode: 'foreground',
    directAuthorityTier: 'ask',
    directLocalPrivilegeTier: 'ordinary',
    targetPrivilegeRows: [{ targetId: 'repository', privilegeTier: 'privileged', classificationDigest: D('1') }],
    indirectEffectRows: [{ effectId: 'effect.write', authorityTier: 'ask', privilegeTier: 'privileged', reachabilityOutcome: 'PROVEN' }],
    governanceMutation: false,
    effectIds: ['effect.write'],
    provenanceRows: provenance(),
    callerEcho: { authorityTier: 'ask', privilegeTier: 'privileged', brokerRequired: true },
    ...overrides
  };
}

function inventory(status = 'COVERED') {
  return {
    schemaId: 'kstack.host-bypass-inventory.v1',
    schemaVersion: 1,
    schemaSetDigest: SCHEMA,
    hostTupleDigest: D('2'),
    closureDigest: D('3'),
    sourceInventoryDigests: [D('4'), D('5'), D('6'), D('7')],
    operationProfileIds: ['repo.write'],
    surfaces: [{
      surfaceId: 'surface.fs',
      familyId: 'filesystem-mutation',
      sourceKinds: ['DOCUMENTED', 'DYNAMIC', 'LIVE', 'STATIC'],
      descriptorDigests: [D('8')],
      registrationDigest: D('9'),
      reachableOperationProfileIds: ['repo.write'],
      mediationPointId: 'broker.filesystem',
      observerIds: ['observer.fs'],
      positiveFixtureIds: ['fixture.write'],
      negativeFixtureIds: ['fixture.escape'],
      status,
      limitationCodes: status === 'BYPASS_FOUND' ? ['KSTACK_BYPASS_FOUND'] : []
    }]
  };
}

function profile(overrides = {}) {
  return {
    schemaId: 'kstack.broker-profile.v1',
    schemaVersion: 1,
    schemaSetDigest: SCHEMA,
    profileId: 'broker-main',
    protocolId: 'broker-v1',
    protocolDigest: D('1'),
    activeSetDigest: D('2'),
    operationIds: ['repo.write'],
    effectIds: ['effect.write'],
    effectFamilyRows: [{ effectId: 'effect.write', effectFamilyId: 'filesystem-mutation', coverageProofDigest: D('3') }],
    custody: { activeSet: true, config: true, executable: true, policy: true, receiptLog: true, replayLedger: true, signingKeys: true },
    authorizationPath: { approvalChannel: true, canonicalPreview: true, decisionInputs: true, nonceStore: true, trustAnchors: true, verificationKeys: true },
    actionTimeMediation: { currentAdmissionRequired: true, fenceRequired: true, protectedDispatchOnly: true },
    terminalEvidence: { ambiguousOutcomeRecorded: true, protectedReceiptRequired: true },
    ...overrides
  };
}

function proofs(overrides = {}) {
  return [
    'authorization-exclusivity', 'binding', 'classification-provenance', 'current-admission',
    'effect-exclusivity', 'protected-custody', 'terminal-evidence'
  ].map((proofId, index) => ({
    proofId,
    outcome: 'PROVEN',
    evidenceDigest: D(String((index + 3) % 10)),
    bindingDigest: BINDING,
    subjectControlled: false,
    ...(overrides[proofId] ?? {})
  }));
}

function structuralInput(overrides = {}) {
  const classification = deriveBrokerClassification(classificationInput()).classification;
  return {
    schemaSetDigest: SCHEMA,
    classification,
    activeSetDigest: D('2'),
    policyDigest: D('4'),
    operationBindingDigest: BINDING,
    requiredStructuralControls: ['protected-broker-v1:broker-main'],
    profile: profile(),
    proofRows: proofs(),
    bypassInventory: inventory(),
    otherRequirementsProven: true,
    ...overrides
  };
}

function facts(character = '1', allValid = true) {
  return {
    factSetDigest: D(character),
    policyDigest: D('2'), activeSetDigest: D('3'), targetDigest: D('4'), inputsDigest: D('5'),
    limitsDigest: D('6'), expiry: '2026-08-29T06:00:00.000Z', nonceDigest: D('7'),
    idempotencyDigest: D('8'), classificationDigest: D('9'), channelBindingDigest: D('d'),
    effectSetDigest: D('e'), structuralEvaluationDigest: D('f'), allValid
  };
}

function backgroundInput(overrides = {}) {
  return {
    schemaSetDigest: SCHEMA,
    operationId: 'repo.write',
    authorityTier: 'ask',
    executionMode: 'background',
    durableApprovalPresent: false,
    readinessPolicy: {
      maximumAttempts: 2,
      maximumTotalMs: 10_000,
      delayScheduleMs: [100, 500],
      permittedOperationIds: ['readiness.probe'],
      policyDigest: D('2')
    },
    troubleshootingAttempts: [{
      operationId: 'readiness.probe', durationMs: 250, nonEscalating: true,
      effectCrossed: false, scopeChanged: false, outcome: 'READY'
    }],
    factsAfterRecovery: facts('1'),
    ownerQuestion: {
      questionId: 'question-1', previewDigest: D('3'), recommendationId: 'approve-current',
      consequenceIds: ['effect-applies'], blockedActionId: 'repo.write', choices: ['Yes', 'No', 'Comment'],
      failureEvidenceDigest: D('4')
    },
    freshApproval: {
      approvalId: 'approval-1', answer: 'Yes', factSetDigest: D('1'), previewDigest: D('3'),
      issuedAt: '2026-08-29T05:00:00.000Z', expiresAt: '2026-08-29T05:10:00.000Z', oneShot: true
    },
    factsBeforeEffect: facts('1'),
    evaluatedAt: '2026-08-29T05:05:00.000Z',
    ...overrides
  };
}

test('classification takes the maximum direct, target, indirect, and governance privilege', () => {
  const result = deriveBrokerClassification(classificationInput()).classification;
  assert.equal(result.authorityTier, 'ask');
  assert.equal(result.privilegeTier, 'privileged');
  assert.equal(result.brokerRequired, true);

  const ordinary = classificationInput({
    directAuthorityTier: 'allow',
    targetPrivilegeRows: [{ targetId: 'repository', privilegeTier: 'ordinary', classificationDigest: D('1') }],
    indirectEffectRows: [{ effectId: 'effect.write', authorityTier: 'allow', privilegeTier: 'ordinary', reachabilityOutcome: 'PROVEN' }],
    callerEcho: { authorityTier: 'allow', privilegeTier: 'ordinary', brokerRequired: false }
  });
  assert.equal(deriveBrokerClassification(ordinary).classification.brokerRequired, false);

  const governance = structuredClone(ordinary);
  governance.governanceMutation = true;
  governance.callerEcho = { authorityTier: 'allow', privilegeTier: 'privileged', brokerRequired: true };
  assert.equal(deriveBrokerClassification(governance).classification.privilegeTier, 'privileged');
});

test('unknown provenance and closure reachability never default to ordinary', () => {
  const untrusted = classificationInput();
  untrusted.provenanceRows[0].closureControlled = true;
  const result = deriveBrokerClassification(untrusted).classification;
  assert.equal(result.provenanceProven, false);
  assert.equal(result.authorityTier, null);
  assert.equal(result.brokerRequired, null);

  const reachability = classificationInput();
  reachability.indirectEffectRows[0].reachabilityOutcome = 'UNKNOWN';
  assert.equal(deriveBrokerClassification(reachability).classification.provenanceProven, false);

  const downgrade = classificationInput({ callerEcho: { authorityTier: 'allow', privilegeTier: 'ordinary', brokerRequired: false } });
  assert.equal(deriveBrokerClassification(downgrade).classification.echoMatches, false);
});

test('one exact broker control and every independent proof satisfy only the structural conjunct', () => {
  const result = evaluateBrokerStructuralRequirement(structuralInput()).evaluation;
  assert.equal(result.brokerRequired, true);
  assert.equal(result.structuralSatisfied, true);
  assert.equal(result.conjunctiveEligible, true);
  assert.deepEqual(result.reasonCodes, []);

  const otherMissing = structuralInput({ otherRequirementsProven: false });
  const missingResult = evaluateBrokerStructuralRequirement(otherMissing).evaluation;
  assert.equal(missingResult.structuralSatisfied, true);
  assert.equal(missingResult.conjunctiveEligible, false);
  assert.deepEqual(missingResult.reasonCodes, ['BROKER_OTHER_REQUIREMENT_UNPROVEN']);

  const multiInput = classificationInput({
    effectIds: ['effect.disclose', 'effect.write'],
    indirectEffectRows: [
      { effectId: 'effect.disclose', authorityTier: 'ask', privilegeTier: 'privileged', reachabilityOutcome: 'PROVEN' },
      { effectId: 'effect.write', authorityTier: 'ask', privilegeTier: 'privileged', reachabilityOutcome: 'PROVEN' }
    ]
  });
  const multi = deriveBrokerClassification(multiInput).classification;
  const multiProfile = profile({
    effectIds: ['effect.disclose', 'effect.write'],
    effectFamilyRows: [
      { effectId: 'effect.disclose', effectFamilyId: 'filesystem-mutation', coverageProofDigest: D('3') },
      { effectId: 'effect.write', effectFamilyId: 'filesystem-mutation', coverageProofDigest: D('4') }
    ]
  });
  const multiResult = evaluateBrokerStructuralRequirement(structuralInput({ classification: multi, profile: multiProfile })).evaluation;
  assert.equal(multiResult.structuralSatisfied, true);
  assert.equal(multiResult.reasonCodes.length, 0);
});

test('missing, multiple, partial, writable, foreign, and bypassed broker routes fail closed', () => {
  const cases = [
    [structuralInput({ requiredStructuralControls: [] }), 'BROKER_REQUIREMENT_MISSING'],
    [structuralInput({ requiredStructuralControls: ['protected-broker-v1:broker-alt', 'protected-broker-v1:broker-main'] }), 'BROKER_MULTIPLE_CONTROLS'],
    [structuralInput({ profile: profile({
      effectIds: ['effect.other'],
      effectFamilyRows: [{ effectId: 'effect.other', effectFamilyId: 'filesystem-mutation', coverageProofDigest: D('3') }]
    }) }), 'BROKER_EFFECT_COVERAGE_MISMATCH'],
    [structuralInput({ profile: profile({ custody: { ...profile().custody, signingKeys: false } }) }), 'BROKER_PROTECTION_UNPROVEN'],
    [structuralInput({ proofRows: proofs({ binding: { bindingDigest: D('f') } }) }), 'BROKER_BINDING_MISMATCH'],
    [structuralInput({ bypassInventory: inventory('BYPASS_FOUND') }), 'BROKER_EFFECT_EXCLUSIVITY_UNPROVEN']
  ];
  for (const [candidate, reason] of cases) {
    const result = evaluateBrokerStructuralRequirement(candidate).evaluation;
    assert.equal(result.conjunctiveEligible, false, reason);
    assert.ok(result.reasonCodes.includes(reason), reason);
  }
});

test('every protected proof is mandatory, bound, and outside subject control', () => {
  const reasonByProof = {
    'authorization-exclusivity': 'BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN',
    binding: 'BROKER_BINDING_MISMATCH',
    'classification-provenance': 'BROKER_CLASSIFICATION_UNKNOWN',
    'current-admission': 'BROKER_CURRENT_ADMISSION_UNPROVEN',
    'effect-exclusivity': 'BROKER_EFFECT_EXCLUSIVITY_UNPROVEN',
    'protected-custody': 'BROKER_PROTECTION_UNPROVEN',
    'terminal-evidence': 'BROKER_TERMINAL_EVIDENCE_UNPROVEN'
  };
  for (const [proofId, reason] of Object.entries(reasonByProof)) {
    for (const mutation of [{ outcome: 'UNKNOWN' }, { subjectControlled: true }, { bindingDigest: D('f') }]) {
      const result = evaluateBrokerStructuralRequirement(structuralInput({ proofRows: proofs({ [proofId]: mutation }) })).evaluation;
      assert.ok(result.reasonCodes.includes(reason), `${proofId}:${JSON.stringify(mutation)}`);
    }
  }

  const profileMutations = [
    ['authorizationPath', 'approvalChannel', 'BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN'],
    ['authorizationPath', 'canonicalPreview', 'BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN'],
    ['authorizationPath', 'nonceStore', 'BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN'],
    ['authorizationPath', 'verificationKeys', 'BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN'],
    ['actionTimeMediation', 'fenceRequired', 'BROKER_CURRENT_ADMISSION_UNPROVEN'],
    ['terminalEvidence', 'ambiguousOutcomeRecorded', 'BROKER_TERMINAL_EVIDENCE_UNPROVEN']
  ];
  for (const [group, field, reason] of profileMutations) {
    const mutatedProfile = profile();
    mutatedProfile[group][field] = false;
    const result = evaluateBrokerStructuralRequirement(structuralInput({ profile: mutatedProfile })).evaluation;
    assert.ok(result.reasonCodes.includes(reason), `${group}:${field}`);
  }
});

test('allow ordinary operation remains broker-free but deny never becomes eligible', () => {
  const ordinary = deriveBrokerClassification(classificationInput({
    directAuthorityTier: 'allow',
    directLocalPrivilegeTier: 'ordinary',
    targetPrivilegeRows: [{ targetId: 'repository', privilegeTier: 'ordinary', classificationDigest: D('1') }],
    indirectEffectRows: [{ effectId: 'effect.write', authorityTier: 'allow', privilegeTier: 'ordinary', reachabilityOutcome: 'PROVEN' }],
    callerEcho: { authorityTier: 'allow', privilegeTier: 'ordinary', brokerRequired: false }
  })).classification;
  const admitted = evaluateBrokerStructuralRequirement(structuralInput({
    classification: ordinary, requiredStructuralControls: [], profile: null, proofRows: []
  })).evaluation;
  assert.equal(admitted.structuralSatisfied, true);
  assert.equal(admitted.conjunctiveEligible, true);

  const denied = deriveBrokerClassification(classificationInput({
    directAuthorityTier: 'deny',
    callerEcho: { authorityTier: 'deny', privilegeTier: 'privileged', brokerRequired: true }
  })).classification;
  const deniedResult = evaluateBrokerStructuralRequirement(structuralInput({ classification: denied })).evaluation;
  assert.equal(deniedResult.conjunctiveEligible, false);
  assert.ok(deniedResult.reasonCodes.includes('BROKER_POLICY_DENIED'));
});

test('background ask execution requires fresh one-shot approval after bounded readiness', () => {
  const result = evaluateBackgroundApprovalWindow(backgroundInput()).result;
  assert.equal(result.applicable, true);
  assert.equal(result.readyForProtectedSubmission, true);
  assert.deepEqual(result.reasonCodes, []);

  const durable = evaluateBackgroundApprovalWindow(backgroundInput({ durableApprovalPresent: true })).result;
  assert.ok(durable.reasonCodes.includes('BROKER_BACKGROUND_DURABLE_APPROVAL_FORBIDDEN'));

  const escalation = backgroundInput();
  escalation.troubleshootingAttempts[0].scopeChanged = true;
  assert.ok(evaluateBackgroundApprovalWindow(escalation).result.reasonCodes.includes('BROKER_BACKGROUND_READINESS_INVALID'));

  const drift = backgroundInput({ factsBeforeEffect: facts('0') });
  assert.ok(evaluateBackgroundApprovalWindow(drift).result.reasonCodes.includes('BROKER_BACKGROUND_FACT_DRIFT'));

  const stale = backgroundInput();
  stale.freshApproval.expiresAt = stale.evaluatedAt;
  assert.ok(evaluateBackgroundApprovalWindow(stale).result.reasonCodes.includes('BROKER_BACKGROUND_APPROVAL_INVALID'));
});

test('background safe-choice question is exact and cannot authorize failed validation', () => {
  const exhausted = backgroundInput({ factsAfterRecovery: facts('1', false), factsBeforeEffect: facts('1', false) });
  const result = evaluateBackgroundApprovalWindow(exhausted).result;
  assert.equal(result.readyForProtectedSubmission, false);
  assert.ok(result.reasonCodes.includes('BROKER_BACKGROUND_READINESS_INVALID'));
  assert.ok(result.reasonCodes.includes('BROKER_BACKGROUND_FACT_DRIFT'));

  const extraChoice = backgroundInput();
  extraChoice.ownerQuestion.choices = ['Yes', 'No', 'Comment', 'Force'];
  assert.throws(() => evaluateBackgroundApprovalWindow(extraChoice), (error) => error?.code === 'KSTACK_BROKER_BACKGROUND_INVALID');
  assert.ok(BROKER_REASON_CODES.includes('BROKER_BACKGROUND_DURABLE_APPROVAL_FORBIDDEN'));
});

test('lockfile-pinned native Rust oracle independently matches broker applicability', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-broker-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(build.status, 0, build.error?.message || build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-broker-reference${process.platform === 'win32' ? '.exe' : ''}`);
    const base = {
      authorityTier: 'ask', brokerControlCount: 1, echoMatches: true, effectCoverageComplete: true,
      otherRequirementsProven: true, privilegeTier: 'ordinary', proofsProven: true, provenanceProven: true
    };
    const vectors = [
      [base, { brokerRequired: true, conjunctiveEligible: true, structuralSatisfied: true }],
      [{ ...base, authorityTier: 'allow' }, { brokerRequired: false, conjunctiveEligible: true, structuralSatisfied: true }],
      [{ ...base, authorityTier: 'allow', privilegeTier: 'privileged' }, { brokerRequired: true, conjunctiveEligible: true, structuralSatisfied: true }],
      [{ ...base, authorityTier: 'deny' }, { brokerRequired: false, conjunctiveEligible: false, structuralSatisfied: false }],
      [{ ...base, brokerControlCount: 0 }, { brokerRequired: true, conjunctiveEligible: false, structuralSatisfied: false }],
      [{ ...base, proofsProven: false }, { brokerRequired: true, conjunctiveEligible: false, structuralSatisfied: false }],
      [{ ...base, otherRequirementsProven: false }, { brokerRequired: true, conjunctiveEligible: false, structuralSatisfied: true }]
    ];
    for (const [vector, expected] of vectors) {
      const result = spawnSync(binary, [], { input: JSON.stringify(vector), encoding: 'utf8', timeout: 30_000, maxBuffer: 65_536, shell: false });
      assert.equal(result.status, 0, result.error?.message || result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), expected);
    }
    const malformed = spawnSync(binary, [], {
      input: JSON.stringify({ ...base, preferredStatus: 'FULL' }), encoding: 'utf8', timeout: 30_000, maxBuffer: 65_536, shell: false
    });
    assert.equal(malformed.status, 2);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});
