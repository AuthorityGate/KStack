# Goose `v1.48.0` license/source remediation — 2026-08-29

**Jira item:** `hb-tc09-goose-host` / `KSTK-84`  
**Outcome:** `LICENSE_SOURCE_POLICY_PASSES_REVIEW_REQUIRED`  
**Maximum claim:** deterministic source-remediation and technical policy
feasibility only; no release artifact, Goose execution, adapter qualification,
provider call, credential use, or host support

## Bound inputs and order

The input is the exact attested Goose source archive with SHA-256
`0d0d7314caa9f07755e57159a2c89031b4a1485bbf44ed52e493c30e25512173`.
First apply the advisory/lock patch
`goose-v1.48.0-lock-remediation-2026-08-29.patch`, producing lock SHA-256
`e7390d3621d5f6779ad0fbb1838bb65e8180a579f16514ded1be3e07b761c568`.
Then apply
`goose-v1.48.0-license-remediation-2026-08-29.patch`, whose SHA-256 is
`2b1357c69b6cacd699da383a83729b97588418afa1d4b7f47ecd2767a1284bed`.

The second patch applies cleanly to a separate fresh extraction after the first
patch. It deterministically produces:

| File | SHA-256 |
|---|---|
| `Cargo.toml` | `4d385694612dc66c7404e676c1e06c250524280350dd4fef39a7dcf081103de3` |
| `Cargo.lock` | `608ffdc6da031822ce5257e27bf756bc7e44151993cec6631e2938d25b41d807` |
| `vendor/v8/Cargo.toml` | `5e6b0c39afe1ffb4695d5de552904ae71248210d200a0c1503f2563befcff29c` |
| compatibility manifest | `54ce76e08511b4a7460aa3082263d83b9ad99b2bad4e97eda66ac551a97b4171` |
| compatibility implementation | `ce2f1815e454e8fad46cf03aa456bd932e7c2b3dce92164393166a4bb094b5f0` |

## Exact defect and remediation

The default-feature Linux CLI reaches `ansi_colours 1.2.3` only through
`goose-cli → bat 0.26.1 → ansi_colours 1.2.3`. Bat's dependency is
unconditional; changing its regex engine cannot remove the LGPL-3.0-or-later
package. Bat calls one public API from it: RGB-to-xterm-256 conversion.

The patch supplies a KStack-authored Apache-2.0 compatibility crate containing
only that one API. The implementation independently selects the nearest color
in the standard xterm 6×6×6 cube or 24-step grayscale ramp using squared
Euclidean RGB distance. No source from the rejected LGPL implementation was
copied. Cargo's explicit path override makes this source-visible in the lock
and build graph. The patch also sets `license.workspace = true` on Goose's
two-line local `vendor/v8` forwarding wrapper, explicitly recording the
repository's Apache-2.0 license in package metadata.

## Policy and reproduced gates

The governing technical policy is
`plugins/kstack/references/HOST_DEPENDENCY_ADMISSION.md`, SHA-256
`07c95913ca07de5911140500b8467d6d3d4464b7c0e59b5bba62740abc70b4a2`.
The exact Goose instantiation is
`goose-v1.48.0-kstack-deny-2026-08-29.toml`, SHA-256
`74c9ca5b6f7c18ece47beebd4210b12246fbdb02ca4bec00525e34f62f158dfc`.
It binds x86_64 Linux, denies unknown registries and Git repositories, permits
only crates.io plus the exact reviewed ACP repository, carries no advisory
ignore, checks private/path packages, and uses an explicit SPDX allowlist.

Reproduced results:

| Gate | Result |
|---|---|
| Patch applies to independent fresh exact source | pass; all five resulting file hashes match |
| `cargo test --locked --package ansi_colours` | 2 passed, 0 failed; doc tests 0 failed |
| `cargo metadata --locked --no-deps --format-version 1` | exit 0 |
| `cargo deny check --config … advisories licenses sources` | `advisories ok, licenses ok, sources ok`; no warning or exception |
| resolved `ansi_colours` metadata | local path, version 1.2.3, Apache-2.0 |
| resolved local `v8` wrapper metadata | local path, version 145.0.0, Apache-2.0 |
| `cargo check --locked --package goose-cli` | exit 0; default-feature `goose-cli v1.48.0` compiled |

The full compile used the same disposable Ubuntu Noble Clang/CMake packages
already digest-bound in the earlier remediation-feasibility record. The final
successful invocation explicitly bound the extracted Clang builtin headers,
libclang directory, CMake root, and CMake runtime library directory. No package
was installed and Goose was not executed.

## Non-promotion and remaining gates

This passes the technical source/license policy for the remediated source tree;
it is not a legal opinion or a release qualification. MPL-2.0 dependencies
still require the final SBOM, notice bundle, corresponding-source retrieval
data, and modified-file accounting required by the governing policy.

KSTK-84 remains blocked pending independent review of both patches and the
clean-room threat model, two independently matching reproducible release-build
digests with KStack-owned provenance, SBOM/notices, static artifact admission,
isolated execution, the dedicated Goose adapter and protected conformance, and
distinct HB-TC06 evidence. No OpenCode evidence can satisfy those gates.
