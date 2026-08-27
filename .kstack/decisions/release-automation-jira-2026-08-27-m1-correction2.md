# Release Automation M1 - correction 2 audience-preimage trust path

**Thread:** `release-automation-jira-2026-08-26`  
**Candidate:** M1 correction 2, Codex-only improvement pass 1  
**Scope:** acquisition and verification of the canonical OIDC audience preimage
only  
**Review floor:** Codex 84 or higher with zero failed checks, zero security
findings, zero material dissent, and zero required unresolved questions for
correction 2  
**Status:** design delta only; no dispatch, implementation, configuration
change, or production activation is authorized

## Decision

The environment-gated `approval-evidence` job receives one broker-signed,
closed `AudienceSeedV1` packet from the completed `preflight-summary` job,
verifies that packet, computes the one custom `aud`, and requests a GitHub OIDC
token. It submits exactly that closed signed seed and that token to the broker.
It never supplies an unsigned authoritative preimage value.

The broker independently reconstructs the complete canonical preimage from its
protected signed release record, its dispatch journal, the exact qualifying
GitHub run/environment review record, protected broker configuration, and
verified native OIDC claims. It rejects any mismatch between that reconstruction
and the token's exact `aud`. Job outputs and request fields are routing and
availability inputs only; none can change broker authority.

This closes only the missing acquisition/trust path. It does not create any
KStack-specific native GitHub claim.

## Bound artifacts

| Source | SHA-256 |
|---|---|
| Round 3 M1 decision brief | `825790d6e612ae1fecc1aedfc4ad67db14fd92d7f2a5888e30d8d93afb0730ad` |
| Round 3 Opus report that identified correction 2 | `7386051c8c9e95e76cab0128b50821aaa7c2de95cd4f8c3f676318b03f863ede` |
| M1 official-source evidence memo | `5ddd2ce422ddead918c863a37475538db21eddf2026814cbb73db35018a9c448` |
| Validated correction-1 Round 9 candidate | `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523` |
| Round 9 Codex report | `ae9c8bd95e75832ae82878e5b11d6f437df7b290da2045133484e82db8911749` |
| Round 9 Codex envelope | `c0090466dbf125e62cdbb2b55ec89c34950b7d49b5bc0c1004e7e0ec5ee4b77d` |
| Round 9 Codex manifest | `5b29b47938ca514570c8f8e45d1fa33cd29eaa6b1159800fe1b460838291b9df` |
| Round 9 Opus report | `9b2a4b47d905c1bab952eba0801243789912d367451b1f4d7e3b80d6de517445` |
| Round 9 Opus envelope | `fef31907de007d6925259b3fd98192bbefcfae2a4158b9a1438cbed7ff3a603b` |
| Round 9 Opus final manifest | `b2d23e8da8a7f84b6820682cfb5b9c95ceaf20567d9ef4d8ae57ab767e652a8f` |
| Review-routing amendment | `874e66cf3af2dd8dc7956db73e35a3fcd7030f4bd92fb4fdc9196bf624e295f6` |

Round 9 Codex approved correction 1 at 97 and Round 9 Opus independently
approved the same digest at 87, both with zero defects. Correction 1 remains
frozen and is not reviewed or changed by this packet.

## Frozen scope

| Item | Status here |
|---|---|
| M1 correction 1 - dispatch response, identity, and P0/P1/P2 classification | `PRESERVED_UNCHANGED` |
| M1 correction 3 - Q1-neutral approver predicate/posture | `OPEN_UNCHANGED` |
| M1 correction 4 - preflight retrieval authorization and threat surface | `OPEN_UNCHANGED` |
| M1 correction 5 - provider-side review-comment normalization fixture | `OPEN_UNCHANGED` |
| M2, M3, M4, M5, M6, M7 | `OPEN_UNCHANGED` |
| Q1, Q2, Q3 | `OPEN_UNCHANGED` |

The authentication and abuse controls for the earlier `preflight-summary`
retrieval endpoint remain correction 4. Correction 2 relies only on the
retrieved packet's broker signature for integrity and adds no answer to how
that earlier request is authorized.

## Closed `AudienceSeedV1` handoff

After correction 1 has durably bound the dispatch-returned run ID, the broker
derives this non-secret packet from the signed `ReleaseEnvelopeV2` package and
the durable approval-request/dispatch journal:

```text
AudienceSeedV1 = {
  schema: "kstack-audience-seed/v1",
  releaseId,
  dispatchAttemptId,
  binding: <the exact Round 3 binding object>,
  keyGeneration,
  signature
}
```

The signature is domain-separated over the RFC 8785 canonical bytes of every
field except `signature`. The signed binding contains no credential. It is
bounded in size and encoded once as base64url-without-padding canonical bytes
plus a detached signature. `preflight-summary` emits those exact bytes as one
bounded `needs` output after its inherited signature/digest checks; it does not
reconstruct or edit fields. Output transport is not a trust boundary.

After the environment opens, `approval-evidence`:

1. decodes exactly one packet with a closed schema, duplicate-key rejection,
   size limit, and no unknown authority fields;
2. verifies the domain separator, broker signature, pinned public key and key
   generation, and exact canonical re-encoding;
3. checks `releaseId` and `dispatchAttemptId` against its closed workflow inputs
   and checks the seed's native-capable values against the immutable GitHub job
   context available before token issuance;
4. computes the Round 3 `aud` byte-for-byte from `binding`; and
5. requests one GitHub OIDC token with that exact audience.

Missing, altered, duplicate, oversized, wrongly signed, or non-canonical seed
data prevents token submission. The seed is an availability aid for requesting
the expected audience; the broker still rebuilds every value independently.

## Authoritative reconstruction of every binding member

The broker verifies the token signature, exact issuer, allowed algorithm/key,
time, and native claim types before accepting any claim as evidence. It may use
the already broker-signed seed selectors to locate one protected record, but no
seed field authorizes until the independent checks below pass.

| Binding member | Authoritative broker source | Required independent equality |
|---|---|---|
| `brokerAudience` | protected broker service ID frozen into the signed release package | exact current enrolled service ID; never accepted from an unsigned field |
| `envelopeDigest` | digest of the broker-held RFC 8785 `ReleaseEnvelopeV2`, covered by the broker signature | exact full digest under the inherited qualifying-review comment predicate |
| `environmentId` | numeric ID in the signed release package and approval-request intent | exact numeric ID in the selected `GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals` environment record; there is no claimed native numeric environment-ID field |
| `environmentName` | exact name in the signed release package | exact name in that same review record and exact native OIDC `environment` string |
| `nonce` | fresh nonce in the signed release package and durable intent | exact unused broker replay-state value; consumed with native `jti` only after the full evidence record passes |
| `operation` | broker-selected closed literal `present-approval` | exact literal; the submitted request cannot override it |
| `protocol` | broker-selected closed literal `kstack-release-oidc/v1` | exact literal and schema version |
| `repositoryId` | numeric repository ID in the signed release package and validated correction-1 identity tuple | exact native OIDC `repository_id`; review request path uses the same bound repository |
| `runAttempt` | broker constant integer `1` for M1 | exact native OIDC `run_attempt == 1` |
| `runId` | correction-1 dispatch-response ID durably bound to the intent | exact native OIDC `run_id` and exact review-request path run ID |
| `summaryDigest` | digest of the deterministic signed-envelope summary, covered by the broker signature | exact broker-held signed summary digest; mutable displayed text is not reread as authority |
| `workflowSha` | pinned SHA in the signed release package and durable intent | exact native OIDC `workflow_sha` |

`environmentId` thus has two authoritative numeric sources: the broker-signed
expected value and the exact selected provider review record for the bound run.
The native OIDC `environment` string supplies an independent check on its paired
name, not its numeric ID. Right-name/wrong-ID, right-ID/wrong-name, multiple or
missing environments, malformed numeric ID, or native-name mismatch rejects.

The broker constructs a fresh in-memory binding only from the table above,
applies RFC 8785 JCS, and computes the inherited
`"kstack-release:v1:" + BASE64URL_NOPAD(SHA256(UTF8(binding)))`. It requires
byte equality with the verified token's single `aud`. It never hashes or adopts
the submitted seed's binding as its authoritative preimage. Any field mismatch,
extra JWT audience, source absence, canonicalization difference, or provider-
read ambiguity prevents `M1_APPROVAL_EVIDENCE_VALID`.

## Closed evidence request

`approval-evidence` sends one bounded JSON object containing only:

```text
{
  "audienceSeed": <exact verified AudienceSeedV1 canonical bytes and signature>,
  "oidcToken": <one GitHub OIDC JWT>,
  "schema": "kstack-approval-evidence-request/v1"
}
```

Unknown or duplicate members, wrong types, invalid encoding, oversized values,
and multiple seeds or tokens reject before lookup. There is no separate
environment ID/name, envelope/summary digest, nonce, operation, repository ID,
run ID/attempt, workflow SHA, reviewer, callback, audience override, or general
payload. The signed seed's `releaseId` and `dispatchAttemptId` select exactly one
existing durable intent; the broker signature is verified before those selectors
are used. The broker then reloads the canonical release package and journal and
reconstructs rather than trusting the seed binding.

The broker obtains review history by the correction-1-bound repository and run
ID, never a job-supplied path. Correction 3 may later change qualifying-review
cardinality; correction 2 only requires the exact record selected by that
inherited/future predicate to carry the matching environment ID/name and digest
comment.

## Native-claim boundary

The only GitHub-native fields claimed by this correction are documented `iss`,
`aud`, `sub`, `repository_id`, `run_id`, `run_attempt`, `workflow_sha`,
`environment`, `jti`, `iat`, `nbf`, and `exp`. `actor_id` is retained only as
initiator context and never as reviewer identity.

KStack does not claim native `environmentId`, `envelopeDigest`,
`summaryDigest`, `nonce`, `operation`, `protocol`, `brokerAudience`, reviewer,
review comment, release ID, or dispatch-attempt fields. These remain broker or
review-record values indirectly bound by the caller-selected `aud`; none is a
sibling JWT claim or customized `sub` component.

## Least-privilege permission table

| Principal/component | Required permission | All other authority |
|---|---|---|
| `preflight-summary` handoff | no GitHub permission is added by correction 2 | remains governed by open correction 4 |
| `approval-evidence` job | `id-token: write` only | every configurable repository scope is `none` |
| broker evidence reader | `Actions: read` and required repository metadata read | no write or environment-administration scope |
| inherited dispatch adapter | separate `Actions: write` scope for the closed dispatch operation | never exposed to either workflow job |
| broker verifier | read official issuer JWKS and protected local records | no provider, target, or Jira mutation |

The gated job performs no checkout or GitHub REST read. Its only outbound calls
are the GitHub OIDC endpoint and the fixed enrolled broker evidence endpoint.
It receives no stored broker, provider, target, or Jira authentication material.
The broker evidence reader is separately narrowed from the dispatch adapter and
has no `Deployments: write` permission.

For `approval-evidence`, "every configurable repository scope" is exact:
`actions`, `attestations`, `checks`, `contents`, `deployments`, `discussions`,
`issues`, `models`, `packages`, `pages`, `pull-requests`, `repository-projects`,
`security-events`, `statuses`, and every future scope default to `none`; only
`id-token` is `write`. A newly introduced scope cannot become enabled by default.

## Trust and failure rules

- A valid broker signature proves only that the seed was emitted by the broker;
  independent reconstruction determines whether it is current and applicable.
- A signed seed for another release, attempt, run, environment, repository,
  workflow, nonce, or key generation is rejected.
- Unverified JWT data never selects an issuer, JWKS origin, repository path, or
  provider authority. Parsed selectors may only nominate one already signed
  candidate; complete verification must follow.
- The review response is bounded, typed, duplicate-safe, and digested. Missing,
  multiple, malformed, or unavailable records cannot be replaced by pending-
  deployment data, snapshots, job context, or seed fields.
- Definite signature, schema, claim, or equality failure returns the inherited
  invalid result. Provider, JWKS, or read ambiguity returns the inherited
  ambiguous result. Neither permits target or Jira mutation.
- The `{nonce,jti}` pair is consumed only after every comparison and the durable
  signed M1 receipt succeeds. Seed, token, nonce, and rerun replay stay invalid.

## Threat-model delta

| Threat | Control | Fail-closed result |
|---|---|---|
| Job input supplies `environmentId` | job has no independent field; broker uses signed expected ID plus exact review record | invalid or ambiguous, never valid |
| `needs` output is altered | job verifies canonical bytes and broker signature; broker independently rebuilds | no submission or broker rejection |
| Valid seed is replayed for another run | journal, native run/repository/workflow/environment claims, nonce, and review path all agree | invalid |
| Job invents a KStack JWT claim | verifier permits only the documented native set and one exact `aud` | invalid |
| Job submits alternate preimage data | closed request contains only signed seed and token; broker rebuilds all members | rejection or audience mismatch |
| Environment ID is name-confused | signed numeric ID equals review ID while native name equals signed/review name | invalid on disagreement |
| Gated job attempts repository/provider access | only OIDC minting is enabled; repository scopes are all disabled | provider operation denied |
| Evidence reader attempts approval | read-only Actions scope and no deployment-write scope | review operation denied |
| Job and broker canonicalization differ | golden RFC 8785 bytes and exact reconstructed audience equality | denial, never alternate authority |

## Required fixtures

1. Golden canonical seed and binding bytes produce the exact expected custom
   audience in both job and broker implementations.
2. Each binding member is changed alone in a correctly signed seed while the
   protected release/journal sources remain fixed; the broker reconstruction
   rejects every mismatch.
3. `environmentId` covers matching ID/name, right name/wrong ID, right ID/wrong
   name, missing/malformed/multiple review environments, and native environment-
   name mismatch. Only the exact three-source agreement can pass.
4. Altered signature, key generation, canonical encoding, selectors, duplicate
   keys, unknown fields, oversized seed/request, and multiple tokens reject.
5. Every documented native claim is type/equality tested; every named non-native
   pseudo-claim and an extra audience value reject.
6. The gated job's effective permission manifest has only `id-token: write`;
   private-repository Actions/contents/deployment reads and all writes are denied.
   The broker read adapter can read exact review history but cannot approve a
   deployment or administer an environment.
7. Provider-read/JWKS ambiguity, signed-seed reuse, token reuse, `{nonce,jti}`
   replay, and run attempt greater than one never yield valid evidence.
8. A compromised job submits a valid seed/token plus every prohibited alternate
   selector or preimage field; the closed request rejects rather than adopting it.

These are correction-2 additions to the inherited deterministic and target
staging suite, not activation evidence. The enrolled target remains
`TARGET_FIXTURE_NOT_YET_QUALIFIED`; all inherited Round 3 provider fixtures also
remain mandatory. Correction 4 must separately close preflight retrieval
authorization before the composed M1 design can qualify.

## Rollback and Codex-only review request

If this correction fails, discard this candidate and retain validated
correction 1 plus correction 2 as open. Do not alter corrections 3-5, M2-M7, or
Q1-Q3. No code, workflow, provider/Jira state, or configuration changes here.

Codex must review only correction 2 and return decision, confidence, failed
checks, security findings, material dissent, and required unresolved questions.
Approval requires **84 or higher** with zero failed checks, zero security
findings, zero material dissent, and zero required unresolved questions.

Explicitly confirm that every audience member has an authoritative source and
independent equality check; `environmentId` is broker-signed and review-record-
verified but is not claimed native; the job sends only the signed seed and one
token; the broker independently reconstructs canonical bytes; permissions are
least-privilege; correction 1 remains digest
`7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523`;
all frozen items remain open; and `TARGET_FIXTURE_NOT_YET_QUALIFIED` remains.

This packet does not dispatch Codex or Claude, implement code, or authorize any
action outside correction 2.
