import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
  OPENCODE_ADAPTER_ACTIONS,
  OPENCODE_ADAPTER_BOUNDARY,
  OPENCODE_ADAPTER_PORTS,
  OPENCODE_ADAPTER_PROFILE,
  buildOpenCodeInvocation,
  observeOpenCodeExecution,
  validateOpenCodeAdapterDescriptor,
  validateOpenCodeOperation
} from '../plugins/kstack/scripts/kstack-opencode-adapter.mjs';

const H = (character) => character.repeat(64);
const nodeSha = crypto.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex');

function operation(action = 'VERSION', overrides = {}) {
  return {
    schemaVersion: 1,
    operationId: `opencode.${action.toLowerCase()}.v1`,
    action,
    binaryPath: process.execPath,
    binarySha256: nodeSha,
    repositoryRoot: '/tmp/kstack-opencode-cell/repository',
    pathRoot: '/tmp/kstack-opencode-cell/path-root',
    inputDigest: H('1'),
    expectedMarker: action === 'ADVISORY' ? 'kstack-causal-probe' : action === 'VERSION' ? '1.18.25' : 'kstack-causal-probe',
    brokerTicketDigest: action === 'ADVISORY' ? H('2') : null,
    deadlineMs: 10_000,
    ...overrides
  };
}

function raw(overrides = {}) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    stdout: '1.18.25\n',
    stderr: '',
    providerRequestCount: 0,
    providerRequestDigest: null,
    providerPhases: [],
    nativeEventTypes: [],
    loopbackOnly: true,
    repositoryBeforeDigest: H('3'),
    repositoryAfterDigest: H('3'),
    allowedStateDigest: H('4'),
    orphanCount: 0,
    ...overrides
  };
}

function descriptor() {
  return {
    schemaVersion: 1,
    hostId: 'opencode',
    hostVersion: '1.18.25',
    hostBuildDigest: H('1'),
    binarySha256: H('2'),
    sourceManifestDigest: H('3'),
    adapterDigest: H('4'),
    projectionPlanDigest: H('5'),
    nativeEventSchemaDigest: H('6'),
    bypassInventoryDigest: H('7'),
    environmentProfileDigest: H('8'),
    fixtureMappingDigest: H('9'),
    ports: [...OPENCODE_ADAPTER_PORTS]
  };
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected);
}

test('OpenCode adapter exposes only the nine HostAdapterBoundaryV1 ports', () => {
  assert.deepEqual(Object.keys(OPENCODE_ADAPTER_BOUNDARY), [...OPENCODE_ADAPTER_PORTS]);
  assert.deepEqual(OPENCODE_ADAPTER_ACTIONS, ['ADVISORY', 'SKILL_DISCOVERY', 'VERSION']);
  assert.equal(OPENCODE_ADAPTER_PROFILE.maximumClaim, 'ADVISORY_INSTRUCTION_ONLY');
  assert.deepEqual(validateOpenCodeAdapterDescriptor(descriptor()).ports, [...OPENCODE_ADAPTER_PORTS]);
  code('KSTACK_OPENCODE_ADAPTER_DESCRIPTOR_INVALID', () => validateOpenCodeAdapterDescriptor({ ...descriptor(), policy: 'allow' }));
});

test('OpenCode invocation is pure, loopback-only, deny-by-default, and credential-free', () => {
  const advisory = buildOpenCodeInvocation(operation('ADVISORY'), {
    loopbackEndpoint: 'http://127.0.0.1:49153/v1',
    verifyBinary: true
  });
  assert.deepEqual(advisory.args.slice(0, 6), ['--pure', 'run', '--format', 'json', '--model', 'kstack/kstack-qualification']);
  assert.equal(advisory.args.includes('--auto'), false);
  const config = JSON.parse(advisory.env.OPENCODE_CONFIG_CONTENT);
  assert.deepEqual(config.permission, { '*': 'deny', skill: 'allow' });
  assert.equal(config.provider.kstack.options.baseURL, 'http://127.0.0.1:49153/v1');
  assert.equal(Object.keys(advisory.env).some((key) => /KEY|SECRET|TOKEN|PASSWORD/u.test(key)), false);
  assert.equal(advisory.env.OPENCODE_PURE, '1');
  assert.equal(advisory.cwd, operation('ADVISORY').repositoryRoot);
  code('KSTACK_OPENCODE_ADAPTER_BINDING_INVALID', () => buildOpenCodeInvocation(operation('ADVISORY'), {
    loopbackEndpoint: 'https://api.openai.com/v1', verifyBinary: true
  }));
  code('KSTACK_OPENCODE_ADAPTER_OPERATION_INVALID', () => validateOpenCodeOperation(operation('ADVISORY', { brokerTicketDigest: null })));
});

test('version and discovery observations require exact native output and no provider calls', () => {
  const version = observeOpenCodeExecution(operation('VERSION'), raw());
  assert.equal(version.observation.nativeOutcome, 'MATCH');
  const discoveryRows = [{ name: 'customize-opencode', location: '<built-in>' }, { name: 'kstack-causal-probe', location: '/tmp/SKILL.md' }];
  const discovery = observeOpenCodeExecution(operation('SKILL_DISCOVERY'), raw({ stdout: JSON.stringify(discoveryRows) }));
  assert.equal(discovery.observation.nativeOutcome, 'MATCH');
  const extraProvider = observeOpenCodeExecution(operation('VERSION'), raw({ providerRequestCount: 1, providerRequestDigest: H('5') }));
  assert.ok(extraProvider.observation.reasonCodes.includes('PROVIDER_OBSERVATION_MISMATCH'));
});

test('advisory observation requires exact native events, paired provider phases, preservation, and zero orphans', () => {
  const token = H('a');
  const rows = [
    { type: 'step_start', part: { type: 'step-start' } },
    { type: 'tool_use', part: { type: 'tool', tool: 'skill' } },
    { type: 'step_finish', part: { type: 'step-finish' } },
    { type: 'step_start', part: { type: 'step-start' } },
    { type: 'text', part: { type: 'text', text: token } },
    { type: 'step_finish', part: { type: 'step-finish' } }
  ];
  const events = rows.map((row) => row.type);
  const value = raw({
    stdout: `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    providerRequestCount: 2,
    providerRequestDigest: H('5'),
    providerPhases: ['BEFORE_NATIVE_SKILL_RESULT', 'AFTER_NATIVE_SKILL_RESULT'],
    nativeEventTypes: events
  });
  const pass = observeOpenCodeExecution(operation('ADVISORY'), value);
  assert.equal(pass.observation.nativeOutcome, 'MATCH');
  const changed = observeOpenCodeExecution(operation('ADVISORY'), { ...value, repositoryAfterDigest: H('6') });
  assert.ok(changed.observation.reasonCodes.includes('REPOSITORY_MUTATION_OBSERVED'));
  const orphan = observeOpenCodeExecution(operation('ADVISORY'), { ...value, orphanCount: 1 });
  assert.ok(orphan.observation.reasonCodes.includes('ORPHAN_PROCESS_OBSERVED'));
});

test('OpenCode adapter rejects credential and terminal-control bytes', () => {
  code('KSTACK_OPENCODE_ADAPTER_OUTPUT_SECRET', () => observeOpenCodeExecution(operation('VERSION'), raw({ stdout: 'password=hunter2' })));
  code('KSTACK_OPENCODE_ADAPTER_OUTPUT_TERMINAL_ESCAPE', () => observeOpenCodeExecution(operation('VERSION'), raw({ stdout: '\u001b[2J1.18.25' })));
});

test('OpenCode ports observe native facts but cannot accept authority, eligibility, retry, or secrets', () => {
  const host = OPENCODE_ADAPTER_BOUNDARY.bindHostInstance({ hostInstanceDigest: H('1'), hostBuildDigest: H('2'), adapterDigest: H('3') });
  assert.match(host.bindingDigest, /^[a-f0-9]{64}$/u);
  const display = OPENCODE_ADAPTER_BOUNDARY.requestNativeApprovalDisplay({ operationId: 'opencode.advisory.v1', displayArtifactDigest: H('4'), displayNonceDigest: H('5') });
  assert.equal(display.grantsAuthority, false);
  const route = OPENCODE_ADAPTER_BOUNDARY.routeProtectedBroker({ operationId: 'opencode.advisory.v1', brokerTicketDigest: H('6'), providerClass: 'SYNTHETIC_LOOPBACK_NO_CREDENTIAL' });
  assert.equal(route.carriesCredential, false);
  code('KSTACK_OPENCODE_PORT_PROJECTION_INVALID', () => OPENCODE_ADAPTER_BOUNDARY.discoverInstructionProjection({
    packageDigest: H('1'), skillDigest: H('2'), projectionKind: 'PROJECT_OPENCODE_SKILL', nativePathDigest: H('3'), authority: 'allow'
  }));
  code('KSTACK_OPENCODE_PORT_BROKER_ROUTE_INVALID', () => OPENCODE_ADAPTER_BOUNDARY.routeProtectedBroker({
    operationId: 'opencode.advisory.v1', brokerTicketDigest: H('6'), providerClass: 'OPENAI', secret: 'value'
  }));
});

test('the generic host contract remains free of OpenCode source branching', () => {
  const source = fs.readFileSync(new URL('../plugins/kstack/scripts/kstack-host-contract.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bopencode\b/iu);
});
