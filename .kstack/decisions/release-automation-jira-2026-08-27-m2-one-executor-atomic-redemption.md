# Release Automation M2 - pass 3 issuance and interval corrections

**Frozen pass 1:** `d6485545b59457e9cabcb183aab56e069ba5a58cf9686446c8c006c998320be2`  
**Frozen pass-2 correction:** `ae2a847ba37e6dd73488a8fff0fc45e4067870378148b18ac7dd912d1bfc8ba4`  
**Prior Codex:** 96 revise in 331003 ms  
**Status:** architecture frozen; seven reported defects only

All prior provisions remain normative except the exact issuance, anti-rollback,
receipt, seam-fixture, and uncertainty clauses replaced below.

## Immutable logical issuance slot

The approved release plan supplies a canonical nonempty `operationIntentId`
bound into the exact M1 approval evidence before issuance. It identifies one
logical requested operation, independent of whichever host races to issue it.
The trust-domain issuance slot is:

```text
IssuanceSlotKeyV1 = DomainHash(
  "kstack.release.operation-slot.v1",
  trustDomainId, repositoryId, releaseId, operationIntentId,
  operationKind, targetId, targetDigest, artifactDigest,
  resourceClaimDigest, approvalEvidenceDigest
)
```

`OperationReservationV1` and the signed token add `operationIntentId`,
`issuanceSlotKey`, and the actual nonempty `nonce`. The primary store enforces
durable uniqueness over issuance-slot key, operation ID, nonce, and token digest
across active/history. The independent authority enforces the same issuance-
slot uniqueness in rollback-resistant history. Different proposed operation
IDs, nonces, or token digests still conflict on the same slot, so one logical
intent has exactly one issued reservation.

## Issuance is externally anchored

The independent M7-owned monotonic authority commits all three ordered phases:
`issued`, `consumed`, and `dispatching`. Each commitment includes trust domain,
issuance slot, release/operation/attempt as applicable, exact primary-record
digest, fence, phase, and next monotonic sequence.

Issuance runs under the protected release aggregate/fence:

1. Verify that current primary history exactly matches the independently read
   external head for this trust domain/aggregate. Any absence, regression,
   ahead/behind/conflict, or unavailable head quarantines writes.
2. Commit one primary `issued-pending-anchor` record with all four unique keys.
3. Obtain the external `issued` commitment, whose CAS also rejects any historical
   reuse of the issuance slot or keys.
4. Mark the primary reservation `issued` with the exact external sequence and
   commitment digest. Only then sign/return the token.

Crash before external issuance produces no usable token and recovery reconciles
the pending record. Crash after external issuance cannot permit a second issue:
the external slot/key history wins even if primary data rolls back. Restore must
reconstruct/quarantine; no token, reservation, or key is recycled.

## Unconditional external-head admission

Reading and matching the current external monotonic head is a mandatory
precondition before issuance, token presentation acceptance, `issued ->
consumed`, `consumed -> dispatching`, provider-call eligibility, and any later
state transition—not merely startup/recovery. The check and each external phase
commit serialize under the M7-protected aggregate sequence. A stale replica or
live primary rollback therefore sees an ahead/conflicting external head and
cannot accept, consume, dispatch, call, or reissue. External authority
unavailability is fail-closed, never cached as current.

The provider call requires both a primary `dispatching` record and its matching
external `dispatching` acknowledgment at the current head. Until M7 validates
this exact mechanism, the adapter remains observer-only.

## Exact receipt outcomes and chain genesis

The closed crash mapping is:

- primary `consumed` with no external consume acknowledgment: no call was
  eligible; authenticated recovery emits consumed-attempt `not-attempted`;
- external consume acknowledged, but no primary `dispatching`: no call was
  eligible; `not-attempted`;
- primary `dispatching` with no matching external dispatch acknowledgment: no
  call was eligible; `not-attempted`;
- matching external dispatch acknowledgment exists and no authenticated final
  outcome exists: `possibly-acted`, even if no seam-crossing record survived;
- authenticated provider no-effect/success evidence strengthens outcome only
  under the frozen adapter contract.

Every receipt chain uses this required closed union:

```text
priorReceipt = { kind: genesis, value: DomainHash(
  "kstack.release.receipt-genesis.v1", trustDomainId, releaseId
)} | { kind: prior, digest: <canonical-prior-receipt-digest> }
```

The first rejection or attempt receipt uses the domain-separated genesis; all
later receipts use the exact prior digest. Empty/null/sentinel values reject.

## No broker-controlled replay exception

Replace the pass-2 seam fixture and rule with: every KStack-controlled adapter,
SDK, HTTP client, redirect handler, auth refresher, proxy, queue, hedge, and
failover path is disabled for mutation replay or independently proven single-
send below the counted seam. No provider idempotency primitive excuses a
broker-controlled retry or second outbound request. Provider-native idempotency
is defense only against network/provider duplication after the one request.
Each injected replay mechanism must either produce qualification failure or
remain physically incapable of a second seam crossing; the count is at most 1.

## Exact uncertainty interval

`AdapterQualificationPolicyV1` replaces the bare horizon with three protected,
digest-bound nonnegative bounded integers:

```text
recoveryAndOutageBudgetMs
providerVisibilityLagBoundMs
reconciliationExecutionBudgetMs
uncertaintyWindowMs = checked_add(
  recoveryAndOutageBudgetMs,
  providerVisibilityLagBoundMs,
  reconciliationExecutionBudgetMs
)
```

The terms are conservatively additive; no overlap or `max` substitution is
allowed. Overflow, missing value, unbounded/undocumented provider visibility,
or inconsistent declared sum fails qualification. The interval begins at the
authoritative provider time bound to the external `dispatching` commitment and
ends inclusively at `start + uncertaintyWindowMs`. Provider idempotency
retention and authoritative correlation/no-effect lookup coverage must each
cover the full inclusive interval for the exact account/target. A later first
ambiguity observation never shortens or restarts it.

## Verification delta

- Race different operation IDs/nonces/token digests for one approved intent;
  exact issuance-slot conflict gives one winner in primary and external history.
- Crash/rollback before/after every issuance primary/external step; no returned
  token precedes anchor and no external slot/key can be forgotten or reissued.
- Before every admission/transition, inject stale replica, live rollback,
  unavailable/ahead/behind/conflicting external head; assert quarantine/no call.
- Exercise every consume/dispatch anchor crash point and assert the exact
  `not-attempted` versus `possibly-acted` mapping above.
- Prove first and later rejection/attempt receipts use exact genesis/prior union;
  reject missing, null, sentinel, wrong-domain, and forked chains.
- Inject each broker-controlled replay path; provider idempotency never converts
  a second seam crossing into a pass.
- Boundary-test checked additive arithmetic, overflow, inclusive interval start/
  end, delayed ambiguity observation, provider retention, and lookup coverage.

## Review request

Review only whether these pass-2 defects are closed. Do not reopen sole-broker
architecture, M1, adjacent items, or owner decisions. Report concrete defects
and genuine owner questions. Codex-only; no Opus or implementation authority.
