# Native Windows Codex support

**Date:** 2026-08-31  
**Status:** implementation validated; publication pending  
**Trigger:** owner-provided native Windows Codex activation failure evidence

## Outcome

KStack must install, activate, and execute its supported Codex workflows from
native Windows PowerShell without requiring WSL. Skill invocation must follow
Codex's `$skill` contract, while `/kstack-*` remains documented as Claude Code
syntax only.

## Required behavior

1. A native PowerShell installer supports Codex user and project scopes,
   installs a copied runtime without symlink assumptions, and uses the modern
   Codex plugin lifecycle when available with a direct-skill fallback.
2. Installation prints the exact native Codex invocation and performs
   structural health checks against the installed Windows paths.
3. The Reflexion runtime contract admits an exact qualified native Windows
   Node/Unicode tuple instead of rejecting every `win32` process by platform.
4. Windows filesystem custody uses canonical non-reparse paths, stable
   pathname/descriptor identity, bounded-size checks, exclusive creation,
   atomic replacement with sharing-violation retries, and explicit recovery
   diagnostics. POSIX mode/UID and directory-fsync claims are not projected
   onto Windows.
5. Codex hooks continue to use `commandWindows`, the installed `PLUGIN_ROOT`,
   bounded execution, and the existing deny-only authority model.
6. Native Windows tests cover first install, refresh, direct-copy fallback,
   skill discovery layout, runtime-contract generation/admission, no-match
   lookup, mutation/recovery, hook launch shape, and wrong slash-command
   guidance.
7. Linux and WSL behavior remains byte-compatible except for shared metadata
   that explicitly adds the qualified Windows cell.

## Closure gate

Focused native-Windows tests, neighboring installer/Reflexion/hook suites, and
the repository-wide suite must pass with zero failures. A real native Windows
PowerShell/Node smoke test is required when those executables are available in
the qualification environment. Jira remains active until the reviewed tree is
published.

## Qualified native cell

- Windows PowerShell 5.1.26100.7920
- `win32-x64` Node 24.19.x, V8 13.6, ICU 78.3, Unicode 17.0
- Resolver probe `3e2a3a2daf77c4c2b16d2919f86995f41188248b553f62c27e4f448b03d31f64`
- Unicode probe `97c358e818dc7f9e236bad4a21592c49053b06335ea0811936ba668a271f023b`

Real disposable-profile probes pass for user direct-copy, modern Codex plugin,
uninitialized project-copy, initialized project safety enrollment, Windows
hook launch, contract generation/admission, and no-match retrieval. The final
repository-wide run passed 1,000 of 1,001 tests with zero failures and one
expected Windows-secret-cell skip. The reviewed publication gate remains open.
