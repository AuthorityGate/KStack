---
name: kstack-review
description: "Run KStack's complete review for a new or unfamiliar environment: initialize configuration, interrogate objectives, inspect repositories and toolchains, review design with Codex and Opus, assess readiness, and optionally hand off to implementation. Use only when explicitly invoked for a full KStack review. Never trigger implicitly."
---

# KStack Full Review

Use this as the primary explicit entry point for a new environment.

## Stage 0: Configure

Locate `.kstack/config.json`. If it does not exist, read the sibling
`kstack-init/SKILL.md` and conduct that initialization conversation before
continuing. Do not silently accept defaults.

Read `../../references/SAFETY.md`, `../../references/ARTIFACTS.md`, and, when
Jira continuous tracking is enabled, `../../references/JIRA_TRACKING.md`
relative to this skill directory.

Use the configured role for each stage. Resolve `active` once at phase entry.
All stages use the same project authority matrix; model routing changes who
performs work, not what that role is allowed to do.

## Stage 1: Establish the objective

Follow the sibling `kstack-objectives/SKILL.md`. Produce a clear objective,
success evidence, constraints, non-goals, and failure boundaries. Stop if the
objective remains contradictory or requires an owner decision.

## Stage 2: Review the environment and repositories

Build an evidence-based map before recommending changes:

- repository roots, branches, remotes, worktrees, and uncommitted user changes;
- applicable agent instructions and permission boundaries;
- languages, wrappers, runtime versions, target compatibility, lockfiles, CI,
  and repository-native build/test commands;
- services, databases, external dependencies, devices, signing identities, and
  deployment targets relevant to the objective;
- architecture, data flows, security boundaries, recovery paths, and known
  operational constraints; and
- current reproducibility: which gates can run, which pass, and which are
  blocked.

Do not mutate the environment merely to make discovery easier. Ask before any
configured `ask` action.

## Stage 3: Review the design

Follow the sibling `kstack-design/SKILL.md`. Require independent Codex and Opus
analysis for material decisions according to configuration. After the first
completed round's synthesis, require the sibling `kstack-design-clarify` direct
questionnaire and its locked answer record before a second round, readiness
decision, approval request, or implementation handoff. Round 2 and later must
carry those answers as authoritative inputs. Never describe a single-model
fallback as consensus, and never substitute implementation-plan
`kstack-interrogate` for this owner-clarification gate.

## Stage 4: Readiness decision

First run the deterministic design gate. `READY` and `READY_WITH_RISKS` are
unavailable while it is `BLOCKED`. A model timeout, malformed envelope,
confidence below the applicable configured round or explicit skill-class tier,
missing or failed check, security finding, unresolved question, or material
dissent returns to Stage 3 with a revised design. Supply the operator-tracked
round to the gate and never infer skill class from thread content.

Return one status:

- `READY`: objective, design, authority, environment, and verification path are
  sufficient for implementation.
- `READY_WITH_RISKS`: implementation can proceed after the user accepts named,
  bounded risks.
- `BLOCKED`: a missing decision, capability, permission, or recovery path makes
  implementation unsafe or unverifiable.

Include the implementation sequence, verification matrix, rollback path, and
remaining user decisions.

When Jira continuous tracking is enabled, append `REVIEW_COMPLETED` with the
exact current counters for every scored readiness review. Append
`ITEM_BLOCKED` only for a real blocked work state, not merely a lower score.
Register any newly identified independently actionable follow-up before it is
scheduled, then sync the projection under the configured mode.

## Stage 5: Transition

- `plan-only`: stop.
- `ask`: request explicit implementation approval.
- `after-design-approval`: continue only if the user explicitly approved the
  reviewed design in the current conversation and edit authority is `allow`;
  otherwise ask.

When authorized, read and follow the sibling `kstack-implement/SKILL.md`.
Implementation completion always transitions through `kstack-qc`; it is not an
optional review preference.

## Optional Jira drafting

When `jira.enabled` is true and the review identifies a concrete follow-up,
offer the sibling `kstack-jira` extension. It may call only the fully offline
`draft` command. Never call or delegate `approve`, `submit`, or another Jira
network/mutation command from this workflow. Honor the prose-level
`authority.externalTicketCreation` convention; the CLI does not enforce it.
