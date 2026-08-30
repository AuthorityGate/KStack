# Linux qualification validation v4 — 2026-08-29

This receipt supersedes validation v3 only as the current validation identity.
It does not edit or invalidate earlier evidence projected to Jira.

## Exact implementation identities

- Production contract: `plugins/kstack/scripts/kstack-linux-qualification.mjs`
  — SHA-256
  `9b105ec26d491f56dd4273fd0e6642fa021e869003e490ba39d6883a96ba6415`.
- Adversarial tests: `tests/linux-qualification.test.mjs` — SHA-256
  `44feca30936df67cb8c37a0f9c463ea7088d2bb8af71697eb4f4460825aa9d49`.
- Current WSL2 cell evidence:
  `.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json` — SHA-256
  `76442dd6a22133cc42aaff31a60a50178592f9405a353b22ff36f6c8122cd31c`.
- Native probe evidence:
  `.kstack/qualifications/linux-ubuntu-24.04-wsl2-native-probe-2026-08-29.md`
  — SHA-256
  `27ec6b71246e69fe9b29fd0b350635d066d650b43c5e32ca9bae90a641016ddd`.
- Install-health audit manifest:
  `plugins/kstack/install-health-audit-manifest-v1.json` — SHA-256
  `ff197bacba5a3d34a467cb0e2c071dc6c7e44f969c81e0817ca71bf43cfefe9d`.
- Architecture gate: `tests/reflexion-architecture-gate.mjs` — SHA-256
  `57ead46a9ee9dd3f8684928c70cc5e48bf707340f2e2eb992263e86562b3c701`.
- Linux contract architecture use-site inventory — SHA-256
  `dd78f8ed78ae4a1da4af3c917367c6643df86143c756c5f023a685454b5b639a`;
  capability counts are exactly `{Buffer: 3, crypto: 3}`.

## Observation correction sealed by this receipt

The prior managed Codex shell exposed its own PID namespace and did not expose
the distro's actual init process. A Windows-launched `wsl.exe` probe now binds
the actual Ubuntu WSL2 cell: systemd is operational as PID 1 and `/tmp` is on
ext4. The exact raw-output hashes and deterministic composite-digest method are
retained in the native probe record.

This correction does not promote privileged backends. Effective and permitted
capability masks were zero. cgroup v2 and pidfd remain seam-tested, while eBPF
remains unavailable for qualification.

## Validation results

- Linux focused logical cases: 6 passed, 0 failed.
- Production architecture: 9 passed, 0 failed.
- Install health: 4 passed, 0 failed.
- Full repository: 830 tests, 829 passed, 0 failed, 1 intentional skip.
- Full-suite duration: 80421.953159 ms.
- Audit manifest check: passed.
- `git diff --check`: passed.
- Runtime maturity report diff: empty; the report remains deliberately
  untouched pending genuine full qualification closure.

Child-process gates were run outside the resumed WSL sandbox. Inside that
sandbox, Node 24.12.0 can return successful child status/output while also
setting `spawnSync.error.code` to `EPERM`; KStack correctly treats that
contradiction as a failure. No qualification evidence relies on that row.

## Non-promotion statement

The current Ubuntu WSL2 platform observation is one qualified platform cell.
The exact four-cell distribution matrix is not qualified. No Linux lifecycle
cell was issued. cgroup v2 and pidfd remain `SEAM_TESTED`, eBPF remains
`UNAVAILABLE`, and zero privileged backends are qualified. Jira items KSTK-33,
KSTK-47, and KSTK-41 therefore remain Active.
