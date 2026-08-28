# R2c4 normative addendum: six benchmark bug fixes

- Status: PROPOSED DESIGN-ONLY BUG-FIX ADDENDUM
- Date: 2026-08-27
- Amends: `token-reduction-security-benchmark-2026-08-27-r2c3-boundary-statistics-addendum.md`
- R2c3 SHA-256: `6d4c126d9273ee68b5cf3ddd5288d07ea76cee2019000f1de1b1c7b4161b9673`
- Scope: six exact residual findings only; no redesign
- Authority: no implementation, activation, external review, commit, or push

R2c1→R2c3 remain normative except for the six explicit replacements below.

## 1. All four arms discover; only A versus B3 scores

The benchmark retains A, B1, B2, and B3. For every exact-cache
`QualityCohortV2`, volatile discovery and semantic union must receive:

- each arm's shared terminal response;
- every admitted intermediate, retry, fallback, recovery, and failed-call output;
- frozen hidden-gold and deterministic findings; and
- fresh open-discovery/reviewer findings.

All arm/provenance signals are randomized/masked before discovery. A candidate
found only by B1 or B2 remains in the common semantic union and is presented
against A and B3 after existence/severity seal. Missing/unadmitted output from
any of the four configured arms fails cohort completeness; it is not silently
removed to make a smaller union.

Existence is judged against the shared task artifact/objective, not the response
that surfaced the candidate. A mistake introduced only inside a B1/B2 response
is retained as an arm-specific diagnostic but is not a real A/B3 defect
opportunity unless the same violated requirement applies to the shared target.

Only A and B3 shared terminal responses receive confirmatory `D/R` scores,
paired-risk differences, token savings, and activation claims. B1/B2 are
explicitly **discovery-only decomposition arms**: their product calls stay in
their own complete task-arm ledgers, their tokens/results are reported
separately, and they never enter A/B3 numerator, denominator, quality score, or
claim. Meta-discovery/adjudication calls remain shared measurement overhead.

The claim states this arm contract. It cannot call B1/B2 “unmeasured” or imply
that their findings were excluded from defect opportunity construction.

## 2. Sealed defect-bearing populations and exact weights

For exact cache `c`, class `k`, and window `w`, let `D_(c,k,w)` be the set of
tasks containing at least one final sealed real defect after all-arm discovery,
fixed-point closure, and existence/severity adjudication. Before revealing the
A/B3 mapping or calculating any arm score, seal
`DefectBearingPopulationLedgerV1` containing:

- configuration/corpus/sampling-frame, cache, class, window, cohort, gold,
  discovery, fixed-point, and existence/severity ledger digests;
- every eligible task digest and immutable class assignment;
- each task's D/Z disposition, sealed defect IDs/severities, and inclusion reason;
- exact `|D_(c,k,w)|`, required minimum, class weight, and task weights;
- all exclusions with a closed pre-randomization reason; and
- independent recomputation/equality evidence.

Within-class defect-bearing estimands weight each task exactly
`1 / |D_(c,k,w)|`. An overall defect-bearing estimand prospectively defines the
eligible D-required classes and positive rational `alpha_k` summing to one over
those classes; each task in class `k` then has exact weight
`alpha_k / |D_(c,k,w)|`. Sample allocation, number of defects, response length,
and discovered arm do not alter weight.

For a three-window pooled D estimand, create a separate sealed `D_(c,k,pool)`:
a task enters when it has at least one sealed real defect in any window. Compute
its task-level miss fractions over all its sealed defects across those windows,
then weight it `1/|D_(c,k,pool)|` or `alpha_k/|D_(c,k,pool)|`. Window-specific
and pooled ledgers never substitute for one another.

Zero/under-minimum required D sets, a weight sum other than one, post-score
membership/weight mutation, class movement, ledger/recomputation mismatch, or
unbound task population fails that cell. No bootstrap/allocation weighting may
replace these exact confirmatory weights.

### 2.1 Conditional scope and coverage ledger

The D quality estimand is explicitly conditional:

`RD_D/R | task is in the final sealed D population produced by this exact
gold + all-arm discovery + semantic adjudication procedure`.

It does not estimate unconditional sensitivity over all tasks, latent defects,
defects outside admitted gold/discovery coverage, another reviewer class, or a
different cache/configuration. Z means “no real defect was found by the scoped
procedure,” not proof that no defect exists.

Open discovery runs before hidden verified gold is revealed. Then
`GoldDiscoveryCoverageLedgerV1` binds every admitted gold truth by task/class/
severity and records whether open discovery independently recovered its semantic
identity, which arm/reviewer first exposed it under masked provenance, and its
final existence/severity disposition. Gold is then forcibly unioned so a miss
cannot disappear from A/B3 scoring.

Qualification requires:

- zero unrecovered critical/high gold truths in every class×window×cache cell;
- the prospectively frozen exact task-level CP recovery floor
  `q_gold>=19/20` for medium/low gold, with a powered minimum; and
- existence/severity agreement with the independently verified gold truth, or
  an explicit adjudication-calibration failure rather than gold relabeling.

For the medium/low task-level floor, `GoldRecoveryPass=1` only when open
discovery recovered every hidden applicable medium/low gold truth in that task;
tasks with no such gold are outside that denominator. Defect count never gives
one task extra weight.

The coverage ledger reports hidden-gold task count, defect count, recovery by
severity/class/arm source, confidence bound, and corpus construction limits.
Even complete gold recovery proves only recovery of the finite seeded truth set.
The human claim repeats this conditional scope and cannot use “all defects,”
“defect-free,” or equivalent completeness language.

## 3. Exact rational inversion for the primary savings interval

`BoundedSavingsIntervalV1` inverts `BoundedTaskCluster95V1` for each primary
savings gate. With fixed task weights, define exact rationals:

`a = sum_i(w_i*Abar_i) > 0`

`b = sum_i(w_i*Bbar_i)`

`mu(s) = b - (1-s)*a`

`V(s) = sum_i[w_i^2 * (Bmax_i + (1-s)*Amax_i)^2]`

`F(s) = 2*mu(s)^2 - C_.025*V(s)`.

All coefficients are signed reduced BigInt rationals; `F` is at most quadratic.
Freeze positive weighted control minimum `Amin` and treatment maximum `Bmax` and
the finite domain:

`S_domain = [1 - Bmax/Amin, 1]`.

Missing/nonpositive `Amin`, unbounded maximum, degree above two, or coefficient/
domain overflow fails inversion and qualification.

### 3.1 Dependency-free inversion algorithm

The non-rejected two-sided-95 savings confidence set is:

`C_S = {s in S_domain : F(s) <= 0}`.

At the true `S`, `E[mu(S)]=0`, so the bounded-cluster coverage event places the
true value in `C_S`. The reported interval is the closed convex hull of `C_S`;
the hull may be wider than a disconnected set but cannot lose coverage.

The independent verifier:

1. clears only positive denominators to a canonical primitive integer
   polynomial `(f2*s^2 + f1*s + f0)`;
2. handles degree 0/1 explicitly and computes the quadratic discriminant with
   BigInt, including negative, zero/double-root, and perfect-square cases;
3. isolates every real root in `S_domain` using exact sign evaluation and
   rational bisection until its interval width is below `1/10^12`; no float or
   library root is accepted;
4. partitions the complete domain at endpoints/root isolators and evaluates
   `F<=0` on an exact rational interior point plus every exact rational root;
5. unions all accepted pieces, fails `CONFIDENCE_SET_EMPTY` if none, and takes
   their hull; and
6. rounds the hull lower endpoint toward negative infinity and upper endpoint
   toward positive infinity to the `10^12` rational grid. Root isolators must
   prove the outward grid cell; ambiguity triggers further bisection or failure.

This output is an exact rational outward enclosure, not a floating estimate.
The point estimate is separately `S_hat=1-b/a` as a reduced rational.

For threshold `s0`, also persist:

`mu0 = mu(s0)`

`thresholdMargin = 2*mu0^2 - C_.025*V(s0)`.

The direct activation predicate is `mu0<0 && thresholdMargin>0`. The primary
interval gate additionally requires its outward lower endpoint strictly greater
than `3/20`; per-class non-regression requires strictly greater than zero. Both
the interval and direct predicate must pass. Equality, empty/full-domain set,
ambiguous root, outward rounding onto/below threshold, or verifier disagreement
fails rather than reverting to a point estimate.

Generate this interval for every cache/window/class/pooled savings gate. Pooled
intervals remain noncurative. The human claim prints exact `S_hat`, rational
interval endpoints, `mu0`, `thresholdMargin`, bounds/domain, and inversion
implementation/test-vector digest.

## 4. Qualified adversarial semantic discriminator

The forced-guess equivalence gate is valid only after the exact reviewer class
passes `SemanticDiscriminatorQualificationV1` on an independently admitted,
labeled control corpus disjoint from nuisance probes, confirmatory tasks, gold,
and reviewer examples.

For each actual reviewer class exposed to blinded response semantics, freeze its
model/provider/revision, reasoning, base system/developer prompt, rubric/persona,
tools, response schema, host/adapter, and human qualification where applicable.
Derive a class-specific diagnostic wrapper by replacing only the adjudication
question with the canonical forced-guess question; bind both base and overlay
digests. Then freeze:

- negative controls whose A/B3 labels are balanced but which contain no arm
  signal after the production blinding transform;
- positive controls for each leakage class: explicit arm name; packet/slice
  vocabulary; omission/full-context statement; filename/citation/provenance;
  length/format/order; wrapper/error/cache/fallback signal; and adversarially
  paraphrased semantic disclosure; and
- exact generator/source, truth-label, transform, allocation, class minimum,
  evaluator-session, and CP-analysis digests.

Negative controls must pass the R2c3 exact two-sided CP equivalence interval
strictly inside `1/2 ± epsilon`, with `epsilon<=1/20`. Within every positive
leakage class, `LeakageDetected=1` only for a correct forced A/B3 guess; its
exact one-sided 95% CP lower bound must strictly exceed frozen
`q_leak>=19/20`. Leakage classes cannot pool, and all-success N cannot be below
59 at `.95` (or 299 when `.99` is selected).

Control evaluators use fresh isolated sessions. Qualification sessions never
review confirmatory material. Actual forced-guess evaluators use the same
class-specific diagnostic wrapper. Every discovery/dedupe/existence/severity/
detection/resolution reviewer must match the wrapper's bound base-reviewer
class; the canonical forced-guess overlay is the sole permitted prompt
difference. A weaker/different model, base prompt, reasoning, tool set, host
adapter, overlay, or human training does not inherit discriminator evidence.

Failure to prove negative equivalence or reliably detect any positive leakage
means the discriminator is unqualified; apparent `.5` guessing on confirmatory
views then cannot establish blinding. Control-corpus overlap, truth-label leak,
session reuse, generator drift, evidence expiry, or reviewer-class change
requires full requalification. Only closed outcomes/evidence digests persist;
raw controls and guesses follow the volatile destruction boundary.

## 5. Exact claim-field precedence

This section has explicit precedence over:

- R2c2 section 4.3 percentile-bootstrap CI as an activation interval;
- R2c2 section 7 claim requirements wherever “two-sided 95% percentile CI” is
  presented as the primary savings confidence field; and
- any older schema/renderer that can place a percentile interval in a primary,
  verdict, threshold, or qualification field.

R2c3 section 6 remains controlling for bootstrap sensitivity behavior.

`TokenReductionClaimV2.primarySavings` contains only:

- `method: BoundedTaskCluster95V1`;
- exact rational `pointEstimate`, `intervalLower`, and `intervalUpper` from
  `BoundedSavingsIntervalV1`;
- exact `S_domain`, task/class weights, `C_.025`, polynomial/inversion digest;
- exact threshold, `mu0`, `thresholdMargin`, direct/interval pass booleans; and
- cache/window/class/pooled scope plus noncurative cell disposition.

`TokenReductionClaimV2.sensitivity.percentileBootstrap` is a separate nullable
object whose mandatory label is `SENSITIVITY_NOT_ACTIVATION`. It may contain
R2c2's point/percentile interval, replicate status, and disagreement, but no
pass, qualified, activation, primary, or threshold-authority field.

The canonical parser rejects legacy `primary.twoSided95PercentileCI`, an
unlabeled bootstrap interval, duplicated/mismatched interval, primary/sensitivity
field aliasing, or renderer text that cites percentile bootstrap as evidence of
passing. The human report renders the bounded-cluster point/interval/margin
first and the sensitivity in a visually separate non-authoritative paragraph.
Machine/human field equality is mandatory.

## 6. Deterministic acceptance and tradeoffs

Required independent tests:

1. A defect appearing only in B1 or B2 enters the sealed union and A/B3 scoring,
   while B1/B2 tokens/scores remain absent from primary arithmetic. Missing any
   discovery arm fails cohort completeness.
2. With two D classes, `alpha_1=1/4`, `|D_1|=2`, `alpha_2=3/4`, and `|D_2|=3`,
   task weights are `1/8,1/8,1/4,1/4,1/4` and sum exactly one. Mutation of one
   membership, class, defect, alpha, or ledger digest rejects.
3. Hidden gold found only after reveal counts as an open-discovery miss but is
   forcibly unioned for scoring. One missed critical/high gold fails its cell.
4. Polynomial inversion vectors cover constant/linear/quadratic, negative/zero/
   positive discriminant, exact/double root, root at domain/threshold/grid,
   disconnected `F<=0` pieces and conservative hull, empty set, and verifier
   disagreement. Canonical examples include `F=s^2-1/4` on `[-1,1]` producing
   `[-1/2,1/2]`, and `F=1/4-s^2` producing disconnected pieces whose required
   hull is `[-1,1]`.
5. A direct threshold margin of zero, interval lower endpoint equal to `3/20`,
   or outward grid cell crossing the boundary fails despite a favorable rounded
   point estimate/bootstrap.
6. Every negative discriminator class must prove `.5±epsilon` equivalence and
   every positive leakage class its exact CP floor. A discriminator that always
   guesses randomly fails positive controls and cannot validate blinding.
7. Each exact reviewer-class mutation invalidates its discriminator proof;
   disjointness/source overlap and truth-label leakage negatives fail closed.
8. Claim parsers/renderers reject every legacy/aliased primary percentile field
   and prove bootstrap success/failure leaves primary bytes and verdict unchanged.

Accepted conservative tradeoffs:

- Keeping B1/B2 increases provider/adjudication cost and may enlarge D, but
  prevents an unscored arm from hiding a defect relevant to A/B3 comparison.
- The D estimand is conditional and cannot claim latent-defect completeness;
  hidden gold measures only finite seeded coverage.
- Taking the hull of a disconnected inverted confidence set and outward rational
  rounding can materially widen the primary interval.
- A capable adversarial discriminator and per-reviewer-class control corpus can
  dominate sample/cost requirements. Infeasibility uses R2c3 finite-corpus scope,
  never a weakened blinding claim.

## 7. Self-assessment and remaining work

Open implementation/qualification work:

1. Extend volatile cohorts/all-call ledgers to all four arms while preserving
   A/B3-only scoring and token arithmetic.
2. Implement/recompute/seal D population and hidden-gold coverage ledgers before
   arm unmasking.
3. Implement and independently verify exact polynomial confidence-set inversion,
   root isolation, hull, outward grid, and claim rendering.
4. Build disjoint adversarial semantic controls and qualify every exact reviewer
   class against negative equivalence and positive leakage.
5. Replace legacy claim schemas/renderers and prove primary/sensitivity field
   separation end to end.
6. Re-run all exact cache/window/class/pooled qualification cells after every
   preceding provider/security prerequisite closes.

- Design-readiness self-score for the six R2c4 fixes: **97/100**.
- Independent reviewer score for this addendum: **not run**.
- Known unresolved design defects within the six-item scope: **zero identified**.
- Open implementation/qualification items: **six, listed above**.

This addendum changes no runtime. It does not establish measured savings,
provider qualification, activation, cost reduction, production/private-data
coverage, or credential-repository safety.
