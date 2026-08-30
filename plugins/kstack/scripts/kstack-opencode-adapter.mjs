import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HEX64 = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const ACTIONS = Object.freeze(['ADVISORY', 'SKILL_DISCOVERY', 'VERSION']);
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

export class OpenCodeAdapterError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'OpenCodeAdapterError';
    this.code = code;
  }
}

function fail(code, detail = '') { throw new OpenCodeAdapterError(code, detail); }
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
  if (typeof value !== 'string' || Buffer.byteLength(value) > 8 * 1024 * 1024 || value.includes('\0')) fail(code);
  if (SECRET_PATTERN.test(value)) fail('KSTACK_OPENCODE_ADAPTER_OUTPUT_SECRET');
  if (ANSI_PATTERN.test(value)) fail('KSTACK_OPENCODE_ADAPTER_OUTPUT_TERMINAL_ESCAPE');
  return value;
}
function exactFileSha256(file, expected, code) {
  let bytes;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || (stat.mode & 0o111) === 0) fail(code);
    bytes = fs.readFileSync(file);
  } catch (error) {
    if (error instanceof OpenCodeAdapterError) throw error;
    fail(code);
  }
  if (sha256(bytes) !== expected) fail(code, 'binary digest mismatch');
}

function config(loopbackEndpoint) {
  text(loopbackEndpoint, 'KSTACK_OPENCODE_ADAPTER_BINDING_INVALID', /^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/v1$/u, 64);
  const port = Number(new URL(loopbackEndpoint).port);
  if (port > 65535) fail('KSTACK_OPENCODE_ADAPTER_BINDING_INVALID');
  return {
    $schema: 'https://opencode.ai/config.json',
    autoupdate: false,
    share: 'disabled',
    permission: { '*': 'deny', skill: 'allow' },
    provider: {
      kstack: {
        npm: '@ai-sdk/openai-compatible',
        name: 'KStack loopback qualification provider',
        options: { baseURL: loopbackEndpoint },
        models: { 'kstack-qualification': { name: 'KStack qualification model' } }
      }
    }
  };
}

function completedTextEvents(stdout) {
  const rows = stdout.split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  return {
    rows,
    texts: rows.filter((row) => row.type === 'text' && row.part?.type === 'text' && typeof row.part.text === 'string').map((row) => row.part.text.trim()),
    eventTypes: rows.map((row) => row.type)
  };
}

export const OPENCODE_ADAPTER_PORTS = PORTS;
export const OPENCODE_ADAPTER_ACTIONS = ACTIONS;
export const OPENCODE_ADAPTER_PROFILE = Object.freeze({
  profileId: 'opencode.native-skill-advisory.v1',
  maximumClaim: 'ADVISORY_INSTRUCTION_ONLY',
  providerMode: 'SYNTHETIC_LOOPBACK_NO_CREDENTIAL',
  externalPlugins: false,
  nativePermission: Object.freeze({ '*': 'deny', skill: 'allow' }),
  sessionPersistence: false,
  networkClass: 'ISOLATED_LOOPBACK_ONLY'
});

export function validateOpenCodeAdapterDescriptor(input) {
  const code = 'KSTACK_OPENCODE_ADAPTER_DESCRIPTOR_INVALID';
  exact(input, [
    'schemaVersion', 'hostId', 'hostVersion', 'hostBuildDigest', 'binarySha256',
    'sourceManifestDigest', 'adapterDigest', 'projectionPlanDigest',
    'nativeEventSchemaDigest', 'bypassInventoryDigest',
    'environmentProfileDigest', 'fixtureMappingDigest', 'ports'
  ], code);
  if (input.schemaVersion !== 1 || input.hostId !== 'opencode' || input.hostVersion !== '1.18.25') fail(code);
  for (const field of Object.keys(input).filter((key) => key.endsWith('Digest') || key === 'binarySha256')) digest(input[field], code);
  if (!Array.isArray(input.ports) || input.ports.length !== PORTS.length || input.ports.some((port, index) => port !== PORTS[index])) fail(code);
  return immutable(structuredClone(input));
}

export function validateOpenCodeOperation(input, options = {}) {
  const code = 'KSTACK_OPENCODE_ADAPTER_OPERATION_INVALID';
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
  if (options.verifyBinary !== false) exactFileSha256(input.binaryPath, input.binarySha256, 'KSTACK_OPENCODE_ADAPTER_BINARY_INVALID');
  return immutable(structuredClone(input));
}

export function buildOpenCodeInvocation(operationInput, bindings = {}) {
  const operation = validateOpenCodeOperation(operationInput, { verifyBinary: bindings.verifyBinary !== false });
  exact(bindings, ['loopbackEndpoint', 'verifyBinary'], 'KSTACK_OPENCODE_ADAPTER_BINDING_INVALID');
  const liveConfig = config(bindings.loopbackEndpoint);
  const baseEnvironment = {
    HOME: path.join(operation.pathRoot, 'home'),
    XDG_DATA_HOME: path.join(operation.pathRoot, 'data'),
    XDG_CONFIG_HOME: path.join(operation.pathRoot, 'config'),
    XDG_CACHE_HOME: path.join(operation.pathRoot, 'cache'),
    XDG_STATE_HOME: path.join(operation.pathRoot, 'state'),
    LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin', TZ: 'UTC',
    OPENCODE_CONFIG_CONTENT: JSON.stringify(liveConfig),
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    OPENCODE_DISABLE_PRUNE: '1',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: '1',
    OPENCODE_DISABLE_TERMINAL_TITLE: '1',
    OPENCODE_PURE: '1'
  };
  let args;
  if (operation.action === 'VERSION') args = ['--version'];
  else if (operation.action === 'SKILL_DISCOVERY') args = ['--pure', 'debug', 'skill'];
  else args = [
    '--pure', 'run', '--format', 'json', '--model', 'kstack/kstack-qualification',
    '--title', operation.operationId,
    `Load the registered skill named ${operation.expectedMarker} for observation fixture ${operation.operationId}, obey its inert observation clause, and return only the requested value.`
  ];
  return immutable({
    command: operation.binaryPath,
    args,
    cwd: operation.repositoryRoot,
    env: baseEnvironment,
    deadlineMs: operation.deadlineMs,
    stdin: '',
    configDigest: recordDigest(liveConfig),
    invocationDigest: recordDigest({ commandDigest: operation.binarySha256, args, cwd: operation.repositoryRoot, env: baseEnvironment })
  });
}

export function observeOpenCodeExecution(operationInput, rawInput) {
  const operation = validateOpenCodeOperation(operationInput, { verifyBinary: false });
  const code = 'KSTACK_OPENCODE_ADAPTER_EXECUTION_INVALID';
  exact(rawInput, [
    'exitCode', 'signal', 'timedOut', 'stdout', 'stderr', 'providerRequestCount',
    'providerRequestDigest', 'providerPhases', 'nativeEventTypes', 'loopbackOnly',
    'repositoryBeforeDigest', 'repositoryAfterDigest', 'allowedStateDigest', 'orphanCount'
  ], code);
  if (rawInput.exitCode !== null) integer(rawInput.exitCode, code, 0, 255);
  if (rawInput.signal !== null) text(rawInput.signal, code, /^SIG[A-Z0-9]+$/u, 32);
  bool(rawInput.timedOut, code); bool(rawInput.loopbackOnly, code);
  const stdout = safeOutput(rawInput.stdout, code); const stderr = safeOutput(rawInput.stderr, code);
  integer(rawInput.providerRequestCount, code, 0, 16);
  if (rawInput.providerRequestDigest !== null) digest(rawInput.providerRequestDigest, code);
  if (!Array.isArray(rawInput.providerPhases) || !Array.isArray(rawInput.nativeEventTypes)) fail(code);
  for (const phase of rawInput.providerPhases) text(phase, code, /^[A-Z][A-Z0-9_]{0,127}$/u, 128);
  for (const event of rawInput.nativeEventTypes) text(event, code, ID, 128);
  for (const field of ['repositoryBeforeDigest', 'repositoryAfterDigest', 'allowedStateDigest']) digest(rawInput[field], code);
  integer(rawInput.orphanCount, code, 0, 1024);

  let markerObserved = false;
  let outputShapeValid = false;
  let normalizedOutputDigest;
  if (operation.action === 'VERSION') {
    markerObserved = stdout.trim() === operation.expectedMarker;
    outputShapeValid = markerObserved;
    normalizedOutputDigest = sha256(stdout.trim());
  } else if (operation.action === 'SKILL_DISCOVERY') {
    let rows;
    try { rows = JSON.parse(stdout); } catch { rows = null; }
    const matches = Array.isArray(rows) ? rows.filter((row) => row?.name === operation.expectedMarker) : [];
    markerObserved = matches.length === 1;
    outputShapeValid = Array.isArray(rows) && matches.length === 1;
    normalizedOutputDigest = sha256(JSON.stringify(canonical(rows)));
  } else {
    const parsed = completedTextEvents(stdout);
    markerObserved = parsed.texts.length === 1 && /^[0-9a-f]{64}$/u.test(parsed.texts[0]);
    outputShapeValid = markerObserved
      && JSON.stringify(parsed.eventTypes) === JSON.stringify(['step_start', 'tool_use', 'step_finish', 'step_start', 'text', 'step_finish'])
      && JSON.stringify(rawInput.nativeEventTypes) === JSON.stringify(parsed.eventTypes);
    normalizedOutputDigest = sha256(JSON.stringify({ texts: parsed.texts, eventTypes: parsed.eventTypes }));
  }
  const providerShapeValid = operation.action === 'ADVISORY'
    ? rawInput.providerRequestCount === 2 && rawInput.providerRequestDigest !== null
      && JSON.stringify(rawInput.providerPhases) === JSON.stringify(['BEFORE_NATIVE_SKILL_RESULT', 'AFTER_NATIVE_SKILL_RESULT'])
    : rawInput.providerRequestCount === 0 && rawInput.providerRequestDigest === null && rawInput.providerPhases.length === 0;
  const reasonCodes = [
    ...(rawInput.exitCode === 0 ? [] : ['NATIVE_EXIT_NONZERO']),
    ...(rawInput.signal === null ? [] : ['NATIVE_SIGNALLED']),
    ...(rawInput.timedOut ? ['NATIVE_TIMEOUT'] : []),
    ...(markerObserved ? [] : ['EXPECTED_MARKER_MISSING']),
    ...(outputShapeValid ? [] : ['NATIVE_OUTPUT_SHAPE_MISMATCH']),
    ...(providerShapeValid ? [] : ['PROVIDER_OBSERVATION_MISMATCH']),
    ...(rawInput.loopbackOnly ? [] : ['NETWORK_BOUNDARY_VIOLATION']),
    ...(rawInput.repositoryBeforeDigest === rawInput.repositoryAfterDigest ? [] : ['REPOSITORY_MUTATION_OBSERVED']),
    ...(rawInput.orphanCount === 0 ? [] : ['ORPHAN_PROCESS_OBSERVED'])
  ].sort(compare);
  const observation = {
    schemaVersion: 1,
    hostId: 'opencode',
    operationId: operation.operationId,
    action: operation.action,
    binarySha256: operation.binarySha256,
    inputDigest: operation.inputDigest,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    normalizedOutputDigest,
    providerRequestCount: rawInput.providerRequestCount,
    providerRequestDigest: rawInput.providerRequestDigest,
    providerPhases: [...rawInput.providerPhases],
    nativeEventTypes: [...rawInput.nativeEventTypes],
    repositoryBeforeDigest: rawInput.repositoryBeforeDigest,
    repositoryAfterDigest: rawInput.repositoryAfterDigest,
    allowedStateDigest: rawInput.allowedStateDigest,
    markerObserved,
    loopbackOnly: rawInput.loopbackOnly,
    orphanCount: rawInput.orphanCount,
    nativeOutcome: reasonCodes.length === 0 ? 'MATCH' : 'MISMATCH',
    reasonCodes
  };
  return immutable({ observation, observationDigest: recordDigest(observation) });
}

function bindHostInstance(input) {
  const code = 'KSTACK_OPENCODE_PORT_HOST_BINDING_INVALID';
  exact(input, ['hostInstanceDigest', 'hostBuildDigest', 'adapterDigest'], code);
  for (const value of Object.values(input)) digest(value, code);
  return immutable({ bindingDigest: recordDigest(input) });
}
function bindRepositoryContext(input) {
  const code = 'KSTACK_OPENCODE_PORT_REPOSITORY_BINDING_INVALID';
  exact(input, ['repositoryDigest', 'workspaceRootDigest', 'instructionRootDigest'], code);
  for (const value of Object.values(input)) digest(value, code);
  return immutable({ bindingDigest: recordDigest(input) });
}
function discoverInstructionProjection(input) {
  const code = 'KSTACK_OPENCODE_PORT_PROJECTION_INVALID';
  exact(input, ['packageDigest', 'skillDigest', 'projectionKind', 'nativePathDigest'], code);
  for (const field of ['packageDigest', 'skillDigest', 'nativePathDigest']) digest(input[field], code);
  if (input.projectionKind !== 'PROJECT_OPENCODE_SKILL') fail(code);
  noForbiddenKeys(input, code);
  return immutable({ observationDigest: recordDigest(input) });
}
function observeNativeAction(input) {
  const code = 'KSTACK_OPENCODE_PORT_NATIVE_ACTION_INVALID';
  exact(input, ['operationId', 'nativeActionDigest', 'nativeEventDigest'], code);
  text(input.operationId, code, ID, 128); digest(input.nativeActionDigest, code); digest(input.nativeEventDigest, code);
  noForbiddenKeys(input, code);
  return immutable({ observationDigest: recordDigest(input) });
}
function requestNativeApprovalDisplay(input) {
  const code = 'KSTACK_OPENCODE_PORT_APPROVAL_DISPLAY_INVALID';
  exact(input, ['operationId', 'displayArtifactDigest', 'displayNonceDigest'], code);
  text(input.operationId, code, ID, 128); digest(input.displayArtifactDigest, code); digest(input.displayNonceDigest, code);
  noForbiddenKeys(input, code);
  return immutable({ displayRequestDigest: recordDigest(input), grantsAuthority: false });
}
function routeProtectedBroker(input) {
  const code = 'KSTACK_OPENCODE_PORT_BROKER_ROUTE_INVALID';
  exact(input, ['operationId', 'brokerTicketDigest', 'providerClass'], code);
  text(input.operationId, code, ID, 128); digest(input.brokerTicketDigest, code);
  if (input.providerClass !== 'SYNTHETIC_LOOPBACK_NO_CREDENTIAL') fail(code);
  noForbiddenKeys(input, code);
  return immutable({ routeDigest: recordDigest(input), carriesCredential: false });
}
function observeProcessLifecycle(input) {
  const code = 'KSTACK_OPENCODE_PORT_PROCESS_LIFECYCLE_INVALID';
  exact(input, ['operationId', 'processDigest', 'event', 'orphanCount'], code);
  text(input.operationId, code, ID, 128); digest(input.processDigest, code);
  if (!['STARTED', 'EXITED', 'CANCELLED'].includes(input.event)) fail(code);
  integer(input.orphanCount, code, 0, 1024);
  return immutable({ observationDigest: recordDigest(input) });
}
function observeStructuredOutput(input) {
  const code = 'KSTACK_OPENCODE_PORT_STRUCTURED_OUTPUT_INVALID';
  exact(input, ['operationId', 'outputDigest', 'schemaDigest'], code);
  text(input.operationId, code, ID, 128); digest(input.outputDigest, code); digest(input.schemaDigest, code);
  noForbiddenKeys(input, code);
  return immutable({ observationDigest: recordDigest(input) });
}
function observeCancellation(input) {
  const code = 'KSTACK_OPENCODE_PORT_CANCELLATION_INVALID';
  exact(input, ['operationId', 'requestDigest', 'nativeCancellationDigest', 'observed'], code);
  text(input.operationId, code, ID, 128); digest(input.requestDigest, code); digest(input.nativeCancellationDigest, code); bool(input.observed, code);
  return immutable({ observationDigest: recordDigest(input) });
}

export const OPENCODE_ADAPTER_BOUNDARY = Object.freeze({
  bindHostInstance, bindRepositoryContext, discoverInstructionProjection,
  observeNativeAction, requestNativeApprovalDisplay, routeProtectedBroker,
  observeProcessLifecycle, observeStructuredOutput, observeCancellation
});
