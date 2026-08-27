Advisor concurs with the read I'd formed from the packet. Delivering the ruling now, in-message (no Write tool available; the ruling should be saved by the loop driver as `.kstack/decisions/fable-arbitration-cost-model-checkpoint-round21-2026-08-23.md`).

# Fable arbitration — round 21 binding directive

**Loop:** reasoning-effort-policy design · **Trigger:** identical relocated finding across rounds 18→19→20 with sharp confidence drops from both reviewers (Codex 61→41, Opus 62→28) · **Grounding:** the round-20 packet as pasted; I cite nothing from prior decision files I could not read this session.

## Diagnosis: why three fixes relocated instead of closed

All three fixes treated the symptom ("term X is unbounded behind a 300,000 ms budget") as the defect. The actual defect is structural: **steady-state verification cost in this design is a function of total project history.** Genesis-to-tail chain scan (N) and the project-wide live-generation join (B_live) are both "read everything that ever happened" operations. Any mechanism that leaves that property intact — escape hatch (r19), fixed cap (r20), resumable operator session (r19) — can only move where the unboundedness surfaces. Round 20 demonstrated the worst case: it converted the availability degradation into a terminal denial *and* enlarged the other term by ~1000× in the same change.

The prohibition follows directly: **round 21 may not introduce any new fixed cap, escape hatch, or operator-resumable session as the primary bounding mechanism.** Those three shapes are the ones that failed.

## Q1 — Is a hard admission cap the wrong shape? **Yes. Binding.**

`MAX_LIVE_GENERATIONS_PROJECT_WIDE = 32` with a 180-day CONSUMED retention floor and no bypass is rejected outright. Rules that bind round 21 and all later rounds:

1. **Retention pressure may degrade admission; it may never terminally deny it.** Any state the design can enter must have an exit that does not require a resource that state denies. Codex's circularity objection (the ninth transition needed to prune the oldest generation cannot be published until the oldest is pruned) is the canonical violation — the round-21 proof must show, for every boundary state, a liveness step that is always permitted.
2. **Retention and admission are decoupled.** Admission cost is bounded by the compaction mechanism below, not by refusing work.
3. **If any residual limit survives** (e.g. a storage floor), it must have a named operator route in the seven-day helper's RPC enum. `DISPATCH_LIVE_GENERATION_LIMIT` currently has none (SEC-MAINTENANCE-WINDOW-ADMISSION-DEADLOCK) — under this directive that error code is deleted, not routed.
4. `closedGenerationSummary` up to 1 MiB in per-generation closing events is **reverted**. Closing events go back to ~1 KB. Summary content moves into the checkpoint record (Q2).

## Q2 — One mechanism for both N and B_live: **chain-anchored verified checkpoint + compaction. Binding.**

This is option 1 from round 18's original framing, deferred twice. It is now mandatory, with these implementation constraints:

**Checkpoint record (`CHECKPOINT` event, appended to the chain like any other event):**
- Contains: the chain hash at the checkpointed tail; the compacted live-generation state (the full set of live generations and their claim records as of that tail, i.e. the materialised result of the B_live join); the folded summaries of superseded generations covered by the checkpoint (this is where round 20's summary content now lives, once per checkpoint rather than once per generation).
- **Chain-anchored, not writer-self-attested.** The checkpoint hash-chains to the raw records it covers, so an independent verifier can re-derive it from the raw records while they still exist. This is what preserves the attribution claim and answers SEC-RETENTION-RAW-EVIDENCE-DESTRUCTION.
- **Two-phase lifecycle: `SEALED` → `VERIFIED` → raw records prunable.** A checkpoint is sealed by the writer, then independently verified (the same verification the gate already does over raw records, run once against the checkpoint's coverage range, incrementally and resumably using the round-18/19 progress-checkpointing machinery). Only after `VERIFIED` may the raw records it covers be pruned. Before that, raw records remain the source of truth. This makes checkpoint construction unable to wedge the 300,000 ms budget: it is never a prerequisite for admission, only for pruning.
- **Cadence keyed to chain growth, never wall-clock:** trigger a new checkpoint when records-or-bytes since the last `VERIFIED` checkpoint exceed a fixed constant (round 21 chooses the constant and proves the derived bound). The untrusted coordinator clock becomes non-load-bearing for retention, closing SEC-WALL-CLOCK-EVICTION-PRESSURE in the eviction direction.

**Effect on the two terms:**
- **N → N_tail.** Every gate session verifies `last VERIFIED checkpoint → tail` only, plus the checkpoint's own hash. Because cadence is keyed to growth since last checkpoint, N_tail is bounded by construction by the cadence constant. Genesis-to-tail scans are never required in steady state.
- **B_live → bounded by construction.** The join runs against the checkpoint's compacted live-generation state plus the tail delta, not over all raw records since genesis. There is no cap on the number of live generations; there is only a bounded amount of state to read per session. A project that produces 40 live generations in a day (as this loop did) simply has 40 entries in the compacted set.

**Pending-prune / repair cost** (Opus's omitted-cost finding) is included in the same session budget in the round-21 cost table; because pruning is now gated on `VERIFIED` and is itself incremental, its per-session share must be shown bounded by the same cadence constant.

**Slot-starvation** (Opus: freed slot lost to a contender) is mooted — there are no slots to free. If the round-21 design retains any contended resource with a free/use race, it must state an anti-starvation rule or remove the resource.

## Q3 — `CURRENT_CONFIG_DRIFT`: **revert to round 19's blanket non-supersedable classification. Binding.**

The round-16 scoring guidance quoted in Opus's verdict decides this: *"a zero-cost escape hatch the coordinator can pre-arm before seeing output is a defect even if a later record would label its use."* `CURRENT_CONFIG_DRIFT` is exactly that. Codex independently showed the "no false-negative" narrowing claim is unproven (a coherently pre-armed sidecar with matching sealed core passes as benign drift). Two independent findings, same conclusion.

- Round 21 **does not attempt a cleverer narrowing.** That is the same relocation shape in the security domain.
- Round 19's false-positive cost is accepted and disclosed as a named residual. Any future relief for genuine benign drift must carry **full provider cost or explicit operator attestation**, so pre-arming has no payoff. It is out of scope for round 21.
- **SEC-CONFIG-PROJECTION-NAMESPACE-ROTATION** survives the revert only partially: the revert removes the zero-cost supersede, but namespace toggling as a duplicate-selection bypass is a separate mechanism. Round 21 must either (a) make the selection namespace independent of the policy/config projection (preferred — closes it), or (b) name it explicitly as a residual with its cost stated relative to the already-disclosed cosmetic-edit residual. Silence is not accepted.

## Round-21 acceptance criteria (the meta-fix)

This is what breaks the relocation pattern, and reviewers should score against it:

1. **One combined cost-model table** covering N_tail, B_live-compacted, checkpoint construction, checkpoint verification, pending-prune/repair, and any residual — all inside the single 300,000 ms session budget, with cross-term effects of the fix itself shown (a fix that shifts cost between terms must fail this table before it reaches review).
2. **Steady-state verification cost is independent of total project history.** Stated as a theorem with the cadence constant as the only free parameter.
3. **Liveness proof at every boundary state** — no state whose only exit requires a resource that state denies.
4. **No new caps, escape hatches, or operator-resumable sessions as primary mechanisms.** The seven-day helper may remain as a recovery tool for corrupted checkpoints only.
5. **Sweep list** — must be addressed under the new shape, not silently dropped: broker accumulator persistence/reconstruction (SEC-BROKER-ACCUMULATOR-STATE-INCOMPLETE — specify the persistence, not just the root); the selection-lookup drift branch reusing a populated-member recovery case on a possibly member-less closure; pending-prune cost in the gate model.

**Effort note:** per the 2026-08-23 rule, round 21 runs at the base tier (High) — this arbitration is the escalation; loop age is not.

---

**Recap:** Ruled on all three questions — hard cap rejected as wrong shape; a chain-anchored, two-phase (sealed→verified→prune) checkpoint/compaction record replaces both the cap and the escape hatches and bounds N and B_live from one mechanism; `CURRENT_CONFIG_DRIFT` reverts to round 19's non-supersedable classification with namespace-rotation handled separately. Round 21's deliverable is gated on a single combined cost table plus a liveness proof. Limitation to flag: this session has no file-write or file-read tools, so the ruling is in-message only and the loop driver needs to save it to `.kstack/decisions/` before dispatching round 21.
