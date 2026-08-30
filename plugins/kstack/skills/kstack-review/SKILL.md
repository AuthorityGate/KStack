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

Read `../../references/SKILL_SCOPE.md`, `../../references/SAFETY.md`,
`../../references/ARTIFACTS.md`, and, when
Jira continuous tracking is enabled, `../../references/JIRA_TRACKING.md`
relative to this skill directory.
Also read `../../references/DESIGN_ALTITUDE.md`; its phase boundaries are
identical on Codex and Claude CLI.

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
- for user-facing surfaces, the existing product promise, brand/content rules,
  tokens, components, assets, critical journeys/states, accessibility,
  responsive/visual coverage, performance evidence, and field feedback; and
- current reproducibility: which gates can run, which pass, and which are
  blocked.

Do not mutate the environment merely to make discovery easier. Ask before any
configured `ask` action.

## Stage 3: Review the design

Follow the sibling `kstack-design/SKILL.md`. Require independent Codex and Opus
analysis for material decisions according to the closed trigger policy. A
secondary agent is not selected by round count. Required unavailability blocks;
advisory roadblock/uncertainty/dissent/audit review records degraded
availability when unavailable. After the first
completed round's synthesis, require the sibling `kstack-design-clarify` direct
questionnaire and its locked answer record before a second round, readiness
decision, approval request, or implementation handoff. Round 2 and later must
carry those answers as authoritative inputs. Never describe a single-model
fallback as consensus, and never substitute implementation-plan
`kstack-interrogate` for this owner-clarification gate.
For a user-facing surface, also read `../../references/PRODUCT_EXPERIENCE.md`,
follow the sibling `kstack-experience/SKILL.md`, and require its validated
contract and executable lane plan before readiness.

## Stage 4: Readiness decision

First run the deterministic design gate. `READY` and `READY_WITH_RISKS` are
unavailable while it is `BLOCKED`. Primary timeout, malformed envelope,
sub-93 primary readiness, a final `block` or final score below 81, or a missing
or failed deterministic check returns to Stage 3 with a revised design. An
accepted final score of at least 81 does not restart design: carry its failed
checks, findings, dissent, and questions into mandatory bug-fix backlog intake.
Supply the operator-tracked round to the gate and never infer skill class from
thread content.

Disposition accepted final findings through `SKILL_SCOPE.md`. Only
`IN_SCOPE_BUG` items become mandatory KStack backlog work; host-owned and
out-of-scope findings do not expand the product.

Treat selection of this configured workflow as standing authorization for every
qualifying independent final-review packet. Do not request or wait for a
separate confirmation, authorization phrase, authorization file, packet hash,
or batch hash. After clean primary readiness, secret scanning, and packet
construction succeed, dispatch the configured final reviewer automatically.
Continue to require exact packet binding, a sessionless no-tool provider, and
strict result admission. A provider host may enforce its own execution approval;
report that as an external host boundary, never as a KStack packet requirement.

Return one status:

- `READY`: objective, design, authority, environment, and verification path are
  sufficient for implementation.
- `READY_WITH_RISKS`: implementation can proceed after the user accepts named,
  bounded risks.
- `BLOCKED`: a missing decision, capability, permission, or recovery path makes
  implementation unsafe or unverifiable.

Include the delivery-block order, verification intent, recovery/rollback
intent, and remaining user decisions. Exact implementation and deployment
steps belong to later block refinement.

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

Before requesting or beginning implementation, require the approved design's
complete `kstack-delivery-backlog-v1` artifact to pass the shared backlog gate,
including one confirmed Jira key per block when Jira tracking is enabled. When
authorized, read and follow the sibling `kstack-implement/SKILL.md`.
Implementation completion always transitions through `kstack-qc`; it is not an
optional review preference.

## Optional Jira drafting

When `jira.enabled` is true and the review identifies a concrete follow-up,
offer the sibling `kstack-jira` extension. It may call only the fully offline
`draft` command. Never call or delegate `approve`, `submit`, or another Jira
network/mutation command from this workflow. Honor the prose-level
`authority.externalTicketCreation` convention; the CLI does not enforce it.
