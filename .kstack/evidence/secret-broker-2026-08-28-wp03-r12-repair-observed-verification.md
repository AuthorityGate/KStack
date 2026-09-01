# SB-WP03 R12 repair observed verification

This value-free record binds the R12 findings, repair, and local verification.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Review result

| Field | Observed value |
|---|---|
| Exact reviewed candidate | `10426a4e8a900de43ac2d358662eff5343a5f74c` |
| Review receipt | `.kstack/reviews/secret-broker-2026-08-28-wp03-r12/codex.md` |
| Receipt SHA-256 | `f20588bb71ba185443573f27853aacd9adf35ecbc14123e1f9edbef4b29fcfa7` |
| Decision / confidence | `revise / 99` |
| Open counters | failed checks 6; security findings 3; material dissent 1; unresolved questions 0 |

R12 reproduced same-realm mutation inside imported canonicalization, parsing,
opaque-reference, and digest validation dependencies, plus inherited optional
update-ID fields through `Object.prototype`. The probes forged unrelated and
stale reconciliation outcomes, persisted noncanonical namespace metadata and a
malformed audit digest, and weakened update-ID and diagnostic policy.

## Repair

- The control plane owns a bounded canonical parser/encoder implemented from
  captured Buffer, JSON, TextDecoder, reflection, string, numeric, Set, and
  array-neutral ordering operations. Trust-bearing code no longer delegates to
  the mutable shared host canonicalizer or public opaque-reference validator.
- Opaque references, digests, timestamps, update IDs, hashing, and randomness
  use captured operations throughout the authority call graph.
- The synthetic adapter uses the hardened canonical boundary for protected
  reads, writes, clones, comparisons, and public status bytes; captures random
  and default-clock operations; and removes iterable-dependent object freezing.
- Optional update-ID fields are read only when present as own properties.
- Post-import regressions cover array map/sort/join, Buffer conversion/equality,
  parser and regular-expression mutation, unrelated/stale reconciliation,
  noncanonical opaque references, malformed digests, prototype pollution, and
  non-consumption on rejection.

## Exact repaired file identities

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `9f6c63dcce4a7db6ce12db76bac2d82e5139a578c832a37be09c6c658d7ddb79` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `d9c2317cbe31dce3e853ac28cc08e77cf234777bb8ac005e69abc38d72ec3d81` |
| `tests/secret-broker-protected-state.test.mjs` | `14d9dc038e207fec595ca97860fadf1a074fe9d33e7570e2c3552051a4167b84` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `7ba595c56ad48b7f44307185d6e060cd2955fdb4c1a1c1c2c782e829dd9785be` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `d77a25727190440d0cacc8685f80ab14b30b91db3e51a4ee0abce4a02147e370` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `3cc68ae48fe9ea5ff9a4614c13c0adb7c20db619ca52fdf7d277c0f1ca565d2f` |
| `tests/reflexion-architecture-gate.mjs` | `f067f7d384c33de1a48d4863b8121be10c182c766e126b7fc9087547c8143e1b` |

## Observed verification

- Exact five-file focused matrix: 57/57 passed; duration `23981.62453ms`.
- Runtime-faithful architecture matrix: 9/9 passed; duration `8435.794405ms`.
- Secret Broker CLI matrix: 24 total, 22 passed, zero failed, two expected
  environment-gated skips; duration `740.532626ms`.
- Full repository suite: 1,063 total, 1,061 passed, zero failed, two expected
  environment-gated skips; duration `132735.496805ms`.
- Release/source-audit and install-health generator checks passed.
- `git diff --check` passed.

The full run included the real native Windows PowerShell installer. No Jira,
credential, provider, protected effect, publication, deployment, or rollback
contact occurred. The synthetic adapter remains `SYNTHETIC_UNQUALIFIED` and
production-ineligible. Independent R13 must approve the exact committed repair
before WP03 closes.
