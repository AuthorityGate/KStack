import { assertAsciiId, assertDigest, assertRegistryId, assertTimestamp, hostAddress } from './kstack-host-contract.mjs';

export class HostActivationError extends Error {
  constructor(code) { super(code); this.name = 'HostActivationError'; this.code = code; }
}
function fail(code) { throw new HostActivationError(code); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function digest(value, code) { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code) { try { return assertAsciiId(value); } catch { fail(code); } }
function registry(value, code) { try { return assertRegistryId(value); } catch { fail(code); } }
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
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export const ACTIVATION_DIRECTIONS = Object.freeze(['FORWARD', 'REVERSE']);
export const LEASE_STATES = Object.freeze(['ADMITTED', 'CANCELLED', 'COMPLETED', 'DISPATCH_COMMITTED', 'EXPIRED', 'FENCED', 'RECONCILE']);
export const RECOVERY_DISPOSITIONS = Object.freeze(['ACTIVATION_AMBIGUOUS', 'ACTIVE', 'RECOVERED_PRIOR']);
const GENERATION_PLAN_KEYS = Object.freeze([
  'schemaSetDigest', 'activeSetDigest', 'executionClosureDigest', 'generationSequence', 'currentRootDigest',
  'currentRootSequence', 'immediatePriorGenerationDigest', 'restrictionEpoch', 'eligibilityEpoch',
  'hostBindingSnapshotDigest', 'hostBindingVersionDigest', 'migrationGateDigest',
  'instanceReadinessReceiptDigest', 'activationDirection', 'targetHistoricalGenerationDigest', 'preparedAt',
  'expiresAt', 'retirementPolicyDigest'
]);
const ACTIVE_SET_DIGEST_FIELDS = Object.freeze([
  'hostContractSchemaSetDigest', 'resolverSetDigest', 'invariantRegistryDigest', 'vectorSetDigest', 'kernelDigest',
  'protectedComponentDigest', 'adapterRegistryDigest', 'selectedAdapterDigest', 'brokerDigest', 'policyDigest',
  'requirementRegistryDigest', 'eligibilityRegistryDigest', 'receiptRegistryDigest', 'evidenceRootDigest',
  'evidenceProfileDigest', 'harnessDigest', 'observerSetDigest', 'bypassSetDigest', 'environmentMeasurementProfileDigest',
  'mcpBackendDigest', 'mutationBackendDigest', 'migrationProfileDigest', 'compatibilityEntryDigest', 'qualificationEvidenceDigest'
]);

export function validateActiveSet(value) {
  const code = 'KSTACK_ACTIVE_SET_INVALID'; exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'activeSetId', ...ACTIVE_SET_DIGEST_FIELDS], code);
  if (value.schemaId !== 'kstack.active-set.v1' || value.schemaVersion !== 1) fail(code); ascii(value.activeSetId, code); digest(value.schemaSetDigest, code);
  ACTIVE_SET_DIGEST_FIELDS.forEach((key) => digest(value[key], code));
  return immutable({ activeSet: value, activeSetDigest: hostAddress('KSTACK-ACTIVE-SET-V1', value) });
}

export function validateActivationExecutionClosure(value) {
  const code = 'KSTACK_ACTIVATION_CLOSURE_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'activeSetDigest', 'loadedResourceClosureDigest', 'processImageDigest', 'brokerInstanceProfileDigest', 'mutationInstanceProfileDigest', 'mcpInstanceProfileDigest', 'adapterRegistryDigest', 'policyRegistryDigest', 'evidenceRegistryDigest', 'executableIdentitySetDigest', 'compatibilityFactsDigest', 'readinessVectorDigest', 'retentionReferenceDigests'], code);
  if (value.schemaId !== 'kstack.activation-execution-closure.v1' || value.schemaVersion !== 1) fail(code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code);
  sortedUnique(value.retentionReferenceDigests, digest, 1, 256, code);
  return immutable({ closure: value, executionClosureDigest: hostAddress('KSTACK-ACTIVATION-EXECUTION-CLOSURE-V1', value) });
}

export function validateActiveSetCandidate(value) {
  const code = 'KSTACK_ACTIVE_SET_CANDIDATE_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'schemaSetDigest', 'candidateActiveSetDigest', 'priorActiveSetDigest', 'compatibilityEntryDigest', 'schemaSelectionDigest', 'externalHostConstraintDigest', 'hostEnvironmentSnapshotDigest', 'hostBindingVersionDigest', 'implementationValidationReceiptDigests', 'migrationGateDigest', 'stagedAt', 'expiresAt'], code);
  if (value.schemaId !== 'kstack.active-set-candidate.v1' || value.schemaVersion !== 1) fail(code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest') && entry !== null) digest(entry, code);
  sortedUnique(value.implementationValidationReceiptDigests, digest, 1, 64, code); timestamp(value.stagedAt, code); timestamp(value.expiresAt, code); if (value.stagedAt >= value.expiresAt) fail(code);
  return immutable({ candidate: value, candidateDigest: hostAddress('KSTACK-ACTIVE-SET-CANDIDATE-V1', value) });
}

export function createActivationGenerationPlan(value) {
  const code = 'KSTACK_ACTIVATION_GENERATION_INVALID';
  exact(value, GENERATION_PLAN_KEYS, code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest') && entry !== null) digest(entry, code);
  for (const key of ['generationSequence', 'currentRootSequence', 'restrictionEpoch', 'eligibilityEpoch']) uint(value[key], Number.MAX_SAFE_INTEGER, key === 'generationSequence', code);
  enumeration(value.activationDirection, ACTIVATION_DIRECTIONS, code); timestamp(value.preparedAt, code); timestamp(value.expiresAt, code); if (value.preparedAt >= value.expiresAt || value.generationSequence <= value.currentRootSequence) fail(code);
  if (value.activationDirection === 'REVERSE' ? value.targetHistoricalGenerationDigest === null : value.targetHistoricalGenerationDigest !== null) fail(code);
  const plan = immutable({ schemaId: 'kstack.activation-generation-plan.v1', schemaVersion: 1, ...value });
  return immutable({ plan, planDigest: hostAddress('KSTACK-ACTIVATION-GENERATION-PLAN-V1', plan) });
}

export function createActivationGeneration(planValue, commitIntentDigest) {
  const code = 'KSTACK_ACTIVATION_GENERATION_INVALID'; const normalized = Object.fromEntries(Object.entries(planValue).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))); const validated = createActivationGenerationPlan(normalized); digest(commitIntentDigest, code);
  const generation = immutable({ schemaId: 'kstack.activation-generation.v1', schemaVersion: 1, schemaSetDigest: validated.plan.schemaSetDigest, generationPlanDigest: validated.planDigest, ...Object.fromEntries(Object.entries(validated.plan).filter(([key]) => !['schemaId', 'schemaVersion', 'schemaSetDigest'].includes(key))), journalCommitIntentDigest: commitIntentDigest });
  return immutable({ generation, generationDigest: hostAddress('KSTACK-ACTIVATION-GENERATION-V1', generation) });
}

export function createActivationGenerationRoot(value) {
  const code = 'KSTACK_ACTIVATION_ROOT_INVALID';
  exact(value, ['schemaSetDigest', 'storeId', 'rootSequence', 'generationDigest', 'generationSequence', 'restrictionEpoch', 'journalRecordDigest', 'integrityTagDigest'], code);
  digest(value.schemaSetDigest, code); ascii(value.storeId, code); for (const key of ['generationDigest', 'journalRecordDigest', 'integrityTagDigest']) digest(value[key], code);
  uint(value.rootSequence, Number.MAX_SAFE_INTEGER, true, code); uint(value.generationSequence, Number.MAX_SAFE_INTEGER, true, code); uint(value.restrictionEpoch, Number.MAX_SAFE_INTEGER, false, code);
  if (value.rootSequence !== value.generationSequence) fail(code);
  const expectedIntegrityTagDigest = hostAddress('KSTACK-ACTIVATION-ROOT-INTEGRITY-V1', { storeId: value.storeId, generationDigest: value.generationDigest, generationSequence: value.generationSequence, restrictionEpoch: value.restrictionEpoch, journalRecordDigest: value.journalRecordDigest });
  if (value.integrityTagDigest !== expectedIntegrityTagDigest) fail(code);
  const root = immutable({ schemaId: 'kstack.activation-generation-root.v1', schemaVersion: 1, ...value });
  return immutable({ root, rootDigest: hostAddress('KSTACK-ACTIVATION-GENERATION-ROOT-V1', root) });
}

export function validateActivationStoreProfile(value) {
  const code = 'KSTACK_ACTIVATION_STORE_UNQUALIFIED';
  exact(value, ['profileId', 'profileDigest', 'implementationDigest', 'platformDigest', 'filesystemDigest', 'protectionClass', 'atomicGenerationRootReplace', 'compareAndSwap', 'durabilityBarrier', 'rollbackDetection', 'appendOnlyJournal', 'consumerHandlePinning', 'repositoryWritable', 'agentWritable', 'faultVectorDigests', 'qualifiedOutcome'], code);
  ascii(value.profileId, code); for (const key of ['profileDigest', 'implementationDigest', 'platformDigest', 'filesystemDigest']) digest(value[key], code);
  for (const key of ['atomicGenerationRootReplace', 'compareAndSwap', 'durabilityBarrier', 'rollbackDetection', 'appendOnlyJournal', 'consumerHandlePinning', 'repositoryWritable', 'agentWritable']) bool(value[key], code);
  sortedUnique(value.faultVectorDigests, digest, 1, 64, code);
  if (!['os-protected', 'qualified-service', 'test-only'].includes(value.protectionClass) || !value.atomicGenerationRootReplace || !value.compareAndSwap || !value.durabilityBarrier || !value.rollbackDetection || !value.appendOnlyJournal || !value.consumerHandlePinning || value.repositoryWritable || value.agentWritable || value.qualifiedOutcome !== 'PROVEN') fail(code);
  return immutable(value);
}

export function assertFreshReverseGeneration(input) {
  const code = 'KSTACK_ACTIVATION_REVERSE_STALE';
  exact(input, ['currentRoot', 'historicalGeneration', 'historicalExecutionClosureDigest', 'reversePlan'], code);
  const plan = createActivationGenerationPlan(input.reversePlan).plan;
  if (plan.activationDirection !== 'REVERSE' || plan.targetHistoricalGenerationDigest !== input.historicalGeneration.generationDigest
    || plan.executionClosureDigest !== input.historicalExecutionClosureDigest || plan.currentRootDigest !== input.currentRoot.rootDigest
    || plan.currentRootSequence !== input.currentRoot.root.rootSequence || plan.immediatePriorGenerationDigest !== input.currentRoot.root.generationDigest
    || plan.generationSequence <= input.currentRoot.root.generationSequence) fail(code);
  for (const key of ['restrictionEpoch', 'eligibilityEpoch', 'hostBindingSnapshotDigest', 'hostBindingVersionDigest', 'migrationGateDigest', 'instanceReadinessReceiptDigest']) {
    if (plan[key] === input.historicalGeneration.generation[key]) fail(code);
  }
  return immutable(plan);
}

export function classifyActivationRecovery(value) {
  const code = 'KSTACK_ACTIVATION_RECOVERY_INVALID';
  exact(value, ['rootRelation', 'replacementReceiptState', 'intentValid', 'rootIntegrityValid', 'lineageValid', 'closureReady', 'durabilityValid'], code);
  enumeration(value.rootRelation, ['CANDIDATE', 'HISTORICAL', 'OTHER', 'PRIOR'], code); enumeration(value.replacementReceiptState, ['ABSENT', 'DURABLE', 'INVALID'], code);
  for (const key of ['intentValid', 'rootIntegrityValid', 'lineageValid', 'closureReady', 'durabilityValid']) bool(value[key], code);
  if (!value.rootIntegrityValid || !value.intentValid) return 'ACTIVATION_AMBIGUOUS';
  if (value.rootRelation === 'PRIOR' && value.replacementReceiptState === 'ABSENT') return 'RECOVERED_PRIOR';
  if (value.rootRelation === 'CANDIDATE' && value.replacementReceiptState === 'DURABLE' && value.lineageValid && value.closureReady && value.durabilityValid) return 'ACTIVE';
  return 'ACTIVATION_AMBIGUOUS';
}

const LEASE_KEYS = Object.freeze(['schemaId', 'schemaVersion', 'schemaSetDigest', 'leaseSequence', 'requestDigest', 'attemptDigest', 'operationId', 'operationClassId', 'principalDigest', 'hostSessionDigest', 'repositoryContextDigest', 'rootIdentityDigest', 'requirementProfileDigest', 'eligibilityDigest', 'eligibilityEpoch', 'evidenceAdmissionSnapshotDigest', 'environmentSnapshotDigest', 'hostBindingVersionDigest', 'authorityEnvelopeDigest', 'activeSetDigest', 'generationDigest', 'generationSequence', 'policyDigest', 'restrictionEpoch', 'quarantineHeadDigest', 'revocationSequence', 'idempotencyKeyDigest', 'nonceDigest', 'actionFenceProfileDigest', 'issuedAt', 'expiresAt', 'state']);

export function createOperationLease(value) {
  const code = 'KSTACK_LEASE_INVALID'; exact(value, LEASE_KEYS.filter((key) => !['schemaId', 'schemaVersion'].includes(key)), code);
  digest(value.schemaSetDigest, code); for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest') && entry !== null) digest(entry, code);
  ascii(value.operationId, code); registry(value.operationClassId, code); for (const key of ['leaseSequence', 'eligibilityEpoch', 'generationSequence', 'restrictionEpoch', 'revocationSequence']) uint(value[key], Number.MAX_SAFE_INTEGER, key === 'leaseSequence' || key === 'generationSequence', code);
  timestamp(value.issuedAt, code); timestamp(value.expiresAt, code); if (value.issuedAt >= value.expiresAt) fail(code); enumeration(value.state, LEASE_STATES, code);
  const lease = immutable({ schemaId: 'kstack.operation-lease-detail.v1', schemaVersion: 1, ...value });
  return immutable({ lease, leaseDigest: hostAddress('KSTACK-OPERATION-LEASE-DETAIL-V1', lease) });
}

export function validateLeaseRenewal(input) {
  const code = 'KSTACK_LEASE_RENEWAL_INVALID'; exact(input, ['priorLease', 'newLease', 'ownerApprovalRequired'], code); bool(input.ownerApprovalRequired, code);
  const prior = createOperationLease(Object.fromEntries(Object.entries(input.priorLease).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))));
  const next = createOperationLease(Object.fromEntries(Object.entries(input.newLease).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))));
  if (next.leaseDigest === prior.leaseDigest || next.lease.leaseSequence <= prior.lease.leaseSequence || next.lease.issuedAt <= prior.lease.issuedAt
    || next.lease.nonceDigest === prior.lease.nonceDigest || next.lease.state !== 'ADMITTED'
    || next.lease.operationId !== prior.lease.operationId || next.lease.repositoryContextDigest !== prior.lease.repositoryContextDigest
    || next.lease.hostSessionDigest !== prior.lease.hostSessionDigest) fail(code);
  if (input.ownerApprovalRequired && (next.lease.authorityEnvelopeDigest === null || next.lease.authorityEnvelopeDigest === prior.lease.authorityEnvelopeDigest)) fail('KSTACK_BACKGROUND_APPROVAL_REQUIRED');
  return immutable({ priorLeaseDigest: prior.leaseDigest, newLeaseDigest: next.leaseDigest });
}

export function validateBackgroundChildLease(input) {
  const code = 'KSTACK_BACKGROUND_CHILD_INVALID'; exact(input, ['controllerLease', 'childLease', 'effecting'], code); bool(input.effecting, code);
  const controller = createOperationLease(Object.fromEntries(Object.entries(input.controllerLease).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))));
  const child = createOperationLease(Object.fromEntries(Object.entries(input.childLease).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))));
  if (controller.lease.operationClassId !== 'BACKGROUND' || child.leaseDigest === controller.leaseDigest || child.lease.requestDigest === controller.lease.requestDigest
    || child.lease.attemptDigest === controller.lease.attemptDigest || child.lease.nonceDigest === controller.lease.nonceDigest || child.lease.state !== 'ADMITTED') fail(code);
  if (input.effecting && child.lease.authorityEnvelopeDigest === null) fail('KSTACK_BACKGROUND_APPROVAL_REQUIRED');
  return immutable({ controllerLeaseDigest: controller.leaseDigest, childLeaseDigest: child.leaseDigest, effecting: input.effecting });
}

export function createRestrictionEvent(value) {
  const code = 'KSTACK_RESTRICTION_EPOCH_INVALID';
  exact(value, ['schemaSetDigest', 'scopeDigest', 'oldRestrictionEpoch', 'newRestrictionEpoch', 'sourceType', 'sourceDigest', 'reasonCode', 'affectedOperationIds', 'affectedLeaseDigests', 'effectiveAt', 'protectedAnchorDigest'], code);
  for (const key of ['schemaSetDigest', 'scopeDigest', 'sourceDigest', 'protectedAnchorDigest']) digest(value[key], code); uint(value.oldRestrictionEpoch, Number.MAX_SAFE_INTEGER, false, code); uint(value.newRestrictionEpoch, Number.MAX_SAFE_INTEGER, true, code);
  if (value.newRestrictionEpoch !== value.oldRestrictionEpoch + 1) fail(code); registry(value.sourceType, code); registry(value.reasonCode, code); sortedUnique(value.affectedOperationIds, ascii, 0, 256, code); sortedUnique(value.affectedLeaseDigests, digest, 0, 256, code); timestamp(value.effectiveAt, code);
  const event = immutable({ schemaId: 'kstack.restriction-event.v1', schemaVersion: 1, ...value });
  return immutable({ event, eventDigest: hostAddress('KSTACK-RESTRICTION-EVENT-V1', event) });
}

function validateFenceSnapshot(value, code) {
  exact(value, ['generationDigest', 'generationSequence', 'activeSetDigest', 'policyDigest', 'eligibilityDigest', 'eligibilityEpoch', 'environmentSnapshotDigest', 'hostBindingVersionDigest', 'restrictionEpoch', 'quarantineHeadDigest', 'revocationSequence', 'repositoryContextDigest', 'rootIdentityDigest', 'hostSessionDigest', 'trustedTime'], code);
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, code); for (const key of ['generationSequence', 'eligibilityEpoch', 'restrictionEpoch', 'revocationSequence']) uint(value[key], Number.MAX_SAFE_INTEGER, key === 'generationSequence', code); timestamp(value.trustedTime, code); return value;
}
function validateHostRemeasurement(value, code) {
  exact(value, ['hostBindingVersionDigest', 'environmentSnapshotDigest', 'changeSourceDigest', 'eventOverflowed', 'orderingQualified', 'observedAt'], code);
  for (const key of ['hostBindingVersionDigest', 'environmentSnapshotDigest', 'changeSourceDigest']) digest(value[key], code); bool(value.eventOverflowed, code); bool(value.orderingQualified, code); timestamp(value.observedAt, code); return value;
}

export function evaluateActionFence(input) {
  const code = 'KSTACK_FENCE_INPUT_INVALID'; exact(input, ['lease', 'current', 'hostRemeasurement', 'actionBinding'], code);
  const lease = createOperationLease(Object.fromEntries(Object.entries(input.lease).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key)))).lease;
  const current = validateFenceSnapshot(input.current, code); const measured = validateHostRemeasurement(input.hostRemeasurement, code);
  exact(input.actionBinding, ['requestDigest', 'attemptDigest', 'operationId', 'operationClassId', 'authorityEnvelopeDigest', 'idempotencyKeyDigest', 'actionFenceProfileDigest', 'actionPayloadDigest', 'effectScopeDigest'], code);
  for (const [key, entry] of Object.entries(input.actionBinding)) if (key.endsWith('Digest') && entry !== null) digest(entry, code); ascii(input.actionBinding.operationId, code); registry(input.actionBinding.operationClassId, code);
  const reasons = [];
  if (lease.state !== 'ADMITTED') reasons.push('KSTACK_LEASE_NOT_ADMITTED'); if (current.trustedTime >= lease.expiresAt) reasons.push('KSTACK_LEASE_EXPIRED');
  const comparisons = ['activeSetDigest', 'generationDigest', 'generationSequence', 'policyDigest', 'eligibilityDigest', 'eligibilityEpoch', 'environmentSnapshotDigest', 'hostBindingVersionDigest', 'restrictionEpoch', 'quarantineHeadDigest', 'revocationSequence', 'repositoryContextDigest', 'rootIdentityDigest', 'hostSessionDigest'];
  comparisons.forEach((key) => { if (lease[key] !== current[key]) reasons.push(`KSTACK_FENCE_${key.replace(/([A-Z])/gu, '_$1').toUpperCase()}_CHANGED`); });
  for (const key of ['requestDigest', 'attemptDigest', 'operationId', 'operationClassId', 'authorityEnvelopeDigest', 'idempotencyKeyDigest', 'actionFenceProfileDigest']) if (lease[key] !== input.actionBinding[key]) reasons.push(`KSTACK_FENCE_${key.replace(/([A-Z])/gu, '_$1').toUpperCase()}_CHANGED`);
  if (measured.eventOverflowed) reasons.push('KSTACK_FENCE_CHANGE_SOURCE_OVERFLOW'); if (!measured.orderingQualified) reasons.push('KSTACK_FENCE_ORDERING_UNAVAILABLE');
  if (measured.hostBindingVersionDigest !== current.hostBindingVersionDigest || measured.environmentSnapshotDigest !== current.environmentSnapshotDigest) reasons.push('KSTACK_FENCE_HOST_BINDING_CHANGED');
  return immutable({ disposition: reasons.length ? 'FENCED' : 'DISPATCH_COMMITTED', reasonCodes: [...new Set(reasons)].sort(), leaseDigest: hostAddress('KSTACK-OPERATION-LEASE-DETAIL-V1', lease), actionPayloadDigest: input.actionBinding.actionPayloadDigest, effectScopeDigest: input.actionBinding.effectScopeDigest });
}

function validateBackend(backend, allowTestBackend) {
  const code = 'KSTACK_ACTIVATION_BACKEND_INVALID'; exact(backend, ['descriptor', 'append', 'prepareGeneration', 'activationTransaction', 'loadRoot', 'resolveGeneration', 'withFenceTransaction', 'snapshotFenceInputs', 'measureHostBinding', 'invokeAction', 'invalidateLeases', 'cancelDescendants'], code);
  validateActivationStoreProfile(backend.descriptor); if (!allowTestBackend && backend.descriptor.protectionClass === 'test-only') fail(code);
  for (const key of ['append', 'prepareGeneration', 'activationTransaction', 'loadRoot', 'resolveGeneration', 'withFenceTransaction', 'snapshotFenceInputs', 'measureHostBinding', 'invokeAction', 'invalidateLeases', 'cancelDescendants']) if (typeof backend[key] !== 'function') fail(code);
  return backend;
}

export class ProtectedActivationKernel {
  #schemaSetDigest; #backend; #storeId;
  constructor(options) {
    exact(options, ['schemaSetDigest', 'storeId', 'backend', 'allowTestBackend'], 'KSTACK_ACTIVATION_BACKEND_INVALID'); this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_ACTIVATION_BACKEND_INVALID'); this.#storeId = ascii(options.storeId, 'KSTACK_ACTIVATION_BACKEND_INVALID'); this.#backend = validateBackend(options.backend, options.allowTestBackend === true);
  }
  async activate(input) {
    exact(input, ['candidate', 'plan'], 'KSTACK_ACTIVE_SET_CANDIDATE_INVALID'); const candidate = validateActiveSetCandidate(input.candidate); const plan = createActivationGenerationPlan(input.plan);
    if (plan.plan.schemaSetDigest !== this.#schemaSetDigest || candidate.candidate.schemaSetDigest !== this.#schemaSetDigest || candidate.candidate.candidateActiveSetDigest !== plan.plan.activeSetDigest
      || candidate.candidate.hostEnvironmentSnapshotDigest !== plan.plan.hostBindingSnapshotDigest || candidate.candidate.hostBindingVersionDigest !== plan.plan.hostBindingVersionDigest
      || candidate.candidate.migrationGateDigest !== plan.plan.migrationGateDigest || candidate.candidate.expiresAt !== plan.plan.expiresAt) fail('KSTACK_ACTIVE_SET_CANDIDATE_INVALID');
    const prepared = await this.#backend.prepareGeneration(plan.plan); exact(prepared, ['executionClosureDigest', 'readinessReceiptDigest', 'consumerWorkAccepted'], 'KSTACK_ACTIVATION_PREPARE_INVALID'); digest(prepared.executionClosureDigest, 'KSTACK_ACTIVATION_PREPARE_INVALID'); digest(prepared.readinessReceiptDigest, 'KSTACK_ACTIVATION_PREPARE_INVALID'); bool(prepared.consumerWorkAccepted, 'KSTACK_ACTIVATION_PREPARE_INVALID');
    if (prepared.consumerWorkAccepted || prepared.executionClosureDigest !== plan.plan.executionClosureDigest || prepared.readinessReceiptDigest !== plan.plan.instanceReadinessReceiptDigest) fail('KSTACK_ACTIVATION_PREPARE_INVALID');
    const intentReceipt = await this.#backend.append(immutable({ event: 'COMMIT_INTENT', generationPlanDigest: plan.planDigest, currentRootDigest: plan.plan.currentRootDigest, generationSequence: plan.plan.generationSequence })); digest(intentReceipt, 'KSTACK_ACTIVATION_JOURNAL_INVALID');
    const generation = createActivationGeneration(plan.plan, intentReceipt);
    const root = createActivationGenerationRoot({ schemaSetDigest: this.#schemaSetDigest, storeId: this.#storeId, rootSequence: plan.plan.generationSequence, generationDigest: generation.generationDigest, generationSequence: plan.plan.generationSequence, restrictionEpoch: plan.plan.restrictionEpoch, journalRecordDigest: intentReceipt, integrityTagDigest: hostAddress('KSTACK-ACTIVATION-ROOT-INTEGRITY-V1', { storeId: this.#storeId, generationDigest: generation.generationDigest, generationSequence: plan.plan.generationSequence, restrictionEpoch: plan.plan.restrictionEpoch, journalRecordDigest: intentReceipt }) });
    const publication = await this.#backend.activationTransaction(immutable({ expectedRootDigest: plan.plan.currentRootDigest, generation: generation.generation, generationDigest: generation.generationDigest, candidateRoot: root.root, candidateRootDigest: root.rootDigest }));
    exact(publication, ['rootReplacementReceiptDigest', 'durabilityReceiptDigest', 'publishedRootDigest'], 'KSTACK_ACTIVATION_PUBLICATION_INVALID'); for (const entry of Object.values(publication)) digest(entry, 'KSTACK_ACTIVATION_PUBLICATION_INVALID');
    if (publication.publishedRootDigest !== root.rootDigest) fail('KSTACK_ACTIVATION_PUBLICATION_INVALID');
    const activeReceipt = await this.#backend.append(immutable({ event: 'ACTIVE', generationDigest: generation.generationDigest, rootDigest: root.rootDigest, rootReplacementReceiptDigest: publication.rootReplacementReceiptDigest, durabilityReceiptDigest: publication.durabilityReceiptDigest })); digest(activeReceipt, 'KSTACK_ACTIVATION_JOURNAL_INVALID');
    return immutable({ generation, root, publication, activeReceiptDigest: activeReceipt });
  }
  async acquireHandle() {
    try {
      const root = await this.#backend.loadRoot();
      if (root?.schemaId !== 'kstack.activation-generation-root.v1' || root?.schemaVersion !== 1 || root.schemaSetDigest !== this.#schemaSetDigest || root.storeId !== this.#storeId) fail('KSTACK_ACTIVATION_HANDLE_INVALID');
      const validatedRoot = createActivationGenerationRoot(Object.fromEntries(Object.entries(root).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key))));
      const generation = await this.#backend.resolveGeneration(validatedRoot.root.generationDigest);
      if (generation?.schemaId !== 'kstack.activation-generation.v1' || generation?.schemaVersion !== 1 || generation.schemaSetDigest !== this.#schemaSetDigest) fail('KSTACK_ACTIVATION_HANDLE_INVALID');
      exact(generation, ['schemaId', 'schemaVersion', 'generationPlanDigest', 'journalCommitIntentDigest', ...GENERATION_PLAN_KEYS], 'KSTACK_ACTIVATION_HANDLE_INVALID');
      const planValue = Object.fromEntries(GENERATION_PLAN_KEYS.map((key) => [key, generation[key]]));
      const reconstructed = createActivationGeneration(planValue, generation.journalCommitIntentDigest);
      if (reconstructed.generation.generationPlanDigest !== generation.generationPlanDigest
        || reconstructed.generationDigest !== validatedRoot.root.generationDigest
        || generation.generationSequence !== validatedRoot.root.generationSequence
        || generation.restrictionEpoch !== validatedRoot.root.restrictionEpoch
        || generation.journalCommitIntentDigest !== validatedRoot.root.journalRecordDigest) fail('KSTACK_ACTIVATION_HANDLE_INVALID');
      return immutable({ rootDigest: validatedRoot.rootDigest, generationDigest: reconstructed.generationDigest, generationSequence: generation.generationSequence, executionClosureDigest: generation.executionClosureDigest });
    } catch { fail('KSTACK_ACTIVATION_HANDLE_INVALID'); }
  }
  async commitAction(input) {
    exact(input, ['lease', 'actionBinding'], 'KSTACK_FENCE_INPUT_INVALID');
    return this.#backend.withFenceTransaction(async () => {
      const current = await this.#backend.snapshotFenceInputs(); const measurement = await this.#backend.measureHostBinding();
      const decision = evaluateActionFence({ lease: input.lease, current, hostRemeasurement: measurement, actionBinding: input.actionBinding });
      if (decision.disposition === 'FENCED') { const fenced = await this.#backend.append(immutable({ event: 'FENCED', leaseDigest: decision.leaseDigest, reasonCodes: decision.reasonCodes })); digest(fenced, 'KSTACK_FENCE_LEDGER_INVALID'); return immutable({ ...decision, ledgerReceiptDigest: fenced, actionInvoked: false }); }
      const committed = await this.#backend.append(immutable({ event: 'DISPATCH_COMMITTED', leaseDigest: decision.leaseDigest, actionPayloadDigest: decision.actionPayloadDigest, effectScopeDigest: decision.effectScopeDigest })); digest(committed, 'KSTACK_FENCE_LEDGER_INVALID');
      try { const action = await this.#backend.invokeAction(immutable({ leaseDigest: decision.leaseDigest, actionPayloadDigest: decision.actionPayloadDigest, effectScopeDigest: decision.effectScopeDigest, dispatchCommittedDigest: committed })); return immutable({ ...decision, ledgerReceiptDigest: committed, actionInvoked: true, action }); }
      catch { const reconcile = await this.#backend.append(immutable({ event: 'RECONCILE', leaseDigest: decision.leaseDigest, dispatchCommittedDigest: committed })); digest(reconcile, 'KSTACK_FENCE_LEDGER_INVALID'); return immutable({ disposition: 'RECONCILE', reasonCodes: ['KSTACK_IN_FLIGHT_RECONCILIATION_REQUIRED'], leaseDigest: decision.leaseDigest, actionPayloadDigest: decision.actionPayloadDigest, effectScopeDigest: decision.effectScopeDigest, ledgerReceiptDigest: reconcile, dispatchCommittedDigest: committed, actionInvoked: true }); }
    });
  }
  async restrict(eventInput) {
    const restriction = createRestrictionEvent(eventInput);
    return this.#backend.withFenceTransaction(async () => {
      const receipt = await this.#backend.append(immutable({ event: 'RESTRICTION_ADVANCED', restrictionEventDigest: restriction.eventDigest, oldRestrictionEpoch: restriction.event.oldRestrictionEpoch, newRestrictionEpoch: restriction.event.newRestrictionEpoch })); digest(receipt, 'KSTACK_RESTRICTION_LEDGER_INVALID');
      await this.#backend.invalidateLeases(restriction.event.affectedLeaseDigests); await this.#backend.cancelDescendants(restriction.event.scopeDigest);
      return immutable({ restrictionEvent: restriction.event, restrictionEventDigest: restriction.eventDigest, ledgerReceiptDigest: receipt });
    });
  }
}
