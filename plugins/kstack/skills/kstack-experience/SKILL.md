---
name: kstack-experience
description: Establish and validate a repository-wide product experience and brand contract for a user-facing application. Use for UX, UI, accessibility, visual consistency, design-system, or deployed-experience governance; it does not choose a visual style or replace user validation.
---

# KStack Product Experience

Make every user-facing change feel and behave like one product.

## Entry

1. Read `../../references/PRODUCT_EXPERIENCE.md` and the latest objective,
   approved design, `.kstack/experience.json`, and post-deploy plan.
2. Determine whether the repository has a user-facing surface. If not, record
   the owner's not-applicable decision in the design; do not create a fake
   contract. If it does, require the closed contract before implementation.
3. Adopt existing brand, token, component, content, and accessibility sources.
   When they conflict or are incomplete, relay the full decision to the owner
   instead of silently selecting a new style.
4. Apply ordinary KStack authority. This skill grants no browser mutation,
   screenshot disclosure, dependency installation, deployment, Jira mutation,
   or snapshot-update authority.

## Work

1. Define the primary user, job, product promise, brand/anti-brand traits,
   voice, critical journeys, and success/recovery states.
2. Compare meaningful alternatives for each material journey. Review and
   improve one journey or state at a time; record the selected alternative,
   rationale, hierarchy, interaction model, and recovery behavior. Preserve
   accepted items unless new evidence directly invalidates them.
3. Bind the selected experience to repository-owned tokens, components, and
   assets. Reuse them before adding literals or primitives.
4. Create executable coverage for every contract lane: critical journey,
   accessibility, responsive behavior, visual regression, brand consistency,
   content clarity, state coverage, and performance. Record explicit input
   modes, owner-approved baseline roots/approval ID, and a raw
   `kstack-performance-measurement-v1` envelope whose values match the result.
5. Validate the contract with
   `node ../../scripts/kstack-experience.mjs validate-contract --project-root . --contract .kstack/experience.json`.
   At design, implementation, and QC exit, use `phase-gate` with the matching
   `--phase` and preserve its contract/source digest as evidence.
6. Review the exact synthetic or owner-authorized screenshot/state manifest
   with Codex. Require the hard 93 threshold and zero failed/security/dissent/question
   counters. Do not send private production content by default.
7. Configure post-deploy v2 so the repository suite writes an exact
   release-bound v2 result, case evidence manifest, and performance provenance
   below `KSTACK_EXPERIENCE_RESULT_PATH`. KStack must reopen every evidence file
   and re-hash governed sources after the suite. Never reuse an earlier result,
   regenerate baselines during release, or let a visual score waive a failed
   objective lane.

## Result

- `EXPERIENCE_CONTRACT_READY`: closed contract and source manifest validate;
  implementation or release evidence is not implied.
- `EXPERIENCE_REVIEW_REQUIRED`: objective evidence passes but the exact visual
  manifest has not received a clean required review.
- `EXPERIENCE_REMEDIATION_REQUIRED`: a journey, accessibility, responsive,
  visual, brand, content, state, performance, identity, or evidence gate fails.
- `READY_FOR_USER_VALIDATION`: only the post-deploy controller may return this,
  after experience and required Jira projection pass for the exact artifact.

Report the contract/result digests, lane counts, exact failures, unrun manual
assessment, screenshot-disclosure state, Jira projection, and remaining owner
validation. Never claim an objectively universal “best possible” interface;
claim only the best demonstrated candidate under the declared users, tasks,
alternatives, and evidence.
