# Domain breadth D6 - deterministic budget and applicability

**Parent item:** D6 deterministic prompt budget and bounded applicability  
**Route:** Codex-only, supplied-packet-only review; no Opus  
**Scope:** exact pre-dispatch accounting, caps, and post-selection applicability

## Provider budget profile

KStack admits only a closed, exact-digest `ProviderBudgetProfileV1` selected by
the operation before composition:

```text
{
  artifactType: "kstack-provider-budget-profile",
  schemaVersion: 1,
  providerId,
  modelId,
  contextWindowTokens,
  tokenizerMode: "qualified-exact" | "byte-upper-bound-v1",
  tokenizerName,
  tokenizerVersion,
  tokenizerCodeDigest,
  tokenizerAssetDigests,
  requestFramingVersion,
  fixedFramingTokens,
  perMessageFramingTokens,
  responseReserveTokens,
  safetyReserveTokens,
  profilePolicyDigest
}
```

The profile is KStack-owned policy, not provider/model output or pack content.
Unknown model/profile, changed tokenizer bytes, absent asset, invalid range, or
context-source ambiguity returns `PACK_BUDGET_PROFILE_UNQUALIFIED` before
composition. Runtime discovery cannot silently update it.

`qualified-exact` uses the named offline tokenizer over the exact fully framed
request bytes; qualification includes golden provider vectors and fixes all
special-token/framing behavior. `byte-upper-bound-v1` is admitted only for a
provider/model whose independent qualification proves that ordinary UTF-8
request text consumes no more than one content token per UTF-8 byte and whose
special framing cost is exactly covered by the fixed/per-message fields. Its
normative count is:

```text
contentUpperBoundTokens = totalRenderedUtf8Bytes
framingTokens = fixedFramingTokens +
                perMessageFramingTokens * messageCount
requestUpperBoundTokens = contentUpperBoundTokens + framingTokens
```

All arithmetic uses checked unsigned 64-bit integers. If that proof is absent,
the fallback is unavailable; KStack returns
`PACK_BUDGET_TOKENIZER_UNQUALIFIED` rather than guessing a ratio.

## Rendering and gate calculation

The composer freezes the ordered message/segment inventory and deterministically
renders base lanes, subject, workflow-owned evidence, selected pack delimiters
and sections, tool/schema material already authorized by the parent workflow,
and all provider framing. It measures actual UTF-8 bytes from the final bytes,
not declarations. Invalid UTF-8, render nondeterminism, overflow, or inventory
drift rejects.

For exact mode, the safety gate counts the complete final framed request in one
tokenizer call so cross-boundary token merges cannot invalidate additive
accounting. For fallback mode it applies the formula above to the complete
render. The gate computes:

```text
effectiveContext = min(profile.contextWindowTokens,
                       repositoryContextCapTokens,
                       operationContextCapTokens)
requiredTokens = requestTokensOrUpperBound +
                 responseReserveTokens + safetyReserveTokens
admit iff requiredTokens <= effectiveContext
```

Every cap is a positive checked integer and repository/operation caps may only
narrow the profile. The response and safety reserves are never available to
pack content. The receipt records every input cap, reserve, mode, profile and
tokenizer digest, exact final request bytes/digest, measured request bytes,
message count, request token count or upper bound, required total, effective
context, and remaining tokens. Gate arithmetic is repeated by dispatch
admission against the same immutable inventory; mismatch blocks dispatch.

The gate never truncates, summarizes, drops, reorders, substitutes, or
retokenizes content under another profile. Overflow returns
`PACK_BUDGET_EXCEEDED` with no provider call. A new narrower subject, pack
selection, pack version, or reviewed policy/profile is a new operation and a
new receipt, never an edit to the failed receipt.

## Pack byte caps

Each manifest's `maxUtf8Bytes` is a declared upper bound only. It must be a
canonical positive integer no greater than the KStack v1 hard cap of 16,384.
The actual rendered bytes for that pack must be no greater than the minimum of
its declaration, the repository per-pack cap, the operation per-pack cap, and
16,384. Combined actual rendered pack bytes must be no greater than the minimum
of repository total-pack cap, operation total-pack cap, and the v1 hard cap of
32,768. A declaration cannot grant capacity; actual measured bytes always
govern. Pack and total byte checks are independent of the provider token gate,
and the lower applicable allowance wins.

## Bounded post-selection applicability

Pack-authored content no longer owns `appliesTo`. The KStack-owned catalog
snapshot contains a closed `CatalogApplicabilityV1` table binding exact
`packMaterialDigest` and `sectionId` to a non-empty set drawn from the contract
v1 enum:

```text
release-plan | release-observation | rollback-plan |
incident-handoff | design-brief | implementation-plan | qc-report
```

There are no wildcards, regexes, prefixes, paths, predicates, priorities,
triggers, model/provider selectors, or extension values. Changing the table is
a new catalog snapshot and follows D5 activation; pack bytes cannot broaden it.

The KStack-owned selector first fixes the operation's one canonical
`artifactClass` and may select only packs with at least one applicable section.
After D2 selection is verified, composition includes exactly those selected
sections whose table entries contain that class, preserving catalog section
order. Applicability cannot add/remove a selected pack, suppress a required
pack, reorder sections, modify base lanes, or consult subject/Jira/web/memory/
model text. A selected pack with zero matching sections, unknown class,
material/table digest mismatch, missing/duplicate table row, or table drift is
`PACK_SELECTION_INVALID` before rendering.

The receipt records the artifact-class enum, applicability-table digest,
matched `(packId, sectionId)` pairs in order, actual rendered bytes per pair and
per pack, cumulative rendered bytes after each pack, and—exact tokenizer mode
only—cumulative full-request token counts after each deterministic prefix.
Only the complete final count is authoritative for admission; marginal token
deltas are diagnostic because tokenization need not be additive.

## Deterministic verification

- Golden vectors cover exact and fallback profiles, framing overhead, every
  cap/reserve input, checked-arithmetic overflow, multi-byte Unicode, empty and
  boundary-sized segments, and exact equality at/one over each limit.
- Change model/profile/tokenizer code or asset digest, framing version,
  context source, reserve, message count, or final byte; either the receipt and
  count change deterministically or the profile rejects.
- Demonstrate whole-request exact counting differs from naive segment sums and
  verify admission uses only the whole-request result.
- Try an unqualified fallback, ratio other than one byte per token, absent
  special-token proof, unknown model, or runtime-reported larger context;
  reject without provider dispatch.
- Set declared `maxUtf8Bytes` above policy, understate actual bytes, overflow
  per-pack/combined/context caps, or request truncation/deselection; reject.
- Inject applicability through pack/Jira/web/memory/model text, use wildcard or
  unknown classes, change a material digest, select a zero-match pack, or race
  catalog table changes; reject before prompt publication.

## Review request

Review only whether this design closes D6 deterministic budget and bounded
post-selection applicability. Report current concrete defects only. Closure
requires confidence >=93 and zero failed checks, security findings, material
dissent, and unresolved questions.
