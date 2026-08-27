# Memory maturity option-selection brief

**Thread:** `memory-maturity-2026-08-26`  
**Decision:** `MEM-Q-OPTION-001`  
**Status:** `LOCKED_WITH_BINDING_AMENDMENT`  
**Review route:** Codex-only; no Opus  
**Authority:** comparison and design selection only; no implementation, model
download, external write, commit, push, merge, deployment, or publication  
**Owner record:** `memory-maturity-2026-08-26-option-selection-owner-record.md`,
SHA-256 `c74d350ab4fa3ea912aa09a35963800d73bba63b4942ae466a4ef677726e2dfe`

## Decision in one sentence

Select a **composed KStack-native memory fabric**: Git/GitHub remains
authoritative for approved versioned KStack artifacts, Jira remains
authoritative for scoped ticket/workflow/release records, KStack owns the
authority catalog and exact/BM25 retrieval contract, and selected non-Ollama
gbrain/Mem0/Graphiti/Letta mechanics are adapted at the edges. The selected
architecture has no model runtime, embeddings, vector retrieval, semantic
reranking, query expansion, or model-provider slice.

## Bound evidence

Evidence was inspected on 2026-08-26. A moving `HEAD` is recorded only as the
observed revision; later implementation must re-pin and re-review every reused
component. Web documentation is evidence for current public behavior, not a
supply-chain pin.

### KStack and local gstack/gbrain material

| Source | Bound revision or digest | Relevant evidence |
|---|---|---|
| KStack working repository | Git commit `3aaddedcd992bff51a44d71a34802c94d108577e` plus this uncommitted decision artifact | Current explicit memory, PGLite body/index separation, authority matrix, Reflexion lexical normalizer, tests, and locked objective. |
| `.kstack/objectives/memory-maturity-2026-08-26.md` | SHA-256 `f5dd6eccb9452efbd5b93e35c61f60dbb5119dce743d7133ad2f84d47a38b8a9` | Locked authority, deletion, repository-isolation, citation, and baseline retrieval constraints; the later owner record removes Ollama from the selected option. |
| `plugins/kstack/scripts/kstack-memory.mjs` | SHA-256 `2fe8b9cd9bcfcb85ad9b78dd656eab8a0ffbf9505cd25b66ebc54a3d21346922` | Current curated body, secret scan, PGLite index, explicit search, and manual Git synchronization. |
| `plugins/kstack/scripts/reflexion/normalization.mjs` | SHA-256 `b52c8e397623fb6a7e3e507b8a5bd07a1794599ca5c49aab10344e5ebd36d2cc` | Deterministic NFKC/case-folded lexical matching that can seed the new exact lane. |
| `plugins/kstack/scripts/reflexion/retrieval-core.mjs` | SHA-256 `055028d1ad93e3b951ee42d972a3b921f4a76f1e595bf9a0592d91e355cec5a3` | Deterministic lexical ranking/evidence mechanics. |
| `/tmp/gstack-reuse-audit-20260826` | Commit `ad8400543cd9ce8d07641362db48d44a95417e33`, gstack `1.69.0`, MIT | Frozen local source used for detailed mechanism inspection. |
| Upstream gbrain | Observed `HEAD` `77bb9d8c2165a8eb3f15e117462fcf1164fc4c0a` | Current upstream comparison and MIT provenance. |

Inspected gstack paths include `hosts/gbrain.ts`, `setup-gbrain/SKILL.md`,
`setup-gbrain/memory.md`, `sync-gbrain/SKILL.md`,
`USING_GBRAIN_WITH_GSTACK.md`, `docs/gbrain-sync.md`,
`docs/gbrain-sync-errors.md`, `docs/gbrain-write-surfaces.md`,
`lib/gbrain-exec.ts`, `lib/gbrain-local-status.ts`,
`lib/gbrain-repo-policy-client.ts`, `lib/gbrain-sources.ts`, and
`lib/gbrain-guards.ts`.

### Other primary contenders

Only immutable repository objects below support selection. Product websites
and moving documentation may help discovery but are not reuse evidence.

| Contender | Fully bound revision | Selected primary-source paths |
|---|---|---|
| Mem0 | `39bc02330563764e7d4465f1ecff5f002d94da1a` | [`mem0/memory/main.py`](https://github.com/mem0ai/mem0/blob/39bc02330563764e7d4465f1ecff5f002d94da1a/mem0/memory/main.py), [`delete.mdx`](https://github.com/mem0ai/mem0/blob/39bc02330563764e7d4465f1ecff5f002d94da1a/docs/core-concepts/memory-operations/delete.mdx), and [`rest-api.mdx`](https://github.com/mem0ai/mem0/blob/39bc02330563764e7d4465f1ecff5f002d94da1a/docs/open-source/features/rest-api.mdx). |
| Graphiti | `683a8539c8925de69071a1305dc8bf0e52e17c65` | [`edges.py`](https://github.com/getzep/graphiti/blob/683a8539c8925de69071a1305dc8bf0e52e17c65/graphiti_core/edges.py), [`graphiti.py`](https://github.com/getzep/graphiti/blob/683a8539c8925de69071a1305dc8bf0e52e17c65/graphiti_core/graphiti.py), and [`mcp_server/README.md`](https://github.com/getzep/graphiti/blob/683a8539c8925de69071a1305dc8bf0e52e17c65/mcp_server/README.md). |
| Letta/MemFS | Letta `4511fa0bc91f68fbab32b91f694617271ea9012b`; Letta Code `ad7e6cf5ff78c0e757770d66fcf04462a0e65c92`; MemFS docs `0bfd40b73de18fca8fd9c370263d2e46ac5379df` | [`memory-git.ts`](https://github.com/letta-ai/letta-code/blob/ad7e6cf5ff78c0e757770d66fcf04462a0e65c92/src/agent/memory-git.ts), [`memory-worktree.ts`](https://github.com/letta-ai/letta-code/blob/ad7e6cf5ff78c0e757770d66fcf04462a0e65c92/src/agent/memory-worktree.ts), [`memory-filesystem.ts`](https://github.com/letta-ai/letta-code/blob/ad7e6cf5ff78c0e757770d66fcf04462a0e65c92/src/agent/memory-filesystem.ts), [`prompts/letta.md`](https://github.com/letta-ai/letta-code/blob/ad7e6cf5ff78c0e757770d66fcf04462a0e65c92/src/agent/prompts/letta.md), and [`concepts/memfs/index.md`](https://github.com/letta-ai/letta-docs-md/blob/0bfd40b73de18fca8fd9c370263d2e46ac5379df/concepts/memfs/index.md). |

The complete byte-level evidence and license closure are bound in
`memory-maturity-2026-08-26-source-ledger.md`, SHA-256
`baf70e2cde3f82ff17a34c97599797875d73a07eea3bdc6fa2685a6016374676`.
That ledger records every selected path's immutable commit, Git blob, byte
count, raw SHA-256, claim mapping, complete `LICENSE` object identity, and
PGLite lock/integrity. Any later reuse must reproduce the recorded identity or
stop for a re-pin and new review.

## Options compared

This is a KStack-fitness score, not a general product-quality score. Weights:
authority/provenance/citations 20, deterministic exact retrieval 15,
privacy/ACL/deletion 20, sync/portability 15, maturity 10, operating cost and
host fit 10, and reuse/licensing/lock-in 10.

| Option | Authority | Exact | Privacy/delete | Sync | Maturity | Ops/cost | License | Weighted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Adopt gbrain wholesale | 12 | 11 | 10 | 14 | 9 | 5 | 10 | 71/100 |
| B. Adopt Mem0 wholesale | 8 | 12 | 12 | 8 | 9 | 6 | 9 | 64/100 |
| C. Adopt Graphiti wholesale | 11 | 13 | 7 | 7 | 8 | 4 | 9 | 59/100 |
| D. Adopt Letta/MemFS wholesale | 9 | 9 | 10 | 13 | 8 | 6 | 9 | 64/100 |
| E. Build every mechanism KStack-native | 20 | 15 | 19 | 10 | 4 | 6 | 10 | 84/100 |
| **F. Compose KStack core plus bounded adaptations** | **20** | **15** | **19** | **14** | **8** | **8** | **10** | **94/100** |

Option F does not score 100 because it retains meaningful connector,
qualification, deletion, and multi-host reconciliation work. The score is an
option-selection aid and is not the Codex design-review confidence.

## Why wholesale adoption fails

- **gbrain** has the strongest observed cross-machine sync and operator
  lifecycle, but its automatic context load, permissive absent-policy ingest,
  agent-maintained pages, optional transcript secret scan, and manual
  `git filter-repo` hard-delete path conflict with KStack. Its artifacts also
  bypass per-remote filtering when no remote identity is attached.
- **Mem0** has mature CRUD, filters, history, API isolation, and provider
  choices, but its default memory pipeline requires an LLM and embeddings and
  makes extracted memories primary records rather than cited derivatives of
  GitHub/Jira authority.
- **Graphiti** has the best temporal fact/episode provenance and rich hybrid
  search, but it adds an LLM extraction pipeline, embeddings, a graph database,
  and a larger authenticated service boundary. Its past filter-injection issue
  also shows why KStack cannot expose graph filters directly to model input.
- **Letta/MemFS** has strong Git-backed portability, commit boundaries,
  concurrent maintenance worktrees, and memory-doctor patterns, but it is
  intentionally agent-owned mutable context. KStack cannot let an agent or
  background reflection process rewrite authority or standing rules directly.
- **KStack-only** can meet every invariant but would rebuild already-proven
  queue, sync, doctor, commit-boundary, temporal-provenance, and deletion-UX
  mechanisms.

## Exact reuse boundary

### Adapt with attribution and independent KStack tests

From gstack/gbrain:

1. Three independently checkpointed code/memory/Git-sync stages.
2. Private-Git allowlist, maildir-style queue, start/end boundary drains,
   deterministic union of append-only records, and scheduled fast-forward
   refresh of the exact indexed worktree.
3. Receipt-before-egress, content-free payload digest/size, hash-chained
   ledger, preserved failure queue, and static network-sink inventory tests.
4. Normalized-remote repository policy, expanded from one trust triad into
   separate read, ingest, remote-sync, and administrative-delete capabilities.
5. Split-engine operation, source watermarks, health/readiness classification,
   idempotent setup, round-trip smoke probes, Windows launch seams, and
   destructive-source guards.

From Mem0:

1. Required entity filters for every search and delete.
2. Explicit wildcard syntax and dry-run/count preview for bulk deletion.
3. Per-record history and authenticated request audit shape.

From Graphiti:

1. Immutable source episode identity for every derived fact.
2. `valid_at`/`invalid_at` temporal intervals and supersession history.

From Letta:

1. Git commit as the activation boundary for future memory.
2. Always-present small rules versus on-demand external reference tiers.
3. Protected read-only memory classes, doctor/audit UX, and worktrees for
   concurrent derived maintenance.

### Explicitly prohibit

1. Automatic per-turn or preamble injection.
2. Missing policy meaning write permission.
3. Model output establishing facts, trust, scope, deletion, or citations.
4. Semantic retrieval suppressing exact identifiers or security terms.
5. Agent-authored summaries replacing original source bytes.
6. Unscanned ingestion, silently disabled scanning, force push, automatic
   conflict resolution, or direct model access to provider filters.
7. A Git-history rewrite as the ordinary production deletion mechanism.
8. Ollama detection, installation, invocation, configuration, embeddings,
   generation, reranking, query expansion, model download, model receipt,
   vector index, provider adapter, or implementation slice. Reintroduction
   requires a new explicit owner decision and a new review.

## Recommended architecture

### Authority and catalog

The authoritative identities are:

- Git/GitHub: canonical remote identity, immutable commit SHA, repository path,
  original byte digest, and approved artifact class.
- Jira: canonical site/project/key, allowlisted fields, Jira `updated` value or
  available changelog identity, observed timestamp, and selected-field digest.

The local catalog stores only verified source locators, content addresses,
policy, freshness, retention, supersession, encryption-key reference, and
derivation receipts. It is a cache and cannot manufacture authority. Offline
Jira results are labeled snapshots with an exact `observed_at` and stale state;
they are never presented as current Jira truth.

Each request carries a canonical repository identity and a short-lived local
capability. Read, ingest, sync, and administrative delete are separate grants.
Cross-repository access requires an explicit auditable grant, and revocation is
checked at the service boundary on every query and write.

### Exact-first retrieval

The current `kstack-memory.mjs` uses PostgreSQL English
`to_tsvector`/`ts_rank`; that is neither true BM25 nor a guarantee for raw
identifiers, punctuation, paths, CVEs, or non-English terms. Replace it with
rebuildable PGLite tables for:

1. raw literal identifiers and security terms;
2. NFKC/case-folded exact tokens using the shared Reflexion normalizer;
3. language-neutral BM25 postings, document length, and corpus statistics; and
4. stable byte-digest tie-breaking.

The candidate set is the deterministic union of exact and BM25 results. Exact
matches receive reserved result positions; BM25 cannot suppress them. Stable
source identity, revision, byte offset, and byte digest break every remaining
tie. This exact/BM25 behavior is the complete selected retrieval contract, not
a fallback for a later model-dependent path.

Every returned item contains authority kind/locator, source revision, original
content digest, snapshot freshness, chunk byte range and digest, retrieval
channels and component scores, derivation receipt when applicable, and
`UNTRUSTED_RETRIEVED_DATA`. A summary or embedding cannot satisfy a citation;
the digest-valid original bytes must be retrievable.

### Deletion and non-resurrection

Production/user-data artifacts use envelope encryption with a separate
per-artifact data-encryption key; Git may hold ciphertext, never its key. A
deletion transaction:

1. records a non-sensitive tombstone keyed by authority locator, source
   revision, content digest, and monotonically ordered deletion epoch;
2. removes the body or destroys its key;
3. purges lexical indexes, excerpts, queues, caches, replicas, staging,
   and eligible backups;
4. retains only a safe receipt digest and policy timestamps; and
5. rejects every older sync record and the same source lineage until an
   explicit owner-authorized re-ingest creates a later activation epoch.

All clients must apply a tombstone before integrating older content. Immutable
backups may retain only ciphertext after crypto-shredding within policy. If the
authoritative Jira issue still contains the data, KStack reports only local
purge and re-ingest suppression; it cannot claim Jira deletion without separate
Jira authority and verified readback.

### Sync and privacy

GitHub and Jira connectors are read-only to the memory service, use least-
privilege credentials, allowlisted fields, content-addressed idempotency,
watermarks, pre-egress/ingress receipts, bounded retries, explicit staleness,
and atomic index promotion. Polling is the portable baseline; a webhook is an
optional accelerator. Jira prose is untrusted data and never instruction.

Development plaintext requires an explicit visible configuration and warning.
Production/user-data configuration fails closed without an approved encryption
and key-lifecycle policy. Queries and retrieved bodies must not enter ordinary
logs. Secret or injection findings quarantine a source before indexing.

## Independently shippable design slices

1. Authority/citation schema and repository capability boundary.
2. Raw-exact plus deterministic BM25 retrieval and lexical rollback target.
3. Scoped GitHub/Jira read-only ingestion, freshness, and reconciliation.
4. Encryption, tombstones, purge receipts, and multi-client non-resurrection.
5. Adapted sync queue, receipts, recovery, health, and cross-host fixtures.

Ollama is not deferred into a later slice: it is absent from the selected
architecture. Production/user-data ingestion does not begin before slices 1-5
pass. Each slice is reviewed and accepted independently; a defect changes only
its own slice unless evidence proves an interface contract is wrong.

## Owner question: MEM-Q-OPTION-001

**Original exact question (preserved):** Do you approve the recommended
composed KStack Memory Fabric in which Git/GitHub remains authoritative for
approved versioned KStack artifacts, Jira remains authoritative for scoped
ticket/workflow/release records, KStack owns repository isolation, deletion,
citations, and mandatory exact/BM25 retrieval, the listed
gbrain/Mem0/Graphiti/Letta mechanics are adapted only behind those boundaries,
and every Ollama model or workload is an optional qualified derivative that can
be removed without changing authority or baseline results?

**Owner answer:** Yes, with a binding amendment.

**Binding amendment:** the Ollama option is dead. Ollama is removed entirely
from the selected composed Memory architecture; it is not optional, deferred,
qualified later, or present in implementation slices. Any future
reintroduction requires a new explicit owner decision. The full signed-off
wording and the pre-amendment digest are preserved in the bound owner record.

**Effective approved decision:** freeze Option F only in its Ollama-free form:
Git/GitHub and Jira retain their defined authority; KStack owns isolation,
deletion/non-resurrection, citations, and mandatory exact/BM25 retrieval; and
only the selected non-Ollama gbrain/Mem0/Graphiti/Letta patterns may be adapted
behind those boundaries.

Continue only with the five isolated design slices above. This approval does
not authorize implementation, Jira or GitHub mutation, external writes, model
download, commit, push, deployment, or publication.

## Codex review request

Review only this option-selection decision. Separate observed evidence from
inference. Verify the source bindings, option weights/arithmetic, authority
boundary, exact-result guarantee, citation contract, repository isolation,
Jira freshness, encryption/deletion/non-resurrection lifecycle, gbrain and
contender reuse boundary, complete exclusion of Ollama/model-dependent paths,
deterministic exact/BM25 behavior, portability, cost, and licensing.

Approval requires confidence 84 or higher with zero failed checks, zero
security findings, zero material dissent, and zero required unresolved
questions. At confidence 84 or higher, return only concrete defects; do not
redesign the overall direction. This packet requests Codex-only assessment and
does not authorize Opus or any external action.
