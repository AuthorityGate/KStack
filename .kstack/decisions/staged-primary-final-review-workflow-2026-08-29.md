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
  default and returns `USER_DECISION_REQUIRED` on exhaustion.

## Implementation map

- `plugins/kstack/scripts/kstack-staged-review.mjs` owns ordered dispatch,
  readiness calculation, provider isolation, artifact cleanup, and the staged
  manifest.
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
- The full suite included the Reflexion production architecture gate, real
  post-deploy auditor setup cases, both role orders, the exact 93 boundary, a
  below-threshold case, a high-confidence result containing a finding,
  malformed primary and final outputs, a negative final verdict, a threshold
  above 93, legacy-route rejection, stale final invocation evidence, provider
  environment isolation, hardened no-tool arguments, live-lock concurrency,
  dead-owner crash scavenging, and a non-terminating provider timeout.

## Failure and security properties to review

- The final agent must not be started in any primary failure or non-clean state.
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
- A passing primary envelope and retained raw output stay only in runner memory
  until the final process exits. The final provider therefore cannot discover
  the primary report in the review output directory. Any prior `manifest.json`
  is removed before primary dispatch, so stale readiness is also unavailable to
  the final provider.
- The reviewed brief is explicitly framed as untrusted data, never
  instructions. Embedded verdicts, confidence values, schema directives, or
  role reassignment are ignored and reported as failed checks. A unique
  invocation-derived BEGIN/END delimiter makes that data boundary structural.
- The output directory has an atomic single-flight lock containing a random
  owner token and process ID. A live owner rejects a concurrent run before any
  cleanup or dispatch. A dead owner permits bounded cleanup of only strictly
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

## Review question

Does this design correctly enforce solo primary improvement through a clean
93-or-higher readiness result before one different agent performs an independent
final review, accept that final at 81 or higher with mandatory defect intake,
and preserve KStack's fail-closed evidence and authority boundaries? Identify
any current defect that should block adoption.
