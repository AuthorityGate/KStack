# SB-WP03 R6 repair observed verification

This value-free record binds the repaired WP03 candidate after the independent
R6 `revise/99` result. It contains no credential, protected source, Jira
response, provider payload, private OS state, or model-visible secret value.

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
| Tracked binary diff SHA-256 | `ed47231055a3d8d2012b0657ca78616cb28056f01f1f2f4d7afa2bf8500f18c3` |
| Untracked inventory command | `git ls-files --others --exclude-standard \| sort \| rg -v '^\.kstack/evidence/secret-broker-2026-08-28-wp03-r6-repair-observed-verification\.md$' \| xargs sha256sum` |
| Untracked inventory entries | 11 |
| SHA-256 of exact untracked inventory output | `85acbbb33c1f30fd2d310d89b3cf629ac5e17e842b24702b99f06b428ba9dc8f` |
| Implementation record SHA-256 | `356d2ecd19438208474bcb52ec367e7b7e585359f4885940d2d74b369ed827c8` |
| R5 repair verification SHA-256 | `5d7668e6428200fc34f458d0c6c5eb82d95661a000859608f906af5bc927c7ba` |
| R6 review receipt SHA-256 | `eacd61de4065e0f53fffefee1e7efbeeb3f2214ef4411481da443ef4d29c0089` |

The eleven included untracked entries are the owner-directed safety default-
trust decision, the WP03 implementation record, the R0 through R5 historical
verification records, the control-plane module, the synthetic protected-state
adapter, and its regression test. The tracked binary diff binds delivery
state, the safety hook and documentation, release/install closure, generated
manifests, architecture registration, and both safety and protected-state
coverage.

## R6 repair coverage

The repaired candidate:

- unconditionally maps every exception raised while inspecting a caller-
  supplied authority or audit head to the applicable fixed typed head error;
- no longer treats the publicly constructible `SecretControlPlaneError` class
  as evidence that a hostile accessor exception originated internally;
- classifies authority and audit parser inputs inside their fixed encoding-
  error boundaries, including prototype reflection and byte conversion; and
- directly exercises ordinary errors and caller-created control-plane errors
  through every head validator, codec, digest, successor, and reconciliation
  side, plus hostile parser-input proxies.

The concurrent owner-directed amendment continues to trust canonical regular
project enrollment files without consulting projected permission bits. It
retains canonical paths, descriptor/path identity, ownership when available,
bounded parsing, policy digests, and release digests. All protected credential-
store checks remain unchanged.

## Observed execution

| Field | Observed value |
|---|---|
| Date UTC | `2026-09-01` |
| Commands | combined five-file Node test matrix; Secret Broker CLI matrix; runtime-faithful architecture matrix; release/source-audit generator `--check`; install-health generator `--check`; `git diff --check`; `npm test` |
| Aggregate final exit status | `0` |
| Combined focused matrix | 57 tests; 57 passed; 0 failed; 0 skipped; `22821.816697ms` |
| Secret Broker CLI matrix | 24 tests; 22 passed; 0 failed; 2 expected environment-gated skips; `595.144227ms` |
| Architecture matrix | 9 tests; 9 passed; 0 failed; 0 skipped; `6317.366806ms` |
| Full suite | 1,063 tests; 1,061 passed; 0 failed; 2 environment-gated skips |
| Full-suite Node duration | `149304.352444ms` |
| Generated manifests | both checks passed with no output after dependency-ordered generation |
| Diff hygiene | passed with no output |

The first post-repair full-suite pass identified only the stale architecture
use-site digest caused by the changed control-plane bytes. The digest and its
dependent generated closure were updated, the architecture and focused
matrices passed, and the final full suite then passed with zero failures.

Retained final full-suite terminal summary:

```text
tests 1063
suites 0
pass 1061
fail 0
cancelled 0
skipped 2
todo 0
duration_ms 149304.352444
```

The two skips are the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The real native Windows PowerShell installer
passed. The run made no Jira mutation, credential read, provider or target
call, protected effect, publication, deployment, or rollback action.
