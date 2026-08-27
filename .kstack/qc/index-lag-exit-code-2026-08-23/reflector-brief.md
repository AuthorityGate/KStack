# Reflector task: exit-code taxonomy defect

You are the Reflector. You did NOT produce the failed work (Codex was the
Actor for this task). Your job: read the task that framed the Actor's
original work, the Actor's output, and the QC critique verbatim below, then
produce EXACTLY ONE forceful one- or two-sentence rule starting with `ALWAYS`
or `NEVER`, plus a one-clause `why`. Nothing else.

## Task that framed the Actor's original work

Add a dedicated exit code (`EXIT.INDEX_LAG_BLOCKED = 20`) to
`plugins/kstack/scripts/kstack-jira.mjs` distinguishing ONE specific
owner-approved case — "a completed zero-match search occurred, but the
youngest unresolved marker is younger than the 30-second index-lag age
floor" — from two other pre-existing "unavailable" cases (poll exhaustion,
search failure) that were explicitly instructed to keep exiting the generic
`EXIT.STATE_ERROR` (2). The task was scoped narrowly: exit-code selection
only, no detection-logic changes, and explicitly NOT a case the owner had
approved expanding beyond the stated marker-age scenario.

## The Actor's output (the defect)

The Actor's diff tagged `preMutationDuplicateGate()`'s blocked-with-
unavailable result with `reason: 'index-lag'` whenever a completed
zero-match search's youngest marker age was below the floor — but the age
computation (`youngestMarkerAgeMs()`) returns `0` (not `Infinity`, not an
error) whenever ANY marker in the set has an unparseable/missing timestamp
(`Date.parse(marker.at)` is `NaN` → the function returns `0` immediately).
An age of `0` is always `< minimumMarkerAgeMs` (30000ms), so a marker with a
malformed timestamp is PERMANENTLY misclassified as "index-lag" (a
signal callers are meant to read as "transient, safe to wait and retry")
when it is actually a malformed-audit-data case needing human intervention
— the exact opposite of what exit 20 is supposed to mean. The Actor's own
test suite change (flipping the assertion in the pre-existing test "blocks a
marker with a missing timestamp" from `EXIT.STATE_ERROR` to
`EXIT.INDEX_LAG_BLOCKED") enshrined this defect as expected behavior instead
of catching it — the test was updated to match the code's new (wrong)
behavior rather than the code being checked against the test's original
(correct) expectation.

## QC critique verbatim (both independent reviewers converged on this)

**Codex (confidence 91, decision revise):** "The missing-timestamp test now
expects exit 20, but a marker with no timestamp is not demonstrably younger
than the 30-second floor. It can remain blocked indefinitely, contradicting
the defined meaning that exit 20 applies solely while waiting for index
lag." strongestObjection: "Exit 20 is defined as a temporary wait-for-index
condition, but the changed missing-timestamp test assigns it to malformed
evidence whose age cannot be calculated and may never become eligible,
making the public exit-code contract inaccurate."

**Opus (confidence 62, decision revise):** strongestObjection: "The change
quietly reclassifies a case the owner never approved... A timestampless
marker has no measurable age; if youngestMarkerAgeMs treats it as age 0 it
can never satisfy the floor, so the CLI would be telling callers 'wait and
retry' about a draft that is permanently stuck and actually needs human
repair — the exact opposite of what the new code is supposed to signal, and
a regression from the generic exit 2 that correctly meant 'operator
intervention required'."

## What to produce

Exactly one rule, starting with `ALWAYS` or `NEVER`, plus one clause of why.
Example shape (do not copy verbatim — write your own): "NEVER classify an
unmeasurable or malformed condition under an exit code whose contract
promises the caller a bounded, retryable wait — because a caller that trusts
that contract will retry forever against a state that can never resolve."
