import {
  assertAsciiId,
  assertDigest,
  assertRegistryId,
  assertTimestamp,
  hostAddress
} from './kstack-host-contract.mjs';

export class HostHarnessError extends Error {
  constructor(code) { super(code); this.name = 'HostHarnessError'; this.code = code; }
}

function fail(code) { throw new HostHarnessError(code); }
function exact(value, keys, code = 'KSTACK_HARNESS_INPUT_INVALID') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}
function digest(value, code = 'KSTACK_HARNESS_INPUT_INVALID') { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code = 'KSTACK_HARNESS_INPUT_INVALID') { try { return assertAsciiId(value); } catch { fail(code); } }
function registry(value, code = 'KSTACK_HARNESS_INPUT_INVALID') { try { return assertRegistryId(value); } catch { fail(code); } }
function boundedText(value, code = 'KSTACK_HARNESS_INPUT_INVALID') { if (typeof value !== 'string' || value.length < 1 || value.length > 4096 || value.trim() !== value) fail(code); return value; }
function timestamp(value, code = 'KSTACK_HARNESS_INPUT_INVALID') { try { return assertTimestamp(value); } catch { fail(code); } }
function enumeration(value, allowed, code = 'KSTACK_HARNESS_INPUT_INVALID') { if (!allowed.includes(value)) fail(code); return value; }
function bool(value, code = 'KSTACK_HARNESS_INPUT_INVALID') { if (typeof value !== 'boolean') fail(code); return value; }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}
function sortedUnique(values, validator = ascii, minimum = 0, maximum = 1024, code = 'KSTACK_HARNESS_INPUT_INVALID') {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((entry) => validator(entry, code));
  if (new Set(values).size !== values.length || values.some((entry, index) => index > 0 && entry <= values[index - 1])) fail(code);
  return values;
}
function same(left, right) { return left.length === right.length && left.every((entry, index) => entry === right[index]); }
function setDifference(left, right) { const accepted = new Set(right); return left.filter((entry) => !accepted.has(entry)); }

export const HARNESS_CLOSURE_OUTCOMES = Object.freeze(['PROVEN', 'UNKNOWN', 'UNAVAILABLE', 'CONTRADICTORY']);
export const BYPASS_STATUSES = Object.freeze(['COVERED', 'DISABLED_PROVEN', 'UNREACHABLE_PROVEN', 'UNKNOWN', 'UNOBSERVABLE', 'BYPASS_FOUND']);
export const FIXTURE_STATES = Object.freeze([
  'DECLARED', 'DEPENDENCIES_SATISFIED', 'ENVIRONMENT_BOUND', 'RUNNING', 'PASS', 'FAIL',
  'NOT_RUN', 'CAPABILITY_UNAVAILABLE', 'HARNESS_ERROR', 'AMBIGUOUS'
]);
export const CONFORMANCE_AGGREGATES = Object.freeze(['PASS', 'FAIL', 'INCOMPLETE', 'AMBIGUOUS', 'HARNESS_ERROR']);
export const EFFECT_FAMILIES = Object.freeze([
  'credential-approval', 'device', 'external-root', 'filesystem-mutation',
  'network', 'process-exec', 'provider', 'sensitive-ipc'
]);
const INVENTORY_KINDS = Object.freeze(['DOCUMENTED', 'DYNAMIC', 'LIVE', 'STATIC']);
const TERMINAL_FIXTURE_STATES = new Set(['PASS', 'FAIL', 'NOT_RUN', 'CAPABILITY_UNAVAILABLE', 'HARNESS_ERROR', 'AMBIGUOUS']);
const TRANSITIONS = Object.freeze({
  DECLARED: ['DEPENDENCIES_SATISFIED'],
  DEPENDENCIES_SATISFIED: ['ENVIRONMENT_BOUND'],
  ENVIRONMENT_BOUND: ['RUNNING'],
  RUNNING: ['PASS', 'FAIL', 'NOT_RUN', 'CAPABILITY_UNAVAILABLE', 'HARNESS_ERROR', 'AMBIGUOUS']
});

const IDENTITY = Object.freeze({
  HarnessProfileV1: ['kstack.harness-profile.v1', 'KSTACK-HARNESS-PROFILE-V1'],
  ObserverEvaluationV1: ['kstack.observer-evaluation.v1', 'KSTACK-OBSERVER-EVALUATION-V1'],
  EffectChokePointClosureV1: ['kstack.effect-choke-point-closure.v1', 'KSTACK-EFFECT-CHOKE-POINT-CLOSURE-V1'],
  HostBypassInventoryV1: ['kstack.host-bypass-inventory.v1', 'KSTACK-HOST-BYPASS-INVENTORY-V1'],
  ConformanceCoverageMatrixV1: ['kstack.conformance-coverage-matrix.v1', 'KSTACK-CONFORMANCE-COVERAGE-MATRIX-V1'],
  ConformanceRunPlanV1: ['kstack.conformance-run-plan.v1', 'KSTACK-CONFORMANCE-RUN-PLAN-V1'],
  ConformanceRunResultV1: ['kstack.conformance-run-result.v1', 'KSTACK-CONFORMANCE-RUN-RESULT-V1'],
  EvidenceProducerHandoffV1: ['kstack.evidence-producer-handoff.v1', 'KSTACK-EVIDENCE-PRODUCER-HANDOFF-V1']
});

function head(name, schemaSetDigest) {
  const identity = IDENTITY[name];
  if (!identity) fail('KSTACK_HARNESS_INPUT_INVALID');
  return { schemaId: identity[0], schemaVersion: 1, schemaSetDigest: digest(schemaSetDigest) };
}
function address(name, value) { return hostAddress(IDENTITY[name][1], value); }
function validateHead(value, name, code) {
  if (value.schemaId !== IDENTITY[name][0] || value.schemaVersion !== 1) fail(code);
  digest(value.schemaSetDigest, code);
}

export function evaluateHarnessProfile(input) {
  exact(input, [
    'schemaSetDigest', 'profileId', 'platformDigest', 'isolationBackendDigest', 'launcherDigest',
    'supervisorDigest', 'observerSetDigest', 'trustedTimeProfileDigest', 'replayProfileDigest',
    'environmentProfileDigest', 'activeSetDigest', 'policyDigest', 'artifactLimitsDigest',
    'cleanupContractDigest', 'networkPolicyDigest', 'disposableTargetProfileDigest',
    'fakeProviderRegistryDigest', 'qualificationVectorSetDigest', 'primitiveOutcomes', 'ownership'
  ], 'KSTACK_HARNESS_PROFILE_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_HARNESS_PROFILE_INVALID');
  ascii(input.profileId, 'KSTACK_HARNESS_PROFILE_INVALID');
  for (const field of [
    'platformDigest', 'isolationBackendDigest', 'launcherDigest', 'supervisorDigest', 'observerSetDigest',
    'trustedTimeProfileDigest', 'replayProfileDigest', 'environmentProfileDigest', 'activeSetDigest',
    'policyDigest', 'artifactLimitsDigest', 'cleanupContractDigest', 'networkPolicyDigest',
    'disposableTargetProfileDigest', 'fakeProviderRegistryDigest', 'qualificationVectorSetDigest'
  ]) digest(input[field], 'KSTACK_HARNESS_PROFILE_INVALID');
  exact(input.primitiveOutcomes, [
    'isolation', 'launcher', 'observerSet', 'trustedTime', 'replay', 'environmentMeasurement',
    'cleanup', 'networkEnforcement', 'disposableTarget', 'fakeProvider'
  ], 'KSTACK_HARNESS_PROFILE_INVALID');
  const primitiveOutcomes = Object.fromEntries(Object.entries(input.primitiveOutcomes).map(([key, value]) => [
    key, enumeration(value, HARNESS_CLOSURE_OUTCOMES, 'KSTACK_HARNESS_PROFILE_INVALID')
  ]));
  exact(input.ownership, [
    'activeSet', 'clock', 'config', 'evidenceCatalog', 'expectedOutcomes', 'fixtureVerdict',
    'observerState', 'policy', 'signingKey'
  ], 'KSTACK_HARNESS_PROFILE_INVALID');
  Object.values(input.ownership).forEach((value) => bool(value, 'KSTACK_HARNESS_PROFILE_INVALID'));
  let qualificationOutcome = 'PROVEN';
  if (Object.values(input.ownership).some((value) => value !== true)) qualificationOutcome = 'UNKNOWN';
  if (Object.values(primitiveOutcomes).includes('CONTRADICTORY')) qualificationOutcome = 'CONTRADICTORY';
  else if (Object.values(primitiveOutcomes).includes('UNAVAILABLE')) qualificationOutcome = 'UNAVAILABLE';
  else if (Object.values(primitiveOutcomes).includes('UNKNOWN')) qualificationOutcome = 'UNKNOWN';
  const profile = {
    ...head('HarnessProfileV1', input.schemaSetDigest),
    profileId: input.profileId,
    platformDigest: input.platformDigest,
    isolationBackendDigest: input.isolationBackendDigest,
    launcherDigest: input.launcherDigest,
    supervisorDigest: input.supervisorDigest,
    observerSetDigest: input.observerSetDigest,
    trustedTimeProfileDigest: input.trustedTimeProfileDigest,
    replayProfileDigest: input.replayProfileDigest,
    environmentProfileDigest: input.environmentProfileDigest,
    activeSetDigest: input.activeSetDigest,
    policyDigest: input.policyDigest,
    artifactLimitsDigest: input.artifactLimitsDigest,
    cleanupContractDigest: input.cleanupContractDigest,
    networkPolicyDigest: input.networkPolicyDigest,
    disposableTargetProfileDigest: input.disposableTargetProfileDigest,
    fakeProviderRegistryDigest: input.fakeProviderRegistryDigest,
    qualificationVectorSetDigest: input.qualificationVectorSetDigest,
    primitiveOutcomes,
    protectedOwnership: input.ownership,
    qualificationOutcome
  };
  return immutable({ profile, profileDigest: address('HarnessProfileV1', profile), qualificationOutcome });
}

export function evaluateObserverSet(input) {
  exact(input, [
    'schemaSetDigest', 'observerSetDigest', 'requiredObserverIds', 'profiles', 'reports',
    'minimumIndependentCapturePoints', 'singleSourceExceptions'
  ], 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
  digest(input.observerSetDigest, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
  sortedUnique(input.requiredObserverIds, ascii, 1, 256, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
  if (!Number.isSafeInteger(input.minimumIndependentCapturePoints) || input.minimumIndependentCapturePoints < 1 || input.minimumIndependentCapturePoints > 8) fail('KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
  if (!Array.isArray(input.profiles) || !Array.isArray(input.reports) || !Array.isArray(input.singleSourceExceptions)) fail('KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
  const profiles = new Map();
  for (const profile of input.profiles) {
    exact(profile, [
      'observerId', 'role', 'implementationDigest', 'configDigest', 'platformDigest',
      'isolationBackendDigest', 'eventSchemaDigest', 'authorityId', 'capturePointId',
      'limitsDigest', 'failureCodes', 'negativeVectorIds', 'subjectWritable', 'qualificationOutcome'
    ], 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    ascii(profile.observerId, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID'); ascii(profile.role, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    ascii(profile.authorityId, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID'); ascii(profile.capturePointId, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    for (const [key, value] of Object.entries(profile)) if (key.endsWith('Digest')) digest(value, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    sortedUnique(profile.failureCodes, registry, 0, 64, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    sortedUnique(profile.negativeVectorIds, ascii, 1, 256, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    bool(profile.subjectWritable, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    enumeration(profile.qualificationOutcome, HARNESS_CLOSURE_OUTCOMES, 'KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    if (profiles.has(profile.observerId)) fail('KSTACK_HARNESS_OBSERVER_PROFILE_INVALID');
    profiles.set(profile.observerId, profile);
  }
  const exceptions = new Map();
  for (const exception of input.singleSourceExceptions) {
    exact(exception, ['factId', 'authoritativeObserverId', 'mutationVectorDigest', 'requirementProfileAccepts'], 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    ascii(exception.factId, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID'); ascii(exception.authoritativeObserverId, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    digest(exception.mutationVectorDigest, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID'); bool(exception.requirementProfileAccepts, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    if (exceptions.has(exception.factId)) fail('KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    exceptions.set(exception.factId, exception);
  }
  const statuses = new Set();
  for (const observerId of input.requiredObserverIds) {
    const profile = profiles.get(observerId);
    if (!profile) statuses.add('MISSING');
    else if (profile.subjectWritable) statuses.add('SUBJECT_WRITABLE');
    else if (profile.qualificationOutcome !== 'PROVEN') statuses.add('MISSING');
  }
  const byFact = new Map();
  const reportObservers = new Set();
  for (const report of input.reports) {
    exact(report, ['observerId', 'factId', 'factDigest', 'eventSchemaDigest', 'status', 'protectedAttestationDigest'], 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    ascii(report.observerId, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID'); ascii(report.factId, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    digest(report.factDigest, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID'); digest(report.eventSchemaDigest, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    digest(report.protectedAttestationDigest, 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    enumeration(report.status, ['VALID', 'MISSING', 'CONTRADICTORY', 'TRUNCATED', 'LATE', 'SCHEMA_INVALID'], 'KSTACK_HARNESS_OBSERVER_INPUT_INVALID');
    const profile = profiles.get(report.observerId);
    reportObservers.add(report.observerId);
    if (!profile || !input.requiredObserverIds.includes(report.observerId)) statuses.add('SCHEMA_INVALID');
    else if (profile.eventSchemaDigest !== report.eventSchemaDigest) statuses.add('SCHEMA_INVALID');
    if (report.status !== 'VALID') statuses.add(report.status);
    const facts = byFact.get(report.factId) ?? [];
    facts.push({ report, profile }); byFact.set(report.factId, facts);
  }
  if (input.requiredObserverIds.some((id) => !reportObservers.has(id))) statuses.add('MISSING');
  for (const [factId, entries] of byFact) {
    if (new Set(entries.map((entry) => entry.report.factDigest)).size > 1) statuses.add('CONTRADICTORY');
    const independent = new Set(entries.filter((entry) => entry.profile && entry.report.status === 'VALID')
      .map((entry) => `${entry.profile.authorityId}\u0000${entry.profile.capturePointId}`));
    if (independent.size < input.minimumIndependentCapturePoints) {
      const exception = exceptions.get(factId);
      const accepted = exception?.requirementProfileAccepts === true
        && entries.some((entry) => entry.report.observerId === exception.authoritativeObserverId && entry.report.status === 'VALID');
      if (!accepted) statuses.add('INSUFFICIENT_INDEPENDENCE');
    }
  }
  if (statuses.size === 0) statuses.add('VALID');
  else statuses.delete('VALID');
  const observerStatuses = [...statuses].sort();
  const outcome = observerStatuses.includes('CONTRADICTORY') ? 'CONTRADICTORY'
    : observerStatuses.some((status) => status !== 'VALID') ? 'UNAVAILABLE' : 'PROVEN';
  const evaluation = {
    ...head('ObserverEvaluationV1', input.schemaSetDigest),
    observerSetDigest: input.observerSetDigest,
    requiredObserverIds: input.requiredObserverIds,
    reportDigest: hostAddress('KSTACK-OBSERVER-REPORT-SET-V1', input.reports),
    observerStatuses,
    outcome
  };
  return immutable({ evaluation, evaluationDigest: address('ObserverEvaluationV1', evaluation) });
}

function validateExecutableLayer(value) {
  exact(value, [
    'buildProvenanceComplete', 'buildGraphComplete', 'loaderObserved', 'denyUnregisteredCode',
    'denyWritableExecutable', 'denyRuntimeDownloads', 'denyAlternateInterpreters',
    'allLoadedDigestsRegistered', 'eventOverflow', 'contradiction'
  ], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  Object.values(value).forEach((entry) => bool(entry, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID'));
}
function validateEffectRow(value) {
  exact(value, ['familyId', 'boundaryAvailable', 'boundaryMediated', 'observerIndependent', 'registryComplete', 'eventOverflow', 'contradiction'], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  enumeration(value.familyId, EFFECT_FAMILIES, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  for (const key of ['boundaryAvailable', 'boundaryMediated', 'observerIndependent', 'registryComplete', 'eventOverflow', 'contradiction']) bool(value[key], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
}

export function evaluateEffectChokePointClosure(input) {
  exact(input, [
    'schemaSetDigest', 'hostTupleDigest', 'executableClosureDigest', 'buildManifestDigest',
    'runtimeRegistryDigest', 'loaderPolicyDigest', 'nativeExtensionRegistryDigest',
    'executableMemoryPolicyDigest', 'sandboxProfileDigest', 'kernelMediationProfileDigest',
    'brokerMediationProfileDigest', 'effectFamilyRegistryDigest', 'coverageVectorSetDigest',
    'environmentSnapshotDigest', 'operationProfileIds', 'executableLayer', 'effectLayer', 'reachabilityRows'
  ], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  for (const field of [
    'hostTupleDigest', 'executableClosureDigest', 'buildManifestDigest', 'runtimeRegistryDigest',
    'loaderPolicyDigest', 'nativeExtensionRegistryDigest', 'executableMemoryPolicyDigest',
    'sandboxProfileDigest', 'kernelMediationProfileDigest', 'brokerMediationProfileDigest',
    'effectFamilyRegistryDigest', 'coverageVectorSetDigest', 'environmentSnapshotDigest'
  ]) digest(input[field], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  sortedUnique(input.operationProfileIds, ascii, 1, 256, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  validateExecutableLayer(input.executableLayer);
  if (!Array.isArray(input.effectLayer) || input.effectLayer.length !== EFFECT_FAMILIES.length) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  input.effectLayer.forEach(validateEffectRow);
  const effectIds = input.effectLayer.map((row) => row.familyId).sort();
  if (!same(effectIds, [...EFFECT_FAMILIES])) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  if (!Array.isArray(input.reachabilityRows) || input.reachabilityRows.length !== EFFECT_FAMILIES.length) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  const reachability = new Map();
  for (const row of input.reachabilityRows) {
    exact(row, ['familyId', 'operationProfileIds', 'reachabilityProven'], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    enumeration(row.familyId, EFFECT_FAMILIES, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    sortedUnique(row.operationProfileIds, ascii, 0, 256, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    bool(row.reachabilityProven, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    if (row.operationProfileIds.some((id) => !input.operationProfileIds.includes(id)) || reachability.has(row.familyId)) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    reachability.set(row.familyId, row);
  }
  const executableFlags = Object.entries(input.executableLayer).filter(([key]) => key !== 'contradiction' && key !== 'eventOverflow');
  let executableOutcome = executableFlags.every(([, value]) => value) && !input.executableLayer.eventOverflow ? 'PROVEN' : 'UNKNOWN';
  if (input.executableLayer.contradiction) executableOutcome = 'CONTRADICTORY';
  const familyOutcomes = input.effectLayer.map((row) => {
    let outcome = row.boundaryAvailable ? 'PROVEN' : 'UNAVAILABLE';
    if (row.boundaryAvailable && (!row.boundaryMediated || !row.observerIndependent || !row.registryComplete || row.eventOverflow)) outcome = 'UNKNOWN';
    if (row.contradiction) outcome = 'CONTRADICTORY';
    if (executableOutcome !== 'PROVEN' && outcome === 'PROVEN') outcome = executableOutcome;
    const reach = reachability.get(row.familyId);
    const blockedOperationProfileIds = outcome === 'PROVEN'
      ? []
      : reach.reachabilityProven ? reach.operationProfileIds : [...input.operationProfileIds];
    return { familyId: row.familyId, outcome, blockedOperationProfileIds };
  });
  const outcomes = [executableOutcome, ...familyOutcomes.map((row) => row.outcome)];
  const outcome = outcomes.includes('CONTRADICTORY') ? 'CONTRADICTORY'
    : outcomes.includes('UNAVAILABLE') ? 'UNAVAILABLE'
      : outcomes.includes('UNKNOWN') ? 'UNKNOWN' : 'PROVEN';
  const closure = {
    ...head('EffectChokePointClosureV1', input.schemaSetDigest),
    hostTupleDigest: input.hostTupleDigest,
    executableClosureDigest: input.executableClosureDigest,
    buildManifestDigest: input.buildManifestDigest,
    runtimeRegistryDigest: input.runtimeRegistryDigest,
    loaderPolicyDigest: input.loaderPolicyDigest,
    nativeExtensionRegistryDigest: input.nativeExtensionRegistryDigest,
    executableMemoryPolicyDigest: input.executableMemoryPolicyDigest,
    sandboxProfileDigest: input.sandboxProfileDigest,
    kernelMediationProfileDigest: input.kernelMediationProfileDigest,
    brokerMediationProfileDigest: input.brokerMediationProfileDigest,
    effectFamilyRegistryDigest: input.effectFamilyRegistryDigest,
    coverageVectorSetDigest: input.coverageVectorSetDigest,
    environmentSnapshotDigest: input.environmentSnapshotDigest,
    executableOutcome,
    familyOutcomes,
    outcome
  };
  return immutable({ closure, closureDigest: address('EffectChokePointClosureV1', closure) });
}

export function validateEffectChokePointClosure(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'hostTupleDigest', 'executableClosureDigest',
    'buildManifestDigest', 'runtimeRegistryDigest', 'loaderPolicyDigest', 'nativeExtensionRegistryDigest',
    'executableMemoryPolicyDigest', 'sandboxProfileDigest', 'kernelMediationProfileDigest',
    'brokerMediationProfileDigest', 'effectFamilyRegistryDigest', 'coverageVectorSetDigest',
    'environmentSnapshotDigest', 'executableOutcome', 'familyOutcomes', 'outcome'
  ], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  validateHead(value, 'EffectChokePointClosureV1', 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  enumeration(value.executableOutcome, HARNESS_CLOSURE_OUTCOMES, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  enumeration(value.outcome, HARNESS_CLOSURE_OUTCOMES, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  if (!Array.isArray(value.familyOutcomes) || value.familyOutcomes.length !== EFFECT_FAMILIES.length) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  for (const row of value.familyOutcomes) {
    exact(row, ['familyId', 'outcome', 'blockedOperationProfileIds'], 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    enumeration(row.familyId, EFFECT_FAMILIES, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    enumeration(row.outcome, HARNESS_CLOSURE_OUTCOMES, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    sortedUnique(row.blockedOperationProfileIds, ascii, 0, 256, 'KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
    if (row.outcome === 'PROVEN' && row.blockedOperationProfileIds.length !== 0) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  }
  const ids = value.familyOutcomes.map((row) => row.familyId).sort();
  if (!same(ids, [...EFFECT_FAMILIES])) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  const outcomes = [value.executableOutcome, ...value.familyOutcomes.map((row) => row.outcome)];
  const expected = outcomes.includes('CONTRADICTORY') ? 'CONTRADICTORY'
    : outcomes.includes('UNAVAILABLE') ? 'UNAVAILABLE' : outcomes.includes('UNKNOWN') ? 'UNKNOWN' : 'PROVEN';
  if (value.outcome !== expected) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  return immutable(value);
}

function validateSurface(value, code = 'KSTACK_BYPASS_INVENTORY_INVALID') {
  exact(value, ['surfaceId', 'familyId', 'descriptorDigest'], code);
  ascii(value.surfaceId, code);
  enumeration(value.familyId, EFFECT_FAMILIES, code);
  digest(value.descriptorDigest, code);
}
function validateRegistration(value) {
  exact(value, [
    'surfaceId', 'familyId', 'registrationDigest', 'reachableOperationProfileIds', 'mediationPointId',
    'observerIds', 'positiveFixtureIds', 'negativeFixtureIds', 'requestedStatus', 'disabledProofDigest',
    'unreachableProofDigest', 'effectObserved', 'mediationObserved', 'limitationCodes'
  ], 'KSTACK_BYPASS_INVENTORY_INVALID');
  ascii(value.surfaceId, 'KSTACK_BYPASS_INVENTORY_INVALID');
  enumeration(value.familyId, EFFECT_FAMILIES, 'KSTACK_BYPASS_INVENTORY_INVALID');
  digest(value.registrationDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
  sortedUnique(value.reachableOperationProfileIds, ascii, 1, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
  ascii(value.mediationPointId, 'KSTACK_BYPASS_INVENTORY_INVALID');
  sortedUnique(value.observerIds, ascii, 0, 64, 'KSTACK_BYPASS_INVENTORY_INVALID');
  sortedUnique(value.positiveFixtureIds, ascii, 0, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
  sortedUnique(value.negativeFixtureIds, ascii, 1, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
  enumeration(value.requestedStatus, BYPASS_STATUSES, 'KSTACK_BYPASS_INVENTORY_INVALID');
  if (value.disabledProofDigest !== null) digest(value.disabledProofDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
  if (value.unreachableProofDigest !== null) digest(value.unreachableProofDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
  bool(value.effectObserved, 'KSTACK_BYPASS_INVENTORY_INVALID');
  bool(value.mediationObserved, 'KSTACK_BYPASS_INVENTORY_INVALID');
  sortedUnique(value.limitationCodes, registry, 0, 64, 'KSTACK_BYPASS_INVENTORY_INVALID');
}

export function buildHostBypassInventory(input) {
  exact(input, ['schemaSetDigest', 'hostTupleDigest', 'closure', 'operationProfileIds', 'sourceInventories', 'registrations'], 'KSTACK_BYPASS_INVENTORY_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
  digest(input.hostTupleDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
  const closure = validateEffectChokePointClosure(input.closure);
  if (closure.hostTupleDigest !== input.hostTupleDigest) fail('KSTACK_BYPASS_INVENTORY_CLOSURE_INVALID');
  sortedUnique(input.operationProfileIds, ascii, 1, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
  if (!Array.isArray(input.sourceInventories) || input.sourceInventories.length !== INVENTORY_KINDS.length) fail('KSTACK_BYPASS_INVENTORY_INVALID');
  const joined = new Map();
  const seenKinds = [];
  for (const source of input.sourceInventories) {
    exact(source, ['sourceKind', 'sourceDigest', 'surfaces'], 'KSTACK_BYPASS_INVENTORY_INVALID');
    enumeration(source.sourceKind, INVENTORY_KINDS, 'KSTACK_BYPASS_INVENTORY_INVALID');
    digest(source.sourceDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
    if (!Array.isArray(source.surfaces)) fail('KSTACK_BYPASS_INVENTORY_INVALID');
    source.surfaces.forEach((surface) => {
      validateSurface(surface);
      const row = joined.get(surface.surfaceId) ?? { sources: new Map(), families: new Set(), descriptors: new Set() };
      if (row.sources.has(source.sourceKind)) fail('KSTACK_BYPASS_INVENTORY_INVALID');
      row.sources.set(source.sourceKind, source.sourceDigest);
      row.families.add(surface.familyId);
      row.descriptors.add(surface.descriptorDigest);
      joined.set(surface.surfaceId, row);
    });
    seenKinds.push(source.sourceKind);
  }
  if (!same(seenKinds.sort(), [...INVENTORY_KINDS])) fail('KSTACK_BYPASS_INVENTORY_INVALID');
  if (!Array.isArray(input.registrations)) fail('KSTACK_BYPASS_INVENTORY_INVALID');
  const registrations = new Map();
  for (const registration of input.registrations) {
    validateRegistration(registration);
    if (registrations.has(registration.surfaceId) || registration.reachableOperationProfileIds.some((id) => !input.operationProfileIds.includes(id))) fail('KSTACK_BYPASS_INVENTORY_INVALID');
    registrations.set(registration.surfaceId, registration);
    if (!joined.has(registration.surfaceId)) joined.set(registration.surfaceId, { sources: new Map(), families: new Set([registration.familyId]), descriptors: new Set() });
  }
  const surfaces = [];
  for (const surfaceId of [...joined.keys()].sort()) {
    const joinedRow = joined.get(surfaceId);
    const registration = registrations.get(surfaceId) ?? null;
    const familyId = registration?.familyId ?? [...joinedRow.families][0];
    const closureRow = closure.familyOutcomes.find((row) => row.familyId === familyId);
    let status = 'UNKNOWN';
    const limitationCodes = new Set(registration?.limitationCodes ?? []);
    if (!registration || joinedRow.families.size !== 1 || joinedRow.descriptors.size !== 1 || joinedRow.sources.size !== INVENTORY_KINDS.length) {
      limitationCodes.add('KSTACK_BYPASS_INVENTORY_INCOMPLETE');
    } else if (!closureRow || closureRow.outcome !== 'PROVEN') {
      limitationCodes.add('KSTACK_BYPASS_INVENTORY_CLOSURE_UNPROVEN');
    } else if (registration.effectObserved && !registration.mediationObserved) {
      status = 'BYPASS_FOUND'; limitationCodes.add('KSTACK_BYPASS_FOUND');
    } else if (registration.observerIds.length === 0) {
      status = 'UNOBSERVABLE'; limitationCodes.add('KSTACK_BYPASS_UNOBSERVABLE');
    } else if (registration.requestedStatus === 'COVERED' && registration.mediationObserved
      && registration.positiveFixtureIds.length > 0 && registration.negativeFixtureIds.length > 0) status = 'COVERED';
    else if (registration.requestedStatus === 'DISABLED_PROVEN' && registration.disabledProofDigest !== null && !registration.effectObserved) status = 'DISABLED_PROVEN';
    else if (registration.requestedStatus === 'UNREACHABLE_PROVEN' && registration.unreachableProofDigest !== null && !registration.effectObserved) status = 'UNREACHABLE_PROVEN';
    else if (registration.requestedStatus === 'BYPASS_FOUND' && registration.effectObserved) status = 'BYPASS_FOUND';
    const registeredReachable = registration?.reachableOperationProfileIds;
    const closureBlocked = closureRow?.blockedOperationProfileIds ?? [];
    const reachableOperationProfileIds = registeredReachable !== undefined || closureBlocked.length > 0
      ? [...new Set([...(registeredReachable ?? []), ...closureBlocked])].sort()
      : [...input.operationProfileIds];
    surfaces.push({
      surfaceId,
      familyId,
      sourceKinds: [...joinedRow.sources.keys()].sort(),
      descriptorDigests: [...joinedRow.descriptors].sort(),
      registrationDigest: registration?.registrationDigest ?? null,
      reachableOperationProfileIds,
      mediationPointId: registration?.mediationPointId ?? null,
      observerIds: registration?.observerIds ?? [],
      positiveFixtureIds: registration?.positiveFixtureIds ?? [],
      negativeFixtureIds: registration?.negativeFixtureIds ?? [],
      status,
      limitationCodes: [...limitationCodes].sort()
    });
  }
  const inventory = {
    ...head('HostBypassInventoryV1', input.schemaSetDigest),
    hostTupleDigest: input.hostTupleDigest,
    closureDigest: address('EffectChokePointClosureV1', input.closure),
    sourceInventoryDigests: input.sourceInventories.map((source) => source.sourceDigest).sort(),
    operationProfileIds: input.operationProfileIds,
    surfaces
  };
  return immutable({ inventory, inventoryDigest: address('HostBypassInventoryV1', inventory) });
}

export function validateHostBypassInventory(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'hostTupleDigest', 'closureDigest',
    'sourceInventoryDigests', 'operationProfileIds', 'surfaces'
  ], 'KSTACK_BYPASS_INVENTORY_INVALID');
  validateHead(value, 'HostBypassInventoryV1', 'KSTACK_BYPASS_INVENTORY_INVALID');
  digest(value.hostTupleDigest, 'KSTACK_BYPASS_INVENTORY_INVALID'); digest(value.closureDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
  sortedUnique(value.sourceInventoryDigests, digest, 4, 4, 'KSTACK_BYPASS_INVENTORY_INVALID');
  sortedUnique(value.operationProfileIds, ascii, 1, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
  if (!Array.isArray(value.surfaces) || value.surfaces.length < 1) fail('KSTACK_BYPASS_INVENTORY_INVALID');
  for (const surface of value.surfaces) {
    exact(surface, [
      'surfaceId', 'familyId', 'sourceKinds', 'descriptorDigests', 'registrationDigest',
      'reachableOperationProfileIds', 'mediationPointId', 'observerIds', 'positiveFixtureIds',
      'negativeFixtureIds', 'status', 'limitationCodes'
    ], 'KSTACK_BYPASS_INVENTORY_INVALID');
    ascii(surface.surfaceId, 'KSTACK_BYPASS_INVENTORY_INVALID'); enumeration(surface.familyId, EFFECT_FAMILIES, 'KSTACK_BYPASS_INVENTORY_INVALID');
    sortedUnique(surface.sourceKinds, (entry, code) => enumeration(entry, INVENTORY_KINDS, code), 0, 4, 'KSTACK_BYPASS_INVENTORY_INVALID');
    sortedUnique(surface.descriptorDigests, digest, 0, 4, 'KSTACK_BYPASS_INVENTORY_INVALID');
    if (surface.registrationDigest !== null) digest(surface.registrationDigest, 'KSTACK_BYPASS_INVENTORY_INVALID');
    sortedUnique(surface.reachableOperationProfileIds, ascii, 1, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
    if (surface.mediationPointId !== null) ascii(surface.mediationPointId, 'KSTACK_BYPASS_INVENTORY_INVALID');
    sortedUnique(surface.observerIds, ascii, 0, 64, 'KSTACK_BYPASS_INVENTORY_INVALID');
    sortedUnique(surface.positiveFixtureIds, ascii, 0, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
    sortedUnique(surface.negativeFixtureIds, ascii, 0, 256, 'KSTACK_BYPASS_INVENTORY_INVALID');
    enumeration(surface.status, BYPASS_STATUSES, 'KSTACK_BYPASS_INVENTORY_INVALID');
    sortedUnique(surface.limitationCodes, registry, 0, 64, 'KSTACK_BYPASS_INVENTORY_INVALID');
  }
  const ids = value.surfaces.map((surface) => surface.surfaceId);
  if (new Set(ids).size !== ids.length || ids.some((id, index) => index > 0 && id <= ids[index - 1])) fail('KSTACK_BYPASS_INVENTORY_INVALID');
  return immutable(value);
}

function tupleKey(row) {
  return [row.operationProfileId, row.capabilityId, row.bypassSurfaceId, row.environmentSelectorId, row.observerIds.join(',')].join('|');
}
function validateRequirement(value) {
  exact(value, ['operationProfileId', 'capabilityId', 'bypassSurfaceId', 'observerIds', 'environmentSelectorId', 'intrinsicallyNegative'], 'KSTACK_COVERAGE_INPUT_INVALID');
  ascii(value.operationProfileId, 'KSTACK_COVERAGE_INPUT_INVALID'); ascii(value.capabilityId, 'KSTACK_COVERAGE_INPUT_INVALID');
  ascii(value.bypassSurfaceId, 'KSTACK_COVERAGE_INPUT_INVALID'); ascii(value.environmentSelectorId, 'KSTACK_COVERAGE_INPUT_INVALID');
  sortedUnique(value.observerIds, ascii, 1, 64, 'KSTACK_COVERAGE_INPUT_INVALID'); bool(value.intrinsicallyNegative, 'KSTACK_COVERAGE_INPUT_INVALID');
}
function validateFixture(value) {
  exact(value, ['fixtureId', 'kind', 'observerIds'], 'KSTACK_COVERAGE_INPUT_INVALID');
  ascii(value.fixtureId, 'KSTACK_COVERAGE_INPUT_INVALID'); enumeration(value.kind, ['NEGATIVE', 'POSITIVE'], 'KSTACK_COVERAGE_INPUT_INVALID');
  sortedUnique(value.observerIds, ascii, 1, 64, 'KSTACK_COVERAGE_INPUT_INVALID');
}

export function evaluateCoverageClosure(input) {
  exact(input, ['schemaSetDigest', 'hostTupleDigest', 'inventory', 'requirements', 'fixtures', 'rows', 'executedFixtureIds', 'environmentStartDigest', 'environmentEndDigest'], 'KSTACK_COVERAGE_INPUT_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_COVERAGE_INPUT_INVALID'); digest(input.hostTupleDigest, 'KSTACK_COVERAGE_INPUT_INVALID');
  digest(input.environmentStartDigest, 'KSTACK_COVERAGE_INPUT_INVALID'); digest(input.environmentEndDigest, 'KSTACK_COVERAGE_INPUT_INVALID');
  const inventory = validateHostBypassInventory(input.inventory);
  if (inventory.hostTupleDigest !== input.hostTupleDigest) fail('KSTACK_COVERAGE_INPUT_INVALID');
  if (!Array.isArray(input.requirements) || !Array.isArray(input.fixtures) || !Array.isArray(input.rows)) fail('KSTACK_COVERAGE_INPUT_INVALID');
  input.requirements.forEach(validateRequirement); input.fixtures.forEach(validateFixture);
  const requirementKeys = input.requirements.map(tupleKey).sort();
  if (new Set(requirementKeys).size !== requirementKeys.length) fail('KSTACK_COVERAGE_DUPLICATE');
  const fixtureMap = new Map();
  for (const fixture of input.fixtures) { if (fixtureMap.has(fixture.fixtureId)) fail('KSTACK_COVERAGE_DUPLICATE'); fixtureMap.set(fixture.fixtureId, fixture); }
  const reasons = new Set();
  const rowKeys = [];
  const selected = new Set();
  for (const row of input.rows) {
    exact(row, ['operationProfileId', 'capabilityId', 'bypassSurfaceId', 'observerIds', 'environmentSelectorId', 'positiveFixtureIds', 'negativeFixtureIds'], 'KSTACK_COVERAGE_INPUT_INVALID');
    validateRequirement({
      operationProfileId: row.operationProfileId,
      capabilityId: row.capabilityId,
      bypassSurfaceId: row.bypassSurfaceId,
      observerIds: row.observerIds,
      environmentSelectorId: row.environmentSelectorId,
      intrinsicallyNegative: false
    });
    sortedUnique(row.positiveFixtureIds, ascii, 0, 256, 'KSTACK_COVERAGE_INPUT_INVALID');
    sortedUnique(row.negativeFixtureIds, ascii, 1, 256, 'KSTACK_COVERAGE_INPUT_INVALID');
    const key = tupleKey(row); rowKeys.push(key);
    const requirement = input.requirements.find((entry) => tupleKey(entry) === key);
    if (!requirement) reasons.add('KSTACK_COVERAGE_EXTRA_ROW');
    else if ((!requirement.intrinsicallyNegative && row.positiveFixtureIds.length < 1) || (requirement.intrinsicallyNegative && row.negativeFixtureIds.length < 2)) reasons.add('KSTACK_COVERAGE_FIXTURE_MISSING');
    for (const fixtureId of [...row.positiveFixtureIds, ...row.negativeFixtureIds]) {
      selected.add(fixtureId);
      const fixture = fixtureMap.get(fixtureId);
      const expectedKind = row.positiveFixtureIds.includes(fixtureId) ? 'POSITIVE' : 'NEGATIVE';
      if (!fixture || fixture.kind !== expectedKind || !same(fixture.observerIds, row.observerIds)) reasons.add('KSTACK_COVERAGE_OBSERVER_MISMATCH');
    }
  }
  rowKeys.sort();
  if (new Set(rowKeys).size !== rowKeys.length) reasons.add('KSTACK_COVERAGE_DUPLICATE');
  if (setDifference(requirementKeys, rowKeys).length > 0) reasons.add('KSTACK_COVERAGE_REQUIREMENT_MISSING');
  const inventorySurfaceIds = inventory.surfaces.map((surface) => surface.surfaceId).sort();
  const matrixSurfaceIds = [...new Set(input.rows.map((row) => row.bypassSurfaceId))].sort();
  if (!same(inventorySurfaceIds, matrixSurfaceIds)) reasons.add('KSTACK_COVERAGE_SURFACE_MISMATCH');
  const registeredFixtureIds = [...fixtureMap.keys()].sort();
  if (!same(registeredFixtureIds, [...selected].sort())) reasons.add('KSTACK_COVERAGE_ORPHAN_FIXTURE');
  sortedUnique(input.executedFixtureIds, ascii, 0, 4096, 'KSTACK_COVERAGE_INPUT_INVALID');
  if (!same([...selected].sort(), input.executedFixtureIds)) reasons.add('KSTACK_COVERAGE_EXECUTION_MISMATCH');
  if (input.environmentStartDigest !== input.environmentEndDigest) reasons.add('KSTACK_CONFORMANCE_ENVIRONMENT_CHANGED');
  const reasonCodes = [...reasons].sort();
  const matrix = {
    ...head('ConformanceCoverageMatrixV1', input.schemaSetDigest),
    hostTupleDigest: input.hostTupleDigest,
    inventoryDigest: address('HostBypassInventoryV1', input.inventory),
    requirementTupleKeys: requirementKeys,
    matrixTupleKeys: rowKeys,
    fixtureIds: [...selected].sort(),
    environmentStartDigest: input.environmentStartDigest,
    environmentEndDigest: input.environmentEndDigest,
    complete: reasonCodes.length === 0,
    reasonCodes
  };
  return immutable({ matrix, matrixDigest: address('ConformanceCoverageMatrixV1', matrix) });
}

export function validateCoverageMatrix(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'hostTupleDigest', 'inventoryDigest',
    'requirementTupleKeys', 'matrixTupleKeys', 'fixtureIds', 'environmentStartDigest',
    'environmentEndDigest', 'complete', 'reasonCodes'
  ], 'KSTACK_COVERAGE_INPUT_INVALID');
  validateHead(value, 'ConformanceCoverageMatrixV1', 'KSTACK_COVERAGE_INPUT_INVALID');
  for (const field of ['hostTupleDigest', 'inventoryDigest', 'environmentStartDigest', 'environmentEndDigest']) digest(value[field], 'KSTACK_COVERAGE_INPUT_INVALID');
  sortedUnique(value.requirementTupleKeys, boundedText, 0, 4096, 'KSTACK_COVERAGE_INPUT_INVALID');
  sortedUnique(value.matrixTupleKeys, boundedText, 0, 4096, 'KSTACK_COVERAGE_INPUT_INVALID');
  sortedUnique(value.fixtureIds, ascii, 0, 4096, 'KSTACK_COVERAGE_INPUT_INVALID');
  bool(value.complete, 'KSTACK_COVERAGE_INPUT_INVALID'); sortedUnique(value.reasonCodes, registry, 0, 64, 'KSTACK_COVERAGE_INPUT_INVALID');
  if (value.complete !== (value.reasonCodes.length === 0)) fail('KSTACK_COVERAGE_INPUT_INVALID');
  return immutable(value);
}

export function advanceFixtureExecution(currentState, nextState, facts = {}) {
  enumeration(currentState, FIXTURE_STATES, 'KSTACK_HARNESS_FIXTURE_STATE_INVALID');
  enumeration(nextState, FIXTURE_STATES, 'KSTACK_HARNESS_FIXTURE_STATE_INVALID');
  if (!(TRANSITIONS[currentState] ?? []).includes(nextState)) fail('KSTACK_HARNESS_FIXTURE_TRANSITION_INVALID');
  if (nextState === 'PASS') {
    exact(facts, ['oraclePassed', 'observersAgree', 'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed'], 'KSTACK_HARNESS_FIXTURE_PASS_INVALID');
    if (!facts.oraclePassed || !facts.observersAgree || facts.forbiddenSideEffects || !facts.limitsPassed || !facts.cleanupPassed) fail('KSTACK_HARNESS_FIXTURE_PASS_INVALID');
  }
  return nextState;
}

export function classifyEffectTermination(input) {
  exact(input, ['termination', 'actionBoundaryCrossed', 'outcomeProven', 'harnessIntegrity'], 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
  enumeration(input.termination, ['CANCELLED', 'CRASHED', 'DEADLINE', 'TRANSPORT_LOST'], 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
  bool(input.actionBoundaryCrossed, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID'); bool(input.outcomeProven, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID'); bool(input.harnessIntegrity, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
  if (!input.harnessIntegrity) return 'HARNESS_ERROR';
  if (input.actionBoundaryCrossed && !input.outcomeProven) return 'AMBIGUOUS';
  return 'FAIL';
}

export function sealConformanceRunPlan(input) {
  exact(input, [
    'schemaSetDigest', 'planId', 'hostTupleDigest', 'hostBuildDigest', 'adapterDigest', 'platformDigest',
    'activeSetDigest', 'policyDigest', 'operationProfileDigest', 'requirementProfileDigest',
    'environmentSnapshotDigest', 'harnessProfileDigest', 'observerSetDigest', 'bypassInventoryDigest',
    'coverageMatrixDigest', 'isolationTargetDigest', 'sideEffectBudgetDigest', 'fakeProviderSetDigest',
    'trustedTimeSampleDigest', 'declaredAt', 'expiresAt'
  ], 'KSTACK_HARNESS_PLAN_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_HARNESS_PLAN_INVALID'); ascii(input.planId, 'KSTACK_HARNESS_PLAN_INVALID');
  for (const [field, value] of Object.entries(input)) if (field.endsWith('Digest')) digest(value, 'KSTACK_HARNESS_PLAN_INVALID');
  timestamp(input.declaredAt, 'KSTACK_HARNESS_PLAN_INVALID'); timestamp(input.expiresAt, 'KSTACK_HARNESS_PLAN_INVALID');
  if (input.declaredAt >= input.expiresAt) fail('KSTACK_HARNESS_PLAN_EXPIRED');
  const plan = { ...head('ConformanceRunPlanV1', input.schemaSetDigest), ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'schemaSetDigest')) };
  return immutable({ plan, planDigest: address('ConformanceRunPlanV1', plan) });
}

export function validateConformanceRunPlan(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'planId', 'hostTupleDigest', 'hostBuildDigest',
    'adapterDigest', 'platformDigest', 'activeSetDigest', 'policyDigest', 'operationProfileDigest',
    'requirementProfileDigest', 'environmentSnapshotDigest', 'harnessProfileDigest', 'observerSetDigest',
    'bypassInventoryDigest', 'coverageMatrixDigest', 'isolationTargetDigest', 'sideEffectBudgetDigest',
    'fakeProviderSetDigest', 'trustedTimeSampleDigest', 'declaredAt', 'expiresAt'
  ], 'KSTACK_HARNESS_PLAN_INVALID');
  validateHead(value, 'ConformanceRunPlanV1', 'KSTACK_HARNESS_PLAN_INVALID');
  ascii(value.planId, 'KSTACK_HARNESS_PLAN_INVALID');
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, 'KSTACK_HARNESS_PLAN_INVALID');
  timestamp(value.declaredAt, 'KSTACK_HARNESS_PLAN_INVALID'); timestamp(value.expiresAt, 'KSTACK_HARNESS_PLAN_INVALID');
  if (value.declaredAt >= value.expiresAt) fail('KSTACK_HARNESS_PLAN_EXPIRED');
  return immutable(value);
}

function validateProtectedHarnessBackend(backend, allowTestBackend) {
  exact(backend, ['descriptor', 'append'], 'KSTACK_HARNESS_UNAVAILABLE');
  exact(backend.descriptor, [
    'protectionClass', 'repositoryWritable', 'agentWritable', 'durable', 'atomicPublication',
    'appendOnlyAudit', 'observerStateProtected', 'expectedOutcomeProtected'
  ], 'KSTACK_HARNESS_UNAVAILABLE');
  const classes = ['hardware-backed', 'os-protected', 'qualified-service'];
  if (allowTestBackend) classes.push('test-only');
  if (!classes.includes(backend.descriptor.protectionClass)
    || backend.descriptor.repositoryWritable !== false || backend.descriptor.agentWritable !== false
    || backend.descriptor.durable !== true || backend.descriptor.atomicPublication !== true
    || backend.descriptor.appendOnlyAudit !== true || backend.descriptor.observerStateProtected !== true
    || backend.descriptor.expectedOutcomeProtected !== true || typeof backend.append !== 'function') fail('KSTACK_HARNESS_UNAVAILABLE');
  return backend;
}

export class ProtectedHarnessKernel {
  #schemaSetDigest;
  #backend;
  #attempts = new Map();

  constructor(options) {
    exact(options, ['schemaSetDigest', 'backend', 'allowTestBackend'], 'KSTACK_HARNESS_UNAVAILABLE');
    this.#schemaSetDigest = digest(options.schemaSetDigest, 'KSTACK_HARNESS_UNAVAILABLE');
    this.#backend = validateProtectedHarnessBackend(options.backend, options.allowTestBackend === true);
  }

  async declareAttempt(input) {
    exact(input, ['attemptId', 'plan', 'fixtureIds', 'environmentDigest'], 'KSTACK_HARNESS_PLAN_INVALID');
    ascii(input.attemptId, 'KSTACK_HARNESS_PLAN_INVALID');
    const plan = validateConformanceRunPlan(input.plan);
    sortedUnique(input.fixtureIds, ascii, 1, 4096, 'KSTACK_HARNESS_PLAN_INVALID');
    digest(input.environmentDigest, 'KSTACK_HARNESS_PLAN_INVALID');
    if (plan.schemaSetDigest !== this.#schemaSetDigest || plan.environmentSnapshotDigest !== input.environmentDigest
      || this.#attempts.has(input.attemptId)) fail('KSTACK_HARNESS_PLAN_INVALID');
    const fixtureStates = new Map(input.fixtureIds.map((fixtureId) => [fixtureId, 'DECLARED']));
    const record = { attemptId: input.attemptId, planDigest: address('ConformanceRunPlanV1', plan), fixtureStates, sequence: 1 };
    const receipt = await this.#backend.append(immutable({
      eventType: 'ATTEMPT_DECLARED', attemptId: input.attemptId, planDigest: record.planDigest,
      fixtureIds: input.fixtureIds, sequence: record.sequence
    }));
    digest(receipt, 'KSTACK_HARNESS_UNAVAILABLE');
    this.#attempts.set(input.attemptId, record);
    return immutable({ attemptId: input.attemptId, planDigest: record.planDigest, protectedAuditReceiptDigest: receipt });
  }

  async transition(input) {
    exact(input, ['attemptId', 'fixtureId', 'nextState', 'facts'], 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
    ascii(input.attemptId, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID'); ascii(input.fixtureId, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
    const attempt = this.#attempts.get(input.attemptId);
    const currentState = attempt?.fixtureStates.get(input.fixtureId);
    if (!attempt || !currentState) fail('KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
    const nextState = advanceFixtureExecution(currentState, input.nextState, input.facts);
    const sequence = attempt.sequence + 1;
    const receipt = await this.#backend.append(immutable({
      eventType: 'FIXTURE_TRANSITION', attemptId: input.attemptId, fixtureId: input.fixtureId,
      currentState, nextState, sequence
    }));
    digest(receipt, 'KSTACK_HARNESS_UNAVAILABLE');
    attempt.fixtureStates.set(input.fixtureId, nextState); attempt.sequence = sequence;
    return immutable({ attemptId: input.attemptId, fixtureId: input.fixtureId, currentState, nextState, sequence, protectedAuditReceiptDigest: receipt });
  }

  snapshot(attemptId) {
    ascii(attemptId, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
    const attempt = this.#attempts.get(attemptId);
    if (!attempt) fail('KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
    return immutable({
      attemptId,
      planDigest: attempt.planDigest,
      sequence: attempt.sequence,
      fixtureStates: [...attempt.fixtureStates.entries()].map(([fixtureId, state]) => ({ fixtureId, state }))
    });
  }
}

function validateFixtureResult(value) {
  exact(value, ['fixtureId', 'status', 'oraclePassed', 'observersAgree', 'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed', 'actionBoundaryCrossed', 'outcomeProven'], 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
  ascii(value.fixtureId, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID'); enumeration(value.status, FIXTURE_STATES, 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
  if (!TERMINAL_FIXTURE_STATES.has(value.status)) fail('KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
  for (const key of ['oraclePassed', 'observersAgree', 'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed', 'actionBoundaryCrossed', 'outcomeProven']) bool(value[key], 'KSTACK_HARNESS_FIXTURE_INPUT_INVALID');
  if (value.status === 'PASS' && (!value.oraclePassed || !value.observersAgree || value.forbiddenSideEffects || !value.limitsPassed || !value.cleanupPassed)) fail('KSTACK_HARNESS_FIXTURE_PASS_INVALID');
}

export function aggregateConformanceRun(input) {
  exact(input, [
    'schemaSetDigest', 'planDigest', 'attemptId', 'closure', 'inventory', 'coverageMatrix',
    'fixtureResults', 'observerStatuses', 'environmentStartDigest', 'environmentEndDigest',
    'cleanupSucceeded', 'logsComplete', 'startedAt', 'completedAt'
  ], 'KSTACK_HARNESS_RESULT_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_HARNESS_RESULT_INVALID'); digest(input.planDigest, 'KSTACK_HARNESS_RESULT_INVALID'); ascii(input.attemptId, 'KSTACK_HARNESS_RESULT_INVALID');
  digest(input.environmentStartDigest, 'KSTACK_HARNESS_RESULT_INVALID'); digest(input.environmentEndDigest, 'KSTACK_HARNESS_RESULT_INVALID');
  bool(input.cleanupSucceeded, 'KSTACK_HARNESS_RESULT_INVALID'); bool(input.logsComplete, 'KSTACK_HARNESS_RESULT_INVALID');
  timestamp(input.startedAt, 'KSTACK_HARNESS_RESULT_INVALID'); timestamp(input.completedAt, 'KSTACK_HARNESS_RESULT_INVALID');
  const closure = validateEffectChokePointClosure(input.closure);
  const inventory = validateHostBypassInventory(input.inventory);
  const coverageMatrix = validateCoverageMatrix(input.coverageMatrix);
  if (input.startedAt >= input.completedAt) fail('KSTACK_HARNESS_RESULT_INVALID');
  if (!Array.isArray(input.fixtureResults) || input.fixtureResults.length === 0 || !Array.isArray(input.observerStatuses)) fail('KSTACK_HARNESS_RESULT_INVALID');
  input.fixtureResults.forEach(validateFixtureResult);
  const fixtureIds = input.fixtureResults.map((entry) => entry.fixtureId);
  if (new Set(fixtureIds).size !== fixtureIds.length) fail('KSTACK_HARNESS_RESULT_INVALID');
  input.observerStatuses.forEach((entry) => enumeration(entry, ['VALID', 'MISSING', 'CONTRADICTORY', 'TRUNCATED', 'SUBJECT_WRITABLE', 'LATE', 'SCHEMA_INVALID', 'INSUFFICIENT_INDEPENDENCE'], 'KSTACK_HARNESS_RESULT_INVALID'));
  const facts = {
    harnessError: closure.outcome === 'CONTRADICTORY'
      || input.observerStatuses.some((status) => ['MISSING', 'TRUNCATED', 'SUBJECT_WRITABLE', 'LATE', 'SCHEMA_INVALID', 'INSUFFICIENT_INDEPENDENCE'].includes(status))
      || input.fixtureResults.some((result) => result.status === 'HARNESS_ERROR'),
    ambiguous: input.observerStatuses.includes('CONTRADICTORY')
      || input.fixtureResults.some((result) => result.status === 'AMBIGUOUS' || result.actionBoundaryCrossed && !result.outcomeProven),
    failed: input.fixtureResults.some((result) => result.status === 'FAIL' || result.forbiddenSideEffects)
      || inventory.surfaces.some((surface) => surface.status === 'BYPASS_FOUND'),
    incomplete: closure.outcome !== 'PROVEN' || !coverageMatrix.complete
      || inventory.surfaces.some((surface) => ['UNKNOWN', 'UNOBSERVABLE'].includes(surface.status))
      || input.fixtureResults.some((result) => ['NOT_RUN', 'CAPABILITY_UNAVAILABLE'].includes(result.status))
      || input.environmentStartDigest !== input.environmentEndDigest || !input.cleanupSucceeded || !input.logsComplete
  };
  const aggregate = facts.harnessError ? 'HARNESS_ERROR' : facts.ambiguous ? 'AMBIGUOUS' : facts.failed ? 'FAIL' : facts.incomplete ? 'INCOMPLETE' : 'PASS';
  const result = {
    ...head('ConformanceRunResultV1', input.schemaSetDigest),
    planDigest: input.planDigest,
    attemptId: input.attemptId,
    closureDigest: address('EffectChokePointClosureV1', input.closure),
    inventoryDigest: address('HostBypassInventoryV1', input.inventory),
    coverageMatrixDigest: address('ConformanceCoverageMatrixV1', input.coverageMatrix),
    fixtureResultDigest: hostAddress('KSTACK-FIXTURE-RESULT-SET-V1', input.fixtureResults),
    observerStatusDigest: hostAddress('KSTACK-OBSERVER-STATUS-SET-V1', input.observerStatuses),
    environmentStartDigest: input.environmentStartDigest,
    environmentEndDigest: input.environmentEndDigest,
    cleanupSucceeded: input.cleanupSucceeded,
    logsComplete: input.logsComplete,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    aggregate,
    facts
  };
  return immutable({ result, resultDigest: address('ConformanceRunResultV1', result) });
}

export function validateConformanceRunResult(value) {
  exact(value, [
    'schemaId', 'schemaVersion', 'schemaSetDigest', 'planDigest', 'attemptId', 'closureDigest',
    'inventoryDigest', 'coverageMatrixDigest', 'fixtureResultDigest', 'observerStatusDigest',
    'environmentStartDigest', 'environmentEndDigest', 'cleanupSucceeded', 'logsComplete',
    'startedAt', 'completedAt', 'aggregate', 'facts'
  ], 'KSTACK_HARNESS_RESULT_INVALID');
  validateHead(value, 'ConformanceRunResultV1', 'KSTACK_HARNESS_RESULT_INVALID');
  ascii(value.attemptId, 'KSTACK_HARNESS_RESULT_INVALID');
  for (const [key, entry] of Object.entries(value)) if (key.endsWith('Digest')) digest(entry, 'KSTACK_HARNESS_RESULT_INVALID');
  bool(value.cleanupSucceeded, 'KSTACK_HARNESS_RESULT_INVALID'); bool(value.logsComplete, 'KSTACK_HARNESS_RESULT_INVALID');
  timestamp(value.startedAt, 'KSTACK_HARNESS_RESULT_INVALID'); timestamp(value.completedAt, 'KSTACK_HARNESS_RESULT_INVALID');
  if (value.startedAt >= value.completedAt) fail('KSTACK_HARNESS_RESULT_INVALID');
  enumeration(value.aggregate, CONFORMANCE_AGGREGATES, 'KSTACK_HARNESS_RESULT_INVALID');
  exact(value.facts, ['harnessError', 'ambiguous', 'failed', 'incomplete'], 'KSTACK_HARNESS_RESULT_INVALID');
  Object.values(value.facts).forEach((entry) => bool(entry, 'KSTACK_HARNESS_RESULT_INVALID'));
  const expected = value.facts.harnessError ? 'HARNESS_ERROR' : value.facts.ambiguous ? 'AMBIGUOUS'
    : value.facts.failed ? 'FAIL' : value.facts.incomplete ? 'INCOMPLETE' : 'PASS';
  if (value.aggregate !== expected) fail('KSTACK_HARNESS_RESULT_INVALID');
  return immutable(value);
}

export function createEvidenceProducerHandoff(input) {
  exact(input, ['schemaSetDigest', 'result', 'planDigest', 'environmentDigest', 'observerOwnershipDigest', 'protectedBackendAttestationDigest'], 'KSTACK_HARNESS_HANDOFF_INVALID');
  digest(input.schemaSetDigest, 'KSTACK_HARNESS_HANDOFF_INVALID');
  for (const field of ['planDigest', 'environmentDigest', 'observerOwnershipDigest', 'protectedBackendAttestationDigest']) digest(input[field], 'KSTACK_HARNESS_HANDOFF_INVALID');
  const result = validateConformanceRunResult(input.result);
  if (result.planDigest !== input.planDigest || result.environmentEndDigest !== input.environmentDigest) fail('KSTACK_HARNESS_HANDOFF_INVALID');
  const handoff = {
    ...head('EvidenceProducerHandoffV1', input.schemaSetDigest),
    resultDigest: address('ConformanceRunResultV1', input.result),
    planDigest: input.planDigest,
    environmentDigest: input.environmentDigest,
    observerOwnershipDigest: input.observerOwnershipDigest,
    protectedBackendAttestationDigest: input.protectedBackendAttestationDigest,
    aggregate: result.aggregate
  };
  return immutable({ handoff, handoffDigest: address('EvidenceProducerHandoffV1', handoff) });
}
