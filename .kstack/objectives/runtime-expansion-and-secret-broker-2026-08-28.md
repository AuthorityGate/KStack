# Objective brief: runtime expansion and secret brokerage

**Date:** 2026-08-28  
**Depth:** exhaustive  
**Status:** ready for isolated design threads  
**Implementation authority:** not granted by this brief

## Problem

KStack's governance and offline evidence machinery are stronger than its live
delivery reach. Release/Jira, Host Breadth, and Domain Breadth have reviewed
architectures but limited runtime qualification. Real-time interception is
host-asymmetric: Claude can deny and ask on covered `PreToolUse` paths, while
Codex is deliberately deny-only for ask-tier actions. The safety broker has a
strong prepare/execute model, but its production executor admits only Git
commit and push, and its credential source is a protected local file rather
than a provider-neutral secret service.

Users also lack one KStack workflow for passwords, API keys, account secrets,
private tokens, certificates, and other credential material. Existing matchers
can stop recognized plaintext from reaching a covered tool, but KStack cannot
currently replace that rejected plaintext with a safe opaque reference or
complete the intended operation without exposing the value to the model.

## Affected users

- Developers using KStack through Claude Code or Codex CLI.
- Operators deploying AuthorityGate applications through GitHub and Jira.
- Repository owners adding supported coding-agent hosts or domain packs.
- Security owners responsible for secret custody, rotation, revocation, audit,
  incident response, and production release authority.

## Desired outcomes

### R1 — Release automation

Provide one repeatable KStack release skill that carries an exact approved
artifact from `Dev` through staging, independent canary, production approval,
rollback eligibility, Jira/GitHub correlation, and immutable final receipts.
The first execution plane is GitHub Actions and GitHub Environments; Jira is the
human-facing release ledger. Cloud authentication prefers short-lived OIDC
credentials over stored deployment secrets.

Initialization must make the Jira delivery stack an explicit repository-level
decision rather than merely asking whether Jira is enabled. Present three
paths: connect and validate an existing Jira delivery stack; preview and, only
after separate owner approval, create a new Jira project/board/backlog delivery
stack; or skip Jira for this repository. Support the distinct case where a Jira
project already exists but the repository needs a new board/backlog and release
mapping. Record the selected Jira project, board/filter identity, issue types,
workflow, versions/releases policy, GitHub repository, branch, and environment
mapping as verified configuration evidence. Revisit this decision for every
new repository and allow a separately scoped development delivery stack when
the owner uses multiple branches or environments.

`kstack-init` owns discovery, questions, read-only validation, and a content-free
bootstrap plan. It must never silently create Jira resources. A release/Jira
bootstrap operation owns preview, approval, apply, verification, reconciliation,
and rollback guidance. `kstack-design` consumes the verified mapping and offers
offline work-item drafts for concrete deliverables; it cannot invent a project
key or claim a backlog exists from configuration alone.

### H1 — Host Breadth

Turn the closed Host Adapter design into an executable adapter contract with
honest capability levels: registered, renderable, installable, intercepting,
qualified, and supported. Add one host at a time and never infer support from
generated prompt files or plugin registration alone.

### D1 — Domain Breadth

Turn the closed domain-pack schemas into two representative low-risk runtime
packs before expanding the catalog. Each pack must prove deterministic
selection, bounded context, measurable task benefit, clean deactivation, and no
authority expansion.

### I1 — Real-time interception

Extend the safety broker's closed action set and host projections so covered
mutations and secret-bearing operations are mediated at the earliest supported
host boundary. Report deny, ask, broker-execute, detect-only, and unavailable as
different capabilities. Never describe Codex ask-tier enforcement as present
until the installed host exposes and passes that mechanism.

### S1 — New secret-broker capability

Create a new KStack skill and broker interface that uses opaque secret handles.
The model may select an approved handle and operation, but cannot retrieve the
secret value. A bounded executor resolves the handle and performs the exact
operation. External secret managers own cryptography, custody, and rotation;
KStack owns policy, approvals, redaction, target binding, execution, and
content-free receipts.

## Success evidence

### Release

- Initialization produces exactly one Jira onboarding state for the repository:
  `existing-validated`, `new-previewed`, or `skipped`. A failed or incomplete
  validation remains explicit and cannot be promoted to configured.
- A new-stack preview identifies Jira project type, key, board/filter, backlog,
  issue types, workflow, versions/releases policy, components, GitHub linkage,
  repository branches, and deployment environments before any Jira mutation.
- Creating or changing the stack requires a fresh `externalTicketCreation`
  approval (and provider-administration approval when applicable), followed by
  read-back verification. Retrying an ambiguous outcome is blocked until
  reconciliation proves whether each resource exists.
- Existing-stack onboarding is read-only first and verifies tenant, project,
  board/backlog, permissions, issue types, workflow, release/version access,
  GitHub repository linkage, and environment mapping without exposing a token.
- A reusable workflow is pinned to an immutable commit and its OIDC trust binds
  the repository identity, environment, and reusable workflow identity.
- Development, staging, and production have explicit, separately configurable
  approval rules. Production defaults to required non-self approval; a human
  override is recorded rather than silently weakening the environment.
- GitHub deployment/status events and Jira work-item linkage reconcile to the
  same artifact digest and environment.
- Forced deploy, canary, Jira, timeout, and rollback failures produce bounded
  terminal states, including `AMBIGUOUS` and `MANUAL_REQUIRED`.
- No long-lived cloud credential is required when the target supports OIDC.

### Host and interception

- One additional host passes clean install, discovery, invocation, update,
  rollback, safety capability, and uninstall fixtures.
- A host capability statement is generated from executed conformance evidence,
  not static metadata.
- Unsupported ask/interception paths remain deny-only or unavailable and cannot
  produce a stronger claim.
- Direct secret-path access and recognized plaintext are denied on every covered
  host tool path.

### Domain

- Two low-risk packs beat or equal an unassisted baseline on blinded fixtures
  without adding failed checks, security findings, or authority.
- Pack activation, budget, version, evidence, and rollback are digest-bound.

### Secrets

- Chat, tool arguments, command arguments, persistent environment, shell
  history, Git, logs, receipts, reviewer packets, and reports contain only
  opaque references and typed non-secret metadata.
- Secret entry occurs through a no-echo local prompt, provider UI, OS keychain,
  or provider-native authorization flow outside model-visible content.
- The broker supports at least one developer-oriented backend and one
  production/self-hosted backend through the same closed interface.
- Backend bootstrap credentials are stored in an OS credential facility or
  workload identity, never a repository file or ordinary ambient environment.
- Retrieval, use, rotation, revocation, expiry, deletion, denial, crash,
  timeout, provider ambiguity, output leakage, and child-process leakage have
  adversarial tests.
- Every operation emits only a content-free receipt with actor, purpose, handle
  digest, target digest, backend ID, generation, outcome, and time evidence.

## Observed facts

- `main` and `Dev` both resolve to commit
  `36babbe103262d8f5cca10d8ddc9ca8171d1fb4d` after the first Main release.
- The intended-environment release suite passes 379/379 tests.
- `kstack-safety-hook.mjs` recognizes secret names, common secret paths, Git,
  provider, destructive, and Jira action families.
- `kstack-safety-broker.mjs` rejects banned credential-bearing request keys and
  scans complete text values plus Git object closures before readiness.
- `kstack-safety-executor.mjs` currently admits only Git commit and push.
- `kstack-init` currently offers optional Jira configuration for an existing
  Jira Cloud site/project and explicitly never contacts Jira; it does not yet
  implement existing/new/skip discovery or delivery-stack provisioning.
- Claude supports deny and ask on the covered hook path; Codex remains deny-only
  for ask-tier actions in the current implementation.
- The owner reports repeated KStack process use on AuthorityGate Platform, LB,
  and smaller work items. This is meaningful owner-attested adoption evidence,
  but it is not yet an independently reconstructed multi-operator field study.

## Contender evidence

- GitHub Environments provide branch restrictions, deployment protection rules,
  required reviewers, and delayed access to environment secrets:
  <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>
- GitHub OIDC can bind trust to repository, environment, and reusable workflow
  claims such as `job_workflow_ref`:
  <https://docs.github.com/en/actions/reference/security/oidc>
- Jira's GitHub integration associates workflow/deployment evidence through
  GitHub deployment-status events and work-item keys:
  <https://support.atlassian.com/jira-cloud-administration/docs/link-github-workflows-and-deployments-to-jira-issues/>
- Jira Cloud exposes separate administrator-scoped project creation and Jira
  Software board creation APIs; a board requires a viewable saved filter, so
  "create a backlog" must be modeled as a verified resource graph rather than
  one opaque action:
  <https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/>
  <https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/>
- 1Password provides service accounts, CLI secret references, SDKs, and a
  private Connect REST API:
  <https://developer.1password.com/docs/cli/secrets-scripts>
- Bitwarden Secrets Manager provides scoped machine accounts, access tokens,
  audit events, a cross-platform CLI, and SDKs:
  <https://bitwarden.com/help/machine-accounts/>
- OpenBao provides self-hosted identity-based secret storage, dynamic secret
  engines, auto-auth, proxying, leases, and process supervision:
  <https://openbao.org/docs/agent-and-proxy/>
- OWASP recommends centralized least-privilege custody, lifecycle automation,
  short-lived/dynamic credentials, audit, rotation, and exclusion from logs:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>

## Constraints and authority boundaries

- Design and local test fixtures may proceed. Creating provider accounts,
  installing a server, storing or migrating a real secret, configuring GitHub
  environments/OIDC, mutating Jira, deploying, rotating credentials, or
  changing production policy requires separate authority.
- No live credential or secret value may be sent to any reviewer.
- The secret broker must extend the existing safety authority plane; it cannot
  create a parallel approval or mutation path.
- Provider adapters are optional and separately qualified. KStack core remains
  usable without any particular commercial service.
- Local OS credential APIs may hold bootstrap material, but they are not a
  multi-user source of truth and do not replace a team secret manager.
- A KStack-native encrypted repository remains a fallback candidate only after
  the external-adapter contract is proven insufficient and the existing ECR
  design reaches full closure.
- User passwords typed into an AI chat have already crossed the host boundary.
  KStack can warn, block subsequent tool use, and require rotation, but cannot
  truthfully claim the host never received them. Secure entry must occur in a
  separate local/provider UI.

## Non-goals

- Building a general password-manager user interface in the first slice.
- Automatically importing every discovered `.env` or credential file.
- Allowing arbitrary commands to request arbitrary secrets.
- Returning a secret through MCP, stdout, stderr, tool results, or chat.
- Treating environment-variable injection as secret non-exposure.
- Replacing GitHub, Jira, a vault backend, or cloud IAM with conversational
  model authority.
- Claiming all-host real-time interception before per-host conformance exists.
- Reopening already validated designs wholesale.

## Failure, recovery, and reversibility

- Unknown provider outcomes remain ambiguous and block retry until reconciled.
- Secret resolution fails closed on stale generation, changed target, expired
  authority, revoked handle, backend identity drift, or missing audit channel.
- No plaintext fallback is permitted when a backend is unavailable.
- Release automation is introduced target by target and remains default-off
  until dry-run, staging, forced-failure, rollback, and receipt checks pass.
- Each host adapter and domain pack is removable without changing KStack core
  schemas or historical receipts.
- New skill/config fields use closed versioned schemas with explicit rollback.

## Isolated design threads

1. `release-automation-v2-2026-08-28`
2. `host-domain-interception-2026-08-28`
3. `secret-broker-2026-08-28`
4. `adoption-evidence-2026-08-28`

Each thread is reviewed and repaired independently. No aggregate confidence
score can close another thread.

## Readiness

**Ready with risks.** The objective is clear enough for isolated contender and
architecture reviews. Backend selection, first additional host, first two
domain packs, and first deployment target remain design decisions rather than
assumed implementation authority.
