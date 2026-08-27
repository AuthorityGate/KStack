# Dual-model decision protocol

Use this protocol for every material design decision when configured.

When `workflow.designGate.citationGrounding` is `advisory`, the runner builds
the canonical packet in memory, frames those exact bytes for both reviewers,
and binds its digest and encoding versions into the v2 envelopes and manifest.
The packet itself is not retained as a durable review artifact. The gate
independently reconstructs and parses the packet from the reviewed design and
accepts an `anchor_verified` citation only when `quotedText` is an exact
contiguous substring of a verified source-content span. A source label, record
wrapper, repository pathname, or uncaptured file is not citable evidence.

`kstack-source-record-v1` is the approved `KSTACK-SOURCE-RECORD-V1` wire
format. Each record is exactly `KSTACK-SOURCE-RECORD-V1\n`, then the fields
`ID <byte-length>\n<bytes>\n`, `LABEL <byte-length>\n<bytes>\n`,
`ROLE <enum>\n`, `INCLUSION <enum>\n`, and
`CONTENT <byte-length>\n<bytes>\n`, followed by
`END KSTACK-SOURCE-RECORD-V1\n`. Decimal lengths are shortest-form and count
UTF-8 bytes. Records concatenate without another separator. This layout is a
locked compatibility contract, not a provisional encoder detail.

Grounding is deliberately an anchor-existence advisory, not semantic proof.
Failed or missing anchors populate citation telemetry and `wouldBlock`; they
do not change the existing confidence, dissent, finding, or deterministic-check
gate result.

Advisory is effective only after the native platform check, exact-reproduction
smoke pass, and operator shadow `go`. The ordinary runner first performs the
keyless reject-only state prefilter. A candidate then crosses native validation,
instance-key/MAC verification, current receipt and fingerprint checks, and a
lock-guarded reservation before either v2 provider is dispatched. V2 input is
staged below `.kstack/state/`, inherited by descriptor, and jointly activated.
The runner uses one legacy recovery attempt per provider for a v2-attributable
unusable result; overlay-only citation failures do not recover.

The host-side lifecycle entry point is:

```bash
node <kstack-plugin-root>/scripts/kstack-citation-admin.mjs <command> \
  --project-root <repository-root>
```

Commands are `check-platform`, `smoke`, `shadow`, `sweep-staging`,
`reset-state`, `reset-native-build`, `reset-coordinator-lock-tombstones`,
`repair-instance-store`, and `repair-state-protection`. `shadow` additionally
requires `--prompt`, `--runs 5..10`, and `--judgment go|no-go`; deliberate key
replacement requires `repair-instance-store --regenerate` and makes existing
qualifications stale.

## Independence

Give Codex and Opus the same neutral decision brief. Do not include either
model's recommendation in the other's prompt. Consultation runs read-only and
without session persistence.

## Review rounds

One material-design round always consumes two provider invocations: one Codex
and one Opus. Before dispatch, enforce
`workflow.designGate.reviewBudget.maxRounds` and report the round and cumulative
invocation count. Track rounds, not wall-clock timing. Legacy configuration uses
four rounds. Do not dispatch a round that would exceed `maxRounds`. Round-limit
exhaustion returns `USER_DECISION_REQUIRED`; it never lowers the gate, suppresses
dissent, or silently starts another round.

After a `revise` or `block` outcome, a redesign request, or a round whose
synthesis surfaces residual findings, scope the next round by interaction risk,
not item count. Batch multiple small, well-specified items when all are
independent: they share no mechanism, no item's fix can contradict another
item's requirement, and a regression in one cannot be confused for a regression
in another. Prefer items likely to pass together and items that do not touch the
same subsystem as each other or as anything already validated at the current
confidence high-water mark.

Keep an item alone in its own round when it is architecturally entangled with
another item, or complex or high-risk enough that bundling would blur
attribution. The genuinely inseparable minimal-mechanism case remains a narrow,
complementary exception: when two sub-parts are one effective fix because
omitting either leaves the same vulnerability open, the minimal pair may travel
as one item. For example, an absolute-path launcher pin and its safe
command-quoting contract can be one item when pinning alone merely moves the
injection gap. Architecturally related items that can still be reviewed as
separate effective changes do not qualify; isolate them from each other.

Bundling does not relax per-item attribution. Every item in a batch must be
recorded with an individual `pass`, `fail`, or specific-reason outcome in each
reviewer's round report and in any per-thread item-tracking ledger the design
uses. An aggregate pass/fail for the round is insufficient. If a
batched-but-independent round regresses confidence, the synthesis must identify
which specific item is implicated before deciding what to keep and what to
reject.

This discipline is grounded in observed use: three consecutive rounds that
crammed 3-10 architecturally entangled findings together regressed confidence
and made the responsible change unknowable, while an isolated change later
produced a clean regression signal that exposed a previously unknown launcher
command-injection gap. The failure mode is entangled changes with no usable
attribution, never merely having more than one item in a round.

## Optional per-item ledger

**A per-item ledger is subordinate bookkeeping, never a design gate.** It never
determines `READY_FOR_USER_APPROVAL` or substitutes for
`kstack-design-gate.mjs`. A `VALIDATED` row means only that the specific claim
passed independent review at or above the thread's confidence high-water mark;
it is not whole-design approval and must never be read or reported as such. The
gate's confidence, security-finding, dissent, and deterministic-check
requirements remain the sole path to `READY_FOR_USER_APPROVAL`.

At the coordinating agent's judgment, use a living
`.kstack/decisions/<thread-id>-item-ledger.md` when many rounds or distinct
findings make item-level attribution materially useful; omit it for a small
thread converging in two or three rounds. Reuse
`.kstack/decisions/always-on-safety-hooks-2026-08-24-item-ledger.md` as the
canonical format: one item per row, status `VALIDATED`, `REJECTED`,
`OPEN-UNTESTED`, or `OPEN-CONFIRMED-BUG`, plus item-specific **Evidence** and
**Next action**. Read and update it in place every round that touches it, add
new items, preserve material evidence across status changes, and never let it
go stale. It complements, but does not replace, a whole-mechanism
rejected-options ledger.

## Required brief

Include:

- objective and user-visible outcome;
- observed repository and environment evidence;
- constraints and authority boundaries;
- options under consideration;
- failure modes and reversibility requirements;
- tests or evidence that would validate the decision; and
- unresolved questions.

## Synthesis

After both reports return:

1. Record each model's recommendation, strongest objection, confidence, and
   assumptions.
2. Separate agreement from superficial wording overlap.
3. Preserve dissent. Do not average incompatible recommendations.
4. Resolve evidence conflicts by inspecting primary artifacts.
5. Mark every disagreement, hedge, unverified assumption, unresolved question,
   and objective-scope divergence for direct owner clarification. Agreement
   does not excuse a proposal that lacks a trace to the objective or repository
   evidence.
6. After the first completed round's synthesis, and before any second-round
   draft, reviewer invocation, gate-based approval, or implementation handoff,
   follow `../skills/kstack-design-clarify/SKILL.md` relative to this reference.
   Its coordinating host performs a dedicated extraction pass over the actual
   round-one brief, both reports, their structured envelopes, and this
   synthesis; asks every source-linked question directly; and writes the user's
   confirmed answers to a `Status: LOCKED` record under `.kstack/decisions/`.
   This pass is not a third review and does not increment the round count.
7. Require `ROUND_ONE_CLARIFICATION_LOCKED` exactly once for the design thread.
   Round 2 and every later brief must cite the locked record and its digest and
   treat its answers as authoritative. A later reviewer may challenge an answer
   only with a new explicit reason surfaced to the user and a linked
   superseding decision; silent re-litigation is invalid.
8. Create the configured deterministic checks with the exact design digest.
9. Run `kstack-design-gate.mjs`. Combined confidence is the minimum reviewer
   confidence, never an average. The only passing result is
   `READY_FOR_USER_APPROVAL` with every required reviewer at or above the
   applicable configured threshold: `minimumConfidence` for rounds 1-10,
   `minimumConfidenceRound11Plus` for round 11+, or
   `minimumConfidenceSkillClass` when the operator explicitly tags the thread
   with `--skill-class`. Pass the current operator-tracked round with
   `--round N`; a missing or unrecognized round safely uses the round 1-10
   tier. The gate never infers skill class from content. Passing also requires
   zero failed or missing checks, zero security findings, zero material
   dissent, and no unresolved questions.
10. Write the accepted decision and rationale to
   `.kstack/decisions/<decision-id>.md` only when project persistence is enabled.

## Provider failure

Read `manifest.json` from the runner. `dual-complete` is the only status that
may be described as dual-model review. `single-model-fallback` must name the
missing provider. Follow `models.onUnavailable`: continue, ask, or stop.

A fallback can inform design iteration but cannot pass the design gate when the
missing provider is required. Malformed structured output also counts as a
provider failure.

## Implementation alteration

Implementation is bound to the user-approved design digest. If implementation
would materially alter that design, stop before applying the alteration. Write
a revised decision brief linked by `supersedesDesignDigest`, run a fresh
independent review invocation and deterministic gate, and obtain new user
approval. Never carry reviewer confidence or approval across design digests.

Run the helper with:

```bash
node <kstack-plugin-root>/scripts/kstack-dual-review.mjs \
  --prompt-file <decision-brief.md> \
  --project-root <repository-root> \
  --out-dir <review-output-directory>
```

Then evaluate it with:

```bash
node <kstack-plugin-root>/scripts/kstack-design-gate.mjs \
  --design <decision-brief.md> \
  --review-dir <review-output-directory> \
  --checks <checks.json> \
  --out <gate.json> \
  [--round <round-number>] \
  [--skill-class]
```
