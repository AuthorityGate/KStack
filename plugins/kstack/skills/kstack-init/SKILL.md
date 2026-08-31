---
name: kstack-init
description: Configure KStack for the current repository through an explicit setup conversation. Use only when the user invokes KStack initialization or when kstack-review finds no .kstack/config.json. Do not trigger implicitly for ordinary setup, configuration, review, or coding requests.
---

# KStack Init

Configure KStack without changing the host agent, global memory, or permissions.

## Procedure

1. Read `../../references/CONFIG.md`, `../../references/SAFETY.md`, and
   `../../references/JIRA_TRACKING.md` relative to this skill directory.
2. Inspect the repository read-only to discover facts that should not be asked:
   roots, languages, wrappers, CI, existing agent instructions, deployment
   scripts, Playwright configuration/post-deploy suites, and whether
   `.kstack/config.json` exists.
3. If a config exists, validate it with
   `node ../../scripts/kstack-config.mjs validate .kstack/config.json`. Ask
   whether to review, reconfigure, or leave it unchanged.
4. Conduct the initialization conversation in small groups of no more than
   three decisions. Explain the operational consequence of each choice.
5. Cover every category in `CONFIG.md`, including phase role selection, the
   design/interrogation/QC gates, optional explicit memory, optional Jira Cloud
   queue configuration, the `externalTicketCreation` convention, and separate
   Jira-administration authority. For Jira, ask whether the repository should
   connect an existing delivery stack, preview a new delivery stack, or skip
   Jira. If a project exists but needs a board/backlog, select the distinct
   existing-project/new-board path. Discover the repository, branches, CI, and
   environments before asking. Ask whether this is an ordinary repository
   (default: one dedicated Jira project/space), part of a larger program that
   needs multiple explicitly mapped project/spaces, or a large task that needs
   separately governed phases. The current bootstrap provisions one
   project/space per preview; do not claim automatic multi-space orchestration.
   Ask whether Jira Software or Jira Business is intended. A live apply must
   preflight accessible project types. Jira Software uses a saved-filter Agile
   board; Jira Business uses its native Board view and must not receive a Jira
   Software board POST. A configured project key is not validation.
   Make new project/space creation an available per-project choice. Use
   `kstack-jira-bootstrap.mjs start` to validate and write this
   repository's local Jira enrollment plus exact offline preview; do not rely on
   a manual configuration edit. It replaces the unused default key, binds
   approval-queued tracking to the repository by default, and refuses to reuse
   or overwrite another active delivery record. Configure
   `authority.jiraAdministration` explicitly: `ask` requires approval of the
   exact preview in the current conversation, `allow` permits an explicit owner
   request to proceed, and `deny` disables live project/space or board creation.
   Do not leave the key absent for a project that wants this capability because
   legacy omission fails closed as deny. Approval/apply still requires an
   interactive exact-hash confirmation and verified Jira read-back.
   Ask whether the initial backlog should use KStack's five lifecycle items,
   load a discovered repository `kstack-jira-roadmap-v1` manifest, or be empty
   by explicit owner choice. New and existing-project/new-board previews must
   default to populated, and the roadmap bodies must be bound into the same
   preview digest as the project and board. Never report a populated onboarding
   state from project/board existence alone.
   Configure Jira tracking separately as `off`, `approval-queued`, or
   `automatic`, ask whether enqueue failure is phase-blocking, bind one exact
   configured project key and stable `owner/name` repository namespace, and ask
   whether assignment to an already approved release version may be automatic.
   If yes, record the exact numeric Jira version ID, name, and release date in
   `releaseVersions`; never infer an approval from a name match alone.
   Explain both enabled outputs: every new actionable item begins as forward
   work, and later design/review/implementation/QC/fix/completion/release events
   remain visible on that item as delivery history. Version creation/release is
   always separate Jira administration. `automatic` requires ticket-creation
   authority `allow`; otherwise use `approval-queued`.
   Treat the configured credential source as the repository's single Jira
   authority. For the KStack repository, preserve the existing WSL source and
   do not enroll a native-Windows Jira credential. Native Windows installation
   is a separate host installation target, not a second Jira identity or
   credential target. A Windows Jira invocation must use the repository-bound
   `kstack-jira-wsl.ps1` executor handoff without copying or revealing the
   credential.
   When a web application is deployed, ask whether post-deploy Playwright
   validation is required for development, staging, and production. Default
   production to required. If enabled, read
   `../../references/POST_DEPLOY_VALIDATION.md` and
   `../../references/PRODUCT_EXPERIENCE.md`. Ask the full experience question:
   should this repository adopt its existing brand/design system, create a
   shared experience contract, or record that it has no user-facing surface?
   Discover product principles, tokens, components, assets, critical journeys,
   accessibility coverage, screenshot baselines, performance budgets, and
   field telemetry before asking. Preserve repository-owned systems; never
   replace them with a KStack aesthetic. A user-facing repository must create
   and validate `.kstack/experience.json` and use post-deploy plan v2 with its
   exact contract path. Then discover existing Playwright
   config and suitable full-suite paths, and write the non-secret
   `.kstack/post-deploy-validation.json` plan only after confirming its allowed
   origins, projects, timeouts, retry bound, console/network policy, and skip
   policy. Initialization validates the plan offline but never launches a
   browser or contacts a deployment. Missing Playwright is a reported setup
   requirement, not permission to install it.
   Prefer the active host for init, objectives, and ordinary review; ask which one or two
   roles should design, implement, interrogate deviations, and perform QC.
   Explain that roles change responsibility and token use, never authority.
   Obtain the design improvement cycle limit (`maxRounds`) and the ordered
   primary/final roles. Explain that the primary works alone until a clean
   confidence of at least 93, then the other role performs one independent
   final review. Configure its separate acceptance threshold, 81 by default;
   accepted final defects become mandatory bug-fix backlog intake rather than
   another design cycle. Configure `secondaryReview.mode` as `triggered`, keep
   final review/different-agent/high-risk-different-family protections enabled,
   and obtain the deterministic audit sample rate (0-1000 permille, default 0).
   Explain the closed trigger set and that round count never triggers another
   model: `OWNER_REQUESTED`, `ROADBLOCK`, `MATERIAL_UNCERTAINTY`,
   `INDEPENDENT_FINAL_REVIEW`, `HIGH_RISK_BOUNDARY`, `MATERIAL_DISSENT`, and
   `AUDIT_SAMPLE`. Codex or Opus may hold either role. Track cycles and cumulative
   provider invocations, not wall-clock timing. Budget exhaustion always returns control to the user; it is not
   an automatic approval or an unbounded retry permission. Configure the design
   confidence tiers: rounds
   1-10 use `minimumConfidence`, round 11+ uses
   `minimumConfidenceRound11Plus`, and only an owner-explicit skill-class tag
   uses `minimumConfidenceSkillClass` regardless of round. Never infer that
   per-thread tag from content.
   Never infer external authority from repository capabilities or from a broad
   statement such as "full access."
6. Explain that after the first completed design round, a mandatory
   `kstack-design-clarify` session asks the human user every question derived
   from reviewer disagreement, uncertainty, unverified assumptions, and scope
   divergence, then writes a locked project-local decision record. It is not
   configurable and is distinct from `kstack-interrogate`, which classifies
   later implementation-plan drift. If persistence or edit authority prevents
   the locked record, design cannot proceed to round 2.
7. Restate the complete authority matrix and dual-model fallback behavior for
   confirmation before writing.
8. Generate the base JSON with `node ../../scripts/kstack-config.mjs template`,
   apply the confirmed answers, and write `.kstack/config.json` with the host's
   normal file-editing tool.
9. Validate the written file. Fix schema errors only; do not change a confirmed
   preference to make validation pass.
   After validation succeeds, enroll or refresh bounded project safety with
   `node ../../scripts/kstack-safety-admin.mjs install --project-root .`.
   When memory is enabled, run `kstack-memory.mjs status`. Report `empty` as an
   incomplete rollout and offer to ingest one accepted Markdown/JSON artifact;
   initialization must not describe memory as operational while both artifact
   counts are zero.
10. Summarize the active configuration and show the host-native commands:
   `$kstack-review`, `$kstack-interrogate`, and `$kstack-qc` in Codex; the same
   names with `/` in Claude Code. When memory is enabled, also show
   `$kstack-memory` and `/kstack-memory`. When Jira is enabled, show
   `$kstack-jira`/`/kstack-jira` for offline drafting, the host-side
   `kstack-jira.mjs doctor` command, and the selected delivery onboarding state
   from `jira.deliveryRecordPath` when configured, otherwise from
   `.kstack/jira-delivery-stack.json`. Initialization may run the offline
   `kstack-jira-bootstrap.mjs preview` or `show` operations while configuration
   is still being decided. Once the configuration has been written and
   validated, this same skill and host session may finish the repository's
   explicitly requested Jira project/space bootstrap with `approve` and
   `apply`; do not force a handoff to another skill, console, or agent. The
   active host agent may drive the interactive PTY and enter the exact preview
   hash. Under `ask`, first obtain owner approval for that exact preview in the
   current conversation; under `allow`, the explicit project/space creation
   request supplies that authority. Approval and apply still require an exact
   hash match and verified Jira read-back. Initialization without that request
   and authority remains offline. Every initialized repository receives this
   capability; it is not reserved for the KStack repository or a central Jira
   administration session. A repository that selects `skip` retains the ability
   to invoke `kstack-jira` later; that skill may enable and bind Jira in the
   repository-local configuration before continuing through the same onboarding
   lifecycle. `jira.enabled: false` means tracking and live Jira operations are
   currently inactive, not that the project is permanently barred from creating
   its own Jira project/space.
   When citation grounding is advisory, also provision the committed
   `.kstack/fixtures/citation-grounding/exact-reproduction-v1.json` fixture and
   show the host-side `kstack-citation-admin.mjs check-platform`, `smoke`, and
   `shadow` sequence. Host invocations such as
   `kstack-init --check-citation-grounding-platform`,
   `--smoke-citation-grounding`, `--shadow-citation-grounding`,
   `--sweep-citation-grounding-staging`, and the documented repair/reset flags
   map one-for-one to that script's same-named long options. Run maintenance
   commands only when explicitly requested.
   For user-facing repositories, also show `$kstack-experience` and
   `/kstack-experience`, the contract digest, required evidence lanes, and
   manual accessibility/user-validation work that remains outside automation.

## Boundaries

- Do not edit product code during initialization.
- Do not install CLIs, authenticate providers, or test deployments.
- A missing Codex or Claude CLI is a capability result, not permission to
  substitute another model silently.
- Default memory to off unless the user explicitly enables it. If enabled,
  automatic per-turn injection remains disabled and Git synchronization remains
  manual.
- Legacy configuration without `workflow.phaseModels` remains readable, but
  Interrogation and QC require re-running initialization before they can gate a
  workflow.
