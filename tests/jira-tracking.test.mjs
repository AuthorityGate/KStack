import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  appendTrackingEvent, JiraTrackingError, listTrackingEvents, queueTrackingDrafts,
  syncTrackingEvents, TRACKING_LIMITS, validateTrackingCapacity, validateTrackingEvent
} from '../plugins/kstack/scripts/kstack-jira-tracking.mjs';
import { DELIVERY_LOCK_STALE_MS } from '../plugins/kstack/scripts/kstack-jira-bootstrap.mjs';
import { buildCanonicalPayload } from '../plugins/kstack/scripts/kstack-jira.mjs';
import { canonicalJson } from '../plugins/kstack/scripts/kstack-safety-broker.mjs';
import { assertOutboundSecretScan } from '../plugins/kstack/scripts/kstack-safety-matchers.mjs';

const execFileAsync = promisify(execFile);
const FIXED_NOW = '2026-08-29T00:00:00.000Z';

class FixedClock extends Date {
  constructor(value = FIXED_NOW) { super(value); }
  static now() { return Date.parse(FIXED_NOW); }
}

function fixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-tracking-'));
  const jira = {
    enabled: true,
    siteUrl: 'https://example.atlassian.net',
    tracking: {
      mode: 'approval-queued', required: true, repositoryNamespace: 'AuthorityGate/KStack',
      projectKey: 'KSTK', automaticVersionAssignment: false, releaseVersions: []
    },
    projects: [{ key: 'KSTK', issueTypes: ['Task'], defaultFields: {} }],
    staticLabels: [], approvalTtlMs: 86400000, timeoutMs: 1000, maxAttempts: 3,
    dryRun: false, nodeMinVersion: '20.0.0',
    credentialSource: { type: 'env', emailEnvVar: 'TRACKING_EMAIL', tokenEnvVar: 'TRACKING_TOKEN' }
  };
  const state = {
    repoRoot,
    trackingRoot: path.join(repoRoot, '.tracking-state'),
    queueDir: path.join(repoRoot, '.jira-queue'),
    jira,
    config: { jira, authority: { externalTicketCreation: 'ask' } },
    clock: FixedClock
  };
  return { state, repoRoot };
}

function input(changes = {}) {
  return {
    repositoryNamespace: 'AuthorityGate/KStack',
    projectKey: 'KSTK',
    threadId: 'jira-continuous-tracking-2026-08-28',
    itemId: 'JT-TC02',
    sourceEventId: 'objective-created',
    kind: 'ITEM_CREATED',
    localState: 'planned',
    occurredAt: '2026-08-28T12:00:00.000Z',
    summary: 'Create the durable Jira tracking outbox',
    evidence: [{ repoRelativePath: '.kstack/objectives/jira-continuous-tracking-2026-08-28.md', sha256: 'a'.repeat(64), evidenceKind: 'objective' }],
    review: null,
    release: null,
    ...changes
  };
}

async function bindSubmittedDraft(state, issueKey = 'KSTK-1') {
  const [queued] = await queueTrackingDrafts(state, state);
  const draftFile = path.join(state.queueDir, `${queued.draftId}.json`);
  const draft = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
  draft.state = 'submitted';
  draft.result = { id: '10001', key: issueKey, url: `https://example.atlassian.net/browse/${issueKey}` };
  fs.writeFileSync(draftFile, `${JSON.stringify(draft)}\n`);
  state.jira.tracking.mode = 'automatic';
  state.config.authority.externalTicketCreation = 'allow';
  return queued;
}

function exactIssueForDraft(state, queued, issueKey = 'KSTK-1', issueId = '10001') {
  const draft = JSON.parse(fs.readFileSync(path.join(state.queueDir, `${queued.draftId}.json`), 'utf8'));
  return { id: issueId, key: issueKey, fields: JSON.parse(buildCanonicalPayload(state, draft)).fields };
}

function existingIssueResponse(url, issue) {
  const parsed = new URL(String(url));
  if (parsed.pathname.endsWith('/mypermissions')) return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
  if (parsed.pathname.endsWith('/search/jql')) return Response.json({ issues: [{ id: issue.id, key: issue.key }], isLast: true });
  if (parsed.pathname.endsWith(`/issue/${issue.key}`) && (parsed.searchParams.get('fields') || '').includes('summary')) return Response.json(issue);
  return null;
}

function installCreationApi(state, options = {}) {
  const telemetry = { createPosts: 0, searches: 0, calls: [], comments: [], visibleIssue: null };
  const issueKey = options.issueKey || 'KSTK-101';
  const issueId = options.issueId || '10101';
  function materializePreexisting() {
    if (!options.preexistingDraftId || telemetry.visibleIssue) return;
    const draft = JSON.parse(fs.readFileSync(path.join(state.queueDir, `${options.preexistingDraftId}.json`), 'utf8'));
    const fields = JSON.parse(buildCanonicalPayload(state, draft)).fields;
    if (options.reorderDescriptionKeys) fields.description = { type: fields.description.type, version: fields.description.version, content: fields.description.content };
    if (options.mismatchSummary) fields.summary = options.mismatchSummary;
    telemetry.visibleIssue = { id: issueId, key: issueKey, fields };
  }
  state.fetchImpl = async (url, request = {}) => {
    const parsed = new URL(String(url));
    const method = request.method || 'GET';
    telemetry.calls.push(`${method} ${parsed.pathname}`);
    if (parsed.pathname.endsWith('/createmeta/KSTK/issuetypes')) return Response.json({ issueTypes: [{ id: '1', name: 'Task' }], isLast: true });
    if (parsed.pathname.endsWith('/createmeta/KSTK/issuetypes/1')) return Response.json({ fields: [{ fieldId: 'labels', required: false }], isLast: true });
    if (parsed.pathname.endsWith('/mypermissions')) return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
    if (parsed.pathname.endsWith('/search/jql')) {
      telemetry.searches += 1;
      materializePreexisting();
      const issues = telemetry.visibleIssue ? [{ id: telemetry.visibleIssue.id, key: telemetry.visibleIssue.key }] : [];
      if (options.multipleMatches && telemetry.visibleIssue) issues.push({ id: '10102', key: 'KSTK-102' });
      return Response.json({ issues, isLast: true });
    }
    if (method === 'POST' && parsed.pathname.endsWith('/rest/api/3/issue')) {
      telemetry.createPosts += 1;
      const fields = JSON.parse(Buffer.from(request.body).toString('utf8')).fields;
      if (options.reorderDescriptionKeys) fields.description = { type: fields.description.type, version: fields.description.version, content: fields.description.content };
      if (options.createEffect !== false) telemetry.visibleIssue = { id: issueId, key: issueKey, fields };
      if (options.createStatus === 429) return Response.json({}, { status: 429, headers: { 'Retry-After': '0' } });
      return Response.json({ id: issueId, key: issueKey }, { status: 201 });
    }
    if (parsed.pathname.endsWith(`/issue/${issueKey}`) && (parsed.searchParams.get('fields') || '').includes('summary')) return Response.json(telemetry.visibleIssue);
    if (parsed.pathname.endsWith(`/issue/${issueKey}/comment`) && method === 'GET') return Response.json({ total: telemetry.comments.length, comments: telemetry.comments });
    if (parsed.pathname.endsWith(`/issue/${issueKey}/comment`) && method === 'POST') {
      const comment = { id: String(201 + telemetry.comments.length), body: JSON.parse(Buffer.from(request.body).toString('utf8')).body };
      telemetry.comments.push(comment);
      return Response.json({ id: comment.id }, { status: 201 });
    }
    if (parsed.pathname.endsWith(`/issue/${issueKey}`) && parsed.searchParams.get('fields') === 'status') return Response.json({ fields: { status: { statusCategory: { key: 'new' } } } });
    throw new Error(`unexpected request: ${method} ${url}`);
  };
  return telemetry;
}

function markerBody(eventId) {
  return { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `[kstack-event:${eventId}]` }] }] };
}

test('append creates a contiguous durable chain and exact retry is idempotent', async () => {
  const { state } = fixture();
  const first = await appendTrackingEvent(state, input());
  assert.equal(first.created, true);
  assert.equal(first.event.eventOrdinal, 1);
  assert.equal(first.event.priorEventDigest, '0'.repeat(64));
  validateTrackingEvent(first.event);

  const retry = await appendTrackingEvent(state, input());
  assert.equal(retry.created, false);
  assert.equal(retry.event.eventDigest, first.event.eventDigest);

  const second = await appendTrackingEvent(state, input({
    sourceEventId: 'implementation-started',
    kind: 'ITEM_ACTIVE',
    localState: 'active',
    occurredAt: '2026-08-28T12:01:00.000Z',
    summary: 'Begin the bounded outbox implementation'
  }));
  assert.equal(second.event.eventOrdinal, 2);
  assert.equal(second.event.priorEventDigest, first.event.eventDigest);
  assert.deepEqual((await listTrackingEvents(state)).map((event) => event.eventOrdinal), [1, 2]);
});

test('source event ID reuse with changed content fails closed', async () => {
  const { state } = fixture();
  await appendTrackingEvent(state, input());
  await assert.rejects(
    appendTrackingEvent(state, input({ summary: 'Altered content' })),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_SOURCE_CONFLICT'
  );
});

test('concurrent different events serialize into one complete chain', async () => {
  const { state } = fixture();
  const events = await Promise.all(Array.from({ length: 12 }, (_, index) => appendTrackingEvent(state, input({
    sourceEventId: `event-${index}`,
    occurredAt: `2026-08-28T12:${String(index).padStart(2, '0')}:00.000Z`,
    summary: `Tracking event ${index}`
  }))));
  assert.equal(events.every((entry) => entry.created), true);
  const stored = await listTrackingEvents(state);
  assert.equal(stored.length, 12);
  assert.deepEqual(stored.map((event) => event.eventOrdinal).sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index + 1));
});

test('tampered chain content is rejected before a later append', async () => {
  const { state, repoRoot } = fixture();
  await appendTrackingEvent(state, input());
  const root = path.join(repoRoot, '.tracking-state');
  const file = fs.readdirSync(root).find((name) => name.endsWith('.json'));
  const event = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  event.summary = 'Tampered';
  fs.writeFileSync(path.join(root, file), JSON.stringify(event));
  await assert.rejects(
    appendTrackingEvent(state, input({ sourceEventId: 'next', occurredAt: '2026-08-28T12:02:00.000Z' })),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_EVENT_INVALID'
  );
});

test('absolute or traversing evidence paths and secret-like content are rejected', async () => {
  const { state } = fixture();
  for (const repoRelativePath of ['/tmp/evidence.md', '../evidence.md', 'safe/../../evidence.md', '\\etc\\passwd', '\\\\server\\share\\secret.txt', 'C:\\secret.txt', 'safe//evidence.md', './evidence.md']) {
    await assert.rejects(appendTrackingEvent(state, input({ evidence: [{ repoRelativePath, sha256: 'a'.repeat(64), evidenceKind: 'objective' }] })));
  }
  for (const summary of [
    'api_key=abcdefghijklmnopqrstuvwxyz123456',
    'authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
    'password=CorrectHorseBatteryStaple-123!',
    'AKIAIOSFODNN7EXAMPLE'
  ]) await assert.rejects(appendTrackingEvent(state, input({ summary })), /OUTBOUND_SECRET_SCAN_REJECTED/u);
  assert.equal((await listTrackingEvents(state)).length, 0);
});

test('calendar, future-time, review, state, and canonical-form constraints are closed', async () => {
  const { state } = fixture();
  await assert.rejects(appendTrackingEvent(state, input({ occurredAt: '2026-08-30T00:00:00.000Z' })), /future/u);
  await assert.rejects(appendTrackingEvent(state, input({
    sourceEventId: 'bad-release-date', kind: 'ITEM_RELEASED', localState: 'done',
    release: { name: 'v1.0.0', releaseDate: '2026-02-30', receiptSha256: 'b'.repeat(64) }
  })), /releaseDate/u);
  await assert.rejects(appendTrackingEvent(state, input({ kind: 'ITEM_CREATED', localState: 'active' })), /incompatible/u);
  const planned = await appendTrackingEvent(state, input({
    sourceEventId: 'returned-to-backlog', kind: 'ITEM_PLANNED', localState: 'planned',
    occurredAt: '2026-08-28T12:00:01.000Z', summary: 'Return dormant work to the planned backlog'
  }));
  assert.equal(planned.event.localState, 'planned');
  await assert.rejects(appendTrackingEvent(state, input({ kind: 'ITEM_PLANNED', localState: 'active' })), /incompatible/u);
  await assert.rejects(appendTrackingEvent(state, input({
    kind: 'REVIEW_COMPLETED', localState: 'active',
    review: { decision: 'approve', confidence: 93, failed: 1, security: 0, dissent: 0, questions: 0 }
  })), /decision and counters disagree/u);
  await assert.rejects(appendTrackingEvent(state, input({
    sourceEventId: 'implementation-without-review', kind: 'IMPLEMENTATION_VALIDATED', localState: 'active'
  })), /requires review counters/u);
  const implementation = await appendTrackingEvent(state, input({
    sourceEventId: 'implementation-reviewed', kind: 'IMPLEMENTATION_VALIDATED', localState: 'active',
    review: { decision: 'pass', confidence: 93, failed: 0, security: 0, dissent: 0, questions: 0 }
  }));
  assert.equal(implementation.created, true);
  await assert.rejects(appendTrackingEvent(state, input({ projectKey: 'kstk' })), (error) => error.code === 'KSTACK_JIRA_TRACKING_INPUT_NONCANONICAL');
  await assert.rejects(appendTrackingEvent(state, input({
    evidence: [{ repoRelativePath: '.kstack\\objective.md', sha256: 'a'.repeat(64), evidenceKind: 'objective' }]
  })), (error) => error.code === 'KSTACK_JIRA_TRACKING_INPUT_NONCANONICAL');
});

test('stored event bytes must equal the exact canonical serialization and terminator', async () => {
  const { state } = fixture();
  await appendTrackingEvent(state, input());
  const name = fs.readdirSync(state.trackingRoot).find((entry) => entry.endsWith('.json'));
  const file = path.join(state.trackingRoot, name);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  await assert.rejects(
    listTrackingEvents(state),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_EVENT_INVALID' && /exact canonical serialization/u.test(error.message)
  );
});

test('every shared secret matcher class has an outbox admission canary', () => {
  const canaries = [
    '-----BEGIN RSA PRIVATE KEY-----abcd-----END RSA PRIVATE KEY-----',
    'Basic QWxhZGRpbjpPcGVuU2VzYW1l',
    'JIRA_API_TOKEN=abcdefghijklmnop',
    `ghp_${'a'.repeat(20)}`,
    `ATATT3xF${'a'.repeat(20)}`,
    'xoxb-1234567890-abcdefgh',
    'AKIAIOSFODNN7EXAMPLE',
    `AWS_SECRET_ACCESS_KEY=${'a'.repeat(40)}`,
    'password=abcdefghijkl',
    'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature'
  ];
  assert.equal(canaries.length, 10);
  for (const canary of canaries) assert.throws(() => assertOutboundSecretScan(Buffer.from(canary, 'utf8')), /OUTBOUND_SECRET_SCAN_REJECTED/u);
});

test('every production tracking capacity bound accepts equality and rejects max plus one', () => {
  const exact = { ...TRACKING_LIMITS };
  assert.deepEqual(validateTrackingCapacity(exact), exact);
  for (const key of Object.keys(TRACKING_LIMITS)) {
    assert.throws(
      () => validateTrackingCapacity({ ...exact, [key]: TRACKING_LIMITS[key] + 1 }),
      (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_LIMIT'
    );
  }
});

test('append identity is bound to enrolled repository and Jira project', async () => {
  const { state } = fixture();
  await assert.rejects(
    appendTrackingEvent(state, input({ repositoryNamespace: 'AuthorityGate/Other' })),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_BINDING_DRIFT'
  );
  await assert.rejects(
    appendTrackingEvent(state, input({ projectKey: 'OTHER' })),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_BINDING_DRIFT'
  );
  const unbound = { ...state, jira: { ...state.jira, tracking: { mode: 'off' } }, config: {} };
  await assert.rejects(
    appendTrackingEvent(unbound, input()),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_BINDING_REQUIRED'
  );
});

test('normalization-equivalent disk tampering and duplicate chain identities fail closed', async () => {
  const canonicalFixture = fixture();
  await appendTrackingEvent(canonicalFixture.state, input());
  const canonicalRoot = canonicalFixture.state.trackingRoot;
  const canonicalFile = fs.readdirSync(canonicalRoot).find((name) => name.endsWith('.json'));
  const changed = JSON.parse(fs.readFileSync(path.join(canonicalRoot, canonicalFile), 'utf8'));
  changed.evidence[0].repoRelativePath = changed.evidence[0].repoRelativePath.replaceAll('/', '\\');
  fs.writeFileSync(path.join(canonicalRoot, canonicalFile), `${JSON.stringify(changed)}\n`, { mode: 0o600 });
  await assert.rejects(listTrackingEvents(canonicalFixture.state), (error) => error.code === 'KSTACK_JIRA_TRACKING_INPUT_NONCANONICAL');

  const duplicateFixture = fixture();
  const first = (await appendTrackingEvent(duplicateFixture.state, input())).event;
  const duplicateBody = {
    ...first,
    eventOrdinal: 2,
    priorEventDigest: first.eventDigest
  };
  delete duplicateBody.eventDigest;
  const duplicate = {
    ...duplicateBody,
    eventDigest: crypto.createHash('sha256').update(Buffer.from(canonicalJson(duplicateBody), 'utf8')).digest('hex')
  };
  const duplicateName = `${duplicate.stableItemDigest}-00000002-${duplicate.eventId}.json`;
  fs.writeFileSync(path.join(duplicateFixture.state.trackingRoot, duplicateName), `${canonicalJson(duplicate)}\n`, { mode: 0o600 });
  fs.chmodSync(path.join(duplicateFixture.state.trackingRoot, duplicateName), 0o600);
  await assert.rejects(listTrackingEvents(duplicateFixture.state), (error) => error.code === 'KSTACK_JIRA_TRACKING_CHAIN_INVALID');
});

test('descriptor and ancestor trust checks reject file, symlink, and permission attacks', async () => {
  const permissionFixture = fixture();
  await appendTrackingEvent(permissionFixture.state, input());
  const eventFile = fs.readdirSync(permissionFixture.state.trackingRoot).find((name) => name.endsWith('.json'));
  fs.chmodSync(path.join(permissionFixture.state.trackingRoot, eventFile), 0o644);
  await assert.rejects(listTrackingEvents(permissionFixture.state), (error) => error.code === 'KSTACK_JIRA_TRACKING_EVENT_INVALID');

  const linkFixture = fixture();
  await appendTrackingEvent(linkFixture.state, input());
  const linkName = fs.readdirSync(linkFixture.state.trackingRoot).find((name) => name.endsWith('.json'));
  const original = path.join(linkFixture.repoRoot, `${linkName}.original`);
  fs.renameSync(path.join(linkFixture.state.trackingRoot, linkName), original);
  fs.symlinkSync(original, path.join(linkFixture.state.trackingRoot, linkName));
  await assert.rejects(listTrackingEvents(linkFixture.state), (error) => error.code === 'KSTACK_JIRA_TRACKING_EVENT_INVALID');

  const rootLinkFixture = fixture();
  fs.symlinkSync(rootLinkFixture.repoRoot, rootLinkFixture.state.trackingRoot, 'dir');
  await assert.rejects(appendTrackingEvent(rootLinkFixture.state, input()), (error) => error.code === 'KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED');

  const ancestorFixture = fixture();
  fs.chmodSync(ancestorFixture.repoRoot, 0o777);
  await assert.rejects(appendTrackingEvent(ancestorFixture.state, input()), (error) => error.code === 'KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED');
});

test('same-ID conflicts serialize, and independent processes build one contiguous chain', async () => {
  const conflictFixture = fixture();
  const conflict = await Promise.allSettled([
    appendTrackingEvent(conflictFixture.state, input({ summary: 'First content' })),
    appendTrackingEvent(conflictFixture.state, input({ summary: 'Second content' }))
  ]);
  assert.deepEqual(conflict.map((entry) => entry.status).sort(), ['fulfilled', 'rejected']);
  assert.equal((await listTrackingEvents(conflictFixture.state)).length, 1);

  const processFixture = fixture();
  const moduleUrl = new URL('../plugins/kstack/scripts/kstack-jira-tracking.mjs', import.meta.url).href;
  const writer = `
    const [moduleUrl, repoRoot, trackingRoot, index] = process.argv.slice(1);
    const { appendTrackingEvent } = await import(moduleUrl);
    const jira = { tracking: { repositoryNamespace: 'AuthorityGate/KStack', projectKey: 'KSTK' } };
    await appendTrackingEvent({ repoRoot, trackingRoot, jira, config: { jira }, clock: Date, lockWaitMs: 15000 }, {
      repositoryNamespace: 'AuthorityGate/KStack', projectKey: 'KSTK',
      threadId: 'jira-continuous-tracking-2026-08-28', itemId: 'JT-TC02',
      sourceEventId: 'process-' + index, kind: 'ITEM_UPDATED', localState: 'active',
      occurredAt: '2026-08-28T10:' + String(index).padStart(2, '0') + ':00.000Z',
      summary: 'Process writer ' + index, evidence: [], review: null, release: null
    });
  `;
  await Promise.all(Array.from({ length: 8 }, (_, index) => execFileAsync(process.execPath, [
    '--input-type=module', '-e', writer, moduleUrl, processFixture.repoRoot, processFixture.state.trackingRoot, String(index)
  ])));
  const events = await listTrackingEvents(processFixture.state);
  assert.equal(events.length, 8);
  assert.deepEqual(events.map((event) => event.eventOrdinal).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('crash cuts clean pre-rename residue and make post-rename retries idempotent', async () => {
  const beforeRename = fixture();
  beforeRename.state.testHooks = { afterFileSync: async () => { throw new Error('simulated crash before rename'); } };
  await assert.rejects(appendTrackingEvent(beforeRename.state, input()), /simulated crash/u);
  assert.equal(fs.readdirSync(beforeRename.state.trackingRoot).some((name) => name.includes('.tmp-')), false);
  delete beforeRename.state.testHooks;
  assert.equal((await appendTrackingEvent(beforeRename.state, input())).created, true);

  for (const boundary of ['afterRename', 'afterDirectorySync']) {
    const current = fixture();
    current.state.testHooks = { [boundary]: async () => { throw new Error(`simulated crash at ${boundary}`); } };
    await assert.rejects(appendTrackingEvent(current.state, input()), /simulated crash/u);
    delete current.state.testHooks;
    const retry = await appendTrackingEvent(current.state, input());
    assert.equal(retry.created, false);
    assert.equal((await listTrackingEvents(current.state)).length, 1);
  }

  const residueFixture = fixture();
  const created = await appendTrackingEvent(residueFixture.state, input());
  const eventName = `${created.event.stableItemDigest}-00000001-${created.event.eventId}.json`;
  const residue = `${eventName}.tmp-999-0123456789abcdef`;
  fs.writeFileSync(path.join(residueFixture.state.trackingRoot, residue), 'partial', { mode: 0o600 });
  await appendTrackingEvent(residueFixture.state, input({ sourceEventId: 'next', kind: 'ITEM_ACTIVE', localState: 'active', occurredAt: '2026-08-28T12:01:00.000Z' }));
  assert.equal(fs.existsSync(path.join(residueFixture.state.trackingRoot, residue)), false);
});

test('terminated writer processes recover at file-sync, rename, and directory-sync crash cuts', async () => {
  const moduleUrl = new URL('../plugins/kstack/scripts/kstack-jira-tracking.mjs', import.meta.url).href;
  const crashWriter = `
    const [moduleUrl, repoRoot, trackingRoot, boundary] = process.argv.slice(1);
    const { appendTrackingEvent } = await import(moduleUrl);
    const jira = { tracking: { repositoryNamespace: 'AuthorityGate/KStack', projectKey: 'KSTK' } };
    const terminate = async () => { process.kill(process.pid, 'SIGKILL'); await new Promise(() => {}); };
    await appendTrackingEvent({
      repoRoot, trackingRoot, jira, config: { jira }, clock: Date,
      testHooks: { [boundary]: terminate }
    }, {
      repositoryNamespace: 'AuthorityGate/KStack', projectKey: 'KSTK',
      threadId: 'jira-continuous-tracking-2026-08-28', itemId: 'JT-TC02',
      sourceEventId: 'terminated-' + boundary, kind: 'ITEM_CREATED', localState: 'planned',
      occurredAt: '2026-08-28T10:00:00.000Z', summary: 'Terminate at ' + boundary,
      evidence: [], review: null, release: null
    });
  `;
  for (const boundary of ['afterFileSync', 'afterRename', 'afterDirectorySync']) {
    const current = fixture();
    await assert.rejects(execFileAsync(process.execPath, [
      '--input-type=module', '-e', crashWriter, moduleUrl, current.repoRoot, current.state.trackingRoot, boundary
    ]));
    const namesAfterCrash = fs.readdirSync(current.state.trackingRoot);
    if (boundary === 'afterFileSync') assert.equal(namesAfterCrash.some((name) => name.includes('.tmp-')), true);
    else assert.equal(namesAfterCrash.some((name) => name.endsWith('.json')), true);
    const crashedLock = path.join(current.state.trackingRoot, 'outbox-index.json.lock');
    const staleTime = new Date(FixedClock.now() - DELIVERY_LOCK_STALE_MS - 1_000);
    fs.utimesSync(crashedLock, staleTime, staleTime);
    const retry = await appendTrackingEvent(current.state, input({
      sourceEventId: `terminated-${boundary}`, summary: `Terminate at ${boundary}`,
      occurredAt: '2026-08-28T10:00:00.000Z', evidence: []
    }));
    assert.equal(retry.created, boundary === 'afterFileSync');
    const recovered = await listTrackingEvents(current.state);
    assert.equal(recovered.length, 1);
    assert.equal(fs.readdirSync(current.state.trackingRoot).some((name) => name.includes('.tmp-') || name.includes('.stale-')), false);
  }
});

test('unexpected root entries and oversized event files fail closed', async () => {
  const unknownFixture = fixture();
  await appendTrackingEvent(unknownFixture.state, input());
  fs.writeFileSync(path.join(unknownFixture.state.trackingRoot, 'ignored.txt'), 'ignored', { mode: 0o600 });
  await assert.rejects(listTrackingEvents(unknownFixture.state), (error) => error.code === 'KSTACK_JIRA_TRACKING_ROOT_UNTRUSTED');

  const oversizedFixture = fixture();
  await appendTrackingEvent(oversizedFixture.state, input());
  const name = fs.readdirSync(oversizedFixture.state.trackingRoot).find((entry) => entry.endsWith('.json'));
  fs.appendFileSync(path.join(oversizedFixture.state.trackingRoot, name), 'x'.repeat(65 * 1024));
  await assert.rejects(listTrackingEvents(oversizedFixture.state), (error) => error.code === 'KSTACK_JIRA_TRACKING_EVENT_INVALID');
});

test('global item and abandoned-residue limits fail before storage can grow without bound', async () => {
  const itemFixture = fixture();
  try {
    await appendTrackingEvent(itemFixture.state, input());
    const originalName = fs.readdirSync(itemFixture.state.trackingRoot).find((entry) => entry.endsWith('.json'));
    const original = path.join(itemFixture.state.trackingRoot, originalName);
    const eventId = originalName.slice(-69, -5);
    for (let index = 0; index < 4096; index += 1) {
      const digest = crypto.createHash('sha256').update(`limit-item-${index}`).digest('hex');
      fs.linkSync(original, path.join(itemFixture.state.trackingRoot, `${digest}-00000001-${eventId}.json`));
    }
    await assert.rejects(listTrackingEvents(itemFixture.state), (error) => error.code === 'KSTACK_JIRA_TRACKING_LIMIT');
  } finally {
    fs.rmSync(itemFixture.repoRoot, { recursive: true, force: true });
  }

  const residueFixture = fixture();
  try {
    await appendTrackingEvent(residueFixture.state, input());
    const eventName = fs.readdirSync(residueFixture.state.trackingRoot).find((entry) => entry.endsWith('.json'));
    for (let index = 0; index < 33; index += 1) {
      const suffix = index.toString(16).padStart(16, '0');
      fs.writeFileSync(path.join(residueFixture.state.trackingRoot, `${eventName}.tmp-999-${suffix}`), 'partial', { mode: 0o600 });
    }
    await assert.rejects(
      appendTrackingEvent(residueFixture.state, input({ sourceEventId: 'over-residue-limit' })),
      (error) => error.code === 'KSTACK_JIRA_TRACKING_LIMIT'
    );
  } finally {
    fs.rmSync(residueFixture.repoRoot, { recursive: true, force: true });
  }
});

test('release evidence is mandatory only for ITEM_RELEASED', async () => {
  const { state } = fixture();
  await assert.rejects(appendTrackingEvent(state, input({ kind: 'ITEM_RELEASED', localState: 'done' })));
  await assert.rejects(appendTrackingEvent(state, input({ release: { name: 'v1.0.0', releaseDate: '2026-08-28', receiptSha256: 'b'.repeat(64) } })));
  const result = await appendTrackingEvent(state, input({
    sourceEventId: 'release-v1', kind: 'ITEM_RELEASED', localState: 'done',
    release: { name: 'v1.0.0', releaseDate: '2026-08-28', receiptSha256: 'b'.repeat(64) }
  }));
  assert.equal(result.created, true);
});

test('pending items create one deterministic offline Jira draft across retries', async () => {
  const { state } = fixture();
  await appendTrackingEvent(state, input());
  const first = await queueTrackingDrafts(state, state);
  const retry = await queueTrackingDrafts(state, state);
  assert.equal(first.length, 1);
  assert.equal(first[0].draftState, 'pending');
  assert.deepEqual(retry, first);
  assert.equal(fs.readdirSync(state.queueDir).filter((name) => name.endsWith('.json')).length, 1);
  const persisted = JSON.parse(fs.readFileSync(path.join(state.queueDir, `${first[0].draftId}.json`), 'utf8'));
  assert.equal(persisted.sessionId, `kstack-tracking:${first[0].stableItemDigest}`);
  assert.match(persisted.content.descriptionText, /Initial tracking state: planned/u);
  assert.doesNotMatch(JSON.stringify(persisted), /TRACKING_TOKEN|authorization|Basic /u);
});

test('each stable KStack item receives a distinct deterministic draft', async () => {
  const { state } = fixture();
  await appendTrackingEvent(state, input());
  await appendTrackingEvent(state, input({ itemId: 'JT-TC03', sourceEventId: 'item-created', summary: 'Project new items into Jira' }));
  const drafts = await queueTrackingDrafts(state, state);
  assert.equal(drafts.length, 2);
  assert.equal(new Set(drafts.map((entry) => entry.draftId)).size, 2);
});

test('approval-queued sync remains offline and exposes every new item draft', async () => {
  const { state } = fixture();
  let networkCalls = 0;
  state.fetchImpl = async () => { networkCalls += 1; throw new Error('network must not run'); };
  await appendTrackingEvent(state, input());
  await appendTrackingEvent(state, input({ itemId: 'JT-TC03', sourceEventId: 'item-created', summary: 'Project new items into Jira' }));
  const result = await syncTrackingEvents(state, state);
  assert.equal(result.mode, 'approval-queued');
  assert.equal(result.drafts.length, 2);
  assert.equal(result.projected.length, 0);
  assert.equal(networkCalls, 0);
});

test('automatic creation searches first, posts once, verifies exact fields, and persists restart mapping outside the queue', async () => {
  const { state } = fixture();
  const created = await appendTrackingEvent(state, input());
  state.jira.tracking.mode = 'automatic';
  state.config.authority.externalTicketCreation = 'allow';
  const api = installCreationApi(state, { reorderDescriptionKeys: true });
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  const first = await syncTrackingEvents(state, state);
  assert.equal(first.projected.length, 1);
  assert.equal(api.createPosts, 1);
  assert.ok(api.calls.indexOf('POST /rest/api/3/search/jql') < api.calls.indexOf('POST /rest/api/3/issue'));
  const mappingFile = path.join(state.trackingRoot, 'item-mappings', `${created.event.stableItemDigest}.json`);
  const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  assert.deepEqual([mapping.issueId, mapping.issueKey, mapping.stableItemDigest, mapping.adopted], ['10101', 'KSTK-101', created.event.stableItemDigest, false]);
  assert.equal(mapping.payloadSha256.length, 64);
  await syncTrackingEvents(state, state);
  assert.equal(api.createPosts, 1);
});

test('an exact preexisting Jira issue is adopted, while mismatched content is never adopted or overwritten', async () => {
  const adoptedFixture = fixture();
  await appendTrackingEvent(adoptedFixture.state, input());
  const [queued] = await queueTrackingDrafts(adoptedFixture.state, adoptedFixture.state);
  adoptedFixture.state.jira.tracking.mode = 'automatic';
  adoptedFixture.state.config.authority.externalTicketCreation = 'allow';
  const adoptedApi = installCreationApi(adoptedFixture.state, { preexistingDraftId: queued.draftId });
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  await syncTrackingEvents(adoptedFixture.state, adoptedFixture.state);
  assert.equal(adoptedApi.createPosts, 0);
  const adoptedMapping = JSON.parse(fs.readFileSync(path.join(adoptedFixture.state.trackingRoot, 'item-mappings', `${queued.stableItemDigest}.json`), 'utf8'));
  assert.equal(adoptedMapping.adopted, true);
  assert.equal(adoptedMapping.issueId, '10101');

  const mismatchFixture = fixture();
  await appendTrackingEvent(mismatchFixture.state, input());
  const [mismatchDraft] = await queueTrackingDrafts(mismatchFixture.state, mismatchFixture.state);
  mismatchFixture.state.jira.tracking.mode = 'automatic';
  mismatchFixture.state.config.authority.externalTicketCreation = 'allow';
  const mismatchApi = installCreationApi(mismatchFixture.state, { preexistingDraftId: mismatchDraft.draftId, mismatchSummary: 'Foreign issue' });
  await assert.rejects(
    syncTrackingEvents(mismatchFixture.state, mismatchFixture.state),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_ADOPTION_MISMATCH'
  );
  assert.equal(mismatchApi.createPosts, 0);
});

test('multiple marker matches and tampered durable mappings fail closed before any create POST', async () => {
  const duplicateFixture = fixture();
  await appendTrackingEvent(duplicateFixture.state, input());
  const [duplicateDraft] = await queueTrackingDrafts(duplicateFixture.state, duplicateFixture.state);
  duplicateFixture.state.jira.tracking.mode = 'automatic';
  duplicateFixture.state.config.authority.externalTicketCreation = 'allow';
  const duplicateApi = installCreationApi(duplicateFixture.state, { preexistingDraftId: duplicateDraft.draftId, multipleMatches: true });
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  await assert.rejects(
    syncTrackingEvents(duplicateFixture.state, duplicateFixture.state),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_DUPLICATE'
  );
  assert.equal(duplicateApi.createPosts, 0);

  const tamperFixture = fixture();
  const created = await appendTrackingEvent(tamperFixture.state, input());
  tamperFixture.state.jira.tracking.mode = 'automatic';
  tamperFixture.state.config.authority.externalTicketCreation = 'allow';
  const tamperApi = installCreationApi(tamperFixture.state);
  await syncTrackingEvents(tamperFixture.state, tamperFixture.state);
  const mappingFile = path.join(tamperFixture.state.trackingRoot, 'item-mappings', `${created.event.stableItemDigest}.json`);
  const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  fs.writeFileSync(mappingFile, `${JSON.stringify(mapping, null, 2)}\n`, { mode: 0o600 });
  await assert.rejects(
    syncTrackingEvents(tamperFixture.state, tamperFixture.state),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_MAPPING_INVALID'
  );
  assert.equal(tamperApi.createPosts, 1);
});

test('HTTP 429 is reconciled after provider effect and never causes a second create POST', async () => {
  const { state } = fixture();
  await appendTrackingEvent(state, input());
  state.jira.tracking.mode = 'automatic';
  state.config.authority.externalTicketCreation = 'allow';
  const api = installCreationApi(state, { createStatus: 429, createEffect: true });
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  const result = await syncTrackingEvents(state, state);
  assert.equal(result.projected.length, 1);
  assert.equal(api.createPosts, 1);
  await syncTrackingEvents(state, state);
  assert.equal(api.createPosts, 1);
});

test('HTTP 429 without visible effect remains durable unknown across restart and blocks every automatic repost', async () => {
  const { state } = fixture();
  const created = await appendTrackingEvent(state, input());
  state.jira.tracking.mode = 'automatic';
  state.config.authority.externalTicketCreation = 'allow';
  const api = installCreationApi(state, { createStatus: 429, createEffect: false });
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  for (let run = 0; run < 2; run += 1) {
    await assert.rejects(
      syncTrackingEvents(state, state),
      (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_CREATE_UNKNOWN'
    );
  }
  assert.equal(api.createPosts, 1);
  const attempt = JSON.parse(fs.readFileSync(path.join(state.trackingRoot, 'create-attempts', `${created.event.stableItemDigest}.json`), 'utf8'));
  assert.equal(attempt.outcome, 'ambiguous');
  assert.equal(attempt.responseClass, 'rate-limited');
});

test('automatic sync projects marker-bound history and adopts exact retries', async () => {
  const { state } = fixture();
  await appendTrackingEvent(state, input());
  await appendTrackingEvent(state, input({
    sourceEventId: 'design-validated',
    kind: 'DESIGN_VALIDATED',
    localState: 'active',
    occurredAt: '2026-08-28T12:05:00.000Z',
    summary: 'Design passed its gate',
    review: { decision: 'approve', confidence: 93, failed: 0, security: 0, dissent: 0, questions: 0 }
  }));
  const [queued] = await queueTrackingDrafts(state, state);
  const draftFile = path.join(state.queueDir, `${queued.draftId}.json`);
  const draft = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
  draft.state = 'submitted';
  draft.result = { id: '10001', key: 'KSTK-1', url: 'https://example.atlassian.net/browse/KSTK-1' };
  fs.writeFileSync(draftFile, `${JSON.stringify(draft)}\n`);
  const existingIssue = exactIssueForDraft(state, queued);

  state.jira.tracking.mode = 'automatic';
  state.config.authority.externalTicketCreation = 'allow';
  const comments = [];
  let commentPosts = 0;
  let transitionPosts = 0;
  let statusCategory = 'new';
  state.fetchImpl = async (url, options = {}) => {
    const requestUrl = String(url);
    const existing = existingIssueResponse(url, existingIssue);
    if (existing) return existing;
    if (options.method === 'POST' && requestUrl.endsWith('/comment')) {
      commentPosts += 1;
      const payload = JSON.parse(Buffer.from(options.body).toString('utf8'));
      const comment = { id: String(40 + commentPosts), body: payload.body };
      comments.push(comment);
      return new Response(JSON.stringify({ id: comment.id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (options.method === 'POST' && requestUrl.endsWith('/transitions')) {
      transitionPosts += 1;
      statusCategory = 'indeterminate';
      return new Response(null, { status: 204 });
    }
    if (requestUrl.includes('/comment?')) return new Response(JSON.stringify({ startAt: 0, total: comments.length, comments }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('?fields=status')) return new Response(JSON.stringify({ fields: { status: { statusCategory: { key: statusCategory } } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('/transitions')) return new Response(JSON.stringify({ transitions: [{ id: '31', to: { statusCategory: { key: 'indeterminate' } } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error(`unexpected request: ${url}`);
  };
  const priorEmail = process.env.TRACKING_EMAIL;
  const priorToken = process.env.TRACKING_TOKEN;
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  try {
    const first = await syncTrackingEvents(state, state);
    assert.equal(first.projected.length, 2);
    assert.equal(first.statuses[0].statusCategory, 'indeterminate');
    assert.equal(commentPosts, 2);
    assert.equal(transitionPosts, 1);
    assert.match(JSON.stringify(comments), /\[kstack-event:[a-f0-9]{64}\]/u);
    assert.match(JSON.stringify(comments), /confidence 93; failed 0; security 0; dissent 0; questions 0/u);

    const retry = await syncTrackingEvents(state, state);
    assert.equal(retry.projected.length, 2);
    assert.equal(retry.projected.every((entry) => entry.adopted), true);
    assert.equal(retry.statuses[0].adopted, true);
    assert.equal(commentPosts, 2);
    assert.equal(transitionPosts, 1);
  } finally {
    if (priorEmail === undefined) delete process.env.TRACKING_EMAIL; else process.env.TRACKING_EMAIL = priorEmail;
    if (priorToken === undefined) delete process.env.TRACKING_TOKEN; else process.env.TRACKING_TOKEN = priorToken;
  }
});

test('automatic release projection accepts only an approved released Jira version and reads back assignment', async () => {
  const { state } = fixture();
  await appendTrackingEvent(state, input());
  await appendTrackingEvent(state, input({
    sourceEventId: 'release-v1',
    kind: 'ITEM_RELEASED',
    localState: 'done',
    occurredAt: '2026-08-28T13:00:00.000Z',
    summary: 'Release the Jira tracking work',
    release: { name: 'v1.0.0', releaseDate: '2026-08-28', receiptSha256: 'b'.repeat(64) }
  }));
  const [queued] = await queueTrackingDrafts(state, state);
  const draftFile = path.join(state.queueDir, `${queued.draftId}.json`);
  const draft = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
  draft.state = 'submitted';
  draft.result = { id: '10001', key: 'KSTK-1', url: 'https://example.atlassian.net/browse/KSTK-1' };
  fs.writeFileSync(draftFile, `${JSON.stringify(draft)}\n`);
  const existingIssue = exactIssueForDraft(state, queued);

  state.jira.tracking.mode = 'automatic';
  state.jira.tracking.automaticVersionAssignment = true;
  state.jira.tracking.releaseVersions = [{ id: '20001', name: 'v1.0.0', releaseDate: '2026-08-28' }];
  state.config.authority.externalTicketCreation = 'allow';
  const comments = [];
  const fixVersions = [];
  let statusCategory = 'new';
  let versionWrites = 0;
  state.fetchImpl = async (url, options = {}) => {
    const requestUrl = String(url);
    const existing = existingIssueResponse(url, existingIssue);
    if (existing) return existing;
    if (options.method === 'POST' && requestUrl.endsWith('/comment')) {
      const payload = JSON.parse(Buffer.from(options.body).toString('utf8'));
      const comment = { id: String(50 + comments.length), body: payload.body };
      comments.push(comment);
      return new Response(JSON.stringify({ id: comment.id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (options.method === 'POST' && requestUrl.endsWith('/transitions')) {
      statusCategory = 'done';
      return new Response(null, { status: 204 });
    }
    if (options.method === 'PUT' && requestUrl.endsWith('/issue/KSTK-1')) {
      versionWrites += 1;
      fixVersions.push({ id: '20001' });
      return new Response(null, { status: 204 });
    }
    if (requestUrl.includes('/comment?')) return new Response(JSON.stringify({ startAt: 0, total: comments.length, comments }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('?fields=status')) return new Response(JSON.stringify({ fields: { status: { statusCategory: { key: statusCategory } } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('/transitions')) return new Response(JSON.stringify({ transitions: [{ id: '41', to: { statusCategory: { key: 'done' } } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('/project/KSTK')) return new Response(JSON.stringify({ id: '30001' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('/version/20001')) return new Response(JSON.stringify({ id: '20001', name: 'v1.0.0', projectId: 30001, releaseDate: '2026-08-28', released: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('?fields=fixVersions')) return new Response(JSON.stringify({ fields: { fixVersions } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error(`unexpected request: ${url}`);
  };
  const priorEmail = process.env.TRACKING_EMAIL;
  const priorToken = process.env.TRACKING_TOKEN;
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  try {
    const first = await syncTrackingEvents(state, state);
    assert.deepEqual(first.versions.map((entry) => [entry.versionId, entry.adopted]), [['20001', false]]);
    assert.equal(versionWrites, 1);
    const retry = await syncTrackingEvents(state, state);
    assert.deepEqual(retry.versions.map((entry) => [entry.versionId, entry.adopted]), [['20001', true]]);
    assert.equal(versionWrites, 1);
  } finally {
    if (priorEmail === undefined) delete process.env.TRACKING_EMAIL; else process.env.TRACKING_EMAIL = priorEmail;
    if (priorToken === undefined) delete process.env.TRACKING_TOKEN; else process.env.TRACKING_TOKEN = priorToken;
  }
});

test('an ambiguous comment POST is reconciled by marker and never blindly retried', async () => {
  const { state } = fixture();
  const created = await appendTrackingEvent(state, input());
  const queued = await bindSubmittedDraft(state);
  const existingIssue = exactIssueForDraft(state, queued);
  const comments = [];
  let posts = 0;
  state.fetchImpl = async (url, options = {}) => {
    const requestUrl = String(url);
    const existing = existingIssueResponse(url, existingIssue);
    if (existing) return existing;
    if (options.method === 'POST' && requestUrl.endsWith('/comment')) {
      posts += 1;
      const payload = JSON.parse(Buffer.from(options.body).toString('utf8'));
      comments.push({ id: '61', body: payload.body });
      throw new Error('connection ended after provider effect');
    }
    if (requestUrl.includes('/comment?')) return new Response(JSON.stringify({ total: comments.length, comments }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('?fields=status')) return new Response(JSON.stringify({ fields: { status: { statusCategory: { key: 'new' } } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error(`unexpected request: ${url}`);
  };
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  const result = await syncTrackingEvents(state, state);
  assert.equal(result.projected[0].eventId, created.event.eventId);
  assert.equal(result.projected[0].adopted, true);
  assert.equal(posts, 1);
});

test('duplicate event comments and ambiguous workflow transitions fail closed', async () => {
  const duplicateFixture = fixture();
  const created = await appendTrackingEvent(duplicateFixture.state, input());
  const duplicateQueued = await bindSubmittedDraft(duplicateFixture.state);
  const duplicateIssue = exactIssueForDraft(duplicateFixture.state, duplicateQueued);
  duplicateFixture.state.fetchImpl = async (url) => {
    const existing = existingIssueResponse(url, duplicateIssue);
    if (existing) return existing;
    if (String(url).includes('/comment?')) return new Response(JSON.stringify({
      total: 2,
      comments: [{ id: '71', body: markerBody(created.event.eventId) }, { id: '72', body: markerBody(created.event.eventId) }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error(`unexpected request: ${url}`);
  };
  process.env.TRACKING_EMAIL = 'kstack@example.com';
  process.env.TRACKING_TOKEN = 'test-token-value';
  await assert.rejects(
    syncTrackingEvents(duplicateFixture.state, duplicateFixture.state),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_DUPLICATE'
  );

  const transitionFixture = fixture();
  const initial = await appendTrackingEvent(transitionFixture.state, input());
  const active = await appendTrackingEvent(transitionFixture.state, input({
    sourceEventId: 'active', kind: 'ITEM_ACTIVE', localState: 'active',
    occurredAt: '2026-08-28T12:10:00.000Z', summary: 'Start work'
  }));
  const transitionQueued = await bindSubmittedDraft(transitionFixture.state);
  const transitionIssue = exactIssueForDraft(transitionFixture.state, transitionQueued);
  transitionFixture.state.fetchImpl = async (url, options = {}) => {
    const requestUrl = String(url);
    const existing = existingIssueResponse(url, transitionIssue);
    if (existing) return existing;
    if (requestUrl.includes('/comment?')) {
      return new Response(JSON.stringify({
        total: 2,
        comments: [{ id: '81', body: markerBody(initial.event.eventId) }, { id: '82', body: markerBody(active.event.eventId) }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (requestUrl.endsWith('?fields=status')) return new Response(JSON.stringify({ fields: { status: { statusCategory: { key: 'new' } } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (requestUrl.endsWith('/transitions') && options.method === 'GET') return new Response(JSON.stringify({ transitions: [
      { id: '91', to: { statusCategory: { key: 'indeterminate' } } },
      { id: '92', to: { statusCategory: { key: 'indeterminate' } } }
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error(`unexpected request: ${url}`);
  };
  await assert.rejects(
    syncTrackingEvents(transitionFixture.state, transitionFixture.state),
    (error) => error instanceof JiraTrackingError && error.code === 'KSTACK_JIRA_TRACKING_TRANSITION_AMBIGUOUS'
  );
});
