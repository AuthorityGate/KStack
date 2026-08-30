# KStack phase-altitude and delivery-block contract

KStack separates discovery, design, backlog realization, implementation, and
deployment so that a model cannot turn one design session into an attempted
end-to-end build specification. This contract is host-neutral. Codex, Claude
CLI, and every later host must use the same artifact shapes and transition
gates.

## Phase altitudes

1. **Objective interrogation — 50,000 feet.** Establish the problem, affected
   users, promised outcome, success evidence, constraints, authority, non-goals,
   and failure boundaries. Candidate mechanisms may be named only to clarify a
   requirement. Do not select architecture or decompose implementation here.
2. **Design loop — 10,000 feet.** Select the architecture, major responsibility
   boundaries, delivery blocks, cross-block contracts, dependency order,
   verification intent, and recovery intent. This phase must be specific enough
   to create a complete backlog and judge whether the approach can work, but it
   is deliberately not implementation-ready.
3. **Backlog realization — delivery-block level.** After owner approval of the
   10,000-foot design, materialize every design block as a distinct Jira work
   item when Jira tracking is enabled. Preserve objective/design traceability,
   dependencies, acceptance criteria, and validation evidence. The complete
   backlog must pass before implementation begins.
4. **Block refinement and implementation — ground level, one block at a time.**
   Select one dependency-ready Jira block, activate it, inspect current source,
   and only then finalize exact files, interfaces, migrations, commands, tests,
   rollback actions, and release consequences for that block. Implement,
   validate, QC, and close or explicitly block it before consuming the next
   block.
5. **Deployment — after implementation validation.** Deployment planning and
   execution use the exact validated artifact and environment. Design-level
   rollout and rollback intent does not authorize or substitute for a deployment
   runbook, deployment action, or post-deployment observation.

The approved design is not an implementation plan. The backlog is not an
implementation result. A completed implementation is not a deployment. Every
transition retains the ordinary KStack authority rules.

## Ten-thousand-foot design artifact

Every new material design begins with the exact marker
`KSTACK-DESIGN-10K-V1` and contains:

- `Altitude: 10000`
- `Implementation-ready: no`
- `Objective-brief: <repository-relative path or stable objective ID>`
- `Objective-digest: <64 lowercase hexadecimal SHA-256>`
- non-empty level-two sections named `Objective trace`, `Architecture decision`,
  `Architecture blocks`, `Cross-block contracts`, `Verification and recovery
  intent`, `Deferred to block refinement`, and `Backlog handoff`.

Each architecture block uses a level-three heading of the form
`### BLK-ID: Title` and contains one non-empty line for each of `Outcome:`,
`Boundary:`, `Depends on:`, and `Acceptance intent:`. `Depends on: none` is
valid. Otherwise it is a comma-separated list of block IDs. Dependencies must
exist and be acyclic.

The design artifact may describe deployment and rollback intent, but it must
not contain source-code fences, shell recipes, file-by-file edit lists,
migration statements, provider payloads, or step-by-step deployment
instructions. If exact detail is genuinely necessary to choose a material
architecture, record the decision and constraint at 10,000 feet and defer its
realization. Split an oversized design thread instead of using the design loop
as implementation.

Run the host-neutral preflight before any model review:

```bash
node <kstack-plugin-root>/scripts/kstack-workflow-contract.mjs design \
  --file <design.md>
```

The staged runner and final design gate repeat this validation. An invalid
artifact consumes zero provider invocations and cannot reach owner approval.

## Backlog realization artifact

Write `.kstack/backlogs/<thread-id>.json` using schema
`kstack-delivery-backlog-v1`. It contains the approved design digest and every
design block exactly once. Each backlog block contains exactly:

- `designBlockId`, `itemId`, `jiraKey`, `summary`, `dependsOn`,
  `acceptanceCriteria`, `validationEvidence`, and `state`;
- a stable KStack item ID and, when Jira is required, a confirmed Jira issue
  key for that individual block;
- dependencies identical to the approved design;
- at least one observable acceptance criterion and one required validation
  evidence item; and
- one of `ready`, `active`, `blocked`, or `done`.

At most one block may be `active`. A backlog is implementation-admissible only
when its top-level status is `ready`, every design block is represented, all
Jira mappings required by project policy are confirmed, and no block is already
active. Validate it with:

```bash
node <kstack-plugin-root>/scripts/kstack-workflow-contract.mjs backlog \
  --design <approved-design.md> --file <backlog.json> --jira-required
```

Starting a block changes the backlog status to `in-progress` and exactly that
block to `active`. Block refinement may add implementation detail to the Jira
item and block-specific implementation brief; it must not silently change the
approved 10,000-foot design. Material drift returns through
`kstack-interrogate`.

## Host parity

The canonical skills, this reference, and the workflow-contract executable are
installed from one runtime root. Host-specific prompt behavior is not evidence
of compliance. Only the shared deterministic preflight, review gate, backlog
gate, Jira evidence, and block lifecycle establish a valid transition.
