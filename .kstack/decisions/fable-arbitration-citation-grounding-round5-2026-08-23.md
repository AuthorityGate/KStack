# Fable arbitration ruling — citation-grounding design loop, round 5 scope fork

**Date:** 2026-08-23
**Arbiter:** Fable (claude-fable-5), invoked per the round-5 threshold rule
("bring Fable in once a loop passes round 5 without resolving")
**Question ruled on:** Has the design outgrown its mandate, and where is the v1 cut line?
**Full record:** `.kstack/reviews/design-gate-citation-grounding-2026-08-23-fable-round5/` (manifest + directive)

## Ruling: Option A, with two named amendments taken from C

Ship only the core mechanism the original objective asked for. Defer the entire promotion-to-`required` program behind an explicit, numerically gated future design session. The two amendments from C: (1) basic operator-visible telemetry counters ship in v1; (2) an informal, single-operator-honest pre-exposure shadow replaces the multi-rater masked shadow.

## Basis

The original objective asked for a **cheap deterministic pre-check** — "automated citation existence-checking... as a cheap deterministic pre-check" — and warned, in its own text, against "becoming a new bottleneck that makes the design loop slower than the problem it's solving is worth." The round-5 draft's promotion program (multi-rater blinded shadows, Cohen's kappa floors, Newcombe-Wilson/Clopper-Pearson gating, OS-specific break-glass ACL machinery, quarantine registries, dual-scanner reconciliation) is that bottleneck, arrived at honestly: four consecutive rounds show the program failing to close under its own terms, with each real fix generating new real gaps. That is not a quality problem with the drafter — it is the signature of a scope that cannot converge at proportionate cost.

Two independent confirmations that the cut line falls where I'm placing it:

- **Both reviewers' strongest round-5 objections attach to the promotion program, not the core.** Opus: the first increment "cannot be completed by the people who exist." Codex: the promotion statistics "can systematically favor promotion while retaining the language of 95% confidence." Meanwhile the core mechanism's hardest problem — wrapper/metadata anchor ineligibility — was **resolved this round** to both reviewers' satisfaction (independent verifier span derivation, credited by both as a genuine structural fix).
- **Opus's unresolved question #10 answers itself and is hereby closed:** the total human cost of the promotion program (60 rated pairs + 120+ audited items + guardrail strata + quarterly re-audits + 100% inspection queues) is not justified by the value of an anchor-existence control that, by the draft's own honest admission, proves neither entailment nor packet completeness. That asymmetry is this ruling's basis. The question does not resurface in round 6.

Option B is rejected on the mandate's face. Under single-operator reality, the multi-human protocols would be executed nominally — same person rating both arms, adjudicating labels — producing numbers that carry the notation of rigor with none of its meaning. Continuing to polish that program makes the unearned authority worse, not better.

## v1 scope (round 6 drafts to exactly this)

**Ships:**

1. **Canonical packet serialization and independent verifier span derivation** — canonicalization v1, `kstack-source-record-v1`, the collision-safe frame, and the round-5 verifier that derives all spans from its own parse. This is the deterministic core; it is retained as drafted.
2. **Grounding overlay on the base review** — the backward-compatible base/overlay split, `groundKind` self-declaration with the assertion-dominance boundary and worked examples, citation shape/bounds, `recommendationAnchorClass`, `anchor_verified` naming discipline.
3. **Advisory-only evaluation.** Two modes exist: `off` and `advisory`. The entire `required` column of the failure matrix, the strict-schema two-attempt/250ms retry policy, `CITATION_GROUNDING_FAILED` blocking semantics, and break-glass are **deleted from v1**, not deferred-in-place — they exist only to serve a mode that does not ship.
4. **No new durable-artifact machinery.** No cleanup registry, TTL/audit-hold system, atomic-commit/read-back apparatus, or quarantine sweeps. Evaluate in memory where the process boundary allows; otherwise evaluate against whatever packet artifact the existing flow already produces. The existing legacy secret scan continues to govern outbound content unchanged; the dual-scanner reconciliation system is deferred.
5. **Basic operator-visible telemetry** (amendment from C): citations emitted/verified/failed/redacted, declared-kind distribution, `wouldBlock` count, recovery-invocation count. Plain counts a single operator reads. No statistical gates, no confidence bounds, no promotion semantics.
6. **The exact-reproduction smoke test** — automated, cheap, single-operator-executable, and it de-risks the whole approach. Retained as the first increment's entry gate.
7. **An informal pre-exposure shadow** (amendment from C): ~5–10 dual runs read side-by-side by the operator, with a recorded go/no-go judgment before advisory prompting goes live. No blinding, no custodian, no kappa, no statistics — and the resulting claim is downgraded accordingly to "recorded operator judgment," per the standing instruction below.
8. **One-shot legacy recovery** for v2-attributable invocation failures is retained (the prompt change creates real availability risk), with two carried-forward round-5 findings that fall inside this scope: define late-v2-response fencing (Opus SEC-F) and mixed-arm dual-review semantics (one provider v2, one legacy). Also carry forward the honest-statement fix from SEC-C: state the delivered-bytes invariant's true endpoint (the adapter's last observable buffer) rather than claiming a wire-level guarantee.

**Deferred in entirety, as inputs filed to a future design session:** the multi-rater masked quality shadow, the blinded `groundKind` audit and kappa apparatus, break-glass, the cleanup/quarantine registry, dual-scanner reconciliation with acceptance workflow, all 14 promotion criteria, and every round-5 finding that attaches to any of these (Codex SEC-01–04 and its statistical findings; Opus SEC-A/B/D/E and its statistical findings). These are recorded as unresolved inputs to that session — they are **not** round-6 blockers.

## Standing instruction (resolves the staffing contradiction)

**No protocol in the shipped scope may assume more than one human operator. Any claim that depends on rater independence, blinding, custodianship, or inter-rater reliability is downgraded to recorded operator judgment.** This adopts the second branch of Opus's disjunction. The first branch (naming independent participants) becomes a hard prerequisite of the *future* session instead — see the re-entry gate.

## Re-entry gate for the deferred program

Mirroring the reflexion-retrieval precedent (concept-engine deferred behind a 50-lesson trigger): `required` mode and its promotion program reopen as a **separate design session** only when **(a)** ≥50 advisory runs of v1 telemetry exist, or one confirmed confabulated-citation catch occurs in production — whichever comes first — **and (b)** independent human participants for the measurement protocols are named, or the promotion evidence is redesigned to be single-operator-honest with correspondingly weakened claims. Until both hold, the deferred material is not draftable scope.

## Loop directive

This ruling does not terminate the loop — per standing project policy, design loops never auto-stop. Round 6 proceeds: the drafter produces the narrowed v1 draft (this is a **subtraction round**; the drafter cuts, and adds only the three carried-forward items in §8 above), and both reviewers review it **against the narrowed mandate stated here**, not against the round-5 surface. Round counting continues from 6; the xhigh reasoning-effort tier remains in force.
