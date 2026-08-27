# Memory slice 5: adapted sync queue, recovery, health, and cross-host portability

**Depends on slice 1:** `6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4`  
**Depends on slice 2:** `9b8e303f8a7cbe1a2c7adac7b22e79f8e9aea5131b448175ab7dda499c2d206d`  
**Depends on slice 3:** `41f46d0159f84975403c5829cb7f014a8f93647b700cf65562a9e19d1206b16b`  
**Depends on slice 4:** `7e652550ff287d834235a5a1ae83082b711fd4509aa1046d86b3b4a40e8b3207`  
**Reuse ledger:** `baf70e2cde3f82ff17a34c97599797875d73a07eea3bdc6fa2685a6016374676`  
**Status:** design review required  
**Authority:** design only; no remote write, implementation, commit, push, or external mutation

## Boundary and adapted provenance

This slice adapts the inspected gstack/gbrain queue, boundary-drain, receipt,
failure-preservation, normalized-remote, health, and recovery patterns behind
the closed KStack contracts. Any later code adaptation must reproduce the
ledger's frozen gstack commit/blob/byte/SHA-256 identities, retain the MIT
notice, identify modified files, and pass independent KStack tests. Mem0 entity
filters/history, Graphiti temporal provenance, and Letta Git activation/
worktree/doctor patterns are behavior references only unless their separately
bound Apache-2.0 objects are reused with attribution.

Git/GitHub remains authoritative only for approved versioned KStack artifacts;
Jira remains authoritative only for allowlisted ticket/workflow/release fields.
The sync Git remote is an encrypted transport and append-only event journal,
never a third authority, policy source, grant source, or automatic retrieval
source. Jira prose remains untrusted. No model, embedding, vector, semantic,
reranking, expansion, query-generation, or Ollama path exists.

Sync is repository-scoped, optional, and enabled only by explicit owner choice
during first KStack setup or later repository configuration. Setup presents the
same choice for development repositories and for every newly registered repo;
the recommended default is enabled when a qualifying private remote, key
provider, and rollback anchor are available, but `skip` is valid and recorded.
Disabling sync never disables local exact/BM25 memory. Production/user-data
sync cannot start from Slice-4 acknowledged-off plaintext.

## Closed topology and identities

`SyncRemoteV1 = {syncRemoteId, repoId, transport, canonicalHost, port,
providerRepositoryId, remotePath, privacyProof, originPolicyDigest,
credentialHandle, metadataAdapterId, branchNamespace, maxBytesPerDrain, maxEventsPerDrain,
syncEpoch, gitObjectFormat, pollSeconds}` is owner-authored and policy-generation bound. Unknown fields,
wildcards, credential-bearing URLs, query/fragment, implicit identity, and
content-derived configuration deny.

- `transport=https` uses Slice 3's origin/DNS/IP/TLS/redirect confinement and a
  host secret handle through askpass; environment credentials and proxies are
  ignored. `transport=ssh` additionally requires exact host/port/user, a pinned
  host-key fingerprint, BatchMode/IdentitiesOnly/StrictHostKeyChecking, a
  dedicated read/write key handle, and an owner-approved network zone. `file`,
  `ext`, unauthenticated Git, helper-defined transports, submodules, alternates,
  and credential helpers deny.
- `RemoteMetadataProofV1 = {adapterId, providerKind, originRegistryId,
  stableProviderId, providerRepositoryId, canonicalOwnerName, visibility,
  callerAccessRole, accessPolicyDigest, observedAt, expiresAt,
  authenticatedResponseDigest}` is closed and expires within 15 minutes. The
  configured adapter must reproduce it immediately before payload transfer;
  labels cannot replace stable IDs and `visibility` must prove private for
  production/user-data.
- The remote stable repository ID is verified through the authenticated host,
  and the configured URL normalizes to exactly that identity. Rename/transfer
  requires owner reconciliation. Production/user-data requires an authenticated
  private/access-control proof; an unverifiable remote cannot be accepted by a
  risk warning.
- Network write inventory is only Git receive-pack to this remote and the exact
  client ref. Git read inventory is upload-pack for configured refs. The
  separately registered `RemoteMetadataProofV1` adapter may issue only GET/HEAD
  to a Slice-3-confined provider metadata origin and exact stable-repository-ID
  endpoint; its authenticated response supplies immutable provider repository
  ID, canonical owner/name labels, visibility/private state, caller access role,
  and observed/expiry time. It reads no repository file, issue, or source body.
  Self-hosted Git without such an API must supply an owner-approved signed
  identity/privacy attestation whose signer, expiry, stable ID, and access-policy
  digest are verified through the same confined origin; SSH/upload-pack alone
  never qualifies as proof. Hooks, filters,
  smudge/clean, submodule recursion, arbitrary Git config, shell aliases, and
  remote-provided executable content are disabled. Provider APIs, GitHub/Jira
  source repositories, issues, comments, releases, and branches are never
  mutated by memory sync.
- Bounds are 1..1,000 events, 1 MiB..64 MiB per drain, poll 60..86,400 seconds,
  and a 10-minute run deadline. Oversize work remains queued; it is not split in
  a way that changes an event digest.

`SyncClientV1 = {clientId, repoId, role, publicSigningKey, hostClass, createdAt,
expiresAt, policyGeneration, revokedAt, cutoffRecordDigest|null, exactRef, genesisCommitOid,
genesisRecordDigest}` is an explicit owner-approved
registry entry. `clientId` is random 128-bit; Ed25519 private signing keys stay
in the host key provider. `role` is `producer` or the separately owner-approved
one-operation `compactor`; neither implies authority over source truth.
Enrollment, renewal, revocation, or a new client ref
is never inferred from remote content. Each client owns exactly
`refs/heads/<branchNamespace>/<repositoryKeyedDigest>/<syncEpoch>/<clientId>` and may only
fast-forward it. Force push, ref deletion, tag mutation, and writes to another
client ref deny.

`SyncGenesisV1 = {schema:1, repositoryKeyedDigest, syncEpoch, clientId,
publicSigningKeyDigest, pendingEnrollmentDigest, createdAt, signature}` is canonical
KSB1 and signed by that client key. Its SHA-256 is `genesisRecordDigest`; it is
the only sequence-zero record and contains no event/payload/source authority.

Enrollment is two-phase: an owner-approved pending client/key/ref may create one
content-free signed genesis-record commit; authenticated readback returns its OID/digest,
and a second owner confirmation activates the exact completed registry entry.
Before that confirmation the client cannot enqueue, checkpoint, ingest, or
serve. A failed/abandoned pending genesis is never auto-adopted or deleted.

The same independent service used for Slice-4 rollback anchors maintains a
separate content-free `SyncCheckpointV1 = {repoKeyedDigest, clientId,
syncEpoch, clientRegistryDigest, maxSequence, eventDigest, remoteCommitOid,
priorCheckpointDigest}` through
monotonic compare-and-advance. It cannot authorize content. After outbound
readback and before local ack, the client advances this checkpoint. A crash is
recovered by exact remote readback and idempotent advance. Every inbound client,
including a new host, requires the configured genesis and anchored checkpoint
to be an exact prefix/ancestor of the fetched signed ref. A missing, truncated,
or rolled-back remote therefore cannot report cross-host ready even when all
local backup state was restored from the same old point. Unanchored remote
suffixes wait for their producer's checkpoint and never activate early.

`ClientCutoffV1 = {repoKeyedDigest, clientId, reason, cutoffSequence,
cutoffEventDigest, checkpointReceiptDigest, effectiveAt}` is monotonically
stored by the independent checkpoint service. Owner revocation chooses an exact
cutoff no greater than the last anchored checkpoint. At `expiresAt`, the service
seals the highest checkpoint it committed no later than that trusted time; if
none, cutoff is zero/genesis. Events at or below the cutoff remain verifiable
transport history, while every greater sequence is rejected. A client past
expiry/revocation without a valid cutoff record is blocked, never wholly
discarded or allowed to extend. Timestamps inside events cannot alter cutoff.

All worktrees of one Git common directory share Slice-1 `repoId`, one local
coordinator, spool, and client sequence; branch names are informational and do
not create separate memory authority. Sync uses a protected isolated worktree/
object directory and never changes an operator checkout, index, branch, stash,
or uncommitted file.

`GitObjectContractV1` binds `gitObjectFormat` to exactly `sha1` or `sha256` as
reported by the remote; every enrolled client must use the same value. KStack
constructs transport objects from raw canonical bytes with plumbing, never a
checkout: blob bytes are exact KSB1/event/manifest bytes; paths are lower-ASCII
from the fixed grammar and reject case collisions; every file mode is `100644`;
trees sort by Git raw path-byte order; symlink/gitlink/executable modes deny.

Commit bytes are closed: exact tree and optional one parent, author/committer
`KStack Sync <kstack-sync@invalid>`, the pre-egress receipt's UTC whole-second
timestamp with timezone `+0000`, no encoding or signature header, and LF-only
message `kstack-sync-v1 <batchId>`. Genesis uses the same contract with no
parent and `kstack-sync-genesis-v1 <clientId>`. Object creation runs with an
empty sanitized Git config/environment, no attributes, autocrlf, safecrlf,
filemode, hooks, signing, filters, replacement refs, grafts, or alternates.
Pack/compression bytes are irrelevant; object bytes/OIDs and event SHA-256/HMAC
must match frozen vectors. A Git version/object-format/host that cannot reproduce
the vectors cannot enroll or push; it does not normalize after the fact.

## Immutable event and maildir queue

`SyncEventCoreV1 = {schema:1, repositoryKeyedDigest, syncEpoch, clientId,
clientSequence, previousEventDigest, eventKind, scopeKeyedDigest,
sourceRevisionKeyedDigest|null, repositoryStateEpoch, tombstoneEpoch,
observedPolicyGeneration, payloadKind, payloadDigest|null,
payloadLength, createdAt}`. First compute `eventId` as the keyed-identity
HMAC of the canonical KSB1 core bytes, which contain neither eventId nor
signature. Then `SyncEventV1 = {core, eventId, signature}`, where the Ed25519
signature covers canonical KSB1 `(core,eventId)`. A verifier recomputes eventId
before checking the signature. No field is self-referential.

`eventKind` is exactly `source-activate`, `source-supersede`,
`freshness-verify`, `tombstone`, or `transport-smoke`. Source/freshness kinds
require `payloadKind=source`, a non-null SHA-256 of the lineage-encrypted payload,
and a positive payload length. Tombstone requires `payloadKind=tombstone`, a
non-null SHA-256/positive length of the exact anchor-authenticated content-free
TombstoneV1 bytes, and no body ciphertext.
Transport-smoke requires `payloadKind=none`, the dedicated keyed test scope,
null source revision/payload digest, zero payload length, and cannot enter
catalog, source-set, or retrieval. Every other combination denies.

Sequence begins at one and strictly increments. The signed content-free genesis
record has `clientSequence=0`; its canonical digest is the mandatory
`previousEventDigest` for event one. Each later predecessor is SHA-256 of the
complete canonical prior `SyncEventV1` bytes. Zero, an eventId alone, a commit
OID, or a digest from another client/epoch never roots or advances the chain.

Source events carry one Slice-4 encrypted, lineage-scoped payload containing
the complete Slice-1 source record, authority locator/snapshot ciphertext,
original/canonical digests, freshness/temporal provenance, and activation/
derivation receipts. The clear envelope contains no repo/source/record/grant
ID, path, issue key/text, content hash, query, token, credential, wrapped key,
or excerpt. Tombstone events carry the anchor-authenticated content-free
`TombstoneV1` and no body payload. Policy, grants, capabilities, client registry,
owner rules, and executable configuration are never synced.

The private spool is outside Git and has `tmp`, `new`, `cur`, `failed`, and
`acked` directories. Producers create one bounded file in `tmp`, flush it,
atomically rename it into `new`, and flush the directory through the qualified
Slice-4 host durability adapter. Names are random plus event keyed digest; data
is never appended in place. A drain claims `new -> cur` under the local
coordinator lease. Success moves it to `acked` only after remote readback and a
completion receipt; retry returns it to `new`; permanent policy/scan/conflict
failure moves it to `failed` without deleting payload or original diagnostics.
Acknowledged entries purge after their receipt retention. Queue drop requires
an exact preview/count, owner `remote-sync` authorization and acknowledgement,
and a disposition receipt; it never deletes active local memory or rewrites the
remote.

Each active source transaction writes a closed transactional-outbox row,
allocated client sequence, event digest, and encrypted payload object ID in the
same database commit as local activation. A materializer idempotently creates
the maildir file; until its matching spool receipt exists health is
`sync-pending`, never ready. A tombstone outbox row is recovered from the
independently anchored Slice-4 tombstone and marks the drain urgent. Each client
ref still sends the earliest contiguous client-sequence prefix; it never skips
older events to reach a tombstone. Bounded drains reschedule immediately until
that prefix includes it, while every host already denies from the independent
anchor. Across eligible refs, ordering is repository state epoch, tombstone
before source at the same epoch, client ID, sequence, and event ID. Body-bearing
payloads are one lineage per event; batch manifests are content-free.

Queue/idempotency identity is `(repoId,eventId)`. Duplicate producers, retry,
lost responses, or repeated boundary drains produce one remote path and one
local activation/completion receipt. Conflicting bytes/signatures for the same
event ID quarantine the client/ref and stop that lineage; no mtime, last-writer,
or model judgment resolves it.

## Outbound receipt-before-egress protocol

Every run acquires a one-operation `remote-sync` capability restricted to exact
repo/remote/client/ref/event classes and the shared Slice-4 publication lease.
Before any DNS/network operation it writes a content-free intent receipt. It
then revalidates the stable remote ID, private/access-control proof, and exact
origin; an outdated or unverifiable proof stops before payload transfer. After
claim/reauthorize, it decrypts each source payload only in protected process
memory, repeats secret/injection scanning, validates locator/body/canonical/
policy/tombstone/key epochs, and verifies the existing envelope/tag/digest
without changing any signed byte. A finding,
scanner failure, or stale authority preserves the queue and sends nothing.

Before egress, an append-only receipt commits remote/client/ref keyed digests,
expected old remote OID, ordered event IDs, payload digests/lengths, scanner
versions/results, anchor head, repository state/tombstone/policy epochs,
attempt ID, expiry, and total bytes. It contains no source bytes or clear
identity. If this receipt or its hash-chain/flush fails, no Git commit or push is
made and `cur` returns intact to `new`.

`SyncBatchV1 = {schema:1, clientId, exactRef, expectedParentOid, batchId,
firstSequence, lastSequence, orderedEventPathsAndBlobOids, intentReceiptDigest,
signature}` is canonical KSB1 and Ed25519 signed. Its Git tree delta from the
expected parent must be exactly this manifest plus its listed event files; no
other path may change. This binds the batch without trusting Git configuration
or an ambiguous commit-signing format.

The broker then fetches the exact client ref into the isolated worktree, verifies
remote identity and that its tip equals/descends from the locally acknowledged
tip, and materializes each event at a deterministic append-only path
`events/<clientId>/<sequence>-<eventId>.ksx`. Existing identical blobs are
idempotent; any path change, gap, rewrite, signature mismatch, or non-fast-
forward quarantines the client branch. It stages a tree delta containing only
the verified `SyncBatchV1` and listed events, creates the ordinary Git commit,
and pushes only a
normal fast-forward with the expected old OID. No merge, rebase, force,
force-with-lease, conflict resolution, or remote cleanup exists.

After push, it independently fetches the advertised ref and requires the exact
commit/tree/blob OIDs and bytes. It then monotonically advances the independent
`SyncCheckpointV1` to this sequence/event/commit and appends a completion
receipt binding the pre-egress receipt, checkpoint receipt, remote OID, and
event set. Only then do queue entries become acked and the outbound watermark
advance atomically. If push or checkpoint succeeded but the response/readback
was lost, the next run fetches the exact commit and signed batch/event set, idempotently
finishes the checkpoint/completion receipt, and acks without pushing again.

## Inbound fetch, deterministic union, and activation

Inbound first reads the independent rollback anchor, every registered
`SyncCheckpointV1`, and current owner-approved client registry, then writes a
receipt for the exact remote/ref/OID inventory it
will request. It fetches only registered client refs into quarantine with strict
object count/size/depth limits, transfer fsck, no checkout filters/hooks, and no
object alternates. Each ref must contain its configured signed genesis record
and anchored checkpoint as an exact signed batch/event prefix and may extend it only by a strict fast-
forward with an unbroken signed client sequence/hash chain. Only the anchored
prefix can activate; a later suffix waits. Unknown clients and rewrites/deletion
of the required prefix are isolated. Expired/revoked clients retain only their
valid `ClientCutoffV1` prefix; a greater suffix is quarantined and ignored, not
used to discard the valid prefix. No affected ref causes another valid client
to be discarded or silently adopted.

Events from all valid refs form a deterministic append-only union ordered by
repository state epoch, with tombstone before source at the same epoch, then
client ID, sequence, and event ID bytes. Exact duplicate IDs union once. A
source-event conflict for the same deletion identity/revision but different
payload/original digest quarantines that lineage and records material conflict;
there is no automatic winner. Distinct lineages coexist. Temporal
`valid_at`/`invalid_at`, prior/successor links, and immutable provider revision
are preserved rather than flattened into current text.

Before any body is opened, the receiver reads/applies every newer anchor
tombstone and advances local deletion state through Slice 4. Lower-epoch or
missing-chain tombstone events cannot reduce anchor state. Source events then
open one body only under the Slice-1 shared policy/read lease after rechecking
anchor/state/tombstone epochs; the lease is held until plaintext validation is
finished and a sealed staging object exists or is purged. Deletion therefore
linearizes before the open or after staging, and the later activation recheck
rejects the latter. Source events then
pass client signature, event chain, key-provider identity/status, ciphertext
tag, Slice-1 locator/citation/digest, local repository capability, local
artifact/field/path/retention policy, source freshness, tombstone/deletion-
identity, and injection/secret checks. A sync signature proves transport
provenance only; it never replaces GitHub/Jira authority or grants local access.
First activation on a receiving host must authenticate to GitHub/Jira and
reverify the stable source identity, exact revision, allowed fields/path, and
original digest against Slice 3; provider outage leaves the event pending. Only
a matching live check activates the synced immutable snapshot and records a
separate local verification time; it never rewrites original `observedAt`.
Afterward, a snapshot activated locally before an outage may
later serve encrypted exact citation bytes with its original `observedAt` and
explicit stale/unavailable state under local `allowStale` policy.

The receiver stages a complete union generation against frozen remote commit
OIDs and records a content-free ingress manifest/receipt. Activation takes the
exclusive repository publication lease and rechecks local policy/grants,
client registry, remote/checkpoint fast-forward relation, anchor/tombstone/state/key
epochs, source-set digest, and all staged digests. It commits catalog bodies,
per-client inbound watermarks, event idempotency set, and the new Slice-2
generation in the existing atomic boundaries or commits none. A remote branch
that advances by fast-forward during staging may activate the verified prefix;
the next poll consumes its suffix. A non-fast-forward or anchor change aborts.

The Git commit is the transport activation boundary: uncommitted remote tree
state never exists, and only the exact verified commit prefix can activate
locally. It does not turn the sync remote into authority. Fetching the same
commits on Linux, macOS, Windows, Codex, or Claude hosts yields the same event
union, source-set digest, exact/BM25 generation, and citations when local policy
and provider state are equal.

## Automation, retry, and recovery

Sync performs a bounded drain at KStack skill/CLI start and end and on an
owner-configured scheduler. The main agent remains a control plane: workers own
the queue/network stages and report compact status or full owner questions;
they do not inject retrieved memory automatically into prompts. Start/end drains
may continue in their worker after reporting `IN_PROGRESS`, but only one local
coordinator per repoId may publish. Explicit `sync-now`, `dry-run`, `status`,
`doctor`, `retry-failed`, and `round-trip-smoke` use the same broker path.

Transient connect/408/429/5xx failures use the Slice-3 bounded full-jitter and
true 30-second Retry-After cap, at most three retries within the 10-minute run
deadline. Authentication is probed content-free first; after a short timeout
and those attempts, the queue remains preserved and sync reports a full owner
question rather than silently forcing success/failure or widening credentials.
400/401/403, identity/signature, branch rewrite, policy, anchor, scan, schema,
and digest failures do not retry as transient. A user may end a run immediately;
that cancels network work, restores claimed entries to `new`, and leaves local
memory unchanged.

The local coordinator uses host-native advisory locking plus a random lease ID,
process identity/start marker, and durable heartbeat. It never unlinks or steals
a lock based only on age. A bounded stale-candidate probe may recover only after
the OS proves the owner is gone and the durable run receipt shows no live
publication; otherwise it reports blocked. Windows uses the qualified native
lock/durable-replace adapter rather than POSIX inode assumptions.

Crash recovery starts by reading anchor/tombstone state, then enumerates intent/
egress/ingress/completion receipts, queue directories, isolated worktree refs,
Git commits, and staging manifests. It reauthorizes and re-hashes everything.
Unsent attempts return to `new`; remotely present exact batches complete by
readback; ambiguous remote state stays `cur/failed` and asks for reconciliation;
incomplete inbound generations purge. Queue/watermarks advance only with their
matching receipts and atomic commits. Recovery never force-pushes, guesses from
mtime, deletes evidence, or treats a remote branch as the local truth.

Setup and scheduled operation are idempotent. An existing exact remote/client/
key/anchor/policy binding is verified and reused; any mismatch stops with a
preview rather than replacing it. New remote creation, visibility changes,
credential enrollment, branch initialization, and destructive reconciliation
remain separate ask-tier actions. Health probes first validate existing setup,
use small timeouts/retries, and only then surface the complete authentication or
forced-fail question to the main control plane.

First enablement previews and reauthorizes the current active local source set,
then creates ordinary `source-activate` transactional-outbox events in bounded
sequence order plus every required anchor tombstone; it has no privileged
bootstrap format. Existing unsynced state is not silently omitted, and disabled
time does not let an old snapshot bypass current policy, retention, or deletion.

## Health, readiness, and operator contract

`SyncHealthV1` reports separate `localMemory`, `outbound`, `inbound`, and
`crossHost` states, each `ready`, `degraded`, `blocked`, `disabled`, or
`unconfigured`; one summary never masks a failing stage. It includes only keyed
remote/client IDs, configuration/policy/registry digests, key/anchor status and
epochs, last attempted/successful intent/egress/readback/ingress/activation
times, remote/inbound watermarks, queue depths/bytes by directory, oldest age,
retry/rate state, failed reason counts, tombstone lag, source/index freshness,
and current run/lock/recovery state. No URL credentials, source text, query,
path, issue data, raw identity, token, key handle, or payload digest is shown.

States use these independent, closed predicates with precedence in listed order:

| Component | `unconfigured` / `disabled` | `blocked` | `degraded` | `ready` |
|---|---|---|---|---|
| `localMemory` | `unconfigured` only before Slices 1-4 have an owner configuration; `disabled` only when local memory itself is explicitly disabled, never merely because sync is skipped. | Anchor/key/tombstone/policy/citation corruption or no valid generation prevents safe serving. | A valid prior generation can serve only labeled stale/unavailable records within policy, or a safe rebuild is pending. | Slices 1-4, anchor/key, active generation, citations, and eligible source freshness are current. |
| `outbound` | `unconfigured` means no completed sync decision/binding; `disabled` means explicit owner skip. | Identity/privacy/auth permanent failure, own-ref rewrite, checkpoint/receipt/signature/scan conflict, ambiguous recovery, over-hard-cap backlog, or unqualified adapter. | Only transient outage/rate/retry or backlog age/bytes within the hard cap but beyond the ready SLA; queue is preserved. | Current remote/client/policy/key/anchor/checkpoint proof, exact ref ancestry/readback, no failed item, and queue empty or within ready SLA. |
| `inbound` | Same sync-decision rules as outbound. | Anchor/checkpoint/genesis/cutoff/ref/signature/digest/scan conflict, unapplied tombstone, ambiguous recovery, or invalid generation. | Only transient remote outage/lag within hard bounds while the last anchored prefix and local state remain safe. | Every registered anchored prefix/cutoff and anchor tombstone is applied, the local generation is complete, and lag is within ready SLA. |
| `crossHost` | `unconfigured`/`disabled` exactly follow the sync owner decision, independent of localMemory. | Either sync direction is blocked, shared key/anchor/client/OS qualification fails, or event/source-set/citation vectors diverge. | Nothing is blocked, but localMemory or either sync direction is degraded. | localMemory, outbound, and inbound are all ready and cross-host qualification matches. |

Thus outbound/inbound/crossHost may be disabled while localMemory is ready. A
sync-only block does not erase safe local memory; an anchor/tombstone/key defect
is independently reflected as localMemory blocked. A summary may report the
four-tuple or worst sync state but cannot replace it with one optimistic label.

Cached health expires after 60 seconds and is invalidated by policy/client/
remote/key/anchor/tombstone/queue/run changes. `doctor` bypasses cache, validates
static network/write-surface inventory, storage/durability/lock adapters, queue
and receipt chains, Git ref ancestry, provider/anchor identity, scanners,
watermarks, generation/citation probes, and rollback manifest. It is read-only.

`round-trip-smoke` is an explicit `remote-sync` action. It enqueues one random,
schema-valid `transport-smoke` challenge under the dedicated keyed test scope, writes the egress
receipt, fast-forwards the client ref, readbacks through a fresh quarantine
fetch, validates signature/event/commit/receipt bytes, and records success. It
cannot enter catalog/search. Its random content-free remote event remains in
append-only history, while local queue/receipt material expires by policy;
ordinary operation never invokes smoke implicitly. Failure preserves evidence
and cannot be called ready.

## Cross-host key, deletion, and retention rules

A production/user-data client must reach the exact Slice-4 key-provider
namespace and independent rollback anchor; host-local copies of their state are
not substitutes. Client enrollment runs unwrap/status, anchor continuity,
tombstone replay, citation readback, frozen BM25, and OS storage/memory-
protection qualification before it may serve. A thin client without shared keys
may verify transport metadata but cannot decrypt, index, cite, or report memory
ready.

Local logical deletion never waits for sync. The anchor advances first, so every
connected host denies the lineage before it reads remote events. Outbound
tombstones receive queue priority; receivers apply anchor tombstones before
source union. The remote may retain historical ciphertext in Git, but Slice-4
destruction of every lineage/containing-generation key makes it unreadable;
KStack does not claim remote Git object removal or rewrite history. Tombstones
and client sequence history remain until every remote event, backup, host,
receipt, and key that could reference them has expired; unknown upper bound
means they do not expire.

Because a generic append-only Git remote cannot prove object garbage collection
or a repository-state publication fence, Slice-4 `purge-complete` is not claimed
while its historical ciphertext exists. Health reports logical deletion and
verified cryptographic erasure separately from `remote-ciphertext-retained`/
physical purge pending. A provider-specific, independently qualified remote
adapter may close physical purge only with strongly consistent history/object/
temporary-namespace zero inventory and stale-writer revocation; Git ref absence
alone is insufficient. Owner deletion of a remote is outside this slice and is
never inferred or performed automatically.

Remote compaction is not force push or ordinary deletion. It requires a
`CompactionAuthorityV1` signed by the owner and bound to old/new sync epochs,
exact old source-set/tombstone/client-cutoff digests, a one-operation compactor
client/key/ref, expiry, and expected new genesis. The compactor first applies
all anchor tombstones and revalidates every retained live source online against
GitHub/Jira plus local policy. If any live source or provenance chain cannot be
verified, compaction blocks rather than omitting or inventing it.

The compactor creates its own signed genesis and ordinary `source-activate`
events in the new epoch under its own client identity. Each encrypted payload
adds `CompactionProvenanceV1 = {oldSyncEpoch, originalClientId, originalEventId,
originalCommitOid, originalEventSignatureDigest}` while preserving the original
source record/authority receipts. It never signs as, extends the sequence of, or
rewrites an offline/expired/revoked producer; their valid cutoff prefixes remain
verifiable historical provenance. Full required tombstones/cutoffs become the
new epoch checkpoint before any source event can activate.

All still-active producer clients and the independent anchor must register and
acknowledge the new epoch/checkpoint before it can serve. Old refs are sealed
read-only and retained through their declared bound; KStack never deletes them
automatically. If the remote cannot enforce/seal/retain that transition, or an
active client cannot acknowledge, compaction is unavailable and doctor reports
growth rather than rewriting history.

Cross-host source state is non-authoritative and policy-intersected. A host may
have a narrower artifact/field/path/grant/retention scope and therefore activate
a strict subset. It may never widen to match another client. Client revocation
uses `ClientCutoffV1` and blocks every greater sequence regardless of event
timestamp; expiry uses its independently sealed cutoff. Already admitted records remain
subject to authority, local policy, supersession, retention, and tombstones,
not trusted merely because an old signature verifies.

## Acceptance fixtures

1. Frozen adapted-pattern inventory maps each gstack-derived queue/receipt/
   boundary/health mechanism to the exact MIT ledger object and attribution;
   source mismatch or missing notice blocks reuse.
2. Remote canonicalization covers HTTPS/SSH aliases, credentials/query/fragment,
   redirects, DNS rebinding, mixed CIDRs, host-key mismatch, repo rename/
   transfer, environment proxy/helper/config injection, ext/file transports,
   hooks/filters/submodules/alternates, exact upload/receive-pack surfaces, and
   confined metadata GET/HEAD versus invalid/expired/self-hosted attestations.
3. Multi-worktree/multi-branch producers share one repoId/client sequence/spool
   without touching user checkouts. Concurrent queue create/claim/retry/ack and
   crash schedules lose or duplicate no event on Linux/macOS/Windows. Frozen
   vectors prove eventId excludes eventId/signature, signature covers the
   completed ID, event one roots at genesis, and later events hash the full prior.
4. Egress receipt failure sends nothing. Push success plus lost response is
   recovered by exact readback/checkpoint advance without a second commit.
   Auth/rate/outage retries preserve queue and obey attempt/deadline/Retry-After
   boundaries.
5. Two or more client refs concurrently append distinct events and produce the
   same deterministic union/order/digest on every host. Same-revision divergent
   bytes quarantine only the lineage; no merge/rebase/model winner exists.
6. Ref deletion/rewrite, sequence gap, duplicate sequence, previous-digest
   break, unknown client, bad signature, modified path/blob/commit, and non-
   fast-forward push/fetch block the affected ref. Revoked/expired cutoff vectors
   retain the exact anchored prefix, reject only greater sequences, and block a
   missing cutoff. A new/stale-backup host checks genesis/checkpoint; remote
   rollback and unanchored suffix cannot report ready or activate.
7. Inbound crash schedules at fetch/verify/scan/stage/lease/anchor/generation/
   activation steps expose the prior complete state or one complete successor;
   remote prefixes may activate only when fast-forward and anchor-current.
8. Tombstone races place anchor advance before every body open/activation.
   Lower-epoch, delayed, omitted, or replayed source events and stale backups
   cannot resurrect; remote ciphertext remains undecryptable after key destroy.
9. Local policy/grant/client/key/anchor/source freshness matrices prove a valid
   transport signature cannot authorize or establish truth. First host
   activation blocks while authority is offline; a previously locally approved
   snapshot keeps exact citation bytes, observedAt, and stale/unavailable labels.
10. Secret/injection scanner finding, crash, timeout, and redaction fixtures
    preserve the queue/failed item, send no payload, leak no snippet, and cannot
    alter remote, ref, policy, capability, Git arguments, or receipts.
11. Queue and run caps, backlog SLA, scheduling, start/end background drains,
    user cancellation, lock contention, verified stale-owner recovery, and full
    owner-question relay produce exact health transitions without silent fail.
12. Doctor corruption vectors cover every queue directory, receipt chain,
    remote watermark/ref, registry, signature, anchor/key epoch, generation,
    storage adapter, and cache invalidation. The four independent health truth
    tables hit every state/boundary; localMemory remains ready with sync disabled.
13. Round-trip smoke writes only schema-valid `transport-smoke` with no payload,
    source, or tombstone; readbacks from a fresh quarantine fetch, never enters retrieval, and fails closed on
    any receipt/readback mismatch.
14. Cross-host qualification on Linux/macOS/Windows and Codex/Claude hosts
    reproduces raw Git blob/tree/commit OIDs for each frozen object format, mode,
    path, author/time/message vector plus event/source-set/index/citations, or
    accurately denies an unqualified Git/dump/durability/key/anchor environment.
15. Compaction uses only the owner-bound one-operation compactor identity,
    revalidates all live sources, emits its own events with preserved original
    provenance, never impersonates expired/revoked clients, carries tombstones/
    cutoffs, and waits for active-client/anchor acknowledgement. It never force-
    pushes/deletes old refs; an unverifiable source blocks the new epoch.
16. Static schema/source/network inventory rejects automatic prompt injection,
    missing-policy writes, GitHub/Jira source mutation, model/embedding/vector/
    semantic/reranking/expansion/Ollama paths, and remote content as authority.
17. Rollback removes only local signing-key references/session handles. Without
    the separate owner provider-retirement ticket it reports retirement pending
    and proves ordinary runtime cannot destroy the provider-held client key.

## Delivery and rollback

This slice delivers only the remote/client/event schemas, queue/receipt/
coordinator contracts, Git transport seam, health/doctor/smoke behavior, and
cross-host fixtures behind a disabled flag. Implementation must first re-pin
and attribute adapted upstream bytes. Enabling a remote, writing its genesis
ref, running smoke, or enrolling credentials/clients requires the corresponding
owner-approved `remote-sync` action; this design review performs none.

Rollback takes the exclusive publication lease, disables schedules and new
queue production, advances adapter fences, cancels/drains workers, and records
the terminal local sync generation. It seals `ClientCutoffV1` at the last
anchored checkpoint before removing local key access; failure keeps rollback
incomplete, but any unanchored suffix remains ineligible. It purges local queue payloads, isolated
worktrees/object stores, cursors, watermarks, cached signing-key references/
session handles, transient
credentials, sync-derived catalogs/indexes/caches, and run/generation keys under
Slices 1/4. Client signing keys are destroyed only through a separate owner-
approved provider retirement ticket bound to the disabled client/registry
generation. Without that ticket the provider key remains disabled but intact,
and the rollback manifest reports `retirement-pending`; ordinary runtime cannot
destroy it. Append-only intent/egress/ingress/completion/failure/deletion
receipts and tombstones remain only for required retention and cannot authorize
or serve. A disposition manifest binds expected/actual counts and key outcomes;
any mismatch keeps sync disabled and rollback incomplete.

Rollback does not push, delete refs, rewrite the transport repository, alter
GitHub/Jira, or delete existing explicit KStack memory. Remote ciphertext stays
governed by destroyed keys and tombstones. Re-enable requires a new broker
instance/client ID/signing key/ref and explicit owner binding; old queue,
watermarks, client credentials, grants, or remote events cannot seed it except
through the full anchor-first inbound validation path.

## Codex closeout rule

Approve only at confidence 93+ with zero failed checks, security findings,
material dissent, or unresolved questions. At 84-92 fix only concrete Slice-5
defects; accepted Slices 1-4 and the absolute no-model/no-Ollama boundary stay
fixed.
