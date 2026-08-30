# Hermes `v2026.8.27` requalification — 2026-08-29

**Jira item:** `hb-tc07-hermes-host` / `KSTK-75`  
**Outcome:** `BLOCKED_SOURCE_INTEGRITY`  
**Maximum claim:** source-only negative qualification; no host cell admitted

## Exact source binding

| Field | Value |
|---|---|
| Repository | `https://github.com/NousResearch/hermes-agent.git` |
| Tag | `v2026.8.27` |
| Annotated tag object | `fcebd62163497e77e5de00d26d2ed86cb4ef8761` |
| Commit | `5fc308a70719a83cccdbba4c0e39c23f5a8239d5` |
| Commit subject | `chore: release v0.20.6 (2026.8.27)` |
| Commit authored | `2026-08-27T04:59:29-07:00` |
| Commit committed | `2026-08-27T05:06:41-07:00` |
| Declared package version | `0.20.6` |
| Python range | `>=3.11,<3.14` |
| `pyproject.toml` SHA-256 | `9b6d41aca6d908e5af2f90a335b1c2b7eeaf8e3ce667b5a823a73e8643c56c75` |
| `uv.lock` SHA-256 | `5a9276183671e997c2213ede18b9cda4920e1cf57616219a3b08ddebda3281ab` |
| `hermes_cli/managed_uv.py` SHA-256 | `5ad5b458ecc8fb2d952d8cda8ad06dfd5b85ed51c889defcbfa1780764ed3c54` |

The exact official GitHub annotated-tag API record reports tag
`v2026.8.27`, target type `commit`, the commit above, and signature
verification `verified=false`, `reason=unsigned`. Unlike the earlier accepted
signed candidates, this tag therefore fails KStack's source-verification gate.

## Reproduced source defect

`hermes_cli/managed_uv.py` still defines the annotated Boolean API
`rebuild_venv(uv_bin, venv_dir, python_version) -> bool` with only one expression
statement:

```python
True  # dont remove me. ask ethernet
```

Independent AST inspection reports function line `1453`, body node types
`["Expr"]`, and zero `Return` nodes. The function therefore returns `None`, not
the declared Boolean result. This is the same terminal source-integrity class
that blocked `v2026.8.3`; the newer stable tag does not remediate it.

## Bounded checks

- Exact official tag cloned shallowly into a new isolated temporary root.
- `git rev-parse`, annotated-object inspection, and GitHub tag-object readback
  agree on the tag and commit identities above.
- GitHub reports the annotated tag as unsigned.
- `python3 -m compileall -q hermes_cli`: exit 0 under Python `3.12.3`.
- AST source guard: failed (`rebuild_venv` has no return).
- Dependency advisory scan: **not performed**. The source-verification and
  source-guard failures stopped qualification before dependency admission, so
  no zero-advisory claim is made for this release.
- No dependency installation, provider/model invocation, credential use,
  repository mutation, production endpoint, user data, or persistent host
  configuration occurred.

Compilation is not functional or execution qualification. Because source
verification and the existing high-severity unfinished-function guard fail
before dependency admission, KStack intentionally did not install the locked
dependency set or execute Hermes. No native analysis, delegated mode, Agent
Skills discovery, bounded MCP operation, or whole-host support is claimed.

## Requalification rule

HB-TC07 remains blocked until a later exact stable release is independently
shown to be signed, removes or fully implements the unfinished API, passes
dependency/advisory admission, and completes the per-operation protected
conformance and final-review gates. A branch commit, beta, version string,
prompt, documentation statement, or elapsed time cannot clear this result.
