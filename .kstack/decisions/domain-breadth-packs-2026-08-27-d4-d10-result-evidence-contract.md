# Domain breadth D4 + D10 - composition/result boundary and workflow evidence handshake

**Items:** D4 pre-dispatch composition versus post-analysis validation; D10
authenticated workflow-owned evidence descriptors  
**Owner decision:** Q3 = each governed workflow produces and attests its own
evidence descriptors; the shared validator only consumes and verifies them  
**Route:** Codex-only, supplied-packet-only review; no Opus  
**Scope:** these items are combined because D4 cannot validate an
evidence-backed post-analysis result without the D10 producer/validator
handshake. D5 owns reusable closed schemas and activation; D8 owns trusted time.

## Split-phase invariant

Composition is complete and immutable before provider dispatch. It cannot
contain model output, post-dispatch evidence, a result status, or a claim that
required evidence passed. Post-analysis validation cannot alter the selection,
pack bytes, rendered prompt, question/evidence inventory, or composition
receipt. A structurally valid result is not evidence; an authenticated evidence
descriptor is not an instruction or authority grant.

```text
VERIFIED_SELECTION -> COMPOSED -> DISPATCH_ADMITTED -> RESULT_RECEIVED
                   -> RESULT_VALIDATED | RESULT_INVALID
```

No other edge exists. `RESULT_INVALID`, a missing artifact, a crash, or an
unknown state emits no success receipt. Replaying identical immutable inputs
may reproduce a receipt but may not skip admission or reuse a result for
another composition.

## Pre-dispatch composition

Closed canonical `CompositionReceiptV1` contains:

```text
{
  artifactType: "kstack-pack-composition-receipt", schemaVersion: 1,
  projectId, repositoryImmutableId, subjectDigest,
  selectionDigest, snapshotDigest, expectedGeneration,
  repositoryPolicyDigest, compatibilityMatrixDigest,
  baseBriefDigest, baseLaneContractDigest,
  orderedPacks: [{ packId, version, bundleDigest, contentDigest,
                   evidenceSchemaDigest }],
  renderedInventory: [{ packId, sectionId, questionId,
                         orderedEvidenceIds }],
  baseUtf8Bytes, packUtf8Bytes, finalUtf8Bytes,
  tokenizerReceiptDigest, finalPromptDigest, composedAt
}
```

Its digest is `SHA256(UTF8("KSTACK-PACK-COMPOSITION-RECEIPT-V1\n") ||
canonicalV1(receipt))`. Digests are exactly 32 decoded bytes rendered as 64
lowercase hex. Pack and question inventories are exact render order; no
consumer may reorder or supplement them. Prompt bytes resolve only by
`finalPromptDigest` from the operation-bound inventory.

Dispatch admission recomputes prompt and subordinate digests, compares guarded
live catalog generation and policy/compatibility state, applies separately
owned budget/freshness checks, then emits closed `DispatchReceiptV1`. It binds
composition-receipt, prompt, provider-request-body, provider/model
configuration, and dispatch-policy digests plus a unique invocation ID and
admitted time. It makes no result claim. Drift before provider acceptance emits
no dispatch receipt and requires new composition.

## Post-analysis result

Provider output parses to closed `PackAnalysisResultV1`:

```text
{
  artifactType: "kstack-pack-analysis-result", schemaVersion: 1,
  compositionReceiptDigest, dispatchReceiptDigest,
  providerResponseDigest, subjectDigest,
  answers: [{ packId, sectionId, questionId,
              disposition: "supported" | "contradicted" | "unknown",
              evidenceIds: [], observationDigest }]
}
```

Answer tuples equal the composition question inventory exactly once and in
exact order. Evidence IDs are a duplicate-free, order-preserving subset of the
question's evidence IDs. Unknown/missing fields, extra answers, invalid enums,
authority/tool fields, or digest mismatch reject the whole result. An
`observationDigest` identifies separately retained model text; model text is
never executable and cannot supply evidence. The result digest uses
`"KSTACK-PACK-ANALYSIS-RESULT-V1\n"`.

## Workflow-owned evidence descriptor

For every cited evidence ID, the governed workflow produces one closed
`WorkflowEvidenceDescriptorV1` from evidence it already owns:

```text
{
  artifactType: "kstack-workflow-evidence-descriptor", schemaVersion: 1,
  projectId, repositoryImmutableId, workflowClass,
  producerContractDigest, producerPolicyDigest,
  subjectDigest, compositionReceiptDigest, dispatchReceiptDigest,
  packId, questionId, evidenceId,
  sourceClass, sourceLocatorDigest, sourceDigest,
  observationKind, observedAt, producedAt, expiresAt,
  producerInvocationId
}
```

The exact pack evidence schema restricts `sourceClass`, `observationKind`, and
required fields. It cannot add producers, validators, locators, tools,
permissions, endpoints, code, references, defaults, transforms, or authority.
`sourceLocatorDigest` identifies a separately retained, access-controlled
locator rather than exposing a secret or mutable URL. `sourceDigest` binds the
exact immutable evidence bytes or native workflow receipt. The descriptor has
no generic claim, free-form instruction, pass boolean, waiver, or action.

Its digest is `SHA256(UTF8("KSTACK-WORKFLOW-EVIDENCE-DESCRIPTOR-V1\n") ||
canonicalV1(descriptor))`. The workflow submits it to the KStack broker. The
broker verifies the calling workload as the exact active producer registered
for `(projectId, repositoryImmutableId, workflowClass,
producerContractDigest)` in the guarded external producer-policy snapshot;
recomputes native receipt/evidence identity; verifies all operation bindings;
and emits `WorkflowEvidenceAttestationV1`. The attestation binds descriptor
digest, producer workload identity, producer-policy snapshot digest/generation,
broker key ID, issuance time, expiry, and one-use nonce.

Pack/provider/repository/Jira bytes and generic user identities cannot register
or impersonate a producer. A workflow may attest only its closed
`workflowClass`; cross-class attestation fails. The broker resolves policy,
native evidence, descriptor, and attestation through one operation inventory.
Missing, stale, revoked, ambiguous, substituted, unqualified, differently
bound, or unverifiable material yields no attestation. Signatures use a
qualified external adapter and registered key/version; repository or
self-declared keys are invalid. D8 provides trusted time and failure is closed.

## Shared result validator

The shared validator is pure and has no network, broker-write, workflow,
provider, Jira, GitHub, tool, or activation capability. Its closed inventory
contains composition and dispatch receipts, provider response, analysis
result, exact pack schemas, producer-policy snapshot, and every cited
descriptor/attestation/native-evidence object. It:

1. Recomputes each digest and validates every object against the schema and
   compatibility tuple named by the composition receipt.
2. Requires exactly one answer per composed question and no other answer; one
   descriptor and valid attestation per cited evidence ID; no uncited object.
3. Requires all subject/project/repository/composition/dispatch/invocation/
   pack/question/evidence/producer/native-source bindings to agree bytewise.
4. Verifies the supplied signed producer-policy snapshot, qualification,
   signature, revocation evidence, policy generation, nonce identity, and D8
   time evidence. This is a deterministic candidate decision, not a claim that
   the external state remains current at commit time.
5. Allows `supported` only when every schema-required evidence ID is present,
   authenticated, fresh, and its closed `observationKind` permits support.
   `contradicted` likewise needs a schema-defined contradictory observation;
   otherwise it changes only to `unknown`, never `supported`.
6. Emits closed, non-authoritative `ValidationDecisionV1`, binding the complete
   ordered input-digest set, proposed dispositions/reason codes, validator
   implementation and schema digests, coordinator-policy digest, transaction
   ID, and a D8-bounded expiry. It performs no write or nonce consumption.

The broker's explicit `ResultValidationCommitCoordinatorV1` is the only
authority allowed to convert that decision into a receipt. It accepts the
decision plus the same closed inventory and, inside one serialized durable
broker-ledger transaction:

1. Recomputes the complete input-digest set and reruns the pinned pure validator
   rather than trusting caller-supplied dispositions.
2. Reads guarded current producer policy/generation, key qualification,
   revocation, attestation nonce state, and D8 trusted time; requires the
   decision and every attestation to remain current and unconsumed.
3. Requires exact project/repository/subject/composition/dispatch/transaction
   bindings and compare-and-swap preconditions for the whole nonce set.
4. In the same transaction, marks every nonce consumed by this transaction ID
   and inserts exactly one immutable `ResultValidationReceiptV1`. A uniqueness
   constraint on `(projectId, transactionId)` and on each attestation nonce
   prevents competing success.

Commit succeeds wholly or not at all. A datastore/backend unable to transact
all nonce rows and the receipt record reports
`VALIDATION_ATOMICITY_CAPABILITY_UNMET`; it may not emulate success with
separate writes. Crash before commit leaves neither consumption nor receipt;
crash after commit recovers the existing receipt by transaction ID. Retry is
idempotent only when the recomputed complete input-digest set matches; otherwise
it is a conflict. The coordinator cannot compose, dispatch, activate a pack,
grant authority, or mutate Jira/GitHub/provider state.

`ResultValidationReceiptV1` binds the decision digest, complete input-digest
set, ordered per-question dispositions/reason codes, validator and coordinator
implementation/schema/policy digests, guarded producer-policy generation,
consumed nonce set, trusted commit time, and transaction ID. It states
structural/provenance validity only. The governing workflow decides how
dispositions affect work and the receipt cannot certify more than the
authenticated producer observation.

## Closed failures and verification

Closed failures include `COMPOSITION_INPUT_STALE`, `DISPATCH_NOT_ADMITTED`,
`RESULT_SCHEMA_INVALID`, `RESULT_INVENTORY_MISMATCH`,
`EVIDENCE_DESCRIPTOR_MISSING`, `EVIDENCE_ATTESTATION_INVALID`,
`EVIDENCE_SOURCE_DIGEST_MISMATCH`, `PRODUCER_UNQUALIFIED`,
`PRODUCER_POLICY_STALE`, `EVIDENCE_STALE`, `ATTESTATION_REPLAYED`,
`VALIDATION_ATOMICITY_CAPABILITY_UNMET`, and
`VALIDATION_TRANSACTION_CONFLICT`. They emit no success receipt. Diagnostics
are non-authoritative and secret-redacted.

- Golden vectors fix canonical bytes/digests for all artifacts, including the
  non-authoritative decision and authoritative commit receipt.
- Mutate every binding/order/ID/version/time/key/policy generation or add a
  duplicate/unknown/authority field; reject.
- Try provider, pack, repository/Jira text, user identity, wrong workflow,
  retired key, or self-declared producer as evidence; reject.
- Cite missing/extra/duplicate/stale/cross-bound/replayed/unsupported evidence;
  obtain invalid or `unknown`, never `supported`.
- Race policy/catalog/producer revocation and expiry against admission and
  validation; either one fully guarded transaction succeeds or none does.
- Race two coordinators and crash before/after the single ledger commit; prove
  atomic recovery, idempotent exact-input retry, mismatch conflict, and
  at-most-one terminal receipt. Reject a split-write backend.
- Capability-test that composer/validator cannot dispatch or broker-write and
  descriptors cannot change prompt, selection, tools, workflow, or activation.

## Review request

Review only whether the inseparable D4/D10 split-phase boundary and
workflow-producer/validator handshake close their current defects. Treat D1,
D3, D5, D6, and D8 as separate prerequisites; identify only an actual missing
binding or unsafe dependency here. Closure requires confidence >=93 with zero
failed checks, security findings, material dissent, and unresolved questions.
