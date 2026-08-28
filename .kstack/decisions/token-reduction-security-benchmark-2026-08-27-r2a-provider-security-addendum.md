# R2a normative addendum: provider-boundary and failure-domain closure

Status: PROPOSED DESIGN-ONLY ADDENDUM  
Date: 2026-08-27  
Amends: `token-reduction-security-benchmark-2026-08-27.md`  
Base SHA-256: `264941a83b6fd4bdf04c01059243e7995e1a1060cbd82f09954d3114b845d558`  
Scope: the four HIGH provider/security findings only.  
Implementation/external-review authority: none granted.

If this addendum and the base conflict, this addendum controls. It adds no
runtime behavior and does not qualify any current provider route.

## 1. Independent findings preserved exactly

The four HIGH findings are preserved as received, without paraphrase:

1. **ProviderEnvelopeV1 must cover and exact-byte bind every model-visible/system/developer/user/tool/history/attachment/wrapper/metadata field and suppress implicit/autoloaded context.**
2. **Closed deny-by-default provider-route registry plus CI architecture gate/unforgeable admission capability.**
3. **Authentication-plane prerequisite using only host-managed opaque auth unavailable to KStack/child argv-env-stdin, unsupported otherwise.**
4. **Precise volatile output inspection vs persistent capture plus rollback split—admission/persistence/scanner failures kill all external dispatch/incident, while quality/closure failures may fall back to fully admitted context.**

Descriptor-bound no-follow immutable source reads and a provider-capability
evidence matrix are inseparable supporting requirements and are normative below.

## 2. ProviderEnvelopeV1 is the complete model-visible boundary

### 2.1 Closed envelope

`ProviderEnvelopeV1` is a canonical, versioned byte sequence—not merely the
user prompt. It must enumerate, order, length-frame, and exact-byte bind every
value that can affect model inference:

- provider/route, exact model and reasoning configuration;
- system, developer, user, and assistant/history messages;
- tool definitions, schemas, permissions, results, errors, and tool-choice data;
- attachment bytes, media type, filename/label, transforms, and ordering;
- source/citation records, wrappers, separators, templates, and response schema;
- working/repository context, policy text, memory, skills, personas, MCP/app
  metadata, slash commands, and agent descriptions if visible;
- cache namespace/control, sampling controls, locale/time, and other request
  metadata when model-visible or capable of altering rendering; and
- every provider/CLI/SDK-generated prefix, suffix, system wrapper, or injected
  notice visible to the model.

Unknown keys, duplicate keys, implicit defaults, non-canonical numbers,
unordered maps, unbound headers, or post-binding transforms reject. Empty and
absent are distinct. Binary components use exact length-framed bytes, never a
filename-only assertion. The envelope binds the render algorithm, adapter,
provider binary/SDK build, configuration, response schema, and all component
digests. The pre-spawn verifier independently reconstructs the final request
and requires byte equality with the admitted envelope.

### 2.2 No implicit or auto-loaded context

The adapter must suppress and prove suppression of user/global/repository
configuration, prior sessions, conversation history not in the envelope,
skills, memory files, repository instructions, discovery files, environment
prompt fragments, plugins, MCP/app inventories, slash commands, default tools,
telemetry prompts, IDE context, current file selection, and filesystem scans.
The child receives a minimal allowlisted environment and a dedicated empty
working directory unless a bound directory is an explicit envelope component.

Command-line flags such as ephemeral, no-session, read-only, or ignore-config
are assertions until qualification proves their effective behavior for the
pinned binary. A route is unsupported if any model-visible provider/server
wrapper cannot be enumerated and exact-byte bound, or if implicit context cannot
be suppressed and independently observed. A post-response transcript is not
sufficient unless it is an authenticated provider receipt over the exact input
accepted before inference.

### 2.3 Dispatch equality

Admission produces `envelopeDigest` only after complete security scanning. The
spawn/network broker verifies, without reparsing into a lossy form:

- the exact admitted envelope bytes and digest;
- the route, adapter, model, binary/SDK, cache policy, response schema, and
  source-descriptor set;
- an unused one-shot admission capability; and
- that no additional stdin, argv prompt fragment, environment value, file,
  socket, session, or tool channel can add model-visible content.

Any mismatch returns `PROVIDER_ENVELOPE_BINDING_FAILED`, consumes no fallback,
and enters the security failure domain in section 6.

## 3. Closed provider-route registry and admission authority

`ProviderRouteRegistryV1` is checked in, canonical, closed, and deny-by-default.
Each record binds route ID/version; adapter and renderer versions/digests;
executable or SDK identity; allowed model/configuration/response schema;
complete-envelope and implicit-context-suppression capability; source-read and
output-inspection substrate; cache, retention, network, destination, and
host-managed authorization policy; host/OS/runtime tuple; evidence manifest and
requalification trigger; status; and the sole broker entry point.

Status is `QUALIFIED` or `UNSUPPORTED`. Missing, unknown, stale, expired,
partially evidenced, or drifted records are `UNSUPPORTED`. Wildcards,
caller-supplied routes, executable search, PATH resolution, inherited proxies,
environment-based model selection, and adjacent-route fallback are forbidden.

CI constructs the transitive runtime module graph and fails if production code
outside the provider broker can invoke process, shell, socket, HTTP, provider
SDK, dynamic module, FFI, worker escape, or equivalent dispatch primitives.
Text search is supplemental. Sandbox/network policy independently denies spawn
and egress outside the broker. CI enumerates all routes and reachable call sites
and proves legacy/off, recovery, role, panel, and benchmark paths cannot bypass
admission.

Only a separate admission supervisor may mint `AdmissionCapabilityV1` after
descriptor reads, envelope construction, complete scans, route qualification,
and cache/authorization checks pass. KStack, adapters, benchmark workers, and
provider children cannot mint or impersonate it.

The capability binds invocation/route IDs, envelope digest/count, ordered
source descriptor identities/digests, adapter/binary/model/configuration,
authorization/cache/retention policy, destination, monotonic issue/expiry,
nonce, and a single-use counter. It travels supervisor-to-broker over protected
OS-authenticated IPC unavailable to the child; it is never argv, environment,
stdin, model input, pathname material, log, or receipt content.

The broker atomically redeems it once immediately before dispatch. Replay,
expiry, identity mismatch, restart, field mismatch, or concurrent redemption
rejects into the security failure domain. A caller-readable signed blob is not
unforgeable for this purpose. Each supported OS needs qualification evidence
for protected IPC, peer identity, signing custody, anti-replay state, and crash
semantics.

## 4. Descriptor-bound immutable source admission

All components are opened before parsing with no-follow, close-on-exec,
read-only semantics and resolution constrained beneath an approved root. Reject
symbolic/reparse/magic links, device/procfs aliases, non-regular files,
alternate streams, unapproved mounts, and link/ownership/mode states outside
route policy.

The admitted record binds an already-open descriptor/handle to platform file
identity, volume/mount, owner, mode/ACL, size, change/version metadata, and exact
bytes. Check identity and metadata before and after a complete bounded read;
reject change, short read, growth, truncation, lock loss, or unsupported
immutability evidence. Packet construction consumes those in-memory bytes or
inherited read descriptors only and never reopens by pathname.

Linux qualification requires approved `openat2` or equivalent root-constrained
resolution, no symlinks/magic links, `O_NOFOLLOW|O_CLOEXEC`, regular-file
`fstat`, and stable before/after identity. Windows requires reparse-safe open
handles, final-path/root validation, file/volume identity, and sharing/lease
rules that prevent or detect mutation. macOS requires equivalent no-follow,
root-constrained descriptor evidence. Unsupported flags, filesystem/mount
semantics, or change detection reject instead of degrade.

Compute the packet digest only from descriptor-read admitted bytes. A pathname,
prior digest, `realpath`, or stat-before-open is insufficient.

## 5. Authentication-plane prerequisite

An external route is supported only when authentication is host-managed and
opaque to KStack and to provider-child argv, environment, stdin, working tree,
configuration files, inherited descriptors, model input, output, crash data,
and telemetry.

The host service validates the qualified destination and binds one authorized
request/connection to the redeemed admission capability. It performs the
authentication operation below the KStack/provider-child boundary and returns
only a non-sensitive result class plus an authenticated usage receipt. KStack
receives no reusable authentication value. The child cannot choose arbitrary
destinations or export/replay authorization.

Environment/stdin values, CLI flags, cwd/home configuration, KStack/child-
readable files, inherited generic authorization descriptors, shell helpers,
and reusable values returned to the runner are forbidden authentication
channels. Redaction does not qualify them. An OS login/keychain qualifies only
when evidence proves KStack and the child cannot retrieve/export its material
and the host binds use to the qualified route, destination, and request.

If opaque host authentication cannot be proven, the route is `UNSUPPORTED`.
It cannot fall back to environment/file authentication, even for a
non-sensitive benchmark.

## 6. Volatile inspection, persistence, and failure domains

### 6.1 Volatile output inspection

Provider stdout, stderr, streaming events, tool events, callbacks, and response
bodies first enter a bounded volatile inspector through anonymous protected
pipes/channels. Provider children cannot write inherited terminal, log, named
file, telemetry, or alternate descriptors. Core dumps and crash persistence are
disabled; no raw output is written to a named temporary file.

The inspector maintains cross-chunk matcher state, strict incremental UTF-8
state where text is expected, per-component and aggregate bounds, ordering, and
EOF/completeness. A bounded memory-only buffer holds only enough data to scan
and parse the closed response schema. It does not expose raw bytes to dashboards
or diagnostics.

Only after complete scan and schema validation may an allowlisted normalized
response envelope be atomically persisted. Persistent output contains the
structured decision fields required by KStack and their canonical-envelope
digest, not raw provider text, raw stderr/tool events, or their digests. Volatile
buffers are overwritten/released on all terminal paths. Scanner unavailable,
crash, skipped bytes, invalid encoding, overflow, unexpected component,
unscanned EOF, persistence leakage, or alternate output channel is a security
failure—not truncation and continuation.

### 6.2 Security rollback: global stop and incident

These are security-domain failures:

- source admission, descriptor identity/immutability, or exact-byte envelope
  failure;
- route qualification, admission capability, destination, authentication,
  cache, or retention-policy failure;
- any input/output scanner failure, hit, overflow, incompleteness, or bypass;
- any persistent-schema, atomic-write, permission, raw-capture, or receipt
  admission failure; and
- evidence that an unregistered dispatch/egress path exists.

The supervisor atomically trips a process-wide dispatch generation, denies all
new external dispatch, revokes egress, and terminates every concurrent external
provider child/connection. It performs no full-context fallback and no automatic
retry. Volatile material is discarded. The only durable incident record is a
bounded generic code, affected route IDs, non-sensitive invocation IDs,
timestamps, and supervisor generation; it contains no rejected bytes, digest,
size, scanner detail, or timing derived from the rejected content.

Reset requires explicit operator action after root-cause repair, requalification
of affected routes, negative tests, and a reviewed new evidence digest. Merely
selecting the baseline/full-artifact arm cannot clear a security stop.

### 6.3 Quality/closure fallback: local and fully readmitted

These are quality/closure failures when no security predicate failed: unresolved
dependency, closure-verifier disagreement, reviewer request for full context,
confidence regression, new design finding, deterministic evidence unavailable
from a slice, or ambiguous item attribution.

They stop only that treatment attempt. The orchestrator may build a full-context
candidate from the original immutable descriptor set, run the complete source
and exact-envelope admission sequence again, obtain a new one-shot capability,
and dispatch on the same qualified route. No bytes, approval, confidence,
scanner result, or capability carry forward from the slice. If full admission
fails, the result crosses into the security domain and globally stops dispatch.

A normal provider timeout/failure is operational only if all output channels
reach inspected EOF and every security/persistence predicate completes. It may
follow the separately bounded retry policy but cannot be relabeled as closure
fallback. Unknown classification is security-domain by default.

## 7. Provider capability evidence matrix

No current route is qualified by this design. `UNKNOWN` is treated as
`UNSUPPORTED`, not partial support.

| Candidate route observed in KStack | Complete exact model envelope | Implicit context suppressed/proven | Closed broker + admission capability | Immutable descriptor sources | Host-managed opaque authentication | Volatile inspected output/no raw persistence | Cache/retention evidence | Result |
|---|---|---|---|---|---|---|---|---|
| Codex CLI legacy/off direct | UNKNOWN | PARTIAL FLAGS, UNPROVEN EFFECT | NO | NO | UNKNOWN | NO; named temporary captures observed | UNKNOWN | UNSUPPORTED |
| Codex CLI advisory joint | PARTIAL user-packet binding only | PARTIAL FLAGS, UNPROVEN EFFECT | NO | PARTIAL staging only | UNKNOWN | NO; named temporary captures observed | UNKNOWN | UNSUPPORTED |
| Claude CLI dual-review | UNKNOWN | PARTIAL FLAGS, UNPROVEN EFFECT | NO | NO | UNKNOWN | NO; named temporary captures observed | UNKNOWN | UNSUPPORTED |
| Single-role Claude/Fable invocation | UNKNOWN | PARTIAL FLAGS, UNPROVEN EFFECT | NO | NO | UNKNOWN | NO; named temporary captures observed | UNKNOWN | UNSUPPORTED |
| Future direct provider API | NOT IMPLEMENTED | NOT EVIDENCED | NOT IMPLEMENTED | NOT IMPLEMENTED | NOT IMPLEMENTED | NOT IMPLEMENTED | NOT EVIDENCED | UNSUPPORTED |

Qualification requires immutable evidence for every column: pinned binary/SDK
identity; exact pre-inference provider receipt or equivalent envelope proof;
negative autoload tests using canary config/session/skill/repository files;
architecture graph and sandbox-egress tests; one-shot replay/crash tests;
platform descriptor mutation tests; host-auth isolation and destination-binding
tests; output-channel escape/crash/overflow tests; and provider cache/retention
receipts. One passing host/version does not qualify another.

## 8. R2a acceptance tests

1. Mutate each model-visible field and require envelope/delivery digest change;
   add an unknown wrapper/tool/history/attachment field and require rejection.
2. Seed every implicit/autoload source with unique canaries; prove none appears
   in the authenticated model-visible request or output influence test.
3. Attempt every legacy/recovery/role/panel/direct spawn and network primitive
   outside the broker; CI and runtime both deny it.
4. Forge, replay, race, expire, restart across, or field-substitute an admission
   capability; every attempt rejects before dispatch.
5. Replace/mutate/link/mount-switch each source between resolution, open, read,
   scan, and spawn; descriptor identity or before/after stability rejects.
6. Place synthetic authentication canaries in every forbidden child channel;
   route qualification proves the channel absent, not merely redacted.
7. Split scanner canaries across every chunk boundary and output component;
   invalid encoding, overflow, lost EOF, extra descriptor, or scanner crash
   trips the global generation and kills concurrent provider processes.
8. Force persistent-schema, permission, disk-full, atomic-rename, and receipt
   failures; each globally stops external dispatch without retaining raw data.
9. Force only closure/quality failures; verify local full-context re-admission
   succeeds without global incident and carries no slice approval/capability.
10. Make full-context re-admission fail after a quality fallback; verify it
    transitions to global security stop rather than another fallback.

## 9. Open qualification questions

1. Which supported host can produce authenticated proof of the exact complete
   pre-inference model-visible request, including provider/server wrappers?
2. Which OS-specific supervisor/broker IPC and signing-custody mechanisms meet
   the unforgeability and crash/replay requirements?
3. Which providers offer host-managed non-exportable authentication bound to a
   destination/request while remaining unavailable to KStack/provider children?
4. Which provider versions expose authoritative cache/retention and usage
   receipts? Until evidenced, all candidate routes stay unsupported.

These are route-qualification questions, not permission to weaken the
requirements.

## 10. Self-assessment

R2a design-readiness self-score: **96/100**.  
Independent R2a review: **not run**.  
The four preserved HIGH findings: **normatively addressed**.  
Runtime qualification: **zero routes qualified; all remain unsupported**.  
Open questions: **four, listed above**.

This is a design repair only. It neither implements token reduction nor enables
external dispatch or ECR use.
