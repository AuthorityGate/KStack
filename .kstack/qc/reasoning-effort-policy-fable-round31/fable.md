Advisor caught one genuine within-packet contradiction (abort-after-rename vs. Guarantee 1). Two-line amendment below; the directive above stands otherwise.

## Amendment (binding, supersedes the corresponding lines above)

**Abort rule — replace:** *"Abort at any point before step 6: delete this hold's own temp file (step 3 of the next hold is the backstop), release `L`."*
**With:** **Abort (any point before step-6 durability): re-run step 3, then release `L`.** Step 3 is idempotent and removes both this hold's temp file and — if the rename already happened — the canonical-but-unreferenced candidate, which is in `Obligations(H)` because no durable event names it; the deletion is justified by INV-DURABLE-ONLY, not by transaction-local knowledge. If the re-run itself fails with an I/O error, release anyway; the obligation remains derivable and the next hold's step 3 is the backstop. This keeps Guarantee 1's postcondition (`present ⊆ liveAddrs(H)` after any hold in which step 3 completed) true for aborted holds, not only successful ones.

**Crash-table row "after rename, before step 6 durable" — append:** *(crash → reclaimed at next hold; clean abort → reclaimed by the same hold's step-3 re-run.)*

**Lock scope — add to the reclaim-only-hold section:** `L` is round 27/31's append lock, acquired through the same interface the appender uses. The sweeper and startup recovery are additional acquirers of the same lock — not a second lock or lock type — and startup recovery runs before any appender starts.

---

## Recap

- **Ruling:** Option 1 — reclamation folded into round 31's single append-lock hold as its *first* step, with reclaim obligations recomputed from (durable chain prefix + directory listing) at every hold and never persisted. All auxiliary records (`StagingIntent`, `CleanupTombstone`, `SlotAttempt`, pre-allocated `refId`, `CROSS-RENAME-INSTALL-DURABLE`) are retired.
- **Guarantee-1 fix:** obligations are per-content-address, computed as `present \ liveAddrs(H)`, where `liveAddrs` includes `RETAINED_VERIFIED`; a later disposal across the VERIFIED boundary materializes the obligation automatically at that `H`.
- **Option 2 rejected:** an epoch still needs delete/adopt mutual exclusion between read and delete, so it degenerates to the lock plus a redundant record.
- **Every counterexample from rounds 28–31** is mapped to the specific reason it can no longer occur; the five carried-forward items are mapped (removal-last and equal-content guard subsumed, the rest preserved, round-31's hold extended not reopened).
- **Not done:** no plan file was written — this session exposes no file-write tool — and no repo files were touched; the next step is for the round-32 orchestrator to inline this directive plus amendment into the decision brief and dispatch the dual review.
