# Round 1 clarification: KStack Capability Fabric

Status: LOCKED

- Thread ID: `kstack-capability-fabric-2026-08-26`
- Objective path: `.kstack/objectives/kstack-capability-fabric-2026-08-26.md`
- Round-one invocation ID: `65231b07-7b00-4aa4-9585-7f0001dc6df0`
- Round-one design digest: `b54c81c575d2a7d681ee8eeb335556fdc1d633198310cb05292b74de10794a21`
- Round-one scores: Codex 67; Opus 66; combined 66
- Clarification result: `ROUND_ONE_CLARIFICATION_LOCKED`

The source-linked owner questionnaire is complete. Later briefs must cite this
record and its digest. A material change requires a linked superseding owner
decision; silent reinterpretation is invalid.

## Bound source inventory

| Source | SHA-256 |
|---|---|
| objective | `dd4581a474426fae11340a24bd337529f7348952e317d596dc36381ad816ba85` |
| decision brief | `b54c81c575d2a7d681ee8eeb335556fdc1d633198310cb05292b74de10794a21` |
| Codex report | `7276529096c71224071120229ffdbbb47b4a7d384d4001604b06484f0e8e4890` |
| Codex envelope | `3d26954907a6afac6cbc98a2efc4f1ceebc51256fce3289637f99d3199ac6c4f` |
| Opus report | `02c53fc72acdfd7db88126eab8ee04f66ae2ba88ac457f0fa5df23d1359298ac` |
| Opus envelope | `7261bf1c1a26c79131fd6d064989be6c7b0f5c79bfc770e25c0f97c52191efc1` |
| synthesis | `b0ea4a446503a1e1f6348c29ea96ce1a05b54d55f3f500aaff2ce191ae146ed6` |
| manifest | `7bb132b4bb394bd6ae06b00400130256f7dacb63b087b3974babdda3749e8005` |

## Extraction status

The objective, frozen brief, both raw reports, structured envelopes, manifest,
and synthesis were inspected. Reviewer disagreements, hedges, unverified
assumptions, findings, unresolved questions, and scope questions were grouped
by their smallest affected slice. The questionnaire is being asked in groups of
at most three questions. Technical items on which both reviewers agree will be
preserved as required corrections; material owner choices are recorded below.

## Owner-question group 1 - confirmed 2026-08-26

### Q1 - rounds 34-41 and skill-class exception

- **Sources:** objective, `Locked confidence schedule`; decision brief,
  `Owner policy`; Codex unresolved questions 1; Opus failed checks 1-2 and
  unresolved questions 1-2.
- **Question:** Should rounds 34-41 remain at 71, and should the existing
  skill-class threshold exception be removed?
- **Owner answer:** Yes; yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** The default schedule is 93 for rounds 1-10, 81 for 11-21, 71
  for 22-41, and 63 from round 42. There is no content/skill-class bypass. User
  setup and repository initialization may override the entire validated
  schedule, and repository policy wins.

### Q2 - threshold-policy thread separation

- **Sources:** synthesis, Slice 0 and reviewer differences; Opus material
  dissent 3 and recommendation 1.
- **Question:** Should the confidence-schedule correction be its own first,
  linked design thread so this program does not define its own gate?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Slice 0 leaves this program and becomes a prerequisite linked
  decision. This program cannot claim the new executable gate until that slice
  is implemented and bound.

### Q3 - observer-first sequencing

- **Sources:** synthesis, reviewer differences; Opus failed check 14, material
  dissent 2, unresolved question 12.
- **Question:** Should work begin with a read-only GitHub release observer and
  provisional schemas derived from it before common contracts are frozen?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** The observer precedes stable contract publication. Early
  schemas are explicitly provisional and cannot be claimed compatible until
  observer evidence and replay fixtures define their required fields.

## Owner-question group 2 - confirmed 2026-08-26

### Q4 - automated release enforcement and one deployment skill

- **Sources:** Codex security findings SEC-01 and SEC-04, material dissent 1,
  and unresolved questions 3 and 5; Opus SEC-1, strongest objection, and
  unresolved question 4.
- **Question:** Should unattended actions be enforced by a separate protected
  broker holding credentials and validating authenticated, nonce-bound,
  revocable approval envelopes at action time?
- **Owner answer:** Yes, provided the workflow remains automated. Develop one
  deployment skill that always uses the same proper deployment method.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** One `kstack-release` surface owns the deterministic
  plan-to-observation workflow. Provider adapters remain internal. After the
  exact approval envelope is authorized, the protected broker performs the
  approved operations without repeated prompts while the envelope remains
  valid. It holds credentials and is the action-time enforcement point; the
  governed agent cannot author its own approval or receipt.

### Q5 - automatic rollback and reversibility

- **Sources:** decision brief, Release Controller and rollback; Opus SEC-2,
  failed check 12, recommendation 3, and unresolved question 6.
- **Question:** Should automatic rollback be allowed only when reversibility is
  proven in advance, with irreversible releases stopping at
  `ROLLBACK_REQUIRED` for human approval?
- **Owner answer:** Yes. For an eligible release, automatic rollback is required
  to be attempted before calling on the human.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Preflight classifies and evidences reversibility. For a
  reversible release whose exact rollback target and predicate are authorized,
  rollback is the mandatory first recovery action. Only rollback failure,
  ambiguity, or exhausted bounded recovery escalates to the human. A release
  with irreversible effects is ineligible for automatic rollback and stops
  safely instead of pretending an unsafe attempt occurred.

### Q6 - generic command/webhook adapter

- **Sources:** Codex SEC-02, material dissent 3, recommendation, and unresolved
  question 6.
- **Question:** Should the generic command/webhook executor be removed from v1
  and reconsidered only as a separately reviewed declarative allowlist adapter?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** V1 contains no arbitrary command or generic webhook release
  executor. A future adapter requires its own objective, threat model, command
  grammar, destination allowlist, sandbox, egress policy, and least-privilege
  execution identity.

## Owner-question group 3 - confirmed 2026-08-26

### Q7 - concurrent release envelopes and emergency pause

- **Sources:** Opus failed check 10 and unresolved question 9; Codex state and
  fencing findings.
- **Question:** Should only one write-capable release envelope be allowed per
  repository/environment, with a global emergency pause?
- **Owner answer:** Do not impose a hard concurrency limit, but scope concurrent
  releases carefully.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Concurrency is controlled by deterministic resource claims,
  environment/target locks, lease fencing, dependency ordering, and collision
  detection rather than one universal count. Non-overlapping releases may run
  concurrently. Conflicting claims cannot. An emergency pause stops new actions
  and places active work into bounded reconciliation rather than assuming it
  stopped before acting.

### Q8 - credential-handle lifecycle by environment risk

- **Sources:** Opus SEC-5 and unresolved question 5; Codex approval-envelope and
  receipt findings.
- **Question:** Should every release require broker-owned, short-lived,
  per-envelope credential handles whose rotation/revocation invalidates the
  envelope?
- **Owner answer:** This is not required in development environments. For
  production environments containing user data, default to yes, while allowing
  a human override with explicit approval or risk acknowledgement.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Credential policy is environment/risk-class aware. Production
  user-data releases default to short-lived, broker-owned, envelope-scoped
  handles. A weaker credential posture requires a separately recorded human
  approval/risk acknowledgement bound to the same target and expiry. Development
  may use a less restrictive configured policy. Actual credential revocation
  always invalidates future use and forces reconciliation of possibly acted
  operations.

### Q9 - health corroboration and owner waiver

- **Sources:** Codex SEC-03 and unresolved question 7; Opus release-observer
  qualification and health concerns.
- **Question:** Should authenticated provider status plus an independent canary
  be required before declaring `HEALTHY`?
- **Owner answer:** Default to yes, but allow the user to skip it.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Dual-source health verification is the default. An explicit
  user waiver is digest-bound to the release envelope and may skip the canary;
  the resulting terminal report is `OBSERVATION_SKIPPED_BY_OWNER`, not
  `HEALTHY`. Without a waiver, disagreement becomes degraded or ambiguous and
  invokes mandatory automatic rollback when the release is eligible.

## Owner-question group 4 - confirmed 2026-08-26

### Q10 - repository memory isolation

- **Sources:** Codex SEC-05 and unresolved question 8; decision brief, Memory
  v2 and MCP surface.
- **Question:** Should memory remain repository-isolated by default, with
  explicit grants for cross-repository retrieval and separate read/ingest
  permissions?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Namespace and caller authorization are enforced at the memory
  service boundary. Cross-repository reads are explicit grants. Read, ingest,
  remote synchronization, and administrative deletion are distinct permissions.

### Q11 - sensitive-content deletion from append-only memory

- **Sources:** Codex SEC-05; Opus SEC-4, failed check 13, and unresolved question
  11.
- **Question:** Should memory allow tombstones, body removal/crypto-shredding,
  and full index purging when secrets, regulated data, or user-requested
  deletions survive ingestion, retaining only a non-sensitive audit digest?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Append-only describes the normal audit lineage, not a ban on
  required secure deletion. A deletion receipt preserves only safe identity and
  reason metadata. All derived indexes, caches, replicas, and future rebuild
  inputs exclude the removed body.

### Q12 - bounded influence of local-model derivatives

- **Sources:** Opus SEC-6; decision brief, Memory v2 and Ollama planes.
- **Question:** Should Ollama-derived tags and query expansion affect ranking
  only within a cap while exact lexical matches and citations to originals are
  guaranteed?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Derived fields cannot suppress an exact identifier/security
  term result, determine trust, or satisfy a citation. Ranking exposes the
  derivative contribution and always cites immutable source bytes.

## Owner-question group 5 - confirmed 2026-08-26

### Q13 - encryption at rest by repository risk

- **Sources:** Codex SEC-05 and unresolved question 8.
- **Question:** Should memory bodies be encrypted at rest by default for
  production/user-data repositories, with warned plaintext configuration
  allowed for development repositories?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Repository risk classification selects the safe default.
  Production/user-data storage is encrypted. Development plaintext is an
  explicit visible configuration, not a silent fallback. Index/cache treatment
  and key lifecycle must preserve the same effective boundary.

### Q14 - evidence-derived host eligibility

- **Sources:** Opus SEC-3, failed check 8, material dissent 5, and unresolved
  question 7; Codex host capability and compatibility findings.
- **Question:** Should host safety eligibility be computed per operation from
  executed, digest-pinned conformance tests rather than adapter declarations?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** A capability manifest records observations and gaps but does
  not grant itself trust. Eligibility combines operation requirements, tested
  host/version evidence, current policy, and expiry. Unsupported capabilities
  fail or degrade only the affected operation.

### Q15 - OpenCode before Goose

- **Sources:** synthesis, reviewer differences; Opus material dissent 4.
- **Question:** Should OpenCode be the first additional host, with Goose
  evaluated separately afterward because of its broader agent lifecycle?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** OpenCode exercises and stabilizes the host portability
  contract. Goose is not rejected, but receives its own later compatibility and
  semantic-overlap review rather than entering as a co-equal first adapter.

## Owner-question group 6 - confirmed 2026-08-26

### Q16 - domain-pack roadmap and individual delivery

- **Sources:** Codex unresolved question 11; synthesis, unresolved owner
  authority 5; decision brief, Domain Packs.
- **Question:** Should all four packs be approved for the roadmap but designed,
  reviewed, and shipped independently beginning with release operations?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** `release-operations`, `product-experience`, `assurance`, and
  `research-knowledge` are roadmap scope, not one implementation batch. Each
  requires its own versioned content, evidence contract, tests, review, and
  rollback.

### Q17 - pack manifests cannot request authority

- **Sources:** Opus SEC-7 and failed check 7.
- **Question:** Should `tools` and `authorityNeeds` be removed from the v1 pack
  manifest entirely?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** A v1 pack describes reasoning/evidence only. Tool and
  authority needs remain in the separately governed workflow, preventing pack
  data from becoming a permission path.

### Q18 - workload- and environment-specific Ollama qualification

- **Sources:** Codex failed check 6 and unresolved question 10; Opus failed
  check 9, recommendation 8, and unresolved question 8.
- **Question:** Should every Ollama workload use provenance-bound held-out
  fixtures, named baselines, sufficient class counts, confidence bounds, and
  corpus-drift requalification?
- **Owner answer:** Yes, with model choice additionally scoped to each customer
  environment. Required context and usable model memory determine the candidate.
  On the owner's RTX 5070 system with a stated 12 GB graphics-memory limit,
  roughly 6-8 GB should be available to the model. A 5090-class system with 32
  GB could permit roughly 24 GB, enabling a larger model with greater reasoning
  and context capability. KStack must determine the right model rather than
  hard-code one.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Qualification begins with a measured environment profile:
  runtime and GPU availability, usable accelerator memory, required reserve,
  CPU/RAM, context demand, workload, latency, and quality. A tested model
  catalog maps profiles and workloads to candidates; benchmarks select among
  fitting candidates. Model identity, digest, quantization, context limit,
  resource cap, corpus, and results are bound into the enablement receipt. The
  current WSL host must first prove GPU access; Windows device presence alone is
  insufficient.

## Owner-question group 7 - confirmed 2026-08-26

### Q19 - automatic selection and explicit model installation

- **Sources:** decision brief, Ollama plane; owner Q18 environment-scoped model
  requirement.
- **Question:** May KStack profile hardware and automatically select the best
  already-qualified model within budget while requiring explicit user approval
  for model download/installation?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Selection is deterministic over a digest-bound qualified
  catalog and measured profile. Pulling a model is a separate network/storage
  side effect and remains ask-tier.

### Q20 - configurable resource reserve

- **Sources:** owner Q18 hardware examples; Ollama resource-risk findings.
- **Question:** Should accelerator/CPU/RAM reservations be configurable, using
  the owner's 6-8 GB of 12 GB and roughly 24 GB of 32 GB examples as starting
  policies while enforcing measured headroom rather than one fixed percentage?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** The profile sets a hard resource envelope and preserves host
  headroom. Selection and benchmarks record actual peak usage and reject a
  candidate that exceeds the envelope.

### Q21 - context overflow behavior

- **Sources:** owner Q18 context requirement; decision brief, benchmark and
  fallback contract.
- **Question:** If required context cannot fit, should KStack use cited
  retrieval/chunking, a smaller qualified model, or configured cloud fallback,
  never silent truncation or budget overrun?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Any reduction is explicit, cited, and quality-tested. When no
  qualified path can preserve the task contract, local acceleration abstains
  and the existing deterministic/cloud path continues.

### Q22 - Jira as a first-class release-automation component

- **Sources:** owner follow-up after Q21; objective requirement to improve the
  previously weak release-automation dimension; existing `kstack-jira` queue
  capability.
- **Owner direction:** Ensure Jira is recorded as Release Automation because
  that dimension previously scored very low.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Jira is both a release workflow adapter and the durable
  human-facing release ledger. One `kstack-release` skill links or creates a
  scoped release record, binds its issue key/version into the approval envelope,
  and automatically posts deterministic state transitions, deployment receipt
  links, health evidence, rollback attempts/results, ambiguity, and final
  status. GitHub/deployment adapters perform the actual dispatch and
  observation. Jira issue text is untrusted input and cannot grant authority,
  change the bound target, or trigger a side effect without the protected
  broker's valid envelope. External Jira writes are included only when the
  user's release approval explicitly covers those exact bounded updates.

## Owner-question group 8 - confirmed 2026-08-26

### Q23 - authoritative memory systems

- **Sources:** owner concern after group 7; decision brief, Memory v2 and Ollama
  planes.
- **Question:** Should Git/GitHub own authoritative KStack artifacts, Jira own
  authoritative ticket/workflow records, and Ollama never store authoritative
  memory?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Memory provenance points to versioned Git/GitHub artifacts
  and revisioned Jira records. Local stores and model products are derived and
  rebuildable. Ollama is neither a system of record nor a workflow ledger.

### Q24 - deterministic retrieval default

- **Sources:** owner memory concern; Opus SEC-6; decision brief, Memory v2.
- **Question:** Should PGlite/BM25 retrieval rebuilt from GitHub/Jira sources be
  the default, with Ollama embeddings enabled only after material benchmark
  improvement?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Exact/lexical retrieval is the portable baseline. An embedding
  index is optional, disposable, provenance-bound, and must improve a named
  retrieval outcome without regressing exact-term guarantees.

### Q25 - bounded Jira memory representation

- **Sources:** Codex SEC-05 and repository-isolation concerns; owner Jira
  direction.
- **Question:** Should Jira memory retain source key, revision, timestamps,
  digests, and approved snapshots, never credentials or unrestricted content
  without explicit scope?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Jira access is least-privilege and field-scoped. Snapshot
  bodies carry scope, provenance, freshness, redaction, and deletion rules;
  credentials remain brokered and outside artifacts.

## Owner-question group 9 - confirmed 2026-08-26

### Q26 - Jira release records for production and development branches

- **Sources:** owner Q22 direction; objective, Release Automation; current Jira
  extension evidence.
- **Question:** When Jira is configured, should production require a linked
  Jira release record while development remains optional?
- **Owner answer:** Yes, and repository setup should explicitly ask whether to
  create the release stack for development too. Multiple branches are common,
  and connecting Jira to GitHub is significant.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Production requires the linked release record when the Jira
  integration is enabled. `kstack-init` asks whether development release
  tracking is enabled. When selected, records bind issue, repository, branch,
  PR, commit/tree, build, environment, and deployment receipts. Parallel branch
  lineages remain distinct, and duplicate-marker/idempotency controls prevent
  repeated ticket updates or submissions.

### Q27 - complete release state machine

- **Sources:** Codex failed check 3 and unresolved question 4; Opus failed
  checks 4-5 and recommendation 4.
- **Question:** Should release automation use a complete deterministic state
  machine covering cancellation, expiry, failure, rollback, ambiguity,
  reconciliation, and manual action?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Round two must include a normative transition table with
  every event, guard, side effect, receipt, timeout, retry eligibility, and
  terminal outcome. It includes cancellation requested/completed, expired,
  dispatch failed, observing, degraded, rolling back, rolled back, rollback
  failed/ambiguous, reconciliation failed, and manual action required. Lease
  fencing prevents duplicate controllers.

### Q28 - safe live qualification boundary

- **Sources:** Opus failed check 11 and unresolved question 10; decision brief,
  Verification Plan.
- **Question:** Should release automation qualify first in staging using
  synthetic/non-user data, bounded blast radius, explicit abort criteria, and
  successful rollback evidence before any production-readiness claim?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Unit/mock evidence cannot produce a production-ready claim.
  Qualification binds environment, data class, target, maximum impact, abort
  predicates, observer evidence, and an exercised rollback. Production with
  user data remains a later, separately authorized qualification.

## Owner-question group 10 - confirmed 2026-08-26

### Q29 - legacy migration, free override, and immediate stop

- **Sources:** Codex failed check 2 and unresolved question 2; owner confidence
  policy across questionnaire groups 1 and 10.
- **Question:** Should exact shipped 90/80/70 defaults migrate automatically,
  while customized legacy values stop for owner disposition?
- **Owner answer:** Yes, while allowing users to override the defaults to any
  valid confidence percentage and to end any round immediately once its gate is
  met, completing only bug fixes afterward.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** Exact known defaults migrate automatically. Unknown/custom
  values are never overwritten silently. First setup and each repository may
  define any valid 0-100 threshold schedule. Once the effective threshold and
  non-numeric blockers clear, improvement rounds end. A later confirmed bug may
  open a bug-fix/QC path, but cannot be used to resume score optimization.

### Q30 - compatible atomic activation

- **Sources:** Codex failed check 5 and unresolved question 9.
- **Question:** Should kernel, broker, schema, adapter, pack, and host versions
  use digest-pinned compatibility matrices and atomic activation, leaving the
  last compatible version active on failure?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** No partial plane upgrade becomes authoritative. Replay uses
  the version/digest set bound to each receipt; unsupported combinations fail
  closed and preserve the prior active set.

### Q31 - owner-waived health status

- **Sources:** owner Q9 waiver; health-verification truthfulness requirement.
- **Question:** If the user skips health verification, should the terminal result
  be `OBSERVATION_SKIPPED_BY_OWNER`, never `HEALTHY`?
- **Owner answer:** Yes.
- **Disposition:** `RESOLVED - OWNER-DECIDED`.
- **Consequence:** The release may complete under the explicit waiver, but no
  unperformed health proof is claimed. Jira and all receipts preserve the waiver
  identity, scope, reason, and expiry.

## Pending questionnaire groups

- None. The source-linked owner questionnaire is complete.

## Reviewer-agreed mandatory technical corrections

The following do not require additional product preference and remain mandatory
for the targeted redesign:

- bind approval principal, execution principal, nonce, audience, revocation,
  policy snapshot, controller/schema, capability, health evaluator, adapter,
  target, credential handle, time, cost, and rollback evidence in the envelope;
- authenticate and anchor receipts rather than treating an unanchored hash as
  producer authentication;
- define the full release transition/event/guard/receipt table, lease fencing,
  idempotency, and reconciliation without blind retry;
- authenticate or independently corroborate health sources unless the owner
  supplies the recorded waiver;
- implement memory caller/namespace ACLs, retention, encryption policy,
  quarantine, deletion, replica/index purge, and rebuild receipts;
- derive per-operation host eligibility from executed conformance evidence;
- make Ollama benchmarks workload-specific and provenance-bound, verify bind
  address/egress, and keep every result non-authoritative; and
- use provisional observer-derived contracts before compatibility is frozen.

## Completeness disposition

Every unresolved question, failed-check premise, security finding, material
dissent item, and materially different recommendation in the Codex and Opus
round-one envelopes maps to Q1-Q31 or to the mandatory technical corrections
above. All owner questions have direct answers. No objective-scope divergence
remains silent. The whole Capability Fabric remains the selected architecture,
but corrections stay attached to their smallest individual slice.

The clarification result is now `ROUND_ONE_CLARIFICATION_LOCKED`. The next
authorized design action is the separately linked confidence-schedule thread.
No implementation is authorized by this record.
