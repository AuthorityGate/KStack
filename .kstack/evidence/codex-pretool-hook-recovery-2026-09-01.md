# Codex PreToolUse hook recovery receipt

**Completed:** 2026-09-01  
**Repository:** `AuthorityGate/KStack`

## Reproduced cause

The affected Watlow thread was created as Codex session
`01a04da4-73c1-72f3-85f3-bee6d1715827` with KStack cache build
`0.2.0-rc.1+codex.20260830235821363`. That build did not contain the native
Codex hook manifest. Its shared hook command depended on the Claude-only
`${CLAUDE_PLUGIN_ROOT}` variable, so the retained Codex hook registry exited 1.
Codex threads retain the hook commands registered when the thread is created;
refreshing KStack does not rewrite that registry inside an already-running or
resumed thread.

A second failure was reproduced in the active KStack thread after the first
repair. That thread retained absolute hook commands under cache build
`0.2.0-rc.1+codex.20260901143355040`. Plugin refresh removed that cache
directory while the thread was still open, so both retained PreToolUse command
paths became nonexistent and exited 1 before every tool call. Disabling the
project registration could not help because the executable itself could no
longer launch.

The image files and `view_image` operation were not the cause. The failures
appeared beside image views because the stale PreToolUse command ran before
each tool call.

## Repair

- Modern Codex setup records every KStack cache path before removal and, after
  removal, preserves each retired absolute path as a compatibility symlink to
  the stable repaired runtime. This is necessary because Codex plugin removal
  clears the whole plugin cache family, not only the currently reported
  version. The inventory is also retained in a closed, value-free registry
  outside the cache family, so a path remains recoverable even if an earlier
  refresh already removed it. Setup snapshots that registry before invoking
  any Codex plugin command because even a capability probe may reconcile the
  cache. It restores the compatibility links only after the final plugin
  installation and physical-cache verification, because later plugin commands
  may prune them again. Open threads therefore keep launching a valid, current
  hook across plugin refreshes. A fork is needed only to refresh the thread's
  skill catalog, not to stop hook failures.
- Direct-broker detection is limited to Bash and PowerShell tool invocations.
  Non-shell tools such as `apply_patch` are no longer denied merely because
  their data mentions a KStack script path.
- Regression tests cover both behaviors.

An older installation that predates cache compatibility can retain its context
and load the complete current registry with:

```text
cd /mnt/e/Source/Projects/Watlow
codex fork 01a04da4-73c1-72f3-85f3-bee6d1715827
```

## Verification

- Exact `view_image` PreToolUse envelopes returned `{}` with exit code 0 from
  both current stable hook entrypoints while the working directory was Watlow.
- A fresh ephemeral Codex thread in Watlow completed a real shell tool call
  without any hook failure.
- Focused safety, setup, install-health, Windows, Jira, and WSL tests passed.
- `npm test`: 1,063 tests, 1,061 passed, 0 failed, 2 intentionally skipped.
- `git diff --check`: passed.

Post-publication setup installed Codex cache build
`0.2.0-rc.1+codex.20260901163520968`. Its safety hook and the stable-runtime
hook both match the qualified source SHA-256
`c8aa5fa6c0695027bf99d3b69607afe529076523b16722befc27300bc6ab4709`.
Both refreshed entrypoints returned `{}` with exit code 0 for the exact Watlow
`view_image` envelope. Fresh ephemeral Codex thread
`01a05dd4-34ad-73c3-a55c-4c8c6b84abd9` then ran a real `pwd` tool call in
Watlow and completed with `HOOK_CANARY_OK` without hook warnings.

Project safety-hook registration was left disabled through KStack's supported
administration command, consistent with the owner's current trust policy. The
source repair still prevents the false denial when hooks are later enabled.

The active KStack thread's deleted `...143355040` cache path was restored as a
compatibility link to `.kstack-runtime`. Subsequent tools in that same thread
completed without PreToolUse failures. Installer regression tests reproduce
whole-family plugin cache removal, assert multiple retired cache paths become
compatibility links, and preserve the new physical cache qualification
independently. A retained-session inventory found 19 KStack cache versions in
August/September Codex records; 18 missing paths were restored to the stable
runtime and the current physical cache was retained.
