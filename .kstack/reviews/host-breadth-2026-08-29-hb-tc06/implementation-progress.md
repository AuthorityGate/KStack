# HB-TC06 implementation progress — second-host abstraction proof

**Date:** 2026-08-29  
**State:** primary implementation validated at 93; no second-host proof issued  
**Jira item:** `hb-tc06-second-host-proof` / `KSTK-28`

## Implemented boundary

`kstack-second-host-proof.mjs` implements the closed HB-TC06 proof contract
without opening, installing, or claiming support for Goose. It includes:

- exact HP-TC01 through HP-TC12 and HB-TC01 through HB-TC05 implementation
  inventories;
- a bounded OpenCode stability gate that requires a clean exact-build
  qualification and a distinct later requalification after a bound change;
- an owner-gated, content-addressed separate Goose objective record;
- the exact nine host-independent ports and two separately bound adapters;
- all fourteen required lifecycle surfaces with explicit ownership and
  no-bypass evidence;
- a material-difference threshold of at least three behavior/adaptation rows;
- distinct OpenCode and Goose subject processes, roots, observers, evidence,
  and receipt sets over the same fixture/profile bytes;
- byte-identical normalized kernel requests, results, and traces;
- Codex, Claude, and OpenCode preservation evidence plus exact negative-case
  coverage; and
- the five closed outcomes, with no whole-host or third-host promotion.

The validator rejects reused host evidence, cosmetic-only differences,
host-specific branches in the shared boundary, semantic drift, ambiguous
ownership, stale evidence, incomplete fixture execution, authority-scan
failure, and preservation failure. A valid synthetic row can prove only the
named advisory/public-read profile on the two exact builds.

## Frozen implementation identities

- Normative candidate:
  `.kstack/decisions/host-breadth-hb-tc06-2026-08-27-design-candidate.md`
  — SHA-256
  `98667edb88dcb5d24ad735335699977f48ea39cf1ec6cf56ba339675106b3427`.
- Production contract: `plugins/kstack/scripts/kstack-second-host-proof.mjs`
  — SHA-256
  `e2eaea4484987ad28a9a8268aeee7c779c830e63c9f73df7850779aec8ec7319`.
- Adversarial tests: `tests/second-host-proof.test.mjs` — SHA-256
  `d6616bded659737103d3204c549669b5e06486e145da70458485306a5caba512`.
- Architecture gate: `tests/reflexion-architecture-gate.mjs` — SHA-256
  `57ead46a9ee9dd3f8684928c70cc5e48bf707340f2e2eb992263e86562b3c701`.
- Install-health audit manifest:
  `plugins/kstack/install-health-audit-manifest-v1.json` — SHA-256
  `dd96e3051c492de1056a7175312128e5e8b9f40cc45016b2b2d66fe4fe6f792a`.
- Architecture use-site identity for the production module:
  `2d21450db206a7b12b8c98c388da22903b48ee3f78be26a9cbda42563ad34844`,
  with exact capability counts `{Buffer: 3, crypto: 3}`.

## Validation

- Focused HB-TC06 logical cases: 8 passed, 0 failed.
- Production architecture: 9 passed, 0 failed.
- Install health: 4 passed, 0 failed.
- Complete repository: 828 tests, 827 passed, 0 failed, 1 intentional skip.
- Complete-suite duration: 70,255.141565 ms.
- Audit-manifest `--check`: passed.
- `git diff --check`: passed.
- Runtime-maturity report diff: empty.

Child-process gates were run outside the resumed WSL sandbox because that
sandbox can return successful child output/status while also setting a false
`spawnSync.error.code` of `EPERM`. No evidence in this record accepts that
contradictory execution state.

## Evidence-bound primary readiness

| Area | Score |
| --- | ---: |
| Closed stability and separate-objective gates | 19 / 20 |
| Shared port and host-specific adapter confinement | 19 / 20 |
| Material-difference and ownership matrix | 19 / 20 |
| Independent execution, semantic equality, and non-reuse | 18 / 20 |
| Preservation, negative cases, outcomes, and integration | 18 / 20 |
| **Primary readiness** | **93 / 100** |

The remaining seven points are reserved for the required fresh non-authoring
independent final review and real execution evidence. This item is eligible for
final review of the implementation contract, but it is not eligible for a
second-host qualification result.

## Required before closure

1. Close and freeze the applicable HP-TC01 through HP-TC12 rows.
2. Close HB-TC01 through HB-TC05 and execute the exact OpenCode profile.
3. Retain a distinct later clean OpenCode requalification after a bound change.
4. Open and close the separate Goose objective with refreshed primary-source,
   reuse, ownership, owner-clarification, and Codex evidence.
5. Implement the resulting thin Goose adapter without transferring KStack
   authority.
6. Execute the same fixtures on distinct OpenCode and Goose processes, roots,
   observers, evidence sets, and receipt sets.
7. Pass preservation and a fresh independent final review at confidence at
   least 95 with empty failed, security, dissent, and question arrays.

Until those exact results exist, Jira remains Active and no abstraction or
Goose support claim is made.
