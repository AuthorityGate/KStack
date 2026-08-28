# Encrypted Credential Repository: ECR-TC06A entry-currentness design

| Field | Bound value |
| --- | --- |
| Status | **DESIGN CANDIDATE / REVIEW REQUIRED / NOT IMPLEMENTED** |
| Thread | `encrypted-credential-repository-2026-08-27` |
| Isolated item | `ECR-TC06A / TC06_ENTRY_CURRENT only` |
| Repair scope | `F3 only: bounded transition admission replay; closed F1/F2 preserved` |
| Review route | Codex-only until a separately authorized closure review |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| TC01 closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| TC02 closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| TC03 closure SHA-256 | `6d562b5473ef5965272a4400b95b1f29977b11fb06b0ab6b9893adf630b70438` |
| TC04 closure SHA-256 | `0759ded9c92165b8d3455b659f0bef5fbf839af9d906223e41b574b1b83081c1` |
| TC05 candidate SHA-256 | `3d38ee883d89405cbf0b275ebeb1ec117a8883092d53fbb5b9fbe1550a5d8968` |
| TC05 generated-bound manifest SHA-256 | `e640293c47525f3c9b86674d28fbce81e95bc44b125ecaa70c56c81bb84f0dea` |

## 1. Why this is the next bounded item

TC02 requires `TC06_ENTRY_CURRENT` before any
`ELIGIBLE_FOR_LATER_PREPARATION` decision can proceed. TC03 already binds the
entry reference, entry version, repository, environment, domain, value type,
provider/tenant/target, operation, principal, adapter, output policy, authority,
epochs, lifecycle, expiry, and predecessor into each stored envelope. TC05
supplies immutable objects, authenticated read sets, one selected generation,
rollback/fork detection, and atomic publication, but explicitly grants no entry
authority and leaves every later-owned body unavailable.

The first TC06 gap is deterministic selection and verification of the one
current entry version. Approval redemption, leases, finite budgets,
`ECR.TC06Authority/1`, rotation/revocation authorization, domain-slot creation,
broker transport, audit, recovery, and production qualification remain separate
items. Designing any of them here would recreate forbidden full-plan coupling.

If any governing digest above changes, this candidate is stale and must be
reconciled before review. TC05 has no digest-bound closure in the current chain;
its candidate and generated ledger are prerequisites, not qualified runtime
claims.

## 2. Authority boundary and nonclaims

This file defines only the canonical protected head record and the pure
`TC06_ENTRY_CURRENT` verification result. It authorizes no implementation,
dependency installation, protected-value discovery/read/import, plaintext
access, envelope open, key or nonce generation, provider/custody call, entry
creation, rotation, suspension, revocation, tombstoning, lease, approval
redemption, attempt reservation, broker action, migration, staging, commit,
push, deployment, publication, or production activation.

1. An entry head is state, not authority. Possessing its bytes or digest cannot
   create, change, revive, open, lease, reveal, export, or use an entry.
2. This slice never returns an envelope, ciphertext, protected label, entry
   existence fact, payload digest, value-derived digest, or executable handle.
3. `CURRENT` means only that exact protected state is the unique current
   selection for an already-eligible request. It does not mean `ALLOW`.
4. The model-facing projection remains TC02's closed `DENIED` or
   `LATER_STAGE_REQUIRED`; no external reason or question is added.
5. No caller path, filename, label, branch, URL, provider name, clock, cache,
   maximum epoch, or most-recent-looking object may select currentness.
6. Historical envelopes and heads remain reachable for proof but cannot be
   selected by fallback. Missing current state never falls back to a predecessor.
7. A typed reference without its complete authenticated body, read-set proof,
   selected-generation manifest, and rollback-anchor evidence is unavailable.

## 3. Imported exact meanings

The following are imported without redefinition:

- TC02 `AuthorityRequestV1`, `AuthorityDecisionV1`, `EpochVectorV1`,
  `AttemptBindingV1`, repository/environment identities, qualified tuple,
  policy precedence, reason projection, and later-requirement matrix;
- TC03 canonical CBOR, typed references, SHA-256 domains, `entry-ref-v1`,
  `stored-envelope-digest-ref-v1`, `common-bindings-v1`, value-type values `1..5`,
  lifecycle values `1..4`, tagged expiry, predecessor binding, and bounds;
- TC04 `TC04_CUSTODY_CURRENT` semantics without invoking custody; and
- TC05 current store-generation admission, authenticated read sets, index
  membership, immutable descriptors, manifest/history/receipt mapping, anchor
  observation, quarantine, and no-fallback crash classification.

Any alias that cannot byte-equal its imported definition is schema-invalid. No
generic reference, untyped digest, compatibility alias, normalization rule, or
schema negotiation is added.

## 4. Closed canonical record

The following CDDL is normative. Every field occurs exactly once in the shown
order. Unknown, missing, duplicate, null, coerced, indefinite, noncanonical,
overbound, or trailing values fail before lookup or crypto.

```cddl
entry-head-ref-v1 =
  [1, 2, "ECR-D1/ENTRY-VERSION", "ECR.EntryHead/1", sha256-v1]
entry-head-index-ref-v1 =
  [1, 2, "ECR-D1/ENTRY-VERSION", "ECR.EntryHeadIndex/1", sha256-v1]
entry-head-admission-witness-digest-v1 =
  [1, 2, "ECR-D1/DERIVED-EVIDENCE",
    "ECR.EntryHeadAdmissionWitness/1", sha256-v1]
entry-head-transition-replay-digest-v1 =
  [1, 2, "ECR-D1/DERIVED-EVIDENCE",
    "ECR.EntryHeadTransitionReplay/1", sha256-v1]
maybe-entry-head-ref-v1 = [0] / [1, entry-head-ref-v1]
maybe-stored-entry-envelope-ref-v1 =
  [0] / [1, stored-envelope-digest-ref-v1]

entry-head-state-v1 = 1 / 2 / 3 / 4
; 1=ACTIVE, 2=SUSPENDED, 3=REVOKED, 4=TOMBSTONED

entry-head-index-entry-v1 = [entry-ref-v1, entry-head-ref-v1]
entry-head-index-v1 = [
  "ECR.EntryHeadIndex/1", 1,
  store_ref: store-ref-v1,
  index_created_store_generation: uint63,
  entries: [1*4096 entry-head-index-entry-v1]
]

entry-head-v1 = [
  "ECR.EntryHead/1", 1,
  head_id: bstr .size 16,
  head_sequence: uint63,
  entry_ref: entry-ref-v1,
  store_ref: store-ref-v1,
  head_created_store_generation: uint63,
  repository_ref: repository-ref-v1,
  environment_ref: environment-ref-v1,
  repository_domain_ref: repository-domain-ref-v1,
  domain_key_ref: domain-key-ref-v1,
  domain_generation: uint63,
  selected_entry_version: uint63,
  selected_envelope_created_store_generation: uint63,
  selected_envelope_ref: maybe-stored-entry-envelope-ref-v1,
  prior_head_ref: maybe-entry-head-ref-v1,
  prior_envelope_ref: maybe-stored-entry-envelope-ref-v1,
  state: entry-head-state-v1,
  effective_expiry: maybe-utc-instant-v1,
  epoch_digest_ref: epoch-digest-ref-v1,
  complete_epoch_vector_ref: epoch-vector-object-ref-v1,
  qualified_tuple_ref: qualified-tuple-ref-v1
]

entry-head-admission-witness-v1 = [
  "ECR.EntryHeadAdmissionWitness/1", 1,
  store_ref: store-ref-v1,
  admitted_head_ref: entry-head-ref-v1,
  admitted_head_canonical_length: uint .le 1048576,
  creation_generation: uint63,
  creation_transaction_id: bstr .size 16,
  creation_effect_ref: store-effect-ref-v1,
  creation_effect_descriptor_index: uint .le 255,
  creation_head_descriptor: store-object-descriptor-v1,
  creation_intent_ref: store-intent-ref-v1,
  creation_history_ref: store-history-ref-v1,
  creation_receipt_ref: store-receipt-ref-v1,
  creation_manifest_ref: store-generation-manifest-ref-v1,
  current_generation: uint63,
  current_manifest_ref: store-generation-manifest-ref-v1,
  current_admission_root_ref: store-admission-root-ref-v1,
  current_anchor_observation_ref: read-set-anchor-observation-ref-v1,
  current_index_proof: store-object-index-proof-v1,
  current_head_leaf_index: uint .le 255,
  lineage_current_to_creation: [1*256 store-generation-manifest-ref-v1]
]

entry-head-selection-v1 =
  [state: 0] /
  [state: 1,
    selected_head_ref: entry-head-ref-v1,
    selected_head_canonical_length: uint .le 1048576,
    selected_head_descriptor: store-object-descriptor-v1,
    selected_head_store_proof: store-object-index-proof-v1,
    selected_head_leaf_index: uint .le 255]

entry-head-index-state-v1 = [
  index_ref: entry-head-index-ref-v1,
  index_canonical_length: uint .le 1048576,
  index_descriptor: store-object-descriptor-v1,
  index_store_proof: store-object-index-proof-v1,
  index_leaf_index: uint .le 255,
  selected_entry: entry-head-selection-v1
]
maybe-entry-head-index-state-v1 =
  [state: 0] / [state: 1, entry-head-index-state-v1]

maybe-effect-descriptor-binding-v1 =
  [state: 0] /
  [state: 1, descriptor_index: uint .le 255,
    descriptor: store-object-descriptor-v1]

entry-head-transition-kind-v1 = 1 / 2 / 3
; 1=UNCHANGED, 2=CREATE, 3=REPLACE

entry-head-transition-admission-witness-v1 = [
  "ECR.EntryHeadTransitionAdmissionWitness/1", 1,
  transition_ordinal: 1..256,
  transition_kind: entry-head-transition-kind-v1,
  store_ref: store-ref-v1,
  entry_ref: entry-ref-v1,
  parent_generation: uint63,
  parent_admission_root_ref: store-admission-root-ref-v1,
  parent_manifest_ref: store-generation-manifest-ref-v1,
  parent_anchor_observation_ref: read-set-anchor-observation-ref-v1,
  parent_index_state: maybe-entry-head-index-state-v1,
  admitting_generation: uint63,
  admitting_transaction_id: bstr .size 16,
  admitting_read_set_ref: complete-read-set-ref-v1,
  admitting_effect_ref: store-effect-ref-v1,
  admitting_intent_ref: store-intent-ref-v1,
  admitting_history_ref: store-history-ref-v1,
  admitting_receipt_ref: store-receipt-ref-v1,
  admitting_manifest_ref: store-generation-manifest-ref-v1,
  admitting_admission_root_ref: store-admission-root-ref-v1,
  admitting_anchor_observation_ref: read-set-anchor-observation-ref-v1,
  admitting_index_state: entry-head-index-state-v1,
  index_effect_binding: maybe-effect-descriptor-binding-v1,
  head_effect_binding: maybe-effect-descriptor-binding-v1
]

entry-head-transition-replay-v1 = [
  "ECR.EntryHeadTransitionReplay/1", 1,
  store_ref: store-ref-v1,
  entry_ref: entry-ref-v1,
  authority_decision_ref: authority-decision-ref-v1,
  attempt_binding_ref: attempt-binding-ref-v1,
  replay_parent_generation: uint63,
  replay_current_generation: uint63,
  replay_current_manifest_ref: store-generation-manifest-ref-v1,
  replay_current_admission_root_ref: store-admission-root-ref-v1,
  replay_current_anchor_observation_ref: read-set-anchor-observation-ref-v1,
  replay_selected_head_ref: entry-head-ref-v1,
  transitions_parent_to_current:
    [1*256 entry-head-transition-admission-witness-v1]
]
```

Index entries are strictly increasing by deterministic canonical bytes of the
complete `entry-ref-v1`; duplicates, aliases, two `live` index descriptors, and
an entry/head mismatch reject. The index is protected metadata selected by the
current manifest's sole `live` descriptor for this schema; older indexes remain
reachable only as `historical`. Its creation generation records provenance, not
currentness. A head update atomically makes the successor index `live` and the
predecessor `historical` in the same TC05 generation. The protected control plane
performs lookup; no model or repository can enumerate the index.

`head_id` is independently random and never derived from entry bytes, labels,
payload, ciphertext, scope, or another ID. `head_sequence` starts at `1` and is
strictly predecessor-plus-one. It is not time, insertion order, store-generation
substitute, or authority.

`head_created_store_generation` and
`selected_envelope_created_store_generation` are immutable provenance. Neither
must equal the later selected store generation. Currentness comes only from exact
membership under the current manifest and rollback anchor; otherwise every
unrelated TC05 transaction would incorrectly require rewriting every entry head.

`EntryHeadV1` contains only facts available before its admitting effect is
hashed. It contains no transaction, intent, effect, history, receipt, manifest,
admission-root, anchor, or witness digest/reference. In particular, none of
those descendant values may be smuggled through an optional field, generic
digest, descriptor, extension, or unknown key. Its canonical body hashes to
`entry-head-ref-v1` before TC05 constructs the effect that admits it.

### 4.1 Authenticated reverse admission witness

`EntryHeadAdmissionWitnessV1` is an ephemeral canonical projection built only
inside the qualified protected-metadata view. It is never a stored TC05 object,
payload descriptor, index member, caller input, authority token, or graph root.
A supplied or cached witness is untrusted; the verifier must reconstruct it from
the complete authenticated bodies on every attempt. Its typed digest is
`[1,2,"ECR-D1/DERIVED-EVIDENCE","ECR.EntryHeadAdmissionWitness/1",
SHA-256(canonical-witness-bytes)]`. That digest may identify deterministic test
evidence only. No TC05 or TC06 graph body may reference it.

The witness fields occur once in the CDDL order. `creation_effect_descriptor_index`
selects the exact zero-based descriptor in the creation effect; that descriptor
has the registered EntryHead object kind/schema, exact canonical head length,
digest payload equal to `admitted_head_ref`, lifecycle `1` (`live`), and the
permitted protected-metadata location. `current_head_leaf_index` selects the
exact zero-based leaf entry in
the terminal page of `current_index_proof`; its routing ID and complete `live`
descriptor byte-equal the currently selected head descriptor and resolve the
same canonical head. Neither index may select by label, filename, or caller data.

`lineage_current_to_creation[0]` byte-equals `current_manifest_ref`; its last
member byte-equals `creation_manifest_ref`. Each adjacent member is the exact
predecessor named by the earlier member, generations decrease by one, and the
complete canonical body of every member hashes to its typed reference. The
creation member has `generation=creation_generation`. The list has no duplicate,
fork, skip, alias, or cycle and contains at most 256 manifests. A longer lineage
is unavailable until a separately authenticated checkpoint design qualifies; it
is never truncated.

Reverse admission is true only when all resolved TC05 bodies establish this
single direction, using complete canonical-body equality:

1. canonical head bytes hash to `admitted_head_ref`, which byte-equals the head
   chosen by the current index proof;
2. the creation effect contains exactly one descriptor at the recorded index
   for that head, and its store, transaction, proposed generation, and descriptor
   set are exact;
3. the creation intent names that effect and the same transaction/generation;
4. creation history names the intent/effect and exact transaction, and creation
   receipt names that intent/effect/history tuple and identical ordered proofs;
5. creation manifest names that intent/effect/history/receipt tuple, generation,
   and exact proof mappings; the bounded successor-manifest lineage authenticates
   it from the current manifest;
6. the current admission root names the current manifest, and the independently
   qualified current anchor observation names that root/generation as `TRUSTED`;
   and
7. the witness is reconstructed from those values, canonicalized once, digested,
   and discarded after the attempt.

The only permitted digest direction is pre-effect head/proof bodies -> effect ->
intent -> history -> receipt -> creation manifest -> successor manifests ->
current admission root -> external anchor observation -> ephemeral witness.
The witness is a terminal observer: it names already-authenticated graph values,
but no graph body has a reference edge to the witness. A graph body that names
the witness or any transitive descendant, a proof that
names receipt/manifest/root/witness, a receipt/history that names its containing
manifest, an effect that admits the witness, a self-edge, a repeated node, or
any other back-edge fails the complete bounded closure walk before currentness.

For active, suspended, or revoked state, `selected_envelope_ref` is present
exactly once. A tombstone has it absent. The first head has both prior references
absent. Every later head has `prior_head_ref` and `prior_envelope_ref` present;
the latter byte-equals the predecessor's selected envelope. No successor to a
tombstone is valid.

These rules preserve history; they do not authorize a transition. Transition
authority and the complete state/version matrix are the next isolated TC06 item.
Until that item closes, no runtime may create an `EntryHeadV1`.

### 4.2 Authenticated transition admission replay

`EntryHeadTransitionAdmissionWitnessV1` and
`EntryHeadTransitionReplayV1` are ephemeral derived evidence reconstructed from
complete authenticated TC05 bodies. They are not stored objects, effect
descriptors, index members, caller input, authority, mutation permission, or
transition approval. Supplied, cached, truncated, or partially reconstructed
values are untrusted. The replay's typed digest is exactly
`[1,2,"ECR-D1/DERIVED-EVIDENCE","ECR.EntryHeadTransitionReplay/1",
SHA-256(canonical-replay-bytes)]`, may identify deterministic test evidence only,
and is discarded with the replay. No TC05 or EntryHead graph body may reference
either derived witness or its digest.
Only after every relational check succeeds is the complete replay encoded once
in the displayed field/step order and hashed once. A prefix, reordered step set,
Merkle summary, cached digest, or independently hashed step list is unequal.

Every index-state field is verified against one exact manifest. Outer state `0`
is valid only when that manifest's complete authenticated reachable-object set
contains zero `live` `EntryHeadIndexV1` descriptors. Outer state `1` requires
exactly one such descriptor, whose proof root byte-equals the manifest's object
index root and whose canonical length/digest resolve the complete ordered
`EntryHeadIndexV1`. Inner selection state `0` means exact ordered lookup finds no
`entry_ref`. Inner state `1` means exactly one entry maps to the recorded head;
the head descriptor/proof is `live` under the same manifest root, every recorded
leaf index selects the exact descriptor, and the canonical head body hashes to
the recorded typed ref. Duplicate schema descriptors, routes, entries, heads,
or aliases reject before transition evaluation.

One transition witness represents every consecutive TC05 store-generation
change, including a generation that does not change this entry. It is valid only
when all of the following hold:

1. `admitting_generation = parent_generation + 1` without overflow. The
   admitting manifest names the exact parent generation/manifest and its
   canonical body hashes to `admitting_manifest_ref`. The parent and admitting
   admission-root bodies name their respective exact generations/manifests; the
   recorded observations name those roots and are `TRUSTED` with proven
   rollback/boot continuity.
2. The admitting intent's `complete_read_set_ref` byte-equals
   `admitting_read_set_ref`. That complete read set names the recorded parent
   generation/root/manifest/anchor/object-index root and contains exact
   authenticated membership for the parent EntryHeadIndex and selected parent
   head when present. It proves absence by the complete parent index body, never
   by omitted lookup evidence, a filename, scan result, or caller assertion.
3. The effect, intent, history, receipt, proof mappings, manifest, root, and
   observations form TC05's exact transaction graph for one store and the
   recorded non-digest transaction ID. All canonical bodies, ordered proof sets,
   descriptor sets, lengths, hashes, fixed references, and mappings byte-equal;
   no partial or digest-only assertion passes.
4. Each present effect binding selects exactly one zero-based descriptor in that
   complete effect. An index binding resolves the admitting index body and an
   EntryHead binding resolves the admitting selected head. For this `entry_ref`,
   the complete effect/body scan admits no second head, no head not selected by
   the admitting index, and no second EntryHeadIndex body. Unrelated entry bodies
   may coexist but cannot alter this entry's relations. If the index ref changes,
   the index binding is mandatory and the admitting object state makes the
   parent index descriptor `historical` and the recorded successor descriptor
   `live`; if the ref is inherited, the binding is absent and that one descriptor
   remains `live`.
5. `UNCHANGED` requires present parent and admitting selections that byte-equal
   the same head, an absent head-effect binding, and zero newly admitted head
   bodies for this entry. The index binding is absent when the exact index body
   is inherited and may be present only for one replacement index whose mapping
   for this entry remains byte-identical.
6. `CREATE` is permitted only at replay ordinal `1`. The parent lookup is absent,
   the complete parent reachable-object set contains no head body for this entry,
   both effect bindings are present, and the admitting index selects exactly the
   one admitted head. That head has sequence/version `1` and both prior refs
   absent.
7. `REPLACE` requires one parent head `P` and one distinct admitting head `H`,
   both effect bindings, and no other head body for this entry in the effect.
   `H` and its `head_id` are absent from the complete parent reachable-object set;
   an earlier admitted or hidden sibling cannot be adopted later.
   The parent index selects `P`; the admitting index selects `H`; `H.prior_head_ref`
   byte-equals `P`; sequence is predecessor-plus-one; envelope predecessor and
   version/state relations pass Step 8; and the parent index becomes historical
   while the admitting index and `H` are `live` in the same transaction. A
   present-to-absent mapping, tombstone/revoked resurrection, sibling with the
   same parent, or unselected admitted successor rejects.

The replay begins with the unique `CREATE` transition immediately after a
parent generation that proves absence and ends at the terminal selected store
generation. Its store, entry, authority-decision, and attempt-binding refs
byte-equal the exact current request/decision/attempt view; replay bytes from
another attempt are never accepted or patched. Steps are in parent-to-current
order with ordinals exactly `1..N`.
Each step's parent generation/root/manifest/anchor/index state byte-equals the
preceding step's admitting state; generations are consecutive; each intermediate
admitting observation becomes the next authenticated parent observation; and
the final admitting manifest/root/anchor/index/head byte-equal the values used
by the currentness predicate and terminal fence. Every intervening store
generation is replayed, even when it is `UNCHANGED` for this entry. Thus a
hidden sibling admission, fork, skipped generation, head rollback, replaced-then-
restored head, unexpected nonadjacent duplicate transition/manifest, or alternate
branch cannot be discarded from the proof. The required adjacent state repetition
is one graph node at the step boundary, not a second admitted object.

For replay length `N`, checked arithmetic requires
`N = replay_current_generation - replay_parent_generation`, the first step's
parent generation equals `replay_parent_generation`, and the last step's
admitting generation equals `replay_current_generation`. The replay's current
manifest/root/anchor and selected-head refs byte-equal that last step and the
terminal current view. Any unequal endpoint or difference is invalid before
digest comparison.

The replay contains `1..256` transitions. A required 257th transition, missing
start or end, partial suffix, checkpoint substitution, or caller-selected
window is unavailable; the verifier never truncates toward success. A future
authenticated checkpoint may change this bound only in a separately reviewed
schema and qualification item.

The only permitted construction/digest direction is parent manifest/root/
anchor/index/head bodies plus successor head/index bodies and parent read-set
proofs -> effect -> intent -> history -> receipt -> admitting manifest ->
admitting root/anchor -> ephemeral transition witness; canonical transition
witnesses in ordinal order plus current decision/attempt bindings -> ephemeral
replay. Derived witnesses are terminal
observers and no authenticated graph body has an edge back to them. Complete
closure rejects self, descendant, reverse, cross-step back-edge, duplicate graph
node outside the required adjacent boundary equality, or cycle before either
transition validity or currentness can be true.

## 5. Deterministic `TC06_ENTRY_CURRENT` predicate

The verifier accepts only a TC02 decision whose result is
`ELIGIBLE_FOR_LATER_PREPARATION`, whose effect state is `FRESH`, and whose exact
requirements contain `TC06_ENTRY_CURRENT`. It returns one internal Boolean and
one fixed internal failure class: success is `true` with no failure, and every
denial or unavailable condition is `false/ECR_TC06_ENTRY_NOT_CURRENT`. It never
returns finer failure reasons, head bytes, or envelope bytes.

This predicate has one fail-closed input precondition: independently successful
`TC04_CUSTODY_CURRENT` and TC05 store qualification must already have produced an
immutable, bounded, attempt-bound protected-metadata view for the exact selected
generation. That view exposes only decoded bodies selected by authenticated typed
references; it is not serialized, returned to the caller, or retained after the
attempt. Defining or implementing that interface belongs to TC04/TC05. If it is
absent, stale, mutable, overbound, or not bound to this request and decision,
`TC06_ENTRY_CURRENT` is unavailable. TC06A never invokes custody, opens an
envelope, or performs provider work.

The separately named internal result `TC06_ENTRY_TRANSITION_VALID` is one
Boolean: `true` only for the complete Section 4.2 replay, otherwise
`false/ECR_TC06_ENTRY_TRANSITION_INVALID`. It carries no authority and has no
caller projection. The currentness result is the strict conjunction
`TC06_ENTRY_CURRENT = steps_1_through_7 AND TC06_ENTRY_TRANSITION_VALID AND
steps_9_through_10`. A transition-validity failure maps through the same
`false/ECR_TC06_ENTRY_NOT_CURRENT` currentness result and TC02-safe external
projection; it never creates a second observable reason.

Evaluate in this exact order:

1. **Outer bounded admission.** Admit the request, decision, selected store
   manifest, index descriptor/proof metadata, complete transition replay, and
   qualified-view handle under their registered `Record(T)` and current TC05
   phase budget before retaining a protected body. Unknown or unresolved bounds
   return `UNAVAILABLE`; no scan, custody call, crypto, or provider work begins.
2. **Selected-generation proof.** Require exact current TC05 store, generation,
   admission root, manifest, index root, `PRESENT` proof, immutable descriptor,
   body length/digest, and rollback-anchor observation. The already-qualified
   protected view must byte-bind those exact values and the current request,
   decision, and attempt. Quarantine, fork, mismatch, ambiguity, non-`TRUSTED`
   anchor, or view drift denies. Scan, cache, filename, and caller projection
   cannot substitute.
3. **Unique head selection.** The selected manifest resolves exactly one `live`
   descriptor for `EntryHeadIndexV1`; historical predecessors do not compete.
   Resolve and decode that bounded index only through the qualified protected
   view. Its ordered lookup of the request's exact `entry_ref` resolves exactly
   one head ref; resolve and decode that bounded head only through the same view.
   The head body carries that same entry ref and its descriptor is `live`.
   Zero/two live indexes, zero/two matches, duplicate routing IDs, duplicate
   entry refs, unequal descriptors, stale retained mapping, or another-generation
   proof denies without revealing whether an entry exists.
4. **Request equality.** Head entry, repository, environment, store, repository
   domain, domain key/generation, and qualified tuple byte-equal protected current
   values used by request and decision. Head/envelope creation generations remain
   immutable provenance; selected-manifest membership, not scalar equality to the
   latest generation, proves currentness. Labels and model input are never
   compared.
5. **Epoch equality.** `epoch_digest_ref` resolves to the canonical body named by
   `complete_epoch_vector_ref` and byte-equals request, decision, policies, store
   snapshot, and protected current vector. It contains exactly one current
   `(RESTRICTION, ENTRY, entry-id, epoch)` plus every applicable member. Missing,
   extra, duplicate, lower, higher, max-only, aggregate, or collapsed vectors
   deny.
6. **State gate.** State must be `ACTIVE`. Suspended, revoked, and tombstoned map
   through TC02 `REVOKED_OR_QUARANTINED` to the same external `DENIED`. Approval,
   service authority, portable downgrade, and recovery cannot override state.
7. **Reverse admission and envelope equality.** Reconstruct the complete
   `EntryHeadAdmissionWitnessV1` from the authenticated view; never accept it
   from the head or caller. Verify the unique creation-effect descriptor,
   intent/effect/history/receipt/creation-manifest tuple, at-most-256 backward
   manifest lineage from the current manifest, current root/anchor, current
   index proof, and the exact acyclic digest direction in Section 4.1. Any
   missing target, duplicate, descendant reference, forbidden edge, cycle,
   overbound lineage, or witness digest found inside the graph denies. The
   present selected envelope then has a `live` descriptor and is proved
   reachable from the same current manifest. Its canonical TC03
   `common-bindings-v1` byte-equals
   the head for store, envelope-creation generation, repository, environment,
   domain key/generation, entry/version, tuple, and expiry; and byte-equals the
   current request for provider/tenant/target, operation, principal, adapter, and
   output policy. Its stored authority request/decision/policy-set/epoch refs
   resolve and remain byte-consistent with the immutable creation transaction;
   they are historical provenance and are not substituted with the later use
   request/decision. Lifecycle is exactly `1` (`current`). The verifier does not
   open or return the envelope.
8. **Transition-validity conjunct.** Reconstruct the complete canonical Section
   4.2 replay from authenticated bodies and evaluate
   `TC06_ENTRY_TRANSITION_VALID`. Sequence `1` requires the unique `CREATE`
   transition, version `1`, absent prior references, and absent envelope
   predecessor. Every later selected head must arise from exactly one `REPLACE`
   step: sequence is predecessor-plus-one; a changed payload version is
   prior-version-plus-one and its TC03 predecessor digest byte-equals
   `prior_envelope_ref`. Same-version active/suspended/revoked heads retain the
   exact envelope; a tombstone has no selected envelope and retains the prior
   envelope only as historical proof. Gap, sibling, fork, skip, rollback,
   truncation, cycle, resurrection after revoked/tombstoned state, or a
   predecessor outside the complete admitted replay yields `false`. This proves
   admission history only; it authorizes no transition.
9. **Preliminary time gate.** A present `effective_expiry` byte-equals TC03's
   computed earliest exclusive expiry and is evaluated with the exact qualified
   TC02 trusted-time input, policy profile, skew, freshness, monotonic, suspend,
   and boot-continuity evidence bound to this decision and attempt. This check is
   preliminary only; it cannot substitute for the terminal fence below. Absent,
   stale, rollback-ambiguous, wrong-boot, continuity-lost, or over-uncertain
   evidence denies when expiry exists. File, Git, target, model, and ordinary
   wall time are forbidden.
10. **Terminal fence and atomic re-read.** Execute Section 5.1's exact terminal
    sequence through a newly observed TC05-qualified terminal current view, not
    the initial immutable view or a cache. Revalidate and byte-compare the
    trusted-time input/profile/skew/freshness/monotonic/suspend/boot evidence
    together with store generation,
    admission root, anchor, current/creation manifests and lineage, index proof,
    head and active state, creation intent/effect/history/receipt tuple,
    reconstructed admission-witness digest, reconstructed transition-replay
    digest and every step's parent/admitting graph and index state, envelope
    descriptor and expiry, complete current epoch vector, decision, and attempt.
    Drift, expiry crossing, newly
    visible revocation, stale evidence, or continuity loss denies. A restart may
    occur only under later closed attempt rules; this slice creates no attempt.

Only all ten steps yield internal `TC06_ENTRY_CURRENT=true`. Every later
predicate remains required. No partial pass, degraded mode, predecessor fallback,
cached success, or "current enough" result exists.

### 5.1 Terminal time fence and linearization

The terminal fence consumes, but does not define or acquire, TC02's qualified
time evidence. When the request/decision has a time-bound predicate or the head
has an effective expiry, the exact selected `TrustedTimeInputV1` must be present
and provides candidate UTC
interval `[C_low,C_high]`, candidate evidence monotonic observation `M_C`, boot
reference `B`, and the exact qualified policy profile and independent skew
evidence. Resolving that skew evidence produces reference interval
`[R_low,R_high]` and its exact qualified monotonic observation `M_R`. `M_C`,
`M_R`, `M_pre`, and `M_post` must share one qualified boot/counter domain;
otherwise ordering is unavailable. A qualified monotonic sample is usable here
only when its counter, resolution,
duration conversion, boot binding, reset/wrap behavior, and read ordering have
already qualified under TC10. No ordinary wall-clock reading may supply or
repair any variable below.

When neither the request/decision nor the head has any time-bound predicate, the
exact tagged absence of trusted-time input is revalidated in the terminal tuple,
steps 1 and 3--5 below perform no clock operation, and the linearization point is
still step 2's final generation/root/anchor read. A caller may not add optional
time merely to change ordering or diagnostics.

The terminal snapshot is the ephemeral ordered tuple `(M_pre, terminal current
view, final generation/root/anchor read, M_post, derived intervals/deadlines)`.
It has no serialized schema, digest, storage location, authority meaning, or
caller-visible projection and is discarded before return.

The verifier performs this closed order once:

1. Admit every terminal-fence body and arithmetic bound before retention. Capture
   `M_pre` from the qualified monotonic source and require the same `B`, no reset,
   wrap, rollback, unproven suspend, or continuity loss, and
   `M_C <= M_pre` and `M_R <= M_pre`. Revalidate both candidate and independent
   reference trust,
   source class, profile, uncertainty, skew, freshness, and continuity.
2. Obtain a new TC05-qualified terminal current-view observation through TC05's
   already-qualified local protected-metadata read boundary; this design defines
   no provider, custody, anchor-acquisition, or refresh mechanism. A cached or
   caller-supplied view is invalid, and inability to establish that the
   observation is current is unavailable. Re-read the entire Step 10 tuple from
   that observation, resolve each body by its authenticated typed reference, and
   compare it to the values used by Steps 2--9. Finish with one ordered current
   read of `(store_generation, admission_root_ref,
   anchor_observation_ref)` and require it to byte-equal the selected qualified
   tuple. TC05's immutable generations and rollback/fork checks forbid an ABA
   substitution.
3. Immediately capture `M_post` from the same qualified monotonic source and
   require the same `B`, `M_pre <= M_post`, no counter reset/wrap, and unchanged
   monotonic/freshness/skew/suspend evidence identities. Recompute evidence age,
   uncertainty, and conservative candidate/reference skew at `M_post`; both
   sources must still be `QUALIFIED_CURRENT` and within every finite profile
   maximum.
4. Using only the qualified, overflow-checked monotonic-duration conversion,
   set `Delta_C = duration(M_post - M_C)`,
   `C_terminal_low = C_low + Delta_C`, and
   `C_terminal_high = C_high + Delta_C`. Independently set
   `Delta_R = duration(M_post - M_R)`,
   `R_terminal_low = R_low + Delta_R`, and
   `R_terminal_high = R_high + Delta_R`. Recompute TC02's conservative skew as
   `max(abs(C_terminal_low - R_terminal_high),
   abs(C_terminal_high - R_terminal_low))` and require it not to exceed the
   exact profile maximum. Any
   subtraction, conversion, addition, endpoint, deadline, or duration that is
   negative, unrepresentable, ambiguous, or overbound denies.
5. Define `D_fresh_C` and `D_fresh_R` as the greatest qualified monotonic
   values for which respectively
   `duration(D_fresh_C - M_C) <= max_evidence_age` and
   `duration(D_fresh_R - M_R) <= max_evidence_age`; require
   `M_post <= min(D_fresh_C,D_fresh_R)`. For a present exclusive
   `effective_expiry = X`, define
   `D_expiry` as the least qualified monotonic value for which
   `C_high + duration(D_expiry - M_C) >= X`; require both
   `M_post < D_expiry` and `C_terminal_high < X`. Equality, overlap, or crossing
   denies. An absent effective
   expiry creates no expiry deadline, but all time evidence required by the
   decision remains subject to its own TC02 bounds.
6. Return internal success without another state read, clock read, cache write,
   or side effect. The **linearization point** is the final byte-equal
   generation/root/anchor tuple read in step 2. Requiring the later conservative
   `M_post` interval to remain strictly before expiry makes an expiry crossing
   anywhere in the fence deny rather than retroactively extending that point.

A revocation or epoch/head transition committed before the linearization point
changes the immutable generation/root/anchor-selected head or vector and must be
observed as mismatch or non-active state. A transition committed after that
point does not rewrite this pure predicate's past result; this slice grants no
use authority, and every later authority/lease/broker stage must perform its own
closed currentness fence. If ordering relative to a transition cannot be proven,
the terminal fence is unavailable and returns the same safe failure.

Failure evaluation is deterministic and fail-closed: terminal admission and
precomputable bound/unit failures precede pre-sample qualification failure; that
precedes tuple drift or revocation; that precedes post-sample continuity,
freshness, and skew failure; that precedes post-sample arithmetic failure; and
that precedes expiry/deadline failure. The first failing class stops evaluation,
but all classes project to `false/ECR_TC06_ENTRY_NOT_CURRENT`. No owner question,
fallback, new evidence acquisition, retry, or finer external reason occurs here.

## 6. Privacy and protected-content handling

The head contains protected control metadata and is stored only as TC05 protected
metadata outside Git, Jira, repositories, logs, model context, and ordinary
output. Its repository/environment/target relations stay encrypted. The pre-root
plane may carry only TC05's permitted random routing ID, object/schema class,
bounded length, and digest commitment.

The head contains no plaintext, ciphertext, wrapped CEK, raw key, reusable value
fingerprint, label, URL, account name, secret-derived digest, or user text. The
selected envelope remains an opaque typed reference during this predicate.
The reconstructed admission witness is attempt-local protected metadata. Its
body and digest are discarded after verification and may not enter Git, Jira,
logs, model context, ordinary output, caches, TC05 storage, or later authority
state. A test-only digest ledger may contain only synthetic fixture digests.
The same restrictions apply to every reconstructed transition witness, replay,
edge ledger, and replay digest; production diagnostics expose none of their
entry, head, manifest, index, transaction, proof, or timing relations.
Errors contain only closed internal codes; model-facing results retain TC02's
observation-equivalent projection. Timing, cache, size, and cross-scope
equivalence remain TC07/TC10 qualification blockers.

## 7. Resource and fail-before-work requirements

Before body retention, graph walk, index lookup, or protected-view resolution, an
implementation must resolve exact generated `Max`, `Meta`, `Record`, parser
depth/item/pair counts, read-set membership, predecessor depth, and
`Pre06A/Post06A` workspace bounds. Unknown arithmetic, overflow, missing rows, or
one byte/item above a bound returns `UNAVAILABLE`.

The initial qualification profile separately caps one predecessor verification
walk at 256 heads and one reverse-admission lineage at 256 manifests. A sequence
or lineage greater than 256 requires a separately authenticated checkpoint
design or is unavailable; neither is truncated. Both walks are charged in full
under distinct generated rows; equality between their objects provides no shared
or deduplicated allowance. The caps limit work, not historical retention.

Generated `Max`, `Meta`, and `Record` rows cover the canonical admission-witness
body as well as every body it authenticates. The verifier admits the complete
witness field count and its at-most-256 lineage before canonicalization. It does
not retain or allocate an overbound witness and does not hash a partial witness.

Terminal-fence bounds separately cover both monotonic samples, candidate and
reference evidence ages, interval endpoints, elapsed-duration conversion, and
freshness/expiry deadline arithmetic. Every subtraction and addition is checked
before use. Precomputable bound or unit failure denies before the tuple walk;
failure derived from `M_post` denies immediately after that sample and before
success. Overflow, wrap, unit ambiguity, or an unavailable qualified
monotonic-duration conversion never falls back to ordinary time.

Transition replay has an independent exact `1..256` transition bound and
generated `Max`, `Meta`, and `Record` rows for the replay, one step, both index
states, both selection branches, and both optional effect bindings. The complete
authenticated start state, every consecutive transition, and the terminal state
are admitted before replay. Zero, 257, a partial window, or arithmetic overflow
is unavailable before graph resolution; no suffix or digest summary substitutes.

No full object, string, array, or chain may be copied before length/count
admission. Canonical decoding is bounded before retention, and every referenced
body is charged exactly once by canonical digest within this phase. Semantic
equality, cross-phase equality, or equal payload bytes do not permit deduplication.

## 8. Deterministic evidence and tests

All fixtures use synthetic values and disposable stores. Passing them does not
qualify a platform, provider, protected value, or runtime.

| ID | Required deterministic evidence |
| --- | --- |
| `TC06A-ST01-SchemaClosure` | Canonical positive head, reconstructed admission witness, per-transition witness, and replay vectors plus missing/extra/duplicate/null/wrong-order/wrong-tag/wrong-domain/wrong-schema/indefinite/trailing corpus for every field and tagged-presence branch. Verify the head has no transaction, intent, effect, history, receipt, manifest, root, anchor, or witness reference under either typed or generic encoding. |
| `TC06A-ST02-UniqueSelection` | Zero/two live indexes, historical-index substitution, zero/one/two heads, duplicate-routing, duplicate-entry, another-generation, cached, and filename-selected inputs; only one authenticated selected-generation live index and head reach later checks. |
| `TC06A-ST03-ExactScope` | Mutate independently store/generation, repository, environment, repository domain, domain key/generation, entry, provider/tenant/target, operation, principal, adapter, output policy, request, decision, policy set, tuple, and expiry; each denies. |
| `TC06A-ST04-EpochFence` | Remove/add/duplicate/reorder/change each epoch member; try lower, higher, maximum-only, scalar restriction, another entry, stale qualification, and aggregate values. Only complete exact current equality passes. |
| `TC06A-ST05-StateGate` | Active passes the state step; suspended/revoked/tombstoned, relabel, owner approval, service authority, downgrade, and recovery substitution all deny with one safe external projection. |
| `TC06A-ST06-EnvelopeBinding` | Resolve a synthetic current envelope, then substitute every `common-bindings-v1` member, lifecycle, expiry, predecessor, digest domain, descriptor, body length, or generation. Every mismatch denies before envelope open. |
| `TC06A-ST07-PredecessorGraph` | Unique CREATE, same-version lifecycle REPLACE, and new-version REPLACE witnesses pass only inside the complete replay; missing/gap/sibling/fork/skip/rollback/cycle/reverse/wrong-prior/version-jump/resurrection/cross-store/cross-entry chains deny boundedly. |
| `TC06A-ST08-Time` | Exact qualified candidate/reference time before exclusive expiry passes the preliminary gate and terminal fence. Equality/overlap at expiry; stale/unavailable/wrong-source/same-source/rollback/lost-continuity/excess-uncertainty/wrong-boot evidence; monotonic reset/wrap; suspend discontinuity; unqualified unit conversion; and arithmetic overflow each deny without an ordinary-clock substitute. |
| `TC06A-ST09-TOCTOU` | Mutate each selected generation/root/anchor/current or creation manifest/manifest-lineage member/index/head/active state/creation intent/effect/history/receipt/admission-witness/transition-step/replay field/envelope/expiry/vector/decision/attempt or trusted-time/profile/skew/freshness/monotonic/suspend/boot field after initial read and before the terminal tuple read. Every mutation denies without cached success or fallback. |
| `TC06A-ST10-Bounds` | Generated `MAX`, `MAX-1`, and `MAX+1` cover bytes, items, pairs, depth, read-set members, roles, proof pages, 1/256/257-head walks, independent 1/256/257 reverse-admission manifest lineages, and 1/256/257 complete transition replays. Oversize rejects before allocation, lookup, protected-view resolution, witness/replay canonicalization, hashing, or complete traversal; TC06A makes no custody or crypto call. |
| `TC06A-ST11-Privacy` | Interleave unknown, wrong-scope, suspended, revoked, tombstoned, stale, malformed, and valid synthetic probes under cold/warm cache and faults. Output shape, safe code, external calls, and mutation are equivalent; scan all surfaces for protected material and transition/replay relations. |
| `TC06A-ST12-NoAuthority` | Feed a current head without approval redemption, authority revalidation, lease, attempt reservation, broker, output qualification, or audit readiness. Result remains `LATER_STAGE_REQUIRED`; no action, handle, protected value, or provider call occurs. |
| `TC06A-ST13-FaultCuts` | Fault after every bounded read/proof/compare/replay/re-read step and immediately before/after each terminal monotonic sample and the linearization tuple read. Each cut returns one deterministic denial/unavailable state and performs zero mutation. |
| `TC06A-ST14-CrossRuntime` | Independent encoders/verifiers reproduce byte-identical head, head reference, reconstructed admission and transition witnesses, replay digest, terminal interval/deadline arithmetic, bounds, and positive/negative results on Windows, macOS, and Linux. |
| `TC06A-ST15-ReverseAdmission` | Same-generation and later-generation synthetic graphs pass only when canonical head hash/length, exact creation-effect descriptor/index/transaction/generation, intent/effect/history/receipt tuple and ordered proofs, creation-manifest proof mappings, every complete successor-manifest body, current index proof/leaf, current root, and trusted anchor all byte-bind. Independently mutate each value, ordering, body hash, lineage endpoint, generation decrement, or descriptor lifecycle/location; every mutation rejects. |
| `TC06A-ST16-AcyclicAdmission` | Starting from the passing graph, inject into the head a typed or generic descendant/witness ref; admit an admission/transition witness or replay as an effect descriptor; point any graph body at either derived witness/digest; make a proof name receipt/manifest/root/witness; make receipt/history name its containing manifest; or add a self-edge, two-node/longer cycle, duplicate node, repeated manifest, cross-step back-edge, fork, skip, alias, or reverse edge. Each rejects before currentness with the same safe result and zero runtime/provider/mutation. The unmodified topological graph passes. |
| `TC06A-ST17-TerminalFence` | Deterministically schedule: expiry remains beyond `M_post` (pass); expiry is crossed between `M_pre` and the tuple read, at the tuple read, or between the tuple read and `M_post` (all deny); candidate or reference evidence becomes stale at `M_post` (deny); boot changes, monotonic resets/wraps, suspend continuity is lost, or skew exceeds its bound during the fence (deny); revocation/head/epoch generation commits immediately before the tuple read (deny) or immediately after it (the pure predicate linearizes before it and grants no later authority). The exact no-time tagged-absence branch performs zero clock reads; injecting optional time denies. Repeat each vector with simultaneous failures and verify Section 5.1 precedence, one safe result, and zero wall-clock/provider/mutation behavior. |
| `TC06A-ST18-TransitionReplay` | Replay canonical CREATE, UNCHANGED, and REPLACE transitions through the terminal state. Then independently introduce an effect-admitted sibling with the same parent, unselected head, duplicate EntryHeadIndex, forked manifest/root, skipped or reordered generation, missing intermediate UNCHANGED step, restored prior head, duplicate transaction/manifest, false absence, parent/current index mismatch, read-set mismatch, descriptor-index substitution, truncated prefix/suffix, caller-selected window, replay against another store/entry/attempt/current generation, and 0/1/255/256/257 transitions. Only the complete consecutive 1..256 replay with exact effect/index atomicity makes `TC06_ENTRY_TRANSITION_VALID=true`; every other vector is one safe false result with zero authority/provider/mutation. |

Qualification evidence includes checked-in canonical fixtures, a generator, an
independent verifier, manifest ordering, exact SHA-256 for every fixture and
rules projection, the exact canonical admission-witness and transition-replay
digests, topological graph and transition edge ledgers, terminal monotonic/
deadline schedule traces, allocation/high-water
instrumentation, a negative-result ledger, and a content scan proving no
protected value or secret-derived material.
Generator and verifier are separate implementations and reject any altered rule,
vector, digest, bound, ordering, or expected outcome.

## 9. Prerequisites and remaining blockers

This design can close only after a digest-bound Codex review reaches at least 93
confidence with zero failed checks, security findings, material dissent,
unresolved questions, or design-changing objections.

Runtime qualification additionally requires all of the following, none claimed
here:

1. digest-bound closure of TC05 and its generated bounds;
2. closed TC06 transition authority and lifecycle matrix proving how a head is
   created, rotated, suspended, revoked, or tombstoned;
3. closed approval redemption, current-authority, finite-budget, lease, and
   attempt-reservation mechanisms;
4. qualified TC03/TC04/TC05 provider, custody, domain-slot, store, anchor,
   durability, parser, and protected-metadata paths;
5. TC07 broker/adapter/output containment and TC08 audit readiness; and
6. TC10 bounds, adverse corpus, timing/privacy, cross-platform, build/provenance,
   install/upgrade, requalification, and activation evidence.

If any prerequisite is absent, stale, mismatched, ambiguous, or unqualified,
`TC06_ENTRY_CURRENT` is unavailable or false and no later action proceeds.

## 10. Owner-decision check and next item

No owner decision is required. Locked Q1, Q5, Q6, Q8, and Q10 already determine
the boundary: machine/service material only, no model reveal, exact repository/
environment separation, narrowly scoped service use, and fail-closed production.

After independent closure, the next permitted design item is one separate TC06
transition-authority/lifecycle slice. It cannot be inferred from this head schema,
and this file grants no implementation permission.

## 11. Internal design audit

- First unresolved post-TC05 TC06 predicate isolated: `TC06_ENTRY_CURRENT`.
- Governing inputs and current hashes are explicit; TC05 remains provisional.
- For F1, the head contains only pre-effect facts; its authenticated reverse
  admission witness is external, ephemeral, canonical, bounded, and terminal in
  one explicit acyclic digest direction with deterministic rejection evidence.
- Closed F1 remains unchanged. For F2, the terminal current view has one explicit
  linearization point and one conservative qualified-time fence with exact
  freshness/expiry deadlines, deterministic ordering, and concurrent expiry,
  revocation, stale-evidence, and boot-continuity rejection evidence.
- Closed F1/F2 remain unchanged. For F3, every consecutive store transition is
  replayed through canonical authenticated parent/admitting index states; exact
  transaction atomicity and a separately named validity conjunct exclude hidden
  siblings, forks, skips, rollbacks, truncation, and derived-evidence cycles.
- Canonical fields, tagged presence, equality, precedence, bounds, predecessor
  rules, privacy, and deterministic evidence are closed for F1/F2/F3 review.
- Approval, leases, mutation authority, rotation/revocation execution, broker,
  audit, recovery, and qualification remain outside this slice.
- F1/F2/F3-scoped known failed checks: `0`.
- F1/F2/F3-scoped known security findings: `0`.
- F1/F2/F3-scoped material dissent: `0`.
- F1/F2/F3-scoped unresolved owner questions: `0`.
- F3-scoped internal author score: **96/100**, confidence **96%**. The deduction
  is for independent verification still being required. Runtime qualification
  and all later TC06 authority/mechanism items remain unclaimed; TC05/TC10
  prerequisites remain unqualified.
