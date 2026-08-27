# Owner decision: remediation round 19 and improvement round 20

**Thread:** `post-deploy-health-check-2026-08-24`
**Recorded:** 2026-08-26
**Status:** authoritative owner amendment

## Decision

The owner reviewed the round-18 result and asked whether all bugs were
resolved. They were not: the safety-hook trust defect and installed runtime
drift were fixed, but round 18 left seven environment-design defects and the
whole post-deploy design still defers launch/process lifecycle, plan cleanup,
and HC3.

The owner explicitly authorized two additional design rounds:

- Round 19 closes every known round-18 defect without changing the selected
  canonical-policy architecture, and closes the still-open whole-design
  launch/process lifecycle, plan cleanup, and HC3 defects.
- Round 20 is a separate improvement and convergence review informed by the
  completed round-19 evidence.

The design review ceiling is amended from 18 to 20. It must not be extended
silently.

## Authority and transition boundary

This amendment authorizes design artifacts, deterministic checks, one Codex
and one Opus review per round, synthesis, and decision-ledger maintenance. It
does not authorize implementation, deployment, commit, push, or weakening the
safety hooks. Reviewer output remains advice. Even a passing complete-design
gate may produce only `READY_FOR_USER_APPROVAL`; implementation requires a
separate explicit owner approval.

## Round-19 closure set

Round 19 must resolve all known round-18 defects:

1. supported-platform boundary and coherent path/executable/locale semantics;
2. disjoint state-classification precedence;
3. deterministic fixture-root mapping, creation failures, and negative-test
   injection seam;
4. a generic expected-value oracle independent from runtime interpreter code;
5. generated state/action definitions bound to one exported semantic source;
6. chosen execution seam for ambient snapshot cases;
7. degraded exit/CI consumption, variable-identifying diagnostics, malformed
   raw JSON handling, and portable locale behavior.

Round 19 must produce a complete design disposition for every currently open
post-deploy-health-check ledger item. Round 20 may improve only from round-19
evidence; it may not erase findings or silently reopen owner-locked scope.

## Recorded outcomes

Round 19 was `BLOCKED`: Codex `block`/45 and Opus `revise`/76. It exposed a
high-severity missing registry-rollback barrier plus narrow launch/HC3 gaps.

Round 20 closed the high-severity defect and received Codex `approve`/91 with
zero findings, dissent, or questions. Opus returned `revise`/74 with one low
finding and five localized defects: env-launcher symlink portability, optional
Codex output-budget separation, complete policy grammar, nonblocking HC3 lock
contention/hold semantics, and argv path disclosure. The deterministic gate
remains `BLOCKED` at combined confidence 74. No implementation transition or
round 21 occurred.
