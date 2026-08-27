# Objective brief: automated release controller with Jira

**Date:** 2026-08-26
**Depth:** deep
**Status:** ready for isolated round-one design review

## Problem

KStack governs whether a release is authorized but lacks mature unattended
post-ship reach. Jira integration exists for a ticket queue, and prior health
design exists, but there is no single crash-recoverable release workflow that
links Jira, GitHub, deployment state, health evidence, and rollback.

This thread is only Release Automation. It must not redesign confidence policy,
domain packs, host portability, or memory.

## Owner-confirmed outcome

Create one automated `kstack-release` skill using the same method for every
provider:

```text
Jira release record -> deterministic release broker -> GitHub/deploy adapter
-> health observation -> automatic rollback when safe -> Jira receipts/status
```

- Jira is a first-class release workflow adapter and durable human-facing
  release ledger, not merely memory.
- When Jira is enabled, production releases require a linked release record.
  Repository setup asks whether development branches also get release records.
- Jira/GitHub linkage binds issue, repository, branch, PR, commit/tree, build,
  environment, deployment, health, and rollback evidence. Parallel branches
  remain distinct.
- After one exact approval envelope, the protected broker performs authorized
  work unattended without repeated prompts.
- V1 has no arbitrary command or generic webhook executor.
- Reversible, pre-authorized releases must attempt automatic rollback before
  human escalation. Irreversible releases never pretend rollback is safe.
- Concurrency uses scoped resource claims and fencing rather than one global
  hard limit. Conflicting releases cannot overlap.
- Production/user-data releases default to short-lived broker credentials;
  explicit risk acknowledgement may override. Development may use a weaker
  configured posture. Revocation always prevents future use.
- Authenticated provider status plus independent canary is default. The user may
  waive it, but the result is `OBSERVATION_SKIPPED_BY_OWNER`, never `HEALTHY`.
- Qualification begins in staging with synthetic/non-user data, bounded blast
  radius, abort criteria, and exercised rollback.

## Success evidence

- One state machine covers plan, preflight, approval, dispatch, observation,
  cancellation, expiry, failure, ambiguity, rollback, reconciliation, and
  manual-action terminals.
- Action-time enforcement is outside the governed agent and validates an exact,
  nonce-bound, revocable approval envelope.
- Timeouts after possible action are reconciled and never blindly retried.
- Jira writes are idempotent and limited to the approved issue/fields/transitions.
  Jira text cannot grant authority or select a target.
- GitHub Actions/environments is the first write-capable provider after a
  read-only observer proves receipt/state requirements.
- Duplicate/out-of-order events, concurrent controllers, credential changes,
  stale commits, branch collisions, health disagreement, rollback failure, and
  crash/restart have deterministic results.
- Provider/health/rollback receipts are linked to Jira without exposing secrets.
- A complete live staging qualification is required before production-ready is
  claimed.

## Non-goals

- General CI/CD replacement or arbitrary shell execution.
- Jira-authored deployment authority.
- Automatic rollback of irreversible data/schema/external side effects.
- Production deployment or Jira writes during this design round.
- Any work in the other four Capability Fabric threads.

## Authority

This objective authorizes project-local design/review artifacts and read-only
inspection. It does not authorize implementation, credentials, ticket changes,
commit/push/merge, deployment, or rollback.
