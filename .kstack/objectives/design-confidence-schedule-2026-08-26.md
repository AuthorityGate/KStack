# Objective brief: configurable design-confidence schedule

**Date:** 2026-08-26
**Depth:** deep
**Status:** ready for round-one design review

## Problem

KStack currently hard-codes design thresholds of 90 for rounds 1-10, 80 for
round 11 onward, and 70 for an operator-tagged skill class. The owner has
confirmed that this is the wrong policy. It also cannot express a round-42 tier,
while the current validator caps review budgets at twenty rounds.

This slice must correct only confidence scheduling and termination behavior. It
is a prerequisite linked from the locked KStack Capability Fabric clarification
at `.kstack/decisions/kstack-capability-fabric-2026-08-26-round-1-clarification.md`
(SHA-256 `9804fe6926390604e31c3000355a64876d7abb4df90076313a97bb05647b2a77`).

## Owner-confirmed policy

The built-in default schedule is:

- rounds 1-10: 93;
- rounds 11-21: 81;
- rounds 22-41: 71; and
- round 42 onward: 63. If round 42 remains below 63, terminate the direction
  and present materially different redesign options.

The skill-class exception is removed. A user may replace the built-in schedule
during first-time KStack setup, and each new repository may accept or override
the user schedule. A repository override wins. Overrides may use any valid
confidence percentage rather than inheriting old tier floors.

Once a round reaches its effective numeric threshold, score improvement stops
immediately. Only confirmed bugs, failed deterministic checks, security
findings, material dissent, and required unresolved questions may drive further
remediation. If all numeric and non-numeric conditions clear, the design thread
ends. A later confirmed bug uses a bug-fix/QC or linked superseding-design path;
it never reopens score optimization.

## Required decisions

- Canonical schedule schema and validation.
- User-default storage, repository override, precedence, and integrity.
- V1 90/80/70 migration without overwriting customized legacy policy.
- Review-budget relationship to the round-42 default.
- Exact round resolution and manifest/gate binding.
- Removal behavior for `--skill-class` and legacy config keys.
- Executable `score-qualified`, `bugfix-only`, completed, exhausted, and
  redesign-required terminal behavior.
- Compatibility, rollback, tests, and documentation.

## Success evidence

- Boundaries 10/11, 21/22, and 41/42 resolve to 93/81/71/63 by default.
- A valid user schedule is offered during repository initialization, and an
  explicit repository schedule wins without later user-default drift.
- Any integer percentage from 0 through 100 is accepted in an override;
  intervals cannot overlap, gap, or omit terminal coverage.
- Exact legacy 90/80/70 threshold keys migrate automatically. Any other legacy
  combination stops for explicit mapping and remains byte-preserved on failure.
- `--skill-class` and the legacy skill-class key cannot silently change a gate.
- Round, effective segment, schedule source, canonical schedule digest, and
  thread-bound digest appear in gate evidence.
- Missing, malformed, zero, negative, fractional, overflow, and unsafe integer
  round values fail closed.
- At first numeric qualification, the thread enters bugfix-only mode; later
  dispatches must trace only to recorded blockers. With no blockers it cannot
  dispatch another improvement round.
- At round 42 below 63 under the default policy, the thread returns
  `REDESIGN_OPTIONS_REQUIRED`; it never reports approval.
- Existing completed artifacts retain their historical policy/digests and are
  not reinterpreted.

## Non-goals

- Changing QC or interrogation thresholds.
- Implementing Capability Fabric release, memory, host, domain, or Ollama work.
- Calibrating reviewer confidence as statistical probability.
- Lowering or bypassing zero-security, zero-dissent, deterministic-check, or
  required-question blockers.
- Authorizing implementation in this design round.

## Constraints

- Reviewer confidence remains an integer 0-100; override thresholds use the
  same domain.
- User defaults live in a KStack-owned platform configuration location, never
  Codex/Claude configuration or repository source outside `.kstack`.
- Repository config contains the resolved schedule, so later global changes do
  not mutate an active or completed thread.
- A thread binds the resolved schedule before its first dispatch. Changing it
  requires a linked superseding thread.
- Migration is atomic, recoverable, and limited to confidence-related fields.

## Bootstrap for this design thread

The executable repository gate still implements 90/80/70. This thread is
therefore reviewed under both observed-current and owner-intended policy, but
may be presented for approval only if both reviewers independently reach the
stricter owner-confirmed round-one default of 93 and every non-numeric blocker
is clear. Reviewers must score on merits and must not anchor to that number.
