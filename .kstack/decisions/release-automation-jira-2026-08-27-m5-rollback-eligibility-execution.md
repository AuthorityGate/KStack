# Release M5 round 4 — final interval and cross-head corrections

**Frozen base digests:**
`70d7315a1f3d71a668ea3df9f6ea66798e3bd6ce66f3388dca43ad3415346c51`,
`912f810536ab671537a6c1219cd46abe970470178a9874f85843eb89729d2cbb`,
`4bec7eca7bedf92338e7af925bf225d80cef310534e176559eed94bed0bb4c54`
**Prior Codex:** 92 revise in 16393 ms
**Mode:** two concrete bug fixes only

All prior provisions remain normative except the two clauses below.

## Full post-dispatch uncertainty coverage

The qualified plan adds a nonnegative bounded
`issuanceConsumeDispatchBudgetMs`, measured from the latest eligibility decision
through M2's matching external `dispatching` acknowledgment. Define with checked
inclusive arithmetic:

```text
latestDispatchNotAfter = checked_add(
  rollbackDecisionNotAfter,
  issuanceConsumeDispatchBudgetMs
)

requiredReconciliationCoverageThrough = checked_add(
  latestDispatchNotAfter,
  M2.uncertaintyWindowMs
)

requiredHealthCoverageThrough = checked_add(
  requiredReconciliationCoverageThrough,
  postRollbackM4BudgetMs
)
```

`latestDispatchNotAfter` must be no later than the rollback grant, credential,
restore-artifact/config, reversibility, retained-revision, resource-lease,
adapter-qualification, and provider-mutation authority expiries. Each
provider-operation lookup, provider idempotency retention, authenticated
read-current path, broker recovery lease, and M7 evidence retention must remain
qualified through at least `requiredReconciliationCoverageThrough`, inclusive.
The restored-target M4 observer, qualified-time, authentication, evidence
retention, and canary plan must remain qualified through
`requiredHealthCoverageThrough`; `postRollbackM4BudgetMs` is itself bounded and
digest-bound. Relative provider guarantees
must cover at least the full `M2.uncertaintyWindowMs` from the actual external
dispatch commitment; an absolute contract or credential expiry must also cover
the conservative latest-dispatch calculation above.

Overflow, missing/unbounded latency or observation budget, shorter lookup/
retention/recovery/health coverage,
or any authority that can expire between decision and latest dispatch makes the
automatic path unavailable before original release approval. An actual earlier
dispatch starts M2's exact uncertainty interval at its authenticated external
dispatch time; it never lengthens the approved authority deadline or permits a
retry.

## One atomic multi-channel action predicate

The M2 phase channel and M5 application-fact channel remain domain-separated
schemas and histories. The exact M7 target must additionally expose one
qualified `compareHeadsAndAppendM2PhaseV1` serialization primitive. Under the
release aggregate/fence it atomically:

1. compares the expected M2 external channel ID/head/sequence;
2. compares the expected application-fact channel ID/head/sequence;
3. compares the primary release/application/M2 record digests, fence, lease,
   policy/revocation versions, M4/provider heads, and qualified time bound in
   the same authorization snapshot; and
4. appends exactly the next allowed M2 `issued`, `consumed`, or `dispatching`
   phase record to the M2 channel, without parsing or copying an M5 record into
   that channel.

Application-fact appends serialize through the same aggregate primitive and
must compare the current M2 head. Therefore either the new application fact or
the M2 phase wins first; the loser rereads and re-evaluates. There is no pair of
independent “current” reads. A matching external `dispatching` append is M2's
action linearization point; facts appended after it are later observations and
force reconciliation but cannot retroactively claim the already-dispatching
operation was stopped.

The primitive rejects/quarantines unavailable channels, wrong domain/type,
head ahead/behind, regression, gap, fork, stale primary digest, stale fence,
sequence overflow, partial append, or cross-channel replay. Its crash contract
is all-or-none: either no M2 phase is committed, or the exact M2 phase and
cross-head comparison receipt are durably committed at one M7 sequence. M2's
own three-phase schema, receipt rules, and single-send seam remain unchanged.

Qualification races each application append against every M2 phase append,
crashes before/after the atomic commit, corrupts each expected head and primary
digest, and proves one winner with no provider call unless the exact external
`dispatching` receipt is current. Until this primitive and the full interval
coverage above pass for the target, M5 stays observer-only.

Closure requires Codex confidence at least 93 on the exact composed digest with
zero failed checks, security findings, material dissent, and unresolved M5
questions. No Opus, implementation, external mutation, report edit, commit,
push, or deployment is authorized.
