# Host breadth Option C item ledger

**Thread:** `host-breadth-option-selection-2026-08-26`
**Architecture:** `LOCKED-YES-OPTION-C-WITH-NON-COPY-CONSTRAINT`
**Owner decision:** `.kstack/decisions/host-breadth-option-selection-2026-08-26-owner-decision.md`
**Rule:** every item closes only at Codex 93+ with zero failed checks, security
findings, material dissent, and questions; no Opus result is eligible in this
ledger (the one owner-authorized no-result timeout is recorded below)

`VALIDATED-DESIGN-ONLY` never authorizes implementation or host support and
never clears a similarly named Host Portability `HP-*` defect.

| Item | Status | Final evidence | Dependency / next boundary |
|---|---|---|---|
| HB-TC01 canonical package, bundles, clauses, resolver, provenance, installer handoff | `VALIDATED-DESIGN-ONLY` | Final cumulative packet `35e78d77bf8512b5d8699965b29e853d9d21477b4da5cabb68f7afaaabbece0c`; byte-identical durable final delta `.kstack/decisions/host-breadth-hb-tc01-2026-08-26-final-reviewed-delta.md` (`65dc5885d198751dcdcd345fd938e9e36a6885dd89194d2c676eab0d55a1139d`); Codex 96 clean; round scores 72, 78, 86, 88, 89, 96; cumulative 212228 ms | Freeze. HB-TC02 may consume only its immutable typed handoff; implementation remains unauthorized. |
| HB-TC02 generic transactional installer | `VALIDATED-DESIGN-ONLY` | Final cumulative packet `1a6584834d5b630a70d90bb031b3582b69e0b844b4f66ad2e9435cbfdb5be128`; byte-identical durable final delta `.kstack/decisions/host-breadth-hb-tc02-2026-08-26-final-reviewed-delta.md` (`0291fd82057c943fe4f26effeca1c80455d41b57358988a972c890d084ad1f68`); Codex 96 clean; two rounds; cumulative 39272 ms | Freeze. HB-TC03 may use it for packaging/discovery candidate design only; implementation remains unauthorized. |
| HB-TC03 OpenCode instruction-only candidate | `VALIDATED-DESIGN-ONLY` | Final cumulative packet `df1cd2d2e5fdcf5e2155c24316265187581d76510a198c6721fb81fb82d48c28`; byte-identical durable final delta `.kstack/decisions/host-breadth-hb-tc03-2026-08-26-final-reviewed-delta.md` (`7b2dd804d16a795121cbea8e2658c95ae7a127957b145793d4b2a672fb877ec7`); Codex 96 clean; round confidences 91, 90, 90, 96; cumulative 84096 ms | Freeze. Candidate packaging/discovery only; never host support, enforcement, operation qualification, or implementation authorization. |
| HB-TC04 read-only MCP facade | `VALIDATED-DESIGN-ONLY` | Complete durable chain: base `.kstack/decisions/host-breadth-hb-tc04-2026-08-26-base-design.md` (`366f4f4a2f568f040258cfc5f23c92bbcc0a513975ef229ff73967ae2e206219`), repair R2 `.kstack/decisions/host-breadth-hb-tc04-2026-08-26-repair-r2.md` (`600f6de3513d66aecac820f9ff3d1cade8e07c61db3ced38b9fe020158f4a6c3`), final delta `.kstack/decisions/host-breadth-hb-tc04-2026-08-26-final-reviewed-delta.md` (`0d66619a18150a3234353ca36cec4addaab1e3720bae55b172c7e7b1fa91ec7c`); Codex 97 clean; three rounds; cumulative 201850 ms. | Freeze. Read-only unauthenticated public projection only; no tool, identity promotion, host qualification, implementation, or HP-TC09/12 closure. HB-TC05 may now consume this non-authoritative facade boundary but requires its own dependencies and review. |
| HB-TC05 OpenCode executed conformance | `VALIDATED-DESIGN-ONLY` | Durable reviewed design `.kstack/decisions/host-breadth-hb-tc05-2026-08-27-design-candidate.md` (`eb09f43501678654e94fe714416b45f16f6f08f964976dec6719cd89ca02280f`); Codex 97 approve; 0 failed / 0 security / 0 dissent / 0 questions; output SHA `645647359f49b2c4248a65aadf99f86d72de1930bc70a5c154ef4bc8e7083a8c`; root reported approximately 47.8 seconds, exact milliseconds pending. | Freeze. No OpenCode execution, qualification, support, implementation, or HP dependency closure occurred. HB-TC06 consumed only this frozen design boundary and separately closed design-only. |
| HB-TC06 second-host abstraction proof | `VALIDATED-DESIGN-ONLY` | Durable reviewed design `.kstack/decisions/host-breadth-hb-tc06-2026-08-27-design-candidate.md` (`98667edb88dcb5d24ad735335699977f48ea39cf1ec6cf56ba339675106b3427`); Codex 97 approve; 0 failed / 0 security / 0 dissent / 0 questions; output SHA `af84e658613c10480e9e62f2e9c90a23d8f083a3182e559fe3bb5dae54a03f79`; exact duration was not supplied and is not fabricated. | Freeze. Future Goose work remains blocked by actual OpenCode stability evidence and a separate objective; no second-host implementation, execution, qualification, or support is claimed. |
| HB-TC07 ACP feasibility | `DEFERRED-OWNER-LOCKED` | HB-Q1 | No work absent a later owner product-boundary decision. |

## HB-TC01 round ledger

| Round | Packet or design digest | Score | Decision | Duration | Failed / security / dissent / questions |
|---|---|---:|---|---:|---:|
| 1 | `0d2bdbc0664d2a88fab573dddcf7ca056e6346fff29cc10fcfc6698bf4bf8d04` | 72 | block | 57891 ms | 9 / 5 / 4 / 5 |
| 2 | `49f204a2e7c2d825c2495a1346c70a69aa9f2434c5f88fbeb6626caa14b6409c` | 78 | revise | 44920 ms | 6 / 4 / 0 / 2 |
| 3 | `81f1c73cd23450afa5bfcf3baac9ea1d3b3073861c13bc747f456a790c3d34aa` | 86 | revise | 39183 ms | 5 / 3 / 1 / 0 |
| 4 | `dde0420396cf9745dae58a6dfa1514f038ed2ffddeaf75d3895c59faf9bfaf2f` | 88 | revise | 33954 ms | 5 / 3 / 0 / 2 |
| 5 | `8f7c300c4dc006a58ebed1abff207ed6c2bd16118348edf9cc7c0dcbcbf45e02` | 89 | revise | 31003 ms | 4 / 3 / 0 / 2 |
| 6 | `35e78d77bf8512b5d8699965b29e853d9d21477b4da5cabb68f7afaaabbece0c` | 96 | approve | 5277 ms | 0 / 0 / 0 / 0 |

## HB-TC03 round ledger

| Round | Packet or design digest | Confidence | Decision | Duration | Failed / security / dissent / questions |
|---|---|---:|---|---:|---:|
| 1 | `99234041b6e164ff8e24961212b616114aca9d5e985f4713a4d7ffffe3243cca` | 91 | revise | 31002 ms | 4 / 2 / 2 / 0 |
| 2 | `de11890f95c30af09235b6afb0e0c355f2bae97b120876a61a6a134aac951122` | 90 | revise | 20415 ms | 4 / 0 / 0 / 2 |
| 3 | `cdf528624b7ced5ae1c8d2e89a942641986969b450411f61e983b80fdf690740` | 90 | revise | 22410 ms | 4 / 2 / 0 / 0 |
| 4 | `df1cd2d2e5fdcf5e2155c24316265187581d76510a198c6721fb81fb82d48c28` | 96 | approve | 10269 ms | 0 / 0 / 0 / 0 |

HB-TC03 cumulative review duration: 84096 ms. Reviewers emitted confidence
only; no separate score field was present.

## HB-TC04 round ledger

| Round | Packet or design digest | Confidence | Decision | Duration | Failed / security / dissent / questions | Disposition |
|---|---|---:|---|---:|---:|---|
| 1 | `366f4f4a2f568f040258cfc5f23c92bbcc0a513975ef229ff73967ae2e206219` | 99 | block | 41510 ms | 3 / 0 / 2 / 0 | Found a cyclic digest graph, a concrete-resource/template protocol mismatch, and an incomplete JSON-RPC error map. |
| 2 | `600f6de3513d66aecac820f9ff3d1cade8e07c61db3ced38b9fe020158f4a6c3` | 97 | revise | 137070 ms | 1 / 0 / 1 / 1 | Digest construction and error mapping closed. Snapshot/list-to-read binding remained incomplete for mutable resources. |
| 3 | `0d66619a18150a3234353ca36cec4addaab1e3720bae55b172c7e7b1fa91ec7c` | 97 | approve | 23270 ms | 0 / 0 / 0 / 0 | Exact snapshot lease repair closed cleanly. Result SHA `2f3a764442a407145689877654c6af66e00dc21444c5592c5b3253843e25ba30`. |

HB-TC04 has 201850 ms cumulative completed review time. Rounds 1 and 2 did not
close despite confidence above 93 because findings/dissent/questions remained.
Round 3 reached 97 with all four closure arrays empty. This is validated design
only: no implementation, host-support, or operation-qualification claim is
made, and no HP item is cleared.

## HB-TC02 round ledger

| Round | Packet or design digest | Confidence | Decision | Duration | Failed / security / dissent / questions | Review-output SHA-256 |
|---|---|---:|---|---:|---:|---|
| 1 | `110779cce9e64945a02cf4226d89cc387bbb379a9ef77a41dd503cc87f52dea5` | 96 | revise | 25104 ms | 3 / 2 / 1 / 2 | `cacd928e69f057033b465da0474d931c3ef99262df846093cbeea86b17d95faf` |
| 2 | `1a6584834d5b630a70d90bb031b3582b69e0b844b4f66ad2e9435cbfdb5be128` | 96 | approve | 14168 ms | 0 / 0 / 0 / 0 | `8594982b13de64368b73ceffc8fad18c6198464c4905945da7f15d0d8f9df5ad` |

HB-TC02 cumulative review duration: 39272 ms. Round 1's high confidence did
not close the item because concrete failed checks, security findings, dissent,
and questions remained. Round 2 closed only the exact corrected design.

## One-time Host Option C Opus attempt

The owner authorized one independent Opus review of the already selected Host
Option C. The exact request is bound by SHA-256
`85252a1064492358c2da9905ddad6a220ef6f0387b53c6ac593f06c5b8c7ea96`.
The `claude-opus-5` attempt timed out after 172500 ms and produced no result
artifact, verdict, confidence, finding, dissent, or unresolved question. The
attempt recorded 0 input/output tokens and $0 cost. Its disposition is
`NO_RESULT_TIMEOUT`; it is an attempt, not a review round, and it changes
neither the Codex evidence nor any item status.

## Preserved constraints

- No upstream gstack bytes are admitted by HB-TC01. Every listed mechanism is
  `REIMPLEMENT_PATTERN` or `REJECT` with exact MIT provenance.
- Codex and Claude outputs remain preservation baselines.
- Agent Skills packages, renderer output, metadata, and installer candidates
  remain non-authoritative.
- HB-TC03 closes only its instruction-only candidate design. HB-TC04 closes
  only a read-only unauthenticated public projection design. HB-TC05/06 close
  only their exact design packets; no implementation/support follows and no
  commit/push occurs per item.
- The one-time Opus timeout is preserved as a no-result attempt. It cannot be
  treated as approval, dissent, a clean review, or runtime qualification.
