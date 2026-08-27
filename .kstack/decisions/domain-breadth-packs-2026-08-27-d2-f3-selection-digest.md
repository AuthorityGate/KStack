# Domain breadth D2-F3 - selection digest domain and ownership

**Parent item:** D2 exact-byte selection and stale-catalog outcome  
**Preserved D2-F1 digest:** `a32b324ff819c6815bf15d0888bfbe7c546a1503332b6e8ab8b96e8941b4eac9`  
**Preserved D2-F2 digest:** `e8144a0415a23a6e79bc73c2fd4e8ce15c6f5d890b1893b1f5baf991feb153ff`  
**Route:** Codex-only improvement; no Opus  
**Scope:** only residual `D2-F3`

## Preserved mechanism

All prior D2 mechanisms, D2-F1 inventory/equality validation, and D2-F2 policy
domains/binding remain normative. Q1 is owner-resolved as `Yes`; D1 and D3 own
its later attestation and separation-of-duty contracts. D2 cannot infer or
bypass those contracts and remains fail-closed until a valid attestation is
verified.

## Selection record and digest

The repository-owned selector produces one closed record from already captured
and validated inputs:

```text
selection = {
  artifactType: "kstack-pack-selection",
  schemaVersion: 1,
  subjectDigest,
  repositoryPolicyDigest,
  snapshotDigest,
  expectedGeneration,
  orderedEntries: [{
    packId,
    version,
    materialDigest,
    compatibilityTupleDigest,
    reviewArtifactDigest,
    approvalArtifactDigest
  }],
  compositionInputs,
  expiresAt
}

selectionDigest = SHA256(
  UTF8("KSTACK-PACK-SELECTION-V1\n") || canonicalV1(selection))
```

The literal prefix includes its terminal LF. The expected call site selects
this schema/prefix. `canonicalV1` rejects duplicate/unknown fields and alternate
encodings. Digests are exactly 32 decoded bytes. `expectedGeneration` is an
integer `0..9007199254740991`. `orderedEntries` is non-empty, already in the
repository selector's deterministic precedence order, contains no repeated
`packId`, and is not resorted by a validator. `compositionInputs` is the prior
D2 closed role/digest inventory. `expiresAt` is a canonical UTC timestamp whose
trusted-time evaluation remains owned by D8; absent/invalid trusted time blocks
use rather than treating the record as current.

The selection cannot contain its own digest, an acceptance or activation
attestation, mutable path/name/latest references, content bytes, tools,
permissions, provider/model choices, external destinations, or extension
fields.

## Resolution, validation, and acyclic authority

1. Resolve selection bytes only from operation-bound inventory key
   `("kstack-pack-selection", expectedSelectionDigest)`; verify closed schema,
   recompute `selectionDigest`, and compare fixed-length digest bytes.
2. Resolve the exact snapshot and each named material, compatibility, review,
   approval, and policy artifact from the same closed inventory. Recompute all
   digests and require decoded-byte equality with every selection restatement.
3. Require `snapshotDigest` and `expectedGeneration` to match the live guarded
   read handle and require the exact ordered entry projection to equal the
   selected entries in that snapshot. Any mismatch is `PACK_SELECTION_STALE`
   before composition or dispatch admission.
4. After the selection exists, a separate Q1-owned owner-acceptance attestation
   may assert `selectionDigest`; that attestation is not inside the selection.
   The operation receipt records both digests. No attestation can cause a
   different selection to be resolved or mutate its bytes.
5. The composer and dispatch admission consume the verified selection
   projection and record `selectionDigest` in composition/admission receipts.
   They never re-resolve IDs or paths.

This preserves the acyclic graph: lower material/review/approval/policy and
snapshot artifacts -> selection -> later Q1 acceptance attestation -> receipts.

## Ownership

D2 owns selection schema, exact-byte digest identity, snapshot/generation
binding, stale outcome, and receipt propagation. D1 owns authenticated identity
for the later acceptance attestation. D3 owns waiver/policy-weakening authority.
D8 owns trusted-time evaluation of `expiresAt`. Although Q1 is resolved, a
selection may only be fixture-validated until D1 verifies an effective
acceptance attestation; the selection alone cannot authorize activation or
provider dispatch.

## Deterministic verification

- Golden vectors publish prefix/canonical byte hex/final digest. Change field,
  order, entry, generation, digest, timestamp bytes, LF, type, or version;
  digest changes or schema rejects.
- Insert duplicate pack IDs, duplicate/unknown fields, alternate integer or
  timestamp encodings, wrong-length digest, forbidden authority field, or a
  self/attestation digest; reject.
- Pair a valid selection with another snapshot/generation, reorder snapshot
  entries, or substitute one valid subordinate graph; reject before composition.
- Attempt ID/path/latest re-resolution or supply selection bytes outside the
  operation inventory; reject with no prompt or admission receipt.
- Bind a genuine Q1 attestation for selection A to selection B; reject on exact
  digest inequality.
- Revalidate the same historical selection after a catalog update; its bytes
  remain interpretable, while use against the new live guard is stale.

## Codex-only review request

Review only whether this closed selection schema, domain-separated digest,
inventory/snapshot binding, acyclic attestation boundary, and explicit ownership
close D2-F3. Report current concrete defects only. Closure requires confidence
>=93 with zero failed checks, security findings, material dissent, and unresolved
questions.
