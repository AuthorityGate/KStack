# Round-one clarification: broader planning lenses

Status: LOCKED

- Thread ID: `broader-planning-lenses-2026-08-24`
- Objective ID: `broader-planning-lenses-2026-08-24`
- Round-one invocation ID: `2b50ac83-5db5-4031-b965-838be367650c`
- Design digest: `6c92a02ce6d85b445d79440fd55f74b1f9b6c7796dd87d8a467703f7ea0ea991`
- Confirmation date: `2026-08-24`
- Owner: Kevin

## Extraction method

A dedicated extraction pass was performed per `kstack-design-clarify`. The pass
read the complete objective, the exact round-one decision brief, both structured
reviewer envelopes, both retained raw reviewer reports, deterministic checks,
the gate result, the manifest, and the coordinating synthesis. It accounted for
reviewer disagreement, hedging, unsupported assumptions, unresolved questions,
and scope divergence, then compared every material proposal against the
objective's actors, promised outcome, deliverables, constraints, and non-goals.

The resulting traceability ledger was cross-verified in both directions against
`synthesis.md`'s own consolidated unresolved-questions list, Q1-Q14. No gaps
were found. The coordinating questionnaire used two rounds of one to three
decision prompts: round one covered Q1, Q2, and Q3; round two covered Q5, Q10,
and bundled Q8/Q9. Those six FORK-BLOCKING decision prompts cover seven stable
question IDs because Q8 and Q9 were deliberately answered together. The
supplied deferred-ID list contains Q4, Q6, Q7, Q11, Q12, Q13, and Q14. This
stable-ID accounting covers Q1-Q14 exactly and does not invent an additional
question to reconcile the session shorthand “6 decisions plus 8 deferred
items.”

## Complete source inventory

The SHA-256 values below were computed from the actual on-disk bytes on
2026-08-24. The design digest independently reproduces the SHA-256 of the exact
round-one decision brief.

| Source path | Role | SHA-256 |
|---|---|---|
| `.kstack/objectives/broader-planning-lenses-2026-08-24.md` | Objective brief | `9fd30d83d396bb6db474097cb067b7c228617aac72536f052d0653d75900dddc` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md` | Exact reviewed round-one design brief | `6c92a02ce6d85b445d79440fd55f74b1f9b6c7796dd87d8a467703f7ea0ea991` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md` | Coordinating round-one synthesis and consolidated Q1-Q14 list | `89eca082c69a588ea5076c3edea8737d8707e2970363a25b0306a8277bf069ec` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.md` | Retained raw Codex report | `1de9fb8cc8a26b4514da0e47d6fb13131e09f68f4cd7da9298cb42387346b0fa` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.md` | Retained raw Opus report | `7c93324fb4d4e46b496ffdc5b84b8e71e7367f3ebdbfd7e16688ee00c8d83947` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json` | Structured Codex reviewer envelope | `b76088210f9e984f69dd7dcb6cfe70a78abbe531eb8ea2ffb13ad79507427940` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json` | Structured Opus reviewer envelope | `2a640f94744861868c46f0f0d850e331795260e431a9e5c284777b8edb96efe0` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/checks.json` | Deterministic round-one checks | `2e3396573878c35937bdc98da84eba9d9677daed65aeb3626ad2e5eb363331b5` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/gate.json` | Round-one gate result | `f3b4f9acdf1f44790fab5b859243ca8ff14e678c2f5dd5bbd382b70593485a7d` |
| `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/manifest.json` | Invocation and design-digest authority | `996063bdbb62f087e463009287e217090f271a5bda390caa354b137b567566a8` |

## Scope-alignment check

Result: **aligned; no untraced proposal found**.

Every material round-one proposal traces to the objective's requested comparison
of no-change, opt-in, conditional, and always-on shapes; its candidate-gap
analysis; its requirement for explicit, proportionate selection; or its stated
compatibility, cost, falsification, authority, and unchanged-review-mechanics
constraints. The proposed strategy and developer-experience lenses, Options
A-D, the missing strengthen-existing-lanes alternative, selection/audit
mechanics, evidence program, and safety controls all have objective or observed
repository-evidence traces. No new actor, subsystem, dependency, role, trust
boundary, or operational obligation lacked such a trace. The strategy-premise
authority conflict was not normalized as scope expansion; it is resolved by Q10.

## Question dispositions

### Q1 — Candidate scope (scope)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Material dissent preserved” items 1-2 and “Consolidated unresolved questions” Q1; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.recommendation`, `review.materialDissent` item 2, and `review.unresolvedQuestions` item 3; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.recommendation` item 2, `review.materialDissent` item 1, and `review.unresolvedQuestions` item 6; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Candidate lens definitions” and “Verification plan and decision-changing evidence.”
- **Direct question:** Should round 2 evaluate DX only and defer strategy, as Opus recommended, or evaluate strategy independently alongside DX and strengthened product/UX, as Codex recommended?
- **User-stated answer:** Kevin chose the broader Codex position: evaluate developer experience, strategy, and strengthened product/UX in parallel.
- **Accepted consequence:** Round 2 must scope and compare all three candidates, not only DX. It may not defer strategy merely because its overlap with product is greater.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### Q2 — Missing alternative (missing option)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Substantive agreement” item 3 and consolidated Q2; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.failedChecks` item 4 and `review.unresolvedQuestions` item 3; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` item 1 and `review.recommendation` item 1; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Unresolved questions for independent review” items 1 and 6.
- **Direct question:** Should round 2 formally add and cost “strengthen the existing product and UX lane wording alone” as an alternative to a separate planning-lens mechanism?
- **User-stated answer:** Yes. Kevin directed that it be added as formal **Option E** and evaluated against the other options in round 2.
- **Accepted consequence:** Round 2's option set is incomplete unless Option E receives the same explicit cost, failure-mode, reversibility, evidence, and comparison treatment as the other options.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### Q3 — Evaluation method

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Material dissent preserved” item 1 and consolidated Q3; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.recommendation` and `review.unresolvedQuestions` item 1; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` item 3, `review.materialDissent` item 2, and `review.unresolvedQuestions` item 5; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Verification plan and decision-changing evidence.”
- **Direct question:** Must a blinded representative corpus with human adjudication precede any shipped change, as Codex recommended, or is Opus's bounded live trial proportionate for a reversible, default-off, content-only change?
- **User-stated answer:** Kevin required the higher-rigor Codex position: blinded corpus plus human adjudication before any change ships.
- **Accepted consequence:** Round 2 must define this evaluation as a pre-shipment requirement. A live experiment permitted by Q5 is evaluation-only and does not waive the blinded-corpus or human-adjudication prerequisite for shipping a change.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### Q4 — Adoption thresholds (numeric adoption thresholds)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, consolidated Q4; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.failedChecks` item 2 and `review.unresolvedQuestions` item 2; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` items 2-3; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Verification plan and decision-changing evidence.”
- **Direct question:** What numeric thresholds or stop rules govern incremental material findings, duplicate and false-positive rates, selection errors, base-lane regression, author time, prompt growth, and provider duration?
- **User-stated answer:** No threshold values were chosen. Kevin confirmed this item may be resolved in round 2 without further owner input at this gate.
- **Accepted consequence:** Round 2 must propose and justify executable thresholds and stop rules; this record supplies none.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### Q5 — Interim policy

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, consolidated Q5; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` item 8, `review.recommendation`, and `review.unresolvedQuestions` item 5; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, Options A-B and “Operations lane.”
- **Direct question:** During evaluation, must the current six-lane behavior remain the sole operative behavior, or may a default-off experimental lens run live on named objectives?
- **User-stated answer:** A default-off experimental lens may run live, opt-in, only on objectives Kevin specifically names during the evaluation window. Every other objective remains on the current six lanes unchanged.
- **Accepted consequence:** Experimental use requires Kevin's objective-specific naming and remains non-default evaluation activity. It creates no general production behavior and changes nothing for unnamed objectives.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### Q6 — Selection representation (selection representation format)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, consolidated Q6; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.failedChecks` item 3 and `review.unresolvedQuestions` item 4; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` item 4 and `review.unresolvedQuestions` item 3; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, Option B, “Data lane,” and “Verification plan and decision-changing evidence.”
- **Direct question:** May KStack add validated structured front matter or another machine-readable selection block, or must objective artifacts remain free-form Markdown?
- **User-stated answer:** No representation format was selected. Kevin confirmed this item may be resolved in round 2 without further owner input at this gate.
- **Accepted consequence:** Round 2 must select and justify a representation that can support the promised validation and reproducibility; this record does not prefer front matter, another block, or free-form Markdown.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### Q7 — Immutable audit location (audit-record location)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Primary-artifact resolutions” item 2 and consolidated Q7; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.unresolvedQuestions` item 4; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.securityFindings` ID `lens-suppression-without-second-party`; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Observed KStack behavior” item 5 and “Data lane.”
- **Direct question:** Must every applied and skipped selection be copied into the digest-bound decision brief, is an objective-only record sufficient, or is a manifest field also desired?
- **User-stated answer:** No audit-record location was selected. Kevin confirmed this item may be resolved in round 2 without further owner input at this gate.
- **Accepted consequence:** Round 2 must define the immutable audit location while recognizing that the existing design digest already binds decision-brief content; this record does not require a new gate algorithm or manifest field.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### Q8 — Override authority

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, consolidated Q8; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.unresolvedQuestions` item 5; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.securityFindings` ID `lens-suppression-without-second-party`; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, Option C and “Security lane and threat model.”
- **Direct question:** Who may suppress or skip a lens, what evidence is recorded, and must a second party approve the override?
- **User-stated answer:** No lens may be suppressed by a single party. A second-party approval is required, and the override must be audited, mirroring KStack's existing dual-review independence norms.
- **Accepted consequence:** Any round-2 override design must prevent unilateral suppression and preserve auditable evidence of both the override and the independent second-party approval. This does not change reviewer independence or create authority for a model.
- **Disposition:** Owner-decided as part of the bundled Q8/Q9 FORK-BLOCKING decision; resolved.

### Q9 — External provenance

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, consolidated Q9; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.securityFindings` ID `untrusted-objective-metadata-drives-selection` and `review.unresolvedQuestions` item 8; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, Option C and “Security lane and threat model.”
- **Direct question:** May lens selection ever be driven by externally authored content such as Jira ticket text, and, if so, under what provenance and attestation rules?
- **User-stated answer:** Lens selection may only ever be driven by KStack-owned, human-authored input. Externally authored content must never drive lens selection.
- **Accepted consequence:** Jira text and other externally authored content may not select, suppress, or otherwise determine a lens. Round 2 must preserve a KStack-owned, human-authored selection boundary rather than adding an attestation path for external content.
- **Disposition:** Owner-decided as part of the bundled Q8/Q9 FORK-BLOCKING decision; resolved.

### Q10 — Strategy authority (strategy-lens authority)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Primary-artifact resolutions” item 4 and consolidated Q10; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` item 5 and `review.unresolvedQuestions` item 2; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “strategy candidate” and “Failure modes across options” item 4.
- **Direct question:** If a strategy lens concludes that the owner-fixed objective premise is wrong, should it merely record the concern, escalate to the owner, silently block, or proceed?
- **User-stated answer:** Escalate to the owner before the design proceeds. The process must never silently block and must never silently proceed past a strategy-lens objection to the objective's premise.
- **Accepted consequence:** Round 2 must define an explicit owner-escalation state that pauses design progress until the owner disposes of the premise objection. The lens remains advisory and cannot itself rewrite, supersede, approve, or reject the objective.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### Q11 — Applicability trigger (material-decision-trigger inheritance)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Primary-artifact resolutions” item 1 and consolidated Q11; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` item 6 and `review.unresolvedQuestions` item 1; `.kstack/objectives/broader-planning-lenses-2026-08-24.md`, “Constraints”; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Constraints and authority boundaries.”
- **Direct question:** Do optional lenses inherit KStack's configured material-decision rule before applying a lens-specific test, or do they use a separate trigger?
- **User-stated answer:** No inheritance or separate-trigger choice was made. Kevin confirmed this item may be resolved in round 2 without further owner input at this gate.
- **Accepted consequence:** Round 2 must define the applicability relationship to the already-known material-decision rule; the rule's existence is settled, but its inheritance is not.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### Q12 — Prompt budget (prompt/byte budget)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Primary-artifact resolutions” item 3 and consolidated Q12; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.failedChecks` item 7, `review.securityFindings` ID `prompt-growth-degrades-base-lane-review`, and `review.unresolvedQuestions` item 4; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Security lane and threat model” and “Verification plan and decision-changing evidence.”
- **Direct question:** What maximum bytes, tokens, section count, or share of a brief may one optional lens consume, and what comparative baseline governs rejection for base-lane dilution?
- **User-stated answer:** No prompt or byte budget was chosen. Kevin confirmed this item may be resolved in round 2 without further owner input at this gate.
- **Accepted consequence:** Round 2 must define a measurable budget and comparative baseline; the observed round-one size and provider durations are measurements, not a six-lane control or owner-selected limit.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### Q13 — Catalog boundary (closed-catalog-only)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, consolidated Q13; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.recommendation`; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.securityFindings` ID `lens-text-non-authority-clause-unbound` and `review.unresolvedQuestions` item 7; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, “Security lane and threat model” and “Unresolved questions for independent review” item 5.
- **Direct question:** If a lens ships, must v1 use only a closed catalog of KStack-owned IDs and prohibit project-supplied lens content or file paths?
- **User-stated answer:** No final owner decision was made. Kevin confirmed this near-consensus item may be resolved in round 2 without further owner input at this gate.
- **Accepted consequence:** Round 2 may carry the reviewers' near-consensus closed-catalog position into the design, but must identify it as round-two design reasoning rather than an owner mandate from this record.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### Q14 — Option C horizon (Option C's disposition)

- **Source pointers:** `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/synthesis.md`, “Material dissent preserved” item 3 and consolidated Q14; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/codex.json`, `review.recommendation`; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/opus.json`, `review.materialDissent` item 4 and `review.recommendation` item 3; `.kstack/reviews/broader-planning-lenses-2026-08-24-round1/decision-brief.md`, Option C and “Verification plan and decision-changing evidence.”
- **Direct question:** Should deterministic automatic selection be ruled out for v1 only, or retained as a later option contingent on demonstrated explicit-selection misses?
- **User-stated answer:** Kevin made no separate Option C horizon decision and confirmed that its round-two disposition follows from the resolved Q1 candidate scope and Q3 evaluation method.
- **Accepted consequence:** Round 2 must evaluate or dispose of Option C consistently with the three-candidate scope and pre-shipment evidence requirement, without treating either reviewer's round-one preference as an owner decision.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

## Unresolved items

None.

All Q1-Q14 items have a locked disposition. A disposition of “deferred to round
2, not owner-decided, no FORK-BLOCKING gate applies” is authoritative permission
for round 2 to resolve that design detail without reopening this clarification
gate; it is not a substantive owner answer to the deferred question.

## Final confirmation

On 2026-08-24, Kevin explicitly confirmed that the complete read-back of all six
FORK-BLOCKING decisions—including the bundled Q8/Q9 answer—and every supplied
deferred item was accurate and complete as the authoritative record. Kevin
approved locking the record exactly as summarized here.

## Migration and supersession

- Migration limitation: none.
- Earlier clarification record superseded: none.
- This is the first locked round-one clarification record for this thread and
  invocation.
