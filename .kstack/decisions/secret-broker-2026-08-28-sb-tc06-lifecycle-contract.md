# KStack Secret Broker — SB-TC06 lifecycle contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC06` — creation, input, rotation, revocation, expiry, version overlap, deletion, recovery, provider mutation, and ambiguity reconciliation |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC04 `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925`; SB-TC05 `57f18fcbb172327ef85ea3e56be8fa29f7e40be233b8c884223fc793158e1d3d` |

## 1. Decision requested

Freeze the provider-neutral lifecycle state and mutation boundary for stored
secrets and provider-issued dynamic credentials. The design must keep a handle
and its generations current across creation, replacement, target rotation,
overlap, expiry, revocation, soft deletion, recovery, and destruction without
returning values to the model, resurrecting an old generation, or retrying an
ambiguous provider/target effect.

ECR-TC06A/TC06B are reusable evidence for monotonic currentness, predecessor
binding, and closed transitions. They are not imported as storage architecture,
cryptographic envelope format, or authority. Selected providers remain the
SB-TC01 `os-local-v1` development family and `openbao-v1` production family.

## 2. Non-compensating rules

1. Lifecycle mutation is a separate authority plane. It cannot be smuggled
   through SB-TC04's five resolve/diagnostic operations or SB-TC05
   `ExecuteRegistered`.
2. Every operation has one typed subject, one current lifecycle revision, one
   handle and generation relation, one backend/target/adapter cell, one
   approval/service authority, one one-use mutation lease, and one attempt.
3. Lifecycle input and provider-generated values cross only through a no-echo
   provider UI or a protected SB-TC05 lifecycle sink. They never enter chat,
   ordinary tool input/output, argv, environment, repository files, clipboard,
   Jira, logs, review packets, receipts, or safe metadata.
4. A handle ID is never reused. Its generations are strictly increasing,
   immutable once admitted, and never decremented, relabeled, or resurrected.
5. Missing, stale, ambiguous, unsupported, or unqualified provider capability
   denies. A local flag never simulates provider revocation, recovery,
   destruction, versioning, or erasure.
6. Lifecycle-attempt reservation first fences new KStack use under the current
   metadata revision and revalidated non-rollback authority epoch. External
   revocation remains separately unconfirmed until the target/provider effect
   is reconciled.
7. Expiry is exclusive and fail-closed. At or after trusted expiry, no new
   prepare, lease, resolve, overlap extension, renewal, or recovery may use that
   issued instance/generation.
8. A destructive step never precedes proof that the replacement path is
   active when continuity is intended. Failed pre-cutover rotation abandons the
   staged generation and leaves the old current generation unchanged.
9. After cutover there is no automatic rollback to an old generation. A
   retired, expired, revoked, destroyed, or superseded generation cannot become
   current again; remediation creates a fresh generation.
10. Any lost or uncertain mutation acknowledgement burns the attempt, blocks
    conflicting lifecycle work, and enters read-only reconciliation. It never
    triggers an automatic retry, even when a provider advertises idempotency.
11. Provider deletion is not an erasure claim about replicas, snapshots,
    backups, target copies, logs, or hardware. KStack reports only the exact
    qualified provider semantic and retains a non-secret tombstone.
12. Source-file retirement and migration are SB-TC09. This item never deletes a
    legacy source merely because a destination generation was written.

## 3. Closed lifecycle objects

### Handle lifecycle

```text
handle-lifecycle-v1 = {
  schemaVersion: "kstack-secret-handle-lifecycle-v1",
  handleId: handle-id-v1,
  authorityEpoch: generation-v1,
  lifecycleRevision: generation-v1,
  backendInstanceRef: opaque-ref-v1,
  credentialClass: "stored" | "dynamic-template",
  handleState: "PROVISIONING" | "ACTIVE" | "SUSPENDED" |
               "REVOKED" | "SOFT_DELETED" | "DESTROYED" |
               "AMBIGUOUS" | "QUARANTINED",
  currentGeneration: generation-v1 | "none",
  predecessorGeneration: generation-v1 | "none",
  overlapDeadline: trusted-instant-v1 | "none",
  lastTransitionRef: opaque-ref-v1,
  tombstoneRef: opaque-ref-v1 | "none"
}
```

`ACTIVE` requires exactly one current generation. `PROVISIONING`, `REVOKED`,
`SOFT_DELETED`, `DESTROYED`, `AMBIGUOUS`, and `QUARANTINED` issue no ordinary
SB-TC03 lease. `SUSPENDED` retains custody but denies use. A predecessor may be
present only during an admitted overlap; KStack resolves only the new current
generation. It never falls back to the predecessor.

`lifecycleRevision` is the exact SB-TC02 `handle-binding-v1.metadataRevision`;
there are not two mutable counters. Every admitted lifecycle transition changes
the complete handle binding and increments that revision by exactly one. The
global SB-TC03 `authorityEpoch` normally remains unchanged; it advances only
under its separately qualified non-rollback/restore rules or an exact policy
profile that deliberately fences the whole broker. Handle-specific suspension,
revocation, cutover, deletion, and ambiguity fence old prepares/leases through
the metadata revision, generation/state checks, and durable attempt state.
Lifecycle capability/readiness evidence is a short-lived current pre-contact
prerequisite under SB-TC04, not a field in the durable handle binding.

### Stored generation

```text
stored-generation-v1 = {
  schemaVersion: "kstack-secret-stored-generation-v1",
  handleId: handle-id-v1,
  generation: generation-v1,
  predecessorGeneration: generation-v1 | "none",
  backendInstanceRef: opaque-ref-v1,
  backendObjectRef: opaque-ref-v1,
  backendVersionRef: opaque-ref-v1,
  targetRef: opaque-ref-v1,
  adapterCellRef: opaque-ref-v1,
  state: "STAGED" | "CURRENT" | "OVERLAP_PREDECESSOR" |
         "RETIRED" | "EXPIRED" | "REVOKED" | "SOFT_DELETED" |
         "DESTROYED" | "ABANDONED" | "AMBIGUOUS",
  createdAt: trusted-instant-v1,
  notBefore: trusted-instant-v1,
  expiresAt: trusted-instant-v1 | "none",
  sourceClass: "noecho-user" | "target-generated" |
               "provider-generated" | "migration-staged",
  admissionReceiptRef: opaque-ref-v1
}
```

The record contains no locator, value length, digest of the value, or
credential-equivalent proof. `backendObjectRef` and `backendVersionRef` are
protected provider metadata, not model-visible. The backend binding owns the
actual locator.

Only these generation transitions exist:

```text
STAGED -> CURRENT | ABANDONED | AMBIGUOUS
CURRENT -> OVERLAP_PREDECESSOR | RETIRED | EXPIRED | REVOKED |
           SOFT_DELETED | AMBIGUOUS
OVERLAP_PREDECESSOR -> RETIRED | EXPIRED | REVOKED | AMBIGUOUS
SOFT_DELETED -> CURRENT | DESTROYED | AMBIGUOUS
EXPIRED -> DESTROYED | AMBIGUOUS
RETIRED -> DESTROYED | AMBIGUOUS
REVOKED -> DESTROYED | AMBIGUOUS
ABANDONED -> DESTROYED | AMBIGUOUS
AMBIGUOUS -> one reconciled exact state above | QUARANTINED
```

Recovery from `SOFT_DELETED` keeps the same generation; it is not rotation and
does not erase the deletion history. It requires provider proof that the exact
version is recoverable and a successor lifecycle revision with the frozen
global-epoch relation. Recovery is forbidden if revocation, exposure, expiry,
destruction, retention expiry,
or policy prohibits use. `DESTROYED` is terminal.

### Dynamic issued instance

A `dynamic-template` generation binds a provider role/configuration, not every
credential issued from it. Each SB-TC03 attempt gets an internal record:

```text
dynamic-issued-instance-v1 = {
  schemaVersion: "kstack-secret-dynamic-issued-instance-v1",
  handleId: handle-id-v1,
  templateGeneration: generation-v1,
  attemptId: opaque-ref-v1,
  backendInstanceRef: opaque-ref-v1,
  providerLeaseRef: opaque-ref-v1,
  issuedInstanceRevision: generation-v1,
  state: "ISSUED" | "IN_USE" | "EXPIRED" | "REVOKED" | "AMBIGUOUS",
  issuedAt: trusted-instant-v1,
  expiresAt: trusted-instant-v1,
  renewable: true | false,
  maximumExpiresAt: trusted-instant-v1,
  remainingOperationUses: 1
}
```

The provider lease ref is protected and never acts as a public bearer. Issued
instances do not increment the handle generation. They cannot be cached,
pooled, transferred, or reused by another attempt. Provider-returned TTL and
renewability are authoritative within the registered hard maximum.

Issued-instance renewal, expiry, and revocation CAS only this attempt-local
record and increment `issuedInstanceRevision`; they never change the handle's
metadata/lifecycle revision or template generation. They remain bound to the
original SB-TC03 attempt, template generation, provider lease, and deadline.

## 4. Separate lifecycle adapter surface

SB-TC06 adds a distinct internal protocol with exactly thirteen operations:

1. `CreateGeneration` — write one new static value or register one dynamic
   template under a previously reserved handle/generation.
2. `ReadLifecycleMetadata` — return only closed provider version/state/lease
   facts; never a value.
3. `ValidateStagedGeneration` — cross the staged value through one registered
   SB-TC05 validation sink; it cannot perform the requested business effect.
4. `ActivateGeneration` — atomically update KStack currentness after required
   provider/target evidence; it performs no provider value read.
5. `SuspendHandle` — fence new KStack use without claiming provider revocation.
6. `ResumeHandle` — reactivate the exact same admissible generation after all
   recovery/currentness checks; it performs no value read.
7. `MutateTargetCredential` — perform one registry-fixed target creation or
   replacement transition for `ROTATE_TARGET`; it is not a generic target API.
8. `RevokeGeneration` — call one exact provider/target revoke operation for one
   generation or issued instance.
9. `SoftDeleteGeneration` — invoke one exact recoverable provider deletion.
10. `DestroyGeneration` — invoke one exact irreversible provider operation as
   the provider defines it.
11. `RecoverSoftDelete` — invoke the exact provider recovery operation for one
   recoverable generation and no other version.
12. `RenewIssuedInstance` — renew one exact nonexpired issued lease within its
    original hard maximum and attempt deadline.
13. `ReconcileLifecycleAttempt` — read only exact provider/target metadata for
   one burned attempt and classify its effect.

Unknown operations and fields reject. There is no generic put, update, delete,
destroy, undelete, renew, revoke-prefix, force-revoke, list, search, request,
path, command, value return, or provider passthrough. `RecoverSoftDelete` and
dynamic `RenewIssuedInstance` are explicit closed operations executed through
the same mutation state machine; they are not aliases for generic provider
update/undelete/renew. Each immutable adapter cell fixes its exact provider API
operation, version/state preconditions, limits, and proof schema.

The lifecycle adapter cannot accept a caller-supplied locator, version, TTL,
target, idempotency key, recovery choice, deletion mode, or provider options.
It resolves all such choices from the approved transition subject and registry.

## 5. Mutation authority and preview

Every lifecycle change first freezes:

```text
lifecycle-transition-subject-v1 = {
  schemaVersion: "kstack-secret-lifecycle-transition-subject-v1",
  transitionKind: "CREATE" | "REPLACE_MATERIAL" | "ROTATE_TARGET" |
                  "ROTATE_TEMPLATE" | "SUSPEND" | "RESUME" |
                  "REVOKE" | "REVOKE_PREDECESSOR" |
                  "SOFT_DELETE" | "RECOVER_SOFT_DELETE" | "DESTROY",
  expectedAuthorityEpoch: generation-v1,
  successorAuthorityEpoch: generation-v1,
  expectedLifecycleRevision: generation-v1,
  successorLifecycleRevision: generation-v1,
  handleId: handle-id-v1,
  expectedHandleState: closed handle-state enum,
  expectedCurrentGeneration: generation-v1 | "none",
  affectedGeneration: generation-v1 | "none",
  proposedGeneration: generation-v1 | "same",
  backendInstanceRef: opaque-ref-v1,
  lifecycleAdapterCellRef: opaque-ref-v1,
  targetRef: opaque-ref-v1,
  rotationProfileId: registry-id-v1 | "not-applicable",
  inputSourceRef: opaque-ref-v1 | "not-applicable",
  overlapDeadline: trusted-instant-v1 | "none",
  retentionClass: registry-id-v1,
  consequenceClass: registry-id-v1,
  reconciliationProfileRef: opaque-ref-v1,
  operationInputDigest: digest-v1,
  previewDigest: digest-v1
}
```

The subject never includes value bytes or a value-derived digest.
`inputSourceRef` names a one-use protected no-echo/provider callback and is not
model-visible. The generation relation is `1` for create, current-plus-one for
replacement/rotation, `same` for state-only transitions, and never caller-
chosen.

`affectedGeneration` is `none` only for initial create/dynamic-template setup.
It byte-equals the current generation for ordinary state/mutation work, the
unique recorded predecessor for `REVOKE_PREDECESSOR`, or the exact generation
named by a previously committed `destruction-obligation-v1` for `DESTROY`. A
caller cannot select it, and no scan-selected historical/retired generation
substitutes.

`successorLifecycleRevision` must equal expected-plus-one without overflow.
`successorAuthorityEpoch` must equal `expectedAuthorityEpoch` for ordinary
lifecycle work. A transition may bind expected-plus-one only when a separately
qualified global-fence profile and SB-TC03 non-rollback authority have already
reserved that exact advance; no lifecycle adapter invents or conditionally
chooses it. Both relations are byte-bound in the attempt.

SB-TC03 identity, policy, complete safe-preview, approval, one-use lease,
non-rollback epoch, trusted-time, durable consumption, and anti-replay rules are
reused with a distinct lifecycle policy/lease schema and operation registry.
Ordinary execution approval cannot authorize lifecycle. Create, recovery,
resume, overlap extension, and destruction require exact human approval unless
an owner-approved service profile explicitly permits the one typed operation.
Production destruction requires independent approval. Emergency revocation may
use a preauthorized service path, but it remains exact-scope, one-use, audited,
and cannot imply successful external revocation.

The trusted preview renders safe operation, target, environment, credential
purpose, current generation/state, proposed relation, overlap deadline,
provider deletion/recovery semantic, retention consequence, external effect,
rollback unavailability, ambiguity consequence, and approval class. It never
shows provider locators, tenant/account identifiers, lease IDs, value lengths,
or provider text.

## 6. Durable mutation attempt and ambiguity

Before any provider or target contact, the broker atomically reserves the exact
subject and consumes its lifecycle lease:

```text
lifecycle-attempt-v1 = {
  schemaVersion: "kstack-secret-lifecycle-attempt-v1",
  attemptId: opaque-ref-v1,
  subjectDigest: digest-v1,
  expectedAuthorityEpoch: generation-v1,
  successorAuthorityEpoch: generation-v1,
  expectedLifecycleRevision: generation-v1,
  successorLifecycleRevision: generation-v1,
  providerMutationNonce: opaque-ref-v1,
  state: "RESERVED" | "EFFECT_STARTED" | "PROVIDER_OBSERVED" |
         "TARGET_OBSERVED" | "COMMIT_READY" | "COMMITTED" |
         "SUCCEEDED" | "DENIED" | "FAILED" | "AMBIGUOUS" |
         "QUARANTINED",
  monotonicDeadline: trusted-deadline-v1,
  reconciliationProfileRef: opaque-ref-v1
}
```

`providerMutationNonce` is random non-secret attempt metadata used only where
the exact provider supports an idempotency/CAS primitive. It never authorizes a
repost. The broker durably enters `EFFECT_STARTED` immediately before the first
provider/target request. State only advances by compare-and-swap; concurrent
attempts for the same handle, backend object, target credential slot, or issued
instance conflict and one wins.

`SUCCEEDED`, `DENIED`, and `FAILED` are terminal. `AMBIGUOUS` and
`QUARANTINED` are durable nonterminal restriction states: they retain the use
fence until the exact read-only reconciliation or later incident authority
closes them. Restart, deadline expiry, or a healthy probe does not release them.

At reservation, the current handle binding and global epoch must byte-equal the
expected values. The durable `RESERVED` attempt itself is the immediate use
fence: SB-TC03 preparation, lease issue, and pre-contact checks deny while a
nonterminal lifecycle attempt covers the handle, target credential slot,
backend object, generation, or issued instance.

One lifecycle attempt may commit at most one handle-binding CAS, from the exact
expected body to the exact frozen successor body, setting `lastTransitionRef`
to this attempt. All provider/target effects and their exact reconciliation
needed by the transition occur before that CAS. After it, the attempt may only
verify the committed body, emit content-free audit/cleanup acknowledgements,
and become terminal; it cannot contact a provider/target, consume another
authority, or make a second lifecycle revision. Any choreography needing a
later state change uses a new typed subject, approval/service authority,
mutation lease, reservation, and successor revision.

An unrelated revision/epoch/state/target/provider change, extra CAS, reordered
phase, missing predecessor, or second attempt denies and widens a contacted
attempt to `AMBIGUOUS`.

Reconciliation of `EXACT_EFFECT` may install a missing local successor only by
the same expected-to-successor CAS after proving the current body is still the
exact expected body and the same attempt remains its sole active reservation.
It cannot overwrite a later revision, clear another quarantine, or synthesize
a different successor.

After `EFFECT_STARTED`, timeout, cancellation, crash, malformed response,
transport loss, audit uncertainty, target/provider disagreement, lost response,
or failed local commit is `AMBIGUOUS`. The durable nonterminal attempt keeps the
handle fenced without falsely claiming the frozen successor committed. A
`CONFLICTING_EFFECT` adds quarantine evidence, but no conflicting prepare or
mutation is admitted until reconciliation closes the exact reservation.

Read-only reconciliation has four results:

- `NO_EFFECT` — exact provider/target evidence proves the proposed effect did
  not and cannot have occurred;
- `EXACT_EFFECT` — exact evidence proves the intended effect occurred once and
  all resulting identity/version/state facts match the frozen subject;
- `CONFLICTING_EFFECT` — a mutation occurred but differs from the subject; or
- `UNRESOLVED` — evidence is absent, stale, incomplete, ambiguous, or would
  require another mutation/value retrieval.

Only `NO_EFFECT` may close the attempt failed without lifecycle commit. Only
`EXACT_EFFECT` may construct the missing local commit from the original frozen
subject. `CONFLICTING_EFFECT` quarantines. `UNRESOLVED` remains ambiguous.
Reconciliation cannot retrieve a value, validate guesses, rotate, revoke,
delete, recover, renew, extend a deadline, or issue another credential.

If a target generates a credential in a one-time response and acknowledgement
is lost, the value is unrecoverable. The broker never repeats creation. An exact
non-secret provider credential ID durably observed before loss may inform later
SB-TC07 incident containment, but this ambiguous attempt does not authorize a
second mutation. Until that separately reviewed route exists, the target/account
is quarantined for operator reconciliation.

## 7. Creation and no-echo input

Static creation reserves a never-used handle ID and generation `1` before
opening an input channel. Input source is exactly one of:

- an attempt-bound provider-native UI/session created by the lifecycle adapter,
  fixed to the reserved backend object and returning exact non-secret version/
  completion evidence to the protected worker;
- a KStack no-echo protected prompt outside model-visible terminal capture;
- a target API that generates a value inside the protected lifecycle worker; or
- an SB-TC09 migration callback from an independently protected source.

Every route is attempt-bound, single-use, and maximum-sized. A value callback
writes directly to SB-TC05 protected memory. A provider-native session accepts
no caller-selected path/account and can complete only the reserved object;
session loss after submission is a contacted ambiguous attempt. Close,
cancellation, paste into chat, multiple values, encoding ambiguity, provider
prompt loss, or value-policy failure destroys the buffer and abandons the
generation without provider contact where possible.

An item independently created in a provider UI before reservation is not a
`CreateGeneration` result. It is pre-existing custody and requires a separate
SB-TC09 enrollment/migration preview that proves ownership, exact object/version,
scope, noncollision, and reversible source handling. SB-TC06 never adopts it by
searching or guessing a locator.

`CreateGeneration` uses provider CAS/absence semantics when qualified. The
broker then reads closed lifecycle metadata and, for stored values, may compare
the staged provider read to the input only inside protected memory or pass it
through `ValidateStagedGeneration`. No comparison digest or provider body
escapes. The handle becomes `ACTIVE` only after exact write identity/version,
read-back, target validation when required, audit admission, and local commit.
Otherwise it is abandoned, ambiguous, or quarantined; it is never silently
overwritten.

A dynamic template stores no issued credential. Creation validates the exact
provider role/configuration and synthetic issuance/revocation qualification,
then activates the template generation. Production policy prefers this route
over static material when SB-TC03 credential elimination selects it.

## 8. Rotation and bounded overlap

Rotation is one of four immutable choreography profiles:

1. `provider-replace-only-v1` — a value changed through an external trusted
   ceremony is staged in custody, read-back checked, target-validated, then cut
   over. KStack does not claim it changed the target.
2. `target-dual-valid-v1` — create a second target credential, capture it
   directly into custody, validate it, cut KStack over, and create one bounded
   predecessor-retirement obligation. Exact predecessor revocation and later
   destruction are separate one-use transitions.
3. `target-single-slot-v1` — one adapter-specific atomic target replacement with
   exact recovery and reconciliation semantics. It is unavailable unless the
   target cell proves safe ordering; KStack defines no generic rollback.
4. `dynamic-reissue-v1` — issue a new attempt-bound dynamic credential and let
   the old issued instance expire or revoke. It does not rotate the template
   generation unless its provider role/config changes.

There is no universal rotation ordering beyond the chosen qualified profile.
All profiles preserve these fences:

1. create current-plus-one as `STAGED` without changing currentness;
2. prove provider write/issuance and exact target validity through a registered
   validation operation that has no business effect;
3. atomically commit the new generation `CURRENT`, increment the SB-TC02
   metadata/lifecycle revision, preserve or execute the separately reserved
   global epoch relation, and make all old prepares/leases unusable;
4. if dual validity is necessary, mark only the old generation
   `OVERLAP_PREDECESSOR`, set an approved finite deadline, and continue resolving
   only the new generation;
5. atomically create a protected `predecessor-retirement-obligation-v1` binding
   this attempt, handle, new current generation, exact predecessor, target slot,
   deadline, required `REVOKE_PREDECESSOR`, retention class, and service/human
   authority profile; then finish the rotation attempt; and
6. consume that obligation in a separately reserved `REVOKE_PREDECESSOR`
   attempt, reconcile exact target revocation, and commit one new lifecycle
   revision that clears the predecessor and marks it `REVOKED`/`RETIRED`.
   Provider destruction, when required, is another separately approved
   `DESTROY` attempt after revocation evidence.

Maximum overlap is provider/target-specific and policy-bounded, never caller-
chosen or automatically extended. A failure before cutover abandons the staged
generation and leaves the predecessor current. A failure after cutover never
automatically selects the predecessor. If the new credential is unusable, a
fresh approved generation is required.

The retirement obligation is safe protected control metadata, not authority by
possession. Its service profile, if any, was shown in the rotation preview and
must be independently current when consumed. Missing authority does not extend
overlap: at the deadline, trusted time blocks new use and quarantines the handle
until exact predecessor revocation is resolved.

Target revocation precedes destructive removal of the old custody copy. This
avoids destroying the only recovery material while the target may still accept
the old credential. A policy that requires immediate destruction may select a
no-overlap profile only when its target guarantees are independently qualified.

## 9. Suspension, expiry, renewal, revocation, and reissue

`SUSPEND` atomically increments the metadata/lifecycle revision and blocks new
leases before any optional provider action. It preserves the generation and
does not advance the global authority epoch unless a separately reserved global
fence requires it.
`RESUME` requires the exact same nonexpired, nonrevoked, nondestroyed generation,
current backend/target evidence, fresh approval, and the exact expected/
successor epoch relation. It is not an automatic response to backend recovery.

Stored expiry is checked using SB-TC03 trusted time at preparation, lease issue,
pre-contact, and target crossing. Equality is expired. Expiry immediately blocks
use even if the durable lifecycle event has not yet been appended. Expiry never
deletes, revokes, rotates, or recovers automatically; policy schedules those as
separate typed transitions.

Dynamic issued-instance renewal is an internal subtransition of the original
SB-TC03 operation, not a handle lifecycle-transition subject. It is allowed only
when all are true: provider capability is currently qualified; the issued-
instance revision and state are current for the same attempt; renewal happens
before target effect; policy chose renewal at preparation; the requested
increment stays inside `maximumExpiresAt`; and the returned TTL/state is
revalidated. `RenewIssuedInstance` consumes one exact internal renewal
reservation and CASes only the issued-instance record. Renewal cannot make an
expired/nonrenewable instance valid or extend the SB-TC03 lease/attempt
deadline. After target effect begins, a short TTL never triggers renewal or
reissue/retry.

Revocation first reserves the durable attempt/use fence, then invokes one exact-
generation target/provider revoke, reconciles it, and performs its sole final
handle CAS. A provider success means only its qualified semantic.
For dynamic OpenBao credentials, use exact lease revocation with synchronous
behavior when qualified; bulk prefix and force revocation are not ordinary
adapter operations. Force revocation explicitly ignores backend errors and is
never used to claim successful cleanup.

Revocation/expiry of a dynamic issued instance is likewise attempt-local: it
CASes only `issuedInstanceRevision` and never changes or revokes the reusable
dynamic-template handle. Ambiguity fences that SB-TC03 attempt and issued
instance, while independent future attempts still require current template,
backend, policy, and readiness evidence.

Dynamic reissue is not a lifecycle transition. A new SB-TC03 attempt invokes
the ordinary SB-TC04 dynamic-resolution path and creates its own issued-instance
record. It cannot rescue or retry an expired, revoked, used, or ambiguous
attempt.

## 10. Soft deletion, destruction, and recovery

Deletion modes are never aliases:

- `SOFT_DELETE` blocks use and invokes a provider's exact recoverable-delete
  semantic. The generation remains as a protected tombstone with recovery
  deadline and provider-state evidence.
- `DESTROY` blocks use and invokes an exact provider irreversible-delete
  operation for one generation. A successful provider response is recorded as
  `provider-version-destroyed`, not universal erasure.
- whole-handle/provider-metadata deletion is a separate destructive profile. It
  requires every generation already destroyed or an approved all-versions
  consequence, exact independent approval, and a permanent KStack tombstone.

KStack never infers destruction from not-found. It requires an authenticated
provider result plus read-only metadata reconciliation whose exact semantics are
qualification-tested. If provider metadata is itself removed and absence is the
only possible proof, the qualification must bind pre-effect object/version
identity, CAS/idempotency semantics, audit evidence, and authenticated absence;
otherwise the result remains ambiguous.

`RECOVER_SOFT_DELETE` is allowed only inside the provider recovery window and
only when the same version is proven not destroyed. It uses new lifecycle
authority, revalidates target acceptance without business effect, increments
the metadata/lifecycle revision under the frozen expected/successor global-
epoch relation, and returns the same generation to `CURRENT`. It cannot recover
a revoked, exposed, expired, superseded, abandoned, destroyed, or policy-retired
version.

The KStack tombstone retains handle ID, terminal generation/revision, provider
semantic class, transition/audit refs, and non-secret retention facts. It has no
locator, label if policy requires label forgetting, value digest, credential
identifier, or restoration authority. Handle IDs and backend object identities
are never recycled even after metadata deletion.

## 11. Provider-specific truth boundary

### OpenBao KV v2

- Writes use exact mount/path from protected configuration and provider CAS
  against the expected current version. A CAS mismatch is conflict, never
  overwrite or retry.
- KV v2 soft delete marks version data deleted and can be undeleted; it does not
  remove underlying data. KStack names this only `SOFT_DELETE`.
- `destroy` permanently removes the selected version data according to OpenBao
  and marks its metadata destroyed. It is `DESTROY` for that version, not backup
  or storage-media erasure.
- deleting key metadata removes all versions and metadata and is a distinct
  all-versions destructive profile. It never runs as cleanup fallback.
- `max_versions` eviction and `delete_version_after` are provider retention
  policies. They apply with provider-specific timing and cannot substitute for
  a confirmed KStack lifecycle transition.
- KV secrets do not have dynamic leases. A returned lease duration never gives
  KV material dynamic revocation semantics.

### OpenBao dynamic secrets

Every issued credential binds the exact returned lease ID, TTL, renewability,
provider role, attempt, and maximum expiry inside protected state. Exact-lease
renew/revoke may be qualified. Prefix revocation, force revocation, lease tidy,
root/sudo/admin paths, and bulk enumeration are excluded from ordinary KStack
lifecycle adapters.

### OS-local development cells

- macOS Keychain update/delete queries must resolve one exact persistent item
  identity. Broad matching is prohibited because platform APIs can update or
  delete every match. Read-back and target validation determine rotation; an OS
  status alone does not prove the external credential changed.
- Secret Service `SetSecret`, replacement, and `Delete` are qualified per exact
  implementation/session/item. Attribute replacement can match an existing
  item, so multiple match, service replacement, prompt loss, relock, or object-
  path drift is ambiguous and never retried.
- Windows DPAPI provides protection for bytes, not target rotation, versioning,
  revocation, recovery, or secure file erasure. A DPAPI cell may implement
  versioned custody only through a separately qualified KStack record store; it
  cannot advertise unsupported provider semantics.

No OS-local result qualifies another OS, service implementation, user session,
or production identity boundary.

## 12. Qualification obligations

For each exact lifecycle adapter/provider/target cell, SB-TC10 must execute:

- every valid state transition and every invalid parent/successor pair,
  generation gap, rollback, fork, duplicate, stale revision, wrong backend,
  wrong target, wrong adapter, and cross-scope mutation;
- create under exact absence plus collision, pre-existing object, CAS conflict,
  lost acknowledgement, write success/local commit crash, and read-back mismatch;
- all rotation profiles with failures before/after stage, validation, cutover,
  overlap, predecessor revoke, provider cleanup, and local commit;
- old/new target acceptance controls proving only new is selected after cutover,
  bounded overlap, overlap deadline failure, no automatic rollback, and no
  predecessor fallback;
- expiry equality, clock rollback, suspend/reboot continuity, renewal bounds,
  provider-shortened TTL, nonrenewable/expired instance, revoke/expiry races,
  and no reissue inside the same attempt;
- soft delete, exact recovery, recovery-window expiry, destroy, all-version
  metadata deletion, not-found ambiguity, retention cleanup, backup/replica
  nonclaim, and handle-ID nonreuse;
- every provider/target crash cut and all four reconciliation results, proving
  no mutation retry and conflict quarantine;
- output/value leak positive controls across chat, tool schemas, argv,
  environment, files, clipboard, logs, exceptions, provider bodies, Jira,
  receipts, and review evidence; and
- concurrent lifecycle attempts, use versus revoke/suspend/cutover races, epoch
  invalidation, restart anti-replay, and durable ambiguous-state fencing.

Tests use generated synthetic credentials and isolated targets only. A provider
documentation claim or synthetic provider double cannot qualify real deletion,
recovery, revocation, CAS, lease, target rotation, or retention behavior.

## 13. Primary-source boundary

- Current [OpenBao KV v2 documentation](https://openbao.org/docs/secrets/kv/kv-v2/)
  distinguishes soft delete, undelete, version destroy, metadata deletion, CAS,
  version retention, and delayed deletion. These distinct semantics must not be
  collapsed into one KStack `delete` result.
- Current [OpenBao lease documentation](https://openbao.org/docs/concepts/lease/)
  states that dynamic secrets have leases and that KV secrets do not; provider-
  returned TTL/renewability and exact revocation behavior remain authoritative.
- The current [OpenBao lease API](https://openbao.org/api-docs/system/leases/)
  documents synchronous exact-lease revocation and warns that force revocation
  ignores backend errors. Implementation qualification still pins the exact
  deployed 2.6.1 API/build rather than a floating documentation page.
- Apple's [Keychain update/delete guidance](https://developer.apple.com/documentation/security/updating-and-deleting-keychain-items)
  confirms that updates and deletes are query-based and can affect all matches,
  motivating exact persistent-item identity and multiple-match denial.
- The current [Secret Service item API](https://specifications.freedesktop.org/secret-service/latest/org.freedesktop.Secret.Item.html)
  defines `SetSecret` and prompt-capable `Delete`, while
  [collection creation](https://specifications.freedesktop.org/secret-service/latest-single/)
  allows attribute-based replacement. It does not qualify an implementation or
  prove external target rotation/erasure.

All provider documentation is mutable. Qualification pins the exact provider,
OS/service build, configuration, capability record, adapter artifact, target
cell, and executed receipt.

## 14. Deterministic confirmation checks

SB-TC06 closes only if the reviewer confirms on one frozen digest:

1. Lifecycle mutation is separate from ordinary resolve/execute and has no
   generic provider operation, path, value-return, or caller option surface.
2. Handle/generation/issued-instance schemas are closed, monotonic, currentness-
   bound, and prohibit fallback, ID reuse, and resurrection.
3. No-echo/provider-generated values cross only inside protected sinks and no
   value-derived digest enters public or durable metadata.
4. Typed lifecycle authority binds the exact transition, state/revision,
   generation relation, backend, target, adapter, consequence, approval, epoch,
   and one-use mutation attempt.
5. Mutation is durably reserved before contact; ambiguous effects burn the
   attempt, fence the handle, and permit read-only reconciliation only.
6. Creation proves exact absence/write identity/read-back/validation before
   activation and never overwrites or deletes a legacy source.
7. Rotation is profile-specific, stages before cutover, resolves only new after
   cutover, bounds overlap, revokes old before destructive cleanup, and never
   automatically rolls back.
8. Suspension, expiry, renewal, revocation, and dynamic reissue retain exact
   authority/time/attempt semantics and cannot simulate provider behavior.
9. Soft delete, recovery, version destroy, all-version deletion, and permanent
   KStack tombstones remain distinct, with no universal erasure claim.
10. OpenBao KV/dynamic and each OS-local cell report only executed capabilities;
    broad/bulk/force operations and multiple-match effects are excluded.
11. Qualification covers every transition, race, crash cut, ambiguity result,
    provider semantic, target overlap, leak path, and anti-replay boundary using
    synthetic credentials.
12. ECR currentness concepts are reused without importing its repository store,
    envelope, or incomplete mutation-authority assumptions.
13. SB-TC07, SB-TC09, and SB-TC10 retain exact audit/receipt, migration/setup,
    and implementation/promotion ownership.

## 15. Review instruction

Review only SB-TC06. Return `approve` only at confidence at least 93 with zero
failed checks, security findings, material dissent, and unresolved questions on
the same candidate digest. No real credential, provider administration,
destructive provider operation, migration, deployment, or production trial is
authorized by this review.
