# KCRP R2b2 addendum — residual findings 7–12

**Status:** DESIGN CANDIDATE ADDENDUM — FINDINGS 7–12 RESOLVED IN DESIGN ONLY  
**Date:** 2026-08-27  
**Parent candidate SHA-256:** `879942237c11baf9275652357039bfa276d84237a81eccec56b3477465c26d96`  
**R2a SHA-256:** `b5e552904ce6a6e073436c8b84925a8f1a968468febc92bb141fd4e40732b442`  
**R2b1 SHA-256:** `7a8cc6e28197db582a6ffd5dfe82076b8f2bd2f7b85aeb2912387aabb11edff4`  
**Scope:** prior independent-review residual findings 7–12 only

## 1. Normative reach

This addendum preserves the exact parent, R2a, and R2b1 artifacts and hashes
above. It supersedes only conflicting effective-schema wording for the six
subjects below. Findings 1–6 remain resolved-in-design by R2b1; this addendum
does not reopen them. No runtime, activation, benchmark, routing, threshold, or
authority change follows from this design record.

## 2. Canonical thread-map registry and discovery evidence

KCRP uses one project-scoped canonical registry, never directory enumeration or
heuristic sidecar search:

```text
.kstack/context/thread-map-registry.kcrp.json
```

Its exact top level is `schemaVersion`, `kind`, `projectId`, `entries`, and
`canonicalizationVersion`. Its digest is detached:

```text
threadMapRegistrySha256 = SHA256(exact canonical registry body bytes)
```

Each entry has exactly:

```json
{
  "threadId": "registered thread ID",
  "state": "absent|present",
  "sidecarPath": null,
  "mapRawByteLength": null,
  "mapRawSha256": null,
  "mapCanonicalSha256": null,
  "itemIds": []
}
```

For `state=absent`, all four map path/length/digest fields are null and
`itemIds=[]`. For `state=present`, `sidecarPath` is exactly
`.kstack/context/threads/<threadId>/item-map.kcrp.json`, length is a positive
safe integer, both digests are lowercase SHA-256, and `itemIds` is the complete
nonempty sorted unique item-ID projection registered from those exact map
bytes. No other path is accepted.

Registry entries sort by ASCII thread ID and contain each thread once. The
registry is mandatory governance-bound input. Missing, malformed, stale,
duplicate, or unregistered current thread is terminal governance block before
map/full builders.

Every attempt writes a canonical `mapDiscoveryReceipt` with exactly:

```text
schemaVersion, kind, invocationId, threadMapRegistrySha256, threadId,
registeredState, sidecarPath, parentDirectoryIdentity,
observedState, observedFileIdentity, observedRawByteLength,
observedRawSha256, observedCanonicalSha256, observedErrorCode, completedAt
```

Safe discovery resolves the registered fixed path beneath the physical project
root without following links. `present` requires an ordinary non-linked file,
stable descriptor identity, exact registered length/digests, and a second
identity check after read. `absent` requires the registered parent directory's
stable identity and an exact no-follow missing-entry result for that one name.
Permission error, wrong type, link, replacement, digest drift, unknown host
identity, or state mismatch is terminal `KCRP_MAP_DISCOVERY_INVALID`; it never
silently changes present to absent or selects another path.

Receipt nullability is exact. Registered/observed present uses the fixed path,
non-null parent/file identities, length and both digests, with error null.
Registered/observed absent records the derived fixed path and non-null parent
identity, with file identity, length, both digests null and
`observedErrorCode="ENOENT"`. Cross-state or any other null combination fails.

The discovery receipt, registry digest, and selected entry are bound into the
dispatch manifest, scan receipt, runner receipt, response receipt, and gate.
Presence makes the map mandatory; registered absence permits
`itemMapSha256=null` and empty item arrays only on complete full routes.

## 3. Phase-tagged primary-root relationship

Bare null is forbidden. `primaryRootRelationship` is one of these exact tagged
variants.

### Design: explicit legacy relationship only

```json
{
  "phase": "design",
  "variant": "design-legacy-explicit",
  "relationship": {
    "legacyField": "designDigest",
    "artifactId": "primary artifact ID",
    "hashDomain": "raw-file-bytes-v1",
    "rawByteLength": 1,
    "rawSha256": "64 lowercase hex",
    "canonicalSha256": "64 lowercase hex"
  }
}
```

Exactly one design root has role `primary`; its safe physical path is the design
file passed to the legacy gate, and existing envelope `designDigest` equals the
raw SHA-256. Design never permits a null/none variant.

### QC: explicit or canonical none

```json
{"phase":"qc","variant":"none","relationship":null}
```

is legal only when `effectivePolicy.phasePrimaryRootMode="none"` and the phase
defines no legacy single-root field. It does not remove required complete design,
plan, change-set, or Git-state bindings from `rootArtifacts`.

The explicit QC variant is:

```json
{
  "phase": "qc",
  "variant": "qc-explicit",
  "relationship": {
    "approvedDesignArtifactId": "ID",
    "finalPlanArtifactId": "ID",
    "changeSetArtifactId": "ID",
    "approvedDesignDigest": "sha256",
    "finalPlanDigest": "sha256",
    "gitStateDigest": "sha256"
  }
}
```

It is mandatory when policy mode is `explicit`.

### Full review: explicit or canonical none

```json
{"phase":"review","variant":"none","relationship":null}
```

is legal only for policy mode `none`; objective/environment/repository roots
remain fully bound. Explicit review is:

```json
{
  "phase": "review",
  "variant": "review-explicit",
  "relationship": {
    "objectiveArtifactId": "ID",
    "environmentArtifactId": "ID",
    "repositoryArtifactId": "ID",
    "objectiveDigest": "sha256",
    "environmentDigest": "sha256",
    "repositoryDigest": "sha256"
  }
}
```

The object phase must equal dispatch phase; variant and policy mode must match;
all explicit artifact IDs resolve uniquely against `rootArtifacts`; all digests
reproduce. Unknown fields or cross-phase variants fail construction.

## 4. User-requested full review is legal and non-closing

The purpose enum adds `user-full`. Its only legal state is:

```text
purpose=user-full
route=full-required
reductionFailure=null
block=null before scan
requestedItemIds=[]
omittedItemIds=[]
includedItemIds=complete current sorted item set when map present, otherwise []
complete full root/source inventory
```

It is permitted in design, QC, or review after an explicit user request and is
otherwise identical in evidence completeness to a full closure input. It is
never closure-eligible, never produces `READY_FOR_USER_APPROVAL`, `QC_PASSED`,
`READY`, or `READY_WITH_RISKS`, and never consumes a closure invocation. Its
findings may seed later remediation. A later closure requires a new fresh
`purpose=closure`, `route=full-required` invocation under the existing machine
closure predicate.

## 5. Total limit transition table

All comparisons use safe integers and accept equality at the limit. Bounded
readers consume at most `limit+1` bytes to classify overflow. The complete v1
transition table is:

| Limit domain | Exact maximum | Reduced remediation | Full-required | Full-fallback |
|---|---:|---|---|---|
| canonical thread-map registry bytes / entries | 4,194,304 / 4,096 | terminal governance block; never fallback | same | same before fallback begins |
| canonical finding registry bytes / entries | 4,194,304 / 4,096 | terminal construction block; never fallback | same | same |
| canonical item-map bytes | 4,194,304 | `KCRP_MAP_TOO_LARGE`; attempt full once | terminal `KCRP_MAP_TOO_LARGE` when registered present | original map failure is preserved; map internals are not reparsed |
| bound artifacts in item map | 256 | `KCRP_ARTIFACT_COUNT_LIMIT`; attempt full | terminal when current map is mandatory | bypass failed map; full root inventory has its own 256 limit |
| item count | 4,096 | `KCRP_ITEM_COUNT_LIMIT`; attempt full | terminal when current map is mandatory | bind registered item-ID projection; do not parse failed map |
| spans per item / total spans | 64 / 16,384 | `KCRP_SPAN_COUNT_LIMIT`; attempt full | terminal when current map is mandatory | preserve original failure; do not parse failed map |
| dependencies per item | 256 | `KCRP_DEPENDENCY_COUNT_LIMIT`; attempt full | terminal when current map is mandatory | preserve original failure; do not parse failed map |
| requested / included items | 256 / 4,096 | `KCRP_CLOSURE_COUNT_LIMIT`; attempt full | terminal if nonempty/over limit; full states require empty request | full fallback uses empty included/omitted arrays and complete roots |
| complete full root artifacts | 256 | applies only during fallback build | terminal `KCRP_FULL_ARTIFACT_COUNT_LIMIT` | terminal and preserve reduction failure |
| governance entries | 128 | terminal governance block; never fallback | same | same before fallback begins |
| supplemental evidence entries | 256 | terminal construction block; full cannot cure | terminal | terminal and preserve reduction failure |
| canonical dispatch-manifest bytes | 4,194,304 | `KCRP_REDUCED_MANIFEST_TOO_LARGE`; attempt full | terminal `KCRP_FULL_MANIFEST_TOO_LARGE` | terminal and preserve reduction failure |
| packet source-record count | 32,768 | `KCRP_REDUCED_SOURCE_COUNT_LIMIT`; attempt full | terminal `KCRP_FULL_SOURCE_COUNT_LIMIT` | terminal and preserve reduction failure |
| one canonical source record | 1,048,576 | `KCRP_REDUCED_SOURCE_RECORD_TOO_LARGE`; attempt full | terminal `KCRP_FULL_SOURCE_RECORD_TOO_LARGE` | terminal and preserve reduction failure |
| complete packet bytes | 1,048,576 | `KCRP_REDUCED_TOO_LARGE`; attempt full | terminal `KCRP_FULL_TOO_LARGE` | terminal and preserve reduction failure |
| exact review-input bytes | 1,200,000 | `KCRP_REDUCED_TOO_LARGE`; attempt full | terminal `KCRP_FULL_TOO_LARGE` | terminal and preserve reduction failure |

For a full fallback caused by a map byte/schema/count failure, the manifest
binds `mapDiscoveryReceipt`, thread-registry entry/digest, registered item-ID
projection, and original `reductionFailure`, but sets
`itemMapSha256=null`, `includedItemIds=[]`, and `omittedItemIds=[]`. This is safe
only because the route carries every complete full root and is machine non-
closing. Any later closure with registered `state=present` must repair, parse,
and bind the current map.

At most one reduced-to-full transition occurs. A terminal full limit writes the
R2b1 predispatch block receipt with the original reduction failure unchanged.
No limit can be raised from input, configuration drift, reviewer output, or a
retry within the same schema version.

## 6. Frozen provider request and runner identity

`effectivePolicy` adds `reviewerAssignments`, one entry per
`requiredReviewers`, in exactly the same positional order:

```json
{
  "reviewerId": "codex|opus|fable",
  "providerId": "openai-codex|anthropic-claude|fable-agent",
  "resolvedModelId": "nonempty exact configured model string",
  "commandConfigurationSha256": "sha256",
  "reasoningConfigurationSha256": "sha256",
  "timeoutMs": 1
}
```

`requiredReviewers` and assignments have identical length and reviewer IDs,
with no duplicates. The effective-policy digest covers every assignment. Model
identity here means the exact resolved request/configuration identity, not
cryptographic proof of a provider's hidden backend.

KCRP builds one provider-specific dispatch manifest from the shared immutable
packet per assignment. It adds exact `providerRequest`:

```json
{
  "providerRequestId": "lowercase UUID v4",
  "requestOrdinal": 0,
  "reviewerId": "enum",
  "providerId": "enum",
  "resolvedModelId": "exact string",
  "commandConfigurationSha256": "sha256",
  "reasoningConfigurationSha256": "sha256",
  "timeoutMs": 1
}
```

Every field except request ID and ordinal equals the positional effective-policy
assignment byte-for-byte. Ordinal is its zero-based array index. Request IDs are
unique across the invocation. All required reviewers receive identical packet,
root, governance, and policy bytes; only the provider-request binding and its
derived manifest/input hashes differ.

The frozen runner enums are:

```text
outcome = complete|start-failed|unavailable|timeout|signaled|nonzero-exit|malformed-response
responseReceiptStatus = valid|not-produced|missing|malformed|mismatch
signal = null|SIGHUP|SIGINT|SIGQUIT|SIGILL|SIGTRAP|SIGABRT|SIGBUS|SIGFPE|
         SIGKILL|SIGUSR1|SIGSEGV|SIGUSR2|SIGPIPE|SIGTERM|SIGBREAK|KSTACK_TIMEOUT
```

The R2b1 runner receipt adds `providerRequestId`, `requestOrdinal`,
`reviewerId`, `providerId`, and `resolvedModelId`; these reproduce the dispatch
request and effective assignment. The response receipt adds the first four plus
`resolvedModelId` and must echo them exactly.

The cross-field matrix is total:

| outcome | raw response digest | receipt status | exit code | signal | block |
|---|---|---|---|---|---|
| complete | SHA-256 of nonempty valid structured response | valid | 0 | null | null |
| start-failed | null | not-produced | null | null | provider/start-failed |
| unavailable | null | not-produced | null | null | provider/unavailable |
| timeout | SHA-256 of all captured bytes | not-produced | null | `KSTACK_TIMEOUT` | provider/timeout |
| signaled | SHA-256 of all captured bytes | not-produced | null | one non-null OS signal enum | provider/signaled |
| nonzero-exit | SHA-256 of all captured bytes | not-produced | 1..255 | null | provider/nonzero-exit |
| malformed-response | SHA-256 | missing, malformed, or mismatch | 0 | null | response/matching code |

No other null/value combination is accepted. Provider-unavailable behavior is
read from the already bound effective policy and controls workflow handling
only; it never changes reviewer/model identity or silently creates a substitute
request.

## 7. Supplemental-evidence cardinality and registry resolution

Every thread has a fixed safely discovered canonical finding registry:

```text
.kstack/context/threads/<threadId>/finding-registry.kcrp.json
```

It is created as an empty registry before initial KCRP review and thereafter is
mandatory. Its exact top level is `schemaVersion`, `kind`, `threadId`, `entries`,
and `canonicalizationVersion`; detached SHA-256 binds it. Entries sort by finding
ID and have exactly:

```json
{
  "findingId": "ID",
  "status": "unresolved|resolved|superseded",
  "sourceArtifact": "ArtifactBinding",
  "spans": [{"byteStart":0,"byteLength":1,"sha256":"sha256"}],
  "discoveredInvocationId": "UUID",
  "appliesToItemIds": ["sorted item ID"]
}
```

Every finding span is exact source text from the bound review artifact. Every
`appliesToItemIds` value resolves against the selected thread-map-registry entry.
Unknown, duplicate, stale, unsafe, or ambiguous finding registry blocks before
dispatch. Its digest and complete relevant entries bind the manifest, response,
scan, runner, and gate.

Supplemental cardinality is:

| purpose | total supplemental entries | entries with `kind=finding` |
|---|---:|---:|
| remediation, either reduced or full-fallback | 1..256 | 1..256 |
| initial, clarification, closure, readiness, user-full | 0..256 | 0..256 |

For remediation, each requested item ID must be named by at least one included
unresolved finding entry, and each finding supplemental record must carry one or
more finding IDs and one or more item IDs. Every referenced unresolved finding
appears in exactly one `kind=finding` supplemental entry. Resolved/superseded
findings may appear only as typed historical counter-evidence, never as the sole
remediation cause.

Every item ID anywhere in requested/included/omitted arrays, closure proof,
dependency lists, mechanism groups, entanglement diagnostics, supplemental
relationships, or finding-registry `appliesToItemIds` MUST resolve uniquely in
the selected thread-map-registry entry's complete `itemIds`. When a valid current
map is required, it must also resolve there. A full fallback after a map
parse/count failure may use the already bound registry projection, as specified
in section 5, but remains non-closing.

Every finding ID anywhere in supplemental relationships or diagnostics MUST
resolve uniquely in the bound finding registry. Empty IDs, unknown IDs, wrong-
thread IDs, duplicate references, status misuse, or registry/map disagreement
is terminal construction block; it never drops the reference or substitutes
free-form text.

This resolution rule governs IDs supplied as review input. A reviewer may
discover a new output finding ID; it must satisfy the response schema and be
unique within that response, but cannot be referenced by the current input.
Only after synthesis may a separately authorized, canonical registry update
bind its exact response span and make it eligible for a later remediation.

R2b2 explicitly extends the R2b1 array-order table: thread-map-registry entries
sort by thread ID and each `itemIds` by item ID; finding-registry entries sort by
finding ID, their spans use the existing artifact/start/length/digest order, and
`appliesToItemIds` sorts by item ID; `reviewerAssignments` is positional one-to-
one with `requiredReviewers`. Duplicate members fail. No other new array is
introduced.

## 8. Acceptance evidence for findings 7–12

The isolated R2b2 fixture plan proves:

1. present and absent map registry entries at fixed paths, with missing, linked,
   replaced, wrong-type, permission-error, digest-drift, and registry-state-
   mismatch negatives;
2. every legal design/QC/review primary-root tag and all cross-phase, bare-null,
   wrong-policy-mode, unresolved-artifact, and digest-mismatch negatives;
3. `user-full/full-required` executes a complete review but every closure/status
   gate remains false until a separate closure invocation;
4. equality-at-limit and limit+1 for every section 5 row, including reduced-to-
   full single transition and original-failure preservation;
5. every runner enum/matrix row, provider-request uniqueness/ordinal, effective-
   assignment mismatch, reviewer substitution, model/config drift, and illegal
   null/value combination;
6. supplemental minima at 0/1/256/257 and complete item/finding resolution,
   including stale, duplicate, wrong-status, wrong-thread, and absent-registry
   cases; and
7. exact SHA mutation of either registry stales dispatch, response, scan,
   runner, and gate bindings.

All failure fixtures assert exact terminal code and zero unauthorized provider
starts. Canonical fixtures bind bytes, not parsed-object equality alone.

## 9. Open issues retained after R2b2

1. The registries, safe discovery receipts, phase union, provider-request
   binding, and finding resolution are designs only and have no runtime.
2. Safe full-input splitting above v1 bounds remains unresolved and blocks.
3. Provider-reported usage collection and the overnight A/B benchmark remain
   separate; no savings claim exists.
4. The resolved-model identity is request/configuration identity, not remote
   model attestation.

## 10. Self-review

**Self-score:** 95/100 for residual findings 7–12 only. This is not independent
review and cannot close or activate KCRP. Remaining risk is implementation
conformance of safe registry discovery and the deliberately bounded identity
claim; runtime and benchmark work remain outside this addendum.
