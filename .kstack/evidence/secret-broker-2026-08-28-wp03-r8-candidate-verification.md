# SB-WP03 R8 exact-candidate verification

This value-free record binds the exact committed candidate submitted for the
independent R8 read-only review. It contains no credential, protected source,
Jira response, provider payload, private OS state, or model-visible secret.

## Candidate binding

| Field | Bound value |
|---|---|
| Exact candidate Git commit | `b64fd77` (`b64fd77b58aec98f0e27002486fc0cf1bcc52e4b`) |
| WP03 implementation commit | `4fd55a0` (`4fd55a0728d5e20beb4779de2747da6f4b37820c`) |
| Implementation parent/baseline | `486ddbd` |
| Implementation record SHA-256 | `61af4f411cd7f6ffc192ab76ce428456febd17ecf6f3193d3f8814726fbaabf9` |
| R7 repair verification SHA-256 | `188cfc9ee8d297e4b6928cf978718b1af3d49a808124e4539a2ecc6019557260` |
| R7 review receipt SHA-256 | `d028dd1cfbbfccca0f5fb1d22c7c933878e8bd4adfa902bc845dd712ca0d9f9f` |
| Local exclusions | owner-local `.kstack/config.json` `deploy: allow` change and superseded untracked R7 candidate record are not candidate content |

The exact candidate includes the R7 repair, its adversarial regressions,
deterministically regenerated release/source/install-health manifests, the R7
review receipt, and the value-free repair record. The standing review
authorization applies; no new authorization question is required.

## Exact candidate file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `a2e2da05fb21077b01835d1f3c1cbdbc1e6d8e7bc194885313e9dc60e4af02e4` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `e504387c854002c45c20cca71d522798131eff0c3be68ad62fd24b5c9376938b` |
| `tests/secret-broker-protected-state.test.mjs` | `311e2ba6c6909866e8148d796423efd4d4b3777554780720d4a64f034df83920` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `91cd0499261da863d855117b6fdc489a7010aa5de1733279f5161f95e9b6d251` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `92cdedefd028afe0f2109f352ad322044270ec647e0d554251969540051e7b1e` |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `c391a0c4fe209f391c28bf21aa20614f4740b394c93623703fba542e0d994602` |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` |
| `tests/reflexion-architecture-gate.mjs` | `0ab2092ec6834941d49c366ae18a196c234647e67c02d04efa3a7d77b5ccfff5` |
| `tests/install-health.test.mjs` | `bd233007b4d14b539ad7acaad538ac5a681d38d92b0b3442f764df0380f51030` |

## Current qualification

- Focused protected-state matrix: 11/11 passed.
- Combined WP03, release, install-health, architecture, and safety matrix:
  65/65 passed with zero failures or skips.
- Secret Broker CLI matrix: 22 passed, zero failed, two expected skips.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, two expected
  environment-gated skips.
- Runtime-faithful architecture matrix: 9/9 passed.
- Both generated-manifest checks and `git diff --check` passed.
- Commit `b64fd77` is published identically to `origin/Dev` and `origin/main`.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected
store, Jira credential, target, deployment, or secret value was contacted.

Independent R8 must reproduce this exact binding and return confidence at least
93 with zero failed checks, security findings, material dissent, and unresolved
questions before WP03 can close.
