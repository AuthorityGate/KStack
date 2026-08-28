# KStack Jira continuous tracking objective

**Date:** 2026-08-28  
**Status:** focused objective  
**Owner requirement:** Jira must provide both a forward roadmap and a durable
view of completed work, changes, upgrades, and releases over time. Every new
KStack item must begin tracking when it is added to the KStack item ledger.

## Outcome

For an enrolled repository, KStack projects its local work-item lifecycle into
Jira without making Jira the authority for design or implementation truth:

1. every new KStack item becomes one Jira issue in the configured project;
2. pending and active items remain visible in backlog/board views;
3. each accepted lifecycle change appends one immutable, content-bounded Jira
   activity entry and moves the issue to the matching workflow category;
4. completed issues remain queryable in Jira and are assigned to the exact
   project version representing the release/upgrade that contained them; and
5. Jira read-back and local receipts prove what synchronized, what is pending,
   and what is ambiguous or externally drifted.

## Required behavior

- Item capture occurs immediately after the durable local item-ledger write,
  before the workflow advances to the next KStack phase.
- Machine-local outbox and mapping state lives in the OS user-state directory,
  outside the repository and Git, under a deterministic repository namespace.
- A project selects `off`, `approval-queued`, or `automatic` tracking during
  init and may change it later. New repositories default to
  `approval-queued`; the owner may select `automatic` for the exact configured
  Jira project. `deny` authority always wins.
- Automatic scope is closed: create a marked issue, add a marked KStack history
  comment, transition that marked issue, and assign an already-approved Jira
  version. It does not grant arbitrary issue edits, deletion, project changes,
  workflow changes, or version administration.
- Creating/updating/releasing a Jira version remains `jiraAdministration` and
  requires its own approval unless the owner separately configures that exact
  action as allowed.
- All outbound values are non-secret, bounded, canonical, and scanned. Jira
  never receives raw model output, credentials, private local paths, or
  unreviewed external content.
- Unknown provider outcomes never cause blind retry. Reconciliation performs
  reads first and can adopt only one exact marker/content match.
- The main KStack window shows backlog-sync counts, last successful event,
  ambiguity/failure, and full approval questions while workers continue.

## Source of truth and scope

KStack's objective, item ledger, accepted evidence digests, and release receipt
remain authoritative. Jira is a durable human-facing projection and audit
view. Human Jira edits are detected as drift; they never silently rewrite the
KStack ledger.

This objective includes initial seeding, ongoing item/event capture, workflow
status projection, release/version linkage, reconciliation, history import for
the current KStack project, tests, packaging, and live qualification. It does
not implement the validated M1-M7 deployment runtime or make Jira execute a
release.

## Success evidence

- A synthetic new item appears once in Jira and has one stable mapping.
- Successive design, implementation, QC, and completion events appear once in
  Jira activity with repository-relative artifact names and SHA-256 digests.
- Jira workflow category matches local `planned`, `active`, or `done` state.
- A completed item is associated with one exact release/version and remains in
  Jira history after later releases.
- Crash, timeout, 429, 5xx, malformed success, marker collision, pagination
  drift, permission loss, and external edit fixtures do not duplicate or
  falsely confirm an effect.
- KStack's current nine-item roadmap is present, future added items are captured
  automatically, and live read-back reports zero missing/duplicate/drifted
  items.
