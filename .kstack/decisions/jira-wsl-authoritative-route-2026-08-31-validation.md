# WSL-authoritative Jira route validation checkpoint

**Jira:** KSTK-117  
**Related:** KSTK-114, KSTK-115  
**Date:** 2026-08-31  
**State:** locally validated; publication and fresh-session observation pending

## Validated outcome

The KStack repository now has one Jira credential source and one authoritative
executor: the existing WSL enrollment in `.kstack/config.json`.

Native Windows does not enroll or use a Jira credential. The Windows DPAPI Jira
cell is rejected by the Secret Broker planner and its enrollment, rotation,
adapter-qualification, and authentication modes fail with
`KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED`. Inventory and revocation remain so a
legacy record can be retired safely.

The closed native Windows handoff at
`plugins/kstack/workers/kstack-jira-wsl.ps1` accepts only tracking `append`,
`list`, and `sync`. It validates the exact `Ubuntu` distribution, Windows
checkout, WSL checkout, repository namespace, WSL Node path, and enrolled Jira
configuration. It invokes fixed executables without a shell. For append, it
copies only the non-secret event document to a mode-0600 WSL temporary file and
removes that exact file after execution. Credential material is neither read
nor transported by the wrapper.

## Evidence

- Native PowerShell `list` reached the authoritative WSL outbox successfully.
- Native PowerShell `append` replayed an existing KSTK-117 event and returned
  `created: false`, proving exact idempotency without adding an event.
- Native PowerShell invocation of the retired Jira adapter returned
  `KSTACK_SECRET_WINDOWS_JIRA_CELL_RETIRED`.
- Jira synchronization through the enrolled WSL source created KSTK-117 and
  projected its prior events successfully.
- Focused Jira bridge and Secret Broker suite: 17 total, 15 passed, 0 failed,
  2 environment-gated skips.
- Architecture gate: 9 passed, 0 failed.
- Install-health, native Windows setup, and bridge suite: 10 passed, 0 failed.
- Full repository suite: exit 0 across 1,004 declared top-level tests.
- `git diff --check`: clean.

## Remaining lifecycle work

- Publish the consolidated reviewed worktree before closing KSTK-117.
- Observe one newly started Codex session following `AGENTS.md` without trying
  MCP or a second credential before closing KSTK-115.
- KSTK-114 remains optional Linux desktop platform work and is not required for
  this repository's Jira connection.
