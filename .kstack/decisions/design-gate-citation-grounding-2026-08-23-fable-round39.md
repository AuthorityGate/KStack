# Fable arbitration — `design-gate-citation-grounding-2026-08-23`, round 39 `CG-TIMECLIP-001` disagreement

**Status:** Complete. Manifest: `.kstack/qc/citation-grounding-fable-round39/manifest.json` (exitCode 0, duration ~183s, effort `high` — project default, not escalated).

## Why arbitration was triggered

Round 39 (rejected, combined confidence 35 — worst result in this thread's history) surfaced a genuine, unresolved factual disagreement between Codex (`revise`/35) and Opus (`approve`/84) on whether `now instanceof Date` guarantees `now.getTime()` returns an in-range integer or NaN. Combined with the severity of the confidence drop, this met the project's standing Fable-triggering criteria (real disagreement + significant confidence drop), per `feedback_fable_triggering_criteria`.

## Ruling

1. **The overridable-`getTime()` bypass is in scope.** `instanceof Date` is a prototype-chain test, not a brand check; it admits objects with overridden `getTime` (instance/subclass level) or `Symbol.hasInstance` spoofing. Given this validator sits on a security-relevant state-authentication path with no evidence restricting callers to native Date instances, the attacker-influenced-input posture applies. Same-realm `Date.prototype` poisoning is explicitly ruled out of scope (implies arbitrary code execution already).
2. **Correct fix:** remove `instanceof` entirely; extract via `Date.prototype.getTime.call(now)` in a try/catch (throws `TypeError` per ECMA-262 §21.4.4.10 `RequireInternalSlot` for anything lacking `[[DateValue]]`, unaffected by overridden `getTime`/`valueOf`, and correctly handles cross-realm Dates). Run the exact same unified check chain (finite, integer, TimeClip range) on the extracted value with no trusted branch.
3. **The brief was under-specified**, not the reviewers wrong: both were correct under different unstated implicit scopes (Opus: genuine Date instances; Codex: the full `instanceof Date`-admitting space). The fix closes the ambiguity by naming the accepted domain and extraction mechanism explicitly.
4. Also resolves Codex's separate explicit-undefined/default-parameter contradiction: `now` becomes a required parameter with no default, so omission and explicit `undefined` are identical at the callee.

Full binding directive text (the exact replacement `CG-TIMECLIP-001` rule for round 40) is in `.kstack/qc/citation-grounding-fable-round39/fable.md`.

## Scope not reopened

Key custody, HMAC, CSPRNG, successor semantics, smoke taxonomy, write ordering remain deferred per round 39's scope table. The five-way `STATE_MALFORMED` mapping and TimeClip numeric bounds are unchanged. Round 40 changes exactly two things: the Date-path extraction mechanism, and removing the default parameter.

## Binding on

Round 40 of this thread must inline the directive's exact rule text into its decision brief without further interpretation.
