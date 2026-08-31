# WSL-authoritative Jira route owner decision

**Date:** 2026-08-31  
**Status:** owner-authorized amendment, implementation pending  
**Jira item:** pending automatic KSTK assignment

## Owner decision

KStack has one authoritative Jira execution environment and one Jira
credential source for this repository: the established WSL environment and the
Linux path enrolled in `.kstack/config.json`.

The proposed native-Windows Jira credential is rejected. Native Windows KStack
support remains in scope for installation, skills, and non-Jira runtime work,
but it must not enroll, copy, migrate, retrieve, or independently use a second
Jira credential.

## Required behavior

1. Jira work executed inside WSL continues to use the existing enrolled
   credential source and the repository's KStack Jira scripts.
2. A native Windows session must not fall back to a Windows credential, an
   Atlassian MCP connector, environment variables, or ad-hoc credential
   discovery.
3. If native Windows Jira invocation is added, it must use a fixed,
   repository-bound handoff to the WSL Jira executor. The Jira credential stays
   inside WSL and is never returned to Windows.
4. The handoff must fail closed when the WSL distribution, repository binding,
   enrolled configuration, or executor identity is ambiguous.
5. Fresh sessions must be directed to the enrolled KStack Jira route before
   attempting connector discovery so a missing optional connector is not
   reported as a Jira outage.

## Scope consequences

- The Windows DPAPI Jira cell is no longer an accepted Jira route. Any generic
  Windows secret-broker capability is a separate concern and does not authorize
  Jira credential custody.
- The native Linux Secret Service cell remains optional platform work; it is
  not required for this repository's WSL Jira route because the existing WSL
  credential source is already authoritative.
- KSTK-115 remains the cross-session routing defect: new sessions must reliably
  select the repository-enrolled route.
- This decision does not claim the Windows-to-WSL handoff is implemented or
  validated.

## Acceptance boundary

Completion requires proof that there is no active native-Windows Jira
credential path, WSL Jira synchronization still succeeds through the enrolled
source, and a fresh-session/native-Windows request either reaches the fixed WSL
executor without exposing credentials or fails with a precise handoff error.
