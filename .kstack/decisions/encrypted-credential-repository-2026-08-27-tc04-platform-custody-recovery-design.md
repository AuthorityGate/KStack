# Encrypted Credential Repository: ECR-TC04 platform custody and recovery-carrier design

| Field | Bound value |
| --- | --- |
| Status | **REVIEW-REQUIRED / PROVISIONAL COMPOSE / NOT IMPLEMENTED** |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| ECR-TC01 closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| ECR-TC02 closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| Closed ECR-TC03 candidate SHA-256 | `16d7cd06aff3ecf111076252c1cbe80c80bf08f46f514ab62bb5db7268c49ca5` |
| ECR-TC03 closure | [ECR-TC03 Codex closure](encrypted-credential-repository-2026-08-27-tc03-codex-closure.md) |
| ECR-TC03 closure SHA-256 | `6d562b5473ef5965272a4400b95b1f29977b11fb06b0ab6b9893adf630b70438` |
| ECR-TC03 external closure | Codex R2 `approve`, confidence 96, all finding/question arrays empty, strongest objection `None.`; output SHA-256 `399eefcfd9da3cdceb18a0d780d720f1c8f096b63441643f87ec853b69e71d75` |
| ECR-TC03 FIPS decision SHA-256 | `6b4cf4fe2cff2ad016055a31333652cc35fd23672f0cdb1f9abebae75c1a38f8` |
| TC04 Codex R1 reviewed SHA-256 | `7c22a6ce4c6397e10fba53191d45e8b5d8efb43d7fa71e42f429156ad0050f5e` |
| TC04 Codex R1 output | `revise`, confidence 98, 5 failed checks, 3 security findings; output SHA-256 `22e274f9bc6e1e3a59e19ecf8b03caf35a1b5cf4a0cd7d57d7733f0587ef6af0` |
| TC04 Codex R2 reviewed SHA-256 | `6d752ab038dbea83cf44ab908aa2d6bcb564a95e531681fd6d5052f2fb75aca0` |
| TC04 Codex R2 output | `revise`, confidence 97, 2 failed checks, 2 security findings; output SHA-256 `7b48927f38c351e2424e0116267cd3b8174657ee571b6686fe12099c4b14c7a2` |
| TC04 Codex R3 reviewed SHA-256 | `6c93c61a7587302d330969ffc5d80fbb67be164c97b1a9975b957af1e15a2dd3` |
| TC04 Codex R3 output | `revise`, confidence 97, 3 failed checks, 3 security findings; output SHA-256 `d9a9fb5df466f4cbb17197e3c8b11aedeb3fdc84237095d24a0befc48a35526e` |
| Closure gate | Codex confidence `>=93` and zero failed checks, security findings, material dissent, unresolved questions, or design-changing objection |

## 1. Scope, authority, and closed direction

TC04 designs only Windows, macOS, and Linux root custody; the selected
OS/hardware-to-broker-to-content-provider crossing; platform-slot and
recovery-slot records; update/loss behavior; and human-only portable and
offline-recovery carriers.

This item does not select or qualify a particular vendor binary, FIPS
certificate, operating-environment build, TPM firmware, Secure Enclave model,
Linux distribution, provider configuration, or installer. It does not define
store transactions, slot persistence, rollback anchors, rotation/revocation,
action leases, caller IPC, target injection, audit durability, restore
activation, migration, drills, deployment, or production activation. Those
remain owned by TC05 through TC10.

The selected direction is **COMPOSE**. An OS or hardware service protects one
random slot key. A separately authenticated custody broker releases that key
only into one guarded crossing and immediately imports it into the
TC03-suite-conforming, later-TC10-qualified content provider. That provider
derives context-bound root wrapping material
and AES-256-KWP unwraps the vault root. The root remains a provider handle and
never crosses into ordinary broker memory. Platform APIs do not directly expose
the vault root and are not treated as a general secret store.

No production platform is claimed available by this design. Each remains
`UNAVAILABLE_PENDING_TC09_TC10_QUALIFICATION` until the exact selected profile,
boundary crossing, FIPS evidence, rollback/recovery dependencies, and synthetic
qualification corpus all pass. An API name, hardware label, successful unwrap,
OS attestation string, or design score is not qualification.

## 2. Reuse-first local inventory and disposition

TC04 performed a repository/source inventory only. It did not browse, install,
execute, authenticate to, or probe any contender.

| Local evidence | Reusable result | Gap and TC04 disposition |
| --- | --- | --- |
| TC01 contender selection | Windows CNG/DPAPI and TPM, macOS Keychain/Secure Enclave, Linux TPM2/kernel custody, Linux Secret Service, SOPS, and age were already compared against official-source pins. | Reuse the role-level shortlist and negative controls. Do not repeat research or infer runtime qualification. |
| TC02 threat/identity/authority design | Supplies separate `CUSTODY_SERVICE` and `RECOVERY_OPERATOR` roles, exact profile-tuple binding, `TC04_CUSTODY_CURRENT`, the portable-production downgrade record, and fail-closed reason ordering. | TC04 supplies custody mechanisms/currentness only; it does not alter TC02 authority. |
| Closed TC03 candidate | Supplies the FIPS suite, complete non-circular KWP-context rule, exact canonical schemas/references, generated accounting model, one-attempt recovery mismatch, and platform-plus-recovery activation requirement. | TC04 cannot add an algorithm, change a suite ID, permit non-FIPS production, or mutate TC03. |
| `plugins/kstack/references/SAFETY.md` | Demonstrates an isolated worker, no argument/environment/output credential path, private one-use socket, descriptor revalidation, and fail-closed platform limits. | Pattern only. The Git worker is POSIX-specific, same-user, credential-file based, and not an ECR custody broker. |
| Safety/citation/reflexion/Jira primitives | Repository search identifies no-follow/descriptor, owner/mode, private socket, fixed-error, exclusive-file, fsync, and durable-rename patterns. | Reuse candidates for later implementation only. Direct safety-worker source inspection was blocked by the active hook; no bypass was attempted. These patterns are not cross-platform custody qualification. |
| SOPS 3.13.3 and age 1.3.1 TC01 record | Useful protected-envelope patterns for nonproduction/offline workflows. | They have no TC03 production suite ID and cannot be the production recovery or runtime path. |

The inventory found no existing KStack implementation of cross-platform ECR
custody or recovery. Building only the KStack profile/broker composition gap is
consistent with TC01. Primitive cryptography, TPM drivers, keychain services,
and platform crypto providers remain reused qualified components, not KStack
reimplementations.

## 3. Non-waivable invariants

1. Production uses only TC03 suite 1 content and suite 3 recovery semantics
   through current, exact FIPS-qualified boundaries. There is no non-FIPS,
   legacy-suite, software-file, environment-variable, or reveal fallback.
2. A production root generation has at least one `CURRENT` qualified platform
   slot and one `CONFIRMED_CURRENT` offline recovery slot. Portable-only
   production replaces only the platform-slot predicate while one exact TC02
   downgrade authority is current; it never replaces the recovery slot.
3. Platform slot key, portable custody artifact, and offline recovery artifact
   use disjoint IDs, domains, profiles, carriers, and locations, and independent
   qualified generation calls. They are never intentionally copied or reused.
   KStack keeps no persistent secret-comparison index and claims no impossible
   global random-collision detector.
4. The OS service protects a random 256-bit slot key, not a credential, entry
   CEK, domain master, or vault root. The content provider alone derives root
   wrapping material and opens the AES-KWP-wrapped root.
5. Claude, Codex, MCP, repository code, ordinary tools, arguments, environment,
   inherited descriptors, standard streams, shared temporary files, clipboard,
   logs, audit output, Git, and Jira never receive protected key material.
6. No generic unseal, decrypt, export, read-secret, arbitrary IPC/provider, or
   shell interface exists. Only one exact protected current slot may be used
   after TC02 eligibility.
7. A custody release is one attempt. Cancellation, timeout, prompt loss, crash,
   or crossing ambiguity burns the attempt and never trials another slot.
8. Profile mismatch, stale qualification, failed attestation, lock/reset,
   update drift, missing hardware, or crossing failure denies without fallback.
9. A wrong authenticated recovery artifact terminates that ceremony and does
   not quarantine the live generation. Admitted live-slot integrity failure
   retains TC03/TC05 quarantine semantics.
10. Portable production accepts only `PORTABLE_CUSTODY_RESIDUAL_ONLY`; it cannot
    waive FIPS, authority, rollback, audit, recovery, freshness, qualification,
    or output containment.

## 4. Selected custody boundary and crossing

| Component | Security role | Forbidden role |
| --- | --- | --- |
| Model-facing host | Submits safe opaque intent under its TC02 principal. | Cannot select a slot by path, call custody, receive a key, or answer a platform/recovery prompt. |
| Custody broker | Separate OS service identity; resolves one exact slot/profile and performs one release/import crossing. | No public unseal/read API, generic shell/HTTP, key serialization, ordinary output, or model-visible diagnostics. |
| OS/hardware boundary | Authenticates broker/service state and releases the exact sealed slot key under profile policy. | Does not decide KStack authority and never directly releases credentials or the vault root. |
| TC03 content provider | Imports slot key, derives wrapping material, KWP-opens root, and retains protected handles. | Does not authenticate caller, select environment, or weaken policy after crypto success. |
| TC05 protected store | Later supplies the admitted slot and immutable generation. | Caller bytes, paths, filenames, and timestamps cannot select truth. |

The **qualified custody boundary** is the closed union of the selected OS or
hardware mechanism, broker isolation, guarded crossing, and exact provider
import API. Production qualification fails if any member is absent from profile
evidence. Calling a hardware key non-exportable cannot hide an exportable
slot-key crossing.

For a TC02 decision containing `TC04_CUSTODY_CURRENT`:

1. Resolve the immutable request, decision, environment, tuple, current epoch
   vector, and one exact slot. The caller cannot supply/reorder candidates.
2. TC05 later admits the slot from one protected generation and holds it stable.
   Pre-admission parse/ID/profile failures make no OS call or quarantine change.
3. Verify broker executable/service identity, boot/lock state, custody profile,
   qualification epoch, slot generation, platform-key identity, policy/evidence
   digest, and current platform evidence by exact comparison.
4. Reserve one crossing attempt before any prompt or OS call. TC05/TC06 own
   durability. Every non-success consumes it.
5. The OS/hardware boundary releases exactly one 32-byte slot key into guarded
   broker memory. No callback targets caller memory; no release survives fork or
   exec.
6. Import those bytes without a general-buffer copy through the qualified API
   as a non-exportable transient provider handle. Then best-effort overwrite and
   release the guarded pages; no perfect-zeroization claim is made.
7. The provider computes section 7 salt/context, derives a 32-byte wrapping
   value with HKDF-SHA-256, and KWP-opens the 40-byte wrapped root. Root bytes
   remain inside the provider as a non-exportable transient handle.
8. Destroy slot-key and wrapping-value handles after root-handle creation. Bind
   the root handle to exactly one ordinary authority decision or human ceremony
   authority, plus attempt, slot, generation, provider instance, process, and
   expiry; it is nontransferable and nonserializable.
9. Emit only internal `CUSTODY_OPENED` or a fixed failure mapped through TC02.
   Platform error, slot existence, prompt, timing, attestation, and key identity
   never reach the model-facing host.

Steps 3 and 5 have one closed portable variant. After TC02 validates a current
human authority path and exact portable downgrade, the broker resolves the
matching binding, confirmation, and currentness records, then the human enters
the PCAK carrier through the qualified local no-echo UI. Canonical carrier
validation precedes one guarded import; kind/artifact/profile/binding mismatch
consumes the attempt uniformly. Portable production is unavailable to a
`SERVICE_CALLER` or unattended profile because the artifact cannot remain
online or be supplied by a model/service. The distinct offline RAK is never an
ordinary-use substitute.

Production crossing qualification requires a separate service identity; OS
access-control proof; authenticated IPC later closed by TC07; dump, debug,
trace, crash-report, telemetry, child, paging, hibernation, and swap controls;
guarded allocation; fork/exec exclusion; provider import semantics; exact copy
accounting; cleanup under every fault; and statistical output/timing tests. A
missing control makes the profile unavailable.

## 5. Platform profile matrix

### 5.1 Common profile contract

The profile is byte-closed by the following CDDL. Every digest reference uses
TC03's already-closed `ECR-D1/OBJECT` domain and names the one exact later-owned
schema; it cannot substitute for another digest or registry class.

```cddl
platform-family-v1 = "WINDOWS" / "MACOS" / "LINUX"
custody-class-v1 = "USER_SOFTWARE_NONPRODUCTION" /
  "HARDWARE_SERVICE_PRODUCTION"
custody-status-v1 = "CANDIDATE" / "QUALIFIED_CURRENT" / "SUSPENDED" /
  "REVOKED" / "EXPIRED" / "RETIRED"
tc04-environment-class-set-v1 = [1*2 environment-class-v1]
maybe-fips-provider-profile-ref-v1 = [0] / [1, fips-provider-profile-ref-v1]

platform-key-identity-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.PlatformKeyIdentity/1", sha256-v1]
platform-policy-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.PlatformPolicy/1", sha256-v1]
fips-provider-profile-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.FipsProviderProfile/1", sha256-v1]
custody-crossing-profile-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CustodyCrossingProfile/1", sha256-v1]
rollback-profile-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.RollbackProfile/1", sha256-v1]
platform-evidence-set-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.PlatformEvidenceSet/1", sha256-v1]
carrier-ui-profile-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CarrierUiProfile/1", sha256-v1]
portable-mechanism-v1 = "RANDOM_PCAK_256"
recovery-mechanism-v1 = "RANDOM_RAK_256" / "ARGON2ID_V13"

custody-profile-v1 = [
  "ECR.CustodyProfile/1", id128-v1, platform-family-v1,
  tc04-environment-class-set-v1, custody-class-v1,
  principal-ref-v1, provider-ref-v1, platform-key-identity-ref-v1,
  platform-policy-ref-v1, maybe-fips-provider-profile-ref-v1,
  custody-crossing-profile-ref-v1, rollback-profile-ref-v1,
  recovery-profile-ref-v1, platform-evidence-set-ref-v1,
  qualified-tuple-ref-v1, uint63, utc-instant-v1, utc-instant-v1,
  custody-status-v1
]
portable-profile-v1 = [
  "ECR.PortableProfile/1", id128-v1,
  tc04-environment-class-set-v1, 1..2, portable-mechanism-v1,
  principal-ref-v1, provider-ref-v1, maybe-fips-provider-profile-ref-v1,
  custody-crossing-profile-ref-v1, rollback-profile-ref-v1,
  carrier-ui-profile-ref-v1, platform-evidence-set-ref-v1,
  qualified-tuple-ref-v1, uint63, utc-instant-v1, utc-instant-v1,
  custody-status-v1
]
recovery-profile-v1 = [
  "ECR.RecoveryProfile/1", id128-v1,
  tc04-environment-class-set-v1, 3..4, recovery-mechanism-v1,
  principal-ref-v1, provider-ref-v1, maybe-fips-provider-profile-ref-v1,
  custody-crossing-profile-ref-v1, rollback-profile-ref-v1,
  carrier-ui-profile-ref-v1, platform-evidence-set-ref-v1,
  qualified-tuple-ref-v1, uint63, utc-instant-v1, utc-instant-v1,
  custody-status-v1
]
```

The ID is an opaque 16-byte `id128-v1`; the human-readable profile names below
are registry labels and never wire IDs. Sets use canonical member-byte order
and are duplicate-free. Production class occurs alone, requires the hardware
service class and present FIPS reference, and cannot share a
profile with nonproduction. A nonproduction profile has absent FIPS reference
unless separately qualified for its nonproduction suite; presence never grants
production.

The following relation matrix is complete for portable and recovery profiles;
every unlisted product is invalid before carrier input or provider work:

| Profile body | Suite | Exact environment set | Mechanism | FIPS tag | Required identity |
| --- | ---: | --- | --- | --- | --- |
| `PortableProfileV1` | `1` | exactly `PRODUCTION_USER_DATA` | `RANDOM_PCAK_256` | present | active `CUSTODY_SERVICE` |
| `PortableProfileV1` | `2` | nonempty canonical subset of `SYNTHETIC_DEVELOPMENT`, `NONPRODUCTION_CONTROLLED` | `RANDOM_PCAK_256` | absent | active `CUSTODY_SERVICE` |
| `RecoveryProfileV1` | `3` | exactly `PRODUCTION_USER_DATA` | `RANDOM_RAK_256` | present | active `CUSTODY_SERVICE` |
| `RecoveryProfileV1` | `4` | nonempty canonical subset of `SYNTHETIC_DEVELOPMENT`, `NONPRODUCTION_CONTROLLED` | `ARGON2ID_V13` | absent | active `CUSTODY_SERVICE` |

Every row requires current exact crossing, rollback, carrier-UI, evidence-set,
provider, tuple, epoch, and time records. Every profile ID byte-equals its
matching TC03 typed reference's fourth member: the 16-byte ID payload inside
`[1, 4, "CUSTODY_PROFILE", id128-v1]`,
`[1, 4, "PORTABLE_PROFILE", id128-v1]`, or
`[1, 4, "RECOVERY_PROFILE", id128-v1]`, respectively. It never equals or
compares against the complete typed-reference array. Suite,
environment, mechanism, and FIPS
presence cannot be inferred from one another or relabeled. Production and
nonproduction never share one profile body.

Each custody, portable, or recovery profile's `qualified-tuple-ref-v1`
byte-equals the environment's selected
tuple. Its scalar qualification epoch byte-equals that tuple's
`qualification_epoch` and the one exact `(QUALIFICATION,
QUALIFIED_PROFILE_TUPLE, tuple_id, epoch)` entry in the complete
`epoch-vector-v1`. Every ID in that entry is `id128-v1`. TC04 creates no epoch
kind or scope. Changing any profile field/status/evidence advances the tuple
epoch; a stale scalar or otherwise exact profile under an old tuple denies.
`not_before` is inclusive and `expires_at` exclusive under qualified TC02 time.

`provider-ref-v1` here identifies the custody mechanism/provider only. It is
not and cannot be split from, combined with, or substituted for the one exact
TC02 credential-action `provider-tenant-target-ref-v1`. Any ordinary-use
request/decision linked after custody opens preserves that composite reference
byte-for-byte; TC04 never reconstructs provider, tenant, or target fields.

TC10 populates exact evidence: OS build and architecture; hardware/firmware;
provider binary/configuration digests; FIPS certificate/security policy;
key/export/access policy; service/code identity; user-presence and lock policy;
boot/attestation, reset/update, crossing/import and memory behavior; negative
corpus; validity window; and complete epoch vector.

### 5.2 Windows

| Profile ID | Selected mechanism | Allowed class | Required behavior |
| --- | --- | --- | --- |
| `ECR-WIN-DPAPI-USER-DEV/1` | User-scoped Windows protection of the random slot key, with broker-specific additional entropy and exact user profile. | Synthetic development and explicitly permitted controlled nonproduction only. | Locked/unavailable user denies. Machine scope, roaming/copy ambiguity, ordinary caller access, and hardware claims are forbidden. |
| `ECR-WIN-CNG-TPM-SVC-PROD/1` | TPM-backed non-exportable CNG platform key under a separate broker service protects the slot key; exact CNG/KSP/TPM operation is profile-pinned. | Production only after TC10 qualification. | Exact TPM/KSP/key, broker service ACL, boot/device policy, no software fallback, approved crossing, and current FIPS evidence. |

Windows production never falls back to user/machine DPAPI, certificate-file
keys, registry bytes, Credential Manager, or a software KSP. Service SID, code
identity, token privileges, session/logon type, provider, and key identity all
match. A PIN/UI prompt is human-current only and cannot be answered by a model,
service automation, or repository text.

### 5.3 macOS

| Profile ID | Selected mechanism | Allowed class | Required behavior |
| --- | --- | --- | --- |
| `ECR-MAC-KEYCHAIN-USER-DEV/1` | Non-synchronizing Keychain item contains the random slot key and is ACL-bound to the local broker. | Synthetic development and permitted controlled nonproduction only. | Sync items, access-group ambiguity, caller-selected queries, and broad user-session access are forbidden. |
| `ECR-MAC-KEYCHAIN-SEP-SVC-PROD/1` | Keychain protection anchored by Secure Enclave/access control and a separately authenticated launchd service; exact supported API is pinned. | Production only after TC10 qualification. | Device binding, code requirement, access group, user presence, lock, non-sync, no fallback, crossing, and exact FIPS evidence. |

Enclave key non-exportability does not prove the slot key never enters broker
memory; the crossing remains explicit. Keychain unlock, biometric-set/passcode
change, restore, migration, OS upgrade, signing change, or ACL drift suspends
until requalified. No `security` CLI output, pasteboard, shell substitution,
environment injection, or ordinary app query is an ECR path.

### 5.4 Linux

| Profile ID | Selected mechanism | Allowed class | Required behavior |
| --- | --- | --- | --- |
| `ECR-LINUX-SECRET-SERVICE-USER-DEV/1` | Pinned Secret Service implementation holds the random slot key under an authenticated desktop session. | Synthetic development only; controlled nonproduction needs separate qualification. | Exact implementation, session, collection, lock, D-Bus peer, and broker. Headless/unavailable/alternate service denies. |
| `ECR-LINUX-TPM2-SVC-PROD/1` | TPM2 sealed object protects the random slot key for a dedicated service, with closed measured-boot and authorized-successor policy. | Production only after TC10 qualification. | Exact distro/kernel, TPM/firmware, resource manager/stack, PCR bank/selection/policy, platform authorization, service sandbox/MAC, no fallback, crossing, and FIPS evidence. |

Linux production never falls back to Secret Service, home-directory keys,
kernel key retention without the selected TPM policy, systemd null-key/file/
stdout credentials, environment, or a user daemon. Qualification closes
namespace, ptrace, `/proc`, core dump, swap/hibernation, capabilities, seccomp,
LSM, cgroup, IPC peer, and executable identity. Missing features deny.

### 5.5 Platform independence

- A slot never opens under another platform profile, even with the same account,
  store, repository, or device.
- Moving repository bytes does not move custody. A new host needs a new
  authorized platform slot created from current custody/recovery.
- Development slots cannot relabel, copy, rewrap, restore, or promote into
  production. Production onboarding creates a fresh platform slot; entry
  promotion remains a fresh TC03 production import.
- Multiple current platform slots require exact owner-authorized device/service
  identities and one later atomic complete-set commit. Ordinary use resolves
  one exact slot before any platform call.

## 6. Measured boot, updates, lock/reset, and loss

Platform slots are `STAGED`, `CURRENT`, `SUSPENDED`, `RETIRED`, or `REVOKED`.
TC05/TC06 own persistence/transitions; TC04 defines custody semantics.

For a planned OS/firmware/update transition:

1. While current platform and recovery slots open, authorize one exact successor
   OS/firmware/hardware/profile target.
2. Create a fresh slot key and sealed object; the provider emits a fresh
   context-bound KWP root wrap. Copy no old slot key/blob/wrap.
3. Require current TC10 evidence for the exact successor operating environment;
   version ranges and vendor family names do not qualify it.
4. Pass a non-effecting synthetic test and provider-internal root equality
   challenge without root export.
5. TC05 later activates successor with bounded overlap. TC06 retires old only
   after recovery confirmation and rollback/current-generation proof.

Linux may use an owner-approved signed successor PCR policy, but no wildcard
PCR, empty policy, automatic reseal from untrusted boot, or broad update signer
is inferred. Windows/macOS require equivalent exact successor proof or recovery
onboarding.

| Condition | Required result |
| --- | --- |
| Lock, custody unavailable, user cancellation, temporary outage | Fixed denial; no alternate trial or portable prompt. Recovery requires a new authenticated ceremony. |
| OS/TPM/keychain reset, passcode/biometric/ACL reset, service/code identity change, or key loss | Suspend slot/profile; `RECOVERY_REQUIRED`; never recreate same ID. |
| Unstaged measured-boot/OE change | Deny before unseal. Recovery may create a fresh successor only after exact requalification. |
| Theft or suspected compromise | TC06 later revokes and fences; TC08 audits. Recovery is not automatically compromised without evidence. |
| Last platform slot lost, recovery current | TC09 may reconstruct only into a separate fresh generation, never in-place activate the old. |
| Platform and recovery unavailable/stale/unproven | Permanent fail-closed loss; no override, master key, vendor bypass, or reconstruction claim. |

## 7. Root-slot records and cryptographic binding

TC04 closes the canonical slot and ceremony-authority schemas below. TC03
`ECR.Canonical/1`, typed references, SHA-256, HKDF-SHA-256, AES-256-KWP,
integer bounds, and uniform errors apply. TC05 owns protected storage and
transactions. TC10 must publish byte-exact vectors before implementation.

Initial-root and slot-management ceremonies cannot use an ordinary TC02
`AuthorityDecisionV1`: every eligible ordinary action requires
`TC04_CUSTODY_CURRENT`, which the first slot cannot satisfy. They instead use
the following human-only bootstrap-safe record. This is not a new owner choice
or ordinary credential-action authority. It implements locked Q3/Q4 for local custody setup only,
has no model/service path, and cannot authorize credential use.

```cddl
root-slot-profile-ref-v1 = custody-profile-ref-v1 /
  portable-profile-ref-v1 / recovery-profile-ref-v1
maybe-recovery-operator-ref-v1 = [0] / [1, principal-ref-v1]
maybe-platform-scheme-v1 = [0] / [1, 1..6]
custody-bootstrap-lineage-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CustodyBootstrapLineage/1", sha256-v1]
maybe-custody-bootstrap-lineage-ref-v1 = [0] /
  [1, custody-bootstrap-lineage-ref-v1]
custody-ceremony-kind-v1 = "INITIALIZE_ROOT" / "ADD_PLATFORM_SLOT" /
  "ADD_PORTABLE_SLOT" / "ADD_RECOVERY_SLOT" /
  "CONFIRM_PORTABLE_SLOT" / "CONFIRM_RECOVERY_SLOT" /
  "STAGE_SUCCESSOR_SLOT" /
  "REPLACE_LOST_SLOT" /
  "ACKNOWLEDGE_DEVELOPMENT_RECOVERY_OMISSION"
custody-ceremony-status-v1 = "STAGED" / "ACTIVE" / "CONSUMED" /
  "REVOKED" / "EXPIRED"
custody-ceremony-authority-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CustodyCeremonyAuthority/1", sha256-v1]
custody-ceremony-authn-evidence-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CustodyCeremonyAuthenticationEvidence/1", sha256-v1]
custody-ceremony-consumption-proof-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CustodyCeremonyConsumptionProof/1", sha256-v1]
store-transaction-receipt-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.StoreTransactionReceipt/1", sha256-v1]
store-history-evidence-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.StoreHistoryEvidence/1", sha256-v1]

custody-bootstrap-lineage-v1 = [
  "ECR.CustodyBootstrapLineage/1", id128-v1,
  store-ref-v1, 1, 1, principal-ref-v1,
  id128-v1, root-slot-profile-ref-v1, maybe-platform-scheme-v1,
  id128-v1, epoch-vector-v1, qualified-tuple-ref-v1, "STAGED"
]

custody-ceremony-authority-v1 = [
  "ECR.CustodyCeremonyAuthority/1", id128-v1,
  custody-ceremony-kind-v1, principal-ref-v1,
  maybe-recovery-operator-ref-v1, environment-ref-v1,
  store-ref-v1, uint63, uint63,
  id128-v1, root-slot-profile-ref-v1, maybe-platform-scheme-v1,
  id128-v1, owner-readback-ref-v1, trusted-time-input-ref-v1,
  maybe-custody-bootstrap-lineage-ref-v1,
  custody-ceremony-authn-evidence-ref-v1, sha256-v1,
  epoch-vector-v1, qualified-tuple-ref-v1,
  utc-instant-v1, utc-instant-v1, custody-ceremony-status-v1
]
custody-ceremony-consumption-proof-v1 = [
  "ECR.CustodyCeremonyConsumptionProof/1", id128-v1,
  custody-ceremony-authority-ref-v1,
  custody-ceremony-authn-evidence-ref-v1, sha256-v1,
  id128-v1, custody-ceremony-kind-v1,
  environment-ref-v1, store-ref-v1, uint63, uint63, id128-v1,
  root-slot-profile-ref-v1, trusted-time-input-ref-v1,
  epoch-vector-v1, qualified-tuple-ref-v1,
  id128-v1, "CONSUMED"
]
```

Fields after the principals are exact environment, store, store generation, root generation,
slot ID, exact profile, tagged platform scheme, one-use ceremony-attempt ID,
exact owner readback, trusted-time evidence, bootstrap-lineage tagged reference,
one exact ceremony-authentication evidence
reference, canonical subject digest, complete epochs, tuple, inclusive start,
exclusive expiry, and status. Owner is one current `OWNER_HUMAN`.
Subject digest is SHA-256 over
`ASCII("ECR-TC04/CEREMONY-SUBJECT/1") || U64BE(length(subject)) || subject`.
`subject` is the canonical array of every authority field from authority ID
through expiry, in field order, excluding only authentication-evidence
reference, subject digest, and status. It is projected from canonical authority
values; a caller cannot supply it separately.
The exact `environment-ref-v1` is therefore inside the signed/authenticated
canonical subject and cannot be omitted, defaulted, inferred from a profile set,
or substituted by another environment in that set.

`CustodyCeremonyAuthenticationEvidenceV1` is later-TC10-qualified protected
evidence, not a self-assertion. It binds the exact subject digest; resolved
current owner principal and authentication profile; optional recovery operator
and its profile; fresh local authentication session; exact broker/UI code and
channel identities; the same attempt, environment, store, time, epochs, and tuple; and a
successful human-presence result. Until TC10 closes its canonical body,
`Record(T)` accounting, external trust root, and adverse proof, no ceremony
authority may become `ACTIVE`. A principal reference, account, terminal,
repository, or store-directory possession is never authentication.

First `INITIALIZE_ROOT` evidence is rooted outside the empty store in the
selected qualified local OS/hardware human authenticator and authenticated
broker/UI identity. It binds a fresh random store ID before any store object.
TC05 later atomically publishes that lineage, evidence, authority, creation
consumption proof, initial slot, receipt/history commitment, generation-1
manifest, and—when the initial slot is portable—the exact precommitted
`CarrierBindingV1`, or publishes none. A portable slot can never
publish with a dangling binding reference or expose the binding without its
slot/lineage/authority generation. No store-authored record, model/session
assertion, ordinary TC02 approval, or current-custody predicate bootstraps trust.

For this atomic bootstrap, `precommitted` means the canonical binding and
consumption-proof bytes/digests are frozen under one durable TC05 transaction
intent ID before KWP, not separately published/current. KWP consumes both
frozen digests through binding/common. The transaction then publishes binding
when applicable, proof, referring slot, receipt/history commitment, and manifest
together.

`CustodyBootstrapLineageV1` is constructed before the initialization subject
and contains no authority/evidence digest, so the graph is acyclic. Its fields
are fresh lineage ID, fresh store, literal store/root generation `1`, owner,
initial platform-or-portable slot ID/profile/scheme, initialization-attempt ID,
complete epochs/tuple, and `STAGED`. The initialization subject authenticates
its digest. The lineage tagged reference is present only for `INITIALIZE_ROOT`
and the exact generation-1 `ADD_RECOVERY_SLOT`/`CONFIRM_RECOVERY_SLOT` setup
branch; it is absent everywhere else. All three authorities remain distinct,
with distinct authority IDs, kinds, target slots, attempts, subjects, and
authentication evidence.

The complete ceremony relation matrix is normative; every unlisted
combination is schema-invalid before authentication or provider work:

| Ceremony kind | Exact profile branch | Exact slot suite | Scheme tag | Recovery-operator tag | Additional relation |
| --- | --- | --- | --- | --- | --- |
| `INITIALIZE_ROOT` | custody | prod `1`; nonprod `2` | present, exact platform scheme | absent | Empty fresh store; store/root generation `1`; fresh platform slot and present staged lineage. |
| `INITIALIZE_ROOT` | portable | prod `1`; nonprod `2` | absent | absent | Empty fresh store; current production downgrade if prod; fresh portable slot and present staged lineage. |
| `ADD_PLATFORM_SLOT` | custody | prod `1`; nonprod `2` | present, exact platform scheme | absent | Current root; fresh platform slot. |
| `ADD_PORTABLE_SLOT` | portable | prod `1`; nonprod `2` | absent | absent | Current root; current production downgrade if prod. |
| `ADD_RECOVERY_SLOT` | recovery | prod `3`; nonprod `4` | absent | absent | Current root with absent lineage, or exact staged generation-1 lineage source; owner creates/stores carrier. |
| `CONFIRM_PORTABLE_SLOT` | portable | prod `1`; nonprod `2` | absent | absent | Same owner/binding/staged slot; fresh confirmation attempt. |
| `CONFIRM_RECOVERY_SLOT` | recovery | prod `3`; nonprod `4` | absent | absent | Same owner/binding/staged slot; current root with absent lineage, or exact staged generation-1 lineage source; fresh attempt. |
| `STAGE_SUCCESSOR_SLOT` | custody | prod `1`; nonprod `2` | present, exact successor scheme | absent | Current root; exact prequalified OS/hardware successor. |
| `REPLACE_LOST_SLOT` | custody | prod `1`; nonprod `2` | present, exact replacement scheme | present | Distinct current human recovery operator; TC09-authorized fresh generation only. |
| `REPLACE_LOST_SLOT` | portable | prod `1`; nonprod `2` | absent | present | Distinct current human recovery operator; exact downgrade and TC09 fresh generation only. |
| `ACKNOWLEDGE_DEVELOPMENT_RECOVERY_OMISSION` | custody | exactly nonprod `2` | present, exact current platform scheme | absent | Exactly `SYNTHETIC_DEVELOPMENT`; existing current qualified platform slot; authenticated `OWNER_HUMAN`; no recovery slot and no lineage. |

Here custody, portable, and recovery mean exactly the corresponding alternatives
of `root-slot-profile-ref-v1`. The owner creates, confirms, and separately
stores the offline artifact as Q4 locks. A distinct `RECOVERY_OPERATOR`
participates only in `REPLACE_LOST_SLOT`, where separation of duties governs
actual recovery; it is never carrier holder or ordinary-use authority. Only one
unexpired `ACTIVE` authority at current epochs and with one fresh authentication
session may be consumed once.

At consumption, TC05 atomically commits one immutable
`CustodyCeremonyConsumptionProofV1`. Its fields after proof ID are authority
digest, authentication-evidence digest, subject digest, attempt ID, operation,
exact environment, store/store/root generation, target slot/profile, trusted consumption-time
evidence, the complete then-current epoch vector/tuple, transaction-intent ID,
and `CONSUMED`. The transaction field is a fresh non-digest `id128-v1` intent
ID, not a receipt reference. Every duplicated value byte-equals the immutable
authority and evidence. The future TC05 receipt/history records bind that same
transaction ID, the exact consumption-proof digest, and committed-effect digest;
the proof never references their final digests, so the graph is acyclic. The
receipt proves this exact proof and effect were published in one admitted
transaction, and TC05's authenticated rollback-evident history proves
the recorded vector/tuple were protected-current at that transaction. Proof
fields alone cannot self-assert past currentness. Absence, ambiguity, a second
proof, or rollback denies.
The future TC05 receipt body and `Record(T)` remain a hard gate.

Every committed `RootSlotCommonV1` carries the exact creation-proof reference;
every committed `CarrierConfirmationV1` carries the exact confirmation-proof
reference. The admitted TC05 generation manifest maps each proof digest and its
non-digest transaction ID to exactly one receipt reference and one authenticated
history-evidence reference. Those later-owned records bind the proof digest,
same transaction ID, and effect digest. Missing/extra/duplicate mappings,
caller/path lookup, or any transaction mismatch rejects. TC04 defines only
their typed references; TC05 must close their nonserializable bodies and
`Record(T)` terms before qualification.

The slot binds the immutable `ACTIVE` authority snapshot used at creation.
Later slot opens resolve that exact authority, evidence, subject, and unique
consumption proof by digest. They prove that the authority/evidence were
authentic, `ACTIVE`, unexpired, current for their recorded epochs/tuple, and
consumed once at the proof's trusted time. These historical records are never
rewritten or replaced under the same digest. They need not be presently
`ACTIVE`, unexpired, or current after valid consumption; setup expiry alone does
not invalidate the slot. Present currentness applies only to selected profile,
qualified tuple, complete epochs, slot lifecycle, carrier confirmation/currentness
link when applicable, and the live ordinary or current-ceremony authority.

`INITIALIZE_ROOT` is valid only for an empty owner-created store at store/root
generation 1, targets the platform or authorized-portable matrix branch, and
creates no ordinary-use eligibility until a distinct recovery slot is
confirmed. Every add/stage/confirm operation other than
`REPLACE_LOST_SLOT` requires a current root handle from an already qualified
slot. The sole bootstrap exception lets `ADD_RECOVERY_SLOT` and its matching
`CONFIRM_RECOVERY_SLOT` reopen only the TC05-admitted staged initial slot whose
creation authority authenticates the same immutable lineage. Each new operation
uses its own subject, attempt, and authentication evidence, while lineage,
store/root generation, owner, initial source slot/profile/scheme, epochs, and
tuple byte-equal. The reopened root handle binds only the current add/confirm
authority and attempt; it grants no ordinary use or authority transfer.
`REPLACE_LOST_SLOT` requires the separate TC09 recovery path and
activates only a fresh generation. No ceremony authority can satisfy an ordinary request's
`TC04_CUSTODY_CURRENT` or its TC06 approval/lease requirements.

For every slot creation or mutation operation, authority environment,
store/store generation/root generation/slot ID,
profile, scheme, bootstrap lineage when present, complete epoch vector, tuple, and authority reference
byte-equal the corresponding admitted common, kind-specific slot,
binding/confirmation when present, and TC05 transaction. Common suite equals
the matrix suite. Evidence subject, attempt, owner, optional operator, time,
and validity resolve uniquely. No default, inherited field, cross-kind
substitution, or second authority candidate exists.

For every ceremony kind, authority environment byte-equals the one selected
`EnvironmentV1` from the admitted request/generation and is an exact member of
the selected profile's environment set. Authentication evidence and consumption
proof carry that same environment reference, and their canonical subjects and
duplicated fields byte-equal it. Profile-set membership alone never chooses an
environment. Cross-environment reuse, including between two environments
allowed by one profile, rejects before authentication consumption or provider
work.

The development-omission acknowledgement does not create, open, or mutate a
slot. Its authority target environment/store/generations/slot/profile/scheme, owner,
epochs, and tuple byte-equal the one selected current suite-2 platform slot and
the omission body's exact `environment-ref-v1`; its kind, absent lineage/operator, attempt, warning readback,
subject/evidence, validity, authority reference, and proof reference byte-equal
the exact admitted omission ceremony. No creation-authority substitution,
implicit owner authority, or provider call is permitted.

For `INITIALIZE_ROOT`, target slot/profile/scheme and attempt equal the
lineage's initial slot/profile/scheme and initialization attempt. For the two
generation-1 recovery operations, authority target is the recovery slot while
the lineage's initial slot/profile/scheme identify only the staged source;
authority and lineage store, literal generations, owner, epochs, and tuple are
equal. The recovery binding/confirmation identifies the same recovery target.
No digest points from lineage back to an authority or evidence record.

For later ordinary use, the existing TC02 request/decision path applies without
change. Its entry and one composite `provider-tenant-target-ref-v1` are the
credential action's exact values, not the custody provider. Slot ceremonies
never fabricate a control entry or weaken TC02's later-requirement matrix.

```cddl
root-slot-suite-v1 = 1 / 2 / 3 / 4
root-slot-common-v1 = [
  "ECR.RootSlotCommon/1", 1, root-slot-suite-v1,
  store-ref-v1, uint63, uint63, id128-v1, id128-v1, uint63,
  root-slot-profile-ref-v1, epoch-digest-ref-v1,
  epoch-vector-object-ref-v1, qualified-tuple-ref-v1,
  custody-ceremony-authority-ref-v1,
  custody-ceremony-consumption-proof-ref-v1
]
```

After schema/version/suite, fields are store, store generation, root
generation, fresh slot ID, fresh platform/recovery key ID, wrapping generation,
exact kind-specific profile, complete epoch digest/protected vector, tuple, and
ceremony authority plus its exact creation-consumption proof. All IDs and epoch scope IDs are exact 16-byte `id128-v1`.
Every copied field byte-equals its admitted/resolved source. Profile scalar
qualification epoch, tuple scalar, and the tuple's qualification-vector entry
are identical. Slot/key IDs are independent and never reused.

The slot records and complete KWP contexts are:

```cddl
platform-scheme-v1 = 1..6
platform-protected-value-v1 = bstr .size (1..65536)
wrapped-root-v1 = bstr .size 40
argon2id-salt-v1 = bstr .size 16
recovery-source-v1 =
  [1, "RANDOM_RAK_256"] /
  [2, "ARGON2ID_V13", "OWNER_SELECTED_ASCII",
    19, 2097152, 1, 4, 32, argon2id-salt-v1]
carrier-binding-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CarrierBinding/1", sha256-v1]

root-platform-slot-v1 = [
  "ECR.RootPlatformSlot/1", 1, root-slot-common-v1,
  platform-scheme-v1, platform-protected-value-v1,
  platform-policy-ref-v1, wrapped-root-v1
]
root-portable-slot-v1 = [
  "ECR.RootPortableSlot/1", 1, root-slot-common-v1,
  portable-profile-ref-v1, carrier-binding-ref-v1, wrapped-root-v1
]
root-recovery-slot-v1 = [
  "ECR.RootRecoverySlot/1", 1, root-slot-common-v1,
  recovery-profile-ref-v1, recovery-source-v1,
  carrier-binding-ref-v1, wrapped-root-v1
]

root-platform-kdf-context-v1 = [
  "ECR.KwpRootSlotContext/1", 1, root-slot-suite-v1, 1,
  id128-v1, id128-v1, root-slot-common-v1,
  platform-scheme-v1, platform-protected-value-v1,
  platform-policy-ref-v1
]
root-portable-kdf-context-v1 = [
  "ECR.KwpRootSlotContext/1", 1, root-slot-suite-v1, 2,
  id128-v1, id128-v1, root-slot-common-v1,
  portable-profile-ref-v1, carrier-binding-ref-v1
]
root-recovery-kdf-context-v1 = [
  "ECR.KwpRootSlotContext/1", 1, root-slot-suite-v1, 3,
  id128-v1, id128-v1, root-slot-common-v1,
  recovery-profile-ref-v1, recovery-source-v1, carrier-binding-ref-v1
]
```

For platform and portable slots, production common suite is exactly 1 and
nonproduction common suite exactly 2. Recovery production is exactly 3 and
nonproduction exactly 4. Kind/profile/environment/tuple must agree; no suite
negotiation or relabel exists. Platform scheme values 1..6 correspond in order
to the six profiles in section 5 and byte-agree with the profile. A mechanism
unable to authenticate its protected value and exact policy is unsupported.
Recovery suite 3 requires recovery-source tag 1 and a profile whose mechanism
is `RANDOM_RAK_256`. Recovery suite 4 requires tag 2 and mechanism
`ARGON2ID_V13`; its numeric fields are literal Argon2 version 19, memory
2,097,152 KiB, one iteration, four lanes, and 32-byte output. No other source,
parameter, or suite/profile combination is valid.

After each context's schema/version/suite/kind, the two IDs byte-equal the slot
and platform/recovery key IDs inside `root-slot-common-v1`. Common byte-equals
the admitted slot record's common field. Every following kind-specific value
byte-equals the same-position record value. Construct context only by copying
canonical decoded values from one TC05-admitted slot record; a caller-supplied
or separately reconstructed context is invalid. The context is the complete
non-circular projection of that record and omits only `wrapped-root-v1`.

```text
d = canonical(root-slot-common-v1.store-ref-v1)
salt = SHA-256(ASCII("ECR-ROOT-SLOT-HKDF-SALT/1") ||
                  U64BE(length(d)) || d)
info = canonical(the exact kind-specific root-slot KDF context)
parent_material = slot_key                              for PLATFORM
parent_material = PCAK                                  for PORTABLE
parent_material = RAK                                   for RECOVERY suite 3
parent_material = Argon2id(input, argon2id_salt,
                           v=19, m=2097152 KiB, t=1, p=4, out=32)
                                                        for RECOVERY suite 4
root_wrapping_material = HKDF-SHA-256(parent_material, salt, info, 32)
wrapped_root = AES-256-KWP(root_wrapping_material, vault_root_32)
```

Suite-4 source provenance is exactly `OWNER_SELECTED_ASCII`. The owner selects
the secret independently of KStack; KStack never generates, suggests,
transforms, expands, normalizes, strength-scores, or accepts a model/service
choice for it. Suite-4 `input` is exactly 16..128 octets, every octet in ASCII `0x21..0x7e`,
entered through the qualified fixed-length no-echo local UI. No trimming,
case-folding, Unicode decoding/normalization, whitespace acceptance, terminal
encoding, or NUL termination occurs. The input is never serialized. The exact
16-byte `argon2id_salt` is generated independently by the qualified DRBG for
each recovery slot; it is stored only in the protected slot's tag-2 source and
is authenticated by the complete TC05 wrapper/AAD and by its byte-identical
presence in this KWP context. Salt reuse is forbidden by generation procedure,
not tested through a persistent secret/salt comparison index. Allocation failure
omits the suite-4 slot. Argon2 output, never the raw input, is the HKDF parent;
input, Argon2 output, HKDF output, and provider copies are cleared after the
one attempt. There is no direct Argon2-to-KWP or parameter-reduction path.

The full platform protected value, scheme, policy; portable/recovery profile,
recovery source including suite-4 salt, and precommitted carrier binding; both IDs; store and
store/root/wrapping generations; profile; epochs; tuple; and ceremony authority
all bind KWP. Mutation/transplant of any included byte derives different
material and fails KWP before a root handle or later equality challenge exists.
No secret input, derived value, or root occurs in canonical slot/context bytes.

All three records are disjoint. Copying a protected value/wrapped root between
kinds, changing only profile/suite, or treating recovery as ordinary custody
rejects. TC05's future protected wrapper/AAD binds the complete record digest,
object kind, store/store/root generation, slot/wrapping generation, profile,
and epochs without redefining these bodies.

## 8. Portable and offline-recovery carriers

`ECR-PORTABLE-CUSTODY-CARRIER/1` holds one random 32-byte PCAK for temporary
owner-approved portable ordinary custody. `ECR-OFFLINE-RECOVERY-CARRIER/1`
holds a separate random 32-byte RAK that is absent during ordinary use. Values,
artifact IDs, roles, locations, profiles, and confirmations are independent.

Production carrier payload is exactly 60 bytes: one byte version literal 1;
one byte kind (1 portable, 2 recovery); a fresh 16-byte artifact ID; the
32-byte artifact value; and a 10-byte check field. The check field is the first
10 bytes of SHA-256 over ASCII `ECR-HUMAN-CARRIER-CHECK/1`, then version, kind,
artifact ID, and artifact value in that order. It detects transcription error;
it is not authentication, strengthening, or authority.

Encode the 60 bytes using RFC 4648 uppercase Base32 without padding: exactly 96
characters displayed as 24 four-character groups with one ASCII hyphen between
groups. Decode only this presentation. Lowercase, glyph substitution,
whitespace, padding, alternate alphabets, Unicode normalization, truncation,
extension, bad separators, or check mismatch rejects before provider import.
Artifact ID is nonsecret; the complete carrier and check field are protected.

Carrier payload is a fixed external human transcription format, not CBOR. A
content-free binding is canonically frozen in the transaction before KWP so confirmation is not a circular
KDF input. Binding, confirmation, and development omission are canonical CBOR:

```cddl
carrier-kind-v1 = 1 / 2
carrier-confirmation-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CarrierConfirmation/1", sha256-v1]
carrier-currentness-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.CarrierCurrentness/1", sha256-v1]
carrier-binding-v1 = [
  "ECR.CarrierBinding/1", id128-v1, carrier-kind-v1,
  id128-v1, store-ref-v1, uint63, uint63, id128-v1,
  root-slot-profile-ref-v1, custody-ceremony-authority-ref-v1,
  id128-v1, epoch-vector-v1, qualified-tuple-ref-v1, "STAGED"
]
carrier-confirmation-v1 = [
  "ECR.CarrierConfirmation/1", id128-v1, carrier-binding-ref-v1,
  carrier-kind-v1,
  id128-v1, store-ref-v1, uint63, uint63, id128-v1,
  root-slot-profile-ref-v1, custody-ceremony-authority-ref-v1,
  custody-ceremony-consumption-proof-ref-v1,
  id128-v1, principal-ref-v1, trusted-time-input-ref-v1,
  epoch-vector-v1, qualified-tuple-ref-v1, "CONFIRMED"
]
carrier-currentness-v1 = [
  "ECR.CarrierCurrentness/1", id128-v1,
  store-ref-v1, uint63, uint63, id128-v1,
  carrier-binding-ref-v1, carrier-confirmation-ref-v1,
  root-slot-profile-ref-v1, epoch-vector-v1,
  qualified-tuple-ref-v1, "CONFIRMED_CURRENT"
]
development-recovery-omission-ref-v1 = [1, 2, "ECR-D1/OBJECT",
  "ECR.DevelopmentRecoveryOmission/1", sha256-v1]
development-recovery-omission-v1 = [
  "ECR.DevelopmentRecoveryOmission/1", id128-v1,
  principal-ref-v1, store-ref-v1, uint63, uint63,
  environment-ref-v1, custody-profile-ref-v1,
  custody-ceremony-authority-ref-v1,
  custody-ceremony-consumption-proof-ref-v1,
  owner-readback-ref-v1, id128-v1, trusted-time-input-ref-v1,
  epoch-vector-v1, qualified-tuple-ref-v1, "ACKNOWLEDGED"
]
```

Binding fields after kind are artifact ID, store, store/root generations, slot
ID, exact profile, creation ceremony authority, creation-attempt ID, epochs,
tuple, and `STAGED`. It exists before the wrapped root is calculated, contains
no confirmation claim, and byte-binds the slot KDF by digest.

Confirmation fields after its binding and kind are artifact ID, store, store generation, root
generation, slot ID, exact profile, ceremony authority, confirmation-attempt
consumption proof, confirmation-attempt ID, authenticated confirmer, time,
complete epochs, tuple, and status. All IDs
are `id128-v1`. Artifact value/check/derivative/location are absent. Production
recovery and portable confirmation require the exact owner who created their
binding, under their respective exact profiles. Every copied generation/profile/epoch/tuple value
byte-equals the resolved binding, staged slot, and authorities. Recovery uses a
distinct `CONFIRM_RECOVERY_SLOT` authority and portable custody a distinct
`CONFIRM_PORTABLE_SLOT` authority. A missing confirmation keeps the binding and
slot staged; it never changes KDF bytes or permits currentness.

`CarrierConfirmationV1`'s `trusted-time-input-ref-v1` byte-equals the exact
confirmation consumption proof's `trusted-time-input-ref-v1`. It aliases that
already resolved confirmation-proof time input, never supplies a distinct time
candidate or resolver input, and uses that proof time input's already charged
referenced closed `UtcSkewEvidenceV1`. A missing, second, or mismatched time or
skew path denies before carrier input or custody/provider work.

`CarrierCurrentnessV1` is the non-circular activation link committed by TC05
after confirmation. It binds store/store/root generation, slot ID, exact
binding and confirmation digests, profile, current epochs/tuple, and status.
Exactly one matching currentness record may resolve for a current portable or
recovery slot; it is outside KWP and cannot change the staged slot bytes.

Development omission fields bind the active owner, exact synthetic-development
store/store/root generation, environment, development custody profile, full
warning readback, one setup-attempt ID, current time/epochs/tuple, and literal
status. It is invalid for controlled nonproduction or production and cannot
serve as a recovery confirmation reference.

No QR/barcode, screenshot, PDF, printer spool, clipboard, shell, argument,
environment, redirected stream, browser, online note, generic secret manager,
Git/Jira item, model-visible tool, or repository file is an approved production
carrier. A future qualified local display/print device may add presentation only
after proving no retained/spooled copy and cannot change payload bytes. The
baseline is owner transcription to a physically offline medium through a
private human-only local ceremony.

### 8.1 Production recovery creation and confirmation

1. Preconditions are the authenticated active owner; exact production
   store/root generation; exactly one source consisting of either a current
   qualified platform slot, an authorized-current portable slot under the
   exact section 8.3 production downgrade, or—only for the section 7
   generation-1 setup branch—the exact TC05-admitted staged initial slot named
   by the immutable bootstrap lineage; current FIPS
   provider/entropy profile; qualified trusted local UI; no model, remote
   session, screen capture, clipboard, logs, recording, telemetry, spool, or
   ordinary terminal; and a new later TC06 attempt reservation. A recovery,
   retired, revoked, replaced, stale, unqualified, ambiguous, caller-selected,
   or old-generation slot is never a fallback source. Each admitted source
   retains its own platform qualification, portable downgrade, or staged-lineage
   gates through creation and confirmation.
2. The provider generates fresh RAK and artifact ID. The broker freezes the
   content-free `CarrierBindingV1` in the TC05 transaction intent, forms/displays the carrier once, and creates
   the staged recovery slot whose KWP context contains that binding reference.
   Carrier bytes are never persisted.
3. The owner transcribes it to one separately stored offline medium, verifies
   displayed artifact ID, and ends display. Broker buffers are overwritten
   best-effort and released; UI closes.
4. Confirmation is a new owner-authenticated attempt after display state and
   buffers are gone. The owner re-enters all 96 characters through fixed-length,
   no-echo, no-history trusted local input owned by the broker. Before provider
   work, TC05 freezes the confirmation consumption proof under one fresh
   transaction-intent ID.
5. The broker validates encoding/check/kind/ID, imports the RAK once, derives
   exact wrapping material, and opens the staged root inside the provider. It
   proves equality to the current root only by a provider-internal challenge
   bound to store, root, slot, and attempt; neither root nor challenge key exits.
6. Success clears input and emits a content-free confirmation binding the
   precommitted carrier binding, kind, artifact ID, slot, root generation,
   profile, distinct confirmation authority, its exact consumption-proof
   reference, attempt, trusted-time
   reference, epoch vector, and `CONFIRMED`. It contains no carrier, check,
   derivative, location, hint, or custodian. TC05 later atomically commits the
   confirmation, its precommitted consumption proof, matching
   `CarrierCurrentnessV1`, and receipt/history commitment under one transaction
   ID, or none of them.
7. Mismatch, loss, timeout, cancellation, crash, or uncertainty consumes the
   attempt. The staged slot remains noncurrent for later protected cleanup; the
   live generation is neither changed nor quarantined.
8. The owner seals and stores the carrier physically separate from device
   and platform-custody material. KStack records confirmation, never location.

Q4's authenticated owner is the creation, confirmation, and offline-storage
principal; TC04 invents no third holder. Separation of duties applies later:
actual `REPLACE_LOST_SLOT` recovery requires the matrix's distinct current
human recovery operator and TC09 authorization while the owner remains present.
Neither role may be an unattended service. Threshold sharing is not selected
because it would add cryptography and an owner fork outside closed TC03.

### 8.2 Development recovery

Synthetic development may omit recovery only after this local full warning:
"Loss or reset of this platform custody profile permanently destroys this
store; KStack has no master key or bypass." Acknowledgement binds owner, exact
development store/environment/root generation, warning digest, current epoch
vector, and one setup attempt. It grants no production authority.

The acknowledgement reuses the section 7 ceremony graph. Its exact
`ACKNOWLEDGE_DEVELOPMENT_RECOVERY_OMISSION` authority is authenticated for one
current `OWNER_HUMAN`, one `SYNTHETIC_DEVELOPMENT` environment, one suite-2
current qualified platform slot and custody profile, absent recovery operator
and lineage, the full warning readback, fresh attempt, current epochs/tuple,
and the slot's exact store/store generation/root generation/slot ID/platform
scheme. The omission's authority and consumption-proof references byte-equal
the admitted records for that subject and attempt. The authority evidence must
be externally authenticated and current when consumed once; a principal
reference, owner role, readback, account, path, or session assertion alone is
never authority.

The omission's `environment-ref-v1` byte-equals the authority canonical
subject's environment, authentication evidence environment, consumption-proof
environment, and the one protected current environment selected for the
operation. This is byte equality of the full typed reference, not shared store,
profile-set membership, tuple, or environment-class equivalence; no link may
name a second environment.

TC05 admits the omission, authority/evidence, immutable one-use proof, receipt,
rollback-evident history, and generation-manifest proof/transaction mapping in
one transaction or none. Their proof digest, non-digest transaction ID, effect
digest, epochs, tuple, and store generations obey section 7's exact equality,
uniqueness, and no-reverse-digest rules. The omission's
`trusted-time-input-ref-v1` byte-equals its consumption proof's time reference,
uses that proof time's referenced closed `UtcSkewEvidenceV1`, and creates no
distinct time/skew resolver input. Forged, self-issued, replayed,
unauthenticated, partial, ambiguous, mismatched, or multiply consumed records
deny before custody/provider work.

#### 8.2.1 Suite-4 owner-selected offline lifecycle

Suite 4 remains nonproduction-only and is admitted only under its exact
`ARGON2ID_V13`/`OWNER_SELECTED_ASCII` recovery profile. The owner independently
selects one 16..128-byte ASCII `0x21..0x7e` secret. KStack never generates,
suggests, transforms, expands, normalizes, strength-scores, or asks a model or
service to select it.

For creation, after fresh owner authentication and attempt reservation, the
qualified DRBG makes an independent fresh 16-byte artifact ID and independent
fresh 16-byte Argon2 salt. The public label is exactly ASCII `ECR-S4/1-`
followed by the artifact ID as 32 uppercase hexadecimal characters: exactly 41
bytes, with no alternate case, separator, prefix, or encoding. Before secret
input, TC05 freezes one content-free `CarrierBindingV1` containing that
artifact ID and the exact ceremony/slot/profile/generation context. The trusted
local UI displays the label once. The owner records that label and the
independently selected secret together only on one physically offline medium,
then enters the secret through fixed-bound no-echo/no-history input with no
prefill. The broker derives Argon2 then HKDF/KWP using the independent stored
salt and exact precommitted context. TC05 atomically stages the binding, tag-2
source with salt/provenance, wrapped slot, ceremony proof, and exact
receipt/history/manifest mapping, or publishes none. Creation UI, input,
derived values, and transient state are then cleared and destroyed.

Confirmation and later TC09 recovery first resolve exactly one already
authorized recovery slot and its binding before displaying a label or accepting
input: the slot is `STAGED` for confirmation and is the exact TC09-authorized
current recovery slot for later recovery. A label can never select, search, enumerate, switch,
or fall back to a slot. Under a fresh owner authentication and reservation,
after all creation state has been destroyed, the owner independently re-enters
both the exact 41-byte label and the 16..128-byte secret with no prefill. The
decoded label artifact ID must byte-equal the resolved binding's ID. The broker
uses only the resolved slot's authenticated stored salt and exact KWP context.
Label parsing materializes one fixed 16-byte decoded artifact-ID buffer and
clears it after comparison. Argon receives the salt as a bounded view into the
already charged immutable decoded slot source; TC04 permits no second salt
copy, and any required provider salt copy is part of TC10's stricter proven
workspace.
Success requires both KWP-open and the provider-internal root-equality challenge;
syntax, label, Argon2, KWP, and challenge results never expose a secret-derived
stable equality oracle.

Any malformed label/input, mismatch, timeout, cancellation, crash, allocation
or provider failure burns the reserved attempt, clears all transient state,
performs no retry, slot fallback, enumeration, or quarantine, and returns the
fixed safe failure class. A retry requires a fresh authentication and durable
reservation. KStack never persists the combined artifact, input, check value,
secret digest/MAC, Argon output, HKDF output, hint, or location; it persists
only the nonsecret label components already bound separately as artifact ID and
the protected authenticated salt/source records. TC09 must inherit this exact
slot-before-input discipline and an equivalent-or-stricter later peak; TC05,
TC09, and TC10 still own transaction, recovery authorization, and real-provider
qualification respectively.

Nonproduction Argon2id recovery uses only section 7's exact suite-4 input,
random authenticated salt, fixed source record, and Argon2-to-HKDF chain. It
fails rather than reducing memory and never serves production, migration,
promotion, or restore.

### 8.3 Portable production downgrade

Before an exact `PortableProductionDowngradeAuthorityV1` becomes active, the
full owner-visible question states that:

- portable custody is not device/hardware bound and possession or copying of
  the PCAK can defeat custody after other authority is obtained;
- copying cannot be reliably detected or retroactively revoked;
- loss of both PCAK and platform access can cause unavailability;
- PCAK must be physically protected and cannot remain connected or online;
- the downgrade covers one repository, production environment, baseline
  profile, portable profile, owner, epoch vector, and finite time window;
- a distinct confirmed offline RAK remains mandatory;
- FIPS, rollback, store, broker/output, audit, recovery, authority, target,
  freshness, and qualification controls remain mandatory; and
- expiry or any failed predicate denies without fallback.

The runtime response is an exact human authority record, not conversational
text. Claude/Codex cannot approve, extend, repeat, or auto-select it. Expiry
blocks ordinary use and fences prior root handles; it never auto-switches.

## 9. `TC04_CUSTODY_CURRENT` evaluation

Evaluation occurs after TC02 eligibility and before later preparation. Require
exact current request/decision/attempt, environment/qualified tuple, profile and
qualification epoch, store/root/slot/wrapping generation, complete epoch vector,
provider/crossing profile, protected slot admission, and no suspended, revoked,
expired, or dequalified dependency.

For `PRODUCTION_USER_DATA`, additionally require:

1. TC03 suite-1 content and exact current FIPS evidence;
2. one selected `CURRENT` hardware/service platform slot before any call, or one
   current portable slot with exact binding/confirmation plus matching valid
   TC02 downgrade;
3. a distinct `CONFIRMED_CURRENT` suite-3 recovery slot for the same root;
4. current rollback, recovery, broker, output, and audit references in the exact
   tuple, while their later owners recheck them independently;
5. current boot/lock/service/key/policy evidence and qualified one-attempt
   crossing; and
6. no root handle from another decision, process, slot, attempt, profile, or
   expired downgrade.

For portable/recovery slots, `CONFIRMED_CURRENT` requires exactly one resolved
`CarrierBindingV1` whose digest byte-equals the slot/KDF field and exactly one
matching `CarrierConfirmationV1` plus one exact `CarrierCurrentnessV1`; every duplicated field and the creation and
confirmation authorities/evidence/consumption proofs must resolve, byte-equal,
have the same authenticated owner, and prove validity/currentness at their
recorded consumptions. They need not remain currently active or unexpired. The
profile, tuple, epochs, slot lifecycle, and confirmation/currentness link do
remain current. Only a later lost-slot replacement adds the matrix's
distinct recovery-operator relation. Binding without confirmation is staged.

Synthetic development requires an exact qualified development profile and a
confirmed allowed recovery slot or exact warning acknowledgement. Controlled
nonproduction follows exact environment policy but cannot resolve production
slot, suite, or profile.

Failure retains TC02 priority: profile/qualification absence maps to
`PROFILE_NOT_QUALIFIED`; invalid portable authority to
`PORTABLE_DOWNGRADE_INVALID`; stale epochs keep their TC02 codes;
revoked/quarantined/rollback state maps to `REVOKED_OR_QUARANTINED`; otherwise
ambiguous platform/crypto fault maps to `INTERNAL_FAIL_CLOSED`. Safe projection
remains TC02 `DENIED`, except its existing owner question when current human
approval is the sole missing predicate. TC04 exposes no hint/platform detail.

## 10. Resource and allocation accounting

TC04 inherits TC03's exact `Head`, `Int`, `Bytes`, `Text`, `Array`, `Map`,
`Max(T)`, `Items`, `Pairs`, `Depth`, `Meta(x)`, `record(x)`, and `Record(T)`
definitions unchanged. All arithmetic is checked unsigned 64-bit. A runtime
generates constants from productions; hand-entered caps are nonconforming.

The exact generated schema maxima are:

| TC04 schema | Normative maximum |
| --- | ---: |
| `CustodyProfileV1` | `Max(custody-profile-v1)` |
| `PortableProfileV1` | `Max(portable-profile-v1)` |
| `RecoveryProfileV1` | `Max(recovery-profile-v1)` |
| `CustodyBootstrapLineageV1` | `Max(custody-bootstrap-lineage-v1)` |
| `CustodyCeremonyAuthorityV1` | `Max(custody-ceremony-authority-v1)` |
| `CustodyCeremonyConsumptionProofV1` | `Max(custody-ceremony-consumption-proof-v1)` |
| `RootSlotCommonV1` | `Max(root-slot-common-v1)` |
| Platform/portable/recovery slot | `Max` of the exact selected `root-*-slot-v1` |
| Platform/portable/recovery KWP context | `Max` of the exact selected `root-*-kdf-context-v1` |
| `RecoverySourceV1` | `Max(recovery-source-v1)` |
| `CarrierBindingV1` | `Max(carrier-binding-v1)` |
| `CarrierConfirmationV1` | `Max(carrier-confirmation-v1)` |
| `CarrierCurrentnessV1` | `Max(carrier-currentness-v1)` |
| `DevelopmentRecoveryOmissionV1` | `Max(development-recovery-omission-v1)` |

The corresponding protected-resolution terms are exactly
`Record(custody-profile-v1)`, `Record(portable-profile-v1)`, and
`Record(recovery-profile-v1)` as selected by `Resolve04(K)` below; they are not
one interchangeable profile maximum. `Record(recovery-source-v1)` is already
inside the raw/canonical recovery slot and context charges and is not added a
second time.

`platform-protected-value-v1` has an achievable maximum of 65,536 bytes; this
is a schema leaf, not a generic record cap. A human carrier is exactly 60
decoded bytes and exactly 119 presentation bytes (96 Base32 characters plus 23
hyphens). Active plus retired platform/recovery slots retain TC03's maximum 16
per generation. Closed fields, nesting, and members are the exact selected
production and never exceed TC03's global 128, depth 8, or 4,096 limits.

For a rule-valid slot open `x` of kind `K`, let `s` be its encoded slot, `c` its
exact KWP context, and `Resolve04(x)` the concrete live protected records:

```text
ResolveCommon04 = record(slot-creation-ceremony-authority) +
                  record(slot-creation-authority-trusted-time-input) +
                  record(slot-creation-authority-utc-skew-evidence) +
                  present record(custody-bootstrap-lineage) +
                  record(slot-creation-ceremony-authentication-evidence) +
                  record(slot-creation-ceremony-consumption-proof) +
                  record(slot-creation-proof-trusted-time-input) +
                  record(slot-creation-proof-utc-skew-evidence) +
                  record(slot-creation-transaction-receipt) +
                  record(slot-creation-history-evidence) +
                  record(slot-creation-generation-manifest-proof-mapping) +
                  record(epoch-vector) + record(qualified-profile-tuple) +
                  record(profile-custody-service-principal) +
                  record(principal-owner) + present record(recovery-operator)
Resolve04(PLATFORM) = record(custody-profile) + ResolveCommon04
Resolve04(PORTABLE) = record(portable-profile) + ResolveCommon04 +
                      record(carrier-binding) +
                      present record(carrier-confirmation) +
                      present record(historical-confirmation-authority) +
                      present record(historical-confirmation-authority-trusted-time-input) +
                      present record(historical-confirmation-authority-utc-skew-evidence) +
                      present record(historical-confirmation-authentication-evidence) +
                      present record(historical-confirmation-consumption-proof) +
                      present record(historical-confirmation-proof-trusted-time-input) +
                      present record(historical-confirmation-proof-utc-skew-evidence) +
                      present record(historical-confirmation-transaction-receipt) +
                      present record(historical-confirmation-history-evidence) +
                      present record(historical-confirmation-generation-manifest-proof-mapping) +
                      present record(carrier-currentness)
Resolve04(RECOVERY) = record(recovery-profile) + ResolveCommon04 +
                      record(carrier-binding) +
                      present record(carrier-confirmation) +
                      present record(historical-confirmation-authority) +
                      present record(historical-confirmation-authority-trusted-time-input) +
                      present record(historical-confirmation-authority-utc-skew-evidence) +
                      present record(historical-confirmation-authentication-evidence) +
                      present record(historical-confirmation-consumption-proof) +
                      present record(historical-confirmation-proof-trusted-time-input) +
                      present record(historical-confirmation-proof-utc-skew-evidence) +
                      present record(historical-confirmation-transaction-receipt) +
                      present record(historical-confirmation-history-evidence) +
                      present record(historical-confirmation-generation-manifest-proof-mapping) +
                      present record(carrier-currentness)
NeedsDevelopmentOmission04(x) = true exactly for an actual TC05-admitted
                      PLATFORM suite-2 SYNTHETIC_DEVELOPMENT slot-open context
                      with its exact environment-bound omission graph and no
                      confirmed-current recovery; false for every admitted
                      non-applicable context
ResolveDevelopmentOmission04(x) =
                      record(development-recovery-omission) +
                      record(omission-environment) +
                      record(omission-ceremony-authority) +
                      record(omission-ceremony-authentication-evidence) +
                      record(omission-authority-trusted-time-input) +
                      record(omission-authority-utc-skew-evidence) +
                      record(omission-ceremony-consumption-proof) +
                      record(omission-proof-trusted-time-input) +
                      record(omission-proof-utc-skew-evidence) +
                      record(omission-transaction-receipt) +
                      record(omission-history-evidence) +
                      record(omission-generation-manifest-proof-mapping) +
                      record(omission-owner-readback) +
                      record(omission-owner-principal)
                                        if NeedsDevelopmentOmission04(x)
                      0                 otherwise
CurrentControl04(x) = TC03 Resolve(x)                         if ordinary TC02
                      record(current-ceremony-authority) +
                      record(current-ceremony-authentication-evidence) +
                      record(current-ceremony-authority-trusted-time-input) +
                      record(current-ceremony-authority-utc-skew-evidence) +
                      record(current-ceremony-environment-identity) +
                      record(current-ceremony-owner-readback)
                                                             if current ceremony
Input(PLATFORM) = length(platform-protected-value)
Input(PORTABLE) = 119 + 60
Input(RECOVERY suite 3) = 119 + 60
Input(RECOVERY suite 4) = 41 + 16 + 128 + 2147483648
pre04(x) = 2*length(s) + Meta(s) + length(c) + Meta(c) +
           Resolve04(x) + ResolveDevelopmentOmission04(x) +
           CurrentControl04(x) + Input(K) + 32 + 32 + 32 + 40
post04(x) = pre04(x) + 32
Pre04(K) = max(rule-valid fully linked x of K){pre04(x)}
Post04(K) = max(rule-valid fully linked x of K){post04(x)}
```

The two slot lengths are immutable input and exact canonical re-encoding. The
context is constructed once into an exact-size output and is the HKDF input.
Kind-specific `Resolve04` charges exactly one closed profile body and always
charges the historical slot-creation authority/evidence/consumption proof plus
its authority/proof trusted-time inputs and each input's required referenced
closed `UtcSkewEvidenceV1`, transaction receipt, history evidence,
and admitted generation-manifest mapping from exact proof digest plus
transaction ID to those receipt/history references. It also charges the
profile's resolved active `CUSTODY_SERVICE` principal, which is distinct from
the `OWNER_HUMAN`: the resolved `PrincipalV1` kind is exactly
`CUSTODY_SERVICE`, its principal ID differs from the owner's, and no role or
profile association may reclassify or satisfy that requirement. A portable/recovery
open additionally charges the historical confirmation authority and its
authentication evidence, consumption proof, both trusted-time inputs and each
input's required referenced closed `UtcSkewEvidenceV1`,
transaction receipt, history evidence, and admitted generation-manifest
mapping whenever confirmation exists;
ordinary eligible open
requires both, while preconfirmation creation states omit them.
For ordinary use, `CurrentControl04` charges the complete TC03 resolver and no
omission term. For every current ceremony it separately charges the live
authority, authentication evidence, authority trusted-time input, and required
closed `UtcSkewEvidenceV1`, plus the exact selected protected-current
`EnvironmentIdentityV1` and the authority's required full `OwnerReadbackV1`
body. Environment identity byte-equals the authority subject, authentication
evidence, proof, admitted request/generation, and selected slot-open context;
the readback body byte-equals the authority's exact reference and authenticated
ceremony subject. A typed reference or selected fields alone never account for
either body. The four live authority/evidence/time/skew charges are never
deduplicated away against historical, omission, or other resolved records, even
when a canonical digest is identical; live-current validation and reservation
remain separate. Current-ceremony environment/readback may deduplicate against
an already charged record in the same phase only when the complete canonical
digest is identical; semantic, role, field, or cross-phase equality never
deduplicates them.

Because every ceremony branch reaches `CurrentControl04`, these charges flow
through `pre04`/`post04`, nested source and staged opens, `createEmit04`, and
`confirmEmit04` without a second formula. Each concrete phase charges its
complete current-ceremony context once; nesting neither drops the controls nor
copies a source-phase charge into a distinct destination/emit phase.

Across historical authority and proof
paths, each distinct trusted-time input is charged once and may be deduplicated
only when its canonical digest is identical; role or semantic equality is not
enough. Each such input resolves its exact skew-evidence reference; every
distinct `UtcSkewEvidenceV1` is charged once and deduplicates only when its
canonical digest is identical. A matching time value, authority, or proof does
not permit deduplication. Each manifest mapping is resolved by the admitted generation, never by
a caller path or proof-supplied reference. The shared lineage record is
resolved once by digest and is not duplicated between those authority paths.

`NeedsDevelopmentOmission04(x)` classifies a complete, actual slot-open context,
never an outer operation, destination, or emit object. It is true exactly when
`x` is one TC05-admitted `PLATFORM` suite-2 slot in the exact protected
`SYNTHETIC_DEVELOPMENT` environment/store, the environment-bound omission graph
is complete and current, and no confirmed-current recovery exists for that
same environment/store. If those base predicates require omission but the graph
is missing, malformed, ambiguous, stale, or mismatched, `x` is invalid rather
than a false branch.

The predicate is false for destination/emit state, `INITIALIZE_ROOT`, an exact
generation-1 staged-lineage bootstrap source, production or controlled
nonproduction, suite 1, portable or recovery slots, any state with
confirmed-current recovery, and any unrelated environment or store. A generic
staged portable/recovery confirmation target therefore has zero omission charge.
No caller, outer ceremony kind, or inherited source flag can change the result.

When true, `ResolveDevelopmentOmission04` resolves and charges the omission's
exact environment plus referenced authority, authentication evidence, proof,
authority and proof time/skew pairs, receipt/history/manifest mapping, owner,
and full-warning `OwnerReadbackV1` body. The omission body time aliases proof
time and adds no charge. All values byte-equal the omission, authority, proof,
current slot/profile/environment/epochs/tuple, and admitted TC05 transaction.
Each distinct canonical record is charged once; deduplication is allowed only
for an identical canonical digest, including an environment, owner, time/skew,
or readback record already charged in the same slot-open context.
Principal/readback semantics or equal selected fields never permit a deduction.

`pre04(x)` adds the conditional resolver exactly once, so every actual
`post04(x)` inherits it. Ordinary applicable platform open is charged once.
`sourceOpen04` and `confirmSource04` preserve the source slot's complete context
and therefore charge a qualifying source once; a source-dominant peak retains
that amount. `createEmit04` and `confirmEmit04` are destination/emit phases and
do not add it. `confirmStaged04` uses the staged target's own complete context,
which is zero for generic portable/recovery targets. The nested formulas remain
unchanged and never copy the omission term from source to destination or charge
it twice. Current ceremony authority/evidence/time/skew charges remain separate
and are never deduplicated against omission records. Every failed reservation
denies before provider work.
`Input(K)` charges the additional OS-provider copy or the complete presentation
plus decoded random carrier while both may be live. Suite 4 instead charges its
exact 41-byte public label, live 16-byte decoded artifact ID, maximum
128-byte raw owner input, and exact 2,147,483,648-byte Argon2 memory parameter;
provider metadata/alignment beyond that is a stricter TC10 charge. The four fixed charges are the
guarded 32-byte crossing, 32-byte provider import, 32-byte derived wrapping
value, and 40-byte KWP input copy. Post adds the provider's 32-byte root output.
If the exact OS/FIPS/UI provider uses alignment, copies, handles, or workspace
beyond these charges, TC10 records and reserves its larger proven amount before
admission. Hidden growth, secondary parse trees, growable buffers, and
unaccounted provider copies are forbidden.

For a concrete creation state with new canonical slot `s`, context `c`, and
precommitted carrier binding where applicable, `source(x)` is the exact current
slot used to obtain the source root, while `bootstrap-staged-source(x)` is the
one admitted generation-1 initial slot named by the lineage. Both are mutually
exclusive, and no source exists only for `INITIALIZE_ROOT`:

```text
sourceOpen04(x) = 0                                     if INITIALIZE_ROOT
                  post04(bootstrap-staged-source(x))     if generation-1 setup
                  post04(source(x))                     otherwise
sourceRetained04(x) = 0                                  if INITIALIZE_ROOT
                      32                                 otherwise
createEmit04(x) = sourceRetained04(x) +
                  length(s) + Meta(s) + length(c) + Meta(c) +
                  Resolve04(x) + CurrentControl04(x) +
                  Input(K) + 32 + 32 + 32 + 40 + 32
create04(x) = max(sourceOpen04(x), createEmit04(x))
Create04(K) = max(rule-valid creation x of K){create04(x)}
confirmSource04(x) = post04(bootstrap-staged-source(x)) if generation-1 setup
                     post04(current-source(x))           otherwise
confirmStaged04(x) = 32 + post04(staged-slot(x)) + 32
confirmEmit04(x) = 32 + 32 + 32 + Resolve04(x) + CurrentControl04(x) +
                   length(carrier-confirmation) + Meta(carrier-confirmation) +
                   length(carrier-currentness) + Meta(carrier-currentness)
confirm04(x) = max(confirmSource04(x), confirmStaged04(x), confirmEmit04(x))
Confirm04(K) = max(rule-valid confirmation x of K){confirm04(x)}
```

Creation first completes the exact qualified source-slot `Post04` phase unless
it is initialization. The generation-1 setup branch charges `Post04` for
the one exact TC05-admitted staged initial slot named by the shared lineage.
It then retains that 32-byte provider root handle
while constructing the destination. The emit phase charges one canonical slot
output, metadata, one context, resolved state, provider/platform or carrier
input, crossing/import/derived/KWP charges, and destination root handle.

Confirmation first completes `Post04` for the independent current source root,
or for that exact staged lineage source in the generation-1 setup branch.
It retains that 32-byte handle throughout staged-slot `Post04`; the trailing 32
bytes in `confirmStaged04` are the provider-internal equality-challenge
workspace while both root handles are live. The emit phase conservatively
retains current root, staged root, and challenge workspace while constructing
canonical confirmation/currentness outputs and their resolved state. No phase
may overlap less state than its formula, and a provider with larger handle or
challenge workspace supplies the stricter TC10 charge. TC10 generates
the achievable maximizing linked state rather than summing incompatible
branches. Any unresolved later-owned ceremony-authentication,
platform-evidence, FIPS-provider, crossing, rollback, TC05 wrapper/transaction
receipt/history evidence, or UI
schema has no permitted serialized body
and prevents qualification until its owner adds a closed `Record(T)` term and
boundary vectors. Missing or noncurrent selected custody/portable/recovery
profile bodies, or a profile whose complete relation-matrix row does not hold,
also blocks before allocation; a typed profile reference alone is never a body.

For suite 4, `createEmit04` carries the complete 41-byte label + 16-byte
decoded artifact ID + 128-byte maximum input + 2,147,483,648-byte Argon
`Input(K)` peak. Confirmation carries the same peak through the staged slot's
`post04` inside `confirmStaged04`, after exact slot resolution and before its
root challenge; it is not replaced by the smaller emit phase. TC09 recovery
must reserve and prove an equivalent-or-stricter label/decoded-ID/input/Argon peak
before accepting input or calling the provider.

For every production `T`, generate valid `MAX/T`, exact truncation at
`Max(T)-1`, trailing-byte `Max(T)+1`, every variable-leaf/cardinality
limit-minus-one/limit/limit-plus-one, and linked `PEAK04/K`, `CREATE04/K`, and
`CONFIRM04/K` fixtures. Instrumented allocation must equal generated charges;
one-byte-over reservation fails before OS/provider work with no secondary
allocation.

## 11. Mandatory TC10 qualification and synthetic checks

All tests use synthetic values and disposable stores/targets. None is
implemented or passing in TC04.

| Test | Required proof |
| --- | --- |
| TC04-ST01 schema closure | Positive/negative canonical vectors cover every TC04 CDDL production and relational rule; unknown/missing/duplicate/mistyped fields, refs, enums, or status reject before OS access. |
| TC04-ST02 platform matrix | Every Windows/macOS/Linux dev/prod profile opens only its exact allowed class; all cross-profile/class cases reject. |
| TC04-ST03 separate service | Same-user/model process cannot invoke custody, impersonate broker, replay IPC, substitute identity, or observe slot facts. |
| TC04-ST04 slot admission | Caller bytes/path/name cannot select or quarantine; only exact TC05-admitted identity reaches the OS. |
| TC04-ST05 substitution | Provider/key/policy/protected-value/profile/boot/service/code substitution rejects before or uniformly at release. |
| TC04-ST06 crossing census | Instrument all buffers/callbacks/imports/faults; slot key has only bounded crossing and never reaches forbidden channels. |
| TC04-ST07 root non-export | Root handle cannot export/serialize/transfer; wrong decision/attempt/process/provider/profile rejects. |
| TC04-ST08 complete slot KAT | Canonical salt/info/HKDF/KWP vectors match all platform/portable/recovery rows. Suite 4 additionally has exact ASCII-input, 16-byte salt, Argon2id-v19 fixed-parameter/output, HKDF, and KWP intermediates. Mutate suite/kind, both IDs, store/store/root/wrapping generation, common including creation-proof ref, closed profile body/ref, epochs, tuple, ceremony, scheme/protected-value/policy, carrier binding, recovery-source tag/version/parameter/salt, or Argon2→HKDF ordering; each rejects or derives different material and fails before root handle/challenge. Generation-1 platform publishes lineage/evidence/authority/proof/slot/receipt-history/manifest all-or-none; portable adds binding. |
| TC04-ST09 kind separation | Platform, portable, and recovery values/records/wraps cannot cross-open, relabel, copy, or share IDs/values. |
| TC04-ST10 FIPS gate | Wrong/stale certificate, policy, binary, build, OE, config, mode, entropy, self-test, or crossing blocks early. |
| TC04-ST11 Windows dev | User/profile/entropy/value/lock/session substitution and machine scope or software fallback reject. |
| TC04-ST12 Windows prod | TPM/KSP/key/export/service/boot/device mismatch, TPM clear, and software/DPAPI fallback reject without oracle. |
| TC04-ST13 macOS dev | Sync/access-group/query/code/user/lock substitution rejects; no CLI/pasteboard path exists. |
| TC04-ST14 macOS prod | Enclave/ACL/signing/passcode/biometric/restore/update drift suspends; software fallback rejects. |
| TC04-ST15 Linux dev | Alternate service/session/collection/D-Bus peer/headless state rejects and never becomes production. |
| TC04-ST16 Linux prod | TPM/firmware/PCR/policy/distro/kernel/manager/LSM/service mismatch and null/software fallback reject. |
| TC04-ST17 planned successor | Only exact prequalified successor activates; wildcards, broad signer, copied value/wrap, and retire-before-proof reject. |
| TC04-ST18 loss/reset | Lock/reset/key loss/TPM clear/unplanned boot change yields unavailable/recovery-required without same-ID recreation. |
| TC04-ST19 carrier encoding | Exact 60-byte/96-character/119-byte production presentation corpus passes; case, glyph, separator, check, kind, ID, truncation, extension, and Unicode mutations reject. Suite 4 accepts only the exact 41-byte `ECR-S4/1-` plus 32-uppercase-hex-artifact-ID label and independently entered 16..128 bytes all in ASCII `0x21..0x7e`; 40/42-byte labels, lowercase/nonhex IDs, alternate prefix/separator/encoding, 15/129-byte input, whitespace/control/Unicode, transform, normalization, and label-to-binding-ID mismatch reject before derivation/provider work. The label cannot select or enumerate a slot. |
| TC04-ST20 carrier absence | Production carrier/value/check/derivative never occurs in filesystem, swap, history, clipboard, capture, spool, telemetry, logs, audit, Git/Jira, prompt, or tool result. Suite 4 likewise never persists or exposes combined artifact, owner input, check, secret digest/MAC, Argon/HKDF output, hint, or location; scan every success/failure/crash surface while permitting only the separately bound nonsecret artifact ID and protected authenticated salt/source. |
| TC04-ST21 independent values | Instrumented fixtures prove separate qualified DRBG calls and domains for slot key, PCAK, RAK, suite-4 artifact ID, suite-4 salt, and every other ID; deliberate copy/reuse by control flow and duplicate IDs reject. Suite-4 owner input provenance is exactly `OWNER_SELECTED_ASCII`; any KStack/model/service generation, suggestion, transform, or strength-score path rejects. Secret values are never persisted/indexed for comparison; salt persists only inside its authenticated protected slot and is never copied to a global comparison index. Synthetic equal-byte injections return no stable equality result, timing class, log, or caller-visible oracle. Statistical DRBG qualification tests generated-value independence without claiming collision detection. |
| TC04-ST22 confirmation | Only the same authenticated owner in a separate post-clear attempt confirms. Suite 4 resolves exactly one staged slot before input, destroys creation state, performs fresh authentication/reservation, and independently re-enters exact label plus input with no prefill; cached/display reuse, label-selected/enumerated/switched slot, swapped label/input/salt/context/binding, delegated/recovery-operator substitution, wrong artifact, timeout, or crash cannot confirm. Success requires KWP plus provider-internal root challenge. Binding-only slots remain staged and confirmation cannot alter KDF bytes. |
| TC04-ST23 mismatch | One wrong authenticated artifact consumes ceremony, returns the uniform failure class, clears transient state, and never retries, falls back, enumerates, or mutates/quarantines live generation. Suite-4 wrong label/input/salt/context, KWP failure, or root-challenge failure burns the attempt identically; a retry requires fresh authentication and reservation. |
| TC04-ST24 activation inputs | Missing current platform-or-authorized-portable slot or distinct confirmed recovery slot blocks all production. |
| TC04-ST25 downgrade | Mutate every owner/scope/profile/risk/time/epoch/audit field and combine every failed predicate; none is waived. Service/unattended portable use denies even with an otherwise valid downgrade. |
| TC04-ST26 dev omission | Only exact `SYNTHETIC_DEVELOPMENT` suite-2 current qualified platform slot with absent recovery may use one admitted `ACKNOWLEDGE_DEVELOPMENT_RECOVERY_OMISSION` authority/proof transaction. Verify exact owner, full warning/readback, slot/profile/environment/store generations, attempt, epochs/tuple, authority/evidence/proof, receipt/history/manifest mapping, and omission-time-to-proof-time alias. Create two environments with the same store/profile/tuple and substitute the second environment independently into omission, authority subject, authentication evidence, proof, or protected-current selection; every link mismatch denies before custody/provider work. Forged, self-issued, replayed, unauthenticated, principal/readback-only, partial, duplicate, stale, or mismatched acknowledgement likewise denies pre-provider. Production, controlled nonproduction, portable/recovery slots, another suite, old generation, or existing recovery cannot inherit it. |
| TC04-ST27 replay | Concurrent hosts, duplicate IPC, stale worker, PID reuse, restart, fork, suspend/resume, snapshot cannot reuse handles. |
| TC04-ST28 cleanup faults | Fault after each reserve, suite-4 ID/salt generation, binding precommit, one-time label display, label/input read and fixed 16-byte ID decode, Argon allocation/derive, HKDF/KWP, root challenge, atomic stage/confirm, clear, release, and destroy step burns the attempt, clears label/decoded-ID/input/Argon/HKDF/provider/transient state, exposes no partial object, and never retries or selects another slot. Crash cuts before/after every TC05 boundary publish the complete admitted set or none. |
| TC04-ST29 oracle collapse | Unsupported platform, missing or unauthorized pre-resolved slot, wrong production carrier, denied presence, and suite-4 malformed/mismatched label/input/salt/context, allocation, Argon, KWP, challenge, or provider failure share the fixed safe result/timing class. Repeated synthetic inputs yield no stable secret-derived equality, syntax-stage, label-existence, slot-enumeration, log, or timing oracle. |
| TC04-ST30 expiry | Current profile/certificate/build/policy/epoch expiry or dequalification blocks new open and fences handles. Exact regression: setup/confirmation authority valid/current and consumed once under immutable subject/evidence/proof plus matching receipt/history may later expire without invalidating an otherwise current slot. Forged proof, missing proof ref, proof/receipt/history transaction-ID or digest mismatch, authority/evidence stale or expired at recorded consumption, replaced snapshot, duplicate consumption, or presently stale profile/tuple/epochs/slot/currentness/live authority rejects. |
| TC04-ST31 ceremony bootstrap | Initial setup accepts only externally rooted current-human evidence whose canonical subject equals one authority; forged/self-issued/store-issued/session-replayed/model/service evidence and ordinary decisions fail. Platform crash cuts publish lineage/evidence/authority/creation-proof/initial-slot/receipt-history-commitment/generation-1-manifest all-or-none. Portable cuts publish that set plus exact precommitted `CarrierBindingV1`, never separately visible/current. Proof and receipt/history share a non-digest transaction ID; receipt/history bind proof/effect digests without a reverse proof→receipt digest. ADD/CONFIRM use distinct subjects but reopen only the exact staged lineage source; mutation, another source, inferred currentness, or ordinary use fails. |
| TC04-ST32 ceremony relations | Generate every allowed matrix row and reject every other kind/profile/suite/scheme/operator-presence product. Mutate owner/operator identity/roles, environment in authority subject/evidence/proof/current selection, root-common or confirmation proof ref, `CarrierConfirmationV1` time ref versus its exact confirmation-proof time ref, proof transaction ID, receipt/history proof/effect digest or transaction equality, operation, store/generations/slot/profile, attempt/readback/time/epochs/tuple/status, or common/slot equality; every invalid combination rejects before carrier input or custody/provider work and cannot be consumed twice. Explicitly substitute two environments sharing store/profile/tuple so membership or field equivalence cannot mask typed-reference inequality. Lost-slot replacement accepts only platform/authorized-portable target with distinct recovery operator and TC09 fresh generation. |
| TC04-ST33 store-generation transplant | Copy an otherwise exact slot/wrapped root across store generation or alter only its common/context generation; KWP fails before root handle. |
| TC04-ST34 generated accounting | Generated profile/source/slot/context/consumption-proof `Max`, kind-specific `Record/Resolve04`, and `Pre04/Post04/Create04/Confirm04` equal instrumented phases. Every path charges the profile's active `CUSTODY_SERVICE`; every distinct authority/proof `TrustedTimeInputV1` and its required referenced closed `UtcSkewEvidenceV1` are charged, with each class deduplicating only by identical canonical digest; `CarrierConfirmationV1`'s byte-equal proof-time alias adds no distinct time/skew resolver charge; and each proof charges the admitted-generation manifest mapping from proof plus transaction ID to its receipt/history references. Instrument every current-ceremony matrix kind through each applicable `pre04`/`post04`, source, staged, create, and confirm phase with authority/evidence/time/skew plus protected-current environment identity and full owner readback. Authority/evidence/time/skew never deduplicate; environment/readback deduplicate only by identical canonical digest already charged in that same phase. Include omission-present and omission-zero contexts, same-store cross-environment identity mismatch, exact-budget witnesses, and one-byte-over environment/readback witnesses; every failure denies before custody/provider work. For `NeedsDevelopmentOmission04`, instrument an ordinary applicable platform open with one charge; Create with applicable source and a source-dominant peak; Confirm with applicable current source and a source-dominant peak; `INITIALIZE_ROOT` and generation-1 staged-lineage bootstrap with zero; recovery-present with zero; production/controlled/suite1/portable/recovery/generic staged target with zero; and same-store/profile/tuple cross-environment drift with denial. Each applicable resolver includes omission environment, authority/evidence/proof, two time/skew pairs, receipt/history/mapping, full warning readback, and owner exactly once; identical canonical digests deduplicate only within that slot-open context, never into current ceremony state. Destination/emit remains zero and nested source/staged phases never double-charge. Portable/recovery ordinary open includes distinct historical creation and confirmation authorities/evidence/proofs/transaction receipts/history evidence plus TC03 control. Suite 4 charges exactly 41-byte label + 16-byte decoded artifact ID + maximum 128-byte input + 2,147,483,648-byte Argon2 memory plus provider overhead; its salt is a bounded view into the already charged decoded slot source, with any provider copy charged by TC10. Creation carries the peak in `createEmit04`, confirmation in staged-slot `post04`, and TC09 proves an equivalent-or-stricter later peak. Creation includes only an admitted current platform, authorized-current portable, or exact generation-1 staged-lineage source and retained root; confirmation preserves that same branch. Every `Pre04`/`Post04`/`Create04`/`Confirm04` MAX/PEAK is achievable; exact-budget succeeds and one-byte-over omission/environment/readback on ordinary/Create-source/Confirm-source/current-ceremony phases, suite-4 label/decoded-ID/input/Argon, or other record denies before any provider call. |
| TC04-ST35 target/provider separation | Substitute platform `provider-ref-v1` for the linked ordinary action's composite `provider-tenant-target-ref-v1`, or split/recombine that composite; exact TC02 decision resolution denies before custody. |
| TC04-ST36 qualification epochs | Non-id128 scope IDs, custom epoch kind/scope, profile/tuple scalar mismatch, missing tuple qualification member, and any stale profile member reject. Custody/portable/recovery body ID must equal only its exact `CUSTODY_PROFILE`/`PORTABLE_PROFILE`/`RECOVERY_PROFILE` typed reference's fourth 16-byte payload member; comparison to the complete array, cross-tag/domain substitution, or another payload rejects. |
| TC04-ST37 unresolved records | For each creation-authority, creation-proof, confirmation-authority, confirmation-proof, and current-ceremony path independently, inject (a) malformed `TrustedTimeInputV1`, (b) reference-mismatched `TrustedTimeInputV1`, and referenced `UtcSkewEvidenceV1` that is (c) stale, (d) wrong-source, (e) same-source where independent sources are required, (f) candidate-field mismatched, or (g) wrong-boot-bound; every case denies before any custody/provider call. For every current-ceremony kind and applicable `pre04`/`post04`, source, staged, create, and confirm phase, remove or malform the protected-current `EnvironmentIdentityV1` or full `OwnerReadbackV1`, mismatch either against authority subject/evidence/proof/request/slot context, or substitute a second environment with the same store/profile/tuple; each denies pre-provider. Exercise omission-present and omission-zero cases, reject semantic-only/cross-phase environment/readback dedup, accept only same-phase identical-canonical-digest dedup, and prove authority/evidence/time/skew remain fully charged. Separately make `CarrierConfirmationV1`'s time ref missing, additional, or unequal to its confirmation-proof time ref, or make its skew path differ from the proof time's exact referenced skew evidence; each denies pre-provider and never creates another resolver input. On each applicable ordinary open, Create source open, and Confirm source open, independently remove, malform, forge, self-issue, replay, or mismatch the omission, environment, authority, authentication evidence, proof, authority/proof time or skew evidence, receipt/history/manifest mapping, owner, full warning `OwnerReadbackV1` body or shared reference, attempt, slot/profile/store/generations/epochs/tuple, transaction/effect digest, or direct proof-time alias; every case denies before custody/provider work. Test forbidden semantic-only dedup, exact canonical-digest dedup within one slot-open context, no double charge, and no deduction of current-ceremony authority/evidence/time/skew. For `INITIALIZE_ROOT`, generation-1 staged-lineage bootstrap source, recovery-present state, production/controlled/suite1/portable/recovery, generic staged target, unrelated environment/store, and destination/emit, prove the omission term remains zero without resolving or charging an omission; outer-operation/source-flag drift cannot change the branch. Missing/malformed/noncurrent selected profile body or active profile principal whose `PrincipalV1` kind is exactly `CUSTODY_SERVICE` and ID is distinct from `OWNER_HUMAN`; role/profile reclassification of either identity; invalid dev/prod row; missing exact root-common/confirmation proof ref; missing historical creation/confirmation authority, evidence, proof, any distinct authority/proof time input or required skew evidence; nonidentical time or skew-evidence digest incorrectly deduplicated; missing receipt, history evidence, or admitted-generation manifest proof/transaction mapping; transaction mismatch; or missing closed ceremony-authentication/platform-evidence/FIPS/crossing/rollback/UI/environment-identity/owner-readback/TC05-wrapper/manifest/receipt/history `Record(T)` or provider/Argon workspace proof keeps the profile unqualified and performs no custody call. Digest-only dedup remains mandatory. Exact-budget resolution succeeds; a one-byte-over time/skew, omission/environment/readback, current-ceremony environment/readback, or other applicable resolver record fails before provider work. A typed reference alone never passes. |
| TC04-ST38 binding non-circularity | Create binding before wrap, prove its digest is in KDF, then confirm and atomically link currentness afterward; confirmation-before-test, self-reference, binding replacement, duplicate confirmation/currentness, or partial activation rejects. Suite 4 independently generates artifact ID and salt, precommits binding and exact public label before owner input, binds provenance/salt/binding in the KDF without input-derived digest/MAC/check, and derives confirmation only after KWP plus root challenge. Mutating generation order, deriving ID/salt/label from input, inserting confirmation into KDF, partial stage, label-selected slot, or reusing creation state rejects. |

Real qualification covers target hardware/OS success and adverse families,
update/reseal, lock/unlock, account/service reset, TPM clear, keychain reset,
backup/restore, device loss, hibernation/swap, debugger/dump, exhaustion, and
crash injection. Mocks and seam tests are insufficient.

## 12. Later-TC ownership and nonclaims

| Later item | Preserved ownership |
| --- | --- |
| TC05 | Protected slot/evidence wrapper and storage, generations, atomic bootstrap/currentness commit, attempt burn, concurrency/durability, rollback/fork anchor, quarantine, and backup format. |
| TC06 | Slot/root lifecycle authority, rotation/revocation, overlap/retirement, leases, approval redemption, recovery reservation, and erasure authorization. |
| TC07 | Host transport, authenticated IPC, broker service attestation, isolated worker lifecycle, provider-handle transport, target/output containment, and receipts. |
| TC08 | Safe audit, downgrade/recovery event privacy, incident/quarantine workflow, redaction, timing, and reconciliation. |
| TC09 | Recovery authorization/activation, fresh reconstruction, backup/restore, rate limits, migration/export/sync, carrier replacement, drills, and destruction evidence. |
| TC10 | Ceremony-authentication evidence body/trust root, dependencies, versions/licenses, FIPS certificates/policies, builds/configs, SBOM/provenance, KATs, hardware matrix, deployment, requalification, and activation. |

TC04 does not claim DPAPI, CNG, TPM, Keychain, Secure Enclave, Secret Service,
Linux service isolation, guarded memory, overwrite, or a FIPS-labelled provider
currently meets this contract. It does not claim perfect zeroization, same-user
secrecy without a qualified broker boundary, administrator/kernel/debugger
resistance, physical deletion, availability after all custody is lost, or safe
display/printing on an unqualified device.

This candidate authorizes no implementation, dependency installation, platform
API execution, authentication, credential/key access, real-material generation,
recovery attempt, reviewer dispatch, staging, commit, push, deployment,
publication, or activation. Its only next step is digest-bound internal and
separately authorized Codex design review.

## 13. Internal design audit

- **Internal confidence:** `98/100` after Codex R3 repair and self-audit.
- **Read-only audit repairs:** `6/6` closed: provider-qualification wording;
  Q4 owner-role alignment; authenticated empty-store bootstrap plus full
  ceremony matrix; source/staged/challenge phase accounting; acyclic
  generation-1 bootstrap lineage; and exact tests.
- **Codex R1 repairs:** `5/5` applied: closed portable/recovery profiles and
  kind resolver; suite-4 Argon2 chain; portable bootstrap binding atomicity;
  historical confirmation authority accounting; and achievable ST08/ST21/
  ST34/ST37 rules without a secret-equality oracle.
- **Codex R2 repairs:** `2/2` applied: typed profile reference payload equality;
  and historical authority/evidence validity-at-consumption with immutable
  proof, without present-expiry coupling.
- **Codex R3 repairs:** `3/3` applied: exact production recovery source branches;
  custody typed-reference payload equality; and complete service-principal,
  trusted-time, and admitted-manifest resolver/accounting terms.
- **Failed checks open:** `0` known after R3 repair against locked
  TC01/TC02/TC03; a new digest-bound Codex review remains required.
- **Security findings open:** `0` known; external review remains mandatory.
- **Material dissent:** `0` known.
- **Unresolved owner questions:** `0`. Q3, Q4, Q5, Q7, Q10 and the TC03 FIPS decision already lock the relevant forks.
- **Qualification gaps:** exact API/provider versions, FIPS certificates,
  binaries/configurations, hardware/firmware, and real-platform evidence remain
  TC10 unavailable predicates, not implied passes or owner questions.
