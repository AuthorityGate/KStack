# Rejected-options ledger: broader planning lenses

**Thread:** `broader-planning-lenses-2026-08-24`  
**Created:** 2026-08-25  
**Status:** living document; update in place  
**Baseline for comparison:** round 10 combined confidence 78

This ledger records whole mechanisms that regress confidence or are otherwise
shown unsound. It complements the subordinate per-item ledger and does not
replace the formal design gate.

## Rejected-options ledger

### 1. Round-11 combined generation package with append-only loose judgment records

- **What was tried:** Round 11 preserved the independently accepted arm-paired
  T0 baseline, 162-sheet graph, repeated workload, and nested keyed judgment
  direction. It added decoded-name duplicate detection before semantic parsing,
  froze one canonical package containing the restricted analysis map and all
  generation sheets, bound later records to that package digest, compared five
  context members byte-for-byte, named rater/resolver clustering, fixed map
  collation and `scoringOrder`, and propagated malformed sheets through
  `MISSING_COMPARISON`.
- **Round:**
  `.kstack/reviews/broader-planning-lenses-2026-08-24-round11/` at design digest
  `66bc77d2eeebb515f06a30f941af251b866dae4b5cc9c952283ad5daba1a545f`.
- **Confidence effect:** Codex 66 and Opus 70 produced combined confidence 66,
  twelve points below round 10's 78 high-water mark and fourteen below the real
  80 target.
- **Why rejected:** Both reviewers accepted the raw duplicate-detecting parser,
  but the combined artifact/lifecycle did not define an authoritative judgment
  inventory, record digest/identity, one-record cardinality, correction rule,
  multi-version analysis selection, or pre-parse expected identity. The private
  arm/slot map was co-located with adjudicator-facing sheets without a release
  boundary, so literal distribution could defeat blinding. The map serializer
  was exact for ordinary IDs but the admitted string domain allowed lossy
  surrogate sort collisions, and map validity did not enforce tuple uniqueness,
  exact 162-tuple completeness, slot/candidate bijection, arm/family eligibility,
  or root-reference consistency. Rater IDs were not bound to a frozen roster and
  cross-record ordinals had no enforcement point. Multiple valid records could
  leave a comparison neither scorable nor missing. The gate was blocked with
  six security findings, two genuine material dissent entries, and failed
  schema, threat-model, and verification checks.
- **Alternative:** Do not edit or extend the round-11 packet. Any future
  owner-authorized attempt must restart from round 10's independently validated
  arm-paired baseline/workload/source-dependence core and retain Round 11's raw
  decoded-duplicate parser as an independently supported direction. Use two
  separately serialized artifacts: (1) a withheld control manifest containing
  an exact closed-ASCII comparison/record-ID grammar, the unique complete
  162-tuple graph, slot/arm/family/policy invariants, roster IDs, expected raw
  record IDs, and digests of released sheet bytes; and (2) adjudicator-facing
  sheet bytes that contain no arm map. Bind both to a frozen owner-controlled
  trial-version registry. Admit exactly one immutable judgment record per
  expected record ID; corrections require a new trial version, while old
  package/record evidence remains verifiable but never mixes with the selected
  analysis version. A frozen outer inventory must bind filename/record ID to
  expected comparison before raw parsing, bind each judgment digest and roster
  member, enforce batch cardinality and ordinals, and select the one exact
  package plus record-digest set used for scoring. Specify a runtime-independent
  canonical JSON byte grammar or one frozen runtime/version, parser size/depth/
  member limits, and a closed tagged serialization for
  `MISSING_COMPARISON`. This alternative is unreviewed, carries no round-11
  confidence, and requires a fresh independent design digest.

### 2. Round-12 withheld-manifest/released-sheet separation with owner-authored trial-version registry

- **What was tried:** Round 12 restarted from round 10's independently
  validated core (not round 11's rejected packet), retained `BPL-R11-01`'s
  raw decoded-duplicate parser, and applied round 11's own recorded
  alternative: two separately serialized artifacts (a withheld control
  manifest carrying the arm map, and adjudicator-facing generation sheets
  carrying no arm map at all); both bound to a frozen, owner-authored
  trial-version registry; exactly one immutable judgment record per expected
  record ID with corrections versioning forward; a frozen outer inventory
  performing pre-parse filename/record-ID binding, post-parse digest/roster
  binding, cross-record batch cardinality and ordinal enforcement, and
  single-version selection; and a runtime-independent canonical JSON byte
  grammar with parser size/depth/member bounds and a closed tagged
  `{"status": "scored"|"missing"|"structural-zero"}` union in place of the
  bare `MISSING_COMPARISON` string.
- **Round:**
  `.kstack/reviews/broader-planning-lenses-2026-08-24-round12/` at design
  digest `5243c55093262817b103a5cb3563b974a8e7062bb8c862d29ae1bf61ea009527`.
- **Confidence effect:** Codex 48 and Opus 64 produced combined confidence
  48 — 30 points below round 10's 78 high-water mark, 18 points below round
  11's already-rejected 66, and 32 points below the working target of 81.
- **Why rejected:** Both reviewers independently PASS `BPL-R12-01` (restart
  integrity) but independently FAIL `BPL-R12-04` and `BPL-R12-05` on the
  same two direct normative contradictions, not mere gaps: (1) Selected
  rule 3 keeps the first-accepted record immutable and rejects only a
  byte-differing second submission, while Normative fixture 5 and the
  failure-modes table both say both records are rejected, leaving undefined
  whether the expected record ID still counts toward the "exactly 162"
  completeness test; (2) Selected rule 4 item 3's strict "exactly 162, not
  at least" eligibility gate is incompatible with Selected rule 7 and
  fixture 3, under which a `DIGEST_MISMATCH`/absent/malformed comparison
  must become a tagged `missing` row that propagates into policy rows —
  under the strict gate no selected analysis version could ever legally
  contain a `missing` row, making rule 6c's `missing` variant unreachable,
  and the brief never states it is deciding the deferred
  insufficient-population question this way. Additional independent
  failures: neither reviewer found a requirement that `comparisonId`/
  `expectedRecordId` be pairwise unique across the withheld manifest's 162
  entries, even though the outer inventory's lookups presuppose uniqueness
  (Opus also separately flags that unconstrained `recordId` assignment could
  itself leak a tuple-order grouping channel, reopening blinding by a
  different path than round 11's `BPL-R11-SEC-01`); Codex separately found
  the canonical integer grammar (Selected rule 6a) specifies unsigned digit
  sequences while Selected rule 6c's scored numerator ranges over `[-48,48]`
  and the brief's own example serializes `-3`, so roughly half of all legal
  scored values have no conforming canonical byte spelling; and the
  owner-authored trial-version registry, while structurally an improvement
  over round 11's bare SHA-256 self-consistency, remains a mutable
  git-tracked record with procedural (not cryptographic or externally
  anchored) approval, which both reviewers separately flagged as an
  incomplete trust anchor. The gate was `BLOCKED` with 8 combined security
  findings, 2 genuine material dissent entries (Opus), and 3 failed
  deterministic checks (`design-schema-valid`, `threat-model-complete`,
  `verification-plan-complete`).
- **Alternative:** Do not edit or extend the round-12 packet. Retain
  `BPL-R12-01`'s restart integrity, `BPL-R12-03`'s registry structure, and
  `BPL-R12-06`'s tagged-union/parser-bound direction (Opus independently
  PASSed all three) as supported directions for a future round, but a
  future owner-authorized attempt must, as a minimum, isolated one item at a
  time per the one-change-per-round discipline: (a) pick exactly one
  disposition for a byte-differing duplicate submission and make every
  fixture and the failure table agree with the selected rule, stating
  explicitly whether the originally accepted record still counts toward
  completeness while a conflict is open; (b) decide explicitly whether a
  selected analysis version may ever contain a tagged `missing` row — if
  not, state that the tagged union and its propagation rule are inventory
  diagnostics only and are never reachable in a scored analysis; if so,
  replace the absolute "exactly N" gate with an owner-recorded
  permanent-absence path that preserves auditable completeness without an
  all-or-nothing block; (c) add explicit pairwise-uniqueness validation for
  `comparisonId` and `expectedRecordId` across the withheld manifest, and
  require `recordId` assignment to be independent of the
  `(caseId, family, outputRole, candidateArm)` enumeration order (for
  example, a fixed random permutation frozen with the manifest); (d) correct
  the canonical integer grammar to admit a leading `-` for negative
  integers, or restate the scored-value representation so no legal value
  requires an unrepresentable byte spelling; (e) either state a
  cryptographic or externally anchored trust mechanism for the
  trial-version registry, or explicitly scope the claimed protection to
  "resists casual tampering, not a compromised or dishonest owner-approval
  step," matching what the design actually provides. This alternative is
  unreviewed, carries no round-12 confidence, and requires a fresh
  independent design digest.

### 3. Round-13 duplicate-revocation-plus-permanent-absence fix for `BPL-R12-04`/`BPL-R12-05`

- **What was tried:** Round 13 restarted from round 10's core plus the three
  round-12 directions Opus independently PASSed (`BPL-R12-01` restart
  integrity, `BPL-R12-03` registry structure, `BPL-R12-06` tagged-union/
  parser-bound direction), and attempted exactly the two isolated fixes this
  round was chartered for: (1) picked one disposition for a byte-differing
  duplicate — both submissions rejected, the first's provisional acceptance
  retroactively revoked, zero accepted records for that `expectedRecordId`
  until a correction (new trial version) or an owner-authored
  permanent-absence declaration — and restated Selected rule 3, fixture 5,
  and the failure table identically; (2) replaced the "exactly 162, not at
  least" completeness gate with an exact-set-equality test over the disjoint
  union of accepted and owner-declared-permanently-absent `expectedRecordId`s,
  introducing a new immutable `bpl-trial-version-absence-declaration`
  artifact so Selected rule 6c's tagged `missing` variant becomes reachable
  in a scored analysis exactly through a declared absence. The three
  round-12 residuals (uniqueness, `recordId` order-independence, integer
  sign, trust-anchor strength) were named as explicitly deferred, not
  touched.
- **Round:**
  `.kstack/reviews/broader-planning-lenses-2026-08-24-round13/` at design
  digest
  `6a85dc04d52ab4b389c17aa18a1eef0660975bd8505c1bdb25205f4196179797`.
- **Confidence effect:** Codex 34 and Opus 62 produced combined confidence
  34 — 44 points below round 10's 78 high-water mark/reject floor, 14 points
  below round 12's already-rejected 48, and 47 points below the working
  target of 81. This is a further regression, not a recovery.
- **Why rejected:** Both reviewers independently FAIL both `BPL-R13-01` and
  `BPL-R13-02`, and both independently name the same two root defects: (1)
  Selected rule 4 step 1 was carried forward from round 12 unrevised and
  still pre-parse-rejects a duplicate `expectedRecordId`, which is not
  provably consistent with Selected rule 3's new requirement that a second
  submission's bytes be compared before disposition — on the natural
  reading this silently reinstates round 12's rejected keep-the-first
  behavior; (2) the new absence-declaration artifact has no `declarationId`,
  so `supersedesDeclarationId` names nothing, "current declaration" cannot
  be evaluated, and nothing stops two or more declarations from being
  simultaneously current. Opus additionally found a more fundamental defect
  neither draft anticipated: retroactively revoking a provisionally accepted
  record can leave an unfillable gap in that record's raters'
  `adjudicationOrdinal` sequences (immutable records mean the gap can never
  close), so the item 3b permanent-absence escape hatch — added specifically
  to resolve an unresolvable duplicate — cannot actually restore eligibility
  in the exact scenario it exists for; Opus rates this a high-severity new
  availability/griefing finding (`BPL-R13-SEC-01`), not a mere gap. Codex
  separately found no defined validation order for a malformed second
  submission and no deterministic `reason` when multiple role sheets for one
  comparison are declared absent with different reasons. Opus separately
  found a new selection-bias/blinding surface (`BPL-R13-SEC-02`): the
  owner-authored absence declaration has no cap, balance diagnostic, or
  independent review, so the same owner who holds arm-map access could
  selectively declare unfavorable comparisons absent with no audit-visible
  violation. The gate was `BLOCKED` with 3 failed deterministic checks
  (`design-schema-valid`, `threat-model-complete`,
  `verification-plan-complete`), 7 combined security findings, and 0
  material dissent (both reviewers' disagreements were failed checks, not
  dissent, because there was no selected rule left standing for them to
  dissent from).
- **Alternative:** Do not edit or extend the round-13 packet. The
  reachability *decision* itself (owner-authored permanent absence, exact-set
  equality over two disjoint partitions) is sound per Opus and is not
  rejected on its own terms; what failed is the artifact/interaction design
  carrying it. Retain `BPL-R12-01`/`BPL-R12-03`/`BPL-R12-06` as supported
  directions. A future owner-authorized attempt must, at minimum, address
  root causes rather than symptoms, isolated per the one-change-per-round
  discipline:
  - (a) Resolve the ordinal-gap unfillability *first*, before revisiting the
    duplicate disposition at all: either (i) redefine the per-rater ordinal
    invariant so it is evaluated only over records that were never
    retroactively revoked (i.e., a revoked record's ordinal is excluded from
    the sequence entirely, and the sequence is re-validated as gap-free over
    the surviving records only, not over the original 1..N range), or (ii)
    do not retroactively revoke the first record's provisional acceptance at
    all — instead mark the *comparison* disputed/unscorable while leaving
    the ordinal already consumed, and let a correction or absence
    declaration operate on the comparison-level disposition without ever
    un-consuming an ordinal. Either path must be checked against fixture 7
    and the ordinal invariant before being combined with anything else.
  - (b) Add a `declarationId` to the absence-declaration schema, bound to the
    same closed ASCII grammar as other identifiers, required unique across
    declarations for a `trialVersionId`; require `supersedesDeclarationId` to
    be either `null` or an existing `declarationId` for the same
    `trialVersionId`; and require exactly one non-superseded declaration per
    `trialVersionId` as a fail-closed check (reject if zero or more than one
    root/leaf is found).
  - (c) Rewrite Selected rule 4 step 1 explicitly so a repeat
    `expectedRecordId` is routed into Selected rule 3's byte-comparison
    triage rather than being rejected at step 1 as an unconditional
    duplicate; state the exact order of raw parsing, byte comparison, and
    any semantic validation needed to make that comparison.
  - (d) Define the `reason` a comparison-level missing row uses when more
    than one of its role sheets is separately declared absent with different
    reasons (a fixed precedence order, or a requirement that all such
    reasons already match, checked before the declaration is accepted).
  - (e) Add an explicit bound on the owner-authored absence-declaration
    surface (for example: a declaration may only name an `expectedRecordId`
    that already has a recorded rejection or documented-unobtainable-source
    reason from the inventory, never an untouched or never-submitted
    comparison) to close `BPL-R13-SEC-02` before claiming the mechanism
    safe. This alternative is unreviewed, carries no round-13 confidence,
    and requires a fresh independent design digest.

### 4. Round-14 comparison-level-dispute fix (option ii) for the ordinal-gap unfillability

- **What was tried:** Round 14 restarted from round 10's core plus the three
  round-12 directions Opus independently PASSed (`BPL-R12-01`, `BPL-R12-03`,
  `BPL-R12-06`), kept the round-13 absence-declaration reachability
  *decision* in shape without touching its schema, and applied exactly
  entry-3's alternative (a) option (ii) together with (c), as one
  inseparable item (`BPL-R14-01`): a byte-differing duplicate never
  retroactively revokes the first record's provisional acceptance or its
  consumed ordinals; instead the *comparison* (not the record) is marked
  permanently `disputed`, excluded from scoring eligibility but never
  removed from the per-rater ordinal-consuming set. Selected rule 4 step 1
  was rewritten so a repeat `expectedRecordId` is routed through the full
  raw-parsing/semantic-validation pipeline (exactly as a first-time
  submission) before any duplicate-specific decision is made, with the
  byte comparison against the ordinal-consuming record's canonical bytes
  running only after that pipeline succeeds. Items (b), (d), and (e) from
  entry 3's alternative (the absence declaration's `declarationId`/
  succession schema, multi-role absence reason precedence, and bounding the
  declaration surface) were explicitly out of scope and named as deferred,
  not touched.
- **Round:**
  `.kstack/reviews/broader-planning-lenses-2026-08-24-round14/` at design
  digest
  `63b2a763f71658bd99eb5d67ac467e6854b6d9977f2a9027e24f13b2d69a1898`.
- **Confidence effect:** Codex 76 (decision `revise`) and Opus 81 (decision
  `approve`, but with 3 failedChecks, 3 security findings, and 1 genuine
  material dissent of its own) produced combined confidence 76 — 2 points
  below round 10's 78 high-water mark/reject floor, but 42 points above
  round 13's already-rejected 34, and the strongest result of any round
  since round 10. This breaks the three-round regression pattern
  (78 → 66 → 48 → 34 → **76**) even though it does not clear the reject
  floor.
- **Why rejected:** Combined confidence (76) is below the 78 reject floor,
  so per the thread's standing discipline the round is rejected regardless
  of the recovery. The gate was `BLOCKED` with 5 failed checks
  (`design-schema-valid`, `threat-model-complete`,
  `verification-plan-complete`, plus the two derived reviewer-level check
  failures), 4 combined security findings, and 1 genuine material dissent
  (Opus). Unlike rounds 11-13, neither reviewer found the core mechanism
  itself unsound: both independently confirmed (fixtures 7a/7b) that a
  dispute under option (ii) cannot create an ordinal gap, and Opus's own
  `recommendation` was `BPL-R14-01: PASS`. The blocking defects are narrower
  and more mechanical than any prior round's: (1) Codex found revised
  Selected rule 4 item 4's selection record still claims "the complete set
  of 162 `(expectedRecordId, acceptedRecordDigest)` pairs for category (a)"
  — copied forward from round 13 without updating it for this round's
  redefinition of category (a) as the `scorable` subset, which can
  legitimately be fewer than 162 entries whenever category (b) (declared
  absences) is nonempty, making the stated cardinality not implementable
  as written (`BPL-R14-SEC-01`/Codex, high, plus a `design-schema-valid`
  and `verification-plan-complete` failure); (2) Opus found the per-rater
  ordinal invariant's evaluation point is never stated (admission-time vs.
  batch-completion), and that revised item 4's "scorable expectedRecordIds
  ... whose ordinal check passes" treats a global per-`raterId` property as
  if it were a per-record predicate with no stated resolution rule — under
  option (ii)'s never-revoke property this ambiguity is uniquely
  consequential because no reading is ever reversible. Opus separately
  found two new, narrower security findings not present in round 13: the
  `BPL-R13-SEC-01` ordinal-gap class survives *outside* the dispute path,
  when a rater presented a sheet whose submission never became any record's
  ordinal-consuming entry (`BPL-R14-SEC-01`/Opus, medium); and option (ii)'s
  never-revoke property makes a forged-but-valid *first* submission
  permanently unrepairable within a trial version, which round 13's
  revocable design did not share (`BPL-R14-SEC-02`, medium, compounding the
  still-open round-12 `raterId`-authentication residual). Opus's material
  dissent narrows the brief's own security-lane claim that this round
  "closes `BPL-R13-SEC-01` ... by construction" to the dispute path only,
  not the rejection/absence path.
- **Alternative:** Do not edit or extend the round-14 packet. The
  comparison-level-dispute mechanism itself (option ii) is supported: both
  reviewers independently confirmed it cannot create an ordinal gap through
  the dispute path, and it is not rejected on its own terms. Retain
  `BPL-R12-01`/`BPL-R12-03`/`BPL-R12-06` and the round-13
  reachability-decision shape as supported directions. A future
  owner-authorized attempt should isolate exactly the two defects that
  caused this round's specific check failures, and no more:
  - (a) Correct revised Selected rule 4 item 4's selection-record wording so
    it records exactly one `(expectedRecordId, acceptedRecordDigest)` pair
    per currently-`scorable` `expectedRecordId` (i.e., exactly
    `|category (a)|` pairs, not always 162), plus exactly `|category (b)|`
    `(expectedRecordId, reason)` pairs for the declared-absent set, stating
    explicitly that `|category (a)| + |category (b)| = 162` is the
    invariant, not a literal fixed count of 162 digest pairs.
  - (b) State explicitly, in revised Selected rule 4 item 3, that the
    per-rater ordinal invariant is a trial-version-wide, per-`raterId`
    property evaluated fresh every time item 4's eligibility test runs, over
    the complete historical ordinal-consuming set (including disputed and
    declared-absent-but-still-ordinal-consuming records); state explicitly
    that a violation for any one rater blocks the *entire* trial version's
    eligibility (consistent with fixture 7's original "before the batch is
    treated as complete" framing), not a selective per-record exclusion from
    category (a) — and correct item 4's "scorable expectedRecordIds ...
    whose ordinal check passes" wording to match that resolution.
  Explicitly out of scope for that isolated round, to be named as deferred
  rather than silently dropped: `BPL-R14-SEC-01`/Opus (ordinal gap via the
  rejection/absence path when a presented sheet never became
  ordinal-consuming), `BPL-R14-SEC-02` (forged-first-submission permanent
  poisoning, tied to the still-open `raterId`-authentication residual), and
  `BPL-R14-SEC-03` (griefing pressure toward the still-uncapped absence
  declaration surface), plus the six residuals already deferred through
  round 14. **This round's own reject-floor discipline requires flagging,
  per its charter, whether this thread needs a fundamentally simpler
  duplicate-handling model instead of a fifth comparison-preserving attempt:
  given the sharp recovery (34 → 76, the first non-regression since round
  10) and that the two blocking defects are narrow, mechanical, and
  independently well-specified above (not structural unsoundness in the
  mechanism itself, which both reviewers now support), the evidence favors
  one more narrowly-scoped round over abandoning the comparison-preserving
  mechanism** — but this is a recommendation for explicit owner decision,
  not a unilateral continuation. This alternative is unreviewed, carries no
  round-14 confidence, and requires a fresh independent design digest.

### 5. Round-16 owner-approved ordinal overlay with permanent selection close

- **Rejected:** Round 16 added an immutable ordinal correction proposal,
  separate owner approval, historical-inventory snapshot, effective ordinal
  overlay, and an atomic selection record that permanently closed later
  submissions.
- **Evidence:** exact design digest
  `2660d5ad66f57b313ab06fa1bfb91f6b15816b870c957e9b58452ca6f7f0ace1`,
  invocation `307ed223-26cf-4b08-9ffd-f93bea327cfb`. Codex returned `revise`
  at 61 and Opus `revise` at 72; combined confidence 61 regressed 21 points
  below round 15's 82 high-water mark and 17 below the 78 reject floor. Both
  FAILed `BPL-R16-01`. The gate is `BLOCKED` with 6 failed-check counts, 7
  security findings, and 4 material dissents.
- **Why rejected:** the permanent close froze judgment admission but not
  absence declarations even though both change selected category membership;
  create-if-absent was not conditioned on the inventory/category digest or a
  fencing token; crash behavior between create and durable sync was undefined;
  `snapshotArtifactDigest` was undefined; mapping and failure-precedence rules
  conflicted or were absent; approval validation was incomplete; and the
  load-bearing `evidenceDigest` had no canonical schema or machine binding to
  the target and corrected ordinal. Consequently a mechanically valid overlay
  could falsify presentation order to close a separate gap, while a stale
  selector or later absence declaration could contradict immutable selection.
- **Alternative:** abandon the round-16 overlay, owner-approval, and permanent-
  close mechanism rather than patching them. Prevent the bad ordinal from ever
  entering the ordinal-consuming set: create a durable, machine-readable
  presentation receipt before display, bind each judgment role to that exact
  receipt, and require submitted ordinal equality at admission. A mismatch is
  rejected without consuming an ordinal, so a corrected resubmission can become
  the first valid record. Separately, represent every trial-state mutation with
  a monotonic revision/digest compare-and-swap and make selection an immutable
  point-in-time snapshot conditioned on the exact revision/digest, without
  permanently closing later evidence. This alternative is unreviewed and
  receives no round-16 confidence.

### 6. Round-17 pre-display receipts plus point-in-time CAS selection

- **Rejected:** Round 17 replaced the owner correction overlay with durable
  pre-display presentation receipts and replaced locks/permanent close with an
  append-only revision/digest CAS plus point-in-time analysis selection.
- **Evidence:** digest
  `6e5ef835d7aaf006a508c934c1d0215b32280dacf5f4e1e6535bfc6309615829`,
  invocation `b0843f88-a3dc-4d5f-8207-fdd39c2c6fdf`. Codex returned `revise`
  at 66 and Opus `revise` at 68; combined confidence 66 improved five points
  over round 16 but remains below round 15's 82 high-water mark and the 78
  reject floor. Both FAILed both `BPL-R17-01` and `BPL-R17-02`; gate `BLOCKED`
  with 6 failed-check counts, 8 findings, and 5 material dissents.
- **Why rejected:** an immutable receipt issued before display but never
  converted to an ordinal-consuming record creates the same permanent gap and
  total-loss outcome through ordinary render failure, abandonment, or later
  declared absence. Resolver eligibility is not committed/digest-bound; null
  receipt cases and receipt revision/retry semantics are undefined; state and
  snapshot digest preimages are not byte-exact; the intended datastore's atomic
  guarantees are unidentified; and unlimited point-in-time reselection has no
  official-selection/supersession policy, permitting timing/outcome shopping.
- **Alternative:** retain only supported directions as unvalidated evidence:
  system-assign ordinals outside submission data, but give every issued receipt
  exactly one committed terminal disposition so unfilled presentations remain
  explicit without creating an ordinal gap; define all digest preimages and
  resolver prerequisites byte-for-byte; name and verify the datastore primitive;
  and require retained, authorized selection supersession. This alternative is
  not a new round and receives no round-17 confidence.
