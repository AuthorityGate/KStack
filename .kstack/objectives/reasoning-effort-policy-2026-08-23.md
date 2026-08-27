# Objective brief: KStack-owned reasoning-effort and agent-routing policy

**Date:** 2026-08-23 · **Depth:** deep (per `.kstack/config.json` `workflow.objectiveDepth`)
**Status:** ready for design

## Problem and affected users

Every KStack dispatch (design drafts, dual review, QC remediation, Jira
automation, memory operations) currently runs at a single static reasoning
effort per role, set once in `.kstack/config.json`
(`models.codex.reasoningEffort`, `models.opus.effort`,
`models.fable.effort` — confirmed by reading
`plugins/kstack/scripts/kstack-config.mjs`'s default schema, all three
currently `"high"`). There is no mechanism in KStack itself that varies
effort by what the dispatch actually is (drafting a from-scratch design vs.
executing an already-approved deploy vs. mission-critical security work).

Today that variation is handled entirely outside KStack: the orchestrating
agent (Claude Code / Sonnet, running the KStack skills) is expected to read
free-text guidance in the user's global `~/.claude/CLAUDE.md` ("Codex
reasoning-effort tiers by task type" section) and manually pass
`-c model_reasoning_effort=<value>` on each `codex exec` invocation, or set
`effort` when invoking Opus/Fable via `kstack-invoke-role.mjs`. This is
error-prone and already caused a real incident this session: a
`~/.claude/CLAUDE.md` rule auto-escalating "any multi-step loop past round
3" to the Highest effort tier was applied uniformly across a 19-round QC
remediation loop and two 9-round design-review loops, all at `xhigh`,
which burned through the account's monthly spend allowance mid-session and
halted all work. The rule itself was reasonable in isolation but its
enforcement depended entirely on an LLM orchestrator correctly recalling
and applying prose guidance on every single dispatch, with no structural
check.

Affected user: the project owner (Kevin), who bears the cost/token
consequences of effort-tier decisions and has now stated the underlying
principle directly: *"you need to have kstack make that determination. I'm
giving ground rules that can be adjusted in order to use the correct
effort and agent to conserve tokens while providing a good - great
response."* The ground rules themselves (the tier table, the
mechanical-execution-vs-authoring distinction, the Fable round-5 mandate,
the "route Highest-tier coding to Opus not Codex-xhigh" rule) are
explicitly things Kevin wants to be able to adjust over time — they are
policy inputs, not something to hardcode once.

## Desired outcome and measurable evidence

KStack's own code (not the orchestrating agent's memory of prose
instructions) determines the reasoning effort and agent/role for a given
dispatch, based on an explicit, adjustable policy that the calling skill or
script consults programmatically. Success evidence: a KStack skill or
script preparing a dispatch (a Codex design draft, a dual-review
invocation, a QC remediation round, a Jira automation call) calls a shared
policy-resolution function/module with a structured description of the
work (e.g., a task-category label, loop/round context, risk tags) and gets
back a concrete `{effort, role}` decision — without any orchestrating agent
having to independently recall or reapply the tier rules from prose
memory. A round-count-based runaway (like this session's 19-round xhigh
loop) becomes structurally impossible unless the policy itself is written
to allow it.

## Current behavior (observed, not assumed)

- **Static per-role effort only.** `.kstack/config.json`'s `models.codex`,
  `models.opus`, `models.fable` each carry one fixed `reasoningEffort`/
  `effort` value, validated by `kstack-config.mjs`'s schema (confirmed:
  `reasoningEffort: "high"`, `effort: "high"` for both Opus and Fable in
  the default schema and in this repo's actual `.kstack/config.json`).
  There is no per-dispatch, per-phase, or per-task-type override mechanism
  anywhere in the codebase — read the actual current schema/validation
  logic before designing, don't assume beyond what's confirmed here.
- **Phase-based ROLE routing already exists as precedent, effort does
  not.** `workflow.phaseModels` (confirmed in `kstack-config.mjs`, lines
  ~33 and ~183-224) already lets each phase (design, implement, qcGate,
  interrogationGate, etc.) declare which roles (codex/opus/fable)
  participate, with schema validation (e.g., `design` must be exactly
  `codex` + `opus`; `qcGate.maxFixRounds` must be `3`). This is the closest
  existing structural precedent for "config-driven, validated,
  skill-consulted routing decisions" — the new effort/agent policy should
  probably follow a similar shape (declarative, schema-validated, read by
  the scripts that actually dispatch), but confirm this by reading the
  actual `phaseModels` implementation, don't assume it transfers cleanly.
- **Where effort is actually consumed today**: confirmed via
  `plugins/kstack/scripts/kstack-dual-review.mjs` (line ~83:
  `if (config.models.codex.reasoningEffort) codexArgs.push('-c',
  \`model_reasoning_effort="${config.models.codex.reasoningEffort}"\`);`)
  and `plugins/kstack/scripts/kstack-provider-runner.mjs` (line ~36:
  `'--effort', modelConfig.effort || 'high',` for Claude-backed roles).
  Both read a single static config value at dispatch time; read both files
  in full before designing to confirm the exact call sites and whether any
  other scripts (`kstack-invoke-role.mjs`, `kstack-jira.mjs`,
  `kstack-memory.mjs`) have their own separate effort-consuming code paths.
- **This session's incident, as a concrete design input**: the
  now-corrected `~/.claude/CLAUDE.md` rule (see its "Codex reasoning-effort
  tiers by task type" section, most recently edited 2026-08-23) encodes
  the ground rules Kevin wants KStack itself to enforce: a task-type table
  (Design & Architecture = High; Coding & Deployment logic-authoring =
  High; Deployment-execution & SQL/DB commands = Medium; Mission-Critical
  Security / Multi-repo refactor / proofs / optimization = Highest, routed
  to Opus rather than `codex -c model_reasoning_effort=xhigh` specifically
  because Opus delivers that effort tier without the same credit burn
  rate). **Corrected 2026-08-23, after this brief was first written**: an
  earlier version of this paragraph described a "Fable-arbitration-at-
  round-5 mandate" — that has since been retired entirely, including as a
  repeating/cyclical rule. Kevin, verbatim: *"fable also should not be
  needed ever round after 5 again that is a static rule and only when
  arbitration is truly needed."* Bringing Fable in is a routing decision
  triggered only by genuine substance (a real unresolved Codex/Opus
  disagreement, or an identical named finding recurring across
  consecutive rounds with demonstrated zero progress) — never by round
  count, at any cadence. Separately and independently, Kevin also
  corrected: *"do not run fable at top effort that is not needes [sic]"*
  — Fable's own reasoning effort is NOT automatically top/max just
  because it was invoked; it follows the same need-based rule as every
  other dispatch (default to its configured tier, currently High;
  escalate only on a genuine per-dispatch signal). These are two separate
  corrections — WHEN Fable is invoked (need-based, never round-based) and
  WHAT EFFORT it runs at once invoked (need-based, not automatic max) —
  and this design must get BOTH right: no round-count predicate anywhere
  in the schema, and arbitration must not hardcode a Highest/max effort
  tier by default. This generalizes to an explicit rejection of "escalate
  effort just because the loop is on round N" as a standalone trigger, for
  any dispatch kind, not only arbitration. Read this file
  section in full as design input, but do not treat its exact prose
  wording as something to reproduce verbatim in code — extract the
  underlying policy shape (categories, signals, decisions) and design a
  structure that can represent it and be adjusted without a CLAUDE.md
  prose edit.

## Constraints

- **KStack's authority model is unchanged by this feature.** This is a
  policy-resolution mechanism, not a new authority/approval gate — it must
  not grant any dispatch new permissions (commit, push, external network
  calls, etc.) it wouldn't otherwise have. Read `references/SAFETY.md` and
  the design authority matrix before proposing anything that touches what
  a role is allowed to do, not just how hard it reasons.
- **Must not become a second, competing effort-selection authority.**
  Today the orchestrating agent (Sonnet/Claude Code) also independently
  reasons about effort per the global CLAUDE.md. Design how these two
  layers relate: does the KStack-side policy fully supersede the
  orchestrator's judgment for KStack-dispatched work (with the
  orchestrator just passing task metadata and trusting KStack's decision),
  or does the orchestrator retain an override for genuinely
  KStack-external dispatches (e.g., an ad hoc Codex investigation outside
  any KStack skill)? This is exactly the kind of design decision that
  needs two independently reasoned options with tradeoffs, not a default
  assumption.
- **Adjustability is a hard requirement, not a nice-to-have.** Kevin's own
  framing: "ground rules that can be adjusted." The policy shape must be
  editable (config, not hardcoded logic) without requiring a code change
  for an ordinary tier/category adjustment — but schema-validated the same
  way `phaseModels` is, so a malformed policy fails closed with a clear
  error rather than silently misapplying.
- **Must not reintroduce the round-count-auto-escalation bug in a new
  form.** Whatever mechanism is designed, a loop reaching round N must not
  by itself be sufficient justification for escalating effort — escalation
  needs a concrete signal (task-type/criticality classification, or a
  named stuck-finding condition), matching the corrected CLAUDE.md
  language. If the design wants to let round-count contribute as ONE
  input among several (e.g., feeding into the Fable-round-5 trigger, which
  is a legitimate mandatory behavior, not an effort-escalation bug), it
  must explain clearly why that specific use is not the same failure mode
  as the retired rule.
- **Cost is a live, real constraint right now.** This design is happening
  immediately after an actual monthly-spend-limit incident in this exact
  session. Prefer solutions that are cheap to evaluate (a pure function
  over structured input, not another LLM call to classify the task) unless
  a strong case is made for needing model judgment to classify a dispatch.
- **Backward compatibility**: existing `.kstack/config.json` files
  (including this repo's own, and any other project using KStack) must
  either continue to work unchanged (a sensible default policy applies)
  or have a clear, documented one-time migration — do not silently change
  behavior for projects that haven't opted into the new policy shape.

## Process notes

Follow this session's standing corrected process: Codex drafts first (not
Opus), Opus reviews independently and blind, loop to convergence (never
auto-stop — round thresholds only escalate rigor/Fable, never terminate),
Fable arbitrates only if a loop passes round 5 without resolving. Effort
for this design loop itself: High (not Highest/xhigh) by default for
ordinary rounds, per the corrected `~/.claude/CLAUDE.md` policy — this is
recursion-worthy to note explicitly: this design session should itself be
run under the SAME disciplined effort defaults it's designing a mechanism
to enforce structurally elsewhere.

This item was explicitly requested to start as a third parallel design
thread alongside two already-in-flight, unrelated design loops (citation-
grounding confidence verification, Reflexion semantic retrieval) — it has
no shared state with either and should not be merged with them.
