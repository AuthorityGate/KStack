# KStack configuration

KStack stores project configuration in `.kstack/config.json`. Do not write to
the host's `CODEX_HOME`, Claude settings, shell startup files, or global memory.

The initialization conversation must obtain explicit choices for:

1. Project name and repository roots.
2. Objective questioning depth: `focused`, `deep`, or `exhaustive`.
3. Review scope: `change`, `repository`, `environment`, or `full`.
4. Design lanes to include: product, UX, architecture, data, security,
   operations, or project-specific lanes.
5. Implementation transition: plan only, ask after design, or continue after an
   explicit design approval.
6. Design-gate confidence tiers, `citationGrounding` (`off` or `advisory`),
   required reviewers, deterministic checks, and mandatory
   zero-security-finding and zero-material-dissent rules. Citation grounding
   defaults to `off`; advisory failures are reported as `wouldBlock` and do
   not change the existing gate decision. Before advisory becomes effective,
   run the citation admin `check-platform`, `smoke`, and `shadow` lifecycle in
   that order. The native addon is built only on the first command that crosses
   the native boundary; discovery, installation, startup, off mode, and a
   rejecting ordinary state prefilter do not build or load it.
   Also obtain the material-design round limit: 1-20 complete dual-model rounds.
   Each round is one Codex plus one Opus dispatch. The default is four rounds.
   Track and report the round number and cumulative provider invocations, not
   wall-clock timing. The round limit stops further dispatches at
   `USER_DECISION_REQUIRED`; only the owner may explicitly amend it after seeing
   cumulative rounds and invocations.
   The direct-user clarification gate after the first completed design round is
   mandatory and not configurable. Explain that it must write a locked
   project-local decision record before round 2; disabling persistence or edit
   authority therefore blocks design beyond round 1.
   `minimumConfidence` is the round 1-10 threshold (90 by default and 90-100
   when configured). `minimumConfidenceRound11Plus` is the round 11+ threshold
   (80 by default and 80-100 when configured). `minimumConfidenceSkillClass`
   is the threshold for an operator-explicitly tagged narrow, low-blast-radius
   tooling-convenience thread (70 by default and 70-100 when configured), and
   overrides the round tier. The gate does not infer this class from content.
   Invoke it with `--round N`; omit an unavailable or unrecognized round to
   use the round 1-10 tier. Add `--skill-class` only for an explicitly tagged
   skill-class thread.
7. Per-phase roles: one or two of `active`, `codex`, `opus`, and `fable` as
   allowed by the schema. Material design is always exactly Codex and Opus;
   implementation uses one role; Interrogation and QC use one independent role
   by default and may use both. Resolve `active` to the current host and prevent
   duplicate reviewer identities at runtime.
8. Interrogation and QC gates: fixed minimums of 93 and 95, two Interrogation
   redesign rounds, and three counted QC remediation rounds. QC rounds 1-2 are
   ordinary Codex/Opus remediation; round 3 is mandatory Fable-directed
   remediation. A failure after round 3 returns `USER_DECISION_REQUIRED`.
   Earlier skill prose called that failure the "round-4 outcome," but it is the
   outcome of three remediation attempts, not a fourth remediation round.
   High-risk changes require dual QC.
9. Dual-model mode: off, preferred, or required; behavior when a provider is
   unavailable; executable commands, optional argument prefixes, model names,
   effort, and timeouts. Argument prefixes allow shell-free commands such as
   `node /path/to/provider-cli.mjs`.
10. Separate authority for inspection, edits, tests, commit, push, pull request,
   merge, deployment, device installation, destructive actions, the
   prose-level `externalTicketCreation` convention, and Jira administration.
   Legacy configuration without `jiraAdministration` reads as `deny`; new
   initialization defaults it to `ask`. Ticket creation never implies authority
   to create or change Jira projects, filters, boards, workflows, components,
   versions, or repository links.
11. Persistence scope, cross-session behavior, raw-output retention, and secret
   redaction.
12. Optional explicit memory: external body and index paths, namespace, trust,
    private remote, manual sync, retrieval limits, and separate authority for
    remote creation, clone, fetch, integration, commit, push, and conflicts.
13. Verification expectations, including toolchain/runtime discovery, artifact
    identity, and preservation of user data.
14. Optional broader planning-lens trial settings. The mechanism is
    default-off and accepts only owner-named objective IDs mapped to the closed
    `strategy`, `developer-experience`, and `strengthened-product-ux` catalog.
    See `PLANNING_LENS_TRIAL.md`; trial artifacts must stay in an
    access-controlled directory outside the worktree.
15. Optional virtual engineering panels under `workflow.panel`. The feature is
    default-off and has no default roster. `shipped` accepts 2-4 required
    voters and 0-2 advisers; `hard` accepts 2-16 and 0-8 and requires a linked
    capacity-policy digest. Each panel defines an integer 1-100 threshold,
    adapter, data class, external author, and ordered voter/adviser slots. Each
    slot pins a persona and a configured `models` backend directly; no separate
    backend-registry file is loaded. Provider family is runner-bound
    (`codex` is `openai`; Claude-compatible backends are `anthropic`). `fable`
    and aliases selecting the configured Fable model are rejected because
    Fable is mediator-only. Persona-catalog and state paths are normalized
    distinct project-relative paths. Project persona records replace a whole
    default record and bind its prior digest. `document-v1`, `plan-v1`,
    `code-review-v1`, and `opaque-review-v1` currently use the same strict
    generic evidence packet; the adapter is a label, not a deep format parser.

    Paid shadow requires shadow stage, positive run authorization, an
    API-aware aggregate-billing broker, complete receipts, and qualification
    evidence. Production additionally requires its enable flag, linked policy
    digest, Linux isolation/filesystem/egress/corpus evidence, and the required
    provider-family count. A one-family setting requires a linked owner risk
    decision. The shipped CLI providers are development-only and expose no
    production qualification/broker loading path. The module's injectable
    broker and qualification arguments are a test/future-integration seam, not
    production evidence, so unsupported CLIs remain ineligible.

    Runtime state is single-process and local. Writes are atomic, and physical
    run inventory is checked against attempt-count, per-attempt, run-record,
    and aggregate caps. There is no multi-process lease, comprehensive crash
    recovery, distributed coordination, or automatic retention cleanup;
    interrupted temporary artifacts make later operations fail closed pending
    operator inspection.

Generate a starting document with:

```bash
node <kstack-plugin-root>/scripts/kstack-config.mjs template
```

After writing the user's answers, validate with:

```bash
node <kstack-plugin-root>/scripts/kstack-config.mjs validate .kstack/config.json
```

Memory defaults off. When enabled, `retrieval` remains `explicit`,
`contextInjection` remains `disabled`, and `sync` remains `manual`.
Enabled memory with zero body and index artifacts is `empty`, not operational;
initialization reports it and offers explicit ingestion of an accepted
Markdown/JSON artifact.

Configuration created before `workflow.phaseModels` remains valid for existing
workflows. Re-run `kstack-init` before using Interrogation or QC as a gate.

All phases receive the same authority matrix. Phase roles are a routing and
token-budget choice only; they cannot add or remove authority.

Never infer permission for an external action from permission for a different
action. For example, edit permission does not imply commit permission; commit
does not imply push; push does not imply merge; test deployment does not imply
production access; device testing does not imply uninstalling an app.

Optional `jira` configuration is validated by the same reader. Jira Cloud v1
uses an exact one-label `.atlassian.net` origin, configured project/issue-type
pairs, env or safely-opened file credentials, static labels, request timeout,
`maxAttempts` as total physical POSTs (including the first), approval TTL, and
an installation-wide dry-run switch. Run `kstack-jira.mjs doctor` after
configuration: the suffix check is only a typo/DNS guard, so doctor verifies
`/rest/api/3/myself`, smoke-tests createmeta, permissions, and cursor-paginated
`POST /rest/api/3/search/jql`, and warns about issue-security schemes.

Optional `jira.tracking` selects the repository's continuous work/history
projection. `mode` is `off`, `approval-queued`, or `automatic`; `required`
decides whether failure to durably enqueue blocks phase advance;
`repositoryNamespace` is the stable `owner/name` identity and is required when
tracking is enabled; `projectKey` must reference one configured Jira project;
and
`automaticVersionAssignment` permits assignment only to an exact
`releaseVersions` entry binding Jira's numeric ID, name, and release date.
The provider read-back must also prove that the version belongs to the bound
project and is already released. `automatic` requires
`authority.externalTicketCreation: allow`. It never grants Jira project,
workflow, board, filter, or version administration. Legacy configurations with
no `jira.tracking` behave as `off`.

Enabled tracking has two inseparable outputs: every new independently
actionable item is created as forward work, and every material lifecycle event
is retained as its Jira history. See `JIRA_TRACKING.md`. `approval-queued`
keeps provider writes behind the existing Jira draft approval flow;
`automatic` performs marker-reconciled issue creation and history projection
under its explicit repository authority.

When Jira is considered during initialization, ask whether this repository will
connect an existing Jira delivery stack, preview a new one, or skip Jira. Treat
an existing project that needs a new board/backlog as a separate supported
subcase. Store onboarding evidence in `.kstack/jira-delivery-stack.json`; a
configured project key is not proof that a project, board, filter, backlog, or
release mapping exists. New previews default to one Jira Software project, one
Kanban board/backlog, and one saved filter. Additional Dev or Release boards are
opt-in. `kstack-init` may invoke only offline `preview` or `show`; it never
approves or applies Jira mutations.
