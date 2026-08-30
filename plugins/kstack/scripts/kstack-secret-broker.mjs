#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './kstack-safety-broker.mjs';
import { findOutboundSecret } from './kstack-safety-matchers.mjs';

export const SECRET_INVENTORY_SCHEMA = 'kstack-secret-inventory-v1';
export const SECRET_PLAN_SCHEMA = 'kstack-secret-migration-plan-v1';
export const SECRET_RECEIPT_SCHEMA = 'kstack-secret-operation-receipt-v1';
export const SECRET_LIMITS = Object.freeze({ inventoryBytes: 256 * 1024, entries: 512, labelBytes: 160, identifierBytes: 96 });

const KINDS = new Set(['password', 'api-token', 'client-credential', 'certificate-private-key', 'dynamic-credential']);
const ENVIRONMENTS = new Set(['personal', 'development', 'staging', 'production', 'recovery']);
const SOURCE_CUSTODY = new Set(['protected-file', 'ordinary-environment', 'os-custody', 'provider-vault', 'manual-entry', 'unknown']);
const BACKENDS = new Set(['windows-dpapi-current-user-v1', 'macos-keychain-v1', 'linux-secret-service-v1', 'openbao-v1']);
const ADAPTERS = new Set(['jira-cloud-auth-v1', 'git-https-v1', 'ssh-v1', 'database-v1', 'certificate-sign-v1', 'provider-api-v1']);
const SOURCE_DISPOSITION = 'retain-until-separate-approval';
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const SAFE_LABEL = /^[\p{L}\p{N}][\p{L}\p{N} ._()\/+:-]{0,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

export class SecretBrokerError extends Error {
  constructor(code) { super(code); this.name = 'SecretBrokerError'; this.code = code; }
}

function fail(code) { throw new SecretBrokerError(code); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, expected, code = 'KSTACK_SECRET_SCHEMA_INVALID') {
  if (!plain(value) || Object.keys(value).sort().join('\0') !== [...expected].sort().join('\0')) fail(code);
}
function boundedId(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > SECRET_LIMITS.identifierBytes || !SAFE_ID.test(value)) fail('KSTACK_SECRET_IDENTIFIER_INVALID');
  return value;
}
function boundedLabel(value) {
  if (typeof value !== 'string' || !value.isWellFormed() || CONTROL_OR_BIDI.test(value) || Buffer.byteLength(value, 'utf8') > SECRET_LIMITS.labelBytes || !SAFE_LABEL.test(value)) fail('KSTACK_SECRET_LABEL_INVALID');
  if (findOutboundSecret(Buffer.from(value, 'utf8'))) fail('KSTACK_SECRET_METADATA_REJECTED');
  return value;
}
function member(value, set, code) { if (typeof value !== 'string' || !set.has(value)) fail(code); return value; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

export function validateSecretInventory(value) {
  exactKeys(value, ['schemaVersion', 'inventoryId', 'ownerDecisionId', 'entries']);
  if (value.schemaVersion !== SECRET_INVENTORY_SCHEMA) fail('KSTACK_SECRET_SCHEMA_INVALID');
  boundedId(value.inventoryId);
  boundedId(value.ownerDecisionId);
  if (!Array.isArray(value.entries) || value.entries.length > SECRET_LIMITS.entries) fail('KSTACK_SECRET_INVENTORY_LIMIT');
  const seen = new Set();
  const entries = value.entries.map((entry) => {
    exactKeys(entry, ['entryId', 'kind', 'purposeLabel', 'environment', 'targetLabel', 'sourceCustody', 'desiredBackend', 'adapterId', 'rotationRequired', 'sourceDisposition']);
    boundedId(entry.entryId);
    if (seen.has(entry.entryId)) fail('KSTACK_SECRET_INVENTORY_DUPLICATE');
    seen.add(entry.entryId);
    member(entry.kind, KINDS, 'KSTACK_SECRET_KIND_INVALID');
    boundedLabel(entry.purposeLabel);
    member(entry.environment, ENVIRONMENTS, 'KSTACK_SECRET_ENVIRONMENT_INVALID');
    boundedLabel(entry.targetLabel);
    member(entry.sourceCustody, SOURCE_CUSTODY, 'KSTACK_SECRET_SOURCE_INVALID');
    member(entry.desiredBackend, BACKENDS, 'KSTACK_SECRET_BACKEND_INVALID');
    member(entry.adapterId, ADAPTERS, 'KSTACK_SECRET_ADAPTER_INVALID');
    if (typeof entry.rotationRequired !== 'boolean' || entry.sourceDisposition !== SOURCE_DISPOSITION) fail('KSTACK_SECRET_LIFECYCLE_INVALID');
    return clone(entry);
  });
  const inventory = { schemaVersion: value.schemaVersion, inventoryId: value.inventoryId, ownerDecisionId: value.ownerDecisionId, entries };
  const canonical = `${canonicalJson(inventory)}\n`;
  if (Buffer.byteLength(canonical, 'utf8') > SECRET_LIMITS.inventoryBytes) fail('KSTACK_SECRET_INVENTORY_LIMIT');
  return Object.freeze({
    inventory: Object.freeze({ ...inventory, entries: Object.freeze(entries.map(Object.freeze)) }),
    canonical,
    sha256: digest(canonical)
  });
}

const REQUIRED_CHECKS = Object.freeze([
  'synthetic-backend-lifecycle',
  'synthetic-target-operation',
  'positive-control-leakage',
  'rotation-and-revocation',
  'recovery-and-rollback',
  'source-retention'
]);

export function createSecretMigrationPlan(inventoryValue, capabilities = {}) {
  const checked = validateSecretInventory(inventoryValue);
  exactKeys(capabilities, ['platformCell', 'qualifiedCells'], 'KSTACK_SECRET_CAPABILITIES_INVALID');
  member(capabilities.platformCell, BACKENDS, 'KSTACK_SECRET_BACKEND_INVALID');
  if (!Array.isArray(capabilities.qualifiedCells) || capabilities.qualifiedCells.some((item) => typeof item !== 'string')) fail('KSTACK_SECRET_CAPABILITIES_INVALID');
  const qualified = new Set(capabilities.qualifiedCells);
  const items = checked.inventory.entries.map((entry) => {
    const reasons = [];
    if (entry.desiredBackend !== capabilities.platformCell) reasons.push('BACKEND_NOT_ACTIVE_ON_THIS_CELL');
    if (!qualified.has(`${entry.desiredBackend}:${entry.adapterId}`)) reasons.push('BACKEND_ADAPTER_CELL_NOT_SYNTHETICALLY_QUALIFIED');
    if (entry.adapterId !== 'jira-cloud-auth-v1') reasons.push('TARGET_ADAPTER_NOT_IMPLEMENTED');
    if (!['api-token', 'client-credential'].includes(entry.kind) && entry.adapterId === 'jira-cloud-auth-v1') reasons.push('CREDENTIAL_KIND_ADAPTER_MISMATCH');
    return Object.freeze({
      entryId: entry.entryId,
      disposition: reasons.length === 0 ? 'READY_FOR_NO_ECHO_ENROLLMENT' : 'BLOCKED_UNQUALIFIED',
      reasons: Object.freeze(reasons),
      requiredChecks: REQUIRED_CHECKS
    });
  });
  const plan = { schemaVersion: SECRET_PLAN_SCHEMA, inventoryId: checked.inventory.inventoryId, inventorySha256: checked.sha256, platformCell: capabilities.platformCell, items };
  const canonical = `${canonicalJson(plan)}\n`;
  return Object.freeze({ plan: Object.freeze(plan), canonical, sha256: digest(canonical) });
}

export function validateSecretReceipt(value) {
  exactKeys(value, ['schemaVersion', 'operationId', 'handleDigest', 'backendId', 'adapterId', 'targetDigest', 'generation', 'outcome', 'occurredAt']);
  if (value.schemaVersion !== SECRET_RECEIPT_SCHEMA) fail('KSTACK_SECRET_RECEIPT_INVALID');
  boundedId(value.operationId);
  if (![value.handleDigest, value.targetDigest].every((item) => typeof item === 'string' && SHA256.test(item))) fail('KSTACK_SECRET_RECEIPT_INVALID');
  member(value.backendId, BACKENDS, 'KSTACK_SECRET_RECEIPT_INVALID');
  member(value.adapterId, ADAPTERS, 'KSTACK_SECRET_RECEIPT_INVALID');
  if (!Number.isSafeInteger(value.generation) || value.generation < 1 || !['SUCCEEDED', 'DENIED', 'AMBIGUOUS', 'FAILED'].includes(value.outcome)) fail('KSTACK_SECRET_RECEIPT_INVALID');
  const occurredAtMs = typeof value.occurredAt === 'string' ? Date.parse(value.occurredAt) : Number.NaN;
  if (!Number.isFinite(occurredAtMs) || new Date(occurredAtMs).toISOString() !== value.occurredAt) fail('KSTACK_SECRET_RECEIPT_INVALID');
  return Object.freeze(clone(value));
}

function trustedJsonFile(file) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > SECRET_LIMITS.inventoryBytes) fail('KSTACK_SECRET_INVENTORY_FILE_UNTRUSTED');
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch { fail('KSTACK_SECRET_INVENTORY_FILE_INVALID'); }
  return parsed;
}

export function parseSecretArgs(argv) {
  const [command, ...rest] = argv;
  if (command === 'template' && rest.length === 0) return { command };
  if (command === 'validate-inventory' && rest.length === 2 && rest[0] === '--file') return { command, file: rest[1] };
  if (command === 'plan' && rest.length >= 4 && rest[0] === '--file' && rest[2] === '--platform-cell') {
    const qualifiedCells = [];
    for (let index = 4; index < rest.length; index += 2) {
      if (rest[index] !== '--qualified-cell' || !rest[index + 1]) fail('KSTACK_SECRET_ARGUMENTS_INVALID');
      qualifiedCells.push(rest[index + 1]);
    }
    return { command, file: rest[1], platformCell: rest[3], qualifiedCells };
  }
  fail('KSTACK_SECRET_ARGUMENTS_INVALID');
}

async function cli(argv) {
  const args = parseSecretArgs(argv);
  if (args.command === 'template') {
    process.stdout.write(`${JSON.stringify({ schemaVersion: SECRET_INVENTORY_SCHEMA, inventoryId: 'owner-inventory-2026-08-28', ownerDecisionId: 'secret-broker-owner-priority-2026-08-28', entries: [] }, null, 2)}\n`);
    return;
  }
  const inventory = trustedJsonFile(args.file);
  if (args.command === 'validate-inventory') {
    const result = validateSecretInventory(inventory);
    process.stdout.write(`${JSON.stringify({ status: 'VALID', entries: result.inventory.entries.length, inventorySha256: result.sha256 })}\n`);
    return;
  }
  const result = createSecretMigrationPlan(inventory, { platformCell: args.platformCell, qualifiedCells: args.qualifiedCells });
  process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof SecretBrokerError ? error.code : 'KSTACK_SECRET_INTERNAL_ERROR'}\n`);
    process.exitCode = 1;
  });
}
