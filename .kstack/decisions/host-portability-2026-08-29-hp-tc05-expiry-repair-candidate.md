# HP-TC05 expiry repair candidate: empty lifetime emits no eligibility record

**Thread:** `host-portability-2026-08-26`  
**Item:** `HP-TC05` only  
**Trigger:** implementation cross-item consistency check  
**Preserved:** all HP-TC05 precedence, alternate, quarantine, epoch, handoff,
diagnostic, and no-authority boundaries not expressly changed below

## Exact contradiction

HP-TC05 says a zero or already-expired lifetime intersection yields an
`UNSUPPORTED` eligibility result and also says the implementation never
extends another object's lifetime. HP-TC01's frozen `OperationEligibilityV1`
invariant requires `evaluatedAt < expiresAt` for every emitted eligibility
record. No canonical `OperationEligibilityV1` can simultaneously represent an
empty lifetime and satisfy that invariant.

## Repair

When the exact lifetime intersection is empty at the trusted evaluation time,
the evaluator returns the stable terminal error
`KSTACK_ELIGIBILITY_EXPIRED` and emits **no** `OperationEligibilityV1`.
Callers treat absence of a record as ineligible and must obtain a new complete
protected input snapshot before reevaluation.

The implementation must not:

- set `expiresAt` after the true minimum;
- create a one-millisecond synthetic lifetime;
- reuse a prior eligibility record;
- select an alternate;
- reinterpret an expired input as current; or
- hand an eligibility digest/epoch to HP-TC11.

This is more fail-closed than emitting `UNSUPPORTED`: there is no reusable
eligibility artifact at all. It preserves HP-TC01 bytes and avoids weakening a
previously validated invariant.

## Verification

Positive vectors retain the exact earliest non-empty expiry. Boundary vectors
set the minimum expiry equal to and earlier than `evaluatedAt`; both require
`KSTACK_ELIGIBILITY_EXPIRED`, no eligibility record, no alternate, and no
action-fence handoff.

## Review request

Review only whether the no-record terminal error is the unique non-extending
repair compatible with HP-TC01's strict eligibility-time invariant. This
repair does not close HP-TC05 or any later item and receives no independent
final-review credit until the complete HP-TC05 implementation reaches the
repository's 93% primary threshold.
