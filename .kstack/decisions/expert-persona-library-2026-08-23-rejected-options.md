# Rejected-options ledger: expert persona library

**Thread:** `expert-persona-library-2026-08-23`
**Created:** 2026-08-25
**Status:** living document; update in place
**Baseline for comparison:** round 24 combined confidence 86

This ledger records whole mechanisms or closure attempts that regress
confidence or are otherwise shown unsound. It complements the subordinate
per-item ledger (`expert-persona-library-2026-08-23-item-ledger.md`) and never
replaces the formal design gate.

## Rejected-options ledger

### 1. Round-25 absolute non-authority containment claim in the Finding-1 closure

- **What was tried:** Round 25 closed round 24's low finding
  `PERSONA-LIFECYCLE-NOT-TAMPER-EVIDENT` by rewording the threat-boundary text
  so that lifecycle metadata (revocation state, expiry, replacement digest) is
  described as a cooperative hygiene/provenance-display control rather than a
  security mitigation, and by asserting that the residual risk from a stale or
  reverted persona record is bounded because a resurrected stale body "can
  only degrade reasoning quality, never escalate privilege, bypass a gate, or
  grant authority."
- **Round:** `.kstack/reviews/expert-persona-library-2026-08-23-round25/`,
  design digest
  `5da1ae8750f8d34e2e1ef792625977dad4777ee997e450344fb271b4bb90bfbe`.
- **Confidence effect:** Codex `revise`/74 and Opus `approve`/85 produced
  combined confidence 74, 12 points below round 24's 86. Codex additionally
  reported one deterministic failed check, one new low security finding
  (`PERSONA-NONAUTHORITY-BOUND-OVERSTATED`), and one genuine material dissent,
  all targeting the same clause. The option must not be built forward from.
- **Why rejected:** The hygiene/provenance reclassification itself is sound
  and both reviewers accept it without qualification. The regression is
  isolated to one absolute phrase: denying personas *formal* authority
  (tools, gates, commit, deploy, legal authority) does not by itself prove
  that persona instructions can *never* induce misuse of authority already
  available to a caller through channels the brief does not itself specify or
  verify (e.g., a future caller with pre-existing tool or gate access reading
  a persona-influenced recommendation and acting on it). The brief's own
  threat list separately names "persona prompt injection/authority
  escalation" as a threat, which is in tension with an unqualified "never...
  bypass a gate" containment claim in the same document. Independent
  deterministic re-evaluation of `threat-model-complete` against the primary
  text confirmed the same gap Codex identified, so this is not merely a
  reviewer-opinion difference resolvable by re-scoring; it is a genuine
  overclaim in the drafted text.
- **Concrete alternative:** Keep the hygiene/provenance reclassification and
  the "personas confer no formal authority" distinction exactly as drafted,
  but replace the absolute clause with a bounded statement of the following
  shape: "A resurrected stale or reverted persona body does not itself confer
  any tool, gate, commit, deploy, legal, or authority capability — it changes
  reasoning framing only. Containment against that stale content being acted
  upon in a way that touches a real tool, gate, commit, deploy, or authority
  boundary depends on host policy, KStack authority, skill procedure, and gate
  rules that are enforced independently of any persona's content and are not
  established or verified by this classification round." This keeps every
  other closure (the reword direction, the "no revival of the retired storage
  protocol" conclusion, and the six unchanged closures for findings 2 and the
  five unresolved questions) intact and unchanged; it narrows exactly the one
  clause both Codex's material dissent and the independently rerun
  `threat-model-complete` check identified. A follow-up round should apply
  only this one bounded restatement, keep every other section of the round-25
  brief as-is, and re-dispatch dual review against the corrected digest before
  comparing again to round 24's 86.
- **Follow-up outcome (round 26):** the concrete alternative above was applied
  verbatim, with every other round-25 section (items 2-7) left unchanged, at
  design digest `707f8f5ef75573a8c883117b38cb994088fc74706fd6a59f7ea0701d2a0c81d4`
  (`.kstack/reviews/expert-persona-library-2026-08-23-round26/`). Codex
  `approve`/92 and Opus `approve`/87 (combined confidence 87), zero failed
  checks, zero security findings, zero material dissent, zero unresolved
  questions from either reviewer. Combined confidence is 1 point above round
  24's 86 (no regression) and 6 points above the owner's 81 target. The
  whole-design gate returned `READY_FOR_USER_APPROVAL`
  (`.kstack/reviews/expert-persona-library-2026-08-23-round26/gate.json`).
  This entry's rejection stands as the historical record of why round 25 was
  rejected; it is not superseded or deleted, per this ledger's own
  living-document/never-recreate discipline.
