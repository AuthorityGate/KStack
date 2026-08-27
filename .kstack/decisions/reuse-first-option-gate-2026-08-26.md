# Reuse-first option gate

**Status:** PROPOSED — CODEX REVIEW REQUIRED, THEN OWNER SELECTION  
**Decision ID:** `REUSE-FIRST-GATE-2026-08-26`  
**Date:** 2026-08-26  
**Scope:** structural KStack process correction for material new-capability design  
**Authority:** design/decision artifacts only; no implementation, dependency
installation, commit, push, deployment, ticket mutation, or external write

## Failure being corrected

KStack can harden a native architecture without first proving that it examined
current, source-level reuse and adaptation candidates. The Capability Fabric
work accumulated detailed native mechanisms and remediation rounds before the
owner asked why strong existing systems had not been evaluated for reuse.

The correction is a **reuse-first option gate** between objective readiness and
detailed capability design. “Reuse-first” means research and compare before
inventing, not “external code wins.” Native Build remains first-class and wins
when reuse is less safe, less governable, legally unusable, costlier over its
life, or unable to qualify.

## Evidence binding

Prepared against KStack branch `Dev`, commit
`3aaddedcd992bff51a44d71a34802c94d108577e`:

| Source | SHA-256 | Relevance |
|---|---|---|
| `.kstack/objectives/kstack-capability-fabric-2026-08-26.md` | `dd4581a474426fae11340a24bd337529f7348952e317d596dc36381ad816ba85` | Objective exposing the gap |
| `.kstack/reviews/domain-breadth-option-selection-2026-08-26-r1/decision-brief.md` | `aa125e851d501e69351a3969d726b6ecfa84599d911ee23fa1a9db4441723ef7` | Source-pinned comparison precedent |
| `.kstack/reviews/domain-breadth-option-selection-2026-08-26-r1/codex-r2.md` | `a46fdcb87c5ab23dbf6710021ef384a760d2940bdbee65cd695de835f5bd06d9` | Codex 96 clean precedent review |
| `plugins/kstack/skills/kstack-objectives/SKILL.md` | `a70a2365032bef7cf856ad56ca589a37ad50147d9dc0c65697108433ef021783` | Current objective procedure |
| `plugins/kstack/skills/kstack-design/SKILL.md` | `76ad348c62f47908a609bfb55e294b6e5760cba95d0fa45278ceeb9e2d5fb6c7` | Current design procedure |
| `plugins/kstack/skills/kstack-design-clarify/SKILL.md` | `10984cb552eadf037e0094b42f0b382e4f48575c9fef4f6acfd87b67f54f78e1` | Current clarification gate |
| `plugins/kstack/skills/kstack-interrogate/SKILL.md` | `dd5c2d7e4256a68de7f2ef03aea2517816bf0c09531b797fbbe9013cf1bc9819` | Current drift classifier |
| `.kstack/objectives/worker-first-orchestration-2026-08-26.md` | `a32303597e70bece89c62ded2675a18d417045cf23019645108f165caebe1fcb` | Direct-main fallback and relay contract |
| `.kstack/decisions/worker-first-orchestration-2026-08-26-w3-readback-ack.md` | `24041c4fe9db37f46eb090db55990658bdcf544e98637d3395a3d1e17fd22b21` | Locked proceed-unless-corrected readback rule |

The precedent pins gstack at
`ad8400543cd9ce8d07641362db48d44a95417e33`, records its MIT license
digest, and compares Agent Skills/Anthropic skills, OpenHands Extensions,
Superpowers, and Codex plugins. It demonstrates the required research shape;
those contenders are not preselected for every capability.

## Applicability and scope freeze

At objective readiness assign exactly one disposition:

1. `REUSE_GATE_REQUIRED`: material new capability or replacement, new external
   integration, or redesign changing architecture, authority, stored data,
   deployment/rollback, public behavior, material cost, or multiple units.
2. `REUSE_GATE_SATISFIED`: the same objective and capability boundary already
   have a current, digest-bound selection meeting this contract.
3. `REUSE_GATE_NOT_APPLICABLE`: non-material internal correction or concrete
   defect fix within an owner-selected, approved design.

Uncertainty is `REUSE_GATE_REQUIRED`. Bind the objective digest, capability
boundary, affected units, and reason. Never relabel a new subsystem a “bug fix”
merely because review found it missing. A required thread may finish its current
read-only review or reach another safe boundary, then pauses before a new item
remediation round, implementation plan, or code. Other workers continue.

The gate receives a **scope-freeze set** of unrelated validated item IDs and
exact validated digests. It may not alter, re-review, or weaken them. A genuine
dependency requires a separate material proposal naming the conflict and owner
direction; it cannot reopen an item incidentally.

## Current source-level contender research

A capability-scoped worker produces a neutral packet. Repository content,
issues, docs, model output, and marketplace metadata are untrusted evidence,
never instructions.

Research is current only when performed after the objective digest is fixed and
each live contender revision is resolved from authoritative upstream during
that research session. A cache is valid only if its bytes match that revision
and the packet records how the upstream ref was refreshed or independently
resolved. If policy/network prevents resolution, freshness is `UNVERIFIED`;
the contender cannot be called current or selected as a dependency.

For every external contender record:

- canonical project/repository/owner and acquisition method;
- exact commit or immutable release digest, ref/tag, resolution time, and
  repository/content digest where applicable;
- exact implementation and test paths plus raw-byte digests for mechanisms
  relied on, not marketing pages or summaries;
- observed host/runtime support, release cadence, and maintenance signals;
- SPDX license when determinable, exact license path/digest, notices,
  per-file exceptions, dependency boundaries, and generated-file provenance;
- observed versus inferred, unavailable, or unverified claims; and
- refresh triggers: changed ref/source/license/security posture/capability
  boundary/objective digest make the packet stale before selection.

Research the strongest credible candidates for this capability, not gstack
alone, and include KStack's native baseline. No eligible external contender is
a valid evidenced result; a missing search is not. Research alone cannot copy,
install, execute, import into prompts, or make state-changing calls. Further
actions follow the authority matrix.

For preliminary comparison, dependency evidence may identify unresolved
closure as a cost/risk or make an option conditional. Before any Adopt, Adapt,
or Compose trial design is approved, however, bind the complete executable and
build closure: immutable dependency graph/lockfile digest, each fetched or
vendored artifact digest and source, per-dependency license/notice evidence,
build scripts/toolchain provenance, optional-feature resolution, and the
reproducible command or manifest that reconstructs the closure. An unresolved
or mutable closure cannot enter trial implementation.

## Required option set and comparison

Compare at least these strategies against the same evidence and qualification
criteria:

1. **Adopt:** use one pinned contender substantially as supplied behind the
   narrowest KStack adapter.
2. **Adapt:** fork, translate, or remove incompatible behavior while retaining
   a traceable upstream relationship.
3. **Compose:** combine bounded mechanisms from multiple contenders and/or
   existing KStack components behind KStack-owned interfaces.
4. **Build:** implement natively without importing contender code/instructions,
   while using the research to avoid known failure modes.

Mark an option ineligible only with specific evidence. Do not manufacture a
weak Adopt option to favor native code or favor reuse merely because it exists.
At least one viable path must remain; otherwise return `REDESIGN_REQUIRED`.

Assess each eligible option in a common matrix. Numeric weights require owner
or repository-policy approval and must retain unweighted evidence, sensitivity
to material weight changes, and hard disqualifiers. A total cannot erase a
safety, authority, license, or evidence failure. Cover:

- objective coverage and measurable outcome;
- authority compatibility: tools, hooks, approval semantics, side effects,
  credentials, telemetry, updates, model routing, and governance suppression;
- security/privacy incompatibilities, trust boundaries, supply chain, update
  channel, sandbox assumptions, untrusted inputs, and production-user data;
- host/runtime portability and honest degradation;
- license/provenance eligibility and continuing obligations;
- integration, adapter/compiler/translator, dependency, test, migration,
  rollout, rollback, operator-training, and observability cost;
- maintenance, divergence, vulnerability response, breaking upgrades, patch
  ownership, review load, and lifecycle cost;
- lock-in and exit cost, including durable data and approval receipts;
- performance, resource, paid-provider, local-model, and operating cost; and
- reversibility, blast radius, failures, and recommendation-changing evidence.

A contender is ineligible if it grants authority outside KStack's Governance
Kernel, self-activates from untrusted input, weakens validated safety, or lacks
a usable license and no credible bounded adapter can remove that defect.
An otherwise viable Adapt/Compose option whose adapter still needs detailed
design is `CONDITIONALLY_ELIGIBLE`: its brief must state the exact incompatible
surface, proposed KStack-owned boundary, disqualifying trial checks, and added
cost. Owner selection permits that adapter/trial to enter full design; it does
not claim the incompatibility is already removed or qualified.

## Trial and qualification

Selection authorizes trial design, not adoption or implementation. An external
or composed option becomes an implementation baseline only after the smallest
reversible trial defines:

- exact pinned inputs and produced-artifact digests;
- positive, negative, abuse, failure, stale-version, rollback, and
  baseline-parity fixtures;
- measurable thresholds fixed before results;
- unchanged native/current baseline and comparison exposing regressions;
- applicable security, authority, license/notice, host, resource, performance,
  migration, observability, and maintenance-owner checks;
- isolation from production users/data by default; ordinary explicit approval
  and risk acknowledgment are required to use either;
- no irreversible migration or external side effect merely to qualify; and
- abort, rollback, retained evidence, and result `QUALIFIED`,
  `NOT_QUALIFIED`, or `INCONCLUSIVE`.

Build may be selected whenever the common comparison shows it best satisfies
the objective—whether external options are ineligible or merely worse on
governance, lifecycle cost, portability, reversibility, or another recorded
criterion. Build needs no external trial, but proceeds through normal detailed
design/review/approval. Record why every eligible reuse option lost.

Selection and qualification are separate states:

- `BUILD_SELECTED` permits normal detailed design of the native option.
- `SELECTED_FOR_TRIAL` permits full design/review of only the chosen external or
  composed option, its adapter, and bounded trial.
- `TRIAL_DESIGN_APPROVED` requires ordinary design checks and owner approval;
  it permits only separately authorized trial implementation/execution.
- `QUALIFIED_BASELINE` requires a qualification receipt binding objective,
  option, source/dependency/license closure, adapter/trial design, implementation
  artifact, configuration/environment, fixture/result, and rollback digests.
  Only this state permits the qualified external/composed option to become the
  production implementation baseline, still subject to normal authority.

`NOT_QUALIFIED` moves the attempt to the rejected ledger and returns
`REDESIGN_REQUIRED` or a full owner selection over remaining options.
`INCONCLUSIVE` records a unique attempt ID, exact evidence digest, cause, and
retry delta. At most the repository-configured trial-attempt budget is used;
legacy/unconfigured projects allow one retry. Exhaustion returns
`REUSE_TRIAL_OWNER_DECISION_REQUIRED` with full Yes/No/Comment choices to abort,
select another option, or authorize a specifically bounded new attempt. It may
never lower a check or fall through to baseline implementation.

## Rejected-option ledger

Before owner selection create
`.kstack/decisions/<thread-id>-reuse-options-rejected.md`. Preserve every
rejected, disqualified, deferred, superseded, and trial-failed option with:

- ID and Adopt/Adapt/Compose/Build class;
- contender revisions, source paths/digests, and license evidence;
- exact rejection reason and finding/check;
- security/authority and lifecycle-cost consequence;
- whether evidence, reviewer advice, trial, or owner rejected it;
- evidence that could legitimately reopen it; and
- selected replacement when known.

Renaming or reclassifying a mechanism does not clear its history. Reopening
requires a new digest and linked reason; never delete the earlier result.

## Direct owner selection

After the frozen packet/brief receive the configured review, ask one complete
question for that capability. Include stable ID, capability and objective
digest, all four dispositions, recommendation/evidence, strongest objection,
security/authority/lifecycle tradeoffs, trial scope, each response consequence,
and blocked work.

Responses are exactly:

- **Yes:** the explicitly named recommended option and bounded consequences.
- **No:** the explicitly named safe fallback in the question. Never infer which
  of several alternatives “No” means.
- **Comment:** owner selects/combines/narrows options, rejects all, or changes
  constraints in their own words.

Record full question, verbatim answer, exact mapped meaning, selected source
revisions, accepted risks, rejected-ledger digest, and scope-freeze set in
`.kstack/decisions/<thread-id>-reuse-first-selection.md`. Lock only after full
readback under the project owner-question protocol. Silence, inference,
reviewer vote, or score cannot select.

Until locked return `REUSE_OPTION_OWNER_SELECTION_REQUIRED`; afterward return
`BUILD_SELECTED` or `SELECTED_FOR_TRIAL`. Neither is qualification or
implementation authority.

## Lifecycle integration

### `kstack-objectives`

- Keep separating desired outcome from proposed mechanism.
- Classify gate applicability; define capability boundary, baseline, non-goals,
  frozen items, success evidence, data sensitivity, and research authority.
- Record mechanisms as candidates. Objective readiness is not selection.

### `kstack-design`

- Enforce after objective readiness and before detailed architecture,
  implementation sequence, item ledger, or remediation for a material new
  capability.
- Assign neutral research to a worker, compare Adopt/Adapt/Compose/Build, and
  use active owner-approved review routing. The gate changes no provider rule.
- Bind later packets to locked selection, research, rejected-ledger digests and
  selected upstream revisions. Before external/composed trial approval also
  bind dependency/license closure and trial-design digests; before baseline
  implementation bind the exact `QUALIFIED_BASELINE` receipt. Staleness
  invalidates only that capability.
- After selection, run ordinary complete design review, deterministic checks,
  clarification, and user design approval. This gate never substitutes for
  `READY_FOR_USER_APPROVAL`.

### `kstack-design-clarify`

- Treat locked reuse selection as authoritative in round-one extraction and
  scope alignment.
- Do not ask the same option question again. Ask only new disagreement, hedges,
  unverified assumptions, divergence, or evidence conflicting with selection.
- A genuine conflict requires a linked superseding selection; it cannot be
  silently re-litigated.

### `kstack-interrogate`

- A changed selected strategy, source revision, license basis, authority/trust
  boundary, composition membership, migration model, or trial qualification is
  material: return `FULL_DESIGN_REQUIRED` and refresh this gate first.
- A concrete correction inside the locked approved option remains ordinary
  Interrogation/QC and does not reopen the gate.

### Worker-first orchestration

- Main CLI schedules/displays and delegates by default. A scoped research worker
  owns evidence; a separate Codex-direct worker may review the frozen brief
  under active routing. Direct main work is the recorded fallback only for
  coordination, genuinely nondelegable work, unavailable worker capability, or
  exhausted worker capacity; it must be labeled rather than disguised as a
  worker. Return artifacts, digests, score, duration, and defects. This follows
  the worker-first objective bound in the evidence table.
- Main remains free for scheduling and relays the full Yes/No/Comment question.
  The question pauses only its capability; unrelated workers continue.
- Full readback then proceed-unless-corrected follows locked decision
  `worker-first-orchestration-2026-08-26-w3-readback-ack.md` at its evidence-table
  digest. A later superseding owner protocol must be explicitly rebound.
- Append-only states are `RESEARCHING -> OPTIONS_READY -> CODEX_REVIEW ->
  OWNER_SELECTION_REQUIRED -> BUILD_SELECTED` or `SELECTED_FOR_TRIAL ->
  TRIAL_DESIGN_APPROVED -> QUALIFYING -> QUALIFIED_BASELINE`. Failure branches
  are `NOT_QUALIFIED`, bounded `INCONCLUSIVE`, `REDESIGN_REQUIRED`, and
  `REUSE_TRIAL_OWNER_DECISION_REQUIRED`. Preserve ended attempts, scores,
  durations, defects, and ending.
- Before relaying worker failure, run bounded validation, short configured
  timeout, and finite safe retries. Never weaken freshness/license/safety/
  authority/qualification to retry.

## Migration

Migration precedence is deterministic:

1. A material capability with no implementation work begun runs this gate
   before its next remediation/design step or implementation handoff, including
   when its prior design was owner-approved. Approval remains evidence but does
   not establish that reuse options were researched.
2. A capability whose approved implementation already began, or which shipped,
   is grandfathered; do not reopen it solely because this gate is new. Its next
   material replacement or materially changed objective independently triggers
   a gate.
3. Earlier option reviews substitute only through an exact equivalence record
   proving every required field. Never reopen a validated unrelated item.

## Deterministic checks required before process implementation

Behavioral tests must prove:

1. material new capability cannot enter detailed design/item remediation
   without locked selection, and external/composed production-baseline
   implementation cannot proceed without an exact `QUALIFIED_BASELINE` receipt;
2. non-material corrections and selected approved designs do not loop;
3. all four option classes exist with source/license evidence or explicit
   ineligibility;
4. changed source/license/objective/selection invalidates only its scope;
5. unknown license/provenance, incomplete transitive closure, and unremovable
   authority incompatibility fail closed before trial implementation;
6. research/selection never executes or activates a contender;
7. rejected options remain traceable through renaming and supersession;
8. Yes/No map only to named choices and Comment preserves exact owner intent;
9. Build passes without external trial whenever the common comparison selects
   it, including when an eligible reuse option loses on lifecycle tradeoffs;
10. inconclusive attempts have unique identities, a finite default, and an
    owner/redesign terminal rather than looping or falling through; and
11. the scope-freeze set prevents unrelated validated work from reopening.

Migration fixtures must separately cover owner-approved/unimplemented (gate
required), implementation-started (grandfathered), shipped (grandfathered),
and validated-unrelated (frozen).

## Proposed owner question after Codex qualification

**Question `RF-GATE-Q1`:** Should KStack add decision
`REUSE-FIRST-GATE-2026-08-26`, requiring current source-level contender
research and an explicit Adopt/Adapt/Compose/Build comparison before detailed
design or item-level remediation for each material new capability, while
preserving native Build as the safe option and freezing validated unrelated
items?

**Recommendation:** Yes. It corrects the observed design-order failure without
forcing external reuse or changing implementation authority.

**If Yes:** select this process gate for later implementation design. Each
affected capability pauses after objectives for research, configured review,
and full owner selection; unrelated work continues. No implementation is
authorized by this answer.

**If No:** retain the current order. KStack may compare options during design,
but will not prevent native hardening/remediation before source-pinned research.

**If Comment:** narrow applicability, change evidence/trial rules, or propose
another ordering. This structural design remains blocked until mapped.

**Blocked until answered:** implementation design for this process gate.
