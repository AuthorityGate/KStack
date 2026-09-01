# KCRP Host and Domain offline replay validation

**Date:** 2026-08-29  
**Result:** local preparation validated; provider campaigns remain outstanding

## Integrated result

- Host fixture: exact four-item HB-TC06 dependency closure with one unrelated
  OpenCode item omitted; two reconstructions were byte-identical.
- Domain fixture: exact three-item D7 dependency closure with one unrelated
  assurance item omitted; two reconstructions were byte-identical.
- Focused offline replay test file: pass.
- Production architecture: 9 passed, 0 failed.
- Install health: 4 passed, 0 failed.
- Complete repository: 829 tests; 828 passed; 0 failed; 1 intentional
  platform-dependent skip; duration `73667.687085` ms.
- `git diff --check`: pass.
- Runtime-maturity report diff: empty.

The install-health and complete-repository gates were executed outside the WSL
sandbox because their child-process probes are expected to fail with sandbox
`EPERM`. The same production bytes were tested; no gate was bypassed.

## Bound evidence

| Artifact | SHA-256 |
| --- | --- |
| Host fixture | `9b1732b344a2e79a9eaac92ce79ad6a3e8310aa82aa78730aed694c432bf956f` |
| Domain fixture | `4a937786bf1973fffe582d25bf9666ea96c8714aaa62eb3859c18f1532f2bb26` |
| Focused replay test | `c0e9a10b013347799e18f9ffc47a4e30be34ba3565e15e56e813cc35e3135285` |
| Offline evidence | `0ef82c896df3ac343c203ec0474791a978a0608c96c4c19e0b455f2b1ffa786c` |

## Jira projection

- `KSTK-31`: Active event
  `b2a6486e31c546107503b5ea0ca8611c9d01a31f89841877886b2afd00f2d511`,
  comment `12595`.
- `KSTK-21`: Active event
  `06afa85fae8ee9b3e5cd8ba76abf5ea82500aec38d42fb925506ccd2576c2e60`,
  comment `12596`.

Both remain Active, not Done. Provider usage and provider claims remain null.
No default KCRP route is activated.
