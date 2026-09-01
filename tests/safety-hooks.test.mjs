import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  canonicalJson, expectedRemoteOldOidSetDigest, OutboundContentScanStageV1,
  SafetyBroker, SafetyProtocolError, SAFETY_LIMITS, validateCanonicalRequest
} from '../plugins/kstack/scripts/kstack-safety-broker.mjs';
import { createProductionSafetyExecutor, defaultGitPushCredentialPath, SAFETY_EXECUTOR_ERROR_CODES } from '../plugins/kstack/scripts/kstack-safety-executor.mjs';
import { detectHookHost, evaluateSafetyHook, HOOK_INPUT_LIMIT, serializeHookResponse } from '../plugins/kstack/scripts/kstack-safety-hook.mjs';
import { findOutboundSecret, matcherSetV1, MATCHER_VERSION, sanitize } from '../plugins/kstack/scripts/kstack-safety-matchers.mjs';
import { activateSafetyHooks, rollbackSafetyHooks, setSafetyHooksEnabled } from '../plugins/kstack/scripts/kstack-safety-admin.mjs';
import { readActivation } from '../plugins/kstack/scripts/kstack-safety-hook.mjs';

const hex = (value) => value.repeat(64).slice(0, 64);
const TEST_AUTHORITY = Object.freeze({
  inspect: 'allow', edit: 'allow', test: 'allow', commit: 'ask', push: 'ask', pullRequest: 'ask', merge: 'ask',
  deploy: 'deny', deviceInstall: 'deny', destructive: 'ask', externalTicketCreation: 'ask', jiraAdministration: 'ask'
});

function request(action = 'provider-pr-create', overrides = {}) {
  const payloads = {
    'provider-pr-create': { repository: 'AuthorityGate/KStack', title: 'Safety change', body: 'No credential material.', baseRef: 'main', headRef: 'safety' },
    'provider-merge': { repository: 'AuthorityGate/KStack', pullRequestId: '42', method: 'squash', text: '' },
    'jira-ticket-create': { project: 'KSTK', issueType: 'Task', summary: 'Safety change', description: 'No credential material.', fields: { priority: 'Medium' } },
    'git-destructive': { kind: 'reset-hard', paths: ['src/generated.txt'], expectedInventoryDigest: hex('a') },
    'git-push': { updates: [{ sourceOid: '1'.repeat(40), expectedRemoteOldOid: '2'.repeat(40), destinationRef: 'refs/heads/main' }], atomic: false }
  };
  return {
    version: 3, action, sessionId: 'session-1', cellKey: 'claude-linux-default', root: '/tmp/kstack-test-root',
    targetId: action.startsWith('git-') ? 'origin' : 'AuthorityGate/KStack', targetFingerprintDigest: hex('b'),
    policyGeneration: 1, targetGeneration: 1, certificateDigest: hex('c'), payload: payloads[action], ...overrides
  };
}

function currentFor(value) {
  return {
    cellKey: value.cellKey, policyGeneration: value.policyGeneration, targetGeneration: value.targetGeneration,
    targetFingerprintDigest: value.targetFingerprintDigest, certificateDigest: value.certificateDigest,
    remoteOldOidSetDigest: value.action === 'git-push' ? expectedRemoteOldOidSetDigest(value) : null,
    atomicPushSupported: value.action === 'git-push' ? value.payload.atomic : null
  };
}

function writePolicy(root, authority = TEST_AUTHORITY) {
  fs.mkdirSync(path.join(root, '.kstack'), { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, authority }), 'utf8');
  fs.writeFileSync(path.join(root, '.kstack', 'config.json'), bytes, { mode: 0o600 });
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function activeRoot(authority = TEST_AUTHORITY) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-active-'));
  const policyDigest = writePolicy(root, authority);
  fs.writeFileSync(path.join(root, '.kstack', 'safety-hooks.json'), JSON.stringify({ schemaVersion: 1, enabled: true, activation: { user: true, project: true }, policyDigest, policyGeneration: 1 }), { mode: 0o600 });
  return root;
}

function hookEnvelopeWithSize(cwd, size) {
  const envelope = {
    session_id: 'session-1', prompt_id: 'prompt-1', cwd, permission_mode: 'default',
    hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'printf safe', padding: '' }, tool_use_id: 'tool-1'
  };
  const baseSize = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
  assert.ok(baseSize <= size);
  envelope.tool_input.padding = 'x'.repeat(size - baseSize);
  const serialized = JSON.stringify(envelope);
  assert.equal(Buffer.byteLength(serialized, 'utf8'), size);
  return serialized;
}

function runSafetyHook(input) {
  return spawnSync(process.execPath, ['plugins/kstack/scripts/kstack-safety-hook.mjs', '--scope', 'user'], {
    cwd: path.resolve('.'), input, encoding: 'utf8', shell: false
  });
}

function runManifestHook(handler, input, host) {
  const environment = {
    PATH: process.env.PATH,
    HOME: os.tmpdir(),
    TMPDIR: os.tmpdir(),
    XDG_CONFIG_HOME: os.tmpdir(),
    XDG_CACHE_HOME: os.tmpdir(),
    XDG_STATE_HOME: os.tmpdir(),
    LANG: 'C.UTF-8'
  };
  environment[host === 'codex' ? 'PLUGIN_ROOT' : 'CLAUDE_PLUGIN_ROOT'] = path.resolve('plugins/kstack');
  const command = host === 'codex'
    ? handler.command.replace('${HOME}/.codex/skills/.kstack-runtime', path.resolve('plugins/kstack'))
    : handler.command;
  return spawnSync(command, {
    cwd: path.resolve('.'), input, encoding: 'utf8', shell: true, env: environment,
    timeout: 3_000, maxBuffer: 64 * 1024
  });
}

async function readyBroker(value = request(), options = {}) {
  const calls = [];
  const scanner = options.scanner ?? new OutboundContentScanStageV1({ objectSource: async () => [] });
  const broker = new SafetyBroker({ scanner, executor: options.executor ?? (async (canonical) => { calls.push(canonical); return { receipt: 'ok' }; }), clock: options.clock });
  const prepared = broker.prepare(value);
  const ready = await broker.waitForScan(prepared.handleId);
  assert.equal(ready.state, 'READY');
  return { broker, bridge: broker.createHostBridge(), prepared, ready, calls };
}

function voteBoth(bridge, value, ready, toolUseId = 'tool-1') {
  const envelope = { handleId: ready.handleId, hostToolUseId: toolUseId, canonicalRequestDigest: ready.attestation.canonicalRequestDigest, previewDigest: ready.previewDigest, cellKey: value.cellKey };
  assert.equal(bridge.vote('user', envelope).state, 'READY');
  assert.equal(bridge.vote('project', envelope).state, 'ASK_PENDING');
  return envelope;
}

function gitAt(root, ...args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createGitRepository() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-executor-'));
  const root = path.join(parent, 'work');
  fs.mkdirSync(root);
  gitAt(root, 'init'); gitAt(root, 'config', 'user.email', 'test@example.com'); gitAt(root, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(root, 'safe.txt'), 'safe\n'); gitAt(root, 'add', '.'); gitAt(root, 'commit', '-m', 'safe');
  return { parent, root, sourceOid: gitAt(root, 'rev-parse', 'HEAD') };
}

function pushRequest(repository, remoteUrl) {
  const value = request('git-push', { root: repository.root, targetId: remoteUrl });
  value.payload = { updates: [{ sourceOid: repository.sourceOid, expectedRemoteOldOid: '0'.repeat(40), destinationRef: 'refs/heads/main' }], atomic: false };
  return value;
}

function commitRequest(repository, message = 'brokered commit') {
  const headRef = gitAt(repository.root, 'symbolic-ref', 'HEAD');
  return request('git-commit', {
    root: repository.root, targetId: headRef,
    payload: {
      message, author: 'Broker Author <author@example.com>', committer: 'Broker Committer <committer@example.com>',
      headOid: gitAt(repository.root, 'rev-parse', 'HEAD'), headTreeOid: gitAt(repository.root, 'rev-parse', 'HEAD^{tree}'),
      proposedTreeOid: gitAt(repository.root, 'write-tree')
    }
  });
}

async function executeApproved(value, options) {
  const broker = new SafetyBroker(options);
  const held = broker.prepare(value);
  const ready = await broker.waitForScan(held.handleId);
  assert.equal(ready.state, 'READY');
  const bridge = broker.createHostBridge();
  voteBoth(bridge, value, ready);
  return { broker, result: await bridge.execute({ handleId: ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: ready.previewDigest, current: currentFor(value) }) };
}

async function startAuthenticatedGitHttp(projectRoot, expectedAuthorization, { onUnauthorized } = {}) {
  let authenticatedRequests = 0;
  const server = http.createServer((request_, response_) => {
    if (request_.headers.authorization !== expectedAuthorization) {
      onUnauthorized?.();
      response_.writeHead(401, { 'WWW-Authenticate': 'Basic realm="KStack test"', 'Content-Length': '0' });
      response_.end();
      return;
    }
    authenticatedRequests += 1;
    const requested = new URL(request_.url, 'http://127.0.0.1');
    const child = spawn('/usr/bin/git', ['http-backend'], {
      env: {
        PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', GIT_PROJECT_ROOT: projectRoot, GIT_HTTP_EXPORT_ALL: '1',
        PATH_INFO: requested.pathname, QUERY_STRING: requested.search.slice(1), REQUEST_METHOD: request_.method,
        CONTENT_TYPE: request_.headers['content-type'] ?? '', CONTENT_LENGTH: request_.headers['content-length'] ?? '', REMOTE_USER: 'kstack'
      },
      stdio: ['pipe', 'pipe', 'pipe'], shell: false
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    request_.pipe(child.stdin);
    child.on('close', (code) => {
      assert.equal(code, 0, Buffer.concat(stderr).toString('utf8'));
      const bytes = Buffer.concat(stdout);
      const separator = bytes.indexOf(Buffer.from('\r\n\r\n'));
      assert.notEqual(separator, -1);
      const headerLines = bytes.subarray(0, separator).toString('latin1').split('\r\n');
      let status = 200;
      const headers = {};
      for (const line of headerLines) {
        const index = line.indexOf(':');
        if (index < 0) continue;
        const name = line.slice(0, index);
        const value = line.slice(index + 1).trim();
        if (name.toLowerCase() === 'status') status = Number(value.split(' ', 1)[0]);
        else headers[name] = value;
      }
      response_.writeHead(status, headers);
      response_.end(bytes.subarray(separator + 4));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port, authenticatedRequests: () => authenticatedRequests };
}

test('MatcherSetV1 is shared with sanitize and scans NUL/invalid-UTF-8 bytes losslessly', () => {
  assert.equal(MATCHER_VERSION, 'MatcherSetV1-byte-latin1');
  assert.ok(matcherSetV1().length >= 10);
  const credential = 'AKIA1234567890ABCDEF';
  const bytes = Buffer.concat([Buffer.from([0, 0xff, 0xfe]), Buffer.from(credential, 'ascii'), Buffer.from([0])]);
  assert.deepEqual(findOutboundSecret(bytes, { byteDomain: true }), { matcherId: 'aws-access-key', offset: 3, length: 20 });
  assert.match(sanitize(`value=${credential}`), /REDACTED AWS ACCESS KEY/u);
  for (const value of ['client_secret=abcdefghijklmnop', 'DB_PASSWORD=abcdefghijklmnop', 'access_token=abcdefghijklmnop']) assert.ok(findOutboundSecret(value));
});

test('canonical request schema rejects credential channels, controls, unknown actions, and non-atomic multi-ref pushes', () => {
  assert.throws(() => validateCanonicalRequest({ ...request(), credentialPath: '/tmp/key' }), (error) => error.code === 'KSG-SCHEMA-001');
  assert.throws(() => validateCanonicalRequest({ ...request(), targetId: 'bad\nfield' }), (error) => error.code === 'KSG-SCHEMA-001');
  assert.throws(() => validateCanonicalRequest({ ...request(), action: 'shell' }), (error) => error.code === 'KSG-SCHEMA-001');
  const push = request('git-push');
  push.payload.updates.push({ sourceOid: '3'.repeat(40), expectedRemoteOldOid: '4'.repeat(40), destinationRef: 'refs/heads/next' });
  assert.throws(() => validateCanonicalRequest(push), (error) => error.code === 'KSG-PUSH-ATOMIC-001');
  push.payload.atomic = true;
  assert.equal(validateCanonicalRequest(push).request.action, 'git-push');
});

test('prepare is prompt-free HELD_SCAN and secrets terminate before READY or credential open', async () => {
  let release;
  const scanner = { scan: () => new Promise((resolve) => { release = resolve; }) };
  const broker = new SafetyBroker({ scanner, executor: async () => assert.fail('executor must not run') });
  const prepared = broker.prepare(request());
  assert.equal(prepared.state, 'HELD_SCAN');
  assert.equal(broker.status(prepared.handleId).state, 'HELD_SCAN');
  await new Promise((resolve) => setImmediate(resolve));
  release({ state: 'REJECTED_SECRET', locator: { fieldId: 'payload.body', offsetClass: 0 }, matcherVersion: MATCHER_VERSION });
  const rejected = await broker.waitForScan(prepared.handleId);
  assert.equal(rejected.state, 'REJECTED_SECRET');
  assert.deepEqual(rejected.locator, { fieldId: 'payload.body', offsetClass: 0 });
  assert.equal(broker.credentialOpenCount, 0);
});

test('scan timeout never mints READY, including a source that returns after the deadline', async () => {
  const times = [0, SAFETY_LIMITS.scanTimeoutMs + 1];
  const scanner = new OutboundContentScanStageV1({ objectSource: async () => [], clock: () => times.shift() ?? SAFETY_LIMITS.scanTimeoutMs + 1 });
  const broker = new SafetyBroker({ scanner });
  const prepared = broker.prepare(request());
  const status = await broker.waitForScan(prepared.handleId);
  assert.deepEqual(status, { handleId: prepared.handleId, state: 'REJECTED_LIMIT', limit: 'scan-timeout' });

  const hung = new SafetyBroker({ scanner: { scan: () => new Promise(() => {}) }, scanTimeoutMs: 5 });
  const held = hung.prepare(request());
  assert.deepEqual(await hung.waitForScan(held.handleId), { handleId: held.handleId, state: 'REJECTED_LIMIT', limit: 'scan-timeout' });
});

test('whole provider fields are scanned and matched bytes never appear in status', async () => {
  const value = request();
  value.payload.body = 'prefix token=abcdefghijklmnop suffix';
  const broker = new SafetyBroker({ scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }) });
  const prepared = broker.prepare(value);
  const status = await broker.waitForScan(prepared.handleId);
  assert.equal(status.state, 'REJECTED_SECRET');
  assert.equal(JSON.stringify(status).includes('abcdefghijklmnop'), false);
  assert.equal(broker.credentialOpenCount, 0);

  for (const value of [
    request('provider-pr-create', { targetId: 'token=abcdefghijklmnop' }),
    request('git-destructive', { payload: { kind: 'reset-hard', paths: ['credential=abcdefghijklmnop'], expectedInventoryDigest: hex('a') } })
  ]) {
    const metadataBroker = new SafetyBroker({ scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }) });
    const metadataPrepared = metadataBroker.prepare(value);
    assert.equal((await metadataBroker.waitForScan(metadataPrepared.handleId)).state, 'REJECTED_SECRET');
  }
});

test('READY attestation, preview, and complete serialized hook response stay inside fixed bounds', async () => {
  const { ready } = await readyBroker();
  assert.ok(Buffer.byteLength(ready.preview, 'utf8') <= SAFETY_LIMITS.previewBytes);
  assert.ok(Buffer.byteLength(ready.preview, 'utf8') + Buffer.byteLength(JSON.stringify(ready.attestation), 'utf8') <= 4_096);
  const output = await evaluateSafetyHook({
    session_id: 'session-1', prompt_id: 'prompt-1', cwd: activeRoot(), permission_mode: 'default',
    hook_event_name: 'PreToolUse', tool_name: 'mcp__kstack_safety__execute', tool_input: { handleId: ready.handleId }, tool_use_id: 'tool-1'
  }, { verifyAttestation: async () => ({ valid: true, action: 'provider-pr-create', preview: ready.preview, previewDigest: ready.previewDigest }) });
  assert.equal(output.hookSpecificOutput.permissionDecision, 'ask');
  assert.ok(serializeHookResponse(output, 'claude').length <= SAFETY_LIMITS.hookResponseBytes);

  const escaped = request('provider-pr-create', { root: `/${'\\'.repeat(600)}` });
  const rejectedBroker = new SafetyBroker({ scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }) });
  const prepared = rejectedBroker.prepare(escaped);
  const rejected = await rejectedBroker.waitForScan(prepared.handleId);
  assert.deepEqual(rejected, { handleId: prepared.handleId, state: 'REJECTED_LIMIT', limit: 'response-bytes' });
  assert.ok(Buffer.byteLength(JSON.stringify(rejected), 'utf8') <= SAFETY_LIMITS.hookResponseBytes);
});

test('execute requires the approval-bound bridge, two scope votes, equality, and single consumption', async () => {
  const value = request();
  const { broker, bridge, ready, calls } = await readyBroker(value);
  assert.throws(() => broker.execute({ handleId: ready.handleId }), (error) => error.code === 'KSG-BROKER-DIRECT-001');
  const vote = voteBoth(bridge, value, ready);
  const result = await bridge.execute({ handleId: ready.handleId, hostToolUseId: vote.hostToolUseId, sessionId: value.sessionId, approvalPreviewDigest: ready.previewDigest, current: currentFor(value) });
  assert.equal(result.state, 'COMPLETED');
  assert.equal(calls.length, 1);
  assert.equal(broker.credentialOpenCount, 0);
  await assert.rejects(() => bridge.execute({ handleId: ready.handleId, hostToolUseId: vote.hostToolUseId, sessionId: value.sessionId, approvalPreviewDigest: ready.previewDigest, current: currentFor(value) }), (error) => error.code === 'KSG-REPLAY-001');
  assert.equal(calls.length, 1);
});

test('request and approval preview mutation cancel before credential open', async () => {
  const value = request();
  const first = await readyBroker(value);
  voteBoth(first.bridge, value, first.ready);
  process.env.NODE_ENV = 'test';
  first.broker.testOnlyMutate(first.ready.handleId, (record) => { record.request.payload.title = 'altered'; });
  const changed = await first.bridge.execute({ handleId: first.ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: first.ready.previewDigest, current: currentFor(value) });
  assert.deepEqual(changed, { state: 'CANCELLED', reason: 'DIGEST_MISMATCH' });
  assert.equal(first.broker.credentialOpenCount, 0);

  const second = await readyBroker(value);
  voteBoth(second.bridge, value, second.ready);
  const approvalChanged = await second.bridge.execute({ handleId: second.ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: hex('d'), current: currentFor(value) });
  assert.deepEqual(approvalChanged, { state: 'CANCELLED', reason: 'DIGEST_MISMATCH' });
  assert.equal(second.broker.credentialOpenCount, 0);
  delete process.env.NODE_ENV;
});

test('scope votes bind one host tool-use ID and malformed approval dispatch consumes the handle', async () => {
  const value = request();
  const mixed = await readyBroker(value);
  const first = { handleId: mixed.ready.handleId, hostToolUseId: 'tool-a', canonicalRequestDigest: mixed.ready.attestation.canonicalRequestDigest, previewDigest: mixed.ready.previewDigest, cellKey: value.cellKey };
  assert.equal(mixed.bridge.vote('user', first).state, 'READY');
  assert.deepEqual(mixed.bridge.vote('project', { ...first, hostToolUseId: 'tool-b' }), { state: 'CANCELLED', reason: 'HOST_TOOL_USE_MISMATCH' });
  assert.equal(mixed.broker.credentialOpenCount, 0);

  const malformed = await readyBroker(value);
  voteBoth(malformed.bridge, value, malformed.ready);
  await assert.rejects(() => malformed.bridge.execute({
    handleId: malformed.ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId,
    approvalPreviewDigest: malformed.ready.previewDigest, current: { ...currentFor(value), certificateDigest: 'not-a-digest' }
  }), (error) => error.code === 'KSG-SCHEMA-001');
  await assert.rejects(() => malformed.bridge.execute({ handleId: malformed.ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: malformed.ready.previewDigest, current: currentFor(value) }), (error) => error.code === 'KSG-REPLAY-001');
  assert.deepEqual(malformed.broker.status(malformed.ready.handleId), { handleId: malformed.ready.handleId, state: 'CANCELLED', reason: 'INVALID_EXECUTE_ENVELOPE' });
  assert.equal(malformed.broker.credentialOpenCount, 0);
});

test('executor receipts and error codes cannot escape secrets or the 4 KiB response bound', async () => {
  const value = request();
  const item = await readyBroker(value, { executor: async () => ({ receipt: 'token=abcdefghijklmnop' }) });
  voteBoth(item.bridge, value, item.ready);
  const result = await item.bridge.execute({ handleId: item.ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: item.ready.previewDigest, current: currentFor(value) });
  assert.deepEqual(result, { state: 'COMPLETED', receipt: null, code: 'KSG-RECEIPT-REJECTED-001' });
  assert.equal(JSON.stringify(result).includes('abcdefghijklmnop'), false);
  assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') <= SAFETY_LIMITS.hookResponseBytes);

  const unavailable = new SafetyBroker({ scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }), executor: null });
  const prepared = unavailable.prepare(value);
  const ready = await unavailable.waitForScan(prepared.handleId);
  const bridge = unavailable.createHostBridge();
  voteBoth(bridge, value, ready);
  assert.deepEqual(await bridge.execute({ handleId: ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: ready.previewDigest, current: currentFor(value) }), { state: 'EXECUTE_FAILED', code: 'KSG-BROKER-UNAVAILABLE-001' });
  assert.equal(unavailable.credentialOpenCount, 0);
});

test('hook CLI evaluates an envelope just under its finite input limit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-unenrolled-'));
  const result = runSafetyHook(hookEnvelopeWithSize(root, HOOK_INPUT_LIMIT - 1));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {});
});

test('hook CLI denies an oversized envelope with the exact actionable limit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-unenrolled-'));
  const result = runSafetyHook(hookEnvelopeWithSize(root, HOOK_INPUT_LIMIT + 1));
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(output.hookSpecificOutput.permissionDecisionReason, `KStack safety hook envelope exceeds the ${HOOK_INPUT_LIMIT}-byte limit.`);
  assert.notEqual(output.hookSpecificOutput.permissionDecisionReason, 'KStack safety hook failed before evaluation.');
});

test('hook CLI retains the generic catch-all for malformed input', () => {
  const result = runSafetyHook('{');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(output.hookSpecificOutput.permissionDecisionReason, 'KStack safety hook failed before evaluation.');
});

test('production executor performs an approved authenticated git push in an isolated worker', async (context) => {
  const repository = createGitRepository();
  const bareRoot = path.join(repository.parent, 'remotes');
  const bare = path.join(bareRoot, 'target.git');
  fs.mkdirSync(bareRoot);
  gitAt(bareRoot, 'init', '--bare', bare);
  gitAt(bare, 'config', 'http.receivepack', 'true');
  const username = 'kstack-user';
  const token = 'ghp_1234567890abcdefghijklmnop';
  const authorization = `Basic ${Buffer.from(`${username}:${token}`, 'utf8').toString('base64')}`;
  const service = await startAuthenticatedGitHttp(bareRoot, authorization);
  context.after(() => new Promise((resolve) => service.server.close(resolve)));
  const remoteUrl = `http://127.0.0.1:${service.port}/target.git`;
  gitAt(repository.root, 'config', `url.http://127.0.0.1:1/attacker.git.insteadOf`, remoteUrl);
  const credentialPath = path.join(repository.parent, 'git-push.json');
  fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username, token }), { mode: 0o600 });
  fs.chmodSync(credentialPath, 0o600);
  const value = pushRequest(repository, remoteUrl);
  const { broker, result } = await executeApproved(value, { executor: createProductionSafetyExecutor({ credentialPath }) });
  assert.deepEqual(result, { state: 'COMPLETED', receipt: { action: 'git-push', outcome: 'pushed', updateCount: 1, destinationRefs: ['refs/heads/main'] } });
  assert.equal(gitAt(bare, 'rev-parse', 'refs/heads/main'), repository.sourceOid);
  assert.ok(service.authenticatedRequests() >= 1);
  assert.equal(broker.credentialOpenCount, 1);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test('credential path rotation after worker validation cannot swap the value Git receives', async (context) => {
  const repository = createGitRepository();
  const bareRoot = path.join(repository.parent, 'remotes');
  const bare = path.join(bareRoot, 'target.git');
  fs.mkdirSync(bareRoot); gitAt(bareRoot, 'init', '--bare', bare); gitAt(bare, 'config', 'http.receivepack', 'true');
  const username = 'stable-user';
  const validatedToken = 'ghp_validated1234567890abcdefghijklmnop';
  const rotatedToken = 'ghp_replaced1234567890abcdefghijklmnop';
  const authorization = `Basic ${Buffer.from(`${username}:${validatedToken}`, 'utf8').toString('base64')}`;
  let credentialPath;
  let remoteUrl;
  let rotated = false;
  const service = await startAuthenticatedGitHttp(bareRoot, authorization, { onUnauthorized: () => {
    if (rotated) return;
    rotated = true;
    fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username, token: rotatedToken }), { mode: 0o600 });
    fs.chmodSync(credentialPath, 0o600);
  } });
  context.after(() => new Promise((resolve) => service.server.close(resolve)));
  remoteUrl = `http://127.0.0.1:${service.port}/target.git`;
  credentialPath = path.join(repository.parent, 'credential.json');
  fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username, token: validatedToken }), { mode: 0o600 });
  fs.chmodSync(credentialPath, 0o600);
  const { result } = await executeApproved(pushRequest(repository, remoteUrl), { executor: createProductionSafetyExecutor({ credentialPath }) });
  assert.equal(rotated, true);
  assert.equal(result.state, 'COMPLETED');
  assert.equal(gitAt(bare, 'rev-parse', 'refs/heads/main'), repository.sourceOid);
  assert.equal(JSON.stringify(result).includes(validatedToken), false);
  assert.equal(JSON.stringify(result).includes(rotatedToken), false);
});

test('concurrent push workers cannot cross-bind askpass sockets', async (context) => {
  const items = [];
  for (const suffix of ['one', 'two']) {
    const repository = createGitRepository();
    const bareRoot = path.join(repository.parent, 'remotes');
    const bare = path.join(bareRoot, `${suffix}.git`);
    fs.mkdirSync(bareRoot); gitAt(bareRoot, 'init', '--bare', bare); gitAt(bare, 'config', 'http.receivepack', 'true');
    const username = `user-${suffix}`;
    const token = `ghp_${suffix}1234567890abcdefghijklmnop`;
    const authorization = `Basic ${Buffer.from(`${username}:${token}`, 'utf8').toString('base64')}`;
    const service = await startAuthenticatedGitHttp(bareRoot, authorization);
    context.after(() => new Promise((resolve) => service.server.close(resolve)));
    const remoteUrl = `http://127.0.0.1:${service.port}/${suffix}.git`;
    const credentialPath = path.join(repository.parent, `${suffix}-credential.json`);
    fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username, token }), { mode: 0o600 });
    fs.chmodSync(credentialPath, 0o600);
    items.push({ repository, bare, service, token, value: pushRequest(repository, remoteUrl), executor: createProductionSafetyExecutor({ credentialPath }) });
  }
  const results = await Promise.all(items.map((item) => executeApproved(item.value, { executor: item.executor })));
  for (const [index, item] of items.entries()) {
    assert.equal(results[index].result.state, 'COMPLETED');
    assert.equal(gitAt(item.bare, 'rev-parse', 'refs/heads/main'), item.repository.sourceOid);
    assert.ok(item.service.authenticatedRequests() >= 1);
    assert.equal(JSON.stringify(results[index].result).includes(item.token), false);
  }
});

test('rejected rotated credentials stay typed, non-secret, and retry-conservative', async (context) => {
  const repository = createGitRepository();
  const bareRoot = path.join(repository.parent, 'remotes');
  const bare = path.join(bareRoot, 'target.git');
  fs.mkdirSync(bareRoot); gitAt(bareRoot, 'init', '--bare', bare); gitAt(bare, 'config', 'http.receivepack', 'true');
  const expectedToken = 'ghp_expected1234567890abcdefghijklmnop';
  const rejectedToken = 'ghp_rotated1234567890abcdefghijklmnop';
  const authorization = `Basic ${Buffer.from(`user:${expectedToken}`, 'utf8').toString('base64')}`;
  const service = await startAuthenticatedGitHttp(bareRoot, authorization);
  context.after(() => new Promise((resolve) => service.server.close(resolve)));
  const remoteUrl = `http://127.0.0.1:${service.port}/target.git`;
  const credentialPath = path.join(repository.parent, 'rotated.json');
  fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username: 'user', token: rejectedToken }), { mode: 0o600 });
  fs.chmodSync(credentialPath, 0o600);
  const { result } = await executeApproved(pushRequest(repository, remoteUrl), { executor: createProductionSafetyExecutor({ credentialPath }) });
  assert.deepEqual(result, { state: 'COMPLETED_AMBIGUOUS', code: 'KSG-GIT-PUSH-FAILED-001' });
  assert.equal(service.authenticatedRequests(), 0);
  assert.equal(JSON.stringify(result).includes(expectedToken), false);
  assert.equal(JSON.stringify(result).includes(rejectedToken), false);
  assert.notEqual(spawnSync('git', ['-C', bare, 'rev-parse', '--verify', 'refs/heads/main'], { stdio: 'ignore' }).status, 0);
});

test('worker timeout and crash are unknown outcomes and orphan descendants are killed', async () => {
  const repository = createGitRepository();
  const value = pushRequest(repository, 'http://127.0.0.1:9/target.git');
  const credentialPath = path.join(repository.parent, 'credential.json');
  fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl: value.targetId, username: 'user', token: 'ghp_1234567890abcdefghijklmnop' }), { mode: 0o600 });
  fs.chmodSync(credentialPath, 0o600);
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    for (const [fixtureName, timeoutMs] of [['safety-worker-hang-fixture.mjs', 40], ['safety-worker-crash-fixture.mjs', 1_000]]) {
      const fixture = path.resolve('tests/helpers', fixtureName);
      const { result } = await executeApproved(value, { scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }), executor: createProductionSafetyExecutor({ credentialPath, timeoutMs, testOnlyWorkerPath: fixture }) });
      assert.deepEqual(result, { state: 'COMPLETED_AMBIGUOUS', code: 'KSG-WORKER-PROTOCOL-001' });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(fs.existsSync(path.join(repository.root, '.kstack-orphan-worker-marker')), false);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
  }
});

test('production executor creates an unsigned commit from the approved staged tree without hooks or credentials', async () => {
  const repository = createGitRepository();
  const hookMarker = path.join(repository.parent, 'commit-hook-ran');
  const hooks = path.join(repository.parent, 'hooks');
  fs.mkdirSync(hooks);
  fs.writeFileSync(path.join(hooks, 'pre-commit'), `#!/bin/sh\nprintf ran > '${hookMarker}'\n`, { mode: 0o700 });
  gitAt(repository.root, 'config', 'core.hooksPath', hooks);
  gitAt(repository.root, 'config', 'commit.gpgSign', 'true');
  fs.writeFileSync(path.join(repository.root, 'safe.txt'), 'safe\ncommitted through broker\n');
  gitAt(repository.root, 'add', 'safe.txt');
  const value = commitRequest(repository);
  const priorHead = value.payload.headOid;
  const { broker, result } = await executeApproved(value, { executor: createProductionSafetyExecutor() });
  assert.equal(result.state, 'COMPLETED');
  assert.deepEqual(result.receipt, { action: 'git-commit', outcome: 'committed', commitOid: gitAt(repository.root, 'rev-parse', 'HEAD'), headRef: value.targetId });
  assert.equal(gitAt(repository.root, 'rev-parse', 'HEAD^'), priorHead);
  assert.equal(gitAt(repository.root, 'rev-parse', 'HEAD^{tree}'), value.payload.proposedTreeOid);
  assert.equal(gitAt(repository.root, 'show', '-s', '--format=%an <%ae>|%cn <%ce>|%s', 'HEAD'), 'Broker Author <author@example.com>|Broker Committer <committer@example.com>|brokered commit');
  assert.doesNotMatch(gitAt(repository.root, 'cat-file', '-p', 'HEAD'), /^gpgsig /mu);
  assert.equal(fs.existsSync(hookMarker), false);
  assert.equal(broker.credentialOpenCount, 0);
});

test('commit execution revalidates the index snapshot immediately before its ref CAS', async () => {
  const repository = createGitRepository();
  fs.writeFileSync(path.join(repository.root, 'safe.txt'), 'approved staged content\n');
  gitAt(repository.root, 'add', 'safe.txt');
  const value = commitRequest(repository, 'approved commit');
  const broker = new SafetyBroker({ executor: createProductionSafetyExecutor() });
  const held = broker.prepare(value);
  const ready = await broker.waitForScan(held.handleId);
  assert.equal(ready.state, 'READY');
  const bridge = broker.createHostBridge(); voteBoth(bridge, value, ready);
  fs.writeFileSync(path.join(repository.root, 'safe.txt'), 'different staged content\n');
  gitAt(repository.root, 'add', 'safe.txt');
  const result = await bridge.execute({ handleId: ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: ready.previewDigest, current: currentFor(value) });
  assert.deepEqual(result, { state: 'EXECUTE_FAILED', code: 'KSG-GIT-COMMIT-FAILED-001' });
  assert.equal(gitAt(repository.root, 'rev-parse', 'HEAD'), value.payload.headOid);
  assert.equal(broker.credentialOpenCount, 0);
});

test('production credential store failures are typed, non-secret, and never downgrade permissions', async () => {
  const repository = createGitRepository();
  const remoteUrl = 'http://127.0.0.1:9/target.git';
  const value = pushRequest(repository, remoteUrl);
  const scanner = new OutboundContentScanStageV1({ objectSource: async () => [] });
  const secret = 'ghp_abcdefghijklmnopqrstuvwxyz1234';
  const valid = path.join(repository.parent, 'valid.json');
  fs.writeFileSync(valid, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username: 'user', token: secret }), { mode: 0o600 });
  fs.chmodSync(valid, 0o600);
  const cases = [
    [path.join(repository.parent, 'missing.json'), 'KSG-CREDENTIAL-STORE-UNAVAILABLE-001'],
    [path.join(repository.parent, 'malformed.json'), 'KSG-CREDENTIAL-STORE-MALFORMED-001'],
    [path.join(repository.parent, 'permissive.json'), 'KSG-CREDENTIAL-STORE-UNTRUSTED-001'],
    [path.join(repository.parent, 'linked.json'), 'KSG-CREDENTIAL-STORE-UNTRUSTED-001'],
    [path.join(repository.root, 'credential.json'), 'KSG-CREDENTIAL-STORE-UNTRUSTED-001'],
    [path.join(repository.parent, 'hardlink.json'), 'KSG-CREDENTIAL-STORE-UNTRUSTED-001'],
    [path.join(repository.parent, 'wrong-target.json'), 'KSG-CREDENTIAL-TARGET-001']
  ];
  fs.writeFileSync(cases[1][0], `{"token":"${secret}"`, { mode: 0o600 }); fs.chmodSync(cases[1][0], 0o600);
  fs.writeFileSync(cases[2][0], fs.readFileSync(valid), { mode: 0o644 }); fs.chmodSync(cases[2][0], 0o644);
  fs.symlinkSync(valid, cases[3][0]);
  fs.writeFileSync(cases[4][0], fs.readFileSync(valid), { mode: 0o600 }); fs.chmodSync(cases[4][0], 0o600);
  const hardlinkSource = path.join(repository.parent, 'hardlink-source.json');
  fs.writeFileSync(hardlinkSource, fs.readFileSync(valid), { mode: 0o600 }); fs.chmodSync(hardlinkSource, 0o600); fs.linkSync(hardlinkSource, cases[5][0]);
  fs.writeFileSync(cases[6][0], JSON.stringify({ version: 1, kind: 'https-token', remoteUrl: 'http://127.0.0.1:8/other.git', username: 'user', token: secret }), { mode: 0o600 }); fs.chmodSync(cases[6][0], 0o600);
  for (const [credentialPath, code] of cases) {
    const item = await executeApproved(value, { scanner, executor: createProductionSafetyExecutor({ credentialPath }) });
    assert.deepEqual(item.result, { state: 'EXECUTE_FAILED', code });
    assert.equal(JSON.stringify(item.result).includes(secret), false);
  }
});

test('closed executor rejects child receipt, error, stack, stdout, and stderr credential leaks', async () => {
  const repository = createGitRepository();
  const remoteUrl = 'http://127.0.0.1:9/target.git';
  const value = pushRequest(repository, remoteUrl);
  const token = 'ghp_abcdefghijklmnopqrstuvwxyz1234';
  const credentialPath = path.join(repository.parent, 'leak.json');
  fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username: 'user', token }), { mode: 0o600 });
  fs.chmodSync(credentialPath, 0o600);
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const fixture = path.resolve('tests/helpers/safety-worker-leak-fixture.mjs');
    const item = await executeApproved(value, { scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }), executor: createProductionSafetyExecutor({ credentialPath, testOnlyWorkerPath: fixture }) });
    assert.deepEqual(item.result, { state: 'COMPLETED_AMBIGUOUS', code: 'KSG-WORKER-PROTOCOL-001' });
    assert.equal(JSON.stringify(item.result).includes(token), false);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
  }
  const thrown = await readyBroker(request(), { executor: async () => { throw new Error(`token=${token}`); } });
  voteBoth(thrown.bridge, request(), thrown.ready);
  const result = await thrown.bridge.execute({ handleId: thrown.ready.handleId, hostToolUseId: 'tool-1', sessionId: request().sessionId, approvalPreviewDigest: thrown.ready.previewDigest, current: currentFor(request()) });
  assert.deepEqual(result, { state: 'EXECUTE_FAILED', code: 'KSG-EXECUTE-FAILED-001' });
  assert.equal(JSON.stringify(result).includes(token), false);
  const codeToken = 'KSG-SECRET-CREDENTIAL-LEAK-001';
  const coded = await readyBroker(request(), { executor: async () => { const error = new Error('fixed'); error.code = codeToken; throw error; } });
  voteBoth(coded.bridge, request(), coded.ready);
  const codedResult = await coded.bridge.execute({ handleId: coded.ready.handleId, hostToolUseId: 'tool-1', sessionId: request().sessionId, approvalPreviewDigest: coded.ready.previewDigest, current: currentFor(request()) });
  assert.deepEqual(codedResult, { state: 'EXECUTE_FAILED', code: 'KSG-EXECUTE-FAILED-001' });
  assert.equal(JSON.stringify(codedResult).includes(codeToken), false);
});

test('worker isolation does not inherit ambient secrets and rejects an untrusted Git executable', async () => {
  const repository = createGitRepository();
  const remoteUrl = 'http://127.0.0.1:9/target.git';
  const value = pushRequest(repository, remoteUrl);
  const credentialPath = path.join(repository.parent, 'credential.json');
  fs.writeFileSync(credentialPath, JSON.stringify({ version: 1, kind: 'https-token', remoteUrl, username: 'user', token: 'ghp_abcdefghijklmnopqrstuvwxyz1234' }), { mode: 0o600 });
  fs.chmodSync(credentialPath, 0o600);
  const priorNodeEnv = process.env.NODE_ENV;
  const ambient = {
    KSTACK_TEST_AMBIENT_SECRET: 'token=ambientcredential12345', GIT_ASKPASS: '/tmp/ambient-askpass',
    GIT_SSH_COMMAND: 'ambient-ssh-command', SSH_AUTH_SOCK: '/tmp/ambient-agent.sock',
    GIT_CONFIG_GLOBAL: '/tmp/ambient-gitconfig', GIT_CONFIG_SYSTEM: '/tmp/ambient-system-gitconfig',
    GIT_CONFIG_COUNT: '1', GIT_CREDENTIAL_HELPER: 'ambient-helper'
  };
  const priorAmbient = new Map(Object.keys(ambient).map((key) => [key, process.env[key]]));
  process.env.NODE_ENV = 'test';
  Object.assign(process.env, ambient);
  try {
    const fixture = path.resolve('tests/helpers/safety-worker-environment-fixture.mjs');
    const isolated = await executeApproved(value, { scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }), executor: createProductionSafetyExecutor({ credentialPath, testOnlyWorkerPath: fixture }) });
    assert.equal(isolated.result.state, 'COMPLETED');
    assert.equal(JSON.stringify(isolated.result).includes(ambient.KSTACK_TEST_AMBIENT_SECRET), false);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
    for (const [key, value] of priorAmbient) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  const fakeGit = path.join(repository.parent, 'git');
  fs.copyFileSync('/usr/bin/git', fakeGit); fs.chmodSync(fakeGit, 0o755);
  const rejected = await executeApproved(value, { scanner: new OutboundContentScanStageV1({ objectSource: async () => [] }), executor: createProductionSafetyExecutor({ credentialPath, gitBinary: fakeGit }) });
  assert.deepEqual(rejected.result, { state: 'EXECUTE_FAILED', code: 'KSG-WORKER-ISOLATION-001' });
});

test('restart and each cheap generation/ref drift expire or cancel without executing', async () => {
  const value = request();
  const restarted = await readyBroker(value);
  restarted.broker.restart();
  assert.equal(restarted.broker.status(restarted.ready.handleId).state, 'EXPIRED');
  assert.equal(restarted.broker.credentialOpenCount, 0);

  let now = 0;
  const expiring = await readyBroker(value, { clock: () => now });
  voteBoth(expiring.bridge, value, expiring.ready);
  now = SAFETY_LIMITS.ttlMs + 1;
  assert.equal(expiring.broker.status(expiring.ready.handleId).state, 'EXPIRED');

  for (const [field, changed, reason] of [
    ['policyGeneration', 2, 'POLICY_DRIFT'], ['targetGeneration', 2, 'TARGET_DRIFT'],
    ['targetFingerprintDigest', hex('d'), 'TARGET_FINGERPRINT_DRIFT'], ['certificateDigest', hex('e'), 'CERTIFICATE_DRIFT']
  ]) {
    const item = await readyBroker(value);
    voteBoth(item.bridge, value, item.ready);
    const current = { ...currentFor(value), [field]: changed };
    const result = await item.bridge.execute({ handleId: item.ready.handleId, hostToolUseId: 'tool-1', sessionId: value.sessionId, approvalPreviewDigest: item.ready.previewDigest, current });
    assert.equal(result.reason, reason);
    assert.equal(item.broker.credentialOpenCount, 0);
  }

  const push = request('git-push');
  const item = await readyBroker(push);
  voteBoth(item.bridge, push, item.ready);
  const result = await item.bridge.execute({ handleId: item.ready.handleId, hostToolUseId: 'tool-1', sessionId: push.sessionId, approvalPreviewDigest: item.ready.previewDigest, current: { ...currentFor(push), remoteOldOidSetDigest: hex('f') } });
  assert.equal(result.reason, 'REF_MOVED');
  assert.equal(item.broker.credentialOpenCount, 0);

  const multi = request('git-push');
  multi.payload.atomic = true;
  multi.payload.updates.push({ sourceOid: '3'.repeat(40), expectedRemoteOldOid: '4'.repeat(40), destinationRef: 'refs/heads/next' });
  const atomic = await readyBroker(multi);
  voteBoth(atomic.bridge, multi, atomic.ready);
  const unavailable = await atomic.bridge.execute({ handleId: atomic.ready.handleId, hostToolUseId: 'tool-1', sessionId: multi.sessionId, approvalPreviewDigest: atomic.ready.previewDigest, current: { ...currentFor(multi), atomicPushSupported: false } });
  assert.equal(unavailable.reason, 'ATOMIC_UNAVAILABLE');
  assert.equal(atomic.broker.credentialOpenCount, 0);
});

test('conflicting host tool-use index poisons linked handles and quota saturation creates no partial handle', async () => {
  const first = await readyBroker(request());
  const secondPrepared = first.broker.prepare({ ...request(), payload: { ...request().payload, title: 'Second' } });
  const second = await first.broker.waitForScan(secondPrepared.handleId);
  const firstVote = { handleId: first.ready.handleId, hostToolUseId: 'same-tool', canonicalRequestDigest: first.ready.attestation.canonicalRequestDigest, previewDigest: first.ready.previewDigest, cellKey: request().cellKey };
  const secondVote = { handleId: second.handleId, hostToolUseId: 'same-tool', canonicalRequestDigest: second.attestation.canonicalRequestDigest, previewDigest: second.previewDigest, cellKey: request().cellKey };
  first.bridge.vote('user', firstVote);
  const conflict = first.bridge.vote('user', secondVote);
  assert.deepEqual(conflict, { state: 'CANCELLED', reason: 'EXECUTE_INDEX_CONFLICT' });
  assert.equal(first.broker.status(first.ready.handleId).state, 'CANCELLED');

  const scanner = { scan: () => new Promise(() => {}) };
  const saturated = new SafetyBroker({ scanner });
  assert.equal(saturated.prepare(request()).state, 'HELD_SCAN');
  assert.equal(saturated.prepare({ ...request(), sessionId: 'session-1', payload: { ...request().payload, title: 'two' } }).state, 'HELD_SCAN');
  assert.deepEqual(saturated.prepare({ ...request(), payload: { ...request().payload, title: 'three' } }), { state: 'SATURATED' });
});

test('terminal handle metadata is bounded and old scan results cannot be retained indefinitely', async () => {
  const broker = new SafetyBroker({ scanner: { scan: async () => ({ state: 'REJECTED_LIMIT', limit: 'closure-bytes' }) } });
  let firstHandle;
  for (let index = 0; index <= SAFETY_LIMITS.terminalRecords; index += 1) {
    const prepared = broker.prepare({ ...request(), sessionId: `session-${index}` });
    firstHandle ??= prepared.handleId;
    assert.equal((await broker.waitForScan(prepared.handleId)).state, 'REJECTED_LIMIT');
  }
  assert.deepEqual(broker.status(firstHandle), { state: 'NONE' });
});

test('Git closure scanner finds a secret in a new blob with byte-defined semantics', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-git-'));
  const run = (...args) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', shell: false });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  run('init'); run('config', 'user.email', 'test@example.com'); run('config', 'user.name', 'Test');
  fs.writeFileSync(path.join(root, 'clean.txt'), 'clean\n'); run('add', '.'); run('commit', '-m', 'base');
  const oldTree = run('rev-parse', 'HEAD^{tree}');
  fs.writeFileSync(path.join(root, 'new.bin'), Buffer.concat([Buffer.from([0, 0xff]), Buffer.from('AKIA1234567890ABCDEF', 'ascii')]));
  run('add', '.'); const proposedTree = run('write-tree');
  const value = request('provider-pr-create');
  value.action = 'git-commit'; value.root = root; value.targetId = run('symbolic-ref', 'HEAD');
  value.payload = { message: 'safe message', author: 'Test <test@example.com>', committer: 'Test <test@example.com>', headOid: run('rev-parse', 'HEAD'), headTreeOid: oldTree, proposedTreeOid: proposedTree };
  const inconsistent = new SafetyBroker();
  const inconsistentPrepared = inconsistent.prepare({ ...value, payload: { ...value.payload, headTreeOid: proposedTree } });
  assert.equal((await inconsistent.waitForScan(inconsistentPrepared.handleId)).state, 'FAILED');
  const broker = new SafetyBroker();
  const prepared = broker.prepare(value);
  const rejected = await broker.waitForScan(prepared.handleId);
  assert.equal(rejected.state, 'REJECTED_SECRET');
  assert.match(rejected.locator.objectId, /^[0-9a-f]{40}$/u);
  assert.equal(JSON.stringify(rejected).includes('AKIA'), false);
});

test('worker throw sites and broker propagation share one exhaustive executor error allowlist', () => {
  const admitted = new Set(SAFETY_EXECUTOR_ERROR_CODES);
  const files = ['plugins/kstack/scripts/kstack-safety-executor.mjs', 'plugins/kstack/scripts/kstack-safety-worker.mjs'];
  const emitted = new Set();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/['`](KSG-[A-Z0-9-]+)['`]/gu)) emitted.add(match[1]);
  }
  assert.deepEqual([...emitted].filter((code) => !admitted.has(code)), []);
  assert.equal(admitted.size, SAFETY_EXECUTOR_ERROR_CODES.length);
  assert.ok(admitted.has('KSG-EXECUTE-FAILED-001'));
  assert.ok(admitted.has('KSG-GIT-COMMIT-FAILED-001'));
  const askpassSource = fs.readFileSync('plugins/kstack/scripts/kstack-git-askpass.mjs', 'utf8');
  const askpassOnly = [...askpassSource.matchAll(/KSG-[A-Z0-9-]+/gu)].map((match) => match[0]).sort();
  assert.deepEqual(askpassOnly, ['KSG-ASKPASS-PROTOCOL-001', 'KSG-ASKPASS-UNAVAILABLE-001']);
  assert.ok(askpassOnly.every((code) => !admitted.has(code)));
});

test('host hook exposes Jira ask authority on each host, preserves hard deny, disclosure boundary, and detect-only control changes', async () => {
  const codexPlugin = JSON.parse(fs.readFileSync('plugins/kstack/.codex-plugin/plugin.json', 'utf8'));
  const manifests = {
    codex: JSON.parse(fs.readFileSync('plugins/kstack/hooks/codex-hooks.json', 'utf8')),
    claude: JSON.parse(fs.readFileSync('plugins/kstack/hooks/hooks.json', 'utf8'))
  };
  assert.equal(codexPlugin.hooks, './hooks/codex-hooks.json');
  for (const [host, manifest] of Object.entries(manifests)) {
    const handlers = manifest.hooks.PreToolUse[0].hooks;
    assert.equal(manifest.hooks.PreToolUse[0].matcher, '*');
    assert.deepEqual(handlers.map((handler) => handler.timeout), [2, 2]);
    assert.deepEqual(handlers.map((handler) => /--scope (user|project)$/u.exec(handler.command)?.[1]), ['user', 'project']);
    assert.deepEqual(handlers.map((handler) => handler.command), [
      host === 'codex' ? 'node "${HOME}/.codex/skills/.kstack-runtime/scripts/kstack-safety-hook.mjs" --scope user' : 'node "${CLAUDE_PLUGIN_ROOT}/scripts/kstack-safety-hook.mjs" --scope user',
      host === 'codex' ? 'node "${HOME}/.codex/skills/.kstack-runtime/scripts/kstack-safety-hook.mjs" --scope project' : 'node "${CLAUDE_PLUGIN_ROOT}/scripts/kstack-safety-hook.mjs" --scope project'
    ]);
    assert.ok(handlers.every((handler) => !handler.command.includes('PLUGIN_ROOT:-.')));
    if (host === 'codex') assert.deepEqual(handlers.map((handler) => handler.commandWindows), [
      'node "%USERPROFILE%\\.codex\\skills\\.kstack-runtime\\scripts\\kstack-safety-hook.mjs" --scope user',
      'node "%USERPROFILE%\\.codex\\skills\\.kstack-runtime\\scripts\\kstack-safety-hook.mjs" --scope project'
    ]);
  }
  assert.equal(detectHookHost({}, { PLUGIN_ROOT: '/installed/codex/plugin', CLAUDE_PLUGIN_ROOT: '/compat/path' }), 'codex');
  assert.equal(detectHookHost({}, { CLAUDE_PLUGIN_ROOT: '/installed/claude/plugin' }), 'claude');
  const root = activeRoot();
  const base = { session_id: 's', cwd: root, permission_mode: 'default', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 't' };
  const claudeCommit = await evaluateSafetyHook({ ...base, prompt_id: 'p', tool_input: { command: 'git commit -m safe' } });
  assert.equal(claudeCommit.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(claudeCommit.hookSpecificOutput.permissionDecisionReason, /prepare\/execute/u);
  assert.equal((await evaluateSafetyHook({ ...base, prompt_id: 'p', tool_input: { command: 'git rebase main' } })).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal((await evaluateSafetyHook({ ...base, prompt_id: 'p', tool_input: { command: 'git status' } })).hookSpecificOutput, undefined);
  const jiraAdmin = await evaluateSafetyHook({ ...base, prompt_id: 'p', tool_input: { command: 'node plugins/kstack/scripts/kstack-jira-bootstrap.mjs apply' } });
  assert.equal(jiraAdmin.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(jiraAdmin.hookSpecificOutput.permissionDecisionReason, /exact delivery-plan hash/u);
  const codexJiraAdmin = await evaluateSafetyHook({ ...base, model: 'gpt', turn_id: 'turn', tool_input: { command: 'node plugins/kstack/scripts/kstack-jira-bootstrap.mjs apply' } });
  assert.equal(codexJiraAdmin.hookSpecificOutput, undefined);
  assert.match(codexJiraAdmin.systemMessage, /does not claim forced approval/u);

  const denyRoot = activeRoot({ ...TEST_AUTHORITY, jiraAdministration: 'deny' });
  const claudeJiraDenied = await evaluateSafetyHook({ ...base, cwd: denyRoot, prompt_id: 'p', tool_input: { command: 'node plugins/kstack/scripts/kstack-jira-bootstrap.mjs apply' } });
  assert.equal(claudeJiraDenied.hookSpecificOutput.permissionDecision, 'deny');
  const codexJiraDenied = await evaluateSafetyHook({ ...base, cwd: denyRoot, model: 'gpt', turn_id: 'turn', tool_input: { command: 'node plugins/kstack/scripts/kstack-jira-bootstrap.mjs apply' } });
  assert.equal(codexJiraDenied.hookSpecificOutput.permissionDecision, 'deny');

  const codexCommit = await evaluateSafetyHook({ ...base, model: 'gpt', turn_id: 'turn', tool_input: { command: 'git commit -m safe' } });
  assert.equal(codexCommit.hookSpecificOutput, undefined);
  assert.match(codexCommit.systemMessage, /does not claim forced approval/u);

  for (const input of [
    { ...base, prompt_id: 'p', tool_name: 'Read', tool_input: { file_path: `${root}/.env` } },
    { ...base, model: 'gpt', turn_id: 'turn', tool_input: { command: 'printf "$JIRA_API_TOKEN"' } },
    { ...base, prompt_id: 'p', tool_name: 'Write', tool_input: { file_path: `${root}/out.txt`, content: 'token=abcdefghijklmnop' } }
  ]) assert.equal((await evaluateSafetyHook(input)).hookSpecificOutput.permissionDecision, 'deny');

  const tamper = await evaluateSafetyHook({ ...base, prompt_id: 'p', tool_name: 'Edit', tool_input: { file_path: `${root}/.kstack/config.json`, old_string: 'x', new_string: 'y' } });
  assert.equal(tamper.hookSpecificOutput, undefined);
  assert.match(tamper.systemMessage, /detect-only/u);

  const unavailable = await evaluateSafetyHook({ ...base, prompt_id: 'p', tool_name: 'mcp__kstack_safety__execute', tool_input: { handleId: 'x' } });
  assert.equal(unavailable.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(unavailable.hookSpecificOutput.permissionDecisionReason, /BROKER-UNAVAILABLE/u);
  for (const command of ['node plugins/kstack/scripts/kstack-safety-worker.mjs', 'node plugins/kstack/scripts/kstack-safety-executor.mjs', 'node plugins/kstack/scripts/kstack-git-askpass.mjs']) {
    const direct = await evaluateSafetyHook({ ...base, prompt_id: 'p', tool_input: { command } });
    assert.equal(direct.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(direct.hookSpecificOutput.permissionDecisionReason, /BROKER-DIRECT/u);
  }

  const changedAuthority = { ...TEST_AUTHORITY, deploy: 'ask', deviceInstall: 'ask' };
  const changedRoot = activeRoot(changedAuthority);
  const codexDeploy = await evaluateSafetyHook({ ...base, cwd: changedRoot, model: 'gpt', turn_id: 'turn', tool_input: { command: 'wrangler deploy' } });
  assert.equal(codexDeploy.hookSpecificOutput, undefined);
  const claudeDeploy = await evaluateSafetyHook({ ...base, cwd: changedRoot, prompt_id: 'p', tool_input: { command: 'wrangler deploy' } });
  assert.equal(claudeDeploy.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(claudeDeploy.hookSpecificOutput.permissionDecisionReason, /broker/u);

  const malformedRoot = activeRoot();
  const registrationFile = path.join(malformedRoot, '.kstack', 'safety-hooks.json');
  const malformedRegistration = JSON.parse(fs.readFileSync(registrationFile, 'utf8'));
  fs.writeFileSync(registrationFile, JSON.stringify({ ...malformedRegistration, enabled: 'false' }), { mode: 0o600 });
  const malformedVerdict = await evaluateSafetyHook({ ...base, cwd: malformedRoot, model: 'gpt', turn_id: 'turn', tool_input: { command: 'git commit -m safe' } });
  assert.equal(malformedVerdict.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(malformedVerdict.hookSpecificOutput.permissionDecisionReason, /untrusted/u);

  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-outside-'));
  const executableCases = [
    { name: 'outside enrollment', input: JSON.stringify({ ...base, cwd: outsideRoot, tool_input: { command: 'git status' } }), check: (value) => assert.deepEqual(value, {}) },
    { name: 'enrolled allowed action', input: JSON.stringify({ ...base, tool_input: { command: 'git status' } }), check: (value) => assert.deepEqual(value, {}) },
    { name: 'covered deny action', input: JSON.stringify({ ...base, tool_input: { command: 'printf "$JIRA_API_TOKEN"' } }), check: (value) => assert.equal(value.hookSpecificOutput.permissionDecision, 'deny') },
    { name: 'malformed input', input: '{}', check: (value) => assert.equal(value.hookSpecificOutput.permissionDecision, 'deny') },
    { name: 'oversized input', input: hookEnvelopeWithSize(root, HOOK_INPUT_LIMIT + 1), check: (value) => { assert.equal(value.hookSpecificOutput.permissionDecision, 'deny'); assert.match(value.hookSpecificOutput.permissionDecisionReason, /exceeds/u); } }
  ];
  for (const [host, manifest] of Object.entries(manifests)) {
    for (const handler of manifest.hooks.PreToolUse[0].hooks) {
      for (const fixture of executableCases) {
        const result = runManifestHook(handler, fixture.input, host);
        assert.equal(result.status, 0, `${host} ${fixture.name}: ${result.stderr}`);
        assert.equal(result.stderr, '', `${host} ${fixture.name}`);
        assert.ok(Buffer.byteLength(result.stdout, 'utf8') <= 4 * 1024, `${host} ${fixture.name}`);
        fixture.check(JSON.parse(result.stdout));
      }
    }
  }
});

test('clean project enrollment regenerates local state while only the canonical plugin hook ships', () => {
  const ignored = fs.readFileSync('.gitignore', 'utf8').split('\n');
  for (const entry of ['.kstack/safety-hooks.json', '.kstack/rollback/', '/scripts/kstack-safety-hook.mjs']) {
    assert.equal(ignored.includes(entry), true, `${entry} must remain repository-local`);
  }

  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-clean-project-'));
  const pluginRoot = path.resolve('plugins/kstack');
  writePolicy(projectRoot);
  const registrationFile = path.join(projectRoot, '.kstack', 'safety-hooks.json');
  assert.equal(fs.existsSync(registrationFile), false);
  const installed = activateSafetyHooks({ projectRoot, pluginRoot, preserveDisabled: true });
  assert.equal(installed.file, registrationFile);
  assert.equal(installed.enabled, true);
  const registration = JSON.parse(fs.readFileSync(registrationFile, 'utf8'));

  const auditManifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'install-health-audit-manifest-v1.json'), 'utf8'));
  const shippedHooks = auditManifest.entries.filter((entry) => entry.path.endsWith('/kstack-safety-hook.mjs'));
  assert.deepEqual(shippedHooks.map((entry) => entry.path), ['scripts/kstack-safety-hook.mjs']);
  assert.equal(shippedHooks[0].sha256, registration.releaseDigests['scripts/kstack-safety-hook.mjs']);
  assert.equal(shippedHooks[0].sha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(pluginRoot, 'scripts', 'kstack-safety-hook.mjs'))).digest('hex'));

  const setup = fs.readFileSync('setup', 'utf8');
  assert.match(setup, /if \[ "\$SCOPE" = "project" \]; then/u);
  assert.match(setup, /install --project-root "\$TARGET" --plugin-root "\$ROOT\/plugins\/kstack"/u);
});

test('activation is idempotent, preserves explicit disablement, and reports control-plane tampering without blocking ordinary edits', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-admin-project-'));
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-admin-plugin-'));
  writePolicy(projectRoot);
  const sourceRoot = path.resolve('plugins/kstack');
  for (const relative of ['hooks/hooks.json', 'scripts/kstack-safety-admin.mjs', 'scripts/kstack-safety-broker.mjs', 'scripts/kstack-safety-executor.mjs', 'scripts/kstack-safety-worker.mjs', 'scripts/kstack-git-askpass.mjs', 'scripts/kstack-jira-bootstrap.mjs', 'scripts/kstack-safety-hook.mjs', 'scripts/kstack-safety-matchers.mjs']) {
    fs.mkdirSync(path.dirname(path.join(pluginRoot, relative)), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relative), path.join(pluginRoot, relative));
  }
  const activated = activateSafetyHooks({ projectRoot, pluginRoot });
  assert.equal(activated.enabled, true);
  assert.ok(JSON.parse(fs.readFileSync(activated.file, 'utf8')).protectedCredentialPaths.includes(defaultGitPushCredentialPath()));
  assert.equal(fs.existsSync(activated.audit), true);
  assert.equal(readActivation(projectRoot, { pluginRoot }).status, 'ENABLED');
  const priorPluginRoot = process.env.PLUGIN_ROOT;
  process.env.PLUGIN_ROOT = path.join(os.tmpdir(), 'deleted-codex-cache-root');
  try {
    assert.equal(readActivation(projectRoot).status, 'ENABLED');
  } finally {
    if (priorPluginRoot === undefined) delete process.env.PLUGIN_ROOT;
    else process.env.PLUGIN_ROOT = priorPluginRoot;
  }
  const disabled = setSafetyHooksEnabled(projectRoot, false);
  assert.equal(fs.existsSync(disabled.audit), true);
  assert.equal(activateSafetyHooks({ projectRoot, pluginRoot, preserveDisabled: true }).enabled, false);
  const enabled = setSafetyHooksEnabled(projectRoot, true);
  assert.equal(fs.existsSync(enabled.audit), true);
  fs.appendFileSync(path.join(pluginRoot, 'hooks', 'hooks.json'), '\n');
  const status = readActivation(projectRoot, { pluginRoot });
  assert.equal(status.active, true);
  assert.equal(status.status, 'TAMPERED');
  const rolledBack = rollbackSafetyHooks(projectRoot);
  assert.equal(rolledBack.active, false);
  assert.equal(fs.existsSync(rolledBack.file), false);
  assert.equal(fs.existsSync(rolledBack.backup), true);
  assert.equal(fs.existsSync(rolledBack.audit), true);
  const auditActions = fs.readdirSync(path.join(projectRoot, '.kstack', 'safety-hooks-audit')).map((name) => JSON.parse(fs.readFileSync(path.join(projectRoot, '.kstack', 'safety-hooks-audit', name), 'utf8')).action);
  assert.deepEqual(auditActions.sort(), ['activate', 'disable', 'enable', 'install', 'rollback']);
  assert.equal(readActivation(projectRoot, { pluginRoot }).status, 'OUTSIDE-ENROLLMENT');
});

test('project enrollment trusts canonical regular state regardless of projected permission bits', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-default-trust-'));
  const pluginRoot = path.resolve('plugins/kstack');
  writePolicy(projectRoot);
  const activated = activateSafetyHooks({ projectRoot, pluginRoot });
  fs.chmodSync(path.join(projectRoot, '.kstack'), 0o777);
  fs.chmodSync(path.join(projectRoot, '.kstack', 'config.json'), 0o666);
  fs.chmodSync(path.join(projectRoot, '.kstack', 'safety-hooks.json'), 0o666);
  const status = readActivation(projectRoot, { pluginRoot });
  assert.equal(status.active, true);
  assert.equal(status.status, 'ENABLED');
});

test('safety administration rejects duplicate-key repository policy through the shared config boundary', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-safety-admin-duplicate-config-'));
  writePolicy(projectRoot);
  const configPath = path.join(projectRoot, '.kstack', 'config.json');
  const source = fs.readFileSync(configPath, 'utf8');
  fs.writeFileSync(configPath, source.replace('"authority":{', '"authority":{},"authority":{'), { mode: 0o600 });
  assert.throws(() => activateSafetyHooks({ projectRoot, pluginRoot: path.resolve('plugins/kstack') }));
  assert.equal(fs.existsSync(path.join(projectRoot, '.kstack', 'safety-hooks.json')), false);
});

test('canonical output is deterministic and broker failures use typed non-secret errors', () => {
  assert.equal(canonicalJson({ b: 2, a: ['x', true] }), '{"a":["x",true],"b":2}');
  const error = new SafetyProtocolError('KSG-TEST-001');
  assert.equal(error.code, 'KSG-TEST-001');
  assert.equal(typeof new SafetyBroker().executor, 'function');
});
