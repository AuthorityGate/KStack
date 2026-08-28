---
name: kstack-objectives
description: Interrogate and formalize the objective, users, constraints, success evidence, non-goals, and failure boundaries for a proposed change. Use only when explicitly invoked for KStack objective review. Do not trigger implicitly and do not implement.
---

# KStack Objectives

Turn an initial request into a decision-ready objective before design begins.

## Procedure

1. Locate and validate `.kstack/config.json`. If absent, pause and invoke the
   `kstack-init` procedure.
2. Use the configured objectives role. Resolve `active` to the current host at
   phase entry. Role selection does not change the shared authority matrix.
3. Inspect available repository and environment evidence before asking the user
   anything discoverable from source, documentation, CI, or configuration.
4. Ask questions in small, coherent groups. Follow the configured depth:
   - `focused`: outcome, user, success evidence, non-goal.
   - `deep`: focused plus current behavior, constraints, dependencies, failure
     tolerance, migration, and rollout.
   - `exhaustive`: deep plus competing objectives, abuse cases, reversibility,
     operational ownership, observability, compatibility, and decision expiry.
5. Challenge solution-shaped requests by separating the desired outcome from
   the proposed mechanism. Preserve the user's mechanism as an option.
6. Identify contradictions explicitly. Do not resolve product tradeoffs by
   guessing; ask the user.
7. Produce an objective brief containing:
   - problem and affected users;
   - desired outcome and measurable evidence;
   - current behavior and observed facts;
   - constraints and authority boundaries;
   - non-goals;
   - failure, recovery, and reversibility expectations;
   - open questions and assumptions; and
   - readiness for design: ready, ready with risks, or blocked.
8. Save the brief under `.kstack/objectives/` only when configured persistence
   permits it. Otherwise return it in the conversation.
9. Read `../../references/JIRA_TRACKING.md`. When Jira continuous tracking is
   enabled, append `ITEM_CREATED` for the objective's root work item before
   reporting readiness. Every later independently actionable objective item
   receives its own stable item and creation event; a generic backlog card is
   not an acceptable substitute. Run projection sync after the durable append
   and apply the configured required/non-required failure rule.

Do not design or implement beyond identifying candidate directions needed to
clarify the objective.
