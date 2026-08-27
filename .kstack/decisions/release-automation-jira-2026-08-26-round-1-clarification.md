# Round 1 clarification: automated release controller with Jira

Status: LOCKED

- Thread: `release-automation-jira-2026-08-26`
- Invocation: `d7bddab5-2925-4c9a-b6fe-2f0f9bca6fae`
- Design digest: `b74580d9f12a14e4da2f6a56c7792035b0d21bcf375298ac6e4bb0b33d937f0d`
- Scores: Codex 43; Opus 58; combined 43
- Result: `ROUND_ONE_CLARIFICATION_LOCKED`

## Bound sources

| Source | SHA-256 |
|---|---|
| objective | `ce00d5fa305e8738d274dfb4468658e6150d86c906695e56c1f436e521af76a6` |
| decision brief | `b74580d9f12a14e4da2f6a56c7792035b0d21bcf375298ac6e4bb0b33d937f0d` |
| Codex report | `fcc12d61c044ebfb9e0af469ee4d7138bda95ef11afb3ee86883d0caac3dede9` |
| Codex envelope | `abbc6940e919b91956274945d01d6df0d4cb6a1f3b38d380fd5c6a858471e0bc` |
| Opus report | `3e18f38c5da6e07db08f10425b10aa7aa8d9f967fac8a9ac92314c59249b43c5` |
| Opus envelope | `553fc6a264a75002f6745f39a2574888437c223034a93dd6b42aa2e01e036d4b` |
| synthesis | `230ab143e9305587832fb2d600cb999f9651d940a10880b916296d6faa4cf9e9` |
| manifest | `4dbc22ea8407f26bfa9a533e3c9bc131834b2a9847879719d5a36bfd92896e20` |

## Owner decisions

1. **Out-of-band approval:** for GitHub production targets, GitHub environment
   protection is the single human approval point. The broker plans, submits,
   observes, reconciles, rolls back when eligible, and updates Jira unattended
   after that provider-owned approval. The broker cannot manufacture it.
2. **Health waiver:** waiving the independent canary disables health-triggered
   rollback and returns `OBSERVATION_SKIPPED_BY_OWNER`, never `HEALTHY`.
   Provider dispatch-failure recovery remains available.
3. **Rollback eligibility:** mandatory automatic rollback applies only after the
   release is fully applied and runtime reversibility is revalidated. Partial,
   failed, or unknown application reconciles first and uses manual action when
   safe automatic recovery cannot be proven.

## Mandatory technical corrections

No review defect is accepted. Round two must provide the full transition table;
immutable GitHub workflow and release-token contract; provider-time authority
revalidation/correlation; least-privilege permissions; Jira concurrency
qualification and fallback; independent-health criteria; endpoint/audience
controls; redaction/encryption/retention/deletion for evidence; broker-owned Jira
revision chains; monotonic lease versus wall-clock expiry; pause/revocation/
rollback precedence; offline-only early Jira units; and embedded parent clauses.

No other thread may be redesigned from this record. No implementation is
authorized.
