# Per-item ledger: configurable design-confidence schedule

**Thread:** `design-confidence-schedule-2026-08-26`
**Status:** living document; item-level evidence only

This ledger never substitutes for the whole-design gate. `VALIDATED` means only
that the named item passed the scoped review route; it does not authorize
implementation or clear another item.

| Item | Status | Evidence | Next action |
|---|---|---|---|
| CP4-TC03: non-circular zero-floor acknowledgement and activation binding | `VALIDATED` | Frozen digest `89dc8c85c0369584c031eb33939c49eef62b775a3de5164e8dbdb81e392c818e`; Codex 94 and Claude 85; both approved with zero failed checks, security findings, material dissent, or unresolved questions. | Preserve verbatim. Do not broaden this validation to the frozen cooperative-local writer, trusted-time, journal, CAS, recovery, or other CP4 items. |
| CP4-TC01: atomic candidate acceptance and blocker-ledger retirement | `VALIDATED` | Frozen digest `1b1687248f03673e25d963e69e1ce8fd996719a54b9ebff891d4735411f68268`; Codex 92 and Claude 87; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Do not broaden validation to other CP4 items or implementation conformance. |
| CP4-TC02: disposition schema failures have one accounting path | `VALIDATED` | Frozen digest `1a35362df8052f259f7b166b686d64b8ad75e17ad084a39a4caacd606f970ee7`; Codex 94 and Claude 87; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Carry four nonblocking precision notes into implementation conformance; do not reopen the item or broaden validation to TC04-TC11. |
| CP4-TC04A: lane start/retry, call accounting, bounded quiescence, exhaustion | `VALIDATED` | Owner-directed Codex-only closure on frozen digest `5875f5b5311b792b2fe440188bd635bd0dd49e70cd4e0488a16ad427c4994b59`; Codex 95 clean in 139,713 ms (envelope `4011261d7a112c7541fae0e62d654c78471b73b8736b776676aeb804cb455201`) with zero failed checks, security findings, dissent, or unresolved questions. No Opus was dispatched after the owner changed routing to Codex-only. | Preserve verbatim. Activation remains blocked on integrating the frozen TC04B seam and unresolved TC05/TC07 semantics; do not broaden this item validation. |
| CP4-TC04B: retained-envelope integrity, exact packet/quorum binding, apply handoff | `VALIDATED` | Frozen digest `01e1225cd4ab659a41268f5c91bdc16bda9b7e19b64e1e669a94ed631a21f2eb`; Codex 94 clean in 239,339 ms (envelope `0328fbaa4d5e873de4436c4b19acb5d50c41fc493afd3fb6ffb2cbb9172ce0e7`) and Claude 92 clean in 186,229 ms (envelope `b673e1e5d9309d929db5461993311e12f3e893a16e58df7730888c156e811d93`); both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Activation remains blocked on byte-exact TC04A seam validation and narrow TC01 apply-handoff requalification; do not broaden validation to TC05/TC07. |
| CP4-TC05 | `OPEN-UNTESTED` | Round-4 synthesis correction exists; no isolated review. | Isolate ordered guards and activity facts. |
| CP4-TC06 | `OPEN-UNTESTED` | Owner extension decision is locked; correction not isolated. | Review additive grants and checked arithmetic. |
| CP4-TC07 | `OPEN-UNTESTED` | Round-4 synthesis correction exists; no isolated review. | Isolate trusted time and lease self-fencing. |
| CP4-TC08 | `OPEN-UNTESTED` | Round-4 synthesis correction exists; no isolated review. | Isolate structural evidence and invalid-source semantics. |
| CP4-TC09 | `OPEN-UNTESTED` | Round-4 synthesis correction exists; no isolated review. | Isolate policy-divergence handling. |
| CP4-TC10 | `OPEN-UNTESTED` | Round-4 synthesis correction exists; no isolated review. | Isolate fixed call reporting. |
| CP4-TC11 | `OPEN-UNTESTED` | Round-4 synthesis correction exists; no isolated review. | Validate fixtures with their owning items. |
