#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './kstack-safety-broker.mjs';
import {
  EXIT, JiraQueueError, classifyFetchError, jiraRequest, loadJiraState,
  resolveCredentials
} from './kstack-jira.mjs';
import { sanitize } from './kstack-provider-runner.mjs';

export const DELIVERY_RECORD = '.kstack/jira-delivery-stack.json';
export const DELIVERY_SCHEMA = 'kstack-jira-delivery-stack-v1';
export const DELIVERY_LOCK_STALE_MS = 90_000;
export const DELIVERY_STATES = Object.freeze(new Set([
  'skipped', 'existing-unverified', 'existing-validated', 'new-previewed',
  'new-approved', 'applying', 'ambiguous', 'verified', 'failed'
]));

const MODES = new Set(['skip', 'existing', 'new', 'existing-add-board']);
const BOARD_TYPES = new Set(['kanban', 'scrum']);
const ROADMAP_MODES = new Set(['auto', 'custom', 'empty']);
const ROADMAP_LOCAL_ID = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const ROADMAP_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const DEFAULT_ROADMAP_ITEMS = Object.freeze([
  Object.freeze({ localId: 'objectives', issueType: 'Task', summary: 'Confirm objectives and acceptance evidence', description: 'Ground the objective in repository evidence and freeze measurable acceptance criteria.', labels: ['kstack-lifecycle', 'objectives'] }),
  Object.freeze({ localId: 'design', issueType: 'Task', summary: 'Complete independent design review', description: 'Resolve design findings and obtain the configured KStack design-gate evidence.', labels: ['kstack-lifecycle', 'design'] }),
  Object.freeze({ localId: 'implementation', issueType: 'Task', summary: 'Implement the accepted design', description: 'Implement only the accepted plan and record any material deviation for interrogation.', labels: ['kstack-lifecycle', 'implementation'] }),
  Object.freeze({ localId: 'quality-control', issueType: 'Task', summary: 'Run quality control and close defects', description: 'Run the configured verification and adversarial QC loop until the accepted closure rule is met.', labels: ['kstack-lifecycle', 'quality-control'] }),
  Object.freeze({ localId: 'release', issueType: 'Task', summary: 'Ship and verify the release', description: 'Execute the approved release path, verify target health, and retain the release evidence.', labels: ['kstack-lifecycle', 'release'] })
]);
const PROJECT_TEMPLATES = Object.freeze({
  software: Object.freeze({
    kanban: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
    scrum: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic'
  }),
  business: Object.freeze({
    kanban: 'com.atlassian.jira-core-project-templates:jira-core-simplified-project-management',
    scrum: 'com.atlassian.jira-core-project-templates:jira-core-simplified-project-management'
  })
});
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,9}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

function fail(message, exitCode = EXIT.STATE_ERROR, details) {
  throw new JiraQueueError(message, exitCode, details);
}

function nowIso(clock = Date) {
  return new clock().toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function bounded(value, field, maximum = 255) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !value.isWellFormed() || CONTROL_OR_BIDI.test(value)) {
    fail(`${field} is invalid`, EXIT.CONFIG_INVALID);
  }
  return value;
}

function list(value, field, validator) {
  const values = typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value;
  if (!Array.isArray(values) || values.length < 1 || values.length > 16) fail(`${field} must contain 1-16 values`, EXIT.CONFIG_INVALID);
  const unique = [...new Set(values)];
  for (const item of unique) validator(item);
  return unique;
}

function roadmapMarker(projectKey, localId) {
  return `kstack-roadmap-${sha256(Buffer.from(`${projectKey}\0${localId}`, 'utf8')).slice(0, 24)}`;
}

function normalizeRoadmapItems(value, projectKey) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) fail('roadmap must contain 1-64 items', EXIT.CONFIG_INVALID);
  const localIds = new Set();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`roadmap item ${index + 1} is invalid`, EXIT.CONFIG_INVALID);
    const allowed = new Set(['localId', 'issueType', 'summary', 'description', 'labels']);
    if (Object.keys(raw).some((key) => !allowed.has(key))) fail(`roadmap item ${index + 1} contains an unknown field`, EXIT.CONFIG_INVALID);
    const localId = bounded(raw.localId, `roadmap item ${index + 1} localId`, 64);
    if (!ROADMAP_LOCAL_ID.test(localId) || localIds.has(localId)) fail(`roadmap item ${index + 1} localId is invalid or duplicated`, EXIT.CONFIG_INVALID);
    localIds.add(localId);
    const issueType = bounded(raw.issueType || 'Task', `roadmap item ${index + 1} issueType`, 64);
    const summary = bounded(raw.summary, `roadmap item ${index + 1} summary`, 255);
    const description = bounded(raw.description, `roadmap item ${index + 1} description`, 4000);
    const labels = raw.labels == null ? [] : list(raw.labels, `roadmap item ${index + 1} labels`, (label) => {
      bounded(label, `roadmap item ${index + 1} label`, 64);
      if (!ROADMAP_LABEL.test(label)) fail(`roadmap item ${index + 1} label is invalid`, EXIT.CONFIG_INVALID);
    });
    const marker = roadmapMarker(projectKey, localId);
    const contentSha256 = sha256(Buffer.from(canonicalJson({ localId, issueType, summary, description, labels }), 'utf8'));
    const contentMarker = `kstack-content-${contentSha256.slice(0, 24)}`;
    return { localId, issueType, summary, description, labels: [...new Set([marker, contentMarker, ...labels])], marker, contentSha256 };
  });
}

function configDigest(state) {
  if (typeof state.configDigest === 'string') return state.configDigest;
  return sha256(Buffer.from(canonicalJson(state.config), 'utf8'));
}

function planDigest(plan) {
  return sha256(Buffer.from(canonicalJson(plan), 'utf8'));
}

function recordPath(state) {
  return state.deliveryRecordPath || path.join(state.repoRoot, DELIVERY_RECORD);
}

function lockPath(state) {
  return `${recordPath(state)}.lock`;
}

async function syncDirectory(directory) {
  const handle = await fsp.open(directory, fs.constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function writeDeliveryRecord(state, record, lock = null) {
  if (lock) await assertDeliveryLock(lock);
  validateDeliveryRecord(record);
  const file = recordPath(state);
  const directory = path.dirname(file);
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  const link = await fsp.lstat(directory);
  if (!link.isDirectory() || link.isSymbolicLink() || (link.mode & 0o022) !== 0) fail('delivery record directory is untrusted', EXIT.CONFIG_INVALID);
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  const handle = await fsp.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    await handle.writeFile(`${canonicalJson(record)}\n`, 'utf8');
    await handle.sync();
  } finally { await handle.close(); }
  try {
    await fsp.rename(temporary, file);
    await syncDirectory(directory);
  } catch (error) {
    await fsp.unlink(temporary).catch(() => {});
    throw error;
  }
  return record;
}

export async function readDeliveryRecord(state) {
  const file = recordPath(state);
  let handle;
  try { handle = await fsp.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    const stat = await handle.stat();
    const link = await fsp.lstat(file);
    if (!stat.isFile() || !link.isFile() || link.isSymbolicLink() || stat.dev !== link.dev || stat.ino !== link.ino || (stat.mode & 0o022) !== 0 || stat.size > 256 * 1024) fail('delivery record is untrusted', EXIT.CONFIG_INVALID);
    let record;
    try { record = JSON.parse(await handle.readFile('utf8')); } catch (error) { fail(`delivery record is malformed: ${sanitize(error.message)}`); }
    validateDeliveryRecord(record);
    return record;
  } finally { await handle.close(); }
}

function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return null;
  try { process.kill(pid, 0); return true; } catch (error) {
    if (error.code === 'ESRCH') return false;
    return null;
  }
}

async function readLock(file) {
  try {
    const link = await fsp.lstat(file);
    if (!link.isFile() || link.isSymbolicLink() || link.size > 4096) return null;
    const value = JSON.parse(await fsp.readFile(file, 'utf8'));
    return { value, link };
  } catch { return null; }
}

export async function acquireDeliveryLock(state, operation) {
  const file = lockPath(state);
  const directory = path.dirname(file);
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = crypto.randomUUID();
    let handle;
    try {
      handle = await fsp.open(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      const owner = { schema: 'kstack-jira-delivery-lock-v1', token, operation, pid: process.pid, hostname: os.hostname(), acquiredAt: nowIso(state.clock) };
      await handle.writeFile(canonicalJson(owner), 'utf8');
      await handle.sync();
      await syncDirectory(directory);
      return { file, directory, token, owner, handle };
    } catch (error) {
      await handle?.close().catch(() => {});
      if (error.code !== 'EEXIST') throw error;
      const current = await readLock(file);
      const age = current ? new state.clock().getTime() - current.link.mtimeMs : -1;
      const sameHost = current?.value?.hostname === os.hostname();
      if (attempt > 0 || !sameHost || age < DELIVERY_LOCK_STALE_MS || processAlive(current.value.pid) !== false) fail('Jira delivery stack is locked by another operation', EXIT.LOCK_HELD);
      const tombstone = `${file}.stale-${crypto.randomUUID()}`;
      try { await fsp.rename(file, tombstone); } catch { fail('Jira delivery lock changed during stale recovery', EXIT.LOCK_BREAK_RACE); }
      await syncDirectory(directory);
    }
  }
  fail('Jira delivery stack lock could not be acquired', EXIT.LOCK_HELD);
}

async function assertDeliveryLock(lock) {
  const current = await readLock(lock.file);
  if (!current || current.value.token !== lock.token) fail('Jira delivery stack lock was fenced', EXIT.LOCK_FENCED_CLEAN);
}

export async function releaseDeliveryLock(lock) {
  try {
    await assertDeliveryLock(lock);
    await fsp.unlink(lock.file);
    await syncDirectory(lock.directory);
  } finally { await lock.handle.close().catch(() => {}); }
}

async function withDeliveryLock(state, operation, action) {
  const lock = await acquireDeliveryLock(state, operation);
  let result;
  let actionError;
  try { result = await action(lock); } catch (error) { actionError = error; }
  try { await releaseDeliveryLock(lock); } catch (releaseError) {
    if (!actionError) throw releaseError;
    actionError.releaseError = releaseError;
  }
  if (actionError) throw actionError;
  return result;
}

export function validateDeliveryRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.schema !== DELIVERY_SCHEMA || !DELIVERY_STATES.has(record.state)) fail('delivery record schema/state is invalid');
  if (typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) fail('delivery record timestamp is invalid');
  if (record.state === 'skipped') {
    if (record.plan !== null || record.planSha256 !== null) fail('skipped delivery record must not contain a plan');
    return record;
  }
  if (!record.plan || typeof record.plan !== 'object' || Array.isArray(record.plan)) fail('delivery plan is absent');
  const expected = planDigest(record.plan);
  if (record.planSha256 !== expected) fail('delivery plan digest mismatch', EXIT.PAYLOAD_INTEGRITY);
  if (!MODES.has(record.plan.mode) || record.plan.mode === 'skip') fail('delivery plan mode is invalid');
  if (!Array.isArray(record.operations) || !Array.isArray(record.effects)) fail('delivery operation ledger is invalid');
  return record;
}

function normalizeArgs(state, args) {
  const mode = args.mode || 'new';
  if (!MODES.has(mode)) fail('mode must be skip, existing, new, or existing-add-board', EXIT.CONFIG_INVALID);
  if (mode === 'skip') return { mode };
  const projectKey = bounded(args.projectKey || state.jira.projects?.[0]?.key, 'project key', 10).toUpperCase();
  if (!PROJECT_KEY.test(projectKey)) fail('project key must be 2-10 uppercase Jira key characters', EXIT.CONFIG_INVALID);
  const projectName = bounded(args.projectName || projectKey, 'project name');
  const repository = bounded(args.repository, 'repository', 255);
  if (!REPOSITORY.test(repository)) fail('repository must use owner/name form', EXIT.CONFIG_INVALID);
  const branches = list(args.branches || ['main', 'Dev'], 'branches', (item) => {
    bounded(item, 'branch', 255);
    if (!BRANCH.test(item) || item.includes('..') || item.endsWith('.lock')) fail('branch is invalid', EXIT.CONFIG_INVALID);
  });
  const environments = list(args.environments || ['development', 'staging', 'production'], 'environments', (item) => bounded(item, 'environment', 64));
  const boardType = args.boardType || 'kanban';
  if (!BOARD_TYPES.has(boardType)) fail('board type must be kanban or scrum', EXIT.CONFIG_INVALID);
  const projectType = args.projectType || 'software';
  if (!Object.hasOwn(PROJECT_TEMPLATES, projectType)) fail('project type must be software or business', EXIT.CONFIG_INVALID);
  const boardName = bounded(args.boardName || `${projectName} Delivery`, 'board name');
  const filterName = bounded(args.filterName || `${projectName} Delivery Filter`, 'filter name');
  const boardId = args.boardId == null ? null : bounded(String(args.boardId), 'board id', 32);
  const filterId = args.filterId == null ? null : bounded(String(args.filterId), 'filter id', 32);
  if (mode === 'existing' && (!filterId || (projectType !== 'business' && !boardId))) fail('existing mode requires filter-id and requires board-id for Jira Software', EXIT.CONFIG_INVALID);
  const roadmapMode = args.roadmapMode || (args.roadmapItems ? 'custom' : mode === 'existing' ? 'empty' : 'auto');
  if (!ROADMAP_MODES.has(roadmapMode)) fail('roadmap mode must be auto, custom, or empty', EXIT.CONFIG_INVALID);
  if (roadmapMode === 'custom' && !args.roadmapItems) fail('custom roadmap mode requires roadmap items', EXIT.CONFIG_INVALID);
  if (roadmapMode === 'empty' && args.roadmapItems) fail('empty roadmap mode cannot include roadmap items', EXIT.CONFIG_INVALID);
  const roadmapItems = roadmapMode === 'empty' ? [] : normalizeRoadmapItems(
    roadmapMode === 'auto' ? DEFAULT_ROADMAP_ITEMS : args.roadmapItems,
    projectKey
  );
  if (mode === 'existing' && roadmapItems.length) fail('existing mode is read-only; use existing-add-board for roadmap creation', EXIT.CONFIG_INVALID);
  return { mode, projectKey, projectName, repository, branches, environments, projectType, boardType, boardName, filterName, boardId, filterId, roadmapMode, roadmapItems };
}

export function buildDeliveryPlan(state, args = {}) {
  const input = normalizeArgs(state, args);
  if (input.mode === 'skip') return null;
  const createProject = input.mode === 'new';
  const createBoard = input.mode !== 'existing';
  return {
    schema: 'kstack-jira-delivery-plan-v1',
    mode: input.mode,
    tenant: state.jira.siteUrl,
    configSha256: configDigest(state),
    project: {
      key: input.projectKey,
      name: input.projectName,
      type: input.projectType,
      template: PROJECT_TEMPLATES[input.projectType][input.boardType]
    },
    boards: [{
      localId: 'primary-delivery',
      name: input.projectType === 'business' ? 'Board' : input.boardName,
      type: input.boardType,
      provider: input.projectType === 'business' ? 'jira-business-native' : 'jira-software-agile',
      purpose: 'delivery', filter: {
        localId: 'primary-delivery-filter', name: input.filterName,
        jql: `project = ${input.projectKey} ORDER BY Rank ASC`, id: input.filterId
      },
      id: input.boardId
    }],
    repository: { slug: input.repository, branches: input.branches, environments: input.environments },
    roadmap: { mode: input.roadmapMode, items: input.roadmapItems },
    releasePolicy: { jiraVersions: true, executionPlane: 'github-actions', jiraAutomationRequired: false },
    operations: [
      ...(createProject ? [{ id: 'create-project', kind: 'project-create' }] : [{ id: 'verify-project', kind: 'project-verify' }]),
      ...(createBoard ? [
        { id: 'create-primary-filter', kind: 'filter-create' },
        { id: input.projectType === 'business' ? 'verify-primary-board' : 'create-primary-board', kind: input.projectType === 'business' ? 'board-verify' : 'board-create' }
      ] : [
        { id: 'verify-primary-filter', kind: 'filter-verify' },
        { id: 'verify-primary-board', kind: 'board-verify' }
      ]),
      ...input.roadmapItems.map((item) => ({ id: `roadmap-${item.localId}`, kind: 'roadmap-issue-create', localId: item.localId }))
    ]
  };
}

async function previewDeliveryStackUnlocked(state, args = {}, lock) {
  const mode = args.mode || 'new';
  if (mode === 'skip') {
    return writeDeliveryRecord(state, {
      schema: DELIVERY_SCHEMA, state: 'skipped', updatedAt: nowIso(state.clock),
      plan: null, planSha256: null, approvedAt: null, operations: [], effects: []
    }, lock);
  }
  const plan = buildDeliveryPlan(state, args);
  const recordState = mode === 'existing' ? 'existing-unverified' : 'new-previewed';
  return writeDeliveryRecord(state, {
    schema: DELIVERY_SCHEMA, state: recordState, updatedAt: nowIso(state.clock),
    plan, planSha256: planDigest(plan), approvedAt: null,
    operations: plan.operations.map((operation) => ({ ...operation, state: 'pending' })), effects: []
  }, lock);
}

export async function previewDeliveryStack(state, args = {}) {
  return withDeliveryLock(state, 'preview', (lock) => previewDeliveryStackUnlocked(state, args, lock));
}

async function approveDeliveryStackUnlocked(state, suppliedHash, lock) {
  const record = await readDeliveryRecord(state);
  if (!record || record.state !== 'new-previewed') fail('only a new-previewed delivery stack can be approved');
  if (suppliedHash !== record.planSha256) fail('approval hash does not match the delivery preview', EXIT.PAYLOAD_INTEGRITY);
  if (record.plan.configSha256 !== configDigest(state)) fail('KStack configuration changed after preview', EXIT.CONFIG_DRIFT);
  record.state = 'new-approved';
  record.approvedAt = nowIso(state.clock);
  record.updatedAt = record.approvedAt;
  return writeDeliveryRecord(state, record, lock);
}

export async function approveDeliveryStack(state, suppliedHash) {
  return withDeliveryLock(state, 'approve', (lock) => approveDeliveryStackUnlocked(state, suppliedHash, lock));
}

async function jsonResponse(state, credentials, endpoint, options = {}) {
  let response;
  try { response = await jiraRequest(state, credentials, endpoint, options); } catch (error) {
    const classification = classifyFetchError(error);
    fail(`Jira bootstrap request failed: ${sanitize(error.message)}`, classification.outcome === 'ambiguous' ? EXIT.AMBIGUOUS_HISTORY : EXIT.STATE_ERROR, { classification });
  }
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch {}
  }
  return { response, body };
}

function requireSuccess(result, description, { allow404 = false } = {}) {
  if (allow404 && result.response.status === 404) return null;
  if (result.response.status >= 200 && result.response.status < 300 && result.body) return result.body;
  const status = result.response.status;
  const ambiguous = status >= 500 || status === 408 || status === 429 || (status >= 300 && status < 400);
  const reported = [
    ...(Array.isArray(result.body?.errorMessages) ? result.body.errorMessages : []),
    ...(result.body?.errors && typeof result.body.errors === 'object' && !Array.isArray(result.body.errors)
      ? Object.entries(result.body.errors).map(([field, message]) => `${field}: ${message}`)
      : []),
    ...(typeof result.body?.message === 'string' ? [result.body.message] : [])
  ];
  const detail = [...new Set(reported
    .filter((message) => typeof message === 'string' && message.trim())
    .map((message) => sanitize(message).replace(/\s+/gu, ' ').trim()))]
    .join('; ')
    .slice(0, 1024);
  fail(`${description} returned HTTP ${status}${detail ? `: ${detail}` : ''}`, ambiguous ? EXIT.AMBIGUOUS_HISTORY : EXIT.PREFLIGHT_FAILED, { httpStatus: status, ambiguous });
}

async function readProject(state, credentials, key) {
  const result = await jsonResponse(state, credentials, `/rest/api/3/project/${encodeURIComponent(key)}`);
  return requireSuccess(result, 'project read-back', { allow404: true });
}

async function requireAccessibleProjectType(state, credentials, projectType) {
  const body = requireSuccess(await jsonResponse(state, credentials, '/rest/api/3/project/type/accessible'), 'project-type preflight');
  if (!Array.isArray(body) || !body.every((entry) => entry && typeof entry.key === 'string')) fail('project-type preflight returned an unsupported shape', EXIT.PREFLIGHT_FAILED);
  if (!body.some((entry) => entry.key === projectType)) fail(`project type ${projectType} is not accessible in this Jira tenant`, EXIT.PREFLIGHT_FAILED);
}

async function verifyProjectBody(project, plan) {
  if (!project || String(project.key).toUpperCase() !== plan.project.key || project.name !== plan.project.name || (project.projectTypeKey != null && project.projectTypeKey !== plan.project.type)) fail('Jira project read-back does not match the approved preview', EXIT.AMBIGUOUS_HISTORY);
  return { id: String(project.id), key: project.key, name: project.name };
}

async function createProject(state, credentials, plan, accountId) {
  const current = await readProject(state, credentials, plan.project.key);
  if (current) return { adopted: true, resource: await verifyProjectBody(current, plan) };
  await requireAccessibleProjectType(state, credentials, plan.project.type);
  const payload = {
    key: plan.project.key, name: plan.project.name, projectTypeKey: plan.project.type,
    projectTemplateKey: plan.project.template, leadAccountId: accountId, assigneeType: 'PROJECT_LEAD'
  };
  const created = requireSuccess(await jsonResponse(state, credentials, '/rest/api/3/project', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: Buffer.from(JSON.stringify(payload), 'utf8')
  }), 'project creation');
  if (!created.id || !created.key) fail('project creation returned an incomplete success', EXIT.AMBIGUOUS_HISTORY);
  return { adopted: false, resource: await verifyProjectBody(await readProject(state, credentials, plan.project.key), plan) };
}

async function createFilter(state, credentials, board) {
  const payload = { name: board.filter.name, jql: board.filter.jql, favourite: true };
  const created = requireSuccess(await jsonResponse(state, credentials, '/rest/api/3/filter', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: Buffer.from(JSON.stringify(payload), 'utf8')
  }), 'filter creation');
  if (!created.id) fail('filter creation returned an incomplete success', EXIT.AMBIGUOUS_HISTORY);
  const readBack = requireSuccess(await jsonResponse(state, credentials, `/rest/api/3/filter/${encodeURIComponent(String(created.id))}`), 'filter read-back');
  if (readBack.name !== board.filter.name || readBack.jql !== board.filter.jql) fail('Jira filter read-back does not match the approved preview', EXIT.AMBIGUOUS_HISTORY);
  return { id: String(readBack.id), name: readBack.name, jql: readBack.jql };
}

async function findFilters(state, credentials, board) {
  const endpoint = `/rest/api/3/filter/search?filterName=${encodeURIComponent(board.filter.name)}&expand=jql`;
  const body = requireSuccess(await jsonResponse(state, credentials, endpoint), 'filter discovery');
  if (!Array.isArray(body.values)) fail('filter discovery returned an unsupported shape', EXIT.AMBIGUOUS_HISTORY);
  const named = body.values.filter((item) => item?.name === board.filter.name && item.id != null);
  const resolved = [];
  for (const item of named) {
    const value = typeof item.jql === 'string'
      ? item
      : requireSuccess(await jsonResponse(state, credentials, `/rest/api/3/filter/${encodeURIComponent(String(item.id))}`), 'filter read-back');
    resolved.push({ id: String(value.id), name: value.name, jql: value.jql });
  }
  return {
    exact: resolved.filter((item) => item.jql === board.filter.jql),
    conflicting: resolved.filter((item) => item.jql !== board.filter.jql)
  };
}

async function ensureFilter(state, credentials, board) {
  const found = await findFilters(state, credentials, board);
  if (found.exact.length > 1 || found.conflicting.length > 0) fail('Jira filter identity is ambiguous', EXIT.AMBIGUOUS_HISTORY);
  if (found.exact.length === 1) return { adopted: true, resource: found.exact[0] };
  return { adopted: false, resource: await createFilter(state, credentials, board) };
}

async function createBoard(state, credentials, board, filterId) {
  const payload = { name: board.name, type: board.type, filterId: Number(filterId) };
  const created = requireSuccess(await jsonResponse(state, credentials, '/rest/agile/1.0/board', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: Buffer.from(JSON.stringify(payload), 'utf8')
  }), 'board creation');
  if (!created.id) fail('board creation returned an incomplete success', EXIT.AMBIGUOUS_HISTORY);
  const readBack = requireSuccess(await jsonResponse(state, credentials, `/rest/agile/1.0/board/${encodeURIComponent(String(created.id))}`), 'board read-back');
  const configuration = requireSuccess(await jsonResponse(state, credentials, `/rest/agile/1.0/board/${encodeURIComponent(String(created.id))}/configuration`), 'board configuration read-back');
  if (readBack.name !== board.name || readBack.type !== board.type || String(configuration.filter?.id) !== String(filterId)) fail('Jira board read-back does not match the approved preview', EXIT.AMBIGUOUS_HISTORY);
  return { id: String(readBack.id), name: readBack.name, type: readBack.type, filterId: String(filterId) };
}

async function findBoards(state, credentials, board, projectKey, filterId = null) {
  const endpoint = `/rest/agile/1.0/board?name=${encodeURIComponent(board.name)}&projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=50`;
  const body = requireSuccess(await jsonResponse(state, credentials, endpoint), 'board discovery');
  if (!Array.isArray(body.values)) fail('board discovery returned an unsupported shape', EXIT.AMBIGUOUS_HISTORY);
  const named = body.values.filter((item) => item?.name === board.name && item.id != null);
  const resolved = [];
  for (const item of named) {
    const configuration = requireSuccess(await jsonResponse(state, credentials, `/rest/agile/1.0/board/${encodeURIComponent(String(item.id))}/configuration`), 'board configuration read-back');
    resolved.push({ id: String(item.id), name: item.name, type: item.type, filterId: configuration.filter?.id == null ? null : String(configuration.filter.id) });
  }
  return {
    exact: filterId == null ? [] : resolved.filter((item) => item.type === board.type && item.filterId === String(filterId)),
    conflicting: filterId == null ? resolved : resolved.filter((item) => item.type !== board.type || item.filterId !== String(filterId))
  };
}

async function ensureBoard(state, credentials, board, projectKey, filterId) {
  const found = await findBoards(state, credentials, board, projectKey, filterId);
  if (found.exact.length > 1 || found.conflicting.length > 0) fail('Jira board identity is ambiguous', EXIT.AMBIGUOUS_HISTORY);
  if (found.exact.length === 1) return { adopted: true, resource: found.exact[0] };
  return { adopted: false, resource: await createBoard(state, credentials, board, filterId) };
}

async function verifyFilter(state, credentials, board) {
  const readBack = requireSuccess(await jsonResponse(state, credentials, `/rest/api/3/filter/${encodeURIComponent(String(board.filter.id))}`), 'filter read-back');
  if (String(readBack.id) !== String(board.filter.id) || readBack.name !== board.filter.name || readBack.jql !== board.filter.jql) fail('Jira filter read-back does not match the delivery preview', EXIT.AMBIGUOUS_HISTORY);
  return { id: String(readBack.id), name: readBack.name, jql: readBack.jql };
}

async function verifyBoard(state, credentials, board) {
  const readBack = requireSuccess(await jsonResponse(state, credentials, `/rest/agile/1.0/board/${encodeURIComponent(String(board.id))}`), 'board read-back');
  const configuration = requireSuccess(await jsonResponse(state, credentials, `/rest/agile/1.0/board/${encodeURIComponent(String(board.id))}/configuration`), 'board configuration read-back');
  if (String(readBack.id) !== String(board.id) || readBack.name !== board.name || readBack.type !== board.type || String(configuration.filter?.id) !== String(board.filter.id)) fail('Jira board read-back does not match the delivery preview', EXIT.AMBIGUOUS_HISTORY);
  return { id: String(readBack.id), name: readBack.name, type: readBack.type, filterId: String(board.filter.id) };
}

async function verifyBusinessBoard(state, credentials, projectKey, board) {
  const issueTypes = requireSuccess(await jsonResponse(state, credentials, `/rest/api/3/project/${encodeURIComponent(projectKey)}/statuses`), 'business-board workflow read-back');
  if (!Array.isArray(issueTypes)) fail('business-board workflow read-back returned an unsupported shape', EXIT.AMBIGUOUS_HISTORY);
  const categories = new Set(issueTypes.flatMap((issueType) => Array.isArray(issueType?.statuses)
    ? issueType.statuses.map((status) => status?.statusCategory?.key).filter((key) => typeof key === 'string')
    : []));
  if (!['new', 'indeterminate', 'done'].every((key) => categories.has(key))) fail('business-board workflow does not expose To Do, In Progress, and Done status categories', EXIT.AMBIGUOUS_HISTORY);
  return {
    id: `project:${projectKey}:board`, name: board.name, type: board.type,
    provider: 'jira-business-native', projectKey, statusCategories: ['new', 'indeterminate', 'done']
  };
}

function roadmapAdf(text) {
  return {
    version: 1,
    type: 'doc',
    content: text.split(/\n{2,}/u).map((paragraph) => ({
      type: 'paragraph',
      content: paragraph ? [{ type: 'text', text: paragraph }] : []
    }))
  };
}

function adfText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
  if (!Array.isArray(node.content)) return '';
  const values = node.content.map(adfText);
  return node.type === 'doc' ? values.join('\n\n') : values.join('');
}

async function preflightRoadmapIssueTypes(state, credentials, plan) {
  if (!plan.roadmap.items.length) return;
  const body = requireSuccess(await jsonResponse(
    state,
    credentials,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(plan.project.key)}/issuetypes`
  ), 'roadmap issue-type preflight');
  const values = Array.isArray(body.issueTypes) ? body.issueTypes : Array.isArray(body.values) ? body.values : null;
  if (!values || !values.every((item) => item && typeof item.name === 'string')) fail('roadmap issue-type preflight returned an unsupported shape', EXIT.PREFLIGHT_FAILED);
  const available = new Set(values.map((item) => item.name));
  const missing = [...new Set(plan.roadmap.items.map((item) => item.issueType).filter((name) => !available.has(name)))];
  if (missing.length) fail(`roadmap issue type is unavailable: ${missing.join(', ')}`, EXIT.PREFLIGHT_FAILED);
}

async function searchRoadmapIssues(state, credentials, plan) {
  const items = plan.roadmap.items;
  if (!items.length) return new Map();
  const markers = items.map((item) => `"${item.marker.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`).join(', ');
  const body = requireSuccess(await jsonResponse(state, credentials, '/rest/api/3/search/jql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: Buffer.from(JSON.stringify({
      jql: `project = "${plan.project.key}" AND labels in (${markers})`,
      fields: ['key', 'summary', 'issuetype', 'description', 'labels'],
      maxResults: 100
    }), 'utf8')
  }), 'roadmap discovery');
  if (!Array.isArray(body.issues) || body.nextPageToken || body.isLast === false) fail('roadmap discovery returned an unsupported or incomplete page', EXIT.AMBIGUOUS_HISTORY);
  const matches = new Map(items.map((item) => [item.localId, []]));
  for (const issue of body.issues) {
    const labels = Array.isArray(issue?.fields?.labels) ? issue.fields.labels : [];
    for (const item of items) if (labels.includes(item.marker)) matches.get(item.localId).push(issue);
  }
  return matches;
}

function verifyRoadmapIssue(issue, item, projectKey) {
  const labels = Array.isArray(issue?.fields?.labels) ? issue.fields.labels : [];
  const expectedContentMarker = `kstack-content-${item.contentSha256.slice(0, 24)}`;
  if (!issue?.key || !String(issue.key).startsWith(`${projectKey}-`) || issue.fields?.summary !== item.summary || issue.fields?.issuetype?.name !== item.issueType || !labels.includes(item.marker) || !labels.includes(expectedContentMarker) || adfText(issue.fields?.description) !== item.description) {
    fail(`roadmap item ${item.localId} does not match the approved preview`, EXIT.AMBIGUOUS_HISTORY);
  }
  return { key: String(issue.key), localId: item.localId, issueType: item.issueType, summary: item.summary, marker: item.marker, contentSha256: item.contentSha256 };
}

async function readRoadmapIssue(state, credentials, key) {
  return requireSuccess(await jsonResponse(state, credentials, `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,issuetype,description,labels`), 'roadmap issue read-back');
}

async function ensureRoadmapIssue(state, credentials, plan, item, discovered) {
  const matches = discovered.get(item.localId) || [];
  if (matches.length > 1) fail(`roadmap item ${item.localId} has multiple marker matches`, EXIT.AMBIGUOUS_HISTORY);
  if (matches.length === 1) {
    const full = matches[0].fields?.description === undefined
      ? await readRoadmapIssue(state, credentials, matches[0].key)
      : matches[0];
    return { adopted: true, resource: verifyRoadmapIssue(full, item, plan.project.key) };
  }
  const payload = {
    fields: {
      project: { key: plan.project.key },
      issuetype: { name: item.issueType },
      summary: item.summary,
      description: roadmapAdf(item.description),
      labels: item.labels
    }
  };
  const created = requireSuccess(await jsonResponse(state, credentials, '/rest/api/3/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: Buffer.from(JSON.stringify(payload), 'utf8')
  }), `roadmap item ${item.localId} creation`);
  if (!created.key || !created.id) fail(`roadmap item ${item.localId} creation returned an incomplete success`, EXIT.AMBIGUOUS_HISTORY);
  return { adopted: false, resource: verifyRoadmapIssue(await readRoadmapIssue(state, credentials, String(created.key)), item, plan.project.key) };
}

function effect(operation, resource, clock, adopted = false) {
  return { operation, outcome: adopted ? 'adopted' : 'created', resource, at: nowIso(clock) };
}

async function applyDeliveryStackUnlocked(state, lock) {
  const record = await readDeliveryRecord(state);
  if (!record || record.state !== 'new-approved') fail('apply requires a new-approved delivery stack');
  if (record.plan.configSha256 !== configDigest(state)) fail('KStack configuration changed after approval', EXIT.CONFIG_DRIFT);
  const approvedAt = Date.parse(record.approvedAt);
  if (!Number.isFinite(approvedAt) || new state.clock().getTime() - approvedAt > state.jira.approvalTtlMs) fail('delivery-stack approval expired', EXIT.APPROVAL_EXPIRED);
  const credentials = await resolveCredentials(state);
  record.state = 'applying';
  record.updatedAt = nowIso(state.clock);
  await writeDeliveryRecord(state, record, lock);
  try {
    const myself = requireSuccess(await jsonResponse(state, credentials, '/rest/api/3/myself'), 'Jira identity read-back');
    if (!myself.accountId) fail('Jira identity read-back omitted accountId', EXIT.PREFLIGHT_FAILED);
    const projectResult = record.plan.mode === 'new'
      ? await createProject(state, credentials, record.plan, myself.accountId)
      : { adopted: true, resource: await verifyProjectBody(await readProject(state, credentials, record.plan.project.key), record.plan) };
    record.effects.push(effect('project', projectResult.resource, state.clock, projectResult.adopted));
    record.operations[0].state = 'complete';
    record.updatedAt = nowIso(state.clock);
    await writeDeliveryRecord(state, record, lock);

    const boardPlan = record.plan.boards[0];
    const filterResult = await ensureFilter(state, credentials, boardPlan);
    record.effects.push(effect('primary-filter', filterResult.resource, state.clock, filterResult.adopted));
    record.operations[1].state = 'complete';
    record.updatedAt = nowIso(state.clock);
    await writeDeliveryRecord(state, record, lock);

    const boardResult = record.plan.project.type === 'business'
      ? { adopted: true, resource: await verifyBusinessBoard(state, credentials, record.plan.project.key, boardPlan) }
      : await ensureBoard(state, credentials, boardPlan, record.plan.project.key, filterResult.resource.id);
    record.effects.push(effect('primary-board', boardResult.resource, state.clock, boardResult.adopted));
    record.operations[2].state = 'complete';
    record.updatedAt = nowIso(state.clock);
    await writeDeliveryRecord(state, record, lock);

    await preflightRoadmapIssueTypes(state, credentials, record.plan);
    const roadmapIssues = await searchRoadmapIssues(state, credentials, record.plan);
    for (let index = 0; index < record.plan.roadmap.items.length; index += 1) {
      const item = record.plan.roadmap.items[index];
      const result = await ensureRoadmapIssue(state, credentials, record.plan, item, roadmapIssues);
      record.effects.push(effect(`roadmap-${item.localId}`, result.resource, state.clock, result.adopted));
      record.operations[index + 3].state = 'complete';
      record.updatedAt = nowIso(state.clock);
      await writeDeliveryRecord(state, record, lock);
    }
    record.state = 'verified';
    record.updatedAt = nowIso(state.clock);
    return writeDeliveryRecord(state, record, lock);
  } catch (error) {
    record.state = error.exitCode === EXIT.AMBIGUOUS_HISTORY ? 'ambiguous' : 'failed';
    record.updatedAt = nowIso(state.clock);
    record.lastFailure = { code: error.exitCode || EXIT.STATE_ERROR, message: sanitize(error.message) };
    await writeDeliveryRecord(state, record, lock);
    throw error;
  }
}

export async function applyDeliveryStack(state) {
  return withDeliveryLock(state, 'apply', (lock) => applyDeliveryStackUnlocked(state, lock));
}

async function validateExistingDeliveryStackUnlocked(state, lock) {
  const record = await readDeliveryRecord(state);
  if (!record || record.state !== 'existing-unverified' || record.plan.mode !== 'existing') fail('validate requires an existing-unverified delivery stack');
  if (record.plan.configSha256 !== configDigest(state)) fail('KStack configuration changed after preview', EXIT.CONFIG_DRIFT);
  const credentials = await resolveCredentials(state);
  try {
    const myself = requireSuccess(await jsonResponse(state, credentials, '/rest/api/3/myself'), 'Jira identity read-back');
    if (!myself.accountId) fail('Jira identity read-back omitted accountId', EXIT.PREFLIGHT_FAILED);
    const project = await verifyProjectBody(await readProject(state, credentials, record.plan.project.key), record.plan);
    const boardPlan = record.plan.boards[0];
    const filter = await verifyFilter(state, credentials, boardPlan);
    const board = record.plan.project.type === 'business'
      ? await verifyBusinessBoard(state, credentials, record.plan.project.key, boardPlan)
      : await verifyBoard(state, credentials, boardPlan);
    record.effects = [
      effect('project', project, state.clock, true),
      effect('primary-filter', filter, state.clock, true),
      effect('primary-board', board, state.clock, true)
    ];
    record.operations.forEach((operation) => { operation.state = 'complete'; });
    record.state = 'existing-validated';
    record.updatedAt = nowIso(state.clock);
    return writeDeliveryRecord(state, record, lock);
  } catch (error) {
    record.state = 'existing-unverified';
    record.updatedAt = nowIso(state.clock);
    record.lastFailure = { code: error.exitCode || EXIT.STATE_ERROR, message: sanitize(error.message) };
    await writeDeliveryRecord(state, record, lock);
    throw error;
  }
}

export async function validateExistingDeliveryStack(state) {
  return withDeliveryLock(state, 'validate', (lock) => validateExistingDeliveryStackUnlocked(state, lock));
}

async function reconcileDeliveryStackUnlocked(state, lock) {
  const record = await readDeliveryRecord(state);
  if (!record || !['applying', 'ambiguous', 'failed'].includes(record.state) || !['new', 'existing-add-board'].includes(record.plan.mode)) fail('reconcile requires an interrupted new-stack or existing-project/new-board operation');
  if (record.plan.configSha256 !== configDigest(state)) fail('KStack configuration changed after preview', EXIT.CONFIG_DRIFT);
  const credentials = await resolveCredentials(state);
  const projectBody = await readProject(state, credentials, record.plan.project.key);
  if (!projectBody) {
    if (record.plan.mode !== 'new') fail('the existing Jira project is absent during reconciliation', EXIT.AMBIGUOUS_HISTORY);
    record.state = 'new-previewed';
    record.approvedAt = null;
    record.operations.forEach((operation) => { operation.state = 'pending'; });
    record.effects = [];
    record.updatedAt = nowIso(state.clock);
    delete record.lastFailure;
    return writeDeliveryRecord(state, record, lock);
  }
  const project = await verifyProjectBody(projectBody, record.plan);
  const boardPlan = record.plan.boards[0];
  const filters = await findFilters(state, credentials, boardPlan);
  if (filters.exact.length > 1 || filters.conflicting.length > 0) fail('Jira filter identity remains ambiguous', EXIT.AMBIGUOUS_HISTORY);
  const filter = filters.exact[0] || null;
  let board = null;
  if (filter && record.plan.project.type === 'business') {
    board = await verifyBusinessBoard(state, credentials, record.plan.project.key, boardPlan);
  } else if (record.plan.project.type !== 'business') {
    const boards = await findBoards(state, credentials, boardPlan, record.plan.project.key, filter?.id || null);
    if (boards.exact.length > 1 || boards.conflicting.length > 0) fail('Jira board identity remains ambiguous', EXIT.AMBIGUOUS_HISTORY);
    board = boards.exact[0] || null;
  }
  record.effects = [effect('project', project, state.clock, true)];
  record.operations[0].state = 'complete';
  if (filter) {
    record.effects.push(effect('primary-filter', filter, state.clock, true));
    record.operations[1].state = 'complete';
  } else record.operations[1].state = 'pending';
  if (board) {
    record.effects.push(effect('primary-board', board, state.clock, true));
    record.operations[2].state = 'complete';
  } else record.operations[2].state = 'pending';
  let roadmapComplete = true;
  if (project && filter && board && record.plan.roadmap.items.length) {
    const discovered = await searchRoadmapIssues(state, credentials, record.plan);
    for (let index = 0; index < record.plan.roadmap.items.length; index += 1) {
      const item = record.plan.roadmap.items[index];
      const matches = discovered.get(item.localId) || [];
      if (matches.length > 1) fail(`roadmap item ${item.localId} has multiple marker matches`, EXIT.AMBIGUOUS_HISTORY);
      if (matches.length === 0) {
        record.operations[index + 3].state = 'pending';
        roadmapComplete = false;
        continue;
      }
      const full = matches[0].fields?.description === undefined
        ? await readRoadmapIssue(state, credentials, matches[0].key)
        : matches[0];
      const resource = verifyRoadmapIssue(full, item, record.plan.project.key);
      record.effects.push(effect(`roadmap-${item.localId}`, resource, state.clock, true));
      record.operations[index + 3].state = 'complete';
    }
  } else if (record.plan.roadmap.items.length) {
    roadmapComplete = false;
    for (let index = 0; index < record.plan.roadmap.items.length; index += 1) record.operations[index + 3].state = 'pending';
  }
  record.state = project && filter && board && roadmapComplete ? 'verified' : 'new-previewed';
  record.approvedAt = null;
  record.updatedAt = nowIso(state.clock);
  delete record.lastFailure;
  return writeDeliveryRecord(state, record, lock);
}

export async function reconcileDeliveryStack(state) {
  return withDeliveryLock(state, 'reconcile', (lock) => reconcileDeliveryStackUnlocked(state, lock));
}

export async function runBootstrapCommand(state, command, args = {}) {
  switch (command) {
    case 'preview': return previewDeliveryStack(state, args);
    case 'show': return readDeliveryRecord(state);
    case 'validate': return validateExistingDeliveryStack(state);
    case 'approve': return approveDeliveryStack(state, args.planHash);
    case 'apply': return applyDeliveryStack(state);
    case 'reconcile': return reconcileDeliveryStack(state);
    default: fail(`unknown Jira bootstrap command: ${command}`);
  }
}

const HELP = `KStack Jira delivery-stack bootstrap (Jira Cloud)\n\nCommands:\n  preview --mode skip|existing|new|existing-add-board [--project-key KEY] [--project-name NAME] [--project-type software|business] [--repository OWNER/NAME] [--board-name NAME] [--board-type kanban|scrum] [--filter-name NAME] [--board-id ID --filter-id ID] [--branches main,Dev] [--environments development,staging,production] [--roadmap-file PATH | --roadmap-mode auto|empty]\n  show\n  validate                                    (read-only existing-stack validation)\n  approve --plan-hash SHA256                  (interactive TTY required)\n  apply                                       (interactive TTY approval read-back required)\n  reconcile                                   (read-only ambiguous/interrupted outcome reconciliation)\n\nNew and existing-add-board previews include a five-item KStack lifecycle roadmap by default. --roadmap-file replaces it with a kstack-jira-roadmap-v1 manifest; --roadmap-mode empty is an explicit opt-out. Preview and show are offline. Validate and reconcile perform Jira reads only. Apply never retries an ambiguous Jira mutation. Project/filter/board/issue deletion is never automatic.`;

function readRoadmapFile(file) {
  const resolved = path.resolve(file);
  let stat;
  let link;
  try {
    link = fs.lstatSync(resolved);
    stat = fs.statSync(resolved);
  } catch (error) {
    fail(`roadmap file could not be inspected: ${sanitize(error.message)}`, EXIT.CONFIG_INVALID);
  }
  if (link.isSymbolicLink() || !stat.isFile() || stat.size > 64 * 1024) fail('roadmap file must be a non-symlink regular file no larger than 64 KiB', EXIT.CONFIG_INVALID);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (error) {
    fail(`roadmap file is invalid JSON: ${sanitize(error.message)}`, EXIT.CONFIG_INVALID);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || Object.keys(manifest).sort().join(',') !== 'items,schema' || manifest.schema !== 'kstack-jira-roadmap-v1') fail('roadmap file must use the closed kstack-jira-roadmap-v1 schema', EXIT.CONFIG_INVALID);
  return manifest.items;
}

function parseCli(argv) {
  const [command = 'help', ...rest] = argv;
  const args = {};
  for (let index = 0; index < rest.length;) {
    const item = rest[index++];
    if (!item.startsWith('--')) fail(`unexpected argument: ${item}`);
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = rest[index++];
    if (value === undefined || value.startsWith('--')) fail(`${item} requires a value`);
    args[key] = value;
  }
  return { command, args };
}

async function cli(argv) {
  const parsed = parseCli(argv);
  if (parsed.command === 'help') {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (parsed.args.roadmapFile) {
    if (parsed.args.roadmapMode && parsed.args.roadmapMode !== 'custom') fail('--roadmap-file cannot be combined with auto or empty roadmap mode', EXIT.CONFIG_INVALID);
    parsed.args.roadmapItems = readRoadmapFile(parsed.args.roadmapFile);
    parsed.args.roadmapMode = 'custom';
    delete parsed.args.roadmapFile;
  }
  const state = await loadJiraState({ command: parsed.command });
  if (['approve', 'apply'].includes(parsed.command)) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) fail(`${parsed.command} requires an interactive TTY`);
    const record = await readDeliveryRecord(state);
    const expected = record?.planSha256;
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const confirmation = await prompt.question(`Type the delivery preview hash ${expected}: `);
      if (confirmation.trim() !== expected) fail('TTY confirmation did not match the delivery preview hash', EXIT.PAYLOAD_INTEGRITY);
    } finally { prompt.close(); }
    if (parsed.command === 'approve') parsed.args.planHash = expected;
  }
  const result = await runBootstrapCommand(state, parsed.command, parsed.args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${sanitize(error.message || String(error))}\n`);
    process.exitCode = error instanceof JiraQueueError ? error.exitCode : EXIT.STATE_ERROR;
  });
}
