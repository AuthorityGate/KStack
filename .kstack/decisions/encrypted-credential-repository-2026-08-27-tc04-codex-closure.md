# ECR-TC04 Codex closure

| Field | Bound value |
| --- | --- |
| Status | **PROVISIONAL COMPOSE / CODEX-QUALIFIED DESIGN / NOT IMPLEMENTED** |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| ECR-TC01 closure | [ECR-TC01 Codex closure](encrypted-credential-repository-2026-08-27-tc01-codex-closure.md) |
| ECR-TC01 closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| ECR-TC02 closure | [ECR-TC02 Codex closure](encrypted-credential-repository-2026-08-27-tc02-codex-closure.md) |
| ECR-TC02 closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| ECR-TC03 candidate | [ECR-TC03 cryptographic and canonical-format design](encrypted-credential-repository-2026-08-27-tc03-cryptographic-format-design.md) |
| ECR-TC03 candidate SHA-256 | `16d7cd06aff3ecf111076252c1cbe80c80bf08f46f514ab62bb5db7268c49ca5` |
| ECR-TC03 closure | [ECR-TC03 Codex closure](encrypted-credential-repository-2026-08-27-tc03-codex-closure.md) |
| ECR-TC03 closure SHA-256 | `6d562b5473ef5965272a4400b95b1f29977b11fb06b0ab6b9893adf630b70438` |
| FIPS owner decision | [TC03 FIPS owner decision](encrypted-credential-repository-2026-08-27-tc03-fips-owner-decision.md) |
| FIPS owner decision SHA-256 | `6b4cf4fe2cff2ad016055a31333652cc35fd23672f0cdb1f9abebae75c1a38f8` |
| Closed candidate | [ECR-TC04 platform custody and recovery-carrier design](encrypted-credential-repository-2026-08-27-tc04-platform-custody-recovery-design.md) |
| Closed candidate SHA-256 | `2fed5c13961e132962dc469f2f91260cbddaf43bcdcc9d23f04c73c8b9abd54e` |

## Codex review ledger

| Round | Candidate SHA-256 | Decision and confidence | Failed checks | Security findings | Material dissent | Unresolved questions | Strongest objection | Review output and SHA-256 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| R1 | `7c22a6ce4c6397e10fba53191d45e8b5d8efb43d7fa71e42f429156ad0050f5e` | `revise`, 98 | 5 | 3 | 0 | 0 | Portable/recovery profiles, suite-4 derivation, bootstrap publication, and resolver accounting were incomplete | [R1 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r1/codex.md), `22e274f9bc6e1e3a59e19ecf8b03caf35a1b5cf4a0cd7d57d7733f0587ef6af0` |
| R2 | `6d752ab038dbea83cf44ab908aa2d6bcb564a95e531681fd6d5052f2fb75aca0` | `revise`, 97 | 2 | 2 | 0 | 0 | Historical ceremony currentness contradicted one-use consumption and could disable valid generations after setup expiry | [R2 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r2/codex.md), `7b48927f38c351e2424e0116267cd3b8174657ee571b6686fe12099c4b14c7a2` |
| R3 | `6c93c61a7587302d330969ffc5d80fbb67be164c97b1a9975b957af1e15a2dd3` | `revise`, 97 | 3 | 3 | 0 | 0 | Recovery excluded valid generation-1 staged and authorized-portable source branches | [R3 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r3/codex.md), `d9a9fb5df466f4cbb17197e3c8b11aedeb3fdc84237095d24a0befc48a35526e` |
| R4 | `fbd5c82fcd5a0ce889655e2ac0982a2e0d7bbdc8da24684a23efb50c0c21c3dd` | `revise`, 98 | 1 | 1 | 0 | 0 | Trusted-time accounting omitted each required referenced skew-evidence record | [R4 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r4/codex.md), `7c8ef2c67879361a4766b458b0368e129d57bb16b1a06e648c5d645676b6ab0b` |
| R5 | `c5c621f6252264ace71380f006dad24c90b4952cecab199113235f0a36b93d76` | `revise`, 98 | 1 | 1 | 0 | 0 | Adverse validation of the repaired trusted-time and skew-evidence paths remained incomplete | [R5 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r5/codex.md), `61b2641935dc9f8a836b464de6dd58ee82755438398f0cc4b0b3f312d25b0dee` |
| R6 | `b87b6be2377e1de8e52ccab6850d33fab5d64e3227a4fb7d2e82c1c4f2489070` | `revise`, 98 | 4 | 4 | 0 | 0 | Confirmation and development-omission time/accounting paths were incomplete, and omission lacked authenticated owner-consumption proof | [R6 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r6/codex.md), `6adee0be9fea61385bb13e999c10dfb04866622ea0230b1f14e3751517db2cc1` |
| R7 | `9da4a39012a700cf89c337bc0043cc81711b48660fc56f42f898e08050f23a87` | `revise`, 97 | 2 | 2 | 0 | 0 | Development omission omitted authenticated environment binding and executable source-open resolver placement | [R7 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r7/codex.md), `47182ec20f5dd7b6c7ee1d72061091a4d814d400c2b1b3100989681fd9de9fb0` |
| R8 | `e8df9c54ccacc8b08b0b29e2af43bbeae8fda8a27ddd2b6653a8f2602e65765a` | `revise`, 98 | 1 | 1 | 0 | 0 | Current ceremonies omitted protected-current environment identity and full owner-readback accounting | [R8 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r8/codex.md), `ca77aed9a6a0515e60bb5ad9f39ec5ca18856e31f6a952dc84a0b146285bd2a7` |
| R9 | `2fed5c13961e132962dc469f2f91260cbddaf43bcdcc9d23f04c73c8b9abd54e` | `approve`, 96 | 0 | 0 | 0 | 0 | `None.` | [R9 Codex output](../reviews/encrypted-credential-repository-2026-08-27-tc04-r9/codex.md), `38b0dd666b0fa70564eb22a27400d1f3fa0c8a2e9d7e25240691d7b2771f4b93` |

## Closed repair set

R9 closes the R1–R8 findings through isolated repairs rather than a broad
redesign:

1. Custody, portable, and recovery profile bodies, typed-reference payload
   equality, complete environment/suite relations, provider separation, and
   unresolved qualification gates are byte-closed.
2. Root-slot KWP contexts bind store and root generations, independent IDs,
   exact profiles, epochs, qualified tuples, ceremony authority/proof, carrier
   binding, recovery provenance, and every kind-specific field without a
   circular wrapped-result or confirmation dependency.
3. Empty-store bootstrap, generation-1 staged lineage, platform and authorized
   portable sources, recovery confirmation, replacement authority, and atomic
   binding/proof/receipt/history/manifest publication have exact, non-circular
   relations and fail-closed source selection.
4. Historical ceremony authority and evidence are proven valid at their
   immutable one-use consumption but need not remain presently unexpired;
   proof, transaction, receipt, effect, and rollback-evident history bindings
   close replay and replaced-snapshot paths.
5. Every authority/proof trusted-time input resolves its required closed skew
   evidence. Confirmation time aliases its proof time, while malformed,
   mismatched, stale, wrong-source, same-source, candidate-field, boot-bound,
   exact-budget, and one-byte-over cases deny before provider work.
6. Development recovery omission reuses the authenticated owner ceremony and
   one-use proof graph, binds the exact environment and full warning readback,
   and is charged exactly once only on applicable admitted suite-2 synthetic
   platform slot opens. Ordinary, Create-source, Confirm-source, zero-branch,
   and cross-environment phase witnesses prevent bypass or double charging.
7. Suite-4 recovery has exact `OWNER_SELECTED_ASCII` provenance, a fixed public
   label, independent artifact ID and salt, offline-only owner storage,
   slot-before-input resolution, fresh re-entry, no stable secret oracle,
   attempt burn/cleanup, nonpersistence, and complete Create/Confirm/TC09 peak
   accounting while remaining nonproduction-only.
8. Ceremony authority, canonical subject, authentication evidence, consumption
   proof, selected protected environment, and omission all byte-bind one exact
   environment; same-store/profile/tuple cross-environment substitutions reject
   before provider work.
9. Every current ceremony separately charges its live authority, evidence,
   time, skew, protected-current environment identity, and full owner readback.
   The live control records cannot be deduplicated away; environment/readback
   deduplicate only by identical canonical digest within the same phase.
10. Generated `Max`, `Record`, `Resolve04`, `Pre04`, `Post04`, `Create04`, and
    `Confirm04` terms cover all live raw/canonical buffers, source, staged,
    emit, root-handle, challenge, carrier, Argon, and later-owned protected
    records with achievable boundary and fault-injection witnesses.

## Closure boundary

This closure records Codex qualification of the exact digest-bound TC04 design
only. It preserves **PROVISIONAL COMPOSE / CODEX-QUALIFIED DESIGN / NOT
IMPLEMENTED** and grants no authority to implement; install dependencies;
access credentials, keys, carriers, owner-selected input, or protected data;
authenticate a user; generate key or recovery material; invoke Windows, macOS,
Linux, hardware, broker, provider, Argon, HKDF, KWP, or recovery APIs; create or
confirm a carrier; perform a recovery attempt; qualify a platform/provider;
stage; commit; push; deploy; publish; or activate production.

It does not close ECR-TC05 through ECR-TC10, replace their independent design
and qualification gates, claim that any target platform or privileged path is
available, or assert that runtime, hardware, FIPS, adverse, or real-material
tests have executed or passed.
