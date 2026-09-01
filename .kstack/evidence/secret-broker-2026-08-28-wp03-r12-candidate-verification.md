# SB-WP03 R12 exact-candidate verification

This value-free companion record binds the exact committed candidate submitted
for independent R12 read-only review. It is self-excluded from that Git commit
because a record naming the commit cannot be contained by the commit it names.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Candidate binding

| Field | Bound value |
|---|---|
| Exact candidate Git commit | `10426a4` (`10426a4e8a900de43ac2d358662eff5343a5f74c`) |
| Candidate parent / prior reviewed candidate | `15d4fad4052b6f78340b828806e2919ce2bc3b66` |
| Original WP03 implementation commit | `4fd55a0728d5e20beb4779de2747da6f4b37820c` |
| Implementation parent/baseline | `486ddbd` |
| Implementation record SHA-256 | `1ddce5dcffac614accfe523bbe0d4eb0d6a1b4fde54708778889dd7eb12f3886` |
| R11 repair verification SHA-256 | `b51d119f5aaa4293f084ad52f73b484bdf64cc5a8dc1ac85c313f57e11f762fd` |
| R11 review receipt SHA-256 | `1b27496cecd90f536bdfe1f67a97e5d9627ed14c95cefca2e499ad17a82ce023` |
| Local exclusions | owner-local `.kstack/config.json` `deploy: allow` change and superseded untracked R7 candidate record are not candidate content |

The standing WP03 review authorization applies; no new authorization question
is required.

## Exact candidate file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `bfaddd054ffbab988ea53d61415bc0bd917a3ba863cdd61f5120c9711bf6d527` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `ba3798cd41daf90cb01bc0ee5d296eba6a7180736868c5116322b8d48390c01f` |
| `tests/secret-broker-protected-state.test.mjs` | `aff18c6645144d6627d51a9c12ef8235ce7bdda89303e7f0bb69a752925b3b8e` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `44aa50e5f80d508ab3f5c85e524dca31332bb7b6a71358e7359c88d2b078f2dd` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `160b195609359d1a21bc81a65509a28329c30774f0b693db512e767d807afbaf` |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `5a4a4353f71aaf900e9b9e2283ce8978f41abde7f9bb97cc5389aa3a77df4b83` |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` |
| `tests/reflexion-architecture-gate.mjs` | `b7e37590d49e158488d09978c44cb823226d4bb14f63c1a7bb03e3fcc9bf2db7` |
| `tests/install-health.test.mjs` | `bd233007b4d14b539ad7acaad538ac5a681d38d92b0b3442f764df0380f51030` |

## Current qualification

- Exact five-file focused matrix: 57/57 passed.
- Runtime-faithful architecture matrix: 9/9 passed.
- Secret Broker CLI matrix: 22 passed, zero failed, two expected skips.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, two expected
  environment-gated skips.
- Both generated-manifest checks and `git diff --check` passed.
- Commit `10426a4` is published identically to `origin/Dev` and `origin/main`.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected
store, Jira credential, target, deployment, or secret value was contacted.

Independent R12 must reproduce this exact binding and return confidence at
least 93 with zero failed checks, security findings, material dissent, and
unresolved questions before WP03 can close.
