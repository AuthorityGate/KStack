# SB-WP03 R11 exact-candidate verification

This value-free companion record binds the exact committed candidate submitted
for independent R11 read-only review. It is self-excluded from that Git commit
because a record naming the commit cannot be contained by the commit it names.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Candidate binding

| Field | Bound value |
|---|---|
| Exact candidate Git commit | `15d4fad` (`15d4fad4052b6f78340b828806e2919ce2bc3b66`) |
| Candidate parent / prior reviewed candidate | `a5b415d0fac920650d2ff320da621b45be945152` |
| Original WP03 implementation commit | `4fd55a0728d5e20beb4779de2747da6f4b37820c` |
| Implementation parent/baseline | `486ddbd` |
| Implementation record SHA-256 | `0251170bb5b69c354e5d6e26f90d1aaf3b40755eba36657ee7b95bbcba6eaf6e` |
| R10 repair verification SHA-256 | `f1f014f3dbd264337e437ab4dd2db7f6a81d0445fb38d6016aa982d0274f5f82` |
| R10 review receipt SHA-256 | `e32a1e5d765fc242c0a92a620ea3fe29ea6a4a20f338b92c779e01fa24374a76` |
| Local exclusions | owner-local `.kstack/config.json` `deploy: allow` change and superseded untracked R7 candidate record are not candidate content |

The standing WP03 review authorization applies; no new authorization question
is required.

## Exact candidate file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `d04eff95636a825f5a637cce67fcbb8ceb916ba4f5efc764dd9daf24b035393b` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `c259eccae1f4b859c4fe19a3b068847828f0a50d1ec165b2d5528e057b4a7e7e` |
| `tests/secret-broker-protected-state.test.mjs` | `9a280bc6e8a2887e994b5a4dcd5a4f083d216489f2b8d1b598642a9e7b627bd3` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `7d4d1b7d944f809ac99d4def9a97650504ff8fe325f7c36e49b89d80f94ef0de` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `2033e0c35ab818cc72e15dfc7ab0f9ea124d7706d7dcdc3701935e66d0d87e00` |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `4887c932eaaf7eadd47b31765b7dbbbd2927e91215c5d92dff4903d2fae64440` |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` |
| `tests/reflexion-architecture-gate.mjs` | `cc0465a46007c7b7b812ce28f572ab8700d9e15f4ccdc11b9808f999c312b054` |
| `tests/install-health.test.mjs` | `bd233007b4d14b539ad7acaad538ac5a681d38d92b0b3442f764df0380f51030` |

## Current qualification

- Exact five-file focused matrix: 57/57 passed.
- Runtime-faithful architecture matrix: 9/9 passed.
- Secret Broker CLI matrix: 22 passed, zero failed, two expected skips.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, two expected
  environment-gated skips.
- Both generated-manifest checks and `git diff --check` passed.
- Commit `15d4fad` is published identically to `origin/Dev` and `origin/main`.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected
store, Jira credential, target, deployment, or secret value was contacted.

Independent R11 must reproduce this exact binding and return confidence at
least 93 with zero failed checks, security findings, material dissent, and
unresolved questions before WP03 can close.
