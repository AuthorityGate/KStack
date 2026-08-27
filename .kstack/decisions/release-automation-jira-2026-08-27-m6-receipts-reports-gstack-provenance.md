# Release M6 round 3 — obligation deadline and pre-effect terminal corrections

**Frozen base digests:**
`29ec768910fbee532e7625fed97f2389e319b9a1f8b5620c06b41e1a4b312371`,
`e7b14c101f7b4c0e908e2bf906ba52d3558cf495b4c5af908b7dc6dedb9cec3e`
**Prior Codex:** 92 revise in 13126 ms
**Mode:** two concrete bug fixes only

All prior provisions remain normative except the exact obligation-absence and
priority clauses below.

## Per-obligation due-by semantics

Each `REQUIRED` or true `CONDITIONAL` obligation includes a nonempty
`producerMechanismId`, exact `requiredHeadIdentity`, M7-qualified
`dueByInclusive`, and `terminalFailureSetDigest`, all derived from the frozen
producer's deadline and bound into `ReleaseReportObligationsV1`. M6 cannot
extend or shorten a producer deadline. Missing/unqualified time, unknown
producer/failure set, overflow, or a due-by later than its source authority or
evidence-retention expiry invalidates the obligation vector before use.

At one qualified report-evaluation instant:

- valid required head present: evaluate it through the total priority table;
- head absent and evaluation time strictly before due-by: valid
  `IN_PROGRESS`, with producer and due-by shown;
- head absent at or after due-by: `EVIDENCE_UNQUALIFIED` / `UNQUALIFIED` with
  exact `REQUIRED_HEAD_ABSENT_AT_DEADLINE`;
- exact producer terminal-failure head present before/at due-by: map that known
  failure immediately; do not wait for the deadline; and
- invalid/forked/wrong head at any time: priority-1 unqualified, never pending.

An optional-display head never supplies a required one. A late head produces a
new higher-ordinal aggregate after exact source validation; it does not rewrite
the historical absent-at-deadline report or retroactively make it successful.

## Corrected first-match terminal order

Replace the round-2 priority table with:

| Priority | Exact normalized predicate | Terminal | Completeness |
|---:|---|---|---|
| 1 | any present required signature/schema/domain/identity/fence/chain/anchor/obligation/provenance/evidence validation fails; or required head absent at/after due-by | `EVIDENCE_UNQUALIFIED` | `UNQUALIFIED` |
| 2 | M2/provider effect is possibly acted/contradictory/unknown at its deadline, or M3/M5 is exact ambiguous terminal | `RELEASE_AMBIGUOUS` or `ROLLBACK_AMBIGUOUS` by source | `AMBIGUOUS` |
| 3 | M1 is exact rejected/expired/cancelled before authorization; or M2 is exact rejection/not-attempted/definitively-failed with authenticated no provider effect | `RELEASE_FAILED_OR_NO_EFFECT` | `COMPLETE_NON_SUCCESS` |
| 4 | required head absent strictly before due-by, or a valid required producer/source is nonterminal within its bound | `IN_PROGRESS` or exact `ROLLBACK_APPLIED_UNVERIFIED` | `IN_PROGRESS` |
| 5 | M5 is exact manual, rejected-before-consume, consumed-not-attempted, or definitive rollback failure | matching exact M5 terminal | `COMPLETE_NON_SUCCESS` |
| 6 | M5 restore is exact `RESTORE_VERIFIED_HEALTHY` and all required projections are terminal/current | `ROLLBACK_VERIFIED_HEALTHY` | `COMPLETE_VERIFIED` |
| 7 | no M5 trigger/result is required and M4 is exact valid waiver | `RELEASE_OBSERVATION_WAIVED` | `WAIVED` |
| 8 | provider/M4 proves definitive failed/no-effect after dispatch with no possibly-acted ambiguity | `RELEASE_FAILED_OR_NO_EFFECT` | `COMPLETE_NON_SUCCESS` |
| 9 | no M5 trigger/result is required, M4 is exact `HEALTHY`, and all M3/evidence/provenance/M7 obligations are terminal/current | `RELEASE_HEALTHY` | `COMPLETE_VERIFIED` |
| 10 | otherwise before every remaining bound | `IN_PROGRESS` | `IN_PROGRESS` |
| 11 | otherwise at/after any applicable bound | `MANUAL_ACTION_REQUIRED` | `COMPLETE_NON_SUCCESS` |

Priority 2 always precedes no-effect classification: response failure alone
cannot erase a possibly-acted state. Priority 3 requires authenticated
pre-effect/no-effect evidence, not lack of a success response. Only priorities
6 and 9 emit `FINAL-SUCCESS`.

## Verification delta

1. For every required producer, test missing one tick before, exactly at, and
   after due-by; valid/invalid/late heads; terminal failure before due; and
   source authority/retention expiry before due-by.
2. Exhaust M1 rejection/expiry/cancel and every M2 rejection, not-attempted,
   definitely-failed, possibly-acted, unknown, and contradictory combination;
   assert one row and ambiguity precedence.

Closure requires Codex confidence at least 93 on the exact composed digest with
zero failed checks, security findings, material dissent, and unresolved M6
questions. No Opus, implementation, publication, external mutation, report
edit, commit, push, or deployment is authorized.
