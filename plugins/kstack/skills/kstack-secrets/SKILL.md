---
name: kstack-secrets
description: Inventory, prepare, migrate, and use credentials through KStack opaque handles and registered target adapters. Use for password, API-token, certificate, or secret migration and lifecycle work; never use it to reveal a value or inject one into an arbitrary command.
---

# KStack Secrets

Keep protected values outside the model-facing process while completing one
exact approved target operation.

## Entry

1. Read `../../references/SECRET_BROKER.md` and the current repository authority
   configuration.
   If `.kstack/config.json` already enrolls an authoritative Jira credential
   source, do not create a parallel platform credential merely because another
   host is running KStack. In this repository, Jira custody is WSL-only and the
   native-Windows DPAPI Jira route is retired.
2. Never request or accept a credential value in chat. Inventory only safe
   metadata supplied by the owner: purpose, kind, environment, target label,
   current custody family, desired backend, and lifecycle intent.
   Treat the complete contents and format of every secret-bearing source file
   as opaque: never inspect its labels, delimiters, line structure, or value
   count with a generic shell, editor, model-facing reader, or diagnostic tool.
3. Treat discovery, backend configuration, enrollment, execution, rotation,
   revocation, deletion, recovery, migration, and provider mutation as distinct
   actions. Reconfirm authority at the actual mutation boundary.

## Work

1. Run `node ../../scripts/kstack-secret-broker.mjs status` before any broker
   action. While it reports `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`, only
   closed metadata inventory validation and content-free planning are allowed.
   Do not invoke any Windows/Linux worker mode, enroll a value, contact a
   backend/target, or treat a caller-supplied qualified-cell string as evidence.
   Unsupported backend, platform, or adapter combinations remain unavailable.
   Do not use the broker to migrate this repository's Jira credential to
   Windows. Cross-host Jira work requires a target-bound WSL executor handoff,
   not duplicate custody.
2. Require the exact backend cell and target adapter to pass synthetic
   qualification before a real value is enrolled.
   Only after a later implementation item removes the global fence may Linux
   qualification run the protected worker's `Probe`, `SyntheticLifecycle`, and
   `SyntheticJiraAdapter` modes against the real desktop Secret Service.
   Missing `/usr/bin/secret-tool`, missing D-Bus session custody, a locked or
   failed provider, and WSL/headless operation remain
   `BLOCKED_UNQUALIFIED`; never substitute the protocol test double or the Jira
   credential file for real backend qualification.
3. Direct the owner to the protected local no-echo entry command. Do not place a
   value in a tool argument, ordinary environment variable, file created by the
   model, clipboard instruction, stdout, or stderr.
   A legacy source may be consumed only by a separately audited, exact-format
   trusted importer that never returns source content; otherwise enroll a
   rotated replacement directly through the no-echo prompt.
4. Prepare one target-bound, generation-bound, time-bounded operation. Execute
   through the protected worker and accept only its fixed content-free receipt.
5. For migration, retain the source until destination read-back, target-use,
   rotation, recovery, and observation checks pass. Deletion always requires a
   separate destructive approval.

## Result

Report counts and opaque IDs only. Distinguish `UNAVAILABLE`, `INVENTORIED`,
`BLOCKED_UNQUALIFIED`, `READY_FOR_NO_ECHO_ENROLLMENT`, `PILOT_VALIDATED`,
`MIGRATED_SOURCE_RETAINED`, and `MIGRATION_COMPLETE`. Never equate enrollment
with migration completion or fixture evidence with production qualification.
If any value reaches model-visible output, stop using it, classify it as
compromised, require rotation, and record only a value-free incident receipt.
