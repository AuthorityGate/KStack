# OpenClaw and Hermes focused add — 2026-08-28

Status: accepted into the focused backlog; refined by
`gstack-hermes-openclaw-review-2026-08-28.md`; implementation not yet qualified

OpenClaw and Hermes are optional integration cells, not dependencies of the
KStack Secrets skill or sources of implicit authority.

- OpenClaw enters Secret Lifecycle as a provider contender. Qualification must
  pin the exact version and prove trusted entry, opaque references, target
  allowlisting, egress-only substitution, subagent exclusion, lifecycle,
  ambiguity, crash, and output-leak behavior. File-backed, ordinary environment,
  arbitrary-command, and direct-value fallback paths are prohibited.
- Hermes enters Host Breadth as an Agent Skills and bounded MCP host. It may
  select safe metadata and opaque operations but must never receive credential
  values through prompts, memory, logs, environment files, tools, subprocess
  arguments, or model-visible output.

The owner subsequently authorized continued Jira use for the current private
session, with rotation deferred until the work is complete. Credential values
remain prohibited from repository artifacts and further output.
