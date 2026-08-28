# KCRP R2b1 addendum — residual findings 1–6

**Status:** DESIGN CANDIDATE ADDENDUM — FINDINGS 1–6 RESOLVED IN DESIGN ONLY  
**Date:** 2026-08-27  
**Parent candidate SHA-256:** `879942237c11baf9275652357039bfa276d84237a81eccec56b3477465c26d96`  
**R2a addendum SHA-256:** `b5e552904ce6a6e073436c8b84925a8f1a968468febc92bb141fd4e40732b442`  
**Scope:** R2a independent-review residuals 1–6 only

## 1. Normative reach and resolved status

This addendum has global conflict precedence over the parent candidate and R2a,
not merely R2a's original parent-sections-5-through-11 boundary. Specifically:

- it supersedes parent section 4's two-artifact inventory with section 2 below;
- it supersedes parent finding 17.4's full-fallback treatment for missing or
  ambiguous governance with the terminal-block rule below; and
- it supersedes any parent/R2a schema, receipt, graph, or array-order wording
  that conflicts with sections 3 through 7 below.

Residual findings 1–6 are **resolved in this design candidate** by these exact
normative replacements. This status is not implementation, independent review,
activation, or gate closure.

Independent-review findings 7–12 remain open exactly as reported. R2b1 does not
restate, narrow, answer, supersede, or change their status or next actions.

## 2. Complete required-artifact inventory

The globally effective inventory is:

1. one project-scoped canonical
   `.kstack/context/governance-registry.kcrp.json`, required for every reduced
   and full KCRP attempt;
2. one thread-scoped `item-map.kcrp.json`, required when a current thread-map
   registration exists and always required for a reduced attempt;
3. one immutable `dispatch-manifest.kcrp.json` body for every buildable
   dispatch candidate;
4. one scan receipt for every constructed exact review input;
5. one runner receipt for every provider attempt, including unavailable/start-
   failure attempts where no child process begins; and
6. one predispatch block receipt when no valid dispatch manifest/input may be
   produced.

Absence, staleness, or ambiguity of the governance registry is terminal before
map evaluation, full-inventory building, scan, or provider start. It never
selects `full-fallback`. Parent section 17.4 is therefore resolved, not retained
as an alternative route.

## 3. Governance class enum and cardinality

Every `governance-registry-v1` entry adds required `class`, exactly one of this
closed ordered enum:

```text
authority
review-routing
confidence-gate
artifact-policy
phase-procedure
owner-supersession
```

The first five are base classes. After exact-scope filtering and supersession
resolution, there MUST be exactly one effective winner for each base class.
Zero or more applicable historical records may participate in each class, but
they must form one finite supersession chain ending at that single winner.

`owner-supersession` has zero or one effective winner. When zero applicable
entries exist, the effective tuple records `ownerSupersessionRuleId:null`. When
one or more exist, every applicable entry must belong to one finite chain ending
at exactly one winner, and the tuple records that winner. Two terminal entries,
an unknown superseded ID, a cross-class supersession, cycle, fork without one
terminal winner, or equal-precedence contradictory winner is governance
ambiguity.

Registry cardinalities are:

- total entries: 5 through 128;
- applicable entries per base class: 1 through 32;
- applicable owner-supersession entries: 0 through 32;
- effective base winners: exactly 5, one per base class; and
- effective owner winner: 0 or 1.

An entry may supersede only an applicable entry of the same class at a strictly
lower integer precedence. Every nonterminal applicable entry is named exactly
once by the next chain member's `supersedesRuleIds`; the terminal winner is
named zero times. These invariants make cardinality and selection mechanical.

The effective policy tuple adds `effectiveRuleByClass`, an exact object with all
six enum keys. The first five values are rule IDs; `owner-supersession` is a
rule ID or null. The tuple digest continues to bind full applicable normative
bytes and the complete ordered applicable history.

Any cardinality or chain failure produces the appropriate terminal
`KCRP_GOVERNANCE_MISSING`, `KCRP_GOVERNANCE_STALE`, or
`KCRP_GOVERNANCE_AMBIGUOUS` predispatch block. The full builder is not called.

## 4. Reconciled scan and runner block fields

The R2a exact scan-receipt field list is replaced by:

```text
schemaVersion, kind, invocationId, dispatchManifestSha256,
reviewInputSha256, effectivePolicySha256, scannerExecutableSha256,
scannerConfigurationSha256, manifestByteLength, packetByteLength,
framingByteLength, reviewInputByteLength, status, findingCode, block,
completedAt
```

For scan `status=pass`, `findingCode=null` and `block=null`. For
`status=block`, `findingCode` is one closed scanner code and `block` is exactly
`{code:findingCode,stage:"scan",evidenceSha256}`. No other combination is
valid. A scan block creates no runner receipt because no provider starts.

The R2a exact runner-receipt field list is replaced by:

```text
schemaVersion, kind, invocationId, dispatchManifestSha256,
reviewInputSha256, scanReceiptSha256, effectivePolicySha256,
providerId, providerConfigurationSha256, rawResponseSha256,
responseReceiptStatus, outcome, block, exitCode, signal,
startedAt, completedAt
```

`outcome=complete` requires `block=null`, non-null raw-response digest,
`responseReceiptStatus=valid`, exit code 0, and signal null. Provider start,
timeout, signal, unavailable, or nonzero outcomes require a non-null
`block.stage="provider"` with their closed provider code. A complete process
whose structured response or response receipt is malformed requires non-null
`block.stage="response"`, preserves the raw-response digest, and uses
`outcome=malformed-response`. The typed block stage enum is therefore globally:

```text
governance|construction|size|scan|provider|response|freshness
```

The immutable dispatch manifest still has `block=null` when it reaches scan.
Later receipts record their own terminal block; no earlier hashed node is
rewritten.

## 5. Unbuildable full fallback preserves the reduction failure

After a reduced candidate fails, its ordered primary `reductionFailure` is
immutable for that invocation. The coordinator attempts the complete full
inventory exactly once.

If the full-fallback inventory cannot be safely enumerated, opened, identified,
canonicalized, or completely source-bound, no dispatch manifest is emitted.
The predispatch block receipt uses `requestedRoute="full-fallback"`, preserves
the original non-null `reductionFailure`, and adds:

```json
{
  "block": {
    "code": "KCRP_FULL_INVENTORY_UNBUILDABLE",
    "stage": "construction",
    "evidenceSha256": "canonical full-build diagnostic digest"
  }
}
```

If the complete inventory builds but its packet/input exceeds a fixed bound,
the same receipt preserves the original reduction failure and uses
`KCRP_FULL_TOO_LARGE` at stage `size`. Scanner-positive and provider outcomes
occur only after a valid full-fallback manifest and therefore bind its non-null
reduction failure normally.

The R2a predispatch-block receipt exact fields are globally replaced by:

```text
schemaVersion, kind, invocationId, threadId, phase, purpose,
requestedRoute, effectivePolicySha256, reductionFailure,
block, diagnosticSetSha256, createdAt
```

`reductionFailure` is required and non-null exactly when
`requestedRoute=full-fallback`; otherwise it is null. A full-build block never
overwrites, reclassifies, or drops the causal reduced failure. It starts no
scanner/provider and cannot recurse into another fallback.

## 6. Reachable entanglement and mechanism groups

The parent `ItemRecord.independence` field and its
`isolated|inseparable-minimal-mechanism|entangled` enum are removed globally.
They are replaced by exactly:

```json
{
  "reductionEligibility": "reducible|entangled",
  "mechanismGroupId": "null or ID matching ^MG_[A-Z0-9_-]{1,60}$"
}
```

Inseparability is represented by the dependency graph, not a prose enum. On the
complete validated item graph, compute strongly connected components as the
mathematical mutual-reachability partition. Each component's member IDs sort by
ASCII bytes; the component array sorts by its first member ID.

The invariant is exact:

- every component with two or more members has one non-null group ID shared by
  all and only those members;
- every non-null group ID maps to exactly one component of two or more members;
- singleton components have null group ID; and
- self edges, a group spanning components, mixed IDs inside one component, or a
  non-null singleton group are schema failures.

Thus each cyclic component is one inseparable mechanism group. Acyclic
dependencies need no group: ordinary transitive closure already includes them.

Closure traversal never stops at the first entangled vertex. It computes the
complete reachable set from all requested IDs, including complete components,
then evaluates every reachable item in sorted item-ID order. It derives:

```text
reachableEntangledItemIds = sorted IDs in closure where
  reductionEligibility == entangled
```

When this array is nonempty, the one primary reduction failure is
`KCRP_ENTANGLED_REACHABLE`; its bounded diagnostic binds the complete array and
the affected component/group IDs. The route attempts full fallback once.
An entangled dependency can therefore never be hidden merely because the
requested root was reducible or because a different traversal order encountered
another failure first. The row-7 failure precedence still chooses the primary
code after the complete graph diagnostic is computed.

## 7. Complete array-order contract

Every named array in the parent/R2a/R2b1 effective schema has exactly this
order; duplicate members are rejected:

| Array | Canonical order |
|---|---|
| `artifactSet`, `rootArtifacts` | `artifactId`, then role, then repository-relative path, all ASCII bytewise |
| `items` | bytewise ASCII `itemId` |
| `spans` | `artifactId`, numeric byte start, numeric byte length, SHA-256 bytes |
| `dependsOn`, requested/included/omitted item IDs | bytewise ASCII item ID |
| `closureProof` | item ID; each nested direct-dependency array uses item-ID order |
| SCC/components | first member ID; nested members use item-ID order |
| mechanism-group ID lists, reachable-entangled IDs | bytewise ASCII ID |
| registry `entries` | numeric precedence, class enum ordinal, scope project/thread/phase/purpose bytes, then `ruleId` as final tie-break |
| `supersedesRuleIds` | length zero or one; its sole ID is exact ASCII |
| `applicableRuleIds` | the same registry-entry resolution order, including final `ruleId` tie-break |
| `applicableArtifactSha256s` | positional one-to-one order of `applicableRuleIds`, never independently sorted |
| `requiredReviewers` | exact unique order declared by the resolved effective policy |
| `requiredCheckIds` | bytewise ASCII check ID |
| `supplementalEvidence` | kind enum ordinal, then bytewise evidence ID |
| relationship `itemIds`, `findingIds` | bytewise ASCII respective ID |
| packet `sources` and source-binding metadata | generated bytewise ASCII `sourceId` |
| complete diagnostic set | failure-precedence ordinal, code bytes, evidence-digest bytes |

The governance class enum ordinal is the section 3 display order. Scope fields
use literal `*` bytes where present. A registry record whose preceding tuple is
identical to another still sorts uniquely by `ruleId`; equal `ruleId` is a
duplicate, not another tie-break case.

Any schema array not named above is forbidden in v1 unless a later normative
version supplies its exact ordering. An implementation may iterate differently
internally, but serialized arrays and independently reconstructed outputs must
match this table byte-for-byte.

## 8. Acceptance evidence for findings 1–6

The isolated R2b1 test plan must prove:

1. the global supersession removes the parent two-artifact and governance-full-
   fallback conflicts from the effective normative projection;
2. every governance class cardinality boundary and chain failure, including two
   applicable terminal owner winners, blocks with zero full-builder calls;
3. scan/runner pass, scan block, provider block, and malformed-response block
   shapes accept only their exact field/null matrix;
4. unbuildable and oversized full fallback preserve byte-identical original
   `reductionFailure` while adding the terminal block;
5. entanglement reached at depth greater than one and in multiple components is
   completely reported independent of dependency declaration order;
6. every valid/invalid SCC-to-mechanism-group shape and removal of the old
   `independence` field; and
7. every named array accepts canonical order and rejects one adjacent swap,
   with a governance fixture that reaches the `ruleId` tie-break.

These tests remain design requirements. No runtime or activation claim follows
from this addendum.

## 9. Open findings preserved

Independent-review findings 7, 8, 9, 10, 11, and 12 remain `OPEN` without any
wording, severity, scope, evidence, question, or next-action change. They are
outside R2b1 and must be carried verbatim into the next review packet from the
independent review record, not reconstructed from this addendum.

## 10. Self-review

**Self-score:** 94/100 for residual findings 1–6 only. This is not independent
review and cannot close KCRP. The remaining six points reflect that the closed
contracts have not been mechanically projected or fixture-tested and findings
7–12 intentionally remain open.
