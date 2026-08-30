#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateLinuxCellObservation } from './kstack-linux-qualification.mjs';
import { linuxQualificationCanonicalBytes } from './kstack-linux-qualification-bundle.mjs';
import { assertOutboundSecretScan } from './kstack-safety-matchers.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const COLLECTOR_PATH = path.join(path.dirname(SCRIPT_PATH), '..', 'workers', 'kstack-linux-observation-collect.sh');
const FILES = Object.freeze([
  'distribution.txt', 'filesystem.txt', 'init.txt', 'kernel.txt', 'metadata.txt', 'package-manager.txt'
]);
const HASH = /^[a-f0-9]{64}$/u;
const SAFE_VALUE = /^[^\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]{1,4096}$/u;
const CELL = Object.freeze({
  'debian-stable-native-x64': { family: 'debian', id: 'debian', environment: 'native', packageManager: 'apt' },
  'fedora-stable-native-x64': { family: 'fedora', id: 'fedora', environment: 'native', packageManager: 'dnf' },
  'ubuntu-lts-native-x64': { family: 'ubuntu', id: 'ubuntu', environment: 'native', packageManager: 'apt' },
  'ubuntu-lts-wsl2-x64': { family: 'ubuntu', id: 'ubuntu', environment: 'wsl2', packageManager: 'apt' }
});
const NATIVE_FILESYSTEMS = new Set(['btrfs', 'ext2', 'ext3', 'ext4', 'xfs', 'zfs']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function instant(value, code) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
      || new Date(value).toISOString() !== value) fail(code);
  return value;
}

function trustedRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) fail('KSTACK_LINUX_OBSERVATION_ROOT_INVALID');
  try {
    const link = fs.lstatSync(root);
    const real = fs.realpathSync.native(root);
    const stat = fs.statSync(real);
    const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
    if (!link.isDirectory() || link.isSymbolicLink() || !stat.isDirectory() || real !== path.resolve(root)
        || !owned || (stat.mode & 0o022) !== 0) fail('KSTACK_LINUX_OBSERVATION_ROOT_INVALID');
    return real;
  } catch (error) {
    if (error?.code?.startsWith?.('KSTACK_')) throw error;
    fail('KSTACK_LINUX_OBSERVATION_ROOT_INVALID');
  }
}

function readFile(root, name) {
  const file = path.join(root, name);
  let handle;
  try {
    const link = fs.lstatSync(file);
    handle = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const stat = fs.fstatSync(handle);
    const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
    if (!link.isFile() || link.isSymbolicLink() || !stat.isFile() || !owned || link.dev !== stat.dev
        || link.ino !== stat.ino || (stat.mode & 0o022) !== 0 || stat.size < 1 || stat.size > 64 * 1024) {
      fail('KSTACK_LINUX_OBSERVATION_FILE_INVALID');
    }
    const bytes = fs.readFileSync(handle);
    assertOutboundSecretScan(bytes, { byteDomain: true });
    return bytes;
  } catch (error) {
    if (error?.code?.startsWith?.('KSTACK_')) throw error;
    fail('KSTACK_LINUX_OBSERVATION_FILE_INVALID');
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
}

function lines(bytes, expectedKeys, code) {
  let decoded;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail(code); }
  if (!decoded.endsWith('\n') || decoded.includes('\r')) fail(code);
  const entries = decoded.slice(0, -1).split('\n').map((line) => {
    const split = line.indexOf('=');
    if (split < 1) fail(code);
    const key = line.slice(0, split);
    const value = line.slice(split + 1);
    if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(key) || !SAFE_VALUE.test(value)) fail(code);
    return [key, value];
  });
  if (entries.length !== expectedKeys.length || new Set(entries.map(([key]) => key)).size !== entries.length
      || expectedKeys.some((key) => !entries.some(([entry]) => entry === key))) fail(code);
  return Object.fromEntries(entries);
}

function osRelease(bytes) {
  let decoded;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('KSTACK_LINUX_OBSERVATION_DISTRIBUTION_INVALID'); }
  if (!decoded.endsWith('\n') || decoded.includes('\r')) fail('KSTACK_LINUX_OBSERVATION_DISTRIBUTION_INVALID');
  const result = {};
  for (const line of decoded.slice(0, -1).split('\n')) {
    const split = line.indexOf('=');
    if (split < 1) fail('KSTACK_LINUX_OBSERVATION_DISTRIBUTION_INVALID');
    const key = line.slice(0, split);
    if (!['ID', 'VERSION_ID', 'ID_LIKE', 'PRETTY_NAME'].includes(key) || Object.hasOwn(result, key)) fail('KSTACK_LINUX_OBSERVATION_DISTRIBUTION_INVALID');
    let value = line.slice(split + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
    if (!SAFE_VALUE.test(value)) fail('KSTACK_LINUX_OBSERVATION_DISTRIBUTION_INVALID');
    result[key] = value;
  }
  if (!result.ID || !result.VERSION_ID || !result.PRETTY_NAME) fail('KSTACK_LINUX_OBSERVATION_DISTRIBUTION_INVALID');
  return result;
}

export function admitLinuxObservationCollection({ root, now = new Date().toISOString(), collectorPath = COLLECTOR_PATH }) {
  const current = instant(now, 'KSTACK_LINUX_OBSERVATION_TIME_INVALID');
  const resolved = trustedRoot(root);
  const actual = fs.readdirSync(resolved).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  if (actual.length !== FILES.length || actual.some((name, index) => name !== FILES[index])) fail('KSTACK_LINUX_OBSERVATION_INVENTORY_INVALID');
  const evidence = Object.fromEntries(FILES.map((name) => [name, readFile(resolved, name)]));
  const metadata = lines(evidence['metadata.txt'], ['schema', 'cellId', 'collectorSha256', 'observedAt', 'expiresAt'], 'KSTACK_LINUX_OBSERVATION_METADATA_INVALID');
  const target = CELL[metadata.cellId];
  if (metadata.schema !== 'kstack-linux-observation-collection-v1' || !target || !HASH.test(metadata.collectorSha256)
      || metadata.collectorSha256 !== sha256(fs.readFileSync(collectorPath))) fail('KSTACK_LINUX_OBSERVATION_METADATA_INVALID');
  instant(metadata.observedAt, 'KSTACK_LINUX_OBSERVATION_TIME_INVALID');
  instant(metadata.expiresAt, 'KSTACK_LINUX_OBSERVATION_TIME_INVALID');
  if (Date.parse(metadata.observedAt) > Date.parse(current)) fail('KSTACK_LINUX_OBSERVATION_TIME_FUTURE');

  const distribution = osRelease(evidence['distribution.txt']);
  if (distribution.ID !== target.id) fail('KSTACK_LINUX_OBSERVATION_TARGET_MISMATCH');
  const kernel = lines(evidence['kernel.txt'], ['system', 'release', 'architecture'], 'KSTACK_LINUX_OBSERVATION_KERNEL_INVALID');
  if (kernel.system !== 'Linux' || kernel.architecture !== 'x86_64') fail('KSTACK_LINUX_OBSERVATION_KERNEL_INVALID');
  const wslKernel = /microsoft.*wsl/iu.test(kernel.release);
  if ((target.environment === 'wsl2') !== wslKernel) fail('KSTACK_LINUX_OBSERVATION_TARGET_MISMATCH');
  const filesystem = lines(evidence['filesystem.txt'], ['target', 'source', 'fstype', 'options'], 'KSTACK_LINUX_OBSERVATION_FILESYSTEM_INVALID');
  const filesystemNative = NATIVE_FILESYSTEMS.has(filesystem.fstype);
  if (!filesystemNative) fail('KSTACK_LINUX_OBSERVATION_FILESYSTEM_NOT_NATIVE');
  const init = lines(evidence['init.txt'], ['pid1', 'systemctlState', 'systemctlStatus'], 'KSTACK_LINUX_OBSERVATION_INIT_INVALID');
  const initOperational = init.pid1 === 'systemd' && ['running', 'degraded'].includes(init.systemctlState)
    && ['0', '1'].includes(init.systemctlStatus);
  if (!initOperational) fail('KSTACK_LINUX_OBSERVATION_INIT_NOT_OPERATIONAL');
  const manager = lines(evidence['package-manager.txt'], ['command', 'version'], 'KSTACK_LINUX_OBSERVATION_PACKAGE_INVALID');
  if (manager.command !== target.packageManager || !manager.version.toLowerCase().startsWith(`${target.packageManager} `)) {
    fail('KSTACK_LINUX_OBSERVATION_PACKAGE_INVALID');
  }
  const cell = {
    schemaVersion: 1, cellId: metadata.cellId,
    distributionId: distribution.ID, distributionVersion: distribution.VERSION_ID,
    distributionFamily: target.family, distributionEvidenceDigest: sha256(evidence['distribution.txt']),
    environment: target.environment, architecture: kernel.architecture,
    kernelRelease: kernel.release, kernelEvidenceDigest: sha256(evidence['kernel.txt']),
    filesystemType: filesystem.fstype, filesystemNative,
    filesystemEvidenceDigest: sha256(evidence['filesystem.txt']),
    initSystem: 'systemd', initOperational, initEvidenceDigest: sha256(evidence['init.txt']),
    packageManager: manager.command, packageManagerEvidenceDigest: sha256(evidence['package-manager.txt']),
    observedAt: metadata.observedAt, expiresAt: metadata.expiresAt
  };
  const result = evaluateLinuxCellObservation(cell, current);
  if (!result.qualified) fail('KSTACK_LINUX_OBSERVATION_NOT_QUALIFIED');
  const body = {
    schema: 'kstack-linux-current-cell-observation-evidence-v1',
    collectorSha256: metadata.collectorSha256,
    sourceEvidence: FILES.map((name) => ({ name, sha256: sha256(evidence[name]), bytes: evidence[name].length })),
    cell, evaluation: result
  };
  return Object.freeze({ evidence: body, evidenceBytes: linuxQualificationCanonicalBytes(body) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 5 || args[0] !== 'admit' || args[1] !== '--root' || !path.isAbsolute(args[2])
        || args[3] !== '--out' || !path.isAbsolute(args[4])) fail('KSTACK_LINUX_OBSERVATION_ARGUMENT_INVALID');
    const output = path.resolve(args[4]);
    const { evidence, evidenceBytes } = admitLinuxObservationCollection({ root: args[2] });
    const handle = fs.openSync(output, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    try { fs.writeFileSync(handle, evidenceBytes); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
    process.stdout.write(`${JSON.stringify({ status: 'QUALIFIED', cellId: evidence.cell.cellId, output, evidenceDigest: evidence.evaluation.evidenceDigest })}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code || error?.message || 'KSTACK_LINUX_OBSERVATION_ADMISSION_FAILED'}\n`);
    process.exitCode = 2;
  }
}
