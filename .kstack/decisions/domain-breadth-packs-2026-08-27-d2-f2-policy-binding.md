# Domain breadth D2-F2 - policy artifact digest domains

**Parent item:** D2 exact-byte selection and stale-catalog outcome  
**Preserved D2-F1 digest:** `a32b324ff819c6815bf15d0888bfbe7c546a1503332b6e8ab8b96e8941b4eac9`  
**Route:** Codex-only improvement; no Opus  
**Scope:** only residual `D2-F2`

## Preserved mechanism

All previously accepted D2 mechanisms and D2-F1's exclusive
`ValidationInventoryV1` resolution/equality contract remain normative and
unchanged. D2-F3 remains open. Q1 remains unresolved and fail-closed.

## Closed policy artifact types

`reviewPolicyDigest` and `approvalPolicyDigest` can refer only to these distinct
closed artifacts. `canonicalV1` is the already-preserved duplicate-rejecting,
unknown-field-rejecting canonical JSON encoding.

```text
reviewPolicyDigest = SHA256(
  UTF8("KSTACK-PACK-REVIEW-POLICY-V1\n") ||
  canonicalV1({
    artifactType: "kstack-pack-review-policy",
    schemaVersion: 1,
    policyVersion,
    requiredReviewerClasses,
    minimumConfidence,
    requiredChecks,
    blockOnSecurityFinding,
    blockOnMaterialDissent,
    blockOnUnresolvedQuestion
  }))

approvalPolicyDigest = SHA256(
  UTF8("KSTACK-PACK-APPROVAL-POLICY-V1\n") ||
  canonicalV1({
    artifactType: "kstack-pack-approval-policy",
    schemaVersion: 1,
    policyVersion,
    acceptedReviewVerdicts,
    requireAllReviewChecks,
    requireIndependentApproval,
    allowedApprovalClasses
  }))
```

Every array has a separately specified closed enum, is duplicate-free, and is
encoded in lexicographic UTF-8 byte order. `policyVersion` is an integer in
`1..2147483647`; numeric floats, alternate numeric spellings, Unicode aliases,
unknown enum members, unknown fields, and empty required sets are rejected.
The two literal domain prefixes include the terminal LF. A call site selects
the expected schema and prefix; an artifact cannot choose its digest formula.

## Resolution and binding

Before a review or approval contributes to authority, the D2 validator must:

1. Resolve the exact policy bytes only from the operation-bound inventory key
   `(expected policy artifact type, referenced digest bytes)`.
2. Validate the literal type/version and all closed field constraints, recompute
   the expected domain-separated digest, and compare fixed-length digest bytes.
3. For a review, require its `reviewPolicyDigest` to equal the recomputed review
   policy digest. For an approval, require its `approvalPolicyDigest` to equal
   the recomputed approval policy digest.
4. Apply the resolved policy to the already-validated review or approval
   fields; a valid digest without policy conformance fails closed.
5. Bind both exact policy digests into the downstream approval projection,
   snapshot, selection receipt, and provider-dispatch receipt so a later policy
   change cannot reinterpret historical authority.

There is no implicit default, mutable named policy, latest-version lookup,
repository-path fallback, network resolution, or caller-supplied policy object.
Policy artifacts cannot contain pack content, tools, credentials, model/provider
choices, external destinations, scripts, or permission grants.

## Ownership boundary

This item owns only policy **byte identity, domain separation, resolution, and
historical binding**. D3 owns who may create, replace, weaken, waive, or approve
these policies and remains `BLOCKED-OWNER` until Q1 selects the authenticated
identity and separation-of-duty boundary. Until then, no policy artifact can be
activated, replaced, weakened, or used to authorize an operation; fixtures may
exercise validation only.

## Deterministic verification

- Hash identical canonical payload bytes under both policy prefixes; digests
  differ. Remove/change type, version, prefix, terminal LF, or a closed enum;
  reject.
- Place review-policy bytes under an approval-policy key or swap referenced
  policy digests; reject before authority.
- Use a valid policy digest but a review below its threshold, with a failed
  required check, security finding, dissent, or unresolved question; reject.
- Use an approval whose verdict/class is excluded by its policy; reject.
- Omit the policy, provide two bytes for one inventory key, use a mutable name,
  or change policy bytes after a receipt is built; reject without a projection.
- Revalidate a historical receipt after installing different policy bytes;
  interpretation remains pinned to the recorded exact policy digests.

## Codex-only review request

Review only whether the two distinct policy artifact schemas, domain formulas,
closed resolution, enforcement, receipt binding, and explicit D3 ownership
close D2-F2 without pretending Q1/D3 is resolved. Report current concrete
defects only. Closure requires confidence >=93 and zero failed checks, security
findings, material dissent, and unresolved questions.
