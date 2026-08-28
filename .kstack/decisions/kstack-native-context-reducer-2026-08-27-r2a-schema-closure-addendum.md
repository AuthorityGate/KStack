# KCRP R2a normative addendum — schema, closure, and failure precedence

**Status:** DESIGN CANDIDATE ADDENDUM — NOT IMPLEMENTED, NOT ACTIVATED  
**Date:** 2026-08-27  
**Parent candidate:** `kstack-native-context-reducer-2026-08-27-architecture.md`  
**Parent SHA-256:** `879942237c11baf9275652357039bfa276d84237a81eccec56b3477465c26d96`  
**Scope:** R2a only; schema, canonicalization, failure, and closure P0/P1 repairs

## 1. Normative effect and preserved findings

This addendum supersedes parent sections 5 through 11 only where the contracts
below conflict. All parent safety boundaries, phase routing, thresholds,
full-initial/full-clarification/full-closure requirements, benchmark gate, and
non-activation status remain unchanged.

R2a addresses exactly this independent-review cluster:

1. acyclic hash DAG separating dispatch manifest, review input, scan receipt,
   and runner receipt;
2. deterministic failure precedence, with governance missing or ambiguous a
   terminal pre-dispatch block rather than a full fallback;
3. separate `purpose`, `route`, `reductionFailure`, and `block` fields;
4. machine closure rule requiring fresh `purpose=closure`,
   `route=full-required`, and zero omissions, never `full-fallback`;
5. per-artifact span overlap and complete ordering/count limits;
6. parse/re-encode canonical JSON with duplicate-key rejection and exact escape
   rules;
7. governance-registry and effective-policy-tuple binding;
8. reconstructible size-limit fields and exact oversized transitions;
9. explicit legacy `designDigest` to primary-root relationship; and
10. typed supplemental evidence and a non-circular response receipt.

It does not design runner integration, provider token collection, activation
economics, or a split protocol for an oversized full review.

## 2. Four-node acyclic hash DAG

The only permitted dependency direction is:

```text
bound artifacts + item map + governance registry + effective policy
  -> dispatch manifest body
  -> exact review input
  -> scan receipt
  -> raw provider response
  -> runner receipt
  -> reviewer envelope
```

No node contains its own digest or the digest of a later node.

### 2.1 Dispatch manifest

`dispatch-manifest.kcrp.json` is the canonical manifest **body**. It contains no
`dispatchManifestSha256`, `reviewInputSha256`, scan result, provider result,
runner receipt, or envelope digest. After canonical encoding:

```text
dispatchManifestSha256 = SHA256(dispatch-manifest.kcrp.json exact bytes)
```

### 2.2 Review input

The review input is deterministically framed from the canonical manifest bytes,
the uppercase detached `dispatchManifestSha256`, and the exact ordered source-
record bytes. It does not contain `reviewInputSha256` or any scan/runner receipt.

```text
reviewInputSha256 = SHA256(exact final provider stdin bytes)
```

### 2.3 Scan receipt

Only after the review input is immutable does the outbound scanner create a
canonical receipt containing `dispatchManifestSha256`, `reviewInputSha256`,
scanner identity/config digests, completion status, and measured input length.

```text
scanReceiptSha256 = SHA256(canonical scan receipt bytes)
```

A non-pass scan receipt is terminal and no provider starts.

The scan receipt has exactly:

```text
schemaVersion, kind, invocationId, dispatchManifestSha256,
reviewInputSha256, effectivePolicySha256, scannerExecutableSha256,
scannerConfigurationSha256, manifestByteLength, packetByteLength,
framingByteLength, reviewInputByteLength, status, findingCode, completedAt
```

`kind` is `kstack-kcrp-scan-receipt-v1`; status is `pass` or `block`;
`findingCode` is null exactly on pass. Lengths are safe nonnegative integers and
must reconstruct the input. Time is RFC 3339 UTC and is audit metadata only.

### 2.4 Runner receipt

After provider completion or terminal provider outcome, the runner creates a
canonical receipt containing the three earlier digests, exact raw-response
digest when any, typed response-receipt validation, provider configuration
digest, start/end state, and terminal outcome.

```text
runnerReceiptSha256 = SHA256(canonical runner receipt bytes)
```

The reviewer envelope may contain the runner receipt and its digest. The runner
receipt never contains the envelope digest; the provider manifest may then bind
the completed envelope. This ordering has no hash cycle.

The runner receipt has exactly:

```text
schemaVersion, kind, invocationId, dispatchManifestSha256,
reviewInputSha256, scanReceiptSha256, effectivePolicySha256,
providerId, providerConfigurationSha256, rawResponseSha256,
responseReceiptStatus, outcome, exitCode, signal, startedAt, completedAt
```

`kind` is `kstack-kcrp-runner-receipt-v1`. Nullable raw digest, exit code, and
signal have exact outcome-dependent rules. Unknown fields or a time earlier than
`startedAt` fail receipt validation; timestamps do not participate in policy or
freshness decisions.

## 3. Canonical JSON parser and encoder

All KCRP JSON uses `kstack-kcrp-json-v1` with this required verification:

1. Read bytes with fatal UTF-8. BOM is forbidden.
2. Tokenize while retaining every object key occurrence. Reject duplicate keys
   before constructing an object. Duplicate identity compares decoded Unicode
   scalar sequences exactly; normalization and case folding are forbidden.
3. Parse only null, booleans, strings, arrays, objects, and safe integers.
   Floating-point, exponent, NaN, Infinity, and negative zero forms fail.
4. Validate exact schema, types, enums, counts, bounds, required fields, and no
   unknown fields.
5. Re-encode using the rules below and require byte-for-byte equality with the
   input. Parse success without exact re-encoding equality is noncanonical.

The encoder is exact:

- object keys sort ascending by their unescaped UTF-8 byte sequences;
- arrays retain the schema-required order;
- integers use `0` or `-?[1-9][0-9]*` shortest form and must be JavaScript safe
  integers;
- quotation mark encodes as `\"`, reverse solidus as `\\`, and U+0000 through
  U+001F as lowercase `\u00xx` exactly; named escapes such as `\n` and escaped
  solidus are never canonical;
- every other Unicode scalar is emitted as raw UTF-8 without normalization;
- lone surrogate escapes fail; a valid surrogate pair parses to one scalar and
  re-encodes as its raw UTF-8 scalar, so escaped non-control scalars fail exact
  canonical equality;
- commas and colons have no surrounding whitespace; no other whitespace and no
  trailing newline occur.

Required negative fixtures cover duplicate keys at every object depth,
alternative escapes, escaped solidus, named control escapes, invalid UTF-8,
BOM, lone surrogates, valid-but-noncanonical surrogate pairs, key-order drift,
array-order drift, whitespace, leading zeros, negative zero, unsafe integers,
fractions, exponents, missing fields, and unknown fields.

## 4. Item map limits, overlap, and order

These v1 limits are fixed inputs to validation and appear in the dispatch
manifest `limits` tuple:

| Quantity | Maximum |
|---|---:|
| bound artifacts | 256 |
| items | 4,096 |
| spans per item | 64 |
| spans across map | 16,384 |
| direct dependencies per item | 256 |
| requested items | 256 |
| included items | 4,096 |
| governance entries | 128 |
| supplemental-evidence entries | 256 |
| packet source records | 32,768 |
| canonical item-map bytes | 4,194,304 |
| canonical dispatch-manifest bytes | 4,194,304 |
| packet bytes | 1,048,576 |
| exact review-input bytes | 1,200,000 |

The item-map order is complete and mandatory:

- `artifactSet` by bytewise ASCII `artifactId`;
- `items` by bytewise ASCII `itemId`;
- each item's `spans` by `artifactId`, then `byteStart`, then `byteLength`;
- each `dependsOn` and every item-ID set by bytewise ASCII item ID;
- governance entries by integer precedence, scope selector bytes, then artifact
  ID;
- supplemental evidence by `kind`, then `evidenceId`; and
- packet sources by generated `sourceId`.

Artifact, item, evidence, finding, rule, and source IDs match
`^[A-Z][A-Z0-9_-]{0,63}$`; thread IDs match
`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. Ordering compares their ASCII bytes.

For each artifact independently, collect every span from every item referring
to that artifact, sort by start/end/item ID, and require
`previous.byteStart + previous.byteLength <= current.byteStart`. Any partial or
exact overlap in one artifact is `KCRP_SPAN_OVERLAP`; offsets in different
artifacts are unrelated and never compared. Addition and end-offset arithmetic
must be safe-integer checked before comparison.

All declared counts must equal reconstructed counts and remain within the table.
Duplicate IDs, edges, entries, or sources fail even when sorted adjacency would
otherwise make them deterministic.

## 5. Dispatch-manifest schema

The manifest body has these exact required top-level fields and no others:

```text
schemaVersion, kind, invocationId, threadId, phase, round,
purpose, route, reductionFailure, block,
limits, measurements, requestedItemIds, includedItemIds, omittedItemIds,
closureProof, rootArtifacts, rootArtifactSetSha256,
primaryRootRelationship, itemMapSha256,
governanceRegistry, effectivePolicy, effectivePolicySha256,
supplementalEvidence, sources,
packetCanonicalizationVersion, packetSerializationVersion,
packetFramingVersion, packetByteLength, packetSha256,
manifestCanonicalizationVersion
```

`purpose` is exactly one of `initial`, `clarification`, `remediation`,
`closure`, or `readiness`. `route` is exactly `reduced`, `full-required`, or
`full-fallback`.

`reductionFailure` is either null or:

```json
{
  "code": "closed KCRP reduction code",
  "stage": "map|closure|slice|size",
  "evidenceSha256": "digest of canonical bounded diagnostic evidence"
}
```

It is non-null only with `route=full-fallback`. `full-required` and `reduced`
require null. A governance failure is never represented here.

`block` is either null or:

```json
{
  "code": "closed KCRP terminal code",
  "stage": "governance|construction|size|scan|provider|freshness",
  "evidenceSha256": "digest of canonical bounded diagnostic evidence"
}
```

A dispatch manifest ready for scanning requires `block=null`. When construction
is blocked before a valid dispatch manifest exists, the same typed block is
written to a separate canonical `predispatch-block-receipt-v1`; it is never
smuggled into a partially valid manifest.

That receipt has exactly `schemaVersion`, `kind`, `invocationId`, `threadId`,
`phase`, `purpose`, `requestedRoute`, `effectivePolicySha256` (nullable only
when policy resolution itself failed), `block`, `diagnosticSetSha256`, and
`createdAt`. `kind` is `kstack-kcrp-predispatch-block-receipt-v1`. Scan receipts
and runner receipts use the same exact typed `block` object for their own
terminal stages; the immutable dispatch manifest is never rewritten after
hashing.

The legal field matrix is:

| Purpose | Route | reductionFailure | omissions | Closure eligible |
|---|---|---|---|---|
| initial/clarification/readiness | full-required | null | zero | no |
| remediation | reduced | null | one or more permitted | no |
| remediation | full-fallback | required | zero | no |
| closure | full-required | null | zero | yes if fresh and all gates pass |
| closure | reduced or full-fallback | any | any | invalid; block |

No field's meaning is inferred from another. Schema validation checks all four
of `purpose`, `route`, `reductionFailure`, and `block` independently and then
checks this cross-field matrix.

## 6. Governance registry and effective policy

Reduction and full dispatch both require a canonical, fresh
`governance-registry-v1` before map evaluation. It contains exact entries:

```json
{
  "ruleId": "stable ASCII",
  "artifact": "full ArtifactBinding",
  "scope": {"projectId":"ASCII","threadId":"ASCII or *","phase":"enum or *","purpose":"enum or *"},
  "precedence": 0,
  "supersedesRuleIds": ["ruleId"]
}
```

The registry body contains no self digest. A detached
`registrySha256 = SHA256(canonical registry body bytes)` is bound by the
dispatch manifest and effective policy alongside the current configuration
digest and all full normative source bytes. Resolution is mechanical: filter exact
scope matches, order by precedence, require every superseded ID to exist at a
lower precedence, reject unresolved equal-precedence conflicts, and require the
closed mandatory classes `authority`, `review-routing`, `confidence-gate`,
`artifact-policy`, `phase-procedure`, and `owner-supersession` when applicable.

Missing, stale, malformed, or ambiguous registry/policy is terminal
`KCRP_GOVERNANCE_MISSING`, `KCRP_GOVERNANCE_STALE`, or
`KCRP_GOVERNANCE_AMBIGUOUS`. It creates a predispatch block receipt and **never
attempts full fallback**, because a full packet cannot cure unknown governing
rules.

The resolved `effectivePolicy` tuple has exactly:

```text
registrySha256, configSha256, applicableRuleIds, applicableArtifactSha256s,
phase, purpose, round, requiredReviewers, minimumConfidence,
requireZeroFailedChecks, requireZeroSecurityFindings,
requireZeroMaterialDissent, requireZeroUnresolvedQuestions,
requiredCheckIds, highRisk, providerUnavailableBehavior, authorityDigest
```

Arrays use their normative order; booleans and threshold are explicit. Its
canonical digest is `effectivePolicySha256`. The tuple and every applicable
normative artifact are included in full in the packet. The response receipt,
scan receipt, runner receipt, envelope, and gate all bind this digest. The
reducer never modifies the resolved reviewers or threshold.

## 7. Deterministic failure precedence

The first applicable row is the public primary result. A bounded diagnostic
record may contain all detected codes sorted in this same order, but cannot
change the primary result.

| Order | Condition | Result |
|---:|---|---|
| 1 | registry/config cannot be safely read, parsed, canonicalized, or schema-validated | terminal governance block; no fallback |
| 2 | mandatory governance missing, stale, conflicting, or ambiguous | terminal governance block; no fallback |
| 3 | effective policy cannot be uniquely reproduced | terminal governance block; no fallback |
| 4 | purpose/route/cross-field matrix invalid | terminal construction block |
| 5 | primary root cannot be safely read or its current identity established | terminal construction block |
| 6 | full-required source inventory cannot be built exactly | terminal construction block |
| 7 | reduced request/map/dependency/slice is missing, stale, ambiguous, entangled, or invalid | set one `reductionFailure`; attempt full fallback |
| 8 | reduced packet or exact review input exceeds a bound | `KCRP_REDUCED_TOO_LARGE`; attempt full fallback |
| 9 | full-required or full-fallback packet/input exceeds a bound | terminal `KCRP_FULL_TOO_LARGE` |
| 10 | exact input scan is not pass | terminal scan block; no provider start |
| 11 | provider unavailable, timeout, malformed process result | existing effective-policy provider outcome; never changes reviewer route |
| 12 | response receipt missing or mismatched | malformed response block |
| 13 | gate-time root/policy/Git/invocation freshness fails | stale; cannot close |
| 14 | ordinary review/gate findings or confidence failure | existing phase gate result |

Within row 7, the closed precedence is map missing, map stale, unknown requested
item, dependency missing, dependency rejected, dependency ambiguity, entangled
scope, span invalid, span overlap, closure-count overflow. The chosen code and
the canonical complete diagnostic set are bound in `reductionFailure`.

Full fallback means rebuild from complete current root artifacts and complete
phase evidence under the already resolved policy. It is allowed only for
`purpose=remediation`. Governance failure cannot become fallback, and a failed
fallback cannot recursively retry or reduce again.

## 8. Reconstructible size decision

The exact review input framing is:

```text
KSTACK-KCRP-REVIEW-INPUT-V1\n
MANIFEST-SHA256 64\n<64 uppercase ASCII hex>\n
MANIFEST <decimal byte length>\n<canonical manifest bytes>\n
PREAMBLE <decimal byte length>\n<exact neutral reviewer preamble bytes>\n
PACKET <decimal byte length>\n<exact source-record packet bytes>\n
END KSTACK-KCRP-REVIEW-INPUT-V1\n
```

Decimal lengths use shortest unsigned base-10. The detached hash line avoids a
self-hash field in the manifest. `measurements` contains exact canonical root
byte total, selected span byte total, supplemental byte total, source count,
packet byte length, and preamble byte length. `limits` contains every section 4
constant. After serialization, the scan receipt records manifest byte length,
framing byte length, and exact review-input byte length. An independent verifier
reconstructs all component and total lengths from bytes and requires equality.

The builder first constructs the complete reduced candidate. If either
`packetByteLength > 1048576` or `reviewInputByteLength > 1200000`, it discards
that candidate, records `KCRP_REDUCED_TOO_LARGE`, and attempts one complete
`full-fallback`. If the full packet or input exceeds either limit, it writes
`KCRP_FULL_TOO_LARGE` and dispatches nothing. A `full-required` request that is
oversized blocks directly. There is no truncation, summary replacement, split,
or retry with a higher limit in v1.

## 9. Legacy design digest and primary root

For `phase=design`, exactly one root artifact has `role=primary` and the
manifest contains:

```json
{
  "primaryRootRelationship": {
    "legacyField": "designDigest",
    "artifactId": "the primary design artifact ID",
    "hashDomain": "raw-file-bytes-v1",
    "rawByteLength": 1,
    "rawSha256": "64 lowercase hex",
    "canonicalSha256": "64 lowercase hex"
  }
}
```

The existing envelope `designDigest` MUST equal this `rawSha256`; current code
hashes raw file bytes, not LF-canonical bytes. The primary root path MUST equal
the design file passed to the legacy gate after safe physical-root resolution.
The canonical digest separately binds KCRP spans and source records. Reduced
mode never substitutes packet, manifest, or canonical digest for the legacy
raw full-design digest.

When KCRP is disabled, the original full prompt, v1/v2 envelope shape, and
design-gate behavior remain unchanged. QC/review phases use their existing
design, plan, and Git-state identity fields and do not mislabel one as
`designDigest`.

## 10. Typed supplemental evidence

No free-form supplemental string enters a packet. Each entry has exactly:

```json
{
  "evidenceId": "stable ASCII ID",
  "kind": "finding|prior-wording|check-definition|check-result|objective|approved-design|final-plan|diff|verification|rollback",
  "artifact": "full ArtifactBinding",
  "inclusion": "full|excerpt",
  "spans": [{"byteStart":0,"byteLength":1,"sha256":"64 lowercase hex"}],
  "relationship": {"itemIds":["sorted item ID"],"findingIds":["sorted finding ID"]}
}
```

`full` requires one span covering all canonical artifact bytes. `excerpt`
requires ordered, disjoint, bound spans. Safe-root, canonicalization, overlap,
count, and digest checks apply. Finding text and prior wording are exact spans
from bound historical artifacts, not paraphrases. Labeling evidence supplemental
cannot make mandatory full phase evidence optional.

The exact kind-to-artifact-role map is: finding/prior-wording to `decision`;
check-definition/check-result/verification to `verification`; objective to
`objective`; approved-design to `approved-design`; final-plan to `final-plan`;
diff to `diff`; and rollback to `rollback`. Any other pairing fails schema.

## 11. Non-circular response receipt

The structured model response adds exactly:

```json
{
  "kcrpResponseReceipt": {
    "schemaVersion": 1,
    "kind": "kstack-kcrp-response-receipt-v1",
    "dispatchManifestSha256": "64 lowercase hex",
    "packetSha256": "64 lowercase hex",
    "purpose": "initial|clarification|remediation|closure|readiness",
    "route": "reduced|full-required|full-fallback",
    "effectivePolicySha256": "64 lowercase hex",
    "rootArtifactSetSha256": "64 lowercase hex",
    "includedItemIds": ["sorted item ID"],
    "omittedItemIds": ["sorted item ID"]
  }
}
```

These values are visible in immutable input and can be echoed. The response
receipt MUST NOT contain review-input, scan-receipt, runner-receipt, raw-
response, or envelope digests because those would be self/forward dependencies.
The runner afterward binds the raw response to the review-input digest and
validates every echoed field. Missing, unknown, duplicated, incorrectly ordered,
or mismatched receipt data makes the response malformed.

The decision/confidence/finding schema remains separate. Receipt validity proves
input binding, not correctness, independence, identity, or gate passage.

## 12. Machine closure predicate

The pure gate predicate `closureInputEligibleV1` is true only when all are true
on the same invocation:

```text
purpose == closure
route == full-required
reductionFailure == null
block == null
requestedItemIds is empty
omittedItemIds is empty
includedItemIds equals the complete sorted current map item set
all complete root artifacts are included in full
manifest, policy, roots, map, packet, scan, response, runner receipt, checks,
  and phase-specific Git/design/plan identities reconstruct and are fresh
scan status == pass
runner outcome == complete
response receipt == exact
invocation is current and unconsumed
```

If no map exists on a legitimate full closure, included and omitted arrays are
empty, the complete full-root/source inventory proves coverage, and
`itemMapSha256` is null. If the thread registry names a current map, it is
mandatory; it cannot be omitted to hide omissions.

`full-fallback` is never eligible even with zero omissions and complete bytes.
`reduced` is never eligible. `full-required` with another purpose is never
eligible. Only after this predicate is true may existing reviewer, confidence,
finding, check, security, dissent, question, and approval gates pass.

Freshness is byte-based: immediately before gate evaluation, reread safe
physical identities and raw/canonical digests for roots, map, registry,
governance, config, checks, and phase state. Drift is stale and authorizes no
approval.

## 13. R2a deterministic acceptance matrix

Implementation is not accepted without fixtures proving:

1. every legal matrix row and every illegal purpose/route cross-product;
2. governance missing/ambiguous blocks with zero full-builder, scanner, and
   provider calls;
3. each reduction error selects one ordered primary code and one full attempt,
   with no recursive fallback;
4. oversized reduced attempts full once; oversized full blocks before provider;
5. all DAG digests reproduce and earlier-node mutation stales later bindings;
6. duplicate JSON keys and every noncanonical spelling fail;
7. per-artifact overlap fails, cross-artifact equal offsets pass, and all count
   boundaries pass at max and fail at max+1;
8. legacy raw `designDigest` remains the complete primary root digest;
9. typed supplemental evidence rejects free-form, unbound, overlapping, wrong-
   role, and paraphrased inputs;
10. response receipt rejects every field mutation and cannot echo future hashes;
11. input eligibility succeeds only for fresh closure/full-required/zero-
    omission full input, with reduced/full-fallback negative controls carrying
    otherwise identical bytes.

All blocked-path spies assert zero provider starts. Canonical fixtures bind exact
bytes and digests, not only parsed equality.

## 14. Open issues retained after R2a

1. Safe multi-packet splitting for a full review above fixed caps remains
   unresolved; v1 blocks.
2. The governance registry is specified but not authored or implemented. Until
   it resolves uniquely, KCRP dispatch is blocked.
3. Host-safe file opening/physical identity should reuse a qualified KStack
   primitive; that integration seam still needs evidence.
4. Runner, gate, and response schemas do not implement this DAG or predicate.
5. Provider usage counters and the overnight benchmark remain separate work;
   this addendum makes no reduction claim.
6. Maximums are conservative design constants, not qualified capacities. A new
   measured version may change them; v1 cannot silently tune them.

## 15. Self-review

**Self-score:** 91/100 for this R2a cluster only. This is not independent review
and cannot close or activate KCRP. R2a removes the hash cycle, makes governance
failure terminal, totalizes route/purpose/block state, defines exact canonical
parsing, and prevents fallback from becoming closure. Remaining risk is in the
unwritten governance registry, host-safe identity integration, and deliberately
unresolved oversized-full path.

**Next isolated item:** review only canonical JSON, the four-node DAG, policy
binding, failure precedence, and closure predicate. Do not combine runtime work
or benchmark economics.
