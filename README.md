# KStack

KStack is an explicitly invoked review-to-implementation toolkit for Codex and
Claude Code. It is a narrow, host-native derivative of ideas explored by
[gstack](https://github.com/garrytan/gstack), created by Garry Tan, and is built
for complex repositories where the normal agent must remain in control.

KStack does not replace `HOME`, `CODEX_HOME`, agent permissions, project rules,
or toolchain configuration. Five tightly scoped user-facing entry skills may be
selected when the request clearly matches them; authority and side effects are
still governed inside the workflow. All other capabilities remain explicit-only.

## Commands

| Workflow | Codex | Claude Code |
|---|---|---|
| Configure a project | `$kstack:kstack-init` | `/kstack-init` |
| Challenge the objective | `$kstack:kstack-objectives` | `/kstack-objectives` |
| Review product and technical design | `$kstack:kstack-design` | `/kstack-design` |
| Run the complete new-environment review | `$kstack:kstack-review` | `/kstack-review` |
| Implement an approved design | `$kstack:kstack-implement` | `/kstack-implement` |
| Interrogate an implementation-plan change | `$kstack:kstack-interrogate` | `/kstack-interrogate` |
| Run post-implementation quality control | `$kstack:kstack-qc` | `/kstack-qc` |
| Govern product UX and brand quality | `$kstack:kstack-experience` | `/kstack-experience` |
| Use explicit local/private memory | `$kstack:kstack-memory` | `/kstack-memory` |
| Inventory and migrate protected credentials | `$kstack:kstack-secrets` | `/kstack-secrets` |

`$kstack:kstack-secrets` starts with a metadata-only inventory and never asks for a
credential value in chat. Real enrollment uses a protected local no-echo prompt
only after the exact backend and target adapter pass synthetic qualification.
Enrollment retains the source; retirement and deletion are separate approvals.

The repository also provides `npm run lens-trial` for the default-off,
named-objective broader planning-lens evaluation. It emits opaque prompt
packets after selector freeze, captures outputs, builds file-based
randomized-slot adjudication sheets, and applies the fixed-sequence exact sign
test. It never enables a production lane
or calls a provider on its own. See
`plugins/kstack/references/PLANNING_LENS_TRIAL.md`.

The full review runs: 50,000-foot objective interrogation → repository and
environment review → 10,000-foot primary-agent design improvement to a clean
≥93 result → independent final review by the other agent → mandatory
source-derived owner questionnaire and locked answers → configured
confidence/zero-finding gate → complete Jira delivery-block backlog →
one-block-at-a-time refinement and implementation → implementation-change
interrogation → mandatory QC → separately authorized deployment and
post-deployment observation.

Initialization lets the user route each phase to the active host, Codex, Opus,
or an independent pair where allowed. The defaults keep low-cost conversational
work on the active host, require Codex and Opus for material design, use one
implementation role, and use an independent role for Interrogation and QC.
Security, privacy, auth, migration, deployment, signing, artifact-identity, and
public-contract QC always requires both Codex and Opus.

Every mode uses the same configured authority matrix. Assigning a model to a
phase changes responsibility, not file, Git, device, deployment, or external
access. Interrogation can inspect the approved design and current Git state and,
when authorized, update local plan and repository files. Commit and push remain
separate configured actions.

## Install for local development

Install in the environment where Codex actually runs. Native Windows and WSL
have separate home directories, Node runtimes, plugin caches, and hooks, so
they are separate installation targets. Installing in one does not install in
the other.

That separation applies to the KStack runtime, not automatically to external
service credentials. This repository keeps one authoritative Jira connection
in WSL. Native Windows must not enroll another Jira credential; Jira requests
use the fixed `plugins\kstack\workers\kstack-jira-wsl.ps1` executor handoff.
The handoff accepts only tracking `append`, `list`, and `sync`, binds the exact
Windows checkout to its WSL path and distribution, and never exports the Jira
credential.

### Linux or WSL

```bash
./setup --host all --scope user
```

Install into one repository instead:

```bash
./setup --host all --scope project --target /path/to/repository
```

### Native Windows Codex

Run from Windows PowerShell, not a WSL shell:

```powershell
.\setup.ps1 -Host codex -Scope user
```

Install direct project skills into one native Windows checkout instead:

```powershell
.\setup.ps1 -Host codex -Scope project -Target C:\path\to\repository
```

The native installer requires 64-bit Node 24.19.x on `PATH`. It uses copied
files rather than symlinks, qualifies the Windows Node/ICU/Unicode runtime,
registers the modern Codex plugin when plugin commands are available, and
falls back to direct `%USERPROFILE%\.codex\skills` copies otherwise. After it
passes, restart Codex and open `/skills` to confirm discovery. Invoke
`$kstack:kstack-init` for the modern plugin or `$kstack-init` for a direct
copy. `/kstack-init` is Claude Code syntax and is not a Codex command.

For a user-level Codex install, the setup script registers the repository's
marketplace and installs `kstack@kstack`. If the local Codex version predates
plugin commands, setup falls back to its legacy user skill directory. A
repository-scoped Codex install uses `.agents/skills`. Claude Code uses the same
skill sources and exposes them as slash commands.

When Linux/WSL setup runs from a WSL-mounted Windows drive (`/mnt/<drive>/...`), it emits
an early Codex diagnostic and registers a versioned Linux-native staged copy
under `~/.codex/skills`, because Codex cannot reliably refresh a local plugin
marketplace directly from DrvFS/9p. Project-scoped setup installs skills only;
run user-scoped Codex setup when the plugin itself must be refreshed.

Modern Codex plugin skills use the qualified `$kstack:kstack-*` names shown
above. Repository-scoped or legacy direct skill copies retain the unqualified
`$kstack-*` names. After installation, start inside the target repository with
`$kstack:kstack-init` in modern Codex, `$kstack-init` for a direct Codex copy,
or `/kstack-init` in Claude Code. Initialization asks how objective
questioning, review lanes, model consultation, persistence, implementation,
and external actions should behave, then writes `.kstack/config.json`.

### Post-deploy health result

`setup` now finishes by emitting exactly one `KSTACK_POST_DEPLOY_HEALTH_V1`
machine record. It checks the source-bound, self-excluding audit manifest;
validates every selected installed root and host skill destination; launches
the declared skill scripts from the installed execution root; and performs a
real no-match Reflexion lookup against a private empty fixture. Modern Codex
also receives a direct, blocking physical-cache comparison independent of the
CLI. Codex's own version/marketplace/plugin JSON is reported separately as a
non-blocking third-party tier: unavailable, malformed, unsupported, or
mismatched JSON makes the result `DEGRADED`, never `FAILED` by itself.

The statuses are `PASS` (exit 0), `DEGRADED` (exit 0),
`DEGRADED_OVERRIDE` (exit 0), and `FAILED` (exit 1). A setup-classified
unavailable Reflexion runtime is always an explicit `DEGRADED` result with
`KSTACK_POST_DEPLOY_REFLEXION_UNAVAILABLE`; it is never silently swallowed.
An admitted root whose real lookup fails is `FAILED`. The record always says
`interactiveActivationTested:false`: these checks establish installed files,
paths, cache contents, imports, and lookup behavior, not whether a slash
command or skill activates in an interactive host session.

Version 1 never rolls back automatically. On a post-mutation failure, stop
using the affected host surface, inspect setup's timestamped backup messages,
move the active path aside to an operator-chosen name, restore only the exact
intended backup, re-register the modern Codex plugin if applicable, and rerun
`setup`. KStack does not perform those moves, removals, or restores.

This installation-health result is distinct from application validation. After
an application deployment, `$kstack:kstack-post-deploy` in the modern Codex
plugin, `$kstack-post-deploy` in a direct copy, or `/kstack-post-deploy` in Claude runs
a KStack-owned browser canary and the repository's complete Playwright suite
against the exact release/deployment/commit/artifact binding. User-facing v2
plans also require a digest-bound product-experience contract and fresh
evidence for critical journeys, accessibility, responsive behavior, visual
regression, brand consistency, content clarity, state coverage, performance,
and a clean state-by-state Codex visual review. Every required lane must pass;
provider success, a skipped check, a flaky retry, exceeded performance budget,
or missing browser capability cannot produce a user handoff. When Jira tracking
is required, a clean run records validation, completion, and release against
the linked item before returning `READY_FOR_USER_VALIDATION`. An unhealthy run
blocks handoff and creates bounded Jira follow-up work for functional,
performance, flaky/inconsistent, timeout, coverage, console, request, or canary
health defects, plus category-specific experience work. Private screenshots, traces, sanitized output, and canonical
browser/handoff receipts are retained below the ignored
`.kstack/post-deploy-evidence/` directory. The function is the final automated
validation boundary, not a substitute for the user's deeper validation, and it
never grants deploy, rollback, or product-data mutation authority.

The false-positive escape hatch is deliberately unavailable until an ordinary
reviewed source change enrolls at least two distinct Ed25519 public keys in
`plugins/kstack/install-health-authority-registry-v1.json`, one with the
`requester` role and another with `approver`. A failed eligible run exports a
stable `overrideContextDigestV1` context under the user's private state
directory. A request and approval must bind that exact context and exact
failure set, be signed by the two distinct enrolled principals, and be passed
together with `--health-override-request` and
`--health-override-approval`. Accepted use is conspicuous
`DEGRADED_OVERRIDE`, retains the original failures, is capped at three uses,
and writes a per-use audit. Reflexion lookup, physical Codex cache, integrity,
and filesystem-surface failures are not overridable. KStack stores no private
keys and grants no model or single-party override authority.

## Bounded safety hooks

KStack installs synchronous `PreToolUse` handlers with its plugin and enrolls
project setup through `.kstack/safety-hooks.json`. The handlers are default-on
for enrolled projects, run user and project evaluations, never emit a host
`allow`, and keep host policy conjunctive. Claude supports denial plus an
approval prompt for a broker-prepared action. Codex is deliberately deny-only:
it guards credential access and authority-matrix hard-deny families, but does
not claim forced approval for commit, push, pull-request creation, merge,
destructive Git, or ticket creation.

Protected outbound actions use a distinct prepare/execute broker lifecycle.
Prepare captures a closed request, scans every complete text value and the Git
delta closure, and produces a signed single-use attestation only after `PASS`.
Execute requires matching user/project votes, approval-preview equality, and
current policy/target/certificate identity before the closed executor can open
a credential. Binary Git objects use a lossless one-byte-to-one-code-unit
matcher domain; multi-ref pushes require atomic mode; and the fully serialized
hook response is capped at 4 KiB.

Run `npm run safety:status` for the current project. `npm run safety:activate`
refreshes the project registration and release digests. `npm run safety:disable`
preserves the enrollment but disables it, while `npm run safety:rollback` moves
the project registration into `.kstack/rollback/` for recovery. User-scoped
plugin rollback uses the host's plugin uninstall command. Control-plane changes
are detect-only and tamper-evident; KStack does not claim to prevent an owner or
attacker who controls host settings from disabling hooks.

Coverage is bounded, not universal. Hooks may be disabled, skipped, timed out,
bypassed, untrusted, or absent on specialized tool paths, and direct external
processes are outside tool-hook coverage. Credentialed broker cells also remain
unavailable until installed under a dedicated service identity with a private,
approval-bound Host channel; an ordinary same-user process is not treated as
that boundary.

When design-gate citation grounding is `advisory`, initialization also guides
the explicit platform-check → smoke → shadow qualification sequence. Ordinary
review stays on the legacy route until that sequence produces a current,
authenticated pass/`go` record. Native support is compiled lazily from the
checked-in, hash-pinned node-gyp 11.4.2 closure only at a native-use boundary;
off mode and a rejecting state prefilter do not touch the builder or addon.
See `plugins/kstack/references/DUAL_REVIEW.md` for lifecycle commands and the
locked `KSTACK-SOURCE-RECORD-V1` wire format.

### Codex non-interactive compatibility

In the initial development environment, Codex CLI `0.147.0` reported the local
KStack plugin installed and enabled, but fresh `codex exec` sessions did not
inject either plugin or repository-scoped custom skills. The package and
marketplace validators pass, but activation must still be confirmed through
`/skills` in a fresh interactive Codex/App session. Do not treat successful
`codex plugin list` output alone as proof that a skill loaded.

## Staged two-model decisions

KStack enforces the same phase altitude on Codex and Claude CLI. Objective
interrogation establishes 50,000-foot requirements. The design loop produces a
`KSTACK-DESIGN-10K-V1` architecture: major blocks, boundaries, dependencies,
contracts, risks, and verification/recovery intent. It is explicitly not
implementation-ready and cannot contain code, command recipes, file-by-file
edits, migrations, provider payloads, or deployment steps. A shared
deterministic preflight runs before either provider, so an invalid design spends
zero model invocations rather than relying on one host to follow prose better.

For material design decisions, KStack uses ordered primary and final roles.
The primary works alone until it approves the exact design at confidence ≥93
with no current findings or questions. A configured tier above 93 raises that
pre-dispatch threshold; lower legacy tiers cannot reduce it. Only then does
KStack launch the other agent for an independent read-only final review. The
final uses its separate `finalAcceptanceConfidence` threshold of 81. Codex or
Claude Opus may serve in either role. A final `block` or sub-81 score returns to
the primary for repair and a fresh readiness result; an `approve` or `revise`
at 81+ moves forward with every remaining item as mandatory bug-fix intake.
KStack does not spend both agents on every cycle. The
current host then synthesizes the reports and preserves disagreements.
Secondary dispatch is trigger-driven, not round-driven. Owner requests,
roadblocks, material uncertainty, final review, high-risk boundaries, dissent,
and deterministic audit samples are the closed trigger set. A digest-bound
decision records the route, exact evidence/configuration binding, reviewer
independence, and availability result before dispatch; high-risk review also
requires a different provider family.
Provider review processes are sessionless and tool-disabled, receive only a
minimal allowlisted environment, use private per-invocation work directories,
and are bounded by single-flight locking and process timeouts.
Selecting this staged workflow is standing authorization for every qualifying
secret-scanned review packet. KStack does not ask for an authorization phrase,
file, packet hash, or batch hash; those digests bind bytes and never grant
permission. Each reviewer receives the same neutral current artifact, never
the other model's report, output, scores, reasoning, or transcript. A provider
host may still impose its own execution prompt, but that is not a KStack packet
approval requirement.
Immediately after the first completed staged review, the separate `kstack-design-clarify` procedure extracts
every disagreement, hedge, unverified assumption, and objective-scope
divergence from the actual round-one artifacts and asks the owner direct,
specific questions. Round 2 cannot begin until the owner confirms a locked
answer record under `.kstack/decisions/`. Later rounds must treat those answers
as authoritative unless new evidence is surfaced back to the owner in a linked
superseding decision. This clarification gate is distinct from
`kstack-interrogate`, which classifies implementation-plan changes after design
approval. If either CLI is unavailable or times out, KStack reports that fact;
it never presents a single-model result as consensus.

Reviewer completion is not design approval. Each material design is bound to a
SHA-256 digest. Staged primary readiness requires a clean approval at 93 or
higher. The independent final reviewer has a separate 81 threshold in every
cycle: `approve` or `revise` at or above 81 completes review, while every final
failed check, finding, dissent item, and question becomes mandatory bug-fix
intake. Only `block`, a score below 81, malformed output, timeout, stale
evidence, or a failed deterministic gate returns the design loop to review.
Combined confidence remains the minimum score. The passing state is only
`READY_FOR_USER_APPROVAL`; models never grant implementation authority.

The runtime-maturity Host/Domain independent-review batch uses the same split:
its embedded Codex primary must already be clean at 93+, while an Opus final
result at 81+ is admitted. A clean approval creates no intake; `REVISE` at 81+
is recorded as `bugfix-only`, and each failed criterion, security finding,
material dissent item, or unresolved question is preserved as digest-bound
mandatory implementation intake. A score below 81 is rejected. Review
admission therefore advances the workflow without falsely qualifying or
closing work whose required fixes remain outstanding.

After owner approval, every architecture block is materialized as a distinct
Jira item in a digest-bound `kstack-delivery-backlog-v1` manifest. When Jira is
required, every block needs a confirmed Jira key before implementation. KStack
then activates, refines, implements, validates, and closes or blocks exactly one
dependency-ready block at a time. Design approval, backlog completion,
implementation completion, and deployment remain separate transitions.

Each initialized repository may provision its own Jira project/space, delivery
board, and initial backlog from its own KStack session; this is not reserved for
the KStack repository or a central administration console. A repository that
initially skipped Jira can invoke `kstack-jira` later. The offline
`kstack-jira-bootstrap.mjs start` command validates and writes that repository's
own Jira enrollment and exact creation preview in one operation, replacing only
an unused template key and never an active delivery record. No central checkout,
second console, or manual config edit is required.
Work-item creation uses `externalTicketCreation`; project/space administration
uses the separate `jiraAdministration` authority. New-space application stays
preview-hash-bound, interactive, and read-back verified. The active host agent
may run that PTY flow and enter the bound hash after the configured owner
approval; the owner does not need a second console. This is a supported workflow
rather than a categorical skill prohibition. A request to create the space is
not complete at `new-previewed`: the project-local session continues through
guarded approval and application until Jira read-back returns `verified`, or it
reports the concrete permission, credential, tenant, or reconciliation blocker.

## Cooperative Interrogation and QC

`kstack-interrogate` is an explicit entry point and an automatic implementation
checkpoint whenever an issue or new request would change the approved plan. It
requires at least 93 reviewer-reported confidence and no findings or unresolved
questions for a non-material plan update. Anything material or uncertain goes
back through the complete staged design loop.

`kstack-qc` reviews the finished diff and observed verification evidence against
the approved objective, design, and final plan. Completion requires at least 95
reviewer-reported confidence, unchanged evidence, and zero failed checks,
security findings, quality findings, material findings, or questions. Two
remediation rounds are allowed; a further failure requires a user decision.

These are cooperative host workflows, not cryptographically binding reviewer
attestations or statistically calibrated probability claims. KStack records
roles, evidence, results, and repository state honestly and never represents
the active host under a different reviewer identity.

To control token use, each review receives a compact evidence packet containing
identifiers, only affected decisions and source, the exact plan delta, observed
test summaries, risks, and rollback. Unchanged chat history, unrelated design
lanes, raw prior outputs, and whole-repository dumps are excluded. Evidence is
reused only while its design, plan, and Git-state digests remain unchanged, and
all redesign/remediation loops are bounded.
Material design defaults to at most four primary improvement cycles or 120 elapsed minutes.
Pre-threshold cycles use only the primary; a readiness-passing cycle adds one
independent final invocation. KStack reports cumulative spend in cycles,
invocations, and time, then returns control to the
user instead of silently extending an exhausted budget.

## Virtual engineering panels

KStack includes an opt-in `kstack-panel` workflow beside existing dual review.
A panel has two or more required voters, optional non-voting advisers, an
integer threshold from 1 through 100, explicit persona/backend/provider-family
pins, and an external author. Every candidate is held behind one blind,
synchronous full-panel barrier; every required voter must individually reach
the threshold. Scores are never averaged, advisers never vote, and Fable is
mediator-only.

The default catalog supplies `security-engineer`, `resilience-expert`,
`compliance-auditor`, and `news-article-journalist`. Whole-record project
additions or digest-bound replacements may be placed in `.kstack/personas`.
Personas alter the reasoning lens only and grant no authority.

Provider output is scanned and parsed in bounded volatile memory. Each attempt
retains one canonical role envelope and bounded non-content records—never a
raw or sanitized duplicate. Configure `workflow.panel`, then run
`npm run panel -- --help`. Fable receives only owner-certified factual or
technical stuck disagreements, and its directive binds only the next external
authoring attempt. Bounded exhaustion exports `INCOMPLETE_WITH_DISSENT — NOT
UNANIMOUS`. Paid shadow and production remain fail-closed without an API-aware
aggregate-billing broker and current qualification evidence.

The shipped CLI providers are development-only: the CLI has no production
qualification-evidence or billing-broker loading path, so production dispatch
is intentionally unavailable. The injectable broker/evidence seam in the
module API exists for tests and future qualified integration; caller-supplied
booleans are not production qualification. Project slots pin entries in
`models` directly—there is no separate project backend-registry file—and the
declared provider family must match the runner (`codex`/OpenAI or a
Claude-compatible/Anthropic backend). The four adapter IDs currently share one
strict generic evidence packet; they label the reviewed artifact but do not
perform document-, plan-, or code-specific parsing.

Panel state is a single-process local record. Individual writes and attempt
directory publication are atomic, but there is no multi-process lease or
distributed coordination, no comprehensive interrupted-operation recovery,
and no automatic retention cleanup. A crash may leave a temporary artifact
that causes subsequent operations to fail closed until an operator inspects
the run. Run inventory checks enforce the profile's attempt-count,
per-attempt, run-record, and aggregate byte caps and reject unknown artifacts.

## Explicit memory

`kstack-memory` adds an optional local PGLite index and a user-owned private Git
body. Curated Markdown/JSON is authoritative and portable; the PGLite database
is local, derived, and rebuildable. Retrieval is explicit and labeled untrusted.
There is no per-turn injection, raw-chat archive, automatic synchronization,
force push, or automatic conflict resolution. Remote creation, clone, fetch,
integration, commit, and push each obey their configured authority.
An enabled body with zero artifacts reports `empty` and is not considered an
operational cross-session capability.

## Development

```bash
npm ci --prefix plugins/kstack --omit=dev --ignore-scripts
npm test
```

KStack is MIT licensed. See `THIRD_PARTY_NOTICES.md` for gstack attribution.
