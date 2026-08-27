# W3 owner-question readback rule

**Decision ID:** `W3-Q-READBACK-ACK`
**Status:** `LOCKED`
**Owner answer:** `No`
**Scope:** worker-first orchestration owner-question relay only

## Full question shown

Before any owner answer may be written to a locked decision, used to alter a
plan/design/implementation, or dispatched to a worker, should KStack require
the owner to explicitly confirm the displayed per-question readback? This
applies only to owner-decision questions, not routine status updates. The
confirmation would cover each stable ID/topic, recorded Yes/No/Comment answer,
and its complete operational and safety/scoping meaning; without confirmation
the item would remain owner-blocked and the answer would grant no authority.

The recommended answer was Yes because it creates an unambiguous acknowledgment
barrier. The stated tradeoff was one extra confirmation turn for Yes versus a
faster proceed-unless-corrected model for No, with the residual risk that an
unnoticed mapping error or lost qualification could affect scope or authority.
`Comment` allowed qualifications, alternate wording, conditions, or additional
direction.

## Locked readback

`W3-Q-READBACK-ACK / Explicit owner acknowledgment before answer lock -> No`.

Meaning: KStack does not require a second explicit confirmation turn after it
displays the complete per-question readback. After that readback it may lock the
mapped answer or dispatch it to the affected worker unless the owner corrects
the mapping. Full question wording, separate exact `Yes`, `No`, and `Comment`
choices, stable ID/topic, recorded answer, and complete operational and
safety/scoping meaning remain mandatory. The owner accepts the faster
proceed-unless-corrected model and its residual unnoticed mapping/authority
risk. This answer grants no broader permission or implementation authority.
