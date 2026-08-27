# Round 1 clarification: arbitrary-persona virtual engineering panels

Status: LOCKED

- Thread ID: `virtual-engineering-team-2026-08-24`
- Objective ID: `virtual-engineering-team-2026-08-24`
- Objective path: `.kstack/objectives/virtual-engineering-team-2026-08-24.md`
- Round-one invocation ID: `6a21f225-9ecb-4be3-8133-cd4bfe41d7dd`
- Round-one design digest: `963ab46012d5a0b174a46f38a0ef846bf125dcec03db7e21857e5fbc635e763b`
- Clarification result: `ROUND_ONE_CLARIFICATION_LOCKED`
- Confirmation date: `2026-08-24`

## Source paths and SHA-256 digests

The following SHA-256 values were computed directly from the inspected file
bytes with `sha256sum`; they are not inferred or fabricated. The manifest's
design digest exactly matches the independently computed digest of the frozen
round-one decision brief.

| Source | SHA-256 |
|---|---|
| `.kstack/objectives/virtual-engineering-team-2026-08-24.md` | `209c1bb27e69d7d2fb43b8cda5cc9702205f36ea5c7a8c97f6dd45a25e9cb0c5` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/decision-brief.md` | `963ab46012d5a0b174a46f38a0ef846bf125dcec03db7e21857e5fbc635e763b` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/codex.md` | `8780802ec2d5eccaa9909b7bfe0290ae4d3a754cedc699c6eb76e806c0a90b69` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/codex.json` | `8fa0207b4e321ed17668a75aefcea284887e7249d2fdb510847759a5008e77d1` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/opus.md` | `e9cbe632d3751d033048b8cf6a8e8e042a6c564f390d6663d1203efc7965f5a7` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/opus.json` | `0e408efc1116ed764b0d16e8a2265ed7d33833d3e73dbe4ba414503a1ffb0345` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/synthesis.md` | `6a5ac729746c8aed5522133609fb4ba2f9f9bb32ef68a44c47151abe0da29c2f` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/manifest.json` | `745fde992c83372b8756af84e422fc0935e3b4c29ffd4a663ebd5432f2eb8c1a` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/checks.json` | `2f753d51ae8c87f75084eb136a39bbdfc3f6cb5137474a87015679b593558a2e` |
| `.kstack/reviews/virtual-engineering-team-2026-08-24-round1/gate.json` | `d82e761f67757c44819d77c7968952e471b0dd81bfe31f147721303cd0b64bae` |

## Extraction method and complete source inventory

A dedicated extraction pass was performed as required by
`kstack-design-clarify`. It was a traceability and completeness pass, not a
third design opinion and not a new design round. The pass read the complete
objective, the frozen neutral decision brief, both retained raw reviewer
reports, both structured reviewer envelopes, and the present round-one
synthesis. It also inspected the manifest, deterministic checks, and gate to
verify invocation, digest, completion, and gate bindings.

The pass extracted every disagreement, materially different recommendation,
hedge, assumption, qualification, missing specification, unresolved question,
security finding, and scope divergence. It then checked in the other direction
that every material proposal in the decision brief traces to an objective
clause or an observed repository need. The consolidated Q1-Q22 ledger in
`synthesis.md` was treated as an index, not as proof of completeness.

Cross-verification found:

- `codex.md` and `codex.json` agree on `revise`, confidence `28`, 7 failed
  checks, 5 security findings, 5 material-dissent items, and 10 unresolved
  questions;
- `opus.md` and `opus.json` agree on `revise`, confidence `37`, 9 failed
  checks, 5 security findings, 3 material-dissent items, and 12 unresolved
  questions;
- `synthesis.md` preserves both reviewers' tallies, agreements, emphasis
  differences, primary-artifact resolutions, and the consolidated Q1-Q22
  ledger; and
- `manifest.json` is `dual-complete`, while `gate.json` is `BLOCKED` and
  preserves the expected combined 10 security findings and 8 material-dissent
  items.

No extraction gaps were found.

Complete source inventory and purpose:

1. Objective brief — owner outcome, actors, constraints, success evidence,
   eight required design decisions, non-goals, and open assumptions.
2. Round-one decision brief — neutral mechanisms, proposed invariants,
   threat model, design lanes, verification, rollback, and reviewer questions.
3. Codex raw report and structured envelope — exact Codex review and its
   machine-bound representation.
4. Opus raw report and structured envelope — exact Opus review and its
   machine-bound representation.
5. Round-one synthesis — reviewer comparison, primary-artifact checks,
   consolidated Q1-Q22 ledger, and central N-party finding.
6. Manifest — round-one invocation ID, design digest, provider completion, and
   raw/configuration bindings.
7. Deterministic checks — objective/design/threat/rollback/verification and
   artifact-secret-scan evidence.
8. Gate — the digest-bound blocked result and combined reviewer tallies.

`synthesis.md` is present, so no fallback to the envelopes alone was needed.

## Scope-alignment check

Result: **PASS — all eight Required design decisions in the objective map into
the ledger, and no untraced material proposal was found.**

| Objective required design decision | Ledger trace |
|---|---|
| 1. Whole-panel barriers versus issue-ledger subrounds | Q4, Q13 |
| 2. Acceptance, abstention, missing evidence, and recommendations | Q1, Q2, Q3, Q12 |
| 3. Persona-to-backend mapping | Q5, Q6 |
| 4. Fable voting/mediation role and independence claim | Q6, Q8 |
| 5. Mediation, owner value routing, incomplete output, liveness, and ceilings | FRAME-0, Q8, Q9, Q10, Q11 |
| 6. Candidate authorship and minority-objection preservation | Q7, Q14, Q20 |
| 7. Specification, lineage, bindings, retention, redaction, and compatibility | Q5, Q12-Q19, Q22 |
| 8. Adapters, checks, evaluation, rollout, cost, rollback, and migration evidence | Q10, Q14, Q19-Q22 |

The actors, promised outcome, deliverables, constraints, non-goals, proposed
subsystems, dependencies, roles, trust boundaries, and operational obligations
were compared bidirectionally. Every material addition is represented by a
ledger item; no silently normalized scope expansion remains.

## Questionnaire session and authoritative dispositions

Kevin received the full consolidated ledger in four coherent owner-question
rounds. `FRAME-0` was asked first because it captures round 1's most
consequential architectural finding. Ten distinct owner decisions resulted.
Q11 is explicitly subsumed by `FRAME-0`, and Q1 is explicitly subsumed by Q2;
those folds preserve every Q1-Q22 label without pretending that Kevin made
separate duplicate decisions. The 11 reviewer-aligned items listed later were
disposed to round 2 without owner input.

### Owner-question round 1

#### FRAME-0 — convergence promise

- **Category:** scope alignment, product contract, and N-party liveness.
- **Source pointers:** objective, “Problem and affected users,” “Owner-scoped
  outcome and measurable success evidence,” and “Constraints and authority
  boundaries”; decision brief, “Arbitration and bounded-stop options” and
  “Common stop-state contract”; synthesis, “Primary-artifact resolutions” item
  7 and “Round-one finding on N-party generalization”; Opus envelope,
  `review.strongestObjection`.
- **Direct question:** Round 1 found that N-party unanimity has no termination
  guarantee analogous to the existing two-party Fable-mediated convergence
  shape. Is the authoritative promise guaranteed eventual completion, or the
  honest bounded promise: “forced participation and unanimous completion when
  achieved; bounded mediation and complete dissent when not”?
- **User-stated answer:** Bounded mediation, with no guaranteed completion. If
  bounded mediation is exhausted without convergence, the process stops and
  produces a distinct exportable `INCOMPLETE_WITH_DISSENT` deliverable: the
  furthest-along draft plus every persona's recorded objection. It is not a
  completed unanimous document.
- **Accepted consequence:** This thread's core promise is explicitly weaker
  than Kevin's original phrasing implied. That gap is now an explicit,
  owner-confirmed design decision, not a silently absorbed limitation.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING uncertainty
  cleared. This decision also disposes Q11.

#### Q11 — stop/export semantics (subsumed by FRAME-0)

- **Category:** terminal-state and export semantics.
- **Source pointers:** synthesis, “Consolidated unresolved questions,” Q11;
  decision brief, “Non-terminal comparator,” “Common stop-state contract,” and
  reviewer question 8.
- **Direct question:** Is `PANEL_STALLED` with the candidate and full dissent
  sufficient, or must the product export a distinctly named
  `INCOMPLETE_WITH_DISSENT` deliverable that cannot be mistaken for
  convergence?
- **User-stated answer:** Answered as part of `FRAME-0`: export the distinct
  `INCOMPLETE_WITH_DISSENT` deliverable containing the furthest-along draft and
  every persona's recorded objection; do not call it completed or unanimous.
- **Accepted consequence:** Round 2 must model and present this as a distinct
  non-complete terminal/export class.
- **Disposition:** `RESOLVED BY FRAME-0 — OWNER-DECIDED`; no independent
  decision count.

#### Q17 — tamper model [SECURITY]

- **Category:** security and trust model.
- **Source pointers:** synthesis, “Material dissent and emphasis differences
  preserved” item 1, “Primary-artifact resolutions” item 5, and Q17; decision
  brief, threat-model row “Ballot/manifest tampering”; Codex envelope,
  `review.securityFindings[0]`; Opus envelope, `review.failedChecks[8]` and
  `review.unresolvedQuestions[8]`.
- **Direct question:** Is cooperative, project-local reproducibility and
  stale/casual-tamper detection sufficient, accepting that a malicious local
  operator can rewrite or delete the full history, or is adversarial
  cryptographic authenticity required in this thread?
- **User-stated answer:** Cooperative/local only. No signing, attestation, PKI,
  TPM, or equivalent work is in this thread's scope. Real adversarial
  cryptographic authenticity would be a separate future objective.
- **Accepted consequence:** The design must state the limitation honestly and
  may use local digest/schema/lineage checks for reproducibility and stale or
  casual-tamper detection only. This explicitly avoids the storage-hardening
  drift pattern that consumed 23 rounds on the expert-persona-library thread.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING security choice
  cleared.

#### Q20 — v1 scope exclusions

- **Category:** v1 product scope.
- **Source pointers:** synthesis, “Substantive agreement” item 10 and Q20;
  decision brief, “Panel identity and immutability,” “Product lane,” and
  reviewer question 9; Codex envelope, `review.recommendation`; Opus envelope,
  `review.unresolvedQuestions[9]` and `[10]`.
- **Direct question:** Should v1 exclude non-voting advisers,
  replica/duplicate personas, fractional confidence thresholds, cloud-hosted
  artifacts, automatic backend selection, rotating authorship, parallel
  proposal synthesis, targeted sub-rounds, and direct code mutation?
- **User-stated answer:** Confirm every proposed exclusion except non-voting
  advisers. Keep non-voting advisers in v1: an adviser may comment or critique
  but casts no blocking vote.
- **Accepted consequence:** Round 2 must design a non-voting adviser role
  alongside the voting persona roster, with schema and presentation that keep
  advisers out of every unanimity claim. Replica/duplicate personas,
  fractional thresholds, cloud-hosted artifacts, automatic backend selection,
  rotating authorship, parallel proposal synthesis, targeted sub-rounds, and
  direct code mutation remain excluded from v1.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; the adviser inclusion and the
  accompanying exclusion list are one combined decision.

### Owner-question round 2

#### Q1 — ordinary acceptance (subsumed by Q2)

- **Category:** acceptance predicate.
- **Source pointers:** synthesis, “Substantive agreement” item 2 and Q1;
  decision brief, “Confidence and acceptance semantics”; Codex envelope,
  `review.materialDissent[0]` and `review.unresolvedQuestions[0]`; Opus
  envelope, `review.materialDissent[0]`.
- **Direct question:** Must v1 require a clean-accept verdict, threshold
  confidence, zero blocking findings/material dissent, and zero required
  unanswered questions, or is confidence alone the completion source of truth?
- **User-stated answer:** Answered as part of Q2: there is no separate
  blocking/advisory severity classification; a persona's confidence relative
  to its threshold is the single source of truth.
- **Accepted consequence:** No independent clean-acceptance gate is added. Any
  issue that lowers a required persona below threshold blocks; an issue does
  not acquire separate blocking force from another severity label.
- **Disposition:** `RESOLVED BY Q2 — OWNER-DECIDED`; no independent decision
  count.

#### Q2 — blocker taxonomy and liveness

- **Category:** acceptance, blocker classification, and liveness.
- **Source pointers:** synthesis, Q2 and “Round-one finding on N-party
  generalization”; decision brief, “Confidence and acceptance semantics” and
  Option A “Failure modes”; Codex envelope,
  `review.unresolvedQuestions[1]`; Opus envelope,
  `review.strongestObjection` and `review.unresolvedQuestions[0]`.
- **Direct question:** What makes a later persona objection blocking, forcing
  another round, rather than advisory?
- **User-stated answer:** Any confidence-affecting objection is blocking. There
  is no separate blocking/advisory severity classification scheme. If a
  persona's confidence is below its threshold for any reason, completion is
  blocked, matching the existing design-gate philosophy that confidence is
  the single source of truth.
- **Accepted consequence:** Round 2 must express liveness and completion in
  terms of each required persona's threshold result, not a second severity
  taxonomy. This same decision disposes Q1's alternative acceptance-predicate
  question.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING choice cleared.

#### Q3 — threshold domain

- **Category:** configuration and numeric semantics.
- **Source pointers:** synthesis, “Material dissent and emphasis differences
  preserved” item 5 and Q3; decision brief, “Configuration and artifact
  alternatives”; Opus envelope, `review.failedChecks[7]` and
  `review.unresolvedQuestions[10]`.
- **Direct question:** Is integer 1-100 sufficient, including the owner's 88
  example, or are zero and/or fractional values required?
- **User-stated answer:** Integer 1-100, the same scale as
  `workflow.designGate.minimumConfidence`; no new scale.
- **Accepted consequence:** Zero and fractional thresholds are invalid for
  this v1 panel schema; the existing design-gate field is not repurposed or
  relaxed.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING choice cleared.

#### Q6 — Fable's role

- **Category:** backend mapping, mediation, and independence.
- **Source pointers:** synthesis, “Substantive agreement” item 5 and Q6;
  decision brief, mapping Options 1-3 and “Arbitration Option 1”; Codex
  envelope, `review.unresolvedQuestions[5]`; Opus envelope,
  `review.materialDissent[2]`.
- **Direct question:** Is Fable strictly a reserved non-voting mediator, or may
  it also serve as a regular voting persona backend?
- **User-stated answer:** Mediator only, never a voting persona, consistent
  with Fable's standing role everywhere else in KStack.
- **Accepted consequence:** Round 2 must reserve Fable from the voting roster;
  it cannot contribute a required ballot or be marketed as an independent
  panel voice.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING choice cleared.

### Owner-question round 3

#### Q8 — mediator authority

- **Category:** mediation authority.
- **Source pointers:** synthesis, “Material dissent and emphasis differences
  preserved” item 3 and Q8; decision brief, “Arbitration Option 1”; Codex
  envelope, `review.materialDissent[3]` and `review.unresolvedQuestions[7]`.
- **Direct question:** How binding is a Fable mediation directive?
- **User-stated answer:** It is binding on the next authoring attempt only,
  identical to how Fable's ruling works in the existing two-party design-review
  mechanism. It is not a permanent lock and does not override the roster or
  threshold beyond that one round.
- **Accepted consequence:** The mediator may constrain one next authoring
  attempt only; it cannot alter scores, roster, threshold, authority, or
  terminal status, and the resulting candidate still requires panel review.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING authority choice
  cleared.

#### Q9 — value versus fact routing

- **Category:** mediation and owner governance.
- **Source pointers:** synthesis, “Substantive agreement” item 7 and Q9;
  decision brief, “Arbitration Option 2”; Codex and Opus envelope
  recommendations.
- **Direct question:** Must factual/technical disputes go to mediation while
  brand voice, legal posture, scope, risk tolerance, and other value/policy
  conflicts always escalate to the owner?
- **User-stated answer:** Confirmed. Mediation only ever resolves factual or
  technical disagreement. Every values/policy conflict routes directly to
  Kevin and is never decided by a model.
- **Accepted consequence:** Round 2 must define a direct owner route for every
  values/policy conflict and must not grant Fable or any other model authority
  to decide it.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING governance choice
  cleared.

#### Q16 — persona trust and freshness

- **Category:** persona ownership and lifecycle.
- **Source pointers:** synthesis, Q16; objective, “Current behavior and observed
  repository facts” and the revived persona-library facts; decision brief,
  “Revived round-one persona input,” Data lane, and threat-model row “Stale
  professional persona”; Codex envelope, `review.unresolvedQuestions[8]`.
- **Direct question:** Are persona definitions KStack-owned, project-owned, or
  both, and who may update or revoke them?
- **User-stated answer:** Both. KStack ships a base persona catalog, and a
  project may locally override it or add its own personas.
- **Accepted consequence:** Round 2 must design a plugin-shipped base catalog
  plus project-local overrides/additions and bind the effective persona version
  and digest into each run.
- **Disposition:** `RESOLVED — OWNER-DECIDED`; FORK-BLOCKING ownership choice
  cleared.

### Owner-question round 4

#### Q22 — dual-review migration

- **Category:** roadmap and backward compatibility; non-blocking for v1.
- **Source pointers:** synthesis, “Substantive agreement” item 9 and Q22;
  objective, success evidence and Required design decision 8; decision brief,
  Architecture lane, “Rollout acceptance,” and reviewer question 11.
- **Direct question:** Should the mature Codex/Opus dual-review mechanism ever
  migrate onto this generalized panel engine?
- **User-stated answer:** It stays permanently separate. The generalized engine
  is an addition, not a planned replacement for the mature, battle-tested
  dual-review mechanism.
- **Accepted consequence:** Round 2 must preserve the existing dual-review path
  as a permanently separate mechanism and must not frame N=2 equivalence as a
  future migration plan.
- **Disposition:** `RESOLVED — OWNER-DECIDED ROADMAP DECISION`; explicitly
  non-blocking for v1.

## Deferred without owner decision

For every item in this section, the exact disposition is: **deferred to round
2, not owner-decided, no FORK-BLOCKING gate applies**. The reviewers already
agree on the indicated v1 direction; round 2 must specify it without treating
that agreement as a user-stated answer.

### Q4 — core v1 protocol

- **Category:** convergence mechanism.
- **Source pointers:** synthesis, “Substantive agreement” item 3 and Q4;
  decision brief, core Options A and B; Codex and Opus envelope material
  dissent on Option B.
- **Direct question:** Should v1 select synchronous whole-panel digest barriers
  and defer targeted issue-ledger subrounds until measured against that
  baseline?
- **User-stated answer:** None; no owner decision was needed because both
  reviewers already agree on synchronous full-panel barriers for v1.
- **Accepted consequence:** None at this owner gate. Round 2 must select the
  synchronous full-panel barrier and defer issue-ledger targeted subrounds.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q5 — backend mapping

- **Category:** backend mapping and disclosure.
- **Source pointers:** synthesis, “Substantive agreement” item 4 and Q5;
  decision brief, “Mapping Option 1”; both envelope recommendations.
- **Direct question:** Should v1 pin an explicit backend per persona, permit
  several disclosed personas on one backend, and prohibit claims that those
  voices are independent models or experts?
- **User-stated answer:** None; both reviewers already agree.
- **Accepted consequence:** None at this owner gate. Round 2 must specify
  pinned and fully disclosed persona-to-backend mapping.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q7 — authorship

- **Category:** candidate authorship and mutation authority.
- **Source pointers:** synthesis, “Substantive agreement” item 6 and Q7;
  decision brief, “Candidate authorship and synthesis options”; both envelope
  recommendations.
- **Direct question:** Should v1 use a designated author outside the voting
  panel, and what separate authority is needed to revise or apply artifacts?
- **User-stated answer:** None; both reviewers already agree that the author is
  outside the voting panel.
- **Accepted consequence:** None at this owner gate. Round 2 must keep the
  external author distinct from voting and preserve separate mutation
  authority.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q10 — hard limits

- **Category:** liveness, operations, cost, and data ceilings.
- **Source pointers:** synthesis, “Substantive agreement” item 8 and Q10;
  decision brief, Arbitration Option 1 bounds and Operations lane; Codex
  envelope, `review.failedChecks[2]` and `review.unresolvedQuestions[2]`; Opus
  envelope, `review.unresolvedQuestions[5]`.
- **Direct question:** What defaults and maxima apply to persona count,
  concurrency, retries, mediation, dispatches, elapsed time, cost/tokens,
  candidate/evidence/raw/snapshot bytes, and retention, and which extensions
  require a linked owner decision?
- **User-stated answer:** None; numeric selection belongs in round 2.
- **Accepted consequence:** None at this owner gate. Round 2 must choose and
  justify concrete ceilings without changing the bounded-stop decision.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q12 — provider failure and retry

- **Category:** provider failure, retry, blindness, and resume.
- **Source pointers:** synthesis, “Primary-artifact resolutions” item 3 and
  Q12; decision brief, Option A failure modes and Operations lane; Codex
  envelope, `review.failedChecks[5]` and `review.unresolvedQuestions[6]`; Opus
  envelope, `review.failedChecks[3]` and `review.unresolvedQuestions[3]`.
- **Direct question:** Is every missing required ballot always
  `PANEL_BLOCKED_PROVIDER`, which failure classes permit retry, how is ambiguous
  completion handled, and how are uniqueness and blindness preserved?
- **User-stated answer:** None; the reviewers agree that an unavailable
  required persona cannot count as convergence.
- **Accepted consequence:** None at this owner gate. Round 2 must define the
  provider-failure and retry classes while preserving unanimity and blindness.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q13 — ballot reuse

- **Category:** lineage, retry, and ballot validity.
- **Source pointers:** synthesis, Q13; decision brief, “Candidate and ballot
  binding”; Opus envelope, `review.failedChecks[4]` and
  `review.unresolvedQuestions[4]`.
- **Direct question:** May a ballot be reused only when candidate, objective,
  panel spec, persona prompt, backend configuration, evidence, and disclosure
  state are byte-identical, or must every retry rerun the full barrier?
- **User-stated answer:** None; exact conditions belong in round 2.
- **Accepted consequence:** None at this owner gate. Round 2 must establish a
  spec-level reuse invariant and cannot leave it circular or protocol-defined.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q14 — dispatch sandbox

- **Category:** security, isolation, and mutation authority.
- **Source pointers:** synthesis, “Primary-artifact resolutions” items 1-2 and
  Q14; decision brief, “Initial independence and later disclosure” and
  Security lane; Codex envelope, `review.securityFindings[1]`; Opus envelope,
  `review.securityFindings[0]` and `review.unresolvedQuestions[1]`.
- **Direct question:** Must every persona dispatch be no-tool,
  no-filesystem-write, no-network, and no-session-persistence with settings
  digest-bound in the manifest, while adapters use a separate owner-authorized
  mutation phase?
- **User-stated answer:** None; both reviewers agree on the safety invariant.
- **Accepted consequence:** None at this owner gate. Round 2 must preserve the
  restricted dispatch boundary and separate any adapter mutation authority.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q15 — persona IDs and storage

- **Category:** path safety, identity, and barrier integrity.
- **Source pointers:** synthesis, “Primary-artifact resolutions” item 6 and
  Q15; decision brief, proposed round artifact shape and path threat; Opus
  envelope, `review.failedChecks[2]`, `review.securityFindings[1]`, and
  `review.unresolvedQuestions[2]`.
- **Direct question:** What canonical ID grammar, length, reserved-name,
  case-folding, traversal-rejection, and storage-key rules apply, and must the
  barrier recompute exact roster set/count equality?
- **User-stated answer:** None; both reviewers agree that safe canonical IDs
  and exact set/count checks are required.
- **Accepted consequence:** None at this owner gate. Round 2 must specify the
  grammar, storage mapping, collision rules, and barrier-close assertion.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q18 — cross-run review shopping

- **Category:** auditability and export disclosure.
- **Source pointers:** synthesis, Q18; decision brief, threat-model row “Review
  shopping”; Codex envelope, `review.securityFindings[3]` and
  `review.unresolvedQuestions[4]`.
- **Direct question:** Must export or presentation disclose all known attempts
  and superseding lineages for the same objective/candidate, or only the
  selected lineage with an omission warning?
- **User-stated answer:** None; export-audit detail belongs in round 2.
- **Accepted consequence:** None at this owner gate. Round 2 must specify
  cross-run review-shopping export auditing within the cooperative/local
  tamper model fixed by Q17.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q19 — sensitive-data lifecycle

- **Category:** security, privacy, retention, and provider eligibility.
- **Source pointers:** synthesis, “Substantive agreement” item 8 and Q19;
  decision brief, Data lane and threat-model row “Sensitive-data fanout”;
  Codex envelope, `review.securityFindings[2]`; Opus envelope,
  `review.securityFindings[2]`.
- **Direct question:** Which backends may receive each data class, what inputs
  are scanned, and what minimization, redaction, permissions, backup, deletion,
  and raw-retention defaults apply?
- **User-stated answer:** None; both reviewers agree this extends existing
  `sanitize()` patterns and belongs in round 2.
- **Accepted consequence:** None at this owner gate. Round 2 must extend the
  existing sanitization patterns across panel inputs, fanout, artifacts, and
  lifecycle controls.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

### Q21 — evaluation and rollout thresholds

- **Category:** verification and rollout.
- **Source pointers:** synthesis, Q21; decision brief, “Verification plan” and
  “Rollout acceptance”; Codex envelope, `review.failedChecks[6]` and
  `review.unresolvedQuestions[9]`.
- **Direct question:** What numeric thresholds for defect recall, false
  convergence, minority-objection loss, mapping sensitivity, latency, cost,
  crash/resume correctness, and user comprehension must pass before rollout?
- **User-stated answer:** None; numeric evaluation thresholds belong in round
  2.
- **Accepted consequence:** None at this owner gate. Round 2 must define the
  evaluation and rollout thresholds and evidence plan.
- **Disposition:** `DEFERRED TO ROUND 2 — NOT OWNER-DECIDED — NO FORK-BLOCKING GATE APPLIES`.

## Unresolved items

None. The unresolved-item count for this clarification gate is **0**.

All Q1-Q22 labels and `FRAME-0` have an explicit disposition: ten distinct
owner decisions (with Q1 folded into Q2 and Q11 folded into FRAME-0) and eleven
items deferred to round 2 without owner decision or a FORK-BLOCKING gate.

## Final owner confirmation

On `2026-08-24`, Kevin explicitly confirmed that the complete read-back was
accurate and complete as the authoritative record and approved locking it
exactly as summarized. That confirmation covers every owner decision above,
both folded question labels, every accepted consequence, and all eleven
deferred-without-owner-decision dispositions.

## Migration, supersession, and lock integrity

- Migration limitation: none. The exact original objective and earliest
  completed dual-review round are present.
- Earlier clarification record superseded: none. This is the first locked
  round-one clarification record for this thread.
- This record must never be edited in place after locking. A genuine conflict
  from new repository evidence, a new safety constraint, or a new user request
  requires a new linked, owner-confirmed decision record that explicitly
  supersedes the affected answer.
- Every later design round must treat this record as authoritative, include
  this file's path and digest in its next decision brief, and map each resulting
  design change back to the applicable question ID.
