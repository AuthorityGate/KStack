# HB-TC02 self-contained normative reissue r2

Date: 2026-08-29  
Status: frozen implementation-review baseline  
Scope: generic registry-driven transactional installer protocol

This document reissues HB-TC02 as a self-contained review baseline. The former
base digest `110779cce9e64945a02cf4226d89cc387bbb379a9ef77a41dd503cc87f52dea5`
is retained only as a historical packet identifier because its bytes are not
present in the repository. It is not a normative dependency of this reissue.

This reissue incorporates the durable activation delta
`0291fd82057c943fe4f26effeca1c80455d41b57358988a972c890d084ad1f68`,
the round-1 implementation clarification
`37983ec49da01bc7a52deef2a9499c35d8f49244f8c9e711d5cbdff0bdcbb423`,
and the round-2 attempt/destination binding repair below. A reviewer can judge
the complete HB-TC02 boundary from this document without the historical packet.

## Authority and non-copy boundary

HB-TC02 is a protocol and evidence layer. It does not grant host qualification,
operation eligibility, approval, secret access, or permission to execute package
members. It consumes HB-TC01 package/handoff artifacts only by their typed,
domain-separated digests. Upstream gstack, Hermes, and OpenClaw bytes are not
admitted. Registry patterns may be independently reimplemented, but no upstream
artifact becomes authoritative through provenance or similarity.

The protocol functions are deterministic validators and constructors; they do
not perform filesystem mutation or execute detectors. A composing execution
controller obtains observations and protected records from qualified providers.
Host-specific items must later qualify those providers. This external-provider
boundary never defers a consistency check that is expressible from objects
already supplied to HB-TC02: the module must cross-bind those objects itself.

## Registry installer profile and detector

An `InstallerProfileV1` is closed and binds the registry-set digest, generic
target ID, platform profile, `PROJECT|USER` scope, detector-plan digest,
destination-template ID, one closed activation strategy, primitive-evidence
digest, file-mode-policy digest, sorted unique pre/post test IDs, and bounded
retry-policy digest. No target-name branch may select behavior in production
code; behavior is selected only by the validated profile.

A detector plan contains one to 32 unique probes of the closed kinds
`PATH_EXECUTABLE`, `FIXED_RELATIVE_FILE`, `VERSION_ARGV`, or
`HOST_READ_ONLY_API`. Executable names and argv are data, never shell text;
timeouts, allowed exit codes, output schema, and failure disposition are
bounded. Observations bind probe order, opened executable identity, output
digest, exit code, elapsed time, and trusted-search-path status. Evaluation
returns only `AVAILABLE`, `ABSENT`, `AMBIGUOUS`, or `UNVERIFIABLE`. It grants no
authority and fails closed on missing, extra, reordered, ambiguous, untrusted,
or malformed observations.

## Destination classification

Classification returns exactly `ABSENT`, `EMPTY_OWNED`, `KSTACK_ACTIVE`,
`KSTACK_POINTER_ACTIVE`, or `FOREIGN_OR_UNKNOWN`. A present ordinary directory
requires protected ownership and, when active, an exact active receipt and
installed-manifest match. An empty owned directory has no active receipt or
installed manifest. `pointerProfileValid` means the observed entry itself is
the exact KStack-owned pointer form allowed by the matching qualified profile;
it is mutually exclusive with ordinary- or empty-directory observations and
requires exact ownership, active receipt, and installed manifest.

Absent entries cannot carry present-entry facts. Ambiguous entries, identity
mismatch, unreceipted entries, links outside the exact pointer variant, and all
contradictory observation combinations return `FOREIGN_OR_UNKNOWN`. That state
is non-mutating under every strategy.

## Protected attempt and lease

An `InstallerAttemptV1` binds a protected unique attempt ID, handoff, installer
profile, policy, principal, workspace-root identity, and the exact addressed
activation-binding digest. Construction is permitted only when protected unique
state and replay service are available. Validation recomputes the attempt's
domain-separated digest from its closed object.

An `AttemptLeaseV1` binds the exact attempt digest and destination-binding
digest plus a protected lease ID and generation. It must be exclusive, held by
the current principal, current, and replay protected. Validation receives the
expected attempt and destination digests and rejects every mismatch or lost
predicate.

Neither an attempt nor a lease is transferable across destination bindings.
Every activation admission must receive the complete validated attempt and
lease, recompute their digests, require the attempt's destination-binding digest
to equal the addressed live binding, require its installer-profile digest to
equal the addressed validated profile, validate the lease against that same
attempt/destination pair, and require pre-activation evidence to carry the exact
recomputed attempt and lease digests plus the attempt's handoff, profile, policy,
principal, workspace-root, and destination digests. Raw caller-supplied digest
strings cannot substitute for those objects.

## Staging and pre-activation evidence

Staging is an attempt-owned same-volume sibling. The render-member inventory is
unique and already sorted by UTF-8 bytes; its key set equals the provided byte
map exactly. Every portable relative path, byte length, and content digest is
recomputed. Operations are non-executable and use the closed
create-exclusive/no-follow/flush/reopen/verify disposition. Missing, extra,
tampered, cross-volume, linked, or non-exclusive staging fails before mutation.

Pre-activation evidence is closed and binds the attempt, lease, handoff,
installer profile, policy, principal, workspace-root identity, and destination-
binding digests. Admission compares every field to the validated attempt,
validated lease, addressed profile, and addressed binding. It requires all of:
resolved handoff, current owner approval, destination
remeasurement, exact staged manifest, passing typed pre-activation tests,
preservation or migration authorization, exact primitive evidence, rollback
availability, and running-action compatibility. Every Boolean must be true and
the evidence-digest set must be nonempty, unique, sorted, and contain the
profile's exact primitive-evidence digest. No model waiver exists.

## Activation binding and total matrix

Before `PREPARED`, exactly one domain-addressed binding is frozen:

- `TREE_DESTINATION` binds containing-directory identity, entry-name digest,
  observed state, current tree/manifest or null, staged tree/manifest,
  filesystem and volume identities, durability domain, and `linkOrReparse=false`.
- `POINTER_DESTINATION` binds the pointer entry without following it, its closed
  kind, current pointer bytes/identity or null, the owned immutable version-store
  root, resolved old tree/manifest or null, staged new tree/manifest, pointer
  format and new target, filesystem/volume identities, durability domain, and
  exact ownership.
- `HOST_NATIVE_DESTINATION` binds the adapter, profile and evidence digests,
  typed native destination identity, old/new manifests, durability domain, and
  a sorted closed supported-state set that cannot contain
  `FOREIGN_OR_UNKNOWN`.

The live `observedState` argument is mandatory. It must be closed, non-foreign,
and equal the addressed state for tree/pointer bindings; a native binding must
list it exactly. Admission then applies the complete matrix:

| Observed state | ABSENT_RENAME | ATOMIC_DIRECTORY_EXCHANGE | ATOMIC_POINTER_SWAP | HOST_NATIVE_TRANSACTION |
|---|---|---|---|---|
| `ABSENT` | Tree, no-replace same-parent rename | Forbidden | Pointer, no-replace creation after immutable version preparation | Exact native support only |
| `EMPTY_OWNED` | Forbidden | Exact owned tree exchange | Forbidden | Exact native support only |
| `KSTACK_ACTIVE` | Forbidden | Exact active tree exchange | Forbidden | Exact native support only |
| `KSTACK_POINTER_ACTIVE` | Forbidden | Forbidden | Exact owned pointer replacement | Exact native support only |
| `FOREIGN_OR_UNKNOWN` | Forbidden | Forbidden | Forbidden | Forbidden |

Every unlisted combination returns `ATOMIC_ACTIVATION_UNAVAILABLE`. Admission
also performs the complete attempt/lease/evidence/destination cross-binding
specified above before returning the addressed binding digest.

## Durable transaction ledger and state graph

The states are `PREFLIGHT`, `STAGED`, `PREPARED`, `SWITCH_OBSERVED`, `VERIFIED`,
`COMMITTED`, `ABORTED_BEFORE_SWITCH`, `ROLLED_BACK`, and `RECOVERY_REQUIRED`.
The only advancing edges are:

- `PREFLIGHT -> STAGED|ABORTED_BEFORE_SWITCH`;
- `STAGED -> PREPARED|ABORTED_BEFORE_SWITCH`;
- `PREPARED -> SWITCH_OBSERVED|ABORTED_BEFORE_SWITCH|RECOVERY_REQUIRED`;
- `SWITCH_OBSERVED -> VERIFIED|ROLLED_BACK|RECOVERY_REQUIRED`; and
- `VERIFIED -> COMMITTED|ROLLED_BACK|RECOVERY_REQUIRED`.

Each transaction-record append receives the complete validated attempt object.
It recomputes the attempt digest and requires both the record attempt digest and
record handoff and destination-binding digests to equal that attempt. Genesis is sequence
zero at `PREFLIGHT` with no prior record. Every later record recomputes the
prior domain digest, increments sequence by exactly one, follows one graph edge,
and preserves attempt, handoff, destination, old/new manifests, and strategy.
Evidence digests are unique and sorted. Inconsistent attempt/destination pairs
cannot enter genesis or any later chain position.

## Crash recovery

Recovery compares the last durable state with a live predicate of `OLD_ACTIVE`,
`NEW_ACTIVE`, `NO_ACTIVE_CHANGE`, or `CONTRADICTORY`. Identities, ledger, and
primitive evidence must all be exact. Contradiction or any failed proof returns
`RECOVERY_REQUIRED` without repeating a switch. Pre-switch durable states may
abort only when no active change or the exact old identity is observed;
`PREPARED` plus exact new identity advances only to `SWITCH_OBSERVED`.
Committed and rolled-back terminals require the corresponding exact live
identity. No guess, retry, or cleanup may erase ambiguous evidence.

## Health and active-install receipt

Installer health binds the attempt, live destination identity, live manifest,
and a nonempty unique result set sorted by UTF-8 bytes. Each result is bounded,
read-only, identity matching, and `PASS|FAIL|TIMEOUT`. Passing requires every
result to be `PASS` with all three predicates true. Operation eligibility and
host qualification are fixed to false.

The external validator accepts only the canonical result order, recomputes the
domain digest, and rejects duplicates or reordering. An active-install receipt
requires `VERIFIED`, passing canonical health, exact health digest, and matching
attempt, destination identity, and live manifest. A reordered health artifact
cannot mint an alternate receipt for the same facts.

## Rollback, cancellation, and cleanup

Rollback is admitted only from `SWITCH_OBSERVED|VERIFIED` with the retained old
identity, the same qualified primitive, exact old manifest and health, and a
persisted-write disposition of `NONE|BACKWARD_READABLE`. Successful rollback
requires observed atomic restore, parent durability, and exact old identity,
manifest, and health; otherwise the result is `RECOVERY_REQUIRED`.

Cancellation may abort and verify attempt staging only in `PREFLIGHT|STAGED`.
From `PREPARED` through `VERIFIED` it is deferred until commit, rollback, or
fencing. Terminal states have no active transaction.

Cleanup is a separate content-addressed plan available only after a durable
terminal. Targets are unique UTF-8-byte-sorted portable paths, exact identities
and manifests, attempt owned, unreferenced, non-links, and only staging or
residue. `RECOVERY_REQUIRED` retains every target. Referenced, linked,
non-attempt-owned, duplicate, non-durable, glob-like, or ambiguous targets are
never deleted.

## Closure evidence

Implementation closure requires executable negative coverage for every
fail-closed rule above, exact architecture capability/importer pins, regenerated
install-health evidence, a zero-failure complete regression, primary readiness
of at least 93, and a fresh non-authoring independent final review from a
different provider family. Final review passes only at confidence at least 95
with zero failed checks, security findings, dissent, and unresolved questions.
