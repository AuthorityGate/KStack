import crypto from 'node:crypto';

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
const APPLY = Reflect.apply;
const ARRAY_BUFFER_CONSTRUCTOR = ArrayBuffer;
const ARRAY_BUFFER_IS_VIEW = ArrayBuffer.isView;
const ARRAY_INCLUDES = Array.prototype.includes;
const ARRAY_SOME = Array.prototype.some;
const ARRAY_IS_ARRAY = Array.isArray;
const BUFFER_BYTE_LENGTH = Buffer.byteLength;
const BUFFER_CONSTRUCTOR = Buffer;
const BUFFER_EQUALS = Buffer.prototype.equals;
const BUFFER_FROM = Buffer.from;
const BUFFER_IS_BUFFER = Buffer.isBuffer;
const BUFFER_TO_STRING = Buffer.prototype.toString;
const CRYPTO_CREATE_HASH = crypto.createHash;
const CRYPTO_RANDOM_BYTES = crypto.randomBytes;
const DEFINE_PROPERTY = Object.defineProperty;
const DEFINE_PROPERTIES = Object.defineProperties;
const FREEZE = Object.freeze;
const GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_PROTOTYPE_OF = Object.getPrototypeOf;
const HAS_OWN = Object.hasOwn;
const JSON_PARSE = JSON.parse;
const JSON_STRINGIFY = JSON.stringify;
const JSON_OBJECT = JSON;
const OBJECT_CREATE = Object.create;
const OBJECT_PROTOTYPE = Object.prototype;
const OBJECT_IS = Object.is;
const OWN_KEYS = Reflect.ownKeys;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const REGEXP_EXEC = RegExp.prototype.exec;
const SET_HAS = Set.prototype.has;
const SET_ADD = Set.prototype.add;
const SET_DELETE = Set.prototype.delete;
const SET_CONSTRUCTOR = Set;
const STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const STRING_IS_WELL_FORMED = String.prototype.isWellFormed;
const STRING_NORMALIZE = String.prototype.normalize;
const STRING_SLICE = String.prototype.slice;
const TEXT_DECODER_CONSTRUCTOR = TextDecoder;
const TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const UINT8_ARRAY_PROTOTYPE = Uint8Array.prototype;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const OPAQUE_REF = /^ksr1_[A-Za-z0-9_-]{22}$/u;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u;
const SECRET_CANONICAL_LIMITS = FREEZE({
  maxDocumentBytes: 1_048_576,
  maxDepth: 32,
  maxObjectProperties: 64,
  maxArrayItems: 16_384,
  maxStringUtf8Bytes: 16_384
});
const HASH_PROTOTYPE = GET_PROTOTYPE_OF(APPLY(CRYPTO_CREATE_HASH, crypto, ['sha256']));
const HASH_UPDATE = HASH_PROTOTYPE.update;
const HASH_DIGEST = HASH_PROTOTYPE.digest;

function arrayIncludes(values, value) { return APPLY(ARRAY_INCLUDES, values, [value]); }
function arraySome(values, predicate) { return APPLY(ARRAY_SOME, values, [predicate]); }
function bufferEquals(left, right) { return APPLY(BUFFER_EQUALS, left, [right]); }
function regexpTest(pattern, value) { return APPLY(REGEXP_EXEC, pattern, [value]) !== null; }

function validateCanonicalString(value) {
  if (typeof value !== 'string' || !APPLY(STRING_IS_WELL_FORMED, value, [])) fail('KSTACK_SECRET_CANONICAL_STRING_INVALID');
  if (APPLY(STRING_NORMALIZE, value, ['NFC']) !== value) fail('KSTACK_SECRET_CANONICAL_STRING_INVALID');
  if (APPLY(BUFFER_BYTE_LENGTH, BUFFER_CONSTRUCTOR, [value, 'utf8']) > SECRET_CANONICAL_LIMITS.maxStringUtf8Bytes) {
    fail('KSTACK_SECRET_CANONICAL_STRING_INVALID');
  }
  for (let index = 0; index < value.length; index += 1) {
    const first = APPLY(STRING_CHAR_CODE_AT, value, [index]);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = APPLY(STRING_CHAR_CODE_AT, value, [index + 1]);
      codePoint = 0x10000 + ((first - 0xd800) << 10) + second - 0xdc00;
      index += 1;
    }
    if ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xffff) === 0xfffe || (codePoint & 0xffff) === 0xffff) {
      fail('KSTACK_SECRET_CANONICAL_STRING_INVALID');
    }
  }
  return value;
}

// Ordinary indexed assignment consults inherited numeric accessors whenever the
// index has no own property yet, so an attacker-installed Array.prototype or
// Object.prototype index setter could drop or replace canonical keys. Every
// index created here is therefore an own data property, and every descriptor
// or element read goes through an own-property check (`listRead`,
// `ownDescriptor`) so a missing key fails closed instead of resolving through
// `Object.prototype`.
// ToPropertyDescriptor probes `get`/`set` with HasProperty, so a descriptor
// literal inherits them from a polluted Object.prototype and throws instead of
// describing a data property. A null-prototype descriptor cannot.
function dataDescriptor(value, enumerable) {
  const descriptor = OBJECT_CREATE(null);
  descriptor.value = value;
  descriptor.enumerable = enumerable;
  descriptor.configurable = true;
  descriptor.writable = true;
  return descriptor;
}

function listDefine(list, index, value) {
  DEFINE_PROPERTY(list, `${index}`, dataDescriptor(value, true));
  const descriptor = GET_OWN_PROPERTY_DESCRIPTOR(list, `${index}`);
  if (!descriptor || !HAS_OWN(descriptor, 'value') || !OBJECT_IS(descriptor.value, value)) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
  return list;
}

function listRead(list, index) {
  const descriptor = GET_OWN_PROPERTY_DESCRIPTOR(list, `${index}`);
  if (!descriptor || !HAS_OWN(descriptor, 'value')) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
  return descriptor.value;
}

// A descriptor map produced by getOwnPropertyDescriptors inherits from
// Object.prototype, so an ordinary get for an absent key resolves through it. A
// sparse array whose hole is offset by a non-index own property satisfies the
// arity guard above, which is what makes that fallback reachable.
function ownDescriptor(descriptors, key) {
  if (!HAS_OWN(descriptors, key)) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
  const descriptor = descriptors[key];
  if (!descriptor || !descriptor.enumerable || !HAS_OWN(descriptor, 'value')) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
  return descriptor;
}

function sortedStrings(values) {
  const output = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = listRead(values, index);
    let insertion = output.length;
    while (insertion > 0 && listRead(output, insertion - 1) > value) {
      listDefine(output, insertion, listRead(output, insertion - 1));
      insertion -= 1;
    }
    listDefine(output, insertion, value);
  }
  if (output.length !== values.length) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
  return output;
}

function canonicalValue(value, depth, ancestors) {
  if (depth > SECRET_CANONICAL_LIMITS.maxDepth) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
  if (value === null || typeof value === 'boolean') return APPLY(JSON_STRINGIFY, JSON_OBJECT, [value]);
  if (typeof value === 'number') {
    if (!NUMBER_IS_SAFE_INTEGER(value) || OBJECT_IS(value, -0)) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
    return APPLY(JSON_STRINGIFY, JSON_OBJECT, [value]);
  }
  if (typeof value === 'string') return APPLY(JSON_STRINGIFY, JSON_OBJECT, [validateCanonicalString(value)]);
  if (value === null || typeof value !== 'object' || APPLY(SET_HAS, ancestors, [value])) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
  APPLY(SET_ADD, ancestors, [value]);
  try {
    const descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
    const keys = OWN_KEYS(descriptors);
    if (ARRAY_IS_ARRAY(value)) {
      if (value.length > SECRET_CANONICAL_LIMITS.maxArrayItems || keys.length !== value.length + 1 || !HAS_OWN(descriptors, 'length')) {
        fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
      }
      let output = '[';
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = ownDescriptor(descriptors, `${index}`);
        if (index !== 0) output += ',';
        output += canonicalValue(descriptor.value, depth + 1, ancestors);
      }
      return `${output}]`;
    }
    if (GET_PROTOTYPE_OF(value) !== OBJECT_PROTOTYPE || keys.length > SECRET_CANONICAL_LIMITS.maxObjectProperties) {
      fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
    }
    const stringKeys = [];
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (typeof key !== 'string') fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
      ownDescriptor(descriptors, key);
      validateCanonicalString(key);
      listDefine(stringKeys, stringKeys.length, key);
    }
    if (stringKeys.length !== keys.length) fail('KSTACK_SECRET_CANONICAL_VALUE_INVALID');
    const ordered = sortedStrings(stringKeys);
    let output = '{';
    for (let index = 0; index < ordered.length; index += 1) {
      const key = listRead(ordered, index);
      if (index !== 0) output += ',';
      output += `${APPLY(JSON_STRINGIFY, JSON_OBJECT, [key])}:${canonicalValue(ownDescriptor(descriptors, key).value, depth + 1, ancestors)}`;
    }
    return `${output}}`;
  } finally {
    APPLY(SET_DELETE, ancestors, [value]);
  }
}

export function secretCanonicalBytes(value) {
  const encoded = canonicalValue(value, 0, new SET_CONSTRUCTOR());
  const output = APPLY(BUFFER_FROM, BUFFER_CONSTRUCTOR, [encoded, 'utf8']);
  if (output.length > SECRET_CANONICAL_LIMITS.maxDocumentBytes) fail('KSTACK_SECRET_CANONICAL_BYTES_EXCEEDED');
  return output;
}

function inputBytes(input) {
  let typed = false;
  try {
    if (APPLY(ARRAY_BUFFER_IS_VIEW, ARRAY_BUFFER_CONSTRUCTOR, [input])) {
      let prototype = GET_PROTOTYPE_OF(input);
      while (prototype !== null && prototype !== OBJECT_PROTOTYPE) {
        if (prototype === UINT8_ARRAY_PROTOTYPE) { typed = true; break; }
        prototype = GET_PROTOTYPE_OF(prototype);
      }
    }
  }
  catch { fail('KSTACK_SECRET_CANONICAL_INPUT_INVALID'); }
  if (!APPLY(BUFFER_IS_BUFFER, BUFFER_CONSTRUCTOR, [input]) && !typed) fail('KSTACK_SECRET_CANONICAL_INPUT_INVALID');
  const output = APPLY(BUFFER_FROM, BUFFER_CONSTRUCTOR, [input]);
  if (output.length > SECRET_CANONICAL_LIMITS.maxDocumentBytes) fail('KSTACK_SECRET_CANONICAL_BYTES_EXCEEDED');
  return output;
}

export function parseSecretCanonicalJson(input) {
  const source = inputBytes(input);
  let text;
  let value;
  try {
    const decoder = new TEXT_DECODER_CONSTRUCTOR('utf-8', { fatal: true, ignoreBOM: true });
    text = APPLY(TEXT_DECODER_DECODE, decoder, [source]);
    value = APPLY(JSON_PARSE, JSON_OBJECT, [text]);
  } catch { fail('KSTACK_SECRET_CANONICAL_INPUT_INVALID'); }
  if (!bufferEquals(secretCanonicalBytes(value), source)) fail('KSTACK_SECRET_CANONICAL_INPUT_INVALID');
  return value;
}

export function validateSecretOpaqueRef(value) {
  if (typeof value !== 'string' || !regexpTest(OPAQUE_REF, value)) fail('KSTACK_SECRET_OPAQUE_REF_INVALID');
  const encoded = APPLY(STRING_SLICE, value, [5]);
  let decoded;
  try { decoded = APPLY(BUFFER_FROM, BUFFER_CONSTRUCTOR, [encoded, 'base64url']); }
  catch { fail('KSTACK_SECRET_OPAQUE_REF_INVALID'); }
  if (decoded.length !== 16 || APPLY(BUFFER_TO_STRING, decoded, ['base64url']) !== encoded) fail('KSTACK_SECRET_OPAQUE_REF_INVALID');
  return value;
}

export function validateSecretDigest(value) {
  if (typeof value !== 'string' || !regexpTest(DIGEST, value)) fail('KSTACK_SECRET_DIGEST_INVALID');
  return value;
}

export function validateSecretTimestamp(value) {
  if (typeof value !== 'string' || value.length !== 24) fail('KSTACK_SECRET_TIMESTAMP_INVALID');
  const match = APPLY(REGEXP_EXEC, TIMESTAMP, [value]);
  if (!match) fail('KSTACK_SECRET_TIMESTAMP_INVALID');
  const year = +match[1];
  const month = +match[2];
  const day = +match[3];
  const hour = +match[4];
  const minute = +match[5];
  const second = +match[6];
  if (year === 0 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) fail('KSTACK_SECRET_TIMESTAMP_INVALID');
  let days = 31;
  if (month === 4 || month === 6 || month === 9 || month === 11) days = 30;
  else if (month === 2) days = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  if (day < 1 || day > days) fail('KSTACK_SECRET_TIMESTAMP_INVALID');
  return value;
}

export class SecretControlPlaneError extends Error {
  constructor(code) {
    super();
    DEFINE_PROPERTIES(this, {
      name: dataDescriptor('SecretControlPlaneError', true),
      message: dataDescriptor(code, false),
      code: dataDescriptor(code, true)
    });
  }
}

function fail(code) { throw new SecretControlPlaneError(code); }
function snapshotRecord(value, keys, code, options) {
  const requireAll = options === undefined || !HAS_OWN(options, 'requireAll') ? true : options.requireAll;
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
  if (arraySome(actual, (key) => typeof key !== 'string' || !arrayIncludes(keys, key))
      || requireAll && (actual.length !== keys.length || arraySome(keys, (key) => !HAS_OWN(descriptors, key)))) fail(code);
  const snapshot = {};
  for (let index = 0; index < actual.length; index += 1) {
    const key = actual[index];
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !HAS_OWN(descriptor, 'value')) fail(code);
    DEFINE_PROPERTY(snapshot, key, dataDescriptor(descriptor.value, true));
  }
  return snapshot;
}
function generation(value, allowZero, code) {
  if (!NUMBER_IS_SAFE_INTEGER(value) || value < (allowZero ? 0 : 1) || value > SECRET_GENERATION_MAX) fail(code);
  return value;
}
function opaque(value, code) {
  try { validateSecretOpaqueRef(value); } catch { fail(code); }
  return value;
}
function digest(value, code) {
  try { validateSecretDigest(value); } catch { fail(code); }
  return value;
}
export function validateSecretUpdateId(value, options = {}) {
  let selected;
  try {
    selected = snapshotRecord(options, UPDATE_OPTION_KEYS, 'KSTACK_SECRET_UPDATE_ID_INVALID', { requireAll: false });
    if (HAS_OWN(selected, 'allowOrigin') && typeof selected.allowOrigin !== 'boolean') fail('KSTACK_SECRET_UPDATE_ID_INVALID');
    if (HAS_OWN(selected, 'code') && !APPLY(SET_HAS, UPDATE_ERROR_CODES, [selected.code])) fail('KSTACK_SECRET_UPDATE_ID_INVALID');
  } catch {
    fail('KSTACK_SECRET_UPDATE_ID_INVALID');
  }
  const allowOrigin = HAS_OWN(selected, 'allowOrigin') ? selected.allowOrigin : false;
  const code = HAS_OWN(selected, 'code') ? selected.code : 'KSTACK_SECRET_UPDATE_ID_INVALID';
  if (allowOrigin && value === 'epoch-origin') return value;
  if (typeof value !== 'string' || !regexpTest(UPDATE_ID, value)) fail(code);
  const encoded = APPLY(STRING_SLICE, value, [5]);
  let decoded;
  try { decoded = APPLY(BUFFER_FROM, BUFFER_CONSTRUCTOR, [encoded, 'base64url']); } catch { fail(code); }
  if (decoded.length !== 32 || APPLY(BUFFER_TO_STRING, decoded, ['base64url']) !== encoded) fail(code);
  return value;
}

export function generateSecretUpdateId() {
  return `ksu1_${APPLY(BUFFER_TO_STRING, APPLY(CRYPTO_RANDOM_BYTES, crypto, [32]), ['base64url'])}`;
}
function trustedInstant(value, code) {
  try { validateSecretTimestamp(value); } catch { fail(code); }
  return value;
}
function bounded(value, validator, code) {
  const checked = validator(value);
  if (secretCanonicalBytes(checked).length > SECRET_CONTROL_PLANE_MAX_BYTES) fail(code);
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
    return FREEZE(checked);
  } catch {
    fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
  }
}

export function parseAuthorityHead(input) {
  let bytes;
  try { bytes = inputBytes(input); }
  catch { fail('KSTACK_SECRET_AUTHORITY_HEAD_ENCODING_INVALID'); }
  if (!bytes || bytes.length < 2 || bytes.length > SECRET_CONTROL_PLANE_MAX_BYTES) fail('KSTACK_SECRET_AUTHORITY_HEAD_ENCODING_INVALID');
  let value;
  try { value = parseSecretCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_AUTHORITY_HEAD_ENCODING_INVALID'); }
  return validateAuthorityHeadValue(value);
}

export function canonicalAuthorityHeadBytes(value) {
  return secretCanonicalBytes(bounded(value, validateAuthorityHeadValue, 'KSTACK_SECRET_AUTHORITY_HEAD_BYTES_EXCEEDED'));
}

export function authorityHeadDigest(value) {
  const hash = APPLY(CRYPTO_CREATE_HASH, crypto, ['sha256']);
  APPLY(HASH_UPDATE, hash, [APPLY(BUFFER_FROM, BUFFER_CONSTRUCTOR, ['KSTACK-SECRET-AUTHORITY-HEAD-V1\0', 'ascii'])]);
  APPLY(HASH_UPDATE, hash, [canonicalAuthorityHeadBytes(value)]);
  return `sha256:${APPLY(HASH_DIGEST, hash, ['hex'])}`;
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
  if (bufferEquals(secretCanonicalBytes(actual), secretCanonicalBytes(successor))) return 'COMMITTED';
  if (bufferEquals(secretCanonicalBytes(actual), secretCanonicalBytes(current))) return 'UNCOMMITTED';
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
    return FREEZE(checked);
  } catch {
    fail('KSTACK_SECRET_AUDIT_HEAD_INVALID');
  }
}

export function parseAuditHead(input) {
  let bytes;
  try { bytes = inputBytes(input); }
  catch { fail('KSTACK_SECRET_AUDIT_HEAD_ENCODING_INVALID'); }
  if (!bytes || bytes.length < 2 || bytes.length > SECRET_CONTROL_PLANE_MAX_BYTES) fail('KSTACK_SECRET_AUDIT_HEAD_ENCODING_INVALID');
  let value;
  try { value = parseSecretCanonicalJson(bytes); } catch { fail('KSTACK_SECRET_AUDIT_HEAD_ENCODING_INVALID'); }
  return validateAuditHeadValue(value);
}

export function canonicalAuditHeadBytes(value) {
  return secretCanonicalBytes(bounded(value, validateAuditHeadValue, 'KSTACK_SECRET_AUDIT_HEAD_BYTES_EXCEEDED'));
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
  if (bufferEquals(secretCanonicalBytes(actual), secretCanonicalBytes(successor))) return 'COMMITTED';
  if (bufferEquals(secretCanonicalBytes(actual), secretCanonicalBytes(current))) return 'UNCOMMITTED';
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
