import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  auditOrigin,
  auditSuccessor,
  authorityOrigin,
  authoritySuccessor,
  canonicalAuditHeadBytes,
  canonicalAuthorityHeadBytes,
  generateSecretUpdateId,
  parseSecretCanonicalJson,
  secretCanonicalBytes,
  validateSecretUpdateId,
  validateSecretOpaqueRef,
  validateAuditHeadValue,
  validateAuthorityHeadValue
} from './control-plane-v1.mjs';

export const SYNTHETIC_PROTECTED_STATE_IDENTITY_VERSION = 'kstack-secret-protected-state-identity-v1';
export const SYNTHETIC_PROTECTED_STATE_VERSION = 'kstack-secret-protected-state-store-v1';
export const SYNTHETIC_PROTECTED_STATE_ADAPTER_PROTOCOL = 'kstack-secret-protected-state-synthetic-v1';
export const SYNTHETIC_PROTECTED_STATE_PROFILE = 'SYNTHETIC_UNQUALIFIED';
export const SYNTHETIC_PROTECTED_STATE_MAX_BYTES = 1_048_576;
export const SYNTHETIC_PROTECTED_STATE_MAX_NAMESPACES = 1;
export const SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS = 16_384;

const CONSTRUCTOR = Symbol('synthetic-protected-state-constructor');
const IDENTITY_KEYS = Object.freeze(['schemaVersion', 'storeInstanceRef', 'profileId', 'productionEligible']);
const STATE_KEYS = Object.freeze([
  'schemaVersion', 'storeInstanceRef', 'authorityHeads', 'auditHeads',
  'issuedUpdateIds', 'retiredUpdateIds', 'retiredWriterLeaseRefs'
]);
const OPEN_KEYS = Object.freeze(['root', 'clock']);
const AUDIT_WRITER_KEYS = Object.freeze(['auditNamespaceRef', 'ttlMs']);
const ADVANCE_OPTION_KEYS = Object.freeze(['crashCut', 'acknowledgementCut']);
const STATUS_KEYS = Object.freeze(['profileId', 'productionEligible', 'state']);
const APPLY = Reflect.apply;
const ARRAY_FIND = Array.prototype.find;
const ARRAY_FIND_INDEX = Array.prototype.findIndex;
const ARRAY_INCLUDES = Array.prototype.includes;
const ARRAY_IS_ARRAY = Array.isArray;
const ARRAY_SOME = Array.prototype.some;
const ARRAY_SORT = Array.prototype.sort;
const BUFFER_CONSTRUCTOR = Buffer;
const BUFFER_COMPARE = Buffer.compare;
const BUFFER_EQUALS = Buffer.prototype.equals;
const BUFFER_FROM = Buffer.from;
const BUFFER_TO_STRING = Buffer.prototype.toString;
const CRYPTO_RANDOM_BYTES = crypto.randomBytes;
const CRYPTO_RANDOM_UUID = crypto.randomUUID;
const DATE_CONSTRUCTOR = Date;
const DATE_NOW = Date.now;
const DATE_PARSE = Date.parse;
const DATE_TO_ISO_STRING = Date.prototype.toISOString;
const MAX_CANONICAL_CLOCK_MS = APPLY(DATE_PARSE, DATE_CONSTRUCTOR, ['9999-12-31T23:59:59.999Z']);
const DEFINE_PROPERTY = Object.defineProperty;
const DEFINE_PROPERTIES = Object.defineProperties;
const FREEZE = Object.freeze;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const GET_PROTOTYPE_OF = Object.getPrototypeOf;
const HAS_OWN = Object.hasOwn;
const NUMBER_IS_SAFE_INTEGER = Number.isSafeInteger;
const OBJECT_CREATE = Object.create;
const OBJECT_IS = Object.is;
const OBJECT_PROTOTYPE = Object.prototype;
const OWN_KEYS = Reflect.ownKeys;
const WEAK_MAP_GET = WeakMap.prototype.get;
const WEAK_MAP_SET = WeakMap.prototype.set;
const SET_HAS = Set.prototype.has;
const INTERNAL_ERROR_TOKEN = Symbol('synthetic-protected-state-internal-error');
const INTERNAL_ERROR_RECORDS = new WeakMap();
const ERROR_KIND = Object.freeze({
  FIXED: 'FIXED',
  POSSIBLY_COMMITTED: 'POSSIBLY_COMMITTED',
  STATE_WRITE_UNCERTAIN: 'STATE_WRITE_UNCERTAIN',
  STATE_FENCE_REQUIRED: 'STATE_FENCE_REQUIRED'
});
// A plain option-bag literal inherits from Object.prototype, so an absent
// option such as `recursive` resolves through it and turns create-only into
// create-or-adopt. A null-prototype bag has no such fallback.
const ROOT_CREATE_OPTIONS = FREEZE(DEFINE_PROPERTY(OBJECT_CREATE(null), 'mode', {
  value: 0o700, enumerable: true, configurable: false, writable: false
}));
const SNAPSHOT_STATUS_ERROR_CODES = new Set([
  'KSTACK_SECRET_PROTECTED_ROOT_UNAVAILABLE',
  'KSTACK_SECRET_PROTECTED_ROOT_UNTRUSTED',
  'KSTACK_SECRET_PROTECTED_IDENTITY_UNAVAILABLE',
  'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID',
  'KSTACK_SECRET_PROTECTED_IDENTITY_DRIFT',
  'KSTACK_SECRET_PROTECTED_STATE_LOST',
  'KSTACK_SECRET_PROTECTED_STATE_INVALID',
  'KSTACK_SECRET_PROTECTED_STATE_BYTES_EXCEEDED',
  'KSTACK_SECRET_PROTECTED_STATE_LOCKED',
  'KSTACK_SECRET_PROTECTED_STATE_LOCK_FENCED'
]);

function arrayIncludes(values, value) { return APPLY(ARRAY_INCLUDES, values, [value]); }
function arrayFind(values, predicate) { return APPLY(ARRAY_FIND, values, [predicate]); }
function arrayFindIndex(values, predicate) { return APPLY(ARRAY_FIND_INDEX, values, [predicate]); }
function arraySome(values, predicate) { return APPLY(ARRAY_SOME, values, [predicate]); }
function arraySort(values, predicate) { return APPLY(ARRAY_SORT, values, [predicate]); }
// Two distinct hazards are closed here. Ordinary indexed assignment consults
// inherited numeric accessors when the index has no own property yet, so every
// index created here is an own data property and every descriptor or element
// read goes through an own-property check, so a missing key fails closed
// instead of resolving through `Object.prototype`. Separately, `map`/`filter` allocate their result through
// ArraySpeciesCreate, which resolves `Array.prototype.constructor` and
// `@@species` and so lets an attacker supply the container that receives the
// validated elements. `listMap`/`listFilter` allocate the container locally
// instead, so an authority-bearing list is only ever one this file built.
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
  if (!descriptor || !HAS_OWN(descriptor, 'value') || !OBJECT_IS(descriptor.value, value)) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  return list;
}
function listRead(list, index) {
  const descriptor = GET_OWN_PROPERTY_DESCRIPTOR(list, `${index}`);
  if (!descriptor || !HAS_OWN(descriptor, 'value')) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  return descriptor.value;
}
function arrayCopy(values) {
  const copy = [];
  const length = values.length;
  for (let index = 0; index < length; index += 1) listDefine(copy, index, listRead(values, index));
  if (copy.length !== length) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  return copy;
}
function arrayAppend(values, value) {
  const copy = arrayCopy(values);
  return listDefine(copy, copy.length, value);
}
function listMap(values, transform) {
  const output = [];
  const length = values.length;
  for (let index = 0; index < length; index += 1) listDefine(output, index, transform(listRead(values, index)));
  if (output.length !== length) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  return output;
}
function listFilter(values, predicate) {
  const output = [];
  const length = values.length;
  for (let index = 0; index < length; index += 1) {
    const value = listRead(values, index);
    if (predicate(value)) listDefine(output, output.length, value);
  }
  return output;
}
function assertListClosure(actual, expected, revalidate) {
  if (actual.length !== expected.length) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  for (let index = 0; index < expected.length; index += 1) {
    if (!exactBytes(revalidate(listRead(actual, index)), listRead(expected, index))) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  }
}

function defineError(error, name, code, kind) {
  DEFINE_PROPERTIES(error, {
    name: dataDescriptor(name, true),
    message: dataDescriptor(code, false),
    code: dataDescriptor(code, true)
  });
  if (kind) APPLY(WEAK_MAP_SET, INTERNAL_ERROR_RECORDS, [error, { kind, code }]);
}

function internalErrorRecord(error) {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) return undefined;
  return APPLY(WEAK_MAP_GET, INTERNAL_ERROR_RECORDS, [error]);
}

class PossiblyCommittedError extends Error {
  constructor() {
    super();
    defineError(this, 'PossiblyCommittedError', 'KSTACK_SECRET_PROTECTED_ACKNOWLEDGEMENT_UNKNOWN', ERROR_KIND.POSSIBLY_COMMITTED);
  }
}

class StateWriteUncertainError extends Error {
  constructor() {
    super();
    defineError(this, 'StateWriteUncertainError', 'KSTACK_SECRET_PROTECTED_STATE_WRITE_UNCERTAIN', ERROR_KIND.STATE_WRITE_UNCERTAIN);
  }
}

class StateFenceRequiredError extends Error {
  constructor() {
    super();
    defineError(this, 'StateFenceRequiredError', 'KSTACK_SECRET_PROTECTED_STATE_FENCE_REQUIRED', ERROR_KIND.STATE_FENCE_REQUIRED);
  }
}

export class SyntheticProtectedStateError extends Error {
  constructor(code, token) {
    super();
    defineError(this, 'SyntheticProtectedStateError', code, token === INTERNAL_ERROR_TOKEN ? ERROR_KIND.FIXED : undefined);
  }
}

function fail(code) { throw new SyntheticProtectedStateError(code, INTERNAL_ERROR_TOKEN); }
function plain(value) {
  try {
    return value !== null && typeof value === 'object' && !ARRAY_IS_ARRAY(value)
      && GET_PROTOTYPE_OF(value) === OBJECT_PROTOTYPE;
  } catch { return false; }
}
function snapshotRecord(value, keys, code, options) {
  const requireAll = options === undefined || !HAS_OWN(options, 'requireAll') ? true : options.requireAll;
  let descriptors;
  let actual;
  try {
    if (!plain(value)) fail(code);
    descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
    actual = OWN_KEYS(descriptors);
  } catch { fail(code); }
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
function exact(value, keys, code) {
  return snapshotRecord(value, keys, code);
}
function opaque(value, code) {
  try { validateSecretOpaqueRef(value); } catch { fail(code); }
}
function compare(left, right) { return APPLY(BUFFER_COMPARE, BUFFER_CONSTRUCTOR, [APPLY(BUFFER_FROM, BUFFER_CONSTRUCTOR, [left, 'utf8']), APPLY(BUFFER_FROM, BUFFER_CONSTRUCTOR, [right, 'utf8'])]); }
function randomOpaqueRef() { return `ksr1_${APPLY(BUFFER_TO_STRING, APPLY(CRYPTO_RANDOM_BYTES, crypto, [16]), ['base64url'])}`; }
function clone(value) { return parseSecretCanonicalJson(secretCanonicalBytes(value)); }
function frozen(value) {
  if (ARRAY_IS_ARRAY(value)) {
    const output = [];
    const length = value.length;
    for (let index = 0; index < length; index += 1) listDefine(output, index, frozen(listRead(value, index)));
    if (output.length !== length) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
    return FREEZE(output);
  }
  if (plain(value)) {
    const descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
    const keys = OWN_KEYS(descriptors);
    const output = {};
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      // An accessor descriptor carries no own `value`, so reading `.value` off
      // one resolves through Object.prototype.
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !HAS_OWN(descriptor, 'value')) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
      DEFINE_PROPERTY(output, key, dataDescriptor(frozen(descriptor.value), true));
    }
    return FREEZE(output);
  }
  return value;
}
function exactBytes(left, right) { return APPLY(BUFFER_EQUALS, secretCanonicalBytes(left), [secretCanonicalBytes(right)]); }

function validateIdentity(value) {
  const checked = exact(value, IDENTITY_KEYS, 'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID');
  if (checked.schemaVersion !== SYNTHETIC_PROTECTED_STATE_IDENTITY_VERSION
      || checked.profileId !== SYNTHETIC_PROTECTED_STATE_PROFILE || checked.productionEligible !== false) {
    fail('KSTACK_SECRET_PROTECTED_IDENTITY_INVALID');
  }
  opaque(checked.storeInstanceRef, 'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID');
  return frozen(clone(checked));
}

function validateSortedUnique(values, selector, code) {
  const length = values.length;
  for (let index = 1; index < length; index += 1) {
    if (compare(selector(listRead(values, index - 1)), selector(listRead(values, index))) >= 0) fail(code);
  }
}

function validateState(value, identity) {
  const checkedValue = exact(value, STATE_KEYS, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  if (checkedValue.schemaVersion !== SYNTHETIC_PROTECTED_STATE_VERSION || checkedValue.storeInstanceRef !== identity.storeInstanceRef
      || !ARRAY_IS_ARRAY(checkedValue.authorityHeads) || !ARRAY_IS_ARRAY(checkedValue.auditHeads)
      || !ARRAY_IS_ARRAY(checkedValue.issuedUpdateIds)
      || !ARRAY_IS_ARRAY(checkedValue.retiredUpdateIds) || !ARRAY_IS_ARRAY(checkedValue.retiredWriterLeaseRefs)
      || checkedValue.authorityHeads.length > SYNTHETIC_PROTECTED_STATE_MAX_NAMESPACES
      || checkedValue.auditHeads.length > SYNTHETIC_PROTECTED_STATE_MAX_NAMESPACES
      || checkedValue.issuedUpdateIds.length > SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS
      || checkedValue.retiredUpdateIds.length > SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS
      || checkedValue.retiredWriterLeaseRefs.length > SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  // Every list is copied into a locally allocated container before anything
  // validates, orders, or encodes it, so no later step can read a container the
  // caller still controls.
  const authorityHeads = listMap(checkedValue.authorityHeads, (entry) => validateAuthorityHeadValue(entry));
  const auditHeads = listMap(checkedValue.auditHeads, (entry) => validateAuditHeadValue(entry));
  const issuedUpdateIds = arrayCopy(checkedValue.issuedUpdateIds);
  const retiredUpdateIds = arrayCopy(checkedValue.retiredUpdateIds);
  const retiredWriterLeaseRefs = arrayCopy(checkedValue.retiredWriterLeaseRefs);
  const updateIdSets = [issuedUpdateIds, retiredUpdateIds];
  for (let setIndex = 0; setIndex < updateIdSets.length; setIndex += 1) {
    const ids = updateIdSets[setIndex];
    for (let index = 0; index < ids.length; index += 1) {
      try { validateSecretUpdateId(listRead(ids, index)); } catch { fail('KSTACK_SECRET_PROTECTED_STATE_INVALID'); }
    }
  }
  for (let index = 0; index < retiredWriterLeaseRefs.length; index += 1) {
    opaque(listRead(retiredWriterLeaseRefs, index), 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  }
  validateSortedUnique(authorityHeads, (entry) => entry.authorityNamespaceRef, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(auditHeads, (entry) => entry.auditNamespaceRef, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(issuedUpdateIds, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(retiredUpdateIds, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(retiredWriterLeaseRefs, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  if (arraySome(issuedUpdateIds, (id) => arrayIncludes(retiredUpdateIds, id))) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  const source = {
    ...checkedValue, authorityHeads, auditHeads, issuedUpdateIds, retiredUpdateIds, retiredWriterLeaseRefs
  };
  const checked = frozen(source);
  // Redundancy over provenance, not a substitute for it: the lists above are
  // already allocated here and populated only through `listDefine`, which is
  // what actually prevents container substitution. This re-checks that the
  // frozen copy still holds those exact validated elements.
  assertListClosure(checked.authorityHeads, authorityHeads, validateAuthorityHeadValue);
  assertListClosure(checked.auditHeads, auditHeads, validateAuditHeadValue);
  const bytes = secretCanonicalBytes(checked);
  if (!APPLY(BUFFER_EQUALS, bytes, [secretCanonicalBytes(source)])) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  if (bytes.length > SYNTHETIC_PROTECTED_STATE_MAX_BYTES) fail('KSTACK_SECRET_PROTECTED_STATE_BYTES_EXCEEDED');
  return checked;
}

function assertPrivateDirectory(root) {
  let stat;
  try { stat = fs.lstatSync(root); } catch { fail('KSTACK_SECRET_PROTECTED_ROOT_UNAVAILABLE'); }
  // Where this host has no own `getuid`, an ordinary read reaches an inherited
  // one, and this call site has no enclosing handler to code the throw.
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0
      || (HAS_OWN(process, 'getuid') && stat.uid !== process.getuid())) fail('KSTACK_SECRET_PROTECTED_ROOT_UNTRUSTED');
  let real;
  try { real = fs.realpathSync.native(root); } catch { fail('KSTACK_SECRET_PROTECTED_ROOT_UNTRUSTED'); }
  if (real !== path.resolve(root)) fail('KSTACK_SECRET_PROTECTED_ROOT_UNTRUSTED');
}

function readPrivateCanonical(file, maximum, unavailableCode, invalidCode) {
  let link;
  let descriptor;
  try {
    link = fs.lstatSync(file);
    if (!link.isFile() || link.isSymbolicLink() || link.nlink !== 1 || link.size < 2 || link.size > maximum
        || (link.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && link.uid !== process.getuid())) fail(invalidCode);
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== link.dev || opened.ino !== link.ino || opened.size !== link.size) fail(invalidCode);
    const bytes = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || bytes.length !== opened.size) fail(invalidCode);
    const parsed = parseSecretCanonicalJson(bytes);
    fs.closeSync(descriptor);
    descriptor = undefined;
    return parsed;
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    if (internalErrorRecord(error)?.kind === ERROR_KIND.FIXED) throw error;
    let errorCode;
    try {
      const descriptor = GET_OWN_PROPERTY_DESCRIPTOR(error, 'code');
      if (descriptor && HAS_OWN(descriptor, 'value')) errorCode = descriptor.value;
    } catch {}
    if (errorCode === 'ENOENT') fail(unavailableCode);
    fail(invalidCode);
  }
}

function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY ?? 0));
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function durableCreate(file, value) {
  const bytes = secretCanonicalBytes(value);
  const descriptor = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  syncDirectory(path.dirname(file));
}

function durableReplace(file, value) {
  const bytes = secretCanonicalBytes(value);
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.state.${process.pid}.${APPLY(CRYPTO_RANDOM_UUID, crypto, [])}.tmp`);
  let descriptor;
  let installed = false;
  try {
    descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
    installed = true;
    fs.chmodSync(file, 0o600);
    syncDirectory(directory);
  } catch {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(temporary); } catch {}
    if (installed) throw new PossiblyCommittedError();
    throw new StateWriteUncertainError();
  }
}

function lockOwner() {
  return frozen({ schemaVersion: 'kstack-secret-protected-state-lock-v1', token: APPLY(CRYPTO_RANDOM_UUID, crypto, []), pid: process.pid });
}

function acquireLock(paths) {
  const owner = lockOwner();
  try { durableCreate(paths.lock, owner); }
  catch { fail('KSTACK_SECRET_PROTECTED_STATE_LOCKED'); }
  return owner;
}

function releaseLock(paths, owner) {
  try {
    const current = readPrivateCanonical(paths.lock, 4_096, 'KSTACK_SECRET_PROTECTED_STATE_LOCK_FENCED', 'KSTACK_SECRET_PROTECTED_STATE_LOCK_FENCED');
    if (!exactBytes(current, owner)) fail('KSTACK_SECRET_PROTECTED_STATE_LOCK_FENCED');
    fs.unlinkSync(paths.lock);
    syncDirectory(paths.root);
  } catch { throw new PossiblyCommittedError(); }
}

function advanceCut(options, key) {
  const descriptor = GET_OWN_PROPERTY_DESCRIPTOR(options, key);
  return descriptor && HAS_OWN(descriptor, 'value') ? descriptor.value : undefined;
}

function validateAdvanceOptions(options) {
  try {
    const selected = snapshotRecord(options, ADVANCE_OPTION_KEYS, 'KSTACK_SECRET_PROTECTED_ADVANCE_OPTIONS_INVALID', { requireAll: false });
    const hasCrashCut = HAS_OWN(selected, 'crashCut');
    const hasAcknowledgementCut = HAS_OWN(selected, 'acknowledgementCut');
    const crashCut = hasCrashCut ? selected.crashCut : undefined;
    const acknowledgementCut = hasAcknowledgementCut ? selected.acknowledgementCut : undefined;
    if ((hasCrashCut && !arrayIncludes(['BEFORE_COMMIT', 'AFTER_COMMIT'], crashCut))
        || (hasAcknowledgementCut && acknowledgementCut !== 'AFTER_COMMIT')
        || (hasCrashCut && hasAcknowledgementCut)) throw new Error();
    return frozen({ ...(hasCrashCut ? { crashCut } : {}), ...(hasAcknowledgementCut ? { acknowledgementCut } : {}) });
  } catch { fail('KSTACK_SECRET_PROTECTED_ADVANCE_OPTIONS_INVALID'); }
}

function validateOpenOptions(options, code) {
  try {
    const selected = snapshotRecord(options, OPEN_KEYS, code, { requireAll: false });
    if (!HAS_OWN(selected, 'root')) throw new Error();
    const root = selected.root;
    const clock = HAS_OWN(selected, 'clock') ? selected.clock : DATE_NOW;
    if (typeof root !== 'string') throw new Error();
    return { root, clock };
  } catch { fail(code); }
}

function validateAuditWriterRequest(request) {
  let auditNamespaceRef;
  let ttlMs;
  try {
    const selected = snapshotRecord(request, AUDIT_WRITER_KEYS, 'KSTACK_SECRET_AUDIT_WRITER_REQUEST_INVALID');
    auditNamespaceRef = selected.auditNamespaceRef;
    ttlMs = selected.ttlMs;
    if (!NUMBER_IS_SAFE_INTEGER(ttlMs) || ttlMs < 1 || ttlMs > 60_000) throw new Error();
  } catch { fail('KSTACK_SECRET_AUDIT_WRITER_REQUEST_INVALID'); }
  opaque(auditNamespaceRef, 'KSTACK_SECRET_AUDIT_NAMESPACE_INVALID');
  return { auditNamespaceRef, ttlMs };
}

function pathsFor(root) {
  const resolved = path.resolve(root ?? '');
  if (!path.isAbsolute(root ?? '') || resolved === path.parse(resolved).root) fail('KSTACK_SECRET_PROTECTED_ROOT_INVALID');
  return {
    root: resolved,
    identity: path.join(resolved, 'identity-v1.json'),
    state: path.join(resolved, 'state-v1.json'),
    lock: path.join(resolved, 'state-v1.lock')
  };
}

function validateClock(clock) {
  if (typeof clock !== 'function') fail('KSTACK_SECRET_PROTECTED_CLOCK_INVALID');
  clockNow(clock);
  return clock;
}

function clockNow(clock) {
  let now;
  try { now = clock(); } catch { fail('KSTACK_SECRET_PROTECTED_CLOCK_INVALID'); }
  if (!NUMBER_IS_SAFE_INTEGER(now) || now < 0 || now > MAX_CANONICAL_CLOCK_MS) fail('KSTACK_SECRET_PROTECTED_CLOCK_INVALID');
  return now;
}

function leaseDeadline(now, ttlMs) {
  if (now > MAX_CANONICAL_CLOCK_MS - ttlMs) fail('KSTACK_SECRET_PROTECTED_CLOCK_INVALID');
  return APPLY(DATE_TO_ISO_STRING, new DATE_CONSTRUCTOR(now + ttlMs), []);
}

function assertAuditLeaseCurrent(state, clock) {
  if (state.auditHeads.length !== 0 && APPLY(DATE_PARSE, DATE_CONSTRUCTOR, [state.auditHeads[0].writerLeaseDeadline]) <= clockNow(clock)) {
    throw new StateFenceRequiredError();
  }
}

function checkedAuthorityHead(value) {
  return validateAuthorityHeadValue(value);
}

function checkedAuditHead(value) {
  return validateAuditHeadValue(value);
}

export class SyntheticProtectedStateAdapter {
  #paths;
  #identity;
  #clock;

  constructor(token, paths, identity, clock) {
    if (token !== CONSTRUCTOR) fail('KSTACK_SECRET_PROTECTED_CONSTRUCTOR_DENIED');
    this.#paths = paths;
    this.#identity = identity;
    this.#clock = clock;
  }

  static create(options = {}) {
    const checked = validateOpenOptions(options, 'KSTACK_SECRET_PROTECTED_CREATE_OPTIONS_INVALID');
    const paths = pathsFor(checked.root);
    const clock = validateClock(checked.clock);
    try { fs.mkdirSync(paths.root, ROOT_CREATE_OPTIONS); } catch { fail('KSTACK_SECRET_PROTECTED_ROOT_CREATE_FAILED'); }
    assertPrivateDirectory(paths.root);
    const identity = validateIdentity({
      schemaVersion: SYNTHETIC_PROTECTED_STATE_IDENTITY_VERSION,
      storeInstanceRef: randomOpaqueRef(),
      profileId: SYNTHETIC_PROTECTED_STATE_PROFILE,
      productionEligible: false
    });
    const state = validateState({
      schemaVersion: SYNTHETIC_PROTECTED_STATE_VERSION,
      storeInstanceRef: identity.storeInstanceRef,
      authorityHeads: [],
      auditHeads: [],
      issuedUpdateIds: [],
      retiredUpdateIds: [],
      retiredWriterLeaseRefs: []
    }, identity);
    try { durableCreate(paths.identity, identity); durableCreate(paths.state, state); }
    catch (error) {
      if (internalErrorRecord(error)?.kind === ERROR_KIND.FIXED) throw error;
      fail('KSTACK_SECRET_PROTECTED_INITIALIZATION_FAILED');
    }
    return new SyntheticProtectedStateAdapter(CONSTRUCTOR, paths, identity, clock);
  }

  static open(options = {}) {
    const checked = validateOpenOptions(options, 'KSTACK_SECRET_PROTECTED_OPEN_OPTIONS_INVALID');
    const paths = pathsFor(checked.root);
    const clock = validateClock(checked.clock);
    assertPrivateDirectory(paths.root);
    const owner = acquireLock(paths);
    let identity;
    let openError;
    try {
      identity = validateIdentity(readPrivateCanonical(paths.identity, 4_096, 'KSTACK_SECRET_PROTECTED_IDENTITY_UNAVAILABLE', 'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID'));
      const state = validateState(readPrivateCanonical(paths.state, SYNTHETIC_PROTECTED_STATE_MAX_BYTES, 'KSTACK_SECRET_PROTECTED_STATE_LOST', 'KSTACK_SECRET_PROTECTED_STATE_INVALID'), identity);
      assertAuditLeaseCurrent(state, clock);
    } catch (error) { openError = error; }
    if (internalErrorRecord(openError)?.kind === ERROR_KIND.STATE_FENCE_REQUIRED) fail('KSTACK_SECRET_PROTECTED_STATE_LOCKED');
    try { releaseLock(paths, owner); }
    catch { fail('KSTACK_SECRET_PROTECTED_STATE_LOCK_FENCED'); }
    if (openError) throw openError;
    return new SyntheticProtectedStateAdapter(CONSTRUCTOR, paths, identity, clock);
  }

  status() {
    return this.#read(() => frozen({ profileId: SYNTHETIC_PROTECTED_STATE_PROFILE, productionEligible: false, state: 'SYNTHETIC_READY' }));
  }

  #now() { return clockNow(this.#clock); }

  #readState() {
    assertPrivateDirectory(this.#paths.root);
    const currentIdentity = validateIdentity(readPrivateCanonical(this.#paths.identity, 4_096, 'KSTACK_SECRET_PROTECTED_IDENTITY_UNAVAILABLE', 'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID'));
    if (!exactBytes(currentIdentity, this.#identity)) fail('KSTACK_SECRET_PROTECTED_IDENTITY_DRIFT');
    return validateState(readPrivateCanonical(this.#paths.state, SYNTHETIC_PROTECTED_STATE_MAX_BYTES, 'KSTACK_SECRET_PROTECTED_STATE_LOST', 'KSTACK_SECRET_PROTECTED_STATE_INVALID'), currentIdentity);
  }

  #withLock(action) {
    const owner = acquireLock(this.#paths);
    let result;
    let actionError;
    try {
      const state = this.#readState();
      assertAuditLeaseCurrent(state, this.#clock);
      result = action(state);
    } catch (error) { actionError = error; }
    const actionErrorKind = internalErrorRecord(actionError)?.kind;
    if (actionErrorKind === ERROR_KIND.STATE_WRITE_UNCERTAIN || actionErrorKind === ERROR_KIND.STATE_FENCE_REQUIRED) throw actionError;
    releaseLock(this.#paths, owner);
    if (actionError) throw actionError;
    return result;
  }

  #writeState(state) {
    const checked = validateState(state, this.#identity);
    durableReplace(this.#paths.state, checked);
    return checked;
  }

  #mutation(action) {
    try { return this.#withLock(action); }
    catch (error) {
      const kind = internalErrorRecord(error)?.kind;
      if (kind === ERROR_KIND.POSSIBLY_COMMITTED || kind === ERROR_KIND.STATE_WRITE_UNCERTAIN || kind === ERROR_KIND.STATE_FENCE_REQUIRED) {
        return frozen({ result: 'ACKNOWLEDGEMENT_UNKNOWN' });
      }
      throw error;
    }
  }

  #read(action) {
    try { return this.#withLock(action); }
    catch (error) {
      const kind = internalErrorRecord(error)?.kind;
      if (kind === ERROR_KIND.POSSIBLY_COMMITTED) fail('KSTACK_SECRET_PROTECTED_STATE_LOCK_FENCED');
      if (kind === ERROR_KIND.STATE_FENCE_REQUIRED) fail('KSTACK_SECRET_PROTECTED_STATE_LOCKED');
      throw error;
    }
  }

  #retireAttempt(state, updateId) {
    if (arrayIncludes(state.retiredUpdateIds, updateId)) fail('KSTACK_SECRET_PROTECTED_UPDATE_ID_REUSED');
    if (!arrayIncludes(state.issuedUpdateIds, updateId)) fail('KSTACK_SECRET_PROTECTED_UPDATE_ID_NOT_ISSUED');
    return {
      ...state,
      issuedUpdateIds: listFilter(state.issuedUpdateIds, (id) => id !== updateId),
      retiredUpdateIds: arraySort(arrayAppend(state.retiredUpdateIds, updateId), compare)
    };
  }

  issueUpdateId() {
    return this.#mutation((state) => {
      if (state.issuedUpdateIds.length + state.retiredUpdateIds.length >= SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS) {
        fail('KSTACK_SECRET_PROTECTED_RETIRED_IDS_EXHAUSTED');
      }
      let updateId;
      for (let attempt = 0; attempt < 32; attempt += 1) {
        const candidate = generateSecretUpdateId();
        if (!arrayIncludes(state.issuedUpdateIds, candidate) && !arrayIncludes(state.retiredUpdateIds, candidate)) { updateId = candidate; break; }
      }
      if (!updateId) fail('KSTACK_SECRET_PROTECTED_ID_COLLISION_EXHAUSTED');
      this.#writeState({ ...state, issuedUpdateIds: arraySort(arrayAppend(state.issuedUpdateIds, updateId), compare) });
      return frozen({ result: 'ISSUED', updateId });
    });
  }

  initializeAuthority(authorityNamespaceRef) {
    opaque(authorityNamespaceRef, 'KSTACK_SECRET_AUTHORITY_NAMESPACE_INVALID');
    return this.#mutation((state) => {
      if (state.authorityHeads.length !== 0) fail('KSTACK_SECRET_AUTHORITY_ALREADY_INITIALIZED');
      const head = authorityOrigin(authorityNamespaceRef);
      const authorityHeads = arraySort(arrayAppend(state.authorityHeads, head), (left, right) => compare(left.authorityNamespaceRef, right.authorityNamespaceRef));
      const placed = arrayFind(authorityHeads, (entry) => entry.authorityNamespaceRef === authorityNamespaceRef);
      if (!placed || !exactBytes(placed, head) || authorityHeads.length !== state.authorityHeads.length + 1) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
      this.#writeState({ ...state, authorityHeads });
      return frozen({ result: 'INITIALIZED', head });
    });
  }

  readAuthorityHead(authorityNamespaceRef) {
    opaque(authorityNamespaceRef, 'KSTACK_SECRET_AUTHORITY_NAMESPACE_INVALID');
    return this.#read((state) => {
      const head = arrayFind(state.authorityHeads, (entry) => entry.authorityNamespaceRef === authorityNamespaceRef);
      if (!head) fail('KSTACK_SECRET_AUTHORITY_UNAVAILABLE');
      return head;
    });
  }

  compareAndAdvanceAuthority(expected, updateId, options = {}) {
    const checkedExpected = checkedAuthorityHead(expected);
    const successor = authoritySuccessor(checkedExpected, updateId);
    const checkedOptions = validateAdvanceOptions(options);
    const crashCut = advanceCut(checkedOptions, 'crashCut');
    const acknowledgementCut = advanceCut(checkedOptions, 'acknowledgementCut');
    return this.#mutation((state) => {
      const attempted = this.#retireAttempt(state, updateId);
      this.#writeState(attempted);
      const index = arrayFindIndex(state.authorityHeads, (entry) => entry.authorityNamespaceRef === checkedExpected.authorityNamespaceRef);
      if (index < 0) fail('KSTACK_SECRET_AUTHORITY_UNAVAILABLE');
      if (!exactBytes(state.authorityHeads[index], checkedExpected)) return frozen({ result: 'EXPECTATION_MISMATCH' });
      if (crashCut === 'BEFORE_COMMIT') {
        fail('KSTACK_SECRET_PROTECTED_CRASH_BEFORE_COMMIT');
      }
      const authorityHeads = listDefine(arrayCopy(state.authorityHeads), index, successor);
      if (authorityHeads.length !== state.authorityHeads.length || !exactBytes(listRead(authorityHeads, index), successor)) {
        fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
      }
      this.#writeState({ ...attempted, authorityHeads });
      if (crashCut === 'AFTER_COMMIT') throw new PossiblyCommittedError();
      if (acknowledgementCut === 'AFTER_COMMIT') return frozen({ result: 'ACKNOWLEDGEMENT_UNKNOWN' });
      return frozen({ result: 'ADVANCED', head: successor });
    });
  }

  verifyAuthoritySnapshot(snapshot) {
    const expected = checkedAuthorityHead(snapshot);
    const current = this.readAuthorityHead(expected.authorityNamespaceRef);
    return exactBytes(current, expected) ? 'READY' : 'EPOCH_MISMATCH';
  }

  acquireAuditWriter(request) {
    const { auditNamespaceRef, ttlMs } = validateAuditWriterRequest(request);
    return this.#mutation((state) => {
      const now = this.#now();
      const index = arrayFindIndex(state.auditHeads, (entry) => entry.auditNamespaceRef === auditNamespaceRef);
      if (index < 0 && state.auditHeads.length !== 0) fail('KSTACK_SECRET_AUDIT_NAMESPACE_MISMATCH');
      if (index >= 0 && APPLY(DATE_PARSE, DATE_CONSTRUCTOR, [state.auditHeads[index].writerLeaseDeadline]) > now) return frozen({ result: 'WRITER_UNAVAILABLE' });
      if (index >= 0) throw new StateFenceRequiredError();
      if (state.retiredWriterLeaseRefs.length >= SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS) fail('KSTACK_SECRET_PROTECTED_RETIRED_IDS_EXHAUSTED');
      let writerLeaseRef;
      for (let attempt = 0; attempt < 32; attempt += 1) {
        const candidate = randomOpaqueRef();
        if (!arrayIncludes(state.retiredWriterLeaseRefs, candidate)) { writerLeaseRef = candidate; break; }
      }
      if (!writerLeaseRef) fail('KSTACK_SECRET_PROTECTED_ID_COLLISION_EXHAUSTED');
      const writerLeaseDeadline = leaseDeadline(now, ttlMs);
      const head = index < 0
        ? auditOrigin(auditNamespaceRef, 1, writerLeaseRef, writerLeaseDeadline)
        : validateAuditHeadValue({ ...state.auditHeads[index], writerLeaseRef, writerLeaseDeadline });
      const auditHeads = arrayCopy(state.auditHeads);
      listDefine(auditHeads, index < 0 ? auditHeads.length : index, head);
      arraySort(auditHeads, (left, right) => compare(left.auditNamespaceRef, right.auditNamespaceRef));
      const acquired = arrayFind(auditHeads, (entry) => entry.auditNamespaceRef === auditNamespaceRef);
      if (!acquired || !exactBytes(acquired, head)) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
      const retiredWriterLeaseRefs = arraySort(arrayAppend(state.retiredWriterLeaseRefs, writerLeaseRef), compare);
      this.#writeState({ ...state, auditHeads, retiredWriterLeaseRefs });
      return frozen({ result: 'ACQUIRED', head });
    });
  }

  readAuditHead(auditNamespaceRef) {
    opaque(auditNamespaceRef, 'KSTACK_SECRET_AUDIT_NAMESPACE_INVALID');
    return this.#read((state) => {
      const head = arrayFind(state.auditHeads, (entry) => entry.auditNamespaceRef === auditNamespaceRef);
      if (!head) fail('KSTACK_SECRET_AUDIT_HEAD_UNAVAILABLE');
      return head;
    });
  }

  compareAndAdvanceAudit(expected, eventDigest, updateId, options = {}) {
    const checkedExpected = checkedAuditHead(expected);
    const successor = auditSuccessor(checkedExpected, eventDigest, updateId);
    const checkedOptions = validateAdvanceOptions(options);
    const crashCut = advanceCut(checkedOptions, 'crashCut');
    const acknowledgementCut = advanceCut(checkedOptions, 'acknowledgementCut');
    return this.#mutation((state) => {
      const attempted = this.#retireAttempt(state, updateId);
      this.#writeState(attempted);
      const index = arrayFindIndex(state.auditHeads, (entry) => entry.auditNamespaceRef === checkedExpected.auditNamespaceRef);
      if (index < 0) fail('KSTACK_SECRET_AUDIT_HEAD_UNAVAILABLE');
      const current = state.auditHeads[index];
      if (!exactBytes(current, checkedExpected)) return frozen({ result: 'EXPECTATION_MISMATCH' });
      if (APPLY(DATE_PARSE, DATE_CONSTRUCTOR, [current.writerLeaseDeadline]) <= this.#now()) throw new StateFenceRequiredError();
      if (crashCut === 'BEFORE_COMMIT') {
        fail('KSTACK_SECRET_PROTECTED_CRASH_BEFORE_COMMIT');
      }
      const auditHeads = listDefine(arrayCopy(state.auditHeads), index, successor);
      if (auditHeads.length !== state.auditHeads.length || !exactBytes(listRead(auditHeads, index), successor)) {
        fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
      }
      this.#writeState({ ...attempted, auditHeads });
      if (crashCut === 'AFTER_COMMIT') throw new PossiblyCommittedError();
      if (acknowledgementCut === 'AFTER_COMMIT') return frozen({ result: 'ACKNOWLEDGEMENT_UNKNOWN' });
      return frozen({ result: 'ADVANCED', head: successor });
    });
  }

  verifyAuditSnapshot(snapshot) {
    const expected = checkedAuditHead(snapshot);
    const current = this.readAuditHead(expected.auditNamespaceRef);
    return exactBytes(current, expected) ? 'READY' : 'HEAD_MISMATCH';
  }
}

const SYNTHETIC_STATUS_BRAND_OPERATION = SyntheticProtectedStateAdapter.prototype.status;

export function syntheticProtectedStateSnapshotBytes(adapter) {
  let status;
  try {
    status = APPLY(SYNTHETIC_STATUS_BRAND_OPERATION, adapter, []);
  } catch (error) {
    const record = internalErrorRecord(error);
    if (record?.kind === ERROR_KIND.FIXED && APPLY(SET_HAS, SNAPSHOT_STATUS_ERROR_CODES, [record.code])) fail(record.code);
    fail('KSTACK_SECRET_PROTECTED_ADAPTER_INVALID');
  }
  let checkedStatus;
  try { checkedStatus = snapshotRecord(status, STATUS_KEYS, 'KSTACK_SECRET_PROTECTED_ADAPTER_INVALID'); }
  catch { fail('KSTACK_SECRET_PROTECTED_ADAPTER_INVALID'); }
  if (checkedStatus.profileId !== SYNTHETIC_PROTECTED_STATE_PROFILE
      || checkedStatus.productionEligible !== false || checkedStatus.state !== 'SYNTHETIC_READY') {
    fail('KSTACK_SECRET_PROTECTED_ADAPTER_INVALID');
  }
  return secretCanonicalBytes({
    schemaVersion: 'kstack-secret-protected-state-public-status-v1',
    profileId: SYNTHETIC_PROTECTED_STATE_PROFILE,
    productionEligible: false,
    state: 'SYNTHETIC_READY'
  });
}
