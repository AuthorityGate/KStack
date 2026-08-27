# HP-TC11 design candidate: active-set leases, activation, and action fencing

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC11` only
**Status:** local design candidate; no implementation, activation, or action
authority
**Predecessors:** HP-TC01 through HP-TC04 and HP-TC07 are validated design only;
HP-TC05/06/08/09/10 interfaces are frozen and independently review-gated
**Locked owner boundary:** HP-Q2 exact running-host binding and immediate
detect-and-invalidate behavior

## Exact defect boundary

The round-one plan lacked an immutable operation lease/epoch, crash-consistent
active-set pointer, exact activation linearization, and a rule for restrictions
that change while work is in flight. This item defines those mechanisms for one
protected governance component.

It does not decide migration/data reversibility (HP-TC12), authorize a broker
action (HP-TC07), decide evidence/eligibility (HP-TC04/05), implement mutation
or receipt proof (HP-TC08/10), or claim that a protected/platform backend exists.

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC02 context, HP-TC03 replay/time,
HP-TC04 live measurement, HP-TC05 eligibility/invalidation, HP-TC07 broker,
HP-TC08 mutation, and HP-TC10 receipt interfaces. Build KStack-native immutable
active sets, protected activation journal/pointer, leases, restriction epochs,
and action-boundary serialization. Prompt/session state and gstack lifecycle
commands cannot supply these guarantees and are rejected. No upstream bytes
enter.

## Immutable active-set candidate

`ActiveSetV1` is a closed/domain-addressed object binding exact digests for host
contract schema/resolver/invariants/vectors, kernel, protected component,
adapter registry and selected adapter, broker, policy, requirement/eligibility/
receipt registries, evidence root/profile, harness/observer/bypass set,
environment-measurement profile, MCP/mutation backends, migration profile,
compatibility entry, and complete test/qualification evidence.

There are no version ranges, aliases, mutable paths, search order, environment
fallbacks, or runtime downloads. Every member is available and rehashed from a
protected content-addressed store before staging. Compatibility is one exact
`CompatibilityEntryV1`; zero or multiple matching entries reject.

`ActiveSetCandidateV1` binds candidate/prior active-set digests, compatibility,
schema selection, exact external running-host constraint, current host
environment snapshot, all required HP item implementation/validation receipts,
HP-TC12 migration/rollback gate result, staged-at time, and expiry. A design
review, score, adapter declaration, instruction package, MCP projection, or
host self-report cannot satisfy an implementation/validation row.

## External running-host binding under locked HP-Q2

KStack-owned members activate atomically as one active set. The external host
does not. Immediately before staging, activation, lease issue, lease renewal,
and every action boundary, the protected component independently remeasures
the exact running process identity and relevant live configuration through the
HP-TC04 profile. Running process and on-disk executable identities remain
separate mandatory facts.

`HostBindingFenceProfileV1` lists every mutable host fact, protected probe,
change/version source, event-loss/overflow signal, maximum observation latency,
and action classes it can fence. For effecting operations, the qualified
platform must supply non-silent change detection and a protected ordering point
between observed host/config versions and action commit. Event-source overflow,
unobservable fact, replacement race, or an inability to order change versus
commit makes the affected profile unavailable; polling or a short evidence TTL
does not meet HP-Q2.

A changed process/build/config/plugin/tool/MCP/subagent/root/mode/permission/
wrapper/hook/background/broker/adapter fact first advances the relevant
protected restriction and eligibility epochs, then invalidates all matching
leases before another action commit. It is never modeled as a KStack file that
the active pointer changed atomically. A fact changed after one already
linearized action commit affects subsequent boundaries and cannot rewrite that
action's historical authorization.

## Protected activation store and state machine

`ActivationStoreProfileV1` binds the protected storage/backend implementation,
atomic compare-and-swap primitive, journal/pointer schemas, durability barrier,
rollback detection, recovery algorithm, fault vectors, and supported platform/
filesystem versions. Repository files, symlinks, current-directory pointers,
and plain rename without qualified durability are inadmissible.

The append-only `ActivationJournalV1` has monotonic sequence, previous-record
digest, expected prior pointer digest/sequence, candidate, compatibility,
migration/rollback evidence, host-binding snapshot, restriction epoch, trusted
time, state, and state evidence. States are:

```text
STAGED -> VALIDATED -> PREPARED -> COMMIT_INTENT
COMMIT_INTENT -> ACTIVE | RECOVERED_PRIOR | ACTIVATION_AMBIGUOUS
STAGED | VALIDATED | PREPARED -> REJECTED
ACTIVE -> RETIRED
```

`VALIDATED` requires all candidate dependencies, exact compatibility, current
host binding, no restriction/quarantine, and HP-TC12's persisted-data gate. It
does not itself change the active set. `PREPARED` revalidates every mutable
input and loads the candidate protected process/resources without publishing
them. `COMMIT_INTENT` is durably appended before the pointer transaction.

`ActiveSetPointerV1` binds store ID, pointer sequence, active-set digest,
activation-record digest, prior pointer digest, restriction epoch, committed-at
trusted time, and integrity tag. The protected store atomically compares the
expected prior pointer and writes the complete candidate pointer, then executes
its qualified durability barrier and appends `ACTIVE`. Consumers obtain one
protected pointer snapshot and exact members; they never read mixed old/new
globals.

After a crash, startup validates store identity, journal chain/sequence,
pointer integrity, candidate/prior closures, durability checkpoint, and process
state. An exact qualified recovery table determines whether the candidate
pointer committed, prior remains authoritative, or outcome is ambiguous.
Ambiguity/corruption blocks activation and lease issue; recovery never chooses
the highest timestamp, newest filename, first parseable slot, repository copy,
or an empty default.

Retired active-set members remain available while any live lease, attempt,
receipt, replay record, migration recovery, or historical artifact references
them. HP-TC12 owns broader data/schema retention and rollback semantics; HP-TC11
only prevents deleting live execution dependencies.

## Immutable operation leases

An `OperationLeaseV1` uses HP-TC01's closed fields and is accompanied by a
protected `OperationLeaseDetailV1` binding exactly:

```text
leaseDigest, leaseSequence, requestDigest, attemptDigest, operationId,
operationClassId, principalDigest|null, hostSessionDigest,
repositoryContextDigest, rootIdentityDigest, requirementProfileDigest,
eligibilityDigest, eligibilityEpoch, evidenceAdmissionSnapshotDigest,
environmentSnapshotDigest, hostBindingVersionDigest,
authorityEnvelopeDigest|null, activeSetDigest, activePointerSequence,
policyDigest, restrictionEpoch, quarantineHeadDigest,
revocationSequence, idempotencyKeyDigest, nonceDigest,
actionFenceProfileDigest, issuedAt, expiresAt, state
```

State is `ADMITTED|FENCED|DISPATCH_COMMITTED|COMPLETED|RECONCILE|EXPIRED|CANCELLED`.
The protected component issues a lease only after one atomic input snapshot
proves current context, replay state, eligibility, evidence/environment, policy,
active set, approval if required, and operation prerequisites. Expiry is the
earliest bound input/class limit. A lease is single request/attempt/action,
non-transferable, non-delegable, non-renewable in place, and not a credential.

Renewal means a new lease sequence/digest after complete remeasurement,
reevaluation, replay/currentness checks, and—where required—a new exact owner
approval. Old approval or lease bytes cannot authorize new background work.

## Restriction epoch and action fence

`RestrictionEventV1` is a protected durable event binding scope, old/new
restriction epochs, source type/digest, reason, affected operation/lease IDs,
effective trusted time, and protected anchor. Policy tightening, revocation,
quarantine, evidence invalidation, active-set replacement, host-binding change,
context/session/root loss, broker/backend loss, or cancellation advances the
epoch before publication. Relaxations also create a new epoch but never revive
an old lease.

Immediately before the irreversible/native/external action boundary, the
protected broker/mutation component enters one serialized fence transaction:

1. load the current protected active pointer, restriction/eligibility epochs,
   policy, revocation/quarantine heads, lease/attempt state, and trusted time;
2. independently remeasure the HP-Q2 host binding and every HP-TC04 mutable
   environment fact, verifying the qualified change-ordering source has neither
   overflowed nor advanced;
3. compare every `OperationLeaseDetailV1` field, request/approval display echo,
   idempotency/effect scope, target/input/limits, applicable HP-TC08/10 profile,
   and shortest expiry;
4. atomically append either `FENCED` with stable reasons or
   `DISPATCH_COMMITTED` plus the exact action payload digest; and
5. for an allowed action, invoke the one registered action primitive through
   the same protected component/order domain before accepting a later
   restriction event for that scope.

The `DISPATCH_COMMITTED` append is the linearization boundary. A restriction
ordered before it fences the action. One ordered after it affects later actions
but cannot claim the committed dispatch did not occur. A crash, timeout,
cancellation, or lost response after the append is possibly acted and moves the
HP-TC03 attempt/lease to `RECONCILE`; HP-TC10 evidence determines outcome. The
component never blind-retries.

For HP-TC08 local mutation, the fence order domain covers the single native
directory-entry commit and records local observer evidence. For an external
effect, it covers exact protected-provider dispatch; provider completion occurs
outside the lock and needs HP-TC10. For read/advisory output, protected release
is the boundary. No unprotected adapter/model/host method may execute the action
after receiving a lease decision.

If a platform/provider path cannot place its actual effecting primitive behind
this serialized protected boundary, that operation profile cannot be `FULL`.
Checking in prose or returning an "approved" token to an untrusted host is not
fencing.

## In-flight and background rules

Before `DISPATCH_COMMITTED`, any restrictive event moves the lease to `FENCED`
or `CANCELLED` and guarantees no action through the protected route. After that
boundary, cancellation/revocation stops further child/renewal/output actions
but treats the committed action as possibly acted until receipt/reconciliation.
Partial provider effects follow their registered receipt semantics.

A background controller lease authorizes supervision only. Every effecting
child step requires a fresh operation lease and action fence. Ask-tier
background execution obeys the locked HP-TC07 decision: durable preauthorization
is prohibited; after bounded non-escalating troubleshooting, a short configured
wait, and finite allowed attempts, KStack must obtain fresh exact execution-time
owner approval and revalidate policy, active set, target, inputs, limits,
expiry, nonce, idempotency, and authority. A failure becomes one complete
Yes/No/Comment notification; the question cannot waive failed safety or itself
authorize the blocked action.

Parent/session death, cancellation, deadline, host process exit/replacement,
restriction event, or lease expiry causes protected descendant cancellation and
orphan/descriptor checks. Descendant survival is never inferred safe from a
host task status. Unknown termination or a possibly acted child remains
`RECONCILE` and blocks same-effect redispatch.

## Stable failures and diagnostics

The closed reason families are `KSTACK_ACTIVE_SET_*`,
`KSTACK_ACTIVATION_COMPATIBILITY_*`, `KSTACK_ACTIVATION_HOST_BINDING_*`,
`KSTACK_ACTIVATION_MIGRATION_GATE_*`, `KSTACK_ACTIVATION_POINTER_*`,
`KSTACK_ACTIVATION_RECOVERY_*`, `KSTACK_LEASE_*`,
`KSTACK_RESTRICTION_EPOCH_*`, `KSTACK_FENCE_*`,
`KSTACK_BACKGROUND_APPROVAL_REQUIRED`, and `KSTACK_IN_FLIGHT_RECONCILIATION_REQUIRED`.
Concrete codes are HP-TC01 registry-owned and map to exact state transitions.

Public/model-visible diagnostics contain only fixed text, safe IDs/states/counts,
and correlation digests. Raw paths, host/config/environment content, action
payload, principal, approval material, credential, provider response, key, or
protected journal/pointer bytes are excluded.

## Deterministic verification design

Golden vectors freeze active sets/candidates, compatibility joins, activation
journal/pointer states, recovery decisions, host-binding versions, leases,
restriction events/epochs, fence transcripts, background-child bindings, and
safe diagnostics across independent Node and native/Rust implementations.

Activation fixtures cover missing/duplicate/mismatched member, version alias,
schema/adapter/broker/policy incompatibility, incomplete HP receipt, failed
HP-TC12 migration gate, stale host process/config, on-disk/running mismatch,
event-source overflow, candidate/prior substitution, concurrent activations,
pointer compare failure, durability failure, and unqualified storage backend.

Fault injection crashes before/after every journal append, member load, host
remeasurement, pointer compare/write/barrier, protected-process switch, `ACTIVE`
append, lease issue, restriction epoch append, fence comparison,
`DISPATCH_COMMITTED`, native mutation/provider send, receipt, and retirement.
It corrupts/rolls back/forks journals and pointers and proves no timestamp/
filename/parseable-slot fallback.

Fence races change every active-set/policy/evidence/eligibility/quarantine/
revocation/context/root/session/host/config/adapter/input/target/limit/approval/
time field immediately before, during, and after the serialized boundary. They
cover lost/overflowed host-change events, external config replacement, process
restart with same path/PID reuse, action primitive outside the protected domain,
and restriction ordered on each side of commit.

Lease/background tests cover replay/transfer/delegation, renewal in place,
cross-request/repository/session/attempt use, expiry, parent death, cancellation,
descendant/orphan behavior, controller lease used for an effect, stale durable
approval, bounded troubleshooting success/failure, fresh approval substitution,
post-dispatch cancellation, response loss, and blind retry. Property tests prove
one committed dispatch per attempt/effect scope and that restrictions never
produce a less restrictive current lease.

No test activates production components, uses production credentials, or calls
production targets.

## Review request

Review HP-TC11 only for immutable active-set composition, crash-consistent
activation/pointer recovery, locked HP-Q2 external-host detect/invalidate,
single-action leases, serialized restriction/action fencing, honest pre/post-
dispatch rules, and fresh background approval behavior. Closure requires Codex
93+ and empty failed, security, dissent, and question arrays.

Do not review or close HP-TC12, invoke Opus, inspect/edit files, use tools,
implement or activate components, use credentials, perform an external action,
commit, push, deploy, publish, or edit reports.
