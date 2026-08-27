# HP-TC03 design candidate: replay, idempotency, and authoritative time

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC03` only
**Status:** local design candidate; no implementation or external action
**Predecessors:** HP-TC01 validated design; HP-TC02 interface candidate remains
independently review-gated

## Exact defect boundary

Define the protected nonce/idempotency service, durable attempt ledger,
authoritative time samples, crash recovery, duplicate handling, and ambiguity-
safe reconciliation state used by host operations. This item does not derive
principal/class (HP-TC02), authenticate evidence (HP-TC04), decide eligibility
(HP-TC05), mutate files (HP-TC08), authenticate MCP (HP-TC09), establish which
provider receipt is trustworthy (HP-TC10), own operation leases/fencing
(HP-TC11), or decide migration/rollback (HP-TC12).

## Reuse-first disposition

`BUILD-KSTACK-NATIVE`. The selected gstack host mechanics contain no protected
durable replay ledger or cross-provider ambiguity protocol suitable for this
trust boundary. Reusing prompt/session retry behavior would weaken KStack and
is rejected. HP-TC01 schemas and the locked HP-Q1 protected component are the
only composed internal foundations; no upstream bytes enter this design.

## Protected time service

`TrustedTimeSourceProfileV1` binds exact protected implementation/configuration
digests, wall-clock source, monotonic source, boot identity source, persisted
high-water store, durability primitive, maximum forward-jump policy, and test
vector set. The source runs inside the agent-unwritable HP-Q1 component.

`TrustedTimeSampleV1` is a closed/domain-addressed object with exactly:

```text
schemaId, schemaVersion, schemaSetDigest, sourceProfileDigest,
bootIdentityDigest, monotonicNanoseconds, wallUtc,
persistedHighWaterUtc, sequence, sampledAtMonotonicNanoseconds,
status, reasonCode|null
```

Status is `TRUSTED|ROLLBACK_DETECTED|FORWARD_JUMP|SOURCE_UNAVAILABLE|CORRUPT`.
Within one boot, elapsed/deadline decisions use monotonic time. Wall UTC is used
for interoperable issued/expiry timestamps and is never allowed below the
durably persisted high-water mark. Before admitting an authority-bearing or
side-effect request, the component durably advances the high-water mark to the
accepted wall time.

Any backward wall-clock movement is `ROLLBACK_DETECTED`; no tolerance is used
for authority decisions. A forward jump beyond the registered profile maximum
is `FORWARD_JUMP`. Either condition blocks new ask/privileged authority and
treats existing freshness as expired until a separately protected source-
recovery procedure establishes a new profile/sample. It never extends, revives,
or shifts an old expiry. Local public/read-only operations may continue only if
their registered profile explicitly requires no expiring authority/evidence.

Across restart, the new boot must load and verify the persisted high-water
record before issuing a sample. Missing, corrupt, undurable, or decreasing
state is `SOURCE_UNAVAILABLE|CORRUPT`, not a reset. Models, adapters, host time,
environment, file timestamps, provider response dates, and request timestamps
are observations only and cannot become authoritative time.

## Freshness policy

`FreshnessPolicyV1` is active-set/protected and has one exact row per operation
class. Defaults are:

| Class | request TTL | approval TTL | admission reservation TTL |
|---|---:|---:|---:|
| `LOCAL_READ` | 900000 ms | not applicable | 900000 ms |
| `ADVISORY` | 900000 ms | not applicable | 900000 ms |
| `LOCAL_WRITE` | 300000 ms | policy/profile defined if required | 300000 ms |
| `ASK_SIDE_EFFECT` | 120000 ms | 120000 ms | 120000 ms |
| `PRIVILEGED_SIDE_EFFECT` | 120000 ms | 120000 ms | 120000 ms |
| `BACKGROUND` | 300000 ms admission | policy/profile defined | 300000 ms |

Repository policy may tighten these TTLs to any positive millisecond value but
cannot lengthen them beyond the active class row. Evidence, cache, and lease
consumers additionally cap expiry at the shortest referenced input expiry.
HP-TC04/05/11 own their semantics; HP-TC03 supplies the time/sample/comparison
primitive. Background continuation/renewal remains HP-TC11.

Idempotency/reconciliation retention is not a freshness TTL and cannot be
tightened below safety requirements. Its minimum is the maximum of the class
retention row, provider reconciliation window, provider idempotency window,
producer/audit receipt retention, and any possibly-acted ambiguity retention.
The class floors are 24 hours for read/advisory, 30 days for local write and
background, and 365 days for ask/privileged effects. An unresolved possibly-
acted record is retained until reconciled or an independently governed data-
retention disposition says it may be archived without permitting replay.

## Nonce reservation and idempotency scope

`NonceReservationV1` binds a protected 256-bit random nonce digest, context-
draft digest, session/principal/repository/operation/profile digests, issued/
expiry time, time-sample digest, reservation sequence, and state
`RESERVED|BOUND|BURNED|EXPIRED`. The component locks the nonce index, verifies
global uniqueness within the protected ledger namespace, durably appends
`RESERVED`, and only then returns the digest to HP-TC02. HP-TC02 later binds the
final request digest under the same lock and advances it to `BOUND`. An aborted,
expired, crash-interrupted, or mismatched reservation becomes `BURNED`; a nonce
is never issued again.

Nonce randomness prevents prediction; durable uniqueness prevents replay. A
nonce supplied by a caller/host/model is never admitted as the protected nonce.

`EffectScopeV1` is closed and binds exact principal, repository/worktree,
operation ID/schema/profile/class, external audience/target digest or null,
semantic input/effect digest, and idempotency-scope version. It deliberately
does not bind a transient session, adapter, host build, active-set version, or
attempt ID, so the same business effect cannot execute again merely because
the software/session changed. The operation registry defines the canonical
semantic-effect projection; unknown or ambiguous projections reject.

`idempotencyKeyDigest` is the domain-separated digest of `EffectScopeV1` and is
included in the operation request. For non-effecting operations, the semantic
effect is the complete canonical input/output-intent projection and duplicate
handling may reuse only a recorded result. Caller/provider idempotency strings
are separate typed inputs and must bind this protected scope; they cannot
replace or widen it.

Two concurrent reservations for the same live idempotency scope serialize
under the protected scope index. Exactly one becomes authoritative; every other
request resolves the authoritative attempt state and cannot start new work.

## Durable attempt ledger

`AttemptRecordV1` is append-only and binds exactly:

```text
schemaId, schemaVersion, schemaSetDigest, ledgerId, sequence,
previousRecordDigest, attemptId, nonceReservationDigest,
idempotencyKeyDigest, effectScopeDigest, requestDigest|null,
approvalSubjectDigest|null, authorityEnvelopeDigest|null,
operationId, operationClassId, principalDigest|null,
repositoryContextDigest, activeSetDigest, policyDigest,
state, stateEvidenceDigest, providerAttemptDigest|null,
providerReceiptDigest|null, localResultDigest|null,
ambiguityDigest|null, trustedTimeSampleDigest, recordedAt
```

The protected component owns one exclusive append transaction updating the
hash-chained log plus nonce, idempotency-scope, request, and attempt indexes. A
transition is visible only after checksum, append, index update, and platform-
qualified durability barrier complete. Failure before the barrier exposes no
success and blocks the affected namespace until recovery. Agent/repository/
adapter/model processes cannot write, replace, truncate, or select ledger rows.

The closed attempt state machine is:

```text
RESERVED -> REQUEST_BOUND -> ADMITTED
ADMITTED -> DENIED | CANCELLED_PRE_ACTION | PREPARED
PREPARED -> CANCELLED_PRE_ACTION | DISPATCH_STARTED
DISPATCH_STARTED -> OUTCOME_KNOWN | OUTCOME_AMBIGUOUS
OUTCOME_AMBIGUOUS -> RECONCILING
RECONCILING -> OUTCOME_KNOWN | OUTCOME_AMBIGUOUS
OUTCOME_KNOWN | DENIED | CANCELLED_PRE_ACTION -> CLOSED
```

`PREPARED` is durably recorded before any action-capable call. Immediately
before crossing the action boundary, the component durably records
`DISPATCH_STARTED`; a crash after that transition is conservatively possibly
acted even if the provider may not have received the request. There is no state
that infers “not acted” from missing response or receipt.

For operations whose action boundary is local atomic mutation, HP-TC08 supplies
the action/rollback evidence. For external actions, HP-TC10 supplies admissible
provider receipt/reconciliation evidence. HP-TC03 records their exact digests
and state implications but does not decide whether they are authentic.

## Duplicate, retry, cancellation, and reconciliation rules

On any request with an existing nonce, request digest, or idempotency scope, the
protected component obtains the authoritative row and applies exactly:

| Authoritative state | Duplicate disposition |
|---|---|
| `RESERVED` without bound request | same admission transaction may finish binding after exact context match; another request is denied |
| `REQUEST_BOUND|ADMITTED|PREPARED` | attach only to the existing attempt after all HP-TC02/currentness echoes pass; never create a second attempt |
| `DENIED|CANCELLED_PRE_ACTION|CLOSED` with known result | return the recorded immutable result/disposition; do not execute |
| `DISPATCH_STARTED` without known outcome | record/return `OUTCOME_AMBIGUOUS`; begin registered reconciliation; never blind retry |
| `OUTCOME_AMBIGUOUS|RECONCILING` | return ambiguity/reconciliation state; do not execute |
| `OUTCOME_KNOWN` | return the exact recorded result/receipt reference; do not execute |

Cancellation before durable `DISPATCH_STARTED` records
`CANCELLED_PRE_ACTION`. Cancellation, timeout, process death, transport loss, or
policy/evidence invalidation after that point cannot assert non-action; it
records `OUTCOME_AMBIGUOUS` unless admissible evidence already proves an exact
outcome.

`ReconciliationPlanV1` is pre-registered per operation profile and binds
provider/query protocol, same idempotency scope/key, admissible HP-TC10 receipt
profile, bounded attempts/deadline, and terminal mappings. Reconciliation is
read/query only unless HP-TC10 proves a provider's repeated same-key call is an
idempotent query-or-return-existing operation. A generic retry button, new
session, new nonce, changed active set, user “continue,” or model assertion
cannot resend the effect.

If no safe reconciliation exists, ambiguity remains durable and blocks the
same effect scope. A later user may authorize a genuinely distinct business
effect only through a new effect-scope value whose semantic difference is
displayed/approved; an override that merely changes an attempt ID or nonce is
rejected.

## Crash recovery and corruption

At startup the protected component validates ledger identity, every record
schema/domain/hash link/sequence, index-to-log equality, durability checkpoint,
nonce uniqueness, and one-authoritative-attempt-per-scope. It truncates only an
incomplete tail proven never committed by the qualified storage protocol;
valid committed history is never rewritten.

Recovery reconstructs indexes solely from the protected committed log. A
record at `DISPATCH_STARTED` without a later known outcome becomes
`OUTCOME_AMBIGUOUS`. `PREPARED` may resume only the same attempt after complete
context/currentness revalidation. Corruption, forked chains, duplicate
sequences/nonces, missing committed bodies, index disagreement, rollback of the
durable high-water sequence, or unprovable tail disposition produces
`LEDGER_CORRUPT` and blocks the affected namespace. It never creates an empty
ledger or trusts a repository/model copy.

Archival may move immutable closed records to protected content-addressed
storage while leaving a permanent non-replay tombstone keyed by nonce,
idempotency scope, request, and effect digest. Tombstone deletion/reuse is
forbidden while the operation's computed safety retention applies. Broader data
retention policy is a separate governance decision and cannot make an archived
effect executable again.

## Stable outcomes

The closed codes are:

```text
KSTACK_REPLAY_NONCE_DUPLICATE
KSTACK_REPLAY_NONCE_BURNED
KSTACK_REPLAY_SCOPE_IN_FLIGHT
KSTACK_REPLAY_RESULT_RECORDED
KSTACK_REPLAY_RECONCILIATION_REQUIRED
KSTACK_REPLAY_OUTCOME_AMBIGUOUS
KSTACK_REPLAY_EFFECT_SCOPE_INVALID
KSTACK_REPLAY_RETENTION_UNSAFE
KSTACK_REPLAY_LEDGER_UNAVAILABLE
KSTACK_REPLAY_LEDGER_CORRUPT
KSTACK_TIME_SOURCE_UNAVAILABLE
KSTACK_TIME_ROLLBACK_DETECTED
KSTACK_TIME_FORWARD_JUMP
KSTACK_TIME_OBJECT_EXPIRED
KSTACK_TIME_PROFILE_MISMATCH
```

Human text is a fixed escaped projection. Provider/request/exception/path/
principal/credential content is not interpolated into durable/model-visible
diagnostics.

## Isolation from other items

- HP-TC02 supplies the exact trusted context/request/approval subject; HP-TC03
  reserves and binds nonce/idempotency state but does not derive identity or
  class.
- HP-TC04/05 may invalidate evidence/eligibility using authoritative time; they
  decide trust/status, not this ledger.
- HP-TC08 supplies local mutation outcome evidence. HP-TC10 supplies receipt
  authenticity/reconciliation semantics. HP-TC11 supplies live action fencing.
- HP-TC12 owns migration and data rollback. Ledger recovery here restores only
  protected replay state, never user/provider data.

## Deterministic verification design

Reference implementations must match exact bytes for time samples, freshness
comparisons, nonce reservations, effect scopes, attempt records, transitions,
indexes, checkpoints, ambiguity records, reconciliation plans, and tombstones.

Tests cover simultaneous same-scope admissions; repeated nonce/request/key;
random-source failure; request abort after reservation; expiry at every
boundary; monotonic wrap/source failure; wall rollback/forward jump; reboot
with correct/missing/older/corrupt high-water state; crash before/after every
append/index/barrier/action transition; torn tail versus committed corruption;
forked log/index; cancelled/timeout/lost response before and after dispatch;
provider acted/no-act/unknown/conflicting receipts; unsupported reconciliation;
changed session/host/root/active set/policy; archive/tombstone replay; and
retention shorter than provider ambiguity windows.

Adversarial providers intentionally return success then drop transport, process
the same idempotency key twice, lie about time, and contradict later query
results. Independent HP-TC10 test doubles determine receipt truth; adapter/model
output never does. Property tests prove one scope has at most one authoritative
attempt and no state path from possibly-acted ambiguity back to dispatch.

No test uses a production credential or target. Secret scans and hostile-string
fixtures prove durable/model-visible artifacts expose no raw nonce, provider
token, credential, principal, path, request body, or exception.

## Review request

Review HP-TC03 only for authoritative time/rollback behavior, protected nonce
uniqueness, stable idempotency scope, crash-consistent attempt state, duplicate
handling, and no-blind-retry reconciliation. Closure requires Codex 93+ and
empty failed, security, dissent, and question arrays.

Do not review or close HP-TC04 through HP-TC12, invoke Opus, inspect/edit files,
use tools, implement, use credentials, perform an external action, commit,
push, deploy, publish, or edit reports.
