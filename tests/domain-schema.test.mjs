import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  D5_SCHEMA_TYPES,
  PACK_ARTIFACT_CLASSES,
  PACK_CONTRACT_POLICY,
  activationBodyDigest,
  assertValidatedPackCatalogGraph,
  createD5Artifact,
  createPackContractPolicy,
  createPackOperationInventory,
  createPackSchemaRegistry,
  d5DomainPrefix,
  packCanonicalBytes,
  packFileSetDigest,
  parseD5Artifact,
  parsePackCanonicalJson,
  validatePackBundle,
  validatePackCatalogGraph,
  validatePackSchemaRegistry
} from '../plugins/kstack/scripts/kstack-domain-schema.mjs';
import {
  createPackArtifact,
  createPackSelection,
  createValidationInventory,
  parsePackArtifact,
  validatePackSelection
} from '../plugins/kstack/scripts/kstack-domain-selection.mjs';
import {
  GITHUB_PROTECTED_REVIEW_ADAPTER,
  createIdentityActionRequest,
  validateIdentityTrustRoot,
  verifyAndConsumeIdentityAction
} from '../plugins/kstack/scripts/kstack-domain-identity.mjs';
import {
  authorizeWeakening,
  createWeakeningRequest,
  validateSeparationPolicy
} from '../plugins/kstack/scripts/kstack-domain-separation.mjs';
import {
  commitPackActivation,
  confirmD2PackSnapshotCurrent,
  createCurrentPackPointerRecord,
  preparePackActivation,
  projectD2PackSnapshot,
  readCurrentPackHead
} from '../plugins/kstack/scripts/kstack-domain-activation.mjs';
import { hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  admitPackBudgetDispatch,
  composePackBudget,
  createProviderBudgetProfile,
  createProviderBudgetQualification,
  qualifyProviderBudgetProfile,
  validateCatalogApplicability
} from '../plugins/kstack/scripts/kstack-domain-budget.mjs';

const ZERO = '0'.repeat(64);
const ONE = '1'.repeat(64);
const TWO = '2'.repeat(64);
const NOW = '2026-08-29T18:00:00.000Z';

function sha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function domainSha(domain, bytes) {
  return crypto.createHash('sha256').update(Buffer.from(domain)).update(bytes).digest('hex');
}

function trustedTimeBinding(now, trustedTimeReceiptDigest = sha(Buffer.from('trusted-time-receipt'))) {
  return {
    now, trustedTimeReceiptDigest,
    useReceiptDigest: sha(Buffer.from(`time-use:${now}:${trustedTimeReceiptDigest}`)),
    policyDigest: sha(Buffer.from('trusted-time-policy')),
    anchorDigest: sha(Buffer.from('trusted-time-anchor')),
    qualified: true, rollbackDetected: false
  };
}

function activationPolicyBinding(requiredPacks = ['assurance']) {
  const record = {
    artifactType: 'kstack-policy-state', schemaVersion: 1,
    requiredPacks: [...requiredPacks].sort(), requiredLanes: ['qc', 'security'],
    minimumReviewerCount: 2, minimumConfidence: 93, requiredEvidenceCount: 4,
    freshnessSecondsMaximum: 3600, blockOnSecurityFinding: true,
    minimumAuthorityCount: 2, rollbackRequired: true, retentionDaysMinimum: 30,
    failureMode: 'closed', waiverScopePacks: [], waiverExpiresAt: '2026-08-30T00:00:00.000Z',
    catalogGeneration: 10, quarantinedPacks: []
  };
  const policyStateBytes = hostCanonicalBytes(record);
  const expectedPolicyStateDigest = domainSha('KSTACK-POLICY-STATE-V1\n', policyStateBytes);
  return {
    policyStateBytes,
    policyStateProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedPolicyStateDigest,
    policyStateAuthority: {
      async confirmCurrent({ policyStateDigest }) {
        return {
          current: true, policyStateDigest,
          checkpointDigest: sha(Buffer.from(`policy-state-checkpoint:${policyStateDigest}`)),
          rollbackDetected: false, protected: true, repositoryResident: false
        };
      }
    }
  };
}

function trustedTimeAuthority(overrides = {}) {
  return {
    confirmCurrent(binding) {
      return {
        current: true, trustedTimeReceiptDigest: binding.trustedTimeReceiptDigest,
        useReceiptDigest: binding.useReceiptDigest, policyDigest: binding.policyDigest,
        anchorDigest: binding.anchorDigest,
        checkpointDigest: sha(Buffer.from('trusted-time-authority-checkpoint')),
        rollbackDetected: false, protected: true, repositoryResident: false, ...overrides
      };
    }
  };
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, `expected ${expected}`);
}

function opened(relativePath, bytes) {
  return { relativePath, bytes, regular: true, linkCount: 1, identityStable: true };
}

class IdentityInventory {
  async retain(record) {
    return {
      retained: true,
      inventoryDigest: sha(Buffer.concat([Buffer.from('KSTACK-IDENTITY-OPERATION-INVENTORY-V1\n'), hostCanonicalBytes(record)]))
    };
  }
}

class IdentityLedger {
  generation = 0;
  checkpointDigest = ZERO;

  async inspect() {
    return { available: true, rollbackDetected: false, generation: this.generation, checkpointDigest: this.checkpointDigest };
  }

  async consumeOnce(record) {
    const previousCheckpointDigest = this.checkpointDigest;
    this.generation += 1;
    this.checkpointDigest = sha(hostCanonicalBytes({ previousCheckpointDigest, generation: this.generation, record }));
    return {
      consumed: true, generation: this.generation, previousCheckpointDigest,
      checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: sha(Buffer.from('identity-witness'))
    };
  }
}

async function identityAcceptance(action, targetDigest, policyDigest) {
  const projectId = 'project';
  const repositoryImmutableId = 'repository-1';
  const request = createIdentityActionRequest({
    projectId, repositoryImmutableId, action, targetDigest, policyDigest,
    nonce: 'a'.repeat(32), notBefore: '2026-08-29T17:55:00.000Z',
    expiresAt: '2026-08-29T18:10:00.000Z'
  });
  const trustRoot = {
    artifactType: 'kstack-identity-trust-root', schemaVersion: 1, projectId,
    repositoryImmutableId,
    adapters: [{
      adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
      adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
      trustMaterialDigest: 'b'.repeat(64), allowedProviderPrincipalIds: ['4815162342'],
      allowedActions: [action]
    }], policyVersion: 1, createdAt: '2026-08-01T00:00:00.000Z'
  };
  const evidence = {
    artifactType: 'kstack-github-protected-review-evidence', schemaVersion: 1,
    providerProtocol: 'github-rest-v3', endpointOrigin: 'https://api.github.com',
    repositoryId: repositoryImmutableId, pullRequestNumber: 89, headOid: 'c'.repeat(40),
    artifactPath: '.kstack/identity/activation.json', artifactBlobBase64: request.canonicalBytes.toString('base64'),
    baseRef: 'refs/heads/main',
    ruleset: { rulesetId: 'ruleset-89', targetBaseRef: 'refs/heads/main', active: true, requiresPullRequestReview: true, requiredApprovals: 1 },
    reviews: [{ reviewId: 'review-89', state: 'APPROVED', commitOid: 'c'.repeat(40), providerPrincipalId: '4815162342', dismissed: false, submittedAt: '2026-08-29T17:59:00.000Z' }],
    reviewsPaginationComplete: true, rulesetsPaginationComplete: true, capturedAt: NOW
  };
  const bodies = {
    repository: { repositoryId: repositoryImmutableId },
    'pull-request': { repositoryId: repositoryImmutableId, pullRequestNumber: 89, headOid: evidence.headOid, baseRef: evidence.baseRef, capturedAt: NOW },
    'artifact-blob': { repositoryId: repositoryImmutableId, commitOid: evidence.headOid, artifactPath: evidence.artifactPath, artifactBlobBase64: evidence.artifactBlobBase64 },
    ruleset: { repositoryId: repositoryImmutableId, baseRef: evidence.baseRef, ruleset: evidence.ruleset, rulesetsPaginationComplete: true },
    reviews: { repositoryId: repositoryImmutableId, pullRequestNumber: 89, reviews: evidence.reviews, reviewsPaginationComplete: true }
  };
  const verification = {
    requestBytes: request.canonicalBytes, expectedRequestDigest: request.requestDigest,
    trustRootBytes: hostCanonicalBytes(trustRoot),
    trustRootProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedTrustRootDigest: validateIdentityTrustRoot(trustRoot).trustRootDigest,
    adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
    adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
    pullRequestNumber: 89, candidateCommitOid: evidence.headOid,
    artifactPath: evidence.artifactPath, evidence,
    rawProviderResponses: ['repository', 'pull-request', 'artifact-blob', 'ruleset', 'reviews'].map((endpointId) => ({
      endpointId, status: 200, tlsVerified: true, authenticated: true, complete: true,
      trustMaterialDigest: 'b'.repeat(64), bodyBytes: hostCanonicalBytes(bodies[endpointId])
    })),
    trustedTime: { now: NOW, sourceProfileDigest: 'd'.repeat(64), attestationDigest: 'e'.repeat(64), qualified: true, rollbackDetected: false }
  };
  return verifyAndConsumeIdentityAction({ verification, inventory: new IdentityInventory(), ledger: new IdentityLedger() });
}

function activationIdentity(targetDigest, policyDigest) {
  return identityAcceptance('catalog-activation', targetDigest, policyDigest);
}

function weakeningIdentityVerification(identityRequest, providerPrincipalId, pullRequestNumber, action) {
  const commit = providerPrincipalId[0].repeat(40);
  const trustRoot = {
    artifactType: 'kstack-identity-trust-root', schemaVersion: 1,
    projectId: 'project', repositoryImmutableId: 'repository-1',
    adapters: [{
      adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
      adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
      trustMaterialDigest: 'b'.repeat(64),
      allowedProviderPrincipalIds: ['1111111111', '2222222222'], allowedActions: [action]
    }], policyVersion: 1, createdAt: '2026-08-01T00:00:00.000Z'
  };
  const evidence = {
    artifactType: 'kstack-github-protected-review-evidence', schemaVersion: 1,
    providerProtocol: 'github-rest-v3', endpointOrigin: 'https://api.github.com',
    repositoryId: 'repository-1', pullRequestNumber, headOid: commit,
    artifactPath: '.kstack/identity/catalog-weakening.json',
    artifactBlobBase64: identityRequest.canonicalBytes.toString('base64'),
    baseRef: 'refs/heads/main',
    ruleset: {
      rulesetId: `ruleset-${pullRequestNumber}`, targetBaseRef: 'refs/heads/main', active: true,
      requiresPullRequestReview: true, requiredApprovals: 1
    },
    reviews: [{
      reviewId: `review-${pullRequestNumber}`, state: 'APPROVED', commitOid: commit,
      providerPrincipalId, dismissed: false, submittedAt: '2026-08-29T18:00:30.000Z'
    }],
    reviewsPaginationComplete: true, rulesetsPaginationComplete: true,
    capturedAt: '2026-08-29T18:01:00.000Z'
  };
  const bodies = {
    repository: { repositoryId: 'repository-1' },
    'pull-request': {
      repositoryId: 'repository-1', pullRequestNumber, headOid: commit,
      baseRef: evidence.baseRef, capturedAt: evidence.capturedAt
    },
    'artifact-blob': {
      repositoryId: 'repository-1', commitOid: commit, artifactPath: evidence.artifactPath,
      artifactBlobBase64: evidence.artifactBlobBase64
    },
    ruleset: {
      repositoryId: 'repository-1', baseRef: evidence.baseRef,
      ruleset: evidence.ruleset, rulesetsPaginationComplete: true
    },
    reviews: {
      repositoryId: 'repository-1', pullRequestNumber,
      reviews: evidence.reviews, reviewsPaginationComplete: true
    }
  };
  return {
    requestBytes: identityRequest.canonicalBytes, expectedRequestDigest: identityRequest.requestDigest,
    trustRootBytes: hostCanonicalBytes(trustRoot),
    trustRootProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedTrustRootDigest: validateIdentityTrustRoot(trustRoot).trustRootDigest,
    adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
    adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
    pullRequestNumber, candidateCommitOid: commit, artifactPath: evidence.artifactPath, evidence,
    rawProviderResponses: ['repository', 'pull-request', 'artifact-blob', 'ruleset', 'reviews'].map((endpointId) => ({
      endpointId, status: 200, tlsVerified: true, authenticated: true, complete: true,
      trustMaterialDigest: 'b'.repeat(64), bodyBytes: hostCanonicalBytes(bodies[endpointId])
    })),
    trustedTime: {
      now: '2026-08-29T18:01:00.000Z', sourceProfileDigest: 'd'.repeat(64),
      attestationDigest: 'e'.repeat(64), qualified: true, rollbackDetected: false
    }
  };
}

async function catalogWeakeningAuthorization({ beforeDigest, afterDigest, action, affectedPackIds }) {
  const classifierReceipt = {
    artifactType: 'kstack-weakening-classifier-receipt', schemaVersion: 1,
    classifierVersion: 1, beforeDigest, afterDigest, classification: 'weakening',
    action, affectedPackIds, reasonCodes: [action === 'required-pack-waiver'
      ? 'REQUIRED_PACK_REMOVED' : action === 'quarantine-reversal'
        ? 'QUARANTINE_REVERSED' : 'CATALOG_DOWNGRADED']
  };
  const classifier = {
    receipt: classifierReceipt,
    classifierReceiptDigest: crypto.createHash('sha256')
      .update(Buffer.from('KSTACK-WEAKENING-CLASSIFIER-RECEIPT-V1\n'))
      .update(hostCanonicalBytes(classifierReceipt)).digest('hex')
  };
  const request = createWeakeningRequest({
    projectId: 'project', repositoryImmutableId: 'repository-1', action,
    beforeDigest, afterDigest, affectedPackIds, classifierVersion: 1,
    classifierReceiptDigest: classifier.classifierReceiptDigest,
    reasonCode: 'CATALOG_TRANSITION', notBefore: '2026-08-29T18:00:00.000Z',
    expiresAt: '2026-08-29T18:10:00.000Z', nonce: 'a'.repeat(32)
  });
  const policy = {
    artifactType: 'kstack-separation-policy', schemaVersion: 1,
    projectId: 'project', repositoryImmutableId: 'repository-1',
    principals: [
      { adapterId: 'github-protected-review', providerPrincipalId: '1111111111', personSubjectId: 'person-a', independenceGroupId: 'group-a', eligibleRoles: ['requester'], status: 'active' },
      { adapterId: 'github-protected-review', providerPrincipalId: '2222222222', personSubjectId: 'person-b', independenceGroupId: 'group-b', eligibleRoles: ['independent-approver'], status: 'active' }
    ],
    actions: ['catalog-downgrade', 'policy-weakening', 'quarantine-reversal', 'required-pack-waiver'].map((policyAction) => ({
      action: policyAction, requiredRoles: ['independent-approver', 'requester'],
      minimumDistinctPeople: 2, minimumDistinctGroups: 2
    })),
    policyVersion: 1, effectiveAt: '2026-08-01T00:00:00.000Z'
  };
  const validatedPolicy = validateSeparationPolicy(policy);
  const identityRequest = createIdentityActionRequest({
    projectId: 'project', repositoryImmutableId: 'repository-1', action,
    targetDigest: request.weakeningRequestDigest,
    policyDigest: validatedPolicy.separationPolicyDigest,
    nonce: request.request.nonce, notBefore: request.request.notBefore,
    expiresAt: request.request.expiresAt
  });
  let generation = 0;
  let checkpointDigest = ZERO;
  const result = await authorizeWeakening({
    separationPolicyBytes: hostCanonicalBytes(policy),
    separationPolicyProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedSeparationPolicyDigest: validatedPolicy.separationPolicyDigest,
    weakeningRequestBytes: request.canonicalBytes,
    expectedWeakeningRequestDigest: request.weakeningRequestDigest, classifier,
    requesterVerification: weakeningIdentityVerification(identityRequest, '1111111111', 91, action),
    independentApproverVerification: weakeningIdentityVerification(identityRequest, '2222222222', 92, action),
    trustedTime: {
      now: '2026-08-29T18:01:00.000Z', sourceProfileDigest: 'f'.repeat(64),
      attestationDigest: '9'.repeat(64), qualified: true, rollbackDetected: false
    },
    policyAuthority: {
      async confirmCurrent(policyDigest) {
        return { current: true, policyDigest, checkpointDigest: '7'.repeat(64), rollbackDetected: false };
      }
    },
    inventory: {
      async retain(record) {
        return {
          retained: true,
          inventoryDigest: sha(Buffer.concat([
            Buffer.from('KSTACK-WEAKENING-EVIDENCE-INVENTORY-V1\n'), hostCanonicalBytes(record)
          ]))
        };
      }
    },
    ledger: {
      async inspect() { return { available: true, rollbackDetected: false, generation, checkpointDigest }; },
      async consumePairOnce(record) {
        const previousCheckpointDigest = checkpointDigest;
        generation += 1;
        checkpointDigest = sha(hostCanonicalBytes({ generation, previousCheckpointDigest, record }));
        return {
          consumed: true, generation, previousCheckpointDigest, checkpointDigest,
          rollbackWitnessDigest: sha(Buffer.from('catalog-weakening-witness')),
          consumptionId: `catalog-consumption-${generation}`
        };
      }
    }
  });
  return {
    authorization: result.authorization,
    authorizationDigest: result.weakeningAuthorizationDigest,
    requestBytes: request.canonicalBytes
  };
}

function assertion(approval) {
  const value = {
    artifactType: approval ? 'kstack-pack-approval-assertion' : 'kstack-pack-review-assertion',
    schemaVersion: 1, projectId: 'project', repositoryImmutableId: 'repository-1',
    packId: 'assurance', version: '1.0.0', bundleDigest: ZERO, manifestDigest: ZERO,
    contentDigest: ZERO, evidenceSchemaDigest: ZERO, fixturesDigest: ZERO,
    bundleIndexDigest: ZERO, sourceProvenanceDigest: ZERO, schemaRegistryDigest: ZERO,
    contractPolicyDigest: ZERO, compatibilityEntryDigest: ZERO,
    composerImplementationDigest: ZERO, kernelSchemaDigest: ZERO,
    baseLaneContractDigest: ZERO, validatorIdentityDigests: [ONE], decision: 'approve',
    issuedAt: NOW, expiresAt: '2026-08-29T18:10:00.000Z'
  };
  value[approval ? 'd1ApprovalAttestationDigest' : 'reviewerIdentityDigest'] = TWO;
  return value;
}

function validArtifact(artifactType) {
  const commonCompatibility = {
    artifactType: 'kstack-pack-compatibility-entry', schemaVersion: 1,
    packId: 'assurance', version: '1.0.0', bundleDigest: ZERO, manifestDigest: ZERO,
    contentDigest: ZERO, evidenceSchemaDigest: ZERO, fixturesDigest: ZERO,
    bundleIndexDigest: ZERO, packContractVersion: 1, schemaRegistryDigest: ZERO,
    contractPolicyDigest: ZERO, composerImplementationDigest: ZERO,
    validatorIdentityDigests: [{ targetPlatform: 'linux-x64', validatorIdentityDigest: ONE }],
    kernelSchemaDigest: ZERO, baseLaneContractDigest: ZERO, status: 'compatible'
  };
  const values = {
    'kstack-pack-activation-receipt': {
      artifactType, schemaVersion: 1, requestDigest: ZERO, oldSnapshotDigest: ZERO,
      oldGeneration: 0, newSnapshotDigest: ONE, newGeneration: 1,
      d1ActivationAttestationDigest: TWO, d3WeakeningAuthorizationDigest: null,
      commitTransactionId: 'transaction-1', committedAt: NOW,
      priorPointerRecordDigest: ZERO, currentPointerRecordDigest: ONE
    },
    'kstack-pack-activation-request': {
      artifactType, schemaVersion: 1, projectId: 'project', repositoryImmutableId: 'repository-1',
      fromSnapshotDigest: ZERO, fromGeneration: 0, toSnapshotDigest: ONE, toGeneration: 1,
      changedPackIds: ['assurance'], transitionKind: 'activate', schemaRegistryDigest: ZERO,
      compatibilityReviewDigest: ONE, d1ActivationAttestationDigest: TWO,
      d3WeakeningAuthorizationDigest: null, requestNonce: 'a'.repeat(64),
      notBefore: NOW, expiresAt: '2026-08-29T18:10:00.000Z'
    },
    'kstack-pack-approval-assertion': assertion(true),
    'kstack-pack-bundle-index': {
      artifactType, schemaVersion: 1, packId: 'assurance', version: '1.0.0',
      manifestDigest: ZERO, contentDigest: ZERO, evidenceSchemaDigest: ZERO,
      fixturesDigest: ZERO, orderedFiles: [
        { relativePath: 'content.json', byteLength: 0, contentSha256: ZERO },
        { relativePath: 'evidence.schema.json', byteLength: 0, contentSha256: ZERO },
        { relativePath: 'fixtures/a.json', byteLength: 0, contentSha256: ZERO },
        { relativePath: 'manifest.json', byteLength: 0, contentSha256: ZERO }
      ], bundleDigestAlgorithm: 'kstack-pack-file-set-v1'
    },
    'kstack-pack-catalog-snapshot': {
      artifactType, schemaVersion: 1, contractVersion: 1, generation: 0,
      predecessorSnapshotDigest: null, schemaRegistryDigest: ZERO, contractPolicyDigest: ZERO,
      catalogEntries: PACK_CONTRACT_POLICY.packIds.map((packId) => ({ packId, state: 'roadmap-only' })),
      compatibilityEntries: [], applicabilityEntries: []
    },
    'kstack-pack-compatibility-entry': commonCompatibility,
    'kstack-pack-content': {
      artifactType, schemaVersion: 1, sections: [{
        id: 'readiness', appliesTo: ['objective'], questions: [{
          id: 'health', text: 'Health evidence?', answerKind: 'status-evidence', evidenceIds: ['health-proof']
        }]
      }]
    },
    'kstack-pack-contract-policy': PACK_CONTRACT_POLICY,
    'kstack-pack-evidence-schema': {
      artifactType, schemaVersion: 1, requirements: [{
        evidenceId: 'health-proof', allowedSourceClasses: ['health-observation'],
        allowedObservationKinds: ['asserts'], minimumCount: 1, maximumCount: 2,
        freshnessPolicyId: 'release-immediate', requiredFor: ['contradicted', 'supported']
      }]
    },
    'kstack-pack-manifest': {
      artifactType, schemaVersion: 1, id: 'assurance', version: '1.0.0', title: 'Assurance',
      purpose: 'Verify assurance evidence.', coverage: ['control-evidence'], contentDigest: ZERO,
      evidenceSchemaDigest: ZERO, fixturesDigest: ZERO, maxUtf8Bytes: 16_384
    },
    'kstack-pack-operation-inventory': {
      artifactType, schemaVersion: 1, operationId: 'operation-1',
      entries: [{ role: 'candidate', artifactType: 'kstack-pack-content', artifactDigest: ZERO, byteLength: 1 }]
    },
    'kstack-pack-quarantine-record': {
      artifactType, schemaVersion: 1, projectId: 'project', repositoryImmutableId: 'repository-1',
      snapshotDigest: ZERO, bundleDigest: ZERO, packId: 'assurance', reason: 'integrity-failure',
      evidenceDigests: [ONE], d1ActionAttestationDigest: TWO, quarantinedAt: NOW,
      expiresAt: null, nonce: 'b'.repeat(64)
    },
    'kstack-pack-review-assertion': assertion(false),
    'kstack-pack-source-provenance': {
      artifactType, schemaVersion: 1, projectId: 'project', repositoryImmutableId: 'repository-1',
      packId: 'assurance', version: '1.0.0', acquisitionPolicyDigest: ZERO,
      sourceRepositoryImmutableId: 'source-repository-1', sourceCommitOid: 'c'.repeat(40),
      sourcePath: 'packs/assurance', sourceFileDigests: [{ relativePath: 'content.json', contentSha256: ONE }],
      licenseId: 'MIT', licenseNoticeDigest: ZERO, transformationReceiptDigest: ZERO,
      bundleDigest: ZERO, manifestDigest: ZERO, contentDigest: ZERO,
      evidenceSchemaDigest: ZERO, fixturesDigest: ZERO, bundleIndexDigest: ZERO
    },
    'kstack-pack-tombstone': {
      artifactType, schemaVersion: 1, projectId: 'project', repositoryImmutableId: 'repository-1',
      packId: 'assurance', version: '1.0.0', bundleDigest: ZERO, manifestDigest: ZERO,
      contentDigest: ZERO, evidenceSchemaDigest: ZERO, fixturesDigest: ZERO,
      bundleIndexDigest: ZERO, lastSnapshotDigest: ZERO, disposition: 'disabled-retained',
      retainedSafeMetadataDigest: ONE, removalAuthorizationDigest: TWO,
      removedAt: NOW, reason: 'OWNER_DISABLED'
    },
    'kstack-validator-identity': {
      artifactType, schemaVersion: 1, contractVersion: 1, canonicalizerVersion: 1,
      schemaDigest: ZERO, contractPolicyDigest: ZERO, sourceRoot: 'src', sourceFileSetDigest: ZERO,
      dependencyLockPath: 'package-lock.json', dependencyLockDigest: ZERO,
      buildRecipePath: 'build.json', buildRecipeDigest: ZERO,
      targetPlatform: 'linux-x64', executableArtifactDigest: ZERO
    }
  };
  return values[artifactType];
}

function buildValidatedRegistry() {
  const policy = createPackContractPolicy();
  const schemaDocuments = [];
  const vectorSets = [];
  const validatorIdentities = [];
  const schemas = [];
  const identities = [];
  for (const artifactType of D5_SCHEMA_TYPES) {
    const schemaBytes = packCanonicalBytes({
      additionalProperties: false,
      properties: { artifactType: { const: artifactType }, schemaVersion: { const: 1 } },
      required: ['artifactType', 'schemaVersion'], type: 'object'
    });
    const schemaDigest = domainSha('KSTACK-PACK-SCHEMA-DOCUMENT-V1\n', schemaBytes);
    const positive = createD5Artifact(validArtifact(artifactType));
    const positiveBytes = positive.canonicalBytes;
    const negativeBytes = packCanonicalBytes({});
    const expectedBytes = packCanonicalBytes({
      artifactType: 'kstack-pack-schema-vector-expectations', schemaVersion: 1,
      targetArtifactType: artifactType, entries: [
        { path: 'negative/bad.json', rawInputDigest: sha(negativeBytes), accepted: false, acceptedCanonicalBase64: null, acceptedArtifactDigest: null },
        { path: 'positive/good.json', rawInputDigest: sha(positiveBytes), accepted: true, acceptedCanonicalBase64: positiveBytes.toString('base64'), acceptedArtifactDigest: positive.artifactDigest }
      ]
    });
    const vectorFiles = [
      opened('negative/bad.json', negativeBytes), opened('positive/good.json', positiveBytes),
      opened('expected.json', expectedBytes)
    ];
    const identity = createD5Artifact({
      ...validArtifact('kstack-validator-identity'), schemaDigest,
      contractPolicyDigest: policy.artifactDigest,
      executableArtifactDigest: sha(Buffer.from(`validator:${artifactType}`))
    });
    identities.push(identity);
    schemaDocuments.push({ path: `schemas/${artifactType}.schema.json`, bytes: schemaBytes, regular: true, linkCount: 1, identityStable: true });
    vectorSets.push({ root: `vectors/${artifactType}`, files: vectorFiles });
    validatorIdentities.push({ digest: identity.artifactDigest, bytes: identity.canonicalBytes, regular: true, linkCount: 1, identityStable: true });
    schemas.push({
      artifactType, schemaVersion: 1, domainPrefix: d5DomainPrefix(artifactType),
      schemaPath: `schemas/${artifactType}.schema.json`, schemaDigest,
      vectorRoot: `vectors/${artifactType}`,
      fixtureSetDigest: packFileSetDigest('KSTACK-PACK-SCHEMA-VECTORS-V1', vectorFiles),
      validatorIdentityDigest: identity.artifactDigest
    });
  }
  const registry = createPackSchemaRegistry({ contractPolicyDigest: policy.artifactDigest, schemas });
  const validated = validatePackSchemaRegistry({
    registryBytes: registry.canonicalBytes, contractPolicyBytes: policy.canonicalBytes,
    schemaDocuments, vectorSets, validatorIdentities
  });
  return { policy, schemaDocuments, vectorSets, validatorIdentities, identities, registry, validated };
}

test('D5 canonical JSON is UTF-8-key ordered, round-trips exactly, and rejects alternate encodings', () => {
  const value = { z: 0, a: ['é', true, null], 'ä': 2 };
  const bytes = packCanonicalBytes(value);
  assert.equal(bytes.toString(), '{"a":["é",true,null],"z":0,"ä":2}');
  assert.deepEqual(parsePackCanonicalJson(bytes), value);
  for (const invalid of [
    Buffer.from('{"z":0,"a":1}'), Buffer.from('{"a":1,"a":1}'), Buffer.from('{"a":-0}'),
    Buffer.from('{"a":1.0}'), Buffer.from('{"a":"\\u0061"}'),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]), Buffer.concat([bytes, Buffer.from('\n')])
  ]) assert.throws(() => parsePackCanonicalJson(invalid));
});

test('D5 repaired registry owns exactly 16 collision-free types and rejects D2 type confusion', () => {
  assert.equal(D5_SCHEMA_TYPES.length, 16);
  assert.deepEqual(D5_SCHEMA_TYPES, [...D5_SCHEMA_TYPES].sort());
  assert.equal(new Set(D5_SCHEMA_TYPES.map(d5DomainPrefix)).size, 16);
  assert.equal(D5_SCHEMA_TYPES.includes('kstack-pack-snapshot'), false);
  assert.equal(D5_SCHEMA_TYPES.includes('kstack-operation-inventory'), false);

  const d2Snapshot = createPackArtifact({
    artifactType: 'kstack-pack-snapshot', schemaVersion: 1, generation: 0,
    repositoryPolicyDigest: ZERO, entries: [{
      packId: 'assurance', version: '1.0.0', materialDigest: ZERO,
      compatibilityTupleDigest: ZERO, reviewArtifactDigest: ZERO, approvalArtifactDigest: ZERO
    }]
  });
  code('PACK_SCHEMA_TYPE_INVALID', () => parseD5Artifact(d2Snapshot.canonicalBytes, 'kstack-pack-snapshot'));
  const d5Snapshot = createD5Artifact(validArtifact('kstack-pack-catalog-snapshot'));
  code('PACK_ARTIFACT_TYPE_INVALID', () => parsePackArtifact(d5Snapshot.canonicalBytes, 'kstack-pack-snapshot'));

  const d2Inventory = createValidationInventory({
    operationReceiptDigest: ZERO,
    artifacts: [{ artifactType: 'kstack-pack-snapshot', digest: d2Snapshot.artifactDigest, bytes: d2Snapshot.canonicalBytes }]
  });
  code('PACK_SCHEMA_TYPE_INVALID', () => parseD5Artifact(d2Inventory.canonicalBytes, 'kstack-operation-inventory'));
  const d5Inventory = createD5Artifact(validArtifact('kstack-pack-operation-inventory'));
  code('PACK_ARTIFACT_TYPE_INVALID', () => parsePackArtifact(d5Inventory.canonicalBytes, 'kstack-operation-inventory'));
});

test('D5 bundle validation closes content, evidence, fixture, index, and manifest digests', () => {
  const content = createD5Artifact(validArtifact('kstack-pack-content'));
  const evidence = createD5Artifact(validArtifact('kstack-pack-evidence-schema'));
  const fixtureFiles = [opened('health.json', Buffer.from('{"healthy":true}'))];
  const fixturesDigest = packFileSetDigest('KSTACK-PACK-FIXTURES-V1', fixtureFiles);
  const manifest = createD5Artifact({
    ...validArtifact('kstack-pack-manifest'), contentDigest: content.artifactDigest,
    evidenceSchemaDigest: evidence.artifactDigest, fixturesDigest
  });
  const bundleFiles = [
    { relativePath: 'manifest.json', bytes: manifest.canonicalBytes },
    { relativePath: 'content.json', bytes: content.canonicalBytes },
    { relativePath: 'evidence.schema.json', bytes: evidence.canonicalBytes },
    { relativePath: 'fixtures/health.json', bytes: fixtureFiles[0].bytes }
  ];
  const orderedFiles = bundleFiles.sort((a, b) => Buffer.compare(Buffer.from(a.relativePath), Buffer.from(b.relativePath)))
    .map((entry) => ({ relativePath: entry.relativePath, byteLength: entry.bytes.length, contentSha256: sha(entry.bytes) }));
  const index = createD5Artifact({
    ...validArtifact('kstack-pack-bundle-index'), manifestDigest: manifest.artifactDigest,
    contentDigest: content.artifactDigest, evidenceSchemaDigest: evidence.artifactDigest,
    fixturesDigest, orderedFiles
  });
  const bundle = validatePackBundle({
    manifestBytes: manifest.canonicalBytes, contentBytes: content.canonicalBytes,
    evidenceSchemaBytes: evidence.canonicalBytes, fixtureFiles, bundleIndexBytes: index.canonicalBytes
  });
  assert.equal(bundle.bundleDigest, packFileSetDigest('KSTACK-PACK-BUNDLE-V1', bundleFiles));
  code('PACK_BUNDLE_INVALID', () => validatePackBundle({
    manifestBytes: manifest.canonicalBytes, contentBytes: content.canonicalBytes,
    evidenceSchemaBytes: evidence.canonicalBytes,
    fixtureFiles: [{ ...fixtureFiles[0], linkCount: 2 }], bundleIndexBytes: index.canonicalBytes
  }));
});

test('D5 schema registry binds every schema, vector set, and opened validator identity', () => {
  const { policy, schemaDocuments, vectorSets, validatorIdentities, registry, validated } = buildValidatedRegistry();
  assert.equal(validated.schemaRegistryDigest, registry.schemaRegistryDigest);
  code('PACK_SCHEMA_REGISTRY_INVALID', () => validatePackSchemaRegistry({
    registryBytes: registry.canonicalBytes, contractPolicyBytes: policy.canonicalBytes,
    schemaDocuments: schemaDocuments.map((entry, index) => index === 0 ? { ...entry, identityStable: false } : entry),
    vectorSets, validatorIdentities
  }));
});

test('D5 schema documents and canonicalizer limits reject adversarial near misses', () => {
  const fixture = buildValidatedRegistry();
  const first = parsePackCanonicalJson(fixture.schemaDocuments[0].bytes);
  const rejectsDocument = (mutate) => {
    const changed = structuredClone(first);
    mutate(changed);
    const schemaDocuments = fixture.schemaDocuments.map((entry, index) => index === 0
      ? { ...entry, bytes: packCanonicalBytes(changed) }
      : entry);
    code('PACK_SCHEMA_DOCUMENT_INVALID', () => validatePackSchemaRegistry({
      registryBytes: fixture.registry.canonicalBytes,
      contractPolicyBytes: fixture.policy.canonicalBytes,
      schemaDocuments, vectorSets: fixture.vectorSets,
      validatorIdentities: fixture.validatorIdentities
    }));
  };
  for (const forbidden of [
    '$ref', '$dynamicRef', '$id', 'format', 'default', 'coerce',
    'transform', 'validator', 'code', 'remoteUri'
  ]) rejectsDocument((document) => { document.properties.payload = { [forbidden]: 'forbidden' }; document.required.push('payload'); });
  rejectsDocument((document) => { document.additionalProperties = true; });
  rejectsDocument((document) => { document.required = ['artifactType']; });
  rejectsDocument((document) => { document.properties.artifactType.const = 'wrong-artifact-type'; });
  rejectsDocument((document) => { document.properties.schemaVersion.const = 2; });

  let deep = {};
  for (let index = 0; index < 34; index += 1) deep = { child: deep };
  code('PACK_CANONICAL_DEPTH_EXCEEDED', () => packCanonicalBytes(deep));
  code('PACK_CANONICAL_ARRAY_INVALID', () => packCanonicalBytes(Array.from({ length: 2_049 }, () => null)));
  code('PACK_CANONICAL_OBJECT_INVALID', () => packCanonicalBytes(Object.fromEntries(
    Array.from({ length: 65 }, (_, index) => [`key-${String(index).padStart(2, '0')}`, null])
  )));
  const oversized = Array.from({ length: 2_048 }, () => 'x'.repeat(600));
  code('PACK_CANONICAL_DOCUMENT_EXCEEDED', () => packCanonicalBytes(oversized));
  code('PACK_CANONICAL_INPUT_INVALID', () => parsePackCanonicalJson(Buffer.alloc(1_048_577, 0x20)));
});

export function buildCatalogGraphFixture(
  predecessorSnapshotDigest = ZERO,
  generation = 1,
  includeApplicability = true,
  variant = '',
  targetState = 'available',
  version = '1.0.0'
) {
  const { policy, identities, validated: schemaRegistry } = buildValidatedRegistry();
  const composerImplementationDigest = sha(Buffer.from('composer-v1'));
  const kernelSchemaDigest = sha(Buffer.from('kernel-schema-v1'));
  const baseLaneContractDigest = sha(Buffer.from('base-lane-v1'));
  const validator = identities[0];
  const contentRecord = validArtifact('kstack-pack-content');
  if (variant !== '') contentRecord.sections[0].questions[0].text = `Health evidence ${variant}?`;
  const content = createD5Artifact(contentRecord);
  const evidence = createD5Artifact(validArtifact('kstack-pack-evidence-schema'));
  const fixtureFiles = [opened('health.json', Buffer.from('{"healthy":true}'))];
  const fixturesDigest = packFileSetDigest('KSTACK-PACK-FIXTURES-V1', fixtureFiles);
  const manifest = createD5Artifact({
    ...validArtifact('kstack-pack-manifest'), version, contentDigest: content.artifactDigest,
    evidenceSchemaDigest: evidence.artifactDigest, fixturesDigest
  });
  const bundleFiles = [
    { relativePath: 'content.json', bytes: content.canonicalBytes },
    { relativePath: 'evidence.schema.json', bytes: evidence.canonicalBytes },
    { relativePath: 'fixtures/health.json', bytes: fixtureFiles[0].bytes },
    { relativePath: 'manifest.json', bytes: manifest.canonicalBytes }
  ];
  const orderedFiles = bundleFiles.map((entry) => ({
    relativePath: entry.relativePath, byteLength: entry.bytes.length, contentSha256: sha(entry.bytes)
  }));
  const bundleIndex = createD5Artifact({
    ...validArtifact('kstack-pack-bundle-index'), version, manifestDigest: manifest.artifactDigest,
    contentDigest: content.artifactDigest, evidenceSchemaDigest: evidence.artifactDigest,
    fixturesDigest, orderedFiles
  });
  const bundleDigest = packFileSetDigest('KSTACK-PACK-BUNDLE-V1', bundleFiles);
  const d2Material = createPackArtifact({
    artifactType: 'kstack-pack-material', schemaVersion: 1,
    packId: 'assurance', version, bundleDigest
  });
  const compatibility = createD5Artifact({
    ...validArtifact('kstack-pack-compatibility-entry'), version, bundleDigest,
    manifestDigest: manifest.artifactDigest, contentDigest: content.artifactDigest,
    evidenceSchemaDigest: evidence.artifactDigest, fixturesDigest,
    bundleIndexDigest: bundleIndex.artifactDigest,
    schemaRegistryDigest: schemaRegistry.schemaRegistryDigest,
    contractPolicyDigest: policy.artifactDigest, composerImplementationDigest,
    validatorIdentityDigests: [{ targetPlatform: 'linux-x64', validatorIdentityDigest: validator.artifactDigest }],
    kernelSchemaDigest, baseLaneContractDigest
  });
  const provenance = createD5Artifact({
    ...validArtifact('kstack-pack-source-provenance'), version, bundleDigest,
    manifestDigest: manifest.artifactDigest, contentDigest: content.artifactDigest,
    evidenceSchemaDigest: evidence.artifactDigest, fixturesDigest,
    bundleIndexDigest: bundleIndex.artifactDigest
  });
  const assertionTuple = {
    version, bundleDigest, manifestDigest: manifest.artifactDigest, contentDigest: content.artifactDigest,
    evidenceSchemaDigest: evidence.artifactDigest, fixturesDigest,
    bundleIndexDigest: bundleIndex.artifactDigest,
    sourceProvenanceDigest: provenance.artifactDigest,
    schemaRegistryDigest: schemaRegistry.schemaRegistryDigest,
    contractPolicyDigest: policy.artifactDigest,
    compatibilityEntryDigest: compatibility.artifactDigest,
    composerImplementationDigest, kernelSchemaDigest, baseLaneContractDigest,
    validatorIdentityDigests: [validator.artifactDigest]
  };
  const review = createD5Artifact({ ...assertion(false), ...assertionTuple });
  const approval = createD5Artifact({ ...assertion(true), ...assertionTuple });
  const available = {
    packId: 'assurance', state: targetState, version, bundleDigest,
    manifestDigest: manifest.artifactDigest, contentDigest: content.artifactDigest,
    evidenceSchemaDigest: evidence.artifactDigest, fixturesDigest,
    bundleIndexDigest: bundleIndex.artifactDigest, sourceProvenanceDigest: provenance.artifactDigest,
    reviewArtifactDigest: review.artifactDigest, approvalArtifactDigest: approval.artifactDigest,
    compatibilityEntryDigest: compatibility.artifactDigest
  };
  const quarantine = targetState === 'quarantined' ? createD5Artifact({
    ...validArtifact('kstack-pack-quarantine-record'), bundleDigest
  }) : null;
  if (quarantine) available.quarantineRecordDigest = quarantine.artifactDigest;
  const snapshot = createD5Artifact({
    artifactType: 'kstack-pack-catalog-snapshot', schemaVersion: 1, contractVersion: 1,
    generation, predecessorSnapshotDigest,
    schemaRegistryDigest: schemaRegistry.schemaRegistryDigest,
    contractPolicyDigest: policy.artifactDigest,
    catalogEntries: PACK_CONTRACT_POLICY.packIds.map((packId) => packId === 'assurance'
      ? available : { packId, state: 'roadmap-only' }),
    compatibilityEntries: [compatibility.record],
    applicabilityEntries: includeApplicability ? [{
      packMaterialDigest: d2Material.artifactDigest, sectionId: 'readiness',
      artifactClasses: [...PACK_ARTIFACT_CLASSES]
    }] : []
  });
  const artifacts = [
    ['contract-policy', policy], ['snapshot', snapshot],
    ['assurance-manifest', manifest], ['assurance-content', content],
    ['assurance-evidence-schema', evidence], ['assurance-bundle-index', bundleIndex],
    ['assurance-compatibility', compatibility], ['assurance-source-provenance', provenance],
    ['assurance-review', review], ['assurance-approval', approval],
    [`validator-${validator.artifactDigest.slice(0, 16)}`, validator],
    ...(quarantine ? [['assurance-quarantine', quarantine]] : [])
  ].map(([role, artifact]) => ({
    role, artifactType: artifact.record.artifactType, digest: artifact.artifactDigest, bytes: artifact.canonicalBytes
  }));
  const inventory = createPackOperationInventory({ operationId: 'activate-assurance-1', artifacts });
  const graphInput = {
    schemaRegistry, operationInventoryBytes: inventory.canonicalBytes,
    expectedOperationInventoryDigest: inventory.artifactDigest,
    artifactSources: artifacts.map((entry) => ({ ...entry, regular: true, linkCount: 1, identityStable: true })),
    expectedSnapshotDigest: snapshot.artifactDigest, projectId: 'project',
    repositoryImmutableId: 'repository-1', materialGraphs: [{ packId: 'assurance', fixtureFiles }],
    expectedComposerImplementationDigest: composerImplementationDigest,
    expectedKernelSchemaDigest: kernelSchemaDigest,
    expectedBaseLaneContractDigest: baseLaneContractDigest,
    requiredValidatorTargets: ['linux-x64'],
    trustedTime: trustedTimeBinding('2026-08-29T18:01:00.000Z'),
    trustedTimeAuthority: trustedTimeAuthority()
  };
  const graph = validatePackCatalogGraph(graphInput);
  return { graph, graphInput, snapshot, schemaRegistry, policy, available, d2Material };
}

function createHistoricalCatalogSnapshot(candidate, { state, version, generation = 0 }) {
  const compatibility = createD5Artifact({
    ...candidate.graph.snapshot.compatibilityEntries[0], version
  });
  const assurance = state === 'roadmap-only' ? { packId: 'assurance', state } : {
    ...candidate.available, state, version,
    compatibilityEntryDigest: compatibility.artifactDigest
  };
  if (state !== 'roadmap-only') {
    delete assurance.quarantineRecordDigest;
    if (state === 'quarantined') assurance.quarantineRecordDigest = sha(Buffer.from(`quarantine:${version}`));
  }
  return createD5Artifact({
    artifactType: 'kstack-pack-catalog-snapshot', schemaVersion: 1, contractVersion: 1,
    generation, predecessorSnapshotDigest: generation === 0 ? null : ZERO,
    schemaRegistryDigest: candidate.graph.schemaRegistryDigest,
    contractPolicyDigest: candidate.graph.contractPolicyDigest,
    catalogEntries: PACK_CONTRACT_POLICY.packIds.map((packId) => packId === 'assurance'
      ? assurance : { packId, state: 'roadmap-only' }),
    compatibilityEntries: state === 'roadmap-only' ? [] : [compatibility.record],
    applicabilityEntries: state === 'roadmap-only' ? [] : candidate.graph.snapshot.applicabilityEntries
  });
}

async function readCatalogHead(snapshot, overrides = {}) {
  const pointer = createCurrentPackPointerRecord({
    recordVersion: 1, projectId: 'project', repositoryImmutableId: 'repository-1',
    contractVersion: 1, generation: snapshot.record.generation,
    snapshotDigest: snapshot.artifactDigest, predecessorPointerDigest: ZERO,
    activationRequestDigest: ZERO, commitTransactionId: `head-${overrides.label ?? 'fixture'}`,
    committedAt: '2026-08-29T18:00:00.000Z'
  });
  const live = {
    pointerRecord: pointer.record, ledgerEpoch: 2, ledgerRevision: 10,
    checkpointDigest: sha(Buffer.from(`checkpoint:${overrides.label ?? 'fixture'}`)),
    trustedTimeReceiptDigest: '9'.repeat(64), issuedAt: '2026-08-29T18:00:50.000Z',
    expiresAt: '2026-08-29T18:01:20.000Z', brokerKeyId: 'broker-key-1', signatureBase64: 'YQ==',
    ...overrides.live
  };
  const trust = {
    qualified: true, current: true, keyId: live.brokerKeyId,
    checkpointContinuity: true, rollbackDetected: false, ...overrides.trust
  };
  return readCurrentPackHead({
    projectId: 'project', repositoryImmutableId: 'repository-1',
    readerNonce: sha(Buffer.from(`nonce:${overrides.label ?? crypto.randomUUID()}`)),
    priorHighWater: overrides.priorHighWater ?? null,
    trustedTime: trustedTimeBinding('2026-08-29T18:01:00.000Z', '9'.repeat(64)),
    trustedTimeAuthority: trustedTimeAuthority(),
    ledger: {
      async capabilities() { return { serializableRead: true, monotoneRevision: true, checkpointContinuity: true, durable: true }; },
      async readCurrent() { return live; }
    },
    snapshotAuthority: {
      async readByDigest() {
        return { bytes: snapshot.canonicalBytes, durable: true, immutable: true, retentionPinned: true };
      }
    },
    brokerTrustAuthority: { async verifyHeadProof() { return trust; } },
    nonceLedger: {
      async consumeOnce() { return { consumed: true, checkpointDigest: sha(Buffer.from('head-nonce-checkpoint')) }; }
    }
  });
}

function durableActivationStore() {
  const staged = new Map();
  return {
    async capabilities() {
      return { immutableByDigest: true, durable: true, retentionPins: true, readAfterWrite: true, atomicPromotion: true };
    },
    async stage(record) {
      const stagingDigest = sha(packCanonicalBytes({ stagingId: record.stagingId, snapshotDigest: record.snapshotDigest }));
      staged.set(record.stagingId, { ...record, stagingDigest });
      return {
        staged: true, durable: true, readAfterWrite: true, pinned: true,
        stagingDigest, leaseExpiresAt: '2026-08-29T19:00:00.000Z'
      };
    },
    async confirmStaged({ stagingId }) {
      const record = staged.get(stagingId);
      return {
        complete: Boolean(record), durable: Boolean(record), pinned: Boolean(record),
        snapshotDigest: record?.snapshotDigest ?? ZERO,
        stagingDigest: record?.stagingDigest ?? ZERO
      };
    }
  };
}

test('D5 activation classifies every transition and refuses stale, untrusted, or non-durable inputs', async () => {
  const transitions = [
    { kind: 'upgrade', beforeState: 'available', beforeVersion: '0.9.0', afterState: 'available', afterVersion: '1.0.0', weakening: false },
    { kind: 'downgrade', beforeState: 'available', beforeVersion: '2.0.0', afterState: 'available', afterVersion: '1.0.0', weakening: true, action: 'catalog-downgrade' },
    { kind: 'rollback', beforeState: 'available', beforeVersion: '2.0.0', afterState: 'available', afterVersion: '1.0.0', weakening: true, action: 'catalog-downgrade' },
    { kind: 'quarantine', beforeState: 'available', beforeVersion: '1.0.0', afterState: 'quarantined', afterVersion: '1.0.0', weakening: false },
    { kind: 'quarantine-reversal', beforeState: 'quarantined', beforeVersion: '1.0.0', afterState: 'available', afterVersion: '1.0.0', weakening: true, action: 'quarantine-reversal' }
  ];
  for (const [index, row] of transitions.entries()) {
    const template = buildCatalogGraphFixture(ZERO, 1, true, `transition-${index}`, row.afterState, row.afterVersion);
    const before = createHistoricalCatalogSnapshot(template, {
      state: row.beforeState, version: row.beforeVersion
    });
    const candidate = buildCatalogGraphFixture(
      before.artifactDigest, 1, true, `transition-${index}`, row.afterState, row.afterVersion
    );
    const head = await readCatalogHead(before, { label: `transition-${index}` });
    let historyCalls = 0;
    const prepared = await preparePackActivation({
      currentHead: head, candidateGraph: candidate.graph, transitionKind: row.kind,
      changedPackIds: ['assurance'], ...activationPolicyBinding(),
      stagingId: `transition-staging-${index}`, contentStore: durableActivationStore(),
      historyAuthority: row.kind === 'rollback' ? {
        async confirmRetained({ packId, catalogEntry }) {
          historyCalls += 1;
          assert.equal(packId, 'assurance');
          assert.equal(catalogEntry.version, '1.0.0');
          return { retained: true, compatible: true, historyDigest: sha(Buffer.from('retained-history')) };
        }
      } : null
    });
    assert.equal(prepared.classification.transitionKind, row.kind);
    assert.equal(prepared.classification.weakeningRequired, row.weakening);
    if (row.action) assert.equal(prepared.classification.weakeningAction, row.action);
    assert.equal(historyCalls, row.kind === 'rollback' ? 1 : 0);
  }

  const template = buildCatalogGraphFixture();
  const before = createHistoricalCatalogSnapshot(template, { state: 'roadmap-only', version: '1.0.0' });
  const candidate = buildCatalogGraphFixture(before.artifactDigest);
  const head = await readCatalogHead(before, { label: 'durability-base' });
  await assert.rejects(() => preparePackActivation({
    currentHead: head, candidateGraph: candidate.graph, transitionKind: 'activate',
    changedPackIds: ['assurance'], ...activationPolicyBinding(), stagingId: 'bad-capability',
    contentStore: {
      async capabilities() { return { immutableByDigest: true, durable: false, retentionPins: true, readAfterWrite: true, atomicPromotion: true }; },
      async stage() { throw new Error('unreachable'); }, async confirmStaged() { throw new Error('unreachable'); }
    }, historyAuthority: null
  }), (error) => error?.code === 'PACK_ACTIVATION_STAGING_NOT_DURABLE');

  await assert.rejects(() => preparePackActivation({
    currentHead: head, candidateGraph: candidate.graph, transitionKind: 'activate',
    changedPackIds: ['assurance'], requiredPackIds: [], ...activationPolicyBinding(),
    stagingId: 'caller-required-pack-override', contentStore: durableActivationStore(), historyAuthority: null
  }), (error) => error?.code === 'PACK_ACTIVATION_DIFF_INVALID');

  const fakeMaterialDigest = 'f'.repeat(64);
  const historicalWithForeignApplicability = createD5Artifact({
    ...before.record,
    applicabilityEntries: [{
      packMaterialDigest: fakeMaterialDigest, sectionId: 'readiness',
      artifactClasses: ['implementation-plan']
    }]
  });
  const candidateWithForeignBase = buildCatalogGraphFixture(historicalWithForeignApplicability.artifactDigest);
  const foreignRows = [
    ...candidateWithForeignBase.snapshot.record.applicabilityEntries,
    {
      packMaterialDigest: fakeMaterialDigest, sectionId: 'readiness',
      artifactClasses: ['implementation-plan', 'qc-report']
    }
  ].sort((left, right) => Buffer.compare(
    Buffer.from(`${left.packMaterialDigest}\u0000${left.sectionId}`),
    Buffer.from(`${right.packMaterialDigest}\u0000${right.sectionId}`)
  ));
  const alteredSnapshot = createD5Artifact({
    ...candidateWithForeignBase.snapshot.record,
    applicabilityEntries: foreignRows
  });
  const alteredArtifacts = candidateWithForeignBase.graphInput.artifactSources
    .filter((entry) => entry.role !== 'snapshot')
    .map(({ role, artifactType, digest, bytes }) => ({ role, artifactType, digest, bytes }));
  alteredArtifacts.push({
    role: 'snapshot', artifactType: alteredSnapshot.record.artifactType,
    digest: alteredSnapshot.artifactDigest, bytes: alteredSnapshot.canonicalBytes
  });
  const alteredInventory = createPackOperationInventory({
    operationId: 'alter-foreign-applicability', artifacts: alteredArtifacts
  });
  const alteredGraph = validatePackCatalogGraph({
    ...candidateWithForeignBase.graphInput,
    operationInventoryBytes: alteredInventory.canonicalBytes,
    expectedOperationInventoryDigest: alteredInventory.artifactDigest,
    artifactSources: alteredArtifacts.map((entry) => ({
      ...entry, regular: true, linkCount: 1, identityStable: true
    })),
    expectedSnapshotDigest: alteredSnapshot.artifactDigest
  });
  const foreignHead = await readCatalogHead(historicalWithForeignApplicability, { label: 'foreign-applicability' });
  await assert.rejects(() => preparePackActivation({
    currentHead: foreignHead, candidateGraph: alteredGraph, transitionKind: 'activate',
    changedPackIds: ['assurance'], ...activationPolicyBinding(),
    stagingId: 'foreign-applicability', contentStore: durableActivationStore(), historyAuthority: null
  }), (error) => error?.code === 'PACK_ACTIVATION_DIFF_INVALID');

  for (const [label, overrides, expected] of [
    ['high-water', { priorHighWater: { ledgerEpoch: 2, ledgerRevision: 11 } }, 'PACK_ACTIVATION_STALE'],
    ['issued-future', { live: { issuedAt: '2026-08-29T18:01:01.000Z' } }, 'PACK_ACTIVATION_STALE'],
    ['expired', { live: { expiresAt: '2026-08-29T18:01:00.000Z' } }, 'PACK_ACTIVATION_STALE'],
    ['wide-window', { live: { issuedAt: '2026-08-29T18:00:00.000Z', expiresAt: '2026-08-29T18:01:01.000Z' } }, 'PACK_ACTIVATION_STALE'],
    ['unqualified-proof', { trust: { qualified: false } }, 'PACK_ACTIVATION_LEDGER_UNAVAILABLE'],
    ['stale-proof', { trust: { current: false } }, 'PACK_ACTIVATION_LEDGER_UNAVAILABLE'],
    ['continuity-failed', { trust: { checkpointContinuity: false } }, 'PACK_ACTIVATION_LEDGER_UNAVAILABLE'],
    ['rollback-proof', { trust: { rollbackDetected: true } }, 'PACK_ACTIVATION_LEDGER_UNAVAILABLE'],
    ['key-mismatch', { trust: { keyId: 'other-key' } }, 'PACK_ACTIVATION_LEDGER_UNAVAILABLE']
  ]) {
    await assert.rejects(() => readCatalogHead(before, { label, ...overrides }),
      (error) => error?.code === expected);
  }
});

async function buildValidatedSelectionForCatalog(candidate) {
  const repositoryPolicyDigest = sha(Buffer.from('d6-repository-policy'));
  const compatibility = createPackArtifact({
    artifactType: 'kstack-pack-compatibility-tuple', schemaVersion: 1,
    packId: 'assurance', version: '1.0.0', materialDigest: candidate.d2Material.artifactDigest,
    compatible: true
  });
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
    artifactType: 'kstack-pack-review', schemaVersion: 1,
    materialDigest: candidate.d2Material.artifactDigest,
    compatibilityTupleDigest: compatibility.artifactDigest,
    reviewPolicyDigest: reviewPolicy.artifactDigest, verdict: 'approve', reviewerClass: 'primary-agent',
    confidence: 96, passedChecks: ['artifact-integrity', 'compatibility', 'policy-conformance', 'security', 'test-evidence'],
    securityFindingCount: 0, materialDissentCount: 0, unresolvedQuestionCount: 0
  });
  const approval = createPackArtifact({
    artifactType: 'kstack-pack-approval', schemaVersion: 1,
    materialDigest: candidate.d2Material.artifactDigest, reviewArtifactDigest: review.artifactDigest,
    approvalPolicyDigest: approvalPolicy.artifactDigest, acceptedVerdict: 'approve',
    approvalClass: 'independent-agent', independentFromReviewer: true
  });
  const entry = {
    packId: 'assurance', version: '1.0.0', materialDigest: candidate.d2Material.artifactDigest,
    compatibilityTupleDigest: compatibility.artifactDigest, reviewArtifactDigest: review.artifactDigest,
    approvalArtifactDigest: approval.artifactDigest
  };
  const snapshot = createPackArtifact({
    artifactType: 'kstack-pack-snapshot', schemaVersion: 1, generation: 1,
    repositoryPolicyDigest, entries: [entry]
  });
  const selection = createPackSelection({
    subjectDigest: sha(Buffer.from('d6-subject')), repositoryPolicyDigest,
    snapshotDigest: snapshot.artifactDigest, expectedGeneration: 1, orderedEntries: [entry],
    compositionInputs: [
      { role: 'implementation-plan', digest: sha(Buffer.from('plan')) },
      { role: 'objective', digest: sha(Buffer.from('objective')) },
      { role: 'qc', digest: sha(Buffer.from('qc')) },
      { role: 'release-observation', digest: sha(Buffer.from('release')) }
    ],
    expiresAt: '2026-08-29T18:10:00.000Z'
  });
  const artifacts = [
    reviewPolicy, approvalPolicy, candidate.d2Material, compatibility, review, approval, snapshot, selection
  ];
  const operationReceiptDigest = sha(Buffer.from('d6-selection-operation'));
  const inventory = createValidationInventory({
    operationReceiptDigest,
    artifacts: artifacts.map((artifact) => ({
      artifactType: artifact.record.artifactType, digest: artifact.artifactDigest, bytes: artifact.canonicalBytes
    }))
  });
  const ownerAcceptance = await identityAcceptance('pack-selection', selection.artifactDigest, repositoryPolicyDigest);
  return validatePackSelection({
    selectionBytes: selection.canonicalBytes, expectedSelectionDigest: selection.artifactDigest,
    inventoryBytes: inventory.canonicalBytes, expectedInventoryDigest: inventory.inventoryDigest,
    expectedOperationReceiptDigest: operationReceiptDigest, expectedRepositoryPolicyDigest: repositoryPolicyDigest,
    liveGuard: { snapshotDigest: snapshot.artifactDigest, generation: 1 }, ownerAcceptance,
    trustedTime: { now: NOW, sourceProfileDigest: sha(Buffer.from('d6-time-profile')), attestationDigest: sha(Buffer.from('d6-time')), qualified: true, rollbackDetected: false }
  });
}

function exactBudgetQualification(countOverride = null) {
  const codeBytes = Buffer.from('qualified-exact-tokenizer-v1');
  const asset = Buffer.from('qualified-exact-tokenizer-assets-v1');
  const count = countOverride ?? ((bytes) => Math.ceil(bytes.length / 4));
  const goldenVectors = [
    { requestBytes: Buffer.from('abc'), expectedTokens: 1 },
    { requestBytes: Buffer.from('abcdx'), expectedTokens: 2 }
  ];
  const vectorRecords = goldenVectors.map((entry) => ({
    requestBase64: entry.requestBytes.toString('base64'), expectedTokens: entry.expectedTokens
  }));
  const profile = createProviderBudgetProfile({
    providerId: 'provider', modelId: 'model-v1', contextWindowTokens: 8_192,
    tokenizerMode: 'qualified-exact', tokenizerName: 'exact-v1', tokenizerVersion: '1.0.0',
    tokenizerCodeDigest: sha(codeBytes), tokenizerAssetDigests: [sha(asset)],
    requestFramingVersion: 'kstack-provider-messages-v1', fixedFramingTokens: 3,
    perMessageFramingTokens: 2, responseReserveTokens: 256, safetyReserveTokens: 128,
    profilePolicyDigest: sha(Buffer.from('d6-profile-policy'))
  });
  const qualification = createProviderBudgetQualification({
    profileDigest: profile.profileDigest, providerModelBindingDigest: sha(Buffer.from('provider-model-binding')),
    contextSourceDigest: sha(Buffer.from('context-source')),
    goldenVectorSetDigest: domainSha('KSTACK-TOKENIZER-GOLDEN-VECTORS-V1\n', packCanonicalBytes(vectorRecords)),
    byteUpperBoundProofDigest: null, specialFramingProofDigest: sha(Buffer.from('framing-proof')), qualified: true
  });
  const qualified = qualifyProviderBudgetProfile({
    profileBytes: profile.canonicalBytes, expectedProfileDigest: profile.profileDigest,
    qualificationBytes: qualification.canonicalBytes, expectedQualificationDigest: qualification.qualificationDigest,
    exactTokenizer: {
      tokenizerName: 'exact-v1', tokenizerVersion: '1.0.0', codeBytes,
      assets: [{ name: 'vocab.bin', bytes: asset }], goldenVectors, count
    }
  });
  return { profile, qualification, qualified };
}

test('D5 catalog graph proves the complete available-pack tuple from one closed inventory', () => {
  const { graph, graphInput, snapshot } = buildCatalogGraphFixture();
  assert.equal(graph.snapshotDigest, snapshot.artifactDigest);
  assert.equal(graph.materialProofs[0].packId, 'assurance');
  assert.equal(assertValidatedPackCatalogGraph(graph), graph);
  code('PACK_ACTIVATION_GRAPH_INVALID', () => assertValidatedPackCatalogGraph(structuredClone(graph)));
  assert.throws(() => validatePackCatalogGraph({
    ...graphInput,
    artifactSources: graphInput.artifactSources.map((entry) => entry.role === 'assurance-content'
      ? { ...entry, bytes: Buffer.from(entry.bytes).fill(0, 0, 1) } : entry)
  }));
  code('PACK_ACTIVATION_GRAPH_INVALID', () => validatePackCatalogGraph({
    ...graphInput,
    trustedTimeAuthority: trustedTimeAuthority({ protected: false, repositoryResident: true })
  }));
});

test('D6 exact budget binds catalog applicability, whole-request tokens, all caps, and dispatch recheck', async () => {
  const candidate = buildCatalogGraphFixture();
  const selection = await buildValidatedSelectionForCatalog(candidate);
  const { qualified } = exactBudgetQualification();
  const applicability = validateCatalogApplicability({ validatedCatalogGraph: candidate.graph });
  assert.equal(applicability.materials[0].material.artifactDigest, candidate.d2Material.artifactDigest);
  const baseInput = {
    validatedSelection: selection, validatedCatalogGraph: candidate.graph, qualifiedProfile: qualified,
    artifactClass: 'release-plan',
    baseMessages: [{ role: 'system', content: 'Base policy.' }, { role: 'user', content: 'Prepare release.' }],
    caps: {
      repositoryContextCapTokens: 8_192, operationContextCapTokens: 8_192,
      repositoryPerPackCapBytes: 16_384, operationPerPackCapBytes: 16_384,
      repositoryTotalPackCapBytes: 32_768, operationTotalPackCapBytes: 32_768
    }
  };
  const composed = composePackBudget(baseInput);
  const rendered = composed.finalRequestBytes.toString('utf8');
  const selectedDigest = selection.projection.orderedEntries[0].materialDigest;
  assert.match(rendered, new RegExp(`\\[/KSTACK-PACK:assurance:${selectedDigest}\\]`, 'u'));
  assert.doesNotMatch(rendered, /\[\/KSTACK-PACK:assurance\](?:\n|$)/u);
  assert.equal(composed.receipt.requestTokens, Math.ceil(composed.finalRequestBytes.length / 4));
  assert.equal(composed.receipt.matchedSections[0].sectionId, 'readiness');
  assert.equal(composed.receipt.artifactClass, 'release-plan');
  assert.equal(composed.receipt.cumulativeExactTokenCounts.length, 1);
  assert.equal(admitPackBudgetDispatch({
    budgetResult: composed, validatedSelection: selection, validatedCatalogGraph: candidate.graph
  }).record.admitted, true);
  code('PACK_BUDGET_RECEIPT_MISMATCH', () => admitPackBudgetDispatch({
    budgetResult: { ...composed }, validatedSelection: selection,
    validatedCatalogGraph: candidate.graph
  }));

  const substitutedCandidate = buildCatalogGraphFixture(ZERO, 1, true, 'substituted');
  const substitutedSelection = await buildValidatedSelectionForCatalog(substitutedCandidate);
  code('PACK_BUDGET_RECEIPT_MISMATCH', () => admitPackBudgetDispatch({
    budgetResult: composed, validatedSelection: substitutedSelection,
    validatedCatalogGraph: substitutedCandidate.graph
  }));

  let tokenizerBias = 0;
  const mutableTokenizerQualification = exactBudgetQualification(
    (bytes) => Math.ceil(bytes.length / 4) + tokenizerBias
  );
  const recomposed = composePackBudget({ ...baseInput, qualifiedProfile: mutableTokenizerQualification.qualified });
  tokenizerBias = 1;
  code('PACK_BUDGET_RECEIPT_MISMATCH', () => admitPackBudgetDispatch({
    budgetResult: recomposed, validatedSelection: selection, validatedCatalogGraph: candidate.graph
  }));

  code('PACK_SELECTION_INVALID', () => composePackBudget({ ...baseInput, validatedSelection: structuredClone(selection) }));
  code('PACK_BUDGET_EXCEEDED', () => composePackBudget({
    ...baseInput,
    caps: { ...baseInput.caps, operationPerPackCapBytes: composed.receipt.perPack[0].actualUtf8Bytes - 1 }
  }));
  const exactBoundary = composePackBudget({
    ...baseInput,
    caps: {
      ...baseInput.caps,
      repositoryContextCapTokens: composed.receipt.requiredTokens,
      operationContextCapTokens: composed.receipt.requiredTokens
    }
  });
  assert.equal(exactBoundary.receipt.remainingTokens, 0);
  code('PACK_BUDGET_EXCEEDED', () => composePackBudget({
    ...baseInput,
    caps: {
      ...baseInput.caps,
      repositoryContextCapTokens: composed.receipt.requiredTokens - 1,
      operationContextCapTokens: composed.receipt.requiredTokens - 1
    }
  }));

  const missing = buildCatalogGraphFixture(ZERO, 1, false);
  code('PACK_SELECTION_INVALID', () => validateCatalogApplicability({ validatedCatalogGraph: missing.graph }));
});

test('D6 fallback uses the qualified one-byte upper bound and rejects proof/profile ambiguity', async () => {
  const candidate = buildCatalogGraphFixture();
  const selection = await buildValidatedSelectionForCatalog(candidate);
  const profile = createProviderBudgetProfile({
    providerId: 'provider', modelId: 'fallback-v1', contextWindowTokens: 8_192,
    tokenizerMode: 'byte-upper-bound-v1', tokenizerName: 'utf8-byte-upper-bound', tokenizerVersion: '1.0.0',
    tokenizerCodeDigest: sha(Buffer.from('fallback-spec')), tokenizerAssetDigests: [],
    requestFramingVersion: 'kstack-provider-messages-v1', fixedFramingTokens: 3,
    perMessageFramingTokens: 2, responseReserveTokens: 256, safetyReserveTokens: 128,
    profilePolicyDigest: sha(Buffer.from('fallback-policy'))
  });
  const qualification = createProviderBudgetQualification({
    profileDigest: profile.profileDigest, providerModelBindingDigest: sha(Buffer.from('fallback-binding')),
    contextSourceDigest: sha(Buffer.from('fallback-context')), goldenVectorSetDigest: null,
    byteUpperBoundProofDigest: sha(Buffer.from('one-byte-one-token-proof')),
    specialFramingProofDigest: sha(Buffer.from('fallback-framing-proof')), qualified: true
  });
  const qualified = qualifyProviderBudgetProfile({
    profileBytes: profile.canonicalBytes, expectedProfileDigest: profile.profileDigest,
    qualificationBytes: qualification.canonicalBytes, expectedQualificationDigest: qualification.qualificationDigest,
    exactTokenizer: null
  });
  const base = {
    validatedSelection: selection, validatedCatalogGraph: candidate.graph, qualifiedProfile: qualified,
    artifactClass: 'qc-report', baseMessages: [{ role: 'user', content: 'é' }],
    caps: {
      repositoryContextCapTokens: 8_192, operationContextCapTokens: 8_192,
      repositoryPerPackCapBytes: 16_384, operationPerPackCapBytes: 16_384,
      repositoryTotalPackCapBytes: 32_768, operationTotalPackCapBytes: 32_768
    }
  };
  const result = composePackBudget(base);
  assert.equal(result.receipt.requestTokens,
    result.receipt.measuredRequestUtf8Bytes + 3 + 2 * result.receipt.messageCount);
  assert.equal(result.receipt.cumulativeExactTokenCounts, null);

  const missingProof = createProviderBudgetQualification({
    ...qualification.record, byteUpperBoundProofDigest: null
  });
  code('PACK_BUDGET_TOKENIZER_UNQUALIFIED', () => qualifyProviderBudgetProfile({
    profileBytes: profile.canonicalBytes, expectedProfileDigest: profile.profileDigest,
    qualificationBytes: missingProof.canonicalBytes, expectedQualificationDigest: missingProof.qualificationDigest,
    exactTokenizer: null
  }));
  code('PACK_BUDGET_PROFILE_UNQUALIFIED', () => composePackBudget({
    ...base, caps: { ...base.caps, operationContextCapTokens: 8_193 }
  }));
});

test('D5 activation challenge, staging, authenticated CAS, and exact recovery are fail closed', async () => {
  const registry = buildValidatedRegistry();
  const genesis = createD5Artifact({
    artifactType: 'kstack-pack-catalog-snapshot', schemaVersion: 1, contractVersion: 1,
    generation: 0, predecessorSnapshotDigest: null,
    schemaRegistryDigest: registry.validated.schemaRegistryDigest,
    contractPolicyDigest: registry.policy.artifactDigest,
    catalogEntries: PACK_CONTRACT_POLICY.packIds.map((packId) => ({ packId, state: 'roadmap-only' })),
    compatibilityEntries: [], applicabilityEntries: []
  });
  const candidate = buildCatalogGraphFixture(genesis.artifactDigest, 1);
  assert.equal(candidate.graph.schemaRegistryDigest, registry.validated.schemaRegistryDigest);
  const genesisPointer = createCurrentPackPointerRecord({
    recordVersion: 1, projectId: 'project', repositoryImmutableId: 'repository-1',
    contractVersion: 1, generation: 0, snapshotDigest: genesis.artifactDigest,
    predecessorPointerDigest: ZERO, activationRequestDigest: ZERO,
    commitTransactionId: 'genesis', committedAt: '2026-08-01T00:00:00.000Z'
  });
  const consumedHeadNonces = new Set();
  const headInput = {
    projectId: 'project', repositoryImmutableId: 'repository-1', readerNonce: '8'.repeat(64),
    priorHighWater: null,
    trustedTime: trustedTimeBinding('2026-08-29T18:01:00.000Z', '9'.repeat(64)),
    trustedTimeAuthority: trustedTimeAuthority(),
    ledger: {
      async capabilities() { return { serializableRead: true, monotoneRevision: true, checkpointContinuity: true, durable: true }; },
      async readCurrent() {
        return {
          pointerRecord: genesisPointer.record, ledgerEpoch: 1, ledgerRevision: 7,
          checkpointDigest: sha(Buffer.from('head-checkpoint')),
          trustedTimeReceiptDigest: '9'.repeat(64), issuedAt: '2026-08-29T18:00:50.000Z',
          expiresAt: '2026-08-29T18:01:20.000Z', brokerKeyId: 'broker-key-1', signatureBase64: 'YQ=='
        };
      }
    },
    snapshotAuthority: {
      async readByDigest() { return { bytes: genesis.canonicalBytes, durable: true, immutable: true, retentionPinned: true }; }
    },
    brokerTrustAuthority: {
      async verifyHeadProof({ proof }) { return { qualified: true, current: true, keyId: proof.brokerKeyId, checkpointContinuity: true, rollbackDetected: false }; }
    },
    nonceLedger: {
      async consumeOnce({ readerNonce }) {
        const consumed = !consumedHeadNonces.has(readerNonce);
        consumedHeadNonces.add(readerNonce);
        return { consumed, checkpointDigest: sha(Buffer.from(`head-nonce:${readerNonce}`)) };
      }
    }
  };
  const head = await readCurrentPackHead(headInput);
  await assert.rejects(() => readCurrentPackHead({
    ...headInput, readerNonce: '7'.repeat(64),
    trustedTimeAuthority: trustedTimeAuthority({ rollbackDetected: true })
  }), (error) => error?.code === 'PACK_ACTIVATION_LEDGER_UNAVAILABLE');
  assert.equal(head.snapshotDigest, genesis.artifactDigest);
  await assert.rejects(() => readCurrentPackHead(headInput), (error) => error?.code === 'PACK_ACTIVATION_REPLAYED');

  const staged = new Map();
  const contentStore = {
    async capabilities() { return { immutableByDigest: true, durable: true, retentionPins: true, readAfterWrite: true, atomicPromotion: true }; },
    async stage(record) {
      const stagingDigest = sha(packCanonicalBytes({ stagingId: record.stagingId, snapshotDigest: record.snapshotDigest }));
      staged.set(record.stagingId, { ...record, stagingDigest });
      return { staged: true, durable: true, readAfterWrite: true, pinned: true, stagingDigest, leaseExpiresAt: '2026-08-29T19:00:00.000Z' };
    },
    async confirmStaged({ stagingId }) {
      const record = staged.get(stagingId);
      return { complete: Boolean(record), durable: Boolean(record), pinned: Boolean(record), snapshotDigest: record?.snapshotDigest ?? ZERO, stagingDigest: record?.stagingDigest ?? ZERO };
    }
  };
  const prepared = await preparePackActivation({
    currentHead: head, candidateGraph: candidate.graph, transitionKind: 'activate',
    changedPackIds: ['assurance'], ...activationPolicyBinding(), stagingId: 'staging-1',
    contentStore, historyAuthority: null
  });
  assert.equal(prepared.classification.weakeningRequired, false);

  const identityPolicyDigest = sha(Buffer.from('catalog-identity-policy'));
  const requestProjection = {
    artifactType: 'kstack-pack-activation-request', schemaVersion: 1,
    projectId: 'project', repositoryImmutableId: 'repository-1',
    fromSnapshotDigest: genesis.artifactDigest, fromGeneration: 0,
    toSnapshotDigest: candidate.graph.snapshotDigest, toGeneration: 1,
    changedPackIds: ['assurance'], transitionKind: 'activate',
    schemaRegistryDigest: candidate.graph.schemaRegistryDigest,
    compatibilityReviewDigest: candidate.graph.materialProofs[0].reviewArtifactDigest,
    d1ActivationAttestationDigest: ZERO, d3WeakeningAuthorizationDigest: null,
    requestNonce: '7'.repeat(64), notBefore: '2026-08-29T18:00:00.000Z',
    expiresAt: '2026-08-29T18:10:00.000Z'
  };
  const d1Activation = await activationIdentity(activationBodyDigest(requestProjection), identityPolicyDigest);
  const request = createD5Artifact({ ...requestProjection, d1ActivationAttestationDigest: d1Activation.receiptDigest });
  class ActivationLedger {
    stored = new Map();
    atomic = true;
    expectedPointerRecordDigest = genesisPointer.pointerRecordDigest;
    lastRecord = null;

    async capabilities() {
      return {
        serializable: this.atomic, atomicPointerReceiptAndNonces: this.atomic,
        guardedCompareAndSwap: this.atomic, uniqueGeneration: this.atomic,
        uniqueRequest: this.atomic, uniqueTransaction: this.atomic,
        uniqueNonce: this.atomic, idempotentRecovery: this.atomic
      };
    }

    async transactActivation(record) {
      this.lastRecord = record;
      const prior = this.stored.get(record.transactionId);
      if (prior) return { ...prior, outcome: 'recovered' };
      assert.equal(record.expectedPointerRecordDigest, this.expectedPointerRecordDigest);
      const result = {
        outcome: 'committed', receiptBytes: record.receiptBytes,
        receiptDigest: record.receiptDigest, pointerRecordBytes: record.pointerRecordBytes,
        pointerRecordDigest: record.pointerRecordDigest, generation: record.candidateGeneration,
        snapshotDigest: record.candidateSnapshotDigest, retentionState: 'historical-active'
      };
      this.stored.set(record.transactionId, result);
      return result;
    }
  }
  const ledger = new ActivationLedger();
  const commitInput = {
    prepared, requestBytes: request.canonicalBytes, expectedRequestDigest: request.artifactDigest,
    d1Activation, identityPolicyDigest,
    ...activationPolicyBinding(),
    identityPolicyAuthority: {
      async confirmCurrent(value) {
        return {
          current: true, policyDigest: value.policyDigest,
          checkpointDigest: sha(Buffer.from('identity-policy-checkpoint')),
          rollbackDetected: false, protected: true, repositoryResident: false
        };
      }
    },
    d3AuthorizationUse: null,
    trustedTime: trustedTimeBinding('2026-08-29T18:02:00.000Z', '6'.repeat(64)),
    trustedTimeAuthority: trustedTimeAuthority(),
    commitTransactionId: 'activation-transaction-1', ledger, contentStore
  };
  const committed = await commitPackActivation(commitInput);
  assert.equal(committed.outcome, 'committed');
  assert.equal(committed.receipt.newSnapshotDigest, candidate.graph.snapshotDigest);
  assert.equal(ledger.lastRecord.policyStateDigest, commitInput.expectedPolicyStateDigest);
  assert.match(ledger.lastRecord.policyStateCheckpointDigest, /^[a-f0-9]{64}$/u);
  const recovered = await commitPackActivation(commitInput);
  assert.equal(recovered.outcome, 'recovered');
  assert.equal(recovered.receiptDigest, committed.receiptDigest);
  await assert.rejects(() => commitPackActivation({
    ...commitInput,
    identityPolicyAuthority: {
      async confirmCurrent(value) {
        return {
          current: true, policyDigest: value.policyDigest,
          checkpointDigest: sha(Buffer.from('identity-policy-checkpoint')),
          rollbackDetected: false, protected: false, repositoryResident: true
        };
      }
    }
  }), (error) => error?.code === 'PACK_ACTIVATION_AUTH_INVALID');
  await assert.rejects(() => commitPackActivation({
    ...commitInput, trustedTimeAuthority: trustedTimeAuthority({ protected: false, repositoryResident: true })
  }), (error) => error?.code === 'PACK_ACTIVATION_AUTH_INVALID');

  const readActivatedHead = async (readerNonce, ledgerRevision) => readCurrentPackHead({
    ...headInput, readerNonce,
    priorHighWater: { ledgerEpoch: 1, ledgerRevision: 7 },
    trustedTime: trustedTimeBinding('2026-08-29T18:03:00.000Z', '9'.repeat(64)),
    ledger: {
      async capabilities() { return { serializableRead: true, monotoneRevision: true, checkpointContinuity: true, durable: true }; },
      async readCurrent() {
        return {
          pointerRecord: committed.pointer, ledgerEpoch: 1, ledgerRevision,
          checkpointDigest: sha(Buffer.from(`head-checkpoint-${ledgerRevision}`)),
          trustedTimeReceiptDigest: '9'.repeat(64), issuedAt: '2026-08-29T18:02:50.000Z',
          expiresAt: '2026-08-29T18:03:20.000Z', brokerKeyId: 'broker-key-1', signatureBase64: 'YQ=='
        };
      }
    },
    snapshotAuthority: {
      async readByDigest() { return { bytes: candidate.snapshot.canonicalBytes, durable: true, immutable: true, retentionPinned: true }; }
    }
  });
  const activatedHead = await readActivatedHead('5'.repeat(64), 8);
  const material = createPackArtifact({ artifactType: 'kstack-pack-material', schemaVersion: 1, packId: 'assurance', version: '1.0.0', bundleDigest: candidate.available.bundleDigest });
  const compatibilityTuple = createPackArtifact({ artifactType: 'kstack-pack-compatibility-tuple', schemaVersion: 1, packId: 'assurance', version: '1.0.0', materialDigest: material.artifactDigest, compatible: true });
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
  const d2Review = createPackArtifact({
    artifactType: 'kstack-pack-review', schemaVersion: 1, materialDigest: material.artifactDigest,
    compatibilityTupleDigest: compatibilityTuple.artifactDigest,
    reviewPolicyDigest: reviewPolicy.artifactDigest, verdict: 'approve', reviewerClass: 'primary-agent',
    confidence: 96, passedChecks: ['artifact-integrity', 'compatibility', 'policy-conformance', 'security', 'test-evidence'],
    securityFindingCount: 0, materialDissentCount: 0, unresolvedQuestionCount: 0
  });
  const d2Approval = createPackArtifact({
    artifactType: 'kstack-pack-approval', schemaVersion: 1, materialDigest: material.artifactDigest,
    reviewArtifactDigest: d2Review.artifactDigest, approvalPolicyDigest: approvalPolicy.artifactDigest,
    acceptedVerdict: 'approve', approvalClass: 'independent-agent', independentFromReviewer: true
  });
  const d2Artifacts = [material, compatibilityTuple, reviewPolicy, approvalPolicy, d2Review, d2Approval];
  const d2Operation = sha(Buffer.from('d2-projection-operation'));
  const d2Inventory = createValidationInventory({
    operationReceiptDigest: d2Operation,
    artifacts: d2Artifacts.map((entry) => ({ artifactType: entry.record.artifactType, digest: entry.artifactDigest, bytes: entry.canonicalBytes }))
  });
  const d2Projection = projectD2PackSnapshot({
    currentHead: activatedHead, repositoryPolicyDigest: sha(Buffer.from('repository-policy')),
    approvalGraphs: [{
      packId: 'assurance', inventoryBytes: d2Inventory.canonicalBytes,
      expectedInventoryDigest: d2Inventory.inventoryDigest,
      expectedOperationReceiptDigest: d2Operation, expectedApprovalDigest: d2Approval.artifactDigest
    }]
  });
  const refreshedHead = await readActivatedHead('4'.repeat(64), 9);
  const guard = confirmD2PackSnapshotCurrent({ projection: d2Projection, freshHead: refreshedHead });
  assert.equal(guard.snapshotDigest, d2Projection.snapshotDigest);
  assert.equal(guard.current, true);

  const disabledSnapshot = createD5Artifact({
    artifactType: 'kstack-pack-catalog-snapshot', schemaVersion: 1, contractVersion: 1,
    generation: 2, predecessorSnapshotDigest: candidate.graph.snapshotDigest,
    schemaRegistryDigest: registry.validated.schemaRegistryDigest,
    contractPolicyDigest: registry.policy.artifactDigest,
    catalogEntries: PACK_CONTRACT_POLICY.packIds.map((packId) => ({ packId, state: 'roadmap-only' })),
    compatibilityEntries: [], applicabilityEntries: []
  });
  const disabledArtifacts = [
    { role: 'contract-policy', artifactType: registry.policy.record.artifactType, digest: registry.policy.artifactDigest, bytes: registry.policy.canonicalBytes },
    { role: 'snapshot', artifactType: disabledSnapshot.record.artifactType, digest: disabledSnapshot.artifactDigest, bytes: disabledSnapshot.canonicalBytes }
  ];
  const disabledInventory = createPackOperationInventory({ operationId: 'disable-assurance-2', artifacts: disabledArtifacts });
  const disabledGraph = validatePackCatalogGraph({
    schemaRegistry: registry.validated, operationInventoryBytes: disabledInventory.canonicalBytes,
    expectedOperationInventoryDigest: disabledInventory.artifactDigest,
    artifactSources: disabledArtifacts.map((entry) => ({ ...entry, regular: true, linkCount: 1, identityStable: true })),
    expectedSnapshotDigest: disabledSnapshot.artifactDigest, projectId: 'project',
    repositoryImmutableId: 'repository-1', materialGraphs: [],
    expectedComposerImplementationDigest: sha(Buffer.from('composer-v1')),
    expectedKernelSchemaDigest: sha(Buffer.from('kernel-schema-v1')),
    expectedBaseLaneContractDigest: sha(Buffer.from('base-lane-v1')),
    requiredValidatorTargets: ['linux-x64'],
    trustedTime: trustedTimeBinding('2026-08-29T18:03:00.000Z'),
    trustedTimeAuthority: trustedTimeAuthority()
  });
  const disabledHead = await readCatalogHead(disabledSnapshot, { label: 'disabled-head' });
  code('PACK_SELECTION_STALE', () => confirmD2PackSnapshotCurrent({
    projection: d2Projection, freshHead: disabledHead
  }));
  const disablePrepared = await preparePackActivation({
    currentHead: activatedHead, candidateGraph: disabledGraph, transitionKind: 'disable',
    changedPackIds: ['assurance'], ...activationPolicyBinding(), stagingId: 'staging-2',
    contentStore, historyAuthority: null
  });
  assert.equal(disablePrepared.classification.weakeningRequired, true);
  const disableProjection = {
    artifactType: 'kstack-pack-activation-request', schemaVersion: 1,
    projectId: 'project', repositoryImmutableId: 'repository-1',
    fromSnapshotDigest: candidate.graph.snapshotDigest, fromGeneration: 1,
    toSnapshotDigest: disabledGraph.snapshotDigest, toGeneration: 2,
    changedPackIds: ['assurance'], transitionKind: 'disable',
    schemaRegistryDigest: disabledGraph.schemaRegistryDigest,
    compatibilityReviewDigest: candidate.graph.materialProofs[0].reviewArtifactDigest,
    d1ActivationAttestationDigest: ZERO, d3WeakeningAuthorizationDigest: null,
    requestNonce: '3'.repeat(64), notBefore: '2026-08-29T18:00:00.000Z',
    expiresAt: '2026-08-29T18:10:00.000Z'
  };
  const disableD1 = await activationIdentity(activationBodyDigest(disableProjection), identityPolicyDigest);
  const disableRequest = createD5Artifact({ ...disableProjection, d1ActivationAttestationDigest: disableD1.receiptDigest });
  await assert.rejects(() => commitPackActivation({
    ...commitInput, prepared: disablePrepared, requestBytes: disableRequest.canonicalBytes,
    expectedRequestDigest: disableRequest.artifactDigest, d1Activation: disableD1,
    commitTransactionId: 'disable-transaction-2'
  }), (error) => error?.code === 'PACK_ACTIVATION_WEAKENING_AUTH_REQUIRED');
  await assert.rejects(() => commitPackActivation({
    ...commitInput, prepared: disablePrepared, requestBytes: disableRequest.canonicalBytes,
    expectedRequestDigest: disableRequest.artifactDigest, d1Activation: disableD1,
    ...activationPolicyBinding(['product-experience']), commitTransactionId: 'disable-transaction-policy-substitution'
  }), (error) => error?.code === 'PACK_ACTIVATION_AUTH_INVALID');

  const d3AuthorizationUse = await catalogWeakeningAuthorization({
    beforeDigest: disableProjection.fromSnapshotDigest,
    afterDigest: disableProjection.toSnapshotDigest,
    action: 'required-pack-waiver', affectedPackIds: ['assurance']
  });
  const authorizedDisableRequest = createD5Artifact({
    ...disableProjection,
    d1ActivationAttestationDigest: disableD1.receiptDigest,
    d3WeakeningAuthorizationDigest: d3AuthorizationUse.authorizationDigest
  });
  ledger.expectedPointerRecordDigest = committed.pointerRecordDigest;
  const disabled = await commitPackActivation({
    ...commitInput, prepared: disablePrepared,
    requestBytes: authorizedDisableRequest.canonicalBytes,
    expectedRequestDigest: authorizedDisableRequest.artifactDigest,
    d1Activation: disableD1, d3AuthorizationUse,
    commitTransactionId: 'disable-transaction-3'
  });
  assert.equal(disabled.outcome, 'committed');
  assert.equal(disabled.receipt.d3WeakeningAuthorizationDigest, d3AuthorizationUse.authorizationDigest);
  assert.equal(ledger.lastRecord.d3ConsumptionNonce, d3AuthorizationUse.authorization.consumptionId);

  const nonAtomic = new ActivationLedger();
  nonAtomic.atomic = false;
  await assert.rejects(
    () => commitPackActivation({ ...commitInput, commitTransactionId: 'activation-transaction-2', ledger: nonAtomic }),
    (error) => error?.code === 'PACK_ACTIVATION_ATOMICITY_CAPABILITY_UNMET'
  );
});
