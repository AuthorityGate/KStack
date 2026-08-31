# KStack Secret Broker — WP00 baseline conformance fence

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Work package | `SB-WP00` / Jira KSTK-131 |
| Integrated dependency | SB-TC12 SHA-256 `0c516367cbf7ab6088f17f54594abd364119ad9020c90ca52ca64ed9739b681e` |
| Disposition requested | `WP00_IMPLEMENTED`; broker runtime remains `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT` |
| Authority used | project-local implementation and synthetic/no-contact validation only |

## Outcome

WP00 establishes a fail-closed baseline without creating or changing a secret
value path:

- the complete ordered SB-TC00–SB-TC12 set and SB-TC12 R2 closure receipt are
  bound by `kstack-secret-broker-accepted-design-v1.json`;
- the public `status` command exposes only a fixed content-free unavailable
  record and the registry digest;
- metadata inventory validation and planning remain available, but every plan
  item is `UNAVAILABLE`; caller-declared qualification is explicitly
  non-authoritative;
- Linux and Windows worker entry points fail before probe, state-root creation,
  custody access, value resolution, or target contact;
- native Linux, copy, Codex-cache, and Windows installers carry the registry in
  the source-audit closure;
- the routed skill and reference contract forbid worker invocation while the
  global fence is active; and
- the repository's enrolled WSL Jira bridge is unchanged and remains outside
  the Secret Broker migration.

## Frozen implementation candidate

| Path | SHA-256 | Role |
|---|---|---|
| `plugins/kstack/secret-broker-accepted-design-v1.json` | `a36c61c90f0200e06207015579dc2a0398ac93f3a2a315f2ce0a3906cf9eb6ed` | closed accepted-design registry and unavailable state |
| `plugins/kstack/scripts/kstack-secret-broker.mjs` | `ba4a9c63faa007d3a350c9b364702dc70438cecb096e9dc910cb08707448bdc9` | registry validation, immutable status, and non-authoritative plan fence |
| `plugins/kstack/scripts/kstack-secret-linux.mjs` | `22a6b30627dcc916c116c4464d71a96a75302d56b79df970fa86ed6386f76c5b` | Linux pre-contact implementation fence |
| `plugins/kstack/workers/kstack-secret-windows.ps1` | `2eb7d75b27f15b3ce6932dfe635a2d61402d1669bfd4e7c8324887d51bd64a8c` | Windows pre-contact implementation fence |
| `plugins/kstack/skills/kstack-secrets/SKILL.md` | `847935556b9ebdb93610ab31cd101c4239e9c176d54687317f7b0327aeb9afc5` | routed unavailable behavior |
| `plugins/kstack/references/SECRET_BROKER.md` | `2ee766a3452abff73798a9e5a68ea375cc28dff598e67234105c121d5b1d7db5` | current implementation-fence contract |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `6fd3ef6c90a3cc3c53c24e07f721c7e69ca834497a4c413239d74d6e5e256e7d` | regenerated exact package closure |
| `setup` | `04629b4c0116dafe97b570748b659067494e311c86ad18c2455421045a3c159d` | POSIX/native-copy registry delivery |
| `setup.ps1` | `fa556968b0ac2a787d2982d05e4d599f5b769640f57d776846475462e5caf5d5` | Windows registry delivery |
| `tests/helpers/generate-install-health-audit-manifest.mjs` | `924fc3987f77e02d6b714240adea748757745b96e08c36992deabbff1dc1ee87` | source-audit generator closure |
| `tests/install-health.test.mjs` | `abbeb7f54815f7b0273c0b1bcb44cd7683d319ef031eec207043d498fd4a4616` | install/copy admission coverage |
| `tests/secret-broker.test.mjs` | `5600dd39086d0f70c465ccc3c1241f1f19c8201a5c84c4e0033d5dbfcbad0ecc` | immutable registry, plan, CLI, and worker fence coverage |
| `tests/reflexion-architecture-gate.mjs` | `6c8456f5e1b6afa3a24c37e9d0326e03178bca12f576c468bd0d6af4fd182f05` | exact capability/use-site footprint update |
| `tests/goose-adapter.test.mjs` | `868289cf3aaa544ad55dadae0be951099dd00cba8c9cff0f48f345ce88b314ab` | prior Goose evidence invalidation assertion |
| `tests/second-host-proof-evidence.test.mjs` | `1cd5d0d7a01bfe9a21d44d73474d9866fc159c9e589c5379b7f250745d337963` | prior two-host evidence invalidation assertion |

## Verification

- `npm test`: 1,011 tests; 1,009 passed; 0 failed; 2 skipped. The skips are
  the explicitly environment-gated real Windows worker qualification and real
  Linux desktop Secret Service qualification; neither can weaken the global
  fence.
- Targeted Secret Broker plus WSL bridge: 19 tests; 17 passed; 0 failed; 2
  environment-gated skips.
- Native Windows copy setup/post-deploy audit passed.
- Direct native Windows `Probe` returned exit 1 and only
  `KSTACK_SECRET_WINDOWS_IMPLEMENTATION_UNAVAILABLE`.
- Linux worker tests proved both synthetic modes and `Probe` return only
  `KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE`, with no test state root
  created.
- Skill quick validation passed; audit-manifest regeneration check passed;
  `git diff --check` passed.

The package source change correctly invalidated the checked-in Goose isolated
and OpenCode/Goose two-host currentness bindings. Those qualification artifacts
were not rewritten or promoted. Regression tests assert the stale evidence and
use in-memory test-only rebinding solely to retain downstream tamper-path
coverage.

## Residual boundary and handoff

WP00 does not claim that the existing inventory, receipt, Windows DPAPI, Linux
Secret Service, Jira adapter, or any other Secret Broker mechanism conforms to
SB-TC02–SB-TC11. It does not authorize value entry, provider/target contact,
pilot, production, source migration/deletion, release publication, or Git
publication. The safe runtime claim remains `UNAVAILABLE`.

After exact-candidate review closes at 93/all-zero, WP01 may begin as a new Jira
item for public schemas, canonical codec, registry identifiers, opaque refs,
and the safe CLI. WP01 must preserve this global effect fence until its own
accepted exit explicitly narrows only metadata/public-schema behavior.
