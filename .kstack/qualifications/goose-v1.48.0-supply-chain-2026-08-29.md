# Goose `v1.48.0` supply-chain artifact qualification — 2026-08-29

**Jira item:** `hb-tc09-goose-host` / `KSTK-84`  
**Outcome:** `SBOM_NOTICES_SOURCE_ACCOUNTING_PASS_REVIEW_REQUIRED`  
**Maximum claim:** the exact reproducibly built Linux Goose binary is bound to
a deterministic CycloneDX 1.5 component graph, a complete conservative
workspace notice ledger, and corresponding-source identities with explicit
modified-file/MPL accounting; this is technical evidence, not legal advice or
approval, and it grants no Goose execution, host admission, provider access,
credential use, adapter qualification, or final release authority

## Bound artifact and source

The qualified binary is the byte-identical output from the two independent
offline builds recorded in
`goose-v1.48.0-reproducible-build-2026-08-29.md`:

- binary SHA-256:
  `057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792`;
- remediated source-tree manifest SHA-256:
  `0d2cb9b14a970aae67c27a9a2d1db2eaca12ce2e5b082e8441413de7bb240234`;
- remediated `Cargo.lock` SHA-256:
  `cc55ae1fad9e84444f23a09ec76505c5996487e156fb173b5fa945a62c69287f`.

The SBOM binder rejects any binary other than that exact qualified output. The
ledger generator runs locked, offline Cargo metadata for
`x86_64-unknown-linux-gnu`, verifies each cached crates.io archive against its
`Cargo.lock` checksum, retains git revision/tree identities, manifests local
path packages, and records the seven KStack-remediated files explicitly.

## Durable artifacts

| Artifact | SHA-256 | Bound result |
|---|---|---|
| `goose-v1.48.0-x86_64-unknown-linux-gnu.cdx.json` | `379d039a6f560ec79149a7e872b10e886b8b60c688d21600445100f6548d7bf7` | CycloneDX 1.5; exact binary hash; 1,043 components and 1,044 dependency nodes |
| `goose-v1.48.0-third-party-notices.json` | `26cc8e14c3df76561f6f0ee708c379a22f1836a77ff31499446420c656579270` | 1,146 packages; 598 content-addressed, deduplicated notice/license texts |
| `goose-v1.48.0-corresponding-source.json` | `aca0643a8e18547bf3356727d2023bdd67c9dbf6c93fdb45e9561bcfadda1620` | 1,146 package source identities; archive, git, or candidate-source provenance |

The 1,146-package ledgers intentionally cover Cargo's resolved workspace graph,
which is a conservative superset of the single `goose` binary SBOM. Every SBOM
component name/version is present in the corresponding-source ledger. The
validator found no SBOM component missing a package URL or declared license.

## Deterministic production and validation

The generators and validator are themselves content-addressed:

| Tool | SHA-256 |
|---|---|
| `bind-goose-v1.48.0-sbom.mjs` | `6d724ddb1045edbe0f5cd0580dc7154ddee70de2d8d411bcffcc71d6341a1aec` |
| `generate-goose-v1.48.0-source-ledgers.mjs` | `fc7ed7e01f8b39c82e59cd0168e223479d1e405f4a0cfa98a8255289f4ca2576` |
| `validate-goose-v1.48.0-supply-chain.mjs` | `76f71e1493eb9d9dbbd3e7b12959b501e611a2a4b25f9790dd4bee4839ce9dfc` |

`cargo-cyclonedx 0.5.9` was installed from the existing cache into a disposable
`/tmp` prefix and run without network access. Binding the generated graph to
the independent A and B binaries produced the same SBOM SHA-256. Running the
ledger generator independently into the repository and a disposable output
directory produced identical notice and corresponding-source SHA-256 values.

The durable validator reports:

```json
{
  "result": "PASS",
  "sbomComponents": 1043,
  "dependencyNodes": 1044,
  "sourcePackages": 1146,
  "noticeTexts": 598,
  "mplPackages": 17,
  "modifiedMplFiles": 0
}
```

It also verifies exact notice-text hashes, equal notice/source package ID sets,
well-formed source identities, the root binary and binder digests, and SBOM
coverage by the source ledger. A bounded credential-pattern scan over the
three generated artifacts and their generators/validator passed without a
match.

## MPL and modified-file accounting

The source ledger identifies 17 packages whose declared expression is in the
MPL family. None of the seven KStack-remediated files belongs to those
packages, so `modifiedMplFiles` is empty. The ledger still preserves exact
source identity and notice material for all 17 packages. This is a mechanical
technical accounting result; a qualified human retains responsibility for any
legal interpretation or distribution decision.

## Non-promotion and remaining gates

This closes KSTK-84's SBOM, notice, corresponding-source, and modified-file
accounting evidence only. The binary has still not been executed. KSTK-84
remains blocked pending independent review of the exact remediation and threat
model, a dedicated Goose adapter, isolated execution, protected per-operation
conformance with distinct Goose evidence, and the final KStack host-admission
decision. No OpenCode evidence substitutes for a Goose result.
