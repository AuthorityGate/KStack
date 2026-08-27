# Domain breadth D2-F1 - cross-tier resolution and equality correction

**Parent item:** D2 exact-byte selection and stale-catalog outcome  
**Supersedes D2 digest:** `0f29c20c1aab0135babc7c708eb0bf27cc54e1b6fa30e01d54517e9d35504d12`  
**Route:** Codex-only improvement; no Opus  
**Scope:** only residual `D2-F1`

## Preserved validated mechanism

The prior D2 candidate's generation guard through provider-launch admission,
closed composition-input inventory, descriptor reads, digest verification,
acyclic material -> review -> approval -> snapshot -> selection projection,
literal type/version/domain prefixes, expected-call-site formula selection,
fixed-length digest comparison, and all existing negative/golden-vector tests
remain normative and unchanged.

The owner-identity question remains unresolved and fail-closed. This correction
does not select an identity adapter, design policy-digest ownership, define the
selection-digest domain, activate a pack, or authorize implementation.

## Exact D2-F1 correction

An authority validator receives only a top-level expected artifact digest plus
a repository-owned, immutable `ValidationInventoryV1`. The inventory is built
before validation from the exact descriptor set bound into the operation
receipt; it is a closed map keyed by `(expectedArtifactType, digestBytes)` to
one exact byte string. Duplicate keys, an unexpected type, a digest-key/byte
mismatch, a missing subordinate, more than one byte string for a key, or any
lookup outside this inventory fails before an authority decision. Artifact
payload fields can name digests but can never supply, redirect, fetch, or
replace subordinate bytes.

Validation proceeds strictly from the expected call site:

1. Resolve the expected approval bytes from inventory key
   `("kstack-pack-approval", expectedApprovalDigest)`; validate the closed
   schema/type/version and recompute the approval digest.
2. Resolve review bytes only from inventory key
   `("kstack-pack-review", approval.reviewArtifactDigest)`; validate its
   closed schema/type/version and recompute its digest.
3. Resolve material bytes only from inventory key
   `("kstack-pack-material", approval.materialDigest)` and compatibility
   bytes only from
   `("kstack-pack-compatibility-tuple", review.compatibilityTupleDigest)`;
   validate and recompute both.
4. Require fixed-length decoded-byte equality for every cross-tier
   restatement before accepting authority:

   ```text
   approval.materialDigest == review.materialDigest ==
     recomputedMaterialDigest

   approval.reviewArtifactDigest == recomputedReviewArtifactDigest

   approval.acceptedVerdict == review.verdict

   review.compatibilityTupleDigest == recomputedCompatibilityTupleDigest
   ```

   String normalization, prefix matching, textual case folding, or trusting a
   restated field without subordinate recomputation is prohibited.
5. Only after all resolution, schema, digest, and equality checks pass may the
   validator emit the approval projection consumed by the already-preserved
   snapshot and selection mechanism. Failure emits no partial projection and
   no authority-bearing result.

No repository path, URI, catalog entry, network response, embedded object, or
caller-provided resolver participates in subordinate resolution. The exact
operation-bound inventory is the only resolution source.

## Deterministic verification

- Put a genuine material-A approval beside a genuine material-B review under
  the digest named by the approval; reject because the approval/review material
  digests are not equal, even though every individual artifact digest is valid.
- Pair an approval that accepts `approve` with a genuine referenced review
  whose verdict is `revise`; reject on verdict byte inequality.
- Supply material bytes under a digest key computed from different bytes;
  reject the inventory before graph validation.
- Supply two byte strings for the same `(type,digest)` key, omit a subordinate,
  use the right digest under the wrong type, or request external/path fallback;
  reject before authority and emit no projection.
- Validate the exact coherent graph twice with permuted inventory insertion
  order; both executions emit identical approval-projection bytes.
- Retain all prior D2 negative and golden-vector fixtures unchanged.

## Explicit residual ownership

This pass does not hide the other Opus closure findings:

- `D2-F2` (review/approval policy digest domains) remains open and will be
  reviewed independently as D2-POLICY after D2-F1.
- `D2-F3` (selection digest domain/ownership) remains open and will be reviewed
  independently as D2-SELECTION after D2-POLICY.

## Codex-only review request

Review only whether this exact inventory-resolution and cross-tier equality
contract closes `D2-F1` without reopening the preserved D2 mechanism. Report
current concrete defects only. Closure requires confidence >=93 with zero
failed checks, security findings, material dissent, and unresolved questions.
