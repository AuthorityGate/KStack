# Linux qualification implementation progress — 2026-08-29

This record is implementation and current-cell evidence. It is not a claim that
the full Linux distribution matrix, lifecycle matrix, or privileged-backend
matrix is qualified.

## Implemented closure contract

- `kstack-linux-qualification.mjs` defines four closed target cells:
  Ubuntu LTS native x64, Debian stable native x64, Fedora stable native x64,
  and Ubuntu LTS WSL2 x64.
- Matrix closure requires exact, duplicate-free coverage of all four cells.
- Lifecycle closure independently requires the ordered clean-install,
  host-discovery, invocation, upgrade, rollback, health, and persisted-data
  recovery steps on native Linux storage for all four cells. Source and rollback
  versions must match; the upgrade version must differ; persisted data digests
  must match before and after recovery.
- Privileged-backend closure independently requires real privileged execution
  for cgroup v2, eBPF, and pidfd on all four cells. Feature presence,
  `SEAM_TESTED`, and `UNAVAILABLE` never promote to `QUALIFIED`.
- Every evidence record is closed-schema, target-bound, digest-bound, and
  limited to a 31-day qualification window.

## Current WSL2 observation

The retained JSON record is
`.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json`.
It records Ubuntu 24.04.3, kernel
`6.18.33.2-microsoft-standard-WSL2`, x86_64, the `/tmp` ext4 filesystem,
operational systemd as PID 1, and apt 2.8.3. These facts were observed through
a Windows-launched `wsl.exe` probe so the managed Codex PID namespace could not
mask the distro's actual init system. Exact raw-output hashes and the composite
digest method are retained in
`.kstack/qualifications/linux-ubuntu-24.04-wsl2-native-probe-2026-08-29.md`.

The WSL2 platform-observation cell qualifies through 2026-09-28. This is one of
four matrix cells and therefore does not qualify the matrix.

Privileged status is deliberately incomplete:

- cgroup v2: `SEAM_TESTED`; cgroup2 and controllers are visible, but no
  effective or permitted capabilities and no authorized privileged mutation.
- eBPF: `UNAVAILABLE`; BTF is visible, unprivileged BPF is disabled, bpftool is
  absent, and CAP_BPF/CAP_SYS_ADMIN are not effective or permitted.
- pidfd: `SEAM_TESTED`; `pidfd_open` succeeded for the current process, but no
  privileged cross-principal execution was authorized.

No lifecycle record was issued. A real clean-install/upgrade/rollback trial
requires two exact KStack release identities and must not be fabricated from two
copies of the same working tree.

## Validation

- Focused Linux qualification tests: 6/6 logical cases passed.
- Production architecture gate: 9/9 passed outside the resumed WSL sandbox.
- Install-health gate: 4/4 passed outside the resumed WSL sandbox.
- The resumed WSL sandbox reports a spurious Node child-process `EPERM` while
  returning successful status and output; it is an execution-environment
  artifact, not accepted as qualification evidence.

## Remaining external cells

- Ubuntu LTS native x64 observation, lifecycle, and privileged backends.
- Debian stable native x64 observation, lifecycle, and privileged backends.
- Fedora stable native x64 observation, lifecycle, and privileged backends.
- Ubuntu LTS WSL2 x64 real two-release lifecycle and privileged backends.

Until those cells are executed, all three Linux Jira tasks remain Active.

## 2026-08-30 external bundle admission

`kstack-linux-qualification-bundle.mjs` now opens and verifies the complete
external evidence set before calling the four-cell evaluator. The manifest,
record JSON, artifact paths, byte hashes, exact file inventory, ownership and
write boundary, timestamps, and secret scan are all fail-closed. A receipt is
issued only when the matrix, lifecycle, and all twelve privileged-backend cells
qualify together. Focused bundle and Linux validation passes 9/9; installed
runtime health passes 4/4. This closes the former caller-supplied-digest
admission gap, but no missing external cell has been executed or claimed.
