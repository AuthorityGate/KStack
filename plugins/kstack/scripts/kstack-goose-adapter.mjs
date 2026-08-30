import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HEX64 = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const ACTIONS = Object.freeze(['ADVISORY', 'HELP', 'SKILLS_LIST', 'VERSION']);
const PORTS = Object.freeze([
  'bindHostInstance', 'bindRepositoryContext', 'discoverInstructionProjection',
  'observeNativeAction', 'requestNativeApprovalDisplay', 'routeProtectedBroker',
  'observeProcessLifecycle', 'observeStructuredOutput', 'observeCancellation'
]);
const FORBIDDEN_PROJECTION_KEYS = Object.freeze([
  'allow', 'approval', 'authority', 'credential', 'eligibility', 'policy', 'retry',
  'secret', 'supportTier', 'terminalStatus', 'token'
]);
const SECRET_PATTERN = /(?:ATATT3xF[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*\S+)/iu;
const ANSI_PATTERN = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/u;

export class GooseAdapterError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'GooseAdapterError';
    this.code = code;
  }
}

function fail(code, detail = '') { throw new GooseAdapterError(code, detail); }
function compare(left, right) { return Buffer.compare(Buffer.from(left), Buffer.from(right)); }
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code, 'closed schema');
}
function text(value, code, pattern = null, maximum = 4096) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || value.trim() !== value || (pattern && !pattern.test(value))) fail(code);
  return value;
}
function digest(value, code) { return text(value, code, HEX64, 64); }
function integer(value, code, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
  return value;
}
function bool(value, code) { if (typeof value !== 'boolean') fail(code); return value; }
function absolute(value, code) {
  text(value, code, null, 4096);
  if (!path.isAbsolute(value) || path.normalize(value) !== value) fail(code);
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]));
  return value;
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function recordDigest(value) { return sha256(JSON.stringify(canonical(value))); }
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}
function noForbiddenKeys(value, code) {
  const walk = (entry) => {
    if (!entry || typeof entry !== 'object') return;
    for (const [key, child] of Object.entries(entry)) {
      if (FORBIDDEN_PROJECTION_KEYS.some((forbidden) => key.toLowerCase() === forbidden.toLowerCase())) fail(code, `forbidden field ${key}`);
      walk(child);
    }
  };
  walk(value);
}
function safeOutput(value, code) {
  if (typeof value !== 'string' || Buffer.byteLength(value) > 4 * 1024 * 1024 || value.includes('\0')) fail(code);
  if (SECRET_PATTERN.test(value)) fail('KSTACK_GOOSE_ADAPTER_OUTPUT_SECRET');
  if (ANSI_PATTERN.test(value)) fail('KSTACK_GOOSE_ADAPTER_OUTPUT_TERMINAL_ESCAPE');
  return value;
}
function exactFileSha256(file, expected, code) {
  let bytes;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || (stat.mode & 0o111) === 0) fail(code);
    bytes = fs.readFileSync(file);
  } catch (error) {
    if (error instanceof GooseAdapterError) throw error;
    fail(code);
  }
  if (sha256(bytes) !== expected) fail(code, 'binary digest mismatch');
}

export const GOOSE_ADAPTER_PORTS = PORTS;
export const GOOSE_ADAPTER_ACTIONS = ACTIONS;
export const GOOSE_ADAPTER_PROFILE = Object.freeze({
  profileId: 'goose.advisory-public-read.v1',
  maximumClaim: 'ADVISORY_PUBLIC_READ_ONLY',
  providerMode: 'SYNTHETIC_LOOPBACK_NO_CREDENTIAL',
  extensions: Object.freeze([]),
  nativeTools: Object.freeze([]),
  sessionPersistence: false,
  networkClass: 'ISOLATED_LOOPBACK_ONLY'
});

export function validateGooseAdapterDescriptor(input) {
  const code = 'KSTACK_GOOSE_ADAPTER_DESCRIPTOR_INVALID';
  exact(input, [
    'schemaVersion', 'hostId', 'hostVersion', 'hostBuildDigest', 'binarySha256',
    'sourceManifestDigest', 'adapterDigest', 'projectionPlanDigest',
    'nativeEventSchemaDigest', 'bypassInventoryDigest',
    'environmentProfileDigest', 'fixtureMappingDigest', 'ports'
  ], code);
  if (input.schemaVersion !== 1 || input.hostId !== 'goose' || input.hostVersion !== '1.48.0') fail(code);
  for (const field of Object.keys(input).filter((key) => key.endsWith('Digest') || key === 'binarySha256')) digest(input[field], code);
  if (!Array.isArray(input.ports) || input.ports.length !== PORTS.length || input.ports.some((port, index) => port !== PORTS[index])) fail(code);
  return immutable(structuredClone(input));
}

export function validateGooseOperation(input, options = {}) {
  const code = 'KSTACK_GOOSE_ADAPTER_OPERATION_INVALID';
  exact(input, [
    'schemaVersion', 'operationId', 'action', 'binaryPath', 'binarySha256',
    'repositoryRoot', 'pathRoot', 'inputDigest', 'expectedMarker',
    'brokerTicketDigest', 'deadlineMs'
  ], code);
  if (input.schemaVersion !== 1) fail(code);
  text(input.operationId, code, ID, 128);
  if (!ACTIONS.includes(input.action)) fail(code);
  absolute(input.binaryPath, code); absolute(input.repositoryRoot, code); absolute(input.pathRoot, code);
  digest(input.binarySha256, code); digest(input.inputDigest, code);
  text(input.expectedMarker, code, /^[A-Za-z0-9_. -]{1,128}$/u, 128);
  if (input.brokerTicketDigest !== null) digest(input.brokerTicketDigest, code);
  integer(input.deadlineMs, code, 100, 120_000);
  if (input.action === 'ADVISORY' && input.brokerTicketDigest === null) fail(code, 'broker ticket required');
  if (input.action !== 'ADVISORY' && input.brokerTicketDigest !== null) fail(code, 'broker ticket unexpected');
  if (options.verifyBinary !== false) exactFileSha256(input.binaryPath, input.binarySha256, 'KSTACK_GOOSE_ADAPTER_BINARY_INVALID');
  return immutable(structuredClone(input));
}

export function buildGooseInvocation(operationInput, bindings = {}) {
  const operation = validateGooseOperation(operationInput, { verifyBinary: bindings.verifyBinary !== false });
  exact(bindings, ['loopbackEndpoint', 'verifyBinary'], 'KSTACK_GOOSE_ADAPTER_BINDING_INVALID');
  const baseEnvironment = {
    GOOSE_PATH_ROOT: operation.pathRoot,
    GOOSE_TELEMETRY_OFF: '1',
    HOME: path.join(operation.pathRoot, 'home'),
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    NO_COLOR: '1',
    PATH: '/usr/bin:/bin',
    RUST_LOG: 'off',
    TERM: 'dumb',
    TZ: 'UTC'
  };
  let args;
  if (operation.action === 'VERSION') args = ['--version'];
  else if (operation.action === 'HELP') args = ['run', '--help'];
  else if (operation.action === 'SKILLS_LIST') args = ['skills', 'list'];
  else {
    text(bindings.loopbackEndpoint, 'KSTACK_GOOSE_ADAPTER_BINDING_INVALID', /^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/u, 64);
    const port = Number(new URL(bindings.loopbackEndpoint).port);
    if (port > 65535) fail('KSTACK_GOOSE_ADAPTER_BINDING_INVALID');
    baseEnvironment.OPENAI_HOST = bindings.loopbackEndpoint;
    baseEnvironment.OPENAI_BASE_PATH = 'v1/chat/completions';
    args = [
      'run', '--no-session', '--no-profile', '--quiet', '--output-format', 'json',
      '--provider', 'openai', '--model', 'gpt-4o', '--max-turns', '1',
      '--text', `Return only ${operation.expectedMarker}.`
    ];
  }
  return immutable({
    command: operation.binaryPath, args, cwd: operation.repositoryRoot,
    env: baseEnvironment, deadlineMs: operation.deadlineMs,
    stdin: '', invocationDigest: recordDigest({ commandDigest: operation.binarySha256, args, cwd: operation.repositoryRoot, env: baseEnvironment })
  });
}

function jsonContainsMarker(value, marker) {
  if (typeof value === 'string') return value.includes(marker);
  if (Array.isArray(value)) return value.some((entry) => jsonContainsMarker(entry, marker));
  if (value && typeof value === 'object') return Object.values(value).some((entry) => jsonContainsMarker(entry, marker));
  return false;
}

export function observeGooseExecution(operationInput, rawInput) {
  const operation = validateGooseOperation(operationInput, { verifyBinary: false });
  const code = 'KSTACK_GOOSE_ADAPTER_EXECUTION_INVALID';
  exact(rawInput, [
    'exitCode', 'signal', 'timedOut', 'stdout', 'stderr', 'providerRequestCount',
    'providerRequestDigest', 'loopbackOnly', 'rootMutationDigest', 'orphanCount'
  ], code);
  if (rawInput.exitCode !== null) integer(rawInput.exitCode, code, 0, 255);
  if (rawInput.signal !== null) text(rawInput.signal, code, /^SIG[A-Z0-9]+$/u, 32);
  bool(rawInput.timedOut, code); bool(rawInput.loopbackOnly, code);
  const stdout = safeOutput(rawInput.stdout, code); const stderr = safeOutput(rawInput.stderr, code);
  integer(rawInput.providerRequestCount, code, 0, 16);
  if (rawInput.providerRequestDigest !== null) digest(rawInput.providerRequestDigest, code);
  digest(rawInput.rootMutationDigest, code); integer(rawInput.orphanCount, code, 0, 1024);
  let markerObserved = false;
  let structuredOutput = null;
  if (operation.action === 'ADVISORY') {
    try { structuredOutput = JSON.parse(stdout); } catch { structuredOutput = null; }
    markerObserved = structuredOutput !== null && jsonContainsMarker(structuredOutput, operation.expectedMarker);
  } else markerObserved = stdout.includes(operation.expectedMarker);
  const providerShapeValid = operation.action === 'ADVISORY'
    ? rawInput.providerRequestCount === 2 && rawInput.providerRequestDigest !== null
    : rawInput.providerRequestCount === 0 && rawInput.providerRequestDigest === null;
  const reasonCodes = [
    ...(rawInput.exitCode === 0 ? [] : ['NATIVE_EXIT_NONZERO']),
    ...(rawInput.signal === null ? [] : ['NATIVE_SIGNALLED']),
    ...(rawInput.timedOut ? ['NATIVE_TIMEOUT'] : []),
    ...(markerObserved ? [] : ['EXPECTED_MARKER_MISSING']),
    ...(providerShapeValid ? [] : ['PROVIDER_OBSERVATION_MISMATCH']),
    ...(rawInput.loopbackOnly ? [] : ['NETWORK_BOUNDARY_VIOLATION']),
    ...(rawInput.orphanCount === 0 ? [] : ['ORPHAN_PROCESS_OBSERVED'])
  ].sort(compare);
  const observation = {
    schemaVersion: 1, hostId: 'goose', operationId: operation.operationId,
    action: operation.action, binarySha256: operation.binarySha256,
    inputDigest: operation.inputDigest, stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr), providerRequestCount: rawInput.providerRequestCount,
    providerRequestDigest: rawInput.providerRequestDigest,
    rootMutationDigest: rawInput.rootMutationDigest,
    markerObserved, loopbackOnly: rawInput.loopbackOnly,
    orphanCount: rawInput.orphanCount, nativeOutcome: reasonCodes.length === 0 ? 'MATCH' : 'MISMATCH',
    reasonCodes
  };
  return immutable({ observation, observationDigest: recordDigest(observation), structuredOutput });
}

function bindHostInstance(input) {
  const code = 'KSTACK_GOOSE_PORT_HOST_BINDING_INVALID';
  exact(input, ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest'], code);
  for (const value of Object.values(input)) digest(value, code);
  return immutable({ bindingDigest: recordDigest(input) });
}
function bindRepositoryContext(input) {
  const code = 'KSTACK_GOOSE_PORT_REPOSITORY_BINDING_INVALID';
  exact(input, ['repositoryDigest', 'workspaceRootDigest', 'instructionRootDigest'], code);
  for (const value of Object.values(input)) digest(value, code);
  return immutable({ bindingDigest: recordDigest(input) });
}
function discoverInstructionProjection(input) {
  const code = 'KSTACK_GOOSE_PORT_PROJECTION_INVALID';
  exact(input, ['packageDigest', 'skillDigest', 'projectionKind', 'nativePathDigest'], code);
  for (const field of ['packageDigest', 'skillDigest', 'nativePathDigest']) digest(input[field], code);
  if (input.projectionKind !== 'PROJECT_AGENT_SKILL') fail(code);
  noForbiddenKeys(input, code);
  return immutable({ observationDigest: recordDigest(input) });
}
function observeNativeAction(input) {
  const code = 'KSTACK_GOOSE_PORT_NATIVE_ACTION_INVALID';
  exact(input, ['operationId', 'nativeActionDigest', 'nativeEventDigest'], code);
  text(input.operationId, code, ID, 128); digest(input.nativeActionDigest, code); digest(input.nativeEventDigest, code);
  noForbiddenKeys(input, code);
  return immutable({ observationDigest: recordDigest(input) });
}
function requestNativeApprovalDisplay(input) {
  const code = 'KSTACK_GOOSE_PORT_APPROVAL_DISPLAY_INVALID';
  exact(input, ['operationId', 'displayArtifactDigest', 'displayNonceDigest'], code);
  text(input.operationId, code, ID, 128); digest(input.displayArtifactDigest, code); digest(input.displayNonceDigest, code);
  noForbiddenKeys(input, code);
  return immutable({ displayRequestDigest: recordDigest(input), grantsAuthority: false });
}
function routeProtectedBroker(input) {
  const code = 'KSTACK_GOOSE_PORT_BROKER_ROUTE_INVALID';
  exact(input, ['operationId', 'brokerTicketDigest', 'providerClass'], code);
  text(input.operationId, code, ID, 128); digest(input.brokerTicketDigest, code);
  if (input.providerClass !== 'SYNTHETIC_LOOPBACK_NO_CREDENTIAL') fail(code);
  noForbiddenKeys(input, code);
  return immutable({ routeDigest: recordDigest(input), carriesCredential: false });
}
function observeProcessLifecycle(input) {
  const code = 'KSTACK_GOOSE_PORT_PROCESS_LIFECYCLE_INVALID';
  exact(input, ['operationId', 'processDigest', 'event', 'orphanCount'], code);
  text(input.operationId, code, ID, 128); digest(input.processDigest, code);
  if (!['STARTED', 'EXITED', 'CANCELLED'].includes(input.event)) fail(code);
  integer(input.orphanCount, code, 0, 1024);
  return immutable({ observationDigest: recordDigest(input) });
}
function observeStructuredOutput(input) {
  const code = 'KSTACK_GOOSE_PORT_STRUCTURED_OUTPUT_INVALID';
  exact(input, ['operationId', 'outputDigest', 'schemaDigest'], code);
  text(input.operationId, code, ID, 128); digest(input.outputDigest, code); digest(input.schemaDigest, code);
  noForbiddenKeys(input, code);
  return immutable({ observationDigest: recordDigest(input) });
}
function observeCancellation(input) {
  const code = 'KSTACK_GOOSE_PORT_CANCELLATION_INVALID';
  exact(input, ['operationId', 'requestDigest', 'nativeCancellationDigest', 'observed'], code);
  text(input.operationId, code, ID, 128); digest(input.requestDigest, code); digest(input.nativeCancellationDigest, code); bool(input.observed, code);
  return immutable({ observationDigest: recordDigest(input) });
}

export const GOOSE_ADAPTER_BOUNDARY = Object.freeze({
  bindHostInstance, bindRepositoryContext, discoverInstructionProjection,
  observeNativeAction, requestNativeApprovalDisplay, routeProtectedBroker,
  observeProcessLifecycle, observeStructuredOutput, observeCancellation
});
