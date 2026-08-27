# Capability Fabric review-routing amendment

Status: LOCKED

- Scope: the remaining 2026-08-26 KStack Capability Fabric design/build
- Owner directive date: 2026-08-26
- Supersedes for this scope only: dual Codex-plus-Opus dispatch on every
  improvement iteration
- Does not change: the product-level configurable confidence-schedule design,
  implementation authority, or the requirement to resolve actual defects

## Owner directive

Claude Opus is not required on every remaining improvement iteration. Codex is
the single improvement reviewer. At 84 or higher, broad improvement and score
chasing stop; only concrete bug fixes continue. Opus closure review is withheld
until Codex reaches at least 93.

Claude Opus is invoked only in either of these two cases:

1. **Stagnation diagnosis:** three consecutive completed Codex improvement
   rounds fail to exceed the highest Codex confidence previously reached for
   that item. Opus may then provide one independent advisory diagnosis. That
   diagnosis cannot close the item; work returns to Codex-only improvement, and
   another stagnation diagnosis requires three further non-improving Codex
   rounds.
2. **Closure review:** Codex reviews a frozen candidate digest and all of the
   following are true:

   - Codex confidence is at least 93.
   - Codex reports zero failed checks.
   - Codex reports zero security findings.
   - Codex reports zero material dissent.
   - Codex reports zero required unresolved questions.

Claude receives the exact Codex-qualified candidate digest, but not Codex's
report or recommendation. This preserves independent final review.

If a closure-review Claude score is below 84 or reports any failed check, security finding,
material dissent, or required unresolved question, the candidate does not pass.
Its findings are converted into individually attributable corrections and the
work returns to Codex-only improvement passes. Claude is not called again until
Codex independently qualifies a new frozen digest at 93 or higher with zero defects,
unless the separate three-round stagnation condition is reached first.

## Gridlock and advice

No third model has a deciding vote. Persistent disagreement remains gridlock.
Fable or another agent may be asked after multiple non-converging passes to
propose materially different solutions, but its output is advisory and cannot
clear a gate.

## Accounting

Every Codex and Claude invocation is counted and reported. Provider failures
remain provider attempts rather than design scores. Completed historical dual
reviews remain evidence; they are not rerun or discarded.

## Exit condition

The scoped candidate is eligible for the ordinary approval gate only when the
same frozen digest has:

- a Codex score of at least 93 with defect-free qualification; and
- a Claude score of at least 84 with defect-free independent final review.

No score compensates for a known bug. No implementation is authorized by this
record alone.
