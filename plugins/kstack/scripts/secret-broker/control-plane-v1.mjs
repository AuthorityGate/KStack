import crypto from 'node:crypto';

import { assertDigest, assertTimestamp, hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';
import { validateOpaqueRef } from './public-v1.mjs';

export const SECRET_AUTHORITY_HEAD_VERSION = 'kstack-secret-authority-head-v1';
export const SECRET_AUDIT_HEAD_VERSION = 'kstack-secret-audit-head-v1';
export const SECRET_CONTROL_PLANE_MAX_BYTES = 16_384;
export const SECRET_GENERATION_MAX = Number.MAX_SAFE_INTEGER;

const UPDATE_ID = /^ksu1_[A-Za-z0-9_-]{43}$/u;
const AUTHORITY_KEYS = Object.freeze([
  'schemaVersion', 'authorityNamespaceRef', 'authorityEpoch',
  'priorAuthorityDigest', 'lastUpdateId'
]);
const AUDIT_KEYS = Object.freeze([
  'schemaVersion', 'auditNamespaceRef', 'auditEpoch', 'ordinal',
  'eventDigest', 'writerLeaseRef', 'writerLeaseDeadline', 'lastUpdateId'
]);

export class SecretControlPlaneError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SecretControlPlaneError';
    this.code = code;
  }
}

function fail(code) { throw new SecretControlPlaneError(code); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys, code) {
  if (!plain(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
      || Object.keys(value).some((key) => !keys.includes(key))) fail(code);
}
function copy(value) { return parseHostCanonicalJson(hostCanonicalBytes(value)); }
function frozen(value) { return Object.freeze(copy(value)); }
function generation(value, allowZero, code) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > SECRET_GENERATION_MAX) fail(code);
  return value;
}
function opaque(value, code) {
  try { validateOpaqueRef(value); } catch { fail(code); }
  return value;
}
function digest(value, code) {
  try { assertDigest(value); } catch { fail(code); }
  return value;
}
export function validateSecretUpdateId(value, { allowOrigin = false, code = 'KSTACK_SECRET_UPDATE_ID_INVALID' } = {}) {
  if (allowOrigin && value === 'epoch-origin') return value;
  if (typeof value !== 'string' || !UPDATE_ID.test(value)) fail(code);
  const encoded = value.slice(5);
  let decoded;
  try { decoded = Buffer.from(encoded, 'base64url'); } catch { fail(code); }
  if (decoded.length !== 32 || decoded.toString('base64url') !== encoded) fail(code);
  return value;
}

export function generateSecretUpdateId() {
  return `ksu1_${crypto.randomBytes(32).toString('base64url')}`;
}
function trustedInstant(value, code) {
  try { assertTimestamp(value); } catch { fail(code); }
  return value;
}
function bounded(value, validator, code) {
  const checked = validator(value);
  if (hostCanonicalBytes(checked).length > SECRET_CONTROL_PLANE_MAX_BYTES) fail(code);
  return checked;
}

export function validateAuthorityHeadValue(value) {
  try {
    exact(value, AUTHORITY_KEYS, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    if (value.schemaVersion !== SECRET_AUTHORITY_HEAD_VERSION) fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    opaque(value.authorityNamespaceRef, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    generation(value.authorityEpoch, false, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    if ((value.authorityEpoch === 1) !== (value.priorAuthorityDigest === 'GENESIS')) {
      fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    }
    if (value.priorAuthorityDigest === 'GENESIS') {
      if (value.authorityEpoch !== 1 || value.lastUpdateId !== 'epoch-origin') fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    } else {
      digest(value.priorAuthorityDigest, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
      validateSecretUpdateId(value.lastUpdateId, { code: 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID' });
    }
    return frozen(value);
  } catch {
    fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
  }
}

export function parseAuthorityHead(input) {
  let bytes;
  try { bytes = Buffer.isBuffer(input) ? input : input instanceof Uint8Array ? Buffer.from(input) : null; }
  catch { fail('KSTACK_SECRET_AUTHORITY_HEAD_ENCODING_INVALID'); }
  if (!bytes || bytes.length < 2 || bytes.length > SECRET_CONTROL_PLANE_MAX_BYTES) fail('KSTACK_SECRET_AUTHORITY_HEAD_ENCODING_INVALID');
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_AUTHORITY_HEAD_ENCODING_INVALID'); }
  return validateAuthorityHeadValue(value);
}

export function canonicalAuthorityHeadBytes(value) {
  return hostCanonicalBytes(bounded(value, validateAuthorityHeadValue, 'KSTACK_SECRET_AUTHORITY_HEAD_BYTES_EXCEEDED'));
}

export function authorityHeadDigest(value) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from('KSTACK-SECRET-AUTHORITY-HEAD-V1\0', 'ascii')).update(canonicalAuthorityHeadBytes(value)).digest('hex')}`;
}

export function authoritySuccessor(expected, nextUpdateId) {
  const current = validateAuthorityHeadValue(expected);
  validateSecretUpdateId(nextUpdateId, { code: 'KSTACK_SECRET_AUTHORITY_UPDATE_ID_INVALID' });
  if (current.authorityEpoch === SECRET_GENERATION_MAX) fail('KSTACK_SECRET_AUTHORITY_EPOCH_EXHAUSTED');
  return validateAuthorityHeadValue({
    schemaVersion: SECRET_AUTHORITY_HEAD_VERSION,
    authorityNamespaceRef: current.authorityNamespaceRef,
    authorityEpoch: current.authorityEpoch + 1,
    priorAuthorityDigest: authorityHeadDigest(current),
    lastUpdateId: nextUpdateId
  });
}

export function reconcileAuthorityAdvance(expected, nextUpdateId, observed) {
  const current = validateAuthorityHeadValue(expected);
  const actual = validateAuthorityHeadValue(observed);
  const successor = authoritySuccessor(current, nextUpdateId);
  if (hostCanonicalBytes(actual).equals(hostCanonicalBytes(successor))) return 'COMMITTED';
  if (hostCanonicalBytes(actual).equals(hostCanonicalBytes(current))) return 'UNCOMMITTED';
  return 'UNCERTAIN';
}

export function validateAuditHeadValue(value) {
  try {
    exact(value, AUDIT_KEYS, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    if (value.schemaVersion !== SECRET_AUDIT_HEAD_VERSION) fail('KSTACK_SECRET_AUDIT_HEAD_INVALID');
    opaque(value.auditNamespaceRef, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    generation(value.auditEpoch, false, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    generation(value.ordinal, true, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    opaque(value.writerLeaseRef, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    trustedInstant(value.writerLeaseDeadline, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    if (value.ordinal === 0) {
      if (value.eventDigest !== 'epoch-origin' || value.lastUpdateId !== 'epoch-origin') fail('KSTACK_SECRET_AUDIT_HEAD_INVALID');
    } else {
      digest(value.eventDigest, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
      validateSecretUpdateId(value.lastUpdateId, { code: 'KSTACK_SECRET_AUDIT_HEAD_INVALID' });
    }
    return frozen(value);
  } catch {
    fail('KSTACK_SECRET_AUDIT_HEAD_INVALID');
  }
}

export function parseAuditHead(input) {
  let bytes;
  try { bytes = Buffer.isBuffer(input) ? input : input instanceof Uint8Array ? Buffer.from(input) : null; }
  catch { fail('KSTACK_SECRET_AUDIT_HEAD_ENCODING_INVALID'); }
  if (!bytes || bytes.length < 2 || bytes.length > SECRET_CONTROL_PLANE_MAX_BYTES) fail('KSTACK_SECRET_AUDIT_HEAD_ENCODING_INVALID');
  let value;
  try { value = parseHostCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_AUDIT_HEAD_ENCODING_INVALID'); }
  return validateAuditHeadValue(value);
}

export function canonicalAuditHeadBytes(value) {
  return hostCanonicalBytes(bounded(value, validateAuditHeadValue, 'KSTACK_SECRET_AUDIT_HEAD_BYTES_EXCEEDED'));
}

export function auditSuccessor(expected, eventDigest, nextUpdateId) {
  const current = validateAuditHeadValue(expected);
  digest(eventDigest, 'KSTACK_SECRET_AUDIT_EVENT_DIGEST_INVALID');
  validateSecretUpdateId(nextUpdateId, { code: 'KSTACK_SECRET_AUDIT_UPDATE_ID_INVALID' });
  if (current.ordinal === SECRET_GENERATION_MAX) fail('KSTACK_SECRET_AUDIT_ORDINAL_EXHAUSTED');
  return validateAuditHeadValue({
    ...current,
    ordinal: current.ordinal + 1,
    eventDigest,
    lastUpdateId: nextUpdateId
  });
}

export function reconcileAuditAdvance(expected, eventDigest, nextUpdateId, observed) {
  const current = validateAuditHeadValue(expected);
  const actual = validateAuditHeadValue(observed);
  const successor = auditSuccessor(current, eventDigest, nextUpdateId);
  if (hostCanonicalBytes(actual).equals(hostCanonicalBytes(successor))) return 'COMMITTED';
  if (hostCanonicalBytes(actual).equals(hostCanonicalBytes(current))) return 'UNCOMMITTED';
  return 'UNCERTAIN';
}

export function authorityOrigin(authorityNamespaceRef) {
  opaque(authorityNamespaceRef, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
  return validateAuthorityHeadValue({
    schemaVersion: SECRET_AUTHORITY_HEAD_VERSION,
    authorityNamespaceRef,
    authorityEpoch: 1,
    priorAuthorityDigest: 'GENESIS',
    lastUpdateId: 'epoch-origin'
  });
}

export function auditOrigin(auditNamespaceRef, auditEpoch, writerLeaseRef, writerLeaseDeadline) {
  return validateAuditHeadValue({
    schemaVersion: SECRET_AUDIT_HEAD_VERSION,
    auditNamespaceRef,
    auditEpoch,
    ordinal: 0,
    eventDigest: 'epoch-origin',
    writerLeaseRef,
    writerLeaseDeadline,
    lastUpdateId: 'epoch-origin'
  });
}
