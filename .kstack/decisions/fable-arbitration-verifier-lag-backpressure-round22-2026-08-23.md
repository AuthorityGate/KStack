# Fable arbitration — round 22: verifier-lag unboundedness in the checkpoint mechanism

**Scope of this ruling.** Whether bounding verifier lag via backpressure is compatible with the round-21 prohibition on fixed caps / escape hatches / resumable sessions as a primary bounding mechanism, and if so what shape is required. Binding on round 22.

## 1. Ruling

**Yes — bounded backpressure on unverified in-flight work is compliant with round 21, and it is required.** The round-21 theorem is currently proven only under the maintenance-fairness hypothesis; round 22 must discharge that hypothesis by making it a protocol-enforced invariant, not an assumption. Criterion 2 is restated as: **steady-state gate cost is bounded by a derived constant unconditionally, over every verifier-availability schedule** — including permanent verifier loss.

Both reviewers' proposed shape (stated lag bound + bounded-retriable degradation + verifier replacement) is accepted, but **only as a package** (§3). Any one of the three alone is a relocation and is rejected.

## 2. The normative test — what round 21 prohibited vs. what this ruling permits

Round 23 will otherwise relitigate this as "a relocated cap." So the discriminating test is part of the ruling:

> **A bound on a monotone quantity is a cap and is prohibited as a primary mechanism. A bound on a drainable quantity is flow control and is compliant.**

- Total project history is monotone: it never shrinks. A limit on it fails open into an escape hatch (resumable session, operator overlength operation) and leaves O(N) growth intact up to the limit — the limit becomes the operating point. That is what round 21 prohibited.
- The unverified tail (events since the last VERIFIED coverage tail) is drainable: it shrinks to ~0 whenever the verifier runs, or when the verifier is rotated. A limit on it fails *closed*: every correctness bound and every cost bound stays intact; the only thing traded is availability, and recoverably.

Corollary: a prohibited cap makes cost conditional on history; compliant backpressure makes *availability* conditional on verification liveness while cost is unconditional. The second trade is the correct one. The alternative — admitting without bound — converts a transient availability problem into a permanent cost/correctness failure with no route back, which Opus correctly identified as strictly worse.

## 3. Required mechanism — round 22 must implement all of the following

### 3.1 Lag bound `L_max` as a derived constant, enforced at admission

- The writer refuses to admit event *e* iff `seq(e) − coverageTailSequence(last VERIFIED) > L_max`. Refusal returns a retriable result code (e.g. `VERIFIER_LAG`), performs **no chain mutation and no state change**, and is distinguishable from every corruption code.
- **`L_max` is not a tunable.** It is the largest tail that provably validates inside the existing 300,000-ms gate deadline with stated margin, per the cost model. Show the derivation. The refusal is the contrapositive of a constraint round 21 already imposed: admitting past `L_max` means admitting events no gate could ever validate.
- SEALED pipelining: **at most one SEALED candidate outstanding.** A second SEAL is not created until the first is VERIFIED or REJECTED. The tail arithmetic must therefore include checkpoint-lifecycle events; the draft states the exact worst-case count (on the order of 128 covered-by-SEALED + SEALED event + 128 raw + checkpoint-verified event — the draft shows the actual number, not "≈").

### 3.2 Per-event key-fanout cap — promoted to primary

`N_tail` is in events; the gate cost bound is in bytes. Without a normative per-event fanout cap, `L_max` bounds nothing, and both reviewers said everything downstream inherits the gap. Required:

- A schema-validity constraint `K_event`: maximum distinct map keys an event may touch, checked **before** admission; oversized events are rejected and never enter the chain. By the §2 test this is compliant — no history cap, no chain mutation.
- Interval closure on **min(128 events, `K_interval` keys)**, so the delta-page envelope (and the 8-MiB / gate-read bound) is *derived* from `K_event`, `K_interval`, node size, and depth — not asserted.

### 3.3 Drainability — verifier throughput proven ≥ admission rate

Add a cost-model row proving verifier per-interval work ≤ gate per-interval work (it validates the same bounded interval + delta the gate would). Consequence, which the draft states: lag accumulates only during verifier outage, never under steady operation; "verifier merely slower than append rate" is not a reachable steady state — sustained admission rate is bounded by verifier throughput, and that is the intended behavior.

### 3.4 Replaceability — verifier set with chain-recorded rotation

- Replace the single Ed25519 signer with a **verifier set** (1-of-n is acceptable for v1; threshold is optional). Writer identity is never a member.
- Rotation is a chain event (`verifier-set-update`) authorized by a **pre-registered operator root key, distinct from the writer, registered at genesis.** Two hard requirements: rotation must **not** require the lost/compromised key (else deadlock), and must **not** be writer-authorizable (else forgery path).
- With this, permanent verifier key loss is bounded by rotation time, not by a seven-day lock, and SEC-CHECKPOINT-VERIFIER-SINGLE-SIGNER is mitigated. The remaining residue — a coerced verifier attesting a forged state before cleanup unlinks the evidence — is either mitigated (retain the raw records of one additional VERIFIED generation in the mirror before prune) or explicitly disclosed under residual limitations. Not both silently omitted.

### 3.5 Genesis as a virtual VERIFIED checkpoint

"No VERIFIED checkpoint exists" is defined as a virtual VERIFIED checkpoint at sequence 0 with empty roots. It is trivially self-verifying and requires no verifier signature. This closes the bootstrap-before-verifier-reachable liveness row.

### 3.6 Anchor-gap fix (Codex's strongest objection) — same directive

This is chain correctness and it changes the tail arithmetic, so it lands in round 22, not later:

- Gate replay starts at `coverageTailSequence + 1`, **not** at the checkpoint-verified event's successor.
- SEALED and checkpoint-verified events are ordinary chain events, validated in the tail like any other.
- A rejected SEALED event remains in the chain as an immutable record; the next candidate's `previousRecordSha256` chains through it normally, and `coverageTailRecordSha256` is redefined as the last *non-lifecycle* record covered — so the "previousRecordSha256 must equal coverageTailRecordSha256" requirement is replaced by a chain-through rule that admits lifecycle events between them.

## 4. Relocations explicitly rejected

Round 22 must not attempt either of these:

- **Gates consuming SEALED-but-unverified compact state.** Trust hole: the writer forges state and the gate accepts it. The verifier exists for independence from the writer; this discards it.
- **Gate-side catch-up verification of an unbounded SEALED chain.** This moves O(lag) onto the first gate after an outage. With at most one SEALED outstanding (§3.1) a gate never faces a chain of SEALED candidates; it validates VERIFIED + bounded tail, full stop.

## 5. Required acceptance tests

1. Verifier offline → admissions succeed up to exactly `L_max` and refuse with `VERIFIER_LAG` on the next event; no chain mutation on refusal.
2. Gate at maximum lag validates within the 300,000-ms deadline with the stated margin.
3. Recovery via verifier catch-up: lag drains, admissions resume without operator action.
4. Recovery via rotation: verifier key destroyed → `verifier-set-update` under the operator root → new verifier attests → admissions resume. Rotation must succeed with the old key absent.
5. Event exceeding `K_event` rejected pre-admission; interval closing on `K_interval` before 128 events produces a delta page within the derived envelope.
6. Anchor gap: events appended between SEALED and checkpoint-verified are replayed by the gate and enforce duplicate-use.
7. Genesis: first gate on an empty store succeeds with no verifier present.

## 6. Disposition of secondary items

- **Seven-day helper / CHECKPOINT_CORRUPT cliff:** reclassified as an availability surface. Mirror replication of every VERIFIED page becomes a **prune precondition**; single-file corruption is recovered from the mirror without the exclusive lock. The helper survives only for dual-loss.
- **Global bijection accumulator:** name it, include it in the compact roots. Its growth is proportional to publication artifacts (state), not to events (history) — say so explicitly; state-growth is compliant with criterion 2.
- **v1→v2 namespace collapse:** migration is blocked when two live, non-terminal generations would collapse onto one key; operator resolution is required before migration, recorded as a chain event.
- **Broker restart fallback ambiguity:** broker must fall back only to the newest VERIFIED root whose coverage includes every used-authorization-ID event it has acknowledged; state the rule.
- **Cost model:** add fsync/durability-barrier rows (per-event hard-link, up to 128 page publications, directory flushes, copy-on-write node insertion), quantify the 64,000-ms inherited row, and add the boundary-liveness rows Opus and Codex enumerated (bootstrap failure, first-checkpoint storage exhaustion, rejected SEALED candidate, outage beyond one cadence, corrupted mirror/receipt, interrupted recovery, near-full store with no VERIFIED leaf to unlink). State the required storage reserve.
- **No-regression rounds 1–17:** round 22's packet must include the deleted constants/fields/codes/helper alongside their replacements so reviewers can check it — per [[feedback-qc-packet-completeness]] this is a packet requirement, not optional.

## 7. What "converged" means for this thread

Round 22 closes the primary finding when both reviewers accept that criterion 2 holds unconditionally over all verifier schedules and that the tail and byte bounds are derived constants. Per the standing threshold tiers, the bar is 80% confidence at round 11+. Fable is not needed again on round count alone; re-engage only on a genuine unresolved disagreement or another relocation.
