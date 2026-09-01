# SB-WP03 R13 exact-candidate verification

This value-free companion record binds the exact committed candidate submitted
for independent R13 read-only review. It is self-excluded from that Git commit
because a record naming the commit cannot be contained by the commit it names.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Candidate binding

| Field | Bound value |
|---|---|
| Exact candidate Git commit | `613181c` (`613181cf69ac0df207aac2fbc9f17788294e4b16`) |
| Candidate parent / prior reviewed candidate | `10426a4e8a900de43ac2d358662eff5343a5f74c` |
| Original WP03 implementation commit | `4fd55a0728d5e20beb4779de2747da6f4b37820c` |
| Implementation parent/baseline | `486ddbd` |
| Implementation record SHA-256 | `e01f663342204655f1310259f4302c611c1e0ebfcaddc8d9c6b6108407e0841e` |
| R12 repair verification SHA-256 | `3df442b29b78f506f0ec73acd563622ad9590837f6f4d93165cb386e5e485431` |
| R12 review receipt SHA-256 | `f20588bb71ba185443573f27853aacd9adf35ecbc14123e1f9edbef4b29fcfa7` |
| Local exclusions | owner-local `.kstack/config.json` `deploy: allow` change and superseded untracked R7 candidate record are not candidate content |

The standing WP03 review authorization applies; no new authorization question
is required.

## Exact candidate file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `9f6c63dcce4a7db6ce12db76bac2d82e5139a578c832a37be09c6c658d7ddb79` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `d9c2317cbe31dce3e853ac28cc08e77cf234777bb8ac005e69abc38d72ec3d81` |
| `tests/secret-broker-protected-state.test.mjs` | `14d9dc038e207fec595ca97860fadf1a074fe9d33e7570e2c3552051a4167b84` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `7ba595c56ad48b7f44307185d6e060cd2955fdb4c1a1c1c2c782e829dd9785be` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `d77a25727190440d0cacc8685f80ab14b30b91db3e51a4ee0abce4a02147e370` |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `3cc68ae48fe9ea5ff9a4614c13c0adb7c20db619ca52fdf7d277c0f1ca565d2f` |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` |
| `tests/reflexion-architecture-gate.mjs` | `f067f7d384c33de1a48d4863b8121be10c182c766e126b7fc9087547c8143e1b` |
| `tests/install-health.test.mjs` | `bd233007b4d14b539ad7acaad538ac5a681d38d92b0b3442f764df0380f51030` |

## Current qualification

- Exact five-file focused matrix: 57/57 passed.
- Runtime-faithful architecture matrix: 9/9 passed.
- Secret Broker CLI matrix: 22 passed, zero failed, two expected skips.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, two expected
  environment-gated skips.
- Both generated-manifest checks and `git diff --check` passed.
- Commit `613181c` is published identically to `origin/Dev` and `origin/main`.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected
store, Jira credential, target, deployment, or secret value was contacted.

Independent R13 must reproduce this exact binding and return confidence at
least 93 with zero failed checks, security findings, material dissent, and
unresolved questions before WP03 can close.
