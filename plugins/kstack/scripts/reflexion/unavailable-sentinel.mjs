import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PARENT_BASENAME = '.codex-plugin';
const SENTINEL_BASENAME = 'reflexion-runtime-unavailable-v1';
const ARTIFACT_BASENAME = 'reflexion-runtime-contract-v1.txt';
const NOFOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const DIRECTORY = fs.constants.O_DIRECTORY ?? 0;
const DENIED_ENVIRONMENT = Object.freeze(['NODE_OPTIONS', 'NODE_PATH', 'NODE_ICU_DATA']);
const OPERATION_KEYS = Object.freeze([
  'realpathNative', 'lstatBigint', 'mkdir0700', 'open', 'fstatBigint', 'fchmod', 'fsync', 'close', 'unlink', 'getuid', 'platform', 'runtimeSnapshot'
]);

const REAL_OPERATIONS = Object.freeze({
  realpathNative: (target) => fs.realpathSync.native(target),
  lstatBigint: (target) => fs.lstatSync(target, { bigint: true }),
  mkdir0700: (target) => fs.mkdirSync(target, { mode: 0o700 }),
  open: (target, flags, mode) => fs.openSync(target, flags, mode),
  fstatBigint: (fd) => fs.fstatSync(fd, { bigint: true }),
  fchmod: (fd, mode) => fs.fchmodSync(fd, mode),
  fsync: (fd) => fs.fsyncSync(fd),
  close: (fd) => fs.closeSync(fd),
  unlink: (target) => fs.unlinkSync(target),
  getuid: () => process.getuid(),
  platform: () => process.platform,
  runtimeSnapshot: () => ({
    node: process.versions.node,
    v8: process.versions.v8,
    icu: process.versions.icu,
    unicode: process.versions.unicode,
    icuSmall: process.config.variables.icu_small,
    v8I18n: process.config.variables.v8_enable_i18n_support,
    execArgv: [...process.execArgv],
    environmentPresent: DENIED_ENVIRONMENT.filter((name) => process.env[name] !== undefined)
  })
});

const PHASE_EXIT = Object.freeze({
  entry: 64,
  'verify-runtime': 65,
  root: 66,
  'provision-parent': 67,
  'establish-create': 68,
  'establish-existing': 68,
  'invalidate-artifact': 69,
  'remove-sentinel': 68
});

export class UnavailableSentinelError extends Error {
  constructor(phase, operation, reason) {
    super('KSTACK_REFLEXION_SENTINEL_ERROR_V1');
    this.name = 'UnavailableSentinelError';
    this.phase = phase;
    this.operation = operation;
    this.reason = reason;
    this.exitCode = PHASE_EXIT[phase] ?? 70;
    Object.freeze(this);
  }
}

export function formatUnavailableSentinelError(error) {
  const safe = error instanceof UnavailableSentinelError ? error : new UnavailableSentinelError('entry', 'classifier', 'other');
  return `KSTACK_REFLEXION_SENTINEL_ERROR_V1 phase=${safe.phase} operation=${safe.operation} reason=${safe.reason}\n`;
}

function errnoReason(error) {
  if (error?.code === 'ENOENT') return 'missing';
  if (error?.code === 'EEXIST') return 'exists';
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return 'permission';
  if (error?.code === 'EIO' || error?.code === 'EUCLEAN' || error?.code === 'EREMOTEIO') return 'io';
  if (error?.code === 'ENOSYS' || error?.code === 'ENOTSUP' || error?.code === 'EOPNOTSUPP') return 'unsupported';
  return 'other';
}

function fail(phase, operation, reason) {
  throw new UnavailableSentinelError(phase, operation, reason);
}

function call(phase, operation, functionValue) {
  try { return functionValue(); } catch (error) {
    if (error instanceof UnavailableSentinelError) throw error;
    fail(phase, operation, errnoReason(error));
  }
}

export function makeUnavailableSentinelTestOperations(overrides = {}) {
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) throw new TypeError('invalid operations override');
  for (const key of Object.keys(overrides)) if (!OPERATION_KEYS.includes(key)) throw new TypeError(`unknown operations key: ${key}`);
  const operations = {};
  for (const key of OPERATION_KEYS) {
    const value = Object.hasOwn(overrides, key) ? overrides[key] : REAL_OPERATIONS[key];
    if (typeof value !== 'function') throw new TypeError(`invalid operations key: ${key}`);
    operations[key] = value;
  }
  return Object.freeze(operations);
}

function sameIdentity(left, right) {
  return left?.dev !== undefined && left?.ino !== undefined && left.dev !== 0n && left.ino !== 0n && left.dev === right?.dev && left.ino === right?.ino;
}

function isOwnedDirectory(stat, operations, exactMode = true) {
  return stat?.isDirectory?.() === true && stat?.isSymbolicLink?.() !== true
    && stat.uid === BigInt(operations.getuid())
    && (!exactMode || (stat.mode & 0o7777n) === 0o700n);
}

function isOwnedRegular(stat, operations, { exactMode = null, empty = false } = {}) {
  return stat?.isFile?.() === true && stat?.isSymbolicLink?.() !== true
    && stat.uid === BigInt(operations.getuid())
    && (exactMode === null || (stat.mode & 0o7777n) === BigInt(exactMode))
    && (!empty || stat.size === 0n);
}

function assertSupportedRuntime(operations, phase = 'verify-runtime') {
  const platform = call(phase, 'platform', () => operations.platform());
  if (platform === 'win32') fail(phase, 'platform', 'unsupported');
  const snapshot = call(phase, 'runtime-tuple', () => operations.runtimeSnapshot());
  if (!snapshot || !/^24\.12(?:\.|$)/u.test(snapshot.node ?? '') || !/^13\.6(?:\.|$)/u.test(snapshot.v8 ?? '')
      || !/^77\.1(?:\.|$)/u.test(snapshot.icu ?? '') || snapshot.unicode !== '16.0'
      || snapshot.icuSmall !== false || snapshot.v8I18n !== 1) {
    fail(phase, 'runtime-tuple', 'mismatch');
  }
  if (!Array.isArray(snapshot.execArgv) || snapshot.execArgv.length !== 0) fail(phase, 'exec-argv', 'mismatch');
  if (!Array.isArray(snapshot.environmentPresent) || snapshot.environmentPresent.length !== 0) fail(phase, 'environment', 'mismatch');
}

function validateRoot(installedRoot, operations, moduleUrl = null) {
  if (typeof installedRoot !== 'string' || !path.isAbsolute(installedRoot)) fail('root', 'grammar', 'mismatch');
  const rootReal = call('root', 'root-realpath', () => operations.realpathNative(installedRoot));
  if (rootReal !== path.resolve(installedRoot)) fail('root', 'root-realpath', 'mismatch');
  const rootStat = call('root', 'root-realpath', () => operations.lstatBigint(rootReal));
  if (rootStat?.isDirectory?.() !== true || rootStat?.isSymbolicLink?.() === true) fail('root', 'root-realpath', 'type');
  if (moduleUrl !== null) {
    const expected = path.join(rootReal, 'scripts', 'reflexion', 'unavailable-sentinel.mjs');
    const selfReal = call('root', 'self-realpath', () => operations.realpathNative(fileURLToPath(moduleUrl)));
    if (selfReal !== expected) fail('root', 'self-realpath', 'mismatch');
  }
  return rootReal;
}

function closeDescriptor(fd, operations, phase, primary = null) {
  try { operations.close(fd); } catch (error) {
    if (!primary) fail(phase, 'parent-close', errnoReason(error));
  }
}

function observeParent(parent, operations, phase, operation = 'parent-pre-lstat') {
  const pathnameStat = call(phase, operation, () => operations.lstatBigint(parent));
  if (!isOwnedDirectory(pathnameStat, operations)) {
    if (pathnameStat?.isDirectory?.() !== true || pathnameStat?.isSymbolicLink?.() === true) fail(phase, operation, 'type');
    if (pathnameStat.uid !== BigInt(operations.getuid())) fail(phase, operation, 'owner');
    fail(phase, operation, 'mode');
  }
  const fd = call(phase, 'parent-open', () => operations.open(parent, fs.constants.O_RDONLY | DIRECTORY | NOFOLLOW));
  let descriptorStat;
  try {
    descriptorStat = call(phase, 'parent-initial-fstat', () => operations.fstatBigint(fd));
    if (!isOwnedDirectory(descriptorStat, operations)) {
      if (descriptorStat?.isDirectory?.() !== true) fail(phase, 'parent-initial-fstat', 'type');
      if (descriptorStat.uid !== BigInt(operations.getuid())) fail(phase, 'parent-initial-fstat', 'owner');
      fail(phase, 'parent-initial-fstat', 'mode');
    }
    if (!sameIdentity(pathnameStat, descriptorStat)) fail(phase, 'parent-initial-fstat', 'identity');
    return { fd, stat: descriptorStat };
  } catch (error) {
    closeDescriptor(fd, operations, phase, error);
    throw error;
  }
}

function precommitParent(parentState, operations, phase) {
  const current = call(phase, 'parent-precommit-fstat', () => operations.fstatBigint(parentState.fd));
  if (!isOwnedDirectory(current, operations)) fail(phase, 'parent-precommit-fstat', 'mode');
  if (!sameIdentity(parentState.stat, current)) fail(phase, 'parent-precommit-fstat', 'identity');
}

export function verifyUnavailableRuntime(installedRoot, operations = REAL_OPERATIONS) {
  assertSupportedRuntime(operations);
  return validateRoot(installedRoot, operations);
}

export function provisionUnavailableParent(installedRoot, operations = REAL_OPERATIONS) {
  assertSupportedRuntime(operations);
  const rootReal = validateRoot(installedRoot, operations);
  const parent = path.join(rootReal, PARENT_BASENAME);
  let observed;
  try { observed = operations.lstatBigint(parent); } catch (error) {
    if (error?.code !== 'ENOENT') fail('provision-parent', 'parent-pre-lstat', errnoReason(error));
    try { operations.mkdir0700(parent); } catch (mkdirError) {
      if (mkdirError?.code !== 'EEXIST') fail('provision-parent', 'parent-mkdir', errnoReason(mkdirError));
    }
    observed = call('provision-parent', 'parent-pre-lstat', () => operations.lstatBigint(parent));
  }
  if (observed?.isDirectory?.() !== true || observed?.isSymbolicLink?.() === true) fail('provision-parent', 'parent-pre-lstat', 'type');
  if (observed.uid !== BigInt(operations.getuid())) fail('provision-parent', 'parent-pre-lstat', 'owner');
  const fd = call('provision-parent', 'parent-open', () => operations.open(parent, fs.constants.O_RDONLY | DIRECTORY | NOFOLLOW));
  let primary;
  try {
    const initial = call('provision-parent', 'parent-initial-fstat', () => operations.fstatBigint(fd));
    if (!isOwnedDirectory(initial, operations, false)) fail('provision-parent', 'parent-initial-fstat', initial?.isDirectory?.() ? 'owner' : 'type');
    if (!sameIdentity(observed, initial)) fail('provision-parent', 'parent-initial-fstat', 'identity');
    call('provision-parent', 'parent-fchmod', () => operations.fchmod(fd, 0o700));
    const changed = call('provision-parent', 'parent-post-fchmod-fstat', () => operations.fstatBigint(fd));
    if (!sameIdentity(initial, changed)) fail('provision-parent', 'parent-post-fchmod-fstat', 'identity');
    if (!isOwnedDirectory(changed, operations)) fail('provision-parent', 'parent-post-fchmod-fstat', (changed.mode & 0o7777n) !== 0o700n ? 'mode' : 'owner');
    call('provision-parent', 'parent-directory-fsync', () => operations.fsync(fd));
    const final = call('provision-parent', 'parent-post-lstat', () => operations.lstatBigint(parent));
    if (!sameIdentity(changed, final)) fail('provision-parent', 'parent-post-lstat', 'identity');
    if (!isOwnedDirectory(final, operations)) fail('provision-parent', 'parent-post-lstat', 'mode');
    return rootReal;
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    closeDescriptor(fd, operations, 'provision-parent', primary);
  }
}

function establishAtRoot(rootReal, operations) {
  const parent = path.join(rootReal, PARENT_BASENAME);
  const sentinel = path.join(parent, SENTINEL_BASENAME);
  const parentState = observeParent(parent, operations, 'establish-existing');
  let primary;
  let fileFd;
  let fileIdentity;
  try {
    let observed;
    let create = false;
    try { observed = operations.lstatBigint(sentinel); } catch (error) {
      if (error?.code !== 'ENOENT') fail('establish-existing', 'sentinel-pre-lstat', errnoReason(error));
      create = true;
    }
    if (!create && observed?.isFile?.() !== true) fail('establish-existing', 'sentinel-pre-lstat', 'obstructed');
    if (create) {
      try {
        fileFd = operations.open(sentinel, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NOFOLLOW, 0o600);
      } catch (error) {
        if (error?.code !== 'EEXIST') fail('establish-create', 'sentinel-create-open', errnoReason(error));
        observed = call('establish-existing', 'sentinel-pre-lstat', () => operations.lstatBigint(sentinel));
        if (observed?.isFile?.() !== true) fail('establish-existing', 'sentinel-pre-lstat', 'obstructed');
        create = false;
      }
    }
    const phase = create ? 'establish-create' : 'establish-existing';
    if (!create) fileFd = call(phase, 'sentinel-existing-open', () => operations.open(sentinel, fs.constants.O_WRONLY | NOFOLLOW));
    if (create) call(phase, 'sentinel-fchmod', () => operations.fchmod(fileFd, 0o600));
    const fileStat = call(phase, 'sentinel-fstat', () => operations.fstatBigint(fileFd));
    if (!isOwnedRegular(fileStat, operations, { exactMode: create ? 0o600 : null, empty: create })) {
      const reason = fileStat?.isFile?.() !== true ? 'type' : fileStat.uid !== BigInt(operations.getuid()) ? 'owner' : fileStat.size !== 0n ? 'size' : 'mode';
      fail(phase, 'sentinel-fstat', reason);
    }
    if (!create && !sameIdentity(observed, fileStat)) fail(phase, 'sentinel-fstat', 'identity');
    fileIdentity = fileStat;
    call(phase, 'sentinel-file-fsync', () => operations.fsync(fileFd));
    try { operations.close(fileFd); fileFd = undefined; } catch (error) { fail(phase, 'sentinel-close', errnoReason(error)); }
    precommitParent(parentState, operations, phase);
    call(phase, 'parent-directory-fsync', () => operations.fsync(parentState.fd));
    const final = call(phase, 'sentinel-post-lstat', () => operations.lstatBigint(sentinel));
    if (final?.isFile?.() !== true) fail(phase, 'sentinel-post-lstat', 'type');
    if (!sameIdentity(fileIdentity, final)) fail(phase, 'sentinel-post-lstat', 'identity');
    return rootReal;
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    if (fileFd !== undefined) closeDescriptor(fileFd, operations, 'establish-existing', primary);
    closeDescriptor(parentState.fd, operations, 'establish-existing', primary);
  }
}

export function establishUnavailableSentinel(installedRoot, operations = REAL_OPERATIONS) {
  assertSupportedRuntime(operations);
  return establishAtRoot(validateRoot(installedRoot, operations), operations);
}

export function invalidateRuntimeContract(installedRoot, operations = REAL_OPERATIONS) {
  assertSupportedRuntime(operations);
  const rootReal = validateRoot(installedRoot, operations);
  establishAtRoot(rootReal, operations);
  const parent = path.join(rootReal, PARENT_BASENAME);
  const artifact = path.join(parent, ARTIFACT_BASENAME);
  const parentState = observeParent(parent, operations, 'invalidate-artifact');
  let primary;
  try {
    let observed;
    try { observed = operations.lstatBigint(artifact); } catch (error) {
      if (error?.code !== 'ENOENT') fail('invalidate-artifact', 'artifact-pre-lstat', errnoReason(error));
    }
    if (observed !== undefined) call('invalidate-artifact', 'artifact-unlink', () => operations.unlink(artifact));
    precommitParent(parentState, operations, 'invalidate-artifact');
    call('invalidate-artifact', 'parent-directory-fsync', () => operations.fsync(parentState.fd));
    try {
      operations.lstatBigint(artifact);
      fail('invalidate-artifact', 'artifact-post-lstat', 'not-absent');
    } catch (error) {
      if (error instanceof UnavailableSentinelError) throw error;
      if (error?.code !== 'ENOENT') fail('invalidate-artifact', 'artifact-post-lstat', errnoReason(error));
    }
    return rootReal;
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    closeDescriptor(parentState.fd, operations, 'invalidate-artifact', primary);
  }
}

export function removeUnavailableSentinel(installedRoot, operations = REAL_OPERATIONS) {
  assertSupportedRuntime(operations);
  const rootReal = validateRoot(installedRoot, operations);
  const parent = path.join(rootReal, PARENT_BASENAME);
  const sentinel = path.join(parent, SENTINEL_BASENAME);
  const parentState = observeParent(parent, operations, 'remove-sentinel');
  let primary;
  try {
    const observed = call('remove-sentinel', 'sentinel-pre-lstat', () => operations.lstatBigint(sentinel));
    if (!isOwnedRegular(observed, operations)) fail('remove-sentinel', 'sentinel-pre-lstat', 'obstructed');
    precommitParent(parentState, operations, 'remove-sentinel');
    call('remove-sentinel', 'sentinel-remove-unlink', () => operations.unlink(sentinel));
    call('remove-sentinel', 'parent-directory-fsync', () => operations.fsync(parentState.fd));
    try {
      operations.lstatBigint(sentinel);
      fail('remove-sentinel', 'sentinel-absence-lstat', 'not-absent');
    } catch (error) {
      if (error instanceof UnavailableSentinelError) throw error;
      if (error?.code !== 'ENOENT') fail('remove-sentinel', 'sentinel-absence-lstat', errnoReason(error));
    }
    return rootReal;
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    closeDescriptor(parentState.fd, operations, 'remove-sentinel', primary);
  }
}

function classifyCanonicalPath(argv1, moduleUrl, operations = REAL_OPERATIONS) {
  if (typeof argv1 !== 'string' || argv1.length === 0 || typeof moduleUrl !== 'string' || !moduleUrl.startsWith('file:')) return 'unknown';
  try {
    const cwd = process.cwd();
    const modulePath = operations.realpathNative(fileURLToPath(moduleUrl));
    const argumentPath = operations.realpathNative(path.resolve(cwd, argv1));
    return modulePath === argumentPath ? 'direct' : 'proved-imported';
  } catch {
    return 'unknown';
  }
}

export function decideUnavailableSentinelStartup(entryValue, argv1, moduleUrl, operations = REAL_OPERATIONS) {
  const pathClass = classifyCanonicalPath(argv1, moduleUrl, operations);
  const entryKind = entryValue === true ? 'boolean-true' : entryValue === false ? 'boolean-false' : 'non-boolean';
  let action;
  if (entryValue === true) action = pathClass === 'proved-imported' ? 'entry-mismatch' : 'dispatch';
  else action = pathClass === 'proved-imported' ? 'silent-import' : 'entry-mismatch';
  return Object.freeze({ action, entryKind, pathClass });
}

function directMain(argv, moduleUrl) {
  if (process.execArgv.length !== 0) fail('entry', 'exec-argv', 'mismatch');
  if (DENIED_ENVIRONMENT.some((name) => process.env[name] !== undefined)) fail('entry', 'environment', 'mismatch');
  if (argv.length !== 3 || !['verify-runtime', 'provision-parent', 'invalidate'].includes(argv[0])
      || argv[1] !== '--installed-plugin-root' || typeof argv[2] !== 'string' || !path.isAbsolute(argv[2])) {
    fail('entry', 'grammar', 'mismatch');
  }
  assertSupportedRuntime(REAL_OPERATIONS);
  validateRoot(argv[2], REAL_OPERATIONS, moduleUrl);
  if (argv[0] === 'verify-runtime') verifyUnavailableRuntime(argv[2]);
  else if (argv[0] === 'provision-parent') provisionUnavailableParent(argv[2]);
  else invalidateRuntimeContract(argv[2]);
}

const entryValue = import.meta.main;
const moduleUrl = import.meta.url;
const argv1 = process.argv[1];
const startup = decideUnavailableSentinelStartup(entryValue, argv1, moduleUrl);
if (startup.action === 'entry-mismatch') {
  const error = new UnavailableSentinelError('entry', 'classifier', 'mismatch');
  process.stderr.write(formatUnavailableSentinelError(error));
  process.exitCode = error.exitCode;
} else if (startup.action === 'dispatch') {
  try {
    directMain(process.argv.slice(2), moduleUrl);
  } catch (error) {
    const safe = error instanceof UnavailableSentinelError ? error : new UnavailableSentinelError('entry', 'classifier', 'other');
    process.stderr.write(formatUnavailableSentinelError(safe));
    process.exitCode = safe.exitCode;
  }
}
