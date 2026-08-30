import { assertAsciiId, assertDigest, assertRegistryId, assertTimestamp, hostAddress } from './kstack-host-contract.mjs';

export class HostMigrationError extends Error {
  constructor(code) { super(code); this.name = 'HostMigrationError'; this.code = code; }
}
function fail(code) { throw new HostMigrationError(code); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function digest(value, code, nullable = false) { if (nullable && value === null) return null; try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code) { try { return assertAsciiId(value); } catch { fail(code); } }
function registry(value, code) { try { return assertRegistryId(value); } catch { fail(code); } }
function timestamp(value, code) { try { return assertTimestamp(value); } catch { fail(code); } }
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function uint(value, code, positive = false) { if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail(code); return value; }
function enumeration(value, allowed, code) { if (!allowed.includes(value)) fail(code); return value; }
function sortedUnique(values, validator, minimum, maximum, code) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((value) => validator(value, code));
  if (new Set(values).size !== values.length || values.some((value, index) => index > 0 && value <= values[index - 1])) fail(code);
  return values;
}
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export const ARTIFACT_DISPOSITIONS = Object.freeze(['AUTHORITATIVE', 'DERIVED_REBUILDABLE', 'EPHEMERAL', 'EXTERNAL_EFFECT', 'PROTECTED_AUDIT', 'REPLAY_SAFETY']);
export const MIGRATION_CLASSIFICATIONS = Object.freeze(['CHANGED_BACKWARD_READABLE', 'DERIVED_REBUILD_VERIFIED', 'EPHEMERAL_DROP_VERIFIED', 'FORWARD_RECOVERY_VERIFIED', 'RESTORE_AND_REPLAY_VERIFIED', 'UNCHANGED_BACKWARD_READABLE', 'UNSUPPORTED']);
export const ROLLBACK_STRATEGIES = Object.freeze(['BACKWARD_READABLE', 'FORWARD_RECOVERY', 'NONE', 'RESTORE_REPLAY']);
export const MIGRATION_OUTCOMES = Object.freeze(['AMBIGUOUS', 'FAIL', 'HARNESS_ERROR', 'INCOMPLETE', 'PASS']);
export const ROLLBACK_STATUSES = Object.freeze(['AVAILABLE', 'EXPIRED', 'INVALIDATED', 'UNAVAILABLE']);
export const DATA_LOSS_CLAIMS = Object.freeze(['NONZERO_DISCLOSED', 'UNKNOWN', 'ZERO_PROVEN']);
export const ROLLOUT_SEAMS = Object.freeze(['H3A_SKILL_PROJECTION', 'H3B_READ_ONLY_MCP']);
export const MIGRATION_STATES = Object.freeze(['ACTIVATION_READY', 'CANDIDATE_ACTIVE', 'FAILED_SAFE', 'FORWARD_RECOVERED', 'FORWARD_RECOVERING', 'MIGRATING', 'OUTCOME_AMBIGUOUS', 'PLANNED', 'PRIOR_ACTIVE', 'RECOVERY_REQUIRED', 'RESTORING', 'ROLLBACK_FENCED', 'SNAPSHOT_VERIFIED', 'TARGET_VERIFIED', 'WRITES_FENCED']);
export const ROLLBACK_INVALIDATORS = Object.freeze(['changeJournalMissing', 'externalStateContradiction', 'keyChanged', 'qualificationExpired', 'recoverySetMissing', 'schemaChanged', 'snapshotInvalid', 'transformChanged', 'unjournaledWrite']);

const ROW_KEYS = Object.freeze(['artifactId', 'authorityClassId', 'ownerComponentId', 'locationIdentityDigest', 'schemaVersionId', 'semanticVersionId', 'readerSetDigest', 'writerSetDigest', 'retentionProfileDigest', 'confidentialityClassId', 'encryptionProfileDigest', 'keyGenerationDigest', 'consistencyGroupId', 'snapshotMethodId', 'mutationProfileDigest', 'externalStateCorrelationDigest', 'migrationTransformDigest', 'restoreReplayTransformDigest', 'validationOracleDigest', 'disposition', 'derivedSourceTruthDigest', 'derivedRebuildImplementationDigest', 'derivedEqualityVectorDigest', 'derivedAuthorityIsolationProven']);

function validateArtifactRow(value, code) {
  exact(value, ROW_KEYS, code);
  for (const key of ['artifactId', 'ownerComponentId', 'schemaVersionId', 'semanticVersionId', 'consistencyGroupId', 'snapshotMethodId']) ascii(value[key], code);
  for (const key of ['authorityClassId', 'confidentialityClassId']) registry(value[key], code);
  for (const key of ROW_KEYS.filter((key) => key.endsWith('Digest'))) digest(value[key], code, ['externalStateCorrelationDigest', 'migrationTransformDigest', 'restoreReplayTransformDigest', 'derivedSourceTruthDigest', 'derivedRebuildImplementationDigest', 'derivedEqualityVectorDigest'].includes(key));
  enumeration(value.disposition, ARTIFACT_DISPOSITIONS, code); bool(value.derivedAuthorityIsolationProven, code);
  const derived = value.disposition === 'DERIVED_REBUILDABLE'; const derivedFieldsPresent = value.derivedSourceTruthDigest !== null && value.derivedRebuildImplementationDigest !== null && value.derivedEqualityVectorDigest !== null;
  if (derived ? (!derivedFieldsPresent || !value.derivedAuthorityIsolationProven) : (value.derivedSourceTruthDigest !== null || value.derivedRebuildImplementationDigest !== null || value.derivedEqualityVectorDigest !== null || value.derivedAuthorityIsolationProven)) fail(code);
  if (value.disposition === 'EXTERNAL_EFFECT' ? value.externalStateCorrelationDigest === null : value.externalStateCorrelationDigest !== null) fail(code);
  return value;
}

export function createPersistedArtifactInventory(value) {
  const code = 'KSTACK_MIGRATION_INVENTORY_INVALID';
  exact(value, ['schemaSetDigest', 'currentActiveSetDigest', 'candidateActiveSetDigest', 'declaredArtifactIds', 'staticArtifactIds', 'registryArtifactIds', 'openedStoreArtifactIds', 'catalogArtifactIds', 'providerArtifactIds', 'dynamicWriteArtifactIds', 'rows'], code);
  for (const key of ['schemaSetDigest', 'currentActiveSetDigest', 'candidateActiveSetDigest']) digest(value[key], code);
  for (const key of ['declaredArtifactIds', 'staticArtifactIds', 'registryArtifactIds', 'openedStoreArtifactIds', 'catalogArtifactIds', 'providerArtifactIds', 'dynamicWriteArtifactIds']) sortedUnique(value[key], ascii, key === 'declaredArtifactIds' ? 1 : 0, 4096, code);
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 4096) fail(code); value.rows.forEach((row) => validateArtifactRow(row, code));
  if (value.rows.some((row, index) => index > 0 && row.artifactId <= value.rows[index - 1].artifactId)) fail(code);
  const discovered = [...new Set(['staticArtifactIds', 'registryArtifactIds', 'openedStoreArtifactIds', 'catalogArtifactIds', 'providerArtifactIds', 'dynamicWriteArtifactIds'].flatMap((key) => value[key]))].sort();
  const rowIds = value.rows.map((row) => row.artifactId);
  if (JSON.stringify(value.declaredArtifactIds) !== JSON.stringify(discovered) || JSON.stringify(rowIds) !== JSON.stringify(discovered)) fail('KSTACK_MIGRATION_INVENTORY_SET_MISMATCH');
  const inventory = immutable({ schemaId: 'kstack.persisted-artifact-inventory.v1', schemaVersion: 1, ...value });
  return immutable({ inventory, inventoryDigest: hostAddress('KSTACK-PERSISTED-ARTIFACT-INVENTORY-V1', inventory) });
}

function validateClassification(value, code) {
  exact(value, ['artifactId', 'consistencyGroupId', 'classification', 'fixtureSetDigest', 'oracleDigest', 'priorReadProven', 'priorWriteProven', 'snapshotRestoreProven', 'candidateWriteReplayProven', 'forwardRecoveryProven', 'rebuildProven', 'ephemeralDropProven'], code);
  ascii(value.artifactId, code); ascii(value.consistencyGroupId, code); enumeration(value.classification, MIGRATION_CLASSIFICATIONS, code); digest(value.fixtureSetDigest, code); digest(value.oracleDigest, code);
  for (const key of ['priorReadProven', 'priorWriteProven', 'snapshotRestoreProven', 'candidateWriteReplayProven', 'forwardRecoveryProven', 'rebuildProven', 'ephemeralDropProven']) bool(value[key], code);
  const required = {
    UNCHANGED_BACKWARD_READABLE: ['priorReadProven', 'priorWriteProven'], CHANGED_BACKWARD_READABLE: ['priorReadProven', 'priorWriteProven'],
    RESTORE_AND_REPLAY_VERIFIED: ['snapshotRestoreProven', 'candidateWriteReplayProven'], FORWARD_RECOVERY_VERIFIED: ['forwardRecoveryProven'],
    DERIVED_REBUILD_VERIFIED: ['rebuildProven'], EPHEMERAL_DROP_VERIFIED: ['ephemeralDropProven'], UNSUPPORTED: []
  }[value.classification];
  if (required.some((key) => !value[key])) fail(code); return value;
}

export function createMigrationPlan(value) {
  const code = 'KSTACK_MIGRATION_PLAN_INVALID';
  exact(value, ['schemaSetDigest', 'priorActiveSetDigest', 'candidateActiveSetDigest', 'recoveryActiveSetDigest', 'inventoryDigest', 'compatibilityEntryDigest', 'sourceVersionSetDigest', 'targetVersionSetDigest', 'transformSetDigest', 'consistencyGroupOrder', 'resourceLimitDigest', 'writeFenceProfileDigest', 'snapshotProfileDigest', 'restoreReplayProfileDigest', 'expectedStateDigest', 'oracleFixtureSetDigest', 'cleanupProfileDigest', 'rollbackWindowEndsAt', 'expiresAt', 'classifications'], code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code, key === 'recoveryActiveSetDigest');
  sortedUnique(value.consistencyGroupOrder, ascii, 1, 1024, code); timestamp(value.rollbackWindowEndsAt, code); timestamp(value.expiresAt, code); if (value.expiresAt >= value.rollbackWindowEndsAt) fail(code);
  if (!Array.isArray(value.classifications) || value.classifications.length < 1 || value.classifications.length > 4096) fail(code); value.classifications.forEach((row) => validateClassification(row, code));
  if (value.classifications.some((row, index) => index > 0 && row.artifactId <= value.classifications[index - 1].artifactId)) fail(code);
  if (value.classifications.some((row) => !value.consistencyGroupOrder.includes(row.consistencyGroupId))) fail(code);
  const plan = immutable({ schemaId: 'kstack.migration-plan.v1', schemaVersion: 1, ...value });
  return immutable({ plan, planDigest: hostAddress('KSTACK-MIGRATION-PLAN-V1', plan) });
}

export function validateMigrationQualification(value) {
  const code = 'KSTACK_MIGRATION_QUALIFICATION_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'planDigest', 'inventoryDigest', 'inputFixtureDigest', 'outputFixtureDigest', 'oracleSetDigest', 'environmentDigest', 'resourceMeasurementDigest', 'artifactResultDigest', 'completeArtifactIds', 'recoveryDurationMs', 'limitationsDigest', 'harnessIndependent', 'subjectCouldWriteEvidence', 'outcome', 'qualifiedAt', 'expiresAt'], code);
  if (value.schemaId !== 'kstack.migration-qualification.v1' || value.schemaVersion !== 1) fail(code); for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code);
  sortedUnique(value.completeArtifactIds, ascii, 1, 4096, code); uint(value.recoveryDurationMs, code); bool(value.harnessIndependent, code); bool(value.subjectCouldWriteEvidence, code); enumeration(value.outcome, MIGRATION_OUTCOMES, code); timestamp(value.qualifiedAt, code); timestamp(value.expiresAt, code);
  if (value.qualifiedAt >= value.expiresAt || value.outcome === 'PASS' && (!value.harnessIndependent || value.subjectCouldWriteEvidence)) fail(code); return immutable(value);
}

export function validateRollbackAvailability(value) {
  const code = 'KSTACK_ROLLBACK_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'planDigest', 'strategy', 'artifactCoverageDigest', 'priorActiveSetDigest', 'recoveryActiveSetDigest', 'snapshotDigest', 'changeJournalDigest', 'lastVerifiedStoreDigest', 'lastVerifiedStoreSequence', 'candidateWritesAccepted', 'expiresAt', 'invalidatorSetDigest', 'estimatedRecoveryMs', 'dataLossClaim', 'status', 'retainedDependencySetDigest'], code);
  if (value.schemaId !== 'kstack.rollback-availability.v1' || value.schemaVersion !== 1) fail(code); for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code, ['recoveryActiveSetDigest', 'snapshotDigest', 'changeJournalDigest'].includes(key));
  enumeration(value.strategy, ROLLBACK_STRATEGIES, code); uint(value.lastVerifiedStoreSequence, code); bool(value.candidateWritesAccepted, code); timestamp(value.expiresAt, code); uint(value.estimatedRecoveryMs, code); enumeration(value.dataLossClaim, DATA_LOSS_CLAIMS, code); enumeration(value.status, ROLLBACK_STATUSES, code);
  if (value.strategy === 'RESTORE_REPLAY' && (value.snapshotDigest === null || value.changeJournalDigest === null)) fail(code); if (value.strategy === 'FORWARD_RECOVERY' && value.recoveryActiveSetDigest === null) fail(code); return immutable(value);
}

export function classifyHpQ3Predicate(value) {
  const code = 'KSTACK_ROLLBACK_GATE_INVALID'; exact(value, ['artifactChanging', 'complete', 'current', 'supported', 'qualificationPass', 'bindingsMatch', 'rollbackAvailable', 'zeroLossProven', 'strategyPresent', 'operationalPointerRollback'], code);
  for (const key of Object.keys(value)) bool(value[key], code);
  if (!value.complete || !value.current || !value.supported || !value.qualificationPass || !value.bindingsMatch) return 'BLOCKED_EVIDENCE';
  if (value.artifactChanging && (!value.rollbackAvailable || !value.zeroLossProven || !value.strategyPresent)) return 'BLOCKED_ZERO_LOSS';
  if (!value.artifactChanging && !value.operationalPointerRollback) return 'ROLLBACK_UNAVAILABLE';
  return 'ACTIVATION_READY';
}

export function evaluateHpQ3Gate(input) {
  const code = 'KSTACK_ROLLBACK_GATE_INVALID'; exact(input, ['artifactChanging', 'operationalPointerRollback', 'inventoryArtifactIds', 'plan', 'qualification', 'rollback', 'trustedTime'], code); bool(input.artifactChanging, code); bool(input.operationalPointerRollback, code); timestamp(input.trustedTime, code); sortedUnique(input.inventoryArtifactIds, ascii, 1, 4096, code);
  const plan = createMigrationPlan(input.plan).plan; const qualification = validateMigrationQualification(input.qualification); const rollback = validateRollbackAvailability(input.rollback);
  const complete = JSON.stringify(input.inventoryArtifactIds) === JSON.stringify(plan.classifications.map((row) => row.artifactId)) && JSON.stringify(input.inventoryArtifactIds) === JSON.stringify(qualification.completeArtifactIds);
  const current = input.trustedTime < plan.expiresAt && input.trustedTime < qualification.expiresAt && input.trustedTime < rollback.expiresAt;
  const supported = plan.classifications.every((row) => row.classification !== 'UNSUPPORTED');
  const bindingsMatch = qualification.planDigest === hostAddress('KSTACK-MIGRATION-PLAN-V1', plan) && qualification.inventoryDigest === plan.inventoryDigest && rollback.planDigest === qualification.planDigest && rollback.priorActiveSetDigest === plan.priorActiveSetDigest && rollback.recoveryActiveSetDigest === plan.recoveryActiveSetDigest;
  const predicate = classifyHpQ3Predicate({ artifactChanging: input.artifactChanging, complete, current, supported, qualificationPass: qualification.outcome === 'PASS', bindingsMatch, rollbackAvailable: rollback.status === 'AVAILABLE', zeroLossProven: rollback.dataLossClaim === 'ZERO_PROVEN', strategyPresent: rollback.strategy !== 'NONE', operationalPointerRollback: input.operationalPointerRollback });
  if (predicate === 'BLOCKED_EVIDENCE') return immutable({ disposition: 'BLOCKED', reasonCode: 'KSTACK_ROLLBACK_EVIDENCE_INCOMPLETE' });
  if (predicate === 'BLOCKED_ZERO_LOSS') return immutable({ disposition: 'BLOCKED', reasonCode: 'KSTACK_ROLLBACK_ZERO_LOSS_REQUIRED' });
  if (predicate === 'ROLLBACK_UNAVAILABLE') return immutable({ disposition: predicate, reasonCode: 'KSTACK_ROLLBACK_OPERATIONAL_UNAVAILABLE' });
  return immutable({ disposition: predicate, reasonCode: 'KSTACK_ROLLBACK_GATE_PROVEN' });
}

const TRANSITIONS = Object.freeze({ PLANNED: ['FAILED_SAFE', 'OUTCOME_AMBIGUOUS', 'RESTORING', 'WRITES_FENCED'], WRITES_FENCED: ['FAILED_SAFE', 'OUTCOME_AMBIGUOUS', 'RESTORING', 'SNAPSHOT_VERIFIED'], SNAPSHOT_VERIFIED: ['FAILED_SAFE', 'MIGRATING', 'OUTCOME_AMBIGUOUS', 'RESTORING'], MIGRATING: ['FAILED_SAFE', 'FORWARD_RECOVERING', 'OUTCOME_AMBIGUOUS', 'RESTORING', 'TARGET_VERIFIED'], TARGET_VERIFIED: ['ACTIVATION_READY', 'FAILED_SAFE', 'FORWARD_RECOVERING', 'OUTCOME_AMBIGUOUS', 'RESTORING'], ACTIVATION_READY: ['CANDIDATE_ACTIVE'], CANDIDATE_ACTIVE: ['ROLLBACK_FENCED'], ROLLBACK_FENCED: ['FORWARD_RECOVERED', 'OUTCOME_AMBIGUOUS', 'PRIOR_ACTIVE', 'RECOVERY_REQUIRED'] });
export function validateMigrationTransition(value) { const code = 'KSTACK_MIGRATION_TRANSITION_INVALID'; exact(value, ['from', 'to'], code); enumeration(value.from, MIGRATION_STATES, code); enumeration(value.to, MIGRATION_STATES, code); if (!(TRANSITIONS[value.from] || []).includes(value.to)) fail(code); return immutable(value); }

export function classifyRollbackInvalidation(value) {
  const code = 'KSTACK_ROLLBACK_INVALIDATION_INVALID'; exact(value, ['trustedTime', 'expiresAt', ...ROLLBACK_INVALIDATORS], code); timestamp(value.trustedTime, code); timestamp(value.expiresAt, code); for (const key of ROLLBACK_INVALIDATORS) bool(value[key], code);
  if (ROLLBACK_INVALIDATORS.some((key) => value[key])) return 'INVALIDATED'; if (value.trustedTime >= value.expiresAt) return 'EXPIRED'; return 'AVAILABLE';
}

export function validateRetentionRelease(value) {
  const code = 'KSTACK_ROLLBACK_RETENTION_RELEASE_INVALID'; exact(value, ['schemaSetDigest', 'planDigest', 'retainedDependencySetDigest', 'rollbackWindowConclusive', 'liveReferenceCount', 'policyRetentionPermits', 'protectedAction', 'auditReceiptDigest'], code); for (const key of ['schemaSetDigest', 'planDigest', 'retainedDependencySetDigest', 'auditReceiptDigest']) digest(value[key], code); bool(value.rollbackWindowConclusive, code); uint(value.liveReferenceCount, code); bool(value.policyRetentionPermits, code); bool(value.protectedAction, code); if (!value.rollbackWindowConclusive || value.liveReferenceCount !== 0 || !value.policyRetentionPermits || !value.protectedAction) fail(code); return immutable(value);
}

export function validateRolloutSeam(value) {
  const code = 'KSTACK_ROLLOUT_SEAM_INVALID'; exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'seamId', 'seamType', 'candidateActiveSetDigest', 'allowedMethods', 'publicResourceSetDigest', 'isolatedEnvironmentDigest', 'brokerAvailable', 'credentialsAvailable', 'writeHandlesAvailable', 'productionRepositoryAvailable', 'privateResourcesAvailable', 'toolsAvailable', 'promptsAvailable', 'subscriptionsAvailable', 'samplingAvailable', 'elicitationAvailable', 'identityPromotionAllowed', 'downstreamEvidenceAllowed'], code);
  if (value.schemaId !== 'kstack.rollout-seam.v1' || value.schemaVersion !== 1) fail(code); digest(value.schemaSetDigest, code); ascii(value.seamId, code); enumeration(value.seamType, ROLLOUT_SEAMS, code); digest(value.candidateActiveSetDigest, code); if (!Array.isArray(value.allowedMethods) || value.allowedMethods.length > 2 || value.allowedMethods.some((method) => !['resources/list', 'resources/read'].includes(method)) || new Set(value.allowedMethods).size !== value.allowedMethods.length) fail(code); digest(value.publicResourceSetDigest, code, value.seamType === 'H3A_SKILL_PROJECTION'); digest(value.isolatedEnvironmentDigest, code);
  for (const key of ['brokerAvailable', 'credentialsAvailable', 'writeHandlesAvailable', 'productionRepositoryAvailable', 'privateResourcesAvailable', 'toolsAvailable', 'promptsAvailable', 'subscriptionsAvailable', 'samplingAvailable', 'elicitationAvailable', 'identityPromotionAllowed', 'downstreamEvidenceAllowed']) if (bool(value[key], code)) fail(code);
  if (value.seamType === 'H3B_READ_ONLY_MCP' && JSON.stringify(value.allowedMethods) !== JSON.stringify(['resources/list', 'resources/read'])) fail(code); if (value.seamType === 'H3A_SKILL_PROJECTION' && value.allowedMethods.length !== 0) fail(code); return immutable(value);
}

export function validateShadowRun(value) {
  const code = 'KSTACK_SHADOW_INVALID'; exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'seamDigest', 'candidateActiveSetDigest', 'priorActiveSetDigest', 'inputSetDigest', 'syntheticOrSanitized', 'isolatedEnvironmentDigest', 'outputSchemaDigest', 'comparisonOracleDigest', 'sideEffectDenialObserverDigest', 'limitProfileDigest', 'startMeasurementDigest', 'endMeasurementDigest', 'sideEffectDetected', 'outcome'], code);
  if (value.schemaId !== 'kstack.shadow-run.v1' || value.schemaVersion !== 1) fail(code); for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code); bool(value.syntheticOrSanitized, code); bool(value.sideEffectDetected, code); enumeration(value.outcome, ['MATCH', 'MISMATCH', 'SIDE_EFFECT_DETECTED'], code);
  if (!value.syntheticOrSanitized || value.sideEffectDetected !== (value.outcome === 'SIDE_EFFECT_DETECTED')) fail(code); return immutable(value);
}

export function validateMigrationBackendProfile(value) {
  const code = 'KSTACK_MIGRATION_BACKEND_UNQUALIFIED';
  exact(value, ['profileId', 'profileDigest', 'implementationDigest', 'platformDigest', 'protectionClass', 'protectedWriterFence', 'durableJournal', 'protectedSnapshot', 'changeJournal', 'independentOracle', 'activationOrderDomain', 'externalRewriteDisabled', 'repositoryWritable', 'agentWritable', 'qualifiedOutcome'], code);
  ascii(value.profileId, code); for (const key of ['profileDigest', 'implementationDigest', 'platformDigest']) digest(value[key], code);
  enumeration(value.protectionClass, ['os-protected', 'qualified-service', 'test-only'], code);
  for (const key of ['protectedWriterFence', 'durableJournal', 'protectedSnapshot', 'changeJournal', 'independentOracle', 'activationOrderDomain', 'externalRewriteDisabled', 'repositoryWritable', 'agentWritable']) bool(value[key], code);
  if (!value.protectedWriterFence || !value.durableJournal || !value.protectedSnapshot || !value.changeJournal || !value.independentOracle || !value.activationOrderDomain || !value.externalRewriteDisabled || value.repositoryWritable || value.agentWritable || value.qualifiedOutcome !== 'PASS') fail(code);
  return immutable(value);
}

const BACKEND_METHODS = Object.freeze(['withMigrationTransaction', 'append', 'fenceWriters', 'reconcileInFlight', 'captureSnapshot', 'startChangeJournal', 'runTransformGroup', 'verifyTarget', 'snapshotActivationGate', 'activateCandidate', 'recoverPreActivation', 'releaseWriters', 'captureJournalEnd', 'revalidatePriorCompatibility', 'restoreSnapshot', 'replayCandidateWrites', 'forwardRecover', 'verifyRecoveryTarget', 'activateRecoveryTarget']);
function validateBackend(value, allowTestBackend) {
  const code = 'KSTACK_MIGRATION_BACKEND_INVALID'; exact(value, ['descriptor', ...BACKEND_METHODS], code); validateMigrationBackendProfile(value.descriptor);
  if (!allowTestBackend && value.descriptor.protectionClass === 'test-only') fail(code); for (const key of BACKEND_METHODS) if (typeof value[key] !== 'function') fail(code); return value;
}
function receipt(value, code) { return digest(value, code); }
function qualificationDigest(value) { return hostAddress('KSTACK-MIGRATION-QUALIFICATION-V1', value); }
function rollbackDigest(value) { return hostAddress('KSTACK-ROLLBACK-AVAILABILITY-V1', value); }

export class ProtectedMigrationKernel {
  #schemaSetDigest; #backend;
  constructor(options) {
    exact(options, ['schemaSetDigest', 'backend', 'allowTestBackend'], 'KSTACK_MIGRATION_BACKEND_INVALID'); this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_MIGRATION_BACKEND_INVALID'); this.#backend = validateBackend(options.backend, options.allowTestBackend === true);
  }
  async execute(input) {
    exact(input, ['artifactChanging', 'operationalPointerRollback', 'rollbackLimitationDisplayed', 'inventoryArtifactIds', 'plan', 'qualification', 'rollback', 'trustedTime'], 'KSTACK_MIGRATION_EXECUTION_INVALID'); bool(input.rollbackLimitationDisplayed, 'KSTACK_MIGRATION_EXECUTION_INVALID');
    const plan = createMigrationPlan(input.plan); const qualification = validateMigrationQualification(input.qualification); const rollback = validateRollbackAvailability(input.rollback);
    if (plan.plan.schemaSetDigest !== this.#schemaSetDigest || qualification.schemaSetDigest !== this.#schemaSetDigest || rollback.schemaSetDigest !== this.#schemaSetDigest) fail('KSTACK_MIGRATION_EXECUTION_INVALID');
    const gate = evaluateHpQ3Gate(Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'rollbackLimitationDisplayed'))); if (gate.disposition === 'BLOCKED') fail(gate.reasonCode); if (gate.disposition === 'ROLLBACK_UNAVAILABLE' && !input.rollbackLimitationDisplayed) fail('KSTACK_ROLLBACK_DISCLOSURE_REQUIRED');
    return this.#backend.withMigrationTransaction(async () => {
      let fenceHeld = false; let candidateActive = false;
      try {
        const fenceReceipt = receipt(await this.#backend.fenceWriters(plan.plan.writeFenceProfileDigest), 'KSTACK_MIGRATION_WRITE_FENCE_INVALID'); fenceHeld = true;
        receipt(await this.#backend.append(immutable({ event: 'WRITES_FENCED', planDigest: plan.planDigest, fenceReceiptDigest: fenceReceipt })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
        const inFlight = await this.#backend.reconcileInFlight(); exact(inFlight, ['settled', 'ambiguousCount', 'receiptDigest'], 'KSTACK_MIGRATION_WRITE_FENCE_INVALID'); bool(inFlight.settled, 'KSTACK_MIGRATION_WRITE_FENCE_INVALID'); uint(inFlight.ambiguousCount, 'KSTACK_MIGRATION_WRITE_FENCE_INVALID'); receipt(inFlight.receiptDigest, 'KSTACK_MIGRATION_WRITE_FENCE_INVALID'); if (!inFlight.settled || inFlight.ambiguousCount !== 0) fail('KSTACK_MIGRATION_WRITE_FENCE_AMBIGUOUS');
        const snapshot = await this.#backend.captureSnapshot(plan.plan.snapshotProfileDigest); exact(snapshot, ['snapshotDigest', 'consistencyGroupDigest', 'durabilityReceiptDigest'], 'KSTACK_MIGRATION_SNAPSHOT_INVALID'); Object.values(snapshot).forEach((entry) => digest(entry, 'KSTACK_MIGRATION_SNAPSHOT_INVALID'));
        const changeJournalDigest = receipt(await this.#backend.startChangeJournal(fenceReceipt), 'KSTACK_MIGRATION_REPLAY_INVALID');
        if (input.artifactChanging && (snapshot.snapshotDigest !== rollback.snapshotDigest || changeJournalDigest !== rollback.changeJournalDigest)) fail('KSTACK_MIGRATION_SNAPSHOT_INVALID');
        receipt(await this.#backend.append(immutable({ event: 'SNAPSHOT_VERIFIED', planDigest: plan.planDigest, snapshotDigest: snapshot.snapshotDigest, changeJournalDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
        for (const consistencyGroupId of plan.plan.consistencyGroupOrder) {
          receipt(await this.#backend.append(immutable({ event: 'MIGRATING', planDigest: plan.planDigest, consistencyGroupId })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
          const group = await this.#backend.runTransformGroup(immutable({ planDigest: plan.planDigest, consistencyGroupId, transformSetDigest: plan.plan.transformSetDigest })); exact(group, ['consistencyGroupId', 'targetGroupDigest', 'mutationEvidenceDigest', 'externalRewriteAttempted'], 'KSTACK_MIGRATION_TRANSFORM_INVALID'); ascii(group.consistencyGroupId, 'KSTACK_MIGRATION_TRANSFORM_INVALID'); digest(group.targetGroupDigest, 'KSTACK_MIGRATION_TRANSFORM_INVALID'); digest(group.mutationEvidenceDigest, 'KSTACK_MIGRATION_TRANSFORM_INVALID'); bool(group.externalRewriteAttempted, 'KSTACK_MIGRATION_TRANSFORM_INVALID'); if (group.consistencyGroupId !== consistencyGroupId || group.externalRewriteAttempted) fail('KSTACK_MIGRATION_TRANSFORM_INVALID');
          receipt(await this.#backend.append(immutable({ event: 'GROUP_VERIFIED', planDigest: plan.planDigest, consistencyGroupId, targetGroupDigest: group.targetGroupDigest, mutationEvidenceDigest: group.mutationEvidenceDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
        }
        const target = await this.#backend.verifyTarget(plan.plan.oracleFixtureSetDigest); exact(target, ['expectedStateDigest', 'completeConsistencyGroupIds', 'independent', 'oracleReceiptDigest'], 'KSTACK_MIGRATION_TARGET_INVALID'); digest(target.expectedStateDigest, 'KSTACK_MIGRATION_TARGET_INVALID'); sortedUnique(target.completeConsistencyGroupIds, ascii, 1, 1024, 'KSTACK_MIGRATION_TARGET_INVALID'); bool(target.independent, 'KSTACK_MIGRATION_TARGET_INVALID'); digest(target.oracleReceiptDigest, 'KSTACK_MIGRATION_TARGET_INVALID'); if (!target.independent || target.expectedStateDigest !== plan.plan.expectedStateDigest || JSON.stringify(target.completeConsistencyGroupIds) !== JSON.stringify(plan.plan.consistencyGroupOrder)) fail('KSTACK_MIGRATION_TARGET_INVALID');
        receipt(await this.#backend.append(immutable({ event: 'TARGET_VERIFIED', planDigest: plan.planDigest, oracleReceiptDigest: target.oracleReceiptDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
        const current = await this.#backend.snapshotActivationGate(); exact(current, ['planDigest', 'qualificationDigest', 'rollbackDigest', 'priorActiveSetDigest', 'candidateActiveSetDigest', 'writerFenceHeld', 'eventOverflowed', 'hostBindingCurrent', 'restrictionEpochCurrent', 'eligibilityEpochCurrent', 'migrationGateCurrent'], 'KSTACK_MIGRATION_ACTIVATION_GATE_INVALID');
        for (const key of ['planDigest', 'qualificationDigest', 'rollbackDigest', 'priorActiveSetDigest', 'candidateActiveSetDigest']) digest(current[key], 'KSTACK_MIGRATION_ACTIVATION_GATE_INVALID'); for (const key of ['writerFenceHeld', 'eventOverflowed', 'hostBindingCurrent', 'restrictionEpochCurrent', 'eligibilityEpochCurrent', 'migrationGateCurrent']) bool(current[key], 'KSTACK_MIGRATION_ACTIVATION_GATE_INVALID');
        if (current.planDigest !== plan.planDigest || current.qualificationDigest !== qualificationDigest(qualification) || current.rollbackDigest !== rollbackDigest(rollback) || current.priorActiveSetDigest !== plan.plan.priorActiveSetDigest || current.candidateActiveSetDigest !== plan.plan.candidateActiveSetDigest || !current.writerFenceHeld || current.eventOverflowed || !current.hostBindingCurrent || !current.restrictionEpochCurrent || !current.eligibilityEpochCurrent || !current.migrationGateCurrent) fail('KSTACK_MIGRATION_ACTIVATION_GATE_INVALID');
        const readyReceipt = receipt(await this.#backend.append(immutable({ event: 'ACTIVATION_READY', planDigest: plan.planDigest, targetStateDigest: target.expectedStateDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
        const activation = await this.#backend.activateCandidate(immutable({ candidateActiveSetDigest: plan.plan.candidateActiveSetDigest, migrationGateReceiptDigest: readyReceipt })); exact(activation, ['activeSetDigest', 'activationReceiptDigest'], 'KSTACK_MIGRATION_ACTIVATION_INVALID'); digest(activation.activeSetDigest, 'KSTACK_MIGRATION_ACTIVATION_INVALID'); digest(activation.activationReceiptDigest, 'KSTACK_MIGRATION_ACTIVATION_INVALID'); if (activation.activeSetDigest !== plan.plan.candidateActiveSetDigest) fail('KSTACK_MIGRATION_ACTIVATION_INVALID'); candidateActive = true;
        const activeReceipt = receipt(await this.#backend.append(immutable({ event: 'CANDIDATE_ACTIVE', planDigest: plan.planDigest, activationReceiptDigest: activation.activationReceiptDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
        await this.#backend.releaseWriters(plan.plan.candidateActiveSetDigest); fenceHeld = false; return immutable({ disposition: 'CANDIDATE_ACTIVE', gate, planDigest: plan.planDigest, activationReceiptDigest: activation.activationReceiptDigest, journalReceiptDigest: activeReceipt });
      } catch (error) {
        if (!fenceHeld || candidateActive) throw error;
        try {
          const recovery = await this.#backend.recoverPreActivation(immutable({ planDigest: plan.planDigest, strategy: rollback.strategy, snapshotDigest: rollback.snapshotDigest, changeJournalDigest: rollback.changeJournalDigest, recoveryActiveSetDigest: rollback.recoveryActiveSetDigest })); exact(recovery, ['disposition', 'zeroLossProven', 'recoveryReceiptDigest'], 'KSTACK_MIGRATION_RECOVERY_INVALID'); enumeration(recovery.disposition, ['PRIOR_RESTORED', 'FORWARD_RECOVERED'], 'KSTACK_MIGRATION_RECOVERY_INVALID'); bool(recovery.zeroLossProven, 'KSTACK_MIGRATION_RECOVERY_INVALID'); digest(recovery.recoveryReceiptDigest, 'KSTACK_MIGRATION_RECOVERY_INVALID'); if (!recovery.zeroLossProven) fail('KSTACK_MIGRATION_RECOVERY_INVALID');
          receipt(await this.#backend.append(immutable({ event: 'FAILED_SAFE', planDigest: plan.planDigest, recoveryDisposition: recovery.disposition, recoveryReceiptDigest: recovery.recoveryReceiptDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID'); await this.#backend.releaseWriters(plan.plan.priorActiveSetDigest); return immutable({ disposition: 'FAILED_SAFE', reasonCode: error?.code || 'KSTACK_MIGRATION_TRANSFORM_FAILED', recovery });
        } catch { receipt(await this.#backend.append(immutable({ event: 'OUTCOME_AMBIGUOUS', planDigest: plan.planDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID'); return immutable({ disposition: 'OUTCOME_AMBIGUOUS', reasonCode: 'KSTACK_MIGRATION_RECOVERY_AMBIGUOUS' }); }
      }
    });
  }
  async rollback(input) {
    exact(input, ['plan', 'rollback', 'trustedTime'], 'KSTACK_ROLLBACK_EXECUTION_INVALID'); timestamp(input.trustedTime, 'KSTACK_ROLLBACK_EXECUTION_INVALID'); const plan = createMigrationPlan(input.plan); const rollback = validateRollbackAvailability(input.rollback);
    if (plan.plan.schemaSetDigest !== this.#schemaSetDigest || rollback.schemaSetDigest !== this.#schemaSetDigest || rollback.planDigest !== plan.planDigest || rollback.status !== 'AVAILABLE' || rollback.dataLossClaim !== 'ZERO_PROVEN' || rollback.strategy === 'NONE' || input.trustedTime >= rollback.expiresAt) fail('KSTACK_ROLLBACK_UNAVAILABLE');
    return this.#backend.withMigrationTransaction(async () => {
      try {
        const fenceReceipt = receipt(await this.#backend.fenceWriters(plan.plan.writeFenceProfileDigest), 'KSTACK_MIGRATION_WRITE_FENCE_INVALID'); receipt(await this.#backend.append(immutable({ event: 'ROLLBACK_FENCED', planDigest: plan.planDigest, fenceReceiptDigest: fenceReceipt })), 'KSTACK_MIGRATION_JOURNAL_INVALID');
        const inFlight = await this.#backend.reconcileInFlight(); exact(inFlight, ['settled', 'ambiguousCount', 'receiptDigest'], 'KSTACK_MIGRATION_WRITE_FENCE_INVALID'); if (!inFlight.settled || inFlight.ambiguousCount !== 0) fail('KSTACK_MIGRATION_WRITE_FENCE_AMBIGUOUS'); digest(inFlight.receiptDigest, 'KSTACK_MIGRATION_WRITE_FENCE_INVALID');
        const journalEnd = await this.#backend.captureJournalEnd(); exact(journalEnd, ['changeJournalDigest', 'acceptedWriteCount', 'captureReceiptDigest'], 'KSTACK_MIGRATION_REPLAY_INVALID'); digest(journalEnd.changeJournalDigest, 'KSTACK_MIGRATION_REPLAY_INVALID'); uint(journalEnd.acceptedWriteCount, 'KSTACK_MIGRATION_REPLAY_INVALID'); digest(journalEnd.captureReceiptDigest, 'KSTACK_MIGRATION_REPLAY_INVALID');
        let targetActiveSetDigest; let strategyReceiptDigest;
        if (rollback.strategy === 'BACKWARD_READABLE') {
          const prior = await this.#backend.revalidatePriorCompatibility(immutable({ planDigest: plan.planDigest, priorActiveSetDigest: plan.plan.priorActiveSetDigest, candidateWriteCount: journalEnd.acceptedWriteCount })); exact(prior, ['priorActiveSetDigest', 'readWriteRoundtripProven', 'compatibilityReceiptDigest'], 'KSTACK_MIGRATION_RESTORE_INVALID'); digest(prior.priorActiveSetDigest, 'KSTACK_MIGRATION_RESTORE_INVALID'); bool(prior.readWriteRoundtripProven, 'KSTACK_MIGRATION_RESTORE_INVALID'); digest(prior.compatibilityReceiptDigest, 'KSTACK_MIGRATION_RESTORE_INVALID'); if (!prior.readWriteRoundtripProven || prior.priorActiveSetDigest !== plan.plan.priorActiveSetDigest) fail('KSTACK_MIGRATION_RESTORE_INVALID'); targetActiveSetDigest = prior.priorActiveSetDigest; strategyReceiptDigest = prior.compatibilityReceiptDigest;
        } else if (rollback.strategy === 'RESTORE_REPLAY') {
          const restored = await this.#backend.restoreSnapshot(immutable({ snapshotDigest: rollback.snapshotDigest, planDigest: plan.planDigest })); exact(restored, ['restoreReceiptDigest', 'snapshotDigest'], 'KSTACK_MIGRATION_RESTORE_INVALID'); digest(restored.restoreReceiptDigest, 'KSTACK_MIGRATION_RESTORE_INVALID'); digest(restored.snapshotDigest, 'KSTACK_MIGRATION_RESTORE_INVALID'); if (restored.snapshotDigest !== rollback.snapshotDigest) fail('KSTACK_MIGRATION_RESTORE_INVALID');
          const replay = await this.#backend.replayCandidateWrites(immutable({ startJournalDigest: rollback.changeJournalDigest, endJournalDigest: journalEnd.changeJournalDigest, acceptedWriteCount: journalEnd.acceptedWriteCount, restoreReceiptDigest: restored.restoreReceiptDigest })); exact(replay, ['acceptedWriteCount', 'replayedWriteCount', 'duplicateWriteCount', 'zeroLossProven', 'replayReceiptDigest'], 'KSTACK_MIGRATION_REPLAY_INVALID'); for (const key of ['acceptedWriteCount', 'replayedWriteCount', 'duplicateWriteCount']) uint(replay[key], 'KSTACK_MIGRATION_REPLAY_INVALID'); bool(replay.zeroLossProven, 'KSTACK_MIGRATION_REPLAY_INVALID'); digest(replay.replayReceiptDigest, 'KSTACK_MIGRATION_REPLAY_INVALID'); if (!replay.zeroLossProven || replay.acceptedWriteCount !== journalEnd.acceptedWriteCount || replay.replayedWriteCount !== journalEnd.acceptedWriteCount || replay.duplicateWriteCount !== 0) fail('KSTACK_MIGRATION_REPLAY_INVALID'); targetActiveSetDigest = plan.plan.priorActiveSetDigest; strategyReceiptDigest = replay.replayReceiptDigest;
        } else {
          const forward = await this.#backend.forwardRecover(immutable({ planDigest: plan.planDigest, recoveryActiveSetDigest: rollback.recoveryActiveSetDigest, endJournalDigest: journalEnd.changeJournalDigest })); exact(forward, ['recoveryActiveSetDigest', 'recoveryReceiptDigest'], 'KSTACK_MIGRATION_FORWARD_RECOVERY_INVALID'); digest(forward.recoveryActiveSetDigest, 'KSTACK_MIGRATION_FORWARD_RECOVERY_INVALID'); digest(forward.recoveryReceiptDigest, 'KSTACK_MIGRATION_FORWARD_RECOVERY_INVALID'); if (forward.recoveryActiveSetDigest !== rollback.recoveryActiveSetDigest) fail('KSTACK_MIGRATION_FORWARD_RECOVERY_INVALID'); targetActiveSetDigest = forward.recoveryActiveSetDigest; strategyReceiptDigest = forward.recoveryReceiptDigest;
        }
        const verified = await this.#backend.verifyRecoveryTarget(immutable({ planDigest: plan.planDigest, targetActiveSetDigest, strategy: rollback.strategy, strategyReceiptDigest })); exact(verified, ['targetActiveSetDigest', 'independent', 'zeroLossProven', 'verificationReceiptDigest'], 'KSTACK_MIGRATION_RECOVERY_INVALID'); digest(verified.targetActiveSetDigest, 'KSTACK_MIGRATION_RECOVERY_INVALID'); bool(verified.independent, 'KSTACK_MIGRATION_RECOVERY_INVALID'); bool(verified.zeroLossProven, 'KSTACK_MIGRATION_RECOVERY_INVALID'); digest(verified.verificationReceiptDigest, 'KSTACK_MIGRATION_RECOVERY_INVALID'); if (verified.targetActiveSetDigest !== targetActiveSetDigest || !verified.independent || !verified.zeroLossProven) fail('KSTACK_MIGRATION_RECOVERY_INVALID');
        const activation = await this.#backend.activateRecoveryTarget(immutable({ targetActiveSetDigest, verificationReceiptDigest: verified.verificationReceiptDigest })); exact(activation, ['activeSetDigest', 'activationReceiptDigest'], 'KSTACK_MIGRATION_ACTIVATION_INVALID'); digest(activation.activeSetDigest, 'KSTACK_MIGRATION_ACTIVATION_INVALID'); digest(activation.activationReceiptDigest, 'KSTACK_MIGRATION_ACTIVATION_INVALID'); if (activation.activeSetDigest !== targetActiveSetDigest) fail('KSTACK_MIGRATION_ACTIVATION_INVALID');
        const disposition = rollback.strategy === 'FORWARD_RECOVERY' ? 'FORWARD_RECOVERED' : 'PRIOR_ACTIVE'; const finalReceipt = receipt(await this.#backend.append(immutable({ event: disposition, planDigest: plan.planDigest, targetActiveSetDigest, activationReceiptDigest: activation.activationReceiptDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID'); await this.#backend.releaseWriters(targetActiveSetDigest); return immutable({ disposition, targetActiveSetDigest, journalReceiptDigest: finalReceipt });
      } catch { receipt(await this.#backend.append(immutable({ event: 'OUTCOME_AMBIGUOUS', planDigest: plan.planDigest })), 'KSTACK_MIGRATION_JOURNAL_INVALID'); return immutable({ disposition: 'OUTCOME_AMBIGUOUS', reasonCode: 'KSTACK_MIGRATION_RECOVERY_AMBIGUOUS' }); }
    });
  }
}
