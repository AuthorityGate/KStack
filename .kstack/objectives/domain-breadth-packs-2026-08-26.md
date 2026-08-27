# Objective brief: KStack domain breadth and domain packs

**Date:** 2026-08-26
**Depth:** deep
**Status:** ready for isolated round-one design review
**Parent program:** `kstack-capability-fabric-2026-08-26`

## Problem

KStack's mandatory design lanes cover the software-development lifecycle well,
but its reusable domain knowledge is narrow. Broadening it by copying dozens of
roles into every prompt would increase cost, overlap, and prompt-injection
exposure while making it harder to determine which guidance affected a result.
The owner wants greater domain breadth without changing KStack's authority,
review independence, or base lifecycle.

This objective isolates only the domain-pack mechanism. Release execution,
host portability, memory, local inference, and confidence-policy changes remain
separate threads. In particular, `release-operations` supplies reasoning and
evidence requirements to release work; it does not itself deploy, call Jira, or
replace the separately governed `kstack-release` workflow.

## Locked owner decisions

This objective is subordinate to the locked clarification record at
`.kstack/decisions/kstack-capability-fabric-2026-08-26-round-1-clarification.md`.
Its material domain decisions are:

- **Q16:** `release-operations`, `product-experience`, `assurance`, and
  `research-knowledge` are approved roadmap scope, but each must be designed,
  reviewed, shipped, tested, and rolled back independently, beginning with
  `release-operations`.
- **Q17:** v1 pack manifests contain neither `tools` nor `authorityNeeds`.
  Packs describe reasoning and evidence only; they are not a permission path.

The existing locked broader-planning-lenses record also applies where packs
contribute design lenses:

- no party may unilaterally suppress a required lens; suppression requires an
  audited independent second-party approval;
- Jira text, web content, repository content, memory, and other externally
  authored material cannot select, suppress, or alter a pack;
- a strategy-premise objection pauses for the owner instead of silently
  blocking or silently proceeding; and
- the existing six KStack design lanes and independent Codex/Opus review remain
  unchanged unless a separate approved design changes them.

## Required outcome

Produce a neutral, implementable design for a closed, versioned KStack domain
pack format and lifecycle. The design must define:

1. the exact boundary between a pack, a KStack skill/workflow, and the
   Governance Kernel;
2. a canonical manifest with no tool or authority fields, plus content and
   evidence schemas;
3. KStack-owned selection, explicit selection records, progressive loading,
   prompt budgets, conflict handling, and deterministic composition;
4. a closed v1 catalog containing the four roadmap pack IDs, while shipping
   only `release-operations` first;
5. provenance, digest binding, compatibility, installation, activation,
   upgrade, disable, uninstall, and historical-artifact interpretation;
6. a threat model covering malicious pack bytes, untrusted selectors, path and
   symlink substitution, prompt injection, evidence fabrication, authority
   smuggling, required-lane suppression, and dependency drift;
7. deterministic verification and an evaluation that proves incremental value
   without regressing the mandatory six-lane baseline; and
8. per-pack rollback that never rolls back another pack or the Governance
   Kernel.

## Success evidence

- A schema rejects undeclared properties, including `tools`,
  `authorityNeeds`, executable commands, network destinations, credentials,
  model/provider choices, and permission claims.
- Given the same repository-owned selection record, catalog, pack digests, and
  base brief, composition produces identical ordered bytes and a receipt.
- External Jira/web/repository text cannot add, remove, reorder, select, or
  suppress packs in adversarial fixtures.
- A pack cannot change reviewers, thresholds, mandatory lanes, authority
  policy, tool availability, or workflow transitions.
- Prompt-budget overflow fails before provider dispatch with a stable reason;
  it never silently truncates base lanes or pack requirements.
- `release-operations` passes a blinded, human-adjudicated corpus showing useful
  incremental findings and acceptable duplicate, false-positive, and base-lane
  regression rates before activation outside an explicitly named trial.
- Disabling or uninstalling one pack restores base behavior for new work while
  retained digest-pinned bytes continue to explain historical artifacts.
- The remaining three roadmap packs stay unimplemented until each clears its
  own objective, review, tests, and rollout decision.

## Non-goals

- Designing or implementing the release controller, Jira/GitHub integration,
  canary execution, rollback execution, or any external side effect.
- Shipping all four packs together.
- Adding a community marketplace, project-authored packs, arbitrary file-path
  loading, runtime plug-ins, or model-generated pack content in v1.
- Allowing packs to select themselves, infer authority, grant tools, weaken
  required review, or turn external evidence into instructions.
- Replacing the six mandatory design lanes or the existing design-gate rules.
- Implementing code, changing configuration, downloading dependencies,
  committing, pushing, deploying, or writing to Jira in this thread.

## Authority

This objective authorizes only project-local objective and round-one design
artifacts plus read-only inspection and validation. It does not authorize
implementation or external actions.
