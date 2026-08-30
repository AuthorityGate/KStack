import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  GITHUB_PROTECTED_REVIEW_ADAPTER,
  createIdentityActionRequest,
  parseIdentityActionRequest,
  parseIdentityTrustRoot,
  validateIdentityTrustRoot,
  verifyAndConsumeIdentityAction,
  verifyGithubProtectedReview
} from '../plugins/kstack/scripts/kstack-domain-identity.mjs';
import { canonicalJsonBytes, canonicalJsonSha256 } from '../plugins/kstack/scripts/kstack-kcrp-json.mjs';

const ZERO = '0'.repeat(64);
const PROJECT = 'authority-gate-kstack';
const REPOSITORY = '123456789';
const COMMIT = 'a'.repeat(40);
const POLICY = 'b'.repeat(64);
const TARGET = 'c'.repeat(64);
const NONCE = 'd'.repeat(32);
const NOW = '2026-08-29T16:00:00.000Z';

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, `expected ${expected}`);
}

async function asyncCode(expected, action) {
  await assert.rejects(action, (error) => error?.code === expected, `expected ${expected}`);
}

function trustRoot(overrides = {}) {
  return {
    artifactType: 'kstack-identity-trust-root',
    schemaVersion: 1,
    projectId: PROJECT,
    repositoryImmutableId: REPOSITORY,
    adapters: [{
      adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
      adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
      trustMaterialDigest: 'e'.repeat(64),
      allowedProviderPrincipalIds: ['4815162342'],
      allowedActions: ['catalog-activation', 'pack-selection', 'policy-weakening', 'required-pack-waiver']
    }],
    policyVersion: 7,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  };
}

function request(overrides = {}) {
  return createIdentityActionRequest({
    projectId: PROJECT,
    repositoryImmutableId: REPOSITORY,
    action: 'pack-selection',
    targetDigest: TARGET,
    policyDigest: POLICY,
    nonce: NONCE,
    notBefore: '2026-08-29T15:55:00.000Z',
    expiresAt: '2026-08-29T16:05:00.000Z',
    ...overrides
  });
}

function evidence(requestRecord = request(), overrides = {}) {
  const base = {
    artifactType: 'kstack-github-protected-review-evidence',
    schemaVersion: 1,
    providerProtocol: 'github-rest-v3',
    endpointOrigin: 'https://api.github.com',
    repositoryId: REPOSITORY,
    pullRequestNumber: 77,
    headOid: COMMIT,
    artifactPath: '.kstack/identity/action-request.json',
    artifactBlobBase64: requestRecord.canonicalBytes.toString('base64'),
    baseRef: 'refs/heads/main',
    ruleset: {
      rulesetId: 'ruleset-42',
      targetBaseRef: 'refs/heads/main',
      active: true,
      requiresPullRequestReview: true,
      requiredApprovals: 1
    },
    reviews: [{
      reviewId: 'review-9001',
      state: 'APPROVED',
      commitOid: COMMIT,
      providerPrincipalId: '4815162342',
      dismissed: false,
      submittedAt: '2026-08-29T15:59:00.000Z'
    }],
    reviewsPaginationComplete: true,
    rulesetsPaginationComplete: true,
    capturedAt: NOW
  };
  return { ...base, ...overrides };
}

function rawResponses(overrides = {}, source = evidence()) {
  const bodies = {
    repository: { repositoryId: source.repositoryId },
    'pull-request': {
      repositoryId: source.repositoryId,
      pullRequestNumber: source.pullRequestNumber,
      headOid: source.headOid,
      baseRef: source.baseRef,
      capturedAt: source.capturedAt
    },
    'artifact-blob': {
      repositoryId: source.repositoryId,
      commitOid: source.headOid,
      artifactPath: source.artifactPath,
      artifactBlobBase64: source.artifactBlobBase64
    },
    ruleset: {
      repositoryId: source.repositoryId,
      baseRef: source.baseRef,
      ruleset: source.ruleset,
      rulesetsPaginationComplete: source.rulesetsPaginationComplete
    },
    reviews: {
      repositoryId: source.repositoryId,
      pullRequestNumber: source.pullRequestNumber,
      reviews: source.reviews,
      reviewsPaginationComplete: source.reviewsPaginationComplete
    }
  };
  return ['repository', 'pull-request', 'artifact-blob', 'ruleset', 'reviews'].map((endpointId) => ({
    endpointId,
    status: 200,
    tlsVerified: true,
    authenticated: true,
    complete: true,
    trustMaterialDigest: 'e'.repeat(64),
    bodyBytes: canonicalJsonBytes(bodies[endpointId]),
    ...overrides
  }));
}

function verification(overrides = {}) {
  const requestRecord = overrides.requestRecord || request();
  const root = overrides.trustRoot || trustRoot();
  const rootRecord = validateIdentityTrustRoot(root);
  const admittedEvidence = overrides.evidence || evidence(requestRecord);
  const result = {
    requestBytes: requestRecord.canonicalBytes,
    expectedRequestDigest: requestRecord.requestDigest,
    trustRootBytes: canonicalJsonBytes(root),
    trustRootProtection: { source: 'external-broker', repositoryResident: false, protected: true },
    expectedTrustRootDigest: rootRecord.trustRootDigest,
    adapterId: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterId,
    adapterVersion: GITHUB_PROTECTED_REVIEW_ADAPTER.adapterVersion,
    pullRequestNumber: 77,
    candidateCommitOid: COMMIT,
    artifactPath: '.kstack/identity/action-request.json',
    evidence: admittedEvidence,
    rawProviderResponses: rawResponses({}, admittedEvidence),
    trustedTime: {
      now: NOW,
      sourceProfileDigest: '1'.repeat(64),
      attestationDigest: '2'.repeat(64),
      qualified: true,
      rollbackDetected: false
    },
    ...overrides
  };
  delete result.requestRecord;
  return result;
}

class Inventory {
  records = [];

  async retain(record) {
    this.records.push(structuredClone(record));
    return {
      retained: true,
      inventoryDigest: digest(Buffer.concat([
        Buffer.from('KSTACK-IDENTITY-OPERATION-INVENTORY-V1\n'),
        canonicalJsonBytes(record)
      ]))
    };
  }
}

class Ledger {
  generation = 0;
  checkpointDigest = ZERO;
  consumed = new Set();
  rollbackDetected = false;
  available = true;

  async inspect() {
    return {
      available: this.available,
      rollbackDetected: this.rollbackDetected,
      generation: this.generation,
      checkpointDigest: this.checkpointDigest
    };
  }

  async consumeOnce(record) {
    if (this.consumed.has(record.keyDigest)) {
      return {
        consumed: false,
        generation: this.generation,
        previousCheckpointDigest: this.checkpointDigest,
        checkpointDigest: this.checkpointDigest,
        rollbackWitnessDigest: digest(`replay:${record.keyDigest}`)
      };
    }
    if (record.priorGeneration !== this.generation || record.priorCheckpointDigest !== this.checkpointDigest) {
      return {
        consumed: false,
        generation: this.generation,
        previousCheckpointDigest: this.checkpointDigest,
        checkpointDigest: this.checkpointDigest,
        rollbackWitnessDigest: digest(`race:${record.keyDigest}`)
      };
    }
    this.consumed.add(record.keyDigest);
    const previousCheckpointDigest = this.checkpointDigest;
    this.generation += 1;
    this.checkpointDigest = canonicalJsonSha256({ previousCheckpointDigest, generation: this.generation, record });
    return {
      consumed: true,
      generation: this.generation,
      previousCheckpointDigest,
      checkpointDigest: this.checkpointDigest,
      rollbackWitnessDigest: canonicalJsonSha256({ generation: this.generation, checkpointDigest: this.checkpointDigest })
    };
  }
}

test('D1 canonical requests and external trust roots are exact, closed, and domain bound', () => {
  const first = request();
  const second = parseIdentityActionRequest(first.canonicalBytes);
  assert.equal(first.requestDigest, second.requestDigest);
  assert.deepEqual(first.request, second.request);
  assert.equal(first.requestDigest, digest(Buffer.concat([
    Buffer.from('KSTACK-IDENTITY-ACTION-REQUEST-V1\n'),
    first.canonicalBytes
  ])));

  const rootBytes = canonicalJsonBytes(trustRoot());
  const loaded = parseIdentityTrustRoot(rootBytes, { source: 'external-broker', repositoryResident: false, protected: true }, {
    projectId: PROJECT,
    repositoryImmutableId: REPOSITORY
  });
  assert.match(loaded.trustRootDigest, /^[a-f0-9]{64}$/u);
  code('IDENTITY_TRUST_ROOT_UNAVAILABLE', () => parseIdentityTrustRoot(rootBytes, { source: 'repository', repositoryResident: true, protected: false }));
  code('IDENTITY_TRUST_ROOT_UNAVAILABLE', () => validateIdentityTrustRoot({ ...trustRoot(), selectedBy: 'collaborator' }));
  code('IDENTITY_TRUST_ROOT_UNAVAILABLE', () => validateIdentityTrustRoot({
    ...trustRoot(),
    adapters: [{ ...trustRoot().adapters[0], allowedProviderPrincipalIds: ['9', '1'] }]
  }));
  code('IDENTITY_ACTION_REQUEST_INVALID', () => parseIdentityActionRequest(Buffer.concat([Buffer.from(' '), first.canonicalBytes])));
  code('IDENTITY_ACTION_REQUEST_INVALID', () => parseIdentityActionRequest(Buffer.from('{"action":"pack-selection","action":"catalog-activation"}')));
  code('IDENTITY_ACTION_REQUEST_INVALID', () => createIdentityActionRequest({ ...first.request, actor: 'fake' }));
  code('IDENTITY_ACTION_REQUEST_INVALID', () => createIdentityActionRequest({ ...first.request, nonce: 'a'.repeat(30) }));
  code('IDENTITY_ACTION_REQUEST_INVALID', () => createIdentityActionRequest({ ...first.request, notBefore: first.request.expiresAt }));
});

test('GitHub protected review binds repository, commit, fixed blob, ruleset, principal, completeness, and raw evidence', () => {
  const result = verifyGithubProtectedReview(verification());
  assert.equal(result.providerPrincipalId, '4815162342');
  assert.equal(result.providerCommitOid, COMMIT);
  assert.match(result.providerEvidenceDigest, /^[a-f0-9]{64}$/u);
  assert.equal(result.responseInventory.length, 5);

  const bound = (admittedEvidence) => ({ evidence: admittedEvidence, rawProviderResponses: rawResponses({}, admittedEvidence) });
  const mutations = [
    ['IDENTITY_PROVIDER_EVIDENCE_INVALID', { evidence: evidence(request(), { repositoryId: '987654321' }) }],
    ['IDENTITY_PROVIDER_EVIDENCE_INVALID', { evidence: evidence(request(), { headOid: 'f'.repeat(40) }) }],
    ['IDENTITY_PROVIDER_EVIDENCE_INVALID', { evidence: evidence(request(), { artifactPath: '.kstack/identity/other.json' }) }],
    ['IDENTITY_PROVIDER_EVIDENCE_INVALID', { evidence: evidence(request(), { artifactBlobBase64: Buffer.from('{}').toString('base64') }) }],
    ['IDENTITY_PROVIDER_EVIDENCE_INVALID', { evidence: evidence(request(), { reviewsPaginationComplete: false }) }],
    ['IDENTITY_PROVIDER_EVIDENCE_INVALID', { evidence: evidence(request(), { rulesetsPaginationComplete: false }) }],
    ['IDENTITY_APPROVAL_UNQUALIFIED', bound(evidence(request(), { reviews: [{ ...evidence().reviews[0], providerPrincipalId: '99' }] }))],
    ['IDENTITY_APPROVAL_UNQUALIFIED', bound(evidence(request(), { reviews: [{ ...evidence().reviews[0], commitOid: 'f'.repeat(40) }] }))],
    ['IDENTITY_APPROVAL_UNQUALIFIED', bound(evidence(request(), { reviews: [{ ...evidence().reviews[0], dismissed: true }] }))],
    ['IDENTITY_APPROVAL_UNQUALIFIED', bound(evidence(request(), { reviews: [{ ...evidence().reviews[0], state: 'DISMISSED' }] }))],
    ['IDENTITY_RULESET_UNQUALIFIED', bound(evidence(request(), { ruleset: { ...evidence().ruleset, active: false } }))],
    ['IDENTITY_PROVIDER_UNAVAILABLE', { rawProviderResponses: rawResponses({ tlsVerified: false }) }],
    ['IDENTITY_PROVIDER_UNAVAILABLE', { rawProviderResponses: rawResponses({ authenticated: false }) }],
    ['IDENTITY_PROVIDER_UNAVAILABLE', { rawProviderResponses: rawResponses({ complete: false }) }],
    ['IDENTITY_REQUEST_EXPIRED', { trustedTime: { ...verification().trustedTime, now: '2026-08-29T16:05:00.000Z' } }],
    ['IDENTITY_ADAPTER_UNQUALIFIED', { adapterVersion: '2.0.0' }]
  ];
  for (const [expected, mutation] of mutations) code(expected, () => verifyGithubProtectedReview({ ...verification(), ...mutation }));
});

test('broker retains closed evidence and atomically consumes one exact action binding', async () => {
  const inventory = new Inventory();
  const ledger = new Ledger();
  const first = await verifyAndConsumeIdentityAction({ verification: verification(), inventory, ledger });
  assert.equal(first.receipt.artifactType, 'kstack-identity-verification-receipt');
  assert.equal(first.receipt.action, 'pack-selection');
  assert.equal(first.receipt.targetDigest, TARGET);
  assert.equal(first.receipt.policyDigest, POLICY);
  assert.equal(first.receipt.providerPrincipalId, '4815162342');
  assert.equal(first.receipt.expiresAt, request().request.expiresAt);
  assert.equal(first.consumption.generation, 1);
  assert.equal(inventory.records.length, 1);
  const forbidden = /(?:authorization|credential|password|secret|token|rawResponse)/iu;
  assert.equal(Object.keys(first.receipt).some((key) => forbidden.test(key)), false);
  await asyncCode('IDENTITY_REPLAY_REFUSED', () => verifyAndConsumeIdentityAction({ verification: verification(), inventory, ledger }));
});

test('concurrent reuse has exactly one winner and action or target substitution cannot reuse approval bytes', async () => {
  const ledger = new Ledger();
  const inventory = new Inventory();
  const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => verifyAndConsumeIdentityAction({ verification: verification(), inventory, ledger })));
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((result) => result.status === 'rejected' && result.reason?.code === 'IDENTITY_REPLAY_REFUSED').length, 7);

  const changedAction = request({ action: 'catalog-activation' });
  code('IDENTITY_PROVIDER_EVIDENCE_INVALID', () => verifyGithubProtectedReview({
    ...verification({ requestRecord: changedAction }),
    evidence: evidence(request())
  }));
  const changedTarget = request({ targetDigest: 'f'.repeat(64) });
  code('IDENTITY_PROVIDER_EVIDENCE_INVALID', () => verifyGithubProtectedReview({
    ...verification({ requestRecord: changedTarget }),
    evidence: evidence(request())
  }));
});

test('missing trusted time, protected retention, or healthy rollback witness fails closed with no receipt', async () => {
  code('IDENTITY_TRUSTED_TIME_UNAVAILABLE', () => verifyGithubProtectedReview({
    ...verification(),
    trustedTime: { ...verification().trustedTime, now: 'local-now' }
  }));
  code('IDENTITY_TRUSTED_TIME_UNAVAILABLE', () => verifyGithubProtectedReview({
    ...verification(),
    trustedTime: { ...verification().trustedTime, qualified: false }
  }));
  code('IDENTITY_TRUST_ROOT_UNAVAILABLE', () => verifyGithubProtectedReview({ ...verification(), expectedTrustRootDigest: 'f'.repeat(64) }));
  code('IDENTITY_TRUST_ROOT_UNAVAILABLE', () => verifyGithubProtectedReview({
    ...verification(),
    trustRootProtection: { source: 'repository', repositoryResident: true, protected: false }
  }));

  const unavailableInventory = { async retain() { return { retained: false, inventoryDigest: ZERO }; } };
  await asyncCode('IDENTITY_EVIDENCE_RETENTION_FAILED', () => verifyAndConsumeIdentityAction({
    verification: verification(),
    inventory: unavailableInventory,
    ledger: new Ledger()
  }));

  const rollbackLedger = new Ledger();
  rollbackLedger.rollbackDetected = true;
  await asyncCode('IDENTITY_CONSUMPTION_LEDGER_ROLLBACK', () => verifyAndConsumeIdentityAction({
    verification: verification(),
    inventory: new Inventory(),
    ledger: rollbackLedger
  }));

  const unavailableLedger = new Ledger();
  unavailableLedger.available = false;
  await asyncCode('IDENTITY_CONSUMPTION_LEDGER_UNAVAILABLE', () => verifyAndConsumeIdentityAction({
    verification: verification(),
    inventory: new Inventory(),
    ledger: unavailableLedger
  }));
});
