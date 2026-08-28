# KCRP R2e addendum — serialization bug fixes

**Status:** DESIGN CANDIDATE ADDENDUM — SIX SERIALIZATION RESIDUALS FIXED IN DESIGN ONLY  
**Date:** 2026-08-27  
**Parent SHA-256:** `879942237c11baf9275652357039bfa276d84237a81eccec56b3477465c26d96`  
**R2a SHA-256:** `b5e552904ce6a6e073436c8b84925a8f1a968468febc92bb141fd4e40732b442`  
**R2b1 SHA-256:** `7a8cc6e28197db582a6ffd5dfe82076b8f2bd2f7b85aeb2912387aabb11edff4`  
**R2b2 SHA-256:** `172e82369de54bc68977f5d59555cff8e5467c73bfa94008fd7ce57abaf8d4c7`  
**R2c SHA-256:** `903b836f6f7168555617fe132540db7b386f1753dae49073af9413676c645577`  
**R2d SHA-256:** `1f0363cf1bb31ab84e76dd18dd8d8548dcfabd00088fd2a8829d9fe7f2add109`  
**Scope:** bug-fix-only serialization closure; all predecessor routing, safety,
authority, threshold, and non-closing rules remain unchanged

## 1. Legal predispatch overflow states

R2d's predispatch receipt field list remains exact. Its `contextStage` enum is
now exactly:

```text
governance|thread-registry|map-discovery|finding-registry|
finding-discovery|construction|size
```

The two missing legal rows are:

| stage and sole block code | policy/primitive | thread registry | map discovery | finding registry | finding discovery | reductionFailure |
|---|---|---|---|---|---|---|
| `thread-registry` / `KCRP_THREAD_REGISTRY_TOO_LARGE` | both non-null | null | null | null | null | null |
| `finding-registry` / `KCRP_FINDING_REGISTRY_TOO_LARGE` | both non-null | non-null | non-null successful digest | null | non-null `oversized` digest | null |

The thread-registry row is reached only after effective policy and the qualified
primitive are bound but before a canonical registry digest exists. The finding-
registry row preserves all earlier bindings; only the oversized registry's
content digest is unavailable. Both are terminal, start no scanner/provider,
and never select full fallback. All other stage rows remain exactly R2d.

## 2. Oversized safely discovered target

The discovery `status` enum adds `oversized`. It is legal only when a qualified,
no-follow descriptor observation establishes stable parent/object identities
and `observedRawByteLength > KCRP_CONTROL_JSON_MAX_BYTES`, then revalidates the
same descriptor identity. Its exact state row is:

| status | target | identities/length | content digests | absence/error | block |
|---|---|---|---|---|---|
| `oversized` | item-map or finding-registry | parent, object, and length non-null | raw and canonical SHA-256 null | both null | exact target overflow block |

The target overflow block is `KCRP_MAP_TOO_LARGE` for item-map or
`KCRP_FINDING_REGISTRY_TOO_LARGE` for finding-registry, stage `construction`,
with non-null bounded `evidenceSha256`. KCRP does not stream, decode, parse, or
hash oversized content. The receipt binds identity and length only.

For item-map, `registrySha256` and `selectedEntrySha256` remain the non-null
thread-registry and selected-entry bindings. For finding-registry,
`selectedEntrySha256` remains the non-null registered artifact binding while
`registrySha256` is null because canonical target bytes were never produced. This is
the only legal null `registrySha256` on a retained discovery receipt.

For a reduced item-map request this becomes the original non-null
`reductionFailure` and permits exactly the already-authorized one full-fallback
attempt. A resulting full-fallback manifest binds the `oversized` discovery
receipt, uses `itemMapSha256:null`, and cannot close. A full-required request
with a registered-present oversized map is terminal. An oversized finding
registry is always the terminal predispatch state in section 1.

## 3. Predispatch aggregate nullability

For aggregate `status=predispatch-blocked`,
`predispatchBlockReceiptSha256` is non-null and `providerResults` is empty. The
policy matrix is exact:

| predispatch receipt policy digest | aggregate policy digest | requiredReviewerIds |
|---|---|---|
| null because policy resolution did not complete | null | empty array |
| non-null | same non-null digest | exact policy `requiredReviewers` order |

No other combination is valid. A pre-policy block does not invent reviewers;
a post-policy block does not erase them. No provider-request ID is allocated and
no provider result is synthesized for a predispatch-blocked invocation.

## 4. Policy-caused early stop

Aggregate provider outcome adds terminal local `not-attempted`. It represents a
remaining policy assignment skipped only because an earlier concrete result and
the bound `providerUnavailableBehavior` require early stop. It never represents
provider activity and can never close.

The final provider-result schema in R2d adds exactly one field,
`notAttemptedCause`. For `not-attempted`:

- `providerRequestId`, dispatch/input/scan/runner/envelope digests are null;
- ordinal, reviewer, provider, and resolved model exactly reproduce that policy
  assignment;
- `blockCode` is `KCRP_ASSIGNMENT_NOT_ATTEMPTED`;
- `notAttemptedCause` is non-null and has exactly
  `triggerRequestOrdinal`, `triggerProviderRequestId`, `triggerOutcome`, and
  `providerUnavailableBehavior`; and
- the trigger ordinal is lower, resolves to one concrete non-`not-attempted`
  result, its request ID/outcome match, and the behavior equals effective policy
  and authorizes early stop for that outcome.

For every other outcome `notAttemptedCause` is null. Once triggered, every later
unstarted assignment receives one ordered `not-attempted` result, so result
count still equals assignment count. Aggregate status is `partial` if any result
completed and otherwise `failed`; it is never `complete` while any result is
`not-attempted`. Provider substitution and a user- or implementation-invented
early-stop cause remain malformed.

## 5. Consolidated final field lists

These three lists globally replace all delta-style versions. They are stated
once; no unlisted or inherited field is legal.

### Effective policy

```text
registrySha256, configSha256, applicableRuleIds, applicableArtifactSha256s,
phase, purpose, round, requiredReviewers, reviewerAssignments,
minimumConfidence, requireZeroFailedChecks, requireZeroSecurityFindings,
requireZeroMaterialDissent, requireZeroUnresolvedQuestions, requiredCheckIds,
highRisk, providerUnavailableBehavior, authorityDigest,
phasePrimaryRootMode, discoveryPrimitive
```

`discoveryPrimitive` is the exact R2c qualified object. All arrays, assignment
rules, phase matrix, and canonical digest rules remain frozen.

### Dispatch manifest

```text
schemaVersion, kind, invocationId, threadId, phase, round,
purpose, route, reductionFailure, block,
limits, measurements,
requestedItemIds, includedItemIds, omittedItemIds, closureProof,
rootArtifacts, rootArtifactSetSha256, primaryRootRelationship,
itemMapSha256,
governanceRegistry, effectivePolicy, effectivePolicySha256,
discoveryPrimitiveSha256,
threadMapRegistry, mapDiscoveryReceipt,
findingRegistry, findingDiscoveryReceipt,
supplementalEvidence, sources,
packetCanonicalizationVersion, packetSerializationVersion,
packetFramingVersion, packetByteLength, packetSha256,
manifestCanonicalizationVersion,
providerRequest
```

`mapDiscoveryReceipt.status` is exactly `present|absent|oversized`; `oversized`
is legal only on the non-closing full fallback in section 2.
`findingDiscoveryReceipt.status` is `present` in every dispatch manifest because
finding-registry absence, error, or overflow is predispatch-terminal.

### Discovery receipt

```text
schemaVersion, kind, canonicalizationVersion, invocationId,
targetKind, registrySha256, selectedEntrySha256,
expectedState, fixedPath, parentIdentity,
status, objectIdentity, observedRawByteLength,
observedRawSha256, observedCanonicalSha256,
absenceCode, errorCode, block,
discoveryPrimitiveSha256, implementationSha256,
qualificationReceiptSha256, platformFamily,
completedAt
```

Literals remain integer `schemaVersion:1`,
`kind:"kstack-kcrp-discovery-receipt-v1"`, and
`canonicalizationVersion:"kstack-kcrp-json-v1"`. Present, absent, and error
rows remain R2c/R2d; the sole new row is section 2. Primitive fields reconstruct
the exact policy-bound primitive and must pass the R2d transitive gate.

## 6. Bug-fix acceptance evidence

Fixtures must prove the two new predispatch rows and every adjacent invalid
null combination; oversized-map descriptor/length stability without a content
read; map fallback versus full-required and finding-registry terminal behavior;
both predispatch aggregate policy rows; `not-attempted` ordering, cause,
nullability, result-count, status, and non-closing behavior; and exact rejection
of omitted, extra, duplicated, or legacy delta fields in all three consolidated
schemas.

**Self-score:** 97/100 for the six R2e serialization fixes only. This is not
independent review or activation evidence. Remaining risk is implementation and
platform-qualification evidence.

No runtime, configuration, Opus, commit, or push work is performed by this
addendum.
