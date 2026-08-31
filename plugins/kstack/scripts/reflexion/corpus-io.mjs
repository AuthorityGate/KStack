import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseAndValidateCorpusBytes, serializeValidatedCorpus, MAX_CORPUS_BYTES } from './corpus-boundary.mjs';

const CORPUS_BASENAME = 'reflexion-lessons.json';
const LOCK_BASENAME = 'reflexion-lessons.lock';
const EUCLEAN_QUARANTINE_BASENAME = 'reflexion-lessons.json.euclean-quarantine';
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const DIRECTORY = fs.constants.O_DIRECTORY ?? 0;
const WINDOWS_REPLACEMENT_DELAYS_MS = Object.freeze([50, 100, 200, 400, 800]);
const AMBIGUOUS_ENDPOINT_ERRNOS = new Set(['EIO', 'ENODEV', 'ENXIO', 'EREMOTEIO']);
const TRANSIENT_OPERATIONAL_ERRNOS = new Set([
  'EACCES', 'EPERM', 'EAGAIN', 'EBUSY', 'EINTR', 'EMFILE', 'ENFILE', 'ENOMEM',
  'ETIMEDOUT', 'ESTALE', 'ECONNABORTED', 'ECONNRESET', 'ENETDOWN', 'ENETRESET',
  'ENETUNREACH', 'EHOSTDOWN', 'EHOSTUNREACH'
]);
const IO_OPERATION_KEYS = Object.freeze([
  'lstatBigint', 'open', 'fstatBigint', 'readFile', 'writeFile', 'fchmod', 'fsync',
  'close', 'unlink', 'link', 'rename', 'rmdir', 'realpathNative', 'mkdir0700',
  'now', 'sleep', 'randomUUID', 'getuid', 'platform'
]);
const LOWERCASE_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const REAL_IO = Object.freeze({
  lstatBigint: (target) => fs.lstatSync(target, { bigint: true }),
  open: (target, flags, mode) => fs.openSync(target, flags, mode),
  fstatBigint: (fd) => fs.fstatSync(fd, { bigint: true }),
  readFile: (target) => fs.readFileSync(target),
  writeFile: (target, bytes) => fs.writeFileSync(target, bytes),
  fchmod: (fd, mode) => fs.fchmodSync(fd, mode),
  fsync: (fd) => fs.fsyncSync(fd),
  close: (fd) => fs.closeSync(fd),
  unlink: (target) => fs.unlinkSync(target),
  link: (source, target) => fs.linkSync(source, target),
  rename: (source, target) => fs.renameSync(source, target),
  rmdir: (target) => fs.rmdirSync(target),
  realpathNative: (target) => fs.realpathSync.native(target),
  mkdir0700: (target) => fs.mkdirSync(target, { mode: 0o700 }),
  now: () => Date.now(),
  sleep: (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds),
  randomUUID: () => crypto.randomUUID(),
  getuid: () => typeof process.getuid === 'function' ? process.getuid() : 0,
  platform: () => process.platform
});

export function makeCorpusIoTestOperations(overrides = {}) {
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) throw new TypeError('invalid corpus I/O overrides');
  for (const key of Object.keys(overrides)) if (!IO_OPERATION_KEYS.includes(key)) throw new TypeError(`unknown corpus I/O operation: ${key}`);
  return Object.freeze(Object.fromEntries(IO_OPERATION_KEYS.map((key) => {
    const value = Object.hasOwn(overrides, key) ? overrides[key] : REAL_IO[key];
    if (typeof value !== 'function') throw new TypeError(`invalid corpus I/O operation: ${key}`);
    return [key, value];
  })));
}

export function windowsReplacementSchedule() { return WINDOWS_REPLACEMENT_DELAYS_MS; }

function endpointError(code, metadata = null) {
  const error = new Error(code);
  error.code = code;
  if (metadata) error.metadata = Object.freeze({ ...metadata });
  return Object.seal(error);
}

function exactEnoent(error) { return error?.code === 'ENOENT'; }
function sameIdentity(left, right) {
  return left?.dev !== undefined && left?.ino !== undefined && left.dev !== 0n && left.ino !== 0n
    && left.dev === right?.dev && left.ino === right?.ino;
}

function assertContainedKstack(rootReal, kstackReal) {
  const relative = path.relative(rootReal, kstackReal);
  const components = relative.split(path.sep);
  if (path.isAbsolute(relative) || components.length !== 1 || components[0].toLowerCase() !== '.kstack') throw endpointError('KSTACK_REFLEXION_PROJECT_ROOT_INVALID');
}

export function resolveProjectCorpus(projectRoot, { mutation = false } = {}) {
  const rootReal = fs.realpathSync.native(path.resolve(projectRoot));
  const kstackPath = path.join(rootReal, '.kstack');
  let stat;
  try { stat = fs.lstatSync(kstackPath, { bigint: true }); }
  catch (error) {
    if (!exactEnoent(error) || !mutation) {
      if (exactEnoent(error)) return Object.freeze({ rootReal, kstackPath, kstackReal: null, corpusPath: null, absentKstack: true });
      throw endpointError('KSTACK_REFLEXION_PROJECT_ROOT_IO');
    }
    fs.mkdirSync(kstackPath, { mode: 0o700 });
    stat = fs.lstatSync(kstackPath, { bigint: true });
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw endpointError('KSTACK_REFLEXION_PROJECT_ROOT_INVALID');
  const kstackReal = fs.realpathSync.native(kstackPath);
  assertContainedKstack(rootReal, kstackReal);
  return Object.freeze({ rootReal, kstackPath, kstackReal, corpusPath: path.join(kstackReal, CORPUS_BASENAME), absentKstack: false });
}

function readOnce(location) {
  if (location.absentKstack) return Object.freeze([]);
  let fd;
  let primary;
  try {
    fd = fs.openSync(location.corpusPath, fs.constants.O_RDONLY | NOFOLLOW);
    const stat = fs.fstatSync(fd, { bigint: true });
    if (!stat.isFile() || stat.size > BigInt(MAX_CORPUS_BYTES)) throw endpointError('KSTACK_REFLEXION_CORPUS_ENDPOINT_INVALID');
    const bytes = fs.readFileSync(fd);
    if (bytes.length !== Number(stat.size)) throw endpointError('KSTACK_REFLEXION_CORPUS_ENDPOINT_IO');
    return parseAndValidateCorpusBytes(bytes);
  } catch (error) {
    primary = error;
    if (exactEnoent(error)) return Object.freeze([]);
    throw error?.code?.startsWith?.('KSTACK_REFLEXION_') ? error : endpointError('KSTACK_REFLEXION_CORPUS_ENDPOINT_IO');
  } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { if (!primary) throw endpointError('KSTACK_REFLEXION_CORPUS_ENDPOINT_IO'); } }
}

export function readValidatedCorpus(location, { retry = true } = {}) {
  try { return readOnce(location); } catch (first) { if (!retry) throw first; return readOnce(location); }
}

function assertPrivateDirectory(location, operations = REAL_IO) {
  const stat = operations.lstatBigint(location.kstackReal);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
  if (operations.platform() !== 'win32' && (stat.uid !== BigInt(operations.getuid()) || (stat.mode & 0o7777n) !== 0o700n)) throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
}

function safeLockAge(now, createdAtMs) { return Number.isSafeInteger(createdAtMs) && createdAtMs >= 0 ? Math.max(0, now - createdAtMs) : null; }

function diagnoseLockTimeout(lockPath, operations) {
  let fd;
  let primary;
  let ownerToken = '<unavailable:malformed-lock-record>';
  let ageMs = null;
  try {
    fd = operations.open(lockPath, fs.constants.O_RDONLY | NOFOLLOW);
    const stat = operations.fstatBigint(fd);
    if (!stat.isFile() || stat.size > 4_096n) throw new Error('unreadable lock');
    const bytes = operations.readFile(fd);
    if (bytes.length !== Number(stat.size)) throw new Error('short lock read');
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        && Object.keys(parsed).join(',') === 'ownerToken,createdAtMs'
        && LOWERCASE_UUID_V4.test(parsed.ownerToken)
        && Number.isSafeInteger(parsed.createdAtMs) && parsed.createdAtMs >= 0) {
      ownerToken = parsed.ownerToken;
      ageMs = safeLockAge(operations.now(), parsed.createdAtMs);
    }
  } catch (error) { primary = error; }
  finally { if (fd !== undefined) try { operations.close(fd); } catch { if (!primary) primary = new Error('lock close'); } }
  if (primary) { ownerToken = '<unavailable:malformed-lock-record>'; ageMs = null; }
  if (ageMs === null) {
    try { const mtimeMs = Number(operations.lstatBigint(lockPath).mtimeMs); if (Number.isSafeInteger(mtimeMs) && mtimeMs >= 0) ageMs = safeLockAge(operations.now(), mtimeMs); } catch {}
  }
  return Object.freeze({ ownerToken, ageMs: ageMs ?? 0 });
}

export function formatLockTimeoutDiagnosis(error) {
  const record = error?.code === 'KSTACK_REFLEXION_LOCK_TIMEOUT' ? error.metadata : null;
  const ownerToken = typeof record?.ownerToken === 'string' && LOWERCASE_UUID_V4.test(record.ownerToken)
    ? record.ownerToken : '<unavailable:malformed-lock-record>';
  const ageMs = Number.isSafeInteger(record?.ageMs) && record.ageMs >= 0 ? record.ageMs : 0;
  return `KSTACK_REFLEXION_LOCK_TIMEOUT ownerToken=${ownerToken} ageMs=${ageMs}\n`;
}

function acquireLock(location, operations = REAL_IO) {
  const lockPath = path.join(location.kstackReal, LOCK_BASENAME);
  const ownerToken = operations.randomUUID();
  const deadline = operations.now() + 5_000;
  for (;;) {
    let fd;
    try {
      fd = operations.open(lockPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
      operations.writeFile(fd, Buffer.from(`${JSON.stringify({ ownerToken, createdAtMs: operations.now() })}\n`));
      operations.fsync(fd);
      operations.close(fd);
      return Object.freeze({ lockPath, ownerToken });
    } catch (error) {
      if (fd !== undefined) try { operations.close(fd); } catch {}
      if (error?.code !== 'EEXIST') throw endpointError('KSTACK_REFLEXION_LOCK_IO');
      if (operations.now() >= deadline) throw endpointError('KSTACK_REFLEXION_LOCK_TIMEOUT', diagnoseLockTimeout(lockPath, operations));
      operations.sleep(10 + Math.floor(Math.random() * 31));
    }
  }
}

export function acquireCorpusLockForTest(location, operations) { return acquireLock(location, operations); }

function releaseLock(lock, operations = REAL_IO) {
  let fd;
  try {
    fd = operations.open(lock.lockPath, fs.constants.O_RDONLY | NOFOLLOW);
    const stat = operations.fstatBigint(fd);
    if (!stat.isFile() || stat.size > 4_096n) return;
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(operations.readFile(fd)));
    if (parsed?.ownerToken === lock.ownerToken) operations.unlink(lock.lockPath);
  } catch {} finally { if (fd !== undefined) try { operations.close(fd); } catch {} }
}

function fsyncDirectory(directory, operations = REAL_IO) {
  if (operations.platform() === 'win32') return;
  const fd = operations.open(directory, fs.constants.O_RDONLY | DIRECTORY | NOFOLLOW);
  try { operations.fsync(fd); } finally { operations.close(fd); }
}

function openVerifiedParent(location, operations) {
  const pathname = operations.lstatBigint(location.kstackReal);
  if (!pathname.isDirectory?.() || pathname.isSymbolicLink?.()
      || (operations.platform() !== 'win32' && (pathname.uid !== BigInt(operations.getuid()) || (pathname.mode & 0o7777n) !== 0o700n))) {
    throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
  }
  const fd = operations.open(location.kstackReal, fs.constants.O_RDONLY | DIRECTORY | NOFOLLOW);
  try {
    const descriptor = operations.fstatBigint(fd);
    if (!sameIdentity(pathname, descriptor) || !descriptor.isDirectory?.()
        || (operations.platform() !== 'win32' && (descriptor.uid !== BigInt(operations.getuid()) || (descriptor.mode & 0o7777n) !== 0o700n))) {
      throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
    }
    return Object.freeze({ fd, identity: descriptor });
  } catch (error) { try { operations.close(fd); } catch {}; throw error; }
}

function verifyParentDescriptor(parentState, operations) {
  const current = operations.fstatBigint(parentState.fd);
  if (!sameIdentity(parentState.identity, current) || !current.isDirectory?.()
      || (operations.platform() !== 'win32' && (current.uid !== BigInt(operations.getuid()) || (current.mode & 0o7777n) !== 0o700n))) {
    throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
  }
}

function replaceAuthoritative(temporary, authoritative, operations) {
  if (operations.platform() !== 'win32') { operations.rename(temporary, authoritative); return; }
  let attempt = 0;
  for (;;) {
    try { operations.rename(temporary, authoritative); return; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error?.code) || attempt >= WINDOWS_REPLACEMENT_DELAYS_MS.length) throw error;
      operations.sleep(WINDOWS_REPLACEMENT_DELAYS_MS[attempt]);
      attempt += 1;
    }
  }
}

function installBytes(location, bytes, operations = REAL_IO) {
  assertPrivateDirectory(location, operations);
  const temporary = path.join(location.kstackReal, `.${CORPUS_BASENAME}.${process.pid}.${operations.randomUUID()}.tmp`);
  let fd;
  let installed = false;
  try {
    fd = operations.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
    operations.fchmod(fd, 0o600);
    operations.writeFile(fd, bytes);
    operations.fsync(fd);
    operations.close(fd); fd = undefined;
    assertPrivateDirectory(location, operations);
    replaceAuthoritative(temporary, location.corpusPath, operations);
    installed = true;
    if (operations.platform() !== 'win32') fsyncDirectory(location.kstackReal, operations);
  } finally {
    if (fd !== undefined) try { operations.close(fd); } catch {}
    if (!installed) try { operations.unlink(temporary); } catch (error) { if (!exactEnoent(error)) throw error; }
  }
}

export function mutateValidatedCorpus(location, mutator, operations = REAL_IO) {
  if (location.absentKstack || !location.kstackReal) throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
  assertPrivateDirectory(location, operations);
  const lock = acquireLock(location, operations);
  try {
    assertPrivateDirectory(location, operations);
    const current = operations === REAL_IO ? readValidatedCorpus(location, { retry: false }) : endpointSnapshot(location, operations).lessons;
    const prospective = mutator(current.map((lesson) => ({ ...lesson, taskSignature: [...lesson.taskSignature], applicabilityPhrases: [...lesson.applicabilityPhrases] })));
    const bytes = serializeValidatedCorpus(prospective);
    installBytes(location, bytes, operations);
    return parseAndValidateCorpusBytes(bytes);
  } finally { releaseLock(lock, operations); }
}

function endpointObservationOnce(location, operations) {
  let pathnameStat;
  try { pathnameStat = operations.lstatBigint(location.corpusPath); }
  catch (error) { if (error?.code === 'ENOENT') return { expectCurrent: 'missing', bytes: null, lessons: Object.freeze([]), transferKind: null }; throw error; }
  if (pathnameStat.isSymbolicLink?.()) return { expectCurrent: 'KSTACK_REFLEXION_CURRENT_FINAL_LINK', bytes: null, lessons: null, transferKind: null };
  if (!pathnameStat.isFile?.()) return { expectCurrent: 'KSTACK_REFLEXION_CURRENT_NON_REGULAR', bytes: null, lessons: null, transferKind: pathnameStat.isDirectory?.() ? 'directory' : null };
  if (pathnameStat.size > BigInt(MAX_CORPUS_BYTES)) return { expectCurrent: 'KSTACK_REFLEXION_CURRENT_OVERSIZED', bytes: null, lessons: null, transferKind: null };
  let fd;
  let primary;
  try {
    fd = operations.open(location.corpusPath, fs.constants.O_RDONLY | NOFOLLOW);
    const before = operations.fstatBigint(fd);
    if (!before.isFile?.() || !sameIdentity(pathnameStat, before)) throw endpointError('KSTACK_REFLEXION_CURRENT_IO');
    const bytes = operations.readFile(fd);
    if (bytes.length !== Number(before.size)) throw endpointError('KSTACK_REFLEXION_CURRENT_IO');
    const after = operations.fstatBigint(fd);
    const final = operations.lstatBigint(location.corpusPath);
    if (!sameIdentity(before, after) || !sameIdentity(before, final) || final.isSymbolicLink?.()) throw endpointError('KSTACK_REFLEXION_CURRENT_IO');
    try { const lessons = parseAndValidateCorpusBytes(bytes); return { expectCurrent: 'valid', bytes, lessons, transferKind: null }; }
    catch (error) { return { expectCurrent: error.code, bytes, lessons: null, transferKind: null }; }
  } catch (error) { primary = error; throw error; }
  finally { if (fd !== undefined) try { operations.close(fd); } catch { if (!primary) throw endpointError('KSTACK_REFLEXION_CURRENT_IO'); } }
}

function endpointSnapshot(location, operations = REAL_IO) {
  if (location.absentKstack) return { expectCurrent: 'missing', bytes: null, lessons: Object.freeze([]), transferKind: null };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return endpointObservationOnce(location, operations); }
    catch (error) {
      if (error?.code === 'EUCLEAN' && operations.platform() === 'linux') return { expectCurrent: 'KSTACK_REFLEXION_CURRENT_IO', bytes: null, lessons: null, transferKind: 'euclean' };
      if (AMBIGUOUS_ENDPOINT_ERRNOS.has(error?.code)) { if (attempt < 2) continue; throw endpointError('KSTACK_REFLEXION_CURRENT_AMBIGUOUS_IO'); }
      if (TRANSIENT_OPERATIONAL_ERRNOS.has(error?.code)) throw endpointError('KSTACK_REFLEXION_CURRENT_OPERATIONAL_IO');
      if (error?.code?.startsWith?.('KSTACK_REFLEXION_')) throw error;
      throw endpointError('KSTACK_REFLEXION_CURRENT_OPERATIONAL_IO');
    }
  }
  throw endpointError('KSTACK_REFLEXION_CURRENT_AMBIGUOUS_IO');
}

export function diagnoseCurrentCorpus(location, operations = REAL_IO) {
  const snapshot = endpointSnapshot(location, operations);
  return Object.freeze({ expectCurrent: snapshot.expectCurrent, bytes: snapshot.bytes });
}

function validateCandidate(location, candidatePath, operations) {
  const candidatesReal = operations.realpathNative(path.join(location.rootReal, '.kstack-repair-candidates'));
  const candidateAbsolute = path.resolve(candidatePath);
  const basename = path.basename(candidateAbsolute);
  if (path.dirname(candidateAbsolute) !== candidatesReal || basename.startsWith('.') || basename === CORPUS_BASENAME || basename === LOCK_BASENAME || basename.includes('quarantine')) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_INVALID');
  const directoryStat = operations.lstatBigint(candidatesReal);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()
      || (operations.platform() !== 'win32' && (directoryStat.uid !== BigInt(operations.getuid()) || (directoryStat.mode & 0o7777n) !== 0o700n))
      || !operations.readFile(path.join(candidatesReal, '.gitignore')).equals(Buffer.from('*\n!.gitignore\n'))) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_INVALID');
  let fd;
  let primary;
  try {
    const pathname = operations.lstatBigint(candidateAbsolute);
    if (pathname.isSymbolicLink?.()) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_INVALID');
    fd = operations.open(candidateAbsolute, fs.constants.O_RDONLY | NOFOLLOW);
    const stat = operations.fstatBigint(fd);
    if (!stat.isFile() || !sameIdentity(pathname, stat) || stat.size > BigInt(MAX_CORPUS_BYTES)
        || (operations.platform() !== 'win32' && (stat.uid !== BigInt(operations.getuid()) || (stat.mode & 0o7777n) !== 0o600n))) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_INVALID');
    const bytes = operations.readFile(fd);
    if (bytes.length !== Number(stat.size)) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_INVALID');
    return { candidatesReal, candidateAbsolute, candidateIdentity: stat, bytes, lessons: parseAndValidateCorpusBytes(bytes) };
  } catch (error) { primary = error; throw error; }
  finally { if (fd !== undefined) try { operations.close(fd); } catch { if (!primary) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_INVALID'); } }
}

function transferEuclean(location, operations) {
  const quarantine = path.join(location.kstackReal, EUCLEAN_QUARANTINE_BASENAME);
  const source = path.join(location.kstackReal, CORPUS_BASENAME);
  const parentState = openVerifiedParent(location, operations);
  let primary;
  try {
    verifyParentDescriptor(parentState, operations);
    operations.link(source, quarantine);
    verifyParentDescriptor(parentState, operations);
    operations.fsync(parentState.fd);
    operations.unlink(source);
    verifyParentDescriptor(parentState, operations);
    operations.fsync(parentState.fd);
  } catch (error) { primary = error; throw error; }
  finally { try { operations.close(parentState.fd); } catch (error) { if (!primary) throw error; } }
}

function quarantineNonRegularDirectory(location, operations) {
  const quarantine = path.join(location.kstackReal, `${CORPUS_BASENAME}.directory-quarantine.${process.pid}.${operations.randomUUID()}`);
  const parentState = openVerifiedParent(location, operations);
  let primary;
  try {
    verifyParentDescriptor(parentState, operations);
    operations.rename(location.corpusPath, quarantine);
    verifyParentDescriptor(parentState, operations);
    operations.fsync(parentState.fd);
  } catch (error) { primary = error; throw error; }
  finally { try { operations.close(parentState.fd); } catch (error) { if (!primary) throw error; } }
  return quarantine;
}

function identityCheckedCandidateCleanup(candidate, operations) {
  const observed = operations.lstatBigint(candidate.candidateAbsolute);
  if (!sameIdentity(observed, candidate.candidateIdentity) || !observed.isFile?.() || observed.isSymbolicLink?.()) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_CLEANUP');
  operations.unlink(candidate.candidateAbsolute);
  fsyncDirectory(candidate.candidatesReal, operations);
}

export function repairCorpusFromCandidate(location, { candidatePath, expectCurrent, expectSha256 }, operations = REAL_IO) {
  if (location.absentKstack || !location.kstackReal) throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
  assertPrivateDirectory(location, operations);
  const lock = acquireLock(location, operations);
  let directoryQuarantine = null;
  let committed = false;
  try {
    const snapshot = endpointSnapshot(location, operations);
    if (snapshot.expectCurrent !== expectCurrent) throw endpointError('KSTACK_REFLEXION_REPAIR_EXPECTATION_MISMATCH');
    const digestRequired = expectCurrent === 'valid' || expectCurrent?.startsWith?.('KSTACK_REFLEXION_CORPUS_');
    if (digestRequired && crypto.createHash('sha256').update(snapshot.bytes).digest('hex') !== expectSha256) throw endpointError('KSTACK_REFLEXION_REPAIR_EXPECTATION_MISMATCH');
    if (expectCurrent === 'KSTACK_REFLEXION_CURRENT_IO' && snapshot.transferKind !== 'euclean') throw endpointError('KSTACK_REFLEXION_REPAIR_EXPECTATION_MISMATCH');
    const candidate = validateCandidate(location, candidatePath, operations);
    if (snapshot.transferKind === 'euclean') transferEuclean(location, operations);
    else if (snapshot.transferKind === 'directory') directoryQuarantine = quarantineNonRegularDirectory(location, operations);
    installBytes(location, candidate.bytes, operations);
    committed = true;
    let candidateFailure = false;
    let quarantineFailure = false;
    try { identityCheckedCandidateCleanup(candidate, operations); } catch { candidateFailure = true; }
    if (directoryQuarantine) try { operations.rmdir(directoryQuarantine); fsyncDirectory(location.kstackReal, operations); } catch { quarantineFailure = true; }
    if (candidateFailure) throw endpointError('KSTACK_REFLEXION_REPAIR_CANDIDATE_CLEANUP');
    if (quarantineFailure) throw endpointError('KSTACK_REFLEXION_REPAIR_QUARANTINE_CLEANUP');
    return candidate.lessons;
  } catch (error) {
    if (!committed && directoryQuarantine) {
      try { operations.lstatBigint(location.corpusPath); }
      catch (missing) { if (missing?.code === 'ENOENT') try { operations.rename(directoryQuarantine, location.corpusPath); fsyncDirectory(location.kstackReal, operations); } catch {} }
    }
    throw error;
  } finally { releaseLock(lock, operations); }
}

export function migrateKstackMode(location, { dryRun = false } = {}) {
  if (process.platform === 'win32') return Object.freeze({ kind: 'kstack-mode-migration-v1', dryRun, currentMode: null, proposedMode: null, applied: false });
  if (location.absentKstack) throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
  const fd = fs.openSync(location.kstackReal, fs.constants.O_RDONLY | DIRECTORY | NOFOLLOW);
  let applied = false;
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    if (!before.isDirectory() || before.uid !== BigInt(process.getuid()) || before.dev === 0n || before.ino === 0n || (before.mode & 0o7000n) !== 0n) throw endpointError('KSTACK_REFLEXION_MUTATION_PARENT');
    if (!dryRun) {
      fs.fchmodSync(fd, 0o700); applied = true;
      const after = fs.fstatSync(fd, { bigint: true });
      if (after.dev !== before.dev || after.ino !== before.ino || (after.mode & 0o7777n) !== 0o700n) throw endpointError('KSTACK_REFLEXION_MODE_MIGRATION_POST_APPLY');
      fs.fsyncSync(fd);
      const final = fs.lstatSync(location.kstackReal, { bigint: true });
      if (final.dev !== before.dev || final.ino !== before.ino) throw endpointError('KSTACK_REFLEXION_MODE_MIGRATION_POST_APPLY');
    }
    return Object.freeze({ kind: 'kstack-mode-migration-v1', dryRun, currentMode: Number(before.mode & 0o7777n), proposedMode: 0o700, applied });
  } catch (error) {
    if (applied && error.code !== 'KSTACK_REFLEXION_MODE_MIGRATION_POST_APPLY') throw endpointError('KSTACK_REFLEXION_MODE_MIGRATION_POST_APPLY');
    throw error;
  } finally { fs.closeSync(fd); }
}
