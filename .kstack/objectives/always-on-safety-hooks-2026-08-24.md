# Objective brief: KStack always-on safety hooks

**Date:** 2026-08-24 · **Depth:** deep (per `.kstack/config.json` `workflow.objectiveDepth`)
**Status:** ready for design

## Problem and affected users

KStack has a project authority matrix in `.kstack/config.json` and shared
invariants in `plugins/kstack/references/SAFETY.md`, but most enforcement is
procedural: an active KStack skill reads the matrix and is instructed to ask,
allow, or stop before the corresponding action. A normal Claude Code or Codex
session that is not currently driven by a KStack skill can therefore attempt a
destructive Git operation, read credential material, push or merge, deploy, or
perform another high-risk action without KStack evaluating the configured
authority.

The primary users are KStack owners and contributors who expect the configured
project boundary to remain meaningful throughout an agent session, including
ordinary work between explicit KStack workflows. They need protection from
accidental or model-initiated high-impact calls without turning every routine
read, edit, or test into an approval prompt.

The owner has already scoped the objective: formalize an always-on,
lightweight enforcement layer for the highest-risk actions already represented
by KStack's authority model. This objective does not reopen whether KStack
should have such a layer; design must decide what bounded mechanism earns its
complexity across both supported hosts.

## Desired outcome and measurable success evidence

When KStack safety enforcement is installed and active for a project, selected
high-risk tool calls are evaluated even when no KStack skill is in flight. The
evaluation derives from the existing authority matrix or a single explicitly
defined projection of it; it must not establish a second authority source.

Success requires reproducible evidence that:

- representative destructive operations are intercepted before execution on
  both Claude Code and Codex CLI;
- actions configured `deny` cannot be loosened by the KStack layer, actions
  configured `ask` do not silently execute, and the host's stricter policy
  continues to win;
- representative credential or secret-content reads are stopped or escalated
  without blocking harmless metadata checks needed to diagnose configuration;
- push, pull-request creation, merge, deployment, device installation, and
  destructive categories have an explicit, testable mapping to the existing
  authority keys rather than an independent list of permissions;
- ordinary inspection, in-scope edits, and repository-native tests do not
  trigger safety prompts in a clean benchmark corpus;
- compound commands, alternate spellings, symlink/path traversal, nested tool
  calls, malformed hook input, missing/invalid config, disabled/untrusted hooks,
  and host bypass modes have documented and tested outcomes;
- installation, status inspection, upgrade, disablement, and rollback are
  observable and reversible on both supported hosts without overwriting
  unrelated host configuration; and
- documentation states precisely what the layer covers and does not describe a
  hook guardrail as a complete security boundary.

## Current behavior and observed facts

- `plugins/kstack/references/SAFETY.md` requires the same authority matrix in
  every KStack phase and treats inspect, edit, test, commit, push, pull request,
  merge, deploy, device install, and destructive operations as distinct
  authorities. It also says KStack never replaces host configuration or grants
  itself permissions; the stricter boundary wins.
- `.kstack/config.json` currently sets `inspect`, `edit`, and `test` to
  `allow`; `commit`, `push`, `pullRequest`, `merge`, `destructive`, and
  `externalTicketCreation` to `ask`; and `deploy` and `deviceInstall` to
  `deny`.
- The KStack skill files repeatedly instruct the active agent to apply that
  matrix. `kstack-implement` explicitly separates external actions;
  `kstack-review`, `kstack-qc`, and `kstack-interrogate` preserve the same
  boundary. These are prompt/procedure obligations rather than a universal
  tool-call interceptor.
- Narrower CLIs do have local enforcement. `kstack-memory.mjs` and
  `kstack-reflexion.mjs` validate selected actions and require an `--approved`
  marker for an `ask` policy. The Jira skill explicitly calls
  `authority.externalTicketCreation` a prose-level convention rather than an
  enforced CLI boundary. No shared project-wide guard currently mediates
  arbitrary host tool calls.
- The extracted gstack implementation declares Claude Code `PreToolUse` hooks
  in the `careful`, `freeze`, and `guard` skill frontmatter. `careful` performs
  regex-based Bash classification and returns `ask`; `freeze` blocks `Edit`
  and `Write` outside state stored in `freeze-dir.txt`; `unfreeze` removes that
  state. The implementation acknowledges gaps: freeze does not cover Bash
  writes, and empty or unparseable hook input is allowed. Under current Claude
  Code documentation, skill-frontmatter hooks are active while that skill is
  active; gstack also contains a separate settings-file hook manager for
  persistent registrations.
- Installed Claude Code 2.1.241 exposes hooks and plugins. Its help shows
  `--plugin-dir`, `--include-hook-events`, `--safe-mode` (which disables hooks
  except managed policy), and `--bare` (which skips hooks). Current Claude Code
  documentation states that `PreToolUse` runs before permission-mode checks,
  can return `allow`, `deny`, `ask`, or `defer`, and a `deny` remains effective
  in bypass-permissions mode. Plugin `hooks/hooks.json` is active when its
  plugin is enabled; project and user settings are other registration scopes.
- Installed Codex CLI 0.149.0 reports both `hooks` and `plugins` as stable
  features. Current official OpenAI documentation states that Codex discovers
  `hooks.json`, inline config hooks, and plugin-bundled hooks; project hooks
  require project trust and non-managed hooks require definition-hash trust.
  Codex `PreToolUse` covers Bash/unified exec, `apply_patch`, MCP tools, and
  most local function tools, but specialized paths may opt out.
- Codex and Claude do not have fully comparable decision semantics. Claude can
  force an interactive `ask`. Current Codex documentation says `ask` is parsed
  but unsupported for `PreToolUse`; it reports an error and continues the call.
  Codex can reliably `deny`, and `PermissionRequest` can decide an approval
  already raised by the normal host flow, but it cannot itself guarantee that
  an otherwise unprompted tool call becomes an approval prompt.
- KStack's current Codex user installation is a plugin installation and can in
  principle bundle hooks. Its Claude installation currently exposes individual
  skills under `~/.claude/skills` rather than installing KStack as a Claude
  plugin. Repository-scoped installs likewise place skills under host-native
  skill directories. Cross-host always-on activation therefore requires an
  explicit packaging/registration decision.
- The working tree already contains owner changes in `setup` and
  `tests/setup.test.mjs` concerning Codex plugin installation. They are
  relevant evidence for packaging but are not part of this design thread and
  must be preserved.

## Constraints and authority boundaries

- Keep `.kstack/config.json` and `SAFETY.md` authoritative. A guard may map
  concrete calls to existing authority categories; it must not create a
  competing permission matrix or silently reinterpret an `ask` as `allow`.
- Apply host policy and KStack policy together, with the more restrictive
  outcome winning. A KStack hook should tighten or abstain; it must never emit
  a host-level allow that bypasses an existing permission prompt or deny rule.
- Support both Claude Code and Codex CLI sensibly. Shared policy logic is
  preferred, but host adapters may differ where the hosts' actual semantics
  differ. Claims of parity require executable evidence, not matching JSON
  field names.
- Keep the first protected surface deliberately small and high-signal. Avoid a
  generic prompt before every shell command, file read, edit, or test.
- Installation and update must preserve existing host settings, hooks, plugin
  state, and user files. Project-local configuration must not make an
  untrusted repository able to grant broader host permissions.
- Missing, malformed, stale, or inaccessible policy inputs need an explicit
  failure behavior. Fail-open may be acceptable only for clearly low-risk,
  out-of-scope calls; known high-risk matches cannot silently pass because a
  parser or config read failed.
- Hook latency must be bounded and local. Normal operation must not call an LLM
  or a network service, expose command or secret content in telemetry, or write
  unbounded logs.
- The design must distinguish warning/approval UX from hard denial, make
  repeated messages actionable, and avoid teaching users to reflexively
  approve a broad category.
- KStack's dual-review, design gate, implementation transition, QC, memory,
  and Jira controls remain unchanged. A hook is neither a design approval nor
  implementation authority.

## Non-goals

- Building a general endpoint-security, data-loss-prevention, shell sandbox,
  or adversarial containment product.
- Perfect semantic understanding of arbitrary shell programs, scripts,
  aliases, binaries, MCP implementations, hosted tools, or processes started
  outside the supported host tool path.
- Porting gstack's exact `careful`/`freeze`/`guard` shape or its pattern list
  unchanged.
- Replacing Claude Code or Codex permission models, managed enterprise policy,
  repository trust, operating-system controls, Git server protections, CI
  branch protection, or credential-store permissions.
- Auto-approving any action, granting authority from repository content, or
  treating an agent-written approval token as human consent.
- Enforcing every `allow`/`ask`/`deny` key in v1. The design may choose a
  smaller highest-risk projection if coverage and exclusions are explicit.
- Implementing the chosen mechanism, changing setup, or modifying host
  configuration during this round-one design thread.

## Failure, recovery, and reversibility expectations

Known destructive, credential-content, deployment, device-install, push, or
merge matches must not execute silently after hook parse failure, policy
validation failure, or an unsupported host decision. The user must receive a
short reason, the authority category and source, and a bounded recovery action.
Unknown calls should not be overclaimed as safe; they should follow ordinary
host policy when the guard has no supported classification.

A hook crash, timeout, trust revocation, plugin disablement, safe/bare host
mode, unsupported tool path, or direct external process can remove coverage.
The design must make those states detectable at startup or through a status
command and must document them as coverage failures. It must not claim
always-on enforcement merely because files were installed.

Rollback must remove only KStack-owned registrations and state, restore any
installer-edited host file from a verifiable backup or structural inverse, and
leave the original KStack skill workflow usable. Disablement must be possible
without deleting project data or credentials. Policy/config migration must be
backward compatible or explicitly opt-in.

## Open questions and assumptions for design

- Which existing authority categories and secret-path/content cases are the
  minimum v1 protected set that produces meaningful risk reduction without
  prompt fatigue?
- How should Codex represent an `ask` authority when `PreToolUse` cannot force
  an approval prompt: conservative denial, composition with a host rule or
  permission request, a separately verifiable human action, or exclusion from
  the common v1 contract?
- Should activation be plugin-bundled, installer-registered in user/project
  hook configuration, or split by host/scope? Each choice changes trust,
  disablement, upgrade, and no-skill-session coverage.
- Is installation of the always-on layer opt-in at KStack setup, enabled by
  default with explicit disclosure, or mandatory for a project that claims
  KStack safety enforcement?
- The design assumes supported sessions use current enough host versions for
  the documented hook interfaces. A version floor and compatibility behavior
  must be chosen and tested before implementation.

These questions do not block round-one design. They are the material decisions
the independent reviewers and subsequent owner clarification must resolve.
