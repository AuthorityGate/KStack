# Objective brief: KStack Capability Fabric

**Date:** 2026-08-26
**Depth:** deep
**Status:** ready for round-one design review

## Problem

KStack is strong at pre-implementation governance and adversarial QC, but its
useful reach narrows after authorization, across coding-agent hosts, across
non-engineering domains, and across sessions. The owner wants a coherent
improvement design informed by gstack and stronger specialist systems, without
copying their weaker authority boundaries or turning the work into one large,
unreviewable rewrite.

The design must improve four dimensions:

1. **Release automation:** bounded, unattended post-ship observation and
   recovery after one explicit owner authorization.
2. **Domain breadth:** optional capabilities beyond the core software lifecycle
   without weakening governance.
3. **Host breadth:** portable use from more coding agents than Codex and Claude
   Code, with honest disclosure when a host cannot enforce equivalent safety.
4. **Memory maturity:** useful, cited cross-session retrieval with deterministic
   provenance and safe local acceleration.

Ollama must be evaluated as a local inference layer to reduce latency and
paid-provider work. It is not assumed faster or reliable until a
machine-specific benchmark proves that claim.

## Locked confidence schedule

The owner has specified a declining design threshold intended to prevent long
threads from chasing nearly impossible scores:

- rounds 1-10: every required reviewer must be at least **93**;
- rounds 11-21: every required reviewer must be at least **81**;
- rounds 22-41: every required reviewer must be at least **71**; and
- round 42 and later: every required reviewer must be at least **63**. If a
  design remains below 63, stop polishing the same direction and present
  materially different redesign options.

These are defaults. A user may override the schedule during first-time KStack
setup and may set a different repository schedule during initialization of each
new repository. Repository policy overrides the user default. The resolved
schedule is validated, displayed before round one, and digest-bound to the
thread; changing it creates a superseding thread rather than retroactively
lowering an active gate.

The `22-41` interval is a recorded interpretation: the owner explicitly named
rounds 22-33 and then the next threshold change at round 42, leaving rounds
34-41 unstated. It must be directly confirmed before implementation.

Combined confidence is the minimum required-reviewer score, never an average.
The process stops after required owner clarification as soon as both reviewers
clear the applicable round threshold with zero deterministic check failures,
zero security findings, zero unresolved material dissent, and zero unresolved
required questions. It must not run improvement rounds merely to raise a
qualifying score.

The repository currently encodes a different 90/80/70 round/skill-class policy
in config, validation, gate selection, tests, and references. That is a
confirmed implementation defect. Correcting it is a separate first migration
slice; this objective does not pretend the current gate implements the owner's
schedule.

## Required outcome

Produce a full architecture and phased implementation design whose slices can
be implemented, tested, reviewed, and rolled back independently. It must
specify:

- a release-controller state machine, provider adapter boundary, approval
  envelope, health contract, ambiguous-outcome reconciliation, and rollback;
- a host-neutral command and artifact contract, host capability manifest,
  compatibility tiers, and conformance tests;
- optional versioned domain packs that cannot grant authority, suppress review,
  or select themselves from untrusted content;
- an append-only memory artifact layer plus disposable lexical, vector, and
  optional symbol-graph indexes with cited retrieval;
- a local Ollama plane restricted to low-authority acceleration, with explicit
  benchmark, privacy, digest, fallback, and abstention requirements;
- alternatives against incremental bolt-ons, wholesale framework adoption, and
  a local-model-first design; and
- phased acceptance and rollback criteria that never require all planes to ship
  in one change.

## Non-goals

- Replacing Codex and Opus as independent material-design reviewers.
- Letting a local model approve designs, score a gate authoritatively, select or
  suppress domain packs, deploy, roll back, publish, or execute side effects.
- Turning KStack into a general autonomous coding agent or ACP agent server.
- Copying every gstack role or adopting an unrestricted third-party pack market.
- Claiming identical enforcement on hosts without pre-tool or permission hooks.
- Authorizing implementation, model downloads, deployment, commits, pushes, or
  other external side effects in this design round.

## Success evidence

- First-time setup persists a valid user-default confidence schedule; new-repo
  initialization offers that schedule and permits an explicit repository
  override. Precedence and migration fixtures are deterministic.
- A release fixture proceeds unattended only within a digest-bound approval
  envelope and stops safely on drift, ambiguity, expiry, or a new side effect.
- One read-only release observer and one exact GitHub deployment path pass
  replay, stale-event, duplicate-event, and ambiguous-result tests before more
  provider adapters are added.
- Codex and Claude remain Tier A. OpenCode and Goose adapters must pass a shared
  core conformance suite before being advertised as supported, with gaps
  exposed in a machine-readable capability report.
- Each initial domain pack has a versioned manifest, evidence contract, prompt
  budget, authority declaration, and fixture suite. Pack selection is owned by
  the user or KStack, never inferred from external issue text.
- Memory answers cite immutable source artifacts and digests. Corrupt or stale
  indexes can be deleted and rebuilt without losing authoritative history.
- Ollama absence, timeout, malformed output, weak benchmarks, or local resource
  exhaustion falls back to deterministic/current behavior and never blocks the
  core workflow.
- Every implementation slice has independent acceptance tests and rollback
  without reverting unrelated slices.

## Current environment facts

- The repository currently targets Codex CLI and Claude Code and has ten KStack
  skills, twenty-eight orchestration scripts, and seven process references.
- Current memory uses PGlite, explicit retrieval, and manual remote sync.
- The authority matrix denies deploy by default; commit, push, and merge remain
  ask-tier.
- Ollama is not installed in active WSL. The machine has an Intel i9-14900K and
  62 GiB RAM. Windows reports an NVIDIA RTX 5070, but GPU access is unavailable
  from active WSL, so no local inference performance claim is established.

## Constraints

- Preserve the Governance Kernel as the only authority source.
- Use deterministic code for authorization, binding, transitions, validation,
  and terminal decisions. Models may advise but not decide side effects.
- Bind durable approvals and receipts to exact content, configuration, target,
  time, and cost boundaries.
- Never blindly retry an ambiguous external result.
- Never promote untrusted memory or external text into executable instruction.
- Capability-negotiate provider and host adapters and fail closed.
- Review each implementation slice independently; never redesign the full
  program in response to a defect isolated to one slice.

## Authority

This objective authorizes project-local objective and design-review artifacts
and read-only research/validation. It does not authorize implementation or any
external side effect.
