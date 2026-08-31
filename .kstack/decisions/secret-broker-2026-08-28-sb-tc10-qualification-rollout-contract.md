# KStack Secret Broker — SB-TC10 qualification and rollout contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC10` — cross-platform qualification, adversarial evidence, synthetic fixtures, performance/resource bounds, rollout, and production promotion |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC04 `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925`; SB-TC05 `57f18fcbb172327ef85ea3e56be8fa29f7e40be233b8c884223fc793158e1d3d`; SB-TC06 `62e7863ff75922922d3b26bea25fd2aa7e8615d1c18a6d9412275d50d06b2e71`; SB-TC07 `6635aa11e3769c33541a0807fdedd7d497ae7274f01054d2ee9e83703a4d5a4b`; SB-TC08 `d15fdce75567e4dbb7d5e7400ae48aca21749a7d817f703d0947beb6b3ba966d`; SB-TC09 `f76640aabb05ae2af4288fcd7e06c6183f74edcdbe59e133c031882d95727137` |

## 1. Decision requested

Freeze the evidence model that determines what the Secret Broker may claim on
one exact host/platform/backend/adapter/target cell, the adversarial suite that
falsifies those claims, the resource envelope in which it must fail closed,
and the only path from disabled build to production use.

Qualification is a measured result, not a property of an installed name. It
does not repair a failed mechanism design, transfer between cells, authorize a
real effect, or make a production decision automatically.

## 2. Non-compensating rules

1. Every required test is a gate. A high score, low-risk waiver, documentation
   claim, static scan, clean benchmark, or success on another cell cannot
   compensate for one failure, skip, unknown result, or missing positive
   control.
2. Evidence attaches to a canonical exact cell and frozen contract digests.
   No evidence transfers across host, host version/mode, plugin, OS build,
   architecture, runtime, backend instance/configuration, adapter, target/API,
   injection route, containment profile, audit configuration, recovery profile,
   deployment mode, or policy/resource envelope.
3. Synthetic tests use newly generated non-production credentials and isolated
   targets only. Production values, provider entries, audit records, pasted
   values, and protected sources are never test fixtures, leak-detector oracles,
   corpus material, screenshots, or review evidence.
4. Real-entry pilot work is separately owner-authorized under SB-TC03/SB-TC08,
   retains its source, uses the production control plane, and proves only the
   bound cell and operation. It is not penetration testing authority.
5. Test infrastructure is outside the trusted runtime. It may inject a
   synthetic fixture into an isolated cell, but cannot ship in production,
   mint an approval/lease, weaken output suppression, or receive a real value.
6. Evidence contains closed case IDs, results, non-secret artifact/configuration
   digests, safe resource counters, and protected opaque references only. Raw
   output, traces, dumps, packets, provider/audit bodies, paths, identities,
   endpoints, labels, timing traces, and secret-derived material never enter a
   repository, Jira, review, receipt, or support artifact.
7. `PASS` means the expected invariant and both positive/negative controls were
   observed. `SKIP`, `NOT_APPLICABLE`, infrastructure loss, incomplete capture,
   cleanup uncertainty, or missing observation is `BLOCKED`, never pass.
8. Qualification can only stay equal or regress. Promotion is a new signed
   operator decision; automation may revoke or expire a claim but cannot
   promote one.
9. A kill switch stops new preparation and contact, burns claimed one-use
   authority as required, preserves custody/audit/reconciliation state, and
   never rolls back a secret generation or retries an ambiguous effect.
10. The only v1 production backend family is independently qualified
    `openbao-v1`. Windows DPAPI, Linux Secret Service, macOS Keychain, test
    doubles, local files, and development servers cannot reach
    `PRODUCTION_APPROVED` under this contract.
11. This repository keeps WSL as the sole Jira credential/executor. Native
    Windows Jira uses the credential-free Windows-to-WSL handoff; SB-TC10 never
    enrolls, copies, or qualifies a second Windows Jira credential.

## 3. Exact qualification cell

```text
secret-qualification-cell-v1 = {
  schemaVersion: "kstack-secret-qualification-cell-v1",
  contractDigests: exact-map-SB-TC00-through-SB-TC10-v1,
  kstackArtifactSetDigest: digest-v1,
  pluginVersion: semantic-version-v1,
  pluginConfigurationDigest: digest-v1,
  hostFamily: "CLAUDE_CODE" | "CODEX",
  hostVersion: exact-version-v1,
  hostExecutionMode: registry-id-v1,
  hostToolSchemaDigest: digest-v1,
  osFamily: "WINDOWS_NATIVE" | "WSL" | "LINUX_DESKTOP" |
            "LINUX_HEADLESS" | "MACOS",
  osBuild: exact-build-v1,
  architecture: registry-id-v1,
  runtimeClosureDigest: digest-v1,
  backendFamily: "OS_LOCAL" | "OPENBAO",
  backendVersion: exact-version-v1,
  backendInstanceRef: protected-opaque-ref-v1,
  backendConfigurationDigest: digest-v1,
  bootstrapProfileDigest: digest-v1,
  adapterCellRef: opaque-ref-v1,
  adapterClosureDigest: digest-v1,
  targetClass: registry-id-v1,
  targetApiVersion: exact-version-v1,
  targetConfigurationDigest: digest-v1,
  injectionProfileId: registry-id-v1,
  containmentProfileDigest: digest-v1,
  outputPolicyDigest: digest-v1,
  auditProfileDigest: digest-v1,
  externalHeadProfileDigest: digest-v1,
  recoveryProfileDigest: digest-v1,
  resourceEnvelopeDigest: digest-v1,
  policySnapshotDigest: digest-v1,
  deploymentMode: "ISOLATED_TEST" | "DEVELOPMENT" | "PILOT" | "PRODUCTION"
}
```

The canonical bytes are domain-separated and hashed to make `cellRef`. The
protected mapping behind `backendInstanceRef` is accessible only to the
qualification authority; public evidence cannot reveal instance, namespace,
tenant, account, endpoint, machine, user, repository, or provider locator.

Changing any field creates a new cell with no inherited level. A patch-version
claim is exact; ranges, “latest”, family aliases, compatible-major inference,
and semantically equivalent configuration are prohibited. A target with
several endpoints or credential slots has a separate cell for each exact
registered target class/configuration, even if one adapter binary serves them.

## 4. Evidence levels and states

The only evidence levels are:

| Level | Exact meaning |
|---|---|
| `DISCOVERED` | Registered artifacts and prerequisites are present. No execution, security, lifecycle, or availability claim. |
| `CONFIGURED` | Safe configuration, immutable identities, least-privilege policy, audit admission, and resource envelope validate without resolving a value or contacting a target. |
| `SYNTHETIC_QUALIFIED` | The full mandatory mechanism/adversarial matrix passes on the exact cell using generated values and isolated targets. |
| `PILOT_VALIDATED` | One separately authorized real entry completes bound use, replacement rotation, recovery, rollback/forward-repair observation, and source retention on the exact cell. |
| `PRODUCTION_APPROVED` | The exact `openbao-v1` production cell has current synthetic and pilot evidence plus independent review, named operational ownership, monitoring, recovery readiness, rollout/rollback readiness, and a one-use promotion approval. |

The evidence state is independently `CURRENT`, `STALE`, or `REVOKED`.
`STALE` and `REVOKED` are unusable. Level is historical and never implies
currentness. A level receipt cannot be supplied by a caller; it is verified
against the protected evidence index before every preparation and again before
attempt claim.

Evidence freshness uses trusted time. A synthetic qualification expires no
later than 30 calendar days after its last complete run. A pilot proof and
production approval each expire no later than 30 calendar days after issuance.
The recovery drill inside a current production approval must be no older than
30 calendar days. A deployment policy may choose shorter periods, never longer.
Clock rollback or unavailable trusted time makes evidence `STALE`.

Immediate invalidators include any cell-field drift; failed or newly skipped
case; lost/corrupt evidence; vulnerability or provider advisory affecting the
closure; signer/trust change; audit/head discontinuity; unauthorized policy or
configuration drift; recovery failure; containment escape; leak positive-
control miss; unexplained production behavior; or incident declaration. These
set `REVOKED` when integrity or a security invariant is contradicted, otherwise
`STALE`. Requalification creates new evidence; it never edits the old result.

## 5. Evidence artifacts and custody

```text
secret-qualification-run-v1 = {
  schemaVersion: "kstack-secret-qualification-run-v1",
  runId: random-id-v1,
  cellRef: opaque-ref-v1,
  suiteManifestDigest: digest-v1,
  toolchainClosureDigest: digest-v1,
  fixtureClass: "SYNTHETIC_GENERATED" | "OWNER_AUTHORIZED_PILOT",
  startedAtBucket: utc-calendar-day-v1,
  completedAtBucket: utc-calendar-day-v1,
  trustedTimeProofRef: protected-opaque-ref-v1,
  caseResults: ordered-list-of-secret-qualification-case-result-v1,
  cleanupState: "CONFIRMED" | "UNCONFIRMED",
  evidenceState: "CURRENT" | "STALE" | "REVOKED",
  priorRunDigest: digest-v1 | "GENESIS"
}

secret-qualification-case-result-v1 = {
  caseId: registry-id-v1,
  expectedInvariantId: registry-id-v1,
  result: "PASS" | "FAIL" | "BLOCKED",
  observationCoverage: exact-bitset-v1,
  safeReasonCode: closed-qualification-reason-v1,
  resourceObservation: closed-bucketed-resource-observation-v1
}
```

The signed manifest enumerates every case before execution. Case IDs cannot be
added, removed, reordered, marked optional, or reinterpreted by runtime input.
The runner uses a fresh isolated backend/target namespace and a new random
fixture per case family. Fixture bytes are never hashed into evidence. Cleanup
must confirm destruction/revocation of fixture objects, target copies,
temporary buffers/files, and test namespaces; `UNCONFIRMED` blocks the run and
starts the content-free incident path.

The repository may retain the canonical content-free run and review receipt.
Protected detailed observations remain in the qualification evidence store
under separate least-privilege access and SB-TC07 audit. Jira receives only
item/cell-safe references, level/state, result counts with small-count
suppression, candidate/review digests, and fixed reason codes.

Qualification currentness is not derived from a mutable index. A separate
operator-controlled evidence authority, outside the candidate host, repository,
backend instance, and deployment rollback domain, maintains:

```text
secret-qualification-event-v1 = {
  schemaVersion: "kstack-secret-qualification-event-v1",
  eventId: random-id-v1,
  eventKind: "RUN_COMMITTED" | "REVIEW_ACCEPTED" | "STATE_STALE" |
             "STATE_REVOKED" | "LEVEL_PROMOTED" | "ROLLOUT_CHANGED" |
             "EPOCH_ACTIVATED" | "AUTHORITY_POLICY_CHANGED",
  cellRef: opaque-ref-v1,
  evidenceEpoch: monotonic-uint64-v1,
  invalidationScope: "EPOCH" | "CELL" | "NOT_APPLICABLE",
  fromActiveEvidenceEpoch: monotonic-uint64-v1 | "NONE",
  toActiveEvidenceEpoch: monotonic-uint64-v1 | "NONE",
  fromLevel: evidence-level-v1 | "NONE",
  toLevel: evidence-level-v1 | "NONE",
  fromEvidenceState: "CURRENT" | "STALE" | "REVOKED" | "NONE",
  toEvidenceState: "CURRENT" | "STALE" | "REVOKED" | "NONE",
  fromRolloutState: rollout-state-v1 | "NONE",
  toRolloutState: rollout-state-v1 | "NONE",
  subjectKind: "RUN" | "REVIEW" | "PROMOTION" | "ROLLOUT" |
               "INVALIDATOR" | "AUTHORITY_POLICY",
  subjectDigest: digest-v1,
  authorityPolicyEpoch: monotonic-uint64-v1,
  authorityPolicyDigest: digest-v1,
  trustedSequenceTime: trusted-instant-v1,
  expiresAt: trusted-instant-v1 | "NOT_APPLICABLE",
  priorEventDigest: digest-v1 | "GENESIS",
  ordinal: monotonic-uint64-v1,
  reasonCode: closed-qualification-reason-v1,
  signatures: sorted-list-of-qualification-signature-v1
}
```

Every `subjectKind` selects one closed canonical subject schema; unknown fields
or missing immutable content-addressed subject bytes reject the event. The
inline from/to fields are authoritative and make current level, evidence state,
rollout state, expiry, and policy epoch derivable from chain bytes alone. A
subject supplies supporting predicates but cannot override them. Public
projection replaces exact trusted instants with UTC calendar-day buckets.

`secret-qualification-authority-policy-v1` binds a monotonic policy epoch,
accepted signature algorithms, current public-key digests, revoked-key digests,
and distinct opaque principals for `EVIDENCE_RUNNER`, `QUALIFICATION_OPERATOR`,
`SECURITY_REVIEWER`, `PRODUCTION_OWNER`, `OPERATIONS_OWNER`, and
`REVOCATION_MONITOR`. One principal cannot satisfy two roles on one event. Its
closed threshold table requires:

- `RUN_COMMITTED`: evidence runner plus qualification operator;
- `REVIEW_ACCEPTED`: independent security reviewer plus qualification operator;
- promotion to `CONFIGURED` or `SYNTHETIC_QUALIFIED`: qualification operator
  plus independent security reviewer;
- promotion to `PILOT_VALIDATED`: production owner plus independent security
  reviewer;
- promotion to `PRODUCTION_APPROVED` or any rollout advance: production owner,
  operations owner, and independent security reviewer;
- activation of a candidate epoch: the same threshold required to promote to
  that epoch's final level, with all signers rechecking its current subjects;
- stale/revoke or transition to `DISABLED_RETAINED`: any one revocation monitor,
  security reviewer, production owner, or operations owner, because these only
  remove authority; and
- `AUTHORITY_POLICY_CHANGED`: production owner, operations owner, independent
  security reviewer, and qualification operator under the still-current policy.

Each signature covers the domain, complete event without `signatures`, and
every prior/head/policy field. Key revocation and policy epochs are monotonic:
a key may verify history before its revocation ordinal but cannot authorize
that or a later event. Policy replacement validates under the prior policy,
cannot un-revoke a key or reduce a promotion threshold, and takes effect only
after its externally committed event. Emergency threshold change requires a
new design review; ordinary operation has no recovery key or root bypass.

The authority canonicalizes, validates thresholds, appends, and commits each event through a
singleton-writer linearizable compare-and-swap to an external monotonic head.
The head store cannot share backup, restore, administrator, or failure scope
with the repository, candidate backend, candidate host, or evidence store.
Every stale/revoke, review, promotion, expiry materialization, and rollout
transition is an event; a failed head commit leaves the action unapplied and
qualification unavailable. After any event bytes may have reached the head
store, uncertainty blocks retry until read-only reconciliation.

The event-kind rules are closed:

- `RUN_COMMITTED` creates exactly the next candidate evidence epoch at
  `DISCOVERED/CURRENT`, leaves the active-epoch pointer and rollout unchanged,
  and has `invalidationScope=NOT_APPLICABLE`;
- `REVIEW_ACCEPTED` changes no level, state, active pointer, or rollout;
- `LEVEL_PROMOTED` advances the candidate exactly one Section 4 row, requires
  `CURRENT` evidence and the complete target predicate in that same epoch, and
  changes nothing else;
- `EPOCH_ACTIVATED` changes only the active-epoch pointer from the prior current
  epoch (or `NONE`) to one fully promoted `CURRENT` candidate, after rechecking
  its complete subjects and expiry under the activation threshold;
- `STATE_STALE` and `STATE_REVOKED` change only evidence state. Registry-fixed
  security invariant failures, leak/containment escapes, live-cell drift,
  vulnerability advisories, audit/head discontinuity, or recovery failures
  have `invalidationScope=CELL` and affect active plus candidate epochs
  immediately. Registry-fixed test-infrastructure loss may affect only its
  candidate epoch but can never pass or activate it;
- `ROLLOUT_CHANGED` advances exactly one Section 10 edge for the active epoch,
  or disables from any enabled state, without changing evidence; and
- `AUTHORITY_POLICY_CHANGED` changes only the globally current signer policy.

Unused from/to fields have exact equal values or `NONE` as fixed by the event
kind; they cannot carry a second transition. Level promotion cannot skip or
regress. Stale/revoked state cannot return to current inside an epoch. An old
active epoch may serve only until its own expiry or invalidator while a new
candidate is built and externally anchored. Candidate completion confers no
authority until one threshold-signed `EPOCH_ACTIVATED` CAS atomically changes
the pointer. There is no grace period: if the active epoch expires before
activation, the cell is unavailable. Expiry is computed from exact trusted
instants even if an expiry event has not yet been materialized.

Rollout advances only while the active epoch is
`PRODUCTION_APPROVED/CURRENT`; disable is permitted from any enabled state. A
failed/uncertain activation leaves the old pointer authoritative only if it is
still current and read-only reconciliation proves the external head did not
advance. Events and subjects from two epochs are never merged to satisfy a
predicate.

Before every use, the verifier recomputes the complete live cell from measured
artifacts/configuration, checks trusted time, verifies the event chain/signature
and external head, and derives every epoch, level/state, active pointer, signer
policy, expiry, and rollout state solely from that chain.
A cached or caller-supplied index cannot authorize work. Restoring an old
evidence store, revoked signer state, old candidate backend, old KStack audit
store, or old broker therefore produces a head/policy/live-cell mismatch and
`UNAVAILABLE`. Bootstrap
qualification of SB-TC07 uses an isolated evidence authority and synthetic cell;
production evidence is anchored by the operator authority, not by the mechanism
being qualified.

## 6. Mandatory matrix

Every claimed cell executes all applicable cases below. If a platform control
cannot be safely observed, the claim that depends on it is unavailable.

### A. Schema, authority, and enumeration

- canonical/noncanonical encoding, unknown/duplicate fields, overlong values,
  malformed Unicode, count/size limits, handle guessing, cross-scope and
  timing-shape probes;
- wrong principal, repository/environment, target, backend, adapter, operation,
  generation, revision, epoch, policy, approval, answer attestation, lease,
  use count, deadline, and replay/cross-session substitutions; and
- stale/forked/restored protected state, clock rollback, suspension/reboot,
  duplicate IDs, ordinal exhaustion, and one-use consumption before contact.

### B. Backend, bootstrap, and readiness

- absent/locked/sealed/standby/degraded backend, wrong instance/signer/version,
  policy widening, revoked/expired/nonrenewable bootstrap, nested bootstrap,
  capability drift, health false-positive, and qualification-only canary; and
- OpenBao TLS/identity/policy/namespace/engine/audit/head/recovery configuration,
  restart, leader loss, quorum/storage loss, and failover with no fallback.

### C. Protected execution and value isolation

- every SB-TC05 injection channel plus arbitrary command, path, URL, proxy,
  redirect, plugin, environment, child/grandchild, descriptor/handle, IPC peer,
  image/loader substitution, reconnect, and second-value-request attack;
- filesystem, repository, clipboard, prompt/UI, paging, dump, trace, event log,
  crash report, network egress, inherited stream, raw-output, and cleanup
  observations on the real OS controls; and
- crash/cancel/timeout/power-loss cuts before/after every value, backend,
  target, output, audit, zeroization, cleanup, and acknowledgement boundary.

### D. Lifecycle and target effects

- every valid and invalid SB-TC06 transition, collision, CAS conflict,
  generation fork/gap/rollback, duplicate/stale mutation, provider write/local
  commit cuts, lost acknowledgement, and all reconciliation outcomes;
- create, rotate, overlap/cutover, predecessor refusal/revocation, expiry,
  renewal, suspend, recover, soft-delete, destroy, metadata delete, retention,
  target old/new acceptance, and provider/target races; and
- no automatic retry or predecessor/provider/platform fallback under every
  ambiguous and resource-exhaustion result.

### E. Audit, receipts, incidents, and support

- canonical event/MAC/chain/head verification, gap/fork/reorder/rollback,
  complete store loss, stale head, old-broker/old-store restore, writer CAS
  contention, request/response audit failure, and full audit-device loss;
- exact public receipt/error/incident/notification/support schemas,
  indistinguishable lookup failures, small-count suppression, and rejection of
  values or secret-derived masked/truncated/encoded/digested material; and
- anchored pre-contact and terminal ordering, post-contact audit ambiguity,
  pasted-secret handling, and incident inability to mint lifecycle authority.

### F. Host projection and concurrency

- each host tool envelope/alias, direct helper/worker/backend invocation,
  hook bypass/absence, fake prompts/approvals, worker-originated choices,
  replayed/persistent/batched/cross-coordinator answers, and direct UI binding;
- Claude exact one-shot ask when claimed; Codex instruction-only behavior with
  no KStack interception claim; and native Windows/WSL bridge identity with no
  credential copied across the boundary; and
- typed conflict races, capacity saturation, audit phase serialization,
  coordinator/worker crash, cancellation, compaction, restart, authority
  non-transfer, and no worker question/approval/lease/execution authority.

### G. Setup, migration, recovery, and uninstall

- installer crash/power cuts, digest/read-back/registration failure, disabled
  recovery, discovery non-contact, explicit backend selection, and no fallback;
- no-echo input and exact importer positive controls, generic-reader denial,
  format/symlink/race/include/multi-entry rejection, source identity/ownership,
  ordered migration, observation completeness, separately approved retirement,
  lost-retirement acknowledgement, and source preservation on failure;
- real-entry recovery isolation or bounded in-place proof, confirmed destruction
  of every temporary recovered copy, recovery package exactness, and proof
  expiry without migration-history rollback; and
- uninstall custody preservation, nonterminal/audit retention, software-only
  rollback, and forward repair without generation/source resurrection.

## 7. Leak-positive-control harness

The SB-TC07 harness generates a high-entropy fixture outside the repository and
tests exact bytes, prefix/suffix fragments, JSON/URL/Base64/hex/UTF-8/UTF-16,
line wrapping, and exception/context embeddings in every sink named by
SB-TC05 through SB-TC09. Each sink has:

- a positive trial that must be intercepted before publication/persistence and
  quarantine the cell with `POSITIVE_CONTROL_ESCAPE`; and
- a structurally similar negative trial that must remain usable, proving that
  blanket output suppression is not being mistaken for detection.

The detector compares only against its own generated fixture variants inside
the isolated run. Its output is `(caseId, sinkId, variantId, result,
safeReasonCode)` and never includes fixture bytes, fragments, length, entropy,
hash, or captured surrounding content. A detector crash, blind sink, truncated
observation, or uncertain cleanup is `BLOCKED`. Static secret scanners are
supplemental only and never consume a production source.

## 8. Resource and performance envelope

Each cell binds one canonical `secret-resource-envelope-v1`. Missing, zero,
unmeasured, or exceeded fields deny preparation or produce the SB-TC05
uncertainty result after contact. The v1 hard ceilings are:

| Resource | Hard ceiling |
|---|---:|
| resolved value bytes | 1,048,576 |
| one public request or response | 16,384 bytes |
| one protected protocol frame | 1,114,112 bytes |
| raw protected output held for closed parsing | 1,048,576 bytes |
| one audit event canonical bytes | 16,384 bytes |
| one support bundle canonical bytes | 262,144 bytes |
| process tree | 8 processes |
| inherited/open non-null descriptors or handles | 32 |
| locked value-bearing memory per attempt | 2,097,152 bytes |
| protected worker address-space limit | 268,435,456 bytes |
| one protected operation | 60,000 ms |
| cooperative cleanup after operation deadline | 5,000 ms |
| concurrent protected operations per host | 4 |
| concurrent operation for one conflict key | 1 |
| queued operations per host | 32 |
| prepared-but-unclaimed operations per host | 16 |
| simultaneous main-window question/approval | 1 |
| audit head writer | 1 |

The adapter/target profile selects exact values at or below every ceiling and
may set a feature to zero to disable it. The effective concurrency is the
minimum of host, backend, adapter, target, audit, policy, and deployment caps;
an absent cap is zero. `maximumValueBytes` and `maximumDurationMs` remain bound
by SB-TC04/SB-TC05. Cleanup time does not extend effect authority: after target
contact, timeout or forced teardown is ambiguous unless the registered
operation-specific no-effect/completion proof closes it.

Before a run, the deployment owner freezes per-operation readiness, prepare,
queue, contact, output, cleanup, memory, process, descriptor, audit-latency, and
throughput thresholds within these ceilings. A signed capacity plan fixes a
positive rational `admittedOperationsPer60Seconds`, burst size, queue-wait
deadline, workload mix, and the safe basis for the expected peak. Production
admission enforces that same rate and burst before preparation; demand above it
is shed without value resolution and is never silently queued. The plan may be
conservative, but the resulting claim is only “qualified for this admitted
rate,” never general capacity.

Qualification executes at 1x and 2x the admitted rate for a fixed 30-minute
interval each, plus a 10-minute maximum-cap saturation interval. It passes only
if there is no
leak, invariant failure, unplanned retry/fallback, unbounded queue/growth,
or deadline breach and every declared percentile/count threshold passes.
Load generators use synthetic isolated targets. Performance success never
overrides a security failure; overload must shed before value resolution or
fail with the correct post-contact ambiguity.

Resource observations are integer counts or policy-fixed buckets. Per-request
timing, allocation traces, command/process details, and provider/target response
content stay protected. Production monitoring reports only closed health state,
bounded aggregate buckets, and small-count-suppressed fixed reason counts.

## 9. Promotion gates

Promotion evaluates the exact ordered predicate; no field is waivable.

### `DISCOVERED`

Exact artifact identities, version/build, platform/session prerequisites, and
registered cell configuration are present. Discovery has made no provider or
target contact and no value/security claim.

### `CONFIGURED`

The closed configuration validates; code/config ancestry is not writable by
the execution principal; principal/backend/target identities and least-
privilege policies bind; protected state and trusted time are ready; resource
caps are nonzero where required; KStack and provider audit plus external head
are admitted; and recovery ownership is named. No synthetic effect is required.

### `SYNTHETIC_QUALIFIED`

One current run on the exact cell has all mandatory cases `PASS`, confirmed
fixture cleanup, immutable artifacts, an unbroken evidence chain, and an
independent security review at `approve`, confidence at least 93, with zero
failed checks, security findings, material dissent, and unresolved questions.

### `PILOT_VALIDATED`

The owner separately approves one real-entry pilot. The exact production-like
cell completes target-bound use, replacement issuance/input, target validation,
cutover, predecessor handling, recovery, restart/failover, audit/readiness
observation, code/config rollback or forward-repair exercise, and the full
policy observation window. That window starts only after the last required
pilot effect, spans at least seven complete 24-hour intervals under trusted
monotonic time, includes at least one separately authorized restart/failover and
one isolated or bounded in-place recovery drill, and resets after any material
cell change. Its source remains retained. Any ambiguous,
unsupported, skipped, rollback-of-generation, leaked, or incomplete result
blocks pilot validation; another attempt requires fresh authority after
read-only reconciliation.

### `PRODUCTION_APPROVED`

All prior predicates are current and the backend is `openbao-v1` in production
mode. The exact deployed instance additionally has TLS and workload/auto-auth
identity, non-root least privilege, no development mode, qualified HA/storage,
tested atomic backup/restore, at least two independently monitored audit
devices with one remote, external monotonic KStack audit head, clock
synchronization, dump/swap/memory posture, storage/audit capacity alerts,
incident/on-call/recovery ownership, current runbooks, canary and rollback
plans, and accepted residual risks. A human production owner and an independent
security reviewer sign the canonical cell/evidence/policy/rollout digests. The
one-use promotion record expires in 30 days and cannot be renewed automatically.
The signed capacity plan is enforced at runtime, and `PRODUCTION_BOUNDED` or
`PRODUCTION_BROAD` cannot advance if canary demand exceeded the admitted rate,
burst, queue-wait deadline, or resource envelope; the owner must qualify a new
capacity plan rather than relabel dropped demand as success.

OS-local cells stop at `PILOT_VALIDATED` for local development. A future
production OS-local portfolio requires a new SB-TC01/SB-TC10 design revision;
an operator exception cannot change this rule.

## 10. Rollout, canary, rollback, and kill switch

Rollout states are:

```text
BUILT_DISABLED -> DEV_SYNTHETIC -> OWNER_PILOT -> PRODUCTION_CANARY
PRODUCTION_CANARY -> PRODUCTION_BOUNDED -> PRODUCTION_BROAD
any enabled state -> DISABLED_RETAINED
```

- `BUILT_DISABLED` exposes no broker execution and no automatic interception.
- `DEV_SYNTHETIC` admits only isolated generated fixtures.
- `OWNER_PILOT` admits only explicitly listed pilot handles/targets under fresh
  per-operation authority; no background migration or broad enrollment.
- `PRODUCTION_CANARY` admits one owner-selected repository/environment and one
  target cell for at least seven complete calendar days.
- `PRODUCTION_BOUNDED` expands only to an explicit allowlist for at least seven
  further complete calendar days.
- `PRODUCTION_BROAD` remains constrained to current approved cells/policies; it
  is not discovery-based enrollment.

Advancement is a host-owned operator action bound to current evidence and a
content-free change preview. Automation cannot shorten observation, expand an
allowlist, or advance a state. Any revocation trigger, unexplained ambiguity,
audit/head failure, leak, recovery failure, policy drift, or resource invariant
failure immediately engages `DISABLED_RETAINED` for new work and opens the
content-free incident path.

Rollback restores only the prior qualified software/configuration pointer
after proving it can read current protected schemas. It preserves the newest
protected state, audit chain/head, evidence, backend objects, current secret
generation, migration history, and reconciliation fences. If compatibility or
integrity cannot be proven, rollback stays disabled and uses reviewed forward
repair. In-flight pre-contact attempts cancel; contacted attempts remain under
normal terminal/reconciliation rules. The kill switch never disables provider
audit, destroys custody, retires a source, or starts another provider/adapter.

## 11. Production monitoring and requalification

Before every operation, KStack verifies current evidence, cell identity,
policy/configuration drift, audit readiness, external head, trusted time,
resource capacity, and kill-switch state. Continuous monitors are value-free
and cannot authenticate broadly or perform a target effect.

Daily synthetic canaries cover safe readiness and the full positive/negative
publication path in an isolated namespace. They do not refresh qualification.
The complete mandatory suite and independent review run at least every 30 days
and after any immediate invalidator. Recovery and failover drills run within
that same 30-day window for production approval. Provider/OS/host/toolchain
updates are staged as new cells, never in-place evidence edits.

Alerts identify only cell-safe reference, health class, evidence state, fixed
reason code, and day bucket. Operators use separately authorized protected
diagnostics. Production traffic never becomes a synthetic fixture, and a
successful canary never reconciles an ambiguous real attempt.

## 12. Deterministic review checks

SB-TC10 closes only if a reviewer confirms on one frozen digest:

1. qualification binds every material platform/backend/adapter/target/control
   dimension and transfers across none of them;
2. evidence levels have exact predicates, separate freshness state, immediate
   invalidation, trusted-time expiry, externally anchored anti-rollback state,
   live-cell recomputation, and no automated promotion;
3. synthetic fixtures and their detectors cannot read or learn production
   values and cleanup uncertainty blocks the run;
4. the matrix includes every SB-TC02 through SB-TC09 obligation, real OS
   controls, every durable/contact boundary, concurrency, ambiguity, and
   positive/negative leak controls;
5. evidence/reviews/Jira/support remain closed, content-free, bounded, and do
   not include secret-derived hashes or sensitive locators;
6. every resource has a hard ceiling, exact lower per-cell bound, saturation
   test, fail-closed overload behavior, and post-contact uncertainty precedence;
7. real pilot authority is separate, source-retaining, exact-cell, observes at
   least seven complete 24-hour intervals, and cannot hide incomplete
   recovery/rotation/observation;
8. production is `openbao-v1` only and requires independent review, two audit
   devices, external head, HA/recovery, ownership, monitoring, and expiring
   human approval;
9. rollout has two seven-day production observation gates, explicit allowlists,
   no automatic advancement, and immediate disable/revocation conditions; and
10. rollback/kill switch preserve custody, current generations, audit/evidence,
    migration history, and ambiguity fences without retry or fallback.

## 13. Rejected alternatives

- **Qualify one OS or host family and infer the rest:** rejected; containment,
  identity, UI, filesystems, tools, and custody boundaries materially differ.
- **Use production credentials as leak canaries:** rejected; the test itself
  would disclose/reproduce protected material and turn monitoring into an
  oracle.
- **Promote after unit tests or a mock provider:** rejected; mocks cannot prove
  real provider, OS, audit, recovery, containment, target, or ambiguity behavior.
- **Permit waivers for failed security cases:** rejected; the evidence level is
  a factual predicate, not a risk score.
- **Automatically promote after a green pipeline:** rejected; production
  ownership and authority are human decisions bound to exact evidence.
- **Fall back to OS custody when OpenBao is unhealthy:** rejected; that creates
  a second authority/copy and imports unqualified semantics.
- **Roll back the provider snapshot or credential generation with code:**
  rejected; lifecycle and audit currentness are monotonic.
- **Keep raw traces for debugging failed qualification:** rejected; failure is
  the highest-risk point for fixture/provider output escape. Protected typed
  observations and deterministic reruns are the debugging route.

## 14. Primary-source posture

- [NIST SP 800-218 SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
  is stable standards guidance, read 2026-08-31. Its secure-development,
  verification, provenance, and release-integrity practices support frozen
  manifests, retained evidence, and defect-driven requalification; KStack's
  exact gates are stricter project policy.
- [NIST SP 800-115](https://csrc.nist.gov/pubs/sp/800/115/final) is stable
  technical-security-test guidance, read 2026-08-31. It supports planned,
  authorized, analyzed assessments; it does not authorize KStack to test a
  production target or replace cell-specific controls.
- Current [OpenBao high-availability documentation](https://openbao.org/docs/internals/high-availability/)
  and [Integrated Storage documentation](https://openbao.org/docs/concepts/integrated-storage/)
  are mutable vendor documentation, read 2026-08-31. They establish supported
  HA, failover, replication, snapshot, and recovery concepts but do not qualify
  an instance.
- Current [OpenBao storage guidance](https://openbao.org/docs/concepts/storage/)
  is mutable vendor documentation, read 2026-08-31. It distinguishes HA from
  backup and recommends atomic/offline backup semantics; executed recovery is
  still required.
- Current [Vault audit-device guidance](https://developer.hashicorp.com/vault/docs/audit)
  and [audit best practices](https://developer.hashicorp.com/vault/docs/audit/best-practices)
  are mutable upstream/vendor documentation, read 2026-08-31. They document
  fail-closed audit availability, at least two devices, combined analysis, and
  health monitoring. OpenBao behavior remains version-pinned and independently
  tested rather than inferred from Vault lineage.
- Current [Vault production-hardening guidance](https://developer.hashicorp.com/vault/docs/concepts/production-hardening)
  is mutable upstream/vendor guidance, read 2026-08-31. It motivates non-root,
  TLS, swap/core-dump, least-privilege, clock, storage, audit, and upgrade gates;
  it does not by itself approve an OpenBao deployment.

## 15. Exit and handoff

Approval freezes the qualification and promotion contract only. It does not
claim that the current JavaScript broker, Windows helper, Linux Secret Service
helper, WSL Jira bridge, OpenBao instance, host hooks, or any target adapter has
passed this matrix. Existing tests are mechanism precedents and remain below
`SYNTHETIC_QUALIFIED` until their exact cells produce admitted evidence.

SB-TC11 must encode these levels, cell/evidence schemas, hard ceilings,
freshness and rollout rules in package/configuration/install-health boundaries.
SB-TC12 must sequence implementation and qualification without importing this
item's review confidence into integrated readiness.
