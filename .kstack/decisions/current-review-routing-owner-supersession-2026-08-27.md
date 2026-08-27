# Current review-routing owner supersession — 2026-08-27

**Status:** LOCKED OWNER DIRECTIVE
**Scope:** completion of the current Host, Domain, Release/Jira, Memory without
Ollama, reuse-first, attribution, and sanitization work

## Controlling route

- OpenAI Codex is the only external reviewer for this completion scope.
- Claude Opus is not invoked, including for closure or stagnation diagnosis.
- Design closure requires Codex confidence of at least 93 and zero failed
  checks, security findings, material dissent, and unresolved questions on the
  same frozen candidate.
- At Codex confidence 84 or higher, broad redesign and score chasing stop;
  remediation is limited to concrete defects until the 93/all-zero closure is
  reached.
- Every Host Portability, Host Breadth, and reuse-first item remains isolated
  and is reviewed as a bite-size item. A score on one item cannot close another.

For this scope, this record supersedes the Claude closure and stagnation clauses
in `capability-fabric-review-routing-2026-08-26.md`. That earlier record remains
historical evidence of the route that controlled before this owner directive;
its completed reviews are preserved and are not invalidated.

## Boundaries

This routing record does not authorize implementation, host installation or
execution, credentials, external side effects, Git staging/commit/push, report
publication, deployment, or runtime/support claims. Design-only closures remain
design-only until separately authorized and qualified.
