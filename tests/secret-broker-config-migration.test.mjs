import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { defaultConfig, validateConfig } from '../plugins/kstack/scripts/kstack-config.mjs';
import { hostCanonicalBytes } from '../plugins/kstack/scripts/kstack-host-contract.mjs';
import { parseKStackConfigDocument } from '../plugins/kstack/scripts/secret-broker/config-document-v2.mjs';
import {
  commitConfigV2Fence,
  migrateKStackConfigV1ToV2,
  restoreRetainedKStackConfigV1,
  withKStackConfigWriteLock
} from '../plugins/kstack/scripts/secret-broker/config-migration-v2.mjs';

function fixture(mutate = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-config-v2-migration-'));
  const configPath = path.join(directory, 'config.json');
  const journalPath = path.join(directory, 'migration-journal.json');
  const backupPath = path.join(directory, 'retained-v1.json');
  const fencePath = path.join(directory, 'config-v2-committed.json');
  const source = structuredClone(defaultConfig);
  source.project.name = 'Synthetic migration fixture';
  mutate(source);
  const sourceBytes = Buffer.from(`${JSON.stringify(source, null, 2)}\n`, 'utf8');
  fs.writeFileSync(configPath, sourceBytes, { mode: 0o600 });
  return { directory, configPath, journalPath, backupPath, fencePath, sourceBytes };
}

test('config migration durably retains exact v1 bytes and writes canonical disabled v2', () => {
  const state = fixture();
  const result = migrateKStackConfigV1ToV2(state);
  assert.equal(result.state, 'CONFIG_V2_READY');
  assert.equal(result.recovered, false);
  assert.deepEqual(fs.readFileSync(state.backupPath), state.sourceBytes);
  const current = fs.readFileSync(state.configPath);
  const parsed = parseKStackConfigDocument(current);
  assert.equal(parsed.schemaVersion, 2);
  assert.equal(parsed.secretBroker.enabled, false);
  assert.equal(parsed.secretBroker.desiredDevelopmentBackend, 'NONE');
  assert.equal(parsed.secretBroker.desiredProductionBackend, 'NONE');
  assert.equal(current.at(-1), 0x7d, 'canonical v2 has no presentation newline');
  assert.equal(fs.statSync(state.configPath).mode & 0o077, 0);
  assert.equal(fs.statSync(state.journalPath).mode & 0o077, 0);
  assert.equal(fs.statSync(state.backupPath).mode & 0o077, 0);
});

test('migration materializes exact v2 defaults for every valid sparse legacy shape', () => {
  const state = fixture((source) => { delete source.workflow.panel; });
  assert.equal(validateLegacy(state.sourceBytes), true);
  migrateKStackConfigV1ToV2(state);
  const migrated = parseKStackConfigDocument(fs.readFileSync(state.configPath));
  assert.deepEqual(migrated.workflow.panel, defaultConfig.workflow.panel);
});

function validateLegacy(bytes) {
  try {
    const value = parseKStackConfigDocument(bytes);
    return value.schemaVersion === 1 && validateConfig(value).length === 0;
  } catch { return false; }
}

test('crash cut before replacement is resumable and leaves active v1 exact', () => {
  const state = fixture();
  assert.throws(
    () => migrateKStackConfigV1ToV2({ ...state, crashCut: 'BEFORE_REPLACE' }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_CRASH_CUT_BEFORE_REPLACE'
  );
  assert.deepEqual(fs.readFileSync(state.configPath), state.sourceBytes);
  assert.deepEqual(fs.readFileSync(state.backupPath), state.sourceBytes);
  const resumed = migrateKStackConfigV1ToV2(state);
  assert.equal(resumed.state, 'CONFIG_V2_READY');
  assert.equal(resumed.recovered, false);
});

test('crash cut after replacement recovers by bound digest and idempotent read-back', () => {
  const state = fixture();
  assert.throws(
    () => migrateKStackConfigV1ToV2({ ...state, crashCut: 'AFTER_REPLACE' }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_CRASH_CUT_AFTER_REPLACE'
  );
  assert.equal(parseKStackConfigDocument(fs.readFileSync(state.configPath)).schemaVersion, 2);
  const resumed = migrateKStackConfigV1ToV2(state);
  assert.equal(resumed.state, 'CONFIG_V2_READY');
  assert.equal(resumed.recovered, true);
  assert.deepEqual(migrateKStackConfigV1ToV2(state), resumed);
});

test('every forward migration crash cut is resumable without losing the retained preimage', () => {
  for (const cut of [
    'AFTER_JOURNAL_CREATE', 'AFTER_BACKUP_CREATE', 'BEFORE_REPLACE',
    'AFTER_FORWARD_CANDIDATE_CREATE', 'AFTER_FORWARD_CLAIM', 'AFTER_FORWARD_INSTALL',
    'AFTER_REPLACE', 'AFTER_REPLACED_JOURNAL', 'AFTER_READ_BACK'
  ]) {
    const state = fixture();
    assert.throws(
      () => migrateKStackConfigV1ToV2({ ...state, crashCut: cut }),
      (error) => error?.code === `KSTACK_CONFIG_MIGRATION_CRASH_CUT_${cut}`
    );
    const resumed = migrateKStackConfigV1ToV2(state);
    assert.equal(resumed.state, 'CONFIG_V2_READY');
    assert.deepEqual(fs.readFileSync(state.backupPath), state.sourceBytes);
    assert.equal(fs.readdirSync(state.directory).some((name) => name.endsWith('.candidate') || name.endsWith('.claimed')), false);
  }
});

test('exact v1 restoration is allowed before the commit fence', () => {
  const state = fixture();
  migrateKStackConfigV1ToV2(state);
  const restored = restoreRetainedKStackConfigV1(state);
  assert.equal(restored.state, 'CONFIG_V1_RESTORED');
  assert.deepEqual(fs.readFileSync(state.configPath), state.sourceBytes);
  assert.throws(
    () => migrateKStackConfigV1ToV2(state),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_ALREADY_ROLLED_BACK'
  );
});

test('CONFIG_V2_COMMITTED is idempotent and permanently denies v1 restoration', () => {
  const state = fixture();
  migrateKStackConfigV1ToV2(state);
  const first = commitConfigV2Fence(state);
  const second = commitConfigV2Fence(state);
  assert.deepEqual(second, first);
  assert.equal(first.state, 'CONFIG_V2_COMMITTED');
  assert.throws(
    () => restoreRetainedKStackConfigV1(state),
    (error) => error?.code === 'KSTACK_CONFIG_V1_RESTORE_PERMANENTLY_DENIED'
  );
  assert.equal(parseKStackConfigDocument(fs.readFileSync(state.configPath)).schemaVersion, 2);

  const alternateFence = `${state.fencePath}.alternate`;
  assert.throws(
    () => restoreRetainedKStackConfigV1({ ...state, fencePath: alternateFence }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_JOURNAL_BINDING_MISMATCH'
  );
  fs.unlinkSync(state.fencePath);
  assert.throws(
    () => restoreRetainedKStackConfigV1(state),
    (error) => error?.code === 'KSTACK_CONFIG_V1_RESTORE_PERMANENTLY_DENIED'
  );
});

test('fence creation crash resumes to a committed journal before any effect', () => {
  const state = fixture();
  migrateKStackConfigV1ToV2(state);
  assert.throws(
    () => commitConfigV2Fence({ ...state, crashCut: 'AFTER_FENCE_CREATE' }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_CRASH_CUT_AFTER_FENCE_CREATE'
  );
  assert.throws(
    () => restoreRetainedKStackConfigV1(state),
    (error) => error?.code === 'KSTACK_CONFIG_V1_RESTORE_PERMANENTLY_DENIED'
  );
  assert.equal(commitConfigV2Fence(state).state, 'CONFIG_V2_COMMITTED');
});

test('every rollback crash cut resumes to exact retained v1 bytes', () => {
  for (const cut of [
    'AFTER_ROLLBACK_PREPARE', 'BEFORE_ROLLBACK_REPLACE',
    'AFTER_ROLLBACK_CANDIDATE_CREATE', 'AFTER_ROLLBACK_CLAIM', 'AFTER_ROLLBACK_INSTALL',
    'AFTER_ROLLBACK_REPLACE', 'AFTER_ROLLBACK_JOURNAL'
  ]) {
    const state = fixture();
    migrateKStackConfigV1ToV2(state);
    assert.throws(
      () => restoreRetainedKStackConfigV1({ ...state, crashCut: cut }),
      (error) => error?.code === `KSTACK_CONFIG_MIGRATION_CRASH_CUT_${cut}`
    );
    assert.equal(restoreRetainedKStackConfigV1(state).state, 'CONFIG_V1_RESTORED');
    assert.deepEqual(fs.readFileSync(state.configPath), state.sourceBytes);
  }
});

test('shared write lock serializes migration against another config writer', async () => {
  const state = fixture();
  await withKStackConfigWriteLock(state.configPath, async () => {
    assert.throws(
      () => migrateKStackConfigV1ToV2(state),
      (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_LOCKED'
    );
  });
  assert.equal(migrateKStackConfigV1ToV2({ configPath: state.configPath }).state, 'CONFIG_V2_READY');
});

test('a second stale-lock reclaimer cannot delete the lock observed by the first', () => {
  const state = fixture();
  const lockPath = `${state.configPath}.v2-migration.lock`;
  const reaperPath = `${lockPath}.reaper`;
  const stale = { schemaVersion: 'kstack-config-v2-migration-lock-v1', token: '00000000-0000-4000-8000-000000000001', pid: 2147483647, hostname: os.hostname() };
  const firstReclaimer = { ...stale, token: '00000000-0000-4000-8000-000000000002', pid: process.pid };
  fs.writeFileSync(lockPath, hostCanonicalBytes(stale), { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(reaperPath, hostCanonicalBytes(firstReclaimer), { mode: 0o600, flag: 'wx' });
  assert.throws(
    () => migrateKStackConfigV1ToV2(state),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_RECLAIM_LOCKED'
  );
  assert.deepEqual(fs.readFileSync(lockPath), hostCanonicalBytes(stale));
  fs.unlinkSync(reaperPath);
  assert.equal(migrateKStackConfigV1ToV2(state).state, 'CONFIG_V2_READY');
});

test('an abandoned reaper without a main lock fails closed before acquisition', () => {
  const state = fixture();
  const lockPath = `${state.configPath}.v2-migration.lock`;
  const reaperPath = `${lockPath}.reaper`;
  const abandoned = { schemaVersion: 'kstack-config-v2-migration-lock-v1', token: '00000000-0000-4000-8000-000000000003', pid: process.pid, hostname: os.hostname() };
  fs.writeFileSync(reaperPath, hostCanonicalBytes(abandoned), { mode: 0o600, flag: 'wx' });
  assert.throws(
    () => migrateKStackConfigV1ToV2(state),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_RECLAIM_LOCKED'
  );
  assert.equal(fs.existsSync(lockPath), false);
  assert.deepEqual(fs.readFileSync(state.configPath), state.sourceBytes);
});

test('portable path aliases and existing same-file artifact aliases are rejected', () => {
  const caseAlias = fixture();
  assert.throws(
    () => migrateKStackConfigV1ToV2({ ...caseAlias, backupPath: path.join(caseAlias.directory, 'CONFIG.JSON') }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_PATH_ALIAS'
  );
  assert.deepEqual(fs.readFileSync(caseAlias.configPath), caseAlias.sourceBytes);

  const hardLinkAlias = fixture();
  const linkedBackup = path.join(hardLinkAlias.directory, 'linked-retained-v1.json');
  fs.linkSync(hardLinkAlias.configPath, linkedBackup);
  assert.throws(
    () => migrateKStackConfigV1ToV2({ ...hardLinkAlias, backupPath: linkedBackup }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_PATH_ALIAS'
  );
  assert.deepEqual(fs.readFileSync(hardLinkAlias.configPath), hardLinkAlias.sourceBytes);
});

test('exclusive replacement never overwrites a writer that occupies the claimed config path', () => {
  const state = fixture();
  assert.throws(
    () => migrateKStackConfigV1ToV2({ ...state, crashCut: 'AFTER_FORWARD_CLAIM' }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_CRASH_CUT_AFTER_FORWARD_CLAIM'
  );
  assert.equal(fs.existsSync(state.configPath), false);
  const external = JSON.parse(state.sourceBytes);
  external.project.name = 'External writer won the path';
  const externalBytes = Buffer.from(`${JSON.stringify(external, null, 2)}\n`, 'utf8');
  fs.writeFileSync(state.configPath, externalBytes, { mode: 0o600, flag: 'wx' });
  assert.throws(() => migrateKStackConfigV1ToV2(state));
  assert.deepEqual(fs.readFileSync(state.configPath), externalBytes);
});

test('migration rejects unbound retained data and post-replacement drift', () => {
  const unbound = fixture();
  fs.writeFileSync(unbound.backupPath, unbound.sourceBytes, { mode: 0o600 });
  assert.throws(
    () => migrateKStackConfigV1ToV2(unbound),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_UNBOUND_BACKUP'
  );

  const drifted = fixture();
  migrateKStackConfigV1ToV2(drifted);
  const current = fs.readFileSync(drifted.configPath);
  fs.writeFileSync(drifted.configPath, Buffer.concat([current.subarray(0, -1), Buffer.from(' '), current.subarray(-1)]), { mode: 0o600 });
  assert.throws(() => migrateKStackConfigV1ToV2(drifted));

  const concurrent = fixture();
  assert.throws(
    () => migrateKStackConfigV1ToV2({ ...concurrent, crashCut: 'AFTER_BACKUP_CREATE' }),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_CRASH_CUT_AFTER_BACKUP_CREATE'
  );
  const changed = JSON.parse(concurrent.sourceBytes);
  changed.project.name = 'Concurrent replacement';
  fs.writeFileSync(concurrent.configPath, `${JSON.stringify(changed, null, 2)}\n`, { mode: 0o600 });
  assert.throws(
    () => migrateKStackConfigV1ToV2(concurrent),
    (error) => error?.code === 'KSTACK_CONFIG_MIGRATION_JOURNAL_DRIFT'
  );
  assert.equal(JSON.parse(fs.readFileSync(concurrent.configPath)).project.name, 'Concurrent replacement');
});
