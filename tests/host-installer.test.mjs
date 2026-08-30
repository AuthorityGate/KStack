import assert from 'node:assert/strict';
import test from 'node:test';
import {
  admitActivation, advanceInstallerState, appendInstallerTransactionRecord, classifyCancellation,
  classifyDestination, classifyInstallerRecovery, classifyRollbackResult, createActiveInstallReceipt, createCleanupPlan,
  createInstallerAttempt, createInstallerHealth, createStagingPlan, decideRollback, evaluateDetector,
  evaluatePreActivationGates, validateActivationBinding, validateAttemptLease, validateDetectorPlan,
  validateInstallerAttempt, validateInstallerHealth, validateInstallerProfile
} from '../plugins/kstack/scripts/kstack-host-installer.mjs';
import { HOST_PACKAGE_DOMAINS, addressObject, rawDigest } from '../plugins/kstack/scripts/kstack-host-package.mjs';

const D = (c) => `sha256:${c.repeat(64)}`;
const code = (expected, action) => assert.throws(action, (error) => error?.code === expected, expected);

const detector = {
  schemaId: 'kstack.detector-plan.v1', schemaVersion: 1, targetId: 'opencode',
  probes: [{ probeId: 'version', kind: 'VERSION_ARGV', executableNames: ['opencode'], argv: ['--version'], allowedExitCodes: ['0'], timeoutMs: '5000', outputSchemaDigest: D('1'), failureDisposition: 'UNAVAILABLE' }]
};
const observation = { probeId: 'version', outcome: 'MATCH', openedBinaryIdentityDigest: D('2'), outputDigest: D('3'), exitCode: '0', elapsedMs: '20', trustedSearchPath: true };

function profile(strategy) {
  return {
    schemaId: 'kstack.installer-profile.v1', schemaVersion: 1, registrySetDigest: D('1'),
    targetId: 'opencode', platformProfile: 'linux-x64', scope: 'PROJECT', detectorPlanDigest: D('2'),
    destinationTemplateId: 'project-skills', activationStrategy: strategy,
    activationPrimitiveEvidenceDigest: D('3'), fileModePolicyDigest: D('4'),
    preActivationTestIds: ['manifest'], postActivationTestIds: ['health'], boundedRetryPolicyDigest: D('5')
  };
}

function gates(overrides = {}) {
  return { attemptDigest: D('f'), leaseDigest: D('e'), handoffDigest: D('a'), installerProfileDigest: D('b'), policyDigest: D('c'), principalDigest: D('d'), workspaceRootIdentityDigest: D('e'), destinationBindingDigest: D('f'), handoffResolved: true, ownerApprovalCurrent: true, destinationRemeasured: true, stagedManifestExact: true, preActivationTestsPass: true, preservationOrMigrationAuthorized: true, primitiveEvidenceExact: true, rollbackAvailable: true, runningActionsCompatible: true, evidenceDigests: [D('3'), D('d')], ...overrides };
}

function tree(state) {
  const absent = state === 'ABSENT';
  return {
    variant: 'TREE_DESTINATION', containingDirectoryIdentityDigest: D('1'), entryNameDigest: D('2'), observedState: state,
    currentTreeIdentityDigest: absent ? null : D('3'), currentManifestDigest: absent ? null : D('4'),
    stagedTreeIdentityDigest: D('5'), stagedManifestDigest: D('6'), filesystemIdentityDigest: D('7'),
    volumeIdentityDigest: D('8'), durabilityDomainDigest: D('9'), linkOrReparse: false
  };
}

function pointer(state) {
  const absent = state === 'ABSENT';
  return {
    variant: 'POINTER_DESTINATION', containingDirectoryIdentityDigest: D('1'), entryNameDigest: D('2'), observedState: state,
    pointerKind: 'REGULAR_POINTER_FILE', currentPointerIdentityDigest: absent ? null : D('3'), currentPointerByteDigest: absent ? null : D('4'),
    versionStoreRootIdentityDigest: D('5'), oldVersionTreeIdentityDigest: absent ? null : D('6'), oldManifestDigest: absent ? null : D('7'),
    stagedNewTreeIdentityDigest: D('8'), stagedManifestDigest: D('9'), pointerFormatSchemaDigest: D('a'), newPointerTargetDigest: D('b'),
    filesystemIdentityDigest: D('c'), volumeIdentityDigest: D('d'), durabilityDomainDigest: D('e'), pointerOwned: true
  };
}

function activationAuthority(binding, profileInput, gateOverrides = {}) {
  const installerProfileDigest = addressObject(HOST_PACKAGE_DOMAINS.installerProfile, validateInstallerProfile(profileInput));
  const destinationBindingDigest = addressObject(HOST_PACKAGE_DOMAINS.activationBinding, validateActivationBinding(binding));
  const created = createInstallerAttempt({
    attemptId: 'activation-attempt-1', handoffDigest: D('a'), installerProfileDigest, policyDigest: D('c'),
    principalDigest: D('d'), workspaceRootIdentityDigest: D('e'), destinationBindingDigest,
    protectedUniqueState: true, replayServiceAvailable: true
  });
  const lease = {
    schemaId: 'kstack.attempt-lease.v1', schemaVersion: 1, attemptDigest: created.attemptDigest,
    destinationBindingDigest, leaseId: 'activation-lease-1', generation: '1', exclusive: true,
    holderMatches: true, current: true, replayProtected: true
  };
  const verifiedLease = validateAttemptLease(lease, created.attemptDigest, destinationBindingDigest);
  return {
    attempt: created.attempt,
    lease,
    preActivation: gates({
      attemptDigest: created.attemptDigest, leaseDigest: verifiedLease.leaseDigest,
      handoffDigest: created.attempt.handoffDigest, installerProfileDigest: created.attempt.installerProfileDigest,
      policyDigest: created.attempt.policyDigest, principalDigest: created.attempt.principalDigest,
      workspaceRootIdentityDigest: created.attempt.workspaceRootIdentityDigest, destinationBindingDigest,
      ...gateOverrides
    })
  };
}

test('detector is shell-free, identity-bound, bounded, and fail-closed', () => {
  assert.deepEqual(validateDetectorPlan(detector), detector);
  assert.equal(evaluateDetector(detector, [observation]), 'AVAILABLE');
  assert.equal(evaluateDetector(detector, [{ ...observation, outcome: 'NO_MATCH', openedBinaryIdentityDigest: null, outputDigest: null, exitCode: null }]), 'ABSENT');
  assert.equal(evaluateDetector(detector, [{ ...observation, trustedSearchPath: false }]), 'UNVERIFIABLE');
  assert.equal(evaluateDetector(detector, [{ ...observation, outcome: 'AMBIGUOUS' }]), 'AMBIGUOUS');
  code('KSTACK_DETECTOR_PLAN_INVALID', () => validateDetectorPlan({ ...detector, shell: true }));
  code('KSTACK_DETECTOR_PLAN_INVALID', () => validateDetectorPlan({ ...detector, probes: [{ ...detector.probes[0], argv: ['--version; curl attacker'] }] }));
  code('DETECTOR_OUTPUT_INVALID_OR_AMBIGUOUS', () => evaluateDetector(detector, []));
});

test('destination classification trusts protected receipts rather than banners', () => {
  const base = { entryState: 'PRESENT', regularDirectory: true, emptyAfterSystemEntries: false, ownershipReceiptValid: true, activeReceiptValid: true, installedManifestMatches: true, bindingIdentityMatches: true, pointerProfileValid: false };
  assert.equal(classifyDestination({ ...base, entryState: 'ABSENT', regularDirectory: false, ownershipReceiptValid: false, activeReceiptValid: false, installedManifestMatches: false }), 'ABSENT');
  assert.equal(classifyDestination(base), 'KSTACK_ACTIVE');
  assert.equal(classifyDestination({ ...base, activeReceiptValid: false, installedManifestMatches: false, emptyAfterSystemEntries: true }), 'EMPTY_OWNED');
  assert.equal(classifyDestination({ ...base, regularDirectory: false, pointerProfileValid: true }), 'KSTACK_POINTER_ACTIVE');
  assert.equal(classifyDestination({ ...base, pointerProfileValid: true }), 'FOREIGN_OR_UNKNOWN');
  assert.equal(classifyDestination({ ...base, regularDirectory: false, emptyAfterSystemEntries: true, pointerProfileValid: true }), 'FOREIGN_OR_UNKNOWN');
  assert.equal(classifyDestination({ ...base, entryState: 'ABSENT', regularDirectory: false }), 'FOREIGN_OR_UNKNOWN');
  assert.equal(classifyDestination({ ...base, ownershipReceiptValid: false }), 'FOREIGN_OR_UNKNOWN');
  assert.equal(classifyDestination({ ...base, bindingIdentityMatches: false }), 'FOREIGN_OR_UNKNOWN');
});

test('activation strategy matrix is total and EMPTY_OWNED never uses ABSENT_RENAME', () => {
  assert.equal(validateInstallerProfile(profile('ABSENT_RENAME')).activationStrategy, 'ABSENT_RENAME');
  const allow = (strategy, binding, observedState = binding.observedState, gateOverrides = {}) => {
    const selectedProfile = profile(strategy);
    return admitActivation({
      profile: selectedProfile, binding, observedState, ...activationAuthority(binding, selectedProfile, gateOverrides)
    }).admitted;
  };
  assert.equal(allow('ABSENT_RENAME', tree('ABSENT')), true);
  assert.equal(allow('ATOMIC_DIRECTORY_EXCHANGE', tree('EMPTY_OWNED')), true);
  assert.equal(allow('ATOMIC_DIRECTORY_EXCHANGE', tree('KSTACK_ACTIVE')), true);
  assert.equal(allow('ATOMIC_POINTER_SWAP', pointer('ABSENT')), true);
  assert.equal(allow('ATOMIC_POINTER_SWAP', pointer('KSTACK_POINTER_ACTIVE')), true);
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => allow('ABSENT_RENAME', tree('EMPTY_OWNED')));
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => allow('ATOMIC_DIRECTORY_EXCHANGE', tree('ABSENT')));
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => allow('ATOMIC_POINTER_SWAP', tree('KSTACK_ACTIVE')));
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => allow('ABSENT_RENAME', tree('ABSENT'), 'KSTACK_ACTIVE'));
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => allow('ATOMIC_POINTER_SWAP', pointer('ABSENT'), 'KSTACK_POINTER_ACTIVE'));
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => allow('ABSENT_RENAME', tree('ABSENT'), 'not-a-state'));
  const absentBinding = tree('ABSENT'); const absentProfile = profile('ABSENT_RENAME');
  const absentAuthority = activationAuthority(absentBinding, absentProfile);
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => admitActivation({ profile: profile('ABSENT_RENAME'), binding: absentBinding, ...absentAuthority }));
  code('PREACTIVATION_GATE_FAILED', () => allow('ABSENT_RENAME', absentBinding, 'ABSENT', { primitiveEvidenceExact: false }));
  code('PREACTIVATION_GATE_FAILED', () => allow('ABSENT_RENAME', absentBinding, 'ABSENT', { evidenceDigests: [D('d')] }));
  const otherBinding = { ...absentBinding, entryNameDigest: D('f') };
  code('PREACTIVATION_GATE_FAILED', () => admitActivation({
    profile: profile('ABSENT_RENAME'), binding: otherBinding, observedState: 'ABSENT', ...absentAuthority
  }));
  const otherAuthority = activationAuthority(otherBinding, absentProfile);
  code('PREACTIVATION_GATE_FAILED', () => admitActivation({
    profile: profile('ABSENT_RENAME'), binding: otherBinding, observedState: 'ABSENT',
    ...otherAuthority, preActivation: gates()
  }));
  code('PREACTIVATION_GATE_FAILED', () => admitActivation({
    profile: profile('ATOMIC_DIRECTORY_EXCHANGE'), binding: absentBinding, observedState: 'ABSENT', ...absentAuthority
  }));
  code('PREACTIVATION_GATE_FAILED', () => admitActivation({
    profile: absentProfile, binding: absentBinding, observedState: 'ABSENT',
    ...absentAuthority, preActivation: { ...absentAuthority.preActivation, destinationBindingDigest: D('1') }
  }));
  code('KSTACK_ACTIVATION_BINDING_INVALID', () => validateActivationBinding({ ...tree('KSTACK_ACTIVE'), linkOrReparse: true }));
});

test('host-native activation admits only an exact registered observed state', () => {
  const binding = {
    variant: 'HOST_NATIVE_DESTINATION', adapterId: 'native-adapter', profileDigest: D('1'), evidenceDigest: D('2'),
    nativeDestinationIdentityDigest: D('3'), oldManifestDigest: null, newManifestDigest: D('4'), durabilityDomainDigest: D('5'),
    supportedStates: ['ABSENT', 'KSTACK_ACTIVE']
  };
  const nativeProfile = profile('HOST_NATIVE_TRANSACTION'); const authority = activationAuthority(binding, nativeProfile);
  assert.equal(admitActivation({ profile: nativeProfile, binding, observedState: 'ABSENT', ...authority }).admitted, true);
  code('ATOMIC_ACTIVATION_UNAVAILABLE', () => admitActivation({ profile: nativeProfile, binding, observedState: 'EMPTY_OWNED', ...authority }));
});

test('staging plan covers exact sorted render members and never marks content executable', () => {
  const memberBytes = { 'SKILL.md': Buffer.from('body\n'), 'refs/info.md': Buffer.from('info\n') };
  const renderBundle = {
    members: Object.entries(memberBytes).map(([path, bytes]) => ({ path, byteLength: String(bytes.length), contentDigest: rawDigest(bytes) }))
  };
  const staged = createStagingPlan({ attemptDigest: D('1'), destinationBindingDigest: D('2'), renderBundle, renderMemberBytes: memberBytes, fileModePolicyDigest: D('3'), sameVolume: true, exclusiveLease: true });
  assert.equal(staged.stagingPlan.operations.length, 2);
  assert.equal(staged.stagingPlan.operations.every((row) => row.executable === false), true);
  code('STAGING_MEMBER_MISMATCH', () => createStagingPlan({ attemptDigest: D('1'), destinationBindingDigest: D('2'), renderBundle: { members: [...renderBundle.members].reverse() }, renderMemberBytes: memberBytes, fileModePolicyDigest: D('3'), sameVolume: true, exclusiveLease: true }));
  code('STAGING_MEMBER_MISMATCH', () => createStagingPlan({ attemptDigest: D('1'), destinationBindingDigest: D('2'), renderBundle, renderMemberBytes: { ...memberBytes, 'SKILL.md': Buffer.from('tampered') }, fileModePolicyDigest: D('3'), sameVolume: true, exclusiveLease: true }));
  code('CAPABILITY_REQUIREMENTS_UNMET', () => createStagingPlan({ attemptDigest: D('1'), destinationBindingDigest: D('2'), renderBundle, renderMemberBytes: memberBytes, fileModePolicyDigest: D('3'), sameVolume: false, exclusiveLease: true }));
});

test('transaction graph and crash recovery never guess or repeat an ambiguous switch', () => {
  assert.equal(advanceInstallerState('PREFLIGHT', 'STAGED'), 'STAGED');
  assert.equal(advanceInstallerState('STAGED', 'PREPARED'), 'PREPARED');
  assert.equal(advanceInstallerState('PREPARED', 'SWITCH_OBSERVED'), 'SWITCH_OBSERVED');
  assert.equal(advanceInstallerState('SWITCH_OBSERVED', 'VERIFIED'), 'VERIFIED');
  assert.equal(advanceInstallerState('VERIFIED', 'COMMITTED'), 'COMMITTED');
  code('KSTACK_INSTALLER_STATE_INVALID', () => advanceInstallerState('PREPARED', 'COMMITTED'));
  const recovery = (durableState, livePredicate, overrides = {}) => classifyInstallerRecovery({ durableState, livePredicate, identitiesExact: true, ledgerValid: true, primitiveEvidenceValid: true, ...overrides });
  assert.equal(recovery('STAGED', 'NO_ACTIVE_CHANGE'), 'ABORTED_BEFORE_SWITCH');
  assert.equal(recovery('PREPARED', 'OLD_ACTIVE'), 'ABORTED_BEFORE_SWITCH');
  assert.equal(recovery('PREPARED', 'NEW_ACTIVE'), 'SWITCH_OBSERVED');
  assert.equal(recovery('SWITCH_OBSERVED', 'NEW_ACTIVE'), 'SWITCH_OBSERVED');
  assert.equal(recovery('COMMITTED', 'NEW_ACTIVE'), 'COMMITTED');
  assert.equal(recovery('PREPARED', 'NEW_ACTIVE', { identitiesExact: false }), 'RECOVERY_REQUIRED');
  assert.equal(recovery('PREPARED', 'CONTRADICTORY'), 'RECOVERY_REQUIRED');
});

test('protected attempts and exclusive leases bind every authority-relevant identity', () => {
  const created = createInstallerAttempt({
    attemptId: 'protected-attempt-1', handoffDigest: D('1'), installerProfileDigest: D('2'), policyDigest: D('3'),
    principalDigest: D('4'), workspaceRootIdentityDigest: D('5'), destinationBindingDigest: D('6'),
    protectedUniqueState: true, replayServiceAvailable: true
  });
  assert.equal(validateInstallerAttempt(created.attempt).attemptDigest, created.attemptDigest);
  const lease = { schemaId: 'kstack.attempt-lease.v1', schemaVersion: 1, attemptDigest: created.attemptDigest, destinationBindingDigest: D('6'), leaseId: 'lease-1', generation: '1', exclusive: true, holderMatches: true, current: true, replayProtected: true };
  assert.equal(validateAttemptLease(lease, created.attemptDigest, D('6')).lease.current, true);
  code('PROTECTED_ATTEMPT_SERVICE_UNAVAILABLE', () => createInstallerAttempt({ attemptId: 'caller-random', handoffDigest: D('1'), installerProfileDigest: D('2'), policyDigest: D('3'), principalDigest: D('4'), workspaceRootIdentityDigest: D('5'), destinationBindingDigest: D('6'), protectedUniqueState: false, replayServiceAvailable: true }));
  code('KSTACK_ATTEMPT_LEASE_LOST', () => validateAttemptLease({ ...lease, current: false }, created.attemptDigest, D('6')));
  code('KSTACK_ATTEMPT_LEASE_LOST', () => validateAttemptLease(lease, D('7'), D('6')));
});

test('pre-activation requires the complete evidence set with no model waiver', () => {
  const gates = { attemptDigest: D('1'), leaseDigest: D('2'), handoffDigest: D('3'), installerProfileDigest: D('4'), policyDigest: D('5'), principalDigest: D('6'), workspaceRootIdentityDigest: D('7'), destinationBindingDigest: D('8'), handoffResolved: true, ownerApprovalCurrent: true, destinationRemeasured: true, stagedManifestExact: true, preActivationTestsPass: true, preservationOrMigrationAuthorized: true, primitiveEvidenceExact: true, rollbackAvailable: true, runningActionsCompatible: true, evidenceDigests: [D('3'), D('4')] };
  assert.equal(evaluatePreActivationGates(gates).evidence.runningActionsCompatible, true);
  code('PREACTIVATION_GATE_FAILED', () => evaluatePreActivationGates({ ...gates, ownerApprovalCurrent: false }));
  code('PREACTIVATION_GATE_FAILED', () => evaluatePreActivationGates({ ...gates, evidenceDigests: [] }));
  code('PREACTIVATION_GATE_FAILED', () => evaluatePreActivationGates({ ...gates, modelWaiver: true }));
});

test('protected ledger is append-only, digest chained, and transition closed', () => {
  const attempt = createInstallerAttempt({
    attemptId: 'ledger-attempt-1', handoffDigest: D('2'), installerProfileDigest: D('6'), policyDigest: D('7'),
    principalDigest: D('8'), workspaceRootIdentityDigest: D('9'), destinationBindingDigest: D('3'),
    protectedUniqueState: true, replayServiceAvailable: true
  });
  const base = { attemptDigest: attempt.attemptDigest, handoffDigest: D('2'), destinationBindingDigest: D('3'), oldManifestDigest: null, newManifestDigest: D('4'), activationStrategy: 'ABSENT_RENAME', evidenceDigests: [D('5')], outcome: 'OK' };
  const first = appendInstallerTransactionRecord({ ...base, sequence: '0', priorRecordDigest: null, priorState: null, state: 'PREFLIGHT' }, attempt.attempt);
  const second = appendInstallerTransactionRecord({ ...base, sequence: '1', priorRecordDigest: first.recordDigest, priorState: 'PREFLIGHT', state: 'STAGED' }, attempt.attempt, first.record);
  assert.equal(second.record.priorRecordDigest, first.recordDigest);
  code('KSTACK_INSTALLER_LEDGER_INVALID', () => appendInstallerTransactionRecord({ ...base, sequence: '1', priorRecordDigest: first.recordDigest, priorState: 'PREFLIGHT', state: 'COMMITTED' }, attempt.attempt, first.record));
  code('KSTACK_INSTALLER_LEDGER_INVALID', () => appendInstallerTransactionRecord({ ...base, sequence: '1', priorRecordDigest: null, priorState: 'PREFLIGHT', state: 'STAGED' }, attempt.attempt));
  code('KSTACK_INSTALLER_LEDGER_INVALID', () => appendInstallerTransactionRecord({ ...base, sequence: '3', priorRecordDigest: first.recordDigest, priorState: 'PREFLIGHT', state: 'STAGED' }, attempt.attempt, first.record));
  code('KSTACK_INSTALLER_LEDGER_INVALID', () => appendInstallerTransactionRecord({ ...base, destinationBindingDigest: D('a'), sequence: '0', priorRecordDigest: null, priorState: null, state: 'PREFLIGHT' }, attempt.attempt));
});

test('health is bounded and non-promotional; commit receipt requires VERIFIED pass', () => {
  const input = { attemptDigest: D('1'), destinationIdentityDigest: D('2'), liveManifestDigest: D('3'), testResults: [{ testId: 'discovery', status: 'PASS', evidenceDigest: D('4'), bounded: true, readOnly: true, identityMatches: true }] };
  const result = createInstallerHealth(input);
  assert.equal(result.health.passed, true);
  assert.equal(result.health.operationEligibilityGranted, false);
  assert.equal(result.health.hostQualificationGranted, false);
  const orderedHealth = createInstallerHealth({
    ...input,
    testResults: [
      { testId: 'a_b', status: 'PASS', evidenceDigest: D('5'), bounded: true, readOnly: true, identityMatches: true },
      { testId: 'a-b', status: 'PASS', evidenceDigest: D('4'), bounded: true, readOnly: true, identityMatches: true }
    ]
  });
  assert.deepEqual(orderedHealth.health.testResults.map((row) => row.testId), ['a-b', 'a_b']);
  assert.equal(validateInstallerHealth(orderedHealth.health).healthDigest, orderedHealth.healthDigest);
  const reorderedHealth = { ...orderedHealth.health, testResults: [...orderedHealth.health.testResults].reverse() };
  code('KSTACK_INSTALLER_HEALTH_INVALID', () => validateInstallerHealth(reorderedHealth));
  code('KSTACK_INSTALLER_HEALTH_INVALID', () => validateInstallerHealth({
    ...orderedHealth.health,
    testResults: [orderedHealth.health.testResults[0], orderedHealth.health.testResults[0]]
  }));
  const receipt = { attemptDigest: D('1'), rootIdentityDigest: D('9'), destinationIdentityDigest: D('2'), handoffDigest: D('4'), renderBundleDigest: D('5'), liveManifestDigest: D('3'), targetId: 'opencode', platformProfile: 'linux-x64', scope: 'PROJECT', destinationTemplateId: 'project-skills', transactionRecordDigest: D('7'), healthDigest: result.healthDigest, ledgerState: 'VERIFIED', healthPassed: true };
  assert.equal(createActiveInstallReceipt(receipt, result.health).receipt.ledgerState, 'VERIFIED');
  assert.equal(createInstallerHealth({ ...input, testResults: [{ ...input.testResults[0], status: 'TIMEOUT' }] }).health.passed, false);
  code('KSTACK_ACTIVE_RECEIPT_INVALID', () => createActiveInstallReceipt({ ...receipt, ledgerState: 'SWITCH_OBSERVED' }, result.health));
  code('KSTACK_ACTIVE_RECEIPT_INVALID', () => createActiveInstallReceipt({ ...receipt, healthPassed: false }, result.health));
  code('KSTACK_ACTIVE_RECEIPT_INVALID', () => createActiveInstallReceipt(receipt, { ...result.health, liveManifestDigest: D('9') }));
  code('KSTACK_ACTIVE_RECEIPT_INVALID', () => createActiveInstallReceipt({
    ...receipt,
    healthDigest: addressObject(HOST_PACKAGE_DOMAINS.installerHealth, reorderedHealth)
  }, reorderedHealth));
});

test('rollback, cancellation, and cleanup retain ambiguous or referenced trees', () => {
  const rollback = { state: 'SWITCH_OBSERVED', oldIdentityRetained: true, primitiveStillQualified: true, persistedWriteDisposition: 'NONE', oldManifestExact: true, oldHealthPass: true };
  assert.equal(decideRollback(rollback), 'ROLLBACK_ALLOWED');
  assert.equal(decideRollback({ ...rollback, persistedWriteDisposition: 'UNKNOWN' }), 'RECOVERY_REQUIRED');
  assert.equal(decideRollback({ ...rollback, oldIdentityRetained: false }), 'RECOVERY_REQUIRED');
  assert.equal(classifyRollbackResult({ rollbackAdmitted: true, atomicRestoreObserved: true, parentDurabilityFlushed: true, oldIdentityExact: true, oldManifestExact: true, oldHealthPass: true }), 'ROLLED_BACK');
  assert.equal(classifyRollbackResult({ rollbackAdmitted: true, atomicRestoreObserved: true, parentDurabilityFlushed: false, oldIdentityExact: true, oldManifestExact: true, oldHealthPass: true }), 'RECOVERY_REQUIRED');
  assert.equal(classifyCancellation('STAGED'), 'ABORT_AND_VERIFY_ATTEMPT_STAGING');
  assert.equal(classifyCancellation('PREPARED'), 'DEFER_UNTIL_RESOLVED');
  assert.equal(classifyCancellation('COMMITTED'), 'NO_ACTIVE_TRANSACTION');
  const target = { relativePath: 'kstack-stage/attempt-1', identityDigest: D('1'), manifestDigest: D('2'), attemptOwned: true, referenced: false, linkOrReparse: false, role: 'STAGING' };
  assert.equal(createCleanupPlan({ attemptDigest: D('3'), terminalState: 'COMMITTED', terminalDurable: true, targets: [target] }).plan.targets.length, 1);
  assert.deepEqual(createCleanupPlan({
    attemptDigest: D('3'), terminalState: 'COMMITTED', terminalDurable: true,
    targets: [{ ...target, relativePath: 'a_b.md' }, { ...target, relativePath: 'a-b.md', role: 'RESIDUE' }]
  }).plan.targets.map((row) => row.relativePath), ['a-b.md', 'a_b.md']);
  code('KSTACK_CLEANUP_TARGET_REFUSED', () => createCleanupPlan({ attemptDigest: D('3'), terminalState: 'COMMITTED', terminalDurable: true, targets: [{ ...target, referenced: true }] }));
  code('KSTACK_CLEANUP_TARGET_REFUSED', () => createCleanupPlan({ attemptDigest: D('3'), terminalState: 'RECOVERY_REQUIRED', terminalDurable: false, targets: [target] }));
  code('KSTACK_CLEANUP_PLAN_INVALID', () => createCleanupPlan({ attemptDigest: D('3'), terminalState: 'COMMITTED', terminalDurable: false, targets: [target] }));
});
