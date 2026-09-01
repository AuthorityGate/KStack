# SB-WP03 R5 repair observed verification

This value-free record binds the repaired WP03 candidate after the independent
R5 `revise/99` result and the owner's concurrent project-state default-trust
directive. It contains no credential, protected source, Jira response,
provider payload, private OS state, or model-visible secret value.

## Candidate content binding

This verification record is self-excluded because an observed result cannot
contain its own final digest. Ignored reports and review receipts are not
implementation candidate content; receipt digests are bound separately. The
owner-local `.kstack/config.json` authority update is also excluded from the
review candidate and remains uncommitted.

| Field | Bound value |
|---|---|
| Baseline Git commit | `486ddbdc330557c764a43c51ea0fce9e38a658b2` |
| Tracked binary diff command | `git diff --binary --no-ext-diff -- . ':(exclude).kstack/config.json'` |
| Tracked binary diff SHA-256 | `f1851c1dd91ce302c56ee95f6d092368ac55cbc350332fa47ae87a48fa4d5e18` |
| Untracked inventory command | `git ls-files --others --exclude-standard \| sort \| rg -v '^\.kstack/evidence/secret-broker-2026-08-28-wp03-r5-repair-observed-verification\.md$' \| xargs sha256sum` |
| Untracked inventory entries | 10 |
| SHA-256 of exact untracked inventory output | `3b45799eac0f9cfd1b46ebd4350b1cda63736c54e7990de82eb2e51f5f9a2bbb` |
| Implementation record SHA-256 | `7044c9b2ca0c6764c9fe4bd10ee5fffff81768b6d3ae5124856a52bd86e6fdce` |
| R4 repair verification SHA-256 | `08c6e76e2ba91e341f9a53fd9de6aa2be503f3561487d5f54deeeab754328fbe` |
| R5 review receipt SHA-256 | `9095b5e999984fd2223fea35fba2082f394fde279af4371f38d2901da1bc2139` |

The ten included untracked entries are the owner-directed safety default-trust
decision, the WP03 implementation record, the R0/R1/R2/R3/R4 historical
verification records, the control-plane module, the synthetic protected-state
adapter, and its regression test. The tracked binary diff binds delivery
state, the safety hook and documentation, release/install closure, generated
manifests, architecture registration, and both safety and protected-state
coverage.

## R5 repair coverage

The repaired candidate:

- catches reflection and property-access failures inside both exported head
  validators, so authority/audit canonical-byte, digest, successor, and
  reconciliation entry points return only their fixed typed errors;
- rejects every trusted clock or computed lease deadline outside the canonical
  four-digit-year instant domain before `Date` construction;
- accepts the exact maximum canonical lease deadline at equality and rejects
  both a one-millisecond year-9999 overflow and a TimeClip-admissible but
  canonically unrepresentable clock; and
- directly exercises throwing accessors through validators, codecs, digests,
  successors, and both reconciliation sides for authority and audit heads.

The concurrent owner-directed amendment trusts canonical regular project
enrollment files without consulting projected permission bits. It retains
canonical paths, descriptor/path identity, ownership when available, bounded
parsing, policy digests, and release digests. All protected credential-store
checks remain unchanged. The current Windows-mounted WSL workspace reports
`active: true` and `status: ENABLED` without a DrvFS metadata option.

## Observed execution

| Field | Observed value |
|---|---|
| Date UTC | `2026-09-01` |
| Commands | combined five-file Node test matrix; Secret Broker CLI matrix; release/source-audit generator `--check`; install-health generator `--check`; architecture regression; `git diff --check`; `npm test`; live safety status |
| Aggregate exit status | `0` |
| Combined focused matrix | 57 tests; 57 passed; 0 failed; 0 skipped; `24202.502586ms` |
| Secret Broker CLI matrix | 24 tests; 22 passed; 0 failed; 2 expected environment-gated skips; `631.159357ms` |
| Architecture matrix | 10 tests; 10 passed; 0 failed; 0 skipped; `7517.092227ms` |
| Full suite | 1,063 tests; 1,061 passed; 0 failed; 2 environment-gated skips |
| Full-suite Node duration | `103868.091679ms` |
| Generated manifests | both checks passed with no output after dependency-ordered generation |
| Diff hygiene | passed with no output |
| Live safety enrollment | `ENABLED`; installed Codex cache post-deploy health `PASS` with 20/20 execution probes and 2/2 hook-launch probes |

Retained full-suite terminal summary:

```text
tests 1063
suites 0
pass 1061
fail 0
cancelled 0
skipped 2
todo 0
duration_ms 103868.091679
```

The two skips are the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The real native Windows PowerShell installer
passed. The run made no Jira mutation, credential read, provider or target
call, protected effect, publication, deployment, or rollback action.
