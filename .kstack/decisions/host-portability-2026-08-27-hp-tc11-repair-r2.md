# HP-TC11 round-2 repair: one protected activation-generation publication

**Prior packet:** `17f11efa1ff234ebcf82823f89fcc8ca8f30ba46518e1c0f55761df1600dbfc9`
**Prior result:** Codex 97 revise; 1 failed / 1 high security / 0 dissent /
1 question; output `44183a9ab5750483e3c7891478b13469e5d6d9e3e47f5f4e8fcddca581dfcc5e`
**Item/boundary:** HP-TC11 only; all unmodified host binding, leases, restriction
epochs, action fencing, diagnostics, tests, and no-authority clauses remain frozen

## Exact defect

Publishing a standalone active-set pointer and then switching protected
processes/resources leaves a crash window in which the pointer, consumer-visible
generation, and actual execution generation can disagree. This repair makes one
protected generation-root swap the sole publication and linearization primitive.
The pointer becomes a non-authoritative audit projection derived after that swap.

## Protected activation generation

`ActivationGenerationV1` is protected and immutable. It binds the active-set
digest, exact loaded resource closure, protected process/broker/mutation/MCP
instance identities and readiness receipts, adapter/policy/evidence registries,
host-binding snapshot/version, restriction and eligibility epochs, migration
gate, generation sequence, prior generation digest, journal intent digest, and
reference/retirement policy. Every process and resource is constructed and
validated privately inside the candidate generation before publication.

`ActivationGenerationRootV1` is one protected store slot/handle containing the
current generation digest/sequence, restriction epoch, journal record digest,
and integrity tag. `ActivationStoreProfileV1` qualifies one compare-and-swap or
transactional root-replacement primitive whose durability and crash recovery
cover the entire root. There is no separately authoritative process, resource,
MCP, adapter, or filesystem pointer.

Every consumer lookup, lease issue/renewal, action-fence entry, broker dispatch,
local mutation, and protected output release acquires a generation handle from
this root through the protected component. The handle pins exactly one immutable
generation and its ready process/resources. Mutable globals cannot be combined;
a call without a protected generation handle rejects.

## Exact publication and linearization

The candidate is privately built, started, self-checked, host-remeasured, and
marked `PREPARED`; its endpoints accept no consumer work. The component durably
appends `COMMIT_INTENT`, then under the activation/restriction order domain:

1. revalidates the expected prior generation, candidate readiness, host binding,
   restriction/eligibility epochs, migration gate, and no lost observer event;
2. atomically replaces `ActivationGenerationRootV1` from the exact prior value
   to the complete candidate value with the qualified protected primitive; and
3. executes the primitive's bound durability barrier before releasing the lock.

The successful protected root replacement is the only activation linearization
point. Before it, every new handle resolves the prior generation and the
candidate accepts no work. After it, every new handle resolves the candidate's
already-ready process/resources; no later process/resource switch exists.

`ActiveSetPointerV1` may be emitted after publication only as a signed audit
projection binding the committed root digest and generation. Its absence, delay,
duplication, corruption, or disagreement cannot change consumer visibility or
drive activation/recovery; disagreement makes it invalid evidence.

## Leases, actions, retirement, and reverse activation

Every `OperationLeaseV1` binds the acquired activation-generation digest and
sequence. At the action boundary the same handle is revalidated under the
restriction/action order domain; a root or epoch change before
`DISPATCH_COMMITTED` fences the lease. A committed dispatch stays bound to its
pinned generation for receipt/reconciliation only and cannot authorize a new
effect after replacement.

The prior generation remains immutable and alive while any consumer handle,
lease, attempt, receipt, replay record, or recovery reference exists. After the
root changes, prior-generation handles cannot gain new effect permission: each
action fence observes the newer root and rejects. Frozen-profile read-only
completion or reconciliation may continue on the pinned generation without
mixing candidate resources.

A failed candidate health check after publication never edits the root or swaps
one member. It advances the restriction epoch to fence new work and starts a new
explicit reverse-activation transaction whose candidate is the exact retained
prior generation and whose HP-TC12 migration gate passes. Reverse activation has
its own intent, root compare-and-swap, durability, receipt, and recovery; failure
remains restricted/ambiguous.

## Crash recovery truth table

Recovery authenticates the protected root and journal chain, then applies only
these mutually exclusive predicates:

- root equals exact prior and no successful candidate-root replacement receipt
  exists: candidate did not publish; keep prior and mark `RECOVERED_PRIOR`;
- root equals exact candidate and its qualified durable replacement receipt,
  candidate closure/readiness, and intent all validate: candidate published;
  recover `ACTIVE` and serve candidate handles;
- root or receipt is missing, torn, rolled back, forked, mismatched, addresses
  an incomplete/unready generation, or disagrees with protected process/resource
  identities: `ACTIVATION_AMBIGUOUS`; issue no lease and perform no action.

Startup never repairs from the audit pointer, PID, reachable endpoint, newest
timestamp, repository file, or whichever generation responds. A backend without
an atomic durable protected generation-root primitive cannot support activation.

## Corrected verification properties

Fault injection stops before/during/after candidate construction, readiness,
intent, root replacement, durability, audit projection, restriction advance,
lease issue, action fence, retirement, and reverse activation. It kills the old
or new process at each boundary, corrupts every member/projection, and races
consumer lookup with publication.

Properties prove one authenticated root selects exactly one complete ready
process/resource generation; no consumer sees candidate before the swap or prior
after acquiring a post-swap handle; no audit pointer affects truth; pre-swap
failure preserves prior; post-swap failure restricts or explicitly reverses;
old-generation leases cannot start a new effect; and every unprovable crash state
blocks rather than choosing a mixed generation.

## Review request

Review only whether this repair supplies one exact protected publication and
recovery linearization coupling active set, processes/resources, consumer
visibility, leases, and action fences without pointer/process split. Closure
requires Codex 93+ and 0 failed/security/dissent/questions.

Do not inspect other files, use tools, invoke Opus, implement, activate a host,
use credentials, perform external actions, commit, push, deploy, publish, edit
reports, or close another HP item.
