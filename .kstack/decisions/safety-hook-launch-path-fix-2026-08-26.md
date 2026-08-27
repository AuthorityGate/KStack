# Safety hook launch-path correction — 2026-08-26

## Finding

Both `PreToolUse` handlers used this root expression:

```text
${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-.}}
```

When neither variable was exported into the hook process, the expression selected
the current working directory. From the KStack repository root this attempted to
load `/mnt/e/Source/Projects/KStack/scripts/kstack-safety-hook.mjs`, which does not
exist, and Node exited with code 1. Because the manifest registers both user- and
project-scope handlers, a single tool use could display the failure twice.

This was a launcher failure, not a policy decision and not evidence that the
registered policy artifacts were untrusted.

## Reproduction

- Missing plugin-root binding: `MODULE_NOT_FOUND`, exit 1.
- Explicit installed plugin root: hook starts, returns structured JSON, exit 0.

## Correction

The two commands now use the host's exact plugin-root placeholder:

```text
node "${CLAUDE_PLUGIN_ROOT}/scripts/kstack-safety-hook.mjs" --scope user
node "${CLAUDE_PLUGIN_ROOT}/scripts/kstack-safety-hook.mjs" --scope project
```

The unsafe working-directory fallback was removed. A regression assertion pins
both complete command strings and rejects reintroduction of the fallback.

## Verification

- Focused safety and install-health suite: 33 passed, 0 failed.
- `./setup --host codex --scope user`: exit 0.
- Installed cache version: `0.1.0+codex.20260826140409010`.
- Post-deploy health: `PASS`; six executable probes passed; Codex filesystem and
  JSON surfaces matched.
- Direct invocation from the installed cache: exit 0, neutral `{}` response for a
  permitted read.
- Source hook-manifest SHA-256:
  `871d89bc3aac75f02ac661d22ba00ff1ff1d54af38ef9de0a398c4322b505907`.
- Source audit-manifest SHA-256:
  `9eae6aefabd1f40134a66a40d61806bb0a51a2d70835e4c3983dcc7b1795a9c4`.
- Safety registration refreshed with `enabled: true` and the corrected release
  digest.

Already-running host sessions may retain the old hook manifest until restarted or
reloaded. New sessions use the refreshed installed cache.

## Fail-closed permission invariant retained

An intermediate local patch attempted to treat v9fs/DrvFS mode bits as
projected and skip the group/world-writable checks. That change was rejected
and fully removed before release validation. The hook still requires trusted
mode bits on both `.kstack` and its policy files. Environment-aware setup must
detect an incompatible filesystem and stage to an admitted native filesystem;
the trust check itself is not weakened.

## Reflexion status

The generalized lesson is prepared but not recorded. The configured recorder also
attempts remote memory synchronization, and that export was rejected pending
explicit authorization for the diagnostic payload and destination. No bypass or
silent local-only substitution was attempted.
