import {
  assertAsciiId,
  assertDigest,
  assertRegistryId,
  assertTimestamp,
  hostAddress
} from './kstack-host-contract.mjs';
import { advanceFixtureExecution } from './kstack-host-harness.mjs';

export class OpenCodeConformanceError extends Error {
  constructor(code) { super(code); this.name = 'OpenCodeConformanceError'; this.code = code; }
}

function fail(code) { throw new OpenCodeConformanceError(code); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function digest(value, code) { try { return assertDigest(value); } catch { fail(code); } }
function ascii(value, code) { try { return assertAsciiId(value); } catch { fail(code); } }
function registry(value, code) { try { return assertRegistryId(value); } catch { fail(code); } }
function timestamp(value, code) { try { return assertTimestamp(value); } catch { fail(code); } }
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function enumeration(value, allowed, code) { if (!allowed.includes(value)) fail(code); return value; }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}
function sortedUnique(values, validator, minimum, maximum, code) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((entry) => validator(entry, code));
  if (new Set(values).size !== values.length || values.some((entry, index) => index > 0 && entry <= values[index - 1])) fail(code);
  return values;
}
function orderedUnique(values, validator, minimum, maximum, code) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) fail(code);
  values.forEach((entry) => validator(entry, code));
  if (new Set(values).size !== values.length) fail(code);
  return values;
}
function same(left, right) { return left.length === right.length && left.every((entry, index) => entry === right[index]); }

export const OPENCODE_OPERATION_FAMILIES = Object.freeze([
  'ADVISORY', 'ASK_REVIEWER', 'BACKGROUND', 'PRIVILEGED_LOCAL_MUTATION',
  'PRIVILEGED_SIDE_EFFECT', 'PUBLIC_MCP', 'REPOSITORY_WRITE'
]);
export const OPENCODE_DEPENDENCY_STATUSES = Object.freeze(['SATISFIED', 'MISSING', 'STALE', 'MISMATCH', 'NOT_IMPLEMENTED']);
export const OPENCODE_FIXTURE_GROUPS = Object.freeze([
  'approval-broker', 'background-lifecycle', 'hostile-data', 'identity-currentness',
  'instruction-package', 'native-permissions', 'preservation', 'public-mcp-facade',
  'receipt-ambiguity', 'workspace'
]);
export const OPENCODE_ELIGIBILITY_STATUSES = Object.freeze(['FULL', 'DEGRADED_REGISTERED', 'QUARANTINED', 'UNSUPPORTED']);

const BASE_DEPENDENCIES = Object.freeze(['HP-TC01', 'HP-TC02', 'HP-TC03', 'HP-TC04', 'HP-TC05', 'HP-TC06', 'HP-TC11']);
const EXTRA_DEPENDENCIES = Object.freeze({
  ADVISORY: [],
  PUBLIC_MCP: ['HP-TC09'],
  REPOSITORY_WRITE: ['HP-TC08', 'HP-TC12'],
  ASK_REVIEWER: ['HP-TC07', 'HP-TC09', 'HP-TC10', 'HP-TC12'],
  PRIVILEGED_SIDE_EFFECT: ['HP-TC07', 'HP-TC09', 'HP-TC10', 'HP-TC12'],
  PRIVILEGED_LOCAL_MUTATION: ['HP-TC07', 'HP-TC08', 'HP-TC09', 'HP-TC10', 'HP-TC12'],
  BACKGROUND: []
});
const DEPENDENCY_REASON = Object.freeze({
  SATISFIED: 'DEPENDENCY_SATISFIED', MISSING: 'DEPENDENCY_MISSING', STALE: 'DEPENDENCY_STALE',
  MISMATCH: 'DEPENDENCY_MISMATCH', NOT_IMPLEMENTED: 'DEPENDENCY_NOT_IMPLEMENTED'
});
const TERMINAL_STATES = new Set(['PASS', 'FAIL', 'NOT_RUN', 'CAPABILITY_UNAVAILABLE', 'HARNESS_ERROR', 'AMBIGUOUS']);
const IDENTITIES = Object.freeze({
  dependencyGate: ['kstack.opencode-conformance-dependency-gate.v1', 'KSTACK-OPENCODE-CONFORMANCE-DEPENDENCY-GATE-V1'],
  dependencyGateSet: ['kstack.opencode-conformance-dependency-gate-set.v1', 'KSTACK-OPENCODE-CONFORMANCE-DEPENDENCY-GATE-SET-V1'],
  plan: ['kstack.opencode-conformance-plan.v1', 'KSTACK-OPENCODE-CONFORMANCE-PLAN-V1'],
  fixture: ['kstack.opencode-conformance-fixture.v1', 'KSTACK-OPENCODE-CONFORMANCE-FIXTURE-V1'],
  fixtureSet: ['kstack.opencode-conformance-fixture-set.v1', 'KSTACK-OPENCODE-CONFORMANCE-FIXTURE-SET-V1'],
  execution: ['kstack.opencode-conformance-execution.v1', 'KSTACK-OPENCODE-CONFORMANCE-EXECUTION-V1'],
  observerReceipt: ['kstack.opencode-conformance-observer-receipt.v1', 'KSTACK-OPENCODE-CONFORMANCE-OBSERVER-RECEIPT-V1'],
  evidenceSet: ['kstack.opencode-conformance-evidence-set.v1', 'KSTACK-OPENCODE-CONFORMANCE-EVIDENCE-SET-V1'],
  status: ['kstack.opencode-operation-status.v1', 'KSTACK-OPENCODE-OPERATION-STATUS-V1']
});

function head(name) { return { schemaId: IDENTITIES[name][0], schemaVersion: 1 }; }
function address(name, value) { return hostAddress(IDENTITIES[name][1], value); }
function validateHead(value, name, code) {
  if (value.schemaId !== IDENTITIES[name][0] || value.schemaVersion !== 1) fail(code);
}

export function requiredOpenCodeDependencies(operationFamily) {
  enumeration(operationFamily, OPENCODE_OPERATION_FAMILIES, 'KSTACK_OPENCODE_OPERATION_FAMILY_INVALID');
  return Object.freeze([...new Set([...BASE_DEPENDENCIES, ...EXTRA_DEPENDENCIES[operationFamily]])].sort());
}

export function validateOpenCodeDependencyGate(value) {
  const code = 'KSTACK_OPENCODE_DEPENDENCY_GATE_INVALID';
  exact(value, [
    'schemaId', 'schemaVersion', 'hpItemId', 'requiredImplementationDigest',
    'requiredValidationReceiptDigest', 'activeSetMembershipProofDigest',
    'currentnessEvidenceDigest', 'status', 'reasonCode'
  ], code);
  validateHead(value, 'dependencyGate', code);
  if (!/^HP-TC(?:0[1-9]|1[0-2])$/u.test(value.hpItemId)) fail(code);
  for (const field of ['requiredImplementationDigest', 'requiredValidationReceiptDigest', 'activeSetMembershipProofDigest', 'currentnessEvidenceDigest']) digest(value[field], code);
  enumeration(value.status, OPENCODE_DEPENDENCY_STATUSES, code);
  registry(value.reasonCode, code);
  if (value.reasonCode !== DEPENDENCY_REASON[value.status]) fail(code);
  return immutable(value);
}

export function classifyOpenCodeDependencyGate(input) {
  const code = 'KSTACK_OPENCODE_DEPENDENCY_OBSERVATION_INVALID';
  exact(input, [
    'hpItemId', 'requiredImplementationDigest', 'requiredValidationReceiptDigest',
    'requiredActiveSetMembershipProofDigest', 'requiredCurrentnessEvidenceDigest',
    'observedImplementationDigest', 'observedValidationReceiptDigest',
    'observedActiveSetMembershipProofDigest', 'observedCurrentnessEvidenceDigest',
    'implemented', 'current'
  ], code);
  if (!/^HP-TC(?:0[1-9]|1[0-2])$/u.test(input.hpItemId)) fail(code);
  for (const field of ['requiredImplementationDigest', 'requiredValidationReceiptDigest', 'requiredActiveSetMembershipProofDigest', 'requiredCurrentnessEvidenceDigest']) digest(input[field], code);
  for (const field of ['observedImplementationDigest', 'observedValidationReceiptDigest', 'observedActiveSetMembershipProofDigest', 'observedCurrentnessEvidenceDigest']) {
    if (input[field] !== null) digest(input[field], code);
  }
  bool(input.implemented, code); bool(input.current, code);
  let status = 'SATISFIED';
  if (!input.implemented) status = 'NOT_IMPLEMENTED';
  else if (['observedImplementationDigest', 'observedValidationReceiptDigest', 'observedActiveSetMembershipProofDigest', 'observedCurrentnessEvidenceDigest'].some((field) => input[field] === null)) status = 'MISSING';
  else if (input.observedImplementationDigest !== input.requiredImplementationDigest
    || input.observedValidationReceiptDigest !== input.requiredValidationReceiptDigest
    || input.observedActiveSetMembershipProofDigest !== input.requiredActiveSetMembershipProofDigest
    || input.observedCurrentnessEvidenceDigest !== input.requiredCurrentnessEvidenceDigest) status = 'MISMATCH';
  else if (!input.current) status = 'STALE';
  return validateOpenCodeDependencyGate({
    ...head('dependencyGate'), hpItemId: input.hpItemId,
    requiredImplementationDigest: input.requiredImplementationDigest,
    requiredValidationReceiptDigest: input.requiredValidationReceiptDigest,
    activeSetMembershipProofDigest: input.requiredActiveSetMembershipProofDigest,
    currentnessEvidenceDigest: input.requiredCurrentnessEvidenceDigest,
    status, reasonCode: DEPENDENCY_REASON[status]
  });
}

export function evaluateOpenCodeDependencyGateSet(input) {
  const code = 'KSTACK_OPENCODE_DEPENDENCY_GATE_SET_INVALID';
  exact(input, ['operationProfileId', 'operationProfileDigest', 'operationFamily', 'rows', 'evaluatedAt', 'expiresAt'], code);
  ascii(input.operationProfileId, code);
  digest(input.operationProfileDigest, code);
  enumeration(input.operationFamily, OPENCODE_OPERATION_FAMILIES, code);
  timestamp(input.evaluatedAt, code); timestamp(input.expiresAt, code);
  if (input.evaluatedAt >= input.expiresAt || !Array.isArray(input.rows)) fail(code);
  const rows = input.rows.map(validateOpenCodeDependencyGate);
  const itemIds = rows.map((row) => row.hpItemId);
  if (!same(itemIds, [...itemIds].sort()) || new Set(itemIds).size !== itemIds.length) fail(code);
  const requiredItemIds = requiredOpenCodeDependencies(input.operationFamily);
  if (!same(itemIds, requiredItemIds)) fail('KSTACK_OPENCODE_DEPENDENCY_GATE_INCOMPLETE');
  const reasonCodes = rows.filter((row) => row.status !== 'SATISFIED').map((row) => row.reasonCode).filter((entry, index, all) => all.indexOf(entry) === index).sort();
  const gateSet = {
    ...head('dependencyGateSet'), operationProfileId: input.operationProfileId, operationProfileDigest: input.operationProfileDigest,
    operationFamily: input.operationFamily, rows, evaluatedAt: input.evaluatedAt,
    expiresAt: input.expiresAt, executable: reasonCodes.length === 0, reasonCodes
  };
  return immutable({ gateSet, gateSetDigest: address('dependencyGateSet', gateSet) });
}

export function validateOpenCodeDependencyGateSet(value) {
  const code = 'KSTACK_OPENCODE_DEPENDENCY_GATE_SET_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'operationProfileId', 'operationProfileDigest', 'operationFamily', 'rows', 'evaluatedAt', 'expiresAt', 'executable', 'reasonCodes'], code);
  validateHead(value, 'dependencyGateSet', code);
  const evaluated = evaluateOpenCodeDependencyGateSet({
    operationProfileId: value.operationProfileId, operationProfileDigest: value.operationProfileDigest, operationFamily: value.operationFamily,
    rows: value.rows, evaluatedAt: value.evaluatedAt, expiresAt: value.expiresAt
  }).gateSet;
  bool(value.executable, code); sortedUnique(value.reasonCodes, registry, 0, 5, code);
  if (value.executable !== evaluated.executable || !same(value.reasonCodes, evaluated.reasonCodes)) fail(code);
  return immutable(value);
}

const PLAN_FIELDS = Object.freeze([
  'schemaId', 'schemaVersion', 'hostId', 'runningHostBuildDigest', 'hostExecutableIdentityDigest',
  'adapterDigest', 'activeSetDigest', 'policyDigest', 'registrySetDigest', 'operationProfileDigest',
  'dependencyGateSetDigest', 'environmentMeasurementProfileDigest', 'harnessDigest',
  'observerSetDigest', 'fixtureSetDigest', 'bypassInventoryDigest', 'isolationTargetDigest',
  'sideEffectBudgetDigest', 'authoritativeClockDigest', 'plannedAt', 'expiresAt'
]);

export function sealOpenCodeConformancePlan(input, dependencyGateSetInput) {
  const code = 'KSTACK_OPENCODE_PLAN_INVALID';
  exact(input, PLAN_FIELDS.filter((field) => !['schemaId', 'schemaVersion'].includes(field)), code);
  if (input.hostId !== 'opencode') fail(code);
  for (const [field, value] of Object.entries(input)) if (field.endsWith('Digest')) digest(value, code);
  timestamp(input.plannedAt, code); timestamp(input.expiresAt, code);
  if (input.plannedAt >= input.expiresAt) fail('KSTACK_OPENCODE_PLAN_EXPIRED');
  const gateSet = validateOpenCodeDependencyGateSet(dependencyGateSetInput);
  if (!gateSet.executable) fail('KSTACK_OPENCODE_DEPENDENCIES_UNSATISFIED');
  if (address('dependencyGateSet', gateSet) !== input.dependencyGateSetDigest
    || gateSet.operationProfileDigest !== input.operationProfileDigest
    || gateSet.evaluatedAt > input.plannedAt || gateSet.expiresAt < input.expiresAt) fail(code);
  const plan = { ...head('plan'), ...input };
  return immutable({ plan, planDigest: address('plan', plan) });
}

export function validateOpenCodeConformancePlan(value) {
  const code = 'KSTACK_OPENCODE_PLAN_INVALID';
  exact(value, PLAN_FIELDS, code); validateHead(value, 'plan', code);
  if (value.hostId !== 'opencode') fail(code);
  for (const [field, entry] of Object.entries(value)) if (field.endsWith('Digest')) digest(entry, code);
  timestamp(value.plannedAt, code); timestamp(value.expiresAt, code);
  if (value.plannedAt >= value.expiresAt) fail('KSTACK_OPENCODE_PLAN_EXPIRED');
  return immutable(value);
}

export function validateOpenCodeFixture(value) {
  const code = 'KSTACK_OPENCODE_FIXTURE_INVALID';
  exact(value, [
    'schemaId', 'schemaVersion', 'fixtureId', 'fixtureGroupId', 'polarity', 'operationProfileDigest',
    'preconditionDigest', 'inputArtifactDigests', 'expectedNativeEventSequence',
    'expectedDecisionCode', 'observerExpectationDigests', 'maximumPermittedSideEffectsDigest',
    'deadlineMs', 'cleanupContractDigest', 'stableFailureCodes'
  ], code);
  validateHead(value, 'fixture', code); ascii(value.fixtureId, code);
  enumeration(value.fixtureGroupId, OPENCODE_FIXTURE_GROUPS, code);
  enumeration(value.polarity, ['NEGATIVE', 'POSITIVE'], code);
  digest(value.operationProfileDigest, code); digest(value.preconditionDigest, code);
  sortedUnique(value.inputArtifactDigests, digest, 1, 64, code);
  orderedUnique(value.expectedNativeEventSequence, registry, 1, 64, code);
  registry(value.expectedDecisionCode, code);
  sortedUnique(value.observerExpectationDigests, digest, 1, 64, code);
  digest(value.maximumPermittedSideEffectsDigest, code);
  if (!Number.isSafeInteger(value.deadlineMs) || value.deadlineMs < 1 || value.deadlineMs > 3_600_000) fail(code);
  digest(value.cleanupContractDigest, code);
  sortedUnique(value.stableFailureCodes, registry, 1, 64, code);
  return immutable(value);
}

export function sealOpenCodeFixtureSet(input) {
  const code = 'KSTACK_OPENCODE_FIXTURE_SET_INVALID';
  exact(input, ['operationProfileDigest', 'requiredGroupIds', 'fixtures'], code);
  digest(input.operationProfileDigest, code);
  sortedUnique(input.requiredGroupIds, (value) => enumeration(value, OPENCODE_FIXTURE_GROUPS, code), 1, OPENCODE_FIXTURE_GROUPS.length, code);
  if (!Array.isArray(input.fixtures) || input.fixtures.length < 1 || input.fixtures.length > 1024) fail(code);
  const fixtures = input.fixtures.map(validateOpenCodeFixture);
  const fixtureIds = fixtures.map((fixture) => fixture.fixtureId);
  if (!same(fixtureIds, [...fixtureIds].sort()) || new Set(fixtureIds).size !== fixtureIds.length) fail(code);
  if (fixtures.some((fixture) => fixture.operationProfileDigest !== input.operationProfileDigest || !input.requiredGroupIds.includes(fixture.fixtureGroupId))) fail(code);
  for (const groupId of input.requiredGroupIds) {
    const polarities = new Set(fixtures.filter((fixture) => fixture.fixtureGroupId === groupId).map((fixture) => fixture.polarity));
    if (!polarities.has('POSITIVE') || !polarities.has('NEGATIVE')) fail('KSTACK_OPENCODE_FIXTURE_COVERAGE_INCOMPLETE');
  }
  const fixtureSet = { ...head('fixtureSet'), operationProfileDigest: input.operationProfileDigest, requiredGroupIds: input.requiredGroupIds, fixtures };
  return immutable({ fixtureSet, fixtureSetDigest: address('fixtureSet', fixtureSet) });
}

export function validateOpenCodeFixtureSet(value) {
  const code = 'KSTACK_OPENCODE_FIXTURE_SET_INVALID';
  exact(value, ['schemaId', 'schemaVersion', 'operationProfileDigest', 'requiredGroupIds', 'fixtures'], code);
  validateHead(value, 'fixtureSet', code);
  return sealOpenCodeFixtureSet({ operationProfileDigest: value.operationProfileDigest, requiredGroupIds: value.requiredGroupIds, fixtures: value.fixtures }).fixtureSet;
}

export function advanceOpenCodeExecution(currentState, nextState, facts = {}) {
  try { return advanceFixtureExecution(currentState, nextState, facts); }
  catch { fail('KSTACK_OPENCODE_EXECUTION_TRANSITION_INVALID'); }
}

export function sealOpenCodeExecution(value) {
  const code = 'KSTACK_OPENCODE_EXECUTION_INVALID';
  exact(value, [
    'fixtureId', 'fixtureDigest', 'attemptId', 'state', 'planDigest', 'environmentStartDigest',
    'environmentEndDigest', 'currentnessMeasurementDigest', 'observerReceiptDigests',
    'startedAt', 'completedAt', 'cleanupEvidenceDigest', 'oraclePassed', 'observersAgree',
    'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed', 'actionBoundaryCrossed',
    'outcomeProven', 'failureCode'
  ], code);
  ascii(value.fixtureId, code); digest(value.fixtureDigest, code); ascii(value.attemptId, code);
  if (!TERMINAL_STATES.has(value.state)) fail(code);
  for (const field of ['planDigest', 'environmentStartDigest', 'environmentEndDigest', 'currentnessMeasurementDigest', 'cleanupEvidenceDigest']) digest(value[field], code);
  sortedUnique(value.observerReceiptDigests, digest, 1, 64, code);
  timestamp(value.startedAt, code); timestamp(value.completedAt, code);
  if (value.startedAt >= value.completedAt) fail(code);
  for (const field of ['oraclePassed', 'observersAgree', 'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed', 'actionBoundaryCrossed', 'outcomeProven']) bool(value[field], code);
  if (value.failureCode !== null) registry(value.failureCode, code);
  const pass = value.oraclePassed && value.observersAgree && !value.forbiddenSideEffects && value.limitsPassed
    && value.cleanupPassed && value.environmentStartDigest === value.environmentEndDigest;
  if (value.state === 'PASS' && (!pass || value.failureCode !== null)) fail('KSTACK_OPENCODE_EXECUTION_PASS_INVALID');
  if (value.state !== 'PASS' && value.failureCode === null) fail(code);
  if (value.actionBoundaryCrossed && !value.outcomeProven && value.state !== 'AMBIGUOUS') fail('KSTACK_OPENCODE_EXECUTION_AMBIGUOUS');
  const execution = { ...head('execution'), ...value };
  return immutable({ execution, executionDigest: address('execution', execution) });
}

export function validateOpenCodeExecution(value) {
  const code = 'KSTACK_OPENCODE_EXECUTION_INVALID';
  exact(value, ['schemaId', 'schemaVersion',
    'fixtureId', 'fixtureDigest', 'attemptId', 'state', 'planDigest', 'environmentStartDigest',
    'environmentEndDigest', 'currentnessMeasurementDigest', 'observerReceiptDigests',
    'startedAt', 'completedAt', 'cleanupEvidenceDigest', 'oraclePassed', 'observersAgree',
    'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed', 'actionBoundaryCrossed',
    'outcomeProven', 'failureCode'], code);
  validateHead(value, 'execution', code);
  return sealOpenCodeExecution(Object.fromEntries(Object.entries(value).filter(([key]) => !['schemaId', 'schemaVersion'].includes(key)))).execution;
}

export const OPENCODE_OBSERVER_KINDS = Object.freeze([
  'BROKER_SENTINEL', 'ENVIRONMENT_MEASUREMENT', 'FILESYSTEM_IDENTITY',
  'HOST_NATIVE_EVENTS', 'MCP_FRAME_COLLECTOR', 'PROCESS_LIFECYCLE',
  'PROTECTED_APPROVAL_DISPLAY', 'PROVIDER_RECEIPT', 'PRESERVATION_BASELINE'
]);

const ADVISORY_FIXTURE_STRATEGIES = Object.freeze({
  'approval-broker': Object.freeze({
    POSITIVE: ['ALLOW', ['HOST_VERSION_OBSERVED', 'BROKER_TICKET_VERIFIED', 'NATIVE_SKILL_ALLOWED']],
    NEGATIVE: ['DENY', ['HOST_VERSION_OBSERVED', 'BROKER_TICKET_REJECTED', 'PROTECTED_DENY']]
  }),
  'background-lifecycle': Object.freeze({
    POSITIVE: ['ALLOW', ['HOST_PROCESS_STARTED', 'HOST_PROCESS_EXITED', 'ZERO_ORPHANS_OBSERVED']],
    NEGATIVE: ['DENY', ['HOST_PROCESS_STARTED', 'DEADLINE_EXPIRED', 'HOST_PROCESS_CANCELLED', 'ZERO_ORPHANS_OBSERVED']]
  }),
  'hostile-data': Object.freeze({
    POSITIVE: ['ALLOW', ['NATIVE_SKILL_ALLOWED', 'STRUCTURED_OUTPUT_ACCEPTED']],
    NEGATIVE: ['DENY', ['NATIVE_SKILL_ALLOWED', 'HOSTILE_OUTPUT_REJECTED', 'PROTECTED_DENY']]
  }),
  'identity-currentness': Object.freeze({
    POSITIVE: ['ALLOW', ['HOST_VERSION_OBSERVED', 'CURRENTNESS_MATCHED']],
    NEGATIVE: ['DENY', ['HOST_VERSION_OBSERVED', 'CURRENTNESS_MISMATCHED', 'PROTECTED_DENY']]
  }),
  'instruction-package': Object.freeze({
    POSITIVE: ['ALLOW', ['NATIVE_SKILL_DISCOVERED', 'NATIVE_SKILL_ALLOWED']],
    NEGATIVE: ['DENY', ['DUPLICATE_SKILL_DISCOVERED', 'PROTECTED_DENY']]
  }),
  'native-permissions': Object.freeze({
    POSITIVE: ['ALLOW', ['NATIVE_SKILL_ALLOWED', 'NATIVE_PERMISSION_MATCHED']],
    NEGATIVE: ['DENY', ['NATIVE_TOOL_DENIED', 'NATIVE_PERMISSION_MATCHED', 'PROTECTED_DENY']]
  }),
  preservation: Object.freeze({
    POSITIVE: ['ALLOW', ['CODEX_BASELINE_MATCHED', 'CLAUDE_BASELINE_MATCHED', 'OPENCODE_BASELINE_MATCHED']],
    NEGATIVE: ['DENY', ['PRESERVATION_BASELINE_MISMATCHED', 'PROTECTED_DENY']]
  }),
  'public-mcp-facade': Object.freeze({
    POSITIVE: ['ALLOW', ['PUBLIC_MCP_LIST_OBSERVED', 'PUBLIC_MCP_READ_OBSERVED', 'NO_PROMOTION_OBSERVED']],
    NEGATIVE: ['DENY', ['PUBLIC_MCP_LEASE_REJECTED', 'NO_PROMOTION_OBSERVED', 'PROTECTED_DENY']]
  }),
  'receipt-ambiguity': Object.freeze({
    POSITIVE: ['ALLOW', ['PROVIDER_REQUEST_OBSERVED', 'PROVIDER_RECEIPT_MATCHED']],
    NEGATIVE: ['DENY', ['PROVIDER_RESPONSE_LOST', 'BLIND_RETRY_ABSENT', 'PROTECTED_DENY']]
  }),
  workspace: Object.freeze({
    POSITIVE: ['ALLOW', ['WORKSPACE_IDENTITY_MATCHED', 'REPOSITORY_UNCHANGED']],
    NEGATIVE: ['DENY', ['WORKSPACE_ALIAS_REJECTED', 'REPOSITORY_UNCHANGED', 'PROTECTED_DENY']]
  })
});

export function buildOpenCodeAdvisoryFixtureSet(operationProfileDigest) {
  digest(operationProfileDigest, 'KSTACK_OPENCODE_FIXTURE_SET_INVALID');
  const fixtures = OPENCODE_FIXTURE_GROUPS.flatMap((fixtureGroupId) => ['NEGATIVE', 'POSITIVE'].map((polarity) => {
    const [expectedDecisionCode, expectedNativeEventSequence] = ADVISORY_FIXTURE_STRATEGIES[fixtureGroupId][polarity];
    const fixtureId = `${fixtureGroupId}.${polarity.toLowerCase()}.v1`;
    return {
      ...head('fixture'), fixtureId, fixtureGroupId, polarity, operationProfileDigest,
      preconditionDigest: hostAddress('KSTACK-OPENCODE-ADVISORY-FIXTURE-PRECONDITION-V1', { fixtureGroupId, polarity }),
      inputArtifactDigests: [hostAddress('KSTACK-OPENCODE-ADVISORY-FIXTURE-INPUT-V1', { fixtureGroupId, polarity })],
      expectedNativeEventSequence, expectedDecisionCode,
      observerExpectationDigests: [hostAddress('KSTACK-OPENCODE-ADVISORY-OBSERVER-EXPECTATION-V1', { fixtureGroupId, polarity })],
      maximumPermittedSideEffectsDigest: hostAddress('KSTACK-OPENCODE-ADVISORY-SIDE-EFFECT-BUDGET-V1', { fixtureGroupId, polarity, productionTargets: 0, credentials: 0 }),
      deadlineMs: fixtureGroupId === 'background-lifecycle' ? 30_000 : 20_000,
      cleanupContractDigest: hostAddress('KSTACK-OPENCODE-ADVISORY-CLEANUP-V1', { fixtureGroupId, disposable: true, zeroOrphans: true }),
      stableFailureCodes: [`${fixtureGroupId.replace(/-/gu, '_').toUpperCase()}_${polarity}_FAILED`]
    };
  })).sort((left, right) => left.fixtureId < right.fixtureId ? -1 : left.fixtureId > right.fixtureId ? 1 : 0);
  return sealOpenCodeFixtureSet({ operationProfileDigest, requiredGroupIds: [...OPENCODE_FIXTURE_GROUPS], fixtures });
}

export function validateOpenCodeObserverReceipt(value) {
  const code = 'KSTACK_OPENCODE_OBSERVER_RECEIPT_INVALID';
  exact(value, [
    'schemaId', 'schemaVersion', 'fixtureId', 'observerId', 'observerKind',
    'observationDigest', 'observedAt', 'owner', 'subjectWritable', 'available', 'contradicted'
  ], code);
  validateHead(value, 'observerReceipt', code);
  ascii(value.fixtureId, code); ascii(value.observerId, code);
  enumeration(value.observerKind, OPENCODE_OBSERVER_KINDS, code);
  digest(value.observationDigest, code); timestamp(value.observedAt, code);
  if (value.owner !== 'PROTECTED_HARNESS') fail(code);
  bool(value.subjectWritable, code); bool(value.available, code); bool(value.contradicted, code);
  return immutable(value);
}

export function sealOpenCodeObserverReceipt(input) {
  const code = 'KSTACK_OPENCODE_OBSERVER_RECEIPT_INVALID';
  exact(input, [
    'fixtureId', 'observerId', 'observerKind', 'observationDigest', 'observedAt',
    'owner', 'subjectWritable', 'available', 'contradicted'
  ], code);
  const observerReceipt = validateOpenCodeObserverReceipt({ ...head('observerReceipt'), ...input });
  return immutable({ observerReceipt, observerReceiptDigest: address('observerReceipt', observerReceipt) });
}

export function adjudicateOpenCodeFixture(input) {
  const code = 'KSTACK_OPENCODE_FIXTURE_ADJUDICATION_INVALID';
  exact(input, [
    'fixture', 'plan', 'attemptId', 'observedDecisionCode', 'nativeEventSequence',
    'observerReceipts', 'environmentStartDigest', 'environmentEndDigest',
    'currentnessMeasurementDigest', 'startedAt', 'completedAt', 'cleanupEvidenceDigest',
    'forbiddenSideEffects', 'limitsPassed', 'cleanupPassed', 'actionBoundaryCrossed',
    'outcomeProven', 'failureCode'
  ], code);
  const fixture = validateOpenCodeFixture(input.fixture);
  const plan = validateOpenCodeConformancePlan(input.plan);
  ascii(input.attemptId, code); registry(input.observedDecisionCode, code);
  orderedUnique(input.nativeEventSequence, registry, 1, 64, code);
  if (!Array.isArray(input.observerReceipts) || input.observerReceipts.length < 1 || input.observerReceipts.length > 64) fail(code);
  const receipts = input.observerReceipts.map(validateOpenCodeObserverReceipt);
  const observerIds = receipts.map((receipt) => receipt.observerId);
  if (new Set(observerIds).size !== observerIds.length || receipts.some((receipt) => receipt.fixtureId !== fixture.fixtureId
    || receipt.observedAt < input.startedAt || receipt.observedAt > input.completedAt)) fail(code);
  const observersAgree = receipts.every((receipt) => receipt.available && !receipt.subjectWritable && !receipt.contradicted);
  const oraclePassed = input.observedDecisionCode === fixture.expectedDecisionCode
    && same(input.nativeEventSequence, fixture.expectedNativeEventSequence);
  const failureCode = oraclePassed && observersAgree && !input.forbiddenSideEffects
    && input.limitsPassed && input.cleanupPassed && input.environmentStartDigest === input.environmentEndDigest
    ? null : input.failureCode;
  if (failureCode === null && !(oraclePassed && observersAgree)) fail(code);
  if (failureCode !== null && !fixture.stableFailureCodes.includes(failureCode)) fail(code);
  return sealOpenCodeExecution({
    fixtureId: fixture.fixtureId, fixtureDigest: address('fixture', fixture), attemptId: input.attemptId,
    state: failureCode === null ? 'PASS' : input.actionBoundaryCrossed && !input.outcomeProven ? 'AMBIGUOUS' : 'FAIL',
    planDigest: address('plan', plan), environmentStartDigest: input.environmentStartDigest,
    environmentEndDigest: input.environmentEndDigest, currentnessMeasurementDigest: input.currentnessMeasurementDigest,
    observerReceiptDigests: receipts.map((receipt) => address('observerReceipt', receipt)).sort(),
    startedAt: input.startedAt, completedAt: input.completedAt, cleanupEvidenceDigest: input.cleanupEvidenceDigest,
    oraclePassed, observersAgree, forbiddenSideEffects: input.forbiddenSideEffects,
    limitsPassed: input.limitsPassed, cleanupPassed: input.cleanupPassed,
    actionBoundaryCrossed: input.actionBoundaryCrossed, outcomeProven: input.outcomeProven, failureCode
  });
}

export function sealOpenCodeEvidenceSet(input) {
  const code = 'KSTACK_OPENCODE_EVIDENCE_SET_INVALID';
  exact(input, [
    'plan', 'fixtureSet', 'executions', 'observerReceiptDigests', 'startMeasurementDigest',
    'endMeasurementDigest', 'currentnessMeasurementDigest', 'cleanupEvidenceDigest', 'expiresAt'
  ], code);
  const plan = validateOpenCodeConformancePlan(input.plan);
  const fixtureSet = validateOpenCodeFixtureSet(input.fixtureSet);
  if (address('fixtureSet', fixtureSet) !== plan.fixtureSetDigest || fixtureSet.operationProfileDigest !== plan.operationProfileDigest) fail(code);
  if (!Array.isArray(input.executions)) fail(code);
  const executions = input.executions.map(validateOpenCodeExecution);
  const expectedIds = fixtureSet.fixtures.map((fixture) => fixture.fixtureId);
  const actualIds = executions.map((execution) => execution.fixtureId).sort();
  if (!same(expectedIds, actualIds) || new Set(actualIds).size !== actualIds.length) fail('KSTACK_OPENCODE_EVIDENCE_MEMBERSHIP_INVALID');
  const fixtures = new Map(fixtureSet.fixtures.map((fixture) => [fixture.fixtureId, fixture]));
  const planDigest = address('plan', plan);
  for (const execution of executions) {
    const fixture = fixtures.get(execution.fixtureId);
    if (execution.fixtureDigest !== address('fixture', fixture) || execution.planDigest !== planDigest) fail(code);
  }
  sortedUnique(input.observerReceiptDigests, digest, 1, 1024, code);
  const observed = [...new Set(executions.flatMap((execution) => execution.observerReceiptDigests))].sort();
  if (!same(input.observerReceiptDigests, observed)) fail('KSTACK_OPENCODE_OBSERVER_MEMBERSHIP_INVALID');
  for (const field of ['startMeasurementDigest', 'endMeasurementDigest', 'currentnessMeasurementDigest', 'cleanupEvidenceDigest']) digest(input[field], code);
  if (input.startMeasurementDigest !== input.endMeasurementDigest
    || executions.some((execution) => execution.environmentStartDigest !== input.startMeasurementDigest
      || execution.environmentEndDigest !== input.endMeasurementDigest
      || execution.currentnessMeasurementDigest !== input.currentnessMeasurementDigest
      || execution.cleanupEvidenceDigest !== input.cleanupEvidenceDigest)) fail('KSTACK_OPENCODE_ENVIRONMENT_CHANGED');
  timestamp(input.expiresAt, code);
  if (input.expiresAt !== plan.expiresAt) fail('KSTACK_OPENCODE_EVIDENCE_EXPIRY_INVALID');
  const evidenceSet = {
    ...head('evidenceSet'), planDigest, fixtureSetDigest: address('fixtureSet', fixtureSet),
    executionDigests: executions.map((execution) => address('execution', execution)).sort(),
    fixtureIds: expectedIds, observerReceiptDigests: input.observerReceiptDigests,
    startMeasurementDigest: input.startMeasurementDigest, endMeasurementDigest: input.endMeasurementDigest,
    currentnessMeasurementDigest: input.currentnessMeasurementDigest, cleanupEvidenceDigest: input.cleanupEvidenceDigest,
    expiresAt: input.expiresAt, aggregate: executions.every((execution) => execution.state === 'PASS') ? 'PASS'
      : executions.some((execution) => execution.state === 'HARNESS_ERROR') ? 'HARNESS_ERROR'
        : executions.some((execution) => execution.state === 'AMBIGUOUS') ? 'AMBIGUOUS'
          : executions.some((execution) => execution.state === 'FAIL') ? 'FAIL' : 'INCOMPLETE'
  };
  return immutable({ evidenceSet, evidenceSetDigest: address('evidenceSet', evidenceSet) });
}

export function deriveOpenCodeOperationStatus(input) {
  const code = 'KSTACK_OPENCODE_STATUS_INVALID';
  exact(input, [
    'operationId', 'operationProfileId', 'profileClass', 'registeredAlternate', 'hostBuildDigest',
    'adapterDigest', 'platformDigest', 'activeSetDigest', 'policyDigest', 'evidenceSetDigest',
    'fixtureSetDigest', 'observerSetDigest', 'evaluatedAt', 'expiresAt', 'aggregate', 'revoked', 'drifted',
    'contradicted', 'missingRequirementIds', 'bypassIds'
  ], code);
  ascii(input.operationId, code); ascii(input.operationProfileId, code);
  enumeration(input.profileClass, ['FULL', 'ALTERNATE'], code); bool(input.registeredAlternate, code);
  for (const [field, value] of Object.entries(input)) if (field.endsWith('Digest')) digest(value, code);
  timestamp(input.evaluatedAt, code); timestamp(input.expiresAt, code);
  if (input.evaluatedAt >= input.expiresAt) fail('KSTACK_OPENCODE_STATUS_EXPIRED');
  enumeration(input.aggregate, ['PASS', 'FAIL', 'INCOMPLETE', 'AMBIGUOUS', 'HARNESS_ERROR'], code);
  for (const field of ['revoked', 'drifted', 'contradicted']) bool(input[field], code);
  sortedUnique(input.missingRequirementIds, (value) => {
    if (!/^HP-TC(?:0[1-9]|1[0-2])$/u.test(value)) fail(code);
  }, 0, 12, code);
  sortedUnique(input.bypassIds, ascii, 0, 1024, code);
  let status = 'UNSUPPORTED';
  if (input.revoked || input.drifted || input.contradicted) status = 'QUARANTINED';
  else if (input.aggregate === 'PASS' && input.missingRequirementIds.length === 0 && input.bypassIds.length === 0) {
    if (input.profileClass === 'FULL') status = 'FULL';
    else if (input.registeredAlternate) status = 'DEGRADED_REGISTERED';
  }
  const reasonCodes = [
    ...(input.revoked ? ['EVIDENCE_REVOKED'] : []), ...(input.drifted ? ['ENVIRONMENT_DRIFT'] : []),
    ...(input.contradicted ? ['EVIDENCE_CONTRADICTED'] : []),
    ...(input.aggregate !== 'PASS' ? [`CONFORMANCE_${input.aggregate}`] : []),
    ...(input.profileClass === 'ALTERNATE' && !input.registeredAlternate ? ['ALTERNATE_NOT_REGISTERED'] : []),
    ...(input.missingRequirementIds.length ? ['REQUIREMENTS_MISSING'] : []), ...(input.bypassIds.length ? ['BYPASS_UNCLOSED'] : [])
  ].filter((entry, index, all) => all.indexOf(entry) === index).sort();
  const operationStatus = { ...head('status'), hostId: 'opencode', maximumClaim: 'OPERATION_SCOPED_ONLY', ...input, status, reasonCodes };
  return immutable({ operationStatus, operationStatusDigest: address('status', operationStatus) });
}
