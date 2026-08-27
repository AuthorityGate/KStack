# HP-TC02 design candidate: trusted request context and class derivation

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC02` only
**Status:** local design candidate; no implementation or authority grant
**Predecessor:** HP-TC01 validated design chain ending
`96728051b7c9d3c8cb6a871335a3271567158578a838fc6eca0b8d24fb5a8b9c`
**Architecture:** locked Option C and HP-Q1 protected governance component

## Exact defect boundary

The round-one request let caller-controlled principal, host session,
repository/root, policy/evidence, and operation class influence admission. This
item replaces that with a protected derivation pipeline and exact request/
approval echo binding. It does not decide nonce uniqueness/replay (HP-TC03),
evidence trust (HP-TC04), eligibility (HP-TC05), mutation safety (HP-TC08),
private MCP output/identity mechanics (HP-TC09), receipts (HP-TC10), leases
(HP-TC11), or migration/rollback (HP-TC12).

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC01's closed schemas and Option C's
protected governance/broker boundary. Build KStack-native context derivation,
registry class lookup, admission transcript, and exact approval binding. No
gstack source is applicable: a host registry/generator cannot authenticate a
principal, physical root, process, session, or approval and is rejected for
this item. No upstream bytes enter the design.

## Trust sources and assurance levels

The protected HP-Q1 component accepts identity facts only from registered
`ContextSourceProfileV1` implementations whose code/configuration digests are
members of the active set. The closed assurance levels are:

1. `PUBLIC_UNAUTHENTICATED`: no principal claim; eligible only for operations
   whose requirement profile explicitly permits public, non-secret,
   non-authoritative output such as the HB-TC04 facade.
2. `AUTHENTICATED_LOCAL`: protected channel binds an OS/account principal,
   exact host process/session, and repository context. It cannot satisfy a
   broker-required ask/privileged profile by itself.
3. `PROTECTED_BROKER`: the protected broker binds authenticated principal,
   session, repository, exact request/approval, and action route. Required for
   every `FULL` ask-tier or privileged profile under locked HP-Q1/HP-TC07.

Locality, stdio parentage, UID alone, terminal ownership, cwd, environment,
host/client name or version, model text, MCP initialization metadata, adapter
declaration, prompt/skill content, and repository files never promote
assurance. An unavailable/ambiguous context gets the least level or rejects;
there is no user-agent-string or same-machine fallback.

## Closed protected context objects

`AuthenticatedChannelContextV1` binds exactly channel profile, channel
instance/launch nonce digests, authenticated peer-principal digest or null,
protected peer/process evidence, host instance/build/adapter digests,
established/expiry times, and assurance level. The protected component creates
it; callers can reference but cannot supply its fields.

`RepositoryContextV1` binds exactly canonical repository identity, worktree
identity, VCS/common-metadata identity, opened-root identity, mount/namespace
identity, case-sensitivity profile, root measurement evidence, observed time,
and expiry. The protected resolver opens the supplied candidate root without
following a link/reparse final component, finds the repository/worktree through
opened-handle-relative traversal, and measures stable identities. It never
falls back to cwd, a parent search after ambiguity, a global config, environment
alias, text path equality, or host claim. HP-TC08 later owns mutation; this
item derives read-only identity only.

`ProtectedSessionContextV1` binds exactly a protected random session ID digest,
authenticated channel digest, principal digest/null, host instance/build,
adapter, repository context, active set at establishment, issued/expiry times,
and revocation-state digest. Session IDs are unguessable references, not bearer
authority; reuse on another channel, principal, host, repository, or active set
rejects.

`TrustedRequestContextV1` binds exactly:

```text
schemaId, schemaVersion, schemaSetDigest, assuranceLevel,
authenticatedChannelContextDigest, protectedSessionContextDigest,
principalDigest|null, hostInstanceDigest, runningHostBuildDigest,
adapterDigest, repositoryContextDigest, openedRootIdentityDigest,
activeSetDigest, policyDigest, contextSourceProfileDigest,
derivedAt, expiresAt
```

Its domain address is included in HP-TC01 `OperationRequestV1` as
`trustedRequestContextDigest`. Every referenced context must resolve exactly
once and cross-match all duplicated facts. `PUBLIC_UNAUTHENTICATED` requires a
null principal; the other levels require a non-null principal.

## Protected operation-class derivation

`OperationRegistryV1` is an active-set member mapping exact operation ID and
operation-schema digest to exactly one requirement-profile digest. The profile
contains the sole authoritative `operationClassId`. The closed classes are
`LOCAL_READ`, `ADVISORY`, `LOCAL_WRITE`, `ASK_SIDE_EFFECT`,
`PRIVILEGED_SIDE_EFFECT`, and `BACKGROUND`.

The protected kernel resolves this chain:

```text
(operationId, operationSchemaDigest, activeSetDigest)
  -> OperationRegistryV1 row
  -> OperationRequirementProfileV1
  -> operationClassId + minimum assurance + approval requirement
```

The request schema has no operation-class field. If a host transport carries a
diagnostic/display class echo, it is untrusted and must equal the derived class
byte-for-byte or admission returns `KSTACK_HOST_CLASS_MISMATCH`. It can never
select an alternate or lower class. A safe alternate is a separately registered
operation profile and request, not post-denial reclassification.

Missing, duplicate, aliased, schema-mismatched, inactive, or incompatible
registry/profile rows reject. A model, adapter, skill, MCP client, CLI flag,
repository configuration, or caller cannot add or weaken a row.

## Admission pipeline

The protected component executes one linear `RequestAdmissionV1` transaction:

1. Accept an untrusted proposal containing only operation ID, proposed input
   artifact refs, requested limits, candidate repository locator, and optional
   host display echoes. It carries no principal, class, policy, evidence,
   active-set, approval, or trusted-context value.
2. Bind `AuthenticatedChannelContextV1`; derive/revalidate the protected
   session and `RepositoryContextV1`; remeasure running host/build/adapter.
3. Snapshot current active set and policy from the protected component. Resolve
   operation registry/profile/class and its minimum assurance. Reject if the
   channel/context level is insufficient.
4. Validate and content-address every input under HP-TC01. Effective limits are
   the component-wise minimum of the valid requested limits and policy/profile
   maxima; invalid/zero/overflow inputs reject. Record only effective limits.
5. Bind the exact current host-evidence-set digest as an input reference without
   deciding its authenticity or eligibility; HP-TC04/05 own those decisions.
6. Obtain opaque nonce/idempotency digests from the protected HP-TC03 interface.
   This item binds them but does not define uniqueness, retention, or retry.
7. Construct the HP-TC01 `OperationRequestV1` with exact operation/schema/
   profile, repository/trusted-context, active-set, policy, inputs, effective
   limits, evidence-set, nonce/idempotency, and canonical times.
8. If approval is not required, require `authorityEnvelopeDigest=null`. If it
   is required, produce the exact display record below, obtain a protected
   approval envelope, and construct one final request whose envelope digest
   cross-binds the pre-approval request subject. No mutable field is inserted
   after approval.
9. Publish an `AdmissionTranscriptV1` binding every source/context/registry/
   profile/request/display/envelope digest and the final outcome.

To avoid an approval/request digest cycle, `ApprovalSubjectV1` is addressed
before the final request. It contains every final request field except
`authorityEnvelopeDigest`, plus the required approval audience and action
scope. The approval envelope binds `approvalSubjectDigest`. The final request
then binds the envelope digest; verification recomputes the subject from the
final request with only that field omitted and requires exact equality.

## Exact approval display and echo

`ApprovalDisplayV1` is a deterministic, non-authoritative projection of the
approval subject containing exactly approval-subject digest, principal display
reference, repository/worktree display reference, host/build, operation ID,
derived class, active set, policy, operation/requirement schema digests, named
input digests/byte counts, effective limits, side-effect target/audience refs,
nonce digest, expiry, and fixed registered risk/recovery codes.

Host text cannot omit, rename, truncate, reorder, or reinterpret an authority-
bearing field. A protected display receipt binds the exact canonical display
and presentation channel. The human approval envelope binds subject, display,
principal, session, repository, host/build, audience, scope, nonce, issue/
expiry, and one decision. Denial produces no approval digest. Host-native
remembered approval, auto mode, model assent, or a generic “continue” is not an
envelope.

At admission handoff and immediately before any later action, the protected
component re-resolves and compares exact request echoes: trusted context,
principal/session, repository/opened root, running host/build/adapter, active
set, policy, operation/schema/profile/class, inputs, effective limits, evidence
set, nonce/idempotency, approval subject/display/envelope, audience, and expiry.
Change returns a stable denial/fence code; it never patches or re-approves the
old request implicitly.

## Confused-deputy and substitution rules

- A channel/session is single-repository. Cross-repository request reuse,
  worktree substitution, root alias, mount/namespace change, and process/build
  replacement reject before approval or action.
- A principal is a protected identity digest scoped by source profile and
  assurance level. Display names, email strings, Git identity, environment,
  repository ownership, model/user text, and host account labels cannot replace
  it.
- Host instance identity binds running process evidence plus executable/build
  identity. An on-disk path/version string alone is insufficient; an update or
  process replacement invalidates the context.
- Policy, active set, evidence set, and operation registry are read only from
  the protected component. Caller echoes are comparison inputs only.
- Input artifacts are immutable digest/length/schema references. A name,
  symlink, mutable path, MCP resource, prompt, or adapter buffer cannot replace
  the verified bytes after subject construction.
- Public unauthenticated context cannot access repository-private data or
  invoke tools/actions. HP-TC09 later defines detailed MCP ACL/output behavior;
  this item fixes the no-promotion default.
- Approval is necessary but never sufficient. The later action still requires
  current eligibility, broker route, fence, receipt, and operation-specific
  controls owned by their respective HP items.

## Stable outcomes

`RequestAdmissionResultV1` is exactly `ADMITTED|DENIED|CONTEXT_UNAVAILABLE` and
binds the proposal digest, derived context/class/profile, request/subject/
display/envelope digests or null, outcome, stable reason code, and timestamp.
The closed reason codes are:

```text
KSTACK_HOST_CHANNEL_UNAUTHENTICATED
KSTACK_HOST_ASSURANCE_INSUFFICIENT
KSTACK_HOST_CONTEXT_UNAVAILABLE
KSTACK_HOST_CONTEXT_EXPIRED
KSTACK_HOST_SESSION_MISMATCH
KSTACK_HOST_PRINCIPAL_MISMATCH
KSTACK_HOST_REPOSITORY_AMBIGUOUS
KSTACK_HOST_REPOSITORY_MISMATCH
KSTACK_HOST_ROOT_CHANGED
KSTACK_HOST_INSTANCE_CHANGED
KSTACK_HOST_BUILD_CHANGED
KSTACK_HOST_ADAPTER_CHANGED
KSTACK_HOST_ACTIVE_SET_CHANGED
KSTACK_HOST_POLICY_CHANGED
KSTACK_HOST_OPERATION_UNKNOWN
KSTACK_HOST_OPERATION_SCHEMA_MISMATCH
KSTACK_HOST_PROFILE_MISMATCH
KSTACK_HOST_CLASS_MISMATCH
KSTACK_HOST_INPUT_MISMATCH
KSTACK_HOST_LIMITS_INVALID
KSTACK_HOST_EVIDENCE_SET_CHANGED
KSTACK_HOST_APPROVAL_REQUIRED
KSTACK_HOST_APPROVAL_DENIED
KSTACK_HOST_APPROVAL_SUBJECT_MISMATCH
KSTACK_HOST_APPROVAL_DISPLAY_MISMATCH
KSTACK_HOST_APPROVAL_ENVELOPE_MISMATCH
KSTACK_HOST_TRANSPORT_CHANGED
```

Human explanations are fixed escaped projections and interpolate no raw path,
principal, request input, host output, exception, token, approval, or secret.
Detailed protected diagnostics are referenced by correlation digest only.

## Isolation from later HP items

- HP-TC03 supplies authoritative time, nonce/idempotency/replay state; HP-TC02
  only binds returned digests and times.
- HP-TC04 authenticates/selects evidence and handles revocation; HP-TC02 only
  binds the exact evidence-set reference current at admission.
- HP-TC05 decides eligibility/quarantine. Class derivation here does not imply
  eligibility.
- HP-TC08 owns handle-relative mutation after the read-only repository identity
  established here.
- HP-TC09 owns authenticated private MCP principals/resources/tools. An
  unauthenticated MCP context remains public-reader only here.
- HP-TC10 owns receipt admissibility, HP-TC11 action leases/fencing, and
  HP-TC12 migration/rollback. The admission transcript is not any of those.

## Deterministic verification design

Positive fixtures derive the same context/request/subject/display bytes from
registered protected sources on Codex, Claude, and a fake-host adapter.
Negative fixtures cover caller-supplied principal/class/policy/evidence/active
set; diagnostic class downgrade; cross-session/principal/repository/worktree
reuse; symlink/reparse/root/mount/case alias; cwd/environment/global-config
fallback; host process/build/config replacement; adapter substitution; stale
context; unregistered operation/profile/schema; input/limit changes; public-
reader promotion; remembered/auto/model approval; display omission/rewrite;
approval from another audience/subject; envelope insertion cycle attempts; and
every action-time echo change.

Construction vectors prove the acyclic order context -> proposal admission ->
approval subject -> display -> envelope -> final request -> transcript. Mutation
tests change every bound field one at a time and require a stable rejection.
Concurrency tests race root/host/policy/active-set/session changes between each
pipeline step and prove no mixed-epoch request is admitted. Secret scans prove
no raw principal, path, credential, approval material, or hostile host text
enters model-visible/public artifacts.

## Review request

Review HP-TC02 only for authenticated protected context derivation, exact
repository/host/session binding, registry-owned operation-class derivation,
acyclic request/approval construction, and complete echo/substitution denial.
Closure requires Codex 93+ and empty failed, security, dissent, and question
arrays.

Do not review or close HP-TC03 through HP-TC12, invoke Opus, inspect/edit files,
use tools, implement, install/configure a host, use credentials, perform an
external side effect, commit, push, deploy, publish, or edit reports.
