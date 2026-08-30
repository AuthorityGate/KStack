import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  createResultArtifact,
  createResultValidationInventory,
  validateProducerTrustRoot,
  validateResultCandidate
} from '../plugins/kstack/scripts/kstack-domain-result.mjs';
import {
  admitPackDispatch,
  attestWorkflowEvidence,
  commitResultValidation,
  composePackPrompt
} from '../plugins/kstack/scripts/kstack-domain-result-broker.mjs';
import {
  createPackArtifact,
  createPackSelection,
  createValidationInventory,
  validatePackSelection
} from '../plugins/kstack/scripts/kstack-domain-selection.mjs';
import { createD5Artifact } from '../plugins/kstack/scripts/kstack-domain-schema.mjs';
import {
  GITHUB_PROTECTED_REVIEW_ADAPTER,
  createIdentityActionRequest,
  validateIdentityTrustRoot,
  verifyAndConsumeIdentityAction
} from '../plugins/kstack/scripts/kstack-domain-identity.mjs';
import { hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';

const ZERO = '0'.repeat(64);
const PROJECT = 'authority-gate-kstack';
const REPOSITORY = '123456789';
const NOW = '2026-08-29T18:00:00.000Z';
const OPERATION = raw('result-operation');
const REPOSITORY_POLICY_BYTES = Buffer.from('repository-policy-v1');
const REPOSITORY_POLICY = sha(REPOSITORY_POLICY_BYTES);

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function raw(value) {
  return sha(Buffer.from(value));
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, `expected ${expected}`);
}

async function asyncCode(expected, action) {
  await assert.rejects(action, (error) => error?.code === expected, `expected ${expected}`);
}

function resultEntry(result) {
  return { artifactType: result.record.artifactType, digest: result.artifactDigest, bytes: result.canonicalBytes };
}

function rawEntry(artifactType, bytes) {
  return { artifactType, digest: sha(bytes), bytes };
}

class IdentityInventory {
  async retain(record) {
    return { retained: true, inventoryDigest: sha(Buffer.concat([Buffer.from('KSTACK-IDENTITY-OPERATION-INVENTORY-V1\n'), hostCanonicalBytes(record)])) };
  }
}

class IdentityLedger {
  generation = 0;
  checkpointDigest = ZERO;
  keys = new Set();

  async inspect() {
    return { available: true, rollbackDetected: false, generation: this.generation, checkpointDigest: this.checkpointDigest };
  }

  async consumeOnce(record) {
    if (this.keys.has(record.keyDigest)) return { consumed: false, generation: this.generation, previousCheckpointDigest: this.checkpointDigest, checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: raw('replay') };
    this.keys.add(record.keyDigest);
    const previousCheckpointDigest = this.checkpointDigest;
    this.generation += 1;
    this.checkpointDigest = sha(hostCanonicalBytes({ previousCheckpointDigest, generation: this.generation, record }));
    return { consumed: true, generation: this.generation, previousCheckpointDigest, checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: raw(`witness-${this.generation}`) };
  }
}

async function ownerAcceptance(targetDigest) {
  const request = createIdentityActionRequest({
    projectId: PROJECT, repositoryImmutableId: REPOSITORY, action: 'pack-selection',
    targetDigest, policyDigest: REPOSITORY_POLICY, nonce: 'a'.repeat(32),
    notBefore: '2026-08-29T17:55:00.000Z', expiresAt: '2026-08-29T18:10:00.000Z'
  });
  const trustRoot = {
    artifactType: 'kstack-identity-trust-root', schemaVersion: 1, projectId: PROJECT,
    repositoryImmutableId: REPOSITORY,
    adapters: [{
      adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
      adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
      trustMaterialDigest: 'b'.repeat(64), allowedProviderPrincipalIds: ['4815162342'],
      allowedActions: ['pack-selection']
    }], policyVersion: 1, createdAt: '2026-08-01T00:00:00.000Z'
  };
  const evidence = {
    artifactType: 'kstack-github-protected-review-evidence', schemaVersion: 1,
    providerProtocol: 'github-rest-v3', endpointOrigin: 'https://api.github.com',
    repositoryId: REPOSITORY, pullRequestNumber: 88, headOid: 'c'.repeat(40),
    artifactPath: '.kstack/identity/selection.json', artifactBlobBase64: request.canonicalBytes.toString('base64'),
    baseRef: 'refs/heads/main',
    ruleset: { rulesetId: 'ruleset-88', targetBaseRef: 'refs/heads/main', active: true, requiresPullRequestReview: true, requiredApprovals: 1 },
    reviews: [{ reviewId: 'review-88', state: 'APPROVED', commitOid: 'c'.repeat(40), providerPrincipalId: '4815162342', dismissed: false, submittedAt: '2026-08-29T17:59:00.000Z' }],
    reviewsPaginationComplete: true, rulesetsPaginationComplete: true, capturedAt: NOW
  };
  const bodies = {
    repository: { repositoryId: REPOSITORY },
    'pull-request': { repositoryId: REPOSITORY, pullRequestNumber: 88, headOid: evidence.headOid, baseRef: evidence.baseRef, capturedAt: NOW },
    'artifact-blob': { repositoryId: REPOSITORY, commitOid: evidence.headOid, artifactPath: evidence.artifactPath, artifactBlobBase64: evidence.artifactBlobBase64 },
    ruleset: { repositoryId: REPOSITORY, baseRef: evidence.baseRef, ruleset: evidence.ruleset, rulesetsPaginationComplete: true },
    reviews: { repositoryId: REPOSITORY, pullRequestNumber: 88, reviews: evidence.reviews, reviewsPaginationComplete: true }
  };
  const verification = {
    requestBytes: request.canonicalBytes, expectedRequestDigest: request.requestDigest,
    trustRootBytes: hostCanonicalBytes(trustRoot), trustRootProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedTrustRootDigest: validateIdentityTrustRoot(trustRoot).trustRootDigest,
    adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId, adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
    pullRequestNumber: 88, candidateCommitOid: evidence.headOid, artifactPath: evidence.artifactPath,
    evidence,
    rawProviderResponses: ['repository', 'pull-request', 'artifact-blob', 'ruleset', 'reviews'].map((endpointId) => ({
      endpointId, status: 200, tlsVerified: true, authenticated: true, complete: true,
      trustMaterialDigest: 'b'.repeat(64), bodyBytes: hostCanonicalBytes(bodies[endpointId])
    })),
    trustedTime: { now: NOW, sourceProfileDigest: 'd'.repeat(64), attestationDigest: 'e'.repeat(64), qualified: true, rollbackDetected: false }
  };
  return verifyAndConsumeIdentityAction({ verification, inventory: new IdentityInventory(), ledger: new IdentityLedger() });
}

async function buildSelection() {
  const bundleBytes = Buffer.from('assurance-bundle');
  const material = createPackArtifact({ artifactType: 'kstack-pack-material', schemaVersion: 1, packId: 'assurance', version: '1.0.0', bundleDigest: sha(bundleBytes) });
  const compatibility = createPackArtifact({ artifactType: 'kstack-pack-compatibility-tuple', schemaVersion: 1, packId: 'assurance', version: '1.0.0', materialDigest: material.artifactDigest, compatible: true });
  const reviewPolicy = createPackArtifact({
    artifactType: 'kstack-pack-review-policy', schemaVersion: 1, policyVersion: 1,
    requiredReviewerClasses: ['primary-agent'], minimumConfidence: 93,
    requiredChecks: ['artifact-integrity', 'compatibility', 'policy-conformance', 'security', 'test-evidence'],
    blockOnSecurityFinding: true, blockOnMaterialDissent: true, blockOnUnresolvedQuestion: true
  });
  const approvalPolicy = createPackArtifact({
    artifactType: 'kstack-pack-approval-policy', schemaVersion: 1, policyVersion: 1,
    acceptedReviewVerdicts: ['approve'], requireAllReviewChecks: true,
    requireIndependentApproval: true, allowedApprovalClasses: ['independent-agent']
  });
  const review = createPackArtifact({
    artifactType: 'kstack-pack-review', schemaVersion: 1, materialDigest: material.artifactDigest,
    compatibilityTupleDigest: compatibility.artifactDigest, reviewPolicyDigest: reviewPolicy.artifactDigest,
    verdict: 'approve', reviewerClass: 'primary-agent', confidence: 96,
    passedChecks: ['artifact-integrity', 'compatibility', 'policy-conformance', 'security', 'test-evidence'],
    securityFindingCount: 0, materialDissentCount: 0, unresolvedQuestionCount: 0
  });
  const approval = createPackArtifact({
    artifactType: 'kstack-pack-approval', schemaVersion: 1, materialDigest: material.artifactDigest,
    reviewArtifactDigest: review.artifactDigest, approvalPolicyDigest: approvalPolicy.artifactDigest,
    acceptedVerdict: 'approve', approvalClass: 'independent-agent', independentFromReviewer: true
  });
  const entry = { packId: 'assurance', version: '1.0.0', materialDigest: material.artifactDigest, compatibilityTupleDigest: compatibility.artifactDigest, reviewArtifactDigest: review.artifactDigest, approvalArtifactDigest: approval.artifactDigest };
  const snapshot = createPackArtifact({ artifactType: 'kstack-pack-snapshot', schemaVersion: 1, generation: 9, repositoryPolicyDigest: REPOSITORY_POLICY, entries: [entry] });
  const selection = createPackSelection({
    subjectDigest: raw('subject'), repositoryPolicyDigest: REPOSITORY_POLICY,
    snapshotDigest: snapshot.artifactDigest, expectedGeneration: 9, orderedEntries: [entry],
    compositionInputs: [{ role: 'objective', digest: raw('objective') }], expiresAt: '2026-08-29T18:10:00.000Z'
  });
  const artifacts = [material, compatibility, reviewPolicy, approvalPolicy, review, approval, snapshot, selection];
  const inventory = createValidationInventory({ operationReceiptDigest: raw('selection-operation'), artifacts: artifacts.map((item) => ({ artifactType: item.record.artifactType, digest: item.artifactDigest, bytes: item.canonicalBytes })) });
  const acceptance = await ownerAcceptance(selection.artifactDigest);
  const admission = validatePackSelection({
    selectionBytes: selection.canonicalBytes, expectedSelectionDigest: selection.artifactDigest,
    inventoryBytes: inventory.canonicalBytes, expectedInventoryDigest: inventory.inventoryDigest,
    expectedOperationReceiptDigest: raw('selection-operation'), expectedRepositoryPolicyDigest: REPOSITORY_POLICY,
    liveGuard: { snapshotDigest: snapshot.artifactDigest, generation: 9 }, ownerAcceptance: acceptance,
    trustedTime: { now: NOW, sourceProfileDigest: '1'.repeat(64), attestationDigest: '2'.repeat(64), qualified: true, rollbackDetected: false }
  });
  return { admission, selection, snapshot, bundleBytes };
}

function keyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { privateKey, publicKeyBase64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') };
}

test('producer trust keys bind the declared Ed25519 algorithm to the actual SPKI key type', () => {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsa = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  code('PRODUCER_TRUST_ROOT_INVALID', () => validateProducerTrustRoot({
    artifactType: 'kstack-producer-trust-root', schemaVersion: 1, projectId: PROJECT,
    repositoryImmutableId: REPOSITORY,
    keys: [{ keyId: 'root-key-1', algorithm: 'ed25519', publicKeyBase64: rsa, status: 'active', qualified: true }],
    policyVersion: 1, effectiveAt: '2026-08-01T00:00:00.000Z'
  }));
});

function signRecord(privateKey, domain, record) {
  const unsigned = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'signatureBase64'));
  return crypto.sign(null, Buffer.concat([Buffer.from(domain), hostCanonicalBytes(unsigned)]), privateKey).toString('base64');
}

async function buildFixture(options = {}) {
  const selected = await buildSelection();
  const content = createD5Artifact({
    artifactType: 'kstack-pack-content', schemaVersion: 1,
    sections: [{
      id: 'readiness', appliesTo: ['objective'],
      questions: [{ id: 'health', text: 'Is the service healthy?', answerKind: 'status-evidence', evidenceIds: ['health-proof'] }]
    }]
  });
  const contentBytes = content.canonicalBytes;
  const evidenceSchema = createD5Artifact({
    artifactType: 'kstack-pack-evidence-schema', schemaVersion: 1,
    requirements: [{
      evidenceId: 'health-proof', allowedSourceClasses: ['health-observation'],
      allowedObservationKinds: ['absence', 'asserts', 'refutes'],
      minimumCount: 1, maximumCount: 2, freshnessPolicyId: 'release-immediate',
      requiredFor: ['contradicted', 'supported']
    }]
  });
  const compatibilityBytes = Buffer.from('compatibility-matrix');
  const baseBriefBytes = Buffer.from('base brief\n');
  const baseLaneBytes = Buffer.from('base lane contract');
  const tokenizerBytes = Buffer.from('tokenizer receipt');
  const packPromptBytes = Buffer.from('assurance questions\n');
  const compositionInput = {
    selectionAdmission: selected.admission, projectId: PROJECT, repositoryImmutableId: REPOSITORY,
    compatibilityMatrixDigest: sha(compatibilityBytes), baseBriefDigest: sha(baseBriefBytes),
    baseLaneContractDigest: sha(baseLaneBytes),
    orderedPacks: [{ packId: 'assurance', version: '1.0.0', bundleDigest: sha(selected.bundleBytes), contentDigest: content.artifactDigest, evidenceSchemaDigest: evidenceSchema.artifactDigest }],
    renderedInventory: [{ packId: 'assurance', sectionId: 'readiness', questionId: 'health', orderedEvidenceIds: ['health-proof'] }],
    basePromptBytes: baseBriefBytes, orderedPackPromptBytes: [packPromptBytes],
    tokenizerReceiptDigest: sha(tokenizerBytes),
    subordinateArtifacts: {
      compatibilityMatrixBytes: compatibilityBytes, baseBriefBytes,
      baseLaneContractBytes: baseLaneBytes, tokenizerReceiptBytes: tokenizerBytes,
      orderedPackArtifacts: [{ packId: 'assurance', bundleBytes: selected.bundleBytes, contentBytes, evidenceSchemaBytes: evidenceSchema.canonicalBytes }]
    },
    composedAt: NOW
  };
  const composition = composePackPrompt(compositionInput);
  const providerRequestBody = Buffer.from('provider request body');
  const providerConfiguration = Buffer.from('provider configuration');
  const modelConfiguration = Buffer.from('model configuration');
  const dispatchPolicy = Buffer.from('dispatch policy');
  const budgetReceipt = Buffer.from('budget receipt');
  const freshnessReceipt = Buffer.from('freshness receipt');
  const dispatchAdmissions = new Map();
  const dispatchAdmissionLedger = {
    async capabilities() { return { durableAdmission: true, uniqueInvocation: true, guardedCheckpoints: true, idempotentRecovery: true }; },
    async recordAdmission(record) {
      const existing = dispatchAdmissions.get(record.invocationId);
      if (existing) return { outcome: 'recovered', receiptDigest: existing.receiptDigest, invocationId: existing.invocationId, checkpointDigest: existing.checkpointDigest, generation: existing.generation };
      const stored = { ...record, checkpointDigest: raw(`dispatch-admission-${record.invocationId}`), generation: dispatchAdmissions.size + 1 };
      dispatchAdmissions.set(record.invocationId, stored);
      return { outcome: 'recorded', receiptDigest: stored.receiptDigest, invocationId: stored.invocationId, checkpointDigest: stored.checkpointDigest, generation: stored.generation };
    }
  };
  const dispatchInput = {
    composition, providerRequestBodyBytes: providerRequestBody,
    providerConfigurationDigest: sha(providerConfiguration), modelConfigurationDigest: sha(modelConfiguration),
    dispatchPolicyDigest: sha(dispatchPolicy), budgetReceiptDigest: sha(budgetReceipt),
    freshnessReceiptDigest: sha(freshnessReceipt), invocationId: 'invocation-1', admittedAt: NOW,
    catalogAuthority: { async confirmCurrent(value) { return { current: true, ...value, checkpointDigest: raw('catalog-checkpoint'), rollbackDetected: false }; } },
    budgetAuthority: { async confirmCurrent(value) { return { admitted: true, current: true, receiptDigest: value.receiptDigest, checkpointDigest: raw('budget-checkpoint'), rollbackDetected: false }; } },
    freshnessAuthority: { async confirmCurrent(value) { return { admitted: true, current: true, receiptDigest: value.receiptDigest, checkpointDigest: raw('freshness-checkpoint'), rollbackDetected: false }; } },
    admissionLedger: dispatchAdmissionLedger
  };
  const dispatch = await admitPackDispatch(dispatchInput);

  const rootKey = keyPair();
  const brokerKey = keyPair();
  const producerTrustRoot = {
    artifactType: 'kstack-producer-trust-root', schemaVersion: 1, projectId: PROJECT,
    repositoryImmutableId: REPOSITORY,
    keys: [{ keyId: 'root-key-1', algorithm: 'ed25519', publicKeyBase64: rootKey.publicKeyBase64, status: 'active', qualified: true }],
    policyVersion: 1, effectiveAt: '2026-08-01T00:00:00.000Z'
  };
  const trustRootResult = validateProducerTrustRoot(producerTrustRoot);
  const producerContractDigest = raw('producer-contract');
  const producerPolicyDigest = raw('producer-policy');
  const workloadIdentityDigest = raw('workload-identity');
  const unsignedPolicy = {
    artifactType: 'kstack-producer-policy-snapshot', schemaVersion: 1, projectId: PROJECT,
    repositoryImmutableId: REPOSITORY, generation: 4, predecessorSnapshotDigest: raw('prior-policy'),
    producerTrustRootDigest: trustRootResult.producerTrustRootDigest,
    producers: [{ workflowClass: 'health-workflow', producerContractDigest, producerPolicyDigest, workloadIdentityDigest, allowedSourceClasses: ['health-observation'], status: 'active' }],
    brokerKeys: [{ keyId: 'broker-key-1', algorithm: 'ed25519', publicKeyBase64: brokerKey.publicKeyBase64, status: 'active', qualified: true }],
    revokedAttestationNonces: options.revokedAttestationNonces ?? [], issuedAt: '2026-08-29T17:55:00.000Z', expiresAt: '2026-08-29T18:10:00.000Z',
    signatureKeyId: 'root-key-1'
  };
  const producerPolicy = createResultArtifact({
    ...unsignedPolicy,
    signatureBase64: signRecord(rootKey.privateKey, 'KSTACK-PRODUCER-POLICY-SNAPSHOT-SIGNATURE-V1\n', unsignedPolicy)
  });
  const nativeEvidence = {
    artifactType: 'kstack-native-evidence-record', schemaVersion: 1,
    sourceClass: 'health-observation', sourceLocatorDigest: raw('protected-locator'),
    sourceBytesBase64: Buffer.from('healthy').toString('base64'), nativeReceiptDigest: raw('native-health-receipt')
  };
  const nativeEvidenceResult = createResultArtifact(nativeEvidence);
  const observationKind = options.observationKind ?? 'asserts';
  const descriptor = {
    artifactType: 'kstack-workflow-evidence-descriptor', schemaVersion: 1,
    projectId: PROJECT, repositoryImmutableId: REPOSITORY, workflowClass: 'health-workflow',
    producerContractDigest, producerPolicyDigest, subjectDigest: selected.admission.projection.subjectDigest,
    compositionReceiptDigest: composition.receiptDigest, dispatchReceiptDigest: dispatch.receiptDigest,
    packId: 'assurance', questionId: 'health', evidenceId: 'health-proof', evidenceOrdinal: 0,
    sourceClass: 'health-observation',
    sourceLocatorDigest: nativeEvidence.sourceLocatorDigest, sourceDigest: nativeEvidenceResult.artifactDigest,
    observationKind, observedAt: '2026-08-29T17:58:00.000Z', producedAt: NOW,
    expiresAt: '2026-08-29T18:05:00.000Z', producerInvocationId: 'invocation-1'
  };
  const attestationInput = {
    composition, dispatch, descriptor, nativeEvidence, workloadIdentityDigest,
    expectedProducerPolicySnapshotDigest: producerPolicy.artifactDigest,
    nonce: 'f'.repeat(32), issuedAt: NOW, expiresAt: '2026-08-29T18:05:00.000Z',
    nativeEvidenceAuthority: { async verifyEvidence(value) { return { verified: true, current: true, sourceDigest: value.sourceDigest, nativeReceiptDigest: value.nativeReceiptDigest, sourceLocatorDigest: value.sourceLocatorDigest, checkpointDigest: raw('native-evidence-checkpoint'), rollbackDetected: false }; } },
    policyAuthority: { async qualifyProducer() { return { qualified: true, current: true, snapshotDigest: producerPolicy.artifactDigest, generation: 4, brokerKeyId: 'broker-key-1', policyCheckpointDigest: raw('producer-policy-checkpoint'), rollbackDetected: false }; } },
    signer: { async sign({ keyId, transcript }) { return { keyId, signatureBase64: crypto.sign(null, transcript, brokerKey.privateKey).toString('base64') }; } }
  };
  const attested = await attestWorkflowEvidence(attestationInput);
  const providerResponse = Buffer.from('provider response');
  const observation = Buffer.from('analysis observation');
  const analysis = createResultArtifact({
    artifactType: 'kstack-pack-analysis-result', schemaVersion: 1,
    compositionReceiptDigest: composition.receiptDigest, dispatchReceiptDigest: dispatch.receiptDigest,
    providerResponseDigest: sha(providerResponse), subjectDigest: selected.admission.projection.subjectDigest,
    answers: [{ packId: 'assurance', sectionId: 'readiness', questionId: 'health', disposition: options.disposition ?? 'supported', evidenceIds: ['health-proof'], observationDigest: sha(observation) }]
  });
  const artifacts = [
    resultEntry(createResultArtifact(composition.receipt)), resultEntry(createResultArtifact(dispatch.receipt)), resultEntry(analysis),
    { artifactType: 'kstack-pack-selection', digest: selected.selection.artifactDigest, bytes: selected.selection.canonicalBytes },
    { artifactType: 'kstack-pack-snapshot', digest: selected.snapshot.artifactDigest, bytes: selected.snapshot.canonicalBytes },
    rawEntry('kstack-final-prompt', composition.finalPromptBytes), rawEntry('kstack-repository-policy', REPOSITORY_POLICY_BYTES),
    rawEntry('kstack-compatibility-matrix', compatibilityBytes), rawEntry('kstack-base-brief', baseBriefBytes),
    rawEntry('kstack-base-lane-contract', baseLaneBytes), rawEntry('kstack-tokenizer-receipt', tokenizerBytes),
    rawEntry('kstack-pack-bundle', selected.bundleBytes), resultEntry(content), resultEntry(evidenceSchema),
    rawEntry('kstack-provider-request-body', providerRequestBody), rawEntry('kstack-provider-configuration', providerConfiguration),
    rawEntry('kstack-model-configuration', modelConfiguration), rawEntry('kstack-dispatch-policy', dispatchPolicy),
    rawEntry('kstack-budget-receipt', budgetReceipt), rawEntry('kstack-freshness-receipt', freshnessReceipt),
    rawEntry('kstack-provider-response', providerResponse), rawEntry('kstack-observation-bytes', observation),
    resultEntry(attested.nativeEvidence), resultEntry(attested.descriptor), resultEntry(producerPolicy), resultEntry(attested.attestation)
  ];
  const inventory = createResultValidationInventory({ operationReceiptDigest: OPERATION, artifacts });
  const candidateInput = {
    inventoryBytes: inventory.canonicalBytes, expectedInventoryDigest: inventory.inventoryDigest,
    expectedOperationReceiptDigest: OPERATION, expectedCompositionDigest: composition.receiptDigest,
    expectedDispatchDigest: dispatch.receiptDigest, expectedAnalysisResultDigest: analysis.artifactDigest,
    producerTrustRootBytes: hostCanonicalBytes(producerTrustRoot),
    producerTrustRootProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedProducerTrustRootDigest: trustRootResult.producerTrustRootDigest,
    trustedTime: { now: NOW, sourceProfileDigest: '3'.repeat(64), attestationDigest: '4'.repeat(64), qualified: true, rollbackDetected: false },
    freshnessPolicyProjection: {
      policyDigest: raw('evidence-freshness-policy'), trustedTimeReceiptDigest: raw('evidence-trusted-time-receipt'),
      qualified: true, rollbackDetected: false, maxFutureSkewMs: 1_000,
      policies: [
        { freshnessPolicyId: 'release-immediate', maxAgeMs: 300_000 },
        { freshnessPolicyId: 'release-window', maxAgeMs: 3_600_000 },
        { freshnessPolicyId: 'repository-snapshot', maxAgeMs: 86_400_000 },
        { freshnessPolicyId: 'timeless-digest', maxAgeMs: null }
      ]
    },
    validatorImplementationDigest: raw('validator-implementation'), validatorSchemaDigest: raw('validator-schema'),
    coordinatorPolicyDigest: raw('coordinator-policy'), transactionId: 'transaction-1'
  };
  return {
    selected, compositionInput, composition, dispatchInput, dispatch, dispatchAdmissions,
    attestationInput, analysis, attested, producerPolicy, producerTrustRoot,
    inventory, candidateInput
  };
}

class ValidationLedger {
  stored = new Map();
  split = false;

  async capabilities() {
    return { atomicNonceSetAndReceipt: !this.split, guardedPolicyCompareAndSwap: !this.split, serializable: true, idempotentRecovery: true };
  }

  async transactValidation(record) {
    const existing = this.stored.get(record.transactionId);
    if (existing) return {
      outcome: 'recovered', receipt: existing.receipt, receiptDigest: existing.receiptDigest,
      inputSetDigest: existing.inputSetDigest, consumedNonces: existing.consumedNonces,
      producerPolicySnapshotDigest: existing.expectedProducerPolicySnapshotDigest,
      producerPolicyGeneration: existing.expectedProducerPolicyGeneration,
      policyCheckpointDigest: existing.expectedPolicyCheckpointDigest,
      dispatchAdmissionCheckpointDigest: existing.expectedDispatchAdmissionCheckpointDigest,
      dispatchAdmissionGeneration: existing.expectedDispatchAdmissionGeneration
    };
    this.stored.set(record.transactionId, structuredClone(record));
    return {
      outcome: 'committed', receipt: record.receipt, receiptDigest: record.receiptDigest,
      inputSetDigest: record.inputSetDigest, consumedNonces: record.consumedNonces,
      producerPolicySnapshotDigest: record.expectedProducerPolicySnapshotDigest,
      producerPolicyGeneration: record.expectedProducerPolicyGeneration,
      policyCheckpointDigest: record.expectedPolicyCheckpointDigest,
      dispatchAdmissionCheckpointDigest: record.expectedDispatchAdmissionCheckpointDigest,
      dispatchAdmissionGeneration: record.expectedDispatchAdmissionGeneration
    };
  }
}

function commitInput(fixture, ledger, time = '2026-08-29T18:01:00.000Z', nonceState = 'unconsumed') {
  const decision = validateResultCandidate(fixture.candidateInput);
  return {
    candidateInput: fixture.candidateInput, expectedDecisionBytes: decision.decisionBytes,
    expectedDecisionDigest: decision.decisionDigest,
    coordinatorImplementationDigest: raw('coordinator-implementation'), coordinatorSchemaDigest: raw('coordinator-schema'),
    dispatchAdmissionAuthority: { async confirmAdmitted() { return { admitted: true, compositionReceiptDigest: fixture.composition.receiptDigest, dispatchReceiptDigest: fixture.dispatch.receiptDigest, checkpointDigest: fixture.dispatch.admissionCheckpointDigest, generation: fixture.dispatch.admissionGeneration, rollbackDetected: false }; } },
    producerPolicyAuthority: { async confirmCurrent(value) { return { current: true, generation: value.generation, snapshotDigest: value.snapshotDigest, allKeysQualified: true, noneRevoked: true, nonceState, checkpointDigest: raw('commit-policy-checkpoint'), rollbackDetected: false }; } },
    trustedTimeAuthority: { async current() { return { now: time, sourceProfileDigest: '5'.repeat(64), attestationDigest: '6'.repeat(64), qualified: true, rollbackDetected: false }; } },
    ledger
  };
}

test('D4 composition and dispatch are branded, immutable, and stale-guarded before any result exists', async () => {
  const fixture = await buildFixture();
  assert.equal(Object.isFrozen(fixture.composition.receipt), true);
  assert.equal(fixture.dispatch.receipt.finalPromptDigest, fixture.composition.receipt.finalPromptDigest);
  code('PACK_SELECTION_VALIDATED_RESULT_INVALID', () => composePackPrompt({
    selectionAdmission: structuredClone(fixture.selected.admission), projectId: PROJECT,
    repositoryImmutableId: REPOSITORY, compatibilityMatrixDigest: raw('compatibility'),
    baseBriefDigest: raw('brief'), baseLaneContractDigest: raw('lane'), orderedPacks: [],
    renderedInventory: [], basePromptBytes: Buffer.from('prompt'), orderedPackPromptBytes: [],
    tokenizerReceiptDigest: raw('tokenizer'),
    subordinateArtifacts: {
      compatibilityMatrixBytes: Buffer.alloc(0), baseBriefBytes: Buffer.alloc(0),
      baseLaneContractBytes: Buffer.alloc(0), tokenizerReceiptBytes: Buffer.alloc(0), orderedPackArtifacts: []
    },
    composedAt: NOW
  }));
  await asyncCode('DISPATCH_ADMISSION_INVALID', () => admitPackDispatch({
    ...fixture.dispatchInput, composition: structuredClone(fixture.composition)
  }));
  code('COMPOSITION_INPUT_STALE', () => composePackPrompt({
    ...fixture.compositionInput,
    subordinateArtifacts: {
      ...fixture.compositionInput.subordinateArtifacts,
      orderedPackArtifacts: [{
        ...fixture.compositionInput.subordinateArtifacts.orderedPackArtifacts[0],
        contentBytes: Buffer.from('substituted-content')
      }]
    }
  }));
  await asyncCode('BUDGET_ADMISSION_STALE', () => admitPackDispatch({
    ...fixture.dispatchInput,
    budgetAuthority: { async confirmCurrent(value) { return { admitted: false, current: true, receiptDigest: value.receiptDigest, checkpointDigest: raw('budget-checkpoint'), rollbackDetected: false }; } }
  }));
  await asyncCode('FRESHNESS_ADMISSION_STALE', () => admitPackDispatch({
    ...fixture.dispatchInput,
    freshnessAuthority: { async confirmCurrent(value) { return { admitted: true, current: true, receiptDigest: raw('substituted'), checkpointDigest: raw('freshness-checkpoint'), rollbackDetected: false }; } }
  }));
  await asyncCode('DISPATCH_ADMISSION_INVALID', () => admitPackDispatch({
    ...fixture.dispatchInput, admittedAt: '2026-08-29T17:59:59.999Z'
  }));
  await asyncCode('DISPATCH_ADMISSION_CAPABILITY_UNMET', () => admitPackDispatch({
    ...fixture.dispatchInput,
    admissionLedger: {
      async capabilities() { return { durableAdmission: false, uniqueInvocation: true, guardedCheckpoints: true, idempotentRecovery: true }; },
      async recordAdmission() { throw new Error('must-not-run'); }
    }
  }));
  await asyncCode('DISPATCH_ADMISSION_CONFLICT', () => admitPackDispatch({
    ...fixture.dispatchInput,
    admissionLedger: {
      async capabilities() { return { durableAdmission: true, uniqueInvocation: true, guardedCheckpoints: true, idempotentRecovery: true }; },
      async recordAdmission(record) { return { outcome: 'recorded', receiptDigest: raw('substituted-dispatch'), invocationId: record.invocationId, checkpointDigest: raw('dispatch-admission'), generation: 1 }; }
    }
  }));
});

test('D10 authenticates workflow-owned evidence and pure validation emits supported only for complete assertions', async () => {
  const fixture = await buildFixture();
  const decision = validateResultCandidate(fixture.candidateInput);
  assert.equal(decision.decision.orderedDispositions[0].disposition, 'supported');
  assert.deepEqual(decision.decision.orderedDispositions[0].reasonCodes, ['SUPPORTED_EVIDENCE_AUTHENTICATED']);
  assert.equal(decision.attestationNonces.length, 1);

  const absence = await buildFixture({ observationKind: 'absence' });
  const downgraded = validateResultCandidate(absence.candidateInput);
  assert.equal(downgraded.decision.orderedDispositions[0].disposition, 'unknown');
  assert.deepEqual(downgraded.decision.orderedDispositions[0].reasonCodes, ['SUPPORTED_EVIDENCE_UNSATISFIED']);

  const contradicted = await buildFixture({ disposition: 'contradicted', observationKind: 'refutes' });
  const contradiction = validateResultCandidate(contradicted.candidateInput);
  assert.equal(contradiction.decision.orderedDispositions[0].disposition, 'contradicted');
  assert.deepEqual(contradiction.decision.orderedDispositions[0].reasonCodes, ['CONTRADICTORY_EVIDENCE_AUTHENTICATED']);
  const unsupportedContradiction = await buildFixture({ disposition: 'contradicted', observationKind: 'asserts' });
  assert.equal(validateResultCandidate(unsupportedContradiction.candidateInput).decision.orderedDispositions[0].disposition, 'unknown');
});

test('evidence broker rejects unadmitted dispatches, cross-bound descriptors, unverified native evidence, and unqualified producers', async () => {
  const fixture = await buildFixture();
  await asyncCode('DISPATCH_NOT_ADMITTED', () => attestWorkflowEvidence({
    ...fixture.attestationInput, dispatch: structuredClone(fixture.dispatch)
  }));
  await asyncCode('EVIDENCE_SOURCE_DIGEST_MISMATCH', () => attestWorkflowEvidence({
    ...fixture.attestationInput,
    descriptor: { ...fixture.attestationInput.descriptor, subjectDigest: raw('cross-bound-subject') }
  }));
  await asyncCode('EVIDENCE_SOURCE_DIGEST_MISMATCH', () => attestWorkflowEvidence({
    ...fixture.attestationInput,
    nativeEvidenceAuthority: { async verifyEvidence(value) { return { verified: false, current: true, sourceDigest: value.sourceDigest, nativeReceiptDigest: value.nativeReceiptDigest, sourceLocatorDigest: value.sourceLocatorDigest, checkpointDigest: raw('native-evidence-checkpoint'), rollbackDetected: false }; } }
  }));
  await asyncCode('PRODUCER_UNQUALIFIED', () => attestWorkflowEvidence({
    ...fixture.attestationInput,
    policyAuthority: { async qualifyProducer() { return { qualified: false, current: true, snapshotDigest: fixture.producerPolicy.artifactDigest, generation: 4, brokerKeyId: 'broker-key-1', policyCheckpointDigest: raw('producer-policy-checkpoint'), rollbackDetected: false }; } }
  }));
});

test('pure validation rejects inventory additions, missing evidence, binding changes, and untrusted roots', async () => {
  const fixture = await buildFixture();
  const extra = createResultValidationInventory({
    operationReceiptDigest: OPERATION,
    artifacts: [...fixture.inventory.record.entries.map((entry) => ({ artifactType: entry.artifactType, digest: entry.digest, bytes: Buffer.from(entry.bytesBase64, 'base64') })), rawEntry('kstack-observation-bytes', Buffer.from('uncited'))]
  });
  code('RESULT_INVENTORY_MISMATCH', () => validateResultCandidate({ ...fixture.candidateInput, inventoryBytes: extra.canonicalBytes, expectedInventoryDigest: extra.inventoryDigest }));

  const withoutAttestation = fixture.inventory.record.entries.filter((entry) => entry.artifactType !== 'kstack-workflow-evidence-attestation').map((entry) => ({ artifactType: entry.artifactType, digest: entry.digest, bytes: Buffer.from(entry.bytesBase64, 'base64') }));
  const missing = createResultValidationInventory({ operationReceiptDigest: OPERATION, artifacts: withoutAttestation });
  code('EVIDENCE_DESCRIPTOR_MISSING', () => validateResultCandidate({ ...fixture.candidateInput, inventoryBytes: missing.canonicalBytes, expectedInventoryDigest: missing.inventoryDigest }));
  code('PRODUCER_TRUST_ROOT_UNAVAILABLE', () => validateResultCandidate({ ...fixture.candidateInput, producerTrustRootProtection: { source: 'repository', repositoryResident: true, protected: false } }));

  code('EVIDENCE_STALE', () => validateResultCandidate({
    ...fixture.candidateInput,
    trustedTime: { ...fixture.candidateInput.trustedTime, now: '2026-08-29T18:04:00.000Z' }
  }));
  const nonceDigest = sha(Buffer.concat([
    Buffer.from('KSTACK-ATTESTATION-NONCE-V1\n'), Buffer.from('f'.repeat(32))
  ]));
  const revoked = await buildFixture({ revokedAttestationNonces: [nonceDigest] });
  code('ATTESTATION_REPLAYED', () => validateResultCandidate(revoked.candidateInput));
});

test('commit coordinator reruns validation and atomically commits or recovers one nonce set and receipt', async () => {
  const fixture = await buildFixture();
  const ledger = new ValidationLedger();
  const first = await commitResultValidation(commitInput(fixture, ledger));
  assert.equal(first.outcome, 'committed');
  assert.equal(first.receipt.consumedNonces.length, 1);
  const recovered = await commitResultValidation(commitInput(fixture, ledger, '2026-08-29T18:02:00.000Z', 'consumed-by-transaction'));
  assert.equal(recovered.outcome, 'recovered');
  assert.equal(recovered.receiptDigest, first.receiptDigest);

  const split = new ValidationLedger();
  split.split = true;
  await asyncCode('VALIDATION_ATOMICITY_CAPABILITY_UNMET', () => commitResultValidation(commitInput(fixture, split)));

  const racing = new ValidationLedger();
  const outcomes = await Promise.all([
    commitResultValidation(commitInput(fixture, racing)),
    commitResultValidation(commitInput(fixture, racing))
  ]);
  assert.deepEqual(outcomes.map((entry) => entry.outcome).sort(), ['committed', 'recovered']);
  assert.equal(racing.stored.size, 1);
});

test('commit recovery rejects a stored receipt substitution and recovers an exact post-commit crash', async () => {
  const fixture = await buildFixture();
  const substituted = new ValidationLedger();
  await commitResultValidation(commitInput(fixture, substituted));
  const stored = substituted.stored.get('transaction-1');
  stored.receipt.orderedDispositions[0].disposition = 'unknown';
  stored.receiptDigest = sha(Buffer.concat([
    Buffer.from('KSTACK-RESULT-VALIDATION-RECEIPT-V1\n'), hostCanonicalBytes(stored.receipt)
  ]));
  await asyncCode('VALIDATION_TRANSACTION_CONFLICT', () => commitResultValidation(
    commitInput(fixture, substituted, '2026-08-29T18:02:00.000Z', 'consumed-by-transaction')
  ));

  class CrashAfterCommitLedger extends ValidationLedger {
    crashed = false;
    async transactValidation(record) {
      const result = await super.transactValidation(record);
      if (!this.crashed) { this.crashed = true; throw new Error('simulated-post-commit-crash'); }
      return result;
    }
  }
  const crash = new CrashAfterCommitLedger();
  await assert.rejects(() => commitResultValidation(commitInput(fixture, crash)), /simulated-post-commit-crash/u);
  const recovered = await commitResultValidation(commitInput(fixture, crash, '2026-08-29T18:02:00.000Z', 'consumed-by-transaction'));
  assert.equal(recovered.outcome, 'recovered');
});

test('coordinator rejects stale policy, nonce conflict, expired decision, and decision substitution', async () => {
  const fixture = await buildFixture();
  const ledger = new ValidationLedger();
  await asyncCode('DISPATCH_NOT_ADMITTED', () => commitResultValidation({
    ...commitInput(fixture, ledger),
    dispatchAdmissionAuthority: { async confirmAdmitted() { return { admitted: false, compositionReceiptDigest: fixture.composition.receiptDigest, dispatchReceiptDigest: fixture.dispatch.receiptDigest, checkpointDigest: fixture.dispatch.admissionCheckpointDigest, generation: fixture.dispatch.admissionGeneration, rollbackDetected: false }; } }
  }));
  await asyncCode('PRODUCER_POLICY_STALE', () => commitResultValidation({
    ...commitInput(fixture, ledger),
    producerPolicyAuthority: { async confirmCurrent(value) { return { current: false, generation: value.generation, snapshotDigest: value.snapshotDigest, allKeysQualified: true, noneRevoked: true, nonceState: 'unconsumed', checkpointDigest: raw('x'), rollbackDetected: false }; } }
  }));
  await asyncCode('ATTESTATION_REPLAYED', () => commitResultValidation(commitInput(fixture, ledger, '2026-08-29T18:01:00.000Z', 'conflict')));
  await asyncCode('VALIDATION_DECISION_EXPIRED', () => commitResultValidation(commitInput(fixture, ledger, '2026-08-29T18:05:00.000Z')));
  const valid = commitInput(fixture, ledger);
  await asyncCode('VALIDATION_TRANSACTION_CONFLICT', () => commitResultValidation({ ...valid, expectedDecisionDigest: 'f'.repeat(64) }));
});
