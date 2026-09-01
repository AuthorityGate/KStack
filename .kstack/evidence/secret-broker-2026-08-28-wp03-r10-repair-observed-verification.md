# SB-WP03 R10 repair observed verification

This value-free record binds the R10 findings, repair, and local verification.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Review result

| Field | Observed value |
|---|---|
| Exact reviewed candidate | `a5b415d0fac920650d2ff320da621b45be945152` |
| Review receipt | `.kstack/reviews/secret-broker-2026-08-28-wp03-r10/codex.md` |
| Receipt SHA-256 | `e32a1e5d765fc242c0a92a620ea3fe29ea6a4a20f338b92c779e01fa24374a76` |
| Decision / confidence | `revise / 99` |
| Open counters | failed checks 2; security findings 2; material dissent 0; unresolved questions 0 |

R10 reproduced same-realm mutation of array membership/iteration, set
membership, and regular-expression dispatch in security decisions. The probes
admitted unknown request fields, a caller-selected error code, and a
noncanonical update ID; one admitted advance consumed its update ID.

## Repair

- Control-plane validation captures `Array.prototype.some`,
  `Array.prototype.includes`, `Set.prototype.has`, and
  `RegExp.prototype.test` at module initialization and invokes them through the
  captured `Reflect.apply`.
- Protected-state record closure and state membership decisions likewise use
  captured array primitives.
- A post-import mutation regression exercises symbol and string unknown fields,
  caller-selected codes, and noncanonical update IDs, and proves a rejected
  advance leaves its issued update ID usable.

## Exact repaired file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `d04eff95636a825f5a637cce67fcbb8ceb916ba4f5efc764dd9daf24b035393b` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `c259eccae1f4b859c4fe19a3b068847828f0a50d1ec165b2d5528e057b4a7e7e` |
| `tests/secret-broker-protected-state.test.mjs` | `9a280bc6e8a2887e994b5a4dcd5a4f083d216489f2b8d1b598642a9e7b627bd3` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `7d4d1b7d944f809ac99d4def9a97650504ff8fe325f7c36e49b89d80f94ef0de` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `2033e0c35ab818cc72e15dfc7ab0f9ea124d7706d7dcdc3701935e66d0d87e00` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `4887c932eaaf7eadd47b31765b7dbbbd2927e91215c5d92dff4903d2fae64440` |
| `tests/reflexion-architecture-gate.mjs` | `cc0465a46007c7b7b812ce28f572ab8700d9e15f4ccdc11b9808f999c312b054` |

## Observed verification

- Exact five-file focused matrix: 57/57 passed; duration `21788.363488ms`.
- Runtime-faithful architecture matrix: 9/9 passed; duration `5658.464581ms`.
- Secret Broker CLI matrix: 24 total, 22 passed, zero failed, two expected
  environment-gated skips; duration `456.280697ms`.
- Full repository suite: 1,063 total, 1,061 passed, zero failed, two expected
  environment-gated skips; duration `75255.092903ms`.
- Release/source-audit and install-health generator checks passed.
- `git diff --check` passed.

The full run included the real native Windows PowerShell installer. No Jira,
credential, provider, protected effect, publication, deployment, or rollback
contact occurred. The synthetic adapter remains `SYNTHETIC_UNQUALIFIED` and
production-ineligible. Independent R11 must approve the exact committed repair
before WP03 closes.
