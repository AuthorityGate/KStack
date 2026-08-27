# Sanitization evidence addendum — 2026-08-27

**Status:** evidence-only, non-authorizing addendum
**Scope:** nonignored KStack decision and provenance artifacts prepared for the
2026-08-27 sanitized commit
**Mutation rule:** the frozen reviewed artifacts bound below remain unchanged

## Audit result

The inspected nonignored artifacts contain no secret value, credential,
private-key material, or username. Three files preserve the same generic
machine-local `/tmp` checkout path as historical inspection context. That path
is non-authoritative and is not a reproduction input. Reproduction relies on
the pinned remote repository, commit, Git blob, exact content, and license
digests recorded by the source and option ledgers.

Three frozen Release Automation deltas preserve an older `Codex 84` review
floor. That wording is historical and is superseded by the current
authoritative `Codex >=93` closure rule. It cannot authorize present or future
closure. The frozen reviewed bytes remain unchanged so their review-bound
digests remain verifiable.

The 2026-08-26 Capability Fabric routing amendment also preserves an earlier
Claude closure/stagnation route. For the current completion scope, that route is
superseded by the locked 2026-08-27 owner directive: Codex only, confidence at
least 93, and all four closure counters at zero. No Claude Opus invocation is
required or authorized for these lanes.

## Historical generic temporary-path occurrences

| Exact nonignored artifact | Current SHA-256 | Preserved occurrence | Disposition |
|---|---|---|---|
| [`memory-maturity-2026-08-26-option-selection.md`](memory-maturity-2026-08-26-option-selection.md) | `8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf` | line 38, `/tmp/gstack-reuse-audit-20260826` | Historical inspection location only; no username or authority. |
| [`memory-maturity-2026-08-26-source-ledger.md`](memory-maturity-2026-08-26-source-ledger.md) | `baf70e2cde3f82ff17a34c97599797875d73a07eea3bdc6fa2685a6016374676` | line 15, `/tmp/gstack-reuse-audit-20260826` | Historical inspection location only; remote origin, commit, blobs, content, and licenses control reproduction. |
| [`release-automation-jira-2026-08-26-option-selection.md`](release-automation-jira-2026-08-26-option-selection.md) | `4111cc68c347865ec53a72730885bf4d63fb27fdbae482c73a242cb2acb54f42` | line 46, `/tmp/gstack-reuse-audit-20260826` | Historical inspection location only; the pinned upstream evidence controls. |

## Superseded Release review-floor occurrences

| Frozen reviewed artifact | Current SHA-256 | Historical occurrence | Actual clean final result |
|---|---|---|---|
| [`release-automation-jira-2026-08-27-m1-correction1.md`](release-automation-jira-2026-08-27-m1-correction1.md) | `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523` | line 6, `Codex 84 or higher` review floor | Codex 97; zero failed checks, security findings, material dissent, and unresolved questions. |
| [`release-automation-jira-2026-08-27-m1-correction2.md`](release-automation-jira-2026-08-27-m1-correction2.md) | `a217f92d67f4cdee5deb178c9855c7de9ccb243cec12890b097c81ca86783e16` | line 7, `Codex 84 or higher` review floor | Codex 95; zero failed checks, security findings, material dissent, and unresolved questions. |
| [`release-automation-jira-2026-08-27-m1-correction4.md`](release-automation-jira-2026-08-27-m1-correction4.md) | `9addaaa63aaf1130b85260762a2609abf304fea4e20bd86b6cf42584fb841d2e` | line 7, `Codex 84 or higher` review floor | Codex 94; zero failed checks, security findings, material dissent, and unresolved questions. |

All three actual final results independently satisfy the current 93-point
minimum with all four closure counters at zero. Score alone never overrides a
nonzero closure counter.

## Current authority and historical routing

| Authority or evidence | Current SHA-256 | Controlling statement |
|---|---|---|
| [`current-review-routing-owner-supersession-2026-08-27.md`](current-review-routing-owner-supersession-2026-08-27.md) | `182dda8b4ca7d3fa88aa3f56bb0744e5941c4d516bbc0c2edbf9ffd9077b406e` | Current completion route is Codex-only; closure requires at least 93 and zero failed checks, security findings, material dissent, and unresolved questions. |
| [`capability-fabric-review-routing-2026-08-26.md`](capability-fabric-review-routing-2026-08-26.md) | `9f08fcd1f924a8c6f47864839818d97fc9ee1b71cdd6f7e9f696b97d0dcc7d0c` | Historical prior route. Its Claude closure/stagnation clauses are superseded for the current scope; the excluded `-v1` draft also has no authority. |
| [`release-automation-jira-2026-08-26-item-ledger.md`](release-automation-jira-2026-08-26-item-ledger.md) | `6793b720295c7461b1b4409dc01f0595e342b38dd209e378e6c9edd21c178dca` | Binds the three final scores and all-zero results; runtime remains `TARGET_FIXTURE_NOT_YET_QUALIFIED`. |
| [`memory-maturity-2026-08-26-item-ledger.md`](memory-maturity-2026-08-26-item-ledger.md) | `d0ac66bff5d104edde257563ba509765ee40fd26570bd63b151d2b7b69cebd6b` | Requires Codex at least 93 and excludes every local-model runtime and workload from the selected architecture. |

## Exclusion and provenance checks

- `.kstack/reviews/` and `reports/` remain ignored by [`.gitignore`](../../.gitignore),
  SHA-256 `c0010d5afd65f6e8f58e5411ab392aafd7101d667ddee8b69503a7ef9712e909`.
  Neither tree supplies a staged or tracked publication artifact. Nonignored
  canonical promotions retain exact reviewed hashes without publishing the
  review directories.
- The Ollama option remains dead. Matches in the bound Memory records are only
  preserved owner-question history or explicit prohibitions. The authoritative
  Memory ledger supplies no local-model, model-download, embedding, semantic,
  reranking, expansion, or Ollama implementation path.
- [`README.md`](../../README.md), SHA-256
  `f792caf80ce9b6e39a86999f72b6218fc76e9f79c50f4c4a2a2b1f1a5331209b`,
  and [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md), SHA-256
  `f02585a8ba03aa4ac44b4c0434ba3097945ca2dd7c314c6a0aecd7ea41e4ae41`,
  credit gstack and Garry Tan, pin the audited gstack commit, and preserve the
  MIT permission notice. The notice's verbatim MIT block hashes to
  `e56fbb5b3d95756f3fa1cfefa24732ec79f18ece1ad08a4e79e00df57e8b198c`,
  matching the source ledger.

This addendum supplies sanitization context only. It does not alter a frozen
reviewed byte, reopen or close a design item, authorize implementation or
runtime qualification, or grant commit, push, deployment, publication, or
external-mutation authority.
