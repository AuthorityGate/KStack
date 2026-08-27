# HP-TC04 round-2 repair: acyclic evidence body, anchor, and wrapper

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC04` only
**Prior reviewed packet:**
`c7359eab9c0df2f5bf7b50ff75159b5b9e69c5706b4dfbd39b71b84e24850b23`
**Prior result:** Codex 96 approve; 0 failed / 0 security / 0 dissent /
0 questions
**Repair trigger:** final Host cross-item consistency audit
**Frozen:** every HP-TC04 trust-root, measurement, selection, outcome, test, and
other-item boundary not expressly changed below

## Exact contradiction

HP-TC01's validated `HostConformanceEvidenceV1` requires non-null
`anchorDigest`. The prior HP-TC04 packet instead said the evidence payload
stores no anchor digest to prevent a payload/anchor cycle. Both statements
cannot govern the same object. This delta supplies an explicit three-object
construction that preserves the HP-TC01 wrapper field without a digest cycle.

## Three-object construction

`HostConformanceEvidenceBodyV1` is a new closed/domain-addressed artifact with
the HP-TC01 common artifact head and exactly these fields:

```text
hostInstanceDigest, hostBuildDigest, adapterDigest, harnessDigest,
fixtureSetDigest, environmentDigest, results, issuedAt, expiresAt
```

The types, bounds, collection key, time invariant, and meanings are byte-for-
byte the same as the corresponding HP-TC01 `HostConformanceEvidenceV1` fields.
It has no `anchorDigest`. Its exact artifact domain is
`KSTACK-HOST-CONFORMANCE-EVIDENCE-BODY-V1`.

`EvidenceAnchorV1` keeps the reviewed HP-TC04 fields and signature transcript.
For host conformance, its `payloadDigest` addresses the complete
`HostConformanceEvidenceBodyV1`, and its `payloadSchemaDigest` is that body's
exact schema digest. The anchor is addressed only after its Ed25519 signature
field is populated.

The existing HP-TC01 `HostConformanceEvidenceV1` is then constructed with all
body fields copied byte-identically and `anchorDigest` set to the completed
anchor's digest. It is the final evidence wrapper stored in `HostEvidenceSetV1`
and the protected catalog. It does not serve as the anchor's `payloadDigest`.

Construction is therefore strictly:

```text
HostConformanceEvidenceBodyV1
  -> signed EvidenceAnchorV1
  -> HostConformanceEvidenceV1 wrapper
  -> protected catalog row / HostEvidenceSetV1
```

No object references itself or a later object's digest. The prior sentence
"the payload stores no anchor digest" now applies only to the explicitly named
body object, never to the final HP-TC01 wrapper.

This repair creates a new exact `HostContractSchemaSetV1` generation through
HP-TC01's validated evolution/bootstrap rules. That set adds the body leaf
schema, the invariant implementation/vector entry below, and their exact
resolver/vocabulary closure; it does not mutate the prior schema-set bytes.
Both body and final wrapper bind this new schema-set digest, while their distinct
`schemaId` values resolve to distinct leaf schemas/domains. An offer, selection,
and compatibility entry must select this exact generation before the repaired
evidence family is usable; no current/latest fallback is permitted.

## Mandatory equality invariant

The HP-TC01 invariant registry gains
`host-conformance-evidence-wrapper-v1` with a content-addressed implementation
and cross-runtime positive/negative vectors. Validation resolves the wrapper's
anchor, resolves the anchor's body, then requires:

- anchor `payloadSchemaDigest` equals the body schema digest;
- anchor `environmentSnapshotDigest` equals body `environmentDigest`;
- anchor issued/expiry equals body issued/expiry;
- wrapper `anchorDigest` equals the resolved anchor address;
- wrapper fields other than common head/anchor are byte-identical to body fields;
- wrapper and body common heads bind the same schema-set generation; and
- producer, independent-observation, fixture, host/build, adapter, harness,
  environment, evidence epoch, root generation, and signer scope all satisfy
  the unchanged HP-TC04 admission rules.

Mismatch is `INVALID`; a missing exact body/anchor/schema/invariant closure is
`UNAVAILABLE`. A validator never copies/repairs values or accepts the wrapper
as its own signing body.

## Other signed evidence families

Every other evidence payload follows the same explicit pattern: a closed
family-specific unsigned body, a signed `EvidenceAnchorV1` pointing to that
body, and—only when its HP-TC01 schema requires an anchor field—a final wrapper
pointing to the anchor. Families whose existing payload schema has no anchor
field use body plus anchor and a protected catalog row; they do not gain an
unregistered convenience field.

The catalog row binds exact final-wrapper-or-body digest, anchor digest, schema,
root/epoch, and publication sequence. It is published only after re-reading
every referenced object and passing the applicable equality invariant.

## Deterministic repair verification

Golden vectors freeze canonical bytes and domain addresses for body, unsigned
anchor transcript, signed anchor, final wrapper, catalog row, and evidence set
across independent Node and native/Rust implementations.

Negative vectors substitute every body/wrapper field, environment, result,
time, schema set, anchor, payload schema, root, epoch, signer, fixture, observer,
and catalog reference; point an anchor at the final wrapper; make a body contain
an anchor field; omit the body/anchor/invariant; introduce a self/cross cycle;
reuse one anchor with a different wrapper; and publish before durable closure.
Every mutation deterministically yields `INVALID|UNAVAILABLE`, never `VALID`.

## Preserved boundary

This repair changes only acyclic HP-TC04 evidence construction and equality
validation. The prior trust-root/key lifecycle, live environment measurement,
revocation, supersession, deterministic selection, evaluation outcomes,
diagnostics, tests, HP-Q1 dependency, HP-TC06 observer dependency, and no-
authority/no-implementation boundaries remain normative and unchanged.

## Review request

Review HP-TC04 only for whether this exact body -> anchor -> wrapper construction
closes the HP-TC01 `anchorDigest` contradiction without a digest cycle or field-
substitution path. Closure requires Codex 93+ and empty failed, security,
dissent, and question arrays.

Do not review or close HP-TC05 through HP-TC12, invoke Opus, inspect/edit files,
use tools, implement, use credentials, perform an external action, commit, push,
deploy, publish, or edit reports.
