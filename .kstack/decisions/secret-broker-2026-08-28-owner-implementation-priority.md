# Secret Broker owner implementation priority

**Date:** 2026-08-28  
**Owner direction:** complete the full runtime backlog and begin migrating
secrets by Sunday, 2026-08-30  
**Supersedes:** the implementation-not-authorized statement for local Secret
Broker implementation and synthetic validation only

## Authorized now

- Project-local Secret Broker implementation, packaging, and tests.
- Metadata-only inventory and migration planning that never reads or records a
  credential value, credential file path, tenant identity, or private account.
- Synthetic credential enrollment, execution, rotation, revocation, recovery,
  deletion, crash, and leakage trials.
- A reversible real-credential pilot after the exact backend and target adapter
  pass their synthetic gates and the operator enters the value through the
  protected no-echo path outside model-visible chat.

## Not implied

- Automatic scanning or import of `.env`, key, token, certificate, browser,
  password-manager, or credential files.
- Pasting a value into chat, a tool argument, Jira, GitHub, a repository file,
  an ordinary environment variable, or a report.
- Bulk migration before each target adapter is qualified.
- Deleting or disabling a source credential before destination read-back,
  target-use validation, recovery proof, an observation window, and a separate
  destructive approval.
- Provider account creation, OpenBao installation/administration, production
  deployment, repository commit/push, or weakening any existing authority gate.

## Sunday milestone

1. Close the model-facing inventory, opaque-handle, migration-plan, and receipt
   schemas.
2. Implement and synthetically qualify the first Windows current-user DPAPI
   custody cell.
3. Implement and synthetically qualify one narrow Jira Cloud authentication
   adapter that discards provider content and returns a fixed safe receipt.
4. Produce a metadata-only inventory for the remaining secret classes.
5. Permit a real Jira-token pilot only after steps 1-3 pass. Retain the source
   unchanged and treat the migration as incomplete until recovery and rotation
   are proven.

The Sunday milestone is a safe start to migration, not a claim that every
credential class or every backlog item is complete.
