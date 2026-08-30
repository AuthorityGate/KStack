---
name: kstack-jira
description: Enable or connect project-local Jira, create and track work items, and provision a repository Jira project/space plus delivery backlog through preview-bound administration.
---

# KStack Jira Work Tracking and Project/Space Onboarding

When the owner asks this repository to start a new Jira project/space, the
requested outcome is a verified live project/space with its delivery surface
and selected initial backlog—not merely an offline preview. Use the preview as
the review and integrity boundary, then continue in the same repository and
host session through guarded approval, apply, and exact read-back whenever the
configured authority permits it. Report a preview as `new-previewed`, never as
completion.

Work-item creation and continuous projection require `.kstack/config.json` to
have `jira.enabled: true`. Project/space onboarding does not have that
precondition: an initialized repository that previously skipped Jira may invoke
this skill to configure and start its own Jira project/space. If the repository
has no KStack configuration, complete project-local initialization in this same
session and then resume this workflow; do not require a central KStack checkout,
administration console, different agent, or second terminal.

The skill supports two separate capabilities: work-item creation under
`authority.externalTicketCreation`, and project/space plus board/backlog
administration under `authority.jiraAdministration`. Never infer one authority
from the other.

For a new project/space, first inspect the current repository and its local
configuration. Obtain the Jira Cloud tenant origin, new key and name, Jira
Software or Business type, repository namespace, board/backlog choice, initial
roadmap choice, credential-source metadata, tracking mode, and
`jiraAdministration` posture. Never request a credential value in chat or write
one into project configuration. Use the bootstrap executable's offline `start`
command to update only this repository's `.kstack/config.json`, validate the
complete configuration, enroll its selected key, bind project-local tracking,
and write the exact creation preview in one operation. This is the normal path;
do not require a manual config edit and do not answer that Jira must already be
enabled. `start` defaults tracking to `approval-queued` and administration to
`ask`; `off` and `allow` must be explicit owner choices.

For work-item drafting, the skill may invoke exactly one operation from the
work-item queue executable:

```bash
node <kstack-plugin-root>/scripts/kstack-jira.mjs draft --project KEY --issue-type TYPE --summary TEXT --description TEXT --session-id ID
```

`draft` is fully offline. Do not invoke `doctor`, `show`, `approve`, `unfreeze`,
`submit`, `reconcile`, `resolve`, or `discard` from the work-item queue
executable. This restriction is only for `kstack-jira.mjs`; it does not prohibit
the project/space bootstrap operations below. Never describe the ticket-creation
authority setting as an enforced approval gate. The real external-action
boundary is the host tool-permission prompt; ticket `approve` also requires a
TTY and tamper-evident payload-hash confirmation.

For repository onboarding, ask whether the user has an existing Jira delivery
stack, needs a new one, has an existing project that needs a board/backlog, or
wants to skip Jira. This skill may invoke every command in the separate
`<kstack-plugin-root>/scripts/kstack-jira-bootstrap.mjs` lifecycle: offline
`start`, `preview`, and `show`, read-only
`validate` and `reconcile`, and guarded `approve` and `apply`. Default an
ordinary repository to one dedicated Jira project/space
and one Kanban delivery board/backlog with a saved project-bounded filter. Ask
whether the target is Jira Software or Jira Business: Software uses the Agile
board API, while Business uses the project-management template's native Board
view. Apply preflights accessible project types and must never issue a Software
board POST for a Business space. Larger programs or tasks may request multiple
explicit project/phase scopes, but the current executable provisions one scope
per preview and must report multi-space orchestration as unavailable. Additional
Dev or Release boards are opt-in. Reconciliation must occur before a human is
asked how to handle an uncertain apply result. Never invoke bootstrap `approve`
or `apply` when `authority.jiraAdministration` is `deny` or absent. When it is
`ask`, obtain explicit user approval for the exact preview in the current
conversation; when it is `allow`, the user's request to create the project/space
is sufficient. In either case, `approve` and `apply` remain host-side,
interactive-TTY operations. The active host agent may launch that PTY and enter
the exact preview hash itself; never claim that the owner must open another
console or manually type the hash. The hash is an integrity binding to the
reviewed plan, not a human-only action boundary. Run `apply` only from `new-approved`,
then require read-back state
`verified`; ambiguous or failed state must reconcile and must never be reported
as a live space. Every initialized repository can use this workflow to start
its own Jira project/space, including after Jira was initially disabled. This
is a supported per-project workflow, not a categorical prohibition or a central
KStack-only administration path. For a repository that is disabled or still
contains the unused `KSTK` template key, run:

```bash
node <kstack-plugin-root>/scripts/kstack-jira-bootstrap.mjs start --site-url https://TENANT.atlassian.net --project-key KEY --project-name NAME --repository OWNER/NAME
```

The command replaces only an unused default key; otherwise it adds or reuses
the exact requested key. It refuses to overwrite an active delivery record.
Plain `preview` continues to reject unenrolled keys, so creation cannot leave
drafting and history projection pointed at another project. Each repository
retains its own approval record and Jira mapping; never reuse another
repository's delivery record.

A new or existing-project/new-board preview includes a five-item KStack
lifecycle roadmap by default. Before preview, ask whether to use that default,
load a repository roadmap manifest, or explicitly create an empty board. Prefer
a custom `kstack-jira-roadmap-v1` manifest when accepted objectives or a design
ledger already identifies concrete work. The entire item content is approval-
hash-bound; never claim onboarding is complete when a planned item is missing.
The skill may pass `--roadmap-file` to offline `preview`. It may proceed through
the externally mutating `approve` and `apply` operations only under the exact
administration gate above.

When `jira.deliveryRecordPath` is configured, bootstrap reads and writes the
approval record at that absolute path instead of the repository default. Use
this for Windows-mounted repositories whose `.kstack` permission bits cannot
satisfy the integrity check. The configured path must remain outside the
repository; KStack still requires a canonical, invoking-user-owned directory
with no group/world write access.

Jira Cloud is the only v1 target. The hostname rule accepts exactly one tenant
label plus `.atlassian.net`; it is a typo/DNS-suffix guard, not protection from
an attacker-controlled Atlassian tenant. `doctor` performs the site-identity
assertion and warns that `BROWSE_PROJECTS` does not prove issue-level
visibility when project defaults, workflows, or automation apply security.

## Continuous work and history tracking

This drafting extension does not replace continuous tracking. When
`jira.tracking.mode` is enabled, read `../../references/JIRA_TRACKING.md` and
use `kstack-jira-tracking.mjs`: every new actionable item starts with a durable
creation event, and later reviews, defects, fixes, completions, and releases are
projected onto that same Jira issue. A project, board, backlog, or one-time issue
seed without ongoing history is incomplete.

For web releases, `ITEM_RELEASED` must bind the current healthy receipt from
`kstack-post-deploy`; provider deployment success alone is insufficient. A
failed, slow, flaky, inconsistent, skipped, timed-out, or otherwise unhealthy
browser validation is appended to the same item and creates stable follow-up
work by defect category; it must not be projected as released. A clean run
records validation, completion, and release, then hands the release to the user
for deeper validation. Jira records the receipt digest, never raw
screenshots, traces, cookies, storage state, credentials, or test output.
