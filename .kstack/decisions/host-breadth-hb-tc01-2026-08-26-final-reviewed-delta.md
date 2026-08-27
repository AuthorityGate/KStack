# HB-TC01 round-6 bug-fix delta

**Round-5 packet:** `8f7c300c4dc006a58ebed1abff207ed6c2bd16118348edf9cc7c0dcbcbf45e02`
**Round-5 score:** 89/100
**Rule:** fix only four remaining defects

## 1. Typed two-phase initial-install preflight

Add domains `KSTACK-INSTALLER-PREFLIGHT-REQUEST-V1` and
`KSTACK-INITIAL-STATE-EVIDENCE-V1`.

The protected component first admits:

```json
{
  "schemaId": "kstack.installer-preflight-request.v1",
  "schemaVersion": 1,
  "registrySetDigest": "<DigestV1>",
  "installerCandidateDigest": "<DigestV1>",
  "expectedState": "NO_PRIOR_ACTIVE_INSTALL"
}
```

HB-TC02 may receive this digest only for an authenticated read-only preflight.
It re-resolves the candidate and produces:

```json
{
  "schemaId": "kstack.initial-state-evidence.v1",
  "schemaVersion": 1,
  "registrySetDigest": "<DigestV1>",
  "preflightRequestDigest": "<DigestV1>",
  "installerCandidateDigest": "<DigestV1>",
  "targetId": "<candidate target>",
  "platformProfile": "<candidate profile>",
  "scope": "<candidate scope>",
  "destinationTemplateId": "<candidate template>",
  "resolvedDestinationBindingDigest": "<DigestV1>",
  "observedState": "ABSENT|EMPTY_OWNED|EXISTING",
  "ownershipEvidenceDigest": "<DigestV1 or null>",
  "installedMemberManifestDigest": "<DigestV1 or null>",
  "priorActiveInstallReceiptDigest": "<DigestV1 or null>",
  "observationEvidenceDigest": "<DigestV1>",
  "protectedPreflightReceiptDigest": "<DigestV1>"
}
```

All context fields must equal the dereferenced candidate and request. The
destination binding is a typed HB-TC02/HP-TC08 evidence object binding the
opened parent identity and resolved relative destination without exposing an
absolute path in HB-TC01. `ABSENT` requires null ownership/manifest/prior
receipt. `EMPTY_OWNED` requires ownership evidence and null manifest/prior
receipt. `EXISTING` cannot qualify INITIAL. Any prior receipt or manifest
blocks INITIAL.

The protected component verifies/adresses the evidence, then creates the final
handoff binding its digest. HB-TC02 may receive the handoff digest for mutation
only after this phase. Preflight never authorizes mutation. HB-TC02 must
remeasure the destination binding and state immediately before mutation;
change fails closed. Thus there is no construction cycle or reusable untyped
claim.

## 2. Dedicated unsupported-status template registry

Add domain `KSTACK-UNSUPPORTED-STATUS-TEMPLATE-V1` and add required top-level
`unsupportedStatusTemplates` to the exact `RegistrySetV1` key set. Entries are:

```json
{
  "id": "<closed template id>",
  "mediaTypeId": "<registry media type>",
  "templateSchemaDigest": "<registry-schema DigestV1>",
  "templateDigest": "<DigestV1>"
}
```

`templateDigest` addresses a closed declarative object with `schemaId`,
`schemaVersion`, `templateId`, `mediaTypeId`, and `orderedSegments`. Each
segment is exactly `LITERAL`, `SOURCE_PATH`, `REASON_CODE`, or `AFFECTED_IDS`;
only `LITERAL` carries a bounded literal value. Rendering uses fixed escaping
for the registered media type, no code/template language/model. Each
`generatedOutputMaps` row adds `templateId` and `templateDigest`; all three
template fields resolve to the same registry entry exactly once.

## 3. Exact PRESERVE installation context

For `PRESERVE`, dereference candidate, baseline, and baseline installed-member
manifest. Require identical `registrySetDigest`, `targetId`,
`platformProfile`, `scope`, and `destinationTemplateId`. Also require candidate
render bytes/member manifest to equal the baseline historical render/installed
manifest under the existing preservation rule. HB-TC02 later requires the live
resolved destination binding to equal the baseline installation-root binding
before mutation. A mismatch cannot fall back to PRESERVE or INITIAL; it needs
a separately valid MIGRATE path or fails.

## 4. Exact handoff amendments

For `INITIAL`, `initialStateEvidenceDigest` resolves to the schema above and
cross-binds the candidate/request/context; baseline/proposal/authorization are
null. For `PRESERVE`, exact context equality above is mandatory. For `MIGRATE`,
the prior candidate/proposal/authorization bindings remain mandatory. The old
statement “HB-TC02 receives only the handoff” is narrowed: it may first receive
one preflight-request digest for read-only measurement, but receives only the
final handoff digest for any mutation phase.

## Review request

Review only these concrete fixes against the frozen cumulative candidate.
Closure requires score 93+ and zero failed checks, security findings, dissent,
or questions. Do not redesign, invoke Opus, call tools, inspect/edit files,
implement, commit, push, deploy, publish, or change reports.
