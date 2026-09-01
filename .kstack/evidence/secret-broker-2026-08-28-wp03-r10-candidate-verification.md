# SB-WP03 R10 exact-candidate verification

This value-free companion record binds the exact committed candidate submitted
for independent R10 read-only review. It is self-excluded from that Git commit
because a record naming the commit cannot be contained by the commit it names.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Candidate binding

| Field | Bound value |
|---|---|
| Exact candidate Git commit | `a5b415d` (`a5b415d0fac920650d2ff320da621b45be945152`) |
| Candidate parent / prior reviewed candidate | `ec485b3e4f5a6bdb771b0595765584e5c2cc4217` |
| Original WP03 implementation commit | `4fd55a0728d5e20beb4779de2747da6f4b37820c` |
| Implementation parent/baseline | `486ddbd` |
| Implementation record SHA-256 | `9d8259761e56d58b427f943cfb59007b74af5e8d9985d794de64d2013ef9e395` |
| R9 repair verification SHA-256 | `98468723f884cff8d71e540a5e12fbc925324909b92fa04e124487b384edd4dd` |
| R9 review receipt SHA-256 | `aee4275585796eec233b1785a566b8f9487d8df55a59b3086dac6ef25e580f4c` |
| Local exclusions | owner-local `.kstack/config.json` `deploy: allow` change and superseded untracked R7 candidate record are not candidate content |

The standing WP03 review authorization applies; no new authorization question
is required.

## Exact candidate file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `07f2556b500341d973fd2e38ad635bc154ce7afccc2dd18d6d3aea9119437319` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `dd7a7247183796eac33dda5a8bbe233b701feff0a926df28f16004133f5a2f54` |
| `tests/secret-broker-protected-state.test.mjs` | `aca1d2c64227392feb02f875f18ee1cb40b6cef3f754480c7f481a3812e5e8ff` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `f1eae3a3993cf02f3b294b4d695ecbebd8b66f672bbc6f2d90ccc1957b9c2ca3` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `388da6ab40b896942c28ac30120ffdc610e44de02ba53000804bdcfa27f05c0c` |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `316352531d187322020ce23b698693af6f873303bb15477d71afefbc2e6347b1` |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` |
| `tests/reflexion-architecture-gate.mjs` | `c7ab9663ed4a64c49ce9f4029c84e5080e9319fdec3ac0db3665bb6f297b65e1` |
| `tests/install-health.test.mjs` | `bd233007b4d14b539ad7acaad538ac5a681d38d92b0b3442f764df0380f51030` |

## Current qualification

- Exact five-file focused matrix: 57/57 passed.
- Runtime-faithful architecture matrix: 9/9 passed.
- Secret Broker CLI matrix: 22 passed, zero failed, two expected skips.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, two expected
  environment-gated skips.
- Both generated-manifest checks and `git diff --check` passed.
- Commit `a5b415d` is published identically to `origin/Dev` and `origin/main`.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected
store, Jira credential, target, deployment, or secret value was contacted.

Independent R10 must reproduce this exact binding and return confidence at
least 93 with zero failed checks, security findings, material dissent, and
unresolved questions before WP03 can close.
