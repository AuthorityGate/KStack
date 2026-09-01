import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { hostCanonicalBytes, parseHostCanonicalJson } from '../kstack-host-contract.mjs';
import { defaultConfig, validateConfig } from '../kstack-config.mjs';
import { canonicalKStackConfigV2Bytes, parseKStackConfigDocument } from './config-document-v2.mjs';
import { DEFAULT_SECRET_BROKER_CONFIG } from './config-v2.mjs';

export const CONFIG_MIGRATION_JOURNAL_VERSION = 'kstack-config-v2-migration-journal-v1';
export const CONFIG_V2_COMMITTED_FENCE_VERSION = 'kstack-config-v2-committed-fence-v1';
const MIGRATION_LOCK_VERSION = 'kstack-config-v2-migration-lock-v1';
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const PHASES = new Set([
  'PREPARED', 'REPLACED', 'READ_BACK_VERIFIED', 'ROLLBACK_PREPARED',
  'ROLLED_BACK', 'COMMITTED'
]);
const CRASH_CUTS = new Set([
  'AFTER_JOURNAL_CREATE', 'AFTER_BACKUP_CREATE', 'BEFORE_REPLACE',
  'AFTER_FORWARD_CANDIDATE_CREATE', 'AFTER_FORWARD_CLAIM', 'AFTER_FORWARD_INSTALL',
  'AFTER_REPLACE', 'AFTER_REPLACED_JOURNAL', 'AFTER_READ_BACK',
  'AFTER_FENCE_CREATE', 'AFTER_ROLLBACK_PREPARE',
  'AFTER_ROLLBACK_CANDIDATE_CREATE', 'AFTER_ROLLBACK_CLAIM', 'AFTER_ROLLBACK_INSTALL',
  'BEFORE_ROLLBACK_REPLACE', 'AFTER_ROLLBACK_REPLACE',
  'AFTER_ROLLBACK_JOURNAL'
]);

export class KStackConfigMigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'KStackConfigMigrationError';
    this.code = code;
  }
}

function fail(code) { throw new KStackConfigMigrationError(code); }
function digest(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(code);
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size
    && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

function assertRegular(file, maximum = 65_536) {
  let linked;
  try { linked = fs.lstatSync(file); } catch { fail('KSTACK_CONFIG_MIGRATION_FILE_UNAVAILABLE'); }
  if (!linked.isFile() || linked.isSymbolicLink() || linked.size < 2 || linked.size > maximum) fail('KSTACK_CONFIG_MIGRATION_FILE_INVALID');
  return linked;
}

function readRegularSnapshot(file, maximum = 65_536) {
  const linkedBefore = assertRegular(file, maximum);
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const openedBefore = fs.fstatSync(descriptor);
    if (!openedBefore.isFile() || !sameIdentity(linkedBefore, openedBefore)) fail('KSTACK_CONFIG_MIGRATION_FILE_CHANGED');
    const bytes = fs.readFileSync(descriptor);
    const openedAfter = fs.fstatSync(descriptor);
    const linkedAfter = fs.lstatSync(file);
    if (!sameIdentity(openedBefore, openedAfter) || !sameIdentity(openedAfter, linkedAfter) || bytes.length !== openedAfter.size) {
      fail('KSTACK_CONFIG_MIGRATION_FILE_CHANGED');
    }
    return { bytes, stat: openedAfter };
  } finally { fs.closeSync(descriptor); }
}

function readRegular(file, maximum = 65_536) { return readRegularSnapshot(file, maximum).bytes; }

function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY ?? 0));
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function durableReplace(file, bytes, mode = 0o600) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  try {
    fs.renameSync(temporary, file);
    fs.chmodSync(file, mode);
    syncDirectory(directory);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function durableCreate(file, bytes, mode = 0o600) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.create`);
  const descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  try {
    fs.linkSync(temporary, file);
    syncDirectory(directory);
    return true;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    return false;
  } finally {
    try { fs.unlinkSync(temporary); } catch {}
  }
}

function pathDigest(file) { return digest(Buffer.from(path.resolve(file), 'utf8')); }

function portablePathKey(file) {
  return path.resolve(file).normalize('NFC').replaceAll('\\', '/').toLowerCase();
}

function existingFileIdentity(file) {
  try {
    const stat = fs.statSync(file);
    return `${stat.dev}:${stat.ino}`;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function resolvePaths(options) {
  const configPath = path.resolve(options?.configPath ?? '');
  const journalPath = path.resolve(options?.journalPath ?? `${configPath}.v2-migration-journal`);
  const backupPath = path.resolve(options?.backupPath ?? `${configPath}.v1-retained`);
  const fencePath = path.resolve(options?.fencePath ?? `${journalPath}.config-v2-committed`);
  const lockPath = `${configPath}.v2-migration.lock`;
  const lockReaperPath = `${lockPath}.reaper`;
  const resolved = { configPath, journalPath, backupPath, fencePath, lockPath, lockReaperPath };
  const files = Object.values(resolved);
  if (new Set(files.map(portablePathKey)).size !== files.length) fail('KSTACK_CONFIG_MIGRATION_PATH_ALIAS');
  const identities = files.map(existingFileIdentity).filter(Boolean);
  if (new Set(identities).size !== identities.length) fail('KSTACK_CONFIG_MIGRATION_PATH_ALIAS');
  return resolved;
}

function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return null;
  try { process.kill(pid, 0); return true; } catch (error) {
    if (error?.code === 'ESRCH') return false;
    return null;
  }
}

function parseLock(file) {
  try {
    const value = parseHostCanonicalJson(readRegular(file, 4_096));
    exactKeys(value, ['schemaVersion', 'token', 'pid', 'hostname'], 'KSTACK_CONFIG_MIGRATION_LOCK_INVALID');
    if (value.schemaVersion !== MIGRATION_LOCK_VERSION || typeof value.token !== 'string'
        || !/^[0-9a-f-]{36}$/u.test(value.token) || !Number.isSafeInteger(value.pid)
        || value.pid < 1 || typeof value.hostname !== 'string' || value.hostname.length < 1) {
      fail('KSTACK_CONFIG_MIGRATION_LOCK_INVALID');
    }
    return value;
  } catch (error) {
    if (error instanceof KStackConfigMigrationError) throw error;
    fail('KSTACK_CONFIG_MIGRATION_LOCK_INVALID');
  }
}

function acquireLock(paths) {
  const owner = {
    schemaVersion: MIGRATION_LOCK_VERSION,
    token: crypto.randomUUID(),
    pid: process.pid,
    hostname: os.hostname()
  };
  if (fs.existsSync(paths.lockReaperPath)) {
    parseLock(paths.lockReaperPath);
    fail('KSTACK_CONFIG_MIGRATION_RECLAIM_LOCKED');
  }
  if (durableCreate(paths.lockPath, hostCanonicalBytes(owner), 0o600)) return owner;
  const observed = parseLock(paths.lockPath);
  if (observed.hostname !== os.hostname() || processAlive(observed.pid) !== false) fail('KSTACK_CONFIG_MIGRATION_LOCKED');

  const reaper = { ...owner, token: crypto.randomUUID() };
  if (!durableCreate(paths.lockReaperPath, hostCanonicalBytes(reaper), 0o600)) fail('KSTACK_CONFIG_MIGRATION_RECLAIM_LOCKED');
  try {
    const current = parseLock(paths.lockPath);
    if (current.token !== observed.token || current.hostname !== observed.hostname || current.pid !== observed.pid
        || processAlive(current.pid) !== false) fail('KSTACK_CONFIG_MIGRATION_LOCKED');
    fs.unlinkSync(paths.lockPath);
    syncDirectory(path.dirname(paths.lockPath));
    if (!durableCreate(paths.lockPath, hostCanonicalBytes(owner), 0o600)) fail('KSTACK_CONFIG_MIGRATION_LOCKED');
    return owner;
  } finally {
    const currentReaper = parseLock(paths.lockReaperPath);
    if (currentReaper.token !== reaper.token) fail('KSTACK_CONFIG_MIGRATION_RECLAIM_FENCED');
    fs.unlinkSync(paths.lockReaperPath);
    syncDirectory(path.dirname(paths.lockReaperPath));
  }
}

function releaseLock(paths, owner) {
  const current = parseLock(paths.lockPath);
  if (current.token !== owner.token) fail('KSTACK_CONFIG_MIGRATION_LOCK_FENCED');
  fs.unlinkSync(paths.lockPath);
  syncDirectory(path.dirname(paths.lockPath));
}

function withLock(options, action) {
  const paths = resolvePaths(options);
  const owner = acquireLock(paths);
  let result;
  let actionError;
  try { result = action(paths); } catch (error) { actionError = error; }
  try { releaseLock(paths, owner); } catch (releaseError) {
    if (!actionError) throw releaseError;
  }
  if (actionError) throw actionError;
  return result;
}

export async function withKStackConfigWriteLock(configPath, action) {
  const paths = resolvePaths({ configPath });
  const owner = acquireLock(paths);
  let result;
  let actionError;
  try { result = await action(); } catch (error) { actionError = error; }
  try { releaseLock(paths, owner); } catch (releaseError) {
    if (!actionError) throw releaseError;
  }
  if (actionError) throw actionError;
  return result;
}

function crash(options, name) {
  if (options?.crashCut !== undefined && !CRASH_CUTS.has(options.crashCut)) fail('KSTACK_CONFIG_MIGRATION_CRASH_CUT_INVALID');
  if (options?.crashCut === name) fail(`KSTACK_CONFIG_MIGRATION_CRASH_CUT_${name}`);
}

function journalBytes(journal) { return hostCanonicalBytes(journal); }

function validateJournal(value) {
  exactKeys(value, [
    'schemaVersion', 'operationId', 'phase', 'configPathDigest', 'backupPathDigest',
    'fencePathDigest', 'sourceV1Digest', 'candidateV2Digest'
  ], 'KSTACK_CONFIG_MIGRATION_JOURNAL_INVALID');
  if (value.schemaVersion !== CONFIG_MIGRATION_JOURNAL_VERSION
      || typeof value.operationId !== 'string' || !/^[0-9a-f-]{36}$/u.test(value.operationId)
      || !PHASES.has(value.phase)) fail('KSTACK_CONFIG_MIGRATION_JOURNAL_INVALID');
  for (const field of ['configPathDigest', 'backupPathDigest', 'fencePathDigest', 'sourceV1Digest', 'candidateV2Digest']) {
    if (typeof value[field] !== 'string' || !DIGEST.test(value[field])) fail('KSTACK_CONFIG_MIGRATION_JOURNAL_INVALID');
  }
  return value;
}

function readJournal(file) {
  if (!fs.existsSync(file)) return null;
  let value;
  try { value = parseHostCanonicalJson(readRegular(file, 8_192)); }
  catch { fail('KSTACK_CONFIG_MIGRATION_JOURNAL_INVALID'); }
  return validateJournal(value);
}

function verifyJournalBinding(journal, paths) {
  if (journal.configPathDigest !== pathDigest(paths.configPath)
      || journal.backupPathDigest !== pathDigest(paths.backupPath)
      || journal.fencePathDigest !== pathDigest(paths.fencePath)) {
    fail('KSTACK_CONFIG_MIGRATION_JOURNAL_BINDING_MISMATCH');
  }
}

function plainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }

function mergeDefaults(template, supplied) {
  if (!plainObject(template) || !plainObject(supplied)) return structuredClone(supplied);
  if (Object.hasOwn(template, 'type') && Object.hasOwn(supplied, 'type') && template.type !== supplied.type) return structuredClone(supplied);
  const output = {};
  for (const key of Object.keys(template)) {
    output[key] = Object.hasOwn(supplied, key)
      ? mergeDefaults(template[key], supplied[key])
      : structuredClone(template[key]);
  }
  for (const key of Object.keys(supplied)) if (!Object.hasOwn(template, key)) output[key] = structuredClone(supplied[key]);
  return output;
}

function candidateFromLegacy(legacy) {
  const candidate = mergeDefaults(defaultConfig, legacy);
  candidate.schemaVersion = 2;
  candidate.secretBroker = structuredClone(DEFAULT_SECRET_BROKER_CONFIG);
  const errors = validateConfig(candidate);
  if (errors.length) fail('KSTACK_CONFIG_MIGRATION_CANDIDATE_INVALID');
  return candidate;
}

function writeJournal(file, journal) { durableReplace(file, journalBytes(validateJournal(journal)), 0o600); }

function assertExactCurrent(file, expected, code) {
  const current = readRegularSnapshot(file);
  if (!current.bytes.equals(expected)) fail(code);
  return current;
}

function swapPaths(paths, journal, direction) {
  if (!['forward', 'rollback'].includes(direction)) fail('KSTACK_CONFIG_MIGRATION_SWAP_DIRECTION_INVALID');
  const prefix = `${paths.configPath}.v2-migration-${journal.operationId}-${direction}`;
  return { candidate: `${prefix}.candidate`, claimed: `${prefix}.claimed` };
}

function swapArtifactsExist(paths, journal, direction) {
  const swap = swapPaths(paths, journal, direction);
  return fs.existsSync(swap.candidate) || fs.existsSync(swap.claimed);
}

function exclusivePublishExisting(source, destination, mode = 0o600) {
  fs.chmodSync(source, mode);
  try {
    fs.linkSync(source, destination);
    syncDirectory(path.dirname(destination));
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
}

function restoreMismatchedClaim(paths, swap) {
  if (!fs.existsSync(paths.configPath) && exclusivePublishExisting(swap.claimed, paths.configPath)) {
    fs.unlinkSync(swap.claimed);
    syncDirectory(path.dirname(paths.configPath));
  }
  fail('KSTACK_CONFIG_MIGRATION_COMPARE_AND_SWAP_FAILED');
}

function replaceExpectedWithoutOverwrite(paths, journal, direction, expectedBytes, replacementBytes, options) {
  const expectedDigest = direction === 'forward' ? journal.sourceV1Digest : journal.candidateV2Digest;
  const replacementDigest = direction === 'forward' ? journal.candidateV2Digest : journal.sourceV1Digest;
  if (digest(expectedBytes) !== expectedDigest || digest(replacementBytes) !== replacementDigest) {
    fail('KSTACK_CONFIG_MIGRATION_SWAP_BINDING_INVALID');
  }
  const swap = swapPaths(paths, journal, direction);
  const candidateCut = direction === 'forward' ? 'AFTER_FORWARD_CANDIDATE_CREATE' : 'AFTER_ROLLBACK_CANDIDATE_CREATE';
  const claimCut = direction === 'forward' ? 'AFTER_FORWARD_CLAIM' : 'AFTER_ROLLBACK_CLAIM';
  const installCut = direction === 'forward' ? 'AFTER_FORWARD_INSTALL' : 'AFTER_ROLLBACK_INSTALL';

  if (!fs.existsSync(swap.candidate)) {
    if (!durableCreate(swap.candidate, replacementBytes, 0o600)) fail('KSTACK_CONFIG_MIGRATION_SWAP_CANDIDATE_RACE');
  }
  if (!readRegular(swap.candidate).equals(replacementBytes)) fail('KSTACK_CONFIG_MIGRATION_SWAP_CANDIDATE_INVALID');
  crash(options, candidateCut);

  if (!fs.existsSync(swap.claimed)) {
    assertExactCurrent(paths.configPath, expectedBytes, 'KSTACK_CONFIG_MIGRATION_COMPARE_AND_SWAP_FAILED');
    fs.renameSync(paths.configPath, swap.claimed);
    syncDirectory(path.dirname(paths.configPath));
  }
  if (!readRegular(swap.claimed).equals(expectedBytes)) restoreMismatchedClaim(paths, swap);
  crash(options, claimCut);

  if (!fs.existsSync(paths.configPath)) exclusivePublishExisting(swap.candidate, paths.configPath, 0o600);
  if (!fs.existsSync(paths.configPath) || !readRegular(paths.configPath).equals(replacementBytes)) {
    fail('KSTACK_CONFIG_MIGRATION_COMPARE_AND_SWAP_FAILED');
  }
  crash(options, installCut);

  if (fs.existsSync(swap.candidate)) fs.unlinkSync(swap.candidate);
  if (fs.existsSync(swap.claimed)) fs.unlinkSync(swap.claimed);
  syncDirectory(path.dirname(paths.configPath));
}

function requireBackup(paths, journal) {
  const backup = readRegular(paths.backupPath);
  if (digest(backup) !== journal.sourceV1Digest || parseKStackConfigDocument(backup).schemaVersion !== 1) {
    fail('KSTACK_CONFIG_MIGRATION_BACKUP_INVALID');
  }
  return backup;
}

function fenceValue(journal) {
  return {
    schemaVersion: CONFIG_V2_COMMITTED_FENCE_VERSION,
    operationId: journal.operationId,
    configPathDigest: journal.configPathDigest,
    backupPathDigest: journal.backupPathDigest,
    fencePathDigest: journal.fencePathDigest,
    sourceV1Digest: journal.sourceV1Digest,
    candidateV2Digest: journal.candidateV2Digest,
    disposition: 'CONFIG_V2_COMMITTED'
  };
}

function verifyFence(paths, journal) {
  let value;
  try { value = parseHostCanonicalJson(readRegular(paths.fencePath, 4_096)); }
  catch { fail('KSTACK_CONFIG_V2_FENCE_CONFLICT'); }
  if (!hostCanonicalBytes(value).equals(hostCanonicalBytes(fenceValue(journal)))) fail('KSTACK_CONFIG_V2_FENCE_CONFLICT');
}

function migrateUnlocked(options, paths) {
  let journal = readJournal(paths.journalPath);
  if (journal) verifyJournalBinding(journal, paths);
  if (!fs.existsSync(paths.configPath)) {
    if (!journal || journal.phase !== 'PREPARED' || !swapArtifactsExist(paths, journal, 'forward')) {
      fail('KSTACK_CONFIG_MIGRATION_FILE_UNAVAILABLE');
    }
    const backup = requireBackup(paths, journal);
    const legacy = parseKStackConfigDocument(backup);
    const replacement = canonicalKStackConfigV2Bytes(candidateFromLegacy(legacy));
    replaceExpectedWithoutOverwrite(paths, journal, 'forward', backup, replacement, options);
  }
  let initial = readRegular(paths.configPath);
  let current = parseKStackConfigDocument(initial);
  if (current.schemaVersion === 2) {
    if (!journal) fail('KSTACK_CONFIG_MIGRATION_JOURNAL_MISSING');
    if (journal.phase === 'ROLLED_BACK' || journal.phase === 'ROLLBACK_PREPARED') fail('KSTACK_CONFIG_MIGRATION_ROLLBACK_IN_PROGRESS');
    if (digest(initial) !== journal.candidateV2Digest) fail('KSTACK_CONFIG_MIGRATION_CANDIDATE_DRIFT');
    const backup = requireBackup(paths, journal);
    if (swapArtifactsExist(paths, journal, 'forward')) {
      replaceExpectedWithoutOverwrite(paths, journal, 'forward', backup, initial, options);
      initial = readRegular(paths.configPath);
      current = parseKStackConfigDocument(initial);
    }
    if (fs.existsSync(paths.fencePath)) {
      verifyFence(paths, journal);
      if (journal.phase !== 'COMMITTED') {
        journal = { ...journal, phase: 'COMMITTED' };
        writeJournal(paths.journalPath, journal);
      }
      return Object.freeze({ state: 'CONFIG_V2_COMMITTED', configPath: paths.configPath, journalPath: paths.journalPath, backupPath: paths.backupPath, fencePath: paths.fencePath, candidateV2Digest: journal.candidateV2Digest, recovered: true });
    }
    if (journal.phase === 'COMMITTED') fail('KSTACK_CONFIG_V2_FENCE_MISSING');
    if (journal.phase !== 'READ_BACK_VERIFIED') {
      journal = { ...journal, phase: 'REPLACED' };
      writeJournal(paths.journalPath, journal);
      const readBack = readRegular(paths.configPath);
      if (!readBack.equals(initial) || parseKStackConfigDocument(readBack).schemaVersion !== 2) fail('KSTACK_CONFIG_MIGRATION_READ_BACK_INVALID');
      journal = { ...journal, phase: 'READ_BACK_VERIFIED' };
      writeJournal(paths.journalPath, journal);
    }
    return Object.freeze({ state: 'CONFIG_V2_READY', configPath: paths.configPath, journalPath: paths.journalPath, backupPath: paths.backupPath, fencePath: paths.fencePath, candidateV2Digest: journal.candidateV2Digest, recovered: true });
  }

  if (fs.existsSync(paths.fencePath)) fail('KSTACK_CONFIG_V2_COMMITTED_STATE_DRIFT');
  const errors = validateConfig(current, { configPath: paths.configPath });
  if (errors.length) fail('KSTACK_CONFIG_MIGRATION_SOURCE_INVALID');
  const candidateBytes = canonicalKStackConfigV2Bytes(candidateFromLegacy(current));
  const sourceV1Digest = digest(initial);
  const candidateV2Digest = digest(candidateBytes);

  if (journal) {
    if (journal.phase === 'ROLLED_BACK') fail('KSTACK_CONFIG_MIGRATION_ALREADY_ROLLED_BACK');
    if (journal.phase === 'ROLLBACK_PREPARED') fail('KSTACK_CONFIG_MIGRATION_ROLLBACK_IN_PROGRESS');
    if (journal.phase !== 'PREPARED' || journal.sourceV1Digest !== sourceV1Digest || journal.candidateV2Digest !== candidateV2Digest) {
      fail('KSTACK_CONFIG_MIGRATION_JOURNAL_DRIFT');
    }
  } else {
    if (fs.existsSync(paths.backupPath)) fail('KSTACK_CONFIG_MIGRATION_UNBOUND_BACKUP');
    journal = validateJournal({
      schemaVersion: CONFIG_MIGRATION_JOURNAL_VERSION,
      operationId: crypto.randomUUID(),
      phase: 'PREPARED',
      configPathDigest: pathDigest(paths.configPath),
      backupPathDigest: pathDigest(paths.backupPath),
      fencePathDigest: pathDigest(paths.fencePath),
      sourceV1Digest,
      candidateV2Digest
    });
    if (!durableCreate(paths.journalPath, journalBytes(journal), 0o600)) fail('KSTACK_CONFIG_MIGRATION_JOURNAL_RACE');
    crash(options, 'AFTER_JOURNAL_CREATE');
  }

  if (!fs.existsSync(paths.backupPath)) {
    if (!durableCreate(paths.backupPath, initial, 0o600)) fail('KSTACK_CONFIG_MIGRATION_BACKUP_RACE');
  }
  if (!readRegular(paths.backupPath).equals(initial)) fail('KSTACK_CONFIG_MIGRATION_BACKUP_INVALID');
  crash(options, 'AFTER_BACKUP_CREATE');
  crash(options, 'BEFORE_REPLACE');
  replaceExpectedWithoutOverwrite(paths, journal, 'forward', initial, candidateBytes, options);
  crash(options, 'AFTER_REPLACE');
  journal = { ...journal, phase: 'REPLACED' };
  writeJournal(paths.journalPath, journal);
  crash(options, 'AFTER_REPLACED_JOURNAL');

  const readBack = readRegular(paths.configPath);
  if (!readBack.equals(candidateBytes) || digest(readBack) !== candidateV2Digest || parseKStackConfigDocument(readBack).schemaVersion !== 2) {
    fail('KSTACK_CONFIG_MIGRATION_READ_BACK_INVALID');
  }
  crash(options, 'AFTER_READ_BACK');
  journal = { ...journal, phase: 'READ_BACK_VERIFIED' };
  writeJournal(paths.journalPath, journal);
  return Object.freeze({ state: 'CONFIG_V2_READY', configPath: paths.configPath, journalPath: paths.journalPath, backupPath: paths.backupPath, fencePath: paths.fencePath, candidateV2Digest, recovered: false });
}

export function migrateKStackConfigV1ToV2(options) {
  return withLock(options, (paths) => migrateUnlocked(options, paths));
}

function commitUnlocked(options, paths) {
  let journal = readJournal(paths.journalPath);
  if (!journal || !['READ_BACK_VERIFIED', 'COMMITTED'].includes(journal.phase)) fail('KSTACK_CONFIG_V2_NOT_READY');
  verifyJournalBinding(journal, paths);
  const current = readRegular(paths.configPath);
  if (parseKStackConfigDocument(current).schemaVersion !== 2 || digest(current) !== journal.candidateV2Digest) fail('KSTACK_CONFIG_MIGRATION_CANDIDATE_DRIFT');
  requireBackup(paths, journal);
  const bytes = hostCanonicalBytes(fenceValue(journal));
  if (!fs.existsSync(paths.fencePath)) {
    if (journal.phase === 'COMMITTED') fail('KSTACK_CONFIG_V2_FENCE_MISSING');
    if (!durableCreate(paths.fencePath, bytes, 0o600)) fail('KSTACK_CONFIG_V2_FENCE_CONFLICT');
    crash(options, 'AFTER_FENCE_CREATE');
  }
  verifyFence(paths, journal);
  if (journal.phase !== 'COMMITTED') {
    journal = { ...journal, phase: 'COMMITTED' };
    writeJournal(paths.journalPath, journal);
  }
  return Object.freeze({ state: 'CONFIG_V2_COMMITTED', fencePath: paths.fencePath, candidateV2Digest: journal.candidateV2Digest });
}

export function commitConfigV2Fence(options) {
  return withLock(options, (paths) => commitUnlocked(options, paths));
}

function restoreUnlocked(options, paths) {
  let journal = readJournal(paths.journalPath);
  if (!journal) fail('KSTACK_CONFIG_V1_RESTORE_NOT_READY');
  verifyJournalBinding(journal, paths);
  if (journal.phase === 'COMMITTED' || fs.existsSync(paths.fencePath)) fail('KSTACK_CONFIG_V1_RESTORE_PERMANENTLY_DENIED');
  const backup = requireBackup(paths, journal);
  if (!fs.existsSync(paths.configPath)) {
    const swap = swapPaths(paths, journal, 'rollback');
    if (journal.phase !== 'ROLLBACK_PREPARED' || !fs.existsSync(swap.claimed)) fail('KSTACK_CONFIG_MIGRATION_FILE_UNAVAILABLE');
    const claimed = readRegular(swap.claimed);
    replaceExpectedWithoutOverwrite(paths, journal, 'rollback', claimed, backup, options);
  }
  let current = readRegular(paths.configPath);

  if (journal.phase === 'ROLLED_BACK') {
    if (!current.equals(backup) || digest(current) !== journal.sourceV1Digest) fail('KSTACK_CONFIG_V1_RESTORE_READ_BACK_INVALID');
    return Object.freeze({ state: 'CONFIG_V1_RESTORED', sourceV1Digest: journal.sourceV1Digest, recovered: true });
  }
  if (!['READ_BACK_VERIFIED', 'ROLLBACK_PREPARED'].includes(journal.phase)) fail('KSTACK_CONFIG_V1_RESTORE_NOT_READY');

  if (journal.phase === 'READ_BACK_VERIFIED') {
    if (digest(current) !== journal.candidateV2Digest || parseKStackConfigDocument(current).schemaVersion !== 2) fail('KSTACK_CONFIG_MIGRATION_CANDIDATE_DRIFT');
    journal = { ...journal, phase: 'ROLLBACK_PREPARED' };
    writeJournal(paths.journalPath, journal);
    crash(options, 'AFTER_ROLLBACK_PREPARE');
  }

  current = readRegular(paths.configPath);
  if (current.equals(backup)) {
    if (digest(current) !== journal.sourceV1Digest || parseKStackConfigDocument(current).schemaVersion !== 1) fail('KSTACK_CONFIG_V1_RESTORE_READ_BACK_INVALID');
    if (swapArtifactsExist(paths, journal, 'rollback')) {
      const claimed = readRegular(swapPaths(paths, journal, 'rollback').claimed);
      replaceExpectedWithoutOverwrite(paths, journal, 'rollback', claimed, backup, options);
    }
  } else {
    if (digest(current) !== journal.candidateV2Digest || parseKStackConfigDocument(current).schemaVersion !== 2) fail('KSTACK_CONFIG_MIGRATION_CANDIDATE_DRIFT');
    crash(options, 'BEFORE_ROLLBACK_REPLACE');
    replaceExpectedWithoutOverwrite(paths, journal, 'rollback', current, backup, options);
    crash(options, 'AFTER_ROLLBACK_REPLACE');
  }
  if (!readRegular(paths.configPath).equals(backup)) fail('KSTACK_CONFIG_V1_RESTORE_READ_BACK_INVALID');
  journal = { ...journal, phase: 'ROLLED_BACK' };
  writeJournal(paths.journalPath, journal);
  crash(options, 'AFTER_ROLLBACK_JOURNAL');
  return Object.freeze({ state: 'CONFIG_V1_RESTORED', sourceV1Digest: journal.sourceV1Digest, recovered: false });
}

export function restoreRetainedKStackConfigV1(options) {
  return withLock(options, (paths) => restoreUnlocked(options, paths));
}
