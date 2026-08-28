# Encrypted Credential Repository: ECR-TC06B transition authority and lifecycle design

| Field | Bound value |
| --- | --- |
| Status | **DESIGN CANDIDATE / REVIEW REQUIRED / NOT IMPLEMENTED** |
| Thread | `encrypted-credential-repository-2026-08-27` |
| Isolated item | `ECR-TC06B / transition subject validity and current authority only` |
| Deliberate boundary | `No approval redemption, lease, attempt reservation, budget consumption, transaction execution, erasure, broker, or audit mechanism` |
| Review route | Codex-only until a separately authorized closure review |
| Governing owner artifact SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| TC01 closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| TC02 closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| TC03 closure SHA-256 | `6d562b5473ef5965272a4400b95b1f29977b11fb06b0ab6b9893adf630b70438` |
| TC04 closure SHA-256 | `0759ded9c92165b8d3455b659f0bef5fbf839af9d906223e41b574b1b83081c1` |
| TC05 candidate SHA-256 | `3d38ee883d89405cbf0b275ebeb1ec117a8883092d53fbb5b9fbe1550a5d8968` |
| TC05 generated-bound manifest SHA-256 | `e640293c47525f3c9b86674d28fbce81e95bc44b125ecaa70c56c81bb84f0dea` |
| Closed TC06A SHA-256 | `2f438db8a2f177bc44fcd5fc1f956158286027291c3300d8735882e9e2214fd9` |

## 1. Why this is the next bounded item

TC06A closes current head selection and authenticated transition-history replay,
but states that transition authority and the lifecycle matrix are the next
isolated TC06 item. TC05 already reserves the transaction-source branch
`["TC06_LATER", tc06-authority-ref-v1]` and the digest domain/schema
`ECR.TC06Authority/1`, while explicitly making that branch unusable until TC06
closes it. The next work is therefore a pure, fail-closed decision over one exact
proposed head transition. It is not transaction execution.

This slice also records a pre-existing composition limit instead of hiding it:
TC02's only eligible decision requires `TC06_ENTRY_CURRENT`, and TC06A makes that
predicate true only for an `ACTIVE` selected head. Consequently the existing
closed TC02 route could support an authority-current decision only for a
transition whose parent is active after a canonical PreparedAction binding
closes. It cannot authorize `CREATE` from proven absence,
`RESUME` from suspended state, or `TOMBSTONE` from revoked state. Those rows remain
structurally defined but authority-unavailable until a separately reviewed TC02
mutation-source-currentness route closes. A denied decision, a fabricated active
head, predecessor fallback, or direct owner/model statement cannot bridge that
gap.

If any governing digest changes, this candidate is stale. TC05 remains a
provisional prerequisite and no runtime qualification is claimed.

## 2. Authority boundary and nonclaims

This file defines two internal Booleans:

1. `TC06_ENTRY_TRANSITION_SUBJECT_VALID` means one canonical proposed transition
   obeys the closed lifecycle and binding matrix below.
2. `TC06_TRANSITION_AUTHORITY_CURRENT` means that same subject is bound to
   one exact, still-current TC02 authority path and every authority-current input
   available in this slice.

Neither Boolean is `ALLOW`, mutation permission, a lease, a reservation, a TC05
transaction source, or a `tc06-authority-ref-v1`. A true authority-current result
is only `ELIGIBLE_FOR_TRANSITION_PREREQUISITE_PREPARATION`. The final
`ECR.TC06Authority/1` body remains nonserializable because TC03 explicitly keeps
`lease_ref` nonserializable until its owner closes, and the approval-redemption,
budget-consumption, attempt-reservation, audit-readiness, and mutation-fence
mechanisms remain unresolved. This file does not guess those schemas.

It authorizes no implementation, dependency installation, credential or envelope
open, protected-value read, key/nonce generation, head/index creation, state
change, provider/custody call, lease, approval redemption, budget debit, attempt
reservation, erasure, TC05 intent/effect, commit, push, deployment, publication,
or activation.

## 3. Imported exact meanings

The following are imported without redefinition:

- TC02 principals, `AuthorityRequestV1`, `AuthorityDecisionV1`,
  `ApprovalEvidenceV1`, `ServiceAuthorityV1`, portable-production downgrade,
  authority-path matrix, exact action digest, complete epoch vector, trusted
  time, policy precedence, safe projection, and attempt states;
- TC03 canonical CBOR, exact typed references, SHA-256 domains, stored-envelope
  predecessor rules, and the fact that `lease_ref` is not yet serializable;
- TC04/TC05 qualified protected views, immutable generations, complete read
  sets, writer fencing, exact transaction graph, rollback/fork anchor, and the
  currently unusable `TC06_LATER` transaction-source branch; and
- TC06A `EntryHeadV1`, current selection, state values, reverse-admission
  witness, complete transition replay, terminal fence, and
  `TC06_ENTRY_TRANSITION_VALID` for already-admitted history.

No imported type is widened, normalized, inferred, or made optional here.

## 4. Closed transition subject

The subject is protected, attempt-local control metadata. It contains no raw
credential, ciphertext, wrapped key, label, URL, command, model text, provider
response, or free-form reason. It is canonicalized only after every referenced
body has passed bounded admission and relational validation.

The following CDDL is normative. Fields occur exactly once in shown order.
Unknown, missing, duplicate, null, coerced, indefinite, noncanonical, overbound,
or trailing values fail before lookup, hashing, policy evaluation, or provider
work.

```cddl
entry-transition-subject-digest-ref-v1 =
  [1, 2, "ECR-D1/TRANSITION-SUBJECT",
    "ECR.EntryTransitionSubject/1", sha256-v1]

entry-transition-kind-v1 = 1 / 2 / 3 / 4 / 5 / 6
; 1=CREATE, 2=ROTATE, 3=SUSPEND, 4=RESUME, 5=REVOKE, 6=TOMBSTONE

maybe-entry-transition-parent-v1 =
  [state: 0] /
  [state: 1,
    parent_head_ref: entry-head-ref-v1,
    parent_head_canonical_length: uint .le 1048576,
    parent_head_state: 1..4,
    parent_head_sequence: uint63,
    parent_entry_version: uint63,
    parent_envelope_ref: maybe-stored-entry-envelope-ref-v1]

entry-transition-successor-v1 = [
  successor_head_ref: entry-head-ref-v1,
  successor_head_canonical_length: uint .le 1048576,
  successor_head_state: 1..4,
  successor_head_sequence: uint63,
  successor_entry_version: uint63,
  successor_envelope_ref: maybe-stored-entry-envelope-ref-v1,
  successor_prior_head_ref: maybe-entry-head-ref-v1,
  successor_prior_envelope_ref: maybe-stored-entry-envelope-ref-v1
]

entry-transition-subject-v1 = [
  "ECR.EntryTransitionSubject/1", 1,
  transition_id: bstr .size 16,
  transition_kind: entry-transition-kind-v1,
  store_ref: store-ref-v1,
  repository_ref: repository-ref-v1,
  environment_ref: environment-ref-v1,
  entry_ref: entry-ref-v1,
  parent_generation: uint63,
  parent_manifest_ref: store-generation-manifest-ref-v1,
  parent_admission_root_ref: store-admission-root-ref-v1,
  parent_anchor_observation_ref: read-set-anchor-observation-ref-v1,
  parent_index_state: maybe-entry-head-index-state-v1,
  parent: maybe-entry-transition-parent-v1,
  proposed_generation: uint63,
  proposed_index_ref: entry-head-index-ref-v1,
  proposed_index_canonical_length: uint .le 1048576,
  successor: entry-transition-successor-v1,
  parent_epoch_vector_ref: epoch-vector-object-ref-v1,
  successor_epoch_vector_ref: epoch-vector-object-ref-v1,
  qualified_tuple_ref: qualified-tuple-ref-v1
]
```

`transition_id` is independently random and unique. It is not an attempt ID,
transaction ID, digest, clock value, authority, or idempotency key. The subject
does not contain the later TC05 transaction ID, effect ref, intent ref, lease ref,
budget consumption record, or audit receipt. This avoids a digest cycle with the
future `TC06_LATER` source and avoids serializing schemas that have not closed.

`TC06_ENTRY_TRANSITION_SUBJECT_VALID` receives the admitted canonical subject
body and one claimed `entry-transition-subject-digest-ref-v1`. It encodes the
body once, hashes those exact bytes once, reconstructs that typed transition-
subject ref, and compares only that ref to the claimed ref. It never reads or
compares a PreparedAction or request action ref. The transition-subject ref is
deliberately not TC03's `action-digest-ref-v1`, whose frozen domain/schema is
`ECR-D1/ACTION`/`ECR.PreparedAction/1`. A later independently closed
`ECR.PreparedAction/1` body must contain one exact `subject_ref` field equal to
this reconstructed transition-subject ref and must commit every request action
dimension without an edge back from the subject to the request,
decision, attempt, or prepared action. Until that body closes, the TC02 exact
action binding is unavailable and authority-current is always false. Re-tagging
subject bytes as `ECR.PreparedAction/1`, using a generic digest, or hashing a
partial subject is invalid.

On success the reconstructed transition-subject ref is retained only as an
attempt-local protected intermediate for the authority-current evaluation and
then discarded. It is not a third result, caller projection, stored object,
handle, authority token, audit field, or mutation permission.

The subject intentionally contains no authority request, decision, approval,
service authority, portable-risk, attempt, lease, budget, complete-read-set,
prepared-action, transaction-intent, or transaction-effect reference. Those
current facts bind the already-computed subject from outside it.

### 4.1 Exact acyclic construction and reference order

The symbol `A < B` below means A's complete canonical bytes and typed reference
are fixed before B is constructed; it does not reverse reference direction. The
only permitted construction order is:

`TransitionSubject < PreparedAction < AuthorityRequest < AuthorityDecision <
TC06Authority < StoreReadSet < StoreEffect < StoreTransactionIntent`.

The exact reference edges are closed:

1. PreparedAction names the typed transition-subject ref; the subject names none
   of PreparedAction, request, decision, authority, read set, effect, or intent.
2. AuthorityRequest names the PreparedAction action ref. AuthorityDecision names
   that exact request and freezes TC02's exact evaluated decision inputs; it does
   not name itself or any later TC06/TC05 node.
3. TC06Authority names the exact subject, PreparedAction, request, decision,
   authority-path, writer-fence, parent/proposed-generation, transition ID,
   attempt, epoch, lease, budget, time, and qualification inputs required by its
   later closed schema. It contains no complete-read-set, effect, intent,
   receipt, history, manifest, admission-root, or anchor-successor ref.
4. StoreReadSet is then reconstructed from the writer-fenced parent state. It
   authenticates the exact parent generation, admission root, manifest, anchor,
   object-index root, sole live EntryHeadIndex, selected parent head or absence,
   and other TC05-required current bodies. It contains no prospective
   TC06Authority, effect, intent, receipt, history, or successor ref.
5. StoreEffect is then constructed for the same transaction ID, parent/proposed
   generation, writer fence, and subject. Its descriptor closure names the exact
   TC06Authority body and permitted successor bodies. It contains no intent,
   read-set, receipt, history, manifest, or admission-root ref.
6. `StoreTransactionIntentV1` is constructed last. Its one `TC06_LATER` source
   names the exact TC06Authority ref, `complete_read_set_ref` names the exact
   StoreReadSet, and `effect_ref` names the exact StoreEffect. All duplicated
   store, transaction ID, parent/proposed generation, writer fence, subject-bound
   facts, allocation, and anchor values byte-equal. It is never constructed with
   placeholders and patched after hashing.

After intent construction, TC05 alone constructs its exact history, receipt,
proof mappings, manifest, admission root, and anchor publication in its frozen
order. No later body may add a reverse edge to the intent from authority, read
set, or effect. Self-edges, two-node or longer cycles, forward references,
same-digest cross-schema substitution, another transaction/attempt/parent,
duplicate source branches, or `ORDINARY_TC02` substituted for `TC06_LATER`
invalidate the graph before intent admission.

Before those later objects exist, the qualified protected view reconstructs the
same parent facts without serializing a final StoreReadSet. `parent_index_state`
and `parent` must be the same facts reconstructed by that view. The proposed index is
the one canonical successor index body that selects the successor head and
retains every unrelated mapping byte-for-byte. A second index/head for this
entry, unselected successor, scan/filename assertion, or another generation
fails subject validity. A missing/extra/substituted later read-set member fails
StoreReadSet and final-intent admission after authority construction.

## 5. Closed lifecycle matrix

Every successor is a distinct canonical head whose `entry_ref`, store,
repository, environment, repository domain, domain key/generation, qualified
tuple, successor epoch vector, and effective expiry obey TC06A equality and
current policy. `proposed_generation = parent_generation + 1` without overflow.
The successor head's immutable creation generation equals proposed generation;
its sequence is predecessor-plus-one except for CREATE. The successor index and
head are one proposed atomic replacement under the same writer fence and
complete read set.

Only these rows are structurally valid:

| Kind | Parent | Successor | Version and envelope | Extra rule |
| --- | --- | --- | --- | --- |
| `CREATE` | Authenticated absent index lookup and complete reachable set contains no head for this entry | `ACTIVE`, sequence `1` | Version `1`; one new live envelope; both prior refs absent | Parent branch is absent; successor and index are unique |
| `ROTATE` | `ACTIVE` selected head `P` | `ACTIVE`, sequence `P.sequence+1` | Version `P.version+1`; new envelope distinct from all prior envelopes; prior head/envelope equal P | Rotation creates new CEK/IV/version under TC03; no ciphertext reuse or relabel |
| `SUSPEND` | `ACTIVE` selected head `P` | `SUSPENDED`, sequence `P.sequence+1` | Same version and exact same envelope; prior refs equal P | No payload or expiry change is combined with suspension |
| `RESUME` | `SUSPENDED` selected head `P` | `ACTIVE`, sequence `P.sequence+1` | Same version and exact same envelope; prior refs equal P | No payload, expiry, or epoch weakening is combined with resume |
| `REVOKE` | `ACTIVE` or `SUSPENDED` selected head `P` | `REVOKED`, sequence `P.sequence+1` | Same version and exact same envelope; prior refs equal P | Revocation increments every affected restriction epoch atomically; no resume follows |
| `TOMBSTONE` | `REVOKED` selected head `P` | `TOMBSTONED`, sequence `P.sequence+1` | Same version; selected envelope absent; prior head/envelope equal P | Requires separately qualified destruction/retention evidence before authority can close |

For TC06A replay, CREATE maps exactly to transition kind `CREATE`; ROTATE,
SUSPEND, RESUME, REVOKE, and TOMBSTONE each map to TC06A kind `REPLACE` and must
pass that kind's complete atomic successor rules. `UNCHANGED` is never a
caller-requested lifecycle action; it is reconstructed only when another exact
TC05 transaction advances the store without changing this entry.

All other combinations are invalid, including active-to-tombstone, suspend plus
rotation, resume plus rotation, revocation plus new payload, same-version payload
replacement, version jump, unchanged/no-op successor, successor equal to parent,
reused `head_id`, sibling, fork, missing predecessor, envelope rollback,
cross-entry/store/environment change, revoked-to-active, revoked-to-rotate,
tombstone successor, restored prior head/envelope, and CREATE over any historical
or live head for that entry.

CREATE and ROTATE require the new envelope, successor head, and successor index
to be proposed for the same generation and later admitted by one exact TC05
effect. Each transition kind maps to one separately registered, qualified typed
`operation_ref`; zero, duplicate, generic, aliased, or kind-mismatched operation
registrations fail authority-current. This file does not assign registry IDs.

For every row, including CREATE over a pre-authorized opaque entry ref, the
parent complete epoch vector byte-equals the request/decision protected current
vector and contains exactly one applicable `(RESTRICTION, ENTRY, entry-id, E)`.
The successor increments that member to `E+1` without overflow. Every other
member and ordering byte-equals the parent vector. A
missing, duplicate, lower, higher, max-only, scalar, aggregate, reordered, or
combined unrelated epoch mutation invalidates the subject. The successor head's
epoch digest/vector refs byte-equal the successor vector. This fences every old
approval, prepared action, lease, cache, and attempt from crossing a transition.

SUSPEND, RESUME, and REVOKE preserve the predecessor envelope, envelope-created
generation, selected version, domain generation, scope, tuple, and effective
expiry exactly. TOMBSTONE preserves those non-envelope facts and effective
expiry while changing selected-envelope presence only as shown. ROTATE binds a
fresh envelope created in the proposed generation and may change expiry only as
explicitly authorized by the exact action subject and current policy.

The later TC05 `TC06_MUTATION` effect is single-transition only. Its complete
descriptor/body closure may contain the successor head, successor index,
successor epoch vector, a new envelope only for CREATE/ROTATE, the final
TC06-authority body, and only TC05 fields already frozen inside StoreEffect. It
contains no StoreTransactionIntent ref/body/descriptor, no complete-read-set,
receipt, history, manifest, or admission-root ref, and no
second head/index/vector/envelope for this entry, no unrelated entry mutation,
policy change, custody change, provider action, audit action, or hidden payload.
Every superseded live descriptor becomes historical and every exact successor
becomes live in that one generation. Extra or missing effect content invalidates
the subject-to-effect reconciliation before StoreTransactionIntent construction
or commit.

`REVOKE` is a restriction and cannot be delayed behind an allow, service budget,
lease, cached currentness, or existing prepared action. The transition itself is
still an authorized mutation; detecting a separately authenticated emergency
restriction may fence use immediately, but persisting the head requires the later
mutation mechanisms. `TOMBSTONE` does not prove erasure merely by dropping an
envelope reference. If exact destruction evidence is absent or its schema is not
closed, tombstone authority is unavailable.

## 6. Deterministic predicates and current route

### 6.1 `TC06_ENTRY_TRANSITION_SUBJECT_VALID`

Evaluate in this exact order:

1. Admit all outer byte/item/depth/count bounds and canonical field forms before
   retaining a protected body.
2. Resolve the exact parent TC05 generation/root/manifest/anchor/index state
   under one immutable attempt-bound qualified view. Do not construct or accept
   the later StoreReadSet here.
3. Reconstruct parent presence/absence; reject duplicate, stale, historical,
   cross-generation, or scan-selected state.
4. Validate proposed-generation arithmetic and unique successor index/head
   atomicity.
5. Apply the exact lifecycle row, predecessor, sequence, version, envelope,
   epoch, domain, expiry, and scope equality.
6. Reconstruct the complete subject, encode once, hash once under
   `ECR-D1/TRANSITION-SUBJECT`/`ECR.EntryTransitionSubject/1`, reconstruct the
   typed transition-subject ref, and compare only that ref to the claimed
   transition-subject ref. A mismatch is false. PreparedAction bytes, action refs,
   and request action refs are not inputs to this predicate.

Success is `true` with no failure. Every failure is internally
`false/ECR_TC06_TRANSITION_SUBJECT_INVALID` and externally preserves TC02's
observation-equivalent `DENIED`; no finer lifecycle or existence fact escapes.

### 6.2 `TC06_TRANSITION_AUTHORITY_CURRENT`

This result can be true only when all of the following are true in order:

1. outer byte/count/depth admission and canonical schema checks pass for the
   subject and every required current body; canonicalize the subject once,
   reconstruct its typed transition-subject ref, and compare only that ref to
   the claimed transition-subject ref before retaining the immutable subject
   snapshot and ref attempt-locally;
2. one independently closed canonical `ECR.PreparedAction/1` resolves and its
   `subject_ref` byte-equals the reconstructed typed transition-subject ref.
   Independently canonical-encode that complete PreparedAction once, hash those
   exact bytes once under frozen
   `ECR-D1/ACTION`/`ECR.PreparedAction/1`, reconstruct its
   `action-digest-ref-v1`, and compare that action ref byte-for-byte only to
   `AuthorityRequestV1.exact_action_digest_ref`. Then the exact request and
   decision bodies resolve canonically, match their typed refs, authenticate the
   caller/host, pass every non-waivable hard denial, and bind that
   action ref, caller principal/session,
   repository, environment, entry, target, typed lifecycle operation, adapter,
   output policy, attempt, parent epoch vector, and qualified tuple;
3. the decision is `ELIGIBLE_FOR_LATER_PREPARATION`, has a current `FRESH`
   attempt binding, and contains its exact frozen later-stage requirement row;
   `TC06_ENTRY_CURRENT` is freshly true for the exact parent head, the terminal
   TC06A view byte-equals the subject parent, and no possible-effect,
   rollback/fork, quarantine, or stale-generation condition exists;
4. repository/environment/profile baselines, explicit denies, owner scope, and
   restrictive policy intersection all pass exactly;
5. `TC06_ENTRY_TRANSITION_SUBJECT_VALID` is true; this composed evaluation uses
   the exact immutable subject snapshot and reconstructed ref retained by step 1
   and never encodes or hashes the subject a second time;
6. the selected authority branch is exclusive and current: human approval
   evidence is exact, unexpired, unredeemed, current-epoch, and principal/session
   bound, or service authority is exact, active, unexpired, worker-bound,
   receipt-bound, finite-budget-bound, and linked to the one matching owner scope
   and service profile;
   a portable-production downgrade reference is present exactly when TC02
   requires it and remains active, unexpired, exact-scope, exact-epoch, and bound
   to the owner-approved `PORTABLE_CUSTODY_RESIDUAL_ONLY` risk readback; it waives
   no transition predicate;
7. the subject's parent/successor epoch relation passes, every current
   policy/restriction/principal/repository/environment/entry/
   service/adapter/downgrade epoch byte-equals the complete protected current
   vector, and trusted time remains within every exclusive bound; and
8. a terminal fresh qualified view byte-rechecks all preceding fields and no
   current state, authority, epoch, time, qualification, or attempt fact drifted.

The human branch may not borrow service budget; the service branch requires its
exact finite `budget_ref` but this item neither defines nor consumes budget. An
unavailable budget-current result makes service authority false. Approval text,
prompt assent, repository content, a prior decision, a stale service record, a
model-generated risk acknowledgement, or owner identity alone is not evidence.

Because no canonical `ECR.PreparedAction/1` body is closed, every transition is
authority-unavailable under the current record. Once that acyclic binding closes,
TC02 eligibility's active `TC06_ENTRY_CURRENT` requirement permits this Boolean
only for `ROTATE`, `SUSPEND`, and `REVOKE` from an active parent. `CREATE`,
`RESUME`, and `TOMBSTONE` remain false even when structurally valid. They require a separately
reviewed TC02 result/requirements row bound to authenticated transition-source
absence or non-active currentness. This file does not name or encode that future
row.

Success is `true` with no failure and means only current authority evidence was
validated. Every failure is `false/ECR_TC06_TRANSITION_AUTHORITY_NOT_CURRENT`
with TC02's safe external denial. Failure ordering is: bounds/schema;
authentication/hard denials; rollback/fork/current-state and possible-effect;
scope/profile/explicit deny; lifecycle subject; authority-path composition;
epoch/time/budget; terminal drift; internal fail-closed. The first class stops;
all classes have the same safe projection.

## 7. TOCTOU, concurrency, and later mutation gates

The authority-current terminal fence reopens a newly observed qualified view and
byte-compares request, decision, authority path, portable risk acknowledgement,
parent generation/root/anchor/index/head, canonical subject body and reconstructed
typed subject ref, canonical PreparedAction body and reconstructed action ref,
PreparedAction `subject_ref`, request exact-action ref, the qualified parent-state
projection from which the later StoreReadSet must be constructed, attempt effect
state, both epoch vectors, trusted-time evidence, budget reference and
status, and qualified tuple. Any mutation before the final tuple read denies.
The linearization point is that final parent generation/root/anchor tuple read;
this pure result has no effect afterward.

A later mutation path must still close and atomically perform, in this order:

1. exact approval redemption or service-authority revalidation;
2. finite budget reservation/consumption when applicable;
3. one nontransferable mutation lease under a frozen serializable schema;
4. transition attempt reservation and possible-effect fencing;
5. current audit readiness;
6. a second currentness/authority/epoch/time fence under the acquired writer
   fence;
7. construct and freeze final `ECR.TC06Authority/1` from only the already-frozen
   subject/PreparedAction/request/decision and current prerequisite inputs; it
   has no read-set, effect, or intent ref;
8. construct and freeze the complete StoreReadSet from the exact writer-fenced
   parent view; it has no prospective authority, effect, or intent ref;
9. construct and freeze StoreEffect from the exact transaction/fence plus the
   authority and permitted successor bodies; it has no intent or read-set ref;
10. construct StoreTransactionIntent last with the exact `TC06_LATER` authority,
    complete-read-set, and effect refs, rejecting any substitute or back-edge;
    and
11. allow TC05 alone to construct later transaction evidence and attempt its
    atomic commit plus safe audit/effect-state handoff.

This ordering is a requirement, not a mechanism. Timeout, crash, or output loss
after possible mutation is ambiguous and never blindly retries. A changed parent
generation invalidates the subject; it is not patched to the new parent.

## 8. Resource, privacy, and fail-before-work rules

The initial profile caps one subject at 1,048,576 canonical bytes, one parent and
one successor head, one parent and one successor index, one complete read set,
at most 256 read-set members, and parser depth/item/pair maxima generated from
the closed CDDL. Exact generated `Max`, `Meta`, and `Record` rows are a TC10
prerequisite. Equality passes; one byte/item above a bound fails before full copy,
decode, protected resolution, lookup, canonicalization, hashing, policy work, or
provider work. Unknown arithmetic or missing generated rows is unavailable.

The subject, heads, indexes, approval/service/risk evidence, epoch vectors,
budgets, and failure detail are protected metadata. They never enter Git, Jira,
logs, prompts, model context, ordinary stdout/stderr, exception text, telemetry,
or filenames. Production output is one fixed safe Boolean/projection; diagnostics
may retain only bounded internal codes. Unknown, unauthorized, revoked,
cross-scope, malformed, and valid probes must have qualified observation-
equivalent output, external-call shape, and mutation count. This item performs
zero network/provider/custody/broker/action calls and zero mutation.

## 9. Deterministic evidence and tests

All fixtures are synthetic and disposable. Passing them grants no runtime or
production qualification.

| ID | Required deterministic evidence |
| --- | --- |
| `TC06B-ST01-SchemaClosure` | Positive canonical subject plus missing/extra/duplicate/null/wrong-order/wrong-tag/wrong-domain/indefinite/trailing/deep/overbound corpus for every field and tagged branch; independent encoder/verifier produce identical bytes/digest. |
| `TC06B-ST02-LifecycleMatrix` | Exercise every parent/successor state pair for CREATE/ROTATE/SUSPEND/RESUME/REVOKE/TOMBSTONE. Only the six exact rows pass structural validity; combined transitions, no-op, jumps, resurrection, active tombstone, and tombstone successor fail. |
| `TC06B-ST03-SubjectIdentity` | Mutate each subject parent generation/root/manifest/anchor/index/head, proposed index/head, sequence/version/envelope/prior ref, scope, domain, epoch, expiry, or tuple ref; retain the old claimed transition-subject ref, then recompute only the typed transition-subject ref. Every mutation/old-ref mismatch denies inside subject validity without reading PreparedAction or request bytes. |
| `TC06B-ST03A-EffectClosure` | Add/remove/replace/reorder a successor head, index, epoch vector, CREATE/ROTATE envelope, authority body, or frozen StoreEffect field; batch another entry/policy/custody/provider/audit mutation; inject intent/read-set/later-evidence content; leave a predecessor live; or admit an unselected object. Every variant fails before intent construction or commit. |
| `TC06B-ST03B-PreparedActionIdentity` | Starting from one matching subject ref, mutate each canonical PreparedAction field or its `subject_ref` while retaining the old action ref; each stale action ref denies. Then recompute the action ref and update only the request action ref: a changed `subject_ref` denies by subject-ref inequality, and another changed action dimension denies by exact PreparedAction/request/subject relational binding, without changing subject-validity. |
| `TC06B-ST03C-RequestActionRef` | Keep canonical subject and PreparedAction bytes/ref fixed, then replace only `AuthorityRequestV1.exact_action_digest_ref` with another valid action ref. Exact action-ref inequality denies; no subject ref is compared to the request field. |
| `TC06B-ST03D-DomainSeparation` | Retag subject bytes/ref as `ECR-D1/ACTION`/`ECR.PreparedAction/1`, retag PreparedAction bytes/ref as `ECR-D1/TRANSITION-SUBJECT`/`ECR.EntryTransitionSubject/1`, substitute a generic digest, or present equal SHA-256 payloads under opposite tags. Every substitution denies before payload equality can contribute. |
| `TC06B-ST03E-ExternalBindings` | Independently mutate each request/decision/attempt ref, operation registration, authority path, or tuple relation while subject and PreparedAction identities remain fixed; each denies authority-current. After authority construction, mutate each constructed read-set member; each denies StoreReadSet/final-intent admission. |
| `TC06B-ST04-AuthorityPaths` | Under the current record every path stays false because PreparedAction binding is unclosed. Future fixtures must show exact human-current, durable-nonproduction, and service paths over active ROTATE/SUSPEND/REVOKE can reach authority-current only after that binding closes; both paths, zero service path, cross-host approval, stale/redeemed approval, wrong worker/receipt/budget/expiry/policy link, and model assent fail. |
| `TC06B-ST05-BlockedRoutes` | Valid CREATE, suspended RESUME, and revoked TOMBSTONE remain false under the current TC02 eligible matrix. A denied TC02 decision, fake active head, predecessor fallback, ordinary transaction source, owner text, and direct `TC06_LATER` source never substitute. |
| `TC06B-ST06-PortableRisk` | Exact current portable-production downgrade and risk readback only satisfy that one custody residual-risk predicate. Missing/expired/wrong-scope/wrong-class/model-generated evidence fails; it never waives authority, currentness, rollback, output, audit, destruction, or ambiguity. |
| `TC06B-ST07-EpochBudgetTime` | Missing/extra/duplicate/lower/higher/max-only epochs; absent/unavailable/negative/overflowed/exhausted service budget; and not-before/expiry equality, stale time, boot reset/wrap, or continuity loss each fail closed with no debit. |
| `TC06B-ST08-TOCTOU` | Mutate every subject/currentness/authority/risk/attempt/epoch/time/budget/tuple field between initial validation and terminal reread; each schedule denies before construction. Then, after each exact freeze, mutate TC06Authority, StoreReadSet, or StoreEffect before intent construction, or mutate any of the four after intent hashing; stale typed refs deny and no node is patched/rehashed toward success. All schedules perform zero TC05 commit or provider call. |
| `TC06B-ST09-Bounds` | `MAX-1`, `MAX`, `MAX+1` for bytes/items/pairs/depth/read members and checked generation/sequence/version arithmetic. Oversize/overflow fails before allocation, traversal, hash, or lookup. |
| `TC06B-ST10-Privacy` | Interleave unknown, cross-scope, invalid, revoked, blocked-route, and valid synthetic probes under cold/warm/fault conditions; output shape, safe code, external calls, timing class, and mutation remain equivalent, and all surfaces scan clean. |
| `TC06B-ST11-NoAuthority` | Feed both true Booleans to a caller without closed approval redemption, lease, budget consumption, attempt reservation, audit readiness, final TC06 authority body, and TC05 commit. Result remains later-stage-required; no ref, handle, transaction, or protected value is returned. |
| `TC06B-ST12-GraphDirection` | Construct canonical nodes only in exact order Subject -> PreparedAction -> Request -> Decision -> TC06Authority -> StoreReadSet -> StoreEffect -> StoreTransactionIntent. Verify the intent is last and names exactly that authority/read-set/effect triple; the unmodified acyclic graph alone passes structural planning. Until final schemas close, `TC06_LATER` remains unusable. |
| `TC06B-ST12A-ForbiddenReverseEdges` | Inject an intent ref/body/descriptor into TC06Authority, StoreReadSet, or StoreEffect; an effect/read-set ref into TC06Authority; an effect/authority-successor ref into StoreReadSet; or a receipt/history/manifest/root successor ref into any pre-intent node. Every reverse/forward edge rejects before intent admission. |
| `TC06B-ST12B-CyclesAndAliases` | Add a self-edge, two-node or longer cycle, authority->effect->authority, read-set->intent->read-set, effect->intent->effect, duplicate node, same SHA-256 under another schema/domain, generic digest alias, or partial-body hash. Every graph rejects before semantic equality or commit. |
| `TC06B-ST12C-ReferenceSubstitution` | In the final intent substitute authority, read set, or effect from another store, transaction, attempt, parent/proposed generation, writer fence, subject, or decision; duplicate a source branch; use `ORDINARY_TC02`; or mismatch one duplicated transaction/fence/allocation/anchor value. Every substitution rejects. |
| `TC06B-ST12D-ConstructionOrder` | Try constructing intent before authority/read-set/effect, hashing placeholders and patching them later, constructing effect before authority, or reconstructing a prior node after a descendant hash exists. Exact snapshots cannot be patched; every permutation rejects. |

Qualification requires checked-in canonical fixtures, independent generator and
verifier, exact manifest ordering and SHA-256, negative-result ledger,
allocation/high-water traces, TOCTOU schedule, cross-platform canonical vectors,
and a privacy content scan. None exists or passes in this design item.

## 10. Remaining blockers and next item

Design closure requires digest-bound Codex review at 93 or higher with zero
failed checks, security findings, material dissent, unresolved questions, or
design-changing objections.

Runtime and final `ECR.TC06Authority/1` serialization remain blocked on:

1. TC03 registration of the exact transition-subject digest domain/schema plus a
   canonical, acyclic `ECR.PreparedAction/1` body and exact
   `action-digest-ref-v1` binding to that subject;
2. a separately reviewed TC02 mutation-source-currentness route for authenticated
   absence and non-active current heads, without weakening ordinary use
   currentness;
3. exact approval redemption and durable-approval consumption semantics;
4. a serializable mutation-lease schema and acquire/consume/release state machine;
5. attempt reservation and possible-effect state transition mechanics for TC06
   mutation;
6. finite service-budget schema, arithmetic, reservation, debit, refund, and
   crash semantics;
7. qualified tombstone destruction/retention evidence and its TC09 handoff;
8. safe audit-readiness and receipt interface; and
9. acyclic final `ECR.TC06Authority/1` body plus TC05 schema-registry/object-kind,
   read-set, bounds, and transaction-source reconciliation.

The next permitted bite-size design item is approval redemption plus transition
attempt reservation, or the TC02 mutation-source-currentness addendum if that is
scheduled first. Neither may be inferred from this candidate.

## 11. Owner-decision check and internal audit

No owner decision is required. Locked Q1-Q10 already establish machine/service
scope, no model reveal, exact repository/environment separation, current human or
exact service authority, portable-custody risk acknowledgement, unattended
production bounds, destructive migration ceremony, and fail-closed production.
Whether a specific service profile may perform ROTATE, SUSPEND, REVOKE, or a
future TOMBSTONE is not a new global choice: the existing owner policy must name
that exact typed operation, target, worker, budget, expiry, and receipt. Absence
denies.

- TC06A is unchanged.
- The exact next unresolved TC06 topic is isolated.
- Lifecycle structural rows are complete and closed; authority availability is
  not overstated.
- Actor, approval, service authority, portable risk acknowledgement, attempt,
  epoch, budget, lease, audit, and destruction prerequisites are referenced
  without inventing their unresolved mechanisms.
- No fallback from absent/non-active state to a fake eligible TC02 decision is
  permitted.
- Known TC06B-scoped failed checks: `0`.
- Known TC06B-scoped security findings: `0`.
- TC06B-scoped material dissent: `0`.
- TC06B-scoped unresolved owner questions: `0`.
- F1 identity-separation repair failed checks/security findings/dissent/questions:
  `0/0/0/0`; F1 author score **97/100**, confidence **97%**.
- F2 acyclic TC05 construction-order repair failed checks/security findings/
  dissent/questions: `0/0/0/0`; F2 author score **97/100**, confidence **97%**.
- Internal author score: **95/100**, confidence **95%**. The deduction is for
  independent review and the explicitly blocked prerequisite slices, not an
  unreported authority claim.
