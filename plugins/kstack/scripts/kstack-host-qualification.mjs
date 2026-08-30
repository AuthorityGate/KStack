import crypto from 'node:crypto';

const HOSTS = Object.freeze(['hermes', 'openclaw']);
const MODES = Object.freeze(['native-analysis', 'delegated-plan', 'delegated-build']);
const SEVERITIES = Object.freeze(['low', 'moderate', 'high', 'critical']);
const SANDBOX_ENFORCEMENT = Object.freeze(['none', 'host', 'external']);
const DELEGATION_CONTROL = Object.freeze(['denied', 'host-config', 'external-launcher']);
const OPERATIONS = Object.freeze(['inspect-file', 'search-text', 'edit-file', 'create-file', 'run-test', 'delegate-session']);
const HEX40 = /^[a-f0-9]{40}$/u;
const HEX64 = /^[a-f0-9]{64}$/u;
const REASON_CODE = /^[A-Z][A-Z0-9_]{2,127}$/u;

function fail(code, detail = '') {
  const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code;
  throw error;
}

function exactKeys(value, expected, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}

function text(value, code) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) fail(code);
  return value;
}

function enumeration(value, allowed, code) {
  if (!allowed.includes(value)) fail(code, String(value));
  return value;
}

function hash(value, expression, code) {
  if (typeof value !== 'string' || !expression.test(value)) fail(code);
  return value;
}

function boolean(value, code) {
  if (typeof value !== 'boolean') fail(code);
  return value;
}

function integer(value, code, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) fail(code);
  return value;
}

function instant(value, code) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) fail(code);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) fail(code);
  return milliseconds;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function operationSet(value, code) {
  if (!Array.isArray(value) || value.length === 0) fail(code);
  const unique = new Set();
  for (const operation of value) {
    enumeration(operation, OPERATIONS, code);
    if (unique.has(operation)) fail(code, `duplicate ${operation}`);
    unique.add(operation);
  }
  return [...unique].sort();
}

function capabilitiesForOperations(operations) {
  const capabilities = new Set();
  for (const operation of operations) {
    if (operation === 'inspect-file') capabilities.add('file-read');
    if (operation === 'search-text') capabilities.add('text-search');
    if (operation === 'edit-file' || operation === 'create-file') capabilities.add('file-edit');
    if (operation === 'run-test') capabilities.add('shell');
    if (operation === 'delegate-session') capabilities.add('delegation');
  }
  return [...capabilities].sort();
}

function validateFinding(input) {
  exactKeys(input, ['code', 'severity', 'evidenceDigest'], 'KSTACK_HOST_QUALIFICATION_FINDING_INVALID');
  return {
    code: text(input.code, 'KSTACK_HOST_QUALIFICATION_FINDING_INVALID'),
    severity: enumeration(input.severity, SEVERITIES, 'KSTACK_HOST_QUALIFICATION_FINDING_INVALID'),
    evidenceDigest: hash(input.evidenceDigest, HEX64, 'KSTACK_HOST_QUALIFICATION_FINDING_INVALID')
  };
}

export function validateHostQualification(input) {
  exactKeys(input, [
    'schemaVersion', 'qualificationId', 'hostId', 'version', 'executionMode', 'platform',
    'source', 'runtime', 'supplyChain', 'isolation', 'functional', 'constraints',
    'admissionBlocked', 'terminalOutcome', 'reasonCodes', 'observedAt', 'expiresAt'
  ], 'KSTACK_HOST_QUALIFICATION_INVALID');
  if (input.schemaVersion !== 1) fail('KSTACK_HOST_QUALIFICATION_INVALID', 'schemaVersion');
  const qualificationId = text(input.qualificationId, 'KSTACK_HOST_QUALIFICATION_INVALID');
  const hostId = enumeration(input.hostId, HOSTS, 'KSTACK_HOST_QUALIFICATION_INVALID');
  const version = text(input.version, 'KSTACK_HOST_QUALIFICATION_INVALID');
  const executionMode = enumeration(input.executionMode, MODES, 'KSTACK_HOST_QUALIFICATION_INVALID');
  const platform = text(input.platform, 'KSTACK_HOST_QUALIFICATION_INVALID');

  exactKeys(input.source, [
    'repository', 'tag', 'tagObjectSha', 'commitSha', 'tagVerified',
    'tagVerificationReason', 'lockfileSha256', 'manifestSha256', 'findings'
  ], 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID');
  if (!Array.isArray(input.source.findings)) fail('KSTACK_HOST_QUALIFICATION_SOURCE_INVALID');
  const findings = input.source.findings.map(validateFinding);
  if (new Set(findings.map((finding) => finding.code)).size !== findings.length) {
    fail('KSTACK_HOST_QUALIFICATION_SOURCE_INVALID', 'duplicate finding');
  }
  const source = {
    repository: text(input.source.repository, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    tag: text(input.source.tag, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    tagObjectSha: hash(input.source.tagObjectSha, HEX40, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    commitSha: hash(input.source.commitSha, HEX40, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    tagVerified: boolean(input.source.tagVerified, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    tagVerificationReason: text(input.source.tagVerificationReason, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    lockfileSha256: hash(input.source.lockfileSha256, HEX64, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    manifestSha256: hash(input.source.manifestSha256, HEX64, 'KSTACK_HOST_QUALIFICATION_SOURCE_INVALID'),
    findings
  };

  exactKeys(input.runtime, ['kind', 'version', 'archiveSha256', 'engineSatisfied'], 'KSTACK_HOST_QUALIFICATION_RUNTIME_INVALID');
  const runtime = {
    kind: enumeration(input.runtime.kind, ['python', 'node'], 'KSTACK_HOST_QUALIFICATION_RUNTIME_INVALID'),
    version: text(input.runtime.version, 'KSTACK_HOST_QUALIFICATION_RUNTIME_INVALID'),
    archiveSha256: input.runtime.archiveSha256 === null
      ? null
      : hash(input.runtime.archiveSha256, HEX64, 'KSTACK_HOST_QUALIFICATION_RUNTIME_INVALID'),
    engineSatisfied: boolean(input.runtime.engineSatisfied, 'KSTACK_HOST_QUALIFICATION_RUNTIME_INVALID')
  };

  exactKeys(input.supplyChain, ['lockfileFrozen', 'lifecycleScriptsDisabled', 'advisoryAssessment', 'advisories'], 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID');
  exactKeys(input.supplyChain.advisoryAssessment, ['status', 'evidenceDigest'], 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID');
  const advisoryAssessment = {
    status: enumeration(input.supplyChain.advisoryAssessment.status, ['MEASURED', 'NOT_PERFORMED'], 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID'),
    evidenceDigest: input.supplyChain.advisoryAssessment.evidenceDigest === null ? null
      : hash(input.supplyChain.advisoryAssessment.evidenceDigest, HEX64, 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID')
  };
  exactKeys(input.supplyChain.advisories, ['critical', 'high', 'moderate', 'low'], 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID');
  const advisories = Object.fromEntries(['critical', 'high', 'moderate', 'low'].map((severity) => [
    severity, input.supplyChain.advisories[severity] === null ? null
      : integer(input.supplyChain.advisories[severity], 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID', 100_000)
  ]));
  if (advisoryAssessment.status === 'MEASURED'
      ? advisoryAssessment.evidenceDigest === null || Object.values(advisories).some((value) => value === null)
      : advisoryAssessment.evidenceDigest !== null || Object.values(advisories).some((value) => value !== null)) {
    fail('KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID');
  }
  const supplyChain = {
    lockfileFrozen: boolean(input.supplyChain.lockfileFrozen, 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID'),
    lifecycleScriptsDisabled: boolean(input.supplyChain.lifecycleScriptsDisabled, 'KSTACK_HOST_QUALIFICATION_SUPPLY_CHAIN_INVALID'),
    advisoryAssessment, advisories
  };

  exactKeys(input.isolation, ['installRootDigest', 'systemMutation', 'credentialUse', 'networkUse'], 'KSTACK_HOST_QUALIFICATION_ISOLATION_INVALID');
  const isolation = {
    installRootDigest: hash(input.isolation.installRootDigest, HEX64, 'KSTACK_HOST_QUALIFICATION_ISOLATION_INVALID'),
    systemMutation: boolean(input.isolation.systemMutation, 'KSTACK_HOST_QUALIFICATION_ISOLATION_INVALID'),
    credentialUse: boolean(input.isolation.credentialUse, 'KSTACK_HOST_QUALIFICATION_ISOLATION_INVALID'),
    networkUse: enumeration(input.isolation.networkUse, ['none', 'source-only', 'runtime'], 'KSTACK_HOST_QUALIFICATION_ISOLATION_INVALID')
  };

  exactKeys(input.functional, ['syntaxPassed', 'sourceGuardsPassed', 'testsPassed', 'testsRun'], 'KSTACK_HOST_QUALIFICATION_FUNCTIONAL_INVALID');
  const functional = {
    syntaxPassed: boolean(input.functional.syntaxPassed, 'KSTACK_HOST_QUALIFICATION_FUNCTIONAL_INVALID'),
    sourceGuardsPassed: boolean(input.functional.sourceGuardsPassed, 'KSTACK_HOST_QUALIFICATION_FUNCTIONAL_INVALID'),
    testsPassed: boolean(input.functional.testsPassed, 'KSTACK_HOST_QUALIFICATION_FUNCTIONAL_INVALID'),
    testsRun: integer(input.functional.testsRun, 'KSTACK_HOST_QUALIFICATION_FUNCTIONAL_INVALID', 10_000_000)
  };

  exactKeys(input.constraints, [
    'sandboxEnforcement', 'delegationControl', 'maximumWallClockMs',
    'allowedOperations', 'protectedValueAccess'
  ], 'KSTACK_HOST_QUALIFICATION_CONSTRAINT_INVALID');
  const constraints = {
    sandboxEnforcement: enumeration(input.constraints.sandboxEnforcement, SANDBOX_ENFORCEMENT, 'KSTACK_HOST_QUALIFICATION_CONSTRAINT_INVALID'),
    delegationControl: enumeration(input.constraints.delegationControl, DELEGATION_CONTROL, 'KSTACK_HOST_QUALIFICATION_CONSTRAINT_INVALID'),
    maximumWallClockMs: integer(input.constraints.maximumWallClockMs, 'KSTACK_HOST_QUALIFICATION_CONSTRAINT_INVALID', 86_400_000),
    allowedOperations: operationSet(input.constraints.allowedOperations, 'KSTACK_HOST_QUALIFICATION_CONSTRAINT_INVALID'),
    protectedValueAccess: boolean(input.constraints.protectedValueAccess, 'KSTACK_HOST_QUALIFICATION_CONSTRAINT_INVALID')
  };
  const observedAt = instant(input.observedAt, 'KSTACK_HOST_QUALIFICATION_TIME_INVALID');
  const expiresAt = instant(input.expiresAt, 'KSTACK_HOST_QUALIFICATION_TIME_INVALID');
  if (expiresAt <= observedAt || expiresAt - observedAt > 31 * 86_400_000) fail('KSTACK_HOST_QUALIFICATION_TIME_INVALID');
  const admissionBlocked = boolean(input.admissionBlocked, 'KSTACK_HOST_QUALIFICATION_INVALID');
  const terminalOutcome = enumeration(input.terminalOutcome, ['ADMISSION_BLOCKED', 'ELIGIBLE_FOR_ADMISSION'], 'KSTACK_HOST_QUALIFICATION_INVALID');
  if (admissionBlocked !== (terminalOutcome === 'ADMISSION_BLOCKED') || !Array.isArray(input.reasonCodes)) fail('KSTACK_HOST_QUALIFICATION_INVALID');
  const reasonCodes = input.reasonCodes.map((entry) => text(entry, 'KSTACK_HOST_QUALIFICATION_INVALID'));
  if (reasonCodes.some((entry) => !REASON_CODE.test(entry)) || new Set(reasonCodes).size !== reasonCodes.length
      || reasonCodes.some((entry, index) => index > 0 && entry <= reasonCodes[index - 1])
      || (admissionBlocked === (reasonCodes.length === 0))) fail('KSTACK_HOST_QUALIFICATION_INVALID');

  return Object.freeze({
    schemaVersion: 1, qualificationId, hostId, version, executionMode, platform,
    source, runtime, supplyChain, isolation, functional, constraints,
    admissionBlocked, terminalOutcome, reasonCodes,
    observedAt: input.observedAt, expiresAt: input.expiresAt
  });
}

export function evaluateHostQualification(input, nowInput) {
  const record = validateHostQualification(input);
  const now = instant(nowInput, 'KSTACK_HOST_QUALIFICATION_TIME_INVALID');
  const rejections = new Set();
  if (now < Date.parse(record.observedAt) || now >= Date.parse(record.expiresAt)) rejections.add('KSTACK_HOST_QUALIFICATION_EXPIRED');
  if (!record.source.tagVerified || record.source.tagVerificationReason !== 'valid') rejections.add('KSTACK_HOST_SOURCE_UNVERIFIED');
  if (!record.runtime.engineSatisfied) rejections.add('KSTACK_HOST_RUNTIME_INCOMPATIBLE');
  if (!record.supplyChain.lockfileFrozen) rejections.add('KSTACK_HOST_LOCKFILE_NOT_FROZEN');
  if (!record.supplyChain.lifecycleScriptsDisabled) rejections.add('KSTACK_HOST_INSTALL_SCRIPTS_EXECUTED');
  if (record.supplyChain.advisoryAssessment.status !== 'MEASURED') rejections.add('KSTACK_HOST_ADVISORY_SCAN_MISSING');
  if ((record.supplyChain.advisories.critical ?? 0) > 0) rejections.add('KSTACK_HOST_CRITICAL_ADVISORY');
  if ((record.supplyChain.advisories.high ?? 0) > 0) rejections.add('KSTACK_HOST_HIGH_ADVISORY');
  if (record.source.findings.some((finding) => finding.severity === 'critical')) rejections.add('KSTACK_HOST_CRITICAL_SOURCE_FINDING');
  if (record.source.findings.some((finding) => finding.severity === 'high')) rejections.add('KSTACK_HOST_HIGH_SOURCE_FINDING');
  if (record.isolation.systemMutation) rejections.add('KSTACK_HOST_SYSTEM_MUTATION_OBSERVED');
  if (record.isolation.credentialUse) rejections.add('KSTACK_HOST_CREDENTIAL_USE_OBSERVED');
  if (!record.functional.syntaxPassed || !record.functional.sourceGuardsPassed) rejections.add('KSTACK_HOST_SOURCE_GUARD_FAILED');
  if (!record.functional.testsPassed || record.functional.testsRun < 1) rejections.add('KSTACK_HOST_TEST_EVIDENCE_MISSING');
  if (record.constraints.protectedValueAccess) rejections.add('KSTACK_HOST_PROTECTED_VALUE_SURFACE');
  if (record.constraints.maximumWallClockMs < 1) rejections.add('KSTACK_HOST_UNBOUNDED_RUNTIME');

  if (record.executionMode === 'native-analysis') {
    const unsafe = record.constraints.allowedOperations.some((operation) => !['inspect-file', 'search-text'].includes(operation));
    if (unsafe) rejections.add('KSTACK_HOST_NATIVE_ANALYSIS_MUTATION_SURFACE');
    if (record.constraints.delegationControl !== 'denied') rejections.add('KSTACK_HOST_NATIVE_ANALYSIS_DELEGATION_SURFACE');
  } else {
    if (record.constraints.sandboxEnforcement !== 'external') rejections.add('KSTACK_HOST_EXTERNAL_SANDBOX_REQUIRED');
    if (record.constraints.delegationControl !== 'external-launcher') rejections.add('KSTACK_HOST_EXTERNAL_DELEGATION_CONTROL_REQUIRED');
  }
  if (record.hostId === 'openclaw' && record.executionMode !== 'native-analysis') {
    if (record.constraints.sandboxEnforcement !== 'external') rejections.add('KSTACK_OPENCLAW_ACP_NOT_HOST_SANDBOXED');
    if (record.constraints.delegationControl !== 'external-launcher') rejections.add('KSTACK_OPENCLAW_EXPLICIT_ACP_SPAWN_UNMEDIATED');
  }

  const rejectionCodes = [...rejections].sort();
  const evidenceDigest = digest(record);
  if (rejectionCodes.length > 0) {
    return Object.freeze({ admitted: false, qualificationId: record.qualificationId, evidenceDigest, rejectionCodes });
  }
  return Object.freeze({
    admitted: true,
    qualificationId: record.qualificationId,
    evidenceDigest,
    rejectionCodes,
    cell: Object.freeze({
      schemaVersion: 1,
      hostId: record.hostId,
      executionMode: record.executionMode,
      version: record.version,
      platform: record.platform,
      capabilities: capabilitiesForOperations(record.constraints.allowedOperations),
      evidenceDigest,
      expiresAt: record.expiresAt
    })
  });
}

export const HOST_QUALIFICATION_CONSTANTS = Object.freeze({
  hosts: HOSTS,
  modes: MODES,
  severities: SEVERITIES,
  sandboxEnforcement: SANDBOX_ENFORCEMENT,
  delegationControl: DELEGATION_CONTROL,
  operations: OPERATIONS
});
