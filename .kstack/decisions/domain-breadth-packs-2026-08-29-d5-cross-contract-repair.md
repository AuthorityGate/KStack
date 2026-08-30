# D5 cross-contract repair — preserve D1–D4 artifact identity

**Date:** 2026-08-29  
**Status:** primary design ready at 93; independent final review pending  
**Scope:** repairs only the contradictory D5-F1 registry/type clauses found
during implementation. D5-F2 authority and atomicity are unchanged.

## Defect

The frozen D5-F1 text cannot be implemented together with the earlier frozen
and now implemented D1–D4 contracts:

- D5 names `kstack-owner-action-request` and
  `kstack-owner-action-attestation`; D1 actually defines
  `kstack-identity-action-request` and
  `kstack-identity-verification-receipt`.
- D5 attempts to place D1–D4 artifacts in a new UTF-8-key-ordered canonical
  registry even though those artifacts already have reviewed canonical bytes,
  validators, and digest domains. Re-encoding them would change their identity.
- D5 reuses `kstack-pack-snapshot` for the authoritative four-pack catalog,
  while D2 already defines that type as its closed selection snapshot.
- D5's `OperationInventoryV1` shape differs from D2's existing
  `kstack-operation-inventory` shape under the same conceptual name.
- D5 gives `kstack-pack-evidence-schema` the final count/freshness-policy
  fields. D4's implementation must consume that final shape; maintaining two
  schemas under one artifact type would be type confusion.

Shipping the original registry literally would therefore either reject valid
D1–D4 artifacts or silently assign two schemas/canonicalizers to one type.

## Binding repair

`PackSchemaRegistryV1` governs only D5-owned pack-format and lifecycle
artifacts. D1–D4 artifacts retain their exact existing canonicalization,
validators, and digest domains and enter a D5 graph only through exact
artifact/validator identity digests. D5 cannot re-encode or reinterpret them.

The D5 v1 registry's exact ASCII-ordered type inventory is:

```text
kstack-pack-activation-receipt
kstack-pack-activation-request
kstack-pack-approval-assertion
kstack-pack-bundle-index
kstack-pack-catalog-snapshot
kstack-pack-compatibility-entry
kstack-pack-content
kstack-pack-contract-policy
kstack-pack-evidence-schema
kstack-pack-manifest
kstack-pack-operation-inventory
kstack-pack-quarantine-record
kstack-pack-review-assertion
kstack-pack-source-provenance
kstack-pack-tombstone
kstack-validator-identity
```

Two collision-free names are binding:

- `kstack-pack-catalog-snapshot` is the D5 authoritative four-pack catalog plus
  compatibility closure. `kstack-pack-snapshot` remains D2's exact selection
  snapshot. A guarded D5 head deterministically projects the D2 snapshot used
  by selection; neither type is accepted where the other is required.
- `kstack-pack-operation-inventory` is D5's role/type/digest/length inventory.
  `kstack-operation-inventory` remains D2's exact byte-retaining validation
  inventory.

The domain prefixes follow the same D5 derivation from these repaired names.
The D5 registry still has no runtime `$ref`, remote schema, custom validator,
default, coercion, transform, or schema-selected execution path.

## Evidence-schema convergence

`kstack-pack-evidence-schema` has one final v1 shape: the D5-F1 requirement
fields `evidenceId`, `allowedSourceClasses`, `allowedObservationKinds`,
`minimumCount`, `maximumCount`, `freshnessPolicyId`, and `requiredFor`.

D4 must replace its provisional numeric `freshnessSecondsMaximum` field with
this exact shape. Its pure validator receives an exact D8-qualified freshness-
policy projection, verifies the named policy and count bounds, and keeps the
same fail-closed support/contradiction behavior. No ambient mapping or caller-
chosen duration is allowed.

Because D5 permits `maximumCount` above one while D4's original descriptor had
no occurrence discriminator, the converged descriptor adds the exact integer
field `evidenceOrdinal` in `0..31`. Ordinals for one
`(packId, questionId, evidenceId)` are unique, contiguous, and start at zero;
the validator counts those descriptors against the D5 minimum/maximum and
requires one attestation/native source per ordinal. Analysis `evidenceIds`
remain a duplicate-free subset and therefore cite the requirement once, not
each occurrence. This is the only D4 descriptor-shape repair.

`kstack-pack-content` likewise becomes the canonical D5 structured artifact,
not an opaque raw blob, when D4 resolves a D5 bundle. D4 recomputes the D5
artifact digest and verifies its question/evidence inventory against the
composition receipt.

## Dependency binding

Every D5 compatibility entry and review/approval assertion continues to bind
the exact D1/D2/D3/D4 validator/source identities required by the frozen D5
cross-digest graph. The repair changes no authority:

- D1 remains the sole activation identity source;
- D3 remains mandatory for weakening transitions;
- D2 remains the selection admission boundary;
- D4/D10 remain the result/evidence boundary;
- D8 remains the sole trusted-time/freshness source; and
- D5-F2 remains the sole pointer mutation path.

An unregistered dependency type, changed dependency digest, alternate
canonical bytes, or validator-identity mismatch fails the D5 graph. Excluding
D1–D4 schema documents from the D5 registry does not make them optional; it
prevents D5 from redefining them.

## Verification obligations

- Assert the repaired 16-type registry exactly and reject every missing,
  added, reordered, renamed, or prefix-colliding entry.
- Prove D1–D4 canonical bytes and source digests do not change merely because
  D5 is installed.
- Reject D2 snapshot bytes as a D5 catalog snapshot and vice versa.
- Reject D2 operation inventory bytes as a D5 pack-operation inventory and
  vice versa.
- Update D4 to the one final evidence-schema/content contract and rerun D1–D4,
  architecture, install-health, and complete repository validation.
- Preserve the original D5-F1 file-set, bundle, compatibility, provenance,
  review/approval, and cross-digest equalities and all D5-F2 authority,
  monotonic-generation, staging, CAS, nonce, crash, rollback, and history
  requirements.

This repair supersedes only the original D5-F1 required-type list and the two
colliding type names. It does not claim D5 implementation completion,
independent-final closure, or production ledger/storage qualification.
