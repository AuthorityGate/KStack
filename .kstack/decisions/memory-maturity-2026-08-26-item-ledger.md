# Per-item ledger: memory maturity

**Thread:** `memory-maturity-2026-08-26`
**Status:** living item-level evidence
**Round-1 design digest:** `adc1d1e877e756e5e66b698fc50330c689ebdc18713e2c94fa95e8a2243fce24`
**Round-1 scores:** Codex 46; Opus 60; combined 46

`VALIDATED` applies only to one named mechanism on one frozen digest and never
authorizes implementation, ingestion, synchronization, deletion, model
installation, or an external write. A result on one row cannot clear another.

## Owner-decision blockers

| Item | Status | Existing evidence | Required next action |
|---|---|---|---|
| O1 memory process and caller identity | `OWNER-DECISION-REQUIRED` | Opus failed checks 1-2, SF-1/SF-8, dissent 3, Q1-Q2; Codex authorization findings. | Owner chooses the protected per-user daemon and authenticated OS-peer plus scoped broker-capability topology. Recommendation: yes. |
| O2 source-admission approval granularity | `OWNER-DECISION-REQUIRED` | Codex failed checks 2-3, SEC-03, Q1-Q2; Opus failed check 11 and Q9. | Owner chooses versioned repository-level Git/GitHub and Jira scope policy approval versus per-object/snapshot approval. Recommendation: scoped policy approval. |
| O3 deletion claim and source-system removal | `OWNER-DECISION-REQUIRED` | Codex deletion/tombstone/Jira findings; Opus deletion, live-source, backup, and overclaim findings. | Owner chooses `DERIVED_DATA_PURGED` for KStack-reachable copies and reserves `DELETED` for separately authorized evidenced source removal. Recommendation: yes. |

## Technical item ledger

| Item | Status | Round-1 defect | Smallest next action |
|---|---|---|---|
| T1 service topology and caller anchor | `OPEN-CONFIRMED-BUG` | Resident/per-call process, authenticated caller, cache/lease ownership, startup failure, and identity-negative fixtures are undefined. | Isolate after O1. |
| T2 canonical repository namespace | `OPEN-CONFIRMED-BUG` | Remote/local repository identity and rename/transfer/fork/clone/rewrite behavior are undefined. | Isolate canonical namespace lifecycle. |
| T3 canonical representations and citations | `OPEN-CONFIRMED-BUG` | Original/normalized/redacted bytes, encoding/newlines, digest domains, chunk coordinates, and citation oracle are undefined. | Isolate byte and digest contract. |
| T4 source admission | `OPEN-CONFIRMED-BUG` | Source identity/digest does not prove approved Git or Jira governance scope. | Isolate after O2. |
| T5 authorization matrix | `OPEN-CONFIRMED-BUG` | Search counts, locators, excerpts, history, bodies, ingest, sync, grants, deletion, and keys lack field-level permission separation. | Isolate role/operation/field authorization. |
| T6 safe M1 sequencing | `OPEN-CONFIRMED-BUG` | M1 can persist sensitive copies before retention, encryption, tombstone, purge, and rollback controls. | Isolate minimum safe persistence gate. |
| T7 anti-rollback tombstones | `OPEN-CONFIRMED-BUG` | Tombstone authority, durable location, integrity, selectors, replication order, undelete, and stale restore behavior are undefined. | Isolate after O3 boundary is locked. |
| T8 truthful deletion terminal states | `OPEN-CONFIRMED-BUG` | Reachable/out-of-scope surfaces, legal hold, deadlines, partial completion, backup limits, and source evidence are incomplete. | Isolate after O3. |
| T9 storage surfaces and key lifecycle | `OPEN-CONFIRMED-BUG` | Pages/WAL/temp/swap/dumps/chunks/indexes/caches/replicas/backups and rotation/recovery fencing are incomplete. | Isolate protected-surface and dual-key protocol. |
| T10 namespace-local physical storage | `VALIDATED-CODEX-ONLY` | Frozen digest `d5de043ceccf2c06ab71d68536350ca3292ce993562cc2691967789a20274adf`; Codex 94 clean in `memory-maturity-2026-08-26-t10-codex1-review12` (119,246 ms), zero failed checks/security/dissent/questions. | Closed for design under the owner's Codex-only routing; implementation/conformance and named production dependencies remain future work. |
| T11 retained read and redaction path | `OPEN-CONFIRMED-BUG` | Live-source reads/rebuild/reingest can bypass retained redaction and tombstones. | Isolate authorized retained-byte path. |
| T12 authenticated privacy-safe receipts | `OPEN-CONFIRMED-BUG` | Plain SHA-256 is neither producer authentication nor safe for low-entropy values. | Isolate keyed/domain-separated receipt and anti-rollback anchor. |
| T13 retrieval authorization and exact lane | `OPEN-CONFIRMED-BUG` | Authorization occurs too late; count/timing/rank can leak, exact hits are unbounded, semantic rank bound is undeclared. | Isolate pre-candidate authorization, noninterference, exact bounds, and semantic ceiling. |
| T14 closed unknown-field semantics | `VALIDATED` | Frozen digest `f359720953cf118d966c8a2d1e574a6b2331f4081f9f39a3e6b942eba132b131`; Codex 95 clean in `memory-maturity-2026-08-26-t14-codex10` (25,021 ms); Opus 88 clean in `memory-maturity-2026-08-26-t14-opus6` (261,766 ms). | Closed for design only; implementation/conformance evidence remains future work. |
| T15 lexical implementation and evidence | `VALIDATED-CODEX-ONLY` | Frozen digest `9a049d9b59f0e9dcdab3f298d708af220b66bb2548051fe7129e0c3b4af9816b`; Codex 95 clean in `memory-maturity-2026-08-26-t15-codex1-review1` (55,727 ms), zero failed checks/security/dissent/questions. | Closed for design under the owner's Codex-only routing; implementation/benchmark evidence remains future work. |
| T16 citations after ancestor removal | `OPEN-CONFIRMED-BUG` | Supersession/citation behavior can resurrect bytes or silently lose continuity after stale/expired/tombstoned/purged ancestors. | Isolate safe continuity marker and unavailable-citation state. |
| T17 remote synchronization | `OPEN-CONFIRMED-BUG` | Generic `sync-remote` lacks peer identity, authorization, ordering, ambiguity, reconciliation, tests, and rollback. | Keep unavailable; design as a new independent slice. |
| T18 Jira non-resurrection | `OPEN-CONFIRMED-BUG` | Unchanged or later Jira revisions can reintroduce locally deleted fields; historical bytes may be unreproducible. | Isolate after O2/O3. |

## Preserved authority boundaries

- Git/GitHub remains authoritative for versioned KStack artifacts.
- Jira remains authoritative for approved ticket, workflow, and release records.
- The local catalog, PGlite/BM25, embeddings, caches, summaries, and Ollama
  output are derived and disposable. Ollama owns no authoritative memory.
- Optional semantic/model output cannot decide trust, satisfy citations, grant
  authority, suppress exact identifiers/security terms, or trigger a release.
- Remote synchronization stays unavailable until T17 independently closes.

## Maintenance rule

Every improvement brief reads this ledger, binds the Round-1 objective/reviews,
and names exactly one row. At Codex 84-92 only concrete defects may change.
Current owner routing is Codex direct only: do not dispatch Opus. A same-digest
Codex result at the active threshold with zero failed checks, security findings,
material dissent, or unresolved required questions closes the design row.
