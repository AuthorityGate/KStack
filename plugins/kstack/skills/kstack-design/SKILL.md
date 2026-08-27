---
name: kstack-design
description: Perform a full product and technical design review, compare viable options, and obtain independent Codex and Claude Opus analysis for material decisions. Use only when explicitly invoked for KStack design work after objectives are clear. Do not trigger implicitly or begin implementation.
---

# KStack Design

Produce an implementable design whose important decisions have visible evidence,
dissent, and user approval.

## Procedure

1. Validate `.kstack/config.json` and read the latest objective brief or obtain
   the objective from the conversation.
2. Use the configured design roles. Material design requires independently
   produced Codex and Opus reports. Role selection does not change the shared
   authority matrix.
3. Read `../../references/DUAL_REVIEW.md`, `../../references/SAFETY.md`, and
   `../../references/ARTIFACTS.md` relative to this skill directory.
4. Inspect the relevant source, tests, interfaces, data model, deployment path,
   and repository-native build instructions. Distinguish observed facts from
   assumptions.
5. Review every configured design lane. For the default lanes cover:
   - product behavior, scope, and user journeys;
   - UX states, accessibility, errors, recovery, and destructive actions;
   - architecture, boundaries, dependencies, concurrency, and failure modes;
   - data ownership, migrations, compatibility, retention, and encryption;
   - security, privacy, authorization, secrets, and abuse cases;
   - operations, rollout, observability, rollback, and support.
6. Present at least two viable options for each material decision when a real
   alternative exists. Include costs, failure modes, reversibility, and the
   evidence that would change the recommendation.
7. Write a neutral decision brief and run the dual-model helper described in
   `DUAL_REVIEW.md`. Do not show either reviewer the other's output.
   Before the first dispatch, read
   `workflow.designGate.reviewBudget.maxRounds` (legacy configs use the template
   default of 4 rounds), state that each round spends one Codex and one Opus
   invocation, and record and report the round number and cumulative provider
   invocations. Track rounds, not wall-clock timing. Do not start a round that
   would exceed `maxRounds`. Return `USER_DECISION_REQUIRED` so the owner can
   narrow scope, accept a residual, change the design, or explicitly amend the
   configuration; never silently extend the loop.
8. Synthesize agreement and dissent. Resolve factual conflicts from primary
   artifacts. Follow the configured unavailable-provider behavior.
9. Immediately after the first completed dual-review synthesis for a design
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
10. After a `revise` or `block` verdict, a redesign request, or a synthesis
    that surfaces residual findings, scope each next round by interaction risk,
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
11. Produce deterministic checks bound to the current design digest, then run
   `../../scripts/kstack-design-gate.mjs` with the operator-tracked round as
   `--round N`. Add `--skill-class` only when the owner explicitly classified
   this thread as a narrow, low-blast-radius tooling-convenience feature; never
   infer that class from the design. Remain in the design loop unless the gate
   returns `READY_FOR_USER_APPROVAL`: every required reviewer must approve at
   or above the applicable confidence tier (rounds 1-10, round 11+, or explicit
   skill class), every required check must pass, and current security findings,
   material dissent, and unresolved questions must all be zero.
   Repeated findings from the same disagreement class count against the same
   round limit; renaming or rephrasing a finding never resets the round counter.
12. Ask the user to approve only a design that cleared the gate.
13. Produce a design package with interfaces, data changes, implementation
    sequence, tests, rollout, rollback, risks, and explicit non-goals.
14. Beyond the mandatory locked round-one clarification record, record accepted
    decisions only when persistence permits it. A material change returned by
    `kstack-interrogate` supersedes the old digest and must traverse this
    complete procedure with fresh reports and approval.

Stop at an approved design. Continue through `kstack-implement` only when the
configured transition and edit authority allow it.

## Optional per-item ledger

**The ledger is subordinate bookkeeping, never a design gate.** It never
determines `READY_FOR_USER_APPROVAL` and never substitutes for running
`../../scripts/kstack-design-gate.mjs`. `VALIDATED` means only that one specific
claim passed independent review at or above the thread's confidence high-water
mark; it does not mean that the whole design is approved and must never be read
or reported that way. The gate's confidence, security-finding, dissent, and
deterministic-check requirements remain the sole path to
`READY_FOR_USER_APPROVAL`.

At the coordinating agent's judgment, a design thread with enough rounds or
distinct findings to benefit from item-level attribution may maintain a living
`.kstack/decisions/<thread-id>-item-ledger.md`. This tracks technical claims and
findings independently of the round bundles in which they appeared, so a mixed
result or regression in a batch can be traced to its responsible item. It is
optional: a small thread converging in two or three rounds does not need one,
and no ledger step is required for every design round.

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

## Optional Jira drafting

When `jira.enabled` is true and the design produces a concrete follow-up, offer
the sibling `kstack-jira` extension. It may call only the fully offline `draft`
command—never `approve`, `submit`, or any Jira network command. Treat
`authority.externalTicketCreation` as a calling-skill convention, not an
enforced CLI boundary.

## Optional memory ingestion

When `memory.enabled` is true and the user has approved a design that returned
`READY_FOR_USER_APPROVAL`, offer the sibling `kstack-memory` extension to
ingest the approved design package. Require explicit user confirmation before
ingesting; never ingest automatically.
