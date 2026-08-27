# Memory slice 2: raw exact and deterministic BM25 retrieval

**Depends on slice 1:** digest
`6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4`  
**Status:** design review required  
**Authority:** design only; no implementation or external mutation

## Boundary

This slice indexes only slice-1-authorized `SourceRecordV1` bytes and emits
only `CitedResultV1`. It cannot grant access, change freshness, create facts,
or replace original bytes. The complete retrieval channel set is `raw-exact`
and `bm25`. No model, embedding, vector, semantic, reranking, expansion,
adapter, download, or hardware field/path exists.

## Closed query and token contract

Requests are `{repoId, capability, queryUtf8, limit, allowStale}`. Unknown
fields reject. Query is valid UTF-8, 1-4,096 bytes; `limit` is 1-100. Query
bytes are used in memory only and never logged or persisted.

The tokenizer segments original UTF-8 into Unicode 15.1 extended grapheme
clusters, then applies NFKC and full default case folding independently to each
cluster. Each output scalar carries that cluster's original half-open byte
range; expansions repeat it and contractions/reordering retain it. Vendored
Unicode 15.1 property tables are digest-bound. The tokenizer emits maximal
runs of letters, marks, decimal numbers, connector punctuation, slash, dot,
colon, at, plus, or hyphen. Leading/trailing punctuation is removed except `/`;
tokens are 1-256 UTF-8 bytes. After edge removal, a token's original range is
from the first through last contributing retained scalar's cluster; removed
clusters contribute no range. No stemming or stopword removal occurs.
Tokenizer version/digest is part of the index generation and query receipt.

Exact needles, deduplicated by `(kind, bytes)` while preserving first query
offset, are:

1. each backtick or double-quoted literal (1-256 decoded bytes); inside a quote
   only `\\`, the escaped matching delimiter, `\n`, `\r`, and `\t` are valid.
   Any other escape, raw control, missing close, or invalid UTF-8 rejects. Its
   offset is the raw byte position of the opening delimiter;
2. the query after removing only ASCII space/HT/LF/CR at both edges when the
   remainder is <=256 bytes, at the first retained raw byte;
3. raw regex matches for full commit SHA, CVE, GHSA, CWE, Jira key, URL, path,
   dotted/snake/kebab identifier, IPv4/IPv6, and host:port, using a versioned
   ASCII pattern table scanned left-to-right outside quoted spans. Overlaps
   choose longest then pattern-table ID, offset is raw match start, and the
   structured needle is bounded by the 4,096-byte query maximum; and
4. every normalized token.

Kinds 1-3 search exact original byte substrings case-sensitively; kind 4
searches token equality. Malformed quoting rejects rather than guessing.
Normalization never alters the original byte offset used for citation.

The indexer decodes source as strict UTF-8. Non-text artifact classes are not
indexed by this slice. It records a normalization map from each normalized
token to the exact half-open original byte range. Invalid UTF-8, token overflow,
or inconsistent mapping quarantines the source generation.

## Rebuildable PGLite index

Each immutable generation contains:

- `generation(schema, generation_id, repo_id, policy_generation,
  tokenizer_digest, pglite_package_integrity, postgres_runtime_digest,
  source_set_digest, created_at, state)`;
- `document(doc_id, source_record_id, source_revision, content_sha256,
  byte_length, token_count, freshness_state)`;
- `chunk(chunk_id, doc_id, byte_start, byte_end, chunk_sha256, token_count)`;
- `posting(term_bytes, doc_id, chunk_id, tf, first_token_ordinal,
  occurrence_byte_ranges)`; and
- `term_stat(term_bytes, chunk_frequency)` plus
  `corpus_stat(chunk_count, total_chunk_tokens)`.

All primary/foreign/unique/check constraints are named. `repo_id` is present in
every physical partition key even where derivable. Counts are unsigned and
bounded by source/query limits. Index tables hold normalized tokens,
locators/digests, and offsets—not original bodies or raw byte n-grams. A query first uses
slice 1's repository policy lease; SQL always binds exact `repo_id` and the
authorized source-record set as parameters. Provider or retrieved text can
never become SQL, column, operator, filter, or ordering syntax.

Chunks are deterministic windows of at most 4,096 original bytes. Start at
token 0; choose the greatest end token <= start+512 whose original end minus
start token's original start is <=4,096. Include intervening original bytes.
The next start is `max(previousStart+1, end-64)`, giving exactly 64 token
overlap when the prior window has >64 tokens and guaranteeing progress.
Documents without tokens have no BM25 chunk. Starts/ends are token UTF-8
boundaries; final SHA-256 is over the exact original range.

An exact hit uses the lexicographically smallest `(byteStart,byteEnd,sha256)`
stored chunk containing its entire range. If none, a transient window is made:
start from `max(0, floor((hitStart+hitEnd-4096)/2))`, move backward to the
nearest UTF-8 boundary, set end to min(body length,start+4096) moved backward
to a boundary, and if the hit is not contained shift start backward from
`hitEnd-4096` to the nearest boundary and recompute end. Needle length <=4,096
guarantees containment; a 4,096-byte hit uses its exact range. Transient bytes
are verified in memory and not indexed.

## Deterministic retrieval and ordering

The broker computes exact hits first while holding slice 1's shared policy
lease. For every authorized eligible source, raw needles scan the digest-
verified original snapshot with bytewise Knuth-Morris-Pratt state per needle
carried across consecutive 64-KiB buffers; buffer seams do not limit needle
length. Candidate bytes are never persisted. Normalized needles use postings and verify
mapped original ranges. A digest mismatch omits/quarantines the source. Each
hit records kind, needle query offset, original range, and citation chunk.

Exact chunks order by: descending number of distinct needles matched within
that chunk,
descending kind weight (`quoted=4, complete=3, structured=2, token=1` summed
once per needle), ascending first needle query offset, authority kind
(`git=0,jira=1`), authority locator's canonical `KSB1` bytes, earliest hit byte,
then byte start and chunk SHA-256. A source may contribute multiple chunks;
each chunk aggregates only its own hits and deduplicates `(needle,range)`.
All exact result chunks precede every BM25-only chunk. If
exact results fill `limit`, BM25-only results are omitted; exact identifiers and
security terms therefore cannot be suppressed by corpus scoring.

BM25 deduplicates normalized query terms before scoring. Its unit `d` is a
chunk: `N` is eligible active chunks, `df` eligible chunks containing the term,
`tf` occurrences in this chunk, `dl` this chunk's token count, and `avgdl`
total eligible chunk tokens divided by N. It uses `k1=1.2`, `b=0.75`:

`idf(t)=ln(1 + (N-df(t)+0.5)/(df(t)+0.5))`

`score(t,d)=idf(t) * tf(t,d)*(k1+1) /
(tf(t,d)+k1*(1-b+b*dl/avgdl))`.

All operands are PostgreSQL `numeric`; `0.5,1.2,0.75` are exact decimal
literals, `avgdl=total_chunk_tokens/chunk_count`, `ln(numeric)` is
evaluated by the exact PGLite/PostgreSQL build pinned in the generation, and
each term score is rounded half-away-from-zero to 12 places; the final score is
the sum of those rounded terms, rounded the same way. The fixture contains input statistics and expected
12-place scores; a PostgreSQL/runtime change cannot reuse a generation until
the vector matches. Zero-document/zero-token corpora return no BM25 result.

BM25-only chunks order by descending rounded score, descending matched query
term count, authority kind, canonical authority locator bytes, byte start, and
chunk SHA-256. Duplicate chunks from exact/BM25 union once and retain both
channels/scores. Global ordering prepends phase `0 exact, 1 BM25`; pagination
therefore exhausts exact chunks before BM25-only chunks.

The authenticated cursor contains version, broker instance ID, phase,
generation ID, request repo, capability/grant digest, policy generation,
authorized-source-set digest, tokenizer/PGLite/PostgreSQL digests, allowStale,
keyed query digest, last complete sort tuple, issued/expiry, and random nonce.
It expires within 15 minutes. Restart creates a new broker instance/cursor key,
so all pre-restart cursors explicitly reject. Cursor/query digests are never
logged and purge at expiry.

`allowStale` defaults false. False admits only `fresh` slice-1 records. True
also admits `stale` and explicitly allowed `unavailable` snapshots within their
serve window; `expired`, `deleted`, unauthorized, or unverified records never
qualify. Freshness does not alter match/BM25 score. Within otherwise equal
tuples, freshness orders `fresh, stale, unavailable`; every result carries its
state/observedAt. Exact stale hits still precede BM25-only hits because exact
channel preservation is stronger than freshness tie-breaking.

Any cache is optional and body-free. Its mandatory key is `(brokerInstanceId,
repoId, capability/grant digest, policyGeneration, activeGenerationId,
authorizedSourceSetDigest, tokenizerDigest, pgliteIntegrity,
postgresRuntimeDigest, keyedQueryDigest, allowStale, limit, cursorPhase)`.
Values contain only ordered chunk IDs/scores and expire within 60 seconds or on
grant/policy/source/tombstone/generation change. Cache lookup occurs under the
shared policy lease and candidates are reauthorized/reverified before emission.

## Generation lifecycle and rollback

Rebuild enumerates only currently authorized active source records, verifies
original/canonical metadata digests, builds a new private generation, checks
constraints/stat totals/content ranges, runs frozen exact/BM25/citation vectors,
and computes `source_set_digest` over sorted record IDs/revisions/digests.
Promotion takes the repository exclusive policy lease and atomically swaps one
active-generation pointer only if policy generation and source set still match.
Crash before swap leaves the old generation; crash after swap sees the new
complete generation. Old generations become unreadable immediately and purge
after a configurable 0-24 hour rollback window, subject to tombstones.

Incremental update is copy-on-write into a new generation; in-place mutation
of active postings/statistics is forbidden. Delete/tombstone notification marks
the affected generation unavailable before any further query and forces rebuild
without the lineage. Corrupt/missing/stale indexes never fall back to a wider
repository or unverified result; the broker may use the previous still-valid
generation only when its source set/policy/tombstones remain current. Every
query holds slice 1's shared policy lease from source eligibility through the
final local-transport response byte, so revocation/delete linearizes before the
lease or after emission, never between verification and disclosure.

Rollback under the exclusive lease re-enumerates current authorized records and
recomputes policy generation, grant scope, source-set digest, and active
tombstone/non-resurrection epochs. It selects a prior generation only if all
values and tokenizer/runtime digests match; otherwise it disables slice 2.
Pointer validation/swap is one transaction. It clears query cursors, transient
exact-hit chunks, caches, and failed/private generations. Bodies/catalog,
grants, tombstones, audit retention, GitHub, and Jira are unchanged. Rollback
manifest binds selected generation, policy/source-set/tokenizer/runtime digests,
purge counts, and frozen-vector results.

## Acceptance fixtures

1. Quoted/complete-query/path/URL/IPv4/IPv6/host:port/CVE/GHSA/CWE/commit/Jira/
   dotted/snake/kebab/non-English needles recover exact ranges, including edges.
2. Case-sensitive raw and NFKC/case-folded token lanes remain distinct; invalid
   UTF-8, every allowed/forbidden escape, malformed quotes, grapheme
   expansion/contraction/reordering, removed punctuation, oversize tokens, and
   mapping errors match frozen bytes or quarantine/deny.
3. Exact chunks always precede BM25-only chunks at limits 1/10/100 and cannot be
   displaced by frequency, stale data, pagination, or corpus size.
4. Frozen BM25 vectors match 12-decimal scores/order on Linux, macOS, Windows,
   and every supported PGLite/PostgreSQL build; ties reach digest ordering.
5. Same terms in two repos cannot cross partitions even with a malicious SQL-
   looking query, cross-repo grant revocation, cache reuse, or cursor replay.
6. Every result range/digest reads back exact original bytes under slice 1;
   mutation, deletion, expiry, or digest mismatch yields no result.
7. Concurrent rebuild/query/revocation/delete crash schedules linearize at the
   policy lease and active pointer; incomplete generations never serve.
8. Corpus-stat/accounting property tests recompute every tf/df/N/dl/avgdl and
   reject overflow, duplicate postings, invalid offsets, or source-set drift.
9. Atomic rollback restores the prior frozen answers or disables retrieval and
   verifies disposition of cursors/caches/private generations.
10. Static schema/source inventory fails on model/embedding/vector/semantic/
    reranking/expansion/Ollama/provider-adapter fields or code paths.
11. Chunk vectors cover 64-token overlap, 4,096-byte truncation, zero-token
    documents, single-token progress, and centered transient-window boundaries.
12. BM25 vectors prove chunk-level N/df/tf/dl/avgdl, repeated-query-term
    deduplication, per-term/final rounding, exact/BM phase order, and pagination.
13. `allowStale` false/true covers fresh/stale/unavailable/expired/deleted
    eligibility and ties without weakening exact precedence.
14. Cursor tamper/expiry/query/repo/capability/generation mismatch and broker
    restart reject; no cursor resumes across a new instance.
15. Cache tests cross every key field and invalidation event; no wrong repo,
    capability, grant, source set, freshness mode, runtime, or generation hits.
16. Rollback after grant revocation and tombstone refuses the old generation;
    the lease scheduler proves no disclosure crosses delete/revocation commit.
17. Index privacy test confirms no raw body/n-gram table exists and deletion of
    authorized bodies makes reconstruction from index rows impossible; raw
    exact streaming leaves no persisted candidates or query bytes.
18. Structured needles of 255, 256, 257, 4,095, and 4,096 bytes cross every
    64-KiB seam position under stateful KMP and reproduce exact ranges; the
    4,096-byte citation is exactly one capped transient window.

## Codex closeout rule

Approve only at confidence 93+ with zero failed checks, security findings,
material dissent, or unresolved questions. At 84-92 fix only concrete slice-2
defects; the accepted slice-1 boundary and five-slice architecture do not move.
