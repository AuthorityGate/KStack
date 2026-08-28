# R2c2 normative addendum: frozen statistics, isolation, and claims

- Status: PROPOSED DESIGN-ONLY ADDENDUM
- Date: 2026-08-27
- Amends: `token-reduction-security-benchmark-2026-08-27-r2c1-receipt-quality-addendum.md`
- R2c1 SHA-256: `ba015fc0a9ca51c6857d6796c77c154723156b2f3a111071851d751007ce4dff`
- Scope: preserved independent-review findings 5–8 and 10–11 only
- Authority: no implementation, activation, external review, commit, or push

R2c1 and its base/R2 chain remain normative. If this addendum conflicts on
sample planning, missing arithmetic, bootstrap mechanics, cache/crossover
isolation, requalification triggers, or claim content, this addendum controls.
It does not weaken authenticated receipts, volatile adjudication, quality gates,
security failure domains, or the complete three-window requirement.

## 1. Findings closed in design

This addendum addresses the six findings R2c1 preserved:

5. Freeze complete hypotheses, nuisance/event assumptions, allocation, CI,
   precision assurance, exact/max sample sizes, and blinded re-estimation.
6. Define zero/nonfinite/overflow/invalid-draw failures and distinguish proven
   non-dispatch zero from uncertain token intervals.
7. Fully specify the total paired task-cluster bootstrap and forbid discarded
   or redrawn invalid replicates.
8. Close cache, crossover, task-state, seed, tool-state, concurrency, order, and
   carryover isolation.
10. Make the requalification trigger set exhaustive and fail closed on drift.
11. Require an exact but human-readable claim with scope and limitations.

No implementation or qualification evidence is supplied by this artifact.

## 2. Frozen sample-size and analysis plan

Before pilot labels, arm identities, or qualifying results are visible, seal a
canonical `StatisticalAnalysisPlanV1` and bind its digest into
`BenchmarkConfigurationV1`. It contains all of the following.

### 2.1 Hypotheses and nuisance assumptions

For savings, freeze the primary null and alternative:

- `H0_save: S <= 0.15`
- `H1_save: S = S_alt`, with one numeric `S_alt > 0.15`

for every required cache-stratum claim and for the overall diagnostic pool.
Per-class non-regression freezes `H0_class: S_k < 0` and the design alternative.

For resolution and detection, freeze the paired-risk-difference nulls
`H0_quality: RD >= delta` and alternatives `RD_alt < delta`, separately by
task class, cache stratum, window, endpoint, and severity rule. `delta` is the
R2c1 +0.02 noninferiority margin unless a stricter value is frozen. Critical/
high zero-miss or absolute-floor mode and `q_ch/q_zero` are immutable.

Freeze, with source/evidence digests:

- per-class/cache means, variances, covariance, skew/tail model, and within-task
  intracluster correlations for A, B3, their paired difference, and three window
  replicates;
- fallback/retry/failure/missingness/cache-hit event probabilities and their
  arm correlation;
- gold defect prevalence by class/severity, detection/resolution probabilities,
  paired discordance, zero-defect frequency, and adjudication nonconvergence;
- task-class and cache allocations, fixed claim weights, window count/weights,
  crossover sequence allocation, and expected attrition; and
- multiplicity handling, every CI type/level/tail, estimator, quantile rule,
  bootstrap count, PRNG/seed, and analysis implementation digest.

`unknown`, a range without a prespecified worst-case selection, or a value
chosen from unblinded arms is not a frozen assumption.

### 2.2 Precision assurance and exact/max N

The sealed power simulation uses the complete R2c2 estimator/bootstrap and
missing-data rules. Choose the smallest balanced integer task allocation that
simultaneously provides:

- at least 90% power for every savings and quality gate at its frozen
  alternative;
- at least 90% **precision assurance** that the realized two-sided 95% pooled
  savings interval width is no more than 5 percentage points;
- at least 90% precision assurance that every class×cache×window quality upper
  one-sided 95% bound can distinguish `RD_alt` from `delta`; and
- the frozen minimum critical/high and other defect-bearing denominators needed
  by the selected quality mode without post hoc defect manufacture.

Precision assurance is the simulated probability of meeting the width/bound
criterion, not expected width. Freeze exact `N_initial_total`, exact
`N_initial_by_class`, and finite `N_max_total/N_max_by_class`, with all values
rounded upward to complete crossover/allocation blocks. Three window replicates
do not turn into extra independent tasks.

If no allocation at or below `N_max` satisfies every requirement, the exact
configuration is `UNDERPOWERED` and cannot run a qualifying campaign.

### 2.3 One blinded re-estimation, no top-ups

At one frozen information fraction, an independent statistician/program may
re-estimate nuisance quantities from pooled observations only after removing
arm labels, crossover positions, provider-response content, quality outcomes,
fallback reasons correlated with arm, and any statistic from which direction or
gate proximity can be reconstructed. Permitted inputs are pooled task-token
variance/correlation, pooled event prevalence, and pooled defect-count variance.

The sealed re-estimation formula either retains `N_initial` or raises each
class allocation to the next complete block, never above `N_max`. It cannot
change hypotheses, effect alternatives, margins, weights, alpha/CI, endpoints,
windows, strata, event definitions, or maximum N. The program emits only the
new blinded nuisance ledger and integer N decision before arm unmasking.

Any access to an arm contrast, interim point/CI, pass/fail count, class direction,
or quality difference invalidates the campaign. After this single decision,
there are no result-driven top-ups, replacement tasks, extra windows, optional
stopping, or increases because a CI nearly missed. Failure at final N is a
failed/inconclusive benchmark and requires a new prospectively frozen campaign.

## 3. Missing arithmetic and terminal validity

### 3.1 Proven non-dispatch versus uncertain usage

`PROVEN_NONDISPATCH` requires an authenticated supervisor/broker negative
receipt binding the exact call ordinal, envelope/configuration digest, unused
one-shot capability, destination, monotonic time, and proof that no provider
connection/request/body byte was accepted. Its arithmetic interval is exactly
`[0,0]` provider tokens.

This proof does **not** become a provider usage receipt: R2c1 `U/W/R/P` remain
`null`, the call remains an intention-to-treat failure, and receipt-completeness
qualification still fails after randomization. The zero is permitted only for
conservative diagnostic bounds.

If provider acceptance or inference cannot be disproved, usage is uncertain.
Its lower bound is zero and its upper bound is the sum of every frozen per-call
request ceiling for the observed and still-possible bounded ordinals. A local
token count may tighten the upper bound only under its frozen qualified error
proof; it never populates `U/W/R/P`. Timeout, lost response, ambiguous EOF,
broker crash, missing receipt, and unknown terminal status are uncertain, not
non-dispatch zero.

### 3.2 Mandatory arithmetic failures

All sums/products use checked arbitrary-precision non-negative integers; ratios
and weights use reduced rationals until the final declared decimal rendering.
Reject rather than wrap, saturate, coerce, or emit IEEE nonfinite values.

For every point estimate, cell, and bootstrap replicate, fail analysis when:

- the control lower-bound denominator is zero or negative;
- numerator, denominator, weight sum, risk denominator, or ratio is missing,
  nonfinite, NaN, negative where prohibited, or outside its frozen bound;
- integer/rational construction, multiplication, accumulation, conversion, or
  quantile index overflows its declared implementation limit;
- a required arm/task/window/cache response or interval is absent;
- class/cache/window weights do not exactly sum to one at their declared level;
- a zero-defect quality cell is processed outside R2c1's explicit zero-defect
  absolute-floor rule; or
- authenticated usage and conservative interval ledgers disagree.

The terminal code names the first closed failure class and fails qualification.
No epsilon denominator, zero substitution, complete-case deletion, clamping,
continuity patch, alternate estimator, or owner waiver is permitted.

## 4. Total paired task-cluster bootstrap

### 4.1 Frozen weights and point estimators

Let task classes be `k=1..K`, with exact positive rational claim weights
`alpha_k` summing to one. Weights express the prospectively claimed workload
mix and are independent of sampled `N_k`; observed allocation never silently
reweights the claim. The three qualifying windows have equal weight `1/3`.
Each cache stratum `c` is a separate primary qualification. Optional overall
diagnostics use positive frozen rational `gamma_c` summing to one and cannot
replace a failed stratum.

For task `i`, window `w`, class `k`, and cache stratum `c`, let `A_ikcw` and
`B_ikcw` be terminal all-product-call logical input for A and B3. Point estimates
use exact authenticated totals. Conservative estimates use `A_lower` and
`B_upper` for any diagnostic missing interval.

Define class/cache means:

`Abar_kc = (1/N_k) * sum_i[(1/3) * sum_w A_ikcw]`

`Bbar_kc = (1/N_k) * sum_i[(1/3) * sum_w B_ikcw]`

and total-weighted savings:

`S_c = 1 - [sum_k alpha_k * Bbar_kc] / [sum_k alpha_k * Abar_kc]`.

For class non-regression, `S_kc = 1 - Bbar_kc/Abar_kc`. Each-window versions
drop the `1/3 sum_w` term and use that window only. Overall diagnostics replace
each numerator/denominator with `sum_c gamma_c` weighted values. Never average
percent reductions across tasks/classes/cache strata.

R2c1 quality cohort miss risks and paired `RD_R/RD_D` are averaged equally over
sampled tasks in their fixed class; windows remain explicit for class×window
gates and equally weighted for a prespecified pooled diagnostic. Defect count
does not alter task weight. Paired-median savings is secondary and cannot
activate.

Threshold comparisons use exact rationals. Display decimals use round-to-
nearest, ties-to-even at six places and are marked presentation-only.

### 4.2 Shared cluster-resampling algorithm

Use exactly 10,000 percentile-bootstrap replicates. Before execution, commit a
256-bit seed. After all cohort labels seal, reveal it. Generate indices with the
pinned `BootstrapIndexV1` SHA-256 counter stream and rejection sampling, not
modulo reduction; the implementation/test-vector digest is part of the plan.

For replicate `b`:

1. Within each class `k`, draw exactly `N_k` task IDs with replacement from that
   class. Preserve multiplicity and original task ordering as the deterministic
   tie-break.
2. Apply the same sampled task-ID multiset to A and B3, all three window
   replicates, every required cache stratum, token and quality endpoints,
   fallbacks/failures, and all missing intervals. Do not resample calls, arms,
   windows, defects, or cache strata independently.
3. Recompute every class/cache/window estimator, pooled numerator/denominator,
   savings, `RD_R`, `RD_D`, and absolute floor from scratch using the fixed
   weights and R2c1 quality denominators.
4. A missing arm stays present: tokens use its frozen conservative bound and
   quality uses its prescribed miss. Never drop its paired control/treatment or
   replace the task.
5. Apply every section 3 arithmetic check. If any required estimator in any
   replicate is invalid, record `BOOTSTRAP_INVALID_DRAW` with replicate number
   and fail the complete configuration.

An invalid draw is never discarded, redrawn, repaired, or replaced by a later
draw. Exactly the first 10,000 seeded replicates form the distribution or the
analysis fails.

### 4.3 CI type, quantiles, and ties

Use the unstudentized percentile paired task-cluster interval; no normal,
basic, BCa, t, delta-method, or asymptotic substitution is allowed. Sort all
10,000 exact rational replicate estimates ascending while retaining duplicates.
For `x[1]..x[10000]`:

- two-sided 95% interval is `[x[250], x[9750]]`;
- one-sided 95% lower bound is `x[500]`;
- one-sided 95% upper bound is `x[9500]`.

Indices are nearest-rank `ceil(p*10000)` with no interpolation. Exact ties
remain repeated observations; compare equal rationals by original replicate
number only for stable ordering. NaN/nonfinite/missing values cannot sort and
therefore fail rather than shrink the distribution.

Use lower bounds for savings/absolute-quality gates and upper bounds for paired
quality noninferiority. Publish the exact point estimator, CI kind/tail,
quantile indices, seed commitment/reveal, valid replicate count (exactly 10,000),
and implementation digest.

## 5. Cache, crossover, and task-state isolation

### 5.1 Exact cache strata

Cold and warm are distinct qualifications with distinct configuration digests.
Each arm/cache/task/window gets a unique unpredictable provider namespace that
is never reused or visible to another arm. A provider with unnamespaced,
uninspectable, automatic, or cross-request cache behavior is unsupported.

For warm execution, freeze each arm's exact model-visible cacheable prefix bytes
after full ProviderEnvelope admission: content, framing, order, length, digest,
renderer/adapter, model, and cache-control fields. Prepare A from A's exact
prefix, B1 from B1's, B2 from B2's, and B3 from B3's; never seed one arm from a
common or opposing-arm prefix. No padding, truncation, semantic rewrite, or
post-digest provider transform is permitted.

The arm-specific preparation call runs inside its product task arm. Its cache
write/read tokens, failure, retry, latency, and cost remain charged to that arm.
The authenticated receipt binds the exact prefix digest/namespace and proves
the subsequent read. Different prefix sizes are part of measured behavior, not
normalized away.

Cold uses a newly proven-empty namespace or verified cache-disable control.
Any cold read, warm prefix mismatch, namespace reuse, cross-arm hit, unknown
cache field, or unverifiable eviction/retention fails that cache stratum/window.

Warm and cold each independently pass all R2c1 class/window/pooled savings and
quality gates. A combined cache-weighted result is labeled diagnostic only and
cannot activate or support a generic cache-neutral claim.

### 5.2 Pristine task and tool state

Every task-arm begins from the same descriptor-bound immutable repository and
corpus snapshot. Create a private copy-on-write/disposable workspace with a
sealed initial state manifest covering every readable file, database, clock/
locale fixture, process-visible setting, tool schema, tool result fixture, and
allowed network endpoint. No arm can observe writes, locks, processes, ports,
temporary files, build caches, indexes, or side effects from another arm.

Tools are read-only deterministic fixtures unless the frozen task requires a
private transactional simulator restored from the same snapshot. Mutable live
services, production tickets, shared Jira/GitHub state, user data, and real
credential/auth flows are excluded. Tool call IDs and result bytes are bound in
the envelope. On terminal completion, verify the final mutation ledger and
destroy the workspace; unexpected external mutation fails the window.

Freeze task-generation, model-sampling, tool-simulator, crossover, and bootstrap
seeds independently. A provider without an effective seed is marked
`PROVIDER_SEED_UNAVAILABLE`; arms remain randomized replicates under that exact
configuration and cannot be described as bit-identical. Caller seed drift or
reuse outside its declared role rejects.

### 5.3 Concurrency, order, and carryover

Freeze maximum/actual concurrency per provider, arm, class, and window;
scheduler/queue policy; resource limits; CPU/GPU placement; rate-limit budget;
timeout/retry policy; and dispatch spacing. Symmetry requires each arm to occupy
every concurrency position equally within complete blocks.

Generate the closed set of balanced Latin-square arm orders from the
precommitted crossover seed. Within every class/cache/window, allocate those
orders across complete task blocks so each arm occupies every order position
equally. Arms for one task/cache execute serially in that assigned order;
allowed concurrency is across isolated tasks and is position-balanced. Freeze
every assignment before calls begin. Do not reorder, selectively delay, rerun,
or replace an arm because of cache state, load, timeout, failure, or observed
quality. A missed slot remains its terminal outcome.

Every arm uses a fresh process/session/conversation, minimal environment,
private workspace, namespace, cache-preparation path, tool simulator, and
one-shot capabilities. Before and after each arm, authenticated host probes bind
session absence, cache namespace ownership, workspace initial/final digest,
tool-state generation, open descriptors/connections, and provider-route state.
Any carryover, unexplained drift, stale session, shared cache hit, or asymmetric
resource exposure fails the entire affected cache-stratum window; statistical
adjustment cannot repair it.

## 6. Exhaustive full-requalification triggers

`RequalificationTriggerRegistryV1` is closed and deny-by-default. A changed,
unknown, expired, unavailable, or unverifiable value in any category below
invalidates the prior claim and requires a new exact configuration plus all
tasks/arms in three new qualifying windows:

- **Corpus/source:** task add/remove/edit; fixture/generator/seed; repository or
  source snapshot; admission/license/provenance; task input/expected outcome.
- **Gold/adjudication:** gold set; semantic identity/dedupe rule; reviewer model
  or qualification; rubric; existence/severity/detection/resolution definition;
  tie rule; fixed-point bound; seal/destruction schema.
- **Checks/classes:** deterministic check code/config/threshold; class definition,
  assignment, classifier, stratum, class/cache/window weight, or claim scope.
- **Randomization:** arm definition; crossover/Latin-square algorithm or order;
  task/model/tool/bootstrap seed or PRNG; blinding/masking transform.
- **Analysis:** hypothesis, alternative, margin/floor, nuisance/event assumption,
  estimator/formula, missing interval, invalid-draw rule, bootstrap/CI/quantile,
  weighting/pooling, precision assurance, multiplicity, alpha, display rule, or
  analysis implementation/test-vector digest.
- **Sample/allocation:** `N_initial`, `N_max`, class/cache allocation, block size,
  blinded-re-estimation fraction/input/formula/decision, defect denominator, or
  any replacement/top-up policy.
- **Execution/window:** concurrency or scheduler/queue/resource placement;
  timeout/retry/fallback/rate-limit policy; tool/state simulator; dispatch order/
  spacing; cache prefix/namespace/control/retention; window definition, start/
  stop rule, eligibility, timezone, date spacing, or number of windows.
- **Receipt/authentication:** issuer/key/certificate/algorithm; receipt schema,
  authority, mapping/equation, anti-replay/freshness, authenticated fields,
  broker/supervisor/auth service, destination, or cache receipt proof.
- **Host/security:** CPU/GPU/hardware/firmware; OS/kernel/runtime/container;
  filesystem/mount/clock/locale; sandbox/egress; provider route registry;
  ProviderEnvelope/admission/scanner; binary/SDK/CLI/adapter/renderer/broker;
  immutable-read or volatile-inspection substrate.
- **Evidence lifetime:** any evidence, qualification, attestation, credential,
  signing key, capability, provider statement, or fixture expires, is revoked,
  rotates, becomes unreachable, or passes its frozen maximum age.
- **Provider drift:** provider/model revision or alias target; server routing,
  hidden wrapper/system context, tokenizer, sampling/reasoning/tool behavior,
  cache semantics, usage/response schema, authentication/retention, destination,
  quota/rate-limit class, or authenticated receipt behavior changes.

The registry binds detection method and evidence source per field. Comparing
marketing model names or source files alone is insufficient. If drift cannot be
proven absent, classify it as changed. “Compatible,” patch/minor release,
renewed evidence, configuration range, or one diagnostic window inherits no
qualification. Unchanged admitted corpus/gold may be reused byte-for-byte, but
the changed exact configuration still repeats the full three-window execution.

## 7. Human-readable claim contract

No activation claim exists unless a generated `TokenReductionClaimV1` has both
canonical machine-readable data and a human-readable rendering verified to be
field-for-field identical. The human rendering must state, without requiring a
linked methodology document:

1. **Formula:** for each cache stratum, print
   `S_c = 1 - (sum_k alpha_k * mean_task,window B3_tokens) /
   (sum_k alpha_k * mean_task,window A_tokens)`, defining A/B3, authenticated
   `U+W+R`, equal window weights, all-product-call inclusion, and exact class
   weights. State that `P` reconciles but is not added.
2. **Exact scope:** provider, route, model/revision, reasoning/tools, envelope,
   receipt mapping/issuer, host tuple, cache stratum, task classes, corpus/gold,
   sample counts, initial/final/max N, and configuration/evidence digests.
3. **Dates/windows:** local/UTC start and end for every qualifying window,
   qualification issuance/expiry, evidence ages, and whether blinded
   re-estimation changed N.
4. **Results:** exact rational-derived point estimate and presentation value;
   two-sided 95% percentile CI and lower bound; each-window result; each class
   non-regression result; `RD_R/RD_D` CIs; critical/high mode/floor; zero-defect
   non-estimable cells; and every activation gate disposition.
5. **Weights/allocation:** every `alpha_k`, optional diagnostic `gamma_c`, equal
   window weight, actual N by class, and an explicit statement that sample
   allocation did not determine claim weights.
6. **Fallback/failure:** count/rate/upper CI and token contribution of B3 full-
   context fallbacks; all product retries/recovery/failures/timeouts; receipt-
   unverified calls; proven-nondispatch versus uncertain intervals; missingness;
   fixed-point failures; and security stops, all by arm/class/cache/window.
7. **Excluded overhead:** discovery/adjudication call count, tokens, failures,
   and latency from `AllCallAdjudicationLedgerV1`, explicitly excluded from arm
   savings because it is shared measurement overhead.
8. **Limitations:** the corpus is only admitted synthetic/public data; no live
   production/private/Jira/user/credential/ECR workload was tested. The claim
   does not establish billing/cost reduction, token savings on another model/
   provider/host/configuration, tool-output compaction, security of credentials,
   or correctness outside the named task classes/cache strata.

Print the bootstrap kind, 10,000 quantile indices, seed commitment/reveal,
analysis digest, fallback definition, and failure denominator next to the
results. Use absolute counts with every percentage. Do not hide a failing cell
behind “overall passed,” confidence score, graph scale, rounded threshold, or a
footnote.

Claims are separate for cold and warm cache strata. A combined diagnostic is
labeled `NOT AN ACTIVATION CLAIM`. A failed/inconclusive campaign may publish a
failure report using the same fields but cannot use “qualified,” “achieved,” or
the 15–35% planning range as a measured KStack capability.

## 8. Required deterministic evidence

- A canonical-plan validator rejects one changed/unknown hypothesis, nuisance,
  event rate, allocation, weight, CI, precision assurance, exact/max N,
  interim fraction, or re-estimation formula.
- Blinded re-estimation fixtures prove no arm/direction/gate statistic can enter,
  enforce complete blocks/max N, and reject a second interim, unblinding, or
  result-driven top-up.
- Terminal fixtures distinguish authenticated `[0,0]` non-dispatch from every
  ambiguous-acceptance interval while preserving R2c1 null/qualification failure.
- Big-integer/rational negatives cover zero denominator, nonfinite conversion,
  overflow at each operation, missing arm, inconsistent bounds, zero-defect
  misuse, invalid weight sum, and invalid bootstrap draw without redraw.
- Published bootstrap test vectors reproduce all 10,000 shared task-cluster
  samples, multiplicities, point estimators, exact quantile indices, ties, and
  token/quality intervals in two independent implementations.
- Cache fixtures mutate one arm-specific prefix byte, reuse a namespace, inject
  a cold read/cross-arm hit, omit preparation tokens, or drift retention; each
  fails only through its prescribed fail-closed window/config path.
- Crossover fixtures prove complete Latin-square balance, immutable task/tool
  reset, frozen seeds/order/concurrency, no outcome-based rescheduling, and
  carryover detection across success/failure/crash.
- Requalification mutation tests change exactly one field in every section 6
  category, including evidence expiry and silent provider alias drift, and
  reject prior claims until three new windows pass.
- Claim golden files prove canonical/human parity, exact formula/weights/dates/
  CIs/fallback/failure/overhead, separate cache scope, and synthetic/public
  limitations; omission or misleading rounding rejects publication.

## 9. Self-assessment and remaining work

Open implementation/qualification work:

1. Implement and independently reproduce the sealed sample/power/precision and
   bootstrap programs from published test vectors.
2. Implement supervisor-authenticated non-dispatch proofs, interval arithmetic,
   and fail-closed terminal reconciliation without weakening R2c1 receipts.
3. Qualify exact cache namespace/prefix and pristine task/tool/crossover
   isolation for each supported provider/host.
4. Implement the closed requalification registry and provider-drift/evidence-
   expiry monitors.
5. Generate and independently compare canonical and human-readable claims.
6. Close all provider-security prerequisites, then execute the powered complete
   three-window campaign for every exact cache-stratum configuration.

- Design-readiness self-score for findings 5–8 and 10–11: **97/100**.
- Independent reviewer score for this addendum: **not run**.
- Known unresolved design defects within the addressed scope: **zero identified**.
- Open implementation/qualification items: **six, listed above**.

This design score is not measured savings, provider qualification, runtime
activation, cost evidence, or credential-store safety.
