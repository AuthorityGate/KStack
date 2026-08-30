# Linux qualification validation v2 — 2026-08-29

This immutable receipt follows the implementation-progress record and does not
replace or edit evidence already projected to Jira.

## Exact implementation identities

- Production contract: `plugins/kstack/scripts/kstack-linux-qualification.mjs`
  — SHA-256
  `c9c85e0a5a0242bce8aa0e4607de1e2bd87c70cb48bee2e5d01125490736c5d0`.
- Adversarial tests: `tests/linux-qualification.test.mjs` — SHA-256
  `36f2804f912d68a9878b72aa990f1e2abe7a5f4a2142afb38eaad645cc087a78`.
- Current WSL2 cell evidence:
  `.kstack/qualifications/linux-ubuntu-24.04-wsl2-2026-08-29.json` — SHA-256
  `d682f6096c06a17f6d327b0554128cc27b43d23bfee4a82cf00ab7ec0ed89ecc`.
- Install-health audit manifest:
  `plugins/kstack/install-health-audit-manifest-v1.json` — SHA-256
  `d6dd569787a3286cc8377e5932ef120852471c01e0e61dc12a233f008b64a577`.

## Validation results

- Linux focused logical cases: 6 passed, 0 failed.
- Production architecture: 9 passed, 0 failed.
- Install health: 4 passed, 0 failed.
- Full repository: 820 tests, 819 passed, 0 failed, 1 intentional skip.
- Full-suite duration: 74821.094389 ms.
- Audit manifest check: passed.
- `git diff --check`: passed.

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
