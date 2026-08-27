# Fable arbitration ruling — reasoning-effort/agent-routing policy, round 9

**Trigger validity:** confirmed. Simultaneous confidence collapse from both reviewers (Codex 68→56→32, Opus 72→72→31), plus an identical capability class (result shopping) relocating across three consecutive rounds in independently confirmed new forms. This is a genuine substance-based trigger under the standing policy, not a round-count invocation.

## Ruling on Question 1 — this is a category error, not a patch target. Adopt option (b).

**The design must stop claiming shopping *prevention* against the coordinator and claim *attribution*.** The ledger and its supersede machinery are retained, but their stated invariant changes to exactly this:

> Selection is single-pathed for compliant coordinators, and every resample — compliant or not — leaves a mandatory, queryable evidence trail.

Reasoning. The defect has relocated three times because rounds 6–8 kept asserting a property the design's own threat model cannot support anywhere: this design uniformly assumes a cooperative single local account, concedes that a host can fabricate files, shell out directly (the round-19 incident), and defeat advisory modes on DrvFs, and claims "gate-time detectability and one easy compliant path, not prevention." The coordinator is that host's agent: it spawns the provider processes, so verdict bytes originate in processes it started and flow through a tree it owns. Option (a) — structurally denying pre-gate verdict visibility — would require a second trust domain (separate user, daemon, or broker process) that this process model does not have and that every other mechanism in the design declines to build. It is disproportionate machinery under the same reasoning as my citation-grounding round-14 ruling: a control's cost is judged against the design's stated threat model, not against a demand for cryptographic certainty the design provides nowhere else. And it would still be incomplete, because the coordinator can read provider stdout before any file exists.

Opus's structural diagnosis is correct and is hereby adopted as the design's stated position: *a control cannot be enforced against its own trusted writer by convention alone.* Both reviewers explicitly offered the reframing branch; this ruling takes it without hedging.

**Concrete rewrite directives:**

1. Every claim of the form "cannot shop," "closed," "single-shot," "another invocation over the same work is a closed duplicate" that is asserted *against the coordinator* is rewritten to the attribution form: duplicate detection and single-pathing are enforced against compliant coordinators and accidental/racing resamples; deliberate resampling by the coordinator is **attributable, logged, reviewable, and against policy** — not impossible.
2. Add to Known residual limitations, explicitly: *the coordinator is simultaneously the party with the resampling incentive and the designated exclusive writer of the anti-resampling evidence; the ledger therefore constrains it by attribution, not prevention.* This is the honest generalization of the existing file-fabrication residual, not a new concession.
3. The supersede chain is redefined as the **audit artifact**, not the prevention artifact. Requiring evidence does not make a resample illegitimate-in-fact; it makes it visible. Opus's "non-inducibility" objection is resolved by this reframing: inducibility is accepted and disclosed, because every induced supersede is a permanent, queryable record that the standard audit flags.

## Ruling on Question 2 — narrow `selectionKey` to subject-only inputs.

`selectionKey` must identify **the work under review**, never the caller's assertions about it. Governing principle (this also answers Opus's unresolved gitStateDigest/concurrency question): *a digest enters the selection key only when it identifies the subject artifact for that dispatch kind.*

- **In:** `selectionVersion`, `dispatchKind`, trusted `activeRole`, and the per-kind subject digests — `designDigest` for design-review; `gitStateDigest`/`planDigest` for code-review and QC (the diff *is* the subject there); `proposedPlanChangeDigest` for interrogation; plus a **dispatch-relevant projection** of the policy (the fields that actually affect this kind's routing and composition), not the whole-policy digest.
- **Out:** `riskSignalsSha256`, `riskEvidenceSha256`, `qcRiskSha256`, `riskFloorOverrideSha256` — all caller-assertable, all rotation vectors. They remain validated, remain in `bindingKey`, and are recorded in the terminal audit; they simply no longer mint namespaces. `gitStateDigest` is dropped from kinds where the git state is not the subject (design-review), which kills the empty-commit rotation vector.
- **Canonicalization:** every set-like array is sorted and deduplicated by a code-owned canonical order *before* JCS hashing. This closes Codex's `SEC-SELECTION-SEMANTIC-ALIAS` (RFC 8785 preserves array order; the design must not).

**Consequence, state it in the draft:** a qcRisk downgrade now lands in the *same* selection namespace as the rejected dual-QC run. The ledger sees the prior consumed generation and returns `DISPATCH_SET_SELECTION_DUPLICATE` — `SEC-QCRISK-LEDGER-BYPASS` closes structurally, not by audit query.

**Disclosed residuals:** (a) a substantive-looking cosmetic edit (whitespace reflow of the design) still mints a fresh namespace; content keying cannot distinguish substance from cosmetics. Accepted, disclosed, and covered by a new mandatory audit query for near-identical selection keys over the same subject, plus a supersede-chain-length query — add both to the standard query set. (b) Two genuinely parallel loops over a byte-identical subject are resampling *by definition*; the loser's `DISPATCH_SET_SELECTION_DUPLICATE` is correct behavior, disclosed as such, not a bug to engineer around.

## Ruling on Question 3 — proportionate tamper-evidence: a hash-chained index; no signing, no external anchor.

`SEC-LEDGER-DELETABLE` gets a minimal mechanism, not cryptographic infrastructure: ledger claim/supersede/terminal events additionally append to a **single append-only JSONL chain file** in which each record embeds the SHA-256 of the previous record. Gates and the standard audit verify chain contiguity; a truncated, gapped, or absent chain where ledger state exists is a named fail-closed result. **Retention/pruning is tied to the chain:** pruning is itself an evidenced, chain-recorded operation naming what was pruned and why — this simultaneously answers Opus's unbounded-growth question and prevents pruning from becoming a sanctioned shop reset.

What this buys: selective deletion of one inconvenient `<selectionKey>/` subtree — the actual attack, zero-skill and traceless today — becomes detectable. What it deliberately does not buy: a host deleting the *entire* chain plus ledger. That whole-state deletion is loud, binary, and belongs to the same cooperative-host residual tier as file fabrication; disclose it there. Signing keys, git-tracked mirrors with per-consumption commits, or external anchors are disproportionate under the round-14 standard — the design defends against accident, races, and *attributable* misbehavior, not against a local root adversary it never claims to resist.

## Ruling on Question 4 — the reframing is the class-killer; the recovery paths get the attributable fence, not the hard fence.

**On the recovery paths (SEC-PEEK-THEN-ABANDON), I am deliberately deviating from Opus's proposed hard fence, and here is the reconciliation.** Opus proposed requiring empty `members/` for every non-gate-published `FAILED_UNCONSUMED` terminal, accepting the liveness loss. I decline that specific mechanism for two reasons: first, a hard prevention fence is now inconsistent with a design that no longer claims prevention — the coordinator can still withhold publication entirely and read provider stdout, so the fence would be the *fourth* relocation surface, not a closure; second, it wedges the legitimate crash-after-members-complete-but-before-READY case permanently. Instead:

1. **Every supersede record over a generation whose `members/` tree (or attempts tree) contains any completed member or recorded provider output must carry `verdictBytesExisted: true` plus the enumerated member/output digests.** Empty-members supersedes are routine; verdict-existed supersedes are the audited exception, flagged by a mandatory standard audit query for human review.
2. **The flag is not trusted — the coordinator writes it and the coordinator is the interested party.** The audit *recomputes* it from the immutable no-replace `members/` tree; a contradiction between the flag and the recomputation is `DISPATCH_SET_SUPERSEDE_INVALID`. Deleting `members/` before superseding to falsify the recomputation is the same disclosed deletion residual as Q3, and the chain index covers the terminal that the deleted members belonged to. This is stated now so round 9 does not "discover" it.
3. **The zero-wait path closes: the recovery deadline applies uniformly to all non-gate-published recovery paths, including prompt expiry.** The coordinator deleting the prompt it custodians can no longer convert that into an instant supersede; it waits out `recoveryEligibleAt` like path 1. Resampling cost is thereby uniformly one bounded wait plus one permanent flagged audit record — which is the honest property, and now the *claimed* property.

**Why the class stops recurring.** Rounds 6–8 relocated because the invariant under review — "shopping is impossible" — is unachievable in this trust model, so every reviewer could always find the next instance. The reframed invariant — single-pathed for compliant coordinators, every resample leaves a mandatory trail — is achievable and *closed-form checkable*. Round-9 reviewers' verification questions change accordingly, and this is binding on how round 9 is scored:

- Do all claims now match the stated threat model (no residual "cannot"/"impossible" language against the coordinator)?
- Does every resample path — sanctioned recovery, selection-key rotation on a genuinely changed subject, whole-state deletion — leave the mandated trail or fall under a named, disclosed residual?
- Are the mechanical closure items below done?

A round-9+ finding of the form "the coordinator can still resample via X" where X is attributable-by-design and disclosed is a **confirmation of the residual, not a defect**, and must not be scored as one. Separately, Opus's two settled items are not to be reopened: Q4 signal-role scoping and the structural correctness of the `fs.link` no-replace primitive.

## Mechanical directives for round 9 (binding regardless of framing)

1. Add `recovery/` to the reserved-path list — as written, every recovered invocation fails its own uniqueness scan.
2. Publish the per-kind `selectionKey` and `bindingKey` field shapes as a normative table covering **all** gate-consumed kinds including code-review. This is the security-critical surface; it cannot remain "code-owned" prose.
3. Fix both code-review contradictions: `dispatchSet` mandatory for matrix-mode code-review including singletons, and correct the "required-only consumed sets … roles identical" sentence now that a preferred-legal row flows through the shared check.
4. Add closed result codes for: the decision-read-marker-without-terminal wedge; ledger corruption observed outside a supersede attempt; and post-probe store I/O failure (`ENOSPC`/`EIO`) — plus a code for rejected/premature recovery commands (Codex's finding).
5. Specify concrete `recoveryEligibleAt` and `abandonmentEligibleAt` values (or bounded ranges) — they set both the self-DoS window and the per-resample cost and are unreviewable as prose.
6. Fix the decision-read-marker ordering inconsistency: the marker must be published before the gate reads any member output bytes, which means the output-digest check moves after marker publication (or the marker's claimed property is weakened honestly).
7. Empirically verify `fs.link`/`O_EXCL` atomicity on `/mnt/e` DrvFs *before* round 9 commits to the primitive. If the probe fails — and independently, as the fix for `SEC-PROMPT-LOCAL-CONFIDENTIALITY` — evaluate relocating the prompt, manifest, and ledger stores to a code-owned Linux-side (mode-enforcing) state directory keyed by project identity. Scope note: this changes the repository-containment and `.gitignore`-hygiene rules for those paths and must be designed as such, not bolted on.
8. Specify exclusive *directory* creation (hard links don't apply to `<setId>/`, `members/`, generation dirs) and acknowledge the Linux-only directory-fsync limitation in the flush protocol.

That is the ruling. The ledger machinery survives; its claim changes; three mechanisms are added (subject-only key, hash-chained index, recomputed attributable-supersede flag) and none other — every additional mechanism is a fresh relocation surface for round 10.
