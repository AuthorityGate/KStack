# Host Portability round-one clarification

**Thread:** `host-portability-2026-08-26`
**Status:** `ROUND_ONE_CLARIFICATION_LOCKED`
**Next state:** `READY_FOR_ROUND_2`
**Owner response:** explicit `YES` to HP-Q1, HP-Q2, and HP-Q3
**Scope:** exact readback only; no implementation or external action authorized

## Bound source record

| Source | SHA-256 |
|---|---|
| Objective | `9119407fc59c09391faaab87d62ec6acd0e6a8f5f4c73f5783f9265ca6ed0cfb` |
| Round-1 decision brief | `2ed769a76a112b7c365f84ddf628aeac5716309ec6a3fe6fbc6e17e7f07eb5f4` |
| Round-1 Codex report | `f1de4ea1497be8de29c550b4fe65bb75f9c258a222e56f9feac5b71864eb229a` |
| Round-1 Codex envelope | `00850e293bea6541212c93ce41a46cdeac2aea1a663b76a5ccf58d1320ebeb05` |
| Round-1 Opus report | `69e7f40e101b988ac6a347721a1890eb5a30a5c9a065ffe6027dfd47d3163973` |
| Round-1 Opus envelope | `2a44eced4dc3fd36d94aa24e5a387676cfe717249bd569a8d358986022a4c879` |
| Round-1 manifest | `83d005d4c6eb82b1962bec77aba52edfc6033e907d7b318e2750c2fc5d84c174` |
| Round-1 synthesis | `46027696b464fa4509926a2a5d0c1b2516c2239c86ce1785e51b0036dd127bb4` |
| Pre-lock item ledger | `ff696dc57904af6a5edad74815cc0fb5a430434811cfb650560883d77a8f1329` |

Round 1 reviewed digest
`2ed769a76a112b7c365f84ddf628aeac5716309ec6a3fe6fbc6e17e7f07eb5f4`
and scored Codex 46 / Opus 64. The synthesis extracted three and only three
genuine owner decisions. The owner explicitly accepted every recommended
answer below without qualification.

## Locked decisions

### HP-Q1 - protected host-governance component: YES

Extend the protected-broker pattern so an agent-unwritable component holds the
conformance signing keys, active-set pointer, replay ledger, and protected
receipt log, and mediates every `FULL` ask-tier or privileged action.

Consequences locked with this answer:

- adapter declarations, skills, MCP clients, models, and host prompts cannot
  grant or promote authority;
- pattern-only host permissions cannot qualify `FULL` ask/privileged profiles;
- read/advisory portability may qualify independently under its own proven
  requirements; and
- HP-TC04 and HP-TC07 must use this protected component rather than assume a
  cooperative agent-writable trust domain.

### HP-Q2 - exact host binding under Q30: YES

Atomic activation covers KStack-owned components. The exact running host build
and relevant live configuration are mandatory external admission facts that
are remeasured. A change immediately invalidates eligibility; it is never
treated as an atomically activated KStack file or excused by shorter evidence
lifetime.

Consequences locked with this answer:

- kernel, schema, adapter, broker, and other KStack-owned compatibility members
  still activate as one digest-pinned compatible set;
- the running process identity is distinguished from an on-disk binary;
- changed, unknown, stale, or contradictory host facts fail closed per affected
  operation; and
- HP-TC11 must express external-host detect-and-invalidate behavior without
  weakening locked Q30's exact binding requirement.

### HP-Q3 - persisted-data rollback rule: YES

Block an activation that changes persisted artifacts unless the previous set
can read those artifacts or an independently verified restore or
forward-recovery path exists. Otherwise rollback is explicitly unavailable and
that limitation is disclosed before approval.

Consequences locked with this answer:

- restoring an active pointer alone never counts as data rollback;
- migration compatibility/recovery evidence is an activation prerequisite;
- rollback availability cannot be inferred after migrated writes occur; and
- HP-TC12 must preserve the last compatible set or refuse activation rather
  than overclaim reversibility.

## Confirmed readback

The complete readback is confirmed as follows:

1. **HP-Q1: YES** — protected agent-unwritable governance component with the
   exact key, pointer, replay-ledger, receipt-log, and mediation duties above.
2. **HP-Q2: YES** — atomic KStack-owned activation plus exact remeasured running
   host build/configuration as an external admission fact whose change
   immediately invalidates eligibility.
3. **HP-Q3: YES** — no artifact-changing activation without backward
   readability or independently verified restore/forward recovery; otherwise
   rollback is disclosed unavailable before approval.

No answer selects an implementation language, IPC mechanism, host adapter,
provider, storage engine, or broader Capability Fabric redesign. HP-TC01-TC12
remain independent technical defects and must be reviewed in bite-size slices.

## Gate transition

`ROUND_ONE_CLARIFICATION_LOCKED` is satisfied. Host Portability is
`READY_FOR_ROUND_2` for isolated technical items only. This record authorizes no
product implementation, installation, host configuration, credential use,
commit, push, deployment, publication, or external test.
