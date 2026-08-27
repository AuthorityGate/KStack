# Reuse-first integration design review evidence

**Decision ID:** `REUSE-FIRST-GATE-INTEGRATION-2026-08-26`  
**Scope:** design review only  
**Implementation status:** **NOT IMPLEMENTED**  
**Route:** configured OpenAI Codex only; Claude Opus excluded  
**Closure rule:** confidence >=93 and zero failed checks, security findings,
material dissent, unresolved questions, and design-changing strongest objection

## Round ledger

| Round | Candidate SHA-256 | Decision | Confidence | Failed | Security | Dissent | Questions | Duration |
|---|---|---|---:|---:|---:|---:|---:|---|
| R1 | `13e3b1c7964090384dea9de67afd7c297ac7908667f3b50bd8abc2790785b490` | `revise` | 98 | 6 | 3 | 1 | 2 | `236989 ms` orchestration-observed; provider-native duration was not emitted |
| R2 | `d3e9eb327fe0d0b467ef0ed6778c29069e9799ae887fafd479d353ba17fb8d6c` | `revise` | 99 | 6 | 2 | 1 | 0 | `338342 ms` orchestration-observed; provider-native duration was not emitted |
| R3 | `8594e4aa07ec579b942bcb2c5f96715fd88a24890a28e5e3aa407b81b58241ab` | `revise` | 99 | 7 | 2 | 0 | 0 | `415557 ms` orchestration-observed; provider-native duration was not emitted |
| R4 | `b5570410c9cd98d07765d0984d980301c042ee7c18a0034834fd7c5a1da4074e` | `revise` | 99 | 6 | 1 | 0 | 0 | unavailable; root-bridged output emitted no provider-native duration and polling intervals cannot establish exact runtime |
| R5 | `7ec723b4479fbf61207f0b458731394143071e3ba289e5a15da4144d523cc4d5` | `approve` | 98 | 0 | 0 | 0 | 0 | unavailable; root-bridged output emitted no provider-native duration and polling intervals cannot establish exact runtime |

R1–R4 did not close despite confidence 98, 99, 99, and 99 because the all-zero
conditions failed.
The two unresolved questions were caused by the approved R1 export containing
only the exact candidate and decision brief; the referenced normative and
inspected implementation bytes were not present in the isolated review root.

## R1 concrete corrections

The R2 candidate, SHA-256
`d3e9eb327fe0d0b467ef0ed6778c29069e9799ae887fafd479d353ba17fb8d6c`,
applies only the R1 findings while preserving the selected architecture:

1. adds stable capability generations and deterministic supersession from
   satisfied, not-applicable, and every other evidence-bearing state;
2. adds exhaustive stale recovery, including mandatory abort/reconciliation
   before superseding an active qualification;
3. adds an atomic `reserve-attempt` operation, exact ordinal/readback binding,
   active-lease handling, and a frozen non-renewable lifetime cap;
4. adds the complete stage-by-migration-class matrix;
5. separates live predicates from historical evidence so unrelated frozen
   work cannot stale a capability;
6. defines canonical JSON, closed reusable types, payload invariants, manifest
   bounds, and the stable reason-code set;
7. requires descriptor/handle-relative no-follow traversal, identity
   revalidation, atomic no-replace publication, and fail-closed platform
   qualification;
8. confines `--out` to absent targets in the capability results tree; and
9. adds adversarial behavioral fixtures for each correction.

## R2 concrete corrections

The R3 candidate, SHA-256
`8594e4aa07ec579b942bcb2c5f96715fd88a24890a28e5e3aa407b81b58241ab`,
applies only the R2 findings while preserving the selected architecture:

1. makes exact-equivalence satisfied reachable only in a later generation and
   routes every material/uncertain refresh to required;
2. makes physical attempt ordinal/cap cumulative across every selection in one
   generation;
3. supplies closed primitive, nested, and per-state payload contracts, all
   eight materiality floors, timestamps, bounds, nullability, and a single
   reject-noncanonical rule;
4. adds closed chain/migration result variants plus mandatory grandfathered
   lineage comparisons;
5. snapshots historical bytes into immutable content-addressed retained
   objects independent of mutable source paths;
6. replaces event-ID final paths and an unspecified lock with one fixed
   sequence target and shared no-replace publication primitive; and
7. specifies the audited native helper boundary and exact Linux, macOS/BSD,
   Windows, ownership/ACL, link-count, filesystem, and fail-closed rules.

## R3 concrete corrections

The R4 candidate, SHA-256
`b5570410c9cd98d07765d0984d980301c042ee7c18a0034834fd7c5a1da4074e`,
applies only the R3 findings while preserving the selected architecture:

1. carries one stable selection anchor through every satisfied generation and
   proves the unbroken generation-by-generation equivalence chain;
2. gives every first-record binding source plus immutable retained identity,
   with validation mode mechanically derived from chain position;
3. freezes both ordinary and lifetime attempt budgets in the first required
   event and rejects later config drift;
4. makes `GateResult` an exhaustive closed chain/migration/failure tagged
   union, including malformed or missing-state failures;
5. partitions every stage predicate exhaustively between chain and migration
   and makes it identical to the migration matrix;
6. defines named closed lineage identity fields and recomputes their exact
   equality instead of trusting generic comparison sets; and
7. caps the six-digit event sequence at 999999 and binds an audited native I/O
   helper to exact hash-qualified platform profiles that deny unsupported
   network, 9p, FUSE, and userspace filesystems.

R4 was dispatched by the root session from the explicitly approved exact
18-file isolated bundle after two subagent activations were rejected before
egress. Its ignored raw structured result is
`.kstack/reviews/reuse-first-gate-integration-2026-08-27-r4/codex.md`, SHA-256
`7a5d446840cbfe18a5afbe8d62d0afe7cc4de93daf641db8228e914085e13330`.
It reported one high-severity security finding in the same surface as failed
check 6.

## R4 concrete corrections

The R5 candidate, SHA-256
`7ec723b4479fbf61207f0b458731394143071e3ba289e5a15da4144d523cc4d5`,
applies only the R4 findings while preserving the selected architecture:

1. separates the terminal supersession event from the pre-supersession
   equivalence head and binds both through every satisfied-generation hop;
2. classifies migration receipt/prior bindings as retained-only and
   current/change/live-predicate bindings as source-plus-retained;
3. makes the first required event the sole frozen-budget carrier and derives
   both values by chain traversal for every later operation;
4. encodes unknown-stage failure with exact nullability and sources migration
   threadId only from the closed receipt schema;
5. establishes one normative stage-by-kind table, including qualified-baseline
   production design/review and identical baseline approved-design checks; and
6. compares complete canonical lineage objects/sets and recomputes all eight
   floors from named security, license, cost, migration, qualification,
   review, approval, owner-selection, and other identity inputs.

## Current state

R5 is **CLOSED — CODEX-QUALIFIED DESIGN**. The root session dispatched the
explicitly approved exact 18-file isolated bundle. The decision brief at
`.kstack/reviews/reuse-first-gate-integration-2026-08-27-r5/decision-brief.md`,
SHA-256
`d433caafc03701d4726f2a5b6b8fa453efb8565dece420d5da0ec46ebc349082`,
declares candidate SHA-256
`7ec723b4479fbf61207f0b458731394143071e3ba289e5a15da4144d523cc4d5`
and size `71523` bytes; both values match the reviewed local candidate.

The ignored structured result at
`.kstack/reviews/reuse-first-gate-integration-2026-08-27-r5/codex.md`, SHA-256
`19194006d9561aaf912ac2eee387934ab38a72cfef4f9e9b77d3d1550692b7a2`,
returns `approve` at confidence 98 with zero failed checks, security findings,
material dissent, and unresolved questions. Its strongest objection is exactly
`None.` The complete closure rule is therefore satisfied.

The exact final design digest promoted by this record is
`7ec723b4479fbf61207f0b458731394143071e3ba289e5a15da4144d523cc4d5`.
The reviewed candidate header remains unchanged because editing reviewed bytes
would create a new digest; this closure ledger is the promotion authority. The
design is eligible for a separate owner-authorized implementation plan, but it
is still **NOT IMPLEMENTED** and this record authorizes no implementation,
staging, commit, push, report edit, deployment, Jira mutation, or other
external write.

Any later candidate-byte correction reopens review, requires a new digest-bound
round row, and cannot inherit R5 approval.
