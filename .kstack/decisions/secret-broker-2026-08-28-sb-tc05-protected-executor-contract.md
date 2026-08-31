# KStack Secret Broker — SB-TC05 protected executor contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC05` — protected executor, registered injection channels, executable/adapter identity, process containment, memory lifetime, and output suppression |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC04 `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925` |

## 1. Decision requested

Freeze the only boundary permitted to receive the one-use callback from
SB-TC04 and perform one operation authorized by an SB-TC03 lease. The boundary
must prove the worker, adapter, target, value crossing, process tree, memory
lifetime, egress, raw-output custody, and terminal classification on the same
qualified platform cell.

This item does not define lifecycle mutation, the final receipt/audit schema,
host interception, setup, or production promotion. SB-TC06, SB-TC07, SB-TC08,
SB-TC09, and SB-TC10 retain those responsibilities.

## 2. Non-compensating rules

1. The executor exposes one operation: `ExecuteRegistered`. There is no shell,
   command, argv, environment, script, template, plugin, arbitrary SDK method,
   endpoint, path, output file, callback, proxy, or generic byte sink.
2. A secret never crosses the value-free front-end IPC. The protected worker
   resolves the lease and backend binding internally; callers receive only a
   fixed terminal class and later an SB-TC07 content-free receipt.
3. An exact immutable adapter cell—not an adapter name—binds executable and
   loaded-code identity, operation schema, target, injection channel,
   containment, egress, output policy, deadlines, and qualification evidence.
4. The worker consumes the SB-TC03 attempt before backend contact. The SB-TC04
   callback may cross the exact handle generation once, only into the registry-
   created sink for that consumed attempt.
5. Secret bytes never enter argv, an ordinary environment variable, a model-
   visible stdin/stdout/stderr stream, a repository/shared file, clipboard,
   shell expansion, command string, diagnostic, exception, dump, telemetry, or
   receipt. A non-secret channel locator or inherited descriptor is allowed
   only when fixed by the adapter registry and independently access-controlled.
6. Children are denied unless the adapter cell names every process image and
   the exact parent-child topology. Grandchildren, helpers, interpreters,
   dynamic libraries, or credential helpers not in that closed measured
   closure deny execution.
7. The target gets only its registered crossing. It cannot select another
   handle, request another resolution, widen a target, start an interactive
   prompt, inherit ambient credentials, or return raw output.
8. Output scanning is defense in depth, not proof that arbitrary output is
   safe. Only a closed, bounded parser may construct a fixed safe result;
   unparsed bytes are discarded inside the cell even if no known value pattern
   is detected.
9. Missing or stale containment evidence makes the exact adapter unavailable.
   There is no fallback to weaker isolation, another executable, another
   channel, a CLI, an ordinary environment, or a plaintext file.
10. A platform cell proves only its stated boundary. Development cells retain
    SB-TC00's same-user/administrator/kernel/debugger limitation; production
    requires a distinct service identity and production qualification.

## 3. Immutable adapter cell

```text
target-adapter-cell-v1 = {
  schemaVersion: "kstack-secret-target-adapter-cell-v1",
  adapterCellRef: opaque-ref-v1,
  adapterId: registry-id-v1,
  adapterProtocolVersion: "kstack-secret-target-adapter-v1",
  adapterImageRef: opaque-ref-v1,
  workerImageRef: opaque-ref-v1,
  loadedCodeClosureDigest: digest-v1,
  platformContainmentProfileRef: opaque-ref-v1,
  operationId: registry-id-v1,
  operationSchemaRef: opaque-ref-v1,
  targetRef: opaque-ref-v1,
  targetSnapshotDigest: digest-v1,
  injectionProfileId: registry-id-v1,
  acceptedCredentialKind: closed SB-TC02 enum,
  maximumValueBytes: 1..1048576,
  processTopologyRef: opaque-ref-v1,
  filesystemPolicyRef: opaque-ref-v1,
  egressPolicyRef: opaque-ref-v1,
  outputPolicyId: registry-id-v1,
  reconciliationProfileRef: opaque-ref-v1 | "unavailable",
  maximumDurationMs: 1..60000,
  qualificationReceiptRef: opaque-ref-v1,
  evidenceLevel: closed SB-TC02 evidence enum
}
```

`adapterCellRef` identifies the complete canonical record. Any code, signer,
runtime, library, entitlement, sandbox, operation, target, channel, process,
filesystem, egress, output, deadline, or evidence change creates a new ref and
invalidates prior preparation. A request supplies none of these fields.

The registry admits only native packaged workers and adapters with a measured
loaded-code closure. A script is unavailable unless the exact interpreter,
script bytes, module closure, loader configuration, and child topology are all
qualified as one cell. Production v1 should use a memory-safe native worker
with no dynamic plugin loading. The current JavaScript Secret Broker inventory
and current POSIX Git worker are implementation precedents, not SB-TC05-
conformant cells.

Before value resolution, the supervisor opens and measures the registered
image without following a caller-controlled path, rejects writable or replaced
objects and ancestry, launches without path search or shell parsing, and
confirms the running image and loaded closure against the registry. The
platform profile must close check/use substitution with an OS-supported image
handle, code-signing identity, package identity, or equivalent post-launch
attestation. Path text, PID, username, publisher name, or a pre-launch hash
alone is insufficient.

## 4. Closed execution record and state machine

The protected service constructs this internal record from the consumed lease
and immutable registries:

```text
protected-execution-v1 = {
  schemaVersion: "kstack-secret-protected-execution-v1",
  executionRef: opaque-ref-v1,
  authorityEpoch: generation-v1,
  attemptId: opaque-ref-v1,
  leaseRef: opaque-ref-v1,
  preparedOperationDigest: digest-v1,
  principalEvidenceRef: opaque-ref-v1,
  repositoryRef: opaque-ref-v1,
  environmentRef: opaque-ref-v1,
  handleId: handle-id-v1,
  handleGeneration: generation-v1,
  backendInstanceRef: opaque-ref-v1,
  adapterCellRef: opaque-ref-v1,
  adapterImageRef: opaque-ref-v1,
  operationId: registry-id-v1,
  operationInputDigest: digest-v1,
  targetRef: opaque-ref-v1,
  targetSnapshotDigest: digest-v1,
  injectionProfileId: registry-id-v1,
  outputPolicyId: registry-id-v1,
  monotonicDeadline: trusted-deadline-v1
}
```

Unknown fields reject. Every duplicated field must be byte-equal to SB-TC03,
SB-TC04, and the current registry. The worker revalidates identity, authority
epoch, lease, generation, backend readiness, cell evidence, target snapshot,
and trusted time immediately before contact.

Execution order is fixed:

1. authenticate the value-free client peer and resolve `leaseId` internally;
2. atomically claim and durably consume the attempt as SB-TC03 requires;
3. construct a fresh isolated worker cell and attest its complete identity;
4. install containment, resource, dump, IPC, filesystem, and egress controls;
5. revalidate the frozen execution record and durably enter `EFFECT_STARTED`;
6. create the registry-owned one-use sink and call SB-TC04
   `ResolveForAdapter`;
7. on a valid bounded crossing, enter `RESOLVED_READY` without persisting the
   value, then perform the one registered target operation;
8. parse raw target/provider output inside the cell, classify the attempt, and
   revoke backend, target, network, and injection-channel access;
9. run the cooperative cleanup protocol in section 8, require its authenticated
   content-free acknowledgement for any zeroization claim, then have the
   supervisor destroy and reap the complete cell; and
10. emit only the terminal class selected by section 9's precedence rules.

SB-TC03's durable `EFFECT_STARTED` remains the conservative boundary before
the first backend or target contact. The executor may retain protected volatile
facts distinguishing `backend-contacted`, `value-crossed`, and
`target-contacted`, but loss of those facts can only widen the result to
`AMBIGUOUS`. They cannot authorize retry or narrow a durable ambiguous state.

## 5. Registered injection profiles

The v1 registry may use only these profile families; each concrete operation
still needs its own qualification:

### `broker-native-request-v1`

The measured adapter and network stack remain in the protected worker. They
place a token/password only into the exact registered protocol field (for
example, one HTTP authorization header), use the immutable target and TLS
policy, disable redirects and ambient proxies, and parse one closed response
schema. There is no child process or general HTTP/request interface. Jira and
provider API operations should prefer this profile.

### `private-helper-channel-v1`

An exact measured target executable receives a value through one broker-owned
private descriptor, socketpair, named pipe, or authenticated local socket. The
registry fixes message count, direction, framing, byte limits, deadlines,
peer/process identity, and process ancestry. The path or pipe name is not
authority. A random attempt nonce crosses through an inherited protected
descriptor, not caller input, and the broker releases a value only after peer
and image attestation.

Git HTTPS may use one exact askpass helper under this profile. The helper may
return admitted non-secret username metadata and the token at most once; a
second password request, unrecognized prompt, wrong process/ancestry, channel
reconnect, helper replacement, or interactive fallback terminates the cell.
`GIT_ASKPASS` and a channel locator may exist only as registry-built non-secret
environment metadata inside the isolated cell. The token itself never does.
All other Git credential helpers, config, prompts, hooks, filters, aliases,
editors, SSH controls, and ambient variables are disabled.

### `nonexporting-key-operation-v1`

Under the frozen SB-TC04 contract, raw key bytes may cross once through its
ordinary registered sink into a native nonserializing crypto adapter. The
adapter immediately holds them in its protected region and exposes only a
registered sign/decrypt/TLS callback whose algorithm, parameters, message
digest, target, and maximum invocation count are fixed by the operation. The
callback cannot return or serialize the key, and completion creates no reusable
authority.

SB-TC05 does not admit a backend/provider key object, SDK object, or native key
handle as a second SB-TC04 result shape. Supporting a genuinely nonexporting
provider handle requires a separately reviewed SB-TC04 amendment that defines
its identity, generation, lifetime, callback, and anti-replay semantics before
this profile may consume it. Until then, an operation whose custody backend
cannot perform the accepted resolved-byte crossing is unavailable.

### `ephemeral-sdk-session-v1`

A measured in-worker SDK may receive the value once to create one target-bound
session and execute one closed method. It cannot expose a connection object,
generic query, plugin, connection string, interceptor, trace, pool, retry, or
session cache. The session dies with the cell. Database operations are not
admitted until each exact query family and driver closure is separately
registered and qualified.

No profile authorizes writing a secret to a FIFO/file, passing it on stdin to a
generic program, setting a credential environment variable, substituting text,
or handing bytes to an arbitrary callback. A new crossing family is a new
reviewed SB-TC05 design item, not registry data.

## 6. Process, IPC, filesystem, and network containment

The value-free front end and protected supervisor use a length-bounded,
versioned, mutually authenticated local protocol. It accepts only a lease ID
and fixed operation control messages. OS peer credentials are combined with
the SB-TC03 process-image/session evidence; filesystem permissions or bearer
socket possession alone do not authenticate. The protocol has no field capable
of carrying a value, provider body, arbitrary diagnostic, or adapter output.

The worker starts from a deny-all inheritance set:

- no shell, path search, profile/rc startup, current-directory lookup, ambient
  credential store, proxy, debugger, tracing, localization hook, loader hook,
  plugin path, user config, or inherited network connection;
- exact absolute working directory from the registry, empty/private home and
  temporary namespace, read-only measured images, and only explicitly granted
  operation resources;
- empty environment except a closed per-profile allowlist of bounded non-secret
  constants; loader, runtime-option, tracing, dump, credential, proxy, and
  language/package injection variables are always denied;
- no inherited descriptors/handles except the exact control, output-capture,
  target, and private-channel set; standard input is closed, and stdout/stderr
  are broker-owned bounded pipes or null—not inherited model streams; and
- child creation denied by default. An admitted topology has a maximum process
  count, depth, CPU, memory, output, open-handle/descriptor, and wall-time
  budget. The supervisor owns a kill-on-close tree primitive and waits for the
  complete tree to die before terminal emission.

Network-capable cells receive only exact registered egress. Prefer a broker-
owned already-connected/TLS-authenticated endpoint or a target-specific local
proxy that accepts no destination. A general outbound-network entitlement,
DNS access, hostname allowlist without address/route control, ambient proxy, or
container network alone does not prove exact egress. Redirect, retry, alternate
address, proxy auth, and connection reuse are disabled unless the immutable
target snapshot and operation contract explicitly qualify the exact behavior.

The cell has no repository write access unless the operation's external effect
is specifically a registered repository mutation. Secret-bearing operations
never receive an output path. Private temporary storage may contain only safe
control data; secret values, protocol requests with credential fields, TLS key
logs, crash artifacts, and raw target bodies are memory-only.

## 7. Platform containment profiles

### Linux

A production Linux cell requires a dedicated broker service identity and an
exact kernel/runtime receipt. Before loading a value it establishes
`PR_SET_NO_NEW_PRIVS`, non-dumpability and zero core limit, a syscall/argument
seccomp filter, a Landlock filesystem/network ruleset at an exact supported ABI,
private mount/PID/IPC namespaces where applicable, a cgroup v2 subtree with
resource and descendant control, an exact descriptor allowlist, and a
supervisor-owned pidfd/cgroup termination path. Capabilities are empty after
setup. The profile proves denial of ptrace, new privilege, unregistered exec,
mount, namespace escape, raw/general network, foreign IPC, and filesystem
access outside its grants.

`no_new_privs`, seccomp, Landlock, namespaces, and cgroups are conjunctive;
none alone is called a sandbox. A missing kernel feature, unexpected Landlock
ABI/erratum, unconfined child, inability to remove capabilities, or incomplete
tree cleanup makes that cell unavailable. A developer profile may use the same
mechanisms under the current user but retains the same-user limitation.

### Windows

A production Windows cell requires a dedicated service identity plus an exact
AppContainer/LPAC profile, capability SID set, filesystem grants, restricted
token/privilege set, integrity level, process mitigation policy, and network
policy. `CreateProcessW` uses `STARTUPINFOEX`, an explicit inherited-handle
list, suspended creation for pre-run verification/Job assignment where the
qualified profile requires it, and no command-line ambiguity. A Job Object
enforces process/resource limits and `KILL_ON_JOB_CLOSE`; child-process policy
is deny unless the registered topology requires exact helpers. Desktop/UI,
clipboard, Win32k, COM activation, registry, device, dump/WER, and general
network access are denied unless explicitly proven necessary and safe.

Microsoft's current `CreateProcessInSandbox` API is documented as experimental
and is not a production dependency. A cell may qualify stable AppContainer and
process-attribute APIs, or remain unavailable. Handle-list success, job
assignment, image/signature revalidation, mitigation state, AppContainer SID,
capabilities, and child-tree completion are read back before value crossing.

### macOS

A production macOS cell is a notarized, hardened-runtime, App-Sandboxed broker
and XPC service with exact Team ID/designated requirements, entitlements, app-
group/container grants, and library closure. XPC listeners and connections
enforce the registered peer code-signing requirement. `get-task-allow`, DYLD
environment permission, unsigned executable memory, JIT, library-validation
disablement, executable user-selected files, Apple Events, inbound network,
and unregistered helpers are absent.

The App Sandbox network-client entitlement controls connection initiation but
does not bind a particular remote target, so exact egress still requires the
broker-owned connected endpoint or separately qualified network enforcement.
If the packaged helper, XPC peer requirement, App Sandbox resource grants,
code-signing continuity, or exact egress cannot be proven, macOS remains a
development-only or unavailable adapter cell; another platform's evidence is
not imported.

## 8. Protected memory and lifetime

Value handling is implemented in a native protected component, never a managed
language string, JSON object, exception, immutable buffer, command builder, or
garbage-collected object. Before resolution it reserves a fixed maximum-size
region with guard pages, commits only the required pages, locks them against
paging where the platform contract can prove it, excludes them from dumps, and
uses bounded byte operations. Failure to establish a required protection denies
before backend contact.

The one SB-TC04 crossing writes directly into this broker-owned region. It does
not return a provider object or native handle. Necessary derived encodings,
prefixes, protocol frames, and comparison material are equally protected and
bounded. Copies are forbidden unless the injection profile enumerates them and
the qualification harness observes their creation and destruction. TLS/SDK/
target-library copies are part of that cell's trusted computing base and
memory-lifetime claim.

The value lifetime begins at the backend callback and ends at the earliest of
registered operation completion, target rejection, deadline, cancellation,
channel loss, containment failure, or teardown. Every protected allocation is
registered at creation to exactly one owner: `execution-worker`,
`registered-target-child`, or `provider-library`. Ownership transfer and shared
mutable buffers are prohibited. The cell ledger records only allocation IDs,
owners, maximum sizes, and lifecycle states—never content or a secret-derived
digest.

Cooperative cleanup is ordered and bounded:

1. revoke the backend callback and close target/network/injection channels so
   no new copy or external effect can start;
2. request registered target children to destroy their enumerated copies,
   terminate them, and wait for the complete descendant topology to exit;
3. have the execution worker release provider/library handles and overwrite
   every worker-owned region with a non-optimizable zeroization primitive;
4. unmap those regions and return an authenticated, content-free
   `cleanup-ack-v1` binding the attempt, adapter cell, exact allocation-ID set,
   child-tree-empty fact, cleanup sequence, and monotonic completion instant;
5. have the supervisor validate the acknowledgement, terminate/reap the worker,
   zeroize its own control buffers, and close the containment cell.

The compiled qualification proves the zeroization primitive and that the
acknowledgement cannot be emitted before all registered cleanup steps. It does
not claim that a third-party library or target honored cleanup beyond the exact
qualified evidence.

On crash, hang, invalid acknowledgement, deadline, or lost control channel, the
supervisor immediately revokes channels, forcibly kills and reaps the entire
cell, and closes its resources. This forced-teardown path emits no cleanup
acknowledgement and makes no claim that worker, library, or child copies were
zeroized; the attempt is `AMBIGUOUS`, the cell is quarantined, and the platform
receipt may claim only OS process termination and resource reclamation.
Buffer pooling, connection pooling, hibernation snapshots, application/core/
minidumps, crash uploads, TLS key logging, heap snapshots, tracing, and swap/
paging claims not proven by the platform receipt are prohibited.

Page locking and zeroization reduce exposure but do not claim protection from
the kernel, administrator, debugger, DMA, physical-memory access, or an
authorized target that copies the value. Production evidence must state the
host's paging/dump/hibernation posture and every library that necessarily
handles the value. Unsupported guarantees make the production capability
unavailable rather than silently weakening the claim.

## 9. Output suppression and safe terminal classes

All provider and target stdout, stderr, response bodies, callbacks, exception
objects, OS errors, debug channels, and crash channels remain inside bounded
broker-owned capture. Overflow immediately closes the channel and terminates
the cell. No raw byte is forwarded to the front end, logs, review evidence, or
receipt—even on success and even when scanning finds nothing.

Each output policy fixes maximum bytes, allowed protocol framing/statuses,
closed parsed fields, normalization rules, and a mapping to fixed terminal
classes. The parser rejects unknown fields, duplicate fields, invalid Unicode,
controls/bidi, redirects, reflection, provider diagnostics, and unbounded text.
It constructs its result from safe constants and independently known operation
facts; it cannot quote, truncate, hash, encode, summarize, or label raw output.

Before discard, the qualification and runtime leak guards scan raw captures and
all prospective safe fields for the synthetic/current value and registered
derived encodings, prefixes, credential-shaped structures, and unsafe metadata.
A match emits no matching detail, terminates and quarantines the adapter cell,
and records only a fixed `OUTPUT_POLICY_VIOLATION` fact for SB-TC07. Absence of
a match never promotes arbitrary output.

The only public execution outcomes are fixed enums: `SUCCEEDED`, `DENIED`,
`FAILED`, or `AMBIGUOUS`, plus a closed safe reason code owned by SB-TC07. The
classifier applies this exclusive precedence table; the first matching row
wins and no lower row may compensate:

| Precedence | Evidence | Terminal class |
|---:|---|---|
| 1 | Any contact may have occurred and target effect, response authenticity/completeness, containment, output admission, or cleanup is uncertain; or durable/volatile contact evidence was lost | `AMBIGUOUS` |
| 2 | Exact registered read-only reconciliation, using no value and causing no effect, proves the approved target effect completed exactly once and all output/cleanup gates passed | `SUCCEEDED` |
| 3 | Authenticated complete response under the registered protocol proves the approved effect completed exactly once, and output plus cooperative cleanup acknowledgement pass | `SUCCEEDED` |
| 4 | Authenticated complete response under a qualified operation-specific semantic proves the effect did not and cannot have occurred, and output plus cooperative cleanup acknowledgement pass | `FAILED` |
| 5 | Zero backend/target contact is durably proven and a pre-contact authority, readiness, identity, containment, deadline, or policy check denied | `DENIED` |
| 6 | Zero backend/target contact is durably proven and internal setup failed without an authority denial | `FAILED` |
| 7 | Anything else | `AMBIGUOUS` |

HTTP status, SDK exception class, child exit code, closed connection, timeout,
or provider text alone never proves the row-4 no-effect predicate. That
predicate is registered and qualification-tested per operation. Reconciliation
cannot override output-policy violation, cleanup uncertainty, authority-epoch
uncertainty, or evidence loss; those remain row 1.

No provider status text, response body, value length, precise timing, child
exit detail, target echo, backend locator, process path, or secret-derived
digest is public. Operation success may expose only the effect already shown in
the approved preview. Rate and timing observations are bounded by the one-use
authority path; adapters add no credential-validation oracle. Reconciliation
receives no value and cannot re-execute the effect. Automatic retries are
prohibited at HTTP, SDK, CLI, transport, helper, and broker layers.

## 10. Qualification obligations

One adapter cell is usable only after SB-TC10 records, on its exact immutable
identity:

- successful synthetic operation plus wrong lease, generation, backend,
  adapter, target, image, signer, runtime/library, operation, and output-policy
  negative controls;
- arbitrary command/argv/environment/path/helper/plugin/proxy/redirect and
  direct-value-return rejection before backend contact;
- executable replacement before and during launch, writable ancestry, loader
  injection, unregistered child/grandchild, descriptor/handle inheritance,
  IPC peer substitution, reconnect, and second-value-request trials;
- filesystem, repository, clipboard, UI/prompt, dump, trace, paging, temporary-
  file, crash-report, and exact-egress observations appropriate to the platform;
- exact, base64, URL/JSON/hex encoded, prefix/suffix, child output, exception,
  provider body, receipt, log, file, argv, environment, dump, and crash-output
  positive-control leaks, proving the harness fails and quarantines the cell;
- timeout and crash cuts before backend contact, after backend contact, during
  value crossing, before target contact, after target contact, during output,
  during child cleanup, during zeroization, after zeroization but before a valid
  cleanup acknowledgement, and before public acknowledgement, with no
  automatic retry and no zeroization claim on forced teardown;
- concurrent claim, cancellation, resource/output overflow, process-tree kill,
  locked-memory/zeroization compiled-code evidence, and restart anti-replay; and
- a real OS/platform test for every claimed control. A synthetic double never
  qualifies AppContainer, XPC/App Sandbox, seccomp/Landlock/cgroup, peer
  identity, memory locking, dump suppression, or target egress.

Qualification uses generated high-entropy synthetic values only. It never
places them in repository evidence; observations are content-free and evidence
artifacts contain only fixed case IDs, pass/fail, cell refs, and safe hashes of
non-secret binaries/configuration.

## 11. Primary-source boundary

- The [Linux kernel seccomp documentation](https://docs.kernel.org/userspace-api/seccomp_filter.html)
  and [no-new-privileges documentation](https://docs.kernel.org/userspace-api/no_new_privs.html)
  establish syscall filtering and inherited non-escalation semantics; neither
  alone proves filesystem, network, identity, memory, or child containment.
- The [Linux kernel Landlock documentation](https://docs.kernel.org/userspace-api/landlock.html)
  requires runtime ABI/errata handling and supports stacking restrictions; it
  does not authorize best-effort fallback for a claimed KStack cell.
- Microsoft's stable
  [`UpdateProcThreadAttribute` documentation](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)
  defines AppContainer security capabilities, immutable creation mitigations,
  and child-process policy. The separately documented
  [`CreateProcessInSandbox` API](https://learn.microsoft.com/en-us/windows/win32/secauthz/createprocessinsandbox)
  is experimental and therefore not a production dependency.
- Microsoft's [Job Object documentation](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
  supports kill-on-close process-tree control, while
  [`CreateProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)
  requires deliberate standard-handle and inherited-handle management.
- Apple's [App Sandbox documentation](https://developer.apple.com/documentation/security/app-sandbox)
  establishes entitlement-based filesystem/network/resource containment;
  [Apple's network-client entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client)
  explicitly does not constrain data flow to one target.
- Apple's [code-signing requirements guidance](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements),
  [XPC peer-requirement API](https://developer.apple.com/documentation/xpc/xpc_connection_set_peer_requirement),
  and [library-validation guidance](https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.cs.disable-library-validation)
  support exact packaged peer/code identity and a closed loaded-code boundary;
  they do not prove target behavior or secret erasure.
- The current [POSIX `posix_spawn` specification](https://pubs.opengroup.org/onlinepubs/9799919799/functions/posix_spawn.html)
  shows that descriptors, environment, process group, signals, IDs, and working
  directory require explicit construction; KStack does not treat defaults as
  containment evidence.

All platform documentation is mutable. Implementation qualification pins the
exact OS build, kernel/ABI, SDK, compiler, worker/adapter artifact, entitlements,
and policy receipt actually tested.

## 12. Deterministic confirmation checks

SB-TC05 closes only if the reviewer confirms on one frozen digest:

1. `ExecuteRegistered` has no arbitrary command, shell, argv, environment,
   path, endpoint, template, plugin, proxy, output, callback, or value-return
   surface.
2. The front-end protocol is value-free; only the protected worker can resolve
   the consumed lease and construct the SB-TC04 sink.
3. Immutable adapter identity binds the complete code/runtime, operation,
   target, injection, containment, egress, output, and evidence closure.
4. Check/use substitution, loaded-code drift, and unregistered child/helper
   execution fail closed before value crossing.
5. Every admitted injection profile has a bounded exact crossing; no secret
   enters argv, ordinary environment, generic stdin, file, clipboard, or model-
   visible stream.
6. Process/IPC/filesystem/network inheritance is deny-all then explicitly
   granted, and the complete process tree is resource-bounded and killed.
7. Linux, Windows, and macOS evidence is conjunctive and platform-specific;
   experimental or overly broad controls do not create a production claim.
8. Native memory handling assigns every copy to one owner, bounds its lifetime,
   excludes dumps/paging where claimed, and distinguishes acknowledged
   cooperative zeroization from forced teardown with no zeroization claim.
9. Raw provider/target output never leaves the cell. Closed parsing and positive-
   control leak detection cannot promote arbitrary content.
10. Terminal classes follow an exhaustive uncertainty-first precedence table;
    `FAILED` after contact requires a qualified authenticated proof of no
    effect, and no layer automatically retries.
11. Qualification covers substitution, escape, inheritance, egress, memory,
    output, crash-cut, concurrency, and restart cases using synthetic values.
12. The existing Git/askpass worker remains precedent only until its exact cell
    passes this contract; Jira and other current credential users receive no
    implicit conformance claim.
13. SB-TC06 through SB-TC10 retain lifecycle, receipt/audit, host, setup, and
    qualification/promotion ownership.

## 13. Review instruction

Review only SB-TC05. Return `approve` only at confidence at least 93 with zero
failed checks, security findings, material dissent, and unresolved questions on
the same candidate digest. No real credential, provider administration,
installation, deployment, or production trial is authorized by this review.
