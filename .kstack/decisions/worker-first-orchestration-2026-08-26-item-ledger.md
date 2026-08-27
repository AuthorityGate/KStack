# Per-item ledger: worker-first orchestration

**Thread:** `worker-first-orchestration-2026-08-26`
**Status:** living; not a design gate
**Route:** Codex-only improvement, then one qualified Opus closure

| Item | Status | Evidence | Next action |
|---|---|---|---|
| W1 shared orchestration reference and ten minimal skill links | `CODEX-CORRECTION` | Round 1 accepted Option C at 89 but found concrete state, recovery, capacity, routing, root-boundary, and status-definition defects. Architecture is frozen because the score is >=84. | Correct only the seven reported defects and rerun Codex on the new digest. |
| W2 structural conformance test and install-health manifest binding | `CODEX-CORRECTION` | Round 1 retained the docs-plus-conformance-test slice and specified exact central-link and copied-runtime binding checks. | Carry the corrected contract into the same isolated review; implementation only after closure. |
| W3 append-only dashboard history and lossless owner-question relay | `VALIDATED-DESIGN-ONLY` | Final digest `d221bda70be4f0f60bd1b7cb53ffb89a7539332c44e3cf923a9c1faacc1679e4`; Codex 99 clean in 72384 ms. Prior permitted Opus closure 86 was rejected and is retained; its defects were remediated with Codex only. Cumulative exact provider-review duration 859043 ms. | Freeze. Implementation and executable conformance remain outside this closure and unauthorized. |

## Score history

| Pass | Digest | Codex | Outcome |
|---|---|---:|---|
| W1-R1 | `d2eb546ba70fd3729ebd4e4ec50365c35e10b8b92848ee64ce3d923fd74177bf` | 89 | Revise: six failed checks plus one linked medium security finding; zero dissent and zero owner questions. |
| W1-R2 | `753efb3aff1739ae88c2777dae04c58a47d609da5c29f416bbc6d1d59043d9dd` | 91 | Revise: two state-machine checks plus one linked medium security finding; routing, root, status, and verification defects closed; zero dissent/questions. |
| W1-R3 | `3e7db21a4677eef42efd8f2fa65f555fd1fc879d14888d3d0ea784ffac21a2dc` | 96 | Clean for the state-only correction; overall closure deferred because W3 was added while this review ran. |
| W3-R1 | `467f94e0bb5bea6c430120670732b681644c2068721ce12f61526f2a5fc26a64` | 89 | Revise: seven failed checks, one linked medium security finding, zero dissent, one genuine owner question. Exact Codex duration: 273961 ms. |
| W3-R2 | `1732ecf8ff3dadba17692442559179f8d4edb2bb3ea760a26525e924e17a31f7` | 92 | Revise: one failed check; zero security findings, dissent, or questions. Exact Codex duration: 185539 ms. |
| W3-R3 | `b618da79b869a4fb7e3f7b23e4d228c74c33894b2cc068fba4df3c95239c4e1e` | 97 | Codex clean in 101642 ms; Opus closure 86 revise in 177705 ms. One owner decision and bounded closure fixes remain. |
| W3-R4 | `1d5a31cd993dc0abca1f44d70c7526d54d46862cafb5a67a58f1177802d570a5` | 96 | Approve in 47812 ms with zero failed/security/dissent/questions; one nonblocking precision objection required an explicit identity-unavailable tuple. |
| W3-R5 | `d221bda70be4f0f60bd1b7cb53ffb89a7539332c44e3cf923a9c1faacc1679e4` | 99 | Approve in 72384 ms; zero failed checks, security findings, dissent, questions, or strongest objection. Design-only outcome validated; no Opus remediation dispatch. |

At Codex 84-92, change only concrete defects. Invoke Opus once only after a new
digest is Codex >=93 clean; Opus must be >=84 clean to make this design eligible.
