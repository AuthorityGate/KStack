# SB-WP03 R1 repair observed verification

This value-free record binds the repaired WP03 candidate after the independent
R1 `revise/98` result. It contains no credential, protected source, Jira
response, provider payload, private OS state, or model-visible secret value.

## Candidate content binding

This verification record is self-excluded because an observed result cannot
contain its own final digest.

| Field | Bound value |
|---|---|
| Baseline Git commit | `486ddbdc330557c764a43c51ea0fce9e38a658b2` |
| Tracked binary diff command | `git diff --binary --no-ext-diff` |
| Tracked binary diff SHA-256 | `939dc361edc0aa37815927fe8012c5785bc96b401f8b89e59a38f7b029ba282e` |
| Untracked inventory command | `git ls-files --others --exclude-standard \| sort \| rg -v '^\.kstack/evidence/secret-broker-2026-08-28-wp03-r1-repair-observed-verification\.md$' \| xargs sha256sum` |
| Untracked inventory entries | 5 |
| SHA-256 of exact untracked inventory output | `2376a9fd6081af7c1884aa6627917f23ea0b0abdfa67fbdedeb267ef4fd7fdad` |
| Implementation record SHA-256 | `72c044eb7d9b9d88d0a576c64e08e8bfea1148224d723de8b6b3f3efbde8094b` |
| Superseded R0 verification SHA-256 | `0a12cbd6c93a4734489abab05bc39f8687e7b16ebc7dd1dba091eb9e58c411a5` |
| R1 review receipt SHA-256 | `1e75bae179475c19a75638138cc90938bd6d05827b8fdf879cf8816fd9c6e709` |

The five untracked entries covered by the inventory are the WP03
implementation record, superseded R0 verification record, authority/audit
control-plane module, synthetic protected-state adapter, and protected-state
regression test. The tracked binary diff binds the delivery ledger/status,
release and install-health closure, truthful reader documentation, generated
manifests, architecture registration, and install-health regressions.

## R1 repair coverage

The repaired candidate:

- permits only one initialized authority namespace and one audit namespace,
  with the audit origin fixed to epoch one;
- issues update IDs inside the adapter from the OS CSPRNG and permanently
  retires an issued ID before evaluating every attempted authority or audit
  CAS, including mismatch, lease expiry, and crash-before-commit paths;
- closes and prevalidates create/open, writer-acquisition, and CAS fault-option
  objects before protected-state lookup or lock acquisition;
- makes lock residue fail closed for open, status, reads, public status, and
  snapshot verification;
- normalizes explicit and filesystem-level possibly committed failures to
  `ACKNOWLEDGEMENT_UNKNOWN` for read-only exact reconciliation; and
- enforces epoch-one/genesis equivalence and replaces the undefined-identifier
  audit assertion with an exact typed-error regression.

## Observed execution

| Field | Observed value |
|---|---|
| Date UTC | `2026-09-01` |
| Commands | focused four-file Node test matrix; release/source-audit generator `--check`; install-health generator `--check`; `git diff --check`; `npm test` |
| Aggregate exit status | `0` |
| Focused matrix | 28 tests; 28 passed; 0 failed; 0 skipped; `29345.488096ms` |
| Full suite | 1,059 tests; 1,057 passed; 0 failed; 2 environment-gated skips |
| Full-suite Node duration | `107928.564467ms` |
| Generated manifests | both checks passed with no output after dependency-ordered generation |
| Diff hygiene | passed with no output |

Retained full-suite terminal summary:

```text
tests 1059
suites 0
pass 1057
fail 0
cancelled 0
skipped 2
todo 0
duration_ms 107928.564467
```

The two skips are the fenced real Windows protected-worker and fenced real
Linux desktop Secret Service cell. The real native Windows PowerShell installer
passed. The run made no Jira mutation, credential read, provider or target
call, protected effect, publication, deployment, or rollback action.
