# ECR-TC01 Codex closure

| Field | Bound value |
| --- | --- |
| Status | **PROVISIONAL COMPOSE / CODEX-QUALIFIED DESIGN / NOT IMPLEMENTED** |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| Closed candidate | [ECR-TC01 contender selection](encrypted-credential-repository-2026-08-27-tc01-contender-selection.md) |
| Closed candidate SHA-256 | `95358294c90dcd88a57fd6a2ec329005348c73c4f1e2ee21e0a5e0b112617bc0` |

## Codex review ledger

| Round | Candidate SHA-256 | Decision and confidence | Failed checks | Security findings | Material dissent | Unresolved questions | Strongest objection | Review output and SHA-256 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| R1 | `30d933ec1a930fdaae81464a7094fe6c6083aecacdae2be959a1866aca847c63` | `revise`, 97 | 3 | 1 | 0 | 0 | `None.` | [R1 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc01-r1/codex.md), `9153c3935b76804b1905e9f3d1eb49fa086be0e9e07a1907ec6ebe0b58510746` |
| R2 | `95358294c90dcd88a57fd6a2ec329005348c73c4f1e2ee21e0a5e0b112617bc0` | `approve`, 97 | 0 | 0 | 0 | 0 | `None.` | [R2 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc01-r2/codex.md), `146801ba6db6c4315f780dfdce8ae8e7aae653c3bc834b3cd3cb95c0dd2875e6` |

R2 closes the R1 correction set for the exact candidate digest above. The four
repairs were:

1. Replace the generic target-native workload-identity placeholder with named,
   official-primary-source-linked AWS IAM Roles Anywhere, Microsoft Entra
   managed identities, and Google Cloud Workload Identity Federation examples,
   while retaining bounded identity/issuer claims rather than broker
   qualification.
2. Replace the mutable systemd `main` behavioral source with the release-pinned
   systemd `v260.2` source at commit `f1d0952`.
3. Replace the Vault 2.0.3 pin with the official Vault 2.0.4 release available
   before the research cutoff and record the limited security-fix rationale
   without claiming universal vulnerability closure.
4. Remap every section 7 composition gap to the locked ECR-TC02 through
   ECR-TC10 ownership boundaries, including TC06 leases, TC07 adapters and
   brokered injection, TC08 audit, and TC10 tests and qualification.

## Closure boundary

This closure records Codex qualification of the digest-bound ECR-TC01 design
only. It preserves the candidate's provisional COMPOSE result and hard gates.
It does not qualify a runtime component or composition, implement anything,
authorize credential access, close any later test case, or grant authority to
begin ECR-TC02. ECR-TC02 through ECR-TC10 remain independently owner-gated.
