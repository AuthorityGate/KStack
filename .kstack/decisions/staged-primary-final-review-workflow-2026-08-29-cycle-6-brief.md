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

Two review cycles have now assessed this workflow. The first rejected it for
having a repair loop with no guaranteed observable delta and several guarantees
broader than their evidence. The second accepted the shape of those repairs and
found two of them incomplete: the chain that proves a repair cycle follows its
predecessor was unauthenticated, and the confidentiality argument for the
independent final review bounded one channel while leaving others unnamed. This
cycle closes both. The review question is whether the chain is now
unforgeable by construction and whether every disclosure channel is either
bounded or explicitly placed outside the boundary.

## Architecture decision

Keep the ordered primary-then-independent-final protocol and the convergence
contract around each repair cycle. Make chain membership provable from
artifacts rather than asserted by the operator, and replace the single-channel
confidentiality argument with an enumerated boundary that names what it does
not cover.

For chain membership the alternative considered and rejected was a second
operator-supplied identifier naming the objective alongside the thread. It is
one more field to assert and one more field to get wrong, and an operator who
would point at the wrong manifest would equally supply the wrong identifier. The
chosen approach derives objective identity from the artifacts instead: a
manifest already records the digest of the exact brief it reviewed, so
presenting that brief proves which design the manifest judged, and the brief
already states its objective. Identity then rests on a hash rather than on a
claim.

For the disclosure boundary the alternative considered and rejected was to
assert that no channel carries the primary report because none is designed to.
That is the reasoning the prior review correctly refused. The chosen approach
enumerates the channels out of the runner, bounds each one, verifies the bound
from inside the provider process rather than from the runner's own point of
view, and names the two channels that remain outside.

## Architecture blocks

### BLK-CHAIN: Prove chain membership from artifacts

Outcome: A repair cycle can only follow the cycle it actually follows.
Boundary: Owns chain identity and sequence; owns no reviewer content, no threshold, and no approval authority.
Depends on: none
Acceptance intent: A chained cycle is admitted only when the presented prior brief hashes to the digest the prior result recorded, that brief states the same objective as the current one, the named thread agrees wherever the prior result names one, and the prior cycle number is exactly one less; a prior result carrying no cycle accounting cannot be chained at all.

### BLK-CONVERGENCE: Guarantee an observable delta per repair cycle

Outcome: A cycle cannot re-present the same design to the final reviewer after a rejection.
Boundary: Owns cycle-position declaration and brief-delta enforcement; owns no reviewer content and no threshold.
Depends on: BLK-CHAIN
Acceptance intent: Every cycle declares exactly one of a first-cycle position or a chained prior cycle, and a brief whose digest equals the digest a prior cycle did not approve stops before any provider is dispatched.

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

### BLK-DISCLOSURE: Enumerate and bound the channels out of the runner

Outcome: The independent reviewer's isolation rests on named, verified bounds rather than on absence of intent.
Boundary: Owns the runner's own outbound channels to a provider process; owns nothing inside a provider or between a provider and its own service.
Depends on: none
Acceptance intent: Every channel the runner controls into the final provider process — its arguments, its environment, its inherited handles, its scratch storage, and the shared directory — is bounded and verified by observation from inside that process rather than from the runner, a dispatch carrying primary report content on any of them fails before the process starts, and the channels that remain outside the boundary are named rather than implied.

### BLK-CUSTODY: State the real controls and their limits

Outcome: The controls that are maintained and tested are the controls that actually carry the property.
Boundary: Owns provider isolation attribution, credential scoping, owner liveness, and evidence disclosure; owns no signing authority.
Depends on: BLK-DISCLOSURE
Acceptance intent: Isolation of the final provider from the primary report is attributed to ordering and tool disablement rather than to file permissions, each provider child receives only its own provider credential, a recycled owner identifier cannot wedge a directory permanently and has a stated recovery, and the unsigned local evidence set is disclosed as an accepted limit.

## Cross-block contracts

BLK-CHAIN decides whether a cycle belongs to this thread at all;
BLK-CONVERGENCE then decides whether it may start, and BLK-FEEDBACK what a
started cycle must contain. All three run before any provider is dispatched, so
a cycle that violates any of them costs zero invocations. BLK-BUDGET charges the
cycle that BLK-CHAIN admitted, and the cycle number BLK-BUDGET records is the
same number the next cycle's BLK-CHAIN check reads, so accounting and sequence
cannot disagree. BLK-READINESS extends the existing primary readiness predicate
rather than replacing it, and its result is recorded in the readiness evidence
the deterministic gate already reproduces. BLK-PLATFORM runs before all of them
and before the single-flight lock, so an unsupported host produces no partial
evidence. BLK-DISCLOSURE bounds the runner's outbound channels and BLK-CUSTODY
describes what those bounds do and do not establish; neither asserts a property
BLK-PLATFORM has not admitted.

## Verification and recovery intent

Each block is verified by deterministic tests that observe the fail-closed path,
not only the passing one. For chain membership: a prior result with no cycle
accounting, a prior brief altered after the fact, a prior cycle from a different
objective, one from a different thread, a skipped cycle number, and a missing or
malformed thread name. For convergence and feedback: a repeated brief, a changed
brief with and without carried feedback, and an undeclared or doubly declared
position. For disclosure: the final provider's own view of its arguments, its
environment, its scratch directory, and its open handles, observed from inside
that process, plus the boundary predicate rejecting report content directly. The
remaining blocks retain the coverage established in the prior cycle.

Recovery is by explicit operator action in every failure mode. A blocked cycle
names why it blocked and consumes no invocation. A wedged single-flight owner
has a stated confirm-then-remove procedure. An exhausted budget returns the
decision to the owner rather than extending itself. Enabling this workflow over
existing evidence is a recorded cutover with a per-thread disposition.

## Prior final review feedback

The prior cycle did not reach independent final review: the primary readiness
gate held it, which is the protocol working as designed. Its findings and this
design's answers:

- The chain admitted any prior result whose brief differed, without proving that
  result belonged to the same objective and thread or immediately preceded this
  cycle, so an unrelated or older result could satisfy the contract. BLK-CHAIN
  now derives objective identity from the prior brief through the digest the
  prior result already recorded, matches the thread wherever the prior result
  names one, and requires the immediately preceding cycle number.
- The feedback requirement demanded that a record exist without defining its
  derivation, so an incomplete paraphrase could satisfy it. This is narrowed
  rather than closed: completeness of a natural-language record is asserted by
  the operator and read by the final reviewer, which is where it can actually be
  judged. The mechanism guarantees the section is present and the brief changed;
  it does not guarantee the section is faithful, and that limit is now stated
  rather than implied.
- Final-review isolation was argued from one observation of the shared
  directory, leaving arguments, environment, inherited handles, and scratch
  storage unbounded. BLK-DISCLOSURE enumerates and bounds each, verifies them
  from inside the provider process, and names the two channels that stay
  outside: the home directory shared between providers, bounded by the
  ephemeral and sessionless provider configuration rather than by the runner,
  and whatever a provider transmits to its own service.
- Credential isolation was proven only against the other provider's named
  variable. The negative check remains that narrow by construction; the shared
  home directory is now named as the reason it cannot be broader, so the stated
  property matches the evidence.
- The narrative-consistency control promised an absolute outcome while
  describing itself as a heuristic, and specified only a false-positive posture.
  Its outcome is now stated as fail-closed routing on a bounded lexicon, with
  both postures explicit: it can fire on a negated mention, and it cannot see a
  concern phrased outside the lexicon.
- The platform block did not enumerate the primitives admission depends on.
  Those primitives are now named: link-safe reopening, ownership and mode
  semantics at rest, process-group termination, and directory durability.
- The cutover fallback had no stated bound or authority. It is bounded to
  finishing a single thread already mid-implementation, and its use is recorded
  as a decision rather than left as an open option.
- The unsigned evidence set remains unsigned. This is recorded as an owner-level
  residual risk with no compensating control claimed, not as a resolved finding.

Two proposals from the first review remain declined, with reasons recorded in
the decision: making the dispatch predicate severity-aware, which would change
an owner-set gate rather than fix a defect in this design, and signing the local
evidence set, for which no precedent exists at this scope. The central tradeoff
both reviews named — that concentrating the second perspective in one terminal
pass removes cross-model coverage from the cycles where defects are introduced —
is accepted and stated rather than left implicit, and remains an owner decision.

## Deferred to block refinement

Exact option names, status identifiers, lexicon contents, digest windows, file
layout, test invocations, and the sequencing of the cutover enumeration are
deferred. Which repository threads are in flight at cutover is an operational
determination made when the cutover runs, not a design-time constant.

## Backlog handoff

Materialize the eight blocks as dependency-linked work items under KSTK-103,
with BLK-CONVERGENCE sequenced after BLK-CHAIN, BLK-FEEDBACK after
BLK-CONVERGENCE, BLK-CUSTODY after BLK-DISCLOSURE, and the remaining four
independent. The cutover enumeration stays a separate operational item bound to
the same objective, because it is executed once against live repository state
rather than delivered as a mechanism.
