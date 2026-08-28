# KCRP R2f addendum — final two serialization bug fixes

**Status:** DESIGN CANDIDATE ADDENDUM — TWO R2f DEFECTS FIXED IN DESIGN ONLY  
**Date:** 2026-08-27  
**Parent SHA-256:** `879942237c11baf9275652357039bfa276d84237a81eccec56b3477465c26d96`  
**R2a SHA-256:** `b5e552904ce6a6e073436c8b84925a8f1a968468febc92bb141fd4e40732b442`  
**R2b1 SHA-256:** `7a8cc6e28197db582a6ffd5dfe82076b8f2bd2f7b85aeb2912387aabb11edff4`  
**R2b2 SHA-256:** `172e82369de54bc68977f5d59555cff8e5467c73bfa94008fd7ce57abaf8d4c7`  
**R2c SHA-256:** `903b836f6f7168555617fe132540db7b386f1753dae49073af9413676c645577`  
**R2d SHA-256:** `1f0363cf1bb31ab84e76dd18dd8d8548dcfabd00088fd2a8829d9fe7f2add109`  
**R2e SHA-256:** `25691e8af02370cbfb6716c11632d48d229aa84424055e5fb759e6b71cd230a6`  
**Scope:** these two corrections only; all other frozen contracts remain

## 1. Corrected map-discovery predispatch row

R2d section 2's `map-discovery` row is replaced by this exact row:

| contextStage | policy/primitive | thread registry | map receipt | finding registry/receipt | reductionFailure |
|---|---|---|---|---|---|
| `map-discovery` | both non-null | non-null | non-null bound `error`; non-null bound `oversized` only for terminal `full-required`; or null only when receipt creation/retention fails | both null | null |

The corresponding sole block is respectively the error receipt's matching
terminal discovery block, `KCRP_MAP_TOO_LARGE`, or the exact closed receipt-
unavailable/overflow code. No other receipt status, null, route, or block
combination is legal.

A reduced-route oversized map does **not** emit this terminal predispatch row.
It retains the bound `oversized` receipt, sets the non-null map-overflow
`reductionFailure`, makes the already-authorized single full-fallback attempt,
binds that receipt into the
full-fallback manifest, and remains non-closing. This changes no fallback count
or full-required behavior.

## 2. Complete effective-policy field list

R2e's consolidated exact `effectivePolicy` list is replaced only to restore the
required governance winner object:

```text
registrySha256, configSha256, applicableRuleIds, applicableArtifactSha256s,
effectiveRuleByClass,
phase, purpose, round, requiredReviewers, reviewerAssignments,
minimumConfidence, requireZeroFailedChecks, requireZeroSecurityFindings,
requireZeroMaterialDissent, requireZeroUnresolvedQuestions, requiredCheckIds,
highRisk, providerUnavailableBehavior, authorityDigest,
phasePrimaryRootMode, discoveryPrimitive
```

`effectiveRuleByClass` is required and has exactly the six ordered keys
`authority`, `review-routing`, `confidence-gate`, `artifact-policy`,
`phase-procedure`, and `owner-supersession`. The first five values are the exact
non-null effective winner rule IDs. `owner-supersession` is the exact winner
rule ID or null when no applicable owner-supersession entry exists. The R2b1
same-class chain/cardinality rules and canonical policy digest binding remain
unchanged; missing, extra, unresolved, or wrongly null winners are a
terminal governance failure.

Fixtures must cover every map-discovery receipt/route/block combination, prove
reduced oversized fallback remains single and non-closing, and reject every
missing/extra/key/null mutation of `effectiveRuleByClass`.

**Self-score:** 99/100 for these two R2f defects only. This is not independent
review or activation evidence. No runtime, configuration, Opus, commit, or push
work is performed by this addendum.
