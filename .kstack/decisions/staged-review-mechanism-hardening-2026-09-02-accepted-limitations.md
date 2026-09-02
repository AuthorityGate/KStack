# Accepted limitations — staged review mechanism hardening

**Thread:** `staged-review-mechanism-hardening-2026-09-02`
**Status:** non-authorizing, out-of-band governance record. Not part of the
reviewed design set, not digest-bound, and not submitted to the primary or
independent final reviewer.

## Why this file is out of band

Owner decision, 2026-09-01. The staged review loop evaluates mechanism and code
quality. It is not an authority on whether a human governance decision happened,
and asking it to bless one produces a circularity with no exit: a reviewer that
correctly refuses to treat an agent-written record as proof of human acceptance
will refuse the record that says relayed acceptances are sufficient, because that
record is itself agent-written.

The fix is to remove the question from the review's scope rather than to satisfy
it. Residual limitations accepted by the owner are recorded here. The decision
brief references this file as accepted, out-of-band context and does not ask a
reviewer to evaluate, ratify, or re-derive it.

This follows the established pattern of
`.kstack/decisions/secret-broker-2026-08-28-delivery-status.md`, which lives in
the decisions directory while appearing in neither the accepted-design set nor
the release manifest's contract digests.

## What this file does not do

It amends no objective and narrows no accepted design. It confers no acceptance
on any mechanism defect. A defect the mechanism can actually close does not
belong here; these are limits of what the mechanism can establish at all.

## Accepted limitations

### 1. Reduced independent coverage during repair cycles

The ordered workflow concentrates the second perspective in the terminal
independent review rather than placing it in every repair cycle. That is the
point of the design — one fewer agent invocation per improvement cycle — and the
cost is that fewer perspectives examine a design while it is still being
repaired.

Evidence on the tradeoff's strength, recorded rather than assumed: in the
predecessor thread's fourth cycle the primary approved at confidence 96 with zero
findings across all four structured arrays, and the independent final reviewer
then returned six failed checks, six security findings, three material dissents,
and nine unresolved questions against that same brief. The terminal pass catches
what the primary misses. The surrounding authority gates are unchanged.

Accepted by the owner, 2026-09-01.

### 2. The aggregator limit on provider-family separation

Provider-family separation rests on the assumption that two separately
identified vendors operate separate service-side state domains. An aggregator or
gateway fronting both vendors would present two vendor identities over a single
service-side domain and defeat the separation without the check being able to see
it. That case is not detected.

The check remains fail-closed in every direction it can see: an unidentifiable or
ambiguous family leaves the backend unavailable, and two merely unidentified
backends compare equal and are refused rather than assumed distinct.

Accepted by the owner, 2026-09-01.

### 3. Disposition authority is attestation-only

A disposition record names a human role, a person, an attestation time, and binds
to the exact final review's envelope digest. The runner has no code path that
writes one, and every reviewer is spawned without a write primitive, so nothing
in the workflow can author its own discharge.

The mechanism cannot prove a human authored the record. Providers and operator
run as the same operating-system user — the same reason the local evidence set
carries no signatures. The check rejecting a record that attributes itself to an
agent is a tripwire, not a proof.

The stronger control that would close this — denying the record's path to every
agent tool surface in the repository through the safety hook — is deliberately
not built, because its blast radius is every agent session in the repository
rather than this thread.

Accepted by the owner, 2026-09-01.

### 4. Isolation measurement detects literal persistence only

The cross-run isolation measurement establishes that the literal probe value did
not persist into the configuration files a dispatch modified. It does not detect
content a provider transformed, encoded, or summarised before writing, content
stored outside the observed modified files, or what a later run can read back.

The measurement stands as bounded evidence for write-side non-persistence of the
dispatched value, not as a general cross-run non-observability property, and the
design states it at that strength.

Accepted by the owner, 2026-09-02, as the scope of what this method establishes.

## Open, not accepted

Service-side configuration and account policy remain outside the measurement
identity because neither provider exposes an interface reporting account policy,
model routing, or server-side feature state, and the version probe is itself
client-reported. This is recorded as an open limit rather than an accepted one:
no owner decision closes it, and a future provider interface could change it.
