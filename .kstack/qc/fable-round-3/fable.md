The advisor confirmed both resolutions and sharpened the specifics. Write and ExitPlanMode are not among the tools available in this session, so the binding directive is delivered here in full.

---

# Fable arbitration directive — round 3 (binding for remediation dispatch)

## Defect A — fix: targeted per-entry exclusion, keyed to the specific covering recovery

**Chosen option:** Codex's first option (exclude definitively matched `aborted-before-post` evidence from the unresolved-search filter), implemented as a per-entry predicate. **The `latestResolutionIndex` option is explicitly rejected**, for a load-bearing reason the remediation must not re-litigate: `submit-recovered` is written for all three recovery outcomes (`aborted-before-post`, `posted-without-key`, `no-covering-sidecar`), and `latestResolutionIndex` retirement is index-based — adding `submit-recovered` to its event set would blanket-retire *every* earlier marker, including a separate lock-broken(submit) marker that the recovery proves nothing about. A recovery entry is evidence about exactly one attempt; it may only resolve the artifact it names. No new audit event type either — that would duplicate information already present and force updates to every recognizer list.

**Exact changes:**

1. **Recovery site** (`reconcileDraft`, the `aborted-before-post` branch): add `lockId: attempt.lockId` to the `submit-recovered` audit payload, so it becomes `{attemptId, lockId, recovery: 'aborted-before-post'}`. This is a field addition to an existing event (enabling §2's attemptId-primary/lockId-cross-check correlation), not a new event type. Add it to all three `submit-recovered` emissions for uniformity if trivial, but only the `aborted-before-post` one is load-bearing.

2. **Scanner** (`unresolvedSearchEvidence` only): a `stale-holder-outcome` entry is excluded from the unresolved set iff **all** of:
   - `entry.posted === false`, and
   - the **full** `draft.audit` contains a `submit-recovered` entry with `recovery === 'aborted-before-post'` and `attemptId === entry.attemptId` (both present), and
   - when both entries carry a `lockId`, they match.

   Full-audit search (not slice-relative) is correct: attemptIds are unique per invocation and fold-then-recover ordering guarantees the covering entry post-dates the sidecar entry. Suggested shape:

   ```js
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
   // in unresolvedSearchEvidence's filter:
   (entry.event === 'stale-holder-outcome' && !entry.issueKey && !coveredByAbortRecovery(draft, entry))
   ```

3. **Explicitly leave untouched:** `latestResolutionIndex`'s event sets, `unresolvedDirectEvidence` (a `posted:false` entry can never match its filter), `unresolvedRetryVerify`, and all call sites. The shared-predicate fix propagating to `status`, `preMutationDuplicateGate`, and `runVerification` is the **intended** behavior per §4.5 ("deterministic recovery … no mandatory verify from this alone"), not a side effect.

**Spec reconciliation (state this in the remediation report so QC round 4 doesn't re-flag it):** §4.5's no-verify rule governs the *covered* aborted-before-post case; §4.10 trigger (c)'s unqualified wording continues to govern every *uncovered* `stale-holder-outcome` — including fenced-edit sidecars and the new release-path sidecar Defect B introduces. Do not broaden the exclusion beyond the attemptId-matched pair.

## Defect B — fix: write the sidecar at mismatch detection, and fix the exit code

**Yes**, this path must write the orphan sidecar — the residue (`attemptId`, `posted`) describes the draft's in-flight state, which only this process knows; restoring the lock file is orthogonal and does not preserve it. Two changes:

1. **Placement:** call `writeOrphan(lock, { ...residue, wroteAfterFence: false })` **immediately upon detecting `claimed?.parsed?.lockId !== lock.lockId`, before the rename-back attempt** — not sibling-style right before each `fail()`. This placement is deliberate: it also covers the unrestorable sub-path (exit 19, `EXIT_LOCK_BREAK_RACE`), which loses exactly the same residue and which a before-`fail` placement on the restored branch alone would miss. If the sidecar write itself fails, the successor is at worst falsely fenced and self-reports — the safe direction.

2. **Exit code — a second sub-defect, not optional cleanup:** the restored path's unconditional `EXIT.LOCK_FENCED_DIRTY` contradicts §4.5's verbatim example ("fenced only at release, §4.9 … writes `{posted: false}` and exits 17") and §4.8's rule (residue ⇒ 18, none ⇒ 17). Change it to `residue.posted ? EXIT.LOCK_FENCED_DIRTY : EXIT.LOCK_FENCED_CLEAN`, matching the three sibling paths. `wroteAfterFence` is false here by construction, so `posted` alone decides.

3. **Janitor: no change needed.** Folds are idempotent (keyed by lockId + event type), the orphan path is uniquely owned, and orphan folding alongside a restored lock is already handled. Confirmed sufficient as-is.

**Forward-looking note (include verbatim in the remediation report):** the new release-path sidecar folds as `stale-holder-outcome` (`posted:false`, no issueKey) and **legitimately arms §4.10 trigger (c)** until a later `reconcile --verify` writes `verify-clear`. There is no covering `submit-recovered` for it, so Defect A's exclusion correctly does not fire. This is per-spec behavior, not Defect A regressing.

## Required tests (these discriminate the chosen fixes from the rejected alternatives)

1. Covered aborted-before-post entry **plus** a separate unresolved lock-broken(submit) marker → still gated, still surfaced by `status`. (Proves no over-clearing; this is the test that justifies rejecting the `latestResolutionIndex` option.)
2. Covered aborted-before-post entry alone → `status` clean, subsequent `submit` runs no pre-send verify. (The defect's repro.)
3. `posted:false` `stale-holder-outcome` with missing or mismatched `attemptId` → still counted as unresolved.
4. Release mis-claim, restored: sidecar exists with the §4.8 schema, exit 17 when `residue.posted` is false, 18 when true. Unrestorable sub-path: sidecar exists, exit 19.

## Rulings

- **Material plan change: no — orchestrator's assessment confirmed.** Both fixes implement already-normative spec sentences (§4.5's no-verify rule and its exit-17 example, §4.8's exit semantics, §4.9's handoff contract); the `lockId` payload addition sits inside §2's existing correlation rule. No `kstack-interrogate` required before implementation.
- **Out-of-scope dispositions confirmed as reasonable:** hermetic test suite (Codex items 3 and 5 accepted, not defects), one-time drvfs probe already performed, no live Jira testing per standing constraint. Nothing in A or B changes them. The other standing exclusions (exit-code renumbering, `authority.externalTicketCreation`, `accountId` pinning, BROWSE_PROJECTS gap) remain out of scope.

One housekeeping note: plan mode asked for this directive in a plan file, but the Write tool isn't available in this session's toolset, so the directive above — confirmed by advisor review — is the deliverable as-is. It is ready to hand to the round-3 remediation dispatch verbatim.
