# ECR-TC03 owner decision — production FIPS profile

| Field | Bound value |
| --- | --- |
| Status | **OWNER-LOCKED / DESIGN INPUT / NOT IMPLEMENTED** |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| TC02 closure | [ECR-TC02 Codex closure](encrypted-credential-repository-2026-08-27-tc02-codex-closure.md) |
| TC02 closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| Decision ID | `ECR-TC03-Q-FIPS-001` |
| Owner response | **YES** |

## Exact question and response

Should every production/user-data deployment be required to have a qualified
FIPS-validated cryptographic profile available, even when that requires
AES-256-GCM and a validated provider instead of an otherwise-qualified
ChaCha/XChaCha profile?

Owner response: **Yes**.

## Locked interpretation

1. Every `PRODUCTION_USER_DATA` deployment requires an exact, current,
   qualified FIPS-validated cryptographic module, operating environment,
   provider configuration, and complete production suite. Algorithm names or
   successful API calls alone are not FIPS evidence.
2. Production creation, open, rewrap, rotation, migration, restore, and recovery
   activation fail closed when the exact validated boundary or qualification
   evidence is absent, stale, disabled, mismatched, or outside its approved
   operating environment.
3. Development may use a separately named and qualified non-FIPS suite only for
   `SYNTHETIC_DEVELOPMENT` or explicitly permitted
   `NONPRODUCTION_CONTROLLED` data. It cannot process or relabel production
   objects.
4. Non-FIPS algorithms never act as an automatic production fallback. Suite or
   provider crossing is an explicit owner-governed migration that creates a new
   generation and must end inside a qualified FIPS production profile.
5. Argon2id remains a non-FIPS portable-slot contender for non-production only.
   It cannot directly activate a production root. Production recovery requires
   a later-qualified FIPS-compatible high-entropy recovery mechanism; no weaker
   human-memorized-input derivation is inferred or authorized here.
6. The Q3 portable-production custody downgrade accepts only its disclosed
   custody residual risk and cannot waive this FIPS gate. A portable production
   profile is unavailable until TC04/TC09/TC10 qualify one inside the required
   FIPS boundary.
7. Offline recovery, separation of duties, and confirmed recovery remain
   mandatory under Q4. FIPS does not permit omission of recovery or use of an
   unqualified recovery path.

## Authority boundary

This decision resolves one TC03 design fork only. It does not select a vendor
or validated module, claim current FIPS compliance, authorize implementation,
dependency installation, protected-value access, generation of cryptographic
material, real-value testing, migration, staging, commit, push, deployment,
publication, or production activation. Exact module certificates, builds,
operating environments, self-tests, provider configuration, and lifecycle
qualification remain ECR-TC04/ECR-TC10 work.
