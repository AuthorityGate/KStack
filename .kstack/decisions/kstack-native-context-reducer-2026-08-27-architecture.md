# KStack-native context reducer — dependency-closed review packets

**Status:** DESIGN CANDIDATE — NOT IMPLEMENTED, NOT ACTIVATED, NOT BENCHMARKED

**Date:** 2026-08-27

## 1. Decision

Design a KStack-native Context Reduction Packet v1 (KCRP-v1). During eligible
remediation, KCRP sends the changed item and the exact transitive closure of its
declared dependencies instead of the entire growing artifact. Every reduced
packet is bound to the complete current artifact, an exact item map, effective
governance, and a canonical manifest. Initial review and final closure remain
full-artifact reviews.

This is not gstack prompt carving copied into KStack. KStack's item ledgers,
immutable digests, independent envelopes, and fail-closed gates are the primary
mechanism.

KCRP changes review-evidence bytes only. It does not change reviewer routing,
thresholds, round accounting, checks, clarification, QC, authority, or provider
failure behavior. A validated ledger row remains subordinate bookkeeping.

No reduction, cost, quality, or activation claim is made without the benchmark
defined below.

## 2. Current source evidence

| Evidence | Observation | SHA-256 |
|---|---|---|
| `kstack-dual-review.mjs` | Reads and dispatches the full prompt; advisory mode builds one full `SRC-DESIGN`. | `8500e912decb3121789238cafae1cd5a4ab7dd55a8869a384a2e5440b5f6dc21` |
| `kstack-citation-grounding.mjs` | Reuse-first base already supports multiple canonical sources, inclusion roles, source/record/packet hashes, parse/rebuild verification, and a 1,048,576-byte cap. | `537c87064ca701b80859c7a7e9a520f0be2b683584b3e4abf346887294f0fef8` |
| `kstack-design-gate.mjs` | Reconstructs the full design packet and binds the gate to its complete digest, invocation, envelopes, checks, and reviewers. | `4738b1c0a997c5b276564b9653cb56d58205be59dad28e3122614a54b0f7d89f` |
| `kstack-design/SKILL.md` | Requires bite-size remediation and per-item attribution while keeping the ledger subordinate. | `76ad348c62f47908a609bfb55e294b6e5760cba95d0fa45278ceeb9e2d5fb6c7` |
| `kstack-qc/SKILL.md` | Already requires compact packets reusable only while design, plan, and Git-state digests match. | `18373a0c08b0d425148538d1400a6fe61ff2ceebc483c550865da0c445ec24d8` |
| `ARTIFACTS.md` | Makes machine inputs digest-bound and drift stale. | `654ca57ac7f5a9a6bd728fcdbaf62bf09993528d4dd430bdb2dbd0cd7440e585` |
| Current config | Names phase reviewers and thresholds; KCRP reads but never rewrites it. | `c94fcb64796c7ee63237d476d6ce9d896705a58ec3e98cfc84a771b017811f63` |
| Current routing supersession | Its bounded scope is Codex-only closure at 93/all-zero with no Opus. | `182dda8b4ca7d3fa88aa3f56bb0744e5941c4d516bbc0c2edbf9ffd9077b406e` |

The three phase skills plus required design references and current config total
49,282 bytes. This supports separate measurement of artifact repetition, but
does not establish a reduction.

## 3. Correctness boundary

KCRP proves declared dependency closure, not semantic completeness. Therefore:

1. Reduction applies only to itemized remediation after one full review.
2. Round-one clarification always uses full sources.
3. Scope expansion, uncertainty, or graph failure selects full fallback.
4. Any design or QC closure candidate uses the full current artifact or diff.
5. Reducer failure produces verified full fallback or blocks dispatch.

The backward-compatible full-file route remains default and preserves binding
to the original full `designDigest`. KCRP is additive, not a replacement.

Evidence packets contain handles and non-sensitive metadata only. They never
source protected values from custody stores. Existing outbound scanning runs
after construction; a positive result blocks without altering and resending the
review evidence.

## 4. Required artifacts

Each reducible thread has two machine-readable sidecars:

1. `item-map.kcrp.json` binds stable item IDs to exact canonical byte spans and
   declares dependency edges.
2. `packet-manifest.kcrp.json` records one packet's roots, closure, governance,
   sources, fallback state, and bindings.

Markdown ledgers remain audit records. They may seed IDs but are not the graph
authority and never determine review closure.

## 5. Item-map schema

The map has exact top-level fields `schemaVersion`, `threadId`, `phase`,
`artifactSet`, `items`, and `mapSha256`.

Each `ArtifactBinding` has exactly:

```json
{
  "artifactId": "stable ASCII identifier",
  "role": "primary|objective|approved-design|final-plan|diff|verification|rollback|decision|governance",
  "repositoryRelativePath": "normalized path",
  "canonicalization": "kstack-utf8-lf-v1",
  "byteLength": 1,
  "sha256": "64 lowercase hex"
}
```

Each `ItemRecord` has exactly:

```json
{
  "itemId": "stable ASCII identifier",
  "artifactId": "existing artifactId",
  "spans": [{"byteStart": 0, "byteLength": 1, "sha256": "64 lowercase hex"}],
  "dependsOn": ["itemId"],
  "risk": "ordinary|high",
  "independence": "isolated|inseparable-minimal-mechanism|entangled",
  "status": "open|validated|rejected"
}
```

Paths are repository-relative, use `/`, contain no empty, `.` or `..` segment,
and resolve beneath the physical root. Duplicate physical identities fail.
Identifiers are unique by exact bytes without case folding or Unicode
normalization. Artifact bytes use fatal UTF-8, remove one leading BOM, and map
CRLF/CR to LF with no other normalization.

Spans are half-open, safe nonnegative integers, sorted, nonempty, in bounds,
and hash-bound. All spans across the complete map are disjoint; any overlap is
ambiguous and fails. Every dependency target exists and is not `rejected`;
self and duplicate edges fail. Cycles are allowed and closure includes the
complete reachable cycle. `mapSha256` is computed with that field omitted using
section 8 canonical JSON. A mismatch is stale. Unmapped text may be omitted in
remediation only; it returns in final full review. An `entangled` item is never
reducible. Rejected wording can be carried only as separately labeled counter-
evidence, never as a live dependency.

## 6. Exact dependency-closure algorithm

Given coordinator-supplied `requestedItemIds`:

1. Safely open and canonicalize every bound artifact once; reproduce its length
   and SHA-256.
2. Validate the entire map and reproduce `mapSha256`.
3. Require a nonempty, duplicate-free, bytewise-ASCII-sorted request. Every
   requested item exists and is `open`.
4. Reject reduction for `entangled`. An inseparable item includes its complete
   reachable cycle.
5. Initialize a FIFO queue with requested IDs in bytewise order.
6. Pop one ID. If new, add it to closure, validate its sorted unique dependency
   list, and enqueue those IDs in order.
7. Continue until empty; finite unique IDs guarantee termination.
8. Reproduce every included span digest from the already bound artifact.
9. Add the full mandatory governance set from section 7.
10. Create one existing `KSTACK-SOURCE-RECORD-V1` source per included span in
    item/span order. Source IDs are `KCRP_I<six-digit-item-ordinal>_S<six-digit-
    span-ordinal>` and the label carries the full item ID. Separate records
    avoid inventing separator bytes that could be mistaken for evidence.
11. Include complete phase evidence unless its excerpt has a validated map edge.
    Complete approved-design and final-plan identities remain present.
12. Independently rebuild sources, closure, manifest, and packet; exact equality
    is required before dispatch.

The closure proof is the ordered list of each included item and its direct edge
list, plus requested and included ID arrays. A verifier repeats steps 5-7 and
requires equality. This proves declared closure only.

## 7. Mandatory governance set

Reduced and full packets include these in full, never as summaries or digest-
only pointers:

- the effective project configuration;
- the loaded phase skill and every reference it requires (`SAFETY.md`,
  `ARTIFACTS.md`, and `DUAL_REVIEW.md` for design);
- every applicable locked owner directive or supersession governing routing,
  threshold, or scope;
- the thread's locked round-one clarification and confirmed supersessions;
- neutral reviewer rules, authority boundary, invocation, phase, operator round,
  and cumulative provider-call count; and
- QC risk classification and reviewer route, or full-review readiness contract,
  when applicable.

A closed `governanceInputs` registry supplies path, full digest, scope selector,
and precedence ordinal. Missing classes, equal-precedence conflicts, or unbound
applicability return `KCRP_GOVERNANCE_AMBIGUOUS`; prose is not heuristically
interpreted to choose a winner.

Where the 2026-08-27 Codex-only owner supersession applies, KCRP preserves
Codex-only review and 93/all-zero closure and does not invoke Opus. Outside its
exact scope, effective configuration and later owner records control. KCRP has
no substitute reviewer list or threshold.

## 8. Canonical hashing

Content reuses `kstack-packet-utf8-lf-v1` and
`KSTACK-SOURCE-RECORD-V1`. New JSON uses `kstack-kcrp-json-v1`:

- only JSON null, booleans, Unicode-scalar strings, arrays, objects, and safe
  integers; floats fail;
- object keys sort by UTF-8 bytes; arrays retain declared order;
- strings escape quotation mark, reverse solidus, and U+0000-U+001F; other
  scalars emit as UTF-8 without normalization;
- integers use shortest base-10 with no negative zero;
- no insignificant whitespace and no trailing newline.

Hashes are over canonical bytes:

```text
packetSha256 = SHA256(concatenated source-record bytes)
manifestSha256 = SHA256(canonical manifest with manifestSha256 omitted)
reviewInputSha256 = SHA256(exact final reviewer stdin bytes)
```

The complete primary-artifact digest remains separately bound in reduced mode.
Any source, map, governance, prompt-wrapper, or packet change makes a pending
receipt stale.

## 9. Packet manifest

The exact top-level fields are:

```text
schemaVersion, kind, invocationId, threadId, phase, round, route,
fallbackReason, requestedItemIds, includedItemIds, omittedItemIds,
closureProof, rootArtifacts, rootArtifactSetSha256, itemMapSha256,
governanceInputs, governanceSetSha256, sources,
packetCanonicalizationVersion, packetSerializationVersion,
packetFramingVersion, packetByteLength, packetSha256, reviewInputSha256,
scanReceipt, benchmark, manifestCanonicalizationVersion, manifestSha256
```

`kind` is `kstack-context-review-packet-v1`. `route` is `reduced`,
`full-required`, or `full-fallback`. Root/governance set hashes cover canonical
JSON of their complete ordered arrays. `omittedItemIds` is the exact set
difference between all mapped and included IDs, so a receipt cannot hide what
the reviewer did not see. `benchmark.status` is `not-measured` until section 14
is satisfied.

All listed fields are required. `schemaVersion` and `round` are positive safe
integers; identifiers/routes/digests/version labels are nonempty scalar strings;
ID and artifact collections are arrays in their specified canonical order;
`fallbackReason` is null only for `reduced` and `full-required`, otherwise one
section 10 code; `itemMapSha256` is null only when no map participates in a full
route; `sources` is the exact existing packet binding metadata; `scanReceipt`
has exact status, scanner-identity digest, input digest, and completion fields;
and `benchmark` has exact status plus nullable benchmark-record digest. Unknown
fields, unsafe integers, duplicate array members, wrong order, and nonmatching
derived values fail schema verification.

## 10. Full fallback and fail-closed states

No best-effort slice is dispatched. A failed reduced build is discarded and a
full packet is independently built from complete current phase evidence.

| Code | Meaning |
|---|---|
| `KCRP_MAP_MISSING` | No map exists for requested reduction. |
| `KCRP_MAP_STALE` | Map, artifact, span, or root digest does not reproduce. |
| `KCRP_DEPENDENCY_MISSING` | An item or dependency target is absent. |
| `KCRP_DEPENDENCY_AMBIGUOUS` | Duplicate identity/edge, invalid order, conflict, or entanglement prevents one closure. |
| `KCRP_GOVERNANCE_MISSING` | A mandatory governance class or file is absent. |
| `KCRP_GOVERNANCE_AMBIGUOUS` | Applicability or precedence is not unique. |
| `KCRP_SLICE_INVALID` | Span is empty, overlapping where forbidden, out of bounds, or digest-mismatched. |
| `KCRP_SCOPE_EXPANDED` | Repair or finding reaches outside declared closure. |
| `KCRP_FULL_REVIEW_REQUIRED` | Initial, clarification, closure, or user-requested full review. |

`full-fallback` binds every root, governance input, packet, scan, and final
prompt. Its trigger is retained as `fallbackReason`. If full construction is
oversized, unsafe, unreadable, stale, or otherwise unverifiable, no provider is
invoked and status is `KCRP_REVIEW_INPUT_BLOCKED`. There is no truncation,
summary substitution, silent exclusion, or unbound split.

Provider failure remains the existing provider path. It does not trigger a
reviewer change or a reducer fallback.

## 11. Reviewer receipt

Every KCRP envelope adds runner-populated `packetReceipt` with:

```text
kind, route, manifestSha256, packetSha256, reviewInputSha256,
rootArtifactSetSha256, governanceSetSha256, itemMapSha256,
requestedItemIds, includedItemIds, omittedItemIds, fallbackReason
```

The model response also echoes manifest digest, packet digest, route, and
included IDs. A mismatch is malformed. The runner binds the receipt into the
envelope and provider manifest. The gate reconstructs from current artifacts
and rejects stale or foreign receipts.

The existing envelope `designDigest` remains the SHA-256 of the complete
current design file, never the slice digest. KCRP bindings are additional, so
legacy full-file envelopes and gate behavior remain byte-compatible when KCRP
is disabled.

A reduced result emits `REDUCED_REVIEW_ADVISORY`; it cannot emit
`READY_FOR_USER_APPROVAL` or `QC_PASSED`. Final full review uses a new
invocation and does not inherit reduced confidence as closure evidence.

## 12. Changed-item slicing

The coordinator names item IDs; KCRP never derives them from a textual diff or
reviewer prose. The packet includes current requested spans, dependency closure,
previous validated wording when changed, the causing finding verbatim, relevant
check definitions/results, and complete governance.

A concern against an omitted item or document-wide invariant returns
`KCRP_SCOPE_EXPANDED`; next dispatch is full or uses a separately reviewed map
revision. The map is never silently edited after feedback. Map changes are
control-plane changes, get a new digest/audit record, and stale every unconsumed
packet built from the prior map.

## 13. Phase integration

### Design

- Round 1 and clarification use full artifacts.
- Remediation may reduce isolated or inseparable itemized findings only after a
  verified map and locked clarification.
- Scope uncertainty uses full fallback.
- Closure is a fresh full-artifact invocation under unchanged routing,
  threshold, and gate requirements.

### QC

- Initial QC retains the entire current change set in its compact evidence.
- Remediation may slice changed hunks plus exact approved-design/final-plan
  dependencies; Git, design, or plan drift invalidates it.
- Final QC uses the complete current diff and verification evidence.
- Existing high-risk routing and independence remain unchanged.

### Full review

- Environment/repository discovery is never reduced.
- Design stage follows the rules above.
- Readiness uses full current artifacts and the existing deterministic gate.

## 14. Benchmark and activation gate

KCRP remains `NOT_BENCHMARKED` until paired full-versus-reduced cases run with
frozen artifacts, map, model/version, reviewer rules, routing, and exposed
reasoning controls.

The corpus includes a small design, a large isolated repair, a dependency cycle,
a deliberately missing dependency with a seeded finding, a QC diff with
relevant/irrelevant files, stale/ambiguous/oversized/scan-positive/provider-
failure cases, and one overnight many-agent simulation.

Each invocation records provider-reported uncached input, cached input, output,
and total tokens when available; exact bytes and route; latency/model identity;
seeded findings, severity, false positives, misses, decision, confidence, and
extra repair rounds; fallback/block counts; and whole-workload totals.

Byte estimates cannot support a token claim. Missing provider counters produce
`NOT_MEASURED`. Activation requires no seeded security/material finding lost
against full baseline, no false closure, all negative fixtures failing closed,
and closure reproduced on the full artifact. The owner then selects acceptable
measured economics; this design invents no percentage.

## 15. Implementation sequence after separate approval

1. Freeze schemas and canonicalization fixtures.
2. Build a pure map/closure/manifest library with no provider execution.
3. Add independent rebuild verification and negative tests.
4. Add receipts while KCRP remains disabled.
5. Integrate design remediation behind explicit project configuration.
6. Integrate QC and full review without changing initial/final full paths.
7. Run paired benchmark and overnight simulation.
8. Obtain a benchmark-bound owner activation decision.

No runtime, configuration, skill, threshold, or reviewer route changes in this
candidate.

## 16. Rejected shortcuts

- Copy gstack percentages after carving skill prose: different workload and no
  KStack measurement.
- Let a model summarize dependencies: nondeterministic and not reconstructible.
- Parse Markdown ledger prose as the graph: subordinate and ambiguous.
- Carry governance only by hash: the reviewer cannot apply unseen rules.
- Let reduced review close at the normal threshold: declared closure is not
  semantic completeness.
- Truncate full fallback to fit: silent evidence loss.
- Alter a scan-positive packet then dispatch: reviewed bytes would differ.

## 17. Open findings

1. The runner/gate support one full design source, not KCRP manifests,
   multi-source phase packets, receipts, or non-closing advisory results.
2. No canonical JSON encoder plus independent decoder/verifier exists.
3. Human ledgers exist, but no machine map authoring/validation workflow does.
4. Governance applicability lacks a closed machine registry; ambiguity must use
   full fallback pending that registry.
5. Provider token-use collection is not evidenced in the current runner and
   needs a separate exact design.
6. The existing packet cap can block mandatory full fallback. Safe bound/split
   protocol is unresolved; v1 blocks rather than splits.
7. Checked-in skill/config prose and scoped owner routing are not fully aligned.
   KCRP preserves precedence but does not repair that broader inconsistency.

## 18. Self-review

**Self-score:** 86/100 for design completeness. This is not independent review
and cannot close the item. Strong points are non-closing slices, deterministic
declared closure, full governance, canonical binding, and fallback. Main risks
are governance applicability, full packets beyond the cap, and absent provider-
token benchmark evidence.

**Next bite-size review item:** review only the map/manifest schemas, canonical
JSON, closure algorithm, and failure precedence. Keep runner integration,
usage collection, and activation economics separate.
