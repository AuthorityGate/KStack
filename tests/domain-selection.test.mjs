import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  PACK_APPROVAL_AUTHORITY_SCOPE,
  APPROVAL_CLASSES,
  REVIEW_CHECKS,
  REVIEWER_CLASSES,
  createPackArtifact,
  createPackSelection,
  createValidationInventory,
  parsePackArtifact,
  validateApprovalGraph,
  validatePackSelection
} from '../plugins/kstack/scripts/kstack-domain-selection.mjs';
import {
  GITHUB_PROTECTED_REVIEW_ADAPTER,
  createIdentityActionRequest,
  validateIdentityTrustRoot,
  verifyAndConsumeIdentityAction
} from '../plugins/kstack/scripts/kstack-domain-identity.mjs';
import { hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';

const ZERO = '0'.repeat(64);
const OPERATION = '1'.repeat(64);
const REPOSITORY_POLICY = '2'.repeat(64);
const SUBJECT = '3'.repeat(64);
const BUNDLE = '4'.repeat(64);
const NOW = '2026-08-29T16:00:00.000Z';

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, `expected ${expected}`);
}

function artifact(record) {
  return createPackArtifact(record);
}

function inventoryArtifact(result) {
  return { artifactType: result.record.artifactType, digest: result.artifactDigest, bytes: result.canonicalBytes };
}

function buildGraph(options = {}) {
  const reviewPolicy = artifact({
    artifactType: 'kstack-pack-review-policy', schemaVersion: 1, policyVersion: 1,
    requiredReviewerClasses: ['primary-agent'], minimumConfidence: options.minimumPolicyConfidence ?? 93,
    requiredChecks: [...REVIEW_CHECKS], blockOnSecurityFinding: true,
    blockOnMaterialDissent: true, blockOnUnresolvedQuestion: true
  });
  const approvalPolicy = artifact({
    artifactType: 'kstack-pack-approval-policy', schemaVersion: 1, policyVersion: 1,
    acceptedReviewVerdicts: ['approve'], requireAllReviewChecks: true,
    requireIndependentApproval: options.policyRequiresIndependence ?? true, allowedApprovalClasses: ['independent-agent']
  });
  const material = artifact({
    artifactType: 'kstack-pack-material', schemaVersion: 1,
    packId: 'assurance', version: '1.0.0', bundleDigest: BUNDLE
  });
  const alternateMaterial = artifact({
    artifactType: 'kstack-pack-material', schemaVersion: 1,
    packId: 'assurance', version: '1.0.1', bundleDigest: '5'.repeat(64)
  });
  const reviewMaterial = options.crossTierMismatch ? alternateMaterial : material;
  const compatibility = artifact({
    artifactType: 'kstack-pack-compatibility-tuple', schemaVersion: 1,
    packId: reviewMaterial.record.packId, version: reviewMaterial.record.version,
    materialDigest: reviewMaterial.artifactDigest, compatible: true
  });
  const review = artifact({
    artifactType: 'kstack-pack-review', schemaVersion: 1,
    materialDigest: reviewMaterial.artifactDigest,
    compatibilityTupleDigest: compatibility.artifactDigest,
    reviewPolicyDigest: reviewPolicy.artifactDigest,
    verdict: 'approve', reviewerClass: 'primary-agent',
    confidence: options.confidence ?? 96,
    passedChecks: [...REVIEW_CHECKS], securityFindingCount: options.securityFindingCount ?? 0,
    materialDissentCount: 0, unresolvedQuestionCount: 0
  });
  const approval = artifact({
    artifactType: 'kstack-pack-approval', schemaVersion: 1,
    materialDigest: material.artifactDigest, reviewArtifactDigest: review.artifactDigest,
    approvalPolicyDigest: approvalPolicy.artifactDigest, acceptedVerdict: 'approve',
    approvalClass: 'independent-agent', independentFromReviewer: options.independentFromReviewer ?? true
  });
  const entry = {
    packId: material.record.packId, version: material.record.version,
    materialDigest: material.artifactDigest,
    compatibilityTupleDigest: compatibility.artifactDigest,
    reviewArtifactDigest: review.artifactDigest,
    approvalArtifactDigest: approval.artifactDigest
  };
  const snapshot = artifact({
    artifactType: 'kstack-pack-snapshot', schemaVersion: 1, generation: 8,
    repositoryPolicyDigest: REPOSITORY_POLICY, entries: [entry]
  });
  const selection = createPackSelection({
    subjectDigest: SUBJECT, repositoryPolicyDigest: REPOSITORY_POLICY,
    snapshotDigest: snapshot.artifactDigest, expectedGeneration: 8,
    orderedEntries: [entry],
    compositionInputs: [
      { role: 'implementation-plan', digest: '6'.repeat(64) },
      { role: 'objective', digest: '7'.repeat(64) },
      { role: 'qc', digest: '8'.repeat(64) },
      { role: 'release-observation', digest: '9'.repeat(64) }
    ],
    expiresAt: '2026-08-29T16:10:00.000Z'
  });
  const all = [reviewPolicy, approvalPolicy, material, alternateMaterial, compatibility, review, approval, snapshot, selection];
  const inventory = createValidationInventory({ operationReceiptDigest: OPERATION, artifacts: all.map(inventoryArtifact) });
  return { reviewPolicy, approvalPolicy, material, alternateMaterial, compatibility, review, approval, snapshot, selection, inventory };
}

class IdentityInventory {
  async retain(record) {
    return {
      retained: true,
      inventoryDigest: hash(Buffer.concat([Buffer.from('KSTACK-IDENTITY-OPERATION-INVENTORY-V1\n'), hostCanonicalBytes(record)]))
    };
  }
}

class IdentityLedger {
  generation = 0;
  checkpointDigest = ZERO;
  consumed = new Set();

  async inspect() {
    return { available: true, rollbackDetected: false, generation: this.generation, checkpointDigest: this.checkpointDigest };
  }

  async consumeOnce(record) {
    if (this.consumed.has(record.keyDigest)) return { consumed: false, generation: this.generation, previousCheckpointDigest: this.checkpointDigest, checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: hash(`replay:${record.keyDigest}`) };
    this.consumed.add(record.keyDigest);
    const previousCheckpointDigest = this.checkpointDigest;
    this.generation += 1;
    this.checkpointDigest = hash(hostCanonicalBytes({ previousCheckpointDigest, generation: this.generation, record }));
    return { consumed: true, generation: this.generation, previousCheckpointDigest, checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: hash(`witness:${this.checkpointDigest}`) };
  }
}

async function ownerAcceptance(targetDigest, policyDigest = REPOSITORY_POLICY) {
  const request = createIdentityActionRequest({
    projectId: 'authority-gate-kstack', repositoryImmutableId: '123456789',
    action: 'pack-selection', targetDigest, policyDigest,
    nonce: 'a'.repeat(32), notBefore: '2026-08-29T15:55:00.000Z', expiresAt: '2026-08-29T16:05:00.000Z'
  });
  const trustRoot = {
    artifactType: 'kstack-identity-trust-root', schemaVersion: 1,
    projectId: 'authority-gate-kstack', repositoryImmutableId: '123456789',
    adapters: [{
      adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
      adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
      trustMaterialDigest: 'b'.repeat(64), allowedProviderPrincipalIds: ['4815162342'],
      allowedActions: ['catalog-activation', 'pack-selection', 'policy-weakening', 'required-pack-waiver']
    }], policyVersion: 1, createdAt: '2026-08-01T00:00:00.000Z'
  };
  const evidence = {
    artifactType: 'kstack-github-protected-review-evidence', schemaVersion: 1,
    providerProtocol: 'github-rest-v3', endpointOrigin: 'https://api.github.com',
    repositoryId: '123456789', pullRequestNumber: 77, headOid: 'c'.repeat(40),
    artifactPath: '.kstack/identity/action-request.json', artifactBlobBase64: request.canonicalBytes.toString('base64'),
    baseRef: 'refs/heads/main',
    ruleset: { rulesetId: 'ruleset-42', targetBaseRef: 'refs/heads/main', active: true, requiresPullRequestReview: true, requiredApprovals: 1 },
    reviews: [{ reviewId: 'review-9001', state: 'APPROVED', commitOid: 'c'.repeat(40), providerPrincipalId: '4815162342', dismissed: false, submittedAt: '2026-08-29T15:59:00.000Z' }],
    reviewsPaginationComplete: true, rulesetsPaginationComplete: true, capturedAt: NOW
  };
  const bodies = {
    repository: { repositoryId: evidence.repositoryId },
    'pull-request': { repositoryId: evidence.repositoryId, pullRequestNumber: 77, headOid: evidence.headOid, baseRef: evidence.baseRef, capturedAt: NOW },
    'artifact-blob': { repositoryId: evidence.repositoryId, commitOid: evidence.headOid, artifactPath: evidence.artifactPath, artifactBlobBase64: evidence.artifactBlobBase64 },
    ruleset: { repositoryId: evidence.repositoryId, baseRef: evidence.baseRef, ruleset: evidence.ruleset, rulesetsPaginationComplete: true },
    reviews: { repositoryId: evidence.repositoryId, pullRequestNumber: 77, reviews: evidence.reviews, reviewsPaginationComplete: true }
  };
  const rawProviderResponses = ['repository', 'pull-request', 'artifact-blob', 'ruleset', 'reviews'].map((endpointId) => ({
    endpointId, status: 200, tlsVerified: true, authenticated: true, complete: true,
    trustMaterialDigest: 'b'.repeat(64), bodyBytes: hostCanonicalBytes(bodies[endpointId])
  }));
  return verifyAndConsumeIdentityAction({
    verification: {
      requestBytes: request.canonicalBytes, expectedRequestDigest: request.requestDigest,
      trustRootBytes: hostCanonicalBytes(trustRoot), trustRootProtection: { source: 'external-broker', repositoryResident: false, protected: true },
      expectedTrustRootDigest: validateIdentityTrustRoot(trustRoot).trustRootDigest,
      adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId, adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
      pullRequestNumber: 77, candidateCommitOid: evidence.headOid, artifactPath: evidence.artifactPath,
      evidence, rawProviderResponses,
      trustedTime: { now: NOW, sourceProfileDigest: 'd'.repeat(64), attestationDigest: 'e'.repeat(64), qualified: true, rollbackDetected: false }
    },
    inventory: new IdentityInventory(), ledger: new IdentityLedger()
  });
}

function selectionInput(graph, acceptance, overrides = {}) {
  return {
    selectionBytes: graph.selection.canonicalBytes,
    expectedSelectionDigest: graph.selection.artifactDigest,
    inventoryBytes: graph.inventory.canonicalBytes,
    expectedInventoryDigest: graph.inventory.inventoryDigest,
    expectedOperationReceiptDigest: OPERATION,
    expectedRepositoryPolicyDigest: REPOSITORY_POLICY,
    liveGuard: { snapshotDigest: graph.snapshot.artifactDigest, generation: 8 },
    ownerAcceptance: acceptance,
    trustedTime: { now: NOW, sourceProfileDigest: 'f'.repeat(64), attestationDigest: 'a'.repeat(64), qualified: true, rollbackDetected: false },
    ...overrides
  };
}

test('D2-F1 resolves only the closed inventory and enforces every cross-tier equality', () => {
  const graph = buildGraph();
  const projection = validateApprovalGraph({
    inventoryBytes: graph.inventory.canonicalBytes, expectedInventoryDigest: graph.inventory.inventoryDigest,
    expectedOperationReceiptDigest: OPERATION, expectedApprovalDigest: graph.approval.artifactDigest
  });
  assert.equal(projection.materialDigest, graph.material.artifactDigest);
  assert.equal(projection.reviewPolicyDigest, graph.reviewPolicy.artifactDigest);

  const mismatch = buildGraph({ crossTierMismatch: true });
  code('PACK_GRAPH_BINDING_MISMATCH', () => validateApprovalGraph({
    inventoryBytes: mismatch.inventory.canonicalBytes, expectedInventoryDigest: mismatch.inventory.inventoryDigest,
    expectedOperationReceiptDigest: OPERATION, expectedApprovalDigest: mismatch.approval.artifactDigest
  }));

  const missing = structuredClone(graph.inventory.record);
  missing.entries = missing.entries.filter((entry) => entry.artifactType !== 'kstack-pack-material');
  const missingBytes = hostCanonicalBytes(missing);
  const missingDigest = hash(Buffer.concat([Buffer.from('KSTACK-VALIDATION-INVENTORY-V1\n'), missingBytes]));
  code('PACK_INVENTORY_ARTIFACT_MISSING', () => validateApprovalGraph({
    inventoryBytes: missingBytes, expectedInventoryDigest: missingDigest,
    expectedOperationReceiptDigest: OPERATION, expectedApprovalDigest: graph.approval.artifactDigest
  }));
});

test('D2-F2 uses distinct policy domains and refuses valid artifacts that violate policy', () => {
  assert.notEqual(buildGraph().reviewPolicy.artifactDigest, buildGraph().approvalPolicy.artifactDigest);
  for (const options of [{ confidence: 92 }, { securityFindingCount: 1 }, { independentFromReviewer: false }]) {
    const graph = buildGraph(options);
    const expected = options.independentFromReviewer === false ? 'PACK_APPROVAL_POLICY_REFUSED' : 'PACK_REVIEW_POLICY_REFUSED';
    code(expected, () => validateApprovalGraph({
      inventoryBytes: graph.inventory.canonicalBytes, expectedInventoryDigest: graph.inventory.inventoryDigest,
      expectedOperationReceiptDigest: OPERATION, expectedApprovalDigest: graph.approval.artifactDigest
    }));
  }
  for (const options of [{ minimumPolicyConfidence: 92 }, { policyRequiresIndependence: false }]) {
    const graph = buildGraph(options);
    code('PACK_POLICY_WEAKENING_AUTHORIZATION_REQUIRED', () => validateApprovalGraph({
      inventoryBytes: graph.inventory.canonicalBytes, expectedInventoryDigest: graph.inventory.inventoryDigest,
      expectedOperationReceiptDigest: OPERATION, expectedApprovalDigest: graph.approval.artifactDigest
    }));
  }
  assert.deepEqual(REVIEWER_CLASSES, [...REVIEWER_CLASSES].sort());
  assert.deepEqual(APPROVAL_CLASSES, [...APPROVAL_CLASSES].sort());
});

test('D2 inventory and artifact parsing reject duplicate keys, wrong types, bytes, and unknown fields', () => {
  const graph = buildGraph();
  code('PACK_ARTIFACT_INVALID', () => parsePackArtifact(Buffer.concat([Buffer.from(' '), graph.material.canonicalBytes]), 'kstack-pack-material'));
  code('PACK_ARTIFACT_INVALID', () => parsePackArtifact(Buffer.from('{"artifactType":"kstack-pack-material","artifactType":"kstack-pack-material"}'), 'kstack-pack-material'));
  code('PACK_ARTIFACT_TYPE_INVALID', () => parsePackArtifact(graph.material.canonicalBytes, 'kstack-pack-review'));
  code('PACK_MATERIAL_INVALID', () => createPackArtifact({ ...graph.material.record, latest: true }));
  const duplicate = structuredClone(graph.inventory.record);
  duplicate.entries.push(duplicate.entries[0]);
  duplicate.entries.sort((a, b) => Buffer.compare(Buffer.from(`${a.artifactType}\u0000${a.digest}`), Buffer.from(`${b.artifactType}\u0000${b.digest}`)));
  code('PACK_INVENTORY_INVALID', () => validateApprovalGraph({
    inventoryBytes: hostCanonicalBytes(duplicate), expectedInventoryDigest: graph.inventory.inventoryDigest,
    expectedOperationReceiptDigest: OPERATION, expectedApprovalDigest: graph.approval.artifactDigest
  }));
});

test('D2 declared selection, inventory, and artifact ceilings are reachable and fail with PACK codes', () => {
  const graph = buildGraph();
  const entries = Array.from({ length: 12 }, (_, index) => ({
    ...graph.snapshot.record.entries[0],
    packId: `pack-${String(index).padStart(2, '0')}`
  }));
  assert.equal(createPackArtifact({ ...graph.snapshot.record, entries }).record.entries.length, 12);
  code('PACK_SNAPSHOT_INVALID', () => createPackArtifact({
    ...graph.snapshot.record,
    entries: [...entries, { ...entries[0], packId: 'pack-12' }]
  }));

  code('PACK_ARTIFACT_INVALID', () => parsePackArtifact(
    Buffer.alloc(12_001, 0x20), 'kstack-pack-material'
  ));

  const overfull = structuredClone(graph.inventory.record);
  overfull.entries = Array.from({ length: 61 }, () => overfull.entries[0]);
  code('PACK_INVENTORY_INVALID', () => validateApprovalGraph({
    inventoryBytes: hostCanonicalBytes(overfull),
    expectedInventoryDigest: graph.inventory.inventoryDigest,
    expectedOperationReceiptDigest: OPERATION,
    expectedApprovalDigest: graph.approval.artifactDigest
  }));
});

test('D2-F3 admits one exact selection and binds it into composition and dispatch receipts', async () => {
  const graph = buildGraph();
  const acceptance = await ownerAcceptance(graph.selection.artifactDigest);
  const admitted = validatePackSelection(selectionInput(graph, acceptance));
  assert.equal(admitted.projection.selectionDigest, graph.selection.artifactDigest);
  assert.equal(admitted.projection.snapshotDigest, graph.snapshot.artifactDigest);
  assert.equal(admitted.projection.approvalPolicyBindings[0].reviewPolicyDigest, graph.reviewPolicy.artifactDigest);
  assert.equal(admitted.projection.approvalAuthorityScope, PACK_APPROVAL_AUTHORITY_SCOPE);
  assert.notEqual(admitted.compositionReceiptDigest, admitted.dispatchReceiptDigest);
});

test('D2-F3 rejects stale guards, substitutions, expired time, and fabricated owner acceptance', async () => {
  const graph = buildGraph();
  const acceptance = await ownerAcceptance(graph.selection.artifactDigest);
  code('PACK_SELECTION_STALE', () => validatePackSelection(selectionInput(graph, acceptance, { liveGuard: { snapshotDigest: graph.snapshot.artifactDigest, generation: 9 } })));
  code('PACK_SELECTION_EXPIRED_OR_POLICY_MISMATCH', () => validatePackSelection(selectionInput(graph, acceptance, { expectedRepositoryPolicyDigest: 'b'.repeat(64) })));
  code('PACK_SELECTION_EXPIRED_OR_POLICY_MISMATCH', () => validatePackSelection(selectionInput(graph, acceptance, { trustedTime: { ...selectionInput(graph, acceptance).trustedTime, now: '2026-08-29T16:10:00.000Z' } })));
  code('PACK_OWNER_ACCEPTANCE_INVALID', () => validatePackSelection(selectionInput(graph, structuredClone(acceptance))));
  const wrongPolicyAcceptance = await ownerAcceptance(graph.selection.artifactDigest, 'c'.repeat(64));
  code('PACK_OWNER_ACCEPTANCE_INVALID', () => validatePackSelection(selectionInput(graph, wrongPolicyAcceptance)));
  code('PACK_SELECTION_BYTES_MISMATCH', () => validatePackSelection(selectionInput(graph, acceptance, { selectionBytes: graph.snapshot.canonicalBytes })));
});
