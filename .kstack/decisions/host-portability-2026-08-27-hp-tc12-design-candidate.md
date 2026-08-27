# HP-TC12 design candidate: reversible migrations and rollout seams

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC12` only
**Status:** local design candidate; no migration, activation, rollback, or
rollout action
**Predecessors:** HP-TC01 through HP-TC04 and HP-TC07 are validated design only;
HP-TC05/06/08/09/10/11 interfaces are frozen and independently review-gated
**Locked owner boundary:** HP-Q3 persisted-data rollback rule

## Exact defect boundary

The round-one plan treated active-pointer restoration as rollback even when a
candidate changed persisted artifacts, and did not define shadow/no-write,
skill-projection, or read-only MCP rollout seams. This item defines the complete
persisted-artifact inventory, migration/recovery classification, independent
qualification, write fencing, rollback window, retention, and separated seams.

It does not implement activation/fencing (HP-TC11), mutation (HP-TC08), receipt
trust (HP-TC10), or authorize any migration. It consumes those interfaces.

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC06's frozen independent harness,
HP-TC08 local evidence, HP-TC10 receipts, HP-TC11 activation/fence interface,
and HB-TC01/HB-TC04 projections. Build KStack-native artifact inventory,
migration/restore/forward-recovery proof, rollback availability, and rollout
seams. gstack release/canary patterns are useful rollout precedent but do not
prove persisted-data reversibility or authority isolation; direct reuse is
rejected. No upstream bytes enter.

## Locked HP-Q3 rule

Restoring the protected active pointer alone is never persisted-data rollback.
An activation that changes authoritative persisted artifacts is prohibited
unless at least one exact path is independently validated before approval:

1. the prior active set can read and safely continue writing every candidate-
   era artifact within the declared rollback window;
2. a protected snapshot plus reverse/replay restore returns all authoritative
   data, including candidate-era accepted writes, to the exact prior-compatible
   state; or
3. an independently verified forward-recovery set can read/repair the migrated
   state and restore safe service without pretending to revert the pointer.

No owner/model approval or risk acknowledgement waives the above gate for an
artifact-changing activation. When an activation makes no authoritative
persisted change but still lacks operational pointer rollback, status is
`ROLLBACK_UNAVAILABLE` and the exact limitation must be displayed before its
approval. Derived/cache rebuildability cannot be used to classify authoritative
user/audit/replay/receipt state as disposable.

## Complete persisted-artifact inventory

`PersistedArtifactInventoryV1` is a closed, content-addressed set with one row
for every store, schema, file family, database/table/index, journal, object
namespace, credential/key reference, cache, generated projection, receipt,
replay/idempotency record, evidence/catalog, active/activation record, and
external provider-side state reachable by the current or candidate set.

Each row binds stable artifact ID, authority class, owner component, physical/
logical location identity, schema/semantic version, reader/writer set, retention,
confidentiality, encryption/key generation, consistency group, snapshot method,
mutation profile, external-state correlation, migration transform, restore/
replay transform, validation oracle, and disposition exactly:

```text
AUTHORITATIVE | PROTECTED_AUDIT | REPLAY_SAFETY | EXTERNAL_EFFECT |
DERIVED_REBUILDABLE | EPHEMERAL
```

Inventory construction joins static active/candidate manifests, protected
registries, opened live stores, database catalogs, provider adapters, and
independent dynamic write traces. Set equality against every component's
declared read/write namespaces is mandatory. Missing, extra, alias, unknown,
unopenable, mixed-version, or dynamically discovered artifact blocks migration
qualification. Repository/model declarations cannot mark an object disposable.

`DERIVED_REBUILDABLE` requires a content-addressed source of truth, exact
deterministic rebuild implementation, independent equality vectors, and proof
that deletion/rebuild affects no authority, replay, receipt, or external state.
Otherwise the row is authoritative by default.

## Migration and recovery plan

`MigrationPlanV1` binds exact prior/candidate/recovery active sets, inventory,
compatibility entry, source/target schema/semantic versions, transforms,
consistency groups, dependency order, resource limits, write-fence profile,
snapshot/restore/replay profiles, expected counts/digests/invariants,
independent oracle/fixture set, cleanup, rollback window, and trusted expiry.
No dynamic script, network fetch, host callback, model-generated transform, or
"current" schema is permitted.

Every artifact row receives exactly one migration classification:

```text
UNCHANGED_BACKWARD_READABLE
CHANGED_BACKWARD_READABLE
RESTORE_AND_REPLAY_VERIFIED
FORWARD_RECOVERY_VERIFIED
DERIVED_REBUILD_VERIFIED
EPHEMERAL_DROP_VERIFIED
UNSUPPORTED
```

Classification is established by independent fixtures over exact candidate-
produced artifacts, not schema-version comparison or transform self-report.
`CHANGED_BACKWARD_READABLE` proves the prior set reads, validates, preserves,
and can safely append/update after every candidate transformation and permitted
candidate-era write. Unknown fields that the prior writer would discard or
reinterpret fail.

`RESTORE_AND_REPLAY_VERIFIED` requires a protected point-in-time snapshot of
the complete consistency group, independently restored into a disposable
environment, byte/semantic/invariant equality, and a protected change journal
whose candidate-era accepted writes can be reverse-transformed/replayed without
loss or duplication. A preactivation backup alone is insufficient once any new
write is accepted.

`FORWARD_RECOVERY_VERIFIED` binds an exact separately retained recovery set,
transform, compatibility, qualification evidence, and maximum recovery time.
It may restore safe forward service but is labeled forward recovery, not
rollback. If its prerequisites are unavailable or stale at activation time,
the gate fails.

## Independent qualification

The HP-TC06 protected harness runs migration fixtures outside migration code on
disposable byte-identical store clones. The migration subject cannot write
expected results, source snapshots, change journal, oracle state, evidence,
active pointer, or verdict. At least one independent reader/invariant oracle
per authoritative consistency group validates before/after/restore/replay.

Qualification covers empty/minimum/maximum stores, every historical retained
schema, boundary/unknown values, corrupt/torn records, duplicate IDs, concurrent
logical writes, key rotation, retention edges, replay/idempotency tombstones,
audit/receipt chains, external-effect references, partial transforms, transform
rerun, crash at every record/batch/durability barrier, and resource exhaustion.

For backward readability, the prior binaries execute full read/write/roundtrip
fixtures against candidate output and candidate-era writes. For restore/replay,
the oracle proves snapshot consistency, restore equality, change capture from
the exact fence point, one-time ordered replay, and final prior-readable state.
For forward recovery, the recovery set executes its complete operation-profile
and invariant suite. A migration passing its own unit tests is not evidence.

`MigrationQualificationV1` binds all input/output/fixture/oracle digests,
environment, resource bounds, every artifact-row result, recovery timing,
limitations, and outcome `PASS|FAIL|INCOMPLETE|AMBIGUOUS|HARNESS_ERROR`.
Only `PASS` may satisfy the activation gate.

## Shadow, snapshot, and write-fenced execution

Before approval, the protected component runs a dry migration against a fresh
consistent clone and produces exact projected duration/space, artifact counts,
rollback class/window, recovery set, expected service impact, and any explicit
`ROLLBACK_UNAVAILABLE` limitation for a non-artifact-changing activation. These
facts are displayed through fixed typed fields; raw data is excluded.

At execution, HP-TC11 fences all writers for each consistency group, waits for
or safely cancels pre-fence operations, reconciles possibly acted operations,
and proves no untracked writer/bypass through HP-TC06. It then captures and
durably verifies the protected snapshot/change-journal start, revalidates every
plan/qualification/active-set/policy/host/time binding, and only then runs the
exact bounded transform.

Migration writes use HP-TC08's mediated handle/transaction evidence or the
database profile's independently qualified equivalent. External provider state
is never rewritten by a local migration; exact provider receipts/read-back
prove only registered metadata/reconciliation operations. Each completed
consistency group is journaled and verified before the next dependency group.

After transform, independent oracles validate complete target state. HP-TC11
may activate the candidate pointer only while writer fencing remains in force
and every HP-Q3 gate is current. The protected component then either opens the
candidate for writes under the declared rollback strategy or rejects/restores
before release. No mixed prior/candidate writer interval is allowed.

## Rollback and recovery state machine

`MigrationExecutionV1` transitions only:

```text
PLANNED -> WRITES_FENCED -> SNAPSHOT_VERIFIED -> MIGRATING -> TARGET_VERIFIED
TARGET_VERIFIED -> ACTIVATION_READY -> CANDIDATE_ACTIVE
PLANNED | WRITES_FENCED | SNAPSHOT_VERIFIED | MIGRATING | TARGET_VERIFIED
  -> RESTORING | FORWARD_RECOVERING | FAILED_SAFE | OUTCOME_AMBIGUOUS
CANDIDATE_ACTIVE -> ROLLBACK_FENCED -> PRIOR_ACTIVE | FORWARD_RECOVERED |
                    RECOVERY_REQUIRED | OUTCOME_AMBIGUOUS
```

Before candidate activation, any failure restores the exact verified snapshot
or runs the registered forward recovery while writes stay fenced; pointer state
alone is not success. After candidate activation:

- backward-readable strategy fences writes, revalidates prior compatibility for
  the exact current store, switches through HP-TC11, then verifies prior service;
- restore/replay strategy fences writes, captures the end of candidate-era
  change journal, restores the snapshot, reverse-transforms/replays each accepted
  write exactly once, verifies prior-readable equality, then switches;
- forward-recovery strategy keeps the prior pointer unavailable, applies the
  verified recovery set/transform, validates, and activates that set; and
- absent/currently failed strategy leaves service fenced and reports
  `RECOVERY_REQUIRED|OUTCOME_AMBIGUOUS`, never destructive guessing.

`RollbackAvailabilityV1` binds exact strategy, artifact coverage, prior/recovery
set, snapshot/change-journal state, last verified store digest/sequence,
candidate writes accepted, expiry/invalidators, estimated recovery bounds, data-
loss claim exactly `ZERO_PROVEN|NONZERO_DISCLOSED|UNKNOWN`, and current status
`AVAILABLE|EXPIRED|INVALIDATED|UNAVAILABLE`.

For artifact-changing activation, only `AVAILABLE` with `ZERO_PROVEN` satisfies
locked HP-Q3. `NONZERO_DISCLOSED|UNKNOWN` cannot be approved around. A rollback
window invalidates immediately on an unjournaled write, missing/corrupt snapshot,
recovery-set loss, schema/transform/key change, external-state contradiction,
or qualification expiry. The component advances the restriction epoch before
another write and re-fences service.

The prior and forward-recovery active sets, schema/resolver closures, transforms,
keys, snapshots, journals, and validation tools are protected from garbage
collection until the rollback window is conclusively closed and policy retention
permits release. Releasing them is a separately audited protected action.

## Independent rollout seams

`RolloutSeamV1` defines two separately reviewable, non-authoritative candidate
surfaces. Neither can inherit qualification from the other:

1. **H3a skill projection:** candidate Agent Skills/instructions are rendered
   and loaded in a disposable read/advisory host session. Inputs/outputs are
   captured for comparison, but the candidate receives no broker, credentials,
   write handles, provider endpoint, approval, tool authority, or production
   repository. Loading/discovery proves projection only.
2. **H3b read-only MCP:** the candidate exposes only HB-TC04's public concrete
   MCP `resources/list` and `resources/read` methods through HP-TC09's
   unauthenticated profile. It has
   no tools, prompts, writes, subscriptions, sampling, elicitation, private
   resources, identity promotion, or downstream evidence/eligibility use.

`ShadowRunV1` binds one seam, candidate/prior active-set digests, sanitized or
synthetic input set, isolated environment, output schema, comparison oracle,
side-effect-denial observer, limits, start/end measurements, and outcome. A
shadow mismatch is retained evidence and blocks only the affected seam/profile;
a match is not production support or authority.

Canary activation is operation-profile scoped through a new exact active policy,
not probabilistic process routing. Read/advisory profiles may be enabled first
only after their own qualification and HP-TC11 activation. Any effecting profile
requires every applicable HP item and HP-Q3 gate; H3 shadow results cannot waive
them. Rollback/forward recovery uses protected state, never a canary percentage.

## Stable failures and diagnostics

The closed reason families are `KSTACK_MIGRATION_INVENTORY_*`,
`KSTACK_MIGRATION_PLAN_*`, `KSTACK_MIGRATION_QUALIFICATION_*`,
`KSTACK_MIGRATION_WRITE_FENCE_*`, `KSTACK_MIGRATION_SNAPSHOT_*`,
`KSTACK_MIGRATION_TRANSFORM_*`, `KSTACK_MIGRATION_RESTORE_*`,
`KSTACK_MIGRATION_REPLAY_*`, `KSTACK_MIGRATION_FORWARD_RECOVERY_*`,
`KSTACK_ROLLBACK_*`, `KSTACK_ROLLOUT_SEAM_*`, and
`KSTACK_SHADOW_SIDE_EFFECT_DETECTED`. Concrete codes are HP-TC01 registry-owned
and map to exact states.

Public/model-visible diagnostics contain fixed text, safe IDs/states/counts,
recovery class/window, and correlation digests only. Raw persisted data, paths,
schema values, provider bodies, principal, configuration/environment, credential,
key, snapshot, change journal, or exception is excluded.

## Deterministic verification design

Golden vectors freeze inventories, classifications, plans, qualification rows,
snapshots/change journals, execution transitions, rollback availability,
restore/replay/forward-recovery outcomes, rollout seams, shadow runs, reason
maps, and safe approval disclosures across independent Node and native/Rust
implementations.

Inventory tests add/remove/alias every store, table/index, journal, object
namespace, cache, external effect, dynamically discovered write, key generation,
and hidden component path. They try to mark audit/replay/user data derived and
require set-equality failure rather than silent exclusion.

Migration fixtures cover every retained schema and boundary value; unknown
fields; lossy type/normalization changes; candidate write read/update by prior;
empty/maximum stores; partial/torn/duplicate transforms; transform rerun;
concurrent and unjournaled writes; snapshot inconsistency/corruption; missing
keys; replay duplication/omission/order; provider contradictions; insufficient
space/time; and independent-oracle loss.

Fault injection crashes before/after every writer fence, snapshot/barrier,
record/batch transform, qualification/verification, activation pointer change,
candidate write, rollback fence, restore, reverse transform/replay, forward
recovery, and prior/recovery activation. It proves pointer-only rollback never
reports data recovery and no ambiguous state resumes mixed writers.

HP-Q3 fixtures try approval/risk acknowledgement with missing recovery, a
preactivation backup after unjournaled candidate writes, expired qualification,
garbage-collected prior/recovery set, changed schema/key/transform, nonzero or
unknown data loss, and runtime disclosure after approval. Every artifact-
changing case remains blocked unless current zero-loss evidence exists.

Seam tests give H3a/H3b write handles, broker, production endpoint, credentials,
private resources, tools/prompts/subscriptions, identity claims, and downstream
evidence use; every attempt is denied/observed. They prove H3a and H3b failures/
passes cannot clear each other or any effecting operation profile.

Property tests prove every authoritative inventory row has one current recovery
classification, every accepted candidate-era write is present exactly once
after rollback/forward recovery, and a less capable recovery input never yields
a stronger rollback status.

All tests use disposable synthetic stores/providers and no production data,
credentials, activation, or target.

## Review request

Review HP-TC12 only for locked HP-Q3 enforcement, complete persisted-artifact
inventory, independent backward-read/restore-replay/forward-recovery proof,
write-fenced migration/rollback state, zero-loss rollback availability,
retention, and independent H3a/H3b rollout seams. Closure requires Codex 93+
and empty failed, security, dissent, and question arrays.

Do not invoke Opus, inspect/edit files, use tools, implement, migrate/activate/
rollback anything, use credentials or production data, perform an external
action, commit, push, deploy, publish, or edit reports.
