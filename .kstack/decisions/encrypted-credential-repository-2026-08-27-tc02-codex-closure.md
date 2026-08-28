# ECR-TC02 Codex closure

| Field | Bound value |
| --- | --- |
| Status | **PROVISIONAL COMPOSE / CODEX-QUALIFIED DESIGN / NOT IMPLEMENTED** |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| Prior closure | [ECR-TC01 Codex closure](encrypted-credential-repository-2026-08-27-tc01-codex-closure.md) |
| Prior closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| Closed candidate | [ECR-TC02 threat, identity, authority, and policy design](encrypted-credential-repository-2026-08-27-tc02-threat-identity-authority-policy.md) |
| Closed candidate SHA-256 | `e03e4c298eb65314cf251095f9f9349f53733edb1efab009ee577c4f66d4b202` |

## Codex review ledger

| Round | Candidate SHA-256 | Decision and confidence | Failed checks | Security findings | Material dissent | Unresolved questions | Strongest objection | Review output and SHA-256 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| R1 | `5ee6adb52969f76ce4d0a665a41988f0c2f61c98e79c3b055a1552011606ba5b` | `revise`, 97 | 4 | 4 | 0 | 1 | Q8 service exception lacked deterministic policy composition | [R1 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc02-r1/codex.md), `295ea679685aa4f600dee6c7c5b4b500db9043695f654162ff035160cd4b2518` |
| R2 | `fba11e6ddc03bfc631226308f4d1dbe2719993bbf1ef448fd33f2ce4f2b93e71` | `approve`, 97 | 0 | 0 | 0 | 0 | `None.` | [R2 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc02-r2/codex.md), `8dbe62ba15364be907d6503f037f0b08a97d12c51818a5b4828ae5528b51a891` |
| R3 | `e03e4c298eb65314cf251095f9f9349f53733edb1efab009ee577c4f66d4b202` | `approve`, 98 | 0 | 0 | 0 | 0 | `None.` | [R3 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc02-r3/codex.md), `74657d1208ac376a23843d9234503b650529afbabf00540e9582e261269d6efa` |

## Closed repair set

R2 closes the exact R1 defects without broad redesign:

1. A closed, disjoint human/service authority-path matrix now composes exact
   `OWNER_SCOPE`, one matching `SERVICE_PROFILE`, and linked
   `ServiceAuthorityV1` without treating service authority as an override.
2. The owner-locked Q8 unattended production exception is now deterministic;
   every missing, ambiguous, stale, conflicting, or mismatched link denies.
3. Scalar restriction epochs were removed from authority policy. Complete
   independently scoped policy, restriction, and profile-qualification epoch
   vectors fence stale authority.
4. Output policy is byte-exact across request, policy, human approval, service
   authority, adapter, and a named qualified-profile tuple.
5. `later_stage_requirements` now has an exhaustive result, authority-path,
   profile, and effect-state matrix, backed by focused ST20/ST25/ST29/ST30
   negative checks.
6. Both panel evidence files were supplied locally and their bounded reuse/gap
   claims were verified; the R1 evidence-access question is closed.
7. TC03 constraint extraction exposed one nested repository-state schema gap.
   R3 closes it with exact `RepositoryStateRuleV1` fields, single-instance
   bound-dirty semantics, deterministic registration-versus-policy reason
   ordering, strict direct-only aliases, and focused negative checks.

## Closure boundary

This closure records Codex qualification of the exact digest-bound TC02 design
only. It preserves `PROVISIONAL COMPOSE / NOT IMPLEMENTED` and authorizes no
implementation, dependency installation, credential access, key generation,
runtime action, migration, staging, commit, push, deployment, publication, or
production activation. It does not close ECR-TC03 through ECR-TC10 or weaken
their independent review gates.
