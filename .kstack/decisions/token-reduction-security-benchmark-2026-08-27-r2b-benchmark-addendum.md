# R2b normative addendum: terminal accounting and qualification benchmark

- Status: PROPOSED DESIGN-ONLY ADDENDUM
- Date: 2026-08-27
- Amends: `token-reduction-security-benchmark-2026-08-27.md`
- Base SHA-256: `264941a83b6fd4bdf04c01059243e7995e1a1060cbd82f09954d3114b845d558`
- Complements: `token-reduction-security-benchmark-2026-08-27-r2a-provider-security-addendum.md`
- Scope: benchmark/accounting findings only.
Implementation, activation, external-review, commit, and push authority: none granted.

If this addendum and the base conflict on benchmark construction, accounting,
analysis, activation, or requalification, this addendum controls. R2a controls
provider-boundary and security-failure behavior. Nothing here weakens admission,
credential isolation, provider-envelope binding, or fail-closed requirements.

## 1. Decision

KStack will qualify token reduction only from provider-neutral, intention-to-
treat terminal task-arm records. A record includes every provider call and
local terminal attempt attributable to the randomized arm, including cache
preparation, slice execution, full-context fallback, retry, timeout, rejected
response, and failed call. Missing usage cannot silently remove a task, call,
or window from the denominator.

The benchmark must use fresh sessions, symmetric and isolated cache states, a
power/precision-derived task count, task-cluster inference that preserves all
window replicates, and arm-blind two-reviewer defect adjudication. Activation
requires all per-class quality noninferiority gates, the prespecified savings
floor in every window, and a pooled conservative lower 95% confidence bound of
at least 15%. An owner cannot waive a failed benchmark into a claim.

## 2. Frozen benchmark configuration and units

Before corpus generation or randomization, freeze a canonical
`BenchmarkConfigurationV1` containing:

- provider, route, exact model identity/revision, and reasoning configuration;
- provider CLI/SDK/broker/adapter binary digests and provider-field mapping ID;
- `ProviderEnvelopeV1` schema, renderer, wrapper, system/developer/tool/history,
  attachment, response-schema, request-limit, and admission-policy digests;
- sampling/tool/concurrency/retry/timeout/fallback policies and maximum calls;
- cache mode, namespace construction, retention policy, and verified controls;
- full/treatment packet builders/verifiers, tokenizers, and their digests;
- repository/corpus/gold/rubric/deterministic-check manifests;
- arms, task classes, window rules, randomization seed commitment, analysis
  program digest, sample-size assumptions, missing-data limits,
  noninferiority margins, and every activation threshold.

Unknown, mutable, or default-inferred fields make the configuration ineligible.
Freezing a field does not prove provider behavior; R2a qualification applies.

- A **task** is one immutable corpus item and the resampling cluster.
- A **window replicate** is that task in one distinct qualifying overnight
  window.
- A **task-arm execution** is one randomized arm for one task/window replicate,
  from cache/session preparation through exactly one terminal state.
- A **call attempt** is every intended provider dispatch or local terminal
  attempt assigned to the arm. It receives an ordinal before dispatch.

Each task appears in every arm in every qualifying window. Arms use randomized,
counterbalanced crossover order within task/class/window blocks. No result is
paired across different tasks, configurations, or windows.

## 3. Terminal task-arm ledger

`TaskArmTerminalV1` contains an ordered `CallAttemptV1[]` and one terminal
state. The append-only call record opens before cache preparation or dispatch
and records:

- opaque benchmark/task/window/arm/execution IDs and ordinal;
- role: `cache_prepare`, `primary`, `fallback`, `retry`, or `recovery`;
- predecessor ordinal and closed-catalog fallback/retry reason;
- admitted provider-envelope digest and non-sensitive byte/token metadata;
- start/stop timestamps and one terminal disposition;
- provider usage mapping ID and nullable canonical usage partitions;
- whether provider acceptance, inference, and response completion are proven;
- output disposition, closed failure class, and any bounded next-attempt
  authorization.

Every failure is an outcome, not a deletion rule. Pre-spawn rejection, broker
rejection, timeout, transport loss, rate limit, provider error, malformed
response, output-scan rejection, adjudication failure, crash, and abandoned
attempt remain in the ledger. A reserved ordinal with no dispatch is labeled
`NOT_DISPATCHED` with its reason and has zero *known* provider tokens; it is not
reported as a successful zero-token call.

The arm ends exactly once as `SUCCESS`, `SAFE_FULL_FALLBACK_SUCCESS`,
`QUALITY_FAILURE`, `SECURITY_STOP`, `INFRASTRUCTURE_FAILURE`, or `INCOMPLETE`.
A treatment task that falls back stays assigned to treatment; all treatment
and fallback calls are summed in treatment. Retry/recovery never creates a
replacement observation.

The runner independently reconciles reserved ordinals, broker/provider
receipts, output dispositions, and terminal record. Missing ordinals, duplicate
receipts, an unbounded successor, or process death without a terminal record
synthesizes `INCOMPLETE` from the write-ahead ledger. It remains in intention-
to-treat analysis and triggers section 6.

Persistent records contain only fields admitted by the base/R2a boundary. Raw
prompts, provider responses, tool output, transcripts, reviewer prose, aliases,
environments, and credential-adjacent values never enter this ledger.

## 4. Provider-neutral token and cache accounting

For each call, a qualified mapping produces these non-negative integers or
`null`:

- `input_uncached_tokens` (`U`): input neither cache-written nor cache-read;
- `input_cache_write_tokens` (`W`): input specifically reported as cache
  creation/write population;
- `input_cache_read_tokens` (`R`): input specifically reported as a cache hit;
- `output_visible_tokens` (`O`);
- `output_reasoning_tokens` (`G`), only when separately exposed; and
- `provider_reported_input_total` (`P`), when exposed.

`U`, `W`, and `R` are mutually exclusive token populations. Canonical logical
input is `L = U + W + R`; each prompt token occurs at most once. A provider
field inclusive of cache read/write cannot also populate a partition without an
explicit subtraction identity. Reasoning already included in output total is
not added again.

The mapping declares one verified reconciliation, such as `P = U + W + R`, or
declares `P` semantically incomparable. Failed arithmetic, negative derivation,
overlap, ambiguity, or schema/version mismatch makes affected fields `null` and
the configuration unqualified; values are never guessed or set to zero.

Every provider/configuration requires a reviewed `ProviderUsageMappingV1`
binding:

- provider, API/CLI/SDK/schema versions, exact model, and request type;
- raw field names, types, units, presence rules, and cache/output inclusivity;
- overflow-checked derivation and reconciliation equations;
- authenticated receipt authority, or explicit `unverified` classification;
- no-cache, cache-write, cache-read, mixed, retry, failure, streaming, and
  absent-field fixtures; and
- canonical mapping implementation/test digests.

Unknown provider fields reject the record. An unmapped provider request cannot
qualify. Local tokenization is a labeled diagnostic or missing-data bound, not
provider-reported usage.

Terminal arm totals include every cache-preparation, failed, fallback, retry,
and recovery call:

`L_arm = sum(U_i + W_i + R_i)`

`U`, `W`, `R`, `O`, and `G` are also summed separately. Unknown components
remain bounded unknowns; a partial sum is `known_only` and cannot enter a
complete-case primary endpoint. Receipt-derived cost is separate. Logical
input, cache behavior, bytes, latency, and cost are not interchangeable.

## 5. Fresh sessions and symmetric cache strata

Every task-arm starts a new provider conversation/session with no history,
resume token, prior tool state, memory, or shared mutable workspace. R2a's
isolated working directory, minimal environment, complete envelope, and
implicit-context suppression remain mandatory.

Cold and warm cache strata are separate prespecified cohorts:

- **Cold:** a unique unpredictable namespace per task-arm, verified empty or
  cache-disabled. Any observed read token invalidates the execution and records
  a cache-isolation failure.
- **Warm:** each arm gets its own unique namespace. The same frozen cacheable
  prefix and number/order of preparation calls are used symmetrically.
  Preparation is inside the arm execution; its tokens, failures, latency, and
  cost are included. A read proof must match the bound namespace/prefix/config.

No cache entry, session, conversation, namespace, preparation call, or request
ordinal is shared between arms/tasks. Arm order cannot determine warmth. A
provider unable to prove this may run only a prespecified cache-forbidden cold
cohort; otherwise the configuration is unsupported.

## 6. Intention-to-treat and missing data

The primary population contains every randomized task-arm in its assigned arm,
including security stops, infrastructure failures, fallbacks, retries, and
incomplete records. Exclusion is allowed only for a pre-randomization corpus
admission failure. Post-randomization binding errors are outcomes. Diagnostic
reruns cannot replace observations.

Quality failure, missing response, or inability to adjudicate counts as a miss
for that arm. A benchmark-wide security stop fails the window rather than
creating a smaller complete-case window.

For each missing canonical call total, calculate a frozen interval from the
exact admitted envelope and qualified tokenizer error bound. If unavailable,
use `[0, frozen_request_token_ceiling]`. For a lost terminal chain, reserve all
remaining frozen maximum call ordinals with that interval, accounting for
uncertain retries rather than assuming none occurred.

The conservative savings estimator is:

`S_lower = 1 - sum(B3_upper) / sum(A_lower)`

Treatment uses every missing interval's upper endpoint; control uses its lower
endpoint. The ordinary complete/exact point estimate is secondary when data are
missing. Bootstrap replicates recompute these bounds rather than imputing a
favorable mean.

A window/configuration fails qualification if any is true:

- more than 2% of randomized task-arms have unknown `L_arm`;
- the absolute treatment/control difference in that proportion exceeds 1
  percentage point;
- any task class has more than one unknown arm total or any differential
  missingness;
- any critical/high gold or union finding lacks terminal adjudication; or
- a missing interval lacks a frozen, independently verifiable upper bound.

Report missingness/reason by arm, class, window, call role, and terminal state.
Complete-case results are diagnostic only and can never activate the feature.

## 7. Power, precision, and clustered analysis

The base document's fixed 30-task minimum is replaced. Before qualification,
run an admitted pilot or use a conservative external variance bound. Freeze a
simulation including within-task correlation, three window replicates, class
allocation, crossover, fallback, missingness, and heavy-tailed token totals.

Choose the smallest task count satisfying every rule, then round upward to
balanced class blocks:

- at least 90% simulated power for the one-sided test that the pooled
  conservative lower 95% savings bound is at least 15%, at the frozen design
  alternative;
- at most a 5-percentage-point expected 95% interval width for pooled savings;
- at least 90% power for every task-class quality noninferiority test; and
- enough gold defects in each class/severity stratum for its prespecified
  calculation. If that requires manufacturing defects, it is not qualifiable.

Pilot observations used to select size are excluded unless plan/size were
frozen before their labels/results were observed.

Inference uses a paired task-cluster bootstrap stratified by task class. Each
draw samples whole task IDs and carries all arms and all three window replicates;
calls, arms, and windows are never resampled as independent observations. Use
10,000 deterministic seeded replicates. Report total-weighted and paired-median
savings, each window/class, intracluster correlation, effective sample size,
and two-sided 95% intervals. Activation uses the lower two-sided 95% bound.

## 8. Arm-blind quality gold and union adjudication

Before execution, freeze independently reviewed gold findings and deterministic
expected outcomes for every task. After execution, form the candidate universe
as the union of:

- frozen gold findings;
- findings detected by any arm;
- deterministic-check findings; and
- findings independently raised by either adjudicator.

Deduplicate by task-local semantic identity while volatile. No arm improves its
score by duplicate prose or by omitting a defect another arm found.

Two qualified reviewers independently receive fresh, isolated, read-only
sessions containing admitted task/candidate evidence with arm, provider, token,
latency, order, filename, formatting, and packet-size signals removed. Candidate
and response order are randomized. Reviewers cannot communicate and use a
frozen rubric.

For each candidate they label: real defect yes/no; fixed severity
`CRITICAL/HIGH/MEDIUM/LOW`; whether each anonymous response detected and
correctly resolved it; and evaluable yes/no. After both seal their labels:

- existence disagreement resolves to `real defect`;
- severity disagreement resolves to the higher severity;
- detection/resolution disagreement resolves to `not detected/not resolved`;
- evaluability disagreement resolves to `not evaluable`, a quality miss subject
  to the missingness gate; and
- exact agreement is accepted unchanged.

This fixed conservative procedure is arm-blind and has no discretionary
tie-breaker/owner override. Report agreement by class/severity. Reveal arm
mapping only after the final label ledger is sealed and hashed.

### 8.1 Ephemeral output-to-label security flow

Provider output enters a bounded volatile buffer owned by the admission broker.
Before review, the complete output passes the R2a scanner and closed parser. A
scanner/parser/persistence failure destroys the buffer, records only a permitted
generic incident code, stops external dispatch, and supplies no benchmark label.

For admitted output, an in-memory transformer creates randomized candidate and
response views. Review envelopes pass full `ProviderEnvelopeV1` admission and
contain only the admitted public/synthetic task, permitted response fragments,
and random per-review aliases. Review replies return to bounded volatile
buffers, undergo the same complete scan/closed parse, and reduce in memory to
closed labels.

Only these may persist: random non-linkable observation IDs; corpus task/rubric
IDs; closed defect class/severity; boolean detection/resolution/evaluable
labels; reviewer agreement/tie-rule code; and admitted ledger digests. Raw or
normalized response text, tool output, reviewer/candidate prose, prompts,
excerpts, token offsets, aliases, and rejected material never persist. Buffers,
mappings, temporary files, subprocess pipes, and reviewer sessions are
destroyed at terminal labeling.

Crash recovery restarts from sealed task/candidate IDs but cannot recover raw
output; the arm remains an intention-to-treat quality miss. Credential material,
real ECR data, credential-derived values, private tickets, and production user
data remain forbidden. No benchmark/review route may request credential reveal
or execution.

## 9. Activation and scoped claim gates

B3 qualifies only for its frozen cohort when all three complete windows pass:

1. **Security:** zero security/credential findings, admission bypasses, or
   secret-dependent persistent fields.
2. **Every-window floor:** each window's conservative intention-to-treat
   total-weighted logical-input reduction is at least 15%; pooling cannot hide
   a failing window.
3. **Pooled savings:** task-cluster-bootstrap lower two-sided 95% bound for
   pooled conservative reduction is at least 15%.
4. **Critical/high quality:** zero treatment-only missed critical/high defects
   in every task class and window.
5. **Per-class noninferiority:** in every prespecified class, the upper two-
   sided 95% bound for treatment-minus-control missed-defect rate is no more
   than +2 percentage points for medium/low findings. Each class passes alone.
6. **Determinism:** expected outcomes match except admitted full-context
   fallback, which remains charged to treatment.
7. **Other gates:** every missingness, session, cache, fallback, round, latency,
   and ratchet rule here and every unchanged stricter base rule passes.

There is no owner-benefit exception, discretionary waiver, confidence-score
substitution, or post hoc task/class/window deletion. A lower result may be
published as failed experiment, not activated or called qualified reduction.

The claim names the exact `BenchmarkConfigurationV1` digest, provider,
model/revision, envelope/adapter, reasoning/tool/cache settings, corpus classes,
window dates, endpoint, interval, missingness, and opt-in/default-on scope. It
says `raw logical input tokens`, not cost, latency, tool-output compaction, all
providers, all KStack workloads, or credential handling. Unincluded classes or
configurations receive no claim.

Default-on still needs the base document's two additional full passing windows
under the same frozen rules; they cannot repair a failed initial window.

## 10. Requalification boundary

Every provider/model/request-envelope configuration requires its own complete
three-window qualification. One-window transfer is prohibited. Requalification
is required after any change to provider, route, model/revision, reasoning,
usage schema/mapping, CLI/SDK/broker/adapter, envelope schema/rendering/wrappers,
system/developer/tool/history/attachment/response schema, tokenizer,
request/token limit, cache behavior/namespace/retention, tool policy, sampling,
retry/timeout/fallback, admission/security policy, packet closure algorithm, or
feature combination.

A changed configuration may reuse an admitted corpus/gold ledger only when
their digests and applicability are unchanged, but must execute every task/arm
across three new windows and repeat power/precision confirmation. Provider
aliases, “compatible” models, and version ranges inherit no claim.

## 11. Required deterministic evidence before paid qualification

- Terminal-ledger fault injection proves every call, fallback, retry, timeout,
  failure, reserved ordinal, and crash reaches exactly one terminal record.
- Usage fixtures prove disjoint cache write/read accounting, reconciliation,
  unknown/overflow rejection, and nullable unavailable fields per request type.
- Cache tests prove unique namespaces, no cross-arm sharing, symmetric in-arm
  preparation, and fresh session/history state.
- Frozen randomization replay reproduces task/arm/window order without exposing
  arm identity to adjudicators.
- Sample-size simulation and 10,000-replicate task-cluster bootstrap reproduce
  independently from sealed aggregate labels.
- Missing-data fixtures prove treatment-upper/control-lower bounds, lost-chain
  reservation, differential-missingness failure, and no complete-case activation.
- Gold-plus-union fixtures prove arm masking, two independent label seals,
  conservative ties, per-class noninferiority, and no raw persistent output.
- Security crash tests prove volatile output/reviewer buffers and aliases are
  absent after success, rejection, scanner failure, timeout, and process death.
- Claim generation rejects a failed window, pooled lower bound below 15%, any
  class quality failure, owner exception, or configuration mismatch.
- Requalification tests reject reuse after mutation of any section 10 field.

## 12. Open findings and self-assessment

Open implementation/qualification work:

1. Write and independently verify concrete provider field mappings against
   authenticated provider fixtures; this addendum defines the contract only.
2. Run an admitted pilot to determine variance, quality-event prevalence, and
   the resulting power/precision task count.
3. Build and qualify the volatile two-reviewer path under R2a; no current
   runtime is authorized to retain raw output for this benchmark.
4. Execute three new qualifying windows for every intended exact configuration.

- Design-readiness self-score: **96/100**.
- Independent reviewer score: **not run in this subtask**.
- Known unresolved design defects: **zero identified**.
- Open implementation/qualification items: **four, listed above**.

This score covers the benchmark contract only. It is not evidence of measured
token savings, activated slicing, provider qualification, or credential-store
safety.
