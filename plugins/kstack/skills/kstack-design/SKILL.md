---
name: kstack-design
description: Perform a full product and technical design review, compare viable options, and stage independent Codex and Claude Opus analysis after one primary agent reaches the readiness threshold. Use only when explicitly invoked for KStack design work after objectives are clear. Do not trigger implicitly or begin implementation.
---

# KStack Design

Produce a backlog-ready 10,000-foot design whose important decisions have
visible evidence, dissent, and user approval. Do not produce the implementation
or deployment plan in this phase.

## Procedure

1. Validate `.kstack/config.json` and read the latest objective brief or obtain
   the objective from the conversation.
2. Use the configured ordered design roles: the first is the primary improvement
   agent and the second is the independent final reviewer. The default is
   Codex then Opus, but Opus then Codex is equally valid. Role selection does
   not change the shared authority matrix.
3. Read `../../references/SKILL_SCOPE.md`, `../../references/DUAL_REVIEW.md`, `../../references/SAFETY.md`,
   `../../references/ARTIFACTS.md`, and
   `../../references/DESIGN_ALTITUDE.md` relative to this skill directory. Also read
   `../../references/JIRA_TRACKING.md` when Jira continuous tracking is enabled.
   For a user-facing surface, read `../../references/PRODUCT_EXPERIENCE.md` and
   require the sibling `kstack-experience` contract before design closure.
4. Treat the objective brief as the 50,000-foot input and keep this loop at
   10,000 feet. Inspect enough relevant source, tests, interfaces, data model,
   deployment boundary, and repository-native build instructions to validate
   feasibility and constraints. Distinguish observed facts from assumptions.
   Do not turn the design into exact file edits, source code, commands,
   migrations, provider payloads, deployment steps, or a block-by-block build
   transcript. Those details are deferred until one approved Jira delivery
   block is consumed during implementation.
5. Review every configured design lane at decision altitude. For the default lanes cover:
   - product behavior, scope, and user journeys;
   - UX states, accessibility, errors, recovery, and destructive actions;
   - architecture, boundaries, dependencies, concurrency, and failure modes;
   - data ownership, migrations, compatibility, retention, and encryption;
   - security, privacy, authorization, secrets, and abuse cases;
   - operations, rollout, observability, rollback, and support intent.
   For user-facing work, bind the primary user/job, product promise, shared
   brand/voice, tokens/components/assets, critical journeys, full state matrix,
   accessibility, responsive/input matrix, visual baselines, and performance
   evidence. Compare each material journey's alternatives independently.
6. Present at least two viable options for each material decision when a real
   alternative exists. Include costs, failure modes, reversibility, and the
   evidence that would change the recommendation.
7. Write the neutral decision brief in the mandatory `KSTACK-DESIGN-10K-V1`
   shape from `DESIGN_ALTITUDE.md`. It must define stable architecture blocks,
   their boundaries and dependency order, cross-block contracts, acceptance
   intent, and what remains deferred to block refinement. It must explicitly
   remain `Implementation-ready: no`. Before spending any provider invocation,
   run `../../scripts/kstack-workflow-contract.mjs design --file <design>` and
   stop on any error. Then run the staged helper described in `DUAL_REVIEW.md`.
   The primary alone reviews and improves the current design
   until it returns `approve`, confidence at least
   `workflow.designGate.reviewSequence.primaryReadinessConfidence` (93 by
   default), and zero failed checks, security findings, material dissent, and
   unresolved questions. Only then dispatch the independent final reviewer.
   Before any secondary dispatch, require the trigger-policy decision described
   in `DUAL_REVIEW.md`. Round count alone must remain `PRIMARY_ONLY`; roadblock
   advice may run before 93 but cannot satisfy the later final-review trigger.
   Reject same-agent review, and require another provider family at a high-risk
   boundary.
   When an owner request, bounded roadblock, material uncertainty, or material
   dissent warrants early advice, use the staged runner's advisory trigger with
   the exact evidence digest. Its receipt must state that final review remains
   unsatisfied; never promote advisory output into closure evidence.
   Selection of the configured review workflow is standing authorization for
   every qualifying dispatch: do not pause for another user approval, an exact
   authorization phrase, an authorization file, or a user-entered packet or
   batch hash. Secret-scan and dispatch automatically when the readiness
   predicate passes. Packet digests are integrity bindings, not permission
   tokens. If the provider execution host independently requires approval,
   identify that external boundary without representing it as a KStack rule.
   Give the final reviewer the same neutral current design, never the primary
   report or synthesis. Use the staged runner's single-flight private provider
   workspaces, minimal environment, no-tool/sessionless invocations, bounded
   process-tree termination, and dead-owner crash scavenging; do not replace
   them with direct provider commands. Before the first primary cycle, read
   `workflow.designGate.reviewBudget.maxRounds` (legacy configs use the template
   default of up to 42 cycles), state that a pre-threshold cycle spends one primary
   invocation and a readiness-passing cycle adds one final-review invocation,
   and record the cycle number and cumulative provider invocations. Track
   cycles, not wall-clock timing. Either way the cycle costs exactly one of
   `maxRounds`; a `not-dispatched` final changes the invocation count, not the
   budget charge. Do not start a cycle that
   would exceed `maxRounds`. Return `USER_DECISION_REQUIRED` so the owner can
   narrow scope, accept a residual, change the design, or explicitly amend the
   configuration; never silently extend the loop.
   Pass `--first-cycle` on the opening cycle of a thread and
   `--prior-manifest <prior-review-dir>/manifest.json` on every later one; the
   runner refuses to dispatch without exactly one of them. After a
   `final-not-approved` cycle the repaired brief must both differ from the
   rejected brief and carry a `## Prior final review feedback` section stating
   what that review found and how the design now answers it. That section is the
   whole feedback path back to the primary: copy the findings as brief content,
   and never paste the rejected reviewer's report, confidence, or verdict.
   Create `.kstack/decisions/<thread-id>-design-lineage.json` before cycle 1
   with `kstack-design-lineage.mjs init`. Before every later full-design cycle,
   write a proposal containing a testable `hypothesis`, exact
   `changedClausePaths`, and the applicable accepted and rejected evidence IDs
   from that lineage, then run `kstack-design-lineage.mjs preflight`. A failed
   preflight consumes zero reviewer invocations. After each completed cycle,
   run `kstack-design-lineage.mjs advance` with the exact review result. This is
   part of design, not optional reporting: a new cycle cannot blindly try a
   different edit without stating what it retained from successful attempts and
   what failed evidence it will not repeat.
   If lineage advancement emits `EARLY_WARNING_REQUIRED` after the configured
   cycle 5-8 boundary, immediately dispatch one lightweight staged advisory
   review using the recorded stalled/regressed-cycle evidence. It is automatic
   under the selected workflow, cannot edit the design or satisfy final review,
   and does not remove the later full independent final gate.
8. Apply `workflow.designGate.reviewSequence.finalAcceptanceConfidence`
   separately to the independent final reviewer (81 by default), regardless of
   cycle number. A final `approve` or `revise` at or above 81 completes the
   review. Convert every final failed check, security finding, material dissent
   item, unresolved question, and otherwise-unexplained `revise` verdict through
   the disposition rules in `SKILL_SCOPE.md`. Create a distinct mandatory
   bug-fix/backlog item only for an `IN_SCOPE_BUG`, then move forward; do not
   reopen the full design loop for accepted intake or expand KStack into the
   host application's responsibilities. If the final returns `block` or falls
   below 81 after a clean primary result of at least 93, freeze that exact
   digest as the accepted high-water parent and enter bounded targeted final
   remediation. Do not reopen unrestricted design. Do not use the final
   reviewer as a co-author on every repair cycle. Synthesize agreement
   and dissent only after both reports exist. Resolve factual conflicts from
   primary artifacts and follow the unavailable-provider behavior.
9. Immediately after the first completed staged final-review synthesis for a design
   thread, pause and read the sibling `kstack-design-clarify/SKILL.md`. Run its
   complete direct-user questionnaire and require
   `ROUND_ONE_CLARIFICATION_LOCKED`. This once-per-thread gate applies even when
   both reviewers approved round 1. Do not start round 2, request design
   approval, or proceed to implementation without its locked decision record.
   For round 2 and every later round, include that record's path and digest in
   the decision brief, treat its answers as authoritative, and map design
   changes to its question IDs. A later round may challenge an answer only by
   surfacing a new, explicit reason and consequence to the user and recording a
   linked superseding decision; it may never drift or re-litigate silently.
10. After a primary `revise`/`block`, a final `block` or sub-81 score, or a
    redesign request, scope each next round by interaction risk,
    not item count. Batch multiple small, well-specified items when they are
    independent: they share no mechanism, no item's fix can contradict another
    item's requirement, and a regression in one cannot be confused for a
    regression in another. Prefer items likely to pass together, and avoid
    batching items that touch the same subsystem as each other or as anything
    already validated at the current confidence high-water mark.
    Keep an item alone when it is architecturally entangled with another item,
    or complex or high-risk enough that bundling would blur attribution. An
    exception remains for sub-parts that form a genuinely inseparable minimal
    mechanism: if either omitted part leaves the same vulnerability open, the
    minimal pair may travel as one item. For example, an absolute-path launcher
    pin and its safe command-quoting contract can be one item when pinning alone
    merely relocates the injection gap. Related items that do not meet that
    narrow test stay isolated from each other.
    Bundling never relaxes per-item attribution. Every batched item must be
    recorded with an individual `pass`, `fail`, or specific-reason outcome in
    each reviewer's round report and in any per-thread item-tracking ledger. If an
    independent batch regresses confidence, the synthesis must identify the
    specific implicated item before deciding what to keep or reject; never
    apply only an aggregate pass/fail to the batch. This discipline prevents
    architecturally entangled changes from being crammed into one round with no
    way to tell which part caused a regression; multiple items alone are not
    the failure mode.
    Read `../../references/DUAL_REVIEW.md`'s "Confidence regression handling"
    section before scoping this round: never build the next round on top of
    one that regressed relative to the running best-known confidence. Revert a
    regressed whole-brief round before continuing. Once a thread has run more
    than roughly 3-5 cycles without reaching primary readiness, or shows any
    regression, switch to the default-on per-item ledger below and grade one
    item per round against its own specific finding rather than the aggregate
    score, which can move for reasons unrelated to that item.
    In targeted final remediation, record immutable finding IDs, allowed clause
    paths, and a semantic delta budget. Change and independently grade one item
    at a time. A cleared item stays cleared even if a later whole-document score
    is lower. Reject an unrelated clause delta and retain the prior baseline.
    Two failed isolated attempts on one item require an owner decision or a
    nonblocking cross-model consultation without adding scope. A later
    full-design continuation from the frozen parent is invalid; there is no
    valid "continue cycle 45" path.
11. Produce deterministic checks bound to the current design digest. For a
   user-facing repository, first run
   `node ../../scripts/kstack-experience.mjs phase-gate --project-root . --contract .kstack/experience.json --phase design`.
   Its contract/source digest is required evidence; prose and visual scores
   cannot replace it. Then run `../../scripts/kstack-design-gate.mjs` with the operator-tracked cycle as
   `--round N`. Add `--skill-class` only when the owner explicitly classified
   this thread as a narrow, low-blast-radius tooling-convenience feature; never
   infer that class from the design. The gate also verifies that final review
   was preceded by a reproducible clean primary readiness result. Remain in the design loop unless the gate
   returns `READY_FOR_USER_APPROVAL`: the primary must have a clean approval at
   or above its 93 readiness floor, the independent final reviewer must return
   `approve` or `revise` at or above its separate 81 acceptance threshold, and
   every required deterministic check must pass. Preserve all accepted final
   review defects as mandatory bug-fix intake; do not misclassify them as a
   reason to restart staged design.
   Repeated findings from the same disagreement class count against the same
   round limit; renaming or rephrasing a finding never resets the round counter.
12. Ask the user to approve only a design that cleared the gate.
13. Produce a 10,000-foot design package with responsibility boundaries,
    cross-block interface contracts, material data implications, delivery-block
    dependency order, verification intent, rollout/rollback intent, risks, and
    explicit non-goals. It must be sufficient to build the full backlog but
    deliberately insufficient to execute implementation or deployment.
14. Beyond the mandatory locked round-one clarification record, record accepted
    decisions only when persistence permits it. A material change returned by
    `kstack-interrogate` supersedes the old digest and must traverse this
    complete procedure with fresh reports and approval.
15. When Jira continuous tracking is enabled, register each new independently
    actionable design-ledger item with `ITEM_CREATED`, append
    `REVIEW_COMPLETED` after every scored round, and append
    `DESIGN_VALIDATED` only after the gate passes. Include exact review counters
    and evidence digests. Sync the projection after each durable append.
16. After the user approves a design that cleared the gate, enter backlog
    realization before implementation. Create
    `.kstack/backlogs/<thread-id>.json` using `kstack-delivery-backlog-v1` and
    materialize every architecture block as one distinct Jira item. Also
    materialize every `implementationIntake` row from the gate as a mandatory
    bug-fix item, preserving its ID, kind, severity when present, and exact
    design/review digest binding. Require a
    confirmed Jira key for every block when Jira tracking is enabled; a local
    outbox event or queued draft alone does not prove that the Jira backlog
    exists. Run `../../scripts/kstack-workflow-contract.mjs backlog --design
    <approved-design> --file <backlog> --jira-required`. Do not start
    implementation until the complete backlog passes. If mutation authority or
    Jira availability prevents completion, return `BACKLOG_REALIZATION_BLOCKED`
    instead of bypassing the phase.

Stop at an approved design plus a validated complete backlog. Continue through
`kstack-implement` only when the configured transition and edit authority allow
it. Design approval alone never authorizes implementation.

## Per-item ledger (default-on past a few cycles)

**The ledger is subordinate bookkeeping, never a design gate.** It never
determines `READY_FOR_USER_APPROVAL` and never substitutes for running
`../../scripts/kstack-design-gate.mjs`. `VALIDATED` means only that one specific
claim passed independent review at or above the thread's confidence high-water
mark; it does not mean that the whole design is approved and must never be read
or reported that way. The gate's confidence, security-finding, dissent, and
deterministic-check requirements remain the sole path to
`READY_FOR_USER_APPROVAL`.

Maintain a living `.kstack/decisions/<thread-id>-item-ledger.md` by default —
not merely at the coordinator's discretion — once a thread has run more than
roughly 3-5 cycles without reaching primary readiness, or as soon as
confidence regresses relative to the running best-known value (see
`../../references/DUAL_REVIEW.md`'s "Confidence regression handling"). Before
that point, coordinator judgment still governs: a small thread converging in
two or three rounds does not need one. This tracks technical claims and
findings independently of the round bundles in which they appeared, so a mixed
result or regression in a batch can be traced to its responsible item, and so
a whole-brief regression can be correctly distinguished from a validated item
whose fix worked despite the aggregate score moving for unrelated reasons.

Reuse
`.kstack/decisions/always-on-safety-hooks-2026-08-24-item-ledger.md` as the
canonical format rather than defining a new one. Use one row per item, one of
`VALIDATED`, `REJECTED`, `OPEN-UNTESTED`, or `OPEN-CONFIRMED-BUG`, an
**Evidence** column that preserves item-specific review support, and a
**Next action** column for anything still open or replaced. Every round that
touches the ledger must read it first and update it in place after synthesis;
add newly discovered items, preserve material evidence across status changes,
and never let the document go stale. This complements rather than replaces a
whole-mechanism rejected-options ledger, which records bad approaches at a
coarser grain than individual claims.

## Jira backlog realization

When `jira.enabled` is true, read `jira.deliveryRecordPath` when configured,
otherwise read `.kstack/jira-delivery-stack.json` before
offering Jira linkage. Only `existing-validated` and `verified` prove a usable
delivery mapping. Treat `skipped` as an owner choice and every other state as a
release-readiness gap. Never infer a backlog from `jira.projects[]` alone.
For a `verified` mapping, also require every preview-bound roadmap operation to
be complete; project/board existence without the planned work items is an
incomplete onboarding state. When offering a new preview and a concrete design
ledger exists, offer to generate a closed `kstack-jira-roadmap-v1` manifest
from its accepted open items rather than defaulting to generic lifecycle work.

After approval, the design must produce a complete delivery-block backlog. The
sibling `kstack-jira` extension may draft work items offline. Host-side
continuous tracking or an explicitly authorized Jira operator performs the
actual projection. If onboarding is missing and `jiraAdministration` permits
it, the project may proceed through preview, interactive hash confirmation,
apply, and verified read-back. Issue-creation authority and Jira-administration
authority remain separate. If the project requires Jira, every delivery block
must have a confirmed Jira key before implementation; an offline draft is not
sufficient.

## Optional memory ingestion

When `memory.enabled` is true and the user has approved a design that returned
`READY_FOR_USER_APPROVAL`, offer the sibling `kstack-memory` extension to
ingest the approved design package. Require explicit user confirmation before
ingesting; never ingest automatically.
