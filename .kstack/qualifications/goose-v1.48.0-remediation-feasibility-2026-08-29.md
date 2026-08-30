# Goose `v1.48.0` remediation feasibility — 2026-08-29

**Jira item:** `hb-tc09-goose-host` / `KSTK-84`  
**Outcome:** `REMEDIATION_COMPILES_REVIEW_REQUIRED`  
**Maximum claim:** deterministic source-remediation feasibility only; no Goose
execution, adapter qualification, provider call, credential use, or host support

## Bound source and defect

The input is the exact GitHub-attested `goose-source-v1.48.0.tar.gz` archive
already recorded in
`goose-v1.48.0-requalification-2026-08-29.md`:

- archive SHA-256:
  `0d0d7314caa9f07755e57159a2c89031b4a1485bbf44ed52e493c30e25512173`;
- original `Cargo.lock` SHA-256:
  `abd7e083ec3331804b1962dacec786832194322c32f3d415db743e21beb3948a`;
- original source commit:
  `25021517f12cab87c94bed0874fe7d28168dc264`.

The published lock contains two independently reproducible defects:

1. `chacha20 0.10.1` is yanked and rejected by the repository's configured
   `cargo deny check advisories` gate.
2. The local workspace package `crates/goose-roaming/Cargo.toml` is version
   `1.48.0`, while the published lock records that package as `1.47.0`.
   Cargo repairs this stale local-package entry during the same exact update.

## Minimal deterministic remediation

Apply
`goose-v1.48.0-lock-remediation-2026-08-29.patch` to the root of the exact
attested source tree. The patch changes only three semantic lock entries:

- `chacha20 0.10.1` to non-yanked `0.10.2`;
- the corresponding crates.io checksum and `rand 0.10.2` dependency reference;
- stale local workspace `goose-roaming 1.47.0` to the source-declared `1.48.0`.

Equivalent resolver command:

```text
cargo update -p chacha20@0.10.1 --precise 0.10.2
```

The resulting `Cargo.lock` SHA-256 is
`e7390d3621d5f6779ad0fbb1838bb65e8180a579f16514ded1be3e07b761c568`.
No manifest, Rust source, workflow, policy, or vendored file changed.

## Reproduced gates

Toolchain and bounded results:

| Gate | Exact result |
|---|---|
| Rust | `rustc 1.96.1 (31fca3adb 2026-06-26)` |
| Cargo | `cargo 1.96.1 (356927216 2026-06-26)` |
| Auditor | `cargo-deny 0.19.4` |
| `cargo deny check advisories` | exit 0; `advisories ok`; configured ignored advisory was not encountered |
| `cargo metadata --locked --no-deps --format-version 1` | exit 0; 16 packages and 16 workspace members |
| `cargo check --locked --package goose-cli` | exit 0; default-feature `goose-cli v1.48.0` compile completed |

The compile used only disposable, locally extracted Ubuntu Noble packages
because the WSL image lacked runner-provided Clang and CMake. Nothing was
installed into the operating system:

- `libclang1-18 18.1.3-1ubuntu1` package SHA-256
  `1ed67106d743ab4f12db2726c5fc11c436c5e1fba613e9f1006bf3fa05cc69bd`;
- `libllvm18 18.1.3-1ubuntu1` package SHA-256
  `af6197096ce3b89aab86de59f01c1b5feb008b2ae1514a03906c0664edb8b0b1`;
- `libclang-common-18-dev 18.1.3-1ubuntu1` package SHA-256
  `d41631bb752815a8196261d1030c096591c59678c8adfbf2e6a740a691b49e80`;
- `cmake 3.28.3-1build7` package SHA-256
  `4b0a7f8c0daf27b26b46997d994ae5d1ee7a3d11dfcda9f7627bb1462c162295`;
- `cmake-data 3.28.3-1build7` package SHA-256
  `20a3b644211ce82f35c24f1f5052199adeb0ac159978a8740fd6c0959611557f`.

The upstream repository configures only `check advisories` in
`.github/workflows/cargo-deny.yml`. A deliberately broader `cargo deny check`
does not constitute a release-policy pass: the repository has no license
allowlist section, so cargo-deny rejects otherwise common licenses, while its
source and duplicate lanes are advisory. KStack must define and review its own
explicit license/source admission policy instead of silently treating absent
upstream configuration as approval.

## Remaining gates

This feasibility result does not admit a KStack binary or permit Goose
execution. KSTK-84 remains blocked until all of the following are complete:

1. independent review approves the exact patch and KStack source-build threat
   model;
2. the explicit KStack technical license/source policy and remediated closure
   pass as recorded in
   `goose-v1.48.0-license-source-remediation-2026-08-29.md`; independent review
   and final SBOM/notice/corresponding-source artifact evidence remain required;
3. a reproducible release build produces KStack-owned provenance and two
   independently matching artifact digests;
4. static admission passes for that exact artifact;
5. the dedicated Goose adapter and full protected per-operation conformance
   execute with evidence distinct from OpenCode;
6. HB-TC06's second-host proof consumes only those separately admitted results.

The runtime-maturity report remains deferred until those and every other
focused row close.
