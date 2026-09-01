# SB-WP03 R3 repair observed verification

This value-free record binds the repaired WP03 candidate after the independent
R3 `revise/98` result. It contains no credential, protected source, Jira
response, provider payload, private OS state, or model-visible secret value.

## Candidate content binding

This verification record is self-excluded because an observed result cannot
contain its own final digest. Ignored reports and review receipts are not
implementation candidate content; receipt digests are bound separately.

| Field | Bound value |
|---|---|
| Baseline Git commit | `486ddbdc330557c764a43c51ea0fce9e38a658b2` |
| Tracked binary diff command | `git diff --binary --no-ext-diff` |
| Tracked binary diff SHA-256 | `e1d03d2617054e2b592febc2a6b91d272be50555634d0cfeff5ae7bc3b3c7b38` |
| Untracked inventory command | `git ls-files --others --exclude-standard \| sort \| rg -v '^\.kstack/evidence/secret-broker-2026-08-28-wp03-r3-repair-observed-verification\.md$' \| xargs sha256sum` |
| Untracked inventory entries | 7 |
| SHA-256 of exact untracked inventory output | `3dd082f2c1211bd078bd2aadc3dba246e31ef691d305541fee2752b20ca3586f` |
| Implementation record SHA-256 | `70a83659c4876dd445245725268f3efc31e56650846b88bf496c917dd8fe99e7` |
| R2 repair verification SHA-256 | `69f7a657114a37446f3483348ee4f1c402bf1491cb69b35397a6ecf0f888fc47` |
| R3 review receipt SHA-256 | `1a2b0ffaf9e958c741b7c0be56dbbbc26716a3d2af9fe3eea5be7471a737f75d` |

The seven included untracked entries are the WP03 implementation record, the
R0/R1/R2 historical verification records, the control-plane module, the
synthetic protected-state adapter, and its regression test. The tracked binary
diff binds delivery state, release/install closure, documentation, generated
manifests, architecture registration, and install-health coverage.

## R3 repair coverage

The repaired candidate:

- converts audit writer-lease expiry to `ACKNOWLEDGEMENT_UNKNOWN` and retains
  the store-wide lock, blocking reacquisition and subsequent advancement;
- validates roots as strings before path operations and normalizes invalid or
  throwing clocks to one fixed error;
- catches descriptor-close failures within the private canonical-read boundary
  and returns only fixed typed errors;
- injects open, write, fsync, close, and pre-rename retirement failures for
  authority and audit independently, proving every case fences all public
  surfaces and prevents retry with the admitted ID;
- injects competing lock acquisition independently on public open, status,
  public-status bytes, authority read/snapshot, and audit read/snapshot; and
- binds the exact accepted WP02 implementation-record digest.

## Observed execution

| Field | Observed value |
|---|---|
| Date UTC | `2026-09-01` |
| Commands | focused four-file Node test matrix; release/source-audit generator `--check`; install-health generator `--check`; `git diff --check`; `npm test` |
| Aggregate exit status | `0` |
| Focused matrix | 30 tests; 30 passed; 0 failed; 0 skipped; `27429.202311ms` |
| Full suite | 1,061 tests; 1,059 passed; 0 failed; 2 environment-gated skips |
| Full-suite Node duration | `108671.182197ms` |
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
duration_ms 108671.182197
```

The two skips are the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The real native Windows PowerShell installer
passed. The run made no Jira mutation, credential read, provider or target
call, protected effect, publication, deployment, or rollback action.
