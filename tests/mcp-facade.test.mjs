import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hostAddress, hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  PUBLIC_MCP_METHODS,
  PublicMcpFacade,
  PublicMcpProtocolSession,
  parseMcpJsonFrame,
  runPublicMcpStdio,
  validateMcpFacadeProfile,
  validateMcpLaunchEvidence,
  validateMcpPublicProjectionPolicy,
  validateMcpRepositoryBinding
} from '../plugins/kstack/scripts/kstack-mcp-boundary.mjs';

const D = (character) => `sha256:${character.repeat(64)}`;
const SCHEMA = D('a');

function projectionPolicy() {
  return {
    schemaId: 'kstack.mcp-public-projection-policy.v1', schemaVersion: 1,
    rows: ['schema', 'registry', 'package-manifest', 'host-candidate-status', 'status-current'].map((ruleId) => ({
      ruleId, sourceSchemaDigest: D('b'), outputSchemaDigest: D('c'),
      fields: [{ fieldId: 'status', valueType: 'STRING', maxStringBytes: 64 }], replacementCodes: ['UNAVAILABLE'],
      maxDepth: 4, maxFields: 16, maxCollectionItems: 0
    }))
  };
}

function profile(overrides = {}) {
  return {
    schemaId: 'kstack.mcp-facade-profile.v1', schemaVersion: 1, profileId: 'public-readonly-v1',
    protocolVersion: 'mcp-2025-06-18', transport: 'STDIO', principalMode: 'UNAUTHENTICATED_LOCAL_READER',
    allowedRequestMethods: [...PUBLIC_MCP_METHODS], allowedNotifications: ['notifications/initialized', 'notifications/cancelled'],
    maxFrameBytes: 65_536, maxConcurrentRequests: 2, maxQueuedRequests: 2, requestDeadlineMs: 5_000,
    maxResourceBytes: 32_768, maxListPageItems: 4, maxListResources: 64, maxSnapshotLeases: 4,
    maxSnapshotLeaseBytes: 131_072, maxSnapshotLeaseLifetimeMs: 60_000, ...overrides
  };
}

function catalog(profileDigest) {
  const policyDigest = validateMcpPublicProjectionPolicy(projectionPolicy()).policyDigest;
  return {
    schemaId: 'kstack.mcp-resource-catalog.v1', schemaVersion: 1,
    profileDigest, projectionPolicyDigest: policyDigest,
    rules: ['schema', 'registry', 'package-manifest', 'host-candidate-status', 'status-current'].map((ruleId, index) => ({
      ruleId, kind: index < 3 ? 'IMMUTABLE_OBJECT' : 'CURRENT_STATUS', mediaType: 'application/json', sourceSchemaDigest: D('b'), projectionSchemaDigest: D('c'),
      maximumClassification: 'PUBLIC_REPOSITORY_METADATA', maxBytes: 32_768
    }))
  };
}

function snapshot(profileOverrides = {}) {
  const profileDigest = validateMcpFacadeProfile(profile(profileOverrides)).profileDigest;
  const policyDigest = validateMcpPublicProjectionPolicy(projectionPolicy()).policyDigest;
  const resourceCatalogDigest = hostAddress('KSTACK-MCP-RESOURCE-CATALOG-V1', catalog(profileDigest));
  const inputs = [
    ['schema.one', `kstack://schema/${'1'.repeat(64)}`, 'Schema one', D('1')],
    ['schema.two', `kstack://schema/${'2'.repeat(64)}`, 'Schema two', D('2')],
    ['registry.active', `kstack://registry/${'3'.repeat(64)}`, 'Registry', D('3')],
    ['package.manifest', `kstack://package/${'5'.repeat(64)}/manifest`, 'Package manifest', D('5')],
    ['host.candidate', 'kstack://host/opencode/candidate-status', 'OpenCode candidate', null],
    ['status.current', 'kstack://status/current', 'Current status', null]
  ];
  const resources = inputs.map(([resourceId, logicalUri, name, sourceDigest], index) => ({
    resourceId, logicalUri, name, mediaType: 'application/json', sourceDigest,
    sourceObjectDigest: sourceDigest ?? D(index === 4 ? 'd' : 'e'), sourceSchemaDigest: D('b'),
    source: { status: 'UNAVAILABLE', protectedPath: '/home/ignored-before-projection' }
  }));
  const resourceInventoryDigest = hostAddress('KSTACK-MCP-RESOURCE-INVENTORY-V1', resources.map((resource, index) => ({
    resourceId: resource.resourceId, sourceDigest: resource.sourceDigest, name: resource.name, mediaType: resource.mediaType,
    ruleId: index < 2 ? 'schema' : ['registry', 'package-manifest', 'host-candidate-status', 'status-current'][index - 2]
  })));
  const facts = {
    profileDigest, repositoryBindingDigest: D('6'), openedRootIdentityDigest: D('8'), activeSetDigest: D('9'),
    registrySetDigest: D('3'), packageDigest: D('5'), resourceCatalogDigest, projectionPolicyDigest: policyDigest,
    candidateStatusBodyDigest: D('d'), orderedSourceObjectDigests: resources.map((resource) => resource.sourceObjectDigest),
    authoritativeReadSequence: 1, observedAtUtc: '2026-08-29T06:00:00.000Z', expiresAtUtc: '2026-08-29T06:01:00.000Z'
  };
  return { ...facts, snapshotDigest: hostAddress('KSTACK-MCP-READ-SNAPSHOT-V1', facts), resourceInventoryDigest, resources };
}

function fixture({ profileOverrides = {}, freezeSnapshot, macByte = 7 } = {}) {
  let now = '2026-08-29T06:00:10.000Z'; let valid = true;
  const selectedProfile = profile(profileOverrides); const profileDigest = validateMcpFacadeProfile(selectedProfile).profileDigest;
  const backend = {
    descriptor: { protectionClass: 'test-only', repositoryWritable: false, agentWritable: false, readOnlyHandles: true, noNetwork: true, noChildren: true, launchEvidenceDigest: D('7'), repositoryBindingDigest: D('6'), openedRootIdentityDigest: D('8') },
    freezeSnapshot: freezeSnapshot ?? (async () => snapshot(profileOverrides)),
    revalidateSnapshot: async () => valid,
    trustedTime: async () => now
  };
  const facade = new PublicMcpFacade({
    profile: selectedProfile, catalog: catalog(profileDigest), projectionPolicy: projectionPolicy(), backend,
    macKey: Buffer.alloc(32, macByte), allowTestBackend: true
  });
  const session = new PublicMcpProtocolSession({ facade, correlationKey: Buffer.alloc(32, 9), allowTestKey: true });
  return { facade, session, setTime: (value) => { now = value; }, setValid: (value) => { valid = value; } };
}

const frame = (value) => Buffer.from(JSON.stringify(value));
const request = (id, method, params = {}) => frame({ jsonrpc: '2.0', id, method, params });
const notify = (method, params = {}) => frame({ jsonrpc: '2.0', method, params });

async function initialize(session) {
  const initialized = await session.handleFrame(request(1, 'initialize', { protocolVersion: 'mcp-2025-06-18', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } }));
  assert.equal(initialized.result.protocolVersion, 'mcp-2025-06-18');
  assert.deepEqual(initialized.result.capabilities, { resources: { subscribe: false, listChanged: false } });
  assert.equal(await session.handleFrame(notify('notifications/initialized')), null);
}

test('bounded JSON parser accepts protocol JSON while rejecting duplicate, oversized, deep, nonintegral, and invalid UTF-8 input', () => {
  const limits = { maxFrameBytes: 256, maxDepth: 4, maxNodes: 32, maxCollectionItems: 8, maxStringBytes: 32 };
  assert.deepEqual(parseMcpJsonFrame(Buffer.from(' { "a" : 1, "b" : [true, null] } '), limits), { a: 1, b: [true, null] });
  assert.throws(() => parseMcpJsonFrame(Buffer.from('{"a":1,"a":2}'), limits), { code: 'KSTACK_MCP_FRAME_DUPLICATE_KEY' });
  assert.throws(() => parseMcpJsonFrame(Buffer.alloc(257, 0x20), limits), { code: 'KSTACK_MCP_FRAME_INVALID' });
  assert.throws(() => parseMcpJsonFrame(Buffer.from('[[[[[0]]]]]'), limits), { code: 'KSTACK_MCP_FRAME_INVALID' });
  assert.throws(() => parseMcpJsonFrame(Buffer.from('{"a":1.5}'), limits), { code: 'KSTACK_MCP_FRAME_INVALID' });
  assert.throws(() => parseMcpJsonFrame(Buffer.from([0xff]), limits), { code: 'KSTACK_MCP_FRAME_INVALID' });
});

test('launch evidence and repository binding construct in one acyclic exact digest order', () => {
  const selectedProfile = validateMcpFacadeProfile(profile());
  const selectedPolicy = validateMcpPublicProjectionPolicy(projectionPolicy());
  const selectedCatalog = catalog(selectedProfile.profileDigest);
  const launch = validateMcpLaunchEvidence({
    schemaId: 'kstack.mcp-launch-evidence.v1', schemaVersion: 1, executableDigest: D('1'), confinementProfileDigest: D('2'),
    openedHandleIdentityDigests: [D('3'), D('4')], launchNonceDigest: D('5'), observedAtUtc: '2026-08-29T06:00:00.000Z',
    expiresAtUtc: '2026-08-29T06:05:00.000Z', transport: 'STDIO', writableFilesystem: false, network: false,
    children: false, inheritedDescriptorCount: 0
  });
  const binding = validateMcpRepositoryBinding({
    schemaId: 'kstack.mcp-repository-binding.v1', schemaVersion: 1, canonicalRepositoryIdentityDigest: D('6'), openedRootIdentityDigest: D('7'),
    activeSetDigest: D('8'), registrySetDigest: D('9'), profileDigest: selectedProfile.profileDigest,
    projectionPolicyDigest: selectedPolicy.policyDigest, resourceCatalogDigest: hostAddress('KSTACK-MCP-RESOURCE-CATALOG-V1', selectedCatalog),
    launchEvidenceDigest: launch.launchEvidenceDigest
  });
  assert.match(binding.repositoryBindingDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(JSON.stringify(binding.binding).includes(binding.repositoryBindingDigest), false);
  assert.equal(JSON.stringify(launch.evidence).includes(launch.launchEvidenceDigest), false);
  assert.throws(() => validateMcpLaunchEvidence({ ...launch.evidence, network: true }), { code: 'KSTACK_MCP_LAUNCH_EVIDENCE_INVALID' });
  assert.throws(() => validateMcpRepositoryBinding({ ...binding.binding, repositoryBindingDigest: binding.repositoryBindingDigest }), { code: 'KSTACK_MCP_REPOSITORY_BINDING_INVALID' });
});

test('independent Python oracle matches exact profile, policy, catalog, launch, repository, and snapshot addresses', () => {
  const profileBody = profile(); const profileDigest = validateMcpFacadeProfile(profileBody).profileDigest;
  const policyBody = projectionPolicy(); const policyDigest = validateMcpPublicProjectionPolicy(policyBody).policyDigest;
  const catalogBody = catalog(profileDigest);
  const launchBody = {
    schemaId: 'kstack.mcp-launch-evidence.v1', schemaVersion: 1, executableDigest: D('1'), confinementProfileDigest: D('2'),
    openedHandleIdentityDigests: [D('3'), D('4')], launchNonceDigest: D('5'), observedAtUtc: '2026-08-29T06:00:00.000Z',
    expiresAtUtc: '2026-08-29T06:05:00.000Z', transport: 'STDIO', writableFilesystem: false, network: false,
    children: false, inheritedDescriptorCount: 0
  };
  const launchDigest = validateMcpLaunchEvidence(launchBody).launchEvidenceDigest;
  const repositoryBody = {
    schemaId: 'kstack.mcp-repository-binding.v1', schemaVersion: 1, canonicalRepositoryIdentityDigest: D('6'), openedRootIdentityDigest: D('7'),
    activeSetDigest: D('8'), registrySetDigest: D('9'), profileDigest, projectionPolicyDigest: policyDigest,
    resourceCatalogDigest: hostAddress('KSTACK-MCP-RESOURCE-CATALOG-V1', catalogBody), launchEvidenceDigest: launchDigest
  };
  const frozen = snapshot();
  const snapshotBody = Object.fromEntries(Object.entries(frozen).filter(([key]) => !['snapshotDigest', 'resourceInventoryDigest', 'resources'].includes(key)));
  const vectors = [
    ['KSTACK-MCP-FACADE-PROFILE-V1', profileBody], ['KSTACK-MCP-PUBLIC-PROJECTION-POLICY-V1', policyBody],
    ['KSTACK-MCP-RESOURCE-CATALOG-V1', catalogBody], ['KSTACK-MCP-LAUNCH-EVIDENCE-V1', launchBody],
    ['KSTACK-MCP-REPOSITORY-BINDING-V1', repositoryBody], ['KSTACK-MCP-READ-SNAPSHOT-V1', snapshotBody]
  ].map(([domain, body]) => ({ domain, body }));
  const oracle = fileURLToPath(new URL('./helpers/mcp-facade-python-oracle.py', import.meta.url));
  const result = spawnSync('python3', [oracle], { input: JSON.stringify({ vectors }), encoding: 'utf8', timeout: 5_000, maxBuffer: 1_048_576 });
  assert.equal(result.status, 0, result.stderr); const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.results.map((entry) => entry.address), vectors.map((vector) => hostAddress(vector.domain, vector.body)));
  assert.deepEqual(parsed.results.map((entry) => entry.canonicalHex), vectors.map((vector) => hostCanonicalBytes(vector.body).toString('hex')));
});

test('JSON-RPC session advertises only public resources and preserves list-to-read snapshot identity', async () => {
  const { session, setTime } = fixture(); await initialize(session);
  const listed = await session.handleFrame(request(2, 'resources/list'));
  assert.equal(listed.result.resources.length, 4); assert.equal(typeof listed.result.nextCursor, 'string');
  const token = listed.result.resources[0].uri.split('/snapshot/')[1];
  const envelope = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(envelope.fields), ['expiresAt', 'leaseId', 'repositoryBindingDigest', 'resourceInventoryDigest', 'schemaVersion', 'snapshotDigest']);
  assert.equal(JSON.stringify(envelope).includes('scopedResourceListDigest'), false);
  const second = await session.handleFrame(request(3, 'resources/list', { cursor: listed.result.nextCursor }));
  const all = [...listed.result.resources, ...second.result.resources]; assert.equal(all.length, 6);
  setTime('2026-08-29T06:00:40.000Z');
  const read = await session.handleFrame(request(4, 'resources/read', { uri: all.at(-1).uri }));
  const body = JSON.parse(read.result.contents[0].text);
  assert.equal(body.snapshotDigest, snapshot().snapshotDigest); assert.equal(body.maximumClaim, 'READ_ONLY_NON_QUALIFYING');
  assert.equal(JSON.stringify(read).includes('SUPPORTED'), false); session.close();
});

test('protocol error mapping is fixed, duplicate keys are invalid-request, and identity claims never promote the principal', async () => {
  const { session } = fixture();
  const duplicate = await session.handleFrame(Buffer.from('{"jsonrpc":"2.0","id":1,"id":2,"method":"ping"}'));
  assert.equal(duplicate.error.code, -32600); assert.equal(duplicate.id, null);
  const malformed = await session.handleFrame(Buffer.from('{'));
  assert.equal(malformed.error.code, -32700); assert.equal(malformed.error.message, 'Parse error');
  const batch = await session.handleFrame(frame([{ jsonrpc: '2.0', id: 1, method: 'ping' }]));
  assert.equal(batch.error.code, -32600);
  const unknown = await session.handleFrame(request(3, 'tools/call', { path: '/private/value' }));
  assert.equal(unknown.error.code, -32601); assert.equal(JSON.stringify(unknown).includes('/private/value'), false);
  const initialized = await session.handleFrame(request(4, 'initialize', {
    protocolVersion: 'mcp-2025-06-18', capabilities: { roots: { listChanged: true }, sampling: {} },
    clientInfo: { name: 'authority-claim', version: '999' }
  }));
  assert.deepEqual(initialized.result.capabilities, { resources: { subscribe: false, listChanged: false } });
  assert.equal(JSON.stringify(initialized).includes('authority-claim'), false);
  assert.equal(await session.handleFrame(notify('notifications/initialized')), null);
  const malformedUri = await session.handleFrame(request(5, 'resources/read', { uri: 'kstack://status/../private' }));
  assert.equal(malformedUri.error.code, -32001); assert.equal(JSON.stringify(malformedUri).includes('../private'), false); session.close();
});

test('snapshot address, repository binding, source order, and source schema drift fail before visibility', async () => {
  for (const mutate of [
    (value) => { value.activeSetDigest = D('0'); },
    (value) => { value.repositoryBindingDigest = D('0'); },
    (value) => { value.orderedSourceObjectDigests = [...value.orderedSourceObjectDigests].reverse(); },
    (value) => { value.resources[0].sourceSchemaDigest = D('0'); }
  ]) {
    const candidate = snapshot(); mutate(candidate);
    const { session } = fixture({ freezeSnapshot: async () => candidate }); await initialize(session);
    const response = await session.handleFrame(request(20, 'resources/list'));
    assert.equal(response.error.code, -32005); assert.equal(response.error.message, 'Resource snapshot unavailable'); session.close();
  }
});

test('leased public bodies stay immutable across later status changes and never expose unprojected source fields', async () => {
  const candidate = snapshot({ maxListPageItems: 64 });
  const { session } = fixture({ profileOverrides: { maxListPageItems: 64 }, freezeSnapshot: async () => candidate }); await initialize(session);
  const listed = await session.handleFrame(request(30, 'resources/list'));
  const candidateUri = listed.result.resources.find((resource) => resource.uri.includes('/host/opencode/')).uri;
  candidate.resources[4].source.status = 'CANDIDATE_INVALIDATED';
  candidate.resources[4].source.protectedPath = '/home/changed-after-list';
  const read = await session.handleFrame(request(31, 'resources/read', { uri: candidateUri }));
  const body = JSON.parse(read.result.contents[0].text);
  assert.equal(body.payload.status, 'UNAVAILABLE'); assert.equal(JSON.stringify(body).includes('protectedPath'), false); session.close();
});

test('lease-count, lease-byte, and backend-exception exhaustion paths are bounded fixed errors with no diagnostic echo', async () => {
  const countBound = fixture({ profileOverrides: { maxSnapshotLeases: 1, maxListPageItems: 64 } }); await initialize(countBound.session);
  assert.ok((await countBound.session.handleFrame(request(40, 'resources/list'))).result.resources.length > 0);
  const countFailure = await countBound.session.handleFrame(request(41, 'resources/list'));
  assert.equal(countFailure.error.code, -32006); countBound.session.close();

  const byteBound = fixture({ profileOverrides: { maxSnapshotLeaseBytes: 512, maxListPageItems: 64 } }); await initialize(byteBound.session);
  assert.equal((await byteBound.session.handleFrame(request(42, 'resources/list'))).error.code, -32006); byteBound.session.close();

  const exception = fixture({ freezeSnapshot: async () => { throw new Error('/home/private password=never-serialize-this'); } }); await initialize(exception.session);
  const failure = await exception.session.handleFrame(request(43, 'resources/list'));
  assert.equal(failure.error.code, -32603); assert.equal(failure.error.message, 'Internal error');
  assert.equal(JSON.stringify(failure).includes('private'), false); assert.equal(JSON.stringify(failure).includes('password'), false); exception.session.close();
});

test('concurrency, queue, cancellation, and deadline behavior are bounded and fail closed', async () => {
  const never = new Promise(() => {});
  const { session } = fixture({ profileOverrides: { maxConcurrentRequests: 1, maxQueuedRequests: 1, requestDeadlineMs: 50 }, freezeSnapshot: async () => never });
  await initialize(session);
  const first = session.handleFrame(request(10, 'resources/list'));
  const second = session.handleFrame(request(11, 'resources/list'));
  const third = await session.handleFrame(request(12, 'resources/list'));
  assert.equal(third.error.code, -32006); assert.equal(third.error.message, 'Rate limited');
  assert.equal(await session.handleFrame(notify('notifications/cancelled', { requestId: 11, reason: 'operator request' })), null);
  assert.equal((await second).error.code, -32007);
  assert.equal((await first).error.code, -32007);
  session.close();
});

test('cancelled work retains its concurrency slot until the underlying task settles', async () => {
  const resolvers = [];
  let starts = 0;
  const { session } = fixture({
    profileOverrides: { maxConcurrentRequests: 1, maxQueuedRequests: 1, requestDeadlineMs: 5_000 },
    freezeSnapshot: async () => {
      starts += 1;
      return new Promise((resolve) => resolvers.push(resolve));
    }
  });
  await initialize(session);
  const first = session.handleFrame(request(13, 'resources/list'));
  const second = session.handleFrame(request(14, 'resources/list'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(starts, 1);
  assert.equal(await session.handleFrame(notify('notifications/cancelled', { requestId: 13, reason: 'operator request' })), null);
  assert.equal((await first).error.code, -32007);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(starts, 1);
  resolvers.shift()(snapshot({ maxConcurrentRequests: 1, maxQueuedRequests: 1, requestDeadlineMs: 5_000 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(starts, 2);
  resolvers.shift()(snapshot({ maxConcurrentRequests: 1, maxQueuedRequests: 1, requestDeadlineMs: 5_000 }));
  assert.ok((await second).result.resources.length > 0);
  session.close();
});

test('stdio loop emits protocol frames only, accepts notifications, and closes on oversized framing without response', async () => {
  const first = fixture(); const writes = []; const diagnostics = [];
  async function* validInput() {
    yield Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 'mcp-2025-06-18', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } } })}\n`);
    yield Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} })}\n`);
  }
  const result = await runPublicMcpStdio({ session: first.session, input: validInput(), writeFrame: async (bytes) => writes.push(Buffer.from(bytes)), fixedDiagnostic: async (code) => diagnostics.push(code) });
  assert.deepEqual(result, { closed: true, fatalFramingError: false }); assert.equal(writes.length, 2); assert.deepEqual(diagnostics, []);
  assert.equal(writes.every((bytes) => bytes.at(-1) === 0x0a && bytes.toString('utf8').split('\n').length === 2), true);
  assert.equal(writes.some((bytes) => bytes.toString('utf8').includes('notifications/initialized')), false);

  const coalesced = fixture({ profileOverrides: { maxFrameBytes: 128 } }); const coalescedWrites = [];
  async function* coalescedInput() {
    const lines = [1, 2, 3].map((id) => JSON.stringify({ jsonrpc: '2.0', id, method: 'ping', params: {} }));
    yield Buffer.from(`${lines.join('\n')}\n`);
  }
  const coalescedResult = await runPublicMcpStdio({ session: coalesced.session, input: coalescedInput(), writeFrame: async (bytes) => coalescedWrites.push(bytes), fixedDiagnostic: async () => assert.fail('unexpected framing diagnostic') });
  assert.equal(coalescedResult.fatalFramingError, false); assert.equal(coalescedWrites.length, 3);

  const second = fixture({ profileOverrides: { maxFrameBytes: 128 } }); const fatalWrites = []; const fatalDiagnostics = [];
  async function* invalidInput() { yield Buffer.alloc(130, 0x78); }
  const fatal = await runPublicMcpStdio({ session: second.session, input: invalidInput(), writeFrame: async (bytes) => fatalWrites.push(bytes), fixedDiagnostic: async (code) => fatalDiagnostics.push(code) });
  assert.deepEqual(fatal, { closed: true, fatalFramingError: true }); assert.deepEqual(fatalWrites, []); assert.deepEqual(fatalDiagnostics, ['KSTACK_MCP_STDIO_FRAME_INVALID']);
});

test('snapshot-scoped URI substitution, expiry, invalidation, and cross-process replay are rejected without lookup echo', async () => {
  const first = fixture(); await initialize(first.session);
  const listed = await first.session.handleFrame(request(2, 'resources/list')); const uri = listed.result.resources[0].uri;
  const substituted = uri.replace('1'.repeat(64), '9'.repeat(64));
  assert.equal((await first.session.handleFrame(request(3, 'resources/read', { uri: substituted }))).error.code, -32001);
  first.setValid(false); assert.equal((await first.session.handleFrame(request(4, 'resources/read', { uri }))).error.code, -32005);
  first.setValid(true); first.setTime('2026-08-29T06:01:00.000Z');
  assert.equal((await first.session.handleFrame(request(5, 'resources/read', { uri }))).error.code, -32004);
  const second = fixture({ macByte: 8 }); await initialize(second.session);
  assert.equal((await second.session.handleFrame(request(6, 'resources/read', { uri }))).error.code, -32001);
  first.session.close(); second.session.close();
});

test('pagination cursor binds the exact token, lease, list, position, repository, and process key', async () => {
  const first = fixture(); await initialize(first.session);
  const listed = await first.session.handleFrame(request(50, 'resources/list')); const cursor = listed.result.nextCursor;
  assert.equal(typeof cursor, 'string');
  const forged = `${cursor.slice(0, -1)}${cursor.endsWith('A') ? 'B' : 'A'}`;
  assert.equal((await first.session.handleFrame(request(51, 'resources/list', { cursor: forged }))).error.code, -32003);
  const second = fixture({ macByte: 8 }); await initialize(second.session);
  assert.equal((await second.session.handleFrame(request(52, 'resources/list', { cursor }))).error.code, -32003);
  first.setValid(false);
  assert.equal((await first.session.handleFrame(request(53, 'resources/list', { cursor }))).error.code, -32003);
  first.session.close(); second.session.close();
});

test('public facade implementation has no filesystem, subprocess, network, process, or fetch authority', () => {
  const source = fs.readFileSync(fileURLToPath(new URL('../plugins/kstack/scripts/kstack-mcp-boundary.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /from ['"]node:(?:fs|fs\/promises|child_process|net|http|https|tls|dgram|dns|worker_threads)['"]/u);
  assert.doesNotMatch(source, /(?:\bfetch\s*\(|(?<!\.)\b(?:spawn|exec|fork)\s*\(|\bprocess\.(?:env|cwd|stdout|stderr)\b)/u);
  assert.equal(PUBLIC_MCP_METHODS.some((method) => method.startsWith('tools/') || method.startsWith('prompts/')), false);
});
