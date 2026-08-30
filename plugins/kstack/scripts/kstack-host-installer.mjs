import { HOST_PACKAGE_DOMAINS, addressObject, rawDigest, validatePortableRelativePath } from './kstack-host-package.mjs';

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function compareUtf8(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(compareUtf8); const expected = [...keys].sort(compareUtf8);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function id(value, code) { if (typeof value !== 'string' || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u.test(value)) fail(code); return value; }
function testId(value, code) { if (typeof value !== 'string' || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(value)) fail(code); return value; }
function digest(value, code) { if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) fail(code); return value; }
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function decimal(value, code, maximum = 600000) { if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/u.test(value) || BigInt(value) > BigInt(maximum)) fail(code); return value; }
function set(values, code, validator = (value) => id(value, code)) {
  if (!Array.isArray(values)) fail(code); const copy = values.map(validator); const sorted = [...copy].sort(compareUtf8);
  if (new Set(copy).size !== copy.length || copy.some((value, index) => value !== sorted[index])) fail(code); return copy;
}
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export const INSTALLER_STATES = Object.freeze(['PREFLIGHT', 'STAGED', 'PREPARED', 'SWITCH_OBSERVED', 'VERIFIED', 'COMMITTED', 'ABORTED_BEFORE_SWITCH', 'ROLLED_BACK', 'RECOVERY_REQUIRED']);
export const ACTIVATION_STRATEGIES = Object.freeze(['ABSENT_RENAME', 'ATOMIC_DIRECTORY_EXCHANGE', 'ATOMIC_POINTER_SWAP', 'HOST_NATIVE_TRANSACTION']);
const OBSERVED_STATES = Object.freeze(['ABSENT', 'EMPTY_OWNED', 'KSTACK_ACTIVE', 'KSTACK_POINTER_ACTIVE', 'FOREIGN_OR_UNKNOWN']);
const TERMINAL_STATES = Object.freeze(['COMMITTED', 'ABORTED_BEFORE_SWITCH', 'ROLLED_BACK', 'RECOVERY_REQUIRED']);

export function createInstallerAttempt(input) {
  exact(input, ['attemptId', 'handoffDigest', 'installerProfileDigest', 'policyDigest', 'principalDigest', 'workspaceRootIdentityDigest', 'destinationBindingDigest', 'protectedUniqueState', 'replayServiceAvailable'], 'KSTACK_INSTALLER_ATTEMPT_INVALID');
  id(input.attemptId, 'KSTACK_INSTALLER_ATTEMPT_INVALID');
  for (const key of ['handoffDigest', 'installerProfileDigest', 'policyDigest', 'principalDigest', 'workspaceRootIdentityDigest', 'destinationBindingDigest']) digest(input[key], 'KSTACK_INSTALLER_ATTEMPT_INVALID');
  if (input.protectedUniqueState !== true || input.replayServiceAvailable !== true) fail('PROTECTED_ATTEMPT_SERVICE_UNAVAILABLE');
  const attempt = { schemaId: 'kstack.installer-attempt.v1', schemaVersion: 1, attemptId: input.attemptId, handoffDigest: input.handoffDigest, installerProfileDigest: input.installerProfileDigest, policyDigest: input.policyDigest, principalDigest: input.principalDigest, workspaceRootIdentityDigest: input.workspaceRootIdentityDigest, destinationBindingDigest: input.destinationBindingDigest };
  return validateInstallerAttempt(attempt);
}

export function validateInstallerAttempt(input) {
  exact(input, ['schemaId', 'schemaVersion', 'attemptId', 'handoffDigest', 'installerProfileDigest', 'policyDigest', 'principalDigest', 'workspaceRootIdentityDigest', 'destinationBindingDigest'], 'KSTACK_INSTALLER_ATTEMPT_INVALID');
  if (input.schemaId !== 'kstack.installer-attempt.v1' || input.schemaVersion !== 1) fail('KSTACK_INSTALLER_ATTEMPT_INVALID');
  id(input.attemptId, 'KSTACK_INSTALLER_ATTEMPT_INVALID');
  for (const key of ['handoffDigest', 'installerProfileDigest', 'policyDigest', 'principalDigest', 'workspaceRootIdentityDigest', 'destinationBindingDigest']) digest(input[key], 'KSTACK_INSTALLER_ATTEMPT_INVALID');
  return immutable({ attempt: input, attemptDigest: addressObject(HOST_PACKAGE_DOMAINS.installerAttempt, input) });
}

export function validateAttemptLease(input, attemptDigest, destinationBindingDigest) {
  exact(input, ['schemaId', 'schemaVersion', 'attemptDigest', 'destinationBindingDigest', 'leaseId', 'generation', 'exclusive', 'holderMatches', 'current', 'replayProtected'], 'KSTACK_ATTEMPT_LEASE_INVALID');
  if (input.schemaId !== 'kstack.attempt-lease.v1' || input.schemaVersion !== 1) fail('KSTACK_ATTEMPT_LEASE_INVALID');
  for (const key of ['attemptDigest', 'destinationBindingDigest']) digest(input[key], 'KSTACK_ATTEMPT_LEASE_INVALID');
  id(input.leaseId, 'KSTACK_ATTEMPT_LEASE_INVALID'); decimal(input.generation, 'KSTACK_ATTEMPT_LEASE_INVALID', Number.MAX_SAFE_INTEGER);
  for (const key of ['exclusive', 'holderMatches', 'current', 'replayProtected']) bool(input[key], 'KSTACK_ATTEMPT_LEASE_INVALID');
  if (input.attemptDigest !== attemptDigest || input.destinationBindingDigest !== destinationBindingDigest || !input.exclusive || !input.holderMatches || !input.current || !input.replayProtected) fail('KSTACK_ATTEMPT_LEASE_LOST');
  return immutable({ lease: input, leaseDigest: addressObject(HOST_PACKAGE_DOMAINS.attemptLease, input) });
}

export function validateDetectorPlan(input) {
  exact(input, ['schemaId', 'schemaVersion', 'targetId', 'probes'], 'KSTACK_DETECTOR_PLAN_INVALID');
  if (input.schemaId !== 'kstack.detector-plan.v1' || input.schemaVersion !== 1) fail('KSTACK_DETECTOR_PLAN_INVALID');
  id(input.targetId, 'KSTACK_DETECTOR_PLAN_INVALID');
  if (!Array.isArray(input.probes) || input.probes.length === 0 || input.probes.length > 32) fail('KSTACK_DETECTOR_PLAN_INVALID');
  const ids = new Set();
  for (const probe of input.probes) {
    exact(probe, ['probeId', 'kind', 'executableNames', 'argv', 'allowedExitCodes', 'timeoutMs', 'outputSchemaDigest', 'failureDisposition'], 'KSTACK_DETECTOR_PLAN_INVALID');
    id(probe.probeId, 'KSTACK_DETECTOR_PLAN_INVALID'); if (ids.has(probe.probeId)) fail('KSTACK_DETECTOR_PLAN_INVALID'); ids.add(probe.probeId);
    if (!['PATH_EXECUTABLE', 'FIXED_RELATIVE_FILE', 'VERSION_ARGV', 'HOST_READ_ONLY_API'].includes(probe.kind)) fail('KSTACK_DETECTOR_PLAN_INVALID');
    if (!Array.isArray(probe.executableNames) || probe.executableNames.some((name) => typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(name))) fail('KSTACK_DETECTOR_PLAN_INVALID');
    if (!Array.isArray(probe.argv) || probe.argv.some((arg) => typeof arg !== 'string' || Buffer.byteLength(arg) > 256 || /[\u0000\r\n;&|`$<>]/u.test(arg))) fail('KSTACK_DETECTOR_PLAN_INVALID');
    set(probe.allowedExitCodes, 'KSTACK_DETECTOR_PLAN_INVALID', (value) => decimal(value, 'KSTACK_DETECTOR_PLAN_INVALID', 255));
    decimal(probe.timeoutMs, 'KSTACK_DETECTOR_PLAN_INVALID', 30000); digest(probe.outputSchemaDigest, 'KSTACK_DETECTOR_PLAN_INVALID');
    if (!['CONTINUE', 'UNAVAILABLE'].includes(probe.failureDisposition)) fail('KSTACK_DETECTOR_PLAN_INVALID');
  }
  return immutable(input);
}

export function evaluateDetector(planInput, observations) {
  const plan = validateDetectorPlan(planInput);
  if (!Array.isArray(observations) || observations.length !== plan.probes.length) fail('DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS');
  let available = false;
  for (let index = 0; index < plan.probes.length; index += 1) {
    const probe = plan.probes[index]; const observation = observations[index];
    exact(observation, ['probeId', 'outcome', 'openedBinaryIdentityDigest', 'outputDigest', 'exitCode', 'elapsedMs', 'trustedSearchPath'], 'DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS');
    if (observation.probeId !== probe.probeId || !['MATCH', 'NO_MATCH', 'UNVERIFIABLE', 'AMBIGUOUS'].includes(observation.outcome)) fail('DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS');
    if (observation.openedBinaryIdentityDigest !== null) digest(observation.openedBinaryIdentityDigest, 'DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS');
    if (observation.outputDigest !== null) digest(observation.outputDigest, 'DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS');
    if (observation.exitCode !== null) decimal(observation.exitCode, 'DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS', 255);
    decimal(observation.elapsedMs, 'DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS', Number(probe.timeoutMs)); bool(observation.trustedSearchPath, 'DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS');
    if (observation.outcome === 'AMBIGUOUS') return 'AMBIGUOUS';
    if (observation.outcome === 'UNVERIFIABLE' || !observation.trustedSearchPath) { if (probe.failureDisposition === 'UNAVAILABLE') return 'UNVERIFIABLE'; continue; }
    if (observation.outcome === 'MATCH') {
      if (observation.openedBinaryIdentityDigest === null || observation.outputDigest === null || !probe.allowedExitCodes.includes(observation.exitCode)) return 'UNVERIFIABLE';
      available = true;
    }
  }
  return available ? 'AVAILABLE' : 'ABSENT';
}

export function validateInstallerProfile(input) {
  exact(input, ['schemaId', 'schemaVersion', 'registrySetDigest', 'targetId', 'platformProfile', 'scope', 'detectorPlanDigest', 'destinationTemplateId', 'activationStrategy', 'activationPrimitiveEvidenceDigest', 'fileModePolicyDigest', 'preActivationTestIds', 'postActivationTestIds', 'boundedRetryPolicyDigest'], 'HANDOFF_OR_PROFILE_INVALID');
  if (input.schemaId !== 'kstack.installer-profile.v1' || input.schemaVersion !== 1 || !['PROJECT', 'USER'].includes(input.scope) || !ACTIVATION_STRATEGIES.includes(input.activationStrategy)) fail('HANDOFF_OR_PROFILE_INVALID');
  for (const key of ['registrySetDigest', 'detectorPlanDigest', 'activationPrimitiveEvidenceDigest', 'fileModePolicyDigest', 'boundedRetryPolicyDigest']) digest(input[key], 'HANDOFF_OR_PROFILE_INVALID');
  for (const key of ['targetId', 'platformProfile', 'destinationTemplateId']) id(input[key], 'HANDOFF_OR_PROFILE_INVALID');
  set(input.preActivationTestIds, 'HANDOFF_OR_PROFILE_INVALID', (value) => testId(value, 'HANDOFF_OR_PROFILE_INVALID'));
  set(input.postActivationTestIds, 'HANDOFF_OR_PROFILE_INVALID', (value) => testId(value, 'HANDOFF_OR_PROFILE_INVALID'));
  return immutable(input);
}

export function classifyDestination(input) {
  exact(input, ['entryState', 'regularDirectory', 'emptyAfterSystemEntries', 'ownershipReceiptValid', 'activeReceiptValid', 'installedManifestMatches', 'bindingIdentityMatches', 'pointerProfileValid'], 'DESTINATION_BINDING_CHANGED');
  if (!['ABSENT', 'PRESENT', 'AMBIGUOUS'].includes(input.entryState)) fail('DESTINATION_BINDING_CHANGED');
  for (const key of Object.keys(input).filter((key) => key !== 'entryState')) bool(input[key], 'DESTINATION_BINDING_CHANGED');
  if (input.entryState === 'AMBIGUOUS' || !input.bindingIdentityMatches) return 'FOREIGN_OR_UNKNOWN';
  if (input.entryState === 'ABSENT') {
    return input.regularDirectory || input.emptyAfterSystemEntries || input.ownershipReceiptValid || input.activeReceiptValid
      || input.installedManifestMatches || input.pointerProfileValid ? 'FOREIGN_OR_UNKNOWN' : 'ABSENT';
  }
  if (input.pointerProfileValid) {
    return !input.regularDirectory && !input.emptyAfterSystemEntries && input.ownershipReceiptValid
      && input.activeReceiptValid && input.installedManifestMatches ? 'KSTACK_POINTER_ACTIVE' : 'FOREIGN_OR_UNKNOWN';
  }
  if (!input.regularDirectory) return 'FOREIGN_OR_UNKNOWN';
  if (input.emptyAfterSystemEntries) {
    return input.ownershipReceiptValid && !input.activeReceiptValid && !input.installedManifestMatches ? 'EMPTY_OWNED' : 'FOREIGN_OR_UNKNOWN';
  }
  if (input.activeReceiptValid && input.ownershipReceiptValid && input.installedManifestMatches) return 'KSTACK_ACTIVE';
  return 'FOREIGN_OR_UNKNOWN';
}

export function validateActivationBinding(input) {
  if (input?.variant === 'TREE_DESTINATION') {
    exact(input, ['variant', 'containingDirectoryIdentityDigest', 'entryNameDigest', 'observedState', 'currentTreeIdentityDigest', 'currentManifestDigest', 'stagedTreeIdentityDigest', 'stagedManifestDigest', 'filesystemIdentityDigest', 'volumeIdentityDigest', 'durabilityDomainDigest', 'linkOrReparse'], 'KSTACK_ACTIVATION_BINDING_INVALID');
    if (!['ABSENT', 'EMPTY_OWNED', 'KSTACK_ACTIVE'].includes(input.observedState) || input.linkOrReparse !== false) fail('KSTACK_ACTIVATION_BINDING_INVALID');
    for (const [key, value] of Object.entries(input)) if (key.endsWith('Digest') && value !== null) digest(value, 'KSTACK_ACTIVATION_BINDING_INVALID');
    if ((input.observedState === 'ABSENT') !== (input.currentTreeIdentityDigest === null && input.currentManifestDigest === null)) fail('KSTACK_ACTIVATION_BINDING_INVALID');
    return immutable(input);
  }
  if (input?.variant === 'POINTER_DESTINATION') {
    exact(input, ['variant', 'containingDirectoryIdentityDigest', 'entryNameDigest', 'observedState', 'pointerKind', 'currentPointerIdentityDigest', 'currentPointerByteDigest', 'versionStoreRootIdentityDigest', 'oldVersionTreeIdentityDigest', 'oldManifestDigest', 'stagedNewTreeIdentityDigest', 'stagedManifestDigest', 'pointerFormatSchemaDigest', 'newPointerTargetDigest', 'filesystemIdentityDigest', 'volumeIdentityDigest', 'durabilityDomainDigest', 'pointerOwned'], 'KSTACK_ACTIVATION_BINDING_INVALID');
    if (!['ABSENT', 'KSTACK_POINTER_ACTIVE'].includes(input.observedState) || !['REGULAR_POINTER_FILE', 'SYMLINK', 'JUNCTION'].includes(input.pointerKind) || input.pointerOwned !== true) fail('KSTACK_ACTIVATION_BINDING_INVALID');
    for (const [key, value] of Object.entries(input)) if (key.endsWith('Digest') && value !== null) digest(value, 'KSTACK_ACTIVATION_BINDING_INVALID');
    if ((input.observedState === 'ABSENT') !== (input.currentPointerIdentityDigest === null && input.currentPointerByteDigest === null && input.oldVersionTreeIdentityDigest === null && input.oldManifestDigest === null)) fail('KSTACK_ACTIVATION_BINDING_INVALID');
    return immutable(input);
  }
  if (input?.variant === 'HOST_NATIVE_DESTINATION') {
    exact(input, ['variant', 'adapterId', 'profileDigest', 'evidenceDigest', 'nativeDestinationIdentityDigest', 'oldManifestDigest', 'newManifestDigest', 'durabilityDomainDigest', 'supportedStates'], 'KSTACK_ACTIVATION_BINDING_INVALID');
    id(input.adapterId, 'KSTACK_ACTIVATION_BINDING_INVALID'); for (const [key, value] of Object.entries(input)) if (key.endsWith('Digest') && value !== null) digest(value, 'KSTACK_ACTIVATION_BINDING_INVALID');
    set(input.supportedStates, 'KSTACK_ACTIVATION_BINDING_INVALID', (value) => { if (!OBSERVED_STATES.includes(value) || value === 'FOREIGN_OR_UNKNOWN') fail('KSTACK_ACTIVATION_BINDING_INVALID'); return value; });
    return immutable(input);
  }
  fail('KSTACK_ACTIVATION_BINDING_INVALID');
}

export function admitActivation({ profile: profileInput, binding: bindingInput, observedState, preActivation, attempt: attemptInput, lease: leaseInput }) {
  const profile = validateInstallerProfile(profileInput); const binding = validateActivationBinding(bindingInput);
  const profileDigest = addressObject(HOST_PACKAGE_DOMAINS.installerProfile, profile);
  const bindingDigest = addressObject(HOST_PACKAGE_DOMAINS.activationBinding, binding);
  const gate = evaluatePreActivationGates(preActivation);
  let verifiedAttempt; let verifiedLease;
  try {
    verifiedAttempt = validateInstallerAttempt(attemptInput);
    if (verifiedAttempt.attempt.installerProfileDigest !== profileDigest || verifiedAttempt.attempt.destinationBindingDigest !== bindingDigest) fail('PREACTIVATION_GATE_FAILED');
    verifiedLease = validateAttemptLease(leaseInput, verifiedAttempt.attemptDigest, bindingDigest);
  } catch { fail('PREACTIVATION_GATE_FAILED'); }
  if (gate.evidence.attemptDigest !== verifiedAttempt.attemptDigest || gate.evidence.leaseDigest !== verifiedLease.leaseDigest
      || gate.evidence.handoffDigest !== verifiedAttempt.attempt.handoffDigest
      || gate.evidence.installerProfileDigest !== verifiedAttempt.attempt.installerProfileDigest
      || gate.evidence.policyDigest !== verifiedAttempt.attempt.policyDigest
      || gate.evidence.principalDigest !== verifiedAttempt.attempt.principalDigest
      || gate.evidence.workspaceRootIdentityDigest !== verifiedAttempt.attempt.workspaceRootIdentityDigest
      || gate.evidence.destinationBindingDigest !== bindingDigest) fail('PREACTIVATION_GATE_FAILED');
  if (!gate.evidence.evidenceDigests.includes(profile.activationPrimitiveEvidenceDigest)) fail('PREACTIVATION_GATE_FAILED');
  if (!OBSERVED_STATES.includes(observedState) || observedState === 'FOREIGN_OR_UNKNOWN'
      || ('observedState' in binding && observedState !== binding.observedState)) fail('ATOMIC_ACTIVATION_UNAVAILABLE');
  const permitted = {
    ABSENT_RENAME: binding.variant === 'TREE_DESTINATION' && observedState === 'ABSENT',
    ATOMIC_DIRECTORY_EXCHANGE: binding.variant === 'TREE_DESTINATION' && ['EMPTY_OWNED', 'KSTACK_ACTIVE'].includes(observedState),
    ATOMIC_POINTER_SWAP: binding.variant === 'POINTER_DESTINATION' && ['ABSENT', 'KSTACK_POINTER_ACTIVE'].includes(observedState),
    HOST_NATIVE_TRANSACTION: binding.variant === 'HOST_NATIVE_DESTINATION' && binding.supportedStates.includes(observedState)
  }[profile.activationStrategy];
  if (!permitted) fail('ATOMIC_ACTIVATION_UNAVAILABLE');
  return immutable({ admitted: true, strategy: profile.activationStrategy, bindingDigest });
}

export function createStagingPlan({ attemptDigest, destinationBindingDigest, renderBundle, renderMemberBytes, fileModePolicyDigest, sameVolume, exclusiveLease }) {
  for (const value of [attemptDigest, destinationBindingDigest, fileModePolicyDigest]) digest(value, 'STAGING_MEMBER_MISMATCH');
  if (sameVolume !== true || exclusiveLease !== true || !renderBundle || !Array.isArray(renderBundle.members) || !renderMemberBytes || typeof renderMemberBytes !== 'object') fail('CAPABILITY_REQUIREMENTS_UNMET');
  const paths = renderBundle.members.map((member) => member.path);
  const sortedPaths = [...paths].sort(compareUtf8);
  if (new Set(paths).size !== paths.length || paths.some((value, index) => value !== sortedPaths[index])
      || JSON.stringify(Object.keys(renderMemberBytes).sort(compareUtf8)) !== JSON.stringify(sortedPaths)) fail('STAGING_MEMBER_MISMATCH');
  const operations = renderBundle.members.map((member) => {
    validatePortableRelativePath(member.path); const bytes = Buffer.from(renderMemberBytes[member.path]);
    if (String(bytes.length) !== member.byteLength || rawDigest(bytes) !== member.contentDigest) fail('STAGING_MEMBER_MISMATCH');
    return { path: member.path, byteLength: member.byteLength, contentDigest: member.contentDigest, executable: false, operation: 'CREATE_EXCLUSIVE_NOFOLLOW_FLUSH_REOPEN_VERIFY' };
  });
  const stagingPlan = { schemaId: 'kstack.staging-plan.v1', schemaVersion: 1, attemptDigest, destinationBindingDigest, fileModePolicyDigest, sameVolume: true, operations };
  return immutable({ stagingPlan, stagingPlanDigest: addressObject(HOST_PACKAGE_DOMAINS.stagingPlan, stagingPlan) });
}

export function evaluatePreActivationGates(input) {
  exact(input, ['attemptDigest', 'leaseDigest', 'handoffDigest', 'installerProfileDigest', 'policyDigest', 'principalDigest', 'workspaceRootIdentityDigest', 'destinationBindingDigest', 'handoffResolved', 'ownerApprovalCurrent', 'destinationRemeasured', 'stagedManifestExact', 'preActivationTestsPass', 'preservationOrMigrationAuthorized', 'primitiveEvidenceExact', 'rollbackAvailable', 'runningActionsCompatible', 'evidenceDigests'], 'PREACTIVATION_GATE_FAILED');
  for (const key of ['attemptDigest', 'leaseDigest', 'handoffDigest', 'installerProfileDigest', 'policyDigest', 'principalDigest', 'workspaceRootIdentityDigest', 'destinationBindingDigest']) digest(input[key], 'PREACTIVATION_GATE_FAILED');
  for (const key of ['handoffResolved', 'ownerApprovalCurrent', 'destinationRemeasured', 'stagedManifestExact', 'preActivationTestsPass', 'preservationOrMigrationAuthorized', 'primitiveEvidenceExact', 'rollbackAvailable', 'runningActionsCompatible']) bool(input[key], 'PREACTIVATION_GATE_FAILED');
  const evidenceDigests = set(input.evidenceDigests, 'PREACTIVATION_GATE_FAILED', (value) => digest(value, 'PREACTIVATION_GATE_FAILED'));
  if (evidenceDigests.length === 0 || Object.entries(input).some(([, value]) => typeof value === 'boolean' && !value)) fail('PREACTIVATION_GATE_FAILED');
  const evidence = { schemaId: 'kstack.preactivation-evidence.v1', schemaVersion: 1, ...input, evidenceDigests };
  return immutable({ evidence, preActivationEvidenceDigest: addressObject(HOST_PACKAGE_DOMAINS.preActivationEvidence, evidence) });
}

const TRANSITIONS = Object.freeze({
  PREFLIGHT: ['STAGED', 'ABORTED_BEFORE_SWITCH'], STAGED: ['PREPARED', 'ABORTED_BEFORE_SWITCH'],
  PREPARED: ['SWITCH_OBSERVED', 'ABORTED_BEFORE_SWITCH', 'RECOVERY_REQUIRED'],
  SWITCH_OBSERVED: ['VERIFIED', 'ROLLED_BACK', 'RECOVERY_REQUIRED'], VERIFIED: ['COMMITTED', 'ROLLED_BACK', 'RECOVERY_REQUIRED']
});
export function advanceInstallerState(current, next) {
  if (!INSTALLER_STATES.includes(current) || !INSTALLER_STATES.includes(next) || !(TRANSITIONS[current] ?? []).includes(next)) fail('KSTACK_INSTALLER_STATE_INVALID');
  return next;
}

export function appendInstallerTransactionRecord(input, attemptInput, priorRecord = null) {
  exact(input, ['attemptDigest', 'sequence', 'priorRecordDigest', 'priorState', 'state', 'handoffDigest', 'destinationBindingDigest', 'oldManifestDigest', 'newManifestDigest', 'activationStrategy', 'evidenceDigests', 'outcome'], 'KSTACK_INSTALLER_LEDGER_INVALID');
  for (const key of ['attemptDigest', 'handoffDigest', 'destinationBindingDigest', 'newManifestDigest']) digest(input[key], 'KSTACK_INSTALLER_LEDGER_INVALID');
  if (input.oldManifestDigest !== null) digest(input.oldManifestDigest, 'KSTACK_INSTALLER_LEDGER_INVALID');
  if (input.priorRecordDigest !== null) digest(input.priorRecordDigest, 'KSTACK_INSTALLER_LEDGER_INVALID');
  let verifiedAttempt;
  try { verifiedAttempt = validateInstallerAttempt(attemptInput); } catch { fail('KSTACK_INSTALLER_LEDGER_INVALID'); }
  if (input.attemptDigest !== verifiedAttempt.attemptDigest || input.handoffDigest !== verifiedAttempt.attempt.handoffDigest
      || input.destinationBindingDigest !== verifiedAttempt.attempt.destinationBindingDigest) fail('KSTACK_INSTALLER_LEDGER_INVALID');
  decimal(input.sequence, 'KSTACK_INSTALLER_LEDGER_INVALID', Number.MAX_SAFE_INTEGER);
  if (!ACTIVATION_STRATEGIES.includes(input.activationStrategy) || typeof input.outcome !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/u.test(input.outcome)) fail('KSTACK_INSTALLER_LEDGER_INVALID');
  const evidenceDigests = set(input.evidenceDigests, 'KSTACK_INSTALLER_LEDGER_INVALID', (value) => digest(value, 'KSTACK_INSTALLER_LEDGER_INVALID'));
  const sequence = BigInt(input.sequence);
  if (sequence === 0n) {
    if (priorRecord !== null || input.priorRecordDigest !== null || input.priorState !== null || input.state !== 'PREFLIGHT') fail('KSTACK_INSTALLER_LEDGER_INVALID');
  } else {
    digest(input.priorRecordDigest, 'KSTACK_INSTALLER_LEDGER_INVALID');
    if (!priorRecord || priorRecord.schemaId !== 'kstack.installer-transaction-record.v1' || priorRecord.schemaVersion !== 1
        || addressObject(HOST_PACKAGE_DOMAINS.installerTransactionRecord, priorRecord) !== input.priorRecordDigest
        || BigInt(priorRecord.sequence) + 1n !== sequence || priorRecord.state !== input.priorState
        || !['attemptDigest', 'handoffDigest', 'destinationBindingDigest', 'oldManifestDigest', 'newManifestDigest', 'activationStrategy'].every((key) => priorRecord[key] === input[key])
        || !(TRANSITIONS[input.priorState] ?? []).includes(input.state)) fail('KSTACK_INSTALLER_LEDGER_INVALID');
  }
  const record = { schemaId: 'kstack.installer-transaction-record.v1', schemaVersion: 1, ...input, evidenceDigests };
  return immutable({ record, recordDigest: addressObject(HOST_PACKAGE_DOMAINS.installerTransactionRecord, record) });
}

export function createInstallerHealth(input) {
  exact(input, ['attemptDigest', 'destinationIdentityDigest', 'liveManifestDigest', 'testResults'], 'KSTACK_INSTALLER_HEALTH_INVALID');
  for (const key of ['attemptDigest', 'destinationIdentityDigest', 'liveManifestDigest']) digest(input[key], 'KSTACK_INSTALLER_HEALTH_INVALID');
  if (!Array.isArray(input.testResults) || input.testResults.length === 0) fail('KSTACK_INSTALLER_HEALTH_INVALID');
  const seen = new Set();
  const testResults = input.testResults.map((result) => {
    exact(result, ['testId', 'status', 'evidenceDigest', 'bounded', 'readOnly', 'identityMatches'], 'KSTACK_INSTALLER_HEALTH_INVALID');
    testId(result.testId, 'KSTACK_INSTALLER_HEALTH_INVALID'); if (seen.has(result.testId)) fail('KSTACK_INSTALLER_HEALTH_INVALID'); seen.add(result.testId);
    if (!['PASS', 'FAIL', 'TIMEOUT'].includes(result.status)) fail('KSTACK_INSTALLER_HEALTH_INVALID'); digest(result.evidenceDigest, 'KSTACK_INSTALLER_HEALTH_INVALID');
    for (const key of ['bounded', 'readOnly', 'identityMatches']) bool(result[key], 'KSTACK_INSTALLER_HEALTH_INVALID');
    return { ...result };
  }).sort((left, right) => compareUtf8(left.testId, right.testId));
  const passed = testResults.every((result) => result.status === 'PASS' && result.bounded && result.readOnly && result.identityMatches);
  const health = { schemaId: 'kstack.installer-health.v1', schemaVersion: 1, attemptDigest: input.attemptDigest, destinationIdentityDigest: input.destinationIdentityDigest, liveManifestDigest: input.liveManifestDigest, passed, operationEligibilityGranted: false, hostQualificationGranted: false, testResults };
  return immutable({ health, healthDigest: addressObject(HOST_PACKAGE_DOMAINS.installerHealth, health) });
}

export function validateInstallerHealth(input) {
  exact(input, ['schemaId', 'schemaVersion', 'attemptDigest', 'destinationIdentityDigest', 'liveManifestDigest', 'passed', 'operationEligibilityGranted', 'hostQualificationGranted', 'testResults'], 'KSTACK_INSTALLER_HEALTH_INVALID');
  if (input.schemaId !== 'kstack.installer-health.v1' || input.schemaVersion !== 1 || input.operationEligibilityGranted !== false || input.hostQualificationGranted !== false) fail('KSTACK_INSTALLER_HEALTH_INVALID');
  const expected = createInstallerHealth({ attemptDigest: input.attemptDigest, destinationIdentityDigest: input.destinationIdentityDigest, liveManifestDigest: input.liveManifestDigest, testResults: input.testResults });
  if (input.passed !== expected.health.passed
      || input.testResults.some((result, index) => result.testId !== expected.health.testResults[index].testId)) fail('KSTACK_INSTALLER_HEALTH_INVALID');
  return expected;
}

export function createActiveInstallReceipt(input, healthInput) {
  exact(input, ['attemptDigest', 'rootIdentityDigest', 'destinationIdentityDigest', 'handoffDigest', 'renderBundleDigest', 'liveManifestDigest', 'targetId', 'platformProfile', 'scope', 'destinationTemplateId', 'transactionRecordDigest', 'healthDigest', 'ledgerState', 'healthPassed'], 'KSTACK_ACTIVE_RECEIPT_INVALID');
  for (const key of ['attemptDigest', 'rootIdentityDigest', 'destinationIdentityDigest', 'handoffDigest', 'renderBundleDigest', 'liveManifestDigest', 'transactionRecordDigest', 'healthDigest']) digest(input[key], 'KSTACK_ACTIVE_RECEIPT_INVALID');
  for (const key of ['targetId', 'platformProfile', 'destinationTemplateId']) id(input[key], 'KSTACK_ACTIVE_RECEIPT_INVALID');
  let verifiedHealth;
  try { verifiedHealth = validateInstallerHealth(healthInput); } catch { fail('KSTACK_ACTIVE_RECEIPT_INVALID'); }
  if (!['PROJECT', 'USER'].includes(input.scope) || input.ledgerState !== 'VERIFIED' || input.healthPassed !== true
      || !verifiedHealth.health.passed || verifiedHealth.healthDigest !== input.healthDigest
      || verifiedHealth.health.attemptDigest !== input.attemptDigest || verifiedHealth.health.destinationIdentityDigest !== input.destinationIdentityDigest
      || verifiedHealth.health.liveManifestDigest !== input.liveManifestDigest) fail('KSTACK_ACTIVE_RECEIPT_INVALID');
  const receipt = { schemaId: 'kstack.active-install-receipt.v1', schemaVersion: 1, ...input };
  return immutable({ receipt, receiptDigest: addressObject(HOST_PACKAGE_DOMAINS.activeInstallReceipt, receipt) });
}

export function decideRollback(input) {
  exact(input, ['state', 'oldIdentityRetained', 'primitiveStillQualified', 'persistedWriteDisposition', 'oldManifestExact', 'oldHealthPass'], 'KSTACK_ROLLBACK_DECISION_INVALID');
  if (!['SWITCH_OBSERVED', 'VERIFIED'].includes(input.state) || !['NONE', 'BACKWARD_READABLE', 'NON_BACKWARD_READABLE', 'UNKNOWN'].includes(input.persistedWriteDisposition)) fail('KSTACK_ROLLBACK_DECISION_INVALID');
  for (const key of ['oldIdentityRetained', 'primitiveStillQualified', 'oldManifestExact', 'oldHealthPass']) bool(input[key], 'KSTACK_ROLLBACK_DECISION_INVALID');
  return input.oldIdentityRetained && input.primitiveStillQualified && ['NONE', 'BACKWARD_READABLE'].includes(input.persistedWriteDisposition) && input.oldManifestExact && input.oldHealthPass ? 'ROLLBACK_ALLOWED' : 'RECOVERY_REQUIRED';
}

export function classifyRollbackResult(input) {
  exact(input, ['rollbackAdmitted', 'atomicRestoreObserved', 'parentDurabilityFlushed', 'oldIdentityExact', 'oldManifestExact', 'oldHealthPass'], 'KSTACK_ROLLBACK_RESULT_INVALID');
  for (const key of Object.keys(input)) bool(input[key], 'KSTACK_ROLLBACK_RESULT_INVALID');
  return Object.values(input).every(Boolean) ? 'ROLLED_BACK' : 'RECOVERY_REQUIRED';
}

export function classifyCancellation(state) {
  if (!INSTALLER_STATES.includes(state)) fail('KSTACK_CANCELLATION_INVALID');
  if (['PREFLIGHT', 'STAGED'].includes(state)) return 'ABORT_AND_VERIFY_ATTEMPT_STAGING';
  if (state === 'PREPARED' || state === 'SWITCH_OBSERVED' || state === 'VERIFIED') return 'DEFER_UNTIL_RESOLVED';
  return 'NO_ACTIVE_TRANSACTION';
}

export function createCleanupPlan(input) {
  exact(input, ['attemptDigest', 'terminalState', 'terminalDurable', 'targets'], 'KSTACK_CLEANUP_PLAN_INVALID');
  digest(input.attemptDigest, 'KSTACK_CLEANUP_PLAN_INVALID');
  if (!TERMINAL_STATES.includes(input.terminalState)) fail('KSTACK_CLEANUP_PLAN_INVALID'); bool(input.terminalDurable, 'KSTACK_CLEANUP_PLAN_INVALID');
  if (!Array.isArray(input.targets)) fail('KSTACK_CLEANUP_PLAN_INVALID');
  const seen = new Set();
  const targets = input.targets.map((target) => {
    exact(target, ['relativePath', 'identityDigest', 'manifestDigest', 'attemptOwned', 'referenced', 'linkOrReparse', 'role'], 'KSTACK_CLEANUP_PLAN_INVALID');
    validatePortableRelativePath(target.relativePath); digest(target.identityDigest, 'KSTACK_CLEANUP_PLAN_INVALID'); digest(target.manifestDigest, 'KSTACK_CLEANUP_PLAN_INVALID');
    for (const key of ['attemptOwned', 'referenced', 'linkOrReparse']) bool(target[key], 'KSTACK_CLEANUP_PLAN_INVALID');
    if (!['STAGING', 'RESIDUE'].includes(target.role) || !target.attemptOwned || target.referenced || target.linkOrReparse || seen.has(target.relativePath)) fail('KSTACK_CLEANUP_TARGET_REFUSED');
    seen.add(target.relativePath);
    return { ...target };
  }).sort((left, right) => compareUtf8(left.relativePath, right.relativePath));
  if (input.terminalState === 'RECOVERY_REQUIRED' && targets.length > 0) fail('KSTACK_CLEANUP_TARGET_REFUSED');
  if (targets.length > 0 && !input.terminalDurable) fail('KSTACK_CLEANUP_PLAN_INVALID');
  const plan = { schemaId: 'kstack.installer-cleanup-plan.v1', schemaVersion: 1, attemptDigest: input.attemptDigest, terminalState: input.terminalState, targets };
  return immutable({ plan, cleanupPlanDigest: addressObject(HOST_PACKAGE_DOMAINS.cleanupPlan, plan) });
}

export function classifyInstallerRecovery(input) {
  exact(input, ['durableState', 'livePredicate', 'identitiesExact', 'ledgerValid', 'primitiveEvidenceValid'], 'RECOVERY_REQUIRED');
  if (!INSTALLER_STATES.includes(input.durableState) || !['OLD_ACTIVE', 'NEW_ACTIVE', 'NO_ACTIVE_CHANGE', 'CONTRADICTORY'].includes(input.livePredicate)) fail('RECOVERY_REQUIRED');
  for (const key of ['identitiesExact', 'ledgerValid', 'primitiveEvidenceValid']) bool(input[key], 'RECOVERY_REQUIRED');
  if (!input.identitiesExact || !input.ledgerValid || !input.primitiveEvidenceValid || input.livePredicate === 'CONTRADICTORY') return 'RECOVERY_REQUIRED';
  if (['PREFLIGHT', 'STAGED'].includes(input.durableState)) return input.livePredicate === 'NO_ACTIVE_CHANGE' ? 'ABORTED_BEFORE_SWITCH' : 'RECOVERY_REQUIRED';
  if (input.durableState === 'PREPARED') {
    if (input.livePredicate === 'OLD_ACTIVE' || input.livePredicate === 'NO_ACTIVE_CHANGE') return 'ABORTED_BEFORE_SWITCH';
    if (input.livePredicate === 'NEW_ACTIVE') return 'SWITCH_OBSERVED';
  }
  if (['SWITCH_OBSERVED', 'VERIFIED'].includes(input.durableState) && input.livePredicate === 'NEW_ACTIVE') return input.durableState;
  if (input.durableState === 'COMMITTED' && input.livePredicate === 'NEW_ACTIVE') return 'COMMITTED';
  if (input.durableState === 'ROLLED_BACK' && input.livePredicate === 'OLD_ACTIVE') return 'ROLLED_BACK';
  return 'RECOVERY_REQUIRED';
}
