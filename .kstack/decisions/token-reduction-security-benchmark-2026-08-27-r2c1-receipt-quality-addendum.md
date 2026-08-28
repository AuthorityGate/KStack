# R2c1 normative addendum: receipt-bound usage and quality qualification

- Status: PROPOSED DESIGN-ONLY ADDENDUM
- Date: 2026-08-27
- Amends: `token-reduction-security-benchmark-2026-08-27-r2b-benchmark-addendum.md`
- R2b SHA-256: `115a072e4770d1e0ca824d97624f4d29483da94128c4660509fe03cef44b8610`
- Complements: the base and R2a/R2a1/R2a2 provider-security addenda
- Scope: independent-review findings 1–4 and 9 only
- Authority: no implementation, activation, external review, commit, or push

If this addendum conflicts with R2b on usage authority, adjudication cohort,
quality estimand, activation analysis, or shared adjudication overhead, this
addendum controls. The provider/security addenda continue to control admission,
volatile inspection, persistence, authentication, and security-stop behavior.

## 1. Findings disposition and decision

This addendum closes only these benchmark-design findings:

1. Primary `U/W/R/P` usage must be authenticated-receipt-bound; unverified
   usage is `null` and fails qualification.
2. Quality discovery/adjudication must operate as an isolated task×window
   volatile cohort through semantic fixed-point closure, then seal labels and
   destroy raw material without later cross-window rescoring.
3. Activation gates must independently cover cache strata, task classes, every
   window, and pooled results, including savings non-regression and class×window
   quality guardrails.
4. Detection and resolution estimands, denominators, weighting, paired risk
   differences, zero-defect behavior, confidence intervals, and the sealed
   existence/severity pass must be completely defined.
9. All adjudication calls must be reported in a separate ledger and excluded
   from shared arm-savings arithmetic.

Independent-review findings **5–8 and 10–11 remain OPEN and unchanged**. This
artifact neither repairs nor reclassifies them. No statement below may be used
to waive those findings or to claim implementation readiness.

## 2. Authenticated receipt-bound primary usage

### 2.1 Sole authority

For every provider call whose usage is reported—including product task-arm and
meta-adjudication calls—the fields
`input_uncached_tokens (U)`, `input_cache_write_tokens (W)`,
`input_cache_read_tokens (R)`, and `provider_reported_input_total (P)` may be
non-null only when derived from an authenticated usage receipt accepted by the
R2a-qualified host supervisor. Only product-call values enter the primary
savings endpoint; meta-adjudication values are separate overhead.

The receipt must exact-bind:

- provider/route, exact model/revision, request type, and usage-schema version;
- benchmark configuration, provider-envelope, call-attempt, task, window, arm,
  and ordinal IDs/digests;
- provider request/response identity and terminal disposition;
- cache namespace/mode, request nonce, issue time, anti-replay value, and the
  complete raw usage fields used by the mapping; and
- authenticated issuer identity plus verification algorithm/version.

The supervisor verifies issuer authenticity, destination, freshness,
single-use anti-replay, envelope/call equality, and the pinned
`ProviderUsageMappingV1`. A receipt digest and admitted canonical numeric fields
may persist; the raw receipt, authentication material, and unknown fields may
not.

### 2.2 Null and failure rule

`P` may be directly stated or exactly derived from authenticated receipt fields,
but all `U/W/R/P` must be non-null, disjoint, and reconcile under the pinned
mapping for every provider-accepted call. If any receipt is absent, unsigned,
untrusted, replayed, stale, mismatched, incomplete, semantically ambiguous, or
fails reconciliation:

1. set all four primary fields for that call to `null`;
2. retain the call and its closed failure disposition in intention-to-treat;
3. do not substitute local tokenizer, bytes, estimate, cache claim, partial
   provider record, billing export, or zero; and
4. fail qualification for that exact provider/model/request-envelope
   configuration.

This is stricter than R2b's ordinary missingness gate. Conservative intervals
remain useful diagnostics but cannot rescue receipt-unverified primary usage.
A broker proof that no provider dispatch occurred may establish
`NOT_DISPATCHED`; it is not a provider usage receipt, leaves `U/W/R/P` null,
and therefore cannot appear in a qualifying window after randomization.

Output/reasoning diagnostics may be reported only under their explicitly named
authority and never enter primary savings. “Authenticated” describes the
receipt chain, not merely TLS transport or caller assertion.

### 2.3 Primary savings population

R2b's terminal all-product-call accounting remains: cache preparation, primary,
fallback, retry, recovery, and failed provider calls assigned to an arm stay in
that arm. For a qualifying task arm:

`L_arm = sum_over_product_calls(U + W + R)`

with every term authenticated and reconciled. `P` is retained as a receipt-
bound reconciliation field, not added again. A fallback stays B3 and its
product-call tokens remain charged to B3.

## 3. Task×window volatile cohort and bounded semantic fixed point

### 3.1 Isolation and inputs

One `QualityCohortV1` exists for exactly one immutable task, overnight window,
and benchmark configuration. It contains every required cache stratum, all
randomized arm terminal responses, and admitted intermediate product-call
outputs for that task×window. It never contains another task or window. Cache
and arm identities remain hidden from reviewers.

All raw task evidence, product output, candidate prose, reviewer material, and
semantic mappings remain in R2a-qualified bounded volatile storage. The only
persistent inputs are admitted public/synthetic corpus and frozen gold IDs;
production data, ECR/credential material, private tickets, and credential-
derived values remain forbidden.

Each arm has one **shared terminal response**: the response whose decision or
failure terminally controls the arm outcome. If none exists, every real defect
is a detection/resolution miss for that arm. Intermediate/retry/fallback
responses participate in open discovery and per-call diagnostics but do not
replace the shared terminal response estimand.

### 3.2 Bounded fixed-point procedure

The cohort runs at most three iterations, frozen as `MAX_FIXED_POINT_PASSES=3`:

1. **Open discovery.** Start with frozen gold and deterministic findings, then
   inspect every admitted shared and intermediate arm output. Two independent,
   fresh, arm-blind discovery sessions may propose any semantically material
   defect. Their raw proposals remain volatile.
2. **Semantic union/dedupe.** Union gold, deterministic, every-arm, every-call,
   and both discovery sets. A deterministic semantic key is not sufficient by
   itself: two fresh arm-blind reviewers decide whether candidates describe the
   same violated invariant. A tie retains separate candidates. No candidate is
   dropped merely because only B3 or only control exposed it.
3. **Existence/severity second pass.** Two new reviewers, neither used for that
   iteration's discovery/dedupe, independently label real-defect existence and
   fixed severity. They see admitted task evidence and randomized candidate
   order, but no response/arm identity. Disagreement resolves to defect-present
   and the higher severity. The resulting ledger is sealed before any reviewer
   labels arm detection or resolution.
4. **Detection/resolution pass.** Two further fresh reviewers independently see
   the sealed defect set and randomized anonymous shared responses. They label
   detection and resolution under section 4. Disagreement resolves to miss.
   They may raise a newly observed defect, but cannot alter sealed existence or
   severity in this iteration.
5. **Closure test.** If no semantically new candidate arose in steps 3–4, seal
   the final labels and reach fixed point. Otherwise, add new candidates to the
   volatile union and repeat all five steps with fresh sessions/randomization.

At pass three, any new candidate or unresolved semantic identity returns
`ADJUDICATION_FIXED_POINT_NOT_REACHED`, counts the affected arm quality
conservatively as misses, and fails every affected class×window×cache cell. It may
not silently truncate the union or invoke a fourth pass.

### 3.3 Seal, destroy, and no rescoring

At fixed point, atomically seal the closed final label ledger, reviewer/tie
codes, fixed-point pass count, admitted input-manifest digest, and R2a-permitted
non-linkable IDs. Only after seal verification succeeds, destroy every volatile
raw output, proposal, semantic view, candidate/reviewer prose, prompt, excerpt,
alias map, buffer, pipe, temporary object, and provider session.

If sealing or destruction proof fails, enter the R2a security failure domain;
no labels from that cohort qualify. Crash before seal is an intention-to-treat
quality miss. Crash after seal uses only the sealed closed labels and destruction
proof; raw recovery is forbidden.

A cohort is final for its own task×window. Later windows may reuse
the immutable gold IDs but repeat open discovery and all labeling from fresh
sessions. They cannot import candidate prose, labels, severity, detection, or
resolution from an earlier window. Discoveries in a later window do not reopen
or rescore a prior cohort; they are reported as cross-window stability evidence
and apply only to the later cohort unless a new prospective benchmark begins.

## 4. Fully specified quality estimand

### 4.1 Defect opportunity and outcomes

Let `F(t,w,s)` be the final sealed set of real, semantically unique defects for
task `t`, window `w`, and severity stratum `s`. The same set is presented
against A and B3 in every cache stratum `c`, so every defect is paired.
Gold membership does not grant automatic truth; existence/severity is decided
by the arm-blind sealed second pass. Candidates labeled not-real are reported
as discovery diagnostics and excluded from the defect denominator.

For arm `a`, cache stratum `c`, and defect `d`:

- `D(a,c,d)=1` only when the shared terminal response explicitly and materially
  identifies the same violated requirement, with correct affected scope and no
  contradiction; otherwise `0`.
- `R(a,c,d)=1` only when `D(a,c,d)=1` and the terminal decision/remedy would prevent
  or correct the defect, preserve locked objectives/invariants, and introduce
  no same-or-higher-severity defect; otherwise `0`.

Thus `R <= D`. Mention without a workable correction can detect but not
resolve. A correct change with no materially identifiable defect explanation is
not detection/resolution credit for this review-quality estimand; deterministic
task success is reported separately. Missing/failed/unevaluable arm response
sets both values to `0`.

Primary quality is **resolution-miss risk** `1-R`. Detection-miss risk `1-D` is
a separate mandatory guardrail, not a substitute. Confidence score, prose
length, number of emitted findings, fallback, and reviewer self-rating are not
quality outcomes.

### 4.2 Denominator and weighting

For a nonempty sealed set, cohort miss risks are:

`M_R(a,t,w,c,s) = sum_d(1 - R(a,c,d)) / |F(t,w,s)|`

`M_D(a,t,w,c,s) = sum_d(1 - D(a,c,d)) / |F(t,w,s)|`

Every unique real defect has equal weight within its task/severity stratum.
Every eligible task has equal weight within a task class, regardless of how
many findings it generated. Task classes, cache strata, windows, and
critical/high versus medium/low severities are reported separately before any
prespecified pooling. No task, prolific reviewer, or large artifact can dominate
by emitting duplicates.

The paired risk differences are:

`RD_R = weighted_mean_t,w[M_R(B3,t,w,c,s) - M_R(A,t,w,c,s)]`

`RD_D = weighted_mean_t,w[M_D(B3,t,w,c,s) - M_D(A,t,w,c,s)]`

using the same sealed defect set and equal task weights. Negative favors B3.
Resolution `RD_R` is the primary endpoint; both `RD_R` and `RD_D` must pass.

### 4.3 Confidence intervals and zero-defect behavior

Risk-difference intervals use R2b's paired task-cluster bootstrap, stratified by
task class and carrying all window replicates with the sampled task. The
noninferiority gate uses the upper one-sided 95% bound for each relevant cell;
report two-sided 95% intervals as diagnostics. Absolute B3 quality floors use a
lower one-sided 95% task-cluster-bootstrap bound. Freeze seeds, replicate count,
continuity convention, and small-sample rule before outcomes are visible.

If `|F|=0`, do not compute `0/0`, assign zero risk, or count the cohort as a
perfect response. Mark defect risk and paired difference
`NOT_ESTIMABLE_ZERO_DEFECTS`. Such a cell cannot satisfy defect
noninferiority. It qualifies only if the configuration prospectively selected a
zero-defect absolute-outcome guard: every task has a frozen deterministic
`TaskOutcomePass` predicate, B3 has no false approval or new material finding,
and the lower one-sided 95% bound on B3 task-outcome pass probability meets a
frozen `q_zero >= 0.95`. The claim must state that defect sensitivity was not
estimated for that cell.

For critical/high defects, the configuration prospectively selects exactly one
guard, without switching after results:

- `ZERO_B3_MISS`: at least one sealed critical/high defect exists in each
  required analysis cell and B3 has zero detection and zero resolution misses;
  or
- `ABSOLUTE_CH_FLOOR`: the corpus/power plan supplies an estimable critical/high
  denominator and the lower one-sided 95% bound for B3 detection and resolution
  each meets frozen `q_ch >= 0.99`.

An empty or underpowered critical/high denominator cannot pass either guard by
vacuity. It requires a new prospectively frozen corpus/configuration, not post
hoc defect injection or cross-window rescoring.

## 5. Activation hierarchy and claim scope

The configuration freezes which cache strata are claimed. Every required
stratum must pass independently; a warm result cannot rescue cold or vice
versa. B3 qualifies only when all gates below pass:

1. **Receipt completeness:** every product provider call in every arm has
   authenticated, reconciled, non-null `U/W/R/P`. Any unverified primary usage
   fails the exact configuration, regardless of missingness percentage.
2. **Cache-stratum × window savings:** for every cache stratum `c` and each of
   the three initial windows `w`, conservative intention-to-treat reduction
   `S(c,w)` is at least 15%.
3. **Cache-stratum pooled savings:** within every `c`, the lower two-sided 95%
   task-cluster-bootstrap bound over all three windows is at least 15%.
4. **Per-class savings non-regression:** for every task class `k` within every
   cache stratum, each window's conservative point reduction `S(c,k,w)` is at
   least 0%, and its pooled lower two-sided 95% bound is at least 0%. A high-
   saving class cannot mask a regressing class.
5. **Class × window quality:** for every `c,k,w`, the upper one-sided 95% bounds
   for both `RD_R` and `RD_D` are no more than +2 percentage points. Each cell
   must have the power/denominator frozen for that calculation or use only the
   prospectively valid zero-defect rule in section 4.3.
6. **Critical/high guard:** every `c,k,w` passes its prospectively frozen
   `ZERO_B3_MISS` or `ABSOLUTE_CH_FLOOR` rule. Mode switching, severity
   demotion, pooling sparse cells, or owner acceptance after results is barred.
7. **Each-window overall floor:** after prespecified class/cache weighting, each
   complete window's conservative total reduction is at least 15%.
8. **Overall pooled floor:** the lower two-sided 95% task-cluster-bootstrap
   bound across all required classes/cache strata/windows is at least 15%.
9. **Existing strict gates:** deterministic equality, security, missingness,
   fixed-point closure, session/cache isolation, fallback, round, latency,
   ratchet, power, and every unchanged stricter base/R2 rule pass.

All intervals preserve task clusters and their window replicates. No owner-
benefit exception, confidence score, complete-case subset, arm replacement,
post hoc weighting, or extra window can turn a failed cell into activation.
Additional windows diagnose or begin a prospectively new qualification.

The claim names the exact configuration/envelope/receipt-mapping digests,
provider/model/revision, cache strata, task classes, window dates, corpus/gold,
shared terminal-response definition, quality guard mode, point estimates,
intervals, and all non-estimable cells. It applies only to those named cells and
states `authenticated receipt-bound logical input`, not billed cost, all model
input, tool-output compaction, all providers, or credential handling.

## 6. Separate all-call adjudication ledger

`AllCallAdjudicationLedgerV1` reports every quality-measurement operation for a
task×window cohort, including every required cache stratum:

- references to every intermediate and terminal product call considered in
  discovery, without copying its arm usage totals;
- every discovery, semantic-dedupe, existence/severity, detection/resolution,
  fixed-point, retry, fallback, failed, and destruction-verification call;
- fixed-point iteration, call role/ordinal/predecessor, terminal disposition,
  closed failure code, and permitted timing; and
- authenticated `U/W/R/P` for meta-adjudication provider calls, or `null` plus
  qualification failure under section 2.

The ledger persists only R2a-permitted closed fields and label/digest references,
never raw evidence or reviewer content. Meta-adjudication usage, latency, retry,
and failure totals are published separately as benchmark measurement overhead.

Primary arm savings use only product calls already present once in
`TaskArmTerminalV1`. Meta-adjudication calls are shared measurement machinery,
are assigned to no arm, and are excluded from A/B3 savings numerator and
denominator. Product calls remain fully charged to their randomized arm even
when referenced by this ledger. Per-call diagnostic labels neither replace the
shared terminal response nor alter the paired quality estimand. These rules
prevent both hiding product fallback cost and double-counting shared review
overhead as treatment cost or savings.

## 7. Required deterministic evidence

- Mutating issuer, signature/MAC, provider request, envelope/config digest,
  call ordinal, cache namespace, nonce, usage field, or terminal disposition
  rejects the receipt, nulls `U/W/R/P`, and fails qualification.
- Missing, ambiguous, partial, estimated, locally tokenized, billing-export, and
  transport-only usage fixtures cannot populate any primary field.
- Cache-write/read reconciliation fixtures prove `P` is not added to `U+W+R`
  and no cache population appears twice.
- Each task×window cohort proves raw isolation, fresh reviewer sessions,
  randomized arm masking, semantic union/dedupe, sealed second-pass existence/
  severity, and destruction after final label seal.
- Fixed-point fixtures converge at passes one through three; a pass-three new
  candidate fails without truncation or a fourth pass.
- Cross-window mutation proves earlier labels cannot be loaded, altered,
  rescored, or silently expanded by later discovery.
- Quality fixtures prove `R<=D`, empty denominator is not zero risk, equal task
  weighting, exact paired denominators, resolution/detection separation,
  conservative disagreement, and task-cluster confidence intervals.
- Activation negatives independently fail receipt completeness, each cache
  stratum/window, per-class savings, each class×window quality cell,
  critical/high mode, each-window overall, and pooled lower-95% gates.
- All-call accounting proves product calls appear once in arm savings while all
  meta-adjudication calls/retries/failures appear only as reported shared
  measurement overhead.
- A crash or scanner/seal/destruction failure persists no raw output and enters
  the prescribed quality/security failure domain.

## 8. Preserved open findings and self-assessment

The independent review's findings **5, 6, 7, 8, 10, and 11 remain OPEN**. Their
original wording, severity, and required remediation are preserved outside this
addendum. They must receive separate bite-size repairs and review; they cannot
be treated as implementation tasks closed by this document.

Open implementation/qualification work introduced by this addendum:

1. Implement and independently qualify authenticated receipt verification and
   exact provider usage mappings.
2. Implement the isolated volatile fixed-point adjudication supervisor and
   prove terminal destruction on each supported host.
3. Freeze powered denominators, quality guard mode/floors, and analysis program
   before any qualifying result is visible.
4. Run all required exact configuration/cache/class/window cells after every
   provider-security prerequisite and remaining finding is closed.

- Design-readiness self-score for findings 1–4 and 9: **96/100**.
- Independent reviewer score for this addendum: **not run**.
- Known unresolved defects within the addressed scope: **zero identified**.
- Preserved independent-review findings outside scope: **six open**.

This is a design contract only. It does not establish token savings, qualify a
provider, activate packet slicing, authorize persistent raw output, or make the
design-only credential repository safe for real credentials.
