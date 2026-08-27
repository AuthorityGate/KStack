import crypto from 'node:crypto';
import { CLAIM_SEMANTICS, CLAIM_TYPE, FAILURE_CODES, TERMINATING_SIGNALS, TERMINATION_CONSTANTS, TerminationSafetyError, asUInt64, checkedAdd, checkedSubtract, deriveQualificationTiming, evaluateClaimEligibility } from './termination-contract.mjs';

const SHA256 = /^[0-9a-f]{64}$/u;
const ASCII_128 = /^[\x21-\x7e]{1,128}$/u;
const ASCII_256 = /^[\x21-\x7e]{1,256}$/u;
const ARCHITECTURES = new Set(['x86_64', 'aarch64']);
const SUBSTRATE_KINDS = new Set(['bare-metal', 'virtual-machine', 'container']);
const SCHEDULER_CLASSES = new Set(['SCHED_OTHER', 'SCHED_BATCH', 'SCHED_IDLE', 'SCHED_FIFO', 'SCHED_RR']);
const GOVERNORS = new Set(['performance', 'powersave', 'schedutil', 'ondemand', 'conservative', 'userspace']);
const POWER_PROFILES = new Set(['performance', 'balanced-performance', 'balanced', 'power-saver']);
const RESIDUAL_INTERFERENCE = new Set([
  'unpartitioned-shared-llc', 'memory-controller-dram-traffic', 'interconnect-traffic',
  'dma', 'firmware-activity', 'unobservable-package-power-frequency-coupling'
]);
export const UNAVAILABLE_SIGNALS = Object.freeze(['power-cap-events', 'thermal-throttle-events']);
const UNAVAILABLE_SIGNAL_SET = new Set(UNAVAILABLE_SIGNALS);
export const RESIDUAL_INTERFERENCE_DERIVATION_VOCABULARY = Object.freeze([
  Object.freeze({
    class: 'dma', applicableBasis: 'dma-not-excluded', mitigatedBasis: 'dma-excluded'
  }),
  Object.freeze({
    class: 'firmware-activity', applicableBasis: 'firmware-not-quiesced', mitigatedBasis: 'firmware-quiesced'
  }),
  Object.freeze({
    class: 'interconnect-traffic', applicableBasis: 'interconnect-not-partitioned', mitigatedBasis: 'interconnect-partitioned'
  }),
  Object.freeze({
    class: 'memory-controller-dram-traffic', applicableBasis: 'dram-bandwidth-not-partitioned', mitigatedBasis: 'dram-bandwidth-partitioned'
  }),
  Object.freeze({
    class: 'unobservable-package-power-frequency-coupling', applicableBasis: 'package-power-frequency-coupling-unobservable', mitigatedBasis: 'package-power-frequency-coupling-observed-and-controlled'
  }),
  Object.freeze({
    class: 'unpartitioned-shared-llc', applicableBasis: 'llc-allocation-not-enforced', mitigatedBasis: 'llc-allocation-enforced'
  })
]);
const OS_SIGNALS = new Set([
  'none', ...TERMINATING_SIGNALS, 'SIGCHLD', 'SIGCONT', 'SIGSTOP', 'SIGTSTP',
  'SIGTTIN', 'SIGTTOU', 'SIGURG', 'SIGWINCH'
]);
const FAILURE_CODE_SET = new Set(FAILURE_CODES);

export const SCHEMA_KEYS = Object.freeze({
  qualificationEnvironment: Object.freeze(['schema', 'hostRuntimeSubstrate', 'resourceAllocation', 'concurrencyIsolation', 'powerThermalPolicy', 'loadAdmissionPolicy', 'timingLaunchDiscipline', 'residualExternalInterference', 'substrateAttestationSha256']),
  hostRuntimeSubstrate: Object.freeze(['hostIdentitySha256', 'osDistribution', 'osVersion', 'kernelBuild', 'architecture', 'cpuVendor', 'cpuFamily', 'cpuModel', 'cpuStepping', 'microcode', 'physicalCoreCount', 'logicalCpuCount', 'onlineCpuList', 'numaTopologySha256', 'substrateKind', 'hypervisorOrRuntime', 'hypervisorOrRuntimeVersion', 'machineImageSha256', 'nestedVirtualization', 'clocksource', 'btfSha256', 'tracepointFormatsSha256']),
  resourceAllocation: Object.freeze(['childCpuList', 'childNodeList', 'deadlineDetectorCpu', 'signalMonitorCpu', 'housekeepingCpuList', 'workloadCgroupMountId', 'workloadCgroupInode', 'workloadCgroupConfigurationSha256', 'cgroupCpuQuotaMicros', 'cgroupCpuPeriodMicros', 'cgroupCpuWeight', 'memoryLimitBytes', 'swapLimitBytes', 'numaBinding', 'childSchedulerClass', 'childNiceValue', 'supervisorSchedulerClass', 'supervisorPriority', 'workloadUid', 'workloadGid', 'privilegeSeparationPolicySha256']),
  concurrencyIsolation: Object.freeze(['maximumConcurrentChildren', 'oneChildAtATime', 'consecutiveQualificationPairs', 'overlappingPairsAllowed', 'foreignRunnableTasksAllowed', 'completeSmtSiblingAllocation', 'offlineUnallocatedChildSmtSiblings', 'childCpusetPartition', 'deadlineDetectorCpuExclusive', 'signalMonitorCpuExclusive', 'monitorCpusDistinct', 'irqAffinitySha256', 'kernelWorkerAllowlistSha256', 'schedulerMonitorSha256', 'cpuHotplugAllowed', 'startBarrierRequired', 'resctrlMode', 'resctrlConfigurationSha256']),
  powerThermalPolicy: Object.freeze(['powerProfile', 'governor', 'minimumFrequencyKHz', 'maximumFrequencyKHz', 'turboEnabled', 'powerCapMilliwatts', 'thermalSensorSetSha256', 'powerSensorSetSha256', 'thermalMaximumMilliCelsius', 'thermalSamplePeriodNs', 'policyEventStreamSha256', 'policyHeartbeatLimitNs']),
  loadAdmissionPolicy: Object.freeze(['prelaunchWindowNs', 'prelaunchCpuUtilizationMaximumBasisPoints', 'prelaunchForeignRunnableTaskMaximum', 'prelaunchRunQueueDepthMaximum', 'prelaunchCpuPsiSomeAvg10MaximumBasisPoints', 'prelaunchMemoryPsiSomeAvg10MaximumBasisPoints', 'prelaunchMemoryPsiFullAvg10MaximumBasisPoints', 'prelaunchMemAvailableMinimumBytes', 'continuousEpochNs', 'memAvailableSamplePeriodNs', 'continuousCpuUtilizationMaximumBasisPoints', 'continuousCpuPsiSomeMaximumBasisPoints', 'continuousMemoryPsiSomeMaximumBasisPoints', 'continuousMemoryPsiFullMaximumBasisPoints', 'partialEpochsRequired']),
  timingLaunchDiscipline: Object.freeze(['clockId', 'declaredClockTickNs', 'clockCorrelationUncertaintyLimitNs', 'coldLaunchRequired', 'stdioMode', 'watchdogNs', 'drainTimerNs', 'cutoffTimerNs', 'childArmToCutoffCallMinimumNs', 'childArmToCutoffCallMaximumNs', 'childCutoffCallToExitMaximumNs', 'controlFirstReturnToExitMaximumNs', 'segmentPolicyMarginNs', 'minimumElapsedPolicyMarginNs', 'minimumElapsedHardFloorNs', 'deadlineDetectionLatencyLimitNs', 'signalMonitorEventLatencyLimitNs', 'signalMonitorDrainLatencyLimitNs', 'maximumTerminationEpisodes']),
  qualificationRow: Object.freeze(['schema', 'rowId', 'campaignId', 'campaignAttemptNumber', 'ledgerHeadSha256', 'environmentSha256', 'substrateAttestationSha256', 'trustManifestSha256', 'runtimeSha256', 'launcherSha256', 'runtimeContractSha256', 'clockContractSha256', 'monitorSha256', 'signalMonitorCoverageEvidenceSha256', 'deadlineDetectorSha256', 'privilegeSeparationPolicySha256', 'analyzerSha256', 'analyzerPolicySha256', 'injectionManifestSha256', 'productionGraphSha256', 'instrumentedCompliantGraphSha256', 'instrumentedControlGraphSha256', 'bootstrapNegativeGraphSha256s', 'compliantRuns', 'controlRuns', 'pairResults', 'timingPolicy', 'residualExternalInterference', 'result']),
  timingPolicy: Object.freeze(['declaredClockTickNs', 'clockCorrelationUncertaintyLimitNs', 'clockCorrelationUncertaintyNs', 'segmentPolicyMarginNs', 'minimumElapsedPolicyMarginNs', 'minimumElapsedHardFloorNs', 'childArmToCutoffCallMinimumNs', 'childArmToCutoffCallMaximumNs', 'childCutoffCallToExitMaximumNs', 'controlFirstReturnToExitMaximumNs', 'pairMinimumDifferenceNs', 'observedLaunchToArmMaximumNs', 'observedExitToObservedExitMaximumNs', 'observedMinimumElapsedNs', 'observedArmToCutoffCallMinimumNs', 'observedArmToCutoffCallMaximumNs', 'observedCutoffCallToExitMaximumNs', 'qualifiedArmToCutoffCallLowerNs', 'qualifiedMinimumElapsedNs', 'qualifiedLaunchToArmUpperNs', 'qualifiedExitToObservationUpperNs', 'qualifiedArmToCutoffCallUpperNs', 'qualifiedCutoffCallToExitUpperNs', 'qualifiedCutoffCallToObservedExitUpperNs', 'qualifiedLaunchToObservedExitUpperNs', 'minimumLowerHeadroomNs', 'minimumUpperHeadroomNs', 'deadlineDetectionLatencyLimitNs', 'deadlineDetectionLatenciesNs', 'signalMonitorEventLatencyLimitNs', 'signalMonitorDrainLatencyLimitNs', 'signalMonitorCoverageFixtureMaxEventLatencyNs', 'signalMonitorCoverageFixtureDrainLatencyNs', 'signalMonitorCoverageFixtureReservationFailureCount', 'signalMonitorCoverageFixtureMapFailureCount', 'derivationIdentifier']),
  compliantRun: Object.freeze(['runIndex', 'tLaunchNs', 'tArmNs', 'tCutoffEntryNs', 'tCutoffCallNs', 'tExitNs', 'tOsExitObservedNs', 'launchToArmNs', 'armToCutoffCallNs', 'cutoffCallToExitNs', 'exitToObservedExitNs', 'cutoffCallToObservedExitNs', 'elapsedLaunchToObservedExitNs', 'osStatus', 'osSignal', 'capturedExitInvocationCount', 'callbackEntryToExitSeamOrdinalDelta', 'lowerHeadroomNs', 'upperHeadroomNs', 'boundaryLogSha256', 'sampleLogSha256', 'eventLogSha256', 'transcriptSha256', 'terminationEvidenceSha256', 'privilegeDropEvidenceSha256', 'signalMonitorProducedEventCount', 'signalMonitorConsumedEventCount', 'signalMonitorReservationFailureCount', 'signalMonitorMapFailureCount', 'signalMonitorMaxEventLatencyNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs', 'signalMonitorDrainLatencyNs', 'envelopeVerdict', 'timingVerdict', 'exitSignatureVerdict', 'failureCodes']),
  controlRun: Object.freeze(['runIndex', 'tLaunchNs', 'tArmNs', 'tFirstReturnNs', 'tExitNs', 'tOsExitObservedNs', 'armToFirstReturnNs', 'firstReturnToExitNs', 'elapsedLaunchToObservedExitNs', 'osStatus', 'osSignal', 'capturedExitInvocationCount', 'cutoffCallbackEntryCount', 'boundaryLogSha256', 'sampleLogSha256', 'eventLogSha256', 'transcriptSha256', 'terminationEvidenceSha256', 'privilegeDropEvidenceSha256', 'signalMonitorProducedEventCount', 'signalMonitorConsumedEventCount', 'signalMonitorReservationFailureCount', 'signalMonitorMapFailureCount', 'signalMonitorMaxEventLatencyNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs', 'signalMonitorDrainLatencyNs', 'envelopeVerdict', 'controlVerdict', 'failureCodes']),
  pairResult: Object.freeze(['runIndex', 'compliantRunIndex', 'controlRunIndex', 'dCompliantNs', 'dControlNs', 'differenceNs', 'minimumDifferenceNs', 'pass']),
  coverageManifest: Object.freeze(['schema', 'campaignId', 'monitorSha256', 'rawEventsSha256', 'perCpuSequencesSha256', 'counterSnapshotsSha256', 'fixtureResultsSha256', 'tracepointLinkStateSha256', 'coverageFixtureCount', 'maximumEventLatencyNs', 'maximumDrainLatencyNs']),
  signalMonitorRawEvents: Object.freeze(['schema', 'campaignId', 'monitorSha256', 'events']),
  signalMonitorRawEvent: Object.freeze(['fixtureId', 'tEventNs', 'tConsumeNs', 'signalNumber', 'signalName', 'kind', 'senderPid', 'senderTgid', 'targetPid', 'targetTgid', 'targetStartTimeTicks', 'targetCgroupId', 'cpu', 'eventSequence']),
  signalMonitorPerCpuSequences: Object.freeze(['schema', 'campaignId', 'monitorSha256', 'fixtures']),
  signalMonitorSequenceFixture: Object.freeze(['fixtureId', 'cpus']),
  signalMonitorSequenceCpu: Object.freeze(['cpu', 'baselineEventSequence', 'eventSequences']),
  signalMonitorCounterSnapshots: Object.freeze(['schema', 'campaignId', 'monitorSha256', 'snapshots']),
  signalMonitorCounterSnapshot: Object.freeze(['fixtureId', 'phase', 'snapshotOrdinal', 'tSnapshotNs', 'linksStable', 'identityStable', 'cpus']),
  signalMonitorCounterCpu: Object.freeze(['cpu', 'producedCount', 'consumedCount', 'reservationFailureCount', 'mapFailureCount', 'lastEventSequence']),
  signalMonitorFixtureResults: Object.freeze(['schema', 'campaignId', 'monitorSha256', 'fixtures']),
  signalMonitorFixtureResult: Object.freeze(['fixtureId', 'fixtureKind', 'terminatingSignal', 'expectedGenerationObserved', 'expectedDeliveryObserved', 'zeroLossCounters', 'contiguousPerCpuSequences', 'producerConsumerEqual', 'stableFinalDrain', 'maximumEventLatencyNs', 'drainLatencyNs', 'pass']),
  signalMonitorTracepointLinkState: Object.freeze(['schema', 'campaignId', 'monitorSha256', 'links']),
  signalMonitorTracepointLink: Object.freeze(['name', 'programId', 'linkId', 'attachedBeforeCampaign', 'attachedThroughCampaign', 'identityStable']),
  signalUnavailabilityEvidence: Object.freeze(['schema', 'environmentSha256', 'authorityConfigurationSha256', 'signals']),
  signalUnavailabilityRecord: Object.freeze(['signal', 'reason', 'evidenceSha256']),
  residualInterferenceDerivation: Object.freeze(['schema', 'environmentSha256', 'classes']),
  residualInterferenceClass: Object.freeze(['class', 'disposition', 'basis', 'evidenceSha256']),
  productionEnvelope: Object.freeze(['schema', 'executionId', 'claimType', 'claimSemantics', 'qualificationRowSha256', 'environmentSha256', 'substrateAttestationSha256', 'trustManifestSha256', 'monitorSha256', 'signalMonitorCoverageEvidenceSha256', 'deadlineDetectorSha256', 'privilegeSeparationPolicySha256', 'runtimeSha256', 'launcherSha256', 'productionGraphSha256', 'prelaunchSnapshotSha256', 'postExitSnapshotSha256', 'sampleLogSha256', 'eventLogSha256', 'terminationEvidenceSha256', 'privilegeDropEvidenceSha256', 'launchState', 'tLaunchNs', 'qualifiedMinimumElapsedNs', 'qualifiedLaunchToArmUpperNs', 'qualifiedExitToObservationUpperNs', 'qualifiedArmToCutoffCallUpperNs', 'qualifiedCutoffCallToExitUpperNs', 'qualifiedCutoffCallToObservedExitUpperNs', 'qualifiedLaunchToObservedExitUpperNs', 'parentObservedDeadlineNs', 'tTimerArmedNs', 'tTimerfdReadNs', 'deadlineDetectionLatencyNs', 'tOsExitObservedNs', 'elapsedLaunchToObservedExitNs', 'osStatus', 'osSignal', 'oomDelta', 'oomKillDelta', 'oomGroupKillDelta', 'cgroupKillCount', 'supervisorTerminationCount', 'terminatingSignalEventCount', 'signalMonitorProducedEventCount', 'signalMonitorConsumedEventCount', 'signalMonitorReservationFailureCount', 'signalMonitorMapFailureCount', 'signalMonitorMaxEventLatencyNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs', 'signalMonitorDrainLatencyNs', 'envelopeVerdict', 'timingVerdict', 'exitSignatureVerdict', 'failureCodes', 'claimEligible', 'finalizationState'])
});

function schemaFail(message) {
  throw new TerminationSafetyError('INVALID_SCHEMA', message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, label) {
  if (!isPlainObject(value)) schemaFail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) schemaFail(`${label} must contain exactly its closed property set`);
}

function literal(value, expected, label) {
  if (value !== expected) schemaFail(`${label} must equal ${String(expected)}`);
}

function uint(value, label, options = {}) {
  try { return asUInt64(value, label, options); } catch { schemaFail(`${label} must be a UInt64${options.positive ? ' greater than zero' : ''}`); }
}

function boundedInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) schemaFail(`${label} is outside its integer range`);
}

function hash(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) schemaFail(`${label} must be a SHA-256 digest`);
}

function hashOrNotApplicable(value, label) {
  if (value !== 'not-applicable') hash(value, label);
}

function ascii(value, label, maximum = 128) {
  const pattern = maximum === 128 ? ASCII_128 : ASCII_256;
  if (typeof value !== 'string' || !pattern.test(value)) schemaFail(`${label} must be printable non-space ASCII of bounded length`);
}

function sortedUnique(array, label, validate) {
  if (!Array.isArray(array)) schemaFail(`${label} must be an array`);
  for (let index = 0; index < array.length; index += 1) {
    validate(array[index], `${label}[${index}]`);
    if (index && !(String(array[index - 1]) < String(array[index]))) schemaFail(`${label} must be byte-sorted and duplicate-free`);
  }
}

function failureCodes(value, label = 'failureCodes') {
  sortedUnique(value, label, (item, itemLabel) => {
    if (!FAILURE_CODE_SET.has(item)) schemaFail(`${itemLabel} is not a production failure code`);
  });
}

function cpuList(value, label) {
  if (typeof value !== 'string' || !value.length || /\s/u.test(value)) schemaFail(`${label} must be a canonical CPU/Node list`);
  const intervals = [];
  let cardinality = 0n;
  let previousEnd = -2n;
  for (const term of value.split(',')) {
    const match = /^(0|[1-9][0-9]*)(?:-(0|[1-9][0-9]*))?$/u.exec(term);
    if (!match) schemaFail(`${label} has a malformed term`);
    const start = BigInt(match[1]);
    const end = match[2] === undefined ? start : BigInt(match[2]);
    uint(start, `${label}.start`); uint(end, `${label}.end`);
    if (end < start || start <= previousEnd + 1n) schemaFail(`${label} is overlapping, unordered, or coalescible`);
    cardinality = checkedAdd(cardinality, end - start + 1n, `${label}.cardinality`);
    intervals.push([start, end]);
    previousEnd = end;
  }
  return Object.freeze({ intervals: Object.freeze(intervals), cardinality, includes: (candidate) => {
    const valueToFind = uint(candidate, `${label}.member`);
    return intervals.some(([start, end]) => valueToFind >= start && valueToFind <= end);
  } });
}

function uintOrMax(value, label) {
  if (value !== 'max') uint(value, label);
}

function uintOrNotApplicable(value, label) {
  if (value !== 'not-applicable') uint(value, label);
}

function enumValue(value, values, label) {
  if (!values.has(value)) schemaFail(`${label} is outside its closed enum`);
}

function sameBigInt(left, right, label) {
  if (uint(left, `${label}.left`) !== uint(right, `${label}.right`)) schemaFail(`${label} does not satisfy its equation`);
}

function difference(end, start, label) {
  try { return checkedSubtract(end, start, label); } catch { schemaFail(`${label} is negative or invalid`); }
}

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') {
    uint(value, 'canonical integer');
    return value.toString();
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) schemaFail('canonical JSON numbers must be exactly represented integers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!isPlainObject(value)) schemaFail('canonical JSON contains an unsupported value');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function canonicalSha256(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function parseCanonicalJsonBytes(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { schemaFail('document is not valid UTF-8'); }
  let cursor = 0;
  const whitespace = () => { while (/[\x20\x09\x0a\x0d]/u.test(source[cursor] ?? '')) cursor += 1; };
  const parseString = () => {
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < source.length) {
      const code = source.charCodeAt(cursor);
      if (!escaped && code === 0x22) { cursor += 1; try { return JSON.parse(source.slice(start, cursor)); } catch { schemaFail('invalid JSON string'); } }
      if (!escaped && code < 0x20) schemaFail('unescaped JSON control character');
      if (!escaped && code === 0x5c) escaped = true;
      else escaped = false;
      cursor += 1;
    }
    schemaFail('unterminated JSON string');
  };
  const parseValue = () => {
    whitespace();
    const token = source[cursor];
    if (token === '"') return parseString();
    if (token === '[') {
      cursor += 1; whitespace(); const result = [];
      if (source[cursor] === ']') { cursor += 1; return result; }
      while (true) {
        result.push(parseValue()); whitespace();
        if (source[cursor] === ']') { cursor += 1; return result; }
        if (source[cursor] !== ',') schemaFail('invalid JSON array');
        cursor += 1;
      }
    }
    if (token === '{') {
      cursor += 1; whitespace(); const result = Object.create(null);
      if (source[cursor] === '}') { cursor += 1; return result; }
      while (true) {
        whitespace(); if (source[cursor] !== '"') schemaFail('object key must be a string');
        const key = parseString(); if (Object.hasOwn(result, key)) schemaFail('duplicate JSON object key');
        whitespace(); if (source[cursor] !== ':') schemaFail('invalid JSON object'); cursor += 1;
        result[key] = parseValue(); whitespace();
        if (source[cursor] === '}') { cursor += 1; return result; }
        if (source[cursor] !== ',') schemaFail('invalid JSON object'); cursor += 1;
      }
    }
    for (const [literalToken, value] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(literalToken, cursor)) { cursor += literalToken.length; return value; }
    }
    const match = /^-?(?:0|[1-9][0-9]*)/u.exec(source.slice(cursor));
    if (!match) schemaFail('invalid or nonintegral JSON number');
    cursor += match[0].length;
    const integer = BigInt(match[0]);
    return integer >= BigInt(Number.MIN_SAFE_INTEGER) && integer <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(integer) : integer;
  };
  const value = parseValue(); whitespace();
  if (cursor !== source.length) schemaFail('trailing JSON bytes');
  if (canonicalJson(value) !== source) schemaFail('document is not RFC 8785 canonical JSON');
  return value;
}

export function validateCanonicalJsonBytes(input, validator, ...args) {
  if (typeof validator !== 'function') schemaFail('canonical document validator is required');
  const value = parseCanonicalJsonBytes(input);
  validator(value, ...args);
  return value;
}

export function validateQualificationEnvironment(environment) {
  exactKeys(environment, SCHEMA_KEYS.qualificationEnvironment, 'qualification environment');
  literal(environment.schema, 'kstack.qualification-environment/v2', 'schema');
  const host = environment.hostRuntimeSubstrate;
  exactKeys(host, SCHEMA_KEYS.hostRuntimeSubstrate, 'hostRuntimeSubstrate');
  for (const field of ['hostIdentitySha256', 'numaTopologySha256', 'btfSha256', 'tracepointFormatsSha256']) hash(host[field], `hostRuntimeSubstrate.${field}`);
  ascii(host.osDistribution, 'osDistribution'); ascii(host.osVersion, 'osVersion'); ascii(host.kernelBuild, 'kernelBuild', 256);
  ascii(host.cpuVendor, 'cpuVendor'); ascii(host.microcode, 'microcode'); ascii(host.clocksource, 'clocksource');
  enumValue(host.architecture, ARCHITECTURES, 'architecture'); enumValue(host.substrateKind, SUBSTRATE_KINDS, 'substrateKind');
  for (const field of ['cpuFamily', 'cpuModel', 'cpuStepping']) uint(host[field], field);
  uint(host.physicalCoreCount, 'physicalCoreCount', { positive: true });
  const logicalCount = uint(host.logicalCpuCount, 'logicalCpuCount', { positive: true });
  const online = cpuList(host.onlineCpuList, 'onlineCpuList');
  if (online.cardinality !== logicalCount) schemaFail('onlineCpuList cardinality must equal logicalCpuCount');
  if (typeof host.nestedVirtualization !== 'boolean') schemaFail('nestedVirtualization must be boolean');
  if (host.substrateKind === 'bare-metal') {
    literal(host.hypervisorOrRuntime, 'not-applicable', 'hypervisorOrRuntime');
    literal(host.hypervisorOrRuntimeVersion, 'not-applicable', 'hypervisorOrRuntimeVersion');
    literal(host.machineImageSha256, 'not-applicable', 'machineImageSha256');
    literal(host.nestedVirtualization, false, 'nestedVirtualization');
  } else {
    ascii(host.hypervisorOrRuntime, 'hypervisorOrRuntime');
    ascii(host.hypervisorOrRuntimeVersion, 'hypervisorOrRuntimeVersion');
    hash(host.machineImageSha256, 'machineImageSha256');
  }

  const resources = environment.resourceAllocation;
  exactKeys(resources, SCHEMA_KEYS.resourceAllocation, 'resourceAllocation');
  const child = cpuList(resources.childCpuList, 'childCpuList');
  cpuList(resources.childNodeList, 'childNodeList');
  const housekeeping = cpuList(resources.housekeepingCpuList, 'housekeepingCpuList');
  const deadlineCpu = uint(resources.deadlineDetectorCpu, 'deadlineDetectorCpu');
  const signalCpu = uint(resources.signalMonitorCpu, 'signalMonitorCpu');
  if (deadlineCpu === signalCpu || !housekeeping.includes(deadlineCpu) || !housekeeping.includes(signalCpu)
      || !online.includes(deadlineCpu) || !online.includes(signalCpu) || child.includes(deadlineCpu) || child.includes(signalCpu)) {
    schemaFail('monitor CPUs must be distinct online housekeeping CPUs outside the child allocation');
  }
  uint(resources.workloadCgroupMountId, 'workloadCgroupMountId', { positive: true });
  uint(resources.workloadCgroupInode, 'workloadCgroupInode', { positive: true });
  hash(resources.workloadCgroupConfigurationSha256, 'workloadCgroupConfigurationSha256');
  uintOrMax(resources.cgroupCpuQuotaMicros, 'cgroupCpuQuotaMicros'); uint(resources.cgroupCpuPeriodMicros, 'cgroupCpuPeriodMicros', { positive: true });
  boundedInteger(resources.cgroupCpuWeight, 1, 10_000, 'cgroupCpuWeight');
  uintOrMax(resources.memoryLimitBytes, 'memoryLimitBytes'); uintOrMax(resources.swapLimitBytes, 'swapLimitBytes');
  literal(resources.numaBinding, 'strict', 'numaBinding'); enumValue(resources.childSchedulerClass, SCHEDULER_CLASSES, 'childSchedulerClass');
  boundedInteger(resources.childNiceValue, -20, 19, 'childNiceValue'); literal(resources.supervisorSchedulerClass, 'SCHED_FIFO', 'supervisorSchedulerClass');
  literal(resources.supervisorPriority, 80, 'supervisorPriority'); uint(resources.workloadUid, 'workloadUid'); uint(resources.workloadGid, 'workloadGid');
  hash(resources.privilegeSeparationPolicySha256, 'privilegeSeparationPolicySha256');

  const isolation = environment.concurrencyIsolation;
  exactKeys(isolation, SCHEMA_KEYS.concurrencyIsolation, 'concurrencyIsolation');
  const fixedIsolation = {
    maximumConcurrentChildren: 1, oneChildAtATime: true, consecutiveQualificationPairs: true,
    overlappingPairsAllowed: false, foreignRunnableTasksAllowed: 0, completeSmtSiblingAllocation: true,
    offlineUnallocatedChildSmtSiblings: true, childCpusetPartition: 'isolated', deadlineDetectorCpuExclusive: true,
    signalMonitorCpuExclusive: true, monitorCpusDistinct: true, cpuHotplugAllowed: false, startBarrierRequired: true
  };
  for (const [field, value] of Object.entries(fixedIsolation)) literal(isolation[field], value, `concurrencyIsolation.${field}`);
  for (const field of ['irqAffinitySha256', 'kernelWorkerAllowlistSha256', 'schedulerMonitorSha256']) hash(isolation[field], field);
  if (!['enforced', 'not-applicable'].includes(isolation.resctrlMode)) schemaFail('resctrlMode is invalid');
  if ((isolation.resctrlMode === 'enforced') !== (isolation.resctrlConfigurationSha256 !== 'not-applicable')) schemaFail('resctrl mode/digest biconditional failed');
  hashOrNotApplicable(isolation.resctrlConfigurationSha256, 'resctrlConfigurationSha256');

  const power = environment.powerThermalPolicy;
  exactKeys(power, SCHEMA_KEYS.powerThermalPolicy, 'powerThermalPolicy');
  enumValue(power.powerProfile, POWER_PROFILES, 'powerProfile'); enumValue(power.governor, GOVERNORS, 'governor');
  const minimumFrequency = uint(power.minimumFrequencyKHz, 'minimumFrequencyKHz', { positive: true });
  const maximumFrequency = uint(power.maximumFrequencyKHz, 'maximumFrequencyKHz', { positive: true });
  if (minimumFrequency > maximumFrequency) schemaFail('minimumFrequencyKHz exceeds maximumFrequencyKHz');
  if (typeof power.turboEnabled !== 'boolean') schemaFail('turboEnabled must be boolean');
  uintOrNotApplicable(power.powerCapMilliwatts, 'powerCapMilliwatts'); hash(power.thermalSensorSetSha256, 'thermalSensorSetSha256');
  hashOrNotApplicable(power.powerSensorSetSha256, 'powerSensorSetSha256'); uint(power.thermalMaximumMilliCelsius, 'thermalMaximumMilliCelsius', { positive: true });
  literal(power.thermalSamplePeriodNs, 1_000_000, 'thermalSamplePeriodNs'); hashOrNotApplicable(power.policyEventStreamSha256, 'policyEventStreamSha256');
  literal(power.policyHeartbeatLimitNs, 10_000_000, 'policyHeartbeatLimitNs');
  if (environment.substrateAttestationSha256 === 'not-applicable'
      && [power.powerCapMilliwatts, power.powerSensorSetSha256, power.policyEventStreamSha256].includes('not-applicable')) {
    schemaFail('not-applicable attestation requires every power/policy signal');
  }

  const admission = environment.loadAdmissionPolicy;
  exactKeys(admission, SCHEMA_KEYS.loadAdmissionPolicy, 'loadAdmissionPolicy');
  const fixedAdmission = {
    prelaunchWindowNs: 1_000_000_000, prelaunchCpuUtilizationMaximumBasisPoints: 500,
    prelaunchForeignRunnableTaskMaximum: 0, prelaunchRunQueueDepthMaximum: 1,
    prelaunchCpuPsiSomeAvg10MaximumBasisPoints: 50, prelaunchMemoryPsiSomeAvg10MaximumBasisPoints: 50,
    prelaunchMemoryPsiFullAvg10MaximumBasisPoints: 10, prelaunchMemAvailableMinimumBytes: 2_147_483_648,
    continuousEpochNs: 10_000_000, memAvailableSamplePeriodNs: 1_000_000,
    continuousCpuUtilizationMaximumBasisPoints: 500, continuousCpuPsiSomeMaximumBasisPoints: 500,
    continuousMemoryPsiSomeMaximumBasisPoints: 100, continuousMemoryPsiFullMaximumBasisPoints: 0,
    partialEpochsRequired: true
  };
  for (const [field, value] of Object.entries(fixedAdmission)) literal(admission[field], value, `loadAdmissionPolicy.${field}`);

  const timing = environment.timingLaunchDiscipline;
  exactKeys(timing, SCHEMA_KEYS.timingLaunchDiscipline, 'timingLaunchDiscipline');
  const fixedTiming = {
    clockId: 'CLOCK_MONOTONIC', clockCorrelationUncertaintyLimitNs: 100_000, coldLaunchRequired: true,
    stdioMode: 'preopened-fixed-nonblocking', watchdogNs: 5_000_000_000, drainTimerNs: 500_000_000,
    cutoffTimerNs: 2_500_000_000, childArmToCutoffCallMinimumNs: 2_400_000_000,
    childArmToCutoffCallMaximumNs: 3_200_000_000, childCutoffCallToExitMaximumNs: 250_000_000,
    controlFirstReturnToExitMaximumNs: 500_000_000, segmentPolicyMarginNs: 50_000_000,
    minimumElapsedPolicyMarginNs: 100_000_000, minimumElapsedHardFloorNs: 2_250_000_000,
    deadlineDetectionLatencyLimitNs: 1_000_000, signalMonitorEventLatencyLimitNs: 1_000_000,
    signalMonitorDrainLatencyLimitNs: 1_000_000, maximumTerminationEpisodes: 1
  };
  uint(timing.declaredClockTickNs, 'declaredClockTickNs', { positive: true });
  for (const [field, value] of Object.entries(fixedTiming)) literal(timing[field], value, `timingLaunchDiscipline.${field}`);
  sortedUnique(environment.residualExternalInterference, 'residualExternalInterference', (item, label) => enumValue(item, RESIDUAL_INTERFERENCE, label));
  hashOrNotApplicable(environment.substrateAttestationSha256, 'substrateAttestationSha256');
  return true;
}

function validateRunDigests(run) {
  for (const field of ['boundaryLogSha256', 'sampleLogSha256', 'eventLogSha256', 'transcriptSha256', 'terminationEvidenceSha256', 'privilegeDropEvidenceSha256']) hash(run[field], field);
}

function validateMonitorRunFields(run, label) {
  const produced = uint(run.signalMonitorProducedEventCount, `${label}.signalMonitorProducedEventCount`);
  const consumed = uint(run.signalMonitorConsumedEventCount, `${label}.signalMonitorConsumedEventCount`);
  if (produced !== consumed) schemaFail(`${label} monitor producer/consumer counts differ`);
  literal(run.signalMonitorReservationFailureCount, 0, `${label}.signalMonitorReservationFailureCount`);
  literal(run.signalMonitorMapFailureCount, 0, `${label}.signalMonitorMapFailureCount`);
  if (uint(run.signalMonitorMaxEventLatencyNs, `${label}.signalMonitorMaxEventLatencyNs`) > 1_000_000n) schemaFail(`${label} event latency exceeds 1 ms`);
  if (produced === 0n && uint(run.signalMonitorMaxEventLatencyNs, `${label}.signalMonitorMaxEventLatencyNs`) !== 0n) schemaFail(`${label} empty monitor coverage must use the exact zero identity`);
  const drain = difference(run.tSignalMonitorFinalDrainEndNs, run.tSignalMonitorFinalDrainStartNs, `${label}.signalMonitorDrainLatencyNs`);
  sameBigInt(run.signalMonitorDrainLatencyNs, drain, `${label}.signalMonitorDrainLatencyNs`);
  if (drain > 1_000_000n) schemaFail(`${label} drain latency exceeds 1 ms`);
}

function validateCompliantRun(run, index, timing) {
  const label = `compliantRuns[${index}]`;
  exactKeys(run, SCHEMA_KEYS.compliantRun, label); literal(run.runIndex, index + 1, `${label}.runIndex`);
  const timestamps = ['tLaunchNs', 'tArmNs', 'tCutoffEntryNs', 'tCutoffCallNs', 'tExitNs', 'tOsExitObservedNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs'];
  for (const field of timestamps) uint(run[field], `${label}.${field}`);
  for (let position = 1; position < timestamps.length; position += 1) if (uint(run[timestamps[position - 1]], label) > uint(run[timestamps[position]], label)) schemaFail(`${label} timestamp order failed`);
  const launchToArm = difference(run.tArmNs, run.tLaunchNs, `${label}.launchToArmNs`);
  const armToCall = difference(run.tCutoffCallNs, run.tArmNs, `${label}.armToCutoffCallNs`);
  const callToExit = difference(run.tExitNs, run.tCutoffCallNs, `${label}.cutoffCallToExitNs`);
  const exitToObserved = difference(run.tOsExitObservedNs, run.tExitNs, `${label}.exitToObservedExitNs`);
  const callToObserved = difference(run.tOsExitObservedNs, run.tCutoffCallNs, `${label}.cutoffCallToObservedExitNs`);
  const elapsed = difference(run.tOsExitObservedNs, run.tLaunchNs, `${label}.elapsedLaunchToObservedExitNs`);
  for (const [field, value] of Object.entries({ launchToArmNs: launchToArm, armToCutoffCallNs: armToCall, cutoffCallToExitNs: callToExit, exitToObservedExitNs: exitToObserved, cutoffCallToObservedExitNs: callToObserved, elapsedLaunchToObservedExitNs: elapsed })) sameBigInt(run[field], value, `${label}.${field}`);
  if (armToCall < 2_400_000_000n || armToCall > 3_200_000_000n || callToExit > 250_000_000n || elapsed === 0n) schemaFail(`${label} timing interval is outside its bound`);
  if (callToObserved !== checkedAdd(callToExit, exitToObserved, `${label}.callToObserved`)) schemaFail(`${label} call-to-observed equation failed`);
  literal(run.osStatus, 1, `${label}.osStatus`); literal(run.osSignal, 'none', `${label}.osSignal`);
  literal(run.capturedExitInvocationCount, 2, `${label}.capturedExitInvocationCount`); literal(run.callbackEntryToExitSeamOrdinalDelta, 1, `${label}.callbackEntryToExitSeamOrdinalDelta`);
  sameBigInt(run.lowerHeadroomNs, checkedSubtract(elapsed, timing.qualifiedMinimumElapsedNs, `${label}.lowerHeadroom`), `${label}.lowerHeadroomNs`);
  sameBigInt(run.upperHeadroomNs, checkedSubtract(timing.qualifiedLaunchToObservedExitUpperNs, elapsed, `${label}.upperHeadroom`), `${label}.upperHeadroomNs`);
  validateRunDigests(run); validateMonitorRunFields(run, label);
  literal(run.envelopeVerdict, 'within-qualified-envelope', `${label}.envelopeVerdict`); literal(run.timingVerdict, 'within-qualified-elapsed-window', `${label}.timingVerdict`); literal(run.exitSignatureVerdict, 'qualified-exit-signature', `${label}.exitSignatureVerdict`);
  failureCodes(run.failureCodes, `${label}.failureCodes`); if (run.failureCodes.length) schemaFail(`${label}.failureCodes must be empty`);
}

function validateControlRun(run, index) {
  const label = `controlRuns[${index}]`;
  exactKeys(run, SCHEMA_KEYS.controlRun, label); literal(run.runIndex, index + 1, `${label}.runIndex`);
  const timestamps = ['tLaunchNs', 'tArmNs', 'tFirstReturnNs', 'tExitNs', 'tOsExitObservedNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs'];
  for (const field of timestamps) uint(run[field], `${label}.${field}`);
  for (let position = 1; position < timestamps.length; position += 1) if (uint(run[timestamps[position - 1]], label) > uint(run[timestamps[position]], label)) schemaFail(`${label} timestamp order failed`);
  sameBigInt(run.armToFirstReturnNs, difference(run.tFirstReturnNs, run.tArmNs, `${label}.armToFirstReturnNs`), `${label}.armToFirstReturnNs`);
  const returnToExit = difference(run.tExitNs, run.tFirstReturnNs, `${label}.firstReturnToExitNs`);
  sameBigInt(run.firstReturnToExitNs, returnToExit, `${label}.firstReturnToExitNs`);
  if (returnToExit > 500_000_000n) schemaFail(`${label} exceeds the control drain maximum`);
  const elapsed = difference(run.tOsExitObservedNs, run.tLaunchNs, `${label}.elapsedLaunchToObservedExitNs`);
  sameBigInt(run.elapsedLaunchToObservedExitNs, elapsed, `${label}.elapsedLaunchToObservedExitNs`); if (elapsed === 0n) schemaFail(`${label} elapsed must be positive`);
  literal(run.osStatus, 70, `${label}.osStatus`); literal(run.osSignal, 'none', `${label}.osSignal`); literal(run.capturedExitInvocationCount, 1, `${label}.capturedExitInvocationCount`); literal(run.cutoffCallbackEntryCount, 0, `${label}.cutoffCallbackEntryCount`);
  validateRunDigests(run); validateMonitorRunFields(run, label);
  literal(run.envelopeVerdict, 'within-qualified-envelope', `${label}.envelopeVerdict`); literal(run.controlVerdict, 'expected-unref-natural-drain', `${label}.controlVerdict`);
  failureCodes(run.failureCodes, `${label}.failureCodes`); if (run.failureCodes.length) schemaFail(`${label}.failureCodes must be empty`);
}

function compareTimingPolicy(stored, derived) {
  for (const key of Object.keys(derived)) {
    if (key === 'pairResults') continue;
    if (!Object.hasOwn(stored, key)) continue;
    if (typeof derived[key] === 'bigint') sameBigInt(stored[key], derived[key], `timingPolicy.${key}`);
    else literal(stored[key], derived[key], `timingPolicy.${key}`);
  }
}

export function validateQualificationRow(row, { environment, coverageManifest = null, coverageArtifacts = null } = {}) {
  exactKeys(row, SCHEMA_KEYS.qualificationRow, 'qualification row'); literal(row.schema, 'kstack.qualification-row/v3', 'schema');
  ascii(row.rowId, 'rowId'); ascii(row.campaignId, 'campaignId'); boundedInteger(row.campaignAttemptNumber, 1, 3, 'campaignAttemptNumber');
  for (const field of ['ledgerHeadSha256', 'environmentSha256', 'trustManifestSha256', 'runtimeSha256', 'launcherSha256', 'runtimeContractSha256', 'clockContractSha256', 'monitorSha256', 'signalMonitorCoverageEvidenceSha256', 'deadlineDetectorSha256', 'privilegeSeparationPolicySha256', 'analyzerSha256', 'analyzerPolicySha256', 'injectionManifestSha256', 'productionGraphSha256', 'instrumentedCompliantGraphSha256', 'instrumentedControlGraphSha256']) hash(row[field], field);
  hashOrNotApplicable(row.substrateAttestationSha256, 'substrateAttestationSha256');
  sortedUnique(row.bootstrapNegativeGraphSha256s, 'bootstrapNegativeGraphSha256s', hash); if (row.bootstrapNegativeGraphSha256s.length !== 4) schemaFail('bootstrapNegativeGraphSha256s must contain exactly four distinct values');
  if (!Array.isArray(row.compliantRuns) || row.compliantRuns.length !== 10 || !Array.isArray(row.controlRuns) || row.controlRuns.length !== 10 || !Array.isArray(row.pairResults) || row.pairResults.length !== 10) schemaFail('run and pair tuples must each contain exactly ten records');
  exactKeys(row.timingPolicy, SCHEMA_KEYS.timingPolicy, 'timingPolicy');
  const deadlineLatencies = row.timingPolicy.deadlineDetectionLatenciesNs;
  if (!Array.isArray(deadlineLatencies) || deadlineLatencies.length !== 10 || deadlineLatencies.some((value, index) => uint(value, `deadlineDetectionLatenciesNs[${index}]`) > 1_000_000n)) schemaFail('deadline detection qualification must contain ten values at most 1 ms');
  if (uint(row.timingPolicy.signalMonitorCoverageFixtureMaxEventLatencyNs, 'coverage event latency') > 1_000_000n || uint(row.timingPolicy.signalMonitorCoverageFixtureDrainLatencyNs, 'coverage drain latency') > 1_000_000n) schemaFail('coverage monitor latency exceeds 1 ms');
  literal(row.timingPolicy.signalMonitorCoverageFixtureReservationFailureCount, 0, 'coverage reservation failures'); literal(row.timingPolicy.signalMonitorCoverageFixtureMapFailureCount, 0, 'coverage map failures');
  for (let index = 0; index < 10; index += 1) { validateCompliantRun(row.compliantRuns[index], index, row.timingPolicy); validateControlRun(row.controlRuns[index], index); }
  const derived = deriveQualificationTiming({ declaredClockTickNs: row.timingPolicy.declaredClockTickNs, clockCorrelationUncertaintyNs: row.timingPolicy.clockCorrelationUncertaintyNs, compliantRuns: row.compliantRuns, controlRuns: row.controlRuns });
  compareTimingPolicy(row.timingPolicy, derived);
  for (let index = 0; index < 10; index += 1) {
    const pair = row.pairResults[index]; const expected = derived.pairResults[index]; const label = `pairResults[${index}]`;
    exactKeys(pair, SCHEMA_KEYS.pairResult, label);
    for (const field of ['runIndex', 'compliantRunIndex', 'controlRunIndex', 'dCompliantNs', 'dControlNs', 'differenceNs', 'minimumDifferenceNs']) sameBigInt(pair[field], expected[field], `${label}.${field}`);
    literal(pair.pass, true, `${label}.pass`);
  }
  sortedUnique(row.residualExternalInterference, 'residualExternalInterference', (item, label) => enumValue(item, RESIDUAL_INTERFERENCE, label));
  literal(row.result, 'passing', 'result');
  if (environment) {
    validateQualificationEnvironment(environment);
    if (canonicalSha256(environment) !== row.environmentSha256 || row.substrateAttestationSha256 !== environment.substrateAttestationSha256
        || row.privilegeSeparationPolicySha256 !== environment.resourceAllocation.privilegeSeparationPolicySha256
        || JSON.stringify(row.residualExternalInterference) !== JSON.stringify(environment.residualExternalInterference)) schemaFail('row/environment bindings differ');
  }
  if (coverageManifest) validateSignalMonitorCoverageEvidence(coverageManifest, coverageArtifacts, { campaignId: row.campaignId, monitorSha256: row.monitorSha256, expectedDigest: row.signalMonitorCoverageEvidenceSha256 });
  return true;
}

function commonCoverageArtifact(document, keys, schema, label, context) {
  exactKeys(document, keys, label); literal(document.schema, schema, `${label}.schema`);
  ascii(document.campaignId, `${label}.campaignId`); hash(document.monitorSha256, `${label}.monitorSha256`);
  if (document.campaignId !== context.campaignId || document.monitorSha256 !== context.monitorSha256) schemaFail(`${label} campaign/monitor binding differs`);
}

function sortedRecords(records, label, key) {
  if (!Array.isArray(records)) schemaFail(`${label} must be an array`);
  for (let index = 0; index < records.length; index += 1) {
    const value = key(records[index]);
    if (index && !(key(records[index - 1]) < value)) schemaFail(`${label} must be byte-sorted and duplicate-free`);
  }
}

export function validateSignalMonitorRawEvents(document, context) {
  commonCoverageArtifact(document, SCHEMA_KEYS.signalMonitorRawEvents, 'kstack.signal-monitor-raw-events/v1', 'raw-events artifact', context);
  sortedRecords(document.events, 'raw-events.events', (event) => `${event?.fixtureId}\0${String(event?.tEventNs).padStart(20, '0')}\0${String(event?.cpu).padStart(20, '0')}\0${String(event?.eventSequence).padStart(20, '0')}`);
  let maximumEventLatencyNs = 0n; const eventsByFixture = new Map();
  for (const [index, event] of document.events.entries()) {
    const label = `raw-events.events[${index}]`; exactKeys(event, SCHEMA_KEYS.signalMonitorRawEvent, label); ascii(event.fixtureId, `${label}.fixtureId`);
    for (const field of ['tEventNs', 'tConsumeNs', 'senderPid', 'senderTgid', 'targetPid', 'targetTgid', 'targetStartTimeTicks', 'targetCgroupId', 'cpu', 'eventSequence']) uint(event[field], `${label}.${field}`);
    boundedInteger(event.signalNumber, 1, 64, `${label}.signalNumber`);
    if (event.signalName !== 'unmapped-or-nonterminating') enumValue(event.signalName, new Set(TERMINATING_SIGNALS), `${label}.signalName`);
    enumValue(event.kind, new Set(['generation', 'delivery']), `${label}.kind`);
    const latency = difference(event.tConsumeNs, event.tEventNs, `${label}.latencyNs`);
    if (latency > 1_000_000n) schemaFail(`${label} latency exceeds 1 ms`);
    if (latency > maximumEventLatencyNs) maximumEventLatencyNs = latency;
    if (!eventsByFixture.has(event.fixtureId)) eventsByFixture.set(event.fixtureId, []);
    eventsByFixture.get(event.fixtureId).push(event);
  }
  return Object.freeze({ maximumEventLatencyNs, fixtureIds: new Set(document.events.map((event) => event.fixtureId)), eventsByFixture });
}

export function validateSignalMonitorPerCpuSequences(document, context) {
  commonCoverageArtifact(document, SCHEMA_KEYS.signalMonitorPerCpuSequences, 'kstack.signal-monitor-per-cpu-sequences/v1', 'per-cpu-sequences artifact', context);
  sortedRecords(document.fixtures, 'per-cpu-sequences.fixtures', (fixture) => fixture?.fixtureId);
  const eventCountByFixture = new Map();
  for (const [fixtureIndex, fixture] of document.fixtures.entries()) {
    const label = `per-cpu-sequences.fixtures[${fixtureIndex}]`; exactKeys(fixture, SCHEMA_KEYS.signalMonitorSequenceFixture, label); ascii(fixture.fixtureId, `${label}.fixtureId`);
    sortedRecords(fixture.cpus, `${label}.cpus`, (cpu) => String(cpu?.cpu).padStart(20, '0'));
    if (fixture.cpus.length === 0) schemaFail(`${label}.cpus must represent every online CPU`);
    let fixtureEventCount = 0n;
    for (const [cpuIndex, cpu] of fixture.cpus.entries()) {
      const cpuLabel = `${label}.cpus[${cpuIndex}]`; exactKeys(cpu, SCHEMA_KEYS.signalMonitorSequenceCpu, cpuLabel);
      uint(cpu.cpu, `${cpuLabel}.cpu`); const baseline = uint(cpu.baselineEventSequence, `${cpuLabel}.baselineEventSequence`);
      if (!Array.isArray(cpu.eventSequences)) schemaFail(`${cpuLabel}.eventSequences must be an array`);
      let expected = baseline;
      for (const [sequenceIndex, sequence] of cpu.eventSequences.entries()) {
        expected = checkedAdd(expected, 1n, `${cpuLabel}.eventSequences`);
        sameBigInt(sequence, expected, `${cpuLabel}.eventSequences[${sequenceIndex}]`);
      }
      fixtureEventCount = checkedAdd(fixtureEventCount, BigInt(cpu.eventSequences.length), `${cpuLabel}.fixtureEventCount`);
    }
    eventCountByFixture.set(fixture.fixtureId, fixtureEventCount);
  }
  return Object.freeze({ fixtureIds: new Set(document.fixtures.map((fixture) => fixture.fixtureId)), eventCountByFixture });
}

export function validateSignalMonitorCounterSnapshots(document, context) {
  commonCoverageArtifact(document, SCHEMA_KEYS.signalMonitorCounterSnapshots, 'kstack.signal-monitor-counter-snapshots/v1', 'counter-snapshots artifact', context);
  sortedRecords(document.snapshots, 'counter-snapshots.snapshots', (snapshot) => `${snapshot?.fixtureId}\0${String(snapshot?.snapshotOrdinal).padStart(20, '0')}`);
  const fixtureIds = new Set(); const snapshotsByFixture = new Map();
  for (const [snapshotIndex, snapshot] of document.snapshots.entries()) {
    const label = `counter-snapshots.snapshots[${snapshotIndex}]`; exactKeys(snapshot, SCHEMA_KEYS.signalMonitorCounterSnapshot, label); ascii(snapshot.fixtureId, `${label}.fixtureId`); fixtureIds.add(snapshot.fixtureId);
    if (!snapshotsByFixture.has(snapshot.fixtureId)) snapshotsByFixture.set(snapshot.fixtureId, []); snapshotsByFixture.get(snapshot.fixtureId).push(snapshot);
    enumValue(snapshot.phase, new Set(['baseline', 'final-drain']), `${label}.phase`); uint(snapshot.snapshotOrdinal, `${label}.snapshotOrdinal`); uint(snapshot.tSnapshotNs, `${label}.tSnapshotNs`);
    literal(snapshot.linksStable, true, `${label}.linksStable`); literal(snapshot.identityStable, true, `${label}.identityStable`);
    sortedRecords(snapshot.cpus, `${label}.cpus`, (cpu) => String(cpu?.cpu).padStart(20, '0'));
    if (snapshot.cpus.length === 0) schemaFail(`${label}.cpus must represent every online CPU`);
    for (const [cpuIndex, cpu] of snapshot.cpus.entries()) {
      const cpuLabel = `${label}.cpus[${cpuIndex}]`; exactKeys(cpu, SCHEMA_KEYS.signalMonitorCounterCpu, cpuLabel);
      for (const field of ['cpu', 'producedCount', 'consumedCount', 'reservationFailureCount', 'mapFailureCount', 'lastEventSequence']) uint(cpu[field], `${cpuLabel}.${field}`);
      sameBigInt(cpu.producedCount, cpu.consumedCount, `${cpuLabel}.producerConsumer`);
      sameBigInt(cpu.reservationFailureCount, 0n, `${cpuLabel}.reservationFailureCount`); sameBigInt(cpu.mapFailureCount, 0n, `${cpuLabel}.mapFailureCount`);
    }
  }
  const eventCountByFixture = new Map();
  for (const [fixtureId, snapshots] of snapshotsByFixture) {
    if (snapshots.length < 3 || snapshots[0].phase !== 'baseline' || snapshots.slice(1).some((snapshot) => snapshot.phase !== 'final-drain')) schemaFail(`counter snapshots for ${fixtureId} require baseline and two stable final-drain snapshots`);
    for (let index = 0; index < snapshots.length; index += 1) {
      sameBigInt(snapshots[index].snapshotOrdinal, BigInt(index), `counter snapshots for ${fixtureId}.snapshotOrdinal`);
      if (index && uint(snapshots[index].tSnapshotNs, 'tSnapshotNs') < uint(snapshots[index - 1].tSnapshotNs, 'tSnapshotNs')) schemaFail(`counter snapshots for ${fixtureId} are not monotonic`);
    }
    const penultimate = snapshots[snapshots.length - 2]; const final = snapshots[snapshots.length - 1];
    if (canonicalJson(penultimate.cpus) !== canonicalJson(final.cpus) || penultimate.linksStable !== final.linksStable || penultimate.identityStable !== final.identityStable) schemaFail(`counter snapshots for ${fixtureId} did not reach a stable final drain`);
    let total = 0n; for (const cpu of final.cpus) total = checkedAdd(total, cpu.producedCount, `counter snapshots for ${fixtureId}.totalProduced`);
    eventCountByFixture.set(fixtureId, total);
  }
  return Object.freeze({ fixtureIds, eventCountByFixture });
}

export function validateSignalMonitorFixtureResults(document, context) {
  commonCoverageArtifact(document, SCHEMA_KEYS.signalMonitorFixtureResults, 'kstack.signal-monitor-fixture-results/v1', 'fixture-results artifact', context);
  sortedRecords(document.fixtures, 'fixture-results.fixtures', (fixture) => fixture?.fixtureId);
  if (document.fixtures.length !== TERMINATING_SIGNALS.length + 2) schemaFail('fixture-results must contain one fixture per terminating signal plus zero and stress');
  const seenSignals = new Set(); let zeroCount = 0; let stressCount = 0; let maximumEventLatencyNs = 0n; let maximumDrainLatencyNs = 0n;
  for (const [index, fixture] of document.fixtures.entries()) {
    const label = `fixture-results.fixtures[${index}]`; exactKeys(fixture, SCHEMA_KEYS.signalMonitorFixtureResult, label); ascii(fixture.fixtureId, `${label}.fixtureId`);
    enumValue(fixture.fixtureKind, new Set(['terminating-signal', 'zero-signal', 'ring-capacity-stress']), `${label}.fixtureKind`);
    if (fixture.fixtureKind === 'terminating-signal') {
      enumValue(fixture.terminatingSignal, new Set(TERMINATING_SIGNALS), `${label}.terminatingSignal`);
      if (seenSignals.has(fixture.terminatingSignal)) schemaFail('terminating-signal coverage contains a duplicate');
      seenSignals.add(fixture.terminatingSignal); literal(fixture.expectedGenerationObserved, true, `${label}.expectedGenerationObserved`); literal(fixture.expectedDeliveryObserved, true, `${label}.expectedDeliveryObserved`);
    } else {
      literal(fixture.terminatingSignal, 'not-applicable', `${label}.terminatingSignal`);
      if (fixture.fixtureKind === 'zero-signal') { zeroCount += 1; literal(fixture.expectedGenerationObserved, false, `${label}.expectedGenerationObserved`); literal(fixture.expectedDeliveryObserved, false, `${label}.expectedDeliveryObserved`); }
      else { stressCount += 1; literal(fixture.expectedGenerationObserved, true, `${label}.expectedGenerationObserved`); literal(fixture.expectedDeliveryObserved, true, `${label}.expectedDeliveryObserved`); }
    }
    for (const field of ['zeroLossCounters', 'contiguousPerCpuSequences', 'producerConsumerEqual', 'stableFinalDrain', 'pass']) literal(fixture[field], true, `${label}.${field}`);
    const eventLatency = uint(fixture.maximumEventLatencyNs, `${label}.maximumEventLatencyNs`); const drainLatency = uint(fixture.drainLatencyNs, `${label}.drainLatencyNs`);
    if (eventLatency > 1_000_000n || drainLatency > 1_000_000n) schemaFail(`${label} latency exceeds 1 ms`);
    if (eventLatency > maximumEventLatencyNs) maximumEventLatencyNs = eventLatency; if (drainLatency > maximumDrainLatencyNs) maximumDrainLatencyNs = drainLatency;
  }
  if (seenSignals.size !== TERMINATING_SIGNALS.length || zeroCount !== 1 || stressCount !== 1) schemaFail('fixture-results coverage population is incomplete');
  return Object.freeze({ fixtureIds: new Set(document.fixtures.map((fixture) => fixture.fixtureId)), maximumEventLatencyNs, maximumDrainLatencyNs, fixtures: document.fixtures });
}

export function validateSignalMonitorTracepointLinkState(document, context) {
  commonCoverageArtifact(document, SCHEMA_KEYS.signalMonitorTracepointLinkState, 'kstack.signal-monitor-tracepoint-link-state/v1', 'tracepoint-link-state artifact', context);
  if (!Array.isArray(document.links) || document.links.length !== 2) schemaFail('tracepoint-link-state must contain exactly two links');
  const expected = ['signal_deliver', 'signal_generate'];
  for (const [index, link] of document.links.entries()) {
    const label = `tracepoint-link-state.links[${index}]`; exactKeys(link, SCHEMA_KEYS.signalMonitorTracepointLink, label); literal(link.name, expected[index], `${label}.name`);
    uint(link.programId, `${label}.programId`, { positive: true }); uint(link.linkId, `${label}.linkId`, { positive: true });
    for (const field of ['attachedBeforeCampaign', 'attachedThroughCampaign', 'identityStable']) literal(link[field], true, `${label}.${field}`);
  }
  return true;
}

function parseCoverageArtifact(bytes, validator, context, label) {
  if (!Buffer.isBuffer(bytes)) schemaFail(`${label} must be retained as canonical UTF-8 bytes`);
  const document = parseCanonicalJsonBytes(bytes);
  return Object.freeze({ document, validation: validator(document, context) });
}

export function validateSignalMonitorCoverageEvidence(manifest, artifacts, { campaignId, monitorSha256, expectedDigest } = {}) {
  exactKeys(manifest, SCHEMA_KEYS.coverageManifest, 'signal monitor coverage manifest');
  literal(manifest.schema, 'kstack.signal-monitor-coverage-evidence/v1', 'coverage schema'); ascii(manifest.campaignId, 'campaignId');
  for (const field of ['monitorSha256', 'rawEventsSha256', 'perCpuSequencesSha256', 'counterSnapshotsSha256', 'fixtureResultsSha256', 'tracepointLinkStateSha256']) hash(manifest[field], field);
  const fixtureCount = uint(manifest.coverageFixtureCount, 'coverageFixtureCount', { positive: true });
  if (fixtureCount !== BigInt(TERMINATING_SIGNALS.length + 2)) schemaFail('coverageFixtureCount must equal the closed 25-fixture population');
  if (uint(manifest.maximumEventLatencyNs, 'maximumEventLatencyNs') > 1_000_000n || uint(manifest.maximumDrainLatencyNs, 'maximumDrainLatencyNs') > 1_000_000n) schemaFail('coverage latency exceeds 1 ms');
  if (campaignId !== undefined && manifest.campaignId !== campaignId) schemaFail('coverage campaign does not match qualification');
  if (monitorSha256 !== undefined && manifest.monitorSha256 !== monitorSha256) schemaFail('coverage monitor does not match qualification');
  const artifactFields = ['rawEventsSha256', 'perCpuSequencesSha256', 'counterSnapshotsSha256', 'fixtureResultsSha256', 'tracepointLinkStateSha256'];
  if (!isPlainObject(artifacts) || Object.keys(artifacts).sort().join(',') !== [...artifactFields].sort().join(',')) schemaFail('all five coverage artifacts must be retained exactly');
  for (const field of artifactFields) {
    if (!Buffer.isBuffer(artifacts[field]) || crypto.createHash('sha256').update(artifacts[field]).digest('hex') !== manifest[field]) schemaFail(`coverage artifact ${field} does not match its digest`);
  }
  const context = { campaignId: manifest.campaignId, monitorSha256: manifest.monitorSha256 };
  const raw = parseCoverageArtifact(artifacts.rawEventsSha256, validateSignalMonitorRawEvents, context, 'raw-events artifact').validation;
  const sequences = parseCoverageArtifact(artifacts.perCpuSequencesSha256, validateSignalMonitorPerCpuSequences, context, 'per-cpu-sequences artifact').validation;
  const counters = parseCoverageArtifact(artifacts.counterSnapshotsSha256, validateSignalMonitorCounterSnapshots, context, 'counter-snapshots artifact').validation;
  const results = parseCoverageArtifact(artifacts.fixtureResultsSha256, validateSignalMonitorFixtureResults, context, 'fixture-results artifact').validation;
  parseCoverageArtifact(artifacts.tracepointLinkStateSha256, validateSignalMonitorTracepointLinkState, context, 'tracepoint-link-state artifact');
  const resultIds = [...results.fixtureIds].sort();
  for (const [label, ids] of [['per-cpu sequences', sequences.fixtureIds], ['counter snapshots', counters.fixtureIds]]) if (JSON.stringify([...ids].sort()) !== JSON.stringify(resultIds)) schemaFail(`${label} fixture population differs from fixture-results`);
  if ([...raw.fixtureIds].some((id) => !results.fixtureIds.has(id))) schemaFail('raw-events contains an unknown fixture');
  for (const fixture of results.fixtures) {
    const retained = raw.eventsByFixture.get(fixture.fixtureId) ?? [];
    const retainedCount = BigInt(retained.length);
    sameBigInt(sequences.eventCountByFixture.get(fixture.fixtureId), retainedCount, `${fixture.fixtureId}.sequence/raw-event-count`);
    sameBigInt(counters.eventCountByFixture.get(fixture.fixtureId), retainedCount, `${fixture.fixtureId}.counter/raw-event-count`);
    if (fixture.fixtureKind === 'terminating-signal') {
      if (!retained.some((event) => event.signalName === fixture.terminatingSignal && event.kind === 'generation') || !retained.some((event) => event.signalName === fixture.terminatingSignal && event.kind === 'delivery')) schemaFail(`${fixture.fixtureId} lacks retained generation/delivery coverage`);
    } else if (fixture.fixtureKind === 'zero-signal' && retained.length !== 0) schemaFail('zero-signal fixture retained a signal event');
    else if (fixture.fixtureKind === 'ring-capacity-stress' && (!retained.some((event) => event.kind === 'generation') || !retained.some((event) => event.kind === 'delivery'))) schemaFail('ring-capacity stress lacks generation/delivery records');
  }
  sameBigInt(manifest.maximumEventLatencyNs, results.maximumEventLatencyNs, 'manifest.maximumEventLatencyNs'); sameBigInt(manifest.maximumDrainLatencyNs, results.maximumDrainLatencyNs, 'manifest.maximumDrainLatencyNs');
  if (raw.maximumEventLatencyNs > results.maximumEventLatencyNs) schemaFail('retained raw event latency exceeds fixture result maximum');
  if (expectedDigest !== undefined && canonicalSha256(manifest) !== expectedDigest) schemaFail('coverage manifest digest does not match the row');
  return true;
}

const ATTESTATION_KEYS = Object.freeze(['schema', 'environmentSha256', 'subject', 'authority', 'enforcedPolicy', 'unavailableSignals', 'evidence', 'validity', 'claims', 'policyGeneration', 'revocationEpoch', 'revocationAuthoritySha256']);
const SUBJECT_KEYS = Object.freeze(['hostIdentitySha256', 'osDistribution', 'osVersion', 'kernelBuild', 'architecture', 'cpuVendor', 'cpuFamily', 'cpuModel', 'cpuStepping', 'microcode', 'physicalCoreCount', 'logicalCpuCount', 'numaTopologySha256', 'substrateKind', 'hypervisorOrRuntime', 'hypervisorOrRuntimeVersion', 'machineImageSha256', 'nestedVirtualization']);
const AUTHORITY_KEYS = Object.freeze(['kind', 'deviceIdentitySha256', 'controllerBinarySha256', 'controllerVersion', 'configurationSha256', 'trustKeySha256']);
const ENFORCED_POLICY_KEYS = Object.freeze(['powerProfile', 'governor', 'minimumFrequencyKHz', 'maximumFrequencyKHz', 'turboEnabled', 'powerCapMilliwatts', 'cpusetMask', 'cgroupCpuQuotaMicros', 'cgroupCpuPeriodMicros', 'cgroupCpuWeight', 'memoryLimitBytes', 'swapLimitBytes', 'numaBinding', 'schedulerClass', 'niceValue', 'guestMayOverride']);

export function validateSignalUnavailabilityEvidence(document, { environmentSha256, authorityConfigurationSha256, unavailableSignals } = {}) {
  exactKeys(document, SCHEMA_KEYS.signalUnavailabilityEvidence, 'signal-unavailability evidence'); literal(document.schema, 'kstack.signal-unavailability-evidence/v1', 'signal-unavailability schema');
  hash(document.environmentSha256, 'signal-unavailability.environmentSha256'); hash(document.authorityConfigurationSha256, 'signal-unavailability.authorityConfigurationSha256');
  if (environmentSha256 !== undefined && document.environmentSha256 !== environmentSha256) schemaFail('signal-unavailability environment binding differs');
  if (authorityConfigurationSha256 !== undefined && document.authorityConfigurationSha256 !== authorityConfigurationSha256) schemaFail('signal-unavailability authority binding differs');
  sortedRecords(document.signals, 'signal-unavailability.signals', (record) => record?.signal);
  for (const [index, record] of document.signals.entries()) {
    const label = `signal-unavailability.signals[${index}]`; exactKeys(record, SCHEMA_KEYS.signalUnavailabilityRecord, label);
    enumValue(record.signal, UNAVAILABLE_SIGNAL_SET, `${label}.signal`);
    enumValue(record.reason, new Set(['hardware-not-exposed', 'virtualization-not-forwarded', 'controller-api-not-exposed']), `${label}.reason`);
    hash(record.evidenceSha256, `${label}.evidenceSha256`);
  }
  if (unavailableSignals !== undefined && JSON.stringify(document.signals.map((record) => record.signal)) !== JSON.stringify(unavailableSignals)) schemaFail('signal-unavailability evidence does not cover exactly unavailableSignals');
  return true;
}

export function validateResidualInterferenceDerivation(document, { environmentSha256, expectedApplicable, resctrlMode } = {}) {
  exactKeys(document, SCHEMA_KEYS.residualInterferenceDerivation, 'residual-interference derivation'); literal(document.schema, 'kstack.residual-interference-derivation/v1', 'residual-interference schema');
  hash(document.environmentSha256, 'residual-interference.environmentSha256');
  if (environmentSha256 !== undefined && document.environmentSha256 !== environmentSha256) schemaFail('residual-interference environment binding differs');
  if (!Array.isArray(document.classes) || document.classes.length !== RESIDUAL_INTERFERENCE_DERIVATION_VOCABULARY.length) schemaFail('residual-interference derivation must enumerate all six classes');
  const applicable = [];
  for (let index = 0; index < RESIDUAL_INTERFERENCE_DERIVATION_VOCABULARY.length; index += 1) {
    const expected = RESIDUAL_INTERFERENCE_DERIVATION_VOCABULARY[index]; const record = document.classes[index]; const label = `residual-interference.classes[${index}]`;
    exactKeys(record, SCHEMA_KEYS.residualInterferenceClass, label); literal(record.class, expected.class, `${label}.class`); hash(record.evidenceSha256, `${label}.evidenceSha256`);
    enumValue(record.disposition, new Set(['applicable', 'mitigated']), `${label}.disposition`);
    const expectedBasis = record.disposition === 'applicable' ? expected.applicableBasis : expected.mitigatedBasis;
    literal(record.basis, expectedBasis, `${label}.basis`);
    if (record.disposition === 'applicable') applicable.push(record.class);
  }
  const llc = document.classes.find((record) => record.class === 'unpartitioned-shared-llc');
  if (resctrlMode === 'enforced' && (llc.disposition !== 'mitigated' || llc.basis !== 'llc-allocation-enforced')) schemaFail('enforced resctrl must mitigate unpartitioned shared LLC');
  if (resctrlMode === 'not-applicable' && (llc.disposition !== 'applicable' || llc.basis !== 'llc-allocation-not-enforced')) schemaFail('missing resctrl must disclose unpartitioned shared LLC');
  if (expectedApplicable !== undefined && JSON.stringify(applicable) !== JSON.stringify(expectedApplicable)) schemaFail('derived applicable residual set differs from the environment');
  return Object.freeze(applicable);
}

export function validateSubstrateAttestation(attestation, { signature, publicKey, verifySignature, now = new Date(), trustKeyState = 'active', trustManifestVerified = false, trustManifestFresh = false, trustManifestMonotonic = false, policyStream = null, expectedEnvironmentSha256, signalUnavailabilityEvidence = null } = {}) {
  exactKeys(attestation, ATTESTATION_KEYS, 'substrate attestation'); literal(attestation.schema, 'kstack.substrate-attestation/v2', 'attestation schema');
  hash(attestation.environmentSha256, 'environmentSha256'); if (expectedEnvironmentSha256 && attestation.environmentSha256 !== expectedEnvironmentSha256) schemaFail('attestation environment digest differs');
  exactKeys(attestation.subject, SUBJECT_KEYS, 'attestation subject');
  for (const field of ['hostIdentitySha256', 'numaTopologySha256']) hash(attestation.subject[field], field);
  for (const field of ['osDistribution', 'osVersion', 'cpuVendor', 'microcode']) ascii(attestation.subject[field], field);
  ascii(attestation.subject.kernelBuild, 'kernelBuild', 256); enumValue(attestation.subject.architecture, ARCHITECTURES, 'architecture'); enumValue(attestation.subject.substrateKind, SUBSTRATE_KINDS, 'substrateKind');
  for (const field of ['cpuFamily', 'cpuModel', 'cpuStepping']) uint(attestation.subject[field], field);
  uint(attestation.subject.physicalCoreCount, 'physicalCoreCount', { positive: true }); uint(attestation.subject.logicalCpuCount, 'logicalCpuCount', { positive: true });
  if (typeof attestation.subject.nestedVirtualization !== 'boolean') schemaFail('nestedVirtualization must be boolean');
  if (attestation.subject.substrateKind === 'bare-metal') {
    for (const field of ['hypervisorOrRuntime', 'hypervisorOrRuntimeVersion', 'machineImageSha256']) literal(attestation.subject[field], 'not-applicable', field);
    literal(attestation.subject.nestedVirtualization, false, 'nestedVirtualization');
  } else { ascii(attestation.subject.hypervisorOrRuntime, 'hypervisorOrRuntime'); ascii(attestation.subject.hypervisorOrRuntimeVersion, 'hypervisorOrRuntimeVersion'); hash(attestation.subject.machineImageSha256, 'machineImageSha256'); }
  exactKeys(attestation.authority, AUTHORITY_KEYS, 'attestation authority'); ascii(attestation.authority.kind, 'authority.kind'); ascii(attestation.authority.controllerVersion, 'controllerVersion');
  for (const field of ['deviceIdentitySha256', 'controllerBinarySha256', 'configurationSha256', 'trustKeySha256']) hash(attestation.authority[field], field);
  exactKeys(attestation.enforcedPolicy, ENFORCED_POLICY_KEYS, 'attestation enforcedPolicy');
  enumValue(attestation.enforcedPolicy.powerProfile, POWER_PROFILES, 'powerProfile'); enumValue(attestation.enforcedPolicy.governor, GOVERNORS, 'governor');
  uint(attestation.enforcedPolicy.minimumFrequencyKHz, 'minimumFrequencyKHz', { positive: true }); uint(attestation.enforcedPolicy.maximumFrequencyKHz, 'maximumFrequencyKHz', { positive: true });
  if (uint(attestation.enforcedPolicy.minimumFrequencyKHz, 'minimumFrequencyKHz') > uint(attestation.enforcedPolicy.maximumFrequencyKHz, 'maximumFrequencyKHz')) schemaFail('attested frequency bounds are reversed');
  if (typeof attestation.enforcedPolicy.turboEnabled !== 'boolean') schemaFail('turboEnabled must be boolean');
  uintOrNotApplicable(attestation.enforcedPolicy.powerCapMilliwatts, 'powerCapMilliwatts'); cpuList(attestation.enforcedPolicy.cpusetMask, 'cpusetMask'); uintOrMax(attestation.enforcedPolicy.cgroupCpuQuotaMicros, 'cgroupCpuQuotaMicros');
  uint(attestation.enforcedPolicy.cgroupCpuPeriodMicros, 'cgroupCpuPeriodMicros', { positive: true }); boundedInteger(attestation.enforcedPolicy.cgroupCpuWeight, 1, 10_000, 'cgroupCpuWeight'); uintOrMax(attestation.enforcedPolicy.memoryLimitBytes, 'memoryLimitBytes'); uintOrMax(attestation.enforcedPolicy.swapLimitBytes, 'swapLimitBytes');
  literal(attestation.enforcedPolicy.numaBinding, 'strict', 'numaBinding'); enumValue(attestation.enforcedPolicy.schedulerClass, SCHEDULER_CLASSES, 'schedulerClass'); boundedInteger(attestation.enforcedPolicy.niceValue, -20, 19, 'niceValue'); literal(attestation.enforcedPolicy.guestMayOverride, false, 'guestMayOverride');
  sortedUnique(attestation.unavailableSignals, 'unavailableSignals', (item, label) => enumValue(item, UNAVAILABLE_SIGNAL_SET, label));
  if (!Array.isArray(attestation.evidence)) schemaFail('evidence must be an array');
  const expectedKinds = ['controller-config', 'platform-inventory', 'policy-lock', ...(attestation.unavailableSignals.length ? ['signal-unavailability'] : [])].sort();
  const kinds = [];
  for (const [index, evidence] of attestation.evidence.entries()) { exactKeys(evidence, ['kind', 'sha256'], `evidence[${index}]`); ascii(evidence.kind, `evidence[${index}].kind`); hash(evidence.sha256, `evidence[${index}].sha256`); kinds.push(evidence.kind); }
  if (JSON.stringify(kinds) !== JSON.stringify(expectedKinds)) schemaFail('attestation evidence kinds must be canonical and exact');
  if (attestation.unavailableSignals.length) {
    if (!Buffer.isBuffer(signalUnavailabilityEvidence)) schemaFail('typed signal-unavailability evidence bytes are required');
    const evidenceEntry = attestation.evidence.find((entry) => entry.kind === 'signal-unavailability');
    if (crypto.createHash('sha256').update(signalUnavailabilityEvidence).digest('hex') !== evidenceEntry.sha256) schemaFail('signal-unavailability evidence digest differs');
    const document = parseCanonicalJsonBytes(signalUnavailabilityEvidence);
    validateSignalUnavailabilityEvidence(document, { environmentSha256: attestation.environmentSha256, authorityConfigurationSha256: attestation.authority.configurationSha256, unavailableSignals: attestation.unavailableSignals });
  } else if (signalUnavailabilityEvidence !== null) schemaFail('signal-unavailability evidence is forbidden when unavailableSignals is empty');
  exactKeys(attestation.validity, ['notBefore', 'notAfter'], 'validity');
  const secondUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
  if (!secondUtc.test(attestation.validity.notBefore) || !secondUtc.test(attestation.validity.notAfter)) schemaFail('attestation validity must use integral-second RFC3339 UTC');
  const notBefore = Date.parse(attestation.validity.notBefore); const notAfter = Date.parse(attestation.validity.notAfter); const clock = now instanceof Date ? now.getTime() : Number(now);
  const exactUtc = (value, parsed) => Number.isFinite(parsed) && new Date(parsed).toISOString().replace('.000Z', 'Z') === value;
  if (!exactUtc(attestation.validity.notBefore, notBefore) || !exactUtc(attestation.validity.notAfter, notAfter) || notBefore >= notAfter || clock < notBefore || clock > notAfter) schemaFail('attestation validity is invalid or not current');
  exactKeys(attestation.claims, ['subjectMatchesEnvironment', 'policyApplied', 'policyLockedForValidityInterval', 'guestCannotOverride', 'policyChangeInvalidatesAttestation'], 'claims');
  for (const field of Object.keys(attestation.claims)) literal(attestation.claims[field], true, `claims.${field}`);
  uint(attestation.policyGeneration, 'policyGeneration'); uint(attestation.revocationEpoch, 'revocationEpoch'); hash(attestation.revocationAuthoritySha256, 'revocationAuthoritySha256');
  if (trustKeyState !== 'active' || !trustManifestVerified || !trustManifestFresh || !trustManifestMonotonic) schemaFail('signed monotonic trust manifest is not freshly verified with an active key');
  if (!policyStream || policyStream.subscribedBeforeLaunch !== true || policyStream.continuousThroughFinalDrain !== true
      || policyStream.eventObserved === true || policyStream.gapObserved === true || policyStream.disconnected === true
      || uint(policyStream.maximumHeartbeatGapNs, 'maximumHeartbeatGapNs') > 10_000_000n
      || policyStream.generationMatches !== true || policyStream.revocationEpochMatches !== true
      || policyStream.controllerMatches !== true || policyStream.lockMatches !== true || policyStream.postExitRereadEqual !== true) {
    schemaFail('authenticated policy stream or post-exit reread is invalid');
  }
  if (!(Buffer.isBuffer(signature) && signature.length === 64 && Buffer.isBuffer(publicKey) && publicKey.length === 32)) schemaFail('detached Ed25519 signature/key lengths are invalid');
  if (typeof verifySignature !== 'function' || verifySignature(Buffer.from(canonicalJson(attestation)), signature, publicKey) !== true) schemaFail('attestation signature verification failed');
  return true;
}

export function validateAttestationPromotion({ production, row, environment, attestation = null, attestationVerification = {}, sentinelEvidence = null }) {
  const value = production.substrateAttestationSha256;
  if (value !== row.substrateAttestationSha256 || value !== environment.substrateAttestationSha256) throw new TerminationSafetyError('ATTESTATION_INVALIDATED', 'production/row/environment attestation values differ');
  if (value === 'not-applicable') {
    const strict = sentinelEvidence && sentinelEvidence.allRequiredThermalAndPowerSignalsExposed === true
      && sentinelEvidence.continuouslyMonitoredThroughFinalDrain === true
      && sentinelEvidence.unavailableSignalsEmpty === true
      && sentinelEvidence.externalPolicySuppliesNoEnvironmentField === true;
    if (!strict) throw new TerminationSafetyError('ATTESTATION_INVALIDATED', 'not-applicable attestation predicate was not independently re-satisfied');
  } else {
    try {
      validateSubstrateAttestation(attestation, { ...attestationVerification, expectedEnvironmentSha256: row.environmentSha256 });
      if (canonicalSha256(attestation) !== value) schemaFail('attestation digest differs');
    } catch { throw new TerminationSafetyError('ATTESTATION_INVALIDATED', 'digest attestation failed production revalidation'); }
  }
  return true;
}

function nullableUInt(value, label, options = {}) {
  return value === null ? null : uint(value, label, options);
}

function digestOrNa(value, label) {
  hashOrNotApplicable(value, label);
}

function requireCodes(record, codes, label) {
  for (const code of codes) if (!record.failureCodes.includes(code)) schemaFail(`${label} requires ${code}`);
}

export function validateProductionEnvelope(record, { qualificationRow = null, environment = null, attestationContext = null } = {}) {
  exactKeys(record, SCHEMA_KEYS.productionEnvelope, 'production envelope'); literal(record.schema, 'kstack.production-envelope/v3', 'schema'); ascii(record.executionId, 'executionId');
  literal(record.claimType, CLAIM_TYPE, 'claimType'); literal(record.claimSemantics, CLAIM_SEMANTICS, 'claimSemantics');
  for (const field of ['qualificationRowSha256', 'environmentSha256', 'trustManifestSha256', 'monitorSha256', 'signalMonitorCoverageEvidenceSha256', 'deadlineDetectorSha256', 'privilegeSeparationPolicySha256', 'runtimeSha256', 'launcherSha256', 'productionGraphSha256', 'prelaunchSnapshotSha256']) hash(record[field], field);
  hashOrNotApplicable(record.substrateAttestationSha256, 'substrateAttestationSha256');
  for (const field of ['postExitSnapshotSha256', 'sampleLogSha256', 'eventLogSha256', 'terminationEvidenceSha256', 'privilegeDropEvidenceSha256']) digestOrNa(record[field], field);
  if (!['prelaunch-rejected', 'spawn-failed', 'spawned'].includes(record.launchState)) schemaFail('launchState is invalid');
  for (const field of ['qualifiedMinimumElapsedNs', 'qualifiedLaunchToArmUpperNs', 'qualifiedExitToObservationUpperNs', 'qualifiedArmToCutoffCallUpperNs', 'qualifiedCutoffCallToExitUpperNs', 'qualifiedCutoffCallToObservedExitUpperNs', 'qualifiedLaunchToObservedExitUpperNs']) uint(record[field], field, { positive: true });
  for (const field of ['tLaunchNs', 'parentObservedDeadlineNs', 'tTimerArmedNs', 'tTimerfdReadNs', 'deadlineDetectionLatencyNs', 'tOsExitObservedNs', 'elapsedLaunchToObservedExitNs', 'signalMonitorMaxEventLatencyNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs', 'signalMonitorDrainLatencyNs']) nullableUInt(record[field], field);
  if (record.deadlineDetectionLatencyNs !== null && uint(record.deadlineDetectionLatencyNs, 'deadlineDetectionLatencyNs') > 1_000_000n) schemaFail('deadlineDetectionLatencyNs exceeds 1 ms');
  if (record.signalMonitorMaxEventLatencyNs !== null && uint(record.signalMonitorMaxEventLatencyNs, 'signalMonitorMaxEventLatencyNs') > 1_000_000n) schemaFail('signalMonitorMaxEventLatencyNs exceeds 1 ms');
  if (record.signalMonitorDrainLatencyNs !== null && uint(record.signalMonitorDrainLatencyNs, 'signalMonitorDrainLatencyNs') > 1_000_000n) schemaFail('signalMonitorDrainLatencyNs exceeds 1 ms');
  if (record.osStatus !== null) boundedInteger(record.osStatus, 0, 255, 'osStatus'); enumValue(record.osSignal, OS_SIGNALS, 'osSignal');
  for (const field of ['oomDelta', 'oomKillDelta', 'oomGroupKillDelta', 'cgroupKillCount', 'supervisorTerminationCount', 'terminatingSignalEventCount', 'signalMonitorProducedEventCount', 'signalMonitorConsumedEventCount', 'signalMonitorReservationFailureCount', 'signalMonitorMapFailureCount']) uint(record[field], field);
  enumValue(record.envelopeVerdict, new Set(['within-qualified-envelope', 'outside-qualified-envelope']), 'envelopeVerdict');
  enumValue(record.timingVerdict, new Set(['not-evaluated', 'before-qualified-minimum', 'within-qualified-elapsed-window', 'after-parent-observed-deadline']), 'timingVerdict');
  enumValue(record.exitSignatureVerdict, new Set(['not-evaluated', 'qualified-exit-signature', 'unqualified-exit-signature']), 'exitSignatureVerdict');
  failureCodes(record.failureCodes); if (typeof record.claimEligible !== 'boolean') schemaFail('claimEligible must be boolean'); literal(record.finalizationState, 'final', 'finalizationState');
  if ((record.tTimerfdReadNs === null) !== (record.deadlineDetectionLatencyNs === null)) schemaFail('timerfd read and deadline latency nullability differ');
  if (record.tTimerfdReadNs !== null) sameBigInt(record.deadlineDetectionLatencyNs, difference(record.tTimerfdReadNs, record.parentObservedDeadlineNs, 'deadlineDetectionLatencyNs'), 'deadlineDetectionLatencyNs');
  const drainNulls = ['tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs', 'signalMonitorDrainLatencyNs'].filter((field) => record[field] === null).length;
  if (![0, 3].includes(drainNulls)) schemaFail('signal drain fields must be all null or all non-null');
  if (drainNulls === 0) sameBigInt(record.signalMonitorDrainLatencyNs, difference(record.tSignalMonitorFinalDrainEndNs, record.tSignalMonitorFinalDrainStartNs, 'signalMonitorDrainLatencyNs'), 'signalMonitorDrainLatencyNs');

  if (record.launchState === 'prelaunch-rejected') {
    for (const field of ['tLaunchNs', 'parentObservedDeadlineNs', 'tTimerArmedNs', 'tTimerfdReadNs', 'deadlineDetectionLatencyNs', 'tOsExitObservedNs', 'elapsedLaunchToObservedExitNs', 'signalMonitorMaxEventLatencyNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs', 'signalMonitorDrainLatencyNs']) literal(record[field], null, field);
    for (const field of ['postExitSnapshotSha256', 'sampleLogSha256', 'eventLogSha256', 'terminationEvidenceSha256', 'privilegeDropEvidenceSha256']) literal(record[field], 'not-applicable', field);
    literal(record.osStatus, null, 'osStatus'); literal(record.osSignal, 'none', 'osSignal');
    for (const field of ['oomDelta', 'oomKillDelta', 'oomGroupKillDelta', 'cgroupKillCount', 'supervisorTerminationCount', 'terminatingSignalEventCount', 'signalMonitorProducedEventCount', 'signalMonitorConsumedEventCount', 'signalMonitorReservationFailureCount', 'signalMonitorMapFailureCount']) sameBigInt(record[field], 0n, field);
    literal(record.envelopeVerdict, 'outside-qualified-envelope', 'envelopeVerdict'); literal(record.timingVerdict, 'not-evaluated', 'timingVerdict'); literal(record.exitSignatureVerdict, 'not-evaluated', 'exitSignatureVerdict'); requireCodes(record, ['PRELAUNCH_REJECTED'], 'prelaunch-rejected');
  } else {
    if (record.tLaunchNs === null || record.parentObservedDeadlineNs === null) schemaFail('launched state requires launch and deadline timestamps');
    sameBigInt(record.parentObservedDeadlineNs, checkedAdd(record.tLaunchNs, record.qualifiedLaunchToObservedExitUpperNs, 'parentObservedDeadlineNs'), 'parentObservedDeadlineNs');
    if (record.launchState === 'spawn-failed') {
      requireCodes(record, ['SPAWN_FAILED_AFTER_LAUNCH'], 'spawn-failed');
      for (const field of ['tTimerArmedNs', 'tTimerfdReadNs', 'deadlineDetectionLatencyNs', 'tOsExitObservedNs', 'elapsedLaunchToObservedExitNs', 'signalMonitorMaxEventLatencyNs', 'tSignalMonitorFinalDrainStartNs', 'tSignalMonitorFinalDrainEndNs', 'signalMonitorDrainLatencyNs']) literal(record[field], null, field);
      literal(record.privilegeDropEvidenceSha256, 'not-applicable', 'privilegeDropEvidenceSha256'); literal(record.osStatus, null, 'osStatus'); literal(record.osSignal, 'none', 'osSignal');
      literal(record.envelopeVerdict, 'outside-qualified-envelope', 'envelopeVerdict'); literal(record.timingVerdict, 'not-evaluated', 'timingVerdict'); literal(record.exitSignatureVerdict, 'not-evaluated', 'exitSignatureVerdict');
    } else {
      if (record.tTimerArmedNs !== null && uint(record.tTimerArmedNs, 'tTimerArmedNs') >= uint(record.parentObservedDeadlineNs, 'parentObservedDeadlineNs')) requireCodes(record, ['DEADLINE_ARMING_TOO_LATE', 'MONITOR_GAP'], 'late arm');
      if (record.tOsExitObservedNs !== null) {
        sameBigInt(record.elapsedLaunchToObservedExitNs, difference(record.tOsExitObservedNs, record.tLaunchNs, 'elapsedLaunchToObservedExitNs'), 'elapsedLaunchToObservedExitNs');
        if (uint(record.tOsExitObservedNs, 'tOsExitObservedNs') > uint(record.parentObservedDeadlineNs, 'parentObservedDeadlineNs')) requireCodes(record, ['PARENT_OBSERVED_DEADLINE_EXCEEDED'], 'late exit');
        if (uint(record.elapsedLaunchToObservedExitNs, 'elapsedLaunchToObservedExitNs') < uint(record.qualifiedMinimumElapsedNs, 'qualifiedMinimumElapsedNs')) requireCodes(record, ['PARENT_OBSERVED_EXIT_TOO_EARLY'], 'early exit');
      }
      const reachedDeadline = record.tOsExitObservedNs === null || uint(record.tOsExitObservedNs, 'tOsExitObservedNs') > uint(record.parentObservedDeadlineNs, 'parentObservedDeadlineNs');
      if (reachedDeadline && record.deadlineDetectionLatencyNs === null) requireCodes(record, ['MONITOR_GAP'], 'reached deadline');
      if (record.tOsExitObservedNs !== null && record.tOsExitObservedNs <= record.parentObservedDeadlineNs && record.tTimerfdReadNs === null) { /* normative ordinary cancellation */ }
      if ((record.osStatus === null) === (record.osSignal === 'none') && record.tOsExitObservedNs !== null) schemaFail('terminal observation requires exactly one normal-status or signal outcome');
    }
  }
  if (record.claimEligible !== evaluateClaimEligibility(record)) schemaFail('claimEligible does not equal the composed predicate');
  if (qualificationRow && environment) {
    if (record.environmentSha256 !== qualificationRow.environmentSha256 || record.environmentSha256 !== canonicalSha256(environment)) schemaFail('production environment binding differs');
    const copied = ['substrateAttestationSha256', 'trustManifestSha256', 'monitorSha256', 'signalMonitorCoverageEvidenceSha256', 'deadlineDetectorSha256', 'privilegeSeparationPolicySha256', 'runtimeSha256', 'launcherSha256', 'productionGraphSha256'];
    for (const field of copied) if (record[field] !== qualificationRow[field]) schemaFail(`production ${field} differs from qualification`);
    if (attestationContext) validateAttestationPromotion({ production: record, row: qualificationRow, environment, ...attestationContext });
  }
  return true;
}
