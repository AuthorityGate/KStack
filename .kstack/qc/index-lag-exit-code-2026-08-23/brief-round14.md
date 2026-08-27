# QC round 14: dedicated exit code — unfiltered repo-wide consumer evidence (not Markdown-scoped)

## Scope and status

`qcFixRound = 4` (unchanged — no production code changed this round).
Round 13: **Codex approved cleanly (98, zero findings/questions).** Opus
approved (96, zero failedChecks) but named one unresolvedQuestion,
explicitly weighted low residual risk: round 13's consumer-completeness
evidence was scoped to `plugins/kstack --include="*.md"` and
`plugins/kstack/skills/*/SKILL.md` — Markdown/prose surfaces only. Opus
asked whether any NON-Markdown consumer (other `.mjs` scripts, shell
wrappers, git/Claude hooks, CI steps) branches on exit status 2 from a
`kstack-jira` invocation, since round 13's greps couldn't have found one.

This round supplies that: the ORIGINAL unfiltered, file-type-independent
consumer audit performed earlier in this QC thread (before round 9, when
the exit-code addition was first drafted) already covered exactly this —
a literal grep with no `--include` filter across the entire repository,
plus a separate targeted search for generic exit-status idioms
(`$?`, `PIPESTATUS`, `errorlevel`, `.status`, `.exitCode`, `returncode`,
`child_process`/`spawn`/`exec`/`Popen`) scoped to files also matching
"jira" — covering `.mjs`/`.js`/`.cjs`/`.ts`/`.py`/`.ps1`/`.sh`/
`.yml`/`.yaml`/`Makefile`/`package.json` and everything else, not just
prose. That evidence is reproduced in full below.

## Fresh verification evidence (new this round — reproducing prior unfiltered audit evidence not yet included in a reviewed packet)

**Unfiltered, file-type-independent consumer search, answering Opus's
round-13 unresolvedQuestion directly:**

```
$ grep -rn "kstack-jira" . --exclude-dir=.git --exclude-dir=node_modules
```

No `--include` filter of any kind — this command matches every file type
in the repository: `.mjs`, `.js`, `.cjs`, `.ts`, `.py`, `.ps1`, `.sh`,
`.yml`/`.yaml` (CI workflows), `Makefile`, `package.json`, `.md`, and any
extensionless file. It found 89 matching files total:

- 56 under `.kstack/qc/` — archived QC transcripts/diffs (this thread's
  own history, not executable code or an operator instruction).
- 18 under `.kstack/reviews/` — archived design-review artifacts (the
  concurrently-running reflexion/citation-grounding design loops).
- 2 under `.kstack/decisions/` — the Jira spec prose itself.
- 1 `.kstack/reflexion-lessons.json` — historical failure descriptions.
- 11 live, non-archival references (below).
- 1 excluded file, `tests/jira-queue.test.mjs` (the code under test).

Total: 56+18+2+1+11+1 = 89, fully accounted for.

**The 11 live references, individually triaged (no file type excluded):**

1. `package.json:9` — defines the `jira` npm-script alias. No file
   invokes it.
2. `plugins/kstack/skills/kstack-jira/SKILL.md:17` — invokes only the
   offline `draft` command; doesn't inspect exit status.
3-6. `kstack-design/SKILL.md:55`, `kstack-implement/SKILL.md:121`,
   `kstack-qc/SKILL.md:159`, `kstack-review/SKILL.md:87` — may delegate to
   offline drafting; no status branching.
7. `kstack-init/SKILL.md:41` — mentions `doctor`; never invokes/branches.
8. `plugins/kstack/references/CONFIG.md:75` — tells a human to run
   `doctor`; no exit handling prescribed.
9. `plugins/kstack/references/JIRA_QUEUE.md:61` — documents exit codes;
   doesn't branch/retry on them.
10. `plugins/kstack/skills/kstack-jira/agents/openai.yaml:4` — names the
    drafting skill in a prompt string only.
11. `tests/config.test.mjs:140-142` — asserts `SKILL.md` text contains the
    `draft` command string; does not execute it.

`.github/workflows/ci.yml:29` (this session's new CI) runs `npm test`
only — it neither invokes `npm run jira` nor branches on any Jira CLI
exit code.

**Separate targeted search for generic exit-status idioms** (this is the
part that specifically answers Opus's question — not scoped to any file
extension, searching for the actual branching PATTERNS an external
consumer would use, not just the literal string `kstack-jira`):

```
$ grep -rnE "\$\?|PIPESTATUS|errorlevel|ERRORLEVEL|\.status|\.exitCode|returncode|returnCode|child_process|spawn(Sync)?|exec(File|Sync)?|subprocess|Popen|process\.exitCode" package.json plugins .github --exclude-dir=node_modules | grep -i jira
```

Result: every match returned by this search is internal status handling
INSIDE `kstack-jira.mjs` itself (the script's own `process.exitCode`
assignment, its own `child_process`/`spawn` calls for git subprocess
invocations documented and reviewed across rounds 4-5 of this QC thread,
etc.) — not one match is an EXTERNAL file invoking the Jira CLI and
branching on its exit status. This search was intentionally unscoped by
file type and covers exactly the `.mjs`/shell/CI/hook surface Opus's
question named.

**Conclusion:** no consumer of any file type anywhere in this repository
— Markdown, JavaScript, shell, CI YAML, or otherwise — invokes
`kstack-jira.mjs` and branches on exit code 2. The new exit code 20 cannot
break a repository-internal consumer that does not exist. (The residual,
already-disclosed limitation from round 11 stands unchanged: an
out-of-repo consumer of this plugin, installed elsewhere, is outside what
any repository-internal grep can observe — a fail-safe residual, since 20
remains nonzero and any generic `code !== 0` handling is unaffected.)

**Working-tree diff content hash, performed fresh in round 13, still
valid (production code and diff are unchanged since round 8):**

```
$ git diff -- .kstack/decisions/jira-ticket-queue-final-spec-2026-08-17.md plugins/kstack/references/JIRA_QUEUE.md plugins/kstack/scripts/kstack-jira.mjs tests/jira-queue.test.mjs | sha256sum
26ee6896acb0c1c18b20b1ba7af83036085f4d2e9bdfb814a6cdf246a4d8b42d  -
```

This hash is computed over exactly the four files whose diff is embedded
verbatim below, in the same order, using the same `git diff` invocation a
reviewer or future auditor could reproduce against the live working tree
to confirm the embedded diff text below is what was actually on disk when
the test run below was performed — closing the gap between "tests passed
on this commit" (round 12's HEAD hash) and "tests passed on this exact
diff" (this round's content hash).

**SKILL.md documentation-completeness check, performed fresh this round,
answering Opus's round-12 documentation question:**

```
$ grep -rn "Codes 10\|16-19\|16–19" plugins/kstack --include="*.md"
plugins/kstack/references/JIRA_QUEUE.md:66:`submit`'s separate retry-verification-interval wait remain exit 2. Codes 10–12
plugins/kstack/references/JIRA_QUEUE.md:68:16–19. Code 1 covers config load/disabled-queue rejection; code 13 is reachable

$ grep -rln "exit code\|exit-code\|EXIT\." plugins/kstack/skills/*/SKILL.md
(no output — zero matches across all SKILL.md files)
```

The only file in the entire `plugins/kstack` tree matching an exit-code
inventory pattern is `JIRA_QUEUE.md` itself — already correctly updated
this round to include exit 20 (visible in the diff below). Zero `SKILL.md`
files anywhere in the repository mention exit codes, "exit-code," or the
`EXIT.` identifier at all, so none of them can carry a stale inventory —
there is nothing in prose form to be stale. This directly answers Opus's
round-12 question ("no grep evidence that SKILL.md either omits the exit-
code list entirely or has been updated") — the answer is: every SKILL.md
omits it entirely, which is the correct/non-stale state.

**Test run, performed fresh this round** (not carried forward from any
earlier round):

```
$ npm test
> kstack@0.1.0 test
> node --test tests/*.test.mjs

✔ tests/config.test.mjs (129.375386ms)
✔ tests/design-gate.test.mjs (58.947392ms)
✔ tests/dual-review.test.mjs (84.457267ms)
✔ tests/jira-queue.test.mjs (2400.270603ms)
✔ tests/memory-remote.test.mjs (1409.819716ms)
✔ tests/memory.test.mjs (2105.048852ms)
✔ tests/provider-runner.test.mjs (42.095007ms)
✔ tests/role-invocation.test.mjs (77.279965ms)
✔ tests/setup.test.mjs (38.420941ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

```
$ git rev-parse HEAD
caaa8fe45c6f6ead68a533b5d0d56219f7677007
```

(Node's test runner reports one top-level result per test FILE when run via
this glob — the "9" here is 9 passing test files, of which
`tests/jira-queue.test.mjs` is one; that file's internal 57 individual
`test()` blocks all passed as part of its single ✔ line above, consistent
with the round-9/10/11 packets' `node --test --test-reporter=tap
tests/jira-queue.test.mjs` runs which showed the sub-test breakdown
directly — same file, same result, different reporter granularity.)

**Tree identity, tying this test run to the exact diff being reviewed:**

```
$ git rev-parse HEAD
caaa8fe45c6f6ead68a533b5d0d56219f7677007
```

This is the same base commit every round's diff has been computed against
(`caaa8fe`, the original Jira ticket-queue ship commit) — the diff embedded
below is the uncommitted working-tree delta on top of it, unchanged since
round 8.

**Call-site inventory for `youngestMarkerAgeMs`, performed fresh this round:**

```
$ grep -n "youngestMarkerAgeMs" plugins/kstack/scripts/kstack-jira.mjs
1069:function youngestMarkerAgeMs(markers, clock) {
1120:    const youngestMarkerAge = youngestMarkerAgeMs(markers, lock.state.clock);
1169:  const youngestMarkerAge = youngestMarkerAgeMs(markers, lock.state.clock);
```

Exactly three matches: the function definition (line 1069) and exactly the
two call sites already reviewed in prior rounds — `runVerification()`
(line 1120) and `preMutationDuplicateGate()` (line 1169). No third call
site exists anywhere in the file. Both call sites use direct comparison
(`youngestMarkerAge !== null` / `youngestMarkerAge === null`,
`youngestMarkerAge >= minimumMarkerAgeMs`), never arithmetic on the
possibly-`null` value, so the coercion hazard Opus flagged as a theoretical
concern for a hypothetical third site does not apply to either actual site.

## Full cumulative diff (embedded verbatim — identical to rounds 8-11; no production code changed since round 8)

```diff
diff --git a/.kstack/decisions/jira-ticket-queue-final-spec-2026-08-17.md b/.kstack/decisions/jira-ticket-queue-final-spec-2026-08-17.md
index 766fcb7..607b018 100644
--- a/.kstack/decisions/jira-ticket-queue-final-spec-2026-08-17.md
+++ b/.kstack/decisions/jira-ticket-queue-final-spec-2026-08-17.md
@@ -270,8 +270,36 @@ Verify-mode reconcile is **mandatory, not recommended**. **The invocation that t
 | (existing) | state-error code for wrong-state command invocations — unchanged from the current codebase |
 | **retired: 10–12** | must not appear anywhere (the old lock-busy numbering) |
 
+**Accepted post-ship addition (recorded 2026-08-23, owner decision): exit
+code 20, `EXIT_INDEX_LAG_BLOCKED`.** Not present in this table as originally
+frozen. Added after ship (on top of `caaa8fe`) per an explicit owner
+decision to give one specific case its own code instead of continuing to
+share the generic "(existing) state-error" code above: `unfreeze`, `submit`,
+or `discard` blocked by the pre-mutation duplicate gate specifically because
+a completed, zero-match search's youngest unresolved marker has a
+*measurable* age (a valid, non-future timestamp) below the §7 poll-minimum/
+30-second index-lag floor. Poll exhaustion, search failure, any
+*unmeasurable* marker age (missing, unparseable, or future-dated timestamp —
+found and fixed across two remediation rounds during this addition's own
+QC), and `submit`'s separate retry-verification-interval wait (an
+unrelated, already-existing pre-send check, out of scope for this addition)
+all remain the generic "(existing)" state-error code, unchanged. This
+addition went through the project's standard post-implementation dual QC
+(Codex + Opus) before being accepted; see `.kstack/qc/index-lag-exit-code-2026-08-23*/`
+for the full record. Recorded here for spec/implementation traceability
+only, per the same convention as this document's other accepted-deviation
+note above (§4.10 marker-lifecycle); the numbered table above is left as
+originally frozen rather than renumbered.
+
 **Implementation notes:** publish-then-link (§4.2) is the universal acquisition idiom — it closes the empty-lockfile window everywhere and subsumes any 9p/drvfs/NFS-specific carve-out; the retained fd is the published inode, so heartbeat `futimes` behavior is unaffected. Coarse mtime granularity (1-2s on some mounts) is why `LOCK_STALE_MS` is 18 heartbeats, not 2. Where `(dev, ino)` is unreliable, the content-`lockId` comparison in §4.5 is primary and sufficient. Clock jumps/system suspend cause at worst a false break. **Implementation-time task:** verify no stale reference to the retired exit codes **10–12** / the old single "12 = lock busy" meaning survives anywhere in the actual repo (`--help` text, SKILL.md prose, scripts) before shipping — and that 13/14 are wired to the meanings in the inventory above.
 
+**Accepted implementation deviation (recorded 2026-08-23, owner decision, post-ship):** the shipped implementation (`kstack-jira.mjs`, `caaa8fe`) is stricter than this section's marker-lifecycle text in two respects, both accepted as-is rather than amended into the spec prose above:
+
+1. **A 30-second minimum marker age floor** (`VERIFY_CLEAR_MIN_AGE_FLOOR_MS`) gates every `verify-clear`/gate-clearing path — including the pre-discard/pre-unfreeze gate (line 251) and explicit `reconcile --verify` (lines 245–247) — on top of this section's stated criterion of "a completed full poll." A zero-match result from a full poll that completes before the youngest unresolved marker is 30s old is written as `verify-inconclusive` (with `reason: "marker-younger-than-index-lag-minimum"`), not `verify-clear`, even though the spec text as written would treat poll completion alone as sufficient.
+2. **Trigger-(e) markers are treated as search-eligible for `verify-clear`/`verify-confirmed` retirement**, not scoped out the way this section's per-trigger retirement rules might otherwise be read for (d)/(e) markers outside their own originating invocation's inline verify.
+
+Both deviations make the implementation strictly more conservative than the letter of this section (they can only delay a `verify-clear`, never produce a false one), so no code or design change follows from this note. This is recorded here for spec/implementation traceability only; §4.10's prose above is left unamended per owner decision (recording as an accepted deviation rather than rewriting the approved text).
+
 ## §5. Which process performs the network POST (final)
 
 Implementation-time verification: whether `codex exec --sandbox workspace-write` permits outbound HTTPS to the adopter's `siteUrl`. The Codex-side flow stops at `pending` — `draft` is fully offline by design, and skills are restricted to `draft` only (§9), so this is internally consistent. Everything requiring egress (`doctor`, `show`'s createmeta, `submit`, `reconcile`) or a TTY (`approve`) runs from the Claude-Code-side session or a human shell. If Codex's sandbox permits egress, `show`/`submit`/`reconcile` additionally work there, but `approve`'s TTY requirement keeps the human step host-side either way.
diff --git a/plugins/kstack/references/JIRA_QUEUE.md b/plugins/kstack/references/JIRA_QUEUE.md
index 2beb516..93fa0aa 100644
--- a/plugins/kstack/references/JIRA_QUEUE.md
+++ b/plugins/kstack/references/JIRA_QUEUE.md
@@ -58,8 +58,14 @@ for this recovery-only condition.
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
@@ -23,7 +23,8 @@ export const EXIT = Object.freeze({
   LOCK_HELD: 16,
   LOCK_FENCED_CLEAN: 17,
   LOCK_FENCED_DIRTY: 18,
-  LOCK_BREAK_RACE: 19
+  LOCK_BREAK_RACE: 19,
+  INDEX_LAG_BLOCKED: 20
 });
 export const LOCK_HEARTBEAT_MS = 5000;
 export const LOCK_STALE_MS = 90000;
@@ -32,6 +33,12 @@ export const VERIFY_CLEAR_MIN_AGE_FLOOR_MS = 30000;
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
@@ -1062,15 +1069,22 @@ function verifyClearMinimumAgeMs(state) {
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
@@ -1104,11 +1118,17 @@ export async function runVerification(lock, draft, credentials, options = {}) {
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
@@ -1133,11 +1153,11 @@ async function preMutationDuplicateGate(lock, draft, credentials) {
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
@@ -1147,10 +1167,15 @@ async function preMutationDuplicateGate(lock, draft, credentials) {
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
@@ -1162,7 +1187,7 @@ async function unfreezeDraft(state, id) {
     if (draft.state !== 'approved') fail('unfreeze requires approved state', EXIT.STATE_ERROR);
     const credentials = unresolvedSearchEvidence(draft).length ? await resolveCredentials(state) : null;
     const gate = await preMutationDuplicateGate(lock, draft, credentials);
-    if (gate.blocked) fail('unfreeze refused until duplicate evidence is resolved', gate.keys?.length ? EXIT.DUPLICATE : EXIT.STATE_ERROR);
+    if (gate.blocked) fail('unfreeze refused until duplicate evidence is resolved', gateExitCode(gate));
     draft.state = 'pending';
     clearFreeze(draft);
     queueAudit(draft, 'unfrozen', {}, state.clock);
@@ -1189,7 +1214,7 @@ async function submitDraft(state, id, args = {}) {
       throw error;
     });
     const duplicateGate = unresolvedSearchEvidence(draft).length ? await preMutationDuplicateGate(lock, draft, gateCredentials) : { blocked: false };
-    if (duplicateGate.blocked) fail('submit refused until duplicate evidence is resolved', duplicateGate.keys?.length ? EXIT.DUPLICATE : EXIT.STATE_ERROR);
+    if (duplicateGate.blocked) fail('submit refused until duplicate evidence is resolved', gateExitCode(duplicateGate));
     if (unresolvedRetryVerify(draft)) {
       const retryVerification = await runVerification(lock, draft, gateCredentials, { explicit: true });
       if (retryVerification.exitCode === EXIT.DUPLICATE) fail('submit refused until retry duplicate evidence is resolved', EXIT.DUPLICATE, retryVerification);
@@ -1469,7 +1494,7 @@ async function discardDraft(state, id, args = {}) {
     if (ambiguous.length) queueAudit(draft, 'ambiguous-discard-acknowledged', { priorAmbiguousAttempts: ambiguous.map((row) => row.attemptId) }, state.clock);
     const credentials = unresolvedSearchEvidence(draft).length ? await resolveCredentials(state) : null;
     const gate = await preMutationDuplicateGate(lock, draft, credentials);
-    if (gate.blocked) fail('discard refused until duplicate evidence is resolved', gate.keys?.length ? EXIT.DUPLICATE : EXIT.STATE_ERROR);
+    if (gate.blocked) fail('discard refused until duplicate evidence is resolved', gateExitCode(gate));
     draft.state = 'discarded';
     queueAudit(draft, 'discarded', {}, state.clock);
     await guardedWriteDraft(lock, draft);
@@ -1625,8 +1650,12 @@ verify-clear requires a completed full poll and marker age at least as long as t
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
diff --git a/tests/jira-queue.test.mjs b/tests/jira-queue.test.mjs
index 04b08b3..09e70f4 100644
--- a/tests/jira-queue.test.mjs
+++ b/tests/jira-queue.test.mjs
@@ -377,8 +377,11 @@ test('covered aborted-before-post does not retire a separate lock-broken submit
 
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
@@ -652,7 +655,7 @@ test('pre-mutation duplicate gate uses the injected clock on both sides of the 3
   draft.audit.push({ auditId: cryptoRandom(), event: 'lock-broken', at: new Date(markerTime).toISOString(), lockId: 'clocked', op: 'submit' });
   writeDraft(state, draft);
 
-  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.STATE_ERROR);
+  await assertExit(runJiraCommand(state, 'unfreeze', { id: draft.id }), EXIT.INDEX_LAG_BLOCKED);
   assert.equal(readDraft(state, draft.id).audit.at(-1).event, 'verify-inconclusive');
 
   clockTime = markerTime + 30000;
@@ -668,13 +671,115 @@ test('pre-mutation duplicate gate blocks a marker with a missing timestamp', asy
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
@@ -684,6 +789,48 @@ test('unfreeze explicitly clears every frozen field', async () => {
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
@@ -1004,7 +1151,9 @@ test('ambiguous-history override remains independent from duplicate dismissal',
 test('lock-holding implementation contains no synchronous blocking primitives and exit inventory has no collisions', () => {
   const source = fs.readFileSync(path.resolve('plugins/kstack/scripts/kstack-jira.mjs'), 'utf8');
   assert.doesNotMatch(source, /\b(?:spawnSync|execSync|Atomics\.wait|sleepSync)\b/);
-  assert.deepEqual(Object.values(EXIT).sort((a, b) => a - b), [0, 1, 2, 3, 6, 8, 9, 13, 14, 15, 16, 17, 18, 19]);
+  assert.equal(EXIT.STATE_ERROR, 2);
+  assert.equal(EXIT.INDEX_LAG_BLOCKED, 20);
+  assert.deepEqual(Object.values(EXIT).sort((a, b) => a - b), [0, 1, 2, 3, 6, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20]);
   assert.equal(Object.values(EXIT).some((code) => code >= 10 && code <= 12), false);
 });
```

## Review instructions

You are reviewing round 14 independently. You have not seen any other
reviewer's output for this round. Production code is unchanged since round
8. What's new this round is the unfiltered, file-type-independent
consumer-search evidence above, closing the one concrete item named in
round 13.

If, after reviewing this evidence, you find zero remaining findings, your
confidence score should reflect that — do not hold confidence below 95 out
of generic caution once every concrete objection you can name has been
resolved and independently verified with fresh evidence. If you still
cannot reach 95, name the single concrete item preventing it as an
`unresolvedQuestion` rather than reporting a bare sub-95 number with
nothing actionable in it.

Report decision (pass/fix/redesign/block), confidence 0-100, failed checks,
findings, strongest objection, and unresolved questions per the standard QC
format.
