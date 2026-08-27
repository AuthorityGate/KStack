# HP-TC08 design candidate: race-resistant local mutation

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC08` only
**Status:** local design candidate; no implementation or repository mutation
**Predecessors:** HP-TC01 through HP-TC04 and HP-TC07 are validated design only;
HP-TC05/06 interfaces are frozen and independently review-gated

## Exact defect boundary

The round-one plan validated a pathname and later wrote through that pathname,
leaving symlink, reparse-point, mount, case-alias, parent replacement, hardlink,
and concurrent-rename races. This item defines one race-resistant, handle-
relative, identity-bound local mutation protocol with crash recovery and
negative fixtures.

It does not decide eligibility (HP-TC05), produce host qualification (HP-TC06),
authenticate private MCP calls (HP-TC09), define receipt admissibility
(HP-TC10), implement active-set/action fencing (HP-TC11), or promise migration/
persisted-data rollback (HP-TC12). No mutation is authorized by this design.

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC02's protected repository/context
binding, HP-TC03's durable attempt state, HP-TC05's frozen eligibility epoch,
HP-TC07's protected broker boundary, and the HP-TC11 fence interface. Build
KStack-native handle traversal, mediated-write isolation, transaction journal,
atomic single-entry commit, recovery, and observer evidence. Prompt-level or
path-check patterns from gstack cannot close kernel races and are rejected. No
upstream bytes enter.

## Admissible assurance profile

V1 admits repository mutation only under `EXCLUSIVE_MEDIATED`. The protected
HP-Q1 component runs in a distinct OS protection boundary and holds the only
ordinary write/delete/rename authority for the target repository mutation
scope. Agent, host, adapter, model, tool, plugin, MCP, shell, formatter/LSP,
background task, and ordinary user-session processes receive read handles or
broker requests, never direct mutation rights. Platform ACL/mount/namespace and
negative-probe evidence must prove this property for the exact root.

A `COOPERATIVE_DETECT` profile may exercise diagnostic tests where another
same-authority process could mutate the directory, but it is ineligible for a
`FULL` local-write operation because common filesystems lack an atomic
compare-and-swap rename conditioned on the replaced inode. Advisory locks,
watchers, pre/post `stat`, path canonicalization, file timestamps, and short
TOCTOU windows do not upgrade it. Missing exclusive mediation returns
`KSTACK_MUTATION_ISOLATION_UNAVAILABLE` before preparation.

OS/kernel administrators and storage firmware outside the protected component
remain outside this claim. Their detected interference produces ambiguity or
corruption and blocks further mutation; it is not silently treated as an
ordinary concurrent edit.

## Root and component identity

The protected component receives an already authenticated physical repository
root from HP-TC02, opens it without following a final link/reparse point, and
binds volume/mount ID, filesystem ID, stable file ID, ownership/ACL generation,
case/normalization profile, and worktree identity. It never rediscovers the root
from cwd, environment, search path, repository text, host output, or a string
supplied by the model.

`RelativeTargetV1` is an ordered array of 1..64 canonical components. A
component is 1..255 UTF-8 bytes, already NFC, and contains no NUL, separator,
`.`/`..`, empty value, absolute/drive/UNC prefix, Windows device/reserved name,
trailing dot/space alias, alternate-data-stream separator, or platform-
canonical collision. The bound platform profile supplies an exact bytewise
case/normalization key; two targets with the same key reject before opening.

Traversal is component-by-component relative to an already-open parent handle.
Every intermediate and final existing component is opened no-follow and
revalidated by stable identity after the next handle is acquired. Symlinks,
junctions, reparse points, magic links, mount/volume crossings, proc-style
handle aliases, device nodes, sockets, FIFOs, and unregistered filesystem
types reject. Existing file link count must be exactly one; in-place writes and
hardlink creation are forbidden.

Each `MutationBackendProfileV1` binds exact implementation and qualified kernel/
filesystem/platform versions, handle-relative open/create/rename primitives,
no-follow/beneath/same-volume flags, durability operations, ACL-isolation probe,
file-ID semantics, case profile, fault-injection vectors, and limitations. An
unqualified primitive/version/filesystem is unavailable; a fallback string
path or shell command is forbidden.

## Closed mutation request and plan

The V1 operation kinds are exactly `CREATE_FILE`, `REPLACE_FILE`, `DELETE_FILE`,
`CREATE_DIRECTORY`, `DELETE_EMPTY_DIRECTORY`, and `RENAME_WITHIN_ROOT`.
Symlink, hardlink, special-file, permission/owner, cross-root, cross-volume,
recursive delete, and in-place content mutation are not supported.

One `LocalMutationPlanV1` affects exactly one directory entry. A user-visible
multi-file change is an ordered set of separately fenced plans/results and is
explicitly non-atomic as a group. This prevents a journaled sequence from being
misrepresented as filesystem-wide atomicity.

The protected plan binds exactly:

```text
schemaId, schemaVersion, schemaSetDigest, requestDigest, attemptDigest,
operationKind, repositoryContextDigest, rootIdentityDigest,
sourceRelativeTarget|null, targetRelativeTarget,
sourceParentIdentityDigest|null, targetParentIdentityDigest,
expectedSourceStateDigest|null, expectedTargetStateDigest,
desiredContentArtifactDigest|null, desiredMetadataProfileDigest|null,
backendProfileDigest, mutationIsolationEvidenceDigest,
eligibilityDigest, eligibilityEpoch, activeSetDigest, policyDigest,
environmentSnapshotDigest, actionFenceProfileDigest,
deadline, byteLimit, createdAt, expiresAt
```

Expected state is exactly `ABSENT` or an opened-handle identity/content record
binding file type, volume/file ID, size, bytes digest, link count, owner,
relevant mode/ACL, and metadata generation. Desired bytes are an immutable
content-addressed artifact re-read and rehashed by the protected component;
host/model text is never streamed directly into a target.

The plan is built only after resolving parent handles, checking operation-
specific source/target types, acquiring protected per-root/per-entry locks in
canonical target-key order, and freezing all HP-TC02/03/05/07 inputs. It expires
at the shortest bound input expiry. The host cannot substitute operation kind,
target, expected state, desired bytes, metadata, limits, or root after approval.

## Prepare and commit protocol

The protected mutation ledger is outside repository/agent-writable storage and
is append-only, hash-chained, rollback-detected, and durably indexed by request,
attempt, root, and canonical target key. States are:

```text
PLANNED -> LOCKED -> PREPARED -> COMMIT_INTENT
COMMIT_INTENT -> COMMITTED | ROLLED_BACK | OUTCOME_AMBIGUOUS
PLANNED | LOCKED | PREPARED -> ABORTED
```

Preparation reopens/revalidates root and parent identities, rechecks exclusive
mediation, expected source/target state, bytes/metadata, eligibility, active
set, policy, environment, time, and request/approval echoes. For create/replace,
it creates an unpredictable exclusive staging entry relative to the target
parent handle, writes bounded desired bytes, applies allowed metadata, flushes
content/metadata, then reopens and verifies bytes/identity. For delete/replace,
the current entry is never unlinked during prepare.

Immediately before commit, the component invokes the future HP-TC11 protected
fence and repeats every mutable comparison using handles. It then durably
appends `COMMIT_INTENT` before one native atomic directory-entry operation:

- create: no-replace rename of the staged file into the proven-absent target;
- replace: atomic exchange/replace while retaining the prior entry in the
  protected same-filesystem recovery area;
- delete: atomic rename into that recovery area, never direct unlink;
- create directory: handle-relative exclusive create after absent recheck;
- delete empty directory: atomic rename of the proven empty directory into the
  recovery area; or
- rename: no-replace handle-relative rename within the same bound root/volume,
  retaining exact source identity.

Exclusive mediation makes the revalidation-to-native-operation interval closed
to ordinary writers. The component then flushes every affected directory,
reopens the visible entry/absence by handle-relative lookup, verifies the exact
post-state, and appends `COMMITTED` with observer evidence. Cleanup of staging/
recovery content occurs only after the immutable result/audit handoff has been
durably retained according to policy.

Any failure before `COMMIT_INTENT` removes only protected staging and appends
`ABORTED`. Any detected change before the native operation appends `ABORTED`
without touching the target. A post-intent error cannot be declared non-acted;
it enters recovery or `OUTCOME_AMBIGUOUS`.

## Crash recovery and rollback boundary

On startup, the protected component validates ledger identity, chain/sequence,
durability checkpoint, indexes, root/backend profile, and every nonterminal
transaction before accepting another mutation for that root. It inspects only
opened handle identities for visible target, staging, and recovery entries.

For `COMMIT_INTENT`, exactly one of these deterministic dispositions applies:

- desired post-state visible and expected recovery state present: finish
  durability verification and append `COMMITTED`;
- expected pre-state visible and staged desired state present: prove no commit,
  remove staging, and append `ROLLED_BACK`;
- replace/delete post-state visible but required recovery entry missing, both
  old/new visible, neither expected identity visible, or any identity/ledger
  disagreement: append `OUTCOME_AMBIGUOUS` and block the target/root; or
- a qualified backend-specific torn-operation vector: execute only its exact
  independently tested recovery rule, then reverify all identities.

Automatic rollback after a proven committed operation is permitted only before
the result is released and only by atomically restoring the exact retained
preimage under the same fence/currentness checks. Once the result is released,
a reversal is a new mutation request. HP-TC08's retained single-entry preimage
does not prove migration or application-data rollback; HP-TC12 remains the sole
owner of those claims.

Corrupt/forked/rolled-back ledger state, missing committed record, unexpected
entry identity, lost exclusive mediation, unavailable durability primitive, or
unqualified filesystem produces `KSTACK_MUTATION_STATE_CORRUPT` and blocks the
root. Recovery never constructs an empty ledger, trusts repository journal
files, guesses from a pathname, or retries a possibly committed mutation.

## Local result evidence and isolation from HP-TC10/11

`LocalMutationEvidenceV1` binds plan/attempt, pre/post handle identities and
content digests, ledger transition digests, backend/isolation profile,
eligibility/fence input digests, native-operation code, independent filesystem
observer digest, cleanup/recovery state, trusted times, and outcome exactly
`COMMITTED|NOT_COMMITTED|AMBIGUOUS|RECOVERY_REQUIRED`.

This is local observer evidence, not automatically an admissible
`OperationReceiptV1`. HP-TC10 determines its receipt/anchor requirements. The
future HP-TC11 fence owns atomic current-restriction comparison at the action
boundary; this design defines the exact values it must receive but does not
claim the fence exists. Until exclusive mediation, HP-TC10 receipt, and HP-TC11
fencing are implemented/validated, no `FULL` local-write profile is available.

## Stable failures and safe diagnostics

The closed reason families are `KSTACK_MUTATION_ROOT_*`,
`KSTACK_MUTATION_TARGET_*`, `KSTACK_MUTATION_PATH_*`,
`KSTACK_MUTATION_SYMLINK_OR_REPARSE`, `KSTACK_MUTATION_MOUNT_CHANGED`,
`KSTACK_MUTATION_CASE_ALIAS`, `KSTACK_MUTATION_HARDLINK_UNSAFE`,
`KSTACK_MUTATION_ISOLATION_UNAVAILABLE`, `KSTACK_MUTATION_EXPECTED_STATE_CHANGED`,
`KSTACK_MUTATION_FENCE_CHANGED`, `KSTACK_MUTATION_PREPARE_FAILED`,
`KSTACK_MUTATION_COMMIT_AMBIGUOUS`, `KSTACK_MUTATION_RECOVERY_REQUIRED`,
`KSTACK_MUTATION_STATE_CORRUPT`, and `KSTACK_MUTATION_BACKEND_UNQUALIFIED`.
Concrete codes are HP-TC01 registry-owned and map to stable states.

Public/model-visible diagnostics contain only fixed text, operation kind, safe
IDs, state, counts, and correlation digests. Raw path components, file content,
host output, exception, configuration/environment, principal, credential,
approval, key, or secret never cross the projection boundary.

## Deterministic verification design

Golden vectors freeze relative-target validation, platform canonical keys,
root/component identities, plans, expected states, ledger transitions, staging/
recovery layouts, local evidence, reason mappings, and safe diagnostics across
independent Node and native/Rust implementations for every qualified backend.

Path fixtures cover absolute/drive/UNC, empty/dot/dot-dot, separator/NUL,
Unicode NFC/non-NFC, case collisions, Windows reserved/trailing/ADS aliases,
symlink/magic-link/junction/reparse, mount/volume crossing, nested worktree,
proc-handle alias, hardlink, special file, parent replacement, root replacement,
and alternate cwd/environment/search-path/global-config attempts.

Race fixtures mutate source, target, parent, root, ACL, mount, case alias,
active set, policy, eligibility epoch, environment, approval/request echo, and
content artifact before/after every open, prepare, flush, fence, intent,
native-operation, verification, and result step. A non-mediated same-authority
writer must make the assurance profile unavailable rather than pass a short
race test.

Fault injection crashes before/after every ledger append, file/directory flush,
staging write, exchange/rename, recovery move, verification, cleanup, and result
release. It covers disk full, read-only remount, torn/corrupt ledger tail,
checkpoint rollback, missing staging/recovery, both entries visible, neither
identity visible, observer loss, and backend returning success then losing
transport. Recovery must reach one exact conservative state without blind
retry or unintended unlink.

Operation fixtures cover all six kinds, wrong expected state/type/content,
non-empty directory deletion, cross-root rename, multi-entry atomicity claim,
byte/deadline overflow, metadata mismatch, repeated nonce/idempotency key,
cancellation before/after intent, and preimage retention/cleanup. Property tests
prove all kernel mutation calls are handle-relative under the bound root, one
plan changes at most one directory entry, and no ambiguous/corrupt/unqualified
state becomes committed.

Tests use disposable repositories only and no production credential, provider,
or target.

## Review request

Review HP-TC08 only for exclusive mediated-write assurance, handle-relative
identity traversal, closed target grammar, single-entry prepare/commit protocol,
crash recovery, honest atomicity/rollback boundaries, and local evidence
handoffs. Closure requires Codex 93+ and empty failed, security, dissent, and
question arrays.

Do not review or close HP-TC09 through HP-TC12, invoke Opus, inspect/edit files,
use tools, implement, mutate a repository, use credentials, perform an external
action, commit, push, deploy, publish, or edit reports.
