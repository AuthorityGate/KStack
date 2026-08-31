import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  acquireDeliveryLock, approveDeliveryStack, applyDeliveryStack, buildDeliveryPlan,
  previewDeliveryStack, readDeliveryRecord, reconcileDeliveryStack,
  releaseDeliveryLock, requireJiraAdministrationAuthority,
  startProjectSpace, validateExistingDeliveryStack, writeDeliveryRecord
} from '../plugins/kstack/scripts/kstack-jira-bootstrap.mjs';
import { EXIT, JiraQueueError } from '../plugins/kstack/scripts/kstack-jira.mjs';
import { defaultConfig, validateConfig } from '../plugins/kstack/scripts/kstack-config.mjs';

process.env.KSTACK_BOOTSTRAP_EMAIL = 'bootstrap@example.com';
process.env.KSTACK_BOOTSTRAP_TOKEN = 'fixture-bootstrap-token-never-persisted';

function makeState(fetchImpl = async () => Response.json({}, { status: 500 }), overrides = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-bootstrap-'));
  const jira = {
    enabled: true,
    siteUrl: 'https://fixture.atlassian.net',
    projects: [{ key: 'SHOP', issueTypes: ['Task'], defaultFields: {} }],
    credentialSource: { type: 'env', emailEnvVar: 'KSTACK_BOOTSTRAP_EMAIL', tokenEnvVar: 'KSTACK_BOOTSTRAP_TOKEN' },
    staticLabels: [], timeoutMs: 1000, maxAttempts: 3,
    approvalTtlMs: 86400000, dryRun: false, nodeMinVersion: '20.0.0',
    ...overrides.jira
  };
  return {
    repoRoot, jira, config: { schemaVersion: 1, jira, authority: { jiraAdministration: 'allow' } }, configDigest: overrides.configDigest || 'a'.repeat(64),
    fetchImpl, clock: overrides.clock || Date
  };
}

test('project/space administration is available per project but requires explicit authority', () => {
  const state = makeState();
  state.config.authority = { jiraAdministration: 'ask' };
  assert.equal(requireJiraAdministrationAuthority(state, 'apply'), 'ask');
  state.config.authority.jiraAdministration = 'allow';
  assert.equal(requireJiraAdministrationAuthority(state, 'apply'), 'allow');
  state.config.authority.jiraAdministration = 'deny';
  assert.throws(() => requireJiraAdministrationAuthority(state, 'apply'), (cause) => cause.exitCode === EXIT.CONFIG_DRIFT);
  delete state.config.authority.jiraAdministration;
  assert.throws(() => requireJiraAdministrationAuthority(state, 'approve'), (cause) => cause.exitCode === EXIT.CONFIG_DRIFT);
});

test('each repository owns an independent project-space preview and cannot bootstrap an unenrolled key', async () => {
  const shop = makeState();
  const books = makeState(undefined, {
    jira: { projects: [{ key: 'BOOKS', issueTypes: ['Task'], defaultFields: {} }] }
  });
  const shopRecord = await previewDeliveryStack(shop, previewArgs());
  const booksRecord = await previewDeliveryStack(books, previewArgs({
    projectKey: 'BOOKS', projectName: 'Books', repository: 'Example/books'
  }));

  assert.notEqual(shop.repoRoot, books.repoRoot);
  assert.notEqual(path.dirname(recordPathForTest(shop)), path.dirname(recordPathForTest(books)));
  assert.equal(shopRecord.plan.project.key, 'SHOP');
  assert.equal(booksRecord.plan.project.key, 'BOOKS');
  assert.equal((await readDeliveryRecord(shop)).planSha256, shopRecord.planSha256);
  assert.equal((await readDeliveryRecord(books)).planSha256, booksRecord.planSha256);
  assert.throws(
    () => buildDeliveryPlan(shop, previewArgs({ projectKey: 'OTHER' })),
    (cause) => cause.exitCode === EXIT.CONFIG_INVALID && /enrolled in this repository/u.test(cause.message)
  );
});

function makeDisabledProjectState() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-project-start-'));
  const configDirectory = path.join(repoRoot, '.kstack');
  const configPath = path.join(configDirectory, 'config.json');
  fs.mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
  const config = structuredClone(defaultConfig);
  config.project.name = 'Books';
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return {
    repoRoot, configPath, config, jira: config.jira,
    fetchImpl: async () => { throw new Error('start must remain offline'); }, clock: Date
  };
}

test('project-local start enables Jira, enrolls its own key, binds tracking, and creates an offline preview', async () => {
  const state = makeDisabledProjectState();
  const record = await startProjectSpace(state, {
    siteUrl: 'https://fixture.atlassian.net', projectKey: 'BOOKS', projectName: 'Books',
    repository: 'Example/books', roadmapMode: 'empty'
  });
  const written = JSON.parse(fs.readFileSync(state.configPath, 'utf8'));
  assert.deepEqual(validateConfig(written, { configPath: state.configPath }), []);
  assert.equal(written.jira.enabled, true);
  assert.equal(written.jira.siteUrl, 'https://fixture.atlassian.net');
  assert.deepEqual(written.jira.projects, [{ key: 'BOOKS', issueTypes: ['Task'], defaultFields: {} }]);
  assert.deepEqual(written.jira.tracking, {
    mode: 'approval-queued', required: true, repositoryNamespace: 'Example/books', projectKey: 'BOOKS',
    automaticVersionAssignment: false, releaseVersions: []
  });
  assert.equal(written.authority.jiraAdministration, 'ask');
  assert.equal(record.state, 'new-previewed');
  assert.equal(record.plan.project.key, 'BOOKS');
  assert.equal(record.plan.repository.slug, 'Example/books');
  assert.equal((await readDeliveryRecord({ ...state, config: written, jira: written.jira })).planSha256, record.planSha256);
});

test('project-local starts are isolated and never reuse another repository delivery record', async () => {
  const alpha = makeDisabledProjectState();
  const beta = makeDisabledProjectState();
  await startProjectSpace(alpha, {
    siteUrl: 'https://fixture.atlassian.net', projectKey: 'ALPHA', projectName: 'Alpha',
    repository: 'Example/alpha', roadmapMode: 'empty'
  });
  await startProjectSpace(beta, {
    siteUrl: 'https://fixture.atlassian.net', projectKey: 'BETA', projectName: 'Beta',
    repository: 'Example/beta', trackingMode: 'off', jiraAdministration: 'allow', roadmapMode: 'empty'
  });
  assert.notEqual(recordPathForTest(alpha), recordPathForTest(beta));
  assert.equal(JSON.parse(fs.readFileSync(alpha.configPath, 'utf8')).jira.projects[0].key, 'ALPHA');
  const betaConfig = JSON.parse(fs.readFileSync(beta.configPath, 'utf8'));
  assert.equal(betaConfig.jira.projects[0].key, 'BETA');
  assert.equal(betaConfig.jira.tracking.mode, 'off');
  assert.equal(betaConfig.authority.jiraAdministration, 'allow');
});

test('each installed project runtime can start its own Jira project-space without the source checkout', () => {
  const sourceScripts = path.resolve('plugins/kstack/scripts');
  const projects = [
    { key: 'ALPHA', name: 'Alpha', slug: 'Example/alpha' },
    { key: 'BETA', name: 'Beta', slug: 'Example/beta' }
  ];

  for (const project of projects) {
    const state = makeDisabledProjectState();
    const installedRuntime = path.join(state.repoRoot, '.agents', 'skills', '.kstack-runtime');
    const installedScripts = path.join(installedRuntime, 'scripts');
    fs.mkdirSync(installedRuntime, { recursive: true, mode: 0o700 });
    fs.cpSync(sourceScripts, installedScripts, { recursive: true });
    const script = path.join(installedScripts, 'kstack-jira-bootstrap.mjs');
    const result = spawnSync(process.execPath, [
      script, 'start', '--site-url', 'https://fixture.atlassian.net',
      '--project-key', project.key, '--project-name', project.name,
      '--repository', project.slug, '--roadmap-mode', 'empty'
    ], { cwd: state.repoRoot, encoding: 'utf8', env: { ...process.env } });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    const written = JSON.parse(fs.readFileSync(state.configPath, 'utf8'));
    assert.equal(output.state, 'new-previewed');
    assert.equal(output.plan.project.key, project.key);
    assert.equal(output.plan.repository.slug, project.slug);
    assert.equal(written.jira.tracking.projectKey, project.key);
    assert.equal(written.jira.tracking.repositoryNamespace, project.slug);
    assert.equal(path.dirname(path.dirname(script)), installedRuntime);
  }
});

test('project-local start refuses to replace an active delivery record or persist an invalid site', async () => {
  const state = makeDisabledProjectState();
  const original = fs.readFileSync(state.configPath);
  await assert.rejects(startProjectSpace(state, {
    siteUrl: 'https://attacker.example.test', projectKey: 'BOOKS', projectName: 'Books',
    repository: 'Example/books', roadmapMode: 'empty'
  }), (error) => error.exitCode === EXIT.CONFIG_INVALID);
  assert.deepEqual(fs.readFileSync(state.configPath), original);

  await startProjectSpace(state, {
    siteUrl: 'https://fixture.atlassian.net', projectKey: 'BOOKS', projectName: 'Books',
    repository: 'Example/books', roadmapMode: 'empty'
  });
  const afterFirstStart = fs.readFileSync(state.configPath);
  const refreshed = { ...state, config: JSON.parse(afterFirstStart), jira: JSON.parse(afterFirstStart).jira };
  await assert.rejects(startProjectSpace(refreshed, {
    siteUrl: 'https://fixture.atlassian.net', projectKey: 'OTHER', projectName: 'Other',
    repository: 'Example/other', roadmapMode: 'empty'
  }), (error) => error.exitCode === EXIT.STATE_ERROR && /already has a Jira delivery-stack record/u.test(error.message));
  assert.deepEqual(fs.readFileSync(state.configPath), afterFirstStart);
});

function recordPathForTest(state) {
  return state.deliveryRecordPath || path.join(state.repoRoot, '.kstack', 'jira-delivery-stack.json');
}

function previewArgs(changes = {}) {
  return {
    mode: 'new', projectKey: 'SHOP', projectName: 'Shop', repository: 'Example/shop',
    branches: ['main', 'Dev'], environments: ['development', 'staging', 'production'],
    roadmapMode: 'empty',
    ...changes
  };
}

async function approved(state, args = previewArgs()) {
  const preview = await previewDeliveryStack(state, args);
  return approveDeliveryStack(state, preview.planSha256);
}

function successfulJiraMock(calls) {
  const issues = new Map();
  let issueSequence = 1;
  return async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push({ key, authorization: options.headers?.Authorization, body: options.body?.toString('utf8') || null });
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1', emailAddress: 'bootstrap@example.com' });
    if (key === 'GET /rest/api/3/project/SHOP' && calls.filter((call) => call.key === key).length === 1) return Response.json({}, { status: 404 });
    if (key === 'GET /rest/api/3/project/type/accessible') return Response.json([{ key: 'software' }, { key: 'business' }]);
    if (key === 'POST /rest/api/3/project') return Response.json({ id: '10001', key: 'SHOP' }, { status: 201 });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'software' });
    if (key === 'GET /rest/api/3/filter/search') return Response.json({ values: [] });
    if (key === 'POST /rest/api/3/filter') return Response.json({ id: '20001' }, { status: 201 });
    if (key === 'GET /rest/api/3/filter/20001') return Response.json({ id: '20001', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' });
    if (key === 'GET /rest/agile/1.0/board') return Response.json({ values: [] });
    if (key === 'POST /rest/agile/1.0/board') return Response.json({ id: '30001', name: 'Shop Delivery' }, { status: 201 });
    if (key === 'GET /rest/agile/1.0/board/30001') return Response.json({ id: '30001', name: 'Shop Delivery', type: 'kanban' });
    if (key === 'GET /rest/agile/1.0/board/30001/configuration') return Response.json({ id: 30001, filter: { id: '20001' } });
    if (key === 'GET /rest/api/3/issue/createmeta/SHOP/issuetypes') return Response.json({ issueTypes: [{ id: '10010', name: 'Task' }] });
    if (key === 'POST /rest/api/3/search/jql') return Response.json({ issues: [...issues.values()], isLast: true });
    if (key === 'POST /rest/api/3/issue') {
      const fields = JSON.parse(options.body.toString('utf8')).fields;
      const issue = { id: String(40000 + issueSequence), key: `SHOP-${issueSequence}`, fields: { ...fields, issuetype: fields.issuetype } };
      issueSequence += 1;
      issues.set(issue.key, issue);
      return Response.json({ id: issue.id, key: issue.key }, { status: 201 });
    }
    if (key.startsWith('GET /rest/api/3/issue/SHOP-')) return Response.json(issues.get(parsed.pathname.split('/').at(-1)) || {}, { status: issues.has(parsed.pathname.split('/').at(-1)) ? 200 : 404 });
    return Response.json({}, { status: 404 });
  };
}

function customRoadmapArgs(items) {
  return previewArgs({ roadmapMode: 'custom', roadmapItems: items });
}

function roadmapSourceItem(localId = 'one', changes = {}) {
  return {
    localId, issueType: 'Task', summary: `Roadmap ${localId}`,
    description: `Deliver roadmap item ${localId}.`, labels: ['roadmap'], ...changes
  };
}

function roadmapIssueFixture(item, key = 'SHOP-90', changes = {}) {
  return {
    id: key.replace(/^SHOP-/u, '49'), key,
    fields: {
      summary: item.summary,
      issuetype: { name: item.issueType },
      description: {
        version: 1, type: 'doc',
        content: item.description.split(/\n{2,}/u).map((text) => ({
          type: 'paragraph', content: text ? [{ type: 'text', text }] : []
        }))
      },
      labels: item.labels,
      ...changes
    }
  };
}

test('new preview defaults to one Free-compatible Kanban board without Jira automation', async () => {
  const state = makeState();
  const args = previewArgs();
  delete args.roadmapMode;
  const record = await previewDeliveryStack(state, args);
  assert.equal(record.state, 'new-previewed');
  assert.equal(record.plan.boards.length, 1);
  assert.equal(record.plan.boards[0].type, 'kanban');
  assert.equal(record.plan.releasePolicy.jiraAutomationRequired, false);
  assert.equal(record.plan.roadmap.mode, 'auto');
  assert.equal(record.plan.roadmap.items.length, 5);
  assert.deepEqual(record.plan.repository.branches, ['main', 'Dev']);
  assert.deepEqual(record.operations.map((operation) => operation.kind), ['project-create', 'filter-create', 'board-create', ...Array(5).fill('roadmap-issue-create')]);
  assert.equal((await readDeliveryRecord(state)).planSha256, record.planSha256);
});

test('preview supports a trusted delivery record outside the repository', async () => {
  const state = makeState();
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-state-'));
  fs.chmodSync(stateRoot, 0o700);
  state.deliveryRecordPath = path.join(stateRoot, 'vitalwhy', 'jira-delivery-stack.json');
  const record = await previewDeliveryStack(state, previewArgs());
  assert.equal(record.state, 'new-previewed');
  assert.equal((await readDeliveryRecord(state)).planSha256, record.planSha256);
  assert.equal(fs.statSync(path.dirname(state.deliveryRecordPath)).mode & 0o777, 0o700);
});

test('default roadmap is preview-bound, created once, and verified by exact read-back', async () => {
  const calls = [];
  const state = makeState(successfulJiraMock(calls));
  const args = previewArgs();
  delete args.roadmapMode;
  await approved(state, args);
  const result = await applyDeliveryStack(state);
  assert.equal(result.state, 'verified');
  assert.equal(result.plan.roadmap.items.length, 5);
  assert.equal(result.operations.filter((entry) => entry.kind === 'roadmap-issue-create' && entry.state === 'complete').length, 5);
  assert.equal(result.effects.filter((entry) => entry.operation.startsWith('roadmap-') && entry.outcome === 'created').length, 5);
  assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/issue').length, 5);
  assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/search/jql').length, 1);
});

test('custom roadmap rejects duplicate IDs, unknown fields, and an unbound empty array', () => {
  const state = makeState();
  const item = { localId: 'one', issueType: 'Task', summary: 'One', description: 'One.', labels: ['roadmap'] };
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ roadmapMode: 'custom', roadmapItems: [] })), (error) => error.exitCode === EXIT.CONFIG_INVALID);
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ roadmapMode: 'custom', roadmapItems: [item, item] })), (error) => error.exitCode === EXIT.CONFIG_INVALID);
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ roadmapMode: 'custom', roadmapItems: [{ ...item, unexpected: true }] })), (error) => error.exitCode === EXIT.CONFIG_INVALID);
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ roadmapMode: 'custom', roadmapItems: Array.from({ length: 65 }, (_, index) => ({ ...item, localId: `item-${index}` })) })), (error) => error.exitCode === EXIT.CONFIG_INVALID);
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ roadmapMode: 'custom', roadmapItems: [{ ...item, localId: '../escape' }] })), (error) => error.exitCode === EXIT.CONFIG_INVALID);
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ roadmapMode: 'custom', roadmapItems: [{ ...item, labels: Array.from({ length: 17 }, (_, index) => `label-${index}`) }] })), (error) => error.exitCode === EXIT.CONFIG_INVALID);
});

test('roadmap content changes the approval digest without changing its stable identity marker', async () => {
  const original = roadmapSourceItem();
  const changed = { ...original, description: 'Deliver a materially changed roadmap item.' };
  const first = await previewDeliveryStack(makeState(), customRoadmapArgs([original]));
  const second = await previewDeliveryStack(makeState(), customRoadmapArgs([changed]));
  assert.equal(first.plan.roadmap.items[0].marker, second.plan.roadmap.items[0].marker);
  assert.notEqual(first.plan.roadmap.items[0].contentSha256, second.plan.roadmap.items[0].contentSha256);
  assert.notEqual(first.planSha256, second.planSha256);
});

test('roadmap issue-type preflight fails before the first issue POST', async () => {
  const calls = [];
  const state = makeState(successfulJiraMock(calls));
  await approved(state, customRoadmapArgs([roadmapSourceItem('story', { issueType: 'Story' })]));
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.PREFLIGHT_FAILED && /Story/u.test(error.message));
  assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/issue').length, 0);
  assert.equal((await readDeliveryRecord(state)).state, 'failed');
});

test('an exact roadmap issue is adopted without a duplicate POST', async () => {
  const calls = [];
  let discovered = [];
  const base = successfulJiraMock(calls);
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    if ((options.method || 'GET') === 'POST' && parsed.pathname === '/rest/api/3/search/jql') {
      calls.push({ key: 'POST /rest/api/3/search/jql', authorization: options.headers?.Authorization, body: options.body?.toString('utf8') || null });
      return Response.json({ issues: discovered, isLast: true });
    }
    return base(url, options);
  });
  const record = await approved(state, customRoadmapArgs([roadmapSourceItem()]));
  discovered = [roadmapIssueFixture(record.plan.roadmap.items[0])];
  const result = await applyDeliveryStack(state);
  assert.equal(result.state, 'verified');
  assert.equal(result.effects.at(-1).outcome, 'adopted');
  assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/issue').length, 0);
});

test('duplicate or content-drifted roadmap matches fail closed before issue creation', async () => {
  for (const fixture of ['duplicate', 'drift']) {
    const calls = [];
    let discovered = [];
    const base = successfulJiraMock(calls);
    const state = makeState(async (url, options = {}) => {
      const parsed = new URL(url);
      if ((options.method || 'GET') === 'POST' && parsed.pathname === '/rest/api/3/search/jql') {
        calls.push({ key: 'POST /rest/api/3/search/jql', authorization: options.headers?.Authorization, body: options.body?.toString('utf8') || null });
        return Response.json({ issues: discovered, isLast: true });
      }
      return base(url, options);
    });
    const record = await approved(state, customRoadmapArgs([roadmapSourceItem()]));
    const item = record.plan.roadmap.items[0];
    discovered = fixture === 'duplicate'
      ? [roadmapIssueFixture(item, 'SHOP-90'), roadmapIssueFixture(item, 'SHOP-91')]
      : [roadmapIssueFixture(item, 'SHOP-90', { summary: 'Drifted summary' })];
    await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.AMBIGUOUS_HISTORY);
    assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/issue').length, 0, fixture);
    assert.equal((await readDeliveryRecord(state)).state, 'ambiguous');
  }
});

test('a successful roadmap POST with inconclusive read-back is ambiguous and never retryable by apply', async () => {
  const calls = [];
  const base = successfulJiraMock(calls);
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    if (key === 'POST /rest/api/3/issue') {
      calls.push({ key, authorization: options.headers?.Authorization, body: options.body?.toString('utf8') || null });
      return Response.json({ id: '49990', key: 'SHOP-90' }, { status: 201 });
    }
    if (key === 'GET /rest/api/3/issue/SHOP-90') {
      calls.push({ key, authorization: options.headers?.Authorization, body: null });
      return Response.json({}, { status: 404 });
    }
    return base(url, options);
  });
  await approved(state, customRoadmapArgs([roadmapSourceItem()]));
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.AMBIGUOUS_HISTORY);
  assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/issue').length, 1);
  assert.equal((await readDeliveryRecord(state)).state, 'ambiguous');
  await assert.rejects(applyDeliveryStack(state), /new-approved/u);
  assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/issue').length, 1);
});

test('an ambiguous later roadmap POST preserves prior completion and reconciliation performs reads only', async () => {
  const calls = [];
  let issuePosts = 0;
  const base = successfulJiraMock(calls);
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    if (key === 'POST /rest/api/3/issue' && ++issuePosts === 2) {
      calls.push({ key, authorization: options.headers?.Authorization, body: options.body?.toString('utf8') || null });
      return Response.json({}, { status: 503 });
    }
    return base(url, options);
  });
  await approved(state, customRoadmapArgs([roadmapSourceItem('one'), roadmapSourceItem('two')]));
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.AMBIGUOUS_HISTORY);
  const ambiguous = await readDeliveryRecord(state);
  assert.equal(ambiguous.state, 'ambiguous');
  assert.deepEqual(ambiguous.operations.slice(3).map((entry) => entry.state), ['complete', 'pending']);
  assert.equal(ambiguous.effects.at(-1).operation, 'roadmap-one');
  assert.equal(calls.filter((call) => call.key === 'POST /rest/api/3/issue').length, 2);

  const reconciliationCalls = [];
  const first = roadmapIssueFixture(ambiguous.plan.roadmap.items[0], 'SHOP-1');
  state.fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    reconciliationCalls.push(key);
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'software' });
    if (key === 'GET /rest/api/3/filter/search') return Response.json({ values: [{ id: '20001', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' }] });
    if (key === 'GET /rest/agile/1.0/board') return Response.json({ values: [{ id: '30001', name: 'Shop Delivery', type: 'kanban' }] });
    if (key === 'GET /rest/agile/1.0/board/30001/configuration') return Response.json({ filter: { id: '20001' } });
    if (key === 'POST /rest/api/3/search/jql') return Response.json({ issues: [first], isLast: true });
    return Response.json({}, { status: 404 });
  };
  const reconciled = await reconcileDeliveryStack(state);
  assert.equal(reconciled.state, 'new-previewed');
  assert.deepEqual(reconciled.operations.slice(3).map((entry) => entry.state), ['complete', 'pending']);
  assert.equal(reconciliationCalls.some((entry) => entry.startsWith('POST ') && entry !== 'POST /rest/api/3/search/jql'), false);
});

test('roadmap rejection diagnostics and the durable record exclude credential canaries', async () => {
  const calls = [];
  const base = successfulJiraMock(calls);
  const canary = 'fixture-roadmap-secret-never-persisted';
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    if (key === 'POST /rest/api/3/issue') {
      calls.push({ key, authorization: options.headers?.Authorization, body: options.body?.toString('utf8') || null });
      return Response.json({ errors: { description: `token=${canary} is invalid` } }, { status: 400 });
    }
    return base(url, options);
  });
  await approved(state, customRoadmapArgs([roadmapSourceItem()]));
  await assert.rejects(applyDeliveryStack(state), (error) => {
    assert.equal(error.exitCode, EXIT.PREFLIGHT_FAILED);
    assert.match(error.message, /token=\[REDACTED\]/u);
    assert.doesNotMatch(error.message, new RegExp(canary, 'u'));
    return true;
  });
  assert.doesNotMatch(JSON.stringify(await readDeliveryRecord(state)), new RegExp(canary, 'u'));
});

test('Scrum preview selects the matching Jira project template', () => {
  const plan = buildDeliveryPlan(makeState(), previewArgs({ boardType: 'scrum' }));
  assert.match(plan.project.template, /scrum-classic$/u);
  assert.equal(plan.boards[0].type, 'scrum');
});

test('business preview binds the accessible Jira project-management template', () => {
  const plan = buildDeliveryPlan(makeState(), previewArgs({ projectType: 'business' }));
  assert.equal(plan.project.type, 'business');
  assert.equal(plan.project.template, 'com.atlassian.jira-core-project-templates:jira-core-simplified-project-management');
  assert.equal(plan.boards[0].type, 'kanban');
  assert.equal(plan.boards[0].name, 'Board');
  assert.equal(plan.boards[0].provider, 'jira-business-native');
  assert.equal(plan.operations[2].kind, 'board-verify');
});

test('business apply verifies the native board workflow without a Jira Software board POST', async () => {
  const calls = [];
  let projectReads = 0;
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push(key);
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (key === 'GET /rest/api/3/project/SHOP' && projectReads++ === 0) return Response.json({}, { status: 404 });
    if (key === 'GET /rest/api/3/project/type/accessible') return Response.json([{ key: 'business' }]);
    if (key === 'POST /rest/api/3/project') return Response.json({ id: '10001', key: 'SHOP' }, { status: 201 });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'business' });
    if (key === 'GET /rest/api/3/filter/search') return Response.json({ values: [] });
    if (key === 'POST /rest/api/3/filter') return Response.json({ id: '20001' }, { status: 201 });
    if (key === 'GET /rest/api/3/filter/20001') return Response.json({ id: '20001', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' });
    if (key === 'GET /rest/api/3/project/SHOP/statuses') return Response.json([{ name: 'Task', statuses: [
      { statusCategory: { key: 'new' } }, { statusCategory: { key: 'indeterminate' } }, { statusCategory: { key: 'done' } }
    ] }]);
    return Response.json({}, { status: 404 });
  });
  await approved(state, previewArgs({ projectType: 'business' }));
  const result = await applyDeliveryStack(state);
  assert.equal(result.state, 'verified');
  assert.equal(result.effects[2].resource.provider, 'jira-business-native');
  assert.equal(calls.includes('POST /rest/agile/1.0/board'), false);
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

test('existing Jira Business onboarding requires a filter but no fictional Agile board ID', () => {
  const state = makeState();
  assert.throws(() => buildDeliveryPlan(state, previewArgs({ mode: 'existing', projectType: 'business' })), (error) => error instanceof JiraQueueError && error.exitCode === EXIT.CONFIG_INVALID);
  const plan = buildDeliveryPlan(state, previewArgs({ mode: 'existing', projectType: 'business', filterId: '21' }));
  assert.equal(plan.boards[0].id, null);
  assert.equal(plan.boards[0].provider, 'jira-business-native');
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

test('existing Jira Business validation verifies its native board workflow using reads only', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push(`${options.method || 'GET'} ${pathname}`);
    if (pathname === '/rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (pathname === '/rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'business' });
    if (pathname === '/rest/api/3/filter/21') return Response.json({ id: '21', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' });
    if (pathname === '/rest/api/3/project/SHOP/statuses') return Response.json([{ statuses: [
      { statusCategory: { key: 'new' } }, { statusCategory: { key: 'indeterminate' } }, { statusCategory: { key: 'done' } }
    ] }]);
    return Response.json({}, { status: 404 });
  });
  await previewDeliveryStack(state, previewArgs({ mode: 'existing', projectType: 'business', filterId: '21' }));
  const result = await validateExistingDeliveryStack(state);
  assert.equal(result.state, 'existing-validated');
  assert.equal(result.effects[2].resource.provider, 'jira-business-native');
  assert.equal(calls.every((call) => call.startsWith('GET ')), true);
  assert.equal(calls.some((call) => call.includes('/rest/agile/')), false);
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
    if (key === 'GET /rest/api/3/project/type/accessible') return Response.json([{ key: 'software' }]);
    if (key === 'POST /rest/api/3/project') return Response.json({}, { status: 503 });
    return Response.json({}, { status: 500 });
  });
  await approved(state);
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.AMBIGUOUS_HISTORY);
  assert.equal(calls.filter((key) => key === 'POST /rest/api/3/project').length, 1);
  assert.equal((await readDeliveryRecord(state)).state, 'ambiguous');
});

test('a deterministic Jira rejection records bounded sanitized diagnostics without continuing', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push(key);
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({}, { status: 404 });
    if (key === 'GET /rest/api/3/project/type/accessible') return Response.json([{ key: 'software' }]);
    if (key === 'POST /rest/api/3/project') {
      return Response.json({
        errorMessages: ['The selected project template is unavailable.'],
        errors: { leadAccountId: 'token=fixture-bootstrap-token-never-persisted is invalid' }
      }, { status: 400 });
    }
    return Response.json({}, { status: 500 });
  });
  await approved(state);
  await assert.rejects(applyDeliveryStack(state), (error) => {
    assert.equal(error.exitCode, EXIT.PREFLIGHT_FAILED);
    assert.match(error.message, /selected project template is unavailable/u);
    assert.match(error.message, /token=\[REDACTED\]/u);
    assert.doesNotMatch(error.message, /fixture-bootstrap-token-never-persisted/u);
    return true;
  });
  const record = await readDeliveryRecord(state);
  assert.equal(record.state, 'failed');
  assert.match(record.lastFailure.message, /selected project template is unavailable/u);
  assert.doesNotMatch(JSON.stringify(record), /fixture-bootstrap-token-never-persisted/u);
  assert.equal(calls.some((call) => call.includes('/filter')), false);
  assert.equal(calls.some((call) => call.includes('/board')), false);
});

test('project-type preflight blocks an unavailable type before project mutation', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push(key);
    if (key === 'GET /rest/api/3/myself') return Response.json({ accountId: 'account-1' });
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({}, { status: 404 });
    if (key === 'GET /rest/api/3/project/type/accessible') return Response.json([{ key: 'business' }]);
    return Response.json({}, { status: 500 });
  });
  await approved(state);
  await assert.rejects(applyDeliveryStack(state), (error) => error.exitCode === EXIT.PREFLIGHT_FAILED && /software is not accessible/u.test(error.message));
  assert.equal(calls.includes('POST /rest/api/3/project'), false);
  assert.equal((await readDeliveryRecord(state)).state, 'failed');
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

test('Jira Business reconciliation completes a partial stack by native-board read-back only', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method || 'GET'} ${parsed.pathname}`;
    calls.push(key);
    if (key === 'GET /rest/api/3/project/SHOP') return Response.json({ id: '10001', key: 'SHOP', name: 'Shop', projectTypeKey: 'business' });
    if (key === 'GET /rest/api/3/filter/search') return Response.json({ values: [{ id: '20001', name: 'Shop Delivery Filter', jql: 'project = SHOP ORDER BY Rank ASC' }] });
    if (key === 'GET /rest/api/3/project/SHOP/statuses') return Response.json([{ statuses: [
      { statusCategory: { key: 'new' } }, { statusCategory: { key: 'indeterminate' } }, { statusCategory: { key: 'done' } }
    ] }]);
    return Response.json({}, { status: 404 });
  });
  const initial = await approved(state, previewArgs({ projectType: 'business' }));
  initial.state = 'failed';
  initial.lastFailure = { code: EXIT.PREFLIGHT_FAILED, message: 'fixture board failure' };
  await writeDeliveryRecord(state, initial);
  const result = await reconcileDeliveryStack(state);
  assert.equal(result.state, 'verified');
  assert.equal(result.approvedAt, null);
  assert.deepEqual(result.operations.map((entry) => entry.state), ['complete', 'complete', 'complete']);
  assert.equal(result.effects[2].resource.provider, 'jira-business-native');
  assert.equal(calls.every((call) => call.startsWith('GET ')), true);
  assert.equal(calls.some((call) => call.includes('/rest/agile/')), false);
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
