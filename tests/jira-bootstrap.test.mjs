import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  acquireDeliveryLock, approveDeliveryStack, applyDeliveryStack, buildDeliveryPlan,
  previewDeliveryStack, readDeliveryRecord, reconcileDeliveryStack,
  releaseDeliveryLock, validateExistingDeliveryStack, writeDeliveryRecord
} from '../plugins/kstack/scripts/kstack-jira-bootstrap.mjs';
import { EXIT, JiraQueueError } from '../plugins/kstack/scripts/kstack-jira.mjs';

process.env.KSTACK_BOOTSTRAP_EMAIL = 'bootstrap@example.com';
process.env.KSTACK_BOOTSTRAP_TOKEN = 'fixture-bootstrap-token-never-persisted';

function makeState(fetchImpl = async () => Response.json({}, { status: 500 }), overrides = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-bootstrap-'));
  const jira = {
    enabled: true,
    siteUrl: 'https://fixture.atlassian.net',
    projects: [{ key: 'KSTK', issueTypes: ['Task'], defaultFields: {} }],
    credentialSource: { type: 'env', emailEnvVar: 'KSTACK_BOOTSTRAP_EMAIL', tokenEnvVar: 'KSTACK_BOOTSTRAP_TOKEN' },
    staticLabels: [], timeoutMs: 1000, maxAttempts: 3,
    approvalTtlMs: 86400000, dryRun: false, nodeMinVersion: '20.0.0',
    ...overrides.jira
  };
  return {
    repoRoot, jira, config: { schemaVersion: 1, jira }, configDigest: overrides.configDigest || 'a'.repeat(64),
    fetchImpl, clock: overrides.clock || Date
  };
}

function previewArgs(changes = {}) {
  return {
    mode: 'new', projectKey: 'SHOP', projectName: 'Shop', repository: 'Example/shop',
    branches: ['main', 'Dev'], environments: ['development', 'staging', 'production'],
    ...changes
  };
}

async function approved(state, args = previewArgs()) {
  const preview = await previewDeliveryStack(state, args);
  return approveDeliveryStack(state, preview.planSha256);
}

function successfulJiraMock(calls) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push({ key, authorization: options.headers?.Authorization, body: options.body?.toString('utf8') || null });
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1', emailAddress: 'bootstrap@example.com' });
    if (key === 'GET /rest/api/3/project/SHOP' && calls.filter((call) => call.key === key).length === 1) return Response.json({}, { status: 404 });
    if (key === 'POST /rest/api/3/project') return Response.json({ id: '10001', key: 'SHOP' }, { status: 201 });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'software' });
    if (key === 'GET /rest/api/3/filter/search') return Response.json({ values: [] });
    if (key === 'POST /rest/api/3/filter') return Response.json({ id: '20001' }, { status: 201 });
    if (key === 'GET /rest/api/3/filter/20001') return Response.json({ id: '20001', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' });
    if (key === 'GET /rest/agile/1.0/board') return Response.json({ values: [] });
    if (key === 'POST /rest/agile/1.0/board') return Response.json({ id: '30001', name: 'Shop Delivery' }, { status: 201 });
    if (key === 'GET /rest/agile/1.0/board/30001') return Response.json({ id: '30001', name: 'Shop Delivery', type: 'kanban' });
    if (key === 'GET /rest/agile/1.0/board/30001/configuration') return Response.json({ id: 30001, filter: { id: '20001' } });
    return Response.json({}, { status: 404 });
  };
}

test('new preview defaults to one Free-compatible Kanban board without Jira automation', async () => {
  const state = makeState();
  const record = await previewDeliveryStack(state, previewArgs());
  assert.equal(record.state, 'new-previewed');
  assert.equal(record.plan.boards.length, 1);
  assert.equal(record.plan.boards[0].type, 'kanban');
  assert.equal(record.plan.releasePolicy.jiraAutomationRequired, false);
  assert.deepEqual(record.plan.repository.branches, ['main', 'Dev']);
  assert.deepEqual(record.operations.map((operation) => operation.kind), ['project-create', 'filter-create', 'board-create']);
  assert.equal((await readDeliveryRecord(state)).planSha256, record.planSha256);
});

test('Scrum preview selects the matching Jira project template', () => {
  const plan = buildDeliveryPlan(makeState(), previewArgs({ boardType: 'scrum' }));
  assert.match(plan.project.template, /scrum-classic$/u);
  assert.equal(plan.boards[0].type, 'scrum');
});

test('skip records a terminal onboarding choice with no fake project or plan', async () => {
  const state = makeState();
  const record = await previewDeliveryStack(state, { mode: 'skip' });
  assert.deepEqual(record, {
    schema: 'kstack-jira-delivery-stack-v1', state: 'skipped', updatedAt: record.updatedAt,
    plan: null, planSha256: null, approvedAt: null, operations: [], effects: []
  });
});

test('existing onboarding requires actual board and filter identifiers', () => {
  const state = makeState();
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ mode: 'existing' })), (error) => error instanceof JiraQueueError && error.exitCode === EXIT.CONFIG_INVALID);
  const plan = buildDeliveryPlan(state, previewArgs({ mode: 'existing', boardId: '31', filterId: '21' }));
  assert.deepEqual(plan.operations.map((operation) => operation.kind), ['project-verify', 'filter-verify', 'board-verify']);
});

test('existing validation performs reads only and promotes exact resources', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    const key = `${options.method || 'GET'} ${pathname}`;
    calls.push(key);
    if (pathname === '/rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (pathname === '/rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop' });
    if (pathname === '/rest/api/3/filter/21') return Response.json({ id: '21', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' });
    if (pathname === '/rest/agile/1.0/board/31') return Response.json({ id: '31', name: 'Shop Delivery', type: 'kanban' });
    if (pathname === '/rest/agile/1.0/board/31/configuration') return Response.json({ filter: { id: '21' } });
    return Response.json({}, { status: 404 });
  });
  await previewDeliveryStack(state, previewArgs({ mode: 'existing', boardId: '31', filterId: '21' }));
  const result = await validateExistingDeliveryStack(state);
  assert.equal(result.state, 'existing-validated');
  assert.equal(calls.every((call) => call.startsWith('GET ')), true);
  assert.deepEqual(result.effects.map((entry) => entry.outcome), ['adopted', 'adopted', 'adopted']);
});

test('approval binds the exact plan and current KStack configuration', async () => {
  const state = makeState();
  const record = await previewDeliveryStack(state, previewArgs());
  await assert.rejects(approveDeliveryStack(state, 'b'.repeat(64)), (error) => error.exitCode === EXIT.PAYLOAD_INTEGRITY);
  state.configDigest = 'c'.repeat(64);
  await assert.rejects(approveDeliveryStack(state, record.planSha256), (error) => error.exitCode === EXIT.CONFIG_DRIFT);
});

test('approved apply creates project, filter, and board once and verifies every identity', async () => {
  const calls = [];
  const state = makeState(successfulJiraMock(calls));
  await approved(state);
  const result = await applyDeliveryStack(state);
  assert.equal(result.state, 'verified');
  assert.deepEqual(result.effects.map((entry) => entry.operation), ['project', 'primary-filter', 'primary-board']);
  assert.deepEqual(result.operations.map((entry) => entry.state), ['complete', 'complete', 'complete']);
  assert.equal(calls.filter((call) => call.key.startsWith('POST ')).length, 3);
  assert.equal(calls.every((call) => call.authorization === `Basic ${Buffer.from('bootstrap@example.com:fixture-bootstrap-token-never-persisted').toString('base64')}`), true);
  const persisted = fs.readFileSync(path.join(state.repoRoot, '.kstack', 'jira-delivery-stack.json'), 'utf8');
  assert.doesNotMatch(persisted, /fixture-bootstrap-token|authorization|basic /iu);
});

test('an exact pre-existing project is adopted rather than posted again', async () => {
  const calls = [];
  const mock = successfulJiraMock(calls);
  const state = makeState(async (url, options) => {
    const parsed = new URL(url);
    if ((options?.method || 'GET') === 'GET' && parsed.pathname === '/rest/api/3/project/SHOP') {
      calls.push({ key: 'GET /rest/api/3/project/SHOP', authorization: options.headers.Authorization });
      return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'software' });
    }
    return mock(url, options);
  });
  await approved(state);
  const result = await applyDeliveryStack(state);
  assert.equal(result.effects[0].outcome, 'adopted');
  assert.equal(calls.some((call) => call.key === 'POST /rest/api/3/project'), false);
});

test('a mismatched pre-existing project fails without creating filter or board', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push(key);
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Someone Else' });
    return Response.json({}, { status: 500 });
  });
  await approved(state);
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.AMBIGUOUS_HISTORY);
  assert.equal((await readDeliveryRecord(state)).state, 'ambiguous');
  assert.equal(calls.some((call) => call.includes('/filter')), false);
  assert.equal(calls.some((call) => call.includes('/board')), false);
});

test('an ambiguous project POST stops the sequence and is never retried', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push(key);
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({}, { status: 404 });
    if (key === 'POST /rest/api/3/project') return Response.json({}, { status: 503 });
    return Response.json({}, { status: 500 });
  });
  await approved(state);
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.AMBIGUOUS_HISTORY);
  assert.equal(calls.filter((key) => key === 'POST /rest/api/3/project').length, 1);
  assert.equal((await readDeliveryRecord(state)).state, 'ambiguous');
});

test('expired approval performs no network request', async () => {
  const calls = [];
  let time = Date.parse('2026-08-28T12:00:00.000Z');
  class Clock extends Date {
    constructor() { super(time); }
  }
  const state = makeState(async () => { calls.push(true); return Response.json({}); }, { clock: Clock, jira: { approvalTtlMs: 60000 } });
  await approved(state);
  time += 60001;
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.APPROVAL_EXPIRED);
  assert.equal(calls.length, 0);
});

test('a held delivery lock blocks concurrent preview before state mutation', async () => {
  const state = makeState();
  const lock = await acquireDeliveryLock(state, 'fixture');
  try {
    await assert.rejects(previewDeliveryStack(state, previewArgs()), (error) => error.exitCode === EXIT.LOCK_HELD);
    assert.equal(await readDeliveryRecord(state), null);
  } finally { await releaseDeliveryLock(lock); }
});

test('reconciliation adopts a partial filter, requires fresh approval, and avoids duplicate POST', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push(key);
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'software' });
    if (key === 'GET /rest/api/3/filter/search') return Response.json({ values: [{ id: '20001', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' }] });
    if (key === 'GET /rest/agile/1.0/board') return Response.json({ values: [] });
    if (key === 'POST /rest/agile/1.0/board') return Response.json({ id: '30001' }, { status: 201 });
    if (key === 'GET /rest/agile/1.0/board/30001') return Response.json({ id: '30001', name: 'Shop Delivery', type: 'kanban' });
    if (key === 'GET /rest/agile/1.0/board/30001/configuration') return Response.json({ filter: { id: '20001' } });
    return Response.json({}, { status: 404 });
  });
  const initial = await approved(state);
  initial.state = 'ambiguous';
  initial.lastFailure = { code: EXIT.AMBIGUOUS_HISTORY, message: 'fixture' };
  await writeDeliveryRecord(state, initial);
  const reconciled = await reconcileDeliveryStack(state);
  assert.equal(reconciled.state, 'new-previewed');
  assert.equal(reconciled.approvedAt, null);
  await approveDeliveryStack(state, reconciled.planSha256);
  const result = await applyDeliveryStack(state);
  assert.equal(result.state, 'verified');
  assert.equal(result.effects.find((entry) => entry.operation === 'primary-filter').outcome, 'adopted');
  assert.equal(calls.some((key) => key === 'POST /rest/api/3/filter'), false);
  assert.equal(calls.filter((key) => key === 'POST /rest/agile/1.0/board').length, 1);
});

test('credential resolution failure leaves an approved plan retryable rather than applying', async () => {
  const state = makeState();
  await approved(state);
  const saved = process.env.KSTACK_BOOTSTRAP_TOKEN;
  delete process.env.KSTACK_BOOTSTRAP_TOKEN;
  try {
    await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.CONFIG_DRIFT);
  } finally {
    process.env.KSTACK_BOOTSTRAP_TOKEN = saved;
  }
  assert.equal((await readDeliveryRecord(state)).state, 'new-approved');
});
