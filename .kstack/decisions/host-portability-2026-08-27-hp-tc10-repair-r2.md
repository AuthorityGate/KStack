# HP-TC10 round-2 repair: reconciliation is query-only

**Prior packet:** `7d9c85c5693742ef296dc96aa8247c793f686f6c85b50c6dbfe2f48ba6b49b4c`
**Prior result:** Codex 97 revise; 1 failed / 1 high security / 1 dissent /
1 question; output `d0d3675d31f7f08ea33285815d5ed46b826f5c61b693c33262509f0da7fd69b9`
**Item/boundary:** HP-TC10 only; all unmodified receipt profiles, correlation,
evaluation, retention, diagnostics, tests, and no-authority clauses remain frozen

## Exact correction

The action-capable reconciliation exception is removed in full. Reconciliation
is strictly non-mutating observation through a qualified provider query/read-
back primitive. A primitive that can create, advance, repeat, retry, complete,
cancel, or otherwise change the effect is action-capable regardless of provider
label, HTTP method, idempotency documentation, or response shape and is never
admissible as reconciliation.

`ReceiptReconciliationProfileV1` now binds a protected proof that its exact
provider primitive is non-mutating for every possible lookup result and state,
including present, absent, expired, unknown, tenant/account mismatched,
unauthorized, incomplete, rate-limited, unsupported, and contradictory keys.
The proof covers request bytes, endpoint/method, provider version, tenant scope,
redirect behavior, pagination, callbacks, webhook triggers, and every qualified
state transition. Any unproven branch makes the profile `UNAVAILABLE`.

The protected broker rejects any reconciliation request whose serialized bytes
match an action-capable endpoint or whose qualified effect classification is not
exactly `READ_ONLY_QUERY`. The same idempotency key does not make an action call
a query. No user continuation, new approval, retry budget, new nonce, session,
attempt, or active set converts an ambiguous effect into safe redispatch.

## Deterministic outcome rule

After `DISPATCH_STARTED`, a missing response remains `AMBIGUOUS` until a
qualified non-mutating query returns an admissible correlated observation.
`NOT_FOUND` proves no effect only when the frozen provider profile establishes
that this exact authoritative query is complete after the maximum visibility
window. Absent/expired/unknown/mismatched keys, unavailable query capability,
incomplete pages, provider ambiguity, or failure of the non-mutation proof leave
the outcome `AMBIGUOUS|UNAVAILABLE|CONTRADICTORY` as applicable and block same-
effect redispatch. They never trigger the original action primitive.

## Corrected verification properties

Negative vectors substitute the action endpoint for the query endpoint, reuse
the same idempotency key, relabel create-or-return-existing as read, and exercise
present, absent, expired, unknown, tenant-mismatched, unauthorized, partial,
redirected, rate-limited, and contradictory results. Every action-capable or
unproven branch must reject without sending it and preserve ambiguity.

Mutation tests remove each provider non-mutation proof branch and endpoint/
method/effect classification. Property tests prove reconciliation sends only an
exact qualified `READ_ONLY_QUERY`, never creates or advances an effect, and
never makes ambiguity retry-eligible.

## Review request

Review only whether this repair removes the action-capable reconciliation
exception and makes every reconciliation path provably non-mutating, including
absent/expired/unknown/tenant-mismatched keys. Closure requires Codex 93+ and
0 failed/security/dissent/questions.

Do not inspect other files, use tools, invoke Opus, implement, call a provider,
use credentials, perform external actions, commit, push, deploy, publish, edit
reports, or close another HP item.
