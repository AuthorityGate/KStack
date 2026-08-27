# Memory slice 4: encryption, tombstones, purge, and non-resurrection

**Depends on slice 1:** `6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4`  
**Depends on slice 2:** `9b8e303f8a7cbe1a2c7adac7b22e79f8e9aea5131b448175ab7dda499c2d206d`  
**Depends on slice 3:** `41f46d0159f84975403c5829cb7f014a8f93647b700cf65562a9e19d1206b16b`  
**Status:** design review required  
**Authority:** design only; no provider deletion, implementation, or external mutation

## Boundary and claims

This slice makes local KStack memory unreadable at rest where required, makes a
deletion authoritative before reclamation begins, and prevents an old local,
backup, staging, index, cache, connector, or future sync copy from silently
resurrecting it. It never deletes or edits GitHub or Jira. GitHub remains
authoritative only for approved versioned artifacts; Jira remains authoritative
only for allowlisted fields. Jira prose remains untrusted. No model, embedding,
vector, semantic, reranking, expansion, or Ollama path exists.

Deletion has two separately reported guarantees:

1. **logical deletion** is immediate at the tombstone transaction's commit;
   after it, no prior record, result, cursor, generation, or replica may serve;
2. **purge completion** is proven only after the bounded inventory reaches zero
   and required erase-key destruction is confirmed. Filesystem unlink, SSD
   overwrite, snapshot deletion, and provider-side deletion are never claimed
   when they cannot be verified.

## Closed protection policy

`ProtectionPolicyV1 = {environment, dataClass, encryptionMode, keyProviderId,
hardEraseRequired, retentionClassId, receiptRetentionDays, purgeSlaSeconds}`.
Unknown fields and values deny.

- `environment` is `development` or `production`; `dataClass` is `no-user-data`
  or `user-data`. Classification is owner-authored and policy-generation bound;
  source text cannot select or lower it.
- Encryption defaults on. `production` or `user-data` requires
  `encryptionMode=required` and a healthy key provider before ingestion,
  activation, retrieval, quarantine, or sync can enable. An approval or risk
  acknowledgement cannot relabel an unencrypted store production-ready.
- Only `development + no-user-data` may use `encryptionMode=acknowledged-off`.
  It requires an owner identity, timestamp, exact policy digest, expiry of at
  most 30 days, and risk text in a content-free receipt. Any user-data
  classification or production transition disables service until every live
  object is encrypted and verified or purged. Plaintext development state is
  visibly marked, excluded from sync/export/backups, and never silently copied.
- Retention is an integer 1..2,592,000 seconds or `until-owner-delete`, scoped
  by artifact/sensitivity class. Shorter applicable retention wins. Receipt
  retention is 1..365 days. Purge SLA is 60..86,400 seconds and is an
  operational target, not permission to serve after logical deletion.

`KeyProviderV1 = {providerId, kind, stableProviderIdentity, keyNamespace,
attestationDigest, runtimeOperations, destructionBrokerId}` is owner-approved
and policy-bound. The ordinary runtime role has exactly create, encrypt-key,
current-epoch decrypt-key, and status; it has no historical-restore, destroy
operation, or destroy credential. A
separate deletion broker may call destroy only with a provider-verified,
single-use `DestroyTicketV1 = {providerId, eraseKeyHandleDigest,
tombstoneDigest, repositoryStateEpoch, anchorReceiptDigest, nonce, expiresAt}`
issued after the independent anchor advance. The provider rejects a reused,
expired, wrong-handle, lower-epoch, or anchor-mismatched ticket. Neither role
can mint the other's credential.

The provider keeps key material outside the repository, ordinary configuration,
logs, process arguments, environment variables, body store, database, and
backups. It returns opaque handles and authenticated wrapped-key bytes only.
Provider identity, namespace, role separation, and create/destroy/unwrap-after-
restart probes must pass before enablement. Missing, changed, locked,
rolled-back, or unverifiable provider state stops unavailable; it never falls
back to plaintext or another provider. Development acknowledged-off creates no
fake key receipt.

Audit-integrity and keyed-identity operations use separate non-exportable
provider keys and namespaces from body erase keys. Runtime receives only MAC/
verify or HMAC operations, never raw keys. Each has a monotonic key epoch and a
verification keyring. Rotation retains old verification capability only until
the last ledger/receipt/tombstone that names it expires; retirement is
provider-confirmed and receipt-bound. Backups contain key IDs/epochs and MACs,
not keys. Restore must reach the same provider identity/keyring or deny. These
keys cannot encrypt/decrypt source bodies or authorize destroy.

`RollbackAnchorV1 = {anchorId, stableProviderIdentity, repositoryHandle,
latestStateEpoch, latestTombstoneDigest, priorAnchorReceiptDigest}` is held by
an independent durable service outside the host, repository, KStack backups,
and body key provider. It supports authenticated read and monotonic compare-and-
advance only: no decrement, overwrite, deletion, or source-content storage. Its
append-only entry contains the canonical content-free `TombstoneV1` plus the
new epoch/head digest, sufficient to recover a crash between anchor and local
commit. Production backup/restore and hard-erasure claims require an anchor
whose anti-rollback property is attested and survives host replacement. If the
anchor is unreachable, behind local state, or cannot prove continuity, the
repository cannot restore or serve. Development without backups may explicitly
run unanchored but cannot claim rollback-resistant deletion or become
production until a new empty instance is anchored.

## Envelope and storage contract

Each source-record deletion lineage has a distinct provider-managed,
individually destroyable 256-bit lineage erase key. Every immutable aggregate
Slice-2 generation has its own distinct provider-managed generation erase key;
each preactivation run has a temporary run erase key; content-free retained
audit/ledger data uses a separate retention-scoped key. No key scope implies
another. Each stored object has a random 256-bit
data-encryption key (DEK). The object body is encrypted with `AES-256-GCM`, a
fresh 96-bit random nonce, and a 128-bit tag. The DEK is wrapped by the exact
lineage, generation, run, or retention erase key through the provider's authenticated
encrypt-key operation. A repeated `(eraseKeyHandle, objectId)` or body nonce is
a corruption event and disables the affected scope. Randomness failure denies
writes.

`EncryptedObjectV1 = {schema:1, objectId, repositoryKeyedDigest, keyScopeKind,
scopeKeyedDigest, objectClass, ciphertextLength, algorithm:"AES-256-GCM",
nonce, ciphertext, tag, eraseKeyHandle, wrappedDek, wrapReceiptDigest,
policyGeneration, repositoryStateEpoch, keyEpoch}`. Clear identifiers and
digests are keyed pseudonyms under the keyed-identity provider; equality is
per-repository and cannot be tested without that provider. AEAD associated data
is canonical `KSB1` over every field except nonce/ciphertext/tag/wrappedDek.
The encrypted inner header contains repoId, exactly one lineageId/generationId/
runId or retention namespace, plaintext length/SHA-256, metadata SHA-256, and
canonical metadata. Unknown fields, length mismatch, tag/hash failure, wrong
repository/scope/class, stale policy/state/key epoch, or provider mismatch deny
before any plaintext is returned. No unkeyed plaintext or metadata hash is
stored outside ciphertext.

`ObjectClassKeyScopeV1` is a closed table: original snapshots, imported bodies,
per-record catalog payloads, and single-record derivations use `lineage`;
multi-lineage BM25 postings/statistics/manifests and persistent result caches
use `generation`; preactivation staging, quarantine, and pending sync payloads
use `run`; only non-reconstructive tombstone/audit/deletion/sync receipts use
`retention`. Content-free connector cursors are integrity protected but hold no
body digest. An object spanning multiple lineages cannot use lineage, run, or
retention scope; staging and pending sync therefore split body-bearing objects
per lineage/run and use only a content-free batch manifest. Unknown object
classes or scope mismatches deny. Activation
rewrites admitted run objects under their final lineage/generation scope and
destroys the run key after the transaction; failed runs destroy it on cleanup.

The required protected inventory is: Git/Jira observation snapshots, imported
explicit-memory bodies, per-record catalog fields classified by policy, BM25
token/posting generations, generation statistics/manifests, persistent staging,
quarantine, derivation and pending-sync payloads, and classified receipts.
Query text, exact-hit windows, decrypted bodies, and result bytes remain only in
bounded process memory for the operation and are never persisted by KStack. The
process requests locked/non-dumpable memory where the host supports it. A
`MemoryExposureProfileV1` names exact host controls and probe evidence. Linux
requires core size zero, a non-dumpable process, and non-dumpable sensitive
mappings; macOS and Windows require their approved crash-report/debug/dump
exclusion policy plus a controlled-crash artifact probe. Locked memory remains
best effort and is not called secure erase. A host that cannot verify required
dump exclusion fails production/user-data readiness; it may not pass by warning.

Production ingestion encrypts while streaming from the bounded network buffer
to the private ciphertext object; plaintext never lands in staging or ordinary
temporary files. Slice 2 opens a verified encrypted generation into its private
in-process PGLite/WASM memory and writes back only a newly sealed generation.
It never creates a plaintext database file. Snapshots decrypt as a bounded
stream only after slice-1 candidate reauthorization and digest verification.
All plaintext buffers are overwritten on release on a best-effort basis, with
no claim that a managed runtime or OS eliminated every transient RAM copy.

Encrypted files use a private KStack directory outside Git, no-follow creation,
descriptor identity revalidation, owner-only access where the host can enforce
it, and fixed size/count/depth bounds. `DurableReplaceV1` is host-specific and
must pass power-loss/crash vectors on the actual filesystem. POSIX uses same-
directory create-exclusive temporary files, file fsync, atomic rename, and
parent-directory fsync. Windows uses same-volume create-new handles with
reparse-point and volume/file-ID revalidation, `FlushFileBuffers`, then
`MoveFileExW(REPLACE_EXISTING|WRITE_THROUGH)` and directory-handle durability
verification where supported. A Windows filesystem/API combination that cannot
prove the committed old-or-new outcome fails production readiness rather than
claiming POSIX semantics. Exact POSIX modes are not claimed on Windows; ACL/
owner identity is probed there. File permissions supplement encryption and
never replace it.

### Rotation and backup

`ScopeKeysetV1 = {scopeKind, scopeKeyedDigest, repositoryStateEpoch,
currentKeyEpoch, currentEraseKeyHandle, historicalHandles[]}` is provider-
authenticated. Routine rotation takes the repository exclusive publication
lease, captures the current tombstone/state epoch, creates a new erase key and
key epoch, and rewraps every live DEK without writing plaintext bodies. The
commit rechecks the anchor/tombstone/state epoch and atomically publishes the
new wrappers/keyset; a deletion that advanced the epoch makes it abort. Old
wrappers leave live state only after tag/digest/provider/inventory verification.
Historical erase-key handles are status-only to ordinary runtime. An isolated
restore broker may unwrap with a one-use provider ticket bound to the current
anchor epoch/head, exact backup manifest, scope, and historical key epoch; it
cannot bypass a tombstone or destroyed status. After all backups that name an
epoch expire, its handle receives a separately authorized retirement ticket. A
lineage deletion ticket instead enumerates and destroys
every current and historical lineage handle; deletion of a containing aggregate
generation separately destroys that generation's handles after replacement.
Crash recovery chooses only the receipt-bound committed keyset and purges an
incomplete rewrap; it never guesses from newest mtime.

Backups may contain only ciphertext, wrapped DEKs, closed metadata, and the
complete tombstone/non-resurrection ledger. They never contain provider erase
keys. A `hardEraseRequired` repository is eligible only when its provider can
destroy each lineage and generation erase key independently and every restore
environment uses that same destroyed-key status. If provider destruction cannot be proved,
KStack reports logical deletion plus purge pending/retention expiry; it does not
claim cryptographic erasure. Restore imports and validates the tombstone ledger
against the independent anchor, then validates every named key epoch/status
before importing any body, catalog, index, cursor, or sync state. A backup
without that ordering is unusable.

## Tombstone state machine and linearization

`TombstoneV1 = {schema:1, repositoryKeyedDigest, lineageKeyedDigest,
deletionIdentityKeyedDigests[], tombstoneEpoch, repositoryStateEpoch,
sourceCausalityDescriptor, reasonClass, authority, observedPolicyGeneration,
committedAt, purgeDeadline, priorTombstoneDigest, identityKeyEpoch,
integrityKeyEpoch}`. It contains no source bytes, issue text, path, query,
credentials, raw locator, wrapped DEK, or body key material. State/tombstone
epochs are repository-local monotonic unsigned 64-bit integers independent of
the owner-authored policy generation. The canonical record is hash chained and
authenticated by the separate audit-integrity key; identity values use the
separate keyed-identity provider. A gap or mismatch against the independent
anchor disables the repository.

`DeletionIdentityV1` is closed. Git uses repoId, immutable provider repository
ID, canonical authority path bytes, and artifact class; its lineage spans
commit/force-push changes at that path. Jira uses stable site/project/issue IDs
and fieldSetId, never issue key or display label. An owner-recorded path alias
adds both old and new Git identities to the lineage; identical bytes elsewhere
do not imply an alias. Every identity in the lineage is retained as a keyed
digest in the tombstone and checked before staging or activation. Admission
computes the candidate under every identity-key epoch still referenced by a
live tombstone; rotation cannot make an older deletion invisible.

`sourceCausalityDescriptor` is content-free but typed. Git records the deleted
full commit(s) and commit-graph digest as keyed values; restoration proves the
exact proposed commit is a descendant, or the explicit owner restoration
decision names that exact non-descendant commit and acknowledges the history
break. Jira records stable issue ID plus authenticated changelog sequence when
available; restoration requires a greater sequence, or an owner decision bound
to the exact new observation digest when Jira supplies no comparable revision.
All restoration remains explicit; timestamp, issue key, identical content,
force-push, or provider reappearance alone never proves causality.

A tombstone may be requested only by:

- a one-operation, nonce-bound `administrative-delete` capability whose exact
  repository, lineage, reason, and retention constraints are owner approved;
- a slice-3 `observe-missing` manifest produced by the two complete authorized
  absence polls and consumed once in the ingest activation transaction; or
- an internal one-operation `administrative-delete` capability issued from an
  already-approved retention rule at its trusted-clock deadline.

Permission errors, outages, partial scans, expired capabilities, provider text,
Jira issue keys, Git paths, sync messages, and wall-clock regression cannot
create a tombstone.

Every state-publishing operation—ingest, activation, staging promotion,
connector resume, generation rebuild, rotation, backup, purge, and Slice-5
sync—registers a writer and takes the shared publication lease with the current
repository state/tombstone epoch. Immediately before its only publish point it
rechecks both the local state and independent anchor. A changed epoch aborts and
purges its private output. No adapter may publish around this broker seam.

Deletion takes the repository exclusive writer-preferred publication lease,
waits for earlier read leases and registered publishers, reauthorizes the cause,
and prepares the canonical tombstone and next state/tombstone epoch. While the
lease blocks all output, it compare-and-advances the independent anchor with the
complete content-free tombstone. That irreversible anchor advance is the
logical-deletion linearization point. The local transaction then marks the
complete lineage `deleted`; records the new state/tombstone epochs without
changing owner policy generation; clears its active pointer; invalidates
grants/capabilities/nonces, result buffers, cursors, caches, and connector
resumes that could expose it; marks every containing Slice-2 generation
unavailable; consumes the request/absence nonce; and appends the anchor-bound
intent receipt.

A crash before anchor advance leaves the old record live and the request
retryable by the same idempotency key. A crash after anchor advance can never
serve: startup reads the anchor before local state and replays its full
content-free tombstone into the local transaction, then resumes purge. Failure
to finish local recovery keeps the repository disabled. Startup verifies anchor
continuity and state/tombstone epochs before catalogs, generations, connectors,
backup restore, or serving. A local ledger behind the anchor is recovered; one
ahead of or divergent from it denies. Restoring bodies never repairs it.

## Purge and non-resurrection

The purge worker holds the exclusive publication lease and uses a versioned,
closed `StorageClassRegistryV1`. Every local/backup/sync adapter must support a
monotonic repository-state fence, writer registration/cancellation, quiescence
acknowledgement, and strongly consistent listing of its committed and temporary
namespaces. The purge advances each adapter fence to the anchored deletion
epoch, revokes older publish credentials, waits for all registered/in-flight
writers to drain or acknowledge cancellation, and denies `purge-complete` if an
adapter cannot prove those properties. It enumerates from both tombstone and
registry, never a single catalog manifest.

It rebuilds active Slice-2 generations without the lineage, swaps only after
source-set/anchor/tombstone validation, then obtains single-use destruction
tickets for every old containing generation key. It removes record ciphertext/
wrapped DEKs, catalog payloads, caches, cursor state, exact-result buffers,
staging, quarantine, connector checkpoints, failed/private generations,
pending/failed sync payloads, and backup objects within KStack's declared
administrative scope. Finally, anchor-bound tickets destroy every current and
historical lineage erase key. General runtime code cannot invoke destruction.

Deletion receipts retain only tombstone/instance/policy digests, keyed lineage
and locator digests, reason class, counts by storage class, provider destruction
receipt digest/status, timestamps, and purge outcome. Ordinary audit records
replace direct record/grant identifiers as required by Slice 1. Receipts cannot
authorize, locate, rebuild, rank, cite, or sync content and expire under their
existing policy. Tombstones/non-resurrection epochs survive at least as long as
any ciphertext, backup, downstream replica, or receipt can survive. If that
upper bound is unknown, the tombstone does not expire.

`purge-complete` requires: the exact registry version/fence is anchor-bound;
every adapter and writer is quiescent at or beyond it; zero committed or
temporary lineage objects exist in every class; no active/rollback generation
contains the record; no live cursor, cache, staging, quarantine, connector, or
pending-sync reference exists; all required current/historical lineage and
containing-generation keys report destroyed; and a receipt-bound second
inventory after a broker restart observes the same fences and zero state. A
stale writer credential cannot publish after the fence. Any mismatch remains
`purge-pending`, alerts doctor, retries within the SLA, and keeps service denied
for that lineage.

No provider reappearance, older poll, replayed staging manifest, stale backup,
old sync event, prior generation, alias, identical bytes, or restored wrapped
DEK may clear a tombstone. Admission after deletion requires a new explicit
owner restoration decision bound to the tombstone digest, an owner-created new
policy generation, the exact causality proof defined above, a new lineage ID
and erase key, and ordinary `ingest` authorization.
It creates a successor that cites the restoration receipt; it never edits,
decrements, or deletes the old tombstone. Without every condition, content
remains unavailable even if authoritative GitHub/Jira contains it again.

Slice 5 must transmit tombstones before or atomically with any newer source
state, reject lower epochs, retain them across disconnect/retry, and acknowledge
their application before a remote replica can serve. Local logical deletion
does not wait for a remote acknowledgement. Until Slice 5 proves those rules,
production remote sync of protected memory remains disabled.

## Acceptance fixtures

1. AES-GCM known-answer, nonce/tag/AAD/length/digest tamper, wrong repo/lineage/
   object class, duplicate nonce, randomness failure, key rollback, and provider
   replacement all deny before plaintext emission on Linux/macOS/Windows.
2. Static/dynamic inventory proves production/user-data plaintext never reaches
   KStack disk, logs, arguments, environment, Git, ordinary temp, or backups;
   PGLite reopens only in process. Each enabled OS profile must independently
   prove dump exclusion; unsupported profiles fail readiness instead of passing.
3. Development/no-user-data acknowledged-off requires the complete expiring
   owner record, visibly reports degraded protection, cannot sync/export, and
   blocks a production/user-data transition until encrypt-or-purge completes.
4. Crash/power-loss schedules at every encrypt/write/flush/rename/rewrap/
   activation step exercise the declared POSIX and Windows adapters on each
   supported filesystem and expose only the prior committed object or one
   verified successor. An unproved durable replace combination fails readiness.
5. Read/delete schedules prove a read finishes before anchor advance or emits
   nothing after it; waiting writers are preferred and no cache/cursor/old
   generation crosses the linearization point.
6. Administrative, confirmed-absence, and retention-expiry deletions consume
   exactly one authorized nonce. Permission failure, 404, partial inventory,
   outage, clock regression, Jira prose, and replay never tombstone.
7. A crash before/after anchor advance and at every local tombstone/pointer/
   generation/purge/key-destroy step reads the anchor first, recovers behind
   state, rejects ahead/divergent state, and never temporarily serves.
8. Purge inventory seeds committed/temporary copies and blocked/late writers in
   every registered storage class. `purge-complete` is impossible until adapter
   fences revoke old credentials, writers quiesce, all copies are zero, every
   required current/historical key is destroyed, and restart reconfirms it.
9. Stale backup, lower epoch, old sync event, force-push, Jira reappearance,
   identical bytes, path alias, and replayed manifest match the closed keyed
   deletion identities and cannot resurrect. Restoration proves Git descendant
   or exact owner-bound history break, or greater Jira changelog/exact owner-
   bound observation, then creates a new lineage/policy generation only.
10. Rotation and concurrent deletion prove the state/tombstone fence makes
    deletion win; an incomplete rewrap cannot publish. Deletion tickets destroy
    all historical/current lineage and affected generation handles exactly once,
    while ordinary runtime credentials cannot call destroy.
11. Retention exact-boundary/future-clock/clock-regression fixtures use trusted
    wall plus monotonic time; uncertainty makes records unavailable and delays
    physical purge but never extends serving past a committed tombstone.
12. Backup restore validates tombstones/provider status first; missing/gapped/
    unauthenticated ledgers, live ciphertext under a destroyed key, or a backup
    with no declared deletion bound disables rather than partially restores.
13. Receipt inspection proves no plaintext, raw locator, source/grant/record ID,
    query, credential, wrapped DEK, key handle, or reconstructive token survives
    when policy requires keyed deletion digests.
14. Static schema/source inventory rejects model/embedding/vector/semantic/
    reranking/expansion/Ollama fields and any GitHub/Jira write/delete method.
15. Rollback and re-enable fixtures enumerate every Slice 1-4 state class,
    preserve non-authorizing tombstones/receipts only for required retention,
    and prove a new broker instance cannot use retired IDs, keys, registrations,
    grants, cursors, connectors, indexes, or snapshots.
16. A stale backup restores its local ledger, MAC keys, and ciphertext together;
    the independent anchor still exposes the newer epoch/full tombstone and
    forces deletion recovery before any local state loads. Host replacement uses
    the same anchor or denies.
17. Audit-integrity/keyed-identity rotations verify old records through the
    bounded keyring, keep keys out of backups, retire only after referenced
    evidence expires, and cannot encrypt bodies or authorize destruction.
18. Closed class/scope vectors reject every mismatch, especially multi-lineage
    objects under lineage/run/retention. Low-entropy body/metadata equality is
    not testable from clear envelopes without the keyed-identity provider.

## Delivery and rollback

This slice delivers schemas, a key-provider seam, sealed-storage/tombstone/purge
contracts, doctor states, and fixtures behind a disabled flag. It does not turn
on connectors or remote sync. Production remains disabled until the selected
host passes encryption, restart, tombstone, purge, and restore fixtures.

Rollback takes the exclusive lease, commits the terminal disabled generation,
cancels ingestion/query/sync, and performs the same purge inventory over every
Slice 1-4 state class. It never decrypts data into a rollback target. It
destroys unused/live KStack lineage keys after protected state is retired,
purges acknowledged-off development plaintext, registrations, grants,
capabilities, nonces, connectors, catalogs, indexes, bodies, staging,
quarantine, caches, cursors, and pending sync. Existing explicit KStack memory,
GitHub, and Jira are unchanged.

Active tombstones/non-resurrection epochs and content-free deletion/audit/sync
receipts remain only for their required retention and cannot serve or authorize.
A rollback disposition receipt binds expected/actual counts for every class,
each key outcome, and every retained tombstone. Any mismatch keeps the broker
disabled and reports rollback incomplete. Re-enable creates a new broker
instance, keys, repository registrations, grants, and policies; it imports no
retired state.

## Codex closeout rule

Approve only at confidence 93+ with zero failed checks, security findings,
material dissent, or unresolved questions. At 84-92 fix only concrete Slice-4
defects; accepted Slices 1-3 and the absolute no-model/no-Ollama boundary stay
fixed.
