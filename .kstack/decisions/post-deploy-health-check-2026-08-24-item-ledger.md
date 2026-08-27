# Per-item ledger: live post-deploy health check

**Thread:** `post-deploy-health-check-2026-08-24`  
**Lineage covered:** rounds 8–36
**Created:** 2026-08-25  
**Status:** living document; update in place

## Purpose

This ledger rates individual technical items and claims independently of the
aggregate confidence or disposition of the round bundle in which they appeared.
It applies the refined design-loop method validated on
`always-on-safety-hooks-2026-08-24`: retain useful item-level evidence even
when a bundle is blocked, and do not treat a bundle's verdict as the status of
every sub-claim.

Round 8 reviewed a cumulative composite at combined confidence 34. The
repository search required by the owner returned no implementation match for
`postDeploy`, `healthCheck`, or `health-check` in the KStack scripts or skills,
so this ledger describes a pure design gap rather than a partially implemented
mechanism. The incident priority is a false-success setup that left the
installed Reflexion runtime silently unusable; items that determine what is
actually exercised and when setup may report completion therefore come before
ancillary protocol machinery.

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
| Foundational meaning and trigger: one setup-owned post-mutation verification phase exercises the selected installed execution roots before the final completion line | `OPEN-CONFIRMED-BUG` | Round 9 isolated the foundation at combined confidence 42; round 10 raised confidence to 58 and validated pre-install totality and branch-correct canaries. Round 11 validated full-rerun and guarded-aggregate claims at 62 but failed child launch. Round 12 reframed four findings at digest `d7f1b2ef6e2904c686f0fe18b1d44cbfdc92ef358a17dcfd94f0e4fa16fbebb8`; Codex 42 and Opus 64 produced combined confidence 42, twenty below round 11; rejected. Round 13 narrowed round 12's own alternative to exclude HC3 at digest `d10c7130518985287e2bbf77bf89e6e5e87347c471f4fd59b9a4037658eb776c`; Codex 48 and Opus 68 produced combined confidence 48, 14 below round 11 and below the standing reject floor of 62; also rejected. Round 14 applied round 13's own rejected-options alternative (entry 2) in full at digest `f80ae6cd308281882158f9aa0bbb43a59cd928e21d4d55c279453b80dd013af6`; Codex 41 and Opus 55 produced combined confidence 41, 21 below round 11, below the standing reject floor of 62, and 7 below round 13's own already-rejected 48 -- a further regression; also rejected. No round-12, round-13, or round-14 item is promoted. This is the third consecutive rejection concentrated in the same environment-construction-plus-launch-abstraction mechanism, with round 14 regressing below round 13 rather than converging toward 62/81; see the rejected-options ledger entry 3's structural-approach flag. Round 15 narrowed to R15-B alone (environment classification only, R14-C left untouched); Codex 43 and Opus 66 produced combined confidence 43, below round 11's 62 floor; also rejected. Both reviewers found `E_codex`'s declared `LANG` member unassigned any of the three declared roles, plus an undefined "present, valid absolute" predicate, an incomplete `E_node_real` enumeration, an `E_codex`/registration-view asymmetry over `XDG_CACHE_HOME`/`XDG_STATE_HOME`, and a present-empty-XDG hard-fail reproducing round 14's own defect class with reversed polarity; see rejected-options entry 4. | Do not build from the round-12, round-13, round-14, or round-15 bundle. A future round should apply the round-15 rejected-options alternative (entry 4): add an explicit fourth non-role category (e.g. `synthesized-constant`) for `LANG` and every other never-ambient-read constant; define "present, valid absolute" once for every non-PATH variable (syntax-only vs. stat-existence vs. directory-ness vs. canonicalization) with a named outcome for a syntactically-absolute-but-invalid value; fully enumerate `E_node_real`'s own `LANG`/`PATH` state; reconcile `E_codex` and the registration-view probe's variable sets (add `XDG_CACHE_HOME`/`XDG_STATE_HOME` to `E_codex` or name and disclose the divergence); redefine or narrow the `context-determining` role claim for `E_codex`'s third-party-consumed variables; and decide and disclose the present-empty-XDG case explicitly (treat as absent, or keep fail-closed and name the accepted false-failure cost). R14-C (launch/cleanup/signal-handling/first-hop-termination) and HC3 remain isolated to their own future rounds throughout. |
| Truthful claim boundary: installed files, paths, imports, and lookups are checked; interactive host activation is not | `VALIDATED` | Round 9 Codex and Opus both explicitly gave FND-A `PASS` at combined confidence 42, matching the thread's prior combined-confidence high-water mark. Both accepted the exact `installed-files-paths-lookups-structurally-sound-v1` token, `interactiveActivationTested:false`, locked status consequences, and prohibition on describing degradation as pass. The whole round and whole design remain blocked. | Nothing further for the claim meaning itself. Preserve the exact boundary; output-schema and documentation enforcement remain implementation acceptance work. |
| Root-probe deduplication versus host-surface accounting | `OPEN-UNTESTED` | Round 9 supplied a mutually exclusive nine-row graph. Opus explicitly passed FND-B and praised the root/surface split; Codex's FND-B failure concerned only the pre-install trigger gap, but its aggregate FND-B `FAIL` prevents clean item-level pass attribution to the graph. | Re-assert the same graph in the isolated trigger-totality round and require reviewers to attribute trigger totality separately from root/surface accounting. |
| Central source-pinned coordinator with installed-root workers versus a full runner per root or inline shell probes | `VALIDATED` | Round 9 Codex and Opus both explicitly gave FND-C `PASS` at combined confidence 42, matching the prior high-water mark. Both accepted one source-owned coordinator with absolute recorded-root operands as the smallest coherent direction. Their security findings require installed-byte integrity, path binding, and child environment controls before implementation but do not select another orchestration architecture. | Nothing further for coordinator versus per-root-runner versus inline-shell selection. Preserve the narrow selection; all execution-safety controls remain separate open items. |
| Locked tiering: setup-classified Reflexion unavailability and Codex CLI JSON uncertainty are loud nonblocking degradation; an admitted installed lookup failure blocks | `VALIDATED` | Round 9 Codex and Opus both passed FND-A and expressly accepted the HC1/HC5 consequences at combined confidence 42, matching the prior high-water mark. Opus separately asked for the admitted/unavailable classification predicate and exhaustive fallthrough; those are mechanism/schema items, not disagreement with the locked tiering. | Nothing further for the classification policy. Define the admitted/unavailable predicate and total status function in later isolated rows without changing HC1/HC5. |
| Pre-install validation failure when an older selected installation already exists | `VALIDATED` | Round 9 Codex exposed the undefined older-install branch. Round 10 CLS-1 chose a binary current-invocation predicate: before the first selected mutation/registration attempt, return only the ordinary pre-install error regardless of older state, with no freeze, coordinator, probe, or health line; after the first attempt, final health is mandatory. Codex and Opus both passed CLS-1 at combined confidence 58, above the prior item high-water mark of 42. | Nothing further for this trigger branch. Preserve the present/absent fixture pair and the failed-first-attempt post-health fixture. |
| HC3 rerun is a new setup invocation, never a second coordinator call inside one invocation | `VALIDATED` | Round 10 fixed the new-process lifecycle but left mutation and inventory effects implicit. Round 11 CLS-2 expressly selects a full setup rerun that repeats selected writes/registrations, may create new backups, freezes one new final inventory, calls the coordinator once, and permits later approval validation only against every eligible result in that rerun. Codex and Opus both passed CLS-2 at combined confidence 62, above the prior thread high-water mark of 58. | Nothing further for full-rerun versus mutation-free invocation selection. The approval binding key and production point remain part of the separate HC3 mechanism, not this validated lifecycle choice. |
| Aggregate status function is exhaustive and every unlisted non-PASS condition is `FAILED` | `VALIDATED` | Round 10's default-deny fallthrough still let empty sets satisfy both exit-0 non-PASS rows. Round 11 CLS-3 partitions every non-PASS into disjoint `D`, `E`, or `X`; requires nonempty `E` for `DEGRADED_OVERRIDE`, nonempty `D` for `DEGRADED`, empty `N` for `PASS`, and sends every other state to `FAILED`/1. Codex and Opus both passed CLS-3 at combined confidence 62, above the prior high-water mark of 58. | Nothing further for totality or all-PASS behavior. The later HC3 design must explicitly name exact codes moved from `X` into `E`; approval eligibility and authority are not validated by this row. |
| Coordinator-to-probe children use the same frozen absolute Node executable and stripped Node environment | `OPEN-CONFIRMED-BUG` | Round 10 exposed `argv[0]` substitution and the environment overclaim. Round 11 failed missing frozen-value propagation, descendant wording, PATH/platform, and observable-environment gaps at combined confidence 62. Round 12 made propagation explicit and Codex passed R12-C; Opus agreed propagation and path-only assurance were well judged but failed the item because setup's `frozenNode` source was unnamed and deadline/capture fields contradicted bounded behavior. Combined confidence regressed to 42. Round 13 named the exact `command -v node`/absolute-validate/canonicalize Node-selection rule (both reviewers accepted this half unchallenged) and made capture fields mandatory core, but combined confidence regressed further to 48 because no concrete `timeoutMs` values were named anywhere, the setup-to-coordinator required-core-shape block omitted the five mandatory capture fields (two disagreeing normative shapes, Opus), and "unconditional"/"guaranteed" plan cleanup was implemented only as a `finally` path that cannot survive SIGKILL or default-disposition signals (both reviewers independently). Opus also found no named owner terminates the coordinator's own first-hop children when setup kills a deadlined coordinator. Round 14 named concrete `timeoutMs` ceilings (5000/20000/90000ms), one ten-field normative schema instantiated three ways, and a `detached:true` coordinator process-group `SIGKILL` for first-hop-child termination on the coordinator's own deadline; both reviewers accepted the Node-selection rule again unchanged, but Codex failed the schema for omitting `detached:true` itself from the "complete" field list, and Opus failed the group-kill choice because `detached:true` also removes the coordinator's process group from terminal signal delivery, so the round's own new best-effort `SIGINT`/`SIGTERM`/`SIGHUP` handlers orphan the coordinator and its children on ordinary cancellation instead of covering that path. Combined confidence regressed further to 41. | Preserve the Node-selection rule (evidenced sound across three rounds). Add `detached`/process-group creation as an explicit mandatory field of the one normative launch schema, and route every termination path — deadline, byte-cap, and every handled signal (`SIGINT`/`SIGTERM`/`SIGHUP`) — through one negative-PID group-kill mechanism before any plan unlink or setup exit, or explicitly disclose first-hop survival on the signal path as an accepted residual in the same terms as the `SIGKILL`-to-setup residual. Name an explicit code/partition/exit-status for a coordinator killed at its own deadline or truncated at its byte cap (currently unnamed). |
| Installed-byte integrity, ownership/privilege boundary, and freeze-to-exec identity | `OPEN-CONFIRMED-BUG` | Rounds 9–11 established that parent-side path equality does not bind bytes, ownership, canonical filesystem object, or freeze-to-exec identity. Round 12 proposed a cooperative diagnostic with mandatory false assurance fields. Codex passed R12-C; Opus agreed the path-only scope and rejection of digest/descriptor attestation were proportionate, but failed missing Node-origin/deadline choices. Because combined confidence fell to 42, the scope-down is useful evidence but not validated. | In a future isolated launch-scope round, retain explicit false assurance fields and objective traceability for path selection. Reopen byte/descriptor attestation only if health output becomes an authorization input or the malicious-local-actor threat model changes. |
| Loader/runtime child-environment isolation beyond the three-variable denylist | `OPEN-CONFIRMED-BUG` | Round 10 exposed the non-closed denylist; round 11 retained loader/runtime influence. Round 12 selected fresh role-specific allowlists and mandatory `hostLoaderStateAttested:false`. Both reviewers failed R12-B: synthetic HOME/XDG can distort KStack's installed-runtime signal; Codex PATH with empty/relative components changes under fixed CWD; and phase-wide no-network/provider language contradicts unsupervised Codex. Combined confidence regressed to 42. Round 13 introduced a two-probe HOME/XDG context-dependence classification and absolute-only Codex PATH validation with named `CODEX_JSON_UNAVAILABLE` degradation; the PATH/argv half is sound (unchallenged by either reviewer), but Opus failed the classification itself: the brief's own `E_codex` construction treats `CODEX_HOME` as tree-relocating for Codex while `E_node_real`'s HOME/XDG-only predicate denies `CODEX_HOME` to the context-dependent Codex/marketplace registration-view probe, reproducing the same signal-distortion class on a narrower surface, with no admissible path to classify a probe keyed on a non-HOME/XDG variable. Codex separately failed unnamed outcomes for empty/relative/non-absolute captured values. Combined confidence regressed to 48. Round 14 replaced the closed family with per-probe enumerated resolution-variable sets (adding `CODEX_HOME` to the registration-view probe's set, closing that exact gap) and added a three-state absent/valid/degenerate captured-value rule naming an outcome for every degenerate value. Both reviewers found this introduced a new, more severe problem: the rule makes an entirely **absent** variable a non-error for every probe, including variables in a context-dependent probe's own resolution-variable set, which both reviewers independently identify as reopening the identical false-success channel the degenerate branch was written to close (Opus: `SEC-R14B-ABSENT-VARIABLE-SILENT-FALLBACK`, `SEC-R14B-ECODEX-MANDATORY-HOME-ABSENT-UNNAMED`, both medium, plus explicit material dissent; Codex: same gap independently). Separately, the Reflexion probe's own resolution-variable set was left qualified ("each only if applicable to that lookup's own resolution order") rather than actually enumerated, reproducing round 13's own named defect on the probe round 13 did not touch (both reviewers). Opus additionally found no stated propagation channel for `E_node_real` to reach the coordinator, which the same brief runs under `E_node_isolated`. Combined confidence regressed further to 41, seven below round 13's own already-rejected 48. Round 15 replaced the flat absent/valid/degenerate rule with a three-role (`required`/`context-determining`/`advisory`) classification, fully enumerated all four environment-variable consumers, added `CODEX_HOME` to the registration-view probe's set, and gave `HOME` an unconditional required role there to avoid an unverified precedence claim. Both reviewers independently found `E_codex`'s declared `LANG` member has no assigned role, falsifying the brief's own "every declared variable gets exactly one role" claim; Opus separately found "present, valid absolute" undefined for non-PATH variables (`SEC-R15B-VALID-ABSOLUTE-UNDEFINED`), `E_node_real` never itself fully enumerated, `E_codex` omitting `XDG_CACHE_HOME`/`XDG_STATE_HOME` despite the registration-view probe declaring both (`SEC-R15B-ECODEX-XDG-CACHE-STATE-OMITTED`), and present-empty XDG values hard-failing despite the XDG convention treating empty as equivalent to unset, reproducing round 14's defect class with reversed polarity (`SEC-R15B-XDG-EMPTY-HARD-FAIL`, plus material dissent). Codex separately found the registration-view probe's no-precedence-claim conflicts with its own validation fixture (`SEC-R15B-EFFECTIVE-CONTEXT-MISLABEL`, plus material dissent). Combined confidence: 43, 19 below round 11's 62 floor; rejected (rejected-options entry 4). Both reviewers characterized this as closure gaps in an otherwise sound rule; Opus said it would expect a narrowly revised version to pass. Round 16 applied entry 4's six-item alternative in full (synthesized-constant category for LANG/E_node_isolated constants; one syntax/existence/directory-ness/canonicalization "valid absolute" predicate with a new named syntactically-absolute-but-invalid table column; full E_node_real enumeration including total PATH absence; XDG_CACHE_HOME/XDG_STATE_HOME added to E_codex; context-determining replaced by a new optionally-supplied role for E_codex's third-party-consumed variables plus an explicit CODEX_HOME-first precedence statement for the registration-view probe; XDG Base Directory Specification's empty-equals-unset text adopted for XDG_-prefixed variables). Both reviewers independently found this round's own Fix 1 falsified by its own Fix 5 (Fix 1 claims "the three roles... remain the complete set" while Fix 5 adds a fourth ambient-dependent role, optionally-supplied, applied to four E_codex variables — five total classifications, not four), reproducing round 15's exact self-falsification defect class one level up (Codex strongestObjection; Opus failedChecks item 1 and strongestObjection). Both also independently found Fix 2 specifies two mutually exclusive forwarded values for the same environment member (canonicalized per test 4 versus "forwarded verbatim" per the normative table) for any symlink-containing valid path (Codex failedChecks item 2 plus SEC-R16-CANONICAL-FORWARDING-AMBIGUOUS; Opus failedChecks item 2 plus SEC-R16-FORWARD-CANONICAL-UNDEFINED), and both found Fix 5's "supplied-degenerate" state definition ("every non-empty" value) textually contradicts its own present-valid-absolute="supplied" success case (Codex failedChecks item 3; Opus failedChecks item 4 plus SEC-R16-SUPPLIED-DEGENERATE-UNRECORDED). Opus separately found ENV_CONTEXT_DEGENERATE's provenance citation is wrong (attributed to round 14 but not among the three items round 15's own carry-forward rule actually names, an accounting gap inherited unflagged from round 15). Codex separately found validation items 2-3 not executable against E_node_isolated given Fix 1's own synthesized-constant definition. Combined confidence: 32, 30 below round 11's 62 floor and a further regression from round 15's already-rejected 43; rejected (rejected-options entry 5). Both reviewers again credited four of the six fixes (E_node_real enumeration, E_codex/probe symmetry, the optionally-supplied grounding move plus registration-view precedence statement, and the XDG empty-equals-unset adoption) as closing their named gaps cleanly; the FAIL is attributed specifically to Fix 1's and Fix 2's own internal contradictions, not a structural rejection of R15-B's three-role/four-role approach. Round 17 applied entry 5's six-item alternative in full: stated the taxonomy as five total classifications (deleting the false "three roles are complete" parenthetical); named the canonicalized string as the single forwarded value for every required/context-determining/optionally-supplied valid-absolute case and named setup, at plan-construction time before the coordinator's single invocation, as the sole validation actor; corrected optionally-supplied's failure-state prose to exclude present-valid-absolute and dropped the named "supplied-degenerate" sub-state (codexEnvSupplied is emitted only on successful E_codex construction, so no third label has a case to describe); formally adopted ENV_CONTEXT_DEGENERATE as a fourth carried-forward item with its round-14 origin stated explicitly; and added advisory TMPDIR to E_codex (an eighth member) plus an explicit no-cross-consumer-short-circuit statement. Codex 38 and Opus 70 produced combined confidence 38 — an improvement over round 16's 32 (the first round-over-round gain in the R15-B series) but still 24 below round 11's 62 floor; rejected (rejected-options entry 6). Opus credited three of the four repairs (the five-classification statement, the optionally-supplied/codexEnvSupplied atomic-construction argument, and the ENV_CONTEXT_DEGENERATE provenance correction) plus the TMPDIR addition as sound; the FAIL concentrated on repair 2 (canonicalized forwarding): both reviewers independently found this round's own validation-evidence section reproduces the identical normative-versus-test contradiction class one section further (validation item 2 requires E_codex.PATH — declared required — to be asserted canonicalized when repair 2's own text excludes PATH from canonicalization three times; validation item 10 cannot be satisfied for synthesized-constant members), and both independently found repair 2's canonicalization security claim overstated ("closes" a TOCTOU/redirection window the design's own freezeToExecutionIdentityVerified:false already disclaims closing). Codex separately, more severely than Opus, found TMPDIR's addition to E_codex contradicts the advisory-invariant claim because a third-party process's own behavior can vary with it (SEC-R17-TMPDIR-ADVISORY-INVARIANT, medium, material dissent). | Do not build from the round-12 through round-17 bundles. A future round should apply rejected-options entry 6's alternative, confined to repair 2's validation-evidence section and claim calibration with no normative-rule changes: name the PATH carve-out explicitly in validation item 2; scope item 10 to exclude synthesized-constant members; downgrade the canonicalization security framing from "closes" to "narrows, does not close" and rest the choice on cross-consumer byte-identity alone; state the advisory-member canonicalization-failure outcome; reconcile the plan-construction carrier statement with the exclusions section's "carrier remains unnamed" language; align the E_node_isolated count-language phrasing; and narrow the advisory invariant's own wording to "never causes environment construction to fail" (not a claim about downstream third-party behavior), cross-referencing the existing no-claim-about-Codex disclosure, keeping TMPDIR in E_codex rather than removing it. This is the fifth consecutive rejection in the environment-construction/-classification sub-area (rounds 13-17) and the third consecutive rejection of R15-B's own text (rounds 15-17) on the same recurring defect class (a normative statement contradicted elsewhere in the same document, relocated to a new section each round); entry 6 flags this explicitly as a structural-simplification decision point for the owner before a round 18 is attempted, while noting the evidence also shows real convergence (Opus 44→70, three of four repairs credited). R14-C (launch/cleanup/signal-handling/first-hop-termination) and HC3/`SEC-OVERRIDE-EXIT-ZERO` remain isolated to their own future rounds throughout. |
| `DEGRADED_OVERRIDE` approval binding, eligibility, provenance, coverage, audit, and revocation | `OPEN-CONFIRMED-BUG` | Locked HC3 requires second-party audited approval; rounds 10–11 deferred its mechanism. Round 12 limited `E` to two import outcomes, bound exact failure subjects and stable inventory/source/context across a full rerun, required two distinct Ed25519 keys, single use, audit, and revocation. Opus passed R12-D, but Codex failed missing canonical serialization/transcript bytes and atomic durable audit publication; Opus separately asked for registry location/enrollment/key custody. Combined confidence regressed to 42, so no mechanism is retained. | Isolate HC3. Inline one canonical JSON algorithm and literal request/approval/revocation framing; fix registry location, enrollment, rotation, and key custody; derive the use path; publish complete audit bytes with an explicit no-replace/durability sequence before exit zero; define crash recovery, revocation/use locking, clock semantics, and cleanup. |
| Third-party Codex first-hop PATH, platform, shim, descendant, and side-effect scope | `OPEN-CONFIRMED-BUG` | Round 11 found PATH omission could mask the signal, descendants are unenforceable, and Windows shims lack a contract. Round 12 retained PATH only for Codex, limited native Windows shims to an exact degraded code, and disclosed unsupervised descendants. Opus passed R12-A's descendant disclosure; Codex failed only its conflict with the unqualified no-network/provider claim. Both failed the combined environment claim because empty/relative PATH changes under fixed CWD and Codex network/state effects were undisclosed. Round 13's R13-A scoped the no-network/provider/memory claim to KStack-authored edges and added `codexObservationSideEffectsBounded:false`; both Codex and Opus explicitly passed R13-A on its own terms, and Opus noted only one low residual (an inherited-lifecycle bullet still carrying an unqualified phrase mitigated by a forward cross-reference rather than a rewrite). This is strong item-level evidence that the descendant/network-scope disclosure direction is sound, but round 13's combined confidence (48) fell below both round 11's 62 high-water mark and the standing reject floor, so per the ledger's high-water-mark rule for `VALIDATED` status and the standing confidence-regression-is-reject-and-revert rule, this item is **not** promoted to `VALIDATED` this round; the round-13 bundle as a whole is rejected, not selectively kept. Round 14 carried R14-A forward byte-for-byte unchanged per the owner's explicit instruction (not rewriting the residual inherited-lifecycle bullet); both Codex and Opus again explicitly passed it with zero attributed findings. Because round 14's combined confidence (41) is again below the 62 high-water mark, this item remains **not promoted** for a second consecutive round despite two consecutive unanimous passes. | Re-run R14-A's exact wording unchanged (including the still-unaddressed residual inherited-lifecycle bullet) inside the next round that also fixes R14-B/R14-C, since neither reviewer has ever objected to its substance across two rounds. Promote to `VALIDATED` only once a round containing it reaches combined confidence at or above the current 62 high-water mark. |
| Minimum versus closed child-launch call schema and frozen-value propagation | `OPEN-CONFIRMED-BUG` | Round 11 found no channel for `frozenNode`, coordinator directory, or observable environment and left stdio/timeout/kill closure ambiguous. Round 12 supplied explicit arguments plus a private plan and a required-core schema. Codex passed R12-C, but Opus failed because setup's Node source was unnamed and deadline/kill were called optional despite mandatory bounded capture/timeouts; Opus also identified plan residue when coordinator launch/read fails. Round 14's plan schema still carries only the frozen inventory plus, if applicable, `codexFile`/`E_codex`; Opus found no channel by which `E_node_real` (needed by the coordinator, which itself launches under `E_node_isolated`) reaches the coordinator at all. | Retain explicit arguments/private plan, but name setup's Node derivation (done, round 13), make deadline, capture caps, pipe closure, kill/reap semantics, and setup-owned unconditional plan cleanup mandatory core behavior (partially done, round 14 — see below); add an explicit plan-schema field or equivalent channel carrying `E_node_real`/its constituent captured values to the coordinator. |
| Source-versus-installed canary is branch-correct | `VALIDATED` | Round 9 Opus found the universal canary impossible for symlink roots. Round 10 CLS-5 scopes source-fails/recorded-root-passes to copy/native/cache roots and uses recorded-`S` operand byte equality plus rejection of a different unrecorded candidate for symlink roots. Codex and Opus both passed CLS-5 at combined confidence 58, above the prior item high-water mark of 42. | Nothing further for branch scoping. Preserve the exclusive branch fixture matrix and keep provisioning-only roots out of live-probe canaries. |
| Exact admitted versus unavailable Reflexion classification predicate | `OPEN-CONFIRMED-BUG` | Round 9 Opus accepted the locked tiering but found its hinge predicate absent from the slice and absent from the explicitly deferred list. The objective observes setup's admitted/unavailable/hard-failed states, but the exact acceptance predicate remains unspecified. | Isolate with the later status-schema round: bind the classification to setup-produced runtime-contract/sentinel evidence, enumerate hard-failed/not-installed, and test every state without reopening HC1. |
| Manual recovery only; installed-state mutations and output-only health artifacts are distinct | `OPEN-CONFIRMED-BUG` | Locked HC2 forbids automatic rollback. Round 8's separate `installedMutationLedger` and `outputArtifactLedger` was called a real closure by Opus, but Codex found ambiguous output-artifact token resolution and missing minimal-failure coverage; Opus found closed diagnostic-schema and nullability contradictions. | Retain manual recovery and the two-ledger direction. In a later isolated round, define exact installed-change evidence, output residue identity, minimal-failure projection, and “at most one non-null” diagnostic semantics. |
| Explicit launch evidence and `executedProbeCount` | `OPEN-CONFIRMED-BUG` | Round 8 added `launched` and both reviewers recognized that this repairs the outcome-only count. Opus found that `probeCodeLaunchState:"either"` merely trusts the serialized Boolean and that the closed manifest/plan schemas do not admit the map; Codex did not dispute the new event boundary. | Remove `either`; enumerate every code as pre- or post-launch, restate every closed carrier schema, and prove coordinator/F8 recomputation in one isolated data-contract round. |
| Directional plan byte cap | `OPEN-UNTESTED` | Round 8 added `maxPlanBytes=1048576` with pre-parse rejection, closing round 7's unbounded inline-fixture transport gap. Both reviewers recognized the closure, but Codex found no finite per-path maxima for the mandatory maximum-cardinality vector and Opus found no equivalent result-size proof. | Keep the bounded-reader direction. Isolate exact path byte limits and maximum-cardinality plan/private/public constructions before treating the cap as validated. |
| Parent/worker supervision and descriptor lifetime through F8 | `OPEN-CONFIRMED-BUG` | Round 8 found locks/descriptors lacked a protected lifetime; round 11 confirmed first-hop capture cannot enforce third-party descendant behavior. Round 12 correctly reframed descendant absence as unverified disclosure, and Opus passed R12-A, but identified a remaining liveness bug: a killed first hop can leave descendant-held output pipes open beyond the claimed capture bound. Codex separately failed the phase-wide no-network overclaim. Combined confidence regressed to 42. Round 13's `kill-and-close` behavior (kill the direct child, then unconditionally close the parent's own read side without waiting on descendant-held pipes) directly answers the round-12 pipe-liveness finding and neither reviewer challenged that specific mechanism. However Opus found a distinct, previously-unnamed gap: `kill-and-close` signals only the direct child (the coordinator), so the coordinator's *own* first-hop children (KStack probes, the frozen Codex CLI) are neither signalled nor reaped by any named owner when setup kills a deadlined coordinator, and can outlive the installer (e.g. an orphaned `codex exec`). Combined confidence regressed to 48. | Preserve the round-13 pipe-side kill-and-close capture-liveness mechanism (evidenced sound). Separately name an explicit owner/mechanism for terminating the coordinator's own first-hop children on coordinator kill — e.g., launch the coordinator in its own process group and have setup signal the group, not just the coordinator process, on deadline. This is process-lifetime ownership, distinct from and additional to the already-solved capture-liveness bug. |
| Mutation/output ledger wire contract and backpressure | `OPEN-CONFIRMED-BUG` | Both reviewers found the load-bearing parent-held ledger lacked closed frame schemas, tags, byte/event bounds, malformed/truncated/overflow behavior, and a continuous-drain rule; both noted the pipe can deadlock the worker. | Only after process ownership is settled, specify one finite wire protocol or remove the channel by keeping mutation ownership in one process. |
| F8 work ownership, interruptibility, and terminal-record production | `OPEN-CONFIRMED-BUG` | Codex found no bounded F8 worker or nonblocking terminal-output mechanism. Opus found no process assigned filesystem rechecks, private validation, public construction, or minimal-record production under the new supervisor restriction. | Resolve with the same process-ownership architecture as the descriptor-lifetime item; then isolate exact F8 responsibilities and failure behavior. |
| Cooperative setup concurrency and lock coverage | `OPEN-CONFIRMED-BUG` | Round 8 introduced per-anchor locking, but omitted source/shared output/override allocation coverage and a reachable lock primitive. Round 12 placed override revocation/use under one fixed lock and selected exclusive single-use creation; Opus passed that direction, but Codex found no complete atomic durable publication primitive and the bundle regressed to 42. | After process ownership is chosen, enumerate every mutable/shared resource and reachable lock primitive. For HC3, specify one lock domain, no-replace target derivation, complete-record publication/durability, crash recovery, and revocation/use race precedence. |
| Fixed pre-coordinator/lifecycle kill ceilings over mutation work | `OPEN-CONFIRMED-BUG` | Opus found that the new kill clocks can turn a healthy slow install into indeterminate installed state and lack a measurement gate for mutation work. This is a new round-8 destructive failure mode rather than a pre-existing objective requirement. | Reconsider whether mutation work belongs under a kill ceiling at all. Any future ceiling must be evidence-derived and specify the exact safe interruption boundary and manual-recovery consequence. |
| Closed schema consistency for CP, launch-state maps, diagnostics, and output fields | `OPEN-CONFIRMED-BUG` | Opus found CP simultaneously excluded from and included in the protected-object universe; `probeCodeLaunchState` absent from the closed manifest/plan key sets; and new output fields absent from the closed diagnostic key sets. Codex independently found branch and output projection ambiguity. | Isolate each independent schema correction after the foundational architecture stabilizes; do not append another cumulative precedence layer. |
| Launch-abstraction concrete timeout ceilings and single normative call shape | `OPEN-CONFIRMED-BUG` | Round 13 made `maxStdoutBytes`, `maxStderrBytes`, `timeoutMs`, `killSignal`, and `onDeadlineOrOverflow` mandatory core launch fields, but named no concrete `timeoutMs` value for any launch kind anywhere (both reviewers independently failed this), and the setup-to-coordinator "required core shape" block in the same item listed only `file`/`args`/`cwd`/`env`/`shell`, omitting the five fields the item declares mandatory for every launch — two disagreeing normative shapes for one call (Opus). Byte caps did get a concrete number (1048576); the deadline did not. Round 14 named concrete per-kind ceilings (5000/20000/90000ms) and one ten-field schema instantiated identically three times, evidenced sound by both reviewers on its own terms — but Codex found the schema still omits `detached:true`, which the round's own new process-group-kill mechanism requires, so "complete" is again inaccurate; and Opus found no named outcome (code/`D`-`E`-`X` membership/exit status) for a coordinator killed at its own new 90000ms ceiling or truncated at the byte cap. | Preserve the concrete per-kind `timeoutMs` values and the one-schema-instantiated-three-ways direction (evidenced sound). Add `detached`/process-group creation as an explicit mandatory field. Name an explicit code/partition/exit-status for a coordinator killed at its own deadline or truncated at its byte cap. |
| Setup-owned plan cleanup: signal-termination survival and directory/identity hygiene | `OPEN-CONFIRMED-BUG` | Round 13 moved plan-cleanup ownership from the coordinator (which might never start) to setup (guaranteed to run to exit), calling the cleanup "unconditional" and "guaranteed" via a `finally`-style path. Both reviewers independently found this claim false as implemented: a `finally` path does not execute on SIGKILL or default-disposition SIGTERM/SIGINT/SIGHUP (an operator Ctrl-C or killed terminal session), so the selected fix inherits a structurally identical hole one level up from the one it was meant to close. Opus separately found the private plan directory's creation semantics, mode, and name-derivation unspecified, and setup's exit-path unlink is by bare path with no identity recheck (low-severity TOCTOU within the disclosed trust boundary). Round 14 added best-effort `SIGINT`/`SIGTERM`/`SIGHUP` handlers alongside `finally`, dropped the "unconditional"/"guaranteed" wording in favor of an honest disclosed `SIGKILL` residual, specified an `mkdtemp`-style 0700 plan directory, and added a device/inode identity check before unlink. Codex found the identity check does not actually deliver TOCTOU resistance as characterized (material dissent) and that `open`/`write` do not return device/inode identifiers as stated (Opus, low, naming `fstat` as the correct primitive). Opus separately found the round's own new `detached:true` coordinator process group is not signalled by the new `SIGINT`/`SIGTERM`/`SIGHUP` handlers, so operator cancellation now orphans a live coordinator, its probes, and a running Codex process while the plan file is unlinked out from under them — a new failure mode round 13 did not have (medium, plus material dissent) — and that the `rmdir` gate ("after a successful plan-file unlink") contradicts the round's own validation fixture for the case where the coordinator, not setup, performs the unlink. | Preserve the ownership shift to setup, the honest best-effort/disclosed-residual wording, and the `mkdtemp` 0700 directory (all evidenced as the right direction). Route every termination path (deadline, byte-cap, and every handled signal) through one negative-PID group-kill mechanism before any plan unlink or setup exit, or explicitly disclose signal-path first-hop survival as an accepted residual. Name the identity-check primitive correctly (`fstat` on the creating file descriptor, not `open`/`write` return values) and replace the "TOCTOU-resistant" characterization with an accurate best-effort-exposure-reduction claim. Make `mkdtemp`-directory removal setup's unconditional best-effort responsibility regardless of which process removed the plan file. |
| Output-artifact identity and privacy-safe public references | `OPEN-CONFIRMED-BUG` | Codex found `output:fixture:<invocationId>` ambiguous for multiple fixtures, the SHA-256 subject of `output:override:<sha256>` undefined, and applicable minimal failures unable to identify residue. | Define one-to-one or explicitly aggregate token resolution, exact private mapping, and minimal-failure coverage in the later recovery/output round. |
| Offline two-key revocation residual | `OPEN-UNTESTED` | Round 8 prominently selected the unbounded old-release revocation residual. Opus retained that explicit owner ratification is still required; round 7 reviewers likewise treated this as an unratified value judgment rather than a schema gap. | Keep out of the foundational health-check round. Before whole-design approval, obtain explicit owner acceptance or replace it with a separately reviewed online/distributed authority design. |
| Self-contained strict Ed25519 arithmetic and release assurance | `OPEN-CONFIRMED-BUG` | Round 8's custom arithmetic plus Node verification left oracle/bootstrap gaps. Round 12 instead selected standard Node `crypto.verify` only; Opus passed the HC3 direction, while Codex failed because canonical serialization and literal domain-separated transcript bytes were absent. Combined confidence regressed to 42, so standard-library use is not yet a validated protocol. | Keep custom arithmetic out. In an HC3-only round, bind one supported Node crypto profile to exact canonical bytes and literal request/approval/revocation transcript framing, plus malformed/noncanonical signature fixtures and registry/key-custody rules. |
| Symlink-free release dependency closure | `OPEN-UNTESTED` | Round 8 added pinned `--no-bin-links --omit=dev --ignore-scripts` installation and zero-symlink gates. Opus asked whether that command still produces the complete native-addon closure; neither reviewer supplied an item-specific pass. | Isolate the supported dependency/bootstrap closure with a reproducible source/stage fixture before relying on it in the health-check trust model. |
| Supervisor-authoritative deadline, post-exec relative budget, and bounded finalization lifecycle | `OPEN-CONFIRMED-BUG` | Round 24 exposed the deadline group at 34; round 25 reached 62; rounds 26–27 repaired relative budget/reserve/divergence; round 28's sealed execution and round 29's fd-5 vehicle reached 62; rounds 30–32 regressed to 34, 18, then 5. Round 33 recovered to 72; round 34 regressed to 12. Round 35 corrected chunk/sticky/cutoff direction and improved to combined 24 (Codex revise/28, Opus revise/24), but every drain can still livelock on a continuously nonempty writer and post-deadline read chunks can remain affirmative. Exact-capacity overflow/EOF, read wording, transition proof, precedence/reap/auth/pidfd/producer obligations also remain open. | Freeze round 33 EOF and the corrected chunk direction. Round 36 isolates only `boundedDrainV1`: cutoff checks before/after every nonblocking read, whole crossing chunk ineligible, cap+1 one-byte sentinel, exact positive/EOF/EAGAIN/EINTR/error mapping, writer-bound proof, and real continuous-writer/exact-capacity/deadline fixtures. Preserve cross-channel cutoff, reap reserve, precedence/auth, pidfd fallback, producer EOF, progress proof and every other finding open. |
| Private/public result maximum-cardinality proof | `OPEN-CONFIRMED-BUG` | Opus found that up to two hosts and 32 per-skill S1 diagnostics can exceed the unchanged result caps, while original failures may not be dropped. Round 8 proved only the plan bound. | Define finite path/id/diagnostic cardinalities and construct maximum legal private/public results, or revise the result schema/caps in an isolated transport round. |

## Source basis

The initial population was verified directly against:

- `.kstack/objectives/post-deploy-health-check-2026-08-24.md`;
- `.kstack/decisions/post-deploy-health-check-2026-08-24-round-1-clarification-2026-08-24.md`;
- `.kstack/reviews/post-deploy-health-check-2026-08-24-round8/decision-brief.md`;
- `.kstack/reviews/post-deploy-health-check-2026-08-24-round8/codex.json`;
- `.kstack/reviews/post-deploy-health-check-2026-08-24-round8/opus.json`; and
- `.kstack/reviews/post-deploy-health-check-2026-08-24-round8/gate.json`.

Round 8 has no standalone `synthesis.md` on disk. Its retained structured
reviewer envelopes and gate are therefore the primary round-8 finding and
aggregate authorities. Round 7's structured envelopes were read only to
distinguish inherited findings from defects introduced by round 8.

Round 9 and round 10 maintenance was verified directly against each round's
exact `decision-brief.md`, `codex.json`, `opus.json`, `synthesis.md`,
`checks.json`, `gate.json`, and `manifest.json`. Round 10's retained design
digest is `62e51b2839a35a8bb8fdcd983a00de4cd4cb075f730e8301576eef627902c807`;
its combined confidence is 58 and its gate is `BLOCKED`.

Round 11 maintenance was verified against the same complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round11/`. Its retained
design digest is `b48ecd38543682db91ebc71b31a7ba3751dcd0eb27d127201475cbb346ada30b`;
Codex confidence is 64, Opus confidence is 62, combined confidence is 62, and
the round-11-plus gate is `BLOCKED`. Both reviewers pass CLS-2 and CLS-3 and
fail CLS-4; item-level validation does not imply whole-design approval.

Round 12 maintenance was verified against the complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round12/` and the linked
whole-mechanism rejected-options entry. Its retained design digest is
`d7f1b2ef6e2904c686f0fe18b1d44cbfdc92ef358a17dcfd94f0e4fa16fbebb8`;
Codex confidence is 42, Opus confidence is 64, combined confidence is 42, and
the round-12 gate is `BLOCKED`. Because confidence fell twenty points below
round 11, the bundle is rejected and no round-12 proposal becomes `VALIDATED`.

Round 13 maintenance was verified against the complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round13/` and the linked
whole-mechanism rejected-options entry 2. Its retained design digest is
`d10c7130518985287e2bbf77bf89e6e5e87347c471f4fd59b9a4037658eb776c`; Codex
confidence is 48, Opus confidence is 68, combined confidence is 48, and the
round-13 gate is `BLOCKED`. Round 13 explicitly excluded HC3 from its scope
per the owner's narrowing instruction; HC3/`SEC-OVERRIDE-EXIT-ZERO` remains
exactly as recorded after round 12 and is not touched by round-13 maintenance.
Both reviewers passed R13-A (descendant/network-scope disclosure) unanimously,
but because round 13's combined confidence (48) fell 14 points below round
11's 62 high-water mark and below the standing reject floor of 62, no
round-13 item — including the unanimous R13-A pass — is promoted to
`VALIDATED`; the ledger's high-water-mark rule for that status and the
standing confidence-regression-is-reject-and-revert rule both require treating
the round-13 bundle as rejected rather than selectively kept.

Round 14 maintenance was verified against the complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round14/` and the linked
whole-mechanism rejected-options entry 3. Its retained design digest is
`f80ae6cd308281882158f9aa0bbb43a59cd928e21d4d55c279453b80dd013af6`; Codex
confidence is 41, Opus confidence is 55, combined confidence is 41, and the
round-14 gate is `BLOCKED`. Round 14 applied round 13's own rejected-options
alternative (entry 2) in full — per-probe enumerated environment-variable
classification, concrete numeric `timeoutMs` ceilings, one normative
ten-field launch schema, honest best-effort signal-aware plan cleanup, a
named first-hop-child termination owner/mechanism, and `mkdtemp`-style plan
directory semantics with an identity-checked unlink — but both reviewers
independently found that several of round 14's own new repair mechanisms
introduced new internally-contradictory or newly-orphaning failure modes
(the absent/degenerate split reopening the false-success channel it was
meant to close; the unenumerated Reflexion resolution-variable set;
`detached:true` removing the coordinator's process group from the very
signal handlers introduced the same round to cover it; an unnamed
coordinator-deadline outcome; and an overclaimed TOCTOU-resistant unlink).
Combined confidence fell to 41, seven points below round 13's own
already-rejected 48 — a further regression rather than convergence. Both
reviewers again passed R14-A (carried forward byte-for-byte unchanged from
round 13) with zero attributed findings, but per the same high-water-mark and
confidence-regression-is-reject-and-revert rules, no round-14 item —
including R14-A's second consecutive unanimous pass — is promoted to
`VALIDATED`; the round-14 bundle as a whole is rejected. This is the third
consecutive rejection concentrated in substantially the same
environment-construction-plus-launch-abstraction mechanism (rounds 12, 13,
14: combined confidence 42, 48, 41), and rejected-options entry 3 flags this
explicitly as a structural-approach decision point for the owner before any
round 15 is attempted.

Round 15 maintenance was verified against the complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round15/` and the linked
whole-mechanism rejected-options entry 4. Its retained design digest is
`33026b72aeaceb4a592ce7f13eae39dd767237c850299a0fed31c2100acd09ec`; Codex
confidence is 43, Opus confidence is 66, combined confidence is 43, and the
round-15 gate is `BLOCKED`. Per the owner's explicit scope split, round 15
narrowed to exactly one reviewable item (R15-B, environment-variable
classification only) and left the entire R14-C launch/cleanup/signal-
handling/first-hop-termination mechanism untouched, exactly as round 11 had
it. Round 15 replaced round 14's flat absent/valid/degenerate rule with a
three-role classification (`required`/`context-determining`/`advisory`)
that ties the safety of an absent value to whether the consumer's own
resolution logic has a defined default-context fallback, fully enumerated
four environment-variable consumers, added `CODEX_HOME` as a full member of
the registration-view probe's resolution-variable set, and gave `HOME` an
unconditional `required` role for that probe to avoid asserting an
unverified `CODEX_HOME`/`HOME` precedence. Both reviewers independently
found the identical self-contradiction as their lead finding (`E_codex`'s
declared `LANG` member has no assigned role, falsifying the brief's own
"every declared variable gets exactly one role" claim), and Opus separately
found an undefined "present, valid absolute" predicate, an incompletely
enumerated `E_node_real`, an `E_codex`/registration-view-probe asymmetry
over `XDG_CACHE_HOME`/`XDG_STATE_HOME`, and a present-empty-XDG hard-fail
that reproduces round 14's own named unprincipled-distinction defect with
reversed polarity. Combined confidence (43) is 19 points below round 11's
62 floor and below this round's own stated 62 reject threshold; per the
round-15 prompt's standing rule, the round is rejected and not built forward
from. Both reviewers characterized the defects as closure gaps in an
otherwise sound rule, not a structural rejection of the three-role approach;
Opus explicitly said it "would expect a narrowly revised R15-B to pass."
Rejected-options entry 4 records the concrete alternative for a future
round.

Round 16 maintenance was verified against the complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round16/` and the linked
whole-mechanism rejected-options entry 5. Its retained design digest is
`acba6ab7949cdf538a83f42c2e84573ce199350e3c21083422521e704b25c05f`; Codex
confidence is 32, Opus confidence is 44, combined confidence is 32, and the
round-16 gate is `BLOCKED`. Round 16 applied rejected-options entry 4's
six-item alternative in full against round 15's text: a fourth non-role
`synthesized-constant` category for `LANG` (applied uniformly to `E_codex`
and `E_node_isolated`); one unified syntax/existence/directory-ness/
canonicalization "present, valid absolute" predicate for every non-`PATH`
variable, with a new explicitly named "present, syntactically absolute but
invalid" table column; a fully enumerated `E_node_real` (pinning `LANG` to
`"C"` and stating `PATH`'s total, deliberate absence); `XDG_CACHE_HOME`/
`XDG_STATE_HOME` added to `E_codex` for symmetry with the registration-view
probe; a new `optionally-supplied` role replacing `context-determining` for
`E_codex`'s third-party-consumed variables (grounded in what setup captured,
not a claim about Codex's own resolution logic), plus an explicit
`CODEX_HOME`-first precedence statement for the KStack-authored
registration-view probe specifically; and adoption of the XDG Base
Directory Specification's own empty-equals-unset text, scoped to
`XDG_`-prefixed variables. Both reviewers independently found round 16's own
Fix 1 self-falsified by its own Fix 5 — Fix 1 claims four total
classifications with "the three roles above remain the complete set," while
Fix 5 adds a fourth ambient-dependent role (`optionally-supplied`) applied to
four `E_codex` variables, yielding five classifications — reproducing round
15's exact self-falsification defect class one level up, at the taxonomy
statement itself rather than a single variable's row (Codex
`strongestObjection`; Opus failed check 1 and `strongestObjection`, found
independently). Both also independently found Fix 2 names two mutually
exclusive forwarded values (canonicalized per its own test 4, versus
"forwarded verbatim" per the normative table) for any symlink-containing
valid path, and that Fix 5's `supplied-degenerate` definition ("every
non-empty" value) textually contradicts its own present-valid-absolute =
`"supplied"` success case. Opus separately found round 15 had already
introduced a provenance-citation error (`ENV_CONTEXT_DEGENERATE` attributed
to round 14 outside that round's own three named carried-forward items) that
round 16 inherited unflagged; Codex separately found validation items 2-3
not executable against `E_node_isolated` given Fix 1's own
synthesized-constant definition. Combined confidence (32) is 30 points below
round 11's 62 floor and a further regression from round 15's already-rejected
43; the round is rejected and not built forward from. Both reviewers again
credited four of the six fixes (`E_node_real` enumeration, `E_codex`/probe
symmetry, the `optionally-supplied` grounding move plus the registration-view
precedence statement, and the XDG empty-equals-unset adoption) as closing
their named gaps cleanly, attributing the FAIL specifically to Fix 1's and
Fix 2's own internal contradictions rather than a structural rejection of
R15-B's three-role/four-role approach. Rejected-options entry 5 records the
concrete alternative for a future round.

Round 17 maintenance was verified against the complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round17/` and the linked
whole-mechanism rejected-options entry 6. Its retained design digest is
`18e84385c6071cd345b9fb3275f859db0b21a81c4cd300cf75afbb24c95c52ce`; Codex
confidence is 38, Opus confidence is 70, combined confidence is 38, and the
round-17 gate is `BLOCKED`. Round 17 applied rejected-options entry 5's
six-item alternative in full against round 16's text: the taxonomy restated
as five total classifications (four ambient-dependent roles plus one
non-role category), deleting the false "three roles are complete"
parenthetical; the canonicalized string named as the single forwarded value
for every `required`/`context-determining`/`optionally-supplied`
valid-absolute case, with setup named as the sole validation actor acting at
plan-construction time before the coordinator's single invocation;
`optionally-supplied`'s failure-state prose corrected to exclude
present-valid-absolute, dropping the named `supplied-degenerate` sub-state on
the grounds that `codexEnvSupplied` is emitted only on successful
construction and therefore has no case for a third label to describe;
`ENV_CONTEXT_DEGENERATE` formally adopted as a fourth carried-forward item
with its round-14 origin stated explicitly; and advisory `TMPDIR` added to
`E_codex` (an eighth declared member) alongside an explicit statement that no
consumer's required-check failure short-circuits another consumer's
construction or attempt. Opus credited three of the four repairs (the
five-classification statement, the `optionally-supplied`/`codexEnvSupplied`
atomic-construction correction, and the `ENV_CONTEXT_DEGENERATE` provenance
correction) as sound, plus the `TMPDIR` addition and its eight-member
enumeration, and neither reviewer reopened round 16's four already-credited
fixes or the retained classification structure. The FAIL concentrated on the
canonicalized-forwarding repair in two independent ways both reviewers found:
this round's own validation-evidence section reproduces the identical
normative-versus-test contradiction class the round exists to repair, now
relocated into the validation items themselves (item 2's generalizing clause
requires `E_codex.PATH` — declared `required` — to be asserted canonicalized
when the repair's own text excludes `PATH` from canonicalization three
times; item 10 cannot be satisfied for `synthesized-constant` members, which
have no ambient state to test); and the repair's own security justification
overstates what canonicalization delivers (Codex
`SEC-R17-CANONICALIZATION-TOCTOU-OVERCLAIM`, medium; Opus
`SEC-R17-CANON-WINDOW-OVERCLAIM`, medium plus material dissent — both
found "closes" a post-validation TOCTOU/redirection window overstated given
the design's own unmodified `freezeToExecutionIdentityVerified:false`
disclosure, while agreeing the underlying canonicalize-over-verbatim choice
is itself correct). Codex separately, and more severely than Opus (which
filed only a low finding on the same point), found the `TMPDIR` addition to
`E_codex` contradicts the brief's own advisory-invariant claim because a
third-party process's own exit/output behavior is not something this design
observes or controls (`SEC-R17-TMPDIR-ADVISORY-INVARIANT`, medium, Codex
`strongestObjection` and material dissent) — a genuine cross-reviewer
severity disagreement on the same underlying fact. Combined confidence (38)
is 24 points below round 11's 62 floor, but is the first round-over-round
improvement in the R15-B series (up from round 16's 32), with Opus's own
confidence rising from 44 to 70; the round is rejected and not built forward
from. Rejected-options entry 6 records the concrete alternative — confined
to the validation-evidence section and claim calibration, with no normative-
rule changes — and its structural-simplification flag, noting this is the
fifth consecutive rejection in the environment-construction/-classification
sub-area (rounds 13-17) and the third consecutive rejection of R15-B's own
text (rounds 15-17) on the same recurring defect class, while the evidence
also shows real convergence that argues against an immediate structural
collapse of the classification model.

Round 18 maintenance was verified against the complete artifact set under
`.kstack/reviews/post-deploy-health-check-2026-08-24-round18/`. Its retained
design digest is
`cb90d0189af14262f53c1a5db251cbc991a99cfe60927430111cce4bb363704a`;
Codex confidence is 68, Opus confidence is 74, combined confidence is 68,
and the gate is `BLOCKED`. The structural move to one data policy plus a
generic interpreter is retained as the preferred direction: both reviewers
treated it as a material improvement and neither recommended the handwritten
fallback. The remaining item is `OPEN-OWNER-DECISION`, not implementation-
ready. Its bounded blockers are: choose POSIX-only or complete platform-
derived semantics; encode disjoint state precedence; define fixture-root
mapping, creation failures, and an injectable negative-test seam; separate
the generic test oracle from runtime interpreter code; generate semantic
definitions from the same exported source; and define degraded-result,
diagnostic, and locale behavior. Whole-design launch/process lifecycle,
plan-file cleanup, HC3, and complete verification remain open separately.
Per the round-18 owner amendment, no round 19 is opened silently and no
implementation transition occurs.

Rounds 19–20 maintenance is recorded under their complete artifact sets.
Round 19 (`f7c8216f...80dd`) was `BLOCKED` at combined 45 after expanding to
the complete objective; its high-severity missing HC3 registry-rollback
barrier and narrower launch/authority gaps were carried into round 20. Round
20 (`4f287894...a19a`) durably closes registry rollback/equivocation, exact
installation framing, pre-use revocation authority, plan elimination, and the
aggregate/policy core. Codex approved at 91 with no findings; Opus revised at
74. The combined gate remains `BLOCKED` on five localized items: canonical
env-launcher symlink portability, optional-Codex output-budget separation,
closed policy grammar, HC3 lock contention/continuous-hold semantics, and
removal or bounded disclosure of env values in argv. Status is
`OPEN-OWNER-DECISION`; no implementation or round 21 is authorized.

Rounds 21–23 were opened by the 2026-08-26 multi-thread closure decision and
its continuation amendment. Round 21
(`63c7373bf7baa899f1cc36d42324cbf718419badcc285c7f8f9d169acf638e88`)
was `BLOCKED` at combined 62: it closed round 20's five packaging items but
left equal inner/outer deadlines, an overlong override path, macOS/native-
helper and symlinked-Node failures, incomplete process-group/pipe handling,
and helper trust gaps. Round 22
(`3d944686d996c5a725994d795b92524693f8e74bc4bb1ce3da4508e8d73ebbd9`)
was `BLOCKED` at combined 25: its JavaScript bootstrap removed the native ABI
problem but introduced a false 4096-byte PIPE_BUF assumption, a common WSL
PATH false failure, unadmitted Bash/Node trust, contradictory deadline and
RETRY taxonomies, and incomplete HC3 persistence races.

Round 23
(`44522b0406e6228b2b6edfe5b3457d6cbffc858ea6a0c425a867476d0fb4394b`)
was `BLOCKED` at Codex 24, Opus 44, combined 24. It removed the pipe-size and
Bash-launch contradictions but made Codex PASS unreachable by discarding the
ambient snapshot before the coordinator could construct Codex envp. It also
left high-water writes outside the override linearization lock; cryptographic
preimages and public result schemas incomplete; observation collision bytes,
directory-ancestor durability, fixture normalization and Node handoff
undefined; manifest authenticity overstated; and READY/setsid/platform/error
mappings incomplete. Round 24 is frozen locally at
`84d4aa4f27c23985413811c1b201a6878502a619e95dc80d44eb30360a22c21b`,
secret-clean, and awaits payload-specific provider-export approval. No
implementation transition has occurred.

Round 24
(`84d4aa4f27c23985413811c1b201a6878502a619e95dc80d44eb30360a22c21b`)
was `BLOCKED` at Codex 34, Opus 52, combined 34. It closes round 23's
unreachable Codex environment path, high-water/use race, nondeterministic
observation bytes, signature-cycle ambiguity, fixture normalization and
ancestor-durability baseline. Remaining findings are separated by interaction
risk: deadline origin/handoff; pre-coordinator result domains; portable lock
and filesystem qualification; HC3/revocation domains; and durability,
retention, environment-visibility, platform-key and rollback calibration.
Round 25 isolates only the first group as `PDH-R25-01`; its frozen digest is
`b1d1e5ffc0446c008c568a0d9821dbb71150f6831f68ad72dee27a8c39f7872f`.
It is secret-clean and `OPEN-UNTESTED`; no confidence is inferred before dual
review.

Round 25
(`b1d1e5ffc0446c008c568a0d9821dbb71150f6831f68ad72dee27a8c39f7872f`)
isolated `PDH-R25-01` and improved combined confidence from 34 to 62 (Codex
62, Opus 66), but both reviewers failed the item. The child arithmetic is
retained; open defects are coordinator-wide enforcement, cross-runtime clock
epoch, setup-mode grammar, entry ordering, suspend semantics, sequentiality,
and exact reserve/clamp accounting. Round 26 retains only that same deadline
item, replacing the absolute cross-runtime instant with a post-exec relative
budget handshake and complete lifecycle caps. Its frozen secret-clean digest
is `1f8222ee66a2f835e2a579296674e217bc8fecefeb36dfd2c6a0763b0588ca81`.

Round 26's authentic invocation
`d8dcdfa4-a601-4f68-a216-6c2d046f057b` was `BLOCKED` at Codex 20, Opus 72,
combined 20 — down 42 from round 25. The post-exec relative-budget direction,
28-byte frame, entry ordering, mode arithmetic, strictly sequential children,
and unclamped-Codex-D/clamped-parent-X rule remain useful evidence. The item
failed because ordinary-work caps contradict required finalization work;
2s reap plus 8s completion leaves no claimed 2s spare; continuous versus
monotonic suspend/rate divergence falsifies the unconditional 60s relation;
and supervisor post-kill waiting is unbounded. The boundary also lacks a
minimum usable budget, explicit native artifact/build/trust chain,
Windows-native exclusion, pre-exec process group and escaped-descendant
policy, inherited-fd binding, descriptor-bound Node exec, and signed approval
content verification. Rejected-options entry 14 preserves the full evidence.

Round 27 retained only the same isolated deadline item and repaired those exact
attributed defects. Its frozen secret-clean digest is
`337eb8cfe09594cedc3ecfc175ed9ee756405c7753d7db1f79642bad467f7ff6`.
Authentic invocation `c6aa91c3-3a97-49a9-95eb-89c8d3b92ec6` was `BLOCKED`
at Codex 24, Opus 74, combined 24 — up 4 from round 26. Opus explicitly
accepted the 76s floor, 2s/6s/2s finalization split, equal-rate conditional
proof, and supervisor-authoritative X under suspend/rate divergence; those are
frozen as retained evidence. Both reviewers failed executable-byte identity:
same-descriptor hash/execute does not prevent in-place changes to an admitted
owner-writable inode. Opus separately established that macOS has no compatible
`fexecve`, and both reviewers required an unambiguous exec-failure protocol.
Pre-fork bounds, result channel, verifier vehicle/deadline, signals/waits,
finalization I/O interruptibility, admission calibration, escaped descendants,
manifest authentication/keying, and release test-seam reachability remain open.
Rejected-options entry 15 preserves the full attribution.

Round 28 isolates only target set and exact top-level artifact-byte consumption,
while leaving round 27's accepted deadline work unchanged. Its frozen
secret-clean digest is
`0c3e72b2c203dc90f368817f0bfcd966a858aba590d78683b6241113ee3c199c`.
Authentic invocation `3e6dcacb-6414-4322-a778-7ad14d780726` was `BLOCKED`
at Codex approve/92 and Opus revise/62, combined 62 — up 38 from round 27.
Codex passed the proposition with no finding. Opus retained the copy/seal/hash
ordering, four-seal no-effective-writer proof, exact sealed-object consumption,
Linux/WSL target narrowing, and deterministic macOS/Windows-native unsupported
mapping. Its operational blocker is Node's default realpath of
`/proc/self/fd/5` to a non-openable memfd display name; module kind is unstated,
and the coordinator's self-check is circularly described. Other Opus findings
remain separately open: MFD_EXEC/noexec detection, errno mapping, setup thread
enforcement, fd collision allocation, WSL2 ARM64 runner availability, ambient
Node preload, memfd process.execPath, memfd terminology, setup trust, and
resource/pre-fork bounds. Rejected-options entry 16 preserves attribution.

Round 29 changes only the coordinator load vehicle and freezes the retained
deadline, sealed-image, and target-set mechanisms. Its frozen secret-clean
digest is
`95210e713755d57566159c0d18e34fbded74c332f4c510995c54b4e144d723af`.
Authentic invocation `ff6ba27e-81dc-4e74-953f-b53e8833ee4e` was `BLOCKED`
at Codex block/97 and Opus revise/62, combined 62 — unchanged from round 28.
Both retain the exact preserve-symlinks-main CommonJS fd-5 vehicle and the
non-circular supervisor-proof/coordinator-diagnostic split. Both independently
found two high defects: ambient `NODE_OPTIONS` can preload code and spoof READY,
and fd slot 5 can be substituted between parent validation and exec. Opus also
found contradictory parent/fork topology, an overstrong READY sentence,
unpinned Node behavior, inert `.cjs` naming rationale, and an unsatisfiable
six-target matrix with no WSL2 ARM64 runner. Rejected-options entry 17 records
the full evidence. MFD_EXEC/errno/setup-trust/pre-fork/result and unrelated
items remain open.

Round 30 isolates the effective Node launch boundary and freezes the retained
deadline, sealed-image, and CommonJS vehicle. Its frozen secret-clean digest is
`d0c259c59e4941a9ddc8ed4110d8b428ebe0fea5bc95564d8b888ef2d2302fb0`.
Authentic invocation `5b05aa74-ee1a-4bbb-9649-b87667d877ed` was `BLOCKED`
at Codex revise/34 and Opus revise/66, combined 34 — down 28 from round 29.
The collision-safe >=64 staging band, exact closed Node environment, pinned
x86-64 GNU target/image, post-placement child validation direction, and
non-authenticating READY calibration remain useful evidence. The proposition
failed because it claimed no fd operations through READY although the dynamic
loader and Node legitimately use descriptors after exec. It also left the
platform TCB unstated, allowed early dup failure to write an arbitrary old fd
7, and omitted exact child-validation failure, RLIMIT staging, numeric close,
single-pass, supervisor-re-gate, and production fault-hook rules. Eight
security findings and four dissents are retained in rejected-options entry 18.

Round 31 changes only those post-exec assurance semantics while preserving the
deadline, sealed image, load vehicle, target set, fd mapping, and closed env.
It limits the trampoline guarantee to final validation through `fexecve`,
qualifies root/kernel/ELF-loader/shared-library configuration as an explicit
platform TCB or maps X, and requires a fail-closed coordinator fd-5 recheck
before exactly one C/EOF and before any descendant. The child now uses a known
staging error endpoint until fd 7 installation, distinct D/V/E records and
exit codes, a 69 minimum RLIMIT floor with deterministic staging X, a numeric
never-close-3-through-7 rule, and exactly one marker-anchored authoritative
pass. Supervisor-byte changes re-gate evidence and test fault hooks are
mechanically absent from production. Its frozen secret-clean digest is
`0de1bc8af5d82d1301b226fb7d50c7b9a4d7c56da1b5f4a81704f222c4107a70`.
The Ubuntu exact-image/TCB/trampoline/timing matrix remains explicitly pending;
authentic invocation `4c615589-ba13-44c7-993c-0fc53337f451` was `BLOCKED` at
Codex block/18 and Opus revise/62, combined 18 — down 16 from round 30. Both
reviewers retained the corrected architecture but found its contract incomplete:
V IDs omitted fd3/fd4 flag and fd7 checks and conflicted with execution order;
zero-byte error EOF success and parent writer closure were unstated; same-UID
ptrace defeated continuity; untracked fds could cross exec; markers were not
compiler barriers; and hwcaps/cache/NSS/gconv/locale/config inputs exceeded the
claimed loader closure. Six security findings and five dissents are retained in
rejected-options entry 19.

Round 32 retains the architecture and isolates a complete exact assurance
contract. Every fd3–7/alias/hash/EOF predicate has a stable ID separate from the
single execution order; V always records/exits 121; zero bytes plus EOF is the
only bootstrap exec-entry success; and the parent closes fd3/fd4/fd7 child-side
copies before any read/wait. `PR_SET_DUMPABLE(0)` plus Yama scope 2/3 denies
unprivileged same-UID ptrace/process_vm/proc-mem mutation, while one
`close_range(8, UINT_MAX, 0)` removes every untracked high fd. The trampoline
is an isolated no-LTO/no-inline TU with memory barriers and build re-gating.
The TCB is narrowed to an enumerated root-host/hwcaps/cache/config closure with
exact pre-READY exclusions. Its frozen secret-clean digest is
`9fd2617b1b46f769394d93e10c603f234111fa94b8f92295003f89b09cf224a8`.
Ubuntu, target closures, attack negatives, disassembly, exact protocol, and
timing evidence remain explicitly `PENDING`; status is `OPEN-UNTESTED` until
authentic invocation `e83342ad-549e-45d0-af90-ac46fd51c129` was `BLOCKED` at
Codex revise/5 and Opus revise/30, combined 5 — down 13 from round 31. The
round's five bundled contract surfaces violated attribution discipline, and
all verification remained pending. Most narrowly, zero-byte nodeExecError EOF
cannot prove exec because pre-exec SIGKILL, premature writer loss, and kernel
point-of-no-return failure produce the same observation. Other confirmed gaps
cover fd0–2 and channel identity/distinctness, fd7-report fallback, missing
failure encodings, signal transition, enforced loader closure, peer surfaces,
MFD_EXEC, provenance and metadata bounds. Ten security findings and six
dissents are preserved in rejected-options entry 20.

Read-only current-runner evidence records WSL2 kernel
`6.18.33.2-microsoft-standard-WSL2`, Yama present at `ptrace_scope=1`, and uid
map `1000 0 1`; no sysctl was changed. Frozen R32 requires Yama 2/3 plus its
initial-namespace predicate, so this runner would fail closed X rather than
establish the admitted lane.

Round 33 isolates only EOF classification. Zero bytes plus EOF now produces
`WRITE_END_RELEASED_UNCONFIRMED`, `execEntered=unknown`, and no acceptance. A
pre-READY exit, fatal signal, or stop maps exact conservative X; a live child
remains unconfirmed within the existing deadline; and only exact READY C plus
the subsequent declared protocol can support coordinator-entry evidence. All
descriptor, V, fd7, signal, TCB, Yama, peer-access, MFD_EXEC, evidence, timing
and unrelated findings remain open without repair. The frozen secret-clean
digest is
`48dfe053a4cdc012bf9d182935bd52039d2a0effeb75952a1c9e34701b4db4eb`.
Authentic invocation `8e177f7b-6139-45fb-97d5-befe1ac1cf38` was `BLOCKED`
at Codex approve/87 and Opus revise/72, combined 72 — up 67 from round 32.
Both reviewers accept the core EOF deletion. Codex passed the item; Opus's
remaining defects are a scheduler-dependent READY/result-versus-terminal
ordering, an unreachable WIFSTOPPED row, missing nodeExecError-no-EOF cells,
unstated X-to-aggregate mapping, stopped-child disposition and audit bounds.
Four security findings and five dissents are retained in rejected-options
entry 21. READY identity/authentication remains open, not attributed to the
accepted EOF correction.

Round 34 changes only supervisor observation ordering. One ppoll/pidfd loop
drains READY, result and fd7 before WEXITED status; a terminal hint receives a
bounded final drain before exact precedence. Buffered valid C/result is honored
regardless of scheduler order. fd7 EOF is optional telemetry, with no-EOF plus
valid protocol and no-EOF without protocol both covered. Stops are not queried;
deadline cleanup kills/reaps. Every unconfirmed X maps `FAILED`/1, and audit
fields are closed enums/bounded integers. The frozen secret-clean digest is
`4057467525b3af9441faa93e1daac34fdbc77d47ac612e7df2c877f0c3657c54`.
Authentic invocation `f3f501df-52bb-4e12-8c5d-edf35eee30a2` was `BLOCKED`
at Codex revise/12 and Opus revise/46, combined 12 — down 60 from round 33.
Both retain drain-before-terminal but reject the exact mechanism: ordinary
partial-at-EAGAIN contradicts chunk assembly; terminator stopping misses queued
duplicates; EOF/pidfd remain level-triggered; the final drain can exceed the
absolute deadline; C-only, error classes, live-child disposition, close points
and progress counting are incomplete. The final drain also widens acceptance
for unauthenticated post-death writers. Five security findings and five dissents
are preserved in rejected-options entry 22.

Round 35 corrects only those ordering mechanics. EAGAIN partials stay PENDING;
all queued bytes after terminators are drained; READY/result require EOF sealing;
EOF and terminal latches leave ppoll and close exactly once; the final bound is
the minimum of supervisor absolute, terminal+2s and absolute reap. Syscall versus
protocol failures are disjoint, C-only is named FAILED, and live children have a
default bounded kill/reap. Progress—not wakes—advances a proven-bounded counter.
Post-terminal bytes are diagnostic-only, the widened death-to-latch interval is
audited, and an unresolved channel-auth predicate gates even pre-latch affirmative
protocol. Real pipe/pidfd chunk fixtures are required. Its frozen secret-clean
digest is `5ccab1239becccf5f5834cca2320f2b47c13e64330dd5d399f6331fcd1680ff1`.
Authentic invocation `b440f431-9bfe-47fe-8509-041f47b6ab76` was `BLOCKED`
at Codex revise/28 and Opus revise/24, combined 24 — up 12 from round 34.
The mechanism improves ordinary chunk handling but remains writer-unbounded:
clock and cap are checked only after a drain, so a continuously nonempty pipe
can defeat every absolute bound. Deadline-edge bytes can still become
affirmative; exact-capacity overflow/EOF lacks a safe probe; positive/zero reads
conflict with the error wording; and the progress bound is unproved. Opus also
retains precedence, reap-reserve, producer EOF, inherited writer, abnormal-death
and pidfd fallback defects. Six security findings and five dissents are preserved
in rejected-options entry 23.

Round 36 isolates only one per-channel primitive. `boundedDrainV1` checks the
absolute cutoff before and after every nonblocking read, excludes an entire
crossing/late chunk from affirmative state, advances no more than C decision
bytes, and uses a separate one-byte C+1 probe to distinguish exact-capacity EOF,
open/EAGAIN and overflow without an out-of-bounds write. Positive read, EOF,
EAGAIN/EWOULDBLOCK, EINTR and true errors have disjoint outcomes; continuous-
writer, slow-crossing, exact-capacity and deadline fixtures use real pipes. Its
frozen secret-clean digest is
`d789fdac528d116ae1d324e0d13e70bdec74c911b8fd49862bf508ff25d1884b`.
Authentic invocation `42c38263-111d-4fe9-b9bd-23a20297cab9` was `BLOCKED`
at Codex revise/82 and Opus revise/57, combined 57 — up 33 from round 35.
Both reviewers retain the before/after cutoff checks, equality-is-late rule,
separate one-byte overflow probe, and disjoint read-result direction. The
primitive still fails because `fixedScratchMax` is not a declared positive
input, late bytes are read into decision storage before eligibility is known,
discarded bytes do not make the channel permanently non-affirmative on later
invocation, `decisionLength` and clock history lack a callable in/out contract,
the EAGAIN clock-failure path is incomplete, and EINTR has no finite retry
ceiling. Five current security findings and five dissents are preserved in
rejected-options entry 24. All cross-channel, precedence, authentication, reap,
pidfd, producer, progress and unrelated findings remain open. Per the round-36
synthesis, the next local artifact is a consolidated round-37 implementation
design, not another isolated patch to this primitive.

Round 37 replaces the native supervisor/memfd/pidfd/pipe design with a
setup-owned JavaScript coordinator, per-check process groups, private result
files, and one public result emission. Its frozen secret-clean digest is
`2c52720a3b2728dbaeeb02b04eb98dbb391a02cd4e7c7989075d745ebf499181`.
Authentic invocation `e0fd2864-6a1a-4487-ae5c-96ed3256bb03` was `BLOCKED`
at Codex revise/32 and Opus revise/63, combined 32 — down 25 from round 36.
Both reviewers retain the structural simplification, setup ownership, manual
recovery posture, diagnostic-only claim, root/surface split, and closed-
environment direction. The packet is not implementable as written: nested GNU
`timeout` commands do not give the coordinator the child process-group control
it claims, and the legal sequential child budgets can exceed the 118-second
phase bound. Private staging and durable HC3 publication, exact result/HC3
schemas, timeout-status disambiguation, Codex invocation and JSON semantics,
HC3 lifecycle and canonicalization, lock identity, installed-path trust,
HC4-HC12 evidence, and safe-import enforcement also remain incomplete. Seven
security findings and six dissents are preserved in rejected-options entry 25.
The next local artifact returns to one bounded mechanism: direct child process-
group ownership and termination, leaving phase-budget arithmetic, result/HC3
publication, schemas, Codex semantics, lock/path trust, and HC4-HC12 evidence
for separate later rounds. Full-plan integration occurs only after those items
are individually stable. Another exported review requires payload-specific
approval.

## Accepted endpoint and bug closure — rounds 38–56

Rounds 38–56 continued the required one-mechanism-at-a-time redesign. The
native-supervisor and retained-descriptor branches were rejected rather than
carried forward. The retained direction is the substantially simpler
session-leader-by-construction topology plus a byte-oriented
`/proc/self/stat` bootstrap assertion. Historical reviewer envelopes remain
under `.kstack/reviews/post-deploy-health-check-2026-08-24-round38/` through
`round56/` and are not rewritten here.

Round 55 approved the final-`)` delimiter at Codex 94 / Opus 87, combined 87,
with precision questions. Round 56 pinned the byte predicates and reached
Codex 98 / Opus 74, combined **74**, satisfying the owner's final minimum of
72. No further score-improvement round is authorized.

The confirmed opener totality defects, reviewer premise about stat escaping,
runtime fixture contract, raw-output dependency, and suffix-validation
dependency are dispositioned in
`post-deploy-health-check-2026-08-26-round56-bug-closure.md`. That addendum is
the normative correction to the accepted endpoint. It preserves the reviewed
delimiter and does not revive any rejected native/descriptor mechanism.
