# Per-item ledger: design-gate citation grounding lineage

**Thread:** `design-gate-citation-grounding-2026-08-23`  
**Lineage covered:** round 30 onward  
**Created:** 2026-08-25  
**Status:** living document; update in place

## Purpose

This ledger rates individual technical items and claims independently of the
aggregate confidence or disposition of the round bundle in which they appeared.
It implements the owner's 2026-08-25 process correction: retain useful
item-level evidence even when a bundle is rejected, and do not treat a bundle's
verdict as the status of every sub-claim.

Commit `d62c4df` contains the refined interaction-risk batching rule in
`plugins/kstack/skills/kstack-design/SKILL.md`. Accordingly, a remedy that
reviewers liked only inside an overloaded round remains `OPEN-UNTESTED` unless
the evidence isolates it well enough to attribute the result. This ledger
complements, and does not replace, any whole-mechanism rejected-options ledger
for this thread.

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
| Advisory packet-bound anchor existence, never semantic proof or blocking behavior | `VALIDATED` | The round-5 ruling fixes the v1 scope at packet serialization, anchor checking, telemetry, smoke, operator shadow, and one legacy recovery. Both round-34 reports left that boundary intact; current HEAD contains the packet and overlay modules. | Nothing further for this scope claim; retain the ruled re-entry gate for any future blocking behavior. |
| Exact local-instance path, ancestry, ownership, 0700/0600 modes, single-link file, and held-fd identity | `VALIDATED` | Round-34 Codex called these protections strong. Opus accepted these subparts and confined its custody objections to type authority and procfs governance. Current HEAD preserves the accepted subparts. | Nothing further for these subclaims; do not extend this row to type authority, procfs governance, `noexec`, volatility, or memory cleansing. |
| One authoritative authenticated exhaustion predicate with fixed 14-day freshness and an eligible exact boundary | `OPEN-CONFIRMED-BUG` | Round 35 isolated digest `f595927e81e412e28f24469d7dc694eb0dd701409eb149ed047ef24802cab0eb`: both accepted the four-leg core, combined 79. Rounds 36/37 regressed to 68/72. Round 38 cumulative digest `daec012d0192f52d69fac0ec9194bf266c4d04a515596c637bbb24f88fad8711` regressed further: Codex 61, Opus 77, combined 61. Both still retained the predicate direction and deterministic absence, but rejected claims that the surrounding input/publication/failure/reset contract is closed. Gate `BLOCKED`; rejected-option 3 controls. | Keep only the round-35 core and cumulative-document method, not round-38 text/confidence. Any future owner-authorized attempt needs rejected-option 3's closures under a new digest. |
| Replay and cheaper authenticated-absence/reset paths can clear the three-start restraint | `OPEN-CONFIRMED-BUG` | Round 37's four classes passed item review but remained below 79. Round 38 called them exhaustive; Codex F6/SEC-R38-3 and Opus SEC-7 found additional authenticated predicate-false replays (pass, fingerprint mismatch, expired count-three), forward skew, and key regeneration. Primary inspection confirms the broader mechanisms. Combined 61 rejects the taxonomy. | Replace exhaustive “four paths” wording with classes covering every authenticated predicate-false replay, absence/deletion/malformed reset, clock movement, and instance-key rotation; retain unbounded aggregate-cost consequence. |
| Local-clock forward skew can end the exhaustion lease early | `OPEN-CONFIRMED-BUG` | Round 35 found undisclosed forward skew and adjacent-field future-time malformedness. Round 37 named process wall clock, forward early expiry, both backward-skew cases, wait-first recovery, and reset consequence. Codex nevertheless found coercible non-time values contradict the closed input contract; Opus found non-state invalid inputs lack a usable remedy. Combined confidence 72 rejects the packet. | A future fresh packet must use a non-coercing Date-or-primitive-number validator, preserve wait-first recovery, and give every non-state invalid input a distinct or explicit remedy. |
| Exhaustion operator result must be one bare or reason/detail wire contract | `OPEN-CONFIRMED-BUG` | Round 36 mixed two contracts. Round 37's dedicated preflight found the bare `SMOKE_ATTEMPTS_EXHAUSTED` code in all ten required sections, no forbidden parent/detail representation, and no exhaustion entry in the proposed ordinary vocabulary. Opus explicitly accepted consistency across objective, runtime, mapping, command, smoke, remedy, and fixtures. Round 37 still regressed below 79 because adjacent command scope and token-definition gaps made F4 fail overall, so the row cannot be marked validated. | Retain the bare code in a fresh packet, preserve the current shared admin catch, prove smoke errors have no detail, define the disjoint ordinary run-limit token, and add a no-ordinary-producer check. |
| Fingerprint equality has a primitive-string type contract before strict comparison | `OPEN-CONFIRMED-BUG` | Round-36 Opus found the missing primitive contract. Round 37 bound both values to primitive lowercase-hex strings before `===`, but Opus found an invalid freshly recomputed value shares `STATE_MALFORMED` with stored-state errors and has no usable remedy. Combined confidence 72 rejects this attempt. | A fresh packet must retain both primitive contracts and route an impossible current-fingerprint value to an explicit internal/platform remedy without telling operators to reset a valid state file. |
| Authenticated-absence generation-1 successor behavior against higher stored generation | `OPEN-UNTESTED` | Round 37 explicitly specified that, under the coordinator lock, generation 1 replaces higher unauthenticated bytes with no compare-and-swap against their untrusted generation. Both reviewers marked deterministic absence F2 PASS, but round combined confidence 72 is below the ledger high-water mark. Adjacent authenticated maximum-generation behavior also contradicted the table. | Preserve intentional generation-1 replacement in a fresh packet and separately define one saturated authenticated-generation increment used by code, prose, and fixtures. |
| Non-coercing smoke current-time input contract | `OPEN-CONFIRMED-BUG` | Round-37 found coercible types. Round 38 excluded them, but Codex F1 found finite numbers still include values outside ECMAScript's writable Date range and fractional milliseconds lacked canonicalization. Combined 61 rejects the attempted closure. Round 39 isolated exactly this item as `CG-TIMECLIP-001` (digest `601991cfdd2608e6dcb01d770a859f3246588991409912a86eca7074aa351382`) with a complete TimeClip-range rule, five ordered rejection cases, and one shared `STATE_MALFORMED` code; Codex 35 found the Date-path premise false under an overridden `getTime` (medium security finding) plus an unreachable explicit-`undefined` requirement contradicting the retained default parameter, while Opus 84 treated the same Date-path claim as correct by construction and did not flag the override — a genuine unresolved factual disagreement between reviewers, not mere scope incompleteness. Combined 35 rejects this attempt; rejected-option 4 controls. Fable arbitrated (ruling: overridable-`getTime` bypass in scope; fix is `Date.prototype.getTime.call(now)` in try/catch with no `instanceof`, unified check chain on the extracted value, `now` required with no default). Round 40 (digest `d969321b588c8766e0f3eca8dd5d86d7ce6d3f0f8dc04fe6e6565216e9e3abc4`) inlined that ruling text verbatim, but Codex 24 and Opus 66 (combined 24, new thread-low) independently converged on the same defect: the ruling's own inlined signature line `canonicalExhaustionPredicate(state, now)` drops `currentFingerprint`, which policy leg (1) depends on and which the same brief's round-35 core (arity 3) still requires — a high-severity fail-open risk if implemented literally (`CG40-SIG-ARITY-FAILOPEN`). Both reviewers also independently found the adversarial-subclass validation fixture self-contradictory (it demands rejecting a genuine subclass instance's valid true `[[DateValue]]`, which the brand check correctly admits). This is agreement between reviewers, not disagreement, and a defect in the ruling text itself rather than in either round's interpretation. Rejected-option 5 controls. Round 41 (digest `2c17f36434c0fe6ee1e450ebf93f11160b981ddcea2cde1a6d6dfd44bce5df79`) applied entry 5's full four-point remediation (corrected arity-3 signature, two non-contradictory Case A/Case B fixtures, a call-site inventory, a separately-labeled verbatim-ruling block) and produced a large recovery — Codex 24→68, Opus 66→87, combined 68 — with both reviewers now affirming the corrected rule's substance: neither disputes the signature correction's fidelity, neither finds the round-40 fail-open regression recurs, and neither finds a new bypass in the brand-check chain itself. The remaining gap is narrower and different in kind: Codex (revise, 68) found the "verbatim" block's Signature line bundles the disclosed correction with an explanatory clause (not a pure one-word substitution as claimed), the rejection-case table omits a local restatement that it applies only after the existing authenticated-record short-circuit, a missing cross-realm-Date fixture, and missing embedded test-suite/secret-scan results. Opus (approve, 87) independently corroborated only the call-site inventory's grep-scope limitation (`--include="*.mjs"` narrower than its stated conclusion) and flagged a Case-B fixture-wording imprecision, treating all remaining items as pre-implementation verification needs rather than blocking defects, with zero material dissent. Combined 68 remains 11 below the 79 floor; rejected-option 6 controls. Round 42 (digest `4e1d9c109e9f49ae29e2008f98ad78d20bd37db06e057b7b30e8d5c36592ed64`) applied entry 6's full six-point remediation (verbatim-block restructured into a reproduced original plus a pure one-line-substitution corrected block; a local short-circuit qualifier on the rejection-case table; a cross-realm-Date fixture verified by direct execution; actual test-suite and secret-scan results carried forward, not merely described; a widened, extension-unrestricted call-site search with dynamic-access and manifest checks; and a rewritten, NaN-source Case B asserting only the outcome) and, for the first time since round 35, cleared both confidence bars: Codex 68→84 (`revise`), Opus 87→85 (`approve`), combined 84 — 5 above the 79 floor and 3 above the round-11+ target of 81. Both reviewers affirmed the design's substance in full (Opus's recommendation confirms all six reviewer confirmation points satisfied; zero material dissent from either reviewer), but the gate still returned `BLOCKED`: Codex's decision remained `revise` (not `approve`) over one now-resolved packaging item (this round's own generated artifacts hadn't been secret-scanned yet at review time — resolved post-hoc, clean) and one genuine documentation-precision defect (the brief's own deterministic-check wording requiring `instanceof Date` "absent from the rule text entirely" is self-contradictory, since the corrected normative block necessarily names that expression when prohibiting it); Opus reported one low-severity, explicitly self-described "residual, explicitly-deferred" security finding (`CG42-SIBLING-COERCION-RESIDUAL`) about an already-out-of-scope sibling function, which nonetheless trips the gate's zero-severity-threshold security-findings requirement; and both reviewers recorded narrow, purely evidentiary unresolved questions. Gate `BLOCKED` on `REVIEW_NOT_APPROVED`, `REVIEW_FAILED_CHECKS`, two `UNRESOLVED_QUESTIONS` reasons, `SECURITY_FINDINGS`, and one failed deterministic check (`objectives-complete`; the other five required checks — `design-schema-valid`, `threat-model-complete`, `rollback-defined`, `verification-plan-complete`, `artifact-secret-scan` — all passed). Rejected-option 7 controls; this is the closest this item has come to `READY_FOR_USER_APPROVAL` across seven attempts. Round 43 (digest `91abd476100a3bda9ba5fb9742382c9547f91416d3fe438526c45190fa417e95`) applied entry 7's exact three-point closing remediation (reworded the self-contradictory `objectives-complete` bullet; disposed of `CG42-SIBLING-COERCION-RESIDUAL` as an explicitly scoped-out, tracked residual rather than a one-line fold-in, naming candidate future item `CG-TIMECLIP-002`; and closed all six of round 42's unresolved questions with real, executed evidence — a `nextSmokeCycleCountersV1` call-site grep and declared signature, a `.kstack`-unexcluded bare-identifier grep, a byte-for-byte diff plus matching SHA-256 of the packet's reproduced ruling text against the actual external `fable.md`, and a precise, corrected two-part construction method for the lower-TimeClip-boundary fixture, established by direct execution to require reframing round 42's plan because the state module's own four-digit-year `TIMESTAMP` regex makes the earliest structurally valid persisted timestamp unconditionally greater than the true TimeClip lower bound) — but combined confidence **regressed**: Codex 84→76 (`revise`), Opus 85→85 (`approve`, substance re-verified with zero regressions, zero security findings under the reviewer instruction not to re-enter the disclosed sibling residual). The regression is fully attributable to three new packaging defects Codex found in this round's own drafting, not to round 42's carried-forward substance: a literal tension between the reworded bullet's new "no stale restatement" clause and the packet's own deliberate retention of the superseded arity-2 ruling text for comparison (independently corroborated by Opus as a non-blocking editorial note); the widened `nextSmokeCycleCountersV1` grep's shown output omitting the `.kstack` prose matches the surrounding text describes; and the O3 byte-for-byte diff comparing `fable.md` against round 42's decision-brief.md rather than round 43's own copy of the same block. Gate `BLOCKED` on `REVIEW_NOT_APPROVED`, `CONFIDENCE_BELOW_THRESHOLD` (76<80), `REVIEW_FAILED_CHECKS`, `UNRESOLVED_QUESTIONS`, and two failed checks (`objectives-complete`, `verification-plan-complete`). Rejected-option 8 controls; per this thread's confidence-regression discipline, round 43 is rejected outright and a future attempt should resume from round 42's packet, not round 43's. | Per rejected-option 8: a future owner-authorized attempt should start from round 42's packet (design digest `4e1d9c109e9f49ae29e2008f98ad78d20bd37db06e057b7b30e8d5c36592ed64`), not round 43's, and apply only the three still-needed, mechanically fixable, reviewer-agreed corrections: (1) qualify the `objectives-complete` bullet's "no stale or duplicated restatement" clause to explicitly exempt the labeled "Original ruling text, unedited" comparison reproduction; (2) paste the complete, unabridged `nextSmokeCycleCountersV1` bare-identifier grep output, including its `.kstack` prose matches, rather than describing them; and (3) re-run the O3 byte-for-byte diff/SHA-256 comparison directly against that future round's own copy of the reproduced ruling-text block, showing fresh command output naming the correct round's file. Round 43's residual-finding disposition (Closing fix 2, `CG-TIMECLIP-002` tracking) and its O1/O2/O4 evidentiary substance were not faulted by either reviewer and should be carried forward unchanged. |
| Round-44 `CG-TIMECLIP-001` caller-evidence and time-trust claims | `REJECTED` | Round 44 digest `e72836ae2909da566433747e8348f0cda85ef81211537c7e18ce8aa71d54f186`: Codex 74 and Opus 76 (combined 74), both `revise`. Both found the call-site inventory audited `nextSmokeCycleCountersV1` rather than the changed `canonicalExhaustionPredicate`. Opus additionally established that range/brand validation does not authenticate a truthful current instant, removing the predicate default is a caller-visible contract break, the proposed lower-bound helper/seam was unauthorized or ambiguous, actual suite output was absent, and the applied rule/arity authority was incompletely bound. Gate `BLOCKED`; rejected-option 9 controls. | Round 45 must apply rejected-option 9's exact evidence/trust-boundary closures without changing the round-42 brand-read/check-chain mechanism. |
| Round-45 `CG-TIMECLIP-001` arity-3 brand-read and TimeClip admission design | `VALIDATED` | Round 45 digest `16741fadff9ee020c346d4def2c50bce093a0cf44772b403d840527367681bd0`: Codex `approve` 91 and Opus `approve` 88, combined 88; both explicitly record `CG-TIMECLIP-001: PASS`, with zero failed checks, security findings, or material dissent. All six deterministic checks pass. Primary source resolves Opus's sole factual question: the unchanged persisted-time `> nowMs` check necessarily throws `STATE_MALFORMED` for the lower TimeClip boundary before lease evaluation. This item-level validation is subordinate to the whole-round gate, which remains `BLOCKED` because Opus's structured unresolved-question array is non-empty. Rejected-option 10 controls the gate state. | Preserve this exact design and evidence. Do not implement while the gate is blocked. A future owner-authorized review, if any, needs only carry the primary forward-skew source evidence so the structured unresolved-question field can be empty; no mechanism change is indicated. |
| Round-46 primary proof that the lower TimeClip boundary reaches the unchanged forward-skew throw | `OPEN-UNTESTED` | Draft digest `9abe4b9cffd2e9b2d516402a905886b5ffdc5e1d27158d717c57261006690792` isolates only Opus's round-45 unresolved factual question. It carries the timestamp grammar/non-0000 rule, mandatory structurally valid `smoke.startedAt`, executed comparison (`-62135596800000 > -8640000000000000`), and the exact persisted-time `> nowMs` throw ordering before result/lease evaluation. No round-45 normative mechanism changes. The draft passed the repository outbound-secret matcher but has not been externally reviewed or gated. | Dispatch exactly this frozen brief to independent Codex and Opus under the owner's consolidated export approval; then attribute only `CG-TIMECLIP-001-LOWER-BOUND-EVIDENCE` and run the round-46 gate. Do not infer validation from the draft or this ledger row. |
| Saturated state-generation behavior is identical in code, tables, and fixtures | `OPEN-CONFIRMED-BUG` | Round-37 Codex F4 found code saturates at `Number.MAX_SAFE_INTEGER` while prose and fixtures require stored generation plus one. Primary inspection confirms the v2 schema admits the maximum and current writers saturate. | Define one `nextStateGenerationV1` saturating rule and use it verbatim in start, completion, result tables, and maximum-value fixtures. |
| Packet inlines the outer v2 schema and complete smoke start/completion state machine | `OPEN-CONFIRMED-BUG` | Round 38 inlined the stored schema/parser and successful terminal branch, but both reviewers still failed F3/F5: fresh start field sources, instance-key/fingerprint/fixture/binding construction, existing mutation, ordinary qualification, provider/summary/clock/I/O/supersession failures, and exact outputs remained absent. Primary inspection confirms current fresh context fields and current mutation clobber. | A future new digest must define all construction sources, strict ordinary predicate, existing-mutation refusal, and every start/provider/completion failure transition before claiming closure. |
| Authenticated record projection cannot be mutated after verification | `OPEN-CONFIRMED-BUG` | Round-37 found the shallow wrapper bug. Round 38's private WeakMap plus clone-on-projection was accepted by both reviewers, but the bundle's combined 61 is below the 79 item-validation high-water mark. | Preserve clone-on-projection unchanged in any new digest and seek item-specific confidence at or above 79. |
| Crashed third `not_run` attempt has an explicit recovery/acceptance contract | `OPEN-CONFIRMED-BUG` | Round-37 Opus SEC-3 confirmed that start publication precedes providers and a count-three `not_run` record is exhausting for 14 days, so a killed third attempt can create that refusal without completion. The packet omitted the case. | A fresh packet must either accept the fixed 14-day crash refusal with remedy and fixture or specify a separately reviewed stale-in-progress recovery rule. |
| Smoke count and attempt ordinal equality is schema-enforced | `OPEN-CONFIRMED-BUG` | Round 38 defined non-pass equality and pass count 0 with retained audit ordinal; both reviewers called those invariants sound. Combined 61 is below the item high-water mark, so the closure is not validated. | Preserve this exact result-specific invariant and add valid/mismatch/pass fixtures in a future new digest. |
| Smoke bare-code routing preserves other admin details and is disjoint from ordinary run-limit output | `OPEN-CONFIRMED-BUG` | Round 38 preserved admin details and defined the disjoint run limit/no-producer scan, which reviewers accepted for the two selected codes. Both failed F4 because smoke lock/platform and post-provider mismatch/re-authentication/persistence exits lacked exact token/detail/exit contracts. | Keep the two bare selected codes and shared catch, then define every other smoke exit without conflating it with ordinary formatting. |
| Numeric smoke time is canonically writable and deterministic | `OPEN-CONFIRMED-BUG` | Round-38 Codex F1 found primitive finite numbers include `1e300` and fractional values even though publication calls Date canonicalization. Current `nowIso` can throw outside the specified bare result. Round 39's `CG-TIMECLIP-001` attempt scoped only `canonicalExhaustionPredicate`'s `now` handling in `kstack-citation-state.mjs`, explicitly leaving `nowIso()` in `kstack-citation-runtime.mjs` (and `nextSmokeCycleCountersV1`/`stageOneAdvisoryPrefilterV1`'s own `now` coercion) untouched and unreviewed; that attempt itself regressed to combined 35 on a Date-path defect unrelated to `nowIso`. Round 42's Opus review corroborated this row's `nextSmokeCycleCountersV1` component directly and concretely (`CG42-SIBLING-COERCION-RESIDUAL`, low severity): confirmed by direct code inspection that `nextSmokeCycleCountersV1`'s own `Number(now) >= timestamp(anchor) + EXHAUSTION_LEASE_MS` comparison has no brand check, no integer check, and no range check, unlike the hardened leg `CG-TIMECLIP-001` gives `canonicalExhaustionPredicate` on the same call path. Round 43's Opus review sharpened this further: a genuine `Date` with an overridden `valueOf`/`Symbol.toPrimitive` passes `CG-TIMECLIP-001`'s corrected brand-check chain by design (the internal-slot read is unaffected by such an override), can return `false` on the predicate's lease leg, and control then reaches `nextSmokeCycleCountersV1`'s unguarded `Number(now)`, where the override can force `newCycle` true and reset the smoke-attempt counter — reachable only because `now` is not attacker-influenced on the current production path (it originates from `runCitationSmokeV1`'s own `new Date()` default), a trust boundary neither the round-42 nor round-43 brief states explicitly. | This row's `nowIso`/publication-path scope remains fully open and was not addressed or isolated by round 39, 42, or 43. Candidate future item ID: `CG-TIMECLIP-002` — a dedicated, independently-reviewed brief to harden `nextSmokeCycleCountersV1`'s own `now` coercion (and, separately, `stageOneAdvisoryPrefilterV1`'s and `nowIso()`'s) using the same brand-check-and-range-chain pattern `CG-TIMECLIP-001` establishes, once `CG-TIMECLIP-001` itself is implemented and closed. Per Opus's round-43 strongestObjection, sequence `CG-TIMECLIP-002` immediately after `CG-TIMECLIP-001` rather than leaving it open-ended, and have that brief state the current production trust boundary (non-attacker-controlled `now`) explicitly rather than leaving it implicit. |
| Smoke start uses fresh security fields on absence/mismatch and preserves only verified live fields | `OPEN-CONFIRMED-BUG` | Round-38 Opus F5 found field sources unstated. Primary source writes current context fingerprint, receipt binding, and instance binding on every start, including absence/mismatch; the packet did not make that normative. | Define fresh-versus-preserved fields for every successor row and verify stale raw fields can never enter a signed new cycle. |
| Existing mutation and superseded smoke completion have a closed contract | `OPEN-CONFIRMED-BUG` | Round-38 Opus F4/F5 found start behavior undefined. Current smoke start overwrites an existing marker; later completion returns `STATE_NOT_QUALIFIED MUTATION_IN_PROGRESS`. | Select refusal/wait/clobber explicitly (refusal preferred), define exact output/effects for old completion, and test smoke/shadow interleavings. |
| Instance-key custody and exact authentication transcript support non-forgery claims | `OPEN-CONFIRMED-BUG` | Round-38 Codex SEC-R38-1 and Opus SEC-5 found packet custody absent. Primary source stores the 16-byte key outside the repo under validated 0700 ancestry and user-owned 0600 single-link file; regeneration stales qualifications, but packet-only non-forgery was unsupported. | Inline custody, provisioning, rotation/recovery, key/message HMAC roles, and the exact actor assumption; scope non-forgery to it. |
| Mutation ID is CSPRNG-generated with collision/anti-reuse semantics | `OPEN-CONFIRMED-BUG` | Round-38 Codex SEC-R38-2 found “fresh hex-32” insufficient. Current source uses `crypto.randomBytes(16)`, but uniqueness scope/collision handling was omitted. | Require 128-bit CSPRNG output, define collision scope and refusal/retry behavior, and test stale-completion collision handling. |
| Every smoke provider/completion/persistence failure has exact state and output | `OPEN-CONFIRMED-BUG` | Round-38 Codex F4/F5 and Opus F4 found provider failure, invalid summaries, clock failure, missing/MAC/binding reread, mutation mismatch, lock/platform errors, I/O, and terminal failures undefined. | Provide a total transition/output table including whether third-start `not_run` remains and whether provider action makes the result ambiguous. |
| Atomic state replacement distinguishes pre-rename and post-rename durability failure | `OPEN-CONFIRMED-BUG` | Round-38 Codex F4 found rename may succeed before directory flush/readback fails; Opus asked about abandoned temporaries. Current writer can leave new visible bytes while reporting error and has no specified pre-rename cleanup. | Define authoritative state/result at each write phase, ambiguous completion/retry rules, and bounded safe temporary cleanup. |
| Ordinary qualification predicate is inline with smoke reset effects | `OPEN-CONFIRMED-BUG` | Round-38 Opus F3/SEC-6 found the packet omitted qualification. Primary source strictly requires null mutation, smoke pass, shadow go, unexpired timestamps, and count below 50, so smoke's shadow reset deactivates advisory and count 50 is refused before increment. | Inline the full predicate and prove smoke start cannot use its ordinary counter reset to retain qualification. |
| Descriptor-bound instance-store filesystem-type classification | `OPEN-CONFIRMED-BUG` | Round-34 Opus found pathname sampling still authoritative. Current HEAD now derives this type from the held ancestor descriptor and retains pathname sampling only for redundant `/proc` observation; tests observe the split. | Review separately, or pair only with procfs governance if a future brief proves the two are one inseparable custody mechanism. |
| Post-addon instance-store procfs profile and exhaustive exception numbering | `OPEN-CONFIRMED-BUG` | Both round-34 reviewers found the post-addon procfs reads unassigned; Opus also found second-versus-third wording. Current HEAD declares a fourth profile and implements bounded reconciled reads, but that candidate has no isolated review. | Review its current-PID confinement, no-follow identity checks, byte-stable re-reads, procfs cross-check, mode-check exclusion, and ordinal consistency. |
| Total ordinary-advisory diagnostic composition | `OPEN-CONFIRMED-BUG` | Round-34 Opus found missing compositions for malformed state and unavailable local-instance storage. Current HEAD's formatter and tests cover all six top-level outcomes and both missing cells. | Isolate the closed line grammar, routing consequence, and exhaustive outcome/detail vectors. |
| Authentication-failure signal excludes the unauthenticated stage-one rejection path | `OPEN-CONFIRMED-BUG` | Round-34 Opus found the signal claim overstated because stage one performs no authentication check. Current HEAD returns explicit zero authentication telemetry there and tests that behavior. | Review the narrow claim: full readers signal authentication failure without cause attribution; early rejection supplies neither signal. |
| Ignore `noexec` for the data-only local-instance role | `OPEN-CONFIRMED-BUG` | Round-34 Opus found that refusal on a hardened `noexec` home adds availability harm without protecting a 16-byte data file. Current HEAD records `noexecIgnoredForDataRole: true` and retains the other custody checks. | Review separately from executable and cache policy, with positive hardened-home and unchanged negative-custody fixtures. |
| Owned raw and derived authentication buffers are cleansed with explicit internal-copy limits | `OPEN-CONFIRMED-BUG` | Round-34 Opus found the derived buffer and inaccessible runtime/crypto copies under-specified. Current HEAD cleanses owned raw and derived buffers in `finally` paths and tests success and failure, while making no internal-copy guarantee. | Review the owned-buffer guarantee and named runtime/crypto residual; do not claim process-memory erasure. |
| Volatile `linux-tmpfs` or `linux-overlay` local-instance storage can force requalification after restart | `OPEN-UNTESTED` | Round-34 Opus raised this operational consequence because both types are admitted hard candidates. Current HEAD still admits them; no accepted disposition was found. | Decide whether to disclose and accept volatility or narrow the admissible type set; keep this separate from `noexec`. |
| Smoke-budget reset after deletion of the single best-effort state file | `VALIDATED` | Round-34 Opus explicitly concurred with the disclosed consequence and its consistency with the binding single-file ruling. Codex also accepted that deletion can reset cost accounting but cannot forge qualification. | Preserve the uncapped cost/churn disclosure and do not add a second persistent budget authority. |
| Malformed state plus unavailable local-instance storage maps to platform-precondition failure | `VALIDATED` | Round-34 Opus explicitly concurred that this cell was consistent across precedence, reads, mapping, and fixtures; Codex reported no conflict. | Nothing further for this exact precedence cell. |
| `localGateInstanceId` is authentication material, not merely anti-portability metadata | `VALIDATED` | Round-34 Opus explicitly concurred that the stale role contradiction was gone; Codex reported no conflict. | Nothing further for the role classification; custody and memory-lifetime claims remain separate rows. |
| In-memory-only `build-failed` and `status-store` relation is covered and non-serializable | `VALIDATED` | Round-34 Opus explicitly concurred that this relation had acceptance coverage and a non-serializability assertion; Codex reported no conflict. | Nothing further for this exact coverage classification. |
| Stage-one canonical candidate can force bounded native work but cannot enable or mutate | `VALIDATED` | Round 34 disclosed this availability/cost effect. Codex accepted the scope, and Opus's separate objection concerned missing early authentication signaling rather than authorization. | Preserve this classification and keep the early no-signal limitation visible in its own row. |

## Source basis

The initial objective was verified in the original self-contained brief at
`.kstack/reviews/design-gate-citation-grounding-2026-08-23/brief.md`. No
citation-named objective file or locked round-one clarification record exists
under `.kstack/objectives/` or `.kstack/decisions/` at current HEAD. The binding
scope and state-machine decisions were checked against:

- `.kstack/decisions/fable-arbitration-citation-grounding-round5-2026-08-23.md`
- `.kstack/decisions/fable-arbitration-entry-gate-state-round14-2026-08-23.md`
- `.kstack/decisions/fable-arbitration-write-gating-requalification-round17-2026-08-23.md`

The lineage was verified against both structured reports in rounds 30-34 and
the round-34 draft. Current implementation reality was checked in the five
owner-named citation modules and `tests/citation-grounding.test.mjs`; all 14
citation tests passed on 2026-08-25. Passing implementation tests are candidate
evidence, not a substitute for item-specific independent design review.

Round 35 is recorded in
`.kstack/reviews/design-gate-citation-grounding-2026-08-23-round35/`; its
manifest, both reports, synthesis, deterministic checks, and gate are bound to
design digest `f595927e81e412e28f24469d7dc694eb0dd701409eb149ed047ef24802cab0eb`.

Round 36 is recorded in
`.kstack/reviews/design-gate-citation-grounding-2026-08-23-round36/`; its
dual-complete manifest, both reports, synthesis, deterministic checks, and
`BLOCKED` gate are bound to design digest
`79c9a3644e53559bc13d611b44dc41746238bf305c7c5093e41ecd832d0961b5`.
Combined confidence 68 regressed below round 35's 79, so
`.kstack/decisions/design-gate-citation-grounding-2026-08-23-rejected-options.md`
is controlling for the exact rejected option and its non-authoritative future
alternative.

Round 37 is recorded in
`.kstack/reviews/design-gate-citation-grounding-2026-08-23-round37/`; its
dual-complete manifest, both reports, synthesis, deterministic checks, and
`BLOCKED` gate are bound to design digest
`322403db104170c73086d24e87c622a4f657736f71d81d712aea81ca539bdd01`.
Codex 72 and Opus 73 produce combined confidence 72, below round 35's 79
baseline. Rejected-option 2 controls the exact rejected packet and its fresh,
unreviewed alternative. Round-37 F2/F6 agreement remains item evidence only and
does not authorize whole-design acceptance or a carry-forward packet.

Round 38 is recorded in
`.kstack/reviews/design-gate-citation-grounding-2026-08-23-round38/` at digest
`daec012d0192f52d69fac0ec9194bf266c4d04a515596c637bbb24f88fad8711`.
Its manifest is dual-complete; Codex 61 and Opus 77 produce combined 61. Gate
status is `BLOCKED` with six security findings, four genuine material-dissent
entries, and failed objective, threat-model, and verification checks.
Rejected-option 3 controls. Useful acceptance of absence, saturation,
clone-on-projection, and result-specific count/ordinal invariants is below the
79 item-validation high-water mark and changes no row to `VALIDATED`.

Round 39 is recorded in
`.kstack/reviews/design-gate-citation-grounding-2026-08-23-round39/` at digest
`601991cfdd2608e6dcb01d770a859f3246588991409912a86eca7074aa351382`. Its
manifest is dual-complete; Codex 35 and Opus 84 produce combined 35 — the
thread's lowest single-reviewer confidence to date. Gate status is `BLOCKED`
with three failed checks (`objectives-complete`, `threat-model-complete`,
`verification-plan-complete`), three security findings (one medium, two low),
and two material-dissent entries. Unlike rounds 36-38, the round-39 brief
selected exactly one item (`CG-TIMECLIP-001`) and its in-scope/deferred table
held: neither reviewer assigned any part of the outcome to a deferred item.
Instead, the single selected item itself contained an unaddressed Date-path
validation bypass (Codex) and an unproven compatibility-narrowing claim
(Opus), and the two reviewers gave directly contradictory answers on whether a
native `Date`'s `getTime()` can ever return an out-of-range/fractional value
under an overridden `getTime` — resolved in the round-39 synthesis as a
genuine unstated-scope gap in the brief, not an error by either reviewer.
Rejected-option 4 controls the exact rejected packet and its alternative.

Round 40 is recorded in
`.kstack/reviews/design-gate-citation-grounding-2026-08-23-round40/` at digest
`d969321b588c8766e0f3eca8dd5d86d7ce6d3f0f8dc04fe6e6565216e9e3abc4`. Its
manifest is dual-complete; Codex 24 and Opus 66 produce combined 24, the
thread's lowest combined confidence to date. Gate status is `BLOCKED` with
three failed checks (`objectives-complete`, `threat-model-complete`,
`verification-plan-complete`), four security findings (two high, two low),
and four material-dissent entries. This round applied Fable's round-39
binding ruling verbatim, as directed, with no reinterpretation. Both
reviewers nonetheless converged — in agreement with each other, not in
disagreement — on a defect in the ruling's own inlined text: its normative
signature line omits `currentFingerprint`, contradicting the same brief's
unchanged round-35 core and current HEAD, with a high-severity fail-open
consequence if implemented literally. Both also independently found the
validation plan's adversarial-subclass fixture self-contradictory. Per the
round-40 dispatch instructions, this is flagged explicitly to the
facilitator: implementing the binding Fable ruling verbatim also failed, for
a reason unrelated to Codex/Opus disagreement, indicating `CG-TIMECLIP-001`
may need to be dropped from this thread's remaining scope and revisited
independently rather than continuing to consume rounds on it. Rejected-option
5 controls the exact rejected packet and its alternative.

Round 41 is recorded in
`.kstack/reviews/design-gate-citation-grounding-2026-08-23-round41/` at digest
`2c17f36434c0fe6ee1e450ebf93f11160b981ddcea2cde1a6d6dfd44bce5df79`. Its
manifest is dual-complete; Codex 68 (`revise`) and Opus 87 (`approve`)
produce combined 68 — a substantial recovery from round 40's thread-low 24,
but still 11 below round 35's 79 floor and 13 below the round-11+ threshold
of 81. Gate status is `BLOCKED` with two failed checks
(`objectives-complete`, `verification-plan-complete`; `threat-model-complete`
and `rollback-defined` passed), one low-severity security finding explicitly
characterized as deferred-scope residual risk, and two material dissent
entries, both from Codex and both packet-precision findings rather than
substantive challenges to the corrected rule. This round applied
rejected-option 5's full four-point remediation (corrected arity-3 signature,
two non-contradictory adversarial fixtures, a call-site inventory, a
separately-labeled verbatim-ruling block). Unlike round 40, both reviewers
affirmed the corrected rule's substance — the signature correction's
fidelity, the closure of the round-38/39 defects, and the absence of round
40's fail-open regression are all uncontested. The remaining gap is
packet-completeness in kind (an embedded explanatory clause inside the
"verbatim" block, an unqualified rejection-mapping statement, a missing
cross-realm-`Date` fixture, missing embedded test/scan results, and a
narrower-than-claimed call-site grep), not a substantive design defect.
Per the round-41 dispatch instructions, this is flagged explicitly to the
facilitator, paired with the qualitative distinction from round 40 above, for
a facilitator decision on whether to drop `CG-TIMECLIP-001` from this thread
or authorize one more narrowly-scoped corrective round. Rejected-option 6
controls the exact rejected packet and its alternative.
