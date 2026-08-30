import {
  artifactHead,
  assertAsciiId,
  assertDigest,
  assertRegistryId,
  assertSafeUInt,
  assertTimestamp,
  hostAddress,
  hostCanonicalBytes,
  validateHostArtifact
} from './kstack-host-contract.mjs';
import {
  EVIDENCE_IDENTITIES,
  EVIDENCE_OUTCOMES,
  validateEvidenceAdmissionSnapshot,
  validateEvidenceEvaluation,
  validateProtectedEvidenceBackend
} from './kstack-host-evidence.mjs';

export class HostEligibilityError extends Error {
  constructor(code) { super(code); this.name = 'HostEligibilityError'; this.code = code; }
}

function fail(code) { throw new HostEligibilityError(code); }
function exact(value, keys, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function digest(value, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') { try { return assertAsciiId(value); } catch { fail(code); } }
function registry(value, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') { try { return assertRegistryId(value); } catch { fail(code); } }
function uint(value, positive = false, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') { try { return assertSafeUInt(value, positive); } catch { fail(code); } }
function timestamp(value, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') { try { return assertTimestamp(value); } catch { fail(code); } }
function enumeration(value, allowed, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') { if (!allowed.includes(value)) fail(code); return value; }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}
function sortedUnique(values, validator, minimum = 0, maximum = 256, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((entry) => validator(entry, code));
  if (new Set(values).size !== values.length || values.some((entry, index) => index > 0 && entry <= values[index - 1])) fail(code);
  return values;
}

export const ELIGIBILITY_STATUSES = Object.freeze(['FULL', 'DEGRADED_REGISTERED', 'UNSUPPORTED', 'QUARANTINED']);
export const ELIGIBILITY_REASON_CODES = Object.freeze([
  'KSTACK_ELIGIBILITY_INPUT_INVALID', 'KSTACK_ELIGIBILITY_CONTEXT_MISMATCH',
  'KSTACK_ELIGIBILITY_POLICY_DENIED', 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE',
  'KSTACK_ELIGIBILITY_EVIDENCE_INVALID', 'KSTACK_ELIGIBILITY_EVIDENCE_CONTRADICTORY',
  'KSTACK_ELIGIBILITY_EVIDENCE_STALE', 'KSTACK_ELIGIBILITY_EVIDENCE_UNAVAILABLE',
  'KSTACK_ELIGIBILITY_REQUIREMENT_MISSING', 'KSTACK_ELIGIBILITY_NEGATIVE_FIXTURE_FAILED',
  'KSTACK_ELIGIBILITY_ALTERNATE_NOT_REGISTERED', 'KSTACK_ELIGIBILITY_ALTERNATE_AMBIGUOUS',
  'KSTACK_ELIGIBILITY_ALTERNATE_NOT_PROVEN', 'KSTACK_ELIGIBILITY_REVOKED',
  'KSTACK_ELIGIBILITY_QUARANTINED', 'KSTACK_ELIGIBILITY_EPOCH_CHANGED',
  'KSTACK_ELIGIBILITY_EXPIRED', 'KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE',
  'KSTACK_ELIGIBILITY_PROTECTED_STATE_CORRUPT'
]);

const IDENTITY_NAMES = [
  'EligibilityInputSnapshotV1', 'EligibilityPolicyV1', 'EligibilityEvaluationV1',
  'QuarantineResolutionV1', 'EligibilityInvalidationV1'
];
export const ELIGIBILITY_IDENTITIES = immutable(Object.fromEntries(IDENTITY_NAMES.map((name) => {
  const stem = name.replace(/V1$/u, '').replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();
  return [name, { schemaId: `kstack.${stem}.v1`, schemaVersion: 1, domain: `KSTACK-${stem.toUpperCase()}-V1` }];
})));

export function eligibilityHead(name, schemaSetDigest) {
  const identity = ELIGIBILITY_IDENTITIES[name];
  if (!identity) fail('KSTACK_ELIGIBILITY_INPUT_INVALID');
  return immutable({ schemaId: identity.schemaId, schemaVersion: 1, schemaSetDigest: digest(schemaSetDigest) });
}

function validateHead(value, name) {
  const identity = ELIGIBILITY_IDENTITIES[name];
  if (value.schemaId !== identity.schemaId || value.schemaVersion !== 1) fail('KSTACK_ELIGIBILITY_INPUT_INVALID');
  digest(value.schemaSetDigest);
}

export function validateEligibilityInputSnapshot(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'operationId', 'requirementProfileDigest',
    'trustedRequestContextDigest', 'operationClassId', 'evidenceAdmissionSnapshotDigest',
    'evidenceEvaluationDigest', 'activeSetDigest', 'policyDigest', 'eligibilityPolicyDigest',
    'quarantineHeadDigest', 'revocationSequence', 'evidenceEpoch', 'eligibilityEpoch',
    'trustedTimeSampleDigest', 'evaluatedAt'
  ]);
  validateHead(value, 'EligibilityInputSnapshotV1');
  ascii(value.operationId); ascii(value.operationClassId);
  for (const field of [
    'requirementProfileDigest', 'trustedRequestContextDigest', 'evidenceAdmissionSnapshotDigest',
    'evidenceEvaluationDigest', 'activeSetDigest', 'policyDigest', 'eligibilityPolicyDigest',
    'quarantineHeadDigest', 'trustedTimeSampleDigest'
  ]) digest(value[field]);
  uint(value.revocationSequence); uint(value.evidenceEpoch, true); uint(value.eligibilityEpoch, true);
  timestamp(value.evaluatedAt);
  return immutable(value);
}

function validatePolicyRow(value) {
  exact(value, [
    'operationId', 'operationClassId', 'requirementProfileDigest', 'absoluteDeny',
    'permittedHostDigests', 'permittedPlatformDigests', 'requiredReasonCodes', 'forbiddenReasonCodes',
    'alternatePermission', 'orderedAlternateProfileIds', 'alternateRegistrations', 'alternateEligibleReasonCodes',
    'maximumResultLifetimeMs', 'policyEpoch'
  ], 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  ascii(value.operationId, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  ascii(value.operationClassId, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  digest(value.requirementProfileDigest, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  if (typeof value.absoluteDeny !== 'boolean' || typeof value.alternatePermission !== 'boolean') fail('KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  sortedUnique(value.permittedHostDigests, digest, 1, 256, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  sortedUnique(value.permittedPlatformDigests, digest, 1, 256, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  sortedUnique(value.requiredReasonCodes, registry, 0, 128, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  sortedUnique(value.forbiddenReasonCodes, registry, 0, 128, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  if (!Array.isArray(value.orderedAlternateProfileIds) || value.orderedAlternateProfileIds.length > 32) fail('KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  const alternateIds = value.orderedAlternateProfileIds.map((entry) => ascii(entry, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE'));
  if (new Set(alternateIds).size !== alternateIds.length) fail('KSTACK_ELIGIBILITY_ALTERNATE_AMBIGUOUS');
  if (!Array.isArray(value.alternateRegistrations) || value.alternateRegistrations.length > 32) fail('KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  value.alternateRegistrations.forEach((entry) => {
    exact(entry, ['profileId', 'requirementProfileDigest', 'maximumStatus', 'semanticEffectSubsetProofDigest', 'authorityCeilingDigest'], 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
    ascii(entry.profileId, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
    digest(entry.requirementProfileDigest, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
    digest(entry.semanticEffectSubsetProofDigest, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
    digest(entry.authorityCeilingDigest, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
    if (entry.maximumStatus !== 'DEGRADED_REGISTERED') fail('KSTACK_ELIGIBILITY_ALTERNATE_NOT_REGISTERED');
  });
  const registrationIds = value.alternateRegistrations.map((entry) => entry.profileId);
  if (new Set(registrationIds).size !== registrationIds.length
      || registrationIds.length !== alternateIds.length || registrationIds.some((entry) => !alternateIds.includes(entry))) {
    fail('KSTACK_ELIGIBILITY_ALTERNATE_AMBIGUOUS');
  }
  sortedUnique(value.alternateEligibleReasonCodes, registry, 0, 64, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  uint(value.maximumResultLifetimeMs, true, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  uint(value.policyEpoch, true, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  return value;
}

export function validateEligibilityPolicy(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'activeSetDigest', 'basePolicyDigest',
    'repositoryPolicyDigest', 'operationRows', 'expiresAt'
  ], 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  validateHead(value, 'EligibilityPolicyV1');
  digest(value.activeSetDigest, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  digest(value.basePolicyDigest, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  if (value.repositoryPolicyDigest !== null) digest(value.repositoryPolicyDigest, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  if (!Array.isArray(value.operationRows) || value.operationRows.length < 1 || value.operationRows.length > 256) fail('KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  value.operationRows.forEach(validatePolicyRow);
  const operationIds = value.operationRows.map((entry) => entry.operationId);
  if (new Set(operationIds).size !== operationIds.length || operationIds.some((entry, index) => index > 0 && entry <= operationIds[index - 1])) {
    fail('KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  }
  timestamp(value.expiresAt, 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  return immutable(value);
}

function validateCapabilityPartition(value, code = 'KSTACK_ELIGIBILITY_INPUT_INVALID') {
  exact(value, ['provenCapabilityIds', 'missingCapabilityIds'], code);
  sortedUnique(value.provenCapabilityIds, ascii, 0, 256, code);
  sortedUnique(value.missingCapabilityIds, ascii, 0, 256, code);
  if (value.provenCapabilityIds.some((entry) => value.missingCapabilityIds.includes(entry))) fail(code);
  return value;
}

function validateAlternate(value) {
  exact(value, [
    'profileId', 'requirementProfileDigest', 'independentEvidenceOutcome', 'partition', 'reasonCodes', 'expiresAt'
  ]);
  ascii(value.profileId); digest(value.requirementProfileDigest);
  enumeration(value.independentEvidenceOutcome, EVIDENCE_OUTCOMES);
  validateCapabilityPartition(value.partition);
  sortedUnique(value.reasonCodes, registry, 0, 128);
  timestamp(value.expiresAt);
  return value;
}

function mappedEvidenceReason(outcome) {
  return {
    INVALID: 'KSTACK_ELIGIBILITY_EVIDENCE_INVALID',
    CONTRADICTORY: 'KSTACK_ELIGIBILITY_EVIDENCE_CONTRADICTORY',
    STALE: 'KSTACK_ELIGIBILITY_EVIDENCE_STALE',
    UNAVAILABLE: 'KSTACK_ELIGIBILITY_EVIDENCE_UNAVAILABLE'
  }[outcome] || null;
}

function statusFromReasons(reasons) {
  if (reasons.some((code) => [
    'KSTACK_ELIGIBILITY_INPUT_INVALID', 'KSTACK_ELIGIBILITY_CONTEXT_MISMATCH',
    'KSTACK_ELIGIBILITY_EVIDENCE_INVALID', 'KSTACK_ELIGIBILITY_EVIDENCE_CONTRADICTORY',
    'KSTACK_ELIGIBILITY_REVOKED', 'KSTACK_ELIGIBILITY_QUARANTINED',
    'KSTACK_ELIGIBILITY_PROTECTED_STATE_CORRUPT', 'KSTACK_ELIGIBILITY_NEGATIVE_FIXTURE_FAILED'
  ].includes(code))) return 'QUARANTINED';
  return 'UNSUPPORTED';
}

export function evaluateOperationEligibility(input) {
  exact(input, [
    'snapshot', 'policy', 'requirementProfile', 'evidenceAdmissionSnapshot', 'evidenceEvaluation', 'primaryPartition',
    'primaryReasonCodes', 'alternates', 'activeQuarantines', 'hostDigest', 'platformDigest',
    'contextBindings', 'expiryCandidates', 'vocabulary'
  ]);
  const snapshot = validateEligibilityInputSnapshot(input.snapshot);
  const policy = validateEligibilityPolicy(input.policy);
  const evidenceAdmission = validateEvidenceAdmissionSnapshot(input.evidenceAdmissionSnapshot);
  const evidenceEvaluation = validateEvidenceEvaluation(input.evidenceEvaluation);
  enumeration(evidenceEvaluation.outcome, EVIDENCE_OUTCOMES);
  validateCapabilityPartition(input.primaryPartition);
  sortedUnique(input.primaryReasonCodes, registry, 0, 128);
  digest(input.hostDigest); digest(input.platformDigest);
  exact(input.contextBindings, [
    'operationId', 'operationClassId', 'requirementProfileDigest', 'activeSetDigest', 'policyDigest',
    'evidenceAdmissionSnapshotDigest', 'evidenceEvaluationDigest', 'revocationSequence', 'evidenceEpoch', 'eligibilityEpoch'
  ]);
  ascii(input.contextBindings.operationId); ascii(input.contextBindings.operationClassId);
  for (const field of ['requirementProfileDigest', 'activeSetDigest', 'policyDigest', 'evidenceAdmissionSnapshotDigest', 'evidenceEvaluationDigest']) digest(input.contextBindings[field]);
  uint(input.contextBindings.revocationSequence); uint(input.contextBindings.evidenceEpoch, true); uint(input.contextBindings.eligibilityEpoch, true);
  exact(input.requirementProfile, ['operationId', 'operationClassId', 'requirementProfileDigest', 'capabilityIds', 'alternateProfileIds']);
  ascii(input.requirementProfile.operationId); ascii(input.requirementProfile.operationClassId); digest(input.requirementProfile.requirementProfileDigest);
  sortedUnique(input.requirementProfile.capabilityIds, ascii, 0, 256);
  sortedUnique(input.requirementProfile.alternateProfileIds, ascii, 0, 32);
  if (!Array.isArray(input.alternates) || !Array.isArray(input.activeQuarantines) || !Array.isArray(input.expiryCandidates)) fail('KSTACK_ELIGIBILITY_INPUT_INVALID');
  input.alternates.forEach(validateAlternate);
  sortedUnique(input.activeQuarantines, digest, 0, 256);
  input.expiryCandidates.forEach((entry) => timestamp(entry));
  const reasons = new Set();
  const trace = [];
  const eligibilityPolicyDigest = hostAddress(ELIGIBILITY_IDENTITIES.EligibilityPolicyV1.domain, policy);
  const evidenceAdmissionDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceAdmissionSnapshotV1.domain, evidenceAdmission);
  const evidenceEvaluationDigest = hostAddress(EVIDENCE_IDENTITIES.EvidenceEvaluationV1.domain, evidenceEvaluation);
  const bindingFields = ['operationId', 'operationClassId', 'requirementProfileDigest', 'activeSetDigest', 'policyDigest', 'evidenceAdmissionSnapshotDigest', 'evidenceEvaluationDigest', 'revocationSequence', 'evidenceEpoch', 'eligibilityEpoch'];
  if (bindingFields.some((field) => snapshot[field] !== input.contextBindings[field])
      || snapshot.operationId !== input.requirementProfile.operationId
      || snapshot.operationClassId !== input.requirementProfile.operationClassId
      || snapshot.requirementProfileDigest !== input.requirementProfile.requirementProfileDigest
      || snapshot.eligibilityPolicyDigest !== eligibilityPolicyDigest
      || snapshot.evidenceAdmissionSnapshotDigest !== evidenceAdmissionDigest
      || snapshot.evidenceEvaluationDigest !== evidenceEvaluationDigest
      || evidenceAdmission.evaluationDigest !== evidenceEvaluationDigest
      || evidenceAdmission.requirementProfileDigest !== snapshot.requirementProfileDigest
      || evidenceAdmission.activeSetDigest !== snapshot.activeSetDigest
      || evidenceAdmission.policyDigest !== snapshot.policyDigest
      || evidenceAdmission.revocationSequence !== snapshot.revocationSequence
      || evidenceAdmission.evidenceEpoch !== snapshot.evidenceEpoch
      || evidenceAdmission.trustedTimeSampleDigest !== snapshot.trustedTimeSampleDigest
      || policy.activeSetDigest !== snapshot.activeSetDigest) reasons.add('KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
  const policyRow = policy.operationRows.find((entry) => entry.operationId === snapshot.operationId);
  if (!policyRow) reasons.add('KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE');
  else if (policyRow.operationClassId !== snapshot.operationClassId || policyRow.requirementProfileDigest !== snapshot.requirementProfileDigest) reasons.add('KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
  if (input.activeQuarantines.length > 0) reasons.add('KSTACK_ELIGIBILITY_QUARANTINED');
  const evidenceReason = mappedEvidenceReason(evidenceEvaluation.outcome);
  if (evidenceReason) reasons.add(evidenceReason);
  for (const reason of input.primaryReasonCodes) reasons.add(reason);
  if (policyRow) {
    if (policyRow.absoluteDeny || !policyRow.permittedHostDigests.includes(input.hostDigest)
        || !policyRow.permittedPlatformDigests.includes(input.platformDigest)) reasons.add('KSTACK_ELIGIBILITY_POLICY_DENIED');
    for (const required of policyRow.requiredReasonCodes) if (!evidenceEvaluation.reasonCodes.includes(required)) reasons.add('KSTACK_ELIGIBILITY_POLICY_DENIED');
    for (const forbidden of policyRow.forbiddenReasonCodes) if (evidenceEvaluation.reasonCodes.includes(forbidden)) reasons.add('KSTACK_ELIGIBILITY_POLICY_DENIED');
  }
  const capabilityUnion = [...input.primaryPartition.provenCapabilityIds, ...input.primaryPartition.missingCapabilityIds].sort();
  if (capabilityUnion.length !== input.requirementProfile.capabilityIds.length
      || capabilityUnion.some((entry, index) => entry !== input.requirementProfile.capabilityIds[index])) reasons.add('KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
  if (input.primaryPartition.missingCapabilityIds.length > 0) reasons.add('KSTACK_ELIGIBILITY_REQUIREMENT_MISSING');
  let expiresAt = [...input.expiryCandidates, policy.expiresAt, evidenceAdmission.expiresAt,
    new Date(Date.parse(snapshot.evaluatedAt) + (policyRow?.maximumResultLifetimeMs || 1)).toISOString()].sort()[0];
  if (snapshot.evaluatedAt >= expiresAt) fail('KSTACK_ELIGIBILITY_EXPIRED');

  let status = 'FULL';
  let alternateProfileId = null;
  const integrityOrDeny = [...reasons].some((code) => statusFromReasons([code]) === 'QUARANTINED'
    || code === 'KSTACK_ELIGIBILITY_POLICY_DENIED' || code === 'KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE'
    || code === 'KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
  if (reasons.size > 0) status = statusFromReasons([...reasons]);
  const onlyAlternateEligible = policyRow && reasons.size > 0 && !integrityOrDeny && policyRow.alternatePermission
    && [...reasons].every((reason) => reason === 'KSTACK_ELIGIBILITY_REQUIREMENT_MISSING'
      || policyRow.alternateEligibleReasonCodes.includes(reason));
  if (onlyAlternateEligible) {
    for (const profileId of policyRow.orderedAlternateProfileIds) {
      const alternate = input.alternates.find((entry) => entry.profileId === profileId);
      const registration = policyRow.alternateRegistrations.find((entry) => entry.profileId === profileId);
      if (!alternate || !registration || alternate.requirementProfileDigest !== registration.requirementProfileDigest
          || !input.requirementProfile.alternateProfileIds.includes(profileId)) continue;
      if (alternate.independentEvidenceOutcome === 'VALID' && alternate.partition.missingCapabilityIds.length === 0
          && alternate.expiresAt > snapshot.evaluatedAt) {
        status = 'DEGRADED_REGISTERED'; alternateProfileId = profileId; break;
      }
    }
    if (alternateProfileId === null) reasons.add('KSTACK_ELIGIBILITY_ALTERNATE_NOT_PROVEN');
  }
  if (alternateProfileId !== null) {
    const alternateExpiry = input.alternates.find((entry) => entry.profileId === alternateProfileId).expiresAt;
    if (alternateExpiry < expiresAt) expiresAt = alternateExpiry;
  }
  if (status === 'FULL' && reasons.size > 0) status = statusFromReasons([...reasons]);
  trace.push('INPUT_INTEGRITY', 'POLICY', 'CURRENTNESS', 'PRIMARY_CLOSURE', 'ALTERNATE_CLOSURE');
  const reasonCodes = [...reasons].sort();
  const record = {
    ...artifactHead('OperationEligibilityV1', snapshot.schemaSetDigest),
    operationId: snapshot.operationId,
    requirementProfileDigest: snapshot.requirementProfileDigest,
    hostEvidenceSetDigest: snapshot.evidenceAdmissionSnapshotDigest,
    activeSetDigest: snapshot.activeSetDigest,
    policyDigest: snapshot.policyDigest,
    status,
    alternateProfileId,
    provenCapabilityIds: input.primaryPartition.provenCapabilityIds,
    missingCapabilityIds: input.primaryPartition.missingCapabilityIds,
    reasonCodes,
    evaluatedAt: snapshot.evaluatedAt,
    expiresAt
  };
  const validated = validateHostArtifact('OperationEligibilityV1', record, { vocabulary: input.vocabulary });
  const evaluationDetail = {
    inputSnapshotDigest: hostAddress(ELIGIBILITY_IDENTITIES.EligibilityInputSnapshotV1.domain, snapshot),
    eligibilityDigest: validated.objectDigest,
    eligibilityEpoch: snapshot.eligibilityEpoch,
    trace,
    reasonCodes,
    alternateProfileId
  };
  return immutable({ record, recordDigest: validated.objectDigest, evaluationDetail,
    evaluationDetailDigest: hostAddress(ELIGIBILITY_IDENTITIES.EligibilityEvaluationV1.domain, evaluationDetail) });
}

export function validateQuarantineResolution(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'quarantineEventDigest', 'subjectType',
    'subjectDigest', 'scopeOperationIds', 'incidentEvidenceDigest', 'remediationEvidenceDigest',
    'replacementDigest', 'independentVerificationDigest', 'newEvidenceEpoch', 'newPolicyEpoch',
    'newEligibilityEpoch', 'resolvedAt', 'trustedTimeSampleDigest', 'resolverId', 'protectedAnchorDigest'
  ]);
  validateHead(value, 'QuarantineResolutionV1');
  for (const field of [
    'quarantineEventDigest', 'subjectDigest', 'incidentEvidenceDigest', 'remediationEvidenceDigest',
    'independentVerificationDigest', 'trustedTimeSampleDigest', 'protectedAnchorDigest'
  ]) digest(value[field]);
  if (value.replacementDigest !== null) digest(value.replacementDigest);
  ascii(value.subjectType); ascii(value.resolverId);
  sortedUnique(value.scopeOperationIds, ascii, 0, 256);
  uint(value.newEvidenceEpoch, true); uint(value.newPolicyEpoch, true); uint(value.newEligibilityEpoch, true);
  timestamp(value.resolvedAt);
  return immutable(value);
}

export function validateEligibilityInvalidation(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'repositoryContextDigest', 'scopeOperationIds',
    'priorEligibilityEpoch', 'newEligibilityEpoch', 'changedSubjectType', 'changedSubjectDigest',
    'reasonCode', 'affectedEligibilityDigests', 'effectiveAt', 'trustedTimeSampleDigest', 'protectedAnchorDigest'
  ]);
  validateHead(value, 'EligibilityInvalidationV1');
  for (const field of ['repositoryContextDigest', 'changedSubjectDigest', 'trustedTimeSampleDigest', 'protectedAnchorDigest']) digest(value[field]);
  sortedUnique(value.scopeOperationIds, ascii, 0, 256);
  uint(value.priorEligibilityEpoch, true); uint(value.newEligibilityEpoch, true);
  if (value.newEligibilityEpoch !== value.priorEligibilityEpoch + 1) fail('KSTACK_ELIGIBILITY_EPOCH_CHANGED');
  ascii(value.changedSubjectType); registry(value.reasonCode);
  sortedUnique(value.affectedEligibilityDigests, digest, 0, 256);
  timestamp(value.effectiveAt);
  return immutable(value);
}

export function assertEligibilityFence(eligibilityInput, current) {
  exact(eligibilityInput, [
    'eligibilityDigest', 'eligibilityEpoch', 'activeSetDigest', 'policyDigest',
    'evidenceAdmissionSnapshotDigest', 'environmentSequence', 'revocationSequence',
    'quarantineHeadDigest', 'expiresAt'
  ]);
  exact(current, [
    'eligibilityDigest', 'eligibilityEpoch', 'activeSetDigest', 'policyDigest',
    'evidenceAdmissionSnapshotDigest', 'environmentSequence', 'revocationSequence',
    'quarantineHeadDigest', 'trustedNow'
  ]);
  for (const object of [eligibilityInput, current]) {
    for (const field of ['eligibilityDigest', 'activeSetDigest', 'policyDigest', 'evidenceAdmissionSnapshotDigest', 'quarantineHeadDigest']) digest(object[field]);
    uint(object.eligibilityEpoch, true); uint(object.environmentSequence, true); uint(object.revocationSequence);
  }
  timestamp(eligibilityInput.expiresAt); timestamp(current.trustedNow);
  for (const field of [
    'eligibilityDigest', 'eligibilityEpoch', 'activeSetDigest', 'policyDigest',
    'evidenceAdmissionSnapshotDigest', 'environmentSequence', 'revocationSequence', 'quarantineHeadDigest'
  ]) if (eligibilityInput[field] !== current[field]) fail('KSTACK_ELIGIBILITY_EPOCH_CHANGED');
  if (current.trustedNow >= eligibilityInput.expiresAt) fail('KSTACK_ELIGIBILITY_EXPIRED');
  return true;
}

export function safeEligibilityDiagnostic(input) {
  exact(input, ['status', 'reasonCodes', 'provenCount', 'missingCount', 'alternateProfileId', 'correlationDigest']);
  enumeration(input.status, ELIGIBILITY_STATUSES);
  sortedUnique(input.reasonCodes, registry, 0, 128);
  uint(input.provenCount); uint(input.missingCount);
  if (input.alternateProfileId !== null) ascii(input.alternateProfileId);
  digest(input.correlationDigest);
  if ((input.status === 'DEGRADED_REGISTERED') !== (input.alternateProfileId !== null)) fail('KSTACK_ELIGIBILITY_INPUT_INVALID');
  return immutable({
    status: input.status, reasonCodes: input.reasonCodes, provenCount: input.provenCount,
    missingCount: input.missingCount, alternateProfileId: input.alternateProfileId,
    correlationDigest: input.correlationDigest
  });
}

function validateEligibilityBackend(backend, allowTestBackend) {
  exact(backend, [
    'descriptor', 'append', 'verifyProtectedAnchor', 'verifyTrustedTimeSample',
    'verifyRemediation', 'revocationStillEnforced', 'verifyEligibilityPolicy', 'verifyInputSnapshot',
    'quarantineReasonPolicy'
  ], 'KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
  validateProtectedEvidenceBackend(backend.descriptor, { allowTestBackend });
  if (typeof backend.append !== 'function' || typeof backend.verifyProtectedAnchor !== 'function'
      || typeof backend.verifyTrustedTimeSample !== 'function' || typeof backend.verifyRemediation !== 'function'
      || typeof backend.revocationStillEnforced !== 'function' || typeof backend.verifyEligibilityPolicy !== 'function'
      || typeof backend.verifyInputSnapshot !== 'function' || typeof backend.quarantineReasonPolicy !== 'function') {
    fail('KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
  }
  return backend;
}

export class ProtectedEligibilityKernel {
  #schemaSetDigest;
  #repositoryContextDigest;
  #backend;
  #vocabulary;
  #eligibilityEpochs = new Map();
  #quarantineEvents = new Map();
  #resolutions = new Map();
  #eligibilityCache = new Map();
  #quarantineHeadDigest;
  #tail = Promise.resolve();

  constructor(options) {
    exact(options, ['schemaSetDigest', 'repositoryContextDigest', 'backend', 'vocabulary', 'allowTestBackend']);
    this.#schemaSetDigest = digest(options.schemaSetDigest);
    this.#repositoryContextDigest = digest(options.repositoryContextDigest);
    this.#backend = validateEligibilityBackend(options.backend, options.allowTestBackend === true);
    this.#vocabulary = options.vocabulary;
    this.#quarantineHeadDigest = hostAddress('KSTACK-QUARANTINE-HEAD-V1', { events: [], resolutions: [] });
  }

  get quarantineHeadDigest() { return this.#quarantineHeadDigest; }
  eligibilityEpoch(operationId) { ascii(operationId); return this.#eligibilityEpochs.get(operationId) || 1; }

  async appendQuarantineAndInvalidate(input) {
    return this.#serialize(async () => {
      exact(input, ['event', 'invalidation', 'timeSample']);
      if (await this.#backend.verifyTrustedTimeSample(input.timeSample) !== true) fail('KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
      exact(input.timeSample, ['sampleDigest', 'wallTime']); digest(input.timeSample.sampleDigest); timestamp(input.timeSample.wallTime);
      const eventValidation = validateHostArtifact('QuarantineEventV1', input.event, { vocabulary: this.#vocabulary });
      if (await this.#backend.verifyProtectedAnchor(input.event.eventAnchorDigest, input.event) !== true) fail('KSTACK_ELIGIBILITY_INPUT_INVALID');
      const reasonPolicy = await this.#backend.quarantineReasonPolicy(input.event.reasonCode);
      exact(reasonPolicy, ['automaticExpiryAllowed'], 'KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
      if (typeof reasonPolicy.automaticExpiryAllowed !== 'boolean') fail('KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
      if (!reasonPolicy.automaticExpiryAllowed && input.event.expiresAt !== null) fail('KSTACK_ELIGIBILITY_INPUT_INVALID');
      const invalidation = validateEligibilityInvalidation(input.invalidation);
      if (invalidation.repositoryContextDigest !== this.#repositoryContextDigest
          || invalidation.changedSubjectDigest !== input.event.subjectDigest
          || invalidation.reasonCode !== input.event.reasonCode
          || invalidation.effectiveAt !== input.timeSample.wallTime
          || invalidation.trustedTimeSampleDigest !== input.timeSample.sampleDigest
          || await this.#backend.verifyProtectedAnchor(invalidation.protectedAnchorDigest, invalidation) !== true) {
        fail('KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
      }
      const scopes = input.event.scopeOperationIds.length === 0
        ? invalidation.scopeOperationIds
        : input.event.scopeOperationIds;
      if (scopes.length === 0 || scopes.length !== invalidation.scopeOperationIds.length
          || scopes.some((entry, index) => entry !== invalidation.scopeOperationIds[index])) fail('KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
      const priorEpochs = scopes.map((operationId) => this.eligibilityEpoch(operationId));
      if (new Set(priorEpochs).size !== 1 || invalidation.priorEligibilityEpoch !== priorEpochs[0]) fail('KSTACK_ELIGIBILITY_EPOCH_CHANGED');
      const eventDigest = eventValidation.objectDigest;
      const invalidationDigest = hostAddress(ELIGIBILITY_IDENTITIES.EligibilityInvalidationV1.domain, invalidation);
      const nextHead = hostAddress('KSTACK-QUARANTINE-HEAD-V1', {
        priorHeadDigest: this.#quarantineHeadDigest, eventDigest, invalidationDigest
      });
      await this.#commit([
        { digest: eventDigest, bytes: hostCanonicalBytes(input.event).toString('base64url') },
        { digest: invalidationDigest, bytes: hostCanonicalBytes(invalidation).toString('base64url') },
        { digest: nextHead, bytes: hostCanonicalBytes({ priorHeadDigest: this.#quarantineHeadDigest, eventDigest, invalidationDigest }).toString('base64url') }
      ]);
      scopes.forEach((operationId) => this.#eligibilityEpochs.set(operationId, invalidation.newEligibilityEpoch));
      this.#quarantineEvents.set(eventDigest, immutable({ event: input.event, resolvedScopes: scopes }));
      this.#quarantineHeadDigest = nextHead;
      return immutable({ eventDigest, invalidationDigest, quarantineHeadDigest: nextHead });
    });
  }

  async appendResolution(resolutionInput) {
    return this.#serialize(async () => {
      const resolution = validateQuarantineResolution(resolutionInput);
      const entry = this.#quarantineEvents.get(resolution.quarantineEventDigest);
      const event = entry?.event;
      if (!event || this.#resolutions.has(resolution.quarantineEventDigest)
          || event.subjectType !== resolution.subjectType || event.subjectDigest !== resolution.subjectDigest
          || event.scopeOperationIds.length !== resolution.scopeOperationIds.length
          || event.scopeOperationIds.some((scope, index) => scope !== resolution.scopeOperationIds[index])
          || await this.#backend.verifyProtectedAnchor(resolution.protectedAnchorDigest, resolution) !== true) {
        fail('KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
      }
      if (await this.#backend.verifyRemediation(event.reasonCode, resolution) !== true
          || await this.#backend.revocationStillEnforced(event, resolution) !== true) fail('KSTACK_ELIGIBILITY_QUARANTINED');
      const priorEpochs = entry.resolvedScopes.map((operationId) => this.eligibilityEpoch(operationId));
      if (new Set(priorEpochs).size !== 1 || resolution.newEligibilityEpoch !== priorEpochs[0] + 1) {
        fail('KSTACK_ELIGIBILITY_EPOCH_CHANGED');
      }
      const resolutionDigest = hostAddress(ELIGIBILITY_IDENTITIES.QuarantineResolutionV1.domain, resolution);
      const nextHead = hostAddress('KSTACK-QUARANTINE-HEAD-V1', { priorHeadDigest: this.#quarantineHeadDigest, resolutionDigest });
      await this.#commit([
        { digest: resolutionDigest, bytes: hostCanonicalBytes(resolution).toString('base64url') },
        { digest: nextHead, bytes: hostCanonicalBytes({ priorHeadDigest: this.#quarantineHeadDigest, resolutionDigest }).toString('base64url') }
      ]);
      this.#resolutions.set(resolution.quarantineEventDigest, resolution);
      entry.resolvedScopes.forEach((operationId) => this.#eligibilityEpochs.set(operationId, resolution.newEligibilityEpoch));
      this.#quarantineHeadDigest = nextHead;
      return immutable({ resolutionDigest, quarantineHeadDigest: nextHead });
    });
  }

  activeQuarantineDigests(operationId, trustedNow) {
    ascii(operationId); timestamp(trustedNow);
    const active = [];
    for (const [eventDigest, entry] of this.#quarantineEvents) {
      const event = entry.event;
      if (this.#resolutions.has(eventDigest)) continue;
      if (event.scopeOperationIds.length > 0 && !event.scopeOperationIds.includes(operationId)) continue;
      if (event.expiresAt !== null && event.expiresAt <= trustedNow) continue;
      active.push(eventDigest);
    }
    return Object.freeze(active.sort());
  }

  async evaluateAndPublish(input) {
    return this.#serialize(async () => {
      const snapshot = validateEligibilityInputSnapshot(input.snapshot);
      if (await this.#backend.verifyInputSnapshot(snapshot) !== true
          || await this.#backend.verifyEligibilityPolicy(input.policy) !== true) fail('KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
      if (snapshot.eligibilityEpoch !== this.eligibilityEpoch(snapshot.operationId)
          || snapshot.quarantineHeadDigest !== this.#quarantineHeadDigest) fail('KSTACK_ELIGIBILITY_EPOCH_CHANGED');
      const active = this.activeQuarantineDigests(snapshot.operationId, snapshot.evaluatedAt);
      if (active.length !== input.activeQuarantines.length
          || active.some((entry, index) => entry !== input.activeQuarantines[index])) fail('KSTACK_ELIGIBILITY_CONTEXT_MISMATCH');
      const result = evaluateOperationEligibility(input);
      const recordBytes = hostCanonicalBytes(result.record).toString('base64url');
      const detailBytes = hostCanonicalBytes(result.evaluationDetail).toString('base64url');
      await this.#commit([
        { digest: result.recordDigest, bytes: recordBytes },
        { digest: result.evaluationDetailDigest, bytes: detailBytes }
      ]);
      this.#eligibilityCache.set(result.recordDigest, immutable({
        result,
        fence: {
          eligibilityDigest: result.recordDigest,
          eligibilityEpoch: snapshot.eligibilityEpoch,
          activeSetDigest: snapshot.activeSetDigest,
          policyDigest: snapshot.policyDigest,
          evidenceAdmissionSnapshotDigest: snapshot.evidenceAdmissionSnapshotDigest,
          environmentSequence: input.evidenceAdmissionSnapshot.measurementSequence,
          revocationSequence: snapshot.revocationSequence,
          quarantineHeadDigest: snapshot.quarantineHeadDigest,
          expiresAt: result.record.expiresAt
        }
      }));
      return result;
    });
  }

  reuseCached(recordDigest, current) {
    digest(recordDigest);
    const cached = this.#eligibilityCache.get(recordDigest);
    if (!cached) return null;
    try { assertEligibilityFence(cached.fence, { ...current, eligibilityDigest: recordDigest }); }
    catch { return null; }
    return cached.result;
  }

  async #commit(objects) {
    const digests = objects.map((entry) => entry.digest).sort();
    const receipt = await this.#backend.append({ transactionDomain: 'KSTACK-ELIGIBILITY-PROTECTED-TRANSACTION-V1', objects });
    exact(receipt, ['committed', 'rereadDigests', 'auditReceiptDigest'], 'KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
    if (receipt.committed !== true) fail('KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
    sortedUnique(receipt.rereadDigests, digest, digests.length, digests.length, 'KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
    digest(receipt.auditReceiptDigest, 'KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE');
    if (digests.some((entry, index) => entry !== receipt.rereadDigests[index])) fail('KSTACK_ELIGIBILITY_PROTECTED_STATE_CORRUPT');
  }

  #serialize(action) {
    const next = this.#tail.then(action, action);
    this.#tail = next.catch(() => {});
    return next;
  }
}
