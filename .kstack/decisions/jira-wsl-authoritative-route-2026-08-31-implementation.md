# WSL-authoritative Jira route implementation checkpoint

**Jira:** KSTK-117  
**Related:** KSTK-114, KSTK-115  
**Date:** 2026-08-31  
**State:** active; Windows-to-WSL handoff remains pending

## Implemented

- Added repository-level `AGENTS.md` startup guidance that makes the enrolled
  `.kstack/config.json` route authoritative and prohibits MCP, environment,
  Windows DPAPI, and duplicate-file fallbacks.
- Updated Jira, initialization, and secret-management skills to preserve the
  existing WSL route and fail native Windows Jira requests closed until a fixed
  WSL handoff exists.
- Retired `windows-dpapi-current-user-v1:jira-cloud-auth-v1` in the Secret
  Broker planner even when a caller supplies an old qualification claim.
- Retired Windows Jira enrollment, rotation, authentication, and adapter
  qualification modes in the protected PowerShell worker. Safe probe,
  inventory, synthetic DPAPI lifecycle, and revocation behavior remain so any
  legacy record can be identified and retired without exposing it.
- Reclassified the Linux desktop Secret Service Jira cell as optional platform
  work rather than the WSL repository's credential path.

## Verification

- Focused Secret Broker suite: 14 tests, 12 passed, 0 failed, 2 environment-
  gated skips.
- Direct native PowerShell check returns
  `KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED` for `SyntheticJiraAdapter`.
- Live Jira projection succeeded through the existing WSL credential and
  created KSTK-117 with both initial lifecycle events.

## Remaining

- Implement and qualify the repository-bound native-Windows-to-WSL Jira
  executor handoff.
- Add adversarial tests for distribution/repository ambiguity, path binding,
  credential non-export, and exact error reporting.
- Run the integrated repository suite and publication gates on the consolidated
  worktree before claiming completion.
