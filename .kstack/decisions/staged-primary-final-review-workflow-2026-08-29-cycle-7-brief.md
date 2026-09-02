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

Three review cycles have assessed this workflow. The last found that the repair
chain was described as unforgeable when its artifacts are unsigned, that the
shared home directory was disclosed rather than bounded, and that the thread
identity rule was stated ambiguously. This cycle closes the home directory with
a runner control, corrects the chain's claim to what it actually establishes,
resolves the ambiguity, and narrows two further outcome statements that were
broader than their mechanisms. The review question is whether every remaining
claim now matches its evidence, and whether the limits that stay open are the
right ones to leave open.

## Architecture decision

Keep the ordered primary-then-independent-final protocol, the convergence
contract, and the artifact-derived chain. Change three things: bound the home
directory in the runner rather than describing it, state each guarantee at the
strength its mechanism supports, and record the authenticity limit as a settled
ownership decision rather than as an unfinished item.

For the home directory the alternative considered and rejected was to keep
relying on the providers' own ephemeral and sessionless flags. Those are real
mitigations but they are provider configuration, so the property they carry
belongs to the provider rather than to this workflow, and it changes whenever a
provider changes. The chosen approach gives each spawn a private, empty home
inside the work directory that is already removed when the invocation ends, and
passes each provider exactly one real path — its own configuration directory,
resolved explicitly — so credentials still resolve while the broad shared
surface disappears. The narrower path replaces the wider one rather than being
added alongside it.

For evidence authenticity the alternative considered and rejected was to sign
the local evidence set. Signing would convert a consistency check into an
authenticity check, but it requires deciding whose identity signs. If this
project is used by other people, a signing mechanism bound to the maintainer's
own certificate would end up attesting other operators' local evidence under the
maintainer's identity. That is an ownership problem rather than a cryptographic
one, and it has no good answer here yet; a mechanism that misattributes evidence
would be worse than an accurate statement of what the evidence proves. The
separate observation that a single-operator model has no adversary with write
access who is not already the operator points the same way, and matches how the
analogous hash-chain question was settled elsewhere in this repository.

## Architecture blocks

### BLK-CHAIN: Check chain membership against artifacts

Outcome: A repair cycle is admitted only against the cycle it claims to follow, to the strength unsigned local artifacts allow.
Boundary: Owns chain consistency and sequence; owns no authenticity claim, no reviewer content, no threshold, and no approval authority.
Depends on: none
Acceptance intent: A chained cycle is admitted only when the presented prior brief hashes to the digest the prior result recorded, that brief states the same objective as the current one, the named thread agrees wherever the prior result records one, and the prior cycle number is exactly one less; a prior result carrying no cycle accounting cannot be chained; and the property is stated as consistency between presented artifacts, never as authenticity of them.

### BLK-THREAD: Require thread identity on every cycle

Outcome: No cycle runs without naming the thread it belongs to.
Boundary: Owns the current cycle's identity requirement; owns nothing about what a prior result recorded.
Depends on: none
Acceptance intent: A missing or malformed thread name blocks before dispatch unconditionally, and the single allowance for a prior result that records no thread name is scoped to the prior side alone, exists only because results predating thread recording cannot carry one, and never relaxes the current cycle's requirement.

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

Outcome: An operator can state before starting whether a cycle is affordable.
Boundary: Owns budget accounting and exhaustion; owns no threshold and no approval authority.
Depends on: none
Acceptance intent: One staged cycle costs one budgeted cycle whether or not the final reviewer was dispatched, provider invocations are reported separately, and a cycle beyond the budget dispatches nobody.

### BLK-PLATFORM: Bound every custody claim to where it holds

Outcome: No guarantee is asserted on a host that cannot provide it.
Boundary: Owns platform admission and the stated scope of custody properties; owns no provider behavior.
Depends on: none
Acceptance intent: An unsupported host is refused before the output directory is locked and before any invocation is spent, and admission depends on named primitives — link-safe reopening, ownership and mode semantics at rest, process-group termination, and directory durability — rather than on an unqualified platform label.

### BLK-READINESS: Detect narrative defects the structured fields miss

Outcome: A bounded class of prose-only defects is caught that the counter-based predicate cannot see.
Boundary: Owns a lexicon-bounded consistency check between narrative fields and structured findings; owns no threshold, cannot lower one, and claims no completeness.
Depends on: none
Acceptance intent: A report claiming approval with empty finding arrays whose narrative matches the bounded lexicon is routed back to the primary, the deterministic gate reproduces that routing, and the stated outcome is bounded detection with both postures explicit — it can fire on a negated mention, and it cannot see a concern phrased outside the lexicon.

### BLK-DISCLOSURE: Bound every channel out of the runner

Outcome: The independent reviewer's isolation rests on runner-owned controls rather than on provider configuration or absence of intent.
Boundary: Owns the runner's outbound channels into a provider process; owns nothing a provider sends to its own service.
Depends on: none
Acceptance intent: The arguments, environment, inherited handles, scratch storage, home directory, and shared output directory of a provider process are each bounded by the runner and verified by observation from inside that process; each spawn receives a private empty home and keeps exactly one real configuration path of its own; a dispatch carrying primary report content on any channel fails before the process starts; and the one channel that remains outside — what a provider sends its own service — is named.

### BLK-CUSTODY: State the real controls and their limits

Outcome: The controls that are maintained and tested are the controls that actually carry each property.
Boundary: Owns isolation attribution, credential scoping, owner liveness, and evidence disclosure; owns no signing authority and asserts no authenticity.
Depends on: BLK-DISCLOSURE
Acceptance intent: Isolation is attributed to ordering, tool disablement, and the private home rather than to file permissions; each provider child holds only its own credential variable and its own configuration path; a recycled owner identifier cannot wedge a directory permanently and has a stated recovery; and the unsigned evidence set is recorded as a settled scope decision with its reasoning, not as an open item.

## Cross-block contracts

BLK-THREAD decides whether a cycle is identified at all, BLK-CHAIN whether it
belongs to this thread's history, BLK-CONVERGENCE whether it may start, and
BLK-FEEDBACK what a started cycle must contain. All four run before any provider
is dispatched, so a cycle that violates any of them costs zero invocations.
BLK-BUDGET charges the cycle BLK-CHAIN admitted, and the cycle number it records
is the number the next cycle's BLK-CHAIN check reads, so accounting and sequence
cannot disagree. BLK-READINESS extends the existing readiness predicate and
records its result in the evidence the deterministic gate already reproduces.
BLK-PLATFORM runs before all of them and before the single-flight lock.
BLK-DISCLOSURE bounds the runner's outbound channels and BLK-CUSTODY states what
those bounds establish; neither asserts a property BLK-PLATFORM has not admitted,
and neither claims authenticity that BLK-CHAIN does not have.

## Verification and recovery intent

Each block is verified by deterministic tests that observe the fail-closed path,
not only the passing one: a prior result with no cycle accounting, a prior brief
altered after the fact, a prior cycle from a different objective, one from a
different thread, a skipped cycle number, a missing and a malformed thread name,
a repeated brief, a changed brief with and without carried feedback, an
undeclared and a doubly declared position, a budget beyond its limit, a
structurally clean report whose narrative matches the lexicon, and an
unsupported host. Disclosure is verified from inside the provider process rather
than from the runner's own point of view: its arguments, its environment, its
scratch and home directories, and its open handles, plus the boundary predicate
rejecting report content directly.

Deterministic tests cannot establish that a real provider still authenticates
once its home is replaced, so that is verified separately by running both real
backends through the runner itself before adoption rather than inferred.

Recovery is by explicit operator action in every failure mode. A blocked cycle
names why it blocked and consumes no invocation. A wedged single-flight owner
has a stated confirm-then-remove procedure. An exhausted budget returns the
decision to the owner. Enabling this workflow over existing evidence is a
recorded cutover with a per-thread disposition.

## Prior final review feedback

The prior cycle did not reach independent final review; the primary readiness
gate held it. Its findings and this design's answers:

- The chain was described as unforgeable while resting on unsigned,
  operator-replaceable artifacts, which establishes consistency rather than
  authenticity. The claim is corrected throughout: BLK-CHAIN now states
  consistency between presented artifacts and explicitly disclaims authenticity.
- Whether thread identity was mandatory was ambiguous. BLK-THREAD separates the
  two rules that were conflated: the current cycle must always name its thread,
  and the allowance for an unrecorded thread name applies only to a prior result
  that predates thread recording.
- The shared home directory and provider-to-service traffic were both excluded
  while isolation was still attributed to ordering and tool disablement. The
  home directory is now closed by a runner control rather than excluded: each
  spawn gets a private empty home inside its own removed-on-exit work directory,
  and each provider keeps exactly one real path, its own configuration
  directory. Provider-to-service traffic remains outside and is named as the
  single remaining excluded channel.
- Credential isolation checked only named variables while a home was shared. The
  private home removes the path-based part of that gap; the stated property now
  matches what is enforced, covering both the variable and the path.
- The feedback requirement implied enforcement of completeness it does not have.
  BLK-FEEDBACK's boundary now says the mechanism owns presence and difference,
  and that faithfulness is asserted by the operator and assessed by the final
  reviewer reading the record.
- The narrative-consistency block promised an absolute outcome its heuristic
  cannot deliver. BLK-READINESS is narrowed to bounded detection with both
  postures stated, rather than to a guarantee it cannot support.
- The platform block did not name the primitives admission depends on. They are
  now named in its acceptance intent.
- The unsigned evidence set is unchanged and is now recorded as a settled scope
  decision with its reasoning rather than as an unresolved finding, because
  signing requires deciding whose identity signs and this project has no answer
  that would not attribute one operator's evidence to another's identity.

The tradeoff both earlier reviews named — that concentrating the second
perspective in one terminal pass removes cross-model coverage from the cycles
where defects are introduced — is accepted, stated, and remains an owner
decision. The proposal to make the dispatch predicate severity-aware remains
declined, because it would change an owner-set gate rather than fix a defect in
this design.

## Deferred to block refinement

Exact option names, status identifiers, lexicon contents, digest windows,
directory layout, environment variable names, test invocations, and the
sequencing of the cutover enumeration are deferred. Which repository threads are
in flight at cutover is an operational determination made when the cutover runs.

## Backlog handoff

Materialize the nine blocks as dependency-linked work items under KSTK-103, with
BLK-CONVERGENCE sequenced after BLK-CHAIN, BLK-FEEDBACK after BLK-CONVERGENCE,
BLK-CUSTODY after BLK-DISCLOSURE, and the remaining five independent. The
cutover enumeration stays a separate operational item bound to the same
objective, because it is executed once against live repository state rather than
delivered as a mechanism.
