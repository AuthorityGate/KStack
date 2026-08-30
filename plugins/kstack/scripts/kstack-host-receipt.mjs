import { assertAsciiId, assertDigest, assertTimestamp, hostAddress } from './kstack-host-contract.mjs';

export class HostReceiptError extends Error {
  constructor(code) { super(code); this.name = 'HostReceiptError'; this.code = code; }
}
function fail(code) { throw new HostReceiptError(code); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(); const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}
function digest(value, code) { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code) { try { return assertAsciiId(value); } catch { fail(code); } }
function timestamp(value, code) { try { return assertTimestamp(value); } catch { fail(code); } }
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function uint(value, maximum, positive, code) { if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) fail(code); return value; }
function enumeration(value, allowed, code) { if (!allowed.includes(value)) fail(code); return value; }
function sortedUnique(values, validator, minimum, maximum, code) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((value) => validator(value, code));
  if (new Set(values).size !== values.length || values.some((value, index) => index > 0 && value <= values[index - 1])) fail(code);
  return values;
}
function stableCode(value, code) { if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(value)) fail(code); return value; }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export const RECEIPT_OPERATION_CLASSES = Object.freeze(['ADVISORY', 'ASK_SIDE_EFFECT', 'BACKGROUND', 'LOCAL_READ', 'LOCAL_WRITE', 'PRIVILEGED_SIDE_EFFECT']);
export const RECEIPT_EVALUATIONS = Object.freeze(['AMBIGUOUS', 'CONTRADICTORY', 'INVALID', 'PROVEN_DENIED', 'PROVEN_FAILED', 'PROVEN_SUCCEEDED', 'UNAVAILABLE']);
const PROVEN_EVALUATIONS = Object.freeze(['PROVEN_DENIED', 'PROVEN_FAILED', 'PROVEN_SUCCEEDED']);
const EXTERNAL_CLASSES = Object.freeze(['ASK_SIDE_EFFECT', 'PRIVILEGED_SIDE_EFFECT']);
const CORRELATION_KEYS = Object.freeze([
  'operationId', 'operationClassId', 'tenantDigest', 'accountDigest', 'targetDigest', 'requestDigest',
  'semanticEffectDigest', 'idempotencyKeyDigest', 'providerAttemptDigest', 'immutableProviderActionIdDigest',
  'activeSetDigest', 'policyDigest', 'fenceDigest', 'producerProfileDigest'
]);
const NON_MUTATION_BRANCHES = Object.freeze(['ABSENT', 'CONTRADICTORY', 'EXPIRED', 'INCOMPLETE', 'PRESENT', 'RATE_LIMITED', 'REDIRECTED', 'TENANT_MISMATCHED', 'UNAUTHORIZED', 'UNKNOWN', 'UNSUPPORTED']);

function validateCorrelation(value, code = 'KSTACK_RECEIPT_CORRELATION_INVALID') {
  exact(value, CORRELATION_KEYS, code); ascii(value.operationId, code); enumeration(value.operationClassId, RECEIPT_OPERATION_CLASSES, code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code);
  return immutable(value);
}

export function validateReceiptTrustProfile(value) {
  const code = 'KSTACK_RECEIPT_PROFILE_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'profileId', 'activeSetDigest', 'rows'], code);
  if (value.schemaId !== 'kstack.receipt-trust-profile.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); ascii(value.profileId, code); digest(value.activeSetDigest, code);
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 1024) fail(code);
  const keys = []; const rowIds = [];
  for (const row of value.rows) {
    exact(row, ['rowId', 'operationId', 'operationProfileId', 'operationClassId', 'underlyingClassId', 'admissibleReceiptKinds', 'producerProfileDigests', 'observerProfileDigests', 'minimumIndependentChannels', 'minimumPreDispatchDenialChannels', 'correlationFieldIds', 'terminalMappings', 'reconciliationProfileDigest', 'retentionMs', 'expiryMs', 'revocationBehavior'], code);
    for (const key of ['rowId', 'operationId', 'operationProfileId']) ascii(row[key], code);
    enumeration(row.operationClassId, RECEIPT_OPERATION_CLASSES, code);
    if (row.operationClassId === 'BACKGROUND') enumeration(row.underlyingClassId, RECEIPT_OPERATION_CLASSES.filter((entry) => entry !== 'BACKGROUND'), code); else if (row.underlyingClassId !== null) fail(code);
    sortedUnique(row.admissibleReceiptKinds, ascii, 1, 32, code); sortedUnique(row.producerProfileDigests, digest, 0, 32, code); sortedUnique(row.observerProfileDigests, digest, 0, 32, code);
    uint(row.minimumIndependentChannels, 16, true, code); if (JSON.stringify(row.correlationFieldIds) !== JSON.stringify(CORRELATION_KEYS)) fail(code);
    if (!Array.isArray(row.terminalMappings) || row.terminalMappings.length < 1 || row.terminalMappings.length > 64) fail(code);
    const statuses = [];
    for (const mapping of row.terminalMappings) {
      exact(mapping, ['providerStatusId', 'evaluation'], code); ascii(mapping.providerStatusId, code); statuses.push(mapping.providerStatusId);
      enumeration(mapping.evaluation, ['PROVEN_SUCCEEDED', 'PROVEN_FAILED', 'PROVEN_DENIED'], code);
    }
    if (new Set(statuses).size !== statuses.length || statuses.some((entry, index) => index > 0 && entry <= statuses[index - 1])) fail(code);
    const effectiveClass = row.operationClassId === 'BACKGROUND' ? row.underlyingClassId : row.operationClassId;
    if (EXTERNAL_CLASSES.includes(effectiveClass)) {
      uint(row.minimumPreDispatchDenialChannels, 16, true, code);
      if (row.producerProfileDigests.length < 1 || row.reconciliationProfileDigest === null || row.minimumIndependentChannels < 2
          || !row.admissibleReceiptKinds.includes('protected-pre-dispatch-denial')) fail(code);
    } else {
      if (row.minimumPreDispatchDenialChannels !== null || row.admissibleReceiptKinds.includes('protected-pre-dispatch-denial')) fail(code);
      if (row.reconciliationProfileDigest !== null) fail(code);
      if (effectiveClass !== 'ADVISORY' && row.producerProfileDigests.length !== 0) fail(code);
    }
    if (row.reconciliationProfileDigest !== null) digest(row.reconciliationProfileDigest, code);
    uint(row.retentionMs, Number.MAX_SAFE_INTEGER, true, code); uint(row.expiryMs, Number.MAX_SAFE_INTEGER, true, code);
    if (row.retentionMs < row.expiryMs || row.revocationBehavior !== 'INVALIDATE_AND_QUARANTINE') fail(code);
    keys.push(`${row.operationId}\0${row.operationProfileId}\0${row.operationClassId}`); rowIds.push(row.rowId);
  }
  if (new Set(keys).size !== keys.length || new Set(rowIds).size !== rowIds.length) fail(code);
  return immutable({ profile: value, profileDigest: hostAddress('KSTACK-RECEIPT-TRUST-PROFILE-V1', value) });
}

export function validateReceiptProducerProfile(value) {
  const code = 'KSTACK_RECEIPT_PRODUCER_INVALID';
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'profileId', 'providerId', 'tenantDigest', 'accountDigest',
    'endpointIdentityDigest', 'tlsPolicyDigest', 'apiVersion', 'protocolVersion', 'responseSchemaDigest',
    'authenticationSourceDigest', 'credentialNonExport', 'requestCanonicalizationDigest', 'responseCanonicalizationDigest',
    'immutableActionIdFieldId', 'idempotencySemanticsDigest', 'statusMappingDigest', 'signedReceiptProfileDigest',
    'readBackProfileDigest', 'paginationCompletenessDigest', 'errorMappingDigest', 'retentionMs', 'negativeVectorDigests',
    'redirectsAllowed', 'hostProxyRootsAllowed', 'qualifiedOutcome'
  ], code);
  if (value.schemaId !== 'kstack.receipt-producer-profile.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); ascii(value.profileId, code); ascii(value.providerId, code); ascii(value.apiVersion, code); ascii(value.protocolVersion, code); ascii(value.immutableActionIdFieldId, code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest') && entry !== null) digest(entry, code);
  bool(value.credentialNonExport, code); bool(value.redirectsAllowed, code); bool(value.hostProxyRootsAllowed, code);
  uint(value.retentionMs, Number.MAX_SAFE_INTEGER, true, code); sortedUnique(value.negativeVectorDigests, digest, 1, 64, code);
  if (!value.credentialNonExport || value.redirectsAllowed || value.hostProxyRootsAllowed || value.qualifiedOutcome !== 'PROVEN') fail(code);
  if (value.signedReceiptProfileDigest === null && value.readBackProfileDigest === null) fail(code);
  return immutable({ profile: value, profileDigest: hostAddress('KSTACK-RECEIPT-PRODUCER-PROFILE-V1', value) });
}

export function validateReceiptReconciliationProfile(value) {
  const code = 'KSTACK_RECEIPT_READBACK_UNQUALIFIED';
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'profileId', 'producerProfileDigest', 'endpointIdentityDigest',
    'methodId', 'requestTemplateDigest', 'effectClassification', 'nonMutationProofDigests', 'queryBy', 'maximumAttempts',
    'backoffScheduleMs', 'totalDeadlineMs', 'paginationComplete', 'maximumVisibilityWindowMs',
    'authoritativeNegativeSupported', 'redirectsAllowed', 'qualifiedOutcome'
  ], code);
  if (value.schemaId !== 'kstack.receipt-reconciliation-profile.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); ascii(value.profileId, code); digest(value.producerProfileDigest, code); digest(value.endpointIdentityDigest, code); ascii(value.methodId, code); digest(value.requestTemplateDigest, code);
  if (value.effectClassification !== 'READ_ONLY_QUERY' || value.queryBy !== 'IMMUTABLE_ACTION_ID_OR_IDEMPOTENCY_KEY' || value.qualifiedOutcome !== 'PROVEN') fail(code);
  if (!Array.isArray(value.nonMutationProofDigests) || value.nonMutationProofDigests.length !== NON_MUTATION_BRANCHES.length) fail(code);
  for (const row of value.nonMutationProofDigests) { exact(row, ['branchId', 'proofDigest'], code); stableCode(row.branchId, code); digest(row.proofDigest, code); }
  if (JSON.stringify(value.nonMutationProofDigests.map((row) => row.branchId)) !== JSON.stringify(NON_MUTATION_BRANCHES)) fail(code);
  uint(value.maximumAttempts, 16, true, code); if (!Array.isArray(value.backoffScheduleMs) || value.backoffScheduleMs.length !== value.maximumAttempts - 1) fail(code);
  value.backoffScheduleMs.forEach((entry) => uint(entry, 60_000, true, code)); uint(value.totalDeadlineMs, 300_000, true, code); uint(value.maximumVisibilityWindowMs, 604_800_000, true, code);
  bool(value.paginationComplete, code); bool(value.authoritativeNegativeSupported, code); bool(value.redirectsAllowed, code);
  if (!value.paginationComplete || value.redirectsAllowed) fail(code);
  return immutable({ profile: value, profileDigest: hostAddress('KSTACK-RECEIPT-RECONCILIATION-PROFILE-V1', value) });
}

export function validateProtectedDispatchAudit(value) {
  const code = 'KSTACK_RECEIPT_DISPATCH_AUDIT_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'authorityEnvelopeDigest', 'endpointIdentityDigest', 'correlation', 'serializedOutboundBodyDigest', 'preDispatchFenceDigest', 'dispatchStartedRecordDigest', 'transportOutcome', 'boundedResponseDigest', 'startedAt', 'completedAt'], code);
  if (value.schemaId !== 'kstack.protected-dispatch-audit.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); digest(value.authorityEnvelopeDigest, code); digest(value.endpointIdentityDigest, code); validateCorrelation(value.correlation, code);
  for (const key of ['serializedOutboundBodyDigest', 'preDispatchFenceDigest', 'dispatchStartedRecordDigest']) digest(value[key], code);
  enumeration(value.transportOutcome, ['NO_RESPONSE', 'RESPONSE_CAPTURED', 'TRANSPORT_DENIED'], code);
  if (value.transportOutcome === 'RESPONSE_CAPTURED') digest(value.boundedResponseDigest, code); else if (value.boundedResponseDigest !== null) fail(code);
  timestamp(value.startedAt, code); timestamp(value.completedAt, code); if (value.startedAt >= value.completedAt || value.preDispatchFenceDigest !== value.correlation.fenceDigest) fail(code);
  return immutable({ audit: value, auditDigest: hostAddress('KSTACK-PROTECTED-DISPATCH-AUDIT-V1', value) });
}

export function validateProviderReceiptEvidence(value) {
  const code = 'KSTACK_RECEIPT_PROVIDER_EVIDENCE_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'producerProfileDigest', 'providerId', 'endpointIdentityDigest', 'receiptKind', 'correlation', 'providerStatusId', 'canonicalFactSetDigest', 'rawProtectedResponseDigest', 'channelObservationDigest', 'providerSignatureDigest', 'readBackEvidenceDigest', 'observedAt', 'providerReportedAt', 'trustedTimeSampleDigest', 'assuranceLevel'], code);
  if (value.schemaId !== 'kstack.provider-receipt-evidence.v1' || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code); digest(value.producerProfileDigest, code); ascii(value.providerId, code); digest(value.endpointIdentityDigest, code); ascii(value.receiptKind, code); validateCorrelation(value.correlation, code); ascii(value.providerStatusId, code);
  for (const key of ['canonicalFactSetDigest', 'rawProtectedResponseDigest', 'channelObservationDigest', 'trustedTimeSampleDigest']) digest(value[key], code);
  if (value.providerSignatureDigest !== null) digest(value.providerSignatureDigest, code); if (value.readBackEvidenceDigest !== null) digest(value.readBackEvidenceDigest, code);
  timestamp(value.observedAt, code); if (value.providerReportedAt !== null) timestamp(value.providerReportedAt, code);
  enumeration(value.assuranceLevel, ['AUTHENTICATED_PROVIDER_OBSERVATION', 'CRYPTOGRAPHICALLY_SIGNED_PROVIDER_RECEIPT'], code);
  if (value.assuranceLevel === 'CRYPTOGRAPHICALLY_SIGNED_PROVIDER_RECEIPT' ? value.providerSignatureDigest === null : value.providerSignatureDigest !== null) fail(code);
  if (value.producerProfileDigest !== value.correlation.producerProfileDigest) fail(code);
  return immutable({ evidence: value, evidenceDigest: hostAddress('KSTACK-PROVIDER-RECEIPT-EVIDENCE-V1', value) });
}

function validateLocalEvidence(value, code) {
  if (value === null) return null;
  if (value.receiptKind === 'local-audit') {
    exact(value, ['receiptKind', 'localAuditDigest', 'statusId', 'factSetDigest'], code);
    digest(value.localAuditDigest, code); ascii(value.statusId, code); digest(value.factSetDigest, code);
    return immutable({ evidence: value, evidenceDigest: hostAddress('KSTACK-LOCAL-RECEIPT-EVIDENCE-V1', value), preDispatchDenial: false });
  }
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'receiptKind', 'correlationDigest',
    'authorityEnvelopeDigest', 'preDispatchFenceDigest', 'denialDecisionDigest',
    'protectedLedgerReceiptDigest', 'localAuditDigest', 'statusId', 'factSetDigest',
    'dispatchAttempted', 'possiblyActed', 'observedAt', 'trustedTimeSampleDigest'
  ], code);
  if (value.schemaId !== 'kstack.protected-pre-dispatch-denial-evidence.v1' || value.schemaVersion !== 1
      || value.receiptKind !== 'protected-pre-dispatch-denial' || value.statusId !== 'denied'
      || value.dispatchAttempted !== false || value.possiblyActed !== false) fail(code);
  for (const key of [
    'schemaSetDigest', 'correlationDigest', 'authorityEnvelopeDigest', 'preDispatchFenceDigest',
    'denialDecisionDigest', 'protectedLedgerReceiptDigest', 'localAuditDigest', 'factSetDigest',
    'trustedTimeSampleDigest'
  ]) digest(value[key], code);
  timestamp(value.observedAt, code);
  return immutable({
    evidence: value,
    evidenceDigest: hostAddress('KSTACK-PROTECTED-PRE-DISPATCH-DENIAL-EVIDENCE-V1', value),
    preDispatchDenial: true
  });
}
function validateObserverEvidence(value, code) {
  exact(value, ['channelId', 'independenceGroupId', 'receiptKind', 'statusId', 'factSetDigest', 'profileDigest'], code);
  ascii(value.channelId, code); ascii(value.independenceGroupId, code); ascii(value.receiptKind, code); ascii(value.statusId, code); digest(value.factSetDigest, code); digest(value.profileDigest, code);
  return immutable(value);
}
export function validateReceiptReconciliationEvidence(value) {
  const code = 'KSTACK_RECEIPT_READBACK_EVIDENCE_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'reconciliationProfileDigest', 'correlationDigest', 'queryClassificationDigest', 'startedLedgerReceiptDigest', 'completedLedgerReceiptDigest', 'effectClassification', 'statusId', 'factSetDigest', 'responseDigest', 'complete', 'authoritativeNegative', 'visibilityWindowElapsed', 'observedAt'], code);
  if (value.schemaId !== 'kstack.receipt-reconciliation-evidence.v1' || value.schemaVersion !== 1 || value.effectClassification !== 'READ_ONLY_QUERY') fail(code);
  for (const key of ['schemaSetDigest', 'reconciliationProfileDigest', 'correlationDigest', 'queryClassificationDigest', 'startedLedgerReceiptDigest', 'completedLedgerReceiptDigest', 'factSetDigest', 'responseDigest']) digest(value[key], code);
  ascii(value.statusId, code); for (const key of ['complete', 'authoritativeNegative', 'visibilityWindowElapsed']) bool(value[key], code); timestamp(value.observedAt, code);
  if ((value.authoritativeNegative || value.visibilityWindowElapsed) && !value.complete) fail(code);
  return immutable({ evidence: value, evidenceDigest: hostAddress('KSTACK-RECEIPT-RECONCILIATION-EVIDENCE-V1', value) });
}
function outcome(evaluation, reasonCodes = []) { return immutable({ evaluation, reasonCodes: [...new Set(reasonCodes)].sort() }); }

export function classifyReceiptOutcome(value) {
  const code = 'KSTACK_RECEIPT_CLASSIFIER_INVALID';
  exact(value, ['integrityValid', 'revoked', 'correlationValid', 'contradictory', 'unknownStatus', 'possiblyActedMissing', 'mandatoryAvailable', 'channelsSufficient', 'terminalEvaluation'], code);
  for (const key of ['integrityValid', 'revoked', 'correlationValid', 'contradictory', 'unknownStatus', 'possiblyActedMissing', 'mandatoryAvailable', 'channelsSufficient']) bool(value[key], code);
  enumeration(value.terminalEvaluation, PROVEN_EVALUATIONS, code);
  if (!value.integrityValid || value.revoked || !value.correlationValid) return 'INVALID';
  if (value.contradictory) return 'CONTRADICTORY';
  if (value.unknownStatus || value.possiblyActedMissing) return 'AMBIGUOUS';
  if (!value.mandatoryAvailable || !value.channelsSufficient) return 'UNAVAILABLE';
  return value.terminalEvaluation;
}

export function evaluateReceipt(input) {
  const code = 'KSTACK_RECEIPT_EVALUATION_INVALID';
  exact(input, ['trustProfile', 'rowId', 'expectedCorrelation', 'dispatchAudit', 'producerProfile', 'providerEvidence', 'localEvidence', 'backgroundLifecycleAuditDigest', 'observerEvidence', 'integrityValid', 'revocation', 'possiblyActed', 'reconciliationEvidence'], code);
  const trust = validateReceiptTrustProfile(input.trustProfile); ascii(input.rowId, code); const row = trust.profile.rows.find((entry) => entry.rowId === input.rowId); if (!row) fail(code);
  const expected = validateCorrelation(input.expectedCorrelation, code); bool(input.integrityValid, code); bool(input.possiblyActed, code);
  const local = validateLocalEvidence(input.localEvidence, code); if (input.backgroundLifecycleAuditDigest !== null) digest(input.backgroundLifecycleAuditDigest, code);
  if (!Array.isArray(input.observerEvidence) || input.observerEvidence.length > 32) fail(code);
  const observers = input.observerEvidence.map((entry) => validateObserverEvidence(entry, code)); if (new Set(observers.map((entry) => entry.channelId)).size !== observers.length) fail(code);
  let reconciliation = null; const reconciliationInvalid = [];
  try { if (input.reconciliationEvidence !== null) reconciliation = validateReceiptReconciliationEvidence(input.reconciliationEvidence); } catch { reconciliationInvalid.push('KSTACK_RECEIPT_READBACK_EVIDENCE_INVALID'); }
  let dispatch = null; let provider = null; let producer = null; const invalidReasons = [];
  try { if (input.dispatchAudit !== null) dispatch = validateProtectedDispatchAudit(input.dispatchAudit); } catch { invalidReasons.push('KSTACK_RECEIPT_DISPATCH_AUDIT_INVALID'); }
  try { if (input.producerProfile !== null) producer = validateReceiptProducerProfile(input.producerProfile); } catch { invalidReasons.push('KSTACK_RECEIPT_PRODUCER_INVALID'); }
  try { if (input.providerEvidence !== null) provider = validateProviderReceiptEvidence(input.providerEvidence); } catch { invalidReasons.push('KSTACK_RECEIPT_PROVIDER_EVIDENCE_INVALID'); }
  if (input.revocation !== null) { try { validateReceiptRevocation(input.revocation); } catch { invalidReasons.push('KSTACK_RECEIPT_REVOCATION_INVALID'); } invalidReasons.push('KSTACK_RECEIPT_REVOKED'); }
  if (!input.integrityValid) invalidReasons.push('KSTACK_RECEIPT_INTEGRITY_INVALID');
  if (expected.operationId !== row.operationId || expected.operationClassId !== row.operationClassId || expected.activeSetDigest !== trust.profile.activeSetDigest) invalidReasons.push('KSTACK_RECEIPT_CORRELATION_PROFILE_MISMATCH');
  const expectedDigest = hostAddress('KSTACK-RECEIPT-CORRELATION-V1', expected);
  if (local?.preDispatchDenial && (local.evidence.schemaSetDigest !== trust.profile.schemaSetDigest
      || local.evidence.correlationDigest !== expectedDigest
      || local.evidence.preDispatchFenceDigest !== expected.fenceDigest
      || input.possiblyActed !== local.evidence.possiblyActed)) {
    invalidReasons.push('KSTACK_RECEIPT_PRE_DISPATCH_DENIAL_BINDING_INVALID');
  }
  if (dispatch && hostAddress('KSTACK-RECEIPT-CORRELATION-V1', dispatch.audit.correlation) !== expectedDigest) invalidReasons.push('KSTACK_RECEIPT_CORRELATION_MISMATCH');
  if (provider && hostAddress('KSTACK-RECEIPT-CORRELATION-V1', provider.evidence.correlation) !== expectedDigest) invalidReasons.push('KSTACK_RECEIPT_CORRELATION_MISMATCH');
  if ((producer === null) !== (provider === null)) invalidReasons.push('KSTACK_RECEIPT_PRODUCER_BINDING_INVALID');
  if (producer && provider) {
    if (producer.profileDigest !== provider.evidence.producerProfileDigest || !row.producerProfileDigests.includes(producer.profileDigest)
      || producer.profile.providerId !== provider.evidence.providerId || producer.profile.endpointIdentityDigest !== provider.evidence.endpointIdentityDigest
      || producer.profile.tenantDigest !== expected.tenantDigest || producer.profile.accountDigest !== expected.accountDigest
      || !row.admissibleReceiptKinds.includes(provider.evidence.receiptKind)) invalidReasons.push('KSTACK_RECEIPT_PRODUCER_BINDING_INVALID');
    if (dispatch && dispatch.audit.endpointIdentityDigest !== producer.profile.endpointIdentityDigest) invalidReasons.push('KSTACK_RECEIPT_ENDPOINT_MISMATCH');
    if (provider.evidence.assuranceLevel === 'CRYPTOGRAPHICALLY_SIGNED_PROVIDER_RECEIPT') {
      if (producer.profile.signedReceiptProfileDigest === null) invalidReasons.push('KSTACK_RECEIPT_SIGNATURE_PROFILE_REQUIRED');
    } else if (producer.profile.readBackProfileDigest === null || provider.evidence.readBackEvidenceDigest === null) invalidReasons.push('KSTACK_RECEIPT_READBACK_REQUIRED');
  }
  for (const observer of observers) if (!row.observerProfileDigests.includes(observer.profileDigest) || !row.admissibleReceiptKinds.includes(observer.receiptKind)) invalidReasons.push('KSTACK_RECEIPT_OBSERVER_UNQUALIFIED');
  invalidReasons.push(...reconciliationInvalid);
  if (reconciliation && (row.reconciliationProfileDigest === null || reconciliation.evidence.reconciliationProfileDigest !== row.reconciliationProfileDigest || reconciliation.evidence.correlationDigest !== expectedDigest)) invalidReasons.push('KSTACK_RECEIPT_READBACK_PROFILE_MISMATCH');
  if (invalidReasons.length) return outcome('INVALID', invalidReasons);

  const facts = [];
  if (local) facts.push({ statusId: local.evidence.statusId, factSetDigest: local.evidence.factSetDigest });
  if (provider) facts.push({ statusId: provider.evidence.providerStatusId, factSetDigest: provider.evidence.canonicalFactSetDigest });
  if (reconciliation) facts.push({ statusId: reconciliation.evidence.statusId, factSetDigest: reconciliation.evidence.factSetDigest });
  observers.forEach((entry) => facts.push({ statusId: entry.statusId, factSetDigest: entry.factSetDigest }));
  const mapped = facts.map((fact) => ({ ...fact, evaluation: row.terminalMappings.find((entry) => entry.providerStatusId === fact.statusId)?.evaluation ?? null }));
  const terminalOutcomes = new Set(mapped.map((fact) => fact.evaluation).filter(Boolean));
  const terminalFactSets = new Set(mapped.filter((fact) => fact.evaluation !== null).map((fact) => `${fact.evaluation}\0${fact.factSetDigest}`));
  if (terminalOutcomes.size > 1 || terminalFactSets.size > 1) return outcome('CONTRADICTORY', ['KSTACK_RECEIPT_CONTRADICTORY']);

  const effectiveClass = row.operationClassId === 'BACKGROUND' ? row.underlyingClassId : row.operationClassId; const ambiguousReasons = [];
  if (mapped.some((fact) => fact.evaluation === null)) ambiguousReasons.push('KSTACK_RECEIPT_STATUS_UNMAPPED');
  if (reconciliation && !reconciliation.evidence.complete) ambiguousReasons.push('KSTACK_RECEIPT_READBACK_INCOMPLETE');
  if (mapped.some((fact) => fact.statusId === 'not-found') && !(reconciliation && reconciliation.evidence.complete && reconciliation.evidence.authoritativeNegative && reconciliation.evidence.visibilityWindowElapsed)) ambiguousReasons.push('KSTACK_RECEIPT_NOT_FOUND_NONAUTHORITATIVE');
  if (EXTERNAL_CLASSES.includes(effectiveClass) && input.possiblyActed && (!dispatch || (!provider && !reconciliation))) ambiguousReasons.push('KSTACK_RECEIPT_OUTCOME_AMBIGUOUS');
  if (ambiguousReasons.length) return outcome('AMBIGUOUS', ambiguousReasons);

  const preDispatchDenial = EXTERNAL_CLASSES.includes(effectiveClass) && !input.possiblyActed && !dispatch && !provider && !reconciliation
    && local?.preDispatchDenial === true && row.admissibleReceiptKinds.includes(local.evidence.receiptKind)
    && terminalOutcomes.size === 1 && terminalOutcomes.has('PROVEN_DENIED');
  const unavailableReasons = [];
  if (row.operationClassId === 'BACKGROUND' && input.backgroundLifecycleAuditDigest === null) unavailableReasons.push('KSTACK_RECEIPT_BACKGROUND_AUDIT_REQUIRED');
  if (['LOCAL_READ', 'ADVISORY'].includes(effectiveClass) && !local) unavailableReasons.push('KSTACK_RECEIPT_LOCAL_AUDIT_REQUIRED');
  if (effectiveClass === 'LOCAL_WRITE' && !local) unavailableReasons.push('KSTACK_RECEIPT_MUTATION_EVIDENCE_REQUIRED');
  if (EXTERNAL_CLASSES.includes(effectiveClass) && !preDispatchDenial) {
    if (!dispatch) unavailableReasons.push('KSTACK_RECEIPT_DISPATCH_AUDIT_REQUIRED');
    if (!provider && !reconciliation) unavailableReasons.push('KSTACK_RECEIPT_PROVIDER_EVIDENCE_REQUIRED');
  }
  const groups = new Set();
  if (local) groups.add(local.preDispatchDenial ? 'protected-pre-dispatch-denial' : 'protected-local'); if (input.backgroundLifecycleAuditDigest !== null) groups.add('protected-lifecycle');
  if (dispatch) groups.add('protected-dispatch'); if (provider || reconciliation) groups.add('provider-primary');
  observers.forEach((entry) => groups.add(`observer:${entry.independenceGroupId}`));
  const requiredChannels = preDispatchDenial ? row.minimumPreDispatchDenialChannels : row.minimumIndependentChannels;
  if (groups.size < requiredChannels) unavailableReasons.push('KSTACK_RECEIPT_CHANNELS_INSUFFICIENT');
  if (unavailableReasons.length) return outcome('UNAVAILABLE', unavailableReasons);
  if (terminalOutcomes.size !== 1) return outcome(input.possiblyActed ? 'AMBIGUOUS' : 'UNAVAILABLE', [input.possiblyActed ? 'KSTACK_RECEIPT_OUTCOME_AMBIGUOUS' : 'KSTACK_RECEIPT_TERMINAL_EVIDENCE_REQUIRED']);
  return outcome([...terminalOutcomes][0]);
}

export function validateReceiptRevocation(value) {
  const code = 'KSTACK_RECEIPT_REVOCATION_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'producerProfileDigest', 'keyDigest', 'invalidFrom', 'reasonCode', 'evidenceEpoch', 'protectedAnchorDigest'], code);
  if (value.schemaId !== 'kstack.receipt-revocation.v1' || value.schemaVersion !== 1) fail(code);
  for (const key of ['schemaSetDigest', 'producerProfileDigest', 'protectedAnchorDigest']) digest(value[key], code);
  if (value.keyDigest !== null) digest(value.keyDigest, code); timestamp(value.invalidFrom, code); stableCode(value.reasonCode, code); uint(value.evidenceEpoch, Number.MAX_SAFE_INTEGER, true, code);
  return immutable({ revocation: value, revocationDigest: hostAddress('KSTACK-RECEIPT-REVOCATION-V1', value) });
}

export function deriveReceiptRetention(value) {
  const code = 'KSTACK_RECEIPT_RETENTION_INVALID'; exact(value, ['providerWindowMs', 'ambiguityRetentionMs', 'auditRetentionMs', 'profileRetentionMs', 'unresolved'], code);
  for (const key of ['providerWindowMs', 'ambiguityRetentionMs', 'auditRetentionMs', 'profileRetentionMs']) uint(value[key], Number.MAX_SAFE_INTEGER, true, code);
  bool(value.unresolved, code); return immutable({ retentionMs: Math.max(value.providerWindowMs, value.ambiguityRetentionMs, value.auditRetentionMs, value.profileRetentionMs), rawBodyArchivalAllowed: !value.unresolved, sameEffectRetryEligible: false });
}

export function createReceiptTombstone(value) {
  const code = 'KSTACK_RECEIPT_TOMBSTONE_INVALID'; exact(value, ['schemaSetDigest', 'operationReceiptDigest', 'correlationDigest', 'terminalEvaluation', 'trustClosureDigest', 'retainedFactSetDigest', 'archivedRawBodyDigest', 'createdAt'], code);
  for (const key of ['schemaSetDigest', 'operationReceiptDigest', 'correlationDigest', 'trustClosureDigest', 'retainedFactSetDigest']) digest(value[key], code);
  if (value.archivedRawBodyDigest !== null) digest(value.archivedRawBodyDigest, code); enumeration(value.terminalEvaluation, RECEIPT_EVALUATIONS, code); timestamp(value.createdAt, code);
  if (['AMBIGUOUS', 'CONTRADICTORY'].includes(value.terminalEvaluation) && value.archivedRawBodyDigest !== null) fail(code);
  const tombstone = immutable({ schemaId: 'kstack.receipt-tombstone.v1', schemaVersion: 1, ...value, replayDisposition: 'SAME_EFFECT_REDISPATCH_BLOCKED' });
  return immutable({ tombstone, tombstoneDigest: hostAddress('KSTACK-RECEIPT-TOMBSTONE-V1', tombstone) });
}

export function createOperationReceipt(input) {
  const code = 'KSTACK_OPERATION_RECEIPT_INVALID';
  exact(input, ['schemaSetDigest', 'trustProfileDigest', 'profileRowId', 'correlationDigest', 'operationClassId', 'underlyingClassId', 'resultDigest', 'evaluationDigest', 'evaluation', 'dispatchAuditDigest', 'producerReceiptDigest', 'localAuditDigest', 'preDispatchDenialEvidenceDigest', 'backgroundLifecycleAuditDigest', 'observerEvidenceDigests', 'retentionMs', 'expiresAt', 'createdAt'], code);
  for (const key of ['schemaSetDigest', 'trustProfileDigest', 'correlationDigest', 'resultDigest', 'evaluationDigest']) digest(input[key], code);
  ascii(input.profileRowId, code); enumeration(input.operationClassId, RECEIPT_OPERATION_CLASSES, code); enumeration(input.evaluation, RECEIPT_EVALUATIONS, code);
  if (input.operationClassId === 'BACKGROUND') enumeration(input.underlyingClassId, RECEIPT_OPERATION_CLASSES.filter((entry) => entry !== 'BACKGROUND'), code); else if (input.underlyingClassId !== null) fail(code);
  for (const key of ['dispatchAuditDigest', 'producerReceiptDigest', 'localAuditDigest', 'preDispatchDenialEvidenceDigest', 'backgroundLifecycleAuditDigest']) if (input[key] !== null) digest(input[key], code);
  sortedUnique(input.observerEvidenceDigests, digest, 0, 32, code); uint(input.retentionMs, Number.MAX_SAFE_INTEGER, true, code); timestamp(input.expiresAt, code); timestamp(input.createdAt, code); if (input.createdAt >= input.expiresAt) fail(code);
  const effectiveClass = input.operationClassId === 'BACKGROUND' ? input.underlyingClassId : input.operationClassId;
  if ((input.operationClassId === 'BACKGROUND') !== (input.backgroundLifecycleAuditDigest !== null)) fail(code);
  if (EXTERNAL_CLASSES.includes(effectiveClass)) {
    const providerPath = input.dispatchAuditDigest !== null && input.producerReceiptDigest !== null
      && input.localAuditDigest === null && input.preDispatchDenialEvidenceDigest === null;
    const localDenialPath = input.evaluation === 'PROVEN_DENIED' && input.dispatchAuditDigest === null
      && input.producerReceiptDigest === null && input.localAuditDigest !== null
      && input.preDispatchDenialEvidenceDigest !== null;
    if (input.evaluation.startsWith('PROVEN_')) { if (!providerPath && !localDenialPath) fail(code); }
    else if (input.preDispatchDenialEvidenceDigest !== null || (input.producerReceiptDigest !== null && input.dispatchAuditDigest === null)) fail(code);
  }
  else if (['LOCAL_READ', 'LOCAL_WRITE'].includes(effectiveClass)) { if (input.localAuditDigest === null || input.preDispatchDenialEvidenceDigest !== null || input.dispatchAuditDigest !== null || input.producerReceiptDigest !== null) fail(code); }
  else if (effectiveClass === 'ADVISORY') { if (input.localAuditDigest === null || input.preDispatchDenialEvidenceDigest !== null || ((input.dispatchAuditDigest === null) !== (input.producerReceiptDigest === null))) fail(code); }
  const receipt = immutable({ schemaId: 'kstack.operation-receipt.v1', schemaVersion: 1, ...input });
  return immutable({ receipt, receiptDigest: hostAddress('KSTACK-OPERATION-RECEIPT-V1', receipt) });
}

function validateProtectedReceiptBackend(backend, allowTestBackend) {
  exact(backend, ['descriptor', 'append', 'classifyQuery', 'queryReadOnly', 'releaseResult'], 'KSTACK_RECEIPT_BACKEND_INVALID');
  exact(backend.descriptor, ['protectionClass', 'repositoryWritable', 'agentWritable', 'durableLedger', 'queryEffectClassification', 'actionEndpointsRejected'], 'KSTACK_RECEIPT_BACKEND_INVALID');
  const classes = ['os-protected', 'qualified-service']; if (allowTestBackend) classes.push('test-only');
  if (!classes.includes(backend.descriptor.protectionClass) || backend.descriptor.repositoryWritable !== false || backend.descriptor.agentWritable !== false
    || backend.descriptor.durableLedger !== true || backend.descriptor.queryEffectClassification !== 'READ_ONLY_QUERY' || backend.descriptor.actionEndpointsRejected !== true
    || ['append', 'classifyQuery', 'queryReadOnly', 'releaseResult'].some((key) => typeof backend[key] !== 'function')) fail('KSTACK_RECEIPT_BACKEND_INVALID');
  return backend;
}

export class ProtectedReceiptKernel {
  #schemaSetDigest; #backend;
  constructor(options) {
    exact(options, ['schemaSetDigest', 'backend', 'allowTestBackend'], 'KSTACK_RECEIPT_BACKEND_INVALID');
    this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_RECEIPT_BACKEND_INVALID'); this.#backend = validateProtectedReceiptBackend(options.backend, options.allowTestBackend === true);
  }
  async reconcile(input) {
    exact(input, ['profile', 'correlation', 'serializedQueryDigest'], 'KSTACK_RECEIPT_READBACK_UNQUALIFIED'); const profile = validateReceiptReconciliationProfile(input.profile);
    const correlation = validateCorrelation(input.correlation, 'KSTACK_RECEIPT_READBACK_UNQUALIFIED'); digest(input.serializedQueryDigest, 'KSTACK_RECEIPT_READBACK_UNQUALIFIED');
    if (profile.profile.schemaSetDigest !== this.#schemaSetDigest || profile.profile.producerProfileDigest !== correlation.producerProfileDigest) fail('KSTACK_RECEIPT_READBACK_UNQUALIFIED');
    const classification = await this.#backend.classifyQuery(immutable({ endpointIdentityDigest: profile.profile.endpointIdentityDigest, methodId: profile.profile.methodId, serializedQueryDigest: input.serializedQueryDigest }));
    exact(classification, ['effectClassification', 'endpointIdentityDigest', 'methodId', 'serializedQueryDigest', 'qualified'], 'KSTACK_RECEIPT_READBACK_UNQUALIFIED');
    bool(classification.qualified, 'KSTACK_RECEIPT_READBACK_UNQUALIFIED');
    if (!classification.qualified || classification.effectClassification !== 'READ_ONLY_QUERY' || classification.endpointIdentityDigest !== profile.profile.endpointIdentityDigest || classification.methodId !== profile.profile.methodId || classification.serializedQueryDigest !== input.serializedQueryDigest) fail('KSTACK_RECEIPT_READBACK_UNQUALIFIED');
    const queryClassificationDigest = hostAddress('KSTACK-RECEIPT-QUERY-CLASSIFICATION-V1', classification);
    const started = await this.#backend.append(immutable({ event: 'RECONCILIATION_QUERY_STARTED', reconciliationProfileDigest: profile.profileDigest, correlationDigest: hostAddress('KSTACK-RECEIPT-CORRELATION-V1', correlation), serializedQueryDigest: input.serializedQueryDigest })); digest(started, 'KSTACK_RECEIPT_LEDGER_INVALID');
    const observation = await this.#backend.queryReadOnly(immutable({ profile: profile.profile, correlation, serializedQueryDigest: input.serializedQueryDigest }));
    exact(observation, ['statusId', 'complete', 'authoritativeNegative', 'visibilityWindowElapsed', 'factSetDigest', 'responseDigest', 'observedAt'], 'KSTACK_RECEIPT_READBACK_INVALID'); ascii(observation.statusId, 'KSTACK_RECEIPT_READBACK_INVALID'); bool(observation.complete, 'KSTACK_RECEIPT_READBACK_INVALID'); bool(observation.authoritativeNegative, 'KSTACK_RECEIPT_READBACK_INVALID'); bool(observation.visibilityWindowElapsed, 'KSTACK_RECEIPT_READBACK_INVALID'); digest(observation.factSetDigest, 'KSTACK_RECEIPT_READBACK_INVALID'); digest(observation.responseDigest, 'KSTACK_RECEIPT_READBACK_INVALID'); timestamp(observation.observedAt, 'KSTACK_RECEIPT_READBACK_INVALID');
    const completed = await this.#backend.append(immutable({ event: 'RECONCILIATION_QUERY_COMPLETED', reconciliationProfileDigest: profile.profileDigest, statusId: observation.statusId, complete: observation.complete, factSetDigest: observation.factSetDigest, responseDigest: observation.responseDigest })); digest(completed, 'KSTACK_RECEIPT_LEDGER_INVALID');
    const reconciliationEvidence = validateReceiptReconciliationEvidence({
      schemaId: 'kstack.receipt-reconciliation-evidence.v1', schemaVersion: 1, schemaSetDigest: this.#schemaSetDigest,
      reconciliationProfileDigest: profile.profileDigest, correlationDigest: hostAddress('KSTACK-RECEIPT-CORRELATION-V1', correlation),
      queryClassificationDigest, startedLedgerReceiptDigest: started, completedLedgerReceiptDigest: completed,
      effectClassification: 'READ_ONLY_QUERY', statusId: observation.statusId, factSetDigest: observation.factSetDigest,
      responseDigest: observation.responseDigest, complete: observation.complete, authoritativeNegative: observation.authoritativeNegative,
      visibilityWindowElapsed: observation.visibilityWindowElapsed, observedAt: observation.observedAt
    });
    return immutable({ observation, reconciliationEvidence: reconciliationEvidence.evidence, reconciliationEvidenceDigest: reconciliationEvidence.evidenceDigest, startedReceiptDigest: started, completedReceiptDigest: completed });
  }
  async finalize(input) {
    exact(input, ['evaluationInput', 'operationReceiptInput'], 'KSTACK_RECEIPT_EVALUATION_INVALID'); const result = evaluateReceipt(input.evaluationInput);
    const correlationDigest = hostAddress('KSTACK-RECEIPT-CORRELATION-V1', input.evaluationInput.expectedCorrelation);
    const trust = validateReceiptTrustProfile(input.evaluationInput.trustProfile); const row = trust.profile.rows.find((entry) => entry.rowId === input.evaluationInput.rowId);
    const dispatchDigest = input.evaluationInput.dispatchAudit === null ? null : validateProtectedDispatchAudit(input.evaluationInput.dispatchAudit).auditDigest;
    const producerDigest = input.evaluationInput.providerEvidence === null
      ? (input.evaluationInput.reconciliationEvidence === null ? null : validateReceiptReconciliationEvidence(input.evaluationInput.reconciliationEvidence).evidenceDigest)
      : validateProviderReceiptEvidence(input.evaluationInput.providerEvidence).evidenceDigest;
    const localEvidence = validateLocalEvidence(input.evaluationInput.localEvidence, 'KSTACK_RECEIPT_EVALUATION_INVALID');
    const localDigest = localEvidence?.evidence.localAuditDigest ?? null;
    const preDispatchDenialEvidenceDigest = localEvidence?.preDispatchDenial ? localEvidence.evidenceDigest : null;
    const observerDigests = input.evaluationInput.observerEvidence.map((entry) => hostAddress('KSTACK-RECEIPT-OBSERVER-EVIDENCE-V1', entry)).sort();
    if (!row || input.operationReceiptInput.trustProfileDigest !== trust.profileDigest || input.operationReceiptInput.profileRowId !== row.rowId || input.operationReceiptInput.correlationDigest !== correlationDigest
      || input.operationReceiptInput.operationClassId !== row.operationClassId || input.operationReceiptInput.underlyingClassId !== row.underlyingClassId
      || input.operationReceiptInput.dispatchAuditDigest !== dispatchDigest || input.operationReceiptInput.producerReceiptDigest !== producerDigest
      || input.operationReceiptInput.localAuditDigest !== localDigest
      || input.operationReceiptInput.preDispatchDenialEvidenceDigest !== preDispatchDenialEvidenceDigest
      || input.operationReceiptInput.backgroundLifecycleAuditDigest !== input.evaluationInput.backgroundLifecycleAuditDigest
      || JSON.stringify(input.operationReceiptInput.observerEvidenceDigests) !== JSON.stringify(observerDigests)) fail('KSTACK_OPERATION_RECEIPT_BINDING_INVALID');
    const evaluation = immutable({ schemaId: 'kstack.receipt-evaluation.v1', schemaVersion: 1, schemaSetDigest: this.#schemaSetDigest, correlationDigest, evaluation: result.evaluation, reasonCodes: result.reasonCodes });
    const evaluationDigest = hostAddress('KSTACK-RECEIPT-EVALUATION-V1', evaluation);
    const operationReceipt = createOperationReceipt({ ...input.operationReceiptInput, schemaSetDigest: this.#schemaSetDigest, evaluationDigest, evaluation: result.evaluation });
    const ledgerReceipt = await this.#backend.append(immutable({ event: 'OPERATION_RECEIPT_FINALIZED', evaluationDigest, operationReceiptDigest: operationReceipt.receiptDigest, evaluation: result.evaluation })); digest(ledgerReceipt, 'KSTACK_RECEIPT_LEDGER_INVALID');
    const base = { evaluation, evaluationDigest, operationReceipt: operationReceipt.receipt, operationReceiptDigest: operationReceipt.receiptDigest, protectedLedgerReceiptDigest: ledgerReceipt };
    if (!result.evaluation.startsWith('PROVEN_')) return immutable({ ...base, released: false });
    const releaseReceipt = await this.#backend.releaseResult(immutable({ resultDigest: operationReceipt.receipt.resultDigest, evaluationDigest, operationReceiptDigest: operationReceipt.receiptDigest })); digest(releaseReceipt, 'KSTACK_RECEIPT_RELEASE_INVALID');
    return immutable({ ...base, releaseReceiptDigest: releaseReceipt, released: true });
  }
}
