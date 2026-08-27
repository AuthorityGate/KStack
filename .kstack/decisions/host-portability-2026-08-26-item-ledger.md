# Per-item ledger: host portability

**Thread:** `host-portability-2026-08-26`
**Status:** `READY_FOR_ROUND_2`; owner clarification locked
**Round-1 design digest:** `2ed769a76a112b7c365f84ddf628aeac5716309ec6a3fe6fbc6e17e7f07eb5f4`
**Round-1 scores:** Codex 46; Opus 64; combined 46
**Locked clarification:** `.kstack/decisions/host-portability-2026-08-26-round-1-clarification.md` (`7eca876f0691813d7f12a389178d6b0496aee27e2067d2b493c0beb88c4ccea3`)

`VALIDATED` applies only to one named mechanism reviewed on one frozen digest.
It never authorizes implementation or promotes a host operation. Technical
items remain independent; a score or closure on one cannot clear another.

## Owner-decision blockers

| Item | Status | Existing evidence | Required next action |
|---|---|---|---|
| HP-Q1 protected host-governance component | `LOCKED-YES` | Clarification digest `7eca876f0691813d7f12a389178d6b0496aee27e2067d2b493c0beb88c4ccea3`; owner accepted the recommended protected component without qualification. | Apply exactly to HP-TC04/HP-TC07; do not reopen absent a superseding owner record. |
| HP-Q2 exact host binding under locked Q30 | `LOCKED-YES` | Same locked clarification; owner accepted atomic KStack-owned activation plus remeasured external running-host admission facts and immediate invalidation on change. | Apply exactly to HP-TC11; preserve Q30 exact binding. |
| HP-Q3 persisted-data rollback rule | `LOCKED-YES` | Same locked clarification; owner accepted backward-readability or independently verified restore/forward-recovery as an activation prerequisite, else pre-approval rollback-unavailable disclosure. | Apply exactly to HP-TC12; pointer restoration alone is never data rollback. |

HP-Q1-Q3 answers, consequences, and complete readback are locked. Round 2 may
proceed only as isolated HP-TC01-TC12 technical items.

## Technical item ledger

| Item | Status | Round-1 defect/evidence | Smallest next action |
|---|---|---|---|
| HP-TC01 normative schemas and canonicalization | `OPEN-CONFIRMED-BUG` | Both reviewers found illustrative objects insufficient for deterministic validation/hashing. | Isolate closed schemas, canonical JSON/domain separation, normalization, collections, negotiation, and historical resolver. |
| HP-TC02 trusted request context and class derivation | `OPEN-CONFIRMED-BUG` | Caller-controlled principal/session/root and `operationClass` permit confused-deputy and class-downgrade paths. | Isolate authenticated derivation, echo matching, registry-derived class, and exact approval/request bindings. |
| HP-TC03 replay, idempotency, and authoritative time | `OPEN-CONFIRMED-BUG` | Nonce scope, durable replay state, ambiguous reconciliation, clock rollback, and TTLs are undefined. | Isolate protected attempt ledger and one authoritative time/expiry contract. |
| HP-TC04 evidence trust, live measurement, and selection | `OPEN-CONFIRMED-BUG` | Signers, roots, rotation/revocation, environment contents, live remeasurement, and deterministic evidence selection are missing. | Isolate evidence trust and exact live-binding protocol using the HP-Q1 locked protected component. |
| HP-TC05 deterministic eligibility and quarantine | `OPEN-CONFIRMED-BUG` | Policy denial, contradictions, alternates, revocation, and in-flight invalidation lack deterministic precedence/state. | Isolate eligibility precedence and a non-promotional quarantine state. |
| HP-TC06 independent harness and bypass inventory | `OPEN-CONFIRMED-BUG` | Adapter-reported results are not independent evidence; host bypass surfaces are not enumerated. | Isolate out-of-process oracle requirements and OpenCode bypass inventory/coverage claims. |
| HP-TC07 structural broker requirement | `VALIDATED-DESIGN-ONLY` | Final digest `001bfa681d1f53925f8e087aa24f4f9fc666a9ceaf50ddfe6ea43b0f00c8ba66`; Codex 99 clean in 164635 ms. Prior permitted Opus 88 closure was rejected and retained; its defects were remediated with Codex only. Cumulative exact isolated-item provider duration 711183 ms. | Freeze. Implementation, real-host qualification, and dependent TC01/TC02/TC03/TC04/TC06 evidence remain outside closure; `FULL` remains unavailable. |
| HP-TC08 race-resistant local mutation | `OPEN-CONFIRMED-BUG` | Path check then write remains vulnerable to symlink/mount/case/replacement races. | Isolate handle-relative, no-follow, identity-bound atomic mutation and negative fixtures. |
| HP-TC09 MCP principal and output boundary | `OPEN-CONFIRMED-BUG` | Unauthenticated stdio conveys no principal; diagnostics/tool text can cross into sensitive/model-visible surfaces. | Isolate no-principal defaults, ACL/identity binding, tool exposure limits, and typed escaped diagnostics. |
| HP-TC10 receipt trust by operation class | `OPEN-CONFIRMED-BUG` | A local audit anchor cannot prove an external provider outcome. | Isolate admissible receipt/anchor types per class and ambiguity reconciliation. |
| HP-TC11 leases, activation, and in-flight rules | `OPEN-CONFIRMED-BUG` | No immutable lease/epoch, crash-consistent pointer, or current-restriction fencing rule. | Isolate active-set lease and action-time fencing using HP-Q2's locked external-host detect-and-invalidate rule. |
| HP-TC12 reversible migrations and rollout seams | `OPEN-CONFIRMED-BUG` | Pointer rollback does not restore migrated data; shadow no-write and H3 seam are underdefined. | Isolate the HP-Q3 locked migration gate; keep H3a skill projection and H3b read-only MCP independently reviewable. |

## Preserved boundaries

- Option D remains the selected direction; this ledger does not reopen the
  whole Capability Fabric.
- Codex CLI and Claude Code remain supported preservation baselines.
- OpenCode remains the first new host; Goose remains a later separate thread.
- ACP remains deferred unless KStack later becomes an agent backend.
- No row authorizes product code, host installation/configuration, external
  tests, credentials, commit, push, deployment, or publication.

## Maintenance rule

Every later host-portability brief reads this ledger first, names exactly one
technical item, and binds its frozen source artifacts. On a valid same-digest
Codex/Opus closure, update only that row. Never merge unrelated defects into a
whole-plan rewrite or let a score on one row clear another.
