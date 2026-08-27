# Domain breadth D1 - authenticated out-of-band identity

**Parent item:** D1 authenticated identity for selection, weakening/waiver,
and activation  
**Owner decision:** DOMAIN-Q1 = Yes  
**Route:** Codex-only, supplied-packet-only review; no Opus  
**Scope:** identity authenticity and exact action binding only; D3 separately
owns second-party distinctness and quorum

## Locked owner boundary

Pack selection, required-pack waiver or policy weakening, and catalog
activation require authenticated out-of-band principals and attestations.
Ordinary repository collaborators remain in the threat model. Required-pack
waivers and policy weakening additionally require an independent second party,
whose distinctness rules are owned by D3.

## Trust root and adapters

KStack setup creates an `IdentityTrustRootV1` outside the repository worktree
and protects it with the existing KStack broker/owner boundary. Its closed
record binds:

```text
{
  artifactType: "kstack-identity-trust-root",
  schemaVersion: 1,
  projectId,
  repositoryImmutableId,
  adapters: [{ adapterId, adapterVersion, trustMaterialDigest,
               allowedProviderPrincipalIds, allowedActions }],
  policyVersion,
  createdAt
}
```

Repository files may reference `trustRootDigest` but cannot define, replace,
or extend this record. A missing, unreadable, changed, repository-resident, or
unsupported trust root returns `IDENTITY_TRUST_ROOT_UNAVAILABLE`. Adapter
qualification fixes provider protocol, endpoint identity, response schema,
authentication source, freshness inputs, canonicalization, negative fixtures,
and version. Unknown adapters and versions fail closed.

V1 qualifies a GitHub protected-review adapter. An optional signature adapter
may be added only by an independent qualification; its absence is not a
fallback to repository strings.

## Canonical action request

Before identity verification, the operation owner freezes:

```text
IdentityActionRequestV1 = {
  artifactType: "kstack-identity-action-request",
  schemaVersion: 1,
  projectId,
  repositoryImmutableId,
  action: "pack-selection" | "required-pack-waiver" |
          "policy-weakening" | "catalog-activation",
  targetDigest,
  policyDigest,
  nonce,
  notBefore,
  expiresAt
}

requestDigest = SHA256(
  UTF8("KSTACK-IDENTITY-ACTION-REQUEST-V1\n") || canonicalV1(request)
)
```

`canonicalV1` is closed and rejects duplicate/unknown keys, alternate
encodings, invalid UTF-8, noncanonical time, unknown actions, non-32-byte
digests, and a nonce outside 128..256 bits. D2 supplies the exact
`selectionDigest` for selection; D3 supplies the exact weakening/waiver target;
D5 supplies the exact activation snapshot digest. The action request cannot
contain an actor assertion, secret, mutable branch, path, tag, latest
reference, or provider response.

## GitHub protected-review adapter

1. A fixed path containing the exact canonical action-request bytes is added
   to a candidate commit. The adapter is given immutable GitHub repository ID,
   pull-request number, candidate commit OID, fixed artifact path, and expected
   `requestDigest`; no branch name is accepted as identity.
2. Through authentication available only to the KStack broker, the adapter
   performs authenticated read-only GitHub API calls over verified TLS and
   captures the provider response bytes. It verifies repository immutable ID,
   PR head OID, artifact Git blob bytes and digest, base-branch protection or
   ruleset, review state, review commit OID, provider principal numeric ID, and
   that the external trust root allowlists the principal for the requested
   action. Login, display name, email, repository permission strings, and
   self-authored fields are not identity proof.
3. The review must be `APPROVED`, not dismissed or stale, and bind the
   candidate commit containing the exact request. A later head change,
   dismissal, force-push, repository transfer/ID mismatch, changed ruleset, API
   ambiguity, pagination truncation, missing field, rate-limit/incomplete
   response, or authentication/TLS failure blocks verification.
4. The adapter never trusts the candidate commit for policy or allowlists. It
   obtains action authorization solely from the external trust root and the
   authenticated provider principal ID. D3 may impose a distinct-principal
   requirement over multiple individually valid D1 receipts.

## Verification receipt and replay boundary

On success the broker emits a closed `IdentityVerificationReceiptV1`:

```text
{
  artifactType: "kstack-identity-verification-receipt",
  schemaVersion: 1,
  projectId,
  repositoryImmutableId,
  action,
  requestDigest,
  targetDigest,
  trustRootDigest,
  adapterId,
  adapterVersion,
  providerPrincipalId,
  providerRepositoryId,
  providerObjectId,
  providerCommitOid,
  providerEvidenceDigest,
  rulesetEvidenceDigest,
  verifiedAt,
  expiresAt,
  nonce
}
```

The receipt digest uses
`"KSTACK-IDENTITY-VERIFICATION-RECEIPT-V1\n" || canonicalV1(receipt)`.
The broker stores provider evidence and the receipt in the operation-bound
inventory, then atomically consumes `(projectId, action, nonce, requestDigest)`
before an action may use it. Reuse, action substitution, target substitution,
project/repository mismatch, expiry, rollback of the broker consumption
ledger, or receipt/evidence mismatch returns a closed identity error with no
selection acceptance, waiver, activation, composition, or dispatch receipt.
D8 owns trusted-time and clock-rollback evaluation; absent qualified time
blocks rather than extending validity.

The receipt contains no authentication material. Provider responses are
reduced to their closed admitted fields before retention, while the digest
binds the validated raw response held in protected evidence storage.

## Threat boundary

An ordinary repository collaborator can change repository files, author
commits, invent names, and replay repository bytes, but cannot change the
external trust root, forge authenticated GitHub provider state, satisfy the
principal allowlist, or mark a nonce consumed in the protected broker ledger.
Compromise of GitHub, an allowlisted principal, broker/root, or external trust
root is disclosed as outside D1's claim and requires revocation/incident
handling; no repository fallback is permitted.

## Deterministic verification

- Golden vectors fix action-request and receipt canonical bytes and digests.
- Mutate action, target, policy, nonce, time, project, repository ID, commit,
  fixed-path blob, principal, review state, trust root, ruleset, or evidence;
  reject before effect.
- Try a fabricated `selectedBy`, login-name collision, repository-owned
  allowlist, approval on an earlier commit, dismissed approval, force-pushed
  head, transferred repository, partial/paginated response, or unknown adapter;
  reject.
- Replay one valid receipt for another action, target, project, or repository,
  or reuse its nonce concurrently; exactly one atomic consumption may succeed.
- Remove provider access, trusted time, broker protection, or external trust
  root; return the named unavailable outcome and emit no success receipt.

## Review request

Review only whether this design closes D1 identity authenticity and exact
action binding against ordinary repository collaborators. Do not require D3's
separate quorum/distinctness algorithm here. Report current concrete defects
only. Closure requires confidence >=93 and zero failed checks, security
findings, material dissent, and unresolved questions.
