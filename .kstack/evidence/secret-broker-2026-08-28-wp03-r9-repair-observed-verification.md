# SB-WP03 R9 repair observed verification

This value-free record describes the repair and local observations made after
the independent R9 read-only review. It contains no credential, protected
source, Jira response, provider payload, private OS state, or model-visible
secret.

## Review result

| Field | Observed value |
|---|---|
| Exact reviewed candidate | `ec485b3e4f5a6bdb771b0595765584e5c2cc4217` |
| Review receipt | `.kstack/reviews/secret-broker-2026-08-28-wp03-r9/codex.md` |
| Receipt SHA-256 | `aee4275585796eec233b1785a566b8f9487d8df55a59b3086dac6ef25e580f4c` |
| Decision / confidence | `revise / 99` |
| Open counters | failed checks 3; security findings 2; material dissent 0; unresolved questions 0 |

R9 reproduced fixed-error construction intercepted by exported error-
prototype setters, internal trust in mutable exported `Symbol.hasInstance`,
and acceptance of unknown symbol/non-enumerable request fields.

## Repair

- Both exported fixed-error classes install own `name`, `message`, and `code`
  data properties through captured descriptor operations, bypassing hostile
  prototype accessors.
- Protected-state internal error provenance is held in a module-private
  `WeakMap`; no internal path classifies an exported error with `instanceof`.
- Raw storage/runtime failures cannot become trusted by mutating the exported
  class and are reduced to the applicable fixed protected-state error.
- Open, advance, and audit-writer records are captured once through own
  descriptors and `Reflect.ownKeys`; accessors, symbols, non-enumerable fields,
  unknown fields, and non-plain records are rejected before state access or
  update-ID consumption.
- Regressions directly mutate both exported error prototypes and
  `SyntheticProtectedStateError[Symbol.hasInstance]`, inject a raw storage
  diagnostic, and submit symbol/non-enumerable fields to all three request
  boundaries.

## Exact repaired file identities

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

## Observed verification

- Exact five-file focused matrix: 57 tests, 57 passed, zero failed or skipped;
  duration `21807.206871ms`.
- Runtime-faithful architecture matrix: 9 tests, 9 passed, zero failed or
  skipped; duration `5727.784043ms`.
- Secret Broker CLI matrix: 24 tests, 22 passed, zero failed, and two expected
  environment-gated skips; duration `506.164035ms`.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, and two
  expected environment-gated skips; duration `79996.262578ms`.
- Release/source-audit and install-health generators passed deterministic
  regeneration followed by `--check`.
- `git diff --check` passed.

The two skips remain the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The full run included the real native
Windows PowerShell installer. No Jira, credential, provider, protected effect,
publication, deployment, or rollback contact occurred. The synthetic adapter
remains `SYNTHETIC_UNQUALIFIED` and production-ineligible.

Independent R10 must reproduce the exact committed repair and satisfy the WP03
exit gate before this work package can close.
