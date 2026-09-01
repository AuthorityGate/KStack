# SB-WP03 R4 repair observed verification

This value-free record binds the repaired WP03 candidate after the independent
R4 `revise/99` result. It contains no credential, protected source, Jira
response, provider payload, private OS state, or model-visible secret value.

## Candidate content binding

This verification record is self-excluded because an observed result cannot
contain its own final digest. Ignored reports and review receipts are not
implementation candidate content; receipt digests are bound separately.

| Field | Bound value |
|---|---|
| Baseline Git commit | `486ddbdc330557c764a43c51ea0fce9e38a658b2` |
| Tracked binary diff command | `git diff --binary --no-ext-diff` |
| Tracked binary diff SHA-256 | `ece6c7b593591f95e4eeba0fe01c868df220257f8afc596cb801844b0d6a975e` |
| Untracked inventory command | `git ls-files --others --exclude-standard \| sort \| rg -v '^\.kstack/evidence/secret-broker-2026-08-28-wp03-r4-repair-observed-verification\.md$' \| xargs sha256sum` |
| Untracked inventory entries | 8 |
| SHA-256 of exact untracked inventory output | `95e3e0b508fa81497d3f89f3218d44992344b6d3876dbd56c0f95842af18f70e` |
| Implementation record SHA-256 | `23e40493ac86ff411c7f4914d3677e2c87fa75f81930e2eaefc35945c89b324b` |
| R3 repair verification SHA-256 | `3e6413ab5cb48478976d75f627b42ee66847e93c968bdbc5148214490d14a3fc` |
| R4 review receipt SHA-256 | `c196f8572cb72539efc30756d6ec28ad5275d6995608662014f7cf95d7c6dc69` |

The eight included untracked entries are the WP03 implementation record, the
R0/R1/R2/R3 historical verification records, the control-plane module, the
synthetic protected-state adapter, and its regression test. The tracked binary
diff binds delivery state, release/install closure, documentation, generated
manifests, architecture registration, and install-health coverage.

## R4 repair coverage

The repaired candidate:

- checks the current audit lease under the common exclusive-lock entry before
  status, reads, snapshots, update-ID issuance, authority mutation, audit
  mutation, expectation mismatch, or writer acquisition can proceed;
- retains that lock as a store-wide uncertainty fence when expiry is first
  observed, returns `ACKNOWLEDGEMENT_UNKNOWN` from mutations, and exposes only
  the fixed locked-state error from read/open surfaces;
- prevents expired writer reacquisition, audit advancement, mismatched-CAS
  escape, authority advancement, update-ID issuance, and later store reuse;
- rejects clock-plus-TTL overflow before `Date` construction with the fixed
  protected-clock error; and
- snapshots and normalizes throwing root/clock/request/advance/head accessors
  without exposing caller or Node diagnostic text.

The regression matrix makes every listed expired-lease surface the independent
first observer in a fresh fixture, then proves the retained fence closes every
later public surface. Separate tests cover the maximum valid clock followed by
lease overflow and throwing prospective-object accessors.

## Observed execution

| Field | Observed value |
|---|---|
| Date UTC | `2026-09-01` |
| Commands | focused four-file Node test matrix; release/source-audit generator `--check`; install-health generator `--check`; `git diff --check`; `npm test` |
| Aggregate exit status | `0` |
| Focused matrix | 31 tests; 31 passed; 0 failed; 0 skipped; `21937.663632ms` |
| Full suite | 1,062 tests; 1,060 passed; 0 failed; 2 environment-gated skips |
| Full-suite Node duration | `80482.061737ms` |
| Generated manifests | both checks passed with no output after dependency-ordered generation |
| Diff hygiene | passed with no output |

Retained full-suite terminal summary:

```text
tests 1062
suites 0
pass 1060
fail 0
cancelled 0
skipped 2
todo 0
duration_ms 80482.061737
```

The two skips are the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The real native Windows PowerShell installer
passed. The run made no Jira mutation, credential read, provider or target
call, protected effect, publication, deployment, or rollback action.
