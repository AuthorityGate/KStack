#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { canonicalJson } from './kstack-safety-broker.mjs';
import { acquireDeliveryLock, releaseDeliveryLock } from './kstack-jira-bootstrap.mjs';
import {
  buildCanonicalPayload, classifyCreateResponse, classifyFetchError, EXIT, jiraJson,
  jiraRequest, loadJiraState, resolveCredentials, runJiraCommand
} from './kstack-jira.mjs';
import { assertOutboundSecretScan, sanitize } from './kstack-provider-runner.mjs';

export const TRACKING_EVENT_SCHEMA = 'kstack-jira-outbox-event-v1';
export const TRACKING_EVENT_KINDS = Object.freeze(new Set([
  'IMPORTED_BASELINE', 'ITEM_CREATED', 'ITEM_ACTIVE', 'ITEM_UPDATED',
  'REVIEW_COMPLETED', 'DESIGN_VALIDATED', 'IMPLEMENTATION_VALIDATED',
  'BUG_FOUND', 'BUG_FIXED', 'QC_VALIDATED', 'ITEM_BLOCKED', 'ITEM_REOPENED',
  'ITEM_DONE', 'ITEM_RELEASED'
]));
export const TRACKING_STATES = Object.freeze(new Set(['planned', 'active', 'blocked', 'done']));

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,9}$/u;
const ISSUE_KEY = /^[A-Z][A-Z0-9_]{1,9}-[1-9][0-9]*$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const EVENT_FILE = /^[a-f0-9]{64}-\d{8}-[a-f0-9]{64}\.json$/u;
const EVENT_TEMPORARY = /^[a-f0-9]{64}-\d{8}-[a-f0-9]{64}\.json\.tmp-[1-9][0-9]*-[a-f0-9]{16}$/u;
const STALE_LOCK = /^(?:outbox|projection)-index\.json\.lock\.stale-[0-9a-f-]{36}$/u;
const MAX_TRACKING_ITEMS = 4096;
const MAX_TRACKING_EVENTS = 65_536;
const MAX_EVENTS_PER_ITEM = 4096;
const MAX_TRACKING_BYTES = 512 * 1024 * 1024;
const MAX_EVENT_BYTES = 64 * 1024;
const MAX_RESIDUE_FILES = 32;
const MAX_MAPPING_BYTES = 16 * 1024;
const ITEM_MAPPING_SCHEMA = 'kstack-jira-item-mapping-v1';
const CREATE_ATTEMPT_SCHEMA = 'kstack-jira-create-attempt-v1';
export const TRACKING_LIMITS = Object.freeze({
  rootEntries: MAX_TRACKING_EVENTS + MAX_RESIDUE_FILES + 3,
  items: MAX_TRACKING_ITEMS,
  events: MAX_TRACKING_EVENTS,
  perItemEvents: MAX_EVENTS_PER_ITEM,
  bytes: MAX_TRACKING_BYTES,
  residue: MAX_RESIDUE_FILES
});
const REVIEW_DECISIONS = new Set(['approve', 'revise', 'block', 'pass', 'fail']);
const INPUT_KEYS = new Set([
  'repositoryNamespace', 'projectKey', 'threadId', 'itemId', 'sourceEventId',
  'kind', 'localState', 'occurredAt', 'summary', 'evidence', 'review', 'release'
]);

export class JiraTrackingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'JiraTrackingError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new JiraTrackingError(code, message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function bounded(value, field, maximum) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed() || CONTROL_OR_BIDI.test(value)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `${field} is invalid`);
  return value;
}

function exactKeys(value, allowed, field) {
  const keys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
  if (!value || typeof value !== 'object' || Array.isArray(value) || keys.length !== allowed.size || keys.some((key) => !allowed.has(key))) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `${field} has an invalid shape`);
}

function validCalendarDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function canonicalInstant(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

function normalizeEvidence(value) {
  if (!Array.isArray(value) || value.length > 16) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'evidence must contain 0-16 entries');
  return value.map((entry, index) => {
    exactKeys(entry, new Set(['repoRelativePath', 'sha256', 'evidenceKind']), `evidence ${index + 1}`);
    const repoRelativePath = bounded(entry.repoRelativePath, `evidence ${index + 1} path`, 512).replace(/\\/gu, '/');
    if (path.posix.isAbsolute(repoRelativePath) || repoRelativePath.startsWith('//') || /^[A-Za-z]:\//u.test(repoRelativePath) || repoRelativePath.split('/').includes('..') || repoRelativePath === '.' || path.posix.normalize(repoRelativePath) !== repoRelativePath) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `evidence ${index + 1} path must be canonical and repository-relative`);
    if (!SHA256.test(entry.sha256)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `evidence ${index + 1} digest is invalid`);
    return {
      repoRelativePath,
      sha256: entry.sha256,
      evidenceKind: bounded(entry.evidenceKind, `evidence ${index + 1} kind`, 64)
    };
  });
}

function normalizeReview(value) {
  if (value == null) return null;
  exactKeys(value, new Set(['decision', 'confidence', 'failed', 'security', 'dissent', 'questions']), 'review');
  const counts = {};
  for (const key of ['failed', 'security', 'dissent', 'questions']) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 9999) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `review.${key} is invalid`);
    counts[key] = value[key];
  }
  if (!Number.isSafeInteger(value.confidence) || value.confidence < 0 || value.confidence > 100) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'review.confidence is invalid');
  const decision = bounded(value.decision, 'review.decision', 64);
  if (!REVIEW_DECISIONS.has(decision)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'review.decision is invalid');
  return { decision, confidence: value.confidence, ...counts };
}

function normalizeRelease(value) {
  if (value == null) return null;
  exactKeys(value, new Set(['name', 'releaseDate', 'receiptSha256']), 'release');
  if (!validCalendarDate(value.releaseDate)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'release.releaseDate is invalid');
  if (!SHA256.test(value.receiptSha256)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'release.receiptSha256 is invalid');
  return { name: bounded(value.name, 'release.name', 255), releaseDate: value.releaseDate, receiptSha256: value.receiptSha256 };
}

export function normalizeTrackingInput(input, options = {}) {
  exactKeys(input, INPUT_KEYS, 'tracking input');
  const repositoryNamespace = bounded(input.repositoryNamespace, 'repositoryNamespace', 255);
  if (!REPOSITORY.test(repositoryNamespace)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'repositoryNamespace must use owner/name form');
  const projectKey = bounded(input.projectKey, 'projectKey', 10).toUpperCase();
  if (!PROJECT_KEY.test(projectKey)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'projectKey is invalid');
  const threadId = bounded(input.threadId, 'threadId', 256);
  const itemId = bounded(input.itemId, 'itemId', 256);
  const sourceEventId = bounded(input.sourceEventId, 'sourceEventId', 256);
  if (![threadId, itemId, sourceEventId].every((value) => IDENTIFIER.test(value))) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'thread/item/source event identifier is invalid');
  if (!TRACKING_EVENT_KINDS.has(input.kind)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'event kind is invalid');
  if (!TRACKING_STATES.has(input.localState)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'local state is invalid');
  if (typeof input.occurredAt !== 'string' || Number.isNaN(Date.parse(input.occurredAt)) || new Date(input.occurredAt).toISOString() !== input.occurredAt) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'occurredAt must be canonical UTC ISO-8601');
  const clock = options.clock || Date;
  if (Date.parse(input.occurredAt) > new clock().getTime()) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'occurredAt must not be in the future');
  const normalized = {
    repositoryNamespace,
    projectKey,
    threadId,
    itemId,
    sourceEventId,
    kind: input.kind,
    localState: input.localState,
    occurredAt: input.occurredAt,
    summary: bounded(input.summary, 'summary', 512),
    evidence: normalizeEvidence(input.evidence || []),
    review: normalizeReview(input.review),
    release: normalizeRelease(input.release)
  };
  if (normalized.kind === 'ITEM_RELEASED' && !normalized.release) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'ITEM_RELEASED requires release evidence');
  if (normalized.kind !== 'ITEM_RELEASED' && normalized.release) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'release evidence is allowed only for ITEM_RELEASED');
  const reviewKinds = new Set(['REVIEW_COMPLETED', 'DESIGN_VALIDATED', 'IMPLEMENTATION_VALIDATED', 'QC_VALIDATED']);
  if (reviewKinds.has(normalized.kind) && !normalized.review) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `${normalized.kind} requires review counters`);
  if (!reviewKinds.has(normalized.kind) && normalized.review) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `review counters are not allowed for ${normalized.kind}`);
  if (['DESIGN_VALIDATED', 'IMPLEMENTATION_VALIDATED', 'QC_VALIDATED'].includes(normalized.kind) && (!['approve', 'pass'].includes(normalized.review.decision) || ['failed', 'security', 'dissent', 'questions'].some((key) => normalized.review[key] !== 0))) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `${normalized.kind} requires a passing zero-counter review`);
  if (normalized.kind === 'REVIEW_COMPLETED') {
    const passing = ['approve', 'pass'].includes(normalized.review.decision);
    const hasFinding = ['failed', 'security', 'dissent', 'questions'].some((key) => normalized.review[key] !== 0);
    if (passing === hasFinding) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'REVIEW_COMPLETED decision and counters disagree');
  }
  const allowedStates = {
    IMPORTED_BASELINE: TRACKING_STATES,
    ITEM_CREATED: new Set(['planned']),
    ITEM_ACTIVE: new Set(['active']),
    ITEM_UPDATED: new Set(['active', 'blocked']),
    REVIEW_COMPLETED: new Set(['active', 'blocked']),
    DESIGN_VALIDATED: new Set(['active']),
    IMPLEMENTATION_VALIDATED: new Set(['active']),
    BUG_FOUND: new Set(['active', 'blocked']),
    BUG_FIXED: new Set(['active']),
    QC_VALIDATED: new Set(['active']),
    ITEM_BLOCKED: new Set(['blocked']),
    ITEM_REOPENED: new Set(['active']),
    ITEM_DONE: new Set(['done']),
    ITEM_RELEASED: new Set(['done'])
  };
  if (!allowedStates[normalized.kind].has(normalized.localState)) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `${normalized.kind} is incompatible with ${normalized.localState} state`);
  if (canonicalJson(input) !== canonicalJson(normalized)) fail('KSTACK_JIRA_TRACKING_INPUT_NONCANONICAL', 'tracking input is not in canonical normalized form');
  assertOutboundSecretScan(Buffer.from(canonicalJson(normalized), 'utf8'));
  return normalized;
}

function enrolledBinding(state) {
  const tracking = state.jira?.tracking || state.config?.jira?.tracking || {};
  const repositoryNamespace = tracking.repositoryNamespace;
  const projectKey = tracking.projectKey;
  if (typeof repositoryNamespace !== 'string' || !REPOSITORY.test(repositoryNamespace) || typeof projectKey !== 'string' || !PROJECT_KEY.test(projectKey)) fail('KSTACK_JIRA_TRACKING_BINDING_REQUIRED', 'tracking append requires an enrolled repository namespace and project key');
  return { repositoryNamespace, projectKey };
}

function assertEnrolledBinding(state, input) {
  const binding = enrolledBinding(state);
  if (input.repositoryNamespace !== binding.repositoryNamespace || input.projectKey !== binding.projectKey) fail('KSTACK_JIRA_TRACKING_BINDING_DRIFT', 'tracking input differs from the enrolled repository or project');
  return binding;
}

function trackingRoot(state) {
  if (state.trackingRoot) {
    if (!path.isAbsolute(state.trackingRoot)) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'tracking root must be absolute');
    return state.trackingRoot;
  }
  const stateBase = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    : process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  if (!path.isAbsolute(stateBase)) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'state base must be absolute');
  let canonicalRepoRoot;
  try { canonicalRepoRoot = fs.realpathSync.native(state.repoRoot); } catch { fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'repository root cannot be canonicalized'); }
  const repositoryId = sha256(Buffer.from(canonicalRepoRoot, 'utf8'));
  return path.join(stateBase, 'kstack', 'jira-tracking', repositoryId);
}

function projectionRoot(state) {
  return path.join(trackingRoot(state), 'projection-receipts');
}

function itemMappingRoot(state) {
  return path.join(trackingRoot(state), 'item-mappings');
}

function createAttemptRoot(state) {
  return path.join(trackingRoot(state), 'create-attempts');
}

async function syncDirectory(directory) {
  const handle = await fsp.open(directory, fs.constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}

async function ensureTrackingRoot(state) {
  const root = trackingRoot(state);
  await fsp.mkdir(root, { recursive: true, mode: 0o700 });
  const boundary = state.trackingRoot
    ? path.dirname(root)
    : process.platform === 'win32'
      ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
      : process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  const relative = path.relative(boundary, root);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'tracking root escapes its state boundary');
  let current = boundary;
  for (const component of ['', ...relative.split(path.sep).filter(Boolean)]) {
    if (component) current = path.join(current, component);
    const stat = await fsp.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0 || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'tracking directory chain is not trusted');
    if (await fsp.realpath(current) !== path.resolve(current)) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'tracking directory chain is not canonical');
  }
  return root;
}

function requirePrivateFile(stat, link, description) {
  const sameIdentity = stat.dev === link.dev && stat.ino === link.ino;
  const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
  if (!stat.isFile() || !link.isFile() || link.isSymbolicLink() || !sameIdentity || !owned || (stat.mode & 0o777) !== 0o600 || stat.size > MAX_EVENT_BYTES) fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', `${description} is untrusted`);
}

async function readEventFile(file, options = {}) {
  let handle;
  try {
    handle = await fsp.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const [stat, link] = await Promise.all([handle.stat(), fsp.lstat(file)]);
    requirePrivateFile(stat, link, 'tracking event file');
    const bytes = await handle.readFile();
    let parsed;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch { fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', 'tracking event file is malformed'); }
    const event = validateTrackingEvent(parsed, options);
    const canonicalBytes = Buffer.from(`${canonicalJson(event)}\n`, 'utf8');
    if (!bytes.equals(canonicalBytes)) fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', 'tracking event file is not the exact canonical serialization');
    return event;
  } catch (error) {
    if (error instanceof JiraTrackingError) throw error;
    fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', `tracking event file could not be read: ${sanitize(error.message)}`);
  } finally {
    await handle?.close().catch(() => {});
  }
}

export function validateTrackingCapacity(snapshot) {
  const keys = Object.keys(TRACKING_LIMITS);
  exactKeys(snapshot, new Set(keys), 'tracking capacity snapshot');
  for (const key of keys) {
    if (!Number.isSafeInteger(snapshot[key]) || snapshot[key] < 0) fail('KSTACK_JIRA_TRACKING_LIMIT', `tracking ${key} count is invalid`);
    if (snapshot[key] > TRACKING_LIMITS[key]) fail('KSTACK_JIRA_TRACKING_LIMIT', `tracking ${key} limit exceeded`);
  }
  return Object.freeze({ ...snapshot });
}

async function inventoryTrackingRoot(state, root, { cleanResidue = false } = {}) {
  const names = await fsp.readdir(root);
  const eventNames = [];
  const residue = [];
  for (const name of names) {
    if (EVENT_FILE.test(name)) eventNames.push(name);
    else if (EVENT_TEMPORARY.test(name) || STALE_LOCK.test(name)) residue.push(name);
    else if (!['outbox-index.json.lock', 'projection-index.json.lock', 'projection-receipts', 'item-mappings', 'create-attempts'].includes(name)) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', `unexpected tracking root entry: ${name}`);
  }
  validateTrackingCapacity({ rootEntries: names.length, items: 0, events: 0, perItemEvents: 0, bytes: 0, residue: residue.length });
  if (cleanResidue) {
    for (const name of residue) await fsp.unlink(path.join(root, name));
    if (residue.length) await syncDirectory(root);
  }
  const itemDigests = new Set(eventNames.map((name) => name.slice(0, 64)));
  const itemCounts = new Map();
  for (const name of eventNames) itemCounts.set(name.slice(0, 64), (itemCounts.get(name.slice(0, 64)) || 0) + 1);
  const perItemEvents = Math.max(0, ...itemCounts.values());
  let totalBytes = 0;
  for (const name of eventNames) {
    const link = await fsp.lstat(path.join(root, name));
    const owned = typeof process.getuid !== 'function' || link.uid === process.getuid();
    if (!link.isFile() || link.isSymbolicLink() || !owned || (link.mode & 0o777) !== 0o600 || link.size > MAX_EVENT_BYTES) fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', 'tracking event file is untrusted');
    totalBytes += link.size;
  }
  for (const name of ['outbox-index.json.lock', 'projection-index.json.lock']) {
    const file = path.join(root, name);
    const link = await fsp.lstat(file).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (link) {
      const owned = typeof process.getuid !== 'function' || link.uid === process.getuid();
      if (!link.isFile() || link.isSymbolicLink() || !owned || (link.mode & 0o777) !== 0o600 || link.size > 4096) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', `${name} is untrusted`);
    }
  }
  for (const directory of ['projection-receipts', 'item-mappings', 'create-attempts']) {
    const link = await fsp.lstat(path.join(root, directory)).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (link) {
      const owned = typeof process.getuid !== 'function' || link.uid === process.getuid();
      if (!link.isDirectory() || link.isSymbolicLink() || !owned || (link.mode & 0o777) !== 0o700) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', `${directory} root is untrusted`);
    }
  }
  const snapshot = validateTrackingCapacity({
    rootEntries: cleanResidue ? names.length - residue.length : names.length,
    items: itemDigests.size,
    events: eventNames.length,
    perItemEvents,
    bytes: totalBytes,
    residue: cleanResidue ? 0 : residue.length
  });
  return { eventNames, itemDigests, totalBytes, rootEntries: snapshot.rootEntries };
}

function itemDigest(input) {
  return sha256(Buffer.from(canonicalJson({
    repositoryNamespace: input.repositoryNamespace,
    projectKey: input.projectKey,
    threadId: input.threadId,
    itemId: input.itemId
  }), 'utf8'));
}

function eventId(input, stableItemDigest) {
  return sha256(Buffer.from(`${stableItemDigest}\0${input.sourceEventId}`, 'utf8'));
}

export function validateTrackingEvent(event, options = {}) {
  const allowed = new Set([
    'schema', 'repositoryNamespace', 'projectKey', 'threadId', 'itemId',
    'stableItemDigest', 'sourceEventId', 'eventId', 'eventOrdinal',
    'priorEventDigest', 'eventDigest', 'kind', 'localState', 'occurredAt',
    'summary', 'evidence', 'review', 'release'
  ]);
  exactKeys(event, allowed, 'tracking event');
  const input = Object.fromEntries([...INPUT_KEYS].map((key) => [key, event[key]]));
  const normalized = normalizeTrackingInput(input, options);
  const stableItemDigest = itemDigest(normalized);
  if (event.schema !== TRACKING_EVENT_SCHEMA || event.stableItemDigest !== stableItemDigest || !SHA256.test(event.eventId) || !Number.isSafeInteger(event.eventOrdinal) || event.eventOrdinal < 1 || !SHA256.test(event.priorEventDigest) || !SHA256.test(event.eventDigest)) fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', 'tracking event identity or chain field is invalid');
  if (event.eventId !== eventId(normalized, stableItemDigest)) fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', 'tracking event ID is invalid');
  const body = { schema: event.schema, ...normalized, stableItemDigest, eventId: event.eventId, eventOrdinal: event.eventOrdinal, priorEventDigest: event.priorEventDigest };
  if (sha256(Buffer.from(canonicalJson(body), 'utf8')) !== event.eventDigest) fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', 'tracking event digest is invalid');
  return Object.freeze({ ...body, eventDigest: event.eventDigest });
}

async function acquireTrackingLock(state, root) {
  const lockState = { ...state, deliveryRecordPath: path.join(root, 'outbox-index.json') };
  const deadline = Date.now() + (state.lockWaitMs ?? 5000);
  for (;;) {
    try { return await acquireDeliveryLock(lockState, 'jira-tracking-append'); } catch (error) {
      if (error.exitCode !== EXIT.LOCK_HELD || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

async function acquireProjectionLock(state) {
  const root = await ensureTrackingRoot(state);
  const lockState = { ...state, deliveryRecordPath: path.join(root, 'projection-index.json') };
  const deadline = Date.now() + (state.lockWaitMs ?? 5000);
  for (;;) {
    try { return await acquireDeliveryLock(lockState, 'jira-tracking-project'); } catch (error) {
      if (error.exitCode !== EXIT.LOCK_HELD || Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

async function readItemEvents(state, root, stableItemDigest, inventory = null) {
  const available = inventory || await inventoryTrackingRoot(state, root);
  const names = available.eventNames.filter((name) => name.startsWith(`${stableItemDigest}-`)).sort();
  if (names.length > MAX_EVENTS_PER_ITEM) fail('KSTACK_JIRA_TRACKING_LIMIT', 'tracking item event limit exceeded');
  const events = [];
  for (const name of names) {
    const file = path.join(root, name);
    const event = await readEventFile(file, { clock: state.clock });
    assertEnrolledBinding(state, event);
    const expectedName = `${event.stableItemDigest}-${String(event.eventOrdinal).padStart(8, '0')}-${event.eventId}.json`;
    if (event.stableItemDigest !== stableItemDigest || name !== expectedName) fail('KSTACK_JIRA_TRACKING_EVENT_INVALID', 'tracking event is stored under the wrong identity');
    events.push(event);
  }
  events.sort((left, right) => left.eventOrdinal - right.eventOrdinal);
  let prior = '0'.repeat(64);
  const sourceIds = new Set();
  const eventIds = new Set();
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].eventOrdinal !== index + 1 || events[index].priorEventDigest !== prior) fail('KSTACK_JIRA_TRACKING_CHAIN_INVALID', 'tracking event chain is not contiguous');
    if (sourceIds.has(events[index].sourceEventId) || eventIds.has(events[index].eventId)) fail('KSTACK_JIRA_TRACKING_CHAIN_INVALID', 'tracking event chain repeats an event identity');
    sourceIds.add(events[index].sourceEventId);
    eventIds.add(events[index].eventId);
    prior = events[index].eventDigest;
  }
  return events;
}

async function durableWriteEvent(state, root, event) {
  const file = path.join(root, `${event.stableItemDigest}-${String(event.eventOrdinal).padStart(8, '0')}-${event.eventId}.json`);
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  let handle;
  let renamed = false;
  try {
    handle = await fsp.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    await handle.writeFile(`${canonicalJson(event)}\n`, 'utf8');
    await handle.sync();
    await state.testHooks?.afterFileSync?.({ file, temporary });
    await handle.close();
    handle = null;
    await fsp.rename(temporary, file);
    renamed = true;
    await state.testHooks?.afterRename?.({ file, temporary });
    await syncDirectory(root);
    await state.testHooks?.afterDirectorySync?.({ file, temporary });
  } finally {
    await handle?.close().catch(() => {});
    if (!renamed) await fsp.unlink(temporary).catch(() => {});
  }
  return file;
}

export async function appendTrackingEvent(state, rawInput) {
  const input = normalizeTrackingInput(rawInput, { clock: state.clock });
  assertEnrolledBinding(state, input);
  const root = await ensureTrackingRoot(state);
  const lock = await acquireTrackingLock(state, root);
  try {
    const inventory = await inventoryTrackingRoot(state, root, { cleanResidue: true });
    const stableItemDigest = itemDigest(input);
    const stableEventId = eventId(input, stableItemDigest);
    const current = await readItemEvents(state, root, stableItemDigest, inventory);
    const duplicate = current.find((event) => event.sourceEventId === input.sourceEventId || event.eventId === stableEventId);
    if (duplicate) {
      const candidateBody = {
        schema: TRACKING_EVENT_SCHEMA, ...input, stableItemDigest, eventId: stableEventId,
        eventOrdinal: duplicate.eventOrdinal, priorEventDigest: duplicate.priorEventDigest
      };
      const candidateDigest = sha256(Buffer.from(canonicalJson(candidateBody), 'utf8'));
      if (candidateDigest !== duplicate.eventDigest) fail('KSTACK_JIRA_TRACKING_SOURCE_CONFLICT', 'source event ID was reused with different content');
      return { created: false, event: duplicate };
    }
    const eventOrdinal = current.length + 1;
    const priorEventDigest = current.at(-1)?.eventDigest || '0'.repeat(64);
    const body = { schema: TRACKING_EVENT_SCHEMA, ...input, stableItemDigest, eventId: stableEventId, eventOrdinal, priorEventDigest };
    const event = { ...body, eventDigest: sha256(Buffer.from(canonicalJson(body), 'utf8')) };
    validateTrackingEvent(event, { clock: state.clock });
    const eventBytes = Buffer.byteLength(`${canonicalJson(event)}\n`, 'utf8');
    validateTrackingCapacity({
      rootEntries: inventory.rootEntries + 1,
      items: inventory.itemDigests.size + (inventory.itemDigests.has(stableItemDigest) ? 0 : 1),
      events: inventory.eventNames.length + 1,
      perItemEvents: current.length + 1,
      bytes: inventory.totalBytes + eventBytes,
      residue: 0
    });
    await durableWriteEvent(state, root, event);
    return { created: true, event };
  } finally {
    await releaseDeliveryLock(lock);
  }
}

export async function listTrackingEvents(state) {
  const root = await ensureTrackingRoot(state);
  const inventory = await inventoryTrackingRoot(state, root);
  const events = [];
  for (const stableItemDigest of [...inventory.itemDigests]) events.push(...await readItemEvents(state, root, stableItemDigest, inventory));
  return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.stableItemDigest.localeCompare(right.stableItemDigest) || left.eventOrdinal - right.eventOrdinal);
}

function trackingDraftId(stableItemDigest) {
  const hex = sha256(Buffer.from(`kstack-jira-tracking-draft\0${stableItemDigest}`, 'utf8')).slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function trackingDescription(event) {
  const evidence = event.evidence.length
    ? event.evidence.map((entry) => `- ${entry.evidenceKind}: ${entry.repoRelativePath} (SHA-256 ${entry.sha256})`).join('\n')
    : '- No evidence artifact recorded.';
  return [
    `KStack item ${event.threadId}/${event.itemId}.`,
    `Initial tracking state: ${event.localState}.`,
    `Source event: ${event.kind} at ${event.occurredAt}.`,
    '',
    'Evidence:',
    evidence
  ].join('\n');
}

export async function queueTrackingDrafts(trackingState, jiraState) {
  const events = await listTrackingEvents(trackingState);
  const firstByItem = new Map();
  for (const event of events) if (!firstByItem.has(event.stableItemDigest)) firstByItem.set(event.stableItemDigest, event);
  const results = [];
  for (const event of [...firstByItem.values()].sort((left, right) => left.stableItemDigest.localeCompare(right.stableItemDigest))) {
    if (!['IMPORTED_BASELINE', 'ITEM_CREATED'].includes(event.kind)) fail('KSTACK_JIRA_TRACKING_CHAIN_INVALID', `item ${event.itemId} does not begin with a creation or import event`);
    const project = jiraState.jira.tracking?.projectKey || event.projectKey;
    if (project !== event.projectKey) fail('KSTACK_JIRA_TRACKING_BINDING_DRIFT', 'tracking project differs from the outbox event');
    const projectConfig = jiraState.jira.projects.find((entry) => entry.key === project);
    if (!projectConfig?.issueTypes?.length) fail('KSTACK_JIRA_TRACKING_BINDING_DRIFT', 'tracking project has no configured issue type');
    const draft = await runJiraCommand(jiraState, 'draft', {
      trackingDraftId: trackingDraftId(event.stableItemDigest),
      project,
      issueType: projectConfig.issueTypes[0],
      summary: event.summary,
      description: trackingDescription(event),
      sessionId: `kstack-tracking:${event.stableItemDigest}`
    });
    results.push({
      stableItemDigest: event.stableItemDigest,
      eventId: event.eventId,
      draftId: draft.id,
      draftState: draft.state,
      payloadSha256: draft.payloadSha256,
      issueKey: draft.result?.key || null
    });
  }
  return results;
}

async function ensurePrivateTrackingSubdirectory(state, directory) {
  await ensureTrackingRoot(state);
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  const link = await fsp.lstat(directory);
  const owned = typeof process.getuid !== 'function' || link.uid === process.getuid();
  if (!link.isDirectory() || link.isSymbolicLink() || !owned || (link.mode & 0o777) !== 0o700 || await fsp.realpath(directory) !== path.resolve(directory)) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'tracking metadata directory is not trusted');
  return directory;
}

async function readPrivateCanonicalJson(file, errorCode) {
  let handle;
  try {
    handle = await fsp.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const [stat, link] = await Promise.all([handle.stat(), fsp.lstat(file)]);
    const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
    if (!stat.isFile() || !link.isFile() || link.isSymbolicLink() || stat.dev !== link.dev || stat.ino !== link.ino || !owned || (stat.mode & 0o777) !== 0o600 || stat.size > MAX_MAPPING_BYTES) fail(errorCode, 'tracking metadata file is untrusted');
    const bytes = await handle.readFile();
    let parsed;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch { fail(errorCode, 'tracking metadata file is malformed'); }
    if (!bytes.equals(Buffer.from(`${canonicalJson(parsed)}\n`, 'utf8'))) fail(errorCode, 'tracking metadata file is not the exact canonical serialization');
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof JiraTrackingError) throw error;
    fail(errorCode, `tracking metadata file could not be read: ${sanitize(error.message)}`);
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function durableReplaceCanonicalJson(state, directory, file, value) {
  await ensurePrivateTrackingSubdirectory(state, directory);
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  const handle = await fsp.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { await handle.writeFile(`${canonicalJson(value)}\n`, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  await fsp.rename(temporary, file);
  await syncDirectory(directory);
  return value;
}

function mappingPath(state, stableItemDigest) {
  if (!SHA256.test(stableItemDigest)) fail('KSTACK_JIRA_TRACKING_MAPPING_INVALID', 'stable item digest is invalid');
  return path.join(itemMappingRoot(state), `${stableItemDigest}.json`);
}

function attemptPath(state, stableItemDigest) {
  if (!SHA256.test(stableItemDigest)) fail('KSTACK_JIRA_TRACKING_ATTEMPT_INVALID', 'stable item digest is invalid');
  return path.join(createAttemptRoot(state), `${stableItemDigest}.json`);
}

function validateItemMapping(mapping, event, draft, payloadSha256) {
  const allowed = new Set(['schema', 'repositoryNamespace', 'projectKey', 'stableItemDigest', 'draftId', 'payloadSha256', 'identityLabel', 'issueId', 'issueKey', 'adopted', 'confirmedAt']);
  exactKeys(mapping, allowed, 'item mapping');
  if (mapping.schema !== ITEM_MAPPING_SCHEMA || mapping.repositoryNamespace !== event.repositoryNamespace || mapping.projectKey !== event.projectKey || mapping.stableItemDigest !== event.stableItemDigest || mapping.draftId !== draft.id || mapping.payloadSha256 !== payloadSha256 || mapping.identityLabel !== draft.idempotencyLabel) fail('KSTACK_JIRA_TRACKING_MAPPING_CONFLICT', 'item mapping does not match the repository, item, draft, or frozen payload');
  if (!/^[1-9][0-9]*$/u.test(String(mapping.issueId)) || !ISSUE_KEY.test(mapping.issueKey) || mapping.issueKey.split('-')[0] !== event.projectKey || typeof mapping.adopted !== 'boolean' || !canonicalInstant(mapping.confirmedAt)) fail('KSTACK_JIRA_TRACKING_MAPPING_INVALID', 'item mapping contains invalid Jira evidence');
  return mapping;
}

async function loadItemMapping(state, event, draft, payloadSha256) {
  const mapping = await readPrivateCanonicalJson(mappingPath(state, event.stableItemDigest), 'KSTACK_JIRA_TRACKING_MAPPING_INVALID');
  return mapping ? validateItemMapping(mapping, event, draft, payloadSha256) : null;
}

async function writeItemMapping(state, event, draft, payloadSha256, issue, adopted) {
  const candidate = {
    schema: ITEM_MAPPING_SCHEMA,
    repositoryNamespace: event.repositoryNamespace,
    projectKey: event.projectKey,
    stableItemDigest: event.stableItemDigest,
    draftId: draft.id,
    payloadSha256,
    identityLabel: draft.idempotencyLabel,
    issueId: String(issue.id),
    issueKey: issue.key,
    adopted,
    confirmedAt: new state.clock().toISOString()
  };
  const existing = await loadItemMapping(state, event, draft, payloadSha256);
  if (existing) {
    if (existing.issueId !== candidate.issueId || existing.issueKey !== candidate.issueKey) fail('KSTACK_JIRA_TRACKING_MAPPING_CONFLICT', 'stable item is already mapped to a different Jira issue');
    return existing;
  }
  validateItemMapping(candidate, event, draft, payloadSha256);
  return durableReplaceCanonicalJson(state, itemMappingRoot(state), mappingPath(state, event.stableItemDigest), candidate);
}

function validateCreateAttempt(attempt, event, draft, payloadSha256) {
  const allowed = new Set(['schema', 'repositoryNamespace', 'projectKey', 'stableItemDigest', 'draftId', 'payloadSha256', 'identityLabel', 'attemptId', 'startedAt', 'finishedAt', 'outcome', 'responseClass']);
  exactKeys(attempt, allowed, 'create attempt');
  if (attempt.schema !== CREATE_ATTEMPT_SCHEMA || attempt.repositoryNamespace !== event.repositoryNamespace || attempt.projectKey !== event.projectKey || attempt.stableItemDigest !== event.stableItemDigest || attempt.draftId !== draft.id || attempt.payloadSha256 !== payloadSha256 || attempt.identityLabel !== draft.idempotencyLabel || !UUID.test(attempt.attemptId)) fail('KSTACK_JIRA_TRACKING_ATTEMPT_INVALID', 'create attempt binding is invalid');
  if (!['armed', 'ambiguous', 'rejected', 'pre-connection-failure'].includes(attempt.outcome) || typeof attempt.responseClass !== 'string' || !canonicalInstant(attempt.startedAt) || (attempt.finishedAt !== null && !canonicalInstant(attempt.finishedAt))) fail('KSTACK_JIRA_TRACKING_ATTEMPT_INVALID', 'create attempt outcome is invalid');
  return attempt;
}

async function loadCreateAttempt(state, event, draft, payloadSha256) {
  const attempt = await readPrivateCanonicalJson(attemptPath(state, event.stableItemDigest), 'KSTACK_JIRA_TRACKING_ATTEMPT_INVALID');
  return attempt ? validateCreateAttempt(attempt, event, draft, payloadSha256) : null;
}

async function writeCreateAttempt(state, event, draft, payloadSha256, values) {
  const attempt = {
    schema: CREATE_ATTEMPT_SCHEMA,
    repositoryNamespace: event.repositoryNamespace,
    projectKey: event.projectKey,
    stableItemDigest: event.stableItemDigest,
    draftId: draft.id,
    payloadSha256,
    identityLabel: draft.idempotencyLabel,
    attemptId: values.attemptId,
    startedAt: values.startedAt,
    finishedAt: values.finishedAt,
    outcome: values.outcome,
    responseClass: values.responseClass
  };
  validateCreateAttempt(attempt, event, draft, payloadSha256);
  return durableReplaceCanonicalJson(state, createAttemptRoot(state), attemptPath(state, event.stableItemDigest), attempt);
}

function frozenTrackingPayload(jiraState, draft) {
  const canonicalPayload = draft.canonicalPayload || buildCanonicalPayload(jiraState, draft);
  let parsed;
  try { parsed = JSON.parse(canonicalPayload); } catch { fail('KSTACK_JIRA_TRACKING_PAYLOAD_INVALID', 'tracking draft canonical payload is malformed'); }
  const payloadSha256 = sha256(Buffer.from(canonicalPayload, 'utf8'));
  if (draft.payloadSha256 && draft.payloadSha256 !== payloadSha256) fail('KSTACK_JIRA_TRACKING_PAYLOAD_INVALID', 'tracking draft payload digest does not match its canonical payload');
  return { canonicalPayload, payloadSha256, expectedFields: parsed.fields };
}

async function ensureTrackingVisibility(jiraState, credentials, projectKey) {
  const permissions = await jiraJson(jiraState, credentials, `/rest/api/3/mypermissions?projectKey=${encodeURIComponent(projectKey)}&permissions=BROWSE_PROJECTS`);
  if (permissions.permissions?.BROWSE_PROJECTS?.havePermission !== true) fail('KSTACK_JIRA_TRACKING_VISIBILITY_REQUIRED', `BROWSE_PROJECTS is required for ${projectKey}`);
}

async function searchTrackingIssues(jiraState, credentials, draft) {
  await ensureTrackingVisibility(jiraState, credentials, draft.project);
  const matches = new Map();
  let nextPageToken;
  for (let page = 0; page < 100; page += 1) {
    const request = {
      jql: `project = "${draft.project}" AND labels = "${draft.idempotencyLabel}"`,
      fields: ['id', 'key'],
      maxResults: 100,
      ...(nextPageToken ? { nextPageToken } : {})
    };
    const response = await jiraJson(jiraState, credentials, '/rest/api/3/search/jql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify(request), 'utf8')
    });
    if (!Array.isArray(response.issues)) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', 'Jira issue search has no issues array');
    for (const issue of response.issues) {
      if (!/^[1-9][0-9]*$/u.test(String(issue.id)) || !ISSUE_KEY.test(issue.key)) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', 'Jira issue search returned an invalid identifier');
      const prior = matches.get(issue.key);
      if (prior && prior !== String(issue.id)) fail('KSTACK_JIRA_TRACKING_DUPLICATE', 'Jira returned conflicting IDs for one issue key');
      matches.set(issue.key, String(issue.id));
    }
    nextPageToken = response.nextPageToken;
    if (response.isLast === false && !nextPageToken) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', 'Jira issue search pagination lacks a next-page token');
    if (response.isLast === true || !nextPageToken) return [...matches].map(([key, id]) => ({ id, key }));
  }
  fail('KSTACK_JIRA_TRACKING_LIMIT', 'Jira issue search exceeded 100 complete pages');
}

async function verifyTrackingIssue(jiraState, credentials, event, draft, expectedFields, candidate) {
  const requestedFields = [...new Set(Object.keys(expectedFields))].join(',');
  const issue = await jiraJson(jiraState, credentials, `/rest/api/3/issue/${encodeURIComponent(candidate.key)}?fields=${encodeURIComponent(requestedFields)}`);
  if (String(issue.id) !== String(candidate.id) || issue.key !== candidate.key || !/^[1-9][0-9]*$/u.test(String(issue.id)) || !ISSUE_KEY.test(issue.key)) fail('KSTACK_JIRA_TRACKING_ADOPTION_MISMATCH', 'Jira issue identity differs from marker-search evidence');
  const fields = issue.fields;
  if (!fields || fields.project?.key !== event.projectKey || fields.issuetype?.name !== draft.issueType || fields.summary !== expectedFields.summary || !isDeepStrictEqual(fields.description, expectedFields.description)) fail('KSTACK_JIRA_TRACKING_ADOPTION_MISMATCH', 'Jira issue project, type, summary, or description differs from the frozen tracking draft');
  if (!Array.isArray(fields.labels) || !expectedFields.labels.every((label) => fields.labels.includes(label)) || fields.labels.filter((label) => /^kstack-draft-/u.test(label)).some((label) => label !== draft.idempotencyLabel)) fail('KSTACK_JIRA_TRACKING_ADOPTION_MISMATCH', 'Jira issue labels differ from the frozen tracking identity');
  for (const [field, expected] of Object.entries(expectedFields)) {
    if (['project', 'issuetype', 'summary', 'description', 'labels'].includes(field)) continue;
    if (!isDeepStrictEqual(fields[field], expected)) fail('KSTACK_JIRA_TRACKING_ADOPTION_MISMATCH', `Jira issue field ${field} differs from the frozen tracking draft`);
  }
  return { id: String(issue.id), key: issue.key };
}

async function adoptUniqueTrackingIssue(state, jiraState, credentials, event, draft, frozen, matches) {
  if (matches.length > 1) fail('KSTACK_JIRA_TRACKING_DUPLICATE', `multiple Jira issues contain tracking marker ${draft.idempotencyLabel}`);
  if (matches.length === 0) return null;
  const issue = await verifyTrackingIssue(jiraState, credentials, event, draft, frozen.expectedFields, matches[0]);
  return writeItemMapping(state, event, draft, frozen.payloadSha256, issue, true);
}

async function automaticallyCreateOrAdoptIssue(state, jiraState, event, draftResult) {
  let draft = (await runJiraCommand(jiraState, 'list')).find((entry) => entry.id === draftResult.draftId);
  if (!draft) fail('KSTACK_JIRA_TRACKING_DRAFT_MISSING', `tracking draft ${draftResult.draftId} is missing`);
  if (draft.sessionId !== `kstack-tracking:${event.stableItemDigest}` || draft.id !== trackingDraftId(event.stableItemDigest)) fail('KSTACK_JIRA_TRACKING_BINDING_DRIFT', 'tracking draft is not bound to the stable repository item');
  if (draft.state === 'pending') draft = await runJiraCommand(jiraState, 'show', { id: draft.id });
  if (draft.state === 'pending' && draft.payloadSha256) draft = await runJiraCommand(jiraState, 'approve', { id: draft.id, payloadHash: draft.payloadSha256 });
  const frozen = frozenTrackingPayload(jiraState, draft);
  const mapped = await loadItemMapping(state, event, draft, frozen.payloadSha256);
  if (mapped) return mapped;
  const credentials = await resolveCredentials(jiraState);
  const matches = await searchTrackingIssues(jiraState, credentials, draft);
  const adopted = await adoptUniqueTrackingIssue(state, jiraState, credentials, event, draft, frozen, matches);
  if (adopted) return adopted;
  const priorAttempt = await loadCreateAttempt(state, event, draft, frozen.payloadSha256);
  if (priorAttempt && priorAttempt.outcome !== 'pre-connection-failure') fail('KSTACK_JIRA_TRACKING_CREATE_UNKNOWN', `creation attempt ${priorAttempt.attemptId} is ${priorAttempt.outcome}; Jira has no exact visible match, so automatic retry is blocked`);
  if (draft.state === 'submitted') fail('KSTACK_JIRA_TRACKING_MAPPING_CONFLICT', 'submitted Jira draft has no exact project-bounded marker match');
  if (draft.state !== 'approved') fail('KSTACK_JIRA_TRACKING_CREATE_BLOCKED', `tracking draft ${draft.id} is ${draft.state}`);

  const attemptId = crypto.randomUUID();
  const startedAt = new jiraState.clock().toISOString();
  await writeCreateAttempt(state, event, draft, frozen.payloadSha256, { attemptId, startedAt, finishedAt: null, outcome: 'armed', responseClass: 'not-sent' });
  let classification;
  try {
    const response = await jiraRequest(jiraState, credentials, '/rest/api/3/issue', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: Buffer.from(frozen.canonicalPayload, 'utf8')
    });
    classification = await classifyCreateResponse(response);
  } catch (error) {
    classification = classifyFetchError(error);
  }
  const finishedAt = new jiraState.clock().toISOString();
  if (classification.state === 'submitted') {
    const issue = await verifyTrackingIssue(jiraState, credentials, event, draft, frozen.expectedFields, { id: classification.issueId, key: classification.issueKey });
    return writeItemMapping(state, event, draft, frozen.payloadSha256, issue, false);
  }
  const outcome = classification.responseClass === 'pre-connection-failure' ? 'pre-connection-failure' : classification.state === 'failed' ? 'rejected' : 'ambiguous';
  await writeCreateAttempt(state, event, draft, frozen.payloadSha256, { attemptId, startedAt, finishedAt, outcome, responseClass: classification.responseClass });
  if (outcome === 'ambiguous') {
    const reconciled = await searchTrackingIssues(jiraState, credentials, draft);
    const recovered = await adoptUniqueTrackingIssue(state, jiraState, credentials, event, draft, frozen, reconciled);
    if (recovered) return recovered;
  }
  fail(outcome === 'rejected' ? 'KSTACK_JIRA_TRACKING_CREATE_REJECTED' : 'KSTACK_JIRA_TRACKING_CREATE_UNKNOWN', `Jira create ended as ${classification.responseClass}; no second POST was attempted`);
}

function commentText(event) {
  const evidence = event.evidence.length
    ? event.evidence.map((entry) => `- ${entry.evidenceKind}: ${entry.repoRelativePath} (SHA-256 ${entry.sha256})`).join('\n')
    : '- No evidence artifact recorded.';
  const review = event.review
    ? `Decision ${event.review.decision}; confidence ${event.review.confidence}; failed ${event.review.failed}; security ${event.review.security}; dissent ${event.review.dissent}; questions ${event.review.questions}.`
    : 'No review counters recorded for this event.';
  const release = event.release
    ? `Release ${event.release.name} on ${event.release.releaseDate}; receipt SHA-256 ${event.release.receiptSha256}.`
    : 'No release attached to this event.';
  return [
    `[kstack-event:${event.eventId}]`,
    `${event.kind}: ${event.summary}`,
    `Local state: ${event.localState}. Occurred at: ${event.occurredAt}.`,
    review,
    release,
    '',
    'Evidence:',
    evidence
  ].join('\n');
}

function commentAdf(text) {
  return {
    version: 1,
    type: 'doc',
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : []
    }))
  };
}

function adfText(value) {
  if (!value || typeof value !== 'object') return '';
  if (value.type === 'text' && typeof value.text === 'string') return value.text;
  return Array.isArray(value.content) ? value.content.map(adfText).join('\n') : '';
}

async function findEventComments(jiraState, credentials, issueKey, eventId) {
  const marker = `[kstack-event:${eventId}]`;
  const matches = [];
  let startAt = 0;
  for (let page = 0; page < 100; page += 1) {
    const response = await jiraJson(
      jiraState,
      credentials,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?startAt=${startAt}&maxResults=100`
    );
    if (!Array.isArray(response.comments)) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', 'Jira comments response has no comments array');
    for (const comment of response.comments) if (adfText(comment.body).includes(marker)) matches.push(comment);
    const total = Number(response.total ?? startAt + response.comments.length);
    if (response.comments.length === 0 || startAt + response.comments.length >= total) return matches;
    startAt += response.comments.length;
  }
  fail('KSTACK_JIRA_TRACKING_LIMIT', 'Jira comment pagination exceeded 100 pages');
}

async function durableWriteProjectionReceipt(state, event, issueKey, commentId, adopted) {
  const root = projectionRoot(state);
  await fsp.mkdir(root, { recursive: true, mode: 0o700 });
  const rootStat = await fsp.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (rootStat.mode & 0o022) !== 0) fail('KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED', 'projection receipt root is not a trusted private directory');
  if (!ISSUE_KEY.test(issueKey) || !/^[1-9][0-9]*$/u.test(String(commentId))) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', 'Jira returned an invalid issue or comment identifier');
  const receipt = {
    schema: 'kstack-jira-projection-receipt-v1',
    eventId: event.eventId,
    eventDigest: event.eventDigest,
    issueKey,
    commentId: String(commentId),
    adopted,
    projectedAt: new state.clock().toISOString()
  };
  const file = path.join(root, `${event.eventId}.json`);
  const stat = await fsp.lstat(file).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (stat) {
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024) fail('KSTACK_JIRA_TRACKING_RECEIPT_INVALID', 'projection receipt is untrusted');
    const existing = await fsp.readFile(file, 'utf8');
    let parsed;
    try { parsed = JSON.parse(existing); } catch { fail('KSTACK_JIRA_TRACKING_RECEIPT_INVALID', 'projection receipt is malformed'); }
    if (Object.keys(parsed).sort().join(',') !== 'adopted,commentId,eventDigest,eventId,issueKey,projectedAt,schema' || parsed.schema !== 'kstack-jira-projection-receipt-v1' || parsed.eventId !== event.eventId || parsed.eventDigest !== event.eventDigest || parsed.issueKey !== issueKey || parsed.commentId !== String(commentId)) fail('KSTACK_JIRA_TRACKING_RECEIPT_CONFLICT', 'projection receipt conflicts with Jira evidence');
    return parsed;
  }
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  const handle = await fsp.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { await handle.writeFile(`${canonicalJson(receipt)}\n`, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  await fsp.rename(temporary, file);
  await syncDirectory(root);
  return receipt;
}

async function projectOneEvent(state, jiraState, credentials, event, issueKey) {
  if (!ISSUE_KEY.test(issueKey)) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', 'Jira issue key is invalid');
  const matches = await findEventComments(jiraState, credentials, issueKey, event.eventId);
  if (matches.length > 1) fail('KSTACK_JIRA_TRACKING_DUPLICATE', `multiple Jira comments contain event marker ${event.eventId}`);
  if (matches.length === 1) {
    const receipt = await durableWriteProjectionReceipt(state, event, issueKey, matches[0].id, true);
    return { eventId: event.eventId, issueKey, commentId: receipt.commentId, adopted: true };
  }
  let response;
  try {
    response = await jiraRequest(jiraState, credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify({ body: commentAdf(commentText(event)) }), 'utf8')
    });
  } catch {
    const reconciled = await findEventComments(jiraState, credentials, issueKey, event.eventId);
    if (reconciled.length > 1) fail('KSTACK_JIRA_TRACKING_DUPLICATE', `multiple Jira comments contain event marker ${event.eventId}`);
    if (reconciled.length === 1) {
      const receipt = await durableWriteProjectionReceipt(state, event, issueKey, reconciled[0].id, true);
      return { eventId: event.eventId, issueKey, commentId: receipt.commentId, adopted: true };
    }
    fail('KSTACK_JIRA_TRACKING_PROJECTION_UNKNOWN', `comment outcome is unknown for event ${event.eventId}`);
  }
  let body = null;
  try { body = await response.json(); } catch {}
  if (response.ok && body?.id) {
    const receipt = await durableWriteProjectionReceipt(state, event, issueKey, body.id, false);
    return { eventId: event.eventId, issueKey, commentId: receipt.commentId, adopted: false };
  }
  if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) fail('KSTACK_JIRA_TRACKING_PROJECTION_REJECTED', `Jira rejected event comment with HTTP ${response.status}`);
  const reconciled = await findEventComments(jiraState, credentials, issueKey, event.eventId);
  if (reconciled.length > 1) fail('KSTACK_JIRA_TRACKING_DUPLICATE', `multiple Jira comments contain event marker ${event.eventId}`);
  if (reconciled.length === 1) {
    const receipt = await durableWriteProjectionReceipt(state, event, issueKey, reconciled[0].id, true);
    return { eventId: event.eventId, issueKey, commentId: receipt.commentId, adopted: true };
  }
  fail('KSTACK_JIRA_TRACKING_PROJECTION_UNKNOWN', `comment outcome is unknown for event ${event.eventId}`);
}

const STATUS_CATEGORY_BY_LOCAL_STATE = Object.freeze({
  planned: 'new',
  active: 'indeterminate',
  done: 'done'
});

async function readStatusCategory(jiraState, credentials, issueKey) {
  const issue = await jiraJson(jiraState, credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status`);
  const category = issue.fields?.status?.statusCategory?.key;
  if (!['new', 'indeterminate', 'done'].includes(category)) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', `Jira returned an invalid status category for ${issueKey}`);
  return category;
}

async function projectLatestStatus(jiraState, credentials, event, issueKey) {
  if (event.localState === 'blocked') return { issueKey, localState: 'blocked', status: 'comment-only', reason: 'Jira status categories have no portable blocked category' };
  const desired = STATUS_CATEGORY_BY_LOCAL_STATE[event.localState];
  const current = await readStatusCategory(jiraState, credentials, issueKey);
  if (current === desired) return { issueKey, localState: event.localState, status: 'confirmed', statusCategory: current, adopted: true };
  const response = await jiraJson(jiraState, credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`);
  if (!Array.isArray(response.transitions)) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', 'Jira transitions response has no transitions array');
  const candidates = response.transitions.filter((transition) => transition?.to?.statusCategory?.key === desired && /^[1-9][0-9]*$/u.test(String(transition.id)));
  if (candidates.length !== 1) fail('KSTACK_JIRA_TRACKING_TRANSITION_AMBIGUOUS', `${issueKey} has ${candidates.length} transitions to status category ${desired}`);
  let transitionResponse;
  try {
    transitionResponse = await jiraRequest(jiraState, credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify({ transition: { id: String(candidates[0].id) } }), 'utf8')
    });
  } catch {
    const reconciled = await readStatusCategory(jiraState, credentials, issueKey);
    if (reconciled === desired) return { issueKey, localState: event.localState, status: 'confirmed', statusCategory: desired, adopted: true };
    fail('KSTACK_JIRA_TRACKING_TRANSITION_UNKNOWN', `transition outcome is unknown for ${issueKey}`);
  }
  if (transitionResponse.status >= 400 && transitionResponse.status < 500 && transitionResponse.status !== 408 && transitionResponse.status !== 429) fail('KSTACK_JIRA_TRACKING_TRANSITION_REJECTED', `Jira rejected transition for ${issueKey} with HTTP ${transitionResponse.status}`);
  const reconciled = await readStatusCategory(jiraState, credentials, issueKey);
  if (reconciled !== desired) fail('KSTACK_JIRA_TRACKING_TRANSITION_UNKNOWN', `transition outcome is unknown for ${issueKey}`);
  return { issueKey, localState: event.localState, status: 'confirmed', statusCategory: desired, adopted: false };
}

async function readIssueVersions(jiraState, credentials, issueKey) {
  const issue = await jiraJson(jiraState, credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=fixVersions`);
  const versions = issue.fields?.fixVersions;
  if (!Array.isArray(versions) || versions.some((version) => !/^[1-9][0-9]*$/u.test(String(version.id)))) fail('KSTACK_JIRA_TRACKING_RESPONSE_INVALID', `Jira returned invalid fixVersions for ${issueKey}`);
  return versions.map((version) => String(version.id));
}

async function projectReleaseVersion(jiraState, credentials, event, issueKey) {
  if (event.kind !== 'ITEM_RELEASED') return null;
  const tracking = jiraState.jira.tracking;
  if (!tracking.automaticVersionAssignment) return { issueKey, release: event.release.name, status: 'comment-only', reason: 'automatic version assignment is disabled' };
  const approved = tracking.releaseVersions.find((version) => version.name === event.release.name);
  if (!approved || approved.releaseDate !== event.release.releaseDate) fail('KSTACK_JIRA_TRACKING_VERSION_UNAPPROVED', `release ${event.release.name} is not bound to an approved exact Jira version`);
  const [project, version] = await Promise.all([
    jiraJson(jiraState, credentials, `/rest/api/3/project/${encodeURIComponent(event.projectKey)}`),
    jiraJson(jiraState, credentials, `/rest/api/3/version/${encodeURIComponent(approved.id)}`)
  ]);
  if (!/^[1-9][0-9]*$/u.test(String(project.id)) || String(version.id) !== approved.id || version.name !== approved.name || String(version.projectId) !== String(project.id) || version.releaseDate !== approved.releaseDate || version.released !== true) fail('KSTACK_JIRA_TRACKING_VERSION_DRIFT', `approved Jira version ${approved.id} does not match its project, name, date, and released state`);
  const current = await readIssueVersions(jiraState, credentials, issueKey);
  if (current.includes(approved.id)) return { issueKey, release: approved.name, versionId: approved.id, status: 'confirmed', adopted: true };
  let response;
  try {
    response = await jiraRequest(jiraState, credentials, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify({ update: { fixVersions: [{ add: { id: approved.id } }] } }), 'utf8')
    });
  } catch {
    const reconciled = await readIssueVersions(jiraState, credentials, issueKey);
    if (reconciled.includes(approved.id)) return { issueKey, release: approved.name, versionId: approved.id, status: 'confirmed', adopted: true };
    fail('KSTACK_JIRA_TRACKING_VERSION_UNKNOWN', `version assignment outcome is unknown for ${issueKey}`);
  }
  if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) fail('KSTACK_JIRA_TRACKING_VERSION_REJECTED', `Jira rejected version assignment for ${issueKey} with HTTP ${response.status}`);
  const reconciled = await readIssueVersions(jiraState, credentials, issueKey);
  if (!reconciled.includes(approved.id)) fail('KSTACK_JIRA_TRACKING_VERSION_UNKNOWN', `version assignment outcome is unknown for ${issueKey}`);
  return { issueKey, release: approved.name, versionId: approved.id, status: 'confirmed', adopted: false };
}

export async function syncTrackingEvents(trackingState, jiraState) {
  const tracking = jiraState.jira.tracking || { mode: 'off', required: false };
  if (tracking.mode === 'off') return { mode: 'off', drafts: [], projected: [], statuses: [], versions: [] };
  const lock = await acquireProjectionLock(trackingState);
  try {
    const events = await listTrackingEvents(trackingState);
    if (events.some((event) => event.repositoryNamespace !== tracking.repositoryNamespace)) fail('KSTACK_JIRA_TRACKING_BINDING_DRIFT', 'tracking repository namespace differs from the outbox event');
    const drafts = await queueTrackingDrafts(trackingState, jiraState);
    if (tracking.mode === 'approval-queued') return { mode: tracking.mode, drafts, projected: [], statuses: [], versions: [] };
    if (tracking.mode !== 'automatic' || jiraState.config?.authority?.externalTicketCreation !== 'allow') fail('KSTACK_JIRA_TRACKING_AUTHORITY_REQUIRED', 'automatic tracking requires externalTicketCreation allow');
    const issueByItem = new Map();
    for (const draftResult of drafts) {
      const event = events.find((entry) => entry.stableItemDigest === draftResult.stableItemDigest);
      if (!event) fail('KSTACK_JIRA_TRACKING_BINDING_DRIFT', `tracking draft ${draftResult.draftId} has no source event`);
      const mapping = await automaticallyCreateOrAdoptIssue(trackingState, jiraState, event, draftResult);
      issueByItem.set(draftResult.stableItemDigest, mapping.issueKey);
    }
    const credentials = await resolveCredentials(jiraState);
    const projected = [];
    for (const event of events) {
      const issueKey = issueByItem.get(event.stableItemDigest);
      if (!issueKey) fail('KSTACK_JIRA_TRACKING_BINDING_DRIFT', `no Jira issue is bound to item ${event.itemId}`);
      projected.push(await projectOneEvent(trackingState, jiraState, credentials, event, issueKey));
    }
    const latestByItem = new Map();
    for (const event of events) latestByItem.set(event.stableItemDigest, event);
    const statuses = [];
    for (const [stableItemDigest, event] of latestByItem) statuses.push(await projectLatestStatus(jiraState, credentials, event, issueByItem.get(stableItemDigest)));
    const versions = [];
    for (const event of events.filter((entry) => entry.kind === 'ITEM_RELEASED')) versions.push(await projectReleaseVersion(jiraState, credentials, event, issueByItem.get(event.stableItemDigest)));
    return { mode: tracking.mode, drafts, projected, statuses, versions };
  } finally {
    await releaseDeliveryLock(lock);
  }
}

function readInputFile(file) {
  const resolved = path.resolve(file);
  let descriptor;
  try {
    descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const stat = fs.fstatSync(descriptor);
    const link = fs.lstatSync(resolved);
    const owned = typeof process.getuid !== 'function' || stat.uid === process.getuid();
    if (!stat.isFile() || !link.isFile() || link.isSymbolicLink() || stat.dev !== link.dev || stat.ino !== link.ino || !owned || (stat.mode & 0o077) !== 0 || stat.size > MAX_EVENT_BYTES) fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'input file is untrusted');
    return JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } catch (error) {
    if (error instanceof JiraTrackingError) throw error;
    fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `input file is invalid JSON or untrusted: ${sanitize(error.message)}`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

const HELP = `KStack Jira continuous tracking\n\nCommands:\n  append --file PATH --config PATH\n  list --config PATH\n  sync --config PATH\n\nappend and list are local only. Their config binds events to the enrolled repository and Jira project. sync obeys jira.tracking.mode: approval-queued creates only offline drafts; automatic may create Jira issues and append marker-bound history comments.`;

async function cli(argv) {
  const [command = 'help', ...args] = argv;
  if (command === 'help') return process.stdout.write(`${HELP}\n`);
  let file;
  let configPath;
  if (command === 'append' && args.length === 4 && args[0] === '--file' && args[1] && args[2] === '--config' && args[3]) {
    [, file, , configPath] = args;
  } else if (['list', 'sync'].includes(command) && args.length === 2 && args[0] === '--config' && args[1]) {
    [, configPath] = args;
  } else fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', 'invalid command arguments');
  const jiraState = await loadJiraState({ configPath, command: `tracking-${command}` });
  const state = { repoRoot: jiraState.repoRoot, jira: jiraState.jira, config: jiraState.config, clock: jiraState.clock };
  const result = command === 'append'
    ? await appendTrackingEvent(state, readInputFile(file))
    : command === 'list'
      ? await listTrackingEvents(state)
      : command === 'sync'
        ? await syncTrackingEvents(state, jiraState)
      : fail('KSTACK_JIRA_TRACKING_INPUT_INVALID', `unknown command: ${command}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${sanitize(error.message || String(error))}\n`);
    process.exitCode = 2;
  });
}
