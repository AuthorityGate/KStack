# KStack skill scope

KStack is an agent-skill and plugin workflow. It improves how an authorized
agent clarifies, designs, implements, validates, reviews, and tracks work. It is
not a standalone operating system, security kernel, credential manager,
workflow engine, or multi-tenant trust service.

## Owned boundaries

KStack owns the instructions and helper behavior it ships: deterministic
artifacts, bounded parsing and rendering, safe handling of model-visible text,
no secret-value disclosure, explicit external-action authority, stable failure
codes, reproducible validation, and honest Jira/evidence status.

The host application owns process isolation, tool permissions, filesystem and
network sandboxing, credential custody, provider authentication, native atomic
operations, and protection from malicious code already executing inside the
same process. KStack may integrate with those facilities and validate their
reported availability; it must not claim to replace or independently enforce
them.

## Scope test

Before adding a requirement, implementation, test, or review finding, ask:

1. Does it change a decision or observable behavior of the KStack skill?
2. Can KStack enforce it through its own instructions or bounded helpers?
3. Is it proportionate to a skill/plugin running inside an already-authorized
   host?

If any answer is no, classify the item as host-owned, product-specific,
optional qualification, or out of scope. Record the disposition when useful,
but do not make core KStack completion depend on building external
infrastructure.

Do not convert speculative same-process attackers, hypothetical operating-
system races, exhaustive platform emulation, or production custody services
into universal skill requirements. Promote a concern into mandatory work only
when it violates an explicit KStack objective, a skill-owned safety boundary,
or observed behavior in a supported workflow.

## Review and Jira

The primary agent must reach the configured readiness threshold (93 by
default) before the independent final review is dispatched. That 93 is a
dispatch threshold only. The independent final reviewer has a separate
acceptance threshold of 81. A final `approve` or `revise` at or above 81
completes the independent-review stage.

Give every reported item an explicit disposition:

- `IN_SCOPE_BUG`: create a separate bug item with bounded acceptance evidence.
- `HOST_OR_PRODUCT_OWNED`: link it to the owning system only when that work is
  actually in the project objective.
- `OUT_OF_SCOPE`: retain the rationale; create no implementation obligation.
- `QUESTION_RESOLVED`: record the answer; create no bug.

The reviewed parent delivery block may close once its own acceptance evidence
passes and all review items have dispositions. Open `IN_SCOPE_BUG` items remain
visible and independently scheduled; they do not keep every completed parent
block indefinitely In Progress. A final `block`, a score below 81, or an
undispositioned finding still blocks the review stage.
