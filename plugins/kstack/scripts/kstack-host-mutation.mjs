import {
  assertAsciiId,
  assertDigest,
  assertTimestamp,
  hostAddress
} from './kstack-host-contract.mjs';

export class HostMutationError extends Error {
  constructor(code) { super(code); this.name = 'HostMutationError'; this.code = code; }
}

function fail(code) { throw new HostMutationError(code); }
function exact(value, keys, code = 'KSTACK_MUTATION_INPUT_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(); const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}
function digest(value, code = 'KSTACK_MUTATION_INPUT_INVALID') { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code = 'KSTACK_MUTATION_INPUT_INVALID') { try { return assertAsciiId(value); } catch { fail(code); } }
function timestamp(value, code = 'KSTACK_MUTATION_INPUT_INVALID') { try { return assertTimestamp(value); } catch { fail(code); } }
function bool(value, code = 'KSTACK_MUTATION_INPUT_INVALID') { if (typeof value !== 'boolean') fail(code); return value; }
function enumeration(value, allowed, code = 'KSTACK_MUTATION_INPUT_INVALID') { if (!allowed.includes(value)) fail(code); return value; }
function uint(value, maximum, positive = false, code = 'KSTACK_MUTATION_INPUT_INVALID') { if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) fail(code); return value; }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export const MUTATION_KINDS = Object.freeze(['CREATE_DIRECTORY', 'CREATE_FILE', 'DELETE_EMPTY_DIRECTORY', 'DELETE_FILE', 'RENAME_WITHIN_ROOT', 'REPLACE_FILE']);
export const MUTATION_STATES = Object.freeze(['PLANNED', 'LOCKED', 'PREPARED', 'COMMIT_INTENT', 'COMMITTED', 'ROLLED_BACK', 'ABORTED', 'OUTCOME_AMBIGUOUS', 'CLEANUP_INTENT', 'CLEANED']);
export const MUTATION_OUTCOMES = Object.freeze(['COMMITTED', 'NOT_COMMITTED', 'AMBIGUOUS', 'RECOVERY_REQUIRED']);
const FILE_TYPES = Object.freeze(['ABSENT', 'DIRECTORY', 'REGULAR']);
const PHASES = Object.freeze(['PREPARE', 'COMMIT', 'RECOVERY', 'CLEANUP']);
const ROLES = Object.freeze(['RECOVERY', 'SOURCE', 'STAGING', 'TARGET']);
const IDENTITIES = Object.freeze({
  RelativeTargetV1: ['kstack.relative-target.v1', 'KSTACK-RELATIVE-TARGET-V1'],
  NamespaceFootprintV1: ['kstack.namespace-footprint.v1', 'KSTACK-NAMESPACE-FOOTPRINT-V1'],
  LocalMutationPlanV1: ['kstack.local-mutation-plan.v1', 'KSTACK-LOCAL-MUTATION-PLAN-V1'],
  CleanupIntentV1: ['kstack.cleanup-intent.v1', 'KSTACK-CLEANUP-INTENT-V1'],
  LocalMutationEvidenceV1: ['kstack.local-mutation-evidence.v1', 'KSTACK-LOCAL-MUTATION-EVIDENCE-V1']
});
function head(name, schemaSetDigest) { return { schemaId: IDENTITIES[name][0], schemaVersion: 1, schemaSetDigest: digest(schemaSetDigest) }; }
function address(name, value) { return hostAddress(IDENTITIES[name][1], value); }

function component(value, platformId) {
  if (typeof value !== 'string' || value.length === 0 || value.normalize('NFC') !== value || Buffer.byteLength(value, 'utf8') > 255
    || value.includes('\0') || value.includes('/') || value.includes('\\') || value === '.' || value === '..') fail('KSTACK_MUTATION_PATH_INVALID');
  if (platformId === 'windows') {
    const base = value.split('.')[0].toUpperCase();
    if (value.includes(':') || /[. ]$/u.test(value) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(base)) fail('KSTACK_MUTATION_PATH_INVALID');
  }
  return value;
}

export function validateRelativeTarget(input) {
  exact(input, ['schemaSetDigest', 'targetId', 'components', 'platformProfile'], 'KSTACK_MUTATION_PATH_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_MUTATION_PATH_INVALID'); ascii(input.targetId, 'KSTACK_MUTATION_PATH_INVALID');
  exact(input.platformProfile, ['platformId', 'caseMode', 'normalizationMode', 'profileDigest'], 'KSTACK_MUTATION_PATH_INVALID');
  enumeration(input.platformProfile.platformId, ['linux', 'macos', 'windows'], 'KSTACK_MUTATION_PATH_INVALID');
  enumeration(input.platformProfile.caseMode, ['SENSITIVE', 'INSENSITIVE'], 'KSTACK_MUTATION_PATH_INVALID');
  enumeration(input.platformProfile.normalizationMode, ['NFC', 'NFC_CASEFOLD'], 'KSTACK_MUTATION_PATH_INVALID'); digest(input.platformProfile.profileDigest, 'KSTACK_MUTATION_PATH_INVALID');
  if (!Array.isArray(input.components) || input.components.length < 1 || input.components.length > 64) fail('KSTACK_MUTATION_PATH_INVALID');
  input.components.forEach((entry) => component(entry, input.platformProfile.platformId));
  const normalized = input.components.map((entry) => input.platformProfile.caseMode === 'INSENSITIVE' ? entry.toLocaleLowerCase('en-US') : entry);
  const target = {
    ...head('RelativeTargetV1', input.schemaSetDigest), targetId: input.targetId, components: input.components,
    platformProfileDigest: input.platformProfile.profileDigest,
    canonicalKeyDigest: hostAddress('KSTACK-MUTATION-CANONICAL-TARGET-KEY-V1', normalized)
  };
  return immutable({ target, targetDigest: address('RelativeTargetV1', target) });
}

export function assertDistinctRelativeTargets(targets) {
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 256) fail('KSTACK_MUTATION_PATH_INVALID');
  const keys = targets.map((target) => {
    exact(target, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'targetId', 'components', 'platformProfileDigest', 'canonicalKeyDigest'], 'KSTACK_MUTATION_PATH_INVALID');
    if (target.schemaId !== IDENTITIES.RelativeTargetV1[0] || target.schemaVersion !== 1) fail('KSTACK_MUTATION_PATH_INVALID');
    digest(target.schemaSetDigest, 'KSTACK_MUTATION_PATH_INVALID'); ascii(target.targetId, 'KSTACK_MUTATION_PATH_INVALID');
    digest(target.platformProfileDigest, 'KSTACK_MUTATION_PATH_INVALID'); digest(target.canonicalKeyDigest, 'KSTACK_MUTATION_PATH_INVALID');
    return target.canonicalKeyDigest;
  });
  if (new Set(keys).size !== keys.length) fail('KSTACK_MUTATION_CASE_ALIAS');
  return immutable(targets);
}

export function validateMutationBackendProfile(value, options = {}) {
  exact(value, [
    'profileId', 'profileDigest', 'assurance', 'platformDigest', 'filesystemDigest', 'implementationDigest',
    'handleRelative', 'noFollow', 'beneathRoot', 'sameVolume', 'exclusiveMediation', 'atomicNoReplace',
    'atomicExchange', 'directoryDurability', 'stableFileIdentity', 'aclIsolationProven', 'qualifiedOutcome'
  ], 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  ascii(value.profileId, 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  enumeration(value.assurance, ['EXCLUSIVE_MEDIATED', 'COOPERATIVE_DETECT'], 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  for (const key of ['handleRelative', 'noFollow', 'beneathRoot', 'sameVolume', 'exclusiveMediation', 'atomicNoReplace', 'atomicExchange', 'directoryDurability', 'stableFileIdentity', 'aclIsolationProven']) bool(value[key], 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  enumeration(value.qualifiedOutcome, ['PROVEN', 'UNKNOWN', 'UNAVAILABLE', 'CONTRADICTORY'], 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  const required = ['handleRelative', 'noFollow', 'beneathRoot', 'sameVolume', 'exclusiveMediation', 'atomicNoReplace', 'directoryDurability', 'stableFileIdentity', 'aclIsolationProven'];
  if (value.assurance !== 'EXCLUSIVE_MEDIATED' || value.qualifiedOutcome !== 'PROVEN' || required.some((key) => !value[key])) fail('KSTACK_MUTATION_ISOLATION_UNAVAILABLE');
  if (options.operationKind === 'REPLACE_FILE' && !value.atomicExchange) fail('KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  return immutable(value);
}

function validateEntryState(value, code = 'KSTACK_MUTATION_FOOTPRINT_INVALID') {
  exact(value, ['type', 'identityDigest', 'contentDigest', 'metadataDigest'], code);
  enumeration(value.type, FILE_TYPES, code);
  if (value.type === 'ABSENT') {
    if (value.identityDigest !== null || value.contentDigest !== null || value.metadataDigest !== null) fail(code);
  } else {
    digest(value.identityDigest, code); digest(value.metadataDigest, code);
    if (value.type === 'REGULAR') digest(value.contentDigest, code); else if (value.contentDigest !== null) fail(code);
  }
}

function sameState(left, right) {
  return left.type === right.type && left.identityDigest === right.identityDigest
    && left.contentDigest === right.contentDigest && left.metadataDigest === right.metadataDigest;
}

export function validateNamespaceFootprint(value) {
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'operationKind', 'rootIdentityDigest', 'entries'], 'KSTACK_MUTATION_FOOTPRINT_INVALID');
  if (value.schemaId !== IDENTITIES.NamespaceFootprintV1[0] || value.schemaVersion !== 1) fail('KSTACK_MUTATION_FOOTPRINT_INVALID');
  digest(value.schemaSetDigest, 'KSTACK_MUTATION_FOOTPRINT_INVALID'); enumeration(value.operationKind, MUTATION_KINDS, 'KSTACK_MUTATION_FOOTPRINT_INVALID'); digest(value.rootIdentityDigest, 'KSTACK_MUTATION_FOOTPRINT_INVALID');
  if (!Array.isArray(value.entries) || value.entries.length !== 2) fail('KSTACK_MUTATION_FOOTPRINT_INVALID');
  for (const entry of value.entries) {
    exact(entry, ['entryId', 'parentIdentityDigest', 'parentGeneration', 'role', 'phase', 'permittedNativeOperation', 'preState', 'postState', 'agentAccessible'], 'KSTACK_MUTATION_FOOTPRINT_INVALID');
    ascii(entry.entryId, 'KSTACK_MUTATION_FOOTPRINT_INVALID'); digest(entry.parentIdentityDigest, 'KSTACK_MUTATION_FOOTPRINT_INVALID'); uint(entry.parentGeneration, Number.MAX_SAFE_INTEGER, false, 'KSTACK_MUTATION_FOOTPRINT_INVALID');
    enumeration(entry.role, ROLES, 'KSTACK_MUTATION_FOOTPRINT_INVALID'); enumeration(entry.phase, PHASES, 'KSTACK_MUTATION_FOOTPRINT_INVALID'); ascii(entry.permittedNativeOperation, 'KSTACK_MUTATION_FOOTPRINT_INVALID');
    validateEntryState(entry.preState); validateEntryState(entry.postState); bool(entry.agentAccessible, 'KSTACK_MUTATION_FOOTPRINT_INVALID');
    if (['STAGING', 'RECOVERY'].includes(entry.role) && entry.agentAccessible) fail('KSTACK_MUTATION_FOOTPRINT_INVALID');
  }
  const ids = value.entries.map((entry) => entry.entryId);
  if (new Set(ids).size !== ids.length) fail('KSTACK_MUTATION_FOOTPRINT_INVALID');
  const roles = new Set(value.entries.map((entry) => entry.role));
  const requiredRoles = {
    CREATE_FILE: ['TARGET', 'STAGING'], REPLACE_FILE: ['TARGET', 'STAGING'], DELETE_FILE: ['TARGET', 'RECOVERY'],
    CREATE_DIRECTORY: ['TARGET', 'STAGING'], DELETE_EMPTY_DIRECTORY: ['TARGET', 'RECOVERY'], RENAME_WITHIN_ROOT: ['SOURCE', 'TARGET']
  }[value.operationKind];
  if (roles.size !== 2 || requiredRoles.some((role) => !roles.has(role))) fail('KSTACK_MUTATION_FOOTPRINT_INVALID');
  const byRole = Object.fromEntries(value.entries.map((entry) => [entry.role, entry]));
  const absent = (state) => state.type === 'ABSENT';
  const regular = (state) => state.type === 'REGULAR';
  const directory = (state) => state.type === 'DIRECTORY';
  const native = new Set(value.entries.map((entry) => entry.permittedNativeOperation));
  if (native.size !== 1) fail('KSTACK_MUTATION_FOOTPRINT_INVALID');
  const operation = [...native][0];
  let semantics = false;
  if (value.operationKind === 'CREATE_FILE') semantics = operation === 'rename-noreplace'
    && absent(byRole.TARGET.preState) && regular(byRole.STAGING.preState)
    && sameState(byRole.TARGET.postState, byRole.STAGING.preState) && absent(byRole.STAGING.postState);
  if (value.operationKind === 'REPLACE_FILE') semantics = operation === 'atomic-exchange'
    && regular(byRole.TARGET.preState) && regular(byRole.STAGING.preState)
    && sameState(byRole.TARGET.postState, byRole.STAGING.preState) && sameState(byRole.STAGING.postState, byRole.TARGET.preState);
  if (value.operationKind === 'DELETE_FILE') semantics = operation === 'rename-noreplace'
    && regular(byRole.TARGET.preState) && absent(byRole.RECOVERY.preState)
    && absent(byRole.TARGET.postState) && sameState(byRole.RECOVERY.postState, byRole.TARGET.preState);
  if (value.operationKind === 'CREATE_DIRECTORY') semantics = operation === 'rename-noreplace'
    && absent(byRole.TARGET.preState) && directory(byRole.STAGING.preState)
    && sameState(byRole.TARGET.postState, byRole.STAGING.preState) && absent(byRole.STAGING.postState);
  if (value.operationKind === 'DELETE_EMPTY_DIRECTORY') semantics = operation === 'rename-noreplace'
    && directory(byRole.TARGET.preState) && absent(byRole.RECOVERY.preState)
    && absent(byRole.TARGET.postState) && sameState(byRole.RECOVERY.postState, byRole.TARGET.preState);
  if (value.operationKind === 'RENAME_WITHIN_ROOT') semantics = operation === 'rename-noreplace'
    && !absent(byRole.SOURCE.preState) && absent(byRole.TARGET.preState)
    && absent(byRole.SOURCE.postState) && sameState(byRole.TARGET.postState, byRole.SOURCE.preState);
  if (!semantics) fail('KSTACK_MUTATION_FOOTPRINT_INVALID');
  return immutable(value);
}

export function validateLocalMutationPlan(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'requestDigest', 'attemptDigest', 'operationKind',
    'repositoryContextDigest', 'rootIdentityDigest', 'sourceRelativeTargetDigest', 'targetRelativeTargetDigest',
    'namespaceFootprintDigest', 'expectedSourceStateDigest', 'expectedTargetStateDigest',
    'desiredContentArtifactDigest', 'desiredMetadataProfileDigest', 'backendProfileDigest',
    'mutationIsolationEvidenceDigest', 'eligibilityDigest', 'eligibilityEpoch', 'activeSetDigest',
    'policyDigest', 'environmentSnapshotDigest', 'brokerEvaluationDigest', 'actionFenceProfileDigest',
    'deadline', 'byteLimit', 'createdAt', 'expiresAt'
  ], 'KSTACK_MUTATION_PLAN_INVALID');
  if (value.schemaId !== IDENTITIES.LocalMutationPlanV1[0] || value.schemaVersion !== 1) fail('KSTACK_MUTATION_PLAN_INVALID');
  digest(value.schemaSetDigest, 'KSTACK_MUTATION_PLAN_INVALID'); enumeration(value.operationKind, MUTATION_KINDS, 'KSTACK_MUTATION_PLAN_INVALID');
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest') && entry !== null) digest(entry, 'KSTACK_MUTATION_PLAN_INVALID');
  if (value.operationKind === 'RENAME_WITHIN_ROOT' && value.sourceRelativeTargetDigest === null) fail('KSTACK_MUTATION_PLAN_INVALID');
  if (value.operationKind !== 'RENAME_WITHIN_ROOT' && (value.sourceRelativeTargetDigest !== null || value.expectedSourceStateDigest !== null)) fail('KSTACK_MUTATION_PLAN_INVALID');
  if (value.expectedTargetStateDigest === null) fail('KSTACK_MUTATION_PLAN_INVALID');
  if (!['RENAME_WITHIN_ROOT', 'DELETE_FILE', 'DELETE_EMPTY_DIRECTORY'].includes(value.operationKind) && value.desiredContentArtifactDigest === null && value.operationKind !== 'CREATE_DIRECTORY') fail('KSTACK_MUTATION_PLAN_INVALID');
  if (['RENAME_WITHIN_ROOT', 'DELETE_FILE', 'DELETE_EMPTY_DIRECTORY', 'CREATE_DIRECTORY'].includes(value.operationKind) && value.desiredContentArtifactDigest !== null) fail('KSTACK_MUTATION_PLAN_INVALID');
  uint(value.eligibilityEpoch, Number.MAX_SAFE_INTEGER, true, 'KSTACK_MUTATION_PLAN_INVALID'); uint(value.deadline, Number.MAX_SAFE_INTEGER, true, 'KSTACK_MUTATION_PLAN_INVALID'); uint(value.byteLimit, 1_073_741_824, true, 'KSTACK_MUTATION_PLAN_INVALID');
  timestamp(value.createdAt, 'KSTACK_MUTATION_PLAN_INVALID'); timestamp(value.expiresAt, 'KSTACK_MUTATION_PLAN_INVALID');
  if (value.createdAt >= value.expiresAt) fail('KSTACK_MUTATION_PLAN_INVALID');
  return immutable(value);
}

const TRANSITIONS = Object.freeze({
  PLANNED: ['LOCKED', 'ABORTED'], LOCKED: ['PREPARED', 'ABORTED'], PREPARED: ['COMMIT_INTENT', 'ABORTED'],
  COMMIT_INTENT: ['COMMITTED', 'ROLLED_BACK', 'ABORTED', 'OUTCOME_AMBIGUOUS'],
  ABORTED: ['CLEANUP_INTENT'], CLEANUP_INTENT: ['CLEANED']
});
export function advanceMutationState(current, next) {
  enumeration(current, MUTATION_STATES, 'KSTACK_MUTATION_STATE_INVALID'); enumeration(next, MUTATION_STATES, 'KSTACK_MUTATION_STATE_INVALID');
  if (!(TRANSITIONS[current] ?? []).includes(next)) fail('KSTACK_MUTATION_STATE_INVALID');
  return next;
}

export function classifyMutationRecovery(input) {
  exact(input, ['operationKind', 'durableState', 'namespacePredicate', 'parentIdentitiesValid', 'observerAgreement', 'ledgerValid'], 'KSTACK_MUTATION_RECOVERY_INVALID');
  enumeration(input.operationKind, MUTATION_KINDS, 'KSTACK_MUTATION_RECOVERY_INVALID'); enumeration(input.durableState, MUTATION_STATES, 'KSTACK_MUTATION_RECOVERY_INVALID');
  enumeration(input.namespacePredicate, ['NO_OP', 'COMMITTED', 'STAGING_PRESENT', 'STAGING_ABSENT', 'OTHER'], 'KSTACK_MUTATION_RECOVERY_INVALID');
  bool(input.parentIdentitiesValid, 'KSTACK_MUTATION_RECOVERY_INVALID'); bool(input.observerAgreement, 'KSTACK_MUTATION_RECOVERY_INVALID'); bool(input.ledgerValid, 'KSTACK_MUTATION_RECOVERY_INVALID');
  if (!input.parentIdentitiesValid || !input.observerAgreement || !input.ledgerValid) return 'OUTCOME_AMBIGUOUS';
  if (input.durableState === 'COMMIT_INTENT') {
    if (input.namespacePredicate === 'COMMITTED') return 'COMMITTED';
    if (input.namespacePredicate === 'NO_OP') return 'ABORTED';
    return 'OUTCOME_AMBIGUOUS';
  }
  const cleanupKinds = ['CREATE_FILE', 'REPLACE_FILE', 'CREATE_DIRECTORY'];
  if (input.durableState === 'ABORTED' && cleanupKinds.includes(input.operationKind)) return input.namespacePredicate === 'STAGING_PRESENT' ? 'CLEANUP_INTENT' : 'OUTCOME_AMBIGUOUS';
  if (input.durableState === 'ABORTED' && !cleanupKinds.includes(input.operationKind)) return input.namespacePredicate === 'NO_OP' ? 'ABORTED' : 'OUTCOME_AMBIGUOUS';
  if (input.durableState === 'CLEANUP_INTENT' && cleanupKinds.includes(input.operationKind)) {
    if (input.namespacePredicate === 'STAGING_PRESENT') return 'CLEANUP_INTENT';
    if (input.namespacePredicate === 'STAGING_ABSENT') return 'CLEANED';
    return 'OUTCOME_AMBIGUOUS';
  }
  if (input.durableState === 'CLEANED') return input.namespacePredicate === 'STAGING_ABSENT' ? 'CLEANED' : 'OUTCOME_AMBIGUOUS';
  return 'OUTCOME_AMBIGUOUS';
}

export function createCleanupIntent(input) {
  exact(input, ['schemaSetDigest', 'abortedRecordDigest', 'footprintDigest', 'stagingIdentityDigest', 'postAbortStateDigest', 'removalPrimitiveId', 'durabilityBarrierDigest', 'cleanupSequence'], 'KSTACK_MUTATION_CLEANUP_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_MUTATION_CLEANUP_INVALID');
  for (const [key, entry] of Object.entries(input)) if (key.endsWith('Digest')) digest(entry, 'KSTACK_MUTATION_CLEANUP_INVALID');
  ascii(input.removalPrimitiveId, 'KSTACK_MUTATION_CLEANUP_INVALID'); uint(input.cleanupSequence, Number.MAX_SAFE_INTEGER, true, 'KSTACK_MUTATION_CLEANUP_INVALID');
  const intent = { ...head('CleanupIntentV1', input.schemaSetDigest), ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'schemaSetDigest')) };
  return immutable({ intent, intentDigest: address('CleanupIntentV1', intent) });
}

export function createLocalMutationEvidence(input) {
  exact(input, [
    'schemaSetDigest', 'planDigest', 'attemptDigest', 'preStateDigest', 'postStateDigest',
    'ledgerTransitionDigests', 'backendProfileDigest', 'isolationEvidenceDigest', 'eligibilityDigest',
    'fenceDigest', 'nativeOperationId', 'observerDigest', 'cleanupState', 'recoveryState',
    'startedAt', 'completedAt', 'outcome'
  ], 'KSTACK_MUTATION_EVIDENCE_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_MUTATION_EVIDENCE_INVALID');
  for (const [key, entry] of Object.entries(input)) if (key.endsWith('Digest')) digest(entry, 'KSTACK_MUTATION_EVIDENCE_INVALID');
  if (!Array.isArray(input.ledgerTransitionDigests) || input.ledgerTransitionDigests.length < 1 || input.ledgerTransitionDigests.length > 64) fail('KSTACK_MUTATION_EVIDENCE_INVALID');
  input.ledgerTransitionDigests.forEach((entry) => digest(entry, 'KSTACK_MUTATION_EVIDENCE_INVALID'));
  if (new Set(input.ledgerTransitionDigests).size !== input.ledgerTransitionDigests.length) fail('KSTACK_MUTATION_EVIDENCE_INVALID');
  ascii(input.nativeOperationId, 'KSTACK_MUTATION_EVIDENCE_INVALID'); enumeration(input.cleanupState, ['NONE', 'PENDING', 'CLEANED', 'BLOCKED'], 'KSTACK_MUTATION_EVIDENCE_INVALID');
  enumeration(input.recoveryState, ['NONE', 'RECOVERED_COMMITTED', 'RECOVERED_ABORTED', 'REQUIRED', 'BLOCKED'], 'KSTACK_MUTATION_EVIDENCE_INVALID');
  timestamp(input.startedAt, 'KSTACK_MUTATION_EVIDENCE_INVALID'); timestamp(input.completedAt, 'KSTACK_MUTATION_EVIDENCE_INVALID');
  if (input.startedAt >= input.completedAt) fail('KSTACK_MUTATION_EVIDENCE_INVALID'); enumeration(input.outcome, MUTATION_OUTCOMES, 'KSTACK_MUTATION_EVIDENCE_INVALID');
  const evidence = { ...head('LocalMutationEvidenceV1', input.schemaSetDigest), ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'schemaSetDigest')) };
  return immutable({ evidence, evidenceDigest: address('LocalMutationEvidenceV1', evidence) });
}

function validateCleanupIntent(value) {
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'abortedRecordDigest', 'footprintDigest', 'stagingIdentityDigest', 'postAbortStateDigest', 'removalPrimitiveId', 'durabilityBarrierDigest', 'cleanupSequence'], 'KSTACK_MUTATION_CLEANUP_INVALID');
  if (value.schemaId !== IDENTITIES.CleanupIntentV1[0] || value.schemaVersion !== 1) fail('KSTACK_MUTATION_CLEANUP_INVALID');
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, 'KSTACK_MUTATION_CLEANUP_INVALID');
  ascii(value.removalPrimitiveId, 'KSTACK_MUTATION_CLEANUP_INVALID'); uint(value.cleanupSequence, Number.MAX_SAFE_INTEGER, true, 'KSTACK_MUTATION_CLEANUP_INVALID');
  return immutable(value);
}

function validateInspection(value) {
  exact(value, ['namespacePredicate', 'footprintStateDigest', 'parentIdentitiesValid', 'observerAgreement'], 'KSTACK_MUTATION_INSPECTION_INVALID');
  enumeration(value.namespacePredicate, ['NO_OP', 'COMMITTED', 'STAGING_PRESENT', 'STAGING_ABSENT', 'OTHER'], 'KSTACK_MUTATION_INSPECTION_INVALID');
  digest(value.footprintStateDigest, 'KSTACK_MUTATION_INSPECTION_INVALID');
  bool(value.parentIdentitiesValid, 'KSTACK_MUTATION_INSPECTION_INVALID'); bool(value.observerAgreement, 'KSTACK_MUTATION_INSPECTION_INVALID');
  return immutable(value);
}

function journalRecord(event, planDigest, sequence, detail = {}) {
  return immutable({ event, planDigest, sequence, ...detail });
}

function journalRecordDigest(record) { return hostAddress('KSTACK-MUTATION-JOURNAL-RECORD-V1', record); }

function validateProtectedMutationBackend(backend, allowTestBackend) {
  exact(backend, ['descriptor', 'append', 'revalidate', 'atomicCommit', 'inspect', 'cleanup', 'durabilityBarrier'], 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  exact(backend.descriptor, [
    'protectionClass', 'repositoryWritable', 'agentWritable', 'durable', 'appendOnlyAudit',
    'exclusiveMediation', 'handleRelative', 'atomicPublication'
  ], 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
  const classes = ['os-protected', 'hardware-backed', 'qualified-service']; if (allowTestBackend) classes.push('test-only');
  if (!classes.includes(backend.descriptor.protectionClass) || backend.descriptor.repositoryWritable !== false
    || backend.descriptor.agentWritable !== false || backend.descriptor.durable !== true
    || backend.descriptor.appendOnlyAudit !== true || backend.descriptor.exclusiveMediation !== true
    || backend.descriptor.handleRelative !== true || backend.descriptor.atomicPublication !== true
    || ['append', 'revalidate', 'atomicCommit', 'inspect', 'cleanup', 'durabilityBarrier'].some((key) => typeof backend[key] !== 'function')) fail('KSTACK_MUTATION_ISOLATION_UNAVAILABLE');
  return backend;
}

export class ProtectedMutationKernel {
  #schemaSetDigest;
  #backend;
  #transactions = new Map();

  constructor(options) {
    exact(options, ['schemaSetDigest', 'backend', 'allowTestBackend'], 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
    this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_MUTATION_BACKEND_UNQUALIFIED');
    this.#backend = validateProtectedMutationBackend(options.backend, options.allowTestBackend === true);
  }

  async register(input) {
    exact(input, ['plan', 'footprint', 'backendProfile'], 'KSTACK_MUTATION_PLAN_INVALID');
    const plan = validateLocalMutationPlan(input.plan); const footprint = validateNamespaceFootprint(input.footprint);
    const backendProfile = validateMutationBackendProfile(input.backendProfile, { operationKind: plan.operationKind });
    if (plan.schemaSetDigest !== this.#schemaSetDigest || footprint.schemaSetDigest !== this.#schemaSetDigest
      || plan.operationKind !== footprint.operationKind || plan.rootIdentityDigest !== footprint.rootIdentityDigest
      || plan.namespaceFootprintDigest !== address('NamespaceFootprintV1', footprint)
      || plan.backendProfileDigest !== backendProfile.profileDigest || this.#transactions.has(address('LocalMutationPlanV1', plan))) fail('KSTACK_MUTATION_PLAN_INVALID');
    const planDigest = address('LocalMutationPlanV1', plan);
    const record = journalRecord('PLANNED', planDigest, 1);
    const receipt = await this.#backend.append(record); digest(receipt, 'KSTACK_MUTATION_STATE_CORRUPT');
    this.#transactions.set(planDigest, { plan, footprint, state: 'PLANNED', sequence: 1, lastRecordDigest: journalRecordDigest(record), cleanupIntentDigest: null });
    return immutable({ planDigest, protectedAuditReceiptDigest: receipt });
  }

  async advance(planDigest, nextState) {
    digest(planDigest, 'KSTACK_MUTATION_STATE_INVALID'); const transaction = this.#transactions.get(planDigest);
    if (!transaction || ['COMMIT_INTENT', 'CLEANUP_INTENT', 'CLEANED'].includes(nextState)) fail('KSTACK_MUTATION_STATE_INVALID');
    advanceMutationState(transaction.state, nextState); const sequence = transaction.sequence + 1;
    const record = journalRecord(nextState, planDigest, sequence);
    const receipt = await this.#backend.append(record); digest(receipt, 'KSTACK_MUTATION_STATE_CORRUPT');
    transaction.state = nextState; transaction.sequence = sequence; transaction.lastRecordDigest = journalRecordDigest(record);
    return immutable({ planDigest, state: nextState, sequence, protectedAuditReceiptDigest: receipt });
  }

  async commit(input) {
    exact(input, ['planDigest', 'fenceDigest', 'currentBindingDigest'], 'KSTACK_MUTATION_COMMIT_INVALID');
    digest(input.planDigest, 'KSTACK_MUTATION_COMMIT_INVALID'); digest(input.fenceDigest, 'KSTACK_MUTATION_COMMIT_INVALID'); digest(input.currentBindingDigest, 'KSTACK_MUTATION_COMMIT_INVALID');
    const transaction = this.#transactions.get(input.planDigest);
    if (!transaction || transaction.state !== 'PREPARED') fail('KSTACK_MUTATION_COMMIT_INVALID');
    const revalidated = await this.#backend.revalidate(immutable({ plan: transaction.plan, footprint: transaction.footprint, fenceDigest: input.fenceDigest, currentBindingDigest: input.currentBindingDigest }));
    if (revalidated !== true) return this.advance(input.planDigest, 'ABORTED');
    const intentSequence = transaction.sequence + 1;
    const intentRecord = journalRecord('COMMIT_INTENT', input.planDigest, intentSequence, { fenceDigest: input.fenceDigest, currentBindingDigest: input.currentBindingDigest });
    const intentReceipt = await this.#backend.append(intentRecord); digest(intentReceipt, 'KSTACK_MUTATION_STATE_CORRUPT');
    transaction.state = 'COMMIT_INTENT'; transaction.sequence = intentSequence; transaction.lastRecordDigest = journalRecordDigest(intentRecord);
    try {
      await this.#backend.atomicCommit(immutable({ plan: transaction.plan, footprint: transaction.footprint }));
      const inspection = validateInspection(await this.#backend.inspect(immutable({ plan: transaction.plan, footprint: transaction.footprint })));
      const disposition = classifyMutationRecovery({ operationKind: transaction.plan.operationKind, durableState: 'COMMIT_INTENT', namespacePredicate: inspection.namespacePredicate, parentIdentitiesValid: inspection.parentIdentitiesValid, observerAgreement: inspection.observerAgreement, ledgerValid: true });
      const nextState = disposition === 'COMMITTED' ? 'COMMITTED' : disposition === 'ABORTED' ? 'ABORTED' : 'OUTCOME_AMBIGUOUS';
      const result = await this.advance(input.planDigest, nextState);
      return immutable({ ...result, commitIntentReceiptDigest: intentReceipt });
    } catch {
      const result = await this.advance(input.planDigest, 'OUTCOME_AMBIGUOUS');
      return immutable({ ...result, commitIntentReceiptDigest: intentReceipt });
    }
  }

  async cleanup(input) {
    exact(input, ['planDigest', 'cleanupIntent'], 'KSTACK_MUTATION_CLEANUP_INVALID');
    digest(input.planDigest, 'KSTACK_MUTATION_CLEANUP_INVALID'); const intent = validateCleanupIntent(input.cleanupIntent);
    const transaction = this.#transactions.get(input.planDigest);
    if (!transaction || !['ABORTED', 'CLEANUP_INTENT'].includes(transaction.state)
      || !['CREATE_FILE', 'REPLACE_FILE', 'CREATE_DIRECTORY'].includes(transaction.plan.operationKind)
      || intent.schemaSetDigest !== this.#schemaSetDigest
      || intent.footprintDigest !== address('NamespaceFootprintV1', transaction.footprint)) fail('KSTACK_MUTATION_CLEANUP_INVALID');

    if (transaction.state === 'ABORTED') {
      const before = validateInspection(await this.#backend.inspect(immutable({ plan: transaction.plan, footprint: transaction.footprint })));
      if (classifyMutationRecovery({ operationKind: transaction.plan.operationKind, durableState: 'ABORTED', namespacePredicate: before.namespacePredicate, parentIdentitiesValid: before.parentIdentitiesValid, observerAgreement: before.observerAgreement, ledgerValid: true }) !== 'CLEANUP_INTENT'
        || intent.abortedRecordDigest !== transaction.lastRecordDigest || intent.postAbortStateDigest !== before.footprintStateDigest
        || intent.cleanupSequence !== transaction.sequence + 1) fail('KSTACK_MUTATION_CLEANUP_INVALID');
      const intentDigest = address('CleanupIntentV1', intent);
      const record = journalRecord('CLEANUP_INTENT', input.planDigest, intent.cleanupSequence, { cleanupIntentDigest: intentDigest });
      const receipt = await this.#backend.append(record); digest(receipt, 'KSTACK_MUTATION_STATE_CORRUPT');
      transaction.state = 'CLEANUP_INTENT'; transaction.sequence = intent.cleanupSequence;
      transaction.lastRecordDigest = journalRecordDigest(record); transaction.cleanupIntentDigest = intentDigest;
    } else if (address('CleanupIntentV1', intent) !== transaction.cleanupIntentDigest) fail('KSTACK_MUTATION_CLEANUP_INVALID');

    try {
      let inspection = validateInspection(await this.#backend.inspect(immutable({ plan: transaction.plan, footprint: transaction.footprint })));
      let disposition = classifyMutationRecovery({ operationKind: transaction.plan.operationKind, durableState: 'CLEANUP_INTENT', namespacePredicate: inspection.namespacePredicate, parentIdentitiesValid: inspection.parentIdentitiesValid, observerAgreement: inspection.observerAgreement, ledgerValid: true });
      if (disposition === 'CLEANUP_INTENT') {
        await this.#backend.cleanup(immutable({ plan: transaction.plan, footprint: transaction.footprint, cleanupIntent: intent }));
        inspection = validateInspection(await this.#backend.inspect(immutable({ plan: transaction.plan, footprint: transaction.footprint })));
        disposition = classifyMutationRecovery({ operationKind: transaction.plan.operationKind, durableState: 'CLEANUP_INTENT', namespacePredicate: inspection.namespacePredicate, parentIdentitiesValid: inspection.parentIdentitiesValid, observerAgreement: inspection.observerAgreement, ledgerValid: true });
      }
      if (disposition !== 'CLEANED') fail('KSTACK_MUTATION_CLEANUP_BLOCKED');
      await this.#backend.durabilityBarrier(immutable({ plan: transaction.plan, footprint: transaction.footprint, cleanupIntent: intent }));
      const afterBarrier = validateInspection(await this.#backend.inspect(immutable({ plan: transaction.plan, footprint: transaction.footprint })));
      if (classifyMutationRecovery({ operationKind: transaction.plan.operationKind, durableState: 'CLEANUP_INTENT', namespacePredicate: afterBarrier.namespacePredicate, parentIdentitiesValid: afterBarrier.parentIdentitiesValid, observerAgreement: afterBarrier.observerAgreement, ledgerValid: true }) !== 'CLEANED') fail('KSTACK_MUTATION_CLEANUP_BLOCKED');
      const sequence = transaction.sequence + 1; const record = journalRecord('CLEANED', input.planDigest, sequence, { cleanupIntentDigest: transaction.cleanupIntentDigest });
      const receipt = await this.#backend.append(record); digest(receipt, 'KSTACK_MUTATION_STATE_CORRUPT');
      transaction.state = 'CLEANED'; transaction.sequence = sequence; transaction.lastRecordDigest = journalRecordDigest(record);
      return immutable({ planDigest: input.planDigest, state: 'CLEANED', sequence, protectedAuditReceiptDigest: receipt });
    } catch (error) {
      if (error instanceof HostMutationError) throw error;
      fail('KSTACK_MUTATION_CLEANUP_BLOCKED');
    }
  }

  snapshot(planDigest) {
    digest(planDigest, 'KSTACK_MUTATION_STATE_INVALID'); const transaction = this.#transactions.get(planDigest);
    if (!transaction) fail('KSTACK_MUTATION_STATE_INVALID');
    return immutable({ planDigest, state: transaction.state, sequence: transaction.sequence, lastRecordDigest: transaction.lastRecordDigest });
  }
}
