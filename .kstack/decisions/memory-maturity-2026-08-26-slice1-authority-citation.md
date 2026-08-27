# Memory slice 1: authority, citation, and repository capability boundary

**Parent decision:** `MEM-Q-OPTION-001`, digest
`8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf`  
**Source ledger:** digest
`baf70e2cde3f82ff17a34c97599797875d73a07eea3bdc6fa2685a6016374676`  
**Status:** design review required  
**Authority:** design only; no implementation or external mutation

## Outcome and non-negotiable boundary

This slice defines the identity, authorization, and citation contracts consumed
by every later memory slice. Git/GitHub is authoritative only for approved,
versioned KStack artifacts. Jira is authoritative only for allowlisted
ticket/workflow/release fields. The local catalog, indexes, excerpts,
tombstones, sync records, and audit receipts are non-authoritative KStack state.
Jira prose is untrusted data. No local or external model path exists.

The pre-amendment objective's Ollama requirements are superseded by the bound
owner record. They create no field, capability, adapter, or future placeholder.

## Canonical identities

All identifiers are UTF-8, NFKC-normalized where human text is allowed, length
bounded, and rejected on NUL/control characters. Identity values are compared
as encoded canonical bytes, never display labels.

### Deterministic encoding and bounds

Hash inputs use `KSB1`, a closed length-prefixed encoding: ASCII magic `KSB1`,
one-byte schema, then fields in ascending numeric field ID. Each field is
`uint16-be fieldId || uint8 type || uint32-be byteLength || valueBytes`.
Type codes are raw bytes `1`, UTF-8 text `2`, unsigned big-endian integer `3`,
false `4`, true `5`, and null `6`; floats, maps, unordered sets,
duplicate/unknown fields, and alternate integer encodings are rejected. Text
is NFKC then UTF-8; authority path bytes
are raw and are never Unicode-normalized. Times are UTC RFC3339 with exactly
three fractional digits and `Z`, then encoded as text. Digests are 32 raw bytes,
not hex, inside `KSB1`. Display JSON is never hashed.

Text fields are at most 1,024 bytes; host 253 ASCII IDNA A-label bytes;
owner/repository 255 bytes each; authority path 4,096 bytes and 255 bytes per
segment; Jira selected field value 1 MiB and complete canonical observation
4 MiB; artifact classes/field IDs 64 lower-ASCII bytes; lists 1,024 elements;
timestamps years 1970-9999. Provider repository/Jira IDs retain provider bytes
after a 256-byte maximum and printable-ASCII check. All excess denies.

Conformance fixtures publish the full `KSB1` bytes and digests. The pre-`KSB1`
comparison vector
`kstack-repo-v1\0github\0github.com\0authoritygate\0kstack` has SHA-256
`48f03e73809ec6882c01af6f8fd5c2dcf9cfcb6c7565a76686465d1ae54045b0`;
it is a regression fixture only and never a production identity.
Implementations must match normative `KSB1` vectors before enablement.
For GitHub fields `1=github`, `2=github.com`, `3=123456789`, the normative
bytes are
`4b53423101000102000000066769746875620002020000000a6769746875622e636f6d00030200000009313233343536373839`
and SHA-256 is
`6ba4d63b14febec8b521af09858ab90e530b7808f7dbac29e74c3a00cef032d5`.

The closed repoId schemas are GitHub `1 provider(text), 2 canonicalHost(text),
3 providerRepositoryId(text)` and local Git `1 provider(text), 2
localRepositoryUuid(raw 32), 3 ownerNamespace(text)`. For local Git provider
`local-git`, UUID bytes `00..1f`, and namespace `default`, normative bytes are
`4b53423101000102000000096c6f63616c2d67697400020100000020000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f0003020000000764656661756c74`
and SHA-256 is
`9169a6c9e776f4025f987104ddb25dce0cb158cb3f2e5c2f13641b5fcd0694eb`.

### Repository identity `repoId`

GitHub uses `sha256(KSB1(schema=1, provider="github", canonicalHost,
providerRepositoryId))`; display owner/name is only an alias. Local Git uses
`sha256(KSB1(schema=1, provider="local-git", localRepositoryUuid,
ownerNamespace))`.

- `provider` is `github` or `local-git`.
- GitHub `host`, `owner`, and `repository` are lowercase after GitHub-resolved
  identity lookup; `.git`, credentials, query, fragment, implicit port,
  Unicode confusables, and path traversal are rejected.
- A rename or transfer is resolved through the authenticated provider
  repository ID and recorded as an alias transition. A different immutable
  provider ID requires owner reconciliation.
- `local-git` uses a random 256-bit `localRepositoryUuid` created by explicit
  owner registration in the broker registry, plus an owner-approved namespace.
  `git rev-parse --git-common-dir` associates every worktree with that one
  registration; filesystem path/case/volume never enters `repoId`. The registry
  binds the UUID to object format and a sorted root-commit set. Relocation or a
  changed root set requires explicit reattachment and a new policy generation.
  Alternates are excluded; an authority commit must be reachable from a
  registered primary-store ref and locally present in its primary object store.
  Empty repositories deny until registered again after their first commit.

### Authority locators

A Git locator is `{repoId, providerRepositoryId, commitSha40, pathBytes,
blobOid, byteLength, contentSha256, artifactClass}`. Only a full commit is
accepted. `pathBytes` is slash-separated, relative, non-empty, and has no
`.`/`..` segment. Original bytes must match blob identity and SHA-256 before
activation.

A Jira locator is `{siteId, projectId, issueId, issueKeyAtObservation,
fieldSetId, sourceRevision, jiraUpdated, observedAt,
selectedFieldsSha256}`. Stable IDs come from authenticated Jira responses,
not display names. `fieldSetId` names a versioned KStack allowlist.
`sourceRevision` is changelog identity when available; otherwise it is the
selected-field digest paired with `jiraUpdated`. Issue keys/project names are
labels and cannot authorize access.

Every Jira activation requires a canonical selected-field observation snapshot
whose exact `KSB1` bytes are stored in KStack's approved body store; provider
history is corroboration, not the readback dependency. Production/user-data
snapshots must be encrypted under slice 4 before enablement. If snapshot write,
digest verification, or required encryption fails, activation and citation
fail. Later provider mutation creates a successor record and never changes old
snapshot bytes.

The Jira observation `KSB1` schema is closed: `1 siteId(text), 2
projectId(text), 3 issueId(text), 4 issueKeyAtObservation(text), 5
fieldSetId(text), 6 sourceRevision(text|null), 7 jiraUpdated(time text), 8
observedAt(time text), 9 selectedFieldSequence(raw)`. The sequence is
`uint32-be count` followed by `uint32-be entryLength || KSF1 entry`. Entries are
sorted by field ID UTF-8 bytes then occurrence index. `KSF1` fields are `1
fieldId(text), 2 occurrence(unsigned), 3 scalarKind(unsigned), 4 value`;
scalar kinds are `1 text, 2 unsigned integer, 3 false, 4 true, 5 null`, and
field 4 uses the matching KSB1 primitive type. Unsigned integers use shortest
big-endian bytes, with zero exactly `00`.

Field-set policy permits only scalar values or ordered arrays of scalars;
arrays preserve Jira response order through zero-based occurrence. Objects,
nested arrays, floats, rich text, and unspecified/custom shapes are rejected
unless the versioned field set names fixed JSON Pointer leaves that each yield
one permitted scalar. Duplicate `(fieldId, occurrence)`, gaps, unknown fields,
or type mismatch reject the complete snapshot. `selectedFieldsSha256` is the
SHA-256 of field 9 bytes.

For one `summary="Ship"` entry, field 9 bytes hash to
`8e3290d2cb593e52cb3b4932ad76f7d1b3d6ed5f885b2b9fdeea9e3fae648665`.
The complete published Jira vector bytes are
`4b5342310100010200000006736974652d31000202000000053130303030000302000000053230303030000402000000044b532d310005020000000a72656c656173652d76310006060000000000070200000018323032362d30382d32365431323a30303a30302e3030305a00080200000018323032362d30382d32365431323a30303a30312e3030305a00090100000036000000010000002e4b534631010001020000000773756d6d617279000203000000010000030300000001010004020000000453686970`
with SHA-256
`82c6bdbfb8d6fe98ecbcd60fcbff6572c85b3daed8afc105b2f73cdacdf97184`.

Each `fieldSetId` policy defines integer `freshForSeconds` and
`serveForSeconds` (`60..2,592,000`, with serve >= fresh). The broker records
`observedAt` from its authenticated-response completion using wall UTC while a
monotonic timer measures the request; Jira `updated` never drives freshness.
At evaluation: age <= fresh is `fresh`; fresh < age <= serve is `stale`; age >
serve is `expired` and omitted. Connector failure within serve is
`unavailable` and may be returned only if the caller explicitly allows labeled
snapshots; after serve it is omitted. Wall-clock regression beyond one second
or monotonic/wall inconsistency forces `unavailable` until a successful sync
establishes a new observation.

### Catalog record `SourceRecordV1`

Each activated source contains:

1. schema version, random 128-bit record ID, `repoId`, authority kind/locator,
   artifact class, activation epoch, and status;
2. original byte length/SHA-256, canonical-metadata SHA-256, receipt ID, and
   optional ciphertext/key reference from slice 4;
3. policy/field-set version, retention/sensitivity class, authorized repository
   set, and deletion lineage ID;
4. source/observed/activated/last-verified time and freshness state (`fresh`,
   `stale`, `unavailable`, `expired`, `deleted`); and
5. prior/successor record IDs and reason, with exactly one active record per
   locator lineage.

Catalog records exclude credentials, unrestricted Jira bodies, prompts,
generated summaries, authority decisions, and mutable provider filters.

## Capability contract

KStack issues opaque random capabilities through a local broker. Server-side
state is `{capabilityIdHash, subjectId, repoId, action, constraintsHash,
issuedAt, expiresAt, policyGeneration, revokedAt, parentGrantId,
requestNonce}`.

Only `read`, `ingest`, `remote-sync`, and `administrative-delete` exist; none
implies another. Tokens contain only a random 256-bit secret and key ID. Logs
store its keyed digest, never the token. Default lifetime is one operation and
at most 15 minutes. Tokens are audience-bound to the local broker and never
sent to GitHub or Jira.

Authorization intersects authenticated subject, exact request/token `repoId`,
action equality, provider/project/field/path/retention constraints, current
policy generation, live grant lineage, expiry, and unique nonce for local
mutation. Missing, ambiguous, stale, duplicated, or unresolvable inputs deny.
The broker rechecks revocation and policy generation before the operation and
immediately before atomic activation.

The broker serializes disclosure/activation and revocation with a per-`repoId`
writer-preferred policy lease. A read operation acquires a shared generation
lease before candidate reauthorization and holds it until the final response
byte is accepted by the local transport; activation holds it through the same
database transaction that atomically promotes state and consumes its nonce.
Revocation acquires the exclusive lease, waits for prior shared leases, commits
the generation increment/revocation, invalidates capabilities/caches, then
releases. Its documented linearization point is that commit: after it, no old
generation can emit or activate. New shared leases queue behind a waiting
revoker. Crash recovery treats uncommitted activation as absent and a committed
revocation as authoritative before service readiness.

Environment, current directory, branch name, Jira text, retrieved content, and
agent/model output cannot grant or widen access.

### Cross-repository grants

Default results require record `repoId == request repoId`. An exception is an
owner-approved `{grantId, fromRepoId, toRepoId, actions, artifactClasses,
pathOrProjectScope, purpose, approvedBy, approvedAt, expiresAt,
policyGeneration, revokedAt}`.

Grants are deny-by-default, time bounded, non-transitive, and cannot wildcard
production/user data. Each candidate is checked before original-byte fetch.
Revocation increments policy generation, invalidates derived capabilities,
and evicts affected cache/results at its exclusive-lease commit. Operations
that already hold the prior shared lease linearize before revocation; every
later operation sees the new generation. Content-free audit receipts may remain.

## Citation contract

Every result is `CitedResultV1`: `{resultId, requestRepoId, sourceRecordId,
authorityKind, authorityLocator, sourceRevision, observedAt, freshnessState,
originalContentSha256, chunkByteStart, chunkByteEndExclusive, chunkSha256,
retrievalChannels, componentScores, policyGeneration, derivationReceiptIds,
trustLabel:"UNTRUSTED_RETRIEVED_DATA"}`.

The zero-based half-open byte range is over digest-verified original bytes and
is UTF-8 boundary aligned for text. Citation readback reauthorizes, reloads the
exact revision or approved encrypted snapshot, verifies original and chunk
digests, and returns that exact range. Missing, stale-beyond-policy, deleted,
unauthorized, or mismatched bytes omit the item with a content-free reason;
they are never replaced by a summary. Offline Jira is labeled `stale` or
`unavailable` with exact `observedAt`, never current.

Git readback may use the immutable blob or its verified approved snapshot. Jira
readback always uses the required canonical observation snapshot; a live Jira
response is used only to update freshness/supersession and cannot rewrite the
cited bytes.

`retrievalChannels` is limited to `raw-exact` and `bm25`. Scores explain
ordering only and cannot establish truth or authority.

## Broker request sequence

1. Parse a closed schema; reject unknown/over-limit fields.
2. Authenticate subject and canonicalize request repository.
3. Hash constraints; resolve capability.
4. Acquire the repository shared policy lease; read generation/revocation.
5. Query catalog/index only in the authorized repository/grant set.
6. Reauthorize each candidate before original-byte access.
7. Verify source, metadata, original, range, and chunk digests.
8. Emit cited results plus content-free audit receipt while holding the lease;
   release only after local-transport write completion.
9. Before local activation, repeat policy/revocation validation and consume the
   nonce in the same promotion transaction, then release the lease.

Audit fields are operation ID, keyed subject/capability digests, repo/grant IDs,
action, policy generation, result record IDs/digests, reason codes, timestamps,
and outcome. Queries, tokens, bodies, chunks, Jira prose, credentials, and
secrets never enter ordinary logs.

Snapshots inherit source sensitivity, repository ACL, retention class, and
deletion lineage. Production/user-data snapshot access requires a `read`
capability and encryption; snapshot bodies never enter audit. Content-free
audit receipts are encrypted when repository/grant/record IDs are classified,
accessible only to the repository owner or named auditor, and default to 90-day
retention (configurable 1-365 days). At expiry they are purged. Deletion replaces
source/grant IDs with a keyed deletion-receipt digest where compliance requires
retention; capability IDs/nonces expire after operation plus 24-hour replay
window, then purge. Policy cannot retain query/source bytes in audit.

## Failure controls

- Alias conflict, object/identity/digest mismatch, stale policy, revoked grant,
  or replayed nonce fails closed and quarantines affected derived state.
- Injection text remains untrusted and cannot reach policy parsing, capability
  issuance, connector parameters, or logs.
- Provider outages preserve only labeled snapshots; they do not relax policy.
- Catalog/index corruption triggers discard/rebuild, never authority promotion.
- The broker has no repository-write, Jira-write, release, commit, deploy,
  reviewer, or secret-repository authority.

## Acceptance fixtures

1. Same issue key/path label in two repositories never collides.
2. Rename/transfer, remote spelling, confusables, symlink paths, abbreviated
   SHAs, and traversal resolve safely or deny.
3. No action capability can substitute for another.
4. Cross-repository access denies without a grant, permits only exact scope,
   denies transitive use, and stops before emission after revocation.
5. Policy-generation change between query and activation blocks activation.
6. Replayed, expired, or wrong-repository tokens deny without logging secrets.
7. Git/Jira citation readback reproduces exact original/chunk digests;
   altered/missing/deleted bytes produce no result.
8. Offline/stale Jira is labeled and never presented as current.
9. Injection/secret fixtures cannot change connector, filter, capability,
   citation, or audit behavior.
10. Closed-schema fuzzing proves invalid encoding, oversize values, unknown
    fields, and ambiguous canonicalization fail on Linux, macOS, and Windows.
11. Published `KSB1` positive/negative vectors match byte-for-byte on all hosts;
    worktrees/relocation preserve registered identity, while alternates, root
    changes, and unregistered empty repositories deny.
12. A deterministic scheduler pauses before emission and activation while a
    revoker waits; operations linearize before the exclusive commit or observe
    the new generation, never cross it.
13. Jira mutation without provider history still reproduces the old approved
    snapshot; missing/corrupt/unencrypted-required snapshots never activate.
14. Fresh/stale/unavailable/expired transitions cover clock regression,
    connector failure, exact boundaries, and per-field-set policies.
15. Rollback asserts disposition of every state class, and broker probes prove
    Git/Jira write, release, commit, deploy, and reviewer operations are absent.
16. Static schema/inventory tests fail on any model, embedding, vector,
    semantic, reranking, expansion, Ollama, or provider-adapter field/path.
17. Local-Git and Jira published vectors match exactly; Jira scalar arrays and
    fixed leaf projections round-trip while nested/float/duplicate/gapped forms
    reject the complete observation.
18. Rollback manifest covers catalog/index/cache/snapshot/capability/nonce/key,
    grant/registration/alias/policy/derivation/sync/tombstone/audit classes;
    re-enable proves no retired state can authorize or seed the new instance.

## Delivery and rollback

Slice 1 ships only schemas, canonicalization/capability contracts, fixtures,
and a broker seam behind a disabled flag. Existing explicit KStack memory is
the rollback target. Later slices require these fixtures on each supported
host. Rollback first takes the exclusive lease and disables new requests, then
purges catalog, indexes, caches, cited-result buffers, observation snapshots,
capabilities, nonces/replay state, derivation receipts, pending/failed sync
payloads, sync watermarks, and unused encryption keys. It revokes and purges
all cross-repository grants. Local-repository registrations and alias history
are purged after emitting a content-free retirement digest; a later enablement
must create a new broker instance ID, local UUID, registrations, grants, and
policies through explicit owner action.

Rollback commits a terminal disabled policy generation before purge. Only that
generation/instance digest, active tombstones/non-resurrection epochs, and
content-free audit/deletion/sync receipts survive until their stated retention
expiry; they are non-authorizing and inaccessible to normal search. Expired
receipts purge. No source snapshot, derived content, grant constraint, token,
nonce, connector cursor, or reusable registration survives. A manifest lists
every state class, expected count/disposition, actual purge/retain count, and
key-destruction result; any mismatch reports rollback incomplete and keeps the
broker disabled. Rollback never rewrites GitHub, Jira, or existing explicit
memory. Migration cannot infer a grant.

## Codex closeout rule

Approve only at confidence 93 or higher with zero failed checks, security
findings, material dissent, or unresolved questions. At 84-92, report only
concrete defects in this slice; do not redesign the five-slice architecture.
