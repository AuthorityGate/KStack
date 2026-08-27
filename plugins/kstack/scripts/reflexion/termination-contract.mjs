import crypto from 'node:crypto';

export const UINT64_MAX = 18_446_744_073_709_551_615n;

export const TERMINATION_CONSTANTS = Object.freeze({
  childArmToCutoffCallMinimumNs: 2_400_000_000n,
  childArmToCutoffCallMaximumNs: 3_200_000_000n,
  childCutoffCallToExitMaximumNs: 250_000_000n,
  controlFirstReturnToExitMaximumNs: 500_000_000n,
  segmentPolicyMarginNs: 50_000_000n,
  minimumElapsedPolicyMarginNs: 100_000_000n,
  minimumElapsedHardFloorNs: 2_250_000_000n,
  qualifiedCompositeMaximumNs: 4_750_000_000n,
  deadlineDetectionLatencyLimitNs: 1_000_000n,
  signalMonitorEventLatencyLimitNs: 1_000_000n,
  signalMonitorDrainLatencyLimitNs: 1_000_000n,
  watchdogNs: 5_000_000_000n,
  pairMinimumDifferenceNs: 1_900_000_000n
});

export const CLAIM_TYPE = 'observed-qualified-status-exit-within-admitted-elapsed-window/v1';
export const CLAIM_SEMANTICS = 'outcome-only-no-cutoff-causation';

// Closed analyzer-operation vocabulary. Round 22 retained a seven-logical-tool
// requirement without spelling out the values; these names bind the seven
// captured operations that the termination construction actually admits.
export const LOGICAL_TOOL_ALLOWLIST = Object.freeze([
  'captured-clear-timeout',
  'captured-process-exit',
  'captured-process-exit-code-write',
  'captured-process-on',
  'captured-process-remove-listener',
  'captured-process-time-bigint',
  'captured-set-timeout'
]);

export const FAILURE_CODES = Object.freeze([
  'PRELAUNCH_REJECTED',
  'ENVIRONMENT_DRIFT',
  'ADMISSION_THRESHOLD_EXCEEDED',
  'PSI_STALL_THRESHOLD_EXCEEDED',
  'FOREIGN_TASK_OBSERVED',
  'THERMAL_OR_POWER_EVENT',
  'MONITOR_GAP',
  'ATTESTATION_INVALIDATED',
  'POSTEXIT_CHECK_FAILED',
  'DEADLINE_DETECTOR_SETUP_FAILED',
  'DEADLINE_ARMING_TOO_LATE',
  'CHILD_IDENTITY_VALIDATION_FAILED',
  'CLOCK_CONTRACT_VIOLATION',
  'SPAWN_FAILED_AFTER_LAUNCH',
  'CHILD_PRIVILEGE_DROP_FAILED',
  'PARENT_OBSERVED_EXIT_TOO_EARLY',
  'PARENT_OBSERVED_DEADLINE_EXCEEDED',
  'OS_EXIT_OBSERVATION_INVALID',
  'EXIT_SIGNATURE_MISMATCH',
  'UNRELATED_TERMINATION_EVIDENCE',
  'RECORD_FINALIZATION_FAILED'
]);

export const TERMINATING_SIGNALS = Object.freeze([
  'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
  'SIGFPE', 'SIGKILL', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE',
  'SIGALRM', 'SIGTERM', 'SIGSTKFLT', 'SIGXCPU', 'SIGXFSZ', 'SIGVTALRM',
  'SIGPROF', 'SIGIO', 'SIGPWR', 'SIGSYS'
]);

export class TerminationSafetyError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'TerminationSafetyError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new TerminationSafetyError(code, message);
}

export function asUInt64(value, label = 'value', { positive = false } = {}) {
  let result;
  if (typeof value === 'bigint') result = value;
  else if (Number.isSafeInteger(value)) result = BigInt(value);
  else fail('INVALID_UINT64', `${label} must be an exactly represented UInt64`);
  if (result < 0n || result > UINT64_MAX || (positive && result === 0n)) {
    fail('INVALID_UINT64', `${label} is outside its UInt64 range`);
  }
  return result;
}

export function checkedAdd(left, right, label = 'sum') {
  const a = asUInt64(left, `${label}.left`);
  const b = asUInt64(right, `${label}.right`);
  if (a > UINT64_MAX - b) fail('CHECKED_ARITHMETIC_FAILED', `${label} overflows UInt64`);
  return a + b;
}

export function checkedSubtract(left, right, label = 'difference') {
  const a = asUInt64(left, `${label}.left`);
  const b = asUInt64(right, `${label}.right`);
  if (a < b) fail('CHECKED_ARITHMETIC_FAILED', `${label} would be negative`);
  return a - b;
}

export function checkedMultiply(left, right, label = 'product') {
  const a = asUInt64(left, `${label}.left`);
  const b = asUInt64(right, `${label}.right`);
  if (a !== 0n && b > UINT64_MAX / a) fail('CHECKED_ARITHMETIC_FAILED', `${label} overflows UInt64`);
  return a * b;
}

export function roundDownToClockTick(value, tick) {
  const x = asUInt64(value, 'roundDown.value');
  const resolution = asUInt64(tick, 'roundDown.tick', { positive: true });
  return checkedMultiply(x / resolution, resolution, 'roundDown.result');
}

export function roundUpToClockTick(value, tick) {
  const x = asUInt64(value, 'roundUp.value');
  const resolution = asUInt64(tick, 'roundUp.tick', { positive: true });
  const quotient = x / resolution;
  if (x % resolution === 0n) return x;
  return checkedMultiply(checkedAdd(quotient, 1n, 'roundUp.quotient'), resolution, 'roundUp.result');
}

function maximum(values, label) {
  if (!Array.isArray(values) || values.length === 0) fail('QUALIFICATION_POPULATION_INVALID', `${label} must be nonempty`);
  return values.map((value, index) => asUInt64(value, `${label}[${index}]`)).reduce((left, right) => left > right ? left : right);
}

function minimum(values, label) {
  if (!Array.isArray(values) || values.length === 0) fail('QUALIFICATION_POPULATION_INVALID', `${label} must be nonempty`);
  return values.map((value, index) => asUInt64(value, `${label}[${index}]`)).reduce((left, right) => left < right ? left : right);
}

function exactTen(records, label) {
  if (!Array.isArray(records) || records.length !== 10) fail('QUALIFICATION_POPULATION_INVALID', `${label} must contain exactly ten runs`);
  records.forEach((record, index) => {
    if (asUInt64(record?.runIndex, `${label}[${index}].runIndex`) !== BigInt(index + 1)) {
      fail('QUALIFICATION_POPULATION_INVALID', `${label} must use positional run indices`);
    }
  });
}

export function deriveQualificationTiming({ declaredClockTickNs, clockCorrelationUncertaintyNs, compliantRuns, controlRuns }) {
  const tick = asUInt64(declaredClockTickNs, 'declaredClockTickNs', { positive: true });
  const uncertainty = asUInt64(clockCorrelationUncertaintyNs, 'clockCorrelationUncertaintyNs', { positive: true });
  if (uncertainty > TERMINATION_CONSTANTS.deadlineDetectionLatencyLimitNs / 10n) {
    fail('CLOCK_CONTRACT_VIOLATION', 'clock correlation uncertainty exceeds 100000 ns');
  }
  exactTen(compliantRuns, 'compliantRuns');
  exactTen(controlRuns, 'controlRuns');

  const launchToArm = [];
  const exitToObserved = [];
  const elapsed = [];
  const armToCall = [];
  const callToExit = [];
  const pairs = [];
  for (let index = 0; index < 10; index += 1) {
    const compliant = compliantRuns[index];
    const control = controlRuns[index];
    const compliantDuration = asUInt64(compliant.armToCutoffCallNs, `compliantRuns[${index}].armToCutoffCallNs`);
    const terminalTail = asUInt64(compliant.cutoffCallToExitNs, `compliantRuns[${index}].cutoffCallToExitNs`);
    const controlDuration = asUInt64(control.firstReturnToExitNs, `controlRuns[${index}].firstReturnToExitNs`);
    if (compliantDuration < TERMINATION_CONSTANTS.childArmToCutoffCallMinimumNs || compliantDuration > TERMINATION_CONSTANTS.childArmToCutoffCallMaximumNs) {
      fail('QUALIFICATION_RUN_INVALID', `compliant run ${index + 1} is outside the declared arm-to-call interval`);
    }
    if (terminalTail > TERMINATION_CONSTANTS.childCutoffCallToExitMaximumNs || controlDuration > TERMINATION_CONSTANTS.controlFirstReturnToExitMaximumNs) {
      fail('QUALIFICATION_RUN_INVALID', `run ${index + 1} exceeds a declared terminal interval`);
    }
    if (compliant.osStatus !== 1 || compliant.osSignal !== 'none' || compliant.capturedExitInvocationCount !== 2 || compliant.callbackEntryToExitSeamOrdinalDelta !== 1) {
      fail('QUALIFICATION_RUN_INVALID', `compliant run ${index + 1} has an invalid exit signature`);
    }
    if (control.osStatus !== 70 || control.osSignal !== 'none' || control.capturedExitInvocationCount !== 1 || control.cutoffCallbackEntryCount !== 0) {
      fail('QUALIFICATION_RUN_INVALID', `control run ${index + 1} has an invalid exit signature`);
    }
    launchToArm.push(asUInt64(compliant.launchToArmNs, `compliantRuns[${index}].launchToArmNs`));
    exitToObserved.push(asUInt64(compliant.exitToObservedExitNs, `compliantRuns[${index}].exitToObservedExitNs`));
    elapsed.push(asUInt64(compliant.elapsedLaunchToObservedExitNs, `compliantRuns[${index}].elapsedLaunchToObservedExitNs`, { positive: true }));
    armToCall.push(compliantDuration);
    callToExit.push(terminalTail);
    const differenceNs = checkedSubtract(compliantDuration, controlDuration, `pairResults[${index}].differenceNs`);
    if (differenceNs < TERMINATION_CONSTANTS.pairMinimumDifferenceNs) fail('QUALIFICATION_PAIR_INVALID', `pair ${index + 1} is below 1900000000 ns`);
    pairs.push(Object.freeze({
      runIndex: BigInt(index + 1), compliantRunIndex: BigInt(index + 1), controlRunIndex: BigInt(index + 1),
      dCompliantNs: compliantDuration, dControlNs: controlDuration, differenceNs,
      minimumDifferenceNs: TERMINATION_CONSTANTS.pairMinimumDifferenceNs, pass: true
    }));
  }

  const lowerOperand = checkedSubtract(
    checkedSubtract(TERMINATION_CONSTANTS.childArmToCutoffCallMinimumNs, uncertainty, 'qualifiedFloor.uncertainty'),
    TERMINATION_CONSTANTS.minimumElapsedPolicyMarginNs,
    'qualifiedFloor.margin'
  );
  const qualifiedMinimumElapsedNs = roundDownToClockTick(lowerOperand, tick);
  if (qualifiedMinimumElapsedNs < TERMINATION_CONSTANTS.minimumElapsedHardFloorNs) fail('QUALIFICATION_TIMING_INVALID', 'derived floor is below the hard floor');

  const observedLaunchToArmMaximumNs = maximum(launchToArm, 'launchToArm');
  const observedExitToObservedExitMaximumNs = maximum(exitToObserved, 'exitToObserved');
  const qualifiedLaunchToArmUpperNs = roundUpToClockTick(
    checkedAdd(checkedAdd(observedLaunchToArmMaximumNs, uncertainty, 'launchUpper.uncertainty'), TERMINATION_CONSTANTS.segmentPolicyMarginNs, 'launchUpper.margin'), tick
  );
  const qualifiedExitToObservationUpperNs = roundUpToClockTick(
    checkedAdd(checkedAdd(observedExitToObservedExitMaximumNs, uncertainty, 'exitUpper.uncertainty'), TERMINATION_CONSTANTS.segmentPolicyMarginNs, 'exitUpper.margin'), tick
  );
  const qualifiedArmToCutoffCallUpperNs = roundUpToClockTick(TERMINATION_CONSTANTS.childArmToCutoffCallMaximumNs, tick);
  const qualifiedCutoffCallToExitUpperNs = roundUpToClockTick(TERMINATION_CONSTANTS.childCutoffCallToExitMaximumNs, tick);
  const qualifiedCutoffCallToObservedExitUpperNs = roundUpToClockTick(
    checkedAdd(TERMINATION_CONSTANTS.childCutoffCallToExitMaximumNs, qualifiedExitToObservationUpperNs, 'callToObservedUpper'), tick
  );
  const qualifiedLaunchToObservedExitUpperNs = checkedAdd(
    checkedAdd(qualifiedLaunchToArmUpperNs, qualifiedArmToCutoffCallUpperNs, 'compositeUpper.launchAndArm'),
    qualifiedCutoffCallToObservedExitUpperNs,
    'compositeUpper.total'
  );
  if (qualifiedLaunchToObservedExitUpperNs > TERMINATION_CONSTANTS.qualifiedCompositeMaximumNs) {
    fail('QUALIFICATION_TIMING_INVALID', 'derived ceiling exceeds 4750000000 ns');
  }
  const lowerHeadrooms = elapsed.map((value, index) => checkedSubtract(value, qualifiedMinimumElapsedNs, `lowerHeadroom[${index}]`));
  const upperHeadrooms = elapsed.map((value, index) => checkedSubtract(qualifiedLaunchToObservedExitUpperNs, value, `upperHeadroom[${index}]`));

  return Object.freeze({
    declaredClockTickNs: tick,
    clockCorrelationUncertaintyLimitNs: 100_000n,
    clockCorrelationUncertaintyNs: uncertainty,
    segmentPolicyMarginNs: TERMINATION_CONSTANTS.segmentPolicyMarginNs,
    minimumElapsedPolicyMarginNs: TERMINATION_CONSTANTS.minimumElapsedPolicyMarginNs,
    minimumElapsedHardFloorNs: TERMINATION_CONSTANTS.minimumElapsedHardFloorNs,
    childArmToCutoffCallMinimumNs: TERMINATION_CONSTANTS.childArmToCutoffCallMinimumNs,
    childArmToCutoffCallMaximumNs: TERMINATION_CONSTANTS.childArmToCutoffCallMaximumNs,
    childCutoffCallToExitMaximumNs: TERMINATION_CONSTANTS.childCutoffCallToExitMaximumNs,
    controlFirstReturnToExitMaximumNs: TERMINATION_CONSTANTS.controlFirstReturnToExitMaximumNs,
    pairMinimumDifferenceNs: TERMINATION_CONSTANTS.pairMinimumDifferenceNs,
    observedLaunchToArmMaximumNs,
    observedExitToObservedExitMaximumNs,
    observedMinimumElapsedNs: minimum(elapsed, 'elapsed'),
    observedArmToCutoffCallMinimumNs: minimum(armToCall, 'armToCall'),
    observedArmToCutoffCallMaximumNs: maximum(armToCall, 'armToCall'),
    observedCutoffCallToExitMaximumNs: maximum(callToExit, 'callToExit'),
    qualifiedArmToCutoffCallLowerNs: qualifiedMinimumElapsedNs,
    qualifiedMinimumElapsedNs,
    qualifiedLaunchToArmUpperNs,
    qualifiedExitToObservationUpperNs,
    qualifiedArmToCutoffCallUpperNs,
    qualifiedCutoffCallToExitUpperNs,
    qualifiedCutoffCallToObservedExitUpperNs,
    qualifiedLaunchToObservedExitUpperNs,
    minimumLowerHeadroomNs: minimum(lowerHeadrooms, 'lowerHeadrooms'),
    minimumUpperHeadroomNs: minimum(upperHeadrooms, 'upperHeadrooms'),
    deadlineDetectionLatencyLimitNs: TERMINATION_CONSTANTS.deadlineDetectionLatencyLimitNs,
    signalMonitorEventLatencyLimitNs: TERMINATION_CONSTANTS.signalMonitorEventLatencyLimitNs,
    signalMonitorDrainLatencyLimitNs: TERMINATION_CONSTANTS.signalMonitorDrainLatencyLimitNs,
    derivationIdentifier: 'declared-child-min-minus-uncertainty-margin-and-declared-child-maxima/v4',
    pairResults: Object.freeze(pairs)
  });
}

function codeSet(values = []) {
  return new Set(values);
}

function sortedCodes(values) {
  return [...values].sort();
}

export function evaluateProductionTiming({ tLaunchNs, qualifiedMinimumElapsedNs, qualifiedLaunchToObservedExitUpperNs, tOsExitObservedNs = null, tTimerfdReadNs = null, clockValid = true }) {
  const codes = new Set();
  if (!clockValid) {
    codes.add('CLOCK_CONTRACT_VIOLATION');
    codes.add('MONITOR_GAP');
    return Object.freeze({ timingVerdict: 'not-evaluated', failureCodes: sortedCodes(codes), parentObservedDeadlineNs: null, elapsedLaunchToObservedExitNs: null, deadlineDetectionLatencyNs: null });
  }
  let launch;
  let floor;
  let upper;
  let deadline;
  try {
    launch = asUInt64(tLaunchNs, 'tLaunchNs');
    floor = asUInt64(qualifiedMinimumElapsedNs, 'qualifiedMinimumElapsedNs', { positive: true });
    upper = asUInt64(qualifiedLaunchToObservedExitUpperNs, 'qualifiedLaunchToObservedExitUpperNs', { positive: true });
    deadline = checkedAdd(launch, upper, 'parentObservedDeadlineNs');
  } catch {
    codes.add('CLOCK_CONTRACT_VIOLATION');
    codes.add('MONITOR_GAP');
    return Object.freeze({ timingVerdict: 'not-evaluated', failureCodes: sortedCodes(codes), parentObservedDeadlineNs: null, elapsedLaunchToObservedExitNs: null, deadlineDetectionLatencyNs: null });
  }

  let elapsed = null;
  let verdict = 'not-evaluated';
  if (tOsExitObservedNs !== null) {
    try {
      const observed = asUInt64(tOsExitObservedNs, 'tOsExitObservedNs');
      elapsed = checkedSubtract(observed, launch, 'elapsedLaunchToObservedExitNs');
      if (elapsed < floor) {
        verdict = 'before-qualified-minimum';
        codes.add('PARENT_OBSERVED_EXIT_TOO_EARLY');
      } else if (observed > deadline) {
        verdict = 'after-parent-observed-deadline';
        codes.add('PARENT_OBSERVED_DEADLINE_EXCEEDED');
      } else verdict = 'within-qualified-elapsed-window';
    } catch {
      codes.add('OS_EXIT_OBSERVATION_INVALID');
      verdict = 'not-evaluated';
    }
  }

  let latency = null;
  if (tTimerfdReadNs !== null) {
    try {
      latency = checkedSubtract(tTimerfdReadNs, deadline, 'deadlineDetectionLatencyNs');
      if (latency > TERMINATION_CONSTANTS.deadlineDetectionLatencyLimitNs) codes.add('MONITOR_GAP');
      if (verdict === 'not-evaluated') {
        verdict = 'after-parent-observed-deadline';
        codes.add('PARENT_OBSERVED_DEADLINE_EXCEEDED');
      }
    } catch {
      codes.add('MONITOR_GAP');
    }
  } else if (tOsExitObservedNs === null || asUInt64(tOsExitObservedNs, 'tOsExitObservedNs') > deadline) {
    codes.add('MONITOR_GAP');
    if (verdict === 'not-evaluated') {
      verdict = 'after-parent-observed-deadline';
      codes.add('PARENT_OBSERVED_DEADLINE_EXCEEDED');
    }
  }
  return Object.freeze({ timingVerdict: verdict, failureCodes: sortedCodes(codes), parentObservedDeadlineNs: deadline, elapsedLaunchToObservedExitNs: elapsed, deadlineDetectionLatencyNs: latency });
}

const SETUP_FAILURES = Object.freeze({
  'create-before-launch': ['PRELAUNCH_REJECTED', 'DEADLINE_DETECTOR_SETUP_FAILED'],
  'register-after-clone': ['DEADLINE_DETECTOR_SETUP_FAILED', 'MONITOR_GAP'],
  'arm-after-clone': ['DEADLINE_DETECTOR_SETUP_FAILED', 'MONITOR_GAP'],
  'late-arm': ['DEADLINE_ARMING_TOO_LATE', 'MONITOR_GAP'],
  'identity': ['CHILD_IDENTITY_VALIDATION_FAILED', 'MONITOR_GAP'],
  'clock-before-launch': ['CLOCK_CONTRACT_VIOLATION', 'PRELAUNCH_REJECTED'],
  'clock-after-launch': ['CLOCK_CONTRACT_VIOLATION', 'MONITOR_GAP'],
  'clone-after-launch': ['SPAWN_FAILED_AFTER_LAUNCH'],
  'privilege-drop': ['CHILD_PRIVILEGE_DROP_FAILED']
});

export function deadlineFailureDisposition(kind) {
  const codes = SETUP_FAILURES[kind];
  if (!codes) fail('INVALID_SETUP_FAILURE_KIND', 'unknown deadline/setup failure kind');
  const launchState = kind === 'create-before-launch' || kind === 'clock-before-launch' ? 'prelaunch-rejected'
    : kind === 'clone-after-launch' ? 'spawn-failed' : 'spawned';
  return Object.freeze({
    launchState,
    envelopeVerdict: 'outside-qualified-envelope',
    timingVerdict: 'not-evaluated',
    exitSignatureVerdict: 'not-evaluated',
    failureCodes: Object.freeze([...codes].sort()),
    claimEligible: false
  });
}

function counterMap(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('MONITOR_GAP', `${label} must be a CPU counter map`);
  const result = new Map();
  for (const [cpu, count] of Object.entries(value)) {
    if (!/^(0|[1-9][0-9]*)$/u.test(cpu)) fail('MONITOR_GAP', `${label} has a malformed CPU key`);
    result.set(cpu, asUInt64(count, `${label}.${cpu}`));
  }
  return result;
}

export function validateMonitorScheduling(environment, runtime) {
  const child = new Set(runtime?.childCpus ?? []);
  const deadline = runtime?.deadlineDetector;
  const signal = runtime?.signalMonitor;
  const validThread = (thread) => thread && thread.schedulerClass === 'SCHED_FIFO' && thread.priority === 80
    && thread.exclusiveCpu === true && thread.mlockall === true && thread.prefaulted === true
    && thread.preallocated === true && thread.dynamicAllocation === false && thread.synchronousIo === false
    && thread.pinnedWakeMechanism === true && thread.kernelWorkerAllowlistPinned === true && thread.noOtherUserTask === true
    && Number.isInteger(thread.cpu) && !child.has(thread.cpu);
  if (!validThread(deadline) || !validThread(signal) || deadline.cpu === signal.cpu
      || deadline.cpu !== Number(environment?.resourceAllocation?.deadlineDetectorCpu)
      || signal.cpu !== Number(environment?.resourceAllocation?.signalMonitorCpu)) {
    fail('MONITOR_GAP', 'monitor scheduling contract is not satisfied');
  }
  return true;
}

export function evaluateSignalMonitor({ onlineCpus, producedCount, consumedCount, reservationFailureCount, mapFailureCount, sequenceBaselines, sequences, events, linksStable, identityStable, finalDrainStartNs, finalDrainEndNs, counterReset = false, counterSaturated = false, cpuHotplug = false, malformedEvent = false, consumerOverrun = false, unavailableInterval = false }) {
  const codes = new Set();
  try {
    if (!Array.isArray(onlineCpus) || onlineCpus.length === 0 || new Set(onlineCpus).size !== onlineCpus.length) fail('MONITOR_GAP');
    const produced = counterMap(producedCount, 'producedCount');
    const consumed = counterMap(consumedCount, 'consumedCount');
    const reservations = counterMap(reservationFailureCount, 'reservationFailureCount');
    const maps = counterMap(mapFailureCount, 'mapFailureCount');
    if (!linksStable || !identityStable || counterReset || counterSaturated || cpuHotplug || malformedEvent || consumerOverrun || unavailableInterval) fail('MONITOR_GAP');
    let totalProduced = 0n;
    for (const cpuValue of onlineCpus) {
      const cpu = String(cpuValue);
      if (![produced, consumed, reservations, maps].every((value) => value.has(cpu))) fail('MONITOR_GAP');
      if (produced.get(cpu) !== consumed.get(cpu) || reservations.get(cpu) !== 0n || maps.get(cpu) !== 0n) fail('MONITOR_GAP');
      const sequence = sequences?.[cpu];
      const baseline = sequenceBaselines?.[cpu];
      if (baseline === undefined) fail('MONITOR_GAP');
      if (!Array.isArray(sequence) || sequence.length !== Number(produced.get(cpu))) fail('MONITOR_GAP');
      if (sequence.length && asUInt64(sequence[0], `sequences.${cpu}[0]`) !== checkedAdd(baseline, 1n, 'eventSequenceBaseline')) fail('MONITOR_GAP');
      for (let index = 1; index < sequence.length; index += 1) {
        if (asUInt64(sequence[index], `sequences.${cpu}[${index}]`) !== checkedAdd(sequence[index - 1], 1n, 'eventSequence')) fail('MONITOR_GAP');
      }
      totalProduced = checkedAdd(totalProduced, produced.get(cpu), 'totalProduced');
    }
    const retained = Array.isArray(events) ? events : fail('MONITOR_GAP');
    if (BigInt(retained.length) !== totalProduced) fail('MONITOR_GAP');
    let maximumEventLatencyNs = 0n;
    let terminatingSignalEventCount = 0n;
    for (let index = 0; index < retained.length; index += 1) {
      const event = retained[index];
      const latency = checkedSubtract(event.tConsumeNs, event.tEventNs, `events[${index}].latency`);
      if (latency > maximumEventLatencyNs) maximumEventLatencyNs = latency;
      if (TERMINATING_SIGNALS.includes(event.signal)) terminatingSignalEventCount += 1n;
    }
    const drainLatencyNs = checkedSubtract(finalDrainEndNs, finalDrainStartNs, 'signalMonitorDrainLatencyNs');
    if (maximumEventLatencyNs > TERMINATION_CONSTANTS.signalMonitorEventLatencyLimitNs || drainLatencyNs > TERMINATION_CONSTANTS.signalMonitorDrainLatencyLimitNs) fail('MONITOR_GAP');
    if (terminatingSignalEventCount > 0n) codes.add('UNRELATED_TERMINATION_EVIDENCE');
    return Object.freeze({
      signalMonitorComplete: true,
      signalMonitorMaxEventLatencyNs: maximumEventLatencyNs,
      signalMonitorDrainLatencyNs: drainLatencyNs,
      terminatingSignalEventCount,
      failureCodes: sortedCodes(codes)
    });
  } catch (error) {
    if (!(error instanceof TerminationSafetyError)) throw error;
    codes.add('MONITOR_GAP');
    return Object.freeze({ signalMonitorComplete: false, signalMonitorMaxEventLatencyNs: null, signalMonitorDrainLatencyNs: null, terminatingSignalEventCount: null, failureCodes: sortedCodes(codes) });
  }
}

const PRIVILEGE_OPERATION_ORDER = Object.freeze([
  'closeDescriptors', 'clearAmbientCapabilities', 'clearInheritableCapabilities',
  'dropSupplementaryGroups', 'lockSecurebits', 'setWorkloadGid', 'setWorkloadUid',
  'clearEffectiveAndPermittedCapabilities', 'setNoNewPrivileges',
  'installSeccomp', 'markReadinessCloseOnExec', 'childReread', 'emitReady',
  'parentVerify', 'releaseApplication'
]);

export { PRIVILEGE_OPERATION_ORDER };

export async function executePrivilegeDropProtocol(operations, policy) {
  const trace = [];
  let released = false;
  const invoke = async (name, ...args) => {
    if (typeof operations?.[name] !== 'function') fail('CHILD_PRIVILEGE_DROP_FAILED', `missing ${name}`);
    trace.push(name);
    const result = await operations[name](...args);
    if (result === false) fail('CHILD_PRIVILEGE_DROP_FAILED', `${name} failed`);
    return result;
  };
  try {
    await invoke('closeDescriptors', policy.descriptorAllowlist);
    await invoke('clearAmbientCapabilities');
    await invoke('clearInheritableCapabilities');
    await invoke('dropSupplementaryGroups');
    // Linux requires CAP_SETPCAP while changing/locking securebits. Lock them
    // before the UID transition, retain no application-visible privilege, and
    // verify the locked state again after the final capability clear.
    await invoke('lockSecurebits');
    await invoke('setWorkloadGid', policy.workloadGid, false);
    await invoke('setWorkloadUid', policy.workloadUid, false);
    await invoke('clearEffectiveAndPermittedCapabilities');
    await invoke('setNoNewPrivileges', 1);
    await invoke('installSeccomp', policy.seccompFilterSha256);
    await invoke('markReadinessCloseOnExec');
    const childSnapshot = await invoke('childReread');
    assertPrivilegeSnapshot(childSnapshot, policy);
    await invoke('emitReady');
    const parentSnapshot = await invoke('parentVerify');
    assertPrivilegeSnapshot(parentSnapshot, policy);
    await invoke('releaseApplication');
    released = true;
    return Object.freeze({ released, failureCodes: Object.freeze([]), trace: Object.freeze(trace), privilegeDropEvidenceSha256: digestPrivilegeEvidence(childSnapshot, parentSnapshot, policy) });
  } catch (error) {
    return Object.freeze({ released, failureCodes: Object.freeze(['CHILD_PRIVILEGE_DROP_FAILED']), trace: Object.freeze(trace), privilegeDropEvidenceSha256: null });
  }
}

function assertPrivilegeSnapshot(snapshot, policy) {
  const ids = ['realUid', 'effectiveUid', 'savedUid', 'fsUid'];
  const gids = ['realGid', 'effectiveGid', 'savedGid', 'fsGid'];
  if (!snapshot || ids.some((field) => asUInt64(snapshot[field], field) !== asUInt64(policy.workloadUid, 'workloadUid'))
      || gids.some((field) => asUInt64(snapshot[field], field) !== asUInt64(policy.workloadGid, 'workloadGid'))
      || snapshot.supplementaryGroupCount !== 0 || snapshot.noNewPrivileges !== 1
      || snapshot.seccompMode !== 2 || snapshot.seccompFilterSha256 !== policy.seccompFilterSha256
      || snapshot.cgroupIdentity !== policy.cgroupIdentity || snapshot.startTime !== policy.startTime || snapshot.pidfdIdentity !== policy.pidfdIdentity
      || !Array.isArray(snapshot.descriptors) || JSON.stringify([...snapshot.descriptors].sort((a, b) => a - b)) !== JSON.stringify([...policy.descriptorAllowlist].sort((a, b) => a - b))) {
    fail('CHILD_PRIVILEGE_DROP_FAILED', 'identity, seccomp, cgroup, or descriptor verification failed');
  }
  const admittedRoles = ['readiness-barrier', 'start-barrier', 'stderr', 'stdin', 'stdout'];
  if (policy.privilegedDescriptorCount !== 0 || !policy.descriptorRoles || Object.keys(policy.descriptorRoles).length !== policy.descriptorAllowlist.length
      || Object.values(policy.descriptorRoles).some((role) => !admittedRoles.includes(role))) fail('CHILD_PRIVILEGE_DROP_FAILED', 'privileged or unclassified descriptor is admitted');
  for (const field of ['effectiveCapabilities', 'permittedCapabilities', 'inheritableCapabilities', 'ambientCapabilities']) {
    if (snapshot[field] !== 0 && snapshot[field] !== 0n && snapshot[field] !== '0') fail('CHILD_PRIVILEGE_DROP_FAILED', `${field} is nonzero`);
  }
  if (snapshot.securebitsLocked !== true) fail('CHILD_PRIVILEGE_DROP_FAILED', 'securebits are not locked');
}

function stableJson(value) {
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function digestPrivilegeEvidence(childSnapshot, parentSnapshot, policy) {
  return crypto.createHash('sha256').update(stableJson({ childSnapshot, parentSnapshot, policy })).digest('hex');
}

export function evaluateExitSignature(observation) {
  const codes = codeSet(observation.failureCodes);
  const complete = observation.signalMonitorComplete === true;
  if (!complete) codes.add('MONITOR_GAP');
  const signatureMatches = observation.osStatus === 1 && observation.osSignal === 'none';
  if (!signatureMatches) codes.add('EXIT_SIGNATURE_MISMATCH');
  if ([observation.oomDelta, observation.oomKillDelta, observation.oomGroupKillDelta, observation.cgroupKillCount, observation.supervisorTerminationCount, observation.terminatingSignalEventCount]
    .some((value) => asUInt64(value ?? 0, 'terminationEvidence') > 0n)) codes.add('UNRELATED_TERMINATION_EVIDENCE');
  const pass = signatureMatches && complete && !codes.has('UNRELATED_TERMINATION_EVIDENCE') && !codes.has('MONITOR_GAP');
  return Object.freeze({ exitSignatureVerdict: pass ? 'qualified-exit-signature' : 'unqualified-exit-signature', failureCodes: sortedCodes(codes) });
}

export function evaluateClaimEligibility(record) {
  return record.claimType === CLAIM_TYPE && record.claimSemantics === CLAIM_SEMANTICS
    && record.envelopeVerdict === 'within-qualified-envelope'
    && record.timingVerdict === 'within-qualified-elapsed-window'
    && record.exitSignatureVerdict === 'qualified-exit-signature'
    && Array.isArray(record.failureCodes) && record.failureCodes.length === 0;
}
