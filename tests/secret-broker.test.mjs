import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createSecretMigrationPlan,
  loadSecretBrokerDesignRegistry,
  parseSecretArgs,
  secretBrokerBaselineStatus,
  SECRET_IMPLEMENTATION_REASON,
  SECRET_IMPLEMENTATION_STATE,
  SECRET_INVENTORY_SCHEMA,
  SECRET_RECEIPT_SCHEMA,
  validateSecretInventory,
  validateSecretReceipt
} from '../plugins/kstack/scripts/kstack-secret-broker.mjs';
import {
  canonicalSecretPublicBytes,
  createOpaqueCandidate,
  parsePublicRequest,
  publicUnavailableResult,
  publicUnavailableResultFromBytes,
  validateCursor,
  validateHandleId,
  validateOpaqueRef,
  validatePublicMetadataValue,
  validatePublicResultValue,
  validateRegistryId,
  validateSafeLabelSyntax
} from '../plugins/kstack/scripts/secret-broker/public-v1.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secretBroker = path.join(repositoryRoot, 'plugins', 'kstack', 'scripts', 'kstack-secret-broker.mjs');
const windowsHelper = path.join(repositoryRoot, 'plugins', 'kstack', 'workers', 'kstack-secret-windows.ps1');
const linuxHelper = path.join(repositoryRoot, 'plugins', 'kstack', 'scripts', 'kstack-secret-linux.mjs');
const fakeSecretToolSource = path.join(repositoryRoot, 'tests', 'helpers', 'fake-secret-tool.mjs');
const publicRequestSchema = path.join(repositoryRoot, 'plugins', 'kstack', 'schemas', 'secret-broker', 'v1', 'public-request.schema.json');
const publicResultSchema = path.join(repositoryRoot, 'plugins', 'kstack', 'schemas', 'secret-broker', 'v1', 'public-result.schema.json');

function windowsPath(value) {
  const match = /^\/mnt\/([a-zA-Z])\/(.*)$/u.exec(value);
  return match ? `${match[1].toUpperCase()}:\\${match[2].replaceAll('/', '\\')}` : value;
}

function inventory() {
  return {
    schemaVersion: SECRET_INVENTORY_SCHEMA,
    inventoryId: 'owner-inventory-2026-08-28',
    ownerDecisionId: 'secret-broker-owner-priority-2026-08-28',
    entries: [{
      entryId: 'jira-development-api',
      kind: 'api-token',
      purposeLabel: 'Jira development issue tracking',
      environment: 'development',
      targetLabel: 'AuthorityGate Jira Cloud',
      sourceCustody: 'protected-file',
      desiredBackend: 'windows-dpapi-current-user-v1',
      adapterId: 'jira-cloud-auth-v1',
      rotationRequired: true,
      sourceDisposition: 'retain-until-separate-approval'
    }]
  };
}

function publicMetadata(index = 1) {
  const handleBytes = Buffer.alloc(32); handleBytes.writeUInt32BE(index, 28);
  const targetBytes = Buffer.alloc(16); targetBytes.writeUInt32BE(index, 12);
  return {
    schemaVersion: 'kstack-secret-safe-handle-metadata-v1',
    handleId: `ksh1_${handleBytes.toString('base64url')}`,
    purposeId: 'jira-tracking',
    purposeLabel: 'Issue tracker credential',
    credentialKind: 'api-token',
    environmentClass: 'development',
    backendFamilyId: 'linux-secret-service',
    adapterId: 'jira-cloud-auth',
    targetRef: `ksr1_${targetBytes.toString('base64url')}`,
    targetLabel: 'Issue tracker',
    lifecycleClass: 'unavailable',
    generation: 1,
    expiryClass: 'unknown',
    evidenceLevel: 'configured'
  };
}

test('machine-binds the complete accepted design while keeping implementation unavailable', () => {
  const accepted = loadSecretBrokerDesignRegistry();
  assert.equal(accepted.registry.acceptedItems.length, 13);
  assert.equal(accepted.registry.acceptedItems[0].itemId, 'SB-TC00');
  assert.equal(accepted.registry.acceptedItems[12].itemId, 'SB-TC12');
  assert.equal(Object.isFrozen(accepted.registry.acceptedItems), true);
  assert.equal(Object.isFrozen(accepted.registry.acceptedItems[0]), true);
  assert.throws(() => accepted.registry.acceptedItems.push({}), TypeError);
  for (const item of accepted.registry.acceptedItems) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, item.repoRelativePath));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256, item.itemId);
  }
  const receiptBytes = fs.readFileSync(path.join(repositoryRoot, accepted.registry.closure.repoRelativePath));
  assert.equal(crypto.createHash('sha256').update(receiptBytes).digest('hex'), accepted.registry.closure.sha256);
  assert.deepEqual(secretBrokerBaselineStatus(), {
    schemaVersion: 'kstack-secret-broker-baseline-status-v1',
    status: SECRET_IMPLEMENTATION_STATE,
    reason: SECRET_IMPLEMENTATION_REASON,
    acceptedItems: 13,
    acceptedDesignRegistrySha256: accepted.sha256
  });
});

test('validates and deterministically digests a metadata-only inventory', () => {
  const first = validateSecretInventory(inventory());
  const second = validateSecretInventory(inventory());
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.inventory.entries.length, 1);
  assert.equal(Object.isFrozen(first.inventory.entries[0]), true);
  assert.equal(first.canonical.includes('Jira development issue tracking'), true);
});

test('rejects unknown fields, duplicate IDs, unsafe lifecycle, and control text', () => {
  const unknown = inventory(); unknown.entries[0].value = 'not-admitted';
  assert.throws(() => validateSecretInventory(unknown), /KSTACK_SECRET_SCHEMA_INVALID/u);
  const duplicate = inventory(); duplicate.entries.push({ ...duplicate.entries[0] });
  assert.throws(() => validateSecretInventory(duplicate), /KSTACK_SECRET_INVENTORY_DUPLICATE/u);
  const lifecycle = inventory(); lifecycle.entries[0].sourceDisposition = 'delete-now';
  assert.throws(() => validateSecretInventory(lifecycle), /KSTACK_SECRET_LIFECYCLE_INVALID/u);
  const control = inventory(); control.entries[0].targetLabel = 'unsafe\nlabel';
  assert.throws(() => validateSecretInventory(control), /KSTACK_SECRET_LABEL_INVALID/u);
});

test('keeps the retired Windows Jira cell blocked even when previously qualified', () => {
  const blocked = createSecretMigrationPlan(inventory(), {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: []
  });
  assert.equal(blocked.plan.items[0].disposition, 'UNAVAILABLE');
  assert.deepEqual(blocked.plan.items[0].reasons, ['IMPLEMENTATION_NONCONFORMANT', 'WINDOWS_JIRA_CELL_RETIRED']);

  const retired = createSecretMigrationPlan(inventory(), {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: ['windows-dpapi-current-user-v1:jira-cloud-auth-v1']
  });
  assert.equal(retired.plan.items[0].disposition, 'UNAVAILABLE');
  assert.deepEqual(retired.plan.items[0].reasons, ['IMPLEMENTATION_NONCONFORMANT', 'WINDOWS_JIRA_CELL_RETIRED']);
  assert.equal(retired.plan.items[0].requiredChecks.includes('source-retention'), true);
});

test('does not promote unsupported adapters or another backend cell', () => {
  const value = inventory();
  value.entries[0].adapterId = 'ssh-v1';
  const unsupported = createSecretMigrationPlan(value, {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: ['windows-dpapi-current-user-v1:ssh-v1']
  });
  assert.deepEqual(unsupported.plan.items[0].reasons, ['IMPLEMENTATION_NONCONFORMANT', 'CALLER_QUALIFICATION_NOT_AUTHORITATIVE', 'TARGET_ADAPTER_NOT_IMPLEMENTED']);

  const other = inventory(); other.entries[0].desiredBackend = 'openbao-v1';
  const unavailable = createSecretMigrationPlan(other, {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: ['openbao-v1:jira-cloud-auth-v1']
  });
  assert.deepEqual(unavailable.plan.items[0].reasons, ['IMPLEMENTATION_NONCONFORMANT', 'BACKEND_NOT_ACTIVE_ON_THIS_CELL', 'CALLER_QUALIFICATION_NOT_AUTHORITATIVE']);
});

test('admits the Linux Jira cell only when that exact backend and adapter are qualified', () => {
  const value = inventory();
  value.entries[0].desiredBackend = 'linux-secret-service-v1';
  const blocked = createSecretMigrationPlan(value, {
    platformCell: 'linux-secret-service-v1', qualifiedCells: ['windows-dpapi-current-user-v1:jira-cloud-auth-v1']
  });
  assert.deepEqual(blocked.plan.items[0].reasons, ['IMPLEMENTATION_NONCONFORMANT', 'BACKEND_ADAPTER_CELL_NOT_SYNTHETICALLY_QUALIFIED']);
  const callerClaimed = createSecretMigrationPlan(value, {
    platformCell: 'linux-secret-service-v1', qualifiedCells: ['linux-secret-service-v1:jira-cloud-auth-v1']
  });
  assert.equal(callerClaimed.plan.items[0].disposition, 'UNAVAILABLE');
  assert.deepEqual(callerClaimed.plan.items[0].reasons, ['IMPLEMENTATION_NONCONFORMANT', 'CALLER_QUALIFICATION_NOT_AUTHORITATIVE']);
});

test('accepts only fixed content-free receipts', () => {
  const value = {
    schemaVersion: SECRET_RECEIPT_SCHEMA,
    operationId: 'operation-1',
    handleDigest: 'a'.repeat(64),
    backendId: 'windows-dpapi-current-user-v1',
    adapterId: 'jira-cloud-auth-v1',
    targetDigest: 'b'.repeat(64),
    generation: 1,
    outcome: 'SUCCEEDED',
    occurredAt: '2026-08-28T22:00:00.000Z'
  };
  assert.deepEqual(validateSecretReceipt(value), value);
  const response = { ...value, providerBody: 'not-admitted' };
  assert.throws(() => validateSecretReceipt(response), /KSTACK_SECRET_SCHEMA_INVALID/u);
  const badTime = { ...value, occurredAt: 'Friday' };
  assert.throws(() => validateSecretReceipt(badTime), /KSTACK_SECRET_RECEIPT_INVALID/u);
});

test('CLI parsing is closed and supports repeated explicit qualified cells', () => {
  assert.deepEqual(parseSecretArgs(['status']), { command: 'status' });
  assert.deepEqual(parseSecretArgs(['template']), { command: 'template' });
  assert.deepEqual(parseSecretArgs(['public-schema', '--name', 'request']), { command: 'public-schema', name: 'request' });
  assert.deepEqual(parseSecretArgs(['validate-public-request', '--file', 'request.json']), { command: 'validate-public-request', file: 'request.json' });
  assert.deepEqual(parseSecretArgs(['public-request', '--file', 'request.json']), { command: 'public-request', file: 'request.json' });
  assert.deepEqual(parseSecretArgs(['validate-inventory', '--file', 'inventory.json']), { command: 'validate-inventory', file: 'inventory.json' });
  assert.deepEqual(parseSecretArgs(['plan', '--file', 'inventory.json', '--platform-cell', 'windows-dpapi-current-user-v1', '--qualified-cell', 'windows-dpapi-current-user-v1:jira-cloud-auth-v1']), {
    command: 'plan', file: 'inventory.json', platformCell: 'windows-dpapi-current-user-v1', qualifiedCells: ['windows-dpapi-current-user-v1:jira-cloud-auth-v1']
  });
  assert.throws(() => parseSecretArgs(['plan', '--file', 'inventory.json']), /KSTACK_SECRET_ARGUMENTS_INVALID/u);
});

test('WP01 opaque candidates have exact random domains and no semantic payload', () => {
  const handles = new Set();
  const refs = new Set();
  for (let index = 0; index < 512; index += 1) {
    const handle = createOpaqueCandidate('handle');
    const ref = createOpaqueCandidate('ref');
    validateHandleId(handle);
    validateOpaqueRef(ref);
    handles.add(handle);
    refs.add(ref);
    assert.equal(handle.length, 48);
    assert.equal(ref.length, 27);
  }
  assert.equal(handles.size, 512);
  assert.equal(refs.size, 512);
  assert.throws(() => createOpaqueCandidate('cursor'), /KSTACK_SECRET_OPAQUE_CANDIDATE_INVALID/u);
});

test('WP01 canonical public request parsing rejects hostile JSON before lookup', () => {
  const handleId = `ksh1_${Buffer.alloc(32, 1).toString('base64url')}`;
  const describe = { handleId, operation: 'describe', schemaVersion: 'kstack-secret-describe-request-v1' };
  assert.deepEqual(parsePublicRequest(canonicalSecretPublicBytes(describe)), describe);
  assert.throws(() => parsePublicRequest(Buffer.from(`{"handleId":"${handleId}","operation":"describe","operation":"describe","schemaVersion":"kstack-secret-describe-request-v1"}`)), /KSTACK_SECRET_PUBLIC_REQUEST_INVALID/u);
  assert.throws(() => parsePublicRequest(Buffer.from(`{ "handleId":"${handleId}","operation":"describe","schemaVersion":"kstack-secret-describe-request-v1"}`)), /KSTACK_SECRET_PUBLIC_REQUEST_INVALID/u);
  assert.throws(() => parsePublicRequest(Buffer.from('{"operation":"describe","schemaVersion":"kstack-secret-describe-request-v2"}')), /KSTACK_SECRET_PUBLIC_SCHEMA_UNSUPPORTED/u);
  assert.throws(() => parsePublicRequest(Buffer.from('{"operation":"list","pageSize":1.0,"schemaVersion":"kstack-secret-list-request-v1"}')), /KSTACK_SECRET_PUBLIC_REQUEST_INVALID/u);
  assert.throws(() => parsePublicRequest(Buffer.concat([canonicalSecretPublicBytes(describe), Buffer.from('\n')])), /KSTACK_SECRET_PUBLIC_REQUEST_INVALID/u);
});

test('WP01 public request schemas are closed, bounded, and exact-filter-only', () => {
  const list = parsePublicRequest(Buffer.from('{"adapterId":"jira-cloud-auth","environmentClass":"development","operation":"list","pageSize":50,"purposeId":"jira-tracking","schemaVersion":"kstack-secret-list-request-v1"}'));
  assert.equal(list.pageSize, 50);
  assert.throws(() => parsePublicRequest(Buffer.from('{"operation":"list","pageSize":51,"schemaVersion":"kstack-secret-list-request-v1"}')), /KSTACK_SECRET_PUBLIC_SCHEMA_INVALID/u);
  assert.throws(() => parsePublicRequest(Buffer.from('{"operation":"list","pageSize":1,"query":"jira","schemaVersion":"kstack-secret-list-request-v1"}')), /KSTACK_SECRET_PUBLIC_SCHEMA_INVALID/u);
  assert.throws(() => validateRegistryId('A-bad-id'), /KSTACK_SECRET_REGISTRY_ID_INVALID/u);
  assert.throws(() => validateCursor('ksc1_not+base64'), /KSTACK_SECRET_CURSOR_INVALID/u);
});

test('WP01 metadata validation is recursively closed without claiming protected projection authority', () => {
  const metadata = validatePublicMetadataValue(publicMetadata());
  assert.equal(Object.isFrozen(metadata), true);
  assert.equal(Object.isFrozen(metadata.targetRef), true);
  assert.equal(metadata.targetLabel, 'Issue tracker');
  assert.throws(() => validatePublicMetadataValue({ ...publicMetadata(), backendLocator: 'not-public' }), /KSTACK_SECRET_PUBLIC_SCHEMA_INVALID/u);
  assert.throws(() => validatePublicMetadataValue({ ...publicMetadata(), purposeLabel: 'user@example.com' }), /KSTACK_SECRET_SAFE_LABEL_INVALID/u);
  assert.throws(() => validatePublicMetadataValue({ ...publicMetadata(), targetLabel: 'https://example.com/path' }), /KSTACK_SECRET_SAFE_LABEL_INVALID/u);
  assert.throws(() => validateSafeLabelSyntax(' leading'), /KSTACK_SECRET_SAFE_LABEL_INVALID/u);
  assert.equal(validateSafeLabelSyntax('Development issue tracker'), 'Development issue tracker');
});

test('WP01 fixed unavailable results do not disclose requested handles or cursors', () => {
  const describe = { schemaVersion: 'kstack-secret-describe-request-v1', operation: 'describe', handleId: createOpaqueCandidate('handle') };
  const describeResult = publicUnavailableResult(describe);
  assert.deepEqual(describeResult, { schemaVersion: 'kstack-secret-describe-result-v1', outcome: 'unavailable', reason: 'HANDLE_UNAVAILABLE' });
  assert.equal(JSON.stringify(describeResult).includes(describe.handleId), false);

  const cursor = `ksc1_${Buffer.alloc(24, 7).toString('base64url')}`;
  const listResult = publicUnavailableResult({ schemaVersion: 'kstack-secret-list-request-v1', operation: 'list', pageSize: 1, cursor });
  assert.deepEqual(listResult, { schemaVersion: 'kstack-secret-list-result-v1', outcome: 'unavailable', reason: 'CURSOR_UNAVAILABLE' });
  assert.equal(JSON.stringify(listResult).includes(cursor), false);

  const malformed = Buffer.from('{"handleId":"not-a-handle","operation":"describe","schemaVersion":"kstack-secret-describe-request-v1"}');
  assert.deepEqual(publicUnavailableResultFromBytes(malformed), describeResult);
  const malformedCursor = Buffer.from('{"cursor":"not-a-cursor","operation":"list","pageSize":1,"schemaVersion":"kstack-secret-list-request-v1"}');
  assert.deepEqual(publicUnavailableResultFromBytes(malformedCursor), listResult);
});

test('WP01 available list validation requires raw-handle ordering and closed items', () => {
  const first = publicMetadata(1);
  const second = publicMetadata(2);
  const value = { schemaVersion: 'kstack-secret-list-result-v1', outcome: 'available', items: [first, second] };
  assert.deepEqual(validatePublicResultValue(value), value);
  assert.throws(() => validatePublicResultValue({ ...value, items: [second, first] }), /KSTACK_SECRET_PUBLIC_SCHEMA_INVALID/u);
  assert.throws(() => validatePublicResultValue({ ...value, totalCount: 2 }), /KSTACK_SECRET_PUBLIC_SCHEMA_INVALID/u);
});

test('WP01 checked-in public schema snapshots bind the exact v1 surface', () => {
  const requestBytes = fs.readFileSync(publicRequestSchema);
  const resultBytes = fs.readFileSync(publicResultSchema);
  const request = JSON.parse(requestBytes);
  const result = JSON.parse(resultBytes);
  assert.equal(request.oneOf.length, 2);
  assert.deepEqual(request.oneOf.map((entry) => entry.properties.operation.const), ['describe', 'list']);
  assert.equal(request.oneOf.every((entry) => entry.additionalProperties === false), true);
  assert.equal(result.oneOf.length, 4);
  assert.equal(result.$defs.metadata.additionalProperties, false);
  assert.equal(crypto.createHash('sha256').update(requestBytes).digest('hex'), '0384e1a4ca02c55f7c0c9438d8f54c345e739c6bf757c08d9632223d99c7aae1');
  assert.equal(crypto.createHash('sha256').update(resultBytes).digest('hex'), '47d02676a4570ba3fc22b060ef933faaa1c72a601c1bea9a7db8eff81ba856c2');
});

test('WP01 safe CLI validates or returns only fixed no-contact public records', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-public-request-'));
  const file = path.join(fixtureRoot, 'request.json');
  const request = { handleId: createOpaqueCandidate('handle'), operation: 'describe', schemaVersion: 'kstack-secret-describe-request-v1' };
  fs.writeFileSync(file, canonicalSecretPublicBytes(request), { mode: 0o600 });
  try {
    const validated = spawnSync(process.execPath, [secretBroker, 'validate-public-request', '--file', file], { encoding: 'utf8', timeout: 5000 });
    assert.equal(validated.status, 0, validated.stderr);
    assert.deepEqual(JSON.parse(validated.stdout), { schemaVersion: 'kstack-secret-public-validation-v1', status: 'VALID', operation: 'describe' });
    assert.equal(validated.stdout.includes(request.handleId), false);
    const result = spawnSync(process.execPath, [secretBroker, 'public-request', '--file', file], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { schemaVersion: 'kstack-secret-describe-result-v1', outcome: 'unavailable', reason: 'HANDLE_UNAVAILABLE' });
    assert.equal(result.stdout.includes(request.handleId), false);
    fs.writeFileSync(file, Buffer.from('{"handleId":"malformed","operation":"describe","schemaVersion":"kstack-secret-describe-request-v1"}'), { mode: 0o600 });
    const malformed = spawnSync(process.execPath, [secretBroker, 'public-request', '--file', file], { encoding: 'utf8', timeout: 5000 });
    assert.equal(malformed.status, 0, malformed.stderr);
    assert.deepEqual(JSON.parse(malformed.stdout), { schemaVersion: 'kstack-secret-describe-result-v1', outcome: 'unavailable', reason: 'HANDLE_UNAVAILABLE' });
    const schema = spawnSync(process.execPath, [secretBroker, 'public-schema', '--name', 'request'], { encoding: 'utf8', timeout: 5000 });
    assert.equal(schema.status, 0, schema.stderr);
    assert.equal(schema.stdout, fs.readFileSync(publicRequestSchema, 'utf8'));
  } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
});

test('CLI status is content-free and reports the fenced baseline', () => {
  const result = spawnSync(process.execPath, [secretBroker, 'status'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'UNAVAILABLE');
  assert.equal(output.reason, 'IMPLEMENTATION_NONCONFORMANT');
  assert.equal(output.acceptedItems, 13);
  assert.match(output.acceptedDesignRegistrySha256, /^[a-f0-9]{64}$/u);
});

test('Windows helper exposes only closed modes and no generic reveal or command parameter', () => {
  const source = fs.readFileSync(windowsHelper, 'utf8');
  assert.match(source, /ValidateSet\('Probe', 'SyntheticLifecycle', 'SyntheticJiraAdapter', 'EnrollInteractive', 'RotateInteractive', 'Revoke', 'Inventory', 'JiraAuthCheck'\)/u);
  assert.doesNotMatch(source, /^  \[(?:string|object)\]\$(?:Command|Arguments|OutputPath|Value|Email)/imu);
  assert.doesNotMatch(source, /Invoke-Expression|Start-Process|cmd\.exe/iu);
  assert.match(source, /AllowAutoRedirect = \$false/u);
  assert.match(source, /HttpCompletionOption\]::ResponseHeadersRead/u);
  assert.match(source, /DataProtectionScope\]::CurrentUser/u);
  assert.match(source, /\$\{Id\}\.revoked/u);
  assert.match(source, /'SyntheticJiraAdapter' \{ Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED' \}/u);
  assert.match(source, /'EnrollInteractive' \{ Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED' \}/u);
  assert.match(source, /'JiraAuthCheck' \{ Fail-Closed 'KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED' \}/u);
  assert.match(source, /Fail-Closed 'KSTACK_SECRET_WINDOWS_IMPLEMENTATION_UNAVAILABLE'/u);
});

test('Linux helper exposes a fixed Secret Service and Jira boundary', () => {
  const source = fs.readFileSync(linuxHelper, 'utf8');
  assert.match(source, /new Set\(\['Probe', 'SyntheticLifecycle', 'SyntheticJiraAdapter', 'EnrollInteractive', 'RotateInteractive', 'Revoke', 'Inventory', 'JiraAuthCheck'\]\)/u);
  assert.match(source, /const SECRET_TOOL = '\/usr\/bin\/secret-tool'/u);
  assert.match(source, /KSTACK_SECRET_LINUX_TEST_BOUNDARY_INVALID/u);
  assert.match(source, /response\.resume\(\)/u);
  assert.match(source, /redirectsDisabled: true/u);
  assert.doesNotMatch(source, /\bshell\s*:\s*true|execSync|execFileSync|spawn\(/u);
  assert.equal([...source.matchAll(/process\.stdout\.write/gu)].length, 1);
  assert.match(source, /function safeResult\(value\) \{ process\.stdout\.write\(`\$\{JSON\.stringify\(value\)\}\\n`\); \}/u);
  assert.match(source, /fail\('KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE'\)/u);
});

test('skill forbids generic inspection of secret-bearing source formats', () => {
  const skill = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'kstack', 'skills', 'kstack-secrets', 'SKILL.md'), 'utf8');
  const contract = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'kstack', 'references', 'SECRET_BROKER.md'), 'utf8');
  assert.match(skill, /never inspect its labels, delimiters, line structure, or value/u);
  assert.match(skill, /classify it as[\n ]+compromised, require rotation/u);
  assert.match(contract, /The source itself is opaque, including its apparent format/u);
});

test('Windows Secret Broker worker remains unavailable before conformance', { skip: !fs.existsSync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe') || process.env.KSTACK_WINDOWS_SECRET_QUALIFICATION !== '1' }, () => {
  const executable = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  const lifecycle = spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', windowsPath(windowsHelper), '-Mode', 'SyntheticLifecycle'], {
    encoding: 'utf8', timeout: 20_000, windowsHide: true
  });
  assert.equal(lifecycle.status, 1);
  assert.equal(lifecycle.stdout, '');
  assert.equal(lifecycle.stderr, 'KSTACK_SECRET_WINDOWS_IMPLEMENTATION_UNAVAILABLE\r\n');

  const adapter = spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', windowsPath(windowsHelper), '-Mode', 'SyntheticJiraAdapter'], {
    encoding: 'utf8', timeout: 20_000, windowsHide: true
  });
  assert.equal(adapter.status, 1);
  assert.equal(adapter.stdout, '');
  assert.equal(adapter.stderr, 'KSTACK_SECRET_WINDOWS_IMPLEMENTATION_UNAVAILABLE\r\n');
});

test('Linux Secret Broker paths remain unavailable and do not reach synthetic custody', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-linux-secret-test-'));
  const fakeSecretTool = path.join(fixtureRoot, 'fake-secret-tool.mjs');
  fs.copyFileSync(fakeSecretToolSource, fakeSecretTool);
  fs.chmodSync(fakeSecretTool, 0o700);
  try {
    for (const mode of ['SyntheticLifecycle', 'SyntheticJiraAdapter']) {
      const testRoot = path.join(fixtureRoot, `state-${mode}`);
      const result = spawnSync(process.execPath, [linuxHelper, '--mode', mode, '--test-root', testRoot, '--test-secret-tool', fakeSecretTool], {
        encoding: 'utf8', timeout: 20_000
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, 'KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE\n');
      assert.equal(fs.existsSync(testRoot), false);
    }
  } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
});

test('Linux probe reports implementation unavailable before backend contact', () => {
  const result = spawnSync(process.execPath, [linuxHelper, '--mode', 'Probe'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE\n');
});

test('real Linux Secret Service cell cannot bypass the implementation fence', {
  skip: process.platform !== 'linux' || !fs.existsSync('/usr/bin/secret-tool') || !process.env.DBUS_SESSION_BUS_ADDRESS
    || process.env.KSTACK_LINUX_SECRET_QUALIFICATION !== '1'
}, () => {
  for (const mode of ['SyntheticLifecycle', 'SyntheticJiraAdapter']) {
    const result = spawnSync(process.execPath, [linuxHelper, '--mode', mode], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE\n');
  }
});
