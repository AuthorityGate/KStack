# HP-TC01 exact-candidate verification

This record binds the exact working-tree HP-TC01 implementation submitted for
independent review under Jira item `hp-tc01-schemas` (`KSTK-66`). It contains
no credential, protected source, provider payload, or secret value.

## Frozen design binding

| Source | SHA-256 | Matches frozen citation? |
|---|---|---|
| `.kstack/decisions/host-portability-2026-08-27-hp-tc01-design-candidate.md` | `5ae3369350805b03a0cb6b17c3e2b88044099d23ef43c62463217a4d270d34eb` | yes — matches "Prior packet" cited in repair-r2 |
| `.kstack/decisions/host-portability-2026-08-27-hp-tc01-repair-r2.md` | `96728051b7c9d3c8cb6a871335a3271567158578a838fc6eca0b8d24fb5a8b9c` | yes — matches item-ledger "final repair" citation |
| `.kstack/decisions/host-portability-2026-08-29-hp-tc01-tc02-registry-id-repair.md` | `681708b3d3c346146cc85e5b315110ffc5604381f028919cd8d43fa5e858ab36` | binds this review's inspection copy |
| `.kstack/objectives/host-portability-2026-08-26.md` | `9119407fc59c09391faaab87d62ec6acd0e6a8f5f4c73f5783f9265ca6ed0cfb` | yes — matches design-candidate's frozen-evidence citation |
| `.kstack/decisions/host-portability-2026-08-26-item-ledger.md` | `3c00d2e81bedda7622bf605a46cd06548d81e4ebfca5ca14e337132bc9d63730` | binds this review's inspection copy |

## Implementation under review

The original candidate landed at `30a9ec8` (single squashed commit, 2026-08-30).
It is **no longer** byte-identical to the working tree: the round-2 match-time
ReDoS fix, round-3's follow-up fixes, and round-4's evidence-wrapper/
evidence-time-v1 fixes are present as uncommitted working-tree changes to
`kstack-host-contract.mjs`, `tests/host-contract.test.mjs` and `src/main.rs`.
The hashes below are the current working-tree bytes as of 2026-09-02 (rounds
2-4 of the main HP-TC01 thread applied, plus the complete finding-1 fix chain
through its closing hardening pass — see "Finding-1 fix chain" at the end of
this file) and supersede every earlier pin in this file.

| Path | SHA-256 | Changed since `30a9ec8`? |
|---|---|---|
| `plugins/kstack/scripts/kstack-host-contract.mjs` | `0ccf5a675c0904c3363b8dd579c04b9c17019d07ef18b48345c65055da326d6a` | yes — r2 ReDoS fix + r3 fixes 2/3 + r4 fixes A/B + the full finding-1 chain |
| `tests/host-contract.test.mjs` | `1ae60adbb9840b24ac4bc8bf642e82c62c04e13b97c9f9bce76a9862b2ec5b45` | yes — r2/r3 pattern-engine tests + r4 wrapper/evidence-time tests + the full finding-1 chain |
| `tests/helpers/host-contract-python-oracle.py` | `272e1922c18c3155bb9fce50c339f29eb20fd1d9e35106ea2e42d3ea4a3a1e0f` | no |
| `tests/fixtures/host-contract-cross-runtime-vectors-v1.json` | `1069810add267393401aa02300dd287891062bee867742cac695bd3b1cfbbdb7` | no |
| `plugins/kstack/native/host-contract-reference/src/main.rs` | `d71cb7fa38a1c025f16315f688e7a1abd9e4cccac025890bcc07bb679063ed21` | yes — r3 fix 1 (closed-pattern engine port) |
| `plugins/kstack/native/host-contract-reference/Cargo.lock` | `9588808754aecdcc22f360236a895a95ba9a703f0ad2d6bb6d7beac640459572` | no — no dependency edge changed |

## Incident: uncommitted work lost twice to concurrent tree resets, then recovered

Between round 3 finishing and round 4 starting, and again after round 4
finished, an unrelated concurrent thread in this same shared working tree
(first `985b22e`'s authoring session; second identified by the team lead as
`d0-d3-reconcile`) cleared all local uncommitted changes to get a tree that
exactly matched the committed history for its own regeneration work, and did
not restore this item's uncommitted files afterward. Both resets silently
reverted `kstack-host-contract.mjs`, `tests/host-contract.test.mjs`, and
`src/main.rs` to the `30a9ec8` baseline — the second reset erased round 4's
work in addition to rounds 2-3, which had already been lost once and
re-implemented once.

Recovery: every `Edit` tool call from the three implementing subagents'
session transcripts (rounds 2, 3, and 4) was extracted, ordered by timestamp,
and replayed onto the `30a9ec8` baseline outside the shared tree, then
verified there (34/34 tests, Rust build clean, all boundary/parity checks
reproduced) before being copied byte-exact into the live repository and
re-verified in place. This is a faithful replay of the exact bytes each round
originally produced and independently reviewed (rounds 2 and 3's file hashes
for `src/main.rs` match exactly across the pre-incident report and the
post-recovery file), not a re-derivation from the review records' prose —
the merged result is the union of rounds 2+3+4 that never existed as a single
live working-tree snapshot before, since round 4 was originally implemented
against an already-reset (rounds-2/3-missing) tree. Round 4's fixes have not
yet had their own dedicated independent re-review pass (rounds 1-3 review
records predate round 4's existence); that is still owed before closure.

Note: these SHA-256 values differ from the ones recorded in the earlier
uncommitted draft note `.kstack/reviews/host-portability-2026-08-29-hp-tc01/implementation-progress.md`
(dated 2026-08-29, before the single squashed commit landed on 2026-08-30).
That prior note's independent-review attempt
(`.kstack/reviews/host-portability-2026-08-29-hp-tc01/implementation-interrogation-opus/manifest.json`)
recorded `"status": "failed"`, `"exitCode": 1` — it never produced a verdict
(local OAuth was expired at the time). No independent pass has ever
successfully completed against this implementation, at any revision.

## Current qualification (this session, 2026-09-02)

- Targeted suite `node --test tests/host-contract.test.mjs`: **32 passed, 0
  failed** — superseded, see "Finding-1 fix chain" below: the current count is
  **58 passed, 0 failed** (up from the 28 recorded before round 2 — round 2 added four
  pattern-engine tests: catastrophic-backtracking linearity, the real
  subset-construction state bound, built-in pattern accept/near-miss cases, and
  frozen-grammar admission; round 3 split one existing assertion's expected
  error code and added two boundary assertions, see below).
- `tests/reflexion-architecture-gate.mjs` and `tests/install-health.test.mjs`
  currently show 3 failing cases (`KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT`
  and related manifest self-reference/probe checks). These are repo-wide
  install-health/source-audit census gates, not HP-TC01-scoped tests. Round 3's
  independent review (`r3-independent-review.json`) recomputed all 201 entries
  of `plugins/kstack/install-health-audit-manifest-v1.json` against the correct
  `sourceRoot` and found exactly 4 divergent entries: `kstack-domain-catalog.mjs`,
  `kstack-domain-separation.mjs`, and `kstack-jira-tracking.mjs` from other
  concurrent threads' in-flight edits this session, **and
  `kstack-host-contract.mjs` itself** — the manifest still pins the pre-round-2
  hash `8b07293b048c5b39...` against the current working-tree hash
  `b552f71c5cecc6ca...`. So HP-TC01's own uncommitted change is one of the four
  direct causes of this gate's failure, not an innocent bystander; the other
  three are unrelated concurrent threads. This is benign and self-resolving —
  any uncommitted edit to a manifest-pinned file diverges until the manifest is
  regenerated at commit — but manifest regeneration at closure must cover this
  item's file, and it is not solely "someone else's" drift.
- Full `npm test` was not run in this pass because of the shared, actively
  mutating working tree (other agents are mid-edit on unrelated files this
  session); running it would not produce a reproducible reading. The
  HP-TC01-scoped suite above is the reliable, isolated signal.

## Review-round status (rounds 1-3, 2026-09-02)

Three independent adversarial reviews have now completed against this
candidate. Their verdicts and the current disposition of every finding:

- **Round 1** (`.kstack/reviews/host-portability-2026-09-02-hp-tc01/r1-independent-review.json`,
  verdict `fix`, confidence 92) found a match-time ReDoS in the closed-pattern
  engine (its `securityFindings[0]` / `failedChecks[0]`). **Fixed in round 2** by
  replacing the RegExp-backed matcher with an explicit Thompson-NFA plus lazy
  subset construction, and **independently confirmed closed in round 2**: both
  adversarial patterns now evaluate sub-millisecond, and round 2 reported zero
  semantic mismatches across 119,884 differential comparisons against V8 RegExp.
  Round 1's **other findings were not in round 2's or round 3's scope and are
  still open in the tree** — spot-checked at round 3 and confirmed unchanged:
  `failedChecks[1]`/`materialFindings[0]` (every `HOST_INVARIANT_IMPLEMENTATION_DIGESTS`
  entry is SHA-256 of a constant label object, so it binds no implementation
  bytes — `HOST_INVARIANT_PROGRAMS` at line 873 is still a table of stubs)
  — **superseded: closed by the finding-1 fix chain, see the section at the end
  of this file**,
  `failedChecks[2]`/`materialFindings[1]` (`host-conformance-evidence-wrapper-v1`
  is still delegated wholesale to `options.validateEvidenceWrapper(value) === true`
  at line 850, with no equality checked and no test),
  `failedChecks[3]`/`materialFindings[2]` (`evidence-time-v1` executed on
  `SchemaOfferV1`/`SchemaSelectionV1`, which `HOST_INVARIANT_APPLICABLE_SCHEMAS`
  does not declare), and round 1's seven `qualityFindings` (notably: no `$ref`
  branch in the Rust oracle's `matches_schema`; thin cross-runtime vector
  coverage for collection semantics; code-point vs UTF-8-byte length semantics).
  None of these was addressed by rounds 2 or 3.
- **Round 2** (`.kstack/reviews/host-portability-2026-09-02-hp-tc01/r2-independent-review.json`,
  verdict `fix`, confidence 93) raised four items now **fixed in round 3** (its
  one failed check, both material findings, and quality finding #2):
  1. *Cross-runtime parity fork.* Round 2's narrowing of the JS grammar
     (`.` is a literal, `[^...]` rejected, real 4,096-DFA-state cap) was not
     mirrored in the digest-bound Rust reference, which still used the `regex`
     crate and answered `{"valid":true}` for `('^.$','a')`, `('^[^ab]$','c')`
     and `('^[ab]*a[ab]{20}$','a'+'b'*20)`. `src/main.rs` now carries a direct
     port of the JavaScript closed-pattern engine (tokenizer, NFA construction,
     alphabet partition, lazy subset construction, 4,096-state cap) and no
     longer uses `regex::Regex` for pattern matching. `Cargo.toml`/`Cargo.lock`
     are untouched, so the build stays `--offline --locked`. Verified by driving
     the built oracle against the JS implementation on 40 hand-picked boundary
     cases (including all three divergent cases above, plus `[a-]`, `[-a]`,
     `[--a]`, `a{007}`, `^$`, `a{0}b`, the `{0,4000}` near-cap case and every
     grammar-rejection case in the suite) and on 600 seeded randomly generated
     pattern/value pairs: **640/640 agree, zero mismatches**.
  2. *Ambiguous DFA-limit error codes.* The cheap parse-time sum-of-quantifier-maxima
     guard and the real subset-construction cap both raised
     `KSTACK_HOST_PATTERN_DFA_LIMIT`. The parse-time guard now raises
     `KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT`, its local is renamed from `budget` to
     `nfaSizeGuard`, and `KSTACK_HOST_PATTERN_DFA_LIMIT` is now raised only from
     `determinizeClosedPattern`'s intern step, which carries a comment naming it
     as the sole enforcement point for the declared 4,096-state bound. The test
     asserting `^a{4096}$` (which actually trips the parse-time guard) was
     corrected to expect the new code; the test asserting `^[ab]*a[ab]{20}$`
     continues to pin the real cap, and a new `^a{4095}$` case pins the
     accepting side of the boundary.
  3. *Repeated identical patterns recompiled.* `compileClosedSchemaSet` now
     carries a `patternCache` keyed by the pattern **string** and scoped to a
     single compile call. `state.patterns` remains a `WeakMap` keyed by the
     schema object, so every existing lookup path is unchanged. Measured: a
     schema with 60 nodes sharing one costly pattern now compiles in 191 ms
     versus 184 ms for a single node — one compile instead of 60. This is a
     performance mitigation only; it is explicitly **not** the fix for finding 4
     below and adds no new declared bound.
  4. *Stale evidence binding.* This file — regenerated above against the current
     working-tree bytes.

  Round 2's remaining items were **out of round-3 scope and are still open**:
  - `qualityFindings[0]` — `compiled.patterns` exposes `source` and
    `dfaStateCount` that nothing reads; still dead surface.
  - `qualityFindings[2]` — the catastrophic-backtracking regression test still
    asserts `elapsedMs < 2000` for work that completes in roughly 50 ms.
  - `remediation[3]`, second half — no cross-runtime **vectors** were added for
    the three constructs that forked (`.`, `[^...]`, over-cap patterns).
    `tests/fixtures/host-contract-cross-runtime-vectors-v1.json` is unchanged
    (hash above) and the committed Rust-oracle test still drives only built-in
    schemas via `closedSchemaSample`, none of which reaches those constructs.
    **The exact fork round 2 found would therefore still not be caught by
    `node --test` today** — round-3 parity was established by an out-of-tree
    differential harness, not by a committed test. Adding those vectors changes
    a digest-bound fixture, so it needs the design-decision path, not a
    drive-by edit.
  - `remediation[4]` — no test asserts `dfaStateCount` directly; round 3 added a
    behavioural `^a{4095}$` boundary case instead, and did not tighten the
    2,000 ms assertion.

## Open security finding — NOT ready for closure

Round 2 recorded one **new, still-open** security finding that round 3 did
**not** address and that must be resolved before HP-TC01 can close:

> **Compile-time aggregate denial of service.** The per-pattern bounds declared
> by `repair-r2` section 1 (256 ASCII bytes, 4,096 DFA states) bound the *output*
> of determinization, not the *work* required to reach it, and nothing bounds
> that work in aggregate across a schema set. Round 2 measured a legal 25,166-byte
> closed schema blocking `compileClosedSchemaSet` for 44.3 s, extrapolating to
> ~31 minutes at the declared 1 MB document limit, multiplied by up to 256
> `schemaEntries` in `resolveHistoricalArtifact`.

This is deliberately out of scope for round 3 and is being handled separately.
Closing it requires a narrow amendment to the frozen `repair-r2` section 1
declaring an aggregate compilation bound (round 2's suggested form: a total
DFA-state budget per `compileClosedSchemaSet` call, failing closed with a
distinct code such as `KSTACK_HOST_PATTERN_SET_BUDGET`), *then* the
implementation — adding an undeclared bound silently would itself be a contract
violation. The pattern-string memoization in fix 3 above reduces the
repeated-identical-pattern case to a single compile but does not defeat an
attacker who varies patterns.

**Round 3** (`.kstack/reviews/host-portability-2026-09-02-hp-tc01/r3-independent-review.json`,
verdict `fix`, confidence 93) independently re-verified all three round-3 code
fixes above with its own differential harnesses (3,878 comparisons, 0
divergences, plus an exact DFA-cap boundary sweep proving both runtimes flip
at the identical real state count) and found them correct and complete — zero
`failedChecks`, zero `securityFindings`. Its one `materialFindings` entry was
this file's now-corrected install-health attribution wording (see "Current
qualification" above); its `qualityFindings` are non-blocking (a boundary
test that doesn't isolate the two bounds as cleanly as it could, an
undocumented unused Rust crate dependency, an uncommented alphabet-dedup
implementation difference) and are not required before closure.

**Round 4** (approved by the item owner; two fixes, not yet reported when
rounds 1-3 above were written) closed round 1's `materialFindings[1]`
(`host-conformance-evidence-wrapper-v1` previously delegated wholesale to an
unverified caller boolean, zero test coverage) and `materialFindings[2]`
(`evidence-time-v1` enforced on `SchemaOfferV1`/`SchemaSelectionV1`, which the
frozen registry never declared applicable). Fix A re-contracted the hook from
a verdict to a data source (`options.resolveConformanceEvidenceBody`) and
implemented the two of hp-tc04-repair-r2's seven mandatory equalities that lie
inside HP-TC01's own schema surface (wrapper/body field byte-identity;
same schema-set generation), explicitly not touching the five equalities that
require the HP-TC04-owned `EvidenceAnchorV1` (no such schema was added here).
Fix B removed the two undeclared time checks to match the frozen registry
exactly. **Round 4** (`.kstack/reviews/host-portability-2026-09-02-hp-tc01/r4-independent-review.json`,
verdict `pass`, confidence 93) independently reviewed both fixes — zero
`failedChecks`, zero `securityFindings`, zero `materialFindings` — with two
non-blocking design questions worth the owner's attention: (a) no invariant
anywhere checks a `SchemaSelectionV1`'s `selectedAt` against its *own*
`expiresAt` (only against the offer's window) — judged inert, not dangerous,
but undecided; (b) the positive wrapper test shares a `results` object
reference between wrapper and body, so it doesn't by itself prove the
byte-identity check is a value comparison and not `===` (the reviewer proved
the property holds independently; a fresh-object test is recommended so a
future regression would be caught by the suite).

**Disposition: this candidate is NOT yet ready for final closure.** The
round-1 match-time ReDoS, round 1's wrapper-delegation gap, and round 1's
evidence-time-v1 applicability drift are all fixed and independently
confirmed clean across four review rounds. Still open, and each blocking or
unaddressed: the round-2 aggregate compile-cost security finding above
(blocking, needs the design-decision path); round 1's seven
quality findings; round 2's quality findings #1 and #3 and its remediation
items 4b and 5; and round 4's two non-blocking design questions above.

## What independent review must do

Reproduce `node --test tests/host-contract.test.mjs` against the exact file
identities bound above and independently interrogate the implementation
against the frozen `hp-tc01-repair-r2` schema/field/invariant/bootstrap
inventory and the `hp-tc01-tc02-registry-id-repair` decision. Confidence must
be at least 90 (this repository's design/QC bar for round 1-10 review; see
`feedback_kstack_confidence_threshold_tiers_2026_08_23`) with zero unresolved
failed checks or security findings before HP-TC01 can move toward closure.

## Design amendment: aggregate pattern-compilation-work bound (repair-r3, round 1)

Round 2's compile-time-DoS finding (see below) required a design decision, not
implementation guesswork, per team-lead's explicit instruction: run this
repo's own design-review process for a narrow repair-r2 §1 amendment scoped
only to declaring an aggregate compilation bound, self-approve only if clearly
non-material.

Candidate drafted at `.kstack/decisions/host-portability-2026-09-02-hp-tc01-repair-r3.md`
(digest `9b52eae26522cb71e5344d833d282380e3d3ca95ace96dea44db298a7b974a03`),
proposing a new `maxPatternCompilationWork` global bound (a per-`compileClosedSchemaSet`-call
DFA-state-creation counter, new distinct error code
`KSTACK_HOST_PATTERN_AGGREGATE_LIMIT`, Option A = 16,384 states recommended).
Dispatched through `plugins/kstack/scripts/kstack-dual-review.mjs` (this
repo's own design-review tool, per `phaseModels.design: ["codex","opus"]`) —
out-dir `.kstack/reviews/host-portability-2026-09-02-hp-tc01-repair-r3/`.

**Result: real, material disagreement between reviewers — NOT self-approvable.**

- Codex: `approve`, confidence 95, 0 failed / 0 security / 0 dissent / 0
  questions. Endorses Option A as specified.
- Opus: `revise`, confidence 72, 4 failed checks, 2 security findings
  (1 medium, 1 low), 2 material dissent items, 7 unresolved questions.
  Substantive technical objections, not pedantry: (1) the pattern-compilation
  cache's scope/lifetime is undeclared, so if it persists across
  `compileClosedSchemaSet` invocations the aggregate counter — and therefore
  accept/reject and the emitted error code for an identical document — depends
  on process history (cold vs warm cache), contradicting the addendum's own
  determinism requirement; (2) the ~42µs/DFA-state cost constant is a single
  sample, not a validated worst case (per-state subset-construction cost scales
  with NFA size/alphabet width, and the per-pattern NFA-size limit's actual
  value was never supplied in the packet), so neither Option's claimed
  wall-clock bound is substantiated; (3) check-precedence/traversal order across
  schema entries and patterns within one call is not normatively fixed, so JS
  and Rust could iterate in different orders and emit different error codes for
  the same input, breaking cross-runtime parity; (4) Option A's headroom is
  argued only against today's small corpus, not against the maximum corpus the
  frozen limits already admit (256 schemas × 1,048,576 bytes) — at 16,384
  states that's only ~64 states/schema average.

Both reviewers independently agree Option A (16,384) is the right ceiling
value; the disagreement is about whether the addendum as drafted is
sufficiently specified and whether its security-closure claim is
substantiated. Opus's recommendation is four additive clarifications (cache
scope, real worst-case cost derivation, fixed traversal/precedence order,
headroom vs. admissible corpus) — none of which reopen Option C or any other
frozen repair-r2 content.

**Disposition: escalated to team-lead per their own instruction, not
self-approved.** Full verdicts persisted at
`.kstack/reviews/host-portability-2026-09-02-hp-tc01-repair-r3/{codex,opus}.json`
and `manifest.json` (designDigest `9b52eae2...`). This design amendment is
NOT closed and repair-r3 is NOT yet an accepted decision.

## Design amendment round 2 (repair-r3, folding Opus's 4 clarifications)

Per team-lead's approval, folded all four round-1 clarifications into the
same candidate (cache-scope statement, step-count-only closure argument with
the cited NFA_SIZE_LIMIT=4,096 value, explicit check-precedence/traversal-order
binding to the existing SET_BY_FIELDS order, headroom + replay-versioning
statements) and re-ran the same dual review. Out-dir
`.kstack/reviews/host-portability-2026-09-02-hp-tc01-repair-r3-round2/`,
designDigest `309bf9e075dd4fc9a2123c2832d8b656ef0cab706be73306879b9ed08671752a`.

**Result: disagreement persists and deepened, not just a lower confidence
score.** Codex: approve, 96 (up from 95). Opus: revise, 71 (essentially flat
vs round 1's 72), now with 6 failed checks (up from 4), 3 security findings
(up from 2), and — most significant — a NEW structural concern round 1 never
surfaced: because `resolveHistoricalArtifact` compiles every `schemaEntries`
member (up to 256) in one `compileClosedSchemaSet` call before selecting the
entry matching `expectedSchemaDigest`, an aggregate bound scoped to that whole
call makes a given artifact's replay validity depend on the composition of
the *entire* schema set, not just the artifact itself — so adding unrelated
schema entries over time could push a previously-valid historical artifact's
replay past `maxPatternCompilationWork` with no limit change at all. Opus
explicitly dissents from the addendum's own claim that it "introduces no new
versioning concern" and now leans toward Option B (65,536) instead of Option A
(16,384) pending a corpus-growth projection neither reviewer has. Other
persisting findings: the compilation-cache *key*/equality relation (not just
its lifetime) is still unspecified; the step-count closure argument still
lacks a declared per-state-cost bound (alphabet/transition-partition width),
so it narrows rather than fully closes the DoS surface; intra-schema pattern
traversal order is asserted identical cross-runtime by inference, not pinned
normatively.

**Disposition: escalating to team-lead again per their own explicit
instruction** ("if round 2 still shows real disagreement, not just a lower
confidence score, bring it back and we'll consider Fable then") — this is
exactly that case. Full verdicts persisted at
`.kstack/reviews/host-portability-2026-09-02-hp-tc01-repair-r3-round2/{codex,opus}.json`.
repair-r3 remains NOT an accepted decision after 2 rounds.

## Finding-1 fix chain: invariant implementation digests now bind real bytes

Round 1's `failedChecks[1]` / `materialFindings[0]` — every
`HOST_INVARIANT_IMPLEMENTATION_DIGESTS` entry hashed only a constant label
object, binding no behavior-determining bytes — was recorded above as untouched
by any round. That is no longer accurate. It has since run its own
implement-then-adversarially-review loop in its own thread,
`.kstack/reviews/host-portability-2026-09-02-hp-tc01-finding1/`.

**Round accounting, stated precisely.** Seven independent adversarial reviews,
interleaved with the implementation passes enumerated below: six reviews are
persisted as `r1-` through `r6-independent-review.json` in that directory, and
the seventh is
the closing review of the whole-module-digest mechanism, whose JSON is not (yet)
persisted alongside them. Verdicts and confidence, read off the files: r1 `fix`
92, r2 `fix` 93, r3 `fix` 93, r4 `fix` 92, r5 `reject` 92, r6 `reject` 92; the
closing round found no bypass (see "Closing round" below). This section
supersedes the "untouched" wording in the round-1 bullet and in the disposition
paragraph above, and supersedes the `32 passed` count in "Current qualification".

**What each round changed.**

- **Round 1** replaced the label-only digest with a real behavior digest: each
  of the eleven `REQUIRED_INVARIANT_IDS` now hashes the normalized source text
  (`Function.prototype.toString`, CRLF-normalized) of the explicitly bounded
  closure of functions that decide that invariant's outcome
  (`HOST_INVARIANT_IMPLEMENTATIONS`), plus a `HOST_INVARIANT_IMPLEMENTATION_CONSTANTS`
  mechanism for module constants that decide an outcome by VALUE rather than by
  source. Review found the closure under-broad.
- **Round 2** widened it where review showed real gaps: one dispatch wrapper per
  invariant so a neutered artifact-name guard moves exactly one digest;
  `resolveHistoricalArtifact` hashed into all eleven because it holds the single
  gate deciding whether any invariant runs on the historical-resolution path;
  and `assertDispatchTableClosure()`, a module-evaluation guard closing the
  added-row hole that moves no digest by itself.
- **Round 3** (`r3-independent-review.json`, verdict `fix`, confidence 93)
  confirmed rounds 1-2 correct but found one more instance of the same class:
  the guard's per-row check tested closure MEMBERSHIP, not ROLE. Several hashed
  functions are shared across all eleven closures and return truthy values, so a
  registered invariant id could be registered in the OTHER dispatch table backed
  by one of them — the reviewer's probe was
  `'result-shape-v1': resolveHistoricalArtifact` in `CONTEXTUAL_INVARIANT_DISPATCH`
  — and the module loaded cleanly with 0 of 11 digests moved, defeating the
  `KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE` guard. The reviewer's
  `strongestObjection` was that three rounds had each curated one more function
  into the closure, and recommended closing the CLASS by hashing the dispatch
  tables' structure itself as data.

**Post-round-3 fix, following that recommendation** (the pass subsequently
reviewed as `r4-independent-review.json`; still in place today). (Numbered
separately from the main HP-TC01 thread's rounds — "round 4" elsewhere in this
file refers to that thread, not to this one.) The dispatch tables'
shape is now hashed as DATA into all eleven entries via the existing
`HOST_INVARIANT_IMPLEMENTATION_CONSTANTS` mechanism — new constant
`HOST_INVARIANT_DISPATCH_TABLE_SHAPE`, carrying each table's ordered key list
plus, per key, the function's name parsed out of its own source text (never read
off `fn.name`, which one unhashed `Object.defineProperty` line could rewrite).
Declared names rather than function bodies keep per-invariant attribution: a
wrapper body edit still moves exactly one digest. `assertDispatchTableClosure`
gained two clauses beyond membership: the row's function must be hashed under
that id ALONE (rejecting every shared primitive without naming any of them,
read off already-hashed data), and must be identically that id's canonical
wrapper for that specific table (`CANONICAL_STRUCTURAL_DISPATCH` /
`CANONICAL_CONTEXTUAL_DISPATCH`). A fifth clause runs before those: both tables
must be `Object.isFrozen`. Self-review of the first draft of this fix found a
residual of the identical class reached by a different mechanism — the checks and
the hashed shape both read the tables once at module evaluation, while dispatch
re-reads them on every call, so dropping `Object.freeze` from a table literal and
assigning the round-3 row AFTER `assertDispatchTableClosure()` returned passed
every row check against the pre-mutation table with 0 of 11 digests moved and the
same guard defeated (reproduced, then closed; see the probe results below). The
false in-file comment asserting the
row-swap residual was "inert" is replaced — it had reasoned only about the seven
`dispatch*` wrappers, not the full hashed closure. Dispatch-table key ORDER moved
from the DELIBERATELY EXCLUDED list to the hashed set. The DELIBERATELY EXCLUDED
list now also discloses plainly that the attestation machinery is not
self-attesting: `assertDispatchTableClosure` and its call site,
`declaredFunctionName`, `dispatchTableRoles`, `implementationSourceDigest`, the
shape/constants construction, and the digest expression itself are a bootstrap
boundary held by the regression suite, not by a digest.

**Verification of the round-3 probe, before and after** (scripted reconstruction:
the current file with this round's three mechanisms stripped back out is the
"before"; both builds then get the identical row injection):

- BEFORE — module load CLEAN, digests moved **0 of 11**,
  `validateHostArtifactContext('OperationResultV1', ...)` goes from
  `KSTACK_HOST_INVARIANT_CONTEXT_NOT_APPLICABLE` to ACCEPTED. Bypass reproduced.
- AFTER — module load REJECTED:
  `kstack-host-contract: unattested dispatch-table row 'result-shape-v1'
  dispatches a function shared across invariant closures (also hashed under
  'request-time-order-v1')`.

The same reconstruction for the post-load-mutation residual (unfreeze the
contextual table, assign the row after the guard call):

- BEFORE the frozen-table clause — module load CLEAN, digests moved **0 of 11**,
  `validateHostArtifactContext('OperationResultV1', ...)` ACCEPTED.
- AFTER — module load REJECTED:
  `kstack-host-contract: unattested dispatch-table row set — the contextual
  dispatch table is not frozen (post-load row injection?)`.

**Status of the post-round-3 fix: implemented, and independently confirmed
durable by `r4-independent-review.json`** ("This class is genuinely closed") —
it is still the live mechanism for dispatch-table role/identity/freeze. One new
test with seven probes was added to `tests/host-contract.test.mjs`, each keeping
one clause load-bearing: the exact round-3 injection; the same injection with the
smuggled function's `name` rewritten at module top level (still rejected by the
identity clause); an exclusive-but-not-a-dispatcher swap
(`conformanceEvidenceSharedProjection`, which also returns a truthy object,
rejected only by the canonical-wrapper clause); two probes with
`assertDispatchTableClosure()`'s own call site deleted, proving an added row and a
same-key dispatcher swap each still move all eleven digests as a property of the
hashed data rather than of the guard running — the same-key probe also renames
the swapped-in function to the one it displaced, which would have collapsed the
hashed roles map back to its original bytes had the shape read `fn.name` instead
of parsing the declared name from source; the post-guard row injection into an
unfrozen table; and a table reorder, which is a legal table and so must load and
move all eleven digests rather than fail closed.

One pre-existing probe was edited, not added: the dispatch-table-row DELETION
probe's anchor is now scoped to the live table by its header, because
`CANONICAL_STRUCTURAL_DISPATCH` declares the identical row text and the probe
must delete the row that actually dispatches, not the binding it is checked
against. Its assertion is unchanged.

At that pass the targeted suite stood at 42 passed / 0 failed and the seven
adjacent host suites at 113 passed / 0 failed. Those numbers are historical;
the current counts are at the end of this section. The Rust reference oracle
`plugins/kstack/native/host-contract-reference/src/main.rs` needed **no change**
at that pass and still needs none: it implements canonicalization and the
closed-pattern engine only, and contains no invariant-dispatch or
implementation-digest logic.

**Rounds 4-6: the same class kept reopening one level up, three more times.**

- **Round 4** (`r4-independent-review.json`, `fix`, 92) agreed the dispatch-table
  class was closed by construction, and then found the *free-variable* class
  alive elsewhere: six functions reachable from hashed functions were themselves
  unhashed and undisclosed, and one of them — `loadBootstrap`'s
  `KSTACK_HOST_CLOSURE_DIGEST_MISMATCH` check, the only digest-to-content binding
  for all six bootstrap loads on the historical-resolution path — was deletable
  with **0 of 11** digests moved and the whole suite green, letting a substituted
  schema-set closure validate under the genuine address. Its recommendation was
  explicitly *not* to curate one more function into the hash but to add a
  mechanical test enumerating every hashed function's free module-scope
  identifiers. Round 4 also first reported the `host-core-final-review` packet
  bound failing (774,110 vs 700,000).
- **The pass answering round 4** built exactly that: a module-scope binding
  scanner plus a free-identifier enumeration test in
  `tests/host-contract.test.mjs`.
- **Round 5** (`r5-independent-review.json`, verdict **`reject`**, 92) defeated
  it live. With the new enumeration test in place *and passing*, the reviewer
  lifted `resolveBoundArtifact`'s reference-binding check into a module-scope
  helper declared as the **second declarator of a comma-separated `const` list**
  — a form the line-anchored extractor could not see — then neutered it: 0 of 11
  digests moved, the full suite stayed green, and a hostile resolver's
  substituted requirement-profile artifact validated as ACCEPTED. Three further
  legal declaration forms (indented declaration, `function*`,
  `export default function`) were also invisible to the extractor.
- **The pass answering round 5** replaced the regex extractor with a
  brace/paren/bracket-depth-0 tokenizing scanner plus positive accounting (every
  declaration keyword found at depth 0 must yield at least one binding, or the
  test fails loudly).
- **Round 6** (`r6-independent-review.json`, verdict **`reject`**, 92) defeated
  *that* one, live, the same way: `var` is function/module-scoped, not
  block-scoped, so a helper declared as `{ var probeEvidenceTime = ...; }` is a
  genuine module-scope binding the depth-0 scanner never records and the positive
  accounting never flags. Extracting `checkEvidenceTimeV1`'s
  `OperationEligibilityV1` guard into it and neutering it produced 0 of 11 digest
  movement, a green 56-test suite, and an inverted-time `OperationEligibilityV1`
  flipping from REJECTED to ACCEPTED. Round 6's assessment was that this was no
  longer a curation bug: *"the fundamental approach — hash source text, then
  hand-build a scanner to enumerate what's excluded — has now failed in the same
  way twice, by two different implementers building to two different (both
  reasonable) specifications."* Its `strongestObjection` recommended replacing
  the whole approach with an EOL-normalized **whole-module source digest** mixed
  into all eleven entries, and it explicitly flagged the keep-attribution vs.
  whole-module-digest choice as *"an owner decision, not an implementation
  detail."*

**Mechanism change: per-invariant attribution replaced by a whole-module source
digest. Owner-approved, not a unilateral implementation choice.** Round 6 raised
the choice as an owner decision; the project owner approved the whole-module
digest, and that is what was implemented. `HOST_MODULE_SOURCE_DIGEST` — this
module's own on-disk source, EOL-normalized — is now mixed into all eleven
`HOST_INVARIANT_IMPLEMENTATION_DIGESTS` entries. There is no scanner and no
curated exclusion list left in the soundness path: no name *declared in this
module* can be outside the hash, so a guard cannot be lifted into an unhashed
module-scope helper and re-attested as a refactor, which is precisely the attack
r5 and r6 each proved end to end.

**Accepted cost, stated plainly: per-invariant attribution is gone.** Any edit
anywhere in `kstack-host-contract.mjs` — a comment, an unrelated helper,
whitespace — now moves all eleven digests and forces a re-attestation. This is
the same deliberately-over-broad trade the file already accepted three times
(for `fail`, `resolveHistoricalArtifact`, and `HOST_INVARIANT_DISPATCH_TABLE_SHAPE`),
extended to the whole file. `HOST_INVARIANT_IMPLEMENTATIONS`, the enumeration
test, and `HOST_INVARIANT_CLOSURE_EXCLUSIONS` were **retained and retitled as
documentation/disclosure**, not deleted: they still record which functions decide
which invariant (real design information a file hash cannot express), and
`assertDispatchTableClosure` / `implementationSourceDigest` still depend on the
table for the added-row and deleted-row guards. A miss in the scanner is now a
stale document, not a hole. Per-invariant attribution is preserved test-side
only, computed by `documentedClosureSources()` and explicitly attesting to
nothing.

**Closing round: adversarial re-review of the new mechanism, no bypass found.**
The closing reviewer ran a full adversarial probe battery against the
whole-module digest and could not defeat it — verbatim: *"The mechanism itself is
sound and I could not defeat it — that part is genuinely done."* Three
disclosures were recorded rather than claimed closed, and they are the honest
boundary of what this mechanism does and does not cover:

1. **It covers this one file's bytes, and only this one file's.** That is
   sufficient *today* only because `kstack-host-contract.mjs` has zero cross-file
   project imports (it imports `node:crypto` and `node:fs` and nothing else). Add
   a project import and the attested surface no longer matches the executing
   surface.
2. **A loader that rewrites the source in flight is not caught.** The digest is
   taken from a disk read; source transformed between disk and V8 leaves the disk
   bytes unchanged.
3. **Some guards inside hashed functions still have no direct behavioral test.**
   Round 6's mechanical sweep found 10 of 34 `fail()` sites inside hashed
   functions protected only by digest movement. Detection via digest movement is
   not the same property as prevention via a positive test — an attacker who is
   willing to re-attest still gets an accepted change past the suite. This is a
   materially narrower residual than the r5/r6 situation (where the bypass moved
   *no* digest at all and was therefore silent), but it is a residual.

**Closing hardening pass (this pass): the whole-module digest now hashes raw
bytes, not a UTF-8 decode.** The closing review's one remaining code item.
`HOST_MODULE_SOURCE_DIGEST` was computed as
`sha256(readFileSync(url, 'utf8').replace(/\r\n/gu, '\n'))` — a **lossy** decode,
so distinct invalid-UTF-8 byte sequences that decode to the same run of U+FFFD
replacement characters minted the *identical* digest. The reviewer proved this
empirically (three different invalid byte sequences, one digest) and also proved
it was **not exploitable**: V8's ESM source decoder and Node's `Buffer` UTF-8
decoder agree on replacement-character behavior, so a collision implied an
identical parsed program. It was still an implicit, unstated, unpinned assumption
resting on two independent decoders happening to agree — the exact shape that
broke this chain at r5 and r6 — so it was eliminated rather than documented.

The constant now hashes the raw `Buffer` returned by `readFileSync`, with a
byte-level CRLF→LF normalization (`normalizeSourceEolBytes`, rewriting `0x0D 0x0A`
to `0x0A` on the buffer) instead of `String.prototype.replace` on a decoded
string. Neither `0x0D` nor `0x0A` can occur inside a multi-byte UTF-8 sequence,
so for validly encoded source this is exactly equivalent to the old regex — the
happy path is unchanged by construction, and the pre-existing "identical for LF
and CRLF checkouts of the same source" test still passes.

Measured, same three invalid sequences (`C0 AF`, `E0 80`, `FE FF`) appended to
the module as a trailing line comment:

- BEFORE — `request-time-order-v1` minted
  `sha256:8a3af35fdc6b94e3ef082082e115be2ef132627b13e26442d044e53291247a84` for
  **all three** variants: **1 distinct digest of 3**.
- AFTER — `sha256:e6a39baf…`, `sha256:44d9856e…`, `sha256:ba3d9b88…`:
  **3 distinct digests of 3**.

One regression test was added to `tests/host-contract.test.mjs`
(*"the whole-module source digest hashes raw bytes, so invalid-UTF-8 sequences
that decode alike do not collide"*), reproducing the reviewer's own proof
permanently. It pins both halves so a revert to lossy decoding cannot pass it:
it asserts the three variants differ as bytes but decode to the identical source
text, recomputes the superseded lossy digest test-side and asserts it **still
collides**, then asserts all eleven registered digests are pairwise distinct
across the three variants. Sanity check that the core property survived the
change: an edit to an unrelated comment in a scratch copy moves **11 of 11**
digests.

**Packet-size bound.** `tests/host-core-final-review.test.mjs` asserted a single
700,000-byte serialized-packet ceiling for every review group. The finding-1
attestation work legitimately grew the `host-portability-identity` packet past it
(reported failing by r4 at 774,110, r5 at 794,089, r6 at 838,083). In a prior
round the assertion was made per-group: `host-portability-identity` is bounded at
**1,000,000** bytes and every other group keeps the original **700,000**
(`MAX_PACKET_BYTES` / `DEFAULT_MAX_PACKET_BYTES`). The packet measures **856,782**
bytes as of this pass and `node --test tests/host-core-final-review.test.mjs`
passes **3 of 3**. This is a bound that was raised deliberately after three
rounds flagged it, not a defect that was suppressed.

**Current counts and file identities (after this closing pass).**

- `node --test tests/host-contract.test.mjs`: **58 passed, 0 failed** (57 before
  this pass; +1 new regression test).
- `node --test tests/host-core-final-review.test.mjs`: **3 passed, 0 failed**.
- Adjacent suites re-run unchanged: `host-request-context`, `host-evidence`,
  `host-eligibility`, `host-receipt`, `host-replay`, `host-migration`,
  `host-mutation` — **113 passed, 0 failed**.
- `plugins/kstack/scripts/kstack-host-contract.mjs`
  `0ccf5a675c0904c3363b8dd579c04b9c17019d07ef18b48345c65055da326d6a`
- `tests/host-contract.test.mjs`
  `1ae60adbb9840b24ac4bc8bf642e82c62c04e13b97c9f9bce76a9862b2ec5b45`

  Both files also carry unrelated in-flight hunks from the concurrent
  pattern-DFA / `compileClosedSchemaSet` thread, so these digests are
  working-tree identities, not finding-1-only identities.

**Scope note.** This closes round 1's `materialFindings[0]` only. The blocking
round-2 aggregate compile-cost security finding, round 1's seven quality
findings, round 2's quality findings #1 and #3 and remediation items 4b/5, and
round 4's two design questions all remain open exactly as recorded above, and
HP-TC01 as a whole is still NOT ready for final closure. Within finding 1
itself, the three disclosures above (single-file scope, in-flight source
rewriting, and the behaviourally-uncovered `fail()` guards — 10 of 34 at r6's
sweep, not re-swept since) are open residuals, disclosed rather than closed. The
`install-health-audit-manifest-v1.json` pin for `kstack-host-contract.mjs` is
stale again after this pass and must be regenerated at commit.
