# Known gap: D3 has no legitimate authorization path for D5 catalog-snapshot transitions

Status: TRACKED, NOT BLOCKING — deferred to a future design session

## What this is

Found while closing KSTK-57's independent-review finding
`KSTACK-D3-CLASSIFIER-PROVENANCE-01`/`-02` (a defect where D3's weakening
classifier trusted an unauthenticated, caller-declared receipt). The real fix
(see `plugins/kstack/scripts/kstack-domain-separation.mjs`) requires every
`kstack-weakening-classifier-receipt` to be minted by exactly one internal
function, `mintClassifierReceipt`, called only from `classifierReceipt()`'s
own two branches, and tracked in a `WeakSet` (`CLASSIFIED_WEAKENING_RECEIPTS`)
so `authorizeWeakening` can verify a receipt was actually produced by that
code path rather than merely shaped like one.

`classifierReceipt()` only understands `kstack-policy-state` semantics — it
parses `beforeBytes`/`afterBytes` as policy-state documents and classifies the
transition from fields like `quarantinedPacks` and `catalogGeneration`. It has
no notion of a `kstack-pack-catalog-snapshot` transition (D5's schema).

D5's activation flow (`kstack-domain-activation.mjs`) needs to authorize
weakening actions for catalog-snapshot transitions (pack disable/downgrade,
quarantine reversal, required-pack waiver at the catalog level) through the
same D3 quorum mechanism. There is currently no legitimate way for it to get a
real, provenanced D3 classifier receipt for that kind of transition — the only
way to produce one today is to hand-build the object literal, which the fixed
`authorizeWeakening` now correctly rejects with
`WEAKENING_CLASSIFIER_PROVENANCE_INVALID`.

This was previously masked by a test that hand-built the receipt directly
(bypassing D3's provenance check) and by a short-lived attempt to fix it with
a public `createWeakeningClassifierReceipt` export — round-2 independent
review showed that export was an unconstrained minting oracle: shape-valid,
but it let a caller assert any `action`/`reasonCodes` pair as truth, which
reopens the exact vulnerability this fix exists to close. That export has
been removed.

## What's already true (real, shipped defense in depth)

D5's `commitPackActivation` does not blindly trust an authorization at
consumption time — it independently re-derives `liveClassification` from the
real, currently-validated catalog data and cross-checks it against the
authorization's bound `action` via `validateWeakeningTransitionUse`, failing
closed on any mismatch (`WEAKENING_TARGET_STALE`). So even a forged or
mislabeled authorization (were one somehow obtained) would be caught at
commit time for the one caller that exists in this repo today. This does not
make D3's `authorizeWeakening` sound on its own terms — the review is
correctly scoped to the module's own contract, not to what one particular
caller happens to additionally check — but it means the currently-untestable
D5 path is not an active exploitable hole in the shipped system, only an
honest gap in what can be legitimately constructed and tested end to end.

## Current state

`tests/domain-schema.test.mjs`'s `catalogWeakeningAuthorization` test helper
(used by the "D5 activation challenge, staging, authenticated CAS, and exact
recovery are fail closed" test) now asserts that hand-building a classifier
receipt correctly fails with `WEAKENING_CLASSIFIER_PROVENANCE_INVALID`,
instead of asserting a full authorized-disable commit succeeds. There is no
positive-path test for an authorized catalog-transition disable/downgrade
commit until the real mechanism below exists — that gap is intentional and
should not be papered over with another hand-built object.

## Recommended real fix (future design session, not KSTK-57 scope)

Mirror the pattern already used between D1 and D2: D2 never mints a D1
receipt itself, it verifies one that D1 already produced
(`assertConsumedIdentityActionResult`). D3 should do the same for D5: require
D5 to supply its own provenance-verifiable classification of a catalog-snapshot
transition (derived and tracked the same way D5 already tracks other
provenanced artifacts), and have D3 verify that object rather than accepting
caller-declared `action`/`reasonCodes` fields directly.

This is real cross-domain design work, not a local fix:
- It touches `kstack-domain-activation.mjs` (D5's file, out of scope for
  KSTK-57).
- It likely requires either a new shared/lower-level module both D3 and D5
  can depend on, or a carefully justified one-directional import — D3's
  current import manifest is pinned by
  `tests/reflexion-architecture-gate.mjs` and does not include D5.
- A rejected alternative (having D5 bind its weakening request to a
  `kstack-policy-state` transition instead of its own catalog-snapshot
  schema, just to fit D3's existing classifier shape) was considered and
  explicitly rejected — it would force a semantic lie into the classifier
  (labeling a catalog-snapshot transition as a policy-state one) rather than
  fixing the actual boundary.

Route this through `kstack-design` when picked up.
