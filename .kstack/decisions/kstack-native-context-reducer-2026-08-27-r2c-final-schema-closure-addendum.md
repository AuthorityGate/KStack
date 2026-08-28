# KCRP R2c addendum — final residual schema closure

**Status:** DESIGN CANDIDATE ADDENDUM — SEVEN R2c FINDINGS RESOLVED IN DESIGN ONLY  
**Date:** 2026-08-27  
**Parent SHA-256:** `879942237c11baf9275652357039bfa276d84237a81eccec56b3477465c26d96`  
**R2a SHA-256:** `b5e552904ce6a6e073436c8b84925a8f1a968468febc92bb141fd4e40732b442`  
**R2b1 SHA-256:** `7a8cc6e28197db582a6ffd5dfe82076b8f2bd2f7b85aeb2912387aabb11edff4`  
**R2b2 SHA-256:** `172e82369de54bc68977f5d59555cff8e5467c73bfa94008fd7ce57abaf8d4c7`  
**Scope:** exact closure of the seven requested R2c residuals only

## 1. Normative effect

This separate addendum preserves the four frozen predecessors above. Its exact
field lists and matrices globally supersede delta-style or conflicting versions
of the same contracts in those artifacts. It changes no routing, confidence,
authority, benchmark, activation, or full-closure safety rule.

## 2. Final dispatch-manifest body

The canonical dispatch manifest body has exactly these required top-level fields
and no others:

```text
schemaVersion, kind, invocationId, threadId, phase, round,
purpose, route, reductionFailure, block,
limits, measurements,
requestedItemIds, includedItemIds, omittedItemIds, closureProof,
rootArtifacts, rootArtifactSetSha256, primaryRootRelationship,
itemMapSha256,
governanceRegistry, effectivePolicy, effectivePolicySha256,
threadMapRegistry, mapDiscoveryReceipt,
findingRegistry, findingDiscoveryReceipt,
supplementalEvidence, sources,
packetCanonicalizationVersion, packetSerializationVersion,
packetFramingVersion, packetByteLength, packetSha256,
manifestCanonicalizationVersion,
providerRequest
```

The new binding objects are exact:

```json
{
  "threadMapRegistry": {
    "registrySha256": "sha256",
    "selectedEntrySha256": "sha256"
  },
  "mapDiscoveryReceipt": {
    "receiptSha256": "sha256",
    "status": "present|absent"
  },
  "findingRegistry": {
    "artifact": "ArtifactBinding with role decision",
    "registrySha256": "sha256"
  },
  "findingDiscoveryReceipt": {
    "receiptSha256": "sha256",
    "status": "present"
  }
}
```

An error discovery never produces a dispatch manifest. `block` is therefore
null in every hashable manifest that proceeds to input construction. The body
contains no self digest, review-input digest, scan result, raw response, runner
receipt, or envelope digest. `providerRequest` is the exact R2b2 assignment-
matched object; one manifest exists per provider request.

## 3. Transitive receipt chain

The binding direction remains acyclic and is now explicit:

```text
registry/artifact/discovery/policy/packet/provider-request bytes
  -> dispatchManifestSha256
  -> exact reviewInputSha256
  -> scanReceiptSha256
  -> rawResponseSha256 + response receipt
  -> runnerReceiptSha256
  -> envelopeSha256
  -> provider/invocation aggregate manifest
```

The dispatch manifest directly binds both registries, both discovery receipts,
the effective policy, full primary roots, optional item map, supplemental
evidence, packet, and provider request. The review input includes the exact
manifest body/detached digest and packet. The scan receipt binds manifest,
review input, effective policy, and both discovery receipt digests. The response
receipt echoes only prior-visible bindings. The runner receipt binds manifest,
input, scan, raw response, validated response receipt, policy, reviewer/model,
and provider request. The envelope binds the runner receipt; the aggregate binds
every required reviewer envelope.

Verification begins at leaf bytes and reconstructs every edge. A digest match at
a later node never excuses a missing or stale earlier leaf. No later digest is
inserted into an earlier hashed node.

## 4. Effective-policy primary-root mode

`effectivePolicy` adds required `phasePrimaryRootMode`, exactly one of:

```text
design-legacy-explicit
qc-explicit
qc-none
review-explicit
review-none
```

The field is part of canonical `effectivePolicySha256`. The legal phase matrix
is total:

| phase | legal policy mode | required `primaryRootRelationship` variant |
|---|---|---|
| design | `design-legacy-explicit` only | phase design, `design-legacy-explicit`, non-null exact relationship |
| qc | `qc-explicit` | phase qc, `qc-explicit`, non-null exact relationship |
| qc | `qc-none` | phase qc, `none`, relationship null |
| review | `review-explicit` | phase review, `review-explicit`, non-null exact relationship |
| review | `review-none` | phase review, `none`, relationship null |

No wildcard, inferred default, bare null top-level value, or cross-phase mode is
valid. The `none` relationship removes only a legacy/single-primary relation;
it never removes mandatory complete root artifacts or their digests.

The provider request, dispatch manifest, response receipt, scan receipt, runner
receipt, envelope, and gate bind `effectivePolicySha256`, so a mode or root-
variant change stales the complete invocation.

## 5. Frozen registry and discovery literals

The literal registry contracts are:

| Artifact | `schemaVersion` | `kind` | `canonicalizationVersion` |
|---|---:|---|---|
| governance registry | 1 | `kstack-kcrp-governance-registry-v1` | `kstack-kcrp-json-v1` |
| thread-map registry | 1 | `kstack-kcrp-thread-map-registry-v1` | `kstack-kcrp-json-v1` |
| finding registry | 1 | `kstack-kcrp-finding-registry-v1` | `kstack-kcrp-json-v1` |
| item map | 1 | `kstack-kcrp-item-map-v1` | `kstack-kcrp-json-v1` |

The discovery receipt literal is `schemaVersion:1`,
`kind:"kstack-kcrp-discovery-receipt-v1"`, and
`canonicalizationVersion:"kstack-kcrp-json-v1"`.

All registry and sidecar discovery uses one policy-bound qualified opaque
primitive:

```json
{
  "primitiveId": "stable ASCII ID",
  "primitiveVersion": "nonempty ASCII version",
  "implementationSha256": "sha256",
  "qualificationReceiptSha256": "sha256",
  "platformFamily": "linux|darwin|windows"
}
```

Its output identity is host-neutral canonical data:

```json
{
  "scheme": "kstack-qualified-object-identity-v1",
  "platformFamily": "linux|darwin|windows",
  "volumeOpaqueSha256": "sha256",
  "objectOpaqueSha256": "sha256",
  "generationOpaqueSha256": null
}
```

`generationOpaqueSha256` is null only when the qualified platform primitive
defines no stable generation value. Opaque OS identity bytes are hashed before
serialization; KCRP does not compare device/inode/file-index fields across
platforms. The qualification receipt binds supported filesystems, no-follow and
descriptor-revalidation behavior, negative fixtures, and implementation digest.
Missing/stale qualification or unsupported identity returns discovery error
`IDENTITY_UNAVAILABLE`; KCRP makes no unqualified path-safety claim.

## 6. Final discovery receipt and no-receipt block

The discovery receipt has exactly:

```text
schemaVersion, kind, canonicalizationVersion, invocationId,
targetKind, registrySha256, selectedEntrySha256,
expectedState, fixedPath, parentIdentity,
status, objectIdentity, observedRawByteLength,
observedRawSha256, observedCanonicalSha256,
absenceCode, errorCode, block, completedAt
```

`targetKind` is `item-map` or `finding-registry`. `selectedEntrySha256` is the
thread-map entry digest for item-map and the finding-registry artifact binding
digest for finding-registry. Finding registry always expects present. The exact
state/null matrix is:

| status | legal expectation | identities/length/digests | absenceCode | errorCode | block |
|---|---|---|---|---|---|
| present | present | parent/object identities and length/raw/canonical digests all non-null | null | null | null |
| absent | absent item-map only | parent non-null; object, length, digests null | `NO_ENTRY` | null | null |
| error | either | parent/object identities, length, digests all null | null | one closed error | matching construction block |

Closed discovery errors are:

```text
PARENT_UNAVAILABLE|PATH_ESCAPE|LINK_ENCOUNTERED|NOT_REGULAR|
PERMISSION_DENIED|IO_ERROR|IDENTITY_UNAVAILABLE|IDENTITY_CHANGED|
LENGTH_MISMATCH|RAW_DIGEST_MISMATCH|CANONICAL_DIGEST_MISMATCH|
REGISTERED_STATE_MISMATCH|UTF8_INVALID|NOT_FOUND_REQUIRED|
UNEXPECTED_PRESENT
```

The error block is exactly
`{code:"KCRP_DISCOVERY_INVALID",stage:"construction",evidenceSha256}`;
the bounded evidence digest covers the specific closed error and qualified
primitive receipt. Error status is never embedded in a dispatch manifest and
starts no scanner/provider.

If canonical discovery receipt bytes cannot be created, verified, kept within
the control-plane bound, or durably retained when persistence is required, the
coordinator creates a predispatch block with
`code="KCRP_DISCOVERY_RECEIPT_UNAVAILABLE"`, stage `construction`,
`discoveryReceiptSha256:null`, and one closed cause:

```text
SERIALIZATION_FAILED|RECEIPT_LIMIT|PERSISTENCE_UNAVAILABLE
```

If even that block receipt cannot be retained, the coordinator returns the same
terminal code directly with `artifactStatus=unavailable`; no KCRP review or gate
claim exists and no provider starts. Receipt failure never selects full fallback.

## 7. Common control-plane JSON bound

`KCRP_CONTROL_JSON_MAX_BYTES` is exactly 4,194,304 canonical bytes and applies
individually to every KCRP control-plane JSON body:

- governance, thread-map, finding, and item registries/maps;
- dispatch manifest;
- discovery, scan, runner, and predispatch block receipts;
- structured response receipt and completed reviewer envelope; and
- KCRP provider/invocation aggregate manifests.

Any current or later v1 KCRP JSON body not separately named above, including
canonical diagnostic evidence, inherits the same maximum; there is no unbounded
control-plane JSON exception.

Readers consume at most max+1 bytes; encoders measure before retention/use.
Equality passes and max+1 fails. Overflow handling is total:

| Body | Overflow result |
|---|---|
| governance registry | terminal `KCRP_GOVERNANCE_TOO_LARGE`; no full builder/fallback |
| thread-map registry | terminal `KCRP_THREAD_REGISTRY_TOO_LARGE`; no full builder/fallback |
| finding registry | terminal `KCRP_FINDING_REGISTRY_TOO_LARGE`; no dispatch/fallback |
| item map in reduced route | original `KCRP_MAP_TOO_LARGE`; one full fallback allowed under R2b2 |
| item map required by full-required | terminal `KCRP_MAP_TOO_LARGE` |
| reduced dispatch manifest | `KCRP_REDUCED_MANIFEST_TOO_LARGE`; one full fallback |
| full manifest or any discovery/scan/predispatch receipt | terminal matching `*_TOO_LARGE`; no provider start |
| runner receipt/envelope/aggregate after provider action | terminal artifact-unavailable/malformed outcome; never closure |
| structured response receipt | malformed response; never closure |

When overflow happens during full fallback, its predispatch block preserves the
original reduction failure exactly. No configuration or input may raise this
common maximum within v1.

## 8. Complete final receipt schemas

These lists replace every earlier delta-style list. No field is inherited by
implication.

### Scan receipt

```text
schemaVersion, kind, canonicalizationVersion,
invocationId, providerRequestId,
dispatchManifestSha256, reviewInputSha256, effectivePolicySha256,
threadMapRegistrySha256, mapDiscoveryReceiptSha256,
findingRegistrySha256, findingDiscoveryReceiptSha256,
scannerExecutableSha256, scannerConfigurationSha256,
manifestByteLength, packetByteLength, framingByteLength,
reviewInputByteLength, status, findingCode, block, completedAt
```

### Runner receipt

```text
schemaVersion, kind, canonicalizationVersion,
invocationId, providerRequestId, requestOrdinal,
reviewerId, providerId, resolvedModelId,
dispatchManifestSha256, reviewInputSha256, scanReceiptSha256,
effectivePolicySha256,
threadMapRegistrySha256, mapDiscoveryReceiptSha256,
findingRegistrySha256, findingDiscoveryReceiptSha256,
commandConfigurationSha256, reasoningConfigurationSha256,
rawResponseSha256, responseReceiptStatus,
outcome, block, exitCode, signal, startedAt, completedAt
```

### Structured model response receipt

```text
schemaVersion, kind, canonicalizationVersion,
invocationId, providerRequestId, requestOrdinal,
reviewerId, providerId, resolvedModelId,
dispatchManifestSha256, packetSha256,
purpose, route, effectivePolicySha256,
rootArtifactSetSha256,
threadMapRegistrySha256, mapDiscoveryReceiptSha256,
findingRegistrySha256, findingDiscoveryReceiptSha256,
itemMapSha256, includedItemIds, omittedItemIds
```

Literal kinds are respectively `kstack-kcrp-scan-receipt-v1`,
`kstack-kcrp-runner-receipt-v1`, and
`kstack-kcrp-response-receipt-v1`. Scan/runner canonicalization is
`kstack-kcrp-json-v1`; the response receipt is nested in the provider response
and must itself re-encode canonically under the same rules.

`itemMapSha256` is nullable only for a registered-absent complete full route or
the R2b2 non-closing full fallback after a bound map failure. All other digests
are non-null. Included/omitted arrays follow the frozen ordering and closure
rules. The final runner enums and outcome/null/block cross-field matrix are
exactly R2b2 section 6; R2c changes no enum or matrix row.

Each request/reviewer/provider/model/config field reproduces the corresponding
effective-policy assignment. Each registry/discovery digest reproduces the
dispatch manifest. The response receipt contains no review-input, scan, raw-
response, runner, or envelope digest, preserving the acyclic graph.

## 9. Finding-registry source and safe discovery

Every finding-registry entry's `sourceArtifact.role` is exactly `decision`.
No other role is legal. Each entry has 1 through 64 spans; the complete registry
has at most 16,384 spans, in addition to its 4,096-entry and common-byte caps.
Spans are nonempty, ordered, nonoverlapping per source artifact, in bounds, and
digest-bound to exact canonical decision-artifact bytes.

Finding-registry discovery uses the same policy-bound qualified opaque primitive
and final discovery receipt in sections 5–6 with:

```text
targetKind=finding-registry
expectedState=present
fixedPath=.kstack/context/threads/<threadId>/finding-registry.kcrp.json
```

Registered absence is not legal for this target. Missing file is error
`NOT_FOUND_REQUIRED`; link, replacement, wrong role/type, unstable identity,
digest drift, invalid UTF-8, span overflow, and unsafe source-artifact opening
are terminal construction blocks. Every source decision artifact is itself
opened no-follow through the qualified primitive and descriptor-revalidated
before and after span hashing. The finding discovery receipt and qualification
receipt digest bind the dispatch and all later receipts.

## 10. R2c acceptance evidence

The seven findings are design-resolved only when fixtures prove:

1. exact final dispatch fields accept once and reject every missing, extra,
   stale registry/discovery/finding/provider-request binding;
2. mutation of each leaf invalidates every transitive receipt/envelope edge and
   no backward/self edge exists;
3. every policy-mode/phase/root-union matrix row, plus all cross-product
   negatives, and effective-policy digest drift;
4. present, absent, every closed error, every nullability violation, expected-
   state mismatch, and the explicit no-receipt block path with zero provider
   starts;
5. literal registry kind/version/canonicalization drift and qualified-primitive
   identity/qualification/platform negatives;
6. common control-plane JSON at max/max+1 for every listed body, with governance
   overflow never entering fallback and full-fallback overflow preserving the
   original reduction failure;
7. final scan/runner/response schemas with one deletion/addition/swap/mutation
   per field and exact R2b2 outcome matrix; and
8. finding source role, 1/64/65 per-entry spans, 16,384/16,385 total spans,
   link/replacement/identity drift, and decision-artifact span digest negatives.

Canonical expected bytes and SHA-256 values are checked, not only parsed-object
equality. Design fixtures do not authorize runtime work or activation.

## 11. Open issues after R2c

1. All contracts remain unimplemented and independently unclosed.
2. The qualified opaque primitive requires an actual platform qualification
   record before KCRP discovery can run.
3. Oversized full-input splitting remains deliberately unsupported and blocks.
4. Token-usage collection and overnight A/B benchmarking remain separate; no
   reduction percentage is claimed.

## 12. Self-review

**Self-score:** 96/100 for the seven R2c residuals only. This is not an
independent score and cannot close or activate KCRP. Remaining risk is runtime
conformance and platform qualification, not an intentionally omitted schema
decision in this narrow cluster.
