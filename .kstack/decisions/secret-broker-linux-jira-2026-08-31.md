# Linux Secret Service Jira cell

**Date:** 2026-08-31  
**Jira:** KSTK-114  
**Status:** implementation active; real backend qualification pending

## Owner outcome

The Jira Cloud Secret Broker path must not remain Windows-only. Linux receives
its own independently qualified desktop Secret Service cell using the existing
`linux-secret-service-v1:jira-cloud-auth-v1` identity. No Windows qualification,
protocol test double, credential file, or ordinary environment value can qualify
the Linux cell.

## Implemented boundary

- The protected Linux worker exposes only probe, synthetic lifecycle, synthetic
  Jira adapter, interactive enrollment/rotation, revocation, safe inventory, and
  Jira authentication-check modes.
- Production backend access is fixed to root-owned, non-writable
  `/usr/bin/secret-tool` in the current D-Bus desktop session. There is no
  arbitrary command, URL, reveal, export, template, or environment-injection
  operation.
- Values enter through `/dev/tty` with echo disabled, go to Secret Service over
  standard input, return only inside the protected worker, and are overwritten
  in owned buffers. Metadata and revocation tombstones use user-owned `0700`
  directories, `0600` files, no-follow reads, exclusive creation, file and
  directory durability, and generation binding.
- The Jira adapter accepts only `https://TENANT.atlassian.net`, disables redirect
  behavior by issuing one native HTTPS request, discards the response body, and
  emits the shared fixed content-free receipt.
- Rotation retains the prior Secret Service generation for recovery. Revocation
  writes the fail-closed tombstone before clearing all admitted generations, so
  a cleanup failure cannot resurrect use.

## Validation disposition

The deterministic protocol-double lifecycle and Jira adapter tests pass without
emitting their generated values. The current WSL host has D-Bus tooling but no
`/usr/bin/secret-tool` or admitted desktop Secret Service provider. Repository
authority denies device installation, so no package was installed and no real
backend claim is made here.

KSTK-114 remains In Progress until `Probe`, `SyntheticLifecycle`, and
`SyntheticJiraAdapter` all pass against a real Linux desktop Secret Service,
the exact evidence is reviewed, and the reviewed tree is published.
