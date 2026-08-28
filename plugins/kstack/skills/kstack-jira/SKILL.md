---
name: kstack-jira
description: Draft an offline Jira ticket or preview repository Jira delivery-stack onboarding when Jira integration is enabled. This skill never approves or applies an external Jira mutation.
---

# KStack Jira Drafting and Delivery Onboarding

This is an optional extension used only when `.kstack/config.json` has
`jira.enabled: true` and a review, design, implementation, or QC workflow has a
concrete follow-up worth tracking. Ask before drafting when
`authority.externalTicketCreation` is `ask`; this authority entry is a
prose-level convention, not a CLI-enforced boundary.

For work-item drafting, the skill may invoke exactly one Jira queue operation:

```bash
node <kstack-plugin-root>/scripts/kstack-jira.mjs draft --project KEY --issue-type TYPE --summary TEXT --description TEXT --session-id ID
```

`draft` is fully offline. Never invoke `doctor`, `show`, `approve`, `unfreeze`,
`submit`, `reconcile`, `resolve`, or `discard` from this skill. Never describe
the authority setting as an enforced approval gate. The real external-action
boundary is the host tool-permission prompt; `approve` also requires a TTY and
tamper-evident payload-hash confirmation.

For repository onboarding, ask whether the user has an existing Jira delivery
stack, needs a new one, has an existing project that needs a board/backlog, or
wants to skip Jira. The skill may invoke
`<kstack-plugin-root>/scripts/kstack-jira-bootstrap.mjs preview` or `show`; both
are offline. Default an ordinary repository to one dedicated Jira project/space
and one Kanban delivery board/backlog with a saved project-bounded filter. Ask
whether the target is Jira Software or Jira Business: Software uses the Agile
board API, while Business uses the project-management template's native Board
view. Apply preflights accessible project types and must never issue a Software
board POST for a Business space. Larger programs or tasks may request multiple
explicit project/phase scopes, but the current executable provisions one scope
per preview and must report multi-space orchestration as unavailable. Additional
Dev or Release boards are opt-in. `validate` and `reconcile` are read-only Jira
operations and may run when the user requests validation or before escalating an
incomplete or ambiguous onboarding state. Reconciliation must occur before a
human is asked how to handle an uncertain apply result. Never invoke `approve`
or `apply` from this skill. Approval and apply are host-side operations that
require interactive confirmation of the exact preview hash and separate
`jiraAdministration` authority.

Jira Cloud is the only v1 target. The hostname rule accepts exactly one tenant
label plus `.atlassian.net`; it is a typo/DNS-suffix guard, not protection from
an attacker-controlled Atlassian tenant. `doctor` performs the site-identity
assertion and warns that `BROWSE_PROJECTS` does not prove issue-level
visibility when project defaults, workflows, or automation apply security.
