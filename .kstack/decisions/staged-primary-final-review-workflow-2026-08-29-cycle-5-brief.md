KSTACK-DESIGN-10K-V1
Altitude: 10000
Implementation-ready: no
Objective-brief: KSTK-103 prevent staged review loops from abandoning accepted high-water designs
Objective-digest: 7352e5ea7e05c308ba57277ce0ec28666e7c3f02674879875abc43a74c43c3ce

## Objective trace

KStack replaces routine simultaneous two-agent design review with an ordered
workflow. One primary agent owns improvement until the work is genuinely ready,
then exactly one different agent performs an independent final review of the
same neutral decision brief. The objective is to spend one fewer agent
invocation per improvement cycle without weakening the fail-closed evidence and
authority boundaries that gate design approval.

An earlier final review of this workflow accepted the ordering logic and
rejected the design as written, because the repair loop it defines has no
guaranteed observable delta, no defined return path for a rejected final
review's findings, and several stated guarantees that were broader than the
evidence supporting them. This cycle answers those findings. The review question
is whether the workflow now converges, and whether every property it claims is a
property it actually has.

## Architecture decision

Keep the ordered primary-then-independent-final protocol. Add a convergence
contract around each repair cycle, make the feedback path explicit and
one-directional, charge the budget in cycles rather than invocations, narrow
every custody guarantee to the platform where it holds, and close the gap
between a report's structured findings and its prose.

The alternative considered and rejected was to make the final reviewer stateful
across cycles, letting it recall its own prior objection. That would give the
repair loop a delta for free, but it makes the final review a running
conversation with the primary's work rather than an independent assessment of
the current design, and it makes each final result depend on invocation order
rather than on the design under review. Carrying the findings in the brief keeps
the reviewer stateless and puts the delta in the artifact both roles see.

A second alternative, extending the budget when a cycle is rejected, was
rejected because it treats the symptom. A loop that cannot converge should stop
and return to the owner, not run longer.

## Architecture blocks

### BLK-CONVERGENCE: Guarantee an observable delta per repair cycle

Outcome: A cycle cannot re-present the same design to the final reviewer after a rejection.
Boundary: Owns cycle-position declaration and brief-delta enforcement; owns no reviewer content and no threshold.
Depends on: none
Acceptance intent: Every cycle declares exactly one of a first-cycle position or a prior staged manifest, and a brief whose digest equals the digest a prior cycle did not approve stops before any provider is dispatched.

### BLK-FEEDBACK: Return rejected final findings to the primary

Outcome: The primary repairs against what the final review actually found.
Boundary: Owns the carriage of findings as brief content; carries no reviewer report, confidence value, or verdict across roles.
Depends on: BLK-CONVERGENCE
Acceptance intent: After a rejected cycle the repaired brief must record the prior findings and how the design answers them, and a re-invoked final reviewer remains stateless with respect to its own prior review.

### BLK-BUDGET: Charge the material-design budget in cycles

Outcome: An operator can state before starting whether a cycle is affordable.
Boundary: Owns budget accounting and exhaustion; owns no threshold and no approval authority.
Depends on: none
Acceptance intent: One staged cycle costs one budgeted cycle whether or not the final reviewer was dispatched, provider invocations are reported separately, and a cycle beyond the budget dispatches nobody.

### BLK-PLATFORM: Bound every custody claim to where it holds

Outcome: No guarantee is asserted on a host that cannot provide it.
Boundary: Owns platform admission and the stated scope of custody properties; owns no provider behavior.
Depends on: none
Acceptance intent: An unsupported host is refused before the output directory is locked and before any invocation is spent, and the stated confidentiality, containment, and link-safety properties are expressed only in the semantics of the supported platform.

### BLK-READINESS: Close the structured-versus-prose gap

Outcome: A report cannot pass the readiness gate while describing a defect in prose.
Boundary: Owns the consistency check between a report's narrative fields and its structured findings; owns no threshold and cannot lower one.
Depends on: none
Acceptance intent: A report claiming approval with empty finding arrays whose narrative still asserts an unresolved defect is routed back to the primary, the deterministic gate reproduces that routing, and the control is documented as a heuristic with a stated false-positive posture.

### BLK-CUSTODY: State the real controls and their limits

Outcome: The controls that are maintained and tested are the controls that actually carry the property.
Boundary: Owns provider isolation, credential scoping, owner liveness, and evidence disclosure; owns no signing authority.
Depends on: none
Acceptance intent: Isolation of the final provider from the primary report is attributed to ordering and tool disablement rather than to file permissions and is asserted by observing the review directory from inside the final provider, each provider child receives only its own provider credential, a recycled owner identifier cannot wedge a directory permanently and has a stated recovery, and the unsigned local evidence set is disclosed as an accepted limit.

## Cross-block contracts

BLK-CONVERGENCE decides whether a cycle may start; BLK-FEEDBACK decides what a
started cycle must contain. Both run before any provider is dispatched, so a
cycle that violates either costs zero invocations. BLK-BUDGET charges the cycle
that BLK-CONVERGENCE admitted, so the budget and the convergence chain count the
same events. BLK-READINESS extends the existing primary readiness predicate
rather than replacing it, and its result is recorded in the same readiness
evidence the deterministic gate already reproduces. BLK-PLATFORM runs before all
of them and before the single-flight lock, so an unsupported host produces no
partial evidence. BLK-CUSTODY constrains how every other block's evidence may be
described, and asserts no property that BLK-PLATFORM has not admitted.

## Verification and recovery intent

Each block is verified by deterministic tests that observe the fail-closed path,
not only the passing one: a repeated brief, a changed brief with and without
carried feedback, an undeclared and a doubly declared cycle position, evidence
that is malformed or escapes the project, an exhausted budget, a cycle charged
with and without a dispatched final reviewer, a structurally clean report whose
narrative asserts a defect, the deterministic gate's independent reproduction of
the new checks, a provider child probed for the other provider's credential, the
review directory observed from inside the final provider process, a recycled
owner identifier, a live owner, and an unsupported host.

Recovery is by explicit operator action in every failure mode. A blocked cycle
names why it blocked and consumes no invocation. A wedged single-flight owner
has a stated confirm-then-remove procedure. An exhausted budget returns the
decision to the owner rather than extending itself. Enabling this workflow over
existing evidence is a recorded cutover with a per-thread disposition, not a
configuration edit.

## Prior final review feedback

The prior cycle's independent final review did not approve this workflow as
written. Its findings and this design's answers:

- No convergence constraint forced the brief to change between a rejected final
  review and the next final dispatch, so a stateless reviewer could be handed
  byte-identical input. BLK-CONVERGENCE now requires a declared cycle position
  and a changed brief, and blocks before dispatch otherwise. The constraint is
  scoped to a cycle the final reviewer actually judged, so that an identical
  retry after a provider failure remains correct.
- No feedback path was defined from a rejected final review back to the primary.
  BLK-FEEDBACK defines the repaired brief as the only path and requires it to
  record what was found and how the design changed.
- Cycle-budget accounting was undefined for a staged round. BLK-BUDGET charges
  one cycle per staged cycle regardless of whether the final reviewer ran, and
  reports invocations separately.
- Confidentiality and containment were claimed in POSIX terms on a repository
  that appeared to support other platforms, with platform-limited evidence.
  BLK-PLATFORM refuses an unsupported host outright rather than claiming an
  unproven parity or a vague weaker guarantee.
- No migration or re-review procedure existed for work already in flight when
  this workflow is enabled. The cutover is now a recorded enumeration with a
  per-thread disposition and a bounded temporary fallback.
- The readiness predicate read structured fields only, so a concern could hide
  in prose while the arrays stayed empty. BLK-READINESS adds a reproduced
  consistency check, documented as a heuristic rather than a guarantee.
- File permissions were credited with isolating the final provider from the
  primary report, which they cannot do between processes of one user. The
  property is now attributed to deletion ordering and tool disablement, which
  are the controls that are tested.
- Per-provider credential scoping was asserted but unproven, and the local
  evidence set is unsigned. Scoping is now asserted negatively per provider; the
  unsigned evidence set is disclosed as an accepted limit rather than presented
  as a guarantee.
- Owner liveness rested on a recorded process identifier alone, which a recycled
  identifier could wedge permanently. Liveness now also compares the recorded
  owner command line where it is observable, and a recovery procedure is stated.

Two proposals from that review are declined rather than deferred, with reasons
recorded in the decision: making the dispatch predicate severity-aware, which
would change an owner-set gate rather than fix a defect in this design, and
signing the local evidence set, for which no precedent exists at this scope. The
central tradeoff the review named — that concentrating the second perspective in
one terminal pass removes cross-model coverage from the cycles where defects are
introduced — is accepted and now stated explicitly rather than left implicit.

## Deferred to block refinement

Exact option names, status identifiers, lexicon contents, file layout, test
invocations, and the sequencing of the cutover enumeration are deferred. The
choice of which repository threads are in flight at cutover is an operational
determination made when the cutover runs, not a design-time constant.

## Backlog handoff

Materialize the six blocks as dependency-linked work items under KSTK-103, with
BLK-FEEDBACK sequenced after BLK-CONVERGENCE and the remaining four
independent. The cutover enumeration is a separate operational item bound to the
same objective, because it is executed once against live repository state rather
than delivered as a mechanism.
