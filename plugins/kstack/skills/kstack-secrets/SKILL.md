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

1. Validate the closed metadata inventory and generate a content-free migration
   plan with `node ../../scripts/kstack-secret-broker.mjs`. Unsupported backend,
   platform, or adapter combinations remain blocked.
2. Require the exact backend cell and target adapter to pass synthetic
   qualification before a real value is enrolled.
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

Report counts and opaque IDs only. Distinguish `INVENTORIED`,
`BLOCKED_UNQUALIFIED`, `READY_FOR_NO_ECHO_ENROLLMENT`, `PILOT_VALIDATED`,
`MIGRATED_SOURCE_RETAINED`, and `MIGRATION_COMPLETE`. Never equate enrollment
with migration completion or fixture evidence with production qualification.
If any value reaches model-visible output, stop using it, classify it as
compromised, require rotation, and record only a value-free incident receipt.
