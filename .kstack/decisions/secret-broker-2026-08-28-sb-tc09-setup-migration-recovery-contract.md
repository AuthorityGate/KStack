# KStack Secret Broker — SB-TC09 setup, migration, and recovery contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC09` — setup, backend selection, repository enrollment, no-echo input, protected-source migration, recovery, uninstall, and rollback |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC04 `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925`; SB-TC05 `57f18fcbb172327ef85ea3e56be8fa29f7e40be233b8c884223fc793158e1d3d`; SB-TC06 `62e7863ff75922922d3b26bea25fd2aa7e8615d1c18a6d9412275d50d06b2e71`; SB-TC07 `6635aa11e3769c33541a0807fdedd7d497ae7274f01054d2ee9e83703a4d5a4b`; SB-TC08 `d15fdce75567e4dbb7d5e7400ae48aca21749a7d817f703d0947beb6b3ba966d` |

## 1. Decision requested

Freeze the owner journey and transactional boundaries for installing the Secret
Broker front end, selecting and qualifying custody, enrolling a repository,
entering or importing a value without model exposure, validating a migration,
recovering after loss, uninstalling software, and rolling back a failed setup.

The design must prevent “setup” from becoming hidden credential discovery,
automatic migration, provider administration, source deletion, or plaintext
fallback. It must also preserve this repository's established decision: Jira
custody and execution are WSL-only, while native Windows reaches Jira through
the fixed credential-free Windows-to-WSL handoff.

## 2. Non-compensating rules

1. Installation, backend discovery, backend provisioning, backend
   qualification, inventory, enrollment, migration, source retirement,
   uninstall, and provider-data destruction are separate actions and separate
   authority decisions.
2. KStack never scans for `.env`, credential, key, wallet, keychain, browser,
   shell-history, cloud-config, SSH, or provider files. It never opens a
   secret-bearing source through a generic model-facing reader to learn its
   format, labels, field count, delimiters, length, or contents.
3. A value enters only an attempt-bound no-echo provider UI, host-owned input
   adapter, target-generated route, or an exact-format protected importer. It
   never crosses chat, argv, ordinary environment, clipboard instructions,
   repository/shared temporary files, stdout/stderr, Jira, review, support, or
   ordinary logs.
4. Presence, configuration, and synthetic qualification are different facts.
   An installed provider is not ready; a ready backend is not a qualified
   backend/adapter/target cell; one platform's result never transfers.
5. Backend choice is explicit and persistent. Failure never silently falls
   back to a file, another OS vault, another host, another provider, or a second
   credential copy.
6. Enrollment creates a destination generation but does not complete migration.
   The source remains untouched until every validation and observation gate
   passes and the owner separately authorizes exact source retirement.
7. Source retirement never claims that backups, sync replicas, screenshots,
   chat, logs, target copies, provider replicas, or filesystem snapshots were
   erased. A source that cannot be retired safely remains recorded as retained.
8. Uninstall preserves custody/provider data by default. Removing KStack code
   cannot revoke, rotate, delete, destroy, or export a secret.
9. Rollback may restore code/configuration compatibility. It never makes an old
   credential generation current, retries an ambiguous effect, or resurrects a
   retired/destroyed source.
10. Recovery has no plaintext export or emergency generic read. If the selected
    provider/identity recovery path is absent or unqualified, the exact cell is
    unavailable and remediation creates a new credential through SB-TC06.
11. Every provider or target mutation uses SB-TC06, every protected execution
    uses SB-TC05, every approval uses SB-TC03/SB-TC08, and every phase is
    admitted by SB-TC07 audit. Setup has no bypass API.
12. Any value emitted to a model-visible or uncontrolled channel is treated as
    compromised. KStack blocks enrollment/use and guides a separately
    authorized rotation while recording only a content-free incident.

## 3. Separate state machines

### Installation state

```text
NOT_INSTALLED -> STAGED -> INSTALLED_DISABLED -> INSTALLED_ENABLED
STAGED -> ROLLED_BACK
INSTALLED_DISABLED -> INSTALLED_ENABLED | SOFTWARE_REMOVED
INSTALLED_ENABLED -> INSTALLED_DISABLED
INSTALLED_DISABLED -> SOFTWARE_REMOVED
```

Installation changes only versioned KStack artifacts, host registration,
value-free configuration, and safe recovery metadata. It cannot create a
backend object, handle, generation, secret source, provider policy, audit
device, or target credential. `INSTALLED_ENABLED` means the front end is
registered; no backend availability claim follows.

### Repository enrollment state

```text
NOT_ENROLLED -> INVENTORIED -> BACKEND_SELECTED -> CELL_QUALIFIED -> ENROLLED
INVENTORIED | BACKEND_SELECTED -> BLOCKED_UNQUALIFIED
ENROLLED -> SUSPENDED | UNENROLLED_METADATA_RETAINED
SUSPENDED -> ENROLLED | UNENROLLED_METADATA_RETAINED
```

Repository enrollment binds namespace, environment, policy, selected backend
instance, target/adapter registry, audit namespace, retention class, and safe
inventory. It contains no value or provider locator. Unenrollment does not
change provider custody or source state.

### Per-entry migration state

```text
INVENTORIED -> READY_FOR_NO_ECHO | BLOCKED_UNQUALIFIED
READY_FOR_NO_ECHO -> INPUT_RESERVED -> DESTINATION_STAGED
DESTINATION_STAGED -> DESTINATION_VALIDATED | ABANDONED | AMBIGUOUS
DESTINATION_VALIDATED -> PILOT_VALIDATED
PILOT_VALIDATED -> ROTATION_VALIDATED
ROTATION_VALIDATED -> RECOVERY_VALIDATED
RECOVERY_VALIDATED -> OBSERVING
OBSERVING -> MIGRATED_SOURCE_RETAINED | VALIDATION_REVOKED
MIGRATED_SOURCE_RETAINED -> SOURCE_RETIREMENT_APPROVED
SOURCE_RETIREMENT_APPROVED -> SOURCE_RETIREMENT_CONFIRMED |
                               SOURCE_RETIREMENT_AMBIGUOUS
SOURCE_RETIREMENT_CONFIRMED -> MIGRATION_COMPLETE
```

No state is skipped. `MIGRATION_COMPLETE` means only the registered source
retirement predicate was confirmed; it is not a global erasure claim.
Ambiguity remains nonterminal and blocks replacement attempts for the affected
destination/source/target slot until read-only reconciliation.

## 4. Installation transaction

Before mutation the installer constructs:

```text
secret-install-plan-v1 = {
  schemaVersion: "kstack-secret-install-plan-v1",
  installationId: random-id-v1,
  hostFamily: "CLAUDE_CODE" | "CODEX",
  platformClass: "WINDOWS_NATIVE" | "WSL" | "LINUX_DESKTOP" |
                 "LINUX_HEADLESS" | "MACOS",
  scope: "USER" | "PROJECT",
  targetRootRef: opaque-safe-ref-v1,
  fromVersion: exact-version-v1 | "none",
  toVersion: exact-version-v1,
  artifactManifestDigest: digest-v1,
  configurationSchemaFrom: version-v1 | "none",
  configurationSchemaTo: version-v1,
  hostRegistrationChanges: bounded-list-of-closed-change-v1,
  rollbackPlanDigest: digest-v1
}
```

The user sees a safe preview of artifact and registration changes. No preview
contains an absolute/home path, username, host name, environment value, secret
inventory, or provider metadata. Existing artifacts are descriptor-opened,
identity checked, and copied to a private versioned backup before replacement.
Writes use same-filesystem staging, file sync, atomic replace where qualified,
directory sync, and exact digest read-back. Host registration occurs only after
all artifacts verify.

Failure before registration restores the exact prior code/config bytes. Failure
during/after registration first disables KStack, verifies the disabled state,
then attempts the registered rollback plan. If restoration cannot be proven,
state is `INSTALLED_DISABLED` with a fixed manual-recovery code. The installer
never deletes an uncertain backup and never continues to broker enrollment.

An upgrade may transform only a closed value-free configuration schema. The
transformer rejects unknown fields and makes a retained preimage backup. Secret
handle bindings, lifecycle records, audit state, provider objects, and source
retirement facts are not installer-owned and are never rolled back with code.
If the prior binary cannot read the current protected-state schema, rollback
means disable and forward repair, not launching incompatible code.

## 5. Discovery and backend selection

Discovery returns only capability facts:

```text
backend-discovery-v1 = {
  schemaVersion: "kstack-secret-backend-discovery-v1",
  platformClass: closed-platform-class-v1,
  backendFamily: "OS_LOCAL" | "OPENBAO",
  backendCell: registry-id-v1,
  presence: "ABSENT" | "PRESENT_UNVERIFIED",
  sessionClass: "INTERACTIVE" | "HEADLESS" | "NOT_APPLICABLE",
  qualificationState: "NONE" | "STALE" | "CURRENT",
  safeReasonCode: closed-backend-reason-v1
}
```

Discovery cannot unlock a vault, enumerate collections/items/keys, authenticate
to OpenBao, read config bodies, start a service, create an audit device, mount a
secrets engine, or contact a target. It checks only registered executable/API
identity and non-secret session prerequisites.

Selection follows this order:

1. eliminate the credential through workload identity, federation, passkey,
   certificate, or provider-issued short-lived identity where possible;
2. for independently qualified local development, choose the exact `os-local-v1`
   platform cell;
3. for production/self-hosted custody, choose the exact qualified
   `openbao-v1` instance; and
4. otherwise remain `BLOCKED_UNQUALIFIED`.

Platform truth is fixed:

- native Windows local development may use a separately qualified current-user
  Windows custody cell; current DPAPI work is experimental and must document
  same-user/same-machine recovery limits. The Windows Jira adapter is retired.
- Linux desktop may use Secret Service only in the exact logged-in D-Bus
  session with a qualified provider. Locked service, absent `/usr/bin/secret-tool`,
  WSL, and headless Linux deny; a protocol test double never qualifies the real
  service.
- macOS Keychain is unavailable until its own adapter, identity, synchronization,
  recovery, and no-echo UI cell is qualified. Presence of Keychain Access is
  not qualification.
- OpenBao is unavailable until operator-provisioned instance identity,
  bootstrap/auto-auth, namespace, policy, engine, audit, TLS, backup/recovery,
  and adapter cells pass SB-TC04/SB-TC10. KStack setup does not silently run a
  dev server or provision production infrastructure.

This repository's existing `.kstack/config.json` WSL Jira source remains its
sole Jira connection. Native Windows setup installs only the fixed value-free
WSL handoff. It does not offer Windows Jira enrollment, copy the Jira source,
or reinterpret WSL as a Linux desktop Secret Service cell.

## 6. Safe inventory and plan

The owner supplies only:

```text
secret-inventory-entry-v1 = {
  schemaVersion: "kstack-secret-inventory-entry-v1",
  entryId: random-public-id-v1,
  purposeClass: registry-id-v1,
  credentialKind: "PASSWORD" | "API_TOKEN" | "CLIENT_CREDENTIAL" |
                  "CERTIFICATE_PRIVATE_KEY" | "DYNAMIC_TEMPLATE",
  environmentClass: closed-environment-v1,
  targetClass: registry-id-v1,
  sourceCustodyClass: "PROTECTED_FILE" | "OS_CUSTODY" |
                      "PROVIDER_VAULT" | "MANUAL_REPLACEMENT" | "UNKNOWN",
  desiredBackendCell: registry-id-v1,
  desiredAdapterCell: registry-id-v1,
  lifecycleIntent: "NEW" | "ROTATE_THEN_ENROLL" |
                   "EXACT_IMPORT" | "REPLACE_UNKNOWN_SOURCE",
  sourceDisposition: "RETAIN_UNTIL_SEPARATE_APPROVAL"
}
```

There is no source path, filename, environment-variable name, locator, endpoint,
tenant, account, username, label, note, value format, key count, delimiter, or
free text. Optional user-facing labels are separate SB-TC02 safe metadata and
cannot describe the source. An `UNKNOWN` source is never inspected; it requires
replacement/rotation through a trusted input route.

The planner returns `READY_FOR_NO_ECHO`, `READY_FOR_EXACT_IMPORT`, or a bounded
set of fixed `BLOCKED_UNQUALIFIED` reasons. It does not probe the source or
provider. The plan digest binds inventory, selected cell, qualification
receipts, target/adapter registry versions, recovery profile, source-retirement
adapter, and observation policy.

## 7. No-echo input reservation

Before showing an input UI, SB-TC06 reserves the exact handle/generation,
backend object slot, target, adapter, input method, maximum size, expiry,
attempt, and source class. The trusted input component independently revalidates
that reservation and admits exactly one of:

1. `HOST_OWNED_NO_ECHO` — a native KStack control in trusted host chrome,
   outside model-visible messages and tool streams;
2. `PROVIDER_NATIVE_UI` — an attempt-bound provider UI/session created by the
   lifecycle adapter;
3. `TARGET_GENERATED` — the registered target/provider generates and crosses
   the value inside the protected lifecycle worker;
4. `EXACT_FORMAT_IMPORT` — the separately qualified importer described below.

Terminal/stdin input is not assumed safe merely because echo is disabled. A
cell must prove that the agent/parent process, transcript recorder, terminal
logging, accessibility bridge, shell history, clipboard, and stdout/stderr do
not receive the value. If that cannot be proven, the input method is
unavailable.

Manual input asks twice inside the same protected component when the credential
class supports repeat confirmation; equality is tested only in owned native
buffers and no digest/result leaves the component. Provider-issued or
single-display tokens use one entry plus an exact registered validation sink,
never model-visible confirmation. Mismatch destroys the staged generation and
records only `INPUT_MISMATCH`.

Close, timeout, focus loss, session change, crash, size overflow, encoding
failure, or provider UI uncertainty abandons or marks the SB-TC06 attempt
ambiguous according to contact state. Input is never cached for a second
attempt. Success activates only after destination read-back through a
non-returning SB-TC05 validation sink.

## 8. Exact protected-source importer

An importer is a measured protected adapter cell for one exact source producer,
version range, file/object schema, custody/permission profile, value field,
maximum size, and source-ownership/retirement profile. It cannot list
directories, search home, accept globs, infer formats, choose a field, import
multiple entries, or return source metadata.

```text
source-ownership-profile-v1 = {
  schemaVersion: "kstack-secret-source-ownership-profile-v1",
  producerCellRef: registry-id-v1,
  producerSchemaRef: registry-id-v1,
  importedEntryRef: opaque-ref-v1,
  objectOwnership: "WHOLE_OBJECT_EXCLUSIVE" | "ENTRY_IN_SHARED_OBJECT",
  retirementOperation: "WHOLE_OBJECT_UNLINK" |
                       "PRODUCER_NATIVE_ENTRY_REMOVE" |
                       "PROVIDER_ITEM_DELETE" | "RETAIN_ONLY",
  unrelatedContentPolicy: "PROVEN_ABSENT" | "MUST_PRESERVE",
  qualificationReceiptRef: opaque-ref-v1
}
```

`WHOLE_OBJECT_EXCLUSIVE` is admitted only when the exact producer schema and
creation provenance prove that the object contains precisely this KStack-owned
credential entry and no unrelated configuration, credential, include, comment,
or user data. Importing one field from an existing multi-field/multi-entry
object always yields `ENTRY_IN_SHARED_OBJECT/MUST_PRESERVE`, regardless of
whether other fields appeared empty during parsing.

The owner selects the source through a trusted native picker/provider UI. The
model receives only a random source-selection ref. The importer descriptor-
opens the selected object without following links, verifies owner/ACL/mode,
device/file identity, expected producer/schema, size, and stability, then reads
the one registered value directly into a protected SB-TC04 callback. It emits
only `IMPORTED`, `NOT_AVAILABLE`, `SOURCE_UNTRUSTED`, or `AMBIGUOUS`.

The importer must not parse by shelling out, source a script, expand variables,
load executable configuration, follow `include` directives, invoke a password
manager CLI with raw output, or write a converted copy. A parser error never
echoes context. If no exact importer exists, KStack directs the owner to create
a rotated replacement in a no-echo UI; generic/manual file inspection remains
forbidden even with owner permission.

Import reads do not modify the source. File access itself is audited as a
possible exposure boundary. A source-change race before/during/after the read
invalidates the attempt. The importer closes and revalidates its descriptor
identity and zeroizes all buffers before returning its fixed result.

## 9. Migration validation gates

After destination activation, all gates must pass in order:

1. **destination read-back** — exact provider metadata plus a non-returning
   validation sink proves the staged generation is usable;
2. **target use** — one registered target operation succeeds with the new
   current generation and content-free receipt;
3. **replacement rotation** — a new generation is staged, validated, cut over,
   and the predecessor retired under SB-TC06, proving future lifecycle rather
   than one-time copy;
4. **real-entry recovery** — a separately authorized per-entry recovery proof
   restores the exact current generation through section 11's isolated or
   non-disruptive provider mode without source fallback, value output, live
   provider rollback, or synthetic-to-real evidence transfer;
5. **rollback exercise** — setup/software rollback disables or restores code
   without changing the current credential generation or source;
6. **observation window** — a policy-fixed interval completes with no old-
   source use, ambiguity, audit gap, target failure, or non-resurrection signal;
7. **source retained receipt** — exact source identity remains protected and
   unchanged until a new owner decision.

A failed gate sets `VALIDATION_REVOKED` or `AMBIGUOUS`, fences new migration
steps, and preserves the source. Repair creates a new lifecycle attempt; it
does not edit historical evidence. Tests using synthetic fixtures can qualify
the mechanism but cannot mark a real entry migrated.

## 10. Observation and source retirement

The observation policy fixes duration, target health checks, audit checks,
source-use signals, allowed maintenance, and restart/power-loss coverage before
enrollment. It cannot be shortened after a favorable result. Observation uses
only protected non-value signals; KStack never resolves both source and
destination to compare their bytes.

The source-use observation profile binds the exact source identity, complete
registered consumer/principal classes, producer-native access-audit or measured
wrapper cell, monitor identity, start/end instants, restart coverage, allowed
maintenance, and failure policy. `NO_OLD_SOURCE_USE` is valid only when coverage
is `COMPLETE`, monitoring stayed healthy for the whole fixed interval, source
identity stayed unchanged, every registered consumer cut over, and no access
event occurred. Absence of an event from a partial/unavailable monitor is not
evidence. An unknown/uninstrumented consumer, monitor gap, clock uncertainty,
or source identity change keeps the entry `MIGRATED_SOURCE_RETAINED`.

Source retirement requires a new exact preview showing source custody class,
producer/retirement adapter, consequence (`recoverable`, `irreversible`, or
`provider-qualified`), migration receipt, last-use state, backups/sync caveat,
and recovery effect. Approval is bound through SB-TC03/SB-TC08.

The retirement adapter reopens and revalidates the exact original source ref.
It refuses if identity changed, the source was used during observation, the
destination is not current, a predecessor/incident is open, or retirement
semantics differ from preview. Supported effects are exact provider revoke,
OS-vault item delete, producer-native exact-entry removal, or whole-object
unlink. Whole-object unlink is allowed only for
`WHOLE_OBJECT_EXCLUSIVE/PROVEN_ABSENT`; a shared object may use only its
qualified producer-native exact-entry operation, whose atomic rewrite preserves
and byte-verifies every unrelated field. Generic JSON/YAML/dotenv rewrite, line
deletion, quarantine/rename of a shared object, and whole-file unlink reject.
If the producer has no exact safe entry-removal operation, the source remains
`MIGRATED_SOURCE_RETAINED`. There is no recursive delete, wildcard, directory
deletion, free-form command, secure-delete claim, or automatic backup deletion.

Lost acknowledgement is `SOURCE_RETIREMENT_AMBIGUOUS`; it is reconciled by an
exact metadata existence check and never blindly repeated. Confirmation records
a non-secret tombstone and a `MIGRATION_COMPLETE` receipt. A retained replica
or unverifiable source stays `MIGRATED_SOURCE_RETAINED` with fixed operator
guidance.

## 11. Backend-specific recovery truth

Real-entry recovery evidence is separate from synthetic cell qualification:

```text
entry-recovery-proof-v1 = {
  schemaVersion: "kstack-secret-entry-recovery-proof-v1",
  handleRef: opaque-ref-v1,
  generation: generation-v1,
  backendInstanceRef: opaque-ref-v1,
  recoveryProfileRef: registry-id-v1,
  recoveryMode: "ISOLATED_PROVIDER_RESTORE" |
                "IN_PLACE_VERSION_RECOVERY" |
                "ACCOUNT_OR_DEVICE_RECOVERY",
  protectedBackupCheckpointRef: opaque-ref-v1,
  authorityEpoch: generation-v1,
  auditHeadCheckpointRef: opaque-ref-v1,
  validationReceiptRef: opaque-ref-v1,
  recoveredCopyDispositionRef: opaque-ref-v1,
  recoveredCopyFinalState: "DESTROYED_CONFIRMED" | "NOT_APPLICABLE",
  observedAt: trusted-instant-v1,
  expiresAt: trusted-instant-v1
}
```

The proof is separately previewed and approved because it may create a temporary
second provider copy. `ISOLATED_PROVIDER_RESTORE` restores the operator-owned
provider checkpoint into a pre-qualified network-isolated recovery instance,
never over the live instance. It binds the exact real generation through
protected metadata, performs one registered non-returning validation, proves
authority/audit non-rollback, then revokes and destroys the recovered copy under
SB-TC06. The proof cannot pass until exact provider metadata confirms
`DESTROYED_CONFIRMED`. Lost or uncertain disposal acknowledgement invalidates
the proof, quarantines/fences the entire recovery instance, and cannot be
reclassified as successful retention.

`IN_PLACE_VERSION_RECOVERY` is allowed only when the provider can recover the
exact generation without rewinding or replacing other objects. It is explicitly
disruptive: a separate maintenance approval suspends the handle and exact target
credential slot, performs the SB-TC06 soft-delete/recover-style operation,
validates the target, and resumes only after complete audit/cleanup evidence.
Ambiguity keeps the handle suspended and fails the proof. Because it creates no
second object, its recovered-copy state is `NOT_APPLICABLE`.
`ACCOUNT_OR_DEVICE_RECOVERY` requires the exact platform identity/profile
recovery ceremony in an isolated qualified cell. Any mode that would restore a
live provider snapshot in place, overwrite unrelated entries, reset the global
authority epoch/audit head, reveal a value, or use the retained legacy source
rejects. Synthetic recovery proves mechanism qualification only; it cannot
populate `entry-recovery-proof-v1`. An isolated account/device recovery cell
must likewise be destroyed and confirmed before its proof passes.

Recovery-proof freshness is orthogonal to immutable migration/source history:

```text
recovery-evidence-posture-v1 = {
  schemaVersion: "kstack-secret-recovery-evidence-posture-v1",
  handleRef: opaque-ref-v1,
  generation: generation-v1,
  proofRef: opaque-ref-v1,
  state: "CURRENT" | "STALE",
  checkedAt: trusted-instant-v1
}
```

`CURRENT` is required to approve source retirement. If it becomes `STALE`
before retirement, the entry remains `MIGRATED_SOURCE_RETAINED`. If it becomes
stale after `MIGRATION_COMPLETE`, the migration/source state does not change
and no source is recreated; instead new production-approved prepares, renewals,
and promotion claims deny until a fresh proof passes. Historical target effects
and lifecycle states are never rewritten.

### Windows local development

Current-user Windows custody is bound to the exact user/machine profile unless
the qualified provider says otherwise. Microsoft documents that typical DPAPI
data is decryptable by the same user on the same machine, that administrative
password reset can make data unrecoverable without domain recovery material,
and that machine scope broadens decryption to other machine users. Therefore
KStack v1 forbids machine-scope DPAPI and treats profile/password-reset/domain-
backup behavior as explicit recovery and threat facts. It never exports a
plaintext “backup.” The current cell remains development-only until those exact
fixtures pass.

### Linux desktop Secret Service

Secret Service collections/items may be locked and provider operations may
return a user prompt. Unlock/prompt completion is provider-owned interactive
work in the exact D-Bus session. Headless/WSL sessions, locked providers without
qualified prompt completion, collection loss, or changed item identity deny.
KStack records lookup attributes/object refs only inside protected backend
state and never exposes them as safe metadata.

### macOS

Keychain backup/synchronization semantics vary by item and account state; Apple
documents that some Local Items/iCloud Keychain passwords cannot be copied as
ordinary keychain files. KStack therefore makes each synchronization/recovery
class explicit and leaves macOS unavailable until exact tests exist. It never
promises that copying a keychain file backs up every item.

### OpenBao

Recovery is owned by the operator-qualified cluster snapshot/unseal/identity
runbook, not by KStack plaintext export. KV-v2 soft delete, undelete, destroy,
metadata delete, check-and-set, maximum-version cleanup, and replication/backup
are distinct semantics. OpenBao documents that soft delete retains underlying
data while destroy removes the selected version's data; KStack reports only the
exact operation and never broadens it into a replica/backup erasure claim.
Restore must preserve the SB-TC03 authority epoch, SB-TC07 external audit head,
backend instance identity, policies, and adapter registry or fail closed.

## 12. Recovery package

KStack may export only:

```text
secret-recovery-package-v1 = {
  schemaVersion: "kstack-secret-recovery-package-v1",
  packageId: random-id-v1,
  repositoryRef: opaque-ref-v1,
  environmentClasses: bounded-set-of-closed-environment-v1,
  backendCellIds: bounded-set-of-registry-id-v1,
  providerRecoveryProfileIds: bounded-set-of-registry-id-v1,
  entryCountsByState: bounded-map-of-closed-state-to-count-v1,
  retentionProfileIds: bounded-set-of-registry-id-v1,
  requiredArtifactVersions: bounded-map-v1,
  auditHeadCheckpointRef: opaque-ref-v1,
  generatedAtBucket: utc-calendar-day-v1
}
```

It contains no handle catalog, per-entry ref, value, ciphertext, wrapped value,
value digest, locator, provider token, bootstrap credential, unseal material,
keychain/DPAPI blob, source path, account, tenant, endpoint, raw config, log, or
free text. Counts below a registry threshold use `UNDER_THRESHOLD`. It is a
runbook/profile binding, not a secret or metadata backup, and cannot reconstruct
lost handles, lifecycle state, audit history, or provider custody. Provider/OS
recovery material and KStack protected state stay in their independently
administered custody planes and are never embedded in this package.

The package is written only through a host-owned protected destination picker.
The writer creates a new non-symlink file with exact user-only ACL/mode,
descriptor identity checks, atomic durability, and safe digest read-back; it
never prints the destination or bytes to the model. Existing destinations are
not overwritten. Export authority and retention are separately approved. If a
platform cannot enforce private destination custody, export is unavailable.

Recovery starts in an isolated replacement cell, verifies the package plus the
separately retained protected state and provider recovery profile, restores
provider state through its operator path,
reconciles audit/authority non-rollback state, then runs safe metadata and
synthetic qualification before any real handle can become active. Real target
use requires a fresh SB-TC03 attempt. Failure never falls back to the retained
legacy source automatically.

## 13. Uninstall and unenrollment

The exact uninstall modes are:

1. `DISABLE_ONLY` — disable host projections and deny new broker work; retain
   code, configuration, custody, and audit state.
2. `REMOVE_SOFTWARE_KEEP_STATE` — after disable/drain/reconcile, remove KStack
   host/plugin artifacts; retain protected metadata, audit, provider objects,
   source state, and a signed value-free reinstall marker.
3. `UNENROLL_REPOSITORY_KEEP_CUSTODY` — remove active repository policy binding
   after disable/drain; retain tombstones, audit, provider custody, and sources.
4. `RETIRE_CUSTODY` — not an uninstall operation. It expands into individually
   previewed/approved SB-TC06/source-retirement operations per entry.

Every uninstall first denies new prepares, expires unclaimed previews/leases,
waits for non-contacted work to cancel, and read-only reconciles contacted or
ambiguous attempts. It cannot continue past a nonterminal effect by deleting
state. It creates a safe inventory/recovery package, verifies retention, and
only then removes the selected software/registration artifacts.

Default/noninteractive uninstall is `DISABLE_ONLY`. Package-manager or host
plugin uninstall that cannot run the drain protocol may remove code but must
leave protected state/provider data untouched and show `RECONCILIATION_REQUIRED`
on reinstall. There is no `--purge-secrets`, recursive cleanup, provider-wide
delete, or source deletion flag.

## 14. Rollback and forward repair

Setup rollback restores only the exact prior installation snapshot when its
artifact and configuration schemas remain compatible. Repository enrollment
rollback disables the new binding and restores the prior value-free binding; it
does not alter custody. A backend-selection change that has not enrolled a
generation may be abandoned safely.

After any value contact, destination activation, rotation cutover, source
retirement, revocation, deletion, or provider mutation, there is no automatic
state rollback. The exact attempt is reconciled; remediation moves forward with
a fresh generation/transition. A predecessor never becomes current merely
because older KStack code was restored.

If a new release corrupts or cannot interpret protected state, KStack disables
all work, retains both code backups and the newest state, and requires a
reviewed forward repair. It never feeds protected-state bytes to the model or
starts an older binary speculatively.

## 15. Qualification and falsification gates

SB-TC09 implementation must prove:

1. crash/power-loss recovery at every installer stage, with exact prior bytes
   restored or a verified disabled state;
2. installation cannot create/read/change/delete a backend object, source, or
   target credential;
3. discovery performs no enumeration/unlock/authentication/provider mutation;
4. Windows, Linux desktop, WSL/headless, macOS, and OpenBao selection claims are
   separate and no fallback occurs;
5. no-echo input and trusted picker/import paths keep synthetic positive
   controls out of parent/model/tool/terminal/clipboard/log/crash sinks;
6. generic file inspection, format inference, symlink/race, include/expansion,
   multi-entry import, and changed source identity all reject;
7. every migration gate is ordered, source retention survives every failure,
   and observation cannot be shortened;
8. source retirement requires a new approval, never recursively deletes, and
   resolves lost acknowledgement without retry;
9. DPAPI profile/password reset, Secret Service lock/prompt/session loss,
   macOS item-class limits, and OpenBao snapshot/version/delete semantics match
   exact platform/provider evidence;
10. recovery packages contain only the exact closed value-free schema;
11. all uninstall modes preserve provider custody by default and cannot discard
   nonterminal attempt/audit state; and
12. code rollback never changes current generation, revives a predecessor, or
   restores a retired source.

SB-TC07's positive-control harness covers installers, backups, pickers, input
adapters, importers, migration receipts, recovery packages, uninstall records,
and rollback diagnostics. SB-TC10 owns exact platform evidence and promotion.

## 16. Rejected alternatives

- **Scan the machine/repository for likely credentials:** rejected; discovery
  creates an uncontrolled read/exposure surface and cannot establish ownership.
- **Ask the model to inspect a source so it can write an importer:** rejected;
  format discovery itself exposes protected content.
- **Auto-select the first available local vault:** rejected; availability is
  not qualification and cross-host fallback creates duplicate authority.
- **Treat WSL as Linux desktop Secret Service:** rejected; WSL/headless lacks
  the qualified logged-in D-Bus custody cell.
- **Create a native-Windows Jira credential during setup:** rejected; this
  repository has one authoritative WSL Jira source and fixed handoff.
- **Delete the source immediately after destination write/read:** rejected;
  target use, replacement rotation, recovery, rollback, and observation remain
  unproven.
- **Export an encrypted/wrapped secret as a recovery package:** rejected;
  ciphertext and wrapped values remain credential material and create another
  custody system.
- **Uninstall by deleting all KStack/provider state:** rejected; software
  removal is not credential destruction and may erase reconciliation evidence.
- **Restore an old secret generation during software rollback:** rejected;
  lifecycle currentness is monotonic and independent of code version.

## 17. Source posture

- [OpenBao KV v2](https://openbao.org/docs/secrets/kv/kv-v2/) — mutable vendor
  documentation, read 2026-08-31. It documents CAS, versioning, soft delete,
  undelete, destroy, metadata delete, and maximum-version cleanup as distinct
  operations.
- [Secret Service collections/items](https://specifications.freedesktop.org/secret-service/latest/ch03.html)
  — current freedesktop.org draft specification, read 2026-08-31. It documents
  locked items/collections and provider prompt objects for create/delete.
- [Microsoft Windows password handling](https://learn.microsoft.com/en-us/windows/win32/secbp/handling-passwords)
  and [DPAPI example/limitations](https://learn.microsoft.com/en-us/windows/win32/seccrypto/example-c-program-using-cryptprotectdata)
  — mutable platform documentation, read 2026-08-31. They inform late secure
  collection, memory cleanup, current-user/machine scope, and reset/recovery
  limits; they do not qualify KStack's current helper.
- [Apple keychain transfer guidance](https://support.apple.com/en-euro/guide/keychain-access/kyca1121/mac)
  — mutable user/platform documentation, read 2026-08-31. It states that some
  Local Items/iCloud Keychain passwords cannot be copied as ordinary keychain
  files, so KStack makes no generic file-backup claim.

The existing KStack planner and experimental Windows/Linux helpers are
implementation evidence only. Their fixture results do not satisfy this
contract or production qualification.
