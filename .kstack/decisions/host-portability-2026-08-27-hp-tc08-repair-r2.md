# HP-TC08 round-2 repair: honest namespace footprint and exhaustive recovery

**Prior packet:** `b3c505c228da57aed0376f7e29b4ee77a20c8e6578c6052c7d77f1888ecfb33a`
**Prior result:** Codex 98 revise; 2 failed / 2 high security / 2 dissent /
2 questions; output `41be785c5a2fad6a06933c0dcfe33db68c2a64cae95be6d34d82f59ff38f3a76`
**Item/boundary:** HP-TC08 only; all unmodified isolation, handle traversal,
fencing, result, safety, and no-authority clauses remain frozen

## Exact corrections

The prior one-directory-entry claim is deleted. Each plan has one bounded,
explicit multi-entry transaction footprint and exactly one atomic native
namespace operation as its commit linearization point. Preparation and cleanup
may use separately journaled staging/recovery operations but cannot be described
as the user-visible atomic commit.

`NamespaceFootprintV1` binds every source, target, staging, recovery entry and
parent handle identity; its pre/post type, stable identity or `ABSENT`, role,
phase (`PREPARE|COMMIT|RECOVERY|CLEANUP`), permitted native operation, and
expected parent metadata generation. No path/entry outside this closed set may
change. Each staging/recovery name is protected, exclusive, same-filesystem,
and agent-inaccessible.

## Exact commit footprints

| Kind | Prepared state | One atomic commit operation | Committed state |
|---|---|---|---|
| `CREATE_FILE` | target absent; staging has desired file | no-replace rename staging -> target | target=desired; staging absent |
| `REPLACE_FILE` | target=old; staging=desired | atomic exchange target <-> staging | target=desired; staging=old recovery |
| `DELETE_FILE` | target=old; recovery absent | rename target -> recovery, no replace | target absent; recovery=old |
| `CREATE_DIRECTORY` | target absent; staging has exact empty prepared directory | no-replace rename staging -> target | target=prepared directory; staging absent |
| `DELETE_EMPTY_DIRECTORY` | target=old empty directory; recovery absent | rename target -> recovery, no replace | target absent; recovery=old directory |
| `RENAME_WITHIN_ROOT` | source=old; target absent | no-replace rename source -> target | source absent; target=old |

Parent directory handles/generations and every named entry are part of the
footprint even when one atomic operation changes two directory entries. For
replace, the exchanged staging entry becomes the retained recovery entry; no
second move is needed before commit verification/result. Later recovery cleanup
is a separately journaled action outside commit atomicity.

The backend profile must prove the exact native primitive implements the table
atomically and durably on the bound filesystem. A platform without atomic
exchange cannot support `REPLACE_FILE`; it cannot emulate exchange with two
renames. Cross-parent rename is permitted only when the qualified same-volume
primitive provides one atomic rename and both parent handles are in footprint.

## Exhaustive COMMIT_INTENT recovery predicates

Recovery reopens every footprint entry by handle and evaluates the exact table
below. Each row is mutually exclusive. `old`, `desired`, and `preparedDir` mean
the full pre-recorded stable identity/content/type/metadata records, not a name.

| Kind | Proven no-op after intent | Proven committed after intent |
|---|---|---|
| `CREATE_FILE` | target `ABSENT` and staging=`desired` | target=`desired` and staging `ABSENT` |
| `REPLACE_FILE` | target=`old` and staging=`desired` | target=`desired` and staging=`old` |
| `DELETE_FILE` | target=`old` and recovery `ABSENT` | target `ABSENT` and recovery=`old` |
| `CREATE_DIRECTORY` | target `ABSENT` and staging=`preparedDir` | target=`preparedDir` and staging `ABSENT` |
| `DELETE_EMPTY_DIRECTORY` | target=`old` and recovery `ABSENT` | target `ABSENT` and recovery=`old` |
| `RENAME_WITHIN_ROOT` | source=`old` and target `ABSENT` | source `ABSENT` and target=`old` |

Every no-op row appends `ROLLED_BACK`/`ABORTED` after removing only the exact
protected staging entry where one exists. Every committed row completes parent/
entry durability checks and appends `COMMITTED`. Any other combination—both
old/desired visible in unlisted positions, neither visible, wrong identity,
unexpected recovery/staging, parent generation/volume change, extra footprint
mutation, or observer disagreement—is `OUTCOME_AMBIGUOUS` and blocks the scope.

The component never decides from filename existence alone. Backend-specific
torn-operation handling may only refine an ambiguous platform fault after its
qualified vector proves one of the same final predicates; it cannot add a third
ordinary state or guess commit/no-op.

## Corrected verification properties

Property tests now prove: one plan's complete prepare/commit/recovery/cleanup
namespace footprint equals `NamespaceFootprintV1`; exactly one native atomic
operation linearizes the desired commit; all changed source/target entries and
parents are enumerated; and every post-`COMMIT_INTENT` state matches exactly one
no-op, committed, or ambiguous predicate.

Fault injection covers before/after intent and native operation for all six
kinds, including ordinary pre-operation crash states, same/cross-parent rename,
exchange unavailable, parent metadata races, unexpected staging/recovery, and
each identity substitution. No multi-entry operation is called one-entry.

## Review request

Review only whether this repair replaces the false one-entry invariant with an
exact multi-entry footprint/one-native-operation boundary and supplies exhaustive
mutually exclusive recovery predicates for all six operation kinds. Closure
requires Codex 93+ and 0 failed/security/dissent/questions.

Do not inspect other files, use tools, invoke Opus, implement, mutate a real
repository, use credentials, perform external actions, commit, push, deploy,
publish, edit reports, or close another HP item.
