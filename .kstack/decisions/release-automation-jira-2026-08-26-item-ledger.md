# Per-item ledger: release automation with Jira

**Thread:** `release-automation-jira-2026-08-26`
**Status:** living document; item-level evidence only

`VALIDATED` applies only to the named mechanism and never authorizes production
activation or clears another release item.

| Item | Status | Evidence | Next action |
|---|---|---|---|
| M1 correction 1: GitHub dispatch response, pre-dispatch identity, total P0 disposition, and safe P0 records | `VALIDATED` | Frozen digest `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523`; Codex 97 and Claude 87; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Runtime remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until all inherited staging fixtures pass. |
| M1 correction 2: OIDC audience-preimage acquisition and trust path | `VALIDATED` | Frozen digest `a217f92d67f4cdee5deb178c9855c7de9ccb243cec12890b097c81ca86783e16`; Codex 95 and Claude 87; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Composed M1 still requires correction 4 and target staging qualification. |
| M1 correction 3: approver semantics and Q1 coupling | `OPEN-CONFIRMED-BUG` | Claude's Round-3 M1 final review found approver cardinality and `prevent_self_review` depended on unresolved owner Q1. | Resolve Q1, then isolate. |
| M1 correction 4: preflight-summary retrieval authorization and threats | `VALIDATED` | Frozen digest `9addaaa63aaf1130b85260762a2609abf304fea4e20bd86b6cf42584fb841d2e`; Codex 94 and Claude 88; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Production remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until all composed fixtures pass on the exact target. |
| M1 correction 5: provider comment-normalization staging evidence | `VALIDATED` | Frozen design digest `9dda35f801d332ee581d6e6566f7641b53facbc9f02711102a8f85d6277cd90f`; Codex 95 and Claude 90 on that exact digest; both approved `DESIGN_READY` with zero failed checks, security findings, dissent, or unresolved questions. Review evidence: `.kstack/reviews/release-automation-jira-2026-08-26-m1-c5-codex15/` and `.kstack/reviews/release-automation-jira-2026-08-26-m1-c5-opus4/`. | Preserve verbatim. Runtime remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until the separately authorized 17-run provider packet, static inspection, ACL/lifecycle checks, and matrix verification pass on the enrolled target. |
| M2: one executor and atomic operation redemption | `VALIDATED-DESIGN-ONLY` | Final digest `1109ed85ca5854bcb00d9490ddafa293612b156c4d25ffcb1e20d622b2513975`; Codex 99 clean in 147671 ms; cumulative exact provider-review duration 735690 ms. Opus not dispatched per owner Codex-only directive. | Freeze. M7 independent anti-rollback qualification, implementation, and staging/live writes remain outside closure; adapters stay observer-only. |
| M3-M7 | `OPEN-UNTESTED` | Round-2 synthesis defines these as independent mechanisms; no isolated review has begun. | Preserve dependency order and review individually. |
