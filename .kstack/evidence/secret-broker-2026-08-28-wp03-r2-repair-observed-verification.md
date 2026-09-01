# SB-WP03 R2 repair observed verification

This value-free record binds the repaired WP03 candidate after the independent
R2 `revise/99` result. It contains no credential, protected source, Jira
response, provider payload, private OS state, or model-visible secret value.

## Candidate content binding

This verification record is self-excluded because an observed result cannot
contain its own final digest. The ignored assessment report and ignored review
receipts are not implementation candidate content; review receipt digests are
bound separately below.

| Field | Bound value |
|---|---|
| Baseline Git commit | `486ddbdc330557c764a43c51ea0fce9e38a658b2` |
| Tracked binary diff command | `git diff --binary --no-ext-diff` |
| Tracked binary diff SHA-256 | `0ce6e68ddfbdcbc89a46fbf3b46f37b486825c6a032dbfda8a113f76a7dfd215` |
| Untracked inventory command | `git ls-files --others --exclude-standard \| sort \| rg -v '^\.kstack/evidence/secret-broker-2026-08-28-wp03-r2-repair-observed-verification\.md$' \| xargs sha256sum` |
| Untracked inventory entries | 6 |
| SHA-256 of exact untracked inventory output | `5405d46ad6142bc39250ae093cbd9a9ee3877b015edfea4ddb03ccafd676b999` |
| Implementation record SHA-256 | `8c7d3e37b2c49d40734d571b8c8c52c89cf57d9e1d0ffb5a25e8c122c89cc0bb` |
| Superseded R0 verification SHA-256 | `0a12cbd6c93a4734489abab05bc39f8687e7b16ebc7dd1dba091eb9e58c411a5` |
| Superseded R1 repair verification SHA-256 | `86fb97d129867e16dd5c8c5d931ba44d9c62fd18c28e4e0427e8ceaedd6041b8` |
| R1 review receipt SHA-256 | `1e75bae179475c19a75638138cc90938bd6d05827b8fdf879cf8816fd9c6e709` |
| R2 review receipt SHA-256 | `19130cb64510064e26a00c7091e0d353524294479c72651fe4f557373d5d3a7d` |

The six included untracked entries are the WP03 implementation record, the R0
and R1 historical verification records, the authority/audit control-plane
module, the synthetic protected-state adapter, and its regression test. The
tracked binary diff binds the delivery ledger/status, release and install-
health closure, truthful reader documentation, generated manifests,
architecture registration, and install-health regressions.

## R2 repair coverage

The repaired candidate:

- classifies every temp-file open, write, fsync, close, and pre-rename failure
  while persisting update-ID retirement as write-uncertain;
- returns only `ACKNOWLEDGEMENT_UNKNOWN` for that outcome and retains the
  store-wide exclusive lock instead of releasing it;
- blocks open, readiness, reads, snapshot verification, and every later
  mutation behind that retained fence, preventing reuse of the admitted ID;
- applies the same fencing semantics to authority and audit retirement; and
- serializes all public reads and status checks through the exclusive lock,
  eliminating the competing-lock time-of-check/time-of-use window.

## Observed execution

| Field | Observed value |
|---|---|
| Date UTC | `2026-09-01` |
| Commands | focused four-file Node test matrix; release/source-audit generator `--check`; install-health generator `--check`; `git diff --check`; `npm test` |
| Aggregate exit status | `0` |
| Focused matrix | 30 tests; 30 passed; 0 failed; 0 skipped; `21961.274059ms` |
| Full suite | 1,061 tests; 1,059 passed; 0 failed; 2 environment-gated skips |
| Full-suite Node duration | `82368.091758ms` |
| Generated manifests | both checks passed with no output after dependency-ordered generation |
| Diff hygiene | passed with no output |

Retained full-suite terminal summary:

```text
tests 1061
suites 0
pass 1059
fail 0
cancelled 0
skipped 2
todo 0
duration_ms 82368.091758
```

The two skips are the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The real native Windows PowerShell installer
passed. The run made no Jira mutation, credential read, provider or target
call, protected effect, publication, deployment, or rollback action.
