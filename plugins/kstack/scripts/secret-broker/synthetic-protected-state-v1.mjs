import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';
import { validateOpaqueRef } from './public-v1.mjs';
import {
  SecretControlPlaneError,
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
const MAX_CANONICAL_CLOCK_MS = Date.parse('9999-12-31T23:59:59.999Z');
const APPLY = Reflect.apply;
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

class PossiblyCommittedError extends Error {
  constructor() { super('KSTACK_SECRET_PROTECTED_ACKNOWLEDGEMENT_UNKNOWN'); this.code = 'KSTACK_SECRET_PROTECTED_ACKNOWLEDGEMENT_UNKNOWN'; }
}

class StateWriteUncertainError extends Error {
  constructor() { super('KSTACK_SECRET_PROTECTED_STATE_WRITE_UNCERTAIN'); this.code = 'KSTACK_SECRET_PROTECTED_STATE_WRITE_UNCERTAIN'; }
}

class StateFenceRequiredError extends Error {
  constructor() { super('KSTACK_SECRET_PROTECTED_STATE_FENCE_REQUIRED'); this.code = 'KSTACK_SECRET_PROTECTED_STATE_FENCE_REQUIRED'; }
}

export class SyntheticProtectedStateError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SyntheticProtectedStateError';
    this.code = code;
  }
}

function fail(code) { throw new SyntheticProtectedStateError(code); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys, code) {
  if (!plain(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
      || Object.keys(value).some((key) => !keys.includes(key))) fail(code);
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
  exact(value, IDENTITY_KEYS, 'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID');
  if (value.schemaVersion !== SYNTHETIC_PROTECTED_STATE_IDENTITY_VERSION
      || value.profileId !== SYNTHETIC_PROTECTED_STATE_PROFILE || value.productionEligible !== false) {
    fail('KSTACK_SECRET_PROTECTED_IDENTITY_INVALID');
  }
  opaque(value.storeInstanceRef, 'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID');
  return frozen(clone(value));
}

function validateSortedUnique(values, selector, code) {
  for (let index = 1; index < values.length; index += 1) {
    if (compare(selector(values[index - 1]), selector(values[index])) >= 0) fail(code);
  }
}

function validateState(value, identity) {
  exact(value, STATE_KEYS, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  if (value.schemaVersion !== SYNTHETIC_PROTECTED_STATE_VERSION || value.storeInstanceRef !== identity.storeInstanceRef
      || !Array.isArray(value.authorityHeads) || !Array.isArray(value.auditHeads)
      || !Array.isArray(value.issuedUpdateIds)
      || !Array.isArray(value.retiredUpdateIds) || !Array.isArray(value.retiredWriterLeaseRefs)
      || value.authorityHeads.length > SYNTHETIC_PROTECTED_STATE_MAX_NAMESPACES
      || value.auditHeads.length > SYNTHETIC_PROTECTED_STATE_MAX_NAMESPACES
      || value.issuedUpdateIds.length > SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS
      || value.retiredUpdateIds.length > SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS
      || value.retiredWriterLeaseRefs.length > SYNTHETIC_PROTECTED_STATE_MAX_RETIRED_IDS) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  const authorityHeads = value.authorityHeads.map((entry) => validateAuthorityHeadValue(entry));
  const auditHeads = value.auditHeads.map((entry) => validateAuditHeadValue(entry));
  for (const id of [...value.issuedUpdateIds, ...value.retiredUpdateIds]) {
    try { validateSecretUpdateId(id); } catch { fail('KSTACK_SECRET_PROTECTED_STATE_INVALID'); }
  }
  for (const reference of value.retiredWriterLeaseRefs) opaque(reference, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(authorityHeads, (entry) => entry.authorityNamespaceRef, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(auditHeads, (entry) => entry.auditNamespaceRef, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(value.issuedUpdateIds, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(value.retiredUpdateIds, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  validateSortedUnique(value.retiredWriterLeaseRefs, (entry) => entry, 'KSTACK_SECRET_PROTECTED_STATE_INVALID');
  if (value.issuedUpdateIds.some((id) => value.retiredUpdateIds.includes(id))) fail('KSTACK_SECRET_PROTECTED_STATE_INVALID');
  const checked = frozen({ ...value, authorityHeads, auditHeads });
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
    if (error instanceof SyntheticProtectedStateError) throw error;
    if (error?.code === 'ENOENT') fail(unavailableCode);
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
    if (!plain(options) || Object.keys(options).some((key) => !ADVANCE_OPTION_KEYS.includes(key))) throw new Error();
    const hasCrashCut = Object.hasOwn(options, 'crashCut');
    const hasAcknowledgementCut = Object.hasOwn(options, 'acknowledgementCut');
    const crashCut = hasCrashCut ? options.crashCut : undefined;
    const acknowledgementCut = hasAcknowledgementCut ? options.acknowledgementCut : undefined;
    if ((hasCrashCut && !['BEFORE_COMMIT', 'AFTER_COMMIT'].includes(crashCut))
        || (hasAcknowledgementCut && acknowledgementCut !== 'AFTER_COMMIT')
        || (hasCrashCut && hasAcknowledgementCut)) throw new Error();
    return frozen({ ...(hasCrashCut ? { crashCut } : {}), ...(hasAcknowledgementCut ? { acknowledgementCut } : {}) });
  } catch { fail('KSTACK_SECRET_PROTECTED_ADVANCE_OPTIONS_INVALID'); }
}

function validateOpenOptions(options, code) {
  try {
    if (!plain(options) || !Object.hasOwn(options, 'root') || Object.keys(options).some((key) => !OPEN_KEYS.includes(key))) throw new Error();
    const root = options.root;
    const clock = Object.hasOwn(options, 'clock') ? options.clock : Date.now;
    if (typeof root !== 'string') throw new Error();
    return { root, clock };
  } catch { fail(code); }
}

function validateAuditWriterRequest(request) {
  let auditNamespaceRef;
  let ttlMs;
  try {
    if (!plain(request) || Object.keys(request).length !== AUDIT_WRITER_KEYS.length
        || AUDIT_WRITER_KEYS.some((key) => !Object.hasOwn(request, key))
        || Object.keys(request).some((key) => !AUDIT_WRITER_KEYS.includes(key))) throw new Error();
    auditNamespaceRef = request.auditNamespaceRef;
    ttlMs = request.ttlMs;
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
  try { return validateAuthorityHeadValue(value); }
  catch (error) {
    if (error instanceof SecretControlPlaneError) throw error;
    fail('KSTACK_SECRET_AUTHORITY_HEAD_INVALID');
  }
}

function checkedAuditHead(value) {
  try { return validateAuditHeadValue(value); }
  catch (error) {
    if (error instanceof SecretControlPlaneError) throw error;
    fail('KSTACK_SECRET_AUDIT_HEAD_INVALID');
  }
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
      if (error instanceof SyntheticProtectedStateError) throw error;
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
    if (openError instanceof StateFenceRequiredError) fail('KSTACK_SECRET_PROTECTED_STATE_LOCKED');
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
    if (actionError instanceof StateWriteUncertainError || actionError instanceof StateFenceRequiredError) throw actionError;
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
      if (error instanceof PossiblyCommittedError || error instanceof StateWriteUncertainError || error instanceof StateFenceRequiredError) {
        return frozen({ result: 'ACKNOWLEDGEMENT_UNKNOWN' });
      }
      throw error;
    }
  }

  #read(action) {
    try { return this.#withLock(action); }
    catch (error) {
      if (error instanceof PossiblyCommittedError) fail('KSTACK_SECRET_PROTECTED_STATE_LOCK_FENCED');
      if (error instanceof StateFenceRequiredError) fail('KSTACK_SECRET_PROTECTED_STATE_LOCKED');
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
    let code;
    try { code = error?.code; } catch {}
    if (SNAPSHOT_STATUS_ERROR_CODES.has(code)) fail(code);
    fail('KSTACK_SECRET_PROTECTED_ADAPTER_INVALID');
  }
  if (!plain(status) || Object.keys(status).length !== 3
      || status.profileId !== SYNTHETIC_PROTECTED_STATE_PROFILE
      || status.productionEligible !== false || status.state !== 'SYNTHETIC_READY') {
    fail('KSTACK_SECRET_PROTECTED_ADAPTER_INVALID');
  }
  return hostCanonicalBytes({
    schemaVersion: 'kstack-secret-protected-state-public-status-v1',
    profileId: SYNTHETIC_PROTECTED_STATE_PROFILE,
    productionEligible: false,
    state: 'SYNTHETIC_READY'
  });
}
