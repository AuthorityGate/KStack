# Objective brief: KStack Host Portability

**Date:** 2026-08-26
**Thread:** `host-portability-2026-08-26`
**Parent:** `kstack-capability-fabric-2026-08-26`
**Depth:** deep
**Status:** ready for isolated round-one design review

## Problem

KStack currently operates through Codex CLI and Claude Code integrations. Its
governance semantics are valuable beyond those two hosts, but prompt-file
compatibility alone cannot prove that another coding agent enforces the same
workspace, permission, tool-interception, credential, and artifact boundaries.
A host may load an Agent Skill or call an MCP tool while lacking a required
action-time safety control.

This thread must design a portable host boundary without weakening KStack's
current Codex or Claude behavior and without claiming equivalent safety from a
host's self-description. It is one isolated Capability Fabric slice, not a
redesign of release automation, domain packs, memory, or confidence policy.

## Locked owner decisions

This objective is subordinate to the locked clarification record
`.kstack/decisions/kstack-capability-fabric-2026-08-26-round-1-clarification.md`
(SHA-256 at creation:
`9804fe6926390604e31c3000355a64876d7abb4df90076313a97bb05647b2a77`).
A different product choice requires a linked superseding owner decision.

- **Q14:** operation eligibility is derived from executed, digest-pinned
  conformance evidence, current policy, host/version, and evidence expiry.
  Adapter declarations record observations but cannot grant trust. A missing
  capability degrades or rejects only the affected operation.
- **Q15:** Codex CLI and Claude Code remain supported. OpenCode is the first new
  host used to exercise and stabilize the contract. Goose is evaluated later
  in a separate thread because its wider agent lifecycle creates additional
  semantic-overlap risk.
- **Q30:** kernel, schema, adapter, broker, pack, and host compatibility is
  digest-pinned and activated atomically. Failed or incompatible activation
  leaves the last compatible set active.
- The Governance Kernel remains the sole authority source. A host, adapter,
  Agent Skill, MCP client, model, or external instruction cannot promote its
  own permissions.

## Required decision

Select a host-portability architecture that defines:

1. a canonical, versioned operation and artifact contract independent of any
   host's prompt syntax;
2. a layered delivery model using Agent Skills for progressive instructions,
   MCP for capability-negotiated tools/resources, and host-native enforcement
   for permission and action-time controls;
3. per-operation eligibility calculated only from recent executed conformance
   evidence and explicit policy;
4. truthful `FULL`, `DEGRADED`, and `UNSUPPORTED` outcomes with structured
   reason codes and no whole-host overclaim;
5. compatibility, activation, upgrade, downgrade, and rollback behavior;
6. preservation tests for the existing Codex and Claude integrations;
7. an OpenCode-first validation plan followed by a separately reviewed Goose
   adapter; and
8. a clear reason to defer ACP unless KStack later becomes an agent backend.

## In scope

- Canonical operation request/result/error/receipt schemas.
- Operation-requirement profiles and host evidence records.
- Host identity, version, adapter digest, policy digest, test-fixture digest,
  execution environment, expiry, and evidence provenance.
- Discovery, read-only, advisory, ask-tier, and side-effecting operation
  classes.
- MCP and Agent Skills interoperability boundaries.
- Host-native hook, permission-prompt, workspace-root, background-task,
  structured-output, and credential-broker seams.
- Conformance harnesses, replay fixtures, negative tests, and compatibility
  matrices.
- Atomic adapter activation and recoverable rollback.

## Out of scope

- Implementing or installing any adapter.
- Adding release-provider logic, new domain packs, memory storage, or Ollama.
- Replacing Codex and Opus as independent design reviewers.
- Making KStack a general autonomous agent or ACP server.
- Advertising Cursor, Cline, Gemini CLI, Goose, or any other host as supported
  before its own evidence-backed qualification.
- Treating MCP transport authentication as authorization for KStack actions.
- Allowing a host manifest, successful prompt load, or model assertion to count
  as conformance evidence.

## Success evidence

- A canonical fixture produces semantically identical artifact bytes or a
  defined normalized equivalent on qualified Codex, Claude, and OpenCode
  adapters.
- Every operation has explicit requirements; tests prove a missing capability
  rejects or degrades that operation without silently promoting it.
- Tampered, stale, mismatched-host, mismatched-version, mismatched-adapter, and
  replayed evidence never produces eligibility.
- Existing Codex and Claude golden flows remain unchanged unless a separately
  approved migration says otherwise.
- OpenCode passes the read-only/advisory subset before any ask-tier claim and
  passes action-time negative tests before any write-capable claim.
- An incompatible upgrade does not partially activate and the previous
  compatible set remains available.
- Status output names the exact eligible operation, evidence digest, policy,
  expiry, and any degraded/unsupported reason.

## Constraints

- Deterministic code owns validation, eligibility, authority lookup, artifact
  binding, activation, and terminal status. Models may explain results but do
  not decide them.
- Default deny applies when evidence is absent, stale, malformed, or ambiguous.
- Conformance must observe behavior by execution; it cannot trust capability
  labels supplied by the adapter under test.
- Tests may not perform uncontrolled external side effects. Write-path probes
  use isolated fixtures, fake providers, or explicitly approved disposable
  targets.
- Secrets and credentials are never embedded in manifests, fixtures, receipts,
  prompts, or MCP resources.
- This round authorizes only local objective/review artifacts and read-only
  validation. It grants no implementation, installation, commit, push,
  deployment, credential, or external-service authority.
