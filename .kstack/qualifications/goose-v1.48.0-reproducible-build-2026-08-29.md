# Goose `v1.48.0` reproducible-build qualification — 2026-08-29

**Jira item:** `hb-tc09-goose-host` / `KSTK-84`  
**Outcome:** `REPRODUCIBLE_RELEASE_BUILD_PASSES_REVIEW_REQUIRED`  
**Maximum claim:** two independent, clean-target, offline Linux release builds
produced byte-identical artifacts from independently reconstructed, identical
remediated source trees; no Goose execution, host admission, provider call,
credential use, adapter qualification, SBOM completion, or legal approval

## Bound source and replay order

The base input is the already attested Goose source archive and remediation
chain:

1. `goose-source-v1.48.0.tar.gz`, SHA-256
   `0d0d7314caa9f07755e57159a2c89031b4a1485bbf44ed52e493c30e25512173`,
   upstream commit `25021517f12cab87c94bed0874fe7d28168dc264`;
2. `goose-v1.48.0-lock-remediation-2026-08-29.patch`;
3. `goose-v1.48.0-license-remediation-2026-08-29.patch`;
4. unpack the exact crates.io archives into `vendor/deno_core` and
   `vendor/pctx_type_check_runtime`:
   - `deno_core-0.381.1.crate`, 326,514 bytes, SHA-256
     `77660b04f5368bcd69a42e0fdd6343e325eb781ec7d79bbf49ff2548ae4f17b6`;
   - `pctx_type_check_runtime-0.1.3.crate`, 1,877,819 bytes, SHA-256
     `cda6e59419494a65a7915ae4780708de2e72c70af21d68b7dfd64e1540c838cc`;
5. apply `goose-v1.48.0-reproducibility-remediation-2026-08-29.patch`,
   SHA-256
   `46f522127edf91296f20a41819882b200014d5e88b990c836368254fc64c86d1`.

The reproducibility patch is intentionally a source delta, not a substitute
for the two complete upstream crate archives. It applies cleanly with `patch
-p1`, changes only `Cargo.toml`, `Cargo.lock`, and one file in each staged
crate, and leaves locked metadata valid offline. The resulting source hashes
are:

| File | SHA-256 |
|---|---|
| `Cargo.toml` | `659cea26b609977cf423007eb8ebc76e16169491e526843135d6646bb3aa8ff6` |
| `Cargo.lock` | `cc55ae1fad9e84444f23a09ec76505c5996487e156fb173b5fa945a62c69287f` |
| `vendor/deno_core/modules/module_map_data.rs` | `5a5af7fc37862d308418f9c63b32a24192b6b823f216309d065fc376776ebd07` |
| `vendor/pctx_type_check_runtime/src/typescript.min.js` | `d8d4cca6d63086b4687b78f2a3f766a1d9ca79cef9958f502465b8910c8d6432` |

Each final source was reconstructed from a different preserved remediated
extraction at the same canonical path. A sorted manifest of lines
`sha256sum ./relative/path`, over all 2,519 regular files excluding `.git` and
`target`, hashes to
`0d2cb9b14a970aae67c27a9a2d1db2eaca12ce2e5b082e8441413de7bb240234`
for both trees. `diff -qr`, with those same exclusions, reports no difference.

## Root cause and bounded remediation

Two separate snapshot inputs were nondeterministic:

1. `deno_core 0.381.1` drained a randomized Rust `HashMap` directly into
   `ModuleMapSnapshotData.by_name`. The patch sorts the drained entries by
   module name and then by a total requested-module-type order, including the
   text of custom types.
2. `pctx_type_check_runtime 0.1.3` initialized TypeScript's performance
   `timeorigin` with `timestamp()` while constructing the V8 snapshot. The
   patch initializes the snapshotted value to zero. TypeScript's existing
   `enable()` path replaces it with the active runtime's
   `performance.timeOrigin` when measurement is enabled.

Before remediation, canonical-path clean builds differed first in serialized
module ordering. After the first fix, the general PCTX execution snapshots
matched, but the type-check snapshots differed in the snapshotted wall-clock
value. These negative controls localize both changes; they are not promoted as
release artifacts.

## Exact build envelope

Both final builds used empty, distinct target directories and the same
canonical source path. The exact command shape was:

```text
cargo build --locked --offline --release --package goose-cli --bin goose
```

Bound environment and tools:

- `rustc 1.93.1 (01f6ddf75 2026-02-11)`, LLVM 21.1.8;
- `cargo 1.93.1 (083ac5135 2025-12-15)`;
- CMake 3.28.3 and GNU ld 2.42;
- x86_64 Ubuntu 24.04 under WSL2;
- `CARGO_INCREMENTAL=0`, `SOURCE_DATE_EPOCH=0`, `TZ=UTC`,
  `LC_ALL=C.UTF-8`;
- `RUSTFLAGS=-C debuginfo=0 -C strip=symbols
  --remap-path-prefix=/tmp/kstack-goose-canonical-source=/usr/src/goose-v1.48.0`;
- the previously acquired `librusty_v8.a`, 169,586,332 bytes, SHA-256
  `62c711690504482da39e2d58e351fb22725d730151609c342757a35ad1ab7060`,
  supplied through `RUSTY_V8_ARCHIVE` to keep both builds offline;
- the same disposable, digest-bound CMake, libclang, Clang builtin-header, and
  runtime-library roots recorded in the license/source remediation evidence.

Build A completed in Cargo-reported 5m33s and build B in 5m27s. Duration is
descriptive only and is not part of the reproducibility predicate.

## Reproduced outputs

| Output | Build A SHA-256 | Build B SHA-256 | Result |
|---|---|---|---|
| PCTX execution snapshot | `e9b7c8e935c43c5562c7d28a3c9ebe1a0f10682cfee12705411b5f9311e8aafb` | same | byte-identical |
| PCTX type-check snapshot | `ae1dd363ea820c4de81bdbf792166e00e09810ea34278fcaad0adde6a97c7cfb` | same | byte-identical |
| `release/goose` | `057a1788b48cc1452203920afd31eac274d5b9cb10026734d587e5db33885792` | same | byte-identical |

Both final binaries are 253,305,256 bytes, mode 0755, stripped x86-64 ELF PIE
executables with identical GNU build ID
`a1c7aea9ef21faa9cfcc9c8634f8ea4916f9aa79`. `readelf` reports GNU RELRO
and an RW, non-executable GNU stack. `cmp --silent` passes for both snapshots
and the complete binaries.

## Non-promotion and remaining gates

This closes only the reproducible-build evidence requested by KSTK-84. The
binary was inspected statically and was not executed. KSTK-84 remains blocked
pending independent review of the exact remediation and threat model, final
SBOM/notices/corresponding-source and modified-file accounting, the dedicated
Goose adapter, isolated execution, protected per-operation conformance,
distinct HB-TC06 evidence, and the final KStack host-admission decision. No
OpenCode result substitutes for a Goose result.
