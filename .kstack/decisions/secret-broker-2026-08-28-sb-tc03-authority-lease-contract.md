# KStack Secret Broker — SB-TC03 authority and lease contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC03` — principal, policy, target binding, approval, prepared operation, lease, TTL/use count, and anti-replay |
| Status | `REVIEW-REQUIRED` |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075` |

## 1. Decision requested

Define the authorization chain between an authenticated caller and one
registered secret-bearing operation. This item ends at a one-attempt lease and
its durable anti-replay state. It does not define how a backend returns a value,
how an adapter contains it, or how target output is sanitized.

## 2. Non-compensating rules

1. A model assertion, handle, prepare ID, approval ID, or lease ID is never a
   principal identity or independent authority.
2. Authentication, policy, approval, target, operation, current handle
   generation, adapter identity, backend identity, repository/environment,
   host/session, time, and audit readiness must all pass on the same attempt.
3. The broker evaluates credential elimination before stored-secret authority.
   A qualified shorter-lived identity route suppresses static retrieval.
4. Policy is default deny. Deny overrides allow; missing, stale, ambiguous, or
   unsupported evidence cannot be compensated by approval.
5. Preparation performs no backend contact and creates no value-bearing state.
   Approval binds the exact prepared-operation digest, not display text.
6. A lease has one operation, one target, one adapter, one handle generation,
   one authenticated session, one attempt, a short TTL, and use count exactly
   one. It cannot be refreshed, delegated, widened, split, or retried.
7. The durable attempt is consumed before backend contact. Crash, cancellation,
   timeout, lost acknowledgement, or ambiguous provider/target outcome burns
   it and blocks replay.
8. Every transition uses compare-and-swap over the complete prior state. Two
   concurrent claimants cannot both reach backend contact.

## 3. Trusted identity inputs

The broker resolves, rather than accepts from the model request:

```text
principal-evidence-v1 = {
  schemaVersion: "kstack-secret-principal-evidence-v1",
  principalRef: opaque-ref-v1,
  principalKind: "interactive-user" | "workload-service",
  authenticatorId: registry-id-v1,
  authenticationRef: opaque-ref-v1,
  authenticatedAt: trusted-instant-v1,
  authenticationExpiresAt: trusted-instant-v1,
  authorityEpoch: generation-v1,
  hostRef: opaque-ref-v1,
  hostBootRef: opaque-ref-v1,
  sessionRef: opaque-ref-v1,
  processImageRef: opaque-ref-v1,
  repositoryRef: opaque-ref-v1,
  environmentRef: opaque-ref-v1
}
```

The host adapter must authenticate the local peer and executable rather than
trust PID, username, path text, environment, working directory, or model input
alone. Platform-specific evidence and freshness are qualified independently.
Process restart, host reboot, session replacement, repository identity change,
or authenticator expiry invalidates derived prepares, approvals, and leases.

Interactive and workload principals are distinct. A workload cannot inherit an
interactive user's approval merely because it runs under the same OS account.
An approver is another authenticated principal role; policy states whether the
requester may self-approve a development operation. Production and destructive
lifecycle operations require an independently authenticated approver unless a
later owner-approved policy profile names a stronger noninteractive authority.

## 4. Registered operation and target binding

An adapter registry entry fixes `adapterId`, executable/image digest, protocol
version, operation IDs, closed request schemas, target resolver, allowed
credential kinds, allowed backend families, output policy ID, maximum duration,
network/redirect/proxy rules, evidence level, and an operation-specific closed
safe-preview schema. The caller supplies only a
registered operation ID and fields admitted by that operation's closed schema.
There is no command, argv, environment, URL, hostname, header, file path,
template, helper, proxy, plugin, or free-form payload field.

The registry maps every authority-relevant or effect-relevant request field,
resolved target fact, default, derived choice, and consequence to exactly one
safe preview field. The mapping is complete and injective: two operations that
can differ in authority or external effect cannot render the same canonical
preview. Hidden defaults, omitted optional behavior, digest-only placeholders,
and generic summaries are prohibited. If a required distinction cannot be
rendered safely, that operation cannot be prepared through a model-facing path.

Target identity is resolved to a protected `targetRef` and immutable target
snapshot. For a network target, the snapshot includes scheme, canonical
authority, port, TLS/server identity policy, redirect prohibition or exact
registered redirect set, and proxy policy. For a local executable it includes
descriptor/file identity, signer/hash policy, ownership, permissions, and
non-writable ancestry. The preview uses only an admitted safe label; equality
and authorization use the protected snapshot digest.

## 5. Policy decision

```text
policy-decision-v1 = {
  schemaVersion: "kstack-secret-policy-decision-v1",
  decisionId: opaque-ref-v1,
  policySetRef: opaque-ref-v1,
  policyRevision: generation-v1,
  authorityEpoch: generation-v1,
  effect: "allow" | "deny",
  principalRef: opaque-ref-v1,
  repositoryRef: opaque-ref-v1,
  environmentRef: opaque-ref-v1,
  handleId: handle-id-v1,
  handleGeneration: generation-v1,
  backendInstanceRef: opaque-ref-v1,
  adapterId: registry-id-v1,
  operationId: registry-id-v1,
  targetRef: opaque-ref-v1,
  targetSnapshotDigest: digest-v1,
  approvalClass: "none" | "self" | "independent",
  maxLeaseSeconds: 1..60,
  decidedAt: trusted-instant-v1
}
```

Rules match typed IDs and classes only. Labels never participate. Evaluation is
deterministic: validate current signed policy set; collect all matching rules;
apply any deny; otherwise require exactly one unambiguous allow profile; then
cap TTL and approval at the strictest matching constraint. Zero allows,
conflicting allow profiles, unknown predicates, or stale policy deny.

The policy decision is evidence only. Its complete fields are revalidated
against current state at lease issue and immediately before backend contact.

## 6. Prepared operation

Preparation constructs an immutable canonical body:

```text
prepared-operation-v1 = {
  schemaVersion: "kstack-secret-prepared-operation-v1",
  prepareId: opaque-ref-v1,
  attemptId: opaque-ref-v1,
  authorityEpoch: generation-v1,
  principalEvidenceRef: opaque-ref-v1,
  hostRef: opaque-ref-v1,
  sessionRef: opaque-ref-v1,
  repositoryRef: opaque-ref-v1,
  environmentRef: opaque-ref-v1,
  handleId: handle-id-v1,
  handleGeneration: generation-v1,
  metadataRevision: generation-v1,
  backendInstanceRef: opaque-ref-v1,
  adapterId: registry-id-v1,
  adapterImageRef: opaque-ref-v1,
  operationId: registry-id-v1,
  operationInputDigest: digest-v1,
  previewSchemaId: registry-id-v1,
  previewDigest: digest-v1,
  targetRef: opaque-ref-v1,
  targetSnapshotDigest: digest-v1,
  policyDecisionRef: opaque-ref-v1,
  policyRevision: generation-v1,
  outputPolicyId: registry-id-v1,
  consequenceClass: registry-id-v1,
  createdAt: trusted-instant-v1,
  expiresAt: trusted-instant-v1
}
```

The safe preview is constructed from the same validated operation object and
target snapshot as `operationInputDigest`; its schema ID and canonical digest
are part of the prepared body. The prepare TTL is at most five minutes and
never outlives authentication, policy, registry, handle, target, or trusted-time
evidence. Its digest uses a
domain-separated canonical encoding over every field. The model receives only
a random `prepareId` and a closed safe preview; internal references and digests
are not projected.

Re-preparing creates a new `prepareId` and `attemptId`; it never revives an old
approval or lease. There is no partial amendment. Any input change requires a
new complete preparation and approval.

## 7. Approval

Approval occurs in a trusted UI outside model-visible chat:

```text
approval-evidence-v1 = {
  schemaVersion: "kstack-secret-approval-evidence-v1",
  approvalId: opaque-ref-v1,
  authorityEpoch: generation-v1,
  preparedOperationDigest: digest-v1,
  previewDigest: digest-v1,
  requesterPrincipalRef: opaque-ref-v1,
  approverPrincipalRef: opaque-ref-v1,
  approvalClass: "self" | "independent",
  decision: "approve" | "deny",
  approvedAt: trusted-instant-v1,
  expiresAt: trusted-instant-v1,
  useCount: 1,
  authenticatorEvidenceRef: opaque-ref-v1
}
```

The trusted UI independently reconstructs the registered safe preview from the
frozen prepared body, verifies `previewSchemaId` and `previewDigest`, and renders
every mapped input and resolved choice plus operation, target label,
environment class, credential purpose, approval class, expiry, and failure
consequence. It accepts no model-authored explanatory text. A missing, extra,
unrenderable, duplicate, reordered-with-different-meaning, or digest-mismatched
preview field denies approval.
Denial is terminal. Prompt close, loss, timeout, authentication failure, digest
mismatch, or uncertain recording denies. Approval expires no later than the
prepare and is atomically consumed when issuing a lease.

## 8. One-attempt lease and anti-replay

### Authority epoch

Every principal evidence, policy decision, prepared operation, approval, lease,
attempt, and terminal record binds one `authorityEpoch`. The current epoch lives
in a qualified monotonic/non-rollback authority outside any restorable broker
snapshot. Startup verifies the snapshot epoch against that authority before
serving requests. Restore, rollback recovery, broker-state replacement, or
uncertain epoch state requires an atomic epoch advance and durable retirement
of the prior epoch before activation; if either operation is unavailable or
ambiguous, the broker remains unavailable.

No object from a prior, future, missing, or mismatched epoch is readable
authority, even if its ID and local state appear unused in restored bytes.
Epoch values are never supplied by the caller, reset by reinstall, or inferred
from wall time. SB-TC04 owns the qualified persistence adapter, but it may not
weaken this activation rule.

### Lease

The model-facing caller receives only a random `leaseId`. The protected record
binds the complete prepared digest, approval, current identity/policy/registry
revisions, current `authorityEpoch`, `attemptId`, issue/expiry instants,
monotonic deadline, and `remainingUses: 1`. Maximum lease TTL is the policy cap and never exceeds 60
seconds. Lease issuance durably changes the approval to consumed.

Claim is one atomic transition:

```text
ISSUED -> CLAIMED -> EFFECT_STARTED -> RESOLVED_READY -> SUCCEEDED
                                      \-> DENIED | FAILED | AMBIGUOUS
```

Before `EFFECT_STARTED`, the worker reauthenticates its peer, executable,
session, repository/environment, handle generation, backend/adapter/target,
policy and registry revisions, approval consumption, trusted time, audit
readiness, and lease state. It then durably sets `remainingUses: 0` and
`EFFECT_STARTED` before provider or target contact. Any failed check reaches a
terminal denial without contact.

After effect start, cancellation, deadline, crash, transport loss, indeterminate
audit, provider ambiguity, target ambiguity, or lost response becomes
`AMBIGUOUS` unless the registered adapter has a qualified read-only
reconciliation that proves a narrower terminal result. The broker never
automatically retries a secret resolution or target effect. A new attempt is
allowed only after reconciliation/policy says it is safe and requires a new
prepare and approval.

A durable retired-ID set covers prepare, approval, lease, and attempt IDs within
an authority epoch across restart, expiry, and deletion. The non-rollback epoch
rule fences restore and rollback, so a locally unretired copy from an old
snapshot still has zero authority. IDs are never reused. CAS
failure, duplicate claim, replay, wrong session, or stale state returns the same
fixed `LEASE_UNAVAILABLE` result with zero backend contact.

## 9. Trusted time

Each qualification cell defines trusted wall-time, monotonic-time, boot/suspend
identity, skew bound, rollback detection, and persistence behavior. Both wall
and monotonic deadlines must be valid. Clock rollback, suspend/resume without a
qualified continuity proof, reboot, missing time source, skew violation, or
indeterminate expiry denies and burns a claimed lease. Caller timestamps are
ignored.

## 10. Confirmation checks

SB-TC03 closes only if one frozen digest proves:

1. Model-supplied identities and bearer possession never authorize.
2. The complete principal/host/session/repository/environment tuple is
   authenticated and freshness-bound.
3. Target and adapter identity are resolved from registries with no arbitrary
   command, endpoint, path, helper, proxy, or output surface.
4. Deny precedence and ambiguous-policy denial are deterministic.
5. Credential elimination precedes stored-secret permission.
6. Preparation has zero backend contact and any change creates a new attempt.
7. Approval is out of band, digest-bound, expiring, one-use, and independently
   authenticated where policy requires it; every authority/effect distinction
   is injectively represented in the independently reconstructed safe preview.
8. A lease binds every authority input, lasts at most 60 seconds, has one use,
   cannot refresh/delegate/widen, and is revalidated before contact.
9. Consumption is durable before effect and concurrent claims have one winner.
10. A verified non-rollback authority epoch fences startup, restore, rollback,
    and state replacement; epoch uncertainty keeps the broker unavailable.
11. Crash, timeout, cancellation, lost response, and ambiguous outcome burn the
    attempt and never trigger an automatic retry.
12. Trusted-time rollback, reboot, suspend, and skew failure deny safely.
13. Public failures remain content-free and create no existence or replay oracle.
14. Later items retain backend, executor, lifecycle, audit-schema, host, and
    qualification mechanism ownership.

## 11. Review instruction

Review only SB-TC03. Approve only at confidence at least 93 with zero failed
checks, security findings, material dissent, and unresolved questions on the
same candidate digest. No implementation, provider access, real credential,
private configuration, or production trial is authorized by this review.
