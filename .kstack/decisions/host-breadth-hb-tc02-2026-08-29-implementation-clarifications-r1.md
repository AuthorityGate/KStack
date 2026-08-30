# HB-TC02 implementation clarifications r1

Date: 2026-08-29  
Scope: bounded implementation meaning only; the frozen HB-TC02 design and its
authority boundary are unchanged.

## Pointer observation meaning

At the destination-classifier boundary, `pointerProfileValid` means that the
observed destination entry itself has been validated as the exact KStack-owned
pointer form allowed by the matching qualified installer profile. It is not a
statement merely that some registry profile supports pointers.

The pointer observation is mutually exclusive with `regularDirectory` and
`emptyAfterSystemEntries`. Any contradictory combination, any absent entry
carrying present-entry facts, or any pointer observation without exact
ownership, active-receipt, and installed-manifest evidence classifies as
`FOREIGN_OR_UNKNOWN`. No activation strategy is admitted from that state.

## Live state binding

`observedState` supplied to activation admission is the exact result of the
required live destination remeasurement. It is mandatory for every activation
binding variant. Tree and pointer variants require it to equal the state frozen
in their addressed binding; host-native variants require it to be a member of
their exact closed supported-state set. Missing, unknown, foreign, or mismatched
values return `ATOMIC_ACTIVATION_UNAVAILABLE` before `PREPARED`.

## Installer-health canonical form

Installer-health `testResults` are a set keyed by unique `testId` and serialized
in ascending UTF-8 byte order. Construction may sort caller results, but
validation at the active-receipt trust boundary accepts only the already
canonical order. Duplicate or reordered results are invalid and cannot produce
an alternate health digest or active-install receipt for the same facts.

Test identifiers use the closed lowercase ASCII grammar with `.`, `-`, or `_`
separators. The underscore is admitted specifically so executable regression
fixtures can distinguish UTF-8 byte order from locale collation without using
Unicode or ambient locale assumptions.
