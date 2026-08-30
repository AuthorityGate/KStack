# Linux qualification validation v3 — 2026-08-29

This immutable receipt supersedes validation v2 only as the current validation
identity. It does not edit or invalidate earlier evidence projected to Jira.

## Exact implementation identities

- Production contract: `plugins/kstack/scripts/kstack-linux-qualification.mjs`
  — SHA-256
  `9b105ec26d491f56dd4273fd0e6642fa021e869003e490ba39d6883a96ba6415`.
- Adversarial tests: `tests/linux-qualification.test.mjs` — SHA-256
  `cf2fdb71fbf6544e457ea9a431aa7089e09ca9201720b1707970b3663dcbb3a6`.
- Current WSL2 cell evidence:
  `.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json` — SHA-256
  `d682f6096c06a17f6d327b0554128cc27b43d23bfee4a82cf00ab7ec0ed89ecc`.
- Install-health audit manifest:
  `plugins/kstack/install-health-audit-manifest-v1.json` — SHA-256
  `703c99bf2bd49d78d564f8382e9b919b1b0c8d37d6b28f23da850a26ad6f9cdc`.
- Architecture gate: `tests/reflexion-architecture-gate.mjs` — SHA-256
  `6a954f380f86b339389deb646beb0ac331835a46dc6fb5e9029f89e7789e9e81`.
- Architecture use-site inventory — SHA-256
  `dd78f8ed78ae4a1da4af3c917367c6643df86143c756c5f023a685454b5b639a`;
  capability counts are exactly `{Buffer: 3, crypto: 3}`.

## Repair sealed by this receipt

The privileged-backend validator now binds each `QUALIFIED` claim to the exact
required effective capability: cgroup v2 requires `CAP_SYS_ADMIN`, eBPF
requires `CAP_BPF` or `CAP_SYS_ADMIN`, and pidfd requires `CAP_SYS_PTRACE`.
Merely setting `privilegedExecutionObserved` with an empty capability set is
rejected. The retained WSL2 row remains valid and non-qualified.

## Validation results

- Linux focused logical cases: 6 passed, 0 failed.
- Production architecture: 9 passed, 0 failed.
- Install health: 4 passed, 0 failed.
- Full repository: 820 tests, 819 passed, 0 failed, 1 intentional skip.
- Full-suite duration: 70365.09768 ms.
- Audit manifest check: passed.
- `git diff --check`: passed.
- Runtime maturity report diff: empty; the report remains deliberately
  untouched pending genuine full qualification closure.

Child-process tests were run outside the resumed WSL sandbox. Inside that
sandbox, Node 24.12.0 returns successful child status/output while also setting
`spawnSync.error.code` to `EPERM`; KStack correctly treats that contradiction as
a failure. No qualification evidence relies on the contradictory sandbox row.

## Non-promotion statement

The current Ubuntu WSL2 platform observation is one qualified platform cell.
The exact four-cell distribution matrix is not qualified. No Linux lifecycle
cell was issued. cgroup v2 and pidfd remain `SEAM_TESTED`, eBPF remains
`UNAVAILABLE`, and zero privileged backends are qualified. Jira items KSTK-33,
KSTK-47, and KSTK-41 therefore remain Active.
