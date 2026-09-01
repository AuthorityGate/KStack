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

The image files and `view_image` operation were not the cause. The failures
appeared beside image views because the stale PreToolUse command ran before
each tool call.

## Repair

- Modern Codex setup now states that pre-refresh threads must be forked with
  `codex fork SESSION_ID` instead of resumed.
- Direct-broker detection is limited to Bash and PowerShell tool invocations.
  Non-shell tools such as `apply_patch` are no longer denied merely because
  their data mentions a KStack script path.
- Regression tests cover both behaviors.

The affected thread can retain its context and load the repaired hook registry
with:

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
