# R2a.3 normative addendum: one-request write budget and protected auth memory

Status: PROPOSED DESIGN-ONLY MEDIUM-RESIDUAL REPAIR  
Date: 2026-08-27  
Base SHA-256: `264941a83b6fd4bdf04c01059243e7995e1a1060cbd82f09954d3114b845d558`  
R2a SHA-256: `1f0b3bfb284f10e4af02103dd012fa2aafafc9f67a6d57a062ed4c238750f16d`  
R2a.1 SHA-256: `6de688651700fc6c3d522362b035ff5e380640de29ce0785c6c6a9f82a1ae0b3`  
R2a.2 SHA-256: `0db0058ce1e650f6b9a1ca884252e4f8b24cfc4c55f29e22a4cbeff1a5a72a2c`  
Scope: two Medium residuals only.  
Implementation/external-review authority: none granted.

This addendum controls conflicts with its bound predecessors. It qualifies no
route and authorizes no ECR use.

## 1. One observed model request per write authorization

`ObservedModelRequestV1` binds one and only one complete outbound model request
after every content transform and before TLS encryption. It contains the exact
route-qualified request framing plan, ordered header/metadata fields, model-body
bytes, framing byte count, body byte count, terminal request marker, destination,
connection/stream identity, and `ModelVisibleEnvelopeV1` digest.

Compression, encoding, serialization, wrapper injection, header synthesis, and
protocol frame construction occur before observation or are independently
reconstructed byte-for-byte by the broker from closed bound fields. Indefinite
chunking, caller-selected transfer coding, unbound headers, connection-level
metadata capable of changing inference, and post-observation request transforms
are forbidden. HTTP/2 or later protocols require a qualified stream/frame plan
binding stream ID, ordered frame types/flags/lengths, exact DATA payload bytes,
and `END_STREAM`; otherwise the route is `UNSUPPORTED`.

The observer scans and binds `ObservedModelRequestV1` into a single-use
capability. The broker owns the only writable network/TLS handle and enforces
separate exact framing and body counters. It permits precisely the observed
frames/body for one request. Short write is failure; excess or mismatched byte,
frame, header, stream, destination, or terminal marker is a global security
failure. After the exact terminal marker, the broker atomically revokes write
authorization and shuts down/removes the request write path. The connection may
remain response-read-only through the volatile inspector; neither CLI nor
transport principal can write another byte on it.

Automatic provider/SDK retry, redirect, continuation, second turn, tool-result
submission, follow-up, or any other new inference is disabled. Each such action
requires a newly rendered and independently observed envelope/request, a new
invocation/turn identity, and a separately minted one-shot capability. No
request bytes, byte budget, connection write permission, or approval carry
forward. Existing policy still uses zero redirects; a future explicitly
qualified redirect would require a newly qualified destination and new
observation/capability before any redirected write.

Authentication refresh is a separate closed non-model operation class,
`AuthRefreshV1`. It carries no prompt/history/tool/attachment/provider free text
and cannot authorize a model request. It binds principal, qualified TLS
destination, closed method/path, fixed schema and bounds, expiry, and one-shot
nonce. A successful refresh returns closed labels only; the next model request
still requires its own observed envelope and write capability. Refresh failure
cannot trigger an automatic model retry.

## 2. Unswappable or equivalently protected authentication memory

Every authentication value and protocol-required derivative/transient copy must
reside only in a dedicated guarded allocation owned by the qualified trusted
principal/TLS-auth TCB. Before material enters it, the platform must prove:

- pages are locked/resident and cannot be paged (`mlock`/`mlock2`,
  `VirtualLock`, or qualified equivalent), with lock success and limits checked;
- pages and process are excluded from core, minidump, crash-report, debugger,
  tracing, fork/child inheritance, and hibernation capture;
- guard pages, least-readable page permissions, non-exportable process/IPC
  access, and no general heap/string/log copies;
- swap/pagefile is disabled for the TCB lifetime, **or** the exact paging
  substrate is qualified encrypted with keys and plaintext access unavailable
  to every process/principal outside this TCB; and
- terminal cleanup uses a compiler-resistant overwrite, verifies release where
  the platform exposes it, and destroys any TCB-only paging key.

Full-disk encryption or an OS-wide paging key available to unrelated system
processes is not equivalent protection. Best-effort page locking, a failed lock
call, unknown container/hypervisor swap, shared crash service, suspend image,
unqualified hibernation, or unverifiable encrypted-swap key custody makes the
route `UNSUPPORTED` before authentication acquisition. The same rule applies to
`AuthRefreshV1`, TLS library copies, and authentication protocol work buffers.

The qualification record binds host/OS/kernel, page-lock limits, swap/pagefile
and hibernation state, crash/minidump policy, TCB binary/libraries, allocation
implementation, encryption/key-custody evidence where used, and negative-test
manifest. Drift in any bound property invalidates qualification.

### 2.1 Forced-pressure and crash-storage tests

Tests use unique synthetic canaries, never real authentication data. An
independent harness must:

1. force memory pressure beyond normal paging thresholds while the TCB performs
   initial use and refresh;
2. attempt lock-limit exhaustion, allocation failure, fork/inheritance,
   debugger/trace attach, process-memory read, suspend/hibernate, and paging
   configuration changes;
3. terminate by clean exit, abrupt kill, timeout, injected crash, host crash
   simulation where safe, and restart recovery;
4. inspect raw swap/pagefile or qualified encrypted-paging stores, core/minidump,
   crash-report, hibernation/suspend image, logs, temporary storage, filesystem
   journal, telemetry spool, and container/hypervisor backing storage; and
5. prove the canary is absent, page locking remained effective, failures denied
   acquisition/transmit, and cleanup left no recoverable copy.

The inspector must be independent of the TCB and have sufficient privilege to
read each relevant persistence substrate. An inaccessible or uninspected store
is unknown, not pass. Any canary recovery or loss of protection triggers the
global security-stop domain and permanently marks that host/profile
`UNSUPPORTED` until repaired and requalified.

## 3. Self-assessment

R2a.3 design-readiness self-score: **97/100**.  
Independent R2a.3 review: **not run**.  
Medium residuals addressed: **two of two**.  
Qualified routes/profiles: **zero pending evidence**.  
Implementation/runtime changes: **none**.

Remaining work is fail-closed qualification: prove one-request framing/write
revocation for the selected protocol and prove protected-memory behavior under
pressure/crash on every supported host.
