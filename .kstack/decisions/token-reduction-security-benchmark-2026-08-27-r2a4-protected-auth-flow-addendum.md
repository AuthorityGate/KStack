# R2a.4 normative addendum: protected auth slots and bounded flow claims

Status: PROPOSED DESIGN-ONLY HIGH/MEDIUM RESIDUAL REPAIR  
Date: 2026-08-27  
Base SHA-256: `264941a83b6fd4bdf04c01059243e7995e1a1060cbd82f09954d3114b845d558`  
R2a SHA-256: `1f0b3bfb284f10e4af02103dd012fa2aafafc9f67a6d57a062ed4c238750f16d`  
R2a.1 SHA-256: `6de688651700fc6c3d522362b035ff5e380640de29ce0785c6c6a9f82a1ae0b3`  
R2a.2 SHA-256: `0db0058ce1e650f6b9a1ca884252e4f8b24cfc4c55f29e22a4cbeff1a5a72a2c`  
R2a.3 SHA-256: `fcaa90359dacff5ba221e9f2fd9dc79e6cc258780eb140b017cbc89d3f3e94aa`  
Scope: latest one HIGH and two Medium residuals only.  
Implementation/external-review authority: none granted.

A fresh read-only Codex advisory was obtained without repository/tool access.
No advisory output, identifier, or digest is retained in this artifact; the
clauses below are the local normative synthesis. This addendum controls
conflicts with its bound predecessors, qualifies no route, and authorizes no
ECR use.

## 1. `ProtectedAuthSlotV1` and `ObservedModelRequestV2`

### 1.1 Public marker and private realization

`ProtectedAuthSlotV1` has two disjoint representations:

- a public, fixed-schema, fixed-size, one-use random local marker independent of
  authentication value, encoding, length, digest, issuer, account, and prior
  slot; and
- a principal-private OS-protected realization accessible only inside the
  qualified realizer/guarded-sink TCB.

The public marker is never transmitted. Its serialization, comparison, error,
allocation class, control flow, log/metric label, and expiry bucket reveal no
authentication value, length, digest, transform output, or success-dependent
variation. It cannot be inspected, cloned, renewed, pooled, or converted to a
general byte buffer. Consumption is irreversible before authenticated
transmission; partial realization consumes it and fails closed.

`ObservedModelRequestV2` binds an ordered list of exact **non-authentication**
segments. Each entry binds ordinal, fixed role, exact length, bytes, and digest;
the envelope binds segment count/order and the fixed public slot-marker position.
Insertion, deletion, duplication, reorder, normalization, delimiter change,
alternate encoding, or unknown segment rejects.

Every outbound byte except the private authentication realization is either in
one bound segment or a fixed byte sequence selected by the closed
`AuthFlowProfile`. Header name, scheme, separators, line termination, and any
other bytes created at realization are fixed profile constants. Framing,
signing, padding, timeout selection, or other non-auth fields may not derive
from authentication length/value. If a library synthesizes such a dependency,
the profile is `UNSUPPORTED`.

The private realizer validates the envelope/profile/capability, consumes the
slot, and writes bound segments plus the authentication realization directly to
the guarded TLS sink. It exposes neither combined request nor authentication
bytes to KStack, workers, observer, benchmark, general heap, or persistent
surface.

### 1.2 `Http11TlsCloseV1`

The only V1 auth-bearing model profile is a dedicated fresh HTTP/1.1 connection
over authenticated TLS. It requires `Connection: close`, one request, response
read-only after request termination, and physical close after response. It
forbids redirects, proxies, preconnect/pooling/reuse, challenge retry,
transparent retry, HTTP/2 or HTTP/3, multiplexing, TLS 0-RTT, request/adaptive
compression, authentication negotiation, middleware reserialization, and any
second request on the connection.

The broker enforces exact order/bytes/counts for each non-auth segment and the
profile-fixed separators, then revokes write authorization after one terminal
request. No public object, capability, log, receipt, quota, timeout, padding
decision, benchmark, or policy binds/records whole-request size, digest,
header-block size, bytes written, packet count, authentication-field size, or
whole-request timing. Operational deadlines are fixed profile constants
independent of auth value/length/progress; persistence records only a closed
deadline-outcome enum. Auth-bearing flows are excluded from latency/token-size
benchmark aggregates.

TLS/internal protocol code may necessarily observe transient combined lengths
inside the TCB. The confidentiality claim is narrow: for the exact qualified
profile, transforms, guarded sinks, OS controls, and tested failure paths,
specified authentication-derived values do not reach specified public KStack
surfaces. It does **not** claim to hide length/timing from the destination, TLS
implementation, privileged local observer, kernel/network infrastructure, or
traffic analyst. Traffic-analysis resistance is out of scope unless a later
approved fixed-size/padding profile proves it.

`PINNED_CLI_TCB` is supported only if an instrumented Codex CLI exposes this
segmented pre-realization boundary and routes every relevant byte through the
qualified private realizer and guarded sink. Stock Codex CLI is `UNSUPPORTED`;
flags, configuration conventions, prompt instructions, or post-send transcripts
cannot qualify it.

## 2. `AuthRefreshCapabilityV1` lifecycle

The refresh capability binds one principal, old protected slot, closed refresh
profile, destination/TLS policy, invocation, expiry, nonce, and exactly one
logical request plus at most one local state commit. Its state machine is:

`ISSUED -> SLOT_CONSUMED -> WRITE_STARTED -> RESPONSE_ONLY ->
(NEW_COMMITTED | ROTATION_INDETERMINATE) -> CLOSED`.

Before `WRITE_STARTED`, local validation failure consumes/closes without send.
Once any request byte is offered to TLS, the broker revokes further logical
write authorization when the one request terminates; the connection becomes
response-read-only and then closes. Redirect, challenge retry, reconnect,
replay, alternate endpoint, second physical send, or second state write is
forbidden. A refresh success never authorizes a following model request.

The bounded response parser accepts one unique authenticated rotation outcome.
Duplicate/truncated/unverifiable response, multiple candidate rotations,
partial/unknown send, timeout/crash after write begins, response/commit race,
or inability to prove issuer outcome enters `ROTATION_INDETERMINATE`. Locally,
both old and candidate-new slots become unusable and are destroyed/quarantined;
no automatic retry or selection occurs. This is local invalidation only—the old
value may remain issuer-valid. Recovery requires out-of-band issuer
revocation/re-establishment and a new owner-authorized slot; until then the
provider route is blocked.

## 3. Bounded flow, transform, sink, and qualification closure

### 3.1 Closed profiles and transforms

Each versioned `AuthFlowProfile` fixes: operation class; method; TLS authority
and certificate policy; path; request/header/segment order; constant framing;
allowed auth transform; maximum segment count and per-segment/non-auth total
size; fixed timeout; response maximum; accepted status/content type/schema; and
one-request/close semantics. Unknown fields, extension hooks, runtime plugins,
locale-sensitive behavior, redirects, or version drift reject.

Authentication transformations come only from a closed, versioned registry
whose entry binds implementation/library digests, input/output bounds, canonical
behavior, guarded-memory requirements, allowed profile/sink, and test vectors.
Unknown transform, dynamic dispatch, caller callback, non-canonical output, or
unbounded expansion rejects before slot realization.

### 3.2 Guarded sinks and OS enforcement

Guarded sinks accept only validated `ObservedModelRequestV2` or
`AuthRefreshCapabilityV1` objects plus an already consumed private slot. They do
not accept raw authentication or arbitrary buffers. Sinks enforce the bound
destination/profile, exact non-auth sequence, single write lifecycle,
response-only transition, close, and volatile inspection.

OS policy isolates realizer/transform/sink in the pinned TCB; restricts egress;
denies untrusted code loading, shell/child spawn, debug/trace/core/crash,
telemetry/log export, shared configuration, and unrelated file/IPC access; and
applies R2a.3 protected-memory requirements. A control that is merely requested
but not independently observed effective is unqualified.

### 3.3 Semantic-taint qualification and claim

Qualification enumerates finite taint sources (private slot, transform
intermediates, refresh old/new states), permitted transformations, guarded sinks,
and forbidden public sinks. Static data/control-flow analysis, dynamic semantic
taint instrumentation, synthetic canaries across distinct values/lengths, OS
egress/audit evidence, and failure injection must agree for the pinned
profile/transform/sink/platform build.

The result is evidence only that enumerated auth-derived values did not reach
enumerated public sinks along enumerated tested paths. It is not a universal
non-interference or non-leak proof. Unknown source, transform, sink, reflection,
native/library path, error path, observation gap, or instrumentation loss makes
that build/profile `UNSUPPORTED` rather than extending the claim by inference.

## 4. Required R2a.4 tests

1. Golden-vector and single-byte mutation coverage for every non-auth segment,
   boundary, order, delimiter, duplicate, and normalization case.
2. Compare public marker serialization, errors, labels, allocations, branches,
   and fixed timing buckets across synthetic values and lengths; no
   value/length/digest-derived difference is permitted.
3. Prove fresh HTTP/1.1 TLS, one request, `Connection: close`, response-only,
   physical close, and denial of proxy/redirect/retry/pool/mux/0-RTT/compression.
4. Inspect persistent/public surfaces and prove absence of whole-request
   size/digest/timing, auth field size, raw text, and derived metadata.
5. Inject failure before/after slot consumption, partial/complete write,
   response read, refresh parse, and local commit; ambiguous rotation always
   blocks both local states without replay.
6. Reject unknown/oversized/drifted profiles/transforms, middleware insertion,
   destination change, arbitrary sink buffers, and stock uninstrumented CLI.
7. Run semantic-taint canaries through every enumerated transform/error/crash
   path and fail qualification on any unobserved native/library/OS boundary.

Any violation enters the existing global security-stop domain; none permits
full-context fallback.

## 5. Self-assessment

R2a.4 design-readiness self-score: **97/100**.  
Fresh Codex advisory: **completed once; no raw advisory retained in repo**.  
Residuals addressed: **one HIGH and two Medium**.  
Qualified routes/profiles: **zero pending instrumentation and evidence**.  
Implementation/runtime changes: **none**.

Open work is qualification only: implement an instrumented boundary (stock CLI
remains unsupported), select the finite V1 profiles/transforms/sinks, and prove
the narrow semantic-taint and OS-enforcement claim on each supported host.
