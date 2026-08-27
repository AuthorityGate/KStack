# Objective brief: KStack domain-expert persona/prompt library

**Date:** 2026-08-23 · **Depth:** deep (per `.kstack/config.json` `workflow.objectiveDepth`)
**Status:** ready for design

## Problem and affected users

Every KStack dispatch today (design draft, dual review, QC remediation,
Fable arbitration) uses a generic task prompt with no domain-expertise
framing beyond "you are Codex/Opus/Fable doing this task." Confirmed by
reading `plugins/kstack/scripts/kstack-invoke-role.mjs`,
`kstack-dual-review.mjs`, and `kstack-provider-runner.mjs` in full, and
grepping the whole `plugins/kstack/scripts/` tree for
`systemPrompt`/`persona`/`role.*prompt`/`expertRole`: there is zero
existing persona or specialized-system-prompt infrastructure. A review of
a security-sensitive design gets the same undifferentiated reviewer framing
as a review of a documentation change.

The project owner (Kevin), verbatim: *"one item that might be critically
missing from kstack in an expanded detail is the specific prompts when
engaging security engineer, resilience expert, GUI designing, Full Stack
architect, Patent attorney, compliance auditor, governance architect, and
potentially other lighter use ones focused on Image design, Video Design,
media creation, news articles, etc."* The affected users are anyone
running a KStack design/review/QC session on work that would genuinely
benefit from a specific expert lens — the difference between a generic
"review this design" prompt and one that specifically primes the model to
think like a security engineer (threat modeling, attack surface, trust
boundaries), a resilience expert (failure modes, blast radius, graceful
degradation), a patent attorney (prior art, claim scope, novelty), a
compliance auditor (regulatory mapping, evidence trails, control
attestation), etc.

## Desired outcome and measurable evidence

KStack has a library of well-crafted, specific domain-expert system
prompts that a design/review/QC dispatch can invoke instead of (or
layered on top of) the current generic role framing, selected explicitly
by the calling skill/script based on what the work actually is. Success
evidence: a security-sensitive design dispatch demonstrably produces
different, more domain-appropriate scrutiny (e.g., explicit threat-model
language, attack-surface enumeration) when routed through a
"security-engineer" persona than the current generic reviewer framing
produces today — inspectable by comparing dual-review output structure/
content before and after.

## Current behavior (observed, not assumed)

- **No persona infrastructure exists.** Confirmed above — every dispatch
  gets only the specific task prompt text a skill/script constructs; there
  is no separate system-prompt layer, no persona selection, no stored
  prompt library anywhere in `plugins/kstack/`.
- **The closest existing precedent is `references/*.md`** (`DUAL_REVIEW.md`,
  `SAFETY.md`, `ARTIFACTS.md`, `CONFIG.md`) — these are shared,
  role-agnostic process/safety documents read by whichever skill invokes
  them, not per-domain persona prompts. Read these in full before
  designing to understand the existing prompt-composition pattern (how a
  skill currently assembles what a dispatch actually receives).
- **A related, currently-in-progress design** (a separate, independent
  KStack design thread running in parallel this same session) is building
  a `workflow.dispatchPolicy` mechanism that resolves `{role, effort}` for
  a dispatch from structured task metadata (`dispatchKind`, risk signals).
  That design's objective brief is at
  `.kstack/objectives/reasoning-effort-policy-2026-08-23.md` — read it for
  context on the metadata-driven dispatch shape it's proposing, since a
  persona-selection mechanism would plausibly want to compose with it
  (e.g., a dispatch's metadata could carry both an effort/role decision
  AND a persona selection). **Do not merge these two designs or block on
  each other** — they are independent, parallel threads with no shared
  state today; if this design finds a natural integration point, name it
  as a future compatibility note, not a hard dependency.

## Constraints

- **Scope the domain list realistically for v1.** The owner named:
  security engineer, resilience expert, GUI designer, full-stack
  architect, patent attorney, compliance auditor, governance architect
  (named as apparently higher-priority/"heavier" use), plus lighter-use
  ones: image design, video design, media creation, news articles. Do not
  assume all of these need equally deep, fully-crafted prompts in v1 —
  propose a concrete, justified subset for v1 with genuinely
  well-crafted, specific prompt content (not placeholder stubs), and a
  clear extension path for the rest. Proportionality matters here the
  same way it has elsewhere this session: a fully exhaustive prompt
  library for 11+ domains in one design round is likely disproportionate;
  a solid mechanism plus 2-4 genuinely excellent example personas
  (including at least one from the "heavier" list and one from the
  "lighter" list) is more valuable than 11 shallow ones.
- **Prompt quality is the actual deliverable, not just the mechanism.**
  Unlike most of this session's design work (which has been mechanism/
  schema-focused), the user explicitly asked for "specific prompts... in
  an expanded detail" — meaning the ACTUAL WRITTEN PERSONA PROMPT CONTENT
  is a first-class part of what "done" means for whichever personas ship
  in v1, not just a slot where content could go. Any example persona
  included in the draft should be genuinely usable, specific, and
  well-researched for that domain (e.g., a security-engineer persona
  should reference real threat-modeling frameworks/methodology by name
  where appropriate, not generic "think about security" filler).
- **Must not weaken KStack's existing authority/safety model.** A persona
  prompt changes HOW a model reasons about a task, not WHAT it's
  authorized to do — read `references/SAFETY.md` and confirm the design
  states this boundary explicitly (a persona cannot grant new tool
  access, bypass review gates, or change the dual-review independence
  requirement).
- **Consider real-world domain accuracy/liability carefully for the
  higher-stakes personas** (patent attorney, compliance auditor,
  governance architect) — a "patent attorney" persona producing
  confidently-wrong legal analysis is a real risk. The design should
  address whether/how these personas' output gets framed to the end user
  (e.g., explicit "not legal advice, this is a drafting aid" framing
  baked into the persona prompt itself) rather than assuming the persona
  label alone is sufficient context.
- **Selection mechanism**: propose how a persona gets selected for a given
  dispatch — explicit caller choice, inferred from `dispatchKind`/task
  content, or both — with a real recommendation and tradeoffs, matching
  the two-option-minimum requirement for material decisions.

## Process notes

Follow this session's standing corrected process: Codex drafts first (not
Opus), Opus reviews independently and blind, loop to convergence (never
auto-stop — round thresholds only escalate rigor/Fable, never terminate),
Fable arbitrates only on genuine need (real unresolved disagreement, or an
identical finding recurring across rounds with demonstrated zero
progress) — never on round count alone. Effort: High by default for
ordinary rounds, per the corrected `~/.claude/CLAUDE.md` policy;
escalate only on a genuine per-dispatch signal.

This is the fourth parallel, independent design thread running this
session (alongside citation-grounding confidence verification, Reflexion
semantic retrieval, and the reasoning-effort/agent-routing policy) — it
has no shared state with any of them and should not be merged with any of
them.
