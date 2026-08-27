# Release Automation + Jira M1 correction 3: approver posture

**Thread:** `release-automation-jira-2026-08-26`  
**Item:** M1 correction 3 only - approver cardinality and `prevent_self_review`  
**Status:** `OWNER-LOCKED-DESIGN-CANDIDATE`  
**Runtime:** `TARGET_FIXTURE_NOT_YET_QUALIFIED`  
**Review:** configured OpenAI Codex only; no Opus

This correction resolves only M1 correction 3. M1 corrections 1, 2, 4, and 5
and M2-M7 remain frozen. Nothing here authorizes implementation, external
mutation, deployment, rollback, commit, push, or publication.

## Bound decision

The owner answered **Yes** to `M1-Q1` on 2026-08-27: one operator may request a
release locally and approve it as the qualified GitHub Environment reviewer
when the provider-visible approval binds the complete envelope digest. The
receipt must say `single-operator`; it makes no two-person or separation-of-duty
claim. Organizations may instead configure authenticated local-to-GitHub
identity mapping and distinct-reviewer enforcement. An agent or the broker
cannot perform, impersonate, or manufacture the human approval.

| Bound source | SHA-256 |
|---|---|
| M1 corrected candidate | `825790d6e612ae1fecc1aedfc4ad67db14fd92d7f2a5888e30d8d93afb0730ad` |
| M1 provider evidence | `5ddd2ce422ddead918c863a37475538db21eddf2026814cbb73db35018a9c448` |
| Review isolating M1-FC4 | `48d46e65da29273fedd56b5ddabef74f6a65315c4b7fc202e7d9ce3b0682e12b` |
| Option E owner lock | `b5a5dec1d4e063a7896249f20d2c3a2694a148a20f83670645dd5505df21c6f7` |

## Locked posture table

Each enrolled production target freezes exactly one protected, signed posture
before its request envelope is frozen.

| Posture | GitHub approval records | Expected `prevent_self_review` | Identity rule | Receipt truth |
|---|---:|---:|---|---|
| `single-operator` | exactly 1 | `false` | The authenticated local requester may be the qualifying reviewer. No cross-namespace identity proof is required. | `single-operator`; `separationOfDutyClaimed:false` |
| `distinct-reviewer` | exactly 1 | `true` | Protected mapping must prove requester and reviewer are different people. | `distinct-reviewer`; `separationOfDutyClaimed:true` only after every predicate passes |

The `single-operator` label describes the permitted assurance posture, not a
claim that only one person participated. `distinct-reviewer` means one local
requester plus one distinct GitHub approver, not two GitHub approvals.

The posture, expected Boolean, required approval count, reviewer-allowlist
digest, and optional identity-mapping digest are bound into the signed envelope
and OIDC audience preimage. Jira text, workflow inputs, branches, comments, or
mutable environment state cannot select them.

## Identity and authority predicates

1. The local request records an authenticated `requesterPrincipalId`; display
   names and email strings are not authority identities.
2. GitHub review history supplies the numeric `reviewerUserId`; login is
   display-only. The signed, exact-run OIDC token supplies the numeric
   `actor_id` of the provider workflow initiator. All inherited M1 predicates
   remain required: exact run and environment, approved state, byte-exact full
   envelope-digest comment, protected reviewer allowlist, and bound OIDC
   evidence. The two provider-authenticated numeric IDs must differ in both
   postures; malformed, missing, or equal IDs deny.
3. `single-operator` permits requester/reviewer equality and claims no mapping
   equality, inequality, or human separation. Native IDs are still recorded.
4. `distinct-reviewer` uses a protected, authenticated, versioned, signed,
   envelope-digest-bound, one-to-one mapping from both native identities to
   stable person IDs. Missing, ambiguous, non-injective, stale, expired,
   revoked, changed, or duplicate mappings deny. The two person IDs must differ.
5. The broker/agent can request and observe approval but cannot call GitHub's
   approval endpoint, hold an approval-capable user token, provide the human
   comment, or convert missing approval to success. Its dispatch identity is
   not a human approver.
6. `prevent_self_review` concerns GitHub's workflow initiator. Its configured
   value is checked and receipted as defense-in-depth but is not authority
   evidence: two equal snapshots cannot prove it remained enabled when approval
   occurred. KStack independently enforces
   `reviewerUserId != workflowInitiatorActorId` from the bound provider records.
   Only the separate protected requester/reviewer mapping and person-ID
   inequality support the `distinct-reviewer` claim.

## Total selection rule

Derive `qualifying` from bounded, typed review-history records using every
inherited M1 predicate, then apply:

```text
malformed required record or conflicting approval -> APPROVAL_EVIDENCE_INVALID
count(qualifying) != 1                         -> APPROVER_CARDINALITY_INVALID
reviewerUserId == workflowInitiatorActorId      -> PROVIDER_SELF_REVIEW_INVALID
single-operator and prevent_self_review != false -> APPROVAL_POSTURE_INVALID
distinct-reviewer and prevent_self_review != true -> APPROVAL_POSTURE_INVALID
distinct-reviewer mapping failure or same person -> APPROVER_DISTINCTION_INVALID
unknown posture                                -> APPROVAL_POSTURE_INVALID
otherwise                                      -> accept exactly one record
```

The environment is read immediately before dispatch and again before token
issue. Environment ID/name, required-reviewer rule, reviewer allowlist,
admin-bypass-disabled posture, and expected `prevent_self_review` value must
match protected expectations on both reads. Missing, malformed, unequal, or
unavailable evidence denies. Equal snapshots do not prove no transient change
and this design does not claim otherwise. The actual review, protected
configuration, digest comment, OIDC binding, and independently enforced
provider-actor inequality remain authority evidence. A transient
disable/approve/restore cannot enable provider self-review because the same
initiator/reviewer ID is denied independently; it cannot create the
`distinct-reviewer` claim because that additionally requires the protected
local-requester/reviewer person-ID inequality.

Zero or multiple qualifying records fail cardinality. Conflicting, rejected,
malformed, wrong-comment, or wrong-environment records fail closed; a later
clean record cannot erase a conflict in the same request.

## Receipt delta

The signed M1 receipt adds only `approvalPosture`,
`requiredApprovalCount:1`, expected/observed `preventSelfReview`, native
requester/reviewer IDs, the OIDC `workflowInitiatorActorId`, the result of the
provider-actor inequality, and `separationOfDutyClaimed`. Mapping digest and
mapped person IDs are populated only for `distinct-reviewer`, otherwise
explicit `null`. The receipt describes `preventSelfReview` as observed
defense-in-depth and never claims it was continuously effective at approval.
Existing signing, redaction, privacy, retention, and anchoring rules
remain frozen. Tokens, credentials, raw provider bodies, email addresses, and
display names do not enter public/Jira projections.

## Required fixtures and claim boundary

Target qualification must test both successful postures and deny on wrong
Boolean, zero/multiple/conflicting records, digest mismatch, requester/reviewer
substitution, same-person aliases, invalid mapping lifecycle or injectivity,
post-freeze configuration change, and broker/agent approval attempts. A
deterministic disable/approve/restore fixture must show that a review by the
same provider `actor_id` is denied despite equal before/after snapshots. A
second transient fixture with a different provider reviewer must prove that no
separation-of-duty claim is emitted without the independent protected
requester/reviewer person mapping and inequality. Receipt
serialization and Jira projection must preserve posture truth without leaking
mapping assertions. Missing human approval must never issue an operation token.

No such runtime fixture ran for this design. Closure requires an exact-file
Codex review at confidence >=93 with zero failed checks, security findings,
dissent, and questions. A clean result is `VALIDATED-DESIGN-ONLY`; runtime stays
`TARGET_FIXTURE_NOT_YET_QUALIFIED` until all inherited and added fixtures pass.
