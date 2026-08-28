# Jira continuous work and history projection

Jira serves two separate purposes in KStack. Both are required when
`jira.tracking.mode` is enabled:

1. **Forward work:** every newly accepted objective, design item, defect, or
   follow-up receives a stable Jira work item.
2. **Delivery history:** material design, implementation, QC, completion, and
   release events are appended to that same item so Jira shows what changed,
   what was fixed, and when it shipped.

The local hash-chained outbox is authoritative. Jira is a queryable projection;
it must never be the only copy of KStack evidence.

## Mandatory lifecycle protocol

When `jira.tracking.mode` is not `off`:

1. Before substantive work starts, append `ITEM_CREATED` for the root work
   item. When a design ledger or remediation creates another independently
   actionable item, append a separate `ITEM_CREATED` before advancing it.
2. Append a new event after every material state change. Use:
   - `ITEM_ACTIVE` when work starts;
   - `ITEM_UPDATED` for a material scope or implementation change;
   - `REVIEW_COMPLETED` for each scored review, including failed reviews;
   - `DESIGN_VALIDATED`, `IMPLEMENTATION_VALIDATED`, and `QC_VALIDATED` only
     when the corresponding gate actually passes;
   - `BUG_FOUND` and `BUG_FIXED` for genuine defects and their verified repair;
   - `ITEM_BLOCKED` and `ITEM_REOPENED` for those state changes;
   - `ITEM_DONE` only when no required work remains; and
   - `ITEM_RELEASED` for each shipped version, with the release receipt digest.
3. Use `jira.tracking.repositoryNamespace` and `projectKey` exactly. A work
   item's `threadId` and `itemId` remain stable for its full lifetime.
4. Give each source event a deterministic, content-bound `sourceEventId`.
   Replaying the exact event is idempotent; reusing an ID for changed content
   is an integrity failure.
5. Evidence paths must be repository-relative and paired with the exact
   SHA-256 of the bytes reviewed or shipped. Never place credentials, tokens,
   raw model output, customer data, or secret-bearing excerpts in an event.
6. Write a closed-schema event input to a private temporary file and run:

   ```bash
   node <kstack-plugin-root>/scripts/kstack-jira-tracking.mjs append --file PATH --config .kstack/config.json
   ```

7. After the append succeeds, run:

   ```bash
   node <kstack-plugin-root>/scripts/kstack-jira-tracking.mjs sync --config .kstack/config.json
   ```

   `approval-queued` creates or reuses offline Jira drafts and performs no Jira
   network operation. `automatic` may create the Jira issue and append one
   marker-bound history comment per event; it is valid only with explicit
   `externalTicketCreation: allow`. Before an automatic issue create, the
   projector performs a complete project-bounded search for the item's
   deterministic identity label. One match is adopted only after the issue ID,
   key, project, type, summary, description, labels, and configured create
   fields match the frozen draft. Multiple or mismatched matches fail closed.
   A confirmed item-to-numeric-ID/key mapping is stored in the private OS user
   state directory, not the repository or Jira queue. A create POST is issued
   at most once: an ambiguous response is searched and read back, while a
   durable unresolved-attempt record blocks later automatic reposts until the
   exact issue becomes visible. The projector likewise searches for the event
   marker before every comment and reconciles an ambiguous response before
   refusing to retry.

If the local append fails and `jira.tracking.required` is true, block the phase.
If it is false, continue only after reporting the exact tracking failure. A
queued draft awaiting owner approval is not a tracking failure: the durable
event already exists and the dashboard must show the projection as pending.

## Event input

The input uses `kstack-jira-outbox-event-v1` semantics and contains exactly:
`repositoryNamespace`, `projectKey`, `threadId`, `itemId`, `sourceEventId`,
`kind`, `localState`, `occurredAt`, `summary`, `evidence`, `review`, and
`release`. `review` is either null or contains `decision`, `confidence`,
`failed`, `security`, `dissent`, and `questions`. `release` is non-null only for
`ITEM_RELEASED` and contains `name`, `releaseDate`, and `receiptSha256`.

Do not collapse a multi-item ledger into one Jira issue merely to reduce issue
count. The root item can remain an umbrella, but each independently actionable
item must be separately visible and independently closable.
