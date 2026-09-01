# SB-WP03 R8 repair observed verification

This value-free record describes the repair and local observations made after
the independent R8 read-only review. It contains no credential, protected
source, Jira response, provider payload, private OS state, or model-visible
secret.

## Review result

| Field | Observed value |
|---|---|
| Exact reviewed candidate | `b64fd77b58aec98f0e27002486fc0cf1bcc52e4b` |
| R8 candidate packet SHA-256 | `a1ca51fa10fc0183bef807a7094365dce8a70f342216d0cb59af2182a983f03a` |
| Review receipt | `.kstack/reviews/secret-broker-2026-08-28-wp03-r8/codex.md` |
| Receipt SHA-256 | `49e0d25b95f8f1b9201cb5e2f9b08d6bd4631d1dcc10bd90f95b740071d74d75` |
| Decision / confidence | `revise / 99` |
| Open counters | failed checks 3; security findings 2; material dissent 0; unresolved questions 0 |

R8 reproduced mutable exported prototype and `Symbol.hasInstance` paths that
could forge snapshot status or expose a raw private-field error. It also
corrected the R8 packet's named five-file matrix from 65 tests to 57; that
reviewed packet is retained unchanged as exact historical input, while this
record and the implementation record carry the correction.

## Repair

- The genuine adapter status/private-field brand operation and `Reflect.apply`
  are captured in inaccessible module-private bindings.
- Snapshot authentication performs that captured private-field operation and
  no longer consults mutable public `instanceof` behavior.
- A caught status failure is reduced to its code inside a guarded read and is
  reconstructed as a fresh fixed error only when the code belongs to the
  closed snapshot-status allowlist; every other failure becomes
  `KSTACK_SECRET_PROTECTED_ADAPTER_INVALID`.
- The internal status result must have the exact three-field shape and fixed
  profile, production eligibility, and readiness state before canonical bytes
  are emitted.
- Regressions mutate the exported prototype method, its public `.call`
  property, both exported classes' `Symbol.hasInstance` behavior, and a proxy
  around a genuine adapter. Plain objects and proxy wrappers cannot pass the
  brand operation, forged status is not encoded, and raw diagnostics do not
  escape.

## Exact repaired file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `a2e2da05fb21077b01835d1f3c1cbdbc1e6d8e7bc194885313e9dc60e4af02e4` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `2944cebfdd1671c9835230297c828eaaa34bd2b01d70fe7353f3833efa868d0f` |
| `tests/secret-broker-protected-state.test.mjs` | `0bfa6f2cd54e1354be61e1ef3a8800cfe95ae50a232e79bd5a4f3b5b40df8f35` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `3c910f633499d3ba3130f1e390495d122220b8b5056d7e9c37c7043a776c15e9` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `3f85858f89ea21fea4889b3233d2bf74ee540293385c3ec04ab49465adbf994f` |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `98e6c693399894f772a9b72ddefa1955f738dc607468bce4e22ecbb9312b6cc1` |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` |
| `tests/reflexion-architecture-gate.mjs` | `f6aeb63aef269825d5b5dd61afca5a61ff25f0afab06fe5e3f6f2e4dee301769` |
| `tests/install-health.test.mjs` | `bd233007b4d14b539ad7acaad538ac5a681d38d92b0b3442f764df0380f51030` |

## Observed verification

- Exact five-file focused matrix: 57 tests, 57 passed, zero failed or skipped;
  duration `22153.295481ms`.
- Runtime-faithful architecture matrix: 9 tests, 9 passed, zero failed or
  skipped; duration `5638.911579ms`.
- Secret Broker CLI matrix: 24 tests, 22 passed, zero failed, and two expected
  environment-gated skips; duration `460.985713ms`.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, and two
  expected environment-gated skips; duration `86562.202941ms`.
- Release/source-audit and install-health generators passed deterministic
  regeneration followed by `--check`.
- `git diff --check` passed after documentation finalization.

The two skips remain the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The full run included the real native
Windows PowerShell installer. No Jira, credential, provider, protected effect,
publication, deployment, or rollback contact occurred. The synthetic adapter
remains `SYNTHETIC_UNQUALIFIED` and production-ineligible.

Independent R9 must reproduce the exact committed repair and satisfy the WP03
exit gate before this work package can close.
