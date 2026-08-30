import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hostAddress } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  ProtectedReceiptKernel,
  classifyReceiptOutcome,
  createOperationReceipt,
  createReceiptTombstone,
  deriveReceiptRetention,
  evaluateReceipt,
  validateProviderReceiptEvidence,
  validateReceiptProducerProfile,
  validateReceiptReconciliationProfile,
  validateReceiptRevocation,
  validateReceiptTrustProfile
} from '../plugins/kstack/scripts/kstack-host-receipt.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;
const SCHEMA = D('a'); const ACTIVE = D('b'); const FACT = D('c');
const rustManifest = fileURLToPath(new URL('../plugins/kstack/native/host-receipt-reference/Cargo.toml', import.meta.url));

function producerProfile(overrides = {}) {
  return {
    schemaId: 'kstack.receipt-producer-profile.v1', schemaVersion: 1, schemaSetDigest: SCHEMA,
    profileId: 'provider-v1', providerId: 'jira', tenantDigest: D('1'), accountDigest: D('2'),
    endpointIdentityDigest: D('3'), tlsPolicyDigest: D('4'), apiVersion: 'v3', protocolVersion: 'https-v1',
    responseSchemaDigest: D('5'), authenticationSourceDigest: D('6'), credentialNonExport: true,
    requestCanonicalizationDigest: D('7'), responseCanonicalizationDigest: D('8'), immutableActionIdFieldId: 'issue-id',
    idempotencySemanticsDigest: D('9'), statusMappingDigest: D('a'), signedReceiptProfileDigest: null,
    readBackProfileDigest: D('b'), paginationCompletenessDigest: D('c'), errorMappingDigest: D('d'), retentionMs: 86_400_000,
    negativeVectorDigests: [D('1'), D('2')], redirectsAllowed: false, hostProxyRootsAllowed: false, qualifiedOutcome: 'PROVEN', ...overrides
  };
}

function correlation(operationClassId, operationId, producerProfileDigest) {
  return {
    operationId, operationClassId, tenantDigest: D('1'), accountDigest: D('2'), targetDigest: D('3'), requestDigest: D('4'),
    semanticEffectDigest: D('5'), idempotencyKeyDigest: D('6'), providerAttemptDigest: D('7'), immutableProviderActionIdDigest: D('8'),
    activeSetDigest: ACTIVE, policyDigest: D('9'), fenceDigest: D('a'), producerProfileDigest
  };
}

function reconciliationProfile(producerProfileDigest, overrides = {}) {
  return {
    schemaId: 'kstack.receipt-reconciliation-profile.v1', schemaVersion: 1, schemaSetDigest: SCHEMA,
    profileId: 'jira-query-v1', producerProfileDigest, endpointIdentityDigest: D('3'), methodId: 'get-issue', requestTemplateDigest: D('e'),
    effectClassification: 'READ_ONLY_QUERY', nonMutationProofDigests: [
      'ABSENT', 'CONTRADICTORY', 'EXPIRED', 'INCOMPLETE', 'PRESENT', 'RATE_LIMITED', 'REDIRECTED',
      'TENANT_MISMATCHED', 'UNAUTHORIZED', 'UNKNOWN', 'UNSUPPORTED'
    ].map((branchId, index) => ({ branchId, proofDigest: D(String((index % 9) + 1)) })),
    queryBy: 'IMMUTABLE_ACTION_ID_OR_IDEMPOTENCY_KEY', maximumAttempts: 3, backoffScheduleMs: [100, 500], totalDeadlineMs: 5000,
    paginationComplete: true, maximumVisibilityWindowMs: 60_000, authoritativeNegativeSupported: true,
    redirectsAllowed: false, qualifiedOutcome: 'PROVEN', ...overrides
  };
}

function row({ operationClassId = 'ASK_SIDE_EFFECT', underlyingClassId = null, operationId = 'jira-comment', producerDigest = null, reconciliationDigest = null, observerDigests = [], minimumChannels } = {}) {
  const external = ['ASK_SIDE_EFFECT', 'PRIVILEGED_SIDE_EFFECT'].includes(operationClassId === 'BACKGROUND' ? underlyingClassId : operationClassId);
  return {
    rowId: `row-${operationId}`, operationId, operationProfileId: 'default-v1', operationClassId, underlyingClassId,
    admissibleReceiptKinds: external
      ? ['protected-pre-dispatch-denial', 'provider-observation', 'provider-signed']
      : operationClassId === 'ADVISORY' ? ['provider-observation', 'provider-signed'] : ['local-audit'],
    producerProfileDigests: producerDigest === null ? [] : [producerDigest], observerProfileDigests: observerDigests,
    minimumIndependentChannels: minimumChannels ?? (external ? 2 : 1),
    minimumPreDispatchDenialChannels: external ? 1 : null,
    correlationFieldIds: ['operationId', 'operationClassId', 'tenantDigest', 'accountDigest', 'targetDigest', 'requestDigest', 'semanticEffectDigest', 'idempotencyKeyDigest', 'providerAttemptDigest', 'immutableProviderActionIdDigest', 'activeSetDigest', 'policyDigest', 'fenceDigest', 'producerProfileDigest'],
    terminalMappings: [
      { providerStatusId: 'denied', evaluation: 'PROVEN_DENIED' }, { providerStatusId: 'failed', evaluation: 'PROVEN_FAILED' },
      { providerStatusId: 'not-found', evaluation: 'PROVEN_FAILED' }, { providerStatusId: 'succeeded', evaluation: 'PROVEN_SUCCEEDED' }
    ], reconciliationProfileDigest: reconciliationDigest, retentionMs: 86_400_000, expiryMs: 60_000, revocationBehavior: 'INVALIDATE_AND_QUARANTINE'
  };
}

function trustProfile(receiptRow) {
  return { schemaId: 'kstack.receipt-trust-profile.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, profileId: 'receipt-trust-v1', activeSetDigest: ACTIVE, rows: [receiptRow] };
}

function dispatchAudit(expected) {
  return {
    schemaId: 'kstack.protected-dispatch-audit.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, authorityEnvelopeDigest: D('1'), correlation: expected,
    endpointIdentityDigest: D('3'),
    serializedOutboundBodyDigest: D('2'), preDispatchFenceDigest: expected.fenceDigest, dispatchStartedRecordDigest: D('3'),
    transportOutcome: 'RESPONSE_CAPTURED', boundedResponseDigest: D('4'), startedAt: '2026-08-29T06:00:00.000Z', completedAt: '2026-08-29T06:00:01.000Z'
  };
}

function providerEvidence(expected, profileDigest, overrides = {}) {
  return {
    schemaId: 'kstack.provider-receipt-evidence.v1', schemaVersion: 1, schemaSetDigest: SCHEMA,
    producerProfileDigest: profileDigest, providerId: 'jira', endpointIdentityDigest: D('3'), receiptKind: 'provider-observation', correlation: expected,
    providerStatusId: 'succeeded', canonicalFactSetDigest: FACT, rawProtectedResponseDigest: D('4'), channelObservationDigest: D('5'),
    providerSignatureDigest: null, readBackEvidenceDigest: D('6'), observedAt: '2026-08-29T06:00:02.000Z', providerReportedAt: null,
    trustedTimeSampleDigest: D('7'), assuranceLevel: 'AUTHENTICATED_PROVIDER_OBSERVATION', ...overrides
  };
}

function reconciliationEvidence(fixture, overrides = {}) {
  return {
    schemaId: 'kstack.receipt-reconciliation-evidence.v1', schemaVersion: 1, schemaSetDigest: SCHEMA,
    reconciliationProfileDigest: fixture.trustProfile.rows[0].reconciliationProfileDigest,
    correlationDigest: hostAddress('KSTACK-RECEIPT-CORRELATION-V1', fixture.expectedCorrelation), queryClassificationDigest: D('1'),
    startedLedgerReceiptDigest: D('2'), completedLedgerReceiptDigest: D('3'), effectClassification: 'READ_ONLY_QUERY',
    statusId: 'succeeded', factSetDigest: FACT, responseDigest: D('4'), complete: true, authoritativeNegative: false,
    visibilityWindowElapsed: false, observedAt: '2026-08-29T06:00:03.000Z', ...overrides
  };
}

function externalFixture(overrides = {}) {
  const producer = producerProfile(); const producerDigest = validateReceiptProducerProfile(producer).profileDigest;
  const reconciliation = reconciliationProfile(producerDigest); const reconciliationDigest = validateReceiptReconciliationProfile(reconciliation).profileDigest;
  const receiptRow = row({ producerDigest, reconciliationDigest }); const trust = trustProfile(receiptRow); const expected = correlation('ASK_SIDE_EFFECT', 'jira-comment', producerDigest);
  return {
    trustProfile: trust, rowId: receiptRow.rowId, expectedCorrelation: expected, dispatchAudit: dispatchAudit(expected), producerProfile: producer,
    providerEvidence: providerEvidence(expected, producerDigest), localEvidence: null, backgroundLifecycleAuditDigest: null, observerEvidence: [],
    integrityValid: true, revocation: null, possiblyActed: true, reconciliationEvidence: null, ...overrides
  };
}

function localFixture(operationClassId = 'LOCAL_READ', underlyingClassId = null) {
  const operationId = operationClassId === 'BACKGROUND' ? 'background-read' : 'local-read'; const receiptRow = row({ operationClassId, underlyingClassId, operationId });
  const expected = correlation(operationClassId, operationId, D('f'));
  return {
    trustProfile: trustProfile(receiptRow), rowId: receiptRow.rowId, expectedCorrelation: expected, dispatchAudit: null, producerProfile: null, providerEvidence: null,
    localEvidence: { receiptKind: 'local-audit', localAuditDigest: D('1'), statusId: 'succeeded', factSetDigest: FACT }, backgroundLifecycleAuditDigest: operationClassId === 'BACKGROUND' ? D('2') : null,
    observerEvidence: [], integrityValid: true, revocation: null, possiblyActed: false, reconciliationEvidence: null
  };
}

test('trust rows encode the full operation-class matrix and reject unsafe external shortcuts', () => {
  for (const operationClassId of ['LOCAL_READ', 'ADVISORY', 'LOCAL_WRITE']) assert.doesNotThrow(() => validateReceiptTrustProfile(trustProfile(row({ operationClassId, operationId: operationClassId.toLowerCase() }))));
  assert.doesNotThrow(() => validateReceiptTrustProfile(trustProfile(row({ operationClassId: 'BACKGROUND', underlyingClassId: 'LOCAL_READ', operationId: 'background-read' }))));
  const fixture = externalFixture(); assert.match(validateReceiptTrustProfile(fixture.trustProfile).profileDigest, /^sha256:/u);
  assert.throws(() => validateReceiptTrustProfile(trustProfile(row({ operationClassId: 'ASK_SIDE_EFFECT', operationId: 'unsafe' }))), (error) => error?.code === 'KSTACK_RECEIPT_PROFILE_INVALID');
  const duplicate = structuredClone(fixture.trustProfile); duplicate.rows.push(structuredClone(duplicate.rows[0]));
  assert.throws(() => validateReceiptTrustProfile(duplicate), (error) => error?.code === 'KSTACK_RECEIPT_PROFILE_INVALID');
});

test('producer profiles reject credential export, redirects, host roots, and missing signed-or-readback authority', () => {
  assert.match(validateReceiptProducerProfile(producerProfile()).profileDigest, /^sha256:/u);
  for (const mutation of [{ credentialNonExport: false }, { redirectsAllowed: true }, { hostProxyRootsAllowed: true }, { qualifiedOutcome: 'UNKNOWN' }, { readBackProfileDigest: null }]) {
    assert.throws(() => validateReceiptProducerProfile(producerProfile(mutation)), (error) => error?.code === 'KSTACK_RECEIPT_PRODUCER_INVALID');
  }
});

test('provider evidence binds qualified producer identity, endpoint, receipt kind, and assurance proof', () => {
  const fixture = externalFixture(); assert.match(validateProviderReceiptEvidence(fixture.providerEvidence).evidenceDigest, /^sha256:/u);
  assert.equal(evaluateReceipt(fixture).evaluation, 'PROVEN_SUCCEEDED');
  for (const mutation of [
    { providerId: 'other' }, { endpointIdentityDigest: D('0') }, { receiptKind: 'unregistered' }, { readBackEvidenceDigest: null }
  ]) assert.equal(evaluateReceipt({ ...fixture, providerEvidence: { ...fixture.providerEvidence, ...mutation } }).evaluation, 'INVALID');
  assert.throws(() => validateProviderReceiptEvidence({ ...fixture.providerEvidence, assuranceLevel: 'CRYPTOGRAPHICALLY_SIGNED_PROVIDER_RECEIPT' }), (error) => error?.code === 'KSTACK_RECEIPT_PROVIDER_EVIDENCE_INVALID');
});

test('every expected correlation field is independently enforced against dispatch and provider evidence', () => {
  const fixture = externalFixture();
  for (const key of Object.keys(fixture.expectedCorrelation)) {
    const value = key === 'operationId' ? 'different-operation' : key === 'operationClassId' ? 'PRIVILEGED_SIDE_EFFECT' : D('0');
    const mutated = { ...fixture.dispatchAudit, correlation: { ...fixture.dispatchAudit.correlation, [key]: value } };
    assert.equal(evaluateReceipt({ ...fixture, dispatchAudit: mutated }).evaluation, 'INVALID', key);
  }
  assert.equal(evaluateReceipt({ ...fixture, dispatchAudit: { ...fixture.dispatchAudit, endpointIdentityDigest: D('0') } }).evaluation, 'INVALID');
});

test('local, advisory, write, and background claims require their class-specific protected evidence', () => {
  assert.equal(evaluateReceipt(localFixture('LOCAL_READ')).evaluation, 'PROVEN_SUCCEEDED');
  assert.equal(evaluateReceipt({ ...localFixture('LOCAL_READ'), localEvidence: null }).evaluation, 'UNAVAILABLE');
  assert.equal(evaluateReceipt(localFixture('LOCAL_WRITE')).evaluation, 'PROVEN_SUCCEEDED');
  assert.equal(evaluateReceipt({ ...localFixture('LOCAL_WRITE'), localEvidence: null }).reasonCodes.includes('KSTACK_RECEIPT_MUTATION_EVIDENCE_REQUIRED'), true);
  assert.equal(evaluateReceipt(localFixture('BACKGROUND', 'LOCAL_READ')).evaluation, 'PROVEN_SUCCEEDED');
  assert.equal(evaluateReceipt({ ...localFixture('BACKGROUND', 'LOCAL_READ'), backgroundLifecycleAuditDigest: null }).evaluation, 'UNAVAILABLE');
});

test('external effects never become proven from local or dispatch evidence alone', () => {
  const fixture = externalFixture();
  assert.equal(evaluateReceipt({ ...fixture, producerProfile: null, providerEvidence: null, possiblyActed: true }).evaluation, 'AMBIGUOUS');
  assert.equal(evaluateReceipt({ ...fixture, producerProfile: null, providerEvidence: null, possiblyActed: false }).evaluation, 'UNAVAILABLE');
  assert.equal(evaluateReceipt({ ...fixture, localEvidence: { receiptKind: 'local-audit', localAuditDigest: D('1'), statusId: 'succeeded', factSetDigest: FACT }, producerProfile: null, providerEvidence: null }).evaluation, 'AMBIGUOUS');
  const denialEvidence = {
    schemaId: 'kstack.protected-pre-dispatch-denial-evidence.v1', schemaVersion: 1,
    schemaSetDigest: SCHEMA, receiptKind: 'protected-pre-dispatch-denial',
    correlationDigest: hostAddress('KSTACK-RECEIPT-CORRELATION-V1', fixture.expectedCorrelation),
    authorityEnvelopeDigest: D('1'), preDispatchFenceDigest: fixture.expectedCorrelation.fenceDigest,
    denialDecisionDigest: D('2'), protectedLedgerReceiptDigest: D('3'), localAuditDigest: D('4'),
    statusId: 'denied', factSetDigest: FACT, dispatchAttempted: false, possiblyActed: false,
    observedAt: '2026-08-29T06:00:00.000Z', trustedTimeSampleDigest: D('5')
  };
  const preDispatchDenied = { ...fixture, dispatchAudit: null, producerProfile: null, providerEvidence: null, possiblyActed: false, localEvidence: denialEvidence };
  assert.equal(evaluateReceipt(preDispatchDenied).evaluation, 'PROVEN_DENIED');
  assert.equal(evaluateReceipt({ ...preDispatchDenied, localEvidence: { receiptKind: 'local-audit', localAuditDigest: D('4'), statusId: 'denied', factSetDigest: FACT } }).evaluation, 'UNAVAILABLE');
  assert.equal(evaluateReceipt({ ...preDispatchDenied, possiblyActed: true }).evaluation, 'INVALID');
  assert.equal(evaluateReceipt({ ...preDispatchDenied, localEvidence: { ...denialEvidence, correlationDigest: D('0') } }).evaluation, 'INVALID');
  const trustDigest = validateReceiptTrustProfile(preDispatchDenied.trustProfile).profileDigest;
  const denialEvidenceDigest = hostAddress('KSTACK-PROTECTED-PRE-DISPATCH-DENIAL-EVIDENCE-V1', denialEvidence);
  assert.doesNotThrow(() => createOperationReceipt({ schemaSetDigest: SCHEMA, trustProfileDigest: trustDigest, profileRowId: preDispatchDenied.rowId, correlationDigest: hostAddress('KSTACK-RECEIPT-CORRELATION-V1', preDispatchDenied.expectedCorrelation), operationClassId: 'ASK_SIDE_EFFECT', underlyingClassId: null, resultDigest: D('1'), evaluationDigest: D('2'), evaluation: 'PROVEN_DENIED', dispatchAuditDigest: null, producerReceiptDigest: null, localAuditDigest: D('4'), preDispatchDenialEvidenceDigest: denialEvidenceDigest, backgroundLifecycleAuditDigest: null, observerEvidenceDigests: [], retentionMs: 1000, expiresAt: '2026-08-29T06:01:00.000Z', createdAt: '2026-08-29T06:00:00.000Z' }));
  assert.throws(() => createOperationReceipt({ schemaSetDigest: SCHEMA, trustProfileDigest: trustDigest, profileRowId: preDispatchDenied.rowId, correlationDigest: hostAddress('KSTACK-RECEIPT-CORRELATION-V1', preDispatchDenied.expectedCorrelation), operationClassId: 'ASK_SIDE_EFFECT', underlyingClassId: null, resultDigest: D('1'), evaluationDigest: D('2'), evaluation: 'PROVEN_DENIED', dispatchAuditDigest: null, producerReceiptDigest: null, localAuditDigest: D('4'), preDispatchDenialEvidenceDigest: null, backgroundLifecycleAuditDigest: null, observerEvidenceDigests: [], retentionMs: 1000, expiresAt: '2026-08-29T06:01:00.000Z', createdAt: '2026-08-29T06:00:00.000Z' }));
});

test('evaluation precedence is invalid, contradictory, ambiguous, unavailable, then proven', () => {
  const fixture = externalFixture();
  const rec = reconciliationEvidence(fixture, { statusId: 'failed', factSetDigest: D('d') });
  assert.equal(evaluateReceipt({ ...fixture, reconciliationEvidence: rec }).evaluation, 'CONTRADICTORY');
  assert.equal(evaluateReceipt({ ...fixture, reconciliationEvidence: rec, integrityValid: false }).evaluation, 'INVALID');
  assert.equal(evaluateReceipt({ ...fixture, providerEvidence: { ...fixture.providerEvidence, providerStatusId: 'pending' } }).evaluation, 'AMBIGUOUS');
  assert.equal(evaluateReceipt({ ...fixture, producerProfile: null, providerEvidence: null, possiblyActed: false }).evaluation, 'UNAVAILABLE');
  assert.equal(evaluateReceipt(fixture).evaluation, 'PROVEN_SUCCEEDED');
});

test('not-found is ambiguous until an exact complete authoritative query passes its visibility window', () => {
  const fixture = externalFixture({ producerProfile: null, providerEvidence: null });
  const base = reconciliationEvidence(fixture, { authoritativeNegative: true, visibilityWindowElapsed: false, statusId: 'not-found' });
  assert.equal(evaluateReceipt({ ...fixture, reconciliationEvidence: base }).evaluation, 'AMBIGUOUS');
  assert.equal(evaluateReceipt({ ...fixture, reconciliationEvidence: { ...base, visibilityWindowElapsed: true } }).evaluation, 'PROVEN_FAILED');
});

test('same terminal label with divergent canonical facts is contradictory rather than majority-selected', () => {
  const fixture = externalFixture(); const reconciliation = reconciliationEvidence(fixture, { factSetDigest: D('d') });
  assert.equal(evaluateReceipt({ ...fixture, reconciliationEvidence: reconciliation }).evaluation, 'CONTRADICTORY');
});

test('revocation, retention, and tombstones preserve quarantine and block redispatch', () => {
  const fixture = externalFixture(); const revocation = {
    schemaId: 'kstack.receipt-revocation.v1', schemaVersion: 1, schemaSetDigest: SCHEMA, producerProfileDigest: fixture.expectedCorrelation.producerProfileDigest,
    keyDigest: null, invalidFrom: '2026-08-29T06:00:00.000Z', reasonCode: 'KEY_COMPROMISED', evidenceEpoch: 2, protectedAnchorDigest: D('1')
  };
  assert.match(validateReceiptRevocation(revocation).revocationDigest, /^sha256:/u); assert.equal(evaluateReceipt({ ...fixture, revocation }).evaluation, 'INVALID');
  assert.deepEqual(deriveReceiptRetention({ providerWindowMs: 10, ambiguityRetentionMs: 40, auditRetentionMs: 30, profileRetentionMs: 20, unresolved: true }), { retentionMs: 40, rawBodyArchivalAllowed: false, sameEffectRetryEligible: false });
  const tombstone = createReceiptTombstone({ schemaSetDigest: SCHEMA, operationReceiptDigest: D('1'), correlationDigest: D('2'), terminalEvaluation: 'AMBIGUOUS', trustClosureDigest: D('3'), retainedFactSetDigest: D('4'), archivedRawBodyDigest: null, createdAt: '2026-08-29T07:00:00.000Z' });
  assert.equal(tombstone.tombstone.replayDisposition, 'SAME_EFFECT_REDISPATCH_BLOCKED');
  assert.throws(() => createReceiptTombstone({ ...tombstone.tombstone, schemaId: undefined }));
});

function backendFixture({ action = false } = {}) {
  const calls = [];
  return { calls, backend: {
    descriptor: { protectionClass: 'test-only', repositoryWritable: false, agentWritable: false, durableLedger: true, queryEffectClassification: 'READ_ONLY_QUERY', actionEndpointsRejected: true },
    append: async (entry) => { calls.push(`append:${entry.event}`); return D(String((calls.length % 9) + 1)); },
    classifyQuery: async (entry) => { calls.push('classifyQuery'); return { effectClassification: action ? 'ACTION' : 'READ_ONLY_QUERY', endpointIdentityDigest: entry.endpointIdentityDigest, methodId: entry.methodId, serializedQueryDigest: entry.serializedQueryDigest, qualified: !action }; },
    queryReadOnly: async () => { calls.push('queryReadOnly'); return { statusId: 'succeeded', complete: true, authoritativeNegative: false, visibilityWindowElapsed: false, factSetDigest: FACT, responseDigest: D('2'), observedAt: '2026-08-29T06:00:03.000Z' }; },
    releaseResult: async () => { calls.push('releaseResult'); return D('3'); }
  } };
}

test('reconciliation rejects action-capable bytes before send and covers every nonmutation branch', async () => {
  const fixture = externalFixture(); const profile = reconciliationProfile(fixture.expectedCorrelation.producerProfileDigest);
  assert.equal(profile.nonMutationProofDigests.length, 11); assert.match(validateReceiptReconciliationProfile(profile).profileDigest, /^sha256:/u);
  const unsafe = backendFixture({ action: true }); const kernel = new ProtectedReceiptKernel({ schemaSetDigest: SCHEMA, backend: unsafe.backend, allowTestBackend: true });
  await assert.rejects(kernel.reconcile({ profile, correlation: fixture.expectedCorrelation, serializedQueryDigest: D('4') }), (error) => error?.code === 'KSTACK_RECEIPT_READBACK_UNQUALIFIED');
  assert.equal(unsafe.calls.includes('queryReadOnly'), false); assert.equal(unsafe.calls.some((entry) => entry.startsWith('append:')), false);
  for (let index = 0; index < 11; index += 1) {
    const mutation = structuredClone(profile); mutation.nonMutationProofDigests.splice(index, 1);
    assert.throws(() => validateReceiptReconciliationProfile(mutation), (error) => error?.code === 'KSTACK_RECEIPT_READBACK_UNQUALIFIED');
  }
});

test('qualified reconciliation is ledgered around exactly one read-only query', async () => {
  const fixture = externalFixture(); const adapter = backendFixture(); const kernel = new ProtectedReceiptKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true });
  const result = await kernel.reconcile({ profile: reconciliationProfile(fixture.expectedCorrelation.producerProfileDigest), correlation: fixture.expectedCorrelation, serializedQueryDigest: D('4') });
  assert.equal(result.observation.statusId, 'succeeded'); assert.match(result.reconciliationEvidenceDigest, /^sha256:/u); assert.deepEqual(adapter.calls, ['classifyQuery', 'append:RECONCILIATION_QUERY_STARTED', 'queryReadOnly', 'append:RECONCILIATION_QUERY_COMPLETED']);
});

function operationReceiptInput(fixture, evaluation = 'PROVEN_SUCCEEDED') {
  const trustDigest = validateReceiptTrustProfile(fixture.trustProfile).profileDigest;
  return {
    trustProfileDigest: trustDigest, profileRowId: fixture.rowId, correlationDigest: hostAddress('KSTACK-RECEIPT-CORRELATION-V1', fixture.expectedCorrelation),
    operationClassId: fixture.expectedCorrelation.operationClassId, underlyingClassId: null, resultDigest: D('1'),
    dispatchAuditDigest: hostAddress('KSTACK-PROTECTED-DISPATCH-AUDIT-V1', fixture.dispatchAudit), producerReceiptDigest: hostAddress('KSTACK-PROVIDER-RECEIPT-EVIDENCE-V1', fixture.providerEvidence),
    localAuditDigest: null, preDispatchDenialEvidenceDigest: null, backgroundLifecycleAuditDigest: null, observerEvidenceDigests: [], retentionMs: 86_400_000,
    expiresAt: '2026-08-30T06:00:00.000Z', createdAt: '2026-08-29T06:00:00.000Z', evaluation
  };
}

test('operation receipts are acyclic and finalized in the protected ledger before result release', async () => {
  const fixture = externalFixture(); const adapter = backendFixture(); const kernel = new ProtectedReceiptKernel({ schemaSetDigest: SCHEMA, backend: adapter.backend, allowTestBackend: true });
  const input = operationReceiptInput(fixture); const direct = createOperationReceipt({ ...input, schemaSetDigest: SCHEMA, evaluationDigest: D('2') });
  assert.equal(Object.hasOwn(direct.receipt, 'receiptDigest'), false); assert.equal(direct.receipt.resultDigest, D('1'));
  const finalized = await kernel.finalize({ evaluationInput: fixture, operationReceiptInput: input });
  assert.equal(finalized.released, true); assert.deepEqual(adapter.calls, ['append:OPERATION_RECEIPT_FINALIZED', 'releaseResult']);
  const ambiguous = externalFixture({ providerEvidence: { ...fixture.providerEvidence, providerStatusId: 'pending' } });
  const blockedAdapter = backendFixture(); const blocked = new ProtectedReceiptKernel({ schemaSetDigest: SCHEMA, backend: blockedAdapter.backend, allowTestBackend: true });
  const blockedInput = operationReceiptInput(ambiguous, 'AMBIGUOUS'); blockedInput.producerReceiptDigest = hostAddress('KSTACK-PROVIDER-RECEIPT-EVIDENCE-V1', ambiguous.providerEvidence);
  assert.equal((await blocked.finalize({ evaluationInput: ambiguous, operationReceiptInput: blockedInput })).released, false);
  assert.deepEqual(blockedAdapter.calls, ['append:OPERATION_RECEIPT_FINALIZED']);
  const lost = externalFixture({ producerProfile: null, providerEvidence: null }); const lostAdapter = backendFixture(); const lostKernel = new ProtectedReceiptKernel({ schemaSetDigest: SCHEMA, backend: lostAdapter.backend, allowTestBackend: true });
  const lostInput = operationReceiptInput(fixture, 'AMBIGUOUS'); lostInput.producerReceiptDigest = null;
  assert.equal((await lostKernel.finalize({ evaluationInput: lost, operationReceiptInput: lostInput })).released, false);
  assert.deepEqual(lostAdapter.calls, ['append:OPERATION_RECEIPT_FINALIZED']);
});

test('independent Rust oracle matches all closed precedence combinations', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-host-receipt-rust-'));
  try {
    const build = spawnSync('cargo', ['build', '--quiet', '--offline', '--locked', '--manifest-path', rustManifest, '--target-dir', target], { encoding: 'utf8' }); assert.equal(build.status, 0, build.stderr);
    const binary = path.join(target, 'debug', `kstack-host-receipt-reference${process.platform === 'win32' ? '.exe' : ''}`);
    const fields = ['integrityValid', 'revoked', 'correlationValid', 'contradictory', 'unknownStatus', 'possiblyActedMissing', 'mandatoryAvailable', 'channelsSufficient']; const vectors = [];
    for (const terminalEvaluation of ['PROVEN_DENIED', 'PROVEN_FAILED', 'PROVEN_SUCCEEDED']) for (let mask = 0; mask < 2 ** fields.length; mask += 1) vectors.push(Object.fromEntries([...fields.map((field, index) => [field, (mask & 2 ** index) !== 0]), ['terminalEvaluation', terminalEvaluation]]));
    const oracleInput = vectors.map((vector) => [...fields.map((field) => vector[field] ? '1' : '0'), vector.terminalEvaluation].join(',')).join('\n');
    const oracle = spawnSync(binary, [oracleInput], { encoding: 'utf8' }); assert.equal(oracle.status, 0, oracle.stderr); const results = oracle.stdout.trim().split('\n');
    vectors.forEach((vector, index) => assert.equal(results[index], classifyReceiptOutcome(vector), JSON.stringify(vector)));
    assert.equal(spawnSync(binary, ['{}'], { encoding: 'utf8' }).status, 2);
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
});
