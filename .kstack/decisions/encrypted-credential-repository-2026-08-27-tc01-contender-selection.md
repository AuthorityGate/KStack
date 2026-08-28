# Encrypted Credential Repository: ECR-TC01 contender selection

| Field | Value |
| --- | --- |
| Thread | Encrypted Credential Repository (ECR) |
| Item | ECR-TC01, reuse-first contender inventory and selection |
| Status | **REVIEW-REQUIRED** |
| Implementation | **NOT IMPLEMENTED** |
| Research cutoff | 2026-08-27 |
| Governing artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Frozen governing SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |

## 1. Authority and provisional boundary

This artifact records research and a provisional selection only. It does not
authorize credentials, installation, contender execution, implementation,
review dispatch, staging, commit, push, deployment, publication, or production
use. The governing artifact remains owner-locked and is not modified here.

ECR-TC01 cannot claim that any component or composition is qualified. Every
shortlisted component and the composition as a whole remain subject to
ECR-TC02 through ECR-TC10, owner review, and explicit implementation authority.
Any earlier reference that assigned the reuse-first comparison to ECR-TC03 is
superseded by this artifact: contender selection is ECR-TC01; ECR-TC03 remains
algorithm and parameter selection.

The provisional result is **COMPOSE**. No researched product satisfies the
whole ECR objective. A future composition may reuse platform or managed key
custody, an issuing store, typed action brokers, and audited cryptographic
libraries while KStack supplies the missing identity, policy, approval, lease,
action-fence, isolated-execution, safe-receipt, audit-binding, rollback,
recovery, and migration controls. That conclusion follows the role-level
comparison below; Adopt, Adapt, Compose, and Build were treated neutrally until
that comparison was complete.

## 2. Corrected security vocabulary

| Term | Exact meaning for later qualification |
| --- | --- |
| Root-key non-export | The hardware or platform root key is not exportable. This does not prove that a stored entry's plaintext is never released. |
| Entry plaintext release | A store, SDK, CLI, agent, or decrypt API returns a credential value to a caller, process, file, environment, argument, template, or stream. |
| Broker-only action | A broker performs a narrowly typed target action without returning the credential to the requesting model or general caller. |
| Model non-export | Credential material is absent from model-visible prompts, tool results, logs, errors, receipts, and target output. This is stronger than root-key non-export. |

The same-user attacker claim is deliberately narrow. OS keychains and process
permissions can raise the cost of access, but a hostile process running as the
same OS identity may be able to invoke the same APIs, inspect process state, or
alter local execution. Strong isolation from such an attacker requires a
separate broker identity or equivalent security boundary plus authenticated,
authorized requests. TC01 makes no broader same-user resistance claim.

The baseline profile is local/offline: ordinary authorized operations must not
require a remote control plane. Managed cloud KMS, HSM, secret stores, and
remote brokers are optional profiles only. They must fail closed during remote
outage and must not silently replace or weaken the local/offline profile.

## 3. Selection method and evidence rules

The four outcomes were evaluated without a preferred answer:

- **Adopt:** use a contender substantially as supplied.
- **Adapt:** wrap or narrowly extend a contender without changing its security
  model.
- **Compose:** join separately qualified components behind KStack-owned policy
  and action boundaries.
- **Build:** implement a missing role only when reuse cannot satisfy a hard
  gate; do not invent cryptography or replace a qualified native store merely
  for uniformity.

Claims are limited to official product documentation, official repositories,
official releases, and official license texts available by the research
cutoff. A versionless managed service is pinned to its named API version where
available and otherwise to the documentation date. An unresolved version,
license, platform, or deployment fact is a qualification gap, not an implied
pass.

## 4. Hard, non-compensating gates

Failure of one gate cannot be offset by strength elsewhere.

| Gate | Requirement |
| --- | --- |
| ECR-HG01 | No credential or equivalent replay material enters model-visible context, output, receipt, trace, or error. |
| ECR-HG02 | No credential transport through command arguments, environment variables, shared or persistent temporary files, standard output/error, generic shell text, or generic HTTP bodies. |
| ECR-HG03 | Requests are narrowly typed actions with target, scope, policy, and output constraints; generic decrypt/read/exec is not an action broker. |
| ECR-HG04 | Evidence distinguishes custody, entry storage, plaintext release, action execution, and recovery. A pass in one layer cannot certify another. |
| ECR-HG05 | Caller, repository, broker, target, and approver identities are authenticated and bound to the authorization decision. |
| ECR-HG06 | Authority is scoped, short-lived, one-use where feasible, race-safe, revocable, and non-replayable. |
| ECR-HG07 | Same-user resistance is claimed only when a separate broker identity or equivalent enforced boundary is demonstrated. |
| ECR-HG08 | Audit records bind the approved action to execution and a safe receipt; audit failure causes denial without leaking the credential. |
| ECR-HG09 | Trusted time, freshness, rollback, repository-identity change, and downgrade behavior are defined and fail closed. |
| ECR-HG10 | Rotation, revocation, backup, recovery, stale-backup handling, and separation of recovery authority are defined and tested. |
| ECR-HG11 | Outage, unsupported platform, missing broker, and policy error do not fall back to reveal, shell, direct read, or weaker custody. |
| ECR-HG12 | Source, exact release or API pin, license, provenance, maintenance, and vulnerability response are closed before adoption. |
| ECR-HG13 | Windows, macOS, and Linux profiles state their actual security boundary; portability cannot reduce all profiles to the weakest one. |
| ECR-HG14 | Protected outbound migration and decommission migration preserve custody, approval, audit, rollback safety, and recoverability without plaintext staging. |

## 5. Role-level contender matrix

The rows below compare individual roles. A role-level pass is not a system-level
qualification.

### 5.1 Credential elimination and dynamic identity

| Contender | Pin and license | Local/offline | Non-export/action boundary | TC01 result |
| --- | --- | --- | --- | --- |
| AWS IAM Roles Anywhere | [Official service guide](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/introduction.html), versionless managed service docs retrieved 2026-08-27; AWS service terms | No; AWS control plane is required | Exchanges an authenticated X.509 workload identity for temporary AWS credentials. This bounded issuer role removes stored AWS access keys but still releases temporary credentials; it is not broker-only action. | **ADOPT where a qualified AWS target supports it**, then qualify issuance, scope, output, and audit |
| Microsoft Entra managed identities for Azure resources | [Official overview](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview), docs retrieved 2026-08-27; Microsoft Azure service terms | No; Entra/Azure control planes are required | Allows a supported Azure resource identity to request target tokens without an application-managed source credential. Tokens are still issued to the workload; cross-platform and action-fence claims do not follow. | **ADOPT for qualified Azure resource targets only** |
| Google Cloud Workload Identity Federation | [Official overview](https://cloud.google.com/iam/docs/workload-identity-federation), docs retrieved 2026-08-27; Google Cloud service terms | No; Google control plane is required | Exchanges a qualified external workload identity for short-lived Google Cloud access without a service-account key. It remains credential issuance, not broker-only action. | **ADOPT for qualified Google Cloud targets only** |
| Vault/OpenBao dynamic secret engines | OpenBao 2.6.1, MPL-2.0; Vault 2.0.4, BUSL-1.1 with per-version change terms | Self-hostable | Reduces credential lifetime but ordinarily issues plaintext credentials to a client | **ADAPT** as issuer; not proof of broker-only action |

Credential elimination outranks repository storage when the target can provide
least-privilege, short-lived identity with adequate audit and revocation. It is
not a universal ECR implementation.

### 5.2 Local platform custody

| Contender | Official source/version pin | License | Boundary and portability | TC01 result |
| --- | --- | --- | --- | --- |
| Windows Credential Manager / DPAPI | [Password handling](https://learn.microsoft.com/en-us/windows/win32/secbp/handling-passwords), [CryptProtectData example](https://learn.microsoft.com/en-us/windows/win32/seccrypto/example-c-program-using-cryptprotectdata), and [TPM fundamentals](https://learn.microsoft.com/en-us/windows/security/hardware-security/tpm/tpm-fundamentals); docs updated 2026-07-17; Windows 10/11 and Server 2016-2022 documentation scope | Windows platform terms | Local/offline and OS-bound. DPAPI can return plaintext to the authorized caller; same-user isolation is not established. CNG/TPM can protect a non-exportable root key. | **ADAPT** for Windows custody, behind a separate broker identity where HG07 is required |
| macOS Keychain / Secure Enclave | Apple Platform Security [Keychain data protection](https://support.apple.com/en-gb/guide/security/secb0694df1a/web) and [Secure Enclave](https://support.apple.com/en-gb/guide/security/sec59b0b31ff/web), published 2024-12-19 | Apple platform terms | Local/offline. Keychain controls and a non-exportable Secure Enclave key do not by themselves prevent entry plaintext release to an authorized process. | **ADAPT** for macOS custody; broker boundary still required |
| Linux Secret Service | [Secret Service API 0.2 DRAFT](https://specifications.freedesktop.org/secret-service/latest-single/), published 2026-04-08 | Specification; implementations vary | Desktop-session and implementation dependent; retrieves secret values. No uniform headless or hardware-root guarantee. | Conditional **ADAPT** for a developer profile only; not the production baseline |
| Linux TPM2 trusted keys / kernel key retention | Linux kernel [trusted and encrypted keys](https://www.kernel.org/doc/html/latest/security/keys/trusted-encrypted.html), `latest` docs retrieved 2026-08-27; exact distro/kernel pin unresolved | GPL-2.0 kernel interfaces; user-space license varies | Local/offline hardware-root custody is possible. Entry store, broker, recovery, and support remain composition work. | **ADAPT** after exact distro/kernel/toolchain qualification |
| systemd credentials | systemd 260.2 (`f1d0952`), [260.2-pinned credentials design](https://github.com/systemd/systemd/blob/v260.2/docs/CREDENTIALS.md), [official releases](https://github.com/systemd/systemd/releases) | LGPL-2.1-or-later | Useful Linux service-delivery substrate, but service processes receive plaintext; null-key and file/stdout modes are prohibited for ECR secrets. | **ADAPT** only inside an isolated broker; not a repository or non-export guarantee |

### 5.3 Optional managed hardware-root custody

| Contender | Official source/API pin | License/service terms | Offline and release semantics | TC01 result |
| --- | --- | --- | --- | --- |
| AWS KMS / CloudHSM-backed keys | [KMS data protection](https://docs.aws.amazon.com/kms/latest/developerguide/data-protection.html), [Decrypt API](https://docs.aws.amazon.com/kms/latest/APIReference/API_Decrypt.html), and [rotation](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html); versionless service docs retrieved 2026-08-27 | AWS service terms | Remote managed profile. KMS can keep a root key non-exportable, but `Decrypt` returns plaintext and requires network/service availability. | **ADAPT** for optional managed root custody; never direct model/client decrypt |
| Azure Managed HSM / Key Vault keys | [Managed HSM keys](https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/about-keys), [Decrypt REST API 2025-07-01](https://learn.microsoft.com/en-us/rest/api/keyvault/keys/decrypt/decrypt?view=rest-keyvault-keys-2025-07-01), and [rotation](https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/key-rotation) | Microsoft Azure service terms | Remote managed profile. Hardware-protected roots are available; the decrypt operation returns plaintext. | **ADAPT** for optional managed custody behind the broker |
| Google Cloud KMS | [Cloud KMS](https://docs.cloud.google.com/kms/docs/key-management-service), [REST API v1](https://docs.cloud.google.com/kms/docs/reference/rest), and [rotation](https://docs.cloud.google.com/kms/docs/key-rotation); docs updated 2026-08-04 | Google Cloud service terms | Remote managed profile. Root-key control and rotation do not establish broker-only entry use. | **ADAPT** for optional managed custody behind the broker |

Managed KMS/HSM profiles are not substitutes for the default local/offline
profile. Each needs explicit outage behavior, regional and account recovery,
service-identity binding, protected migration, and cost/availability review.

### 5.4 Entry stores and issuing vaults

| Contender | Source/version/license pin | Operation | Plaintext and integration boundary | TC01 result |
| --- | --- | --- | --- | --- |
| OpenBao | 2.6.1; [MPL-2.0 license](https://github.com/openbao/openbao/blob/main/LICENSE); [official packages](https://github.com/openbao/openbao/pkgs/container/openbao/versions?filters%5Bversion_type%5D=tagged); [Transit](https://openbao.org/docs/secrets/transit/), [auto-auth](https://openbao.org/docs/agent-and-proxy/autoauth/), and [audit](https://openbao.org/docs/audit/) | Self-hosted/local network; operationally substantial | KV/agent clients can receive plaintext; Transit can protect data but decrypt returns plaintext. Auto-auth token, sink, template, and proxy behavior needs containment. | Preferred **ADAPT** candidate for store/issuer, pending TC02-TC10 |
| HashiCorp Vault | [2.0.4 official release](https://github.com/hashicorp/vault/releases/tag/v2.0.4), available before the research cutoff; [license](https://github.com/hashicorp/vault/blob/main/LICENSE) is BUSL-1.1 with per-version change terms. The pin supersedes 2.0.3 because 2.0.4 is the later published security-fix release; this does not claim that it closes every vulnerability. | Self-hosted or managed | [Secret engines](https://developer.hashicorp.com/vault/docs/secrets) and [Transit](https://developer.hashicorp.com/vault/docs/secrets/transit) are mature, but direct clients receive data; [process supervisor](https://developer.hashicorp.com/vault/docs/agent-and-proxy/agent/process-supervisor) can expose secrets to child process state. | **ADAPT** when already operated and license-approved; not default over OpenBao |
| AWS Secrets Manager | [Official overview](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html), versionless service docs retrieved 2026-08-27; AWS service terms | Managed remote | Secret retrieval returns plaintext. Rotation and audit are useful, but offline baseline and broker-only action are absent. | Optional managed **ADAPT** store only |
| Azure Key Vault secrets | [Official overview](https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets), docs retrieved 2026-08-27; Azure service terms | Managed remote | Secret value is returned to an authorized caller. | Optional managed **ADAPT** store only |
| Google Secret Manager | [Official overview](https://docs.cloud.google.com/secret-manager/docs/overview), docs retrieved 2026-08-27; Google Cloud service terms | Managed remote | Secret access returns payload to an authorized caller. | Optional managed **ADAPT** store only |
| 1Password CLI / service | CLI 2.39.0 released 2026-08-14; [release history](https://releases.1password.com/developers/cli/); commercial [API/SDK terms](https://1password.com/legal/api-sdk-terms-of-service) | Managed account with local client | [`op read/run/inject`](https://www.1password.dev/cli/secrets-scripts) uses returned values, environment, or generated files. SSH bookmarks can reduce some password handling but are target-specific. | **Reject as direct ECR path**; reconsider only a qualified target-specific broker integration |
| Bitwarden Secrets Manager | `sdk-sm` 2.1.0, 2026-05-21; [Bitwarden SDK License Agreement](https://github.com/bitwarden/sdk-sm/blob/main/LICENSE); exact `bws` binary pin unresolved | Managed or self-hosted; [offline deployment](https://bitwarden.com/help/install-and-deploy-offline/) exists | [`bws run`](https://bitwarden.com/help/secrets-manager-cli/) injects environment values; [machine accounts](https://bitwarden.com/help/machine-accounts/) use access tokens. Non-OSI SDK terms need legal closure. | **Reject as direct ECR path**; unresolved binary pin/license approval and HG02 failure |
| KeePassXC | 2.7.12 released 2026-03-10; [official repository](https://github.com/keepassxreboot/keepassxc); GPL-2.0/GPL-3.0 plus third-party notices | Local/offline and portable | General password manager and database; authorized clients can read/copy values. No typed action broker or separate identity by default. | **Reject for production ECR**; possible human recovery reference only after qualification |

### 5.5 Action brokers

| Contender | Source/version/license pin | Action capability | Limitations and TC01 result |
| --- | --- | --- | --- |
| CyberArk Secretless Broker | 1.7.32 (`37fecd6`), 2026-02-04; [Apache-2.0 repository](https://github.com/cyberark/secretless-broker) and [releases](https://github.com/cyberark/secretless-broker/releases) | Protocol-specific connectors can keep credentials out of an application | **ADAPT** as a design/runtime contender. Researched assets cover Darwin/Linux, not a qualified Windows path; connector coverage, maintenance, logs, target output, and same-user boundary remain open. |
| HashiCorp Boundary credential injection | Boundary 1.0.1 client/installer family, 2026-08-19; [BUSL-1.1 license](https://github.com/hashicorp/boundary/blob/main/LICENSE); [credential management](https://developer.hashicorp.com/boundary/docs/concepts/credential-management), [injection](https://developer.hashicorp.com/boundary/docs/credentials/configure-credential-injection), and [release notes](https://github.com/hashicorp/web-unified-docs/blob/main/content/boundary/v1.0.x/content/docs/updates/release-notes.mdx) | Brokered SSH/RDP session patterns with credential injection | **ADAPT** only for qualified interactive/session targets. Not a general local action broker; deployment and license cost are material. |
| KStack typed broker over native/vendor APIs | No implementation in TC01 | Could expose only approved target actions and safe receipts while keeping entry plaintext inside a separate process identity | **BUILD only the missing composition layer**, reusing native APIs, protocol clients, and crypto after qualification. This is not authority to implement. |

### 5.6 Recovery envelopes

| Contender | Source/version/license pin | Recovery fit | TC01 result |
| --- | --- | --- | --- |
| Mozilla SOPS | 3.13.3 (`26e2f47`), 2026-07-23; [MPL-2.0 releases](https://github.com/getsops/sops/releases); [key management](https://getsops.io/docs/usage/key-management/) | Auditable encrypted documents and multiple key backends can support protected export/recovery | **ADAPT** for offline recovery envelopes only. [`exec-env`/`exec-file`](https://getsops.io/docs/usage/advanced/) and general decrypt paths are prohibited runtime paths. |
| age | 1.3.1 (`b8564ad`), 2025-12-28; [BSD-3-Clause repository](https://github.com/FiloSottile/age) and [releases](https://github.com/FiloSottile/age/releases) | Small, auditable envelope tool/library suitable for separated recovery keys | **ADAPT** under SOPS or a qualified recovery workflow. It supplies cryptography, not policy, approval, audit, or action fencing. |

## 6. Adopt, Adapt, Compose, or Build result

| Outcome | Result after role comparison |
| --- | --- |
| Adopt | Adopt a named, qualified workload-identity path such as AWS IAM Roles Anywhere, Microsoft Entra managed identities, or Google Cloud Workload Identity Federation when its target independently passes the gates. No whole-product ECR adoption qualifies at TC01. |
| Adapt | Adapt OS custody, a store/issuer, protocol broker patterns, and SOPS/age recovery only inside their stated roles and after later qualification. |
| Compose | **Provisional selection.** Compose separately qualified custody, store/issuer, broker, recovery, and KStack control roles. This selection is not itself qualification. |
| Build | Build only the KStack-specific composition gaps. Reuse audited crypto, native key stores, protocol clients, and mature vaults; do not build a new cipher, general vault, or hardware driver. |

### Recommended provisional shortlist

1. Eliminate long-lived credentials with a qualified named workload-identity
   contender from section 5.1, or use qualified dynamic short-lived credentials.
2. Use platform custody for the default local/offline profile: Windows
   CNG/DPAPI with TPM where qualified, macOS Keychain/Secure Enclave, and Linux
   TPM2/kernel custody with a separate hardened broker. Treat Secret Service as
   a conditional developer profile.
3. Compare OpenBao first as the self-hosted store/issuer; retain Vault only when
   an existing deployment and license review make it preferable. A store is
   never the model-facing interface.
4. Adapt CyberArk Secretless connector concepts for supported protocols and
   Boundary patterns for qualified SSH/RDP sessions. Supply a KStack typed
   broker only for gaps, under a separate identity and without generic read,
   decrypt, shell, or HTTP methods.
5. Use SOPS 3.13.3 plus age 1.3.1 as the leading protected recovery-envelope
   pattern, not as the runtime delivery mechanism.
6. Allow AWS, Azure, or Google managed KMS/HSM and secret-store profiles only by
   explicit configuration and qualification. They remain optional remote
   profiles and cannot silently replace the local/offline baseline.

## 7. Composition gaps for later test cases

TC01 identifies, but does not solve, the following gaps:

| Gap | Definition required before qualification | Locked owner boundary |
| --- | --- | --- |
| Trusted time | Approved time sources, monotonicity, skew bounds, suspend/resume behavior, rollback detection, and fail-closed lease evaluation | TC02 threats/authority-policy schemas; TC05 rollback detection; TC06 scoped leases; TC10 tests/qualification |
| Repository identity | Canonical repository/worktree identity, rename/move/clone/fork rules, origin and commit binding, dirty-state behavior, and anti-substitution proof | TC02 repository/environment identity; TC05 rollback/fork detection; TC10 tests/qualification |
| Recovery state | Backup generation, freshness, quorum/separation, stale-backup rejection, lost-root procedure, rotation ordering, and recovery audit | TC04 portable recovery ceremony; TC05 backup format/generations; TC06 rotation/revocation; TC09 backup/restore and recovery drills; TC10 tests/qualification |
| Audit/action binding | Stable action identifier joining request, approval, lease, broker invocation, target outcome, redaction, safe receipt, and audit commit; audit failure must deny | TC06 requests/leases/approvals; TC07 adapters, isolated injection, and target/output containment; TC08 safe audit/redaction; TC10 tests/qualification |
| Downgrade | A versioned capability/profile lattice and explicit rejection of reveal, direct-read, shell, weaker custody, unsupported platform, stale policy, and managed-to-local silent fallback | TC02 authority/policy schemas; TC04 platform custody; TC07 unsupported paths; TC08 provider change/reconciliation; TC10 tests/qualification |
| Same-user isolation | Separate service identity or equivalent boundary, IPC authentication, local tamper assumptions, process-debug controls, and platform-specific residual risk | TC02 threats/principals; TC04 platform custody semantics; TC07 adapters and isolated injection; TC10 tests/qualification |
| Protected outbound migration | Approved recipient binding, rewrapping or broker-to-broker transfer, dual control, resumability, source retention until verification, safe receipts, and no plaintext staging | TC03 canonical envelopes; TC08 provider change/reconciliation and safe audit; TC09 migration/export/sync; TC10 tests/qualification |
| Decommission migration | Inventory and revoke every copy/lease, second approval for destructive finalization, recovery-window policy, destination verification, cryptographic erasure evidence, and immutable audit | TC06 rotation/revocation; TC08 safe audit and incident/quarantine; TC09 migration/crypto-shredding/recovery drills; TC10 tests/qualification |

These definitions are composition responsibilities. A vendor feature with a
similar name is evidence for evaluation, not automatic closure.

## 8. Explicit negative controls

The future design must deny and test the following paths:

- Credential values in prompts, completions, tool results, model-visible MCP
  results, logs, traces, exceptions, receipts, telemetry, or target output.
- Arguments, environment variables, inherited descriptors, clipboard, standard
  input/output/error, shared or persistent temporary files, generated config,
  templates, shell interpolation, or generic HTTP/plugin payloads carrying a
  credential.
- Generic `read secret`, `decrypt`, `exec`, arbitrary shell, arbitrary URL, or
  unrestricted plugin actions exposed to Claude Code, Codex CLI, or another
  model-facing caller.
- Direct Keychain, DPAPI, Secret Service, vault, secret-store, KMS decrypt, SOPS,
  or age access from the model-facing process.
- Vault/OpenBao agent sink, template, process-supervisor, or environment paths;
  1Password `op read/run/inject`; Bitwarden `bws run`; SOPS
  `exec-env`/`exec-file`; and systemd null-key, file, or stdout delivery as ECR
  runtime mechanisms.
- Fallback to reveal, longer leases, broader actions, weaker custody, stale
  policy, unaudited execution, local plaintext, or an unqualified platform when
  the broker, audit store, time source, hardware root, or managed service fails.
- Migration via plaintext export, unverified destination, shared archive,
  single-party decommission, or deletion before destination/recovery proof.

Official AI-tool integrations are evidence of useful integration patterns, not
ECR qualification. AWS documents Claude Code and Codex CLI support in its
[Agent Toolkit](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets-ai-agents.html),
but also describes a best-effort defense rather than a security boundary and
documents argument/environment delivery paths. The beta [Vault MCP server](https://developer.hashicorp.com/vault/docs/mcp-server/overview)
and its [security model](https://developer.hashicorp.com/vault/docs/mcp-server/security-model)
warn that secrets may reach the LLM/MCP path and expose secret-reading
capability. Both therefore fail HG01-HG03 as direct ECR interfaces.

## 9. Rejected options and reasons

| Option | TC01 disposition |
| --- | --- |
| A single cross-platform password manager as the ECR | Rejected: portability is useful, but direct read/copy/inject semantics fail the broker-only and same-user gates. |
| Direct OS keychain calls from Claude Code or Codex CLI | Rejected: OS authorization and root-key custody do not prevent entry plaintext release or API use by the same identity. |
| Direct cloud KMS decrypt or secret-store get | Rejected: returns plaintext to the caller and makes the local/offline profile remote-dependent. |
| Vault/OpenBao Agent templates, sinks, environment, or child-process delivery | Rejected as runtime delivery: these deliberately deliver secrets to process-visible surfaces. Store/issuer roles remain shortlisted. |
| AWS Agent Toolkit or Vault MCP as the ECR boundary | Rejected: their own official security descriptions do not meet HG01-HG03. |
| Secretless Broker or Boundary as the entire ECR | Rejected as whole products: each covers selected broker protocols and leaves custody, KStack approvals, repository identity, recovery, safe receipts, and platform coverage open. |
| SOPS/age as runtime repository access | Rejected: excellent recovery-envelope candidates, but general decrypt and execution helpers release plaintext and supply no action policy. |
| KeePassXC database as the production ECR | Rejected: local/offline storage does not provide a separate typed broker or model non-export boundary. |
| Build a new vault, cipher, KMS, or platform keychain abstraction from scratch | Rejected: unjustified cryptographic and maintenance risk where mature primitives exist. Build is limited to proven composition gaps. |
| Silent local/managed fallback or reveal-on-error | Rejected unconditionally as downgrade behavior. |

## 10. Named synthetic tests to design later

These are test names and required claims, not implemented tests or passing
results.

| Test | Required future demonstration |
| --- | --- |
| ECR-ST01 ModelNonExportCanary | A marked synthetic credential never enters any model-visible prompt, result, trace, error, receipt, or transcript. |
| ECR-ST02 TransportContainmentCanary | The marker is absent from argv, environment, inherited descriptors, clipboard, stdout/stderr, temp files, generated config, and shell history. |
| ECR-ST03 SameUserBoundary | A hostile process under the interactive user's identity cannot invoke the broker as its separate identity, steal authority, inspect entry plaintext, or alter the request. |
| ECR-ST04 LayerDistinction | Root-key non-export, entry release, broker action, and model non-export produce separate evidence and cannot be conflated. |
| ECR-ST05 TypedActionFence | Generic read/decrypt/exec/URL/plugin requests and out-of-scope targets are denied; only the approved typed action executes. |
| ECR-ST06 RepositoryIdentitySubstitution | Clone, fork, origin change, worktree move, symlink, case collision, and dirty-state substitutions follow the defined fail-closed identity policy. |
| ECR-ST07 TrustedTimeRollback | Wall-clock rollback, excessive skew, suspend/resume, time-source loss, and monotonic-counter reset cannot extend or revive authority. |
| ECR-ST08 LeaseReplayRace | Reuse, concurrent spend, crash-before-commit, delayed delivery, and duplicate broker requests cannot execute twice or broaden scope. |
| ECR-ST09 AuditFailClosed | Audit denial, corruption, outage, disk-full, ordering failure, and receipt mismatch deny action without revealing material. |
| ECR-ST10 StaleBackupRecovery | Stale, partial, wrong-recipient, revoked-key, and pre-rotation backups cannot silently restore invalid authority; approved recovery remains demonstrable. |
| ECR-ST11 DowngradeMatrix | Missing hardware, broker, policy, audit, network, managed service, or platform support never selects a weaker or reveal path. |
| ECR-ST12 LocalOfflineProfile | After initial authorized setup, ordinary local actions operate without a remote control plane and retain all gates. |
| ECR-ST13 ManagedOutageProfile | Managed-service outage, tenant loss, region isolation, and expired cloud identity fail closed with documented recovery. |
| ECR-ST14 RotationRevocation | Rotation and revocation invalidate old material and leases in the specified order without loss, dual validity beyond policy, or plaintext staging. |
| ECR-ST15 ProtectedOutboundMigration | Broker-to-broker or rewrap migration binds the approved recipient, verifies destination, resumes safely, retains rollback until proof, and emits safe receipts. |
| ECR-ST16 DecommissionSecondApproval | Final source destruction requires separate approval, destination and recovery proof, complete inventory/revocation, and auditable cryptographic-erasure evidence. |
| ECR-ST17 PlatformProfileParity | Windows, macOS, and Linux profiles each meet the hard gates through their stated boundary without being reduced to the weakest platform. |
| ECR-ST18 BrokerCrashCleanup | Crash, kill, timeout, target refusal, and host reboot remove transient plaintext and authority while preserving a safe, bound audit outcome. |
| ECR-ST19 TargetOutputExfiltration | A malicious or verbose target cannot echo, transform, or encode credential material into model-visible output or a safe receipt. |
| ECR-ST20 SourceLicenseProvenance | Exact source, release/API pin, signature or provenance evidence, license obligations, SBOM/dependencies, maintenance owner, and vulnerability response are reproducible. |

## 11. Review requirement and next authority

This artifact is **REVIEW-REQUIRED / NOT IMPLEMENTED**. The shortlist is a
provisional input to ECR-TC02 through ECR-TC10, not approval to install or run a
contender and not a claim of security, operational, legal, or product
qualification. Before any implementation decision, reviewers must close every
hard gate per role, resolve the composition gaps, pin exact deployable artifacts
for each supported platform/profile, and design the named synthetic tests.

The next permitted step is owner-directed review or the separately authorized
next design test case. No runtime path, credential, production state, or
publication changes follow from this document.
