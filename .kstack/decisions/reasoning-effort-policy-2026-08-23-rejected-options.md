# Rejected-options ledger: reasoning-effort policy

**Thread:** `reasoning-effort-policy-2026-08-23`  
**Created:** 2026-08-25  
**Status:** living document; update in place  
**Baseline for comparison:** round 24 combined confidence 66

This ledger records whole mechanisms that regress confidence or are otherwise
shown unsound. It complements the subordinate per-item ledger and does not
replace the formal design gate.

## Rejected-options ledger

### 1. Prefix-only seal obligation reserving only ordinary slot 258

- **What was tried:** Round25 isolated `REP-25-01`. It derived a supposedly
  prefix-only `sealRequired` predicate from interval closure or current lag 257,
  refused every non-checkpoint request while set, and reserved ordinary slot
  258 for a checkpoint that creates the sole SEALED candidate.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round25/`.
- **Confidence effect:** Codex 68 and Opus 55 produced combined confidence 55,
  eleven points below the round24 baseline of 66.
- **Why rejected:** The predicate conflates chain-derived state with the
  request-dependent key-overhang case: a refused overhang event leaves no
  authenticated fact that a later request can replay. More importantly, the
  mechanism reserves slot 258 for sealing while the carried-forward tail shape
  used that slot for `checkpoint-verified`; it does not prove that the candidate
  created at the boundary can be disposed. It also makes partial-interval or
  lifecycle-only checkpoint constructibility load-bearing without establishing
  it, and it does not re-derive deadline neutrality for the newly admitted tail
  shapes. The option can therefore relocate the stall from zero candidates to
  an undisposable or unconstructible candidate.
- **Alternative:** Keep the pre-admission-barrier shape, but make the next
  proposal prefix-pure and jointly reserve a conforming seal plus its
  disposition. State exact partial-interval and lifecycle-only checkpoint
  validity, include a liveness invariant for every one-candidate state, and
  re-derive the deadline for every resulting tail shape. At minimum compare
  reserving from `L_max-2` with an explicit bounded `checkpoint-verified`
  exemption. A future packet must not build on round25's slot-258 mechanism.

### 2. Role-reference reclamation that removes cleanup evidence before deletion durability

- **What was tried:** Round28 isolated `REP-28-01 / SEC-27-A`. It separated
  logical bundle references from immutable content-addressed objects, protected
  current/staged/retained-VERIFIED references, permitted physical deletion only
  at replay-derived reference count zero, and classified the same cleanup's
  `RETRY_AFTER_REPAIR` as a bounded state-mutating repair result.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round28/`.
- **Confidence effect:** Codex 68 and Opus 78 produced combined confidence 68,
  four points below round27's 72 baseline and below the owner's rejection
  floor. The option must not be built forward from.
- **Why rejected:** Both reviewers accepted that the equal-content reference
  rule itself prevents deletion of the live successor. The full option is
  nevertheless crash-unsafe. Step 3 removes and fsyncs the disposed reference
  and completed transaction metadata before deleting the zero-reference old
  object and fsyncing its directory. A crash in that interval loses the only
  specified durable indication that cleanup remains owed. Opus also identified
  the earlier staging analogue: a newly fsynced object whose staging metadata
  is torn is excluded from protection but is never named by the `d_old`-only
  cleanup trigger. Repeated crashes can strand unbounded orphan objects, defeat
  the 16-MiB reserve claim, and block availability. The normative identity is
  also inconsistent because `(ownerEventSequence, role)` is declared the key
  while role is described as mutating in place.
- **Alternative:** Keep the independently supported separation between logical
  references and physical content, but replace the rejected cleanup ordering
  with a durable-intent state machine. Give each reference an immutable ID that
  does not contain mutable role. Persist and fsync a staging intent naming the
  transaction and digest before making a new physical object visible. Persist
  a cleanup tombstone through the role transition; on abort or post-event
  replay, rebuild chain-derived protected references, delete only zero-reference
  objects named by durable intents, fsync the bundle directory, and only then
  remove/fsync the intent or tombstone. Replay must exhaust the single pending
  intent idempotently before returning the repair result. Add fixtures for a
  crash at every persistence boundary, including torn/absent staging metadata,
  and either enumerate all physical objects as a verified secondary orphan
  sweep or prove the write ordering makes unmarked objects unreachable. Reprint
  the five state-free refusal codes in the packet so the repair-result
  classification is self-contained.
  **Attempted in round 29 and rejected; see entry 3 below. Round 29's own
  recorded alternative was attempted in round 30 and rejected; see entry 4
  below.**

### 3. Durable-intent/tombstone reclamation with a reused pending refId and a non-load-bearing tombstone gating a load-bearing admission rule

- **What was tried:** Round29 isolated `REP-29-01 / SEC-27-A`, applying entry
  2's own recorded alternative: an immutable `refId` (owning event's physical
  sequence) with `role` as a separate chain-replay-derived mutable attribute;
  a `StagingIntent` fsynced before any canonical-namespace insertion, proved
  via a write-ordering argument to make unmarked objects unreachable; a
  `CleanupTombstone` persisted through the role transition and framed as a
  non-load-bearing accelerator backed by an independent chain-replay
  re-derivation (`Guarantee 1`); and a removal-last rule deleting/fsyncing
  before removing either durable-intent record.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round29/`.
  Digest `8d557d34b471482e2f0027c847f152560561103d1017b057fef35720d8d94176`.
- **Confidence effect:** Codex `block/52` and Opus `revise/74` produced
  combined confidence 52, twenty points below round27's 72 baseline and well
  below the owner's rejection floor. The option must not be built forward
  from.
- **Why rejected:** Both reviewers independently constructed the identical
  counterexample: after the canonical rename (Section 2 step 4) but before
  the successor event becomes durable, the sole `StagingIntent` naming
  `d_new` can be lost, torn, or become unparseable. Chain replay then
  contains no committing event, so `d_new` cannot be recovered, and the
  packet's only recovery path for this exact state is the explicitly
  optional, non-safety-critical namespace sweep. This falsifies the packet's
  own "there is no third case" claim and leaves item 5 (orphan reachability)
  genuinely unclosed. Both reviewers also independently found that `refId`,
  defined as the reserved pending sequence `N=H+1`, is released without
  being consumed when a pre-event stage aborts, so a later transaction can
  reserve the identical `refId` with no stated uniqueness rule — directly
  contradicting Section 1's own "assigned once ... never reused" identity
  claim. Opus additionally found a deeper, higher-severity instance of the
  same failure class (`SEC-29-A`, high): the `CleanupTombstone` is described
  as a non-load-bearing accelerator in the same section that names it as the
  mechanism answering round 27's carried admission gate ("no second successor
  may stage while cleanup is pending"), with no specified chain-replay
  fallback for that gate when the tombstone is absent. A crash between event
  durability and tombstone durability can therefore let a second successor
  stage while the first `d_old` obligation is still outstanding; `Guarantee
  1`'s single-obligation lookup then names only the newer obligation, and the
  older one becomes permanently underivable from the chain — round 28's
  rejection class (a crash losing the durable indication that cleanup remains
  owed) reintroduced through the admission path rather than eliminated. What
  the round did genuinely close, uncontradicted by either reviewer: the
  removal-last ordering itself (Section 3 steps 1-5) is correct and answers
  round 28's evidence-before-deletion defect; the immutable-`refId`/mutable-
  chain-derived-`role` split resolves round 28's key/mutation inconsistency at
  the level of role mutation specifically; the equal-content guard (Section 4)
  remains sound, including against an ABA counterexample Opus constructed and
  found defeated by the independently-rebuilt `refCount(d)==0` requirement;
  and Section 6's reprinted refusal codes close item 6's packet-completeness
  gap. None of this is sufficient to reach the reject floor because the
  underlying orphan-reachability and refId-identity defects are load-bearing
  for the round's central crash-safety claim.
- **Alternative:** Retain the four uncontradicted fixes above (removal-last
  ordering, immutable-refId/mutable-role split, equal-content guard, reprinted
  refusal codes) as evidence, not validated design. In an isolated next round,
  resolve exactly what Opus's recommendation specifies as the path to close
  this item: (a) make `refId` genuinely unique — either never release a
  reserved sequence on an aborted pre-event stage, or add a generation/attempt
  counter to the `StagingIntent` key, and state the record's uniqueness rule
  explicitly; (b) make the `StagingIntent` self-identifying under corruption
  — a per-record checksum plus either a redundant copy or a record that
  embeds `d_new` recoverably, so a torn intent yields "absent AND `d_new`
  recoverable" rather than "absent AND nameless" — or alternatively make the
  namespace sweep load-bearing in a bounded background lane and accept its
  latency rather than leaving it optional on the acquisition path; (c)
  specify admission's chain-replay fallback for the pending-cleanup gate when
  no tombstone is present, and widen `Guarantee 1` from the single
  immediately-superseded reference to all unsatisfied obligations derivable
  from the chain, so the admission gate is never solely dependent on the
  tombstone's survival; (d) name which storage-layer durability branch is
  normative instead of relying on an unnamed "atomic multi-file durability
  barrier." Add the missing fixture sub-case (a torn intent where the
  canonical rename already completed, asserting both fail-closed
  non-deletion and eventual bounded reclamation) before re-submitting. A
  future packet must not build on round29's unresolved-refId/optional-sweep
  shape.

### 4. Durable-intent/tombstone reclamation with a mandatory abandonment sweep whose trigger conflates "not yet durable" with "abandoned"

- **What was tried:** Round30 applied entry 3's own four-point alternative in
  full: a `(refId, attempt)` composite key with an explicit uniqueness rule
  (`SlotAttempt`, Section 1a) to close `REP-29-01-SEC-02`; a mandatory,
  reserve-bounded "load-bearing slot-resolution sweep" (Section 2c),
  triggered the next time a new staging attempt targets a slot a prior
  attempt already targeted, to close `REP-29-01-SEC-01`'s orphan-
  reachability gap; a widened `Guarantee 1` covering every chain-derived
  `DISPOSED` obligation plus an admission fallback that never depends solely
  on `CleanupTombstone` survival (Sections 3a-3b), to close `SEC-29-A`; and a
  named single-file `write-then-fsync-then-rename-then-fsync-directory`
  durability primitive (Section 2a) to close the unnamed "atomic multi-file
  durability barrier." It additionally moved the round 29 `SEC-29-C`
  byte-validate-and-reuse work outside the append lock.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round30/`.
  Digest `d6ed91694342246b6a9bd6f0acb65bc0b051f1ff77ab42037578b6d71ed508a1`.
- **Confidence effect:** Codex `block/18` and Opus `block/46` produced
  combined confidence 18, fifty-four points below round27's 72 baseline and
  the sharpest drop of any round on this mechanism (round28: -4 from round27;
  round29: -16 from round28; round30: -34 from round29). The option must not
  be built forward from.
- **Why rejected:** Both reviewers independently constructed the identical,
  no-crash-required counterexample against the round's own new mandatory
  sweep (Section 2c), rating it critical (`REP-30-01-SEC-01` in both
  reports). Section 2b's append lock is released at the end of step 4
  (canonical rename/fsync), strictly before the successor event becomes
  durable. Section 3b's admission "cleanup is pending" predicate recognizes
  only a `DISPOSED` reference with `refCount==0` as blocking a second
  attempt; it never recognizes a durable-`StagingIntent`-but-not-yet-event-
  durable `STAGED_SUCCESSOR` as blocking anything. A second staging attempt
  can therefore be admitted at the same slot while a first attempt is
  genuinely still in flight (not aborted, merely slow), and Section 2c's
  torn-record branch — finding the live first attempt's canonical object
  matches neither `ProtectedRefs` nor its own not-yet-written intent —
  deletes it. This violates the packet's own clause-1 safety statement ("no
  crash... can delete a live object") with **no crash required at all**,
  which is strictly worse than the availability-only leaks rounds 28 and 29
  were rejected for. Both reviewers trace this to the identical root cause:
  Section 2c's stated justification ("H has not moved" proves abandonment)
  conflates "not yet durable" with "abandoned," and Sections 1a/2c both cite
  a "round 27 carried single-flight admission gate" that is never actually
  stated anywhere in this packet in a form covering in-flight staging. Both
  reviewers also independently found: the `(refId, attempt)` "globally
  unique... no exception" claim (Section 1a) is self-contradicted by
  Section 5's own torn-`SlotAttempt` recovery row, which resets `attempt` to
  1 and can reuse a pair a prior attempt already used; and the named
  durability primitive (Section 2a) does not match its own principal use
  site (Section 2b step 4 renames cross-directory and fsyncs after, not
  before, the rename, contradicting the primitive's own stated precondition
  and ordering). Opus additionally found a TOCTOU window on the reuse path
  introduced by the round's own `SEC-29-C` fix (an unprotected reuse-target
  object can be deleted by a concurrent cleanup in the interval between
  Section 2b's now-unlocked step 1 and the intent's creation at step 3) and
  a reclamation/reserve deadlock (an unreclaimed orphan can saturate the
  two-object reserve and cause `CHECKPOINT_CLOSURE_RESERVE_REQUIRED` to
  refuse the only attempt that could reclaim it). Codex additionally found
  the admission predicate (Section 3b) contradicts its own acceptance
  fixture 4 (the equal-content case has `refCount(d)==1`, which the stated
  predicate reads as "no cleanup pending" although the fixture requires
  `CHECKPOINT_DISPOSITION_LANE_ACTIVE`). What round 30 did not regress,
  uncontradicted by either reviewer: the removal-last ordering, the
  immutable-refId/mutable-role split, the equal-content guard, and the
  reprinted refusal codes (all retained verbatim from round 29) remain
  sound; the demotion of `CleanupTombstone` to a non-authoritative cache and
  the widened `Guarantee 1` are the right shape and do close `SEC-29-A` on
  their own narrow terms; naming a concrete durability primitive at all is
  genuine progress over round 29's unnamed barrier; and the diagnosis behind
  moving byte-validation out of the lock was correct even though the
  resulting sequence is unsafe as written.
- **Facilitator escalation (both reviewers independently converge on this):**
  this is the third consecutive round (28, 29, 30) in which the load-bearing
  fix for one round's rejected defect introduces a new defect of the same
  severity class in an adjacent section of the same mechanism, and round
  30's new defect (live-object deletion with no crash) is strictly worse
  than what it replaced. Opus states explicitly: "That pattern is evidence
  for the packet's own Option C — the compact-successor/disposed-bundle
  lifecycle likely needs a structurally different approach rather than a
  fourth patch." Codex independently reaches the same conclusion. Per the
  round-30 prompt's own standing rule, this is flagged to the facilitator
  rather than silently retried as a fourth patch attempt.
- **Alternative:** Do not attempt a fifth patch of this exact mechanism
  without first adding the one normative rule both reviewers independently
  identify as the actual missing root fix, stated once and referenced
  everywhere it is relied upon: **at most one staging attempt may be
  outstanding at a time, and admission refuses a second attempt for the
  full duration a prior attempt's `StagingIntent` is durable and
  unresolved — not only once its event is durable and later disposed.**
  This requires the append lock (or an equivalent durable fence/lease) to be
  held, or a durable "staging in progress" marker to be consulted by
  admission, across the entire pre-durability window, not only across
  Section 2b's metadata steps. Concretely this means either (a) holding the
  append lock from staging-attempt start through event durability instead
  of releasing it after canonical installation, accepting the resulting
  longer lock-hold cost, and separately re-solving `SEC-29-C`'s cost concern
  without reopening this window; or (b) introducing a durable, chain-
  independent "attempt is currently open" record that admission always
  checks in addition to (not instead of) the widened Guarantee 1, with its
  own explicit crash-recovery story (what happens if the process holding an
  open attempt dies without ever releasing or resolving it). Also required
  before any further attempt: an explicit statement of what chain replay is
  guaranteed to cover relative to the still-unchanged round 27 checkpoint
  horizon (Opus's `SEC-02`: the widened Guarantee 1's claimed totality over
  "every `DISPOSED` refId" is asserted, not established, against a replay
  window elsewhere described only as bounded to ~262 events); a defined
  integrity/checksum field on `SlotAttempt`, `StagingIntent`, and
  `CleanupTombstone` so the torn-record recovery branches these three
  rounds have each relied on are actually reachable and distinguishable
  from Section 2a's own no-partial-write claim; a corrected durability
  primitive (or a second, explicitly cross-directory variant) that actually
  matches the canonical-installation rename; and a stated relative
  ordering between the load-bearing sweep and the reserve check to close
  the deadlock. Given this is the third consecutive rejection at increasing
  severity on this exact mechanism, the facilitator should weigh Option C
  (a structurally different compact-successor/disposed-bundle lifecycle
  that trades some efficiency for a smaller crash-safety surface) against a
  fourth patch attempt before proceeding. A future packet must not build on
  round30's release-lock-before-durability/abandonment-by-non-movement
  shape.
  **Attempted in round 31 (option (a) of the alternative above) and
  rejected; see entry 5 below.**

### 5. Single never-split append-lock transaction (closes round 30's exact interleaving) whose own reclamation-outside-lock and non-monotone coverage proof reopen adjacent no-crash-required races

- **What was tried:** Round 31 isolated `REP-31-01`, applying entry 4's
  option (a) in full: folded successor `StagingIntent` write, canonical
  bundle installation, and the successor event's own append/fsync into one
  continuous append-lock hold identical in scope to round 27's original
  (pre-round-28) Section 3 framing, releasing the lock only after the event
  is durable — never in between. Retired `SlotAttempt` and the
  `(refId, attempt)` composite key entirely (rather than patching them
  again) as no longer necessary once a second attempt cannot structurally
  begin while a prior one holds the lock. Added: an explicit
  integrity/checksum field (`IntegrityChecksum`, a fixed-point SHA-256
  truncation) on `StagingIntent` and `CleanupTombstone`; two named
  durability primitives (`WRITE-DURABLE` for same-directory metadata writes,
  a new `CROSS-RENAME-INSTALL-DURABLE` for the canonical bundle's actual
  cross-directory installation); a new VERIFIED-admission precondition
  (Guarantee 1 must be empty for the closing lineage) offered as the basis
  of an explicit chain-replay coverage proof bounding Guarantee 1's replay
  scan to the current closure lineage's origin; and a structural argument
  that folding recovery into round 27's pre-existing step 2 orders
  reclamation before the reserve check without a new independent rule.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round31/`.
  Digest `ddcabe79d9dab3828dab096eb0e17929cb1413b954afac2b1ab51709e160535c`.
- **Confidence effect:** Codex `block/16` and Opus `revise/76` produced
  combined confidence **16** (minimum, not average), fifty-six points below
  round 27's 72 baseline. The option must not be built forward from.
- **Why rejected:** Both reviewers **independently and affirmatively
  accept** that the single never-split append-lock hold genuinely closes
  round 30's exact `SEC-01` counterexample for the specific interleaving it
  used — a second staging attempt observing a still-live first attempt as
  "abandoned" because the lock had been released early is now structurally
  impossible, not merely refused by a sharper heuristic. Opus states this as
  its own accepted point (1); Codex's `recommendation` field states the same
  conclusion directly. Both also independently accept that retiring
  `SlotAttempt`/`(refId, attempt)` was correct and left no residual gap.
  Nevertheless, both reviewers **independently construct a new,
  previously-unaddressed race** introduced by this round's own choice to
  restore round 27's original framing of old-bundle reclamation as running
  *outside* the append lock (Section 2c step 8): a concurrent successor's
  pre-lock reuse decision (Section 2c step 1, which decides whether to
  install a new canonical object or adopt an existing one at the same
  content address) is never re-validated against a concurrent reclamation
  that can delete that same address between the pre-lock observation and
  the under-lock install/skip decision — or even after the referencing
  event becomes durable. Codex rates this critical (`SEC-01`, the sole
  dispositive reason for its `block`) and separately finds a related high
  finding (`SEC-02`: a durable successor event can end up naming a
  canonical object that was concurrently deleted). Opus independently
  derives materially the same interaction as its own `SEC-04` (medium) while
  separately finding a second, more severe defect from a different angle:
  Guarantee 1's emptiness predicate (`SEC-01`, high) is not monotone across
  the VERIFIED boundary the round's new coverage proof (Section 3c) depends
  on — a `DISPOSED` reference sharing a content address with a
  `RETAINED_VERIFIED` reference can satisfy the emptiness precondition at
  closure time and become a genuinely outstanding, permanently
  unreclaimable obligation later, once the sharing reference is dropped,
  originating before the lineage-bounded replay window the proof relies on
  can ever see it — directly falsifying the round's own second safety
  clause ("no crash ... can permanently lose the fact that a deletion
  remains owed"). Both reviewers separately find the packet self-
  contradicts on ledger item 4: Section 2c step 2 returns
  `RETRY_AFTER_REPAIR` and explicitly forbids admitting the caller's own
  request in that acquisition, which is incompatible with Section 3d's and
  acceptance fixture 8's claim that reclamation and the reserve check occur
  in the *same* acquisition (Opus); the deterministic static check
  requiring "no text names `SlotAttempt`" is unsatisfiable given the packet
  itself discusses and retires that name by that name (Codex). Both
  reviewers also separately flag primitive-definition inconsistencies:
  the pre-lock procedure's shorthand does not match `WRITE-DURABLE`'s own
  defined steps (Codex), and `CROSS-RENAME-INSTALL-DURABLE`'s stated
  precondition directly contradicts its own step 3 (Opus, independently).
  Opus additionally raises a genuine, Codex-independent dissent: the packet
  states an explicit same-filesystem deployment precondition for
  `CROSS-RENAME-INSTALL-DURABLE` but no corresponding precondition for the
  append lock's own scope (single-host vs. multi-host/shared-storage), even
  though a lock-exclusivity failure on exactly the network/cluster
  filesystem class Section 2a itself names as a realistic threat would
  restore round 30's `SEC-01` with no crash required. What round 31 did
  genuinely close, credited by both reviewers independently: the exact
  round 30 no-crash-required counterexample (a second attempt exploiting an
  early lock release to delete a still-live first attempt's own object) is
  closed by construction; retiring `SlotAttempt`/`(refId, attempt)` is
  correct and complete; the integrity-checksum three-way partition
  (absent / valid-but-unexpected / fails-its-own-check) is well-defined and
  the fixed-point construction is sound (Opus's accepted point 3).
- **Facilitator escalation:** this is the **fourth consecutive round**
  (28, 29, 30, 31) in which the load-bearing fix for one round's rejected
  defect — even a fix, like round 31's, that both reviewers credit with
  genuinely and structurally closing the immediately preceding
  counterexample — surfaces a new defect of comparable or greater severity
  in an adjacent part of the same mechanism (this time: old-bundle
  reclamation racing with a concurrent reuse decision, and a non-monotone
  coverage proof, both introduced by the very act of restoring round 27's
  original out-of-lock reclamation framing while tightening everything
  else). Per this round's own standing rule: **do not attempt a round-32
  patch of this mechanism.** A full structural redesign of the
  compact-successor/disposed-bundle lifecycle is required, per both
  reviewers' pattern of findings across all four rejected rounds.
- **Alternative:** Do not attempt a fifth patch of this exact mechanism.
  Any structural redesign must, at minimum, resolve what four rounds of
  patching have now shown cannot be safely bolted on piecemeal: (a) a single
  synchronization boundary that covers not only staging-attempt uniqueness
  (round 31's genuine success) but also old-bundle physical reclamation and
  new-object reuse/adoption together, so a delete and an adopt of the same
  content address can never interleave regardless of which acquisition or
  lock each belongs to; (b) a chain-replay coverage argument for outstanding
  cleanup obligations that is sound under reference-count sharing with
  long-lived roles (`RETAINED_VERIFIED`) rather than only at the instant of
  lineage closure — likely requiring either reference-counted obligations
  that are tracked independent of any bounded replay window, or a proof that
  no such reference can ever be dropped after closure; (c) a single,
  explicitly-scoped deployment precondition for whatever mutual-exclusion
  primitive is chosen (process/host/cluster scope, and its crash- and
  lease-expiry behavior), applied with the same rigor given to storage
  rename atomicity; and (d) primitive and static-check text that is
  regenerated fresh rather than carried forward and re-edited across five
  rounds, since three of those rounds (29, 30, 31) each independently
  produced at least one internally-contradictory primitive or static-check
  claim. A future packet must not build on round 31's
  reclamation-outside-the-staging-lock/lineage-bounded-coverage shape.

### 6. Fable-directed structural redesign: reclamation folded into the single append-lock hold, recomputed fresh from durable state every hold, whose own Guarantee-1 fix reopens the disk-reserve bound

- **What was tried:** After round 31's rejection, Fable arbitrated (binding
  ruling: `.kstack/decisions/reasoning-effort-policy-2026-08-23-fable-round31-structural.md`)
  and selected Option 1 — fold old-bundle physical reclamation into round
  27/31's single, never-split append-lock hold as that hold's first
  substantive step, recomputing reclaim obligations fresh from
  `(durable chain prefix + directory listing)` at every hold and never from
  a persisted record. Round 32 isolated `REP-32-01`, implementing this
  ruling in full: `StagingIntent`, `CleanupTombstone`, `SlotAttempt`, the
  pre-allocated (pending, not-yet-durable) `refId` reservation, and
  `CROSS-RENAME-INSTALL-DURABLE` retired entirely with no replacement
  persisted record; `INV-DURABLE-ONLY` stated as the sole liveness
  invariant; `liveAddrs(H)` redefined as a per-content-address set spanning
  both `CURRENT_SEALED` and `RETAINED_VERIFIED` roles (the fix for round
  31's non-monotone coverage predicate); a reconstructed 7-step single-hold
  procedure (acquire, validate, reclaim, stage, rename, append/durability,
  release); an idempotent abort-rule re-run of the reclaim step covering
  both "rename not attempted" and "rename done, event not durable"; a
  complete crash-recovery table distinguishing the same-window
  crash-versus-clean-abort case; and an explicit lock-scope/deployment-scope
  statement naming the sweeper and startup recovery as additional acquirers
  of the identical lock.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round32/`.
  Digest `2acfcbc3eef805a55e2fee48ed2188e341676811f22584ad906e708ece80e124`.
- **Confidence effect:** Codex `block/18` and Opus `revise/70` produced
  combined confidence **18** (minimum, not average), fifty-four points below
  round 27's 72 baseline. The option must not be built forward from. This is
  the fifth consecutive rejection of this mechanism and the first attempted
  after a binding Fable structural ruling.
- **Why rejected:** Both reviewers, independently and by different
  reasoning paths, construct the same critical counterexample. The very fix
  that closes round 31's non-monotonicity bug — making `liveAddrs(H)` a
  per-content-address set spanning both `CURRENT_SEALED` and
  `RETAINED_VERIFIED` roles — admits two simultaneously-live canonical
  bundle addresses (demonstrated by the packet's own H=105 worked example:
  `liveAddrs(105) = {d_X, d_Y}`), and Section 3b step 4 then stages a third,
  distinct successor bundle. At `K_b = 8,388,608` bytes each this is a
  worst case of `3*K_b = 24 MiB` against the stated 16 MiB
  `CHECKPOINT_RESERVE_BYTES`, directly contradicting the packet's own
  "SEC-26-03 closed by construction ... at most two bundles ever" claim and
  invalidating Section 6's carried-forward reserve-admission test, which
  both reviewers had previously reproduced as sound arithmetic. This is the
  same relocation pattern as rounds 28-31 — the fix for one dimension of the
  defect (durability/liveness monotonicity) reopened a previously-closed
  dimension (disk-reserve constructibility) — surfaced this time in review
  rather than after a further patch attempt. Opus additionally found:
  `.staging/` objects are excluded from `present(H)` and cleaned only along
  "this acquirer's own deterministic staging path," so a crash during
  staging leaks a permanently unreclaimable object once acquirer identity
  changes (`SEC-32-B`, high — explicitly the round-31 unreclaimable-
  obligation defect relocated into a new namespace, not closed); a
  self-contradiction between step 3's "deterministic staging path" and step
  4's "fresh content-addressed name"; Guarantee 1 stated over hold-exit is
  falsified by the packet's own step 6 (true only at step-3 completion,
  false at hold exit as written); an ordering contradiction between Section
  3b (validate then reclaim) and Section 4 (asserting the same pass while
  implying reclaim precedes the reserve/fence computation); abort/crash
  deletion prose (3c/3d) that omits the set-membership qualification and,
  read literally, could delete a live equal-content object (`SEC-32-C`,
  medium); no reader/reclaim contract for gate reads or independent
  verifiers (`SEC-32-D`, medium); and an unspecified thread-vs-process model
  for the lock primitive (`SEC-32-E`, medium). Codex independently found a
  corrupt-prefix reclamation fail-safe gap (`SEC-02`, high — reclamation
  during the abort rerun has no stated rule for a chain whose corruption
  obscures rather than removes a live reference) and unenumerable stale
  staging files from other crashed attempts (`SEC-03`, medium). Both
  reviewers explicitly corroborate, as genuinely closed and not in dispute:
  the entire persisted-record failure class of rounds 28-31 is eliminated
  and `INV-DURABLE-ONLY` is a sound, checkable invariant; round 30's
  no-crash live-object-deletion counterexample is closed by construction
  (the lock is never released between admission validation and event
  durability); round 31's non-monotone-coverage `SEC-01` is closed by the
  H=100/105/110 worked example, and recompute-every-hold is the correct
  general answer to a cached predicate; the item-1/item-6 `refId`
  pre-allocation-vs-post-hoc-identity tension is resolved coherently; and
  Sections 1, 2, 5, 6, 7's carried-forward arithmetic re-verifies
  byte-for-byte (the 1,319/208/2,596-byte successor serializer; the
  262-event/20,070,400-byte closure bound; the 27,160,576-byte/25,903-ms
  gate read; `C_chain(262,...)=47,961`, total 289,711, margin 10,289), with
  the single stated exception that Section 6's reserve-admission clause is
  now contradicted by the new role set and must be re-derived, not merely
  carried forward. Opus states explicitly that the Fable ruling's selected
  direction (Option 1) is correct and it is this packet's *execution* of
  the ruling, not the ruling itself, that failed.
- **Facilitator escalation:** per the round-32 dispatch's own standing rule,
  this is flagged directly to the facilitator: the Fable-directed structural
  redesign's *first execution attempt* failed at combined confidence 18,
  fifty-four points below round 27's 72 floor and short of the owner's
  target of 81. No round 33 draft is authored in this dispatch. This is a
  distinct signal from rounds 28-31's "patch introduced a new defect"
  pattern: here, both reviewers affirmatively agree the ruling's own
  direction remains sound, and there is no unresolved disagreement between
  the two reviewers to arbitrate (per this thread's Fable-triggering
  criteria, this is therefore not itself a further Fable trigger) — the
  defect is confined to this specific packet's interaction between the
  Guarantee-1 fix and the previously-validated disk-reserve bound, plus the
  secondary findings above. The mechanism should pause for the owner to
  weigh in directly before any round 33 is attempted, per the round-32
  dispatch's explicit instruction for this exact outcome.
- **Alternative:** Do not reopen the Fable ruling itself (Option 1 remains
  correct per both reviewers). Retain the ruling's structure — fold
  reclamation into the single lock hold, recomputed fresh from durable
  state, `INV-DURABLE-ONLY` — and resolve, in one isolated next round, the
  concrete corrective direction both reviewers converge on: (a) explicitly
  charge the `RETAINED_VERIFIED` bundle to a stated reserve — either raise
  `CHECKPOINT_RESERVE_BYTES` to cover the 3-bundle worst case (`3*K_b`), or
  bind `RETAINED_VERIFIED` to the existing but currently unbound
  `VERIFIER_MIRROR_RESERVE_BYTES` and resolve `SEC-27-D`'s open mirror
  lifecycle contract as load-bearing for that choice; (b) make `.staging/`
  reclamation general rather than acquirer-scoped — since nothing in
  `.staging/` is ever live by construction, state that the entire
  `.staging/` subtree is unconditionally clearable at every hold's step 3,
  which also dissolves the step-3/step-4 staging-path self-contradiction;
  (c) restate Guarantee 1 quantified at step-3 completion, not hold exit,
  and name the deferred-to-next-hold obligation as an explicit postcondition
  of the durability step rather than folding it into Guarantee 1's own
  scope; (d) requalify the abort/crash deletion prose as "delete iff a
  member of `Obligations(H)`" explicitly at the point of instruction, not
  only in the earlier invariant section; (e) pick and state one explicit
  ordering between the reclaim step and the reserve/fence computation,
  removing any "same pass" claim if the two orders in fact differ; (f) state
  explicitly whether the appender, sweeper, and startup recovery are
  distinct OS processes or threads of one process, and confirm the named
  lock primitive actually provides exclusion for that concurrency model; and
  (g) state a reader/reclaim contract for gate reads and independent
  verifiers so a promotion cannot make a selected object disappear between
  selection and read. A future packet must not build on round 32's
  unbudgeted-third-bundle/acquirer-scoped-staging-cleanup shape, and must
  not treat the Fable ruling itself as needing re-litigation.
  **Attempted in round 33 (all seven points, plus the two named Codex
  findings `SEC-02`/`SEC-03`) and rejected; see entry 7 below.**

### 7. Round-32 alternative applied in full (nine independently-attributed fixes), whose own reader/reclaim contract reopens the exact reserve arithmetic it was raised to close

- **What was tried:** Round 33 isolated `REP-33-01`, applying round 32's own
  recorded seven-point concrete alternative (entry 6 above) in full, plus
  disposition of the two named Codex findings not covered by that numbered
  list: (1) raised `CHECKPOINT_RESERVE_BYTES` from `16,777,216` to the
  owner-selected `25,165,824` (`3*K_b`, the exact worst case), with the
  Section 6 reserve-admission clause re-derived byte-for-byte; (2) made
  `.staging/` reclamation general and unconditional over the whole subtree
  rather than acquirer-path-scoped; (3) restated Guarantee 1 as true only at
  step-3 completion, with step 6's role demotion named as its own explicit
  postcondition; (4) restated the abort/crash deletion rule as "delete iff a
  member of `Obligations(H)`" explicitly at each point of instruction,
  including the equal-content non-exception; (5) stated one explicit
  ordering (reclaim always precedes reserve/fence computation, one
  computation per hold); (6) stated a single-process,
  per-acquisition-open-`flock`-close concurrency model for the lock,
  explicitly naming and avoiding the shared-reused-file-descriptor pitfall;
  (7) added a reader/reclaim contract for gate reads and independent
  verifiers (open the selected bundle's canonical path before reporting the
  selection final; rely on POSIX unlink-after-open to guarantee an
  already-open descriptor's content survives a concurrent reclaim;
  reselect on `ENOENT`); plus an explicit corrupt-prefix reclamation
  fail-safe rule (refuse before step 3 runs; exclude that refusal from the
  ordinary abort re-run) disposing Codex's `SEC-02`, and an explicit
  confirmation that fix 2's general `.staging/` sweep also closes Codex's
  `SEC-03`.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round33/`.
  Digest `218b2b77e82b813cac2920ade27d1a2dcb86d5646cb61dde1ad62dc4e837a944`.
- **Confidence effect:** Codex `revise/28` and Opus `revise/58` produced
  combined confidence **28** (minimum, not average), forty-four points below
  round 27's 72 baseline and short of the owner's target of 81. The option
  must not be built forward from. This is the sixth consecutive rejection of
  this mechanism, and the first attempted after applying round 32's own
  recorded alternative in full.
- **Why rejected:** Both reviewers, independently and by different reasoning
  paths, construct the same critical finding: **fix 7's reader/reclaim
  contract breaks fix 1's reserve arithmetic and fix 5's ordering statement,
  reopening the exact defect fix 1 was written to close in this same
  packet.** Fix 7's open-before-report / unlink-after-open discipline is a
  correct read-safety argument on its own terms, but it has an unaccounted
  resource-accounting consequence: an unlinked-but-still-open bundle's
  blocks remain physically allocated on disk for as long as any reader holds
  it open, even though `present(H)` no longer lists it and step 3 already
  counted it as reclaimed. Fix 5's added sentence — "freed bytes from step
  3's own reclamation therefore DO count toward this hold's own reserve
  headroom" — is therefore false whenever any reader holds such a
  descriptor, and fix 1's `CHECKPOINT_RESERVE_BYTES = 3*K_b`, recorded
  explicitly as a knife-edge equality with zero headroom, has no margin to
  absorb the difference. Opus (`R33-01`, high) computes that a single pinned
  reclaimed bundle already puts real usage at `4*K_b` against the `3*K_b`
  reservation, scaling to `(2+1+N)*K_b` for `N` concurrent readers, with no
  reader-count bound, descriptor-lifetime bound, or free-space check
  anywhere in the design to detect or refuse it — and names this explicitly
  as `REP-32-01-SEC-01` relocated, not closed. Codex independently
  constructs the identical interaction (`REP-33-01-SEC-01`, high) via its
  own `materialDissent`: "The packet's own unlink-after-open rule directly
  prevents step-3 deletion from necessarily releasing physical space."
  Both reviewers separately find fix 7 also falsifies Section 7's
  carried-forward gate-deadline margin: the ENOENT/reselect instruction has
  no attempt cap or bounded cost, and the closure table's worst-case slack
  (289 ms) is smaller than even one cheap reselect's estimated cost (Codex
  `REP-33-01-SEC-02`, medium; Opus `R33-02`, high). Opus additionally finds:
  the restated Section 6 reserve clause is operatively inert on the disk
  dimension, a constant-vs-constant comparison that can never actually
  refuse regardless of real free space (`R33-03`, medium); fix 1's per-object
  bound is denominated in `K_b` (application JCS bytes, not physical bundle
  bytes), leaving the true physical-size bound and the step-4 manifest's
  own accounting unstated (`R33-04`, medium); Section 3d's "crash-safe
  lease" characterization of `flock` is false for a hung (not crashed)
  holder, which has no timeout, preemption, or fencing escape (`R33-05`,
  medium); the SEC-02 corruption refusal over-blocks fix 2's
  chain-independent `.staging/` sweep, reopening `SEC-03` specifically in
  the corrupt-prefix path (`R33-06`, medium); and Section 7's no-torn-read
  premise is imprecisely stated for the equal-content case fix 4 preserves,
  though content identity happens to rescue the conclusion (`R33-07`, low).
  Codex independently finds two further gaps: no stated outcome for a clean
  I/O failure during a hold's *initial* (non-abort) step-3 pass, only for
  the abort re-run and crash cases; and Section 3b steps 4–6 as written
  cover only the compact rejection-successor append, while Section 3e's
  acquirer model claims the identical procedure serves every ordinary chain
  append without stating those other appends' own mutation/durability
  branches. What both reviewers explicitly corroborate as genuinely closed,
  not in dispute: fix 3 (Guarantee 1 correctly restated over step-3
  completion, with step 6's role demotion as its own named postcondition —
  Opus calls this "exactly right"); fix 4 (the iff-member-of-Obligations(H)
  qualification restated at each instruction site, including the explicit
  equal-content non-exception, closing `SEC-32-C`); fix 2 (the unconditional
  whole-subtree `.staging/` sweep, closing `SEC-32-B` and the step-3/step-4
  path contradiction — "the safety argument given for it ... is sound");
  fix 6's open-file-description analysis and per-acquisition
  open-`flock`-close discipline (Opus: "technically correct," closes
  `SEC-32-E`'s thread-versus-process question); fix 5's ordering statement
  proper (reclaim strictly precedes reserve computation, one computation per
  hold — separable from, and not implicated by, the disputed freed-bytes
  sentence); the SEC-02 corruption-refusal rule's core reasoning (correct
  for canonical-namespace deletions specifically); and the structural
  direction from the Fable ruling forward, which neither reviewer reopens.
- **Facilitator escalation:** per the round-33 dispatch's own standing rule,
  this is flagged directly to the facilitator: **the reserve-budget fix
  (fix 1) itself — not only the broader nine-item batch — failed to close
  the defect it targeted.** Per the batching discipline's per-item
  attribution requirement, both reviewers name fix 1 as the primarily
  implicated item, with fix 5's freed-bytes-count-immediately clause and
  fix 7's reader/reclaim contract as the specific interacting causes; fixes
  2, 3, 4, and 6 (and fix 5's ordering statement proper, and SEC-02's core
  corruption-refusal reasoning) are not implicated and remain retained
  evidence. No round 34 draft is authored in this dispatch. This is a
  distinct signal from rounds 28-32's "one round's fix reopens a
  *previously* closed dimension" pattern: here, the newly-added fix (7)
  reopens a dimension (fix 1's reserve arithmetic) that was closed **within
  this same round's own packet**, not carried forward from an earlier round
  — the relocation now happens within a single round's fix set, not only
  across rounds. Combined confidence (28) is higher than round 32's (18),
  not a fresh sharp drop on previously-stable ground, so this is not itself
  a new Fable trigger under this thread's confidence-drop criterion; both
  reviewers converge on the identical root cause with no disagreement
  between them, so the "no Fable when both reviewers progress without
  disagreement" default applies (per this thread's Fable-triggering
  criteria).
- **Alternative:** Do not reopen the Fable ruling or the fixes both
  reviewers validated (2, 3, 4, 6, fix 5's ordering statement proper, and
  SEC-02's core reasoning). In one isolated next round, resolve the seven
  concrete points both reviewers converge on (Opus states them as an
  explicit minimum change set; Codex's `unresolvedQuestions` name the
  identical gaps independently): (a) make reader-pinned space explicit and
  bounded — register open descriptors so admission can count pinned
  addresses, or cap concurrent readers at a stated `R` and set
  `CHECKPOINT_RESERVE_BYTES = (3+R)*K_b`, or require readers to
  copy-and-close within a bounded window; (b) qualify fix 5's freed-bytes
  sentence to "freed except for blocks pinned by open descriptors," per
  whichever mechanism (a) adopts; (c) give the disk-reserve clause an
  operative form that measures actual bytes or free space, with real slack
  rather than a knife-edge equality; (d) bound fix 7's reselect with a
  stated attempt cap and add its worst-case cost as an explicit term in
  `B_gate_read_closure_max` and the closure-shape table, or withdraw the
  claim that Section 7's arithmetic is unchanged; (e) denominate the
  per-bundle physical-size bound in bundle bytes (`CHECKPOINT_DELTA_MAX` or
  an equivalent stated cap covering a full checkpoint bundle, not `K_b`),
  and account manifest and block-rounding overhead; (f) narrow the SEC-02
  corruption refusal so the chain-independent `.staging/` sweep still runs
  during an out-of-band repair window; (g) replace "crash-safe lease" with
  an accurate statement of `flock`'s release-on-close semantics and state
  what happens to a hung (not crashed) holder. Points (a)-(d) are
  prerequisites for passing per Opus's explicit ranking; (e)-(g) are
  lower-severity and can ride along in the same isolated round. A future
  packet must not build on round 33's
  unbounded-reader-pinned-inode/knife-edge-reserve shape, and must not treat
  the Fable ruling or fixes 2/3/4/6 as needing re-litigation.

### 8. Advisory reader-slot cap plus independently-stated live-space threshold, whose provision is short by its own headroom and whose one-event reselect contradicts `E_max`

- **What was tried:** Round 34 applied rejected-options entry 7's four
  prerequisite points: (1) fixed `R=4` `flock` reader slots; (2) outright
  retraction of the symbolic "freed bytes count immediately" clause; (3) a
  live `statvfs`-class admission check requiring `CHECKPOINT_DELTA_MAX +
  STAGING_HEADROOM_BYTES`; and (4) one ENOENT reselect charged as selection
  artifacts plus a 65,536-byte one-event increment. It stated
  `BUNDLE_STORE_PROVISION_BYTES=(3+R)*CHECKPOINT_DELTA_MAX=58,720,256`.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round34/`.
  Digest `1df8223ce1792cfdf69d8e3bc87830d02e82be4989f906449b98bb2d119097e1`.
- **Confidence effect:** Codex `block/34` and Opus `revise/55`; combined
  confidence **34**, below round27's 72 baseline and the configured 80 gate.
  This is the seventh consecutive substantive rejection of this mechanism.
- **Why rejected:** Both reviewers independently reproduce the decisive
  arithmetic contradiction. At the exact state the provision is claimed to
  cover, two live plus four reader-pinned bundles consume `50,331,648`,
  leaving `8,388,608`; the operative check requires `9,437,184`, so a fully
  provisioned conforming deployment refuses a required action by exactly
  `1,048,576` bytes. The threshold and provision were stated independently
  instead of deriving one from the other. Both reviewers also reject the
  reselect proof: normative `E_max` permits a 1,048,576-byte physical event,
  not the 65,536-byte `CHECKPOINT_HEADER_MAX` used by the packet. Correcting
  that term yields a worst total `290,848 ms` and only `9,152 ms` margin,
  below the required `10,000 ms`. Codex additionally finds slot participation
  advisory and `statvfs` non-reserving; Opus independently finds missing slot
  bootstrap/permissions, ambiguous all-lane check placement, unreserved
  chain bytes and colocated consumers, a reselect observation race, and an
  invalid proof-path-invariance rationale. Both accept the freed-byte
  retraction, while correcting its false claim that post-reclaim query timing
  is irrelevant.
- **Alternative:** Do not raise the two round-34 constants independently. In
  one coupled structural design: (a) make canonical paths accessible only to
  a dedicated broker UID so every reader is forced through the cap; specify
  deterministic slot creation, ownership, modes, identity checks, and absent-
  slot failure; (b) combine the cap with bounded copy-and-close into sealed
  anonymous memory, closing canonical descriptors before expensive proof
  work and supervising hung workers; (c) define one physical bundle maximum
  including payload, manifest, allocation rounding, and metadata, then derive
  provision as maximum already-present/pinned objects plus the complete
  admission threshold and explicit slack; (d) isolate bundle and chain stores
  in dedicated quota/allocation domains, enumerate chain rounding and append
  bytes, and place checks before every admission lane so nothing can consume
  checked capacity between query and durability; and (e) bound any reselect by
  actual durable appended byte offsets observed under the append lock, open
  the replacement before releasing that lock, and read zero proof-path bytes
  before open—or refuse without reselect.
- **Attempt status:** Round35 applies this five-point alternative at frozen
  digest `71d43bb2757a9137150d687c5969934bd95e2511a256508ffe333c13d07cb577`.
  Its authentic review is complete and rejected at combined 38; see entry 9.

### 9. Broker-enforced copy-and-close plus project-quota capacity identity, whose copy integrity breaks the deadline and whose quota covers neither reserved blocks nor lifetime chain history

- **What was tried:** Round35 adopted entry 8's structural alternative as five
  coupled parts: broker-only canonical access and deterministic slot
  bootstrap; an enforced `R=4` cap plus supervised sealed-memory
  copy-and-close; a physical bundle maximum and derived bundle provision;
  separate bundle/chain project-quota domains with all-lane checks; and one
  actual-byte-bounded reselect observed/opened under the append lock. It also
  narrowed corrupt-prefix refusal, specified initial reclaim-I/O and non-
  successor append outcomes, and replaced "crash-safe lease" with supervised
  release-on-close behavior.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round35/`.
  Digest `71d43bb2757a9137150d687c5969934bd95e2511a256508ffe333c13d07cb577`;
  invocation `fd3d417c-e48e-43ec-8ebb-6e65d70f4a14`.
- **Confidence effect:** Codex `block/38`, Opus `revise/46`, combined
  confidence **38**. This is four points above round34's 34 but below
  round27's 72 baseline, owner target 81, and configured gate 80. It is the
  eighth consecutive substantive rejection of this mechanism.
- **Why rejected:** Both reviewers independently reject item 4's foundation.
  A project-quota hard limit caps one domain's consumption but does not reserve
  filesystem blocks against other domains, so `f_bavail` can fall between
  admission and durability. `CHAIN_STORE_PROVISION_BYTES=22,191,866` is
  derived from one post-anchor closure window, while physical events remain
  consecutive from sequence 1 through `H` and no chain compaction/truncation/
  segment-retirement contract exists; repeated conforming epochs therefore
  exhaust the quota. Record framing, head/directory/lock/slot files, inodes,
  and persistent metadata are omitted. Both reviewers also reject items 2/5:
  copying only query-consumed bytes cannot verify a flat whole-object content
  address, while whole-object copy adds at least `1,363,968` uncharged bytes
  and reduces the worst deadline margin from `10,090 ms` to about `8,789 ms`,
  below the mandatory `10,000 ms`. Both accept as component improvements that
  item 1 enforces the cap/bootstrap and item 5 uses actual byte offsets under
  `L`; they reject the new broker verification chokepoint, missing authenticated
  handoff/protocol, reader starvation, asserted bundle-metadata allowance,
  stage-time platform rejection, undeclared Linux dependencies, reader-held-
  `L` cost, and unbounded whole-read retry behavior.
- **Alternative:** Do not build forward from the quota-as-reservation or
  broker-verifies-partial-copy shape. If another round is expressly
  authorized: (a) choose whole-object copy and fully charge it, or define a
  chunk-digest manifest that authenticates copied ranges; in either case
  specify sealed-data handoff and verifier-side recomputation so the broker
  does not decide the result; (b) define crash-safe chain segment retirement/
  compaction or a bounded lifetime-retention contract before stating chain
  provision; (c) use exclusive or preallocated physical capacity and enumerate
  every framing/object/inode/directory/head/lock/metadata charge; (d) move
  ZERO/ONE liveness and explicit Linux primitive qualification into normative
  text and allocation-unit compatibility into bootstrap; and (e) rederive the
  full gate table, reader-held-lock/write latency, supervisor cost, fairness,
  and whole-procedure retry bound. Preserve only the validated freed-byte
  retraction, access/bootstrap enforcement, and actual-byte open-under-lock
  synchronization. No round36 is authorized by this entry.

### 10. Finite preallocated chain epoch whose provisioning predicate rejects its own extents and whose lifetime/closure bounds are not derived

- **What was tried:** Round36 isolated the highest-severity chain-capacity half
  of round35 item 4. It replaced project quota with one finite service epoch of
  1,000,000 fixed physical slots on a dedicated thick ext4/XFS filesystem,
  reserved the final 262 slots for closure, introduced exact prefix/newline/
  padding framing and two generation/checksum heads, and preallocated a stated
  `CHAIN_EPOCH_PROVISION_BYTES=1,054,819,618,816`. It explicitly retained all
  physical history and introduced no compaction.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round36/`.
  Digest `439d547a790408feb71b2cd57d691a0c55b9578916f33552249a3f7a00ae04bf`;
  invocation `86e9ab51-9e87-4462-9e62-3e74deb31b07`.
- **Confidence effect:** Codex `revise/66`, Opus `revise/70`, combined
  confidence **66**. This improves 28 points over round35's 38 and clearly
  beats that attempt, but remains below round27's 72 baseline, the configured
  gate 80, and the owner target 81. It is the ninth consecutive substantive
  rejection of the combined mechanism.
- **Why rejected:** Both reviewers independently find Part 3 cannot satisfy
  its own qualification: the mandated `fallocate` procedure can produce
  allocated extents marked `FIEMAP_EXTENT_UNWRITTEN`, while preflight rejects
  every unwritten extent. The packet neither accepts that already-reserved
  state nor mandates and budgets a full-file zero-fill and durability sync.
  Both also find the two-head protocol lacks the write/selection/recovery rule
  needed to derive exactly-once fixtures. Opus additionally finds FIEMAP cannot
  prove global exclusivity; the single-allocator boundary is asserted rather
  than enforced; `f_bavail` units and the two one-GiB reserves are unsoundly
  stated; device size and full-slot I/O/replay cost are missing; the one-million
  ceiling lacks an event-rate/service-life derivation and owner approval; the
  262-slot tail lacks a concurrent-lineage bound; and closure liveness reaches
  writes outside the reserved chain device. Fixture 8 says repeated VERIFIED
  epochs despite the normative lifecycle allowing only one epoch.
- **Alternative:** Preserve the finite-retention, fixed-slot, and dedicated-
  storage direction, but do not build on the current qualification or terminal
  constant. If a later round is expressly authorized: (a) choose an
  implementable preallocation predicate—either accept allocated-unwritten
  extents with an explicit reservation argument or require and budget a full
  initialization plus durability barriers; (b) limit FIEMAP to inode coverage
  and separately enforce/test mount, namespace, ownership, fixed-inode, and
  foreign-allocation controls; (c) specify the complete alternating-head
  write/recovery state machine, including all validity combinations, ties,
  rollover, torn writes, and zero-before-reuse; (d) derive an owner-approved
  epoch ceiling from a maximum event rate and service duration, with slot-
  consumption control and an approved successor/migration policy; (e) bound
  concurrent in-flight lineages, derive the closure tail from that bound, and
  narrow liveness to chain-storage exhaustion unless every dependent store is
  reserved; (f) express free-space predicates in bytes, derive or accurately
  rename metadata headroom, state minimum formatted/raw device sizes, and test
  boundaries; and (g) bound full-slot append/fsync throughput and late-epoch
  startup/audit replay. No round37 is authorized by this entry alone.

### 11. Alternating checksum heads whose authority incorrectly depends on observing sync success and whose bootstrap/recovery edges remain unspecified

- **What was tried:** Round37 isolated round36's missing two-head state machine.
  It defined two fixed 65,536-byte records, even-A/odd-B parity, a complete
  checksum domain binding epoch/event/full-slot digests, slot-before-head
  durability ordering, an adjacent-generation selection table, and crash
  fixtures. It deliberately left all other round36 and round35 mechanisms open.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round37/`.
  Digest `d289012d532a0e184bcb5dec933381f075aa8f139d536d91606164130aa2e2ab`;
  invocation `e59222e8-74b2-4993-a82e-7dd982c13738`.
- **Confidence effect:** Codex `revise/62`, Opus `revise/76`, combined
  confidence **62**. This is four points below round36's 66, ten below
  round27's 72 baseline, and below the configured gate 80 and owner target 81.
  It is the tenth consecutive substantive rejection.
- **Why rejected:** Codex finds a decisive internal contradiction. The stated
  filesystem premise guarantees durability after successful `fdatasync`, but
  does not guarantee that a complete new head cannot persist before the return
  or after an observed error. Recovery would correctly select a valid greater
  `H+1`, while Parts 2/4 incorrectly require `H` throughout that interval.
  Both reviewers also find the generation-zero digest values unspecified.
  Opus additionally finds bootstrap non-idempotent; zero-slot detection/cost
  undefined and likely redundant; startup-cache versus per-append head
  resolution unstated; no read-only consumer protocol; degraded one-head then
  both-invalid denial without authenticated offline restoration; an impractical
  literal million-append fixture; no sequential-crash induction; and a fault-
  model claim conditional on round36's open preallocation contract. The fixed
  checksum/parity layout, slot-before-head ordering, absence of per-append
  directory mutation, and adjacent-generation table remain useful component
  evidence but do not make the packet implementable as written.
- **Alternative:** Do not add a third commit record or infer authority from a
  volatile syscall return. If later work is authorized: (a) define authority
  during the target-head write/sync ambiguity solely by recovered record/slot
  validity, permitting `H` or `H+1`, while successful sync observation controls
  only acknowledgement eligibility; (b) define exact genesis digests and an
  idempotent zero-event bootstrap; (c) remove zero-before-reuse using the full-
  overwrite/digest reachability argument or specify its detection and cost,
  and state startup caching plus read-only resolution; (d) define degraded-
  head repair and an authenticated offline both-invalid restoration path; and
  (e) replace the million-append fixture with parity/boundary properties, add
  sequential-crash induction, and state the slot-durability dependency
  conditionally. Under the interaction-risk rule, the separately directed
  local round38 draft attempts only point (a); this entry authorizes no export.

### 12. Recovered-validity commit semantics whose live sync-error reread promotes page cache to durable authority

- **What was tried:** Round38 isolated round37's commit-point contradiction. It
  separated recovered `AUTHORITATIVE` state from volatile `ACK_ELIGIBLE` state,
  permitted recovery to select `H` or `n` during the ambiguous target-head
  write/sync interval, added a live `HEAD_OUTCOME_UNKNOWN` error path, and
  supplied bounded ambiguity fixtures without a third durable commit record.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round38/`.
  Digest `b5c35070b22102392ff7a7d04e257758b64705c9ed3f2ce318cf658f015639de`;
  invocation `16c3568a-5318-451e-8270-602855181070`.
- **Confidence effect:** Codex `revise/58`, Opus `revise/68`, combined
  confidence **58**. This is four points below round37's 62, eight below
  round36's 66, fourteen below round27's 72 baseline, and below gate 80 and
  owner target 81. It is the eleventh consecutive substantive rejection.
- **Why rejected:** Both reviewers agree the crash-path split genuinely fixes
  round37's original contradiction: recovery uses durable record/slot validity,
  while observed sync success controls only acknowledgement eligibility. Both
  independently reject Part 2's non-crash error branch. After target-head write
  or `fdatasync` error, an immediate normal reread can validate complete dirty
  page-cache bytes without proving they reached stable media. Treating that
  result as authority can expose `n`, release `L`, and allow later behavior even
  though restart loses or tears `n` and recovers `H` or fails closed. Opus also
  finds the latch lifetime/clear condition ambiguous, `AUTHORITATIVE(H)` variable
  binding unclear, acknowledgement timing and idempotency enforcement external,
  and persistence-conditioned fixtures unobservable by the named procedure.
- **Alternative:** Preserve the crash-path authority/acknowledgement split, but
  never use an in-process post-error reread as durable evidence. On any target-
  head write or sync error: (a) atomically latch the writer process lifetime
  fail-closed before releasing `L`; (b) emit no acknowledgement, assert no
  authority for either pre-append or candidate generation, and admit no later
  append or dependent read exposure; (c) make the latch survive lock release
  and forbid clearing by reread, reopen, another sync, signal, timeout, or
  operator action inside that process; (d) clear it only by process replacement
  followed by fresh restart recovery, which then selects from durable validity;
  (e) disambiguate the recovered-generation variable; and (f) fixture complete
  cached bytes after the error that disappear or tear across restart. Preserve
  every other round38 finding as open. The separately directed local round39
  draft attempts only this mechanism; this entry authorizes no export.

### 13. Writer-lifetime fail-closed latch whose process replacement is not a durable storage boundary

- **What was tried:** Round39 removed round38's in-process outcome reread and
  latched the writer process fail-closed after target-head write/sync error. It
  deferred authority to a replacement process, disambiguated head variables,
  and added cached-complete/non-durable fixtures without adding a record or
  cache-bypass primitive.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round39/`.
  Digest `107762db6237d9d819bf1441aa50c05736f0eed5456525f79aea93a27b45fefb`;
  invocation `88b3848c-ca0a-4671-a587-0daba0661d8a`.
- **Confidence effect:** Codex `block/40`, Opus `revise/74`, combined **40**,
  eighteen points below round38's 58 and below every named baseline, gate 80,
  and target 81. It is the twelfth consecutive substantive rejection.
- **Why rejected:** Codex finds the premise fatal: process exit/replacement does
  not evict kernel page cache, so the replacement can validate the same dirty
  nondurable candidate. Both reviewers also identify missing linearization
  between latch and in-flight API publication. Opus finds observed-error-only
  triggering incomplete without a process-lifetime descriptor and conservative
  handling of reopen/loss, uncompleted writes, slot errors, and writeback error
  visibility. Supervisor termination, startup exclusion handoff/fencing,
  stuck-old-process behavior, earlier durable acknowledgements, memory order,
  deterministic fault seams, writer-only scope, and space/quota restart loops
  are unspecified.
- **Alternative:** Retain writer fail-closed semantics, but require a verifiable
  storage-epoch boundary before authority selection—prefer completed host reboot
  with a new boot ID; ordinary process replacement/reread is insufficient. Use
  one writer-owned lifetime head descriptor and latch on every detectable
  descriptor/reopen/incomplete-write/slot-or-head error or lost-error condition,
  while explicitly retaining the successful-sync durability premise rather
  than claiming undetectable failures solved. Publish the latch with specified
  atomic ordering and linearize every writer head-dependent result through a
  final under-`L`/epoch validation. Settle previously durable acknowledgements;
  define startup exclusion handoff, fencing, and stuck-old-process refusal;
  name deterministic fault seams and complete fixtures; scope guarantees to the
  writer; and accept that space/quota faults can cause indefinite reboot/recovery
  loops until the separate capacity defect is fixed. Add no durable record or
  cache bypass. The directed local round40 draft attempts this coherent item;
  this entry authorizes no export.

### 22. Fixed-slot consolidation that omits the policy and persistence protocol it must implement

- **Round:** 48; digest
  `20b752d6b5615096722a44380629663a0a0978dd08f42310086ff30cc739dce3`;
  invocation `154186d8-9c76-4faf-82e9-6c5bbf55aa8a`; Codex `block/18`, Opus
  `revise/68`, combined **18**; change from round47: **-54**; gate `BLOCKED`.
- **Why rejected:** The packet is only a substrate fragment. It stops after a
  fixed 4,096-byte slot and worksheet summary. Both reviewers independently find
  no resolver inputs/rule mapping, append/fsync/ack/recovery protocol, complete
  event schemas, signer authorization, key lifecycle, `ATTEMPT_CONSUMED` state
  machine, single-writer enforcement, anti-truncation anchor, corrupt-slot path,
  or capacity-exhaustion behavior. Opus also establishes that coverage mixes
  application and physical sequence spaces and that the rejection-successor
  worksheet is referenced rather than supplied. Nine security findings and six
  dissents remain current.
- **Retained:** Removing bundle, mirror, tombstone, reclamation, and signature-
  length fixed-point complexity is a useful structural direction. The slot-size
  sum and 86-character Ed25519 base64url projection arithmetic are coherent.
  Those facts do not validate the incomplete whole design.
- **Alternative:** Restore the established item-sized review loop. Review the
  normalized resolver and versioned rule table alone first. In later rounds,
  isolate schemas/layout and sequence-space semantics; signed header and key
  authorization; attempt consumption; append/fsync/ack/recovery and
  anti-truncation; corrupt-slot and capacity terminal states; then rollback and
  verification. Each brief changes one bounded mechanism, names everything it
  leaves open, and is judged only on its isolated proposition. Perform a full
  integration review only after the individual mechanisms are stable.

### 21. Honest attempt-consumption lifecycle whose limiter refusal is silent and whose reporting codebooks remain incomplete

- **What was tried:** Round47 redefined the protected event as successful
  `ATTEMPT_CONSUMED`, replaced Type=notify with a complete Type=exec service and
  boot-target/socket relationship, pinned Linux >=6.8 and returned
  `STATX_MNT_ID_UNIQUE`, supplied repeated FD-only marker inspection, transported
  preassert results through a root-only sidecar, ordered the classifier, defined
  bounded native journald transport, separated production properties/model
  checks/short manager tests, and explicitly covered marker-preserved soft reboot.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round47/`;
  digest `ddfdcf16db68057f98e32eaa89e6e4bcea5e461d5721b6d682e59714bfe3c0a3`;
  invocation `3b53ccb4-ad65-4844-957f-58510b1e3d8d`.
- **Confidence effect:** Codex `revise/72`, Opus `revise/76`, combined **72**,
  five points above round46's 67 but below gate 80 and target 81. This is the
  twentieth consecutive substantive rejection.
- **Why rejected:** Both reviewers accept the atomic marker as an honest proof
  of at most one successful `ATTEMPT_CONSUMED`, but reporting remains incomplete.
  PID1 rejects a rate-limited job before the service state machine reaches
  `ExecStopPost`, making the `start-limit-hit` classifier row unreachable and
  leaving the marker-absent 365-day refusal without a KStack lifecycle record or
  action. `KSTACK_ACTION` has no total class/state mapping. The two-byte sidecar's
  A/V/I/U byte is not journaled, status 79 is not represented, systemd-254
  result/exit tuples remain placeholders, and raw EEXIST/normal exit statuses
  plus a categorical ban on manager-reserved 200–243 are absent. Reporter exit
  69 can change the final unit result after recording `SERVICE_RESULT=success`
  without a field explaining that forced failure. Opus separately finds absent
  boot-consumer ordering and rescue/emergency coverage, writer/control-group and
  fence-socket lifetime coupling, unchecked ELF e_entry, and sidecar publication
  not explicitly rooted at the validated `/run` FD. Those are retained as
  distinct mechanisms rather than evidence against the atomic marker itself.
- **Alternative:** Close only result observability: (1) accept and fixture that
  rate-limit refusal bypasses `ExecStopPost`, delete the unreachable row, and
  add one bounded root-owned outside-unit reporter on a concrete PID1 failure
  edge that cannot start the guardian or mutate the marker; (2) define a total
  class + current-marker + preassert-state to action table, with refusal always
  `REBOOT_REQUIRED` and unknown/platform failures conservative; (3) journal both
  sidecar bytes and distinguish sidecar transport failure/absence without
  pretending status 79 was persisted; (4) enumerate the exact accepted
  systemd-254 SERVICE_RESULT/EXIT_CODE/EXIT_STATUS tuples and route every unknown
  tuple to `RESULT_UNTRUSTED`; (5) assign raw EEXIST, consumption-error, runtime,
  and forbidden-zero statuses, keep all guardian-owned statuses below 200, and
  categorically reject 200–243; (6) record the reporter's intended and final
  forcing behavior so `UNEXPECTED_ZERO_EXIT` evidence does not contradict the
  post-reporter unit state; and (7) fixture every source/class/action and the
  silent-refusal reporter with saturated/absent journald bounds. Preserve boot
  ordering/coverage, writer/socket lifetime, ELF/current-image, sidecar-path
  hardening, protocol, OFD, queue, storage, acknowledgement, and graceful-reboot
  mechanisms open. A local round48 may attempt only these seven reporting points;
  this entry authorizes no export.

### 20. Exact lifecycle mechanics with a false raw-entry claim and incomplete normative artifacts

- **What was tried:** Round46 replaced failed-state-as-latch with a concrete
  365-day `StartLimitBurst=1` policy, pinned a static raw x86-64 guardian entry,
  made marker creation its first application syscall, used FD-based current
  `/run` inspection, moved lifecycle results to `ExecStopPost`, removed reboot
  inference and unsupported audit claims, made marker presence the only enforced
  epoch state, and added lifecycle fixtures while preserving unrelated findings.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round46/`;
  digest `2975a495992dc0db328a01e47f4bed1a57fd651d98736f3f52dc22b2e2b44f6b`;
  invocation `e9203392-18f9-4bc3-a462-7649a2982372`.
- **Confidence effect:** Codex `revise/67`, Opus `revise/72`, combined **67**,
  four points above round45's 63 but below gate 80 and target 81. This is the
  nineteenth consecutive substantive rejection.
- **Why rejected:** Codex identifies the central contradiction: a second process
  necessarily enters raw `_start` before its marker `mkdirat` returns EEXIST, so
  the packet cannot promise at most one raw entry. Opus independently finds
  `Type=notify` has no READY handshake and the displayed unit omits concrete
  timeouts, journal ordering, boot-target reverse reference, and socket/service
  relationships. Both reviewers reject the overlapping result classifier and
  ambiguous marker inspection. Preassert 77/78 and invalid-marker state are not
  transported. Linux/kernel qualification and a required returned
  `STATX_MNT_ID_UNIQUE` mask are missing; UMask=0000 is service-wide. Native
  journal transport, application MESSAGE_ID, absent/full-socket handling, and a
  nonreserved reporter status are unspecified. The fixtures claim a fake
  365-day monotonic advance and infer soft-reboot coverage instead of proving
  marker preservation. Root ownership and link count also overclaim absence of
  mutation. The retained finite-expiry disclosure, raw mkdir, ExecStopPost,
  reboot-neutral reporting, and marker-only epoch are direction, not validation.
- **Alternative:** Complete only the same lifecycle artifact: (1) define the
  protected event as successful atomic `ATTEMPT_CONSUMED`, permit later raw
  entries but require every valid/invalid/uninspectable existing marker to
  refuse before authority; (2) choose `Type=exec` and give the complete
  service, boot target, reverse reference, socket relationship, ordering,
  start/stop timeout, `Restart=no`, and restrictive-umask contract; (3) pin
  x86-64 Linux >=6.8 and require every returned `statx` field including
  `STATX_MNT_ID_UNIQUE`, with an exact repeated FD-only open/statx/fstatfs/
  getdents algorithm and conservative invalid/unknown semantics; (4) transport
  preassert 77/78 in an invocation-bound root-only sidecar and apply one ordered,
  disjoint first-match lifecycle classifier; (5) define a bounded static native
  journal datagram, valid 32-hex application MESSAGE_ID, absent/full socket
  deadline, stderr fallback, trusted-metadata boundary, and nonreserved failure
  exit; (6) verify production unit properties and a pinned executable rate-limit
  model separately from a short real-manager test, honestly acknowledging that
  365 days are not elapsed; and (7) explicitly fixture preserved-marker systemd
  soft reboot and fresh-`/run` cold/full/kexec epochs. Keep protocol, OFD,
  executable/current-image, sandbox, socket API, queue, storage,
  acknowledgement, writer-loss, and graceful-reboot findings open. Frozen
  local round47 digest
  `ddfdcf16db68057f98e32eaa89e6e4bcea5e461d5721b6d682e59714bfe3c0a3`
  attempts only these seven points; this entry authorizes no export.

### 19. Honest guardian lifecycle boundary with unspecified systemd latch, entry, result transport, and epoch observables

- **What was tried:** Round45 narrowed round44's absolute claim to an honest
  trusted-host root/PID1/unit model, classified privileged reset/target actions
  as operator violations, added an atomic attempt directory as the first
  guardian action, defined cold/full/kexec versus soft-reboot treatment, made
  guardian returns nonzero, proposed bounded lifecycle journal fields, and
  added reset/reexec/reboot/exit fixtures while leaving unrelated findings open.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round45/`;
  digest `27feff302bde4868971e1ecd098223f2de549fba081112b35a660c07d07204a7`;
  invocation `b00f422d-8a03-465e-8d68-ce4ff0b81826`.
- **Confidence effect:** Codex `revise/64`, Opus `revise/63`, combined **63**,
  five points above round44's 58 but below gate 80 and target 81. This is the
  eighteenth consecutive substantive rejection.
- **Why rejected:** Both reviewers retain the more honest trusted-host scope
  and atomic marker direction, but reject the mechanical claims. Failed state
  alone does not block a systemd start job, and no concrete StartLimit interval,
  burst, finite expiry, dependency accounting, or manager-reexec persistence is
  specified. `application entry` does not pin a static raw entry/first-syscall
  trace. OnFailure cannot read the named SERVICE_RESULT/EXIT variables as
  designed; zero exit is intrinsically successful; and SIGTERM cannot identify
  soft reboot. The promised privileged audit producer/configuration digest does
  not exist. Cross-boot boot-ID/mount freshness has no durable prior comparator,
  while marker verification uses inherited umask, an undefined expected mount
  ID, and path rather than FD identity. The lifecycle narrative improved, but
  its supporting controls remained asserted rather than implementable.
- **Alternative:** Preserve the narrowed scope and marker, but make only these
  lifecycle mechanics exact: (1) set `StartLimitBurst=1` and one concrete finite
  systemd-254 interval such as 365 days, explicitly state failed state is not a
  latch, define behavior/guarantee expiry when the counter expires with no
  marker, and fixture dependency starts plus reload/reexec counter persistence;
  (2) use a static raw-entry guardian on a named ABI with no interpreter/runtime,
  making marker `mkdirat` the traced first guardian syscall; (3) set UMask=0000
  and verify the marker/current `/run` solely through no-follow FDs plus
  fstat/statx/fstatfs, with no self-referential prior mount ID; (4) replace
  OnFailure result transport with ExecStopPost's real SERVICE_RESULT/EXIT_CODE/
  EXIT_STATUS environment, flag unexpected exit 0 by failing ExecStopPost, and
  emit only a bounded custom-field schema while acknowledging trusted journald
  metadata; (5) use a reboot-neutral manager-termination code rather than
  inferring soft reboot from SIGTERM; (6) enforce epochs only by marker absence/
  presence under trusted host provisioning, treating boot ID/new `/run` as
  assumptions and diagnostics without a durable prior record; and (7) remove
  unsupported audit/control claims for trusted-root violations, explicitly
  making them out of model with no detection guarantee. Keep every wire, OFD,
  executable, writer-sandbox, socket, queue, storage, acknowledgement, and
  graceful-reboot-chain finding open. Frozen local round46 attempts only this
  correction; this entry authorizes no export.

### 18. Absolute one-guardian-per-boot claim with a resettable pre-marker gap and undefined reboot/exit boundary

- **What was tried:** Round44 deleted service FD-store and all helper restart
  claims, replacing them with one root guardian started once by PID1, fatal
  directory EEXIST, lifetime directory/OFD-lock custody, a fixed 192-byte
  STARTING record, guardian-only hashed-FD writer launch, first-instruction
  writer sandbox, private reserved writer channel, single-thread event loop,
  exact lattice/diagnostic formats, and terminal same-boot exit semantics.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round44/`;
  digest `534059fbbe3981efd3124c212fc5d6895647830ce1b263e5d91aa2d6e7e434d5`;
  invocation `2ff8a7cd-fae2-4ffd-bd3f-bc62ac1ad341`.
- **Confidence effect:** Codex `revise/58`, Opus `revise/73`, combined **58**,
  two points above round43's 56 but below gate 80 and target 81. This is the
  seventeenth consecutive substantive rejection.
- **Why rejected:** The simplification is real: both reviewers credit deleting
  the contradictory restart/FD-store mechanism, fatal EEXIST, complete atomic
  STARTING, guardian-only launch, private reserved channel, and honest tmpfs
  visibility semantics. The remaining lifecycle claim is too broad. A failure
  before the state-directory `mkdirat` leaves no marker; host root can clear
  failed/start-limit state and restart the dependency target, reaching a second
  guardian activation in the same kernel boot. Systemd soft reboot preserves
  the boot ID and `/run`, causing an intentional but undocumented lockout, while
  kexec is not classified. Clean exit can leave the unit inactive/successful so
  `OnFailure` does not run, and pre-exec Assert rejection lacks the promised
  closed mapping. Reviewers additionally preserve open findings for transition/
  error responses, OFD identity, executable qualification, architecture/compat/
  io_uring seccomp, public socket/group/NSS behavior, writer EOF/stop timing,
  diagnostics, and reason precedence. Those are not lifecycle fixes.
- **Alternative:** Correct only the lifecycle boundary: (1) state the guarantee
  under an honest trusted-host root/PID1/unit/audit model, explicitly excluding
  root reset-failed, target/unit manipulation, marker deletion, and alternate
  launch as audited operator violations that void the guarantee; (2) make the
  guardian's first application-entry syscall an atomic root-owned attempt-
  directory `mkdirat`, before other probes/fallible work, with EEXIST and every
  error terminal, while honestly relying on unmodified PID1 failed state for
  failures before entry/exec/loader; (3) define a credited epoch as new kernel,
  new real boot ID, and fresh empty `/run`; credit cold/full reboot and only
  qualifying kexec; (4) explicitly classify systemd soft reboot as the same
  epoch, preserve the marker, remain intentionally locked out, and signal a
  runbook requiring a credited reboot; (5) make every guardian-controlled exit
  nonzero/systemd-failed with `Restart=no`, bounded closed lifecycle status,
  and `OnFailure`; (6) map pre-exec Assert rejection to a fixed systemd failure/
  journal signal and require the pinned platform fixture to prove it; and (7)
  fixture reset/target violations, unchanged versus changed manager reload/
  reexec, soft reboot, cold/full reboot, kexec, and every pre-entry/entry/exit
  boundary. Leave all wire, OFD, executable, sandbox, socket, queue, storage,
  acknowledgement, and graceful-reboot-chain findings open. Frozen local
  round45 attempts only this correction; this entry authorizes no export.

### 17. PID1 FD-store restart fence with contradictory lifecycle and unproved non-pollable custody

- **What was tried:** Round43 replaced round42's impossible cross-unit handoff
  with helper-local provisioning, systemd socket activation, the helper's own
  PID1 service FD store, exact descriptor/path verification after restart,
  helper-launched writer, `SO_PEERPIDFD`, a bounded protocol and closed reason
  enum, bare-metal scope, explicit platform floors, and production-excluded
  fault hooks. Other storage, queue, acknowledgement, lock, and reboot findings
  remained open.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round43/`;
  digest `1acd801db9b654ae7b247145a3a6f4e7c26c90d044f2b93d05980d424636302a`;
  invocation `c7c95431-c30b-46b8-8a3a-3c1e4901e7b4`.
- **Confidence effect:** Codex `revise/56`, Opus `revise/74`, combined **56**,
  eight points below round42's 64 and below gate 80 and target 81. This is the
  sixteenth consecutive substantive rejection.
- **Why rejected:** Both reviewers find the central lifecycle contradictory.
  A boot-long `StartLimitBurst=1` blocks the claimed post-custody automatic
  restart; an expiring/disabled limit permits the forbidden pre-custody retry.
  Notification submission does not confirm PID1 accepted exactly two FDs, and
  directory/regular-file FDs are non-pollable, so the stated POLLHUP/POLLERR
  custody detector cannot work. An empty/cleaned FD store looks like first
  activation and `mkdirat EEXIST` is not fatal, permitting adoption of recreated
  state. PID1 is incorrectly required in `system.slice` rather than its manager
  scope. The design also omits exact OFD lock/mode semantics, a bounded canonical
  record/checksum and repeat-state table, diagnostic response schema, a
  bootstrappable post-exec seccomp point, independent-writer exclusion, a stable
  systemd control path, and reserved writer admission. Fsync does not provide
  the claimed error surfacing on tmpfs. The local provisioning, atomic STARTING,
  and pidfd directions remain useful but do not close the root of trust.
- **Alternative:** Remove the failed complexity rather than repair the restart
  branch: (1) delete service FD-store, descriptor-transfer, POLLHUP custody, and
  every same-boot helper-restart claim; (2) start one static root guardian once
  in PID1's boot transaction with `Restart=no`, coherent manual/automatic start
  refusal, and fatal `mkdirat EEXIST`; any pre- or post-custody exit is terminal
  until real reboot; (3) have that one process create a 0700 root directory and
  0600 lock with exact flags, take/retain a whole-file OFD write lock, and hold
  the original dir/lock descriptors for its lifetime; (4) define a fixed-size
  canonical checksummed fence record, complete STARTING-before-launch, the full
  irreversible/idempotent state table, indefinite STARTING lockout, and bounded
  diagnostic response; (5) have the guardian directly exec from the exact
  hashed writer FD, with the static writer installing no-fork/no-exec/no-FD-
  transfer seccomp at its first post-exec instruction before chain access; (6)
  use one nonblocking event loop, explicit deadlines/caps/fairness, and a slot
  reserved for the authenticated live writer; and (7) correct PID1 to
  `init.scope`, retain bare-metal-only qualification, stop the socket/writer on
  guardian exit, make tmpfs visibility depend on full write plus atomic rename
  without fsync durability claims, and fixture every terminal window. Preserve
  every unrelated open mechanism. Local round44 attempts only this
  simplification; this entry authorizes no export.

### 16. Root-owned host fence whose trust evidence cannot survive its proposed unit and helper lifecycle

- **What was tried:** Round42 moved boot-fence qualification and mutation from
  the writer into a root helper, ordered a separate setup unit before it,
  proposed open directory/lock descriptor handoff, atomically published a fully
  formed STARTING record, retained the irreversible boot lattice, authenticated
  callers, serialized contenders, pinned tmpfiles age cleanup, and supplied
  helper/restart/adversarial fixtures. Round40/41 storage, lock, queue,
  acknowledgement, and graceful-reboot findings stayed open.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round42/`;
  digest `5eee4cbb5caeb38576e2a1e665012c72421dcf8b45e0bd3888b290b97c4c758c`;
  invocation `a2ff6b2c-f686-46ee-adbd-ed60dfae0275`.
- **Confidence effect:** Codex `revise/64`, Opus `revise/77`, combined **64**,
  eleven points below round41's 75 and below gate 80 and target 81. This is the
  fifteenth consecutive substantive rejection.
- **Why rejected:** Both reviewers identify the central handoff as impossible:
  an exited setup unit cannot put descriptors or evidence into a helper that
  starts afterward, and systemd's service FD store is per unit. Restart then
  loses the original inode/provisioning evidence. The declared tmpfiles `d` and
  `f` entries can recreate removed paths, so removal plus helper restart may
  look like a pristine absent fence. The socket may be unreachable beneath the
  0700 directory, and the design is circular about a writer that must consume
  launch before it may start. `SO_PEERCRED` followed by `/proc`/cgroup queries
  is PID-racy and does not settle transferred connected FDs. VM clone rejection
  and initial-host namespace detection lack trust primitives. Opus additionally
  finds an open writer-controlled reason string, missing connection bounds,
  potentially shippable root-daemon fault hooks, `Requires` without readiness/
  crash binding, unstated kernel/systemd floors, and no explicit
  `RENAME_NOREPLACE`. Tmpfiles supplies detection at best, not prevention.
  The root-helper direction, fully formed atomic STARTING, and irreversible
  lattice remain useful evidence but do not establish the claimed trust root.
- **Alternative:** Preserve only that direction and realize the fence root of
  trust coherently: (1) fold provisioning/preflight/open-descriptor custody into
  the helper process itself and use its own PID1/systemd service FD store plus
  socket activation to retain exact descriptors across restart; fail closed if
  custody is absent or mismatched rather than reopening by path alone; (2) use
  no recreating tmpfiles `d`/`f` rule, treat any exclusion as detect-only, and
  compare retained descriptor inode/mount/link identity to the live path; (3)
  place the socket directly under safely traversable `/run`, use `Type=notify`
  and `BindsTo`, and have the helper launch the fixed writer only after STARTING
  to remove circularity; (4) use `SO_PEERPIDFD` plus a live pinned pidfd and
  enforce a single-process/no-exec/no-`sendmsg` writer premise so each one-shot
  connection cannot be inherited or transferred; (5) drop VM/container support
  entirely, accept bare-metal initial-host systemd provisioning as the scope,
  name concrete defense-in-depth namespace/procfs/tmpfs checks, and fail closed
  on ambiguity; (6) close the protocol with a fixed reason enum, byte/frame
  bounds, timeouts, connection caps, exact Linux/systemd minimums,
  `openat2`/`statx`/pidfd/`RENAME_NOREPLACE`, and production exclusion of fault
  hooks; and (7) fixture descriptor custody/loss, tmpfiles recreation, socket
  traversal, PID reuse/FD transfer, launch ordering, stalls/caps, unsupported
  platforms, and crash-after-rename permanent same-boot lockout. Keep every
  unrelated lock, queue, storage, acknowledgement, descriptor-trigger, and
  graceful-reboot finding open. Local round43 attempts only these seven points;
  this entry authorizes no export.

### 15. Writer-owned `/run` fence with partial initial publication and bypassable host qualification/deletion controls

- **Round:** round41 digest `5aeadd444287187f76e5b3a683d9e0746df69d26c0518260632e4626e85fe22d`, invocation `3ea2d589-252f-4e25-8ad9-b48e1ecb04fe`.
- **Confidence:** Codex `76`, Opus `75`, combined **75**; rejection fourteen.
- **Why rejected:** O_EXCL exposes partial STARTING, randomness may fail before
  reservation, containers pass the purported host check, unprivileged PID-1
  inspection lacks authority, and writer/tmpfiles deletion restores absence.
- **Alternative:** root-owned host-unit-ordered helper, non-writer-writable `/run`
  directory, fully formed atomic STARTING/TAINTED publication, no unlink/reset,
  authenticated serialized callers, pinned no-cleanup tmpfiles and host-only
  scope. Keep unrelated round40 findings open. Local round42 attempts only this;
  no export is authorized.

### 14. Host-reboot recovery model whose sole-writer and tainted-boot fence exists only in supervisor memory

- **What was tried:** Round40 required a real host reboot/new boot ID, lifetime
  descriptors, conservative slot/head triggers, seq-cst latch/API ordering,
  startup fencing, prior-ack settlement, and a deterministic block fault seam.
- **Round:** `.kstack/reviews/reasoning-effort-policy-2026-08-23-round40/`;
  digest `97e6976fd20f958c826485791215ba374f0e0813f7c015198ee0d09d2ea6678b`;
  invocation `f81f0cb1-175b-4c07-849d-40a59c57d65e`.
- **Confidence effect:** Codex `revise/74`, Opus `revise/70`, combined **70**,
  thirty above round39 but below round27 72, gate 80, and target 81. Thirteenth
  consecutive rejection.
- **Why rejected:** Supervisor restart forgets launch consumption and taint,
  allowing an unsafe same-boot writer. `STARTING` is absent. Boot-ID host
  authenticity/namespace, exact lock and queue behavior, platform
  qualification, prior-ack drain, graceful reboot, and several fixtures remain
  unresolved. Both reviewers nevertheless retain the real-reboot and ordering
  direction.
- **Alternative:** Add only authenticated host `/run` tmpfs state that atomically
  records `STARTING`, `HEALTHY`, and irreversible `TAINTED` for the real boot ID;
  survives supervisor restart; refuses same-boot relaunch/contenders and
  unauthorized writers; validates owner/mode/no-symlink/mount/host boot ID; and
  disappears only on actual reboot. Do not claim cross-reboot durability.
  Preserve lock, queue, qualification, acknowledgement, graceful-reboot, and
  unrelated findings open. Directed local round41 attempts only this fence;
  this entry authorizes no export.
