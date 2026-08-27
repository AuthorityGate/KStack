# HP-TC01 round-2 exact schema repair

**Prior packet:** `5ae3369350805b03a0cb6b17c3e2b88044099d23ef43c62463217a4d270d34eb`
**Prior result:** Codex 98 block; 9 failed / 3 security / 1 dissent / 5 questions
**Frozen:** Option C, non-copy constraint, HP-TC01-only boundary, every other
Host Portability item remains open

This delta repairs only the round-1 entries. Unmodified canonical parsing,
NFC, timestamp, integer, addressing, non-authority, and test requirements from
the prior packet remain normative.

## 1. Global limits and complete declaration grammar

Every bootstrap/schema/artifact byte sequence is at most 1,048,576 bytes;
nesting depth is at most 32; an object has at most 64 properties; an array has
at most 1,024 members; a string has at most 16,384 UTF-8 bytes; a schema set has
at most 256 schemas and 2,048 total `$ref` edges. A pattern is at most 256 ASCII
bytes and compiles under the closed grammar to at most 4,096 DFA states.
Exceeding any bound rejects before unbounded allocation or evaluation.

The following aliases are normative schema declarations, not examples:

```text
DigestV1       = string(len=71, pattern=^sha256:[0-9a-f]{64}$)
AsciiIdV1      = string(utf8Bytes=1..128, pattern=^[a-z0-9][a-z0-9._-]{0,127}$)
SchemaIdV1     = AsciiIdV1
ReasonCodeV1   = RegistryRef(reasonCodes)
ErrorCodeV1    = RegistryRef(errorCodes)
TimestampV1    = string(len=24, exact validated UTC YYYY-MM-DDTHH:mm:ss.SSSZ)
SafeUIntV1     = integer(0..9007199254740991)
PositiveIntV1  = integer(1..9007199254740991)
Nullable<T>    = oneOf(null,T), exactly one branch
ArtifactHeadV1 = schemaId:const; schemaVersion:const(1); schemaSetDigest:DigestV1
KeywordV1      = enum("type","const","enum","properties","required",
                      "additionalProperties","items","minItems","maxItems",
                      "minLength","maxLength","minimum","maximum","pattern",
                      "oneOf","$ref","x-kstack-collection")
```

`RegistryRef(X)` is an `AsciiIdV1` resolving exactly once in collection X of
the bound closed vocabulary registry. `Record{...}` means every named field is
required and no other field is legal. Collection bounds written `[n..m]` are
inclusive. These declarations mechanically expand to `KStackClosedSchemaV1`;
the expanded canonical schema bytes and their digests are the review/fixture
goldens.

`CollectionV1` replaces the underspecified string annotation and is exactly
one of:

```text
{mode:"ORDERED"}
{mode:"SET_BY_VALUE_ASCII"}
{mode:"SET_BY_VALUE_DIGEST"}
{mode:"SET_BY_FIELDS", keyFields:[AsciiIdV1,1..4],
 keyKinds:["ASCII"|"DIGEST"|"ASCII_CANONICAL_UINT",1..4]}
```

For `SET_BY_FIELDS`, both arrays have equal length; every key names a distinct
required top-level scalar field of the member; its declared schema matches the
corresponding kind. Components are encoded as their already-canonical ASCII
bytes, length-prefixed by an eight-digit lower-case hexadecimal byte count,
then concatenated. Members sort lexicographically by unsigned bytes of that
tuple. Value sets sort by the value's ASCII bytes. Equal key bytes are
duplicates even when non-key fields differ and reject the entire array. Nested,
nullable, locale, normalized-on-read, or implementation-selected keys are
forbidden. Numeric keys are forbidden except a non-null `SafeUIntV1` field
explicitly declared `ASCII_CANONICAL_UINT`; it encodes as canonical unsigned
decimal digits without a leading zero. Inputs must already be sorted;
validators never repair order.

## 2. Exact host-operation records

The prior inventory table is superseded by these complete declarations. Every
record begins with `ArtifactHeadV1`; digest fields are non-null unless shown as
`Nullable`.

```text
ArtifactRefV1 = Record{
  schemaDigest:DigestV1, objectDigest:DigestV1, byteCount:SafeUIntV1
}
NamedArtifactRefV1 = Record{
  name:AsciiIdV1, mediaTypeId:RegistryRef(mediaTypes), artifactRef:ArtifactRefV1
}
LimitSetV1 = Record{
  deadlineMs:PositiveIntV1, maxInputBytes:PositiveIntV1,
  maxOutputBytes:PositiveIntV1
}
CapabilityRequirementV1 = Record{
  capabilityId:RegistryRef(capabilityIds), evidenceProfileDigest:DigestV1,
  mandatory:boolean
}
AlternateProfileRefV1 = Record{
  profileId:RegistryRef(operationProfileIds),
  requirementProfileDigest:DigestV1, maximumStatus:const("DEGRADED_REGISTERED")
}
ObservationRowV1 = Record{
  capabilityId:RegistryRef(capabilityIds),
  state:enum("DECLARED","OBSERVED","UNKNOWN"),
  observationEvidenceDigest:Nullable<DigestV1>
}
ConformanceResultRowV1 = Record{
  capabilityId:RegistryRef(capabilityIds), fixtureId:RegistryRef(fixtureIds),
  outcome:enum("PASS","FAIL","NOT_RUN","CAPABILITY_UNAVAILABLE","HARNESS_ERROR"),
  evidenceDigest:DigestV1
}
EvidenceRefV1 = Record{
  evidenceDigest:DigestV1, schemaDigest:DigestV1,
  issuedAt:TimestampV1, expiresAt:TimestampV1
}
ComponentBindingV1 = Record{
  componentRole:RegistryRef(componentRoles), componentId:AsciiIdV1,
  componentDigest:DigestV1
}
```

```text
OperationRequestV1 = ArtifactHeadV1 + Record{
  operationId:RegistryRef(operationIds), operationSchemaDigest:DigestV1,
  requirementProfileDigest:DigestV1,
  repositoryContextDigest:DigestV1, trustedRequestContextDigest:DigestV1,
  activeSetDigest:DigestV1, policyDigest:DigestV1,
  inputs:NamedArtifactRefV1[0..64] SET_BY_FIELDS(name:ASCII),
  limits:LimitSetV1, authorityEnvelopeDigest:Nullable<DigestV1>,
  hostEvidenceSetDigest:DigestV1, nonceDigest:DigestV1,
  idempotencyKeyDigest:DigestV1, createdAt:TimestampV1, expiresAt:TimestampV1
}
OperationResultV1 = ArtifactHeadV1 + Record{
  requestDigest:DigestV1, operationId:RegistryRef(operationIds),
  activeSetDigest:DigestV1,
  status:enum("SUCCEEDED","DENIED","FAILED","AMBIGUOUS","CANCELLED"),
  startedAt:TimestampV1, completedAt:TimestampV1,
  outputs:NamedArtifactRefV1[0..64] SET_BY_FIELDS(name:ASCII),
  errorDigest:Nullable<DigestV1>, receiptProfileDigest:DigestV1
}
OperationErrorV1 = ArtifactHeadV1 + Record{
  requestDigest:DigestV1, errorCode:ErrorCodeV1,
  retryDisposition:enum("NEVER","RECORDED_RESULT_ONLY","RECONCILIATION_REQUIRED"),
  affectedIds:AsciiIdV1[0..128] SET_BY_VALUE_ASCII,
  correlationDigest:DigestV1, detailArtifactDigest:Nullable<DigestV1>
}
OperationRequirementProfileV1 = ArtifactHeadV1 + Record{
  operationId:RegistryRef(operationIds), operationSchemaDigest:DigestV1,
  operationClassId:RegistryRef(operationClassIds),
  requiredCapabilities:CapabilityRequirementV1[0..256]
    SET_BY_FIELDS(capabilityId:ASCII),
  negativeFixtureIds:RegistryRef(fixtureIds)[0..256] SET_BY_VALUE_ASCII,
  receiptProfileDigest:DigestV1, actionFenceProfileDigest:DigestV1,
  alternateProfiles:AlternateProfileRefV1[0..32] SET_BY_FIELDS(profileId:ASCII)
}
HostObservationV1 = ArtifactHeadV1 + Record{
  hostInstanceDigest:DigestV1, hostBuildDigest:DigestV1,
  adapterDigest:DigestV1, environmentDigest:DigestV1,
  observations:ObservationRowV1[0..256] SET_BY_FIELDS(capabilityId:ASCII),
  limitationsReasonCodes:ReasonCodeV1[0..128] SET_BY_VALUE_ASCII,
  observedAt:TimestampV1, expiresAt:TimestampV1
}
HostConformanceEvidenceV1 = ArtifactHeadV1 + Record{
  hostInstanceDigest:DigestV1, hostBuildDigest:DigestV1,
  adapterDigest:DigestV1, harnessDigest:DigestV1,
  fixtureSetDigest:DigestV1, environmentDigest:DigestV1,
  results:ConformanceResultRowV1[1..1024]
    SET_BY_FIELDS(capabilityId:ASCII,fixtureId:ASCII),
  issuedAt:TimestampV1, expiresAt:TimestampV1, anchorDigest:DigestV1
}
HostEvidenceSetV1 = ArtifactHeadV1 + Record{
  hostInstanceDigest:DigestV1, activeSetDigest:DigestV1,
  policyDigest:DigestV1,
  evidenceRefs:EvidenceRefV1[1..256] SET_BY_FIELDS(evidenceDigest:DIGEST),
  assembledAt:TimestampV1, shortestExpiryAt:TimestampV1
}
```

```text
OperationEligibilityV1 = ArtifactHeadV1 + Record{
  operationId:RegistryRef(operationIds), requirementProfileDigest:DigestV1,
  hostEvidenceSetDigest:DigestV1, activeSetDigest:DigestV1,
  policyDigest:DigestV1,
  status:enum("FULL","DEGRADED_REGISTERED","UNSUPPORTED","QUARANTINED"),
  alternateProfileId:Nullable<RegistryRef(operationProfileIds)>,
  provenCapabilityIds:RegistryRef(capabilityIds)[0..256] SET_BY_VALUE_ASCII,
  missingCapabilityIds:RegistryRef(capabilityIds)[0..256] SET_BY_VALUE_ASCII,
  reasonCodes:ReasonCodeV1[0..128] SET_BY_VALUE_ASCII,
  evaluatedAt:TimestampV1, expiresAt:TimestampV1
}
CompatibilityEntryV1 = ArtifactHeadV1 + Record{
  compatibilityId:AsciiIdV1,
  componentBindings:ComponentBindingV1[1..64] SET_BY_FIELDS(componentRole:ASCII),
  externalHostConstraintDigest:DigestV1,
  compatibleHostContractSchemaSetDigest:DigestV1,
  compatibleResolverSetDigest:DigestV1,
  migrationProfileDigest:Nullable<DigestV1>,
  allowedOperationProfileDigests:DigestV1[1..256] SET_BY_VALUE_DIGEST
}
ActivationRecordV1 = ArtifactHeadV1 + Record{
  candidateActiveSetDigest:DigestV1, priorActiveSetDigest:Nullable<DigestV1>,
  compatibilityEntryDigest:DigestV1,
  migrationEvidenceDigest:Nullable<DigestV1>,
  rollbackEvidenceDigest:Nullable<DigestV1>,
  state:enum("STAGED","VALIDATED","ACTIVE","REJECTED","ROLLED_BACK"),
  reasonCodes:ReasonCodeV1[0..128] SET_BY_VALUE_ASCII,
  createdAt:TimestampV1, decidedAt:Nullable<TimestampV1>
}
OperationLeaseV1 = ArtifactHeadV1 + Record{
  requestDigest:DigestV1, operationId:RegistryRef(operationIds),
  activeSetDigest:DigestV1, policyDigest:DigestV1,
  hostEvidenceSetDigest:DigestV1, repositoryContextDigest:DigestV1,
  admissionEpoch:SafeUIntV1, issuedAt:TimestampV1, expiresAt:TimestampV1,
  state:enum("ADMITTED","FENCED","COMPLETED","RECONCILE")
}
OperationReceiptV1 = ArtifactHeadV1 + Record{
  requestDigest:DigestV1, resultDigest:DigestV1,
  operationId:RegistryRef(operationIds),
  operationClassId:RegistryRef(operationClassIds), activeSetDigest:DigestV1,
  producerId:AsciiIdV1, receiptKind:RegistryRef(receiptKinds),
  producerReceiptDigest:Nullable<DigestV1>,
  localAuditDigest:Nullable<DigestV1>, issuedAt:TimestampV1
}
QuarantineEventV1 = ArtifactHeadV1 + Record{
  subjectType:RegistryRef(quarantineSubjectTypes), subjectDigest:DigestV1,
  scopeOperationIds:RegistryRef(operationIds)[0..256] SET_BY_VALUE_ASCII,
  reasonCode:ReasonCodeV1, sourceEvidenceDigest:DigestV1,
  previousEligibilityDigests:DigestV1[0..256] SET_BY_VALUE_DIGEST,
  effectiveAt:TimestampV1, expiresAt:Nullable<TimestampV1>,
  eventAnchorDigest:DigestV1
}
SchemaOfferV1 = ArtifactHeadV1 + Record{
  hostInstanceDigest:DigestV1,
  schemaSetDigests:DigestV1[1..32] SET_BY_VALUE_DIGEST,
  resolverSetDigests:DigestV1[1..32] SET_BY_VALUE_DIGEST,
  operationProfileDigests:DigestV1[0..256] SET_BY_VALUE_DIGEST,
  offeredAt:TimestampV1, expiresAt:TimestampV1
}
SchemaSelectionV1 = ArtifactHeadV1 + Record{
  offerDigest:DigestV1, selectedSchemaSetDigest:DigestV1,
  selectedResolverSetDigest:DigestV1,
  selectedOperationProfileDigests:DigestV1[0..256] SET_BY_VALUE_DIGEST,
  compatibilityEntryDigest:DigestV1,
  selectedAt:TimestampV1, expiresAt:TimestampV1
}
HistoricalResolutionReceiptV1 = ArtifactHeadV1 + Record{
  artifactDigest:DigestV1, artifactSchemaSetDigest:DigestV1,
  artifactSchemaDigest:DigestV1, resolverSetDigest:DigestV1,
  validationOutcome:enum("VALID","INVALID","UNAVAILABLE"),
  resolvedAt:TimestampV1, evidenceDigest:DigestV1
}
```

The result/receipt graph is now acyclic: `OperationResultV1` contains only the
pre-existing `receiptProfileDigest` and never an `OperationReceiptV1` digest.
After the result is addressed, a receipt may bind `resultDigest`. Actual receipt
admissibility and terminal-state semantics remain entirely HP-TC10.

## 3. Exact bootstrap and construction artifacts

The six bootstrap object types are closed records with no `schemaSetDigest`.
Their bootstrap schemas and domains are fixed below; there is no implicit
seventh artifact or implementation default.

```text
ResourceLimitsV1 = Record{
  maxDocumentBytes:const(1048576), maxDepth:const(32),
  maxObjectProperties:const(64), maxArrayItems:const(1024),
  maxStringUtf8Bytes:const(16384), maxSchemas:const(256),
  maxRefEdges:const(2048), maxPatternBytes:const(256),
  maxPatternDfaStates:const(4096)
}
KStackClosedMetaschemaV1 = Record{
  schemaId:const("kstack.closed-metaschema.v1"), schemaVersion:const(1),
  schemaLanguageVersion:const("kstack-closed-schema-v1"),
  permittedKeywords:KeywordV1[1..32] SET_BY_VALUE_ASCII,
  regexGrammarDigest:DigestV1, collectionGrammarDigest:DigestV1,
  resourceLimits:ResourceLimitsV1
}
CanonicalizationProfileV1 = Record{
  schemaId:const("kstack.canonicalization-profile.v1"), schemaVersion:const(1),
  profileId:const("rfc8785-kstack-v1"), rfc8785SpecDigest:DigestV1,
  unicodePolicy:const("VALID_SCALAR_NFC_REJECT_OTHER"),
  numberPolicy:const("SAFE_INTEGER_CANONICAL_ONLY"),
  timestampPolicy:const("UTC_MILLISECOND_YEAR0001_9999"),
  duplicateKeyPolicy:const("REJECT_BEFORE_PARSE"),
  collectionGrammarDigest:DigestV1, regexGrammarDigest:DigestV1
}
VocabularyEntryV1 = Record{id:AsciiIdV1}
VocabularyCollectionV1 = Record{
  collectionId:AsciiIdV1,
  entries:VocabularyEntryV1[1..1024] SET_BY_FIELDS(id:ASCII)
}
ClosedVocabularyRegistryV1 = Record{
  schemaId:const("kstack.closed-vocabulary-registry.v1"), schemaVersion:const(1),
  registryId:AsciiIdV1,
  collections:VocabularyCollectionV1[1..64] SET_BY_FIELDS(collectionId:ASCII)
}
InvariantEntryV1 = Record{
  invariantId:AsciiIdV1, implementationDigest:DigestV1,
  applicableSchemaIds:SchemaIdV1[1..64] SET_BY_VALUE_ASCII,
  vectorIds:AsciiIdV1[1..256] SET_BY_VALUE_ASCII
}
InvariantRegistryV1 = Record{
  schemaId:const("kstack.invariant-registry.v1"), schemaVersion:const(1),
  registryId:AsciiIdV1,
  entries:InvariantEntryV1[1..256] SET_BY_FIELDS(invariantId:ASCII)
}
ResolverEntryV1 = Record{
  resolverId:AsciiIdV1, schemaLanguageVersion:AsciiIdV1,
  implementationDigest:DigestV1,
  supportedMetaschemaDigests:DigestV1[1..32] SET_BY_VALUE_DIGEST,
  supportedCanonicalizationProfileDigests:DigestV1[1..32] SET_BY_VALUE_DIGEST,
  invariantRegistryDigests:DigestV1[1..32] SET_BY_VALUE_DIGEST,
  vectorSetDigest:DigestV1
}
HistoricalResolverSetV1 = Record{
  schemaId:const("kstack.historical-resolver-set.v1"), schemaVersion:const(1),
  resolverSetId:AsciiIdV1,
  entries:ResolverEntryV1[1..32] SET_BY_FIELDS(resolverId:ASCII)
}
VectorEntryV1 = Record{
  vectorId:AsciiIdV1, operationId:AsciiIdV1,
  inputBytesDigest:DigestV1, expectedOutcome:enum("ACCEPT","REJECT"),
  expectedCanonicalBytesDigest:Nullable<DigestV1>,
  expectedObjectDigest:Nullable<DigestV1>
}
CrossRuntimeVectorSetV1 = Record{
  schemaId:const("kstack.cross-runtime-vector-set.v1"), schemaVersion:const(1),
  vectorSetId:AsciiIdV1,
  entries:VectorEntryV1[1..2048] SET_BY_FIELDS(vectorId:ASCII)
}
SchemaEntryV1 = Record{
  schemaId:SchemaIdV1, schemaVersion:PositiveIntV1,
  schemaDigest:DigestV1,
  artifactDomain:string(ASCII,1..128,pattern=^KSTACK-[A-Z0-9-]+-V[0-9]+$)
}
HostContractSchemaSetV1 = Record{
  schemaId:const("kstack.host-contract-schema-set.v1"), schemaVersion:const(1),
  metaschemaDigest:DigestV1,
  schemaLanguageVersion:const("kstack-closed-schema-v1"),
  canonicalizationProfileDigest:DigestV1,
  schemaEntries:SchemaEntryV1[1..256]
    SET_BY_FIELDS(schemaId:ASCII,schemaVersion:ASCII_CANONICAL_UINT),
  closedVocabularyRegistryDigest:DigestV1,
  invariantRegistryDigest:DigestV1,
  historicalResolverSetDigest:DigestV1,
  crossRuntimeVectorSetDigest:DigestV1
}
```

For the schema-entry tuple, `schemaVersion` uses the declared
`ASCII_CANONICAL_UINT` key kind.

Bootstrap addressing is exactly:

| Object | Domain |
|---|---|
| metaschema | `KSTACK-CLOSED-METASCHEMA-V1` |
| canonicalization profile | `KSTACK-CANONICALIZATION-PROFILE-V1` |
| vocabulary registry | `KSTACK-CLOSED-VOCABULARY-REGISTRY-V1` |
| invariant registry | `KSTACK-INVARIANT-REGISTRY-V1` |
| resolver set | `KSTACK-HISTORICAL-RESOLVER-SET-V1` |
| vector set | `KSTACK-CROSS-RUNTIME-VECTOR-SET-V1` |
| host-contract schema set | `KSTACK-HOST-CONTRACT-SCHEMA-SET-V1` |

Each address is `SHA-256(ASCII(domain) || 0x00 || RFC8785(body))`, rendered in
`DigestV1`. The root implementation contains the exact canonical bootstrap
schemas and their digests; it accepts no substitute. `schemaEntries` is now the
only source of operation-artifact domains. The prior `artifactDomains` field is
deleted. Every `artifactDomain` is globally unique within the set; two schema
entries with the same domain reject. This removes conflicting domain sources.

## 4. Cross-field invariant registry

`InvariantRegistryV1` contains the required implementation digest the prior
schema-set shape omitted. The first set registers these exact invariant IDs:

- `request-time-order-v1`: `createdAt < expiresAt`;
- `request-authority-shape-v1`: the request's requirement-profile digest
  resolves to the same operation/schema; authority-envelope nullability equals
  that profile's registered operation class and cannot be caller-selected;
- `result-shape-v1`: `startedAt <= completedAt`; `SUCCEEDED` requires null
  error; every other status requires non-null error; outputs are empty unless
  status is `SUCCEEDED`;
- `observation-shape-v1`: `UNKNOWN` requires null observation evidence and
  other states require non-null evidence;
- `evidence-time-v1`: every issued/observed/assembled/evaluated time precedes
  its expiry and `shortestExpiryAt` equals the minimum referenced expiry;
- `eligibility-partition-v1`: proven and missing sets are disjoint and their
  union equals the referenced requirement profile; only
  `DEGRADED_REGISTERED` has a non-null alternate profile, and that profile is
  present in the requirement profile;
- `receipt-acyclic-v1`: a result has no receipt-object field; a receipt binds an
  already-addressed result and has at least one of producer receipt/local audit
  non-null;
- `activation-shape-v1`: `STAGED` has null `decidedAt`; all other states have a
  non-null `decidedAt`; this is shape only, not an activation prerequisite;
- `selection-exact-v1`: the selected schema, resolver, and operation profiles
  are members of the offer, selected time is within the offer interval,
  selection expiry is no later than offer expiry, and the compatibility entry
  exactly equals `compatibleHostContractSchemaSetDigest`,
  `compatibleResolverSetDigest`, and the selected operation profile set; and
- `resolver-pair-v1`: the selected resolver set contains exactly one entry for
  the selected schema language whose supported metaschema,
  canonicalization-profile, invariant-registry, and vector-set digests equal
  the selected schema set's fields.

Each invariant has one content-addressed deterministic implementation and
positive/negative vector IDs. Missing, duplicate, unknown, non-vector-passing,
or mismatched implementation entries reject the schema set. Structural
validation invokes invariant IDs in sorted order and fails on the first stable
ID. It never chooses policy, authority, evidence trust, or operation outcome.

## 5. Exact negotiation and historical bootstrap

The fixed v1 bootstrap algorithm is:

1. Apply the global byte/depth/count limits and the core JSON tokenizer. Reject
   invalid UTF-8, duplicate keys, invalid scalar values, or noncanonical JSON.
2. Require a top-level object and extract only exact, case-sensitive
   `schemaId`, `schemaVersion`, and `schemaSetDigest` using the immutable
   `ArtifactHeadV1` bootstrap grammar. Missing, duplicate, wrong-type, or
   malformed values reject before semantic resolution.
3. Fetch the object named by `schemaSetDigest` from the caller-supplied
   content-addressed store. Recompute its
   `KSTACK-HOST-CONTRACT-SCHEMA-SET-V1` address and validate it with the exact
   built-in `HostContractSchemaSetV1` bootstrap schema.
4. Fetch/recompute/validate the exact metaschema, canonicalization profile,
   vocabulary registry, invariant registry, resolver set, vector set, and leaf
   schemas named by that set. No network, alias, latest/current fallback,
   dynamic code loading, or artifact-supplied executable is used.
5. Resolve `(schemaId,schemaVersion)` exactly once in `schemaEntries`, require
   the domain to be unique, validate the complete artifact with that schema and
   invariant registry, canonicalize it, and recompute its domain address.
6. Return `VALID` only when every comparison passes. Malformed artifacts return
   `INVALID`; an exact referenced closure or installed resolver implementation
   that is unavailable returns `UNAVAILABLE`. Neither outcome rewrites bytes.

Resolver implementations are KStack-owned installed binaries identified by
digest in `HistoricalResolverSetV1`; historical artifacts cannot provide or
execute resolver code. A root supports only explicitly built-in bootstrap
schema versions and installed resolver digests. This is the complete bootstrap
trust root and avoids interpreting unknown historical bytes with current
application schemas.

Negotiation is deterministic: validate `SchemaOfferV1`, then select an exact
schema/resolver pair only through one `CompatibilityEntryV1` satisfying
`selection-exact-v1` and `resolver-pair-v1`. Multiple valid entries are
ambiguous and reject; zero returns `KSTACK_HOST_SCHEMA_UNSUPPORTED`. There is
no version ordering, alias, nearest match, downgrade, or model choice.

This delta supersedes the prior Historical Resolution retention paragraphs.
HP-TC01 defines identity, validation, and the `VALID|INVALID|UNAVAILABLE`
result only. The object store is an injected read-only source for this item.
HP-TC11 owns activation/lease decisions; HP-TC12 owns retention, garbage
collection, migration reversibility, and unavailable-rollback policy. No
activation prerequisite, indefinite-retention rule, or garbage-collection
prohibition is decided here.

## Review request

Review only whether these exact HP-TC01 repairs provide complete bounded
schemas, unambiguous collections/domains, acyclic result/receipt addressing,
constructible bootstrap artifacts, exact resolver compatibility, and a
deterministic historical bootstrap while leaving HP-TC02 through HP-TC12 open.
Closure requires Codex 93+ and empty failed, security, dissent, and question
arrays. Do not redesign Option C, invoke Opus, inspect/edit files, use tools,
implement, install/configure a host, commit, push, deploy, publish, or edit
reports.
