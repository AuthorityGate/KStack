# Encrypted credential repository — initial objective and design

**Thread:** `encrypted-credential-repository-2026-08-27`
**Status:** `OWNER-DECISIONS-LOCKED`
**Implementation status:** `NOT IMPLEMENTED`
**Authority boundary:** design artifact only. No implementation, external
review, stage, commit, push, deployment, or publication is authorized.

## Objective

Design a KStack-governed protected repository for machine and service access
material used by Claude Code and Codex CLI. The protected execution boundary
must use the minimum scope for one exact operation without returning sensitive
values to either model, prompt, repository, command arguments, process
environment, logs, audit output, Git, Jira, clipboard, or ordinary tool output.

The design must cover Windows, macOS, and Linux custody profiles, a portable
recovery option, repository/environment separation, least-privilege use,
rotation, revocation, recovery, migration, fail-closed behavior, and exact
platform qualification.

## Current KStack boundary

This design is grounded in:

- `plugins/kstack/references/SAFETY.md`: the current Git path keeps one exact
  access record outside repositories, opens and descriptor-revalidates it only
  inside an isolated worker, passes it through a private one-use socket, and
  excludes it from arguments, environment, and output;
- `plugins/kstack/references/ARTIFACTS.md`: durable project artifacts cannot
  contain protected values or unnecessary personal data;
- `plugins/kstack/references/CONFIG.md`: the same authority matrix applies in
  every phase and production access is a separate qualification;
- `.kstack/decisions/reuse-first-option-gate-2026-08-26-integration-design.md`:
  material capabilities compare adopt, adapt, compose, and build before detailed
  implementation design;
- `.kstack/decisions/host-portability-2026-08-26-item-ledger.md`: protected
  context, replay, evidence, broker, receipt, activation, and recovery mechanisms
  are validated design-only and are not implemented or production-qualified.

The current Git path is one format and one use case. It is not a general vault,
cross-platform custody layer, recovery system, or proof that arbitrary
Claude/Codex operations can safely consume protected values.

## Reuse-first objective

Before choosing storage or cryptographic libraries, compare current managed and
self-hosted access-management services, established local vaults and OS custody
services, encrypted-file tools, and audited primitive libraries. Representative
research candidates may include Vault/OpenBao-, 1Password-, Bitwarden-,
KeePass-, SOPS-, and age-class systems, but this artifact makes no claim about
their current features and does not select one.

Compare offline availability, non-export action use, both CLI hosts,
multi-repository separation, hardware custody, recovery, rotation/revocation,
audit integrity, rollback resistance, concurrency, licensing, maintenance,
build provenance, migration, automation, and operating burden. Research is
read-only: no installation, login, upload, activation, or contender execution.

The recommended evaluation direction is `COMPOSE`: KStack owns authorization,
scope, leases, action fencing, safe receipts, and host adapters while a qualified
OS custody service and audited cryptographic implementation own primitive key
protection. A KStack-native encrypted data store is selected only if the gate
proves that existing systems cannot meet the exact local, model-non-export, and
dual-CLI requirements.

## Threat model

Assets include current and historical protected values; root, wrapping, scope,
entry, audit, and recovery keys; identity/scope metadata; approval and use-lease
state; revocations; encrypted-store freshness; audit anchors; and backups.

Attack and failure paths include hostile repository instructions; compromised
CLI plugins, tools, MCP servers, adapters, hooks, subprocesses, formatters, or
targets; another OS user or opportunistic same-user process; stolen vault,
backup, or recovery bytes; link/reparse/ACL/namespace races; rollback, fork, or
torn writes; wrong provider, tenant, repository, environment, or target;
redirect/proxy substitution; output, dumps, swap, clipboard, history, or
telemetry; device/OS loss; unavailable TPM/keychain; and incomplete provider
rotation.

Hardware custody protects an at-rest root but not data after a legitimate
release. A compromised kernel/administrator/debugger or already-authorized
target is outside the confidentiality claim. Hooks add denial/detection but do
not replace the protected worker. Production is unavailable when execution,
custody, anti-rollback, or output containment cannot be proven on the exact
platform and operation profile.

## Proposed architecture

Claude Code and Codex CLI send safe metadata and one prepared operation to a
KStack protected control plane. That control plane binds context, policy,
approval, a one-use lease, and the action fence. A local encrypted store then
permits one isolated adapter/worker to act on the exact target.

The model-facing interface supports safe opaque-ID metadata and operation
preparation. It has no general value-return, prompt expansion, plaintext
resource, or bulk-export method. The worker injects the selected value only
through a registered narrow mechanism such as an inherited descriptor, private
socket, native callback, or SDK handle. Arguments, process environment,
repository files, shared temporary files, and model responses are forbidden.
If a target can expose the value through uncontained output, debug facilities,
children, or plugins, its profile is unsupported.

### Store and transaction boundary

The default store is outside all repositories in a protected per-user
application-data location. It has a random store ID, exact owner/ACL, no link or
reparse aliases, and handle-relative access. Versioned objects cover the header,
root-custody slots, scoped entries, policies, revocations, audit chain, rollback
anchors, and backup manifests.

Every object is canonical, bounded, authenticated, versioned, and bound to one
immutable generation. Unknown algorithms/schemas/fields, duplicate IDs, missing
chain records, rollback/fork, corruption, partial writes, or future versions
block. Mutations use a qualified intent, compare-and-swap, durability, and
deterministic committed/recovered/ambiguous protocol. Readers acquire one
generation handle; filenames and timestamps never decide truth.

### Encryption and hierarchy

One independently generated vault-root value is protected by one or more
platform or recovery custody slots. Separate repository/environment domains
protect independent per-entry-version data values. Audit, metadata, and backup
domains are separate and cannot open entry payloads.

The exact AEAD, portable-slot derivation, domain derivation, provider/library,
nonce rules, limits, transcript, errors, vectors, and build provenance are
frozen only after ECR-TC03 reuse-first review. Candidate families are
XChaCha20-Poly1305 or AES-256-GCM, HKDF-SHA-256, and Argon2id. KStack never
invents a primitive.

Authenticated associated data binds algorithm/schema, store/scope/entry/version,
value type, provider/tenant/target, repository/environment/operation policy,
lifecycle, and prior-version digest. Nonce uniqueness follows the qualified
profile, never wall time. Reusable plaintext fingerprints and value-based
deduplication are forbidden because they can create confirmation oracles.

### Platform custody and recovery

Each host selects a separately qualified profile rather than a weak common
fallback: Windows evaluates OS user/device protection and CNG/TPM wrapping;
macOS evaluates Keychain and Secure-Enclave/access-control wrapping; Linux
evaluates OS custody for development and TPM2 or a protected service identity
for production. The portable profile uses Argon2id-based wrapping plus a
separately generated offline recovery artifact.

Exact API and security claims require platform qualification. Measured-boot
binding must include update/reseal and offline recovery so a routine OS update
does not cause permanent loss. Production/user-data profiles default to
qualified OS/hardware custody and rollback evidence. A portable-only downgrade,
if owner-permitted, binds scope, expiry, full risk readback, and audit; it cannot
waive any other failed predicate.

### Scope and multi-repository separation

Each entry binds an opaque ID/type, provider/tenant/account/target digests,
allowed authenticated repositories/environments/operations/adapters/principals,
version/lifecycle/expiry, policy, encrypted-payload digests, and safe labels.
Labels never grant access.

Default scope is one immutable repository identity and one environment derived
inside the protected context, not a model-provided path. A global entry needs an
explicit owner policy naming all principals, providers, targets, adapters,
operations, and environments. Repository A cannot enumerate the existence,
labels, failures, or timing of Repository B entries. Development and production
use separate cryptographic domains; promotion creates a new production version
instead of relabeling development data.

### Least-privilege use lease

A request binds principal/session, host/repository/root, entry/version,
provider/tenant/target, operation/class, adapter/executable digest, exact action
digest, approval, attempt/idempotency, TTL/use count, output policy, active set,
policy/restriction epoch, and store generation. The control plane returns only
denial, a safe full owner question, or an opaque prepared handle.

After required approval, a single-operation, single-attempt, non-transferable
lease uses the shortest entry/policy/approval/session expiry. Immediately before
use, the worker rechecks every bound field, current version, revocation, and
target, then consumes the lease at the serialized action boundary. Change fences
use. Timeout or output loss after possible action is ambiguous and never
triggers blind repetition.

### Claude Code and Codex CLI integration

Both hosts consume one KStack-native preparation/use contract, but enforcement
claims remain distinct. Claude's bounded hook may deny direct patterns and ask
only for a prepared attested action; it is not the vault. Codex remains deny-only
under the current hook and uses an explicit KStack skill/adapter; the main
scheduler relays any required owner question. Neither host receives protected
values. Each adapter returns only a fixed receipt or safe allowlisted error.

MCP tools/resources exposing protected values are forbidden. A future local MCP
projection may expose safe metadata/preparation only after separate principal,
transport, and output review. The existing public read-only facade is never an
access route. Each target requires a registered injection/output adapter;
unsupported generic shell execution remains unsupported rather than receiving
protected material through its environment.

## Lifecycle, redaction, audit, and recovery

Versions move through staged, active, retiring, revoked, quarantined/corrupt,
and destroyed-domain states. Rotation atomically publishes a new encrypted
version/current pointer. Existing leases remain pinned and policy-fenced. After
an explicit overlap/recovery window, old per-version protection is destroyed and
a non-replay tombstone remains. Repository rotation does not imply provider-side
rotation; that is a separately authorized action. A possibly acted provider
change becomes ambiguous and blocks until query-only reconciliation proves it.

Raw values never enter generic logs or redaction configuration. A protected
worker may perform bounded in-memory exact suppression on its one credentialed
stream, but emits only fixed typed facts. Unqualified stdout/stderr is discarded.
Debugging, dumps, tracing, shell echo, child inheritance, history, telemetry, or
exception paths that cannot be contained make the adapter unavailable.

The append-only audit chain stores safe entry/version IDs, encrypted-object and
policy digests, principal/repository/environment/operation/target digests,
lease/approval/receipt IDs, decision/reason, generation, trusted time, and prior
record digest. It excludes raw values, reusable value fingerprints, recovery
material, protected request bodies, output, and cryptographic material.
Production requires a separately protected audit-integrity domain and qualified
rollback-evident OS/hardware/external anchor. Loss, fork, or rollback blocks new
production use and mutation; it never starts a fresh chain silently.

Backups contain authenticated encrypted objects, generation manifest,
revocations/tombstones, policies, audit, and custody-slot metadata, never an
unprotected root. Restore targets a separate location, verifies the complete
chain and rollback anchor, opens through an approved custody slot, and passes a
synthetic non-effecting qualification before atomic activation. It never picks
the newest filename or drops later revocations. Offline recovery creation and
confirmation is a human-only ceremony outside model context.

Crypto-shredding cannot prove physical deletion from SSDs, journals, snapshots,
or retained backups; the audit retains that residual risk. Unavailable custody,
lost recovery, or unprovable freshness is `RECOVERY_REQUIRED` or
`ROLLBACK_UNPROVEN`, never authority to weaken access.

## Development and production defaults

| Control | Development | Production/user data |
|---|---|---|
| Value class | synthetic/sandbox only by default | explicitly classified production entry |
| Custody | qualified OS service; portable profile allowed with warning | qualified OS/hardware identity and rollback anchor required by default |
| Raw reveal | disabled | disabled; no model-accessible override |
| Approval | finite sandbox policy may preapprove | exact current or durable scope under authority matrix; no blanket expansion |
| Unattended use | sandbox adapter plus finite lease | separately approved service identity, exact target/action/budget/expiry and qualified worker only |
| Backup | local encrypted backup recommended | verified encrypted backup and confirmed offline recovery required before activation |
| Audit anchor | weaker local profile labeled non-production | protected rollback-evident anchor required |
| Portable-only mode | allowed with warning | blocked by default; exact owner risk acknowledgement if permitted |
| Export/sync | disabled | disabled; separate transport/metadata/recovery review |

Development success never qualifies production. A model-selected environment
cannot change classification, and fixtures use only synthetic values in a
separate disposable store.

## Migration and fail-closed behavior

Migration inventories only owner-named sources; it never crawls home directories
or repositories. Initial candidates are the current external Git access record,
separately configured Jira/provider sources, and explicit owner-selected inputs.
The protected worker safely opens/revalidates one source, creates an encrypted
entry, performs a non-effecting adapter validation, and emits a safe receipt.
The original remains until the owner separately approves its exact deletion
after activation and backup proof. Import failure leaves it untouched. A value
found inside a repository is an incident/quarantine input, not auto-imported or
auto-deleted.

New use and mutations block on unavailable custody; wrong principal/repository/
environment/target; stale approval/lease; revocation/policy/generation drift;
unknown schema/algorithm; authentication failure; nonce/custody ambiguity;
rollback/fork; incomplete rotation/migration; audit-anchor loss; identity/ACL/
link mismatch; unqualified injection/output; currentness failure; or a possibly
acted operation. There is no insecure switch, permission skip, environment/file
fallback, generic-shell path, old-generation fallback, or model-approved bypass.

An owner-approved portable production downgrade, if selected, accepts only the
disclosed custody residual risk. It cannot waive wrong-target, corruption,
revocation, redaction, rollback, qualification, authority, or ambiguity blocks.

## Verification and qualification

Required evidence includes:

1. independent known-answer and cross-implementation vectors for all encryption,
   derivation, wrapping, canonical object, and associated-data rules;
2. wrong-domain/context/nonce/version/algorithm, corruption, truncation,
   duplicate, oversize, rollback, fork, and hostile-ciphertext tests;
3. crash injection around every journal, slot, rotation, revocation, audit,
   backup, restore, migration, lease, and action transition;
4. concurrency across both CLIs/repositories, rotation/revocation during use,
   stale workers, process death/PID reuse, and multiple restores;
5. prompt-injection, cross-repository enumeration/use, target substitution,
   link/reparse/ACL races, malicious adapter, child/debug/log/dump/swap/history/
   telemetry leakage, and raw MCP exposure tests;
6. exact Windows/macOS/Linux custody qualification including update/reseal,
   key-service lock/reset, device/OS loss, and rollback-anchor loss;
7. both-CLI end-to-end tests with synthetic/disposable targets proving models and
   outputs never receive protected values and unsupported execution blocks;
8. backup/restore/offline-recovery drills preserving revocations and rejecting
   stale backup activation; and
9. dependency/license/SBOM/build-provenance and repository content scans on the
   exact implementation closure.

Production requires the exact platform/custody/adapter/output/recovery profile
to pass. Seam tests and design scores are insufficient.

## Bite-size design plan

| Item | Isolated boundary |
|---|---|
| ECR-TC01 | Scope, contender evidence, adopt/adapt/compose/build selection, licenses, rejected options |
| ECR-TC02 | Threats, principals, repository/environment identity, authority and policy schemas |
| ECR-TC03 | Algorithms, canonical envelopes, hierarchy, limits, nonce/oracle resistance |
| ECR-TC04 | Windows/macOS/Linux custody, TPM/keychain semantics, portable recovery ceremony |
| ECR-TC05 | Transactional store, generations, concurrency, rollback/fork detection, backup format |
| ECR-TC06 | Entries, scoped requests/leases, approvals, restriction epochs, rotation/revocation |
| ECR-TC07 | Claude/Codex adapters, isolated injection, target/output containment, unsupported paths |
| ECR-TC08 | Safe audit, redaction, incident/quarantine, provider change/reconciliation |
| ECR-TC09 | Migration, export/sync, backup/restore, crypto-shredding, recovery drills |
| ECR-TC10 | Tests, qualification, install/deploy/upgrade/uninstall, production activation |

Each item is reviewed/repaired independently. A score on one cannot close
another, and one finding never triggers a full-plan rewrite. No implementation
handoff exists until all required item and owner decisions close.

## Full owner decisions — answer each Yes, No, or Comment

### ECR-Q1 — V1 product boundary

**Question:** Should V1 be limited to machine/service access material used by
KStack operations—service sign-ins, API access records, client keys/certificates,
and similar opaque values—while browser autofill, personal account management,
TOTP, team sharing, and consumer UX remain separate future objectives?

**Recommended:** Yes. This keeps the protected action-use boundary testable and
does not silently become a multi-user consumer product.

**Responses:** Yes / No / Comment

### ECR-Q2 — Reuse-first before cryptographic implementation

**Question:** Must KStack complete the source-grounded adopt/adapt/compose/build
comparison and prefer a qualified existing vault/custody service when it meets
the boundary before authorizing any KStack-native encrypted-store implementation?

**Recommended:** Yes. KStack should own governance/integration where a stronger
existing implementation can carry primitive and storage work.

**Responses:** Yes / No / Comment

### ECR-Q3 — Production root custody

**Question:** For production access or environments containing user data, should
qualified OS/hardware root custody plus a rollback-evident anchor be required by
default, with portable-only custody blocked unless the owner approves one exact
time-bounded downgrade after a full risk readback?

**Recommended:** Yes. The downgrade may accept custody risk only and cannot waive
wrong-target, corruption, revocation, redaction, or qualification failures.

**Responses:** Yes / No / Comment

### ECR-Q4 — Offline recovery

**Question:** Should production activation require the owner to create, confirm,
and separately store one offline recovery artifact, while development may
proceed without it only after a clear data-loss warning?

**Recommended:** Yes. Device, OS, or TPM loss otherwise risks permanent loss.

**Responses:** Yes / No / Comment

### ECR-Q5 — Raw reveal/export

**Question:** Should raw value reveal/export remain unavailable to Claude,
Codex, MCP, prompts, and ordinary tools, with supported use limited to brokered
action-bound execution; any future human-only reveal/export would require a
separate reviewed objective and explicit local ceremony?

**Recommended:** Yes. This is the strongest control against prompt injection and
model/log exposure.

**Responses:** Yes / No / Comment

### ECR-Q6 — Multi-repository separation

**Question:** Should entries default to one authenticated repository and one
environment, with cross-repository/global use denied unless the owner creates an
explicit policy naming every allowed principal, provider, target, operation,
adapter, and environment?

**Recommended:** Yes. A path or model label must never widen access.

**Responses:** Yes / No / Comment

### ECR-Q7 — Git/Jira and encrypted sync

**Question:** Should Git and Jira remain prohibited for protected material,
including ciphertext by default, while off-device encrypted backup/sync is
deferred to a separate transport, metadata, rollback, and recovery design?

**Recommended:** Yes. Encryption alone does not resolve metadata, retention,
fork, stale-revocation, and recovery risks.

**Responses:** Yes / No / Comment

### ECR-Q8 — Unattended production use

**Question:** Should unattended production use be permitted only for a separately
approved service-identity profile binding the exact entry, repository/environment,
target, operation, adapter, finite budget, expiry, receipt, and qualified worker,
while other production uses require current human approval?

**Recommended:** Yes. This supports release automation without a broad background
lease.

**Responses:** Yes / No / Comment

### ECR-Q9 — Migration deletion boundary

**Question:** Should migration process only owner-named sources, retain each
original until encrypted activation and backup are proven, and require a second
exact destructive approval before deleting the original source?

**Recommended:** Yes. Import success must not become deletion authority.

**Responses:** Yes / No / Comment

### ECR-Q10 — Fail-closed production availability

**Question:** If custody, rollback anchor, audit chain, qualified injection/output
adapter, or store freshness cannot be proven, should production use block and
emit one full recovery/owner question rather than fall back to environment
variables, unencrypted files, generic shell execution, or an older generation?

**Recommended:** Yes. Availability loss is preferable to exposure, wrong-target
use, or revoked-version replay.

**Responses:** Yes / No / Comment

## Next permitted action

ECR-Q1 through ECR-Q10 are locked Yes by the owner readback below. Begin only
ECR-TC01 read-only reuse-first research. Do not install, execute, log in to, or
activate a contender; do not dispatch this artifact to a reviewer; and do not
start ECR-TC02 or any implementation without the corresponding authority.

## Owner decision readback and lock — 2026-08-27

**Source answer:** the owner answered **Yes to all ECR-Q1 through ECR-Q10**.
This is an exact all-ten affirmative response to the full questions and
recommended consequences recorded above.

| Decision | Locked answer | Binding consequence |
|---|---|---|
| ECR-Q1 V1 product boundary | `YES` | V1 remains machine/service access material for KStack operations; browser autofill, personal account management, TOTP, team sharing, and consumer UX remain separate objectives. |
| ECR-Q2 reuse-first | `YES` | Complete source-grounded adopt/adapt/compose/build comparison and prefer a qualified existing vault/custody service when it satisfies the boundary before any KStack-native encrypted-store implementation. |
| ECR-Q3 production custody | `YES` | Production/user-data use defaults to qualified OS/hardware custody plus rollback evidence; portable-only custody needs one exact time-bounded owner risk acknowledgement and cannot waive other safety failures. |
| ECR-Q4 offline recovery | `YES` | Production activation requires one confirmed separately stored offline recovery artifact; development omission requires a clear data-loss warning. |
| ECR-Q5 raw reveal/export | `YES` | Claude, Codex, MCP, prompts, and ordinary tools receive no raw reveal/export; supported use is action-bound, and any future human-only reveal/export is a separate reviewed objective and ceremony. |
| ECR-Q6 multi-repository separation | `YES` | Default scope is one authenticated repository and environment; broader use needs an explicit owner policy naming all allowed principals, providers, targets, operations, adapters, and environments. |
| ECR-Q7 Git/Jira and sync | `YES` | Git and Jira remain prohibited for protected material, including ciphertext by default; off-device backup/sync requires separate transport, metadata, rollback, and recovery design. |
| ECR-Q8 unattended production | `YES` | Unattended production use requires a separately approved service-identity profile with exact entry, scope, target, operation, adapter, finite budget, expiry, receipt, and qualified worker. |
| ECR-Q9 migration deletion | `YES` | Migration processes only owner-named sources, retains originals until activation/backup proof, and requires a second exact destructive approval before deletion. |
| ECR-Q10 fail-closed production | `YES` | Unproven custody, rollback anchor, audit, adapter/output containment, or freshness blocks production; no environment, unencrypted-file, generic-shell, or old-generation fallback. |

The owner decisions resolve the ten initial design forks only. They do not
authorize implementation, dependency installation, contender execution,
credential discovery/read/import, key generation, OS-custody access, real-value
testing, reviewer/model dispatch, staging, commit, push, deployment,
publication, destructive migration cleanup, or production activation.

The locked next action is **ECR-TC01 read-only reuse-first research only**.
Every later ECR item remains isolated and authority-gated; a result on ECR-TC01
cannot close or authorize ECR-TC02 through ECR-TC10.
