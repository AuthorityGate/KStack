# Decision 0001: clean, host-native derivative

Status: provisional

## Decision

Build KStack as a narrow plugin containing portable, explicitly invoked skills
for Codex and Claude Code. Do not retain GStack's full runtime, browser stack,
global state, automatic routing, or front-running wrapper.

## Evidence

- Official Codex skill discovery supports repository and user skill locations,
  symlinked skills, explicit `$skill` invocation, and disabling implicit
  invocation in `agents/openai.yaml`.
- Claude Code discovers the same skill folders and exposes them as slash
  commands.
- The requested workflow needs five focused capabilities rather than the full
  upstream skill catalog.

## Dual-model status

- Codex: completed the architecture analysis.
- Opus: unavailable during the initial review; the installed Claude CLI hung
  without returning content during a bounded non-interactive probe.
- Consensus: not claimed.

Re-run the design review with both providers before marking this decision final
if Opus becomes available.
