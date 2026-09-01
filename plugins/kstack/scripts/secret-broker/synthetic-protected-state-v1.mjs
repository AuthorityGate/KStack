import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';
import { validateOpaqueRef } from './public-v1.mjs';
import {
  auditOrigin,
  auditSuccessor,
  authorityOrigin,
  authoritySuccessor,
  canonicalAuditHeadBytes,
  canonicalAuthorityHeadBytes,
  generateSecretUpdateId,
  validateSecretUpdateId,
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
const MAX_CANONICAL_CLOCK_MS = Date.parse('9999-12-31T23:59:59.999Z');
const APPLY = Reflect.apply;
const ARRAY_IS_ARRAY = Array.isArray;
const DEFINE_PROPERTY = Object.defineProperty;
const DEFINE_PROPERTIES = Object.defineProperties;
const GET_OWN_PROPERTY_DESCRIPTORS = Object.getOwnPropertyDescriptors;
const GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const GET_PROTOTYPE_OF = Object.getPrototypeOf;
const HAS_OWN = Object.hasOwn;
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

function defineError(error, name, code, kind) {
  DEFINE_PROPERTIES(error, {
    name: { value: name, enumerable: true, configurable: true, writable: true },
    message: { value: code, enumerable: false, configurable: true, writable: true },
    code: { value: code, enumerable: true, configurable: true, writable: true }
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
function snapshotRecord(value, keys, code, { requireAll = true } = {}) {
  let descriptors;
  let actual;
  try {
    if (!plain(value)) fail(code);
    descriptors = GET_OWN_PROPERTY_DESCRIPTORS(value);
    actual = OWN_KEYS(descriptors);
  } catch { fail(code); }
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
function exact(value, keys, code) {
  return snapshotRecord(value, keys, code);
}
function opaque(value, code) {
  try { validateOpaqueRef(value); } catch { fail(code); }
}
function compare(left, right) { return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')); }
function randomOpaqueRef() { return `ksr1_${crypto.randomBytes(16).toString('base64url')}`; }
function clone(value) { return parseHostCanonicalJson(hostCanonicalBytes(value)); }
function frozen(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(frozen));
  if (plain(value)) return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, frozen(item)])));
  return value;
}
function exactBytes(left, right) { return hostCanonicalBytes(left).equals(hostCanonicalBytes(right)); }

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
  for (let index = 1; index < values.length; index += 1) {
    if (compare(selector(values[index - 1]), selector(values[index])) >= 0) fail(code);
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
  const authorityHeads = checkedValue.authorityHeads.map((entry) => validateAuthorityHeadValue(entry));
  const auditHeads = checkedValue.auditHeads.map((entry) => validateAuditHeadValue(entry));
  for (const id of [...checkedValue.issuedUpdateIds, ...checkedValue.retiredUpdateIds]) {
    try { validateSecretUpdateId(id); } catch { fail('KSTACK_SECRET_PROTECTED_STATE_INVALID'); }
  }
  for (const reference of checkedValue.retiredWriterLeaseRefs) opaque(reference, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(authorityHeads, (entry) => entry.authorityNamespaceRef, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(auditHeads, (entry) => entry.auditNamespaceRef, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(checkedValue.issuedUpdateIds, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(checkedValue.retiredUpdateIds, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(checkedValue.retiredWriterLeaseRefs, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  if (checkedValue.issuedUpdateIds.some((id) => checkedValue.retiredUpdateIds.includes(id))) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  const checked = frozen({ ...checkedValue, authorityHeads, auditHeads });
  if (hostCanonicalBytes(checked).length > SYNTHETIC_PROTECTED_STATE_MAX_BYTES) fail('KSTACK_SECRET_PROTECTED_STATE_BYTES_EXCEEDED');
  return checked;
}

function assertPrivateDirectory(root) {
  let stat;
  try { stat = fs.lstatSync(root); } catch { fail('KSTACK_SECRET_PROTECTED_ROOT_UNAVAILABLE'); }
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0
      || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) fail('KSTACK_SECRET_PROTECTED_ROOT_UNTRUSTED');
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
    const parsed = parseHostCanonicalJson(bytes);
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
  const bytes = hostCanonicalBytes(value);
  const descriptor = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  syncDirectory(path.dirname(file));
}

function durableReplace(file, value) {
  const bytes = hostCanonicalBytes(value);
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.state.${process.pid}.${crypto.randomUUID()}.tmp`);
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
  return frozen({ schemaVersion: 'kstack-secret-protected-state-lock-v1', token: crypto.randomUUID(), pid: process.pid });
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

function validateAdvanceOptions(options) {
  try {
    const selected = snapshotRecord(options, ADVANCE_OPTION_KEYS, 'KSTACK_SECRET_PROTECTED_ADVANCE_OPTIONS_INVALID', { requireAll: false });
    const hasCrashCut = HAS_OWN(selected, 'crashCut');
    const hasAcknowledgementCut = HAS_OWN(selected, 'acknowledgementCut');
    const crashCut = hasCrashCut ? selected.crashCut : undefined;
    const acknowledgementCut = hasAcknowledgementCut ? selected.acknowledgementCut : undefined;
    if ((hasCrashCut && !['BEFORE_COMMIT', 'AFTER_COMMIT'].includes(crashCut))
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
    const clock = HAS_OWN(selected, 'clock') ? selected.clock : Date.now;
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
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 60_000) throw new Error();
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
  if (!Number.isSafeInteger(now) || now < 0 || now > MAX_CANONICAL_CLOCK_MS) fail('KSTACK_SECRET_PROTECTED_CLOCK_INVALID');
  return now;
}

function leaseDeadline(now, ttlMs) {
  if (now > MAX_CANONICAL_CLOCK_MS - ttlMs) fail('KSTACK_SECRET_PROTECTED_CLOCK_INVALID');
  return new Date(now + ttlMs).toISOString();
}

function assertAuditLeaseCurrent(state, clock) {
  if (state.auditHeads.length !== 0 && Date.parse(state.auditHeads[0].writerLeaseDeadline) <= clockNow(clock)) {
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
    try { fs.mkdirSync(paths.root, { mode: 0o700 }); } catch { fail('KSTACK_SECRET_PROTECTED_ROOT_CREATE_FAILED'); }
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
    if (state.retiredUpdateIds.includes(updateId)) fail('KSTACK_SECRET_PROTECTED_UPDATE_ID_REUSED');
    if (!state.issuedUpdateIds.includes(updateId)) fail('KSTACK_SECRET_PROTECTED_UPDATE_ID_NOT_ISSUED');
    return {
      ...state,
      issuedUpdateIds: state.issuedUpdateIds.filter((id) => id !== updateId),
      retiredUpdateIds: [...state.retiredUpdateIds, updateId].sort(compare)
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
        if (!state.issuedUpdateIds.includes(candidate) && !state.retiredUpdateIds.includes(candidate)) { updateId = candidate; break; }
      }
      if (!updateId) fail('KSTACK_SECRET_PROTECTED_ID_COLLISION_EXHAUSTED');
      this.#writeState({ ...state, issuedUpdateIds: [...state.issuedUpdateIds, updateId].sort(compare) });
      return frozen({ result: 'ISSUED', updateId });
    });
  }

  initializeAuthority(authorityNamespaceRef) {
    opaque(authorityNamespaceRef, 'KSTACK_SECRET_AUTHORITY_NAMESPACE_INVALID');
    return this.#mutation((state) => {
      if (state.authorityHeads.length !== 0) fail('KSTACK_SECRET_AUTHORITY_ALREADY_INITIALIZED');
      const head = authorityOrigin(authorityNamespaceRef);
      const authorityHeads = [...state.authorityHeads, head].sort((left, right) => compare(left.authorityNamespaceRef, right.authorityNamespaceRef));
      this.#writeState({ ...state, authorityHeads });
      return frozen({ result: 'INITIALIZED', head });
    });
  }

  readAuthorityHead(authorityNamespaceRef) {
    opaque(authorityNamespaceRef, 'KSTACK_SECRET_AUTHORITY_NAMESPACE_INVALID');
    return this.#read((state) => {
      const head = state.authorityHeads.find((entry) => entry.authorityNamespaceRef === authorityNamespaceRef);
      if (!head) fail('KSTACK_SECRET_AUTHORITY_UNAVAILABLE');
      return head;
    });
  }

  compareAndAdvanceAuthority(expected, updateId, options = {}) {
    const checkedExpected = checkedAuthorityHead(expected);
    const successor = authoritySuccessor(checkedExpected, updateId);
    const checkedOptions = validateAdvanceOptions(options);
    return this.#mutation((state) => {
      const attempted = this.#retireAttempt(state, updateId);
      this.#writeState(attempted);
      const index = state.authorityHeads.findIndex((entry) => entry.authorityNamespaceRef === checkedExpected.authorityNamespaceRef);
      if (index < 0) fail('KSTACK_SECRET_AUTHORITY_UNAVAILABLE');
      if (!exactBytes(state.authorityHeads[index], checkedExpected)) return frozen({ result: 'EXPECTATION_MISMATCH' });
      if (checkedOptions.crashCut === 'BEFORE_COMMIT') {
        fail('KSTACK_SECRET_PROTECTED_CRASH_BEFORE_COMMIT');
      }
      const authorityHeads = [...state.authorityHeads];
      authorityHeads[index] = successor;
      this.#writeState({ ...attempted, authorityHeads });
      if (checkedOptions.crashCut === 'AFTER_COMMIT') throw new PossiblyCommittedError();
      if (checkedOptions.acknowledgementCut === 'AFTER_COMMIT') return frozen({ result: 'ACKNOWLEDGEMENT_UNKNOWN' });
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
      const index = state.auditHeads.findIndex((entry) => entry.auditNamespaceRef === auditNamespaceRef);
      if (index < 0 && state.auditHeads.length !== 0) fail('KSTACK_SECRET_AUDIT_NAMESPACE_MISMATCH');
      if (index >= 0 && Date.parse(state.auditHeads[index].writerLeaseDeadline) > now) return frozen({ result: 'WRITER_UNAVAILABLE' });
      if (index >= 0) throw new StateFenceRequiredError();
      if (state.retiredWriterLeaseRefs.length >= SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS) fail('KSTACK_SECRET_PROTECTED_RETIRED_IDS_EXHAUSTED');
      let writerLeaseRef;
      for (let attempt = 0; attempt < 32; attempt += 1) {
        const candidate = randomOpaqueRef();
        if (!state.retiredWriterLeaseRefs.includes(candidate)) { writerLeaseRef = candidate; break; }
      }
      if (!writerLeaseRef) fail('KSTACK_SECRET_PROTECTED_ID_COLLISION_EXHAUSTED');
      const writerLeaseDeadline = leaseDeadline(now, ttlMs);
      const head = index < 0
        ? auditOrigin(auditNamespaceRef, 1, writerLeaseRef, writerLeaseDeadline)
        : validateAuditHeadValue({ ...state.auditHeads[index], writerLeaseRef, writerLeaseDeadline });
      const auditHeads = [...state.auditHeads];
      if (index < 0) auditHeads.push(head); else auditHeads[index] = head;
      auditHeads.sort((left, right) => compare(left.auditNamespaceRef, right.auditNamespaceRef));
      const retiredWriterLeaseRefs = [...state.retiredWriterLeaseRefs, writerLeaseRef].sort(compare);
      this.#writeState({ ...state, auditHeads, retiredWriterLeaseRefs });
      return frozen({ result: 'ACQUIRED', head });
    });
  }

  readAuditHead(auditNamespaceRef) {
    opaque(auditNamespaceRef, 'KSTACK_SECRET_AUDIT_NAMESPACE_INVALID');
    return this.#read((state) => {
      const head = state.auditHeads.find((entry) => entry.auditNamespaceRef === auditNamespaceRef);
      if (!head) fail('KSTACK_SECRET_AUDIT_HEAD_UNAVAILABLE');
      return head;
    });
  }

  compareAndAdvanceAudit(expected, eventDigest, updateId, options = {}) {
    const checkedExpected = checkedAuditHead(expected);
    const successor = auditSuccessor(checkedExpected, eventDigest, updateId);
    const checkedOptions = validateAdvanceOptions(options);
    return this.#mutation((state) => {
      const attempted = this.#retireAttempt(state, updateId);
      this.#writeState(attempted);
      const index = state.auditHeads.findIndex((entry) => entry.auditNamespaceRef === checkedExpected.auditNamespaceRef);
      if (index < 0) fail('KSTACK_SECRET_AUDIT_HEAD_UNAVAILABLE');
      const current = state.auditHeads[index];
      if (!exactBytes(current, checkedExpected)) return frozen({ result: 'EXPECTATION_MISMATCH' });
      if (Date.parse(current.writerLeaseDeadline) <= this.#now()) throw new StateFenceRequiredError();
      if (checkedOptions.crashCut === 'BEFORE_COMMIT') {
        fail('KSTACK_SECRET_PROTECTED_CRASH_BEFORE_COMMIT');
      }
      const auditHeads = [...state.auditHeads];
      auditHeads[index] = successor;
      this.#writeState({ ...attempted, auditHeads });
      if (checkedOptions.crashCut === 'AFTER_COMMIT') throw new PossiblyCommittedError();
      if (checkedOptions.acknowledgementCut === 'AFTER_COMMIT') return frozen({ result: 'ACKNOWLEDGEMENT_UNKNOWN' });
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
  return hostCanonicalBytes({
    schemaVersion: 'kstack-secret-protected-state-public-status-v1',
    profileId: SYNTHETIC_PROTECTED_STATE_PROFILE,
    productionEligible: false,
    state: 'SYNTHETIC_READY'
  });
}
