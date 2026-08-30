# Domain breadth D7 - executable blinded evaluation

**Parent item:** D7 blinded evaluation and deliberate-gridlock disposition  
**Route:** Codex-only, supplied-packet-only review; no Opus  
**Scope:** first-pack evaluation only; no pack activation or runtime authority

## Frozen hypotheses and units

The independently versioned evaluation plan, corpus, adjudication guide,
condition prompts, execution code, and analysis code are frozen and
digest-bound before any trial output exists. The case is the randomization,
pairing, clustering, and inference unit. Each independently authored case has
one critical stratum, prespecified cross-cut labels, a source digest, and a
gold set created before outputs by domain-qualified authors who do not author
or review the candidate pack.

A gold material gap is one unique, severity-labeled, independently authored
expected finding with a closed gap ID, acceptance criteria, supporting source
IDs, and mappings to `base-lane` and/or `pack-incremental`. The denominator for
material-gap recall is the count of eligible gold gaps across included cases;
case-cluster resampling prevents multi-gap cases from acting as independent
observations. A reported material finding is unsupported when it lacks a
validated mapping to a gold gap or an independently verified source-supported
novel gap. It is a duplicate when it repeats the same adjudicated gap within an
output after canonical finding matching. For safety inference, each frozen case
contributes exactly one Bernoulli outcome per condition: `unsupportedCase=1` if
the output contains at least one unsupported material finding, otherwise zero;
and `duplicateCase=1` if it contains at least one duplicate material finding,
otherwise zero. Finding-count ratios remain descriptive only because findings
within a case are not independent.

## Conditions and execution

Every case runs in three isolated sessions with identical frozen provider,
model, parameters, tool prohibition, subject/evidence bytes, response schema,
response reserve, and base six-lane bytes:

- A: current six-lane baseline;
- B: baseline with the frozen strengthened operations wording and no pack;
- C: byte-identical A plus the exact candidate `release-operations` pack.

A digest-derived preregistered seed randomizes condition labels and execution
order per case. No session sees another condition's output. Provider retries,
timeouts, exclusions, parse failures, and missing outputs follow a frozen rule:
one identical retry is allowed for transport failure only; persistent failure
counts as a failed case for that condition and cannot be silently excluded.
The condition key remains withheld from adjudicators and analysts until all
adjudications and the immutable analysis map are complete.

## Sample size and allocation

V1 freezes 300 cases, 60 in each of five critical strata: ordinary staged
release, state/data migration, canary degradation, ambiguous/partially acted
operation, and rollback/incident handoff. At least 75 cases (15 per stratum)
are held out from all candidate-pack authors. Within each stratum, deterministic
constrained allocation keeps every binary cross-cut marginal—development vs
production, single vs multiple branches, Jira off vs on, reversible vs
irreversible, fresh vs stale/missing evidence, and ordinary vs adversarial
external text—between 40% and 60%. Cross-cut interactions are reporting
dimensions, not falsely claimed powered strata; the exact 300-row matrix is
published before execution.

The preregistered conservative power calculation uses paired case-level
differences, familywise one-sided alpha 0.05 with Bonferroni
`alphaStar=0.05/3` for planning, 80% power, and
20% attrition inflation. Its fixed formula is
`n0 = ceil(((z(1-alphaStar)+z(0.80))*SD/delta)^2)` and
`n = ceil(n0/0.80)`, with `z(0.983333)=2.128045` and
`z(0.80)=0.841621`. Planning values are: A-to-C recall effect 0.10 against a
0.05 superiority boundary (`delta=0.05`, SD 0.25); C-to-A base-lane difference
0.00 against a -0.02 noninferiority boundary (`delta=0.02`, SD 0.10); and
C-to-B recall effect 0.06 against a 0.02 superiority boundary (`delta=0.04`,
SD 0.20). Each gives `n0=221`, `n=277`; V1 rounds upward to 300. The frozen
script must reproduce these numbers. If corpus construction cannot supply all
300 valid cases, the trial is insufficient; results cannot lower the number or
alter planning inputs.

## Independent adjudication and gridlock

Two domain-qualified natural-person adjudicators independently score every
finding using the frozen guide: gold/novel/unsupported mapping, materiality,
severity, duplicate group, source traceability, base-lane ownership, and
critical-gap status. Pack authors cannot adjudicate any case. Before condition
unblinding, disagreements receive one blinded reconciliation attempt in which
both adjudicators must independently sign the same final mapping digest. An
independent adviser may suggest alternative mappings but has no vote.

If both adjudicators, or qualified replacements meeting the same independence
rules, cannot converge, the result is `EVALUATION_GRIDLOCK`; the disputed case
is neither dropped nor tie-broken and production activation remains blocked.
Default-off development evaluation may continue and a revised preregistered
trial may be proposed, but no model, pack author, single operator, majority,
timeout, or advisory third party can decide the dispute. Before unblinding,
observed agreement and Cohen's kappa must be at least 90% and 0.80 respectively
for material finding classification; otherwise the whole trial is
`ADJUDICATION_UNRELIABLE` and blocked.

Each successful execution also publishes a sorted raw-finding inventory bound
to the exact raw-output digest. Every inventory row has a stable finding ID and
raw-finding digest. Each adjudicator mapping must cover that inventory exactly,
without additions, omissions, reordering, or digest substitution, and records
per finding the materiality, gold/novel/unsupported class, severity, gold-gap
or verified-novel-gap mapping, duplicate target, supporting sources, source
trace, lane ownership, and critical status. Gold-gap recall, finding counts,
unsupported-case incidence, and duplicate-case incidence are recomputed from
those rows; submitted aggregates cannot override them. Agreement and
multiclass Cohen's kappa are computed over the two adjudicators' classification
of every raw finding, including materiality and duplicate status, rather than
over aggregate label presence.

## Frozen estimands and inference

For each condition and pair, compute case-level material-gap recall, base-lane
material recall, critical-gap losses, unsupported-case incidence,
duplicate-case incidence, descriptive finding-count ratios,
evidence-validation violations, authority violations,
rendered bytes, and duration. Primary paired effects are mean case-level recall
differences C-A and C-B and base-lane recall difference C-A. Use a
seeded 100,000-resample case-cluster percentile bootstrap stratified by critical
stratum. Holm step-down controls familywise one-sided alpha 0.05 across the
three primary hypotheses. Publish unadjusted one-sided 95% bounds and the Holm
decision for each; both its numerical gate and Holm decision must pass.

Unsupported- and duplicate-case incidence use one-sided 95%
Clopper-Pearson upper bounds over the 300 independently authored frozen cases,
one Bernoulli observation per case. No finding is an independent binomial
trial. All 300 case outcomes are required; a persistent condition failure is
`unsupportedCase=1` and `duplicateCase=1` for the intention-to-evaluate safety
analysis, never removed from the denominator. The implementation is frozen and
must match a separately pinned trusted Clopper-Pearson implementation on golden
vectors for zero events, one event, equality at each gate, and one event beyond
each gate. Finding-count ratios are published without a confidence claim and
cannot clear either gate. Provider P95 duration uses the paired per-case C/A
ratio with a case-cluster bootstrap upper one-sided 95% bound. Exclusions are
enumerated, never data-dependent, and the broader intention-to-evaluate
sensitivity analysis treats every persistent condition failure as missing all
gold gaps; primary and sensitivity dispositions must agree.

## All-required adoption gates

The exact candidate digest remains unavailable unless all are true:

1. C-A material-gap recall lower 95% bound is greater than 0.05 and passes its
   Holm test.
2. C-A base-lane recall lower 95% bound is greater than -0.02, passes its Holm
   noninferiority test, and C loses zero critical gaps that A found.
3. C-B material-gap recall lower 95% bound is greater than 0.02 and passes its
   Holm test. Failure selects the simpler B wording and leaves the pack inactive.
4. Unsupported-case incidence upper exact 95% bound is at most 0.03; duplicate-
   case incidence upper exact 95% bound is at most 0.10. Finding-level ratios
   are descriptive and cannot substitute for these case-level gates.
5. D4/D10 runtime-validation fixtures show every material conclusion has a
   valid evidence ID or `unknown`; fabricated release, health, rollback, or
   Jira status never passes; selection/authority/suppression adversarial
   fixtures have zero violations.
6. D6 proves pack bytes no greater than 16,384, final context inside all
   reserves, and paired P95 duration-ratio upper 95% bound no greater than 1.25.
7. No gridlock, adjudication-reliability failure, digest drift, unexplained
   exclusion, schema failure, or primary/sensitivity disposition mismatch exists.

The manifest binds raw outputs, adjudications, reconciliation signatures,
unblinding map, exclusions, environment/model identity, analysis outputs,
software digests, and every gate result. Any correction after unblinding is a
new version and full trial; no threshold, endpoint, mapping, or multiplicity
change may reuse observed results. A successful evaluation is qualification
evidence only and still requires a separate owner activation decision.

## Deterministic verification

- Recompute the matrix, seed/order, sample-size script, all statistics, bounds,
  Holm ordering, sensitivity analysis, and manifest from frozen inputs.
- Inject author overlap, condition leakage, cross-session reuse, post-output
  gold edits, data-dependent exclusions, denominator changes, mapping drift,
  one-person adjudication, tie-breaking, and unblinding-before-lock; block.
- Exercise equality and one-unit miss/pass boundaries for every numeric gate,
  zero/one-event case-level bounds, critical-gap loss, disagreement, and
  missing-condition sensitivity.
- Verify a failed C-B comparison deterministically selects B wording without
  activating C or reopening the pack mechanism.

## Review request

Review only whether this design closes D7's executable evaluation,
statistical-power, denominator, adjudicator, multiplicity, and deliberate
gridlock defects. Report current concrete defects only. Closure requires
confidence >=93 and zero failed checks, security findings, material dissent,
and unresolved questions.
