import crypto from 'node:crypto';

const HEX64 = /^[a-f0-9]{64}$/u;
const CELL_TARGETS = Object.freeze([
  Object.freeze({ cellId: 'debian-stable-native-x64', distributionFamily: 'debian', environment: 'native' }),
  Object.freeze({ cellId: 'fedora-stable-native-x64', distributionFamily: 'fedora', environment: 'native' }),
  Object.freeze({ cellId: 'ubuntu-lts-native-x64', distributionFamily: 'ubuntu', environment: 'native' }),
  Object.freeze({ cellId: 'ubuntu-lts-wsl2-x64', distributionFamily: 'ubuntu', environment: 'wsl2' })
]);
const CELL_TARGET_BY_ID = new Map(CELL_TARGETS.map((target) => [target.cellId, target]));
const LIFECYCLE_STEPS = Object.freeze([
  'clean-install', 'host-discovery', 'invocation', 'upgrade', 'rollback', 'health', 'persisted-data-recovery'
]);
const BACKENDS = Object.freeze(['cgroup-v2', 'ebpf', 'pidfd']);
const BACKEND_DISPOSITIONS = Object.freeze(['QUALIFIED', 'SEAM_TESTED', 'UNAVAILABLE']);
const BACKEND_CAPABILITY_ALTERNATIVES = Object.freeze({
  'cgroup-v2': Object.freeze(['CAP_SYS_ADMIN']),
  ebpf: Object.freeze(['CAP_BPF', 'CAP_SYS_ADMIN']),
  pidfd: Object.freeze(['CAP_SYS_PTRACE'])
});

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
function window(observedAt, expiresAt, code) {
  const observed = instant(observedAt, code);
  const expires = instant(expiresAt, code);
  if (expires <= observed || expires - observed > 31 * 86_400_000) fail(code);
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
function target(cellId, code) {
  const selected = CELL_TARGET_BY_ID.get(text(cellId, code));
  if (!selected) fail(code, 'cellId');
  return selected;
}
function stringSet(value, code) {
  if (!Array.isArray(value)) fail(code);
  const result = value.map((item) => text(item, code, /^[A-Za-z0-9_.:+/-]+$/u));
  const sorted = [...result].sort(compare);
  if (new Set(result).size !== result.length || result.some((item, index) => item !== sorted[index])) fail(code);
  return result;
}

export function validateLinuxCellObservation(input) {
  const code = 'KSTACK_LINUX_CELL_INVALID';
  exact(input, [
    'schemaVersion', 'cellId', 'distributionId', 'distributionVersion', 'distributionFamily', 'distributionEvidenceDigest',
    'environment', 'architecture', 'kernelRelease', 'kernelEvidenceDigest', 'filesystemType',
    'filesystemNative', 'filesystemEvidenceDigest', 'initSystem', 'initOperational',
    'initEvidenceDigest', 'packageManager', 'packageManagerEvidenceDigest', 'observedAt', 'expiresAt'
  ], code);
  if (input.schemaVersion !== 1) fail(code, 'schemaVersion');
  const expected = target(input.cellId, code);
  if (input.distributionFamily !== expected.distributionFamily || input.environment !== expected.environment) fail(code, 'target mismatch');
  const distributionId = text(input.distributionId, code, /^[a-z][a-z0-9-]*$/u);
  if ((expected.distributionFamily === 'ubuntu' && distributionId !== 'ubuntu')
      || (expected.distributionFamily === 'debian' && distributionId !== 'debian')
      || (expected.distributionFamily === 'fedora' && distributionId !== 'fedora')) fail(code, 'distributionId');
  if (input.architecture !== 'x86_64') fail(code, 'architecture');
  const kernelRelease = text(input.kernelRelease, code);
  if (expected.environment === 'wsl2' && !/microsoft.*wsl2/iu.test(kernelRelease)) fail(code, 'WSL2 kernel');
  if (expected.environment === 'native' && /microsoft.*wsl/iu.test(kernelRelease)) fail(code, 'native kernel');
  const packageManager = text(input.packageManager, code);
  if ((expected.distributionFamily === 'fedora' && packageManager !== 'dnf')
      || (expected.distributionFamily !== 'fedora' && packageManager !== 'apt')) fail(code, 'packageManager');
  window(input.observedAt, input.expiresAt, 'KSTACK_LINUX_CELL_TIME_INVALID');
  return immutable({
    schemaVersion: 1, cellId: input.cellId, distributionId,
    distributionVersion: text(input.distributionVersion, code), distributionFamily: input.distributionFamily,
    distributionEvidenceDigest: hash(input.distributionEvidenceDigest, code),
    environment: input.environment, architecture: input.architecture, kernelRelease,
    kernelEvidenceDigest: hash(input.kernelEvidenceDigest, code),
    filesystemType: text(input.filesystemType, code), filesystemNative: bool(input.filesystemNative, code),
    filesystemEvidenceDigest: hash(input.filesystemEvidenceDigest, code),
    initSystem: text(input.initSystem, code), initOperational: bool(input.initOperational, code),
    initEvidenceDigest: hash(input.initEvidenceDigest, code), packageManager,
    packageManagerEvidenceDigest: hash(input.packageManagerEvidenceDigest, code),
    observedAt: input.observedAt, expiresAt: input.expiresAt
  });
}

export function evaluateLinuxCellObservation(input, nowInput) {
  const record = validateLinuxCellObservation(input);
  const now = instant(nowInput, 'KSTACK_LINUX_CELL_TIME_INVALID');
  const rejectionCodes = [];
  if (now < Date.parse(record.observedAt) || now >= Date.parse(record.expiresAt)) rejectionCodes.push('KSTACK_LINUX_CELL_EXPIRED');
  if (!record.filesystemNative) rejectionCodes.push('KSTACK_LINUX_NATIVE_FILESYSTEM_REQUIRED');
  return immutable({
    qualified: rejectionCodes.length === 0, cellId: record.cellId,
    evidenceDigest: digest(record), rejectionCodes
  });
}

export function validateLinuxLifecycle(input) {
  const code = 'KSTACK_LINUX_LIFECYCLE_INVALID';
  exact(input, [
    'schemaVersion', 'cellId', 'sourceVersion', 'upgradeVersion', 'rollbackVersion', 'nativeStorage',
    'steps', 'persistedStateDigestBefore', 'persistedStateDigestAfter', 'observedAt', 'expiresAt'
  ], code);
  if (input.schemaVersion !== 1) fail(code, 'schemaVersion');
  target(input.cellId, code);
  const sourceVersion = text(input.sourceVersion, code);
  const upgradeVersion = text(input.upgradeVersion, code);
  const rollbackVersion = text(input.rollbackVersion, code);
  if (sourceVersion === upgradeVersion || rollbackVersion !== sourceVersion) fail(code, 'version lineage');
  if (!Array.isArray(input.steps) || input.steps.length !== LIFECYCLE_STEPS.length) fail(code, 'steps');
  const steps = input.steps.map((step, index) => {
    exact(step, ['stepId', 'outcome', 'evidenceDigest', 'durationMs'], code);
    if (step.stepId !== LIFECYCLE_STEPS[index] || !['PASS', 'FAIL'].includes(step.outcome)) fail(code, 'step order');
    return { stepId: step.stepId, outcome: step.outcome, evidenceDigest: hash(step.evidenceDigest, code), durationMs: integer(step.durationMs, code, 86_400_000) };
  });
  window(input.observedAt, input.expiresAt, 'KSTACK_LINUX_LIFECYCLE_TIME_INVALID');
  return immutable({
    schemaVersion: 1, cellId: input.cellId, sourceVersion, upgradeVersion, rollbackVersion,
    nativeStorage: bool(input.nativeStorage, code), steps,
    persistedStateDigestBefore: hash(input.persistedStateDigestBefore, code),
    persistedStateDigestAfter: hash(input.persistedStateDigestAfter, code),
    observedAt: input.observedAt, expiresAt: input.expiresAt
  });
}

export function evaluateLinuxLifecycle(input, nowInput) {
  const record = validateLinuxLifecycle(input);
  const now = instant(nowInput, 'KSTACK_LINUX_LIFECYCLE_TIME_INVALID');
  const rejectionCodes = [];
  if (now < Date.parse(record.observedAt) || now >= Date.parse(record.expiresAt)) rejectionCodes.push('KSTACK_LINUX_LIFECYCLE_EXPIRED');
  if (!record.nativeStorage) rejectionCodes.push('KSTACK_LINUX_LIFECYCLE_NATIVE_STORAGE_REQUIRED');
  if (record.steps.some((step) => step.outcome !== 'PASS')) rejectionCodes.push('KSTACK_LINUX_LIFECYCLE_STEP_FAILED');
  if (record.persistedStateDigestBefore !== record.persistedStateDigestAfter) rejectionCodes.push('KSTACK_LINUX_PERSISTED_DATA_NOT_RECOVERED');
  return immutable({ qualified: rejectionCodes.length === 0, cellId: record.cellId, evidenceDigest: digest(record), rejectionCodes });
}

export function validateLinuxBackendQualification(input) {
  const code = 'KSTACK_LINUX_BACKEND_INVALID';
  exact(input, ['schemaVersion', 'cellId', 'kernelRelease', 'effectiveCapabilities', 'probes', 'observedAt', 'expiresAt'], code);
  if (input.schemaVersion !== 1) fail(code, 'schemaVersion');
  target(input.cellId, code);
  const effectiveCapabilities = stringSet(input.effectiveCapabilities, code);
  if (!Array.isArray(input.probes) || input.probes.length !== BACKENDS.length) fail(code, 'probes');
  const probes = input.probes.map((probe, index) => {
    exact(probe, ['backendId', 'disposition', 'featurePresent', 'privilegedExecutionObserved', 'evidenceDigest', 'limitation'], code);
    if (probe.backendId !== BACKENDS[index] || !BACKEND_DISPOSITIONS.includes(probe.disposition)) fail(code, 'probe order');
    const featurePresent = bool(probe.featurePresent, code);
    const privilegedExecutionObserved = bool(probe.privilegedExecutionObserved, code);
    const matchingCapability = BACKEND_CAPABILITY_ALTERNATIVES[probe.backendId]
      .some((capability) => effectiveCapabilities.includes(capability));
    if (probe.disposition === 'QUALIFIED' && (!featurePresent || !privilegedExecutionObserved || !matchingCapability || probe.limitation !== null)) fail(code, 'qualified probe');
    if (probe.disposition !== 'QUALIFIED' && (typeof probe.limitation !== 'string' || probe.limitation.length === 0)) fail(code, 'limitation');
    return {
      backendId: probe.backendId, disposition: probe.disposition, featurePresent,
      privilegedExecutionObserved, evidenceDigest: hash(probe.evidenceDigest, code), limitation: probe.limitation
    };
  });
  window(input.observedAt, input.expiresAt, 'KSTACK_LINUX_BACKEND_TIME_INVALID');
  return immutable({
    schemaVersion: 1, cellId: input.cellId, kernelRelease: text(input.kernelRelease, code),
    effectiveCapabilities, probes,
    observedAt: input.observedAt, expiresAt: input.expiresAt
  });
}

export function evaluateLinuxBackends(input, nowInput) {
  const record = validateLinuxBackendQualification(input);
  const now = instant(nowInput, 'KSTACK_LINUX_BACKEND_TIME_INVALID');
  const rejectionCodes = [];
  if (now < Date.parse(record.observedAt) || now >= Date.parse(record.expiresAt)) rejectionCodes.push('KSTACK_LINUX_BACKEND_EVIDENCE_EXPIRED');
  for (const probe of record.probes) if (probe.disposition !== 'QUALIFIED') rejectionCodes.push(`KSTACK_LINUX_BACKEND_${probe.backendId.toUpperCase().replaceAll('-', '_')}_NOT_QUALIFIED`);
  return immutable({
    qualified: rejectionCodes.length === 0, cellId: record.cellId, evidenceDigest: digest(record),
    qualifiedBackends: record.probes.filter((probe) => probe.disposition === 'QUALIFIED').map((probe) => probe.backendId),
    seamTestedBackends: record.probes.filter((probe) => probe.disposition === 'SEAM_TESTED').map((probe) => probe.backendId),
    rejectionCodes
  });
}

function exactCoverage(records, evaluator, nowInput, code) {
  if (!Array.isArray(records)) fail(code);
  const results = records.map((record) => evaluator(record, nowInput));
  const actual = results.map((result) => result.cellId).sort(compare);
  const expected = CELL_TARGETS.map((item) => item.cellId).sort(compare);
  const duplicates = new Set(actual).size !== actual.length;
  const coverageExact = !duplicates && actual.length === expected.length && actual.every((item, index) => item === expected[index]);
  return { results, coverageExact, qualified: coverageExact && results.every((result) => result.qualified) };
}

export function evaluateLinuxQualificationProgram(input, nowInput) {
  exact(input, ['cells', 'lifecycles', 'backends'], 'KSTACK_LINUX_PROGRAM_INVALID');
  const matrix = exactCoverage(input.cells, evaluateLinuxCellObservation, nowInput, 'KSTACK_LINUX_PROGRAM_INVALID');
  const lifecycle = exactCoverage(input.lifecycles, evaluateLinuxLifecycle, nowInput, 'KSTACK_LINUX_PROGRAM_INVALID');
  const privilegedBackends = exactCoverage(input.backends, evaluateLinuxBackends, nowInput, 'KSTACK_LINUX_PROGRAM_INVALID');
  const outcome = {
    schemaVersion: 1,
    matrix: { qualified: matrix.qualified, coverageExact: matrix.coverageExact, cells: matrix.results },
    lifecycle: { qualified: lifecycle.qualified, coverageExact: lifecycle.coverageExact, cells: lifecycle.results },
    privilegedBackends: { qualified: privilegedBackends.qualified, coverageExact: privilegedBackends.coverageExact, cells: privilegedBackends.results }
  };
  return immutable({ ...outcome, qualified: outcome.matrix.qualified && outcome.lifecycle.qualified && outcome.privilegedBackends.qualified, programDigest: digest(outcome) });
}

export const LINUX_QUALIFICATION_CONSTANTS = Object.freeze({
  cellTargets: CELL_TARGETS,
  lifecycleSteps: LIFECYCLE_STEPS,
  backends: BACKENDS,
  backendDispositions: BACKEND_DISPOSITIONS
});
