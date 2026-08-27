# W3 owner decision: provider-error multiplicity

**Decision ID:** `W3-Q-ERROR-MULTIPLICITY`
**Status:** `LOCKED`
**Owner answer:** `Yes`
**Scope:** W3 dashboard error accounting only

## Full question shown

When multiple distinct provider invocations fail because of one underlying
manifest defect, should W3 count each failed invocation as a separate open
error while retaining the shared root-cause grouping and evidence separately?
Repeated rendering or observation of the same invocation must never increment
the count. The recommended answer was **Yes** because the dashboard then remains
audit-faithful to every failed attempt; the tradeoff is that visible error count
tracks affected invocation volume rather than only the number of root causes.
`No` would group all affected invocations into one open root-cause error, while
`Comment` allowed qualifications, alternate wording, conditions, or direction.
W3 remediation and review remained blocked pending this choice.

## Locked readback

`W3-Q-ERROR-MULTIPLICITY / distinct failed provider invocations -> Yes`.

Meaning: count each distinct failed provider invocation separately while it is
open. Repeated rendering or re-observation of the same invocation never
increments the count. Retain the common root-cause grouping and its evidence as
a separate field; root-cause grouping never collapses the per-invocation open
error count. This answer affects only W3 reporting semantics and grants no
implementation or external-action authority. Under the previously locked
`W3-Q-READBACK-ACK=No`, this complete readback is locked without another
confirmation turn unless corrected by the owner.
