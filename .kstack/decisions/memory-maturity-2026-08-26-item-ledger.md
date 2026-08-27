# Per-item ledger: Memory maturity

**Thread:** `memory-maturity-2026-08-26`
**Created:** 2026-08-27
**Status:** `DESIGN_SLICES_CODEX_CLOSED`
**Closure review route:** Codex-only
**Closure rule:** a new exact digest is closed only at Codex >=93 with zero
failed checks, security findings, material dissent, and unresolved questions

## Locked owner state

- `MEM-Q-OPTION-001` is `LOCKED_WITH_BINDING_AMENDMENT`.
- The owner approved the composed architecture with one binding amendment:
  every local-model runtime and workload is excluded, not optional or deferred,
  and absent from every slice. Reintroduction requires a new explicit owner
  decision and a new review.
- The owner decision is complete and no owner action remains. The earlier
  objective is historical input only; wherever it conflicts with the bound
  owner record, the owner record controls and the objective text has no
  operative effect.
- Git/GitHub remains authoritative for approved, versioned KStack artifacts.
  Jira remains authoritative for scoped ticket, workflow, and release records.
- KStack's local Memory fabric is derived and non-authoritative. KStack owns
  repository isolation, deletion and non-resurrection, citations, and the
  mandatory deterministic exact/BM25 retrieval path.
- The selected external work contributes bounded non-model patterns only.
  It does not import an external product's authority, runtime, or policy.

## Bound canonical records

| Record | SHA-256 | Purpose |
|---|---|---|
| `memory-maturity-2026-08-26-option-selection.md` | `8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf` | Final owner-amended option-selection brief |
| `memory-maturity-2026-08-26-option-selection-owner-record.md` | `c74d350ab4fa3ea912aa09a35963800d73bba63b4942ae466a4ef677726e2dfe` | Exact owner answer and binding amendment |
| `memory-maturity-2026-08-26-source-ledger.md` | `baf70e2cde3f82ff17a34c97599797875d73a07eea3bdc6fa2685a6016374676` | Immutable source revisions, paths, and license evidence |
| `../objectives/memory-maturity-2026-08-26.md` | `f5dd6eccb9452efbd5b93e35c61f60dbb5119dce743d7133ad2f84d47a38b8a9` | Historical objective input; superseded by the owner record on every conflict |

## Slice closure ledger

`VALIDATED-DESIGN-ONLY` means that Codex approved the exact design digest at
the required confidence and all four closure counters were zero. It does not
mean that the design was implemented, exercised, deployed, or production
qualified.

| Item | Scope | Final SHA-256 | Final Codex | Failed / security / dissent / questions | Status |
|---|---|---|---:|---:|---|
| Option selection | Authority, component selection, evidence, and binding owner amendment | `8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf` | 96 | 0 / 0 / 0 / 0 | `VALIDATED-DESIGN-ONLY` |
| Slice 1 | Authority and citation envelope | `6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4` | 95 | 0 / 0 / 0 / 0 | `VALIDATED-DESIGN-ONLY` |
| Slice 2 | Deterministic exact/BM25 retrieval and cache contract | `9b8e303f8a7cbe1a2c7adac7b22e79f8e9aea5131b448175ab7dda499c2d206d` | 97 | 0 / 0 / 0 / 0 | `VALIDATED-DESIGN-ONLY` |
| Slice 3 | GitHub/Jira ingestion and reconciliation | `41f46d0159f84975403c5829cb7f014a8f93647b700cf65562a9e19d1206b16b` | 99 | 0 / 0 / 0 / 0 | `VALIDATED-DESIGN-ONLY` |
| Slice 4 | Encryption, key lifecycle, deletion, and non-resurrection | `7e652550ff287d834235a5a1ae83082b711fd4509aa1046d86b3b4a40e8b3207` | 97 | 0 / 0 / 0 / 0 | `VALIDATED-DESIGN-ONLY` |
| Slice 5 | Sync, audit chain, compaction, and portable Git objects | `58c2bbce85413aa264d4557306e965f3afcde9165cf504318c34c4b62958b8de` | 97 | 0 / 0 / 0 / 0 | `VALIDATED-DESIGN-ONLY` |

## Exact review history

Security counts below are finding counts, with severities retained where they
were reported. Durations are provider wall-clock durations. The ignored review
artifacts are evidence only and are not candidates for staging or publication.

| Review | Exact digest | Codex | Duration | Failed checks | Security findings | Material dissent | Unresolved questions | Outcome |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Option R1, pre-amendment | `d7409a26971352bf51b0ff8cf7e82fb91267ab364d7f354343cb8a1938de0231` | 89 | 54,411 ms | 0 | 0 | 0 | 0 | clean score below closure threshold; owner amendment followed |
| Option R2, binding owner amendment | `f4afa3f50b532d4cbeaca6c34ccb66cd59da05b27c645d154dc7448eaa0330e3` | 90 | 38,722 ms | 0 | 0 | 0 | 0 | concrete reproducibility work remained |
| Option R3 | `1ba2ed397bf81d8154b8a1cc99cee1fe63b77ef421c9d459fd99ea08d7b8bd65` | 92 | 52,930 ms | 1 | 0 | 0 | 0 | complete source binding required |
| Option R4 | `8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf` | 96 | 13,024 ms | 0 | 0 | 0 | 0 | `APPROVE`; option closed |
| Slice 1 R1 | `95bb9f4c48ddb8be639d5ab9416620bcabd2038995985c1f9a0c191f242b4b18` | 91 | 55,274 ms | 8 | 3 (1 high, 2 medium) | 2 | 4 | targeted fixes only |
| Slice 1 R2 | `efae6c4c40c8f592d65ccc1fd791516b68f5fed052290839fc81ae757a0d935c` | 91 | 31,002 ms | 3 | 1 medium | 1 | 3 | schema/vector, Jira-value, and rollback-disposition fixes required |
| Slice 1 R3 | `6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4` | 95 | 29,731 ms | 0 | 0 | 0 | 0 | `APPROVE`; Slice 1 closed |
| Slice 2 R1 | `3dbfb68aeee8bc754a05b058a4cd7d77bc5f53df9e87ec6bc669401617387c6f` | 90 | 110,474 ms | 11 | 3 (2 high, 1 medium) | 0 | 0 | targeted fixes only |
| Slice 2 R2 | `55e9752fc652ed5bc9a1c9e0953ab8f71481362a034c2e3622eac6335f9191b1` | 92 | 78,829 ms | 1 | 0 | 1 | 0 | regex-needle cap/behavior and boundary fixtures remained |
| Slice 2 R3 | `9b8e303f8a7cbe1a2c7adac7b22e79f8e9aea5131b448175ab7dda499c2d206d` | 97 | 8,032 ms | 0 | 0 | 0 | 0 | `APPROVE`; Slice 2 closed |
| Slice 3 R1 | `aabcf4cb4ca6af404f601b59f5c4f750656931c252a9029e83bc64f471a1c797` | 90 | 64,860 ms | 6 | 4 (2 high, 2 medium) | 2 | 5 | targeted fixes only |
| Slice 3 R2 | `148d0483b4c567f100d26360c908e8bac6fcc1d471a158c001e08618a4cbfd0d` | 98 | 56,283 ms | 5 | 4 (2 high, 1 medium, 1 low) | 2 | 0 | score did not override nonzero closure counters |
| Slice 3 R3 | `41f46d0159f84975403c5829cb7f014a8f93647b700cf65562a9e19d1206b16b` | 99 | 8,459.682 ms | 0 | 0 | 0 | 0 | `APPROVE`; Slice 3 closed |
| Slice 4 R1 | `a0ba8e3240099e9b0928f9a7450220033ea3881d0dbec32791327fe64c56036b` | 98 | 114,024.569 ms | 12 | 6 (1 critical, 3 high, 2 medium) | 4 | 8 | score did not override nonzero closure counters |
| Slice 4 R2 | `7e652550ff287d834235a5a1ae83082b711fd4509aa1046d86b3b4a40e8b3207` | 97 | 18,026.587 ms | 0 | 0 | 0 | 0 | `APPROVE`; Slice 4 closed |
| Slice 5 R1 | `25b5a3855ea85286dcc0dfe99ac71e9407a0030ae040ed267876291738d47e7c` | 98 | 108,959.796 ms | 9 | 8 (1 critical, 4 high, 3 medium) | 4 | 8 | score did not override nonzero closure counters |
| Slice 5 R2 | `58c2bbce85413aa264d4557306e965f3afcde9165cf504318c34c4b62958b8de` | 97 | 5,471.855 ms | 0 | 0 | 0 | 0 | `APPROVE`; Slice 5 closed |

The exact sum of the 17 retained provider durations is **848,514.489 ms**. A
separate 99 ms pre-review launch failure before Option Round 1 is not a review
round and is excluded from that sum.

## Preserved closure boundaries

- Every slice is a bite-sized design contract and retains the closure of the
  preceding slices. Later slices do not reopen earlier authority decisions.
- Only the Codex option-selection and Slice 1-5 artifacts listed above supply
  closure evidence. Older ignored experiments, including other reviewer
  routes, are superseded and supply no score, authority, or closure here.
- No local-model runtime, model, embedding, vector retrieval, semantic
  reranking, query expansion, hardware qualification, or model-download work
  exists in the selected architecture.
- The selected gstack/gbrain contribution is limited to the exact MIT-bound
  sources and non-model patterns in the source ledger. It retains Garry Tan's
  attribution boundary and requires re-pin/re-hash, retained notice, identified
  adaptations, and independent KStack tests before implementation reuse.
- No implementation, test execution, connector enablement, external action,
  deployment, commit, push, publication, or production/user-data readiness is
  authorized or claimed by these design reviews.
- Implementation must supply the named schemas, adapters, fixtures, crash and
  rollback tests, OS-specific durability checks, provider qualification, and
  fail-closed evidence before any implementation-level or production claim.

## Maintenance rule

Do not rewrite a locked decision artifact merely to add bookkeeping. Append a
new canonical record with its own digest. Any implementation deviation,
authority change, source-revision change, or proposed model-dependent path
requires a new exact digest and the applicable owner/review gates. Any excluded
local-model path can return only through a new explicit owner decision.
