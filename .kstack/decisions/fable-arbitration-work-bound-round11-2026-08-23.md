The Write tool is disabled in this session (as are the plan-workflow tools), so the ruling itself — which is what this arbitration request asks for — is delivered here in full as the deliverable. The advisor review confirmed the decision direction and the loop-stopping mechanics below.

---

# Fable arbitration ruling — Reflexion semantic-retrieval design loop, round 11 (exact work/memory-bound fork)

Record date: 2026-08-23. The round-5 scope ruling stands untouched; this ruling resolves only the complexity/memory-bound apparatus rounds 8–10 have been repairing.

## Ruling: **(B)** — abandon the mathematically tight, adversarially provable exact work/memory bound; replace it with simple, deliberately generous, enforced runtime caps documented as conservative and untight by design

### Why (B) — the threat model dissolves the requirement (dispositive)

An adversarially tight work/memory bound earns its cost only against an adversary who crafts worst-case corpus and query shapes — thousands of near-identical, maximum-Unicode-expansion 10 KiB values engineered into a 1 MiB file. But the corpus author is the **same same-user principal the round-5 ruling already declared out of scope**: a hostile author of `.kstack/reflexion-lessons.json` can already replace the tool, the corpus, or the runtime. Round 5 dissolved the TOCTOU apparatus by observing that the defended boundary does not exist; the identical observation dissolves the exact-bound apparatus. What legitimately remains is **accidental pathology** (a corpus that grew, a wide query), and generous caps plus a wall-clock regression test handle that completely. The objective's proportionality clause — cost proportionate to a 4-lesson, 1 MiB-capped, 50-lesson-gated corpus — is plainly violated by ~250 MiB accounted peaks, byte-radix rank pipelines, and packed-descriptor mandates whose only purpose is proving a ceiling nobody in scope can attack.

### Why not (A) — the trajectory is structural non-convergence

Rounds 8→9→10 exhibit the exact failure signature the round-5 ruling named: each round patches the discovered instance; the unsatisfiable requirement regenerates a fresh instance in the next mechanism reviewed. Round 9's fix for the sort gap (integer ranks via byte-radix) was immediately found by both reviewers to have relocated the cost into membership views (~1,170 operations per value, ~1.5×10⁸ summed — comparable to the entire advertised 1.258×10⁸ ceiling), plus a ~2× radix reread undercount, plus unaccounted MSD recursion state. Opus's round-10 recommendation of "one more round, do not escalate" must be weighed against Opus having said the equivalent after round 9 ("all local amendments"), which round 10 disproved. Exactness is the *generator* of the findings; a round 11 on the same terms produces a fourth relocation. Notably, Opus's own highest-leverage round-10 item (per-lesson token-rank scoping, worth ~200 MiB) already points toward simplification, not another exactness pass.

### Why not (C)

Any narrow fix to the membership-view gap keeps "the headline bound is the honest total" as a normative, reviewable claim, which keeps the entire counting surface inside the loop. The membership-view finding is a defect *only relative to that claim*; retire the claim and it is not a defect.

## The new normative bounds

All retained numeric limits are **enforced runtime caps with bounded errors — never derived theorems, proven ceilings, or tightness claims**. Documented once as: "conservative and untight by design; sized so that even a naive reference implementation stays far from real machine limits on any in-scope input."

**Retained unchanged** (simple checks, already proportionate): the 1 MiB corpus cap; the existing input-bounds table (32/32/16 cardinality, 160 scalars, 160 tokens, 10,240 normalized bytes per value); alias floors and secret-scan rejection; `MAX_LOOKUP_NORMALIZED_POOL_BYTES` = 16,777,216; `MAX_CORPUS_EVIDENCE_ITEMS` = 65,536; `MAX_ALL_EVIDENCE_ITEMS_PER_LESSON` = 9,216; the inline-report caps; the 2,048-byte Actor item and 8 KiB Actor block caps; all-or-nothing cap semantics with bounded errors and operator remediation documentation.

**Changed:** `MAX_CORPUS_PAIR_EVALUATIONS` raised from 131,072 to **1,048,576 (2²⁰)**. Discriminating constraint: comfortable headroom over the 50-lesson evaluation gate at full 32-keyword width — the new cap supports ~682 maximum-width lessons (≈13× the gate) versus the ~86-lesson brick point both reviewers flagged. Worst-case sanity is a one-paragraph order-of-magnitude estimate in the draft (2²⁰ pairs × ≤640 linear-scan token comparisons ≈ 7×10⁸ bounded operations), not a counter.

**Deleted entirely from the design — removed, not demoted to non-normative text:** the 960-per-pair counter and both its assertions; every derived comparison ceiling (125,829,120 / 5,505,024 / 692,440 / 132,026,584); the radix read ceiling (51,511,328); byte-radix rank assignment; the integer-only comparator mandate and its instrumentation fixtures; the packed arena/value-table/token-offset/token-ID/prefix-table/membership-view/descriptor/rank-summary representation mandates; the 105-byte/9,892-lesson derivation; the 128-byte rank-summary slot; the entire byte-level live-peak table, its per-row counters, and the 250.3/262.3 MiB figures. Retained review surface is retained whack-a-mole surface, so none of this remains even as "non-normative guidance." One sentence replaces it: *an implementation MAY use packed or interned representations; this is unreviewed implementation freedom, not a contract.* This deletion also **closes Opus R10's phase-ordering contradiction by dissolution** — with no global pre-ranking phase, there is nothing for per-lesson streaming to contradict; round 11 states this explicitly so reviewers see it resolved rather than dropped.

**Explicitly surviving the deletion** (so round 11 does not accidentally drop them):

- **Linear containment stays normative**: the deterministic prefix-function/KMP scan (or the padded-string `includes` expression) over token arrays; restart-at-every-position scanning stays forbidden. One sentence, no counter.
- **Determinism stays normative, restated without the machinery**: every canonical order (value rank, token rank, evidence order, lesson rank) is *defined* as UTF-8 byte-lexicographic comparison over normalized values plus the existing fixed enum/tier/count keys, implementable by ordinary means — `Buffer.compare` inside comparators is explicitly re-permitted. Input-order-independence and exact-evidence acceptance tests stay.
- **Memory testing collapses to one coarse gate**: post-GC `(heapUsed + arrayBuffers)` delta below 384 MiB on the stress fixture, both default and verbose paths. No per-row byte counters.
- **Performance testing collapses to one tripwire**: a wall-clock benchmark on a realistic, non-adversarial stress fixture with a generous reported-time ceiling, documented as a regression tripwire, not a proof.
- The entire trust-boundary apparatus — normalization pipeline, categorical transform C, STRUCTURAL_ASCII, the marker invariant and its compositional proof (including the verified narrow U+0022 oracle assertion), the report round-trip check, the typed operator sink, the containment check, and the corpus I/O protocol — is untouched by this ruling.

## Carried-in orthogonal fixes (correctness, not exactness; they ride along in round 11)

1. **`occurrences` representation** (Codex R10): corpus validation requires a nonnegative integer satisfying `Number.isSafeInteger`; ranking uses it directly. One line; closes the JSON-precision ordering gap.
2. **Verbose-only retention** (Opus R10): with `--verbose-evidence` off, retain only what the Actor block and rank summaries need; report-serving data is not retained. Largely mooted by the descriptor-mandate deletion, but state the rule once.
3. **Pair-cap/corpus-cap reconciliation** (both reviewers): resolved by the 2²⁰ cap; the residual all-or-nothing boundary (~682 lessons at 32 keywords) stays documented.
4. The round-10 summary item-3 misdescription is moot (round 11 writes a fresh summary); the draft's narrow U+0022 assertion — which both reviewers verified correct — is what carries forward.
5. **Unchanged, accepted-by-design**: the CLI stderr routing convention plus its documentation (accepted residual medium), and the hedged Windows reparse wording, with implementation-time fixture confirmation remaining a win32 release gate.

## Review-criteria directive (binding on rounds 11+) — this is the loop-stopper

- **Out of scope for approval**: findings of the shape "this bound/cap/peak is not tight, not proven, not complete, omits cost X, or lacks a derivation." The design no longer claims tightness anywhere; demanding a proof of a deliberately untight cap is out of scope by this ruling.
- **Fully in scope**: findings that a stated cap can actually be exceeded or is unenforced; unbounded input or memory growth; nondeterminism; trust-boundary/encoder defects; matching-contract correctness; regressions against the round-5 shipped scope.

Round 5 converged because it changed what reviewers review against, not just the draft. This directive is the equivalent move here; without it, round 12 would flag "the generous cap's arithmetic is unproven" and the whack-a-mole would continue under new management.

## Process directives for round 11

- **Round 11 is a subtractive round, dispatched to Codex at `-c model_reasoning_effort=high` — explicitly NOT xhigh.** Per the corrected 2026-08-23 effort policy, round count alone escalates nothing, and deletion-plus-simple-cap-substitution is not Highest-tier work. The purpose of this ruling is to stop needing proofs; the drafting round must not itself reach for proof-tier effort. State the effort explicitly in the dispatch.
- The same dispatch writes this ruling verbatim as the decision artifact to `.kstack/decisions/` (dated 2026-08-23, e.g. `fable-arbitration-work-bound-round11-2026-08-23.md`, alongside the existing round-5 records) — per the standing Codex-executes rule; Sonnet stays on packet assembly and git plumbing.
- Per the packet-completeness rule, include this ruling verbatim in the round-11 packet — reviewers cannot read repo files.
- **This ruling narrows the review criteria; it does not terminate the loop.** Dual review continues on the simplified draft until quorum or explicit human stop, judged against the original mandate — matching quality, determinism, auditability, proportionality — which the simplified draft now actually matches.

---

One operational note: I attempted to write this ruling to the session plan file, but the Write tool is disabled for this session, so the text above is the authoritative copy — the round-11 Codex dispatch should take it verbatim from here for the `.kstack/decisions/` artifact.
