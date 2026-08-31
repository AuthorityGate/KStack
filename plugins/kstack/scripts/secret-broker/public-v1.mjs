import crypto from 'node:crypto';

import { hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';
import { findOutboundSecret } from '../kstack-safety-matchers.mjs';

export const SECRET_PUBLIC_LIMITS = Object.freeze({
  requestBytes: 65_536,
  resultBytes: 65_536,
  labelScalars: 64,
  labelBytes: 128,
  pageSize: 50,
  items: 50
});

export const SECRET_PUBLIC_SCHEMAS = Object.freeze({
  describeRequest: 'kstack-secret-describe-request-v1',
  describeResult: 'kstack-secret-describe-result-v1',
  listRequest: 'kstack-secret-list-request-v1',
  listResult: 'kstack-secret-list-result-v1',
  metadata: 'kstack-secret-safe-handle-metadata-v1'
});

const HANDLE_ID = /^ksh1_[A-Za-z0-9_-]{43}$/u;
const OPAQUE_REF = /^ksr1_[A-Za-z0-9_-]{22}$/u;
const CURSOR = /^ksc1_[A-Za-z0-9_-]{22,342}$/u;
const REGISTRY_ID = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/u;
const CONTROL_BIDI_ZERO_WIDTH = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const PRIVATE_OR_UNASSIGNED = /[\p{Co}\p{Cn}]/u;
const REPEATED_WHITESPACE = /\s{2,}/u;
const CREDENTIAL_LIKE = /(?:^|\s)(?:authorization\s*:|bearer\s+|basic\s+|ssh-(?:rsa|ed25519)\s+|-----BEGIN\s|eyJ[A-Za-z0-9_-]{8,}\.|[A-Za-z]:\\|\\\\|\/?(?:home|users|etc|var|tmp)\/)/iu;
const ADDRESS_LIKE = /(?:https?:\/\/|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|(?:^|\s)(?:\.{0,2}[\\/]|[^\s]+[\\/][^\s]+))/iu;
const HOSTNAME_LIKE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|dev|app|cloud|local|internal)\b/iu;

const CREDENTIAL_KINDS = new Set(['password', 'api-token', 'client-credential', 'certificate-handle', 'private-key-handle', 'dynamic-credential', 'opaque']);
const ENVIRONMENT_CLASSES = new Set(['development', 'test', 'staging', 'production', 'recovery']);
const LIFECYCLE_CLASSES = new Set(['usable', 'attention', 'unavailable']);
const EXPIRY_CLASSES = new Set(['not-applicable', 'unknown', 'valid', 'expiring-soon', 'expired']);
const EVIDENCE_LEVELS = new Set(['discovered', 'configured', 'synthetic-qualified', 'pilot-validated', 'production-approved']);

export class SecretPublicError extends Error {
  constructor(code) { super(code); this.name = 'SecretPublicError'; this.code = code; }
}

function fail(code) { throw new SecretPublicError(code); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value, required, optional = []) {
  if (!plain(value)) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
  const keys = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
}
function member(value, values) { if (typeof value !== 'string' || !values.has(value)) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID'); return value; }
function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreeze));
  if (plain(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepFreeze(item)])));
  return value;
}
function copy(value) { return parseHostCanonicalJson(hostCanonicalBytes(value)); }
function hasNoncharacter(value) {
  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0);
    if ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xffff) === 0xfffe || (codePoint & 0xffff) === 0xffff) return true;
  }
  return false;
}
function validBase64url(value, prefix, bytes) {
  if (typeof value !== 'string' || !value.startsWith(prefix)) return false;
  const encoded = value.slice(prefix.length);
  try {
    const decoded = Buffer.from(encoded, 'base64url');
    return decoded.length === bytes && decoded.toString('base64url') === encoded;
  } catch { return false; }
}

export function validateRegistryId(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 64 || !REGISTRY_ID.test(value)) fail('KSTACK_SECRET_REGISTRY_ID_INVALID');
  return value;
}

export function validateHandleId(value) {
  if (!HANDLE_ID.test(value || '') || !validBase64url(value, 'ksh1_', 32)) fail('KSTACK_SECRET_HANDLE_ID_INVALID');
  return value;
}

export function validateOpaqueRef(value) {
  if (!OPAQUE_REF.test(value || '') || !validBase64url(value, 'ksr1_', 16)) fail('KSTACK_SECRET_OPAQUE_REF_INVALID');
  return value;
}

export function validateCursor(value) {
  if (typeof value !== 'string' || !CURSOR.test(value)) fail('KSTACK_SECRET_CURSOR_INVALID');
  const encoded = value.slice(5);
  try { if (Buffer.from(encoded, 'base64url').toString('base64url') !== encoded) fail('KSTACK_SECRET_CURSOR_INVALID'); }
  catch { fail('KSTACK_SECRET_CURSOR_INVALID'); }
  return value;
}

export function createOpaqueCandidate(kind) {
  const profile = kind === 'handle' ? { prefix: 'ksh1_', bytes: 32 } : kind === 'ref' ? { prefix: 'ksr1_', bytes: 16 } : null;
  if (!profile) fail('KSTACK_SECRET_OPAQUE_CANDIDATE_INVALID');
  return `${profile.prefix}${crypto.randomBytes(profile.bytes).toString('base64url')}`;
}

export function validateSafeLabelSyntax(value) {
  if (typeof value !== 'string' || !value.isWellFormed() || value !== value.normalize('NFC') || value.trim() !== value
    || [...value].length < 1 || [...value].length > SECRET_PUBLIC_LIMITS.labelScalars
    || Buffer.byteLength(value, 'utf8') > SECRET_PUBLIC_LIMITS.labelBytes
    || CONTROL_BIDI_ZERO_WIDTH.test(value) || hasNoncharacter(value) || PRIVATE_OR_UNASSIGNED.test(value)
    || REPEATED_WHITESPACE.test(value) || CREDENTIAL_LIKE.test(value) || ADDRESS_LIKE.test(value) || HOSTNAME_LIKE.test(value)
    || findOutboundSecret(Buffer.from(value, 'utf8'))) fail('KSTACK_SECRET_SAFE_LABEL_INVALID');
  return value;
}

function validateMetadataValue(value) {
  const required = ['schemaVersion', 'handleId', 'purposeId', 'credentialKind', 'environmentClass', 'backendFamilyId', 'adapterId', 'targetRef', 'lifecycleClass', 'generation', 'expiryClass', 'evidenceLevel'];
  const optional = ['purposeLabel', 'backendLabel', 'targetLabel', 'tenantLabel'];
  exactKeys(value, required, optional);
  if (value.schemaVersion !== SECRET_PUBLIC_SCHEMAS.metadata) fail('KSTACK_SECRET_PUBLIC_SCHEMA_UNSUPPORTED');
  validateHandleId(value.handleId);
  for (const key of ['purposeId', 'backendFamilyId', 'adapterId']) validateRegistryId(value[key]);
  validateOpaqueRef(value.targetRef);
  member(value.credentialKind, CREDENTIAL_KINDS);
  member(value.environmentClass, ENVIRONMENT_CLASSES);
  member(value.lifecycleClass, LIFECYCLE_CLASSES);
  member(value.expiryClass, EXPIRY_CLASSES);
  member(value.evidenceLevel, EVIDENCE_LEVELS);
  if (!Number.isSafeInteger(value.generation) || value.generation < 1) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
  for (const key of optional) if (Object.hasOwn(value, key)) validateSafeLabelSyntax(value[key]);
  return deepFreeze(copy(value));
}

export function validatePublicMetadataValue(value) {
  return validateMetadataValue(value);
}

export function validatePublicRequestValue(value) {
  if (!plain(value) || typeof value.schemaVersion !== 'string') fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
  if (value.schemaVersion === SECRET_PUBLIC_SCHEMAS.describeRequest) {
    exactKeys(value, ['schemaVersion', 'operation', 'handleId']);
    if (value.operation !== 'describe') fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
    validateHandleId(value.handleId);
    return deepFreeze(copy(value));
  }
  if (value.schemaVersion === SECRET_PUBLIC_SCHEMAS.listRequest) {
    exactKeys(value, ['schemaVersion', 'operation', 'pageSize'], ['purposeId', 'adapterId', 'environmentClass', 'cursor']);
    if (value.operation !== 'list' || !Number.isSafeInteger(value.pageSize) || value.pageSize < 1 || value.pageSize > SECRET_PUBLIC_LIMITS.pageSize) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
    if (Object.hasOwn(value, 'purposeId')) validateRegistryId(value.purposeId);
    if (Object.hasOwn(value, 'adapterId')) validateRegistryId(value.adapterId);
    if (Object.hasOwn(value, 'environmentClass')) member(value.environmentClass, ENVIRONMENT_CLASSES);
    if (Object.hasOwn(value, 'cursor')) validateCursor(value.cursor);
    return deepFreeze(copy(value));
  }
  fail('KSTACK_SECRET_PUBLIC_SCHEMA_UNSUPPORTED');
}

export function parsePublicRequest(input) {
  const bytes = Buffer.isBuffer(input) ? input : input instanceof Uint8Array ? Buffer.from(input) : null;
  if (!bytes || bytes.length < 2 || bytes.length > SECRET_PUBLIC_LIMITS.requestBytes) fail('KSTACK_SECRET_PUBLIC_REQUEST_INVALID');
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_PUBLIC_REQUEST_INVALID'); }
  return validatePublicRequestValue(value);
}

export function publicUnavailableResult(request) {
  if (!plain(request) || typeof request.schemaVersion !== 'string') fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
  if (request.schemaVersion === SECRET_PUBLIC_SCHEMAS.describeRequest) {
    exactKeys(request, ['schemaVersion', 'operation', 'handleId']);
    if (request.operation !== 'describe') fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
    return deepFreeze({ schemaVersion: SECRET_PUBLIC_SCHEMAS.describeResult, outcome: 'unavailable', reason: 'HANDLE_UNAVAILABLE' });
  }
  if (request.schemaVersion !== SECRET_PUBLIC_SCHEMAS.listRequest) fail('KSTACK_SECRET_PUBLIC_SCHEMA_UNSUPPORTED');
  exactKeys(request, ['schemaVersion', 'operation', 'pageSize'], ['purposeId', 'adapterId', 'environmentClass', 'cursor']);
  if (request.operation !== 'list' || !Number.isSafeInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > SECRET_PUBLIC_LIMITS.pageSize) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
  if (Object.hasOwn(request, 'purposeId')) validateRegistryId(request.purposeId);
  if (Object.hasOwn(request, 'adapterId')) validateRegistryId(request.adapterId);
  if (Object.hasOwn(request, 'environmentClass')) member(request.environmentClass, ENVIRONMENT_CLASSES);
  return deepFreeze({ schemaVersion: SECRET_PUBLIC_SCHEMAS.listResult, outcome: 'unavailable', reason: Object.hasOwn(request, 'cursor') ? 'CURSOR_UNAVAILABLE' : 'BROKER_UNAVAILABLE' });
}

export function publicUnavailableResultFromBytes(input) {
  const bytes = Buffer.isBuffer(input) ? input : input instanceof Uint8Array ? Buffer.from(input) : null;
  if (!bytes || bytes.length < 2 || bytes.length > SECRET_PUBLIC_LIMITS.requestBytes) fail('KSTACK_SECRET_PUBLIC_REQUEST_INVALID');
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_PUBLIC_REQUEST_INVALID'); }
  return publicUnavailableResult(value);
}

export function validatePublicResultValue(value) {
  if (!plain(value) || typeof value.schemaVersion !== 'string') fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
  if (value.schemaVersion === SECRET_PUBLIC_SCHEMAS.describeResult) {
    if (value.outcome === 'unavailable') {
      exactKeys(value, ['schemaVersion', 'outcome', 'reason']);
      if (value.reason !== 'HANDLE_UNAVAILABLE') fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
    } else {
      exactKeys(value, ['schemaVersion', 'outcome', 'item']);
      if (value.outcome !== 'available') fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
      validateMetadataValue(value.item);
    }
    return deepFreeze(copy(value));
  }
  if (value.schemaVersion === SECRET_PUBLIC_SCHEMAS.listResult) {
    if (value.outcome === 'unavailable') {
      exactKeys(value, ['schemaVersion', 'outcome', 'reason']);
      if (!['BROKER_UNAVAILABLE', 'CURSOR_UNAVAILABLE'].includes(value.reason)) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
    } else {
      exactKeys(value, ['schemaVersion', 'outcome', 'items'], ['nextCursor']);
      if (value.outcome !== 'available' || !Array.isArray(value.items) || value.items.length > SECRET_PUBLIC_LIMITS.items) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
      value.items.forEach(validateMetadataValue);
      if (Object.hasOwn(value, 'nextCursor')) validateCursor(value.nextCursor);
      const ids = value.items.map((item) => Buffer.from(item.handleId.slice(5), 'base64url'));
      for (let index = 1; index < ids.length; index += 1) if (Buffer.compare(ids[index - 1], ids[index]) >= 0) fail('KSTACK_SECRET_PUBLIC_SCHEMA_INVALID');
    }
    return deepFreeze(copy(value));
  }
  fail('KSTACK_SECRET_PUBLIC_SCHEMA_UNSUPPORTED');
}

export function canonicalSecretPublicBytes(value) {
  const checked = value?.operation ? validatePublicRequestValue(value) : validatePublicResultValue(value);
  const bytes = hostCanonicalBytes(checked);
  if (bytes.length > SECRET_PUBLIC_LIMITS.resultBytes) fail('KSTACK_SECRET_PUBLIC_RESULT_LIMIT');
  return bytes;
}
