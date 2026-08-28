# Jira continuous tracking foundation

## User-visible model

Jira exposes two views over the same stable KStack item identity:

| Need | Jira surface | KStack projection |
|---|---|---|
| What remains to do | backlog and board | one marked issue per KStack item |
| What is happening now | workflow status | `planned -> new`, `active -> indeterminate`, `done -> done` status category |
| What changed | issue activity and comments | one append-only, marked event per accepted KStack transition |
| What shipped/upgraded | releases/versions | exact project version plus `fixVersions` assignment |
| What proves it | issue activity plus local receipts | artifact-relative path, SHA-256, score/counters, and release receipt identity |

Jira supplies the human timeline; KStack retains the authoritative local ledger
and fail-closed reconciliation state.

## Durable local capture

After a KStack skill durably changes an item ledger, it must append one closed
`KstackJiraOutboxEventV1` before that phase can advance:

```text
schema / repositoryNamespace / projectKey
threadId / itemId / stableItemDigest
eventId / eventOrdinal / priorEventDigest / eventDigest
kind / localState / occurredAt
summary / evidence[{repoRelativePath,sha256,evidenceKind}]
review{decision,confidence,failed,security,dissent,questions}?
release{name,releaseDate,receiptSha256}?
```

The item identity is derived from the enrolled repository identity, project
key, thread ID, and item ID—not display text. Event ordinal 1 requires the zero
prior digest; later events require exactly `n+1` and the admitted prior digest.
Exact duplicate digest is a no-op. Conflicting duplicate, skipped ordinal,
future event, invalid evidence path/hash, or altered repository/project binding
blocks projection and cannot be reordered by Jira.

Outbox records are non-secret, canonical JSON, individually bounded, durably
renamed, stored under the OS user-state directory in a private repository-
namespaced root outside Git, and scanned before admission. Raw reviewer
responses, prompt text, provider bodies, absolute paths, credentials, and
arbitrary user-pasted text are prohibited. A separately durable mapping ledger
binds stable item digest to Jira numeric issue ID, issue key, marker, last
confirmed event digest, status category, version ID, provider revision, and
confirmation receipt.

## Tracking modes and authority

- `off`: no event is created; init must state that Jira is not a work/history
  ledger for the repository.
- `approval-queued`: event capture is automatic and local; the main window
  presents the full batch question before provider writes.
- `automatic`: after an explicit repository-scoped owner selection, a worker
  may create/comment/transition marked KStack issues in the one configured
  project. Host policy and `deny` still win.

Version create/update/release is never inherited from ordinary automatic item
tracking. It uses `jiraAdministration` and an exact preview hash. Assignment of
an existing approved version to a marked issue may be included in automatic
tracking only when the repository config explicitly allows it.

## Projection order

For one item, exactly one worker performs:

1. validate repository, tenant, project, principal, config digest, outbox
   chain, and prior mapping;
2. search the deterministic item marker across a complete project-bounded Jira
   search;
3. create the missing issue once or adopt one exact match; multiple/mismatched
   matches are drift;
4. scan all comment pages for the event marker and require a stable complete
   result; create the missing comment once, or adopt one exact comment from the
   bound integration principal;
5. read current issue status and available transitions, transition only when
   one exact transition reaches the configured Jira status category, then read
   back;
6. resolve the exact approved version, assign it when required, and read back;
7. commit the mapping receipt and mark the outbox event confirmed.

Every remote mutation has a durable pre-effect intent. A transport failure that
can be proven before bytes start is a no-effect failure. Timeout, disconnect,
redirect, 5xx, malformed success, 401/403 after request start, or restart is
possibly acted: stop writes, reconcile by exact marker/read-back, and never
blindly retry. Jira 429 follows the existing capped backoff design only when
the qualified endpoint contract proves no effect.

## History and release semantics

The event comment is a closed ADF document containing a human summary, local
state, event kind/time, and safe evidence digests. Its deterministic event
marker and body digest are visible but carry no authority. It is never edited
or deleted by KStack. Corrections append a new event that references the old
event ID.

Workflow status maps by Jira `statusCategory.key`, not a tenant-specific status
name. `planned` requires `new`, `active` requires `indeterminate`, and `done`
requires `done`. A project lacking a unique allowed transition is unqualified
for automatic transition and keeps the event pending for a human.

Jira project versions represent releases/upgrades. KStack previews version
name, description, project ID, release date, and released flag; creation and
release require project administration. Completed issues bind the numeric
version ID through `fixVersions` and exact issue read-back. A name collision,
changed date/state, foreign version, missing permission, or ambiguous write
blocks the release projection; KStack never deletes, merges, or silently edits
a version.

## Skill integration

`kstack-objectives`, `kstack-design`, `kstack-implement`, `kstack-qc`, and
`kstack-review` emit closed events only after their own authoritative local
write succeeds. Creating a new item emits `ITEM_CREATED`; beginning work emits
`ITEM_ACTIVE`; accepted design/implementation/QC emits the corresponding
evidence event; closure emits `ITEM_DONE`; release emits `ITEM_RELEASED`.

In required tracking mode, failure to durably enqueue blocks phase advance. In
advisory mode, it creates a visible `JIRA_TRACKING_DEGRADED` gap but does not
change the local KStack result. Provider sync runs in a worker/agent; the main
window retains its overview and displays pending count, oldest event, last
confirmed event, failures/ambiguity, and full approval questions.

## Qualification

TC02-TC06 each need isolated deterministic fixtures before integration. The
integrated suite covers event-chain corruption, concurrent writers, crash cuts,
duplicate/mismatched markers, comment pagination change, foreign author,
workflow ambiguity, version collision, permission loss, index lag, every HTTP
response class, secret canaries, and recovery without duplicate writes.

Live qualification first imports the nine KStack roadmap items with one
`IMPORTED_BASELINE` event each, then creates a synthetic tenth item and advances
it through active, done, and one test release. Read-back must show exact issue,
activity, changelog/status, and version history before automatic mode is called
qualified.

## Current official Jira basis

- Jira Cloud's issue API supports issue creation, changelog retrieval, available
  transition discovery, and issue transitions:
  <https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/>
- Jira Cloud's comment API supports paginated comment retrieval and comment
  creation:
  <https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/>
- Jira Cloud project versions expose create/read/update and issue counts;
  version creation requires Administer Projects or Administer Jira:
  <https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-versions/>
- REST v3 uses Atlassian Document Format for comment bodies:
  <https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro>

Mutable Jira documentation is design evidence. Implementation must pin and
live-qualify the exact endpoint response shapes it relies on.
