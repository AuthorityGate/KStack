import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  EXIT,
  JiraQueueError,
  acquireDraftLock,
  assertFence,
  boundedSearch,
  buildCanonicalPayload,
  classifyCreateResponse,
  classifyFetchError,
  configFingerprint,
  credentialHardeningWarnings,
  guardedWriteDraft,
  loadJiraState,
  releaseDraftLock,
  runVerification,
  runJiraCommand,
  validateCredentialFileHandle
} from '../plugins/kstack/scripts/kstack-jira.mjs';
import { defaultConfig } from '../plugins/kstack/scripts/kstack-config.mjs';

const execFileAsync = promisify(execFile);

process.env.KSTACK_TEST_JIRA_EMAIL = 'queue-tester@example.com';
process.env.KSTACK_TEST_JIRA_TOKEN = 'local-fixture-token-never-sent';

function makeState(fetchImpl = async () => new Response('{}', { status: 500 }), overrides = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-test-'));
  const queueDir = path.join(repoRoot, '.kstack', 'jira-queue');
  fs.mkdirSync(queueDir, { recursive: true, mode: 0o700 });
  const jira = {
    enabled: true,
    siteUrl: 'https://fixture.atlassian.net',
    projects: [{ key: 'KSTK', issueTypes: ['Task'], defaultFields: {} }],
    credentialSource: { type: 'env', emailEnvVar: 'KSTACK_TEST_JIRA_EMAIL', tokenEnvVar: 'KSTACK_TEST_JIRA_TOKEN' },
    staticLabels: [],
    timeoutMs: 1000,
    maxAttempts: 3,
    approvalTtlMs: 86400000,
    dryRun: false,
    nodeMinVersion: '20.0.0',
    ...overrides.jira
  };
  return {
    config: { jira },
    jira,
    repoRoot,
    queueDir,
    fetchImpl,
    clock: Date,
    poll: { minimumProbes: 1, minimumDurationMs: 0, maximumProbes: 3, maximumDurationMs: 100, ...overrides.poll }
  };
}

function draftFile(state, id) {
  return path.join(state.queueDir, `${id}.json`);
}

function readDraft(state, id) {
  return JSON.parse(fs.readFileSync(draftFile(state, id), 'utf8'));
}

function writeDraft(state, draft) {
  fs.writeFileSync(draftFile(state, draft.id), `${JSON.stringify(draft, null, 2)}\n`, { mode: 0o600 });
}

async function pendingDraft(state) {
  return runJiraCommand(state, 'draft', { project: 'KSTK', issueType: 'Task', summary: 'Queue fixture', description: 'Failure-path fixture' });
}

async function approvedDraft(state, changes = {}) {
  const draft = await pendingDraft(state);
  draft.canonicalPayload = buildCanonicalPayload(state, draft);
  draft.payloadSha256 = (await import('node:crypto')).createHash('sha256').update(Buffer.from(draft.canonicalPayload, 'utf8')).digest('hex');
  draft.configFingerprint = configFingerprint(state, draft, process.env.KSTACK_TEST_JIRA_EMAIL);
  draft.approvedAt = new Date().toISOString();
  draft.state = 'approved';
  Object.assign(draft, changes);
  writeDraft(state, draft);
  return draft;
}

function jiraSearchMock(keys = []) {
  return async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/mypermissions')) {
      return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
    }
    if (pathname.endsWith('/search/jql')) {
      return Response.json({ issues: keys.map((key) => ({ key })), isLast: true });
    }
    return Response.json({}, { status: 404 });
  };
}

async function assertExit(promise, exitCode) {
  await assert.rejects(promise, (error) => error instanceof JiraQueueError && error.exitCode === exitCode);
}

test('stale tombstone rename admits one contender and reports the other as held', async () => {
  const state = makeState();
  const draft = await pendingDraft(state);
  const stale = await acquireDraftLock(state, draft.id, 'submit', { disableHeartbeat: true, staleMs: 500 });
  const old = new Date(Date.now() - 5000);
  await stale.handle.utimes(old, old);

  const contenders = await Promise.allSettled([
    acquireDraftLock(state, draft.id, 'status', { disableHeartbeat: true, staleMs: 500 }),
    acquireDraftLock(state, draft.id, 'status', { disableHeartbeat: true, staleMs: 500 })
  ]);
  assert.equal(contenders.filter((item) => item.status === 'fulfilled').length, 1);
  const rejected = contenders.find((item) => item.status === 'rejected');
  assert.equal(rejected.reason.exitCode, EXIT.LOCK_HELD);
  const winner = contenders.find((item) => item.status === 'fulfilled').value;
  assert.equal(await assertFence(winner), true);
  assert.equal(fs.readdirSync(state.queueDir).filter((name) => name.includes('.tombstone.')).length, 1);
  await releaseDraftLock(winner);
  await assertExit(releaseDraftLock(stale), EXIT.LOCK_FENCED_CLEAN);
  await runJiraCommand(state, 'status');
  assert.equal(readDraft(state, draft.id).audit.some((entry) => entry.event === 'lock-broken' && entry.op === 'submit'), true);
});

test('guarded write rejects a fenced holder without changing the draft', async () => {
  const state = makeState();
  const draft = await pendingDraft(state);
  const stale = await acquireDraftLock(state, draft.id, 'edit', { disableHeartbeat: true });
  const displaced = `${stale.paths.lock}.displaced`;
  fs.renameSync(stale.paths.lock, displaced);
  const successor = await acquireDraftLock(state, draft.id, 'edit', { disableHeartbeat: true });
  const changed = structuredClone(draft);
  changed.content.summary = 'must not land';
  await assertExit(guardedWriteDraft(stale, changed), EXIT.LOCK_FENCED_CLEAN);
  assert.equal(readDraft(state, draft.id).content.summary, 'Queue fixture');
  assert.equal(fs.readdirSync(state.queueDir).some((name) => name.includes(`.orphan.${stale.lockId}.json`)), true);
  await releaseDraftLock(successor);
  await stale.handle.close();
  fs.unlinkSync(displaced);
});

test('a final-response write fenced after rename records posted:false without release overwriting it', async () => {
  const state = makeState();
  const draft = await pendingDraft(state);
  const lock = await acquireDraftLock(state, draft.id, 'submit', { disableHeartbeat: true });
  const changed = structuredClone(draft);
  changed.audit.push({ auditId: cryptoRandom(), event: 'submit-finished', at: new Date().toISOString() });
  const displaced = `${lock.paths.lock}.displaced`;
  await assertExit(guardedWriteDraft(lock, changed, {
    attemptId: 'response-recorded', posted: true, postedAfterWrite: false
  }, {
    afterWrite: async () => fs.renameSync(lock.paths.lock, displaced)
  }), EXIT.LOCK_FENCED_DIRTY);
  await releaseDraftLock(lock);
  const sidecar = JSON.parse(fs.readFileSync(lock.paths.orphan, 'utf8'));
  assert.equal(sidecar.posted, false);
  assert.equal(sidecar.wroteAfterFence, true);
  fs.unlinkSync(displaced);
});

test('release mis-claim writes sidecars and distinguishes restored clean, restored dirty, and unrestorable exits', async () => {
  async function exercise({ posted, restorable, expectedExit }) {
    const state = makeState();
    const draft = await pendingDraft(state);
    const lock = await acquireDraftLock(state, draft.id, 'submit', { disableHeartbeat: true });
    const originalRename = fs.promises.rename;
    fs.promises.rename = async (source, destination) => {
      await originalRename(source, destination);
      if (source === lock.paths.lock && destination === lock.paths.released) {
        fs.writeFileSync(destination, JSON.stringify({ lockId: 'successor-lock', op: 'submit' }));
        if (!restorable) fs.writeFileSync(source, JSON.stringify({ lockId: 'live-successor-lock', op: 'submit' }));
      }
    };
    try {
      await assertExit(releaseDraftLock(lock, { attemptId: 'release-attempt', posted }), expectedExit);
    } finally {
      fs.promises.rename = originalRename;
      await lock.handle.close().catch(() => {});
    }

    assert.equal(fs.existsSync(lock.paths.orphan), true);
    const sidecar = JSON.parse(fs.readFileSync(lock.paths.orphan, 'utf8'));
    assert.deepEqual(Object.keys(sidecar).sort(), ['at', 'attemptId', 'lockId', 'op', 'posted', 'wroteAfterFence']);
    assert.equal(sidecar.lockId, lock.lockId);
    assert.equal(sidecar.attemptId, 'release-attempt');
    assert.equal(sidecar.op, 'submit');
    assert.equal(sidecar.posted, posted);
    assert.equal(sidecar.wroteAfterFence, false);
    assert.equal(Number.isNaN(Date.parse(sidecar.at)), false);
    if (restorable) {
      assert.equal(JSON.parse(fs.readFileSync(lock.paths.lock, 'utf8')).lockId, 'successor-lock');
    }
  }

  await exercise({ posted: false, restorable: true, expectedExit: EXIT.LOCK_FENCED_CLEAN });
  await exercise({ posted: true, restorable: true, expectedExit: EXIT.LOCK_FENCED_DIRTY });
  await exercise({ posted: false, restorable: false, expectedExit: EXIT.LOCK_BREAK_RACE });
});

test('withDraftLock preserves an action error and exposes a concurrent release-fencing error', async () => {
  const state = makeState();
  const draft = await approvedDraft(state);
  const originalRename = fs.promises.rename;
  fs.promises.rename = async (source, destination) => {
    await originalRename(source, destination);
    if (source.endsWith('.lock') && destination.includes('.released.')) {
      fs.writeFileSync(destination, JSON.stringify({ lockId: 'successor-lock', op: 'edit' }));
    }
  };
  try {
    await assert.rejects(runJiraCommand(state, 'edit', { id: draft.id, summary: 'cannot land' }), (error) => {
      assert.equal(error instanceof JiraQueueError, true);
      assert.equal(error.exitCode, EXIT.STATE_ERROR);
      assert.equal(error.message, 'edit requires pending state');
      assert.equal(error.releaseError instanceof JiraQueueError, true);
      assert.equal(error.releaseError.exitCode, EXIT.LOCK_FENCED_CLEAN);
      return true;
    });
  } finally {
    fs.promises.rename = originalRename;
  }
});

test('sidecar direct evidence blocks submit and --distinct cannot dismiss it', async () => {
  const state = makeState();
  const draft = await approvedDraft(state);
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.deadbeef.json`), JSON.stringify({
    lockId: 'deadbeef', at: new Date().toISOString(), op: 'submit', posted: true,
    wroteAfterFence: false, issueKey: 'KSTK-77', issueId: '77'
  }));
  await runJiraCommand(state, 'status');
  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.DUPLICATE);
  await assertExit(runJiraCommand(state, 'resolve', { id: draft.id, distinct: true }), EXIT.STATE_ERROR);
  assert.equal(readDraft(state, draft.id).audit.some((entry) => entry.event === 'duplicate-dismissed'), false);
  await runJiraCommand(state, 'resolve', { id: draft.id, issueKey: 'KSTK-77' });
  const resolved = readDraft(state, draft.id);
  assert.equal(resolved.state, 'submitted');
  assert.equal(resolved.result.key, 'KSTK-77');
  assert.equal(resolved.audit.at(-1).event, 'duplicate-acknowledged');
});

test('draft, show, approve, installation dry-run, live submit, and list form a complete lifecycle', async () => {
  let issuePosts = 0;
  let metadataCalls = 0;
  const state = makeState(async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/issuetypes')) {
      metadataCalls += 1;
      return Response.json({ issueTypes: [{ id: '10001', name: 'Task' }], isLast: true });
    }
    if (pathname.endsWith('/issuetypes/10001')) {
      metadataCalls += 1;
      return Response.json({ fields: [{ fieldId: 'labels', required: false }], isLast: true });
    }
    if (pathname.endsWith('/issue')) {
      issuePosts += 1;
      return Response.json({ id: '400', key: 'KSTK-400' }, { status: 201 });
    }
    return Response.json({}, { status: 404 });
  }, { jira: { dryRun: true } });
  const draft = await pendingDraft(state);
  const frozen = await runJiraCommand(state, 'show', { id: draft.id });
  assert.equal(metadataCalls, 2);
  assert.match(frozen.canonicalPayload, /kstack-draft-/);
  await runJiraCommand(state, 'show', { id: draft.id });
  assert.equal(metadataCalls, 2, 'show is idempotent after freeze');
  await runJiraCommand(state, 'approve', { id: draft.id, payloadHash: frozen.payloadSha256 });
  const dry = await runJiraCommand(state, 'submit', { id: draft.id });
  assert.equal(dry.dryRun, true);
  assert.equal(issuePosts, 0);
  const live = await runJiraCommand(state, 'submit', { id: draft.id, live: true });
  assert.equal(issuePosts, 1);
  assert.equal(live.draft.state, 'submitted');
  assert.equal(live.draft.result.key, 'KSTK-400');
  const listed = await runJiraCommand(state, 'list', { state: 'submitted' });
  assert.deepEqual(listed.map((item) => item.id), [draft.id]);
});

test('submit config drift is exit 8 and creates no attempt', async () => {
  const state = makeState();
  const draft = await approvedDraft(state);
  state.jira.siteUrl = 'https://different.atlassian.net';
  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.CONFIG_DRIFT);
  assert.equal(readDraft(state, draft.id).attempts.length, 0);
});

test('draft and edit reject malformed Unicode with exit 13', async () => {
  const state = makeState();
  await assertExit(runJiraCommand(state, 'draft', { project: 'KSTK', issueType: 'Task', summary: 'bad\uD800' }), EXIT.MALFORMED_CONTENT);
  const draft = await pendingDraft(state);
  await assertExit(runJiraCommand(state, 'edit', { id: draft.id, description: 'bad\uD800' }), EXIT.MALFORMED_CONTENT);
});

test('dry-run reports malformed persisted draft content with exit 13', async () => {
  const state = makeState();
  const draft = await approvedDraft(state);
  draft.content.summary = 'bad\uD800';
  writeDraft(state, draft);
  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.MALFORMED_CONTENT);
});

test('create response and fetch-error classification is exhaustive and conservative', async () => {
  const cases = [
    [Response.json({ id: '1', key: 'KSTK-1' }, { status: 201 }), 'submitted', 'success'],
    [Response.json({}, { status: 201 }), 'unknown', 'ambiguous'],
    [new Response('', { status: 302 }), 'unknown', 'ambiguous'],
    [Response.json({}, { status: 400 }), 'failed', 'failed'],
    [Response.json({}, { status: 401 }), 'failed', 'failed'],
    [Response.json({}, { status: 403 }), 'failed', 'failed'],
    [Response.json({}, { status: 404 }), 'failed', 'failed'],
    [Response.json({}, { status: 408 }), 'unknown', 'ambiguous'],
    [Response.json({}, { status: 429 }), 'unknown', 'ambiguous'],
    [Response.json({}, { status: 422 }), 'failed', 'failed'],
    [Response.json({}, { status: 500 }), 'unknown', 'ambiguous']
  ];
  for (const [response, expectedState, expectedOutcome] of cases) {
    const result = await classifyCreateResponse(response);
    assert.equal(result.state, expectedState);
    assert.equal(result.outcome, expectedOutcome);
  }
  assert.equal(classifyFetchError(Object.assign(new TypeError('dns'), { cause: { code: 'ENOTFOUND' } })).state, 'failed');
  assert.equal(classifyFetchError(Object.assign(new TypeError('reset'), { cause: { code: 'ECONNRESET' } })).state, 'unknown');
  assert.equal(classifyFetchError(new TypeError('unclear undici failure')).state, 'unknown');
});

test('submitting crash recovery without a sidecar uses reconcile-from-unknown zero-match semantics', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.state = 'submitting';
  draft.attempts.push({ attemptId: 'attempt-d', lockId: 'crashed-lock', startedAt: new Date().toISOString(), outcome: 'in-flight' });
  writeDraft(state, draft);
  await runJiraCommand(state, 'reconcile', { id: draft.id });
  const recovered = readDraft(state, draft.id);
  assert.equal(recovered.state, 'approved');
  assert.equal(recovered.attempts.at(-1).outcome, 'ambiguous');
  assert.equal(recovered.audit.some((entry) => entry.event === 'reconcile-clear'), true);
});

test('matching posted:false sidecar recovers as aborted-before-post', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.state = 'submitting';
  draft.attempts.push({ attemptId: 'attempt-safe', lockId: 'old-lock', startedAt: new Date().toISOString(), outcome: 'in-flight' });
  writeDraft(state, draft);
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.old-lock.json`), JSON.stringify({
    lockId: 'old-lock', attemptId: 'attempt-safe', at: new Date().toISOString(), op: 'submit', posted: false,
    wroteAfterFence: true, responseClass: 'aborted-before-post'
  }));
  await runJiraCommand(state, 'reconcile', { id: draft.id });
  const recovered = readDraft(state, draft.id);
  assert.equal(recovered.state, 'approved');
  assert.equal(recovered.attempts.at(-1).outcome, 'aborted-before-post');
});

test('covered aborted-before-post does not retire a separate lock-broken submit marker', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.state = 'submitting';
  draft.attempts.push({ attemptId: 'covered-attempt', lockId: 'covered-lock', startedAt: new Date().toISOString(), outcome: 'in-flight' });
  writeDraft(state, draft);
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.covered-lock.json`), JSON.stringify({
    lockId: 'covered-lock', attemptId: 'covered-attempt', at: new Date().toISOString(), op: 'submit', posted: false,
    wroteAfterFence: true, responseClass: 'aborted-before-post'
  }));
  await runJiraCommand(state, 'reconcile', { id: draft.id });

  const recovered = readDraft(state, draft.id);
  recovered.audit.push({
    auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: 'separate-lock', op: 'submit'
  });
  writeDraft(state, recovered);

  const status = await runJiraCommand(state, 'status');
  assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, true);
  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.INDEX_LAG_BLOCKED);
  const blocked = readDraft(state, draft.id);
  assert.equal(blocked.state, 'approved');
  assert.equal(blocked.attempts.length, 1);
  assert.equal(blocked.audit.at(-1).event, 'verify-inconclusive');
});

test('covered aborted-before-post alone is status-clean and submit skips pre-send verification', async () => {
  let searchCalls = 0;
  const searchMock = jiraSearchMock([]);
  const state = makeState(async (url, options) => {
    if (new URL(url).pathname.endsWith('/search/jql')) searchCalls += 1;
    return searchMock(url, options);
  });
  const draft = await approvedDraft(state);
  draft.state = 'submitting';
  draft.attempts.push({ attemptId: 'clean-attempt', lockId: 'clean-lock', startedAt: new Date().toISOString(), outcome: 'in-flight' });
  writeDraft(state, draft);
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.clean-lock.json`), JSON.stringify({
    lockId: 'clean-lock', attemptId: 'clean-attempt', at: new Date().toISOString(), op: 'submit', posted: false,
    wroteAfterFence: true, responseClass: 'aborted-before-post'
  }));
  await runJiraCommand(state, 'reconcile', { id: draft.id });

  const recovered = readDraft(state, draft.id);
  const recovery = recovered.audit.find((entry) => entry.event === 'submit-recovered');
  assert.equal(recovery.attemptId, 'clean-attempt');
  assert.equal(recovery.lockId, 'clean-lock');
  assert.equal(recovery.recovery, 'aborted-before-post');
  const status = await runJiraCommand(state, 'status');
  assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, false);
  const result = await runJiraCommand(state, 'submit', { id: draft.id, dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(searchCalls, 0);
});

test('posted:false stale-holder outcomes with missing or mismatched attemptId remain unresolved', async () => {
  for (const [name, staleAttemptId] of [['missing', undefined], ['mismatched', 'different-attempt']]) {
    const state = makeState();
    const draft = await approvedDraft(state);
    draft.audit.push({
      auditId: cryptoRandom(), event: 'stale-holder-outcome', at: new Date().toISOString(), lockId: `${name}-lock`,
      ...(staleAttemptId ? { attemptId: staleAttemptId } : {}), posted: false
    });
    draft.audit.push({
      auditId: cryptoRandom(), event: 'submit-recovered', at: new Date().toISOString(), lockId: `${name}-lock`,
      attemptId: 'covered-attempt', recovery: 'aborted-before-post'
    });
    writeDraft(state, draft);

    const status = await runJiraCommand(state, 'status');
    assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, true, name);
  }
});

test('posted:false without explicit aborted-before-post evidence remains ambiguous', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.state = 'submitting';
  draft.attempts.push({ attemptId: 'attempt-unsafe-false', lockId: 'unsafe-lock', startedAt: new Date().toISOString(), outcome: 'in-flight' });
  writeDraft(state, draft);
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.unsafe-lock.json`), JSON.stringify({
    lockId: 'unsafe-lock', attemptId: 'attempt-unsafe-false', at: new Date().toISOString(), op: 'submit', posted: false,
    wroteAfterFence: false, responseClass: 'retry-backoff'
  }));
  await runJiraCommand(state, 'reconcile', { id: draft.id });
  assert.equal(readDraft(state, draft.id).attempts.at(-1).outcome, 'ambiguous');
});

test('matching posted:true sidecars recover key evidence or preserve ambiguity without a key', async () => {
  for (const withKey of [true, false]) {
    const state = makeState(jiraSearchMock([]));
    const draft = await approvedDraft(state);
    draft.state = 'submitting';
    draft.attempts.push({ attemptId: 'attempt-posted', lockId: 'posted-lock', startedAt: new Date().toISOString(), outcome: 'in-flight' });
    writeDraft(state, draft);
    fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.posted-lock.json`), JSON.stringify({
      lockId: 'posted-lock', attemptId: 'attempt-posted', at: new Date().toISOString(), op: 'submit',
      posted: true, wroteAfterFence: false, ...(withKey ? { issueKey: 'KSTK-101', issueId: '101' } : {})
    }));
    if (withKey) await assertExit(runJiraCommand(state, 'reconcile', { id: draft.id }), EXIT.DUPLICATE);
    else await runJiraCommand(state, 'reconcile', { id: draft.id });
    const recovered = readDraft(state, draft.id);
    assert.equal(recovered.attempts.at(-1).outcome, withKey ? 'success' : 'ambiguous');
    assert.equal(recovered.state, withKey ? 'submitted' : 'approved');
  }
});

test('mismatched sidecar cannot cover the in-flight row', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.state = 'submitting';
  draft.attempts.push({ attemptId: 'attempt-current', lockId: 'current-lock', startedAt: new Date().toISOString(), outcome: 'in-flight' });
  writeDraft(state, draft);
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.old-lock.json`), JSON.stringify({
    lockId: 'old-lock', attemptId: 'attempt-old', at: new Date().toISOString(), op: 'submit', posted: false, wroteAfterFence: true
  }));
  await runJiraCommand(state, 'reconcile', { id: draft.id });
  assert.equal(readDraft(state, draft.id).attempts.at(-1).outcome, 'ambiguous');
});

test('trigger (e) is surfaced by status and satisfied by reconcile verify', async () => {
  const state = makeState(jiraSearchMock(['KSTK-9']));
  const draft = await approvedDraft(state);
  draft.state = 'submitted';
  draft.result = { id: '9', key: 'KSTK-9', url: 'https://fixture.atlassian.net/browse/KSTK-9' };
  draft.attempts.push({ attemptId: 'attempt-e', lockId: 'lock-e', startedAt: new Date().toISOString(), outcome: 'success' });
  draft.audit.push({ auditId: cryptoRandom(), event: 'retry-backoff', at: new Date().toISOString(), waitMs: 1, httpStatus: 429 });
  writeDraft(state, draft);
  const status = await runJiraCommand(state, 'status');
  assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, true);
  await runJiraCommand(state, 'reconcile', { id: draft.id, verify: true });
  assert.equal(readDraft(state, draft.id).audit.at(-1).event, 'verify-confirmed');
});

test('retry-then-success performs trigger (e) inline verification', async () => {
  let posts = 0;
  const state = makeState(async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/issue')) {
      posts += 1;
      if (posts === 1) return Response.json({}, { status: 429, headers: { 'Retry-After': '0' } });
      return Response.json({ id: '222', key: 'KSTK-222' }, { status: 201 });
    }
    return jiraSearchMock(['KSTK-222'])(url);
  });
  const draft = await approvedDraft(state);
  const result = await runJiraCommand(state, 'submit', { id: draft.id });
  assert.equal(posts, 2);
  assert.equal(result.draft.state, 'submitted');
  assert.equal(readDraft(state, draft.id).audit.at(-1).event, 'verify-confirmed');
});

test('trigger (e) remains pending after inline zero-match to cover later index visibility', async () => {
  let posts = 0;
  const state = makeState(async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/issue')) {
      posts += 1;
      return posts === 1
        ? Response.json({}, { status: 429, headers: { 'Retry-After': '0' } })
        : Response.json({ id: '223', key: 'KSTK-223' }, { status: 201 });
    }
    return jiraSearchMock([])(url);
  });
  const draft = await approvedDraft(state);
  await runJiraCommand(state, 'submit', { id: draft.id });
  const status = await runJiraCommand(state, 'status');
  assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, true);
});

test('submit refuses an approved draft while trigger (e) is still inside the index-lag interval', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.audit.push({ auditId: cryptoRandom(), event: 'retry-backoff', at: new Date().toISOString(), waitMs: 0, httpStatus: 429 });
  writeDraft(state, draft);
  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.STATE_ERROR);
  assert.equal(readDraft(state, draft.id).attempts.length, 0);
});

test('a retried invocation cannot become definitely failed after an ambiguous 429', async () => {
  let posts = 0;
  const state = makeState(async (url) => {
    if (new URL(url).pathname.endsWith('/issue')) {
      posts += 1;
      if (posts === 1) return Response.json({}, { status: 429, headers: { 'Retry-After': '0' } });
      throw Object.assign(new TypeError('connection refused'), { cause: { code: 'ECONNREFUSED' } });
    }
    return jiraSearchMock([])(url);
  });
  const draft = await approvedDraft(state);
  const result = await runJiraCommand(state, 'submit', { id: draft.id });
  assert.equal(result.draft.state, 'unknown');
  assert.equal(result.draft.attempts.at(-1).outcome, 'ambiguous');
});

function cryptoRandom() {
  return `${Date.now()}-${Math.random()}`;
}

test('Retry-After above the willingness cap is abandoned and maxAttempts counts total POSTs', async () => {
  let posts = 0;
  const state = makeState(async (url) => {
    if (new URL(url).pathname.endsWith('/issue')) {
      posts += 1;
      return Response.json({}, { status: 429, headers: { 'Retry-After': '100' } });
    }
    return jiraSearchMock([])(url);
  }, { jira: { maxAttempts: 1 } });
  const draft = await approvedDraft(state);
  const result = await runJiraCommand(state, 'submit', { id: draft.id });
  assert.equal(posts, 1);
  assert.equal(result.draft.state, 'unknown');
  assert.equal(result.draft.attempts.at(-1).outcome, 'ambiguous');
});

test('truncated polls and completed zero matches have distinct result kinds', async () => {
  const state = makeState(jiraSearchMock([]), {
    poll: { minimumProbes: 3, minimumDurationMs: 100, maximumProbes: 10, maximumDurationMs: 2 }
  });
  const draft = await pendingDraft(state);
  const truncated = await boundedSearch(state, { email: 'queue-tester@example.com', token: 'x' }, draft);
  assert.equal(truncated.kind, 'inconclusive');
  assert.equal(truncated.complete, false);
  assert.ok(truncated.probes < 3);

  const completedState = makeState(jiraSearchMock([]));
  const completedDraft = await pendingDraft(completedState);
  const completed = await boundedSearch(completedState, { email: 'queue-tester@example.com', token: 'x' }, completedDraft);
  assert.equal(completed.kind, 'matches');
  assert.equal(completed.complete, true);
  assert.deepEqual(completed.keys, []);
});

test('slow first poll probe cannot burst the remaining probes', async () => {
  const probeStarts = [];
  let searchCalls = 0;
  const state = makeState(async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/mypermissions')) {
      return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
    }
    if (pathname.endsWith('/search/jql')) {
      probeStarts.push(Date.now());
      searchCalls += 1;
      if (searchCalls === 1) await new Promise((resolve) => setTimeout(resolve, 80));
      return Response.json({ issues: [], isLast: true });
    }
    return Response.json({}, { status: 404 });
  }, {
    poll: { minimumProbes: 3, minimumDurationMs: 60, maximumProbes: 10, maximumDurationMs: 500 }
  });
  const draft = await pendingDraft(state);
  const result = await boundedSearch(state, { email: 'queue-tester@example.com', token: 'x' }, draft);
  assert.equal(result.kind, 'matches');
  assert.equal(probeStarts.length, 3);
  assert.ok(probeStarts[2] - probeStarts[1] >= 15, `remaining probes were only ${probeStarts[2] - probeStarts[1]}ms apart`);
});

test('explicit verify-clear retires old search markers but not direct evidence', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.state = 'submitted';
  draft.result = { key: 'KSTK-10', id: '10', url: 'https://fixture.atlassian.net/browse/KSTK-10' };
  draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date(Date.now() - 60000).toISOString(), lockId: 'old', op: 'submit' });
  writeDraft(state, draft);
  await runJiraCommand(state, 'reconcile', { id: draft.id, verify: true });
  const verified = readDraft(state, draft.id);
  assert.equal(verified.audit.at(-1).event, 'verify-clear');
  const status = await runJiraCommand(state, 'status');
  assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, false);
});

test('same-lag explicit verification cannot clear a marker younger than 30 seconds', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.state = 'submitted';
  draft.result = { key: 'KSTK-11', id: '11', url: 'https://fixture.atlassian.net/browse/KSTK-11' };
  draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: 'fresh', op: 'submit' });
  writeDraft(state, draft);
  await runJiraCommand(state, 'reconcile', { id: draft.id, verify: true });
  assert.equal(readDraft(state, draft.id).audit.at(-1).event, 'verify-inconclusive');
  const status = await runJiraCommand(state, 'status');
  assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, true);
});

test('pre-mutation duplicate gate uses the injected clock on both sides of the 30-second boundary', async () => {
  const markerTime = Date.now();
  let clockTime = markerTime + 29999;
  class InjectedClock extends Date {
    constructor(...args) { super(args.length ? args[0] : clockTime); }
  }
  const state = makeState(jiraSearchMock([]));
  state.clock = InjectedClock;
  const draft = await approvedDraft(state, { approvedAt: new InjectedClock().toISOString() });
  draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date(markerTime).toISOString(), lockId: 'clocked', op: 'submit' });
  writeDraft(state, draft);

  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.INDEX_LAG_BLOCKED);
  assert.equal(readDraft(state, draft.id).audit.at(-1).event, 'verify-inconclusive');

  clockTime = markerTime + 30000;
  await runJiraCommand(state, 'unfreeze', { id: draft.id });
  const cleared = readDraft(state, draft.id);
  assert.equal(cleared.state, 'pending');
  assert.equal(cleared.audit.some((entry) => entry.event === 'verify-clear' && entry.minimumMarkerAgeMs === 30000), true);
});

test('pre-mutation duplicate gate blocks a marker with a missing timestamp', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await approvedDraft(state);
  draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', lockId: 'malformed-time', op: 'submit' });
  writeDraft(state, draft);

  // A malformed timestamp makes age unmeasurable, not young/retryable index lag.
  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
  const blocked = readDraft(state, draft.id);
  assert.equal(blocked.state, 'approved');
  assert.equal(blocked.audit.at(-1).event, 'verify-inconclusive');
  assert.equal(blocked.audit.at(-1).reason, 'marker-age-unmeasurable');
  assert.equal(blocked.audit.some((entry) => entry.event === 'verify-clear'), false);
});

test('pre-mutation duplicate gate distinguishes measurable index lag from unmeasurable marker age', async () => {
  const now = Date.now();
  class FixedClock extends Date {
    constructor(...args) { super(args.length ? args[0] : now); }
  }
  const cases = [
    {
      name: 'parseable marker below the floor',
      markerAt: new Date(now - 29999).toISOString(),
      exitCode: EXIT.INDEX_LAG_BLOCKED,
      auditReason: 'marker-younger-than-index-lag-minimum'
    },
    {
      name: 'unparseable marker age',
      markerAt: 'not-a-timestamp',
      exitCode: EXIT.STATE_ERROR,
      auditReason: 'marker-age-unmeasurable'
    }
  ];

  for (const { name, markerAt, exitCode, auditReason } of cases) {
    const state = makeState(jiraSearchMock([]));
    state.clock = FixedClock;
    const draft = await approvedDraft(state, { approvedAt: new FixedClock().toISOString() });
    draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: markerAt, lockId: name, op: 'submit' });
    writeDraft(state, draft);

    await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), exitCode);
    const blocked = readDraft(state, draft.id);
    assert.equal(blocked.state, 'approved', name);
    assert.equal(blocked.audit.at(-1).reason, auditReason, name);
  }
});

test('pre-mutation duplicate gate treats a future marker timestamp as unmeasurable', async () => {
  const now = Date.now();
  class FixedClock extends Date {
    constructor(...args) { super(args.length ? args[0] : now); }
  }
  const state = makeState(jiraSearchMock([]));
  state.clock = FixedClock;
  const draft = await approvedDraft(state, { approvedAt: new FixedClock().toISOString() });
  draft.audit.push({
    auditId: cryptoRandom(),
    event: 'lock-broken',
    at: new Date(now + 60000).toISOString(),
    lockId: 'future-marker',
    op: 'submit'
  });
  writeDraft(state, draft);

  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
  const blocked = readDraft(state, draft.id);
  assert.equal(blocked.state, 'approved');
  assert.equal(blocked.audit.at(-1).event, 'verify-inconclusive');
  assert.equal(blocked.audit.at(-1).reason, 'marker-age-unmeasurable');
  assert.equal(blocked.audit.some((entry) => entry.event === 'verify-clear'), false);
});

test('runVerification keeps unparseable and future-dated markers inconclusive', async () => {
  const now = Date.now();
  class FixedClock extends Date {
    constructor(...args) { super(args.length ? args[0] : now); }
  }
  const cases = [
    { name: 'unparseable marker', markerAt: 'not-a-timestamp' },
    { name: 'future-dated marker', markerAt: new Date(now + 60000).toISOString() }
  ];

  for (const { name, markerAt } of cases) {
    const state = makeState(jiraSearchMock([]));
    state.clock = FixedClock;
    const draft = await approvedDraft(state, { approvedAt: new FixedClock().toISOString() });
    draft.audit.push({
      auditId: cryptoRandom(),
      event: 'lock-broken',
      at: markerAt,
      lockId: 'direct-verification',
      op: 'submit'
    });
    writeDraft(state, draft);
    const lock = await acquireDraftLock(state, draft.id, 'reconcile', { disableHeartbeat: true });
    try {
      const result = await runVerification(lock, draft, {
        email: 'queue-tester@example.com',
        token: 'local-fixture-token-never-sent'
      }, { explicit: true });
      assert.equal(result.exitCode, EXIT.OK, name);
      assert.equal(result.clear, false, name);
      assert.equal(result.inconclusive, true, name);
      const verified = readDraft(state, draft.id);
      assert.equal(verified.audit.at(-1).event, 'verify-inconclusive', name);
      assert.equal(verified.audit.at(-1).reason, 'marker-age-unmeasurable', name);
      assert.equal(verified.audit.some((entry) => entry.event === 'verify-clear'), false, name);
    } finally {
      await releaseDraftLock(lock);
    }
  }
});

test('unfreeze explicitly clears every frozen field', async () => {
  const state = makeState();
  const draft = await approvedDraft(state);
  await runJiraCommand(state, 'unfreeze', { id: draft.id });
  const unfrozen = readDraft(state, draft.id);
  assert.equal(unfrozen.state, 'pending');
  for (const field of ['canonicalPayload', 'payloadSha256', 'configFingerprint', 'approvedAt']) assert.equal(unfrozen[field], null);
});

test('discard reports the dedicated exit while blocked pending Jira search-index lag', async () => {
  const state = makeState(jiraSearchMock([]));
  const draft = await pendingDraft(state);
  draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: 'discard-lag', op: 'submit' });
  writeDraft(state, draft);

  await assertExit(runJiraCommand(state, 'discard', { id: draft.id }), EXIT.INDEX_LAG_BLOCKED);
  assert.equal(readDraft(state, draft.id).state, 'pending');
});

test('pre-mutation duplicate gate keeps poll exhaustion and search failure at exit 2', async () => {
  const cases = [
    {
      name: 'poll exhaustion',
      fetchImpl: jiraSearchMock([]),
      overrides: { poll: { minimumProbes: 2, minimumDurationMs: 100, maximumProbes: 1, maximumDurationMs: 100 } },
      auditEvent: 'verify-inconclusive'
    },
    {
      name: 'search failure',
      fetchImpl: async (url) => {
        if (new URL(url).pathname.endsWith('/mypermissions')) {
          return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
        }
        return Response.json({}, { status: 500 });
      },
      overrides: {},
      auditEvent: 'verify-network-failed'
    }
  ];

  for (const { name, fetchImpl, overrides, auditEvent } of cases) {
    const state = makeState(fetchImpl, overrides);
    const draft = await approvedDraft(state);
    draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: name, op: 'submit' });
    writeDraft(state, draft);

    await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
    assert.equal(readDraft(state, draft.id).audit.at(-1).event, auditEvent, name);
  }
});

test('approval TTL expiry creates no attempt row', async () => {
  const state = makeState();
  const draft = await approvedDraft(state, { approvedAt: new Date(Date.now() - 90000000).toISOString() });
  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.APPROVAL_EXPIRED);
  const expired = readDraft(state, draft.id);
  assert.equal(expired.attempts.length, 0);
  assert.equal(expired.audit.at(-1).event, 'approval-expired');
});

test('queue-wide status skips held drafts and continues sweeping others', async () => {
  const state = makeState();
  const heldDraft = await pendingDraft(state);
  const freeDraft = await pendingDraft(state);
  const lock = await acquireDraftLock(state, heldDraft.id, 'edit');
  fs.writeFileSync(path.join(state.queueDir, `${freeDraft.id}.lock.tmp.crashed`), '{}');
  const old = new Date(Date.now() - 100000);
  fs.utimesSync(path.join(state.queueDir, `${freeDraft.id}.lock.tmp.crashed`), old, old);
  const status = await runJiraCommand(state, 'status');
  assert.deepEqual(status.sweep.held, [heldDraft.id]);
  assert.equal(status.sweep.swept.includes(freeDraft.id), true);
  assert.equal(fs.existsSync(path.join(state.queueDir, `${freeDraft.id}.lock.tmp.crashed`)), false);
  await releaseDraftLock(lock);
});

test('janitor folding is idempotent and classifies released leftovers', async () => {
  const state = makeState();
  const draft = await pendingDraft(state);
  draft.audit.push({ auditId: cryptoRandom(), event: 'stale-holder-outcome', at: new Date().toISOString(), lockId: 'same', posted: false });
  writeDraft(state, draft);
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.same.json`), JSON.stringify({ lockId: 'same', op: 'edit', posted: false, wroteAfterFence: false }));
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.released.clean.json`), JSON.stringify({ lockId: 'clean', op: 'edit' }));
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.released.raced.json`), JSON.stringify({ lockId: 'different', op: 'submit' }));
  await runJiraCommand(state, 'status');
  const folded = readDraft(state, draft.id);
  assert.equal(folded.audit.filter((entry) => entry.event === 'stale-holder-outcome' && entry.lockId === 'same').length, 1);
  assert.equal(folded.audit.some((entry) => entry.event === 'lock-released-late' && entry.lockId === 'clean'), true);
  assert.equal(folded.audit.some((entry) => entry.event === 'lock-break-race'), true);
});

test('janitor audit writes use the shared sanitizer for Basic-auth-shaped evidence', async () => {
  const state = makeState();
  const draft = await pendingDraft(state);
  const encoded = 'dXNlckBleGFtcGxlLmNvbTpvcGFxdWUtdG9rZW4=';
  fs.writeFileSync(path.join(state.queueDir, `${draft.id}.orphan.redact.json`), JSON.stringify({
    lockId: 'redact', op: 'submit', posted: true, wroteAfterFence: false,
    responseClass: `Authorization: Basic ${encoded}`
  }));
  await runJiraCommand(state, 'status');
  const persisted = fs.readFileSync(draftFile(state, draft.id), 'utf8');
  assert.doesNotMatch(persisted, new RegExp(encoded));
  assert.match(persisted, /Basic \[REDACTED\]/);
});

test('resolve entry state (c) supports all source states and both attestations', async () => {
  for (const stateName of ['pending', 'approved', 'failed']) {
    for (const distinct of [false, true]) {
      const state = makeState();
      const draft = await approvedDraft(state);
      draft.state = stateName;
      if (stateName === 'failed') draft.attempts.push({ attemptId: 'failed-row', lockId: 'failed-lock', startedAt: new Date().toISOString(), outcome: 'failed' });
      draft.audit.push({ auditId: cryptoRandom(), event: 'duplicate-detected', at: new Date().toISOString(), keys: ['KSTK-55'], directEvidence: false });
      writeDraft(state, draft);
      await runJiraCommand(state, 'resolve', { id: draft.id, ...(distinct ? { distinct: true } : { issueKey: 'KSTK-55' }) });
      const resolved = readDraft(state, draft.id);
      assert.equal(resolved.state, distinct ? stateName : 'submitted');
      assert.equal(resolved.audit.at(-1).event, distinct ? 'duplicate-dismissed' : 'duplicate-acknowledged');
      if (stateName === 'failed') assert.deepEqual(resolved.attempts.map((attempt) => attempt.attemptId), ['failed-row']);
    }
  }
});

test('resolve --distinct still dismisses search-derived duplicate candidates', async () => {
  const state = makeState();
  const draft = await approvedDraft(state);
  draft.audit.push({ auditId: cryptoRandom(), event: 'duplicate-detected', at: new Date().toISOString(), keys: ['KSTK-56'], directEvidence: false });
  writeDraft(state, draft);
  await runJiraCommand(state, 'resolve', { id: draft.id, distinct: true });
  const resolved = readDraft(state, draft.id);
  assert.equal(resolved.state, 'approved');
  assert.deepEqual(resolved.audit.at(-1).dismissedKeys, ['KSTK-56']);
});

test('late direct evidence on discarded and unknown drafts has a resolution path', async () => {
  for (const stateName of ['discarded', 'unknown']) {
    const state = makeState();
    const draft = await approvedDraft(state);
    draft.state = stateName;
    draft.audit.push({ auditId: cryptoRandom(), event: 'duplicate-detected', at: new Date().toISOString(), keys: ['KSTK-88'], directEvidence: true });
    writeDraft(state, draft);
    await runJiraCommand(state, 'resolve', { id: draft.id, issueKey: 'KSTK-88' });
    const resolved = readDraft(state, draft.id);
    assert.equal(resolved.state, stateName === 'unknown' ? 'submitted' : 'discarded');
    assert.equal(resolved.audit.at(-1).event, 'duplicate-acknowledged');
  }
});

test('doctor asserts site identity, warns on issue-security schemes, and smoke-tests search cursor pagination', async () => {
  const calls = [];
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ pathname: parsed.pathname, method: options.method || 'GET', body: options.body ? JSON.parse(Buffer.from(options.body).toString('utf8')) : null });
    if (parsed.pathname.endsWith('/myself')) return Response.json({ emailAddress: process.env.KSTACK_TEST_JIRA_EMAIL.toUpperCase(), accountId: 'acct' });
    if (parsed.pathname.endsWith('/mypermissions')) return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
    if (parsed.pathname.endsWith('/project/KSTK')) return Response.json({ id: '10000', key: 'KSTK' });
    if (parsed.pathname.endsWith('/issuesecurityschemes/project')) return Response.json({ values: [{ id: '1', name: 'Restricted' }] });
    if (parsed.pathname.endsWith('/issuetypes')) return Response.json({ issueTypes: [{ id: '10001', name: 'Task' }], isLast: true });
    if (parsed.pathname.endsWith('/issuetypes/10001')) return Response.json({ fields: [{ fieldId: 'labels', required: false }], isLast: true });
    if (parsed.pathname.endsWith('/search/jql')) {
      const body = JSON.parse(Buffer.from(options.body).toString('utf8'));
      return body.nextPageToken
        ? Response.json({ issues: [], isLast: true })
        : Response.json({ issues: [], isLast: false, nextPageToken: 'cursor-2' });
    }
    return Response.json({}, { status: 404 });
  });
  const report = await runJiraCommand(state, 'doctor');
  assert.equal(report.checks.some((check) => check.check === 'site-identity' && check.ok), true);
  assert.equal(report.warnings.some((warning) => /necessary but not sufficient/.test(warning)), true);
  const searches = calls.filter((call) => call.pathname.endsWith('/search/jql'));
  assert.equal(searches.length, 2);
  assert.equal(searches.every((call) => call.method === 'POST'), true);
  assert.equal(searches[1].body.nextPageToken, 'cursor-2');
});

test('doctor warns and reports accountId when Jira hides /myself emailAddress', async () => {
  const state = makeState(async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/myself')) return Response.json({ accountId: 'hidden-email-account' });
    if (parsed.pathname.endsWith('/mypermissions')) return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
    if (parsed.pathname.endsWith('/project/KSTK')) return Response.json({ id: '10000', key: 'KSTK' });
    if (parsed.pathname.endsWith('/issuesecurityschemes/project')) return Response.json({ values: [] });
    if (parsed.pathname.endsWith('/issuetypes')) return Response.json({ issueTypes: [{ id: '10001', name: 'Task' }], isLast: true });
    if (parsed.pathname.endsWith('/issuetypes/10001')) return Response.json({ fields: [{ fieldId: 'labels', required: false }], isLast: true });
    if (parsed.pathname.endsWith('/search/jql')) return Response.json({ issues: [], isLast: true });
    return Response.json({}, { status: 404 });
  });

  const report = await runJiraCommand(state, 'doctor');
  assert.deepEqual(report.checks.find((check) => check.check === 'site-identity'), {
    check: 'site-identity', accountId: 'hidden-email-account'
  });
  assert.equal(report.warnings.some((warning) => /email visibility is hidden site-wide/.test(warning)), true);
});

test('credential file symlinks are rejected before any credential read', async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-config-'));
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-secret-'));
  const credential = path.join(externalRoot, 'credential.json');
  const symlink = path.join(externalRoot, 'credential-link.json');
  fs.writeFileSync(credential, JSON.stringify({ email: 'queue-tester@example.com', token: 'opaque-token' }), { mode: 0o600 });
  fs.symlinkSync(credential, symlink);
  const config = structuredClone(defaultConfig);
  config.jira.enabled = true;
  config.jira.siteUrl = 'https://fixture.atlassian.net';
  config.jira.credentialSource = { type: 'file', path: symlink, allowInsecurePermissions: false };
  fs.mkdirSync(path.join(repoRoot, '.kstack'), { recursive: true });
  const configPath = path.join(repoRoot, '.kstack', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config));
  await assertExit(loadJiraState({ configPath }), EXIT.CONFIG_INVALID);
});

test('offline draft does not require an available or valid credential file', async () => {
  for (const condition of ['missing', 'unreadable', 'malformed']) {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), `kstack-jira-offline-${condition}-`));
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), `kstack-jira-credential-${condition}-`));
    const credential = path.join(externalRoot, 'credential.json');
    if (condition === 'unreadable') fs.writeFileSync(credential, '{}', { mode: 0o000 });
    if (condition === 'malformed') fs.writeFileSync(credential, '{"email":"partial-secret",', { mode: 0o600 });
    if (condition === 'missing') assert.equal(fs.existsSync(credential), false);
    const config = structuredClone(defaultConfig);
    config.jira.enabled = true;
    config.jira.siteUrl = 'https://fixture.atlassian.net';
    config.jira.credentialSource = { type: 'file', path: credential, allowInsecurePermissions: false };
    fs.mkdirSync(path.join(repoRoot, '.kstack'), { recursive: true });
    const configPath = path.join(repoRoot, '.kstack', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config));

    const state = await loadJiraState({ configPath, command: 'draft' });
    const draft = await runJiraCommand(state, 'draft', { summary: `${condition} credential` });
    assert.equal(draft.content.summary, `${condition} credential`);
  }
});

test('offline draft rejects a lexically inside-repository credential path without accessing it', async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-offline-inside-'));
  const credential = path.join(repoRoot, '.secrets', 'missing-credential.json');
  const config = structuredClone(defaultConfig);
  config.jira.enabled = true;
  config.jira.siteUrl = 'https://fixture.atlassian.net';
  config.jira.credentialSource = { type: 'file', path: credential, allowInsecurePermissions: false };
  fs.mkdirSync(path.join(repoRoot, '.kstack'), { recursive: true });
  const configPath = path.join(repoRoot, '.kstack', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config));
  assert.equal(fs.existsSync(credential), false);

  await assert.rejects(loadJiraState({ configPath, command: 'draft' }), (error) => {
    assert.equal(error instanceof JiraQueueError, true);
    assert.equal(error.exitCode, EXIT.CONFIG_INVALID);
    assert.match(error.message, /jira\.credentialSource\.path must resolve outside the repository/);
    assert.doesNotMatch(error.message, /ENOENT/);
    return true;
  });
});

test('credential content validation remains deferred to commands that need credentials', async () => {
  const state = makeState();
  const approved = await approvedDraft(state);
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-bad-credential-'));
  const credential = path.join(externalRoot, 'credential.json');
  fs.writeFileSync(credential, '{"token":"partial-secret",', { mode: 0o600 });
  state.jira.credentialSource = { type: 'file', path: credential, allowInsecurePermissions: false };
  await assert.rejects(runJiraCommand(state, 'doctor'), (error) => {
    assert.equal(error instanceof JiraQueueError, true);
    assert.equal(error.exitCode, EXIT.CONFIG_INVALID);
    assert.equal(error.message, 'credential file is invalid JSON');
    assert.doesNotMatch(error.message, /partial-secret/);
    return true;
  });
  await assert.rejects(runJiraCommand(state, 'submit', { id: approved.id, dryRun: true }), (error) => {
    assert.equal(error instanceof JiraQueueError, true);
    assert.equal(error.exitCode, EXIT.CONFIG_DRIFT);
    assert.equal(error.message, 'could not re-resolve credentials: credential file is invalid JSON');
    assert.doesNotMatch(error.message, /partial-secret/);
    return true;
  });

  fs.writeFileSync(credential, JSON.stringify({ email: 'queue-tester@example.com' }), { mode: 0o600 });
  await assert.rejects(runJiraCommand(state, 'doctor'), (error) => {
    assert.equal(error.exitCode, EXIT.CONFIG_INVALID);
    assert.equal(error.message, 'credential file must contain exactly email and token');
    return true;
  });
});

test('descriptor-bound credential validation rejects a path swap after open', async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-repo-'));
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-swap-'));
  const credential = path.join(externalRoot, 'credential.json');
  const displaced = path.join(externalRoot, 'credential.displaced.json');
  const replacement = path.join(externalRoot, 'replacement.json');
  fs.writeFileSync(credential, JSON.stringify({ email: 'first@example.com', token: 'first-token' }), { mode: 0o600 });
  fs.writeFileSync(replacement, JSON.stringify({ email: 'second@example.com', token: 'second-token' }), { mode: 0o600 });
  const handle = await fs.promises.open(credential, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    fs.renameSync(credential, displaced);
    fs.renameSync(replacement, credential);
    await assertExit(
      validateCredentialFileHandle({ type: 'file', path: credential, allowInsecurePermissions: false }, repoRoot, handle),
      EXIT.CONFIG_INVALID
    );
  } finally {
    await handle.close();
  }
});

test('credential FIFO sources fail fast before open', { skip: process.platform === 'win32' }, async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-fifo-repo-'));
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kstack-jira-fifo-secret-'));
  const fifo = path.join(externalRoot, 'credential.fifo');
  await execFileAsync('mkfifo', [fifo]);
  const moduleUrl = pathToFileURL(path.resolve('plugins/kstack/scripts/kstack-jira.mjs')).href;
  const childSource = `
    import { EXIT, resolveCredentials } from ${JSON.stringify(moduleUrl)};
    const state = {
      repoRoot: ${JSON.stringify(repoRoot)},
      jira: { credentialSource: { type: 'file', path: ${JSON.stringify(fifo)}, allowInsecurePermissions: false } }
    };
    try {
      await resolveCredentials(state);
      process.exitCode = 2;
    } catch (error) {
      if (error.exitCode !== EXIT.CONFIG_INVALID) throw error;
    }
  `;
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  await execFileAsync(process.execPath, ['--input-type=module', '--eval', childSource], { timeout: 2000, env: childEnv });
});

test('credential hardening warning identifies degraded platforms and missing ownership checks', () => {
  const source = { type: 'file', path: '/outside/credential.json' };
  const degraded = credentialHardeningWarnings(source, 'win32', undefined);
  assert.equal(degraded.length, 1);
  assert.match(degraded[0], /hardening is reduced on win32/);
  assert.match(degraded[0], /ownership cannot be verified/);
  assert.deepEqual(credentialHardeningWarnings(source, 'linux', () => 1000), []);
  assert.deepEqual(credentialHardeningWarnings({ type: 'env' }, 'win32', undefined), []);
});

test('verification fails clearly if a search-capable path lacks resolved credentials', async () => {
  const state = makeState();
  const draft = await pendingDraft(state);
  const lock = await acquireDraftLock(state, draft.id, 'reconcile', { disableHeartbeat: true });
  try {
    await assert.rejects(runVerification(lock, draft, null), (error) => {
      assert.equal(error instanceof JiraQueueError, true);
      assert.equal(error.exitCode, EXIT.CONFIG_INVALID);
      assert.equal(error.message, 'verification requires resolved Jira credentials when no direct evidence is present');
      return true;
    });
  } finally {
    await releaseDraftLock(lock);
  }
});

test('ambiguous-history override remains independent from duplicate dismissal', async () => {
  const state = makeState();
  const draft = await approvedDraft(state);
  draft.state = 'failed';
  draft.attempts.push({ attemptId: 'ambiguous-old', lockId: 'lock-old', startedAt: new Date().toISOString(), outcome: 'ambiguous' });
  draft.audit.push({ auditId: cryptoRandom(), event: 'duplicate-detected', at: new Date().toISOString(), keys: ['KSTK-333'] });
  writeDraft(state, draft);
  await runJiraCommand(state, 'resolve', { id: draft.id, distinct: true });
  await assertExit(runJiraCommand(state, 'discard', { id: draft.id }), EXIT.AMBIGUOUS_HISTORY);
  await runJiraCommand(state, 'discard', { id: draft.id, acknowledgeAmbiguousHistory: true });
  assert.equal(readDraft(state, draft.id).state, 'discarded');
});

test('lock-holding implementation contains no synchronous blocking primitives and exit inventory has no collisions', () => {
  const source = fs.readFileSync(path.resolve('plugins/kstack/scripts/kstack-jira.mjs'), 'utf8');
  assert.doesNotMatch(source, /\b(?:spawnSync|execSync|Atomics\.wait|sleepSync)\b/);
  assert.equal(EXIT.STATE_ERROR, 2);
  assert.equal(EXIT.INDEX_LAG_BLOCKED, 20);
  assert.deepEqual(Object.values(EXIT).sort((a, b) => a - b), [0, 1, 2, 3, 6, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.equal(Object.values(EXIT).some((code) => code >= 10 && code <= 12), false);
});

test('futimes heartbeat primitive is visible through path stat', async () => {
  const state = makeState();
  const draft = await pendingDraft(state);
  const lock = await acquireDraftLock(state, draft.id, 'status', { disableHeartbeat: true });
  const before = fs.statSync(lock.paths.lock).mtimeMs;
  const later = new Date(before + 2000);
  await lock.handle.utimes(later, later);
  const after = fs.statSync(lock.paths.lock).mtimeMs;
  assert.ok(after > before);
  await releaseDraftLock(lock);
});
