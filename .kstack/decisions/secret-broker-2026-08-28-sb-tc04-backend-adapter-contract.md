# KStack Secret Broker — SB-TC04 backend adapter contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC04` — backend adapter, bootstrap authentication/custody, capability discovery, health, and degradation |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99` |

## 1. Decision requested

Freeze one provider-neutral boundary for the selected `os-local-v1` development
family and `openbao-v1` production/self-hosted backend. The boundary must prove
what exists, how the protected worker authenticates, which capabilities are
currently usable, and when a resolve must be denied. It must not expose a
generic secret read API or let health claims bypass the SB-TC03 lease.

This item defines adapter discovery, immutable identity, bootstrap modes,
capability evidence, readiness, resolve semantics, and degradation. SB-TC05
owns worker/process containment and target delivery. SB-TC06 owns create,
rotate, revoke, delete, recovery, and provider mutation. SB-TC07 owns exact
audit records and safe diagnostics.

## 2. Non-compensating invariants

1. The adapter is callable only by an authenticated protected worker.
   `Probe`, `DiscoverCapabilities`, and value-free `AssessReadiness` require a
   separate bounded diagnostic authority whose backend identity has no secret-
   read capability. Operation authentication and `ResolveForAdapter` require a
   current SB-TC03 lease at its pre-contact consumption point. There is no
   model-facing backend command or value response.
2. `probe`, `capabilities`, `health`, and `authenticate` cannot resolve a stored
   value. `resolveForAdapter` can release one generation only into the already
   registered SB-TC05 target callback; it cannot return bytes to its caller.
3. Backend family, immutable instance/configuration record, namespace,
   version/build, executable/library, bootstrap profile, and platform cell are
   bound through the SB-TC03 `backendInstanceRef`. Current capability/readiness
   evidence is a separately revalidated pre-contact prerequisite. Drift in
   either class denies before value release.
4. Bootstrap authority is workload identity, qualified interactive provider
   authorization, or a separately qualified OS-custodied bootstrap handle.
   Repository files, ordinary environment, argv, command text, agent sink
   files, template files, clipboard, and model-visible streams are prohibited.
5. A root, administrator, unbounded, orphaned, non-expiring, or wildcard
   bootstrap credential is not admissible for ordinary broker use.
6. Health is layered evidence, not a Boolean. Reachability, unsealed state,
   authentication, policy, namespace, audit configuration, capability, and
   synthetic target readiness are distinct and cannot substitute for one
   another.
7. A failed or stale layer makes only the affected cell unavailable. There is
   no local cache, plaintext fallback, cross-backend retry, implicit migration,
   or downgrade to a development cell.
8. Provider response bodies, errors, warnings, request IDs, accessors, lease
   IDs, locators, paths, tenant/account data, and timing details remain inside
   the protected boundary and never become public diagnostics.
9. Resolve is one network/provider attempt. Timeout, cancellation, connection
   loss, malformed success, audit uncertainty, or lost acknowledgement is
   ambiguous and is never blindly retried.
10. A capability is usable only for the exact version-pinned cell that executed
    its conformance evidence. Documentation, installation, or discovery alone
    never promotes it.

## 3. Adapter identity and configuration

```text
backend-cell-v1 = {
  schemaVersion: "kstack-secret-backend-cell-v1",
  backendFamilyId: "windows-dpapi-current-user-v1" |
                   "macos-keychain-v1" |
                   "linux-secret-service-v1" |
                   "openbao-v1",
  backendInstanceRef: opaque-ref-v1,
  platformCellId: registry-id-v1,
  adapterProtocolVersion: "kstack-secret-backend-adapter-v1",
  adapterImageRef: opaque-ref-v1,
  providerVersionRef: opaque-ref-v1,
  namespaceRef: opaque-ref-v1,
  bootstrapProfileId: registry-id-v1,
  tlsPolicyRef: opaque-ref-v1 | "not-applicable",
  capabilityRevision: generation-v1,
  configurationRevision: generation-v1,
  evidenceLevel: closed SB-TC02 evidence enum
}
```

The protected registry stores exact executable/library identity, signer/hash,
protocol version, provider build or OS version range, backend instance identity,
namespace, target policy, bootstrap method, and qualification receipt. It stores
no secret or bearer token. All refs are private and resolved from registered
configuration; a request cannot provide a path, library, endpoint, namespace,
auth method, TLS option, or command.

`backendInstanceRef` identifies the complete immutable `backend-cell-v1` body,
not a mutable provider alias. Any configuration, bootstrap route, namespace,
TLS, executable/library, provider-version, or platform-cell change creates a
new instance ref and invalidates preparation under the prior ref. Capability
and readiness revisions do not mutate that identity; they are short-lived
current evidence rechecked under the same instance before contact.

`openbao-v1` configuration fixes one HTTPS origin, canonical server name,
trusted CA/SPKI policy, minimum TLS policy, redirect prohibition, proxy policy,
namespace, auth mount/method, role, allowed API paths/verbs, response schemas,
timeouts, server version/build policy, and audit admission profile. IP literals,
HTTP, URI user info, dynamic redirects, ambient proxies, caller-supplied headers,
and alternate origins deny. Operator-managed HA endpoints are an exact
registered set sharing one verified cluster identity; they are not retry
targets after an ambiguous resolve.

## 4. Closed adapter operations

The internal adapter protocol has exactly five operations:

1. `Probe`: local, read-only verification that the registered adapter binary or
   API exists and matches its identity. No provider authentication or value
   access.
2. `DiscoverCapabilities`: read-only, version-pinned discovery against the
   registered backend instance. It emits protected facts only.
3. `Authenticate`: acquire a bounded bootstrap session inside protected memory.
   Operation mode requires the consumed SB-TC03 lease. Diagnostic mode requires
   the value-free diagnostic authority and an exact health-only role with no
   secret path capability; it may use only a qualified non-exporting workload
   identity or provider-native session and cannot open an OS-custodied bootstrap
   handle. It emits only an internal session ref and expiry.
4. `AssessReadiness`: evaluate the layered health contract without resolving
   any stored or dynamic secret.
5. `ResolveForAdapter`: consume one exact handle generation and deliver it only
   through the registered target callback for the consumed SB-TC03 attempt.

Unknown operations and fields reject. There is no list, search, raw request,
read path, decrypt, unwrap, render, export, template, shell, generic callback,
arbitrary socket, or provider passthrough. Lifecycle operations later defined
by SB-TC06 use separate schemas and authorities; they cannot be smuggled through
these five operations.

`ResolveForAdapter` accepts internal references to the consumed attempt,
authority epoch, backend cell, handle binding and generation, registered target
adapter callback, response schema, deadline, and audit prerequisites. It
revalidates byte-equality with the lease and current registries. The backend
locator is read only from the protected handle binding.

The resolution primitive is callback-shaped:

```text
resolveForAdapter(context, registeredSink) -> fixed terminal class
```

`registeredSink` is constructed by SB-TC05 from the adapter registry and cannot
be supplied by the caller. Resolved bytes remain in a broker-owned bounded
buffer, cross once into that sink, and are then discarded/zeroized where the
qualified runtime proves it. There is no intermediate serializable return,
promise value, exception body, log value, or reusable cache.

## 5. Bootstrap profiles

### OS-local development

- `windows-dpapi-current-user-v1` uses per-user DPAPI only, with broker-specific
  optional entropy protected outside the repository. Machine scope, roaming,
  Credential Locker enumeration, alternate user, unattended service promotion,
  and production claims are prohibited. Locked profile, administrative password
  reset/recovery uncertainty, identity drift, or unprotect failure denies.
- `macos-keychain-v1` uses an exact access-group/item class and qualified access
  control under the current user session. Prompt denial, keychain lock, access-
  control drift, item ambiguity, or alternate keychain denies.
- `linux-secret-service-v1` binds the exact D-Bus peer/service implementation,
  session, collection, item attributes, and prompt result. A collection may
  relock at any time; prompt loss/denial, service replacement, multiple matches,
  missing item, or relock race denies. The draft Secret Service specification
  and one implementation cannot qualify another implementation or headless/WSL.

These profiles authenticate through the current qualified OS session; they do
not mint a portable bootstrap token. They are development-only unless a later
platform cell independently proves a stronger identity boundary. The native
Windows Jira route remains retired; generic Windows custody does not authorize
a second Jira credential.

### OpenBao production/self-hosted

Bootstrap selection order is:

1. a registered workload-identity auth method whose source credential is
   non-exportable or shorter-lived than the requested operation;
2. a qualified interactive provider authorization for an attended operation;
3. a separately qualified OS-local bootstrap handle resolved inside the same
   protected worker solely to the registered OpenBao auth endpoint.

The third route is not automatic fallback. Its OS cell, OpenBao cell, auth
method, role, instance, namespace, and target operation must be jointly
qualified, and policy must select it before preparation. A bootstrap handle is
distinct from a target secret handle and cannot call `ResolveForAdapter` except
inside the closed authentication transition.

That transition constructs one protected record:

```text
bootstrap-binding-v1 = {
  schemaVersion: "kstack-secret-bootstrap-binding-v1",
  bootstrapSourceRef: opaque-ref-v1,
  sourceBackendInstanceRef: opaque-ref-v1,
  sourceHandleId: handle-id-v1,
  sourceHandleGeneration: generation-v1,
  destinationBackendInstanceRef: opaque-ref-v1,
  destinationAuthMountRef: opaque-ref-v1,
  destinationRoleRef: opaque-ref-v1,
  authorityEpoch: generation-v1,
  attemptId: opaque-ref-v1,
  expiresAt: trusted-instant-v1,
  remainingUses: 1
}
```

The immutable destination backend-cell configuration contains the route
template: exact source ref/cell plus destination OpenBao instance/auth
mount/role. `Authenticate` instantiates the per-attempt binding with the current
source generation, authority epoch, attempt, and expiry, then atomically
consumes it before asking the source OS adapter to
open the exact generation. The source adapter can cross the bounded value only
through a registry-created, one-use private callback fixed to that OpenBao
instance/auth mount/role and attempt. The callback cannot return, persist,
cache, log, renew, or reuse the bootstrap credential. Source denial, generation
drift, callback loss, destination ambiguity, or crash burns the binding and
makes authentication unavailable; it never selects another source.

The resulting OpenBao token stays in protected memory, is scoped to the exact
namespace/path/verbs needed by the registered adapter, has an explicit maximum
TTL no longer than the operation/session policy, and is revoked or allowed to
expire after its bounded use. Renewal is permitted only before effect start,
only when the provider returns a shorter current TTL within the original hard
maximum, and never converts a nonrenewable or expired token. Requested renewal
duration is advisory, so the returned lease data is revalidated. Periodic,
root, default-policy, wildcard, token-creation, token-accessor-list, audit/admin,
and `sudo` capabilities are prohibited.

KStack calls the version-pinned HTTP API directly. `bao login`, CLI output,
auto-auth file/environment sinks, templates, caching proxy, and unrestricted
agent proxy are not admitted. A future auto-auth helper requires a separately
reviewed authenticated private-socket protocol with no value sink.

## 6. Capability contract

```text
backend-capabilities-v1 = {
  schemaVersion: "kstack-secret-backend-capabilities-v1",
  backendInstanceRef: opaque-ref-v1,
  providerVersionRef: opaque-ref-v1,
  configurationRevision: generation-v1,
  capabilityRevision: generation-v1,
  custody: "stored-secret" | "dynamic-identity" | "both",
  versionedRead: true | false,
  dynamicLease: true | false,
  renewal: true | false,
  revocation: true | false,
  deletion: true | false,
  recovery: "provider-owned" | "os-owned" | "unavailable",
  auditAdmission: "provider-qualified" | "local-qualified" | "unavailable",
  maxValueBytes: 1..1048576,
  observedAt: trusted-instant-v1,
  expiresAt: trusted-instant-v1,
  evidenceReceiptRef: opaque-ref-v1
}
```

Capabilities are generated from executed read-only probes and synthetic
fixtures, never copied from documentation or inferred from a backend family.
Unknown means false/unavailable. Capability expiry is at most five minutes for
remote cells and the current authenticated OS session for local cells. Config,
version, plugin, auth-role, namespace, audit, service-peer, OS update, reboot,
sleep/resume, or evidence-receipt drift invalidates it immediately.

SB-TC06 may use only capabilities marked true on the exact current record. It
must truthfully surface unsupported lifecycle behavior; it cannot simulate
provider revocation or recovery with local flags.

## 7. Layered readiness

```text
backend-readiness-v1 = {
  schemaVersion: "kstack-secret-backend-readiness-v1",
  backendInstanceRef: opaque-ref-v1,
  authorityEpoch: generation-v1,
  configurationRevision: generation-v1,
  capabilityRevision: generation-v1,
  discovery: "pass" | "fail" | "unknown",
  transport: "pass" | "fail" | "unknown" | "not-applicable",
  providerState: "pass" | "fail" | "unknown",
  authentication: "pass" | "fail" | "unknown",
  namespacePolicy: "pass" | "fail" | "unknown",
  auditAdmission: "pass" | "fail" | "unknown",
  syntheticCanary: "pass" | "fail" | "unknown",
  overall: "ready" | "degraded" | "unavailable" | "quarantined",
  observedAt: trusted-instant-v1,
  expiresAt: trusted-instant-v1
}
```

`ready` requires every applicable layer to pass on the same current cell and
evidence window. `degraded` means safe metadata/diagnostics may remain available
but no new lease or resolve is admitted. `unavailable` means discovery or a
required dependency failed. `quarantined` means identity, version, audit,
schema, rollback, or ambiguous provider state conflicts with the registry and
requires reviewed reconciliation. No state silently clears on a later probe;
quarantine needs an explicit content-free recovery record.

For OpenBao, `/sys/health` is transport/provider-state evidence only. It is one
of OpenBao's documented non-audited paths and cannot prove authentication,
namespace policy, audit-device readiness, or secret-path permission. The cell
separately proves:

- exact TLS, cluster, version/build, namespace, and registered endpoint set;
- initialized/unsealed active or explicitly qualified HA-standby behavior;
- successful bounded diagnostic authentication to an exact health-only role,
  with returned token TTL/policies and zero secret-path capability;
- exact allow and negative-control denial on the registered synthetic path;
- at least two enabled declarative audit devices with `log_raw=false` and the
  SB-TC01 at-least-one-durable-device admission behavior;
- qualification-only successful, one-nonblocking-audit-failure,
  all-audit-failure, blocking-audit-
  stall/deadline, malformed response, token expiry/revocation, sealed, standby,
  namespace drift, and TLS drift fixtures; and
- one synthetic secret or dynamic-identity canary created solely for the
  qualification cell, never a production handle.

The canary is executed only by the qualification harness through an ordinary
synthetic SB-TC03 lease, `ResolveForAdapter`, and a registered leak-detection
sink. It is not an `AssessReadiness` operation and leaves only a content-free,
expiring qualification receipt. Routine readiness verifies that receipt,
current non-secret provider/configuration evidence, authentication, and exact
negative controls; it never reads the canary or another value. Receipt expiry
or relevant drift makes `syntheticCanary: unknown` until the authorized
qualification harness runs again.

Reading sanitized server configuration or audit-device metadata is protected
operator evidence and cannot be delegated to the ordinary secret token. KStack
does not install, initialize, unseal, configure auth, enable audit, or repair the
server. Missing operator evidence leaves audit admission unavailable.

For OS-local cells, readiness separately proves exact platform/provider
identity, authenticated session, unlocked/prompt behavior, one exact synthetic
item, multiple-match rejection, relock/lock failure, restart/sleep behavior,
and no generic enumeration or output. A synthetic double is fixture evidence,
not platform readiness.

## 8. Degradation and in-flight behavior

- Before lease issue, anything other than current `ready` denies.
- After lease issue but before effect start, readiness/config/capability drift
  denies and burns the lease with zero backend contact.
- After effect start, any loss or ambiguity follows SB-TC03 `AMBIGUOUS`; a later
  healthy probe cannot reclassify or retry that attempt.
- Expired authentication is reacquired only through a new pre-effect bootstrap
  transition that remains within the original lease deadline and profile. It
  cannot change auth method or bootstrap source.
- A backend outage never causes lookup in another backend, previous generation,
  migration source, local file, environment, OS store, or cache.
- Capability/readiness records may be cached only as protected metadata through
  their short expiry. Secret values, bootstrap tokens, provider bodies, and
  successful resolved responses are never cached.

Public status is only backend family, platform class, evidence level, and one of
`READY`, `DEGRADED`, `UNAVAILABLE`, or `QUARANTINED`, when the caller already has
inventory authority. Detailed layers and errors remain protected. Safe fixed
operation failures are `BACKEND_UNAVAILABLE`, `BACKEND_AUTH_UNAVAILABLE`,
`BACKEND_CAPABILITY_UNAVAILABLE`, `BACKEND_AUDIT_UNCONFIRMED`,
`BACKEND_IDENTITY_MISMATCH`, and `BACKEND_OUTCOME_AMBIGUOUS`.

## 9. Primary-source boundary

- [Microsoft DPAPI example and limitations](https://learn.microsoft.com/en-us/windows/win32/seccrypto/example-c-program-using-cryptprotectdata)
  support same-user/same-machine default scope and recovery-loss caveats; they
  do not support a same-user isolation or production claim.
- [Microsoft Credential Locker documentation](https://learn.microsoft.com/en-us/windows/apps/develop/security/credential-locker)
  confirms retrieval/enumeration and possible roaming behavior, so Credential
  Locker is not silently substituted for the non-roaming DPAPI cell.
- [Secret Service API 0.2 draft](https://specifications.freedesktop.org/secret-service/latest/)
  defines sessions, prompts, lock races, and secret retrieval but does not
  qualify a particular implementation or headless session.
- [OpenBao 2.6 authentication](https://openbao.org/docs/concepts/auth/) and
  [lease semantics](https://openbao.org/docs/concepts/lease/) establish token
  and dynamic-secret expiry/renewal behavior; returned renewal TTL is
  authoritative rather than the requested increment.
- [current OpenBao health API](https://openbao.org/api-docs/system/health/) and
  [current audit documentation](https://openbao.org/docs/audit/) establish that
  health status alone is not audit evidence and that blocked audit devices can
  deny or stall requests.
- The first implementation qualification target is OpenBao `2.6.1`, using an
  exact verified release artifact/container digest from the
  [official OpenBao package registry](https://github.com/openbao/openbao/pkgs/container/openbao/versions?filters%5Bversion_type%5D=tagged).
  Mutable documentation and the floating `latest` tag are not implementation
  pins. A newer release requires a new provider-version evidence receipt.

## 10. Deterministic confirmation checks

SB-TC04 closes only if the reviewer confirms on one frozen digest:

1. The five-operation adapter surface has no generic read, list, request,
   decrypt, export, shell, template, proxy, callback, or value-return channel.
2. Resolve follows a consumed SB-TC03 lease and can cross only into the exact
   registered SB-TC05 sink.
3. Immutable backend identity/configuration/version inputs are bound through
   `backendInstanceRef`; short-lived capability/readiness evidence is separately
   current and revalidated before release.
4. Bootstrap has no repository, ordinary environment, argv, sink-file, CLI-
   output, clipboard, or model-visible token path.
5. OpenBao bootstrap is least-privilege, bounded, non-root, and cannot change
   auth route as fallback; a nested OS bootstrap handle is exact-generation,
   attempt-bound, one-use, and crosses only to its registered auth callback.
6. OS-local profiles retain honest development/session boundaries and the
   native-Windows Jira credential route remains retired.
7. Capabilities come from exact executed cell evidence, expire, and never infer
   unsupported lifecycle behavior.
8. Readiness layers cannot substitute for each other; OpenBao `/sys/health`
   alone never admits resolution, and routine readiness cannot resolve a
   synthetic or production value.
9. OpenBao audit admission, version, TLS/cluster/namespace/policy, and synthetic
   canary fixtures are explicit and provider administration remains external.
10. Degradation denies new work without fallback; quarantine cannot silently
    clear; in-flight ambiguity never retries.
11. Values/tokens/bodies/errors/locators are not cached or exposed; protected
    metadata caches are short-lived and identity-bound.
12. Current Windows/Linux experimental cells and documentation receive no
    production or SB-TC04 conformance claim without the exact qualification.
13. SB-TC05, SB-TC06, and SB-TC07 retain executor, lifecycle mutation, and exact
    audit-schema ownership.

## 11. Review instruction

Review only SB-TC04. Return `approve` only at confidence at least 93 with zero
failed checks, security findings, material dissent, and unresolved questions on
the same candidate digest. No real credential, private tenant configuration,
provider administration, installation, deployment, or production trial is
authorized by this review.
