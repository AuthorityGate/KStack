# Round-one clarification: live post-deploy health check

Status: LOCKED

- Thread ID: `post-deploy-health-check-2026-08-24`
- Objective ID: `post-deploy-health-check-2026-08-24`
- Round-one invocation ID: `ff4d78fd-8cf4-42cd-bde0-9fc1a138990d`
- Design digest: `c3e4d44f621addb6a812a4e65067b5dd29751f5015a0a5e6218dc4db95fb5a1e`
- Confirmation date: `2026-08-24`
- Owner: Kevin

## Extraction method

A dedicated extraction pass was performed per `kstack-design-clarify`. The pass
read the complete objective, exact round-one decision brief, retained raw Codex
and Opus reports, structured Codex and Opus reviewer envelopes, deterministic
checks, gate result, invocation manifest, and coordinating synthesis. It
accounted for reviewer disagreement, hedging, assumptions, qualifications,
unresolved questions, security findings, and scope divergence, then compared
every material proposal against the objective's actors, promised outcome,
deliverables, constraints, and non-goals.

The traceability ledger was cross-verified in both directions against
`synthesis.md` and against the Codex and Opus envelopes' own tallies and fields:
Codex reported 9 failed checks, 3 security findings, 4 material-dissent items,
and 11 unresolved questions; Opus reported 9 failed checks, 6 security findings,
4 material-dissent items, and 10 unresolved questions. The gate's aggregate
counts of 9 security findings and 8 material-dissent items agree. The retained
raw-report digests also agree with the manifest. No gaps were found.

The coordinating direct-owner session grouped the consolidated ledger into two
rounds of one to three questions. Together those rounds covered the five items
independently identified as FORK-BLOCKING, labeled HC1-HC5 by the coordinating
session. Those labels are mapped below by content to the synthesis's original
consolidated list; they are not presented as IDs originating in `synthesis.md`.
The remaining seven ledger items, HC6-HC12, were correctly disposed to round 2
without requiring owner input. Kevin then confirmed a complete read-back of all
twelve dispositions.

## Complete source inventory

The SHA-256 values below were computed from the actual on-disk bytes on
2026-08-24. The design digest independently reproduces the SHA-256 of the exact
round-one decision brief.

| Source path | Role | SHA-256 |
|---|---|---|
| `.kstack/objectives/post-deploy-health-check-2026-08-24.md` | Objective brief | `2ba7c933ddee424b19b13179358eaa31a4b3cdafb4b057619126caa445945ded` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/decision-brief.md` | Exact reviewed round-one design brief | `c3e4d44f621addb6a812a4e65067b5dd29751f5015a0a5e6218dc4db95fb5a1e` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md` | Coordinating round-one synthesis and consolidated unresolved-question list | `bcd2eb44aa825125db843c71b04ee55b7339deb7334b28d62aa97e7120e14198` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.md` | Retained raw Codex report | `9e087bb4520ced833f1f216415b3977fc66aa1b246da3823ca2ce28b0e504927` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.md` | Retained raw Opus report | `b0b4002e976747c741c6fae3ec368b3499a4d18ec59f699a40ed127a49e06e21` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json` | Structured Codex reviewer envelope | `9375a94980f1b421e45cef2deaa6e5a84cf33c0db58a80c6721308b357ee5a7f` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json` | Structured Opus reviewer envelope | `a39acf6be3efcc4e93324c68d66f7bf6d0167f77871b3cc8d8dba002a41bce29` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/checks.json` | Deterministic round-one checks | `fd7e36528ee034045e255f19f3969267c260e349ef0b72be096249a98af92abc` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/gate.json` | Round-one gate result | `5a9ce95c830397b6df43720916b7c531d87b2976084f54b9ed4449b730575270` |
| `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/manifest.json` | Invocation and design-digest authority | `0d3987f734529838112070f52fd822aaafcbe53443d126efcd84f4bcb90a1584` |
| `.kstack/decisions/broader-planning-lenses-2026-08-24-round-1-clarification-2026-08-24.md` | Locked override/provenance precedent followed by HC3 | `c0344d0280eab82c22f230f91178c6c21f2dc5a60ccfbeaf084fae8c2f4d933f` |

## Scope-alignment check

Result: **aligned; no untraced proposal found for this thread**.

Every material round-one proposal traces to the objective's requested installed
runtime health check, host-surface verification, safe dependency-probe contract,
failure policy, recovery policy, claim boundary, bounded cost, or observed
repository need. The three core options, central runner, root and surface
probes, closed dependency declarations, private fixture, deduplication choices,
status model, and verification program introduce no actor, subsystem,
dependency, role, trust boundary, or operational obligation without an
objective or observed-repository trace.

The coordinating comparison also noted a commit/external-ticket ambiguity that
had already been flagged in a round-one synthesis conclusion. That ambiguity is
the concern of the different design thread `always-on-safety-hooks-2026-08-24`,
not `post-deploy-health-check-2026-08-24`. It is neither imported as an
exception to this result nor conflated with this health-check ledger.

## Question dispositions

### HC1 — Blocking versus degraded Reflexion (product/failure policy)

- **Source pointers:** `.kstack/objectives/post-deploy-health-check-2026-08-24.md`, “Current behavior,” “Desired outcome and measurable evidence,” and “Required design decisions” item 4; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/decision-brief.md`, “Core option 1,” “Core option 2,” and “Unresolved questions for direct owner clarification” item 1; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Substantive agreement” items 1 and 6 and consolidated questions 1-2; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.failedChecks` items 1-2, `review.materialDissent` item 1, and `review.unresolvedQuestions` items 1-2; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, `review.failedChecks` item 2, `review.materialDissent` item 1, and `review.unresolvedQuestions` item 1.
- **Direct question:** Codex/Option 1 would make a Reflexion-unavailable root fail `setup` outright. Opus/Option 2 would preserve a tiered, explicit exit-0 `DEGRADED` outcome. Is Reflexion unavailability blocking, or is it a supported degraded install, and what does that choice require round 2 to design?
- **User-stated answer:** Kevin chose tiered/`DEGRADED`. A broken Reflexion does not fail the install, but it must be loudly and explicitly reported as `DEGRADED` and must never be silently swallowed. This directly addresses the 2026-08-24 incident in which the fchmod/9p failure left Reflexion silently non-functional while setup reported success.
- **Accepted consequence:** Round 2 must define the exact `DEGRADED` reporting mechanism and its machine/operator-visible semantics. It must not pursue Option 1's hard-blocking design for a setup-classified Reflexion-unavailable root.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### HC2 — Rollback scope (scope/recovery/security)

- **Source pointers:** `.kstack/objectives/post-deploy-health-check-2026-08-24.md`, “Constraints and non-goals” and “Required design decisions” item 5; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/decision-brief.md`, “Core option 3” and “Rollback and recovery requirements”; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Substantive agreement” items 7-8, retained `SEC-002` and `PDH-SEC-06`, and consolidated question 3; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, security finding `SEC-002` and `review.unresolvedQuestions` item 4; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, security finding `PDH-SEC-06` and `review.unresolvedQuestions` item 8.
- **Direct question:** Should v1 keep manual recovery from timestamped backups, or adopt Option 3's automatic verified rollback with a transaction journal despite Codex's high-severity `SEC-002` warning that an inexact journal could restore or overwrite the wrong state?
- **User-stated answer:** Kevin kept v1 scoped to manual recovery from timestamped backups. Automatic rollback under Option 3 is explicitly deferred out of this thread to a future, separately reviewed design.
- **Accepted consequence:** Round 2 must specify truthful changed-state diagnostics and exact manual recovery guidance. It must not design, imply, or claim automatic rollback, transactional installation, or `ROLLED_BACK`; Option 3's journal and destructive recovery surface require their own design review.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved. Automatic rollback is deferred to a separate future objective/design, not to round 2 of this thread.

### HC3 — Audited escape hatch (operations/authority/provenance)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Preserved dissent and differences in emphasis” item 3 and consolidated question 2; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, `review.failedChecks` item 9 and `review.unresolvedQuestions` item 10; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, whose recommendation and unresolved-question list request no escape hatch; `.kstack/decisions/broader-planning-lenses-2026-08-24-round-1-clarification-2026-08-24.md`, locked Q8 “Override authority” and Q9 “External provenance.”
- **Direct question:** Opus requested a documented override for false failures; Codex did not request one. Should the design include an escape hatch, and, if so, who may authorize it and what evidence must it retain?
- **User-stated answer:** Yes. Kevin directed that the design add a documented override, but it requires second-party approval and is audited. This follows the override/provenance policy already locked for `broader-planning-lenses-2026-08-24`.
- **Accepted consequence:** Round 2 must make the override conspicuous, documented, and audit-preserving; a single party may not exercise it unilaterally. The request and second-party approval must remain within the KStack-owned, human-authored provenance boundary established by the cited precedent. The override grants no model authority and may not become a silent success path.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved. The cited locked record is the controlling precedent for override authority and provenance.

### HC4 — Truthful claim boundary (scope/product)

- **Source pointers:** `.kstack/objectives/post-deploy-health-check-2026-08-24.md`, “Desired outcome and measurable evidence,” “Constraints and non-goals,” and “Required design decisions” item 6; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/decision-brief.md`, “Objective and user-visible outcome,” “Authority boundaries and non-goals,” and owner-clarification item 6; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Substantive agreement” item 5 and consolidated question 10; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.materialDissent` item 4 and `review.unresolvedQuestions` item 11.
- **Direct question:** Although the reviewers were near consensus, the objective expressly required owner confirmation: may this health check claim interactive host skill activation, such as proving that a slash command actually fires inside Claude Code, or must the claim remain limited to installed structure and lookup behavior?
- **User-stated answer:** Kevin confirmed that the health check must never claim to prove interactive host skill activation. Its scope stays bounded to verifying that installed files, paths, and lookups are structurally sound.
- **Accepted consequence:** Round 2 and all user-visible output/documentation must state the activation boundary truthfully. Marketplace/plugin agreement and installed lookups may be reported only as structural/runtime health evidence, never as proof that a slash command or skill activates inside an interactive host session.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### HC5 — Third-party-check tiering (dependency boundary/failure policy)

- **Source pointers:** `.kstack/objectives/post-deploy-health-check-2026-08-24.md`, modern Codex registration requirement and claim boundary; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/decision-brief.md`, surface probe S2 and Options 1-2; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Preserved dissent and differences in emphasis” item 2, “Primary-artifact conflict resolution” item 6, retained `SEC-001`/`PDH-SEC-03`, and consolidated question 5; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, security finding `SEC-001`; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, security finding `PDH-SEC-03` and `review.materialDissent` item 2.
- **Direct question:** Opus wanted Codex CLI's unversioned, third-party JSON output separated into a lower, non-blocking tier from KStack-owned filesystem checks; Codex's analysis would fold the checks into one blocking policy. Should Codex CLI JSON failures block installation or produce a lower-tier degraded result?
- **User-stated answer:** Kevin chose the separate lower tier: Codex CLI JSON checking is non-blocking and degraded, consistent with HC1's decision that Reflexion unavailability is degraded rather than blocking.
- **Accepted consequence:** Round 2 must separate KStack-owned filesystem/runtime assertions from third-party Codex CLI JSON checks. The latter cannot make setup nonzero and must report a distinct, explicit degraded/non-blocking outcome rather than masquerading as pass or as a KStack-owned structural failure.
- **Disposition:** Owner-decided; FORK-BLOCKING resolved.

### HC6 — Latency budgets and supported-version matrix (performance/compatibility)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Substantive agreement” items 6 and 8 and consolidated questions 4-5; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.failedChecks` items 6-7 and `review.unresolvedQuestions` items 3 and 7-8; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, `review.failedChecks` item 1, `review.materialDissent` item 4, and `review.unresolvedQuestions` items 2 and 7.
- **Direct question:** What exact warm, cold, per-child, and total latency/timeout budgets apply, and what Node, operating-system, and Codex CLI versions are supported?
- **User-stated answer:** Kevin made no budget or supported-matrix decision; owner input is not required at this gate.
- **Accepted consequence:** Round 2 must define and justify the budgets and version matrix from measurements and compatibility evidence; none of the round-one proposed values is owner-approved.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### HC7 — Shared-root cache invalidation (architecture/correctness)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Substantive agreement” item 2, “Primary-artifact conflict resolution” item 1, and consolidated question 8; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.failedChecks` item 3 and `review.unresolvedQuestions` item 6; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, `review.failedChecks` item 3 and `review.unresolvedQuestions` item 6.
- **Direct question:** What final-probe, write-generation, or identity-based invalidation rule prevents reuse of a stale pass after a later host operation changes a shared canonical root?
- **User-stated answer:** Kevin made no cache-invalidation design choice; owner input is not required at this gate.
- **Accepted consequence:** Round 2 must specify an exact mutation-aware freshness invariant for both aggregation variants before cached root-probe results can be trusted.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### HC8 — Dependency-declaration location and grammar (data/architecture)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/decision-brief.md`, “Root probe R2,” “Dependency declaration source,” and owner-clarification item 4; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Substantive agreement” item 3 and consolidated question 6; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.unresolvedQuestions` item 5; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, security finding `PDH-SEC-01` and `review.unresolvedQuestions` items 3 and 9.
- **Direct question:** Should dependency declarations use one central closed contract or KStack-owned skill-local sidecars, and what exact grammar maps every supported skill-script reference to an independently pinned expected probe set?
- **User-stated answer:** Kevin made no declaration-location or grammar decision; owner input is not required at this gate.
- **Accepted consequence:** Round 2 must choose and fully specify the declaration source, grammar, alignment validation, and source-side expected-set binding so an installed contract cannot validate itself vacuously.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### HC9 — Safe-import side-effect audit (security/verification)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Substantive agreement” item 4 and consolidated question 7; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.failedChecks` item 5; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, `review.failedChecks` item 7, security finding `PDH-SEC-02`, and `review.unresolvedQuestions` item 4.
- **Direct question:** What exact audit and harness rules prove that every safe-import target has no import-time writes, network access, unexpected output, timers, watchers, sockets, or other open handles, while still covering transitive dependencies across supported platforms?
- **User-stated answer:** Kevin made no side-effect-audit design decision; owner input is not required at this gate.
- **Accepted consequence:** Round 2 must enumerate the safe-import targets and define auditable side-effect, exit, timeout, platform, and transitive-coverage behavior before those imports can run on every setup.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### HC10 — Cleanup, duplicate, stale, and partial-install classification (status model)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, consolidated questions 4 and 9; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.failedChecks` item 8 and `review.unresolvedQuestions` items 9-10; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, `review.failedChecks` item 8, security finding `PDH-SEC-05`, and `review.unresolvedQuestions` item 5.
- **Direct question:** How should cleanup failure, duplicate or stale destinations, shared-root failures, and partially completed independent-host installs be represented and classified?
- **User-stated answer:** Kevin made no classification decision for these cases; owner input is not required at this gate.
- **Accepted consequence:** Round 2 must define distinct stable classifications and changed-state reporting for these cases without treating environment conditions as install defects or making unsafe cleanup claims.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### HC11 — Stable output contract (UX/compatibility)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/decision-brief.md`, root probe R3 and “Costs, compatibility, and residual limitations”; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Preserved dissent and differences in emphasis” item 4 and “Primary-artifact conflict resolution” item 3; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, `review.unresolvedQuestions` item 2; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, `review.failedChecks` item 5 and `review.materialDissent` item 3.
- **Direct question:** Should the health contract assert a stable token or structured result, or exact rendered prose, and what machine-readable interface distinguishes `PASS` from `DEGRADED`?
- **User-stated answer:** Kevin made no exact output-format decision; owner input is not required at this gate.
- **Accepted consequence:** Round 2 must define a stable output and machine-readable status contract. It must not silently turn mutable prose into a fleet-wide compatibility boundary.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

### HC12 — Symlink-race controls and nonce claim (security/documentation)

- **Source pointers:** `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/synthesis.md`, “Preserved dissent and differences in emphasis” item 5, “Primary-artifact conflict resolution” item 7, retained `SEC-003`, and retained `PDH-SEC-04`; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/codex.json`, security finding `SEC-003` and `review.materialDissent` item 2; `.kstack/reviews/post-deploy-health-check-2026-08-24-round1/opus.json`, security finding `PDH-SEC-04`.
- **Direct question:** What cross-platform canonical-path, no-follow, and immediate file-identity checks bound symlink replacement races, and how will documentation state that the challenge nonce proves freshness/root-confusion detection rather than authenticating the runner?
- **User-stated answer:** Kevin made no detailed race-control design choice; owner input is not required at this gate.
- **Accepted consequence:** Round 2 must specify the file-identity/recheck controls and document the residual same-user-host race and the nonce's limited freshness—not authentication—claim.
- **Disposition:** deferred to round 2, not owner-decided, no FORK-BLOCKING gate applies.

## Unresolved items

None.

All HC1-HC12 items have a locked disposition. A disposition of “deferred to
round 2, not owner-decided, no FORK-BLOCKING gate applies” is authoritative
permission for round 2 to resolve that design detail without reopening this
clarification gate; it is not a substantive owner answer to the deferred
question. Automatic rollback is different: HC2 defers it out of this thread to
a future, separately reviewed design.

## Final confirmation

On 2026-08-24, Kevin explicitly confirmed that the full read-back of all five
FORK-BLOCKING decisions, HC1-HC5, plus all seven deferred items, HC6-HC12, was
accurate and complete as the authoritative record. Kevin approved locking the
record exactly as summarized here.

## Migration and supersession

- Migration limitation: none.
- Earlier clarification record superseded: none.
- This is the first locked round-one clarification record for this thread and
  invocation.
