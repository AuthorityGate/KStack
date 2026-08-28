# R2c6 normative addendum: deterministic pooled reconciliation

- Status: PROPOSED DESIGN-ONLY BUG-FIX ADDENDUM
- Date: 2026-08-28
- Amends: `token-reduction-security-benchmark-2026-08-27-r2c5-three-bug-fixes-addendum.md`
- R2c5 SHA-256: `478da7f004c87b4ef495f397886dd52ab653a1351e2e7433e1ca041df0e3a894`
- Scope: the single independent R2c5 pooled-reconciliation defect only
- Authority: no implementation, activation, provider dispatch, external review, commit, or push

R2c1→R2c5 remain normative except for this exact pooled reconciliation. This
addendum does not reopen any window-specific result, hidden-gold boundary,
algebraic-root rule, or primary/sensitivity precedence.

## 1. Closed inputs and one semantic identity

For exact cache configuration `c`, class `k`, immutable task-cluster `i`, and
three frozen windows ordered `W1<W2<W3`, an **appearance** of pooled semantic
defect identity `d` is a final sealed real-defect row in one window cohort. Its
closed inputs are:

`(c,k,i,w,d,severity,scoreSlot,D,R,sourceLedgerDigest)`.

`severity` is one value in R2c5's closed registry
`CRITICAL>HIGH>MEDIUM>LOW`. `scoreSlot` is an opaque confirmatory response slot
whose A/B3 mapping remains hidden. `D,R` are the window's final sealed binary
credits from R2c1, with `R<=D`; pooled miss labels are `mDET=1-D` and
`mRES=1-R`.

Each window independently completes open discovery, hidden-gold comparison,
semantic fixed point, existence/severity, and D/R labeling. Before destroying
volatile semantic material, its qualified canonicalizer emits a fixed-length
`PooledIdentityCommitmentV1` over the canonical violated invariant, affected
scope, immutable task-cluster key, and campaign reconciliation key. The
commitment contains no candidate prose, severity, D/R label, arm/cache identity,
or gold marker. It is held only by the reconciliation broker and is never fed
to another window's reviewers. Equality joins appearances; inequality never
does. Thus later windows do not import earlier candidates or labels.

An identity with equal commitments must also have matching task/configuration
bindings and a valid equality certificate. A collision, non-transitive alias,
one commitment mapped to incompatible invariant/scope certificates, or any
human/post-score merge request returns `POOLED_IDENTITY_AMBIGUOUS` and fails the
pooled cell. Appearances without proven equality remain distinct identities;
they are not heuristically deduplicated.

## 2. Canonical pooled severity

For the nonempty appearance set `A_d`, define exactly:

`g_pool(d) = max_{x in A_d} severity(x)`

under `CRITICAL>HIGH>MEDIUM>LOW`. The maximum-severity rule is deliberately
conservative, matches R2c1's higher-severity tie rule, prevents a later lower
label from downgrading risk, and assigns the deduplicated identity to exactly
one R2c5 atomic severity denominator. Source severities remain in the ledger.
The identity is not also counted in lower severity strata or derived bands.

Unknown, null, out-of-registry, unsealed, or digest-mismatched severity is not
LOW and cannot be ignored. It returns `POOLED_SOURCE_LEDGER_INVALID`, marks the
pooled output nonqualifying, and produces no D membership or claim.

Window-specific severities and `D_(c,k,w,g)` memberships remain byte-for-byte
unchanged. The maximum exists only in `D_(c,k,pool,g_pool(d))`; pooled success
remains noncurative for every window cell.

## 3. One conservative D/R aggregation

For each nonempty `A_d`, exact cache `c`, and hidden confirmatory score slot
`x`, require one sealed D/R row for every window in which `d` appears. Define:

`mDET_pool(x,d) = max_{w:(w,d) in A_d} (1-D(x,w,d))`

`mRES_pool(x,d) = max(mDET_pool(x,d),
                      max_{w:(w,d) in A_d} (1-R(x,w,d)))`.

Equivalently, **a miss in any defect-bearing replicate is the pooled miss**.
The explicit outer maximum preserves `mRES_pool>=mDET_pool` even under a future
schema migration; current valid source rows already imply it because `R<=D`.
This is the only permitted confirmatory aggregation. Best-window selection,
majority vote, mean-over-windows, last-window precedence, severity-weighted
credit, or reviewer-selected reconciliation is forbidden.

For the identities whose canonical pooled severity is `g`, compute:

`M_DET_pool(x,i,c,g) = sum_d mDET_pool(x,d) / |F_pool(i,c,g)|`

`M_RES_pool(x,i,c,g) = sum_d mRES_pool(x,d) / |F_pool(i,c,g)|`,

where `F_pool(i,c,g)={d:g_pool(d)=g}`. Each deduplicated semantic identity has
equal weight exactly once. After the pooled ledger seals, hidden score slots are
mapped to A/B3 and R2c5's separate pooled `RD_DET` and `RD_RES` calculations use
these fractions and its exact task/class weights.

A legitimate sealed missing/failed/unevaluable shared terminal response must
already carry `D=R=0` under R2c1 and therefore becomes both pooled misses. An
absent row, nonbinary label, `R>D`, extra window, unknown score slot, or source
digest mismatch is corruption, not an observed miss: seal conservative
`mDET=mRES=1` for diagnostics, return `POOLED_SOURCE_LEDGER_INVALID`, and fail
qualification without emitting an estimand or claim.

If `A_d` is empty, `d` does not exist and no zero-observation identity may be
manufactured. If `F_pool(i,c,g)` is empty, task `i` has no fraction or membership
in that severity D set. R2c5's required empty/under-minimum pooled population
fails; an optional absent severity is `NOT_ESTIMABLE`. A task with no valid
pooled identity at any severity enters `Z_(c,k,pool,ANY)` only after exact
recomputation proves all three window final sets empty. Ambiguity or invalid
input never qualifies a task for the zero set.

## 4. Pre-unmask timing and irreversible seal

`PooledReconciliationV1` runs once, deterministically, in this order:

1. Finish and verify all three independent window cohort seals, their R2c5
   hidden-gold state transitions through `TERMINAL`, their raw-gold/material
   destruction proofs, and their closed anonymous identity/severity/D/R rows.
   For this timing rule, hidden-gold terminal scoring means those D/R labels are
   sealed; it neither requires nor permits revealing their A/B3 slot mapping.
2. Freeze a hidden `ScoreSlotMapCommitmentV1`. The trusted broker maps each
   window's independently randomized response alias to one stable opaque slot;
   exactly the committed A and B3 slots are confirmatory-score eligible, but no
   consumer learns which is which. B1/B2 retain R2c4 discovery-only status and
   never enter pooled D/R arithmetic.
3. Join only equal `PooledIdentityCommitmentV1` values, sort all source rows in
   the canonical order below, apply the maximum-severity and any-miss rules,
   recompute D/Z membership, fractions, minima, and exact weights, and generate
   a candidate pooled ledger without revealing arm identities.
4. Two dependency-independent deterministic verifiers recompute the candidate
   from the three sealed window ledgers and broker commitments. They must produce
   byte-identical output and success disposition.
5. Atomically seal `PooledReconciliationLedgerV1`, verify its persistence and
   evidence digest, revoke the reconciliation capability, and destroy temporary
   join/mapping material.
6. Only after step 5 succeeds may the broker reveal which sealed score slot is
   A and which is B3 for confirmatory pooled and window-specific arithmetic.

No A/B3 map, arm name, provider hint, token result, savings result, or partial
quality score may be available to the canonicalizer, reconciliation broker's
decision function, or either verifier before the pooled seal. The broker may
perform only committed alias routing and the specified deterministic transform;
it has no severity, identity, or label discretion.

An early arm-map access, map-commitment mismatch, unsealed window, failed source
destruction proof, post-seal source mutation, verifier byte disagreement,
reconciliation crash, seal failure, or temporary-material destruction failure
returns `POOLED_RECONCILIATION_FAILED`. Every pooled cell for the exact
configuration fails. Window results remain recorded with their original
dispositions but cannot activate because the required pooled gate failed. There
is no owner waiver, local repair, or post-unmask recomputation; a qualifying
result requires a new prospective three-window campaign.

## 5. Bound ledger and canonical bytes

`PooledReconciliationLedgerV1` binds at minimum:

- the complete R2c1→R2c6 normative-chain digests, `BenchmarkConfigurationV2`,
  corpus/sampling-frame, exact cache, class, task-cluster, window-order, gold,
  rubric, severity registry/order, and reconciliation-algorithm digests;
- all three window cohort/final-label/destruction-proof digests and each closed
  source row's window, semantic commitment, canonical defect ID, source severity,
  opaque score slot, D, R, reviewer/tie code, and source-ledger digest;
- `ScoreSlotMapCommitmentV1`, the exact hidden eligible-slot count, identity
  equality/collision certificates, source-row cardinality, and every exclusion
  or terminal error code;
- for every deduplicated identity: ordered appearances, `g_pool`, each eligible
  slot's source misses, `mDET_pool`, `mRES_pool`, and exact inclusion reason;
- exact `F_pool`, severity-indexed D/Z memberships, cardinalities, minima,
  per-identity fractions, task/class weights, and independent rational-sum
  recomputation for detection and resolution separately; and
- canonical serialization/version, both verifier digests, seal/destruction
  evidence, pre-unmask state proof, final ledger digest, and later arm-map reveal
  digest as a separate append-only child record.

Canonical serialization is UTF-8 JSON with no BOM or insignificant whitespace,
object keys sorted by Unicode code point, arrays retained only where order is
normative, lowercase hexadecimal digests, uppercase enum values, integers for
binary labels, and one trailing LF byte. Windows sort `W1,W2,W3`; then rows sort
by `(cache,class,task,identity,window,scoreSlot)`, each component compared as
unsigned UTF-8 bytes. Duplicate sort keys, locale collation, numeric coercion,
Unicode normalization at serialization time, unknown fields, or a missing final
LF fails canonicalization. Human renderings have no digest authority.

## 6. Byte-identical conformance vectors

The following vectors are mandatory for the producer and both independent
verifiers.

### 6.1 Conflicting severity and outcomes

One identity `d1` appears in all three windows with severities LOW, HIGH, and
MEDIUM. Its canonical pooled severity is HIGH. Opaque slot `s01` has detection
misses `0,0,1` and resolution misses `0,1,1`, so its pooled result is `(1,1)`.
Slot `s02` has `(0,0)` in every window, so its pooled result is `(0,0)`.

The exact canonical conformance-fragment bytes, including the final LF after
the closing brace, are:

```json
{"appearances":[{"mDet":{"s01":0,"s02":0},"mRes":{"s01":0,"s02":0},"severity":"LOW","window":"W1"},{"mDet":{"s01":0,"s02":0},"mRes":{"s01":1,"s02":0},"severity":"HIGH","window":"W2"},{"mDet":{"s01":1,"s02":0},"mRes":{"s01":1,"s02":0},"severity":"MEDIUM","window":"W3"}],"cache":"COLD","class":"K1","identity":"d1","pooled":{"mDet":{"s01":1,"s02":0},"mRes":{"s01":1,"s02":0},"severity":"HIGH"},"task":"t1"}
```

It is exactly 406 bytes and has SHA-256
`b97d2ab5b2333ca167f977bb9389e4916b5d5cb712038285264a65cc910e026d`.
Changing appearance order, selecting MEDIUM/LOW, averaging to a fractional
miss, dropping the LF, or serializing a boolean instead of integer must produce
a different digest and fail the vector.

### 6.2 Denominator and invariant vectors

1. Identity `dH` appears as HIGH in W1/W2 and CRITICAL in W3; identity `dL`
   appears as LOW only in W2. The pooled CRITICAL and LOW denominators are each
   one; HIGH is empty. `dH` is never counted twice or retained in HIGH.
2. For two LOW identities, slot `s01` results `(mDET,mRES)=(1,1)` and `(0,1)`.
   Therefore `M_DET=1/2` and `M_RES=1`; substituting a window mean or defect
   count weight fails exact recomputation.
3. Window W2 has a legitimate failed response sealed `D=R=0`; other windows
   have `D=R=1`. The pooled result is `(1,1)` without invalidating the source.
   If W2's row is absent rather than explicitly sealed, the diagnostic is
   `(1,1)` but the disposition is `POOLED_SOURCE_LEDGER_INVALID` and no claim.
4. A source row `D=0,R=1`, null severity, extra W4, or unknown slot fails the
   full pooled configuration. No repair or coerced qualifying label is allowed.
5. Two unequal identity commitments that a human thinks are similar remain two
   defects. Equal commitments with incompatible equality certificates fail as
   `POOLED_IDENTITY_AMBIGUOUS`; they are neither merged nor admitted to Z.
6. An empty severity set has no `0/0` fraction. Required is failure, optional is
   `NOT_ESTIMABLE`. Only a task proven empty in every final window set enters
   pooled `Z_ANY`.
7. Revealing A/B3 before the final pooled seal, changing a sealed window label,
   or verifier output differing by one byte returns
   `POOLED_RECONCILIATION_FAILED` and requires a new three-window campaign.
8. Re-run the same sealed inputs in reversed filesystem iteration order,
   different locale/timezone, and both verifier implementations. The final
   canonical ledger and disposition must be byte-identical.

## 7. Precedence and self-assessment

This addendum replaces only R2c5's underspecified phrase that a pooled task
fraction uses deduplicated severity-`g` identities across three window
replicates. It supplies the cross-window identity join, maximum pooled severity,
per-slot any-miss aggregation, pre-unmask timing, terminal behavior, ledger, and
canonical bytes. R2c5's window-specific severity sets, independent D/R outcomes,
hidden-gold one-way state machine, exact algebraic interval, and every earlier
noncurative activation gate remain controlling.

Self-review checked the independent finding against the eight conformance
families:

- every pooled identity has one deterministic highest severity and appears in
  one atomic denominator only;
- every eligible hidden score slot uses one explicit any-miss D/R rule, with
  resolution no better than detection and no best-window selection;
- reconciliation completes from sealed closed inputs before A/B3 reveal, with
  invalid/ambiguous/zero behavior and campaign restart defined; and
- producer and two verifiers bind complete source/output evidence and must
  reproduce the exact canonical bytes and digest.

Open implementation/qualification work:

1. Implement qualified pooled identity commitments and the isolated alias/
   score-slot reconciliation broker without exposing data to later reviewers.
2. Implement the deterministic ledger, two independent verifiers, canonical
   serializer, seal/destruction checks, and all conformance vectors.
3. Re-run every exact-cache/class/window and pooled gate in a fresh complete
   three-window qualification campaign.

- Design-readiness self-score for the single R2c6 fix: **98/100**.
- Independent reviewer score for this addendum: **not run**.
- Known unresolved design defects within the one-item scope: **zero identified**.
- Open implementation/qualification items: **three, listed above**.

This addendum changes no runtime. It does not establish measured savings,
provider qualification, activation, production/private-data coverage, or
credential-repository safety.
