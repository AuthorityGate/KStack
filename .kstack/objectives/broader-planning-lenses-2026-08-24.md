# Objective brief: optional broader planning lenses for KStack design

**Date:** 2026-08-24 · **Depth:** deep (per `.kstack/config.json` `workflow.objectiveDepth`)
**Status:** ready for design

## Problem and affected users

KStack's material-design procedure requires every configured design lane to be
reviewed. The current project configuration and the default configuration both
name six lanes: product, UX, architecture, data, security, and operations. The
`kstack-design` skill gives each lane a substantive remit, from product behavior
and user journeys through rollout, rollback, and support. This is a strong
feature-level review frame.

The open question is whether that fixed frame is also sufficient when the work
needs broader planning scrutiny. Examples include challenging the strategic
premise and time horizon of a plan, or tracing the full adoption lifecycle of a
developer-facing product rather than only its end-user interaction states. Today
KStack has no separately named, configurable concept for those broader lenses.
The only repository references to `workflow.designLanes` are the default/config
definition, validation that it is a non-empty array, and the skill instruction
to review every configured lane; the dual-review runner delivers the authored
decision brief to both reviewers and does not resolve or inject lanes itself.

The affected users are KStack owners and design authors. They need material
decisions to receive enough strategic and audience-specific scrutiny without
turning every small design into a larger, slower, more expensive planning
exercise. Reviewers and future implementers are also affected because any new
selection mechanism must make it obvious which lenses governed an artifact.

## Desired outcome and measurable evidence

Produce a reasoned design decision on whether KStack should add any broader
planning lens beyond the existing six. A valid outcome is either:

- retain the current lane set because additional named lenses do not show enough
  incremental value; or
- define a small, non-overlapping set of additional lenses and an explicit,
  proportionate selection/configuration contract.

The decision is successful when the design package:

- maps candidate broader questions against the current six lanes and identifies
  overlap as well as genuine gaps;
- compares no-change, opt-in, conditional, and always-on shapes where viable;
- states the added prompt/runtime and authoring cost, failure modes, and rollback
  behavior of each option;
- preserves all six current lanes at their present rigor;
- preserves the independent Codex/Opus dual-review protocol and design gate
  completely unchanged;
- defines evidence that could falsify the recommendation, including blinded
  planted-gap evaluations and measured prompt/latency cost; and
- leaves existing project configurations and historical review artifacts usable
  or provides an explicit migration if that is impossible.

## Current behavior and external comparison (observed, not assumed)

- `.kstack/config.json` and `plugins/kstack/scripts/kstack-config.mjs` both set
  `workflow.designLanes` to `product`, `ux`, `architecture`, `data`, `security`,
  and `operations`. Validation currently requires only a non-empty array; it
  does not define an additional-lens catalog or per-objective selection record.
- `plugins/kstack/skills/kstack-design/SKILL.md` requires all configured lanes on
  every material design and defines their scope. It also requires at least two
  viable options, costs, failure modes, reversibility, and change-of-mind
  evidence. These existing requirements remain authoritative.
- `plugins/kstack/scripts/kstack-dual-review.mjs` hashes the decision-brief bytes,
  gives the same neutral packet and review schema to Codex and Opus, and records
  provider results in a manifest. It does not consult `designLanes`. Therefore,
  lanes currently affect what the design author puts into the brief, not how
  the independent review is dispatched.
- `plugins/kstack/scripts/kstack-design-gate.mjs` binds reviews and deterministic
  checks to the exact design digest. It checks reviewer approval/confidence,
  reported findings/dissent/questions, and configured check IDs; it does not
  interpret lane names. This objective must not change that gate.
- The extracted gstack source was read rather than inferred from command names.
  Its `/plan-ceo-review` adds premise challenge, status-quo and outcome framing,
  a 12-month ideal, explicit scope posture, alternatives, expansion/reduction,
  long-term trajectory, and competitive/landscape questions. Its eleven deep
  sections then repeat substantial architecture, data/error, security, testing,
  operations, and UX coverage already present in KStack.
- gstack's `/plan-eng-review` and `/plan-design-review` strongly overlap KStack's
  architecture/data/security/operations and product/UX lanes respectively.
  They are not evidence by themselves for new KStack lanes.
- gstack's `/plan-devex-review` has an applicability gate and examines a distinct
  developer lifecycle: persona, discover/install/hello-world/real-use/debug/
  upgrade journeys, time to hello world, API/CLI/SDK ergonomics, actionable
  errors, documentation, ecosystem, and feedback measurement. Its `/autoplan`
  runs CEO and engineering review but conditionally skips design and DX when the
  plan lacks the relevant scope. That is evidence for proportional selection,
  not evidence that KStack should copy the pipeline.
- gstack's `/office-hours` is an objective-discovery/design-doc conversation
  centered on demand, status quo, user specificity, premise challenge, and
  alternatives. KStack already has an objectives phase, so adopting that command
  as a design lane would conflate objective discovery with design review.

## Constraints

- **Do not dilute the base lanes.** Product, UX, architecture, data, security,
  and operations remain mandatory for every material decision and keep the
  descriptions in `kstack-design` unless a later separately approved design
  changes them.
- **Keep review mechanics unchanged.** No option may alter reviewer identity,
  independence, prompt equality, confidence thresholds, required checks, gate
  semantics, or the mandatory round-one clarification process. This work is
  only about what the decision brief reviews.
- **Proportionality is a first-class requirement.** A small feature or internal
  refactor must not pay for broad strategy, market, or developer-adoption
  analysis that cannot affect its decision.
- **No gstack-by-analogy.** Candidate questions need a KStack-specific reason and
  must be rejected where the current lanes already cover them.
- **Selection must be visible and reproducible.** If optional lenses exist, the
  objective/design artifacts must record which were applied or skipped and why.
  Silent semantic inference from arbitrary prose is not assumed safe or stable.
- **Backward compatibility.** Existing `.kstack/config.json` files and historical
  reviews must remain valid by default, or the design must name and justify a
  migration.
- **Authority is unchanged.** A planning lens changes analysis content only. It
  cannot grant tools or permissions, bypass user decisions, or authorize commit,
  push, deployment, implementation, or external actions.
- **Round-one stop.** This thread ends after the first dual review and design-gate
  result. The coordinating session, not this round, runs the required
  `kstack-design-clarify` gate before any round 2 or approval request.

## Process notes

Run this as Design & Architecture work at High reasoning effort. Codex authors a
neutral round-one brief, Codex and Opus review the same bytes independently, and
the result is evaluated with all configured deterministic checks. Do not commit,
push, open a pull request, implement a selected option, run clarification, or
start round 2 in this thread.
