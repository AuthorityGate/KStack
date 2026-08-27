# HB-TC03 round-4 concrete repair

**Prior packet:** `cdf528624b7ced5ae1c8d2e89a942641986969b450411f61e983b80fdf690740`
**Frozen:** Option C, candidate-only ceiling, no upstream bytes

This delta repairs only round 3's four findings.

## 1. Constructible, exact candidate status

Remove `statusDigest` from the body. The external object address is
`SHA-256("KSTACK-CANDIDATE-STATUS-V1" || 0x00 || RFC8785(body))`; the address
is never serialized inside `body`. `CandidateStatusV1` is a closed object with
exactly these fields:

```text
schemaId: "kstack.candidate-status.v1"
schemaVersion: 1
registrySetDigest: DigestV1
targetId: "opencode"
runningHostBuildDigest: DigestV1
liveConfigDigest: DigestV1
currentnessEvidenceDigest: DigestV1
expiresAtUtc: canonical RFC3339 timestamp | null
previousStatusBodyDigest: DigestV1 | null
state: CandidateStateV1
maximumClaim: "NO_OPERATION_QUALIFICATION"
invalidationReason: CandidateInvalidationReasonV1 | null
changedFactEvidenceDigest: DigestV1 | null
refs: {
  packagingEvidence: EvidenceRefV1,
  projectionPlan: EvidenceRefV1,
  renderBundle: EvidenceRefV1,
  installerProfile: EvidenceRefV1,
  installReceipt: EvidenceRefV1,
  discoveryObservation: EvidenceRefV1
}
```

`EvidenceRefV1` is closed and exactly `{digest: DigestV1|null,
unavailableReason: EvidenceUnavailableCodeV1|null}`, with exactly one non-null.
`CandidateStateV1` and `EvidenceUnavailableCodeV1` are the closed enums from
round 3. `CandidateInvalidationReasonV1` is exactly `BUILD_CHANGED`,
`CONFIG_CHANGED`, `REGISTRY_CHANGED`, `SOURCE_CHANGED`, `RENDER_CHANGED`,
`INSTALL_CHANGED`, `EVIDENCE_STALE`, `EVIDENCE_FAILED`, or `EXPIRY_REACHED`.

At `DECLARED`, `previousStatusBodyDigest`, `invalidationReason`, and
`changedFactEvidenceDigest` are null. Every forward state binds the immediately
preceding status body's external digest and keeps both invalidation fields null.
`CANDIDATE_INVALIDATED` binds the immediately preceding status body and has
both invalidation fields non-null. A recovered chain begins with a new
`DECLARED` body whose previous digest is null. The round-3 reference matrix is
normative. A required reference always has a digest; a not-yet-required
reference always has the state-consistent unavailable code. Expired or failed
currentness cannot occupy a non-invalidated state.

## 2. Exact fixture identity binding

Add these exact required fields to `OpenCodeDiscoveryObservationV1`:

```text
fixtureId: closed FixtureIdV1
fixtureFactsDigest: DigestV1
```

Add `fixtureFactsDigest: DigestV1` to each `DiscoverySessionV1`. The canonical
fixture facts bind `fixtureId`, generic prompt digest, base render digest,
challenge-clause schema digest, treatment/control variant identifiers, and
the rule that neither token is present outside its protected variant clause.
Both session fixture digests must equal the top-level digest. The two variant
clauses and their installed manifests must embed the exact top-level fixture
ID; the generic prompt must reference that same fixture ID. A mismatch yields
`NOT_OBSERVED` plus `PAIR_BINDING_MISMATCH`. An unprovable binding yields
`AMBIGUOUS` plus `ADJUDICATION_AMBIGUOUS`. `OBSERVED` is impossible otherwise.

## 3. Exact member-role and dependency bindings

Add these required fields to `InstructionOnlyContentEvidenceV1`:

```text
memberRole: "MODEL_VISIBLE_MARKDOWN" | "UNSUPPORTED_STUB"
canonicalMemberInventoryDigest: DigestV1
resourceDependencyGraphDigest: DigestV1
```

`canonicalMemberInventoryDigest` binds the HB-TC01 member record containing
the same member path, member digest, role, and clause ID/null. A mismatch is
`FAIL` with `FORBIDDEN_MEMBER_ROLE`. `resourceDependencyGraphDigest` binds the
canonical declared resource-to-resource, resource-to-operation, and
operation-to-operation graph for the exact RegistrySet. The evidence closure
must equal the graph-reachable closure from both the member's clause
`appliesTo` roots and all dependencies of its canonical member record.
Missing, extra, unknown, or mismatched nodes/edges are `AMBIGUOUS` with
`DEPENDENCY_INCOMPLETE`; a complete closure containing any other operation
class is `FAIL` with `DEPENDENCY_UNSAFE`.

`overall: PASS` additionally requires the inventory member role to be exactly
one of the two closed values, every bound identity/digest comparison above to
pass, and the existing linter/review requirements to pass. An unsupported stub
must also satisfy its closed status-and-reason-only grammar. These are
deterministic prerequisites; neither the linter nor model review may waive a
failed binding.

## Review request

Review only the four round-3 defects: external status addressing plus exact
status schema, fixture identity binding, member-role binding, and canonical
inventory/resource dependency binding. Closure requires score/confidence 93+
and empty failed/security/dissent/question arrays. Do not redesign, invoke
Opus, use tools, inspect/edit files, implement, install/run OpenCode, commit,
push, deploy, publish, or edit reports.
