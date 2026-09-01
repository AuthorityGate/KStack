import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import {
  SecretControlPlaneError,
  auditOrigin,
  auditSuccessor,
  authorityHeadDigest,
  authorityOrigin,
  authoritySuccessor,
  canonicalAuditHeadBytes,
  canonicalAuthorityHeadBytes,
  parseAuditHead,
  parseAuthorityHead,
  reconcileAuditAdvance,
  reconcileAuthorityAdvance,
  validateAuditHeadValue,
  validateAuthorityHeadValue
} from '../plugins/kstack/scripts/secret-broker/control-plane-v1.mjs';
import {
  SyntheticProtectedStateAdapter,
  syntheticProtectedStateSnapshotBytes
} from '../plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs';

const REF_A = 'ksr1_AAAAAAAAAAAAAAAAAAAAAA';
const REF_B = 'ksr1_AQEBAQEBAQEBAQEBAQEBAQ';
const REF_C = 'ksr1_AgICAgICAgICAgICAgICAg';
const UPDATE_1 = `ksu1_${Buffer.alloc(32, 1).toString('base64url')}`;
const UPDATE_2 = `ksu1_${Buffer.alloc(32, 2).toString('base64url')}`;
const UPDATE_4 = `ksu1_${Buffer.alloc(32, 4).toString('base64url')}`;
const EVENT_A = `sha256:${'a'.repeat(64)}`;
const EVENT_B = `sha256:${'b'.repeat(64)}`;

function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-secret-protected-state-'));
  const root = path.join(parent, 'external-state');
  let now = Date.parse('2026-09-01T00:00:00.000Z');
  const clock = () => now;
  const adapter = SyntheticProtectedStateAdapter.create({ root, clock });
  return { parent, root, clock, adapter, advance(ms) { now += ms; } };
}

function expiredFixture() {
  const state = fixture();
  const authorityHead = state.adapter.initializeAuthority(REF_A).head;
  const auditHead = state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 1 }).head;
  const authorityUpdateId = issue(state.adapter);
  const auditUpdateId = issue(state.adapter);
  state.advance(2);
  return { ...state, authorityHead, auditHead, authorityUpdateId, auditUpdateId };
}

function throwingProperty(value, key, text = 'CALLER_RAW_TEXT') {
  Object.defineProperty(value, key, { enumerable: true, get() { throw new Error(text); } });
  return value;
}

function throwingControlPlaneProperty(value, key, text = 'CALLER_CONTROL_PLANE_TEXT') {
  Object.defineProperty(value, key, {
    enumerable: true,
    get() { throw new SecretControlPlaneError(text); }
  });
  return value;
}

function issue(adapter) {
  const issued = adapter.issueUpdateId();
  assert.equal(issued.result, 'ISSUED');
  assert.match(issued.updateId, /^ksu1_[A-Za-z0-9_-]{43}$/u);
  return issued.updateId;
}

function installRetirementFault(name, root) {
  const originals = {
    openSync: fs.openSync,
    writeFileSync: fs.writeFileSync,
    fsyncSync: fs.fsyncSync,
    closeSync: fs.closeSync,
    renameSync: fs.renameSync
  };
  let temporaryDescriptor;
  let injected = false;
  fs.openSync = (target, ...args) => {
    const retirementTemporary = typeof target === 'string'
      && path.dirname(target) === root && path.basename(target).startsWith('.state.');
    if (!injected && name === 'temporary-open' && retirementTemporary) {
      injected = true;
      const error = new Error('injected-retirement-open-failure'); error.code = 'EIO'; throw error;
    }
    const descriptor = originals.openSync(target, ...args);
    if (retirementTemporary) temporaryDescriptor = descriptor;
    return descriptor;
  };
  fs.writeFileSync = (target, ...args) => {
    if (!injected && name === 'temporary-write' && target === temporaryDescriptor) {
      injected = true;
      const error = new Error('injected-retirement-write-failure'); error.code = 'EIO'; throw error;
    }
    return originals.writeFileSync(target, ...args);
  };
  fs.fsyncSync = (target, ...args) => {
    if (!injected && name === 'temporary-fsync' && target === temporaryDescriptor) {
      injected = true;
      const error = new Error('injected-retirement-fsync-failure'); error.code = 'EIO'; throw error;
    }
    return originals.fsyncSync(target, ...args);
  };
  fs.closeSync = (target, ...args) => {
    if (!injected && name === 'temporary-close' && target === temporaryDescriptor) {
      injected = true;
      const error = new Error('injected-retirement-close-failure'); error.code = 'EIO'; throw error;
    }
    return originals.closeSync(target, ...args);
  };
  fs.renameSync = (source, ...args) => {
    if (!injected && name === 'pre-rename' && typeof source === 'string'
        && path.dirname(source) === root && path.basename(source).startsWith('.state.')) {
      injected = true;
      const error = new Error('injected-retirement-rename-failure'); error.code = 'EIO'; throw error;
    }
    return originals.renameSync(source, ...args);
  };
  return {
    restore() { Object.assign(fs, originals); },
    wasInjected() { return injected; }
  };
}

function assertPublicSurfacesFenced(state, authorityHead, auditHead) {
  const actions = [
    () => SyntheticProtectedStateAdapter.open({ root: state.root, clock: state.clock }),
    () => state.adapter.status(),
    () => syntheticProtectedStateSnapshotBytes(state.adapter),
    () => state.adapter.readAuthorityHead(authorityHead.authorityNamespaceRef),
    () => state.adapter.verifyAuthoritySnapshot(authorityHead),
    () => state.adapter.readAuditHead(auditHead.auditNamespaceRef),
    () => state.adapter.verifyAuditSnapshot(auditHead),
    () => state.adapter.issueUpdateId(),
    () => state.adapter.acquireAuditWriter({ auditNamespaceRef: auditHead.auditNamespaceRef, ttlMs: 1_000 })
  ];
  for (const action of actions) {
    assert.throws(action, (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED');
  }
}

test('authority and audit head codecs are closed, canonical, and exact', () => {
  const authority = authorityOrigin(REF_A);
  assert.deepEqual(parseAuthorityHead(canonicalAuthorityHeadBytes(authority)), authority);
  assert.throws(() => parseAuthorityHead(Buffer.from(`${canonicalAuthorityHeadBytes(authority)}\n`)));
  assert.throws(() => canonicalAuthorityHeadBytes({ ...authority, unexpected: true }));
  assert.throws(() => authoritySuccessor(authority, 'not-an-update-id'));
  assert.throws(
    () => canonicalAuthorityHeadBytes({ ...authority, priorAuthorityDigest: EVENT_A }),
    (error) => error?.code === 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID'
  );

  const audit = auditOrigin(REF_B, 1, REF_C, '2026-09-01T00:00:30.000Z');
  assert.deepEqual(parseAuditHead(canonicalAuditHeadBytes(audit)), audit);
  assert.throws(() => canonicalAuditHeadBytes({ ...audit, ordinal: -1 }));
  assert.throws(
    () => auditSuccessor(audit, 'sha256:not-a-digest', UPDATE_1),
    (error) => error?.code === 'KSTACK_SECRET_AUDIT_EVENT_DIGEST_INVALID'
  );

  for (const hostile of [throwingProperty, throwingControlPlaneProperty]) {
    for (const action of [
      () => validateAuthorityHeadValue(hostile({ ...authority }, 'schemaVersion')),
      () => canonicalAuthorityHeadBytes(hostile({ ...authority }, 'schemaVersion')),
      () => authorityHeadDigest(hostile({ ...authority }, 'schemaVersion')),
      () => authoritySuccessor(hostile({ ...authority }, 'schemaVersion'), UPDATE_1),
      () => reconcileAuthorityAdvance(hostile({ ...authority }, 'schemaVersion'), UPDATE_1, authority),
      () => reconcileAuthorityAdvance(authority, UPDATE_1, hostile({ ...authority }, 'schemaVersion'))
    ]) {
      assert.throws(action, (error) => error?.code === 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID' && error.message === error.code);
    }
    for (const action of [
      () => validateAuditHeadValue(hostile({ ...audit }, 'schemaVersion')),
      () => canonicalAuditHeadBytes(hostile({ ...audit }, 'schemaVersion')),
      () => auditSuccessor(hostile({ ...audit }, 'schemaVersion'), EVENT_A, UPDATE_1),
      () => reconcileAuditAdvance(hostile({ ...audit }, 'schemaVersion'), EVENT_A, UPDATE_1, audit),
      () => reconcileAuditAdvance(audit, EVENT_A, UPDATE_1, hostile({ ...audit }, 'schemaVersion'))
    ]) {
      assert.throws(action, (error) => error?.code === 'KSTACK_SECRET_AUDIT_HEAD_INVALID' && error.message === error.code);
    }
  }

  for (const thrown of [new Error('CALLER_PARSE_TEXT'), new SecretControlPlaneError('CALLER_PARSE_CONTROL_TEXT')]) {
    const hostileInput = new Proxy({}, { getPrototypeOf() { throw thrown; } });
    assert.throws(
      () => parseAuthorityHead(hostileInput),
      (error) => error?.code === 'KSTACK_SECRET_AUTHORITY_HEAD_ENCODING_INVALID' && error.message === error.code
    );
    assert.throws(
      () => parseAuditHead(hostileInput),
      (error) => error?.code === 'KSTACK_SECRET_AUDIT_HEAD_ENCODING_INVALID' && error.message === error.code
    );
  }
});

test('authority epoch is monotonic, CAS-bound, acknowledgement-safe, and restart durable', () => {
  const state = fixture();
  const initialized = state.adapter.initializeAuthority(REF_A);
  assert.equal(initialized.result, 'INITIALIZED');
  const origin = initialized.head;
  assert.equal(origin.authorityEpoch, 1);
  assert.equal(state.adapter.verifyAuthoritySnapshot(origin), 'READY');

  const update1 = issue(state.adapter);
  const first = state.adapter.compareAndAdvanceAuthority(origin, update1);
  assert.equal(first.result, 'ADVANCED');
  assert.equal(first.head.authorityEpoch, 2);
  const mismatchedId = issue(state.adapter);
  assert.equal(state.adapter.compareAndAdvanceAuthority(origin, mismatchedId).result, 'EXPECTATION_MISMATCH');
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(first.head, mismatchedId),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_UPDATE_ID_REUSED'
  );

  const unknownId = issue(state.adapter);
  const unknown = state.adapter.compareAndAdvanceAuthority(first.head, unknownId, { acknowledgementCut: 'AFTER_COMMIT' });
  assert.equal(unknown.result, 'ACKNOWLEDGEMENT_UNKNOWN');
  const afterUnknown = state.adapter.readAuthorityHead(REF_A);
  assert.equal(reconcileAuthorityAdvance(first.head, unknownId, afterUnknown), 'COMMITTED');

  const beforeCrashId = issue(state.adapter);
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(afterUnknown, beforeCrashId, { crashCut: 'BEFORE_COMMIT' }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_CRASH_BEFORE_COMMIT'
  );
  assert.equal(reconcileAuthorityAdvance(afterUnknown, beforeCrashId, state.adapter.readAuthorityHead(REF_A)), 'UNCOMMITTED');
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(afterUnknown, beforeCrashId),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_UPDATE_ID_REUSED'
  );

  const afterCrashId = issue(state.adapter);
  assert.equal(state.adapter.compareAndAdvanceAuthority(afterUnknown, afterCrashId, { crashCut: 'AFTER_COMMIT' }).result, 'ACKNOWLEDGEMENT_UNKNOWN');
  const afterCrash = state.adapter.readAuthorityHead(REF_A);
  assert.equal(reconcileAuthorityAdvance(afterUnknown, afterCrashId, afterCrash), 'COMMITTED');
  assert.equal(reconcileAuthorityAdvance(origin, UPDATE_4, afterCrash), 'UNCERTAIN');
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(afterCrash, update1),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_UPDATE_ID_REUSED'
  );

  const reopened = SyntheticProtectedStateAdapter.open({ root: state.root, clock: state.clock });
  assert.deepEqual(reopened.readAuthorityHead(REF_A), afterCrash);
  assert.equal(reopened.status().productionEligible, false);
});

test('restored or forked broker snapshots have no authority against the external epoch', () => {
  const state = fixture();
  const snapshot = state.adapter.initializeAuthority(REF_A).head;
  assert.throws(
    () => state.adapter.initializeAuthority(REF_B),
    (error) => error?.code === 'KSTACK_SECRET_AUTHORITY_ALREADY_INITIALIZED'
  );
  const updateId = issue(state.adapter);
  const advanced = state.adapter.compareAndAdvanceAuthority(snapshot, updateId).head;
  assert.equal(state.adapter.verifyAuthoritySnapshot(snapshot), 'EPOCH_MISMATCH');
  assert.equal(state.adapter.verifyAuthoritySnapshot(advanced), 'READY');

  const fork = authoritySuccessor(snapshot, UPDATE_2);
  assert.equal(state.adapter.verifyAuthoritySnapshot(fork), 'EPOCH_MISMATCH');
  const reopened = SyntheticProtectedStateAdapter.open({ root: state.root, clock: state.clock });
  assert.equal(reopened.verifyAuthoritySnapshot(snapshot), 'EPOCH_MISMATCH');
});

test('external audit head grants one writer and advances exactly once', () => {
  const state = fixture();
  const authorityHead = state.adapter.initializeAuthority(REF_A).head;
  const acquired = state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 30_000 });
  assert.equal(acquired.result, 'ACQUIRED');
  assert.equal(acquired.head.ordinal, 0);
  assert.equal(state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 30_000 }).result, 'WRITER_UNAVAILABLE');
  assert.throws(
    () => state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_A, ttlMs: 30_000 }),
    (error) => error?.code === 'KSTACK_SECRET_AUDIT_NAMESPACE_MISMATCH'
  );

  const firstId = issue(state.adapter);
  const first = state.adapter.compareAndAdvanceAudit(acquired.head, EVENT_A, firstId);
  assert.equal(first.result, 'ADVANCED');
  assert.equal(first.head.ordinal, 1);
  const mismatchId = issue(state.adapter);
  assert.equal(state.adapter.compareAndAdvanceAudit(acquired.head, EVENT_B, mismatchId).result, 'EXPECTATION_MISMATCH');

  const unknownId = issue(state.adapter);
  const unknown = state.adapter.compareAndAdvanceAudit(first.head, EVENT_B, unknownId, { acknowledgementCut: 'AFTER_COMMIT' });
  assert.equal(unknown.result, 'ACKNOWLEDGEMENT_UNKNOWN');
  const afterUnknown = state.adapter.readAuditHead(REF_B);
  assert.equal(reconcileAuditAdvance(first.head, EVENT_B, unknownId, afterUnknown), 'COMMITTED');
  assert.equal(state.adapter.verifyAuditSnapshot(first.head), 'HEAD_MISMATCH');
  assert.equal(state.adapter.verifyAuditSnapshot(afterUnknown), 'READY');

  const expiredId = issue(state.adapter);
  state.advance(30_001);
  assert.equal(state.adapter.compareAndAdvanceAudit(afterUnknown, EVENT_A, expiredId).result, 'ACKNOWLEDGEMENT_UNKNOWN');
  assertPublicSurfacesFenced(state, authorityHead, afterUnknown);
});

test('audit writer expiry fences every first entry path before reads, mismatch, issuance, or authority work', () => {
  const surfaces = [
    ['open', (state) => SyntheticProtectedStateAdapter.open({ root: state.root, clock: state.clock }), 'throws'],
    ['status', (state) => state.adapter.status(), 'throws'],
    ['public-status', (state) => syntheticProtectedStateSnapshotBytes(state.adapter), 'throws'],
    ['authority-read', (state) => state.adapter.readAuthorityHead(REF_A), 'throws'],
    ['authority-snapshot', (state) => state.adapter.verifyAuthoritySnapshot(state.authorityHead), 'throws'],
    ['audit-read', (state) => state.adapter.readAuditHead(REF_B), 'throws'],
    ['audit-snapshot', (state) => state.adapter.verifyAuditSnapshot(state.auditHead), 'throws'],
    ['issue-update', (state) => state.adapter.issueUpdateId(), 'acknowledgement'],
    ['authority-advance', (state) => state.adapter.compareAndAdvanceAuthority(state.authorityHead, state.authorityUpdateId), 'acknowledgement'],
    ['writer-reacquire', (state) => state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 1_000 }), 'acknowledgement'],
    ['audit-advance', (state) => state.adapter.compareAndAdvanceAudit(state.auditHead, EVENT_A, state.auditUpdateId), 'acknowledgement'],
    ['audit-mismatch', (state) => state.adapter.compareAndAdvanceAudit({ ...state.auditHead, writerLeaseRef: REF_C }, EVENT_A, state.auditUpdateId), 'acknowledgement']
  ];
  for (const [name, action, outcome] of surfaces) {
    const state = expiredFixture();
    if (outcome === 'throws') {
      assert.throws(() => action(state), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED', name);
    } else {
      assert.deepEqual(action(state), { result: 'ACKNOWLEDGEMENT_UNKNOWN' }, name);
    }
    assertPublicSurfacesFenced(state, state.authorityHead, state.auditHead);
  }
});

test('audit crash cuts reconcile without retrying an uncertain CAS', () => {
  const state = fixture();
  const origin = state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 60_000 }).head;
  const beforeId = issue(state.adapter);
  assert.throws(
    () => state.adapter.compareAndAdvanceAudit(origin, EVENT_A, beforeId, { crashCut: 'BEFORE_COMMIT' }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_CRASH_BEFORE_COMMIT'
  );
  assert.equal(reconcileAuditAdvance(origin, EVENT_A, beforeId, state.adapter.readAuditHead(REF_B)), 'UNCOMMITTED');
  const afterId = issue(state.adapter);
  assert.equal(state.adapter.compareAndAdvanceAudit(origin, EVENT_A, afterId, { crashCut: 'AFTER_COMMIT' }).result, 'ACKNOWLEDGEMENT_UNKNOWN');
  const committed = state.adapter.readAuditHead(REF_B);
  assert.equal(reconcileAuditAdvance(origin, EVENT_A, afterId, committed), 'COMMITTED');
  assert.equal(reconcileAuditAdvance(origin, EVENT_B, UPDATE_2, committed), 'UNCERTAIN');
});

test('state loss, identity drift, lock residue, and production promotion fail closed', () => {
  const lost = fixture();
  fs.unlinkSync(path.join(lost.root, 'state-v1.json'));
  assert.throws(
    () => SyntheticProtectedStateAdapter.open({ root: lost.root, clock: lost.clock }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOST'
  );

  const drift = fixture();
  const identityPath = path.join(drift.root, 'identity-v1.json');
  const identity = JSON.parse(fs.readFileSync(identityPath));
  identity.storeInstanceRef = REF_A;
  fs.writeFileSync(identityPath, hostCanonicalBytes(identity), { mode: 0o600 });
  assert.throws(() => drift.adapter.status(), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_IDENTITY_DRIFT');

  const locked = fixture();
  const lockedHead = locked.adapter.initializeAuthority(REF_A).head;
  fs.writeFileSync(path.join(locked.root, 'state-v1.lock'), hostCanonicalBytes({ schemaVersion: 'kstack-secret-protected-state-lock-v1', token: '00000000-0000-4000-8000-000000000001', pid: process.pid }), { mode: 0o600, flag: 'wx' });
  assert.throws(
    () => locked.adapter.initializeAuthority(REF_A),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED'
  );
  assert.throws(() => locked.adapter.status(), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED');
  assert.throws(() => locked.adapter.readAuthorityHead(REF_A), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED');
  assert.throws(() => locked.adapter.verifyAuthoritySnapshot(lockedHead), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED');
  assert.throws(() => syntheticProtectedStateSnapshotBytes(locked.adapter), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED');
  assert.throws(() => SyntheticProtectedStateAdapter.open({ root: locked.root, clock: locked.clock }), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED');
  for (const forbidden of ['set', 'delete', 'truncate', 'import', 'readValue', 'exportValue']) {
    assert.equal(typeof locked.adapter[forbidden], 'undefined');
  }
});

test('prospective requests are closed and validated before update-ID consumption', () => {
  const state = fixture();
  const origin = state.adapter.initializeAuthority(REF_A).head;
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(origin, UPDATE_1),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_UPDATE_ID_NOT_ISSUED'
  );
  const updateId = issue(state.adapter);
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(origin, updateId, { crashCut: 'INVALID' }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_ADVANCE_OPTIONS_INVALID'
  );
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(origin, updateId, { acknowledgementCut: 'AFTER_COMMIT', extra: true }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_ADVANCE_OPTIONS_INVALID'
  );
  assert.equal(state.adapter.compareAndAdvanceAuthority(origin, updateId).result, 'ADVANCED');
  assert.throws(
    () => state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 1_000, auditEpoch: 9 }),
    (error) => error?.code === 'KSTACK_SECRET_AUDIT_WRITER_REQUEST_INVALID'
  );
  assert.throws(
    () => SyntheticProtectedStateAdapter.open({ root: state.root, clock: state.clock, extra: true }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_OPEN_OPTIONS_INVALID'
  );
  assert.throws(
    () => SyntheticProtectedStateAdapter.create({ root: {} }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_CREATE_OPTIONS_INVALID'
  );
  assert.throws(
    () => SyntheticProtectedStateAdapter.open({ root: {} }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_OPEN_OPTIONS_INVALID'
  );
  assert.throws(
    () => SyntheticProtectedStateAdapter.create(throwingProperty({ clock: state.clock }, 'root')),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_CREATE_OPTIONS_INVALID' && error.message === error.code
  );
  assert.throws(
    () => SyntheticProtectedStateAdapter.open(throwingProperty({ root: state.root }, 'clock')),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_OPEN_OPTIONS_INVALID' && error.message === error.code
  );
  assert.throws(
    () => state.adapter.acquireAuditWriter(throwingProperty({ ttlMs: 1_000 }, 'auditNamespaceRef')),
    (error) => error?.code === 'KSTACK_SECRET_AUDIT_WRITER_REQUEST_INVALID' && error.message === error.code
  );
  assert.throws(
    () => SyntheticProtectedStateAdapter.create({ root: path.join(state.parent, 'throwing-clock'), clock() { throw new Error('raw-clock-text'); } }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_CLOCK_INVALID' && error.message === error.code
  );

  let clockCalls = 0;
  const runtimeClockAdapter = SyntheticProtectedStateAdapter.create({
    root: path.join(state.parent, 'runtime-clock'),
    clock() {
      clockCalls += 1;
      if (clockCalls > 1) throw new Error('runtime-clock-text');
      return Date.parse('2026-09-01T00:00:00.000Z');
    }
  });
  assert.throws(
    () => runtimeClockAdapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 1_000 }),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_CLOCK_INVALID' && error.message === error.code
  );

  const maximumCanonicalClock = Date.parse('9999-12-31T23:59:59.999Z');
  for (const [name, laterClock] of [
    ['maximum-clock', maximumCanonicalClock],
    ['timeclip-clock', 8_640_000_000_000_000 - 1]
  ]) {
    let clockCalls = 0;
    const adapter = SyntheticProtectedStateAdapter.create({
      root: path.join(state.parent, name),
      clock() {
        clockCalls += 1;
        return clockCalls === 1 ? 0 : laterClock;
      }
    });
    assert.throws(
      () => adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 1 }),
      (error) => error?.code === 'KSTACK_SECRET_PROTECTED_CLOCK_INVALID' && error.message === error.code,
      name
    );
  }

  let equalityClockCalls = 0;
  const equalityClockAdapter = SyntheticProtectedStateAdapter.create({
    root: path.join(state.parent, 'canonical-clock-equality'),
    clock() {
      equalityClockCalls += 1;
      return equalityClockCalls === 1 ? 0 : maximumCanonicalClock - 1;
    }
  });
  assert.equal(
    equalityClockAdapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 1 }).head.writerLeaseDeadline,
    '9999-12-31T23:59:59.999Z'
  );

  const accessorUpdateId = issue(state.adapter);
  const currentAuthorityHead = state.adapter.readAuthorityHead(REF_A);
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(currentAuthorityHead, accessorUpdateId, throwingProperty({}, 'crashCut')),
    (error) => error?.code === 'KSTACK_SECRET_PROTECTED_ADVANCE_OPTIONS_INVALID' && error.message === error.code
  );
  assert.throws(
    () => state.adapter.compareAndAdvanceAuthority(throwingProperty({ ...origin }, 'schemaVersion'), accessorUpdateId),
    (error) => error?.code === 'KSTACK_SECRET_AUTHORITY_HEAD_INVALID' && error.message === error.code
  );
  assert.equal(state.adapter.compareAndAdvanceAuthority(currentAuthorityHead, accessorUpdateId).result, 'ADVANCED');

  const closeState = fixture();
  const originalOpenSync = fs.openSync;
  const originalCloseSync = fs.closeSync;
  let identityDescriptor;
  let closeInjected = false;
  fs.openSync = (target, ...args) => {
    const descriptor = originalOpenSync(target, ...args);
    if (target === path.join(closeState.root, 'identity-v1.json')) identityDescriptor = descriptor;
    return descriptor;
  };
  fs.closeSync = (target, ...args) => {
    if (!closeInjected && target === identityDescriptor) {
      closeInjected = true;
      throw new Error('raw-close-text');
    }
    return originalCloseSync(target, ...args);
  };
  try {
    assert.throws(
      () => closeState.adapter.status(),
      (error) => error?.code === 'KSTACK_SECRET_PROTECTED_IDENTITY_INVALID' && error.message === error.code
    );
  } finally {
    fs.openSync = originalOpenSync;
    fs.closeSync = originalCloseSync;
  }
  assert.equal(closeInjected, true);
});

test('a filesystem error after atomic replacement is acknowledgement-unknown and read-only reconcilable', () => {
  const state = fixture();
  const origin = state.adapter.initializeAuthority(REF_A).head;
  const updateId = issue(state.adapter);
  const originalChmodSync = fs.chmodSync;
  let replacements = 0;
  fs.chmodSync = (...args) => {
    replacements += 1;
    if (replacements === 2) throw new Error('synthetic-post-rename-failure');
    return originalChmodSync(...args);
  };
  let result;
  try {
    result = state.adapter.compareAndAdvanceAuthority(origin, updateId);
  } finally {
    fs.chmodSync = originalChmodSync;
  }
  assert.equal(result.result, 'ACKNOWLEDGEMENT_UNKNOWN');
  assert.equal(reconcileAuthorityAdvance(origin, updateId, state.adapter.readAuthorityHead(REF_A)), 'COMMITTED');
});

test('every authority and audit retirement persistence boundary retains a store-wide fence', () => {
  for (const target of ['authority', 'audit']) {
    for (const faultName of ['temporary-open', 'temporary-write', 'temporary-fsync', 'temporary-close', 'pre-rename']) {
      const state = fixture();
      const authorityHead = state.adapter.initializeAuthority(REF_A).head;
      const auditHead = state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 60_000 }).head;
      const updateId = issue(state.adapter);
      const fault = installRetirementFault(faultName, state.root);
      let result;
      try {
        result = target === 'authority'
          ? state.adapter.compareAndAdvanceAuthority(authorityHead, updateId)
          : state.adapter.compareAndAdvanceAudit(auditHead, EVENT_A, updateId);
      } finally { fault.restore(); }
      assert.equal(fault.wasInjected(), true, `${target}:${faultName}`);
      assert.equal(result.result, 'ACKNOWLEDGEMENT_UNKNOWN', `${target}:${faultName}`);
      assertPublicSurfacesFenced(state, authorityHead, auditHead);
      const retry = target === 'authority'
        ? () => state.adapter.compareAndAdvanceAuthority(authorityHead, updateId)
        : () => state.adapter.compareAndAdvanceAudit(auditHead, EVENT_A, updateId);
      assert.throws(retry, (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED', `${target}:${faultName}`);
    }
  }
});

test('every public read, status, open, and snapshot surface fails closed on competing lock acquisition', () => {
  const surfaces = [
    ['open', (state) => SyntheticProtectedStateAdapter.open({ root: state.root, clock: state.clock })],
    ['status', (state) => state.adapter.status()],
    ['public-status', (state) => syntheticProtectedStateSnapshotBytes(state.adapter)],
    ['authority-read', (state, authorityHead) => state.adapter.readAuthorityHead(authorityHead.authorityNamespaceRef)],
    ['authority-snapshot', (state, authorityHead) => state.adapter.verifyAuthoritySnapshot(authorityHead)],
    ['audit-read', (state, authorityHead, auditHead) => state.adapter.readAuditHead(auditHead.auditNamespaceRef)],
    ['audit-snapshot', (state, authorityHead, auditHead) => state.adapter.verifyAuditSnapshot(auditHead)]
  ];
  for (const [name, action] of surfaces) {
    const state = fixture();
    const authorityHead = state.adapter.initializeAuthority(REF_A).head;
    const auditHead = state.adapter.acquireAuditWriter({ auditNamespaceRef: REF_B, ttlMs: 60_000 }).head;
    const lockPath = path.join(state.root, 'state-v1.lock');
    const originalOpenSync = fs.openSync;
    let injected = false;
    fs.openSync = (target, flags, mode) => {
      if (!injected && target === lockPath) {
        injected = true;
        const descriptor = originalOpenSync(target, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
        fs.writeFileSync(descriptor, hostCanonicalBytes({ schemaVersion: 'kstack-secret-protected-state-lock-v1', token: '00000000-0000-4000-8000-000000000002', pid: process.pid }));
        fs.fsyncSync(descriptor);
        fs.closeSync(descriptor);
      }
      return originalOpenSync(target, flags, mode);
    };
    try {
      assert.throws(() => action(state, authorityHead, auditHead), (error) => error?.code === 'KSTACK_SECRET_PROTECTED_STATE_LOCKED', name);
    } finally { fs.openSync = originalOpenSync; }
    assert.equal(injected, true, name);
  }
});
