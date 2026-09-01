# SB-WP03 R11 repair observed verification

This value-free record binds the R11 findings, repair, and local verification.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Review result

| Field | Observed value |
|---|---|
| Exact reviewed candidate | `15d4fad4052b6f78340b828806e2919ce2bc3b66` |
| Review receipt | `.kstack/reviews/secret-broker-2026-08-28-wp03-r11/codex.md` |
| Receipt SHA-256 | `1b27496cecd90f536bdfe1f67a97e5d9627ed14c95cefca2e499ad17a82ce023` |
| Decision / confidence | `revise / 99` |
| Open counters | failed checks 4; security findings 3; material dissent 1; unresolved questions 0 |

R11 reproduced same-realm mutation of Buffer conversion/comparison, integer
validation, trusted-time parsing, and array lookup/transformation operations in
authority decisions. The probes admitted a noncanonical update ID and a
fractional epoch, let an expired audit writer advance, made a stale snapshot
ready, and reported an unrelated authority head committed.

## Repair

- Control-plane validation captures Buffer conversion/comparison, integer
  validation, string slicing, object freezing, and adjacent reflection
  operations at module initialization and safely invokes them through the
  captured `Reflect.apply`.
- Protected-state validation and transitions capture the implicated Buffer,
  Date, Number, Array, and Object operations. Indexed module-private copies
  replace trust-bearing array spread and iterator use.
- Post-import mutation regressions prove noncanonical IDs and fractional epochs
  are rejected, expired writers cannot advance, stale snapshots cannot become
  ready, unrelated heads cannot become committed, and authority transformations
  remain deterministic.

## Exact repaired file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `bfaddd054ffbab988ea53d61415bc0bd917a3ba863cdd61f5120c9711bf6d527` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `ba3798cd41daf90cb01bc0ee5d296eba6a7180736868c5116322b8d48390c01f` |
| `tests/secret-broker-protected-state.test.mjs` | `aff18c6645144d6627d51a9c12ef8235ce7bdda89303e7f0bb69a752925b3b8e` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `44aa50e5f80d508ab3f5c85e524dca31332bb7b6a71358e7359c88d2b078f2dd` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `160b195609359d1a21bc81a65509a28329c30774f0b693db512e767d807afbaf` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `5a4a4353f71aaf900e9b9e2283ce8978f41abde7f9bb97cc5389aa3a77df4b83` |
| `tests/reflexion-architecture-gate.mjs` | `b7e37590d49e158488d09978c44cb823226d4bb14f63c1a7bb03e3fcc9bf2db7` |

## Observed verification

- Exact five-file focused matrix: 57/57 passed; duration `21798.642886ms`.
- Runtime-faithful architecture matrix: 9/9 passed; duration `5492.328136ms`.
- Secret Broker CLI matrix: 24 total, 22 passed, zero failed, two expected
  environment-gated skips; duration `467.614082ms`.
- Full repository suite: 1,063 total, 1,061 passed, zero failed, two expected
  environment-gated skips; duration `75757.979231ms`.
- Release/source-audit and install-health generator checks passed.
- `git diff --check` passed.

The full run included the real native Windows PowerShell installer. No Jira,
credential, provider, protected effect, publication, deployment, or rollback
contact occurred. The synthetic adapter remains `SYNTHETIC_UNQUALIFIED` and
production-ineligible. Independent R12 must approve the exact committed repair
before WP03 closes.
