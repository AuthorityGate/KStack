import crypto from 'node:crypto';
import { CLAIM_SEMANTICS, CLAIM_TYPE, LOGICAL_TOOL_ALLOWLIST, TERMINATION_CONSTANTS, TerminationSafetyError, asUInt64, checkedAdd, checkedMultiply, checkedSubtract, evaluateProductionTiming, roundUpToClockTick } from './termination-contract.mjs';
import { canonicalJson, canonicalSha256, validateProductionEnvelope, validateResidualInterferenceDerivation } from './termination-schema.mjs';

function fail(code, message = code) {
  throw new TerminationSafetyError(code, message);
}

function ceilDivide(numerator, denominator, label) {
  const n = asUInt64(numerator, `${label}.numerator`);
  const d = asUInt64(denominator, `${label}.denominator`, { positive: true });
  const quotient = n / d;
  return n % d === 0n ? quotient : checkedAdd(quotient, 1n, `${label}.ceil`);
}

export function validateClockContract(contract) {
  const tick = asUInt64(contract?.declaredClockTickNs, 'declaredClockTickNs', { positive: true });
  if (contract.parentClockId !== 'CLOCK_MONOTONIC' || contract.childClockId !== 'CLOCK_MONOTONIC'
      || contract.parentUnits !== 'integer-nanoseconds' || contract.childUnits !== 'integer-nanoseconds'
      || contract.conversionApplied !== false || contract.perProcessOrigin !== false) fail('CLOCK_CONTRACT_VIOLATION', 'clock identifiers, units, or mapping differ');
  if (!Array.isArray(contract.handshakes) || contract.handshakes.length !== 1_000) fail('CLOCK_CONTRACT_VIOLATION', 'clock qualification requires exactly 1000 handshakes');
  let minimumWidth = null;
  let priorBefore = null;
  let priorAfter = null;
  let priorChild = null;
  for (let index = 0; index < contract.handshakes.length; index += 1) {
    const sample = contract.handshakes[index];
    const before = asUInt64(sample?.pBeforeNs, `handshakes[${index}].pBeforeNs`);
    const child = asUInt64(sample?.childNs, `handshakes[${index}].childNs`);
    const after = asUInt64(sample?.pAfterNs, `handshakes[${index}].pAfterNs`);
    if (before > child || child > after || (priorBefore !== null && (before < priorBefore || after < priorAfter || child < priorChild))) fail('CLOCK_CONTRACT_VIOLATION', 'clock bracket or monotonicity failed');
    const width = checkedSubtract(after, before, `handshakes[${index}].bracketWidthNs`);
    if (sample.bracketWidthNs !== undefined && asUInt64(sample.bracketWidthNs, 'stored bracket width') !== width) fail('CLOCK_CONTRACT_VIOLATION', 'stored bracket width differs');
    if (minimumWidth === null || width < minimumWidth) minimumWidth = width;
    priorBefore = before; priorAfter = after; priorChild = child;
  }
  const uncertainty = roundUpToClockTick(checkedAdd(minimumWidth, checkedMultiply(2n, tick, 'clock.twoTicks'), 'clock.uncertaintyInput'), tick);
  if (uncertainty > 100_000n || asUInt64(contract.clockCorrelationUncertaintyNs, 'clockCorrelationUncertaintyNs', { positive: true }) !== uncertainty) fail('CLOCK_CONTRACT_VIOLATION', 'clock uncertainty differs or exceeds 100000 ns');
  const pre = asUInt64(contract.boottimeMinusMonotonicPrelaunchNs, 'boottime prelaunch');
  const post = asUInt64(contract.boottimeMinusMonotonicFinalDrainNs, 'boottime final drain');
  const drift = pre > post ? pre - post : post - pre;
  if (drift > tick || contract.clocksourceStable !== true || contract.resolutionStable !== true || contract.suspendObserved === true || contract.clockSetObserved === true) fail('CLOCK_CONTRACT_VIOLATION', 'clock environment changed during coverage');
  return Object.freeze({ clockCorrelationUncertaintyNs: uncertainty, minimumBracketWidthNs: minimumWidth });
}

export function stallBasisPoints({ totalUsStart, totalUsEnd, monoNsStart, monoNsEnd }) {
  const deltaStallUs = checkedSubtract(totalUsEnd, totalUsStart, 'deltaStallUs');
  const elapsedNs = checkedSubtract(monoNsEnd, monoNsStart, 'elapsedNs');
  const elapsedUs = elapsedNs / 1_000n;
  if (elapsedUs === 0n) fail('MONITOR_GAP', 'continuous epoch is shorter than one microsecond');
  const calculated = ceilDivide(checkedMultiply(deltaStallUs, 10_000n, 'stallBasisPoints.numerator'), elapsedUs, 'stallBasisPoints');
  return calculated > 10_000n ? 10_000n : calculated;
}

export function utilizationBasisPoints({ usageUsStart, usageUsEnd, monoNsStart, monoNsEnd, cpusetSize, quotaMicros = 'max', periodMicros = null }) {
  const usage = checkedSubtract(usageUsEnd, usageUsStart, 'usageDeltaUs');
  const elapsedUs = checkedSubtract(monoNsEnd, monoNsStart, 'elapsedNs') / 1_000n;
  if (elapsedUs === 0n) fail('MONITOR_GAP', 'utilization epoch is shorter than one microsecond');
  const cpus = asUInt64(cpusetSize, 'cpusetSize', { positive: true });
  let capacityNumerator;
  let capacityDenominator = 1n;
  if (quotaMicros === 'max') capacityNumerator = checkedMultiply(elapsedUs, cpus, 'capacityUs');
  else {
    const quota = asUInt64(quotaMicros, 'quotaMicros');
    const period = asUInt64(periodMicros, 'periodMicros', { positive: true });
    if (quota * 1n < cpus * period) {
      capacityNumerator = checkedMultiply(elapsedUs, quota, 'quotaCapacityNumerator');
      capacityDenominator = period;
    } else capacityNumerator = checkedMultiply(elapsedUs, cpus, 'cpuCapacityNumerator');
  }
  if (capacityNumerator === 0n) fail('MONITOR_GAP', 'allocated capacity is zero');
  const numerator = checkedMultiply(checkedMultiply(usage, 10_000n, 'utilization.usageBasis'), capacityDenominator, 'utilization.rational');
  const calculated = ceilDivide(numerator, capacityNumerator, 'utilizationBasisPoints');
  return calculated > 10_000n ? 10_000n : calculated;
}

export function evaluateContinuousEpoch(epoch) {
  const codes = new Set();
  try {
    const metrics = {
      cpuSome: stallBasisPoints(epoch.cpuSome),
      memorySome: stallBasisPoints(epoch.memorySome),
      memoryFull: stallBasisPoints(epoch.memoryFull),
      utilization: utilizationBasisPoints(epoch.utilization)
    };
    if (metrics.cpuSome > 500n || metrics.memorySome > 100n || metrics.memoryFull > 0n) codes.add('PSI_STALL_THRESHOLD_EXCEEDED');
    if (metrics.utilization > 500n) codes.add('ADMISSION_THRESHOLD_EXCEEDED');
    if (epoch.foreignRunnableTasks !== 0 || epoch.runQueueDepth > 1) codes.add('FOREIGN_TASK_OBSERVED');
    if (epoch.sampleGap === true || epoch.identityStable !== true || epoch.counterReset === true) codes.add('MONITOR_GAP');
    return Object.freeze({ metrics: Object.freeze(metrics), failureCodes: Object.freeze([...codes].sort()) });
  } catch (error) {
    if (!(error instanceof TerminationSafetyError)) throw error;
    codes.add('MONITOR_GAP');
    return Object.freeze({ metrics: null, failureCodes: Object.freeze([...codes].sort()) });
  }
}

export function evaluatePrelaunchAdmission(snapshot) {
  const codes = new Set();
  const values = ['allocatedCpuUtilizationBasisPoints', 'foreignRunnableTasks', 'runQueueDepth', 'cpuPsiSomeAvg10BasisPoints', 'memoryPsiSomeAvg10BasisPoints', 'memoryPsiFullAvg10BasisPoints', 'memAvailableBytes'];
  if (!snapshot || values.some((field) => snapshot[field] === undefined) || snapshot.identityStable !== true) codes.add('PRELAUNCH_REJECTED');
  else {
    if (snapshot.allocatedCpuUtilizationBasisPoints > 500 || snapshot.cpuPsiSomeAvg10BasisPoints > 50
        || snapshot.memoryPsiSomeAvg10BasisPoints > 50 || snapshot.memoryPsiFullAvg10BasisPoints > 10
        || asUInt64(snapshot.memAvailableBytes, 'memAvailableBytes') < 2_147_483_648n) codes.add('ADMISSION_THRESHOLD_EXCEEDED');
    if (snapshot.foreignRunnableTasks > 0 || snapshot.runQueueDepth > 1) codes.add('FOREIGN_TASK_OBSERVED');
    if (codes.size) codes.add('PRELAUNCH_REJECTED');
  }
  return Object.freeze({ admitted: codes.size === 0, failureCodes: Object.freeze([...codes].sort()) });
}

export async function observeDeadlineReadySet({ operations, timingPolicy, tLaunchNs, readySources }) {
  if (typeof operations?.waitidNoHang !== 'function' || typeof operations?.monotonicNowNs !== 'function') fail('OS_EXIT_OBSERVATION_INVALID');
  const terminal = await operations.waitidNoHang();
  if (terminal?.available === true) {
    const observed = await operations.monotonicNowNs();
    const timing = evaluateProductionTiming({
      tLaunchNs,
      qualifiedMinimumElapsedNs: timingPolicy.qualifiedMinimumElapsedNs,
      qualifiedLaunchToObservedExitUpperNs: timingPolicy.qualifiedLaunchToObservedExitUpperNs,
      tOsExitObservedNs: observed,
      tTimerfdReadNs: readySources?.includes('timerfd') ? await operations.readTimerfdAndTimestamp() : null
    });
    if (typeof operations.reapPidfd === 'function') await operations.reapPidfd();
    return Object.freeze({ terminal, tOsExitObservedNs: asUInt64(observed, 'tOsExitObservedNs'), ...timing });
  }
  if (readySources?.includes('timerfd')) {
    if (typeof operations.readTimerfdAndTimestamp !== 'function') fail('MONITOR_GAP');
    const read = await operations.readTimerfdAndTimestamp();
    return Object.freeze({ terminal: null, ...evaluateProductionTiming({
      tLaunchNs,
      qualifiedMinimumElapsedNs: timingPolicy.qualifiedMinimumElapsedNs,
      qualifiedLaunchToObservedExitUpperNs: timingPolicy.qualifiedLaunchToObservedExitUpperNs,
      tTimerfdReadNs: read
    }) });
  }
  return Object.freeze({ terminal: null, ...evaluateProductionTiming({
    tLaunchNs,
    qualifiedMinimumElapsedNs: timingPolicy.qualifiedMinimumElapsedNs,
    qualifiedLaunchToObservedExitUpperNs: timingPolicy.qualifiedLaunchToObservedExitUpperNs
  }) });
}

function stableSnapshotBytes(value) {
  return Buffer.from(canonicalJson(value));
}

function countsEqual(snapshot) {
  const cpus = Object.keys(snapshot?.producedCount ?? {});
  return cpus.length > 0 && cpus.every((cpu) => snapshot.consumedCount?.[cpu] !== undefined
    && asUInt64(snapshot.producedCount[cpu], 'produced') === asUInt64(snapshot.consumedCount[cpu], 'consumed'));
}

export async function drainSignalMonitor(operations, { maximumIterations = 1_024 } = {}) {
  if (!Number.isInteger(maximumIterations) || maximumIterations < 2 || maximumIterations > 1_024) fail('MONITOR_GAP', 'invalid final-drain iteration bound');
  try {
    const start = asUInt64(await operations.monotonicNowNs(), 'tSignalMonitorFinalDrainStartNs');
    let previous = null;
    for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
      const snapshot = await operations.snapshotProducerState();
      if (snapshot.linksStable !== true || snapshot.identityStable !== true || snapshot.everyOnlineCpuRepresented !== true
          || snapshot.reservationFailureCount !== 0 && snapshot.reservationFailureCount !== 0n
          || snapshot.mapFailureCount !== 0 && snapshot.mapFailureCount !== 0n) fail('MONITOR_GAP');
      await operations.drainRetainedEvents();
      const bytes = stableSnapshotBytes(snapshot);
      if (previous !== null && bytes.equals(previous) && countsEqual(snapshot)) {
        const end = asUInt64(await operations.monotonicNowNs(), 'tSignalMonitorFinalDrainEndNs');
        const latency = checkedSubtract(end, start, 'signalMonitorDrainLatencyNs');
        if (latency > TERMINATION_CONSTANTS.signalMonitorDrainLatencyLimitNs) fail('MONITOR_GAP');
        return Object.freeze({ tSignalMonitorFinalDrainStartNs: start, tSignalMonitorFinalDrainEndNs: end, signalMonitorDrainLatencyNs: latency, stableSnapshot: snapshot });
      }
      previous = bytes;
    }
    fail('MONITOR_GAP', 'stable final drain was not reached');
  } catch (error) {
    if (error instanceof TerminationSafetyError) throw error;
    fail('MONITOR_GAP', 'signal final drain operation failed');
  }
}

export function validateRequalificationLedger(ledger) {
  if (!Array.isArray(ledger) || ledger.length === 0) fail('REQUALIFICATION_LEDGER_INVALID');
  let resultBearing = 0;
  let previousDigest = '0'.repeat(64);
  for (let index = 0; index < ledger.length; index += 1) {
    const attempt = ledger[index];
    if (!attempt || attempt.previousAttemptSha256 !== previousDigest || attempt.attemptNumber !== index + 1) fail('REQUALIFICATION_LEDGER_INVALID');
    if (attempt.resultBearing === true) {
      resultBearing += 1;
      if (resultBearing > 3) fail('REQUALIFICATION_EXHAUSTED');
      if (resultBearing > 1) {
        const remediation = attempt.remediation;
        if (!remediation || remediation.independentReviewerSignatureValid !== true
            || typeof remediation.semanticDiffSha256 !== 'string' || typeof remediation.failedAssertion !== 'string'
            || typeof remediation.causalMechanism !== 'string' || typeof remediation.directionalFalsifiablePrediction !== 'string'
            || remediation.materiallyCausal !== true || remediation.weakensPolicy === true || remediation.unrelatedMaterialChange === true) {
          fail('REQUALIFICATION_LEDGER_INVALID');
        }
      }
    }
    previousDigest = crypto.createHash('sha256').update(canonicalJson(attempt)).digest('hex');
  }
  return Object.freeze({ resultBearingAttempts: resultBearing, ledgerHeadSha256: previousDigest });
}

export async function finalizeProductionRecord(record, operations, validationContext = {}) {
  const failureCodes = new Set(record.failureCodes ?? []);
  let token = null;
  try {
    validateProductionEnvelope(record, validationContext);
    const canonicalBytes = Buffer.from(canonicalJson(record));
    const digest = crypto.createHash('sha256').update(canonicalBytes).digest('hex');
    const temporary = await operations.createSameFilesystemTemporary();
    await operations.writeAll(temporary, canonicalBytes);
    await operations.syncFile(temporary);
    await operations.installNoReplace(temporary, digest);
    await operations.syncDirectory();
    const reread = await operations.readFinal(digest);
    if (!Buffer.from(reread).equals(canonicalBytes) || crypto.createHash('sha256').update(reread).digest('hex') !== digest) fail('RECORD_FINALIZATION_FAILED');
    if (record.claimEligible === true) {
      if (record.claimType !== CLAIM_TYPE || record.claimSemantics !== CLAIM_SEMANTICS || typeof operations.signToken !== 'function') fail('RECORD_FINALIZATION_FAILED');
      token = await operations.signToken({ claimType: CLAIM_TYPE, claimSemantics: CLAIM_SEMANTICS, recordSha256: digest });
    }
    return Object.freeze({ finalized: true, recordSha256: digest, token, failureCodes: Object.freeze([...failureCodes].sort()) });
  } catch {
    failureCodes.add('RECORD_FINALIZATION_FAILED');
    return Object.freeze({ finalized: false, recordSha256: null, token: null, failureCodes: Object.freeze([...failureCodes].sort()) });
  }
}

function exactSortedStrings(actual, expected, code, label) {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== 'string') || JSON.stringify(actual) !== JSON.stringify([...expected].sort())) fail(code, `${label} differs from its closed set`);
}

export function validateGraphAndTerminationEvidence(evidence) {
  const code = 'TERMINATION_CONSTRUCTION_INVALID';
  const digests = ['productionGraphSha256', 'instrumentedCompliantGraphSha256', 'instrumentedControlGraphSha256'];
  if (!evidence || digests.some((field) => typeof evidence[field] !== 'string' || !/^[0-9a-f]{64}$/u.test(evidence[field]))) fail(code);
  if (new Set(digests.map((field) => evidence[field])).size !== 3 || evidence.productionLaunchGraphSha256 !== evidence.productionGraphSha256
      || evidence.erasedCompliantGraphSha256 !== evidence.productionGraphSha256 || evidence.normalizedProductionOperationsEqual !== true
      || evidence.probeManifestOnlyAdmittedShapes !== true || evidence.probeCardinalityAndWorkBounded !== true) fail(code, 'graph roles or erasure relation failed');
  if (evidence.compliantCutoffCallbackEntryCount !== 1 || evidence.callbackEntryToExitSeamOrdinalDelta !== 1
      || evidence.controlDifferenceCount !== 1 || evidence.controlDifferenceKind !== 'single-unref-call'
      || evidence.controlDiagnosticCode !== 'REFD_TIMER_LIFETIME' || evidence.controlDiagnosticCount !== 1) fail(code, 'compliant/control provenance failed');
  if (!Array.isArray(evidence.bootstrapNegatives) || evidence.bootstrapNegatives.length !== 4) fail(code, 'four bootstrap negatives are required');
  for (const fixture of evidence.bootstrapNegatives) {
    if (fixture.exitStatus !== 78 || fixture.implementationRecordCount !== 0 || fixture.timerCreationRecordCount !== 0
        || fixture.exitCodeRecordCount !== 0 || fixture.statusOneRouteRecordCount !== 0 || fixture.captureGateTranscriptExact !== true) fail(code, 'bootstrap negative transcript failed');
  }
  if (evidence.cutoffInitiallyRefd !== true || evidence.cutoffBindingImmutable !== true || evidence.cutoffMutationCount !== 0
      || evidence.drainInitiallyRefd !== true || evidence.drainClearCount !== 1 || evidence.drainClearAfterCommit !== true
      || evidence.capturedIntrinsicIdentityExact !== true || evidence.terminalTailShapeExact !== true
      || evidence.exitCodeAssignmentCount !== 2 || evidence.otherExitCodeAccessCount !== 0
      || evidence.callbackReadsEpisodeState !== false || evidence.callbackWriteRetryCount !== 0
      || evidence.winnerIndependentLastResortOneShot !== true || evidence.maximumTerminationEpisodes !== 1) fail(code, 'one-shot termination construction failed');
  if (JSON.stringify(evidence.statusRegistry) !== JSON.stringify([0, 1, 2, 70, 71, 74, 75, 129, 130, 143])) fail(code, 'status registry differs from its closed set');
  exactSortedStrings(evidence.logicalToolAllowlist, LOGICAL_TOOL_ALLOWLIST, code, 'logical tool allowlist');
  if (evidence.logicalToolAllowlist.length !== 7 || evidence.analyzerCompleteOverLaunchClosure !== true
      || evidence.declarationGlobExpansionBidirectional !== true || evidence.listenerOrderAssertionsPass !== true
      || evidence.statusFidelityFixturesPass !== true || evidence.injectionBoundsPass !== true
      || evidence.compliantRunCount !== 10 || evidence.controlRunCount !== 10 || evidence.retryCount !== 0
      || evidence.replacementCount !== 0 || evidence.selectionApplied !== false) fail(code, 'analyzer or qualification population failed');
  return true;
}

export function validateIsolationAndPolicyEvidence(environment, evidence) {
  const codes = new Set();
  if (!evidence || evidence.completeSmtSiblingAllocation !== true || evidence.unallocatedChildSmtSiblingsOffline !== true
      || evidence.irqAffinityStable !== true || evidence.housekeepingAllocationStable !== true
      || evidence.cpusetPartitionStable !== true || evidence.cpuHotplugObserved === true
      || evidence.foreignRunnableTaskMaximum !== 0 || evidence.allocatedRunQueueMaximum > 1
      || evidence.deadlineDetectorCpu !== environment.resourceAllocation.deadlineDetectorCpu
      || evidence.signalMonitorCpu !== environment.resourceAllocation.signalMonitorCpu
      || evidence.deadlineDetectorCpu === evidence.signalMonitorCpu || evidence.kernelWorkerAllowlistStable !== true) codes.add('MONITOR_GAP');
  const expectedResidual = environment?.residualExternalInterference;
  try {
    validateResidualInterferenceDerivation(evidence?.residualInterferenceDerivation, {
      environmentSha256: canonicalSha256(environment),
      expectedApplicable: expectedResidual,
      resctrlMode: environment?.concurrencyIsolation?.resctrlMode
    });
  } catch {
    codes.add('ENVIRONMENT_DRIFT');
  }
  if (!Array.isArray(evidence?.applicableResidualExternalInterference)
      || JSON.stringify(evidence.applicableResidualExternalInterference) !== JSON.stringify(expectedResidual)) codes.add('ENVIRONMENT_DRIFT');
  const resctrlEnforced = environment?.concurrencyIsolation?.resctrlMode === 'enforced';
  if (resctrlEnforced
    ? evidence?.resctrlConfigurationSha256 !== environment?.concurrencyIsolation?.resctrlConfigurationSha256
    : evidence?.resctrlConfigurationSha256 !== 'not-applicable') codes.add('ENVIRONMENT_DRIFT');
  if (evidence?.thermalEventObserved === true || evidence?.powerEventObserved === true || evidence?.policyEventObserved === true) codes.add('THERMAL_OR_POWER_EVENT');
  if (evidence?.policyStreamContinuous !== true || evidence?.maximumPolicyHeartbeatGapNs > 10_000_000
      || evidence?.postExitPolicyRereadEqual !== true) codes.add('ATTESTATION_INVALIDATED');
  return Object.freeze({ pass: codes.size === 0, failureCodes: Object.freeze([...codes].sort()) });
}

const FORBIDDEN_CLAIM_SURFACE = /\b(?:termination-by-parent-deadline|cutoff\s+(?:fired|guarantee)|deadline\s+caused\s+exit)\b/iu;

export function validateOutcomeClaimSurfaces(surfaces) {
  if (!Array.isArray(surfaces) || surfaces.some((value) => typeof value !== 'string' || FORBIDDEN_CLAIM_SURFACE.test(value))) fail('CLAIM_SEMANTICS_INVALID');
  return true;
}
