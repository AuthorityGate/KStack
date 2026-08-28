# KStack Secret Broker — SB-TC01 backend portfolio

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC01` — reuse-first contender evaluation and v1 backend portfolio |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-28 |
| Review route | Codex-only, supplied-packet-only, confidence `>=93`, all counters zero |
| Implementation | `NOT AUTHORIZED / NOT STARTED` |

## 1. Decision requested

Determine which custody/backend families KStack should design and implement
first for a provider-neutral Secret Broker. This item selects roles and v1
reference adapters only. It does not define the public handle schema, policy,
lease, executor, lifecycle, UI, migration, installation, or production
qualification. Those remain SB-TC02 through SB-TC12.

The selected portfolio must satisfy the objective's two-backend requirement:
one developer-oriented backend and one production/self-hosted backend behind
the same future closed interface. It must not require KStack to invent a vault
or cryptographic primitive, and it must not expose a provider's generic
read/decrypt/inject interface to Claude Code or Codex CLI.

## 2. Frozen inputs

- Objective:
  `.kstack/objectives/secret-broker-2026-08-28.md`
- Item ledger:
  `.kstack/decisions/secret-broker-2026-08-28-item-ledger.md`
- Existing reuse-first evidence:
  `.kstack/decisions/encrypted-credential-repository-2026-08-27-tc01-contender-selection.md`
- Existing security invariants: `plugins/kstack/references/SAFETY.md`
- Existing artifact boundary: `plugins/kstack/references/ARTIFACTS.md`

The ECR contender review closed a broader encrypted-store question at Codex 97
but does not select the Secret Broker's v1 adapters. Its reusable conclusions
are retained: eliminate credentials before storing them; distinguish root-key
non-export from entry-plaintext release; compose qualified custody/issuance
with a KStack typed broker; and reject direct model-facing read/decrypt/shell
interfaces.

## 3. Non-compensating selection gates

| Gate | Requirement for a v1 reference backend |
|---|---|
| SB-BP01 | The model-facing API cannot return, render, export, template, or enumerate secret values. |
| SB-BP02 | The future protected worker can resolve exactly one admitted handle without argv, ordinary environment, shared/persistent temporary files, stdout/stderr, or generic shell text. |
| SB-BP03 | Backend identity, namespace, account/tenant, secret/version, target, operation, and lifecycle facts can be bound to safe metadata and revalidated. |
| SB-BP04 | Authentication bootstrap uses an OS credential facility, interactive provider authorization, or workload identity; a repository file or ordinary ambient environment is not accepted. |
| SB-BP05 | Missing backend, prompt denial, network outage, stale version, revoked identity, unsupported platform, unconfirmed required audit, audit failure/stall, or adapter mismatch denies value release and fails closed without plaintext fallback or blind retry. |
| SB-BP06 | The backend has an official supported API or native platform interface, a reviewable license/service boundary, current maintenance evidence, and a path to immutable implementation pins. |
| SB-BP07 | Rotation, revocation, expiry, deletion, audit, and ambiguous provider outcome are either supported or truthfully surfaced as unavailable for that backend capability. |
| SB-BP08 | Each platform/profile is qualified independently. A developer-only user-session boundary cannot be promoted to production by configuration or score. |
| SB-BP09 | Provider-native credential elimination or dynamic short-lived identity is attempted before retrieval of a stored long-lived secret. |
| SB-BP10 | The backend can be removed or replaced without changing KStack's handle, policy, approval, lease, receipt, or audit schemas. |

## 4. Options

### Option A — OS-local development plus OpenBao production/self-hosted

KStack implements two adapter families:

1. `os-local-v1`, independently qualified as:
   - Windows Credential Manager/DPAPI or CNG-backed custody;
   - macOS Keychain, with user-presence/access-control policy where supported;
   - Linux Secret Service for an interactive desktop development cell.
2. `openbao-v1`, using a version-pinned OpenBao HTTP API from the protected
   worker, with workload-identity or separately qualified auto-auth bootstrap,
   scoped policy, KV v2 version binding for stored secrets, and dynamic-secret
   leases where the target engine supports them.

The Linux desktop Secret Service cell is explicitly `DEVELOPMENT_ONLY` and
inherits the logged-in user-session trust boundary. Headless Linux without a
qualified OpenBao/workload-identity path reports `BACKEND_UNAVAILABLE`; it does
not fall back to a plaintext file, environment value, or unqualified keyring.

OpenBao remains externally operated. KStack does not install, initialize,
unseal, configure auth methods, enable engines/audit devices, or administer the
server as part of ordinary Secret Broker setup. A separate future
administration workflow may validate or preview those operations, but it is
not an implicit broker authority.

**Advantages**

- Gives local developers a remote-independent path while providing a genuine
  API-driven, self-hosted production path.
- Reuses platform custody instead of inventing local encryption.
- OpenBao supplies policy, versioned KV, dynamic leases, revocation, auth
  methods, and audit capabilities that a KStack-native v1 would otherwise have
  to reproduce.
- Preserves a clean provider-neutral core: every handle binds one backend and
  there is no automatic replication or fallback.

**Costs and failure modes**

- `os-local-v1` is three separately qualified platform cells, not one uniform
  security guarantee. Same-user resistance is not claimed for the development
  cells.
- Linux Secret Service is desktop/session dependent and the published API is a
  draft implemented by different services.
- OpenBao has meaningful operational burden, network dependency, unseal and
  recovery obligations, and an authentication bootstrap problem. KStack must
  not turn an OpenBao token into a new long-lived plaintext file.
- OpenBao KV values and dynamic credentials are returned to the protected
  worker; OpenBao alone does not provide the no-model-value action boundary.
- The later audit item must define exact schemas and storage, but this selection
  already fixes the admission rule: OpenBao audit-backed success plus a healthy,
  durable KStack audit precondition are required before value release. A
  blocking audit device can stall requests, so the worker deadline and
  ambiguous-outcome rule remain mandatory.

**Reversibility**

The provider-neutral handle stores a backend ID plus a backend-owned opaque
locator/version identity. Backend changes create a new handle generation and
require separately approved broker-to-broker migration. No automatic sync or
fallback is allowed. Removal disables affected handles without changing core
schemas.

### Option B — Bitwarden Secrets Manager plus OpenBao

Use Bitwarden Secrets Manager as the developer/team backend and OpenBao as the
production/self-hosted backend. Bitwarden documents a cross-platform CLI, SDK,
projects, machine accounts, scoped access tokens, and event history.

**Advantages:** team sharing and cross-platform consistency are stronger than
OS-local custody; Bitwarden can also be self-hosted.

**Costs/failures:** the machine-account access token is itself a bootstrap
secret; `bws run` deliberately injects values into process environments and
`secret get` returns values, so neither is an admissible model-facing or generic
runtime path. A KStack adapter would need a version-pinned SDK/native helper,
license review, and OS custody or workload identity for its bootstrap token.
That adds a commercial/provider dependency before the core contract exists.

### Option C — 1Password plus OpenBao

Use 1Password service accounts/CLI or Connect for developer/team use and
OpenBao for production/self-hosted use.

**Advantages:** mature developer UX, secret references, vault scoping, service
accounts, and provider authorization flows.

**Costs/failures:** `op read`, `op run`, and `op inject` are intentionally able
to reveal values through stdout, environment, or generated files. Those paths
are prohibited. A Connect/SDK adapter may be viable later, but it requires a
managed account or operated Connect service, commercial terms, bootstrap
custody, and its own exact version/API qualification. It is not needed to prove
the v1 provider-neutral contract.

### Option D — KStack-native encrypted repository first

Complete ECR TC05 and TC07–TC11, implement the portable store, and use it as
both developer and production backend.

**Advantages:** maximum control over offline operation, schemas, receipts, and
cross-platform semantics.

**Costs/failures:** largest cryptographic, rollback, recovery, concurrency,
platform-custody, maintenance, and support burden. It duplicates mature
storage/lifecycle functions before external adapter insufficiency is proven.
Existing ECR work is incomplete and no runtime exists.

### Option E — provider-native identity only, with no stored-secret backend

Support only OIDC, managed identity, workload federation, passkeys,
certificates, and dynamic credentials.

**Advantages:** minimizes secret inventory and is the preferred path whenever a
target supports it.

**Costs/failures:** Jira API tokens, legacy services, local tools, recovery
material, and many developer workflows still require stored secrets. It cannot
meet the stated v1 use cases alone.

## 5. Primary-source evidence

Sources are current official documentation retrieved on 2026-08-28 unless an
explicit release is named. Mutable documentation is evidence for contender
behavior, not an implementation pin.

| Contender | Admitted evidence | Bounded implication |
|---|---|---|
| Windows | [Microsoft password handling](https://learn.microsoft.com/en-us/windows/win32/secbp/handling-passwords), [CNG/DPAPI](https://learn.microsoft.com/en-us/windows/win32/seccng/cng-dpapi), and [Credential Locker](https://learn.microsoft.com/en-us/windows/apps/develop/security/credential-locker) | Windows recommends Credential Manager/DPAPI instead of plaintext configuration. These APIs can return plaintext to an authorized process and do not establish KStack policy or model non-export. |
| macOS | [Keychain Services](https://developer.apple.com/documentation/security/keychain-services), [Keychain user-authentication controls](https://developer.apple.com/documentation/localauthentication/accessing-keychain-items-with-face-id-or-touch-id), and [Secure Enclave key protection](https://developer.apple.com/documentation/Security/protecting-keys-with-the-secure-enclave) | Keychain provides encrypted storage and access control. Secure Enclave non-export applies to supported private-key operations, not arbitrary password non-release. |
| Linux desktop | [Secret Service API 0.2 draft](https://specifications.freedesktop.org/secret-service/latest/) | Provides collections, items, sessions, prompts, and secret transfer. Implementation and headless availability vary; the API includes secret retrieval. |
| Linux services | [systemd credentials](https://systemd.io/CREDENTIALS/) | Supports service-activation delivery, optional TPM2-bound encryption, non-swappable credential memory, and namespace restriction. Service code still receives plaintext, so it is a future execution/custody contender rather than a model-facing store API. |
| OpenBao | [2.5.x KV v2 API](https://openbao.org/api-docs/2.5.x/secret/kv/kv-v2/), [authentication](https://openbao.org/docs/concepts/auth/), [auto-auth](https://openbao.org/docs/agent-and-proxy/autoauth/), [leases/revocation](https://openbao.org/docs/concepts/lease/), [audit devices](https://openbao.org/docs/audit/), and [MPL-2.0 source/releases](https://github.com/openbao/openbao) | Provides a maintained self-hosted API, versioned KV, auth methods, dynamic leases, revocation, and auditing. Clients receive protected values; KStack still needs its own contained worker and typed operation fence. The deployable release must be freshly pinned during SB-TC04 qualification. |
| Bitwarden | [Secrets Manager CLI](https://bitwarden.com/help/secrets-manager-cli/) and [machine accounts](https://bitwarden.com/help/machine-accounts/) | Cross-platform CLI/SDK, scoped programmatic accounts, and events are useful. Environment injection and token bootstrap are incompatible with direct v1 use. |
| 1Password | [CLI secret references and script integration](https://developer.1password.com/docs/cli/secrets-scripts) | Service accounts can scope vault access, but documented `read`, `run`, and `inject` surfaces release secrets to stdout, environment, or files. A future narrow SDK/Connect adapter requires separate qualification. |

## 6. Provisional selection

Select **Option A** for the next design items, subject to Codex closure:

1. Every preparation first evaluates a target-specific `identity-elimination`
   route. When a qualified workload identity, OIDC exchange, certificate,
   passkey, or dynamic-secret engine can perform the operation with shorter
   authority, stored static-secret retrieval is not selected.
2. `os-local-v1` is the developer reference family. Windows, macOS, and Linux
   desktop are independent qualification cells. Each is explicitly
   user-session scoped and non-production unless a later platform design proves
   a stronger separate identity boundary.
3. `openbao-v1` is the production/self-hosted reference backend. It uses the
   HTTP API only from a protected worker and prefers workload identity or a
   separately qualified auto-auth flow. It never exposes `bao read`, CLI
   templating, agent sinks, environment injection, or an unrestricted proxy to
   the model-facing process.
4. 1Password and Bitwarden remain named future adapter candidates, not v1
   dependencies. Their generic read/run/inject paths are permanently prohibited
   even if a future SDK adapter is added.
5. The ECR remains a fallback candidate. It can enter implementation selection
   only if a later evidence record names an unmet hard requirement in both
   `os-local-v1` and `openbao-v1` and the incomplete ECR proof obligations are
   closed independently.
6. A handle is permanently backend-bound for one generation. There is no
   automatic copy, synchronization, failover, local cache, or fallback between
   backends. Migration is a separately approved lifecycle operation.

### Portfolio-level audit admission invariant

`openbao-v1` is admissible only for a qualification cell that proves all of the
following before activation:

1. The OpenBao server has at least two enabled audit devices. The cell's
   provider audit condition is the documented `at-least-one-durable-device`
   success rule; KStack does not claim every configured device recorded every
   request.
2. The version-pinned OpenBao behavior used by the cell establishes that an
   authenticated successful response is not returned unless at least one
   enabled audit device accepted the request record. The qualification evidence
   includes successful, one-nonblocking-device-failed, all-devices-failed, and
   one-device-blocking fixtures.
3. Before backend contact, the KStack protected service has durably recorded a
   content-free intent bound to the prepared operation, principal, repository,
   environment, handle generation, backend, target, policy, approval, and
   attempt. If that write is unavailable or indeterminate, no backend request is
   made.
4. After an authenticated OpenBao success, the worker validates the expected
   response schema and non-secret request identity and durably records a
   content-free `RESOLVED_READY` fact before the value can cross into the
   registered target adapter. This is an ordering requirement; SB-TC07 owns the
   exact record schema and storage protocol.
5. Non-success, missing/malformed request identity, TLS/identity drift,
   deadline, connection loss, blocking audit-device stall, local audit failure,
   or any response whose provider-audit status cannot be established causes the
   worker to discard/zeroize the resolved buffer where the qualified runtime can
   prove that operation, deny target release, and return only
   `BACKEND_AUDIT_UNCONFIRMED` or `BACKEND_OUTCOME_AMBIGUOUS`. It never falls
   back, reissues the read, or exposes provider body/error text.

This item does not claim that KStack can read the provider's audit log for every
request or prove remote storage durability independently. The qualification
cell explicitly relies on the version-pinned provider response contract and
records that dependency. If the provider contract, server audit configuration,
or KStack audit channel cannot be verified, `openbao-v1` is unavailable for that
cell. SB-TC07 may strengthen this rule but may not weaken it.

## 7. Deterministic confirmation checks for this item

SB-TC01 closes only if the reviewer confirms all of the following on this exact
candidate:

1. The selection covers one developer backend family and one
   production/self-hosted backend without treating a user-session profile as
   production.
2. Credential elimination/dynamic identity is ordered before stored-secret
   retrieval.
3. No selected provider's generic read/decrypt/run/inject/template/proxy path is
   exposed to the model-facing process.
4. Bootstrap authentication never requires repository or ordinary environment
   storage and has a fail-closed unavailable state.
5. Backend identity and version can be bound without defining the future public
   handle schema in this item.
6. The option is reversible and includes no silent copy, sync, cache, failover,
   or fallback between backends.
7. The ECR fallback condition is evidence-based and cannot be self-authorized by
   implementation convenience.
8. Official sources support every provider behavior used in the selection,
   including the bounded OpenBao at-least-one-audit-device success rule;
   mutable documentation is not presented as a deployable version pin.
9. All provider administration, account creation, installation, authentication,
   secret entry, migration, and mutation remain outside this design authority.
10. Later items retain ownership of public schemas, identity/policy, adapter
    protocol, executor containment, lifecycle, audit, host projection, UX,
    qualification, packaging, and integration.
11. The portfolio-level audit admission invariant denies value release on
    missing, failed, stalled, or indeterminate required audit and leaves only
    the exact audit schema/storage mechanics to SB-TC07.

## 8. Review instruction

Review only SB-TC01. Return `approve` only if confidence is at least 93 and all
four arrays—failed checks, security findings, material dissent, and unresolved
questions—are empty. A high score with any current defect remains `revise`.
Do not inspect files, call tools, propose implementation, or re-review another
Secret Broker item. No real secret or private tenant configuration is present
or authorized.
