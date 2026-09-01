# Jira active-backlog reconciliation receipt

**Completed:** 2026-09-01T15:42:18Z  
**Repository:** `AuthorityGate/KStack`  
**Jira project:** `KSTK`  
**Decision:** `.kstack/decisions/jira-active-backlog-reconciliation-2026-09-01.md`  
**Decision SHA-256:** `dab4a704664f38f3b20b916bedee235998cc2337e21a6cff2cd6cf7a4b78f550`

## Applied reconciliation

The authoritative WSL outbox contains 599 events across 99 stable items. The
approved reconciliation added exactly 66 events: 18 `ITEM_DONE` events and 48
`ITEM_PLANNED` events. The resulting latest-state totals are:

- Planned: 74
- Active: 3
- Blocked: 1
- Done: 21

The only active Jira issues are KSTK-26, KSTK-130, and KSTK-135. KSTK-71
remains blocked.

The first batch attempt stopped after the 18 valid `ITEM_DONE` events because
the input contract correctly rejected `ITEM_UPDATED` with `planned` state.
No planned event from that attempt entered the outbox. KStack had no truthful
lifecycle kind for returning an existing item to Planned, so the tracking
contract now defines `ITEM_PLANNED` for that exact transition. The remaining
48 events were regenerated with that kind and appended once.

## Jira projection read-back

The sole WSL Jira executor completed automatic synchronization successfully.
It processed 599 projected events and read back all 99 latest issue states:

- 74 confirmed in Jira status category `new`;
- 3 confirmed in Jira status category `indeterminate`;
- 21 confirmed in Jira status category `done`; and
- 1 blocked item preserved as comment-only because the portable Jira category
  mapping intentionally has no blocked category.

No Windows Jira credential or connector route was used.

## Contract change and verification

Changed tracking script SHA-256:
`dd090abe91584e6aed6e21767150e5330ead9c4f200bd18c0f0caa18c4894908`.

Verification completed:

- `node --test tests/jira-tracking.test.mjs tests/jira-wsl-bridge.test.mjs`:
  2 files passed, 0 failed.
- `git diff --check`: passed.
- The architecture digest pin for `kstack-jira-tracking.mjs` was updated to the
  changed script digest.
- `npm test`: 1,063 tests, 1,061 passed, 0 failed, 2 intentionally skipped.

The full-suite qualification initially exposed stale architecture metadata for
the current `kstack-install-health.mjs`, Jira tracker, and safety-hook sources.
The generated audit manifest and the explicit architecture pins were refreshed,
then the full suite passed cleanly.
