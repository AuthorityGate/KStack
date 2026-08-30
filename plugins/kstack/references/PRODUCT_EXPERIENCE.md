# Product experience and brand governance

KStack governs a user-facing product as one experience, not a collection of
screens. The repository owns the product identity; KStack validates that every
change follows it and that the deployed result still works.

## Experience contract

User-facing repositories store a non-secret `.kstack/experience.json` using
schema `kstack-product-experience-v1`. The closed contract declares:

- the owner's `adopt-existing` or `create-shared` decision and decision ID;
- product name and promise, primary users, jobs, brand traits and anti-traits,
  content-voice principles, and information-architecture principles;
- the repository's token source, component roots, approved asset roots, and
  any owner/removal-bound local exceptions;
- critical and important journeys, their executable Playwright paths, success
  outcome, at least two considered alternatives, the selected alternative and
  rationale, hierarchy, interaction model, recovery behavior, and
  applicable loading, empty, success, validation-error, permission-denied,
  system-error, retry, offline, degraded, and destructive-confirmation states;
- the WCAG 2.2 AA target, required evidence lanes, viewport/input/theme matrix
  (explicit keyboard, mouse, touch, stylus, and screen-reader modes as
  applicable), locales, zoom levels, visual-review policy, approved baseline
  roots, baseline approval ID, and performance budgets.

Existing tokens and components are adopted. Do not copy or replace them merely
to make them fit KStack. `dtcg-2025.10` declares a compatible Design Tokens
Community Group source; `project-native` preserves another repository-owned
format. The declaration is not itself proof of DTCG conformance.

Validate the contract and its bounded, no-symlink source manifest offline:

```bash
node <kstack-plugin-root>/scripts/kstack-experience.mjs validate-contract \
  --project-root . --contract .kstack/experience.json
```

At design, implementation, and QC exit, replace `validate-contract` with
`phase-gate` and add `--phase design`, `--phase implementation`, or
`--phase qc`. Preserve the returned contract/source digests as phase evidence.

## Design and implementation

For each material journey, design at least one meaningful alternative. Review
the user job, information hierarchy, interaction cost, recovery, state matrix,
accessibility, responsive behavior, content, and brand fit. Review one journey
or state at a time; never churn an already accepted whole plan to repair one
finding.

Implementation reuses admitted tokens and components. New primitives first
become intentional additions to the shared system with their states,
accessibility behavior, and tests. A local exception must state why reuse is
unsafe or impossible and identify its owner and removal condition.

## Required evidence lanes

Every user-facing release supplies all eight lanes:

1. `critical-journey`
2. `accessibility`
3. `responsive`
4. `visual-regression`
5. `brand-consistency`
6. `content-clarity`
7. `state-coverage`
8. `performance`

Every critical journey has its own critical-task result, complete automated
accessibility check set, and responsive/visual matrix. Every required journey
state appears both as state-coverage evidence and as an independently
reviewable visual case. Performance provenance names a critical journey.

The repository's Playwright run writes a unique v2 result and same-run evidence
manifest below `KSTACK_EXPERIENCE_RESULT_PATH`. It must bind
`KSTACK_EXPERIENCE_CONTRACT_SHA256` and the exact release, deployment, commit,
and artifact environment variables supplied by KStack. Every case identifies
its journey, state, viewport, locale, zoom, check type, outcome, evidence path,
and evidence SHA-256. KStack reopens and hashes those exact files; aggregate
counts or self-declared digests are not proof. Each lane records a nonzero case
count, zero failures, and zero unresolved findings.

Accessibility automation should combine repository-pinned axe checks where
available with keyboard operation, visible and logical focus, accessible
names/roles, ARIA snapshots for critical structure, contrast, reflow, and
zoom. Automated checks do not claim complete accessibility or replace
assistive-technology and user testing.

Visual regression uses stable, reviewed execution environments. Release runs
force `--update-snapshots none`; baseline creation or replacement is a separate
owner-reviewed change recorded by the contract's `baselineApprovalId`. Approved
baseline roots are part of the governed source manifest and cannot drift during
the release run. Test declared viewports, keyboard/touch/pointer behavior,
color schemes, locales, and zoom. A screenshot proves pixels, not task success.

Performance evidence names the measured journey, `lab` or genuine `field-p75`
kind, environment, sample count, measurement window, raw-evidence path/digest,
and LCP, INP, and CLS values. KStack reopens the raw evidence and requires the
closed `kstack-performance-measurement-v1` envelope inside that file to match
the reported journey, provenance, window, and metrics exactly. Lab data never
impersonates field data.
Field-required contracts fail when only lab evidence exists.

## Visual review

Codex reviews the exact screenshot/state manifest one state at a time for
hierarchy, clarity, affordance, density, consistency, recovery, and product
fit. The manifest digest includes each case's journey, state, viewport, input
profile, locale, zoom, check type, evidence path, and evidence digest; changing
review context invalidates the review. Closure requires the hard,
non-lowerable 93 threshold, `APPROVED`, and
zero failed checks, security findings, material dissent, or unresolved
questions. A score cannot erase an objective failure.

The evidence manifest classifies visual content as `synthetic` or
`owner-authorized`; owner-authorized content requires an authorization-receipt
path and digest that KStack reopens and verifies. A `syntheticDataOnly`
contract rejects owner-authorized captures entirely. Use only non-sensitive data. Production
screenshots stay local by default. Never send customer data, identifiers,
messages, credentials, cookies, storage state, or tokens to a reviewer.

## Post-deploy and Jira

A user-facing post-deploy plan uses schema
`kstack-post-deploy-validation-plan-v2` and adds:

```json
"experience": {
  "required": true,
  "contractPath": ".kstack/experience.json"
}
```

The runtime binds the contract and result to the exact deployment, retains only
bounded receipts/digests, re-hashes the contract and governed sources after
Playwright exits, and blocks handoff on missing, stale, malformed, or
failing evidence. Objective or confidence failures return
`EXPERIENCE_REMEDIATION_REQUIRED`; a sole not-yet-approved visual review
returns `EXPERIENCE_REVIEW_REQUIRED`. Jira receives category-specific work for
journey, accessibility, responsive, visual, brand, content, state, performance,
or evidence failures. Only clean experience evidence plus required Jira
projection can return `READY_FOR_USER_VALIDATION`. The owner still performs the
final in-depth validation.

Plan v1 is legacy non-experience compatibility only. If
`.kstack/experience.json` exists, KStack rejects v1 and requires plan v2.
