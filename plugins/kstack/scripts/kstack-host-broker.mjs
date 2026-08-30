import {
  assertAsciiId,
  assertDigest,
  assertRegistryId,
  assertTimestamp,
  hostAddress
} from './kstack-host-contract.mjs';
import { EFFECT_FAMILIES, validateHostBypassInventory } from './kstack-host-harness.mjs';

export class HostBrokerError extends Error {
  constructor(code) { super(code); this.name = 'HostBrokerError'; this.code = code; }
}

function fail(code) { throw new HostBrokerError(code); }
function exact(value, keys, code = 'KSTACK_BROKER_INPUT_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(); const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}
function digest(value, code = 'KSTACK_BROKER_INPUT_INVALID') { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code = 'KSTACK_BROKER_INPUT_INVALID') { try { return assertAsciiId(value); } catch { fail(code); } }
function registry(value, code = 'KSTACK_BROKER_INPUT_INVALID') { try { return assertRegistryId(value); } catch { fail(code); } }
function structuralControl(value, code = 'KSTACK_BROKER_INPUT_INVALID') {
  if (typeof value === 'string' && /^protected-broker-v1:[a-z0-9][a-z0-9._-]{0,127}$/u.test(value)) return value;
  return ascii(value, code);
}
function timestamp(value, code = 'KSTACK_BROKER_INPUT_INVALID') { try { return assertTimestamp(value); } catch { fail(code); } }
function bool(value, code = 'KSTACK_BROKER_INPUT_INVALID') { if (typeof value !== 'boolean') fail(code); return value; }
function enumeration(value, allowed, code = 'KSTACK_BROKER_INPUT_INVALID') { if (!allowed.includes(value)) fail(code); return value; }
function uint(value, maximum, code = 'KSTACK_BROKER_INPUT_INVALID') { if (!Number.isSafeInteger(value) || value < 0 || value > maximum) fail(code); return value; }
function sortedUnique(values, validator = ascii, minimum = 0, maximum = 256, code = 'KSTACK_BROKER_INPUT_INVALID') {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((entry) => validator(entry, code));
  if (new Set(values).size !== values.length || values.some((entry, index) => index > 0 && entry <= values[index - 1])) fail(code);
  return values;
}
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export const BROKER_AUTHORITY_TIERS = Object.freeze(['allow', 'ask', 'deny']);
export const BROKER_PRIVILEGE_TIERS = Object.freeze(['ordinary', 'privileged']);
export const BROKER_EXECUTION_MODES = Object.freeze(['foreground', 'background']);
export const BROKER_PROOF_OUTCOMES = Object.freeze(['PROVEN', 'UNKNOWN', 'UNAVAILABLE', 'CONTRADICTORY', 'INVALID', 'STALE']);
export const BROKER_REASON_CODES = Object.freeze([
  'BROKER_CLASSIFICATION_UNKNOWN', 'BROKER_CLASSIFICATION_MISMATCH', 'BROKER_POLICY_DENIED',
  'BROKER_REQUIREMENT_MISSING', 'BROKER_MULTIPLE_CONTROLS', 'BROKER_PROFILE_UNKNOWN',
  'BROKER_PROTECTION_UNPROVEN', 'BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN',
  'BROKER_EFFECT_EXCLUSIVITY_UNPROVEN', 'BROKER_EFFECT_COVERAGE_MISMATCH',
  'BROKER_BINDING_MISMATCH', 'BROKER_CURRENT_ADMISSION_UNPROVEN',
  'BROKER_TERMINAL_EVIDENCE_UNPROVEN', 'BROKER_OTHER_REQUIREMENT_UNPROVEN',
  'BROKER_BACKGROUND_DURABLE_APPROVAL_FORBIDDEN', 'BROKER_BACKGROUND_READINESS_INVALID',
  'BROKER_BACKGROUND_APPROVAL_INVALID', 'BROKER_BACKGROUND_FACT_DRIFT'
]);
const OPERATION_KINDS = Object.freeze(['capability-use', 'disclosure', 'discovery', 'external-effect', 'read', 'write']);
const PROOF_IDS = Object.freeze([
  'authorization-exclusivity', 'binding', 'classification-provenance', 'current-admission',
  'effect-exclusivity', 'protected-custody', 'terminal-evidence'
]);
const IDENTITIES = Object.freeze({
  BrokerClassificationV1: ['kstack.broker-classification.v1', 'KSTACK-BROKER-CLASSIFICATION-V1'],
  BrokerProfileV1: ['kstack.broker-profile.v1', 'KSTACK-BROKER-PROFILE-V1'],
  BrokerStructuralEvaluationV1: ['kstack.broker-structural-evaluation.v1', 'KSTACK-BROKER-STRUCTURAL-EVALUATION-V1'],
  BackgroundApprovalWindowV1: ['kstack.background-approval-window.v1', 'KSTACK-BACKGROUND-APPROVAL-WINDOW-V1']
});
function head(name, schemaSetDigest) { return { schemaId: IDENTITIES[name][0], schemaVersion: 1, schemaSetDigest: digest(schemaSetDigest) }; }
function address(name, value) { return hostAddress(IDENTITIES[name][1], value); }

function validateProvenanceRow(value) {
  exact(value, ['sourceId', 'sourceDigest', 'trustRootDigest', 'outcome', 'closureControlled', 'rollbackDetected'], 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  ascii(value.sourceId, 'KSTACK_BROKER_CLASSIFICATION_INVALID'); digest(value.sourceDigest, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  digest(value.trustRootDigest, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  enumeration(value.outcome, BROKER_PROOF_OUTCOMES, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  bool(value.closureControlled, 'KSTACK_BROKER_CLASSIFICATION_INVALID'); bool(value.rollbackDetected, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
}

export function deriveBrokerClassification(input) {
  exact(input, [
    'schemaSetDigest', 'operationId', 'operationKind', 'executionMode', 'directAuthorityTier',
    'directLocalPrivilegeTier', 'targetPrivilegeRows', 'indirectEffectRows', 'governanceMutation',
    'effectIds', 'provenanceRows', 'callerEcho'
  ], 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_BROKER_CLASSIFICATION_INVALID'); ascii(input.operationId, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  enumeration(input.operationKind, OPERATION_KINDS, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  enumeration(input.executionMode, BROKER_EXECUTION_MODES, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  enumeration(input.directAuthorityTier, BROKER_AUTHORITY_TIERS, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  enumeration(input.directLocalPrivilegeTier, BROKER_PRIVILEGE_TIERS, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  bool(input.governanceMutation, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  sortedUnique(input.effectIds, ascii, 0, 256, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  if (!Array.isArray(input.targetPrivilegeRows) || !Array.isArray(input.indirectEffectRows) || !Array.isArray(input.provenanceRows)) fail('KSTACK_BROKER_CLASSIFICATION_INVALID');
  const targetTiers = [];
  for (const row of input.targetPrivilegeRows) {
    exact(row, ['targetId', 'privilegeTier', 'classificationDigest'], 'KSTACK_BROKER_CLASSIFICATION_INVALID');
    ascii(row.targetId, 'KSTACK_BROKER_CLASSIFICATION_INVALID'); enumeration(row.privilegeTier, BROKER_PRIVILEGE_TIERS, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
    digest(row.classificationDigest, 'KSTACK_BROKER_CLASSIFICATION_INVALID'); targetTiers.push(row.privilegeTier);
  }
  const targetIds = input.targetPrivilegeRows.map((row) => row.targetId);
  if (new Set(targetIds).size !== targetIds.length) fail('KSTACK_BROKER_CLASSIFICATION_INVALID');
  const indirectAuthority = []; const indirectPrivilege = [];
  for (const row of input.indirectEffectRows) {
    exact(row, ['effectId', 'authorityTier', 'privilegeTier', 'reachabilityOutcome'], 'KSTACK_BROKER_CLASSIFICATION_INVALID');
    ascii(row.effectId, 'KSTACK_BROKER_CLASSIFICATION_INVALID'); enumeration(row.authorityTier, BROKER_AUTHORITY_TIERS, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
    enumeration(row.privilegeTier, BROKER_PRIVILEGE_TIERS, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
    enumeration(row.reachabilityOutcome, BROKER_PROOF_OUTCOMES, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
    indirectAuthority.push(row.authorityTier); indirectPrivilege.push(row.privilegeTier);
  }
  input.provenanceRows.forEach(validateProvenanceRow);
  const requiredSources = ['active-set', 'operation-registry', 'override-revocation', 'policy', 'target-classification'];
  const sourceIds = input.provenanceRows.map((row) => row.sourceId).sort();
  const indirectEffectIds = input.indirectEffectRows.map((row) => row.effectId).sort();
  if (new Set(indirectEffectIds).size !== indirectEffectIds.length || indirectEffectIds.length !== input.effectIds.length
    || indirectEffectIds.some((id, index) => id !== input.effectIds[index])) fail('KSTACK_BROKER_CLASSIFICATION_INVALID');
  const provenanceProven = sourceIds.length === requiredSources.length && sourceIds.every((id, index) => id === requiredSources[index])
    && input.provenanceRows.every((row) => row.outcome === 'PROVEN' && !row.closureControlled && !row.rollbackDetected)
    && input.indirectEffectRows.every((row) => row.reachabilityOutcome === 'PROVEN');
  const authorityValues = [input.directAuthorityTier, ...indirectAuthority];
  const authorityTier = authorityValues.includes('deny') ? 'deny' : authorityValues.includes('ask') ? 'ask' : 'allow';
  const privilegeTier = input.governanceMutation || [input.directLocalPrivilegeTier, ...targetTiers, ...indirectPrivilege].includes('privileged') ? 'privileged' : 'ordinary';
  const brokerRequired = authorityTier === 'ask' || privilegeTier === 'privileged';
  exact(input.callerEcho, ['authorityTier', 'privilegeTier', 'brokerRequired'], 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  enumeration(input.callerEcho.authorityTier, BROKER_AUTHORITY_TIERS, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  enumeration(input.callerEcho.privilegeTier, BROKER_PRIVILEGE_TIERS, 'KSTACK_BROKER_CLASSIFICATION_INVALID'); bool(input.callerEcho.brokerRequired, 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  const echoMatches = input.callerEcho.authorityTier === authorityTier && input.callerEcho.privilegeTier === privilegeTier && input.callerEcho.brokerRequired === brokerRequired;
  const classification = {
    ...head('BrokerClassificationV1', input.schemaSetDigest),
    operationId: input.operationId,
    operationKind: input.operationKind,
    executionMode: input.executionMode,
    authorityTier: provenanceProven ? authorityTier : null,
    privilegeTier: provenanceProven ? privilegeTier : null,
    brokerRequired: provenanceProven ? brokerRequired : null,
    effectIds: input.effectIds,
    provenanceDigest: hostAddress('KSTACK-BROKER-CLASSIFICATION-PROVENANCE-V1', input.provenanceRows),
    provenanceProven,
    echoMatches
  };
  return immutable({ classification, classificationDigest: address('BrokerClassificationV1', classification) });
}

export function validateBrokerProfile(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'profileId', 'protocolId', 'protocolDigest',
    'activeSetDigest', 'operationIds', 'effectIds', 'effectFamilyRows', 'custody',
    'authorizationPath', 'actionTimeMediation', 'terminalEvidence'
  ], 'KSTACK_BROKER_PROFILE_INVALID');
  if (value.schemaId !== IDENTITIES.BrokerProfileV1[0] || value.schemaVersion !== 1) fail('KSTACK_BROKER_PROFILE_INVALID');
  digest(value.schemaSetDigest, 'KSTACK_BROKER_PROFILE_INVALID'); ascii(value.profileId, 'KSTACK_BROKER_PROFILE_INVALID'); ascii(value.protocolId, 'KSTACK_BROKER_PROFILE_INVALID');
  digest(value.protocolDigest, 'KSTACK_BROKER_PROFILE_INVALID'); digest(value.activeSetDigest, 'KSTACK_BROKER_PROFILE_INVALID');
  sortedUnique(value.operationIds, ascii, 1, 256, 'KSTACK_BROKER_PROFILE_INVALID'); sortedUnique(value.effectIds, ascii, 1, 256, 'KSTACK_BROKER_PROFILE_INVALID');
  if (!Array.isArray(value.effectFamilyRows)) fail('KSTACK_BROKER_PROFILE_INVALID');
  for (const row of value.effectFamilyRows) {
    exact(row, ['effectId', 'effectFamilyId', 'coverageProofDigest'], 'KSTACK_BROKER_PROFILE_INVALID');
    ascii(row.effectId, 'KSTACK_BROKER_PROFILE_INVALID'); enumeration(row.effectFamilyId, EFFECT_FAMILIES, 'KSTACK_BROKER_PROFILE_INVALID'); digest(row.coverageProofDigest, 'KSTACK_BROKER_PROFILE_INVALID');
  }
  const coveredEffectIds = value.effectFamilyRows.map((row) => row.effectId).sort();
  if (new Set(coveredEffectIds).size !== coveredEffectIds.length || coveredEffectIds.length !== value.effectIds.length
    || coveredEffectIds.some((id, index) => id !== value.effectIds[index])) fail('KSTACK_BROKER_PROFILE_INVALID');
  const booleanGroups = {
    custody: ['activeSet', 'config', 'executable', 'policy', 'receiptLog', 'replayLedger', 'signingKeys'],
    authorizationPath: ['approvalChannel', 'canonicalPreview', 'decisionInputs', 'nonceStore', 'trustAnchors', 'verificationKeys'],
    actionTimeMediation: ['currentAdmissionRequired', 'fenceRequired', 'protectedDispatchOnly'],
    terminalEvidence: ['ambiguousOutcomeRecorded', 'protectedReceiptRequired']
  };
  for (const [group, keys] of Object.entries(booleanGroups)) {
    exact(value[group], keys, 'KSTACK_BROKER_PROFILE_INVALID'); Object.values(value[group]).forEach((entry) => bool(entry, 'KSTACK_BROKER_PROFILE_INVALID'));
  }
  return immutable(value);
}

function validateProofRow(value) {
  exact(value, ['proofId', 'outcome', 'evidenceDigest', 'bindingDigest', 'subjectControlled'], 'KSTACK_BROKER_PROOF_INVALID');
  enumeration(value.proofId, PROOF_IDS, 'KSTACK_BROKER_PROOF_INVALID'); enumeration(value.outcome, BROKER_PROOF_OUTCOMES, 'KSTACK_BROKER_PROOF_INVALID');
  digest(value.evidenceDigest, 'KSTACK_BROKER_PROOF_INVALID'); digest(value.bindingDigest, 'KSTACK_BROKER_PROOF_INVALID'); bool(value.subjectControlled, 'KSTACK_BROKER_PROOF_INVALID');
}

export function evaluateBrokerStructuralRequirement(input) {
  exact(input, [
    'schemaSetDigest', 'classification', 'activeSetDigest', 'policyDigest', 'operationBindingDigest',
    'requiredStructuralControls', 'profile', 'proofRows', 'bypassInventory', 'otherRequirementsProven'
  ], 'KSTACK_BROKER_INPUT_INVALID');
  digest(input.schemaSetDigest); digest(input.activeSetDigest); digest(input.policyDigest); digest(input.operationBindingDigest);
  sortedUnique(input.requiredStructuralControls, structuralControl, 0, 16); bool(input.otherRequirementsProven);
  const classification = input.classification;
  exact(classification, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'operationId', 'operationKind', 'executionMode', 'authorityTier', 'privilegeTier', 'brokerRequired', 'effectIds', 'provenanceDigest', 'provenanceProven', 'echoMatches'], 'KSTACK_BROKER_CLASSIFICATION_INVALID');
  if (classification.schemaId !== IDENTITIES.BrokerClassificationV1[0] || classification.schemaVersion !== 1 || classification.schemaSetDigest !== input.schemaSetDigest) fail('KSTACK_BROKER_CLASSIFICATION_INVALID');
  const inventory = validateHostBypassInventory(input.bypassInventory);
  if (!Array.isArray(input.proofRows)) fail('KSTACK_BROKER_PROOF_INVALID'); input.proofRows.forEach(validateProofRow);
  const proofMap = new Map(input.proofRows.map((row) => [row.proofId, row]));
  if (proofMap.size !== input.proofRows.length) fail('KSTACK_BROKER_PROOF_INVALID');
  const reasons = new Set();
  if (!classification.provenanceProven || classification.authorityTier === null || classification.privilegeTier === null || classification.brokerRequired === null) reasons.add('BROKER_CLASSIFICATION_UNKNOWN');
  if (!classification.echoMatches) reasons.add('BROKER_CLASSIFICATION_MISMATCH');
  if (classification.authorityTier === 'deny') reasons.add('BROKER_POLICY_DENIED');
  const brokerControls = input.requiredStructuralControls.filter((id) => id.startsWith('protected-broker-v1:'));
  if (classification.brokerRequired === true && brokerControls.length === 0) reasons.add('BROKER_REQUIREMENT_MISSING');
  if (brokerControls.length > 1) reasons.add('BROKER_MULTIPLE_CONTROLS');
  let profile = null;
  if (brokerControls.length === 1) {
    if (input.profile === null) reasons.add('BROKER_PROFILE_UNKNOWN');
    else {
      profile = validateBrokerProfile(input.profile);
      if (brokerControls[0] !== `protected-broker-v1:${profile.profileId}` || profile.activeSetDigest !== input.activeSetDigest
        || !profile.operationIds.includes(classification.operationId)) reasons.add('BROKER_PROFILE_UNKNOWN');
      if (classification.effectIds.length !== profile.effectIds.length || classification.effectIds.some((id, index) => id !== profile.effectIds[index])) reasons.add('BROKER_EFFECT_COVERAGE_MISMATCH');
      if (Object.values(profile.custody).some((entry) => !entry)) reasons.add('BROKER_PROTECTION_UNPROVEN');
      if (Object.values(profile.authorizationPath).some((entry) => !entry)) reasons.add('BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN');
      if (Object.values(profile.actionTimeMediation).some((entry) => !entry)) reasons.add('BROKER_CURRENT_ADMISSION_UNPROVEN');
      if (Object.values(profile.terminalEvidence).some((entry) => !entry)) reasons.add('BROKER_TERMINAL_EVIDENCE_UNPROVEN');
      const relevantFamilies = new Set(profile.effectFamilyRows.map((row) => row.effectFamilyId));
      const observedFamilies = new Set(inventory.surfaces.filter((surface) => relevantFamilies.has(surface.familyId)).map((surface) => surface.familyId));
      if ([...relevantFamilies].some((familyId) => !observedFamilies.has(familyId))
        || inventory.surfaces.some((surface) => relevantFamilies.has(surface.familyId) && !['COVERED', 'DISABLED_PROVEN', 'UNREACHABLE_PROVEN'].includes(surface.status))) reasons.add('BROKER_EFFECT_EXCLUSIVITY_UNPROVEN');
    }
  } else if (input.profile !== null) validateBrokerProfile(input.profile);
  const proofReason = {
    'classification-provenance': 'BROKER_CLASSIFICATION_UNKNOWN',
    'protected-custody': 'BROKER_PROTECTION_UNPROVEN',
    'authorization-exclusivity': 'BROKER_AUTHORIZATION_EXCLUSIVITY_UNPROVEN',
    'effect-exclusivity': 'BROKER_EFFECT_EXCLUSIVITY_UNPROVEN',
    binding: 'BROKER_BINDING_MISMATCH',
    'current-admission': 'BROKER_CURRENT_ADMISSION_UNPROVEN',
    'terminal-evidence': 'BROKER_TERMINAL_EVIDENCE_UNPROVEN'
  };
  if (classification.brokerRequired === true) for (const proofId of PROOF_IDS) {
    const proof = proofMap.get(proofId);
    if (!proof || proof.outcome !== 'PROVEN' || proof.subjectControlled || proof.bindingDigest !== input.operationBindingDigest) reasons.add(proofReason[proofId]);
  }
  if (!input.otherRequirementsProven) reasons.add('BROKER_OTHER_REQUIREMENT_UNPROVEN');
  const structuralSatisfied = [...reasons].every((reason) => reason === 'BROKER_OTHER_REQUIREMENT_UNPROVEN');
  const conjunctiveEligible = structuralSatisfied && input.otherRequirementsProven && classification.authorityTier !== 'deny';
  const evaluation = {
    ...head('BrokerStructuralEvaluationV1', input.schemaSetDigest),
    classificationDigest: address('BrokerClassificationV1', classification),
    operationBindingDigest: input.operationBindingDigest,
    activeSetDigest: input.activeSetDigest,
    policyDigest: input.policyDigest,
    brokerProfileDigest: profile ? address('BrokerProfileV1', profile) : null,
    bypassInventoryDigest: hostAddress('KSTACK-HOST-BYPASS-INVENTORY-V1', inventory),
    brokerRequired: classification.brokerRequired,
    structuralSatisfied,
    otherRequirementsProven: input.otherRequirementsProven,
    conjunctiveEligible,
    reasonCodes: [...reasons].sort()
  };
  return immutable({ evaluation, evaluationDigest: address('BrokerStructuralEvaluationV1', evaluation) });
}

function validateReadinessFacts(value, code) {
  exact(value, ['factSetDigest', 'policyDigest', 'activeSetDigest', 'targetDigest', 'inputsDigest', 'limitsDigest', 'expiry', 'nonceDigest', 'idempotencyDigest', 'classificationDigest', 'channelBindingDigest', 'effectSetDigest', 'structuralEvaluationDigest', 'allValid'], code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code);
  timestamp(value.expiry, code); bool(value.allValid, code); return value;
}

export function evaluateBackgroundApprovalWindow(input) {
  exact(input, [
    'schemaSetDigest', 'operationId', 'authorityTier', 'executionMode', 'durableApprovalPresent',
    'readinessPolicy', 'troubleshootingAttempts', 'factsAfterRecovery', 'ownerQuestion',
    'freshApproval', 'factsBeforeEffect', 'evaluatedAt'
  ], 'KSTACK_BROKER_BACKGROUND_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_BROKER_BACKGROUND_INVALID'); ascii(input.operationId, 'KSTACK_BROKER_BACKGROUND_INVALID');
  enumeration(input.authorityTier, BROKER_AUTHORITY_TIERS, 'KSTACK_BROKER_BACKGROUND_INVALID'); enumeration(input.executionMode, BROKER_EXECUTION_MODES, 'KSTACK_BROKER_BACKGROUND_INVALID');
  bool(input.durableApprovalPresent, 'KSTACK_BROKER_BACKGROUND_INVALID'); timestamp(input.evaluatedAt, 'KSTACK_BROKER_BACKGROUND_INVALID');
  exact(input.readinessPolicy, ['maximumAttempts', 'maximumTotalMs', 'delayScheduleMs', 'permittedOperationIds', 'policyDigest'], 'KSTACK_BROKER_BACKGROUND_INVALID');
  uint(input.readinessPolicy.maximumAttempts, 8, 'KSTACK_BROKER_BACKGROUND_INVALID'); uint(input.readinessPolicy.maximumTotalMs, 300_000, 'KSTACK_BROKER_BACKGROUND_INVALID');
  if (!Array.isArray(input.readinessPolicy.delayScheduleMs) || input.readinessPolicy.delayScheduleMs.length > 8) fail('KSTACK_BROKER_BACKGROUND_INVALID');
  input.readinessPolicy.delayScheduleMs.forEach((entry) => uint(entry, 60_000, 'KSTACK_BROKER_BACKGROUND_INVALID'));
  sortedUnique(input.readinessPolicy.permittedOperationIds, ascii, 0, 32, 'KSTACK_BROKER_BACKGROUND_INVALID'); digest(input.readinessPolicy.policyDigest, 'KSTACK_BROKER_BACKGROUND_INVALID');
  if (!Array.isArray(input.troubleshootingAttempts) || input.troubleshootingAttempts.length > input.readinessPolicy.maximumAttempts) fail('KSTACK_BROKER_BACKGROUND_INVALID');
  let elapsedMs = 0; let attemptsValid = true;
  for (const attempt of input.troubleshootingAttempts) {
    exact(attempt, ['operationId', 'durationMs', 'nonEscalating', 'effectCrossed', 'scopeChanged', 'outcome'], 'KSTACK_BROKER_BACKGROUND_INVALID');
    ascii(attempt.operationId, 'KSTACK_BROKER_BACKGROUND_INVALID'); uint(attempt.durationMs, 300_000, 'KSTACK_BROKER_BACKGROUND_INVALID');
    bool(attempt.nonEscalating, 'KSTACK_BROKER_BACKGROUND_INVALID'); bool(attempt.effectCrossed, 'KSTACK_BROKER_BACKGROUND_INVALID'); bool(attempt.scopeChanged, 'KSTACK_BROKER_BACKGROUND_INVALID');
    enumeration(attempt.outcome, ['READY', 'NOT_READY', 'UNAVAILABLE'], 'KSTACK_BROKER_BACKGROUND_INVALID'); elapsedMs += attempt.durationMs;
    if (!input.readinessPolicy.permittedOperationIds.includes(attempt.operationId) || !attempt.nonEscalating || attempt.effectCrossed || attempt.scopeChanged) attemptsValid = false;
  }
  if (elapsedMs > input.readinessPolicy.maximumTotalMs) attemptsValid = false;
  validateReadinessFacts(input.factsAfterRecovery, 'KSTACK_BROKER_BACKGROUND_INVALID'); validateReadinessFacts(input.factsBeforeEffect, 'KSTACK_BROKER_BACKGROUND_INVALID');
  exact(input.ownerQuestion, ['questionId', 'previewDigest', 'recommendationId', 'consequenceIds', 'blockedActionId', 'choices', 'failureEvidenceDigest'], 'KSTACK_BROKER_BACKGROUND_INVALID');
  ascii(input.ownerQuestion.questionId, 'KSTACK_BROKER_BACKGROUND_INVALID'); digest(input.ownerQuestion.previewDigest, 'KSTACK_BROKER_BACKGROUND_INVALID');
  ascii(input.ownerQuestion.recommendationId, 'KSTACK_BROKER_BACKGROUND_INVALID'); sortedUnique(input.ownerQuestion.consequenceIds, ascii, 1, 16, 'KSTACK_BROKER_BACKGROUND_INVALID');
  ascii(input.ownerQuestion.blockedActionId, 'KSTACK_BROKER_BACKGROUND_INVALID');
  if (!Array.isArray(input.ownerQuestion.choices) || input.ownerQuestion.choices.join(',') !== 'Yes,No,Comment') fail('KSTACK_BROKER_BACKGROUND_INVALID');
  digest(input.ownerQuestion.failureEvidenceDigest, 'KSTACK_BROKER_BACKGROUND_INVALID');
  exact(input.freshApproval, ['approvalId', 'answer', 'factSetDigest', 'previewDigest', 'issuedAt', 'expiresAt', 'oneShot'], 'KSTACK_BROKER_BACKGROUND_INVALID');
  ascii(input.freshApproval.approvalId, 'KSTACK_BROKER_BACKGROUND_INVALID'); enumeration(input.freshApproval.answer, ['Yes', 'No', 'Comment'], 'KSTACK_BROKER_BACKGROUND_INVALID');
  digest(input.freshApproval.factSetDigest, 'KSTACK_BROKER_BACKGROUND_INVALID'); digest(input.freshApproval.previewDigest, 'KSTACK_BROKER_BACKGROUND_INVALID');
  timestamp(input.freshApproval.issuedAt, 'KSTACK_BROKER_BACKGROUND_INVALID'); timestamp(input.freshApproval.expiresAt, 'KSTACK_BROKER_BACKGROUND_INVALID'); bool(input.freshApproval.oneShot, 'KSTACK_BROKER_BACKGROUND_INVALID');
  const reasons = new Set();
  const applicable = input.executionMode === 'background' && input.authorityTier === 'ask';
  if (applicable && input.durableApprovalPresent) reasons.add('BROKER_BACKGROUND_DURABLE_APPROVAL_FORBIDDEN');
  if (!attemptsValid || !input.factsAfterRecovery.allValid) reasons.add('BROKER_BACKGROUND_READINESS_INVALID');
  if (input.freshApproval.answer !== 'Yes' || !input.freshApproval.oneShot
    || input.freshApproval.factSetDigest !== input.factsAfterRecovery.factSetDigest
    || input.freshApproval.previewDigest !== input.ownerQuestion.previewDigest
    || input.freshApproval.issuedAt > input.evaluatedAt || input.freshApproval.expiresAt <= input.evaluatedAt) reasons.add('BROKER_BACKGROUND_APPROVAL_INVALID');
  if (input.factsBeforeEffect.factSetDigest !== input.factsAfterRecovery.factSetDigest || !input.factsBeforeEffect.allValid) reasons.add('BROKER_BACKGROUND_FACT_DRIFT');
  const result = {
    ...head('BackgroundApprovalWindowV1', input.schemaSetDigest),
    operationId: input.operationId,
    applicable,
    troubleshootingAttemptCount: input.troubleshootingAttempts.length,
    troubleshootingElapsedMs: elapsedMs,
    postRecoveryFactSetDigest: input.factsAfterRecovery.factSetDigest,
    preEffectFactSetDigest: input.factsBeforeEffect.factSetDigest,
    ownerQuestionDigest: hostAddress('KSTACK-BROKER-OWNER-QUESTION-V1', input.ownerQuestion),
    approvalDigest: hostAddress('KSTACK-BROKER-FRESH-APPROVAL-V1', input.freshApproval),
    readyForProtectedSubmission: applicable && reasons.size === 0,
    reasonCodes: [...reasons].sort()
  };
  return immutable({ result, resultDigest: address('BackgroundApprovalWindowV1', result) });
}
