# SB-WP03 R7 repair observed verification

This value-free record describes the repair and local observations made after
the independent R7 read-only review. It contains no credential, protected
source, Jira response, provider payload, private OS state, or model-visible
secret.

## Review result

| Field | Observed value |
|---|---|
| Review receipt | `.kstack/reviews/secret-broker-2026-08-28-wp03-r7/codex.md` |
| Receipt SHA-256 | `d028dd1cfbbfccca0f5fb1d22c7c933878e8bd4adfa902bc845dd712ca0d9f9f` |
| Decision / confidence | `revise / 99` |
| Open counters | failed checks 2; security findings 2; material dissent 0; unresolved questions 0 |

R7 reproduced a stateful-accessor time-of-check / time-of-use bypass in the
authority and audit head validators. It also reproduced raw diagnostic escapes
through hostile update-ID options and snapshot-adapter prototype reflection.

## Repair

- Caller-supplied authority and audit records are snapshotted exactly once from
  their own property descriptors inside the fixed-error boundary.
- Only plain, closed records of enumerable data properties are accepted;
  accessors and inconsistent proxy reflection are rejected before validation.
- Validators return a frozen validated snapshot, and codecs, digests,
  successors, and reconciliation consume only that stable record.
- Update-ID option inspection occurs inside the fixed boundary and permits only
  the closed internal update-error code set.
- Snapshot adapter classification catches hostile reflection before testing the
  real adapter private-field brand through the prototype method.
- Adversarial regressions cover stateful accessors and hostile proxies across
  every affected exported boundary.

## Exact repaired file identities

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

## Observed verification

- Focused protected-state matrix: 11 tests, 11 passed, zero failed or skipped.
- The exact five-file WP03, release, install-health, architecture-gate, and
  safety command contains 57 tests, not the 65 originally recorded here. R8
  independently reproduced 57/57 and retained its separate 9/9 runtime-faithful
  architecture result; the original aggregate label is superseded.
- Secret Broker CLI matrix: 24 tests, 22 passed, zero failed, and two expected
  environment-gated skips; duration `554.106372ms`.
- Full repository suite: 1,063 tests, 1,061 passed, zero failed, and two
  expected environment-gated skips; duration `113823.240241ms`.
- Release/source-audit and install-health generators passed their deterministic
  `--check` modes.
- `git diff --check` passed.

The two skips remain the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The observed run made no Jira, credential,
provider, protected effect, publication, deployment, or rollback contact. The
synthetic adapter remains `SYNTHETIC_UNQUALIFIED` and production-ineligible.

Independent R8 must reproduce the exact committed repair and satisfy the WP03
exit gate before this work package can close.
