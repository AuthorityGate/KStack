# Reasoning-effort policy — accepted round-67 bug closure

**Accepted score endpoint:** Codex 97, Opus 74, combined 74
**Owner minimum:** 72
**Review invocation:** `3a0b46bc-928b-42ae-b79c-2a57867f48e5`
**Reviewed digest:** `4deed468beb41a517e72e05f6c0335e678e93cc8e8caab34798345b5dc858153`

No additional score-improvement round follows. This addendum corrects only the
membership-test and fixture bugs reported against the accepted round.

## Directly observable membership boundary

Membership is tested through one pure, module-private classifier with an exact
two-value result: `VALID_MEMBER` or `INVALID_MEMBER`. It first rejects every
non-string primitive/object with `INVALID_MEMBER`, then uses an exhaustive
`switch` over these seven literal strings:

- `destructive-if-approved`
- `formal-proof`
- `mission-critical-security`
- `multi-repo-refactor`
- `optimization`
- `production-change`
- `sensitive-data`

Each exact case returns `VALID_MEMBER`; `default` returns `INVALID_MEMBER`.
There is no mutable Set, object/prototype lookup, coercion, trimming,
normalization, case-folding, or alias resolution. The resolver maps
`INVALID_MEMBER` directly to `REASONING_POLICY_INPUT_INVALID`. This makes the
positive side directly observable and removes the allow-list mutation concern
rather than attempting to freeze a mutable Set.

## Corrected fixture contract

The test declares its own seven positive literals independently of production
code and asserts all of the following before executing rows:

- exactly 31 rows exist;
- exactly 24 are invalid rows;
- exactly seven are positive rows;
- the seven positive values are distinct and equal, as a set, to the seven
  independently written expected literals; and
- every invocation receives a fresh one-element array with own index 0.

Each positive row must return exactly `VALID_MEMBER` from the classifier and
must not throw. Each invalid row must return exactly `INVALID_MEMBER`; the
resolver boundary must then return exactly `REASONING_POLICY_INPUT_INVALID`.
This kills reject-everything and other-non-invalid-result mutants without
claiming ownership of the later resolver result shape.

The three coercion fixtures are counter-bearing closures, not the counter-free
literals printed in round 67. Each hook increments a per-row counter before
returning `"optimization"`; every counter must remain zero. `undefined` is
constructed as literal `[undefined]`, not a hole.

Assertions identify rows only by the fixed human-readable row name. They never
serialize, interpolate, concatenate, key by, or otherwise reflect the row
value. The invalid result likewise carries only its fixed discriminant and
never the rejected value. Symbol and BigInt rows therefore cannot throw in the
test harness or invalid path.

## Accurate normalization claim

The fullwidth row kills NFKC/NFKD compatibility-normalization mutants. The
combining-mark row kills mark-stripping mutants. No claim is made that the
table kills NFC/NFD-only calls: the allowed vocabulary is ASCII and those calls
are behaviorally inert for the positive literals. The former blanket “Unicode
normalization mutant” claim is withdrawn.

## Closure

The representative invalid-member coverage is retained. Positive membership
is now exact and observable, hook counters are realizable, table integrity is
non-vacuous, Symbol/BigInt cannot be broken by diagnostics, invalid values are
not reflected, and the mutable-allow-list concern is eliminated.
