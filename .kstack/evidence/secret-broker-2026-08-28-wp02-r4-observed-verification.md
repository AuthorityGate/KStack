# SB-WP02 R4 repair observed verification

This value-free record retains the observed result for the R4-repaired WP02
candidate. It contains no credential, protected source, Jira response,
provider payload, private OS state, or model-visible secret value.

## Candidate content binding

The verification record is self-excluded: an observed result cannot contain
its own final digest. The executable candidate, implementation record, prior
evidence, and all four independent-review receipts are bound as follows.

| Field | Bound value |
|---|---|
| Baseline Git commit | `8cc60400f244bd94e6a0ee3d822fd8cbc37d5cd5` |
| Tracked binary diff command | `git diff --binary --no-ext-diff` |
| Tracked binary diff SHA-256 | `e8ba6055102a5e9520189b92a1a61421f5f5e7d64737d8efc74b3ba1a16c640a` |
| Untracked inventory command | `git ls-files --others --exclude-standard \| sort \| rg -v '^\.kstack/evidence/secret-broker-2026-08-28-wp02-r4-observed-verification\.md$' \| xargs sha256sum` |
| Untracked inventory entries | 14 |
| SHA-256 of exact untracked inventory output | `acab8fb3c97a243b9e3890bcd24633283eca8959b4b2f2fad10d0c0433881c25` |
| R1-R4 review receipt inventory SHA-256 | `bea0dea64f6d4ff4e7a3a1dfaa6531a7808767c8194a77dd32066d8f5ee1f8bf` |
| Implementation record SHA-256 | `1d5442033968d1a6ee9839fade3c01c7fdf19cae403dd806ede2ef173835f804` |

The 14 untracked entries are the WP02 implementation record; R1-R3 repair
evidence; the WSL Jira projection; the config document, migration, release,
and provenance modules; the two generated Secret Broker manifests; the
release generator; and the migration and release tests. Their individual
digests are retained in the command output represented by the inventory
digest. The ignored review receipt inventory consists exactly of:

| Receipt | SHA-256 |
|---|---|
| R1 | `afd1c6014466feab60a57a5dc5387b3fcb891ab45eaf28bd36025187afea83ae` |
| R2 | `9759f83d6d3f8b22dc166fce6ebc204e438e44054ddb0bd6190c99c5bf100a3e` |
| R3 | `100df9d7fd96462848160ba982a063f4e838448de3b83993e07d472a2dc1dcff` |
| R4 | `c2aaa9d6bf967666dac68e642a8fe620f1fb98bf0b8fa72aa55b0960f637e9b2` |

## Observed execution

| Field | Observed value |
|---|---|
| Started UTC | `2026-09-01T00:47:57.000Z` |
| Finished UTC | `2026-09-01T00:51:59.000Z` |
| Commands | release/source-audit generator `--check`; install-health generator `--check`; `git diff --check`; `npm test` |
| Aggregate exit status | `0` |
| Full suite | 1,051 tests; 1,049 passed; 0 failed; 2 environment-gated skips |
| Node test duration | `225945.215925ms` |
| Generated manifests | both checks passed with no output |
| Diff hygiene | passed with no output |

Retained terminal summary:

```text
tests 1051
suites 0
pass 1049
fail 0
cancelled 0
skipped 2
todo 0
duration_ms 225945.215925
```

The two skips are the real Windows protected-worker and real Linux desktop
Secret Service cells behind the global pre-contact implementation fence. The
real native Windows PowerShell installer test passed in this run.

An earlier managed-sandbox attempt is explicitly non-evidentiary: Node
`spawnSync` stdin timed out there and caused unrelated Python/Rust host-oracle
failures. A minimal probe reproduced that sandbox restriction and succeeded
outside it. The observed run above used the same repository candidate outside
that restriction and had no network, Jira, credential, provider, protected
effect, publication, deployment, or rollback contact.
