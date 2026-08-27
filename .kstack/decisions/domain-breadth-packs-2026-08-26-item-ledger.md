# Per-item ledger: domain breadth packs

**Thread:** `domain-breadth-packs-2026-08-26`
**Created:** 2026-08-26
**Status:** living document; subordinate bookkeeping, not a design gate
**Review route:** Codex-only improvement; Opus closure only after a new digest
is Codex >=93 and clean

## Authority status

- Round-one Q1 is `UNRESOLVED`: the owner has not selected the authenticated
  out-of-band identity/separation-of-duty boundary. Identity-dependent items
  remain blocked and cannot be inferred.
- Round-one Q2 is `RESOLVED`: independent reviewers must converge; persistent
  gridlock remains blocked, and an advisory third model has no deciding vote.
- Round-one Q3 is `RESOLVED`: each governed workflow owns and attests its
  evidence descriptors; the shared pack-result validator only consumes and
  verifies them.
- The clarification record remains `AWAITING_OWNER_CONFIRMATION`, not `LOCKED`,
  because Q1 is unresolved. These isolated reviews cannot approve the whole
  design or start formal round two.

## Status meanings

- `VALIDATED` — the isolated claim has item-specific review support at the
  applicable high-water; this is not whole-design approval.
- `REJECTED` — the reviewed mechanism is unsound; its replacement is named.
- `OPEN-UNTESTED` — a proposed correction exists but lacks isolated review.
- `OPEN-CONFIRMED-BUG` — round one confirmed the defect and no isolated clean
  fix exists.
- `BLOCKED-OWNER` — progress requires a genuine owner answer.

## Item ledger

| ID | Item | Status | Evidence | Next action |
|---|---|---|---|---|
| D0 | Option C closed declarative catalog; four-pack roadmap; independent pack lifecycle | `VALIDATED` | Round 1 Codex and Opus both selected Option C and rejected reopening A/B/D. | Preserve; do not redesign the full mechanism. |
| D1 | Authenticated identity for selection, waiver/policy weakening, and activation | `BLOCKED-OWNER` | Round 1 Codex 48 and Opus 64 both found repository self-assertion inadequate; clarification Q1 is `Unknown`. | Surface Q1 to owner; do not select an adapter or narrow the threat model by inference. |
| D2 | Exact-byte selection and stale-catalog outcome | `OPEN-CONFIRMED-BUG` | Passes scored Codex 82 -> 90 -> 98 clean on digest `0f29c20c1aab0135babc7c708eb0bf27cc54e1b6fa30e01d54517e9d35504d12`. Independent Opus closure scored 80 and retained three residuals: F1 cross-tier subordinate resolution/equality, F2 policy-digest domains, F3 selection-digest domain/ownership. | Safe stop. On resumption, fix F1 alone with Codex-only review; then isolate F2/F3. No Opus until a new digest is Codex >=93 clean. |
| D3 | Policy weakening/downgrade/quarantine separation of duty | `BLOCKED-OWNER` | Round 1 T2; mechanism depends on Q1 identity boundary. | Resume only after Q1. |
| D4 | Pre-dispatch composition versus post-analysis result/validator | `OPEN-CONFIRMED-BUG` | Round 1 T3; Q3 resolves producer ownership but schemas/transitions remain open. | Isolated Codex review. |
| D5 | Closed schemas, fixture digest, and atomic catalog/compatibility activation | `OPEN-CONFIRMED-BUG` | Round 1 T4; both reviewers found prose-only contracts and incomplete atomicity. | Split into independently attributable schema/digest and activation items. |
| D6 | Deterministic prompt budget and bounded `appliesTo` | `OPEN-CONFIRMED-BUG` | Round 1 T5; tokenizer/fallback/bounds were not executable. | Isolated Codex review. |
| D7 | Executable blinded evaluation and Q2 gridlock disposition | `OPEN-CONFIRMED-BUG` | Round 1 T6; Q2 is resolved and permits a complete technical specification. | Isolated Codex review. |
| D8 | Trusted time/freshness policy | `OPEN-CONFIRMED-BUG` | Round 1 T7/Opus SEC-7. | Isolated Codex review. |
| D9 | `release-operations` remains analysis-only; other packs remain separate roadmap work | `VALIDATED` | Round 1 Codex and Opus explicitly agreed with T8 and the boundary. | Preserve unchanged. |
| D10 | Authenticated workflow-owned evidence descriptor contract | `OPEN-UNTESTED` | Q3 is resolved; round one found the prior producer boundary undefined. | Review with D4 only if the validator/producer handshake is inseparable; otherwise isolate. |

## Score history

| Review | Item | Digest | Codex | Outcome |
|---|---|---|---:|---|
| Round 1 dual review | whole candidate | `fc241844ce6f1b245f127941dda2328bf7d01cbf4bf16b13c32e61d258f805fc` | 48 | revise; Opus 64; combined 48 |
| D2 pass 1 | D2 | `053429b745d7972b6774b4b6e1fce72fb1a5b92a1a4d5c458f71a459d29aaad5` | 82 | revise; three concrete bugs; no dissent/questions |
| D2 pass 2 | D2 | `590e3f8f86fb7c9dcf22befdd889e35e7ed7da860865f98da9b2d912c7adce5b` | 90 | revise; one concrete digest-domain bug; guard/input fixes accepted |
| D2 pass 3 | D2 | `0f29c20c1aab0135babc7c708eb0bf27cc54e1b6fa30e01d54517e9d35504d12` | 98 | approve clean; Opus closure eligible |
| D2 closure 1 | D2 | `0f29c20c1aab0135babc7c708eb0bf27cc54e1b6fa30e01d54517e9d35504d12` | 98 | Opus 80 revise; F1-F3 returned to Codex-only |

## Maintenance rule

Read and update this ledger before and after every item review. Record each
digest, score, defects, high-water, and next smallest change. At Codex 84-92,
stop broad redesign and fix only concrete reported bugs. Call Opus once for
closure only after the current digest is Codex >=93 with no failed checks,
security findings, material dissent, or required unresolved questions. A failed
closure returns only its defects to Codex-only work on a new digest.
