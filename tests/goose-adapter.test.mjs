import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
  GOOSE_ADAPTER_ACTIONS,
  GOOSE_ADAPTER_BOUNDARY,
  GOOSE_ADAPTER_PORTS,
  GOOSE_ADAPTER_PROFILE,
  buildGooseInvocation,
  observeGooseExecution,
  validateGooseAdapterDescriptor,
  validateGooseOperation
} from '../plugins/kstack/scripts/kstack-goose-adapter.mjs';
import { validateGooseIsolatedEvidence } from '../.kstack/qualifications/validate-goose-v1.48.0-isolated-cell.mjs';

const H = (character) => character.repeat(64);
const nodeSha = crypto.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex');

function operation(action = 'VERSION', overrides = {}) {
  return {
    schemaVersion: 1,
    operationId: `goose.${action.toLowerCase()}.v1`,
    action,
    binaryPath: process.execPath,
    binarySha256: nodeSha,
    repositoryRoot: '/tmp/kstack-goose-cell/repository',
    pathRoot: '/tmp/kstack-goose-cell/path-root',
    inputDigest: H('1'),
    expectedMarker: action === 'ADVISORY' ? 'KSTACK_GOOSE_ADVISORY_OK' : 'goose 1.48.0',
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
    stdout: 'goose 1.48.0\n',
    stderr: '',
    providerRequestCount: 0,
    providerRequestDigest: null,
    loopbackOnly: true,
    rootMutationDigest: H('3'),
    orphanCount: 0,
    ...overrides
  };
}

function descriptor() {
  return {
    schemaVersion: 1,
    hostId: 'goose',
    hostVersion: '1.48.0',
    hostBuildDigest: H('1'),
    binarySha256: H('2'),
    sourceManifestDigest: H('3'),
    adapterDigest: H('4'),
    projectionPlanDigest: H('5'),
    nativeEventSchemaDigest: H('6'),
    bypassInventoryDigest: H('7'),
    environmentProfileDigest: H('8'),
    fixtureMappingDigest: H('9'),
    ports: [...GOOSE_ADAPTER_PORTS]
  };
}

function code(expected, action) {
  assert.throws(action, (error) => error?.code === expected);
}

test('Goose adapter exposes only the nine HostAdapterBoundaryV1 ports', () => {
  assert.deepEqual(Object.keys(GOOSE_ADAPTER_BOUNDARY), [...GOOSE_ADAPTER_PORTS]);
  assert.deepEqual(GOOSE_ADAPTER_ACTIONS, ['ADVISORY', 'HELP', 'SKILLS_LIST', 'VERSION']);
  assert.equal(GOOSE_ADAPTER_PROFILE.maximumClaim, 'ADVISORY_PUBLIC_READ_ONLY');
  assert.deepEqual(validateGooseAdapterDescriptor(descriptor()).ports, [...GOOSE_ADAPTER_PORTS]);
  code('KSTACK_GOOSE_ADAPTER_DESCRIPTOR_INVALID', () => validateGooseAdapterDescriptor({ ...descriptor(), policy: 'allow' }));
});

test('invocation is exact, no-session, no-profile, loopback-only, and credential-free', () => {
  const advisory = buildGooseInvocation(operation('ADVISORY'), {
    loopbackEndpoint: 'http://127.0.0.1:49152',
    verifyBinary: true
  });
  assert.deepEqual(advisory.args.slice(0, 7), ['run', '--no-session', '--no-profile', '--quiet', '--output-format', 'json', '--provider']);
  assert.equal(advisory.args.includes('--with-extension'), false);
  assert.equal(advisory.env.OPENAI_HOST, 'http://127.0.0.1:49152');
  assert.equal(Object.keys(advisory.env).some((key) => /KEY|SECRET|TOKEN|PASSWORD/u.test(key)), false);
  assert.equal(advisory.env.GOOSE_TELEMETRY_OFF, '1');
  assert.equal(advisory.cwd, operation('ADVISORY').repositoryRoot);
  assert.deepEqual(advisory.args.slice(-2), ['--text', 'Return only KSTACK_GOOSE_ADVISORY_OK.']);
  const markerBound = buildGooseInvocation(operation('ADVISORY', { expectedMarker: 'KSTACK_GOOSE_DIFFERENT_MARKER' }), {
    loopbackEndpoint: 'http://127.0.0.1:49152', verifyBinary: true
  });
  assert.deepEqual(markerBound.args.slice(-2), ['--text', 'Return only KSTACK_GOOSE_DIFFERENT_MARKER.']);
  code('KSTACK_GOOSE_ADAPTER_BINDING_INVALID', () => buildGooseInvocation(operation('ADVISORY'), {
    loopbackEndpoint: 'https://api.openai.com', verifyBinary: true
  }));
  code('KSTACK_GOOSE_ADAPTER_OPERATION_INVALID', () => validateGooseOperation(operation('ADVISORY', { brokerTicketDigest: null })));
});

test('non-provider native observations require exact markers and no provider requests', () => {
  const pass = observeGooseExecution(operation('VERSION'), raw());
  assert.equal(pass.observation.nativeOutcome, 'MATCH');
  assert.equal(pass.observation.markerObserved, true);
  assert.match(pass.observationDigest, /^[a-f0-9]{64}$/u);
  const mismatch = observeGooseExecution(operation('VERSION'), raw({ providerRequestCount: 1, providerRequestDigest: H('4') }));
  assert.equal(mismatch.observation.nativeOutcome, 'MISMATCH');
  assert.ok(mismatch.observation.reasonCodes.includes('PROVIDER_OBSERVATION_MISMATCH'));
});

test('advisory observation requires the native title plus advisory requests and structured expected output', () => {
  const value = raw({
    stdout: JSON.stringify({ messages: [{ role: 'assistant', content: [{ type: 'text', text: 'KSTACK_GOOSE_ADVISORY_OK' }] }], metadata: { status: 'completed' } }),
    providerRequestCount: 2,
    providerRequestDigest: H('4')
  });
  const pass = observeGooseExecution(operation('ADVISORY'), value);
  assert.equal(pass.observation.nativeOutcome, 'MATCH');
  assert.equal(pass.observation.markerObserved, true);
  const wrong = observeGooseExecution(operation('ADVISORY'), { ...value, stdout: JSON.stringify({ result: 'wrong' }) });
  assert.ok(wrong.observation.reasonCodes.includes('EXPECTED_MARKER_MISSING'));
});

test('output parser rejects credential and terminal-control bytes', () => {
  code('KSTACK_GOOSE_ADAPTER_OUTPUT_SECRET', () => observeGooseExecution(operation('VERSION'), raw({ stdout: 'password=hunter2' })));
  code('KSTACK_GOOSE_ADAPTER_OUTPUT_TERMINAL_ESCAPE', () => observeGooseExecution(operation('VERSION'), raw({ stdout: '\u001b[2Jgoose 1.48.0' })));
});

test('port projections observe native data but cannot accept authority, eligibility, retry, or secrets', () => {
  const host = GOOSE_ADAPTER_BOUNDARY.bindHostInstance({ hostInstanceDigest: H('1'), hostBuildDigest: H('2'), adapterDigest: H('3') });
  assert.match(host.bindingDigest, /^[a-f0-9]{64}$/u);
  const display = GOOSE_ADAPTER_BOUNDARY.requestNativeApprovalDisplay({ operationId: 'goose.advisory.v1', displayArtifactDigest: H('4'), displayNonceDigest: H('5') });
  assert.equal(display.grantsAuthority, false);
  const route = GOOSE_ADAPTER_BOUNDARY.routeProtectedBroker({ operationId: 'goose.advisory.v1', brokerTicketDigest: H('6'), providerClass: 'SYNTHETIC_LOOPBACK_NO_CREDENTIAL' });
  assert.equal(route.carriesCredential, false);
  code('KSTACK_GOOSE_PORT_PROJECTION_INVALID', () => GOOSE_ADAPTER_BOUNDARY.discoverInstructionProjection({
    packageDigest: H('1'), skillDigest: H('2'), projectionKind: 'PROJECT_AGENT_SKILL', nativePathDigest: H('3'), authority: 'allow'
  }));
  code('KSTACK_GOOSE_PORT_BROKER_ROUTE_INVALID', () => GOOSE_ADAPTER_BOUNDARY.routeProtectedBroker({
    operationId: 'goose.advisory.v1', brokerTicketDigest: H('6'), providerClass: 'OPENAI', secret: 'value'
  }));
});

test('the generic host contract contains no OpenCode or Goose source branch', () => {
  const source = fs.readFileSync(new URL('../plugins/kstack/scripts/kstack-host-contract.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:opencode|goose)\b/iu);
});

test('durable isolated evidence is closed-schema, internally bound, and tamper evident', () => {
  const evidence = JSON.parse(fs.readFileSync(new URL('../.kstack/qualifications/goose-v1.48.0-isolated-cell-evidence.json', import.meta.url), 'utf8'));
  assert.equal(validateGooseIsolatedEvidence(evidence).aggregate, 'PASS');
  const changed = structuredClone(evidence);
  changed.observations[3].observation.providerRequestCount = 3;
  assert.throws(() => validateGooseIsolatedEvidence(changed), (error) => error?.code === 'KSTACK_GOOSE_ISOLATED_OBSERVATION_INVALID');
  assert.throws(() => validateGooseIsolatedEvidence({ ...evidence, rawResponse: 'not permitted' }), (error) => error?.code === 'KSTACK_GOOSE_ISOLATED_EVIDENCE_INVALID');
});
