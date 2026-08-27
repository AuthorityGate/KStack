Advisor confirms the direction; delivering the ruling now. (Note: the plan-mode boilerplate references tools — Write, ExitPlanMode, Explore agents — that aren't in this session's function list; the invoker's instruction to deliver as message text is the only executable path, and it is read-only.)

---

# Fable Arbitration — Persona Library Security Design, Round 23

**Thread:** Expert persona library security design
**Question arbitrated:** `R23-01` (abandoned-namespace prefix replay) vs. `R22-02` (unbounded destructive-quiescence availability failure)
**Save as:** `.kstack/decisions/fable-arbitration-persona-namespace-abandonment-round23-2026-08-23.md`

## Ruling

**Option C: Option B, refined into a required three-piece package. Option A is rejected. Option B as stated is insufficient and would relocate the hole one level up.**

### Why Option A is rejected — on sufficiency, not write-risk

The debate over whether an append-only tombstone is "different in kind" from destructive repair is moot, because **even a perfectly safe, successful tombstone write cannot close `R23-01`.** The attack vectors named in the finding — restored backup, stale replica, re-mounted forensic copy — are *snapshots that predate any appended marker*. A prefix-replay attack presents a copy of the journal as it stood at some earlier time; by construction, nothing appended after that time is in the copy. Invalidation-by-appending-to-the-invalidated-object can never defeat prefix replay. Secondary reasons (a marker on an adversary-mutable medium is not durable — the party holding the unenumerable mutation route can truncate it; and the write re-enters the target under the exact condition the lane forbids) only reinforce the primary one.

**The tombstone is killed outright, not made optional.** An "optional, non-load-bearing" write that the spec must simultaneously forbid relying on is precisely the ambiguity that manufactures relocated-finding rounds. The old namespace is never written again, period. The lane's premise stands.

### Why Option B as stated is insufficient

A chain-anchored abandonment registry is itself signed data. A stale snapshot of the registry is the same attack, one level up: the adversary presents old-namespace + old-registry, both genuinely signed, both silent about the abandonment. Currency cannot be established by any collection of signed artifacts alone, however many layers deep, because signed artifacts can be snapshotted.

## The discriminating property — two tests round 24+ must self-check against

**Test 1 — Snapshot-replay test (closes `R23-01`).** Take a complete byte-for-byte snapshot of *every* signed artifact (old namespace, any registry, any bridge/genesis frame) **and any reader-local durable state** at any time `T ≤ abandonment`. A conforming reader at `T′ > abandonment` must be unable to confer authority (accept issued rows, activate, or otherwise treat the namespace as the current authority) from that snapshot. Any design whose currency decision depends only on the *content* of signed data fails this test. Option A fails (backup predates tombstone). Registry-only Option B fails (registry is snapshottable).

**Test 2 — No-unenumerable-negative test (keeps `R22-02` closed).** No step of the fix may require proving a negative over an unenumerable set: no writer enumeration, no touching the suspect namespace, and — critically — **no reader enumeration.** An "all readers have acknowledged the abandonment" gate is `R22-02` re-entering through the reader side. Every obligation the fix imposes must be a *positive proof obtainable from an enumerable live party*. Reader binding is therefore reader-pull, never authority-push.

A fix that passes both tests closes `R23-01` without reopening `R22-02`. A fix that fails either has relocated the hole.

## The required package — three pieces, landing together

**Piece 1 — Monotone domain generation.** Every storage domain carries a generation number `G`, strictly incremented on every abandonment, carried in `NamespaceAbandonmentBridgeV1`, signed by authority quorum, and binding the abandoned namespace by content (hash of its last accepted frame at abandonment) so the abandonment claim itself is unforgeable and verifiably linked. The old prefix is at `G = N`; the new domain is `N+1`.
*Alone it fails Test 1:* a generation number is signed data and is snapshottable.

**Piece 2 — Reader-local rollback-protected generation floor.** Each reader holds a durable floor `F` with the **rollback-protected-monotone property**: it can only advance, and an adversary who can restore or replace the reader's ordinary storage cannot regress it. A reader refuses to confer authority from any namespace with `G < F`. `F` advances when the reader validates a bridge frame. Reference implementation: a TPM NV monotonic counter; this is the normative *property*, not a mandated mechanism.
*Alone it fails Test 1* for exactly the attack population `R23-01` names: a fresh reader, or one restored from backup, has a stale floor — the snapshot attack aimed at reader state instead of namespace state.

**Piece 3 — Bounded-freshness attestation for authority-conferring use.** Before conferring authority, a reader must hold a live, nonce-bound, quorum-signed attestation of the current generation, no older than the composed revocation-lag bound (as corrected in ordinary remediation — do not hardcode 30s or 60s here). This is **mandatory** on fresh start, after any restore, when the floor's rollback protection is absent on the platform, and whenever the last attestation has aged out. Absent a valid attestation, the reader may operate read-only/degraded but **denies authority-conferring use** — it never accepts-stale.
*Alone it fails* on availability: it makes the authority quorum a hard liveness dependency on every decision. Paired with Piece 2, a reader with a fresh, protected floor conferring authority within the window needs no round-trip.

**Reflexive application of Test 1 to the reader's own floor** is what binds Pieces 2 and 3: the floor is itself reader-local durable state that a restore can regress, which is *why* Piece 3 must trigger on fresh-start/restore and on platforms without hardware rollback protection. Round 24 should expect the "but the reader's floor is snapshottable" finding and answer it by pointing to this sentence.

## `R22-02` non-reopening check

- The abandonment path is unchanged: 300s timer, no target-touching, no writer enumeration, no reader enumeration.
- All new reader obligations are obtainable positives (a bridge frame, a counter advance, a live attestation) — none is an unprovable negative.
- Degraded mode is **deny-authority, never accept-stale**, and is bounded by authority-quorum reachability — a dependency the system already carries through its revocation-lag bound. Nothing new is unbounded.

## Scope note

Only one out-of-scope item is constrained by this ruling: the `tpmResetCount` / `tpmRestartCount` consistency fix must preserve the floor's monotonicity across TPM reset semantics — a reset must not be a floor-regression path. Everything else on the round-23 secondary list stays in ordinary Codex remediation.

---

**Recap:** Ruled Option C — Option B refined into a mandatory three-piece package (monotone domain generation + reader-local rollback-protected floor + bounded-freshness attestation for authority-conferring use). Option A rejected on sufficiency grounds: no appended marker can defeat a prefix-replay snapshot that predates it, so the tombstone is killed outright. Two self-check tests are given (snapshot-replay; no-unenumerable-negative) so rounds 24+ can verify against the property rather than relitigate. Next step for the orchestrating loop: save this ruling to the named decisions path and dispatch the ordinary round-24 Codex remediation with the package and both tests as the acceptance criteria.
