# R2c3 normative addendum: boundary-valid statistical qualification

- Status: PROPOSED DESIGN-ONLY ADDENDUM
- Date: 2026-08-27
- Amends: `token-reduction-security-benchmark-2026-08-27-r2c2-statistical-isolation-claim-addendum.md`
- R2c2 SHA-256: `55caa4521dd202a732612dad6364629818b10b665e1b792c8c245172055a5eac`
- Advisory: fresh independent Codex statistical advisory, applied in full below
- Scope: all nine residual statistical/adjudication findings from R2c2 review
- Authority: no implementation, activation, external review, commit, or push

R2c1 and R2c2 remain normative except where this addendum explicitly replaces
their bootstrap activation, cohort key, interim re-estimation, confidence-tail,
or zero-defect rules. Provider/security, receipt, all-call, isolation,
requalification, and claim constraints remain unchanged or are strengthened.

## 1. Decision and strict hypotheses

Activation uses dependency-free finite-sample methods whose validity includes
parameter boundaries:

- savings and paired quality use `BoundedTaskCluster95V1`, a two-sided 95%
  Hoeffding bound evaluated with BigInt rational arithmetic and no square root;
- binary absolute floors use exact task-level binomial Clopper–Pearson bounds;
- percentile task-cluster bootstrap remains a labeled sensitivity analysis only;
  no bootstrap point, percentile, or invalid-draw behavior can activate, cure,
  or invalidate the primary confidence gates.

The confirmatory nulls include their boundary and are rejected only strictly:

- overall/window savings: `H0: S <= 3/20` versus `H1: S > 3/20`;
- per-class savings non-regression: `H0: S_k <= 0` versus `H1: S_k > 0`;
- detection/resolution noninferiority: `H0: RD >= 1/50` versus
  `H1: RD < 1/50`; and
- absolute quality floor: `H0: p <= q` versus `H1: p > q`, where frozen
  `q` is at least `19/20` or `99/100` as required by R2c1.

Equality of a point estimate, confidence endpoint, or exact p-value to its
threshold fails. “At least 15%” in prior prose therefore means the two-sided-95
lower confidence bound is **strictly greater** than `3/20`; “no regression”
means strictly greater than zero; NI means the upper two-sided-95 bound is
strictly less than `1/50`; and floors require a strict lower-bound excess.

## 2. `BoundedTaskCluster95V1`

### 2.1 Independent unit and exact bound

The independent unit is one immutable task. All three windows, both paired
arms, calls/fallbacks/failures, and the one exact cache configuration being
qualified remain inside that task cluster. No call, defect, window, or arm is
treated as an independent observation.

For independent task-cluster values `X_i` with frozen rational bounds
`L_i <= X_i <= U_i`, assign positive rational weights `w_i` summing exactly to
one. Define:

`mu_hat = sum_i(w_i * X_i)`

`V = sum_i(w_i^2 * (U_i - L_i)^2)`

and the conservative constant:

`C_.025 = 3688879455 / 1000000000 > ln(40)`.

The two-sided 95% half-width is conceptually `sqrt(C_.025 * V / 2)`, but runtime
qualification never evaluates a floating square root. To prove an upper bound
is strictly below rational boundary `h`, require both:

`mu_hat < h`

`2 * (h - mu_hat)^2 > C_.025 * V`.

To prove a lower bound is strictly above `h`, require both:

`mu_hat > h`

`2 * (mu_hat - h)^2 > C_.025 * V`.

All values are reduced signed BigInt rationals. Comparison cross-multiplies
positive denominators with checked BigInt operations. There is no float,
epsilon, normal/t approximation, estimated variance, studentization, or
distributional dependency. Unknown/nonfinite/unbounded input or zero total
weight fails qualification.

Human output prints the symbolic two-sided interval
`mu_hat ± sqrt(C_.025*V/2)` with exact rational `mu_hat` and radicand. A
dependency-free BigInt ceiling-square-root routine also prints an outward
decimal enclosure; rounding can only widen it. Activation authority remains the
strict squared rational predicate, never the displayed decimal.

Superpopulation use additionally requires probability-sampled independent tasks
from a frozen admissible sampling frame/generator. Purposively selected tasks,
unproven representativeness, or shared generation/failure state receives only
the finite-corpus scope in section 8.

### 2.2 Savings and quality cluster variables

For savings threshold `s`, each task cluster contributes:

`X_i(s) = Bbar_i - (1 - s) * Abar_i`.

`Abar_i/Bbar_i` contain all product calls for the selected window, or the equal
mean of all three windows for a pooled gate. They include cache preparation,
fallback, retry, recovery, and failure exactly as R2c1 requires. Qualification
has no missing receipt; diagnostic bounds cannot activate.

Because `S > s` is equivalent to `E[X_i(s)] < 0` for positive control input,
apply the section 2.1 **upper-bound-below** predicate with `h=0`. Use
`s=3/20` for each-window and pooled savings and `s=0` for class non-regression.
Per-task bounds are derived before execution from the authenticated maximum arm
call graph:

`L_i(s) = -(1-s) * Amax_i`

`U_i(s) = Bmax_i`.

An unbounded call graph or changed maximum fails configuration admission.

For defect-bearing quality, each task contributes separately for detection and
resolution:

`X_i^D = M_D(B3,i) - M_D(A,i)`

`X_i^R = M_R(B3,i) - M_R(A,i)`,

each bounded in `[-1,1]`. Apply the upper-bound-below predicate with `h=1/50`.
These are two-sided-95 NI bounds; R2c2's one-sided quality CI is superseded.

Per-window quality uses that window's sealed defect set. For a three-window
pooled defect-bearing gate, each task first combines all sealed defects from its
defect-bearing windows, computes one total miss fraction per arm, then forms one
paired `X_i`; a task with no defect in any window belongs only to the pooled
zero-defect floor. Each task still has one bounded contribution in `[-1,1]`.
Class×window gates retain every window-specific result, so this pooled
construction cannot erase a zero-defect outcome or cure a failed window.

Within one class, tasks have weight `1/N_k`. For an overall gate, task `i` in
class `k` has `w_i=alpha_k/N_k`; allocation does not change frozen class weight.
Every weighted rational and its squared range term is independently recomputed.

### 2.3 Noncurative confidence gate matrix

Each exact cache configuration qualifies separately. It must pass all of these
two-sided-95 strict gates:

1. each window's overall savings exceeds `3/20`;
2. every class×window savings exceeds zero;
3. every defect-bearing class×window has `RD_D < 1/50` and `RD_R < 1/50`;
4. the three-window pooled overall savings exceeds `3/20`;
5. every class's three-window pooled savings exceeds zero;
6. every pooled defect-bearing class has `RD_D < 1/50` and `RD_R < 1/50`; and
7. each applicable exact task-level absolute floor in section 3 passes.

Pooled success is additive evidence only and cannot cure any failed cache,
window, class×window, endpoint, severity, or floor. Cold cannot cure warm; warm
cannot cure cold. Cross-cache results remain diagnostics without an activation
claim. A confidence gate with too few task clusters fails as underpowered rather
than falling back to a point estimate or bootstrap.

This is an intersection-union activation test: the global null is that at least
one required cell null is true, and activation rejects only when every required
cell strictly rejects at its two-sided-95 gate. Pooled gates add constraints but
do not replace cells; no favorable multiplicity or post hoc alpha allocation is
used.

## 3. Exact binomial floors and mixed quality cells

### 3.1 Dependency-free Clopper–Pearson gate

Absolute floors use one binary outcome per independent task. For `x` successes
among `n`, the exact one-sided 95% Clopper–Pearson lower bound exceeds frozen
rational `q` only when the exact binomial upper tail is strictly below `1/20`:

`sum_(j=x..n) choose(n,j) * q^j * (1-q)^(n-j) < 1/20`.

Evaluate the inequality by BigInt rational exponentiation, binomial coefficients,
addition, and cross-multiplication. Equality fails. No beta library, float,
Wald/Wilson approximation, continuity correction, or mid-p is allowed. A human
display bound may use rational root isolation, but the tail comparison is the
activation authority.

For all-success samples the gate reduces to `q^n < 1/20`. Therefore:

- at `q=19/20`, `n=58` fails and `n=59` passes; and
- at `q=99/100`, `n=298` fails and `n=299` passes.

These are minimum all-success counts, not universal planned N. Any observed
failure can require a larger prospectively supported N; result-driven top-up is
forbidden.

Critical/high `ABSOLUTE_CH_FLOOR` uses task success only if the task detects or
resolves, respectively, **every** sealed critical/high defect. Zero-defect
`TaskOutcomePass` is one only if all frozen deterministic outcomes pass with no
false approval, new material defect, or security finding. Detection and
resolution floors are evaluated separately.

### 3.2 Defect-bearing, zero-defect, and mixed cells

For each class×window×exact-cache cell, partition tasks after final sealed
existence/severity labels into defect-bearing `D` and zero-defect `Z`. The
analysis plan prospectively declares the cell as `D_REQUIRED`, `Z_REQUIRED`, or
`MIXED_REQUIRED` and freezes exact minima `N_D_min/N_Z_min`:

- `D_REQUIRED`: `|D| >= N_D_min`; apply bounded-cluster `RD_D/RD_R` NI. Report
  that zero-defect outcome quality was not estimated.
- `Z_REQUIRED`: `|Z| >= N_Z_min`; apply exact `TaskOutcomePass` floors. Report
  that defect sensitivity was not estimated.
- `MIXED_REQUIRED`: both minima hold and both the defect-bearing NI gates and
  zero-defect exact floors pass independently.

`N_D_min` comes from the sealed distribution-free precision/power calculation.
`N_Z_min` cannot be below the applicable exact CP minimum (59 for all-success
`.95`; 299 for all-success `.99`) and may be larger. A realized partition below
its minimum fails; tasks cannot be relabeled, moved across classes/windows, or
supplemented after results.

For transparent description only, a mixed cell may report:

`Q_E^R(a) = (|D|/N)*mean_(i in D)[1-M_R(a,i)] +
            (|Z|/N)*mean_(i in Z)[TaskOutcomePass(a,i)]`

and analogously `Q_E^D`. This is a diagnostic expected task-quality mixture at
the observed fixed corpus composition. `Q_E` has no activation threshold and
cannot combine away a failed RD or floor.

## 4. `QualityCohortV2` and semantic blinding equivalence

### 4.1 Exact-cache cohort key

`QualityCohortV2` is keyed by exactly:

`(taskDigest, windowID, exactCacheConfigurationDigest)`.

The cache digest binds cold/warm mode, arm-specific prefix bytes/digests,
namespace/control/retention, preparation path, provider/model/envelope, and host
evidence. A cohort contains A/B3 outputs and product-call discovery material
only for that exact cache configuration. R2c1's cross-cache cohort is superseded.

Open discovery, semantic union/dedupe, fresh randomized two-reviewer
existence/severity and detection/resolution passes, bounded fixed point, label
seal, raw destruction, no cross-window rescoring, and all-call ledger rules
otherwise remain unchanged. Candidate prose, labels, semantic keys, and reviewer
state cannot cross cache configurations. Each configuration can discover a
different sealed defect set and must meet its own minima and gates.

### 4.2 Forced-guess equivalence gate

Before quality labels can qualify, prove that the actual semantic blinding view
does not reveal A versus B3 beyond frozen equivalence margin `epsilon <= 1/20`.
For every class×window×exact-cache cell:

1. precommit a balanced seed selection giving each task exactly one A or B3
   view, with equal true-label allocation up to one;
2. send each view to a fresh isolated evaluator that sees no paired view, task
   neighbor, prior session, arm token/format/provenance signal, or label;
3. require one forced `A`/`B3` guess; no abstention or prose persists; and
4. compute the exact two-sided 95% Clopper–Pearson interval for correct-guess
   probability `p_guess`.

The gate passes only when its lower endpoint is strictly greater than
`1/2-epsilon` **and** its upper endpoint is strictly less than
`1/2+epsilon`. Implement this without beta/float by requiring the exact upper
tail at `1/2-epsilon` and lower tail at `1/2+epsilon` each be strictly below
`1/40`. Equality, too few independent tasks, evaluator failure, duplicate
session, or unavailable raw-destruction proof fails the cell.

Forced-guess calls and exact outcomes are recorded in the shared adjudication
ledger and excluded from arm savings. The gate establishes bounded empirical
arm indistinguishability for the tested views only; it does not prove reviewer
objectivity or semantic identity outside the exact corpus/cache configuration.

## 5. Disjoint nuisance SSR and pre-confirmatory N seal

R2c2's interim re-estimation from confirmatory observations is superseded.
Create an independently admitted `NuisanceSSRProbeSetV1` whose task/source/
objective/artifact/dependency/gold IDs and semantic content are disjoint from
the confirmatory corpus. A checked disjointness manifest and two independent
reviewers must agree before any probe dispatch. Probe tasks can never later
become confirmatory tasks.

The probe runner uses the exact intended provider/host/cache configuration, but
a protected shuffler removes arm, order, and directional outcome before the
sizing program. The program may receive only:

- pooled bounded token-range occupancy and task-size distribution;
- pooled fallback/retry/failure/cache-hit/nondispatch event counts;
- pooled defect-bearing/zero-defect and severity counts; and
- host/provider operational attrition needed for complete allocation blocks.

It cannot receive an arm difference, savings/quality point or CI, pass/fail,
response text, task match to confirmatory content, or statistic that reconstructs
direction. Probe outputs are excluded from every qualification estimator and
claim; their all-call cost is separately reported.

The primary distribution-free N floor is computed without probe variance. It
is the smallest complete class/crossover block for which the exact
`BoundedTaskCluster95V1` predicate has the frozen design-alternative margin and
all CP/equivalence/minimum-cell requirements can pass. Probe nuisance results
may increase that floor under one sealed sizing formula, never reduce it or
change a hypothesis, range, margin, confidence level, endpoint, class, weight,
window, or maximum N.

R2c2's frozen 90% power and precision-assurance requirements remain planning
constraints, but their simulation must use the R2c3 primary predicates and
strict boundaries, not percentile-bootstrap activation. Simulation cannot
validate a result; final planned N is the componentwise maximum of the
distribution-free floor, powered/precision-assurance N, CP/equivalence minima,
and complete allocation blocks.

For an equal-weight gate with common range `R` and frozen alternative distance
`d_alt>0`, the strict minimum is

`N_bound = floor(C_.025 * R^2 / (2*d_alt^2)) + 1`.

For unequal ranges/class weights, enumerate complete allocation blocks with
exact rationals until `2*d_alt^2 > C_.025*V`; the first passing block is the
minimum. CP and semantic-equivalence N are found by exact integer tail
enumeration. Final N remains subject to frozen `N_max`.

`FinalNDecisionV2` binds probe/disjointness digests, permitted nuisance values,
formula/test-vector digest, proposed and realized N by class, exact allocation,
`N_max`, and one terminal decision. It is sealed before **any** confirmatory
task, arm, cache preparation, output, or label exists. Raw probe material is
then destroyed. There is no confirmatory interim look, re-estimation, top-up,
replacement, optional stop, or extra window.

### 5.1 Planned N is not requalification

Realizing final N through the already sealed probe rule before the first
confirmatory dispatch is a planned configuration-construction step, not a
requalification event. The resulting N and `FinalNDecisionV2` digest become
fields of the exact confirmatory configuration.

After that seal—or after any prior claim exists—any N/allocation change,
additional task, substituted task, or use of a different probe/formula is a new
configuration. It invalidates inherited evidence and requires a new disjoint
probe decision plus all confirmatory tasks/arms in three fresh windows. Being
within an old `N_max` does not authorize a post-seal change.

## 6. Percentile bootstrap sensitivity only

R2c2's deterministic 10,000 shared task-cluster percentile bootstrap may run
after primary labels seal, using the same weights and no discarded/redrawn
replicates. It is labeled `SENSITIVITY_NOT_ACTIVATION`.

Its interval, disagreement, invalid draw, or inability to compute cannot pass,
fail, cure, widen, narrow, or reinterpret any `BoundedTaskCluster95V1` or exact
CP gate. An invalid draw makes only the sensitivity result `UNAVAILABLE`. The
claim prints the sensitivity result next to—not in place of—the finite-sample
primary bound and explains material disagreement without selecting the more
favorable method.

## 7. Deterministic conformance vectors

Two independent implementations must reproduce these vectors using BigInt
rationals only:

1. **Constant:** accept exactly
   `C_.025=3688879455/1000000000`; mutation by one numerator unit changes the
   configuration digest. Its upward rounding from `ln(40)` is conservative.
2. **Bounded-cluster boundary:** with equal weights, every `X_i=-1`,
   `L_i=-1`, `U_i=1`, and `h=0`, `n=7` fails because
   `2 <= C_.025*(4/7)`; `n=8` passes because
   `2 > C_.025*(1/2)`. With `mu_hat=h`, fail before squaring.
3. **Strict savings null:** an exact confidence endpoint of `3/20` fails;
   changing only the proved lower endpoint to the next greater representable
   rational passes that comparison but still must pass every other cell.
4. **Strict NI null:** an exact upper endpoint of `1/50` fails; no rounding to
   `0.020000` can change the result.
5. **CP `.95` floor:** verify `20*19^58 >= 20^58` (fail) and
   `20*19^59 < 20^59` (pass).
6. **CP `.99` floor:** verify `20*99^298 >= 100^298` (fail) and
   `20*99^299 < 100^299` (pass).
7. **Semantic equivalence:** for `epsilon=1/20`, `n=1000`, and 500 correct
   forced guesses, both exact `1/40` tail tests pass; `n=100`, 50 correct fails
   both precision sides. Implementations compare exact binomial sums, not the
   approximate probabilities.
8. **Mixed diagnostic:** for two defect-bearing task resolution successes
   `[1,1/2]` and two zero-defect outcomes `[1,0]`, `Q_E^R=5/8`; changing this
   diagnostic cannot cure either partition's gate.
9. **Sensitivity separation:** a deliberately invalid percentile-bootstrap
   draw yields `SENSITIVITY_UNAVAILABLE` while identical primary BigInt/CP gate
   outputs remain byte-for-byte unchanged.

Every vector binds canonical input/output bytes, terminal code, and arithmetic
intermediate digest. A float-only implementation, unequal reduction, hidden
epsilon, or library-version-dependent answer is nonconformant.

## 8. Conservative tradeoff and finite-corpus fallback

The bounded-cluster method is distribution-free but can demand far more tasks
than a percentile bootstrap because it uses frozen ranges rather than estimated
variance. Exact CP floors are also conservative, and the forced-guess
equivalence gate may dominate N. This cost is accepted: the design prefers a
valid boundary claim to a narrower assumption-dependent interval.

Task independence remains a prerequisite. All windows/arms stay within task;
tasks sharing source generation, mutable state, or a common failure unit must be
pre-grouped into one bounded super-cluster before planning. If independence or
a finite bound cannot be evidenced, no superpopulation qualification is valid.

If required N or a partition/equivalence minimum exceeds the complete admitted
finite corpus or `N_max`, do not weaken the bound, margin, confidence, class,
or cell. Enter `FINITE_CORPUS_SCOPE_REQUIRED` and choose prospectively:

- **Exact deterministic census:** only when effective provider determinism and
  the complete claim population are both qualified. Run every immutable task
  in all arms and three windows. Report exact census savings/quality for those
  task digests only, without a sampling CI or generalization. Activation, if
  separately approved, is allowlisted to those exact task/configuration digests.
- **Descriptive census:** when provider determinism or complete-population status
  is unproven. Run/report all available tasks as descriptive evidence only;
  packet slicing remains unqualified/default-off and novel tasks use admitted
  full context.

Both forms preserve receipt/security/quality gates, publish unavailable minima,
state that synthetic/public tasks are not production evidence, and forbid
“95% qualified,” general KStack savings, cost, or cross-provider claims. Census
tasks cannot later seed a superpopulation confirmatory campaign.

## 9. Required deterministic and adversarial evidence

- Reproduce all section 7 vectors in two independently written, dependency-free
  BigInt implementations and reject any byte/intermediate mismatch.
- Mutate task weights/ranges/caps, constant, strict comparator, hypothesis,
  endpoint, cache digest, or cluster membership and prove the configuration or
  gate fails before a claim.
- Generate correlated call/window/defect fixtures inside one task and prove they
  remain one cluster; shared-state tasks without a declared super-cluster fail.
- Exercise every cache×window/class×window/pooled gate individually and prove a
  pooled pass cannot change any failing cell disposition.
- Test defect-only, zero-only, mixed, below-minimum, misclassified, and
  critical/high task partitions; `Q_E` mutation never changes activation.
- Prove `QualityCohortV2` cannot import candidates, labels, reviewer sessions,
  or semantic keys across one-byte-different exact cache configurations.
- Forced-guess fixtures cover exact balance, odd N, duplicate evaluator/session,
  abstention, missing guess, tail equality, both CP margins, insufficient N,
  seal, and volatile destruction.
- Prove nuisance/confirmatory DAG and semantic disjointness; leak one arm,
  direction, task, label, or pass/fail into sizing and reject the campaign.
- Seal final N before a confirmatory pre-spawn event; reject every post-seal
  change/top-up/replacement and distinguish the planned pre-seal N realization
  from a later full-requalification trigger.
- Make the primary result immutable under percentile sensitivity success,
  disagreement, invalid draw, absence, or implementation drift.
- Force required N above finite availability and prove only the selected exact
  or descriptive census claim is renderable, with no superpopulation language.

## 10. Statistical basis and self-assessment

Primary statistical sources applied by the fresh advisory:

- W. Hoeffding, “Probability Inequalities for Sums of Bounded Random
  Variables,” *JASA* 58(301), 1963,
  <https://doi.org/10.1080/01621459.1963.10500830>.
- C. J. Clopper and E. S. Pearson, “The Use of Confidence or Fiducial Limits
  Illustrated in the Case of the Binomial,” *Biometrika* 26(4), 1934,
  <https://doi.org/10.1093/biomet/26.4.404>.

Open implementation/qualification work:

1. Implement and independently verify BigInt rational bounded-cluster and exact
   binomial engines against every conformance/adversarial vector.
2. Build/qualify exact-cache `QualityCohortV2`, forced-guess blinding, and raw
   destruction on every supported route/host.
3. Construct, admit, and prove disjoint the nuisance probe and confirmatory
   corpora; seal final N before any confirmatory dispatch.
4. Establish task independence/super-clusters and finite call/quality bounds for
   every class/cache/window gate.
5. Execute the powered exact three-window configuration or issue only the
   permitted finite-corpus fallback claim.

- Design-readiness self-score for the nine R2c3 residuals: **97/100**.
- Fresh statistical advisory: **complete and incorporated**.
- Independent implementation validation: **not run**.
- Known unresolved design defects within the addressed scope: **zero identified**.
- Open implementation/qualification items: **five, listed above**.

This addendum is not measured savings, provider qualification, runtime
activation, cost evidence, production/private-data evidence, or credential-
repository safety.
