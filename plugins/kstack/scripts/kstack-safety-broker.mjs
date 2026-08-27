import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findOutboundSecret, MATCHER_VERSION } from './kstack-safety-matchers.mjs';
import { createProductionSafetyExecutor, SAFETY_EXECUTOR_ERROR_CODES } from './kstack-safety-executor.mjs';

export const SAFETY_LIMITS = Object.freeze({
  requestBytes: 65_536,
  fieldBytes: 65_536,
  titleBytes: 512,
  objectBytes: 16 * 1024 * 1024,
  closureObjects: 10_000,
  closureBytes: 128 * 1024 * 1024,
  previewBytes: 2_048,
  hookResponseBytes: 4_096,
  sessionHandles: 64,
  sessionScans: 2,
  globalHandles: 512,
  globalScans: 8,
  terminalRecords: 4_096,
  ttlMs: 15 * 60_000,
  scanTimeoutMs: 60_000
});

const ACTIONS = new Set([
  'git-commit', 'git-push', 'git-merge', 'git-destructive',
  'provider-pr-create', 'provider-merge', 'jira-ticket-create'
]);
const TERMINAL = new Set([
  'REJECTED_SECRET', 'REJECTED_LIMIT', 'FAILED', 'EXPIRED', 'COMPLETED',
  'COMPLETED_AMBIGUOUS', 'EXECUTE_FAILED', 'CANCELLED'
]);
const ZERO_OID = /^0{40}(?:0{24})?$/u;
const OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const SAFE_REF = /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/u;
const SAFE_HEAD_REF = /^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/u;
const SAFE_IDENT = /^([^<>\u0000-\u001f\u007f]{1,200}) <([^<>\s\u0000-\u001f\u007f]{1,254})>$/u;
const BANNED_KEYS = /(?:credential|password|secret|token|authorization|header|endpoint|environment|callback|outputPath|plugin|helper|hook|signer|editor|pager|command|argv)/iu;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const approvalCapability = Symbol('kstack-approval-bound-channel');

export class SafetyProtocolError extends Error {
  constructor(code, message = code) {
    const safeMessage = typeof message === 'string' && utf8(message) <= 512 && !findOutboundSecret(Buffer.from(message, 'utf8')) ? message : code;
    super(safeMessage);
    this.name = 'SafetyProtocolError';
    this.code = code;
  }
}

function fail(code, message) { throw new SafetyProtocolError(code, message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function utf8(value) { return Buffer.byteLength(value, 'utf8'); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function responseBytes(value) { return Buffer.byteLength(JSON.stringify(value), 'utf8'); }

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('KSG-SCHEMA-001', 'numbers must be safe integers');
    return String(value);
  }
  if (typeof value === 'string') {
    if (!value.isWellFormed() || CONTROL_OR_BIDI.test(value)) fail('KSG-SCHEMA-001', 'strings must be well-formed control-free Unicode');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!plain(value)) fail('KSG-SCHEMA-001', 'canonical values must be plain JSON');
  return `{${Object.keys(value).sort().map((key) => `${canonicalJson(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function exactKeys(object, allowed, where) {
  if (!plain(object)) fail('KSG-SCHEMA-001', `${where} must be an object`);
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(object)) {
    if (!allowedSet.has(key) || BANNED_KEYS.test(key)) fail('KSG-SCHEMA-001', `${where}.${key} is not allowed`);
  }
  for (const key of allowed) if (!(key in object)) fail('KSG-SCHEMA-001', `${where}.${key} is required`);
}

function boundedString(value, where, maximum = SAFETY_LIMITS.fieldBytes) {
  if (typeof value !== 'string' || value.length === 0 || !value.isWellFormed() || CONTROL_OR_BIDI.test(value) || utf8(value) > maximum) {
    fail('KSG-SCHEMA-001', `${where} is invalid or over its byte limit`);
  }
  return value;
}

function digest(value, where) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) fail('KSG-SCHEMA-001', `${where} must be a SHA-256 digest`);
  return value;
}

function oid(value, where, { zero = false } = {}) {
  if (typeof value !== 'string' || (!OID.test(value) && !(zero && ZERO_OID.test(value)))) fail('KSG-SCHEMA-001', `${where} must be a lowercase Git object ID`);
  return value;
}

function stringArray(value, where, maximum = 32) {
  if (!Array.isArray(value) || value.length > maximum) fail('KSG-SCHEMA-001', `${where} must be a bounded array`);
  return value.map((item, index) => boundedString(item, `${where}[${index}]`, 4_096));
}

function validatePayload(action, payload) {
  switch (action) {
    case 'git-commit':
      exactKeys(payload, ['message', 'author', 'committer', 'headOid', 'headTreeOid', 'proposedTreeOid'], 'payload');
      boundedString(payload.message, 'payload.message'); boundedString(payload.author, 'payload.author', 512); boundedString(payload.committer, 'payload.committer', 512);
      if (!SAFE_IDENT.test(payload.author) || !SAFE_IDENT.test(payload.committer)) fail('KSG-SCHEMA-001', 'commit identities must use Name <email> form');
      oid(payload.headOid, 'payload.headOid'); oid(payload.headTreeOid, 'payload.headTreeOid'); oid(payload.proposedTreeOid, 'payload.proposedTreeOid');
      break;
    case 'git-merge':
      exactKeys(payload, ['message', 'author', 'committer', 'mergeBaseOid', 'parentOids', 'resultTreeOid'], 'payload');
      boundedString(payload.message, 'payload.message'); boundedString(payload.author, 'payload.author', 512); boundedString(payload.committer, 'payload.committer', 512);
      oid(payload.mergeBaseOid, 'payload.mergeBaseOid'); oid(payload.resultTreeOid, 'payload.resultTreeOid');
      if (!Array.isArray(payload.parentOids) || payload.parentOids.length !== 2) fail('KSG-SCHEMA-001', 'payload.parentOids must contain two OIDs');
      payload.parentOids.forEach((item, index) => oid(item, `payload.parentOids[${index}]`));
      break;
    case 'git-push':
      exactKeys(payload, ['updates', 'atomic'], 'payload');
      if (!Array.isArray(payload.updates) || payload.updates.length < 1 || payload.updates.length > 4) fail('KSG-SCHEMA-001', 'payload.updates must contain one to four updates');
      if (typeof payload.atomic !== 'boolean') fail('KSG-SCHEMA-001', 'payload.atomic must be boolean');
      if (payload.updates.length > 1 && payload.atomic !== true) fail('KSG-PUSH-ATOMIC-001', 'multi-ref push requires negotiated atomic updates');
      payload.updates.forEach((update, index) => {
        exactKeys(update, ['sourceOid', 'expectedRemoteOldOid', 'destinationRef'], `payload.updates[${index}]`);
        oid(update.sourceOid, `payload.updates[${index}].sourceOid`, { zero: true });
        oid(update.expectedRemoteOldOid, `payload.updates[${index}].expectedRemoteOldOid`, { zero: true });
        if (typeof update.destinationRef !== 'string' || !SAFE_REF.test(update.destinationRef) || update.destinationRef.includes('..') || update.destinationRef.endsWith('.lock')) fail('KSG-SCHEMA-001', 'destination ref is invalid');
      });
      break;
    case 'git-destructive':
      exactKeys(payload, ['kind', 'paths', 'expectedInventoryDigest'], 'payload');
      if (!new Set(['reset-hard', 'clean', 'checkout-paths', 'restore-worktree', 'branch-delete-force', 'tag-delete-or-force', 'worktree-remove-or-prune', 'stash-drop-or-clear', 'reflog-expire', 'gc-prune', 'rm-recursive', 'index-remove-cached']).has(payload.kind)) fail('KSG-SCHEMA-001', 'destructive kind is not admitted');
      stringArray(payload.paths, 'payload.paths'); digest(payload.expectedInventoryDigest, 'payload.expectedInventoryDigest');
      break;
    case 'provider-pr-create':
      exactKeys(payload, ['repository', 'title', 'body', 'baseRef', 'headRef'], 'payload');
      boundedString(payload.repository, 'payload.repository', 512); boundedString(payload.title, 'payload.title', SAFETY_LIMITS.titleBytes); boundedString(payload.body, 'payload.body');
      boundedString(payload.baseRef, 'payload.baseRef', 512); boundedString(payload.headRef, 'payload.headRef', 512);
      break;
    case 'provider-merge':
      exactKeys(payload, ['repository', 'pullRequestId', 'method', 'text'], 'payload');
      boundedString(payload.repository, 'payload.repository', 512); boundedString(payload.pullRequestId, 'payload.pullRequestId', 128);
      if (!['merge', 'squash', 'rebase'].includes(payload.method)) fail('KSG-SCHEMA-001', 'merge method is invalid');
      if (typeof payload.text !== 'string' || utf8(payload.text) > SAFETY_LIMITS.fieldBytes || CONTROL_OR_BIDI.test(payload.text)) fail('KSG-SCHEMA-001', 'payload.text is invalid');
      break;
    case 'jira-ticket-create':
      exactKeys(payload, ['project', 'issueType', 'summary', 'description', 'fields'], 'payload');
      boundedString(payload.project, 'payload.project', 64); boundedString(payload.issueType, 'payload.issueType', 128);
      boundedString(payload.summary, 'payload.summary', SAFETY_LIMITS.titleBytes); boundedString(payload.description, 'payload.description');
      if (!plain(payload.fields)) fail('KSG-SCHEMA-001', 'payload.fields must be an object');
      for (const [key, value] of Object.entries(payload.fields)) {
        if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(key) || BANNED_KEYS.test(key) || !['string', 'number', 'boolean'].includes(typeof value)) fail('KSG-SCHEMA-001', 'payload.fields contains an unadmitted field');
        canonicalJson(value);
      }
      break;
    default: fail('KSG-SCHEMA-001', 'action is not admitted');
  }
}

export function validateCanonicalRequest(request) {
  exactKeys(request, ['version', 'action', 'sessionId', 'cellKey', 'root', 'targetId', 'targetFingerprintDigest', 'policyGeneration', 'targetGeneration', 'certificateDigest', 'payload'], 'request');
  if (request.version !== 3 || !ACTIONS.has(request.action)) fail('KSG-SCHEMA-001', 'request version or action is not admitted');
  boundedString(request.sessionId, 'request.sessionId', 256); boundedString(request.cellKey, 'request.cellKey', 256);
  boundedString(request.root, 'request.root', 4_096); boundedString(request.targetId, 'request.targetId', 1_024);
  if (request.action === 'git-commit' && (!SAFE_HEAD_REF.test(request.targetId) || request.targetId.includes('..') || request.targetId.endsWith('.lock'))) fail('KSG-SCHEMA-001', 'commit targetId must be the exact branch ref');
  digest(request.targetFingerprintDigest, 'request.targetFingerprintDigest'); digest(request.certificateDigest, 'request.certificateDigest');
  if (!Number.isSafeInteger(request.policyGeneration) || request.policyGeneration < 0 || !Number.isSafeInteger(request.targetGeneration) || request.targetGeneration < 0) fail('KSG-SCHEMA-001', 'generations must be non-negative integers');
  validatePayload(request.action, request.payload);
  const bytes = Buffer.from(canonicalJson(request), 'utf8');
  if (bytes.length > SAFETY_LIMITS.requestBytes) fail('KSG-SCHEMA-001', 'canonical request exceeds 64 KiB');
  return Object.freeze({ request: structuredClone(request), bytes, digest: sha256(bytes) });
}

function gitInspectionEnvironment() {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (/^GIT_/u.test(key)) delete environment[key];
  }
  return {
    ...environment,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0',
    GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0'
  };
}

function verifyGitObjectId(objectId, type, bytes) {
  const algorithm = objectId.length === 40 ? 'sha1' : objectId.length === 64 ? 'sha256' : null;
  if (!algorithm) fail('KSG-SCAN-GIT-001', 'Git object ID length is invalid');
  const actual = crypto.createHash(algorithm).update(`${type} ${bytes.length}\0`).update(bytes).digest('hex');
  if (!constantEqualHex(actual, objectId)) fail('KSG-SCAN-GIT-001', 'Git object content does not match its object ID');
}

function git(root, args, options = {}) {
  const result = spawnSync('git', ['--no-pager', '--no-replace-objects', '-C', root, ...args], {
    encoding: options.encoding ?? null,
    maxBuffer: options.maxBuffer ?? SAFETY_LIMITS.objectBytes + 65_536,
    timeout: options.timeout ?? SAFETY_LIMITS.scanTimeoutMs,
    shell: false,
    env: gitInspectionEnvironment()
  });
  if (result.error?.code === 'ETIMEDOUT') fail('KSG-SCAN-LIMIT-001', 'Git object inspection exceeded the scan timeout');
  if (result.error || result.status !== 0) fail('KSG-SCAN-GIT-001', 'Git object inspection failed');
  return result.stdout;
}

function remainingScanTime(deadline) {
  const remaining = Math.floor(deadline - performance.now());
  if (remaining <= 0) fail('KSG-SCAN-LIMIT-001', 'Git object inspection exceeded the scan timeout');
  return remaining;
}

function gitScalar(root, args, deadline, maximum = 256) {
  return git(root, args, { encoding: 'utf8', maxBuffer: maximum, timeout: remainingScanTime(deadline) }).trim();
}

function gitDirectory(root, deadline) {
  const resolvedRoot = path.resolve(root);
  if (fs.realpathSync.native(resolvedRoot) !== resolvedRoot) fail('KSG-SCAN-GIT-001', 'symlinked repository roots are not admitted');
  const output = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', maxBuffer: 8_192, timeout: remainingScanTime(deadline) }).trim();
  const real = fs.realpathSync.native(output);
  const alternate = path.join(real, 'objects', 'info', 'alternates');
  if (fs.existsSync(alternate)) fail('KSG-SCAN-GIT-001', 'alternate object stores are not admitted');
  if (fs.existsSync(path.join(real, 'info', 'grafts')) || fs.existsSync(path.join(real, 'shallow'))) fail('KSG-SCAN-GIT-001', 'grafts and shallow object graphs are not admitted');
  const replaceDirectory = path.join(real, 'refs', 'replace');
  if (fs.existsSync(replaceDirectory) && fs.readdirSync(replaceDirectory).length > 0) fail('KSG-SCAN-GIT-001', 'replace refs are not admitted');
  const packedRefs = path.join(real, 'packed-refs');
  if (fs.existsSync(packedRefs) && /\srefs\/replace\//u.test(fs.readFileSync(packedRefs, 'utf8'))) fail('KSG-SCAN-GIT-001', 'packed replace refs are not admitted');
  const config = fs.readFileSync(path.join(real, 'config'), 'utf8');
  if (/^\s*(?:promisor|partialclone)\s*=|^\s*\[extensions\s+"?partialclone/imu.test(config)) fail('KSG-SCAN-GIT-001', 'promisor object graphs are not admitted');
  const packDirectory = path.join(real, 'objects', 'pack');
  if (fs.existsSync(packDirectory) && fs.readdirSync(packDirectory).some((name) => name.endsWith('.promisor'))) fail('KSG-SCAN-GIT-001', 'promisor packs are not admitted');
  return real;
}

function listReachableObjects(root, tips, exclusions, deadline) {
  const output = git(root, ['rev-list', '--objects', ...tips, ...exclusions.map((value) => `^${value}`)], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: remainingScanTime(deadline) });
  const ids = new Set();
  for (const line of output.split('\n')) {
    const candidate = line.split(' ', 1)[0];
    if (OID.test(candidate)) ids.add(candidate);
  }
  return ids;
}

function listPushObjects(root, updates, deadline) {
  const ids = new Set();
  for (const update of updates) {
    if (ZERO_OID.test(update.sourceOid)) continue;
    const closure = listReachableObjects(root, [update.sourceOid], ZERO_OID.test(update.expectedRemoteOldOid) ? [] : [update.expectedRemoteOldOid], deadline);
    for (const candidate of closure) ids.add(candidate);
  }
  return ids;
}

function gitObjects(request) {
  if (!request.action.startsWith('git-') || request.action === 'git-destructive') return [];
  const deadline = performance.now() + SAFETY_LIMITS.scanTimeoutMs;
  gitDirectory(request.root, deadline);
  let ids;
  if (request.action === 'git-push') ids = listPushObjects(request.root, request.payload.updates, deadline);
  else if (request.action === 'git-commit') {
    const actualHeadTree = gitScalar(request.root, ['rev-parse', `${request.payload.headOid}^{tree}`], deadline);
    if (actualHeadTree !== request.payload.headTreeOid || gitScalar(request.root, ['cat-file', '-t', request.payload.proposedTreeOid], deadline, 128) !== 'tree') fail('KSG-SCAN-GIT-001', 'commit tree bindings are inconsistent');
    ids = listReachableObjects(request.root, [request.payload.proposedTreeOid], [request.payload.headTreeOid], deadline);
  }
  else {
    for (const parent of request.payload.parentOids) if (gitScalar(request.root, ['cat-file', '-t', parent], deadline, 128) !== 'commit') fail('KSG-SCAN-GIT-001', 'merge parents must be commits');
    const mergeBases = git(request.root, ['merge-base', '--all', ...request.payload.parentOids], { encoding: 'utf8', maxBuffer: 256, timeout: remainingScanTime(deadline) }).trim().split('\n').filter(Boolean);
    if (mergeBases.length !== 1 || mergeBases[0] !== request.payload.mergeBaseOid || gitScalar(request.root, ['cat-file', '-t', request.payload.resultTreeOid], deadline, 128) !== 'tree') fail('KSG-SCAN-GIT-001', 'merge bindings are inconsistent or ambiguous');
    ids = listReachableObjects(request.root, request.payload.parentOids, [request.payload.mergeBaseOid], deadline);
    const mergeBaseTreeOid = gitScalar(request.root, ['rev-parse', `${request.payload.mergeBaseOid}^{tree}`], deadline, 128);
    for (const candidate of listReachableObjects(request.root, [request.payload.resultTreeOid], [mergeBaseTreeOid], deadline)) ids.add(candidate);
  }
  if (ids.size > SAFETY_LIMITS.closureObjects) fail('KSG-SCAN-LIMIT-001', 'object count exceeds the closure limit');
  const objects = [];
  let closureBytes = 0;
  for (const objectId of [...ids].sort()) {
    const type = git(request.root, ['cat-file', '-t', objectId], { encoding: 'utf8', maxBuffer: 128, timeout: remainingScanTime(deadline) }).trim();
    if (!['blob', 'commit', 'tag', 'tree'].includes(type)) fail('KSG-SCAN-GIT-001', 'unadmitted Git object type');
    const sizeText = git(request.root, ['cat-file', '-s', objectId], { encoding: 'utf8', maxBuffer: 128, timeout: remainingScanTime(deadline) }).trim();
    const size = Number(sizeText);
    if (!Number.isSafeInteger(size) || size < 0 || size > SAFETY_LIMITS.objectBytes) fail('KSG-SCAN-LIMIT-001', 'one Git object exceeds the value limit');
    closureBytes += size;
    if (closureBytes > SAFETY_LIMITS.closureBytes) fail('KSG-SCAN-LIMIT-001', 'Git closure exceeds the byte limit');
    const bytes = git(request.root, ['cat-file', type, objectId], { maxBuffer: SAFETY_LIMITS.objectBytes + 1, timeout: remainingScanTime(deadline) });
    if (bytes.length !== size) fail('KSG-SCAN-GIT-001', 'Git object changed or was read incompletely');
    verifyGitObjectId(objectId, type, bytes);
    objects.push(Object.freeze({ id: objectId, type, bytes }));
  }
  return objects;
}

function scalarTextFields(request) {
  const fields = [];
  const visit = (value, name) => {
    if (typeof value === 'string') fields.push(Object.freeze({ id: name, bytes: Buffer.from(value, 'utf8') }));
    else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${name}[${index}]`));
    else if (plain(value)) for (const key of Object.keys(value).sort()) visit(value[key], `${name}.${key}`);
  };
  for (const name of ['action', 'sessionId', 'cellKey', 'root', 'targetId']) visit(request[name], name);
  visit(request.payload, 'payload');
  return fields;
}

export class OutboundContentScanStageV1 {
  constructor({ objectSource = gitObjects, clock = () => Math.floor(performance.now()) } = {}) {
    this.objectSource = objectSource;
    this.clock = clock;
  }

  async scan(request) {
    const started = this.clock();
    const textFields = scalarTextFields(request);
    const objects = await this.objectSource(request);
    if (this.clock() - started > SAFETY_LIMITS.scanTimeoutMs) return Object.freeze({ state: 'REJECTED_LIMIT', limit: 'scan-timeout' });
    if (!Array.isArray(objects) || objects.length > SAFETY_LIMITS.closureObjects) fail('KSG-SCAN-LIMIT-001', 'object count exceeds the closure limit');
    let objectBytes = 0;
    let textBytes = 0;
    const closure = crypto.createHash('sha256');
    for (const field of textFields) {
      if (this.clock() - started > SAFETY_LIMITS.scanTimeoutMs) return Object.freeze({ state: 'REJECTED_LIMIT', limit: 'scan-timeout' });
      textBytes += field.bytes.length;
      const match = findOutboundSecret(field.bytes);
      if (match) return Object.freeze({ state: 'REJECTED_SECRET', locator: { fieldId: field.id, offsetClass: Math.floor(match.offset / 256) }, matcherVersion: MATCHER_VERSION });
      closure.update(`text\0${field.id}\0${field.bytes.length}\0`); closure.update(field.bytes);
    }
    for (const [index, object] of objects.entries()) {
      if (!plain(object) || typeof object.id !== 'string' || !Buffer.isBuffer(object.bytes) || object.bytes.length > SAFETY_LIMITS.objectBytes) fail('KSG-SCAN-GIT-001', 'object source returned an invalid object');
      objectBytes += object.bytes.length;
      if (objectBytes > SAFETY_LIMITS.closureBytes) return Object.freeze({ state: 'REJECTED_LIMIT', limit: 'closure-bytes' });
      if (this.clock() - started > SAFETY_LIMITS.scanTimeoutMs) return Object.freeze({ state: 'REJECTED_LIMIT', limit: 'scan-timeout' });
      const match = findOutboundSecret(object.bytes, { byteDomain: true });
      if (match) return Object.freeze({ state: 'REJECTED_SECRET', locator: { objectId: object.id, offsetClass: Math.floor(match.offset / 256) }, matcherVersion: MATCHER_VERSION });
      closure.update(`object\0${index}\0${object.id}\0${object.type ?? 'unknown'}\0${object.bytes.length}\0`); closure.update(object.bytes);
    }
    return Object.freeze({
      state: 'PASS', closureDigest: closure.digest('hex'), matcherVersion: MATCHER_VERSION,
      objectCount: objects.length, objectBytes, textFieldCount: textFields.length, textBytes
    });
  }
}

function previewFor(request, requestDigest, scan, expiresAt) {
  const data = {
    version: 3, root: request.root, target: request.targetId, targetFingerprintDigest: request.targetFingerprintDigest,
    action: request.action, requestDigest, closureDigest: scan.closureDigest, scanResult: 'PASS', matcherVersion: scan.matcherVersion,
    objectCount: scan.objectCount, objectBytes: scan.objectBytes, textFieldCount: scan.textFieldCount, textBytes: scan.textBytes,
    policyGeneration: request.policyGeneration, targetGeneration: request.targetGeneration, expiresAt,
    updates: request.action === 'git-push' ? request.payload.updates : [],
    commit: request.action === 'git-commit' ? {
      message: request.payload.message, author: request.payload.author, committer: request.payload.committer,
      headOid: request.payload.headOid, proposedTreeOid: request.payload.proposedTreeOid
    } : null
  };
  const preview = canonicalJson(data);
  if (utf8(preview) > SAFETY_LIMITS.previewBytes) fail('KSG-PREVIEW-LIMIT-001', 'canonical preview exceeds its serialized budget');
  return preview;
}

function attestationBody(record, bootGeneration) {
  const request = record.request;
  const scan = record.scan;
  return {
    version: 1, handleId: record.handleId, brokerBootGeneration: bootGeneration, sessionId: request.sessionId,
    cellKey: request.cellKey, canonicalRequestDigest: record.requestDigest, closureDigest: scan.closureDigest,
    scanResult: 'PASS', matcherVersion: scan.matcherVersion, objectCount: scan.objectCount, objectBytes: scan.objectBytes,
    textFieldCount: scan.textFieldCount, textBytes: scan.textBytes, policyGeneration: request.policyGeneration,
    targetIdDigest: sha256(request.targetId), targetGeneration: request.targetGeneration,
    targetFingerprintDigest: request.targetFingerprintDigest, certificateDigest: request.certificateDigest,
    previewDigest: record.previewDigest, issuedAt: record.issuedAt, expiresAt: record.expiresAt, nonce: record.nonce,
    macAlgorithm: 'HMAC-SHA-256'
  };
}

function constantEqualHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length || left.length % 2 !== 0 || !/^[0-9a-f]+$/u.test(left) || !/^[0-9a-f]+$/u.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function validateScanResult(scan) {
  if (!plain(scan) || typeof scan.state !== 'string') fail('KSG-SCAN-FAILED-001', 'scanner returned an invalid result');
  if (scan.state === 'PASS') {
    exactKeys(scan, ['state', 'closureDigest', 'matcherVersion', 'objectCount', 'objectBytes', 'textFieldCount', 'textBytes'], 'scan');
    digest(scan.closureDigest, 'scan.closureDigest');
    if (scan.matcherVersion !== MATCHER_VERSION) fail('KSG-SCAN-FAILED-001', 'scanner matcher version is not current');
    for (const key of ['objectCount', 'objectBytes', 'textFieldCount', 'textBytes']) {
      if (!Number.isSafeInteger(scan[key]) || scan[key] < 0) fail('KSG-SCAN-FAILED-001', `scan.${key} is invalid`);
    }
    if (scan.objectCount > SAFETY_LIMITS.closureObjects || scan.objectBytes > SAFETY_LIMITS.closureBytes || scan.textBytes > SAFETY_LIMITS.requestBytes) fail('KSG-SCAN-LIMIT-001', 'scanner summary exceeds a fixed limit');
    return Object.freeze({ ...scan });
  }
  if (scan.state === 'REJECTED_LIMIT') {
    exactKeys(scan, ['state', 'limit'], 'scan');
    if (!['scan-timeout', 'closure-bytes'].includes(scan.limit)) fail('KSG-SCAN-FAILED-001', 'scanner limit result is invalid');
    return Object.freeze({ ...scan });
  }
  if (scan.state === 'REJECTED_SECRET') {
    exactKeys(scan, ['state', 'locator', 'matcherVersion'], 'scan');
    if (scan.matcherVersion !== MATCHER_VERSION || !plain(scan.locator)) fail('KSG-SCAN-FAILED-001', 'scanner secret result is invalid');
    const keys = Object.keys(scan.locator).sort();
    if (keys.length !== 2 || keys[1] !== 'offsetClass' || !Number.isSafeInteger(scan.locator.offsetClass) || scan.locator.offsetClass < 0) fail('KSG-SCAN-FAILED-001', 'scanner locator is invalid');
    if (keys[0] === 'fieldId') boundedString(scan.locator.fieldId, 'scan.locator.fieldId', 256);
    else if (keys[0] === 'objectId') oid(scan.locator.objectId, 'scan.locator.objectId');
    else fail('KSG-SCAN-FAILED-001', 'scanner locator kind is invalid');
    return Object.freeze({ state: scan.state, locator: Object.freeze({ ...scan.locator }), matcherVersion: scan.matcherVersion });
  }
  fail('KSG-SCAN-FAILED-001', 'scanner returned an unadmitted state');
}

function safeErrorCode(value, fallback) {
  return typeof value === 'string' && /^KSG-[A-Z0-9-]{1,80}$/u.test(value) ? value : fallback;
}

const EXECUTOR_ERROR_CODES = new Set(SAFETY_EXECUTOR_ERROR_CODES);

function safeExecutorErrorCode(value) {
  return EXECUTOR_ERROR_CODES.has(value) ? value : 'KSG-EXECUTE-FAILED-001';
}

function safeReceipt(value) {
  if (value === null || value === undefined) return { receipt: null, omitted: false };
  try {
    const serialized = canonicalJson(value);
    if (utf8(serialized) > 1_024 || findOutboundSecret(Buffer.from(serialized, 'utf8'))) return { receipt: null, omitted: true };
    return { receipt: structuredClone(value), omitted: false };
  } catch { return { receipt: null, omitted: true }; }
}

export class SafetyBroker {
  #key;
  #records = new Map();
  #pending = new Map();
  #executeIndex = new Map();
  #credentialOpenCount = 0;

  constructor({ scanner = new OutboundContentScanStageV1(), executor = createProductionSafetyExecutor(), clock = () => Math.floor(performance.now()), bootGeneration = 1, scanTimeoutMs = SAFETY_LIMITS.scanTimeoutMs } = {}) {
    if (!Number.isSafeInteger(scanTimeoutMs) || scanTimeoutMs < 1 || scanTimeoutMs > SAFETY_LIMITS.scanTimeoutMs) fail('KSG-SCAN-LIMIT-001', 'scan watchdog must be within the fixed production limit');
    if (executor !== null && typeof executor !== 'function') fail('KSG-SCHEMA-001', 'executor must be a closed capability function');
    this.scanner = scanner;
    this.executor = executor;
    this.clock = clock;
    this.bootGeneration = bootGeneration;
    this.scanTimeoutMs = scanTimeoutMs;
    this.#key = crypto.randomBytes(32);
  }

  get credentialOpenCount() { return this.#credentialOpenCount; }

  #finish(record, state, { result, reason } = {}) {
    record.state = state;
    if (result !== undefined) record.result = result;
    if (reason !== undefined) record.cancelReason = reason;
    for (const [key, indexed] of this.#executeIndex) if (indexed.record === record) this.#executeIndex.delete(key);
    delete record.requestBytes;
    delete record.request;
    delete record.scan;
    delete record.preview;
    delete record.attestation;
    delete record.votes;
    const terminal = [...this.#records.values()].filter((candidate) => TERMINAL.has(candidate.state));
    for (let index = 0; index < terminal.length - SAFETY_LIMITS.terminalRecords; index += 1) this.#records.delete(terminal[index].handleId);
  }

  #readyStatus(record) {
    return {
      handleId: record.handleId, state: record.state, preview: record.preview, previewDigest: record.previewDigest,
      attestation: record.attestation, expiresAt: record.expiresAt
    };
  }

  prepare(request) {
    const canonical = validateCanonicalRequest(request);
    const live = [...this.#records.values()].filter((record) => !TERMINAL.has(record.state) && record.request.sessionId === request.sessionId);
    const globalLive = [...this.#records.values()].filter((record) => !TERMINAL.has(record.state));
    const scans = live.filter((record) => record.state === 'HELD_SCAN').length;
    const globalScans = globalLive.filter((record) => record.state === 'HELD_SCAN').length;
    if (live.length >= SAFETY_LIMITS.sessionHandles || scans >= SAFETY_LIMITS.sessionScans || globalLive.length >= SAFETY_LIMITS.globalHandles || globalScans >= SAFETY_LIMITS.globalScans) return Object.freeze({ state: 'SATURATED' });
    const handleId = crypto.randomBytes(16).toString('hex');
    const record = {
      handleId, state: 'HELD_SCAN', request: canonical.request, requestBytes: canonical.bytes, requestDigest: canonical.digest,
      bootGeneration: this.bootGeneration, createdAt: this.clock(), votes: new Map(), consumed: false
    };
    this.#records.set(handleId, record);
    let watchdog;
    const scanWork = Promise.resolve().then(() => this.scanner.scan(record.request));
    const timeout = new Promise((resolve) => {
      watchdog = setTimeout(() => resolve(Object.freeze({ state: 'REJECTED_LIMIT', limit: 'scan-timeout' })), this.scanTimeoutMs);
      watchdog.unref?.();
    });
    const pending = Promise.race([scanWork, timeout]).then((unvalidatedScan) => {
      if (record.state !== 'HELD_SCAN') return;
      const scan = validateScanResult(unvalidatedScan);
      if (scan.state !== 'PASS') { this.#finish(record, scan.state, { result: scan }); return; }
      record.scan = scan; record.issuedAt = this.clock(); record.expiresAt = record.issuedAt + SAFETY_LIMITS.ttlMs;
      record.preview = previewFor(record.request, record.requestDigest, scan, record.expiresAt);
      record.previewDigest = sha256(record.preview); record.nonce = crypto.randomBytes(16).toString('hex');
      const body = attestationBody(record, this.bootGeneration);
      record.attestation = Object.freeze({ ...body, mac: crypto.createHmac('sha256', this.#key).update(canonicalJson(body)).digest('hex') });
      record.state = 'READY';
      if (responseBytes(this.#readyStatus(record)) > SAFETY_LIMITS.hookResponseBytes) fail('KSG-PREVIEW-LIMIT-001', 'complete READY response exceeds the fixed transport budget');
    }).catch((error) => {
      const state = error?.code === 'KSG-SCAN-LIMIT-001' || error?.code === 'KSG-PREVIEW-LIMIT-001' ? 'REJECTED_LIMIT' : 'FAILED';
      this.#finish(record, state, { result: { code: safeErrorCode(error?.code, 'KSG-SCAN-FAILED-001'), ...(error?.code === 'KSG-PREVIEW-LIMIT-001' ? { limit: 'response-bytes' } : {}) } });
    }).finally(() => { clearTimeout(watchdog); this.#pending.delete(handleId); });
    this.#pending.set(handleId, pending);
    return Object.freeze({ handleId, state: 'HELD_SCAN' });
  }

  async waitForScan(handleId) {
    await this.#pending.get(handleId);
    return this.status(handleId);
  }

  status(handleId) {
    const record = this.#records.get(handleId);
    if (!record) return Object.freeze({ state: 'NONE' });
    if (record.bootGeneration !== this.bootGeneration && !TERMINAL.has(record.state)) this.#finish(record, 'EXPIRED');
    if ((record.state === 'READY' || record.state === 'ASK_PENDING') && this.clock() >= record.expiresAt) this.#finish(record, 'EXPIRED');
    const safe = { handleId, state: record.state };
    if (record.state === 'READY') Object.assign(safe, this.#readyStatus(record));
    if (record.result?.locator) safe.locator = record.result.locator;
    if (record.result?.limit) safe.limit = record.result.limit;
    if (record.cancelReason) safe.reason = record.cancelReason;
    return Object.freeze(safe);
  }

  restart() {
    this.bootGeneration += 1; this.#key.fill(0); this.#key = crypto.randomBytes(32);
    for (const record of this.#records.values()) {
      if (record.state === 'EXECUTING') this.#finish(record, 'COMPLETED_AMBIGUOUS', { result: { code: 'KSG-BROKER-RESTART-AMBIGUOUS-001' } });
      else if (!TERMINAL.has(record.state)) this.#finish(record, 'EXPIRED');
    }
  }

  createHostBridge() {
    const broker = this;
    return Object.freeze({
      vote(scope, envelope) { return broker.#vote(approvalCapability, scope, envelope); },
      execute(envelope) { return broker.#execute(approvalCapability, envelope); }
    });
  }

  #verifiedRecord(handleId) {
    const record = this.#records.get(handleId);
    if (!record) fail('KSG-HANDLE-UNKNOWN-001', 'handle does not exist');
    this.status(handleId);
    if (record.consumed || (record.state !== 'READY' && record.state !== 'ASK_PENDING')) fail(record.consumed ? 'KSG-REPLAY-001' : 'KSG-HANDLE-NOT-READY-001', 'handle is not executable');
    const { mac, ...body } = record.attestation;
    const expected = crypto.createHmac('sha256', this.#key).update(canonicalJson(body)).digest('hex');
    if (!constantEqualHex(mac, expected)) fail('KSG-ATTESTATION-001', 'attestation is invalid');
    return record;
  }

  #vote(capability, scope, envelope) {
    if (capability !== approvalCapability || !['user', 'project'].includes(scope)) fail('KSG-BROKER-DIRECT-001', 'vote requires the inherited Host bridge');
    exactKeys(envelope, ['handleId', 'hostToolUseId', 'canonicalRequestDigest', 'previewDigest', 'cellKey'], 'vote');
    boundedString(envelope.handleId, 'vote.handleId', 64); boundedString(envelope.hostToolUseId, 'vote.hostToolUseId', 256);
    digest(envelope.canonicalRequestDigest, 'vote.canonicalRequestDigest'); digest(envelope.previewDigest, 'vote.previewDigest');
    boundedString(envelope.cellKey, 'vote.cellKey', 256);
    const record = this.#verifiedRecord(envelope.handleId);
    if (envelope.canonicalRequestDigest !== record.requestDigest || envelope.previewDigest !== record.previewDigest || envelope.cellKey !== record.request.cellKey) {
      this.#finish(record, 'CANCELLED', { reason: 'DIGEST_MISMATCH' }); return Object.freeze({ state: record.state, reason: record.cancelReason });
    }
    if (record.hostToolUseId !== undefined && record.hostToolUseId !== envelope.hostToolUseId) {
      this.#finish(record, 'CANCELLED', { reason: 'HOST_TOOL_USE_MISMATCH' });
      return Object.freeze({ state: record.state, reason: record.cancelReason });
    }
    const indexKey = `${record.request.sessionId}\0${envelope.hostToolUseId}`;
    const indexValue = canonicalJson({ handleId: record.handleId, canonicalRequestDigest: record.requestDigest, previewDigest: record.previewDigest, cellKey: record.request.cellKey });
    const existing = this.#executeIndex.get(indexKey);
    if (existing && existing.value !== indexValue) {
      this.#finish(record, 'CANCELLED', { reason: 'EXECUTE_INDEX_CONFLICT' });
      this.#finish(existing.record, 'CANCELLED', { reason: 'EXECUTE_INDEX_CONFLICT' });
      return Object.freeze({ state: record.state, reason: record.cancelReason });
    }
    this.#executeIndex.set(indexKey, { value: indexValue, record });
    record.votes.set(scope, indexValue); record.hostToolUseId = envelope.hostToolUseId;
    if (record.votes.size === 2) record.state = 'ASK_PENDING';
    return Object.freeze({ state: record.state, scopeVoteBitmap: [...record.votes.keys()].sort() });
  }

  async #execute(capability, envelope) {
    if (capability !== approvalCapability) fail('KSG-BROKER-DIRECT-001', 'execute requires the inherited approval-bound Host bridge');
    exactKeys(envelope, ['handleId', 'hostToolUseId', 'sessionId', 'approvalPreviewDigest', 'current'], 'execute');
    boundedString(envelope.handleId, 'execute.handleId', 64); boundedString(envelope.hostToolUseId, 'execute.hostToolUseId', 256);
    boundedString(envelope.sessionId, 'execute.sessionId', 256); digest(envelope.approvalPreviewDigest, 'execute.approvalPreviewDigest');
    const record = this.#verifiedRecord(envelope.handleId);
    record.consumed = true;
    try {
      if (record.state !== 'ASK_PENDING' || record.votes.size !== 2 || record.hostToolUseId !== envelope.hostToolUseId || record.request.sessionId !== envelope.sessionId) fail('KSG-APPROVAL-001', 'matching dual Hook votes and approval dispatch are required');
      const current = envelope.current;
      exactKeys(current, ['cellKey', 'policyGeneration', 'targetGeneration', 'targetFingerprintDigest', 'certificateDigest', 'remoteOldOidSetDigest', 'atomicPushSupported'], 'execute.current');
      boundedString(current.cellKey, 'execute.current.cellKey', 256); digest(current.targetFingerprintDigest, 'execute.current.targetFingerprintDigest'); digest(current.certificateDigest, 'execute.current.certificateDigest');
      if (!Number.isSafeInteger(current.policyGeneration) || current.policyGeneration < 0 || !Number.isSafeInteger(current.targetGeneration) || current.targetGeneration < 0) fail('KSG-SCHEMA-001', 'execute generations are invalid');
      if (record.request.action === 'git-push') digest(current.remoteOldOidSetDigest, 'execute.current.remoteOldOidSetDigest');
      else if (current.remoteOldOidSetDigest !== null) fail('KSG-SCHEMA-001', 'remote old-OID digest is only valid for push');
      if (record.request.action === 'git-push') {
        if (typeof current.atomicPushSupported !== 'boolean') fail('KSG-SCHEMA-001', 'atomic push support must be boolean');
      } else if (current.atomicPushSupported !== null) fail('KSG-SCHEMA-001', 'atomic push support is only valid for push');
      const recomputedRequestDigest = sha256(Buffer.from(canonicalJson(record.request), 'utf8'));
      const recomputedPreview = previewFor(record.request, record.requestDigest, record.scan, record.expiresAt);
      const mismatched = !constantEqualHex(recomputedRequestDigest, record.requestDigest)
        || !constantEqualHex(sha256(recomputedPreview), record.previewDigest)
        || !constantEqualHex(envelope.approvalPreviewDigest, record.previewDigest);
      if (mismatched) { this.#finish(record, 'CANCELLED', { reason: 'DIGEST_MISMATCH' }); return Object.freeze({ state: record.state, reason: record.cancelReason }); }
      const drift = current.cellKey !== record.request.cellKey ? 'CELL_DRIFT'
        : current.policyGeneration !== record.request.policyGeneration ? 'POLICY_DRIFT'
        : current.targetGeneration !== record.request.targetGeneration ? 'TARGET_DRIFT'
        : current.targetFingerprintDigest !== record.request.targetFingerprintDigest ? 'TARGET_FINGERPRINT_DRIFT'
        : current.certificateDigest !== record.request.certificateDigest ? 'CERTIFICATE_DRIFT'
        : null;
      if (drift) { this.#finish(record, 'CANCELLED', { reason: drift }); return Object.freeze({ state: record.state, reason: drift }); }
      if (record.request.action === 'git-push') {
        const expectedSet = sha256(canonicalJson(record.request.payload.updates.map(({ destinationRef, expectedRemoteOldOid }) => ({ destinationRef, expectedRemoteOldOid }))));
        if (current.remoteOldOidSetDigest !== expectedSet) { this.#finish(record, 'CANCELLED', { reason: 'REF_MOVED' }); return Object.freeze({ state: record.state, reason: record.cancelReason }); }
        if (record.request.payload.updates.length > 1 && current.atomicPushSupported !== true) { this.#finish(record, 'CANCELLED', { reason: 'ATOMIC_UNAVAILABLE' }); return Object.freeze({ state: record.state, reason: record.cancelReason }); }
      }
    } catch (error) {
      this.#finish(record, 'CANCELLED', { reason: 'INVALID_EXECUTE_ENVELOPE' });
      throw error;
    }
    if (this.executor === null) {
      const response = Object.freeze({ state: 'EXECUTE_FAILED', code: 'KSG-BROKER-UNAVAILABLE-001' });
      this.#finish(record, response.state);
      return response;
    }
    record.state = 'EXECUTING';
    if (record.request.action === 'git-push') this.#credentialOpenCount += 1;
    try {
      const result = await this.executor(structuredClone(record.request));
      if (record.state !== 'EXECUTING') return Object.freeze({ state: record.state, receipt: null });
      const receipt = safeReceipt(result?.receipt);
      const state = result?.ambiguous === true ? 'COMPLETED_AMBIGUOUS' : 'COMPLETED';
      const response = Object.freeze({ state, receipt: receipt.receipt, ...(receipt.omitted ? { code: 'KSG-RECEIPT-REJECTED-001' } : {}) });
      this.#finish(record, state);
      if (responseBytes(response) > SAFETY_LIMITS.hookResponseBytes) throw new Error('bounded execution response invariant failed');
      return response;
    } catch (error) {
      if (record.state !== 'EXECUTING') return Object.freeze({ state: record.state, code: 'KSG-BROKER-RESTART-AMBIGUOUS-001' });
      const state = error?.ambiguous === true ? 'COMPLETED_AMBIGUOUS' : 'EXECUTE_FAILED';
      const response = Object.freeze({ state, code: safeExecutorErrorCode(error?.code) });
      this.#finish(record, state);
      return response;
    }
  }

  // Public callers receive an explicit direct-launch denial. Only the closure
  // returned to the certified Host bootstrap has the unexported capability.
  execute() { fail('KSG-BROKER-DIRECT-001', 'direct execute is not available'); }

  testOnlyMutate(handleId, callback) {
    if (process.env.NODE_ENV !== 'test') fail('KSG-TEST-SEAM-001', 'test mutation seam is disabled');
    callback(this.#records.get(handleId));
  }
}

export function expectedRemoteOldOidSetDigest(request) {
  if (request.action !== 'git-push') return null;
  return sha256(canonicalJson(request.payload.updates.map(({ destinationRef, expectedRemoteOldOid }) => ({ destinationRef, expectedRemoteOldOid }))));
}
