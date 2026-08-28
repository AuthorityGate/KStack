# ECR-TC03 Codex closure

| Field | Bound value |
| --- | --- |
| Status | **PROVISIONAL COMPOSE / CODEX-QUALIFIED DESIGN / NOT IMPLEMENTED** |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| FIPS owner decision | [TC03 FIPS owner decision](encrypted-credential-repository-2026-08-27-tc03-fips-owner-decision.md) |
| FIPS owner decision SHA-256 | `6b4cf4fe2cff2ad016055a31333652cc35fd23672f0cdb1f9abebae75c1a38f8` |
| Prior closure | [ECR-TC02 Codex closure](encrypted-credential-repository-2026-08-27-tc02-codex-closure.md) |
| Prior closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| Closed candidate | [ECR-TC03 cryptographic and canonical-format design](encrypted-credential-repository-2026-08-27-tc03-cryptographic-format-design.md) |
| Closed candidate SHA-256 | `16d7cd06aff3ecf111076252c1cbe80c80bf08f46f514ab62bb5db7268c49ca5` |

## Codex review ledger

| Round | Candidate SHA-256 | Decision and confidence | Failed checks | Security findings | Material dissent | Unresolved questions | Strongest objection | Review output and SHA-256 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| R1 | `83da9b4f3c6df69b5ad97749a889a1c1d6ce668436e9343e20cbd5c9c1de0649` | `revise`, 97 | 4 | 3 | 0 | 0 | Canonical-format closure was not uniquely implementable and KWP omitted transplant-prevention bindings | [R1 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc03-r1/codex.md), `f1a399f3e375b23cd0ad3d885ef4c54ec6dc778619ba58a47828560c83d42b48` |
| R2 | `16d7cd06aff3ecf111076252c1cbe80c80bf08f46f514ab62bb5db7268c49ca5` | `approve`, 96 | 0 | 0 | 0 | 0 | `None.` | [R2 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc03-r2/codex.md), `399eefcfd9da3cdceb18a0d780d720f1c8f096b63441643f87ec853b69e71d75` |

## Closed repair set

R2 closes the four R1 repair groups and three exact pre-R2 residuals without
broad redesign:

1. All TC02 top-level and nested values now have normative byte-constructible
   CDDL, including duration and network-authority tags, the sole narrowly
   admitted Boolean `true`, exact field-specific reference aliases, distinct
   adapter/profile and provider/tenant kinds, and constrained identity-evidence
   domains and schemas.
2. Stored, nonproduction, recovery, and migration KWP derivation contexts now
   bind complete non-circular envelope context: envelope and CEK IDs, complete
   common or transfer bindings, protected header, generation, profile,
   recipient, authority, source, and destination. Every copied field is
   byte-equal, and transplant fails at KWP before GCM.
3. Decode failure of every TC02 closed top-level or nested schema, tagged
   presence, enum, set, epoch, or field-specific reference maps to
   `POLICY_SCHEMA_UNSUPPORTED`; TC03-owned failures retain their distinct
   fail-closed mapping.
4. Per-production canonical maxima, parser metadata, protected-record
   resolution, canonical re-encoding, provider copies, pre/post-authentication
   peaks, and achievable boundary witnesses are normatively derived without a
   generic cap or unexplained fixed arena.
5. Common and transfer bindings now contain one exact
   `provider-tenant-target-ref-v1`. Its canonical bytes bind TC02 equality, AAD,
   and KWP; splitting, defaulting, omission, recombination, or substitution is
   invalid.
6. `epoch-entry-v1.scope_id` is exactly `id128-v1`, preserving TC02 scope
   equality and an achievable maximum witness of 4,096 distinct ordered
   16-byte scope IDs.
7. Canonical encoder/comparator state and every live raw/output buffer are
   explicit and bounded. Outer/header comparisons use immutable input slices,
   AAD/context outputs are single charged buffers, `Enc_structure` is streamed
   or provider-charged, and `Pre(K)`/`Post(K)` include all live output without
   hidden allocation.

## Closure boundary

This closure records Codex qualification of the exact digest-bound TC03 design
only. It preserves `PROVISIONAL COMPOSE / CODEX-QUALIFIED DESIGN / NOT
IMPLEMENTED` and grants no authority to implement, install dependencies, access
credentials or keys, generate key material, qualify a provider, execute a
runtime or cryptographic operation, migrate data, stage, commit, push, deploy,
publish, or activate production. It does not close ECR-TC04 through ECR-TC10,
replace their independent qualification gates, or assert that any synthetic
test has run or passed.
