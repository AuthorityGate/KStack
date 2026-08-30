import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  authorizeWeakening,
  classifyWeakeningTransition,
  createWeakeningRequest,
  parseSeparationPolicy,
  validateSeparationPolicy,
  validateWeakeningTransitionUse
} from '../plugins/kstack/scripts/kstack-domain-separation.mjs';
import {
  GITHUB_PROTECTED_REVIEW_ADAPTER,
  createIdentityActionRequest,
  validateIdentityTrustRoot
} from '../plugins/kstack/scripts/kstack-domain-identity.mjs';
import { hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';

const ZERO = '0'.repeat(64);
const NOW = '2026-08-29T17:00:00.000Z';
const PROJECT = 'authority-gate-kstack';
const REPOSITORY = '123456789';

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, `expected ${expected}`);
}

async function asyncCode(expected, action) {
  await assert.rejects(action, (error) => error?.code === expected, `expected ${expected}`);
}

function state(overrides = {}) {
  return {
    artifactType: 'kstack-policy-state', schemaVersion: 1,
    requiredPacks: ['assurance', 'product-experience'], requiredLanes: ['qc', 'security'],
    minimumReviewerCount: 2, minimumConfidence: 93, requiredEvidenceCount: 4,
    freshnessSecondsMaximum: 3600, blockOnSecurityFinding: true,
    minimumAuthorityCount: 2, rollbackRequired: true, retentionDaysMinimum: 30,
    failureMode: 'closed', waiverScopePacks: [], waiverExpiresAt: '2026-08-30T00:00:00.000Z',
    catalogGeneration: 10, quarantinedPacks: ['research-knowledge'],
    ...overrides
  };
}

function separationPolicy(overrides = {}) {
  return {
    artifactType: 'kstack-separation-policy', schemaVersion: 1,
    projectId: PROJECT, repositoryImmutableId: REPOSITORY,
    principals: [
      { adapterId: 'github-protected-review', providerPrincipalId: '1111111111', personSubjectId: 'person-a', independenceGroupId: 'group-a', eligibleRoles: ['requester'], status: 'active' },
      { adapterId: 'github-protected-review', providerPrincipalId: '2222222222', personSubjectId: 'person-b', independenceGroupId: 'group-b', eligibleRoles: ['independent-approver'], status: 'active' }
    ],
    actions: ['catalog-downgrade', 'policy-weakening', 'quarantine-reversal', 'required-pack-waiver'].map((action) => ({
      action, requiredRoles: ['independent-approver', 'requester'], minimumDistinctPeople: 2, minimumDistinctGroups: 2
    })),
    policyVersion: 1, effectiveAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  };
}

function fixture(policyOverrides = {}) {
  const classifier = classifyWeakeningTransition(hostCanonicalBytes(state()), hostCanonicalBytes(state({ minimumConfidence: 92 })));
  const policy = separationPolicy(policyOverrides);
  const policyResult = validateSeparationPolicy(policy);
  const request = createWeakeningRequest({
    projectId: PROJECT, repositoryImmutableId: REPOSITORY,
    action: classifier.receipt.action, beforeDigest: classifier.receipt.beforeDigest,
    afterDigest: classifier.receipt.afterDigest, affectedPackIds: classifier.receipt.affectedPackIds,
    classifierVersion: 1, classifierReceiptDigest: classifier.classifierReceiptDigest,
    reasonCode: 'POLICY_THRESHOLD_CHANGE', notBefore: '2026-08-29T16:55:00.000Z',
    expiresAt: '2026-08-29T17:05:00.000Z', nonce: 'a'.repeat(32)
  });
  const identityRequest = createIdentityActionRequest({
    projectId: PROJECT, repositoryImmutableId: REPOSITORY, action: request.request.action,
    targetDigest: request.weakeningRequestDigest, policyDigest: policyResult.separationPolicyDigest,
    nonce: request.request.nonce, notBefore: request.request.notBefore, expiresAt: request.request.expiresAt
  });
  return { classifier, policy, policyResult, request, identityRequest };
}

function identityVerification(identityRequest, providerPrincipalId, pullRequestNumber, allowedActions = ['policy-weakening']) {
  const commit = providerPrincipalId[0].repeat(40);
  const root = {
    artifactType: 'kstack-identity-trust-root', schemaVersion: 1,
    projectId: PROJECT, repositoryImmutableId: REPOSITORY,
    adapters: [{
      adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
      adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
      trustMaterialDigest: 'b'.repeat(64),
      allowedProviderPrincipalIds: ['1111111111', '2222222222'],
      allowedActions
    }], policyVersion: 1, createdAt: '2026-08-01T00:00:00.000Z'
  };
  const evidence = {
    artifactType: 'kstack-github-protected-review-evidence', schemaVersion: 1,
    providerProtocol: 'github-rest-v3', endpointOrigin: 'https://api.github.com',
    repositoryId: REPOSITORY, pullRequestNumber, headOid: commit,
    artifactPath: '.kstack/identity/weakening-request.json',
    artifactBlobBase64: identityRequest.canonicalBytes.toString('base64'), baseRef: 'refs/heads/main',
    ruleset: { rulesetId: `ruleset-${pullRequestNumber}`, targetBaseRef: 'refs/heads/main', active: true, requiresPullRequestReview: true, requiredApprovals: 1 },
    reviews: [{ reviewId: `review-${pullRequestNumber}`, state: 'APPROVED', commitOid: commit, providerPrincipalId, dismissed: false, submittedAt: '2026-08-29T16:59:00.000Z' }],
    reviewsPaginationComplete: true, rulesetsPaginationComplete: true, capturedAt: NOW
  };
  const bodies = {
    repository: { repositoryId: REPOSITORY },
    'pull-request': { repositoryId: REPOSITORY, pullRequestNumber, headOid: commit, baseRef: evidence.baseRef, capturedAt: NOW },
    'artifact-blob': { repositoryId: REPOSITORY, commitOid: commit, artifactPath: evidence.artifactPath, artifactBlobBase64: evidence.artifactBlobBase64 },
    ruleset: { repositoryId: REPOSITORY, baseRef: evidence.baseRef, ruleset: evidence.ruleset, rulesetsPaginationComplete: true },
    reviews: { repositoryId: REPOSITORY, pullRequestNumber, reviews: evidence.reviews, reviewsPaginationComplete: true }
  };
  return {
    requestBytes: identityRequest.canonicalBytes, expectedRequestDigest: identityRequest.requestDigest,
    trustRootBytes: hostCanonicalBytes(root), trustRootProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedTrustRootDigest: validateIdentityTrustRoot(root).trustRootDigest,
    adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
    adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
    pullRequestNumber, candidateCommitOid: commit, artifactPath: evidence.artifactPath,
    evidence,
    rawProviderResponses: ['repository', 'pull-request', 'artifact-blob', 'ruleset', 'reviews'].map((endpointId) => ({
      endpointId, status: 200, tlsVerified: true, authenticated: true, complete: true,
      trustMaterialDigest: 'b'.repeat(64), bodyBytes: hostCanonicalBytes(bodies[endpointId])
    })),
    trustedTime: { now: NOW, sourceProfileDigest: 'd'.repeat(64), attestationDigest: 'e'.repeat(64), qualified: true, rollbackDetected: false }
  };
}

class PairLedger {
  generation = 0;
  checkpointDigest = ZERO;
  keys = new Set();

  async inspect() {
    return { available: true, rollbackDetected: false, generation: this.generation, checkpointDigest: this.checkpointDigest };
  }

  async consumePairOnce(record) {
    if (this.keys.has(record.pairKeyDigest)) return {
      consumed: false, generation: this.generation, previousCheckpointDigest: this.checkpointDigest,
      checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: hash(`replay:${record.pairKeyDigest}`), consumptionId: 'replay-1'
    };
    if (record.priorGeneration !== this.generation || record.priorCheckpointDigest !== this.checkpointDigest) return {
      consumed: false, generation: this.generation, previousCheckpointDigest: this.checkpointDigest,
      checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: hash(`race:${record.pairKeyDigest}`), consumptionId: 'race-1'
    };
    this.keys.add(record.pairKeyDigest);
    const previousCheckpointDigest = this.checkpointDigest;
    this.generation += 1;
    this.checkpointDigest = hash(hostCanonicalBytes({ previousCheckpointDigest, generation: this.generation, record }));
    return {
      consumed: true, generation: this.generation, previousCheckpointDigest,
      checkpointDigest: this.checkpointDigest, rollbackWitnessDigest: hash(`witness:${this.checkpointDigest}`),
      consumptionId: `consumption-${this.generation}`
    };
  }
}

function authorizationInput(value, ledger = new PairLedger()) {
  return {
    separationPolicyBytes: hostCanonicalBytes(value.policy),
    separationPolicyProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedSeparationPolicyDigest: value.policyResult.separationPolicyDigest,
    weakeningRequestBytes: value.request.canonicalBytes,
    expectedWeakeningRequestDigest: value.request.weakeningRequestDigest,
    classifier: value.classifier,
    requesterVerification: identityVerification(value.identityRequest, '1111111111', 71, value.allowedActions),
    independentApproverVerification: identityVerification(value.identityRequest, '2222222222', 72, value.allowedActions),
    trustedTime: { now: NOW, sourceProfileDigest: 'f'.repeat(64), attestationDigest: '9'.repeat(64), qualified: true, rollbackDetected: false },
    policyAuthority: {
      async confirmCurrent(policyDigest) {
        return { current: true, policyDigest, checkpointDigest: '7'.repeat(64), rollbackDetected: false };
      }
    },
    inventory: {
      async retain(record) {
        return {
          retained: true,
          inventoryDigest: hash(Buffer.concat([
            Buffer.from('KSTACK-WEAKENING-EVIDENCE-INVENTORY-V1\n'), hostCanonicalBytes(record)
          ]))
        };
      }
    },
    ledger
  };
}

test('D3 classifier makes every weakening class and unknown transition fail into the quorum path', () => {
  const cases = [
    [{ requiredPacks: ['assurance'] }, 'required-pack-waiver', 'REQUIRED_PACK_REMOVED'],
    [{ requiredLanes: ['qc'] }, 'policy-weakening', 'REQUIRED_LANE_REMOVED'],
    [{ minimumReviewerCount: 1 }, 'policy-weakening', 'REVIEWER_COUNT_REDUCED'],
    [{ minimumConfidence: 92 }, 'policy-weakening', 'CONFIDENCE_REDUCED'],
    [{ requiredEvidenceCount: 3 }, 'policy-weakening', 'EVIDENCE_REDUCED'],
    [{ freshnessSecondsMaximum: 7200 }, 'policy-weakening', 'FRESHNESS_EXTENDED'],
    [{ blockOnSecurityFinding: false }, 'policy-weakening', 'SECURITY_BLOCK_DISABLED'],
    [{ minimumAuthorityCount: 1 }, 'policy-weakening', 'AUTHORITY_REDUCED'],
    [{ rollbackRequired: false }, 'policy-weakening', 'ROLLBACK_DISABLED'],
    [{ retentionDaysMinimum: 29 }, 'policy-weakening', 'RETENTION_REDUCED'],
    [{ failureMode: 'degrade' }, 'policy-weakening', 'FAILURE_MODE_OPENED'],
    [{ waiverScopePacks: ['assurance'] }, 'required-pack-waiver', 'WAIVER_BROADENED'],
    [{ waiverExpiresAt: null }, 'required-pack-waiver', 'WAIVER_BROADENED'],
    [{ catalogGeneration: 9 }, 'catalog-downgrade', 'CATALOG_DOWNGRADED'],
    [{ quarantinedPacks: [] }, 'quarantine-reversal', 'QUARANTINE_REVERSED']
  ];
  for (const [change, action, reason] of cases) {
    const result = classifyWeakeningTransition(hostCanonicalBytes(state()), hostCanonicalBytes(state(change)));
    assert.equal(result.receipt.classification, 'weakening');
    assert.equal(result.receipt.action, action);
    assert.equal(result.receipt.reasonCodes.includes(reason), true);
  }
  const unknown = classifyWeakeningTransition(hostCanonicalBytes(state()), Buffer.from('{"unknown":true}'));
  assert.equal(unknown.receipt.classification, 'weakening');
  assert.deepEqual(unknown.receipt.reasonCodes, ['UNKNOWN_OR_INVALID_TRANSITION']);
});

test('D3 failure modes have an explicit openness order and non-closed weakening cannot bypass quorum', () => {
  const opened = classifyWeakeningTransition(
    hostCanonicalBytes(state({ failureMode: 'degrade' })),
    hostCanonicalBytes(state({ failureMode: 'continue' }))
  );
  assert.equal(opened.receipt.classification, 'weakening');
  assert.equal(opened.receipt.action, 'policy-weakening');
  assert.deepEqual(opened.receipt.reasonCodes, ['FAILURE_MODE_OPENED']);

  const tightened = classifyWeakeningTransition(
    hostCanonicalBytes(state({ failureMode: 'continue' })),
    hostCanonicalBytes(state({ failureMode: 'degrade' }))
  );
  assert.equal(tightened.receipt.classification, 'non-weakening');
  assert.deepEqual(tightened.receipt.reasonCodes, []);
});

test('D3 external separation policy is closed, ordered, complete, and never repository resident', () => {
  const policy = separationPolicy();
  const result = parseSeparationPolicy(hostCanonicalBytes(policy), { source: 'external-broker', repositoryResident: false, protected: true }, { projectId: PROJECT, repositoryImmutableId: REPOSITORY });
  assert.match(result.separationPolicyDigest, /^[a-f0-9]{64}$/u);
  code('SEPARATION_POLICY_UNAVAILABLE', () => parseSeparationPolicy(hostCanonicalBytes(policy), { source: 'repository', repositoryResident: true, protected: false }));
  code('SEPARATION_POLICY_INVALID', () => validateSeparationPolicy({ ...policy, breakGlass: true }));
  code('SEPARATION_POLICY_INVALID', () => validateSeparationPolicy({ ...policy, principals: [policy.principals[1], policy.principals[0]] }));
  code('SEPARATION_POLICY_INVALID', () => validateSeparationPolicy({ ...policy, actions: policy.actions.slice(0, 3) }));
  code('SEPARATION_POLICY_INVALID', () => validateSeparationPolicy({ ...policy, principals: policy.principals.map((entry, index) => index ? { ...entry, status: 'disabled' } : entry) }));
});

test('D3 authorizes one exact two-person, two-group, role-separated pair and binds downstream CAS', async () => {
  const value = fixture();
  const result = await authorizeWeakening(authorizationInput(value));
  assert.equal(result.authorization.requesterPersonSubjectId, 'person-a');
  assert.equal(result.authorization.approverPersonSubjectId, 'person-b');
  assert.notEqual(result.authorization.requesterReceiptDigest, result.authorization.independentApproverReceiptDigest);
  const use = validateWeakeningTransitionUse({
    authorization: result.authorization, authorizationDigest: result.weakeningAuthorizationDigest,
    requestBytes: value.request.canonicalBytes, liveBeforeDigest: value.request.request.beforeDigest,
    candidateAfterDigest: value.request.request.afterDigest, action: value.request.request.action,
    affectedPackIds: value.request.request.affectedPackIds,
    trustedTime: { now: '2026-08-29T17:01:00.000Z', sourceProfileDigest: '1'.repeat(64), attestationDigest: '2'.repeat(64), qualified: true, rollbackDetected: false }
  });
  assert.equal(use.compareAndSwapRequired, true);
});

test('D3 retains the exact two-review evidence inventory before consuming the pair', async () => {
  const value = fixture();
  let consumeCalls = 0;
  const ledger = new PairLedger();
  const originalConsume = ledger.consumePairOnce.bind(ledger);
  ledger.consumePairOnce = async (record) => { consumeCalls += 1; return originalConsume(record); };
  await asyncCode('WEAKENING_EVIDENCE_RETENTION_FAILED', () => authorizeWeakening({
    ...authorizationInput(value, ledger),
    inventory: { async retain() { return { retained: false, inventoryDigest: ZERO }; } }
  }));
  assert.equal(consumeCalls, 0);
  await asyncCode('WEAKENING_EVIDENCE_RETENTION_FAILED', () => authorizeWeakening({
    ...authorizationInput(value, ledger),
    inventory: { async retain() { return { retained: true, inventoryDigest: 'f'.repeat(64) }; } }
  }));
  assert.equal(consumeCalls, 0);
});

test('D3 compound transitions require every represented weakening action', async () => {
  const value = fixture();
  value.classifier = classifyWeakeningTransition(
    hostCanonicalBytes(state()),
    hostCanonicalBytes(state({ minimumConfidence: 92, quarantinedPacks: [] }))
  );
  value.request = createWeakeningRequest({
    ...value.request.request,
    action: value.classifier.receipt.action,
    beforeDigest: value.classifier.receipt.beforeDigest,
    afterDigest: value.classifier.receipt.afterDigest,
    affectedPackIds: value.classifier.receipt.affectedPackIds,
    classifierReceiptDigest: value.classifier.classifierReceiptDigest
  });
  value.identityRequest = createIdentityActionRequest({
    ...value.identityRequest.request,
    action: value.request.request.action,
    targetDigest: value.request.weakeningRequestDigest
  });
  value.allowedActions = ['quarantine-reversal'];
  await asyncCode('WEAKENING_RECEIPT_DISAGREEMENT', () => authorizeWeakening(authorizationInput(value)));
});

test('D3 gridlock rejects one person, one group, role substitution, and receipt disagreement', async () => {
  for (const mutation of [
    { principals: separationPolicy().principals.map((entry, index) => ({ ...entry, personSubjectId: index ? 'person-a' : entry.personSubjectId })) },
    { principals: separationPolicy().principals.map((entry, index) => ({ ...entry, independenceGroupId: index ? 'group-a' : entry.independenceGroupId })) },
    { principals: separationPolicy().principals.map((entry) => ({ ...entry, eligibleRoles: ['requester'] })) }
  ]) {
    const value = fixture(mutation);
    await asyncCode('INDEPENDENT_SECOND_PARTY_UNAVAILABLE', () => authorizeWeakening(authorizationInput(value)));
  }
  const value = fixture();
  const other = fixture();
  other.identityRequest = createIdentityActionRequest({ ...value.identityRequest.request, targetDigest: 'f'.repeat(64) });
  await asyncCode('WEAKENING_RECEIPT_DISAGREEMENT', () => authorizeWeakening({
    ...authorizationInput(value), independentApproverVerification: identityVerification(other.identityRequest, '2222222222', 72)
  }));
});

test('D3 pair consumption is atomic/replay closed and stale or widened downstream use fails', async () => {
  const value = fixture();
  const ledger = new PairLedger();
  const result = await authorizeWeakening(authorizationInput(value, ledger));
  await asyncCode('WEAKENING_REPLAY_REFUSED', () => authorizeWeakening(authorizationInput(value, ledger)));
  await asyncCode('SEPARATION_POLICY_STALE', () => authorizeWeakening({
    ...authorizationInput(value, new PairLedger()),
    policyAuthority: { async confirmCurrent(policyDigest) { return { current: false, policyDigest, checkpointDigest: '7'.repeat(64), rollbackDetected: false }; } }
  }));
  const base = {
    authorization: result.authorization, authorizationDigest: result.weakeningAuthorizationDigest,
    requestBytes: value.request.canonicalBytes, liveBeforeDigest: value.request.request.beforeDigest,
    candidateAfterDigest: value.request.request.afterDigest, action: value.request.request.action,
    affectedPackIds: value.request.request.affectedPackIds,
    trustedTime: { now: '2026-08-29T17:01:00.000Z', sourceProfileDigest: '1'.repeat(64), attestationDigest: '2'.repeat(64), qualified: true, rollbackDetected: false }
  };
  code('WEAKENING_TARGET_STALE', () => validateWeakeningTransitionUse({ ...base, liveBeforeDigest: '8'.repeat(64) }));
  code('WEAKENING_TARGET_STALE', () => validateWeakeningTransitionUse({ ...base, affectedPackIds: ['another-pack'] }));
  code('WEAKENING_AUTHORIZATION_EXPIRED', () => validateWeakeningTransitionUse({ ...base, trustedTime: { ...base.trustedTime, now: '2026-08-29T17:05:00.000Z' } }));

  const concurrentValue = fixture();
  const concurrentLedger = new PairLedger();
  const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => authorizeWeakening(authorizationInput(concurrentValue, concurrentLedger))));
  assert.equal(attempts.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((entry) => entry.status === 'rejected' && entry.reason?.code === 'WEAKENING_REPLAY_REFUSED').length, 7);
});

test('D3 point-of-use rejects forged provenance, substituted bindings, and malformed timestamps', async () => {
  const value = fixture();
  const result = await authorizeWeakening(authorizationInput(value));
  const base = {
    authorization: result.authorization,
    authorizationDigest: result.weakeningAuthorizationDigest,
    requestBytes: value.request.canonicalBytes,
    liveBeforeDigest: value.request.request.beforeDigest,
    candidateAfterDigest: value.request.request.afterDigest,
    action: value.request.request.action,
    affectedPackIds: value.request.request.affectedPackIds,
    trustedTime: { now: '2026-08-29T17:01:00.000Z', sourceProfileDigest: '1'.repeat(64), attestationDigest: '2'.repeat(64), qualified: true, rollbackDetected: false }
  };
  const forge = (changes = {}) => {
    const authorization = { ...result.authorization, ...changes };
    return {
      ...base,
      authorization,
      authorizationDigest: crypto.createHash('sha256')
        .update(Buffer.from('KSTACK-WEAKENING-AUTHORIZATION-V1\n', 'utf8'))
        .update(hostCanonicalBytes(authorization))
        .digest('hex')
    };
  };
  for (const changes of [
    {},
    { requesterReceiptDigest: '3'.repeat(64) },
    { independentApproverReceiptDigest: '4'.repeat(64) },
    { consumptionId: 'forged-consumption' }
  ]) code('WEAKENING_AUTHORIZATION_PROVENANCE_INVALID', () => validateWeakeningTransitionUse(forge(changes)));
  for (const changes of [
    { authorizedAt: 'not-an-instant' },
    { expiresAt: 'not-an-instant' }
  ]) code('WEAKENING_AUTHORIZATION_INVALID', () => validateWeakeningTransitionUse(forge(changes)));
});
