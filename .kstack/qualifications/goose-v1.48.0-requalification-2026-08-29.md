# Goose `v1.48.0` requalification — 2026-08-29

**Jira item:** `hb-tc09-goose-host` / `KSTK-84`  
**Outcome:** `BLOCKED_DEPENDENCY_ADMISSION`  
**Maximum claim:** exact source/binary provenance and static negative
qualification only; no Goose host cell admitted

## Exact release binding

| Field | Value |
|---|---|
| Repository | `https://github.com/aaif-goose/goose` |
| Release/tag | `v1.48.0` |
| Published | `2026-08-27T19:12:05Z` |
| Lightweight tag commit | `25021517f12cab87c94bed0874fe7d28168dc264` |
| Commit verification | unsigned |
| Linux asset | `goose-x86_64-unknown-linux-gnu.tar.gz` |
| Linux asset SHA-256 | `3c38c790723fde4532357f35346b7190bd70d198e6be559f9ffeac4cf7c98152` |
| Extracted Linux ELF SHA-256 | `cbc75f1d87efe1e47baa7775cc1c4a2283964b042502d15dd38c6c04f2c06ed6` |
| Source asset | `goose-source-v1.48.0.tar.gz` |
| Source asset SHA-256 | `0d0d7314caa9f07755e57159a2c89031b4a1485bbf44ed52e493c30e25512173` |
| `Cargo.lock` SHA-256 | `abd7e083ec3331804b1962dacec786832194322c32f3d415db743e21beb3948a` |
| `Cargo.toml` SHA-256 | `bb0017f7b79099606d775b59149f4e187537e9360c8cca7b83b2d9aa1f9a02a4` |
| `deny.toml` SHA-256 | `fade2bd4f0bd1d66befcb6bffc00fcffcb67039afd507c0cabc698dda81fe850` |
| Release workflow SHA-256 | `1e70c4e609a8d500ad16c7deba9c91a5dbe7f06b283fb593adc31f05f6f50291` |

The Git tag and commit are unsigned. That fact does not by itself reject the
published assets because GitHub's artifact-attestation service returns a
Sigstore/SLSA provenance statement for the exact release asset set. Local
`gh attestation verify --repo aaif-goose/goose` succeeded independently for
both the Linux and source archives. The attestation binds the release workflow
`.github/workflows/release.yml`, `refs/tags/v1.48.0`, the exact commit above,
GitHub-hosted runner identity, and every published asset digest.

## Reproduced dependency blocker

The exact attested source archive's locked dependency audit fails before Goose
execution:

- auditor: `cargo-deny 0.19.4`;
- command: `cargo deny check advisories`;
- result: exit `1`, `advisories FAILED`;
- defect: yanked crate `chacha20 0.10.1` at `Cargo.lock:177`;
- production reachability begins at `rand 0.10.2` and includes both `goose
  v1.48.0` and `goose-cli v1.48.0`, in addition to multiple runtime dependency
  paths;
- published policy sets `yanked = "deny"`, so the release fails its own stated
  supply-chain rule;
- the sole configured ignore, `RUSTSEC-2023-0071`, was not encountered and
  does not explain or waive this failure.

This is not a compilation warning or a KStack-only preference. The exact
published lock and the upstream release's own deny policy disagree. KStack
therefore cannot admit the published binary as the separately qualified second
host.

## Bounded checks

- Queried the official GitHub release, tag, commit, asset-digest, and
  attestation APIs.
- Verified the downloaded source and Linux archives against the published
  SHA-256 values and official Sigstore/SLSA attestations.
- Rejected absolute or parent-traversal archive paths before extraction.
- Statically inspected the Linux binary as a non-setuid x86-64 PIE with
  `BIND_NOW`, GNU RELRO, and a non-executable stack.
- Ran the locked advisory/yanked-crate gate from the exact attested source.
- Did not execute Goose, install it persistently, invoke a model/provider, use
  a credential, change user configuration, or cross an authority boundary.

## Requalification rule

A minimal source remediation has now been compiled successfully and is recorded
in `goose-v1.48.0-remediation-feasibility-2026-08-29.md`. That result narrows the
blocker. A subsequent clean-room compatibility remediation now passes KStack's
explicit technical license/source policy as recorded in
`goose-v1.48.0-license-source-remediation-2026-08-29.md`, but this does not
satisfy independent review, final SBOM/notice obligations, reproducible-build
provenance, static artifact admission, or host conformance.

HB-TC09 remains blocked until either:

1. a later exact stable release has attested source and binary assets, contains
   no denied or yanked locked dependency, and passes isolated native admission;
   or
2. KStack first designs and independently reviews a source-level remediation,
   then produces and binds its own reproducible build and distinct provenance
   before any host execution.

Only after one of those source paths clears may the dedicated Goose adapter,
the full protected per-operation fixture set, and HB-TC06's distinct-evidence
abstraction proof execute. OpenCode evidence cannot satisfy this row.
