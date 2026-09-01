# SB-WP02 R1 repair verification receipt

| Field | Value |
|---|---|
| Schema | `kstack-local-test-execution-receipt-v1` |
| Work package | `SB-WP02` / Jira KSTK-133 |
| Completed at | `2026-08-31T23:31:04.000Z` |
| Execution environment | repository WSL/Linux process plus native Windows PowerShell exercised by `tests/windows-setup.test.mjs` |
| Release manifest SHA-256 | `8636ecf9207a0ad50670c0544c726876242f3dac31ee97902278bdddbca0da64` |
| Source-audit manifest SHA-256 | `355f0cc1f0fc62841be1e9e56a659e8b335b85833b3d17aa2dabdaa75ab6e435` |
| Installer audit SHA-256 | `581e9f82c453f9f00209363a6233a6b40ec3a9d0b14a80d7e539692cbb2f5f63` |
| R1 receipt SHA-256 | `afd1c6014466feab60a57a5dc5387b3fcb891ab45eaf28bd36025187afea83ae` |

## Executions

| Command | Tests | Passed | Failed | Skipped | Result |
|---|---:|---:|---:|---:|---|
| `node --test tests/secret-broker.test.mjs tests/secret-broker-compatibility.test.mjs tests/secret-broker-config.test.mjs tests/secret-broker-config-migration.test.mjs tests/secret-broker-release.test.mjs tests/citation-grounding.test.mjs tests/install-health.test.mjs tests/reflexion-architecture.test.mjs` | 77 | 75 | 0 | 2 | PASS |
| `node --test tests/setup.test.mjs tests/windows-setup.test.mjs` | 14 | 14 | 0 | 0 | PASS |
| `npm test` | 1,044 | 1,042 | 0 | 2 | PASS |
| `node tests/helpers/generate-secret-broker-release-manifests.mjs --check` | 1 check | 1 | 0 | 0 | PASS |
| `node tests/helpers/generate-install-health-audit-manifest.mjs --check` | 1 check | 1 | 0 | 0 | PASS |
| `git diff --check` | 1 check | 1 | 0 | 0 | PASS |

The two full-suite skips are the real Windows protected-worker and real Linux
desktop Secret Service cells. Both remain stopped by the global pre-contact
implementation fence. The native Windows installer test is not skipped: it
invokes real Windows PowerShell, installs a staged runtime, and mutates an
initialized synthetic project.

This is a retained local execution receipt, not an external attestation or a
production qualification. It contains no credential, protected locator,
provider response, target response, or repository Jira configuration.
