# Objective brief: Staged Review Mechanism Hardening

**Date:** 2026-09-02
**Thread:** `staged-review-mechanism-hardening-2026-09-02`
**Predecessor:** `staged-primary-final-review-workflow-2026-08-29`
**Parent ticket:** KSTK-103
**Depth:** deep
**Status:** ready for isolated round-one design review

## Problem

KStack replaced routine simultaneous two-agent design review with an ordered
workflow: one primary agent owns improvement until the work is ready, then
exactly one different agent performs an independent final review of the same
neutral brief. Eight review cycles under the predecessor thread hardened that
mechanism substantially — convergence, feedback carriage, cycle-budget
accounting, platform scope, prose routing, credential scoping, disclosure
bounding, and cross-run provider state isolation.

Those eight cycles could not reach readiness, and the reason was structural
rather than a defect in any of that work. The predecessor thread's objective is
the originating KSTK-103 requirement: preserve an accepted high-water design
across review loops. Every brief in that thread is bound to that objective by
digest, and `objectives-complete` is a required design-gate check. A brief that
honestly reports the high-water requirement as unaddressed therefore fails a
required check by construction, no matter how sound the mechanism it describes
has become. The eighth cycle stated the gap plainly and was blocked at
confidence 20 for exactly that reason.

This thread separates the two concerns. Its objective is the mechanism itself —
an objective the completed work actually satisfies — so the mechanism can be
reviewed and accepted on evidence. High-water preservation remains under
KSTK-103 and the predecessor thread, unstarted and unclaimed.

## Owner decisions

- The split is an owner decision recorded on 2026-09-02: continue hardening the
  mechanism under a new objective, and take high-water preservation as dedicated
  later work rather than as part of this thread.
- Breaking the review chain is intended. A new objective produces a new
  objective digest, and the runner's chain check correctly refuses to treat
  predecessor cycles as prior cycles of this thread. This thread's first cycle
  is a first cycle.
- Evidence authenticity remains a settled scope decision, not an open item: a
  signing mechanism bound to the maintainer's certificate must not attest other
  operators' local evidence, and the project has no signing-identity model that
  avoids that. Local evidence proves internal consistency, not authenticity.

## Required decision

Confirm or correct an architecture for the ordered review mechanism that
defines:

1. the ordered protocol contract itself as an owned, checkable rule — primary
   release criteria, dispatch order, reviewer distinctness, identical neutral
   brief across roles, and final acceptance authority;
2. thread identity and artifact-derived chain membership, stated as consistency
   between presented artifacts rather than as authenticity of them;
3. an observable per-cycle delta that prevents re-presenting a rejected design,
   and the path by which rejected findings reach the next primary;
4. cycle-budget accounting derived from consumed provider capacity;
5. platform admission bound to named primitives rather than a platform label;
6. a bounded control against real concerns being routed into prose instead of
   the structured finding arrays;
7. bounding of every channel out of the runner into a provider process; and
8. cross-run provider state isolation enforced as a runner precondition and
   bound to the measured provider build.

## In scope

- The staged review runner, its blocked statuses, and its evidence manifest.
- The independent design gate's reproduction of the runner's predicates.
- Provider spawn construction: arguments, environment, scratch and home
  directories, inherited handles, and configuration-directory reachability.
- Cycle accounting, convergence, chain identity, and feedback carriage.
- Operator-facing contract in the design skill and the dual-review reference.
- Deterministic tests and the real-backend measurements deterministic tests
  cannot replace.

## Out of scope

- **High-water design preservation.** Defining the accepted baseline, recording
  it, comparing later designs against it, and failing closed on regression stay
  under KSTK-103 and the predecessor thread. No block in this thread delivers
  any part of it, and this thread must not be read as satisfying it.
- Signing or otherwise attesting the local evidence set.
- Changing owner-set gates: required checks, confidence thresholds, the
  zero-finding dispatch predicate, or the material-dissent requirement.
- Windows support for the staged runner.
- Replacing Codex and Opus as the two independent reviewers.
- Implementation of any downstream work item this design hands off.

## Success evidence

- The ordered protocol's release, ordering, distinctness, brief-identity, and
  acceptance rules are each stated as an outcome some block owns.
- A cycle that violates thread identity, chain membership, convergence, feedback
  carriage, budget, platform admission, or isolation measurement dispatches no
  provider and charges no budget.
- The design gate independently reaches the same conclusion as the runner from
  the evidence alone, including cycle accounting and isolation measurement.
- Each provider child holds only its own credential variable and configuration
  path, a private home, and no primary report content on any channel, verified
  by observation from inside that process.
- Dispatched review content does not reach shared provider configuration state,
  established by measurement against the exact provider build and re-measured
  when that build changes.
- The full repository suite passes with no regression, and every claim in the
  design record maps to a test or to a named, dated real-backend measurement.

## Constraints

- Deterministic code owns validation, admission, accounting, and terminal
  status. Reviewers judge design content; they do not decide gate outcomes.
- Default deny applies when evidence is absent, stale, malformed, or ambiguous.
- A guarantee resting on provider behavior must say so, and must be bound to the
  provider build it was measured against rather than asserted generally.
- No claim may be stated at a strength its mechanism does not support; where a
  property is bounded, both what it catches and what it cannot are stated.
- Secrets and credentials are never embedded in briefs, manifests, evidence, or
  provider arguments, and outbound scanning runs before any dispatch.
- This thread authorizes local design and review artifacts and read-only
  validation only. It grants no commit, push, deployment, or external-service
  authority.
