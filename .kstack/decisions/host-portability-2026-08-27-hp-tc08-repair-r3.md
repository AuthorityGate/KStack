# HP-TC08 round-3 repair: crash-idempotent no-op cleanup

**Prior packet:** `f716e18cc0d3ead3b171023e19b932b67f6af4ab48b450ad79bc564f96b98c2f`
**Prior result:** Codex 98 revise; 1 failed / 1 medium security /
1 dissent / 1 question; output `cb0168b16fa947b98fa735b4a428e65476cc44801259ddb85fdfda7a2306be49`
**Item/boundary:** HP-TC08 only; the R2 namespace footprints, one-native-
operation commits, six initial outcome predicates, and every other clause remain
frozen

## Exact defect

R2 allowed recovery to remove a protected staging entry before durably recording
the known no-op outcome. A crash in that gap converts a proven no-op into an
unrecognized footprint. Cleanup is now a separately journaled, restartable phase
that begins only after the terminal abort outcome is durable.

## Terminal-before-cleanup rule

When a `COMMIT_INTENT` footprint matches one R2 proven-no-op predicate, recovery
first durably appends `ABORTED` with the operation ID, kind, complete bound
footprint digest, no-op predicate ID, verified identities, and trusted evidence.
`ABORTED` is the terminal user-visible outcome and proves the commit operation
did not occur. No staging/recovery entry is removed before its durability barrier
completes. `DELETE_FILE`, `DELETE_EMPTY_DIRECTORY`, and
`RENAME_WITHIN_ROOT` require no no-op cleanup and end there.

For `CREATE_FILE`, `REPLACE_FILE`, and `CREATE_DIRECTORY`, cleanup is a separate
protected sequence:

```text
ABORTED -> CLEANUP_INTENT -> CLEANED
```

`CleanupIntentV1` binds the terminal `ABORTED` record, exact staging entry stable
identity/type/content, target/source/parent identities and expected post-abort
state, permitted removal primitive, durability barrier, and cleanup sequence.
The protected component durably appends `CLEANUP_INTENT` before removing the
staging entry, then removes only that bound agent-inaccessible entry, verifies
the unchanged target/source/parents and staging absence, executes the bound
durability barrier, and appends `CLEANED`. Cleanup cannot alter the terminal
operation outcome or make the operation retryable.

## Closed restart predicates

Recovery authenticates the terminal record, cleanup intent, and complete
footprint, then applies exactly one predicate:

| Durable state | Namespace predicate | Recovery action |
|---|---|---|
| `ABORTED`, no cleanup intent | original no-op footprint including exact staging identity | append durable `CLEANUP_INTENT`; do not remove yet |
| `CLEANUP_INTENT` | original no-op footprint including exact staging identity | remove only bound staging entry, verify/barrier, append `CLEANED` |
| `CLEANUP_INTENT` | exact expected target/source/parents unchanged and staging absent | cleanup removal occurred; verify/barrier and append `CLEANED` |
| `CLEANED` | exact expected target/source/parents unchanged and staging absent | terminal; no action |

These rows apply independently to each of `CREATE_FILE`, `REPLACE_FILE`, and
`CREATE_DIRECTORY` using its R2 no-op identities. Any other combination—staging
identity substitution, unexpected absence before cleanup intent, staging still
present after `CLEANED`, target/source/parent change, extra footprint mutation,
wrong sequence, missing terminal record, or conflicting journal state—is
`OUTCOME_AMBIGUOUS` and blocks the scope. It never reruns the user commit.

Cleanup retry is idempotent only within the authenticated `CLEANUP_INTENT` row.
An absent staging entry there means the exact bound removal may have completed;
it is accepted only when every other footprint identity still equals the bound
post-abort state. Filename absence alone remains insufficient.

## Corrected verification properties

Fault injection crashes before/after the `ABORTED` append and barrier,
`CLEANUP_INTENT` append and barrier, staging removal, namespace durability
barrier, verification, and `CLEANED` append for each applicable operation kind.
Restart must match exactly one row and converge without changing the outcome.

Mutation tests reorder terminal recording and deletion, omit each barrier,
remove the cleanup intent, change every identity, and substitute/move/recreate
staging. Properties prove a known no-op is durable before cleanup, every cleanup
intermediate has one restart predicate, cleanup cannot execute the commit, and
an unknown intermediate blocks rather than guesses.

## Review request

Review only whether this repair makes R2 no-op cleanup crash-idempotent by
durably recording the terminal abort and cleanup intent before deletion and by
closing every cleanup restart state. Closure requires Codex 93+ and
0 failed/security/dissent/questions.

Do not inspect other files, use tools, invoke Opus, implement, mutate a real
repository, use credentials, perform external actions, commit, push, deploy,
publish, edit reports, or close another HP item.
