# HP-TC01 repair-r3 round 7 — isolated measurement

**Round 7b correction notice.** The original round-7 version of this record
(and the decision-document text it fed) cited `nfaNodeCount` (a raw count of
automaton states this harness reports but production does not gate on)
against the 4,096 per-pattern ceiling, and described the 78-byte widened
pattern as "comfortably inside" both per-pattern caps. Neither is correct:
the field actually compared to the 4,096 ceiling is `nfaSizeGuard`, and at
4,068/4,096 (NFA-size) and 4,066/4,096 (DFA-state) the widened pattern is
under both caps by only 28 and 30 units respectively (4,096 − 4,068 = 28;
4,096 − 4,066 = 30) — not comfortable margin. This file is corrected below; independent review of the decision
document caught the original error
(`.kstack/reviews/host-portability-2026-09-02-hp-tc01-repair-r3-round7/`,
confidence 34/41). A DFA-state-specific cross-check and reconciled,
larger-sample wall-clock figures are added below per that review's request.

Scope: this record is the single isolated measurement round team-lead
authorized in place of a fourth bundled patch to
`.kstack/decisions/host-portability-2026-09-02-hp-tc01-repair-r3.md` — it does
not itself edit that document. It answers the question sent to round-6
review: does the round-3 per-DFA-state closure argument survive round 5's
counterexample, with real numbers instead of another argument.

It also corrects a factual error in the round-5 text of the decision
document itself, discovered while gathering that evidence: the claim that
`^a*a{0,4000}$` produces "2-3 DFA states" is wrong. Ground truth, both by
direct instrumentation of the real compiler internals and by confirming the
production accept/reject boundary matches that instrumentation exactly, is
that this pattern produces **4,001 DFA states** (`^a*a{0,4090}$` still
compiles at 4,091 states; `^a*a{0,4094}$` already exceeds the per-pattern NFA
guard). The pattern was never "large NFA / tiny DFA" — it is large on both
axes simultaneously, close to both existing per-pattern caps at once.

## Methodology

- Harness: `host-portability-2026-09-02-hp-tc01-repair-r3-round7-measurement-harness.mjs`
  (same directory), SHA-256 `354589a1cf47d2e0ca2ee78efb7a37ebbfafa0d7d612c76046822e83bf760ca1`.
  It is a verbatim copy of `parseClosedPatternAtoms`, `buildClosedPatternNfa`,
  `closedPatternAlphabet`, and `determinizeClosedPattern` from
  `plugins/kstack/scripts/kstack-host-contract.mjs` (read 2026-09-02),
  extended only to return internal counters
  (`dfaStateCount`, `symbolCount`, `sumMembersLength`, `symbolMemberProduct`)
  that the production `compileClosedSchemaSet` does not expose. It changes no
  production behavior; it exists to inspect what the production compiler is
  already doing.
- Cross-check: the harness's accept/reject boundary was confirmed identical
  to the real `compileClosedSchemaSet` at `n = 4090` (both accept) and
  `n = 4094/4095/4096` (both reject `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`) for
  `^a*a{0,n}$` — see the two boundary-check commands in this record's session
  transcript. This is the basis for trusting the harness's internal counters.
- Wall-clock timing (separate script, production `compileClosedSchemaSet`
  called directly, not the harness): 11 trials per pattern, first 5 discarded
  as JIT warm-up, remaining 6 reported as mean and median. Wall-clock timing
  and internal-counter instrumentation were run in two separate processes/
  scripts so neither affects the other's numbers.
- Only literal-atom characters the production grammar's `PATTERN_TOKEN` regex
  actually accepts (`[A-Za-z0-9_:.-]`) were used as "widener" atoms.
- Round 7b addition: a second, DFA-count-sensitive boundary cross-check (the
  first only exercised the NFA-size guard, which both reviewers correctly
  noted does not validate DFA-state counting since this pattern family never
  approaches the 4,096 DFA cap). Literal output:

  ```
  {"pattern":"^[ab]*a[ab]{10}$","bytes":16,"nfaSizeGuard":14,"nfaNodeCount":26,"symbolCount":3,"dfaStateCount":2049,"sumMembersLength":14338,"maxMembersLength":12,"symbolMemberProduct":28676}
  {"pattern":"^[ab]*a[ab]{11}$","error":"KSTACK_HOST_PATTERN_DFA_LIMIT"}
  ```

  ```
  ^[ab]*a[ab]{10}$ production result: ok
  ^[ab]*a[ab]{11}$ production result: FAIL KSTACK_HOST_PATTERN_DFA_LIMIT
  ```

  Harness and production reject at the identical `W`, with `nfaSizeGuard` far
  from its own cap (14 of 4,096) — this boundary is sensitive to DFA-state
  counting specifically, corroborating `dfaStateCount`.
- Round 7b addition: a larger-sample wall-clock re-measurement (30 trials,
  first 15 discarded as warm-up) for both the baseline and widened patterns,
  run in a separate script from the 11-trial/5-warmup figures in the table
  below, to check measurement stability:

  ```
  {"label":"baseline-narrow-alphabet","pattern":"^a*a{0,4000}$","bytes":13,"trials":30,"warmup":15,"steadyMeanMs":238.986,"steadyMedianMs":226.372,"steadyMinMs":216.472,"steadyMaxMs":323.53}
  {"label":"widened-alphabet-symbolCount67","pattern":"^a*a{0,4000}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"trials":30,"warmup":15,"steadyMeanMs":2715.814,"steadyMedianMs":2701.705,"steadyMinMs":2676.621,"steadyMaxMs":2840.884}
  ```

  A second independent invocation reproduced the baseline within range before
  timing out on the widened pattern in the same 120-second command budget:

  ```
  {"label":"baseline-narrow-alphabet","pattern":"^a*a{0,4000}$","bytes":13,"trials":30,"warmup":15,"steadyMeanMs":233.199,"steadyMedianMs":221.767,"steadyMinMs":212.28,"steadyMaxMs":298.808}
  ```

  The widened pattern's compile time is measurement-sensitive: the
  11-trial/5-warmup figure in the table below (2,987.7ms) is within range of
  the 30-trial figure (2,701.7ms), but an intermediate re-run at 11
  trials/5 warmup on a differently-loaded process measured a steady median of
  1,007.6ms — under half of either. The 30-trial figure is treated as the
  more reliable estimate (largest sample, and its companion baseline
  reproduced closely across two independent runs), but the spread itself is
  disclosed rather than hidden: this pattern's cost is not a fixed constant
  across runs, which is itself relevant to how tightly any ceiling derived
  from it should be trusted.

## Data

### Tracker construction (`^[ab]*a[ab]{W}$`) — subset-cardinality driver alone

| W | bytes | result | steady median (ms, n=9, 4 warmup) |
|---|---|---|---|
| 8 | 15 | ok | 1.28 |
| 10 | 16 | ok | 4.03 |
| 12 | 16 | `KSTACK_HOST_PATTERN_DFA_LIMIT` | — |
| 13 | 16 | `KSTACK_HOST_PATTERN_DFA_LIMIT` | — |

This construction hits the existing per-pattern DFA-state cap (4,096) by
itself at W=12, leaving no room to also widen the alphabet — it cannot
demonstrate the combined channel below.

### Cheap-NFA construction (`^a*a{0,4000}` + widener suffix + `$`) — isolates symbolCount from state/NFA count

| widener chars (n) | pattern bytes | symbolCount | dfaStateCount | sum(members.length) | symbolCount×members product | wall time steady median (ms, n=11, 5 warmup) |
|---|---|---|---|---|---|---|
| 0 | 13 | 2 | 4,001 | 8,010,001 | 8,010,001 | 261.7 |
| 16 | 29 | 18 | 4,017 | 8,014,017 | 136,238,289 | 481.1 |
| 32 | 45 | 34 | ~4,033 | ~8,014,030 | ~296,519,369¹ | 1,709.4 |
| 48 | 61 | 50 | ~4,049 | ~8,014,040 | — | 2,311.5 |
| 65 (max available) | 78 | 67 | 4,066 | 8,014,066 | 528,928,356 | 2,987.7 |

¹ the n=32 row's exact product figure was taken from a slightly different
widener-character selection than the n=32 wall-clock run; the trend (linear
in symbolCount, wall time tracking it sub-linearly but still by roughly an
order of magnitude across the tested range) is what matters here, not the
single-digit-percent alignment between the two runs.

Both axes stayed *under*, but not comfortably under, the **existing,
already-frozen, per-pattern** bounds for the widest row above: `dfaStateCount`
4,066 of the 4,096 per-pattern cap (4,096 − 4,066 = 30 units of headroom), and
`nfaSizeGuard` 4,068 of the same 4,096-valued per-pattern ceiling (4,096 −
4,068 = 28 units of headroom, corrected here from an earlier "68 units"
subtraction error caught in round-7b independent review) —
see the literal citation in "Methodology" above; `nfaNodeCount` (8,135 for
that row) is a different, non-gated internal count and is not the field
compared to either cap. Only 78 of the 256 allowed pattern bytes were used;
the grammar's literal-atom character class exhausts
at 65 distinct single-character widener atoms, so symbolCount could not be
pushed further with single-char literals alone in this test — bracket-class
atoms with partially-overlapping membership (not yet tried) could plausibly
push symbolCount further toward the ~128-slot ceiling implied by
`Int32Array(128)` in `closedPatternAlphabet`, which has no explicit guard of
its own anywhere in the file (confirmed by exhaustive grep for
`symbolCount` — it is never compared against a limit).

## What this shows

1. **The round-3 argument does not survive.** A single 78-byte pattern,
   under (30/28 units of headroom, not comfortably under) both existing
   per-pattern caps, took ~2.7-3.0 seconds to compile in the larger,
   more-reliable sample — roughly 11-12x the ~226-260ms baseline for the same
   NFA/DFA-size pattern with a minimal alphabet (a smaller, less reliable
   sample measured as low as ~1.0s; see "Methodology" for the disclosed
   spread). The driver is `symbolCount`, which nothing in the current design
   (frozen or addendum) bounds.
2. **Neither of the two round-5/round-6 aggregate counters would flag this
   pattern as unusual.** `maxPatternCompilationWork` (DFA states created) sees
   ~4,001-4,066 for this pattern — the same order of magnitude as any other
   pattern near the per-pattern DFA cap, nothing distinguishes it.
   `maxPatternNfaConstructionWork` (NFA nodes constructed) sees ~8,000-8,135,
   again unremarkable relative to other near-cap patterns. Both counters are
   blind to `symbolCount`, which is the actual multiplier separating a
   ~260ms compile from a ~3.0s compile of an NFA/DFA-size-equivalent pattern.
3. **This changes the round-6 ceiling math, not just the round-3 prose.**
   Round 6's `maxPatternNfaConstructionWork` = 16,384 ceiling was sized from
   a ~209ms/~4,000-construction single-pattern measurement. That measurement
   used a low-symbolCount pattern. At symbolCount≈67 (demonstrated
   achievable, and not yet at the character-class-driven maximum), the same
   NFA-construction-work budget could cost several times longer than the
   figure the ceiling was justified against.
4. **This also revises the round-5 factual record.** The "2-3 DFA states"
   description of `^a*a{0,4000}$` in the current document text is wrong; it
   is ~4,001 states. This does not undo round 5's underlying finding (a
   two-atom pattern producing ~4,000-node NFA constructions from ~8 bytes is
   still true and still real), but the specific "large NFA / tiny DFA"
   framing used to justify why a *second*, DFA-count-independent counter was
   needed rests on a number that was never verified against the actual
   compiler and turns out to be wrong.

## What this does not decide

This record intentionally states findings, not a remedy. Candidate directions
(not evaluated or chosen here): a `symbolCount`-weighted aggregate counter in
place of counting raw NFA-node or DFA-state constructions; a per-pattern
`symbolCount` cap analogous to the existing DFA-state and NFA-size caps; or a
combined per-state work bound (`symbolCount × members.length`, summed and
capped per call, replacing both existing counters with the one metric that
actually matches the cost model in `determinizeClosedPattern`). Selecting
among these is a design decision for round 8+, not this measurement round.
