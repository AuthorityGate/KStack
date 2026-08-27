Record date: 2026-08-23 — Fable arbitration record for this design loop's round-5 scope fork.

# Fable arbitration ruling — Reflexion semantic-retrieval design loop, round 5 scope fork

## Ruling: **(A)** — narrow the v1 scope — with (C)'s threat-model declaration adopted as a **binding precondition** on the deferred work

Ship the core matching improvement. Remove the raw-query retrieval log entirely from this design, deferring it — and its whole path-security/concurrency apparatus — behind a future, separately-scoped design session that must open with an explicit threat-model ruling before any mechanism design.

### Why (A)

1. **The mandate is dispositive.** The objective's own proportionality clause — "cost/complexity should be proportionate to the actual current lesson corpus size (currently 4 lessons)" — is the one constraint neither reviewer had standing to enforce and the one the design most clearly violates. Descriptor-bound path protocols, lock-quarantine choreography, git-binary trust analysis, Unicode oracle tables, byte-exact log compaction, and three-platform filesystem qualification blockers are not proportionate to retrieving 4 lessons, and none of them improve retrieval.
2. **100% of round-4 and round-5 findings sit on the audit log's security properties; zero are about matching quality.** The core matcher (NFKC normalization, boundary-aware phrase containment, deterministic evidence/ranking, `applicabilityPhrases`/alias repair, Actor-context escaping) has been substantially approved since round 3. The objective's deliverable is done; the loop is stuck on something the objective never asked for.
3. **The confidence trajectory is non-convergence, not a plateau.** Both reviewers regressed in round 5, on a third consecutive instance of the identical failure shape ("hardening sound in isolation, new problem in composition"). That is the empirical signature of a surface that will not converge under continued iteration.

### Why not (C) now

Even under a deliberately weakened, documented-as-best-effort security posture, round 5's log findings include **non-security specification gaps** — the compaction-prefix fixpoint circularity, the missing deadline-exhaustion degraded reason, the absent native-Windows lock implementation. Option (C) would keep the entire log spec surface inside this review loop; (A) exits it. (C)'s one correct idea — the threat-model posture — is preserved below as the precondition on the future session.

### Why not (B)

(B) presumes the apparatus is one complete round from watertight. Three consecutive rounds of the same failure class, with a **regressing** confidence trajectory, is direct evidence against that. See the next section for why the failure is structural.

## Ruling on the second question: the descriptor-bound approach is not converging — and it should not be replaced by a better mechanism, but **dissolved by a threat-model correction**

The rounds 3→4→5 pattern is structural, not bad luck:

- The design attempts **watertight same-user TOCTOU-proofing in portable Node**, which lacks the primitives each round's fix turns out to require: dirfd-relative `openat` semantics on all platforms, `renameat2 RENAME_EXCHANGE`, directory file descriptors on native Windows (Opus's own finding: the lock protocol has *no stated implementation* on one of its three target platforms). Each round patches the discovered instance; the unsatisfiable requirement regenerates a fresh instance in the next mechanism reviewed. Round 6 on the same terms would produce a fourth.
- More fundamentally, **the defended boundary does not exist.** On every target platform, a same-user process that can win these filesystem races can also directly rewrite `.kstack/reflexion-lessons.json`, replace `kstack-reflexion.mjs` itself, or attach a debugger to the running process. There is no security boundary between same-user processes; TOCTOU-proofing one file open in a tool whose entire code and data surface is writable by the same principal purchases nothing. The round-5 draft itself concedes this ("a malicious same-user actor able to install a stable regular file can already edit project lesson data") and then keeps building anyway. Opus's SEC-R5-02 (git-binary substitution via `PATH`/`LD_PRELOAD`) is the same message from another direction: once "hostile same-user environment" is admitted into scope, nothing short of a sealed runtime survives. The reviewers keep finding real holes because the draft keeps asserting the property matters. The correct resolution is to declare the property a **non-goal**, at which point the residual races become documented behavior rather than defects.

## Narrowed v1 scope (round 6)

**Ships** (all stable/approved-in-substance since round 3):

1. Symmetric NFKC/lowercase/tokenize normalization pipeline (combining-mark-preserving).
2. Boundary-aware phrase containment + shared-token eligibility; deterministic canonical evidence, ranking, selection caps, Actor-block byte bounds.
3. `applicabilityPhrases` field + `record --alias` repair command, with existing floors/bounds/secret-scan rejection.
4. Actor-context trust boundary: bounded, categorically escaped, marker-delimited untrusted lesson block; task-first/block-last assembly.
5. Input-bounds table; deferred-features/50-lesson evaluation gate.

**Two carried-in fixes** (they touch the shipped surface, so they stay in scope):

- **Escaping invariant extended and restated.** Per Opus SEC-R5-04, the escape predicate must also fire on scalars whose canonical decomposition (NFD/NFKD, not just NFKC) contains a marker ASCII scalar (the U+226E/U+226F class), with the structural invariant stated over all four normal forms. Additionally — covering Opus's separate composition finding — the invariant must be stated and tested at **sequence level**, not per-scalar only: multi-scalar adversarial fixtures asserting no marker synthesis across scalar boundaries under any normal form. This is a predicate-set change plus test extension, not new apparatus; the Unicode-derived exhaustive comparison stays as a test-time artifact.
- **Corpus I/O reverts to proportionate simplicity.** Read: plain open (`O_NOFOLLOW`, regular file, 1 MiB cap) → read → strict UTF-8/JSON/schema validation; one bounded re-read on failure to tolerate a concurrent atomic replace is acceptable; **no ancestor-identity snapshots, no A/B/C sandwich, no retry protocol**. Mutation: keep temp-file/fsync/atomic-rename and a simple bounded-wait lock (the pre-round-4 shape); **drop detach-then-destroy, stale-repair quarantine, and PID/start-identity liveness proofs**. Document once: same-user filesystem races are outside the threat model of a project-local developer tool; schema validation plus Actor escaping are the trust boundary for corpus content.

**Deferred wholesale:** `persistence.retainRawReflexionQueries` and the entire retrieval operational log — writer-sequence state and locks, `setup-retrieval-log`/`repair-retrieval-log`/sentinel, the degraded-reason taxonomy, canonical record serialization and `verify-retrieval-log`, log compaction, the VCS-propagation precondition and git-subprocess sanitization, the descriptor-bound log/lock protocols, platform-qualification release blockers (WSL2 drvfs / native NTFS / network FS), and the 2,500 ms audit budget. Consequence to state explicitly in the round-6 draft: **lookup becomes purely read-only again** — no sequence-state write on any lookup — which also moots the per-lookup-fsync and 250 ms sequence-lock concerns.

**Binding precondition on the future audit-log session:** it opens with an explicit owner-level threat-model ruling — *is a hostile same-user co-tenant process in scope?* — decided **before** any mechanism design. Fable's recommendation, recorded now: **no** (best-effort posture; races documented as explicit non-goals). If that answer stands, most of the deferred apparatus never returns. If the answer is forced to "yes," portable-Node filesystem choreography cannot deliver it and the feature must be redesigned on different foundations or not built.

## Process directives for round 6

- **Round 6 is a subtractive packaging round, dispatched to Codex** at `-c model_reasoning_effort=xhigh` (loop is past round 3): produce the narrowed draft by removing the deferred sections from round 5, applying the two carried-in fixes, and adding a short "Deferred: retrieval operational log" section recording the deferral, this ruling as its reason, and the threat-model precondition. **No new mechanisms.** The same dispatch writes the arbitration decision artifact to `.kstack/decisions/` (dated 2026-08-23, content: this ruling verbatim) — per the standing rule, Codex executes; Sonnet stays on packet assembly and git plumbing only.
- **Reviewers review against the narrowed scope.** Findings against deferred features are out of scope for approval; findings against the shipped core remain fully in scope. Per the packet-completeness rule, include this ruling verbatim in the round-6 packet — reviewers cannot read repo files.
- Per the standing rule, this ruling **narrows scope; it does not terminate the loop.** Dual review continues on the narrowed draft until quorum or explicit human stop. Approval is judged against the original mandate — matching quality, determinism, auditability, proportionality — which the narrowed draft now actually matches.
