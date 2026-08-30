import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  hostAddress,
  hostCanonicalBytes
} from './kstack-host-contract.mjs';
import {
  replayHead,
  validateReplayArtifact,
  validateReplayLedgerSnapshot
} from './kstack-host-replay.mjs';

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const DIRECTORY = fs.constants.O_DIRECTORY ?? 0;
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exact(value, keys, code = 'KSTACK_REPLAY_LEDGER_UNAVAILABLE') {
  const actual = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort() : [];
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function assertDigest(value, code = 'KSTACK_REPLAY_LEDGER_CORRUPT') {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(code);
  return value;
}

function assertPrivateRegular(file, missing = false) {
  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | NOFOLLOW);
    const stat = fs.fstatSync(descriptor);
    const link = fs.lstatSync(file);
    const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
    if (!stat.isFile() || !link.isFile() || link.isSymbolicLink() || stat.dev !== link.dev || stat.ino !== link.ino
        || !owned || (stat.mode & 0o077) !== 0 || stat.size > 16 * 1024 * 1024) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    return descriptor;
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (missing && error?.code === 'ENOENT') return null;
    if (typeof error?.code === 'string' && error.code.startsWith('KSTACK_')) throw error;
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }
}

function readCanonical(file, missing = false) {
  const descriptor = assertPrivateRegular(file, missing);
  if (descriptor === null) return null;
  try {
    const raw = fs.readFileSync(descriptor);
    const value = JSON.parse(raw.toString('utf8'));
    if (!raw.equals(hostCanonicalBytes(value))) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    return value;
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('KSTACK_')) throw error;
    fail('KSTACK_REPLAY_LEDGER_CORRUPT');
  } finally {
    fs.closeSync(descriptor);
  }
}

function syncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, fs.constants.O_RDONLY | DIRECTORY | NOFOLLOW);
    fs.fsyncSync(descriptor);
  } catch {
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function durableReplace(directory, destination, value) {
  const temporary = path.join(directory, `.pending-${crypto.randomUUID()}`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | NOFOLLOW, 0o600);
    fs.writeFileSync(descriptor, hostCanonicalBytes(value));
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, destination);
    syncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch {}
    if (typeof error?.code === 'string' && error.code.startsWith('KSTACK_')) throw error;
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }
}

function durableCreate(directory, destination, value) {
  const temporary = path.join(directory, `.pending-${crypto.randomUUID()}`);
  let descriptor;
  try {
    try { fs.lstatSync(destination); fail('KSTACK_REPLAY_LEDGER_CORRUPT'); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | NOFOLLOW, 0o600);
    fs.writeFileSync(descriptor, hostCanonicalBytes(value));
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, destination);
    syncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch {}
    if (typeof error?.code === 'string' && error.code.startsWith('KSTACK_')) throw error;
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }
}

function validateRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.normalize(root) !== root || root === path.parse(root).root) fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  let stat;
  let link;
  try { stat = fs.statSync(root); link = fs.lstatSync(root); } catch { fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE'); }
  const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
  if (!stat.isDirectory() || !link.isDirectory() || link.isSymbolicLink() || stat.dev !== link.dev || stat.ino !== link.ino
      || !owned || (stat.mode & 0o077) !== 0) fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  return fs.realpathSync.native(root);
}

function validatePrivateDirectory(directory) {
  let stat;
  let link;
  try { stat = fs.statSync(directory); link = fs.lstatSync(directory); } catch { fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE'); }
  const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
  if (!stat.isDirectory() || !link.isDirectory() || link.isSymbolicLink() || stat.dev !== link.dev || stat.ino !== link.ino
      || !owned || (stat.mode & 0o077) !== 0) fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
}

function createPrivateDirectory(directory) {
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
    syncDirectory(path.dirname(directory));
  } catch { fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE'); }
  validatePrivateDirectory(directory);
}

function removeProvenPendingFiles(directory) {
  let changed = false;
  for (const name of fs.readdirSync(directory)) {
    if (!/^\.pending-[0-9a-f-]{36}$/u.test(name)) continue;
    const file = path.join(directory, name);
    const descriptor = assertPrivateRegular(file);
    fs.closeSync(descriptor);
    fs.unlinkSync(file);
    changed = true;
  }
  if (changed) syncDirectory(directory);
}

function acquireLock(root) {
  const file = path.join(root, 'transaction.lock');
  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | NOFOLLOW, 0o600);
    fs.writeFileSync(descriptor, hostCanonicalBytes({ ownerToken: crypto.randomUUID() }));
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    syncDirectory(root);
    return file;
  } catch {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }
}

function releaseLock(root, file) {
  try {
    fs.unlinkSync(file);
    syncDirectory(root);
  } catch {
    fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
  }
}

function withLock(root, action) {
  const lock = acquireLock(root);
  try { return action(); } finally { releaseLock(root, lock); }
}

export class ProtectedReplayFileStore {
  #root;
  #schemaSetDigest;
  #durabilityPrimitiveId;

  constructor(options) {
    exact(options, ['root', 'schemaSetDigest', 'durabilityPrimitiveId']);
    this.#root = validateRoot(options.root);
    this.#schemaSetDigest = assertDigest(options.schemaSetDigest, 'KSTACK_TIME_PROFILE_MISMATCH');
    if (typeof options.durabilityPrimitiveId !== 'string' || !/^[a-z][a-z0-9-]{0,127}$/u.test(options.durabilityPrimitiveId)) fail('KSTACK_TIME_PROFILE_MISMATCH');
    this.#durabilityPrimitiveId = options.durabilityPrimitiveId;
  }

  #highWaterPath() {
    return path.join(this.#root, 'trusted-time-high-water.json');
  }

  readHighWater(sourceProfileDigest) {
    assertDigest(sourceProfileDigest, 'KSTACK_TIME_PROFILE_MISMATCH');
    const value = readCanonical(this.#highWaterPath(), true);
    if (value === null) return null;
    validateReplayArtifact('TrustedTimeHighWaterV1', value);
    if (value.schemaSetDigest !== this.#schemaSetDigest || value.sourceProfileDigest !== sourceProfileDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    return structuredClone(value);
  }

  provisionHighWater(input) {
    exact(input, ['sourceProfileDigest', 'acceptedWallUtc', 'bootIdentityDigest', 'monotonicNanoseconds']);
    return withLock(this.#root, () => {
      if (readCanonical(this.#highWaterPath(), true) !== null) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      const checkpointInput = {
        schemaSetDigest: this.#schemaSetDigest,
        sourceProfileDigest: assertDigest(input.sourceProfileDigest, 'KSTACK_TIME_PROFILE_MISMATCH'),
        sequence: 1,
        acceptedWallUtc: input.acceptedWallUtc,
        bootIdentityDigest: assertDigest(input.bootIdentityDigest),
        monotonicNanoseconds: input.monotonicNanoseconds,
        durabilityPrimitiveId: this.#durabilityPrimitiveId
      };
      const value = {
        ...replayHead('TrustedTimeHighWaterV1', this.#schemaSetDigest),
        sourceProfileDigest: checkpointInput.sourceProfileDigest,
        sequence: 1,
        acceptedWallUtc: input.acceptedWallUtc,
        bootIdentityDigest: checkpointInput.bootIdentityDigest,
        monotonicNanoseconds: input.monotonicNanoseconds,
        previousHighWaterDigest: null,
        durabilityCheckpointDigest: hostAddress('KSTACK-TIME-DURABILITY-CHECKPOINT-V1', checkpointInput)
      };
      validateReplayArtifact('TrustedTimeHighWaterV1', value);
      durableReplace(this.#root, this.#highWaterPath(), value);
      return structuredClone(value);
    });
  }

  commitHighWater(proposed) {
    exact(proposed, [
      'schemaId', 'schemaVersion', 'schemaSetDigest', 'sourceProfileDigest', 'sequence', 'acceptedWallUtc',
      'bootIdentityDigest', 'monotonicNanoseconds', 'previousHighWaterDigest'
    ]);
    return withLock(this.#root, () => {
      const current = readCanonical(this.#highWaterPath());
      const currentAddress = validateReplayArtifact('TrustedTimeHighWaterV1', current);
      if (proposed.schemaSetDigest !== this.#schemaSetDigest || proposed.sourceProfileDigest !== current.sourceProfileDigest
          || proposed.sequence !== current.sequence + 1 || proposed.previousHighWaterDigest !== currentAddress.objectDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      const durabilityCheckpointDigest = hostAddress('KSTACK-TIME-DURABILITY-CHECKPOINT-V1', {
        proposed,
        priorDurabilityCheckpointDigest: current.durabilityCheckpointDigest,
        durabilityPrimitiveId: this.#durabilityPrimitiveId
      });
      const value = { ...structuredClone(proposed), durabilityCheckpointDigest };
      validateReplayArtifact('TrustedTimeHighWaterV1', value);
      durableReplace(this.#root, this.#highWaterPath(), value);
      return structuredClone(value);
    });
  }

  #ledgerPaths(ledgerId) {
    if (typeof ledgerId !== 'string' || !/^[a-z][a-z0-9-]{0,127}$/u.test(ledgerId)) fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    const key = crypto.createHash('sha256').update(Buffer.from(ledgerId, 'utf8')).digest('hex');
    const root = path.join(this.#root, `ledger-${key}`);
    return { root, transactions: path.join(root, 'transactions'), state: path.join(root, 'state.json') };
  }

  #genesis(ledgerId) {
    return {
      ledgerId,
      generation: 0,
      checkpointDigest: null,
      effectScopes: [],
      reservations: [],
      records: [],
      ambiguities: [],
      tombstones: []
    };
  }

  provisionLedger(ledgerId) {
    const paths = this.#ledgerPaths(ledgerId);
    return withLock(this.#root, () => {
      try { fs.lstatSync(paths.root); fail('KSTACK_REPLAY_LEDGER_CORRUPT'); } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      createPrivateDirectory(paths.root);
      createPrivateDirectory(paths.transactions);
      const genesis = this.#genesis(ledgerId);
      validateReplayLedgerSnapshot(genesis, this.#schemaSetDigest);
      durableReplace(paths.root, paths.state, genesis);
      return structuredClone(genesis);
    });
  }

  readLedger(ledgerId) {
    return withLock(this.#root, () => structuredClone(this.#loadLedger(ledgerId, true)));
  }

  #transactionFiles(paths) {
    validatePrivateDirectory(paths.root);
    validatePrivateDirectory(paths.transactions);
    removeProvenPendingFiles(paths.root);
    removeProvenPendingFiles(paths.transactions);
    const rootEntries = fs.readdirSync(paths.root).sort();
    if (rootEntries.length !== 2 || rootEntries[0] !== 'state.json' || rootEntries[1] !== 'transactions') fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const names = fs.readdirSync(paths.transactions).sort();
    if (names.some((name) => !/^[0-9]{12}\.json$/u.test(name))) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    for (let index = 0; index < names.length; index += 1) {
      if (names[index] !== `${String(index + 1).padStart(12, '0')}.json`) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    }
    return names.map((name) => path.join(paths.transactions, name));
  }

  #applyTransaction(state, transaction) {
    exact(transaction, [
      'schema', 'schemaSetDigest', 'ledgerId', 'generation', 'priorCheckpointDigest', 'checkpointDigest',
      'effectScope', 'reservation', 'record', 'ambiguity', 'tombstone'
    ], 'KSTACK_REPLAY_LEDGER_CORRUPT');
    if (transaction.schema !== 'kstack-replay-ledger-transaction-v1'
        || transaction.schemaSetDigest !== this.#schemaSetDigest
        || transaction.ledgerId !== state.ledgerId
        || transaction.generation !== state.generation + 1
        || transaction.priorCheckpointDigest !== state.checkpointDigest) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const { checkpointDigest, ...checkpointInput } = transaction;
    if (checkpointDigest !== hostAddress('KSTACK-REPLAY-LEDGER-TRANSACTION-V1', checkpointInput)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const next = structuredClone(state);
    if (transaction.effectScope !== null) next.effectScopes.push(structuredClone(transaction.effectScope));
    if (transaction.reservation !== null) next.reservations.push(structuredClone(transaction.reservation));
    if (transaction.record !== null) next.records.push(structuredClone(transaction.record));
    if (transaction.ambiguity !== null) next.ambiguities.push(structuredClone(transaction.ambiguity));
    if (transaction.tombstone !== null) next.tombstones.push(structuredClone(transaction.tombstone));
    next.generation = transaction.generation;
    next.checkpointDigest = checkpointDigest;
    validateReplayLedgerSnapshot(next, this.#schemaSetDigest);
    return next;
  }

  #loadLedger(ledgerId, repair) {
    const paths = this.#ledgerPaths(ledgerId);
    const persisted = readCanonical(paths.state);
    validateReplayLedgerSnapshot(persisted, this.#schemaSetDigest);
    if (persisted.ledgerId !== ledgerId) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    const files = this.#transactionFiles(paths);
    if (persisted.generation > files.length) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    let reconstructed = this.#genesis(ledgerId);
    let persistedPrefix = persisted.generation === 0 ? structuredClone(reconstructed) : null;
    for (const file of files) {
      reconstructed = this.#applyTransaction(reconstructed, readCanonical(file));
      if (reconstructed.generation === persisted.generation) persistedPrefix = structuredClone(reconstructed);
    }
    if (persistedPrefix === null || !hostCanonicalBytes(persisted).equals(hostCanonicalBytes(persistedPrefix))) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
    if (reconstructed.generation > persisted.generation) {
      if (!repair) fail('KSTACK_REPLAY_LEDGER_UNAVAILABLE');
      durableReplace(paths.root, paths.state, reconstructed);
    }
    return reconstructed;
  }

  commitLedger(input) {
    exact(input, [
      'ledgerId', 'expectedGeneration', 'expectedCheckpointDigest', 'effectScope', 'reservation', 'record', 'ambiguity',
      'tombstone'
    ], 'KSTACK_REPLAY_LEDGER_UNAVAILABLE');
    const paths = this.#ledgerPaths(input.ledgerId);
    return withLock(this.#root, () => {
      const current = this.#loadLedger(input.ledgerId, true);
      if (input.expectedGeneration !== current.generation
          || input.expectedCheckpointDigest !== current.checkpointDigest) return null;
      if ([input.effectScope, input.reservation, input.record, input.ambiguity, input.tombstone].every((entry) => entry === null)) fail('KSTACK_REPLAY_LEDGER_CORRUPT');
      const checkpointInput = {
        schema: 'kstack-replay-ledger-transaction-v1',
        schemaSetDigest: this.#schemaSetDigest,
        ledgerId: input.ledgerId,
        generation: current.generation + 1,
        priorCheckpointDigest: current.checkpointDigest,
        effectScope: structuredClone(input.effectScope),
        reservation: structuredClone(input.reservation),
        record: structuredClone(input.record),
        ambiguity: structuredClone(input.ambiguity),
        tombstone: structuredClone(input.tombstone)
      };
      const transaction = {
        ...checkpointInput,
        checkpointDigest: hostAddress('KSTACK-REPLAY-LEDGER-TRANSACTION-V1', checkpointInput)
      };
      const candidate = this.#applyTransaction(current, transaction);
      const file = path.join(paths.transactions, `${String(transaction.generation).padStart(12, '0')}.json`);
      durableCreate(paths.transactions, file, transaction);
      durableReplace(paths.root, paths.state, candidate);
      return structuredClone(candidate);
    });
  }
}
