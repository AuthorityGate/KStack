import {
  assertAsciiId,
  assertCollectionOrder,
  assertRegistryId,
  assertTimestamp,
  artifactHead,
  hostAddress,
  hostCanonicalBytes,
  validateHostArtifact,
  validateHostArtifactContext
} from './kstack-host-contract.mjs';

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plain(value, code = 'KSTACK_HOST_CONTEXT_SHAPE_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  return value;
}

function exact(value, keys, code = 'KSTACK_HOST_CONTEXT_SHAPE_INVALID') {
  plain(value, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
  return value;
}

function digest(value, code = 'KSTACK_HOST_CONTEXT_DIGEST_INVALID') {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(code);
  return value;
}

function nullableDigest(value, code) {
  if (value !== null) digest(value, code);
  return value;
}

function uint(value, positive = false, code = 'KSTACK_HOST_CONTEXT_INTEGER_INVALID') {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > MAX_SAFE) fail(code);
  return value;
}

function member(value, values, code = 'KSTACK_HOST_CONTEXT_ENUM_INVALID') {
  if (!values.includes(value)) fail(code);
  return value;
}

function time(value) {
  return assertTimestamp(value);
}

function orderedTime(start, end, code = 'KSTACK_HOST_CONTEXT_EXPIRED') {
  time(start); time(end);
  if (start >= end) fail(code);
}

function same(left, right) {
  return hostCanonicalBytes(left).equals(hostCanonicalBytes(right));
}

function immutable(value) {
  if (value && typeof value === 'object') {
    if (Buffer.isBuffer(value)) return value;
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

export const HOST_ASSURANCE_LEVELS = Object.freeze([
  'PUBLIC_UNAUTHENTICATED', 'AUTHENTICATED_LOCAL', 'PROTECTED_BROKER'
]);

export const HOST_OPERATION_CLASSES = Object.freeze([
  'LOCAL_READ', 'ADVISORY', 'LOCAL_WRITE', 'ASK_SIDE_EFFECT', 'PRIVILEGED_SIDE_EFFECT', 'BACKGROUND'
]);

export const HOST_ADMISSION_OUTCOMES = Object.freeze(['ADMITTED', 'DENIED', 'CONTEXT_UNAVAILABLE']);

export const HOST_ADMISSION_REASON_CODES = Object.freeze([
  'KSTACK_HOST_CHANNEL_UNAUTHENTICATED', 'KSTACK_HOST_ASSURANCE_INSUFFICIENT', 'KSTACK_HOST_CONTEXT_UNAVAILABLE',
  'KSTACK_HOST_CONTEXT_EXPIRED', 'KSTACK_HOST_SESSION_MISMATCH', 'KSTACK_HOST_PRINCIPAL_MISMATCH',
  'KSTACK_HOST_REPOSITORY_AMBIGUOUS', 'KSTACK_HOST_REPOSITORY_MISMATCH', 'KSTACK_HOST_ROOT_CHANGED',
  'KSTACK_HOST_INSTANCE_CHANGED', 'KSTACK_HOST_BUILD_CHANGED', 'KSTACK_HOST_ADAPTER_CHANGED',
  'KSTACK_HOST_ACTIVE_SET_CHANGED', 'KSTACK_HOST_POLICY_CHANGED', 'KSTACK_HOST_OPERATION_UNKNOWN',
  'KSTACK_HOST_OPERATION_SCHEMA_MISMATCH', 'KSTACK_HOST_PROFILE_MISMATCH', 'KSTACK_HOST_CLASS_MISMATCH',
  'KSTACK_HOST_INPUT_MISMATCH', 'KSTACK_HOST_LIMITS_INVALID', 'KSTACK_HOST_EVIDENCE_SET_CHANGED',
  'KSTACK_HOST_APPROVAL_REQUIRED', 'KSTACK_HOST_APPROVAL_DENIED', 'KSTACK_HOST_APPROVAL_SUBJECT_MISMATCH',
  'KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH', 'KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH', 'KSTACK_HOST_TRANSPORT_CHANGED'
]);

const ADMISSION_MESSAGES = Object.freeze({
  KSTACK_HOST_CHANNEL_UNAUTHENTICATED: 'The protected channel could not be authenticated.',
  KSTACK_HOST_ASSURANCE_INSUFFICIENT: 'The authenticated channel does not meet the operation assurance requirement.',
  KSTACK_HOST_CONTEXT_UNAVAILABLE: 'The protected request context is unavailable.',
  KSTACK_HOST_CONTEXT_EXPIRED: 'The protected request context has expired.',
  KSTACK_HOST_SESSION_MISMATCH: 'The protected session does not match the request context.',
  KSTACK_HOST_PRINCIPAL_MISMATCH: 'The authenticated principal does not match the request context.',
  KSTACK_HOST_REPOSITORY_AMBIGUOUS: 'The repository context could not be resolved unambiguously.',
  KSTACK_HOST_REPOSITORY_MISMATCH: 'The repository context does not match the request.',
  KSTACK_HOST_ROOT_CHANGED: 'The opened repository root changed after admission.',
  KSTACK_HOST_INSTANCE_CHANGED: 'The running host instance changed after admission.',
  KSTACK_HOST_BUILD_CHANGED: 'The running host build changed after admission.',
  KSTACK_HOST_ADAPTER_CHANGED: 'The host adapter changed after admission.',
  KSTACK_HOST_ACTIVE_SET_CHANGED: 'The active governance set changed after admission.',
  KSTACK_HOST_POLICY_CHANGED: 'The active policy changed after admission.',
  KSTACK_HOST_OPERATION_UNKNOWN: 'The requested operation is not registered.',
  KSTACK_HOST_OPERATION_SCHEMA_MISMATCH: 'The operation schema does not match its protected registry entry.',
  KSTACK_HOST_PROFILE_MISMATCH: 'The protected operation profile does not match the registry.',
  KSTACK_HOST_CLASS_MISMATCH: 'The operation class does not match the protected profile.',
  KSTACK_HOST_INPUT_MISMATCH: 'A request input does not match its validated artifact.',
  KSTACK_HOST_LIMITS_INVALID: 'The requested or effective limits are invalid.',
  KSTACK_HOST_EVIDENCE_SET_CHANGED: 'The bound host evidence set changed after admission.',
  KSTACK_HOST_APPROVAL_REQUIRED: 'This operation requires protected approval.',
  KSTACK_HOST_APPROVAL_DENIED: 'Protected approval was denied.',
  KSTACK_HOST_APPROVAL_SUBJECT_MISMATCH: 'The approval subject does not match the request.',
  KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH: 'The protected approval display does not match the subject.',
  KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH: 'The protected approval envelope is invalid or does not match the request.',
  KSTACK_HOST_TRANSPORT_CHANGED: 'The admitted request changed during transport.'
});

const ADMISSION_EXPLANATIONS = Object.freeze(Object.fromEntries(HOST_ADMISSION_REASON_CODES.map((code) => [code, Object.freeze({
  code,
  message: ADMISSION_MESSAGES[code]
})])));

export function hostAdmissionExplanation(reasonCode) {
  member(reasonCode, HOST_ADMISSION_REASON_CODES);
  return ADMISSION_EXPLANATIONS[reasonCode];
}

export const HOST_CONTEXT_IDENTITIES = immutable({
  ContextSourceProfileV1: { schemaId: 'kstack.context-source-profile.v1', domain: 'KSTACK-CONTEXT-SOURCE-PROFILE-V1' },
  AuthenticatedChannelContextV1: { schemaId: 'kstack.authenticated-channel-context.v1', domain: 'KSTACK-AUTHENTICATED-CHANNEL-CONTEXT-V1' },
  RepositoryContextV1: { schemaId: 'kstack.repository-context.v1', domain: 'KSTACK-REPOSITORY-CONTEXT-V1' },
  ProtectedSessionContextV1: { schemaId: 'kstack.protected-session-context.v1', domain: 'KSTACK-PROTECTED-SESSION-CONTEXT-V1' },
  TrustedRequestContextV1: { schemaId: 'kstack.trusted-request-context.v1', domain: 'KSTACK-TRUSTED-REQUEST-CONTEXT-V1' },
  OperationRegistryV1: { schemaId: 'kstack.operation-registry.v1', domain: 'KSTACK-OPERATION-REGISTRY-V1' },
  UntrustedOperationProposalV1: { schemaId: 'kstack.untrusted-operation-proposal.v1', domain: 'KSTACK-UNTRUSTED-OPERATION-PROPOSAL-V1' },
  ApprovalSubjectV1: { schemaId: 'kstack.approval-subject.v1', domain: 'KSTACK-APPROVAL-SUBJECT-V1' },
  ApprovalDisplayV1: { schemaId: 'kstack.approval-display.v1', domain: 'KSTACK-APPROVAL-DISPLAY-V1' },
  ProtectedDisplayReceiptV1: { schemaId: 'kstack.protected-display-receipt.v1', domain: 'KSTACK-PROTECTED-DISPLAY-RECEIPT-V1' },
  ProtectedApprovalEnvelopeV1: { schemaId: 'kstack.protected-approval-envelope.v1', domain: 'KSTACK-PROTECTED-APPROVAL-ENVELOPE-V1' },
  AdmissionTranscriptV1: { schemaId: 'kstack.admission-transcript.v1', domain: 'KSTACK-ADMISSION-TRANSCRIPT-V1' },
  RequestAdmissionResultV1: { schemaId: 'kstack.request-admission-result.v1', domain: 'KSTACK-REQUEST-ADMISSION-RESULT-V1' }
});

export function contextHead(name, schemaSetDigest) {
  const identity = HOST_CONTEXT_IDENTITIES[name];
  if (!identity) fail('KSTACK_HOST_CONTEXT_SCHEMA_UNKNOWN');
  return immutable({ schemaId: identity.schemaId, schemaVersion: 1, schemaSetDigest: digest(schemaSetDigest) });
}

function validateHead(name, value, fields) {
  const identity = HOST_CONTEXT_IDENTITIES[name];
  if (!identity) fail('KSTACK_HOST_CONTEXT_SCHEMA_UNKNOWN');
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', ...fields]);
  if (value.schemaId !== identity.schemaId || value.schemaVersion !== 1) fail('KSTACK_HOST_CONTEXT_HEAD_INVALID');
  digest(value.schemaSetDigest);
}

function address(name, value) {
  return immutable({ name, canonicalBytes: hostCanonicalBytes(value), objectDigest: hostAddress(HOST_CONTEXT_IDENTITIES[name].domain, value) });
}

function inputRef(value) {
  exact(value, ['name', 'mediaTypeId', 'artifactRef']);
  assertAsciiId(value.name); assertRegistryId(value.mediaTypeId);
  exact(value.artifactRef, ['schemaDigest', 'objectDigest', 'byteCount']);
  digest(value.artifactRef.schemaDigest); digest(value.artifactRef.objectDigest); uint(value.artifactRef.byteCount);
}

function limits(value) {
  exact(value, ['deadlineMs', 'maxInputBytes', 'maxOutputBytes'], 'KSTACK_HOST_LIMITS_INVALID');
  uint(value.deadlineMs, true, 'KSTACK_HOST_LIMITS_INVALID');
  uint(value.maxInputBytes, true, 'KSTACK_HOST_LIMITS_INVALID');
  uint(value.maxOutputBytes, true, 'KSTACK_HOST_LIMITS_INVALID');
  return value;
}

function validateInputs(values) {
  if (!Array.isArray(values) || values.length > 64) fail('KSTACK_HOST_INPUT_MISMATCH');
  for (const value of values) inputRef(value);
  assertCollectionOrder(values, { mode: 'SET_BY_FIELDS', keyFields: ['name'], keyKinds: ['ASCII'] });
}

function registryValues(values, code = 'KSTACK_HOST_CONTEXT_SHAPE_INVALID') {
  if (!Array.isArray(values) || values.length > 128) fail(code);
  for (const value of values) assertRegistryId(value);
  assertCollectionOrder(values, { mode: 'SET_BY_VALUE_ASCII' });
}

function validateContextSource(value) {
  const fields = ['profileId', 'implementationDigest', 'configurationDigest', 'maximumAssuranceLevel', 'activeSetDigest'];
  validateHead('ContextSourceProfileV1', value, fields);
  assertAsciiId(value.profileId); digest(value.implementationDigest); digest(value.configurationDigest); digest(value.activeSetDigest);
  member(value.maximumAssuranceLevel, HOST_ASSURANCE_LEVELS);
}

function validateChannel(value) {
  const fields = [
    'contextSourceProfileDigest', 'channelInstanceDigest', 'launchNonceDigest', 'peerPrincipalDigest', 'peerEvidenceDigest',
    'processEvidenceDigest', 'hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'establishedAt', 'expiresAt', 'assuranceLevel'
  ];
  validateHead('AuthenticatedChannelContextV1', value, fields);
  for (const field of fields.slice(0, 3)) digest(value[field]);
  nullableDigest(value.peerPrincipalDigest, 'KSTACK_HOST_PRINCIPAL_MISMATCH');
  for (const field of ['peerEvidenceDigest', 'processEvidenceDigest', 'hostInstanceDigest', 'hostBuildDigest', 'adapterDigest']) digest(value[field]);
  member(value.assuranceLevel, HOST_ASSURANCE_LEVELS); orderedTime(value.establishedAt, value.expiresAt);
  if ((value.assuranceLevel === 'PUBLIC_UNAUTHENTICATED') !== (value.peerPrincipalDigest === null)) fail('KSTACK_HOST_PRINCIPAL_MISMATCH');
}

function validateRepository(value) {
  const fields = [
    'canonicalRepositoryIdentityDigest', 'worktreeIdentityDigest', 'vcsMetadataIdentityDigest', 'openedRootIdentityDigest',
    'mountNamespaceIdentityDigest', 'caseSensitivityProfileId', 'rootMeasurementEvidenceDigest', 'observedAt', 'expiresAt'
  ];
  validateHead('RepositoryContextV1', value, fields);
  for (const field of fields.slice(0, 5)) digest(value[field]);
  assertRegistryId(value.caseSensitivityProfileId); digest(value.rootMeasurementEvidenceDigest);
  orderedTime(value.observedAt, value.expiresAt);
}

function validateSession(value) {
  const fields = [
    'sessionIdDigest', 'authenticatedChannelContextDigest', 'principalDigest', 'hostInstanceDigest', 'hostBuildDigest', 'adapterDigest',
    'repositoryContextDigest', 'activeSetDigest', 'issuedAt', 'expiresAt', 'revocationStateDigest'
  ];
  validateHead('ProtectedSessionContextV1', value, fields);
  digest(value.sessionIdDigest); digest(value.authenticatedChannelContextDigest); nullableDigest(value.principalDigest, 'KSTACK_HOST_PRINCIPAL_MISMATCH');
  for (const field of ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest', 'repositoryContextDigest', 'activeSetDigest', 'revocationStateDigest']) digest(value[field]);
  orderedTime(value.issuedAt, value.expiresAt);
}

function validateTrustedRequestContext(value) {
  const fields = [
    'assuranceLevel', 'authenticatedChannelContextDigest', 'protectedSessionContextDigest', 'principalDigest', 'hostInstanceDigest',
    'runningHostBuildDigest', 'adapterDigest', 'repositoryContextDigest', 'openedRootIdentityDigest', 'activeSetDigest', 'policyDigest',
    'contextSourceProfileDigest', 'derivedAt', 'expiresAt'
  ];
  validateHead('TrustedRequestContextV1', value, fields);
  member(value.assuranceLevel, HOST_ASSURANCE_LEVELS);
  digest(value.authenticatedChannelContextDigest); digest(value.protectedSessionContextDigest);
  nullableDigest(value.principalDigest, 'KSTACK_HOST_PRINCIPAL_MISMATCH');
  for (const field of ['hostInstanceDigest', 'runningHostBuildDigest', 'adapterDigest', 'repositoryContextDigest', 'openedRootIdentityDigest', 'activeSetDigest', 'policyDigest', 'contextSourceProfileDigest']) digest(value[field]);
  orderedTime(value.derivedAt, value.expiresAt);
  if ((value.assuranceLevel === 'PUBLIC_UNAUTHENTICATED') !== (value.principalDigest === null)) fail('KSTACK_HOST_PRINCIPAL_MISMATCH');
}

function validateRegistry(value) {
  validateHead('OperationRegistryV1', value, ['registryId', 'activeSetDigest', 'entries']);
  assertAsciiId(value.registryId); digest(value.activeSetDigest);
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > 1024) fail('KSTACK_HOST_OPERATION_UNKNOWN');
  for (const row of value.entries) {
    exact(row, ['operationId', 'operationSchemaDigest', 'requirementProfileDigest']);
    assertRegistryId(row.operationId); digest(row.operationSchemaDigest); digest(row.requirementProfileDigest);
  }
  assertCollectionOrder(value.entries, { mode: 'SET_BY_FIELDS', keyFields: ['operationId', 'operationSchemaDigest'], keyKinds: ['ASCII', 'DIGEST'] });
}

function validateProposal(value) {
  validateHead('UntrustedOperationProposalV1', value, ['operationId', 'inputs', 'requestedLimits', 'candidateRepositoryLocatorDigest', 'displayEchoes']);
  assertRegistryId(value.operationId); validateInputs(value.inputs); limits(value.requestedLimits); digest(value.candidateRepositoryLocatorDigest);
  exact(value.displayEchoes, ['operationClassId', 'hostInstanceDigest', 'hostBuildDigest', 'adapterDigest']);
  if (value.displayEchoes.operationClassId !== null) member(value.displayEchoes.operationClassId, HOST_OPERATION_CLASSES, 'KSTACK_HOST_CLASS_MISMATCH');
  for (const field of ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest']) nullableDigest(value.displayEchoes[field], 'KSTACK_HOST_TRANSPORT_CHANGED');
}

const SUBJECT_FIELDS = [
  'operationId', 'operationSchemaDigest', 'requirementProfileDigest', 'repositoryContextDigest', 'trustedRequestContextDigest',
  'activeSetDigest', 'policyDigest', 'inputs', 'limits', 'hostEvidenceSetDigest', 'nonceDigest', 'idempotencyKeyDigest',
  'createdAt', 'expiresAt', 'approvalAudienceId', 'actionScopeDigest'
];

function validateApprovalSubject(value) {
  validateHead('ApprovalSubjectV1', value, SUBJECT_FIELDS);
  assertRegistryId(value.operationId);
  for (const field of ['operationSchemaDigest', 'requirementProfileDigest', 'repositoryContextDigest', 'trustedRequestContextDigest', 'activeSetDigest', 'policyDigest', 'hostEvidenceSetDigest', 'nonceDigest', 'idempotencyKeyDigest', 'actionScopeDigest']) digest(value[field]);
  validateInputs(value.inputs); limits(value.limits); assertRegistryId(value.approvalAudienceId); orderedTime(value.createdAt, value.expiresAt);
}

function validateDisplay(value) {
  const fields = [
    'approvalSubjectDigest', 'principalDisplayRefDigest', 'repositoryDisplayRefDigest', 'worktreeDisplayRefDigest', 'hostInstanceDigest',
    'hostBuildDigest', 'operationId', 'operationClassId', 'activeSetDigest', 'policyDigest', 'operationSchemaDigest',
    'requirementProfileDigest', 'inputs', 'effectiveLimits', 'sideEffectTargetRefDigest', 'approvalAudienceId', 'actionScopeDigest',
    'nonceDigest', 'expiresAt', 'riskCodes', 'recoveryCodes'
  ];
  validateHead('ApprovalDisplayV1', value, fields);
  for (const field of ['approvalSubjectDigest', 'principalDisplayRefDigest', 'repositoryDisplayRefDigest', 'worktreeDisplayRefDigest', 'hostInstanceDigest', 'hostBuildDigest', 'activeSetDigest', 'policyDigest', 'operationSchemaDigest', 'requirementProfileDigest', 'actionScopeDigest', 'nonceDigest']) digest(value[field]);
  assertRegistryId(value.operationId); member(value.operationClassId, HOST_OPERATION_CLASSES); limits(value.effectiveLimits);
  nullableDigest(value.sideEffectTargetRefDigest, 'KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH'); assertRegistryId(value.approvalAudienceId); time(value.expiresAt);
  if (!Array.isArray(value.inputs) || value.inputs.length > 64) fail('KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH');
  for (const row of value.inputs) {
    exact(row, ['name', 'schemaDigest', 'objectDigest', 'byteCount']); assertAsciiId(row.name);
    digest(row.schemaDigest); digest(row.objectDigest); uint(row.byteCount);
  }
  assertCollectionOrder(value.inputs, { mode: 'SET_BY_FIELDS', keyFields: ['name'], keyKinds: ['ASCII'] });
  registryValues(value.riskCodes); registryValues(value.recoveryCodes);
}

function validateDisplayReceipt(value) {
  validateHead('ProtectedDisplayReceiptV1', value, ['approvalDisplayDigest', 'presentationChannelDigest', 'presentedAt']);
  digest(value.approvalDisplayDigest); digest(value.presentationChannelDigest); time(value.presentedAt);
}

function validateEnvelope(value) {
  const fields = [
    'approvalSubjectDigest', 'approvalDisplayDigest', 'displayReceiptDigest', 'principalDigest', 'protectedSessionContextDigest',
    'repositoryContextDigest', 'hostInstanceDigest', 'hostBuildDigest', 'approvalAudienceId', 'actionScopeDigest', 'nonceDigest',
    'issuedAt', 'expiresAt', 'decision'
  ];
  validateHead('ProtectedApprovalEnvelopeV1', value, fields);
  for (const field of ['approvalSubjectDigest', 'approvalDisplayDigest', 'displayReceiptDigest', 'principalDigest', 'protectedSessionContextDigest', 'repositoryContextDigest', 'hostInstanceDigest', 'hostBuildDigest', 'actionScopeDigest', 'nonceDigest']) digest(value[field]);
  assertRegistryId(value.approvalAudienceId); orderedTime(value.issuedAt, value.expiresAt);
  if (value.decision !== 'APPROVE') fail('KSTACK_HOST_APPROVAL_DENIED');
}

function validateTranscript(value) {
  const fields = [
    'proposalDigest', 'contextSourceProfileDigest', 'authenticatedChannelContextDigest', 'repositoryContextDigest',
    'protectedSessionContextDigest', 'trustedRequestContextDigest', 'operationRegistryDigest', 'requirementProfileDigest',
    'approvalSubjectDigest', 'approvalDisplayDigest', 'displayReceiptDigest', 'approvalEnvelopeDigest', 'requestDigest',
    'outcome', 'reasonCode', 'occurredAt'
  ];
  validateHead('AdmissionTranscriptV1', value, fields);
  digest(value.proposalDigest);
  for (const field of fields.slice(1, 13)) nullableDigest(value[field], 'KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH');
  member(value.outcome, HOST_ADMISSION_OUTCOMES);
  if (value.outcome === 'ADMITTED') {
    if (value.reasonCode !== null) fail('KSTACK_HOST_CONTEXT_SHAPE_INVALID');
  } else member(value.reasonCode, HOST_ADMISSION_REASON_CODES);
  time(value.occurredAt);
}

function validateAdmissionResult(value) {
  const fields = [
    'proposalDigest', 'trustedRequestContextDigest', 'operationClassId', 'requirementProfileDigest', 'requestDigest',
    'approvalSubjectDigest', 'approvalDisplayDigest', 'approvalEnvelopeDigest', 'outcome', 'reasonCode', 'occurredAt'
  ];
  validateHead('RequestAdmissionResultV1', value, fields);
  digest(value.proposalDigest);
  for (const field of ['trustedRequestContextDigest', 'requirementProfileDigest', 'requestDigest', 'approvalSubjectDigest', 'approvalDisplayDigest', 'approvalEnvelopeDigest']) nullableDigest(value[field], 'KSTACK_HOST_CONTEXT_SHAPE_INVALID');
  if (value.operationClassId !== null) member(value.operationClassId, HOST_OPERATION_CLASSES);
  member(value.outcome, HOST_ADMISSION_OUTCOMES);
  if (value.outcome === 'ADMITTED') {
    if (value.reasonCode !== null) fail('KSTACK_HOST_CONTEXT_SHAPE_INVALID');
  } else member(value.reasonCode, HOST_ADMISSION_REASON_CODES);
  time(value.occurredAt);
  const admitted = value.outcome === 'ADMITTED';
  if (admitted !== [value.trustedRequestContextDigest, value.operationClassId, value.requirementProfileDigest, value.requestDigest].every((entry) => entry !== null)) fail('KSTACK_HOST_CONTEXT_SHAPE_INVALID');
}

const CONTEXT_VALIDATORS = Object.freeze({
  ContextSourceProfileV1: validateContextSource,
  AuthenticatedChannelContextV1: validateChannel,
  RepositoryContextV1: validateRepository,
  ProtectedSessionContextV1: validateSession,
  TrustedRequestContextV1: validateTrustedRequestContext,
  OperationRegistryV1: validateRegistry,
  UntrustedOperationProposalV1: validateProposal,
  ApprovalSubjectV1: validateApprovalSubject,
  ApprovalDisplayV1: validateDisplay,
  ProtectedDisplayReceiptV1: validateDisplayReceipt,
  ProtectedApprovalEnvelopeV1: validateEnvelope,
  AdmissionTranscriptV1: validateTranscript,
  RequestAdmissionResultV1: validateAdmissionResult
});

export function validateHostContextArtifact(name, value) {
  const validator = CONTEXT_VALIDATORS[name];
  if (!validator) fail('KSTACK_HOST_CONTEXT_SCHEMA_UNKNOWN');
  hostCanonicalBytes(value);
  validator(value);
  return address(name, value);
}

function requireFunction(value) {
  if (typeof value !== 'function') fail('KSTACK_HOST_CONTEXT_SOURCE_INVALID');
  return value;
}

function validateRuntime(value) {
  exact(value, ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest'], 'KSTACK_HOST_TRANSPORT_CHANGED');
  digest(value.hostInstanceDigest); digest(value.hostBuildDigest); digest(value.adapterDigest);
  return value;
}

function validateClassRule(value) {
  exact(value, [
    'operationClassId', 'minimumAssuranceLevel', 'approvalRequired', 'maxLimits', 'approvalAudienceId', 'actionScopeDigest',
    'principalDisplayRefDigest', 'sideEffectTargetRefDigest', 'riskCodes', 'recoveryCodes'
  ], 'KSTACK_HOST_PROFILE_MISMATCH');
  member(value.operationClassId, HOST_OPERATION_CLASSES); member(value.minimumAssuranceLevel, HOST_ASSURANCE_LEVELS);
  if (typeof value.approvalRequired !== 'boolean') fail('KSTACK_HOST_PROFILE_MISMATCH');
  limits(value.maxLimits); assertRegistryId(value.approvalAudienceId); digest(value.actionScopeDigest); digest(value.principalDisplayRefDigest);
  nullableDigest(value.sideEffectTargetRefDigest, 'KSTACK_HOST_PROFILE_MISMATCH'); registryValues(value.riskCodes); registryValues(value.recoveryCodes);
  return value;
}

function validateGovernance(value) {
  exact(value, ['activeSetDigest', 'policyDigest', 'operationRegistry', 'classRules'], 'KSTACK_HOST_ACTIVE_SET_CHANGED');
  digest(value.activeSetDigest); digest(value.policyDigest); validateHostContextArtifact('OperationRegistryV1', value.operationRegistry);
  if (value.operationRegistry.activeSetDigest !== value.activeSetDigest || !Array.isArray(value.classRules) || value.classRules.length !== HOST_OPERATION_CLASSES.length) fail('KSTACK_HOST_ACTIVE_SET_CHANGED');
  for (const rule of value.classRules) validateClassRule(rule);
  assertCollectionOrder(value.classRules, { mode: 'SET_BY_FIELDS', keyFields: ['operationClassId'], keyKinds: ['ASCII'] });
  if (new Set(value.classRules.map((rule) => rule.operationClassId)).size !== HOST_OPERATION_CLASSES.length) fail('KSTACK_HOST_PROFILE_MISMATCH');
  return value;
}

function assuranceAtLeast(actual, required) {
  return HOST_ASSURANCE_LEVELS.indexOf(actual) >= HOST_ASSURANCE_LEVELS.indexOf(required);
}

function effectiveLimits(requested, maximum) {
  limits(requested); limits(maximum);
  return immutable({
    deadlineMs: Math.min(requested.deadlineMs, maximum.deadlineMs),
    maxInputBytes: Math.min(requested.maxInputBytes, maximum.maxInputBytes),
    maxOutputBytes: Math.min(requested.maxOutputBytes, maximum.maxOutputBytes)
  });
}

function resolveUniqueRegistryRow(registry, operationId) {
  const rows = registry.entries.filter((row) => row.operationId === operationId);
  if (rows.length === 0) fail('KSTACK_HOST_OPERATION_UNKNOWN');
  if (rows.length !== 1) fail('KSTACK_HOST_OPERATION_SCHEMA_MISMATCH');
  return rows[0];
}

function validatedArtifact(name, value) {
  const copy = clone(value);
  const validated = validateHostContextArtifact(name, copy);
  return { value: copy, digest: validated.objectDigest };
}

const ADMITTED_BUNDLE_FIELDS = Object.freeze([
  'outcome', 'reasonCode', 'proposal', 'proposalDigest', 'trustedRequestContext', 'trustedRequestContextDigest',
  'operationClassId', 'requirementProfileDigest', 'approvalSubject', 'approvalSubjectDigest', 'approvalDisplay',
  'approvalDisplayDigest', 'displayReceipt', 'displayReceiptDigest', 'approvalEnvelope', 'approvalEnvelopeDigest',
  'request', 'requestDigest', 'transcript', 'transcriptDigest', 'result', 'resultDigest'
]);

export class ProtectedRequestAdmissionKernel {
  #schemaSetDigest;
  #vocabulary;
  #dependencies;

  constructor(options) {
    exact(options, ['schemaSetDigest', 'vocabulary', 'dependencies']);
    this.#schemaSetDigest = digest(options.schemaSetDigest);
    plain(options.vocabulary, 'KSTACK_HOST_VOCABULARY_REQUIRED');
    this.#vocabulary = clone(options.vocabulary);
    const names = [
      'bindChannel', 'resolveRepository', 'resolveSession', 'snapshotGovernance', 'resolveContextSourceProfile',
      'resolveRequirementProfile', 'validateInputArtifact', 'currentEvidenceSet', 'reserveReplayBindings',
      'bindReplayRequest', 'burnReplayReservation', 'recordReplayAdmission', 'deriveTimes', 'currentInstant',
      'remeasureRuntime', 'presentApproval', 'requestApproval', 'verifyApproval'
    ];
    exact(options.dependencies, names, 'KSTACK_HOST_CONTEXT_SOURCE_INVALID');
    this.#dependencies = Object.freeze(Object.fromEntries(names.map((name) => [name, requireFunction(options.dependencies[name])])));
  }

  async #resolveProtected(proposal, proposalDigest, previousTrusted = null) {
    const channel = validatedArtifact('AuthenticatedChannelContextV1', await this.#dependencies.bindChannel(proposalDigest));
    const repository = validatedArtifact('RepositoryContextV1', await this.#dependencies.resolveRepository(proposal.candidateRepositoryLocatorDigest));
    const governance = validateGovernance(clone(await this.#dependencies.snapshotGovernance()));
    const sourceProfile = validatedArtifact('ContextSourceProfileV1', await this.#dependencies.resolveContextSourceProfile(channel.value.contextSourceProfileDigest));
    if (sourceProfile.digest !== channel.value.contextSourceProfileDigest || sourceProfile.value.activeSetDigest !== governance.activeSetDigest
        || !assuranceAtLeast(sourceProfile.value.maximumAssuranceLevel, channel.value.assuranceLevel)) fail('KSTACK_HOST_CHANNEL_UNAUTHENTICATED');
    const runtime = validateRuntime(clone(await this.#dependencies.remeasureRuntime()));
    if (previousTrusted !== null) {
      if (channel.value.peerPrincipalDigest !== previousTrusted.principalDigest) fail('KSTACK_HOST_PRINCIPAL_MISMATCH');
      if (runtime.hostInstanceDigest !== previousTrusted.hostInstanceDigest) fail('KSTACK_HOST_INSTANCE_CHANGED');
      if (runtime.hostBuildDigest !== previousTrusted.runningHostBuildDigest) fail('KSTACK_HOST_BUILD_CHANGED');
      if (runtime.adapterDigest !== previousTrusted.adapterDigest) fail('KSTACK_HOST_ADAPTER_CHANGED');
      if (repository.value.openedRootIdentityDigest !== previousTrusted.openedRootIdentityDigest) fail('KSTACK_HOST_ROOT_CHANGED');
      if (repository.digest !== previousTrusted.repositoryContextDigest) fail('KSTACK_HOST_REPOSITORY_MISMATCH');
      if (governance.activeSetDigest !== previousTrusted.activeSetDigest) fail('KSTACK_HOST_ACTIVE_SET_CHANGED');
      if (governance.policyDigest !== previousTrusted.policyDigest) fail('KSTACK_HOST_POLICY_CHANGED');
      if (sourceProfile.digest !== previousTrusted.contextSourceProfileDigest) fail('KSTACK_HOST_CHANNEL_UNAUTHENTICATED');
      if (channel.digest !== previousTrusted.authenticatedChannelContextDigest) fail('KSTACK_HOST_TRANSPORT_CHANGED');
    }
    const session = validatedArtifact('ProtectedSessionContextV1', await this.#dependencies.resolveSession({
      authenticatedChannelContextDigest: channel.digest,
      repositoryContextDigest: repository.digest,
      activeSetDigest: governance.activeSetDigest
    }));
    if (channel.value.schemaSetDigest !== this.#schemaSetDigest || repository.value.schemaSetDigest !== this.#schemaSetDigest
        || session.value.schemaSetDigest !== this.#schemaSetDigest || sourceProfile.value.schemaSetDigest !== this.#schemaSetDigest) fail('KSTACK_HOST_PROFILE_MISMATCH');
    if (session.value.authenticatedChannelContextDigest !== channel.digest) fail('KSTACK_HOST_SESSION_MISMATCH');
    if (session.value.repositoryContextDigest !== repository.digest) fail('KSTACK_HOST_REPOSITORY_MISMATCH');
    if (session.value.activeSetDigest !== governance.activeSetDigest) fail('KSTACK_HOST_ACTIVE_SET_CHANGED');
    if (session.value.principalDigest !== channel.value.peerPrincipalDigest) fail('KSTACK_HOST_PRINCIPAL_MISMATCH');
    if (session.value.hostInstanceDigest !== channel.value.hostInstanceDigest || session.value.hostInstanceDigest !== runtime.hostInstanceDigest) fail('KSTACK_HOST_INSTANCE_CHANGED');
    if (session.value.hostBuildDigest !== channel.value.hostBuildDigest || session.value.hostBuildDigest !== runtime.hostBuildDigest) fail('KSTACK_HOST_BUILD_CHANGED');
    if (session.value.adapterDigest !== channel.value.adapterDigest || session.value.adapterDigest !== runtime.adapterDigest) fail('KSTACK_HOST_ADAPTER_CHANGED');
    const echoes = proposal.displayEchoes;
    if (echoes.hostInstanceDigest !== null && echoes.hostInstanceDigest !== runtime.hostInstanceDigest) fail('KSTACK_HOST_INSTANCE_CHANGED');
    if (echoes.hostBuildDigest !== null && echoes.hostBuildDigest !== runtime.hostBuildDigest) fail('KSTACK_HOST_BUILD_CHANGED');
    if (echoes.adapterDigest !== null && echoes.adapterDigest !== runtime.adapterDigest) fail('KSTACK_HOST_ADAPTER_CHANGED');
    return { channel, repository, governance, sourceProfile, session, runtime };
  }

  async #resolveOperation(proposal, protectedState) {
    const registry = protectedState.governance.operationRegistry;
    const registryAddress = validateHostContextArtifact('OperationRegistryV1', registry);
    const row = resolveUniqueRegistryRow(registry, proposal.operationId);
    const profile = clone(await this.#dependencies.resolveRequirementProfile(row.requirementProfileDigest));
    const profileAddress = validateHostArtifact('OperationRequirementProfileV1', profile, { vocabulary: this.#vocabulary });
    if (profile.schemaSetDigest !== this.#schemaSetDigest || profile.operationId !== row.operationId) fail('KSTACK_HOST_PROFILE_MISMATCH');
    if (profile.operationSchemaDigest !== row.operationSchemaDigest) fail('KSTACK_HOST_OPERATION_SCHEMA_MISMATCH');
    if (profileAddress.objectDigest !== row.requirementProfileDigest) fail('KSTACK_HOST_PROFILE_MISMATCH');
    const rules = protectedState.governance.classRules.filter((entry) => entry.operationClassId === profile.operationClassId);
    if (rules.length !== 1) fail('KSTACK_HOST_PROFILE_MISMATCH');
    const rule = rules[0];
    if (proposal.displayEchoes.operationClassId !== null && proposal.displayEchoes.operationClassId !== profile.operationClassId) fail('KSTACK_HOST_CLASS_MISMATCH');
    if (!assuranceAtLeast(protectedState.channel.value.assuranceLevel, rule.minimumAssuranceLevel)) fail('KSTACK_HOST_ASSURANCE_INSUFFICIENT');
    return { row, profile, profileDigest: profileAddress.objectDigest, rule, registryDigest: registryAddress.objectDigest };
  }

  async #bindInputs(proposal, maximum) {
    let total = 0;
    for (const input of proposal.inputs) {
      const resolved = clone(await this.#dependencies.validateInputArtifact(clone(input.artifactRef)));
      exact(resolved, ['schemaDigest', 'objectDigest', 'byteCount'], 'KSTACK_HOST_INPUT_MISMATCH');
      digest(resolved.schemaDigest); digest(resolved.objectDigest); uint(resolved.byteCount);
      if (!same(resolved, input.artifactRef)) fail('KSTACK_HOST_INPUT_MISMATCH');
      total += resolved.byteCount;
      if (!Number.isSafeInteger(total) || total > maximum.maxInputBytes) fail('KSTACK_HOST_LIMITS_INVALID');
    }
    return clone(proposal.inputs);
  }

  async #assertEpochUnchanged(proposal, original, operation, evidenceDigest) {
    const current = await this.#resolveProtected(proposal.value, proposal.digest);
    const currentOperation = await this.#resolveOperation(proposal.value, current);
    const comparisons = [
      [current.channel.digest, original.channel.digest, 'KSTACK_HOST_TRANSPORT_CHANGED'],
      [current.repository.digest, original.repository.digest, 'KSTACK_HOST_REPOSITORY_MISMATCH'],
      [current.session.digest, original.session.digest, 'KSTACK_HOST_SESSION_MISMATCH'],
      [current.sourceProfile.digest, original.sourceProfile.digest, 'KSTACK_HOST_CHANNEL_UNAUTHENTICATED'],
      [current.runtime.hostInstanceDigest, original.runtime.hostInstanceDigest, 'KSTACK_HOST_INSTANCE_CHANGED'],
      [current.runtime.hostBuildDigest, original.runtime.hostBuildDigest, 'KSTACK_HOST_BUILD_CHANGED'],
      [current.runtime.adapterDigest, original.runtime.adapterDigest, 'KSTACK_HOST_ADAPTER_CHANGED'],
      [current.governance.activeSetDigest, original.governance.activeSetDigest, 'KSTACK_HOST_ACTIVE_SET_CHANGED'],
      [current.governance.policyDigest, original.governance.policyDigest, 'KSTACK_HOST_POLICY_CHANGED'],
      [currentOperation.registryDigest, operation.registryDigest, 'KSTACK_HOST_ACTIVE_SET_CHANGED'],
      [currentOperation.profileDigest, operation.profileDigest, 'KSTACK_HOST_PROFILE_MISMATCH']
    ];
    for (const [actual, expected, code] of comparisons) if (actual !== expected) fail(code);
    if (!same(currentOperation.rule, operation.rule)) fail('KSTACK_HOST_PROFILE_MISMATCH');
    const evidence = clone(await this.#dependencies.currentEvidenceSet());
    exact(evidence, ['hostEvidenceSetDigest'], 'KSTACK_HOST_EVIDENCE_SET_CHANGED'); digest(evidence.hostEvidenceSetDigest);
    if (evidence.hostEvidenceSetDigest !== evidenceDigest) fail('KSTACK_HOST_EVIDENCE_SET_CHANGED');
  }

  #trustedContext(state, times) {
    const starts = [state.channel.value.establishedAt, state.repository.value.observedAt, state.session.value.issuedAt];
    const expiries = [times.expiresAt, state.channel.value.expiresAt, state.repository.value.expiresAt, state.session.value.expiresAt];
    if (starts.some((value) => value > times.createdAt) || expiries.some((value) => times.createdAt >= value)) fail('KSTACK_HOST_CONTEXT_EXPIRED');
    const value = {
      ...contextHead('TrustedRequestContextV1', this.#schemaSetDigest),
      assuranceLevel: state.channel.value.assuranceLevel,
      authenticatedChannelContextDigest: state.channel.digest,
      protectedSessionContextDigest: state.session.digest,
      principalDigest: state.channel.value.peerPrincipalDigest,
      hostInstanceDigest: state.runtime.hostInstanceDigest,
      runningHostBuildDigest: state.runtime.hostBuildDigest,
      adapterDigest: state.runtime.adapterDigest,
      repositoryContextDigest: state.repository.digest,
      openedRootIdentityDigest: state.repository.value.openedRootIdentityDigest,
      activeSetDigest: state.governance.activeSetDigest,
      policyDigest: state.governance.policyDigest,
      contextSourceProfileDigest: state.sourceProfile.digest,
      derivedAt: times.createdAt,
      expiresAt: expiries.reduce((earliest, value) => value < earliest ? value : earliest)
    };
    return validatedArtifact('TrustedRequestContextV1', value);
  }

  #approvalSubject(requestBase, rule) {
    const value = {
      ...contextHead('ApprovalSubjectV1', this.#schemaSetDigest),
      ...clone(requestBase),
      approvalAudienceId: rule.approvalAudienceId,
      actionScopeDigest: rule.actionScopeDigest
    };
    return validatedArtifact('ApprovalSubjectV1', value);
  }

  #approvalDisplay(subject, operation, state) {
    const value = {
      ...contextHead('ApprovalDisplayV1', this.#schemaSetDigest),
      approvalSubjectDigest: subject.digest,
      principalDisplayRefDigest: operation.rule.principalDisplayRefDigest,
      repositoryDisplayRefDigest: state.repository.value.canonicalRepositoryIdentityDigest,
      worktreeDisplayRefDigest: state.repository.value.worktreeIdentityDigest,
      hostInstanceDigest: state.runtime.hostInstanceDigest,
      hostBuildDigest: state.runtime.hostBuildDigest,
      operationId: operation.row.operationId,
      operationClassId: operation.profile.operationClassId,
      activeSetDigest: state.governance.activeSetDigest,
      policyDigest: state.governance.policyDigest,
      operationSchemaDigest: operation.row.operationSchemaDigest,
      requirementProfileDigest: operation.profileDigest,
      inputs: subject.value.inputs.map((input) => ({ name: input.name, ...clone(input.artifactRef) })),
      effectiveLimits: clone(subject.value.limits),
      sideEffectTargetRefDigest: operation.rule.sideEffectTargetRefDigest,
      approvalAudienceId: operation.rule.approvalAudienceId,
      actionScopeDigest: operation.rule.actionScopeDigest,
      nonceDigest: subject.value.nonceDigest,
      expiresAt: subject.value.expiresAt,
      riskCodes: clone(operation.rule.riskCodes),
      recoveryCodes: clone(operation.rule.recoveryCodes)
    };
    return validatedArtifact('ApprovalDisplayV1', value);
  }

  #denial(partial, error) {
    let reasonCode = HOST_ADMISSION_REASON_CODES.includes(error?.code) ? error.code : 'KSTACK_HOST_CONTEXT_UNAVAILABLE';
    if (/INPUT|COLLECTION|ASCII_ID|REGISTRY_ID/u.test(error?.code || '')) reasonCode = 'KSTACK_HOST_INPUT_MISMATCH';
    if (/LIMIT|INTEGER/u.test(error?.code || '')) reasonCode = 'KSTACK_HOST_LIMITS_INVALID';
    const outcome = ['KSTACK_HOST_CONTEXT_UNAVAILABLE', 'KSTACK_HOST_REPOSITORY_AMBIGUOUS'].includes(reasonCode)
      ? 'CONTEXT_UNAVAILABLE' : 'DENIED';
    const result = {
      ...contextHead('RequestAdmissionResultV1', this.#schemaSetDigest),
      proposalDigest: partial.proposal.digest,
      trustedRequestContextDigest: partial.trusted?.digest ?? null,
      operationClassId: partial.operation?.profile?.operationClassId ?? null,
      requirementProfileDigest: partial.operation?.profileDigest ?? null,
      requestDigest: null,
      approvalSubjectDigest: partial.subject?.digest ?? null,
      approvalDisplayDigest: partial.display?.digest ?? null,
      approvalEnvelopeDigest: partial.envelope?.digest ?? null,
      outcome,
      reasonCode,
      occurredAt: partial.times.createdAt
    };
    const resultAddress = validatedArtifact('RequestAdmissionResultV1', result);
    const transcript = {
      ...contextHead('AdmissionTranscriptV1', this.#schemaSetDigest),
      proposalDigest: partial.proposal.digest,
      contextSourceProfileDigest: partial.protectedState?.sourceProfile?.digest ?? null,
      authenticatedChannelContextDigest: partial.protectedState?.channel?.digest ?? null,
      repositoryContextDigest: partial.protectedState?.repository?.digest ?? null,
      protectedSessionContextDigest: partial.protectedState?.session?.digest ?? null,
      trustedRequestContextDigest: partial.trusted?.digest ?? null,
      operationRegistryDigest: partial.operation?.registryDigest ?? null,
      requirementProfileDigest: partial.operation?.profileDigest ?? null,
      approvalSubjectDigest: partial.subject?.digest ?? null,
      approvalDisplayDigest: partial.display?.digest ?? null,
      displayReceiptDigest: partial.displayReceipt?.digest ?? null,
      approvalEnvelopeDigest: partial.envelope?.digest ?? null,
      requestDigest: null,
      outcome,
      reasonCode,
      occurredAt: partial.times.createdAt
    };
    const transcriptAddress = validatedArtifact('AdmissionTranscriptV1', transcript);
    return immutable({
      outcome, reasonCode, result: resultAddress.value, resultDigest: resultAddress.digest,
      transcript: transcriptAddress.value, transcriptDigest: transcriptAddress.digest
    });
  }

  async admit(input) {
    const proposal = validatedArtifact('UntrustedOperationProposalV1', clone(input));
    const times = clone(await this.#dependencies.deriveTimes(proposal.digest));
    exact(times, ['createdAt', 'expiresAt'], 'KSTACK_HOST_CONTEXT_UNAVAILABLE');
    orderedTime(times.createdAt, times.expiresAt);
    const partial = { proposal, times };
    try {
      if (proposal.value.schemaSetDigest !== this.#schemaSetDigest) fail('KSTACK_HOST_PROFILE_MISMATCH');
      partial.protectedState = await this.#resolveProtected(proposal.value, proposal.digest);
      partial.operation = await this.#resolveOperation(proposal.value, partial.protectedState);
      const boundedLimits = effectiveLimits(proposal.value.requestedLimits, partial.operation.rule.maxLimits);
      const inputs = await this.#bindInputs(proposal.value, boundedLimits);
      const evidence = clone(await this.#dependencies.currentEvidenceSet());
      exact(evidence, ['hostEvidenceSetDigest'], 'KSTACK_HOST_EVIDENCE_SET_CHANGED');
      digest(evidence.hostEvidenceSetDigest, 'KSTACK_HOST_EVIDENCE_SET_CHANGED');
      partial.evidenceDigest = evidence.hostEvidenceSetDigest;
      partial.trusted = this.#trustedContext(partial.protectedState, times);
      const replay = clone(await this.#dependencies.reserveReplayBindings({
        proposalDigest: proposal.digest,
        contextDraftDigest: proposal.digest,
        protectedSessionContextDigest: partial.protectedState.session.digest,
        principalDigest: partial.trusted.value.principalDigest,
        repositoryContextDigest: partial.protectedState.repository.digest,
        worktreeIdentityDigest: partial.protectedState.repository.value.worktreeIdentityDigest,
        operationId: partial.operation.row.operationId,
        operationSchemaDigest: partial.operation.row.operationSchemaDigest,
        requirementProfileDigest: partial.operation.profileDigest,
        operationClassId: partial.operation.profile.operationClassId,
        inputs: clone(inputs),
        limits: clone(boundedLimits),
        expiresAt: partial.trusted.value.expiresAt,
        activeSetDigest: partial.protectedState.governance.activeSetDigest,
        policyDigest: partial.protectedState.governance.policyDigest,
        stateEvidenceDigest: evidence.hostEvidenceSetDigest
      }));
      exact(replay, ['nonceDigest', 'idempotencyKeyDigest', 'attemptId'], 'KSTACK_HOST_CONTEXT_UNAVAILABLE');
      digest(replay.nonceDigest); digest(replay.idempotencyKeyDigest); assertAsciiId(replay.attemptId);
      partial.replayReservation = replay;
      const requestBase = {
        operationId: partial.operation.row.operationId,
        operationSchemaDigest: partial.operation.row.operationSchemaDigest,
        requirementProfileDigest: partial.operation.profileDigest,
        repositoryContextDigest: partial.protectedState.repository.digest,
        trustedRequestContextDigest: partial.trusted.digest,
        activeSetDigest: partial.protectedState.governance.activeSetDigest,
        policyDigest: partial.protectedState.governance.policyDigest,
        inputs,
        limits: clone(boundedLimits),
        hostEvidenceSetDigest: evidence.hostEvidenceSetDigest,
        nonceDigest: replay.nonceDigest,
        idempotencyKeyDigest: replay.idempotencyKeyDigest,
        createdAt: times.createdAt,
        expiresAt: partial.trusted.value.expiresAt
      };
      let authorityEnvelopeDigest = null;
      if (partial.operation.rule.approvalRequired) {
        if (partial.trusted.value.assuranceLevel !== 'PROTECTED_BROKER' || partial.trusted.value.principalDigest === null) fail('KSTACK_HOST_APPROVAL_REQUIRED');
        partial.subject = this.#approvalSubject(requestBase, partial.operation.rule);
        partial.display = this.#approvalDisplay(partial.subject, partial.operation, partial.protectedState);
        partial.displayReceipt = validatedArtifact('ProtectedDisplayReceiptV1', await this.#dependencies.presentApproval(clone(partial.display.value)));
        if (partial.displayReceipt.value.approvalDisplayDigest !== partial.display.digest
            || partial.displayReceipt.value.presentedAt < times.createdAt
            || partial.displayReceipt.value.presentedAt >= requestBase.expiresAt) fail('KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH');
        const envelopeValue = await this.#dependencies.requestApproval({
          subject: clone(partial.subject.value), display: clone(partial.display.value), displayReceipt: clone(partial.displayReceipt.value)
        });
        if (!envelopeValue || envelopeValue.decision !== 'APPROVE') fail('KSTACK_HOST_APPROVAL_DENIED');
        partial.envelope = validatedArtifact('ProtectedApprovalEnvelopeV1', envelopeValue);
        const envelope = partial.envelope.value;
        if (envelope.approvalSubjectDigest !== partial.subject.digest || envelope.approvalDisplayDigest !== partial.display.digest
            || envelope.displayReceiptDigest !== partial.displayReceipt.digest || envelope.principalDigest !== partial.trusted.value.principalDigest
            || envelope.protectedSessionContextDigest !== partial.protectedState.session.digest
            || envelope.repositoryContextDigest !== partial.protectedState.repository.digest
            || envelope.hostInstanceDigest !== partial.protectedState.runtime.hostInstanceDigest
            || envelope.hostBuildDigest !== partial.protectedState.runtime.hostBuildDigest
            || envelope.approvalAudienceId !== partial.operation.rule.approvalAudienceId
            || envelope.actionScopeDigest !== partial.operation.rule.actionScopeDigest
            || envelope.nonceDigest !== replay.nonceDigest || envelope.issuedAt < partial.displayReceipt.value.presentedAt
            || envelope.expiresAt > requestBase.expiresAt) fail('KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH');
        authorityEnvelopeDigest = partial.envelope.digest;
      }

      await this.#assertEpochUnchanged(proposal, partial.protectedState, partial.operation, evidence.hostEvidenceSetDigest);

      const request = {
        ...artifactHead('OperationRequestV1', this.#schemaSetDigest),
        ...clone(requestBase),
        authorityEnvelopeDigest
      };
      const requestAddress = validateHostArtifactContext('OperationRequestV1', request, {
        vocabulary: this.#vocabulary,
        resolveArtifact: (key) => key === partial.operation.profileDigest ? clone(partial.operation.profile) : null,
        resolveOperationClassRule: (operationClassId, activeSetDigest) => ({
          operationClassId, activeSetDigest, approvalRequired: partial.operation.rule.approvalRequired
        })
      });
      partial.request = { value: request, digest: requestAddress.objectDigest };
      const replayBinding = clone(await this.#dependencies.bindReplayRequest({
        nonceDigest: replay.nonceDigest,
        contextDraftDigest: proposal.digest,
        protectedSessionContextDigest: partial.protectedState.session.digest,
        principalDigest: partial.trusted.value.principalDigest,
        repositoryContextDigest: partial.protectedState.repository.digest,
        requestDigest: partial.request.digest,
        approvalSubjectDigest: partial.subject?.digest ?? null,
        authorityEnvelopeDigest: partial.envelope?.digest ?? null,
        activeSetDigest: partial.protectedState.governance.activeSetDigest,
        policyDigest: partial.protectedState.governance.policyDigest,
        stateEvidenceDigest: evidence.hostEvidenceSetDigest
      }));
      exact(replayBinding, ['attemptId', 'requestDigest'], 'KSTACK_HOST_CONTEXT_UNAVAILABLE');
      assertAsciiId(replayBinding.attemptId); digest(replayBinding.requestDigest);
      if (replayBinding.attemptId !== replay.attemptId || replayBinding.requestDigest !== partial.request.digest) fail('KSTACK_HOST_CONTEXT_UNAVAILABLE');
      partial.replayBound = replayBinding;

      await this.#assertEpochUnchanged(proposal, partial.protectedState, partial.operation, evidence.hostEvidenceSetDigest);
      const replayAdmission = clone(await this.#dependencies.recordReplayAdmission({
        attemptId: replay.attemptId, admitted: true, stateEvidenceDigest: evidence.hostEvidenceSetDigest
      }));
      exact(replayAdmission, ['attemptId', 'state'], 'KSTACK_HOST_CONTEXT_UNAVAILABLE');
      if (replayAdmission.attemptId !== replay.attemptId || replayAdmission.state !== 'ADMITTED') fail('KSTACK_HOST_CONTEXT_UNAVAILABLE');
      partial.replayAdmitted = replayAdmission;
      const transcript = {
        ...contextHead('AdmissionTranscriptV1', this.#schemaSetDigest),
        proposalDigest: proposal.digest,
        contextSourceProfileDigest: partial.protectedState.sourceProfile.digest,
        authenticatedChannelContextDigest: partial.protectedState.channel.digest,
        repositoryContextDigest: partial.protectedState.repository.digest,
        protectedSessionContextDigest: partial.protectedState.session.digest,
        trustedRequestContextDigest: partial.trusted.digest,
        operationRegistryDigest: partial.operation.registryDigest,
        requirementProfileDigest: partial.operation.profileDigest,
        approvalSubjectDigest: partial.subject?.digest ?? null,
        approvalDisplayDigest: partial.display?.digest ?? null,
        displayReceiptDigest: partial.displayReceipt?.digest ?? null,
        approvalEnvelopeDigest: partial.envelope?.digest ?? null,
        requestDigest: partial.request.digest,
        outcome: 'ADMITTED',
        reasonCode: null,
        occurredAt: times.createdAt
      };
      const transcriptAddress = validatedArtifact('AdmissionTranscriptV1', transcript);
      const result = {
        ...contextHead('RequestAdmissionResultV1', this.#schemaSetDigest),
        proposalDigest: proposal.digest,
        trustedRequestContextDigest: partial.trusted.digest,
        operationClassId: partial.operation.profile.operationClassId,
        requirementProfileDigest: partial.operation.profileDigest,
        requestDigest: partial.request.digest,
        approvalSubjectDigest: partial.subject?.digest ?? null,
        approvalDisplayDigest: partial.display?.digest ?? null,
        approvalEnvelopeDigest: partial.envelope?.digest ?? null,
        outcome: 'ADMITTED',
        reasonCode: null,
        occurredAt: times.createdAt
      };
      const resultAddress = validatedArtifact('RequestAdmissionResultV1', result);
      return immutable({
        outcome: 'ADMITTED', reasonCode: null,
        proposal: clone(proposal.value), proposalDigest: proposal.digest,
        trustedRequestContext: clone(partial.trusted.value), trustedRequestContextDigest: partial.trusted.digest,
        operationClassId: partial.operation.profile.operationClassId, requirementProfileDigest: partial.operation.profileDigest,
        approvalSubject: partial.subject ? clone(partial.subject.value) : null,
        approvalSubjectDigest: partial.subject?.digest ?? null,
        approvalDisplay: partial.display ? clone(partial.display.value) : null,
        approvalDisplayDigest: partial.display?.digest ?? null,
        displayReceipt: partial.displayReceipt ? clone(partial.displayReceipt.value) : null,
        displayReceiptDigest: partial.displayReceipt?.digest ?? null,
        approvalEnvelope: partial.envelope ? clone(partial.envelope.value) : null,
        approvalEnvelopeDigest: partial.envelope?.digest ?? null,
        request: clone(partial.request.value), requestDigest: partial.request.digest,
        transcript: transcriptAddress.value, transcriptDigest: transcriptAddress.digest,
        result: resultAddress.value, resultDigest: resultAddress.digest
      });
    } catch (error) {
      if (partial.replayBound && !partial.replayAdmitted) {
        await this.#dependencies.recordReplayAdmission({
          attemptId: partial.replayReservation.attemptId, admitted: false,
          stateEvidenceDigest: partial.evidenceDigest ?? proposal.digest
        });
      } else if (partial.replayReservation && !partial.replayBound) {
        await this.#dependencies.burnReplayReservation({ nonceDigest: partial.replayReservation.nonceDigest });
      }
      if (typeof error?.code !== 'string' || !error.code.startsWith('KSTACK_HOST_')) throw error;
      return this.#denial(partial, error);
    }
  }

  async verifyHandoff(bundle) {
    exact(bundle, ADMITTED_BUNDLE_FIELDS, 'KSTACK_HOST_TRANSPORT_CHANGED');
    if (bundle.outcome !== 'ADMITTED' || bundle.reasonCode !== null) fail('KSTACK_HOST_TRANSPORT_CHANGED');
    const proposal = validatedArtifact('UntrustedOperationProposalV1', bundle.proposal);
    if (proposal.digest !== bundle.proposalDigest) fail('KSTACK_HOST_TRANSPORT_CHANGED');
    const trusted = validatedArtifact('TrustedRequestContextV1', bundle.trustedRequestContext);
    if (trusted.digest !== bundle.trustedRequestContextDigest) fail('KSTACK_HOST_TRANSPORT_CHANGED');
    const requestAddress = validateHostArtifact('OperationRequestV1', bundle.request, { vocabulary: this.#vocabulary });
    if (requestAddress.objectDigest !== bundle.requestDigest) fail('KSTACK_HOST_TRANSPORT_CHANGED');
    const current = await this.#resolveProtected(proposal.value, proposal.digest, trusted.value);
    const operation = await this.#resolveOperation(proposal.value, current);
    const now = await this.#dependencies.currentInstant();
    time(now);
    if (now < bundle.request.createdAt || now >= bundle.request.expiresAt || now >= trusted.value.expiresAt) fail('KSTACK_HOST_CONTEXT_EXPIRED');
    const expectedContext = {
      assuranceLevel: current.channel.value.assuranceLevel,
      authenticatedChannelContextDigest: current.channel.digest,
      protectedSessionContextDigest: current.session.digest,
      principalDigest: current.channel.value.peerPrincipalDigest,
      hostInstanceDigest: current.runtime.hostInstanceDigest,
      runningHostBuildDigest: current.runtime.hostBuildDigest,
      adapterDigest: current.runtime.adapterDigest,
      repositoryContextDigest: current.repository.digest,
      openedRootIdentityDigest: current.repository.value.openedRootIdentityDigest,
      activeSetDigest: current.governance.activeSetDigest,
      policyDigest: current.governance.policyDigest,
      contextSourceProfileDigest: current.sourceProfile.digest
    };
    const contextCodes = {
      authenticatedChannelContextDigest: 'KSTACK_HOST_SESSION_MISMATCH', protectedSessionContextDigest: 'KSTACK_HOST_SESSION_MISMATCH',
      principalDigest: 'KSTACK_HOST_PRINCIPAL_MISMATCH', hostInstanceDigest: 'KSTACK_HOST_INSTANCE_CHANGED',
      runningHostBuildDigest: 'KSTACK_HOST_BUILD_CHANGED', adapterDigest: 'KSTACK_HOST_ADAPTER_CHANGED',
      repositoryContextDigest: 'KSTACK_HOST_REPOSITORY_MISMATCH', openedRootIdentityDigest: 'KSTACK_HOST_ROOT_CHANGED',
      activeSetDigest: 'KSTACK_HOST_ACTIVE_SET_CHANGED', policyDigest: 'KSTACK_HOST_POLICY_CHANGED'
    };
    for (const [field, value] of Object.entries(expectedContext)) if (trusted.value[field] !== value) fail(contextCodes[field] || 'KSTACK_HOST_TRANSPORT_CHANGED');
    const evidence = clone(await this.#dependencies.currentEvidenceSet());
    exact(evidence, ['hostEvidenceSetDigest'], 'KSTACK_HOST_EVIDENCE_SET_CHANGED'); digest(evidence.hostEvidenceSetDigest);
    const inputs = await this.#bindInputs(proposal.value, effectiveLimits(proposal.value.requestedLimits, operation.rule.maxLimits));
    const expectedRequest = {
      operationId: operation.row.operationId,
      operationSchemaDigest: operation.row.operationSchemaDigest,
      requirementProfileDigest: operation.profileDigest,
      repositoryContextDigest: current.repository.digest,
      trustedRequestContextDigest: trusted.digest,
      activeSetDigest: current.governance.activeSetDigest,
      policyDigest: current.governance.policyDigest,
      inputs,
      limits: effectiveLimits(proposal.value.requestedLimits, operation.rule.maxLimits),
      hostEvidenceSetDigest: evidence.hostEvidenceSetDigest
    };
    for (const [field, value] of Object.entries(expectedRequest)) if (!same(bundle.request[field], value)) fail(field === 'hostEvidenceSetDigest' ? 'KSTACK_HOST_EVIDENCE_SET_CHANGED' : 'KSTACK_HOST_TRANSPORT_CHANGED');
    if (bundle.operationClassId !== operation.profile.operationClassId || bundle.requirementProfileDigest !== operation.profileDigest) fail('KSTACK_HOST_CLASS_MISMATCH');
    const { schemaId, schemaVersion, schemaSetDigest, authorityEnvelopeDigest, ...requestBase } = bundle.request;
    if (schemaId !== 'kstack.operation-request.v1' || schemaVersion !== 1 || schemaSetDigest !== this.#schemaSetDigest) fail('KSTACK_HOST_TRANSPORT_CHANGED');
    if (operation.rule.approvalRequired) {
      const subject = validatedArtifact('ApprovalSubjectV1', bundle.approvalSubject);
      const expectedSubject = this.#approvalSubject(requestBase, operation.rule);
      if (subject.digest !== bundle.approvalSubjectDigest || subject.digest !== expectedSubject.digest || authorityEnvelopeDigest !== bundle.approvalEnvelopeDigest) fail('KSTACK_HOST_APPROVAL_SUBJECT_MISMATCH');
      const display = validatedArtifact('ApprovalDisplayV1', bundle.approvalDisplay);
      const expectedDisplay = this.#approvalDisplay(subject, operation, current);
      if (display.digest !== bundle.approvalDisplayDigest || display.digest !== expectedDisplay.digest) fail('KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH');
      const displayReceipt = validatedArtifact('ProtectedDisplayReceiptV1', bundle.displayReceipt);
      if (displayReceipt.digest !== bundle.displayReceiptDigest || displayReceipt.value.approvalDisplayDigest !== display.digest
          || displayReceipt.value.presentedAt < bundle.request.createdAt || displayReceipt.value.presentedAt >= bundle.request.expiresAt) fail('KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH');
      const envelope = validatedArtifact('ProtectedApprovalEnvelopeV1', bundle.approvalEnvelope);
      if (envelope.digest !== bundle.approvalEnvelopeDigest || envelope.value.approvalSubjectDigest !== subject.digest
          || envelope.value.approvalDisplayDigest !== display.digest || envelope.value.displayReceiptDigest !== displayReceipt.digest
          || envelope.value.principalDigest !== trusted.value.principalDigest || envelope.value.protectedSessionContextDigest !== current.session.digest
          || envelope.value.repositoryContextDigest !== current.repository.digest || envelope.value.hostInstanceDigest !== current.runtime.hostInstanceDigest
          || envelope.value.hostBuildDigest !== current.runtime.hostBuildDigest || envelope.value.approvalAudienceId !== operation.rule.approvalAudienceId
          || envelope.value.actionScopeDigest !== operation.rule.actionScopeDigest || envelope.value.nonceDigest !== bundle.request.nonceDigest
          || envelope.value.issuedAt < displayReceipt.value.presentedAt || envelope.value.expiresAt > bundle.request.expiresAt) fail('KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH');
      if (now >= envelope.value.expiresAt) fail('KSTACK_HOST_CONTEXT_EXPIRED');
      const protectedVerification = clone(await this.#dependencies.verifyApproval({
        approvalSubjectDigest: subject.digest,
        approvalDisplayDigest: display.digest,
        displayReceiptDigest: displayReceipt.digest,
        approvalEnvelopeDigest: envelope.digest
      }));
      exact(protectedVerification, ['valid', 'displayReceiptDigest', 'approvalEnvelopeDigest'], 'KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH');
      if (protectedVerification.valid !== true || protectedVerification.displayReceiptDigest !== displayReceipt.digest
          || protectedVerification.approvalEnvelopeDigest !== envelope.digest) fail('KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH');
    } else if (authorityEnvelopeDigest !== null || [bundle.approvalSubject, bundle.approvalSubjectDigest, bundle.approvalDisplay,
      bundle.approvalDisplayDigest, bundle.displayReceipt, bundle.displayReceiptDigest, bundle.approvalEnvelope,
      bundle.approvalEnvelopeDigest].some((entry) => entry !== null)) fail('KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH');

    const transcript = validatedArtifact('AdmissionTranscriptV1', bundle.transcript);
    const result = validatedArtifact('RequestAdmissionResultV1', bundle.result);
    if (transcript.digest !== bundle.transcriptDigest || result.digest !== bundle.resultDigest
        || transcript.value.requestDigest !== bundle.requestDigest || result.value.requestDigest !== bundle.requestDigest
        || transcript.value.proposalDigest !== bundle.proposalDigest || result.value.proposalDigest !== bundle.proposalDigest
        || transcript.value.outcome !== 'ADMITTED' || result.value.outcome !== 'ADMITTED') fail('KSTACK_HOST_TRANSPORT_CHANGED');
    return immutable({ valid: true, requestDigest: bundle.requestDigest, verifiedAt: now });
  }
}
