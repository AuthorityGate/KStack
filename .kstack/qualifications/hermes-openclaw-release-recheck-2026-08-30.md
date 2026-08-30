# Hermes and OpenClaw stable-release recheck — 2026-08-30

Observed at: `2026-08-30T05:06:50.000Z`  
Scope: read-only official GitHub release metadata; no installation, provider
invocation, credential use, or host activation

## Result

No newer stable release is available for either blocked Host candidate. The
existing exact negative qualifications remain the current evidence, and the
owner-disposition gates remain open.

| Host | Most recent stable release | Published | Current KStack result |
|---|---|---|---|
| Hermes Agent | `v2026.8.27` | `2026-08-27T12:06:53Z` | Already requalified; blocked on unsigned tag and unfinished `rebuild_venv` API |
| OpenClaw | `v2026.7.1-2` | `2026-08-04T00:41:26Z` | Already qualified negatively; blocked on critical/high dependency advisories and insufficient ACP sandbox boundary |

The later OpenClaw releases visible on the official release endpoint are
prereleases (`v2026.8.1-beta.2`, `v2026.8.1-beta.3`, and
`v2026.9.1-beta.1`). The accepted requalification rule requires a clean exact
stable release, so those prereleases do not replace the frozen candidate.

## Primary sources

- `https://api.github.com/repos/NousResearch/hermes-agent/releases?per_page=10`
- `https://api.github.com/repos/openclaw/openclaw/releases?per_page=10`
- `https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.27`
- `https://github.com/openclaw/openclaw/releases/tag/v2026.7.1-2`

## Disposition boundary

This check does not close HB-TC07 or HB-TC08. Each row still requires an
independent review of the exact negative qualification, followed by an owner
decision to accept the unsupported disposition or wait for and requalify a
later clean stable release. No Jira Done transition is permitted before both
requirements are durably bound.
