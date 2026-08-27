import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { canonicalJson } from './kstack-citation-state.mjs';

export const NATIVE_MANIFEST_VERSION = 'kstack-citation-native-build-manifest-v1';
export const NATIVE_STATUS_VERSION = 'kstack-citation-native-build-status-v2';
export const NATIVE_ABI_VERSION = 'kstack-citation-fs-native-abi-v2';
export const NATIVE_COMPONENT_VERSION = '1.0.0';
export const NATIVE_MANIFEST_FILE = 'native/citation-fs-native/kstack-citation-native-build-manifest-v1.json';
export const MAX_CACHE_CHILDREN = 16_384;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultPluginRoot = path.resolve(moduleDirectory, '..');
const HEX_64 = /^[0-9a-f]{64}$/;
const HARD_TYPES = new Map([
  [0x0000ef53n, 'linux-ext'], [0x58465342n, 'linux-xfs'], [0x9123683en, 'linux-btrfs'],
  [0x01021994n, 'linux-tmpfs'], [0x794c7630n, 'linux-overlay'], [0x7366746en, 'linux-ntfs3'], [0x2011bab0n, 'linux-exfat']
]);
const BEST_EFFORT_TYPES = new Set([0x01021997n, 0x00006969n, 0xff534d42n, 0x65735546n]);
let readyPromise;

function nativeError(reason, component) {
  return Object.assign(new Error('NATIVE_ADDON_UNAVAILABLE'), { code: 'NATIVE_ADDON_UNAVAILABLE', reason, component });
}

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function framed(value) { const size = Buffer.alloc(8); size.writeBigUInt64BE(BigInt(value.length)); return Buffer.concat([size, value]); }

function manifestPayloadDigest(manifest) {
  const copy = structuredClone(manifest);
  delete copy.manifestDigest;
  const tag = Buffer.from('kstack-citation-native-build-manifest-digest-v1', 'ascii');
  const payload = Buffer.from(canonicalJson(copy), 'utf8');
  return digest(Buffer.concat([framed(tag), framed(payload)]));
}

function statRegular(file) {
  const value = fs.lstatSync(file, { bigint: true });
  if (!value.isFile() || value.isSymbolicLink() || value.nlink !== 1n) throw nativeError('manifest-invalid', 'manifest');
  return value;
}

function inventoryFiles(pluginRoot) {
  const entries = [];
  const add = (relative, role) => {
    const file = path.join(pluginRoot, ...relative.split('/'));
    const stat = statRegular(file);
    const bytes = fs.readFileSync(file);
    if (stat.size !== BigInt(bytes.length)) throw nativeError('manifest-invalid', role === 'node-gyp-vendor' ? 'node-gyp' : 'manifest');
    entries.push({ path: relative, size: bytes.length, sha256: digest(bytes), role });
  };
  const scan = (relativeRoot, role, suffixes = null) => {
    const root = path.join(pluginRoot, ...relativeRoot.split('/'));
    const walk = (directory, prefix) => {
      const names = fs.readdirSync(directory).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      for (const name of names) {
        const file = path.join(directory, name);
        const relative = `${prefix}/${name}`;
        const stat = fs.lstatSync(file, { bigint: true });
        if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw nativeError('manifest-invalid', role === 'node-gyp-vendor' ? 'node-gyp' : 'manifest');
        if (stat.isDirectory()) walk(file, relative);
        else {
          if (suffixes && !suffixes.some((suffix) => name.endsWith(suffix))) throw nativeError('manifest-invalid', 'manifest');
          add(relative, role);
        }
      }
    };
    walk(root, relativeRoot);
  };
  scan('native/citation-fs-native/src', 'native-source', ['.c', '.cc', '.cpp', '.mm']);
  const include = path.join(pluginRoot, 'native/citation-fs-native/include');
  if (fs.existsSync(include)) scan('native/citation-fs-native/include', 'native-header', ['.h', '.hpp']);
  add('native/citation-fs-native/binding.gyp', 'binding-gyp');
  add('native/citation-fs-native/build-native.mjs', 'builder');
  add('native/citation-fs-native/load-native.mjs', 'loader');
  scan('native/citation-fs-native/target-recipes', 'target-recipe');
  scan('vendor/node-gyp-11.4.2', 'node-gyp-vendor');
  return entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}

export function verifyCitationNativeManifestV1(pluginRoot = defaultPluginRoot) {
  let manifest;
  let manifestBytes;
  try { manifestBytes = fs.readFileSync(path.join(pluginRoot, NATIVE_MANIFEST_FILE)); manifest = JSON.parse(manifestBytes); } catch { throw nativeError('manifest-invalid', 'manifest'); }
  const keys = ['manifestVersion', 'manifestDigestVersion', 'manifestDigest', 'componentVersion', 'abiVersion', 'napiVersion', 'nodeGypVersion', 'statusVersion', 'targetRecipeVersion', 'files'];
  if (!manifest || Object.keys(manifest).sort().join('\0') !== keys.sort().join('\0')
      || manifest.manifestVersion !== NATIVE_MANIFEST_VERSION || manifest.manifestDigestVersion !== 'kstack-citation-native-build-manifest-digest-v1'
      || manifest.componentVersion !== NATIVE_COMPONENT_VERSION || manifest.abiVersion !== NATIVE_ABI_VERSION || manifest.napiVersion !== 8
      || manifest.nodeGypVersion !== '11.4.2' || manifest.statusVersion !== NATIVE_STATUS_VERSION || !HEX_64.test(manifest.manifestDigest)
      || canonicalJson(manifest) !== manifestBytes.toString('utf8')
      || manifest.manifestDigest !== manifestPayloadDigest(manifest)) throw nativeError('manifest-invalid', 'manifest');
  const actual = inventoryFiles(pluginRoot);
  if (canonicalJson(actual) !== canonicalJson(manifest.files)) throw nativeError('manifest-invalid', 'manifest');
  return Object.freeze({ manifest, sourceManifestDigest: manifest.manifestDigest });
}

export function createCitationNativeManifestV1(pluginRoot = defaultPluginRoot) {
  const manifest = {
    manifestVersion: NATIVE_MANIFEST_VERSION,
    manifestDigestVersion: 'kstack-citation-native-build-manifest-digest-v1',
    manifestDigest: '0'.repeat(64),
    componentVersion: NATIVE_COMPONENT_VERSION,
    abiVersion: NATIVE_ABI_VERSION,
    napiVersion: 8,
    nodeGypVersion: '11.4.2',
    statusVersion: NATIVE_STATUS_VERSION,
    targetRecipeVersion: 'kstack-citation-native-target-recipe-v1',
    files: inventoryFiles(pluginRoot)
  };
  manifest.manifestDigest = manifestPayloadDigest(manifest);
  return manifest;
}

export function detectCitationNativeTargetV1() {
  if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) throw nativeError('unsupported-runtime', 'runtime');
  const match = process.versions.node.match(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/);
  const napi = process.versions.napi;
  const glibc = process.report?.getReport?.()?.header?.glibcVersionRuntime;
  const release = os.release();
  if (!match || !/^(0|[1-9][0-9]*)$/.test(napi) || Number(napi) < 8 || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(glibc ?? '')) throw nativeError('unsupported-runtime', 'runtime');
  const [major, minor] = match.slice(1).map(Number);
  if (!((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major === 24)) throw nativeError('unsupported-runtime', 'runtime');
  const [glibcMajor, glibcMinor] = glibc.split('.').map(Number);
  if (glibcMajor < 2 || (glibcMajor === 2 && glibcMinor < 28)) throw nativeError('unsupported-runtime', 'runtime');
  const kernel = release.match(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)/);
  if (!kernel || Number(kernel[1]) < 4 || (Number(kernel[1]) === 4 && Number(kernel[2]) < 18)
      || (/microsoft/i.test(release) && !/wsl2/i.test(release))) throw nativeError('unsupported-runtime', 'runtime');
  return process.arch === 'x64' ? 'linux-x64-gnu' : 'linux-arm64-gnu';
}

function trustworthyAncestry(candidate) {
  const canonical = fs.realpathSync.native(candidate);
  let current = canonical;
  const euid = process.geteuid();
  while (true) {
    const value = fs.lstatSync(current, { bigint: true });
    if (value.isSymbolicLink() || !value.isDirectory() || ![BigInt(euid), 0n].includes(value.uid) || (value.mode & 0o22n) !== 0n) return false;
    if (current === path.dirname(current)) break;
    current = path.dirname(current);
  }
  return true;
}

function classifyRoot(candidate, role) {
  let canonical;
  try {
    canonical = fs.realpathSync.native(candidate);
    const stat = fs.lstatSync(canonical, { bigint: true });
    const raw = BigInt.asUintN(64, fs.statfsSync(canonical, { bigint: true }).type);
    const filesystemType = HARD_TYPES.get(raw);
    if (!filesystemType) {
      if (role === 'checkout' && BEST_EFFORT_TYPES.has(raw)) throw nativeError('build-input-relocation-required', 'build-input-filesystem');
      throw nativeError(role === 'cache' ? 'build-cache-relocation-invalid' : 'build-input-protection-invalid', role === 'cache' ? 'build-cache-filesystem' : 'build-input-filesystem');
    }
    if (!trustworthyAncestry(canonical)) throw new Error('untrusted');
    return { canonical, device: stat.dev.toString(), identity: stat.ino.toString(), filesystemType };
  } catch (error) {
    if (error?.code === 'NATIVE_ADDON_UNAVAILABLE') throw error;
    throw nativeError(role === 'cache' ? 'build-cache-relocation-invalid' : 'build-input-protection-invalid', role === 'cache' ? 'build-cache-filesystem' : 'build-input-filesystem');
  }
}

function authorizeRunnerSurfaceV1(pluginRoot, expectedDevice) {
  const roots = ['scripts', '.codex-plugin'];
  const entries = [];
  const walk = (relative) => {
    const current = path.join(pluginRoot, ...relative.split('/'));
    const stat = fs.lstatSync(current, { bigint: true });
    if (stat.isSymbolicLink() || stat.dev.toString() !== expectedDevice || ![BigInt(process.geteuid()), 0n].includes(stat.uid) || (stat.mode & 0o22n) !== 0n) throw nativeError('build-input-protection-invalid', 'build-input-filesystem');
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))) walk(`${relative}/${name}`);
    } else if (stat.isFile()) {
      const bytes = fs.readFileSync(current);
      entries.push({ path: relative, size: bytes.length, sha256: digest(bytes) });
    } else throw nativeError('build-input-protection-invalid', 'build-input-filesystem');
  };
  for (const root of roots) walk(root);
  for (const relative of ['package.json', 'package-lock.json']) {
    const file = path.join(pluginRoot, relative);
    const stat = statRegular(file);
    if (stat.dev.toString() !== expectedDevice || ![BigInt(process.geteuid()), 0n].includes(stat.uid) || (stat.mode & 0o22n) !== 0n) throw nativeError('build-input-protection-invalid', 'build-input-filesystem');
    const bytes = fs.readFileSync(file); entries.push({ path: relative, size: bytes.length, sha256: digest(bytes) });
  }
  return digest(Buffer.from(canonicalJson(entries.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))))));
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const stat = fs.lstatSync(directory, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== BigInt(process.geteuid()) || (stat.mode & 0o7777n) !== 0o700n) throw nativeError('build-cache-relocation-invalid', 'build-cache-filesystem');
}

function deleteBoundedTree(root, limits = { entries: 16_384, depth: 32 }) {
  let entries = 0;
  const visit = (current, depth) => {
    if (depth > limits.depth || ++entries > limits.entries) throw nativeError('cache-child-limit-reached', 'build-cache-inventory');
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw nativeError('build-lock-io', 'build-lock');
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current).sort()) visit(path.join(current, name), depth + 1);
      fs.rmdirSync(current);
    } else fs.unlinkSync(current);
  };
  visit(root, 0);
}

function validateStatus(status, expected) {
  const keys = ['statusVersion', 'status', 'reason', 'component', 'targetTriple', 'runtimeKeyDigest', 'componentVersion', 'sourceManifestDigest', 'artifactDigest'];
  const unavailablePairs = new Set([
    'manifest-invalid\0manifest', 'manifest-invalid\0node-gyp', 'prerequisite-unavailable\0node-headers',
    'prerequisite-unavailable\0python', 'build-failed\0build-toolchain', 'build-timeout\0build-toolchain',
    'output-invalid\0build-output', 'load-failed\0artifact', 'abi-failed\0addon-abi',
    'self-test-failed\0addon-self-test'
  ]);
  return status && Object.keys(status).sort().join('\0') === keys.sort().join('\0') && status.statusVersion === NATIVE_STATUS_VERSION
    && ['ready', 'unavailable'].includes(status.status) && status.targetTriple === expected.targetTriple && status.runtimeKeyDigest === expected.runtimeKeyDigest
    && status.componentVersion === NATIVE_COMPONENT_VERSION && status.sourceManifestDigest === expected.sourceManifestDigest
    && (status.status === 'ready' ? status.reason === 'ready' && status.component === 'none' && HEX_64.test(status.artifactDigest) : status.artifactDigest === null && unavailablePairs.has(`${status.reason}\0${status.component}`));
}

function atomicWrite(file, value, mode = 0o600) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.citation-native-${crypto.randomBytes(16).toString('hex')}.tmp`);
  const fd = fs.openSync(temporary, 'wx', mode);
  try { fs.writeFileSync(fd, value); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
  const directoryFd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
  try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
}

async function acquireBuildLock(lockPath) {
  const raw = Buffer.from(canonicalJson({ lockVersion: 'kstack-citation-native-build-lock-v1', lockId: crypto.randomBytes(16).toString('hex'), pid: process.pid, hostname: os.hostname(), acquiredAt: new Date().toISOString() }));
  const started = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx', 0o600);
      fs.writeFileSync(fd, raw); fs.fsyncSync(fd); fs.closeSync(fd);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() - started >= 420_000) throw nativeError(error.code === 'EEXIST' ? 'build-lock-contention' : 'build-lock-io', 'build-lock');
      const stat = fs.statSync(lockPath);
      if (Date.now() - stat.mtimeMs >= 90_000) {
        const tombstone = `${lockPath}.reset-tombstone-build-lock-${crypto.randomBytes(16).toString('hex')}`;
        try { fs.renameSync(lockPath, tombstone); fs.unlinkSync(tombstone); continue; } catch {}
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  const worker = new Worker(new URL('../native/citation-fs-native/target-recipes/heartbeat-worker.mjs', import.meta.url), { workerData: { path: lockPath, bytes: raw.toString('base64'), intervalMs: 5000 } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(nativeError('build-lock-io', 'build-lock')), 10_000);
    worker.once('message', (message) => { clearTimeout(timer); message.type === 'heartbeat' ? resolve() : reject(nativeError('build-lock-io', 'build-lock')); });
    worker.once('error', () => { clearTimeout(timer); reject(nativeError('build-lock-io', 'build-lock')); });
  });
  return async () => {
    await new Promise((resolve) => { worker.once('message', resolve); worker.postMessage('stop'); });
    await worker.terminate();
    if (!fs.readFileSync(lockPath).equals(raw)) throw nativeError('build-lock-io', 'build-lock');
    fs.unlinkSync(lockPath);
  };
}

function loadShape(addon) {
  const names = ['applyAndInspectProtectionFd', 'inspectDirectoryFd', 'inspectFileFd', 'inspectProtectionFd', 'selfTest'];
  if (!addon || Object.keys(addon).sort().join('\0') !== names.sort().join('\0') || names.some((name) => typeof addon[name] !== 'function')) throw nativeError('abi-failed', 'addon-abi');
  const result = addon.selfTest();
  if (!result || Object.keys(result).sort().join('\0') !== ['abiVersion', 'platform', 'verdict'].sort().join('\0')
      || result.abiVersion !== NATIVE_ABI_VERSION || result.platform !== 'linux' || result.verdict !== 'pass') throw nativeError('self-test-failed', 'addon-self-test');
  return addon;
}

function requireAddon(artifact) {
  const { createRequire } = awaitImportCreateRequire;
  return loadShape(createRequire(import.meta.url)(artifact));
}
import { createRequire as importedCreateRequire } from 'node:module';
const awaitImportCreateRequire = { createRequire: importedCreateRequire };

function transcriptBytes(error, context) {
  const scrub = (value) => value.toString('utf8').split(context.checkoutRoot).join('[REDACTED PATH]').split(context.cacheRoot).join('[REDACTED PATH]');
  const data = error.transcript ?? { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), timedOut: false, overflow: false };
  return Buffer.from(`KSTACK-CITATION-NATIVE-BUILD-TRANSCRIPT-V1\ntarget ${context.targetTriple}\nreason ${error.reason}\ntimedOut ${data.timedOut}\noverflow ${data.overflow}\nSTDOUT\n${scrub(data.stdout)}\nSTDERR\n${scrub(data.stderr)}\n`);
}

function runBuilderProcess(builderPath, pluginRoot, attemptRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [builderPath, pluginRoot, attemptRoot], { cwd: attemptRoot, shell: false, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk)); child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', () => reject(Object.assign(new Error('native builder unavailable'), { reason: 'build-failed', component: 'build-toolchain' })));
    child.once('close', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(Buffer.concat(stdout).toString('utf8'))); } catch { reject(Object.assign(new Error('native builder output invalid'), { reason: 'output-invalid', component: 'build-output' })); }
      } else {
        let details = {};
        try { details = JSON.parse(Buffer.concat(stderr).toString('utf8').trim().split('\n').at(-1)); } catch {}
        reject(Object.assign(new Error('native build failed'), { reason: details.reason ?? 'build-failed', component: details.component ?? 'build-toolchain', transcript: { stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), timedOut: details.reason === 'build-timeout', overflow: false } }));
      }
    });
  });
}

async function ensureImpl(options) {
  const pluginRoot = fs.realpathSync.native(options.pluginRoot ?? defaultPluginRoot);
  const checkoutRoot = fs.realpathSync.native(options.checkoutRoot ?? path.resolve(pluginRoot, '../..'));
  const targetTriple = detectCitationNativeTargetV1();
  const manifest = verifyCitationNativeManifestV1(pluginRoot);
  const source = classifyRoot(checkoutRoot, 'checkout');
  const firstLoadSurfaceDigest = authorizeRunnerSurfaceV1(pluginRoot, source.device);
  let cacheRoot = process.env.KSTACK_CITATION_NATIVE_CACHE_ROOT;
  const cacheOrigin = cacheRoot ? 'operator-relocation' : 'checkout-default';
  if (cacheRoot) {
    if (!path.isAbsolute(cacheRoot) || path.normalize(cacheRoot) !== cacheRoot || !fs.existsSync(cacheRoot)) throw nativeError('build-cache-relocation-invalid', 'build-cache-filesystem');
  } else {
    cacheRoot = path.join(checkoutRoot, '.kstack', 'native-build');
    ensurePrivateDirectory(cacheRoot);
  }
  const cache = classifyRoot(cacheRoot, 'cache');
  ensurePrivateDirectory(cache.canonical);
  const targetRoot = path.join(cache.canonical, targetTriple);
  ensurePrivateDirectory(targetRoot);
  if (fs.readdirSync(targetRoot).length > MAX_CACHE_CHILDREN) throw nativeError('cache-child-limit-reached', 'build-cache-inventory');
  const runtimeKeyDigest = digest(Buffer.from(canonicalJson({ targetTriple, nodeVersion: process.versions.node, napiVersion: process.versions.napi, source, cache, cacheOrigin, sourceManifestDigest: manifest.sourceManifestDigest, firstLoadSurfaceDigest })));
  const expected = { targetTriple, runtimeKeyDigest, sourceManifestDigest: manifest.sourceManifestDigest };
  const statusPath = path.join(targetRoot, NATIVE_STATUS_VERSION + '.json');
  const artifactPath = path.join(targetRoot, 'kstack_citation_fs_native.node');
  const loadReady = () => {
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    if (!validateStatus(status, expected) || status.status !== 'ready') return null;
    const bytes = fs.readFileSync(artifactPath);
    if (digest(bytes) !== status.artifactDigest) return null;
    const addon = requireAddon(artifactPath);
    const fd = fs.openSync(artifactPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try { addon.inspectFileFd(fd); } finally { fs.closeSync(fd); }
    return Object.freeze({ addon, artifactPath, artifactDigest: status.artifactDigest, targetTriple, buildCacheRoot: cache.canonical, buildCacheDevice: cache.device, buildCacheFilesystemType: cache.filesystemType, nativeAddonBinding: Object.freeze({ abiVersion: NATIVE_ABI_VERSION, artifactDigest: status.artifactDigest, packageName: '@kstack/citation-fs-native', packageVersion: NATIVE_COMPONENT_VERSION, targetTriple }), runtimeKeyDigest, sourceManifestDigest: manifest.sourceManifestDigest });
  };
  try {
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    if (validateStatus(status, expected) && status.status === 'unavailable' && status.reason !== 'manifest-invalid') throw nativeError(status.reason, status.component);
    const ready = loadReady(); if (ready) return ready;
  } catch (error) { if (error?.code === 'NATIVE_ADDON_UNAVAILABLE') throw error; }
  const release = await acquireBuildLock(path.join(targetRoot, 'kstack-citation-native-build.lock'));
  try {
    try { const ready = loadReady(); if (ready) return ready; } catch {}
    const attemptId = crypto.randomBytes(16).toString('hex');
    const attemptRoot = path.join(targetRoot, `attempt-${attemptId}`);
    ensurePrivateDirectory(attemptRoot);
    let result;
    try {
      result = await runBuilderProcess(path.join(pluginRoot, 'native/citation-fs-native/build-native.mjs'), pluginRoot, attemptRoot);
      const built = fs.readFileSync(result.artifactPath);
      if (!built.length) throw Object.assign(new Error('empty native artifact'), { reason: 'output-invalid', component: 'build-output' });
      atomicWrite(artifactPath, built);
      fs.chmodSync(artifactPath, 0o600);
      const artifactDigest = digest(fs.readFileSync(artifactPath));
      requireAddon(artifactPath);
      const status = { statusVersion: NATIVE_STATUS_VERSION, status: 'ready', reason: 'ready', component: 'none', targetTriple, runtimeKeyDigest, componentVersion: NATIVE_COMPONENT_VERSION, sourceManifestDigest: manifest.sourceManifestDigest, artifactDigest };
      atomicWrite(statusPath, Buffer.from(canonicalJson(status)));
      deleteBoundedTree(attemptRoot);
    } catch (error) {
      const reason = error.reason ?? 'build-failed';
      const component = error.component ?? 'build-toolchain';
      try { atomicWrite(path.join(targetRoot, 'last-build-transcript-v1.log'), transcriptBytes(error, { checkoutRoot, cacheRoot: cache.canonical, targetTriple })); } catch {}
      const status = { statusVersion: NATIVE_STATUS_VERSION, status: 'unavailable', reason, component, targetTriple, runtimeKeyDigest, componentVersion: NATIVE_COMPONENT_VERSION, sourceManifestDigest: manifest.sourceManifestDigest, artifactDigest: null };
      try { atomicWrite(statusPath, Buffer.from(canonicalJson(status))); } catch {}
      throw nativeError(reason, component);
    }
    const ready = loadReady();
    if (!ready) throw nativeError('load-failed', 'artifact');
    return ready;
  } finally {
    await release();
  }
}

export function ensureCitationNativeReadyV1(options = {}) {
  if (!readyPromise) readyPromise = ensureImpl(options).catch((error) => { readyPromise = undefined; throw error; });
  return readyPromise;
}

export function resetCitationNativeProcessCacheForTests() { readyPromise = undefined; }

export async function resetCitationNativeBuildV1(options = {}) {
  const pluginRoot = fs.realpathSync.native(options.pluginRoot ?? defaultPluginRoot);
  const checkoutRoot = fs.realpathSync.native(options.checkoutRoot ?? path.resolve(pluginRoot, '../..'));
  const targetTriple = detectCitationNativeTargetV1();
  const cacheRoot = process.env.KSTACK_CITATION_NATIVE_CACHE_ROOT ?? path.join(checkoutRoot, '.kstack', 'native-build');
  const targetRoot = path.join(fs.realpathSync.native(cacheRoot), targetTriple);
  const allowedFiles = new Set([NATIVE_STATUS_VERSION + '.json', 'kstack_citation_fs_native.node', 'last-build-transcript-v1.log']);
  let removed = 0;
  for (const name of fs.readdirSync(targetRoot).sort()) {
    const candidate = path.join(targetRoot, name);
    if (allowedFiles.has(name) && fs.lstatSync(candidate).isFile()) { fs.unlinkSync(candidate); removed += 1; }
    else if (/^attempt-[0-9a-f]{32}$/.test(name) && removed < 8) { deleteBoundedTree(candidate); removed += 1; }
  }
  readyPromise = undefined;
  return { status: fs.readdirSync(targetRoot).some((name) => /^attempt-[0-9a-f]{32}$/.test(name)) ? 'more-attempts' : 'complete', removed };
}
