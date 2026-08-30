# Product experience and brand governance objective

## Outcome

KStack must treat product experience as a governed, repository-wide system.
Every user-facing change must inherit one explicit product promise, audience,
brand language, design-token source, component vocabulary, content voice, and
quality bar. The final automated release boundary must prove that the deployed
experience is functional, accessible, responsive, consistent, performant, and
faithful to the approved product intent before asking the user to perform deeper
validation.

## Current defect

The shipped post-deploy controller proves target identity, browser reachability,
clean Playwright execution, timing, flakiness, coverage, console/network health,
and Jira handoff. It does not independently prove:

- that the right user task was designed;
- that screens share one product identity and interaction language;
- WCAG 2.2 AA coverage beyond repository-authored assertions;
- responsive and input-modality quality across declared devices;
- approved visual-regression baselines and state coverage;
- empty, loading, error, offline, permission, and recovery experiences;
- content clarity, hierarchy, navigation, or task completion;
- that a polished-looking screen is consistent with the rest of the product.

## Required behavior

1. `kstack-init` must ask whether a repository has an existing brand/design
   system, needs one created, or explicitly has no user-facing surface.
2. A user-facing repository must have one closed, digest-bound experience
   contract. Existing design systems are adopted, not copied or replaced.
3. The contract must name primary users, jobs/outcomes, product promise,
   brand/voice traits and anti-traits, design-token source, component roots,
   approved assets, critical journeys, required UI states, viewport/input
   matrix, accessibility target, performance budgets, and review policy.
4. Portable tokens should use the stable DTCG 2025.10 exchange format when a
   compatible token source is available. KStack must not impose a visual style.
5. Design review must compare at least one meaningful alternative for every
   material user flow and explain the selected information architecture,
   hierarchy, interaction, and recovery behavior.
6. Implementation must reuse approved tokens/components before adding new
   literals or primitives. Necessary additions update the shared system first.
7. QC must exercise critical journeys plus loading, empty, success, validation,
   permission, failure, retry, offline/degraded, and destructive-confirmation
   states when applicable.
8. Automated accessibility combines WCAG 2.2 AA-oriented assertions, axe where
   the repository supports it, keyboard operation, focus order/visibility,
   accessible-name/role structure, and ARIA snapshots for critical surfaces.
   Automated results never claim complete accessibility.
9. Visual validation uses stable-environment Playwright screenshots across the
   declared viewport, color-scheme, locale, zoom, and input matrix. Baselines
   require explicit approval and cannot be silently regenerated during release.
10. Performance uses declared lab budgets and, when field data exists, reports
    LCP, INP, and CLS at the 75th percentile. Lab results never impersonate
    field evidence.
11. Codex visual review uses synthetic or approved non-sensitive states and
    reviews each state independently for hierarchy, clarity, consistency,
    density, affordance, recovery, and brand fit. Screenshots containing user
    data remain local unless the owner explicitly authorizes disclosure.
12. Post-deploy may return `READY_FOR_USER_VALIDATION` only when every required
    experience lane passes and Jira projection completes. Failures create
    bounded, category-specific work linked to the original item.

## Non-goals

- Claiming an objectively or universally "best possible" interface.
- Replacing user research, assistive-technology testing, or the user's final
  in-depth validation.
- Requiring Figma, one CSS framework, one component library, or one brand style.
- Sending production screenshots, customer data, credentials, or session state
  to a reviewer by default.
- Allowing a screenshot baseline to legitimize a poor initial design.

## Evidence standard

Objective checks are hard gates. Subjective review must cite the exact state,
viewport, task, principle, and observed problem. A score cannot erase a failed
journey, accessibility violation, missing state, visual regression, performance
budget failure, brand-contract drift, or unresolved Jira projection.
