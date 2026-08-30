import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createSecretMigrationPlan,
  parseSecretArgs,
  SECRET_INVENTORY_SCHEMA,
  SECRET_RECEIPT_SCHEMA,
  validateSecretInventory,
  validateSecretReceipt
} from '../plugins/kstack/scripts/kstack-secret-broker.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windowsHelper = path.join(repositoryRoot, 'plugins', 'kstack', 'workers', 'kstack-secret-windows.ps1');

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

test('keeps unqualified cells blocked and admits only the exact qualified first cell', () => {
  const blocked = createSecretMigrationPlan(inventory(), {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: []
  });
  assert.equal(blocked.plan.items[0].disposition, 'BLOCKED_UNQUALIFIED');
  assert.deepEqual(blocked.plan.items[0].reasons, ['BACKEND_ADAPTER_CELL_NOT_SYNTHETICALLY_QUALIFIED']);

  const ready = createSecretMigrationPlan(inventory(), {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: ['windows-dpapi-current-user-v1:jira-cloud-auth-v1']
  });
  assert.equal(ready.plan.items[0].disposition, 'READY_FOR_NO_ECHO_ENROLLMENT');
  assert.deepEqual(ready.plan.items[0].reasons, []);
  assert.equal(ready.plan.items[0].requiredChecks.includes('source-retention'), true);
});

test('does not promote unsupported adapters or another backend cell', () => {
  const value = inventory();
  value.entries[0].adapterId = 'ssh-v1';
  const unsupported = createSecretMigrationPlan(value, {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: ['windows-dpapi-current-user-v1:ssh-v1']
  });
  assert.deepEqual(unsupported.plan.items[0].reasons, ['TARGET_ADAPTER_NOT_IMPLEMENTED']);

  const other = inventory(); other.entries[0].desiredBackend = 'openbao-v1';
  const unavailable = createSecretMigrationPlan(other, {
    platformCell: 'windows-dpapi-current-user-v1',
    qualifiedCells: ['openbao-v1:jira-cloud-auth-v1']
  });
  assert.deepEqual(unavailable.plan.items[0].reasons, ['BACKEND_NOT_ACTIVE_ON_THIS_CELL']);
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
  assert.deepEqual(parseSecretArgs(['template']), { command: 'template' });
  assert.deepEqual(parseSecretArgs(['validate-inventory', '--file', 'inventory.json']), { command: 'validate-inventory', file: 'inventory.json' });
  assert.deepEqual(parseSecretArgs(['plan', '--file', 'inventory.json', '--platform-cell', 'windows-dpapi-current-user-v1', '--qualified-cell', 'windows-dpapi-current-user-v1:jira-cloud-auth-v1']), {
    command: 'plan', file: 'inventory.json', platformCell: 'windows-dpapi-current-user-v1', qualifiedCells: ['windows-dpapi-current-user-v1:jira-cloud-auth-v1']
  });
  assert.throws(() => parseSecretArgs(['plan', '--file', 'inventory.json']), /KSTACK_SECRET_ARGUMENTS_INVALID/u);
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
});

test('skill forbids generic inspection of secret-bearing source formats', () => {
  const skill = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'kstack', 'skills', 'kstack-secrets', 'SKILL.md'), 'utf8');
  const contract = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'kstack', 'references', 'SECRET_BROKER.md'), 'utf8');
  assert.match(skill, /never inspect its labels, delimiters, line structure, or value/u);
  assert.match(skill, /classify it as[\n ]+compromised, require rotation/u);
  assert.match(contract, /The source itself is opaque, including its apparent format/u);
});

test('Windows DPAPI and Jira adapter synthetic cells emit fixed value-free results', { skip: !fs.existsSync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe') || process.env.KSTACK_WINDOWS_SECRET_QUALIFICATION !== '1' }, () => {
  const executable = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  for (const mode of ['SyntheticLifecycle', 'SyntheticJiraAdapter']) {
    const result = spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', windowsPath(windowsHelper), '-Mode', mode], {
      encoding: 'utf8', timeout: 20_000, windowsHide: true
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const output = JSON.parse(result.stdout);
    assert.equal(output.backendId, 'windows-dpapi-current-user-v1');
    assert.equal(output.valueOutputBytes, 0);
    assert.equal(result.stdout.includes('adapter-value'), false);
  }
});
