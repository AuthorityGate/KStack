# HB-TC03 implementation clarification R1 — projection context binding

**Base contract:**
`.kstack/decisions/host-breadth-hb-tc03-2026-08-29-normative-reissue.md`  
**Scope:** bounded constructibility clarification; claim ceiling unchanged

## Problem

The base contract requires the OpenCode projection to bind packaging evidence,
the observed build/config, metadata schema, destination, rendered bytes, and
instruction-only evidence. HB-TC01's already-reviewed `ProjectionPlanV1` is a
closed shared schema and intentionally contains only generic projection fields.
Adding OpenCode-only fields to that object would corrupt the generic boundary,
change HB-TC01/HB-TC02 shared production bytes, and force every baseline target
to carry candidate-only facts.

## Resolution

The phrase “the exact HB-TC01 projection plan must bind” is implemented as a
content-addressed composition, not by modifying `ProjectionPlanV1`.
`OpenCodeProjectionBindingV1` is a closed RFC 8785 object addressed as
`SHA-256("KSTACK-OPENCODE-PROJECTION-BINDING-V1" || 0x00 || canonical(body))`
and contains exactly:

```text
schemaId: "kstack.opencode-projection-binding.v1"
schemaVersion: 1
registrySetDigest: DigestV1
sourceBundleDigest: DigestV1
projectionPlanDigest: DigestV1
renderBundleDigest: DigestV1
packagingEvidenceDigest: DigestV1
observedHostBuildDigest: DigestV1
observedLiveConfigDigest: DigestV1
metadataFactSchemaDigest: DigestV1
destinationTemplateId: DestinationTemplateIdV1
scope: "PROJECT" | "USER"
instructionOnlyContentEvidenceDigests: sorted unique DigestV1[]
installerProfileDigest: DigestV1 | null
maximumClaim: "NO_OPERATION_QUALIFICATION"
```

Creation succeeds only when:

- RegistrySet declares `opencode` as `CANDIDATE`, and the canonical package
  includes that target.
- The exact HB-TC01 plan and render bundle share registry, source, target, and
  projection-plan digests.
- Packaging evidence is current and renderable; its metadata schema equals the
  plan's registered adapter schema.
- Every render member has one exact passing instruction-only content evidence
  record bound to the same registry, source bundle, and render bundle.
- If an HB-TC02 installer profile is present, its registry, target, scope, and
  registered destination template match the binding.
- The claim remains `NO_OPERATION_QUALIFICATION`.

This wrapper strengthens the original requirement without changing shared
HB-TC01/HB-TC02 schemas or granting any authority. Candidate status continues
to carry separate packaging, projection-plan, render, installer-profile,
install-receipt, and discovery-observation references; the projection-binding
digest is implementation evidence that those candidate inputs were composed
and checked together.

## Discovery assertion removal

The implementation also refuses caller-asserted “packages differ only by the
challenge” booleans. `VariantDifferenceEvidenceV1` is produced only after a
byte-level comparison proves identical member paths, exact equality for every
non-challenge member, and exact base-plus-closed-clause bytes for the treatment
and control challenge member. The adjudicator checks both session render
digests against that evidence and scans bounded ambient inputs for either raw
token. This is a fail-closed implementation of the existing paired-discovery
contract, not a new claim.
