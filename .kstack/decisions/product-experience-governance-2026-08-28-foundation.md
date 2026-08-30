# Product experience governance foundation

## Decision

Select a lifecycle-wide experience contract plus an executable validation lane.
Do not bolt a generic "UX review" onto the final Playwright run.

## Why the narrower options fail

| Option | Strength | Failure |
|---|---|---|
| Extend only `kstack-post-deploy` | Fast runtime coverage | Too late to repair wrong information architecture, fragmented components, or missing product intent cheaply. |
| Add one UX reviewer prompt | Useful qualitative feedback | No persistent brand source, no cross-feature consistency, no executable gate, and easy to ignore. |
| Mandate a third-party design system | Strong defaults | Replaces product identity, harms portability, and conflicts with reuse-first adoption. |
| Snapshot every page | Detects pixels changing | A bad baseline can pass forever; rendering varies by environment; screenshots do not prove task success or accessibility. |
| **Selected: experience contract across init → design → implementation → QC → post-deploy** | Shared identity plus objective and qualitative evidence | More setup and maintenance; controlled with scoped repository defaults and explicit not-applicable paths. |

## Five evidence layers

1. **Intent:** named user, job, success outcome, critical journey, priority, and
   no-action cost.
2. **System:** product promise, brand principles, voice, semantic tokens,
   components, assets, content patterns, and exceptions.
3. **Behavior:** critical-task completion, state/recovery coverage, keyboard and
   assistive structure, responsive/input behavior, and performance budgets.
4. **Perception:** stable screenshots, approved visual diffs, and independent
   state-by-state Codex review on synthetic or authorized content.
5. **Field and owner:** real-user/telemetry evidence when available, followed by
   the owner's final in-depth validation.

No layer substitutes for another. A visually strong screen with a failed task is
blocked; a functional screen with broken hierarchy or brand drift is also
blocked when that lane is required.

## Standards boundary

- Accessibility target: WCAG 2.2 AA, with the W3C's explicit limitation that
  conformance does not meet every user need.
- Browser automation: Playwright projects/emulation, screenshot comparison,
  ARIA snapshots, and repository-pinned axe integration where supported.
- Performance: current Core Web Vitals vocabulary—LCP, INP, CLS—with field
  thresholds evaluated at the 75th percentile when genuine field data exists.
- Token portability: DTCG Format Module 2025.10, a stable Community Group
  specification rather than a W3C Recommendation.

## Release semantics

- `EXPERIENCE_CONTRACT_MISSING`: a user-facing product has no admitted shared
  experience source.
- `EXPERIENCE_REMEDIATION_REQUIRED`: one or more objective or visual lanes fail.
- `EXPERIENCE_REVIEW_REQUIRED`: objective lanes pass but the required visual
  review has not closed on the exact screenshot/state manifest.
- `JIRA_TRACKING_PENDING`: experience passed but its lifecycle projection is not
  complete.
- `READY_FOR_USER_VALIDATION`: all automated and required reviewer lanes pass;
  the user still owns final validation.

## Security boundary

Visual evidence is content. Production captures remain local by default. Model
review requires synthetic fixtures or explicit owner authorization after content
classification. Authentication secrets, cookies, storage state, tokens,
customer identifiers, private messages, and raw production data are never part
of a reviewer packet.
