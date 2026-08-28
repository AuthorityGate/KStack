# R2a.2 normative addendum: pinned CLI TCB and source mutation exclusion

Status: PROPOSED DESIGN-ONLY MEDIUM-RESIDUAL REPAIR  
Date: 2026-08-27  
Base artifact SHA-256: `264941a83b6fd4bdf04c01059243e7995e1a1060cbd82f09954d3114b845d558`  
R2a addendum SHA-256: `1f0b3bfb284f10e4af02103dd012fa2aafafc9f67a6d57a062ed4c238750f16d`  
R2a.1 addendum SHA-256: `6de688651700fc6c3d522362b035ff5e380640de29ce0785c6c6a9f82a1ae0b3`  
Scope: the two Medium residuals only.  
Implementation/external-review authority: none granted.

This addendum controls where it narrows or corrects the three bound artifacts.
It qualifies no current route and authorizes no ECR use.

## 1. `PINNED_CLI_TCB` provider profile

`ProviderRouteRegistryV1` may select `PINNED_CLI_TCB` only for a specifically
qualified Codex CLI build. The same isolated pinned CLI principal may be both
authentication-bearing transport and final-request renderer. This is the sole
exception to R2a/R2a.1 renderer/transport separation.

The CLI is explicit trusted-computing-base code. Qualification binds exact
executable and loaded library/runtime/configuration digests, code signature
where available, host/OS/runtime, renderer, model, destination/TLS policy,
sandbox, and evidence manifest. PATH lookup, dynamic updates, plugins, shared
configuration, injected libraries, inherited proxies, or drift make the route
`UNSUPPORTED`.

### 1.1 Pre-transmit observation and authorization

The CLI initially has no egress. It renders the complete final model-visible
request, including every CLI/provider wrapper available before transmit, into a
bounded principal-private volatile buffer. Before any authenticated network
byte is sent, it gives an exact length-framed read-only view to a separately
isolated admission observer over protected IPC.

The observer independently reconstructs and byte-compares
`ModelVisibleEnvelopeV1`; verifies CLI/renderer/model/invocation/destination/
cache/retention/response policy; scans every model-visible byte; binds final
size/digest to the one-shot capability; and only then authorizes broker egress.

Observed and transmitted model-visible bytes use the same immutable buffer/pages
or another platform proof of byte identity. A second render, CLI-controlled
copy, post-observation mutation, partial view, unobservable server wrapper, or
inability to pause transmit leaves the route `UNSUPPORTED`. The observer cannot
access authentication material; the CLI cannot mint/redeem its capability.

### 1.2 Authentication and transport limits

Authentication exists only in a principal-private OS-protected store or IPC
endpoint whose ACL/peer policy excludes KStack, workers, packet builders, other
provider children, model/tool content, and ordinary processes. It is absent
from argv, inherited environment, stdin, cwd/home/shared configuration,
prompt/history/attachments, generic descriptors, stdout/stderr, and persistent
artifacts.

The pinned CLI and qualified TLS/auth library may hold protocol-required
transient copies in protected volatile memory. Bound refresh is permitted only
for the capability-bound TLS destination, route, principal, invocation, and
validity window. It cannot broaden endpoints, create an exportable value,
outlive redemption, or authorize another invocation. Volatile copies are
overwritten/released at terminal completion.

The sandbox forbids export, filesystem persistence, swap/core/crash capture
where enforceable, debug/trace/attach, telemetry/analytics, diagnostic upload,
raw request/transport logging, redirects, proxy inheritance, DNS/TLS
substitution, child spawn, and unapproved egress. The broker pins hostname/IP,
certificate/server identity, method/path class, and zero redirects. Any auth,
renderer, observer, or transport failure enters the global security-stop domain.

### 1.3 Qualification evidence

Qualification must reproduce: exact CLI TCB dependency/build identity; complete
pre-transmit observation with mutation/partial/missing-wrapper tests; synthetic
canaries in every forbidden input, persistence, debug, crash, telemetry,
redirect, proxy, and egress channel; proof KStack/workers cannot open the OS
store/IPC or process material; authorization held until observer approval and
single-use redemption; destination/TLS binding during initial use and refresh;
crash/timeout/replay/concurrency/alternate-endpoint/export tests; and zero raw
provider text or authentication-derived persistence.

Canaries contain no real credentials. Missing observation/isolation evidence or
a server wrapper added after the final observable boundary keeps the profile
`UNSUPPORTED`.

## 2. Mutation exclusion for every source

Every source—including a regular file with observed link count exactly one—
requires an immutable read-only snapshot or OS-enforced mutation lease spanning
continuously from approved-root resolution through one-shot capability
redemption. Without it, admission returns `SOURCE_HARDLINK_UNPROVEN`.

Protection covers directory topology; mount/volume/snapshot identity; ancestor
and file identity; link count and complete link set where applicable;
owner/ACL/mode; size/version; and bytes. It prevents or reliably invalidates
write, truncate, replace, rename, unlink, new link, link removal, reparse/symlink
substitution, bind/mount substitution, and namespace moves outside the view.

An advisory lock, path re-stat, before/after comparison without exclusion, open
descriptor alone, link count one, root-only scan, or cooperative writer promise
is insufficient. Snapshot/lease identity and validity bind into
`AdmissionCapabilityV1`; the broker verifies them atomically at redemption. The
holder releases only after redemption fixes descriptor-read bytes for the
authorized dispatch. Loss, expiry, unverifiable ownership, or mutation enters
global security stop, not full-context fallback.

Tests race write, truncate, rename, unlink, outside-root link creation,
inside-root link creation/removal, ancestor replacement, mount/snapshot switch,
and lease theft/loss before open, during read, after scan, during envelope
render, and immediately before redemption. Run each against link-count-one and
approved multi-link fixtures. No case passes only because before/after metadata
matched; the snapshot/lease must demonstrably exclude or signal mutation.

## 3. Self-assessment

R2a.2 design-readiness self-score: **97/100**.  
Independent R2a.2 review: **not run**.  
Medium residuals addressed: **two of two**.  
Qualified routes/profiles: **zero pending evidence**.  
Implementation/runtime changes: **none**.

Remaining work is qualification, not permission to weaken either boundary:
prove the Codex CLI TCB observation/auth/egress profile on each host and select
an OS/filesystem snapshot or mutation-lease substrate with continuous coverage.
