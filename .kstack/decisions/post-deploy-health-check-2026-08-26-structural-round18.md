# Owner decision: structural round 18

**Thread:** `post-deploy-health-check-2026-08-24`
**Recorded:** 2026-08-26
**Status:** authoritative owner amendment

## Decision

After reviewing the five consecutive rejected rounds 13 through 17 and the
round-17 structural-simplification flag, the owner selected the structural
direction and explicitly authorized continuing. The design review ceiling is
amended from 4 to 18 for exactly one additional attempt, round 18.

Round 18 must replace independently restated environment prose with one
canonical executable policy whose validation cases and human-readable summary
are derived from the same rows. It must be implementation-grounded against the
current coordinator and tests.

## Scope lock

- In scope: environment construction for installed Node probes and the
  third-party Codex JSON observation; exact variable-state handling; truthful
  claim calibration; policy-derived validation.
- Out of scope: implementation, launch/process-group redesign, plan-file
  lifecycle, HC3 override redesign, deployment, commit, and push.
- `CODEX_HOME` remains an opaque optionally supplied value. KStack may validate
  and forward it but must not claim undocumented precedence or behavior by the
  third-party Codex process.
- Canonicalization may be described only as narrowing path ambiguity and
  establishing construction-time byte identity. It does not establish
  freeze-to-execution identity or close TOCTOU.
- If round 18 does not clear the configured gate, the thread returns to the
  owner. The ceiling must not be extended silently.

## Cost and authority acknowledgement

Round 18 spends one independent Codex invocation and one independent Opus
invocation, bringing the thread total to 18 rounds and 36 reviewer invocations.
Reviewer output is advice, not implementation authority. A passing gate may
produce only `READY_FOR_USER_APPROVAL`; implementation still requires explicit
owner approval.

## Recorded outcome

Round 18 completed one valid dual review bound to design digest
`cb90d0189af14262f53c1a5db251cbc991a99cfe60927430111cce4bb363704a`.
Codex returned `revise` at 68 and Opus returned `revise` at 74; combined
confidence is 68 against the required 80. The deterministic gate is `BLOCKED`.
No implementation transition occurred and no round 19 was opened.

Before the valid pair, two infrastructure attempts produced no review
envelopes: the first exposed a stale installed Codex safety runtime and Opus
API retries; the second exposed outer-sandbox user-state and network limits.
The owner explicitly approved refreshing the user-scoped Codex plugin and
sending this exact brief to the configured Codex and Opus APIs. The refreshed
post-deploy installation health check passed all six execution probes, and the
source and installed safety-hook digests matched before the valid review.
