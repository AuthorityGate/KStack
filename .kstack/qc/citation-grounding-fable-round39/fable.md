# Fable arbitration ruling — `CG-TIMECLIP-001`, round 39

> Tooling note: this session has no file-write or plan tools available, so the plan file at `/home/lr427/.claude/plans/fable-arbitration-brief-delegated-pebble.md` could not be created. The directive is delivered inline below; round 40 should inline it directly into its decision brief.

## Rulings on the three questions

**Q1 — Is the overridable-`getTime()` bypass in scope? Yes.**
This validator sits in a security-relevant state-authentication path, and the brief supplied no evidence that only native, unmodified `Date` instances reach it. Under the stated default posture (attacker-influenced input reaches the validator), the defect is real: `instanceof Date` is a prototype-chain test, not a brand check. It admits objects with overridden `getTime` (instance or subclass level) and can itself be spoofed via `Symbol.hasInstance`. The round-39 claim "`getTime()` can only return an in-range integer or NaN" is true only for genuine `Date` objects with an unmodified method — which `instanceof` does not establish.

One boundary is explicitly **out of scope**: same-realm poisoning of `Date.prototype` itself. An attacker who can mutate `Date.prototype` already executes arbitrary code in the realm; no input validator survives that, and the design will not pretend to.

**Q2 — Correct fix: remove `instanceof` from the rule entirely; brand-check via `Date.prototype.getTime.call(now)`, then run one unified check chain on every path with no trusted branch.**
`Date.prototype.getTime` performs `RequireInternalSlot(this, [[DateValue]])` (ECMA-262 §21.4.4.10): it throws `TypeError` for anything that is not a genuine Date, regardless of prototype chain or `Symbol.hasInstance`, and it returns the true `[[DateValue]]` even when a subclass or instance has overridden `getTime`. `[[DateValue]]` is always the result of TimeClip (§21.4.1) — an integral value in range, or NaN. Even so, the extracted value is **not** trusted: it goes through the identical checks as a plain number. This also makes cross-realm `Date` objects work correctly (they would have failed `instanceof`).

Rejected alternatives, for the ledger:
- `Number(now.valueOf())` — still calls an overridable `valueOf`; same bypass.
- `Number(now)` / implicit coercion — invokes `Symbol.toPrimitive`/`valueOf`; same bypass.
- Number-only API (reject all Date-likes) — sound, but narrows the accepted domain and invites caller-compatibility findings; unnecessary given the brand check.
- Keep `instanceof` as router + brand-check inside — works, but leaves the disputed operator in the rule for no benefit.

**Q3 — Was the brief under-specified? Yes.**
Both reviewers were correct within unstated scopes: Opus for genuine `Date` objects (that claim is preserved and now made verifiable by the spec citation), Codex for the full set of objects `instanceof Date` admits. The defect was that the rule named a mechanism (`instanceof`) whose accepted domain it never defined. The text below closes that by stating the accepted domain, the extraction mechanism, the threat-model boundary, and the spec hooks.

## Binding directive — replacement `CG-TIMECLIP-001` rule text for round 40

> **CG-TIMECLIP-001 — `now` input validation for `canonicalExhaustionPredicate`**
>
> **Signature.** `canonicalExhaustionPredicate(state, now)`. The `now` parameter is **required** and has **no default value**. The prior `now = new Date()` default is removed. Consequently omitted `now` and explicitly-passed `undefined` are the same value at the callee and are handled by the same rule; no arguments-length or sentinel logic is used. Callers that relied on the default MUST pass `Date.now()` (or their injected clock's millisecond value) explicitly.
>
> **Accepted domain.** `now` is accepted if and only if it is (a) a primitive number, or (b) an object carrying a genuine `[[DateValue]]` internal slot, AND the resulting millisecond value passes the unified check chain below. No other input is accepted. `instanceof Date` is NOT used anywhere in this rule.
>
> **Step 1 — extract a candidate value `nowMs`:**
> - If `typeof now === 'number'`: `nowMs = now`.
> - Otherwise: evaluate `Date.prototype.getTime.call(now)` inside a try/catch. If it throws (it throws `TypeError` for any value lacking `[[DateValue]]` — `undefined`, `null`, strings, plain objects, prototype-chain fakes, `Symbol.hasInstance` spoofs; ECMA-262 §21.4.4.10, RequireInternalSlot), the result is `STATE_MALFORMED`. If it returns, `nowMs` is the returned value. This call reads the internal slot directly and is unaffected by any `getTime`/`valueOf`/`Symbol.toPrimitive` override on the instance or on a subclass prototype. Cross-realm `Date` objects are accepted by this step.
>
> **Step 2 — unified check chain, applied to `nowMs` on BOTH paths with no exception (there is no trusted branch):**
> - `typeof nowMs === 'number'` — else `STATE_MALFORMED`
> - `Number.isFinite(nowMs)` — else `STATE_MALFORMED` (this is where a genuine Invalid Date's NaN is rejected, preserving round-39 behavior)
> - `Number.isInteger(nowMs)` — else `STATE_MALFORMED`
> - `-8640000000000000 <= nowMs && nowMs <= 8640000000000000` (ECMA-262 §21.4.1 TimeClip bounds) — else `STATE_MALFORMED`
>
> The five-way rejection-to-`STATE_MALFORMED` mapping and the check enumeration from round 39 are retained verbatim; the checks are deliberately not deduplicated even where redundant for a genuine Date value (§21.4.1 guarantees `[[DateValue]]` is integral-in-range or NaN), because defense in depth on this path is intentional.
>
> **Threat-model scope (normative).** This rule defends against attacker-controlled or attacker-shaped `now` values, including objects designed to satisfy `instanceof Date` while returning arbitrary values from overridden methods. It does NOT defend against same-realm mutation of `Date.prototype` (including replacement of `Date.prototype.getTime`); an adversary with that capability already has arbitrary code execution in the realm, and this is explicitly out of scope for every validator in this design. The implementation MAY capture `const nativeGetTime = Date.prototype.getTime` at module load for hygiene, but this is not a security claim.

## Deferred / not reopened (unchanged from round 39's scope table)

Key custody, HMAC, CSPRNG, successor semantics, smoke taxonomy, write ordering — all remain explicitly deferred. The five-way mapping and TimeClip bounds are not reopened. Round 40 changes exactly two things: the Date-path extraction mechanism and the removed default parameter.

---

**Recap:** Ruled the Codex finding in scope (instanceof is not a brand check), Opus's claim correct only for genuine Dates and now made verifiable via spec citation, and the root defect as under-specification. The binding fix removes `instanceof`, brand-checks via `Date.prototype.getTime.call(now)` in try/catch, runs one unified check chain with no trusted branch, and makes `now` required with no default (resolving the explicit-undefined contradiction). Next: round 40 inlines the block above verbatim; the plan file could not be written in this session for lack of a write tool.
