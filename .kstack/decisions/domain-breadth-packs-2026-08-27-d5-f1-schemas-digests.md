# Domain breadth D5-F1 - closed schemas and digest contracts

**Parent item:** D5 closed schemas, fixture digest, and atomic activation  
**Scope:** only closed schema registry, canonical encoding, file-set digests,
and cross-artifact digest checks. D5-F2 separately owns activation atomicity.  
**Route:** Codex-only, supplied-packet-only review; no Opus

## Normative representation

Every v1 artifact is UTF-8 canonical JSON with no BOM, trailing bytes, comments,
duplicate keys, non-integer numbers, negative zero, non-finite values, or lone
surrogates. Strings are NFC and control characters are rejected except HT/LF/CR
where a named field explicitly permits their scalar values. Arrays preserve
schema-defined order; integers are `0..9007199254740991`. A parser must
re-encode and require byte equality before digesting. All object schemas set
`additionalProperties: false`; all unions are
tagged and have exactly one matching branch. All strings, arrays, and objects
have explicit maxima. A 256-bit SHA-256 digest is encoded as exactly 64
lowercase hex characters but compared as 32 decoded bytes.

No runtime `$ref`, remote URI, format plug-in, default, coercion, transform,
custom code, regex with implementation-dependent semantics, or schema-selected
validator is allowed. The KStack release ships a closed compiled validator set.
Its build proves each canonical schema document and compiled validator against
the same positive/negative vectors.

`canonicalV1` recursively emits: `null`, `true`, or `false` as those ASCII
literals; integers as shortest unsigned base-10 with zero encoded `0`; arrays
as `[` then comma-separated encoded values then `]`; and objects as `{` then
comma-separated encoded key, colon, encoded value pairs then `}`. Object keys
are NFC strings sorted by unsigned lexicographic order of their UTF-8 bytes at
every nesting depth. String encoding emits U+0022 delimiters; U+0022 as `\"`,
U+005C as `\\`, U+0008/0009/000A/000C/000D as `\b`, `\t`, `\n`, `\f`, `\r`;
other U+0000..U+001F as `\u00xx` with lowercase hex; and every other Unicode
scalar as its shortest UTF-8 bytes, including `/`, U+2028, and U+2029. No
optional whitespace appears. Invalid UTF-8, non-NFC strings, non-scalars, and
unpermitted control scalars reject before encoding.

## Schema registry

`PackSchemaRegistryV1` has exactly:

```text
{
  artifactType: "kstack-pack-schema-registry", schemaVersion: 1,
  contractVersion: 1, canonicalizerVersion: 1,
  hashAlgorithm: "sha256", contractPolicyDigest,
  schemas: [{ artifactType, schemaVersion: 1, domainPrefix,
              schemaPath, schemaDigest, vectorRoot, fixtureSetDigest,
              validatorIdentityDigest }]
}
```

The `schemas` array is ordered by ASCII `artifactType`, contains each required
type exactly once, and permits only this closed v1 set:

```text
kstack-pack-manifest
kstack-pack-content
kstack-pack-evidence-schema
kstack-pack-bundle-index
kstack-pack-contract-policy
kstack-validator-identity
kstack-pack-compatibility-entry
kstack-pack-source-provenance
kstack-pack-review-assertion
kstack-pack-approval-assertion
kstack-pack-snapshot
kstack-operation-inventory
kstack-pack-selection
kstack-owner-action-request
kstack-owner-action-attestation
kstack-weakening-request
kstack-weakening-authorization
kstack-pack-composition-receipt
kstack-pack-dispatch-receipt
kstack-pack-analysis-result
kstack-workflow-evidence-descriptor
kstack-workflow-evidence-attestation
kstack-validation-decision
kstack-result-validation-receipt
kstack-pack-activation-request
kstack-pack-activation-receipt
kstack-pack-quarantine-record
kstack-pack-tombstone
```

Adding/removing/renaming a type or field, widening an enum/bound, or changing
canonicalization requires `contractVersion: 2` and a separately reviewed
registry. It cannot mutate v1. Registry digest is
`SHA256(UTF8("KSTACK-PACK-SCHEMA-REGISTRY-V1\n") || canonicalV1(registry))`.

`domainPrefix` is the literal ASCII string
`"KSTACK-" || ASCII_UPPER_HYPHEN(artifactType without "kstack-") || "-V1\n"`.
It is an explicit registry-entry field, ends in one LF, and must equal that
derivation. Prefix collision rejects. No artifact contains its own digest.

Each `schemaPath` is exactly `schemas/<artifactType>.schema.json`; schema bytes
must equal canonicalV1(parsed schema), and `schemaDigest` is
`SHA256(UTF8("KSTACK-PACK-SCHEMA-DOCUMENT-V1\n") || schemaBytes)`.
`vectorRoot` is exactly `vectors/<artifactType>` and `fixtureSetDigest` uses the
file-set algorithm below with domain `KSTACK-PACK-SCHEMA-VECTORS-V1` and paths
relative to that root. Only `positive/*.json`, `negative/*.json`, and closed
`expected.json` are admitted. Expected data binds path, raw input digest,
accept/reject result, and accepted canonical bytes/digest where applicable.
For every accepted vector, `acceptedArtifactDigest` is normatively
`SHA256(UTF8(the exact registry entry domainPrefix) || acceptedCanonicalBytes)`.
The compiled validator must return or verify that exact 32-byte value in
addition to acceptance and canonical bytes; any other prefix, raw input bytes,
or digest domain fails the vector.

`validatorIdentityDigest` identifies canonical `ValidatorIdentityV1` with
exact fields `artifactType`, `schemaVersion`, `contractVersion`,
`canonicalizerVersion`, `schemaDigest`, `contractPolicyDigest`, `sourceRoot`,
`sourceFileSetDigest`, `dependencyLockPath`, `dependencyLockDigest`,
`buildRecipePath`, `buildRecipeDigest`, `targetPlatform`, and
`executableArtifactDigest`. All paths obey the same closed relative-path rules.
`sourceFileSetDigest` is `fileSetDigest("KSTACK-VALIDATOR-SOURCE-V1", files
below sourceRoot)`; lock and recipe digests are respectively SHA256 of literal
prefix `KSTACK-VALIDATOR-DEPENDENCY-LOCK-V1\n` or
`KSTACK-VALIDATOR-BUILD-RECIPE-V1\n` followed by exact bytes. Executable digest is
`SHA256(UTF8("KSTACK-VALIDATOR-EXECUTABLE-V1\n") || exact artifact bytes)`.
Identity digest uses `KSTACK-VALIDATOR-IDENTITY-V1\n`. Compatibility selects
one exact identity per target platform; no source/binary/build interpretation
is left to a consumer.

`contractPolicyDigest` identifies canonical `PackContractPolicyV1`, whose exact
fields are `artifactType`, `schemaVersion`, `packIds`, `coverageValues`,
`appliesToValues`, `answerKinds`, `sourceClasses`, `observationKinds`,
`freshnessPolicyIds`, and `limits`. Arrays equal these ASCII-lexical values:

```text
packIds = [assurance, product-experience, release-operations,
           research-knowledge]
coverageValues = [accessibility, citation, compliance, control-evidence,
  decision-record, developer-experience, documentation, health-evidence,
  incident-record, privacy, product-premise, release-ledger,
  release-readiness, resilience, rollback-evidence, security,
  source-quality, synthesis, user-journey]
appliesToValues = [design, implementation-plan, incident, objective, qc,
                   release-observation, release-plan]
answerKinds = [list-evidence, status-evidence, yes-no-evidence]
sourceClasses = [github-record, health-observation, human-attestation,
  jira-record, qualified-citation, repository-artifact, rollback-receipt,
  workflow-receipt]
observationKinds = [absence, asserts, refutes, unavailable]
freshnessPolicyIds = [release-immediate, release-window,
                      repository-snapshot, timeless-digest]
```

`limits` has exact integer fields: `maxPackBytes=16384`,
`maxCombinedPackBytes=32768`, `maxSections=64`, `maxQuestionsPerSection=64`,
`maxEvidencePerQuestion=32`, `maxRequirements=2048`, `maxStringUtf8Bytes=4096`,
`maxArrayItems=2048`, `maxObjectProperties=64`, `maxFixtureFiles=4096`,
`maxFixtureFileBytes=1048576`, and `maxBundleBytes=8388608`. D6 may impose a
smaller prompt/runtime budget but cannot widen these contract maxima.
Policy digest uses `KSTACK-PACK-CONTRACT-POLICY-V1\n`. Every schema,
validator identity, compatibility entry, and snapshot restates this exact
digest; there is no ambient enum or cap.

## Closed pack schemas

`PackManifestV1` has exactly: `artifactType`, `schemaVersion`, `id`, `version`,
`title`, `purpose`, `coverage`, `contentDigest`, `evidenceSchemaDigest`,
`fixturesDigest`, and `maxUtf8Bytes`. `id` is one of exactly
`release-operations`, `product-experience`, `assurance`, or
`research-knowledge`; version is canonical SemVer without build metadata;
coverage is a nonempty duplicate-free ASCII-ordered subset of the exact
contract-policy coverage array;
`maxUtf8Bytes` is `1..16384` and advisory only. Actual rendered bytes are
measured and independently policy-capped. No tool, authority, permission,
command, hook, endpoint, credential, provider, model, trigger, dependency,
priority, executable, network, or extension field exists.

`PackContentV1` has exactly `artifactType`, `schemaVersion`, `sections`.
Sections contain exactly `id`, `appliesTo`, `questions`; questions contain
exactly `id`, `text`, `answerKind`, `evidenceIds`. IDs use lowercase ASCII
`[a-z][a-z0-9-]{0,63}` and are unique in their namespaces. `appliesTo`,
`answerKind` use the exact contract-policy arrays. Evidence IDs are pack-local:
their complete allowed inventory is exactly the evidence-schema requirements
in file order, and every question reference resolves into it. Counts and UTF-8
lengths use the exact contract-policy limits. There is no generic
instruction, output path, role, workflow state, precedence, dependency, or
authority field.

`PackEvidenceSchemaV1` is not arbitrary JSON Schema. It has exactly
`artifactType`, `schemaVersion`, and ordered `requirements`. Each requirement
has exactly `evidenceId`, `allowedSourceClasses`, `allowedObservationKinds`,
`minimumCount`, `maximumCount`, `freshnessPolicyId`, and `requiredFor`.
All enums equal the exact contract-policy arrays; counts are `0..32` with minimum
not above maximum; `requiredFor` is a nonempty subset of `supported`,
`contradicted`. Every content evidence ID resolves exactly once and unreferenced
requirements reject. It cannot name a producer, locator, tool, endpoint,
validator, code, reference, default, transform, claim, pass, waiver, or action.

`BundleIndexV1` has exactly `artifactType`, `schemaVersion`, `packId`,
`version`, `manifestDigest`, `contentDigest`, `evidenceSchemaDigest`,
`fixturesDigest`, `orderedFiles`, and `bundleDigestAlgorithm`. `orderedFiles`
contains entries with exactly `relativePath`, `byteLength`, and
`contentSha256`. Path is the admitted bundle-root-relative ASCII path,
`byteLength` is `0..maxFixtureFileBytes` (with component-specific lower caps),
and `contentSha256` is SHA256 of exact raw bytes without a prefix. Entries are
sorted by unsigned UTF-8 path bytes and exactly equal, field-for-field and
count-for-count, the paths/lengths/raw hashes used to form bundle file-set
entries. `bundleDigestAlgorithm` is exactly `kstack-pack-file-set-v1`.
`BundleIndexV1` digest uses `KSTACK-PACK-BUNDLE-INDEX-V1\n`; its own bytes are
not in `orderedFiles` or the bundle digest, avoiding recursion.

## Snapshot and lifecycle schemas

`PackSnapshotV1` has exactly `artifactType`, `schemaVersion`,
`contractVersion`, `generation`, `predecessorSnapshotDigest`,
`schemaRegistryDigest`, `contractPolicyDigest`, `catalogEntries`, and
`compatibilityEntries`.
Generation is monotone and F2 validates the transition. `catalogEntries`
contains exactly four entries in `contractPolicy.packIds` order. Each is a tagged union:

- `roadmap-only`: exactly `packId`, `state`; no version/material digest;
- `available`: exactly `packId`, `state`, `version`, `bundleDigest`,
  `manifestDigest`, `contentDigest`, `evidenceSchemaDigest`, `fixturesDigest`,
  `bundleIndexDigest`, `sourceProvenanceDigest`, `reviewArtifactDigest`, and
  `approvalArtifactDigest`, `compatibilityEntryDigest`;
- `quarantined`: available fields plus `quarantineRecordDigest`; never
  resolvable for new selection.

`compatibilityEntries` has exactly one `CompatibilityEntryV1` for every
available/quarantined bundle and no others, sorted by decoded bundle digest.
Each has exactly `artifactType`, `schemaVersion`, `packId`, `version`,
`bundleDigest`, `manifestDigest`, `contentDigest`, `evidenceSchemaDigest`,
`fixturesDigest`, `bundleIndexDigest`, `packContractVersion`,
`schemaRegistryDigest`, `contractPolicyDigest`,
`composerImplementationDigest`, `validatorIdentityDigests` (one per supported
target, sorted by target), `kernelSchemaDigest`, `baseLaneContractDigest`, and
`status`. Its digest is `SHA256(UTF8("KSTACK-PACK-COMPATIBILITY-ENTRY-V1\n") ||
canonicalV1(entry))`. The available/quarantined catalog entry's
`compatibilityEntryDigest` must equal it, and all duplicated material fields
must compare bytewise. Status is `compatible` or `incompatible`; only
compatible material may be available. Compatibility is KStack-authored, never
bundle-declared.

The four-ID enum is immutable contract v1. A fifth ID requires contract v2,
new schemas, registry/compatibility review, and migration design; it cannot
appear as an unknown v1 ID or mutate the v1 enum.

D1/D2/D3/D4/D10 retain their separately reviewed exact fields and prefixes.
D5 requires their exact schema digests and adds no alternate authority path.
Remaining lifecycle objects are closed:

- `PackSourceProvenanceV1`: project/repository, pack ID/version, acquisition
  policy digest, immutable source repository/commit/path/file digests, license
  ID/notice digest, transformation-receipt digest, and produced bundle/component
  digests. It contains no runtime source or mutable URL.
- `PackReviewAssertionV1` and `PackApprovalAssertionV1`: artifact/schema type,
  project/repository, pack ID/version, bundle/manifest/content/evidence-schema/
  fixture/bundle-index/source-provenance/schema-registry/contract-policy/
  compatibility-entry/composer/kernel/base-lane digests plus the exact ordered
  `validatorIdentityDigests` array,
  decision enum, reviewer or D1 approval-attestation digest, issued time, and
  expiry. `decision` must be `approve`; review is non-authoritative and approval
  must bind the external D1 attestation. Each digest uses its named artifact
  prefix and neither permits a partial tuple.

- `PackActivationRequestV1`: project/repository IDs, old/new snapshot digests
  and generations, transition kind, changed pack IDs, registry digest,
  compatibility-review digest, D1 activation-attestation digest, optional D3
  weakening-authorization digest, nonce, not-before, expiry. No mutable ref.
- `PackActivationReceiptV1`: request and old/new snapshot/generation digests,
  identity/weakening authorization digests, transaction ID, committed time,
  and prior/current pointer-record digests.
- `PackQuarantineRecordV1`: project/repository, exact snapshot/bundle/pack,
  reason enum, evidence digests, external D1 action-attestation digest,
  quarantine time, expiry-or-null, nonce. It selects no replacement.
- `PackTombstoneV1`: project/repository, pack/version/bundle/component digests,
  last snapshot, disposition, retained-safe-metadata digest, removal
  authorization, removal time, reason. It has no alternate content location.

## Exact file digests

JSON component digests hash canonical raw file bytes with a literal domain
prefix. Any byte change changes `contentDigest`, `evidenceSchemaDigest`, or
`manifestDigest`; a semantically similar alternate encoding is rejected.

Fixture/bundle paths are relative POSIX ASCII paths. Components match
`[a-z0-9][a-z0-9._-]{0,63}`, with at most 8 components and 240 path bytes.
Empty, dot, dot-dot, absolute, backslash, colon, NUL, alternate separator,
non-ASCII, case collision, duplicate, reserved device name, trailing dot/space,
and unexpected paths reject. Descriptor-relative traversal accepts only regular
files with link count one. Symlinks, hard links, junctions, reparse points,
devices, sockets, FIFOs, directory substitution, and descriptor identity change
reject. Size/count limits apply before allocation.

For each already-opened file:

```text
entry = U32BE(pathUtf8.length) || pathUtf8 ||
        U64BE(content.length) || SHA256(content)
```

Sort by unsigned lexicographic `pathUtf8`; duplicate bytes reject. Then:

```text
fileSetDigest(domain, entries) =
  SHA256(UTF8(domain + "\n") || U32BE(entryCount) || entry[0] || ...)
fixturesDigest = fileSetDigest("KSTACK-PACK-FIXTURES-V1", fixtures files)
bundleDigest   = fileSetDigest("KSTACK-PACK-BUNDLE-V1",
                               manifest.json, content.json,
                               evidence.schema.json, fixtures/**)
```

Fixture paths are relative to `fixtures/`; bundle paths are relative to bundle
root and retain the `fixtures/` prefix. Bundle index bytes are excluded to avoid
recursion. A bundle has exactly the three named JSON files plus at least one
fixture; manifest component/fixture digests must recompute before acceptance.

## Cross-digest validation graph

Every node resolves from closed `OperationInventoryV1` with exact fields
`artifactType`, `schemaVersion`, `operationId`, and `entries`. Each entry has
exactly `role`, `artifactType`, `artifactDigest`, and `byteLength`. Roles use a
closed call-site schema, are unique and ASCII-sorted, and each required role
appears once. Each `(artifactType, artifactDigest)` appears once; the same
decoded digest under another artifact type is rejected as an alias. Inventory
bytes exclude themselves and digest with `KSTACK-OPERATION-INVENTORY-V1\n`.
Resolution requires role, type, length, recomputed domain-separated digest, and
closed schema all to match before bytes are returned. Unlisted bytes are
invisible. Every operation receipt binds the inventory digest.

The graph is:

```text
schema files + vectors -> schema registry
components + fixtures -> manifest + bundle index -> bundle digest
bundle + registry + implementation/kernel/base contracts
  + exact review/approval assertions -> compatibility entry
catalog + compatibility entries + registry -> snapshot
snapshot + policy + exact material/review/approval graph -> selection
selection + material + compatibility -> composition -> dispatch
dispatch + result + workflow evidence/attestations -> validation receipt
snapshot transition + D1/D3 authorization -> activation receipt
```

An available entry is valid only when all component/index digests recompute;
manifest restatements equal the entry; exactly one compatibility entry matches
its bundle and every contract/schema/implementation digest; status is
compatible; provenance is v1-qualified; and exact review/approval artifacts
explicitly assert pack ID/version plus bundle, manifest, content,
evidence-schema, fixture, bundle-index, registry, compatibility-entry,
composer, validator, kernel, and base-lane digests. Partial/unrelated/mutable-ref
approval cannot validate an entry.

The exact available-entry equalities are:

```text
entry.packId/version                 = manifest.id/version
entry.manifestDigest                 = digest(manifest bytes)
entry.contentDigest                  = manifest.contentDigest
                                      = digest(content bytes)
entry.evidenceSchemaDigest           = manifest.evidenceSchemaDigest
                                      = digest(evidence schema bytes)
entry.fixturesDigest                 = manifest.fixturesDigest
                                      = recomputed fixture file-set digest
entry.bundleIndexDigest              = digest(bundle index bytes)
entry.bundleDigest                   = recomputed bundle file-set digest
entry.compatibilityEntryDigest       = digest(compatibility entry bytes)
bundleIndex.packId/version           = manifest.id/version
                                      = entry.packId/version
bundleIndex.manifestDigest           = entry.manifestDigest
                                      = digest(manifest bytes)
bundleIndex.contentDigest            = entry.contentDigest
                                      = manifest.contentDigest
                                      = digest(content bytes)
bundleIndex.evidenceSchemaDigest     = entry.evidenceSchemaDigest
                                      = manifest.evidenceSchemaDigest
                                      = digest(evidence schema bytes)
bundleIndex.fixturesDigest           = entry.fixturesDigest
                                      = manifest.fixturesDigest
                                      = recomputed fixture file-set digest
bundleIndex.orderedFiles             = exact path/length/raw-hash entries used
                                      by recomputed bundle file-set digest
compatibility material fields        = all corresponding entry fields
compatibility.schemaRegistryDigest   = digest(exact registry bytes)
compatibility.contractPolicyDigest   = registry.contractPolicyDigest
snapshot registry/policy digests     = those same exact digests
review and approval asserted digests = every value above plus provenance,
                                      composer/validators/kernel/base-lane
```

Review/approval assertion schemas include that complete fixed tuple and the
compatibility-entry digest. No narrative reference or partial tuple counts.

Snapshot digest is `SHA256(UTF8("KSTACK-PACK-SNAPSHOT-V1\n") ||
canonicalV1(snapshot))`. Consumers never resolve latest, ID, version, path, or
separate compatibility state after snapshot verification. Missing/extra nodes,
type confusion, digest cycles/inconsistency, incompatible entries, unknown or
duplicate fields, and unsupported versions fail closed.

## Deterministic verification

- Publish canonical bytes/final-digest vectors for every registered artifact
  and every file-set boundary.
- Mutate key order, normalization, encoding, integer, type, enum, bound,
  prefix/LF, length frame, path, order, content, or schema/validator digest;
  reject or obtain the vector's changed digest.
- Exercise empty/deep/oversize fixture trees, path ambiguity, descriptor swaps,
  forbidden file types, same content/different path, prefix ambiguity, and
  32/64-bit length framing.
- Try roadmap material, fifth v1 ID, missing/extra compatibility, self-declared
  compatibility, component substitution, partial/unrelated approval, and
  approval for another implementation contract; reject.
- Replace any subordinate object in a valid graph with another valid object;
  bytewise restatement checks reject it.
- Run schema-document/compiled-validator conformance vectors on every supported
  host; disagreement is capability failure, never permissive parsing.

## Review request

Review only D5-F1 schema/canonicalization, fixture and bundle digests, registry,
contract-v1 enum, and cross-digest completeness. Atomic activation is D5-F2.
Treat D1/D2/D3/D4/D10 fields as preserved prerequisites. Closure requires
confidence >=93 and zero failed checks, security findings, material dissent,
and unresolved questions.
