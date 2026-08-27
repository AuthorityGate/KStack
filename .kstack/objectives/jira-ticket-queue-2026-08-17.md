# Objective brief: KStack-to-Jira automated ticket queue

**Date:** 2026-08-17 · **Depth:** deep (per `.kstack/config.json` `workflow.objectiveDepth`)
**Status:** ready for design (see readiness note at end)

## Problem and affected users

KStack review/design/QC sessions routinely surface backlog items and "future
process/procedure" ideas mid-session — deferred work, follow-ups, process
improvements noticed while reviewing something else. Today these have no
durable home: they exist only in the session transcript. When the session
ends (or context compacts), they are lost. Affected user: the project owner
(Kevin), who is the sole operator of every KStack session and the sole
consumer of any resulting Jira tickets.

This is explicitly *not* about KStack validating changes against Jira (that
is AuthorityGate's separate, unimplemented CAB/change-validation draft at
`AuthorityGate/platform/Orchestrator/DESIGN_PLAN_JIRA_INTEGRATION.md` — out of
scope, do not reuse its architecture). It is narrowly: KStack sessions
generate candidate backlog items; today nothing captures them.

## Desired outcome and measurable evidence

A KStack session that surfaces a backlog-worthy item (a deferred decision, a
follow-up task, a process idea) can propose it as a Jira ticket without the
user having to context-switch out of the session, and — once the user
approves — the ticket is actually created in Jira with no further manual
step. Success evidence: a backlog item raised during a real KStack session
becomes a real Jira issue (with correct project/fields) after one explicit
approval action, and the KStack session can point to the created issue key.

## Current behavior (observed, not assumed)

- **No Jira integration exists in KStack today** — confirmed by exhaustive
  search of `.kstack/`, `plugins/`, `.agents/`, README.md: zero references.
- **The only real precedent in the owner's ecosystem is read-only and
  manual**: `AI-TODO/projects/AuthorityGate/update_keystone_roadmap.py`. It
  is run by hand ("any time a Jira item is closed or added"), authenticates
  via `Basic base64(email:apiToken)` with the token sourced from a plaintext
  notes file (`Jira.txt`), and does a one-way pull: `POST
  /rest/api/3/search/jql` with cursor pagination (`nextPageToken`/`isLast` —
  the legacy offset `/search` endpoint is 410 Gone on Jira Cloud) against
  three projects (KVAL/KRES/KGOV), then regex-replaces an embedded `const
  DATA = {...}` blob in a static HTML file. No ticket creation, no write-back,
  no queue, no durability across restarts.
- **This session already has live Atlassian MCP tools connected**
  (`mcp__claude_ai_Atlassian__*` — authenticate, complete_authentication, and
  by extension whatever read/write tools that server exposes once
  authenticated). Their exact capability surface has not yet been enumerated
  and must be checked by the design phase before committing to a mechanism.
- **KStack itself is a plugin/skill system, not a hosted service.** There is
  no always-on process, no database, no webhook receiver. The closest
  existing precedent inside KStack for "durable local state written by a
  script, read back later" is `kstack-reflexion.mjs` and its project-local
  `reflexion-lessons.json` — a flat JSON file with atomic-write semantics,
  explicitly independent of the optional `kstack-memory` subsystem (which is
  disabled in this repo: `memory.enabled: false`).

## Constraints

- **No always-on process.** Any queue/outbox must be a plain file (or files)
  written/read synchronously within a skill invocation — not a background
  worker, not a hosted service, not a durable SQL outbox (AuthorityGate's
  draft design leans on exactly that; it does not transfer to KStack's
  execution model).
- **Authority matrix has no slot for this today.** `.kstack/config.json`
  `authority` currently covers inspect/edit/test/commit/push/pullRequest/
  merge/deploy/deviceInstall/destructive. Creating an external Jira ticket is
  none of these — it needs a new authority entry, and per the user's answer
  during objectives clarification ("auto-file with approval gate") it must
  default to `ask`, mirroring the existing `commit`/`push` posture, not
  `allow`.
- **Must not depend on `kstack-memory`.** That subsystem is disabled by
  default and explicit-retrieval-only; reflexion-lessons.json deliberately
  did not depend on it, and this feature shouldn't either.
- **Credential handling must not repeat the AuthorityGate precedent's
  weakness** (plaintext token in a notes file, `Jira.txt`). Whatever auth
  mechanism is chosen must not require a new plaintext secret file in the
  repo.
- **Jira Cloud API specifics** (confirmed twice now, once in the draft design
  doc, once in the live script — treat as reliable): the legacy offset
  `/search?jql` endpoint is 410 Gone; all search must use `POST
  /rest/api/3/search/jql` with cursor pagination. Any REST-based design must
  account for this from the start.

## Non-goals

- Not building Jira-side change validation / CAB approval gating (that's the
  separate, unimplemented AuthorityGate CAB design — different problem,
  different repo, out of scope here).
- Not building a general two-way sync or webhook ingestion from Jira back
  into KStack. This objective is outbound only: KStack proposes, human
  approves, ticket gets created. Reading ticket status back into KStack
  sessions is a possible future extension, not part of this design.
- Not replacing or automating `update_keystone_roadmap.py` — that script and
  its roadmap-mirror purpose are unrelated to this objective and stay as-is.
- Not scoped to a specific Jira project yet — which project(s) new
  KStack-originated tickets land in is an open question for the design
  phase, not decided here.

## Failure, recovery, and reversibility expectations

- If ticket creation fails (network, auth, Jira-side validation), the
  proposed ticket content must not be lost — it should remain visible/
  re-triable, not silently dropped.
- A rejected or abandoned proposal must be safe to discard with no residual
  state that could cause a duplicate ticket on a later, unrelated approval.
- Since this is user-approval-gated per action (not a queue that
  auto-flushes), there is no batch/rollback concern in the initial scope —
  each approval is a single, independent, reversible-in-Jira action (the
  user can always close/delete the ticket in Jira directly; KStack does not
  need its own undo).

## Open questions for the design phase (Codex to weigh options, not pre-decide)

1. **Mechanism**: thin `.mjs` REST client (mirroring `kstack-reflexion.mjs`'s
   style) vs. the already-connected Atlassian MCP tools vs. shelling out to
   AuthorityGate's existing `JiraServiceManagementService` client. Trade-offs
   (credential model, portability outside this one session/account, maintenance
   burden) need to be laid out, not assumed.
2. **Where does the queue/draft state live** before approval — an
   `.kstack/jira-queue.json` (mirroring `reflexion-lessons.json`'s pattern)
   the user reviews and approves per-item? Or is "approval" just the
   in-conversation `ask` gate with no separate persisted draft file at all
   (simpler, but loses the item if the session ends before the user answers)?
3. **Which Jira project(s)** do KStack-originated tickets land in — a new
   dedicated project, or an existing one (KVAL/KRES/KGOV are AuthorityGate's,
   not KStack's — KStack likely needs its own, but this needs the user's
   input during design, not an assumption).
4. **Ticket field mapping** — what does a KStack-originated ticket need
   (summary, description, labels/tags identifying it as KStack-sourced,
   linkage back to the KStack session/decision that produced it)?

## Readiness for design

**Ready with risks.** The problem, outcome, current-state facts, and hard
constraints (no hosted process, `ask`-gated authority, no `kstack-memory`
dependency, Jira Cloud cursor-pagination requirement) are established from
primary evidence. The named open questions are genuine design-space
questions, not blocking ambiguity — they are exactly what the design phase
(Codex draft + Opus review) should resolve with presented options, per
`kstack-design/SKILL.md` step 6 ("present at least two viable options for
each material decision").
