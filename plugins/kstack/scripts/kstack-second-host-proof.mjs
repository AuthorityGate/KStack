import crypto from 'node:crypto';

const HEX64 = /^[a-f0-9]{64}$/u;
const HP_ITEMS = Object.freeze(Array.from({ length: 12 }, (_, index) => `HP-TC${String(index + 1).padStart(2, '0')}`));
const HB_ITEMS = Object.freeze(Array.from({ length: 5 }, (_, index) => `HB-TC${String(index + 1).padStart(2, '0')}`));
const PORTS = Object.freeze([
  'bindHostInstance', 'bindRepositoryContext', 'discoverInstructionProjection',
  'observeNativeAction', 'requestNativeApprovalDisplay', 'routeProtectedBroker',
  'observeProcessLifecycle', 'observeStructuredOutput', 'observeCancellation'
]);
const SURFACES = Object.freeze([
  'instruction-discovery', 'extensions-tools', 'provider-credential-lifecycle',
  'subagents', 'mcp', 'permissions', 'roots', 'background-tasks',
  'cancellation', 'retry-idempotency', 'session-state', 'memory-context',
  'updates', 'output-receipts'
]);
const NEGATIVE_CASES = Object.freeze([
  'alternate-root-escape', 'background-orphan', 'cross-host-evidence-substitution',
  'direct-user-mcp-action', 'generic-host-branch', 'host-retry-duplication',
  'host-update-invalidation', 'native-event-observer-contradiction',
  'provider-credential-broker-bypass', 'recipe-authority-promotion',
  'semantic-field-projection-leak', 'subagent-inheritance-bypass',
  'shared-contract-preservation-regression'
]);
const STABILITY_STATUSES = Object.freeze([
  'SATISFIED', 'NOT_IMPLEMENTED', 'NOT_QUALIFIED', 'STALE', 'REGRESSED', 'OPEN_DEFECT'
]);
const OUTCOMES = Object.freeze([
  'ABSTRACTION_PROVEN_FOR_PROFILE', 'SECOND_HOST_PROFILE_UNSUPPORTED',
  'HOST_OVERLAP_REJECTED', 'FIRST_HOST_UNSTABLE', 'PROOF_INVALID'
]);

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

function compare(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}
function text(value, code, pattern = null) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value || (pattern && !pattern.test(value))) fail(code);
  return value;
}
function hash(value, code) { return text(value, code, HEX64); }
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function integer(value, code, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
  return value;
}
function instant(value, code) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) fail(code);
  return milliseconds;
}
function boundedWindow(observedAt, expiresAt, code) {
  const observed = instant(observedAt, code);
  const expires = instant(expiresAt, code);
  if (expires <= observed || expires - observed > 31 * 86_400_000) fail(code);
  return { observed, expires };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]));
  return value;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}
function exactRows(value, ids, idKey, validator, code) {
  if (!Array.isArray(value) || value.length !== ids.length) fail(code);
  return value.map((entry, index) => {
    if (entry?.[idKey] !== ids[index]) fail(code, `${idKey} order`);
    return validator(entry, code);
  });
}

function validateImplementationRow(input, code) {
  exact(input, ['itemId', 'implementationDigest', 'validationReceiptDigest', 'implemented', 'current'], code);
  return {
    itemId: text(input.itemId, code),
    implementationDigest: hash(input.implementationDigest, code),
    validationReceiptDigest: hash(input.validationReceiptDigest, code),
    implemented: bool(input.implemented, code),
    current: bool(input.current, code)
  };
}

function validateFirstHostRun(input, expectedKind, code) {
  exact(input, [
    'kind', 'hostId', 'buildDigest', 'configurationDigest', 'environmentDigest',
    'profileDigest', 'changeDigest', 'eligibility', 'conformanceReceiptDigest',
    'passed', 'observedAt'
  ], code);
  if (input.kind !== expectedKind || input.hostId !== 'opencode') fail(code, 'run identity');
  return {
    kind: input.kind, hostId: input.hostId,
    buildDigest: hash(input.buildDigest, code), configurationDigest: hash(input.configurationDigest, code),
    environmentDigest: hash(input.environmentDigest, code), profileDigest: hash(input.profileDigest, code),
    changeDigest: input.changeDigest === null ? null : hash(input.changeDigest, code),
    eligibility: text(input.eligibility, code), conformanceReceiptDigest: hash(input.conformanceReceiptDigest, code),
    passed: bool(input.passed, code), observedAt: input.observedAt
  };
}

export function validateFirstHostStabilityGate(input) {
  const code = 'KSTACK_SECOND_HOST_STABILITY_GATE_INVALID';
  exact(input, [
    'schemaVersion', 'gateId', 'profileDigest', 'hpImplementations', 'hbImplementations',
    'initialQualification', 'requalification', 'preservationEvidenceDigest',
    'preservationPassed', 'openDefectCodes', 'evaluatedAt', 'expiresAt'
  ], code);
  if (input.schemaVersion !== 1) fail(code, 'schemaVersion');
  const profileDigest = hash(input.profileDigest, code);
  const hpImplementations = exactRows(input.hpImplementations, HP_ITEMS, 'itemId', validateImplementationRow, code);
  const hbImplementations = exactRows(input.hbImplementations, HB_ITEMS, 'itemId', validateImplementationRow, code);
  const initialQualification = validateFirstHostRun(input.initialQualification, 'initial', code);
  const requalification = validateFirstHostRun(input.requalification, 'requalification', code);
  if (initialQualification.profileDigest !== profileDigest || requalification.profileDigest !== profileDigest) fail(code, 'profile binding');
  const initialAt = instant(initialQualification.observedAt, code);
  const requalifiedAt = instant(requalification.observedAt, code);
  if (requalifiedAt <= initialAt) fail(code, 'distinct later requalification');
  if (initialQualification.conformanceReceiptDigest === requalification.conformanceReceiptDigest) fail(code, 'reused conformance evidence');
  if (!Array.isArray(input.openDefectCodes)) fail(code);
  const openDefectCodes = input.openDefectCodes.map((entry) => text(entry, code, /^[A-Z][A-Z0-9_]{2,127}$/u));
  const sortedDefects = [...openDefectCodes].sort(compare);
  if (new Set(openDefectCodes).size !== openDefectCodes.length || openDefectCodes.some((entry, index) => entry !== sortedDefects[index])) fail(code, 'defect inventory');
  boundedWindow(input.evaluatedAt, input.expiresAt, code);
  return immutable({
    schemaVersion: 1, gateId: text(input.gateId, code), profileDigest,
    hpImplementations, hbImplementations, initialQualification, requalification,
    preservationEvidenceDigest: hash(input.preservationEvidenceDigest, code),
    preservationPassed: bool(input.preservationPassed, code), openDefectCodes,
    evaluatedAt: input.evaluatedAt, expiresAt: input.expiresAt
  });
}

export function evaluateFirstHostStabilityGate(input, nowInput) {
  const record = validateFirstHostStabilityGate(input);
  const now = instant(nowInput, 'KSTACK_SECOND_HOST_STABILITY_GATE_TIME_INVALID');
  let status = 'SATISFIED';
  const implementations = [...record.hpImplementations, ...record.hbImplementations];
  if (implementations.some((entry) => !entry.implemented)) status = 'NOT_IMPLEMENTED';
  else if (!record.initialQualification.passed || !record.requalification.passed
    || record.initialQualification.eligibility !== 'ELIGIBLE'
    || record.requalification.eligibility !== 'ELIGIBLE') status = 'NOT_QUALIFIED';
  else if (now < Date.parse(record.evaluatedAt) || now >= Date.parse(record.expiresAt)) status = 'STALE';
  else if (implementations.some((entry) => !entry.current) || !record.preservationPassed) status = 'REGRESSED';
  else if (record.openDefectCodes.length > 0) status = 'OPEN_DEFECT';
  return immutable({ status, gateId: record.gateId, evidenceDigest: digest(record), profileDigest: record.profileDigest });
}

function validateObjective(input) {
  const code = 'KSTACK_SECOND_HOST_OBJECTIVE_INVALID';
  exact(input, [
    'hostId', 'objectiveDigest', 'decisionDigest', 'primarySourceLedgerDigest',
    'reuseDispositionDigest', 'ownerClarificationDigest', 'codexClosureDigest',
    'selectedProfileDigest', 'status'
  ], code);
  if (input.hostId !== 'goose' || !['APPROVED', 'HOST_OVERLAP_REJECTED'].includes(input.status)) fail(code);
  return {
    hostId: input.hostId, objectiveDigest: hash(input.objectiveDigest, code),
    decisionDigest: hash(input.decisionDigest, code), primarySourceLedgerDigest: hash(input.primarySourceLedgerDigest, code),
    reuseDispositionDigest: hash(input.reuseDispositionDigest, code), ownerClarificationDigest: hash(input.ownerClarificationDigest, code),
    codexClosureDigest: hash(input.codexClosureDigest, code), selectedProfileDigest: hash(input.selectedProfileDigest, code),
    status: input.status
  };
}

function validateSharedBoundary(input) {
  const code = 'KSTACK_SECOND_HOST_SHARED_BOUNDARY_INVALID';
  exact(input, [
    'contractDigest', 'schemaRegistryDigest', 'genericSourceDigest', 'ports',
    'genericSourceHostBranchScanPassed', 'genericSourceHostBranchScanReceiptDigest',
    'forbiddenFieldScanPassed', 'forbiddenFieldScanReceiptDigest'
  ], code);
  const ports = exactRows(input.ports, PORTS, 'portId', (entry, rowCode) => {
    exact(entry, ['portId', 'requestSchemaDigest', 'resultSchemaDigest'], rowCode);
    return { portId: entry.portId, requestSchemaDigest: hash(entry.requestSchemaDigest, rowCode), resultSchemaDigest: hash(entry.resultSchemaDigest, rowCode) };
  }, code);
  return {
    contractDigest: hash(input.contractDigest, code), schemaRegistryDigest: hash(input.schemaRegistryDigest, code),
    genericSourceDigest: hash(input.genericSourceDigest, code), ports,
    genericSourceHostBranchScanPassed: bool(input.genericSourceHostBranchScanPassed, code),
    genericSourceHostBranchScanReceiptDigest: hash(input.genericSourceHostBranchScanReceiptDigest, code),
    forbiddenFieldScanPassed: bool(input.forbiddenFieldScanPassed, code),
    forbiddenFieldScanReceiptDigest: hash(input.forbiddenFieldScanReceiptDigest, code)
  };
}

function validateAdapter(input, expectedHost) {
  const code = 'KSTACK_SECOND_HOST_ADAPTER_INVALID';
  exact(input, [
    'hostId', 'buildDigest', 'adapterDigest', 'portImplementations',
    'nativeEventSchemaDigest', 'projectionPlanDigest', 'bypassInventoryDigest',
    'environmentProfileDigest', 'fixtureMappingDigest', 'authorityScanPassed',
    'authorityScanReceiptDigest'
  ], code);
  if (input.hostId !== expectedHost) fail(code, 'host order');
  const portImplementations = exactRows(input.portImplementations, PORTS, 'portId', (entry, rowCode) => {
    exact(entry, ['portId', 'implementationDigest'], rowCode);
    return { portId: entry.portId, implementationDigest: hash(entry.implementationDigest, rowCode) };
  }, code);
  if (new Set(portImplementations.map((entry) => entry.implementationDigest)).size !== PORTS.length) fail(code, 'port implementation identity reuse');
  return {
    hostId: input.hostId, buildDigest: hash(input.buildDigest, code), adapterDigest: hash(input.adapterDigest, code),
    portImplementations, nativeEventSchemaDigest: hash(input.nativeEventSchemaDigest, code),
    projectionPlanDigest: hash(input.projectionPlanDigest, code), bypassInventoryDigest: hash(input.bypassInventoryDigest, code),
    environmentProfileDigest: hash(input.environmentProfileDigest, code), fixtureMappingDigest: hash(input.fixtureMappingDigest, code),
    authorityScanPassed: bool(input.authorityScanPassed, code),
    authorityScanReceiptDigest: hash(input.authorityScanReceiptDigest, code)
  };
}

function validateDifferenceMatrix(input) {
  const code = 'KSTACK_SECOND_HOST_DIFFERENCE_MATRIX_INVALID';
  return exactRows(input, SURFACES, 'surfaceId', (entry, rowCode) => {
    exact(entry, [
      'surfaceId', 'opencodeBehaviorDigest', 'gooseBehaviorDigest', 'commonRequirementDigest',
      'hostSpecificAdaptationDigest', 'kstackOwner', 'hostOwner', 'overlapOutcome',
      'noBypassEvidenceDigest', 'testObligationsDigest'
    ], rowCode);
    if (!['KSTACK_OWNS', 'HOST_OWNS_UNDER_BOUNDARY', 'REJECT'].includes(entry.overlapOutcome)) fail(rowCode, 'overlapOutcome');
    if (entry.overlapOutcome === 'HOST_OWNS_UNDER_BOUNDARY' && entry.noBypassEvidenceDigest === null) fail(rowCode, 'host ownership evidence');
    if (entry.overlapOutcome === 'REJECT' && entry.hostSpecificAdaptationDigest !== null) fail(rowCode, 'rejected adaptation');
    return {
      surfaceId: entry.surfaceId, opencodeBehaviorDigest: hash(entry.opencodeBehaviorDigest, rowCode),
      gooseBehaviorDigest: hash(entry.gooseBehaviorDigest, rowCode), commonRequirementDigest: hash(entry.commonRequirementDigest, rowCode),
      hostSpecificAdaptationDigest: entry.hostSpecificAdaptationDigest === null ? null : hash(entry.hostSpecificAdaptationDigest, rowCode),
      kstackOwner: text(entry.kstackOwner, rowCode), hostOwner: text(entry.hostOwner, rowCode), overlapOutcome: entry.overlapOutcome,
      noBypassEvidenceDigest: entry.noBypassEvidenceDigest === null ? null : hash(entry.noBypassEvidenceDigest, rowCode),
      testObligationsDigest: hash(entry.testObligationsDigest, rowCode)
    };
  }, code);
}

function validateExecution(input, expectedHost, code) {
  exact(input, [
    'hostId', 'profileDigest', 'fixtureSetDigest', 'fixtureCount', 'passedFixtureCount',
    'subjectProcessDigest', 'disposableRootDigest', 'observerDigest', 'evidenceSetDigest',
    'receiptSetDigest', 'eligibility', 'kernelRequestSetDigest', 'kernelResultSetDigest',
    'normalizedTraceDigest', 'observedAt', 'expiresAt'
  ], code);
  if (input.hostId !== expectedHost) fail(code, 'host order');
  boundedWindow(input.observedAt, input.expiresAt, code);
  return {
    hostId: input.hostId, profileDigest: hash(input.profileDigest, code), fixtureSetDigest: hash(input.fixtureSetDigest, code),
    fixtureCount: integer(input.fixtureCount, code, 1, 1_000_000),
    passedFixtureCount: integer(input.passedFixtureCount, code, 0, 1_000_000),
    subjectProcessDigest: hash(input.subjectProcessDigest, code), disposableRootDigest: hash(input.disposableRootDigest, code),
    observerDigest: hash(input.observerDigest, code), evidenceSetDigest: hash(input.evidenceSetDigest, code),
    receiptSetDigest: hash(input.receiptSetDigest, code), eligibility: text(input.eligibility, code),
    kernelRequestSetDigest: hash(input.kernelRequestSetDigest, code), kernelResultSetDigest: hash(input.kernelResultSetDigest, code),
    normalizedTraceDigest: hash(input.normalizedTraceDigest, code), observedAt: input.observedAt, expiresAt: input.expiresAt
  };
}

function validatePreservation(input) {
  const code = 'KSTACK_SECOND_HOST_PRESERVATION_INVALID';
  exact(input, ['opencode', 'goose'], code);
  return Object.fromEntries(['opencode', 'goose'].map((hostId) => {
    const row = input[hostId];
    exact(row, ['baselineDigest', 'resultDigest', 'passed'], code);
    return [hostId, { baselineDigest: hash(row.baselineDigest, code), resultDigest: hash(row.resultDigest, code), passed: bool(row.passed, code) }];
  }));
}

function validateNegativeCoverage(input) {
  const code = 'KSTACK_SECOND_HOST_NEGATIVE_COVERAGE_INVALID';
  return exactRows(input, NEGATIVE_CASES, 'caseId', (entry, rowCode) => {
    exact(entry, ['caseId', 'passed', 'evidenceDigest'], rowCode);
    return { caseId: entry.caseId, passed: bool(entry.passed, rowCode), evidenceDigest: hash(entry.evidenceDigest, rowCode) };
  }, code);
}

export function validateSecondHostAbstractionProof(input) {
  const code = 'KSTACK_SECOND_HOST_PROOF_INVALID';
  exact(input, [
    'schemaVersion', 'proofId', 'profileId', 'profileDigest', 'stabilityGate',
    'secondHostObjective', 'sharedBoundary', 'adapters', 'differenceMatrix',
    'executions', 'preservation', 'negativeCoverage', 'observedAt', 'expiresAt'
  ], code);
  if (input.schemaVersion !== 1) fail(code, 'schemaVersion');
  const profileDigest = hash(input.profileDigest, code);
  const stabilityGate = validateFirstHostStabilityGate(input.stabilityGate);
  const secondHostObjective = validateObjective(input.secondHostObjective);
  if (stabilityGate.profileDigest !== profileDigest || secondHostObjective.selectedProfileDigest !== profileDigest) fail(code, 'profile binding');
  const sharedBoundary = validateSharedBoundary(input.sharedBoundary);
  if (!Array.isArray(input.adapters) || input.adapters.length !== 2) fail(code, 'adapters');
  const adapters = [validateAdapter(input.adapters[0], 'opencode'), validateAdapter(input.adapters[1], 'goose')];
  if (!Array.isArray(input.executions) || input.executions.length !== 2) fail(code, 'executions');
  const executions = [
    validateExecution(input.executions[0], 'opencode', code),
    validateExecution(input.executions[1], 'goose', code)
  ];
  if (executions.some((entry) => entry.profileDigest !== profileDigest)) fail(code, 'execution profile binding');
  const differenceMatrix = validateDifferenceMatrix(input.differenceMatrix);
  const preservation = validatePreservation(input.preservation);
  const negativeCoverage = validateNegativeCoverage(input.negativeCoverage);
  boundedWindow(input.observedAt, input.expiresAt, code);
  return immutable({
    schemaVersion: 1, proofId: text(input.proofId, code), profileId: text(input.profileId, code), profileDigest,
    stabilityGate, secondHostObjective, sharedBoundary, adapters, differenceMatrix, executions,
    preservation, negativeCoverage, observedAt: input.observedAt, expiresAt: input.expiresAt
  });
}

export function evaluateSecondHostAbstractionProof(input, nowInput) {
  const record = validateSecondHostAbstractionProof(input);
  const now = instant(nowInput, 'KSTACK_SECOND_HOST_PROOF_TIME_INVALID');
  const stability = evaluateFirstHostStabilityGate(record.stabilityGate, nowInput);
  let outcome = 'ABSTRACTION_PROVEN_FOR_PROFILE';
  const reasons = new Set();
  if (stability.status !== 'SATISFIED') {
    outcome = 'FIRST_HOST_UNSTABLE';
    reasons.add(`KSTACK_SECOND_HOST_${stability.status}`);
  } else if (record.secondHostObjective.status === 'HOST_OVERLAP_REJECTED'
    || record.differenceMatrix.some((row) => row.overlapOutcome === 'REJECT')) {
    outcome = 'HOST_OVERLAP_REJECTED';
    reasons.add('KSTACK_SECOND_HOST_OWNERSHIP_OVERLAP');
  } else {
    const [opencode, goose] = record.executions;
    const distinctExecutionFields = ['subjectProcessDigest', 'disposableRootDigest', 'observerDigest', 'evidenceSetDigest', 'receiptSetDigest'];
    if (now < Date.parse(record.observedAt) || now >= Date.parse(record.expiresAt)
      || opencode.expiresAt <= nowInput || goose.expiresAt <= nowInput) reasons.add('KSTACK_SECOND_HOST_EVIDENCE_STALE');
    if (!record.sharedBoundary.genericSourceHostBranchScanPassed || !record.sharedBoundary.forbiddenFieldScanPassed
      || record.adapters.some((adapter) => !adapter.authorityScanPassed)) reasons.add('KSTACK_SECOND_HOST_BOUNDARY_SCAN_FAILED');
    const materialDifferences = record.differenceMatrix.filter((row) => row.opencodeBehaviorDigest !== row.gooseBehaviorDigest
      && row.hostSpecificAdaptationDigest !== null).length;
    if (materialDifferences < 3) reasons.add('KSTACK_SECOND_HOST_NOT_MATERIALLY_DIFFERENT');
    if (opencode.fixtureCount !== goose.fixtureCount
      || opencode.kernelRequestSetDigest !== goose.kernelRequestSetDigest
      || opencode.kernelResultSetDigest !== goose.kernelResultSetDigest
      || opencode.normalizedTraceDigest !== goose.normalizedTraceDigest) reasons.add('KSTACK_SECOND_HOST_SEMANTIC_MISMATCH');
    if (opencode.fixtureSetDigest === goose.fixtureSetDigest) reasons.add('KSTACK_SECOND_HOST_EVIDENCE_REUSED');
    if (distinctExecutionFields.some((field) => opencode[field] === goose[field])) reasons.add('KSTACK_SECOND_HOST_EVIDENCE_REUSED');
    if (record.adapters[0].adapterDigest === record.adapters[1].adapterDigest
      || record.adapters[0].buildDigest === record.adapters[1].buildDigest) reasons.add('KSTACK_SECOND_HOST_ADAPTER_NOT_DISTINCT');
    if (record.adapters[0].fixtureMappingDigest !== opencode.fixtureSetDigest
      || record.adapters[1].fixtureMappingDigest !== goose.fixtureSetDigest) reasons.add('KSTACK_SECOND_HOST_FIXTURE_MAPPING_MISMATCH');
    if (Object.values(record.preservation).some((row) => !row.passed)
      || record.negativeCoverage.some((row) => !row.passed)) reasons.add('KSTACK_SECOND_HOST_PRESERVATION_FAILED');
    const unsupported = [opencode, goose].some((execution) => execution.eligibility !== 'ELIGIBLE'
      || execution.passedFixtureCount !== execution.fixtureCount);
    if (reasons.size > 0) outcome = 'PROOF_INVALID';
    else if (unsupported) outcome = 'SECOND_HOST_PROFILE_UNSUPPORTED';
  }
  const reasonCodes = [...reasons].sort(compare);
  return immutable({
    outcome, proofId: record.proofId, profileId: record.profileId, profileDigest: record.profileDigest,
    evidenceDigest: digest(record), reasonCodes,
    provenHosts: outcome === 'ABSTRACTION_PROVEN_FOR_PROFILE' ? ['opencode', 'goose'] : []
  });
}

export const SECOND_HOST_PROOF_CONSTANTS = Object.freeze({
  hpItems: HP_ITEMS, hbItems: HB_ITEMS, ports: PORTS, surfaces: SURFACES,
  negativeCases: NEGATIVE_CASES, stabilityStatuses: STABILITY_STATUSES, outcomes: OUTCOMES
});
