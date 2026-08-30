# Adaptive secondary-review policy candidate

**Thread:** `adaptive-secondary-review-policy-2026-08-28`  
**Item:** `adaptive-secondary-review-policy`  
**Status:** implemented and deterministically validated; independent closure review pending

## Decision to evaluate

Replace KStack's blanket rule that every material-design round invokes both
Codex and Opus. The primary actor should normally complete a bounded work unit
alone. A secondary model is consulted when an explicit, auditable trigger makes
independent reasoning valuable, not merely because another round began.

This changes review orchestration only. It does not grant either provider tool,
file, Git, deployment, credential, or external-system authority.

## Why the current rule is weak

Round count is not a risk signal. Mandatory two-provider dispatch on every
round adds latency, cost, provider availability coupling, and repeated review
of low-risk deltas. It can also reward procedural repetition instead of better
evidence. Conversely, a single high-risk change can require independent review
before any remediation round exists. KStack should route review according to
risk and uncertainty rather than conversation cadence.

## Proposed routing contract

The default route is `PRIMARY_ONLY`. A secondary review becomes `REQUESTED` or
`REQUIRED` only when one or more closed trigger codes apply:

- `OWNER_REQUESTED`: the owner explicitly asks for another model.
- `ROADBLOCK`: the primary actor records a concrete unresolved contradiction,
  failed approach, or missing expertise after bounded local investigation.
- `MATERIAL_UNCERTAINTY`: evidence leaves a decision below the configured
  confidence floor or with unresolved alternatives that could materially
  change implementation.
- `INDEPENDENT_FINAL_REVIEW`: a material design or implementation has reached
  its claimed final state and must be challenged once by a fresh agent that did
  not author the work before the item can close.
- `HIGH_RISK_BOUNDARY`: security, privacy, authentication, secret handling,
  signing, migration, deployment, destructive/irreversible action, authority,
  or public compatibility-contract work crosses its configured review gate.
- `MATERIAL_DISSENT`: existing evidence or review results disagree on a
  requirement, threat, or release decision.
- `AUDIT_SAMPLE`: a bounded, configured sampling policy selects otherwise
  primary-only work to detect systematic reviewer drift.

`INDEPENDENT_FINAL_REVIEW` is strongly recommended by the product default and
may be made required by protected project policy. For this KStack repository it
is required, but it runs once against the closure candidate rather than once per
iterative round. The primary actor must first publish a readiness result at or
above 93 with acceptance-criteria and verification evidence bound to the exact
candidate digest. A lower score cannot dispatch or consume the final review.

The reviewer uses fresh minimal context, receives that exact evidence digest
and acceptance criteria, and cannot be the implementing agent. Routine material
work requires agent independence when the project enables this gate;
`HIGH_RISK_BOUNDARY` additionally requires a different provider family unless
the owner explicitly changes that policy through the protected configuration
path. Other triggers may request one independent secondary reviewer earlier.
Repeated rounds do not create a trigger by themselves.

`ROADBLOCK` is a separate advisory route and may run before 93 when local work
has reached a concrete gridlock. A roadblock consultation cannot satisfy,
replace, pre-spend, or lower the later final-review gate.

## Required evidence

Before dispatch, KStack records a closed `SecondaryReviewDecisionV1` containing
the work-unit digest, phase, primary provider identity, trigger codes, risk
classification digest, required reviewer count, selected independent provider
identity, availability disposition, and decision timestamp. The decision must
be reproducible from protected configuration plus bound work evidence. A model
assertion alone cannot elevate, suppress, or satisfy a trigger.

Provider unavailability has an explicit result:

- `UNAVAILABLE_BLOCKING` when a required high-risk or owner-required gate cannot
  obtain an independent reviewer;
- `UNAVAILABLE_DEGRADED` when a requested advisory review cannot run and policy
  permits primary work to continue; or
- `NOT_TRIGGERED` when no secondary review was warranted.

KStack reports provider invocations, elapsed review time, trigger codes, and
whether the review changed a decision. This allows the policy to be evaluated
against quality, escaped defects, cost, and delay rather than assumed useful.
Material design is permanently high risk, so its advisory route also contains
a required high-risk trigger and unavailable review is blocking, not degraded.

## Acceptance criteria

1. Configuration supports trigger-based routing without weakening the existing
   mandatory high-risk review categories.
2. Ordinary implementation and low-risk design iteration can proceed with one
   primary provider. When project policy requires the final gate, completed
   material work cannot close until a readiness score of at least 93 is
   evidenced and one fresh, non-authoring agent reviews that exact candidate.
3. Roadblocks, material uncertainty, dissent, owner requests, completion gates,
   and audit samples deterministically select an independent reviewer.
4. The final reviewer cannot share the implementing agent identity or consume
   that agent's recommendation before issuing its own finding. High-risk review
   also cannot share the primary provider family.
5. Unavailability is fail-closed for required gates and explicitly degraded for
   permitted advisory gates.
6. Review artifacts bind the exact work-unit/evidence digest and record why a
   second provider was or was not invoked.
7. Tests cover every trigger, trigger combinations, agent/provider-identity
   aliasing, unavailable reviewers, configuration drift, replayed decisions,
   readiness scores below/at/above 93, roadblock-versus-final-review separation,
   final-review bypass attempts, and the invariant that round count alone never
   dispatches a secondary model.
8. Documentation, initialization prompts, design/QC skills, configuration
   validation, runners, and Jira tracking use the same routing semantics.
9. A measured synthetic shadow comparison against the legacy every-round policy
   records defect yield, decision changes, latency, and provider invocation
   count before the new default is promoted. For this repository, the owner's
   explicit direction to replace every-round dispatch accepts synthetic
   pre-promotion evidence; production observations remain required follow-up
   telemetry but are not a closure gate or a production-performance claim.

## Non-goals

- Treating Claude, Hermes, or OpenClaw as an authority source.
- Replacing deterministic tests or protected runtime gates with model votes.
- Selecting a secondary provider solely because it is installed.
- Removing independent review from high-risk release boundaries.

## Implementation evidence

`plugins/kstack/scripts/kstack-secondary-review-policy.mjs` now produces a
digest-bound `kstack-secondary-review-decision-v1` from the closed trigger set,
protected policy, work-unit/risk/configuration digests, measured-readiness
evidence, and independently resolved backend identity. Round number is retained
for audit but is never a trigger. Required unavailability blocks, permitted
ordinary advisory unavailability degrades, same-agent or same-execution-backend
selection fails closed, and high-risk review requires a different provider
family. Decision verification detects configuration drift, and an exclusive
durable output-directory consumption receipt rejects a second dispatch.
Provider-family identity is derived from a bounded version probe of the
resolved backend and bound by probe digest, not inferred from `codex` or `opus`
role labels. The staged runner re-verifies the complete decision immediately
before consumption, and the owner-visible design gate rebuilds it and validates
the exact on-disk consumption-receipt bytes.

The staged runner invokes this decision contract after a clean primary 93 and
before starting the independent final reviewer. Configuration validation locks
the final-review and high-risk independence controls on and requires the
`reviewSequence` compatibility thresholds to equal the authoritative
`secondaryReview` thresholds. Both blocks must be present together or both
omitted for explicit legacy mode. The test suite covers
each trigger, trigger combinations, the 93 boundary, early roadblock advice,
identity aliasing, availability, drift, replay, audit selection, and the fact
that rounds 1, 11, and 42 alone remain primary-only.

The same runner exposes a closed advisory route for owner requests, bounded
roadblocks, material uncertainty, and material dissent. Each route requires a
contained regular evidence file whose realpath the runner reopens and digests, requires a
distinct empty output directory, dispatches only the independent reviewer,
labels the placeholder primary readiness as unmeasured, and records that final
review remains unsatisfied. High-risk classification is combined automatically,
while audit sampling is derived from policy and cannot be caller-asserted.

The measured synthetic shadow evidence at
`.kstack/qualifications/adaptive-secondary-review-shadow-comparison-2026-08-30.json`
records seven legacy secondary invocations versus one triggered invocation,
while retaining four findings and one decision change in both routes. The
artifact explicitly records that the six avoided legacy calls were stipulated
zero-finding approvals, so equality is not evidence of equivalent defect yield.
It is a synthetic qualification, not a production cost or latency claim.

KStack conservatively and non-configurably classifies material design as `high`;
validation rejects downgrade to `ordinary`. The staged runner binds that
classification, the applicable and effective confidence tiers, resolved
executable and launcher digests, configured arguments/model, and availability
into the decision before dispatch. Consequently its high-risk
different-provider-family and required-unavailability branches are live rather
than nominal.

`SecondaryReviewDecisionLedger` still protects coordinators retaining one
decision object. The staged runner additionally creates
`.secondary-review-consumption.json` with exclusive-create semantics before
provider dispatch; any second process using that output directory fails closed.
The receipt hash covers its exact serialized bytes, and the design gate checks
its schema, decision/configuration/work digests, timestamp, and byte hash.
Replacement of an entire local evidence directory remains outside this
untrusted-local-files threat model.

## Closure disposition

Keep Jira closure pending until the exact implementation and evidence receive
the configured independent final review. Claude remains a roadblock/final
reviewer, not an every-iteration co-author, and reviewer completion grants no
repository or external-system authority.
