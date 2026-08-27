# HB-TC05 design candidate: OpenCode executed conformance

**Thread:** `host-breadth-option-selection-2026-08-26`
**Item:** `HB-TC05` only
**Status:** local design candidate; no conformance execution or support claim
**Architecture:** locked Option C with non-copy constraint
**Review route:** Codex only; closure requires 93+ and all four finding arrays empty

## Exact boundary

Define the later executed-conformance protocol for one exact OpenCode build and
one exact KStack active set. Qualification is per registered operation profile,
never per host. This design cannot run or promote any operation until every
named Host Portability prerequisite is implemented, independently validated,
active, and current.

This item does not implement an adapter, install/configure OpenCode, execute a
host, use credentials, create an approval, perform a side effect, or claim that
OpenCode is supported. A clean design review means only that the future test
protocol is constructible.

## Frozen inputs

| Input | Digest/status | Permitted use |
|---|---|---|
| HB-TC01 canonical package | cumulative packet `35e78d77bf8512b5d8699965b29e853d9d21477b4da5cabb68f7afaaabbece0c`; validated design only | Exact source/package/clause identity; never authority |
| HB-TC02 transactional installer | cumulative packet `1a6584834d5b630a70d90bb031b3582b69e0b844b4f66ad2e9435cbfdb5be128`; validated design only | Future typed installation evidence; never assumed implemented |
| HB-TC03 OpenCode instruction candidate | cumulative packet `df1cd2d2e5fdcf5e2155c24316265187581d76510a198c6721fb81fb82d48c28`; validated design only | Candidate instruction/discovery fixture; maximum claim remains no operation qualification |
| HB-TC04 bounded MCP facade | final delta `0d66619a18150a3234353ca36cec4addaab1e3720bae55b172c7e7b1fa91ec7c`; validated design only | Public diagnostic resource fixture; never evidence/authority |
| HP-TC07 broker requirement | final digest `001bfa681d1f53925f8e087aa24f4f9fc666a9ceaf50ddfe6ea43b0f00c8ba66`; validated design only | Structural prerequisite for ask/privileged profiles; implementation still required |
| HP-TC01 through HP-TC12 ledger | open except HP-TC07 design | Hard dependency source; no open row is inferred closed |

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Use the already selected, zero-upstream-byte
HB-TC01 parameterized-test and host-registry patterns, then build KStack-native
independent observers, protected evidence admission, negative fixtures,
operation-level status, and no-promotion controls. No new gstack source or
bytes are admitted: gstack's useful test fan-out pattern lacks the KStack trust,
receipt, bypass, and per-operation qualification semantics required here.

## Dependency gate

`ConformanceDependencyGateV1` is a closed, content-addressed object binding
`schemaId`, `schemaVersion`, exact HP item ID, required implementation digest,
required validation receipt digest, active-set membership proof digest,
currentness evidence digest, status, and reason code. Status is exactly
`SATISFIED|MISSING|STALE|MISMATCH|NOT_IMPLEMENTED`.

Before a test plan can enter `EXECUTABLE`, the protected component validates a
duplicate-free gate row for every required HP item and requires every row to be
`SATISFIED`. A design-only record, review score, HB candidate state, MCP output,
host manifest, model statement, or adapter declaration cannot satisfy a row.
Any later digest/currentness change invalidates the plan before the next test.

The base dependency set for every operation is HP-TC01 schemas, HP-TC02 trusted
context, HP-TC03 replay/time, HP-TC04 evidence trust, HP-TC05 eligibility,
HP-TC06 independent harness, and HP-TC11 active-set lease/fencing. Additional
requirements are exact:

| Operation family | Additional required items |
|---|---|
| Agent Skill discovery/load and advisory response | none beyond base; HB-TC01/HB-TC03 package evidence required separately |
| HB-TC04 public MCP list/read | HP-TC09 public unauthenticated output boundary, implemented without identity promotion |
| Repository local write | HP-TC08 race-resistant mutation and HP-TC12 reversible activation seam |
| Ask-tier reviewer dispatch | HP-TC07 protected broker, HP-TC09 principal/output boundary, HP-TC10 receipt trust, HP-TC12 rollback/recovery seam |
| Privileged Git/release operation | HP-TC07, HP-TC08 where local mutation occurs, HP-TC09, HP-TC10, HP-TC12 |
| Background/wait operation | HP-TC03 replay/time plus HP-TC11 session/lease cancellation evidence |

Missing dependencies affect only the named operation family. They never become
a reason to weaken, emulate, skip, or mark a fixture passed.

## Closed plan and environment binding

`OpenCodeConformancePlanV1` is RFC-8785/domain-addressed and contains exactly:

```text
schemaId, schemaVersion, hostId="opencode", runningHostBuildDigest,
hostExecutableIdentityDigest, adapterDigest, activeSetDigest, policyDigest,
registrySetDigest, operationProfileDigest, dependencyGateSetDigest,
environmentMeasurementProfileDigest, harnessDigest, observerSetDigest,
fixtureSetDigest, bypassInventoryDigest, isolationTargetDigest,
sideEffectBudgetDigest, authoritativeClockDigest, plannedAt, expiresAt
```

All digests resolve exactly once under the active HP-TC01 schema set. The
running process identity, executable bytes, OpenCode version/build, platform,
native permission mode, auto/session modes, config, plugins, custom tools,
subagents, MCP endpoints, tool registry, roots, shells, formatters/LSP hooks,
environment, adapter, and KStack active set are remeasured immediately before
each fixture group. A change closes the group as `ENVIRONMENT_CHANGED`; no
prior result carries forward.

One plan names exactly one operation profile. Shared fixture definitions may be
content-addressed once, but execution records/results cannot be reused across
operation profiles, host builds, platforms, active sets, policies, adapters,
environments, or isolation targets.

## Independent harness and observer ownership

The harness runs outside the adapter/model process under the protected HP-Q1
component. The adapter under test receives only bounded fixture inputs and
cannot write the expected result, observer state, evidence ledger, clock,
active pointer, signing key, or final verdict.

Each fixture names at least one independent observer:

- descriptor/inode/file-identity observer for filesystem reads/writes;
- broker sentinel and fake provider for approval/credential/side-effect paths;
- loopback-deny/network double for egress attempts;
- process tree, descriptor, deadline, cancellation, and orphan observer;
- exact stdout/stderr/MCP frame collector with hostile-output bounds;
- protected user-visible approval capture for ask-tier scope equality; or
- producer-authentic fake-provider receipt/reconciliation observer.

An adapter result is diagnostic only and is compared with observer truth. A
missing, unavailable, crashed, contradicted, writable-by-subject, or stale
observer yields `HARNESS_ERROR` or `AMBIGUOUS`, never `PASS`.

The harness has no production credential or production endpoint. Read/advisory
fixtures use disposable repositories containing synthetic public/non-secret
data. Write fixtures use disposable handle-verified roots. Ask/privileged
fixtures use a fake protected broker and idempotent fake providers unless the
owner later approves a separate disposable external target. No such approval
is included here.

## Fixture record and state machine

`ConformanceFixtureV1` is closed and binds exactly fixture ID, operation profile,
precondition digest, input artifacts, expected native event sequence, expected
KStack decision, independent observer expectations, maximum permitted side
effects, deadline, cleanup contract, and stable failure code set.

`ConformanceExecutionV1` moves only:

```text
DECLARED -> DEPENDENCIES_SATISFIED -> ENVIRONMENT_BOUND -> RUNNING
RUNNING -> PASS | FAIL | NOT_RUN | CAPABILITY_UNAVAILABLE | HARNESS_ERROR | AMBIGUOUS
```

Only the protected harness writes transitions. `PASS` requires all positive and
negative expectations, exact event order, observer agreement, byte/output
bounds, zero forbidden side effects, and completed cleanup. Timeout, crash,
cancel-after-possible-action, missing receipt, or lost response cannot become
`FAIL` if action outcome is unknown; it becomes `AMBIGUOUS` and requires the
operation's registered reconciliation path. Skipped, flaky, unavailable, and
retried-until-green executions are never passes.

## Required fixture groups

Every selected operation profile carries only applicable groups, but every
registered requirement and bypass inventory row maps to at least one positive
and one negative fixture.

1. **Identity/currentness:** exact process/build/config/adapter/platform/root;
   changed executable, running process, config, plugin, tool registry, mode,
   policy, or active set invalidates before verdict.
2. **Instruction package:** exact HB-TC01 package/member/clause digests,
   duplicate-discovery precedence, challenge-clause treatment/control,
   unsupported stub, stale install, alternate root, and source/output drift.
   Loading proves discovery only.
3. **Public MCP facade:** exact protocol/capability absence, snapshot-scoped
   resource URIs, forged/expired/cross-repository lease tokens, list/read
   consistency, output redaction, frame exhaustion, stdout purity, no write,
   no network, and no downstream promotion.
4. **Workspace:** traversal, symlink/reparse, mount, case alias, worktree,
   alternate root, parent replacement, concurrent rename, and rollback/cleanup.
5. **Native permissions:** allow/ask/deny, auto mode, remembered approvals,
   compound commands, shells/wrappers, custom tools, plugins, subagents, user
   MCP, external roots, formatter/LSP, and background tasks. An unobserved
   equivalent bypass blocks only affected profiles.
6. **Approval/broker:** exact displayed envelope, principal/session/root,
   active set, policy, operation schema/profile, inputs, limits, nonce,
   audience, expiry, denial, cancellation, credential non-export, direct-
   execution bypass, and one-action use.
7. **Receipt/ambiguity:** provider success/failure, response loss, duplicate
   request, crash before/after action, conflicting receipt, reconciliation,
   and prohibition on blind retry.
8. **Background lifecycle:** parent death, cancellation, deadline, output cap,
   descendant-held descriptors, orphan detection, session ownership, and
   fencing on current-policy/evidence change.
9. **Hostile data:** prompt injection, invalid Unicode, duplicate JSON keys,
   secret/path/exception strings, oversized/deep data, and diagnostic escaping.
10. **Preservation:** the same registered profile/fixture produces the defined
    normalized equivalent on preserved Codex and Claude baselines; a baseline
    regression blocks shared activation but does not falsify OpenCode evidence.

## Aggregation and claims

`ConformanceEvidenceSetV1` binds the exact plan, every expected fixture ID,
every execution digest, independent observer receipts, start/end/currentness
measurements, cleanup evidence, and shortest expiry. Fixture membership is a
set equality check against the registered operation profile—missing, extra,
duplicate, alternate-version, or superseded results reject the set.

The protected eligibility component, never the adapter or model, may derive:

- `FULL` only when the exact full registered profile and all mandatory positive
  and negative fixtures pass;
- one named `DEGRADED_REGISTERED` status only when that pre-registered alternate
  profile independently passes in full;
- `QUARANTINED` when formerly eligible evidence is revoked, contradicted, or
  drifts; or
- `UNSUPPORTED` otherwise.

Status output always names operation ID/profile, exact OpenCode build, adapter,
platform, active set, policy, evidence/fixture/observer digests, expiry, missing
requirements, bypasses, and reason codes. It never says “OpenCode supported”
without enumerating operations. Instruction discovery or successful public MCP
reads never grant write, ask-tier, privileged, background, or private-resource
support.

Publishing or activating evidence is outside this design. Until implementation
and real execution exist, every OpenCode operation remains unqualified.

## Failure recovery and reproducibility

Each run uses a new disposable target and attempt ID. Cleanup is independently
observed; cleanup failure is retained and blocks the fixture. A failed or
ambiguous run is immutable. A rerun creates a new attempt and cannot erase the
old record; deterministic selection rules in HP-TC04/05 decide whether any set
is admissible.

The complete input closure—OpenCode executable/build, KStack components,
schemas, registries, adapter, harness, observers, fixtures, fake providers,
platform image, and configuration—is content-addressed. Reproduction on a
different machine is new evidence; equivalence is not inferred from matching
version text.

## Verification of the conformance system

Before any real qualification, mutation tests prove the harness rejects one-
field changes in every binding, missing/extra fixtures, subject-written
observer output, stale time, forged receipts, cleanup omissions, environment
drift, and status promotion. Deliberately defective reference adapters exercise
every fixture group's failure path. Cross-runtime vectors prove exact evidence
bytes and eligibility inputs; secret scans and confinement tests prove no
credential/model/user data enters durable evidence.

## Review request

Review HB-TC05 only for a constructible, independently observed, per-operation
OpenCode conformance protocol whose unsatisfied HP dependencies fail closed and
whose outputs cannot promote support prematurely. Closure requires Codex 93+
and empty failed, security, dissent, and question arrays.

Do not review HB-TC06, reopen predecessors, invoke Opus, use tools, inspect/edit
files, implement, install/configure/run OpenCode, use credentials, perform an
external side effect, commit, push, deploy, publish, or edit reports.
