#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './kstack-safety-broker.mjs';
import { findOutboundSecret } from './kstack-safety-matchers.mjs';
import {
  canonicalSecretPublicBytes,
  parsePublicRequest,
  publicUnavailableResultFromBytes,
  SecretPublicError
} from './secret-broker/public-v1.mjs';

export const SECRET_INVENTORY_SCHEMA = 'kstack-secret-inventory-v1';
export const SECRET_PLAN_SCHEMA = 'kstack-secret-migration-plan-v1';
export const SECRET_RECEIPT_SCHEMA = 'kstack-secret-operation-receipt-v1';
export const SECRET_DESIGN_REGISTRY_SCHEMA = 'kstack-secret-broker-accepted-design-v1';
export const SECRET_IMPLEMENTATION_STATE = 'UNAVAILABLE';
export const SECRET_IMPLEMENTATION_REASON = 'IMPLEMENTATION_NONCONFORMANT';
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
const ACCEPTED_ITEM_IDS = Object.freeze(Array.from({ length: 13 }, (_, index) => `SB-TC${String(index).padStart(2, '0')}`));
// Mirrors the protected Linux worker's own admitted-mode constant; a regression test binds the
// two, so both change together by a reviewed implementation item and never by configuration.
const LINUX_DEV_SYNTHETIC_MODES = Object.freeze(['Probe', 'SyntheticJiraAdapter', 'SyntheticLifecycle']);
const DESIGN_REGISTRY_FILE = fileURLToPath(new URL('../secret-broker-accepted-design-v1.json', import.meta.url));
const PUBLIC_SCHEMA_FILES = Object.freeze({
  request: fileURLToPath(new URL('../schemas/secret-broker/v1/public-request.schema.json', import.meta.url)),
  result: fileURLToPath(new URL('../schemas/secret-broker/v1/public-result.schema.json', import.meta.url))
});

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
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (plain(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)])));
  return value;
}

export function loadSecretBrokerDesignRegistry() {
  const stat = fs.lstatSync(DESIGN_REGISTRY_FILE);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 32 * 1024) fail('KSTACK_SECRET_DESIGN_REGISTRY_UNTRUSTED');
  let registry;
  try { registry = JSON.parse(fs.readFileSync(DESIGN_REGISTRY_FILE, 'utf8')); } catch { fail('KSTACK_SECRET_DESIGN_REGISTRY_INVALID'); }
  exactKeys(registry, ['schemaVersion', 'threadId', 'implementationState', 'implementationReason', 'acceptedItems', 'closure', 'permittedClaims'], 'KSTACK_SECRET_DESIGN_REGISTRY_INVALID');
  if (registry.schemaVersion !== SECRET_DESIGN_REGISTRY_SCHEMA || registry.threadId !== 'secret-broker-2026-08-28'
    || registry.implementationState !== SECRET_IMPLEMENTATION_STATE || registry.implementationReason !== SECRET_IMPLEMENTATION_REASON) {
    fail('KSTACK_SECRET_DESIGN_REGISTRY_INVALID');
  }
  if (!Array.isArray(registry.acceptedItems) || registry.acceptedItems.length !== ACCEPTED_ITEM_IDS.length) fail('KSTACK_SECRET_DESIGN_REGISTRY_INVALID');
  for (let index = 0; index < registry.acceptedItems.length; index += 1) {
    const item = registry.acceptedItems[index];
    exactKeys(item, ['itemId', 'repoRelativePath', 'sha256'], 'KSTACK_SECRET_DESIGN_REGISTRY_INVALID');
    if (item.itemId !== ACCEPTED_ITEM_IDS[index] || typeof item.repoRelativePath !== 'string'
      || !item.repoRelativePath.startsWith('.kstack/') || item.repoRelativePath.includes('..') || !SHA256.test(item.sha256)) {
      fail('KSTACK_SECRET_DESIGN_REGISTRY_INVALID');
    }
  }
  exactKeys(registry.closure, ['decision', 'confidence', 'failedChecks', 'securityFindings', 'materialDissent', 'unresolvedQuestions', 'repoRelativePath', 'sha256'], 'KSTACK_SECRET_DESIGN_REGISTRY_INVALID');
  if (registry.closure.decision !== 'approve' || !Number.isSafeInteger(registry.closure.confidence) || registry.closure.confidence < 93
    || !['failedChecks', 'securityFindings', 'materialDissent', 'unresolvedQuestions'].every((key) => registry.closure[key] === 0)
    || typeof registry.closure.repoRelativePath !== 'string' || !registry.closure.repoRelativePath.startsWith('.kstack/reviews/')
    || registry.closure.repoRelativePath.includes('..') || !SHA256.test(registry.closure.sha256)
    || !Array.isArray(registry.permittedClaims) || registry.permittedClaims.length !== 1
    || registry.permittedClaims[0] !== 'READY_FOR_PROJECT_LOCAL_IMPLEMENTATION') fail('KSTACK_SECRET_DESIGN_REGISTRY_INVALID');
  const canonical = `${canonicalJson(registry)}\n`;
  return Object.freeze({ registry: immutable(clone(registry)), canonical, sha256: digest(canonical) });
}

// The cell's closed boundary, from source constants only. This deliberately measures nothing
// about the host: SB-TC10 section 9 makes present platform/session prerequisites the DISCOVERED
// predicate, and section 5 forbids deriving qualification from a mutable index, so publishing a
// freshly computed prerequisite check here would be exactly that index. Evidence comes only from
// the external authority, which does not exist yet, so no level above NONE is reportable.
export function secretBrokerCellBoundary() {
  return Object.freeze([Object.freeze({
    cellId: 'linux-secret-service-v1:jira-cloud-auth-v1',
    backendId: 'linux-secret-service-v1',
    adapterId: 'jira-cloud-auth-v1',
    admittedModes: LINUX_DEV_SYNTHETIC_MODES,
    evidenceLevel: 'NONE',
    claim: 'BOUNDARY_ONLY_NOT_AUTHORITATIVE'
  })]);
}

export function secretBrokerBaselineStatus() {
  const accepted = loadSecretBrokerDesignRegistry();
  return Object.freeze({
    schemaVersion: 'kstack-secret-broker-baseline-status-v1',
    status: SECRET_IMPLEMENTATION_STATE,
    reason: SECRET_IMPLEMENTATION_REASON,
    acceptedItems: accepted.registry.acceptedItems.length,
    acceptedDesignRegistrySha256: accepted.sha256,
    cells: secretBrokerCellBoundary()
  });
}

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
  const callerDeclaredQualified = new Set(capabilities.qualifiedCells);
  const items = checked.inventory.entries.map((entry) => {
    const reasons = [SECRET_IMPLEMENTATION_REASON];
    const retiredWindowsJiraCell = entry.desiredBackend === 'windows-dpapi-current-user-v1'
      && entry.adapterId === 'jira-cloud-auth-v1';
    if (entry.desiredBackend !== capabilities.platformCell) reasons.push('BACKEND_NOT_ACTIVE_ON_THIS_CELL');
    if (retiredWindowsJiraCell) reasons.push('WINDOWS_JIRA_CELL_RETIRED');
    else if (callerDeclaredQualified.has(`${entry.desiredBackend}:${entry.adapterId}`)) reasons.push('CALLER_QUALIFICATION_NOT_AUTHORITATIVE');
    else reasons.push('BACKEND_ADAPTER_CELL_NOT_SYNTHETICALLY_QUALIFIED');
    if (entry.adapterId !== 'jira-cloud-auth-v1') reasons.push('TARGET_ADAPTER_NOT_IMPLEMENTED');
    if (!['api-token', 'client-credential'].includes(entry.kind) && entry.adapterId === 'jira-cloud-auth-v1') reasons.push('CREDENTIAL_KIND_ADAPTER_MISMATCH');
    return Object.freeze({
      entryId: entry.entryId,
      disposition: SECRET_IMPLEMENTATION_STATE,
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

function trustedPublicRequestFile(file) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 65_536) fail('KSTACK_SECRET_PUBLIC_REQUEST_FILE_UNTRUSTED');
  return parsePublicRequest(fs.readFileSync(resolved));
}

function trustedPublicRequestBytes(file) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 65_536) fail('KSTACK_SECRET_PUBLIC_REQUEST_FILE_UNTRUSTED');
  return fs.readFileSync(resolved);
}

export function parseSecretArgs(argv) {
  const [command, ...rest] = argv;
  if (command === 'status' && rest.length === 0) return { command };
  if (command === 'template' && rest.length === 0) return { command };
  if (command === 'public-schema' && rest.length === 2 && rest[0] === '--name' && Object.hasOwn(PUBLIC_SCHEMA_FILES, rest[1])) return { command, name: rest[1] };
  if (['validate-public-request', 'public-request'].includes(command) && rest.length === 2 && rest[0] === '--file') return { command, file: rest[1] };
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
  if (args.command === 'status') {
    process.stdout.write(`${JSON.stringify(secretBrokerBaselineStatus())}\n`);
    return;
  }
  if (args.command === 'template') {
    process.stdout.write(`${JSON.stringify({ schemaVersion: SECRET_INVENTORY_SCHEMA, inventoryId: 'owner-inventory-2026-08-28', ownerDecisionId: 'secret-broker-owner-priority-2026-08-28', entries: [] }, null, 2)}\n`);
    return;
  }
  if (args.command === 'public-schema') {
    process.stdout.write(fs.readFileSync(PUBLIC_SCHEMA_FILES[args.name]));
    return;
  }
  if (args.command === 'validate-public-request' || args.command === 'public-request') {
    if (args.command === 'validate-public-request') {
      const request = trustedPublicRequestFile(args.file);
      process.stdout.write(`${JSON.stringify({ schemaVersion: 'kstack-secret-public-validation-v1', status: 'VALID', operation: request.operation })}\n`);
      return;
    }
    process.stdout.write(Buffer.concat([canonicalSecretPublicBytes(publicUnavailableResultFromBytes(trustedPublicRequestBytes(args.file))), Buffer.from('\n')]));
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
    process.stderr.write(`${error instanceof SecretBrokerError || error instanceof SecretPublicError ? error.code : 'KSTACK_SECRET_INTERNAL_ERROR'}\n`);
    process.exitCode = 1;
  });
}
