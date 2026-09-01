#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { findConfig, readKStackConfig } from './kstack-config.mjs';
import { sanitize } from './kstack-provider-runner.mjs';

export const EXIT = Object.freeze({
  OK: 0,
  CONFIG_INVALID: 1,
  STATE_ERROR: 2,
  PREFLIGHT_FAILED: 3,
  DUPLICATE: 6,
  CONFIG_DRIFT: 8,
  APPROVAL_EXPIRED: 9,
  MALFORMED_CONTENT: 13,
  AMBIGUOUS_HISTORY: 14,
  PAYLOAD_INTEGRITY: 15,
  LOCK_HELD: 16,
  LOCK_FENCED_CLEAN: 17,
  LOCK_FENCED_DIRTY: 18,
  LOCK_BREAK_RACE: 19,
  INDEX_LAG_BLOCKED: 20
});
export const LOCK_HEARTBEAT_MS = 5000;
export const LOCK_STALE_MS = 90000;
export const VERIFY_CLEAR_MIN_AGE_FLOOR_MS = 30000;

const DRAFT_STATES = new Set(['pending', 'approved', 'submitting', 'submitted', 'failed', 'unknown', 'discarded']);
const ATTEMPT_OUTCOMES = new Set(['in-flight', 'success', 'failed', 'ambiguous', 'aborted-before-post']);
const RESERVED_FIELDS = new Set(['project', 'issuetype', 'summary', 'description', 'labels', 'security']);
const VERIFICATION_REASON = Object.freeze({
  INDEX_LAG: 'index-lag',
  SEARCH_UNAVAILABLE: 'search-unavailable',
  MARKER_AGE_UNMEASURABLE: 'marker-age-unmeasurable',
  MARKER_YOUNGER_THAN_INDEX_LAG_MINIMUM: 'marker-younger-than-index-lag-minimum'
});
const PRE_CONNECTION_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_SSL_WRONG_VERSION_NUMBER'
]);

export class JiraQueueError extends Error {
  constructor(message, exitCode, details = {}) {
    super(message);
    this.name = 'JiraQueueError';
    this.exitCode = exitCode;
    Object.assign(this, details);
  }
}

function fail(message, exitCode, details) {
  throw new JiraQueueError(message, exitCode, details);
}

function nowIso(clock = Date) {
  return new clock().toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonParse(value, description) {
  try { return JSON.parse(value); } catch (error) { fail(`${description}: ${sanitize(error.message)}`, EXIT.STATE_ERROR); }
}

function validateUuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail('draft id must be a UUID', EXIT.STATE_ERROR);
  }
  return value.toLowerCase();
}

function ensureWellFormed(value, field) {
  if (typeof value !== 'string' || !value.isWellFormed()) fail(`${field} must be well-formed Unicode`, EXIT.MALFORMED_CONTENT);
}

function versionParts(value) {
  return String(value).split('.').map((part) => Number.parseInt(part, 10) || 0);
}

function versionAtLeast(actual, minimum) {
  const left = versionParts(actual);
  const right = versionParts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

async function fsyncDirectory(directory) {
  const handle = await fsp.open(directory, fs.constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}

async function durableUnlink(file, directory, { missingOk = false } = {}) {
  try { await fsp.unlink(file); } catch (error) {
    if (!(missingOk && error.code === 'ENOENT')) throw error;
    return;
  }
  await fsyncDirectory(directory);
}

async function durableRename(source, destination, directory) {
  await fsp.rename(source, destination);
  await fsyncDirectory(directory);
}

async function durableJsonWrite(file, value, directory = path.dirname(file)) {
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  await fsp.chmod(directory, 0o700).catch(() => {});
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const handle = await fsp.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await durableRename(temporary, file, directory);
  await fsp.chmod(file, 0o600).catch(() => {});
}

async function readJsonFile(file, description = file) {
  const value = await fsp.readFile(file, 'utf8');
  return safeJsonParse(value, description);
}

function repoContains(repoRoot, candidate) {
  const relative = path.relative(repoRoot, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function descriptorRealpath(handle, sourcePath, descriptorStat) {
  const descriptorPath = process.platform === 'linux'
    ? `/proc/self/fd/${handle.fd}`
    : process.platform === 'darwin' ? `/dev/fd/${handle.fd}` : null;
  if (descriptorPath) return fsp.realpath(descriptorPath);
  const fileReal = await fsp.realpath(sourcePath);
  const pathStat = await fsp.stat(fileReal);
  if (pathStat.dev !== descriptorStat.dev || pathStat.ino !== descriptorStat.ino) {
    fail('credential file changed during descriptor validation', EXIT.CONFIG_INVALID);
  }
  return fileReal;
}

export async function validateCredentialFileHandle(source, repoRoot, handle) {
  if (!path.isAbsolute(source.path)) fail('credential file path must be absolute', EXIT.CONFIG_INVALID);
  let repoReal;
  let fileReal;
  let descriptorStat;
  let currentLinkStat;
  let currentPathStat;
  try {
    descriptorStat = await handle.stat();
    fileReal = await descriptorRealpath(handle, source.path, descriptorStat);
    repoReal = await fsp.realpath(repoRoot);
    currentLinkStat = await fsp.lstat(source.path);
    currentPathStat = await fsp.stat(await fsp.realpath(source.path));
  } catch (error) {
    if (error instanceof JiraQueueError) throw error;
    fail(`credential file validation failed: ${sanitize(error.message)}`, EXIT.CONFIG_INVALID);
  }
  if (!descriptorStat.isFile()) fail('credential source is not a regular file', EXIT.CONFIG_INVALID);
  if (currentLinkStat.isSymbolicLink()) fail('credential file path must not be a symlink', EXIT.CONFIG_INVALID);
  if (currentPathStat.dev !== descriptorStat.dev || currentPathStat.ino !== descriptorStat.ino) {
    fail('credential file changed after it was opened', EXIT.CONFIG_INVALID);
  }
  if (repoContains(repoReal, fileReal)) fail('credential file must be outside the repository', EXIT.CONFIG_INVALID);
  return { fileReal, stat: descriptorStat };
}

export async function loadJiraState(options = {}) {
  const configPath = options.configPath ? path.resolve(options.configPath) : findConfig(options.cwd || process.cwd());
  if (!configPath) fail('No .kstack/config.json found.', EXIT.CONFIG_INVALID);
  let config;
  try { config = readKStackConfig(configPath, { command: options.command }); } catch (error) {
    fail(`could not load config: ${sanitize(error.message)}`, EXIT.CONFIG_INVALID);
  }
  const repoRoot = path.dirname(path.dirname(configPath));
  if (!versionAtLeast(process.versions.node, config.jira.nodeMinVersion)) {
    fail(`Node ${config.jira.nodeMinVersion}+ is required; found ${process.versions.node}`, EXIT.CONFIG_INVALID);
  }
  return {
    config,
    jira: config.jira,
    configPath,
    repoRoot,
    ...(config.jira.deliveryRecordPath ? { deliveryRecordPath: path.resolve(config.jira.deliveryRecordPath) } : {}),
    queueDir: path.join(repoRoot, '.kstack', 'jira-queue'),
    fetchImpl: options.fetchImpl || globalThis.fetch,
    clock: options.clock || Date,
    poll: options.poll || {}
  };
}

export async function resolveCredentials(state) {
  const source = state.jira.credentialSource;
  let email;
  let token;
  if (source.type === 'env') {
    email = process.env[source.emailEnvVar];
    token = process.env[source.tokenEnvVar];
  } else {
    let handle;
    try {
      if (!path.isAbsolute(source.path)) fail('credential file path must be absolute', EXIT.CONFIG_INVALID);
      const preOpenStat = await fsp.lstat(source.path);
      if (preOpenStat.isSymbolicLink()) fail('credential file path must not be a symlink', EXIT.CONFIG_INVALID);
      if (!preOpenStat.isFile()) fail('credential source is not a regular file', EXIT.CONFIG_INVALID);
      handle = await fsp.open(source.path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
      const { stat } = await validateCredentialFileHandle(source, state.repoRoot, handle);
      if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) fail('credential file is not owned by the invoking user', EXIT.CONFIG_INVALID);
      if (!source.allowInsecurePermissions && (stat.mode & 0o077) !== 0) fail('credential file grants group/other access', EXIT.CONFIG_INVALID);
      const bytes = await handle.readFile();
      let credentialText;
      try { credentialText = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {
        fail('credential file must be valid UTF-8', EXIT.CONFIG_INVALID);
      }
      let parsed;
      try { parsed = JSON.parse(credentialText); } catch {
        fail('credential file is invalid JSON', EXIT.CONFIG_INVALID);
      }
      if (!isPlainObject(parsed) || Object.keys(parsed).sort().join(',') !== 'email,token') fail('credential file must contain exactly email and token', EXIT.CONFIG_INVALID);
      ({ email, token } = parsed);
    } catch (error) {
      if (error instanceof JiraQueueError) throw error;
      fail(`credential file could not be opened safely: ${sanitize(error.message)}`, EXIT.CONFIG_INVALID);
    } finally {
      await handle?.close().catch(() => {});
    }
  }
  email = typeof email === 'string' ? email.trim() : '';
  if (!email || typeof token !== 'string' || token.length === 0) fail('Jira credentials could not be resolved', EXIT.CONFIG_DRIFT);
  if (email.includes(':')) fail('Jira email must not contain a colon', EXIT.CONFIG_DRIFT);
  return { email, token };
}

export function authorizationHeader(credentials) {
  return `Basic ${Buffer.from(`${credentials.email}:${credentials.token}`, 'utf8').toString('base64')}`;
}

export function configFingerprint(state, draft, resolvedEmail) {
  const source = state.jira.credentialSource;
  const pointer = source.type === 'env'
    ? { type: source.type, emailEnvVar: source.emailEnvVar, tokenEnvVar: source.tokenEnvVar }
    : { type: source.type, path: source.path };
  return sha256(Buffer.from(JSON.stringify({
    siteUrl: state.jira.siteUrl,
    apiBaseUrl: state.jira.apiBaseUrl ?? null,
    project: draft.project,
    issueType: draft.issueType,
    credentialSource: pointer,
    resolvedEmail
  }), 'utf8'));
}

function draftPath(state, id) {
  return path.join(state.queueDir, `${validateUuid(id)}.json`);
}

export function validateDraft(draft) {
  if (!isPlainObject(draft) || draft.schemaVersion !== 1 || !DRAFT_STATES.has(draft.state)) fail('invalid Jira draft schema/state', EXIT.STATE_ERROR);
  validateUuid(draft.id);
  if (draft.idempotencyLabel !== `kstack-draft-${draft.id}`) fail('invalid draft idempotency label', EXIT.STATE_ERROR);
  ensureWellFormed(draft.content?.summary, 'content.summary');
  ensureWellFormed(draft.content?.descriptionText, 'content.descriptionText');
  if (!Array.isArray(draft.attempts) || !Array.isArray(draft.audit)) fail('invalid draft attempts/audit', EXIT.STATE_ERROR);
  if (draft.attempts.some((attempt) => !isPlainObject(attempt) || !ATTEMPT_OUTCOMES.has(attempt.outcome))) fail('invalid attempt outcome', EXIT.STATE_ERROR);
  return draft;
}

async function loadDraft(state, id) {
  try { return validateDraft(await readJsonFile(draftPath(state, id), 'draft is invalid JSON')); } catch (error) {
    if (error.code === 'ENOENT') fail(`draft ${id} not found`, EXIT.STATE_ERROR);
    throw error;
  }
}

function queueAudit(draft, event, details = {}, clock = Date) {
  const entry = { auditId: crypto.randomUUID(), event, at: nowIso(clock), ...details };
  draft.audit.push(entry);
  draft.updatedAt = entry.at;
  return entry;
}

function adf(text) {
  return {
    version: 1,
    type: 'doc',
    content: text.length ? text.split(/\n{2,}/).map((paragraph) => ({
      type: 'paragraph',
      content: paragraph.length ? [{ type: 'text', text: paragraph }] : []
    })) : []
  };
}

export function buildCanonicalPayload(state, draft) {
  const project = state.jira.projects.find((item) => item.key === draft.project);
  if (!project || !project.issueTypes.includes(draft.issueType)) fail('draft project/issueType is no longer configured', EXIT.STATE_ERROR);
  const fields = {
    project: { key: draft.project },
    issuetype: { name: draft.issueType },
    summary: draft.content.summary,
    description: adf(draft.content.descriptionText),
    labels: [draft.idempotencyLabel, ...state.jira.staticLabels]
  };
  for (const [key, value] of Object.entries(project.defaultFields)) {
    if (RESERVED_FIELDS.has(key)) fail(`reserved defaultFields key: ${key}`, EXIT.CONFIG_INVALID);
    fields[key] = value;
  }
  return JSON.stringify({ fields });
}

function lockPaths(state, id, lockId) {
  return {
    lock: path.join(state.queueDir, `${id}.lock`),
    temporary: path.join(state.queueDir, `${id}.lock.tmp.${lockId}`),
    tombstone: path.join(state.queueDir, `${id}.tombstone.${lockId}.json`),
    released: path.join(state.queueDir, `${id}.released.${lockId}.json`),
    orphan: path.join(state.queueDir, `${id}.orphan.${lockId}.json`)
  };
}

async function readLockIdentity(file) {
  try {
    const [content, stat] = await Promise.all([fsp.readFile(file, 'utf8'), fsp.stat(file)]);
    let parsed = null;
    try { parsed = JSON.parse(content); } catch {}
    return { parsed, stat, content };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function sameObservedLock(left, right) {
  if (!left || !right) return false;
  if (left.parsed?.lockId) return left.parsed.lockId === right.parsed?.lockId && left.stat.mtimeMs === right.stat.mtimeMs;
  return left.stat.dev === right.stat.dev && left.stat.ino === right.stat.ino && left.stat.size === right.stat.size && left.stat.mtimeMs === right.stat.mtimeMs;
}

async function writeOrphan(lock, details) {
  const value = {
    lockId: lock.lockId,
    ...(details.attemptId ? { attemptId: details.attemptId } : {}),
    at: nowIso(lock.state.clock),
    op: lock.op,
    posted: Boolean(details.posted),
    wroteAfterFence: Boolean(details.wroteAfterFence),
    ...(details.responseClass ? { responseClass: details.responseClass } : {}),
    ...(details.issueId ? { issueId: details.issueId } : {}),
    ...(details.issueKey ? { issueKey: details.issueKey } : {})
  };
  await durableJsonWrite(lock.paths.orphan, value, lock.state.queueDir);
  lock.handoffWritten = true;
  return value;
}

export async function acquireDraftLock(state, id, op, options = {}) {
  id = validateUuid(id);
  await fsp.mkdir(state.queueDir, { recursive: true, mode: 0o700 });
  await fsp.chmod(state.queueDir, 0o700).catch(() => {});
  const lockId = options.lockId || crypto.randomBytes(16).toString('hex');
  const paths = lockPaths(state, id, lockId);
  const staleMs = options.staleMs ?? LOCK_STALE_MS;
  let brokePrevious = null;
  for (;;) {
    const existingDraft = await loadDraft(state, id);
    const content = {
      lockId,
      pid: process.pid,
      hostname: os.hostname(),
      acquiredAt: nowIso(state.clock),
      op,
      stateAtAcquisition: existingDraft.state,
      brokePrevious
    };
    let handle;
    try {
      handle = await fsp.open(paths.temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
      await handle.writeFile(`${JSON.stringify(content)}\n`, 'utf8');
      await handle.sync();
      try {
        await fsp.link(paths.temporary, paths.lock);
        await fsyncDirectory(state.queueDir);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const existing = await readLockIdentity(paths.lock);
        if (existing?.parsed?.lockId === lockId) {
          await durableUnlink(paths.temporary, state.queueDir, { missingOk: true });
          const stat = await handle.stat();
          return startHeartbeat({ state, id, op, lockId, paths, handle, stat, content }, options);
        }
        await handle.close();
        handle = null;
        await durableUnlink(paths.temporary, state.queueDir, { missingOk: true });
        if (!existing) continue;
        if (Date.now() - existing.stat.mtimeMs <= staleMs) {
          fail(`draft lock is held by ${existing.parsed?.hostname || 'unknown'} pid ${existing.parsed?.pid || 'unknown'}`, EXIT.LOCK_HELD, { holder: existing.parsed });
        }
        const rechecked = await readLockIdentity(paths.lock);
        if (!sameObservedLock(existing, rechecked)) fail('draft lock became live during stale-break check', EXIT.LOCK_HELD);
        try {
          await durableRename(paths.lock, paths.tombstone, state.queueDir);
        } catch (renameError) {
          if (renameError.code === 'ENOENT') continue;
          throw renameError;
        }
        const claimed = await readLockIdentity(paths.tombstone);
        const correctlyClaimed = existing.parsed?.lockId
          ? claimed?.parsed?.lockId === existing.parsed.lockId
          : claimed && claimed.stat.dev === existing.stat.dev && claimed.stat.ino === existing.stat.ino;
        if (!correctlyClaimed) {
          const lockStillAbsent = !(await readLockIdentity(paths.lock));
          if (lockStillAbsent) {
            try {
              await durableRename(paths.tombstone, paths.lock, state.queueDir);
              fail('stale-break raced with another holder', EXIT.LOCK_HELD);
            } catch (restoreError) {
              if (restoreError instanceof JiraQueueError) throw restoreError;
            }
          }
          const raceArtifact = { ...(claimed?.parsed || {}), breakRace: true, breakerLockId: lockId };
          await durableJsonWrite(paths.tombstone, raceArtifact, state.queueDir).catch(() => {});
          fail('stale-break mis-claim could not be restored', EXIT.LOCK_BREAK_RACE);
        }
        brokePrevious = existing.parsed || {
          lockId: null,
          observed: { dev: String(existing.stat.dev), ino: String(existing.stat.ino), size: existing.stat.size, mtimeMs: existing.stat.mtimeMs }
        };
        continue;
      }
      await durableUnlink(paths.temporary, state.queueDir);
      const stat = await handle.stat();
      return startHeartbeat({ state, id, op, lockId, paths, handle, stat, content }, options);
    } catch (error) {
      await handle?.close().catch(() => {});
      if (error.code === 'EEXIST' && error.path === paths.temporary) {
        await durableUnlink(paths.temporary, state.queueDir, { missingOk: true });
        continue;
      }
      await durableUnlink(paths.temporary, state.queueDir, { missingOk: true }).catch(() => {});
      throw error;
    }
  }
}

function startHeartbeat(lock, options) {
  if (!options.disableHeartbeat) {
    lock.heartbeat = setInterval(() => {
      const current = new Date();
      lock.handle.utimes(current, current).catch(() => {});
    }, options.heartbeatMs ?? LOCK_HEARTBEAT_MS);
    lock.heartbeat.unref();
  }
  return lock;
}

export async function assertFence(lock) {
  let pathHandle;
  try {
    pathHandle = await fsp.open(lock.paths.lock, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const [content, stat] = await Promise.all([pathHandle.readFile('utf8'), pathHandle.stat()]);
    const parsed = JSON.parse(content);
    if (parsed.lockId !== lock.lockId) return false;
    if (stat.dev !== lock.stat.dev || stat.ino !== lock.stat.ino) return false;
    return true;
  } catch {
    return false;
  } finally {
    await pathHandle?.close().catch(() => {});
  }
}

export async function guardedWriteDraft(lock, draft, residue = {}, hooks = {}) {
  if (!(await assertFence(lock))) {
    await writeOrphan(lock, { ...residue, wroteAfterFence: false });
    fail('draft lock fence was lost before write', residue.posted ? EXIT.LOCK_FENCED_DIRTY : EXIT.LOCK_FENCED_CLEAN);
  }
  await hooks.beforeWrite?.();
  await durableJsonWrite(draftPath(lock.state, lock.id), draft, lock.state.queueDir);
  await hooks.afterWrite?.();
  if (!(await assertFence(lock))) {
    await writeOrphan(lock, { ...residue, posted: residue.postedAfterWrite ?? residue.posted, wroteAfterFence: true });
    fail('draft lock fence was lost after write', EXIT.LOCK_FENCED_DIRTY);
  }
}

export async function releaseDraftLock(lock, residue = {}) {
  if (lock.released) return;
  lock.released = true;
  if (lock.handoffWritten) {
    clearInterval(lock.heartbeat);
    await lock.handle.close().catch(() => {});
    return;
  }
  if (!(await assertFence(lock))) {
    clearInterval(lock.heartbeat);
    await writeOrphan(lock, { ...residue, wroteAfterFence: false });
    await lock.handle.close().catch(() => {});
    fail('draft lock was fenced before release', residue.posted ? EXIT.LOCK_FENCED_DIRTY : EXIT.LOCK_FENCED_CLEAN);
  }
  try {
    await durableRename(lock.paths.lock, lock.paths.released, lock.state.queueDir);
  } catch (error) {
    clearInterval(lock.heartbeat);
    await writeOrphan(lock, { ...residue, wroteAfterFence: false });
    await lock.handle.close().catch(() => {});
    if (error.code === 'ENOENT') fail('draft lock disappeared during release', residue.posted ? EXIT.LOCK_FENCED_DIRTY : EXIT.LOCK_FENCED_CLEAN);
    throw error;
  }
  clearInterval(lock.heartbeat);
  const claimed = await readLockIdentity(lock.paths.released);
  if (claimed?.parsed?.lockId !== lock.lockId) {
    await writeOrphan(lock, { ...residue, wroteAfterFence: false });
    if (!(await readLockIdentity(lock.paths.lock))) {
      try {
        await durableRename(lock.paths.released, lock.paths.lock, lock.state.queueDir);
        await lock.handle.close();
        fail('release claim displaced another holder and was restored', residue.posted ? EXIT.LOCK_FENCED_DIRTY : EXIT.LOCK_FENCED_CLEAN);
      } catch (error) {
        if (error instanceof JiraQueueError) throw error;
      }
    }
    await lock.handle.close().catch(() => {});
    fail('release claim race could not be restored', EXIT.LOCK_BREAK_RACE);
  }
  await durableUnlink(lock.paths.released, lock.state.queueDir, { missingOk: true });
  await lock.handle.close();
}

function artifactPattern(id) {
  return new RegExp(`^${id}\\.(tombstone|orphan|released|lock\\.tmp)\\.([^.]+)(?:\\.json)?$`);
}

function hasAuditEvidence(draft, event, lockId) {
  return draft.audit.some((entry) => entry.event === event && entry.lockId === lockId);
}

function duplicateKeys(entry) {
  return [...new Set([...(entry.keys || []), entry.issueKey].filter(Boolean))];
}

function unresolvedDuplicateEntries(draft) {
  const unresolved = [];
  for (const entry of draft.audit) {
    if (entry.event === 'duplicate-detected') unresolved.push(entry);
    if (entry.event === 'duplicate-acknowledged' || entry.event === 'duplicate-dismissed') unresolved.length = 0;
  }
  return unresolved;
}

function latestResolutionIndex(draft, events) {
  let index = -1;
  draft.audit.forEach((entry, candidate) => { if (events.has(entry.event)) index = candidate; });
  return index;
}

function coveredByAbortRecovery(draft, entry) {
  return entry.posted === false &&
    entry.attemptId &&
    draft.audit.some((candidate) =>
      candidate.event === 'submit-recovered' &&
      candidate.recovery === 'aborted-before-post' &&
      candidate.attemptId === entry.attemptId &&
      (!candidate.lockId || !entry.lockId || candidate.lockId === entry.lockId)
    );
}

function unresolvedSearchEvidence(draft) {
  const clearIndex = latestResolutionIndex(draft, new Set(['verify-clear', 'verify-confirmed', 'duplicate-acknowledged', 'duplicate-dismissed']));
  return draft.audit.slice(clearIndex + 1).filter((entry) =>
    (['lock-broken', 'lock-break-race'].includes(entry.event) && (entry.op === 'submit' || entry.stateAtAcquisition === 'submitting')) ||
    (entry.event === 'stale-holder-outcome' && !entry.issueKey && !coveredByAbortRecovery(draft, entry))
  );
}

function unresolvedDirectEvidence(draft) {
  const resolutionIndex = latestResolutionIndex(draft, new Set(['duplicate-acknowledged', 'duplicate-dismissed']));
  return draft.audit.slice(resolutionIndex + 1).filter((entry) =>
    (entry.event === 'stale-holder-outcome' && entry.posted === true && entry.issueKey) ||
    (entry.event === 'duplicate-detected' && entry.directEvidence === true)
  );
}

function unresolvedRetryVerify(draft) {
  const verifyResults = new Set(['verify-confirmed', 'verify-clear', 'duplicate-detected']);
  let pending = false;
  for (const entry of draft.audit) {
    if (entry.event === 'retry-backoff') pending = true;
    if (verifyResults.has(entry.event)) pending = false;
  }
  return pending;
}

function unresolvedRetryMarkers(draft) {
  const markers = [];
  for (const entry of draft.audit) {
    if (entry.event === 'retry-backoff') markers.push(entry);
    if (['verify-confirmed', 'verify-clear', 'duplicate-detected'].includes(entry.event)) markers.length = 0;
  }
  return markers;
}

function unresolvedVerifyFailure(draft) {
  let pending = false;
  for (const entry of draft.audit) {
    if (['verify-network-failed', 'verify-visibility-failed'].includes(entry.event)) pending = true;
    if (['verify-confirmed', 'verify-inconclusive', 'verify-clear', 'duplicate-detected', 'duplicate-acknowledged', 'duplicate-dismissed'].includes(entry.event)) pending = false;
  }
  return pending;
}

function sanitizeStructure(value) {
  if (typeof value === 'string') return sanitize(value);
  if (Array.isArray(value)) return value.map(sanitizeStructure);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeStructure(child)]));
  return value;
}

function unresolvedAmbiguousHistory(draft) {
  if (!draft.attempts.some((attempt) => attempt.outcome === 'ambiguous')) return [];
  const clearedAt = latestResolutionIndex(draft, new Set(['verify-confirmed', 'duplicate-acknowledged']));
  const ambiguousAt = draft.attempts.reduce((latest, attempt) => attempt.outcome === 'ambiguous' ? Math.max(latest, Date.parse(attempt.finishedAt || attempt.startedAt)) : latest, -1);
  if (clearedAt < 0) return draft.attempts.filter((attempt) => attempt.outcome === 'ambiguous');
  return Date.parse(draft.audit[clearedAt].at) >= ambiguousAt ? [] : draft.attempts.filter((attempt) => attempt.outcome === 'ambiguous');
}

async function foldArtifact(lock, draft, file, kind, artifactLockId) {
  if (kind === 'lock.tmp') {
    const stat = await fsp.stat(file).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) await durableUnlink(file, lock.state.queueDir, { missingOk: true });
    return draft;
  }
  const artifact = await readJsonFile(file, 'queue artifact is invalid JSON').catch(() => ({}));
  let event;
  let details;
  if (kind === 'tombstone') {
    event = artifact.breakRace === true || typeof artifact.lockId !== 'string' ? 'lock-break-race' : 'lock-broken';
    details = sanitizeStructure({
      lockId: artifact.lockId || artifactLockId,
      pid: artifact.pid,
      hostname: artifact.hostname,
      acquiredAt: artifact.acquiredAt,
      op: artifact.op,
      stateAtAcquisition: artifact.stateAtAcquisition,
      brokePrevious: artifact.brokePrevious
    });
  } else if (kind === 'released') {
    event = artifact.lockId === artifactLockId ? 'lock-released-late' : 'lock-break-race';
    details = sanitizeStructure({ lockId: artifact.lockId || artifactLockId, op: artifact.op, stateAtAcquisition: artifact.stateAtAcquisition });
  } else {
    event = 'stale-holder-outcome';
    details = sanitizeStructure({
      lockId: artifact.lockId || artifactLockId,
      attemptId: artifact.attemptId,
      op: artifact.op,
      posted: artifact.posted === true,
      wroteAfterFence: artifact.wroteAfterFence === true,
      responseClass: artifact.responseClass,
      issueId: artifact.issueId,
      issueKey: artifact.issueKey
    });
  }
  if (!hasAuditEvidence(draft, event, details.lockId)) {
    queueAudit(draft, event, details, lock.state.clock);
    if (event === 'stale-holder-outcome' && details.posted === true && details.issueKey) {
      queueAudit(draft, 'duplicate-detected', {
        keys: [details.issueKey],
        directEvidence: true,
        sourceLockId: details.lockId
      }, lock.state.clock);
    }
    await guardedWriteDraft(lock, draft);
  }
  await durableUnlink(file, lock.state.queueDir, { missingOk: true });
  return draft;
}

export async function janitorDraft(lock) {
  let draft = await loadDraft(lock.state, lock.id);
  const entries = await fsp.readdir(lock.state.queueDir).catch(() => []);
  const pattern = artifactPattern(lock.id);
  for (const name of entries.sort()) {
    const match = pattern.exec(name);
    if (!match) continue;
    const [, kind, artifactLockId] = match;
    if (kind === 'lock.tmp' && artifactLockId === lock.lockId) continue;
    draft = await foldArtifact(lock, draft, path.join(lock.state.queueDir, name), kind, artifactLockId);
  }
  return draft;
}

async function queueDraftIds(state) {
  const names = await fsp.readdir(state.queueDir).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  return [...new Set(names.map((name) => /^([0-9a-f-]{36})\.(?:json|lock|tombstone|orphan|released)/i.exec(name)?.[1]).filter(Boolean))].sort();
}

export async function sweepQueue(state, options = {}) {
  const result = { swept: [], held: [], errors: [] };
  for (const id of await queueDraftIds(state)) {
    if (id === options.excludeId) continue;
    let lock;
    try {
      lock = await acquireDraftLock(state, id, options.op || 'status');
      await janitorDraft(lock);
      result.swept.push(id);
    } catch (error) {
      if (error instanceof JiraQueueError && error.exitCode === EXIT.LOCK_HELD) result.held.push(id);
      else result.errors.push({ id, error: sanitize(error.message) });
    } finally {
      if (lock) await releaseDraftLock(lock).catch((error) => result.errors.push({ id, error: sanitize(error.message) }));
    }
  }
  return result;
}

function requestUrl(state, endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.startsWith('//')) fail('Jira request endpoint is invalid', EXIT.CONFIG_INVALID);
  const base = state.jira.apiBaseUrl || state.jira.siteUrl;
  return `${base.replace(/\/$/u, '')}${endpoint}`;
}

async function responseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function jiraRequest(state, credentials, endpoint, options = {}) {
  const headers = {
    Accept: 'application/json',
    Authorization: authorizationHeader(credentials),
    ...options.headers
  };
  return state.fetchImpl(requestUrl(state, endpoint), {
    method: options.method || 'GET',
    headers,
    body: options.body,
    redirect: 'manual',
    signal: AbortSignal.timeout(options.timeoutMs || state.jira.timeoutMs)
  });
}

function nestedErrorCodes(error) {
  const codes = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if (typeof current.code === 'string') codes.push(current.code);
    current = current.cause;
  }
  return codes;
}

export function classifyFetchError(error) {
  const codes = nestedErrorCodes(error);
  if (codes.some((code) => PRE_CONNECTION_CODES.has(code))) return { state: 'failed', outcome: 'failed', responseClass: 'pre-connection-failure' };
  return { state: 'unknown', outcome: 'ambiguous', responseClass: 'unknown-fetch-error' };
}

export async function classifyCreateResponse(response) {
  const status = response.status;
  const body = await responseBody(response);
  if (status >= 200 && status < 300) {
    if (body && body.id && body.key) return { state: 'submitted', outcome: 'success', responseClass: 'success', issueId: String(body.id), issueKey: String(body.key) };
    return { state: 'unknown', outcome: 'ambiguous', responseClass: 'success-missing-key' };
  }
  if (status >= 300 && status < 400) return { state: 'unknown', outcome: 'ambiguous', responseClass: 'redirect' };
  if (status === 408) return { state: 'unknown', outcome: 'ambiguous', responseClass: 'request-timeout' };
  if (status === 429) return { state: 'unknown', outcome: 'ambiguous', responseClass: 'rate-limited', retryAfter: response.headers.get('retry-after') };
  if (status >= 400 && status < 500) return { state: 'failed', outcome: 'failed', responseClass: `http-${status}` };
  return { state: 'unknown', outcome: 'ambiguous', responseClass: `http-${status}` };
}

function parseRetryAfter(value, clock = Date) {
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) return Math.max(0, Number(value) * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - new clock().getTime()) : null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function jiraJson(state, credentials, endpoint, options = {}) {
  let response;
  try { response = await jiraRequest(state, credentials, endpoint, options); } catch (error) {
    fail(`Jira request failed: ${sanitize(error.message)}`, EXIT.STATE_ERROR, { network: true, classification: classifyFetchError(error) });
  }
  const body = await responseBody(response);
  if (!response.ok || !body) fail(`Jira request returned HTTP ${response.status}`, EXIT.STATE_ERROR, { httpStatus: response.status, network: true });
  return body;
}

async function projectSecurityScheme(state, credentials, projectKey) {
  try {
    const project = await jiraJson(state, credentials, `/rest/api/3/project/${encodeURIComponent(projectKey)}`);
    const result = await jiraJson(state, credentials, `/rest/api/3/issuesecurityschemes/project?projectId=${encodeURIComponent(project.id)}`);
    const values = result.values || result.issueSecuritySchemes || [];
    return { checked: true, hasScheme: Array.isArray(values) && values.length > 0, values };
  } catch (error) {
    return { checked: false, hasScheme: null, detail: sanitize(error.message) };
  }
}

async function visibilityPrecheck(state, credentials, projectKey) {
  try {
    const permissions = await jiraJson(state, credentials, `/rest/api/3/mypermissions?projectKey=${encodeURIComponent(projectKey)}&permissions=BROWSE_PROJECTS`);
    const browse = permissions.permissions?.BROWSE_PROJECTS;
    if (!browse || browse.havePermission !== true) return { ok: false, detail: 'BROWSE_PROJECTS is absent or false' };
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: sanitize(error.message) };
  }
}

function escapeJql(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function searchOnce(state, credentials, draft, deadline = Infinity) {
  const keys = [];
  let nextPageToken;
  do {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) fail('Jira search poll deadline expired', EXIT.STATE_ERROR, { pollDeadline: true });
    const request = {
      jql: `project = "${escapeJql(draft.project)}" AND labels = "${escapeJql(draft.idempotencyLabel)}"`,
      fields: ['key'],
      maxResults: 100,
      ...(nextPageToken ? { nextPageToken } : {})
    };
    const response = await jiraJson(state, credentials, '/rest/api/3/search/jql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify(request), 'utf8'),
      timeoutMs: Math.min(state.jira.timeoutMs, remainingMs)
    });
    if (!Array.isArray(response.issues)) fail('Jira search response lacks issues[]', EXIT.STATE_ERROR);
    keys.push(...response.issues.map((issue) => issue.key).filter((key) => typeof key === 'string'));
    nextPageToken = response.nextPageToken;
    if (typeof response.isLast !== 'boolean' && nextPageToken === undefined) fail('Jira search response lacks cursor-pagination shape', EXIT.STATE_ERROR);
    if (response.isLast === false && !nextPageToken) fail('Jira search pagination lacks nextPageToken', EXIT.STATE_ERROR);
  } while (nextPageToken);
  return [...new Set(keys)];
}

export async function boundedSearch(state, credentials, draft) {
  const visibility = await visibilityPrecheck(state, credentials, draft.project);
  if (!visibility.ok) return { kind: 'visibility-failed', detail: visibility.detail };
  const minimumProbes = state.poll.minimumProbes ?? 3;
  const minimumDurationMs = state.poll.minimumDurationMs ?? 30000;
  const maximumProbes = state.poll.maximumProbes ?? 10;
  const maximumDurationMs = state.poll.maximumDurationMs ?? 300000;
  const minimumInterProbeMs = Math.ceil(minimumDurationMs / Math.max(1, minimumProbes));
  const started = Date.now();
  const deadline = started + maximumDurationMs;
  let probes = 0;
  while (probes < maximumProbes && Date.now() - started < maximumDurationMs) {
    probes += 1;
    let keys;
    try { keys = await searchOnce(state, credentials, draft, deadline); } catch (error) {
      if (error.pollDeadline || Date.now() >= deadline) {
        return { kind: 'inconclusive', reason: 'poll-deadline', probes, elapsedMs: Date.now() - started, complete: false };
      }
      return { kind: 'network-failed', detail: sanitize(error.message) };
    }
    if (keys.length) return { kind: 'matches', keys, probes, elapsedMs: Date.now() - started, complete: true };
    const elapsed = Date.now() - started;
    if (probes >= minimumProbes && elapsed >= minimumDurationMs) return { kind: 'matches', keys: [], probes, elapsedMs: elapsed, complete: true };
    const remaining = maximumDurationMs - elapsed;
    if (remaining <= 0 || probes >= maximumProbes) break;
    const minimumRemaining = Math.max(0, minimumDurationMs - elapsed);
    const intervalsNeeded = Math.max(1, minimumProbes - probes);
    await wait(Math.min(remaining, Math.max(1, minimumInterProbeMs, Math.ceil(minimumRemaining / intervalsNeeded))));
  }
  return { kind: 'inconclusive', reason: 'poll-bounds-exhausted', probes, elapsedMs: Date.now() - started, complete: false };
}

function projectConfig(state, projectKey, issueType) {
  const project = state.jira.projects.find((item) => item.key === projectKey);
  if (!project) fail(`project ${projectKey} is not configured`, EXIT.STATE_ERROR);
  if (issueType && !project.issueTypes.includes(issueType)) fail(`issue type ${issueType} is not configured for ${projectKey}`, EXIT.STATE_ERROR);
  return project;
}

async function withDraftLock(state, id, op, action) {
  const lock = await acquireDraftLock(state, id, op);
  let residue = {};
  let actionError;
  try {
    let draft = await janitorDraft(lock);
    const result = await action(lock, draft, (next) => { residue = { ...residue, ...next }; });
    return result;
  } catch (error) {
    actionError = error;
    throw error;
  } finally {
    try { await releaseDraftLock(lock, residue); } catch (releaseError) {
      if (!actionError) throw releaseError;
      // The action error remains primary so its established exit code is preserved;
      // a separate release/fencing failure is exposed to programmatic callers here.
      if (actionError && typeof actionError === 'object') actionError.releaseError = releaseError;
    }
  }
}

async function createDraft(state, args) {
  const id = args.trackingDraftId ? validateUuid(args.trackingDraftId) : crypto.randomUUID();
  let source;
  if (args.from) source = await loadDraft(state, validateUuid(args.from));
  const project = args.project || source?.project || state.jira.projects[0]?.key;
  const issueType = args.issueType || source?.issueType || projectConfig(state, project).issueTypes[0];
  projectConfig(state, project, issueType);
  const summary = args.summary ?? source?.content.summary;
  const descriptionText = args.description ?? source?.content.descriptionText ?? '';
  ensureWellFormed(summary, 'content.summary');
  ensureWellFormed(descriptionText, 'content.descriptionText');
  if (!summary.length) fail('summary must be non-empty', EXIT.STATE_ERROR);
  if (args.trackingDraftId) {
    const existing = await loadDraft(state, id).catch((error) => {
      if (error instanceof JiraQueueError && /not found/u.test(error.message)) return null;
      throw error;
    });
    if (existing) {
      if (existing.project !== project || existing.issueType !== issueType || existing.sessionId !== (args.sessionId || '') || existing.content.summary !== summary || existing.content.descriptionText !== descriptionText) fail('tracking draft identity was reused with different content', EXIT.PAYLOAD_INTEGRITY);
      return existing;
    }
  }
  const at = nowIso(state.clock);
  const draft = {
    schemaVersion: 1,
    id,
    createdAt: at,
    updatedAt: at,
    sessionId: args.sessionId || '',
    state: 'pending',
    project,
    issueType,
    content: { summary, descriptionText },
    idempotencyLabel: `kstack-draft-${id}`,
    canonicalPayload: null,
    payloadSha256: null,
    configFingerprint: null,
    approvedAt: null,
    attempts: [],
    audit: [],
    result: null
  };
  if (source) queueAudit(draft, 'cloned-from', { sourceId: source.id }, state.clock);
  await durableJsonWrite(draftPath(state, id), draft, state.queueDir);
  return draft;
}

async function editDraft(state, id, args) {
  return withDraftLock(state, id, 'edit', async (lock, draft) => {
    if (draft.state !== 'pending') fail('edit requires pending state', EXIT.STATE_ERROR);
    const summary = args.summary ?? draft.content.summary;
    const descriptionText = args.description ?? draft.content.descriptionText;
    ensureWellFormed(summary, 'content.summary');
    ensureWellFormed(descriptionText, 'content.descriptionText');
    if (!summary.length) fail('summary must be non-empty', EXIT.STATE_ERROR);
    draft.content = { summary, descriptionText };
    draft.canonicalPayload = null;
    draft.payloadSha256 = null;
    draft.configFingerprint = null;
    draft.approvedAt = null;
    queueAudit(draft, 'edited', {}, state.clock);
    await guardedWriteDraft(lock, draft);
    return draft;
  });
}

async function pagedValues(state, credentials, endpoint, keys) {
  const values = [];
  let startAt = 0;
  do {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await jiraJson(state, credentials, `${endpoint}${separator}startAt=${startAt}&maxResults=50`);
    const page = keys.map((key) => response[key]).find(Array.isArray);
    if (!page) fail(`Jira response for ${endpoint} lacks a supported values array`, EXIT.PREFLIGHT_FAILED);
    values.push(...page);
    const maxResults = Number(response.maxResults ?? page.length);
    const total = Number(response.total ?? values.length);
    if (response.isLast === true || values.length >= total || page.length === 0) break;
    startAt = Number(response.startAt ?? startAt) + maxResults;
  } while (true);
  return values;
}

async function preflightCreate(state, credentials, draft) {
  const issueTypes = await pagedValues(
    state,
    credentials,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(draft.project)}/issuetypes`,
    ['issueTypes', 'values']
  );
  const issueType = issueTypes.find((item) => item.name === draft.issueType);
  if (!issueType?.id) fail(`issue type ${draft.issueType} was not returned by createmeta`, EXIT.PREFLIGHT_FAILED);
  const fields = await pagedValues(
    state,
    credentials,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(draft.project)}/issuetypes/${encodeURIComponent(issueType.id)}`,
    ['fields', 'values']
  );
  const fieldIds = new Set(fields.flatMap((field) => [field.fieldId, field.key, field.id]).filter(Boolean));
  const missing = [];
  if (!fieldIds.has('labels')) missing.push('labels is not settable');
  const supplied = new Set(['project', 'issuetype', 'summary', 'description', 'labels', ...Object.keys(projectConfig(state, draft.project, draft.issueType).defaultFields)]);
  for (const field of fields) {
    const key = field.fieldId || field.key || field.id;
    if (field.required === true && key && !supplied.has(key) && field.hasDefaultValue !== true) missing.push(`${key} is required and unsatisfied`);
  }
  if (missing.length) fail(`Jira create preflight failed: ${missing.join('; ')}`, EXIT.PREFLIGHT_FAILED, { missing });
  return { issueTypeId: String(issueType.id), fields };
}

async function showDraft(state, id) {
  return withDraftLock(state, id, 'show', async (lock, draft) => {
    if (draft.state !== 'pending') fail('show requires pending state', EXIT.STATE_ERROR);
    if (draft.canonicalPayload) return draft;
    const credentials = await resolveCredentials(state);
    await preflightCreate(state, credentials, draft);
    draft.canonicalPayload = buildCanonicalPayload(state, draft);
    draft.payloadSha256 = sha256(Buffer.from(draft.canonicalPayload, 'utf8'));
    draft.configFingerprint = configFingerprint(state, draft, credentials.email);
    queueAudit(draft, 'frozen', { payloadSha256: draft.payloadSha256 }, state.clock);
    await guardedWriteDraft(lock, draft);
    return draft;
  });
}

async function approveDraft(state, id, args) {
  return withDraftLock(state, id, 'approve', async (lock, draft) => {
    if (!['pending', 'approved'].includes(draft.state)) fail('approve requires pending or approved state', EXIT.STATE_ERROR);
    if (!draft.canonicalPayload || !draft.payloadSha256) fail('run show before approve', EXIT.STATE_ERROR);
    if (args.payloadHash !== draft.payloadSha256) fail('payload hash does not match the frozen draft', EXIT.PAYLOAD_INTEGRITY);
    const renewed = draft.state === 'approved';
    draft.state = 'approved';
    draft.approvedAt = nowIso(state.clock);
    queueAudit(draft, 'approved', { payloadSha256: draft.payloadSha256, renewed }, state.clock);
    await guardedWriteDraft(lock, draft);
    return draft;
  });
}

function clearFreeze(draft) {
  draft.canonicalPayload = null;
  draft.payloadSha256 = null;
  draft.configFingerprint = null;
  draft.approvedAt = null;
}

async function recordSearchFailure(lock, draft, result) {
  queueAudit(draft, result.kind === 'visibility-failed' ? 'verify-visibility-failed' : 'verify-network-failed', { detail: result.detail }, lock.state.clock);
  await guardedWriteDraft(lock, draft);
}

function verifyClearMinimumAgeMs(state) {
  const configuredPollMinimum = state.poll?.minimumDurationMs;
  return Math.max(
    VERIFY_CLEAR_MIN_AGE_FLOOR_MS,
    Number.isFinite(configuredPollMinimum) ? configuredPollMinimum : VERIFY_CLEAR_MIN_AGE_FLOOR_MS
  );
}

function youngestMarkerAgeMs(markers, clock) {
  if (!markers.length) return Infinity;
  const now = new clock().getTime();
  if (!Number.isFinite(now)) return null;
  let youngestAt = -Infinity;
  for (const marker of markers) {
    const parsed = Date.parse(marker.at);
    if (!Number.isFinite(parsed)) return null;
    youngestAt = Math.max(youngestAt, parsed);
  }
  const age = now - youngestAt;
  if (!Number.isFinite(age) || age < 0) return null;
  return age;
}

function gateExitCode(gate) {
  return gate.keys?.length
    ? EXIT.DUPLICATE
    : gate.reason === VERIFICATION_REASON.INDEX_LAG ? EXIT.INDEX_LAG_BLOCKED : EXIT.STATE_ERROR;
}

export async function runVerification(lock, draft, credentials, options = {}) {
  const direct = unresolvedDirectEvidence(draft);
  if (direct.length) {
    const keys = [...new Set(direct.flatMap(duplicateKeys))];
    if (!unresolvedDuplicateEntries(draft).length) queueAudit(draft, 'duplicate-detected', { keys, directEvidence: true }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { exitCode: EXIT.DUPLICATE, keys, directEvidence: true };
  }
  if (!credentials || typeof credentials.email !== 'string' || !credentials.email ||
      typeof credentials.token !== 'string' || !credentials.token) {
    fail('verification requires resolved Jira credentials when no direct evidence is present', EXIT.CONFIG_INVALID);
  }
  const result = await boundedSearch(lock.state, credentials, draft);
  if (result.kind === 'inconclusive') {
    queueAudit(draft, 'verify-inconclusive', { reason: 'poll-exhausted-before-lower-bound', probes: result.probes }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { exitCode: EXIT.OK, inconclusive: true, ...result };
  }
  if (result.kind !== 'matches') {
    await recordSearchFailure(lock, draft, result);
    return { exitCode: EXIT.STATE_ERROR, ...result };
  }
  if (result.keys.length === 1 && draft.result?.key === result.keys[0]) {
    queueAudit(draft, 'verify-confirmed', { key: result.keys[0] }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { exitCode: EXIT.OK, confirmed: true, keys: result.keys };
  }
  if (result.keys.length === 0) {
    const markers = [...unresolvedSearchEvidence(draft), ...unresolvedRetryMarkers(draft)];
    const minimumMarkerAgeMs = verifyClearMinimumAgeMs(lock.state);
    const youngestMarkerAge = youngestMarkerAgeMs(markers, lock.state.clock);
    const markerAgeMeasurable = youngestMarkerAge !== null;
    const canClear = options.explicit && result.complete && markerAgeMeasurable && youngestMarkerAge >= minimumMarkerAgeMs;
    queueAudit(draft, canClear ? 'verify-clear' : 'verify-inconclusive', {
      probes: result.probes,
      ...(canClear ? { minimumMarkerAgeMs } : {}),
      ...(options.explicit && !canClear && markers.length ? {
        reason: markerAgeMeasurable
          ? VERIFICATION_REASON.MARKER_YOUNGER_THAN_INDEX_LAG_MINIMUM
          : VERIFICATION_REASON.MARKER_AGE_UNMEASURABLE,
        minimumMarkerAgeMs
      } : {})
    }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { exitCode: EXIT.OK, inconclusive: !canClear, clear: canClear };
  }
  queueAudit(draft, 'duplicate-detected', { keys: result.keys, directEvidence: false }, lock.state.clock);
  await guardedWriteDraft(lock, draft);
  return { exitCode: EXIT.DUPLICATE, keys: result.keys };
}

async function preMutationDuplicateGate(lock, draft, credentials) {
  const duplicate = unresolvedDuplicateEntries(draft);
  const direct = unresolvedDirectEvidence(draft);
  if (duplicate.length || direct.length) {
    if (!duplicate.length) {
      queueAudit(draft, 'duplicate-detected', { keys: [...new Set(direct.flatMap(duplicateKeys))], directEvidence: true }, lock.state.clock);
      await guardedWriteDraft(lock, draft);
    }
    return { blocked: true, keys: [...new Set([...duplicate.flatMap(duplicateKeys), ...direct.flatMap(duplicateKeys)])] };
  }
  if (!unresolvedSearchEvidence(draft).length) return { blocked: false };
  const result = await boundedSearch(lock.state, credentials, draft);
  if (result.kind === 'inconclusive') {
    queueAudit(draft, 'verify-inconclusive', { reason: 'poll-exhausted-before-lower-bound' }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.SEARCH_UNAVAILABLE };
  }
  if (result.kind !== 'matches') {
    await recordSearchFailure(lock, draft, result);
    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.SEARCH_UNAVAILABLE };
  }
  if (result.keys.length) {
    queueAudit(draft, 'duplicate-detected', { keys: result.keys, directEvidence: false }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { blocked: true, keys: result.keys };
  }
  const markers = unresolvedSearchEvidence(draft);
  const minimumMarkerAgeMs = verifyClearMinimumAgeMs(lock.state);
  const youngestMarkerAge = youngestMarkerAgeMs(markers, lock.state.clock);
  if (youngestMarkerAge === null) {
    queueAudit(draft, 'verify-inconclusive', { reason: VERIFICATION_REASON.MARKER_AGE_UNMEASURABLE, minimumMarkerAgeMs }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.MARKER_AGE_UNMEASURABLE };
  }
  if (youngestMarkerAge < minimumMarkerAgeMs) {
    queueAudit(draft, 'verify-inconclusive', { reason: VERIFICATION_REASON.MARKER_YOUNGER_THAN_INDEX_LAG_MINIMUM, minimumMarkerAgeMs }, lock.state.clock);
    await guardedWriteDraft(lock, draft);
    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.INDEX_LAG };
  }
  queueAudit(draft, 'verify-clear', { minimumMarkerAgeMs }, lock.state.clock);
  await guardedWriteDraft(lock, draft);
  return { blocked: false };
}

async function unfreezeDraft(state, id) {
  return withDraftLock(state, id, 'unfreeze', async (lock, draft) => {
    if (draft.state !== 'approved') fail('unfreeze requires approved state', EXIT.STATE_ERROR);
    const credentials = unresolvedSearchEvidence(draft).length ? await resolveCredentials(state) : null;
    const gate = await preMutationDuplicateGate(lock, draft, credentials);
    if (gate.blocked) fail('unfreeze refused until duplicate evidence is resolved', gateExitCode(gate));
    draft.state = 'pending';
    clearFreeze(draft);
    queueAudit(draft, 'unfrozen', {}, state.clock);
    await guardedWriteDraft(lock, draft);
    return draft;
  });
}

async function submitDraft(state, id, args = {}) {
  return withDraftLock(state, id, 'submit', async (lock, draft, setResidue) => {
    if (draft.state !== 'approved') fail('submit requires approved state', EXIT.STATE_ERROR);
    const approvedAt = Date.parse(draft.approvedAt);
    if (!Number.isFinite(approvedAt) || new state.clock().getTime() - approvedAt > state.jira.approvalTtlMs) {
      queueAudit(draft, 'approval-expired', { approvedAt: draft.approvedAt }, state.clock);
      await guardedWriteDraft(lock, draft);
      fail('approval expired; re-approve or unfreeze', EXIT.APPROVAL_EXPIRED);
    }
    if (unresolvedDuplicateEntries(draft).length || unresolvedDirectEvidence(draft).length) {
      const localDuplicateGate = await preMutationDuplicateGate(lock, draft, null);
      if (localDuplicateGate.blocked) fail('submit refused until duplicate evidence is resolved', EXIT.DUPLICATE);
    }
    const gateCredentials = await resolveCredentials(state).catch((error) => {
      if (error instanceof JiraQueueError) fail(`could not re-resolve credentials: ${error.message}`, EXIT.CONFIG_DRIFT);
      throw error;
    });
    const duplicateGate = unresolvedSearchEvidence(draft).length ? await preMutationDuplicateGate(lock, draft, gateCredentials) : { blocked: false };
    if (duplicateGate.blocked) fail('submit refused until duplicate evidence is resolved', gateExitCode(duplicateGate));
    if (unresolvedRetryVerify(draft)) {
      const retryVerification = await runVerification(lock, draft, gateCredentials, { explicit: true });
      if (retryVerification.exitCode === EXIT.DUPLICATE) fail('submit refused until retry duplicate evidence is resolved', EXIT.DUPLICATE, retryVerification);
      if (!retryVerification.clear && !retryVerification.confirmed) fail('submit refused until the retry verification interval has elapsed', EXIT.STATE_ERROR);
    }
    const actualHash = sha256(Buffer.from(draft.canonicalPayload || '', 'utf8'));
    if (actualHash !== draft.payloadSha256) fail('frozen payload integrity check failed', EXIT.PAYLOAD_INTEGRITY);
    const fingerprint = configFingerprint(state, draft, gateCredentials.email);
    if (fingerprint !== draft.configFingerprint) fail('Jira config or resolved identity changed since show', EXIT.CONFIG_DRIFT);
    const dryRun = args.dryRun === true || (state.jira.dryRun && args.live !== true);
    if (dryRun) return {
      dryRun: true,
      siteUrl: state.jira.siteUrl,
      project: draft.project,
      issueType: draft.issueType,
      canonicalPayload: draft.canonicalPayload
    };

    const attemptId = crypto.randomUUID();
    const attempt = { attemptId, lockId: lock.lockId, startedAt: nowIso(state.clock), outcome: 'in-flight' };
    draft.state = 'submitting';
    draft.attempts.push(attempt);
    queueAudit(draft, 'submit-started', { attemptId, lockId: lock.lockId }, state.clock);
    await guardedWriteDraft(lock, draft, { attemptId, posted: false, wroteAfterFence: false, responseClass: 'aborted-before-post' });
    let unrecordedPostPossible = false;
    let retried = false;
    let classification;
    for (let physicalAttempt = 1; physicalAttempt <= state.jira.maxAttempts; physicalAttempt += 1) {
      if (!(await assertFence(lock))) {
        await writeOrphan(lock, {
          attemptId,
          posted: unrecordedPostPossible,
          wroteAfterFence: false,
          ...(!unrecordedPostPossible ? { responseClass: 'aborted-before-post' } : {})
        });
        fail('submit fenced before POST', unrecordedPostPossible ? EXIT.LOCK_FENCED_DIRTY : EXIT.LOCK_FENCED_CLEAN);
      }
      unrecordedPostPossible = true;
      setResidue({ attemptId, posted: true, wroteAfterFence: false });
      try {
        const response = await jiraRequest(state, gateCredentials, '/rest/api/3/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: Buffer.from(draft.canonicalPayload, 'utf8')
        });
        classification = await classifyCreateResponse(response);
      } catch (error) {
        classification = classifyFetchError(error);
      }
      if (!(await assertFence(lock))) {
        await writeOrphan(lock, { attemptId, posted: true, wroteAfterFence: false, ...classification });
        fail('submit fenced after POST', EXIT.LOCK_FENCED_DIRTY);
      }
      if (classification.responseClass === 'rate-limited' && physicalAttempt < state.jira.maxAttempts) {
        const parsed = parseRetryAfter(classification.retryAfter, state.clock);
        const waitMs = parsed ?? Math.min((2 ** physicalAttempt) * 1000, 30000);
        if (waitMs > state.jira.timeoutMs * 4) break;
        retried = true;
        queueAudit(draft, 'retry-backoff', { attemptId, httpStatus: 429, waitMs, physicalAttempt }, state.clock);
        await guardedWriteDraft(lock, draft, { attemptId, posted: true, wroteAfterFence: false });
        await wait(waitMs);
        continue;
      }
      break;
    }
    if (retried && classification.state === 'failed') {
      classification = { state: 'unknown', outcome: 'ambiguous', responseClass: `retry-sequence-${classification.responseClass}` };
    }
    attempt.outcome = classification.outcome;
    attempt.finishedAt = nowIso(state.clock);
    attempt.responseClass = classification.responseClass;
    draft.state = classification.state;
    if (classification.state === 'submitted') {
      draft.result = {
        id: classification.issueId,
        key: classification.issueKey,
        url: `${state.jira.siteUrl}/browse/${encodeURIComponent(classification.issueKey)}`
      };
    }
    queueAudit(draft, 'submit-finished', { attemptId, responseClass: classification.responseClass }, state.clock);
    await guardedWriteDraft(lock, draft, { attemptId, posted: true, postedAfterWrite: false, wroteAfterFence: false, ...classification });
    unrecordedPostPossible = false;
    setResidue({ attemptId, posted: false, wroteAfterFence: false });
    if (draft.state === 'submitted') {
      const mandatory = retried || draft.attempts.some((row) => row.outcome === 'ambiguous') || unresolvedSearchEvidence(draft).length > 0;
      if (mandatory) {
        const verification = await runVerification(lock, draft, gateCredentials, { explicit: false });
        if (verification.exitCode === EXIT.DUPLICATE) fail('duplicate Jira issues require resolve', EXIT.DUPLICATE, verification);
        if (verification.exitCode !== EXIT.OK) fail('mandatory verification could not produce evidence', verification.exitCode, verification);
        return { draft, verification };
      }
    }
    return { draft, classification };
  });
}

async function reconcileDraft(state, id, args = {}) {
  await sweepQueue(state, { op: 'reconcile-sweep', excludeId: id });
  return withDraftLock(state, id, 'reconcile', async (lock, draft) => {
    let credentials;
    const networkCredentials = async () => {
      credentials ||= await resolveCredentials(state);
      return credentials;
    };
    if (draft.state === 'submitting') {
      const attempt = [...draft.attempts].reverse().find((row) => row.outcome === 'in-flight');
      if (!attempt) fail('submitting draft has no in-flight attempt', EXIT.STATE_ERROR);
      const covering = [...draft.audit].reverse().find((entry) =>
        entry.event === 'stale-holder-outcome' &&
        entry.attemptId === attempt.attemptId &&
        entry.lockId === attempt.lockId
      );
      if (covering?.posted === false && covering.responseClass === 'aborted-before-post') {
        attempt.outcome = 'aborted-before-post';
        attempt.finishedAt = nowIso(state.clock);
        draft.state = 'approved';
        queueAudit(draft, 'submit-recovered', { attemptId: attempt.attemptId, lockId: attempt.lockId, recovery: 'aborted-before-post' }, state.clock);
        await guardedWriteDraft(lock, draft);
        return { draft, recovery: 'aborted-before-post' };
      }
      if (covering?.posted === true && covering.issueKey) {
        attempt.outcome = 'success';
        attempt.finishedAt = nowIso(state.clock);
        draft.state = 'submitted';
        draft.result = {
          id: covering.issueId || null,
          key: covering.issueKey,
          url: `${state.jira.siteUrl}/browse/${encodeURIComponent(covering.issueKey)}`
        };
        queueAudit(draft, 'submit-recovered', { attemptId: attempt.attemptId, lockId: attempt.lockId, recovery: 'direct-evidence' }, state.clock);
        await guardedWriteDraft(lock, draft);
        const verification = await runVerification(lock, draft, null, { explicit: false });
        if (verification.exitCode === EXIT.DUPLICATE) fail('direct duplicate evidence requires resolve', EXIT.DUPLICATE, verification);
        if (verification.exitCode !== EXIT.OK) fail('mandatory recovery verification could not produce evidence', verification.exitCode, verification);
        return { draft, verification };
      }
      attempt.outcome = 'ambiguous';
      attempt.finishedAt = nowIso(state.clock);
      draft.state = 'unknown';
      queueAudit(draft, 'submit-recovered', {
        attemptId: attempt.attemptId,
        lockId: attempt.lockId,
        recovery: covering?.posted === true ? 'posted-without-key' : 'no-covering-sidecar'
      }, state.clock);
      await guardedWriteDraft(lock, draft);
      // Resolution chosen for the round-17 ambiguity: this is reconcile-from-unknown.
      // A completed, visibility-checked zero poll returns to approved; an incomplete poll does not.
    }

    if (draft.state === 'unknown') {
      if (unresolvedDuplicateEntries(draft).length) fail('duplicate evidence requires resolve', EXIT.DUPLICATE, { keys: resolutionCandidates(draft) });
      if (unresolvedDirectEvidence(draft).length) {
        const verification = await runVerification(lock, draft, null, { explicit: Boolean(args.verify) });
        if (verification.exitCode === EXIT.DUPLICATE) fail('direct duplicate evidence requires resolve', EXIT.DUPLICATE, verification);
      }
      const search = await boundedSearch(state, await networkCredentials(), draft);
      if (search.kind === 'inconclusive') {
        queueAudit(draft, 'verify-inconclusive', { reason: 'poll-exhausted-before-lower-bound', recoveredFromSubmitting: true }, state.clock);
        await guardedWriteDraft(lock, draft);
        return { draft, search };
      }
      if (search.kind !== 'matches') {
        await recordSearchFailure(lock, draft, search);
        fail('reconcile search could not produce evidence', EXIT.STATE_ERROR, { search });
      }
      if (search.keys.length === 0) {
        draft.state = 'approved';
        queueAudit(draft, 'reconcile-clear', { recoveredFromSubmitting: true }, state.clock);
        await guardedWriteDraft(lock, draft);
        return { draft, search };
      }
      if (search.keys.length === 1) {
        draft.state = 'submitted';
        draft.result = { key: search.keys[0], id: null, url: `${state.jira.siteUrl}/browse/${encodeURIComponent(search.keys[0])}` };
        queueAudit(draft, 'reconcile-match', { key: search.keys[0] }, state.clock);
        queueAudit(draft, 'verify-confirmed', { key: search.keys[0], recoveredFromSubmitting: true }, state.clock);
        await guardedWriteDraft(lock, draft);
        return { draft, search };
      }
      queueAudit(draft, 'reconcile-matches', { keys: search.keys }, state.clock);
      await guardedWriteDraft(lock, draft);
      fail('multiple Jira issues match this draft; resolve is required', EXIT.DUPLICATE, { keys: search.keys });
    }

    if (draft.state === 'submitted') {
      if (unresolvedDuplicateEntries(draft).length) fail('duplicate evidence requires resolve', EXIT.DUPLICATE, { keys: resolutionCandidates(draft) });
      if (!args.verify && !unresolvedRetryVerify(draft) && !unresolvedSearchEvidence(draft).length && !unresolvedDuplicateEntries(draft).length) {
        fail('submitted draft has no pending verification; pass --verify to force it', EXIT.STATE_ERROR);
      }
      const verification = await runVerification(lock, draft, await networkCredentials(), { explicit: Boolean(args.verify) });
      if (verification.exitCode === EXIT.DUPLICATE) fail('duplicate Jira issues require resolve', EXIT.DUPLICATE, verification);
      if (verification.exitCode !== EXIT.OK) fail('verification could not produce evidence', verification.exitCode, verification);
      return { draft, verification };
    }
    if (draft.state === 'approved' && args.verify && (unresolvedRetryVerify(draft) || unresolvedSearchEvidence(draft).length)) {
      const verification = await runVerification(lock, draft, await networkCredentials(), { explicit: true });
      if (verification.exitCode === EXIT.DUPLICATE) fail('duplicate Jira issues require resolve', EXIT.DUPLICATE, verification);
      if (verification.exitCode !== EXIT.OK) fail('verification could not produce evidence', verification.exitCode, verification);
      return { draft, verification };
    }
    fail('reconcile requires unknown, submitting, or submitted state', EXIT.STATE_ERROR);
  });
}

function resolutionCandidatesByProvenance(draft) {
  const resolvedAt = latestResolutionIndex(draft, new Set(['duplicate-acknowledged', 'duplicate-dismissed']));
  let lastReconcile;
  draft.audit.forEach((entry, index) => {
    if (index > resolvedAt && entry.event === 'reconcile-matches') lastReconcile = entry;
  });
  const duplicates = unresolvedDuplicateEntries(draft);
  const directEvidence = unresolvedDirectEvidence(draft);
  const direct = [...new Set([
    ...duplicates.filter((entry) => entry.directEvidence === true).flatMap(duplicateKeys),
    ...directEvidence.flatMap(duplicateKeys)
  ])];
  const inferred = [...new Set([
    ...(lastReconcile?.keys || []),
    ...duplicates.filter((entry) => entry.directEvidence !== true).flatMap(duplicateKeys)
  ])];
  return {
    direct,
    inferred,
    hasDirectEvidence: directEvidence.length > 0 || duplicates.some((entry) => entry.directEvidence === true)
  };
}

function resolutionCandidates(draft) {
  const { direct, inferred } = resolutionCandidatesByProvenance(draft);
  return [...new Set([...inferred, ...direct])];
}

async function resolveDraft(state, id, args = {}) {
  if (Boolean(args.issueKey) === Boolean(args.distinct)) fail('resolve requires exactly one of --issue-key or --distinct', EXIT.STATE_ERROR);
  return withDraftLock(state, id, 'resolve', async (lock, draft) => {
    const candidatesByProvenance = resolutionCandidatesByProvenance(draft);
    const candidates = [...new Set([...candidatesByProvenance.inferred, ...candidatesByProvenance.direct])];
    if (!candidates.length) fail('draft has no unresolved duplicate evidence', EXIT.STATE_ERROR);
    if (args.issueKey && !candidates.includes(args.issueKey)) fail(`issue key must be one of: ${candidates.join(', ')}`, EXIT.STATE_ERROR);
    if (args.distinct) {
      if (candidatesByProvenance.hasDirectEvidence) {
        const directKeys = candidatesByProvenance.direct.length ? ` with one of: ${candidatesByProvenance.direct.join(', ')}` : '';
        fail(`--distinct cannot dismiss direct evidence; use --issue-key${directKeys}`, EXIT.STATE_ERROR);
      }
      if (draft.state === 'submitted') fail('--distinct is not valid for submitted duplicate resolution; choose the retained issue key', EXIT.STATE_ERROR);
      if (draft.state === 'unknown') {
        fail('--distinct is not valid for reconcile-matches from unknown; choose one of the matched issue keys', EXIT.STATE_ERROR);
      }
      queueAudit(draft, 'duplicate-dismissed', { dismissedKeys: candidatesByProvenance.inferred }, state.clock);
      await guardedWriteDraft(lock, draft);
      return draft;
    }
    const staleKeys = candidates.filter((key) => key !== args.issueKey);
    if (['unknown', 'pending', 'approved', 'failed'].includes(draft.state)) {
      draft.state = 'submitted';
      draft.result = { key: args.issueKey, id: null, url: `${state.jira.siteUrl}/browse/${encodeURIComponent(args.issueKey)}` };
    } else if (!['submitted', 'discarded'].includes(draft.state)) {
      fail('resolve cannot acknowledge an issue from this state', EXIT.STATE_ERROR);
    } else if (draft.state === 'submitted' && draft.result?.key !== args.issueKey) {
      draft.result = { key: args.issueKey, id: null, url: `${state.jira.siteUrl}/browse/${encodeURIComponent(args.issueKey)}` };
    }
    queueAudit(draft, 'duplicate-acknowledged', {
      chosenKey: args.issueKey,
      staleKeys,
      ...(draft.state === 'discarded' ? { discardedDraftEvidenceOnly: true } : {})
    }, state.clock);
    await guardedWriteDraft(lock, draft);
    return draft;
  });
}

async function discardDraft(state, id, args = {}) {
  return withDraftLock(state, id, 'discard', async (lock, draft) => {
    if (!['pending', 'failed'].includes(draft.state)) fail('discard requires pending or failed state', EXIT.STATE_ERROR);
    const ambiguous = unresolvedAmbiguousHistory(draft);
    if (ambiguous.length && !args.acknowledgeAmbiguousHistory) fail('discard refused because ambiguous submit history is unresolved', EXIT.AMBIGUOUS_HISTORY);
    if (ambiguous.length) queueAudit(draft, 'ambiguous-discard-acknowledged', { priorAmbiguousAttempts: ambiguous.map((row) => row.attemptId) }, state.clock);
    const credentials = unresolvedSearchEvidence(draft).length ? await resolveCredentials(state) : null;
    const gate = await preMutationDuplicateGate(lock, draft, credentials);
    if (gate.blocked) fail('discard refused until duplicate evidence is resolved', gateExitCode(gate));
    draft.state = 'discarded';
    queueAudit(draft, 'discarded', {}, state.clock);
    await guardedWriteDraft(lock, draft);
    return draft;
  });
}

async function listDrafts(state, args = {}) {
  const drafts = [];
  for (const id of await queueDraftIds(state)) {
    try {
      const draft = await loadDraft(state, id);
      if (!args.state || draft.state === args.state) drafts.push(draft);
    } catch {}
  }
  return drafts;
}

function healthForDraft(draft) {
  const duplicates = unresolvedDuplicateEntries(draft);
  return {
    id: draft.id,
    state: draft.state,
    unsatisfiedMandatoryVerify: unresolvedRetryVerify(draft) || unresolvedVerifyFailure(draft) || unresolvedSearchEvidence(draft).length > 0,
    unresolvedDuplicate: duplicates.length > 0 || unresolvedDirectEvidence(draft).length > 0,
    duplicateKeys: [...new Set(duplicates.flatMap(duplicateKeys))],
    ambiguousHistory: unresolvedAmbiguousHistory(draft).length > 0
  };
}

async function statusQueue(state) {
  const sweep = await sweepQueue(state, { op: 'status' });
  const drafts = (await listDrafts(state)).map(healthForDraft);
  return { sweepPolicy: 'skip-held-and-continue', sweep, drafts };
}

async function findCredentialSymlinks(state) {
  if (state.jira.credentialSource.type !== 'file') return [];
  const target = await fsp.realpath(state.jira.credentialSource.path);
  const matches = [];
  async function visit(directory) {
    const entries = await fsp.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === '.git' || (directory === path.join(state.repoRoot, '.kstack') && entry.name === 'jira-queue')) continue;
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isSymbolicLink()) {
        const resolved = await fsp.realpath(candidate).catch(() => null);
        if (resolved === target) matches.push(path.relative(state.repoRoot, candidate));
      }
    }
  }
  await visit(state.repoRoot);
  return matches;
}

async function doctor(state) {
  const report = { enabled: state.jira.enabled, checks: [], warnings: [] };
  if (!state.jira.enabled) return report;
  const credentials = await resolveCredentials(state);
  const myself = await jiraJson(state, credentials, '/rest/api/3/myself');
  if (myself.emailAddress == null) {
    report.checks.push({ check: 'site-identity', accountId: myself.accountId || null });
    report.warnings.push('Jira user email visibility is hidden site-wide: /myself omitted emailAddress, so doctor could not perform the resolvedEmail identity assertion. Reporting accountId only.');
  } else if (typeof myself.emailAddress !== 'string' || myself.emailAddress.toLowerCase() !== credentials.email.toLowerCase()) {
    fail('Jira site identity assertion failed: /myself email does not match resolvedEmail', EXIT.CONFIG_INVALID);
  } else {
    report.checks.push({ check: 'site-identity', ok: true, accountId: myself.accountId || null });
  }
  for (const project of state.jira.projects) {
    const visibility = await visibilityPrecheck(state, credentials, project.key);
    report.checks.push({ check: 'browse-projects', project: project.key, ok: visibility.ok, detail: visibility.detail });
    if (!visibility.ok) fail(`Jira visibility precondition failed for ${project.key}`, EXIT.CONFIG_INVALID);
    const scheme = await projectSecurityScheme(state, credentials, project.key);
    report.checks.push({ check: 'issue-security-scheme', project: project.key, ...scheme });
    if (scheme.hasScheme) {
      report.warnings.push(`${project.key} has an issue security scheme. BROWSE_PROJECTS is necessary but not sufficient: project defaults, workflows, or automation may hide created issues and make zero-match evidence unsafe.`);
    } else if (!scheme.checked) {
      report.warnings.push(`Could not determine whether ${project.key} has an issue security scheme: ${scheme.detail}. BROWSE_PROJECTS alone does not prove issue-level visibility.`);
    }
    for (const issueType of project.issueTypes) {
      const synthetic = { project: project.key, issueType, idempotencyLabel: `kstack-draft-${crypto.randomUUID()}` };
      await preflightCreate(state, credentials, { ...synthetic, content: { summary: 'doctor', descriptionText: '' } });
      const smoke = await searchOnce(state, credentials, synthetic);
      report.checks.push({ check: 'createmeta-and-search-shapes', project: project.key, issueType, ok: Array.isArray(smoke) });
    }
  }
  if (state.jira.credentialSource.type === 'file' && state.jira.credentialSource.allowInsecurePermissions) {
    report.warnings.push('allowInsecurePermissions is enabled; credential mode bits are not enforced.');
  }
  report.warnings.push(...credentialHardeningWarnings(state.jira.credentialSource));
  const symlinks = await findCredentialSymlinks(state);
  if (symlinks.length) report.warnings.push(`Repository symlink(s) disclose the credential file path: ${symlinks.join(', ')}`);
  report.warnings.push("The *.atlassian.net hostname rule is a typo/DNS-suffix guard, not a credential-exfiltration boundary. Doctor's /myself check only detects after transmission whether siteUrl resolved to the intended Jira tenant; it is not a pre-transmission guard and runs only when doctor is invoked.");
  return report;
}

export function credentialHardeningWarnings(source, platform = process.platform, getuid) {
  if (source.type !== 'file') return [];
  const resolvedGetuid = arguments.length >= 3 ? getuid : process.getuid;
  const reductions = [];
  if (!['linux', 'darwin'].includes(platform)) {
    reductions.push('descriptor-based identity resolution, no-follow guarantees, and POSIX mode protections may be weaker');
  }
  if (typeof resolvedGetuid !== 'function') reductions.push('invoking-user ownership cannot be verified');
  if (!reductions.length) return [];
  return [`File-based credential-source hardening is reduced on ${platform}: ${reductions.join('; ')}.`];
}

export async function runJiraCommand(state, command, args = {}) {
  if (command !== 'help' && command !== 'doctor' && !state.jira.enabled) fail('Jira queue is disabled in config', EXIT.CONFIG_INVALID);
  switch (command) {
    case 'doctor': return doctor(state);
    case 'draft': return createDraft(state, args);
    case 'edit': return editDraft(state, args.id, args);
    case 'show': return showDraft(state, args.id);
    case 'approve': return approveDraft(state, args.id, args);
    case 'unfreeze': return unfreezeDraft(state, args.id);
    case 'submit': return submitDraft(state, args.id, args);
    case 'reconcile': return reconcileDraft(state, args.id, args);
    case 'resolve': return resolveDraft(state, args.id, args);
    case 'list': return listDrafts(state, args);
    case 'status': return statusQueue(state);
    case 'discard': return discardDraft(state, args.id, args);
    case 'help': return { help: HELP };
    default: fail(`unknown Jira queue command: ${command}`, EXIT.STATE_ERROR);
  }
}

const HELP = `KStack Jira queue (Jira Cloud only)

Commands:
  doctor
  draft [--from UUID] --summary TEXT [--description TEXT] [--project KEY] [--issue-type NAME] [--session-id ID]
  edit UUID [--summary TEXT] [--description TEXT]
  show UUID
  approve UUID --payload-hash SHA256       (TTY required by the CLI)
  unfreeze UUID
  submit UUID [--dry-run | --live]
  reconcile UUID [--verify]
  resolve UUID (--issue-key KEY | --distinct)
  list [--state STATE]
  status
  discard UUID [--acknowledge-ambiguous-history]

siteUrl accepts exactly one <tenant>.atlassian.net label. This is a typo/DNS-suffix
guard, not a credential-exfiltration guard. Doctor's /rest/api/3/myself check only
detects a wrong tenant after credentials have been transmitted, and only when doctor runs.
BROWSE_PROJECTS is necessary but not sufficient for search visibility. Doctor warns
about issue security schemes because project defaults, workflows, and automation can
hide issues. maxAttempts is the total number of physical POSTs, including the first.
verify-clear requires a completed full poll and marker age at least as long as the
section 7 poll minimum, with a 30-second floor.
Queue-wide status/reconcile sweeps skip locked drafts, report them, and continue.

State-error exit code is 2. Exit code 20 means unfreeze, submit, or discard was
blocked by the pre-mutation duplicate gate after a completed zero-match search
while a parseable unresolved marker has measurable age below the index-lag floor.
Poll exhaustion, search failure, unmeasurable marker age, and submit's separate
retry-verification-interval wait remain exit 2. Dry-run can return 0, 1, 2, 6, 8,
9, 13, 15, 20, or lock/fence codes 16-19. Codes 10-12 are retired. externalTicketCreation is a prose convention;
the host tool-permission prompt is the authority boundary and submit does not consult it.`;

function parseCli(argv) {
  const [command = 'help', maybeId, ...rest] = argv;
  const args = {};
  let index = 0;
  if (maybeId && !maybeId.startsWith('--')) args.id = maybeId;
  else if (maybeId) rest.unshift(maybeId);
  while (index < rest.length) {
    const item = rest[index++];
    if (!item.startsWith('--')) fail(`unexpected argument: ${item}`, EXIT.STATE_ERROR);
    const raw = item.slice(2);
    const key = raw.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (['dryRun', 'live', 'verify', 'distinct', 'acknowledgeAmbiguousHistory'].includes(key)) args[key] = true;
    else {
      const value = rest[index++];
      if (value === undefined || value.startsWith('--')) fail(`${item} requires a value`, EXIT.STATE_ERROR);
      args[key] = value;
    }
  }
  return { command, args };
}

async function cli(argv) {
  const parsed = parseCli(argv);
  if (parsed.command === 'help') {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const state = await loadJiraState({ command: parsed.command });
  if (parsed.command === 'approve') {
    if (!process.stdin.isTTY || !process.stdout.isTTY) fail('approve requires an interactive TTY', EXIT.STATE_ERROR);
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const confirmation = await prompt.question(`Type the payload hash to approve ${parsed.args.id}: `);
      if (confirmation.trim() !== parsed.args.payloadHash) fail('TTY confirmation did not match --payload-hash', EXIT.PAYLOAD_INTEGRITY);
    } finally { prompt.close(); }
  }
  const result = await runJiraCommand(state, parsed.command, parsed.args);
  process.stdout.write(`${typeof result?.help === 'string' ? result.help : JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${sanitize(error.message || String(error))}\n`);
    process.exitCode = error instanceof JiraQueueError ? error.exitCode : EXIT.STATE_ERROR;
  });
}
