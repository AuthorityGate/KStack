---
name: kstack-design-clarify
description: Run KStack's mandatory direct-user clarification gate after the first completed design-review round. Use only from kstack-design at that exact checkpoint; this is not implementation-plan Interrogation or general objective discovery.
---

# KStack Design Clarification

Eliminate round-one uncertainty with the project owner before design iteration
can amplify it. This is a direct human questionnaire and decision-locking gate,
not another model review.

Read `../../references/DESIGN_ALTITUDE.md` and keep every question at the
10,000-foot design altitude. Ask the owner to resolve outcomes, architecture,
boundaries, block decomposition, dependencies, risk, and verification or
recovery intent. Do not ask the owner for exact files, code, commands,
migrations, provider payloads, or deployment steps unless the exact detail is
the material architecture decision; otherwise record it under deferred block
refinement.

## Entry gate

1. Enter only after one design thread has a completed first round: one neutral
   decision brief or Codex draft, independent Codex and Opus reports over that
   round, and the coordinating host's synthesis. A provider failure or
   single-model fallback is not a completed first round.
2. Use a stable design-thread identifier. Check for a project-local
   `.kstack/decisions/<thread-id>-round-1-clarification-<date>.md` record whose
   status is `LOCKED` and whose objective identifier, round-one invocation,
   design digest, and source digests match this thread. A matching record means
   this once-per-thread gate already ran; load it and do not repeat it.
3. If no matching locked record exists, stop the design loop here. Do not start
   round 2, run a later-round reviewer, request design approval, or hand off to
   implementation until this skill returns `ROUND_ONE_CLARIFICATION_LOCKED`.
4. Read `../../references/ARTIFACTS.md` and `../../references/SAFETY.md` relative
   to this skill directory. The locked answer record is mandatory even when
   ordinary raw-review retention is disabled. If project persistence or edit
   authority prevents writing it, return `ROUND_ONE_CLARIFICATION_BLOCKED` and
   ask the user to authorize the record or reconfigure persistence;
   conversation-only answers do not pass.

For an unapproved design thread begun before this gate existed, require the
gate before its next review round. Use the original objective and earliest
retained completed dual-review round. If an exact round-one source is missing,
do not silently substitute a later round: identify the missing source, compile
the available evidence as a migration questionnaire, and ask the user whether
to confirm it as the thread's authoritative migration record. Remain blocked
until the user confirms that limitation. Do not reopen a design already in
implementation solely to create this record.

## Dedicated extraction pass

The coordinating host performs one dedicated, lightweight extraction pass.
This pass is not a third design opinion, does not increment the design round,
and does not ask Codex or Opus to resolve their own uncertainty.

Read the complete objective brief, round-one decision brief or draft, Codex
report, Opus report, structured reviewer envelopes, and round-one synthesis.
Use raw reports too when they were retained. Create a traceability ledger that
contains every instance of:

- reviewer disagreement or materially different recommendations, scopes,
  mechanisms, priorities, constraints, or answers;
- hedging or uncertainty from either reviewer, including assumptions,
  conditionals, qualifications, missing specifications, confirmation requests,
  and unresolved questions;
- a factual, product, repository, environment, user, cost, threat-model, or
  operational assumption that was not verified against the objective or
  inspected repository state; and
- scope divergence between the objective and any round-one proposal. Compare
  the objective's actors, promised outcome, deliverables, constraints, and
  non-goals against every proposed subsystem, dependency, role, trust boundary,
  and operational obligation. Treat an addition with no explicit objective or
  repository-evidence trace as a question even if both reviewers agreed on it.

For each ledger item assign a stable question ID and record its category,
source file and section or structured field, a short exact excerpt when
available, the conflicting or unsupported claim, its relationship to the
objective, and the concrete decision needed from the user. Deduplicate only
when one question truly resolves all linked instances; retain every source
pointer on the merged item. Do not reduce the pass to the reviewers'
`unresolvedQuestions` fields or trust the synthesis to be exhaustive.

Before questioning, perform a completeness check in both directions: account
for every hedge, assumption, dissent item, and unresolved question in each
round-one source, then account for every material round-one proposal against a
specific objective clause or observed repository need. Record the completed
source inventory and scope comparison in the ledger.

## Direct questionnaire session

1. Ask the human user the ledger questions directly in coherent groups of one
   to three decisions. Continue across as many exchanges as necessary; do not
   collapse a detailed questionnaire into "any thoughts?" or ask the models to
   answer on the user's behalf.
2. Make each question specific: state what Codex said, what Opus said or left
   uncertain, what the objective says, and what changes under each viable
   answer. Offer concrete choices and a recommendation when evidence supports
   one, while always allowing the user to state a different answer.
3. For a scope divergence, ask whether the untraced proposal must be removed,
   is a necessary part of this objective for a user-stated reason, or belongs
   in a separate future objective. Do not normalize expansion merely because
   both reviewers developed it.
4. Mark an item resolved only by a direct user answer, an explicit declaration
   that it is out of scope, or the user's explicit acceptance of a named,
   bounded assumption and its consequence. "Unknown," deferral, silence, or an
   agent inference remains unresolved unless the user deliberately accepts the
   bounded assumption.
5. After all questions have dispositions, read back the complete decisions,
   accepted assumptions, removals, deferred-to-other-objective items, and
   design consequences. Obtain explicit user confirmation that this is the
   authoritative record before locking it.

## Locked decision record

Write `.kstack/decisions/<thread-id>-round-1-clarification-<date>.md` with:

- `Status: LOCKED`, the thread and objective identifiers, the round-one
  invocation ID and design digest, and paths plus SHA-256 digests for every
  source inspected;
- the extraction method, complete source inventory, and scope-alignment check;
- every question ID, category, source pointers, direct question, user-stated
  answer, accepted consequence, and disposition;
- an explicit empty unresolved-items section, the user's final confirmation,
  and the confirmation date; and
- any migration limitation or earlier clarification record this one
  supersedes.

Never edit a locked answer in place. A later round must treat it as
authoritative and include its path and digest in the next decision brief. Map
each resulting design change back to its question ID. Reviewers may not silently
re-litigate, reinterpret, or drift away from an answer. If new repository
evidence, a newly discovered safety constraint, or a new user request genuinely
conflicts with it, stop, show the exact conflict and consequence to the user,
and write a new linked decision record that explicitly supersedes the affected
answer before continuing.

Return `ROUND_ONE_CLARIFICATION_LOCKED` only after the record is written and
confirmed. This permits round 2 or, when no design change was required, the
existing deterministic design gate. It does not lower reviewer confidence,
change Fable arbitration or round-escalation rules, bypass
`READY_FOR_USER_APPROVAL`, or grant implementation authority.

`kstack-interrogate` remains a separate post-approval mechanism that classifies
implementation-plan drift as non-material, full-design, or blocked. Never use
that classification workflow as a substitute for this direct-user gate.
