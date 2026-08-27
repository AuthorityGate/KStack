# Domain breadth D5-F2 - atomic catalog and compatibility activation

**Parent item:** D5  
**Preserved D5-F1 digest:**
`7ea2e55c349a8d1bc0259e57fea3d2c347347a2530633e49c7624614dbb4dd74`  
**Scope:** atomic activation only; no schema/digest redesign  
**Owner decision:** Q1 = catalog activation requires authenticated
out-of-band principal/attestation; weakening and waivers require an independent
second party  
**Route:** Codex-only, supplied-packet-only review; no Opus

## Authority and state location

The authoritative current catalog is not a repository file. It is one
broker-protected ledger row keyed by `(projectId, repositoryImmutableId)`.
Ordinary repository collaborators, pack bytes, provider output, Jira/web text,
and local agents cannot write it. A repository pointer/cache is display-only;
ledger unavailability is `PACK_ACTIVATION_LEDGER_UNAVAILABLE`, never permission
to trust that cache.

The initial row points at a reviewed generation-0 v1 snapshot containing the
four `roadmap-only` entries. Thus activation has no unguarded null/bootstrap
case. Every later D5-F1 `PackSnapshotV1` contains catalog and compatibility
entries together in one immutable canonical object addressed by one snapshot
digest. No separate compatibility pointer or mutable entry exists.

The broker-internal `CurrentPackPointerRecordV1` is a ledger storage record, not
a pack interchange artifact and not a member of D5-F1's schema registry. Its
signed read projection has exactly:

```text
{
  recordVersion: 1,
  projectId, repositoryImmutableId, contractVersion: 1,
  generation, snapshotDigest, predecessorPointerDigest,
  activationRequestDigest, commitTransactionId, committedAt
}
```

Its digest uses `KSTACK-CURRENT-PACK-POINTER-RECORD-V1\n`. It is never accepted
as a bare signed historical object. Every reader generates a fresh unpredictable
32-byte nonce, used once for one operation, and requests a live guarded proof
from the authenticated broker. Inside a serializable read at the ledger's
current revision, the broker reads the current row and returns internal protocol
object `CurrentPackHeadProofV1` with exactly:

```text
{
  proofVersion: 1, projectId, repositoryImmutableId,
  pointerRecordDigest, generation, snapshotDigest,
  ledgerEpoch, ledgerRevision, checkpointDigest,
  readerNonce, trustedTimeReceiptDigest, issuedAt, expiresAt,
  brokerKeyId
}
```

The append-only broker checkpoint chain binds epoch, monotonically increasing
revision, current pointer-record digest, prior checkpoint digest, and committed
transaction. Broker recovery may advance epoch only through an externally
attested recovery checkpoint that preserves the prior high-water; rollback or
unprovable continuity makes reads unavailable. The broker stores the last
issued revision per project and never signs a lower one.

Proof digest uses `KSTACK-CURRENT-PACK-HEAD-PROOF-V1\n` and is signed by the
registered qualified broker key only after the live read. Its digest-bound
policy caps validity at 30 seconds. A reader requires its exact nonce, D8 trusted
time inside `[issuedAt, expiresAt]`, current key/epoch/checkpoint-chain validity,
and revision not below its broker-protected prior high-water, then consumes the
nonce locally. It fetches snapshot bytes by the proof's exact digest and verifies
them. Nonce reuse, unsolicited proof, expiry, future time, revision/epoch
rollback, missing continuity, revoked key, or mismatch fails closed. A captured
old proof cannot answer a new nonce.

## Prepare without activation

Preparation is side-effect-free with respect to the current pointer:

1. Open one D5-F1 operation inventory and validate the entire candidate
   snapshot/material/schema/provenance/review/approval/compatibility graph.
2. Obtain a fresh challenge-bound current-head proof plus its exact snapshot.
   Candidate
   `predecessorSnapshotDigest` must equal current `snapshotDigest`; candidate
   generation must equal current generation plus one without overflow; contract
   and registry/policy digests must remain v1-compatible.
3. Require an exact structural diff. V1 changes exactly one catalog pack entry
   and its corresponding compatibility entry set. Any unrelated field, second
   pack, shared contract/schema/kernel/base-lane change, or fifth ID is
   `PACK_ACTIVATION_DIFF_INVALID` and needs another separately reviewed path.
4. Classify the transition under D3's closed weakening classifier. Unknown
   equivalence is weakening. `downgrade`, required-pack disable/removal,
   quarantine reversal, or any policy/control weakening requires D3
   authorization. Quarantine, ordinary first activation, compatible upgrade,
   and optional disable still require D1 catalog-activation identity but do not
   gain a two-party waiver unless D3 classifies the exact diff as weakening.
5. Write the candidate snapshot and every exact subordinate immutable object to
   a staging namespace in the broker content store. Verify byte/digest identity,
   complete graph availability, read-after-write, store durability capability,
   and retention pin. Staging does not make the candidate current or selectable.

A prepared candidate may be abandoned or garbage-collected after its retention
lease. It has no activation semantics.

## Exact activation request and authority

Closed `PackActivationRequestV1` binds:

```text
{
  artifactType: "kstack-pack-activation-request", schemaVersion: 1,
  projectId, repositoryImmutableId,
  fromSnapshotDigest, fromGeneration,
  toSnapshotDigest, toGeneration,
  changedPackIds: [one exact packId], transitionKind,
  schemaRegistryDigest, compatibilityReviewDigest,
  d1ActivationAttestationDigest,
  d3WeakeningAuthorizationDigest: digest | null,
  requestNonce, notBefore, expiresAt
}
```

To avoid an attestation cycle, `activationBodyDigest` is
`SHA256(UTF8("KSTACK-PACK-ACTIVATION-BODY-V1\n") || canonicalV1(the exact
request projection excluding both authorization-digest fields))`. D1's
authenticated out-of-band action request has action `catalog-activation`,
target digest equal to that body digest, and matching project/repository/policy/
current-head bindings. The final closed request adds the resulting D1 digest
and, when required, D3 digest; its request digest is
`SHA256(UTF8("KSTACK-PACK-ACTIVATION-REQUEST-V1\n") || canonicalV1(request))`.
No attestation changes the body projection. D3 authorization binds its preserved
`WeakeningRequestV1`, whose before/after digests and repository/policy fields
must equal this activation body's transition. Its digest is required iff the
closed classifier says so.

The request has no branch/tag/path/latest reference, embedded bytes, generic
actor, self-declared key, provider/model approval, or repository-local
authorization. D8 trusted time must place all authority evidence in the
intersection of validity intervals.

## Sole activation commit

`PackActivationCoordinatorV1` is a narrow broker operation. It cannot author or
modify snapshots, policies, compatibility, reviews, approvals, or pack bytes.
It receives the final request plus the same closed inventory used for prepare.
Inside one serializable durable ledger transaction keyed by immutable
project/repository it:

1. Locks and directly rereads the current pointer row inside the write
   transaction, without trusting any supplied proof. It requires generation and
   snapshot digest to equal the request's `from*` fields; the D1 current-head
   evidence must additionally name the reread pointer-record digest.
2. Reruns the pinned D5-F1 graph validator over staged exact bytes and requires
   the candidate predecessor/generation/diff/classification to reproduce.
   It rechecks that every content-addressed object is immutable, complete,
   durable, retention-pinned, and readable by digest.
3. Revalidates D1 identity/provider evidence, adapter/key status, action/body
   digest, project/repository/head/policy bindings, nonce, and D8 interval
   against guarded current external state. When classification is weakening it
   also revalidates the complete D3 two-person/two-group authorization and both
   nonces. Unexpected D3 authorization does not relax any check.
4. Requires `toGeneration = fromGeneration + 1`, a new request nonce, and no
   prior transaction/request/body digest with a different candidate. It checks
   the broker ledger's monotone generation and quarantine/tombstone history;
   repository counters cannot influence this state.
5. Atomically inserts the immutable activation receipt, consumes all D1/D3 and
   request nonces, converts the candidate retention pin from staged to
   historical-active, and compare-and-swaps the one current pointer row to the
   candidate snapshot/generation. A uniqueness constraint covers project/
   repository/generation, request digest, transaction ID, and every nonce.

These ledger writes commit together or not at all. A backend unable to transact
them reports `PACK_ACTIVATION_ATOMICITY_CAPABILITY_UNMET`; separate writes,
filesystem rename approximations, best-effort compensation, and success before
durable commit are prohibited. The content-addressed objects are safely written
before the pointer transaction and are unreachable as current state until that
single commit.

The preserved closed `PackActivationReceiptV1` contains exactly request digest,
old/new snapshot digests and generations, D1 and optional D3 authorization
digests, commit transaction ID, committed time, and prior/current pointer-record
digests. Request and authorization objects carry the transition, graph head,
and nonce bindings. The broker signs the receipt and pointer projection. It has
no deploy/Jira/GitHub/provider result and grants no tool/workflow authority.

Crash before commit leaves the prior pointer and all nonces active; staging can
be retried or collected. Crash after commit recovers the exact signed receipt
by transaction ID. An exact retry returns that receipt only when request,
candidate graph, and authority digests all match; any mismatch is
`PACK_ACTIVATION_TRANSACTION_CONFLICT`. A stale contender receives
`PACK_ACTIVATION_STALE` and must prepare a new snapshot/request/attestation
against the new head; prior approval is not carried forward.

## Read, concurrency, rollback, and history

A selection/composition operation obtains one signed guarded pointer projection
by a fresh `CurrentPackHeadProofV1` challenge and an immutable snapshot handle.
It records proof, pointer, snapshot, generation, epoch, and revision
digests and never rereads catalog or compatibility entry-by-entry. Concurrent
activation therefore yields either the complete old snapshot or complete new
snapshot. D2's selection guard detects a later head and returns
`PACK_SELECTION_STALE` by obtaining a second fresh-nonce proof immediately
before composition/dispatch admission and requiring pointer, generation,
snapshot, epoch, and a nondecreasing revision to match. Expired/unprovable head
state blocks; it never mixes states or silently re-resolves.

Rollback does not decrement or rewrite history. It prepares a new generation
whose pack material equals a previously retained compatible snapshot entry,
then performs the same commit with D3 downgrade authorization. Quarantine is a
new generation changing the one pack to `quarantined`; reversal is another new
generation requiring D3. Disable changes the entry to `roadmap-only` while
retaining prior snapshot/material pins for historical interpretation. Physical
uninstall is a subsequent separately authorized retention operation over
already-inactive bytes; its D5-F1 tombstone belongs to that removal ledger and
cannot change the current pointer. It is not part of this activation transaction.
No rollback, disable, quarantine, or later uninstall changes another pack, the four-ID enum, the
Governance Kernel, or base lanes.

## Closed failures

Closed failures include `PACK_ACTIVATION_LEDGER_UNAVAILABLE`,
`PACK_ACTIVATION_GRAPH_INVALID`, `PACK_ACTIVATION_DIFF_INVALID`,
`PACK_ACTIVATION_AUTH_INVALID`, `PACK_ACTIVATION_WEAKENING_AUTH_REQUIRED`,
`PACK_ACTIVATION_STAGING_NOT_DURABLE`, `PACK_ACTIVATION_STALE`,
`PACK_ACTIVATION_REPLAYED`, `PACK_ACTIVATION_TRANSACTION_CONFLICT`, and
`PACK_ACTIVATION_ATOMICITY_CAPABILITY_UNMET`. None changes the pointer or emits
a success receipt. Diagnostics and display caches are non-authoritative and
secret-redacted.

## Deterministic verification

- Golden vectors bind genesis, prepare, activation body/request, pointer
  records, receipt, exact diff/classification, and every digest/signature.
- Mutate each pointer/snapshot/generation/predecessor/graph/diff/pack/contract/
  authority/time/nonce/head/policy binding; reject before commit.
- Replay a valid old proof, substitute a new/used nonce, expire it, roll back
  epoch/revision/checkpoint, fork checkpoint continuity, or change pointer after
  selection; reject or return stale before dispatch.
- Race two valid candidates from the same generation; exactly one commits and
  the other is stale with no consumed nonce or receipt.
- Crash/fault-inject before and after every staged-store and ledger operation;
  observe either the complete old pointer or complete new pointer, never mixed
  catalog/compatibility or partial nonce/receipt state.
- Test backend without cross-row transactions or durable content pins; report
  capability unmet and preserve current state.
- Attempt repo-file pointer forgery, direct generation rewrite, stale D1/D3
  evidence, one-party weakening, ordinary-path downgrade, quarantine reversal,
  staged-object substitution/deletion, fifth ID, two-pack diff, and replay in
  another repository; reject.
- Activate, upgrade, quarantine, reverse with D3, disable, and rollback. Verify
  monotone generations, per-pack isolation, stale-selection behavior, exact
  historical replay, and no external side effect; verify a later uninstall
  cannot mutate the pointer or erase retained metadata required by policy.

## Review request

Review only whether D5-F2 makes combined catalog/compatibility activation one
authenticated, broker-protected, crash-safe pointer CAS while preserving D1,
D2, D3, D5-F1, and D8. Report current defects only. Closure requires confidence
>=93 with zero failed checks, security findings, material dissent, and
unresolved questions.
