import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  createTrustedTimePolicy,
  createTrustedTimeSourceEvidence,
  evaluateTemporalPredicate,
  guardTrustedTimeUse,
  initializeTrustedTimeProtection,
  publishTrustedTime,
  qualifyTrustedTimeInterval,
  recoverTrustedTimeGenesis,
  recoverTrustedTimeUpdate,
  validateTrustedTimePolicy
} from '../plugins/kstack/scripts/kstack-domain-time.mjs';

const ZERO = '0'.repeat(64);

function sha(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected, `expected ${expected}`);
}

function policyFixture(overrides = {}) {
  const source = (suffix) => ({
    sourceId: `source-${suffix}`, adapterId: 'nts-v1', adapterVersion: 'v1',
    endpointIdentity: `nts://time-${suffix}.example:4460`, trustMaterialDigest: sha(Buffer.from(`source-trust-${suffix}`)),
    independenceGroupId: `source-group-${suffix}`
  });
  const witness = (suffix) => ({
    witnessId: `witness-${suffix}`, adapterId: 'external-cas-v1', adapterVersion: 'v1',
    endpointIdentity: `https://witness-${suffix}.example`, trustMaterialDigest: sha(Buffer.from(`witness-trust-${suffix}`)),
    independenceGroupId: `witness-group-${suffix}`, namespaceId: `project-time-${suffix}`
  });
  const created = createTrustedTimePolicy({
    projectId: 'project', sources: [source('a'), source('b')], rollbackWitnesses: [witness('a'), witness('b')],
    minimumRemoteSources: 2, minimumIndependenceGroups: 2,
    minimumRollbackWitnesses: 2, minimumWitnessIndependenceGroups: 2,
    maxSampleAgeMs: 2_000, maxIntervalWidthMs: 1_000,
    maxWallMonotonicDivergenceMs: 100, maxFutureEvidenceSkewMs: 50,
    rollbackToleranceMs: 5, policyVersion: 1,
    ...overrides
  });
  return validateTrustedTimePolicy({
    policyBytes: created.canonicalBytes, expectedPolicyDigest: created.policyDigest,
    protection: { repositoryResident: false, brokerProtected: true, ownerCeremonyDigest: sha(Buffer.from('owner-ceremony')) }
  });
}

function sourceSample(policy, suffix, shiftNs = 0n, overrides = {}) {
  const configured = policy.record.sources.find((entry) => entry.sourceId === `source-${suffix}`);
  return createTrustedTimeSourceEvidence({
    sourceId: configured.sourceId, adapterId: configured.adapterId, adapterVersion: configured.adapterVersion,
    endpointIdentity: configured.endpointIdentity, trustMaterialDigest: configured.trustMaterialDigest,
    independenceGroupId: configured.independenceGroupId, requestNonce: `${suffix === 'a' ? 'a' : 'b'}`.repeat(64),
    requestMonotonicNs: '900000000', responseMonotonicNs: '950000000',
    remoteLowerUtcNs: (1_000_000_000_000_000_000n + shiftNs).toString(),
    remoteUpperUtcNs: (1_000_000_000_010_000_000n + shiftNs).toString(),
    authenticatedUncertaintyNs: '10000000', authenticated: true, correlated: true,
    protocolVersionQualified: true, eraKnown: true, leapStateKnown: true, complete: true,
    ...overrides
  }).record;
}

function intervalFixture(policy = policyFixture()) {
  return qualifyTrustedTimeInterval({
    validatedPolicy: policy, samples: [sourceSample(policy, 'a'), sourceSample(policy, 'b', 5_000_000n)],
    localObservation: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1000000000', wallUtcNs: '1000000000005000000' }
  });
}

class Witness {
  constructor(configured) {
    this.configured = configured;
    this.sequence = null;
    this.head = null;
  }

  async capabilities() {
    return { external: true, linearizableCas: true, authenticated: true, signedReceipts: true, durable: true, blindOverwriteUnsupported: true, deletionUnsupported: true };
  }

  response() {
    if (this.sequence === null) return {
      witnessId: this.configured.witnessId, namespaceId: this.configured.namespaceId,
      absent: true, signed: true, durable: true, linearizable: true,
      receiptDigest: sha(Buffer.from(`${this.configured.witnessId}:absent`))
    };
    return {
      witnessId: this.configured.witnessId, namespaceId: this.configured.namespaceId,
      sequence: this.sequence, anchorHeadDigest: this.head, signed: true, durable: true,
      linearizable: true, receiptDigest: sha(Buffer.from(`${this.configured.witnessId}:${this.sequence}:${this.head}`))
    };
  }

  async read() { return this.response(); }

  async compareAndSet(request) {
    if (this.refuseNext === true) {
      this.refuseNext = false;
      return this.response();
    }
    if (request.expectedAbsent === true && this.sequence === null && request.newSequence === 0) {
      this.sequence = 0;
      this.head = request.newHeadDigest;
    } else if (request.expectedSequence === this.sequence && request.expectedHeadDigest === this.head
        && request.newSequence === this.sequence + 1) {
      this.sequence = request.newSequence;
      this.head = request.newHeadDigest;
    }
    return this.response();
  }
}

class Ledger {
  async capabilities() { return { durablePending: true, atomicCommit: true, appendOnly: true, readAfterWrite: true }; }
  async prepare(core) { this.core = core; return { pendingId: 'pending-1', durableWriteReceiptDigest: sha(Buffer.from('durable-pending')), durable: true }; }
  async bindAnchor(record) { this.bound = record; return { durable: true, bound: true }; }
  async readPending() {
    return {
      pendingId: this.bound.pendingId, oldSequence: this.core.sequence - 1,
      oldHeadDigest: this.core.previousAnchorDigest, newSequence: this.core.sequence,
      newHeadDigest: this.bound.anchorDigest, anchorBytes: this.bound.anchorBytes,
      operationNonce: this.core.operationNonce, durable: true
    };
  }
  async readPendingGenesis() {
    return {
      pendingId: this.bound.pendingId, anchorBytes: this.bound.anchorBytes,
      anchorDigest: this.bound.anchorDigest, operationNonce: this.core.operationNonce, durable: true
    };
  }
  async commit(record) {
    this.committed = record;
    return { committed: true, durable: true, sequence: record.sequence, anchorHeadDigest: record.anchorDigest, commitReceiptDigest: sha(Buffer.from('commit')) };
  }
}

function witnessClients(policy) {
  return policy.record.rollbackWitnesses.map((configured) => ({ witnessId: configured.witnessId, client: new Witness(configured) }));
}

function publicationInput(interval, clients, localState) {
  return {
    qualifiedInterval: interval,
    localBefore: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1000000000', wallUtcNs: '1000000000005000000' },
    localAfter: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1010000000', wallUtcNs: '1000000000015000000' },
    localState,
    witnessClients: clients, ledger: new Ledger(), operationNonce: 'c'.repeat(64)
  };
}

test('D8 requires an external exact policy and two authenticated independent overlapping sources', () => {
  const policy = policyFixture();
  const interval = intervalFixture(policy);
  assert.ok(BigInt(interval.record.lowerUtcNs) <= BigInt(interval.record.upperUtcNs));
  assert.equal(interval.record.sourceEvidenceDigests.length, 2);

  code('TRUSTED_TIME_POLICY_INVALID', () => validateTrustedTimePolicy({
    policyBytes: policy.canonicalBytes, expectedPolicyDigest: policy.policyDigest,
    protection: { repositoryResident: true, brokerProtected: true, ownerCeremonyDigest: sha(Buffer.from('bad')) }
  }));
  code('TRUSTED_TIME_UNAVAILABLE', () => qualifyTrustedTimeInterval({
    validatedPolicy: policy, samples: [sourceSample(policy, 'a')],
    localObservation: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1000000000', wallUtcNs: '1000000000005000000' }
  }));
  code('TRUSTED_TIME_UNAVAILABLE', () => qualifyTrustedTimeInterval({
    validatedPolicy: policy, samples: [sourceSample(policy, 'a'), sourceSample(policy, 'b', 5_000_000_000n)],
    localObservation: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1000000000', wallUtcNs: '1000000000005000000' }
  }));
  code('TRUSTED_TIME_UNAVAILABLE', () => qualifyTrustedTimeInterval({
    validatedPolicy: policy,
    samples: [sourceSample(policy, 'a', 0n, { authenticated: false }), sourceSample(policy, 'b')],
    localObservation: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1000000000', wallUtcNs: '1000000000005000000' }
  }));

  const exactWidthPolicy = policyFixture({ maxIntervalWidthMs: 125 });
  assert.equal(BigInt(intervalFixture(exactWidthPolicy).record.upperUtcNs)
    - BigInt(intervalFixture(exactWidthPolicy).record.lowerUtcNs), 125_000_000n);
  const narrowPolicy = policyFixture({ maxIntervalWidthMs: 124 });
  code('TRUSTED_TIME_UNAVAILABLE', () => intervalFixture(narrowPolicy));
});

test('D8 publishes only after durable anchor and two external CAS witnesses, then guards current use', async () => {
  const interval = intervalFixture();
  const clients = witnessClients(interval.policy);
  const genesis = await initializeTrustedTimeProtection({
    validatedPolicy: interval.policy, witnessClients: clients, ledger: new Ledger(),
    bootObservation: {
      bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '800000000', wallUtcNs: '999999999805000000'
    }, operationNonce: 'd'.repeat(64)
  });
  assert.notEqual(genesis.anchorDigest, ZERO);
  const published = await publishTrustedTime(publicationInput(interval, clients, genesis.localHead));
  assert.equal(published.receipt.anchorSequence, 1);
  assert.equal(published.receipt.rollbackWitnessReceiptDigests.length, 2);
  const expiry = (BigInt(published.receipt.upperUtcNs) + 100_000_000n).toString();
  const guarded = guardTrustedTimeUse({
    publication: published,
    currentHead: { sequence: 1, anchorHeadDigest: published.anchorDigest, policyDigest: interval.policy.policyDigest },
    localObservation: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1020000000', wallUtcNs: '1000000000025000000' },
    predicate: { kind: 'expires-at', expiresAtUtcNs: expiry }
  });
  assert.equal(guarded.record.pass, true);
  assert.equal(guarded.binding.trustedTimeReceiptDigest, published.receiptDigest);
  assert.equal(guarded.binding.useReceiptDigest, guarded.useReceiptDigest);
  assert.equal(guarded.binding.policyDigest, interval.policy.policyDigest);
  assert.equal(guarded.binding.anchorDigest, published.anchorDigest);
  assert.equal(guarded.binding.qualified, true);
  assert.equal(guarded.binding.rollbackDetected, false);
  code('TEMPORAL_BOUNDARY_AMBIGUOUS', () => guardTrustedTimeUse({
    publication: published,
    currentHead: { sequence: 1, anchorHeadDigest: published.anchorDigest, policyDigest: interval.policy.policyDigest },
    localObservation: { bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '1020000000', wallUtcNs: '1000000000025000000' },
    predicate: { kind: 'expires-at', expiresAtUtcNs: published.receipt.upperUtcNs }
  }));

  await assert.rejects(() => publishTrustedTime(publicationInput(interval, clients, genesis.localHead)),
    (error) => error?.code === 'PROTECTED_STATE_ROLLBACK_DETECTED');
});

test('D8 recovers only the one durable pending successor after a partial witness CAS', async () => {
  const interval = intervalFixture();
  const clients = witnessClients(interval.policy);
  const genesis = await initializeTrustedTimeProtection({
    validatedPolicy: interval.policy, witnessClients: clients, ledger: new Ledger(),
    bootObservation: {
      bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '800000000', wallUtcNs: '999999999805000000'
    }, operationNonce: 'e'.repeat(64)
  });
  clients[1].client.refuseNext = true;
  const ledger = new Ledger();
  await assert.rejects(() => publishTrustedTime({
    ...publicationInput(interval, clients, genesis.localHead), ledger, operationNonce: 'f'.repeat(64)
  }), (error) => error?.code === 'TIME_WITNESS_CONFLICT');
  assert.equal(clients[0].client.sequence, 1);
  assert.equal(clients[1].client.sequence, 0);
  const exactAnchorBytes = ledger.bound.anchorBytes;
  ledger.bound = { ...ledger.bound, anchorBytes: Buffer.from('{"substituted":true}') };
  await assert.rejects(() => recoverTrustedTimeUpdate({
    validatedPolicy: interval.policy, witnessClients: clients, ledger
  }), (error) => error?.code === 'TIME_WITNESS_CONFLICT');
  ledger.bound = { ...ledger.bound, anchorBytes: exactAnchorBytes };
  const recovered = await recoverTrustedTimeUpdate({
    validatedPolicy: interval.policy, witnessClients: clients, ledger
  });
  assert.equal(recovered.recovered, true);
  assert.equal(clients[1].client.sequence, 1);
  assert.equal(recovered.receipt.anchorSequence, 1);
});

test('D8 refuses witness split-brain before publishing a successor', async () => {
  const interval = intervalFixture();
  const clients = witnessClients(interval.policy);
  const genesis = await initializeTrustedTimeProtection({
    validatedPolicy: interval.policy, witnessClients: clients, ledger: new Ledger(),
    bootObservation: {
      bootIdDigest: sha(Buffer.from('boot')), monotonicNs: '800000000',
      wallUtcNs: '999999999805000000'
    },
    operationNonce: '2'.repeat(64)
  });
  clients[1].client.head = sha(Buffer.from('split-brain-head'));
  await assert.rejects(() => publishTrustedTime(publicationInput(interval, clients, genesis.localHead)),
    (error) => error?.code === 'TIME_WITNESS_CONFLICT');
});

test('D8 recovers only the exact pending genesis after one namespace was created', async () => {
  const policy = policyFixture();
  const clients = witnessClients(policy);
  clients[1].client.refuseNext = true;
  const ledger = new Ledger();
  const bootObservation = {
    bootIdDigest: sha(Buffer.from('genesis-boot')), monotonicNs: '100', wallUtcNs: '1000000000000000000'
  };
  await assert.rejects(() => initializeTrustedTimeProtection({
    validatedPolicy: policy, witnessClients: clients, ledger, bootObservation,
    operationNonce: '1'.repeat(64)
  }), (error) => error?.code === 'TIME_WITNESS_CONFLICT');
  assert.equal(clients[0].client.sequence, 0);
  assert.equal(clients[1].client.sequence, null);
  const recovered = await recoverTrustedTimeGenesis({ validatedPolicy: policy, witnessClients: clients, ledger });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.localHead.sequence, 0);
  assert.equal(clients[1].client.head, recovered.anchorDigest);
});

test('D8 conservative temporal predicates close equality and one-nanosecond boundaries', () => {
  assert.equal(evaluateTemporalPredicate({
    lowerUtcNs: '100', upperUtcNs: '110', predicate: { kind: 'not-before', notBeforeUtcNs: '100' }
  }).pass, true);
  assert.equal(evaluateTemporalPredicate({
    lowerUtcNs: '100', upperUtcNs: '110', predicate: { kind: 'not-before', notBeforeUtcNs: '101' }
  }).pass, false);
  assert.equal(evaluateTemporalPredicate({
    lowerUtcNs: '100', upperUtcNs: '110', predicate: { kind: 'expires-at', expiresAtUtcNs: '111' }
  }).pass, true);
  assert.equal(evaluateTemporalPredicate({
    lowerUtcNs: '100', upperUtcNs: '110', predicate: { kind: 'expires-at', expiresAtUtcNs: '110' }
  }).pass, false);
  const freshness = (observedUtcNs) => evaluateTemporalPredicate({
    lowerUtcNs: '100', upperUtcNs: '110', predicate: {
      kind: 'maximum-age', observedUtcNs, maxAgeNs: '10', maxFutureEvidenceSkewNs: '2',
      authenticatedDescriptorDigest: sha(Buffer.from('descriptor')),
      producerReceiptDigest: sha(Buffer.from('producer'))
    }
  }).pass;
  assert.equal(freshness('100'), true);
  assert.equal(freshness('99'), false);
  assert.equal(freshness('102'), true);
  assert.equal(freshness('103'), false);
});
