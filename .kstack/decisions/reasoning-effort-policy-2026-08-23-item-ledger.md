# Per-item ledger: reasoning-effort policy design lineage

**Thread:** `reasoning-effort-policy-2026-08-23`  
**Lineage covered:** rounds 20–47
**Created:** 2026-08-25  
**Status:** living document; update in place

## Purpose

This ledger rates individual technical items and claims independently of the
aggregate confidence or disposition of the round bundle in which they appeared.
It implements the owner's 2026-08-25 process correction: retain useful
item-level evidence even when a bundle is rejected, and do not treat a bundle's
verdict as the status of every sub-claim.

Commit `5dcfecc` formalized the refined batching rule in
`plugins/kstack/skills/kstack-design/SKILL.md`: batch only independent items
that share no mechanism and cannot contradict or obscure one another, retain
per-item attribution, and isolate entangled or high-risk mechanisms.
Accordingly, a remedy that reviewers liked only as part of an overloaded round
remains `OPEN-UNTESTED` unless the evidence isolates it well enough to attribute
the result. This ledger complements, and does not replace, any whole-mechanism
rejected-options ledger for this thread.

## Status meanings

- `VALIDATED` — item-specific evidence accepts the claim or classification;
  nothing further is required for that exact item.
- `REJECTED` — item-specific evidence establishes that the proposed claim or
  mechanism is unsound; the replacement is named in **Next action**.
- `OPEN-UNTESTED` — a proposal or disposition exists, but it has not been
  isolated and tested under the one-change-per-round rule.
- `OPEN-CONFIRMED-BUG` — reviewers confirmed the underlying defect or design
  gap, but no isolated accepted fix exists.

## Maintenance rule

Every future round dispatch prompt for this thread must read this ledger first.
After synthesis, update in place the status and evidence for every item that
round addressed, add every newly discovered item, and name the next isolated
round action for anything still open. Preserve material evidence when status
changes; do not recreate the file, infer sub-item status from a bundle's gate
result, or let this ledger go stale.

## Item ledger

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Order-independent `(2,2)` above-boundary recovery envelope within the explicit one-failed-attempt-per-type fault budget | `VALIDATED` | Round24 Codex explicitly found no fifth relocation within the stated budget and reproduced lag 262, `C_chain=47,840 ms`, total 289,590 ms, and 10,410 ms margin. Round24 Opus independently said the named round23 ordering foreclosure was genuinely closed and reproduced all six interleavings and the same arithmetic. | Nothing further for the narrow ordering/quota claim. Do not broaden this validation to candidate availability, verifier eligibility, or more than one failed attempt per type. |
| Genesis digest as sequence-1 predecessor and repeated signed checkpoint/receipt binding makes substitution detectable against retained evidence | `VALIDATED` | Round24 Codex said the genesis digest is genuinely bound and substitution is detectable against retained chain evidence. Round24 Opus said item 2 was closed and distinguished whole-store replacement as the disclosed external-anchor limitation. | Nothing further for retained-evidence substitution detection; preserve the whole-store replacement limitation. |
| Explicit carve-out of chain-native lifecycle/control events from the application-publication bijection | `VALIDATED` | Round24 Opus explicitly said the bijection carve-out is closed and consistent: the six zero-key prose types match the six zero-key fanout rows. Round24 Codex raised no contrary current finding. | Nothing further for the carve-out classification. A future schema that adds an artifact-first counterpart must re-enter the bijection proof. |
| `K_event=80` versus the derived `2m<=64` migration maximum | `VALIDATED` | Round24 Opus explicitly called `K_event=80` sound against the derived migration maximum. Neither reviewer reported a current fanout/headroom defect. | Nothing further for the current v2 inventory; any schema extension must re-run the closed fanout proof. |
| Base 128-page delta layout arithmetic for in-slot values | `VALIDATED` | Round24 Opus reproduced `96 + 24 + 6 + 1 + 1 = 128` pages and the auxiliary/supermanifest maxima. Round24 Codex's objection was not to those base sums but to legal oversized values placed in unaccounted authenticated subtrees. | Preserve the base layout; do not claim it covers legal oversized values until the separate subtree item closes. |
| Legal oversized compact-leaf values stored in separately authenticated subtrees are absent from page, read, durability, reserve, and cost bounds | `OPEN-CONFIRMED-BUG` | Round24 Codex `DELTA-ENVELOPE` found that the claimed exact 128-page envelope allocates no pages or work for the separately authenticated value subtrees. This is a concrete constructibility gap. | In an isolated round, either prove every legal compact leaf fits the 4,096-byte slot or add a closed subtree page encoding and re-derive every dependent bound. |
| Exact 4,096-byte maximum for both recovery schemas | `OPEN-CONFIRMED-BUG` | Round24 found no reproducible field worksheet for either recovery schema. Round27 now closes the rejection-successor half only: both reviewers accepted/reproduced its complete 19-member embedded profile, 18-member event, 208-byte signature object, 2,596-byte maximum, and four-digit placeholder algorithm. Rotation and the other signed schemas remain unproven. | Preserve the validated 2,596-byte successor worksheet. Isolate `verifier-set-update` and remaining signed schemas with equally complete field-by-field maxima before closing this combined item. |
| Exact compact rejection-successor serializer is one physical event of at most 2,596 bytes and creates no 65,536-byte successor header | `VALIDATED` | Round27 digest `904d20034a05debdfd353aee5b7b6224de3dd0ac01b05f344926e80035ca57ac`: Opus independently reproduced every member, nested totals 1,319 and 208, total 2,596, 1,500-byte headroom, and the four-digit algorithm; Codex reported no serializer/header defect. Both reviewers treat round26's extra-header ambiguity as closed. | Preserve the exact-key schema, alphabets, equality of embedded/enclosing sequence, no-extra-header rule, and maximum fixture. Do not broaden this validation to rotation or bundle reclamation. |
| `chargedJcsBytes` signing-preimage construction | `OPEN-CONFIRMED-BUG` | Round24 Codex found a circular computation: the measured event contains `chargedJcsBytes` and a signature placeholder, but no exact placeholder object or fixed-point algorithm is specified. | Define one terminating deterministic algorithm, including the complete placeholder object and decimal-boundary handling, and test boundary fixtures. |
| Every signed schema authenticates the signer key ID, especially `checkpoint-verified` | `OPEN-CONFIRMED-BUG` | Round24 Opus `SEC-3-SIGNER-KEYID-UNAUTHENTICATED` found that omitting the entire signature object can leave signer identity outside signed bytes and that no complete `checkpoint-verified` field inventory proves otherwise. | Put the signer key ID in a top-level projected field for every signed schema, or omit only signature bytes; provide the exact `checkpoint-verified` inventory. |
| Admission jointly reserves a conforming SEALED checkpoint and a finite disposition path before ordinary lag exhaustion | `OPEN-CONFIRMED-BUG` | Round26 combined 70 accepted Option A's lag mechanics but left successor resources ambiguous. Round27 combined 72 reached the owner's cleanup target and independently validated the compact successor/no-extra-header arithmetic, yet both reviewers revised. Codex found repair-result/refusal contradiction; Opus found the rebinding shorthand potentially uncounted and equal-content reclamation unsafe. Gate remained BLOCKED at configured 80. | Keep only the round26 lag mechanics and round27 validated serializer/header proof. Before a new whole-mechanism claim, define rebinding solely as a counted verifier-set-update, bounded repair-result semantics, and reference-safe bundle reclamation; re-run reachability and reserves. |
| Complete-turn verifier qualification is feasible at the declared deployment probe floor | `OPEN-CONFIRMED-BUG` | Round24 Opus showed the floor-derived tail work alone is 47,840 ms, exceeding the 36,000-ms complete-turn eligibility cap before page, join, signature, mirror, and disposition work. A floor-admitted store can therefore have no ACTIVE verifier. | Separately raise the probe floor using one consistent worst-case model or redesign complete-turn verification to fit the cap; then re-derive the gate deadline. |
| One consistent basis for verifier, tail, and gate-deadline cost terms | `OPEN-CONFIRMED-BUG` | Round24 Opus found the 288,590-ms proof mixes a measured target-hardware verifier hold with floor-derived terms and has no feasible verifier-bound solution at the stated floor (`V<=47,410 ms` versus tail work `>=47,840 ms`). | Rebuild the deadline proof from one declared performance basis after verifier qualification feasibility is resolved. |
| One closed above-boundary recovery admission predicate | `OPEN-CONFIRMED-BUG` | Round27 supplies fixed lane/reserve codes and one closure-lineage domain spanning below/after-fence repairs. Opus nevertheless found §4's “exact in-quota rebinding” shorthand can be read as a separate uncounted event, while primary lineage defines it as embedded in verifier-set-update. The reviewed packet therefore still permits divergent validators. | State in the predicate that the only rebinding admission is a counted `verifier-set-update` carrying the exact rebinding object; make the lag inequalities explicitly candidate/lane scoped and exhaust that exact event grammar. |
| FIFO admission and retry policy bounds caller-visible completion rather than only one admitted attempt | `OPEN-CONFIRMED-BUG` | Round24 Opus found a gate refused with `LOCK_QUEUE_FULL` is outside FIFO fairness and may starve indefinitely; repeated `RETRY_AFTER_REPAIR`/`RETRY_AFTER_QUANTUM` acquisitions also have no count bound. | Define reservation/fairness or honest unbounded-latency semantics, plus a bound or progress measure for retry acquisition count. |
| Local verifier qualification state does not make receipt validity host-dependent | `OPEN-CONFIRMED-BUG` | Round24 Opus `SEC-4-LOCAL-REGISTRY-VALIDITY-DIVERGENCE` found receipt acceptance depends on root-owned off-chain per-host eligibility state, so two hosts or a restored mirror can disagree on the same chain. | Scope qualification to local scheduling/append admission only, or chain-bind the qualification evidence; keep replay validity host-independent. |
| Operator-root compromise is accurately disclosed as collapse of independent verification | `VALIDATED` | Round24 Codex and Opus both agreed the disclosure is now accurate: the root holder can install a threshold-1 verifier, rebind a candidate, and forge VERIFIED covered state. | Preserve this exact disclosure; do not report the condition as merely rotation or migration authority. |
| V1 applies a mitigation for operator-root total collapse | `OPEN-CONFIRMED-BUG` | Both round24 reviewers retained high-severity findings because no second signature or threshold mitigation is applied. Opus identified an unevaluated cheaper in-architecture option: old-verifier-set co-signature for below-boundary rebinding. | Isolate mitigation-versus-explicit-acceptance as an owner decision; compare old-set co-signature with the deferred guardian/threshold option and its liveness consequences. |
| Lifecycle-only coverage biconditional and virtual pair | `OPEN-UNTESTED` | Round26 found coverage/physical charge ambiguity and omitted sequence-1 premise. Round27 normatively separates application/map coverage from all-physical tail charge, states physical sequences start at 1, and confines `(0,SHA256(empty))` to map-zero coverage. Neither reviewer reports a remaining counter/sentinel contradiction, but the owner-directed bundle was not an isolated affirmative test of this item. | Retain the corrected definitions and isolate divergent-validator fixtures before marking validated. |
| Compact rejection-successor representation and disposed-bundle lifecycle | `OPEN-CONFIRMED-BUG` | Round27 validates the one-event/no-extra-header representation and exact 2,596-byte serializer, but Opus `SEC-27-A` shows reclamation can delete the live object when `B_new` and `B_old` have the same content address. Round28 digest `96053b1cf6dc480011f4af1ecfc176f2d2098be84fb8ab303c510aa678a7f0d3` receives item-specific agreement from both reviewers that separating logical references from physical content and forbidding deletion while the successor reference is live closes the equal-content deletion counterexample, but is rejected at combined 68 because its cleanup ordering can lose durable orphan evidence and violate the reserve. Round29 digest `8d557d34b471482e2f0027c847f152560561103d1017b057fef35720d8d94176` attempts entry 2/round28's own recorded durable-intent alternative and is rejected at combined 52 (Codex `block/52`, Opus `revise/74`): both reviewers independently construct a state where a canonically installed object's sole `StagingIntent` is lost/torn with no durable event, making `d_new` unrecoverable outside the explicitly optional sweep (falsifying the packet's "no third case" claim), and both independently find the pending `refId=H+1` is released, not consumed, on a pre-event abort, so it can be reused with no stated uniqueness rule, contradicting the "never reused" identity claim. Opus additionally finds `SEC-29-A` (high): the `CleanupTombstone` is named as both a non-load-bearing accelerator and the mechanism gating round27's carried "no second successor while cleanup is pending" admission rule, with no stated chain-replay fallback — round28's rejection class reintroduced through the admission path. Round30 digest `d6ed91694342246b6a9bd6f0acb65bc0b051f1ff77ab42037578b6d71ed508a1` applies rejected-options entry 3's own four-point alternative in full (composite `(refId, attempt)` uniqueness key; a mandatory reserve-bounded "load-bearing slot-resolution sweep"; a widened `Guarantee 1` plus a chain-replay admission fallback demoting `CleanupTombstone` to a non-authoritative cache; a named `write-fsync-rename-fsyncdir` durability primitive) and is rejected at combined **18** (Codex `block/18`, Opus `block/46`) — the sharpest drop of any round on this mechanism. Both reviewers independently construct a **no-crash-required, critical** counterexample against the round's own new mandatory sweep: the append lock is released after canonical installation but before event durability, admission's "cleanup is pending" predicate never recognizes an in-flight (durable-intent, not-yet-event-durable) `STAGED_SUCCESSOR` as blocking a second attempt, so a second attempt can resolve and delete the first attempt's still-live canonical object with zero crashes involved — worse than either prior rejection, which were availability-only leaks. Both reviewers also independently found the `(refId, attempt)` "no exception" uniqueness claim self-contradicted by the packet's own torn-`SlotAttempt` recovery row, and that the named durability primitive does not match its own principal (cross-directory) use site. Opus additionally found a TOCTOU window on the reuse path from the round's own lock-narrowing fix and a reclamation/reserve deadlock; Codex additionally found the admission predicate contradicts its own acceptance fixture. Both reviewers' recommendations independently flag the same architectural root cause and both suggest the facilitator weigh a structurally different lifecycle approach (rejected-options entry 3's Option C) given this is the third consecutive rejection on this exact mechanism, each at a new defect in the same failure class. Round31 digest `ddcabe79d9dab3828dab096eb0e17929cb1413b954afac2b1ab51709e160535c` applies the missing normative rule directly: it folds successor staging (StagingIntent write, canonical install) into round27's own original single, never-split append-lock hold, releasing only after the event itself is durable, and retires `SlotAttempt`/`(refId, attempt)` entirely as no longer needed. Rejected at combined **16** (Codex `block/16`, Opus `revise/76`) — the fourth consecutive rejection. Both reviewers **independently and affirmatively accept** that this closes round30's exact `SEC-01` counterexample by construction (a second attempt can no longer even begin while a prior one holds the lock) and that retiring `SlotAttempt` was correct. But both independently construct a **new** no-crash-required race the round's own choice to keep old-bundle reclamation *outside* the lock (matching round27's original framing) reopens: a concurrent successor's pre-lock reuse decision is never revalidated against a concurrent reclamation that can delete the same content address before/after the referencing event becomes durable (Codex `SEC-01` critical, `SEC-02` high; Opus `SEC-04` medium, independently derived). Opus separately finds a second, unrelated defect: the round's new VERIFIED-gate coverage proof (Section 3c, closing ledger item 1) rests on a non-monotone emptiness predicate — a `DISPOSED` reference sharing a content address with a `RETAINED_VERIFIED` reference can satisfy the gate at closure time yet become a genuinely outstanding, permanently unreclaimable obligation later, outside the lineage-bounded replay window (Opus `SEC-01`, high; falsifies the round's own second safety clause). Both reviewers also independently find the packet self-contradicts on ledger item 4 (Section 2c step 2's `RETRY_AFTER_REPAIR`-and-refuse text conflicts with Section 3d's/fixture 8's same-acquisition claim) and on primitive definitions (`WRITE-DURABLE` invoked in a form that does not match its own definition; `CROSS-RENAME-INSTALL-DURABLE`'s stated precondition contradicts its own step 3). Opus additionally raises a genuine dissent Codex does not reach: no deployment-scope precondition (single-host vs. multi-host/shared-storage) is stated for the append lock itself, despite the same rigor being demanded of storage-rename atomicity. Fable arbitrated after round31's rejection (`.kstack/decisions/reasoning-effort-policy-2026-08-23-fable-round31-structural.md`, binding): selected Option 1 — fold reclamation into the single append-lock hold as its first substantive step, recomputed fresh from `(durable chain prefix + directory listing)` at every hold, never from a persisted record; retire `StagingIntent`, `CleanupTombstone`, `SlotAttempt`, pre-allocated `refId`, and `CROSS-RENAME-INSTALL-DURABLE` entirely; rejected the monotonic-epoch/generation-counter alternative (Option 2) as degenerating to "the lock plus a redundant record." Round32 digest `2acfcbc3eef805a55e2fee48ed2188e341676811f22584ad906e708ece80e124` implements this ruling in full (per-content-address `liveAddrs(H)` spanning `CURRENT_SEALED`/`RETAINED_VERIFIED` roles, `INV-DURABLE-ONLY`, a 7-step single-hold procedure, an idempotent abort-rule re-run of the reclaim step, a complete crash-recovery table distinguishing the same-window crash-vs-clean-abort case, and an explicit lock-scope/deployment-scope statement) and is rejected at combined **18** (Codex `block/18`, Opus `revise/70`) — the fifth consecutive rejection. Both reviewers, independently and using different reasoning paths, construct the same critical counterexample: making `liveAddrs(H)` a per-content-address set spanning both `CURRENT_SEALED` and `RETAINED_VERIFIED` (round32's own fix for round31's non-monotonicity bug) admits two simultaneously-live canonical bundle addresses (the packet's own H=105 worked example), and staging a third distinct successor bundle yields a worst case of `3*K_b=24 MiB` against the stated 16 MiB `CHECKPOINT_RESERVE_BYTES` and the packet's own "at most two bundles ever" claim — the fix for the durability/liveness dimension reopened the previously-closed disk-reserve dimension, the same relocation pattern as rounds 28-31, now surfaced in review rather than after implementation. Opus additionally finds: `.staging/` objects are excluded from `present(H)` and cleaned only along "this acquirer's own deterministic staging path," so a crash during staging leaks a permanently unreclaimable object once acquirer identity changes (`SEC-32-B`, high — explicitly named as round31's unreclaimable-obligation defect relocated into a new namespace); a self-contradiction between step 3's "deterministic staging path" and step 4's "fresh content-addressed name"; Guarantee 1 stated over hold-exit is falsified by the packet's own step 6 (true only at step-3 completion); an ordering contradiction between Section 3b (validate then reclaim) and Section 4 (asserts the same pass while implying reclaim precedes reserve computation); and an unspecified thread-vs-process model for the lock primitive. Codex additionally finds a corrupt-prefix reclamation fail-safe gap (`SEC-02`, high) and unenumerable stale staging files (`SEC-03`). Both reviewers explicitly corroborate, as genuinely closed and not in dispute: the persisted-record failure class of rounds 28-31 is eliminated and `INV-DURABLE-ONLY` is sound; round30's no-crash live-object-deletion counterexample is closed by construction; round31's non-monotone-coverage `SEC-01` is closed by the worked example; the item-1/item-6 `refId` pre-allocation-vs-post-hoc-identity tension is resolved coherently; and Sections 1, 2, 5, 6, 7's carried-forward arithmetic re-verifies byte-for-byte, with the single stated exception that Section 6's reserve-admission clause is now contradicted by the new role set and must be re-derived. Opus states explicitly that the Fable ruling's selected direction (Option 1) is correct and this packet's *execution* of it, not the ruling, is what failed. Per this thread's Fable-triggering criteria, no further Fable round is triggered here: both reviewers converge on the same finding with no unresolved disagreement between them, only a genuine defect in this round's own draft. Round33 digest `218b2b77e82b813cac2920ade27d1a2dcb86d5646cb61dde1ad62dc4e837a944` applies round32's own recorded seven-point alternative in full plus SEC-02/SEC-03 disposition (nine individually-attributed items; see the dedicated round33 table above) and is rejected at combined **28** (Codex `revise/28`, Opus `revise/58`) — the sixth consecutive rejection. Both reviewers, independently, construct the same critical finding: this round's own fix 7 (the reader/reclaim contract) keeps a reclaimed bundle's blocks allocated for as long as any reader holds an open descriptor on it, which breaks fix 1's knife-edge `3*K_b` reserve equality and the freed-bytes-count-immediately half of fix 5's ordering statement — relocating, not closing, the exact reserve defect fix 1 was written to close in this same packet (Opus `R33-01` high, Codex `REP-33-01-SEC-01` high). Both reviewers also independently find fix 7 falsifies Section 7's carried-forward 289-ms gate-deadline margin via an uncapped reselect loop (Opus `R33-02` high, Codex `REP-33-01-SEC-02` medium). Both reviewers explicitly corroborate as genuinely closed: fix 2 (general `.staging/` clearing, closing `SEC-32-B`), fix 3 (Guarantee 1 restated over step-3 completion), fix 4 (iff-member-of-Obligations(H) qualification at instruction sites, closing `SEC-32-C`), fix 6's OFD/concurrency-model analysis (closing `SEC-32-E`'s thread-vs-process question), fix 5's ordering statement proper (separable from its disputed freed-bytes clause), and SEC-02's core corruption-refusal reasoning (though its scope over-blocks fix 2's chain-independent sweep, per Opus `R33-06`). Per this thread's Fable-triggering criteria, no Fable round is triggered by round33 either: combined confidence (28) is higher than round32's (18), not a fresh sharp drop on stable ground, and both reviewers converge on the identical root cause with no disagreement between them. | This is the sixth consecutive rejection (28: 68, 29: 52, 30: 18, 31: 16, 32: 18, 33: 28) and the first attempted after applying round32's own recorded alternative in full. Per the round33 dispatch's own standing rule, no round34 draft is authored in this dispatch; escalate to the facilitator that the reserve-budget fix (fix 1) itself failed — not only the broader nine-item batch — with fix 5's freed-bytes clause and fix 7's reader/reclaim contract as the specific interacting causes, per the batching discipline's per-item attribution requirement. A future round re-attempting this mechanism must NOT reopen the Fable ruling, fixes 2/3/4/6, fix 5's ordering statement proper, or SEC-02's core reasoning, and should apply the concrete seven-point alternative both round33 reviewers converge on (recorded in full in `.kstack/reviews/reasoning-effort-policy-2026-08-23-round33/synthesis.md` and rejected-options entry 7): (a) bound reader-pinned space (register descriptors, cap concurrent readers at `R` and use `(3+R)*K_b`, or bounded copy-and-close); (b) qualify fix 5's freed-bytes clause to exclude reader-pinned blocks; (c) give the disk-reserve clause real slack and an operative free-space/actual-bytes form; (d) cap fix 7's reselect and add its cost to `B_gate_read_closure_max`; (e) denominate the per-bundle physical bound in bundle bytes, not `K_b`, and account manifest/rounding overhead; (f) narrow SEC-02's refusal to exclude the chain-independent `.staging/` sweep; (g) replace "crash-safe lease" with an accurate flock release-on-close statement and address a hung (non-crashed) holder. Retain as evidence, not validated design: everything retained through round32 (removal-last ordering, immutable-refId/mutable-role split, equal-content guard, reprinted refusal codes, `CleanupTombstone`-as-non-authoritative-cache shape, the single never-split append-lock hold, the Fable ruling's fold-reclamation-into-the-lock structure, `INV-DURABLE-ONLY`, the recompute-every-hold model, the item-1/item-6 refId resolution) PLUS, new from round33: fixes 2/3/4/6 individually validated, fix 5's ordering statement proper, and SEC-02's core corruption-refusal reasoning (scope aside). |
| At most two physical checkpoint headers occur in a replay suffix when rejection-successors are compact embedded candidates | `VALIDATED` | Round27 Opus expressly accepts the four-step induction given the closed no-header successor schema and independently reproduces the two-header byte arithmetic; Codex reports no contrary header finding. Rejection can replace a candidate without anchor advance but cannot add a physical header. | Preserve the induction and its exact dependency on the validated compact schema. Re-enter review if successors ever gain a physical header/event. |
| Zero-candidate closure barrier preserves operator-root verifier rotation without writer cooperation | `OPEN-CONFIRMED-BUG` | Round27 admits reserved no-rebinding root rotation after `sealRequired`, fixing the exact round26 writer dependency at the barrier. Opus `SEC-27-B` finds urgent pre-latch rotation can still be blocked by exhaustion of the shared zero-map control budget until a seal trigger, which can be unbounded on an idle chain. | Give urgent root rotation a separate bounded pre-latch quota that cannot be consumed by other controls, or narrow the security claim explicitly to the latched closure state. |
| Low-map-charge lifecycle/control traffic cannot cheaply force or weaponize the publication fence | `OPEN-CONFIRMED-BUG` | Round27 introduces per-subject four and aggregate sixteen budgets and semantic-no-op rejection, directly bounding covered control spam. Opus finds the aggregate also blocks pre-latch urgent root rotation, so `SEC-26-02` remediation conflicts with `SEC-26-01`; denial by an application-authorized publisher remains explicitly accepted. | Separate urgent root rotation from ordinary control pressure, then model all authority subjects, quota exhaustion, idle-chain behavior, and fixed refusal results. |
| `RETRY_AFTER_REPAIR` is a bounded state-mutating repair outcome distinct from state-free refusals | `OPEN-CONFIRMED-BUG` | Round27 Codex's only defect and Opus `SEC-27-E` independently identify the contradiction: replay must reclaim a bundle before returning this result, while the packet says all refusals mutate nothing. Round28 supplies an exact mutation allowlist, protected byte-identity list, and one-successful-acquisition bound; Codex calls that classification otherwise coherent. Opus preserves genuine dissent because the packet does not reproduce the five refusal codes and the cleanup state machine itself is crash-incomplete. Combined confidence regressed to 68, so closure is not carried forward. Round32's fold-reclamation-into-every-hold redesign (rejected overall at combined 18 for an unrelated disk-reserve defect, see the mechanism row above) makes reclamation transparent and automatic as the first step of every hold, including the hold servicing a new caller's own request — the packet noted this appears to eliminate the routine need for a caller-visible `RETRY_AFTER_REPAIR` result, since any leftover garbage is already cleared before that hold's own admission decision runs. Opus reviewed this claim directly and kept the item open, asking explicitly "does any residual case still require `RETRY_AFTER_REPAIR` — specifically a torn chain-append durability primitive as distinct from bundle reclamation?" — i.e. the chain-append durability primitive itself (orthogonal to bundle reclamation) may still have a torn-write case needing a repair-and-retry result, which round32 did not analyze. | In the next isolated alternative, first resolve round32's own rejected disk-reserve defect (rejected-options entry 6) since it must land before this item can be re-tested on stable ground; then explicitly analyze whether the chain-append durability primitive itself (not bundle reclamation) ever needs a repair-and-retry result, and either retire `RETRY_AFTER_REPAIR` with that analysis as evidence, or reproduce the exact refusal enumeration and bind the repair result to a durable-intent cleanup that cannot forget work across a crash. Preserve the mutation and byte-identity allowlists but do not claim this item closed. |
| Round28 cleanup ordering removes durable transaction evidence before physical deletion and directory fsync | `REJECTED` | Round28 Codex `block/68` finds the precise crash window between metadata removal and deletion durability; Opus independently finds torn staging metadata can leave an unnamed zero-reference object and reports medium orphan-accumulation risk. Combined 68 is below round27's 72 baseline, activating the owner's reject-and-stop rule. | Do not build forward from the round28 ordering. Persist staging intent before object visibility and retain a cleanup tombstone through zero-reference deletion plus directory fsync; remove the marker only last. Define immutable reference identity and crash fixtures at every boundary. |
| Rejection reason codes form a closed replay-stable enum with bundle-change semantics | `OPEN-CONFIRMED-BUG` | Round27 Opus `SEC-27-C` finds `[A-Z0-9_]{1,32}` is a bounded alphabet but open semantic domain, permitting validator divergence and leaving unchanged-versus-new-bundle behavior undefined. | Enumerate exact codes and state for each whether equal manifest content is allowed and what evidence/root change is required. |
| Verifier mirror reserve has a complete staging, reference, reclamation, crash, and read-cost contract | `OPEN-CONFIRMED-BUG` | Round27 Opus `SEC-27-D` finds the carried 32-MiB mirror constant has no consuming invariant or acceptance case; its bundle validation/read cost is also unstated. | Isolate the verifier-side lifecycle or remove the constant from this mechanism; bind any retained reserve to exact objects, transitions, and deadline terms. |
| Checkpoint-closure mechanism is traced to the reasoning-effort resolver objective | `OPEN-CONFIRMED-BUG` | Round27 Opus finds no normative requirement trace from the checkpoint event/resource contract to selection of `{effort, role}` from category, phase, risk, and stuck signals, and preserves genuine dissent that the work may be misfiled. | State which resolver decisions/audit records require this checkpoint mechanism and how failure affects the user-visible objective, or refile the mechanism under its actual objective. |
| Chain-append durability strictly precedes broker acknowledgement durability | `OPEN-UNTESTED` | Round24's draft states the ordering and crash fixtures, but neither signed envelope gives item-specific affirmative evidence sufficient to mark the exact ordering validated. No current contradiction was reported. | Retain unchanged and cover in a later acceptance-package round with boundary crash fixtures. |
| Broker COW durability row reflects the four-recovery tail | `OPEN-CONFIRMED-BUG` | Round24 Opus found the row still uses 259 files (`9,770 ms`) after the tail increased to 262. Its recomputation is `262*30 + 2,000 = 9,860 ms`, still within the 10,000-ms allocation. | Correct the stale count and deterministic arithmetic; no allocation increase is currently required. |

### Round 33's nine individually-attributed items (round-32 alternative applied in full)

Per the round-33 dispatch's own instruction, each of the seven numbered
fixes plus the two named Codex findings (SEC-02, SEC-03) is tracked as its
own row, independent of the mechanism-level rejection recorded above and in
rejected-options entry 7.

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Fix 1 — raise `CHECKPOINT_RESERVE_BYTES` to `25,165,824` (`3*K_b`) and re-derive Section 6's reserve-admission clause against the corrected `liveAddrs(H)` (2-bundle steady-state + 1 staged = 3-bundle worst case) | `REJECTED` | Round33 Codex and Opus both accept the raw arithmetic (`3*K_b=25,165,824`) as the correct worst-case bundle count in isolation, but both independently find the resulting knife-edge, zero-headroom equality is broken by this same round's fix 7: an unlinked-but-open bundle (a reader-pinned inode) is invisible to `present(H)` yet still consumes disk, so real usage can exceed `3*K_b` with no bound. Opus (`R33-01`, high) computes `(2+1+N)*K_b` for `N` concurrent readers and states explicitly this is `REP-32-01-SEC-01` relocated, not closed. Codex (`REP-33-01-SEC-01`, high) independently derives the identical interaction. Both name fix 1 as the primarily implicated item. | Do not re-attempt this exact zero-headroom derivation without first bounding reader-pinned space (rejected-options entry 7's points (a)-(c)): either register open descriptors so admission can count them, cap concurrent readers at a stated `R` and use `(3+R)*K_b`, or require bounded copy-and-close. Give the clause real slack, not an exact equality. |
| Fix 2 — general, unconditional `.staging/` reclamation at every hold's step 3, not scoped to "this acquirer's own deterministic staging path"; closes `SEC-32-B` and the step-3/step-4 self-contradiction | `VALIDATED` | Round33 Opus explicitly: "the unconditional whole-subtree `.staging/` sweep ... closes `SEC-32-B` and dissolves the step-3/step-4 path contradiction, and the safety argument given for it ... is sound." Codex raises no contrary finding against fix 2 itself. | Nothing further for the general-clearing mechanism itself. Note the narrower, separate SEC-02-interaction gap tracked below (the corruption refusal over-suppresses this otherwise-sound sweep in the corrupt-prefix path specifically). |
| Fix 3 — quantify Guarantee 1 at step-3 completion, not hold exit; name the deferred-to-next-hold obligation as an explicit postcondition of step 6 | `VALIDATED` | Round33 Opus explicitly calls this "exactly right and the honesty about what Guarantee 1 does not claim is a real improvement." Codex raises no contrary finding. | Nothing further for this item. |
| Fix 4 — requalify abort/crash deletion prose in 3c/3d as "delete iff a member of `Obligations(H)`" explicitly at the point of instruction, including the equal-content non-exception | `VALIDATED` | Round33 Opus explicitly: "the iff-member-of-Obligations(H) test restated at each instruction site, including the explicit non-exception for the equal-content case, closes `SEC-32-C`." Codex raises no contrary finding against fix 4 itself; Opus's separate `R33-07` (low) targets a different premise in Section 7, not this item. | Nothing further for this item. |
| Fix 5 — one explicit ordering between reclaim (step 3) and reserve/fence computation (Section 4 item 2): reclaim always first, one computation per hold, step 2 non-quantitative | `REJECTED` (as drafted this round) | Round33 Opus explicitly separates and validates the ordering statement proper ("is correct and does close round 32's contradiction") from the round's own added claim that "freed bytes from step 3's own reclamation therefore DO count toward this hold's own reserve headroom" — which Opus dissents from directly: false whenever a reader holds a descriptor on a just-unlinked object (fix 7 interaction), and the design has no way for a hold to know whether that is the case. Codex independently lists this under the same "Fixes 1, 5, and 7" failed-check/dissent heading. | Re-draft only the freed-bytes clause per rejected-options entry 7 point (b): qualify it to "freed except for blocks pinned by open descriptors," consistent with whichever reader-pin bound fix 1's re-attempt adopts. The ordering statement itself (reclaim strictly precedes reserve/fence computation; one computation per hold) needs no change and may be carried forward as validated. |
| Fix 6 — explicit process/thread concurrency model for the lock: single process, per-acquisition open-`flock`-close discipline (never a shared, reused file descriptor across acquirer classes); closes `SEC-32-E` | `VALIDATED` | Round33 Opus explicitly: "fix 6's OFD analysis (the description of flock's open-file-description semantics, the shared-descriptor pitfall, and the prescribed open-flock-work-unlock-close-per-acquisition discipline are all technically correct and do close SEC-32-E's thread-versus-process question for the single-process scope)." Codex raises no contrary finding against the OFD/concurrency-model content itself. | Nothing further for the OFD/thread-vs-process closure itself. A new, separate availability gap was found this round (Opus `R33-05`, medium: `flock` has no timeout/preemption/fencing for a hung, non-crashed holder) — this is a newly discovered item, not a rejection of fix 6, and is added as its own open row below. |
| Fix 7 — reader/reclaim contract for gate reads and independent verifiers: open the selected bundle's canonical path before reporting the selection final; rely on POSIX unlink-after-open so an already-open descriptor's content survives a concurrent reclaim; reselect on `ENOENT` | `REJECTED` | Round33 both reviewers accept the core read-safety reasoning (open-before-report plus unlink-after-open genuinely prevents a torn read once a descriptor is open) but both find the contract as drafted omits two load-bearing bounds: (a) no reader-count or descriptor-lifetime bound, which is what breaks fix 1's reserve arithmetic (Codex `REP-33-01-SEC-01` high; Opus `R33-01` high); (b) no attempt cap or bounded cost for the `ENOENT`-triggered reselect loop, which falsifies Section 7's carried-forward 289-ms gate-deadline margin (Codex `REP-33-01-SEC-02` medium; Opus `R33-02` high). Codex additionally flags an ambiguity for multi-file/directory bundles (opening the root does not pin unopened descendant files). Opus additionally flags (`R33-07`, low) that the stated no-torn-read premise ("step 5's rename is the only write to a given canonical path") is technically false in the equal-content case fix 4 preserves, though content identity happens to rescue the conclusion. | Re-attempt only after resolving rejected-options entry 7 points (a) and (d): bound reader count/lifetime (shared with fix 1's re-attempt) and cap+cost-bound the reselect loop with an explicit term added to `B_gate_read_closure_max`. Also state whether bundles are monolithic files or multi-file objects and, if the latter, what pins every needed page; and correct the no-torn-read premise's wording for the equal-content case (the conclusion survives, the stated reason does not). |
| SEC-02 disposition (Codex) — corrupt-prefix reclamation fail-safe: refuse the hold before step 3 runs on a detected corrupt chain prefix; exclude that refusal from 3c's ordinary abort re-run | `REJECTED` (scope only; core reasoning retained) | Round33 Opus explicitly validates the core reasoning ("a corrupt tail can obscure a live reference without removing the durable fact that conferred liveness — this is correct and the right conclusion for canonical deletions") but finds (`R33-06`, medium) the refusal's *scope* is over-broad: it also suspends fix 2's `.staging/` sweep, whose own safety argument is explicitly independent of `liveAddrs(H)` trustworthiness, for the entire (unbounded, out-of-scope) duration of an out-of-band repair window. | Narrow the refusal so it blocks only canonical-namespace (present(H)/liveAddrs(H)-dependent) deletion, not the chain-independent `.staging/` subtree sweep. The corruption-detection-refuses-before-step-3 rule itself, applied to canonical deletions, needs no change. |
| SEC-03 disposition (Codex) — unenumerable stale staging files, confirmed closed as a direct consequence of fix 2's general/unconditional `.staging/` clearing | `REJECTED` (reopened in one path only) | Round33 Opus's `materialDissent` explicitly: accepts SEC-03 as closed "in the no-corruption path," but dissents from treating it as closed unconditionally, because in the corrupt-prefix path the SEC-02 disposition suppresses the very sweep that closes SEC-03, and the round-33 packet did not acknowledge that interaction (`R33-06` is the same finding as above, applied to this item specifically). | Once SEC-02's scope is narrowed (per the row above) so the `.staging/` sweep runs independent of chain-corruption state, this item closes unconditionally with no further change needed to fix 2 itself. |

### Round 34's four coupled items

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Fixed `R=4` `flock` reader slots | `REJECTED` | Round34 Codex `REP-34-01-I1-SEC-01` and Opus `REP-34-01-SEC-03` find the cap advisory without an access-control boundary, slot bootstrap/permissions unspecified, and hung lower-trust verifiers able to wedge all reads. | Require a broker-owned canonical namespace that direct readers cannot open; specify bootstrap and combine the cap with bounded copy-and-close. |
| Retract round33's symbolic "freed bytes count immediately" sentence | `VALIDATED` with wording correction | Both reviewers accept the retraction. Both reject the new claim that query timing is irrelevant: post-reclaim measurement is load-bearing because deleting an unpinned inode can increase available space. | Retain the retraction and reclaim-before-query ordering; drop the false timing parenthetical. |
| Live free-space check plus `BUNDLE_STORE_PROVISION_BYTES=58,720,256` | `REJECTED` | Both reviewers reproduce the same one-MiB deficit: provision minus two live plus four pinned bundles leaves `8,388,608`, below the `9,437,184` admission threshold. They also find missing sidecar/rounding/chain allocation, ambiguous lane placement, and a check-to-write race against unrelated filesystem users. | Derive provision from a complete physical-consumer table and the admission threshold; use an exclusive quota domain and enforce checks before every staging lane. |
| One ENOENT reselect bounded by one event / 65,536 bytes | `REJECTED` | Both reviewers find normative `E_max=1,048,576`, not `CHECKPOINT_HEADER_MAX=65,536`, bounds one event. Correct charging leaves only `9,152 ms`, below the required `10,000 ms`; Opus also finds the observed-head comparison races reselection and proof-path invariance is misstated. | Bound actual durable appended byte offsets under synchronization, open before releasing the lock, and read zero proof-path bytes before the open; otherwise refuse without reselect. |

### Round 35's five reviewed items

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Broker-only canonical access and deterministic slot bootstrap | `REJECTED` overall; enforcement subpart retained | Both reviewers accept that the dedicated UID and deterministic slot bootstrap convert round34's advisory cap into an enforced boundary. Both reject the overall item because no authenticated sealed-data handoff/verifier-side recomputation contract exists; the broker becomes a verification chokepoint and its socket protocol/resource semantics are unspecified. | Preserve access enforcement/bootstrap only. Define independent verifier evidence transfer, authenticated response framing, limits/backpressure, and recovery before re-attempting the broker shape. |
| Enforced `R=4` cap plus bounded anonymous-memory copy-and-close | `REJECTED` | Both reviewers find the same contradiction: a partial copy cannot verify a flat whole-object content address; a whole copy adds at least `1,363,968` uncharged bytes and reduces the worst deadline margin to about `8,789 ms`, below the `10,000-ms` floor. Opus additionally finds copy bytes wrongly denominated in quota-allocation bytes and system-wide cap starvation/fairness unresolved. | Choose whole-object copy and fully charge it, or define a chunk-digest manifest supporting authenticated range copies; then specify fairness and memory deployment bounds. |
| Complete physical bundle bound and derived provision identity | `REJECTED` | Codex finds the 65,536-byte metadata allowance asserted rather than filesystem-derived and persistent metadata unassigned. Opus finds allocation-unit compatibility is a deployment property incorrectly checked after staging, where it can permanently refuse required writes. | Enumerate every physical object/metadata term for one qualified filesystem and move allocation-unit/platform compatibility to bootstrap preflight. |
| Separate bundle/chain quota domains and all-lane admission checks | `REJECTED` | Both reviewers independently find project quota caps consumption but does not reserve physical blocks, and the `22,191,866` chain provision covers one closure window rather than cumulative sequence-1-through-H history. Framing, head/directory/lock files, inodes, and persistent metadata are omitted. | Use exclusive/preallocated physical capacity and either define crash-safe chain segment retirement/compaction or derive provision from bounded lifetime retention; include all charged objects. |
| Synchronized one-attempt actual-byte reselect | `REJECTED` with synchronization improvement retained | Both reviewers accept the actual-byte/append-lock direction fixes round34's event-size premise. The deadline still fails derivatively through the omitted whole-copy term; initial snapshot atomicity, reader-held-`L` write latency, supervisor costs, and whole-procedure retry termination remain unproved. | Retain actual durable byte offsets plus open-under-`L`; rederive the full read/write deadline and whole-read retry bound after copy/handoff semantics are fixed. |

### Round 36's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Finite one-million-event service epoch and 262-slot closure tail | `REJECTED` overall; finite-retention direction retained | Round36 Codex `revise/66` and Opus `revise/70` agree the explicit finite sequence-1-through-H ceiling answers round35's closure-window lifetime defect in the right direction. Opus finds the one-million-event constant has no event-rate/service-life derivation or owner approval, creates a permanent unmigratable exhaustion state without slot-consumption controls, and carries a 262-slot tail without bounding concurrent in-flight lineages. The closure-liveness claim also reaches bundle/mirror/receipt writes outside the reserved chain device. | Derive an owner-approved finite ceiling from a stated maximum event rate and service duration; add slot-consumption controls and a successor/migration decision before terminal exhaustion. Bound concurrent lineages and derive the closure tail from that bound. Narrow liveness to chain-storage exhaustion unless every closure-dependent store is reserved. |
| Exact fixed physical record slot and two-head durability protocol | `REJECTED` overall; slot framing/arithmetic retained | Both reviewers accept the physical-framing direction, and Opus reproduces `1,048,576 + 4 + 1 = 1,048,581`, the 4,096-byte-aligned `1,052,672` slot, and the total slot arithmetic. Both independently find the two generation/checksum heads lack a deterministic inactive-record write rule, authoritative recovery selection, valid/invalid/tie/rollover handling, and torn-record treatment; exactly-once fixtures therefore cannot be derived. | Preserve the fixed-slot framing and arithmetic. Specify the complete alternating-head write/recovery state machine, including every validity combination, generation ordering/rollover, crash boundary, and zero-before-reuse rule. |
| Dedicated thick filesystem, full preallocation, and total consumer table | `REJECTED` | Both reviewers independently find the procedure self-contradictory: `fallocate` can create allocated extents marked unwritten, while qualification rejects all unwritten extents. Opus further finds FIEMAP cannot prove global block exclusivity; the single-allocator boundary is asserted rather than mechanized; `f_bavail` units are ambiguous; the two one-GiB reserves lack their named derivation; and minimum device size is unstated. Codex nevertheless recognizes that dedicated thick storage and lifetime preallocation are the correct architectural direction. | Either accept and justify allocated-unwritten extents or mandate/budget full initialization and sync. Use FIEMAP only for inode coverage and separately enforce the allocator boundary. Express free space in bytes, derive/rename metadata headroom, state minimum formatted/raw capacity, and bound install/runtime costs. |
| Nine reachability and failure fixtures for the finite epoch | `REJECTED` | Codex and Opus find fixtures 5/6 depend on the missing head-selection algorithm and fixture 8 says repeated VERIFIED epochs despite the normative single-epoch lifecycle. Fixture 7 requires a qualification state the stated fallocate procedure is not shown to reach. Opus additionally finds no fixture drives maximum concurrent closure demand against 262 slots or bounds late-epoch replay/audit cost. | Correct fixture 8 to anchors if that is intended; add fixtures only after the head algorithm, implementable provisioning predicate, concurrency-derived closure tail, and performance bounds are normative. |

### Round 37's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Canonical two-head records and validity predicate | `REJECTED` overall; parity/checksum layout retained | Round37 Codex `revise/62` and Opus `revise/76` both find generation-zero digests unspecified, making bootstrap and fixture 1 irreproducible. Opus additionally finds bootstrap not crash-idempotent. Opus otherwise retains the fixed 65,536-byte whole-record checksum, explicit epoch/event/full-slot binding, and even-A/odd-B parity. | Define exact genesis digest derivation and an idempotent zero-event bootstrap state machine. Preserve the fixed record layout, full checksum domain, and parity rule. |
| Alternating slot-then-head append protocol | `REJECTED` overall; write ordering retained | Codex finds the decisive contradiction: a complete new head can persist before `fdatasync` returns or despite observed failure, so authority cannot depend on successful return as Parts 2/4 claim. Opus retains complete-slot sync before complete-head sync and the no-directory-mutation result, but finds zero-slot detection/cost unspecified and likely redundant; a non-crash mid-record error can leave a dangerous degraded one-head state. | Define authority by durable validity discovered on recovery and separate it from acknowledgement eligibility. Later isolate zero-slot removal/detection and degraded-one-head repair without changing the retained write order. |
| Adjacent-generation recovery selection table | `REJECTED` overall; table direction retained | Opus calls the table deterministic and correct under its stated model, and both reviewers accept that a valid greater adjacent record should win. It conflicts with Parts 2/4 in the ambiguous sync interval; startup-cache versus per-append execution, read-only consumer resolution, and authenticated offline both-invalid recovery are unspecified. | Retain parity and adjacent-generation selection. Align the commit point with recovered validity, then separately define execution frequency, consumer synchronization, and offline restoration. |
| Crash model and recovery fixtures | `REJECTED` | Codex shows fixture 4 forbids the valid `H+1` result allowed by the storage premise. Opus finds fixture 1 lacks genesis/bootstrap construction, fixture 2 is an impractical million-append run, sequential-crash induction absent, and slot durability conditional on round36's still-open preallocation mechanism. | Permit both recovered outcomes in the sync ambiguity, use bounded parity boundary fixtures, add bootstrap and sequential-crash induction, and state external durability dependencies conditionally. |

### Round 38's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Durable authority versus acknowledgement eligibility | `REJECTED` overall; crash-path split retained | Round38 Codex `revise/58` and Opus `revise/68` both accept that recovered durable validity, not an observed `fdatasync` return, decides authority after process interruption and that sync success controls only acknowledgement eligibility. Opus finds `AUTHORITATIVE(H)` ambiguously reuses `H`, while acknowledgement timing and idempotency remain external. | Preserve the crash-path split. Rename the recovered result variable and isolate acknowledgement/idempotency ordering later; do not treat in-process cached validation as durable authority. |
| Ambiguous target-head write/sync outcome table | `REJECTED` | Both reviewers accept the crash rows permitting `H` or `n`. Both independently find the live error branch unsound: immediate reread can validate complete dirty cached bytes whose failed writeback is not crash-stable, allowing `n` to disappear after restart. Latch persistence beyond `L` release is undefined. | After any target-head write/sync error, keep the writer process-lifetime fail-closed, assert no in-process authority, and resolve only after fresh process restart recovery. |
| Read-only recovery stability and retry boundary | `REJECTED` overall; durable-byte stability retained | Repeated read-only selection is stable for unchanged durable bytes, but that premise does not hold after a live sync error. Opus also finds commit-unknown correctness depends on an unvalidated request-identity/idempotency rule and may expose `n` before restart confirmation. | Apply stability only after restart over durable evidence. Keep the error-latched writer from exposing the unknown generation; isolate idempotency enforcement separately. |
| Ambiguous-interval fixtures | `REJECTED` | Both reviewers find fixtures 5/6 presume the process can distinguish persistent bytes from dirty cached bytes after sync error. The decisive cached-complete-but-lost/torn-after-crash fixture, persistent latch clear rule, and fault-injection layer are missing. | Fixture live readable `n` followed by restart-visible `H`/invalid target; require no live authority/ack/later append and restart-only resolution. Preserve other fixture gaps as open. |

### Round 39's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Unambiguous names and process-global writer latch | `REJECTED` overall; monotonic latch direction retained | Round39 Codex `block/40` and Opus `revise/74` find no atomic memory order or final linearization between latch publication and already-running head-dependent API results. Opus also requires the guarantee be scoped to this writer process, not shared-page-cache consumers. | Use acquire-release or sequentially consistent latch publication and require final validation under `L` and the same storage epoch before every writer head-dependent result. Scope the guarantee to the writer. |
| Target-head error transition | `REJECTED` | Opus finds observed-error-only triggering incomplete without one process-owned lifetime descriptor: reopen/loss and once-only writeback error delivery can yield false success. Short/uncompleted writes and slot write/sync errors are undefined; earlier durable acknowledgements and space/quota restart-loop consequences are unsettled. | Fix one lifetime head descriptor; conservatively latch on every detectable descriptor/reopen/incomplete-write/slot-or-head error or lost-error condition. State that undetectable errors remain under the retained successful-sync premise. Settle earlier durable acknowledgements and accept fail-closed capacity loops. |
| Process replacement and restart-only authority | `REJECTED` | Codex's decisive finding is that process replacement does not evict kernel page cache, so the replacement can validate the same cached nondurable candidate. Both reviewers also find supervisor termination, startup exclusion handoff, fencing, and stuck-old-process behavior unspecified. | Require a verifiable storage-epoch boundary such as completed host reboot plus new boot ID before selection; define exclusion handoff/fencing and refuse indefinitely if the old process cannot be fenced. |
| Error/cache fixtures | `REJECTED` | Both reviewers find no deterministic fault seam/crash instrumentation. Missing cases include cached bytes surviving process replacement, unobservable writeback, descriptor reopen/loss, short writes, slot errors, API publish races, old-process fencing, earlier acknowledgements, and capacity restart loops. | Name a deterministic injected block/writeback seam and instrumented latch/API crash points; cover every trigger, storage-epoch boundary, fencing result, and accepted fail-closed loop. |

### Round 40's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Boot epoch, lifetime descriptors, conservative triggers | `REJECTED` overall; real-boot/descriptor direction retained | Codex `revise/74`, Opus `revise/70`. Supervisor-only one-launch state is forgettable; `STARTING` is missing. Host boot-ID binding and concrete writeback qualification remain undefined. | Add only a trusted boot-scoped `/run` launch/taint fence; later isolate platform qualification and trigger enumeration. |
| Latch/API ordering and acknowledgement settlement | `REJECTED` overall; seq-cst/API linearization retained | Reviewers credit explicit ordering. Bounded queue overflow, exact `L` model, and prior durable-ack drain under ambiguous error scope remain unsound/open. | Preserve ordering; isolate queue/lock/ack issues later. |
| Host-reboot storage epoch and startup fencing | `REJECTED` overall; host-reboot boundary retained | Both accept process replacement is insufficient and real reboot is the right direction. Supervisor restart forgets launch/taint, so delayed or unauthorized same-boot writers remain possible. | Persist boot-only STARTING/TAINTED state in authenticated host `/run` tmpfs and refuse all same-boot restarts/contenders. |
| Deterministic fault seam and fixtures | `REJECTED` overall; fault-seam direction retained | Missing supervisor-restart/contender, namespaced boot ID, graceful reboot, queue-full, and concrete platform-qualification cases. | Add only supervisor-restart/contender fence fixtures now; preserve other fixture gaps open. |

### Round 41's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Host/path qualification | `REJECTED` | Container-private namespaces pass self/PID1 comparison; unprivileged inspection is unattainable; writer ownership and tmpfiles can delete the fence. | Move qualification/mutation to a root-owned host helper and pinned unit/tmpfiles contract. |
| Atomic launch state/lattice | `REJECTED` overall; lattice retained | O_EXCL exposes partial initial data and random failure may occur before reservation; contender taint conflicts with later HEALTHY. | Helper atomically publishes a fully formed STARTING or consumes TAINTED before fallible work. |
| Supervisor-independent contention/fence | `REJECTED` overall; `/run` direction retained | State survives supervisor restart, but same-UID deletion and routine cleanup can restore absence. | Root-owned non-writable directory/helper with no unlink/reset API and serialized contenders. |
| Fence fixtures | `REJECTED` | Missing partial-observer, helper privilege/restart, tmpfiles, same-UID deletion, and container cases. | Add those cases only; leave unrelated fixtures open. |

### Round 42's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Root provisioning and deployment scope | `REJECTED`; root-owned bare-host direction retained | Codex `revise/64` and Opus `revise/77` agree the earlier setup unit cannot transfer descriptors or helper memory to a later service. Helper restart loses original inode evidence, tmpfiles recreates deleted state, and VM/container qualification is not mechanized. | Fold provisioning and custody into the helper itself; use PID1-held boot-scoped socket/service FD-store evidence; drop VM/container support and fail closed on concrete host qualification. |
| Helper API and atomic publication | `REJECTED` overall; fully formed STARTING retained | Atomic fully formed publication is useful, but the socket may be unreachable, writer launch is circular, SO_PEERCRED/PID inspection races, connected-FD transfer is unaddressed, and reason/connection inputs are unbounded. | Put the socket outside the 0700 state directory, have the helper launch the writer after STARTING, pin peers with SO_PEERPIDFD, enforce a non-transfer premise, and close/bound the protocol. |
| Lattice, restart, and contention | `REJECTED` overall; irreversible lattice retained | Lifetime descriptor custody contradicts path reopen; removal plus tmpfiles recreation can re-establish absence; Requires/After lacks crash binding and readiness. | Retain exact PID1-held descriptors across helper restart, use socket activation plus Type=notify/BindsTo, fail closed on missing or mismatched custody, and accept crash-after-rename lockout. |
| Fence/helper fixtures | `REJECTED` | Missing cases include FD custody, tmpfiles recreation then restart, socket traversal, PID reuse, connected-FD transfer, connection exhaustion, platform floors, and proof fault hooks are absent from production. | Add only those realization fixtures; keep storage, queue, acknowledgement, lock, and graceful-reboot fixtures open. |

### Round 43's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Helper/PID1 custody lifecycle | `REJECTED`; helper-local boot custody retained | Codex `revise/56` and Opus `revise/74` agree `StartLimitBurst=1` cannot both forbid pre-custody retry and allow post-custody restart. FD-store acceptance is unconfirmed for non-pollable directory/file FDs, POLLHUP cannot detect their loss, first activation is ambiguous, and PID1's cgroup predicate is wrong. | Delete FD store and restart. Run one guardian once per boot; any exit is terminal until reboot, and every preexisting directory is fatal. |
| Launch, peer authentication, and bounded API | `REJECTED` overall; guardian-before-writer and pidfd direction retained | Initial seccomp enforcement point is not bootstrappable, independent writer launch remains possible, private systemd-manager control is unstable, and connection caps can starve the writer. | Guardian directly execs the one hashed writer child; child installs seccomp at first post-exec instruction; use a single-thread event loop with a reserved writer slot and no private manager interface. |
| Lock, record, lattice, and diagnostics | `REJECTED`; atomic tmpfs record direction retained | OFD/other lock choice and mode are absent; canonical record/checksum, repeat transitions, indefinite STARTING, and READ_DIAGNOSTIC response are undefined; fsync cannot surface tmpfs writeback errors. | Specify exact OFD flags/mode/lifetime, bounded canonical record and diagnostic formats, full idempotence table, indefinite STARTING lockout, and no fsync durability/error claim. |
| Realization fixtures | `REJECTED` | Fixtures rely on contradictory restart semantics and non-firing poll events, omit a fatal mkdir EEXIST rule, and assert launch/concurrency/record properties not established normatively. | Replace only with single-lifetime guardian, preexistence, OFD, exact-format, reserved-slot, first-instruction seccomp, and terminal-exit fixtures. |

### Round 44's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| One guardian lifetime and reboot boundary | `REJECTED`; non-restartable guardian retained | Codex `revise/58` and Opus `revise/73` credit deleting FD store/restart, but reset-failed plus dependency restart can reach a second pre-mkdir activation. Soft reboot preserves boot ID and `/run`; kexec and operator trust are undefined. | Narrow the guarantee to trusted host-root/PID1/unit operation, atomically consume an entry marker, classify root reset/target manipulation as audited violations, and define credited reboot forms. |
| Complete STARTING and guardian-only launch | `REJECTED` overall; complete STARTING/private writer channel retained | Exact response frames/ack consequences, executable immutability/current-image binding, and arch/compat/io_uring-complete seccomp remain open. | Preserve without modification; isolate these mechanisms only after lifecycle boundary review. |
| OFD/event-loop/lattice/terminal signaling | `REJECTED` overall; single guardian ownership and reserved channel retained | Same-OFD relock cannot prove uninterrupted ownership; clean/pre-exec exits do not uniformly fail/signal; public socket framing/group/NSS, writer EOF reaction, diagnostic flag, and reason precedence are incomplete. | Correct only exit/pre-exec lifecycle signaling now; retain lock, protocol, socket, and writer-loss items open. |
| Boot-guardian fixtures | `REJECTED` | Missing reset-failed, target restart, manager reload/reexec, soft reboot, kexec, assert signaling, compat syscall, and production-equivalent identity cases. | Add only lifecycle reset/reload/reboot/failure fixtures in the next isolated round. |

### Round 45's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Trusted lifecycle guarantee and PID1 latch | `REJECTED`; narrowed trusted-host scope retained | Codex `revise/64` and Opus `revise/63` agree failed state alone accepts new jobs. StartLimit interval/burst, finite expiry, dependency accounting, reexec persistence, and a real audit producer are unspecified. | Pin one finite StartLimit contract, state expiry honestly, fixture manager reexec, and remove unsupported root-audit claims. |
| Raw entry and attempt marker | `REJECTED` overall; atomic directory marker retained | Application entry/linkage is undefined; UMask is absent; marker verification is path-based; expected mount ID has no provenance. | Use one static raw-entry x86-64 guardian whose first syscall is mkdirat, UMask=0000, and fd-based current-/run verification with no prior-mount claim. |
| Reboot and termination reporting | `REJECTED`; marker-preserved soft-reboot lockout retained | OnFailure lacks SERVICE_RESULT/EXIT variables, zero exit is always success, SIGTERM cannot identify reboot type, custom/trusted journal fields conflict, and boot/mount predicates lack a durable comparator. | Use ExecStopPost's actual environment, flag zero exit there, use reboot-neutral manager termination, distinguish custom fields, and make marker presence the sole enforced epoch boundary. |
| Lifecycle fixtures | `REJECTED` | Start-limit expiry/reexec, raw entry, fd verification, ExecStopPost, zero-exit, and marker-only epoch cases are not mechanically specified. | Add only those mechanics fixtures; preserve every unrelated round44 finding open. |

### Round 46's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Finite start latch and protected event | `REJECTED` overall; finite-expiry disclosure retained | Codex `revise/67` shows EEXIST necessarily enters raw `_start`, contradicting the asserted at-most-one entry; both reviewers reject incomplete Type=notify/unit mechanics. The explicit 365-day expiry and honest loss of the no-marker guarantee remain useful. | Protect only successful atomic `ATTEMPT_CONSUMED`; use one exact Type=exec service/target/socket artifact with concrete start/stop timeouts and ordering. |
| Raw entry and FD marker qualification | `REJECTED` overall; first-mkdir direction retained | Linux/kernel floor and returned `STATX_MNT_ID_UNIQUE` mask are absent; no exact open/statx algorithm or invalid-marker semantics exists; service-wide UMask=0000 is unnecessarily permissive. | Pin Linux >=6.8, require returned mask bits, use restrictive service umask plus exact 0700 argument, and define an FD-only repeated inspection algorithm. |
| ExecStopPost transport and lifecycle classifier | `REJECTED`; ExecStopPost/reboot-neutral direction retained | Rows overlap; preassert 77/78 and invalid marker are lost; native journal transport, valid MESSAGE_ID, socket failure, and nonreserved reporter exit are absent. | Add atomic invocation-bound preassert transport, ordered first-match classifier, bounded native journal datagram/fallback, and nonreserved failure status. |
| Production and expiry fixtures | `REJECTED` | Reviewer evidence finds no systemd-254 qualification result, production unit property proof, executable 365-day test, or explicit marker-preserved soft-reboot case. | Verify production directives and manager behavior separately; model-check the pinned finite boundary honestly without fake clock, and prove soft reboot through marker preservation. |

### Round 47's four isolated parts

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Protected event and boot lifecycle | `REJECTED` overall; at-most-one `ATTEMPT_CONSUMED` retained | Codex `revise/72` and Opus `revise/76` both affirm that atomic mkdir plus EEXIST and the trusted-host exclusions support at most one successful consumption. Opus finds no ordering before chain consumers, no rescue/emergency scope, and unresolved writer/control-group and fence-socket lifetime. | Preserve the event proof. Keep boot ordering/target coverage and writer/socket lifecycle as named later mechanisms; do not bundle them with reporting. |
| Raw entry, marker, and sidecar | `REJECTED` overall; FD-only inspection retained | Returned-mask/FD inspection direction stands, but EEXIST and normal exit statuses are absent, systemd-reserved status aliases are not prohibited, ELF e_entry equality is unchecked, and sidecar publication is not explicitly runfd-relative. | Close only the raw status codebook in the reporting round. Preserve e_entry and FD-relative sidecar hardening as separate open items. |
| Lifecycle classifier/action/reporting | `REJECTED` | Start-limit refusal bypasses ExecStopPost; action values have no total mapping; accepted systemd-254 tuples are placeholders; A/V/I/U and transport failure are lost; forced reporter failure is absent from evidence. | Remove the unreachable row and add one bounded outside-unit refusal reporter plus total action, tuple, sidecar-state, and reporter-outcome mappings. |
| Expiry and artifact verification | `REJECTED` overall; honest model/execution split retained | Reviewers credit the no-fake-clock distinction, but require actual systemd-254 limiter-refusal evidence and complete classifier/codebook/boot-artifact fixtures. | Test the limiter refusal edge and outside reporter on pinned systemd 254; keep boot-placement and other lifecycle fixtures separate. |

### Round 48 consolidated replacement

| Item | Status | Evidence | Next action |
|---|---|---|---|
| Fixed-slot simplification | `REJECTED` overall; fixed-size/one-pass direction retained | Digest `20b752d6b5615096722a44380629663a0a0978dd08f42310086ff30cc739dce3`, invocation `154186d8-9c76-4faf-82e9-6c5bbf55aa8a`: Codex `block/18`, Opus `revise/68`, combined 18. The 4,096-byte slot arithmetic and fixed-length Ed25519 projection are coherent, but the packet ends after the substrate and cannot support implementation. | Preserve the simplification only. Complete the resolver, schemas/layout, signed header binding, append/fsync/ack/recovery, anti-truncation, authorization, attempt consumption, corruption and capacity contracts before another export. |
| Resolver semantics | `OPEN-CONFIRMED-BUG` | Both reviewers independently find the primary category/phase/risk/stuck-to-effort/role mapping, normalization, precedence, defaults, rule version, and replay test absent. | Define the complete deterministic resolver first; do not freeze a container schema before its decision content is known. |
| Fixed-chain durability and terminal states | `OPEN-CONFIRMED-BUG` | Both reviewers find no append/recovery/tail/fsync/ack protocol, no truncation anchor, no corrupt-slot path, and no slot-8193 behavior. | Specify exact persistence and recovery state machines, protected capacity or terminal exhaustion, and operator recovery with fault-injection fixtures. |

### Combined mechanism continuation override (rounds 34–48)

This row supersedes the round-33 stopping instruction in the main combined
mechanism row without rewriting its retained historical evidence.

| Combined mechanism | Status | Current evidence | Next action |
|---|---|---|---|
| Compact rejection-successor representation and disposed-bundle lifecycle | `OPEN-CONFIRMED-BUG` | Round48 is rejection twenty-one at combined **18**, down 54 from round47. It removed bundle/reclaim complexity but supplied only the beginning of the replacement packet. The resolver and all load-bearing durability, authorization, recovery, and capacity mechanics remain absent. | Reject round48 as incomplete. Return to one independently reviewable item per round, beginning with resolver semantics; keep durability, authorization, recovery, and capacity as separate later items. No further export is authorized by this ledger alone. |

## Source basis

The initial population was verified directly against both reviewers' structured
JSON in rounds 20 through 24 under
`.kstack/reviews/reasoning-effort-policy-2026-08-23-round*/`.

Round24 contains no durable `decision-brief.md`, `brief.md`, `design.md`,
`synthesis.md`, or gate artifact. Its canonical reviewed draft was recovered
from the verbatim packet recorded in `codex.stderr.log`; status and reviewer
claims come only from the signed `codex.json`, `opus.json`, and
`manifest.json`. No matching round-1 clarification record exists under
`.kstack/decisions/`.

Round26 evidence comes from the digest-bound packet, signed Codex/Opus
envelopes, `dual-complete` manifest, synthesis, deterministic checks, and gate
under `.kstack/reviews/reasoning-effort-policy-2026-08-23-round26/`. Because
combined confidence 70 beats the 66 rejection baseline, rejected option 1 is
unchanged; because Opus failed the item and 72 was not reached, no round26 row
is `VALIDATED`.

Round27 evidence comes from digest
`904d20034a05debdfd353aee5b7b6224de3dd0ac01b05f344926e80035ca57ac`,
the signed Codex 78 / Opus 72 envelopes, `dual-complete` manifest, synthesis,
checks, and round-27 gate. Combined 72 beats round26's 70 and reaches the
owner's one-off target, so no rejected-options entry is added. The gate remains
`BLOCKED` at configured 80. Item-level validation above is limited to claims
both reports accepted independently (the exact compact serializer and
no-third-header induction); all mixed or newly contradicted mechanisms remain
open.

Round28 evidence comes from digest
`96053b1cf6dc480011f4af1ecfc176f2d2098be84fb8ab303c510aa678a7f0d3`,
the signed Codex `block/68` and Opus `revise/78` envelopes, `dual-complete`
manifest, synthesis, checks, and round-28 gate. Both reviewers affirm the narrow
equal-content liveness predicate, but both identify crash-reclamation gaps in
the larger proposed lifecycle. Combined 68 is below round27's 72 baseline, so
the whole round28 ordering is recorded as rejected option 2 and no claim from
this round is promoted to `VALIDATED`.

Round29 evidence comes from digest
`8d557d34b471482e2f0027c847f152560561103d1017b057fef35720d8d94176`,
the signed Codex `block/52` and Opus `revise/74` envelopes, `dual-complete`
manifest, synthesis, checks, and round-29 gate (`BLOCKED`, combined
confidence 52). Both reviewers independently converge on the same two
defects (unrecoverable `d_new` behind a torn/absent `StagingIntent` with no
durable event, and reusable pending `refId` with no stated uniqueness rule),
and Opus additionally reports a deeper high-severity instance of the same
failure class (`SEC-29-A`) in the tombstone/admission interaction. Combined
52 is twenty points below round27's 72 baseline and is recorded as rejected
option 3; per the round-29 dispatch's standing rule, no round30 draft was
authored in this dispatch and no claim from round29 is promoted to
`VALIDATED`. The four points both reviewers left uncontradicted (removal-last
ordering, immutable-refId/mutable-role split, equal-content guard survival
against a constructed ABA case, and the reprinted refusal codes) are recorded
as retained evidence in the item row above, not as validated design.

Round30 evidence comes from digest
`d6ed91694342246b6a9bd6f0acb65bc0b051f1ff77ab42037578b6d71ed508a1`,
the signed Codex `block/18` and Opus `block/46` envelopes, `dual-complete`
manifest, synthesis, checks, and round-30 gate (`BLOCKED`, combined
confidence 18). Both reviewers independently construct a critical,
no-crash-required live-object-deletion counterexample
(`REP-30-01-SEC-01` in both reports) against the round's own new mandatory
slot-resolution sweep, and both independently find the `(refId, attempt)`
uniqueness claim self-contradicted by the packet's own torn-`SlotAttempt`
recovery row and the named durability primitive inconsistent with its own
principal use site. Combined 18 is fifty-four points below round27's 72
baseline — the sharpest drop of any round on this mechanism — and is
recorded as rejected option 4; per the round-30 dispatch's standing rule, no
round31 draft was authored in this dispatch and no claim from round30 is
promoted to `VALIDATED`. Round30's demotion of `CleanupTombstone` to a
non-authoritative cache plus the widened `Guarantee 1` is recorded as
additional retained evidence (both reviewers say it closes `SEC-29-A` on its
own narrow terms), alongside the four points retained from round29. Both
reviewers' recommendations independently flag, for the facilitator, that
this is the third consecutive rejection on this exact mechanism with each
round's fix introducing a new defect of the same severity class, and suggest
weighing a structurally different lifecycle approach (rejected-options
entry 3's Option C) before a fourth patch attempt.

Round31 evidence comes from digest
`ddcabe79d9dab3828dab096eb0e17929cb1413b954afac2b1ab51709e160535c`,
the signed Codex `block/16` and Opus `revise/76` envelopes, `dual-complete`
manifest, synthesis, checks, and round-31 gate (`BLOCKED`, combined
confidence 16). This round applied the missing normative rule both round-30
reviewers named: fold successor bundle staging into round 27's own original
single, never-split append-lock transaction (never releasing the lock
between `StagingIntent` durability and the successor event's own
durability), and retire `SlotAttempt`/`(refId, attempt)` entirely as no
longer necessary. Both reviewers independently and affirmatively accept that
this specific fix genuinely and structurally closes round 30's exact `SEC-01`
counterexample and that retiring `SlotAttempt` was correct. Both reviewers
also independently construct a new, previously-unaddressed race introduced
by this round's own choice to restore round 27's original out-of-lock
reclamation framing (a concurrent successor's pre-lock reuse decision is
never revalidated against a concurrent reclamation of the same content
address), and both separately find the packet self-contradicts on ledger
item 4 and on primitive definitions. Opus additionally finds ledger item 1's
new coverage proof rests on a non-monotone predicate that a
`RETAINED_VERIFIED`-sharing case falsifies, and raises a genuine,
Codex-independent dissent about the append lock's own undefined deployment
scope. Combined 16 is fifty-six points below round 27's 72 baseline and is
recorded as rejected option 5; per the round-31 dispatch's own standing rule,
this is the fourth consecutive rejection on this exact mechanism, and no
round-32 draft may be authored — a full structural redesign of the
compact-successor/disposed-bundle lifecycle is required instead. The single
never-split append-lock hold for staging-attempt uniqueness is recorded as
additional retained evidence (uncontradicted by either round31 reviewer) for
use as a component of that redesign, alongside the previously retained
removal-last ordering, refId/role split, equal-content guard, refusal codes,
and `CleanupTombstone` shape.

Round32 evidence comes from digest
`2acfcbc3eef805a55e2fee48ed2188e341676811f22584ad906e708ece80e124`,
the signed Codex `block/18` and Opus `revise/70` envelopes, `dual-complete`
manifest, synthesis, checks, and round-32 gate (`BLOCKED`, combined
confidence 18). This round implements the binding Fable structural ruling
(`.kstack/decisions/reasoning-effort-policy-2026-08-23-fable-round31-structural.md`)
in full: reclamation folded into the single append-lock hold as its first
substantive step, recomputed fresh from durable chain state and a directory
listing at every hold, with every auxiliary record from rounds 29-31
retired. Both reviewers independently construct the same critical
counterexample — the per-content-address `liveAddrs(H)` fix that closes
round31's non-monotonicity bug (spanning `CURRENT_SEALED` and
`RETAINED_VERIFIED` roles) admits two simultaneously-live canonical bundles,
and staging a third yields `3*K_b=24 MiB` against the stated 16 MiB
`CHECKPOINT_RESERVE_BYTES`, contradicting the packet's own "at most two
bundles ever" claim and invalidating the carried-forward Section 6 reserve
test as restated. Combined 18 is fifty-four points below round27's 72
baseline and is recorded as rejected option 6; per the round32 dispatch's
own standing rule, this is the fifth consecutive rejection of this
mechanism, and the first attempted after a binding Fable ruling, so it is
flagged to the facilitator as the structural redesign's first execution
attempt having failed — while both reviewers explicitly affirm the ruling's
selected direction (Option 1) remains correct and is not itself in
question. No round33 draft is authored in this dispatch. The concrete
alternative both reviewers converge on (explicit `RETAINED_VERIFIED` reserve
charge, general rather than acquirer-scoped `.staging/` reclamation,
step-3-completion-quantified Guarantee 1, set-membership-qualified
abort/crash deletion prose, one explicit reclaim/reserve ordering, a stated
process/thread model for the lock, and a reader/reclaim contract) is
recorded in full in
`.kstack/reviews/reasoning-effort-policy-2026-08-23-round32/synthesis.md`
for whichever future round re-attempts this mechanism. Newly retained
evidence from round32, uncontradicted by either reviewer: the Fable ruling's
fold-reclamation-into-the-lock structure itself, `INV-DURABLE-ONLY`, the
recompute-every-hold model for closing non-monotonicity (validated via the
H=100/105/110 worked example), and the resolution of the item-1/item-6
`refId` pre-allocation-vs-post-hoc-identity tension.

Round33 evidence comes from digest
`218b2b77e82b813cac2920ade27d1a2dcb86d5646cb61dde1ad62dc4e837a944`,
the signed Codex `revise/28` and Opus `revise/58` envelopes, `dual-complete`
manifest, synthesis, checks, and round-33 gate (`BLOCKED`, combined
confidence 28). This round applied round 32's own recorded seven-point
concrete alternative in full, plus disposition of Codex's `SEC-02`/`SEC-03`,
as nine individually-attributed items (see the dedicated table above).
Combined 28 is forty-four points below round27's 72 baseline and is
recorded as rejected option 7; per the round-33 dispatch's own standing
rule, this is the sixth consecutive rejection of this mechanism, and no
round-34 draft is authored in this dispatch. Both reviewers independently
construct the same critical finding: fix 7's reader/reclaim contract (open-
before-report, POSIX unlink-after-open) keeps a reclaimed bundle's blocks
allocated for as long as any reader holds it open, which breaks fix 1's
knife-edge `3*K_b` reserve equality and the freed-bytes-count-immediately
half of fix 5's ordering statement — the exact defect fix 1 was written to
close in this same packet, relocated rather than closed by fix 7's own
addition. This is flagged to the facilitator as the reserve-budget fix (fix
1) itself failing, not only the broader nine-item batch, per the batching
discipline's per-item attribution requirement; fixes 2, 3, 4, and 6 (plus
fix 5's ordering statement proper, and SEC-02's core corruption-refusal
reasoning) are validated and retained as evidence, not rejected. Combined
confidence (28) is higher than round32's (18), so this is not a fresh sharp
drop on previously-stable ground; both reviewers converge on the identical
root cause with no disagreement between them, so per this thread's own
Fable-triggering criteria no Fable round is triggered here either. The
concrete seven-point alternative both reviewers converge on for a future
round is recorded in full in
`.kstack/reviews/reasoning-effort-policy-2026-08-23-round33/synthesis.md`
and in rejected-options entry 7.

Round34 evidence comes from digest
`1df8223ce1792cfdf69d8e3bc87830d02e82be4989f906449b98bb2d119097e1`,
the signed Codex `block/34` and Opus `revise/55` envelopes, `dual-complete`
manifest, synthesis, checks, and gate (`BLOCKED`, combined 34). Both
reviewers independently reproduce the provision shortfall and reject the
event-count reselect premise; their item-specific dispositions are recorded
in the dedicated round34 table and rejected-options entry 8.

Round35 evidence comes from digest
`71d43bb2757a9137150d687c5969934bd95e2511a256508ffe333c13d07cb577`,
invocation `fd3d417c-e48e-43ec-8ebb-6e65d70f4a14`, signed Codex `block/38`
and Opus `revise/46` envelopes, `dual-complete` manifest, synthesis, checks,
and gate (`BLOCKED`, combined 38). This is the eighth consecutive substantive
rejection. Both reviewers converge on item 4's non-reserving quota/lifetime-
chain defect and item 2's partial-copy-integrity versus whole-copy-deadline
contradiction. Item 1's access enforcement/bootstrap and item 5's actual-byte
synchronization improve their round34 targets but do not close the combined
mechanism. Rejected-options entry 9 records the alternative; no round36 is
authorized.

Round36 evidence comes from digest
`439d547a790408feb71b2cd57d691a0c55b9578916f33552249a3f7a00ae04bf`,
invocation `86e9ab51-9e87-4462-9e62-3e74deb31b07`, signed Codex `revise/66`
and Opus `revise/70` envelopes, `dual-complete` manifest, synthesis, checks,
and gate (`BLOCKED`, combined 66). This is the ninth consecutive substantive
rejection, while improving 28 points over round35. Both reviewers converge on
Part 3's fallocate/unwritten-extent contradiction and Part 2's missing two-head
recovery algorithm. Fixed physical slots and finite sequence-1-through-H
retention are retained as direction, not accepted design. The part-attributed
results appear in the round36 table and rejected-options entry 10; no round37
export is authorized by this ledger. A separately directed local draft isolates
only the two-head recovery item.

Round37 evidence comes from digest
`d289012d532a0e184bcb5dec933381f075aa8f139d536d91606164130aa2e2ab`,
invocation `e59222e8-74b2-4993-a82e-7dd982c13738`, signed Codex `revise/62`
and Opus `revise/76` envelopes, `dual-complete` manifest, synthesis, checks,
and gate (`BLOCKED`, combined 62). This is the tenth consecutive substantive
rejection and a four-point combined regression from round36. Codex's decisive
finding is the Parts 2/4 commit-point contradiction; both reviewers also find
generation-zero construction missing. Round37's parity/checksum layout,
slot-before-head ordering, and adjacent-generation selection remain component
evidence only. The four-part attribution appears above and rejected-options
entry 11 records the alternative. A separately directed local round38 draft
isolates only recovered-validity commit semantics; no export is authorized by
this ledger.

Round38 evidence comes from digest
`b5c35070b22102392ff7a7d04e257758b64705c9ed3f2ce318cf658f015639de`,
invocation `16c3568a-5318-451e-8270-602855181070`, signed Codex `revise/58`
and Opus `revise/68` envelopes, `dual-complete` manifest, synthesis, checks,
and gate (`BLOCKED`, combined 58). This is the eleventh consecutive substantive
rejection and a four-point regression from round37. Both reviewers retain the
crash-path authority/acknowledgement split and independently reject the live
post-error reread as a durability oracle. The four-part attribution appears
above and rejected-options entry 12 records the alternative. A separately
directed local round39 draft isolates only the process-lifetime error latch and
restart-only authority rule; no export is authorized by this ledger.

Round39 evidence comes from digest
`107762db6237d9d819bf1441aa50c05736f0eed5456525f79aea93a27b45fefb`,
invocation `88b3848c-ca0a-4671-a587-0daba0661d8a`, signed Codex `block/40` and
Opus `revise/74` envelopes, `dual-complete` manifest, synthesis, checks, and
gate (`BLOCKED`, combined 40). This is the twelfth substantive rejection and an
eighteen-point regression from round38. Process replacement's false durable-
boundary premise is decisive; descriptor triggers, API linearization, startup
fencing, acknowledgements, fixtures, and restart-loop consequences are also
attributed above. Rejected-options entry 13 records the alternative. A local
round40 draft separately isolates the storage-epoch/latch mechanism; no export
is authorized by this ledger.

Round40 digest `97e6976fd20f958c826485791215ba374f0e0813f7c015198ee0d09d2ea6678b`,
invocation `f81f0cb1-175b-4c07-849d-40a59c57d65e`, has signed Codex
`revise/74` and Opus `revise/70`, dual-complete manifest, synthesis, checks,
and BLOCKED gate at combined 70. It is the thirteenth rejection and improves
30 points over round39. The four-part attribution appears above; rejected-
options entry 14 records the alternative. Local round41 isolates only the
boot-scoped `/run` fence; no export is authorized here.

Round41 digest `5aeadd444287187f76e5b3a683d9e0746df69d26c0518260632e4626e85fe22d`,
invocation `3ea2d589-252f-4e25-8ad9-b48e1ecb04fe`, has signed Codex
`revise/76`, Opus `revise/75`, dual-complete manifest, checks, synthesis, and
BLOCKED gate at combined 75. It is rejection fourteen and improves five points.
Attribution appears above; entry 15 records the alternative. Local round42
isolates only the root-owned host helper; no export is authorized.

Round42 digest `5eee4cbb5caeb38576e2a1e665012c72421dcf8b45e0bd3888b290b97c4c758c`,
invocation `a2ff6b2c-f686-46ee-adbd-ed60dfae0275`, has authentic Codex
`revise/64` and Opus `revise/77` envelopes, a dual-complete manifest,
deterministic checks, synthesis, and a reproduced BLOCKED gate at combined 64.
It is rejection fifteen and regresses eleven points from round41. Both
reviewers retain root ownership and fully formed atomic STARTING, but reject
the impossible cross-unit descriptor handoff, restart-unstable evidence,
tmpfiles recreation, incomplete socket/launch/peer authentication, and
unmechanized VM/container scope. The four-part attribution appears above and
rejected-options entry 16 records the alternative. Local round43 digest
`1acd801db9b654ae7b247145a3a6f4e7c26c90d044f2b93d05980d424636302a`
isolates only the PID1-held fence-root-of-trust realization, passed outbound
secret scan, and is not authorized for export by this ledger.

Round43 digest `1acd801db9b654ae7b247145a3a6f4e7c26c90d044f2b93d05980d424636302a`,
invocation `c7c95431-c30b-46b8-8a3a-3c1e4901e7b4`, has authentic Codex
`revise/56` and Opus `revise/74` envelopes, a dual-complete manifest,
deterministic checks, synthesis, and a reproduced BLOCKED gate at combined 56.
It is rejection sixteen and regresses eight points from round42. Reviewers
retain helper-local custody, atomic STARTING, and pidfd direction, but reject
the contradictory restart/start-limit lifecycle, unconfirmed and non-pollable
FD-store custody, precreated-directory adoption, wrong PID1 cgroup predicate,
and incomplete lock/record/lattice/diagnostic/launch/seccomp/concurrency rules.
The four-part attribution appears above and rejected-options entry 17 records
the alternative. Local round44 digest
`534059fbbe3981efd3124c212fc5d6895647830ce1b263e5d91aa2d6e7e434d5`
isolates only the non-restartable boot guardian, passed outbound secret scan,
and is not authorized for export by this ledger.

Round44 digest `534059fbbe3981efd3124c212fc5d6895647830ce1b263e5d91aa2d6e7e434d5`,
invocation `2ff8a7cd-fae2-4ffd-bd3f-bc62ac1ad341`, has authentic Codex
`revise/58` and Opus `revise/73` envelopes, a dual-complete manifest,
deterministic checks, synthesis, and a reproduced BLOCKED gate at combined 58.
It is rejection seventeen and improves two points over round43. Both reviewers
retain the non-restartable guardian, exact STARTING, guardian-only launch, and
private writer channel, but reject the absolute pre-marker lifecycle claim,
unclassified soft reboot/kexec, incomplete clean/pre-exec failure signaling,
and retained protocol/OFD/executable/seccomp/socket/writer-loss defects. The
four-part attribution appears above and rejected-options entry 18 records the
alternative. Frozen local round45 digest
`27feff302bde4868971e1ecd098223f2de549fba081112b35a660c07d07204a7`
isolates only the honest lifecycle-boundary correction, passed outbound secret
scan, and is not authorized for export by this ledger.

Round45 digest `27feff302bde4868971e1ecd098223f2de549fba081112b35a660c07d07204a7`,
invocation `b00f422d-8a03-465e-8d68-ce4ff0b81826`, has authentic Codex
`revise/64` and Opus `revise/63` envelopes, a dual-complete manifest,
deterministic checks, synthesis, and a reproduced BLOCKED gate at combined 63.
It is rejection eighteen and improves five points over round44. Reviewers
retain the narrowed trusted-host scope and atomic attempt marker, but reject
failed-state-as-latch, absent finite StartLimit mechanics, undefined raw entry,
incorrect OnFailure result transport, zero-exit/reboot classification,
unsupported root-audit claims, unenforceable cross-boot predicates, and path/
umask marker verification. The four-part attribution appears above and
rejected-options entry 19 records the alternative. Frozen local round46 digest
`2975a495992dc0db328a01e47f4bed1a57fd651d98736f3f52dc22b2e2b44f6b`
isolates only exact systemd lifecycle mechanics, passed outbound secret scan,
and is not authorized for export by this ledger.

Round46 digest `2975a495992dc0db328a01e47f4bed1a57fd651d98736f3f52dc22b2e2b44f6b`,
invocation `e9203392-18f9-4bc3-a462-7649a2982372`, has authentic Codex
`revise/67` and Opus `revise/72` envelopes, a dual-complete manifest,
deterministic checks, synthesis, and a reproduced BLOCKED gate at combined 67.
It is rejection nineteen and improves four points over round45. Reviewers retain
the finite start-limit disclosure, raw-entry marker direction, ExecStopPost,
reboot-neutral result handling, and marker-only epoch, but reject the raw-entry
claim, incomplete Type=notify/unit artifact, ambiguous classifier/marker
inspection, absent kernel/mask floor, unspecified journal transport, and fake
365-day verification. The four-part attribution appears above and rejected-
options entry 20 records the alternative. Frozen local round47 digest
`ddfdcf16db68057f98e32eaa89e6e4bcea5e461d5721b6d682e59714bfe3c0a3`
isolates only normative lifecycle artifact completeness, passed outbound secret
scan, and is not authorized for export by this ledger.

Round47 digest `ddfdcf16db68057f98e32eaa89e6e4bcea5e461d5721b6d682e59714bfe3c0a3`,
invocation `3b53ccb4-ad65-4844-957f-58510b1e3d8d`, has authentic Codex
`revise/72` and Opus `revise/76` envelopes, a dual-complete manifest,
deterministic checks, synthesis, and a reproduced BLOCKED gate at combined 72.
It is rejection twenty and improves five points over round46. Both reviewers
retain at-most-one `ATTEMPT_CONSUMED`; they reject the silent limiter-refusal
edge, incomplete action/tuple/exit/sidecar codebooks, and forced-reporter result
evidence. Opus additionally preserves boot ordering/coverage, writer/socket
lifetime, ELF entry, and sidecar-path findings as separate open mechanisms. The
four-part attribution appears above and rejected-options entry 21 records the
alternative. A local round48 may isolate only lifecycle result observability;
no export is authorized by this ledger.

## Accepted endpoint and bug closure — rounds 49–67

Rounds 49–67 abandoned the storage, durability, hostile-realm, and broad
wire-contract branches rather than carrying their defects forward. The
retained direction is a proportional trusted internal pure resolver, reviewed
one membership/behavior item at a time. Historical reviewer envelopes remain
under `.kstack/reviews/reasoning-effort-policy-2026-08-23-round49/` through
`round67/` and are not rewritten here.

Round 64 retained the behavioral simplification at Codex 95 / Opus 76,
combined 76. Round 66 reached Codex 97 / Opus 74 but exposed missing invalid
classes. Round 67 completed that finite class table and reached Codex 97 / Opus
74, combined **74**, satisfying the owner's final minimum of 72. No further
score-improvement round is authorized.

The positive-observability, counter-fixture, table-integrity, normalization-
claim, Symbol/BigInt harness, invalid-value reflection, and mutable-allow-list
defects are corrected in
`reasoning-effort-policy-2026-08-26-round67-bug-closure.md`. That addendum is the
normative correction to the accepted endpoint and does not revive the rejected
storage or hostile-realm designs.
