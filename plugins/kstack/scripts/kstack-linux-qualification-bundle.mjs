#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateLinuxQualificationProgram,
  LINUX_QUALIFICATION_CONSTANTS
} from './kstack-linux-qualification.mjs';
import { assertOutboundSecretScan } from './kstack-safety-matchers.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const HASH = /^[a-f0-9]{64}$/u;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 512 * 1024 * 1024;
const MAX_FILES = 128;
const CELL_IDS = Object.freeze(LINUX_QUALIFICATION_CONSTANTS.cellTargets.map(({ cellId }) => cellId));
const DESCRIPTOR_KEYS = Object.freeze(['path', 'sha256']);
const CELL_KEYS = Object.freeze(['cellId', 'observation', 'lifecycle', 'backends', 'artifacts']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function compare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value, keys, code) {
  const actual = plain(value) ? Object.keys(value).sort(compare) : [];
  const expected = [...keys].sort(compare);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(code);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function instant(value, code) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(code);
  try { if (new Date(value).toISOString() !== value) fail(code); } catch { fail(code); }
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (plain(value)) return Object.fromEntries(Object.keys(value).sort(compare).map((key) => [key, canonical(value[key])]));
  return value;
}

export function linuxQualificationCanonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(canonical(value), null, 2)}\n`, 'utf8');
}

function parseCanonicalJson(bytes, code) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > MAX_FILE_BYTES) fail(code);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(code); }
  if (!plain(value) || !bytes.equals(linuxQualificationCanonicalBytes(value))) fail(code);
  return value;
}

function relativeFile(value, code) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 || value.includes('\\')
      || path.posix.isAbsolute(value) || value.startsWith('//') || /^[A-Za-z]:\//u.test(value)
      || value.split('/').includes('..') || value.split('/').includes('.')
      || path.posix.normalize(value) !== value || value.startsWith('.kstack/secrets/')) fail(code);
  return value;
}

function descriptor(value, code) {
  exact(value, DESCRIPTOR_KEYS, code);
  const relativePath = relativeFile(value.path, code);
  if (relativePath === 'manifest.json' || typeof value.sha256 !== 'string' || !HASH.test(value.sha256)) fail(code);
  return { path: relativePath, sha256: value.sha256 };
}

function validateManifest(value, now) {
  const code = 'KSTACK_LINUX_BUNDLE_MANIFEST_INVALID';
  exact(value, ['schema', 'generatedAt', 'cells'], code);
  if (value.schema !== 'kstack-linux-qualification-bundle-v1') fail(code);
  instant(value.generatedAt, code);
  if (Date.parse(value.generatedAt) > Date.parse(now) || !Array.isArray(value.cells)
      || value.cells.length !== CELL_IDS.length) fail(code);
  const cells = value.cells.map((cell, index) => {
    exact(cell, CELL_KEYS, code);
    if (cell.cellId !== CELL_IDS[index] || !Array.isArray(cell.artifacts) || cell.artifacts.length < 1) fail(code);
    const artifacts = cell.artifacts.map((entry) => descriptor(entry, code));
    const artifactPaths = artifacts.map(({ path: artifactPath }) => artifactPath);
    if (new Set(artifactPaths).size !== artifactPaths.length
        || artifactPaths.some((entry, artifactIndex) => artifactIndex > 0
          && compare(artifactPaths[artifactIndex - 1], entry) >= 0)) fail(code);
    return {
      cellId: cell.cellId,
      observation: descriptor(cell.observation, code),
      lifecycle: descriptor(cell.lifecycle, code),
      backends: descriptor(cell.backends, code),
      artifacts
    };
  });
  const allPaths = cells.flatMap((cell) => [
    cell.observation.path, cell.lifecycle.path, cell.backends.path,
    ...cell.artifacts.map(({ path: artifactPath }) => artifactPath)
  ]);
  if (new Set(allPaths).size !== allPaths.length || allPaths.length + 1 > MAX_FILES) fail(code);
  return { schema: value.schema, generatedAt: value.generatedAt, cells };
}

function trustedRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) fail('KSTACK_LINUX_BUNDLE_ROOT_INVALID');
  let resolved;
  try {
    const linked = fs.lstatSync(root);
    resolved = fs.realpathSync.native(root);
    const opened = fs.statSync(resolved);
    const owned = typeof process.getuid !== 'function' || opened.uid === process.getuid();
    if (!linked.isDirectory() || linked.isSymbolicLink() || !opened.isDirectory()
        || path.resolve(root) !== resolved || !owned || (opened.mode & 0o022) !== 0) fail('KSTACK_LINUX_BUNDLE_ROOT_INVALID');
  } catch (error) {
    if (error?.code?.startsWith?.('KSTACK_')) throw error;
    fail('KSTACK_LINUX_BUNDLE_ROOT_INVALID');
  }
  return resolved;
}

function readTrustedFile(root, relativePath) {
  const file = path.join(root, ...relativePath.split('/'));
  let handle;
  try {
    const linked = fs.lstatSync(file);
    handle = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(handle);
    const owned = typeof process.getuid !== 'function' || opened.uid === process.getuid();
    if (!linked.isFile() || linked.isSymbolicLink() || !opened.isFile() || !owned
        || linked.dev !== opened.dev || linked.ino !== opened.ino || (opened.mode & 0o022) !== 0
        || opened.size < 1 || opened.size > MAX_FILE_BYTES) fail('KSTACK_LINUX_BUNDLE_FILE_INVALID');
    return fs.readFileSync(handle);
  } catch (error) {
    if (error?.code?.startsWith?.('KSTACK_')) throw error;
    fail('KSTACK_LINUX_BUNDLE_FILE_INVALID');
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
}

function inventory(root, current = root, rows = []) {
  for (const name of fs.readdirSync(current).sort(compare)) {
    const absolute = path.join(current, name);
    const relativePath = path.relative(root, absolute).split(path.sep).join('/');
    const linked = fs.lstatSync(absolute);
    const owned = typeof process.getuid !== 'function' || linked.uid === process.getuid();
    if (linked.isSymbolicLink() || !owned || (linked.mode & 0o022) !== 0) fail('KSTACK_LINUX_BUNDLE_INVENTORY_INVALID');
    if (linked.isDirectory()) inventory(root, absolute, rows);
    else if (linked.isFile()) rows.push(relativePath);
    else fail('KSTACK_LINUX_BUNDLE_INVENTORY_INVALID');
    if (rows.length > MAX_FILES) fail('KSTACK_LINUX_BUNDLE_INVENTORY_INVALID');
  }
  return rows;
}

function referencedDigests(observation, lifecycle, backends) {
  return new Set([
    observation.distributionEvidenceDigest, observation.kernelEvidenceDigest,
    observation.filesystemEvidenceDigest, observation.initEvidenceDigest,
    observation.packageManagerEvidenceDigest,
    ...lifecycle.steps.map(({ evidenceDigest }) => evidenceDigest),
    lifecycle.persistedStateDigestBefore, lifecycle.persistedStateDigestAfter,
    ...backends.probes.map(({ evidenceDigest }) => evidenceDigest)
  ]);
}

export function admitLinuxQualificationBundle({ root, now, observedAt = new Date().toISOString() }) {
  instant(now, 'KSTACK_LINUX_BUNDLE_TIME_INVALID');
  instant(observedAt, 'KSTACK_LINUX_BUNDLE_TIME_INVALID');
  if (Date.parse(now) > Date.parse(observedAt)) fail('KSTACK_LINUX_BUNDLE_TIME_FUTURE');
  const resolvedRoot = trustedRoot(root);
  const manifestBytes = readTrustedFile(resolvedRoot, 'manifest.json');
  assertOutboundSecretScan(manifestBytes, { byteDomain: true });
  const manifest = validateManifest(parseCanonicalJson(manifestBytes, 'KSTACK_LINUX_BUNDLE_MANIFEST_INVALID'), now);
  const expectedPaths = ['manifest.json', ...manifest.cells.flatMap((cell) => [
    cell.observation.path, cell.lifecycle.path, cell.backends.path,
    ...cell.artifacts.map(({ path: artifactPath }) => artifactPath)
  ])].sort(compare);
  const actualPaths = inventory(resolvedRoot).sort(compare);
  if (actualPaths.length !== expectedPaths.length
      || actualPaths.some((entry, index) => entry !== expectedPaths[index])) fail('KSTACK_LINUX_BUNDLE_INVENTORY_INVALID');

  let totalBytes = manifestBytes.length;
  const cells = [];
  for (const cell of manifest.cells) {
    const records = {};
    for (const [kind, recordDescriptor] of [['observation', cell.observation], ['lifecycle', cell.lifecycle], ['backends', cell.backends]]) {
      const bytes = readTrustedFile(resolvedRoot, recordDescriptor.path);
      totalBytes += bytes.length;
      assertOutboundSecretScan(bytes, { byteDomain: true });
      if (sha256(bytes) !== recordDescriptor.sha256) fail('KSTACK_LINUX_BUNDLE_RECORD_DRIFT');
      records[kind] = parseCanonicalJson(bytes, 'KSTACK_LINUX_BUNDLE_RECORD_INVALID');
      if (records[kind].cellId !== cell.cellId) fail('KSTACK_LINUX_BUNDLE_RECORD_INVALID');
    }
    const artifactDigests = new Set();
    for (const artifact of cell.artifacts) {
      const bytes = readTrustedFile(resolvedRoot, artifact.path);
      totalBytes += bytes.length;
      if (totalBytes > MAX_BUNDLE_BYTES) fail('KSTACK_LINUX_BUNDLE_SIZE_INVALID');
      assertOutboundSecretScan(bytes, { byteDomain: true });
      const actual = sha256(bytes);
      if (actual !== artifact.sha256) fail('KSTACK_LINUX_BUNDLE_ARTIFACT_DRIFT');
      artifactDigests.add(actual);
    }
    const references = referencedDigests(records.observation, records.lifecycle, records.backends);
    if (references.size !== artifactDigests.size || [...references].some((value) => !artifactDigests.has(value))) {
      fail('KSTACK_LINUX_BUNDLE_EVIDENCE_COVERAGE_INVALID');
    }
    cells.push({ cellId: cell.cellId, ...records, evidenceArtifacts: cell.artifacts.length });
  }
  const result = evaluateLinuxQualificationProgram({
    cells: cells.map(({ observation }) => observation),
    lifecycles: cells.map(({ lifecycle }) => lifecycle),
    backends: cells.map(({ backends }) => backends)
  }, now);
  if (!result.qualified) fail('KSTACK_LINUX_BUNDLE_NOT_QUALIFIED');
  const receiptBody = canonical({
    schema: 'kstack-linux-qualification-bundle-receipt-v1',
    qualified: true,
    admittedAt: now,
    manifestSha256: sha256(manifestBytes),
    programDigest: result.programDigest,
    cells: cells.map(({ cellId, evidenceArtifacts }) => ({ cellId, evidenceArtifacts })),
    coverage: {
      matrix: result.matrix.coverageExact,
      lifecycle: result.lifecycle.coverageExact,
      privilegedBackends: result.privilegedBackends.coverageExact
    },
    totalFiles: actualPaths.length,
    totalBytes
  });
  const receipt = Object.freeze({ ...receiptBody, receiptSha256: sha256(linuxQualificationCanonicalBytes(receiptBody)) });
  const receiptBytes = linuxQualificationCanonicalBytes(receipt);
  assertOutboundSecretScan(receiptBytes, { byteDomain: true });
  return Object.freeze({ receipt, receiptBytes });
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 5 || args[0] !== 'admit' || args[1] !== '--root'
        || !args[2] || args[3] !== '--out' || !args[4]) fail('KSTACK_LINUX_BUNDLE_ARGUMENT_INVALID');
    const root = path.resolve(args[2]);
    const output = path.resolve(args[4]);
    const relativeOutput = path.relative(root, output);
    if (!path.isAbsolute(args[2]) || !path.isAbsolute(args[4])
        || (!relativeOutput.startsWith('..') && !path.isAbsolute(relativeOutput))) fail('KSTACK_LINUX_BUNDLE_ARGUMENT_INVALID');
    const now = new Date().toISOString();
    const { receipt, receiptBytes } = admitLinuxQualificationBundle({ root, now, observedAt: now });
    const handle = fs.openSync(output, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    try { fs.writeFileSync(handle, receiptBytes); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
    process.stdout.write(`${JSON.stringify({ status: 'QUALIFIED', output, receiptSha256: receipt.receiptSha256, programDigest: receipt.programDigest })}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code || error?.message || 'KSTACK_LINUX_BUNDLE_FAILED'}\n`);
    process.exitCode = 2;
  }
}
