# SB-WP02 R3 repair exact-candidate confirmation

This value-free record is finalized before the exact-candidate verification
command. It contains no credential, protected source, Jira response, provider
payload, or model-visible secret value.

| Field | Required exact result |
|---|---|
| R3 receipt SHA-256 | `100df9d7fd96462848160ba982a063f4e838448de3b83993e07d472a2dc1dcff` |
| Full suite command | `npm test` |
| Full suite result | 1,049 tests; 1,047 passed; 0 failed; 2 environment-gated skips |
| Native installers | 14/14 passed, including real native Windows PowerShell |
| Generated manifests | release/source-audit and install-health `--check` both passed |
| Diff hygiene | `git diff --check` passed |

The final verification is run only after this record, the implementation
record, mutable delivery status, and item ledger are finalized. A nonzero exit
or any result mismatch invalidates this record and blocks review dispatch. The
two skips remain the real Windows protected-worker and real Linux desktop
Secret Service cells behind the global pre-contact implementation fence.
