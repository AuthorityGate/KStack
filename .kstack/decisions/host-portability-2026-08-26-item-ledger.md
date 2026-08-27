# Per-item ledger: host portability

**Thread:** `host-portability-2026-08-26`
**Status:** `ALL_12_TECHNICAL_ITEMS_VALIDATED-DESIGN-ONLY`; owner clarification
locked; implementation and host qualification remain unauthorized and unproven
**Round-1 design digest:** `2ed769a76a112b7c365f84ddf628aeac5716309ec6a3fe6fbc6e17e7f07eb5f4`
**Round-1 scores:** Codex 46; Opus 64; combined 46
**Locked clarification:** `.kstack/decisions/host-portability-2026-08-26-round-1-clarification.md` (`e457ebc72ae7ab37852015a2835400e46ec5307be8e4d4d0717c4d0fd3e2681b`)

`VALIDATED` applies only to one named mechanism reviewed on one frozen digest.
It never authorizes implementation or promotes a host operation. Technical
items remain independent; a score or closure on one cannot clear another.

## Owner-decision blockers

| Item | Status | Existing evidence | Required next action |
|---|---|---|---|
| HP-Q1 protected host-governance component | `LOCKED-YES` | Clarification digest `e457ebc72ae7ab37852015a2835400e46ec5307be8e4d4d0717c4d0fd3e2681b`; owner accepted the recommended protected component without qualification. | Apply exactly to HP-TC04/HP-TC07; do not reopen absent a superseding owner record. |
| HP-Q2 exact host binding under locked Q30 | `LOCKED-YES` | Same locked clarification; owner accepted atomic KStack-owned activation plus remeasured external running-host admission facts and immediate invalidation on change. | Apply exactly to HP-TC11; preserve Q30 exact binding. |
| HP-Q3 persisted-data rollback rule | `LOCKED-YES` | Same locked clarification; owner accepted backward-readability or independently verified restore/forward-recovery as an activation prerequisite, else pre-approval rollback-unavailable disclosure. | Apply exactly to HP-TC12; pointer restoration alone is never data rollback. |

HP-Q1-Q3 answers, consequences, and complete readback are locked. Round 2 may
proceed only as isolated HP-TC01-TC12 technical items.

## Host-breadth option-selection record

The separate `host-breadth-option-selection-2026-08-26` comparison is
`LOCKED-YES-OPTION-C-WITH-NON-COPY-CONSTRAINT`. The owner explicitly answered
Yes after the qualifying readback. The binding record is
`.kstack/decisions/host-breadth-option-selection-2026-08-26-owner-decision.md`
(`1708c5af6c54c983d7a31202913e4858719c3936ac805f44af82cd30dfda910e`).
It selects Agent Skills canonical packages; an MIT-attributed, adapted gstack
registry and generator behind a KStack-native transactional installer; MCP as
the later HB-TC04 tools/resources direction; KStack-native governance, broker,
activation, receipt, and conformance controls; and ACP deferral.

The standing owner constraint forbids verbatim or presumptive reuse. Every
gstack-derived component requires an item-level justification, retained MIT
provenance, a material KStack improvement, independent tests, and rejection
when it would weaken either applicable baseline. This selection does not
modify HP-Q1-Q3, clear an HP-TC row, or authorize implementation.

| Round | Digest | Codex result | Duration | Failed / security / dissent / questions |
|---|---|---|---:|---:|
| 1 | `9cc986c6bc818191f7cfbdc292627a182e95b5c991ba6a19f6e11aad22245d11` | 91 revise | 24066 ms | 4 / 3 / 5 / 5 |
| 2 | `ec96277f9918911d5b6223bc75e524883cfce5a4051d82a4ff94b08ce9097b63` | 94 revise | 22488 ms | 1 / 1 / 0 / 0 |
| 3 | `825c5169e5c7df1a23df5060519edd49af956af8e65c7ae8937e186b70066a81` | 96 approve | 20187 ms | 0 / 0 / 0 / 0 |

**Cumulative exact recorded provider duration:** 66741 ms.

**Owner decision:** HB-Q1 is closed. Option C is the selected host-breadth
layer within the existing preserved Host Portability/Capability Fabric
direction; it does not replace or reopen that direction. At selection time the
next eligible design unit was HB-TC01; HB-TC01 through HB-TC06 are now separately
validated design-only in the Host breadth ledger. Product code, source reuse, installation, MCP,
qualification, external mutation, commit, push, deployment, and publication
remain unauthorized by this ledger.

## Technical item ledger

| Item | Status | Round-1 defect/evidence | Smallest next action |
|---|---|---|---|
| HP-TC01 normative schemas and canonicalization | `VALIDATED-DESIGN-ONLY` | Durable base `.kstack/decisions/host-portability-2026-08-27-hp-tc01-design-candidate.md` (`5ae3369350805b03a0cb6b17c3e2b88044099d23ef43c62463217a4d270d34eb`) plus final repair `.kstack/decisions/host-portability-2026-08-27-hp-tc01-repair-r2.md` (`96728051b7c9d3c8cb6a871335a3271567158578a838fc6eca0b8d24fb5a8b9c`); R1 Codex 98 block in 142160 ms with 9/3/1/5; R2 Codex 96 approve with 0/0/0/0, output SHA `4651a58a1a3045923dec046967a9a397790b6c263b6dc85447671596b1291dd0`, root-observed approximately 156.2 seconds. | Freeze. The 2048-vector declaration is effectively capped by the earlier global 1024-array precheck; reviewer explicitly found this deterministic and non-defective. Implementation remains open; each later HP design/review state is tracked only in its own row. |
| HP-TC02 trusted request context and class derivation | `VALIDATED-DESIGN-ONLY` | Durable reviewed design `.kstack/decisions/host-portability-2026-08-27-hp-tc02-design-candidate.md` (`f5b1c841b73684b7bc977deb543d73f656e9a5f42ef5f081f2074ffc764c770b`); Codex 96 approve with 0/0/0/0; output SHA `ad92caa58d944943417069cd634e6d4d578cbed33596a8d82be5287361dfa437`; exact duration was not supplied and is not fabricated. | Freeze. Implementation remains unauthorized; each later HP design/review state is tracked only in its own row. |
| HP-TC03 replay, idempotency, and authoritative time | `VALIDATED-DESIGN-ONLY` | Durable reviewed design `.kstack/decisions/host-portability-2026-08-27-hp-tc03-design-candidate.md` (`a52136eeedecdb05b5544ecbc341c19aad6009cbfd56b462852997ccff3344bc`); Codex 96 approve with 0/0/0/0; output SHA `bac91175e9b9a22bb3890a1a5161dd974490087cfae8942146059773c8e13173`; exact duration was not supplied and is not fabricated. | Freeze. Receipt authenticity, action fencing, mutation, and rollback remain isolated to HP-TC08/10/11/12; implementation remains unauthorized. |
| HP-TC04 evidence trust, live measurement, and selection | `VALIDATED-DESIGN-ONLY` | Base `.kstack/decisions/host-portability-2026-08-27-hp-tc04-design-candidate.md` (`c7359eab9c0df2f5bf7b50ff75159b5b9e69c5706b4dfbd39b71b84e24850b23`) received Codex 96 approve with 0/0/0/0, output SHA `380032460431d5f3aa169fe31c851a8a1937ccccbccb0b0682654a25f787bf99`; final audit then found the HP-TC01 wrapper-anchor contradiction. Exact repair `.kstack/decisions/host-portability-2026-08-27-hp-tc04-repair-r2.md` (`2712940fef6bdd99fd2c8236d242f8e8008da082a151b9e81cc518473520fce5`) received Codex 97 approve with 0/0/0/0, output SHA `d9f8b50607eebbae70637968be9b5a928afcbefe856c4b7a5ba97dc97fac673a`; exact duration was not supplied and is not fabricated. | Freeze the repaired design chain. HP-Q1 and independently validated HP-TC06 observers remain implementation dependencies; no implementation, host support, authority, or later-item closure is inferred. |
| HP-TC05 deterministic eligibility and quarantine | `VALIDATED-DESIGN-ONLY` | Durable reviewed design `.kstack/decisions/host-portability-2026-08-27-hp-tc05-design-candidate.md` (`2847f3a6efd89e08da4c4a090169a87c741a7ace65e7be687be9061dec9b4302`); Codex 96 approve with 0/0/0/0; output SHA `6621b7e89cacaba417990138b7f31dbf807c88cbe4cd70aa9269eeb8e93523e9`; exact duration was not supplied and is not fabricated. | Freeze. Correctness remains conditional on separately reviewed protected interfaces and HP-TC11 action fencing; no implementation or later closure is inferred. |
| HP-TC06 independent harness and bypass inventory | `VALIDATED-DESIGN-ONLY` | Base `.kstack/decisions/host-portability-2026-08-27-hp-tc06-design-candidate.md` (`3b9c0870142b7ed26eb838e1fced2260c6895cccf1e8d1b72e76afa7bd2fc535`) received Codex 96 revise with 1/1/0/0, output SHA `0b1787a3ceca1f27655710061f1c85be55660e19a5e967aef8fc68541697739e`. Exact repair `.kstack/decisions/host-portability-2026-08-27-hp-tc06-repair-r2.md` (`14aae517bb9ac4328db52c48cec2f3ea8d04917523ca2b8ad18b5977b17d6d96`) received Codex 95 approve with 0/0/0/0, output SHA `4ef064a7a1b3f14095d6d686031a558238810301aaced78e47df6ebf30ff13a8`; exact duration was not supplied and is not fabricated. | Freeze repaired design. Backend implementation and qualification must actually prove every effect boundary or return `UNKNOWN`; no host support, implementation, or later closure is inferred. |
| HP-TC07 structural broker requirement | `VALIDATED-DESIGN-ONLY` | Final digest `001bfa681d1f53925f8e087aa24f4f9fc666a9ceaf50ddfe6ea43b0f00c8ba66`; Codex 99 clean in 164635 ms. Prior permitted Opus 88 closure was rejected and retained; its defects were remediated with Codex only. Cumulative exact isolated-item provider duration 711183 ms. | Freeze. Implementation, real-host qualification, and dependent TC01/TC02/TC03/TC04/TC06 evidence remain outside closure; `FULL` remains unavailable. |
| HP-TC08 race-resistant local mutation | `VALIDATED-DESIGN-ONLY` | Base `.kstack/decisions/host-portability-2026-08-27-hp-tc08-design-candidate.md` (`b3c505c228da57aed0376f7e29b4ee77a20c8e6578c6052c7d77f1888ecfb33a`) received Codex 98 revise with 2/2/2/2, output SHA `41be785c5a2fad6a06933c0dcfe33db68c2a64cae95be6d34d82f59ff38f3a76`. R2 `.kstack/decisions/host-portability-2026-08-27-hp-tc08-repair-r2.md` (`f716e18cc0d3ead3b171023e19b932b67f6af4ab48b450ad79bc564f96b98c2f`) received Codex 98 revise with 1/1/1/1, output SHA `cb0168b16fa947b98fa735b4a428e65476cc44801259ddb85fdfda7a2306be49`. R3 `.kstack/decisions/host-portability-2026-08-27-hp-tc08-repair-r3.md` (`eb5ca8d5d6b1c82d2df37f430be13d99897e4f88aa064c71f582afc71573c2e7`) received Codex 98 approve with 0/0/0/0, output SHA `006af02ab9bbf718183ba863a206abe10a0a1b3a48d1485d85a39c9acb3cb4ae`; exact durations were not supplied and are not fabricated. | Freeze repaired design. Terminal outcome precedes cleanup and every cleanup intermediate is restart-closed; no filesystem mutation or implementation is authorized. |
| HP-TC09 MCP principal and output boundary | `VALIDATED-DESIGN-ONLY` | Durable reviewed design `.kstack/decisions/host-portability-2026-08-27-hp-tc09-design-candidate.md` (`83adee9050e1bda914b567d14706324680d0c9a8f09e7f002a0575ff515d4cfc`); Codex 95 approve with 0/0/0/0; output SHA `00cc70709b5f5089c9384e1ab8dc3c8d63d1ec90b94da9b5dcb22f7fae2ef5c4`; exact duration was not supplied and is not fabricated. | Freeze. The HB-TC04 public registry remains digest-frozen and implementation/conformance must prove no drift. No MCP activation, private-data release, implementation, or HP-TC10/11/12 closure is inferred. |
| HP-TC10 receipt trust by operation class | `VALIDATED-DESIGN-ONLY` | Base `.kstack/decisions/host-portability-2026-08-27-hp-tc10-design-candidate.md` (`7d9c85c5693742ef296dc96aa8247c793f686f6c85b50c6dbfe2f48ba6b49b4c`) received Codex 97 revise with 1/1/1/1, output SHA `d0d3675d31f7f08ea33285815d5ed46b826f5c61b693c33262509f0da7fd69b9`. Exact repair `.kstack/decisions/host-portability-2026-08-27-hp-tc10-repair-r2.md` (`4ce71b96e609a1e1d91b66208ffb0a12c7fae7ec794231710c02d275c2c0043c`) received Codex 97 approve with 0/0/0/0, output SHA `26e2f1965dd621b07e1dcc193f691ecaa2d705e4a1acf031b7229552a979c299`; exact duration was not supplied and is not fabricated. | Freeze repaired design. Reconciliation remains query-only; absent or unprovable query capability preserves ambiguity and cannot authorize retry. No provider call or implementation is authorized. |
| HP-TC11 leases, activation, and in-flight rules | `VALIDATED-DESIGN-ONLY` | Base `.kstack/decisions/host-portability-2026-08-27-hp-tc11-design-candidate.md` (`17f11efa1ff234ebcf82823f89fcc8ca8f30ba46518e1c0f55761df1600dbfc9`) received Codex 97 revise with 1/1/0/1, output SHA `44183a9ab5750483e3c7891478b13469e5d6d9e3e47f5f4e8fcddca581dfcc5e`. R2 `.kstack/decisions/host-portability-2026-08-27-hp-tc11-repair-r2.md` (`2420dceca58d6c1e982fcd5e31084c16e4b682fc23adacc8713a123788d16fa0`) received Codex 97 revise with 1/1/0/1, output SHA `c9f534cb3a114fffcf9037ed307ca1ba38436acd4f2b0b2de209d0289e2db95c`. R3 `.kstack/decisions/host-portability-2026-08-27-hp-tc11-repair-r3.md` (`f511a5a59cd587f21f9f760c664cc099af1ba5b5c73f59e761f409fb9ffb4d51`) received Codex 97 approve with 0/0/0/0, output SHA `5ee70f9e1ed3779d42e907bd3a3b5489a734b1dda917ab89207288f77f9f930c`; exact durations were not supplied and are not fabricated. | Freeze repaired design. Reverse activation always publishes fresh transaction lineage over a revalidated retained execution closure; no activation or implementation is authorized. |
| HP-TC12 reversible migrations and rollout seams | `VALIDATED-DESIGN-ONLY` | Durable reviewed design `.kstack/decisions/host-portability-2026-08-27-hp-tc12-design-candidate.md` (`7e7fd40dbfe5626efa4dccf29e9576bbfcf0d70016a8ed758bbc0c349a91c4a1`); Codex 96 approve with 0/0/0/0; output SHA `dbfd5bdf20697429e65c5a4cd2e30000535f8bea74eac406002093b3676a526b`; exact duration was not supplied and is not fabricated. | Freeze. Assurance remains conditional on exact predecessor implementations; no migration, activation, rollback, implementation, or production-data authority is inferred. |

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
Codex-only closure at confidence 93+ with zero failed checks, security findings,
material dissent, and unresolved questions, update only that row. Never merge
unrelated defects into a whole-plan rewrite or let a score on one row clear
another.
