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

One part of the stated objective is deliberately not addressed here, and this
design does not claim otherwise. The originating ticket's headline requirement
is to prevent a review loop from abandoning a design that already reached an
accepted high-water mark: defining that baseline, recording it, and refusing to
regress below it. This cycle does not deliver it. The owner's decision is to
finish the mechanism plumbing first and take the high-water baseline as separate
work, so a reviewer should read that requirement as open and deferred by
decision rather than as satisfied. Everything below concerns the ordered review
mechanism the baseline would eventually be enforced by, not the baseline itself.

Four review cycles have assessed this workflow. The last found that the core
protocol was asserted narratively but owned by no block, that cross-run provider
state was bounded only by provider configuration, that budget charging had no
defined point, and that the verification account understated its own coverage.
This cycle gives the protocol an owning block, closes the cross-run channel with
a runner control and measures the result, defines the charge point, and states
the verification account accurately. The review question is whether the
mechanism is now sound on its own terms, given that the high-water requirement
is knowingly outstanding.

## Architecture decision

Keep the ordered primary-then-independent-final protocol, the convergence
contract, and the artifact-derived chain. Change four things: make the protocol
itself an owned block rather than an assumption every other block leans on,
convert cross-run state isolation from provider configuration into a runner
control whose effect is measured rather than assumed, derive the budget charge
from consumed capacity rather than from status, and state the verification and
trust accounts at their real strength.

For cross-run state the alternative considered and rejected was to relocate each
provider's configuration directory into the per-invocation work directory. That
appears stronger because it would make isolation structural rather than
behavioural, but it requires putting a live credential into the private copy,
which means either duplicating it per invocation or hard-linking it. Duplication
creates a new credential-handling surface for no gain, and linking fails outright
here because the configuration directory and the output directory are on
different filesystems on the supported host. The chosen approach keeps the real
configuration directory and closes the channel at the provider instead, with the
suppression flags named in one place and enforced as a precondition of spawning,
so a future edit that drops one fails closed rather than degrading silently.

That choice trades a structural guarantee for a behavioural one, so it is only
as good as its evidence. The evidence is direct measurement rather than vendor
documentation: a probe token carried in a real dispatched brief is present in the
delivered prompt and in the provider's own review of it, and absent from the
entire real configuration directory afterwards. The residual is stated plainly:
the result binds to the provider versions measured and must be re-measured when
a provider is upgraded, because it rests on provider behaviour rather than on a
property this runner can enforce alone.

For the budget, the alternative considered and rejected was to enumerate which
blocked outcomes are free. Enumeration is wrong because it silently mischarges
any status added later. The charge is derived instead from whether a provider
actually ran.

## Architecture blocks

### BLK-PROTOCOL: Own the ordered review contract itself

Outcome: The rule that defines this workflow is owned, stated, and checkable rather than assumed by the blocks that depend on it.
Boundary: Owns the release criterion, dispatch order, reviewer distinctness, brief identity across roles, and final authority; owns no platform admission, no channel bounding, and no budget accounting.
Depends on: none
Acceptance intent: The primary releases only on an approval decision at or above the configured readiness confidence with all four structured finding arrays empty; exactly one final reviewer is dispatched and it is a different agent from the primary; the final receives a brief whose digest is identical to the one the primary received and receives no part of the primary's report; and final acceptance is the final reviewer's own decision at or above its configured threshold, which no other block may raise, lower, or bypass.

### BLK-THREAD: Require thread identity on every cycle

Outcome: No cycle runs without naming the thread it belongs to.
Boundary: Owns the current cycle's identity requirement; owns nothing about what a prior result recorded.
Depends on: none
Acceptance intent: A missing or malformed thread name blocks before dispatch unconditionally, and the single allowance for a prior result that records no thread name is scoped to the prior side alone, exists only because results predating thread recording cannot carry one, and never relaxes the current cycle's requirement.

### BLK-CHAIN: Check chain membership against artifacts

Outcome: A repair cycle is admitted only against the cycle it claims to follow, to the strength unsigned local artifacts allow.
Boundary: Owns chain consistency and sequence; owns no authenticity claim, no reviewer content, no threshold, and no approval authority.
Depends on: BLK-PROTOCOL
Acceptance intent: A chained cycle is admitted only when the presented prior brief hashes to the digest the prior result recorded, that brief states the same objective as the current one, the named thread agrees wherever the prior result records one, and the prior cycle number is exactly one less; a prior result carrying no cycle accounting cannot be chained; and the property is stated as consistency between presented artifacts, never as authenticity of them.

### BLK-CONVERGENCE: Guarantee an observable delta per repair cycle

Outcome: A cycle cannot re-present the same design to the final reviewer after a rejection.
Boundary: Owns cycle-position declaration and brief-delta enforcement; owns no reviewer content and no threshold.
Depends on: BLK-CHAIN
Acceptance intent: Every cycle declares exactly one of a first-cycle position or a chained prior cycle, and a brief whose digest equals the digest a prior cycle did not approve stops before any provider is dispatched.

### BLK-FEEDBACK: Return rejected final findings to the primary

Outcome: The repaired brief carries the prior findings forward in the artifact both roles see.
Boundary: Owns presence of the record and the changed brief; owns no judgement of the record's completeness, and carries no reviewer report, confidence value, or verdict across roles.
Depends on: BLK-CONVERGENCE
Acceptance intent: After a rejected cycle the repaired brief must carry the prior findings and how the design answers them and must differ from the rejected brief; faithfulness of that record is asserted by the operator and assessed by the final reviewer reading it, not enforced by the mechanism, and the design says so rather than implying enforcement.

### BLK-BUDGET: Charge the material-design budget in cycles

Outcome: An operator can state before starting whether a cycle is affordable, and no cycle is charged for capacity it never used.
Boundary: Owns budget accounting and exhaustion; owns no threshold and no approval authority.
Depends on: BLK-CHAIN
Acceptance intent: The charge is derived from whether a provider was actually dispatched rather than from the outcome's status name, so every cycle blocked before the primary spawns costs zero and every cycle that reaches a provider costs exactly one whether or not the final was dispatched; provider invocations are reported separately from the cycle charge; a cycle beyond the budget dispatches nobody and is itself free; the deterministic gate recomputes the same relation and rejects evidence charging a count its invocation record does not support; and an interruption after dispatch, which writes no result at all, is stated as an operator-charged case rather than left implied.

### BLK-PLATFORM: Bound every custody claim to where it holds

Outcome: No guarantee is asserted on a host that cannot provide it.
Boundary: Owns platform admission and the stated scope of custody properties; owns no provider behavior.
Depends on: none
Acceptance intent: An unsupported host is refused before the output directory is locked and before any invocation is spent, and admission depends on named primitives — link-safe reopening, ownership and mode semantics at rest, process-group termination, and directory durability — rather than on an unqualified platform label.

### BLK-READINESS: Detect narrative defects the structured fields miss

Outcome: A bounded class of prose-only defects is caught that the counter-based predicate cannot see.
Boundary: Owns a lexicon-bounded consistency check between narrative fields and structured findings; owns no threshold, cannot lower one, and claims no completeness.
Depends on: BLK-PROTOCOL
Acceptance intent: A report claiming approval with empty finding arrays whose narrative matches the bounded lexicon is routed back to the primary, the deterministic gate reproduces that routing, and the stated outcome is bounded detection with both postures explicit — it can fire on a negated mention, and it cannot see a concern phrased outside the lexicon.

### BLK-DISCLOSURE: Bound every channel out of the runner

Outcome: The independent reviewer's isolation rests on runner-owned controls rather than on provider configuration or absence of intent.
Boundary: Owns the runner's outbound channels into a provider process; owns nothing a provider sends to its own service.
Depends on: none
Acceptance intent: The arguments, environment, inherited handles, scratch storage, home directory, and shared output directory of a provider process are each bounded by the runner and verified by observation from inside that process; each spawn receives a private empty home and keeps exactly one real configuration path of its own; a dispatch carrying primary report content on any channel fails before the process starts; and the one channel that remains outside — what a provider sends its own service — is named.

### BLK-CUSTODY: State the real controls and their limits

Outcome: The controls that are maintained and tested are the controls that actually carry each property, and each property is stated at the strength its evidence supports.
Boundary: Owns isolation attribution, credential scoping, cross-run state isolation, owner liveness, and the evidence trust boundary; owns no signing authority and asserts no authenticity.
Depends on: BLK-DISCLOSURE
Acceptance intent: Isolation is attributed to ordering, tool disablement, and the private home rather than to file permissions; each provider child holds only its own credential variable and its own configuration path; cross-run state isolation is enforced as a named precondition of spawning rather than left as incidental configuration, is established by measuring that dispatched review content does not reach the shared configuration directory rather than by citing provider documentation, and is bound explicitly to the provider versions measured; a recycled owner identifier cannot wedge a directory permanently and has a stated recovery; and the evidence set is recorded with its trust boundary — sound within one operator's working copy, not portable authority — rather than as an unresolved item.

## Cross-block contracts

BLK-PROTOCOL states the contract the rest of the design exists to protect, so
BLK-CHAIN, BLK-READINESS, and everything downstream of them constrain a rule
that is written down rather than one inferred from their own behaviour. Nothing
depends on BLK-PROTOCOL for permission to run; blocks depend on it for meaning,
which is why it precedes them without gating them.

BLK-THREAD decides whether a cycle is identified at all, BLK-CHAIN whether it
belongs to this thread's history, BLK-CONVERGENCE whether it may start, and
BLK-FEEDBACK what a started cycle must contain. All four run before any provider
is dispatched, so a cycle that violates any of them costs zero invocations, and
BLK-BUDGET records exactly that zero rather than asserting it separately.
BLK-BUDGET charges the cycle BLK-CHAIN admitted, and the cycle number it records
is the number the next cycle's BLK-CHAIN check reads, so accounting and sequence
cannot disagree. BLK-READINESS extends the readiness predicate BLK-PROTOCOL
defines and records its result in the evidence the deterministic gate already
reproduces. BLK-PLATFORM runs before all of them and before the single-flight
lock. BLK-DISCLOSURE bounds the runner's outbound channels and BLK-CUSTODY
states what those bounds establish; neither asserts a property BLK-PLATFORM has
not admitted, and neither claims authenticity that BLK-CHAIN does not have.

## Verification and recovery intent

Each block is verified by deterministic tests that observe the fail-closed path,
not only the passing one. The chain and convergence paths cover a prior result
with no cycle accounting, a prior brief altered after the fact, a prior cycle
from a different objective, one from a different thread, a skipped cycle number,
a missing and a malformed thread name, a repeated brief, a changed brief with
and without carried feedback, and an undeclared and a doubly declared position.
The budget path covers exhaustion, a dispatched and an undispatched final at one
charge each, and cycles blocked before dispatch at zero. Readiness covers a
structurally clean report whose narrative matches the lexicon, and the gate
reproducing that routing. Platform admission covers an unsupported host.

Recovery behaviour is covered rather than asserted: a single-flight owner whose
recorded command no longer matches is reclaimed, a live matching owner still
blocks a concurrent cycle, a hung provider times out fail-closed and releases the
lock, malformed and missing provider results fail closed, partial evidence
publication is caught, and crash-left work directories including a provider's
private home and temporary directories are scavenged before the next dispatch.

Disclosure is verified from inside the provider process rather than from the
runner's own point of view: its arguments, its environment, its scratch and home
directories, and its open handles, plus the boundary predicate rejecting report
content directly, and the state-isolation flag set asserted for both providers.

Two properties are outside what deterministic tests can establish, and each has a
stated substitute. That a real provider still authenticates once its home is
replaced is verified by running both real backends through the runner itself
before adoption. That the provider suppression flags actually prevent review
content from reaching shared provider state is verified by dispatching a real
brief carrying a probe token and confirming the token appears in the delivered
prompt and in the provider's own review while occurring nowhere in the real
configuration directory afterwards. Both are re-run when a provider is upgraded,
because both rest on provider behaviour rather than on runner-enforced structure.

Recovery is by explicit operator action in every failure mode. A blocked cycle
names why it blocked and consumes no invocation and no budget. A wedged
single-flight owner has a stated confirm-then-remove procedure. An exhausted
budget returns the decision to the owner. An interruption after dispatch leaves
no result and is charged by the operator. Enabling this workflow over existing
evidence is a recorded cutover with a per-thread disposition.

## Prior final review feedback

The prior cycle did not reach independent final review; the primary readiness
gate held it. Its findings and this design's answers:

- The core workflow contract was asserted in prose but owned by no block, so the
  rule the design exists to protect was the one thing not stated as a checkable
  outcome. BLK-PROTOCOL now owns it: release criterion, dispatch order, reviewer
  distinctness, identical brief digest across roles, and final authority.
- Persistent provider configuration state remained a cross-run channel bounded
  only by provider flags rather than by a runner control. The flags are now a
  named set that spawning refuses to proceed without, and the channel's actual
  behaviour was measured with a probe token rather than assumed: dispatched
  review content does not reach the shared configuration directory. Relocating
  the configuration directory was considered and rejected for reasons now stated
  in the architecture decision, and the residual version-binding is stated too.
- The budget block declared no dependency on the chain and left the charge point
  undefined for first cycles, pre-dispatch failures, and interruptions.
  BLK-BUDGET now depends on BLK-CHAIN, derives the charge from consumed capacity
  so pre-dispatch outcomes are free by construction, and names the interrupted
  case as operator-charged.
- The verification account understated coverage that already existed, which made
  the design look less verified than it is. The account now enumerates the
  recovery paths that are actually tested, and separates the two properties that
  deterministic tests genuinely cannot reach from the ones they do.
- The evidence trust boundary was left implicit while the design contemplated
  use by other people, leaving the no-adversary reasoning apparently in tension
  with that. The boundary is now explicit: evidence is sound within one
  operator's working copy and is not portable authority, so a reader who obtains
  it from elsewhere consumes a claim rather than a proof.

The tradeoff earlier reviews named — that concentrating the second perspective in
one terminal pass removes cross-model coverage from the cycles where defects are
introduced — is accepted and remains an owner decision. It is now stated with its
limits as well as its cost: what narrows is how many perspectives examine a
design while it is still being repaired, and the surrounding authority gates are
untouched, with owner clarification, implementation interrogation against the
implemented diff, and the higher-threshold quality review all unchanged. The
proposal to make the dispatch predicate severity-aware remains declined, because
it would change an owner-set gate rather than fix a defect in this design.

The high-water baseline named in the objective trace is not answered by any block
here and is not claimed to be. It is deferred by owner decision to separate work.

## Deferred to block refinement

Exact option names, status identifiers, lexicon contents, digest windows,
directory layout, environment variable names, test invocations, and the
sequencing of the cutover enumeration are deferred. Which repository threads are
in flight at cutover is an operational determination made when the cutover runs.
The high-water baseline is deferred at a larger scope than block refinement: it
is separate work under the same objective, not a detail of a block here.

## Backlog handoff

Materialize the ten blocks as dependency-linked work items under KSTK-103, with
BLK-CHAIN and BLK-READINESS sequenced after BLK-PROTOCOL, BLK-CONVERGENCE and
BLK-BUDGET after BLK-CHAIN, BLK-FEEDBACK after BLK-CONVERGENCE, BLK-CUSTODY after
BLK-DISCLOSURE, and BLK-THREAD, BLK-PLATFORM, and BLK-DISCLOSURE independent. The
cutover enumeration stays a separate operational item bound to the same
objective, because it is executed once against live repository state rather than
delivered as a mechanism. The high-water baseline is a separate item under this
objective, carrying the ticket's originating requirement, and is not satisfied by
any block delivered here.
