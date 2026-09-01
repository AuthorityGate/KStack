# Safety hook project-state default trust — 2026-09-01

The owner explicitly removed POSIX permission metadata as a prerequisite for
KStack project enrollment. This supersedes the permission-bit paragraph in
`safety-hook-launch-path-fix-2026-08-26.md`; that earlier record remains
historical evidence rather than current policy.

Project-local `.kstack/config.json` and `.kstack/safety-hooks.json` are trusted
by default when they are canonical regular files with stable descriptor/path
identity and bounded, valid content. Exact policy and release digests continue
to report later drift as `TAMPERED`. Windows, DrvFS/9p, and ordinary POSIX
workspaces use the same rule and require no `metadata` mount option.

This decision does not change credential custody. Protected credential files
remain outside the repository and retain their existing ownership, link,
permission, size, shape, and target-binding checks.
