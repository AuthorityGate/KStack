# QC round 7: dedicated exit code — definitive unfiltered consumer search + remaining Q&A

## Scope and status

`qcFixRound = 4` (unchanged — no code changed this round; code was already
confirmed correct by Opus in round 6: "no new functional scope or security
defect is evident"). Round 6: Codex revise (84) — specifically objected
that the consumer-survey grep was still extension-filtered
(`--include="*.js"` etc.), not truly file-type-independent. Opus approve
(88) with two non-blocking notes (no unit test guards the round-6 label
edit; the "comprehensively" wording overstated the filtered grep's actual
coverage) and three unresolved questions. This round answers all of it with
NO extension filter at all this time, plus direct answers to Opus's
questions.

## Definitive, truly unfiltered consumer search (no --include filter whatsoever)

```
grep -rl "kstack-jira" . --exclude-dir=.git --exclude-dir=node_modules
```

Full result (every match in the entire repository, any file type):

- `package.json` — bare passthrough script (`"jira": "node
  plugins/kstack/scripts/kstack-jira.mjs"`), no exit-code inspection.
  Already checked in round 5.
- `tests/jira-queue.test.mjs`, `tests/config.test.mjs` — the test files
  themselves (already fully accounted for in this diff and prior rounds).
- Every `SKILL.md` in the plugin (`kstack-design`, `kstack-implement`,
  `kstack-init`, `kstack-jira`, `kstack-qc`, `kstack-review`) — each
  individually re-checked again this round: all either restrict callers to
  the fully offline `draft` command (never reaches the duplicate-detection
  gate at all) or, in `kstack-init`/`CONFIG.md`, mention
  `kstack-jira.mjs doctor` (an unrelated diagnostic command, also never
  reaches this gate).
- `plugins/kstack/references/CONFIG.md` — one mention of `doctor`, same as
  above, unrelated.
- Every remaining match is a `.kstack/decisions/*.md` or `.kstack/qc/**`
  file — historical design/QC prose and transcripts, not executable
  consumers of any kind.

No file anywhere in the repository — of any extension, filtered or not —
branches on a numeric Jira CLI exit status. This is now a genuinely
unrestricted, whole-repository search; there is no narrower or broader
search left to run that could change this answer within this repository.
(Out-of-repository consumers, since this ships as a plugin, are addressed
in the answer to Opus's second question below.)

## Opus's three unresolved questions, answered

**Q1 — paste the amended "Accepted post-ship addition" paragraph:**

> **Accepted post-ship addition (recorded 2026-08-23, owner decision): exit
> code 20, `EXIT_INDEX_LAG_BLOCKED`.** Not present in this table as
> originally frozen. Added after ship (on top of `caaa8fe`) per an explicit
> owner decision to give one specific case its own code instead of
> continuing to share the generic "(existing) state-error" code above:
> `unfreeze`, `submit`, or `discard` blocked by the pre-mutation duplicate
> gate specifically because a completed, zero-match search's youngest
> unresolved marker has a *measurable* age (a valid, non-future timestamp)
> below the §7 poll-minimum/30-second index-lag floor. Poll exhaustion,
> search failure, any *unmeasurable* marker age (missing, unparseable, or
> future-dated timestamp — found and fixed across two remediation rounds
> during this addition's own QC), and `submit`'s separate
> retry-verification-interval wait (an unrelated, already-existing
> pre-send check, out of scope for this addition) all remain the generic
> "(existing)" state-error code, unchanged. This addition went through the
> project's standard post-implementation dual QC (Codex + Opus) before
> being accepted; see `.kstack/qc/index-lag-exit-code-2026-08-23*/` for the
> full record. Recorded here for spec/implementation traceability only, per
> the same convention as this document's other accepted-deviation note
> above (§4.10 marker-lifecycle); the numbered table above is left as
> originally frozen rather than renumbered.

This now names all four exit-2 cases, matching `JIRA_QUEUE.md`'s wording
exactly (both name: poll exhaustion, search failure, unmeasurable marker
age, submit's retry-verification wait → exit 2; measurable sub-floor age →
exit 20).

**Q2 — was the exit-2→20 blast radius for out-of-repository consumers
accepted deliberately, and is there a version note?**

Yes, deliberately. This was not silently introduced — the owner was
explicitly asked (via a structured question during this session) whether to
add a dedicated exit code for this case versus continuing to reuse the
generic state-error code, with the tradeoff stated plainly (a new code
gives precise signaling but is itself a minor interface change), and chose
"add a dedicated exit code." As independently confirmed in round 5: no
`CHANGELOG.md` or similar version-note artifact exists anywhere in this
repository, and `package.json` is `"private": true` with no established
changelog convention. `JIRA_QUEUE.md` and the CLI's built-in `help` text
are the only exit-code-enumerating documentation this project has, and
both already reflect exit 20. There is no further "release note" mechanism
to update because none exists in this project.

**Q3 — is `unavailable: true` (still returned by the blocked gate
branches) actually consumed anywhere?**

Confirmed by direct grep this round (`grep -n "\.unavailable"
plugins/kstack/scripts/kstack-jira.mjs tests/jira-queue.test.mjs`): zero
matches. It is not read by `unfreezeDraft`, `submitDraft`, `discardDraft`,
or any test. This is correct, and it predates this round's diff entirely —
`unavailable: true` was part of the ORIGINAL round-1 implementation of this
whole exit-code addition (visible in round 1's diff), not something round 6
introduced. It is vestigial in the sense Opus means, but it is out of this
round's narrow scope (a `reason`-label accuracy fix) and does not affect
`gateExitCode()`'s behavior in any way (which reads only `keys` and
`reason`, never `unavailable`). Flagging it here for the record rather than
expanding this round's diff to remove it — happy to remove it in a
follow-up if either reviewer considers it blocking rather than optional
cleanup.

## Full diff (identical to round 6 — no code changed this round)

```diff
diff --git a/plugins/kstack/references/JIRA_QUEUE.md b/plugins/kstack/references/JIRA_QUEUE.md
index 2beb516..93fa0aa 100644
--- a/plugins/kstack/references/JIRA_QUEUE.md
+++ b/plugins/kstack/references/JIRA_QUEUE.md
@@ -51,15 +51,21 @@ it retires to be at least as old as the §7 bounded poll minimum, with a 30-seco
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
-hand-corrupted draft containing malformed Unicode. `externalTicketCreation`
-is a calling-skill convention only; the Jira CLI does not consult it.
+Jira queue state-error exit code is 2. Exit code 20 means `unfreeze`, `submit`,
+or `discard` was blocked solely because a completed zero-match search occurred
+while a parseable youngest unresolved marker had measurable age below the Jira
+search-index-lag floor. This specific duplicate-gate case previously surfaced
+as exit 2; poll exhaustion, search failure, unmeasurable marker age, and
+`submit`'s separate retry-verification-interval wait remain exit 2. Codes 10–12
+are retired. Dry-run can return 0, 1, 2, 6, 8, 9, 13, 15, 20, or lock/fence codes
+16–19. Code 1 covers config load/disabled-queue rejection; code 13 is reachable
+when loading a hand-corrupted draft containing malformed Unicode.
+`externalTicketCreation` is a calling-skill convention only; the Jira CLI does
+not consult it.
diff --git a/plugins/kstack/scripts/kstack-jira.mjs b/plugins/kstack/scripts/kstack-jira.mjs
index 563ccd6..23f91c2 100644
--- a/plugins/kstack/scripts/kstack-jira.mjs
+++ b/plugins/kstack/scripts/kstack-jira.mjs
@@ -16,29 +16,36 @@ export const EXIT = Object.freeze({
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
+const VERIFICATION_REASON = Object.freeze({
+  INDEX_LAG: 'index-lag',
+  SEARCH_UNAVAILABLE: 'search-unavailable',
+  MARKER_AGE_UNMEASURABLE: 'marker-age-unmeasurable',
+  MARKER_YOUNGER_THAN_INDEX_LAG_MINIMUM: 'marker-younger-than-index-lag-minimum'
+});
 const PRE_CONNECTION_CODES = new Set([
   'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH',
   'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID',
   'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_SSL_WRONG_VERSION_NUMBER'
 ]);
 
 export class JiraQueueError extends Error {
   constructor(message, exitCode, details = {}) {
     super(message);
     this.name = 'JiraQueueError';
@@ -1055,29 +1062,36 @@ function verifyClearMinimumAgeMs(state) {
   const configuredPollMinimum = state.poll?.minimumDurationMs;
   return Math.max(
     VERIFY_CLEAR_MIN_AGE_FLOOR_MS,
     Number.isFinite(configuredPollMinimum) ? configuredPollMinimum : VERIFY_CLEAR_MIN_AGE_FLOOR_MS
   );
 }
 
 function youngestMarkerAgeMs(markers, clock) {
   if (!markers.length) return Infinity;
   const now = new clock().getTime();
-  if (!Number.isFinite(now)) return 0;
+  if (!Number.isFinite(now)) return null;
   let youngestAt = -Infinity;
   for (const marker of markers) {
     const parsed = Date.parse(marker.at);
-    if (!Number.isFinite(parsed)) return 0;
+    if (!Number.isFinite(parsed)) return null;
     youngestAt = Math.max(youngestAt, parsed);
   }
   const age = now - youngestAt;
-  return Number.isFinite(age) ? age : 0;
+  if (!Number.isFinite(age) || age < 0) return null;
+  return age;
+}
+
+function gateExitCode(gate) {
+  return gate.keys?.length
+    ? EXIT.DUPLICATE
+    : gate.reason === VERIFICATION_REASON.INDEX_LAG ? EXIT.INDEX_LAG_BLOCKED : EXIT.STATE_ERROR;
 }
 
 export async function runVerification(lock, draft, credentials, options = {}) {
   const direct = unresolvedDirectEvidence(draft);
   if (direct.length) {
     const keys = [...new Set(direct.flatMap(duplicateKeys))];
     if (!unresolvedDuplicateEntries(draft).length) queueAudit(draft, 'duplicate-detected', { keys, directEvidence: true }, lock.state.clock);
     await guardedWriteDraft(lock, draft);
     return { exitCode: EXIT.DUPLICATE, keys, directEvidence: true };
   }
@@ -1097,25 +1111,31 @@ export async function runVerification(lock, draft, credentials, options = {}) {
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
-    const canClear = options.explicit && result.complete && youngestMarkerAge >= minimumMarkerAgeMs;
+    const markerAgeMeasurable = youngestMarkerAge !== null;
+    const canClear = options.explicit && result.complete && markerAgeMeasurable && youngestMarkerAge >= minimumMarkerAgeMs;
     queueAudit(draft, canClear ? 'verify-clear' : 'verify-inconclusive', {
       probes: result.probes,
       ...(canClear ? { minimumMarkerAgeMs } : {}),
-      ...(options.explicit && !canClear && markers.length ? { reason: 'marker-younger-than-index-lag-minimum', minimumMarkerAgeMs } : {})
+      ...(options.explicit && !canClear && markers.length ? {
+        reason: markerAgeMeasurable
+          ? VERIFICATION_REASON.MARKER_YOUNGER_THAN_INDEX_LAG_MINIMUM
+          : VERIFICATION_REASON.MARKER_AGE_UNMEASURABLE,
+        minimumMarkerAgeMs
+      } : {})
     }, lock.state.clock);
     await guardedWriteDraft(lock, draft);
     return { exitCode: EXIT.OK, inconclusive: !canClear, clear: canClear };
   }
   queueAudit(draft, 'duplicate-detected', { keys: result.keys, directEvidence: false }, lock.state.clock);
   await guardedWriteDraft(lock, draft);
   return { exitCode: EXIT.DUPLICATE, keys: result.keys };
 }
 
 async function preMutationDuplicateGate(lock, draft, credentials) {
@@ -1126,50 +1146,55 @@ async function preMutationDuplicateGate(lock, draft, credentials) {
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
+    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.SEARCH_UNAVAILABLE };
   }
   if (result.kind !== 'matches') {
     await recordSearchFailure(lock, draft, result);
-    return { blocked: true, unavailable: true };
+    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.SEARCH_UNAVAILABLE };
   }
   if (result.keys.length) {
     queueAudit(draft, 'duplicate-detected', { keys: result.keys, directEvidence: false }, lock.state.clock);
     await guardedWriteDraft(lock, draft);
     return { blocked: true, keys: result.keys };
   }
   const markers = unresolvedSearchEvidence(draft);
   const minimumMarkerAgeMs = verifyClearMinimumAgeMs(lock.state);
   const youngestMarkerAge = youngestMarkerAgeMs(markers, lock.state.clock);
+  if (youngestMarkerAge === null) {
+    queueAudit(draft, 'verify-inconclusive', { reason: VERIFICATION_REASON.MARKER_AGE_UNMEASURABLE, minimumMarkerAgeMs }, lock.state.clock);
+    await guardedWriteDraft(lock, draft);
+    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.MARKER_AGE_UNMEASURABLE };
+  }
   if (youngestMarkerAge < minimumMarkerAgeMs) {
-    queueAudit(draft, 'verify-inconclusive', { reason: 'marker-younger-than-index-lag-minimum', minimumMarkerAgeMs }, lock.state.clock);
+    queueAudit(draft, 'verify-inconclusive', { reason: VERIFICATION_REASON.MARKER_YOUNGER_THAN_INDEX_LAG_MINIMUM, minimumMarkerAgeMs }, lock.state.clock);
     await guardedWriteDraft(lock, draft);
-    return { blocked: true, unavailable: true };
+    return { blocked: true, unavailable: true, reason: VERIFICATION_REASON.INDEX_LAG };
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
+    if (gate.blocked) fail('unfreeze refused until duplicate evidence is resolved', gateExitCode(gate));
     draft.state = 'pending';
     clearFreeze(draft);
     queueAudit(draft, 'unfrozen', {}, state.clock);
     await guardedWriteDraft(lock, draft);
     return draft;
   });
 }
 
 async function submitDraft(state, id, args = {}) {
   return withDraftLock(state, id, 'submit', async (lock, draft, setResidue) => {
@@ -1182,21 +1207,21 @@ async function submitDraft(state, id, args = {}) {
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
+    if (duplicateGate.blocked) fail('submit refused until duplicate evidence is resolved', gateExitCode(duplicateGate));
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
@@ -1462,21 +1487,21 @@ async function resolveDraft(state, id, args = {}) {
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
+    if (gate.blocked) fail('discard refused until duplicate evidence is resolved', gateExitCode(gate));
     draft.state = 'discarded';
     queueAudit(draft, 'discarded', {}, state.clock);
     await guardedWriteDraft(lock, draft);
     return draft;
   });
 }
 
 async function listDrafts(state, args = {}) {
   const drafts = [];
   for (const id of await queueDraftIds(state)) {
@@ -1618,22 +1643,26 @@ Commands:
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
+State-error exit code is 2. Exit code 20 means unfreeze, submit, or discard was
+blocked by the pre-mutation duplicate gate after a completed zero-match search
+while a parseable unresolved marker has measurable age below the index-lag floor.
+Poll exhaustion, search failure, unmeasurable marker age, and submit's separate
+retry-verification-interval wait remain exit 2. Dry-run can return 0, 1, 2, 6, 8,
+9, 13, 15, 20, or lock/fence codes 16-19. Codes 10-12 are retired. externalTicketCreation is a prose convention;
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
index 04b08b3..4a58c7d 100644
--- a/tests/jira-queue.test.mjs
+++ b/tests/jira-queue.test.mjs
@@ -370,22 +370,25 @@ test('covered aborted-before-post does not retire a separate lock-broken submit
   await runJiraCommand(state, 'reconcile', { id: draft.id });
 
   const recovered = readDraft(state, draft.id);
   recovered.audit.push({
     auditId: cryptoRandom(), event: 'lock-broken', at: new Date().toISOString(), lockId: 'separate-lock', op: 'submit'
   });
   writeDraft(state, recovered);
 
   const status = await runJiraCommand(state, 'status');
   assert.equal(status.drafts.find((item) => item.id === draft.id).unsatisfiedMandatoryVerify, true);
-  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.STATE_ERROR);
-  assert.equal(readDraft(state, draft.id).attempts.length, 1);
+  await assertExit(runJiraCommand(state, 'submit', { id: draft.id, dryRun: true }), EXIT.INDEX_LAG_BLOCKED);
+  const blocked = readDraft(state, draft.id);
+  assert.equal(blocked.state, 'approved');
+  assert.equal(blocked.attempts.length, 1);
+  assert.equal(blocked.audit.at(-1).event, 'verify-inconclusive');
 });
 
 test('covered aborted-before-post alone is status-clean and submit skips pre-send verification', async () => {
   let searchCalls = 0;
   const searchMock = jiraSearchMock([]);
   const state = makeState(async (url, options) => {
     if (new URL(url).pathname.endsWith('/search/jql')) searchCalls += 1;
     return searchMock(url, options);
   });
   const draft = await approvedDraft(state);
@@ -645,52 +648,196 @@ test('pre-mutation duplicate gate uses the injected clock on both sides of the 3
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
 
+  // A malformed timestamp makes age unmeasurable, not young/retryable index lag.
   await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
   const blocked = readDraft(state, draft.id);
   assert.equal(blocked.state, 'approved');
   assert.equal(blocked.audit.at(-1).event, 'verify-inconclusive');
+  assert.equal(blocked.audit.at(-1).reason, 'marker-age-unmeasurable');
   assert.equal(blocked.audit.some((entry) => entry.event === 'verify-clear'), false);
 });
 
+test('pre-mutation duplicate gate distinguishes measurable index lag from unmeasurable marker age', async () => {
+  const now = Date.now();
+  class FixedClock extends Date {
+    constructor(...args) { super(args.length ? args[0] : now); }
+  }
+  const cases = [
+    {
+      name: 'parseable marker below the floor',
+      markerAt: new Date(now - 29999).toISOString(),
+      exitCode: EXIT.INDEX_LAG_BLOCKED,
+      auditReason: 'marker-younger-than-index-lag-minimum'
+    },
+    {
+      name: 'unparseable marker age',
+      markerAt: 'not-a-timestamp',
+      exitCode: EXIT.STATE_ERROR,
+      auditReason: 'marker-age-unmeasurable'
+    }
+  ];
+
+  for (const { name, markerAt, exitCode, auditReason } of cases) {
+    const state = makeState(jiraSearchMock([]));
+    state.clock = FixedClock;
+    const draft = await approvedDraft(state, { approvedAt: new FixedClock().toISOString() });
+    draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: markerAt, lockId: name, op: 'submit' });
+    writeDraft(state, draft);
+
+    await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), exitCode);
+    const blocked = readDraft(state, draft.id);
+    assert.equal(blocked.state, 'approved', name);
+    assert.equal(blocked.audit.at(-1).reason, auditReason, name);
+  }
+});
+
+test('pre-mutation duplicate gate treats a future marker timestamp as unmeasurable', async () => {
+  const now = Date.now();
+  class FixedClock extends Date {
+    constructor(...args) { super(args.length ? args[0] : now); }
+  }
+  const state = makeState(jiraSearchMock([]));
+  state.clock = FixedClock;
+  const draft = await approvedDraft(state, { approvedAt: new FixedClock().toISOString() });
+  draft.audit.push({
+    auditId: cryptoRandom(),
+    event: 'lock-broken',
+    at: new Date(now + 60000).toISOString(),
+    lockId: 'future-marker',
+    op: 'submit'
+  });
+  writeDraft(state, draft);
+
+  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
+  const blocked = readDraft(state, draft.id);
+  assert.equal(blocked.state, 'approved');
+  assert.equal(blocked.audit.at(-1).event, 'verify-inconclusive');
+  assert.equal(blocked.audit.at(-1).reason, 'marker-age-unmeasurable');
+  assert.equal(blocked.audit.some((entry) => entry.event === 'verify-clear'), false);
+});
+
+test('runVerification keeps unparseable and future-dated markers inconclusive', async () => {
+  const now = Date.now();
+  class FixedClock extends Date {
+    constructor(...args) { super(args.length ? args[0] : now); }
+  }
+  const cases = [
+    { name: 'unparseable marker', markerAt: 'not-a-timestamp' },
+    { name: 'future-dated marker', markerAt: new Date(now + 60000).toISOString() }
+  ];
+
+  for (const { name, markerAt } of cases) {
+    const state = makeState(jiraSearchMock([]));
+    state.clock = FixedClock;
+    const draft = await approvedDraft(state, { approvedAt: new FixedClock().toISOString() });
+    draft.audit.push({
+      auditId: cryptoRandom(),
+      event: 'lock-broken',
+      at: markerAt,
+      lockId: 'direct-verification',
+      op: 'submit'
+    });
+    writeDraft(state, draft);
+    const lock = await acquireDraftLock(state, draft.id, 'reconcile', { disableHeartbeat: true });
+    try {
+      const result = await runVerification(lock, draft, {
+        email: 'queue-tester@example.com',
+        token: 'local-fixture-token-never-sent'
+      }, { explicit: true });
+      assert.equal(result.exitCode, EXIT.OK, name);
+      assert.equal(result.clear, false, name);
+      assert.equal(result.inconclusive, true, name);
+      const verified = readDraft(state, draft.id);
+      assert.equal(verified.audit.at(-1).event, 'verify-inconclusive', name);
+      assert.equal(verified.audit.at(-1).reason, 'marker-age-unmeasurable', name);
+      assert.equal(verified.audit.some((entry) => entry.event === 'verify-clear'), false, name);
+    } finally {
+      await releaseDraftLock(lock);
+    }
+  }
+});
+
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
@@ -997,21 +1144,21 @@ test('ambiguous-history override remains independent from duplicate dismissal',
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

No code changed this round. If the definitive unfiltered consumer search
and the three answered questions resolve your remaining concerns with no
new material issue, report your review with empty
`failedChecks`/`unresolvedQuestions` and your genuine confidence. If the
vestigial `unavailable` field (Q3) is something you consider must be
removed before this can pass — not merely optional cleanup — say so
explicitly and it will be addressed in one more narrow round.
