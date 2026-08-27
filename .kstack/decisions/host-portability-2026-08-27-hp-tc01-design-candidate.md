# HP-TC01 design candidate: normative host-contract schemas

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC01` only
**Status:** local design candidate; not externally reviewed or validated
**Architecture:** locked Host Option C with non-copy constraint
**Review route:** Codex only; exact-payload approval required before dispatch

## Frozen evidence

| Source | SHA-256 | Use |
|---|---|---|
| Host Portability objective | `9119407fc59c09391faaab87d62ec6acd0e6a8f5f4c73f5783f9265ca6ed0cfb` | Scope and success evidence |
| Host Portability item ledger at inspection | `aabd9705ddaebe9dbba8df459de7ef484d505744fb2af8530f7f34c2141ceaa4` | Genuine HP-TC01 defect boundary |
| Locked HP-Q1/Q2/Q3 clarification | `e457ebc72ae7ab37852015a2835400e46ec5307be8e4d4d0717c4d0fd3e2681b` | Protected governance and external-host boundaries |
| Locked Option C owner decision | `1708c5af6c54c983d7a31202913e4858719c3936ac805f44af82cd30dfda910e` | Host architecture and non-copy rule |
| Durable HB-TC01 final reviewed delta | `65dc5885d198751dcdcd345fd938e9e36a6885dd89194d2c676eab0d55a1139d` | Existing KStack canonical-package substrate only |

The reviewed round-one defect is exact: illustrative objects do not let two
independent implementations validate, normalize, address, negotiate, or later
resolve host-contract artifacts identically. This item defines that normative
schema/canonicalization layer only. It does not clear HP-TC02 through HP-TC12.

## Reuse-first disposition

This item is `COMPOSE-INTERNAL-PLUS-BUILD`:

- compose the already validated KStack `DigestV1`, RFC 8785, closed-schema,
  registry, and one-way addressing conventions from HB-TC01;
- build the missing host-operation schema family as KStack-native contract
  objects; and
- reject gstack source reuse for this item because the reviewed gstack host
  registry/generator does not define an authority-bearing operation/evidence/
  activation contract and importing it would not close HP-TC01.

No upstream bytes enter this design. The existing Garry Tan/gstack notice and
provenance policy remain unchanged. Agent Skills packages, projected prompts,
host metadata, and installer records remain non-authoritative.

## Closed schema language

`KStackClosedSchemaV1` is the only schema language admitted for this family.
It is a pinned subset of JSON Schema draft 2020-12 with a content-addressed
KStack metaschema. A schema document is UTF-8 JSON, RFC-8785 canonical, and
addressed as:

```text
DigestV1 = "sha256:" + 64 lower-case hexadecimal characters
schemaDigest = SHA-256(
  ASCII("KSTACK-CLOSED-SCHEMA-DOCUMENT-V1") || 0x00 || RFC8785(schema)
)
```

The permitted vocabulary is exactly `type`, `const`, `enum`, `properties`,
`required`, `additionalProperties`, `items`, `minItems`, `maxItems`,
`minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `oneOf`, local
content-addressed `$ref`, and the metaschema-validated
`x-kstack-collection`. Every object schema requires
`additionalProperties:false`; every property is required, with optionality
represented by an explicit `null` branch. Defaults, coercion, remote/network
references, `$dynamicRef`, runtime formats, code, plugins, model evaluation,
implementation-defined regex features, and unknown vocabulary are forbidden.

Patterns use only a closed ASCII regular-expression subset: anchors, literal
ASCII, character classes, fixed repetition, and bounded repetition. Backrefs,
lookaround, Unicode properties, locale, and engine extensions are forbidden.
All `$ref` targets are exact `urn:kstack:schema:<DigestV1>` values present once
in the bound schema set. Missing, duplicate, cyclic, or unreachable references
reject the complete set. The dependency graph must be acyclic.

Each host-operation artifact has the exact common fields `schemaId`,
`schemaVersion`, and `schemaSetDigest`. Bootstrap metaschema, schema,
canonicalization, vocabulary, resolver, vector, and schema-set construction
objects are explicitly exempt from `schemaSetDigest` so none can bind itself.
Validation receives an external
expected `(schemaSetDigest, schemaDigest)` pair, resolves that exact schema,
then requires the artifact fields to match the resolved registry entry. A
schema never embeds its own digest or a later bundle digest, so construction is
acyclic.

## Canonical value and byte rules

The parser validates bytes before materializing values:

1. input is UTF-8 without BOM, invalid sequences, noncharacters, or lone
   surrogates;
2. duplicate object keys reject before ordinary JSON parsing;
3. keys and all authoritative strings are already Unicode NFC; non-NFC input
   rejects rather than being silently rewritten;
4. authoritative schemas permit only booleans, null, strings, arrays, objects,
   and integers in `[-9007199254740991, 9007199254740991]`; floating values,
   exponent notation, NaN, infinities, and negative zero reject;
5. canonical timestamps are exactly UTC Gregorian
   `YYYY-MM-DDTHH:mm:ss.SSSZ`, years 0001-9999, with a real calendar date and no
   leap-second spelling;
6. `AsciiIdV1` is 1-128 lower-case ASCII characters from `[a-z0-9._-]`;
   `DigestV1` and UUID fields have one exact lower-case spelling;
7. embedded free text is forbidden in authoritative decision fields. Bounded
   human text is a non-authoritative projection or an externally addressed raw
   artifact whose byte digest is retained without normalization; and
8. after validation, RFC 8785 produces the sole canonical JSON bytes. The
   artifact address is `SHA-256(ASCII(domain) || 0x00 || canonicalBytes)` using
   the exact domain registered for its schema.

Arrays are `ORDERED` unless their schema has the metaschema-enforced
`x-kstack-collection` value `SET_BY_ASCII_ID`, `SET_BY_DIGEST`, or
`SET_BY_TUPLE`. Set arrays must arrive in ascending bytewise ASCII order by the
declared key, with no duplicate key or duplicate canonical member; validators
reject and never silently sort them. Ordered arrays preserve input order.
Unknown fields, missing fields, extra enum values, unregistered IDs, bounds
overflow, and noncanonical encodings reject the whole object.

## Schema-set and construction objects

`HostContractSchemaSetV1` is addressed with domain
`KSTACK-HOST-CONTRACT-SCHEMA-SET-V1` and contains exactly:

```text
schemaId, schemaVersion, metaschemaDigest, schemaLanguageVersion,
canonicalizationProfileDigest, schemaEntries, artifactDomains,
closedVocabularyRegistryDigest, historicalResolverSetDigest,
crossRuntimeVectorSetDigest
```

`schemaEntries` is `SET_BY_TUPLE(schemaId,schemaVersion)` and each closed row is
exactly `{schemaId,schemaVersion,schemaDigest,artifactDomain}`.
`artifactDomains` is `SET_BY_ASCII_ID` with exactly `{schemaId,domain}` rows.
The vocabulary registry binds all operation, operation-class, capability,
reason, error, media-type, outcome, component-role, and status IDs referenced
by the schemas. A reference resolves exactly once; aliases are absent.

Construction order is metaschema and canonicalization profile; leaf schemas;
closed vocabularies; historical resolver set; cross-runtime vectors; then the
schema set. Operation artifacts bind the completed schema-set digest. No step
binds itself or a later step.

## Normative top-level artifact family

Every row below is a closed property set. Named nested rows are defined in the
next section. An implementation may not add convenience fields.

| Schema | Exact fields after the common three | Collection/invariant |
|---|---|---|
| `OperationRequestV1` | `operationId`, `operationSchemaDigest`, `repositoryContextDigest`, `trustedRequestContextDigest`, `activeSetDigest`, `policyDigest`, `inputs`, `limits`, `authorityEnvelopeDigest`, `hostEvidenceSetDigest`, `nonceDigest`, `idempotencyKeyDigest`, `createdAt`, `expiresAt` | inputs set by name; no caller-supplied operation class or principal fields |
| `OperationResultV1` | `requestDigest`, `operationId`, `activeSetDigest`, `status`, `startedAt`, `completedAt`, `outputs`, `errorDigest`, `receiptDigest`, `auditAnchorDigest` | outputs set by name; status exactly `SUCCEEDED|DENIED|FAILED|AMBIGUOUS|CANCELLED`; nullable proof fields obey the status matrix |
| `OperationErrorV1` | `requestDigest`, `errorCode`, `retryDisposition`, `affectedIds`, `correlationDigest`, `detailArtifactDigest` | affected IDs sorted/deduplicated; details are optional external bounded artifacts, never interpolated authority |
| `OperationRequirementProfileV1` | `operationId`, `operationSchemaDigest`, `operationClassId`, `requiredCapabilities`, `negativeFixtureIds`, `receiptProfileDigest`, `actionFenceProfileDigest`, `alternateProfiles` | all sets sorted; class is registry-owned, not accepted from a request |
| `HostObservationV1` | `hostInstanceDigest`, `hostBuildDigest`, `adapterDigest`, `environmentDigest`, `observations`, `limitationsReasonCodes`, `observedAt`, `expiresAt` | diagnostic only; every observation is `DECLARED|OBSERVED|UNKNOWN`, never PASS |
| `HostConformanceEvidenceV1` | `hostInstanceDigest`, `hostBuildDigest`, `adapterDigest`, `harnessDigest`, `fixtureSetDigest`, `environmentDigest`, `results`, `issuedAt`, `expiresAt`, `anchorDigest` | result rows set by `(capabilityId,fixtureId)`; schema validity proves no trust |
| `HostEvidenceSetV1` | `hostInstanceDigest`, `activeSetDigest`, `policyDigest`, `evidenceRefs`, `assembledAt`, `shortestExpiryAt` | evidence refs set by digest; no “latest” selector |
| `OperationEligibilityV1` | `operationId`, `requirementProfileDigest`, `hostEvidenceSetDigest`, `activeSetDigest`, `policyDigest`, `status`, `alternateProfileId`, `provenCapabilityIds`, `missingCapabilityIds`, `reasonCodes`, `evaluatedAt`, `expiresAt` | status exactly `FULL|DEGRADED_REGISTERED|UNSUPPORTED|QUARANTINED`; schema validity cannot promote it |
| `CompatibilityEntryV1` | `compatibilityId`, `componentBindings`, `externalHostConstraintDigest`, `schemaSetDigest`, `migrationProfileDigest`, `allowedOperationProfileDigests` | component bindings set by role; exact digests only, no ranges except inside separately typed external-host constraint |
| `ActivationRecordV1` | `candidateActiveSetDigest`, `priorActiveSetDigest`, `compatibilityEntryDigest`, `migrationEvidenceDigest`, `rollbackEvidenceDigest`, `state`, `reasonCodes`, `createdAt`, `decidedAt` | state exactly `STAGED|VALIDATED|ACTIVE|REJECTED|ROLLED_BACK`; semantics remain HP-TC11/12 |
| `OperationLeaseV1` | `requestDigest`, `operationId`, `activeSetDigest`, `policyDigest`, `hostEvidenceSetDigest`, `repositoryContextDigest`, `admissionEpoch`, `issuedAt`, `expiresAt`, `state` | state exactly `ADMITTED|FENCED|COMPLETED|RECONCILE`; ownership/liveness remain HP-TC11 |
| `OperationReceiptV1` | `requestDigest`, `resultDigest`, `operationId`, `operationClassId`, `activeSetDigest`, `producerId`, `receiptKind`, `producerReceiptDigest`, `localAuditDigest`, `issuedAt` | proof kinds are syntactically distinct; admissibility remains HP-TC10 |
| `QuarantineEventV1` | `subjectType`, `subjectDigest`, `scopeOperationIds`, `reasonCode`, `sourceEvidenceDigest`, `previousEligibilityDigests`, `effectiveAt`, `expiresAt`, `eventAnchorDigest` | non-promotional event only; authority/revocation semantics remain HP-TC04/05 |
| `SchemaOfferV1` | `hostInstanceDigest`, `schemaSetDigests`, `resolverSetDigests`, `operationProfileDigests`, `offeredAt`, `expiresAt` | every list is a sorted set of exact digests |
| `SchemaSelectionV1` | `offerDigest`, `selectedSchemaSetDigest`, `selectedResolverSetDigest`, `selectedOperationProfileDigests`, `compatibilityEntryDigest`, `selectedAt`, `expiresAt` | exact registered intersection only; no semantic-version fallback |
| `HistoricalResolutionReceiptV1` | `artifactDigest`, `artifactSchemaSetDigest`, `artifactSchemaDigest`, `resolverSetDigest`, `validationOutcome`, `resolvedAt`, `evidenceDigest` | outcome exactly `VALID|INVALID|UNAVAILABLE`; never rewrites the artifact |

## Closed nested types

- `ArtifactRefV1` is exactly `{schemaDigest,objectDigest,byteCount}`.
- `NamedArtifactRefV1` is exactly `{name,mediaTypeId,artifactRef}`.
- `LimitSetV1` is exactly `{deadlineMs,maxInputBytes,maxOutputBytes}` with
  positive policy-bounded safe integers.
- `CapabilityRequirementV1` is exactly
  `{capabilityId,evidenceProfileDigest,mandatory}`.
- `AlternateProfileRefV1` is exactly
  `{profileId,requirementProfileDigest,maximumStatus}` where maximum status is
  `DEGRADED_REGISTERED`.
- `ObservationRowV1` is exactly
  `{capabilityId,state,observationEvidenceDigest}`.
- `ConformanceResultRowV1` is exactly
  `{capabilityId,fixtureId,outcome,evidenceDigest}` where outcome is
  `PASS|FAIL|NOT_RUN|CAPABILITY_UNAVAILABLE|HARNESS_ERROR`.
- `EvidenceRefV1` is exactly
  `{evidenceDigest,schemaDigest,issuedAt,expiresAt}`.
- `ComponentBindingV1` is exactly
  `{componentRole,componentId,componentDigest}`.

Every nested type uses the same closed metaschema, normalization, collection,
and size rules. No untyped JSON map exists in this artifact family.

## Cross-field matrices

Schema validation includes deterministic non-JSON-Schema invariants registered
by invariant ID and implementation digest in the schema set:

- a request's creation precedes expiry; authority-envelope nullability is
  determined only by its referenced requirement profile, not by caller choice;
- `SUCCEEDED` has outputs and no error; `DENIED|FAILED|CANCELLED` has an error
  and no outputs; `AMBIGUOUS` has an error and no retry-safe receipt claim;
- every artifact ref resolves to exact bytes of the declared length and digest;
- earliest evidence expiry equals `shortestExpiryAt`;
- eligibility sets are pairwise disjoint and their union equals the referenced
  requirement profile's registered capabilities;
- `DEGRADED_REGISTERED` requires a registered alternate profile;
  `FULL|UNSUPPORTED|QUARANTINED` require null alternate profile; and
- selection members must be offered, exact-compatible, unexpired, and present
  in the same compatibility entry. An empty intersection fails with
  `KSTACK_HOST_SCHEMA_UNSUPPORTED`; no “nearest,” current, or highest version
  is selected.

These invariants validate structure and cross-binding only. They do not decide
who supplied trusted context, whether evidence/receipts are authentic, whether
an action is eligible, or whether activation/rollback is safe.

## Historical resolution

The protected object store retains, without replacement or deletion, every
schema document, schema set, metaschema, canonicalization profile, invariant
implementation, resolver implementation, vocabulary registry, and vector set
reachable from any retained active set, request, result, evidence, receipt,
lease, activation, or quarantine record.

Resolution always begins from the artifact's exact `schemaSetDigest` plus the
externally expected schema digest. It loads only the corresponding pinned
resolver set, validates its digest and vector evidence, and returns a new
`HistoricalResolutionReceiptV1`. It never uses the current schema, current
registry, host aliases, network, model, plugin, migration, or “best effort.” A
missing or corrupt closure returns `UNAVAILABLE` and the artifact remains
opaque; it cannot be reinterpreted or promoted.

Schema evolution creates a new schema ID/version/digest and, when necessary, a
separate content-addressed migration profile. Original bytes and their resolver
closure remain. Activation must prove the candidate resolver set contains the
complete reachable historical closure before it can become active. Garbage
collection is forbidden while any retained object references the closure.
HP-TC12 separately owns migration reversibility and retention policy; this item
only supplies deterministic identities and resolution.

## Option C and isolation boundaries

- HB-TC01's Agent Skills `RegistrySetV1` and this
  `HostContractSchemaSetV1` are separate, explicitly imported sets. Neither can
  silently extend the other. An active set may bind both exact digests.
- The generic HB-TC02 installer can transport schema bytes only through a
  later authorized typed handoff; it cannot activate or trust them.
- HB-TC03 instruction discovery and HB-TC04 read-only MCP projections may
  expose public schema descriptions but cannot become resolver, authority, or
  validation evidence.
- Protected trust derivation, replay, evidence selection, eligibility,
  conformance, mutation, MCP identity, receipts, leases, and migration remain
  HP-TC02 through HP-TC12. Schema-valid is never synonymous with trusted,
  eligible, approved, active, supported, or executed.

## Deterministic verification design

Independent Node and native/Rust reference implementations must match exact
goldens for: every top-level and nested schema; RFC-8785 bytes; all domain
digests; ASCII/NFC/timestamp/integer boundaries; duplicate keys; unknown
fields/vocabulary; nullable fields; ordered/set arrays; schema-ref cycles;
offer/selection downgrade and empty-intersection cases; every cross-field
matrix; old/new schema coexistence; corrupted or missing historical closure;
and mutation of every digest/length/binding.

Property tests generate only schema-valid bounded values and prove round-trip
byte identity. Negative fixtures prove parsers reject before canonicalization
on duplicates, invalid Unicode, floats, non-NFC, unsorted sets, alias IDs,
remote refs, regex extensions, and unknown fields. No fixture executes a host,
installs an adapter, accesses credentials/network, or performs a side effect.

## Review request

Review HP-TC01 only: whether this closed schema language, exact artifact
family, canonical byte/address rules, negotiation contract, collection
semantics, and historical resolver are constructible and sufficient for two
independent implementations to validate and hash identically while preserving
locked Option C. Report current concrete defects only. Closure requires Codex
93+ and empty failed, security, dissent, and question arrays.

Do not review or attempt to close HP-TC02 through HP-TC12; do not invoke Opus,
inspect/edit files, use tools, implement, install, configure a host, commit,
push, deploy, publish, or edit reports.
