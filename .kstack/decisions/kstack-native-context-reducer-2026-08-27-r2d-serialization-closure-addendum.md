# KCRP R2d addendum — final serialization closure

**Status:** DESIGN CANDIDATE ADDENDUM — SEVEN R2d RESIDUALS RESOLVED IN DESIGN ONLY  
**Date:** 2026-08-27  
**Parent SHA-256:** `879942237c11baf9275652357039bfa276d84237a81eccec56b3477465c26d96`  
**R2a SHA-256:** `b5e552904ce6a6e073436c8b84925a8f1a968468febc92bb141fd4e40732b442`  
**R2b1 SHA-256:** `7a8cc6e28197db582a6ffd5dfe82076b8f2bd2f7b85aeb2912387aabb11edff4`  
**R2b2 SHA-256:** `172e82369de54bc68977f5d59555cff8e5467c73bfa94008fd7ce57abaf8d4c7`  
**R2c SHA-256:** `903b836f6f7168555617fe132540db7b386f1753dae49073af9413676c645577`  
**Scope:** serialization/receipt closure only; all predecessor safety and routing rules remain

## 1. Qualified discovery binding

The exact R2c `discoveryPrimitive` object is a required field of
`effectivePolicy`; its canonical digest is:

```text
discoveryPrimitiveSha256 = SHA256(canonical discoveryPrimitive bytes)
```

`effectivePolicySha256` therefore binds primitive ID/version, implementation
digest, qualification-receipt digest, and platform family. The final dispatch
manifest adds required `discoveryPrimitiveSha256`. Every discovery receipt adds
the same digest plus exact `implementationSha256`,
`qualificationReceiptSha256`, and `platformFamily`. These values must reproduce
the policy object byte-for-byte.

The gate rereads and validates the qualification receipt, implementation
artifact, effective policy, manifest, and each discovery receipt, then requires
all five bindings equal and current. Missing qualification, implementation
drift, platform mismatch, or receipt mismatch is stale/blocked and cannot
fallback or close. Scan/runner/response receipts bind the manifest and policy,
so the primitive binding is transitively preserved without copying mutable
identity data into every node.

## 2. Final predispatch-block receipt

The receipt has exactly these required fields and no others:

```text
schemaVersion, kind, canonicalizationVersion,
invocationId, threadId, phase, purpose, requestedRoute, contextStage,
effectivePolicySha256, discoveryPrimitiveSha256,
threadMapRegistrySha256, findingRegistrySha256,
mapDiscoveryReceiptSha256, findingDiscoveryReceiptSha256,
reductionFailure, block, diagnosticSetSha256, createdAt
```

Literals are integer `schemaVersion:1`,
`kind:"kstack-kcrp-predispatch-block-receipt-v1"`, and
`canonicalizationVersion:"kstack-kcrp-json-v1"`.

Nullability is exact:

| `contextStage` | policy/primitive | thread registry | map receipt | finding registry/receipt | reductionFailure |
|---|---|---|---|---|---|
| `governance` | both null | null | null | both null | null |
| `map-discovery` | both non-null | non-null | error receipt digest or null only for no-receipt failure | both null | null |
| `finding-discovery` | both non-null | non-null | non-null successful digest | registry null; error receipt digest or null only for no-receipt failure | null |
| `construction` | both non-null | non-null | non-null | both non-null | null unless requested route is full-fallback |
| `size` | both non-null | non-null | non-null | both non-null | non-null exactly for full-fallback |

`block` and `diagnosticSetSha256` are always non-null. `reductionFailure` is
non-null exactly when `requestedRoute=full-fallback` and is preserved byte-for-
byte from the failed reduced candidate. Any other null combination fails schema.

## 3. Discovery overflow and complete overflow-code set

R2d selects one representation: when a discovery **receipt body** would exceed
`KCRP_CONTROL_JSON_MAX_BYTES`, no truncated/error discovery receipt is created.
The final predispatch receipt records `contextStage` for that target, the target
discovery digest null, and block code `KCRP_DISCOVERY_RECEIPT_TOO_LARGE`.
Scanner/provider start count is zero. If the predispatch receipt itself exceeds
the maximum, only terminal host status `KCRP_PREDISPATCH_RECEIPT_TOO_LARGE` with
`artifactStatus=unavailable` is returned; no KCRP gate claim exists.

The exhaustive v1 overflow/count codes are:

```text
KCRP_GOVERNANCE_TOO_LARGE
KCRP_THREAD_REGISTRY_TOO_LARGE
KCRP_FINDING_REGISTRY_TOO_LARGE
KCRP_MAP_TOO_LARGE
KCRP_ARTIFACT_COUNT_LIMIT
KCRP_ITEM_COUNT_LIMIT
KCRP_SPAN_COUNT_LIMIT
KCRP_DEPENDENCY_COUNT_LIMIT
KCRP_CLOSURE_COUNT_LIMIT
KCRP_FULL_ARTIFACT_COUNT_LIMIT
KCRP_SUPPLEMENTAL_COUNT_LIMIT
KCRP_REDUCED_MANIFEST_TOO_LARGE
KCRP_FULL_MANIFEST_TOO_LARGE
KCRP_REDUCED_SOURCE_COUNT_LIMIT
KCRP_FULL_SOURCE_COUNT_LIMIT
KCRP_REDUCED_SOURCE_RECORD_TOO_LARGE
KCRP_FULL_SOURCE_RECORD_TOO_LARGE
KCRP_REDUCED_TOO_LARGE
KCRP_FULL_TOO_LARGE
KCRP_DISCOVERY_RECEIPT_TOO_LARGE
KCRP_SCAN_RECEIPT_TOO_LARGE
KCRP_PREDISPATCH_RECEIPT_TOO_LARGE
KCRP_RUNNER_RECEIPT_TOO_LARGE
KCRP_RESPONSE_RECEIPT_TOO_LARGE
KCRP_ENVELOPE_TOO_LARGE
KCRP_AGGREGATE_MANIFEST_TOO_LARGE
KCRP_DIAGNOSTIC_TOO_LARGE
```

No generic `*_TOO_LARGE` or implementation-defined alias is allowed. Governance
and thread-registry overflow are terminal governance blocks without fallback.
Finding-registry, supplemental, discovery/scan/predispatch receipt, and
diagnostic overflow are terminal without fallback. Reduced map/count/manifest/
source/packet/input codes follow the previously defined one-full-attempt route.
Every full-route overflow is terminal; a full-fallback terminal receipt retains
the original reduction failure. Runner/envelope/aggregate overflow after a
provider may have acted is artifact-unavailable and can never close.

## 4. Final item-map and governance-registry bodies

The canonical item-map body has exactly:

```text
schemaVersion, kind, canonicalizationVersion,
threadId, phase, artifactSet, items
```

Its literals are integer `schemaVersion:1`,
`kind:"kstack-kcrp-item-map-v1"`, and
`canonicalizationVersion:"kstack-kcrp-json-v1"`. It contains no self digest;
`itemMapSha256` is detached SHA-256 over the exact canonical body. Each final
item retains the effective R2b1 fields `itemId`, `artifactId`, `spans`,
`dependsOn`, `risk`, `status`, `reductionEligibility`, and `mechanismGroupId`,
and no removed `independence` field.

The canonical governance-registry body has exactly:

```text
schemaVersion, kind, canonicalizationVersion,
projectId, configArtifact, entries
```

Its literals are integer `schemaVersion:1`,
`kind:"kstack-kcrp-governance-registry-v1"`, and
`canonicalizationVersion:"kstack-kcrp-json-v1"`. It contains no self digest;
`registrySha256` is detached SHA-256 over the exact canonical body.
`configArtifact` is one full canonical `ArtifactBinding` for effective project
configuration. Each entry has exactly `ruleId`, `class`, `artifact`, `scope`,
`precedence`, and `supersedesRuleIds`, using the R2b1 closed enums/cardinalities/
chain and order rules. Missing or unknown fields fail before policy resolution.

## 5. Authoritative discovery-error precedence

Valid expected absence is `status=absent`, not an error. For error status, the
first applicable code in this list is the sole public `errorCode`:

```text
01 QUALIFICATION_UNAVAILABLE
02 PATH_ESCAPE
03 REGISTERED_STATE_MISMATCH
04 PARENT_UNAVAILABLE
05 PERMISSION_DENIED
06 IO_ERROR
07 NOT_FOUND_REQUIRED
08 UNEXPECTED_PRESENT
09 LINK_ENCOUNTERED
10 NOT_REGULAR
11 IDENTITY_UNAVAILABLE
12 LENGTH_MISMATCH
13 RAW_DIGEST_MISMATCH
14 UTF8_INVALID
15 CANONICAL_DIGEST_MISMATCH
16 IDENTITY_CHANGED
```

Evaluation follows this order and short-circuits before unsafe later operations.
A bounded diagnostic may retain other safely observed facts in the same order,
but cannot change the primary code. Qualification covers the policy-bound
primitive/qualification/implementation/platform tuple. Registered-state
validation precedes filesystem probing. Expected absence that observes any
entry returns `UNEXPECTED_PRESENT` without inspecting type; expected presence
with no entry returns `NOT_FOUND_REQUIRED`. A link wins over not-regular; raw
digest precedes decoding/canonical digest; final descriptor identity recheck is
last.

This list replaces the unordered R2c set. An unknown error code makes the
receipt malformed and blocks.

## 6. Receipt schema versions

Every final KCRP receipt uses exact integer `schemaVersion:1`: map/finding
discovery, scan, runner, structured response, and predispatch block receipts.
Each also uses its frozen v1 kind and `kstack-kcrp-json-v1` canonicalization.
String `"1"`, zero, another integer, missing version, or unknown field is schema
failure. A future version requires a new kind/schema and cannot enter through a
v1 compatibility fallback.

## 7. Provider/invocation aggregate manifest

KCRP writes a separate `kcrp-invocation-manifest.json`; it does not mutate the
legacy dual-review manifest schema. Its canonical body has exactly:

```text
schemaVersion, kind, canonicalizationVersion,
invocationId, threadId, phase, purpose, round,
effectivePolicySha256, requiredReviewerIds,
predispatchBlockReceiptSha256, providerResults,
status, createdAt
```

Literals are integer `schemaVersion:1`,
`kind:"kstack-kcrp-invocation-manifest-v1"`, and
`canonicalizationVersion:"kstack-kcrp-json-v1"`. Its digest is detached:

```text
aggregateManifestSha256 = SHA256(exact canonical aggregate body bytes)
```

Each `providerResults` entry has exactly:

```text
requestOrdinal, providerRequestId, reviewerId, providerId, resolvedModelId,
dispatchManifestSha256, reviewInputSha256, scanReceiptSha256,
runnerReceiptSha256, envelopeSha256, outcome, blockCode
```

Entries sort by numeric request ordinal, contiguous from zero and positionally
equal to effective-policy `reviewerAssignments`. Reviewer, provider, model,
request ID, and every non-null digest reproduce bound artifacts.
`requiredReviewerIds` is exactly the effective-policy order.

Aggregate outcomes are:

```text
complete|scan-blocked|start-failed|unavailable|timeout|signaled|
nonzero-exit|malformed-response|artifact-unavailable
```

Nullability is exact: `complete` has dispatch/input/scan/runner/envelope digests
non-null and block code null; `scan-blocked` has dispatch/input/scan non-null and
runner/envelope null; runner-originated failures have dispatch/input/scan/runner
non-null and envelope null; `artifact-unavailable` binds every digest created
before the unavailable artifact and uses its exact overflow/unavailable code.

Manifest `status` is:

- `predispatch-blocked`: predispatch digest non-null and provider results empty;
- `complete`: predispatch digest null, result count equals required reviewers,
  and every outcome is complete;
- `partial`: predispatch digest null, exact required result count, at least one
  complete and at least one non-complete outcome; or
- `failed`: predispatch digest null, exact required result count, and no complete
  outcome.

`partial` is evidence only, never consensus or closure. Closure additionally
requires status complete, all policy assignments exactly represented, a fresh
aggregate digest, and the existing full-required closure predicate. Provider
substitution, extra/missing/duplicate result, policy drift, or ordering mismatch
makes the aggregate malformed.

## 8. R2d acceptance evidence

Fixtures must prove:

1. primitive/qualification/implementation/platform mutation stales policy,
   discovery, manifest, transitive receipts, aggregate, and gate;
2. every predispatch context-stage nullability row and adjacent invalid variant,
   including preserved full-fallback reduction failure;
3. discovery receipt overflow creates no discovery receipt, and predispatch
   overflow produces only terminal artifact-unavailable host status;
4. every exhaustive overflow code is reachable only from its named boundary and
   governance overflow has zero fallback/full-builder calls;
5. exact item-map/governance body bytes, literal drift, embedded-self-digest,
   missing/unknown field, and detached digest mutation;
6. every discovery error precedence collision, valid absence, and unsafe-stage
   short circuit;
7. integer schema version 1 and wrong-type/value versions for every receipt; and
8. aggregate manifest outcome/status/null/order/policy matrices, detached digest,
   provider substitution, and complete-versus-partial closure behavior.

## 9. Self-review

**Self-score:** 97/100 for the seven R2d residuals only. This is not independent
review and cannot close or activate KCRP. Remaining risk is implementation and
qualification evidence; the requested serialization decisions are explicit.

No runtime, configuration, Opus, commit, or push work is authorized or performed
by this addendum.
