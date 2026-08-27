import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildReflexionTerminationNative } from '../plugins/kstack/native/reflexion-termination-native/build-native.mjs';
import {
  CLAIM_SEMANTICS,
  CLAIM_TYPE,
  LOGICAL_TOOL_ALLOWLIST,
  PRIVILEGE_OPERATION_ORDER,
  TERMINATING_SIGNALS,
  TERMINATION_CONSTANTS,
  deadlineFailureDisposition,
  deriveQualificationTiming,
  evaluateExitSignature,
  evaluateProductionTiming,
  evaluateSignalMonitor,
  executePrivilegeDropProtocol,
  validateMonitorScheduling
} from '../plugins/kstack/scripts/reflexion/termination-contract.mjs';
import {
  SCHEMA_KEYS,
  RESIDUAL_INTERFERENCE_DERIVATION_VOCABULARY,
  UNAVAILABLE_SIGNALS,
  canonicalJson,
  canonicalSha256,
  parseCanonicalJsonBytes,
  validateAttestationPromotion,
  validateProductionEnvelope,
  validateQualificationEnvironment,
  validateQualificationRow,
  validateResidualInterferenceDerivation,
  validateSignalUnavailabilityEvidence,
  validateSignalMonitorCoverageEvidence,
  validateSubstrateAttestation
} from '../plugins/kstack/scripts/reflexion/termination-schema.mjs';
import {
  drainSignalMonitor,
  evaluateContinuousEpoch,
  evaluatePrelaunchAdmission,
  finalizeProductionRecord,
  observeDeadlineReadySet,
  stallBasisPoints,
  utilizationBasisPoints,
  validateClockContract,
  validateGraphAndTerminationEvidence,
  validateIsolationAndPolicyEvidence,
  validateOutcomeClaimSurfaces,
  validateRequalificationLedger
} from '../plugins/kstack/scripts/reflexion/termination-supervisor.mjs';
import { TERMINATION_NATIVE_ABI, expectedClone3Arguments, invokeTerminationNative } from '../plugins/kstack/scripts/reflexion/termination-native.mjs';

const HASH = 'f'.repeat(64);
const OTHER_HASH = 'e'.repeat(64);

function rawRuns({ armToCall = 2_500_000_000n, callToExit = 10_000_000n, controlDrain = 500_000_000n } = {}) {
  const compliantRuns = [];
  const controlRuns = [];
  for (let index = 1; index <= 10; index += 1) {
    compliantRuns.push({
      runIndex: index, launchToArmNs: 10_000_000n, armToCutoffCallNs: armToCall,
      cutoffCallToExitNs: callToExit, exitToObservedExitNs: 5_000_000n,
      elapsedLaunchToObservedExitNs: 15_000_000n + armToCall + callToExit,
      osStatus: 1, osSignal: 'none', capturedExitInvocationCount: 2,
      callbackEntryToExitSeamOrdinalDelta: 1
    });
    controlRuns.push({
      runIndex: index, firstReturnToExitNs: controlDrain, osStatus: 70,
      osSignal: 'none', capturedExitInvocationCount: 1, cutoffCallbackEntryCount: 0
    });
  }
  return { compliantRuns, controlRuns };
}

function environmentFixture() {
  return {
    schema: 'kstack.qualification-environment/v2',
    hostRuntimeSubstrate: {
      hostIdentitySha256: HASH, osDistribution: 'linux', osVersion: '1', kernelBuild: 'kernel', architecture: 'x86_64',
      cpuVendor: 'vendor', cpuFamily: 1, cpuModel: 2, cpuStepping: 3, microcode: '1', physicalCoreCount: 4,
      logicalCpuCount: 8, onlineCpuList: '0-7', numaTopologySha256: HASH, substrateKind: 'bare-metal',
      hypervisorOrRuntime: 'not-applicable', hypervisorOrRuntimeVersion: 'not-applicable', machineImageSha256: 'not-applicable',
      nestedVirtualization: false, clocksource: 'tsc', btfSha256: HASH, tracepointFormatsSha256: HASH
    },
    resourceAllocation: {
      childCpuList: '0-1', childNodeList: '0', deadlineDetectorCpu: 6, signalMonitorCpu: 7, housekeepingCpuList: '4-7',
      workloadCgroupMountId: 1, workloadCgroupInode: 2, workloadCgroupConfigurationSha256: HASH,
      cgroupCpuQuotaMicros: 'max', cgroupCpuPeriodMicros: 100_000, cgroupCpuWeight: 100,
      memoryLimitBytes: 'max', swapLimitBytes: 'max', numaBinding: 'strict', childSchedulerClass: 'SCHED_OTHER', childNiceValue: 0,
      supervisorSchedulerClass: 'SCHED_FIFO', supervisorPriority: 80, workloadUid: 1000, workloadGid: 1000,
      privilegeSeparationPolicySha256: HASH
    },
    concurrencyIsolation: {
      maximumConcurrentChildren: 1, oneChildAtATime: true, consecutiveQualificationPairs: true, overlappingPairsAllowed: false,
      foreignRunnableTasksAllowed: 0, completeSmtSiblingAllocation: true, offlineUnallocatedChildSmtSiblings: true,
      childCpusetPartition: 'isolated', deadlineDetectorCpuExclusive: true, signalMonitorCpuExclusive: true, monitorCpusDistinct: true,
      irqAffinitySha256: HASH, kernelWorkerAllowlistSha256: HASH, schedulerMonitorSha256: HASH, cpuHotplugAllowed: false,
      startBarrierRequired: true, resctrlMode: 'enforced', resctrlConfigurationSha256: HASH
    },
    powerThermalPolicy: {
      powerProfile: 'performance', governor: 'performance', minimumFrequencyKHz: 1, maximumFrequencyKHz: 2,
      turboEnabled: false, powerCapMilliwatts: 1000, thermalSensorSetSha256: HASH, powerSensorSetSha256: HASH,
      thermalMaximumMilliCelsius: 80_000, thermalSamplePeriodNs: 1_000_000, policyEventStreamSha256: HASH,
      policyHeartbeatLimitNs: 10_000_000
    },
    loadAdmissionPolicy: {
      prelaunchWindowNs: 1_000_000_000, prelaunchCpuUtilizationMaximumBasisPoints: 500,
      prelaunchForeignRunnableTaskMaximum: 0, prelaunchRunQueueDepthMaximum: 1,
      prelaunchCpuPsiSomeAvg10MaximumBasisPoints: 50, prelaunchMemoryPsiSomeAvg10MaximumBasisPoints: 50,
      prelaunchMemoryPsiFullAvg10MaximumBasisPoints: 10, prelaunchMemAvailableMinimumBytes: 2_147_483_648,
      continuousEpochNs: 10_000_000, memAvailableSamplePeriodNs: 1_000_000,
      continuousCpuUtilizationMaximumBasisPoints: 500, continuousCpuPsiSomeMaximumBasisPoints: 500,
      continuousMemoryPsiSomeMaximumBasisPoints: 100, continuousMemoryPsiFullMaximumBasisPoints: 0,
      partialEpochsRequired: true
    },
    timingLaunchDiscipline: {
      clockId: 'CLOCK_MONOTONIC', declaredClockTickNs: 1, clockCorrelationUncertaintyLimitNs: 100_000,
      coldLaunchRequired: true, stdioMode: 'preopened-fixed-nonblocking', watchdogNs: 5_000_000_000,
      drainTimerNs: 500_000_000, cutoffTimerNs: 2_500_000_000, childArmToCutoffCallMinimumNs: 2_400_000_000,
      childArmToCutoffCallMaximumNs: 3_200_000_000, childCutoffCallToExitMaximumNs: 250_000_000,
      controlFirstReturnToExitMaximumNs: 500_000_000, segmentPolicyMarginNs: 50_000_000,
      minimumElapsedPolicyMarginNs: 100_000_000, minimumElapsedHardFloorNs: 2_250_000_000,
      deadlineDetectionLatencyLimitNs: 1_000_000, signalMonitorEventLatencyLimitNs: 1_000_000,
      signalMonitorDrainLatencyLimitNs: 1_000_000, maximumTerminationEpisodes: 1
    },
    residualExternalInterference: ['dma', 'firmware-activity'],
    substrateAttestationSha256: 'not-applicable'
  };
}

function coverageFixture() {
  const common = { campaignId: 'campaign', monitorSha256: HASH };
  const fixtureDefinitions = [
    ...TERMINATING_SIGNALS.map((signal) => ({ fixtureId: `signal-${signal}`, fixtureKind: 'terminating-signal', terminatingSignal: signal, eventCount: 2 })),
    { fixtureId: 'stress', fixtureKind: 'ring-capacity-stress', terminatingSignal: 'not-applicable', eventCount: 2 },
    { fixtureId: 'zero', fixtureKind: 'zero-signal', terminatingSignal: 'not-applicable', eventCount: 0 }
  ].sort((left, right) => left.fixtureId < right.fixtureId ? -1 : left.fixtureId > right.fixtureId ? 1 : 0);
  const rawEvents = [];
  for (const fixture of fixtureDefinitions) {
    for (let index = 0; index < fixture.eventCount; index += 1) rawEvents.push({
      fixtureId: fixture.fixtureId, tEventNs: 1_000n + BigInt(index) * 1_000n, tConsumeNs: 1_100n + BigInt(index) * 1_000n,
      signalNumber: 1, signalName: fixture.fixtureKind === 'terminating-signal' ? fixture.terminatingSignal : 'unmapped-or-nonterminating',
      kind: index === 0 ? 'generation' : 'delivery', senderPid: 10, senderTgid: 10, targetPid: 20, targetTgid: 20,
      targetStartTimeTicks: 30, targetCgroupId: 40, cpu: 0, eventSequence: index + 1
    });
  }
  const documents = {
    rawEventsSha256: { schema: 'kstack.signal-monitor-raw-events/v1', ...common, events: rawEvents },
    perCpuSequencesSha256: {
      schema: 'kstack.signal-monitor-per-cpu-sequences/v1', ...common,
      fixtures: fixtureDefinitions.map((fixture) => ({ fixtureId: fixture.fixtureId, cpus: [{ cpu: 0, baselineEventSequence: 0, eventSequences: Array.from({ length: fixture.eventCount }, (_, index) => index + 1) }] }))
    },
    counterSnapshotsSha256: {
      schema: 'kstack.signal-monitor-counter-snapshots/v1', ...common,
      snapshots: fixtureDefinitions.flatMap((fixture) => [0, 1, 2].map((ordinal) => ({
        fixtureId: fixture.fixtureId, phase: ordinal === 0 ? 'baseline' : 'final-drain', snapshotOrdinal: ordinal,
        tSnapshotNs: 10_000n + BigInt(ordinal), linksStable: true, identityStable: true,
        cpus: [{ cpu: 0, producedCount: ordinal === 0 ? 0 : fixture.eventCount, consumedCount: ordinal === 0 ? 0 : fixture.eventCount,
          reservationFailureCount: 0, mapFailureCount: 0, lastEventSequence: ordinal === 0 ? 0 : fixture.eventCount }]
      })))
    },
    fixtureResultsSha256: {
      schema: 'kstack.signal-monitor-fixture-results/v1', ...common,
      fixtures: fixtureDefinitions.map((fixture) => ({
        fixtureId: fixture.fixtureId, fixtureKind: fixture.fixtureKind, terminatingSignal: fixture.terminatingSignal,
        expectedGenerationObserved: fixture.fixtureKind !== 'zero-signal', expectedDeliveryObserved: fixture.fixtureKind !== 'zero-signal',
        zeroLossCounters: true, contiguousPerCpuSequences: true, producerConsumerEqual: true, stableFinalDrain: true,
        maximumEventLatencyNs: fixture.fixtureKind === 'zero-signal' ? 0 : 100, drainLatencyNs: 200, pass: true
      }))
    },
    tracepointLinkStateSha256: {
      schema: 'kstack.signal-monitor-tracepoint-link-state/v1', ...common,
      links: [
        { name: 'signal_deliver', programId: 1, linkId: 11, attachedBeforeCampaign: true, attachedThroughCampaign: true, identityStable: true },
        { name: 'signal_generate', programId: 2, linkId: 12, attachedBeforeCampaign: true, attachedThroughCampaign: true, identityStable: true }
      ]
    }
  };
  const artifacts = Object.fromEntries(Object.entries(documents).map(([field, document]) => [field, Buffer.from(canonicalJson(document))]));
  const manifest = {
    schema: 'kstack.signal-monitor-coverage-evidence/v1', campaignId: 'campaign', monitorSha256: HASH,
    rawEventsSha256: '', perCpuSequencesSha256: '', counterSnapshotsSha256: '', fixtureResultsSha256: '', tracepointLinkStateSha256: '',
    coverageFixtureCount: 25, maximumEventLatencyNs: 100, maximumDrainLatencyNs: 200
  };
  for (const [field, bytes] of Object.entries(artifacts)) manifest[field] = crypto.createHash('sha256').update(bytes).digest('hex');
  return { artifacts, manifest };
}

function qualificationFixture() {
  const environment = environmentFixture();
  const raw = rawRuns();
  const derived = deriveQualificationTiming({ declaredClockTickNs: 1, clockCorrelationUncertaintyNs: 1, ...raw });
  const compliantRuns = raw.compliantRuns.map((run, index) => {
    const launch = 10_000_000_000n + BigInt(index) * 10_000_000_000n;
    const arm = launch + run.launchToArmNs;
    const call = arm + run.armToCutoffCallNs;
    const exit = call + run.cutoffCallToExitNs;
    const observed = exit + run.exitToObservedExitNs;
    const drainStart = observed + 1_000_000n;
    const drainEnd = drainStart + 500_000n;
    return {
      runIndex: index + 1, tLaunchNs: launch, tArmNs: arm, tCutoffEntryNs: call - 1n, tCutoffCallNs: call,
      tExitNs: exit, tOsExitObservedNs: observed, launchToArmNs: run.launchToArmNs, armToCutoffCallNs: run.armToCutoffCallNs,
      cutoffCallToExitNs: run.cutoffCallToExitNs, exitToObservedExitNs: run.exitToObservedExitNs,
      cutoffCallToObservedExitNs: run.cutoffCallToExitNs + run.exitToObservedExitNs,
      elapsedLaunchToObservedExitNs: run.elapsedLaunchToObservedExitNs, osStatus: 1, osSignal: 'none', capturedExitInvocationCount: 2,
      callbackEntryToExitSeamOrdinalDelta: 1, lowerHeadroomNs: run.elapsedLaunchToObservedExitNs - derived.qualifiedMinimumElapsedNs,
      upperHeadroomNs: derived.qualifiedLaunchToObservedExitUpperNs - run.elapsedLaunchToObservedExitNs,
      boundaryLogSha256: HASH, sampleLogSha256: HASH, eventLogSha256: HASH, transcriptSha256: HASH,
      terminationEvidenceSha256: HASH, privilegeDropEvidenceSha256: HASH, signalMonitorProducedEventCount: 0,
      signalMonitorConsumedEventCount: 0, signalMonitorReservationFailureCount: 0, signalMonitorMapFailureCount: 0,
      signalMonitorMaxEventLatencyNs: 0, tSignalMonitorFinalDrainStartNs: drainStart, tSignalMonitorFinalDrainEndNs: drainEnd,
      signalMonitorDrainLatencyNs: 500_000, envelopeVerdict: 'within-qualified-envelope',
      timingVerdict: 'within-qualified-elapsed-window', exitSignatureVerdict: 'qualified-exit-signature', failureCodes: []
    };
  });
  const controlRuns = raw.controlRuns.map((run, index) => {
    const launch = 15_000_000_000n + BigInt(index) * 10_000_000_000n;
    const arm = launch + 10_000_000n; const first = arm + 1_000_000n; const exit = first + run.firstReturnToExitNs;
    const observed = exit + 5_000_000n; const drainStart = observed + 1_000_000n; const drainEnd = drainStart + 500_000n;
    return {
      runIndex: index + 1, tLaunchNs: launch, tArmNs: arm, tFirstReturnNs: first, tExitNs: exit, tOsExitObservedNs: observed,
      armToFirstReturnNs: 1_000_000, firstReturnToExitNs: run.firstReturnToExitNs,
      elapsedLaunchToObservedExitNs: observed - launch, osStatus: 70, osSignal: 'none', capturedExitInvocationCount: 1,
      cutoffCallbackEntryCount: 0, boundaryLogSha256: HASH, sampleLogSha256: HASH, eventLogSha256: HASH,
      transcriptSha256: HASH, terminationEvidenceSha256: HASH, privilegeDropEvidenceSha256: HASH,
      signalMonitorProducedEventCount: 0, signalMonitorConsumedEventCount: 0, signalMonitorReservationFailureCount: 0,
      signalMonitorMapFailureCount: 0, signalMonitorMaxEventLatencyNs: 0, tSignalMonitorFinalDrainStartNs: drainStart,
      tSignalMonitorFinalDrainEndNs: drainEnd, signalMonitorDrainLatencyNs: 500_000,
      envelopeVerdict: 'within-qualified-envelope', controlVerdict: 'expected-unref-natural-drain', failureCodes: []
    };
  });
  const recalculated = deriveQualificationTiming({ declaredClockTickNs: 1, clockCorrelationUncertaintyNs: 1, compliantRuns, controlRuns });
  const { pairResults, ...derivedPolicy } = recalculated;
  const timingPolicy = {
    ...derivedPolicy,
    deadlineDetectionLatenciesNs: Array(10).fill(1_000_000),
    signalMonitorCoverageFixtureMaxEventLatencyNs: 1_000_000,
    signalMonitorCoverageFixtureDrainLatencyNs: 1_000_000,
    signalMonitorCoverageFixtureReservationFailureCount: 0,
    signalMonitorCoverageFixtureMapFailureCount: 0
  };
  const coverage = coverageFixture();
  const row = {
    schema: 'kstack.qualification-row/v3', rowId: 'row', campaignId: 'campaign', campaignAttemptNumber: 1,
    ledgerHeadSha256: HASH, environmentSha256: canonicalSha256(environment), substrateAttestationSha256: 'not-applicable',
    trustManifestSha256: HASH, runtimeSha256: HASH, launcherSha256: HASH, runtimeContractSha256: HASH,
    clockContractSha256: HASH, monitorSha256: HASH, signalMonitorCoverageEvidenceSha256: canonicalSha256(coverage.manifest),
    deadlineDetectorSha256: HASH, privilegeSeparationPolicySha256: HASH, analyzerSha256: HASH, analyzerPolicySha256: HASH,
    injectionManifestSha256: HASH, productionGraphSha256: HASH, instrumentedCompliantGraphSha256: HASH,
    instrumentedControlGraphSha256: HASH, bootstrapNegativeGraphSha256s: ['1'.repeat(64), '2'.repeat(64), '3'.repeat(64), '4'.repeat(64)],
    compliantRuns, controlRuns, pairResults, timingPolicy, residualExternalInterference: ['dma', 'firmware-activity'], result: 'passing'
  };
  return { environment, row, coverage };
}

function privilegeSnapshot() {
  return {
    realUid: 1000, effectiveUid: 1000, savedUid: 1000, fsUid: 1000,
    realGid: 1000, effectiveGid: 1000, savedGid: 1000, fsGid: 1000,
    supplementaryGroupCount: 0, effectiveCapabilities: 0, permittedCapabilities: 0,
    inheritableCapabilities: 0, ambientCapabilities: 0, noNewPrivileges: 1,
    seccompMode: 2, seccompFilterSha256: HASH, securebitsLocked: true, cgroupIdentity: 'cg', startTime: 42, pidfdIdentity: 'pidfd',
    descriptors: [0, 1, 2, 10, 11]
  };
}

function privilegeOperations({ failAt = null, snapshot = privilegeSnapshot() } = {}) {
  return Object.fromEntries(PRIVILEGE_OPERATION_ORDER.map((name) => [name, async () => {
    if (name === failAt) throw new Error('injected');
    if (name === 'childReread' || name === 'parentVerify') return structuredClone(snapshot);
    return true;
  }]));
}

const privilegePolicy = {
  workloadUid: 1000, workloadGid: 1000, descriptorAllowlist: [0, 1, 2, 10, 11],
  descriptorRoles: { 0: 'stdin', 1: 'stdout', 2: 'stderr', 10: 'readiness-barrier', 11: 'start-barrier' },
  privilegedDescriptorCount: 0, seccompFilterSha256: HASH, cgroupIdentity: 'cg', startTime: 42, pidfdIdentity: 'pidfd'
};

function residualDerivationFixture(environment, applicable = environment.residualExternalInterference) {
  const selected = new Set(applicable);
  return {
    schema: 'kstack.residual-interference-derivation/v1', environmentSha256: canonicalSha256(environment),
    classes: RESIDUAL_INTERFERENCE_DERIVATION_VOCABULARY.map((entry) => ({
      class: entry.class, disposition: selected.has(entry.class) ? 'applicable' : 'mitigated',
      basis: selected.has(entry.class) ? entry.applicableBasis : entry.mitigatedBasis, evidenceSha256: HASH
    }))
  };
}

test('symmetric timing derivation admits declared extrema and rejects floor weakening', () => {
  const ordinary = rawRuns();
  const timing = deriveQualificationTiming({ declaredClockTickNs: 10, clockCorrelationUncertaintyNs: 100_000, ...ordinary });
  assert.equal(timing.qualifiedMinimumElapsedNs, 2_299_900_000n);
  assert.equal(timing.qualifiedArmToCutoffCallUpperNs, 3_200_000_000n);
  assert.equal(timing.qualifiedCutoffCallToExitUpperNs, 250_000_000n);
  assert.equal(timing.pairMinimumDifferenceNs, 1_900_000_000n);
  assert.ok(timing.qualifiedLaunchToObservedExitUpperNs <= 4_750_000_000n);

  const boundary = rawRuns({ armToCall: 2_400_000_000n, callToExit: 250_000_000n, controlDrain: 500_000_000n });
  const boundaryTiming = deriveQualificationTiming({ declaredClockTickNs: 1, clockCorrelationUncertaintyNs: 1, ...boundary });
  assert.ok(boundaryTiming.pairResults.every((pair) => pair.differenceNs === 1_900_000_000n && pair.pass));
  assert.equal(boundaryTiming.qualifiedCutoffCallToExitUpperNs, 250_000_000n);
  assert.throws(() => deriveQualificationTiming({ declaredClockTickNs: 100_000_001, clockCorrelationUncertaintyNs: 100_000, ...ordinary }), { code: 'QUALIFICATION_TIMING_INVALID' });
});

test('production timing is inclusive at both endpoints and fail-closed outside them', () => {
  const base = { tLaunchNs: 1_000n, qualifiedMinimumElapsedNs: 100n, qualifiedLaunchToObservedExitUpperNs: 500n };
  assert.equal(evaluateProductionTiming({ ...base, tOsExitObservedNs: 1_100n }).timingVerdict, 'within-qualified-elapsed-window');
  const below = evaluateProductionTiming({ ...base, tOsExitObservedNs: 1_099n });
  assert.equal(below.timingVerdict, 'before-qualified-minimum'); assert.deepEqual(below.failureCodes, ['PARENT_OBSERVED_EXIT_TOO_EARLY']);
  assert.equal(evaluateProductionTiming({ ...base, tOsExitObservedNs: 1_500n }).timingVerdict, 'within-qualified-elapsed-window');
  const late = evaluateProductionTiming({ ...base, tOsExitObservedNs: 1_501n, tTimerfdReadNs: 1_500n });
  assert.equal(late.timingVerdict, 'after-parent-observed-deadline'); assert.ok(late.failureCodes.includes('PARENT_OBSERVED_DEADLINE_EXCEEDED'));
  const missingWake = evaluateProductionTiming({ ...base });
  assert.deepEqual(missingWake.failureCodes, ['MONITOR_GAP', 'PARENT_OBSERVED_DEADLINE_EXCEEDED']);
  const slowWake = evaluateProductionTiming({ ...base, tTimerfdReadNs: 1_001_501n });
  assert.ok(slowWake.failureCodes.includes('MONITOR_GAP'));
});

test('native Linux backend compiles and exercises timerfd/epoll plus clone3 syscall construction', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-termination-native-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const binaryPath = path.join(temporary, 'kstack-reflexion-termination-native');
  const built = await buildReflexionTerminationNative({ outputPath: binaryPath });
  assert.equal(built.stderr.length, 0);
  const description = await invokeTerminationNative(binaryPath, ['describe']);
  assert.equal(description.abiVersion, TERMINATION_NATIVE_ABI);
  assert.deepEqual(description.clone3.flags, ['CLONE_INTO_CGROUP', 'CLONE_PIDFD']);
  assert.equal(description.deadline.exitObservation, 'waitid(P_PIDFD,WEXITED|WNOWAIT|WNOHANG)');
  assert.deepEqual(description.signalMonitor.tracepoints, ['signal_generate', 'signal_deliver']);
  assert.deepEqual(description.signalMonitor.maps, ['BPF_MAP_TYPE_PERCPU_ARRAY', 'BPF_MAP_TYPE_RINGBUF']);
  assert.deepEqual(expectedClone3Arguments(9), { flags: ['CLONE_INTO_CGROUP', 'CLONE_PIDFD'], cgroupFd: 9, exitSignal: 'SIGCHLD', pidfdStorage: 'clone_args.pidfd' });

  const deadline = await invokeTerminationNative(binaryPath, ['deadline-probe']);
  assert.equal(deadline.ok, true); assert.ok(deadline.observedNs >= deadline.deadlineNs); assert.ok(Array.isArray(deadline.failureCodes));
  const cloneArguments = await invokeTerminationNative(binaryPath, ['clone3-argument-probe']);
  assert.equal(cloneArguments.ok, true); assert.equal(cloneArguments.syscallInvoked, true); assert.deepEqual(cloneArguments.flags, ['CLONE_INTO_CGROUP', 'CLONE_PIDFD']);

  const capabilities = await invokeTerminationNative(binaryPath, ['capabilities']);
  const bpf = await invokeTerminationNative(binaryPath, ['bpf-probe']);
  if (capabilities.missing.length) assert.equal(bpf.code, 'CAPABILITY_REQUIREMENTS_UNMET');
  else assert.equal(bpf.ok, true);
  const monitor = await invokeTerminationNative(binaryPath, ['monitor-once', '--generate-prog-fd', '3', '--deliver-prog-fd', '4', '--ring-map-fd', '5', '--monitor-cpu', '0', '--timeout-ms', '0']);
  if (capabilities.missing.length) assert.equal(monitor.code, 'CAPABILITY_REQUIREMENTS_UNMET');
  else assert.equal(monitor.ok, false); // invalid fixture descriptors must fail closed even with privilege
});

test('every deadline/setup failure maps to its exact fail-closed launch state and verdicts', () => {
  assert.deepEqual(deadlineFailureDisposition('create-before-launch').failureCodes, ['DEADLINE_DETECTOR_SETUP_FAILED', 'PRELAUNCH_REJECTED']);
  assert.equal(deadlineFailureDisposition('create-before-launch').launchState, 'prelaunch-rejected');
  assert.deepEqual(deadlineFailureDisposition('register-after-clone').failureCodes, ['DEADLINE_DETECTOR_SETUP_FAILED', 'MONITOR_GAP']);
  assert.deepEqual(deadlineFailureDisposition('late-arm').failureCodes, ['DEADLINE_ARMING_TOO_LATE', 'MONITOR_GAP']);
  assert.deepEqual(deadlineFailureDisposition('identity').failureCodes, ['CHILD_IDENTITY_VALIDATION_FAILED', 'MONITOR_GAP']);
  assert.deepEqual(deadlineFailureDisposition('clock-before-launch').failureCodes, ['CLOCK_CONTRACT_VIOLATION', 'PRELAUNCH_REJECTED']);
  assert.deepEqual(deadlineFailureDisposition('clock-after-launch').failureCodes, ['CLOCK_CONTRACT_VIOLATION', 'MONITOR_GAP']);
  assert.equal(deadlineFailureDisposition('clone-after-launch').launchState, 'spawn-failed');
});

test('deadline and signal monitors require distinct isolated realtime scheduling contracts', () => {
  const environment = environmentFixture();
  const thread = (cpu) => ({ cpu, schedulerClass: 'SCHED_FIFO', priority: 80, exclusiveCpu: true, mlockall: true, prefaulted: true, preallocated: true, dynamicAllocation: false, synchronousIo: false, pinnedWakeMechanism: true, kernelWorkerAllowlistPinned: true, noOtherUserTask: true });
  const runtime = { childCpus: [0, 1], deadlineDetector: thread(6), signalMonitor: thread(7) };
  assert.equal(validateMonitorScheduling(environment, runtime), true);
  assert.throws(() => validateMonitorScheduling(environment, { ...runtime, signalMonitor: thread(6) }), { code: 'MONITOR_GAP' });
  assert.throws(() => validateMonitorScheduling(environment, { ...runtime, signalMonitor: { ...thread(7), mlockall: false } }), { code: 'MONITOR_GAP' });
});

test('signal monitor defines zero-on-empty and fails closed on loss, gaps, and latency', () => {
  const base = {
    onlineCpus: [0, 1], producedCount: { 0: 0, 1: 0 }, consumedCount: { 0: 0, 1: 0 },
    reservationFailureCount: { 0: 0, 1: 0 }, mapFailureCount: { 0: 0, 1: 0 }, sequenceBaselines: { 0: 8, 1: 3 }, sequences: { 0: [], 1: [] },
    events: [], linksStable: true, identityStable: true, finalDrainStartNs: 100n, finalDrainEndNs: 1_000_100n
  };
  const empty = evaluateSignalMonitor(base);
  assert.equal(empty.signalMonitorComplete, true); assert.equal(empty.signalMonitorMaxEventLatencyNs, 0n); assert.equal(empty.signalMonitorDrainLatencyNs, 1_000_000n);
  assert.equal(evaluateSignalMonitor({ ...base, finalDrainEndNs: 1_000_101n }).signalMonitorComplete, false);
  assert.equal(evaluateSignalMonitor({ ...base, reservationFailureCount: { 0: 1, 1: 0 } }).signalMonitorComplete, false);
  assert.equal(evaluateSignalMonitor({ ...base, producedCount: { 0: 1, 1: 0 } }).signalMonitorComplete, false);
  const signal = evaluateSignalMonitor({ ...base, producedCount: { 0: 1, 1: 0 }, consumedCount: { 0: 1, 1: 0 }, sequences: { 0: [9], 1: [] }, events: [{ tEventNs: 10n, tConsumeNs: 1_000_010n, signal: 'SIGTERM' }] });
  assert.equal(signal.signalMonitorComplete, true); assert.deepEqual(signal.failureCodes, ['UNRELATED_TERMINATION_EVIDENCE']);
});

test('privilege-drop protocol gates application release and fails at every step', async () => {
  const passing = await executePrivilegeDropProtocol(privilegeOperations(), privilegePolicy);
  assert.equal(passing.released, true); assert.deepEqual(passing.trace, PRIVILEGE_OPERATION_ORDER); assert.match(passing.privilegeDropEvidenceSha256, /^[0-9a-f]{64}$/u);
  for (const operation of PRIVILEGE_OPERATION_ORDER.slice(0, -1)) {
    const failed = await executePrivilegeDropProtocol(privilegeOperations({ failAt: operation }), privilegePolicy);
    assert.equal(failed.released, false, operation); assert.deepEqual(failed.failureCodes, ['CHILD_PRIVILEGE_DROP_FAILED'], operation);
    assert.equal(failed.trace.includes('releaseApplication'), false, operation);
  }
  const privileged = privilegeSnapshot(); privileged.ambientCapabilities = 1;
  const mismatch = await executePrivilegeDropProtocol(privilegeOperations({ snapshot: privileged }), privilegePolicy);
  assert.equal(mismatch.released, false); assert.equal(mismatch.trace.includes('emitReady'), false);
});

test('exit signature rejects each unrelated termination source independently', () => {
  const base = { osStatus: 1, osSignal: 'none', signalMonitorComplete: true, oomDelta: 0, oomKillDelta: 0, oomGroupKillDelta: 0, cgroupKillCount: 0, supervisorTerminationCount: 0, terminatingSignalEventCount: 0, failureCodes: [] };
  assert.equal(evaluateExitSignature(base).exitSignatureVerdict, 'qualified-exit-signature');
  for (const field of ['oomDelta', 'oomKillDelta', 'oomGroupKillDelta', 'cgroupKillCount', 'supervisorTerminationCount', 'terminatingSignalEventCount']) {
    const result = evaluateExitSignature({ ...base, [field]: 1 });
    assert.equal(result.exitSignatureVerdict, 'unqualified-exit-signature'); assert.ok(result.failureCodes.includes('UNRELATED_TERMINATION_EVIDENCE'));
  }
  assert.ok(evaluateExitSignature({ ...base, signalMonitorComplete: false }).failureCodes.includes('MONITOR_GAP'));
});

test('environment v2 is closed, literal-pinned, and rejects noncanonical CPU lists', () => {
  const environment = environmentFixture();
  assert.equal(validateQualificationEnvironment(environment), true);
  for (const keys of Object.values(SCHEMA_KEYS).slice(0, 6)) assert.ok(keys.length > 0);
  assert.throws(() => validateQualificationEnvironment({ ...environment, surprise: true }), { code: 'INVALID_SCHEMA' });
  const coalescible = structuredClone(environment); coalescible.resourceAllocation.childCpuList = '0,1';
  assert.throws(() => validateQualificationEnvironment(coalescible), { code: 'INVALID_SCHEMA' });
  const sameCpu = structuredClone(environment); sameCpu.resourceAllocation.signalMonitorCpu = 6;
  assert.throws(() => validateQualificationEnvironment(sameCpu), { code: 'INVALID_SCHEMA' });
  const sentinel = structuredClone(environment); sentinel.powerThermalPolicy.powerSensorSetSha256 = 'not-applicable';
  assert.throws(() => validateQualificationEnvironment(sentinel), { code: 'INVALID_SCHEMA' });
});

test('canonical-byte parsing is lossless for UInt64 and rejects normalization opportunities', () => {
  const parsed = parseCanonicalJsonBytes(Buffer.from('{"maximum":18446744073709551615,"minimum":0}'));
  assert.equal(parsed.maximum, 18_446_744_073_709_551_615n); assert.equal(parsed.minimum, 0);
  assert.throws(() => parseCanonicalJsonBytes(Buffer.from('{ "minimum":0}')), { code: 'INVALID_SCHEMA' });
  assert.throws(() => parseCanonicalJsonBytes(Buffer.from('{"minimum":0,"minimum":0}')), { code: 'INVALID_SCHEMA' });
  assert.throws(() => parseCanonicalJsonBytes(Buffer.from('{"minimum":0}\n')), { code: 'INVALID_SCHEMA' });
});

test('coverage evidence binds every retained artifact and both latency limits', () => {
  const { manifest, artifacts } = coverageFixture();
  const digest = canonicalSha256(manifest);
  assert.equal(validateSignalMonitorCoverageEvidence(manifest, artifacts, { campaignId: 'campaign', monitorSha256: HASH, expectedDigest: digest }), true);
  const omitted = { ...artifacts }; delete omitted.rawEventsSha256;
  assert.throws(() => validateSignalMonitorCoverageEvidence(manifest, omitted, { expectedDigest: digest }), { code: 'INVALID_SCHEMA' });
  const changed = { ...artifacts, rawEventsSha256: Buffer.from('changed') };
  assert.throws(() => validateSignalMonitorCoverageEvidence(manifest, changed, { expectedDigest: digest }), { code: 'INVALID_SCHEMA' });
  assert.throws(() => validateSignalMonitorCoverageEvidence({ ...manifest, maximumEventLatencyNs: 1_000_001 }, artifacts), { code: 'INVALID_SCHEMA' });
  const typedMutation = structuredClone(parseCanonicalJsonBytes(artifacts.fixtureResultsSha256));
  typedMutation.fixtures[0].zeroLossCounters = false;
  const mutatedBytes = Buffer.from(canonicalJson(typedMutation));
  const mutatedArtifacts = { ...artifacts, fixtureResultsSha256: mutatedBytes };
  const mutatedManifest = { ...manifest, fixtureResultsSha256: crypto.createHash('sha256').update(mutatedBytes).digest('hex') };
  assert.throws(() => validateSignalMonitorCoverageEvidence(mutatedManifest, mutatedArtifacts), { code: 'INVALID_SCHEMA' });
});

test('unavailable signals and their retained evidence use a closed typed vocabulary', () => {
  assert.deepEqual(UNAVAILABLE_SIGNALS, ['power-cap-events', 'thermal-throttle-events']);
  const document = {
    schema: 'kstack.signal-unavailability-evidence/v1', environmentSha256: HASH, authorityConfigurationSha256: OTHER_HASH,
    signals: [{ signal: 'power-cap-events', reason: 'hardware-not-exposed', evidenceSha256: HASH }]
  };
  assert.equal(validateSignalUnavailabilityEvidence(document, { environmentSha256: HASH, authorityConfigurationSha256: OTHER_HASH, unavailableSignals: ['power-cap-events'] }), true);
  const unknown = structuredClone(document); unknown.signals[0].signal = 'fan-speed-events';
  assert.throws(() => validateSignalUnavailabilityEvidence(unknown), { code: 'INVALID_SCHEMA' });
  const bytes = Buffer.from(canonicalJson(document)); const attestation = attestationFixture(HASH);
  attestation.authority.configurationSha256 = OTHER_HASH; attestation.unavailableSignals = ['power-cap-events'];
  attestation.evidence = [...attestation.evidence, { kind: 'signal-unavailability', sha256: crypto.createHash('sha256').update(bytes).digest('hex') }].sort((left, right) => left.kind < right.kind ? -1 : 1);
  assert.equal(validateSubstrateAttestation(attestation, { ...attestationVerification(), signalUnavailabilityEvidence: bytes }), true);
  assert.throws(() => validateSubstrateAttestation(attestation, { ...attestationVerification(), signalUnavailabilityEvidence: Buffer.from(canonicalJson({ ...document, signals: [] })) }), { code: 'INVALID_SCHEMA' });
});

test('residual interference derivation enumerates every class and derives the exact applicable set', () => {
  const environment = environmentFixture(); const derivation = residualDerivationFixture(environment);
  assert.deepEqual(validateResidualInterferenceDerivation(derivation, { environmentSha256: canonicalSha256(environment), expectedApplicable: environment.residualExternalInterference, resctrlMode: 'enforced' }), ['dma', 'firmware-activity']);
  const abstract = structuredClone(derivation); abstract.classes[0].basis = 'operator-judgment';
  assert.throws(() => validateResidualInterferenceDerivation(abstract), { code: 'INVALID_SCHEMA' });
  const omitted = structuredClone(derivation); omitted.classes.pop();
  assert.throws(() => validateResidualInterferenceDerivation(omitted), { code: 'INVALID_SCHEMA' });
});

test('qualification row v3 recomputes all timing equations and rejects endpoint/stale mutations', () => {
  const { row, environment, coverage } = qualificationFixture();
  assert.equal(validateQualificationRow(row, { environment, coverageManifest: coverage.manifest, coverageArtifacts: coverage.artifacts }), true);
  const endpoint = structuredClone(row); endpoint.compliantRuns[0].endpointFixture = true;
  assert.throws(() => validateQualificationRow(endpoint), { code: 'INVALID_SCHEMA' });
  const observedFloor = structuredClone(row); observedFloor.timingPolicy.qualifiedMinimumElapsedNs += 1n;
  assert.throws(() => validateQualificationRow(observedFloor), { code: 'INVALID_SCHEMA' });
  const oldPair = structuredClone(row); oldPair.pairResults[0].minimumDifferenceNs = 2_100_000_000;
  assert.throws(() => validateQualificationRow(oldPair), { code: 'INVALID_SCHEMA' });
  const stale = structuredClone(row); stale.timingPolicy.derivationIdentifier = 'old';
  assert.throws(() => validateQualificationRow(stale), { code: 'INVALID_SCHEMA' });
});

function productionFixture(row, environment, overrides = {}) {
  const launch = 1_000_000_000n;
  const deadline = launch + row.timingPolicy.qualifiedLaunchToObservedExitUpperNs;
  const exit = launch + row.timingPolicy.qualifiedMinimumElapsedNs;
  return {
    schema: 'kstack.production-envelope/v3', executionId: 'execution', claimType: CLAIM_TYPE, claimSemantics: CLAIM_SEMANTICS,
    qualificationRowSha256: OTHER_HASH, environmentSha256: row.environmentSha256, substrateAttestationSha256: 'not-applicable',
    trustManifestSha256: HASH, monitorSha256: HASH, signalMonitorCoverageEvidenceSha256: row.signalMonitorCoverageEvidenceSha256,
    deadlineDetectorSha256: HASH, privilegeSeparationPolicySha256: HASH, runtimeSha256: HASH, launcherSha256: HASH,
    productionGraphSha256: HASH, prelaunchSnapshotSha256: HASH, postExitSnapshotSha256: HASH, sampleLogSha256: HASH,
    eventLogSha256: HASH, terminationEvidenceSha256: HASH, privilegeDropEvidenceSha256: HASH, launchState: 'spawned',
    tLaunchNs: launch, qualifiedMinimumElapsedNs: row.timingPolicy.qualifiedMinimumElapsedNs,
    qualifiedLaunchToArmUpperNs: row.timingPolicy.qualifiedLaunchToArmUpperNs,
    qualifiedExitToObservationUpperNs: row.timingPolicy.qualifiedExitToObservationUpperNs,
    qualifiedArmToCutoffCallUpperNs: row.timingPolicy.qualifiedArmToCutoffCallUpperNs,
    qualifiedCutoffCallToExitUpperNs: row.timingPolicy.qualifiedCutoffCallToExitUpperNs,
    qualifiedCutoffCallToObservedExitUpperNs: row.timingPolicy.qualifiedCutoffCallToObservedExitUpperNs,
    qualifiedLaunchToObservedExitUpperNs: row.timingPolicy.qualifiedLaunchToObservedExitUpperNs,
    parentObservedDeadlineNs: deadline, tTimerArmedNs: launch + 1n, tTimerfdReadNs: null, deadlineDetectionLatencyNs: null,
    tOsExitObservedNs: exit, elapsedLaunchToObservedExitNs: exit - launch, osStatus: 1, osSignal: 'none',
    oomDelta: 0, oomKillDelta: 0, oomGroupKillDelta: 0, cgroupKillCount: 0, supervisorTerminationCount: 0,
    terminatingSignalEventCount: 0, signalMonitorProducedEventCount: 0, signalMonitorConsumedEventCount: 0,
    signalMonitorReservationFailureCount: 0, signalMonitorMapFailureCount: 0, signalMonitorMaxEventLatencyNs: 0,
    tSignalMonitorFinalDrainStartNs: exit + 1n, tSignalMonitorFinalDrainEndNs: exit + 500_001n,
    signalMonitorDrainLatencyNs: 500_000, envelopeVerdict: 'within-qualified-envelope',
    timingVerdict: 'within-qualified-elapsed-window', exitSignatureVerdict: 'qualified-exit-signature',
    failureCodes: [], claimEligible: true, finalizationState: 'final', ...overrides
  };
}

test('production envelope enforces exact nullability, deadline reachability, and composed eligibility', () => {
  const { row, environment } = qualificationFixture();
  const record = productionFixture(row, environment);
  const attestationContext = { sentinelEvidence: { allRequiredThermalAndPowerSignalsExposed: true, continuouslyMonitoredThroughFinalDrain: true, unavailableSignalsEmpty: true, externalPolicySuppliesNoEnvironmentField: true } };
  assert.equal(validateProductionEnvelope(record, { qualificationRow: row, environment, attestationContext }), true);
  const early = productionFixture(row, environment, { tOsExitObservedNs: 1_005_000_000n, elapsedLaunchToObservedExitNs: 5_000_000n, timingVerdict: 'before-qualified-minimum', failureCodes: ['PARENT_OBSERVED_EXIT_TOO_EARLY'], claimEligible: false, tSignalMonitorFinalDrainStartNs: 1_005_000_001n, tSignalMonitorFinalDrainEndNs: 1_005_500_001n });
  assert.equal(validateProductionEnvelope(early), true);
  const earlyMissingCode = { ...early, failureCodes: [] };
  assert.throws(() => validateProductionEnvelope(earlyMissingCode), { code: 'INVALID_SCHEMA' });
  const reachedWithoutWake = productionFixture(row, environment, { tOsExitObservedNs: null, elapsedLaunchToObservedExitNs: null, osStatus: null, timingVerdict: 'after-parent-observed-deadline', exitSignatureVerdict: 'not-evaluated', failureCodes: ['PARENT_OBSERVED_DEADLINE_EXCEEDED'], claimEligible: false });
  assert.throws(() => validateProductionEnvelope(reachedWithoutWake), { code: 'INVALID_SCHEMA' });
  const unknown = { ...record, oldEndpointFixtureIndex: 1 };
  assert.throws(() => validateProductionEnvelope(unknown), { code: 'INVALID_SCHEMA' });
});

test('prelaunch and spawn-failed production states are fail-closed with exact nulls', () => {
  const { row, environment } = qualificationFixture();
  const common = productionFixture(row, environment);
  const prelaunch = {
    ...common, launchState: 'prelaunch-rejected', tLaunchNs: null, parentObservedDeadlineNs: null, tTimerArmedNs: null,
    tTimerfdReadNs: null, deadlineDetectionLatencyNs: null, tOsExitObservedNs: null, elapsedLaunchToObservedExitNs: null,
    osStatus: null, osSignal: 'none', postExitSnapshotSha256: 'not-applicable', sampleLogSha256: 'not-applicable',
    eventLogSha256: 'not-applicable', terminationEvidenceSha256: 'not-applicable', privilegeDropEvidenceSha256: 'not-applicable',
    oomDelta: 0, oomKillDelta: 0, oomGroupKillDelta: 0, cgroupKillCount: 0, supervisorTerminationCount: 0,
    terminatingSignalEventCount: 0, signalMonitorProducedEventCount: 0, signalMonitorConsumedEventCount: 0,
    signalMonitorReservationFailureCount: 0, signalMonitorMapFailureCount: 0, signalMonitorMaxEventLatencyNs: null,
    tSignalMonitorFinalDrainStartNs: null, tSignalMonitorFinalDrainEndNs: null, signalMonitorDrainLatencyNs: null,
    envelopeVerdict: 'outside-qualified-envelope', timingVerdict: 'not-evaluated', exitSignatureVerdict: 'not-evaluated',
    failureCodes: ['DEADLINE_DETECTOR_SETUP_FAILED', 'PRELAUNCH_REJECTED'], claimEligible: false
  };
  assert.equal(validateProductionEnvelope(prelaunch), true);
  const missing = { ...prelaunch, failureCodes: ['DEADLINE_DETECTOR_SETUP_FAILED'] };
  assert.throws(() => validateProductionEnvelope(missing), { code: 'INVALID_SCHEMA' });
  const spawnFailed = { ...prelaunch, launchState: 'spawn-failed', tLaunchNs: 1_000_000_000n, parentObservedDeadlineNs: 1_000_000_000n + row.timingPolicy.qualifiedLaunchToObservedExitUpperNs, prelaunchSnapshotSha256: HASH, failureCodes: ['SPAWN_FAILED_AFTER_LAUNCH'] };
  assert.equal(validateProductionEnvelope(spawnFailed), true);
});

test('attestation promotion requires three-way equality and sentinel re-satisfaction', () => {
  const { row, environment } = qualificationFixture();
  const production = productionFixture(row, environment);
  const strict = { allRequiredThermalAndPowerSignalsExposed: true, continuouslyMonitoredThroughFinalDrain: true, unavailableSignalsEmpty: true, externalPolicySuppliesNoEnvironmentField: true };
  assert.equal(validateAttestationPromotion({ production, row, environment, sentinelEvidence: strict }), true);
  assert.throws(() => validateAttestationPromotion({ production: { ...production, substrateAttestationSha256: HASH }, row, environment, sentinelEvidence: strict }), { code: 'ATTESTATION_INVALIDATED' });
  assert.throws(() => validateAttestationPromotion({ production, row, environment, sentinelEvidence: { ...strict, continuouslyMonitoredThroughFinalDrain: false } }), { code: 'ATTESTATION_INVALIDATED' });
});

function attestationFixture(environmentSha256) {
  return {
    schema: 'kstack.substrate-attestation/v2', environmentSha256,
    subject: {
      hostIdentitySha256: HASH, osDistribution: 'linux', osVersion: '1', kernelBuild: 'kernel', architecture: 'x86_64',
      cpuVendor: 'vendor', cpuFamily: 1, cpuModel: 2, cpuStepping: 3, microcode: '1', physicalCoreCount: 4,
      logicalCpuCount: 8, numaTopologySha256: HASH, substrateKind: 'bare-metal', hypervisorOrRuntime: 'not-applicable',
      hypervisorOrRuntimeVersion: 'not-applicable', machineImageSha256: 'not-applicable', nestedVirtualization: false
    },
    authority: { kind: 'controller', deviceIdentitySha256: HASH, controllerBinarySha256: HASH, controllerVersion: '1', configurationSha256: HASH, trustKeySha256: HASH },
    enforcedPolicy: {
      powerProfile: 'performance', governor: 'performance', minimumFrequencyKHz: 1, maximumFrequencyKHz: 2,
      turboEnabled: false, powerCapMilliwatts: 1000, cpusetMask: '0-7', cgroupCpuQuotaMicros: 'max',
      cgroupCpuPeriodMicros: 100_000, cgroupCpuWeight: 100, memoryLimitBytes: 'max', swapLimitBytes: 'max',
      numaBinding: 'strict', schedulerClass: 'SCHED_FIFO', niceValue: -1, guestMayOverride: false
    },
    unavailableSignals: [],
    evidence: [
      { kind: 'controller-config', sha256: HASH }, { kind: 'platform-inventory', sha256: HASH }, { kind: 'policy-lock', sha256: HASH }
    ],
    validity: { notBefore: '2026-08-22T00:00:00Z', notAfter: '2026-08-24T00:00:00Z' },
    claims: { subjectMatchesEnvironment: true, policyApplied: true, policyLockedForValidityInterval: true, guestCannotOverride: true, policyChangeInvalidatesAttestation: true },
    policyGeneration: 1, revocationEpoch: 1, revocationAuthoritySha256: HASH
  };
}

function attestationVerification() {
  return {
    signature: Buffer.alloc(64), publicKey: Buffer.alloc(32), verifySignature: () => true,
    now: new Date('2026-08-23T12:00:00Z'), trustKeyState: 'active', trustManifestVerified: true,
    trustManifestFresh: true, trustManifestMonotonic: true,
    policyStream: {
      subscribedBeforeLaunch: true, continuousThroughFinalDrain: true, eventObserved: false, gapObserved: false,
      disconnected: false, maximumHeartbeatGapNs: 10_000_000, generationMatches: true, revocationEpochMatches: true,
      controllerMatches: true, lockMatches: true, postExitRereadEqual: true
    }
  };
}

test('digest attestation validates its closed object, trust manifest, stream, and three-way promotion', () => {
  const { row, environment } = qualificationFixture();
  const attestation = attestationFixture(row.environmentSha256);
  const verification = attestationVerification();
  assert.equal(validateSubstrateAttestation(attestation, { ...verification, expectedEnvironmentSha256: row.environmentSha256 }), true);
  const digest = canonicalSha256(attestation);
  const digestEnvironment = { ...environment, substrateAttestationSha256: digest };
  const digestRow = { ...row, substrateAttestationSha256: digest };
  const production = { ...productionFixture(row, environment), substrateAttestationSha256: digest };
  assert.equal(validateAttestationPromotion({ production, row: digestRow, environment: digestEnvironment, attestation, attestationVerification: verification }), true);
  const gap = { ...verification, policyStream: { ...verification.policyStream, maximumHeartbeatGapNs: 10_000_001 } };
  assert.throws(() => validateSubstrateAttestation(attestation, gap), { code: 'INVALID_SCHEMA' });
  assert.throws(() => validateAttestationPromotion({ production, row: digestRow, environment: digestEnvironment, attestation, attestationVerification: { ...verification, trustManifestFresh: false } }), { code: 'ATTESTATION_INVALIDATED' });
});

test('clock qualification retains exactly 1000 brackets and derives bounded uncertainty', () => {
  const handshakes = Array.from({ length: 1_000 }, (_, index) => {
    const before = 1_000_000n + BigInt(index) * 20n;
    return { pBeforeNs: before, childNs: before + 5n, pAfterNs: before + 10n, bracketWidthNs: 10n };
  });
  const contract = {
    declaredClockTickNs: 1, parentClockId: 'CLOCK_MONOTONIC', childClockId: 'CLOCK_MONOTONIC',
    parentUnits: 'integer-nanoseconds', childUnits: 'integer-nanoseconds', conversionApplied: false, perProcessOrigin: false,
    handshakes, clockCorrelationUncertaintyNs: 12, boottimeMinusMonotonicPrelaunchNs: 100,
    boottimeMinusMonotonicFinalDrainNs: 101, clocksourceStable: true, resolutionStable: true,
    suspendObserved: false, clockSetObserved: false
  };
  assert.deepEqual(validateClockContract(contract), { clockCorrelationUncertaintyNs: 12n, minimumBracketWidthNs: 10n });
  assert.throws(() => validateClockContract({ ...contract, handshakes: handshakes.slice(1) }), { code: 'CLOCK_CONTRACT_VIOLATION' });
  const inverted = structuredClone(contract); inverted.handshakes[500].childNs = inverted.handshakes[500].pAfterNs + 1n;
  assert.throws(() => validateClockContract(inverted), { code: 'CLOCK_CONTRACT_VIOLATION' });
  assert.throws(() => validateClockContract({ ...contract, resolutionStable: false }), { code: 'CLOCK_CONTRACT_VIOLATION' });
});

test('PSI and utilization arithmetic pass inclusive thresholds and reject one unit above', () => {
  const interval = (delta) => ({ totalUsStart: 10n, totalUsEnd: 10n + BigInt(delta), monoNsStart: 1_000n, monoNsEnd: 101_000n });
  assert.equal(stallBasisPoints(interval(5)), 500n);
  assert.equal(utilizationBasisPoints({ usageUsStart: 0, usageUsEnd: 5, monoNsStart: 1_000, monoNsEnd: 101_000, cpusetSize: 1, quotaMicros: 'max' }), 500n);
  const epoch = {
    cpuSome: interval(5), memorySome: interval(1), memoryFull: interval(0),
    utilization: { usageUsStart: 0, usageUsEnd: 5, monoNsStart: 1_000, monoNsEnd: 101_000, cpusetSize: 1, quotaMicros: 'max' },
    foreignRunnableTasks: 0, runQueueDepth: 1, sampleGap: false, identityStable: true, counterReset: false
  };
  assert.deepEqual(evaluateContinuousEpoch(epoch).failureCodes, []);
  assert.deepEqual(evaluateContinuousEpoch({ ...epoch, cpuSome: interval(6) }).failureCodes, ['PSI_STALL_THRESHOLD_EXCEEDED']);
  assert.deepEqual(evaluateContinuousEpoch({ ...epoch, memorySome: interval(2), memoryFull: interval(1) }).failureCodes, ['PSI_STALL_THRESHOLD_EXCEEDED']);
  assert.deepEqual(evaluateContinuousEpoch({ ...epoch, utilization: { ...epoch.utilization, usageUsEnd: 6 } }).failureCodes, ['ADMISSION_THRESHOLD_EXCEEDED']);
  assert.deepEqual(evaluateContinuousEpoch({ ...epoch, cpuSome: { ...interval(0), monoNsEnd: 1_999n } }).failureCodes, ['MONITOR_GAP']);
});

test('prelaunch admission uses exact inclusive limits and accumulates fail-closed codes', () => {
  const boundary = {
    allocatedCpuUtilizationBasisPoints: 500, foreignRunnableTasks: 0, runQueueDepth: 1,
    cpuPsiSomeAvg10BasisPoints: 50, memoryPsiSomeAvg10BasisPoints: 50,
    memoryPsiFullAvg10BasisPoints: 10, memAvailableBytes: 2_147_483_648, identityStable: true
  };
  assert.equal(evaluatePrelaunchAdmission(boundary).admitted, true);
  const rejected = evaluatePrelaunchAdmission({ ...boundary, allocatedCpuUtilizationBasisPoints: 501, foreignRunnableTasks: 1 });
  assert.deepEqual(rejected.failureCodes, ['ADMISSION_THRESHOLD_EXCEEDED', 'FOREIGN_TASK_OBSERVED', 'PRELAUNCH_REJECTED']);
});

test('epoll handling invokes waitid first and uses stored timestamps independent of ready-set order', async () => {
  const calls = [];
  const timingPolicy = { qualifiedMinimumElapsedNs: 100n, qualifiedLaunchToObservedExitUpperNs: 500n };
  const operations = {
    waitidNoHang: async () => { calls.push('waitid'); return { available: true, osStatus: 1, osSignal: 'none' }; },
    monotonicNowNs: async () => { calls.push('clock'); return 1_500n; },
    readTimerfdAndTimestamp: async () => { calls.push('timerfd'); return 1_500n; },
    reapPidfd: async () => { calls.push('reap'); }
  };
  const observed = await observeDeadlineReadySet({ operations, timingPolicy, tLaunchNs: 1_000n, readySources: ['timerfd', 'pidfd'] });
  assert.equal(observed.timingVerdict, 'within-qualified-elapsed-window');
  assert.deepEqual(calls, ['waitid', 'clock', 'timerfd', 'reap']);
});

test('stable signal drain requires identical consecutive snapshots and producer equality', async () => {
  let clock = 100n;
  let snapshots = 0;
  const snapshot = { linksStable: true, identityStable: true, everyOnlineCpuRepresented: true, reservationFailureCount: 0, mapFailureCount: 0, producedCount: { 0: 1 }, consumedCount: { 0: 1 } };
  const operations = {
    monotonicNowNs: async () => { const value = clock; clock += 500_000n; return value; },
    snapshotProducerState: async () => { snapshots += 1; return structuredClone(snapshot); },
    drainRetainedEvents: async () => {}
  };
  const result = await drainSignalMonitor(operations);
  assert.equal(snapshots, 2); assert.equal(result.signalMonitorDrainLatencyNs, 500_000n);
  await assert.rejects(() => drainSignalMonitor({ ...operations, snapshotProducerState: async () => ({ ...snapshot, producedCount: { 0: 2 } }) }, { maximumIterations: 2 }), { code: 'MONITOR_GAP' });
});

test('requalification ledger caps result-bearing attempts and requires signed causal remediation', () => {
  const first = { attemptNumber: 1, previousAttemptSha256: '0'.repeat(64), resultBearing: true };
  const firstDigest = canonicalSha256(first);
  const remediation = { independentReviewerSignatureValid: true, semanticDiffSha256: HASH, failedAssertion: 'failed', causalMechanism: 'cause', directionalFalsifiablePrediction: 'prediction', materiallyCausal: true, weakensPolicy: false, unrelatedMaterialChange: false };
  const second = { attemptNumber: 2, previousAttemptSha256: firstDigest, resultBearing: true, remediation };
  assert.equal(validateRequalificationLedger([first, second]).resultBearingAttempts, 2);
  assert.throws(() => validateRequalificationLedger([first, { ...second, remediation: { ...remediation, weakensPolicy: true } }]), { code: 'REQUALIFICATION_LEDGER_INVALID' });
});

test('durable finalization releases a token only after reread verification', async () => {
  const { row, environment } = qualificationFixture();
  const record = productionFixture(row, environment);
  let retained;
  const operations = {
    createSameFilesystemTemporary: async () => 'temp', writeAll: async (_target, bytes) => { retained = Buffer.from(bytes); },
    syncFile: async () => {}, installNoReplace: async () => {}, syncDirectory: async () => {},
    readFinal: async () => retained, signToken: async (payload) => payload
  };
  const result = await finalizeProductionRecord(record, operations);
  assert.equal(result.finalized, true); assert.equal(result.token.claimSemantics, CLAIM_SEMANTICS); assert.equal(result.token.recordSha256, result.recordSha256);
  const failed = await finalizeProductionRecord(record, { ...operations, readFinal: async () => Buffer.from('tampered') });
  assert.equal(failed.finalized, false); assert.equal(failed.token, null); assert.deepEqual(failed.failureCodes, ['RECORD_FINALIZATION_FAILED']);
});

test('claim surfaces accept only outcome semantics and reject causal mechanism wording', () => {
  assert.equal(validateOutcomeClaimSurfaces([CLAIM_TYPE, CLAIM_SEMANTICS]), true);
  assert.throws(() => validateOutcomeClaimSurfaces(['cutoff fired']), { code: 'CLAIM_SEMANTICS_INVALID' });
  assert.throws(() => validateOutcomeClaimSurfaces(['termination-by-parent-deadline']), { code: 'CLAIM_SEMANTICS_INVALID' });
});

test('carried graph, analyzer, one-shot, and bootstrap-negative safeguards fail closed', () => {
  const tools = [...LOGICAL_TOOL_ALLOWLIST];
  const evidence = {
    productionGraphSha256: HASH, instrumentedCompliantGraphSha256: OTHER_HASH, instrumentedControlGraphSha256: 'd'.repeat(64),
    productionLaunchGraphSha256: HASH, erasedCompliantGraphSha256: HASH, normalizedProductionOperationsEqual: true,
    probeManifestOnlyAdmittedShapes: true, probeCardinalityAndWorkBounded: true, compliantCutoffCallbackEntryCount: 1,
    callbackEntryToExitSeamOrdinalDelta: 1, controlDifferenceCount: 1, controlDifferenceKind: 'single-unref-call',
    controlDiagnosticCode: 'REFD_TIMER_LIFETIME', controlDiagnosticCount: 1,
    bootstrapNegatives: Array.from({ length: 4 }, () => ({ exitStatus: 78, implementationRecordCount: 0, timerCreationRecordCount: 0, exitCodeRecordCount: 0, statusOneRouteRecordCount: 0, captureGateTranscriptExact: true })),
    cutoffInitiallyRefd: true, cutoffBindingImmutable: true, cutoffMutationCount: 0, drainInitiallyRefd: true,
    drainClearCount: 1, drainClearAfterCommit: true, capturedIntrinsicIdentityExact: true, terminalTailShapeExact: true,
    exitCodeAssignmentCount: 2, otherExitCodeAccessCount: 0, callbackReadsEpisodeState: false, callbackWriteRetryCount: 0,
    winnerIndependentLastResortOneShot: true, maximumTerminationEpisodes: 1,
    statusRegistry: [0, 1, 2, 70, 71, 74, 75, 129, 130, 143], logicalToolAllowlist: tools,
    analyzerCompleteOverLaunchClosure: true, declarationGlobExpansionBidirectional: true,
    listenerOrderAssertionsPass: true, statusFidelityFixturesPass: true, injectionBoundsPass: true,
    compliantRunCount: 10, controlRunCount: 10, retryCount: 0, replacementCount: 0, selectionApplied: false
  };
  assert.equal(validateGraphAndTerminationEvidence(evidence), true);
  assert.throws(() => validateGraphAndTerminationEvidence({ ...evidence, logicalToolAllowlist: tools.map((tool, index) => index === 0 ? 'captured-unknown-operation' : tool).sort() }), { code: 'TERMINATION_CONSTRUCTION_INVALID' });
  assert.throws(() => validateGraphAndTerminationEvidence({ ...evidence, cutoffMutationCount: 1 }), { code: 'TERMINATION_CONSTRUCTION_INVALID' });
  assert.throws(() => validateGraphAndTerminationEvidence({ ...evidence, bootstrapNegatives: evidence.bootstrapNegatives.slice(1) }), { code: 'TERMINATION_CONSTRUCTION_INVALID' });
});

test('CPU/isolation/resctrl/policy evidence accumulates independent drift and event codes', () => {
  const environment = environmentFixture();
  const evidence = {
    completeSmtSiblingAllocation: true, unallocatedChildSmtSiblingsOffline: true, irqAffinityStable: true,
    housekeepingAllocationStable: true, cpusetPartitionStable: true, cpuHotplugObserved: false,
    foreignRunnableTaskMaximum: 0, allocatedRunQueueMaximum: 1, deadlineDetectorCpu: 6, signalMonitorCpu: 7,
    kernelWorkerAllowlistStable: true, applicableResidualExternalInterference: ['dma', 'firmware-activity'],
    residualInterferenceDerivation: residualDerivationFixture(environment),
    resctrlConfigurationSha256: HASH, thermalEventObserved: false, powerEventObserved: false, policyEventObserved: false,
    policyStreamContinuous: true, maximumPolicyHeartbeatGapNs: 10_000_000, postExitPolicyRereadEqual: true
  };
  assert.equal(validateIsolationAndPolicyEvidence(environment, evidence).pass, true);
  const failed = validateIsolationAndPolicyEvidence(environment, { ...evidence, cpuHotplugObserved: true, applicableResidualExternalInterference: ['dma'], thermalEventObserved: true });
  assert.deepEqual(failed.failureCodes, ['ENVIRONMENT_DRIFT', 'MONITOR_GAP', 'THERMAL_OR_POWER_EVENT']);
});
