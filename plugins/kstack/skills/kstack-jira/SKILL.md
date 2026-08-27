---
name: kstack-jira
description: Draft an offline Jira ticket in KStack's local queue when Jira integration is enabled. This skill never approves, submits, reconciles, resolves, or otherwise contacts Jira.
---

# KStack Jira Drafting

This is an optional extension used only when `.kstack/config.json` has
`jira.enabled: true` and a review, design, implementation, or QC workflow has a
concrete follow-up worth tracking. Ask before drafting when
`authority.externalTicketCreation` is `ask`; this authority entry is a
prose-level convention, not a CLI-enforced boundary.

The skill may invoke exactly one Jira queue operation:

```bash
node <kstack-plugin-root>/scripts/kstack-jira.mjs draft --project KEY --issue-type TYPE --summary TEXT --description TEXT --session-id ID
```

`draft` is fully offline. Never invoke `doctor`, `show`, `approve`, `unfreeze`,
`submit`, `reconcile`, `resolve`, or `discard` from this skill. Never describe
the authority setting as an enforced approval gate. The real external-action
boundary is the host tool-permission prompt; `approve` also requires a TTY and
tamper-evident payload-hash confirmation.

Jira Cloud is the only v1 target. The hostname rule accepts exactly one tenant
label plus `.atlassian.net`; it is a typo/DNS-suffix guard, not protection from
an attacker-controlled Atlassian tenant. `doctor` performs the site-identity
assertion and warns that `BROWSE_PROJECTS` does not prove issue-level
visibility when project defaults, workflows, or automation apply security.
