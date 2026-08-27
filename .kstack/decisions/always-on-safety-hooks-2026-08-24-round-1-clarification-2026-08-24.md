# Round-One Clarification Decision Record: KStack Safety Hooks

Status: LOCKED

- Thread ID: always-on-safety-hooks-2026-08-24
- Objective ID: always-on-safety-hooks-2026-08-24
- Owner: Kevin
- Round-one invocation ID: 1a41c763-aa65-416a-896a-125743c94d93
- Round-one design digest: 183398b4392ac482e97f0500b6619d320d3474f077b810bf182c08cc1fa21215
- Confirmation date: 2026-08-24

## Source Inventory and SHA-256 Digests

All digests below were computed from the repository files with sha256sum on
2026-08-24. The digest-bound round-one corpus, retained raw reviewer reports,
deterministic review artifacts, and governing clarification instructions were
all inspected.

| Source path | Role | SHA-256 |
|---|---|---|
| .kstack/objectives/always-on-safety-hooks-2026-08-24.md | Objective brief | 4ffe7abf8260f642e0a8157df69f14efaffd14033acc729cb43b143c91026983 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/decision-brief.md | Round-one neutral decision brief; its file digest is the design digest | 183398b4392ac482e97f0500b6619d320d3474f077b810bf182c08cc1fa21215 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/synthesis.md | Coordinating synthesis and Q1-Q14 consolidated ledger; present, so no missing-synthesis fallback was used | a06358e9587a8e0a3bbb84df2d216136227e7c0e2d9ac2eb913052e8195c575b |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/codex.md | Retained raw Codex report | ec49fe2889972a46bc47538871dc1c7e1b809af9a72b4daf17347658e143d9e3 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/opus.md | Retained raw Opus report | 557554dd3eee1de9ce7167703f376aeae414571e9d126e9d4f90212f6eb63750 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/codex.json | Structured Codex reviewer envelope and completeness-check source | b510cac6bd1e17e38dbcc54f9f497be5cee4796844ecb5fc710e11379f971a04 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/opus.json | Structured Opus reviewer envelope and completeness-check source | ae865a6f6bcf9eca772840ed0ce74901b834cc8521f5e40d77db750603d2c3b6 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/checks.json | Deterministic round-one checks | e77f91382f5eadf7429d035801f1eabdb4e96871cc72dde47f0cd5fbb5c38f83 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/gate.json | Deterministic round-one gate | 58e339c5ab89f5d322d2a0113b626e2ca92327e48662a72952e912d27e225eb5 |
| .kstack/reviews/always-on-safety-hooks-2026-08-24-round1/manifest.json | Invocation and design-digest binding | 7435c379b223eb222985cc9c1cbd643436176546810f878e5ad18361cc70515f |
| plugins/kstack/skills/kstack-design-clarify/SKILL.md | Governing clarification-gate instructions | 10984cb552eadf037e0094b42f0b382e4f48575c9fef4f6acfd87b67f54f78e1 |
| plugins/kstack/references/ARTIFACTS.md | Governing artifact-retention instructions | 654ca57ac7f5a9a6bd728fcdbaf62bf09993528d4dd430bdb2dbd0cd7440e585 |
| plugins/kstack/references/SAFETY.md | Governing authority and verification invariants | bfcbdeca0b26f66a4e1af0c7bb1e036d602de8826ac3ffd874b01bfdd111222e |

The manifest reports status dual-complete and binds invocation
1a41c763-aa65-416a-896a-125743c94d93 to design digest
183398b4392ac482e97f0500b6619d320d3474f077b810bf182c08cc1fa21215.
The same invocation and digest appear in both structured reviewer envelopes and
the gate.

## Extraction Method

The coordinating host performed the dedicated extraction pass required by
kstack-design-clarify. It read the complete objective, round-one decision
brief, retained raw reports, structured reviewer envelopes, deterministic
artifacts, and synthesis. It traced reviewer disagreement, hedges, assumptions,
unverified claims, security findings, unresolved questions, and scope
divergence in both directions: from every review field into the ledger and from
every material proposal back to an objective clause or observed repository
need.

The pass consolidated overlapping instances only when one owner answer or
round-two disposition resolved all linked instances. It produced Q1-Q14. The
ledger was cross-verified against codex.json and opus.json's own review-field
tallies:

| Reviewer | failedChecks | securityFindings | materialDissent | unresolvedQuestions |
|---|---:|---:|---:|---:|
| Codex | 7 | 6 | 6 | 8 |
| Opus | 10 | 9 | 7 | 14 |

The synthesis reports the same tallies. Every hedge, assumption, dissent item,
security finding, and unresolved question was accounted for in the consolidated
ledger, and every material proposal received an objective or repository trace.
No extraction gaps were found.

## Scope-Alignment Check

The extraction compared the objective's actors, promised outcome, deliverables,
constraints, and non-goals against every proposed action family, host adapter,
trust boundary, activation scope, installation obligation, failure mode, and
operational requirement.

One real scope-trace ambiguity was found: the objective's user-visible examples
did not name commit or external-ticket creation, while the authority model and
round-one proposal treated them as distinct candidate action families. Q2
resolves that ambiguity affirmatively: both are part of the v1 product surface.
This is an owner-approved scope clarification, not an open gap. Q1 limits the
Codex-host promise to actions already hard-denied by the authority matrix, so
Q2 does not imply false cross-host parity. Q14 further requires every outcome
claim to be bounded by host and action coverage.

Result: scope alignment is complete for the clarification gate. No open
scope-trace ambiguity remains. Round 2 must carry forward the Q1 host
asymmetry, the Q2 v1 surface, and the Q14 bounded-claim language together.

## Questionnaire Session and Decision Ledger

Kevin was asked the six items independently identified as FORK-BLOCKING in two
coherent rounds of three questions each. The remaining eight consolidated
items were presented with their proposed round-two disposition and did not
require an owner policy decision. Kevin's final confirmation covered all
fourteen entries.

All source pointers in this section are relative to
.kstack/reviews/always-on-safety-hooks-2026-08-24-round1 unless an objective
path is shown.

### Owner-question round 1

#### Q1 — Codex ask handling

- Category: Host capability and authority semantics
- FORK-BLOCKING: Yes
- Source pointers: decision-brief.md, Cross-cutting decision: Codex handling for ask; codex.json, review.securityFindings[KS-AUTH-001], review.materialDissent[1] and [5], review.unresolvedQuestions[0]; opus.json, review.securityFindings[codex-ask-emission-is-fail-open], review.materialDissent[1] and [6]; synthesis.md, Substantive agreement item 4 and Consolidated unresolved questions item 1.
- Direct question: Codex CLI supports outright denial but cannot force a PreToolUse ask prompt. For authority-matrix actions currently at ask, should the hook convert them to hard denial on Codex or narrow the Codex promise so those actions remain outside this feature?
- User-stated answer: Narrow the Codex scope. On Codex, this hook only guards actions already hard-denied in the authority matrix. Ask-tier commit, push, pull-request creation, and merge stay outside this feature's promise on the Codex host and continue to be handled only by the existing in-skill authority matrix as they are today.
- Accepted consequence: Coverage is intentionally asymmetric between hosts. This asymmetry is a product decision, not a gap for round 2 to close. Codex documentation and status must not claim that this hook forces approval for ask-tier actions.
- Disposition: OWNER-DECIDED — narrow Codex coverage to existing hard-deny actions; host asymmetry accepted.

#### Q2 — v1 protected-action surface

- Category: Scope alignment and authority surface
- FORK-BLOCKING: Yes
- Source pointers: objective Desired outcome and Current behavior; decision-brief.md, Common policy model and Cross-cutting decision: protected surface; codex.json, review.materialDissent[4] and [5], review.unresolvedQuestions[0] and [5]; opus.json, review.failedChecks[3], review.materialDissent[3], review.unresolvedQuestions[3]; synthesis.md, Material dissent item 1, Primary-artifact resolutions item 6, and Consolidated unresolved questions item 2.
- Direct question: Are commit and external ticket creation explicitly part of the v1 protected-action surface, in addition to destructive Git, credential/secret access, and unauthorized push/merge?
- User-stated answer: Include both. Commit and external ticket creation are explicitly in scope for v1 alongside the objective's originally named destructive Git, credential/secret access, and unauthorized push/merge.
- Accepted consequence: Round 2 must design ticket creation as a guarded API side effect rather than treating the feature as Git/filesystem-only. It must reconcile that coverage with kstack-jira's existing draft-only safeguard instead of duplicating it. Per Q1 and Q14, inclusion in the v1 product surface does not create an unsupported Codex ask guarantee; the host/action coverage matrix must state the difference.
- Disposition: OWNER-DECIDED — commit and external-ticket creation are included in v1.

#### Q14 — product-claim wording

- Category: Product claims and coverage boundaries
- FORK-BLOCKING: Yes
- Source pointers: objective Desired outcome, Constraints, and Failure/recovery; codex.json, review.securityFindings[KS-COVERAGE-004]; opus.json, review.strongestObjection and review.securityFindings[bypass-mode-normalization]; synthesis.md, Substantive agreement item 9, Material dissent item 2, and Consolidated unresolved questions item 14.
- Direct question: May the objective and product use an unqualified always-on claim, or must the outcome be rewritten as bounded per-host and per-action coverage because hooks can be disabled, untrusted, bypassed, or unsupported?
- User-stated answer: Rewrite to bounded claims and adopt Opus's position. The objective and all user-facing documentation must describe bounded, per-host, per-action coverage and must never present an unqualified always-on guarantee.
- Accepted consequence: Round 2 must rewrite the outcome and acceptance language, and every status or user-facing claim must disclose relevant activation, trust, bypass, disabled-mode, and unsupported-path limits. The thread name may remain historical, but it is not a product guarantee.
- Disposition: OWNER-DECIDED — bounded per-host/per-action wording is mandatory.

### Owner-question round 2

#### Q3 — credential/secret protection policy [SECURITY]

- Category: Security boundary and policy authority
- FORK-BLOCKING: Yes
- Source pointers: objective Desired outcome, Constraints, and Failure/recovery; decision-brief.md, Credential content row and Security lane; codex.json, review.securityFindings[KS-POLICY-002], review.materialDissent[4], review.unresolvedQuestions[1] and [5]; opus.json, review.securityFindings[credential-read-copy-then-read-bypass], review.unresolvedQuestions[4] and [6]; synthesis.md, Substantive agreement items 6 and 7 and Consolidated unresolved questions item 3.
- Direct question: Should credential/secret protection be a hard invariant, a new configurable authority-matrix key, or a bounded subset, and is it merely deterrence or a real disclosure boundary?
- User-stated answer: Make it a hard invariant with a real disclosure boundary. Credential/secret file access is always blocked outside an authorized flow, and secret content itself must never reach the tool call; deterrence or logging alone is insufficient.
- Accepted consequence: Round 2 must define the authorized flow, protected object, supported tool/action boundary, and pre-tool interception evidence. For any claimed covered path, the design cannot degrade this requirement to best-effort detection. Any host or tool path where that disclosure boundary cannot be guaranteed must be reported as outside bounded coverage under Q14, not described as protected.
- Disposition: OWNER-DECIDED — hard invariant and real pre-tool disclosure boundary.

#### Q4 — control-plane protection policy [SECURITY]

- Category: Security, control-plane integrity, and honest guarantees
- FORK-BLOCKING: Yes
- Source pointers: decision-brief.md, KStack control plane row and Security lane; codex.json, review.securityFindings[KS-POLICY-002], review.unresolvedQuestions[1]; opus.json, review.securityFindings[control-plane-protection-is-advisory-only], review.unresolvedQuestions[5] and [6]; synthesis.md, Substantive agreement item 6, Material dissent item 3, and Consolidated unresolved questions item 4.
- Direct question: Should changes to .kstack/config.json, hook wiring, guard code, and related state be blocked, separately authorized, or detect-only with tamper evidence?
- User-stated answer: Use detect-only/tamper-evidence. Changes are logged and flagged loudly but are not blocked outright, because an unbypassable guarantee would be dishonest when whoever controls configuration can also disable the enforcing hook.
- Accepted consequence: Round 2 must specify bounded, non-secret tamper signals and prominent status/reporting behavior. It must not claim tamper-proofing or prevention of self-disablement and must preserve the user's ability to change KStack configuration through normal authorized repository work.
- Disposition: OWNER-DECIDED — detect-only/tamper-evidence; no blocking guarantee.

#### Q6 — activation

- Category: Product activation and installation scope
- FORK-BLOCKING: Yes
- Source pointers: objective Open questions and Failure/recovery; decision-brief.md, Product lane and Operations lane; codex.json, review.recommendation and review.unresolvedQuestions[2]; opus.json, review.failedChecks[9], review.recommendation, review.unresolvedQuestions[7]; synthesis.md, Material agreement item 9 and Consolidated unresolved questions item 6.
- Direct question: Should activation be an opt-in canary, default-on with disclosure, or a prerequisite before KStack may claim outside-skill enforcement, and should it apply at user scope, project scope, or both?
- User-stated answer: Default-on with disclosure at both user and project scope.
- Accepted consequence: Round 2 must define additive, observable, idempotent activation, update, status, disablement, and rollback behavior for both scopes. Disclosure must explain bounded coverage and inactive/untrusted/disabled states, and installation must preserve unrelated host and project configuration.
- Disposition: OWNER-DECIDED — default-on with disclosure at user and project scope.

### Deferred round-two items

The disposition text below is deliberately identical for every deferred item:
deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies. Kevin's
final confirmation accepts these bounded deferrals as complete dispositions for
this clarification gate; they are not owner policy answers and may not be cited
as such.

#### Q5 — Option A versus Option B mechanism spike

- Category: Architecture and mechanism evidence
- FORK-BLOCKING: No
- Source pointers: codex.json, review.materialDissent[3], review.recommendation, review.unresolvedQuestions[4]; opus.json, review.materialDissent[5], review.recommendation, review.unresolvedQuestions[0]; synthesis.md, Substantive agreement item 3, Primary-artifact resolutions item 1, and Consolidated unresolved questions item 5.
- Direct question: Must Option A remain conditional on a disposable Claude plugin-persistence and fresh-session coverage spike, with Option B available only if that evidence fails?
- User-stated answer: No owner mechanism choice was needed. Both reviewers already agree on spike-then-decide, and Kevin confirmed its deferral in the final read-back.
- Accepted consequence: Round 2 must run or consume the mechanism spike before selecting A or the bounded B fallback and must map the resulting design change to Q5.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

#### Q7 — supported version and platform floors

- Category: Compatibility and supported contract
- FORK-BLOCKING: No
- Source pointers: codex.json, review.failedChecks[0], review.unresolvedQuestions[3] and [7]; opus.json, review.failedChecks[4], review.recommendation, review.unresolvedQuestions[8]; synthesis.md, Material dissent item 4 and Consolidated unresolved questions item 7.
- Direct question: What Claude/Codex minimum versions, platforms, execution modes, tool paths, and runtime prerequisites define v1 support?
- User-stated answer: No version or platform floor was owner-decided; Kevin confirmed that evidence-based selection belongs in round 2.
- Accepted consequence: Round 2 must define and test explicit floors and must report older or unsupported environments as inactive or outside coverage rather than silently claiming protection.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

#### Q8 — failure-semantics architecture

- Category: Reliability and security failure semantics
- FORK-BLOCKING: No
- Source pointers: decision-brief.md, Architecture lane and Failure boundaries; codex.json, review.failedChecks[4] and review.securityFindings[KS-PARSER-005]; opus.json, review.failedChecks[1] and [2], review.securityFindings[hook-failure-semantics-unknown-both-hosts], review.unresolvedQuestions[1] and [2]; synthesis.md, Primary-artifact resolutions items 2 and 3 and Consolidated unresolved questions item 8.
- Direct question: What architecture and matcher boundaries keep evaluator crash, timeout, malformed output, launch failure, and missing-runtime behavior acceptable on each host?
- User-stated answer: No failure-semantics architecture was owner-decided; Kevin confirmed that round 2 must resolve it from documented and disposable-test evidence.
- Accepted consequence: Round 2 must specify and test each failure mode and may not claim fail-closed behavior that the host contract cannot prove.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

#### Q9 — root/config trust rules

- Category: Security, trust roots, and TOCTOU
- FORK-BLOCKING: No
- Source pointers: decision-brief.md, Architecture and Data lanes; codex.json, review.failedChecks[3], review.securityFindings[KS-ROOT-003], review.unresolvedQuestions[6]; opus.json, review.securityFindings[repo-controlled-policy-input]; synthesis.md, Substantive agreement item 7 and Consolidated unresolved questions item 9.
- Direct question: What ownership, realpath, symlink, worktree, nested-repository, additional-directory, config snapshot/revalidation, and time-of-check/time-of-use rules define an authorized project policy?
- User-stated answer: No trust-rule contract was owner-decided; Kevin confirmed deferral to round 2.
- Accepted consequence: Round 2 must reuse and verify KStack's TOCTOU precedent from the unavailable-sentinel.mjs work identified earlier in the coordinating session, then adapt it explicitly to root/config evaluation rather than inventing an untraced rule.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

#### Q10 — adapter contract

- Category: Host-adapter correctness
- FORK-BLOCKING: No
- Source pointers: decision-brief.md, Common policy model and Architecture lane; opus.json, review.failedChecks[6] and [7], review.securityFindings[codex-ask-emission-is-fail-open], review.unresolvedQuestions[9] and [10]; synthesis.md, Primary-artifact resolutions item 4 and Consolidated unresolved questions item 10.
- Direct question: What output types may each host adapter emit, including a structural prohibition on Codex ask, a decision on Claude defer, and proven precedence with unrelated hooks?
- User-stated answer: No adapter contract was owner-decided; Kevin confirmed deferral to round 2.
- Accepted consequence: Round 2 must make unsupported Codex ask structurally unrepresentable, explicitly define or prohibit Claude defer, and verify restrictive coexistence rather than assuming hook precedence.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

#### Q11 — denial-message disclosure boundary

- Category: Security and user experience
- FORK-BLOCKING: No
- Source pointers: decision-brief.md, UX lane and Security lane; opus.json, review.securityFindings[denial-text-teaches-classifier-evasion], review.unresolvedQuestions[12]; synthesis.md, Consolidated unresolved questions item 11.
- Direct question: How much category and reason information may an intervention expose to the model while remaining useful to the user without teaching classifier evasion?
- User-stated answer: No disclosure format was owner-decided; Kevin confirmed deferral to round 2.
- Accepted consequence: Round 2 must select and test a stable high-level message contract that never includes secret content or unnecessary matcher detail and must document whether any user-only channel exists.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

#### Q12 — numeric latency and false-positive thresholds

- Category: Performance and acceptance criteria
- FORK-BLOCKING: No
- Source pointers: decision-brief.md, Acceptance thresholds to choose; codex.json, review.failedChecks[5], review.unresolvedQuestions[7]; opus.json, review.failedChecks[5], review.securityFindings[bypass-mode-normalization], review.unresolvedQuestions[11]; synthesis.md, Material dissent item 5 and Consolidated unresolved questions item 12.
- Direct question: What cold/warm latency ceilings, benign corpus, false-positive ceiling, finite-corpus false-negative rule, canary size, and rollback trigger govern acceptance?
- User-stated answer: No numeric thresholds were owner-decided; Kevin confirmed that evidence-backed thresholds belong in round 2.
- Accepted consequence: Codex's proposed below-1-percent benign false positives and p95 warm latency below 50 ms remain hypotheses, not owner-approved requirements. Round 2 must justify its numeric contract and rollback trigger with evidence.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

#### Q13 — Option B settings-rollback contract

- Category: Installer safety and reversibility
- FORK-BLOCKING: No
- Source pointers: decision-brief.md, Option B Costs and failure modes and Reversibility; codex.json, review.failedChecks[0], review.securityFindings[KS-INSTALL-006]; opus.json, review.securityFindings[settings-merge-mutation-risk-option-b], review.unresolvedQuestions[13]; synthesis.md, Consolidated unresolved questions item 13.
- Direct question: If Option B is required for Claude, what ownership tag, backup, structural inverse, relocatable launcher, and stop-on-drift contract protects user configuration?
- User-stated answer: No Option B rollback contract was owner-decided; Kevin confirmed deferral to round 2.
- Accepted consequence: Round 2 must define this contract before selecting Option B and must stop on concurrent drift rather than overwrite user-owned configuration.
- Disposition: deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

## Unresolved Items

None.

The eight deferred entries above are explicitly disposed round-two design work,
not unresolved owner clarifications. All six FORK-BLOCKING questions have
direct owner answers and accepted consequences.

## Final Owner Confirmation

Kevin explicitly confirmed that the complete read-back was accurate and
complete as the authoritative record: all six FORK-BLOCKING decisions, their
accepted consequences, and all eight deferred-to-round-two dispositions. Kevin
approved locking the record exactly as summarized.

- Confirmation date: 2026-08-24
- Confirmation status: Explicit and complete

## Migration, Supersession, and Prior Records

- Migration limitation: None. This is the ordinary clarification record for the original completed dual-review round, not a migration reconstruction.
- Earlier clarification record superseded: None.
- Record superseded by this file: None.

Later rounds must treat this locked record as authoritative, cite its path and
digest in the next decision brief, and map each resulting design change to its
question ID. Any genuine conflict from new repository evidence, a newly
discovered safety constraint, or a new user request requires a new linked
decision record; this record must not be edited in place after locking.
