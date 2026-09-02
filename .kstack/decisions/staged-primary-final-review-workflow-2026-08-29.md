# Staged primary-readiness and independent-final review workflow

Date: 2026-08-29
Scope: material KStack design and process-improvement review
Status presented for review: implemented candidate

## Objective

Replace routine simultaneous two-agent review with an ordered workflow that lets
one agent own improvement until the work is genuinely ready, then spends one
different agent invocation on an independent final review. The primary may be
Codex or Claude Opus; the other configured agent becomes the final reviewer.

## Required protocol

1. Treat `workflow.phaseModels.design` as an ordered pair: primary first,
   independent final second. The default order is Codex then Claude Opus, and
   the reversed order is valid.
2. Invoke only the primary at the beginning of a cycle.
3. Do not invoke the final reviewer unless the primary returns `approve`, an
   integer confidence at or above 93, zero failed checks, zero security
   findings, zero material dissent, and zero unresolved questions.
4. Once that predicate passes, invoke the final reviewer exactly once on the
   same neutral decision brief. Do not expose the primary report, its confidence,
   or a synthesis to the final reviewer.
5. Bind each provider envelope to the decision-brief SHA-256 and a distinct
   invocation ID. The final design gate independently reproduces the primary
   readiness predicate and checks the ordered roles and invocation identities.
6. A primary result below the predicate has status `primary-not-ready`; the
   final provider is recorded as `not-dispatched`. An invalid primary envelope
   has status `primary-failed`. A missing or invalid final envelope after a
   passing primary has status `final-review-failed`. A valid final `approve` or
   `revise` at or above 81 produces `staged-complete`; its concrete defects are
   emitted as mandatory bug-fix intake. A final `block` or score below 81 has
   status `final-not-approved`.
7. Accepted final-review defects do not start another design cycle. They become
   mandatory backlog/implementation fixes. Only a final `block` or score below
   81 returns the work to the primary for another solo repair cycle, which again
   requires a fresh clean primary readiness result before final review.
7a. Every cycle declares its position in the repair chain: exactly one of
   `--first-cycle` or `--prior-manifest <prior staged manifest>`, resolved
   inside the project root. Neither or both is `prior-cycle-evidence-missing`
   at zero provider invocations. The declared position is recorded as
   `priorCycle` in the manifest and independently checked by the design gate.
   Because the gate now requires that record, staged evidence produced before
   this change is not gate-admissible. The only such evidence in this repository
   is cycle 1 of this thread, which was `staged-complete` and would previously
   have gated ready; it was owner-rejected, so nothing admissible is lost.
7b. After a `final-not-approved` prior cycle the repaired decision brief must
   differ from the brief that was rejected. An equal design digest is
   `convergence-blocked` at zero provider invocations. A stateless final
   reviewer given byte-identical input returns the same objection, so without
   this the loop consumes the budget without converging. The constraint is
   scoped to `final-not-approved` deliberately. Cycles 3 and 4 of this thread
   ran on one identical digest and were right to: cycle 3 was
   `final-review-failed`, a provider crash, and the correct response to a crash
   is an identical retry. A delta is required only once the final reviewer has
   actually judged the brief.
7c. The repaired brief must also carry a `## Prior final review feedback`
   section recording what the rejected final review found and how the design
   changed. Its absence is `prior-feedback-missing` at zero provider
   invocations. This is the defined and only feedback path from a rejected
   final review back to the primary: the findings travel as brief content that
   both roles see. No raw cross-provider artifact, confidence value, or verdict
   crosses. A re-invoked final reviewer remains stateless with respect to its
   own prior review.
7d. The primary readiness predicate reads structured fields, so it also scans
   `recommendation` and `strongestObjection` against a bounded lexicon of
   concern terms whenever the primary reports `approve` with all four arrays
   empty. A match is `primary-not-ready` with the matched terms recorded in
   `primaryReadiness.proseRouting`, and the design gate reproduces the check.
   This is a fail-closed heuristic, not a guarantee: it can fire on a negated
   mention and cannot see a concern phrased outside the lexicon.
8. Reviewer completion never grants implementation authority. Existing owner
   clarification, confidence tiers, zero-finding gate, implementation
   interrogation, QC, mutation permissions, and Jira authority remain in force.
9. Keep the former dual-review runner available for legacy evidence
   compatibility. Once staged mode is configured, the design gate rejects
   legacy dual-review evidence; legacy admission requires a configuration that
   omits both `reviewSequence` and `secondaryReview`.

## Configuration and compatibility

- `workflow.designGate.minimumConfidence` defaults to 93.
- `workflow.designGate.reviewSequence.mode` is
  `primary-then-independent-final`.
- `workflow.designGate.reviewSequence.primaryReadinessConfidence` is constrained
  to the inclusive range 93 through 100.
- `workflow.designGate.reviewSequence.finalAcceptanceConfidence` defaults to 81
  and is constrained to the inclusive range 81 through 100.
- `workflow.designGate.secondaryReview` is the authoritative threshold source;
  validation requires the `reviewSequence` compatibility values to match it.
- Legacy configuration may omit both `reviewSequence` and `secondaryReview`;
  supplying exactly one is invalid. An explicitly invoked staged runner then
  uses fail-safe 93/81 values from the shared policy resolver.
- The effective staged threshold is the greater of the configured primary
  readiness threshold and the applicable design-gate tier. A tier above 93
  suppresses final dispatch until the primary reaches it; later-round and
  skill-class tiers cannot lower a staged review below 93.
- `workflow.phaseModels.design` must contain exactly Codex and Claude Opus once
  each, in the desired order.
- The decision brief is the canonical design artifact, not a claim that design
  review replaces code review. Deterministic checks are objective gate inputs,
  and KStack's separate implementation interrogation and ≥95 QC review inspect
  the implemented diff and verification evidence before completion.
- A primary unresolved question is retained in its envelope and blocks final
  dispatch. Owner-directed questions return to the existing mandatory owner
  clarification gate; they may not be suppressed or treated as clean readiness.
- Existing material-design budgeting limits the workflow to 42 cycles by
  default (20 in this repository's configuration) and returns
  `USER_DECISION_REQUIRED` on exhaustion.
- One staged cycle costs exactly one of those cycles, whether the final
  reviewer ran or was recorded `not-dispatched`. The budget counts cycles, not
  provider invocations; the one or two invocations a cycle spends are reported
  separately as `providerInvocationCount`. This follows the existing operator
  ruling in `kstack-design/SKILL.md` that a pre-threshold cycle spends one
  primary invocation and a readiness-passing cycle adds one final invocation,
  against a `maxRounds` budget expressed in rounds. The runner records
  `cycleBudget` and returns `review-budget-exhausted` at zero provider
  invocations when the declared cycle exceeds `maxRounds`.
- Legacy cutover. Enabling `reviewSequence` makes existing dual-review evidence
  non-admissible immediately, so it is a cutover pass, not a configuration
  edit. Before enabling it, enumerate every review directory whose manifest
  status is `dual-complete` and record, per thread, whether the thread is still
  in flight — reviewed but not yet implemented and gate-approved. A thread that
  is not in flight needs nothing. A thread that is in flight is re-reviewed
  under the staged protocol against its current brief, as `--first-cycle` in a
  new output directory, before implementation continues. The temporary
  fallback remains a configuration that omits both `reviewSequence` and
  `secondaryReview`; it is for finishing a single thread already
  mid-implementation and its use is recorded.
- For this repository at the time of writing, the enumeration finds 318
  `dual-complete` review directories, the most recent created 2026-08-26T20:24Z,
  all predating commit `30a9ec8` (2026-08-30), which enabled `reviewSequence`.
  Their threads (`design-confidence-schedule`, `release-automation-jira`,
  `host-portability`, `memory-maturity`, `domain-breadth-packs`) have decision
  records dated after that commit, so this record does not assert that none is
  in flight; the procedure above applies to any that is.

## Implementation map

- `plugins/kstack/scripts/kstack-staged-review.mjs` owns ordered dispatch,
  readiness calculation, provider isolation, artifact cleanup, the staged
  manifest, the platform preflight, the cycle-position and convergence gate,
  cycle-budget accounting, and lock ownership.
- `plugins/kstack/scripts/kstack-review-schema.mjs` owns the prose-routing
  signal shared by the runner and the gate.
- `plugins/kstack/scripts/kstack-design-gate.mjs` validates staged evidence and
  retains legacy dual-manifest support.
- `plugins/kstack/scripts/kstack-config.mjs` owns defaults and closed validation.
- `.kstack/config.json` enables the new protocol for this repository.
- `plugins/kstack/skills/kstack-design/SKILL.md` and
  `plugins/kstack/skills/kstack-init/SKILL.md` define operator behavior.
- `plugins/kstack/references/DUAL_REVIEW.md`,
  `plugins/kstack/references/CONFIG.md`, and `README.md` describe the public
  contract and explicitly reject both-agent dispatch on every improvement cycle.
- `tests/staged-review.test.mjs` and
  `tests/fixtures/fake-staged-reviewer.mjs` cover the new state transitions.

## Deterministic evidence

- Focused workflow suite:
  `node --test tests/config.test.mjs tests/design-gate.test.mjs tests/dual-review.test.mjs tests/staged-review.test.mjs`
  passed all four test files with no failure.
- Skill validation:
  `quick_validate.py` accepted both modified skill directories.
- Install-health inventory:
  `node tests/helpers/generate-install-health-audit-manifest.mjs --check`
  passed after manifest regeneration.
- Full repository suite after the trigger-policy, independent-review, and
  isolation repairs and closure hardening: a serialized full run completed with 975 tests, 974 passed, zero
  failed, zero cancelled, and one Windows-only synthetic test skipped on Linux.
- Full repository suite after the convergence, feedback-path, budget, platform,
  prose-routing, credential-scoping, isolation, and lock-liveness repairs:
  `npm test` completed with 1088 tests, 1086 passed, zero failed, zero
  cancelled, and two Windows-only synthetic tests skipped on Linux. The staged
  suite itself grew from 38 to 55 cases, adding coverage for a repeated
  rejected brief, a changed brief with and without carried feedback, both
  undeclared and doubly declared cycle position, invalid and escaping prior
  evidence, budget exhaustion, one-cycle-per-round charging with and without
  final dispatch, a structurally clean report with a concern in prose, the
  gate's reproduction of both new checks, per-provider credential scoping, the
  review directory as seen from inside the final provider, a reused-PID lock,
  a matching-command-line live lock, the POSIX-only refusal, and the exact
  scanned surface of the outbound scan.
- The full suite included the Reflexion production architecture gate, real
  post-deploy auditor setup cases, both role orders, the exact 93 boundary, a
  below-threshold case, a high-confidence result containing a finding,
  malformed primary and final outputs, a negative final verdict, a threshold
  above 93, legacy-route rejection, stale final invocation evidence, provider
  environment isolation, hardened no-tool arguments, live-lock concurrency,
  dead-owner crash scavenging, and a non-terminating provider timeout.

## Failure and security properties to review

- The final agent must not be started in any primary failure or non-clean state.
- Outbound scanning covers exactly the fully wrapped reviewer prompt — stage
  instructions, rules, and the framed decision brief — as one byte string, and
  throws before the provider work directory is created. The response schema is a
  source constant and is not scanned; the version probe sends no prompt. The
  matcher set is the shared `MatcherSetV1` list in `kstack-safety-matchers.mjs`.
  Its false-negative posture is explicit: it catches only the shapes that list
  names, and it is a last-line control rather than a substitute for keeping
  protected values out of a decision brief.
- Outbound secret scanning throws before provider dispatch on any match.
  Provider output is passed through configured redaction; temporary
  prompt/schema/stdout/stderr files use mode `0600` below an output directory
  created with mode `0700` and are removed in a `finally` block.
- Provider processes are read-only and ephemeral; Codex uses `--ephemeral`,
  `--ignore-user-config`, a read-only sandbox, and explicit disabling of shell,
  code-mode host, apps, browser, computer, hooks, multi-agent, and skill-search
  features. Claude uses `--no-session-persistence`, safe and restricted modes,
  plan permission mode, no tools or MCP servers, and disabled slash commands.
  Review does not authorize repository or external-state mutation.
- Each provider starts in a unique mode-`0700` work directory containing only
  its mode-`0600` prompt/schema/output files. It receives a minimal allowlisted
  process environment needed for locale, transport, certificate, and provider
  authentication; unrelated repository credentials such as Jira variables are
  not inherited.
- The runner, not either provider, computes the design digest and unpredictable
  invocation IDs and constructs each envelope. The gate matches every envelope
  to the current manifest's per-provider invocation ID, design digest, raw
  output digest, and envelope digest.
- The workflow is POSIX-only and declares it before acting. The runner refuses a
  non-POSIX host, and a host without native `O_NOFOLLOW`, before the output
  directory lock is taken and before any provider is spawned, so no invocation
  is spent discovering it. Every confidentiality and containment property below
  is stated in POSIX terms because those are the only terms in which it holds:
  mode `0700`/`0600` at rest, termination of the negative process group,
  `O_NOFOLLOW` reopen, reparse-free path checks, directory `fsync`. Windows
  parity is not claimed and no weaker Windows guarantee is offered; the runner
  does not run there. Deterministic evidence is Linux-only, matching the
  supported platform exactly. This removes no capability: the runner already
  could not complete on Windows, because the required `O_NOFOLLOW` reopen threw
  at the consumption receipt — after a primary invocation had been spent. The
  refusal now happens before any invocation, and is stated rather than
  discovered.
- A passing primary envelope and retained raw output stay only in runner memory
  until the final process exits. Mode bits are not what produces this isolation:
  both providers run as the same OS user, and POSIX permissions do not separate
  same-uid processes. The load-bearing controls are ordering and tool
  disablement — the primary's private work directory including its stdout and
  stderr is removed in a `finally` block before the final provider is spawned,
  and the final provider has no filesystem read primitive. A test lists the
  review directory from inside the final provider process and asserts it holds
  only the single-flight lock, the consumption receipt, and that provider's own
  work directory. Any prior `manifest.json` is removed before primary dispatch,
  so stale readiness is also unavailable to the final provider.
- Each provider child receives only its own provider credential. The allowlist
  adds `CODEX_HOME` and `OPENAI_API_KEY` for Codex and `CLAUDE_CONFIG_DIR` and
  `ANTHROPIC_API_KEY` for Claude, never both, and a test asserts each child
  fails if it can see the other's variable. `HOME` is shared, so a file-based
  credential under a provider's own home directory is not scoped by this
  control; the read-only sandbox and the no-tool invocation are what bound it.
- The evidence set is unsigned, and this is an accepted, disclosed limit rather
  than an implied guarantee. Every digest, invocation ID, and receipt is
  computed by the runner with no protected key material, so anything with write
  access to the output directory can forge a self-consistent set. The gate
  detects tampering with part of the evidence, never wholesale replacement of
  all of it; expanding the threat model to that requires a separately protected
  external ledger.
- The reviewed brief is explicitly framed as untrusted data, never
  instructions. Embedded verdicts, confidence values, schema directives, or
  role reassignment are ignored and reported as failed checks. A unique
  invocation-derived BEGIN/END delimiter makes that data boundary structural.
- The output directory has an atomic single-flight lock containing a random
  owner token, a process ID, and the owner's command line. A live owner rejects
  a concurrent run before any cleanup or dispatch. A live PID whose observable
  command line differs from the recorded one is a reused PID and is reclaimed,
  so a recycled PID cannot wedge the directory permanently; a host that cannot
  observe the command line stays conservative and treats the owner as live. The
  operator recovery for a lock wedged that way is to confirm the recorded PID is
  not a staged review with `ps -p <pid> -o args=` and then delete
  `<out-dir>/.staged-review.lock`. A dead owner permits bounded cleanup of only strictly
  named provider work directories; malformed or symlinked lock/work paths fail
  closed. A crash-left regular file with a strictly valid provider work/probe
  name is removed; links and other special file types fail with an actionable
  closed error.
- Every provider uses its configured finite timeout. Timeout sends termination
  to the isolated POSIX process group, escalates to kill after a two-second
  grace period, and records provider failure instead of readiness.
- Stale provider artifacts may be removed only before primary work in an
  unconsumed directory. Advisory review requires a distinct empty directory and
  cannot delete staged evidence. Once secondary dispatch is consumed, the
  directory is one-shot and any reuse fails closed. The replay/advisory-empty
  fence runs before invalid-design and disabled-mode early returns, so those
  paths cannot replace consumed evidence.
- Citation grounding remains reported explicitly as the legacy direct route in
  the staged manifest. It is not represented as a v2 grounded packet.
- The focused runtime-maturity Host/Domain batch follows the same final-stage
  rule. Its packet contract asks Opus for actionable arrays rather than only
  counters. At confidence 81 or higher, clean approval is admitted as `clean`
  and `REVISE` is admitted as `bugfix-only`; the admission receipt binds every
  failed criterion, security finding, dissent item, and unresolved question as
  mandatory implementation intake. This applies to every reported severity;
  the 81 threshold controls design-stage routing, not whether a security defect
  must be fixed. Below 81 is rejected. Admission does not itself qualify a Host,
  activate a pack, close Jira, or waive any bug fix.
- Selection of the configured workflow is standing authorization for every
  qualifying independent final-review packet. A clean primary readiness result
  automatically releases the configured independent final review after secret
  scanning. No extra user-entered authorization phrase, packet/batch hash, or
  authorization file is required. Any approval imposed by the provider
  execution host remains an external boundary and is not a KStack packet rule.
  Runtime batch manifest v2 retains a
  deterministic `batchDigest` solely to bind the exact packet set; secret
  scanning, fixed provider/model selection, no-tool sessionless execution,
  result-schema validation, and mandatory bug-fix intake remain enforced.
- Material design is permanently classified `high`; configuration validation
  rejects an ordinary downgrade. The classification, effective threshold, tier
  inputs, normalized round, resolved executable/launcher digests, configured
  arguments/model, and reviewer availability are bound before dispatch.
- Provider family is measured with a bounded version probe of each resolved
  backend and bound by probe-output digest; role labels alone carry no family
  authority. Output matching more than one provider family is unavailable and
  fails closed. Both roles require verified family evidence before required
  high-risk dispatch; `unverified` cannot satisfy independence. Same resolved
  execution backends fail even if arguments or role names differ. The gate also
  compares the bound requested command, configured arguments, and model to the
  live validated configuration.
- Secondary dispatch exclusively creates a durable consumption receipt in its
  output directory. Cross-process reuse of that directory fails closed; a crash
  after consumption requires a fresh directory. On POSIX the receipt file and
  containing directory are fsynced before provider dispatch. The design gate reconstructs
  the decision and validates the receipt schema and exact byte hash before
  admission. Wholesale replacement of the
  complete local evidence directory remains outside the stated threat model.
  The deterministic gate intentionally does not re-run provider binaries; it
  validates the runner's closed, digest-bound backend evidence and independence
  relationships. A protected external ledger is required to expand the threat
  model to wholesale evidence replacement.
- Advisory evidence, secondary-consumption receipts, and gate receipt reads
  require native `O_NOFOLLOW`. A host lacking that control receives an explicit
  unavailable error; inode comparison is never accepted as a silent fallback.
- Process interruption can leave provider artifacts without a completed
  manifest only after artifact publication begins. Such artifacts are not
  gate-admissible because the staged manifest, current per-provider invocation
  IDs, and exact digests are required. Deliberate replacement of an entire local
  evidence set is outside this untrusted-local-files threat model and requires a
  separately protected evidence ledger.
- SIGKILL or host loss can bypass `finally`; mode-`0700`/`0600` permissions
  preserve confidentiality at rest, and the next run scavenges a dead owner's
  strictly named work directory before any provider dispatch. The design does
  not claim cryptographic secure deletion from journaling or flash media.

## Acknowledged tradeoff and declined changes

This workflow removes cross-model coverage from every improvement cycle and
concentrates the second perspective in one terminal pass whose outcomes are
accept or reject. A design-level blind spot the primary carries across all
cycles therefore has one narrow chance to be caught, because downstream
implementation interrogation and the >=95 QC review inspect the implemented
diff, not the design reasoning. That is the deliberate cost of the protocol,
accepted for the invocation saving, and it is the reason the final reviewer sees
the same neutral brief from scratch rather than a synthesis.

Two changes proposed by the prior final review are declined rather than
deferred. Making the dispatch predicate severity-aware — blocking on medium and
above while requiring explicit disposition of low findings — is a change to an
owner-set gate: `requireZeroSecurityFindings` and the zero-finding predicate are
existing configuration and standing policy, not artifacts of this design.
Restating the predicate as a bug-fix rather than a policy change would be
wrong. The concern behind it, that an all-severity predicate reading only
counters creates pressure to under-populate the arrays, is instead answered by
the prose-routing check in protocol item 7d, which makes under-populating them
visible rather than free. Signing the local evidence set is likewise declined:
no signing precedent exists in this repository, and the honest disclosure above
is the correct response at this scope.

## Review question

Does this design correctly enforce solo primary improvement through a clean
93-or-higher readiness result before one different agent performs an independent
final review, accept that final at 81 or higher with mandatory defect intake,
and preserve KStack's fail-closed evidence and authority boundaries? Identify
any current defect that should block adoption.
