# GStack, Hermes, and OpenClaw architecture review — 2026-08-28

Status: accepted design direction; implementation remains independently gated

## Decision

KStack will adopt GStack's declarative host-profile and generated-artifact
ideas, but not its prompt-only integration boundary. Hermes and OpenClaw remain
optional qualified hosts. OpenClaw credential custody remains a separate
provider contender and is never implied by OpenClaw host installation.

## What GStack actually does

GStack treats OpenClaw as an orchestrator and methodology surface. OpenClaw
selects a Simple, Medium, Heavy, Full, or Plan tier and commonly spawns Claude
Code through ACP. GStack calls prompt text the bridge and deliberately avoids a
daemon or RPC protocol. Four conversational methods also run natively.

GStack treats Hermes through a declarative host profile: rewrite CLAUDE.md to
AGENTS.md, map tool names to Hermes tools, suppress incompatible cross-model
resolvers, and optionally retain GBrain-aware behavior. Its shared host factory
derives paths, frontmatter, generated skills, runtime assets, and installation
behavior.

Primary evidence:

- https://github.com/garrytan/gstack/blob/main/docs/OPENCLAW.md
- https://github.com/garrytan/gstack/blob/main/docs/ADDING_A_HOST.md
- https://github.com/garrytan/gstack/blob/main/hosts/openclaw.ts
- https://github.com/garrytan/gstack/blob/main/hosts/hermes.ts
- https://github.com/garrytan/gstack/blob/main/hosts/define-host.ts

## What KStack adopts

1. One typed declarative profile per host.
2. Generated host-native packages from one canonical source.
3. Minimal native conversational methods and delegated coding execution as
   distinct modes.
4. Explicit suppression of unsupported capabilities.
5. Parameterized generation, installation, update, rollback, and health tests.

## What KStack improves

1. Semantic rendering replaces literal string replacement. Canonical skills
   declare tool roles, authority class, inputs, outputs, and evidence needs;
   each renderer maps those declarations to a host profile.
2. A prompt cannot grant authority. Delegated work uses a closed immutable
   envelope bound to repository, authority snapshot, objective or plan digest,
   allowed operations, budgets, expiry, nonce, and required evidence.
3. Routing is capability and risk based, not line-count based. Complexity is a
   cost signal only. Security, mutation class, protected-value use, review
   independence, and evidence requirements determine host eligibility.
4. Environment flags are observations, never trust anchors. The host must
   return a capability attestation and the executor must produce a verifiable
   content-free receipt.
5. Native chat analysis, delegated coding execution, host memory, browser
   access, and credential custody are separate cells with separate
   qualification.
6. Unknown and ambiguous outcomes block retry until query-only reconciliation.
7. Marketplace artifacts are version pinned, digest admitted, and scanned;
   remote marketplace presence is not qualification.

## Product shape

The user experience may retain GStack's simple tier names, but selection is
derived from the KStack eligibility engine:

- Native Analysis: safe read-only domain methods on Hermes or OpenClaw.
- Delegated Plan: immutable plan envelope, no implementation authority.
- Delegated Build: exact approved mutation envelope to a qualified coding host.
- Protected Operation: target adapter executes outside the model and returns a
  content-free receipt.
- Blocked: no qualified host or provider satisfies the required contract.

## Backlog binding

- HB-TC01 owns the canonical package model, typed host profiles, and semantic
  renderer.
- HB-TC02 owns transactional host installation and rollback.
- HB-TC07 owns Hermes native and delegated-mode qualification.
- HB-TC08 owns OpenClaw native and ACP delegated-mode qualification.
- D0 owns the host-neutral analysis-pack representation and safe rendering.
- ECR-TC12 owns only the optional OpenClaw protected-value provider cell.

No item may borrow qualification evidence from another mode, host, provider,
version, platform, or target.

## Live WSL qualification correction

The 2026-08-28 source and host trial tightened this decision:

1. Hermes `v2026.7.7.2` and `v2026.8.3` are signed annotated tags, but both
   contain an unfinished `rebuild_venv` function in `hermes_cli/managed_uv.py`.
   Python compilation is not execution qualification. The newer candidate is
   rejected pending a clean pinned release and real tests.
2. OpenClaw `v2026.7.1-2` is a signed annotated tag. Its exact frozen lockfile
   passed the project's direct-pin and patch guards, and 119 focused ACP spawn
   tests passed under an isolated checksum-verified Node `24.15.0` runtime.
3. The same OpenClaw lockfile produced 46 current advisories: one critical,
   fourteen high, twenty-nine moderate, and two low. Native analysis and ACP
   execution therefore remain rejected until a clean exact release is
   requalified.
4. OpenClaw documents that its sandbox policy does not wrap ACP harness
   execution, `runtime: "acp"` cannot use `sandbox: "require"`, and disabling
   automatic ACP dispatch does not block explicit `sessions_spawn` calls.
   These claims are pinned to tag `v2026.7.1-2`, commit
   `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`, exact upstream paths, line
   locations, and SHA-256 identities in
   `.kstack/qualifications/openclaw-v2026.7.1-2-acp-boundary-citations-2026-08-30.md`.
   Consequently, host configuration cannot qualify delegated KStack work.
   Delegated OpenClaw requires a separately evidenced external sandbox,
   external launcher mediation, a non-zero time bound, and a closed operation
   set.

These are independent cell failures, not claims that either project is wholly
unsafe. KStack may keep rendering host-native analysis packages while every
execution cell remains blocked.
