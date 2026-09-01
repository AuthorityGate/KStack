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
const UPDATE_OPTION_KEYS = Object.freeze(['allowOrigin', 'code']);
const UPDATE_ERROR_CODES = new Set([
  'KSTACK_SECRET_UPDATE_ID_INVALID',
  'KSTACK_SECRET_AUTHORITY_HEAD_INVALID',
  'KSTACK_SECRET_AUTHORITY_UPDATE_ID_INVALID',
  'KSTACK_SECRET_AUDIT_HEAD_INVALID',
  'KSTACK_SECRET_AUDIT_UPDATE_ID_INVALID'
]);
const ARRAY_IS_ARRAY = Array.isArray;
const DEFINE_PROPERTY = Object.defineProperty;
const DEFINE_PROPERTIES = Object.defineProperties;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_PROTOTYPE_OF = Object.getPrototypeOf;
const HAS_OWN = Object.hasOwn;
const OBJECT_PROTOTYPE = Object.prototype;
const OWN_KEYS = Reflect.ownKeys;

export class SecretControlPlaneError extends Error {
  constructor(code) {
    super();
    DEFINE_PROPERTIES(this, {
      name: { value: 'SecretControlPlaneError', enumerable: true, configurable: true, writable: true },
      message: { value: code, enumerable: false, configurable: true, writable: true },
      code: { value: code, enumerable: true, configurable: true, writable: true }
    });
  }
}

function fail(code) { throw new SecretControlPlaneError(code); }
function snapshotRecord(value, keys, code, { requireAll = true } = {}) {
  let prototype;
  let descriptors;
  let actual;
  try {
    if (value === null || typeof value !== 'object' || ARRAY_IS_ARRAY(value)) fail(code);
    prototype = GET_PROTOTYPE_OF(value);
    descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
    actual = OWN_KEYS(descriptors);
  } catch { fail(code); }
  if (prototype !== OBJECT_PROTOTYPE) fail(code);
  if (actual.some((key) => typeof key !== 'string' || !keys.includes(key))
      || requireAll && (actual.length !== keys.length || keys.some((key) => !HAS_OWN(descriptors, key)))) fail(code);
  const snapshot = {};
  for (const key of actual) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !HAS_OWN(descriptor, 'value')) fail(code);
    DEFINE_PROPERTY(snapshot, key, {
      value: descriptor.value, enumerable: true, configurable: true, writable: true
    });
  }
  return snapshot;
}
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
export function validateSecretUpdateId(value, options = {}) {
  let selected;
  try {
    selected = snapshotRecord(options, UPDATE_OPTION_KEYS, 'KSTACK_SECRET_UPDATE_ID_INVALID', { requireAll: false });
    if (HAS_OWN(selected, 'allowOrigin') && typeof selected.allowOrigin !== 'boolean') fail('KSTACK_SECRET_UPDATE_ID_INVALID');
    if (HAS_OWN(selected, 'code') && !UPDATE_ERROR_CODES.has(selected.code)) fail('KSTACK_SECRET_UPDATE_ID_INVALID');
  } catch {
    fail('KSTACK_SECRET_UPDATE_ID_INVALID');
  }
  const allowOrigin = selected.allowOrigin ?? false;
  const code = selected.code ?? 'KSTACK_SECRET_UPDATE_ID_INVALID';
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
    const checked = snapshotRecord(value, AUTHORITY_KEYS, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    if (checked.schemaVersion !== SECRET_AUTHORITY_HEAD_VERSION) fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    opaque(checked.authorityNamespaceRef, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    generation(checked.authorityEpoch, false, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    if ((checked.authorityEpoch === 1) !== (checked.priorAuthorityDigest === 'GENESIS')) {
      fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    }
    if (checked.priorAuthorityDigest === 'GENESIS') {
      if (checked.authorityEpoch !== 1 || checked.lastUpdateId !== 'epoch-origin') fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
    } else {
      digest(checked.priorAuthorityDigest, 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
      validateSecretUpdateId(checked.lastUpdateId, { code: 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID' });
    }
    return Object.freeze(checked);
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
    const checked = snapshotRecord(value, AUDIT_KEYS, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    if (checked.schemaVersion !== SECRET_AUDIT_HEAD_VERSION) fail('KSTACK_SECRET_AUDIT_HEAD_INVALID');
    opaque(checked.auditNamespaceRef, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    generation(checked.auditEpoch, false, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    generation(checked.ordinal, true, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    opaque(checked.writerLeaseRef, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    trustedInstant(checked.writerLeaseDeadline, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
    if (checked.ordinal === 0) {
      if (checked.eventDigest !== 'epoch-origin' || checked.lastUpdateId !== 'epoch-origin') fail('KSTACK_SECRET_AUDIT_HEAD_INVALID');
    } else {
      digest(checked.eventDigest, 'KSTACK_SECRET_AUDIT_HEAD_INVALID');
      validateSecretUpdateId(checked.lastUpdateId, { code: 'KSTACK_SECRET_AUDIT_HEAD_INVALID' });
    }
    return Object.freeze(checked);
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
