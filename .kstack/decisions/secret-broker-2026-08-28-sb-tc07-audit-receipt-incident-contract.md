# KStack Secret Broker — SB-TC07 audit, receipt, and incident contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC07` — audit chain, content-free receipts, safe errors, incident response, pasted-secret handling, support diagnostics, and positive-control leak testing |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC04 `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925`; SB-TC05 `57f18fcbb172327ef85ea3e56be8fa29f7e40be233b8c884223fc793158e1d3d`; SB-TC06 `62e7863ff75922922d3b26bea25fd2aa7e8615d1c18a6d9412275d50d06b2e71` |

## 1. Decision requested

Freeze the broker's provider-neutral audit, public receipt, public error,
security-incident, pasted-secret, support-diagnostic, and leak-test boundary.
The contract must make an admitted secret operation accountable without making
the audit system, Jira, support bundles, or model context a second secret
store. It must also distinguish a useful receipt from proof of a provider
effect and distinguish tamper evidence from impossible claims of completeness.

NIST SP 800-92 supplies the general log-management lifecycle: generation,
transmission, storage, access, use, and disposal all require policy. RFC 5848
demonstrates that origin authentication, sequencing, replay resistance, and
missing-message detection are separate properties. They inform this design but
do not become a claim that a local hash chain prevents deletion or rollback.

For `openbao-v1`, OpenBao's provider audit and this KStack control audit are
independent conjunctive requirements. OpenBao documents that API request and
response logging is provider-side, that most JSON strings are HMACed rather
than omitted, and that success requires at least one audit device to accept a
record. Provider audit content is therefore sensitive and is never copied into
KStack public receipts, Jira, review packets, or support bundles.

## 2. Non-compensating rules

1. No audit event, receipt, error, incident, metric, support artifact, test
   report, or correlation identifier contains a secret, secret-derived
   material, locator, label, value length, provider response body, raw command
   output, tenant/account identity, or user-supplied free text.
2. A digest, HMAC, ciphertext, truncated value, prefix, suffix, fingerprint,
   masked value, and deterministic token derived from a secret are all
   secret-derived material. Hashing does not make a secret safe to publish.
3. Audit readiness is an admission prerequisite. A durable `PRE_CONTACT`
   event and current external anchor must exist before any backend, target, or
   protected value crossing is contacted.
4. One terminal audit event is durable before KStack returns a receipt or any
   qualified operation outcome. The sole exception is the fixed receipt-free
   fail-safe error in section 5 when the audit mechanism needed to record the
   terminal result is itself unavailable. If terminal audit or anchor
   commitment is lost after possible contact, the operation is `AMBIGUOUS`,
   the attempt is quarantined, and success is never returned.
5. A receipt reports only KStack's qualified observation. It is not authority,
   a bearer, a value proof, a provider-effect guarantee, or permission to
   retry. Unknown and unauthorized handles remain enumeration-resistant.
6. Provider audit and KStack audit are not substitutes. Provider readiness
   cannot repair a KStack audit failure, and a KStack event cannot prove an
   absent provider record.
7. Incident creation does not revoke, rotate, delete, or reconcile a secret.
   Those effects require the exact separate SB-TC06 lifecycle authority.
8. Text pasted into chat is already exposed to the conversation/model path.
   KStack never claims it can erase that exposure. It refuses covered
   downstream handling and recommends rotation without resolving a real value
   to compare against the pasted text.
9. Raw logs, provider audit records, environment dumps, process lists, crash
   dumps, and arbitrary files are never accepted as support-bundle input.
10. Leak-test success proves only that named synthetic positive controls were
    detected in named sinks. A scan with no findings is not proof that
    arbitrary output is secret-free.

## 3. Protected audit record

The audit store accepts exactly this internal schema:

```text
secret-audit-event-v1 = {
  schemaVersion: "kstack-secret-audit-event-v1",
  auditEpoch: generation-v1,
  ordinal: positive-integer-v1,
  eventId: random-id-v1,
  priorEventDigest: digest-v1 | "epoch-origin",
  eventDigest: digest-v1,
  eventMac: opaque-authenticator-v1,
  occurredAt: trusted-instant-v1,
  eventKind: closed-audit-event-kind-v1,
  authorityEpoch: generation-v1,
  principalRef: opaque-ref-v1,
  repositoryRef: opaque-ref-v1,
  environmentRef: opaque-ref-v1,
  attemptRef: opaque-ref-v1 | "none",
  handleRef: opaque-ref-v1 | "none",
  generation: generation-v1 | "none",
  backendInstanceRef: opaque-ref-v1 | "none",
  adapterCellRef: opaque-ref-v1 | "none",
  targetRef: opaque-ref-v1 | "none",
  operationClass: closed-operation-class-v1,
  phase: "ADMISSION" | "PRE_CONTACT" | "CONTACT" | "CLEANUP" |
         "TERMINAL" | "RECONCILIATION" | "INCIDENT",
  priorState: closed-state-v1,
  successorState: closed-state-v1,
  contactState: "NO_CONTACT" | "CONTACT_POSSIBLE" | "CONTACT_CONFIRMED",
  outcome: "PENDING" | "DENIED" | "SUCCEEDED" | "FAILED" |
           "AMBIGUOUS" | "QUARANTINED",
  reasonCode: safe-internal-reason-v1,
  cleanupAckRef: opaque-ref-v1 | "none",
  providerAuditRef: opaque-ref-v1 | "none",
  reconciliationRef: opaque-ref-v1 | "none"
}
```

`eventKind`, `operationClass`, states, and reason codes are versioned closed
registries. Unknown values reject. Optionality is represented only by the
listed sentinels; extensions require a schema version. The protected refs are
random, scope-bound references stored only in the audit protection domain.
They cannot be used as provider locators or public identifiers.

The complete v1 vocabularies are:

```text
eventKind =
  ADMISSION_DECIDED | PRE_CONTACT_COMMITTED | CONTACT_STARTED |
  EXECUTOR_CLEANUP_RECORDED | ATTEMPT_TERMINAL |
  LIFECYCLE_RESERVED | LIFECYCLE_EFFECT_OBSERVED |
  LIFECYCLE_RECONCILED | INCIDENT_OPENED | INCIDENT_STATE_CHANGED |
  RECEIPT_ACCESSED | SUPPORT_EXPORT_CREATED | AUDIT_EPOCH_LINKED |
  AUDIT_RETENTION_DISPOSED

operationClass =
  DESCRIBE_HANDLE | LIST_HANDLES | EXECUTE_REGISTERED |
  CREATE_GENERATION | READ_LIFECYCLE_METADATA |
  VALIDATE_STAGED_GENERATION | ACTIVATE_GENERATION | SUSPEND_HANDLE |
  RESUME_HANDLE | MUTATE_TARGET_CREDENTIAL | REVOKE_GENERATION |
  SOFT_DELETE_GENERATION | DESTROY_GENERATION | RECOVER_SOFT_DELETE |
  RENEW_ISSUED_INSTANCE | RECONCILE_LIFECYCLE_ATTEMPT |
  RECEIPT_LOOKUP | AUDIT_VERIFY | INCIDENT_NOTIFY | SUPPORT_EXPORT |
  AUDIT_RETENTION_DISPOSE

closed-state =
  NONE | PROVISIONING | ACTIVE | SUSPENDED | REVOKED | SOFT_DELETED |
  DESTROYED | AMBIGUOUS | QUARANTINED | STAGED | CURRENT |
  OVERLAP_PREDECESSOR | RETIRED | EXPIRED | ABANDONED | ISSUED |
  IN_USE | OPEN | CONTAINED | ACTION_REQUIRED | CLOSED

safe-internal-reason =
  POLICY_ALLOWED | POLICY_DENIED | AUTHORITY_STALE | APPROVAL_REQUIRED |
  APPROVAL_DENIED | BACKEND_NOT_READY | PROVIDER_AUDIT_NOT_READY |
  KSTACK_AUDIT_NOT_READY | TARGET_NOT_READY | PRECONDITION_FAILED |
  CONTACT_NOT_REACHED | EFFECT_CONFIRMED | NO_EFFECT_CONFIRMED |
  EFFECT_UNCERTAIN | CLEANUP_CONFIRMED | CLEANUP_UNCERTAIN |
  OUTPUT_POLICY_BREACH | CONTAINMENT_BREACH | AUDIT_APPEND_UNCERTAIN |
  AUDIT_HEAD_UNCERTAIN | RECONCILIATION_CONFIRMED |
  RECONCILIATION_INCONCLUSIVE | INCIDENT_POLICY_APPLIED |
  RETENTION_POLICY_APPLIED
```

These tokens have no provider-specific extension slot. A new token changes the
schema version and requires review. `NONE` is the only state sentinel and may
appear only where the event kind's state transition is not applicable. The
writer validates the event-kind/phase/operation/state/reason Cartesian profile
against an immutable registry cell; syntactically valid but unregistered
combinations reject before append.

The schema explicitly excludes public handle IDs because an audit export could
otherwise become an enumeration source. It excludes operation-input digests
unless the input is a canonical object proven to contain only closed control
fields. No digest is ever computed over a value, value-bearing buffer,
provider request/response body, user text, label, locator, command, or path.

## 4. Chain, authenticator, and external head

Events use canonical byte encoding and domain-separated calculations:

```text
event-body = canonical(secret-audit-event-v1 without eventDigest,eventMac)
eventDigest = SHA-256("kstack-secret-audit-event-v1\0" || event-body)
eventMac = MAC(K_audit_epoch,
  "kstack-secret-audit-mac-v1\0" || auditEpoch || ordinal ||
  priorEventDigest || eventDigest)
```

`K_audit_epoch` is an opaque non-exportable key held outside the repository and
ordinary application process. Verification returns only a Boolean plus fixed
reason code. A new epoch requires a signed/MACed epoch-link record naming the
prior externally anchored head. Loss of the key never authorizes silent
reinitialization.

After each append, the writer commits `{auditEpoch, ordinal, eventDigest}` to a
monotonic audit-head service outside the restorable broker snapshot. Production
qualification must demonstrate that restoring an older broker and audit-store
snapshot cannot restore or erase that external head. Startup verifies canonical
bytes, ordinals, prior links, MACs, epoch links, and equality with the external
head before declaring audit ready.

A chain and MAC detect alteration, gaps, reordering, forks, and rollback only
relative to a retained trusted head/key. They do not make storage undeletable.
Missing store, missing head, head/store mismatch, unverifiable key epoch,
unexpected fork, or full-state loss is `AUDIT_INTEGRITY_UNAVAILABLE` and denies
new secret work. Recovery is an operator incident, never automatic chain reset.

The append protocol is one serialized durable operation: hold the audit append
lock; reverify current external head; assign the next ordinal; write and sync
the canonical event; update and durably confirm the external head; then release.
An event file without a confirmed matching external head is incomplete and
cannot authorize contact or a public result. The design does not claim a
cross-system atomic transaction: uncertainty at either commitment boundary
fails closed and enters reconciliation.

The external service exposes only `AcquireWriter`, `ReadHead`, and
`CompareAndAdvance`:

```text
audit-head-v1 = {
  schemaVersion: "kstack-secret-audit-head-v1",
  auditNamespaceRef: opaque-ref-v1,
  auditEpoch: generation-v1,
  ordinal: nonnegative-integer-v1,
  eventDigest: digest-v1 | "epoch-origin",
  writerLeaseRef: opaque-ref-v1,
  writerLeaseDeadline: trusted-instant-v1,
  lastUpdateId: random-id-v1 | "epoch-origin"
}

CompareAndAdvance(expectedHead, successorHead, updateId) ->
  ADVANCED | EXPECTATION_MISMATCH | ACKNOWLEDGEMENT_UNKNOWN
```

`AcquireWriter` grants at most one live writer lease for an audit namespace and
epoch and is itself outside the restorable snapshot. The successor must keep
the exact namespace/epoch/lease, use `expected.ordinal + 1`, bind the just-
written event digest, and use the attempt's fresh 256-bit random `updateId`.
The service accepts exactly one transition from the exact expected head and
records `lastUpdateId` atomically with it. It has no set, decrement, delete,
truncate, import, or caller-selected ordinal operation.

`ReadHead`, `AcquireWriter`, and `CompareAndAdvance` are linearizable and their
durability is part of production qualification. On `EXPECTATION_MISMATCH` or a
lost/unknown acknowledgement, the writer performs only `ReadHead`; it does not
repeat `CompareAndAdvance`. An exact match of all successor fields including
`lastUpdateId` confirms the commitment. An exact match of the expected head
proves only that this audit event is uncommitted; it says nothing about a
provider/target effect. The uncommitted file is quarantined.

A new operation attempt is permitted only when the last externally anchored
event for the attempt says `contactState=NO_CONTACT`, the failed event was a
pre-contact event, and SB-TC03 issues entirely new authority. If the last
anchored state is `CONTACT_POSSIBLE` or `CONTACT_CONFIRMED`, or the failed event
would have changed it to either, the attempt remains burned and the outcome is
`AMBIGUOUS`; no retry is permitted. Every other head result is
`AUDIT_HEAD_UNCERTAIN`, revokes the local writer lease, blocks all namespace
work, and requires operator reconciliation. A writer-lease expiry at any point
has the same uncertain result. Local append locking is necessary for file
integrity; the external singleton lease and CAS are authoritative for
multi-process and multi-host ordering.

## 5. Event sequencing and outcome precedence

Every secret attempt has at least these events:

```text
ADMISSION_DECIDED -> PRE_CONTACT_COMMITTED -> zero or more closed phase events
                  -> CLEANUP_RECORDED -> TERMINAL_RECORDED
```

`PRE_CONTACT_COMMITTED` records `NO_CONTACT/PENDING` and must be externally
anchored before the executor or lifecycle adapter is called. `CONTACT_STARTED`
is recorded immediately before the call as `CONTACT_POSSIBLE`. Provider audit
readiness from SB-TC04 is revalidated in the same admission window.

The terminal result applies this precedence:

```text
possible effect + lost/uncertain effect acknowledgement      => AMBIGUOUS
possible contact + lost cleanup or audit acknowledgement     => AMBIGUOUS
confirmed containment/output-policy violation                => QUARANTINED
confirmed effect + complete cleanup + complete audit          => SUCCEEDED
confirmed no effect + complete cleanup + complete audit       => FAILED
pre-contact denial                                            => DENIED
```

No success reaches the caller until the terminal event and its external head
are confirmed. An append failure before contact denies. An append/head failure
after possible contact burns the SB-TC03 attempt and lease, blocks retry, and
requires read-only reconciliation. Timeout, process death, provider error,
cleanup uncertainty, and audit uncertainty never weaken this precedence.

When audit unavailability prevents the terminal append, KStack cannot issue a
receipt or qualified outcome. It returns exactly one constant-shape fail-safe
error with no receipt ID: `AUDIT_UNAVAILABLE` if the last durable anchored
attempt state proves `NO_CONTACT`, otherwise `OPERATION_AMBIGUOUS`. This narrow
exception is an availability signal, not an audited operation result. The
already durable pre-contact attempt/lease consumption remains the no-retry
fence. Where the protected executor/lifecycle state store is available, KStack
also writes exactly one `pending-audit-terminal-v1` obligation containing only
the attempt ref, last anchored audit head, contact-state enum, safe terminal
reason, and cleanup-ack ref; write failure cannot restore retry authority.
After audit recovery, a reconciler consumes that obligation once, appends the
missing terminal/incident events, and never re-executes the business operation.

Lifecycle transitions add their exact prior/successor states. Reconciliation
appends new events; it never edits the original record. Audit retention outlives
the corresponding secret and handle lifecycle. Handle IDs are never reused.

## 6. Content-free public receipt

The only model-, CLI-, UI-, Jira-, or support-visible operation result is:

```text
secret-operation-receipt-v1 = {
  schemaVersion: "kstack-secret-operation-receipt-v1",
  receiptId: random-public-id-v1,
  operationClass: closed-public-operation-class-v1,
  targetClass: closed-public-target-class-v1,
  generation: generation-v1 | "not-disclosed",
  outcome: "DENIED" | "SUCCEEDED" | "FAILED" | "AMBIGUOUS" |
           "QUARANTINED",
  reasonCode: safe-public-reason-v1,
  occurredAtBucket: utc-calendar-day-v1,
  evidenceLevel: "LOCAL-DEVELOPMENT" | "PRODUCTION-QUALIFIED"
}
```

The broker stores a protected one-way mapping from `receiptId` to the terminal
audit event. Receipt IDs are 256-bit random and never reused. Receipt lookup
requires the same principal/repository/environment scope as the operation and
returns the identical `NOT_AVAILABLE` shape for unknown, wrong-scope, expired,
or unauthorized IDs. Lookup does not expose the internal event or confirm a
handle exists.

The public timestamp is day-bucketed to avoid exposing provider latency or
fine-grained use timing. `generation` is disclosed only when SB-TC02 policy
already permits it for the same scope. No receipt includes duration, byte
counts, provider status/text, executable name/path, locator, label, account,
tenant, principal identity, secret metadata, audit digest/MAC, cleanup detail,
attempt/lease ID, provider audit ref, or internal reason.

`SUCCEEDED` means only that the registered operation's qualified success
predicate, containment, cleanup, and both audit gates were satisfied. It does
not reveal or prove the value and is not a provider-signed attestation.

## 7. Safe public errors

Public errors have exactly `{schemaVersion, errorCode, receiptId}` where
`receiptId` is present only when a terminal receipt exists. The audit-outage
exception has exactly `{schemaVersion, errorCode}` and only the two codes
specified in section 5. The fixed codes are:

```text
NOT_AVAILABLE
AUTHORITY_UNAVAILABLE
APPROVAL_REQUIRED
APPROVAL_DENIED
BACKEND_UNAVAILABLE
TARGET_UNAVAILABLE
OPERATION_DENIED
OPERATION_FAILED
OPERATION_AMBIGUOUS
OUTPUT_POLICY_VIOLATION
AUDIT_UNAVAILABLE
INCIDENT_REQUIRES_ROTATION
SUPPORT_BUNDLE_DENIED
```

There is no free-text `message`, nested cause, provider code, retry-after,
stack, path, command, or validation echo. Internal causes map many-to-one.
Malformed, absent, unknown, stale, wrong-scope, unauthorized, quarantined, and
soft-deleted handle requests all use `NOT_AVAILABLE` with equivalent public
shape and bounded work/contact behavior. Public codes never say whether a
backend object, label, locator, account, tenant, target credential, or handle
exists. Detailed diagnosis is an authorized protected-audit operation, not an
error-field expansion.

`OPERATION_AMBIGUOUS` never carries automatic-retry advice. User guidance says
to reconcile or escalate. `INCIDENT_REQUIRES_ROTATION` does not claim rotation
occurred.

## 8. Security incidents and response

The fixed incident classes are:

```text
SUSPECTED_SECRET_PASTE
DIRECT_VALUE_REQUEST
UNSAFE_METADATA_ATTEMPT
OUTPUT_POLICY_VIOLATION
CONTAINMENT_FAILURE
AUDIT_INTEGRITY_FAILURE
AMBIGUOUS_MUTATION
STALE_PREDECESSOR
SUPPORT_EXPORT_VIOLATION
POSITIVE_CONTROL_ESCAPE
```

The protected incident record contains only its random incident ref, class,
trusted time, scope refs, related attempt/receipt refs where authorized,
severity enum, containment state, lifecycle-action-needed Boolean, and fixed
response-state enum. It contains no excerpt, match, value, value digest,
regex capture, offset, user prompt, provider body, raw output, or free text.

Creation may immediately apply only attempt/artifact-local containment: deny
the current attempt, quarantine its captured output/buffers from publication,
and suspend support export for the affected attempt. It cannot change a handle,
generation, issued instance, backend, target, or global authority epoch. Any
handle fence/suspension, provider/target revocation, credential rotation,
predecessor retirement, deletion, or recovery is a new SB-TC06 transition with
its own preview, approval, attempt, and audit record. Until that transition is
admitted, ordinary admission policy may deny the affected handle because an
open incident is a closed policy input; that denial is not a state mutation.
Incident response cannot call a generic shell or provider API.

Notifications contain the incident class, safe scope, fixed actions, and a
random incident reference only. Jira may receive a separate value-free work
item that cites repository evidence digests; it never receives protected audit
events or incident internals. Evidence preservation retains protected audit
records and containment artifacts in the restricted incident domain; it does
not copy possible secret-bearing bytes into repository evidence.

## 9. Pasted-secret handling

Pasted-secret detection is a guardrail, not secret discovery. It operates on
already-received user text inside the existing conversation trust boundary and
must not call SB-TC04 resolve, compare against stored values, query provider
HMAC endpoints, or persist candidate material.

High-confidence syntax and provider-specific patterns may classify only
`SUSPECTED_SECRET_PASTE`; they cannot establish that a credential is real,
current, or owned by the user. On suspicion KStack:

1. does not repeat, transform, summarize, quote, fingerprint, or forward the
   candidate text;
2. blocks Secret Broker import, execution, Jira projection, review evidence,
   and support export containing that text;
3. emits one content-free incident and public
   `INCIDENT_REQUIRES_ROTATION` response;
4. states that the text may already be exposed and recommends rotation through
   the separately authorized lifecycle path; and
5. keeps false-positive dismissal separate from credential validation.

The broker cannot delete the user's chat, model-provider records, terminal
scrollback, clipboard, shell history, screenshots, or third-party logs. UI
copy must say this plainly. A user assertion that text was harmless may close
the local suspected incident but never validates a stored secret or suppresses
a separately confirmed output/containment incident.

## 10. Support diagnostics

Support export is deny-by-default and creates only:

```text
secret-support-bundle-v1 = {
  schemaVersion: "kstack-secret-support-bundle-v1",
  bundleId: random-public-id-v1,
  generatedAtBucket: utc-calendar-day-v1,
  kstackVersion: semantic-version-v1,
  contractVersions: bounded-map-of-closed-version-ids-v1,
  platformClass: "WINDOWS-NATIVE" | "WSL" | "LINUX" | "MACOS",
  evidenceLevel: "UNQUALIFIED" | "LOCAL-DEVELOPMENT" |
                 "PRODUCTION-QUALIFIED",
  healthStates: bounded-map-of-closed-health-enums-v1,
  publicReasonCounts: bounded-map-of-safe-public-reason-v1,
  selectedReceiptIds: bounded-list-of-random-public-id-v1,
  integrityState: "VERIFIED" | "UNAVAILABLE"
}
```

It is assembled from typed in-memory fields, never by recursive file capture,
log scraping, command output, or sanitizing an arbitrary blob. The user sees
the complete canonical bundle and destination before a separate export
approval. Unknown keys, free text, absolute/home paths, environment variables,
process/command lines, configuration bodies, raw logs, audit/provider records,
crash artifacts, usernames, machine names, network addresses, repository
remotes, labels, locators, tenant/account identifiers, and timestamps finer
than a day reject generation.

Receipt selection rechecks scope. Counts are capped and bucketed; empty and
small populations use an `UNDER_THRESHOLD` sentinel to prevent existence and
activity inference. `integrityState=UNAVAILABLE` produces no claim that the
underlying audit is valid. A support bundle is never accepted as audit or
provider-effect proof.

## 11. Provider audit boundary

An `openbao-v1` production cell requires declaratively managed audit devices,
secure transport for remote audit, `log_raw=false`, and the SB-TC04 current
readiness proof. KStack treats the provider audit store as sensitive even when
OpenBao has HMACed most strings: HMACs may still be checked through a privileged
provider endpoint, and non-string or exempt fields may remain visible.

KStack records only a protected opaque `providerAuditRef` after the provider's
qualified acknowledgement. It does not parse or mirror the provider record as
its own audit event. OpenBao documents that an operation can fail after an
effect if response auditing fails; KStack therefore applies SB-TC05/SB-TC06
uncertainty precedence rather than treating a provider error as proof of no
effect. No KStack component may enable raw provider auditing dynamically.

`os-local-v1` must independently qualify an equivalent provider/OS audit proof
or remain `LOCAL-DEVELOPMENT`; the KStack chain does not promote it to
production. Platform-native event logs are not exported in support bundles.

## 12. Retention, access, and disposal

Audit access is a separate least-privilege capability and is never granted to
the model, normal executor, lifecycle adapter, Jira projector, or support
exporter. Reads are scoped, bounded, audited, and return only the closed
protected schema to an authorized incident-review component. Correlation across
repositories, environments, principals, or providers is denied by default.

The deployment policy fixes retention class before admission. Records and
external heads survive secret rotation, revocation, soft deletion, destruction,
uninstall, and repository removal for that class's term. Expiry creates a
protected disposal obligation; it does not silently unlink records. Disposal
requires separate operator authority, a terminal checkpoint anchored outside
the disposed segment, and a non-secret tombstone containing only epoch/ordinal
ranges and disposition class. Legal hold overrides disposal through the same
protected policy plane.

Backups, replicas, and exports preserve encryption, access control, chain
ordering, and external-head relation. Restoring a backup cannot move the head
backward. KStack never describes logical deletion as physical erasure.

## 13. Positive-control leak harness

Qualification creates a fresh random synthetic credential outside the
repository and exercises exact, encoded, and context-derived positive controls
against every named sink. The fixture is marked synthetic and is destroyed
after the run. No production/provider credential is ever used as a scanner
oracle.

Required variants include exact bytes, prefix/suffix fragments, JSON escaped,
URL encoded, Base64, hex, UTF-8/UTF-16 representations, line-wrapped form, and
the fixture embedded in an exception. Required sinks include argv, environment,
stdin/stdout/stderr, temporary and repository files, ordinary/application logs,
audit events, receipts/errors, review packets, Jira drafts/comments, support
bundles, child-process inheritance, crash artifacts, clipboard adapters, and
platform event logs where the qualification harness has safe access.

Each test has two controls:

- the positive fixture must be detected before publication/persistence and
  produce `POSITIVE_CONTROL_ESCAPE` if deliberately injected into a sink;
- a structurally similar non-secret negative fixture must remain usable so a
  blanket output ban cannot masquerade as a functioning detector.

The harness scans exact generated variants only in its isolated test domain and
reports sink ID, variant ID, detected/not-detected, and fixed reason. It never
prints the fixture or a derived digest. Test infrastructure must prove cleanup
of fixture-bearing buffers/files separately. A missed positive control blocks
the applicable platform/evidence level. A passing matrix does not relax the
closed-schema and suppression rules.

## 14. Qualification and falsification gates

SB-TC07 is implementable only when tests prove:

1. canonical encoding, hash/MAC verification, gap/fork/reorder detection, epoch
   linking, and startup mismatch refusal;
2. old broker plus old audit-store restore cannot roll back the qualified
   external head;
3. contact is impossible before an anchored `PRE_CONTACT` event;
4. success is impossible before an anchored terminal event;
5. every post-contact audit/cleanup uncertainty yields `AMBIGUOUS` and burns
   retry authority;
6. receipts, lookup failures, public errors, incidents, notifications, Jira
   events, and support bundles match exact schemas and resist enumeration;
7. secret-derived material is rejected even when hashed, masked, truncated,
   encoded, or placed in an unknown field;
8. pasted-text handling never resolves a stored secret or persists a match;
9. incident response cannot cause a lifecycle effect without a new SB-TC06
   authority; and
10. the positive/negative leak matrix passes independently on every claimed
    platform and backend cell.

Power loss and process-kill injection must cover every event-write/head-update
boundary. Tests must also cover full audit-store removal, lost MAC key, stale
external head, restored snapshots, duplicate event ID, ordinal exhaustion,
clock rollback, support-bundle under-threshold behavior, and OpenBao response-
audit failure after a possible provider effect.

No benchmark, example, mock backend, documentation assertion, or clean static
scan qualifies these gates. SB-TC10 owns the cross-platform evidence matrix and
promotion decision.

## 15. Rejected alternatives

- **Put value hashes/HMACs in receipts or incidents:** rejected; they are
  secret-derived comparison oracles and expand exposure.
- **Use a local hash chain without an external monotonic head:** rejected; a
  rollback or complete deletion can remove both records and evidence of loss.
- **Return raw provider errors after redaction:** rejected; provider text is an
  open schema and redaction is not a safe construction.
- **Copy OpenBao audit JSON into Jira or support bundles:** rejected; provider
  audit data is sensitive even when most strings are HMACed.
- **Retry after an audit or provider acknowledgement timeout:** rejected; a
  possible prior effect makes replay unsafe.
- **Confirm pasted text by resolving and comparing a real secret:** rejected;
  comparison creates a new value crossing and persisted/oracular result.
- **Collect diagnostics first, sanitize later:** rejected; collection itself
  creates an uncontrolled second secret store.
- **Treat a negative leak scan as proof of absence:** rejected; finite scanners
  establish only their named positive controls.

## 16. Source posture

- [OpenBao audit devices](https://openbao.org/docs/next/audit/) — mutable vendor
  documentation, read 2026-08-31. It documents request/response auditing,
  at-least-one-device success, HMAC treatment, exceptions, and sensitive audit
  content.
- [OpenBao HTTP audit device](https://openbao.org/docs/audit/http/) — mutable
  vendor documentation, read 2026-08-31. It documents synchronous remote audit,
  no retry, HTTPS guidance, and the sensitivity of audit transport.
- [OpenBao declarative audit RFC](https://openbao.org/docs/rfcs/config-audit-devices/)
  — mutable accepted vendor design, read 2026-08-31. It documents the risk of
  API-created audit devices and `log_raw=true`.
- [NIST SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final) — final 2006
  guidance, read 2026-08-31. It informs the complete log-management lifecycle.
- [RFC 5848](https://www.rfc-editor.org/rfc/rfc5848.html) — standards-track RFC,
  May 2010. It informs separate integrity, authentication, sequencing, replay,
  and missing-message properties; KStack does not claim wire compatibility.

These sources support constraints, not KStack conformance. The exact schemas,
external-head construction, admission ordering, and qualification claims above
remain KStack-owned and require implementation evidence.
