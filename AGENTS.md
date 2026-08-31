# KStack repository agent instructions

## Jira execution authority

ALWAYS inspect `.kstack/config.json` before diagnosing or performing Jira work,
because this repository's enrolled KStack route is authoritative.

- The sole Jira credential and executor for this repository are in WSL. The
  enrolled source is the Linux path declared by `jira.credentialSource`.
- In WSL, use `plugins/kstack/scripts/kstack-jira-tracking.mjs` and the other
  repository Jira scripts with `--config .kstack/config.json`.
- Never treat a missing Atlassian/Jira MCP connector as a Jira outage, and do
  not search for a replacement connector, environment credential, Windows
  DPAPI record, or second credential file.
- Native Windows KStack remains supported, but native Windows does not own Jira
  credentials. Use the fixed repository-bound handoff in
  `plugins/kstack/workers/kstack-jira-wsl.ps1`; it accepts only `append`, `list`,
  and `sync`, and executes the enrolled Jira script inside the explicitly bound
  WSL distribution.
- Never read, display, copy, migrate, or expose the credential file's contents.

The local KStack Jira outbox is authoritative and Jira is its projection. Read
`plugins/kstack/references/JIRA_TRACKING.md` before appending lifecycle events.

From native Windows PowerShell in this repository:

```powershell
.\plugins\kstack\workers\kstack-jira-wsl.ps1 -Command list
.\plugins\kstack\workers\kstack-jira-wsl.ps1 -Command append -File C:\path\to\event.json
.\plugins\kstack\workers\kstack-jira-wsl.ps1 -Command sync
```
