# Staged review mechanism hardening

**Thread:** `staged-review-mechanism-hardening-2026-09-02`
**Predecessor:** `staged-primary-final-review-workflow-2026-08-29`
**Parent ticket:** KSTK-103
**Objective:** `.kstack/objectives/staged-review-mechanism-hardening-2026-09-02.md`
(SHA-256 at creation:
`1d426115586884ceccd6b1385c0403612201f2f272e571470e76fdfbc7ba04e8`)

## Why this thread exists

The predecessor thread ran eight review cycles against the ordered
primary-then-independent-final review mechanism and never reached readiness. The
cause was not a defect in the mechanism. That thread's objective is the
originating KSTK-103 requirement — preserve an accepted high-water design across
review loops — and `objectives-complete` is a required design-gate check. Every
brief in the thread is bound to that objective by digest, and the runner's own
chain check refuses a prior cycle whose objective differs. A brief that honestly
reported the high-water requirement as unaddressed therefore failed a required
check by construction, however sound the mechanism had become.

Cycle 7 reached `revise` at confidence 42 with the gap implicit. Cycle 8 stated
it plainly and was blocked at confidence 20, with objective traceability named
as the first failed check. Hiding the gap was not available, because cycle 7 had
already found it. No brief under that objective digest could both defer
high-water and pass readiness.

The owner's decision on 2026-09-02 was to split: continue hardening the
mechanism under its own objective, and take high-water preservation as dedicated
later work. Breaking the review chain is intended and correct — a new objective
produces a new digest, so this thread's first cycle is a first cycle rather than
a continuation.

High-water preservation is not addressed here, not claimed here, and remains
open under KSTK-103.

## Decisions carried forward

These were settled in the predecessor thread and are not reopened:

- **Evidence authenticity is a documented limitation, not a signing project.** A
  signing mechanism bound to the maintainer's own certificate must not attest
  other operators' local evidence; that is an identity and ownership problem the
  project has no answer for. Local evidence proves internal consistency, not
  cryptographic authenticity.
- **The evidence trust boundary is one operator's working copy.** Evidence is
  sound while the output directory is writable only by the operator whose review
  it records. It is not portable authority; a reader who obtains it from another
  working copy consumes a claim, not a proof.
- **The workflow is POSIX-only** and refuses an unsupported host before the lock
  is taken and before any invocation is spent.
- **The accepted tradeoff** — concentrating the second perspective in one
  terminal pass removes cross-model coverage from repair cycles — stands as an
  owner decision. The surrounding authority gates are unchanged.
- **A severity-aware dispatch predicate stays declined**, because it would
  change an owner-set gate rather than fix a defect in this design.

## Cross-run provider state isolation

Providers keep persistent configuration directories. On the development host
`~/.codex` holds `history.jsonl`, `sessions/`, and multi-gigabyte thread-history,
state, and log stores; `~/.claude` holds `history.jsonl`, `projects/`, and
`sessions/`. A review's content reaching any of those would be readable by a
later review, so the channel is real rather than theoretical.

Relocating each provider's configuration directory into the per-invocation work
directory was considered and rejected. It requires a live credential in the
private copy: duplicating it creates a new credential-handling surface, and
hard-linking fails outright because the configuration directory and the output
directory are on different filesystems on the supported host.

The channel is closed at the provider instead, in two parts.

**A named, enforced flag set.** `PROVIDER_STATE_ISOLATION_FLAGS` names the flags
that suppress cross-run persistence — `--ephemeral` and `--ignore-user-config`
for Codex, `--no-session-persistence` and `--strict-mcp-config` for Claude — and
argument construction refuses to return a vector omitting any of them. A future
edit that silently drops one fails closed rather than degrading quietly.

**A measurement bound to the build.** Because those flags are provider behavior,
the guarantee expires when the provider does. A dispatch is admitted only when
`.kstack/evidence/staged-review-provider-isolation-v1.json` holds a measurement
whose `backendDigest` (the resolved binaries and their paths) and
`probeOutputSha256` (the version the backend reports) match the active backend,
and whose `hits` is zero. Otherwise the cycle returns
`provider-isolation-unmeasured` at zero invocations and zero budget charge. The
independent design gate reproduces the same requirement from the manifest.

The measurement mode dispatches a real brief carrying a probe token through the
runner itself, then scans the provider configuration files the run actually
modified. It generates the token internally and reports only counts, so the
token never reaches an operator transcript where a later scan could match its
own history rather than provider state. Scanning only modified files keeps the
check bounded — a file whose modification time did not move cannot have gained
the token during the run.

The accepted cost: every Codex or Claude upgrade invalidates the match and
requires re-measurement before the next staged review.

## Cycle budget accounting

A cycle is charged when it consumes provider capacity, not when it is attempted.
`cyclesCharged` is derived at manifest-write time from the invocation count, so
every outcome blocked before the primary spawns costs zero, and any cycle
reaching a provider costs exactly one whether or not the final was dispatched.
Deriving it in one place keeps the rule correct for statuses added later,
including `provider-isolation-unmeasured`. An interruption after the primary
spawns writes no manifest; that cycle consumed capacity and is charged manually.

## Reviewer prompt correction

The reviewer rules described a `## Prior final review feedback` section as
required workflow content unconditionally. A first cycle correctly has no such
section, so every legitimate first cycle drew a false failed check for its
absence — observed directly during isolation measurement. The rule now scopes
the requirement to briefs that carry the section and states that its absence in
a first cycle is correct.

## Disposition authority

A disposition decides that a named finding may stand without another design
cycle. Owner decision, 2026-09-01: that act belongs to a human role only. No
agent may author a disposition record that takes effect; an agent proposing text
for a human to review and sign is fine.

The record therefore carries an `authority` object naming a recognised human role
(`owner`), a person, and an attestation time, validated in the same shared
function the runner and the independent gate both evaluate. It is read only as a
regular file inside the project, so a record reached through a symbolic link out
of the tree discharges nothing on either path.

What this enforces is stated at its real strength. Three properties are
structural: the runner has no code path that writes a disposition record, every
reviewer is spawned without a write primitive (asserted as adjacent argument
sequences, so a disabling flag whose subject was dropped fails closed), and the
record must bind to the exact final envelope digest. What is not established is
authorship: providers and operator run as the same OS user, so the mechanism
cannot prove which keyboard produced the bytes — the same limit already accepted
for the unsigned local evidence set. The rejection of a record naming an agent as
its author is a tripwire, not a proof. Bare ai is deliberately absent from that
pattern because this project's own human owner identity contains it.

One stronger control exists and was deliberately not taken inside this thread.
This repository's safety hook could deny the disposition path to every agent tool
surface, making agent authorship structurally impossible rather than merely
unsupported. That requires new classification in the hook itself and a
control-plane reactivation whose blast radius is every agent session in this
repository, so it is proposed for owner decision rather than adopted here.

## Provider family separation

The family check rests on a stated assumption: two separately identified vendors
operate separate service-side state domains. It fails closed in every direction
the evidence permits — an unidentifiable or ambiguous family leaves the backend
unavailable, and two merely unidentified backends compare equal and are refused
rather than assumed distinct. The independent gate reproduces it under its own
reason code rather than folding it into a generic reproduction failure.

Its residual limit is recorded rather than implied closed: an aggregator or
gateway fronting both vendors would present two vendor identities over a single
service-side domain and defeat the separation without the check being able to
see it. That case is not detected.

## Owner decisions of record

Each entry records a decision taken by the project owner and relayed to this
thread by the team lead on the stated date. Quoted text is the instruction as
received. These are transcriptions with provenance, not acceptances authored
inside the thread: the design cites them by date rather than asserting
acceptance in its own voice. If a reviewer requires acceptance signed by the
owner directly rather than transcribed by an agent, that is a genuine open fork
and is recorded here as one rather than papered over.

### 2026-09-01 - Disposition authority is attestation-only for now

Received: "attestation-only accepted for now. Record it as an explicit, dated
owner-decision entry in the thread's decision record (not the brief asserting it
in its own voice) - don't build the structural hook-deny, that's repo-wide blast
radius for later, not this thread."

Effect: a disposition record names a human role, a person, an attestation time,
and binds to the final envelope digest. The repository safety-hook path deny
that would make agent authorship structurally impossible is deliberately not
built in this thread. The residual - the mechanism cannot prove authorship under
a single operating-system user - is accepted.

### 2026-09-01 - Reduced independent coverage during repair cycles is accepted

Received, on the ordered workflow's standing tradeoff: the owner accepts reduced
independent coverage during repair cycles as the price of spending one fewer
agent invocation per improvement cycle.

Effect: the second perspective is concentrated in the terminal independent
review rather than present in every repair cycle. The evidence for the
tradeoff's strength is on record: a primary approval at confidence 96 with zero
structured findings was followed by an independent final review returning six
failed checks, six security findings, three material dissents, and nine
unresolved questions on the same brief. The terminal pass catches what the
primary misses; what narrows is how many perspectives examine a design while it
is still being repaired.

### 2026-09-01 - The aggregator limit on provider-family separation is accepted

Received: state the residual "plainly rather than implying the check is
airtight", and treat the family-separation limit as an owner acceptance recorded
by date.

Effect: provider-family separation rests on the assumption that two separately
identified vendors operate separate service-side state domains. An aggregator or
gateway fronting both vendors would present two vendor identities over one
domain and defeat the separation undetected. This is accepted as a stated limit.
The check remains fail-closed for unidentifiable and ambiguous families.

## Runtime surface in the isolation identity

Owner decision, 2026-09-01, received as: "extend the measurement - do the real
work ... All three sub-problems if feasible: dependency-tree digest,
plugin-directory digest, and service-side config - if service-side config
genuinely isn't observable from the client, say so plainly and explain why,
don't fake coverage."

What inspection found, and what each sub-problem became:

- Dependency tree. Codex resolves to a static-pie ELF executable that embeds its
  own runtime, so its existing content digest already covers all of its code and
  there is no dependency tree to digest. Claude resolves to a native executable
  inside an npm package directory of eleven files; that directory is digested.
  Both link only against the system C library set, which is operating-system ABI
  surface owned by the platform block rather than provider identity, and is
  stated as excluded rather than digested.
- Plugin directory. Claude is spawned with --safe-mode, which its own
  documentation states disables plugins along with skills, hooks and project
  instructions; that flag is now pinned in the isolation flag set, so Claude's
  plugin directory is out of scope by construction rather than by measurement.
  Codex's --ignore-user-config covers only config.toml and --ignore-rules only
  .rules files, so its plugin directory can reach a review and is digested.
- Service-side configuration and account policy. Not observable from the client.
  Neither provider exposes an interface reporting account policy, model routing,
  or server-side feature state; the version probe is the only service-adjacent
  signal and it is client-reported. No probe is invented for it. This remains an
  open limit, stated rather than covered.

The surface binds the isolation measurement rather than the backend digest.
backendDigest answers which executable a role resolves to, and is compared
between the two roles to decide reviewer independence; folding provider-scoped
surface into it would make one binary used for both roles look like two. The
measurement identity is therefore the executable digest, the reported version,
and the runtime surface digest together.

Walk properties: entries sorted, regular files digested by content, symbolic
links recorded by target path and never followed, hard bounds of eight thousand
files and one gibibyte. Exceeding a bound or failing to read an entry makes the
backend unavailable rather than producing a partial digest. Content behind a
symbolic link that leaves the measured roots is outside the identity and is
stated as such.

## Interrupted-cycle charge

Owner decision, 2026-09-01, received as: "build the durable dispatch-start
marker - write it before the first provider spawn, have the next admission check
read and charge it automatically. Real enforcement, not documentation."

The prior treatment said an interrupted cycle is re-run at the same cycle number
and charged manually. That could not be enforced, because an interruption is
exactly the case where no manifest is written. A thread-scoped dispatch log now
records the cycle before the first provider spawns, flushed to disk, and lives
outside the operator-chosen output directory so a re-run into a fresh directory
still sees it. The next cycle must exceed the highest dispatched cycle for its
thread.

This changes the recovery rule rather than adding a marker to the old one: an
interrupted cycle is re-run at the next number, not its own. The earlier wording
is superseded, because charging a re-run that reuses the interrupted number
would have no effect on admission - the budget compares the cycle number to the
configured maximum, so a charge that does not advance the number is not a charge
at all.

## Deterministic evidence

- Full repository suite: `npm test` completed with 1113 tests, 1110 passed, zero
  failed, zero cancelled, and two Windows-only synthetic tests skipped on Linux.
  The staged suite reached 73 cases, adding a build with no isolation
  measurement, a measurement taken against a different build, a measurement that
  observed a leak, malformed evidence treated as absent rather than trusted, the
  evidence digest recorded on a matched dispatch, and the design gate rejecting
  dispatched evidence that records no measurement.
- Real-backend isolation measurements, both recorded with zero hits:
  Codex at `backendDigest`
  `24568013b53f2d247568c716f9d532a5e140f5d92a3f1ecd7ad4a2b824c4fd4a`,
  17 modified configuration files scanned, 2026-09-02.
  Claude at `backendDigest`
  `37459bd0d580f8283d5e71249940550a89a63906d7b3ef7e0080f95a0e18e4f0`,
  3 modified configuration files scanned, 2026-09-02.
  Both providers therefore authenticate and complete under the private home and
  the enforced flag set, which deterministic tests cannot establish.
- Install-health inventory:
  `node tests/helpers/generate-install-health-audit-manifest.mjs --check`
  passed after manifest regeneration.

## Closing corrections — supersede the cycle-6 brief's wording

The thread closes at cycle 6. Cycle 6's brief is immutable reviewed evidence and
is not edited; its digest matches its manifest. Cycle 6 raised four findings, all
of which are defects in that brief's wording rather than in the mechanism. The
corrected statements below supersede the brief and are the thread's final
statement of what the design claims.

### 1. Chain admission after an interruption (supersedes BLK-CHAIN)

The brief still carried the clause "the prior cycle number is exactly one less"
alongside the corrected interruption rule, so it read as requiring a published
predecessor at exactly one less and appeared to leave cycle N+2 inadmissible
after an interrupted cycle N+1.

The implemented rule, and the correct statement, is: a chained cycle is admitted
when its number is exactly one past the furthest the thread actually reached,
which is the later of the last published cycle and the last cycle recorded in the
dispatch log as having dispatched without publishing. The presented prior
manifest is the last published result, whatever its number; it is not required to
be exactly one less. After a published cycle N and an interrupted cycle N+1,
cycle N+2 is admitted using cycle N's manifest as its prior.

This is what the code does and what the regression test asserts: a completed
cycle 1, an interrupted dispatched cycle 2, then cycle 2 refused as spent and
cycle 3 admitted against cycle 1's manifest. There is no deadlock.

**Correction to this correction, found while closing.** The statement above was
true of admission only. The gate independently required the prior cycle to be
exactly one number back and required the manifest's own `sequenceValid`, which
the runner still computed against the published predecessor alone. Cycle 3 was
therefore admitted, dispatched, and then refused at acceptance with
`CONVERGENCE_EVIDENCE_INVALID` — the deadlock had moved downstream rather than
being closed, and it would have cost a real cycle to discover.

Both halves now use one predicate, `admissibleChainedCycle(published,
dispatched)`. The runner computes the dispatch floor before reading the prior
manifest and folds it into `sequenceValid`; the gate reads the dispatch log
itself, excludes the cycle's own entry, and recomputes the same number rather
than believing the manifest. A gap the log does not explain is still refused, so
this admits recovery from a recorded interruption without admitting a skipped
cycle.

The original regression test asserted only that admission did not block, and it
passed for an unrelated reason: its "interruption" was a fixture artifact rather
than a real hang. The test now forces a genuine interrupted dispatch and carries
the recovered cycle through to the gate, plus a negative case that removes the
log and confirms the same evidence is then refused.

### 2. Interruption charge authority (supersedes the verification section)

One sentence in the brief's verification section still said an interruption is
"charged by the operator", contradicting the block that describes the dispatch
log. The dispatch log is the sole authoritative source for an interruption
charge. The operator does not charge it and cannot decline to; the record is
written before the first provider spawns and the next cycle's admission reads it.

### 3. Disposition authority is asserted and recorded, not enforced

The brief claimed that only a human role may take the disposition act, phrased as
if the mechanism enforced it. It does not, and the claim is narrowed here.

What the mechanism enforces: a disposition record must name a recognised human
role, name a person, carry an attestation time, bind to the exact final review's
envelope digest, and be a regular file inside the project. The runner has no code
path that writes one, and every reviewer is spawned without a write primitive, so
nothing in the review workflow can author its own discharge.

What it does not enforce: any actor with write access to the project tree and
sight of the final-review digest can fabricate a syntactically valid record. The
agent-attribution check is a tripwire, not an authorization control. The human-only
boundary is therefore a recorded governance assertion, not a fail-closed
mechanism property, and the design should not be read as claiming otherwise. The
residual is accepted out of band; the control that would close it is named there.

### 4. Provider-family separation is bounded to directly served vendors

The brief claimed family separation removes the shared service-side domain. That
is too strong as stated. The corrected claim: for configurations in which each
provider family is served directly by its own vendor, separating families removes
the shared service-side state domain between the two roles.

Configurations in which an aggregator, gateway, or shared upstream fronts both
vendor identities are outside the supported environment for this property. The
admission rule cannot detect them, and no claim is made that it can. This is a
supported-environment boundary, stated rather than enforced, and the residual is
recorded out of band.

## Thread status: closed

Closed after six cycles by owner decision, plus one defect found and fixed during
closing: the chain-recovery rule was enforced at admission but not at the gate,
which would have deadlocked acceptance after an interruption. Nothing known to be
a real defect is left unaddressed. Every remaining item is a stated limitation: the four accepted
limitations recorded out of band, the open service-side configuration limit
recorded there as open rather than accepted, and the four narrowed claims above.

The high-water design preservation requirement remains unstarted under ticket
KSTK-103 and its predecessor thread, as it has been throughout; no block of this
thread delivered any part of it and none claimed to.

## Review question

Does this design correctly enforce solo primary improvement through a clean
readiness result before one different agent performs an independent final
review, bind every custody and isolation claim to evidence that actually
supports it, and preserve KStack's fail-closed evidence and authority
boundaries? Identify any current defect that should block adoption.
