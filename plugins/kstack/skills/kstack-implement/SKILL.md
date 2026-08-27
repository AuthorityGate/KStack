---
name: kstack-implement
description: Implement a user-approved KStack design, preserving repository state and verifying the result against the approved objective and design package. Use only when explicitly invoked or when kstack-review reaches its configured implementation transition. Never infer commit, push, merge, deployment, device installation, or destructive authority from edit permission.
---

# KStack Implement

Implement only an approved, review-ready design.

## Entry gate

1. Validate `.kstack/config.json`.
2. Identify the approved objective, design, decisions, implementation sequence,
   and verification matrix. If they are absent or materially stale, return to
   `kstack-review`.
3. Read the design gate artifact and require `READY_FOR_USER_APPROVAL`, at
   least the configured combined-confidence threshold (minimum 90), zero failed
   checks, zero security findings, zero material dissent, and a digest matching
   the approved design.
4. Confirm the current repository state has not invalidated the design.
5. Apply both host permissions and the KStack authority matrix. The more
   restrictive rule wins.
6. Preserve all pre-existing user changes. Do not reset, overwrite, clean, or
   reformat unrelated work.
7. Require `workflow.phaseModels`; legacy configuration must be refreshed with
   `kstack-init`. Use its implementation role. Role routing never alters the
   shared authority matrix.

## Implementation loop

1. Before every implementer dispatch, including a QC remediation, derive two
   to four keywords from the task or design area, such as a component name,
   file path, or bug class. Run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/kstack-reflexion.mjs" lookup --project-root . --config .kstack/config.json --keywords k1,k2,k3`.
   On a host without the Claude plugin-root variable, resolve the absolute
   KStack plugin root from this loaded skill's location and use the same
   `scripts/kstack-reflexion.mjs` path; never resolve it relative to the project
   working directory. KStack's `setup --copy` performs this resolution when it
   installs the copied skill.
   Put the returned `## Known Past Lessons (do not repeat)` block verbatim at
   the very top of the implementer's context, before the task description.
   Always include the block, including its no-match text, so lesson provenance
   and lookup execution remain auditable. Label it as prior-project-derived
   context: consider each lesson with judgment against the current design and
   evidence rather than obeying an inapplicable lesson blindly. This explicit,
   visible lookup is separate from optional `kstack-memory` retrieval and does
   not change memory's no-auto-injection boundary.
2. Work in the smallest coherent increments that preserve a runnable state.
3. Use repository-native wrappers, toolchains, tests, and release conventions.
4. Verify behavior, not only compilation. Exercise failure, recovery,
   compatibility, migration, and rollback paths named in the design.
5. Before acting on an implementation issue, user prompt, workaround,
   dependency/toolchain change, discovered constraint, proposed deviation, or
   QC remediation that changes the approved plan, run the sibling
   `kstack-interrogate/SKILL.md`. Do not implement the alteration first.
6. Continue only on `PLAN_CHANGE_APPROVED`, after recording the revised plan
   wording and evidence. `FULL_DESIGN_REQUIRED` returns to `kstack-design` for
   a fresh digest, independent Codex/Opus review, the mandatory post-round-one
   direct-user clarification record for a new or still-unapproved design thread,
   deterministic gate, and user approval. Do not reopen a thread already in
   implementation solely because it predates the clarification gate.
   `INTERROGATION_BLOCKED` and `USER_DECISION_REQUIRED` stop the affected branch.
7. Record non-material implementation deviations and their evidence. A
   deviation is not non-material merely because code has already been written.
8. Do not weaken tests, validation, security, or data-preservation behavior to
   obtain a passing result.

## External actions

Treat each action separately: commit, push, pull request, merge, deployment,
device installation, and destructive operation. Ask or stop according to the
exact configured authority. Never uninstall an application, clear application
data, rewrite history, or destroy a database as an upgrade workaround.

## Post-implementation QC

After repository-native verification, run the sibling `kstack-qc/SKILL.md`
with the configured QC role. High-risk work uses both Codex and Opus. A
`FIX_REQUIRED` result permits a bounded remediation and a new QC pass; if that
remediation changes the plan, interrogate it first. `FULL_DESIGN_REQUIRED`
returns to design. Never describe implementation as complete until current
evidence is `QC_PASSED`.

Use this capped Actor/Evaluator/Reflector loop:

1. Run the Actor with the lesson block from Implementation loop step 1, then
   run the independent Evaluator. On a genuine-defect failure, run the
   Reflector procedure in `kstack-qc` before the next Actor dispatch. Repeat
   lookup so the newly recorded lesson is in the retry context. The ensuing
   code/test change is ordinary remediation round 1; set `qcFixRound` to 1
   before its QC pass.
2. If that pass finds another genuine defect, reflect and look up again before
   ordinary remediation round 2. Set `qcFixRound` to 2 before its QC pass.
3. A failure after round 2 does not immediately stop for the user. Apply the
   owner's standing requirement verbatim: "the max with just Codex and Claude
   Opus is 2, the third round needs to include fable to solve the rounds."
   Confirm `.kstack/config.json` has an available Fable-backed
   design-conflict/arbitration role, then give Fable a structured brief with
   the approved design/plan excerpt relevant to the failure, the failed
   ordinary remediation rounds 1 and 2 diffs (or accurate summaries when
   large), those two QC critiques verbatim, and every lesson returned for the
   task keywords. Treat Fable's response as a binding directive for the next
   Actor remediation, just as a configured design-conflict arbitration is
   binding. Re-run lesson lookup, make the directed change, set `qcFixRound` to
   3, and run QC. Fable grants no additional authority, and a material plan
   change still traverses the Interrogation/design gates.
4. If the Fable-directed round also fails, return `USER_DECISION_REQUIRED`
   after three counted remediation attempts (ordinary rounds 1-2 and the
   mandatory Fable-directed round 3): full design, stop, or continue outside
   KStack without a passed claim. If Fable is not configured or is unavailable,
   return `USER_DECISION_REQUIRED` after round 2 and explicitly report that
   mandatory Fable arbitration could not run; never silently skip it.

## Completion

Report changed files, observed test results, unrun gates, accepted deviations,
rollback instructions, and the precise status: `complete (QC passed)`,
`implementation complete; QC pending/failed/stale`, or `blocked`. Do not claim
a deployment or device validation unless it was performed and verified.

## Optional Jira drafting

When `jira.enabled` is true and implementation leaves a concrete follow-up,
offer the sibling `kstack-jira` extension. It may call only the fully offline
`draft` command—never `approve`, `submit`, or any Jira network command. Honor
the prose-level `authority.externalTicketCreation` convention; it is not an
enforced CLI boundary.
