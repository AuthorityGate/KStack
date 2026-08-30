import crypto from 'node:crypto';
import { hostCanonicalBytes, parseHostCanonicalJson } from './kstack-host-contract.mjs';
import { createIdentityVerificationReceipt, verifyGithubProtectedReview } from './kstack-domain-identity.mjs';

export const WEAKENING_ACTIONS = Object.freeze([
  'catalog-downgrade', 'policy-weakening', 'quarantine-reversal', 'required-pack-waiver'
]);
export const SEPARATION_ROLES = Object.freeze(['independent-approver', 'requester']);
export const WEAKENING_CLASSIFIER_VERSION = 1;

const DIGEST = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const PACK_ID = /^[a-z][a-z0-9-]{0,63}$/u;
const PRINCIPAL_ID = /^[1-9][0-9]{0,19}$/u;
const ADAPTER_ID = /^[a-z][a-z0-9-]{0,127}$/u;
const REASON_CODE = /^[A-Z][A-Z0-9_]{0,127}$/u;
const NONCE = /^[a-f0-9]{32,64}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const FAILURE_MODES = Object.freeze(['closed', 'continue', 'degrade']);
const MAX_STATE_BYTES = 1024 * 1024;
const ISSUED_WEAKENING_AUTHORIZATIONS = new WeakSet();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort() : [];
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function string(value, expression, code, maximum = 256) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed()
      || value.normalize('NFC') !== value || CONTROL_OR_BIDI.test(value) || !expression.test(value)) fail(code);
  return value;
}

function digest(value, code) {
  return string(value, DIGEST, code, 64);
}

function sameDigest(left, right, code) {
  const a = Buffer.from(digest(left, code), 'hex');
  const b = Buffer.from(digest(right, code), 'hex');
  if (!crypto.timingSafeEqual(a, b)) fail(code);
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
  return value;
}

function bool(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try { if (new Date(value).toISOString() !== value) fail(code); } catch { fail(code); }
  return value;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function sortedUnique(values, validator, code, maximum = 256, allowEmpty = false) {
  if (!Array.isArray(values) || values.length > maximum || (!allowEmpty && values.length === 0)) fail(code);
  const output = values.map(validator);
  const sorted = [...output].sort(compareUtf8);
  if (new Set(output).size !== output.length || output.some((value, index) => value !== sorted[index])) fail(code);
  return output;
}

function immutable(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function domainDigest(domain, value) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(hostCanonicalBytes(value)).digest('hex');
}

function rawDomainDigest(domain, bytes) {
  return crypto.createHash('sha256').update(Buffer.from(domain, 'utf8')).update(bytes).digest('hex');
}

function parseCanonical(bytes, code, maximum = MAX_STATE_BYTES) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array) || bytes.length > maximum) fail(code);
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail(code); }
  if (!hostCanonicalBytes(value).equals(Buffer.from(bytes))) fail(code);
  return value;
}

function validatePrincipal(input) {
  const code = 'SEPARATION_POLICY_INVALID';
  exact(input, ['adapterId', 'providerPrincipalId', 'personSubjectId', 'independenceGroupId', 'eligibleRoles', 'status'], code);
  const eligibleRoles = sortedUnique(input.eligibleRoles, (role) => {
    if (!SEPARATION_ROLES.includes(role)) fail(code);
    return role;
  }, code, SEPARATION_ROLES.length);
  if (input.status !== 'active') fail(code);
  return {
    adapterId: string(input.adapterId, ADAPTER_ID, code, 128),
    providerPrincipalId: string(input.providerPrincipalId, PRINCIPAL_ID, code, 20),
    personSubjectId: string(input.personSubjectId, ID, code, 256),
    independenceGroupId: string(input.independenceGroupId, ID, code, 256),
    eligibleRoles,
    status: 'active'
  };
}

function validateActionPolicy(input) {
  const code = 'SEPARATION_POLICY_INVALID';
  exact(input, ['action', 'requiredRoles', 'minimumDistinctPeople', 'minimumDistinctGroups'], code);
  if (!WEAKENING_ACTIONS.includes(input.action)) fail(code);
  const requiredRoles = sortedUnique(input.requiredRoles, (role) => {
    if (!SEPARATION_ROLES.includes(role)) fail(code);
    return role;
  }, code, SEPARATION_ROLES.length);
  if (requiredRoles.length !== 2 || input.minimumDistinctPeople !== 2 || input.minimumDistinctGroups !== 2) fail(code);
  return { action: input.action, requiredRoles, minimumDistinctPeople: 2, minimumDistinctGroups: 2 };
}

export function validateSeparationPolicy(input, expected = {}) {
  const code = 'SEPARATION_POLICY_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'principals', 'actions', 'policyVersion', 'effectiveAt'], code);
  if (input.artifactType !== 'kstack-separation-policy' || input.schemaVersion !== 1
      || !Array.isArray(input.principals) || input.principals.length < 2 || input.principals.length > 512
      || !Array.isArray(input.actions) || input.actions.length !== WEAKENING_ACTIONS.length) fail(code);
  const projectId = string(input.projectId, ID, code, 256);
  const repositoryImmutableId = string(input.repositoryImmutableId, ID, code, 256);
  if (expected.projectId !== undefined && projectId !== expected.projectId) fail(code);
  if (expected.repositoryImmutableId !== undefined && repositoryImmutableId !== expected.repositoryImmutableId) fail(code);
  const principals = input.principals.map(validatePrincipal);
  const principalKeys = principals.map((principal) => `${principal.adapterId}\u0000${principal.providerPrincipalId}`);
  const sortedPrincipalKeys = [...principalKeys].sort(compareUtf8);
  if (new Set(principalKeys).size !== principalKeys.length
      || principalKeys.some((key, index) => key !== sortedPrincipalKeys[index])) fail(code);
  const actions = input.actions.map(validateActionPolicy);
  const actionNames = actions.map((action) => action.action);
  if (new Set(actionNames).size !== WEAKENING_ACTIONS.length
      || actionNames.some((action, index) => action !== [...WEAKENING_ACTIONS].sort(compareUtf8)[index])) fail(code);
  const record = {
    artifactType: input.artifactType, schemaVersion: 1, projectId, repositoryImmutableId,
    principals, actions,
    policyVersion: integer(input.policyVersion, 1, 2_147_483_647, code),
    effectiveAt: instant(input.effectiveAt, code)
  };
  return immutable({ record, separationPolicyDigest: domainDigest('KSTACK-SEPARATION-POLICY-V1\n', record) });
}

export function parseSeparationPolicy(bytes, protection, expected = {}) {
  const code = 'SEPARATION_POLICY_UNAVAILABLE';
  exact(protection, ['source', 'repositoryResident', 'protected'], code);
  if (protection.source !== 'external-broker' || protection.repositoryResident !== false || protection.protected !== true) fail(code);
  let value;
  try { value = parseCanonical(bytes, code); } catch { fail(code); }
  return validateSeparationPolicy(value, expected);
}

function validatePolicyState(input) {
  const code = 'WEAKENING_STATE_INVALID';
  exact(input, [
    'artifactType', 'schemaVersion', 'requiredPacks', 'requiredLanes', 'minimumReviewerCount',
    'minimumConfidence', 'requiredEvidenceCount', 'freshnessSecondsMaximum',
    'blockOnSecurityFinding', 'minimumAuthorityCount', 'rollbackRequired',
    'retentionDaysMinimum', 'failureMode', 'waiverScopePacks', 'waiverExpiresAt',
    'catalogGeneration', 'quarantinedPacks'
  ], code);
  if (input.artifactType !== 'kstack-policy-state' || input.schemaVersion !== 1 || !FAILURE_MODES.includes(input.failureMode)) fail(code);
  const packSet = (values, allowEmpty = false) => sortedUnique(values, (value) => string(value, PACK_ID, code, 64), code, 256, allowEmpty);
  return {
    artifactType: input.artifactType, schemaVersion: 1,
    requiredPacks: packSet(input.requiredPacks), requiredLanes: packSet(input.requiredLanes),
    minimumReviewerCount: integer(input.minimumReviewerCount, 1, 64, code),
    minimumConfidence: integer(input.minimumConfidence, 0, 100, code),
    requiredEvidenceCount: integer(input.requiredEvidenceCount, 0, 100_000, code),
    freshnessSecondsMaximum: integer(input.freshnessSecondsMaximum, 1, Number.MAX_SAFE_INTEGER, code),
    blockOnSecurityFinding: bool(input.blockOnSecurityFinding, code),
    minimumAuthorityCount: integer(input.minimumAuthorityCount, 1, 64, code),
    rollbackRequired: bool(input.rollbackRequired, code),
    retentionDaysMinimum: integer(input.retentionDaysMinimum, 0, 365_000, code),
    failureMode: input.failureMode,
    waiverScopePacks: packSet(input.waiverScopePacks, true),
    waiverExpiresAt: input.waiverExpiresAt === null ? null : instant(input.waiverExpiresAt, code),
    catalogGeneration: integer(input.catalogGeneration, 0, Number.MAX_SAFE_INTEGER, code),
    quarantinedPacks: packSet(input.quarantinedPacks, true)
  };
}

function setRemoved(before, after) {
  const next = new Set(after);
  return before.filter((value) => !next.has(value));
}

function setAdded(before, after) {
  const prior = new Set(before);
  return after.filter((value) => !prior.has(value));
}

function classifierReceipt(beforeBytes, afterBytes) {
  let before;
  let after;
  try {
    before = validatePolicyState(parseCanonical(beforeBytes, 'WEAKENING_STATE_INVALID'));
    after = validatePolicyState(parseCanonical(afterBytes, 'WEAKENING_STATE_INVALID'));
  } catch {
    const receipt = {
      artifactType: 'kstack-weakening-classifier-receipt', schemaVersion: 1,
      classifierVersion: WEAKENING_CLASSIFIER_VERSION,
      beforeDigest: rawDomainDigest('KSTACK-POLICY-STATE-V1\n', Buffer.from(beforeBytes)),
      afterDigest: rawDomainDigest('KSTACK-POLICY-STATE-V1\n', Buffer.from(afterBytes)),
      classification: 'weakening', action: 'policy-weakening', affectedPackIds: [],
      reasonCodes: ['UNKNOWN_OR_INVALID_TRANSITION']
    };
    return immutable({ receipt, classifierReceiptDigest: domainDigest('KSTACK-WEAKENING-CLASSIFIER-RECEIPT-V1\n', receipt) });
  }
  const reasons = [];
  const affected = new Set();
  const removedPacks = setRemoved(before.requiredPacks, after.requiredPacks);
  for (const pack of removedPacks) affected.add(pack);
  if (removedPacks.length) reasons.push('REQUIRED_PACK_REMOVED');
  if (setRemoved(before.requiredLanes, after.requiredLanes).length) reasons.push('REQUIRED_LANE_REMOVED');
  if (after.minimumReviewerCount < before.minimumReviewerCount) reasons.push('REVIEWER_COUNT_REDUCED');
  if (after.minimumConfidence < before.minimumConfidence) reasons.push('CONFIDENCE_REDUCED');
  if (after.requiredEvidenceCount < before.requiredEvidenceCount) reasons.push('EVIDENCE_REDUCED');
  if (after.freshnessSecondsMaximum > before.freshnessSecondsMaximum) reasons.push('FRESHNESS_EXTENDED');
  if (before.blockOnSecurityFinding && !after.blockOnSecurityFinding) reasons.push('SECURITY_BLOCK_DISABLED');
  if (after.minimumAuthorityCount < before.minimumAuthorityCount) reasons.push('AUTHORITY_REDUCED');
  if (before.rollbackRequired && !after.rollbackRequired) reasons.push('ROLLBACK_DISABLED');
  if (after.retentionDaysMinimum < before.retentionDaysMinimum) reasons.push('RETENTION_REDUCED');
  if (before.failureMode === 'closed' && after.failureMode !== 'closed') reasons.push('FAILURE_MODE_OPENED');
  const waiverAdded = setAdded(before.waiverScopePacks, after.waiverScopePacks);
  for (const pack of waiverAdded) affected.add(pack);
  if (waiverAdded.length || before.waiverExpiresAt !== null && (after.waiverExpiresAt === null
      || Date.parse(after.waiverExpiresAt) > Date.parse(before.waiverExpiresAt))) reasons.push('WAIVER_BROADENED');
  if (after.catalogGeneration < before.catalogGeneration) reasons.push('CATALOG_DOWNGRADED');
  const reversedQuarantine = setRemoved(before.quarantinedPacks, after.quarantinedPacks);
  for (const pack of reversedQuarantine) affected.add(pack);
  if (reversedQuarantine.length) reasons.push('QUARANTINE_REVERSED');
  const action = reasons.includes('QUARANTINE_REVERSED') ? 'quarantine-reversal'
    : reasons.includes('CATALOG_DOWNGRADED') ? 'catalog-downgrade'
      : reasons.includes('REQUIRED_PACK_REMOVED') || reasons.includes('WAIVER_BROADENED') ? 'required-pack-waiver'
        : 'policy-weakening';
  const receipt = {
    artifactType: 'kstack-weakening-classifier-receipt', schemaVersion: 1,
    classifierVersion: WEAKENING_CLASSIFIER_VERSION,
    beforeDigest: domainDigest('KSTACK-POLICY-STATE-V1\n', before),
    afterDigest: domainDigest('KSTACK-POLICY-STATE-V1\n', after),
    classification: reasons.length ? 'weakening' : 'non-weakening', action,
    affectedPackIds: [...affected].sort(compareUtf8),
    reasonCodes: reasons.sort(compareUtf8)
  };
  return immutable({ receipt, classifierReceiptDigest: domainDigest('KSTACK-WEAKENING-CLASSIFIER-RECEIPT-V1\n', receipt) });
}

export function classifyWeakeningTransition(beforeBytes, afterBytes) {
  return classifierReceipt(beforeBytes, afterBytes);
}

function validateWeakeningRequest(input) {
  const code = 'WEAKENING_REQUEST_INVALID';
  exact(input, ['artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'action', 'beforeDigest', 'afterDigest', 'affectedPackIds', 'classifierVersion', 'classifierReceiptDigest', 'reasonCode', 'notBefore', 'expiresAt', 'nonce'], code);
  if (input.artifactType !== 'kstack-weakening-request' || input.schemaVersion !== 1 || !WEAKENING_ACTIONS.includes(input.action)
      || input.classifierVersion !== WEAKENING_CLASSIFIER_VERSION) fail(code);
  const request = {
    artifactType: input.artifactType, schemaVersion: 1,
    projectId: string(input.projectId, ID, code, 256),
    repositoryImmutableId: string(input.repositoryImmutableId, ID, code, 256),
    action: input.action, beforeDigest: digest(input.beforeDigest, code), afterDigest: digest(input.afterDigest, code),
    affectedPackIds: sortedUnique(input.affectedPackIds, (value) => string(value, PACK_ID, code, 64), code, 256, true),
    classifierVersion: WEAKENING_CLASSIFIER_VERSION,
    classifierReceiptDigest: digest(input.classifierReceiptDigest, code),
    reasonCode: string(input.reasonCode, REASON_CODE, code, 128),
    notBefore: instant(input.notBefore, code), expiresAt: instant(input.expiresAt, code),
    nonce: string(input.nonce, NONCE, code, 128)
  };
  if (Date.parse(request.notBefore) >= Date.parse(request.expiresAt) || request.beforeDigest === request.afterDigest) fail(code);
  return request;
}

export function createWeakeningRequest(input) {
  const request = validateWeakeningRequest({ artifactType: 'kstack-weakening-request', schemaVersion: 1, ...input });
  const canonicalBytes = hostCanonicalBytes(request);
  return immutable({ request, canonicalBytes, weakeningRequestDigest: domainDigest('KSTACK-WEAKENING-REQUEST-V1\n', request) });
}

export function parseWeakeningRequest(bytes) {
  const parsed = parseCanonical(bytes, 'WEAKENING_REQUEST_INVALID');
  const result = createWeakeningRequest(parsed);
  if (!result.canonicalBytes.equals(Buffer.from(bytes))) fail('WEAKENING_REQUEST_INVALID');
  return result;
}

function trustedTime(input) {
  const code = 'WEAKENING_TRUSTED_TIME_UNAVAILABLE';
  exact(input, ['now', 'sourceProfileDigest', 'attestationDigest', 'qualified', 'rollbackDetected'], code);
  if (input.qualified !== true || input.rollbackDetected !== false) fail(code);
  digest(input.sourceProfileDigest, code);
  digest(input.attestationDigest, code);
  return instant(input.now, code);
}

function ledgerHealth(value) {
  const code = 'WEAKENING_LEDGER_UNAVAILABLE';
  exact(value, ['available', 'rollbackDetected', 'generation', 'checkpointDigest'], code);
  if (value.available !== true) fail(code);
  if (value.rollbackDetected !== false) fail('WEAKENING_LEDGER_ROLLBACK');
  return { generation: integer(value.generation, 0, Number.MAX_SAFE_INTEGER, code), checkpointDigest: digest(value.checkpointDigest, code) };
}

function validateClassifierBinding(classifier, request) {
  const code = 'WEAKENING_CLASSIFIER_BINDING_INVALID';
  exact(classifier, ['receipt', 'classifierReceiptDigest'], code);
  exact(classifier.receipt, ['artifactType', 'schemaVersion', 'classifierVersion', 'beforeDigest', 'afterDigest', 'classification', 'action', 'affectedPackIds', 'reasonCodes'], code);
  const recomputed = domainDigest('KSTACK-WEAKENING-CLASSIFIER-RECEIPT-V1\n', classifier.receipt);
  sameDigest(recomputed, classifier.classifierReceiptDigest, code);
  sameDigest(classifier.classifierReceiptDigest, request.classifierReceiptDigest, code);
  sameDigest(classifier.receipt.beforeDigest, request.beforeDigest, code);
  sameDigest(classifier.receipt.afterDigest, request.afterDigest, code);
  if (classifier.receipt.classification !== 'weakening' || classifier.receipt.classifierVersion !== request.classifierVersion
      || classifier.receipt.action !== request.action
      || !hostCanonicalBytes(classifier.receipt.affectedPackIds).equals(hostCanonicalBytes(request.affectedPackIds))) fail(code);
}

function principalFor(policy, verification, role) {
  const principal = policy.record.principals.find((entry) => entry.adapterId === 'github-protected-review'
    && entry.providerPrincipalId === verification.providerPrincipalId);
  if (!principal || !principal.eligibleRoles.includes(role) || principal.status !== 'active') fail('INDEPENDENT_SECOND_PARTY_UNAVAILABLE');
  return principal;
}

export async function authorizeWeakening(input) {
  const code = 'WEAKENING_AUTHORIZATION_INVALID';
  exact(input, ['separationPolicyBytes', 'separationPolicyProtection', 'expectedSeparationPolicyDigest', 'weakeningRequestBytes', 'expectedWeakeningRequestDigest', 'classifier', 'requesterVerification', 'independentApproverVerification', 'trustedTime', 'policyAuthority', 'ledger'], code);
  if (!input.ledger || typeof input.ledger.inspect !== 'function' || typeof input.ledger.consumePairOnce !== 'function') fail('WEAKENING_LEDGER_UNAVAILABLE');
  if (!input.policyAuthority || typeof input.policyAuthority.confirmCurrent !== 'function') fail('SEPARATION_POLICY_UNAVAILABLE');
  const requestResult = parseWeakeningRequest(input.weakeningRequestBytes);
  sameDigest(requestResult.weakeningRequestDigest, input.expectedWeakeningRequestDigest, code);
  const request = requestResult.request;
  const policy = parseSeparationPolicy(input.separationPolicyBytes, input.separationPolicyProtection, {
    projectId: request.projectId, repositoryImmutableId: request.repositoryImmutableId
  });
  sameDigest(policy.separationPolicyDigest, input.expectedSeparationPolicyDigest, code);
  validateClassifierBinding(input.classifier, request);
  const now = trustedTime(input.trustedTime);
  if (Date.parse(policy.record.effectiveAt) > Date.parse(now)
      || Date.parse(request.notBefore) > Date.parse(now) || Date.parse(request.expiresAt) <= Date.parse(now)) fail('WEAKENING_AUTHORIZATION_EXPIRED');
  const actionPolicy = policy.record.actions.find((entry) => entry.action === request.action);
  if (!actionPolicy) fail('SEPARATION_POLICY_INVALID');

  const requester = verifyGithubProtectedReview(input.requesterVerification);
  const approver = verifyGithubProtectedReview(input.independentApproverVerification);
  if (requester.trustRoot.trustRootDigest !== approver.trustRoot.trustRootDigest) fail('WEAKENING_RECEIPT_DISAGREEMENT');
  const sharedAdapter = requester.trustRoot.record.adapters.find((entry) => entry.adapterId === 'github-protected-review'
    && entry.adapterVersion === '1.0.0');
  if (!sharedAdapter || !sharedAdapter.allowedProviderPrincipalIds.includes(requester.providerPrincipalId)
      || !sharedAdapter.allowedProviderPrincipalIds.includes(approver.providerPrincipalId)
      || !sharedAdapter.allowedActions.includes(request.action)) fail('WEAKENING_RECEIPT_DISAGREEMENT');
  const requesterReceipt = createIdentityVerificationReceipt(requester);
  const approverReceipt = createIdentityVerificationReceipt(approver);
  for (const verification of [requester, approver]) {
    const identityRequest = verification.requestRecord.request;
    if (identityRequest.projectId !== request.projectId || identityRequest.repositoryImmutableId !== request.repositoryImmutableId
        || identityRequest.action !== request.action || identityRequest.targetDigest !== requestResult.weakeningRequestDigest
        || identityRequest.policyDigest !== policy.separationPolicyDigest
        || !verification.requestRecord.canonicalBytes.equals(requester.requestRecord.canonicalBytes)) fail('WEAKENING_RECEIPT_DISAGREEMENT');
  }
  const requesterPrincipal = principalFor(policy, requester, 'requester');
  const approverPrincipal = principalFor(policy, approver, 'independent-approver');
  if (requester.providerPrincipalId === approver.providerPrincipalId
      || requesterPrincipal.personSubjectId === approverPrincipal.personSubjectId
      || requesterPrincipal.independenceGroupId === approverPrincipal.independenceGroupId) fail('INDEPENDENT_SECOND_PARTY_UNAVAILABLE');

  const policyConfirmation = await input.policyAuthority.confirmCurrent(policy.separationPolicyDigest);
  exact(policyConfirmation, ['current', 'policyDigest', 'checkpointDigest', 'rollbackDetected'], 'SEPARATION_POLICY_UNAVAILABLE');
  if (policyConfirmation.current !== true || policyConfirmation.rollbackDetected !== false) fail('SEPARATION_POLICY_STALE');
  sameDigest(policyConfirmation.policyDigest, policy.separationPolicyDigest, 'SEPARATION_POLICY_STALE');
  digest(policyConfirmation.checkpointDigest, 'SEPARATION_POLICY_UNAVAILABLE');
  const before = ledgerHealth(await input.ledger.inspect());
  const pairKeyDigest = domainDigest('KSTACK-WEAKENING-CONSUMPTION-KEY-V1\n', {
    projectId: request.projectId, weakeningRequestDigest: requestResult.weakeningRequestDigest,
    separationPolicyDigest: policy.separationPolicyDigest
  });
  const consumption = await input.ledger.consumePairOnce(immutable({
    pairKeyDigest, weakeningRequestDigest: requestResult.weakeningRequestDigest,
    separationPolicyDigest: policy.separationPolicyDigest,
    requesterReceiptDigest: requesterReceipt.receiptDigest,
    independentApproverReceiptDigest: approverReceipt.receiptDigest,
    policyCheckpointDigest: policyConfirmation.checkpointDigest,
    priorGeneration: before.generation, priorCheckpointDigest: before.checkpointDigest
  }));
  exact(consumption, ['consumed', 'generation', 'previousCheckpointDigest', 'checkpointDigest', 'rollbackWitnessDigest', 'consumptionId'], 'WEAKENING_LEDGER_UNAVAILABLE');
  if (consumption.consumed !== true) fail('WEAKENING_REPLAY_REFUSED');
  if (consumption.generation !== before.generation + 1 || consumption.previousCheckpointDigest !== before.checkpointDigest) fail('WEAKENING_LEDGER_ROLLBACK');
  digest(consumption.checkpointDigest, 'WEAKENING_LEDGER_UNAVAILABLE');
  digest(consumption.rollbackWitnessDigest, 'WEAKENING_LEDGER_UNAVAILABLE');
  string(consumption.consumptionId, ID, 'WEAKENING_LEDGER_UNAVAILABLE', 256);
  const expiresAt = [request.expiresAt, requesterReceipt.receipt.expiresAt, approverReceipt.receipt.expiresAt]
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const authorization = {
    artifactType: 'kstack-weakening-authorization', schemaVersion: 1,
    projectId: request.projectId, repositoryImmutableId: request.repositoryImmutableId,
    weakeningRequestDigest: requestResult.weakeningRequestDigest,
    separationPolicyDigest: policy.separationPolicyDigest,
    requesterReceiptDigest: requesterReceipt.receiptDigest,
    independentApproverReceiptDigest: approverReceipt.receiptDigest,
    requesterPersonSubjectId: requesterPrincipal.personSubjectId,
    approverPersonSubjectId: approverPrincipal.personSubjectId,
    authorizedAt: now, expiresAt, consumptionId: consumption.consumptionId
  };
  ISSUED_WEAKENING_AUTHORIZATIONS.add(authorization);
  return immutable({
    authorization,
    weakeningAuthorizationDigest: domainDigest('KSTACK-WEAKENING-AUTHORIZATION-V1\n', authorization),
    consumption
  });
}

export function validateWeakeningTransitionUse(input) {
  const code = 'WEAKENING_TARGET_STALE';
  exact(input, ['authorization', 'authorizationDigest', 'requestBytes', 'liveBeforeDigest', 'candidateAfterDigest', 'action', 'affectedPackIds', 'trustedTime'], code);
  exact(input.authorization, ['artifactType', 'schemaVersion', 'projectId', 'repositoryImmutableId', 'weakeningRequestDigest', 'separationPolicyDigest', 'requesterReceiptDigest', 'independentApproverReceiptDigest', 'requesterPersonSubjectId', 'approverPersonSubjectId', 'authorizedAt', 'expiresAt', 'consumptionId'], code);
  const authorizedAt = instant(input.authorization.authorizedAt, 'WEAKENING_AUTHORIZATION_INVALID');
  const expiresAt = instant(input.authorization.expiresAt, 'WEAKENING_AUTHORIZATION_INVALID');
  if (!ISSUED_WEAKENING_AUTHORIZATIONS.has(input.authorization)) fail('WEAKENING_AUTHORIZATION_PROVENANCE_INVALID');
  const recomputedAuthorization = domainDigest('KSTACK-WEAKENING-AUTHORIZATION-V1\n', input.authorization);
  sameDigest(recomputedAuthorization, input.authorizationDigest, code);
  const request = parseWeakeningRequest(input.requestBytes);
  sameDigest(request.weakeningRequestDigest, input.authorization.weakeningRequestDigest, code);
  sameDigest(request.request.beforeDigest, input.liveBeforeDigest, code);
  sameDigest(request.request.afterDigest, input.candidateAfterDigest, code);
  if (request.request.action !== input.action
      || !hostCanonicalBytes(request.request.affectedPackIds).equals(hostCanonicalBytes(input.affectedPackIds))) fail(code);
  const now = trustedTime(input.trustedTime);
  if (Date.parse(authorizedAt) > Date.parse(now)
      || Date.parse(expiresAt) <= Date.parse(now)) fail('WEAKENING_AUTHORIZATION_EXPIRED');
  return immutable({
    beforeDigest: request.request.beforeDigest, afterDigest: request.request.afterDigest,
    weakeningRequestDigest: request.weakeningRequestDigest,
    weakeningAuthorizationDigest: recomputedAuthorization,
    compareAndSwapRequired: true
  });
}
