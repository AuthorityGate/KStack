# Domain breadth D3 - separation of duty for weakening

**Parent item:** D3 policy weakening, downgrade, and quarantine separation of
duty  
**Prerequisite:** D1 digest
`4947151d6d5ac746330b2c04f9669725700a8a43c0494edd6b6e2e04a5ebd1e7`
is preserved  
**Owner decision:** DOMAIN-Q1 = Yes  
**Route:** Codex-only, supplied-packet-only review; no Opus

## Scope and invariant

No one authenticated principal, repository collaborator, agent, service
identity, or model may waive a required pack, weaken its governing policy,
downgrade a catalog snapshot, or reverse quarantine. Every such action requires
two individually valid D1 identity receipts for the exact same action request:
one `requester` and one `independent-approver`. They must resolve through the
external trust boundary to two different natural-person subjects in two
different independence groups. Gridlock blocks; no reviewer or advisory model
has a deciding vote.

## External separation policy

The broker-protected, repository-external `SeparationPolicyV1` binds:

```text
{
  artifactType: "kstack-separation-policy",
  schemaVersion: 1,
  projectId,
  repositoryImmutableId,
  principals: [{ adapterId, providerPrincipalId, personSubjectId,
                 independenceGroupId, eligibleRoles, status }],
  actions: [{ action, requiredRoles: ["requester", "independent-approver"],
              minimumDistinctPeople: 2, minimumDistinctGroups: 2 }],
  policyVersion,
  effectiveAt
}
```

`personSubjectId` and `independenceGroupId` are enrollment-time identifiers
attested through the owner/broker boundary, not names or repository fields.
Each admitted principal is `active`, is explicitly eligible for only its
listed roles/actions, and is bound to a qualified D1 adapter. Missing,
ambiguous, duplicated, expired, disabled, repository-resident, or changed
policy fails closed. Changes to this policy are themselves a
`policy-weakening` action under the last valid policy; an initial trust setup
requires the existing owner/broker ceremony and grants no pack action by
itself.

## Weakening classification and exact target

Every proposed policy transition is parsed under a closed versioned schema and
compared as canonical sets. It is weakening if it removes, renames, narrows,
reclassifies, disables, or makes optional a required pack or lane; reduces a
reviewer, threshold, evidence, freshness, security, authority, rollback, or
retention requirement; changes a closed failure to continue/degrade; extends
or broadens a waiver; activates an older snapshot; or reverses quarantine.
Unknown fields, unknown semantic equivalence, parse failure, or classifier
version mismatch classify as weakening, never neutral.

The canonical `WeakeningRequestV1` contains:

```text
{
  artifactType: "kstack-weakening-request",
  schemaVersion: 1,
  projectId,
  repositoryImmutableId,
  action: "required-pack-waiver" | "policy-weakening" |
          "catalog-downgrade" | "quarantine-reversal",
  beforeDigest,
  afterDigest,
  affectedPackIds,
  classifierVersion,
  classifierReceiptDigest,
  reasonCode,
  notBefore,
  expiresAt,
  nonce
}
```

`weakeningRequestDigest` uses
`"KSTACK-WEAKENING-REQUEST-V1\n" || canonicalV1(request)`. The D1 action
request's `targetDigest` is exactly this digest and its `policyDigest` is the
current `SeparationPolicyV1` digest. No ID, path, branch, tag, latest pointer,
free-form actor, or future policy version can substitute for these exact bytes.

## Quorum verification

The broker resolves both D1 receipts from one operation-bound inventory and:

1. Recomputes each receipt and its provider evidence; requires identical
   project, repository, action, D1 request digest, weakening target digest,
   separation-policy digest, validity interval, and nonce domain.
2. Resolves both provider principal IDs through the exact external separation
   policy. It requires one eligible requester and one eligible independent
   approver, unequal provider principal IDs, unequal `personSubjectId` values,
   and unequal `independenceGroupId` values. A team, role, email, username,
   agent, bot, model, or service account cannot stand in for a person record.
3. Revalidates at consumption that both provider approvals remain current,
   neither principal is revoked, the candidate commit/head and exact request
   bytes remain unchanged, the applicable provider ruleset remains effective,
   and D8 trusted time places both receipts inside their intersection interval.
   Any intervening change restarts verification; it does not preserve one vote.
4. Atomically consumes both D1 receipt nonces and the tuple
   `(projectId, weakeningRequestDigest, separationPolicyDigest)`. Partial
   consumption is rolled back before returning a failure; concurrent consumers
   cannot split or reuse the pair.

Only then may the broker emit:

```text
WeakeningAuthorizationV1 = {
  artifactType: "kstack-weakening-authorization",
  schemaVersion: 1,
  projectId,
  repositoryImmutableId,
  weakeningRequestDigest,
  separationPolicyDigest,
  requesterReceiptDigest,
  independentApproverReceiptDigest,
  requesterPersonSubjectId,
  approverPersonSubjectId,
  authorizedAt,
  expiresAt,
  consumptionId
}
```

Its digest is domain-separated by
`"KSTACK-WEAKENING-AUTHORIZATION-V1\n"`. The downstream transition must
compare `beforeDigest` with its guarded live state and use compare-and-swap to
install only `afterDigest`; drift yields `WEAKENING_TARGET_STALE`. A waiver is
scoped only to its exact affected packs/action and validity interval. Renewal,
extension, widening, reuse for another repository, or application to another
before/after pair requires a new request and two new receipts.

## No bypass and failure behavior

- Editing repository policy instead of creating a waiver still enters this
  classifier and quorum path. There is no repository-local neutral override.
- A catalog downgrade or quarantine reversal cannot travel through ordinary
  catalog activation. D5 must require this authorization digest in addition to
  its normal activation identity receipt.
- One-person or one-independence-group repositories cannot satisfy the rule;
  the result is `INDEPENDENT_SECOND_PARTY_UNAVAILABLE`, not self-approval,
  timeout approval, lower quorum, or model arbitration.
- Provider outage, ambiguous independence, revoked principal, stale approval,
  incomplete pagination, time failure, receipt disagreement, or broker-ledger
  rollback emits no authorization and no downstream success receipt.
- There is no break-glass path in this design. A future relaxation requires a
  new explicit owner decision and independent review; repository text cannot
  create it.

## Deterministic verification

- Golden vectors fix classifier inputs, weakening request, paired receipts,
  authorization bytes, and all digests.
- Exercise every weakening category plus unknown/invalid transitions; each
  requires the two-party path.
- Use two accounts mapped to one person, two principals in one independence
  group, requester twice, bot/service identities, swapped roles, one revoked
  vote, approval on an earlier commit, changed ruleset, expired intersection,
  and partial provider data; reject.
- Race policy/head/revocation/live-before-digest changes against terminal
  consumption; either one fully revalidated pair succeeds or none does.
- Attempt waiver widening/renewal, downgrade through ordinary activation,
  quarantine reversal without authorization, repository-local allowlist
  replacement, or replay across repositories; reject before state mutation.

## Review request

Review only whether this design closes D3's independent-second-party,
policy-bypass, downgrade, quarantine, and replay defects while preserving D1.
Report current concrete defects only. Closure requires confidence >=93 with
zero failed checks, security findings, material dissent, and unresolved
questions.
