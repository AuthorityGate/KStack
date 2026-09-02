KSTACK-DESIGN-10K-V1
Altitude: 10000
Implementation-ready: no
Objective-brief: Harden the ordered primary-then-independent-final design review mechanism
Objective-digest: 1d426115586884ceccd6b1385c0403612201f2f272e571470e76fdfbc7ba04e8

## Objective trace

KStack replaces routine simultaneous two-agent design review with an ordered
workflow. One primary agent owns improvement until the work is genuinely ready,
then exactly one different agent performs an independent final review of the
same neutral decision brief. The objective of this thread is that mechanism:
spend one fewer agent invocation per improvement cycle without weakening the
fail-closed evidence and authority boundaries that gate design approval.

High-water design preservation — defining an accepted baseline, recording it,
comparing later designs against it, and refusing to regress below it — is out of
scope for this thread. It remains under ticket KSTK-103 and the predecessor
thread, where it is unstarted. No block below delivers any part of it. This
thread exists because that requirement and the mechanism were bound to a single
objective, which made the mechanism unassessable on its own evidence: a brief
honestly reporting the baseline as unaddressed failed a required objective check
regardless of the mechanism's state. Separating them lets each be judged against
an objective it can actually satisfy.

## Architecture decision

Keep the ordered primary-then-independent-final protocol. Make the protocol
itself an owned block rather than an assumption the other blocks lean on, and
state every remaining property at the strength its mechanism supports.

The central decision is where cross-run provider state isolation comes from.
Providers keep persistent configuration directories holding session history and
transcript stores, so one review could in principle observe another. The
alternative considered and rejected was relocating each provider's configuration
directory into the per-invocation work directory. That looks stronger because it
would make isolation structural, but it requires a live credential in the
private copy — either duplicated per invocation, creating a new
credential-handling surface, or hard-linked, which fails outright when the
configuration directory and the output directory are on different filesystems,
as they are on the supported host.

The chosen approach keeps the real configuration directory and closes the
channel at the provider, with the suppression flags named in one place and
enforced as a precondition of spawning. That trades a structural guarantee for a
behavioural one, which is only as good as its evidence and only valid for the
build it was measured against. So the measurement is made a gate rather than a
note: a dispatch is admitted only when a recorded measurement matches the active
backend's resolved binaries and reported version and observed no leak. An
upgrade invalidates the match and stops dispatch until re-measured. The accepted
cost is that every provider upgrade requires a re-measurement before the next
review cycle.

For the budget, the alternative considered and rejected was enumerating which
blocked outcomes are free. Enumeration silently mischarges any status added
later, so the charge is derived from whether a provider actually ran.

Two further decisions follow from taking the isolation measurement seriously
about what it does not show. First, the claim it supports is write-side only:
that dispatched review content did not persist into shared provider state. It
does not exercise what a later run can read back, and it does not reach
provider-to-service traffic, so it cannot carry a general cross-run
non-observability property. The design therefore stops attributing primary/final
isolation to it. That isolation rests where it always did — the primary's work
directory including its stdout and stderr is removed before the final process is
spawned, and the final process has no filesystem read primitive — and the
measurement stands as defence in depth for shared provider state.

Second, final acceptance fails closed rather than treating anything short of a
hard refusal as assent. Three changes follow one principle: the loop exits only
on an affirmative that means what it says. A decision of revise is a request for
change, so only an explicit approve is acceptance. A high or critical security
finding blocks regardless of the decision label, because no design should leave
the loop carrying one. And failed checks, material dissent, and open questions
are no longer routed onward silently: each can describe an unresolved design or
authority defect rather than implementation work, and telling those apart is a
judgement the mechanism cannot make, so it demands the judgement be made and
recorded rather than guessing.

The disposition mechanism is deliberately not another dispatch. The record is
written after the final review is read, bound to that review's envelope digest,
and consumed by the gate alongside the manifest exactly as the checks document
already is. That means recording a disposition costs no invocation, a record
cannot discharge a different review's findings, and a record stops matching as
soon as the review is re-run. Whether it is credible remains a human judgement,
which is why each entry carries a typed kind and a rationale rather than a bare
acknowledgement; the mechanism owns that a decision was made and recorded
against the right review, not that it was a good one.

Third, the primary and final must resolve to different provider families. The
runner's controls bound what it hands a provider and reach nothing a provider
retains service-side, so two roles on one vendor's service could share state
that no filesystem control touches. Different families remove the shared domain
rather than trying to police it. The configuration validator already rejects two
roles declaring the same backend, but it compares declarations; two different
commands can still resolve to the same vendor, which only a runtime family check
can see.

## Architecture blocks

### BLK-PROTOCOL: Own the ordered review contract itself

Outcome: The rule that defines this workflow is owned, stated, and checkable rather than assumed by the blocks that depend on it.
Boundary: Owns the release criterion, dispatch order, reviewer distinctness, brief identity across roles, final authority, and the provider-to-service channel, which it addresses by removing the shared domain rather than by bounding traffic; owns no platform admission, no runner-side or local-state channel bounding, and no budget accounting.
Depends on: none
Acceptance intent: The primary releases only on an approval decision at or above the configured readiness confidence with all four structured finding arrays empty; exactly one final reviewer is dispatched, it is a different agent from the primary, which resolves to a checkable predicate rather than a description — the two roles must resolve to different execution backends, compared by the content digest of the resolved executable and launcher rather than by the command names declared in configuration, so two differently declared entries that resolve to one binary are refused; the predicate fails closed when identity cannot be established, since a role whose command does not resolve, whose family cannot be identified, or whose runtime surface cannot be walked within bounds is unavailable and dispatches nobody, rather than being treated as distinct by default; and the two resolve to different provider families; the family check rests on a stated assumption, that two separately identified vendors operate separate service-side state domains, and it is enforced fail-closed in every direction the evidence permits — a family that cannot be identified, or that probes ambiguously to more than one vendor, leaves that backend inadmissible and dispatches nobody, and two backends that are merely unidentified compare equal and are refused rather than assumed distinct, so only a positive identification of two different vendors admits a cycle; the assumption's residual limit is stated plainly rather than implied closed, since an aggregator or gateway fronting both vendors would present two vendor identities over one service-side domain and defeat the separation without the check being able to see it, and this mechanism does not detect that case; the final receives a brief whose digest is identical to the one the primary received and receives no part of the primary's report; final acceptance requires a decision of exactly approve at or above the configured final threshold, since a revise verdict is a request for change rather than the reviewer's weakest assent, together with the absence of any unresolved high or critical security finding; failed checks, material dissent, and open questions on an otherwise accepted final are not routed onward silently but each require a typed, reasoned disposition recorded against that exact final review, with any item judged to need a design change returning the design to the primary; a disposition is an authority act rather than a review output, since it decides that a named finding may stand without a further design cycle, so only a human role may take it and no agent may take it on its own behalf — the record must name a recognised human role, name a person, carry an attestation time, and bind to the digest of the exact final review it discharges, and it is read only as a regular file inside the project, so a record reached through a link out of the tree discharges nothing; the two dispositions that permit acceptance are implementation work and accepted residual, while design change required returns the design to the primary; what the mechanism actually enforces is stated at that strength and no higher — the runner has no code path that writes such a record and every reviewer is spawned without a write primitive, so nothing in this workflow can author its own discharge, but the mechanism cannot prove which keyboard produced the bytes, for the same single-operator reason the local evidence set carries no signatures, and the check that rejects a record openly attributing itself to an agent is a tripwire rather than a proof; the stronger control that would close this — denying the record's path to every agent tool surface in the repository — is not built here, and that is an owner decision recorded by date in the thread's decision record rather than a judgement this design makes for itself, since its blast radius is every agent session in the repository; an agent proposing disposition text for a human to review and sign is consistent with this rule, an agent recording one that takes effect is not; lower-severity security findings continue to route to bug-fix intake, keeping acceptance and defect capture distinct without letting severity or unresolved design questions escape; and the whole acceptance rule is computed by one shared function that both the runner and the independent gate evaluate over the same envelope, so an accepted manifest and a blocking gate cannot disagree.

### BLK-THREAD: Require thread identity on every cycle

Outcome: No cycle runs without naming the thread it belongs to.
Boundary: Owns the current cycle's identity requirement; owns nothing about what a prior result recorded.
Depends on: none
Acceptance intent: A missing or malformed thread name blocks before dispatch unconditionally, and the single allowance for a prior result that records no thread name is scoped to the prior side alone, exists only because results predating thread recording cannot carry one, and never relaxes the current cycle's requirement.

### BLK-CHAIN: Check chain membership against artifacts

Outcome: A repair cycle is admitted only against the cycle it claims to follow, to the strength unsigned local artifacts allow.
Boundary: Owns chain consistency and sequence; owns no authenticity claim, no reviewer content, no threshold, and no approval authority.
Depends on: BLK-PROTOCOL
Acceptance intent: A chained cycle is admitted only when the presented prior brief hashes to the digest the prior result recorded, that brief states the same objective as the current one, the named thread agrees wherever the prior result records one, and the prior cycle number is exactly one less; a prior result carrying no cycle accounting cannot be chained; a cycle declaring no predecessor is a first cycle and carries no prior findings; result publication is atomic, so a cycle either published a complete result or published none and there is no partial state a successor could chain to; a cycle interrupted before publication is therefore abandoned rather than resumed or advanced, is not part of the chain, and is re-run from the beginning at the same cycle number, which spends fresh invocations because no result exists to reuse; and the property is stated as consistency between presented artifacts, never as authenticity of them.

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
Acceptance intent: The charge is derived from whether a provider was actually dispatched rather than from the outcome's status name, so every cycle blocked before the primary spawns costs zero and every cycle that reaches a provider costs exactly one whether or not the final was dispatched; provider invocations are reported separately from the cycle charge; a cycle beyond the budget dispatches nobody and is itself free; the deterministic gate recomputes the same relation and rejects evidence charging a count its invocation record does not support; and an interruption after dispatch, which writes no result at all, is charged by the mechanism rather than by the operator's memory — the cycle is recorded in a thread-scoped dispatch log before the first provider spawns and flushed to disk, so the record survives the interruption that prevents a manifest, and the next cycle of that thread is admitted only if it exceeds the highest cycle already dispatched, which places the log outside the operator-chosen output directory so that re-running into a fresh directory cannot evade it; the recovery rule follows from that rather than being asserted beside it, since a re-run reusing the interrupted number could not be charged in a budget that compares the cycle number to the configured maximum, so an interrupted cycle resumes at the next number.

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
Acceptance intent: The arguments, environment, inherited handles, scratch storage, home directory, and shared output directory of a provider process are each bounded by the runner and verified by observation from inside that process; each spawn receives a private empty home and keeps exactly one real configuration path of its own; a dispatch carrying primary report content on any channel fails before the process starts; every reviewer is spawned without a write primitive, and that is an asserted acceptance condition rather than an assumption — the sandbox, tool-disablement, and permission arguments that remove it are a named set checked as adjacent argument sequences, so a bare disabling flag whose subject was dropped fails closed exactly as an omitted one does, and this is the same property that prevents a reviewer authoring its own disposition; the absence of the other role's artifacts at dispatch time is demonstrated adversarially rather than by ordering alone, by a reviewer that discovers the peer working directory by listing the shared output directory rather than being handed its path, attempts a real read of every artifact within it and of each per-role output file, and fails the cycle if any read succeeds; the two claims are kept distinct at the strength each is evidenced, since that demonstration establishes absence at the moment the process runs and the flag set establishes denial, and neither is offered as the other; and the one channel that remains outside — what a provider sends its own service — is named and owned by BLK-PROTOCOL.

### BLK-ISOLATION: Bind the cross-run guarantee to the measured build

Outcome: A provider build whose write-side isolation behavior has not been observed cannot be dispatched.
Boundary: Owns the state-suppression precondition and the measurement that admits a build; owns no provider-internal behavior, no read-side or provider-service claim, no part of primary/final isolation, which BLK-DISCLOSURE owns, and no claim about inputs outside the measured identity.
Depends on: BLK-DISCLOSURE
Acceptance intent: The flags that suppress cross-run persistence are a named set that constructing a spawn refuses to omit, so silently dropping one fails closed rather than degrading quietly; a dispatch is admitted only when recorded evidence matches the active backend's content digests of its resolved executable and launcher together with its reported version, not merely their paths, and records that no dispatched review content reached the shared configuration directory; a build with no matching measurement dispatches nobody and charges nothing; measurement observes only the configuration files a real dispatch actually modified, using a probe value that never enters an operator-visible record so a later scan cannot match its own history; the claim is stated at exactly the strength the method supports — the literal probe value did not persist into the configuration files the dispatch modified, which is narrower than review content in general, since content that a provider transformed, encoded, or summarised before writing would not match the value the scan looks for, and narrower still than cross-run non-observability, since it neither exercises what a later run can read back nor reaches provider-to-service traffic; the standing cost, that every provider upgrade forces re-measurement before the next cycle, is accepted rather than worked around; the measurement identity covers the inputs that can change provider behavior and are observable from the client — the resolved executable and launcher content, the reported version, the installation tree beside the executable, and, for a provider whose flags do not remove them, its plugin directory — walked in sorted order with symbolic links recorded by target and never followed, under hard file and byte bounds whose breach makes the backend unavailable rather than yielding a partial digest; a provider that removes plugins by construction has that removal pinned in the enforced flag set, so the exclusion rests on a checked flag rather than on an assumption; and the one input that remains outside is named rather than implied covered — service-side configuration and account policy are not observable from the client, because neither provider exposes an interface reporting account policy, model routing, or server-side feature state and the version probe is itself client-reported, so no probe is invented for it and it stands as an open limit.

### BLK-CUSTODY: State the real controls and their limits

Outcome: The controls that are maintained and tested are the controls that actually carry each property, and each property is stated at the strength its evidence supports.
Boundary: Owns isolation attribution, credential scoping, owner liveness, and the evidence trust boundary; owns no signing authority and asserts no authenticity.
Depends on: BLK-ISOLATION
Acceptance intent: Isolation is attributed to ordering, tool disablement, and the private home rather than to file permissions; each provider child holds only its own credential variable and its own configuration path; single-flight owner identity is the process identifier together with every recorded attribute that can be observed — its start time, which is assigned at creation and not reused, and its command line — so a recycled identifier running the identical command cannot hold the directory, while an attribute that cannot be observed is treated conservatively as live; and the evidence set is recorded with its trust boundary, sound within one operator's working copy and not portable authority, rather than as an unresolved item.

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
lock.

Three channels could carry one review into another, and each has exactly one
owner. BLK-DISCLOSURE owns what the runner hands a provider process: arguments,
environment, handles, scratch, home, and the shared output directory.
BLK-ISOLATION owns shared local provider state, write-side only: whether a
dispatch leaves review content in the configuration directory a later run reads.
BLK-PROTOCOL owns the provider-to-service channel, and owns it by removing the
shared domain rather than by bounding traffic the runner never sees, which is
why family separation lives there and not here. BLK-ISOLATION makes no
provider-service claim at all. BLK-CUSTODY states what those bounds together
establish. None asserts a
property BLK-PLATFORM has not admitted, and none claims authenticity that
BLK-CHAIN does not have. BLK-ISOLATION's admission runs with the other
pre-dispatch checks, so an unmeasured build is refused on the same terms and at
the same cost as an unidentified thread.

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
Isolation covers a build with no measurement, a measurement taken against a
different build, a measurement that observed a leak, malformed evidence treated
as absent rather than trusted, and the gate rejecting dispatched evidence that
records no measurement. Final acceptance covers an accepted final carrying a
high finding and one carrying a critical finding, each returning to the primary
in the runner and blocking in the gate, alongside the existing case of an
accepted final whose lower-severity findings still route to bug-fix intake.
Owner liveness covers a recycled identifier presenting the identical command
line with a start time that cannot be its own, and a genuinely live owner whose
recorded start time matches still holding the directory.

Final acceptance covers a revise verdict above the threshold returning to the
primary in both the runner and the gate, a bare revise with no structured
findings doing the same, a high and a critical security finding each blocking,
and lower severities still reaching intake. Disposition covers a required
disposition blocking until recorded, a satisfied record releasing the gate, a
record bound to a different final review failing to discharge these findings, an
item disposed as needing a design change returning to the primary, and a final
with nothing to dispose completing with no record at all. Provider separation
covers two roles that declare different backends but probe to the same vendor
being refused before dispatch at zero charge, a normal cycle recording that its
two roles are on different families, and the gate naming a manifest whose two
roles share one family rather than reporting it as a generic reproduction
failure. Disposition authority covers a record with no authority at all, one
naming an unrecognised role, one naming no person, one attributing itself to an
agent, one carrying no attestation time, and one reached through a symbolic link
out of the project, each failing to discharge; a record naming a human owner
releasing the gate; and the runner completing a cycle that requires disposition
while writing no such record itself. Write suppression is asserted for both
providers as adjacent argument sequences, and every cycle in the suite runs the
adversarial peer probe, so the absence of the other role's artifacts is
established on each fixture rather than in one case.

The ordered contract itself is exercised in one cycle rather than assumed:
that exactly one final dispatch occurs, that the two roles are different agents,
that both roles received the identical design digest, that each prompt framed
its own stage, and that the final's prompt carries the brief while containing no
part of the primary's report.

Recovery behaviour is covered rather than asserted: a single-flight owner whose
recorded command no longer matches is reclaimed, a live matching owner still
blocks a concurrent cycle, a hung provider times out fail-closed and releases the
lock, malformed and missing provider results fail closed, partial evidence
publication is caught, and crash-left work directories including a provider's
private home and temporary directories are scavenged before the next dispatch.

Disclosure is verified from inside the provider process rather than from the
runner's own point of view: its arguments, its environment, its scratch and home
directories, and its open handles, plus the boundary predicate rejecting report
content directly, and the state-suppression flag set asserted for both providers.

Two properties are outside what deterministic tests can establish, and each has a
stated substitute. That a real provider still authenticates once its home is
replaced is verified by running both real backends through the runner itself.
That the suppression flags actually prevent review content from reaching shared
provider state is verified by dispatching a real brief carrying a probe value and
confirming it reaches the provider while occurring nowhere in the configuration
files the run modified. Both are re-run when a provider is upgraded, and for the
second the runner enforces that rather than relying on the operator to remember.

Recovery is by explicit operator action in every failure mode. A blocked cycle
names why it blocked and consumes no invocation and no budget. A wedged
single-flight owner has a stated confirm-then-remove procedure. An exhausted
budget returns the decision to the owner. An interruption after dispatch leaves
no result and is charged by the operator. An unmeasured provider build is
resolved by running the measurement, not by overriding the check.

## Prior final review feedback

The prior cycle did not reach independent final review; the primary readiness
gate held it at confidence 62. Its findings and this design's answers:

- The measurement identity excluded runtime dependencies, plugins, service-side
  configuration, and account policy, so provider behavior could change without
  invalidating a match while the design still called the admission fail-closed.
  The identity now covers what is observable from the client: the resolved
  executable and launcher content, the reported version, the installation tree
  beside the executable, and, where a provider can load them, its plugin
  directory. Codex is a static executable with no dependency tree beside it, so
  its content digest already covered its code; Claude removes plugins with
  --safe-mode, now pinned in the enforced flag set, so its plugin directory is
  excluded by a checked flag rather than by assumption. Service-side
  configuration and account policy remain outside, and the brief now says why
  rather than listing them as a limit without a reason: no client interface
  reports them.
- The isolation probe's claim was broader than its method. It is now stated as
  what the scan actually establishes — the literal probe value did not persist —
  with transformed or encoded persistence named as outside what it can see.
- Reviewer distinctness was required without a checkable definition of agent
  identity or stated behaviour when identity is missing or ambiguous.
  BLK-PROTOCOL now defines it as different resolved execution backends compared
  by content digest rather than by declared command name, and states the
  fail-closed path when a role's command, family, or runtime surface cannot be
  resolved.
- An interrupted post-dispatch cycle was described as operator-charged, which no
  mechanism could enforce, since an interruption is exactly the case where no
  manifest is written. The cycle is now recorded in a thread-scoped dispatch log
  before the first provider spawns and flushed to disk, and the next cycle must
  exceed the highest dispatched cycle for its thread. The recovery rule changed
  with it: an interrupted cycle resumes at the next number, not its own, because
  a charge that does not advance the number cannot affect a budget that compares
  the number to its maximum.
- Human-only disposition authority was not structurally enforced, and the
  stronger control was left as an unresolved question. The owner has now decided
  it, recorded by date: attestation-only for this thread, with the repository
  safety-hook path deny deliberately not built because its blast radius is every
  agent session in the repository. The residual is unchanged and stated.

The predecessor thread `staged-primary-final-review-workflow-2026-08-29` carried
this mechanism through eight cycles under an objective that also held the
high-water requirement; its findings on protocol ownership, convergence,
feedback carriage, budget accounting, platform scope, prose routing, credential
scoping, and disclosure bounding are answered by the blocks above.

Three residuals that earlier reviews asked to see explicitly accepted are now
accepted by the owner, recorded as dated entries in this thread's decision record
under "Owner decisions of record" — attestation-only disposition authority,
reduced independent coverage during repair cycles, and the aggregator limit on
provider-family separation, each dated 2026-09-01 and carrying the instruction as
received. The brief cites those entries rather than asserting acceptance in its
own voice, which is the same separation the disposition rule itself draws. One
honest caveat travels with them: they are transcriptions relayed through the team
lead and recorded by an agent, not signatures made by the owner directly. If that
distinction matters for these acceptances the way it matters for a disposition,
the entries are the wrong instrument and the owner should sign them directly;
that possibility is recorded as an open fork rather than resolved here.

The tradeoff behind the second of those — that concentrating the second
perspective in one terminal pass removes cross-model coverage from the cycles
where defects are introduced — has direct evidence about its strength. In the
predecessor thread's fourth cycle the
primary approved at confidence 96 with zero findings across all four structured
arrays, and the independent final reviewer then returned six failed checks, six
security findings, three material dissents, and nine unresolved questions
against that same brief. The terminal pass demonstrably catches what the primary
misses. What narrows is how many perspectives examine a design while it is still
being repaired; the surrounding authority gates are untouched, with owner
clarification, implementation interrogation against the implemented diff, and
the higher-threshold quality review all unchanged.

The proposal to make the dispatch predicate severity-aware remains declined,
because it would change an owner-set gate rather than fix a defect in this
design. Signing the evidence set remains declined for the recorded
signing-identity reason.

## Deferred to block refinement

Exact option names, status identifiers, lexicon contents, digest windows,
directory layout, environment variable names, evidence file paths, measurement
command invocations, test invocations, and the sequencing of the cutover
enumeration are deferred. Which repository threads are in flight at cutover is
an operational determination made when the cutover runs.

## Backlog handoff

Materialize the eleven blocks as dependency-linked work items under this
objective, with BLK-CHAIN and BLK-READINESS sequenced after BLK-PROTOCOL,
BLK-CONVERGENCE and BLK-BUDGET after BLK-CHAIN, BLK-FEEDBACK after
BLK-CONVERGENCE, BLK-ISOLATION after BLK-DISCLOSURE, BLK-CUSTODY after
BLK-ISOLATION, and BLK-THREAD, BLK-PLATFORM, and BLK-DISCLOSURE independent. The
cutover enumeration stays a separate operational item bound to this objective,
because it is executed once against live repository state rather than delivered
as a mechanism. High-water design preservation is not part of this handoff and
stays under KSTK-103.
