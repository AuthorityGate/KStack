# Objective brief: arbitrary-persona virtual engineering panels

**Date:** 2026-08-24 · **Depth:** deep (per `.kstack/config.json` `workflow.objectiveDepth`)
**Status:** ready for design

## Problem and affected users

KStack's material-design workflow has a useful forced-convergence shape: Codex
and Opus independently review the same digest-bound brief, the design remains
blocked unless both individually reach the configured confidence threshold and
all blocking findings, dissent, and questions clear, and a bounded Fable path is
available elsewhere in KStack when ordinary two-role remediation genuinely
cannot resolve a conflict. That shape is hardcoded around named model roles and
does not let an author assemble a virtual team of arbitrary domain voices.

The owner wants that gridlock-until-convergence behavior generalized to an
arbitrary set of two or more named personas. Examples include a digital
marketing expert, engineering expert, and CEO voice jointly producing an
investor campaign, but the mechanism must support arbitrary deliverables such
as documents, plans, designs, and code. It is not a marketing-only feature and
is not limited to KStack software-design decisions.

The affected users are panel authors, deliverable owners, persona maintainers,
and operators paying the time and provider cost of repeated review. They need
multiple specialist perspectives to exert real blocking pressure rather than
appear as one-shot suggestions, while retaining a truthful record when a panel
cannot converge because of missing facts, incompatible values, provider
failure, or a genuinely irreducible disagreement.

## Owner-scoped outcome and measurable success evidence

A panel author can define an objective, a shared deliverable, an arbitrary
ordered set of at least two named personas, and a per-panel confidence
percentage. The percentage is author-selected rather than a fixed enum and
must support the owner's example of `88`; it is the panel analogue of
`workflow.designGate.minimumConfidence`, not a requirement that every panel use
KStack design's current 90-point safety floor.

For each candidate deliverable version, every required persona receives an
independent, persona-framed dispatch over the same immutable deliverable and
objective evidence. The panel iterates with visible critiques and revisions.
Ordinary completion requires every required persona individually to meet or
exceed the configured threshold; confidence is never averaged across personas.
A bounded arbitration or stop path must preserve unresolved dissent instead of
calling a partially converged artifact complete.

Success requires reproducible evidence that:

- panel specifications with `N >= 2`, including `N` greater than the number of
  configured model backends, validate and run deterministically;
- named persona identity, prompt version/digest, actual backend, objective,
  deliverable version/digest, threshold, round, and review envelope are bound
  into auditable artifacts;
- multiple persona voices can share Codex, Opus, or Fable backends through
  separate ephemeral dispatches without being mislabeled as distinct model
  identities;
- a panel with confidences `94, 91, 87` at threshold `88` remains blocked, while
  the same exact reviews at threshold `87` can clear only if all other required
  acceptance conditions also clear;
- a new candidate digest invalidates prior votes and requires the configured
  personas to re-evaluate according to the selected convergence protocol;
- no provider sees another persona's initial report before producing its own;
- timeout, malformed output, missing provider, stale artifact, threshold or
  roster mutation, arbiter failure, deadlock, cycling, and cost exhaustion have
  explicit terminal or recovery states that never masquerade as convergence;
- the mechanism works through at least one document fixture and one code/plan
  fixture without embedding deliverable-specific semantics in the core gate;
  and
- current KStack dual review continues to work unchanged unless and until a
  separately approved migration deliberately places it on the generalized
  engine.

## Current behavior and observed repository facts

- `.kstack/config.json` configures exactly three concrete model entries:
  `codex`, `opus`, and `fable`, all at High effort in this repository. Codex is
  invoked through the `codex` command; both Opus and Fable are model selections
  on the `claude` command. Persona count therefore cannot be equated with
  backend count.
- The same config sets `workflow.designGate.minimumConfidence` to `90`,
  `requiredReviewers` to `codex` and `opus`, and all six configured design lanes
  to product, UX, architecture, data, security, and operations.
- `kstack-config.mjs` accepts two or more unique string IDs in
  `designGate.requiredReviewers`, but separately restricts the model-role
  vocabulary to `active`, `codex`, `opus`, and `fable` and requires
  `phaseModels.design` to be exactly Codex and Opus. It validates the design
  threshold as an integer from 90 through 100.
- `kstack-dual-review.mjs` explicitly constructs Codex and Opus commands,
  dispatches those two in parallel, writes `codex` and `opus` envelopes, and
  declares `dual-complete` only when both complete. Its advisory-grounding
  coordinator calls `runJointProcesses`, whose implementation rejects any unit
  count other than exactly two.
- The dual runner gives both reviewers the same neutral decision brief in
  isolated, read-only/no-tool sessions. It records the design digest,
  invocation, raw-output and configuration digests, process status, and
  structured review. The review schema includes decision, confidence, failed
  checks, security findings, material dissent, recommendation, strongest
  objection, and unresolved questions.
- `kstack-design-gate.mjs` already uses the minimum reviewer confidence rather
  than an average and blocks on a non-approve decision, a confidence below the
  configured threshold, reviewer failed checks, configured security findings,
  material dissent, unresolved questions, stale/malformed bindings, incomplete
  review status, or deterministic-check failure. However, it expects envelopes
  and provider manifest records under IDs named by `requiredReviewers`; the
  present runner cannot create an arbitrary set of them.
- `kstack-invoke-role.mjs` supports only the single-provider roles `opus` and
  `fable`. It passes a caller prompt to one configured Claude-backed provider
  and emits a directive manifest; it is not a panel runner or structured
  arbiter ballot.
- `kstack-qc/SKILL.md` invokes Fable after ordinary remediation cannot clear a
  defect and treats its directive as binding subject to unchanged authority and
  plan-change gates. Its current prose describes continuing, need/evidence
  sensitive re-arbitration beyond round 3. `kstack-implement/SKILL.md` still
  describes a three-attempt cap and then user decision. This inconsistency is
  observed evidence that arbitration/stop semantics are not yet one reusable
  executable protocol.
- The earlier `expert-persona-library-2026-08-23` round-one objective and
  evidence established a sound persona concept: a persona is a bounded,
  versioned domain reasoning lens with substantive methods, evidence needs,
  output expectations, epistemic limits, and an explicit reminder that it
  grants no authority. Its proposed security-engineer, resilience-expert,
  compliance-auditor, and news-article-journalist bodies were independently
  judged domain-specific rather than label-swapped filler. Round-one reviewers
  also identified important composition requirements: collision-safe framing,
  prompt/persona digest binding, signal provenance, high-stakes content
  review/staleness controls, and protection against review shopping. Those
  round-one concepts are input here; no later persona-library round or its
  unrelated storage-hardening direction is in scope.
- KStack has no implemented arbitrary-persona catalog or panel mechanism. The
  owner has confirmed that neither KStack's dual review nor the previously
  compared gstack project supplies prior art for N-party forced consensus.
  gstack's sequential role passes deliberately surface disagreement at one
  human gate and continue, which is not this objective.

## Constraints and authority boundaries

- **Unanimous threshold is the ordinary completion contract.** Every required
  persona must meet the panel's percentage. Majority, average, or weighted
  confidence cannot silently substitute for that owner requirement. A bounded
  stop may preserve a usable draft and dissent, but must label it incomplete.
- **Confidence is workflow metadata, not calibrated probability.** A displayed
  `88%` must not claim an 88-percent chance of correctness. The design must
  decide what observable rubric anchors each persona's score and whether clean
  acceptance, empty blocking findings, and answered questions are required in
  addition to the numeric threshold.
- **Persona is not backend identity.** Arbitrary `N` must work with the actual
  configured Codex, Opus, and Fable entries. Several personas may need separate
  sessions on one backend. Reports must disclose that correlation and must not
  market same-model persona prompts as independent models.
- **Persona is not authority.** A persona changes how a task is analyzed. It
  cannot grant tools, network, editing, publishing, legal authority, commit,
  push, deployment, destructive action, exception acceptance, gate bypass, or
  owner approval. Host policy and KStack's authority matrix still apply, with
  the more restrictive boundary winning.
- **Deliverable neutrality has limits.** The convergence engine may bind bytes,
  route prompts, record findings, and gate a version generically. Artifact
  creation, patch application, validation, and domain evidence may require
  explicit adapters. The design must name that boundary rather than pretending
  one prompt can safely edit every artifact type.
- **Independence must be precise.** Initial persona reports for a candidate are
  blind to one another. Later convergence work may deliberately expose a
  normalized issue ledger or arbiter directive, but that transition and its
  provenance must be visible. Separate sessions on the same backend reduce
  conversational contamination but do not create model diversity.
- **Arbitration cannot manufacture consensus.** Fable or another configured
  mediator may resolve facts, expose tradeoffs, and propose a candidate change;
  it cannot rewrite a dissenting persona's score or grant completion. If the
  final contract is unanimity, every required persona must re-evaluate the final
  digest after mediation.
- **Costs must be bounded without round-count theater.** Work grows with
  personas, rounds, replicated backends, and artifact size. The mechanism needs
  configurable dispatch/cost/time ceilings and evidence-based stall/cycle
  detection. Reaching round `N` alone neither proves failure nor justifies
  silently lowering the threshold.
- **Configuration is immutable within an invocation lineage.** Threshold,
  persona roster, persona prompt versions, backend assignments, objective, and
  terminal policy must be digest-bound. Changing one creates a new lineage or
  an explicitly linked superseding panel run; it cannot rescue a blocked run.
- **Backward compatibility and reversibility.** Existing config files, dual
  review artifacts, and the current design gate must remain valid by default.
  An opt-in generalized mechanism should be removable without rewriting
  historical reviews or making incomplete panel artifacts look approved.
- **No implementation or external action in this thread.** Do not modify
  KStack runtime code, tests, provider configuration, setup, host settings, or
  persona library content. Do not commit, push, deploy, publish, or open a pull
  request.

## Required design decisions

The design must neutrally compare at least two genuinely viable mechanisms and
make these choices explicit for later owner clarification:

1. round-wide unanimous digest barriers versus an issue-ledger/subround
   protocol that reconvenes the full panel only on a final candidate;
2. the acceptance predicate beyond numeric confidence and the exact treatment
   of abstention, not-applicable expertise, missing evidence, and non-blocking
   recommendations;
3. explicit persona-to-backend pinning, balanced assignment, or replicated
   cross-backend evaluation when `N` exceeds the configured backend count;
4. whether Fable is reserved as a non-voting mediator, may also serve as a
   normal persona backend, and what independence claim is allowed in either
   case;
5. issue-level mediation, owner resolution of value conflicts, qualified
   incomplete output, cycle/stall detection, and the hard ceilings that form
   the bounded stop contract;
6. how a candidate is authored and revised without allowing the synthesizer to
   omit minority objections or expose initial reports prematurely;
7. the panel specification, artifact/envelope/manifest lineage, digest and
   schema bindings, retention/redaction rules, and compatibility path from the
   existing dual-review implementation; and
8. artifact adapters, deterministic checks, evaluation fixtures, rollout,
   observability, cost controls, and rollback evidence required before the
   generalized mechanism can replace any existing workflow.

## Failure, recovery, and reversibility expectations

A provider failure, malformed persona report, secret-scan rejection, changed
artifact, changed roster/threshold, missing adapter evidence, or stale prompt
must block that candidate's completion. Retry must be bounded and recorded; it
must not erase the failed attempt or reveal peer reports to the retrying initial
reviewer. Resuming a panel must reconstruct the same immutable lineage before
dispatching additional work.

The convergence protocol must detect exact artifact cycles and substantively
unchanged issue sets. It must distinguish “still making measurable progress”
from “same conflict, new wording.” When the configured arbitration/time/cost
boundary is exhausted, the terminal state must include the best candidate,
every persona's final score/verdict, the unresolved issue ledger, arbitration
history, and safe next choices. That state is not `complete`.

Rollback must first be operationally simple: disable the opt-in panel path and
return callers to their prior workflow while preserving historical panel
artifacts as non-authoritative evidence. A later migration of KStack dual review
onto the generalized engine requires equivalence fixtures for `N=2`, an
explicit artifact/schema migration decision, and a separately approved design.

## Open questions and assumptions for design

- The owner's phrase “free-form percentage” is treated as a panel-local numeric
  percentage rather than a fixed enum and must admit `88`. Exact precision and
  lower-bound policy remain a design question; lowering it during a run is not
  allowed.
- Does every configured persona always count as required, or may the author
  explicitly declare non-voting advisers at panel creation? Any adviser must be
  visually and structurally excluded from the completion claim.
- Must a persona that lacks domain evidence return low confidence, abstain, or
  block with questions? Each choice affects whether panels deadlock honestly or
  manufacture certainty.
- Is normal completion strictly unanimous clean acceptance, with all partial
  results incomplete, or does the owner want an explicitly separate terminal
  class such as `QUALIFIED_WITH_DISSENT` that is usable but never represented as
  panel convergence?
- May the same configured Fable backend act as both a panel persona and later
  mediator in one lineage, or should mediation require a backend/prompt role
  that did not cast an initial ballot?
- What default ceilings should apply to persona count, concurrent dispatches,
  rounds, arbitration interventions, elapsed time, provider cost, and artifact
  bytes, and which are hard stops versus user-approved extensions?
- Who owns the candidate synthesis step: a designated author persona, rotating
  proposer, neutral configured backend, deterministic patch merger, or the
  human owner? The core gate must remain valid for each choice.

These questions do not reopen the owner-scoped objective. They define the
material implementation and terminal-semantics choices that independent
reviewers and the mandatory post-round-one owner clarification must resolve.

## Process notes

This is Design & Architecture tier work at High reasoning effort. Codex authors
a neutral round-one brief; Codex and Opus independently review the same exact
bytes at High effort. Round 1 ends after synthesis, digest-bound deterministic
checks, and the design-gate result. The separately coordinating session—not
this thread—runs `kstack-design-clarify`. Do not start round 2, request design
approval, implement, commit, push, or open a pull request here.
