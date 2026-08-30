# Domain breadth D6 catalog applicability binding repair

**Repairs:** the D5 catalog snapshot / D6 applicability boundary
**Status:** implemented contract repair; qualification remains governed by the D6 gates

## Defect

The approved D6 design makes `CatalogApplicabilityV1` KStack-owned catalog
state and requires every table change to create a new catalog snapshot. The D5
`kstack-pack-catalog-snapshot` exact schema did not contain that table or its
entries. A separately stored table would therefore permit table drift without
changing the activated snapshot digest.

## Repair

The exact D5 catalog snapshot now contains `applicabilityEntries`. Each entry
has exactly:

```text
{
  packMaterialDigest,
  sectionId,
  artifactClasses
}
```

Entries are ordered uniquely by the UTF-8 byte ordering of
`packMaterialDigest + NUL + sectionId`. `artifactClasses` is a non-empty,
sorted, duplicate-free subset of the closed D6 enum. Unknown fields, wildcard
forms, empty class lists, duplicate rows, and non-canonical order reject the
entire D5 snapshot.

The D6 validator derives each expected D2 material digest from the activated
D5 `(packId, version, bundleDigest)` tuple, opens the retained D5 content, and
requires exactly one applicability row for every section of every available
pack. It rejects orphan rows and any material, section, content, or catalog
snapshot mismatch before rendering.

Consequently, any applicability edit changes the canonical D5 snapshot bytes
and digest and must pass the existing D5 activation, staging, CAS, recovery,
and live-head checks. The legacy D5 content `appliesTo` field remains in schema
version 1 only for byte compatibility; it is non-authoritative and is never
read by D6 selection, composition, or dispatch admission.
