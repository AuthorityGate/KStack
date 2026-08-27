# QC: dedicated exit code for "blocked pending Jira search-index lag"

## Scope

Small, narrowly-scoped change to `plugins/kstack/scripts/kstack-jira.mjs` (the
already-shipped, QC-passed Jira ticket-queue feature, commit `caaa8fe`). This
is public-contract work (the CLI's exit-code inventory) on a security-adjacent
path (the duplicate-detection pre-mutation gate), so per `kstack-qc/SKILL.md`
it requires both Codex and Opus — the implementer may be one of them but
self-review alone does not pass.

## Objective (owner-approved decision)

`preMutationDuplicateGate()` previously collapsed three distinct "cannot
proceed right now" outcomes into the same `{ blocked: true, unavailable: true }`
shape, so callers (`unfreeze`, `submit`, `discard`) all exited generic
`EXIT.STATE_ERROR` (2) regardless of which one occurred:

1. bounded search poll exhausted before completing;
2. the search itself failed (network/parse/schema failure);
3. the search completed cleanly with zero matches, but the youngest
   unresolved marker is younger than the 30-second index-lag floor
   (`VERIFY_CLEAR_MIN_AGE_FLOOR_MS`) — i.e. blocked ONLY because we haven't
   waited long enough for Jira's search index to catch up.

The owner explicitly decided (2026-08-23, AskUserQuestion) that case 3 should
get its own dedicated exit code rather than continuing to share exit 2 with
cases 1-2. This QC verifies that decision was implemented correctly and
narrowly, with no unintended side effects.

## What must be true

- `EXIT.INDEX_LAG_BLOCKED = 20` added. Values 10-12 remain a retired range
  that must never be reused; every other existing exit code's meaning is
  unchanged.
- `preMutationDuplicateGate()` tags its `unavailable: true` return with
  `reason: 'search-unavailable'` (cases 1-2) or `reason: 'index-lag'`
  (case 3) — no other field or return shape changed.
- The three call sites (`unfreezeDraft`, `submitDraft`, `discardDraft`) select
  `EXIT.INDEX_LAG_BLOCKED` only when `reason === 'index-lag'`; cases 1-2 still
  exit `EXIT.STATE_ERROR` (2) exactly as before.
- No duplicate-detection, polling, marker-age-floor, or verification LOGIC
  changed anywhere — this task is exit-code selection only.
- Tests updated/added to cover: the index-lag case now exits 20 (submit,
  unfreeze, discard); poll-exhaustion and search-failure cases still exit 2
  (explicit negative coverage, not just assumed); the exit-code inventory
  self-test (`lock-holding implementation contains no synchronous blocking
  primitives and exit inventory has no collisions`) updated to include 20 and
  still assert 10-12 stay absent.
- Documentation (`plugins/kstack/references/JIRA_QUEUE.md`, the CLI's built-in
  `help` text in `kstack-jira.mjs`) updated to describe exit 20 accurately and
  note which prior "unavailable" cases still map to exit 2.
- The approved spec file
  (`.kstack/decisions/jira-ticket-queue-final-spec-2026-08-17.md`) was
  deliberately NOT edited by the implementer for this change — that file is
  being amended separately (already done, see the diff below) to record a
  different, unrelated accepted deviation. Confirm the implementer's diff
  really does leave that file alone (it does — see the diff).

## Verification evidence (implementer-reported, re-run required if you doubt it)

The implementer (Codex, `-c model_reasoning_effort=high`) reported running
`npm test` from the repo root after the change and observed:

```
> kstack@0.1.0 test
> node --test tests/*.test.mjs

✔ tests/config.test.mjs
✔ tests/design-gate.test.mjs
✔ tests/dual-review.test.mjs
✔ tests/jira-queue.test.mjs
✔ tests/memory-remote.test.mjs
✔ tests/memory.test.mjs
✔ tests/provider-runner.test.mjs
✔ tests/role-invocation.test.mjs
✔ tests/setup.test.mjs
ℹ tests 9
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

(This is 9 test *files* reporting all-pass at the `node --test` file-suite
level; `tests/jira-queue.test.mjs` alone contains 60+ individual test cases,
several of which were touched by this diff and are shown in full below.)

## Full diff (complete, no elision — every changed line across all 3 files)

```diff
diff --git a/plugins/kstack/references/JIRA_QUEUE.md b/plugins/kstack/references/JIRA_QUEUE.md
index 2beb516..f5e2d3e 100644
--- a/plugins/kstack/references/JIRA_QUEUE.md
+++ b/plugins/kstack/references/JIRA_QUEUE.md
@@ -51,15 +51,19 @@ it retires to be at least as old as the §7 bounded poll minimum, with a 30-seco
 floor. Direct evidence is never retired by `verify-clear`.
 An inline zero-match after a 429 retry remains an unsatisfied trigger-(e)
 marker: `status` continues to surface it until a later explicit verify clears
 or confirms it, and another `submit` is refused while it remains unsatisfied.
 This prevents the immediate check from overclaiming coverage when the earlier
 issue indexes later. `reconcile --verify` is accepted on an `approved` draft
 for this recovery-only condition.
 Queue-wide `status` and `reconcile` sweeps use skip-held-and-continue: held
 drafts are reported while other drafts and artifacts are still processed.
 
-Jira queue state-error exit code is 2. Codes 10–12 are retired. Dry-run can
-return 0, 1, 2, 6, 8, 9, 13, 15, or lock/fence codes 16–19. Code 1 covers
-config load/disabled-queue rejection; code 13 is reachable when loading a
+Jira queue state-error exit code is 2. Exit code 20 means `unfreeze`, `submit`,
+or `discard` was blocked solely because a completed zero-match search occurred
+before the youngest unresolved marker reached the Jira search-index-lag age
+floor. This specific case previously surfaced as exit 2; poll exhaustion and
+search failure remain exit 2. Codes 10–12 are retired. Dry-run can return 0, 1,
+2, 6, 8, 9, 13, 15, 20, or lock/fence codes 16–19. Code 1 covers config
+load/disabled-queue rejection; code 13 is reachable when loading a
 hand-corrupted draft containing malformed Unicode. `externalTicketCreation`
 is a calling-skill convention only; the Jira CLI does not consult it.
diff --git a/plugins/kstack/scripts/kstack-jira.mjs b/plugins/kstack/scripts/kstack-jira.mjs
index 563ccd6..e75c4e9 100644
--- a/plugins/kstack/scripts/kstack-jira.mjs
+++ b/plugins/kstack/scripts/kstack-jira.mjs
@@ -16,21 +16,22 @@ export const EXIT = Object.freeze({
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
-  LOCK_BREAK_RACE: 19
+  LOCK_BREAK_RACE: 19,
+  INDEX_LAG_BLOCKED: 20
 });
 export const LOCK_HEARTBEAT_MS = 5000;
 export const LOCK_STALE_MS = 90000;
 export const VERIFY_CLEAR_MIN_AGE_FLOOR_MS = 30000;
 
 const DRAFT_STATES = new Set(['pending', 'approved', 'submitting', 'submitted', 'failed', 'unknown', 'discarded']);
 const ATTEMPT_OUTCOMES = new Set(['in-flight', 'success', 'failed', 'ambiguous', 'aborted-before-post']);
 const RESERVED_FIELDS = new Set(['project', 'issuetype', 'summary', 'description', 'labels', 'security']);
 const PRE_CONNECTION_CODES = new Set([
   'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH',
@@ -1126,50 +1127,50 @@ async function preMutationDuplicateGate(lock, draft, credentials) {
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
-    return { blocked: true, unavailable: true };
+    return { blocked: true, unavailable: true, reason: 'search-unavailable' };
   }
   if (result.kind !== 'matches') {
     await recordSearchFailure(lock, draft, result);
-    return { blocked: true, unavailable: true };
+    return { blocked: true, unavailable: true, reason: 'search-unavailable' };
   }
   if (result.keys.length) {
     queueAudit(draft, 'duplicate-detected', { keys: result.keys, directEvidence: false }, lock.state.clock);
     await guardedWriteDraft(lock, draft);
     return { blocked: true, keys: result.keys };
   }
   const markers = unresolvedSearchEvidence(draft);
   const minimumMarkerAgeMs = verifyClearMinimumAgeMs(lock.state);
   const youngestMarkerAge = youngestMarkerAgeMs(markers, lock.state.clock);
   if (youngestMarkerAge < minimumMarkerAgeMs) {
     queueAudit(draft, 'verify-inconclusive', { reason: 'marker-younger-than-index-lag-minimum', minimumMarkerAgeMs }, lock.state.clock);
     await guardedWriteDraft(lock, draft);
-    return { blocked: true, unavailable: true };
+    return { blocked: true, unavailable: true, reason: 'index-lag' };
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
-    if (gate.blocked) fail('unfreeze refused until duplicate evidence is resolved', gate.keys?.length ? EXIT.DUPLICATE : EXIT.STATE_ERROR);
+    if (gate.blocked) fail('unfreeze refused until duplicate evidence is resolved', gate.keys?.length ? EXIT.DUPLICATE : gate.reason === 'index-lag' ? EXIT.INDEX_LAG_BLOCKED : EXIT.STATE_ERROR);
     draft.state = 'pending';
     clearFreeze(draft);
     queueAudit(draft, 'unfrozen', {}, state.clock);
     await guardedWriteDraft(lock, draft);
     return draft;
   });
 }
 
 async function submitDraft(state, id, args = {}) {
   return withDraftLock(state, id, 'submit', async (lock, draft, setResidue) => {
@@ -1182,21 +1183,21 @@ async function submitDraft(state, id, args = {}) {
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
-    if (duplicateGate.blocked) fail('submit refused until duplicate evidence is resolved', duplicateGate.keys?.length ? EXIT.DUPLICATE : EXIT.STATE_ERROR);
+    if (duplicateGate.blocked) fail('submit refused until duplicate evidence is resolved', duplicateGate.keys?.length ? EXIT.DUPLICATE : duplicateGate.reason === 'index-lag' ? EXIT.INDEX_LAG_BLOCKED : EXIT.STATE_ERROR);
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
@@ -1462,21 +1463,21 @@ async function resolveDraft(state, id, args = {}) {
 }
 
 async function discardDraft(state, id, args = {}) {
   return withDraftLock(state, id, 'discard', async (lock, draft) => {
     if (!['pending', 'failed'].includes(draft.state)) fail('discard requires pending or failed state', EXIT.STATE_ERROR);
     const ambiguous = unresolvedAmbiguousHistory(draft);
     if (ambiguous.length && !args.acknowledgeAmbiguousHistory) fail('discard refused because ambiguous submit history is unresolved', EXIT.AMBIGUOUS_HISTORY);
     if (ambiguous.length) queueAudit(draft, 'ambiguous-discard-acknowledged', { priorAmbiguousAttempts: ambiguous.map((row) => row.attemptId) }, state.clock);
     const credentials = unresolvedSearchEvidence(draft).length ? await resolveCredentials(state) : null;
     const gate = await preMutationDuplicateGate(lock, draft, credentials);
-    if (gate.blocked) fail('discard refused until duplicate evidence is resolved', gate.keys?.length ? EXIT.DUPLICATE : EXIT.STATE_ERROR);
+    if (gate.blocked) fail('discard refused until duplicate evidence is resolved', gate.keys?.length ? EXIT.DUPLICATE : gate.reason === 'index-lag' ? EXIT.INDEX_LAG_BLOCKED : EXIT.STATE_ERROR);
     draft.state = 'discarded';
     queueAudit(draft, 'discarded', {}, state.clock);
     await guardedWriteDraft(lock, draft);
     return draft;
   });
 }
 
 async function listDrafts(state, args = {}) {
   const drafts = [];
   for (const id of await queueDraftIds(state)) {
@@ -1618,22 +1619,23 @@ Commands:
 siteUrl accepts exactly one <tenant>.atlassian.net label. This is a typo/DNS-suffix
 guard, not a credential-exfiltration guard. Doctor's /rest/api/3/myself check only
 detects a wrong tenant after credentials have been transmitted, and only when doctor runs.
 BROWSE_PROJECTS is necessary but not sufficient for search visibility. Doctor warns
 about issue security schemes because project defaults, workflows, and automation can
 hide issues. maxAttempts is the total number of physical POSTs, including the first.
 verify-clear requires a completed full poll and marker age at least as long as the
 section 7 poll minimum, with a 30-second floor.
 Queue-wide status/reconcile sweeps skip locked drafts, report them, and continue.
 
-State-error exit code is 2. Dry-run can return 0, 1, 2, 6, 8, 9, 13, 15, or lock/fence
-codes 16-19. Codes 10-12 are retired. externalTicketCreation is a prose convention;
+State-error exit code is 2. Exit code 20 means a pre-mutation operation is blocked
+pending Jira search-index lag. Dry-run can return 0, 1, 2, 6, 8, 9, 13, 15, 20,
+or lock/fence codes 16-19. Codes 10-12 are retired. externalTicketCreation is a prose convention;
 the host tool-permission prompt is the authority boundary and submit does not consult it.`;
 
 function parseCli(argv) {
   const [command = 'help', maybeId, ...rest] = argv;
   const args = {};
   let index = 0;
   if (maybeId && !maybeId.startsWith('--')) args.id = maybeId;
   else if (maybeId) rest.unshift(maybeId);
   while (index < rest.length) {
     const item = rest[index++];
diff --git a/tests/jira-queue.test.mjs b/tests/jira-queue.test.mjs
index 04b08b3..5dc01e3 100644
--- a/tests/jira-queue.test.mjs
+++ b/tests/jira-queue.test.mjs
@@ -370,21 +370,21 @@ test('covered aborted-before-post does not retire a separate lock-broken submit
   await runJiraCommand(state, 'reconcile', { id: draft.id });
 
   const recovered = readDraft(state, draft.id);
   recovered.audit.push({
     auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: 'separate-lock', op: 'submit'
   });
   writeDraft(state, recovered);
 
   const status = await runJiraCommand(state, 'status');
   assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, true);
-  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.STATE_ERROR);
+  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.INDEX_LAG_BLOCKED);
   assert.equal(readDraft(state, draft.id).attempts.length, 1);
 });
 
 test('covered aborted-before-post alone is status-clean and submit skips pre-send verification', async () => {
   let searchCalls = 0;
   const searchMock = jiraSearchMock([]);
   const state = makeState(async (url, options) => {
     if (new URL(url).pathname.endsWith('/search/jql')) searchCalls += 1;
     return searchMock(url, options);
   });
@@ -645,52 +645,94 @@ test('pre-mutation duplicate gate uses the injected clock on both sides of the 3
   let clockTime = markerTime + 29999;
   class InjectedClock extends Date {
     constructor(...args) { super(args.length ? args[0] : clockTime); }
   }
   const state = makeState(jiraSearchMock([]));
   state.clock = InjectedClock;
   const draft = await approvedDraft(state, { approvedAt: new InjectedClock().toISOString() });
   draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date(markerTime).toISOString(), lockId: 'clocked', op: 'submit' });
   writeDraft(state, draft);
 
-  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
+  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.INDEX_LAG_BLOCKED);
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
 
-  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
+  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.INDEX_LAG_BLOCKED);
   const blocked = readDraft(state, draft.id);
   assert.equal(blocked.state, 'approved');
   assert.equal(blocked.audit.at(-1).event, 'verify-inconclusive');
   assert.equal(blocked.audit.some((entry) => entry.event === 'verify-clear'), false);
 });
 
 test('unfreeze explicitly clears every frozen field', async () => {
   const state = makeState();
   const draft = await approvedDraft(state);
   await runJiraCommand(state, 'unfreeze', { id: draft.id });
   const unfrozen = readDraft(state, draft.id);
   assert.equal(unfrozen.state, 'pending');
   for (const field of ['canonicalPayload', 'payloadSha256', 'configFingerprint', 'approvedAt']) assert.equal(unfrozen[field], null);
 });
 
+test('discard reports the dedicated exit while blocked pending Jira search-index lag', async () => {
+  const state = makeState(jiraSearchMock([]));
+  const draft = await pendingDraft(state);
+  draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: 'discard-lag', op: 'submit' });
+  writeDraft(state, draft);
+
+  await assertExit(runJiraCommand(state, 'discard', { id: draft.id }), EXIT.INDEX_LAG_BLOCKED);
+  assert.equal(readDraft(state, draft.id).state, 'pending');
+});
+
+test('pre-mutation duplicate gate keeps poll exhaustion and search failure at exit 2', async () => {
+  const cases = [
+    {
+      name: 'poll exhaustion',
+      fetchImpl: jiraSearchMock([]),
+      overrides: { poll: { minimumProbes: 2, minimumDurationMs: 100, maximumProbes: 1, maximumDurationMs: 100 } },
+      auditEvent: 'verify-inconclusive'
+    },
+    {
+      name: 'search failure',
+      fetchImpl: async (url) => {
+        if (new URL(url).pathname.endsWith('/mypermissions')) {
+          return Response.json({ permissions: { BROWSE_PROJECTS: { havePermission: true } } });
+        }
+        return Response.json({}, { status: 500 });
+      },
+      overrides: {},
+      auditEvent: 'verify-network-failed'
+    }
+  ];
+
+  for (const { name, fetchImpl, overrides, auditEvent } of cases) {
+    const state = makeState(fetchImpl, overrides);
+    const draft = await approvedDraft(state);
+    draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: name, op: 'submit' });
+    writeDraft(state, draft);
+
+    await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
+    assert.equal(readDraft(state, draft.id).audit.at(-1).event, auditEvent, name);
+  }
+});
+
 test('approval TTL expiry creates no attempt row', async () => {
   const state = makeState();
   const draft = await approvedDraft(state, { approvedAt: new Date(Date.now() - 90000000).toISOString() });
   await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.APPROVAL_EXPIRED);
   const expired = readDraft(state, draft.id);
   assert.equal(expired.attempts.length, 0);
   assert.equal(expired.audit.at(-1).event, 'approval-expired');
 });
 
 test('queue-wide status skips held drafts and continues sweeping others', async () => {
@@ -997,21 +1039,21 @@ test('ambiguous-history override remains independent from duplicate dismissal',
   writeDraft(state, draft);
   await runJiraCommand(state, 'resolve', { id: draft.id, distinct: true });
   await assertExit(runJiraCommand(state, 'discard', { id: draft.id }), EXIT.AMBIGUOUS_HISTORY);
   await runJiraCommand(state, 'discard', { id: draft.id, acknowledgeAmbiguousHistory: true });
   assert.equal(readDraft(state, draft.id).state, 'discarded');
 });
 
 test('lock-holding implementation contains no synchronous blocking primitives and exit inventory has no collisions', () => {
   const source = fs.readFileSync(path.resolve('plugins/kstack/scripts/kstack-jira.mjs'), 'utf8');
   assert.doesNotMatch(source, /\b(?:spawnSync|execSync|Atomics\.wait|sleepSync)\b/);
-  assert.deepEqual(Object.values(EXIT).sort((a, b) => a - b), [0, 1, 2, 3, 6, 8, 9, 13, 14, 15, 16, 17, 18, 19]);
+  assert.deepEqual(Object.values(EXIT).sort((a, b) => a - b), [0, 1, 2, 3, 6, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20]);
   assert.equal(Object.values(EXIT).some((code) => code >= 10 && code <= 12), false);
 });
 
 test('futimes heartbeat primitive is visible through path stat', async () => {
   const state = makeState();
   const draft = await pendingDraft(state);
   const lock = await acquireDraftLock(state, draft.id, 'status', { disableHeartbeat: true });
   const before = fs.statSync(lock.paths.lock).mtimeMs;
   const later = new Date(before + 2000);
   await lock.handle.utimes(later, later);
```

## Review instructions

Treat the diff above as the complete and only source of the change — nothing
was curated or excerpted out. Independently verify:

1. Read the diff's hunks against `plugins/kstack/scripts/kstack-jira.mjs`
   directly (not just the diff) if you need broader surrounding context than
   the diff's own context lines provide — the `preMutationDuplicateGate`
   function, the `EXIT` object, and the `unfreezeDraft`/`submitDraft`/
   `discardDraft` functions are all fully visible within this diff's context
   lines already.
2. Confirm the exit-code selection logic at each of the three call sites is
   correct: `gate.keys?.length ? EXIT.DUPLICATE : gate.reason === 'index-lag'
   ? EXIT.INDEX_LAG_BLOCKED : EXIT.STATE_ERROR` (or the `duplicateGate`-named
   equivalent in `submitDraft`) — does this ternary chain correctly preserve
   every pre-existing behavior for every reachable case, not just the new
   one?
3. Confirm the added/changed tests actually assert what they claim (exit
   code AND resulting audit-event/state), not just that the command didn't
   throw.
4. Confirm no scope creep: nothing about duplicate detection, the marker-age
   floor value/comparison, or the search poll changed.
5. Flag anything that should have gone back through `kstack-interrogate`
   instead of being implemented directly, if you believe the scope grew
   beyond what a clean "add a distinguishing exit code" change should touch.

Report `pass`, `fix`, `redesign`, or `block` per the standard review schema.
