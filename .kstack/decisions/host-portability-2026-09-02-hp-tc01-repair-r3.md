# HP-TC01 round-3 aggregate pattern-compilation bound

**Prior packet:** `b9d1d1949051140b9af1bb8802da64f4efa0927de72f52796704b937d3047ce6`
(this document's round-7g third-pass revision, reviewed as round 7h; the
round-7g packet was
`d617fef7f8296a55fcc65636f2cb6a8bfa9ab3bb7be4f1510e4bc8926934884a`; the round-7f packet was
`75d4fab4bdac2ec127deb0c4b585c3d683a248a717d5e7bba6caed34e34dbe21`; the round-7d revision,
reviewed twice as rounds 7d and 7e, was
`ebbfb88de14f8020c65359aa720a8a3e07f6ee8ef20487728063d2c2958d72ce`; the
round-6 baseline the 7c correction was drafted from is
`dfcdaaf92d2d35300f5b76a871776a782a9264ddda5595f20334206f93841b60`; the
round-7c packet was `dac7b9bc53ddd80d527e32bea2e58d42d48bbfd6a3c5b719965528011f86daa7`;
the frozen parent is `host-portability-2026-08-27-hp-tc01-repair-r2.md`,
Codex approve 96)
**Prior result:** round 7h — Codex `decision: block`, confidence 18
(dissent: a standalone `symbolCount` = 64 cap "is mechanically feasible
but is not a material DoS mitigation on the supplied evidence"); Opus
revise 78 (asks, among four items, that the "certifiably safe at 64"
headline be reconciled with its stored-schema-set scope caveat, that the
width-monotonicity assumption be labeled inference, and — finding
HP-TC01-R7G-SEC-2 — that the JS-only cap's real-input divergence from the
Rust oracle be addressed, not merely confirmed against frozen vectors).
Round 7g — Codex `decision: block`, confidence 24
(recommendation: "Treat round 7g as an improved factual record, but do not
approve the held design for implementation"; failed checks include the
Review request's "approximately 11 minutes" shorthand and the uncalibrated
16,384); Opus revise 80 ("Revise on two text-level items, then this round
closes": the `maxPatternCompilationWork` normativity self-contradiction and
the unscoped §1 Problem figures; dissent: Option 5 standalone is "a
plausible interim stopgap" the disposition excluded without saying why).
Round 7f — Codex `decision: block`, confidence 22 (its
first block in this thread; its recommendation states the correction's
arithmetic and measurement implications are "internally consistent" and
says "Send Option 4a forward … Do not implement the current held design");
Opus revise 78 ("Revise, then this round closes" on three text-level edits,
all three addressed in this revision along with its optional fact (iii)
restatement, see 7c.8 "Round 7g edits"). Round 7e — Codex revise 62 (3 failed checks); Opus
revise 80 (3 failed checks); the same packet as round 7d, which returned
Codex revise 61 / Opus revise 76. Neither 7e verdict alleges a wrong figure in the
7c correction (Opus, round 7e: "I recomputed every derivation in "Round 7c
correction" that the packet exposes inputs for and found no numeric
error"). Both asked for the two measurements reviewers had requested twice
(a real four-pattern combined call; the 30-trial timing runs' entry point),
and both dissented toward Round B's Option 4 over the then-recommended
Option 3. History: round 7c — Codex revise 48 / Opus revise 74; round 6 —
Codex revise 82 / Opus revise 74; rounds 7 and 7b (two discarded drafting
attempts at the correction) — Codex 34 / Opus 41, then Codex 38 / Opus 58,
for errors in the correcting text itself, not the measurements.
**This round:** 7i — the team-lead's decision on the Option 5 feasibility
assessment (the 64-value cap rejected; a corpus `symbolCount` measurement
authorized and pending as separate empirical work), the Rust real-input
parity gap stated plainly, the width-monotonicity inference labeled, and
review item (5) added — see "Round 7i" in 7c.8. Round 7g's changes stand
as listed under "Round 7g edits" and "Round 7g, third pass" in 7c.8, in
summary: three items at team-lead direction: 7c.7's
fifth-pattern sentence scoped per reading (Opus); the §1 inline hold
extended to the three remaining locations that still read as normative for
the held clause (Opus); and an "Interim disposition" statement of the
current risk state at the end of 7c.7 (in response to Codex's block); plus,
after team-lead approval, Opus's third edit (Reading C's lead figure) and
its optional fact (iii) restatement; and, in a third pass after the
round-7g review, the four items listed under "Round 7g, third pass" in 7c.8
— chiefly the "Interim Option 5 feasibility" paragraph in 7c.7. The "Review
request" scope is unchanged apart from its round label and its description
of what changed. Round 7f's changes (two new literal
measurements in 7c.6 and 7c.7, a third reading of the NFA-counter clause,
the inline hold on the §1 clause, Round B restructured to five options with
no single recommendation) stand as listed under "Round 7f edits" in 7c.8;
nothing else.
**Frozen:** Option C, non-copy constraint, HP-TC01-only boundary, every other
Host Portability item remains open

This delta amends only repair-r2 §1's global limits, adding two new aggregate
bounds (`maxPatternCompilationWork`, declared in round 1, and
`maxPatternNfaConstructionWork`, declared in round 5 and under an
implementation hold pending Round B — see §1; count corrected round 7d from
"one"). Every other repair-r2 declaration — per-pattern grammar, the 256-byte /
4,096-DFA-state per-pattern ceiling, `CollectionV1`, the exact host-operation
records, bootstrap objects, invariants, and the historical bootstrap algorithm
— is unmodified and remains normative.

## Round 7c correction — measured figures replacing round 5's unverified ones

**Standard for this section.** Every numeric claim below is either a
literal, unedited line of a measurement script's stdout, quoted in a code
block, or is labeled *derivation* with its operation and inputs stated. Every
derivation in this section was recomputed mechanically (python3) from the
quoted inputs before being written down; none was transcribed from memory or
carried over from a prior draft. Where a prior figure cannot be re-verified it
is retracted, not reconciled.

### 7c.1 What is retracted

The "Round 5 review feedback" section below states that `^a*a{0,4000}$`
compiles in ~209ms, "determinizes to a handful of DFA states", consumes "only
~2-3 units each" of the DFA-state aggregate budget, and that a 50-pattern
corpus of that shape measured ~2.8 seconds across ~200,000 NFA constructions,
≈14 microseconds each. Every one of those figures came from a single
measurement batch that was never checked against the implementation's
internals, and the batch is inconsistent on its face — derivation: 50 × 209ms
= 10,450ms, not ~2,800ms; and ~2,800ms / 50 = 56ms per pattern, not 209ms. The
DFA-state claim is refuted outright by the measurement in 7c.2. The whole
batch — the DFA-state count, both wall-clock figures, the ~200,000
construction count, and the derived ≈14µs rate — is retracted together.
Nothing below supplies a replacement for the 50-pattern figure or the
per-construction rate; the ceiling reasoning in "Round 5 review feedback —
Ceiling for the new bound" that rested on them is therefore currently
unsupported (see 7c.5 and Round B).

### 7c.2 Instrumentation, and the corrected DFA-state count

Harness: `.kstack/evidence/host-portability-2026-09-02-hp-tc01-repair-r3-round7-measurement-harness.mjs`,
SHA-256 `354589a1cf47d2e0ca2ee78efb7a37ebbfafa0d7d612c76046822e83bf760ca1`
(re-verified with `sha256sum` before this section was written). It is a
verbatim copy of `parseClosedPatternAtoms`, `buildClosedPatternNfa`,
`closedPatternAlphabet`, and `determinizeClosedPattern` from
`plugins/kstack/scripts/kstack-host-contract.mjs`, extended only to return
internal counters production does not expose. Its fields, defined once here:

- `nfaSizeGuard` — the parse-time guard in `parseClosedPatternAtoms`: starts
  at 1 and adds each atom's quantifier maximum (2 for `*`/`+`), once per
  atom. **This is the field compared to the 4,096 per-pattern NFA-size cap**
  (7c.4). Every cap comparison in this section uses this field.
- `nfaNodeCount` — `states.length` after `buildClosedPatternNfa`: the raw
  count of automaton nodes allocated. Nothing in production compares it to
  any limit; it is reported only so the two counts can be told apart. It is
  roughly twice `nfaSizeGuard`, because every atom occurrence allocates two
  nodes (`in` and `out`).
- `symbolCount` — the alphabet-partition width from `closedPatternAlphabet`
  (128-slot array; nothing in code checks it against a limit).
- `dfaStateCount` — DFA states interned by `determinizeClosedPattern`; the
  event `maxPatternCompilationWork` counts.
- `sumMembersLength` / `maxMembersLength` — total and maximum, over all
  interned states, of the number of NFA nodes the determinizer's inner loop
  scans per symbol.
- `symbolMemberProduct` — derivation, verified on every line quoted in this
  section: `(symbolCount − 1) × sumMembersLength` (1 × 8,010,001 =
  8,010,001; 66 × 8,014,066 = 528,928,356; 2 × 14,338 = 28,676). This is the
  inner-loop iteration count of `determinizeClosedPattern`, whose loop runs
  `symbol = 1 … symbolCount − 1` over `members` for each interned state.

The round-5 counterexample, measured:

```
{"pattern":"^a*a{0,4000}$","bytes":13,"nfaSizeGuard":4003,"nfaNodeCount":8005,"symbolCount":2,"dfaStateCount":4001,"sumMembersLength":8010001,"maxMembersLength":4001,"symbolMemberProduct":8010001}
```

`^a*a{0,4000}$` produces **4,001 DFA states**, not a handful, and consumes
4,001 units of `maxPatternCompilationWork` per compilation, not 2-3.
Derivations: 4,096 − 4,001 = 95 DFA states of per-pattern headroom; 4,096 −
4,003 = 93 units of NFA-size headroom; 16,384 / 4,001 = 4.09, so four
patterns of this shape fit under the aggregate DFA-state ceiling (four at the
measured value: 4 × 4,001 = 16,004 ≤ 16,384; distinct variants with smaller
n cost no more) and a fifth does not — after four, at most 16,384 − 16,004 =
380 states remain, and every member of this family near n = 4,000 costs
about 4,000 (round-7f restatement; an earlier draft wrote the exceedance as
a repeated-value product). The pre-existing
DFA counter alone already meters this shape; the round-5 premise that it
consumed near-zero aggregate budget was false, and the pattern is large on
both axes at once, not "large-NFA/small-DFA".

Structural check of the harness's counts against the code (derivation, not
measurement): for `^a*a{0,n}$`, `nfaSizeGuard` = 1 + 2 + n, and
`nfaNodeCount` = 1 (start) + 3 (`a*`: one loop node plus one two-node
occurrence) + 1 (bounded-repetition exit node) + 2n = 2n + 5. At n = 4,000
these give 4,003 and 8,005; at n = 4,090 they give 4,093 and 8,185 — matching
the quoted lines here and in 7c.3 exactly.

### 7c.3 Harness fidelity — two production cross-checks

**(a) NFA-size boundary.** Harness:

```
{"pattern":"^a*a{0,4090}$","bytes":13,"nfaSizeGuard":4093,"nfaNodeCount":8185,"symbolCount":2,"dfaStateCount":4091,"sumMembersLength":8374276,"maxMembersLength":4091,"symbolMemberProduct":8374276}
{"pattern":"^a*a{0,4094}$","error":"KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT"}
{"pattern":"^a*a{0,4095}$","error":"KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT"}
{"pattern":"^a*a{0,4096}$","error":"KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT"}
```

The real, unmodified `compileClosedSchemaSet`, same inputs:

```
4090 ok
4094 FAIL KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT
4095 FAIL KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT
4096 FAIL KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT
```

Derivation: at n = 4,093 the guard is 1 + 2 + 4,093 = 4,096, which is not
`> 4,096`, so n = 4,093 is the last member of this family the guard admits; at
n = 4,094 it is 4,097 and rejects — where both harness and production reject.
This check exercises only phase one. It says nothing about DFA counting,
because no member of this family reaches the 4,096 DFA cap before the NFA
guard fires: `dfaStateCount` trails `nfaSizeGuard` by two at both measured
points (4,001 vs 4,003; 4,091 vs 4,093). That "n + 1 states" relation is
observed at two points, not established as a formula.

**(b) DFA-count-sensitive boundary** (the check round 7 lacked). Family
`^[ab]*a[ab]{W}$`, W the bounded-repetition count: tiny NFA, DFA-state count
driven by subset cardinality. Harness:

```
{"pattern":"^[ab]*a[ab]{10}$","bytes":16,"nfaSizeGuard":14,"nfaNodeCount":26,"symbolCount":3,"dfaStateCount":2049,"sumMembersLength":14338,"maxMembersLength":12,"symbolMemberProduct":28676}
{"pattern":"^[ab]*a[ab]{11}$","error":"KSTACK_HOST_PATTERN_DFA_LIMIT"}
```

Production:

```
^[ab]*a[ab]{10}$ production result: ok
^[ab]*a[ab]{11}$ production result: FAIL KSTACK_HOST_PATTERN_DFA_LIMIT
```

At W = 10 the harness reports `nfaSizeGuard` 14 (derivation: 1 + 2 + 1 + 10 =
14) and `dfaStateCount` 2,049 (derivation: 2^11 + 1 = 2,049), and production
accepts. At W = 11 (derivation: `nfaSizeGuard` 1 + 2 + 1 + 11 = 15, nowhere
near the NFA cap; expected DFA count 2^12 + 1 = 4,097 > 4,096) both harness
and production reject with `KSTACK_HOST_PATTERN_DFA_LIMIT`. The copied
determinizer's state counting therefore agrees with production at a boundary
only the DFA count can trigger, which is what the 4,001 figure in 7c.2 rests
on.

### 7c.4 Which field is compared to which cap

The per-pattern phase-one check is `kstack-host-contract.mjs` line 1716:
`if (nfaSizeGuard > HOST_CONTRACT_LIMITS.maxPatternDfaStates)
fail('KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT')`. The 4,096 NFA-size ceiling and
the 4,096 DFA-state ceiling are one constant, `maxPatternDfaStates`, reused
under two error codes — this is the precise form of round-1 clarification 2's
"not two different limits". `nfaNodeCount` is never compared to anything in
production. Round 7's comparison of an ~8,000 node count against the 4,096
cap was a category error in that draft, not an inconsistency in the
implementation.

### 7c.5 A specification gap in this document, surfaced by the measurement (stated, not fixed)

Both "Round 5 review feedback — Second normative fix" and §1 "Second normative
fix (round-5)" specify `maxPatternNfaConstructionWork` as incrementing "once
per NFA node/state constructed during parsing — the same event the existing
per-pattern `nfaSizeGuard` … already counts", and §1 "Check precedence" says
the per-pattern check fires "at each NFA node construction". The code does
neither: `nfaSizeGuard` increments once per *atom*, by that atom's quantifier
maximum (`{0,4000}` adds 4,000 in one step), inside `parseClosedPatternAtoms`;
node construction happens afterwards, in `buildClosedPatternNfa`, unguarded.
So "the same event" names two different populations — 4,068 versus 8,135 for
the pattern in 7c.6 — and the counter's 16,384 ceiling is calibrated against
neither by any surviving measurement (7c.1). This round does not resolve
which event the counter binds to; that is a mechanism question and is
deferred to Round B. Until it is resolved, every statement in this document
about that counter's binding point is ambiguous between the two readings, and
7c.7 states the admitted residual under both.

### 7c.6 The alphabet-width cost channel, measured

"Round 3 review feedback" argued that alphabet width and subset cardinality
"cannot be jointly maximized within the frozen 256-byte pattern-length
limit". A 78-byte pattern — `^a*a{0,4000}`, then 65 distinct single-character
literal atoms, one for every character `PATTERN_TOKEN`'s literal class
`[A-Za-z0-9_:.-]` admits except `a` (derivation, checked by tool against the
quoted line: the class has 66 characters, 66 − 1 = 65 atoms, and `b` is among
them; 12 + 65 + 1 = 78 bytes), then `$` — measures:

```
{"pattern":"^a*a{0,4000}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"nfaSizeGuard":4068,"nfaNodeCount":8135,"symbolCount":67,"dfaStateCount":4066,"sumMembersLength":8014066,"maxMembersLength":4002,"symbolMemberProduct":528928356}
```

Derivations: `nfaSizeGuard` 4,068 leaves 4,096 − 4,068 = **28** units of
NFA-size headroom; `dfaStateCount` 4,066 leaves 4,096 − 4,066 = **30** DFA
states; `symbolCount` 67 is 67 / 128 = 52% of the partition ceiling; 78 bytes
is 78 / 256 = 30% of the pattern-length limit. (The discarded round-7b draft,
and the prose notice at the top of the round-7 evidence record
`…-round7-measurement.md`, both state 68 for the NFA-size headroom; that was
a subtraction error, and 28 is the correct figure.) Structural check,
derivation: `nfaSizeGuard` = 1 + 2 + 4,000 + 65 = 4,068; `nfaNodeCount` = 1 +
3 + (1 + 2 × 4,000) + 65 × 2 = 8,135; `dfaStateCount` = 4,001 + 65 = 4,066 —
all matching the quoted line. The pattern sits under both per-pattern caps by
under 1% each, with a partition width over half its ceiling, in under a third
of the byte budget. The round-3 claim is refuted in its practical form: the
two dimensions need not be *maximized* jointly for cost to be large —
near-maximal subset cardinality plus a materially widened (not maximal)
alphabet is enough, as the timing shows.

Wall-clock, narrow-alphabet baseline `^a*a{0,4000}$` (30 trials, first 15
discarded as JIT warm-up, two independent process invocations):

```
{"label":"baseline-narrow-alphabet","pattern":"^a*a{0,4000}$","bytes":13,"trials":30,"warmup":15,"steadyMeanMs":238.986,"steadyMedianMs":226.372,"steadyMinMs":216.472,"steadyMaxMs":323.53}
{"label":"baseline-narrow-alphabet","pattern":"^a*a{0,4000}$","bytes":13,"trials":30,"warmup":15,"steadyMeanMs":233.199,"steadyMedianMs":221.767,"steadyMinMs":212.28,"steadyMaxMs":298.808}
```

The 78-byte pattern under the same 30-trial script (first 15 discarded; one
completed run — a second invocation reproduced the baseline and then exceeded
a 120-second command budget before finishing the widened pattern, so only one
30-trial widened figure exists):

```
{"label":"widened-alphabet-symbolCount67","pattern":"^a*a{0,4000}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"trials":30,"warmup":15,"steadyMeanMs":2715.814,"steadyMedianMs":2701.705,"steadyMinMs":2676.621,"steadyMaxMs":2840.884}
```

Derivation: 2,701.705 / 226.372 = 11.9 — about twelve times the baseline
median — for a pattern whose `dfaStateCount` (4,066 vs 4,001) and
`sumMembersLength` (8,014,066 vs 8,010,001) are almost unchanged and whose
`symbolMemberProduct` grew by 528,928,356 / 8,010,001 = 66×. The cost is
driven by `symbolCount`, which neither `maxPatternCompilationWork` (DFA
states) nor `maxPatternNfaConstructionWork` (NFA-side events, under either
reading in 7c.5) meters. Note also that the inner-loop proxy over-predicts:
iteration count grew 66× while wall-clock grew 12×, so `symbolMemberProduct`
is a conservative upper-bound-shaped proxy for this cost, not an estimate of
it (relevant to Round B).

This pattern's timing is measurement-sensitive. An earlier, smaller run of
the identical pattern (11 trials, 5 discarded):

```
{"label":"widened-alphabet-symbolCount67","pattern":"^a*a{0,4000}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"result":"ok","trials":11,"warmup":5,"steadyMeanMs":1003.161,"steadyMedianMs":1007.558,"rawMs":[942.85,3649.99,3646.98,1014.07,1000.21,986.25,991.64,1009.02,1007.21,1007.56,1017.29]}
```

The two ~3.6s values fall inside the five discarded warm-up trials; the six
steady trials are all near 1.0s (derivation: their mean from the two-decimal
`rawMs` values is 1,003.162, matching the script's `steadyMeanMs` 1,003.161
to within rounding), so this is a genuine ~1.0s steady state in that
invocation, not an averaging artifact — derivation: 1,007.558 / 2,701.705 =
0.37 of the 30-trial median. Method note, so a reviewer recomputing is not
surprised: the script's `steadyMedianMs` 1,007.558 is the upper-middle sorted
steady value (printed as 1,007.56 in the two-decimal `rawMs` list), not the
average of the two middle values (derivation: (1,007.21 + 1,007.56) / 2 =
1,007.385); a method difference in the script, not a data discrepancy, and
the 30-trial lines are unaffected because their `rawMs` are not printed. A still-earlier run of
the identical pattern text, under a different script and label, agrees with
the 30-trial figure rather than with this one:

```
{"label":"cheap-NFA + widen(n=65)","bytes":78,"result":"ok","steadyMean":2983.273,"steadyMedian":2987.716}
```

This section does not choose between ~1.0s and ~2.7s; both are quoted, and
7c.7 gives the residual at both.

**Entry point of the timing runs (round-7d precision; settled round 7f).**
The stored harness contains no timing code — its command-line entry only
prints `inspectPattern` results — so the harness did not itself produce any
timing line above; but it exports `inspectPattern`, so an unpreserved script
could in principle have timed that instead of production. What the record
establishes, line by line. (1) The 11-trial / 5-warm-up runs: the evidence
record's methodology states "(separate script, production
`compileClosedSchemaSet` called directly, not the harness)", which excludes
the harness for that method; its Data-table entry (2,987.7ms at 65 widener
characters) matches the 2,987.716ms line above to rounding, and the
1,007.558ms line is described as an 11-trial / 5-warm-up re-run "on a
differently-loaded process", so its entry point is inferred from that
statement, not stated. (2) A third, independent 30-trial run, added in round
7f, whose script is preserved at
`.kstack/evidence/host-portability-2026-09-02-hp-tc01-repair-r3-round7f-entrypoint-settled-measurement.mjs`,
imports `compileClosedSchemaSet` directly from
`plugins/kstack/scripts/kstack-host-contract.mjs` (its `import` line was read
before this paragraph was written) and labels the entry point in its own
output:

```
{"label":"baseline-narrow-alphabet-entrypoint-settled","entryPoint":"production compileClosedSchemaSet, imported directly from plugins/kstack/scripts/kstack-host-contract.mjs -- NOT the instrumentation harness or its exported inspectPattern","pattern":"^a*a{0,4000}$","bytes":13,"trials":30,"warmup":15,"steadyMeanMs":209.64,"steadyMedianMs":200.44,"steadyMinMs":190.708,"steadyMaxMs":270.084}
{"label":"widened-alphabet-symbolCount67-entrypoint-settled","entryPoint":"production compileClosedSchemaSet, imported directly from plugins/kstack/scripts/kstack-host-contract.mjs -- NOT the instrumentation harness or its exported inspectPattern","pattern":"^a*a{0,4000}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"trials":30,"warmup":15,"steadyMeanMs":2805.409,"steadyMedianMs":2360.846,"steadyMinMs":2252.213,"steadyMaxMs":4945.069}
```

(3) The two earlier 30-trial lines: the record says only that they were "run
in a separate script from the 11-trial/5-warmup figures". The author of the
round-7f rerun reports having checked that original script and found it
imports production `compileClosedSchemaSet`; that script is not in the
evidence directory (which holds the harness and the two round-7f scripts
only), so for those two lines the production entry point is reported, not
independently verifiable from the record. The earlier round-7d wording that
this was "not established" was accurate to the record at the time; the record
has since grown by (2).

What the third run adds to the cost picture: its widened median, 2,360.846ms,
is 2,360.846 / 200.44 = 11.8× its own baseline median (derivation), matching
the ~12× ratio of the second run. Three independent runs of this pattern now
sit in the ~2.4–3.0s range (2,987.716; 2,701.705; 2,360.846 medians) against
one at ~1.0s (1,007.558), and the real four-pattern combined call in 7c.7
(10,902.369ms) works out to 10,902.369 / 4 = 2,725.592ms per pattern
(derivation), inside the ~2.4–3.0s cluster and far from the ~1.0s figure. The
1,007.558ms measurement remains real, literal, and quoted, but it is weighted
as the outlier, not as an equally likely steady state. The counts in
7c.2-7c.3 are the harness's, cross-checked against production; the timings
are a separate provenance question, answered as above.

### 7c.7 Residual admitted by the current ceilings — three readings, a measured corpus, not a maximum

The patterns in a corpus must be distinct strings, since the cache key is
byte-exact. The corpus used here is the 78-byte pattern with its bounded
count varied 4,000, 3,999, 3,998, 3,997 (same 65-character widener suffix).
Round 7f measured all four with the harness (previously only n = 4,000 was
measured and the rest were extrapolated):

```
{"pattern":"^a*a{0,4000}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"nfaSizeGuard":4068,"nfaNodeCount":8135,"symbolCount":67,"dfaStateCount":4066,"sumMembersLength":8014066,"maxMembersLength":4002,"symbolMemberProduct":528928356}
{"pattern":"^a*a{0,3999}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"nfaSizeGuard":4067,"nfaNodeCount":8133,"symbolCount":67,"dfaStateCount":4065,"sumMembersLength":8010063,"maxMembersLength":4001,"symbolMemberProduct":528664158}
{"pattern":"^a*a{0,3998}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"nfaSizeGuard":4066,"nfaNodeCount":8131,"symbolCount":67,"dfaStateCount":4064,"sumMembersLength":8006061,"maxMembersLength":4000,"symbolMemberProduct":528400026}
{"pattern":"^a*a{0,3997}-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_bcdefghijklmnopqrstuvwxyz$","bytes":78,"nfaSizeGuard":4065,"nfaNodeCount":8129,"symbolCount":67,"dfaStateCount":4063,"sumMembersLength":8002060,"maxMembersLength":3999,"symbolMemberProduct":528135960}
```

Sums over the four measured lines (derivations): `dfaStateCount` 4,066 +
4,065 + 4,064 + 4,063 = 16,258; `nfaSizeGuard` increment events (the running
value less its start-at-1 initialization, e.g. 4,068 − 1 = 4,067) 4,067 +
4,066 + 4,065 + 4,064 = 16,262, or running values 4,068 + 4,067 + 4,066 +
4,065 = 16,266; `nfaNodeCount` 8,135 + 8,133 = 16,268 for two, 16,268 + 8,131
= 24,399 for three. Headroom left under 16,384 after four patterns: 16,384 −
16,258 = 126 DFA states; 16,384 − 16,262 = 122 increment events (16,384 −
16,266 = 118 running-value units). Which counter excludes a fifth pattern of
this shape depends on the reading (scoped round 7g; the unscoped "either
counter on any reading" wording was found wrong by Opus).
`maxPatternCompilationWork` excludes it under every reading: the four
measured variants cost 4,066, 4,065, 4,064, and 4,063 DFA states, so a fifth
of this shape needs on that order against 126 of headroom.
`maxPatternNfaConstructionWork` excludes it only under Reading A (increment
events on the same order as the measured 4,067 … 4,064, against 122, or 118
running-value units); under Reading B it rejects earlier, at the third
pattern (24,399 > 16,384), so a fifth never arises; under Reading C it does
not exclude it at all — four patterns consume 4 × 67 = 268 units, leaving
16,384 − 268 = 16,116, and a fifth needs 67 (Reading C below gives the
244-pattern NFA-alone figure). No fifth-pattern value needs to be assumed
for any of these statements. (Earlier drafts wrote
the five-pattern exceedance as 5 × one value; sums of five distinct values
would be 4,067 + 4,066 + 4,065 + 4,064 + 4,063 = 20,325 and 4,066 + 4,065 +
4,064 + 4,063 + 4,062 = 20,320, the last summand extrapolated; the
remaining-headroom argument above replaces both.)

**The real combined call (round 7f).** All four patterns were compiled
together in one real `compileClosedSchemaSet` call, production entry point,
by the script preserved at
`.kstack/evidence/host-portability-2026-09-02-hp-tc01-repair-r3-round7f-combined-call-measurement.mjs`
(its `import` line reads `compileClosedSchemaSet` from
`plugins/kstack/scripts/kstack-host-contract.mjs`; the script throws instead
of printing if the call rejects):

```
{"label":"combined-4-widened-patterns-one-call","entryPoint":"production compileClosedSchemaSet (direct import from kstack-host-contract.mjs, not the harness)","patternCount":4,"trials":15,"warmup":7,"steadyMeanMs":11536.376,"steadyMedianMs":10902.369,"steadyMinMs":9792.435,"steadyMaxMs":14336.957}
```

Two things this establishes, and one it does not. It establishes that four
such patterns clear every *per-pattern* cap in production and cost
**10,902.369ms ≈ 10.9s** median in one real call; and that round 7d's
extrapolation (4 × 2,701.705 = 10,806.82ms) was accurate to within about 1%
(derivation: 10,806.82 / 10,902.369 = 0.991), so the extrapolation is
corroborated, not merely retracted. It does not establish that the declared
aggregate counters admit these four patterns, because neither
`maxPatternCompilationWork` nor `maxPatternNfaConstructionWork` is
implemented in production (`kstack-host-contract.mjs` contains no reference
to either name or to the aggregate error codes; checked before this
paragraph was written) — whether they admit the corpus remains the
derivation from the quoted counts against §1's specification, as follows.

- **Reading A** — `maxPatternNfaConstructionWork` charges `nfaSizeGuard`'s
  per-atom increments by magnitude (the "same event" wording taken to mean
  the guard's own accumulated population; the accounting consistent with
  `maxPatternCompilationWork`, which starts at zero and charges one per DFA
  state created, 7c.2). Four patterns fit under both counters (16,262 ≤
  16,384 NFA-side; 16,258 ≤ 16,384 DFA-side); a fifth cannot (headroom 122
  and 126 against a need of about 4,000). Residual per
  `compileClosedSchemaSet` call: the measured **10.9s** (10,902.369ms).
- **Reading B** — the counter charges one per node constructed in
  `buildClosedPatternNfa` (`nfaNodeCount`). Two patterns fit (16,268 ≤
  16,384) and the third rejects (24,399 > 16,384) under
  `KSTACK_HOST_PATTERN_AGGREGATE_NFA_LIMIT` before its determinization runs.
  No two-pattern combined call was measured; residual by extrapolation from
  the per-pattern 30-trial medians: 2 × 2,360.846ms = 4,721.692ms to 2 ×
  2,701.705ms = 5,403.41ms, roughly **4.7–5.4s**.
- **Reading C (added round 7f; found by Opus)** — the counter charges one
  unit per *atom*: the clause's "increments once per NFA node/state
  constructed … the same event … `nfaSizeGuard` already counts" can be read
  as a literal one-unit-per-atom event counter, neither the guard's summed
  magnitude (Reading A) nor the raw node count (Reading B). The widened
  pattern has 67 atoms — `a*`, `a{0,n}`, and 65 single-character wideners
  (counted by tokenizing the quoted pattern text with the grammar's atom
  regex; the equality with `symbolCount` 67 is a coincidence of this
  pattern, not an identity). Under Reading C the NFA counter alone admits
  16,384 / 67 = 244.5, i.e. 244 such patterns (244 × 67 = 16,348 ≤ 16,384;
  245 × 67 = 16,415 exceeds). But `maxPatternCompilationWork` is declared
  normative independently of how the NFA clause is read, and it still
  rejects the fifth pattern (126 DFA states of headroom after four), so the
  *joint* residual for this shape under Reading C is unchanged: four
  patterns, the measured 10.9s. What Reading C changes is the NFA counter's
  own contribution: it becomes non-binding for this shape. The figure it
  would admit on its own — 244 × 2,360.846ms = 576,046.424ms ≈ 9.6 minutes
  per call at the third run's median (the preserved round-7f
  entrypoint-settled script in 7c.6, the timing line whose entry point is
  independently verifiable from the record), corroborated by 244 ×
  2,701.705ms = 659,216.02ms ≈ 11.0 minutes at the earlier 30-trial median
  (ordering per Opus, round 7f) — is what that counter alone would permit, not the joint
  bound, and it is the reason any respecification of the counter (Round B,
  Options 4a/4b) must name Reading A's magnitude semantics explicitly rather
  than "per atom".
  Why round 7d's wording had excluded this reading: 7c.7 then derived
  everything in terms of "increment events" summed as a magnitude (4,068 −
  1 = 4,067), which silently equated the clause's "increments once per …"
  with contributions to the guard's total rather than with a count of
  events. That phrasing hid a real widening of the *NFA-counter*
  uncertainty — from about four admitted patterns to about 244 — even
  though, for the reason just given, it does not widen the disclosed joint
  residual while `maxPatternCompilationWork` stands.

Which reading governs is exactly the open item in 7c.5, so the honest
statement is a range — and a range for one tested shape, not a maximum
(round-7d precision; figures updated round 7f): the cost of the specific
78-byte, `symbolCount`-67 pattern in 7c.6, taken two to four times per
caller-supplied `resolveHistoricalArtifact` call under the current ceilings,
is roughly 4.7–5.4s (two patterns, extrapolated) to a measured 10.9s (four
patterns, one real call) on the reference machine, depending on the
unresolved specification question. **Exposure is not bounded by a per-call
figure (round 7f; raised by Opus, acknowledged, unresolved):** nothing in
this document, and nothing found in `kstack-host-contract.mjs` (no
throttle, rate-limit, or invocation-count mechanism was found by search
near `resolveHistoricalArtifact`), establishes any bound on how many times
an attacker-reachable caller can invoke `resolveHistoricalArtifact`; the
per-call residual therefore does not bound real exposure, and no
call-frequency bound is assumed here because none exists in the record.
Nothing measured establishes that this shape maximizes cost among everything
the frozen 256-byte, 4,096-state, and 128-partition limits admit: no cited
bound excludes a wider-partition variant (the evidence record itself notes,
qualitatively, that partially-overlapping bracket-class atoms — not tried —
could plausibly push `symbolCount` further toward 128), so the true worst
case under the current ceilings is unestablished, is not derivable from what
has been measured, and would need its own investigation. This residual is
disclosed, not accepted as final; closing or accepting it is Round B's
decision, not this round's.

**Interim disposition (round 7g; a statement of the current risk state,
recorded at team-lead direction in response to Codex's round-7f block — not
a mitigation design).** Nothing new ships as a result of this correction
round: this document changes no code, and no code change is scheduled from
it ahead of Round B. The two declared counters are in different states and
the difference matters here. `maxPatternCompilationWork` is declared but
uncalibrated (softened round 7g at Opus's finding): its mechanism, per-call
scope, and cache semantics stand, but its 16,384 value's only calibration
is retracted (7c.1) and must be re-justified before it is implemented
(Round B open item (6); §1 Option B marker) — it is not ready to ship at
16,384 today. `maxPatternNfaConstructionWork` is on hold and must not be
implemented (§1). Neither exists in production:
`kstack-host-contract.mjs` contains no reference to either name or to the
aggregate error codes (checked in 7c.7). What production enforces today is
therefore only the per-pattern caps — `nfaSizeGuard` against
`maxPatternDfaStates` (4,096) at line 1716 and DFA states against the same
constant at line 1815 — and the per-call schema-count cap at line 2044,
`entries.length > HOST_CONTRACT_LIMITS.maxSchemas` (`maxSchemas: 256`)
rejecting with `KSTACK_HOST_SCHEMA_SET_INVALID`. No per-call bound on the
number of distinct patterns was found by search: each schema entry may carry
one or more `pattern` keywords (line 1906; cache keyed by the raw pattern at
lines 1911–1914), so one call admits at least 256 distinct patterns today;
the true per-call count is governed by `maxDocumentBytes` (1,048,576), not
`maxSchemas`, as Round B open item (8) already records (Opus, round 7e),
and it is not derived here. The measured
10,902.369ms (≈ 10.9s) four-pattern call is consequently a demonstration of
what one production call admits now — a lower bound, not a ceiling. As an
extrapolation only (no such call was run): 256 patterns at the combined
call's per-pattern rate is 256 × 2,725.592ms = 697,751.552ms ≈ 11.6 minutes
for one call (256 × 2,360.846ms = 604,376.576ms ≈ 10.1 minutes at the third
run's median). If `maxPatternCompilationWork` were implemented at its
declared 16,384 — a value pending recalibration, not authorized as-is — the
residual for this shape would become the measured 10.9s (four fit, the
fifth rejects); the NFA-side counter contributes nothing in either state. No bound
on how often an attacker-reachable caller can invoke
`resolveHistoricalArtifact` is established (the exposure caveat above). Per
team-lead direction, this state — an unbounded number of calls, each
admitting at least the measured 10.9s and by extrapolation minutes — is
recorded as an accepted open risk for the duration of the Round B wait; the
acceptance is the team-lead's, relayed here, not the author's. Round B is
therefore time-sensitive, not a follow-on design thread to run at leisure.
**Checkpoint caveat (added directly, not by Fable, at team-lead direction
before committing this revision as a checkpoint — round 7h/7i's confidence
dip and this specific gap are why the loop stops here rather than continuing
into a further round tonight).** The 256-pattern / ≈10.1-11.6-minute figure
above is a known lower bound only, not the accepted risk's real size. It is
anchored to `maxSchemas` = 256, while the paragraph itself already says the
real governing limit on per-call pattern count is `maxDocumentBytes`
(1,048,576 bytes) instead — a bound this document does not derive. The
multiple by which the real, `maxDocumentBytes`-governed exposure exceeds
the stated 256-pattern figure is unquantified and open; deriving it is
next-session work, along with reconciling it with open item (8). Any reader
of this document should treat "≈11.6 minutes" as the disclosed floor, not
the accepted risk's actual size.

The one interim measure cheap enough to assess without a design round —
Option 5 used standalone — is assessed in the next paragraph; any other
throttle, invocation-count bound, or stopgap counter is out of this round's
scope and needs its own review.

**Interim Option 5 feasibility (round 7g; the narrower question Opus raised
in its round-7g dissent, answered at team-lead direction — an assessment
for review, not an adoption, and not code).** The question: can a
standalone per-pattern `symbolCount` cap be implemented now as a narrow
interim measure, fully separate from and non-committing toward whichever
option Round B picks for the aggregate-budget question?
*What it would be.* One comparison in `compileClosedPattern` immediately
after `closedPatternAlphabet(atoms)` returns (line 1851) and before any NFA
or DFA work starts (line 1852): `alphabet.symbolCount` against a new
`HOST_CONTRACT_LIMITS` member, failing with a new distinct error code
(illustratively `KSTACK_HOST_PATTERN_ALPHABET_LIMIT`; no existing code
reused). It is the same kind of check as the existing per-pattern ones at
line 1716 (`nfaSizeGuard`) and line 1815 (DFA states): per pattern, no
per-call or module-level state, a deterministic pure function of the
pattern text, cache-neutral (a rejected pattern is never cached, lines
1911–1914), and it rejects before the cost it bounds is spent — earlier than
the DFA-state check, which can only reject after up to 4,096 states exist.
*Orthogonality.* It adds no aggregate accounting and reads nothing the
aggregate counters meter; Options 1, 2, 3, 4a, and 4b add, remove, or
respecify per-call counters and none of them reads `symbolCount`. Round B
could adopt any of the five afterward unchanged. The only interaction runs
the helpful way — open item (1)'s calibration of any per-call unit is
easier against a bounded width (Opus, round 7g) — and it is not a
substitute for any option: the per-call multiplication by admitted pattern
count (at least 256 distinct patterns per call today) is untouched.
*Structural ceiling (derivations from the code).* `symbolCount` starts at 1
(symbol 0 reserved, line 1767) and adds one per distinct membership
signature over codes 0–127 (lines 1768–1773). Every member code comes from
a pattern that line 1849 restricts to printable ASCII `\x20`–`\x7e`, and
class ranges (lines 1674–1677) span only printable endpoints, so at most 95
codes can carry a signature and `symbolCount` ≤ 1 + 95 = 96 — tighter than
the "~128-slot" array size. Equivalently, for any pattern text,
`symbolCount` ≤ 1 + the number of distinct characters in its atoms, which
bounds a given legitimate pattern without running the compiler.
*What the cap buys, by width.* Cost tracks width. The evidence record's
table for the `^a*a{0,4000}` + widener shape (the record labels its column
"n=11, 5 warmup") reads `symbolCount` 2 → 261.7ms, 18 → 481.1ms, 34 →
1,709.4ms, 50 → 2,311.5ms, 67 → 2,987.7ms. Relative to the width-67 row
(derivations): width 50 costs 2,311.5 / 2,987.7 = 0.774 of it, width 34
costs 1,709.4 / 2,987.7 = 0.572, width 18 costs 481.1 / 2,987.7 = 0.161.
Widths between the rows are unmeasured, so each row bounds a cap from one
side only: for a cap of 64, the nearest measured row *below* it is 50, so
the cost a 64-cap still admits is *at least* 0.774 of the tested shape's
per pattern (it removes at most 1 − 0.774 = 22.6%, and since width 64 sits
above width 50, very likely much less) and *at least* 256 × 2,311.5ms =
591,744ms ≈ 9.9 minutes for 256 patterns (against ≈ 11.6 uncapped); for a
cap of 32, the nearest row *above* it is 34, so a 32-cap admits *at most*
about 1,709.4ms per pattern of this shape and at most about 256 × 1,709.4ms
= 437,606.4ms ≈ 7.3 minutes for 256. A cap that changes the exposure
materially is therefore about 32 or lower — exactly where the risk of
rejecting a legitimate wide-alphabet pattern lives.
*What the record certifies without a measurement (derivation, round 7g).*
Applying the structural bound `symbolCount` ≤ 1 + distinct member codes to
the `pattern:` string literals in `plugins/kstack/scripts` — tokenized per
`PATTERN_TOKEN` (line 1666) with class ranges expanded per lines
1674–1677, by script, not by running the compiler — gives, for the six
grammar-admitted literals declared in `kstack-host-contract.mjs` itself
(lines 587–596): `^sha256:[0-9a-f]{64}$` 19 codes → ≤ 20;
`^[a-z0-9][a-z0-9._-]{0,127}$` (twice) 39 → ≤ 40; `^[A-Z][A-Z0-9_]{0,127}$`
37 → ≤ 38; the timestamp pattern 15 → ≤ 16; `^KSTACK-[A-Z0-9-]+-V[0-9]+$`
37 → ≤ 38. The three other literals in the plugin: `kstack-host-package.mjs`
line 164 contains `(?:`, which `PATTERN_TOKEN` does not admit, so it is not
this compiler's input; `kstack-review-schema.mjs` lines 89 and 91 (bounds
65 and 39) sit in a file that imports only `node:crypto`, not the host
contract, so the record does not show them reaching this compiler. So a cap
of 64 is certifiably safe, from the record alone, for every pattern this
plugin declares for this compiler (maximum bound 40 ≤ 64) and rejects the
tested shape (67 > 64); if the review-schema patterns were ever compiled
here, the certifiable value would rise to 66 (bound 65), which still
rejects 67. The certification's scope is exactly that: the plugin's own
declared patterns. `resolveHistoricalArtifact` compiles the schema set it
loads by digest from the artifact's caller-supplied `schemaSetDigest`
(lines 2164–2166, via `options.getObject`), so any stored schema set with
other patterns is outside what the bound certifies, and the current
HP-TC01 corpus's actual `symbolCount` distribution remains unmeasured in
this record (Opus, rounds 7e and 7g; Option 5's *Against*) — the author
does not have it and did not generate it for this round. The replay
consequence of a cap — a stored artifact whose schema carries a pattern
above it fails on its next replay, the class of hazard Fable and Opus
raised for the aggregate counter above, here depending on the artifact's
own patterns rather than its neighbors — fires only for patterns above the
cap, so under a certified 64 it does not fire for the plugin's declared
set; for other stored sets it cannot be excluded from the record.
*Answer, stated plainly.* Feasible as a mechanism and orthogonal to Round
B: yes. A defensible value from the record alone: yes, 64 — certifiably
safe for the plugin's own declared patterns and a rejection of the tested
shape — but it closes only widths 65–96, removing at most 22.6% of the
tested shape's cost and probably far less, and leaves the 256-pattern
figure at ≈ 9.9 minutes or more; it is a margin on the tested shape, not a
change in exposure. A cap that changes exposure (about 32 or lower):
sizeable from this record, no — the concrete blocker is the unmeasured
corpus distribution, and the replay consequence of a wrong value rules out
guessing. The narrow path to that cap is one corpus `symbolCount`
measurement (minutes of harness time over the declared patterns and any
stored schema sets in scope; the preserved harness's `inspectPattern`
reports `symbolCount` for any pattern text), quoted in 7c.6's literal form
and reviewed, then a value set with margin above the measured maximum. Any
cap at any value carries the same `ResourceLimitsV1` exclusion and
replay-versioning statements the first counter carries (open item (4))
and, unlike the aggregate counter, a Rust-side obligation to confirm at
implementation: the frozen `CrossRuntimeVectorSetV1` parity is
ACCEPT/REJECT and the Rust reference compiles patterns individually
(above), so a per-pattern rejection is within the per-pattern vectors'
reach. Residual limitations at any value: it bounds per-pattern width only
— not the per-call pattern count, not `members.length`-driven cost (fact
(iii)), and not invocation frequency.
*Decision (round 7i; team-lead's, relayed — the call left open in the
previous revision is now made).* **The 64-value cap is rejected and is not
recommended for shipping.** Reasoning: it removes at most 22.6% of the
tested shape's cost and likely far less — a bracket that assumes compile
cost is monotone in `symbolCount` at fixed DFA-state count, which the
table's five rows are consistent with but do not establish, and which is
labeled inference here (Opus, round 7h) — and it leaves the 256-pattern
extrapolation effectively unchanged (≥ 9.9 minutes against the current
≈ 10.1–11.6-minute estimate above). It would therefore look like a
mitigation without functioning as one, inviting false confidence while
carrying real cost: the replay-versioning and `ResourceLimitsV1`-exclusion
obligations any new limit incurs (open item (4)), and a Rust
cross-runtime-parity gap stated plainly here rather than deferred as
"confirm at implementation": Option 5 standalone would place a JS-only
per-pattern rejection inside the surface `CrossRuntimeVectorSetV1`
governs, and confirming that the frozen vectors still pass does not
address real-input divergence — any pattern whose `symbolCount` exceeds
the cap would be rejected by JS and accepted by the Rust oracle, so a
matching change in the Rust reference would be required, not a
confirmation (Opus, round 7h, finding HP-TC01-R7G-SEC-2). The "certifiably
safe at 64" statement above is read with its own scope caveat: the
certification covers the plugin's declared literals, while the replay
hazard a cap introduces fires on stored, caller-supplied schema sets loaded
by digest through `resolveHistoricalArtifact` — the population outside the
certification (Opus, round 7h).
**Corpus `symbolCount` measurement — authorized, pending, added directly at
team-lead direction (round 7i, later the same round).** A real measurement
of the current corpus's actual `symbolCount` distribution — the declared
patterns and the stored schema sets in scope — to find whether an effective
cap value (about 32 or lower, by the bracketing above) exists that would
meaningfully reduce exposure without breaking replay of existing stored
patterns. This is separate from, and faster than, Round B's full mechanism
decision, and it decides no mechanism — it does not commit this document to
Option 5 or any other candidate, including Opus's unevaluated
per-call-cardinality-guard alternative (still open — see the next-session
open items below). Authorized and pending, not urgent: no need to run it
immediately, but no reason to withdraw the authorization either, since the
measurement itself is neutral with respect to which interim mechanism (if
any) a future session eventually picks. A preliminary measurement was
already run directly against the production code, ahead of any urgency:
it queried `HOST_ARTIFACT_SCHEMAS`, `HOST_BOOTSTRAP_SCHEMA_DOCUMENTS`, and
`buildHostArtifactSchemaSet` (a representative vocabulary) directly rather
than grepping source, found exactly 5 distinct patterns in the real
production corpus, and every one has `symbolCount` ≤ 10 (widest: 10, for
the domain-name pattern; sha256 digest 9; timestamp 7; two ID-shape
patterns 3 each) — well under Fable's own ≈32-or-lower estimate for a cap
that would meaningfully reduce exposure. Script and full output are
preserved at
`.kstack/evidence/host-portability-2026-09-02-hp-tc01-repair-r3-corpus-symbolcount-measurement.mjs`.
This number is recorded here as evidence for whoever scopes the next
session's interim-mitigation decision; it is not adopted into this round's
Option 5 analysis or decision above, since that decision (reject the
64-value cap; do not adopt Option 5 standalone) already stands on its own
reasoning independent of this measurement. Until a mechanism is chosen, the
interim state is exactly the accepted open risk recorded above: nothing
ships from this round.

### 7c.8 What this round changes, and what it does not

Unchanged: both counters' mechanism, ceiling values (16,384 each), error
codes, per-call scope, cache semantics, and check precedence. Changed,
editorially only, relative to the round-6 digest in the header: the header
metadata block; this section; supersession markers (blockquotes beginning
"**Superseded (round 7c).**" or "**Superseded in part (round 7c).**") placed
at — "Round 5 review feedback" (section
opening, and the "Ceiling for the new bound" paragraph); "Round 4 review
feedback" (the "Large-NFA/small-DFA shape" paragraph and the "Measurement
methodology disclosed" paragraph); "Round 3 review feedback" (section
opening); §1 "Second normative fix (round-5)"; §1 "Check precedence and
traversal order"; §1 "Ceiling and closure scope"; §1's illustrative
wall-clock paragraph; the new "Round B" section; and "Review request".
Nothing else was touched. Reviewers of the packet cannot diff, so that list
is author-asserted; the author verified by `sha256sum` that the file equalled
the round-6 digest before the first round-7c edit.

**Round 7d edits (this revision).** Round 7c's dual review found no numeric
error; this revision addresses its five scope/precision items and nothing
else. Locations changed: 7c.6 (one wording fix, "Same harness" → "the same
30-trial script", and the new timing-entry-point paragraph); 7c.7 (final
paragraph relabeled from "worst case" to the measured cost of one tested
shape); this section (this paragraph, and one phrase in the paragraph above
it); §1 "Second normative fix (round-5)" marker
(implementation hold added); §1 cache-key sentence ("(+1)" made precise
against lines 1823 and 1911-1914); a new marker at §1's Option A / Option B
paragraph; Round B (Option 4 added; Option 3 and the recommendation
reworded); the header metadata; and "Review request". Nothing else.

**Round-7c findings addressed in a second 7d pass (outside the original
confirmed list; team-lead approved fixing them).** (a) Codex: the opening
paragraph said the delta adds "one new aggregate bound" while §1 declares
two — count corrected to two. (b) Codex: 7c.7's Reading A summed each
pattern's full `nfaSizeGuard` running value, including the guard's initial
1. Resolved by reading the counter as charging increment events only, the
accounting consistent with `maxPatternCompilationWork` (starts at zero, one
per DFA state actually created): sums are now 4,067 + 4,066 + 4,065 + 4,064
= 16,262 for four patterns (the five-pattern figure was first written as a
repeated-value product and is replaced in round 7f by the remaining-headroom
argument in 7c.7); "four fit, five do not" is unchanged under either
reading, and 7c.7 says so. (c) Codex:
Option 3's "its justification stands" for `maxPatternCompilationWork`
narrowed — mechanism, deterministic outcome, and distinct-pattern cap
survive; the sub-second calibration does not. (d) Opus: a "Superseded in
part (round 7d)" marker added in "Round 2 review feedback and Fable
arbitration" after the bullet judging the per-state cost-bound check
"closeable with more precise text … not a mechanism change".

**Round 7f edits (this revision).** Rounds 7d/7e found no numeric error;
this revision adds two literal measurements and addresses the items
team-lead approved. Locations changed: header metadata; 7c.2 (the
five-pattern sentence restated without a repeated-value product); 7c.6
(timing entry-point paragraph rewritten around the preserved round-7f
script and its two quoted lines; third-run weighting); 7c.7 (four measured
variant lines quoted; the real combined-call line quoted and 10.9s replacing
the 4 × 2,701.705 extrapolation; five-pattern exceedance restated as
remaining headroom; Reading C added with the explanation of why 7d's wording
excluded it; exposure caveat added); this section (this paragraph, and one
phrase in the second-pass paragraph above); §1 "Second normative fix
(round-5)" (inline hold in the clause's own text); §1's Option A / Option B
marker (figures updated); Round B (Opus's `dfaStateCount = nfaSizeGuard − 2`
observation added under fact (i); Option 4 split into 4a/4b; Option 5 added;
the single recommendation replaced by a neutral statement of each
reviewer's expressed preference; open items extended with recalibration of
the retained 16,384, settling fact (i), the exposure caveat, and the
Reading-A-semantics requirement); and "Review request". Nothing else.

**Round 7g edits (this revision).** Round 7f returned Codex block 22 and
Opus revise 78; this revision addresses the three items team-lead directed
and nothing else. Locations changed: header metadata; 7c.7 (the
fifth-pattern sentence scoped per reading — the DFA counter excludes a fifth
under every reading; the NFA counter excludes it under Reading A, rejects at
the third pattern under Reading B so a fifth never arises, and admits it
under Reading C — and the
"Interim disposition" paragraph added at the end of the section); this
section (this paragraph); "Round 5 review feedback" (inline hold notice
added to the "Second normative fix" declaration paragraph); §1 "Check
precedence and traversal order" (inline hold on check (1b)); and §1 "Ceiling
and closure scope" (inline hold on the closure sentences). "Review request"
is unchanged in scope by team-lead direction apart from its round label
(7f → 7g). Applied after team-lead approval, in a second pass of this
revision: Opus's third edit (7c.7's Reading C now leads with the 244 ×
2,360.846ms ≈ 9.6-minute figure from the preserved script, keeping 244 ×
2,701.705ms ≈ 11.0 minutes as corroboration) and its optional restatement of
Round B fact (iii) as a per-budget-unit ratio. Nothing else.

**Round 7g, third pass (this revision; after the round-7g review — Codex
block 24, Opus revise 80).** Four items at team-lead direction. Locations
changed: header metadata; "Review request" (the "≈ 11 minutes" shorthand →
"≈ 9.6–11.0 minutes" with provenance, one parenthetical only); 7c.7's
interim disposition (`maxPatternCompilationWork` restated as declared but
uncalibrated, not "awaiting implementation"; the "once implemented as
declared" sentence made conditional; the closing exclusion sentence
replaced by a pointer to the new paragraph); the new "Interim Option 5
feasibility" paragraph after the disposition; §1 "Problem" (one scoping
note marking the ~173ms/~44.3s/~31-minute figures as a narrow-alphabet
lower bound); Round B Option 5 (one cross-reference sentence); and this
section (this paragraph). No mechanism, ceiling value, error code, per-call
scope, or check precedence of either declared counter changed; the
feasibility paragraph is an assessment for review — it identifies 64 as
the value the record certifies for the plugin's own declared patterns (a
margin on the tested shape only) and states that a cap that changes
exposure needs a measurement that does not yet exist; it adopts nothing.
Nothing else.

**Round 7i (this revision; after the round-7h review — Codex block 18,
Opus revise 78).** Team-lead's decision recorded, at team-lead direction.
Locations changed: header metadata; 7c.7's "Interim Option 5 feasibility"
paragraph (the closing "team-lead's call" sentence replaced by the
decision: the 64-value cap rejected with its reasoning; the Rust
real-input parity gap stated plainly, quoting Opus's round-7h finding
HP-TC01-R7G-SEC-2; the width-monotonicity bracket labeled inference; the
"certifiably safe at 64" statement reconciled with its scope caveat; and
the authorized, pending corpus `symbolCount` measurement stated as
separate, faster-moving empirical work that decides no mechanism);
"Review request" (round label; the opening sentence; new review item (5)
covering the feasibility analysis, the reject-64 reasoning, and the
measurement's scope); and this section (this paragraph). No new
measurement and no new number: every figure in the decision text is one
already quoted or derived above. Not addressed here, held for team-lead:
Opus's round-7h request to state the ≈ 11.6-minute figure as a floor by
an unquantified multiple, and its dissent proposing `maxPatternCompilationWork`
as a pure per-call cardinality guard as an interim measure. Nothing else.

**Checkpoint (this pass; recorded directly, not by Fable, at team-lead
direction).** Round 7i's dual review was not dispatched. Team-lead's
direction after reading round 7h's result (Codex block 18, Opus revise 78):
six passes since the original round-7c correction (7c through 7h) is a
loop, not iteration, and 7h's confidence dip plus the exposure-magnitude
question below are past the point of profitably chasing further tonight.
This document is committed as a **checkpoint, not a closure** — the same
treatment this project gives any unconverged design round. Two edits were
made directly in this pass, outside Fable's authoring role, both
bookkeeping/disclosure rather than design: the checkpoint caveat added to
the interim disposition above (the 256-pattern/≈11.6-minute figure restated
explicitly as a known lower bound only, the real `maxDocumentBytes`-governed
multiple left explicitly unquantified rather than estimated); and the
corpus `symbolCount` measurement paragraph above, left authorized and
pending (not withdrawn — the measurement itself commits this document to no
particular interim mechanism), with the preliminary measurement already run
recorded as evidence for whichever mechanism a future session picks.

**Open items for the next session (round 7h's findings; none resolved in
this pass, listed for continuation).**
1. Section 1's `maxPatternCompilationWork` = 16,384 declaration
   ("**is the normative value selected by this addendum**", in "1. Global
   limits") still reads as fully normative with no inline qualification —
   unlike `maxPatternNfaConstructionWork`, which received an inline
   "ON HOLD, NOT NORMATIVE AS WRITTEN" treatment in three locations across
   rounds 7d/7f. The interim disposition and Round B open item (6) already
   say this value needs re-justification before implementation; Section 1's
   own declaration paragraph does not yet say so in place (Opus, round 7h,
   failed check 1; still open).
2. The "Interim Option 5 feasibility" paragraph's cost-by-width figures
   (`symbolCount` 2/18/34/50/67 against their millisecond costs) are cited
   from the round-7-measurement evidence file's table, in prose, not
   reproduced as a literal quoted block inside this document — a gap
   against 7c's own stated standard that every numeric claim be a literal
   quote or a labeled derivation (Opus, round 7h, failed check 2; still
   open).
3. Opus's Option 6 candidate — using `maxPatternCompilationWork` purely as
   a per-call cardinality guard (capping the number of distinct patterns
   compiled per call, independent of its retracted wall-clock calibration)
   as an interim measure, simpler than and possibly complementary to Option
   5 — has not been evaluated with the same one-paragraph feasibility
   treatment Option 5 received (Opus, round 7h, material dissent; still
   open).
4. Resolved in this thread, not carried forward as open: the
   ≈11.6-minute exposure figure's floor-not-ceiling status (addressed by
   the checkpoint caveat above, this pass); the width-monotonicity
   assumption (labeled inference, round 7i); the "certifiably safe at 64"
   headline/scope-caveat mismatch (reconciled, round 7i); and the Rust
   cross-runtime-parity gap for Option 5 specifically (stated plainly,
   round 7i) — though whether that parity obligation generalizes to any
   other width-sensitive mechanism a future session might propose is not
   evaluated and would need its own check.
5. The corpus `symbolCount` measurement's relevance is scoping-dependent on
   item 3 above: if a future session picks Option 5 (or a similar
   width-capping mechanism), the preliminary measurement recorded above
   (production corpus max `symbolCount` = 10) is directly usable; if it
   picks the cardinality-guard option or something else, this measurement
   may not be the one that's needed.

## Round 1 review feedback

Round 1's dual review split: Codex approved (95, clean). Opus returned revise
(72) with four failed checks, all agreeing the mechanism and the chosen
ceiling (Option A, 16,384) were correct in direction, but finding the
addendum under-specified on four points. This round makes four additive
clarifications addressing each, with no change to the mechanism or the chosen
ceiling:

1. **Cache scope was undeclared.** Fixed below: the compilation cache is
   normatively scoped to one `compileClosedSchemaSet` invocation, citing the
   exact implementation evidence for this (a fresh cache is constructed at
   the top of every call, never reused across calls).
2. **The wall-clock ceiling justification rested on one unvalidated sample.**
   Fixed below: the normative claim is now stated purely in step-count terms
   (identical units to the already-frozen per-pattern bound), with wall-clock
   numbers demoted to non-normative illustrative context. The per-pattern
   `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT` value is also now cited explicitly —
   it shares the same 4,096 numeric ceiling as `maxPatternDfaStates`, they are
   not two different limits.
3. **Check precedence and traversal order were not fixed.** Fixed below:
   precedence is stated explicitly, and traversal order is bound to the
   canonical `SET_BY_FIELDS` ordering repair-r2 §1 already requires for
   `schemaEntries`, rather than left as an implementation choice that JS and
   Rust could diverge on.
4. **No headroom statement against the maximum admissible corpus, and no
   replay-versioning statement.** Both added below.

## Round 5 review feedback — the grammar-inexpressibility claim was wrong

> **Superseded (round 7c).** The figures in the paragraph below — ~209ms,
> "a handful of DFA states", "~2-3 units each", ~2.8 seconds for 50 patterns
> — are retracted as one unverified, internally inconsistent batch (see
> "Round 7c correction", 7c.1). Measured against the implementation,
> `^a*a{0,4000}$` produces 4,001 DFA states and consumes 4,001 units of
> `maxPatternCompilationWork` (7c.2); it is not a large-NFA/small-DFA shape.
> The paragraph is retained as history only. The "same event … `nfaSizeGuard`
> already counts" wording in the second paragraph is also affected: see 7c.5
> for the event mismatch, deferred to Round B.

Round 5's "structurally inexpressible" closure argument (below, in "Round 4
review feedback") was refuted by both reviewers independently, with the same
concrete counterexample: `^a*a{0,4000}$` — a concatenation of exactly two
single-leaf quantified atoms, no grouping or alternation required. Verified
directly against the implementation: this pattern compiles in ~209ms and
determinizes to a handful of DFA states (a leading unbounded `*` over an atom
whose accepted set matches the trailing bounded repetition's atom causes
subset construction to converge to a stable, small set of states) while its
NFA construction is proportional to the repetition count, ~4,000 NFA
node/state constructions. A corpus of 50 such distinct patterns (repetition
count varied to defeat the byte-exact cache key), well within
`maxDocumentBytes`, measured at **~2.8 seconds** while consuming only ~2-3
units each of the 16,384 DFA-state aggregate budget — meaning a
budget-filling adversarial corpus of this shape could approach the same
order-of-magnitude compile time as the original, pre-addendum problem this
design exists to close. The prior round's grammar-citation argument is
withdrawn as incorrect; the finding is closed instead the way both reviewers
independently converged on: a second, directly metered aggregate bound.

**Second normative fix: aggregate NFA-construction-work bound — ON HOLD, NOT
NORMATIVE AS WRITTEN (rounds 7d/7f; notice extended to this paragraph round
7g).** *Inline notice, part of this paragraph's own text: this clause is not
implementable as written and must not be implemented. The supersession
marker below retracts its figures; this notice withdraws its standing as an
instruction. Its counted event admits three readings (7c.7, Readings A, B,
and C) with different accept/reject outcomes at the same ceiling, its 16,384
value has no surviving justification (7c.1), and whether it is retained,
respecified, or replaced is the Round B decision. The text that follows is
retained verbatim as the declared text under review, not as a normative
instruction; §1 "Second normative fix (round-5)" carries the same notice.*
Declare a
second new global limit, `maxPatternNfaConstructionWork`, a non-negative
integer counter scoped to exactly one `compileClosedSchemaSet` invocation
(same per-call lifetime and construction as `maxPatternCompilationWork`,
never module-level or cross-call), shared across every pattern parsed during
that call. The counter increments once per NFA node/state constructed during
parsing — the same event the existing per-pattern `nfaSizeGuard`
(`KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`, ceiling 4,096) already counts,
evaluated at that same site, immediately before the aggregate check. This
runs strictly before determinization/subset-construction for that pattern,
so it is checked and can reject before any DFA-state work (and therefore
before `maxPatternCompilationWork`) is spent on that pattern. Exceeding
`maxPatternNfaConstructionWork` rejects the entire schema-set compilation
closed under a new distinct error code, `KSTACK_HOST_PATTERN_AGGREGATE_NFA_LIMIT`
— never reusing `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT` (the per-pattern bound)
or `KSTACK_HOST_PATTERN_AGGREGATE_LIMIT` (the DFA-state aggregate bound).
These are two independent counters over two independent construction phases;
neither substitutes for the other, and this addendum's mechanism, per-call
scope, cache-key discipline, and check-precedence pattern (per-pattern check
first, aggregate check second, allocation third) apply identically to both.

> **Superseded (round 7c).** The measurement chain in the paragraph below
> (~2.8s / ~200,000 NFA constructions / ≈14 microseconds per construction /
> ≈230ms for 16,384) belongs to the same retracted batch (7c.1). The 16,384
> value therefore has no surviving cited justification; whether it is kept,
> modified, or replaced is the Round B decision, not settled here.

**Ceiling for the new bound.** `maxPatternNfaConstructionWork` = 16,384 NFA
node/state constructions per call — the same numeric value as
`maxPatternCompilationWork`, chosen for the same ratio this addendum already
uses for the DFA-state bound: 4x the existing per-pattern ceiling (4,096).
Measured directly: at the empirical rate observed above (~2.8s / ~200,000 NFA
constructions across the 50-pattern corpus, ≈14 microseconds per NFA
construction on the reference machine), 16,384 NFA constructions is
illustratively ≈230ms — comparable to, and no worse than, the DFA-state
bound's own measured worst case, and closes the residual channel to the same
order of magnitude this addendum already established for the DFA-state
channel. This is presented as a candidate value for review, consistent with
how `maxPatternCompilationWork`'s own value was arrived at across this
document's revision history — reviewers should confirm or propose an
alternative grounded in the same measurement approach.

## Round 4 review feedback

Round 4 converged: both Codex (79, down from 96) and Opus (80) independently
landed on the same core gap, rather than splitting — a first for this
candidate. Both identified that the aggregate counter meters DFA-state
creation only, and that per-pattern NFA construction/epsilon-closure work
(bounded per-pattern at 4,096 by `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`, but
never metered in aggregate) could in principle let many distinct
large-NFA/small-DFA patterns consume near-zero aggregate budget while
performing substantial unmetered work. Opus additionally raised: whether the
frozen `CrossRuntimeVectorSetV1` contract could be violated by a new JS-only
aggregate reject; that the ceiling was still framed as an open two-option
choice rather than normatively fixed; and housekeeping (measurement
methodology disclosure, an in-code marker against the `ResourceLimitsV1`
omission, a reversibility rationale for choosing the tighter option). Each is
addressed below with either a grammar-grounded structural argument or a
direct code citation, per Opus's own offered resolution path ("If the frozen
per-pattern grammar provably cannot express [this shape]... say so and cite
the grammar clause instead — that closes the finding without a
measurement").

> **Superseded (round 7c).** This section's opening paragraph states the
> large-NFA/small-DFA hypothesis generically, and the paragraph below applies
> it to `^a*a{0,4000}$` as a shape whose cost is "disproportionate to its
> DFA-state footprint". Measured, it is not:
> 4,001 DFA states against an NFA-size guard of 4,003 (7c.2). No verified
> instance of a large-NFA/small-DFA shape currently exists in this record, in
> either direction (Round B, fact (i)).

**Large-NFA/small-DFA shape — grammar-citation closure attempted and
withdrawn; see "Round 5 review feedback" above for the actual fix.** An
earlier draft of this section claimed the large-NFA/small-DFA shape was
structurally inexpressible under repair-r2's concatenation-only grammar. Both
reviewers refuted this with a concrete two-atom counterexample
(`^a*a{0,4000}$`, requiring no grouping or alternation) that does produce the
shape, confirmed empirically to cost real, non-negligible aggregate time
disproportionate to its DFA-state footprint. That grammar-citation argument
is withdrawn. The finding is instead closed by a second, directly metered
aggregate bound — `maxPatternNfaConstructionWork` — declared normatively in
this section below and explained in full in "Round 5 review feedback" above.

**`CrossRuntimeVectorSetV1` is not a schema-compilation parity contract.**
Its `VectorEntryV1` entries are keyed by `operationId` and consumed
exclusively by `requireImplementationClosure`, which checks each *invariant*
registry entry's declared `vectorIds` against the caller-supplied passing set
— this is the invariant-implementation-behavior vector-passing mechanism
(unrelated to HP-TC01's finding-1 invariant-digest work, and unrelated to
schema/pattern compilation). It contains no schema-set-compilation or
pattern-acceptance vectors, and nothing in this addendum touches it. The new
JS-only `KSTACK_HOST_PATTERN_AGGREGATE_LIMIT` reject therefore has no
existing cross-runtime parity contract to violate — this is confirmed by
reading the actual consuming code, not merely asserted.

**Ceiling fixed normatively; reversibility rationale stated.** This addendum
selects **Option A — `maxPatternCompilationWork` = 16,384** as the frozen
value, not an open choice deferred to reviewer preference. Reversibility
rationale for preferring the tighter bound despite its thinner per-schema
headroom: because this limit lives in `HOST_CONTRACT_LIMITS` only, outside
every content-addressed surface (see "Replay versioning" above), raising it
later if a legitimate corpus ever needs more headroom is a cheap,
digest-free operational change — it never requires a metaschema version
bump or invalidates any existing digest. The asymmetry between "raising
later is free" and "starting too loose is a live DoS surface" favors the
tighter initial value. Option B (65,536) remains rejected on this basis, not
merely on measured cost.

> **Superseded (round 7c).** The qualitative finding this paragraph says the
> addendum relies on — "alphabet width does not multiply compile cost" — is
> contradicted by 7c.6: the same DFA-state count costs about 12× more at
> `symbolCount` 67 than at 2. The single-run figures themselves were never
> re-verified and stand as disclosed, unverified measurements.

**Measurement methodology disclosed.** Round 3's figures (~31-32ms
alphabet-invariant linear-chain compilation; single-digit-millisecond
time-to-limit for overlapping-atom subset-explosion constructions; ~86ms for
an ~16,000-state four-pattern construction) were single-run wall-clock
measurements (`process.hrtime.bigint()` around direct
`compileClosedSchemaSet` calls) taken on the same development machine used
for this session's other HP-TC01 performance evidence (the ~173ms/~44.3s
figures cited in the Problem statement above, from round 2 of the HP-TC01
candidate-verification thread's independent adversarial review). They are
disclosed as single-run, non-averaged measurements, not a statistically
repeated benchmark; the qualitative finding they support (alphabet width does
not multiply compile cost; adversarial constructions terminate at the
per-pattern or aggregate limit in well under 100ms) is what this addendum
relies on, not the exact millisecond figures. The "current HP-TC01 corpus
needs well under 1,000 total DFA states" headroom claim is sourced from that
same round-2 review's corpus measurement, not independently re-derived here.

**In-code marker required at implementation time (non-normative note for the
implementer, not a change to this design).** The implementation must include
a comment at the `HOST_CONTRACT_LIMITS` declaration of
`maxPatternCompilationWork` stating explicitly that its absence from
`ResourceLimitsV1` and every other bootstrap record is deliberate (per the
"Replay versioning" section above), so a future maintainer does not "fix"
the asymmetry by adding it there and silently fail every stored historical
artifact closed on next replay.

## Round 3 review feedback

> **Superseded (round 7c).** Two claims in this section are contradicted by
> the measurement in 7c.6: that "widening the alphabet did not increase
> compile cost — it decreased time-to-limit", and that "the two adversarial
> dimensions are not independently maximizable inside 256 bytes; every
> construction attempted confirms this". A 78-byte pattern at `nfaSizeGuard`
> 4,068 / `dfaStateCount` 4,066 / `symbolCount` 67 compiles in ~2.7s (30-trial
> median) against ~226ms for the narrow-alphabet baseline. The constructions
> this section timed did not include that shape. Its specific millisecond
> figures were single-run and never re-verified. Opus's round-3 dissent (the
> subset-cardinality × alphabet-width product) was therefore right in
> substance and is reopened for the Round B mechanism decision.

Round 3 converged substantially: Codex approved again (96, clean, endorsing
Fable's ruling in full). Opus's confidence rose to 80 and it explicitly
agreed with five of Fable's six arbitrated points (cache key, closure-scope
statement, traversal order, replay-versioning/content-addressing correction,
and the `ResourceLimitsV1` exclusion) — it dissented only on one: that
Fable's "bounded by a fixed constant independent of any adversarial input
shape" phrasing overstated what the frozen grammar actually establishes,
since a DFA state's transition-partition work scales with both its subset
cardinality (bounded by the 4,096 NFA-size ceiling) and the alphabet
partition width (bounded at 128 slots) — a theoretical worst-case product of
roughly 4,096 × 128 per state that the packet had not measured or bounded.

This was investigated empirically against the real implementation rather
than argued further in the abstract, per Opus's own recommendation ("If the
product is unacceptable... meter transition-computation steps"; the
investigation below determines whether that escalation is actually needed).
Dozens of adversarial pattern constructions were compiled and timed directly
against `compileClosedSchemaSet`, deliberately targeting the theoretical
worst case: wide, overlapping character classes combined with quantified
repetition structures already known to drive subset-cardinality blowup
(the same `[ab]*a[ab]{20}`-shaped construction the existing implementation's
own regression test uses to prove the per-pattern bound fires). Finding: **widening
the alphabet did not increase compile cost — it decreased time-to-limit.**
A pure linear-chain near-cap pattern with a 26-symbol alphabet
(`^[a-z]{0,4000}$`) and one with a 94-symbol alphabet (`^[!-~]{0,4000}$`)
compiled in statistically indistinguishable time (~31ms vs ~32ms on the
reference machine). Combining a wider, overlapping alphabet with the
subset-exploding tracker structure reached the per-pattern 4,096-state limit
in single-digit milliseconds — faster, not slower, than the narrow-alphabet
case — because higher symbol fan-out increases the reachable-state growth
rate per BFS layer, and the per-pattern guard (`KSTACK_HOST_PATTERN_DFA_LIMIT`)
fires and aborts further work as soon as the 4,096th state is interned.
Directly measuring a construction totaling approximately 16,000 DFA states
(four distinct near-per-pattern-cap patterns in one `compileClosedSchemaSet`
call, approaching the proposed Option A aggregate ceiling) compiled in
**~86ms**. The structural reason wide alphabet cannot combine multiplicatively
with deep subset explosion within this grammar: `closedPatternAlphabet`
partitions the alphabet by *distinct atom-set membership signature*, not by
raw character-class width, so a single repeated wide bracket class collapses
to a small symbol count regardless of how many characters it spans — reaching
a large symbol count requires many *distinct, overlapping* atoms specified in
the pattern text, and specifying enough of them to approach the 128-slot
ceiling consumes pattern-byte budget that competes directly, within the
frozen 256-byte pattern-length bound, against the repetition/quantifier bytes
needed to also drive subset cardinality toward the 4,096-state ceiling. The
two adversarial dimensions are not independently maximizable inside 256
bytes; every construction attempted confirms this rather than merely arguing
it. This closes Opus's round-3 dissent with a measured worst-case bound in
place of Fable's overstated theoretical claim, and confirms — rather than
merely asserts — that Option A's ceiling closes the compile-time-DoS surface
with wide empirical margin. The mechanism, per-call scope, and error code are
unchanged, per Opus's own explicit request not to redesign them.

## Round 2 review feedback and Fable arbitration

Round 2's dual review deepened rather than resolved: Codex approved (96,
clean). Opus revised (71) with six failed checks, three security findings,
and — new in round 2 — a structural objection that the whole-call counter
scope makes an artifact's replay validity depend on unrelated neighbors in
its schema set, favoring Option B (65,536) over Option A. Per this repo's
Fable-arbitration trigger (real, deepening disagreement that a second round
between the two reviewers did not resolve), the disagreement was arbitrated
by Fable, who read the actual implementation (`kstack-host-contract.mjs`,
`main.rs`) rather than the packet text alone. Fable's ruling:

- **The mechanism and Option A are sound; no design change is needed.**
  Codex's approval stands.
- **Opus's central objection (replay non-monotonicity from corpus growth) is
  rejected on a false premise.** `resolveHistoricalArtifact` loads and
  verifies the schema set by its own content digest; a historical artifact
  binds to that exact, immutable set forever. Adding unrelated entries
  elsewhere produces a *different* set under a *different* digest and never
  touches the old one. Opus's proposed fix (scope the counter to only the
  resolved entry) would have been actively harmful — it reopens the
  256-entry compounding DoS this addendum exists to close.
- **Fable found a different, real replay hazard neither reviewer named:**
  this document's claim that the new limit works "exactly like" existing
  `HOST_CONTRACT_LIMITS` members and is outside every content-addressed
  surface is false for the *existing* limits — they are already embedded in
  the frozen `ResourceLimitsV1` bootstrap record, loaded by digest on every
  replay. Declaring the new limit there the same way would fail every
  already-stored historical artifact closed on its next replay. Fixed below:
  the new limit is scoped to `HOST_CONTRACT_LIMITS` only, explicitly not
  added to `ResourceLimitsV1` or any bootstrap record in this round.
- **The document's cross-runtime error-code-parity claim overstated the Rust
  side.** The Rust reference has no schema-set-compilation function and
  compiles patterns individually; the frozen cross-runtime parity contract
  (`CrossRuntimeVectorSetV1`) is ACCEPT/REJECT only, not error-code equality.
  Fixed below: that claim is dropped; the Rust obligation is stated as
  conditional on the oracle ever gaining a schema-set-compile entry point.
- Opus's other five failed checks (cache key, per-state cost bound, the
  unmetered-parse-channel concern, intra-schema traversal order, and two
  vacuous/underspecified sentences) were each judged closeable with more
  precise text grounded in the actual implementation, not a mechanism change.
  Each is fixed below.

> **Superseded in part (round 7d).** The bullet above's judgement that
> Opus's per-state cost-bound check was "closeable with more precise text
> grounded in the actual implementation, not a mechanism change" did not
> hold: the per-state cost is driven by `(symbolCount − 1) × members.length`
> work that neither declared counter meters (7c.6: about 12× the baseline
> wall-clock at the same DFA-state count), and closing it is now the Round B
> mechanism fork. The other four items in that bullet are unaffected.

## 1. Global limits — aggregate pattern-compilation-work bound (addendum)

**Problem.** Repair-r2 §1 bounds one compiled pattern's DFA to at most 4,096
real states via lazy subset construction, but places no bound on the total
compilation work performed across every pattern compiled during one
`compileClosedSchemaSet` invocation. Independent adversarial review of the
implementation (round 2 of the HP-TC01 candidate-verification thread) measured
approximately 173ms to compile a single pattern near the existing per-pattern
bound, and approximately 44.3s to compile a 256-schema, ~25KB document whose
patterns sit near that bound — extrapolating to roughly 31 minutes at the
existing `maxDocumentBytes` ceiling of 1,048,576 bytes. Every individual
pattern in that construction stays inside the frozen per-pattern bound, so
this is a compile-time denial-of-service surface the per-pattern bound alone
does not close.
*Scope of these figures (round 7g; raised by Opus): the record does not
state the alphabet width of the round-2 patterns, but every near-cap timing
in this record at that order of cost is a narrow-alphabet one (`symbolCount`
2: ~226ms median in 7c.6, 261.7ms in the evidence table), while the same
DFA-state count at `symbolCount` 67 measures ~2.7–3.0s — about 12× (7c.6).
The ~173ms, ~44.3s, and ~31-minute figures are therefore a lower bound for
one alphabet width, not this document's worst case: the interim
disposition's 256-pattern extrapolation for the same 256-schema corpus
size, 697,751.552ms ≈ 11.6 minutes, is 697,751.552 / 44,300 = 15.75 ≈ 15.8×
the 44.3s figure (derivation). Nothing here is refuted; the figures are used
for what they establish.*

`resolveHistoricalArtifact` already compiles every entry of `schemaEntries`
(bounded by the existing `maxSchemas` = 256) through exactly one
`compileClosedSchemaSet` call before resolving the single entry matching
`expectedSchemaDigest`. A bound scoped to one `compileClosedSchemaSet`
invocation therefore already covers that multi-entry compounding factor by
construction; no separate multi-entry clause is required.

**Normative fix.** Declare a new global limit, `maxPatternCompilationWork`, a
non-negative integer work counter scoped to exactly one `compileClosedSchemaSet`
invocation and shared across every pattern determinized during that call. The
counter increments by exactly one for every DFA state actually created during
lazy subset construction — the same event the existing per-pattern
`maxPatternDfaStates` check already counts. A pattern served from the
compilation cache performs no subset construction and adds nothing to the
counter. The aggregate check is evaluated at the same state-creation site as
the existing per-pattern check, immediately before a new state is allocated:
work a per-pattern check has already rejected cannot also spend aggregate
budget, and only states that individually clear the per-pattern bound can
count against the aggregate one. Exceeding `maxPatternCompilationWork` rejects
the entire schema-set compilation closed, before any further pattern in that
call is processed, under a new distinct error code,
`KSTACK_HOST_PATTERN_AGGREGATE_LIMIT`. This must never reuse
`KSTACK_HOST_PATTERN_DFA_LIMIT` or `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`, which
remain exactly the per-pattern bounds they already are.

The bound is a discrete, platform-independent step count (DFA states created)
within the JS implementation, so the accept/reject outcome for a given input
is a pure function of that input, deterministic and reproducible run to run.
State creation happens eagerly at compile time inside pattern compilation
itself — never deferred to match time — so a counter scoped to one
`compileClosedSchemaSet` call captures the complete state-creation cost of
that call; nothing relocates past the call boundary. The Rust reference
oracle has no schema-set-compilation entry point today: it validates each
pattern individually rather than compiling a whole set. This addendum makes
no cross-runtime error-code-parity claim (see repair-r2's existing
`CrossRuntimeVectorSetV1` contract, which is ACCEPT/REJECT-only and already
unaffected by this addendum). If the oracle later gains a schema-set-compile
entry point, it must implement the identical per-call counter and cache
semantics described below; until then this section is descriptive of the JS
implementation only.

There are exactly three call sites for pattern-set compilation today: two
compile fixed, built-in constant schema sets at module load and are not
attacker-influenced; the third, inside `resolveHistoricalArtifact`, is the
one call site whose input is caller-supplied and where this bound applies.

> **Superseded in part (round 7c).** This paragraph's declared value
> (16,384) and its counted event are left textually as declared, but: (1)
> its only cited justification ("see 'Round 5 review feedback' above for the
> measurement and ratio reasoning") is retracted in full (7c.1); (2) the
> "same event … `nfaSizeGuard` already counts" specification does not match
> the code — the guard increments once per atom by quantifier maximum, while
> node construction happens separately and unguarded (7c.5).
> **Implementation hold (round 7d):** as written, this clause is not
> implementable. Its two candidate events — `nfaSizeGuard`'s per-atom
> increments, and `buildClosedPatternNfa`'s per-node constructions — produce
> different accept/reject outcomes at the same 16,384 ceiling (7c.7: four
> versus two of the 7c.6 pattern per call), and nothing in the clause lets an
> implementer choose between them. It must not be implemented until Round B
> resolves which event it binds to, or replaces it. Whether the counter is
> retained, modified, or replaced is that Round B decision; it is not settled
> by this round, and nothing in this round changes its declared mechanism,
> value, error code, or precedence.

**Second normative fix (round-5): `maxPatternNfaConstructionWork` — ON HOLD,
NOT NORMATIVE AS WRITTEN (rounds 7d/7f).** *Inline notice, part of this
clause's own text: this clause is not implementable as written and must not
be implemented. Its counted event admits three different readings (7c.7,
Readings A, B, and C) that produce different accept/reject outcomes at the
same ceiling, its 16,384 value has no surviving justification (7c.1), and
whether it is retained, respecified, or replaced is the Round B decision.
The text below is retained verbatim as the declared text under review, not
as a normative instruction.* Declare
a second new global limit, a non-negative integer counter scoped to exactly
one `compileClosedSchemaSet` invocation (identical per-call lifetime to
`maxPatternCompilationWork` — fresh at call start, discarded at call end,
never module-level or cross-call), shared across every pattern parsed during
that call. The counter increments once per NFA node/state constructed during
parsing, the same event the existing per-pattern `nfaSizeGuard`
(`KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`, ceiling 4,096) already counts,
evaluated at that same site. This check runs strictly before determinization
for that pattern — before any DFA-state work, and therefore before
`maxPatternCompilationWork`, is spent on it. Exceeding
`maxPatternNfaConstructionWork` rejects the entire schema-set compilation
closed under a new distinct error code, `KSTACK_HOST_PATTERN_AGGREGATE_NFA_LIMIT`
— never reusing `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT` (the per-pattern bound)
or `KSTACK_HOST_PATTERN_AGGREGATE_LIMIT` (the DFA-state aggregate bound).
This is a second, independent counter over a second, independent
construction phase — it does not substitute for `maxPatternCompilationWork`,
and every property already established for that counter (per-call scope,
deterministic pure-function outcome, no wall-clock dependency, cache
interaction) applies identically to this one. Declared value (on hold, not
normative until Round B; its cited justification is retracted, 7c.1):
`maxPatternNfaConstructionWork` = 16,384 — see "Round 5 review feedback"
above for the measurement and ratio reasoning as originally stated.

**Cache scope and key (round-1 clarification 1; round-2 refinement).** The
compilation cache that lets a repeated identical pattern skip subset
construction is scoped to exactly one `compileClosedSchemaSet` invocation: a
fresh, empty `Map` is constructed at the start of every call and discarded at
its end — it is never module-level, never persisted across calls, and never
shared between concurrent calls. The cache key is the pattern's raw source
string (the exact `schema.pattern` value) under exact byte equality — no
normalization, no parsed-form key. A cache hit performs no subset
construction and adds nothing to the counter. Stated precisely (round-7d
precision, replacing an earlier "(+1)" phrasing): every distinct pattern
string that reaches determinization interns its start state before any other
work (`intern(closure([start]))`, `kstack-host-contract.mjs` line 1823), and
is entered in the cache only after `compileClosedPattern` returns (lines
1911-1914; a rejecting compile caches nothing and, per the check-precedence
section, ends the call). So every *successfully compiled* distinct pattern
string costs at least one unit, and the aggregate counter caps the number of
successfully compiled distinct pattern strings in one call at exactly
`maxPatternCompilationWork`; one further distinct pattern reaching
determinization is rejected at its start-state intern (`counter >=
maxPatternCompilationWork` before allocation). The earlier "(+1)" denoted
that one additional *rejecting* attempt, not an additional successful
compile. Patterns rejected in phase one intern no DFA state and are outside
this count. This makes `maxPatternCompilationWork`'s
outcome a pure function of that single call's input schema set: the
identical input always produces the identical counter value and the
identical accept/reject outcome, regardless of what any other call compiled
before it (cold or warm process, unrelated prior calls).

> **Superseded in part (round 7c).** Phase one's wording below, "(1a) … at
> each NFA node construction", does not describe the code: the per-pattern
> check fires once per atom in `parseClosedPatternAtoms` (line 1716), by
> quantifier maximum, before any node is built (7c.4, 7c.5). The ordering —
> per-pattern first, aggregate second, phase one strictly before phase two —
> is unchanged; only the description of the phase-one event is affected, and
> its resolution is deferred to Round B.

**Check precedence and traversal order (round-1 clarification 3; round-2
refinement; round-5 extension).** Pattern compilation has two phases in
strict order, each with its own pair of checks. Phase one, NFA construction:
(1a) the per-pattern check (`KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`) evaluates
first, at each NFA node construction; (1b) the aggregate check
(`maxPatternNfaConstructionWork`/`KSTACK_HOST_PATTERN_AGGREGATE_NFA_LIMIT`)
evaluates second, at the same site — *ON HOLD (rounds 7d/7f; notice added
here round 7g): check (1b) belongs to the held clause and must not be
implemented until Round B resolves or replaces that clause; the ordering
stated for it here is the declared ordering retained under review, not an
implementable instruction. As an implementable instruction, phase one
currently consists of check (1a) only, and the "both that phase's checks"
allocation condition below applies to phase one as check (1a) alone until
Round B; phase two's two checks are unaffected.* Phase two, determinization (entered only
if phase one completes without rejection): (2a) the per-pattern check
(`maxPatternDfaStates`/`KSTACK_HOST_PATTERN_DFA_LIMIT`) evaluates first, at
each DFA state's creation; (2b) the aggregate check
(`maxPatternCompilationWork`/`KSTACK_HOST_PATTERN_AGGREGATE_LIMIT`) evaluates
second, as `counter >= maxPatternCompilationWork` before allocation — exactly
`maxPatternCompilationWork` states are admissible, the next one rejects. In
both phases, allocation happens only if both that phase's checks pass. A
per-pattern violation always surfaces as a per-pattern error code, never the
corresponding aggregate one, for that specific construction event; any of the
four checks failing throws and ends the whole `compileClosedSchemaSet` call
immediately, so no further pattern in that call is processed, and phase two
of the current pattern is never reached if phase one already rejected it.

Across schema entries within one `compileClosedSchemaSet` call, entries are
compiled in the canonical order the input is already required to carry:
`schemaEntries` is bound by repair-r2 §1's `SET_BY_FIELDS` `CollectionV1`
mode, sorted by the `(schemaId, schemaVersion)` key-field tuple's canonical
bytes. Within one schema's declaration, the JS implementation's exact walk
order is: a record's `properties` children in `Object.keys` enumeration order
(note: `Object.keys` places integer-like string keys first, in ascending
numeric order, before all other keys in insertion order — this schema
representation can contain such keys), then `items`, then the node's own
`pattern` if present, then `oneOf` branches in declaration order, recursing
depth-first. This is the normative JS traversal order; it is stated
explicitly here rather than inferred from canonical byte order, because
identical canonicalized input bytes do not by themselves determine a walk
algorithm. This governs only which error code the JS implementation emits
when an input can trip more than one bound — it does not affect accept/reject
outcome, and per the cache-scope section above, is not currently a
cross-runtime parity requirement.

> **Superseded in part (round 7c).** Three statements in the paragraph below
> are contradicted by 7c.6 and withdrawn: (1) that the two per-state cost
> dimensions "cannot be jointly maximized within the frozen 256-byte
> pattern-length limit" — a 78-byte pattern reaches near-maximal subset
> cardinality with a 67-symbol partition; (2) that wide-alphabet adversarial
> constructions "did not increase real compile cost relative to
> narrow-alphabet constructions of the same state count" — the measured ratio
> is about 12×; (3) the closing sentence's claim that the two counters together
> close the channels "measured under adversarial construction attempts
> targeting exactly the dimensions raised across rounds 2 through 5 (wide
> alphabet, …, and the large-NFA/small-DFA collapse shape)" — neither counter
> meters `symbolCount`, and the collapse shape is retracted (7c.2). What
> survives: the normative bound is the state count, not a time value; the
> NFA-size and DFA-state ceilings are one 4,096 constant (7c.4); and
> `maxPatternCompilationWork` does meter the round-5 counterexample on its own.
> Closing the alphabet-width channel is the Round B decision.

**Ceiling and closure scope (round-2 refinement; round-3 empirical
correction).** The normative bound is the state-creation count itself
(`maxPatternCompilationWork`), not a time value. Per-state transition-partition
work is bounded — each DFA state's cost is a function of its subset
cardinality (bounded by the 4,096-state NFA-size ceiling) and the pattern's
alphabet partition width (bounded at 128 slots) — but, contrary to an earlier
draft's overstated claim, this bound is not "independent of any adversarial
input shape" in the abstract; it is bounded in practice because the two
dimensions cannot be jointly maximized within the frozen 256-byte
pattern-length limit (see "Round 3 review feedback" above for the measured
evidence). `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`'s actual enforced value is
4,096, sharing the same numeric ceiling as `maxPatternDfaStates` — not a
second, larger, unstated bound. Because the aggregate counter also caps the
number of distinct pattern strings compiled per call (per the cache-key
section above), and because measured adversarial construction attempts
combining wide alphabets with subset-exploding quantifier structures did not
increase real compile cost relative to narrow-alphabet constructions of the
same state count, this addendum's DFA-state-channel closure claim is empirically grounded, not
merely structurally argued. **Scope of the claim (round-4 refinement; round-5
correction):** this counter (`maxPatternCompilationWork`) meters DFA-state
creation only. Per-pattern NFA construction/epsilon-closure work is bounded
per pattern by `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT` (4,096), but an earlier
draft's claim that this channel was safely bounded in aggregate by grammar
structure alone was refuted by both reviewers with a concrete counterexample
(`^a*a{0,4000}$`) and withdrawn — see "Round 5 review feedback" above. *ON
HOLD (rounds 7d/7f; notice added here round 7g): the two sentences that
follow are retained as the declared claim under review, not as an
assertion. The second counter is not normative as written (§1 "Second
normative fix (round-5)" and its hold), so the aggregate NFA-construction
channel is currently not closed by any implementable clause — closing it is
the open Round B decision — and the "together … precise" joint-closure
claim does not stand while that hold is in place. The "measured under
adversarial construction attempts" justification is dealt with separately:
retracted for the round-5 batch (7c.1) and superseded for the round-3
figures (the marker below).* The
aggregate NFA-construction channel is instead closed by the second counter,
`maxPatternNfaConstructionWork`, declared normatively below. Together, the
two counters' claim is precise: `maxPatternCompilationWork` closes the
DFA-state-creation channel and `maxPatternNfaConstructionWork` closes the
NFA-construction channel, each measured under adversarial construction
attempts targeting exactly the dimensions raised across rounds 2 through 5
(wide alphabet, subset explosion, and the large-NFA/small-DFA collapse
shape).

> **Superseded (round 7c).** The figures below ("regardless of alphabet
> width", "faster than the narrow-alphabet case", ~86ms for ~16,000 states)
> are round-3 single-run measurements of shapes that did not include the
> wide-partition, near-cap shape in 7c.6; the citable wall-clock record for
> this document is now 7c.6 (baseline ~226ms median; widened ~2.7s median,
> with a disclosed ~1.0s smaller-sample run).

The following wall-clock figures are illustrative measured context, not a
portable cross-machine guarantee, but they are direct measurements against
adversarial constructions, not a single-sample extrapolation: a linear-chain
near-per-pattern-cap pattern compiled in ~31-32ms regardless of alphabet
width (26 vs 94 symbols); adversarial constructions combining wide,
overlapping alphabets with subset-exploding repetition reached the
per-pattern limit in single-digit milliseconds, faster than the
narrow-alphabet case; a construction totaling ~16,000 DFA states across
multiple schema entries in one call (approximating the full Option A
ceiling) compiled in ~86ms.

> **Superseded in part (round 7d).** The paragraph below's Option B
> comparison — "≈ 4x Option A's measured cost at the reference rate, still
> well within the same sub-second order of magnitude" — rests on the
> superseded round-3 rate (~86ms for ~16,000 states; see the marker on the
> illustrative wall-clock paragraph above). Under 7c.6-7c.7, the two to
> four patterns of the tested shape that Option A's ceiling admits cost
> roughly 4.7–5.4s (two, extrapolated) to a measured 10.9s (four, one real
> call; 7c.7), not sub-second, so the sub-second premise is withdrawn. The selection of Option A over Option B now stands on the
> reversibility rationale ("Round 4 review feedback") alone; the ceiling
> value itself is unchanged by this round, and any recalibration is a Round B
> item.

**`maxPatternCompilationWork` = 16,384 (Option A) is the normative value
selected by this addendum** (round-4 fix: no longer an open choice — see
"Round 4 review feedback" above for the reversibility rationale). Option B
(65,536 states) was considered and rejected: illustratively ≈ 4x Option A's
measured cost at the reference rate, still well within the same sub-second
order of magnitude, so it would have bought no meaningful additional
DoS-closure margin while accepting a looser bound where the tighter one is
sufficient and cheap to raise later if ever needed.

**Headroom against the maximum admissible corpus (round-1 clarification 4).**
The current HP-TC01 leaf-schema corpus needs well under 1,000 total DFA
states to compile, giving large headroom over present usage under either
option. Against the maximum corpus the frozen limits already admit
(`maxSchemas` = 256 schemas in one call), Option A's 16,384-state aggregate
budget averages to 64 states per schema — well under each individual
schema's 4,096-state per-pattern ceiling, so a maximally adversarial
256-schema document is expected to trip the aggregate bound before any single
pattern approaches its own per-pattern ceiling. This is intended, not a gap:
the aggregate bound exists precisely to cap the *many-moderate-cost-patterns*
compounding case that a per-pattern-only bound cannot see, so triggering on a
document whose individual patterns are all comfortably within bound is the
mechanism working as designed, not evidence the ceiling is misconfigured.

**Replay versioning and historical-corpus-growth non-monotonicity (round-1
clarification 4; round-2 correction).** `maxPatternCompilationWork` is a
runtime resource guard added to `HOST_CONTRACT_LIMITS` only. It is
explicitly **not** added to `ResourceLimitsV1` or any other bootstrap record
in this round — unlike the framing in an earlier draft of this addendum,
several existing `HOST_CONTRACT_LIMITS` members (including `maxDocumentBytes`
and `maxPatternDfaStates`) *are* already embedded as constants in the frozen
`ResourceLimitsV1` bootstrap record, which is itself loaded by digest on
every historical replay. Declaring the new limit there the same way would be
a metaschema version change — every already-stored bootstrap object lacking
the new field would fail closed on its next replay. That is out of scope for
an additive addendum and is not proposed here; a future decision to fold this
limit into the bootstrap-validated metaschema surface must go through its own
design review, not this one.

As a plain `HOST_CONTRACT_LIMITS` runtime guard outside any bootstrap record,
`maxPatternCompilationWork` changes never alter any existing digest.

The specific historical-corpus-growth concern round 2 raised — that adding
unrelated entries to a schema set over time could push an already-valid
artifact's replay past this bound with no limit change — does not apply to
this design. A historical artifact resolves against the exact schema set
named by its own `schemaSetDigest`, which is content-addressed and verified
by digest on every replay; that bound set is immutable. Adding entries
elsewhere produces a schema set under a *different* digest that no existing
artifact is bound to. An artifact's replay validity therefore depends only on
its own bound set's fixed content, never on unrelated, later-created sets.

The one real versioning property this addendum does introduce, stated
plainly: introducing any new bound is a narrowing from previously-unbounded.
An already-stored schema set whose total DFA-state-creation cost exceeds the
chosen ceiling would become non-replayable the first time this bound is
enforced. The current HP-TC01 corpus (well under 1,000 total states, per the
headroom analysis above) makes this residual currently vacuous, and it is
stated here rather than left implicit.

This addendum is additive only. It does not reopen, redesign, or relax any
other frozen HP-TC01 content, and it does not touch HP-TC02 through HP-TC12.

## Round B — mechanism fork for the alphabet-width channel (proposed for review, not decided)

This section proposes the choice the next dual-review round is asked to
make. It decides nothing; it changes no declared mechanism, value, error
code, or precedence. The evidence it reasons from is entirely the quoted
material in "Round 7c correction" above.

**Three facts the mechanism must answer to.**

(i) `^a*a{0,4000}$` is large on both axes — `nfaSizeGuard` 4,003 of 4,096
and `dfaStateCount` 4,001 of 4,096 (7c.2) — so the already-normative
DFA-state counter meters it by itself. The only evidence this record ever
held for a large-NFA/small-DFA shape in this grammar is retracted; no
verified instance now exists, and none has been shown impossible. Whether
`maxPatternNfaConstructionWork` bounds any real channel is open in both
directions.

*Observation bearing on fact (i) (Opus, rounds 7d/7e; labeled as an
observation, not a proof).* Both measured `{0,N}`-bounded-repetition-leaf
families in this record show `dfaStateCount = nfaSizeGuard − 2` at every
quoted point: the narrow family at 4,001 vs 4,003 and 4,091 vs 4,093
(7c.2, 7c.3), and the widened family at 4,066 vs 4,068, 4,065 vs 4,067,
4,064 vs 4,066, and 4,063 vs 4,065 (7c.7) — six points, each difference
recomputed as −2 (derivation). Opus's stated reason: a `{0,N}` leaf chain's
subset construction drops one chain position per input symbol, yielding
about N + 1 distinct subsets rather than collapsing. If that generalizes,
bounded repetition — the only construct in the frozen grammar whose NFA size
is not linear in pattern bytes — cannot produce a large-NFA/small-DFA
shape, which would settle fact (i) toward "no such shape exists". This is
two families and six points, not a bound; it is offered for Round B to
test, and it does not resolve fact (i) here. (The tracker family
`^[ab]*a[ab]{W}$` is outside the observation's scope: its DFA count is
driven by subset cardinality, not by a `{0,N}` leaf.)

(ii) `maxPatternNfaConstructionWork`'s counted event is mis-specified (7c.5)
and its ceiling's justification is retracted (7c.1).

(iii) Wall-clock cost is driven by the determinizer's per-state work,
`(symbolCount − 1) × members.length`, which neither counter meters: the same
DFA-state count costs about 12× more at `symbolCount` 67 than at 2 (7c.6).
State count is a poor predictor in the other direction too: the tracker
family at 2,049 states scans 14,338 members in total, against 8,010,001 for
`^a*a{0,4000}$` at 4,001 states (derivation: 8,010,001 / 14,338 = 559×).
That 559× is a ratio of totals at unequal budgets (2,049 versus 4,001
states); the comparison an "equal budgets" claim needs is per budget unit
(restated round 7g at Opus's suggestion; derivations): members scanned per
DFA state are 14,338 / 2,049 = 7.0 for the tracker family against 8,010,001
/ 4,001 = 2,002 for `^a*a{0,4000}$`, a 286× difference (2,002 / 7.0), or
143× on `symbolMemberProduct` per state (28,676 / 2,049 = 14.0 against
8,010,001 / 4,001 = 2,002) — so equal budgets of
`maxPatternCompilationWork` can represent work that differs by hundreds of
times. A cited timing for the tracker shape does not
exist in this record and is not claimed here.

**Option 1 — add a third, work-weighted aggregate counter.** Keep both
declared counters as they stand; add `maxPatternDeterminizationWork` (name
illustrative), per-call scope identical to the other two, incremented inside
`determinizeClosedPattern` by `members.length` on every inner-loop symbol
iteration (equivalently by `(symbolCount − 1) × members.length` per interned
state — exactly the harness's `symbolMemberProduct`), checked at that site,
with its own distinct error code.
*For:* meters the actual cost driver, at the loop that spends it; purely
additive, nothing already-normative changes.
*Against:* three counters, three error codes, three ceilings to explain, on a
document that began as a one-clause addendum; the unit is ~10^8 per pattern
(8,010,001 baseline; 528,928,356 widened; 28,676 tracker) and over-predicts
wall-clock growth by roughly 5× (66× versus 12×, 7c.6), so its ceiling needs
a fresh calibration measurement rather than a ratio to 4,096; and it leaves
the mis-specified second counter in place with a retracted justification.

**Option 2 — replace both counters with one work-weighted metric.** Retire
`maxPatternCompilationWork` (per DFA state) and
`maxPatternNfaConstructionWork`; declare a single per-call counter in the
Option 1 unit.
*For:* one counter, one error code, one ceiling; a unit that tracks cost,
in place of two that demonstrably do not.
*Against:* discards a counter whose mechanism, per-call scope, cache
semantics, replay-versioning analysis, and Option A/B ceiling choice were
reviewed and converged across rounds 1-4, all of which would have to be
re-established for the new unit; loses the per-state cap on distinct pattern
strings (§1 cache-key section) unless re-derived; and leaves the
NFA-construction phase unmetered in aggregate again — per pattern it is
linear in `nfaNodeCount`, at most 2 × 4,093 + 5 = 8,191 for the worst
admitted member of the `^a*a{0,n}$` family (derivation), and cheap, but
whether an aggregate channel exists there is fact (i)'s open question.

**Option 3 — keep the reviewed counter, replace the retracted one.** Keep
`maxPatternCompilationWork` exactly as declared — its mechanism,
deterministic pure-function outcome, and distinct-pattern-cap properties
survive, and 7c.2 shows it meters the round-5 counterexample alone; its
original sub-second wall-clock calibration does not survive, being exactly
what 7c.6 contradicted (see the Option B marker in §1), so it is retained as
a reviewed cardinality guard, not on its performance rationale; withdraw
`maxPatternNfaConstructionWork` (sole justification retracted, event
mis-specified); add the Option 1 work-weighted determinization counter in
its place. Stated plainly (round-7d precision): the document then carries two
aggregate counters that are *both* evaluated during determinization — one
counting DFA states, one counting per-state work — and the NFA-construction
phase is left with no aggregate meter at all; only the per-pattern
`nfaSizeGuard` cap bounds it. Option 3 accepts unmetered aggregate NFA work
on the strength of fact (i): no verified shape exists in which that phase
dominates cost, and per pattern it is bounded at 4,096 guard units.
*For:* no more surface than the current draft; nothing reviewed-and-converged
is reopened; the mis-specified counter is removed rather than patched.
*Against:* the same calibration work as Option 1; the same open NFA-phase
question as Option 2 — if a large-NFA/small-DFA shape is later demonstrated,
an NFA-side aggregate bound would need to return (cheap to add later, per
the reversibility argument in "Round 4 review feedback", and the per-pattern
`nfaSizeGuard` cap remains in force throughout).

**Option 4 — keep both declared counters; respecify the second to the
verifiable event (proposed in round-7c review; added round 7d; split into
two complete choices in round 7f at Codex's request).** The common part:
keep `maxPatternCompilationWork` as declared; keep
`maxPatternNfaConstructionWork` as a per-call aggregate, but respecify its
counted event explicitly as `nfaSizeGuard`'s per-atom increments *by
magnitude* at the line-1716 guard site — Reading A in 7c.7, stated as
magnitude semantics and not as "once per atom", because the per-atom event
reading (Reading C) makes the counter non-binding — the one NFA-side
population that is already computed, already compared to a cap, and
verifiable against production at the 7c.3(a) boundary; with a fresh ceiling
calibration, since its 16,384 value has no surviving justification (7c.1).
The common *for:* resolves the 7c.5 event mismatch by choosing the population
the code already computes, with no new instrumentation and one addition per
atom; preserves aggregate NFA-side metering, so fact (i)'s open question
need not be answered before anything ships; keeps the two-phase precedence
structure of the current text. The common *against:* keeps a counter whose
motivating evidence is retracted — its justification would have to be
rebuilt, not merely recalibrated; on the evidence in this record it meters a
phase that, per pattern, costs at most 4,096 guard units and roughly 2 ×
4,096 node constructions, with no demonstrated instance where that phase
dominates cost.

- **Option 4a — Option 4 paired with Option 1's work-weighted
  determinization counter.** Three counters. *For:* the only option that
  both keeps NFA-side aggregate metering and meters the demonstrated
  alphabet-width channel. *Against:* three counters, three error codes,
  three ceilings — Option 1 plus a respecification; the same calibration
  work as Option 1.
- **Option 4b — Option 4 alone, accepting the 7c.7 residual as disclosed.**
  Two counters, unchanged in number. *For:* smallest change from the current
  text. *Against:* changes none of the 7c.7 figures — the measured 10.9s
  four-pattern call remains admitted — and leaves the demonstrated channel
  unmetered with the exposure caveat (7c.7) open.

**Option 5 — a per-pattern cap on `symbolCount` (proposed by Opus in
round-7e review; added round 7f).** No new per-call counter. Add a single
per-pattern cap on `closedPatternAlphabet`'s `symbolCount` (the
alphabet-partition width, currently bounded only implicitly at 128 by array
size and compared to no limit anywhere), analogous to the existing
per-pattern DFA-state and NFA-size caps, with its own error code, checked
once per pattern before determinization.
*For:* the simplest mechanism on the table — one comparison per pattern, no
new aggregate accounting, no new unit; it bounds directly the one quantity
the measurements identify as the cost driver (7c.6: about 12× at
`symbolCount` 67 versus 2, at unchanged DFA-state count); it composes with
whatever is decided about the two aggregate counters.
*Against:* it caps a structural property of a pattern rather than metering
realized work, so it can reject a legitimate pattern that needs a wide
alphabet even when its actual compile cost would have been acceptable, and
it cannot see cost that comes from `members.length` rather than width; its
ceiling needs calibration against the current corpus's `symbolCount`
distribution, which is not measured anywhere in this record (Opus's
round-7e open question); and it bounds per-pattern cost only — the
per-call multiplication by admitted pattern count remains governed by the
aggregate counters.
Whether this option can be used *now*, standalone and separately from the
Round B choice, is assessed in 7c.7's "Interim Option 5 feasibility"
paragraph (round 7g).

**Reviewer preferences to date, stated neutrally — this correction round
does not choose (round 7f; the single recommendation of rounds 7d/7e is
withdrawn).** Five live options are on the table, and the two reviewers have
expressed preferences that disagree with the recommendation those rounds
carried (Option 3), so no recommendation is made here. From the review
records: Codex, rounds 7d and 7e — send Option 4 paired with the
work-weighted determinization counter (Option 4a), with explicit
`nfaSizeGuard` increment semantics and independently calibrated ceilings,
on the ground that absence of a demonstrated NFA-dominant shape is
insufficient evidence for removing aggregate NFA-side protection before
that phase is measured. Opus, round 7d — Option 3 only if paired with a new
open item settling fact (i) before NFA-side metering is withdrawn,
otherwise Option 4 as the safer choice; Opus, round 7e — Option 4 paired
with Option 1's work-weighted counter (Option 4a), and the `symbolCount`
cap (Option 5) raised as a candidate. Both reviewers labeled these as
dissent from the packet's recommendation, not as decisions. Choosing the
mechanism is a separate follow-on design round with its own convergence
loop; this correction round does not resolve it and does not attempt to
force it.

**Open items any option must settle before it becomes normative:** (1) a
calibration measurement for any new unit's ceiling, citing literal output,
in the same form as 7c.6; (2) whether `closure()` cost should be metered as
well — the 66×-versus-12× gap says the inner-loop count is conservative,
which is acceptable for a bound but should be stated; (3) a cited timing for
at least one small-`members` shape (the tracker family), so cost-per-unit is
established at both ends; (4) the same `ResourceLimitsV1` exclusion,
replay-versioning, and cross-runtime statements the first counter carries;
(5) explicit disposition of the 7c.7 residual (a measured 10.9s per call for
four patterns of the tested shape, under the current ceilings) for the
interval before the chosen mechanism lands; (6) recalibration of the
retained `maxPatternCompilationWork` = 16,384 itself, whose sub-second
calibration is superseded (§1 Option B marker) — any option that keeps it
must re-justify that number, not only calibrate the new unit (Opus, rounds
7d/7e); (7) settling fact (i) — whether any grammar-admitted shape has NFA
size materially super-linear in pattern bytes while collapsing to few DFA
states — before any option withdraws NFA-side aggregate metering, with the
`nfaSizeGuard − 2` observation above as the first thing to test (Opus,
rounds 7d/7e); (8) the exposure caveat: no bound on `resolveHistoricalArtifact`
invocation frequency exists in the record, so a per-call figure does not
bound real exposure, and the maximum admissible pattern count per call is
governed by `maxDocumentBytes` (1,048,576), not `maxSchemas` (256), since
patterns are per schema node (Opus, round 7e) — any option's exposure
arithmetic must compose against that; (9) any respecification of the
NFA-side counter must state Reading A's magnitude semantics explicitly,
since the per-atom event reading (Reading C, 7c.7) makes it non-binding.

## Review request

Round 7i (the previous revision was reviewed as round 7h: Codex block 18,
Opus revise 78; this revision records the team-lead's reject-64 decision
and the authorized corpus `symbolCount` measurement in 7c.7's feasibility
paragraph, states the Rust real-input parity gap plainly, labels the
width-monotonicity inference, and adds review item (5) below — see "Round
7i" in 7c.8). Round 7f found no arithmetic error in the correction (Opus
recomputed every exposed derivation and it held; its two findings were
scope errors in prose); this revision
makes the two Opus scope fixes (7c.7's "five cannot fit" sentence scoped to
the readings it holds for; the §1 inline hold extended to the three other
locations that still read as normative for the held clause), adds the
interim-disposition statement of the current risk state at the end of 7c.7
including the 256-pattern per-call exposure extrapolation, and applies three
refinements approved in a second pass (Reading C's lead figure swapped to the
preserved-script median; fact (iii)'s 559× restated per budget unit; this
section's round label), all listed under "Round 7g edits" in 7c.8, and —
in a third pass after the round-7g review returned Codex block 24 / Opus
revise 80 — the four items listed under "Round 7g, third pass" in 7c.8:
the Reading C shorthand here corrected to 9.6–11.0 minutes, the
`maxPatternCompilationWork` status restated as declared but uncalibrated,
the §1 Problem figures scoped as a narrow-alphabet lower bound, and the
"Interim Option 5 feasibility" assessment in 7c.7; and nothing else.
It changes no mechanism, ceiling value, error code, per-call scope, or check
precedence of either declared counter; the §1 NFA-counter clause now carries
its hold inline in its own text. Review: (1) whether the two new literal
measurements are cited correctly and used for what they establish and no
more — the real four-pattern combined call (10,902.369ms median, production
entry point, corroborating the earlier extrapolation to within about 1%)
shows four patterns clear every per-pattern cap in one call, but does not
exercise the declared aggregate counters, which are not implemented in
production; and the third 30-trial run's script is preserved and imports
production, while the first two 30-trial lines' entry point is reported, not
verifiable from the record; (2) whether 7c.7's three readings are stated
correctly — in particular that Reading C makes the NFA counter alone admit
244 patterns (≈ 9.6–11.0 minutes: 9.6 at the preserved-script median, whose
entry point is verifiable from the record; 11.0 at the earlier 30-trial
median, reported not verifiable) but that `maxPatternCompilationWork` still
rejects the fifth, so the joint residual for the tested shape remains the
measured 10.9s; and that the exposure caveat (no call-frequency bound in
the record) is stated as open; (3) whether "Round 7c correction" remains
numerically and factually correct against its own quoted evidence —
`nfaSizeGuard` (never `nfaNodeCount`) at every 4,096 cap comparison,
headroom 28 (NFA-size) and 30 (DFA-state), the five-pattern exceedance now
argued from remaining headroom (126 DFA states, 122 increment events) rather
than a repeated-value product; (4) whether the §1 inline hold, the
`nfaSizeGuard − 2` observation (labeled two families / six points, not a
proof), Option 4's split into 4a/4b, Option 5, the neutral statement of
reviewer preferences in place of a recommendation, and the extended open
items (including recalibration of the retained 16,384 and settling fact (i))
are stated fairly and grounded in the cited evidence; (5) whether the
"Interim Option 5 feasibility" analysis in 7c.7 is sound — the check site
and error-code shape, its orthogonality to Options 1–4b, the structural
`symbolCount` ≤ 96 ceiling, the per-pattern bound derivation over the
plugin's declared literals (maximum 40 for this compiler's inputs), and
the one-sided bracketing of unmeasured widths with its labeled
monotonicity inference — whether the team-lead's reject-64 reasoning holds
on the record (at most 22.6% of one tested shape's cost and likely far
less; 256-pattern figure ≥ 9.9 minutes against ≈ 10.1–11.6; replay-
versioning cost; the Rust real-input parity gap), and whether the
authorized-measurement statement is appropriately scoped as an empirical
follow-up that decides no mechanism and pre-empts no Round B option. Do
not decide the
mechanism in this round; it is a separate follow-on design round. State
which option you would send forward and why, as preference, not decision.
Closure for this round
means the correction section stands as the document's factual record and the
fork is well-posed for its own dual review: 93+ confidence and empty failed,
security, dissent, and question arrays from every reviewer. Do not redesign
Option C, add either limit to `ResourceLimitsV1` or any bootstrap record,
inspect/edit files, use tools, implement, install/configure a host, commit,
push, deploy, publish, or edit reports.
