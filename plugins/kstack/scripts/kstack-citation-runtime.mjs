import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import {
  EXHAUSTION_LEASE_MS, canonicalJson, parseCanonicalReceiptV1, parseCanonicalStateRecordV2,
  authenticateStateRecordV1, signStateRecordV1, stageOneAdvisoryPrefilterV1,
  formatOrdinaryAdvisoryLine, platformReceiptBindingV1, localGateInstanceIdBindingV1,
  nextSmokeCycleCountersV1, validateStateRecordV2, STATE_SCHEMA_VERSION, RECEIPT_ENCODING_VERSION
  ,classifyInstanceKeyStoreV1
} from './kstack-citation-state.mjs';
import { ensureCitationNativeReadyV1, resetCitationNativeBuildV1 } from './kstack-citation-native.mjs';
import { PACKET_CANONICALIZATION_VERSION, PACKET_SERIALIZATION_VERSION, PACKET_FRAMING_VERSION, sha256 } from './kstack-citation-grounding.mjs';

export const CITATION_STATE_FILE = 'citation-grounding-v1.json';
export const CITATION_RECEIPT_FILE = 'citation-grounding-platform-receipt-v1.json';
export const CITATION_COORDINATOR_LOCK = 'citation-grounding-coordinator-v1.lock';
export const CITATION_STAGING_ROOT = 'citation-staging-v1';

const FS_TYPES = new Map([
  [0x01021997n, 'linux-9p'], [0x0000ef53n, 'linux-ext'], [0x58465342n, 'linux-xfs'],
  [0x9123683en, 'linux-btrfs'], [0x01021994n, 'linux-tmpfs'], [0x794c7630n, 'linux-overlay'],
  [0x00006969n, 'linux-nfs'], [0xff534d42n, 'linux-cifs'], [0x65735546n, 'linux-fuse'],
  [0x7366746en, 'linux-ntfs3'], [0x2011bab0n, 'linux-exfat']
]);
const HARD_TYPES = new Set(['linux-ext', 'linux-xfs', 'linux-btrfs', 'linux-tmpfs', 'linux-overlay', 'linux-ntfs3', 'linux-exfat']);
const BEST_EFFORT_TYPES = new Set(['linux-9p', 'linux-nfs', 'linux-cifs', 'linux-fuse']);
const MAX_STAGING_AGE_MS = 24 * 60 * 60 * 1000;

function runtimeError(reason, detail) { return Object.assign(new Error(reason), { code: reason, reason, detail }); }
function nowIso(now = new Date()) { return new Date(now).toISOString(); }
function exactKeys(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0'); }

function atomicWrite(file, bytes, mode = 0o600) {
  const directory = path.dirname(file);
  let temporary;
  let fd;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    temporary = path.join(directory, `.citation-grounding-${crypto.randomBytes(16).toString('hex')}.tmp`);
    try { fd = fs.openSync(temporary, 'wx', mode); break; } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  if (fd === undefined) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'TEMP_NAME_EXHAUSTED');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
  const directoryFd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
  try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
  if (!fs.readFileSync(file).equals(bytes)) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR');
}

function statePaths(projectRoot) {
  const stateDirectory = path.join(projectRoot, '.kstack', 'state');
  return {
    stateDirectory,
    stateFile: path.join(stateDirectory, CITATION_STATE_FILE),
    receiptFile: path.join(stateDirectory, CITATION_RECEIPT_FILE),
    lockFile: path.join(stateDirectory, CITATION_COORDINATOR_LOCK),
    stagingRoot: path.join(stateDirectory, CITATION_STAGING_ROOT)
  };
}

function readCanonicalState(file) {
  try { return parseCanonicalStateRecordV2(fs.readFileSync(file)); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error.code === 'STATE_MALFORMED' ? error : runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR'); }
}

export function readCitationStageOneV1(projectRoot, now = new Date()) {
  const { stateFile } = statePaths(projectRoot);
  let record;
  try { record = readCanonicalState(stateFile); }
  catch (error) { return { outcome: 'error', reason: error.code === 'STATE_MALFORMED' ? 'STATE_MALFORMED' : 'PLATFORM_PRECONDITION_FAILED', detail: error.detail }; }
  return stageOneAdvisoryPrefilterV1(record, now);
}

function inspectDirectory(nativeContext, directory) {
  const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const result = nativeContext.addon.inspectDirectoryFd(fd);
    if (!exactKeys(result, ['abiVersion', 'platform', 'pathRaw', 'deviceId', 'fileIdentity', 'filesystemTypeRaw'])
        || result.abiVersion !== 'kstack-citation-fs-native-abi-v2' || result.platform !== 'linux' || typeof result.deviceId !== 'bigint' || typeof result.filesystemTypeRaw !== 'bigint') throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR');
    const filesystemType = FS_TYPES.get(BigInt.asUintN(64, result.filesystemTypeRaw));
    if (!filesystemType) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'UNSUPPORTED_FILESYSTEM_TYPE');
    return { ...result, filesystemType };
  } finally { fs.closeSync(fd); }
}

function ensureStateDirectory(projectRoot, nativeContext) {
  const paths = statePaths(projectRoot);
  fs.mkdirSync(paths.stateDirectory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(paths.stateDirectory, 0o700); } catch {}
  const observation = inspectDirectory(nativeContext, paths.stateDirectory);
  if (!HARD_TYPES.has(observation.filesystemType) && !BEST_EFFORT_TYPES.has(observation.filesystemType)) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'UNSUPPORTED_FILESYSTEM_TYPE');
  if (BEST_EFFORT_TYPES.has(observation.filesystemType) && !HARD_TYPES.has(nativeContext.buildCacheFilesystemType)) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'MODE_OWNERSHIP_UNENFORCEABLE');
  fs.mkdirSync(paths.stagingRoot, { mode: 0o700, recursive: true });
  return { paths, observation, protectionBestEffort: BEST_EFFORT_TYPES.has(observation.filesystemType) };
}

function trustedOwner(stat) { return stat.uid === BigInt(process.geteuid()) || stat.uid === 0n; }
function validateAncestry(candidate, privateFrom) {
  let current = path.resolve(candidate);
  while (true) {
    const stat = fs.lstatSync(current, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || !trustedOwner(stat) || (stat.mode & 0o22n) !== 0n) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
    if (privateFrom && (current === privateFrom || current.startsWith(`${privateFrom}${path.sep}`)) && (stat.uid !== BigInt(process.geteuid()) || (stat.mode & 0o7777n) !== 0o700n)) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
    if (current === path.dirname(current)) break;
    current = path.dirname(current);
  }
}

export function instanceStorePathV1() {
  const user = os.userInfo();
  if (typeof process.geteuid !== 'function' || user.uid !== process.geteuid() || !path.isAbsolute(user.homedir) || path.normalize(user.homedir) !== user.homedir || user.homedir.includes('\0')) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
  return path.join(user.homedir, '.local', 'state', 'kstack', 'citation-grounding');
}

export function readOrCreateInstanceKeyV1(nativeContext, { create = false, instanceStoreRoot } = {}) {
  const directory = instanceStoreRoot ?? instanceStorePathV1();
  const privateRoot = path.join(path.dirname(directory), 'kstack');
  const nearest = (() => { let candidate = directory; while (!fs.existsSync(candidate)) candidate = path.dirname(candidate); return candidate; })();
  const nearestFd = fs.openSync(nearest, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    classifyInstanceKeyStoreV1({ addon: nativeContext.addon, heldAncestorFd: nearestFd });
  } finally { fs.closeSync(nearestFd); }
  validateAncestry(nearest);
  if (!fs.existsSync(directory)) {
    if (!create) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    for (const item of [privateRoot, directory]) if (fs.existsSync(item)) fs.chmodSync(item, 0o700);
  }
  validateAncestry(directory, privateRoot);
  const file = path.join(directory, 'local-gate-instance-id-v1');
  if (!fs.existsSync(file)) {
    if (!create) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, crypto.randomBytes(16)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  const stat = fs.lstatSync(file, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n || stat.uid !== BigInt(process.geteuid()) || (stat.mode & 0o7777n) !== 0o600n || stat.size !== 16n) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
  const key = fs.readFileSync(file);
  if (key.length !== 16) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
  return key;
}

function resolveExecutable(command, cwd) {
  const candidates = path.isAbsolute(command) ? [command] : (process.env.PATH ?? '').split(path.delimiter).filter(Boolean).map((root) => path.resolve(root, command));
  for (const candidate of candidates) {
    try {
      const canonical = fs.realpathSync.native(candidate);
      const stat = fs.lstatSync(canonical, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || !trustedOwner(stat) || (stat.mode & 0o22n) !== 0n) continue;
      fs.accessSync(canonical, fs.constants.X_OK);
      return { path: canonical, stat, cwd: fs.realpathSync.native(cwd) };
    } catch {}
  }
  throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'VERSION_PROBE_FAILED');
}

async function versionProbe(executable, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['--version'], { cwd, shell: false, env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C', LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks = [];
    let length = 0;
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(runtimeError('PLATFORM_PRECONDITION_FAILED', 'VERSION_PROBE_FAILED')); }, 5000);
    child.stdout.on('data', (chunk) => { length += chunk.length; if (length > 4096) child.kill('SIGKILL'); else chunks.push(chunk); });
    child.once('error', () => { clearTimeout(timer); reject(runtimeError('PLATFORM_PRECONDITION_FAILED', 'VERSION_PROBE_FAILED')); });
    child.once('close', (code) => {
      clearTimeout(timer);
      const text = Buffer.concat(chunks).toString('utf8').trim();
      code === 0 && text.length > 0 && !text.includes('\n') ? resolve(text) : reject(runtimeError('PLATFORM_PRECONDITION_FAILED', 'VERSION_PROBE_FAILED'));
    });
  });
}

export async function authorizeCitationProviderInputsV1(projectRoot, config, configBytes) {
  const configPath = path.join(projectRoot, '.kstack', 'config.json');
  const configStat = fs.lstatSync(configPath, { bigint: true });
  if (!configStat.isFile() || configStat.isSymbolicLink() || configStat.nlink !== 1n || !trustedOwner(configStat) || (configStat.mode & 0o22n) !== 0n || !fs.readFileSync(configPath).equals(configBytes)) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR');
  const providers = [];
  for (const providerId of ['codex', 'opus']) {
    const model = config.models[providerId];
    const executable = resolveExecutable(model.command, projectRoot);
    const cliSdkVersion = await versionProbe(executable.path, projectRoot);
    providers.push({ providerId, executablePath: executable.path, canonicalCwd: executable.cwd, argv: [...model.args], cliSdkVersion, executableDigest: sha256(fs.readFileSync(executable.path)) });
  }
  return providers;
}

function fingerprintV1(key, configBytes, nativeContext, providers) {
  const recipe = fs.readFileSync(new URL('../native/citation-fs-native/target-recipes/linux-v1.json', import.meta.url));
  const message = Buffer.from(canonicalJson({
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    nativeAddonBinding: nativeContext.nativeAddonBinding,
    buildCacheBinding: { root: nativeContext.buildCacheRoot, device: nativeContext.buildCacheDevice, filesystemType: nativeContext.buildCacheFilesystemType },
    configDigest: sha256(configBytes), providerConfigurations: providers,
    packetVersions: [PACKET_CANONICALIZATION_VERSION, PACKET_SERIALIZATION_VERSION, PACKET_FRAMING_VERSION],
    targetRecipeDigest: sha256(recipe)
  }));
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

function buildReceipt(context, deploymentFingerprint) {
  return {
    encodingVersion: RECEIPT_ENCODING_VERSION,
    preconditionVersion: 'kstack-citation-filesystem-precondition-v1',
    nativeAddonBinding: structuredClone(context.nativeContext.nativeAddonBinding),
    stateDirectoryPath: context.state.observation.pathRaw,
    stateDirectoryDevice: context.state.observation.deviceId.toString(),
    filesystemType: context.state.observation.filesystemType,
    buildCacheRoot: context.nativeContext.buildCacheRoot,
    buildCacheDevice: context.nativeContext.buildCacheDevice,
    buildCacheFilesystemType: context.nativeContext.buildCacheFilesystemType,
    deploymentFingerprint
  };
}

function readReceipt(file) {
  try { return parseCanonicalReceiptV1(fs.readFileSync(file)); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function acquireCoordinatorLock(paths) {
  const raw = Buffer.from(canonicalJson({ lockVersion: 'kstack-citation-coordinator-lock-v1', lockId: crypto.randomBytes(16).toString('hex'), pid: process.pid, hostname: os.hostname(), acquiredAt: new Date().toISOString() }));
  const started = Date.now();
  while (true) {
    try { const fd = fs.openSync(paths.lockFile, 'wx', 0o600); fs.writeFileSync(fd, raw); fs.fsyncSync(fd); fs.closeSync(fd); break; }
    catch (error) {
      if (error.code !== 'EEXIST' || Date.now() - started >= 2500) throw runtimeError(error.code === 'EEXIST' ? 'LOCK_CONTENTION' : 'PLATFORM_PRECONDITION_FAILED', error.code === 'EEXIST' ? undefined : 'PROBE_IO_ERROR');
      try {
        if (Date.now() - fs.statSync(paths.lockFile).mtimeMs >= 90_000) { const tombstone = `${paths.lockFile}.reset-tombstone-coordinator-lock-${crypto.randomBytes(16).toString('hex')}`; fs.renameSync(paths.lockFile, tombstone); fs.unlinkSync(tombstone); continue; }
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const worker = new Worker(new URL('../native/citation-fs-native/target-recipes/heartbeat-worker.mjs', import.meta.url), { workerData: { path: paths.lockFile, bytes: raw.toString('base64'), intervalMs: 5000 } });
  await new Promise((resolve, reject) => { worker.once('message', (message) => message.type === 'heartbeat' ? resolve() : reject(runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR'))); worker.once('error', reject); });
  return async () => {
    await new Promise((resolve) => { worker.once('message', resolve); worker.postMessage('stop'); });
    await worker.terminate();
    if (!fs.readFileSync(paths.lockFile).equals(raw)) throw runtimeError('LOCK_CONTENTION');
    fs.unlinkSync(paths.lockFile);
  };
}

async function createContext(projectRoot, config, configBytes, options = {}) {
  if (!options.gitProof) {
    const pathsToCheck = ['.kstack/state/citation-grounding-v1.json', '.kstack/state/citation-grounding-platform-receipt-v1.json', '.kstack/state/citation-staging-v1', '.kstack/native-build'];
    for (const relative of pathsToCheck) {
      const ignored = spawnSync('git', ['-C', projectRoot, 'check-ignore', '-q', '--no-index', relative], { stdio: 'ignore' });
      const tracked = spawnSync('git', ['-C', projectRoot, 'ls-files', '--error-unmatch', '--', relative], { stdio: 'ignore' });
      if (ignored.status !== 0 || tracked.status === 0 || ignored.error || tracked.error) throw runtimeError('STATE_NOT_QUALIFIED', 'GIT_CHECK_IMPOSSIBLE');
    }
  }
  const nativeContext = options.nativeContext ?? await ensureCitationNativeReadyV1(options.nativeOptions);
  const state = ensureStateDirectory(projectRoot, nativeContext);
  const key = options.instanceKey
    ? Buffer.from(options.instanceKey)
    : readOrCreateInstanceKeyV1(nativeContext, { create: options.createInstanceKey === true, instanceStoreRoot: options.instanceStoreRoot });
  if (key.length !== 16) { key.fill(0); throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE'); }
  const providers = options.authorizedProviders ?? await authorizeCitationProviderInputsV1(projectRoot, config, configBytes);
  const deploymentFingerprint = fingerprintV1(key, configBytes, nativeContext, providers);
  const instanceBinding = localGateInstanceIdBindingV1(key);
  const receipt = buildReceipt({ nativeContext, state }, deploymentFingerprint);
  return { projectRoot, config, configBytes, nativeContext, state, key, providers, deploymentFingerprint, instanceBinding, receipt, receiptBinding: platformReceiptBindingV1(receipt) };
}

export async function checkCitationPlatformV1({ projectRoot, config, configBytes, ...options }) {
  const context = await createContext(projectRoot, config, configBytes, { ...options, createInstanceKey: true });
  const probe = path.join(context.state.paths.stateDirectory, `citation-grounding-probe-${crypto.randomBytes(16).toString('hex')}`);
  fs.mkdirSync(probe, { mode: 0o700 });
  try {
    const directoryFd = fs.openSync(probe, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
    try { fs.fsyncSync(directoryFd); } catch (error) { if (['EINVAL', 'ENOSYS', 'ENOTSUP', 'EOPNOTSUPP'].includes(error.code)) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'DIRECTORY_FSYNC_REJECTED'); throw error; }
    finally { fs.closeSync(directoryFd); }
    const exclusive = path.join(probe, 'exclusive');
    const exclusiveFd = fs.openSync(exclusive, 'wx', 0o600); fs.closeSync(exclusiveFd);
    try { const duplicate = fs.openSync(exclusive, 'wx', 0o600); fs.closeSync(duplicate); throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'O_EXCL_BROKEN'); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const before = fs.statSync(exclusive, { bigint: true });
    const renamed = path.join(probe, 'renamed');
    fs.renameSync(exclusive, renamed);
    const after = fs.statSync(renamed, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'INODE_IDENTITY_UNSTABLE');
    const heartbeatFd = fs.openSync(renamed, 'r+');
    const stamp = new Date('2001-02-03T04:05:07.000Z');
    fs.futimesSync(heartbeatFd, stamp, stamp); fs.closeSync(heartbeatFd);
    fs.utimesSync(renamed, stamp, stamp);
    if (fs.statSync(renamed).mtimeMs !== stamp.getTime()) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'PATH_TIMESTAMP_UPDATE_BROKEN');
    const inherited = path.join(probe, 'inherited');
    fs.writeFileSync(inherited, 'citation-fd-probe', { mode: 0o600 });
    const inheritedFd = fs.openSync(inherited, 'r');
    fs.unlinkSync(inherited);
    const childResult = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['-e', 'const fs=require("fs");process.stdout.write(fs.readFileSync(3))'], { stdio: ['ignore', 'pipe', 'ignore', inheritedFd] });
      const chunks = []; child.stdout.on('data', (chunk) => chunks.push(chunk)); child.once('close', (code) => resolve({ code, bytes: Buffer.concat(chunks) }));
    });
    fs.closeSync(inheritedFd);
    if (childResult.code !== 0 || childResult.bytes.toString() !== 'citation-fd-probe') throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'INHERITED_FD_UNLINK_READ_BROKEN');
    atomicWrite(context.state.paths.receiptFile, Buffer.from(canonicalJson(context.receipt)));
    return { status: 'pass', receipt: context.receipt, protectionBestEffort: context.state.protectionBestEffort };
  } catch (error) {
    if (error.reason) throw error;
    throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR');
  } finally {
    context.key.fill(0);
    try { for (const name of fs.readdirSync(probe)) fs.unlinkSync(path.join(probe, name)); fs.rmdirSync(probe); } catch {}
  }
}

export async function repairCitationInstanceStoreV1({ nativeContext, regenerate = false, instanceStoreRoot } = {}) {
  const context = nativeContext ?? await ensureCitationNativeReadyV1();
  const directory = instanceStoreRoot ?? instanceStorePathV1();
  const file = path.join(directory, 'local-gate-instance-id-v1');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(path.join(path.dirname(directory), 'kstack'), 0o700);
  fs.chmodSync(directory, 0o700);
  if (fs.existsSync(file)) {
    const bytes = fs.readFileSync(file);
    if (bytes.length === 16) { fs.chmodSync(file, 0o600); const key = readOrCreateInstanceKeyV1(context, { instanceStoreRoot: directory }); key.fill(0); return { status: 'preserved' }; }
    if (!regenerate) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'LOCAL_INSTANCE_STORE_UNAVAILABLE');
  } else if (!regenerate) {
    const key = readOrCreateInstanceKeyV1(context, { create: true, instanceStoreRoot: directory }); key.fill(0); return { status: 'created' };
  }
  const replacement = crypto.randomBytes(16);
  atomicWrite(file, replacement);
  fs.chmodSync(file, 0o600);
  replacement.fill(0);
  return { status: 'regenerated', qualificationsStale: true };
}

export async function repairCitationStateProtectionV1({ projectRoot }) {
  const paths = statePaths(projectRoot);
  const before = fs.readFileSync(paths.stateFile);
  parseCanonicalStateRecordV2(before);
  const second = fs.readFileSync(paths.stateFile);
  if (!before.equals(second)) throw runtimeError('LOCK_CONTENTION');
  fs.chmodSync(paths.stateFile, 0o600);
  fs.chmodSync(paths.stateDirectory, 0o700);
  if (!fs.readFileSync(paths.stateFile).equals(before)) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR');
  return { status: 'repaired' };
}

function authenticateCurrentState(record, context, telemetry) {
  if (!record) return { status: 'authenticated-absence' };
  const authenticated = authenticateStateRecordV1(record, context.key, { telemetry });
  if (authenticated.status !== 'authenticated') return authenticated;
  if (canonicalJson(record.localGateInstanceIdBinding) !== canonicalJson(context.instanceBinding)) return { status: 'authenticated-absence', bindingMismatch: true };
  return authenticated;
}

function stateFailure(record, authenticated, context, receipt, now = new Date()) {
  if (!record) return { reason: 'STATE_NOT_QUALIFIED' };
  if (authenticated.status !== 'authenticated') return { reason: 'STATE_NOT_QUALIFIED', detail: 'FINGERPRINT_MISMATCH' };
  if (record.deploymentFingerprint !== context.deploymentFingerprint || canonicalJson(record.localGateInstanceIdBinding) !== canonicalJson(context.instanceBinding)) return { reason: 'STATE_NOT_QUALIFIED', detail: 'FINGERPRINT_MISMATCH' };
  if (!receipt || canonicalJson(platformReceiptBindingV1(receipt)) !== canonicalJson(record.platformReceiptBinding)) return { reason: 'STATE_NOT_QUALIFIED', detail: 'PLATFORM_RECEIPT_MISMATCH' };
  const nowMs = Number(now);
  for (const value of [record.smoke.completedAt, record.shadow.completedAt].filter(Boolean)) {
    if (Date.parse(value) > nowMs) return { reason: 'STATE_MALFORMED' };
    if (Date.parse(value) + EXHAUSTION_LEASE_MS <= nowMs) return { reason: 'STATE_EXPIRED' };
  }
  if (record.advisoryRunsSinceGo >= 50) return { reason: 'STATE_RUN_LIMIT_REACHED' };
  if (record.mutationInProgress) return { reason: 'STATE_NOT_QUALIFIED', detail: 'MUTATION_IN_PROGRESS' };
  if (record.smoke.result !== 'pass' || record.shadow.judgment !== 'go') return { reason: 'STATE_NOT_QUALIFIED', detail: 'QUALIFICATION_ABSENT' };
  return null;
}

export async function qualifyOrdinaryCitationAdvisoryV1({ projectRoot, config, configBytes, now = new Date(), ...options }) {
  const stageOne = readCitationStageOneV1(projectRoot, now);
  if (stageOne.outcome === 'reject') return { effective: false, route: 'legacy_direct', line: formatOrdinaryAdvisoryLine({ stageOneToken: stageOne.token }), stageOne };
  if (stageOne.outcome === 'error') return { effective: false, route: 'legacy_direct', line: formatOrdinaryAdvisoryLine({ reason: stageOne.reason, detail: stageOne.detail }), stageOne };
  let context;
  try { context = await createContext(projectRoot, config, configBytes, options); }
  catch (error) {
    if (error.code === 'STATE_NOT_QUALIFIED') return { effective: false, route: 'legacy_direct', line: formatOrdinaryAdvisoryLine({ reason: 'STATE_NOT_QUALIFIED', detail: error.detail }) };
    const detail = error.code === 'NATIVE_ADDON_UNAVAILABLE' ? 'NATIVE_ADDON_UNAVAILABLE' : error.detail ?? 'PROBE_IO_ERROR';
    return { effective: false, route: 'legacy_direct', line: formatOrdinaryAdvisoryLine({ reason: 'PLATFORM_PRECONDITION_FAILED', detail }), nativeReason: error.reason, nativeComponent: error.component };
  }
  const telemetry = { stateMacVerificationFailures: 0, eventLines: [] };
  const receipt = readReceipt(context.state.paths.receiptFile);
  const unlocked = readCanonicalState(context.state.paths.stateFile);
  const unlockedAuth = authenticateCurrentState(unlocked, context, telemetry);
  const failure = stateFailure(unlocked, unlockedAuth, context, receipt, now);
  if (failure) { context.key.fill(0); return { effective: false, route: 'legacy_direct', line: formatOrdinaryAdvisoryLine(failure), telemetry }; }
  let release;
  try {
    release = await acquireCoordinatorLock(context.state.paths);
    const locked = readCanonicalState(context.state.paths.stateFile);
    const lockedAuth = authenticateCurrentState(locked, context, telemetry);
    const lockedFailure = stateFailure(locked, lockedAuth, context, receipt, now);
    if (lockedFailure) return { effective: false, route: 'legacy_direct', line: formatOrdinaryAdvisoryLine(lockedFailure), telemetry };
    const successor = signStateRecordV1({ ...locked, stateGeneration: Math.min(locked.stateGeneration + 1, Number.MAX_SAFE_INTEGER), advisoryRunsSinceGo: locked.advisoryRunsSinceGo + 1 }, context.key);
    if (!validateStateRecordV2(successor)) throw new Error('CITATION_GROUNDING_INTERNAL_ERROR');
    atomicWrite(context.state.paths.stateFile, Buffer.from(canonicalJson(successor)));
    return { effective: true, route: 'grounding_v2', context: { ...context, key: undefined, providerAuthorizationInjected: Boolean(options.authorizedProviders) }, telemetry, reservation: successor.advisoryRunsSinceGo };
  } catch (error) {
    if (error.code === 'LOCK_CONTENTION') return { effective: false, route: 'legacy_direct', line: formatOrdinaryAdvisoryLine({ reason: 'LOCK_CONTENTION' }), telemetry };
    throw error;
  } finally {
    if (release) await release();
    context.key.fill(0);
  }
}

function emptySmoke(startedAt, counters, fixtureHash) {
  return { result: 'not_run', smokeStartsThisCycle: counters.smokeStartsThisCycle, attemptOrdinal: counters.attemptOrdinal, fixtureHash, startedAt, completedAt: null, providerResultHashes: [null, null], providerStructuralCompleteness: [false, false], providerExactMatchCounts: [0, 0], combinedExactMatchCount: 0, providerOrdinaryProseMismatchCounts: [0, 0], combinedOrdinaryProseMismatchCount: 0 };
}
function emptyShadow() { return { judgment: 'not_run', dualRuns: 0, reasonCodes: [], completedAt: null }; }

export async function runCitationSmokeV1({ projectRoot, config, configBytes, fixtureBytes, runProviders, now = new Date(), ...options }) {
  const context = await createContext(projectRoot, config, configBytes, { ...options, createInstanceKey: true });
  atomicWrite(context.state.paths.receiptFile, Buffer.from(canonicalJson(context.receipt)));
  const mutationId = crypto.randomBytes(16).toString('hex');
  let release = await acquireCoordinatorLock(context.state.paths);
  let start;
  try {
    const record = readCanonicalState(context.state.paths.stateFile);
    const authenticated = authenticateCurrentState(record, context, { stateMacVerificationFailures: 0, eventLines: [] });
    const counters = nextSmokeCycleCountersV1(authenticated, context.deploymentFingerprint, now);
    start = signStateRecordV1({ stateSchemaVersion: STATE_SCHEMA_VERSION, deploymentFingerprint: context.deploymentFingerprint, platformReceiptBinding: context.receiptBinding, localGateInstanceIdBinding: context.instanceBinding, stateGeneration: counters.stateGeneration, mutationInProgress: { kind: 'smoke', mutationId, startedAt: nowIso(now) }, smoke: emptySmoke(nowIso(now), counters, sha256(fixtureBytes)), shadow: emptyShadow(), advisoryRunsSinceGo: 0 }, context.key);
    if (!validateStateRecordV2(start)) throw new Error('CITATION_GROUNDING_INTERNAL_ERROR');
    atomicWrite(context.state.paths.stateFile, Buffer.from(canonicalJson(start)));
  } finally { await release(); }
  let results;
  try { results = await runProviders({ context, fixtureBytes, attemptOrdinal: start.smoke.attemptOrdinal }); }
  catch (error) { context.key.fill(0); throw error; }
  const summaries = results.map((result) => ({ hash: result.rawBytes ? sha256(result.rawBytes) : null, complete: result.structurallyComplete === true, exact: result.exactMatchCount ?? 0, prose: result.ordinaryProseMismatchCount ?? 0 }));
  const passes = summaries.every((item) => item.hash && item.complete && item.exact >= 49 && item.prose === 0);
  release = await acquireCoordinatorLock(context.state.paths);
  try {
    const record = readCanonicalState(context.state.paths.stateFile);
    const authenticated = authenticateCurrentState(record, context, { stateMacVerificationFailures: 0, eventLines: [] });
    if (authenticated.status !== 'authenticated' || record.mutationInProgress?.mutationId !== mutationId) throw runtimeError('STATE_NOT_QUALIFIED', 'MUTATION_IN_PROGRESS');
    const smoke = { ...record.smoke, result: passes ? 'pass' : 'fail', smokeStartsThisCycle: passes ? 0 : record.smoke.smokeStartsThisCycle, completedAt: nowIso(now), providerResultHashes: summaries.map((item) => item.hash), providerStructuralCompleteness: summaries.map((item) => item.complete), providerExactMatchCounts: summaries.map((item) => item.exact), combinedExactMatchCount: summaries.reduce((sum, item) => sum + item.exact, 0), providerOrdinaryProseMismatchCounts: summaries.map((item) => item.prose), combinedOrdinaryProseMismatchCount: summaries.reduce((sum, item) => sum + item.prose, 0) };
    const terminal = signStateRecordV1({ ...record, stateGeneration: Math.min(record.stateGeneration + 1, Number.MAX_SAFE_INTEGER), mutationInProgress: null, smoke }, context.key);
    if (!validateStateRecordV2(terminal)) throw new Error('CITATION_GROUNDING_INTERNAL_ERROR');
    atomicWrite(context.state.paths.stateFile, Buffer.from(canonicalJson(terminal)));
    return { status: passes ? 'pass' : 'fail', state: terminal, protectionBestEffort: context.state.protectionBestEffort };
  } finally { await release(); context.key.fill(0); }
}

export async function runCitationShadowV1({ projectRoot, config, configBytes, dualRuns, judgment, reasonCodes = [], runRepresentative, now = new Date(), ...options }) {
  if (!Number.isInteger(dualRuns) || dualRuns < 5 || dualRuns > 10 || !['go', 'no-go'].includes(judgment)) throw new Error('invalid shadow parameters');
  const context = await createContext(projectRoot, config, configBytes, options);
  atomicWrite(context.state.paths.receiptFile, Buffer.from(canonicalJson(context.receipt)));
  const mutationId = crypto.randomBytes(16).toString('hex');
  let release = await acquireCoordinatorLock(context.state.paths);
  try {
    const record = readCanonicalState(context.state.paths.stateFile);
    const authenticated = authenticateCurrentState(record, context, { stateMacVerificationFailures: 0, eventLines: [] });
    if (authenticated.status !== 'authenticated') throw runtimeError('STATE_NOT_QUALIFIED', record ? 'FINGERPRINT_MISMATCH' : 'QUALIFICATION_ABSENT');
    if (record.deploymentFingerprint !== context.deploymentFingerprint || canonicalJson(record.localGateInstanceIdBinding) !== canonicalJson(context.instanceBinding)) throw runtimeError('STATE_NOT_QUALIFIED', 'FINGERPRINT_MISMATCH');
    if (canonicalJson(record.platformReceiptBinding) !== canonicalJson(context.receiptBinding)) throw runtimeError('STATE_NOT_QUALIFIED', 'PLATFORM_RECEIPT_MISMATCH');
    if (record.smoke.result !== 'pass') throw runtimeError('STATE_NOT_QUALIFIED', record.mutationInProgress ? 'MUTATION_IN_PROGRESS' : 'QUALIFICATION_ABSENT');
    if (Date.parse(record.smoke.completedAt) > Number(now)) throw runtimeError('STATE_MALFORMED');
    if (Date.parse(record.smoke.completedAt) + EXHAUSTION_LEASE_MS <= Number(now)) throw runtimeError('STATE_EXPIRED');
    if (record.mutationInProgress?.kind === 'smoke') throw runtimeError('STATE_NOT_QUALIFIED', 'MUTATION_IN_PROGRESS');
    const start = signStateRecordV1({ ...record, stateGeneration: Math.min(record.stateGeneration + 1, Number.MAX_SAFE_INTEGER), mutationInProgress: { kind: 'shadow', mutationId, startedAt: nowIso(now) }, shadow: emptyShadow(), advisoryRunsSinceGo: record.advisoryRunsSinceGo < 50 ? 0 : 50 }, context.key);
    atomicWrite(context.state.paths.stateFile, Buffer.from(canonicalJson(start)));
  } finally { await release(); }
  try { for (let index = 0; index < dualRuns; index += 1) await runRepresentative({ context, index }); }
  catch (error) { context.key.fill(0); throw error; }
  release = await acquireCoordinatorLock(context.state.paths);
  try {
    const record = readCanonicalState(context.state.paths.stateFile);
    const authenticated = authenticateCurrentState(record, context, { stateMacVerificationFailures: 0, eventLines: [] });
    if (authenticated.status !== 'authenticated' || record.mutationInProgress?.mutationId !== mutationId) throw runtimeError('STATE_NOT_QUALIFIED', 'MUTATION_IN_PROGRESS');
    const terminal = signStateRecordV1({ ...record, stateGeneration: Math.min(record.stateGeneration + 1, Number.MAX_SAFE_INTEGER), mutationInProgress: null, shadow: { judgment, dualRuns, reasonCodes, completedAt: nowIso(now) } }, context.key);
    if (!validateStateRecordV2(terminal)) throw new Error('CITATION_GROUNDING_INTERNAL_ERROR');
    atomicWrite(context.state.paths.stateFile, Buffer.from(canonicalJson(terminal)));
    return { status: judgment, state: terminal, protectionBestEffort: context.state.protectionBestEffort };
  } finally { await release(); context.key.fill(0); }
}

export function prepareCitationProviderStagingV1(projectRoot, buffers, nativeContext = null) {
  const paths = statePaths(projectRoot);
  fs.mkdirSync(paths.stagingRoot, { recursive: true, mode: 0o700 });
  if (nativeContext?.addon) {
    const stateObservation = inspectDirectory(nativeContext, paths.stateDirectory);
    const stagingObservation = inspectDirectory(nativeContext, paths.stagingRoot);
    if (stateObservation.deviceId !== stagingObservation.deviceId) throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'STAGING_DEVICE_MISMATCH');
  }
  const runId = crypto.randomBytes(16).toString('hex');
  const runDirectory = path.join(paths.stagingRoot, `citation-staging-${process.pid}-${runId}`);
  fs.mkdirSync(runDirectory, { recursive: false, mode: 0o700 });
  atomicWrite(path.join(runDirectory, 'owner-v1.json'), Buffer.from(canonicalJson({ version: 'kstack-citation-staging-owner-v1', hostname: os.hostname(), pid: process.pid, runId, startedAt: new Date().toISOString() })));
  const files = buffers.map((bytes, index) => {
    const file = path.join(runDirectory, `provider-${index}-${crypto.randomBytes(16).toString('hex')}.stdin`);
    atomicWrite(file, bytes);
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    if (nativeContext?.addon?.inspectProtectionFd) {
      const verdict = nativeContext.addon.inspectProtectionFd(fd, 'regular-file');
      if (verdict?.verdict !== 'enforced' && !BEST_EFFORT_TYPES.has(inspectDirectory(nativeContext, paths.stateDirectory).filesystemType)) {
        fs.closeSync(fd); throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'MODE_OWNERSHIP_UNENFORCEABLE');
      }
    }
    const verified = Buffer.alloc(bytes.length);
    let offset = 0;
    while (offset < verified.length) { const count = fs.readSync(fd, verified, offset, verified.length - offset, offset); if (!count) break; offset += count; }
    if (offset !== bytes.length || !verified.equals(bytes) || fs.fstatSync(fd).size !== bytes.length) { fs.closeSync(fd); throw runtimeError('PLATFORM_PRECONDITION_FAILED', 'PROBE_IO_ERROR'); }
    return { file, fd };
  });
  return { runDirectory, files, cleanup() { for (const item of files) { try { fs.closeSync(item.fd); } catch {} try { fs.unlinkSync(item.file); } catch {} } try { fs.unlinkSync(path.join(runDirectory, 'owner-v1.json')); } catch {} try { fs.rmdirSync(runDirectory); } catch {} } };
}

export function sweepCitationStagingV1(projectRoot, now = Date.now()) {
  const root = statePaths(projectRoot).stagingRoot;
  if (!fs.existsSync(root)) return { removed: 0, retained: 0 };
  let removed = 0; let retained = 0;
  for (const name of fs.readdirSync(root).sort()) {
    if (!/^citation-staging-[1-9][0-9]*-[0-9a-f]{32}$/.test(name)) { retained += 1; continue; }
    const directory = path.join(root, name);
    try {
      const marker = JSON.parse(fs.readFileSync(path.join(directory, 'owner-v1.json'), 'utf8'));
      const stat = fs.statSync(path.join(directory, 'owner-v1.json'));
      if (marker.hostname !== os.hostname() || now - stat.mtimeMs < MAX_STAGING_AGE_MS) { retained += 1; continue; }
      try { process.kill(marker.pid, 0); retained += 1; continue; } catch (error) { if (error.code !== 'ESRCH') { retained += 1; continue; } }
      const children = fs.readdirSync(directory);
      if (children.some((child) => child !== 'owner-v1.json' && !/^provider-[01]-[0-9a-f]{32}\.stdin$/.test(child))) { retained += 1; continue; }
      if (children.some((child) => now - fs.statSync(path.join(directory, child)).mtimeMs < MAX_STAGING_AGE_MS)) { retained += 1; continue; }
      for (const child of children) fs.unlinkSync(path.join(directory, child));
      fs.rmdirSync(directory); removed += 1;
    } catch { retained += 1; }
  }
  return { removed, retained };
}

export async function resetCitationStateV1(projectRoot) {
  const paths = statePaths(projectRoot);
  const release = await acquireCoordinatorLock(paths);
  try {
    const first = fs.readFileSync(paths.stateFile);
    const second = fs.readFileSync(paths.stateFile);
    if (!first.equals(second)) throw runtimeError('LOCK_CONTENTION');
    try { parseCanonicalStateRecordV2(first); } catch (error) {
      if (error.code !== 'STATE_MALFORMED') throw error;
      fs.unlinkSync(paths.stateFile);
      const fd = fs.openSync(paths.stateDirectory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      return { status: 'reset' };
    }
    throw runtimeError('STATE_NOT_QUALIFIED');
  } finally { await release(); }
}

export async function runCitationMaintenanceV1(command, options) {
  if (command === 'reset-native-build') return resetCitationNativeBuildV1(options.nativeOptions);
  if (command === 'reset-state') return resetCitationStateV1(options.projectRoot);
  if (command === 'sweep-staging') { await (options.nativeContext ? Promise.resolve(options.nativeContext) : ensureCitationNativeReadyV1(options.nativeOptions)); return sweepCitationStagingV1(options.projectRoot); }
  if (command === 'repair-instance-store') return repairCitationInstanceStoreV1(options);
  if (command === 'repair-state-protection') return repairCitationStateProtectionV1(options);
  if (command === 'reset-coordinator-lock-tombstones') {
    const paths = statePaths(options.projectRoot); let removed = 0;
    const release = await acquireCoordinatorLock(paths);
    try {
      for (const name of fs.readdirSync(paths.stateDirectory).sort()) if (/^citation-grounding-coordinator-v1\.lock\.reset-tombstone-coordinator-lock-[0-9a-f]{32}$/.test(name) && removed < 8) { fs.unlinkSync(path.join(paths.stateDirectory, name)); removed += 1; }
      return { status: removed === 8 ? 'more' : 'complete', removed };
    } finally { await release(); }
  }
  throw new Error(`unknown citation maintenance command: ${command}`);
}
