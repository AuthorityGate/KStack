The plan file couldn't be written — the `Write` tool is disabled for this session, so I'm delivering the deliverable inline. It's two sentences plus a why; nothing else is pending.

## Rule

**NEVER let a safety or authorization gate arrive at its permissive branch by fall-through; compute the blocking verdict as the default and require affirmative, validated evidence to override it, so that malformed, missing, or unevaluable state lands in the blocking branch.**

**Why:** because a protective check that fails open is weakest against exactly the corrupted inputs it exists to defend against.

## Scope notes (not part of the rule)

Two adjacent findings from the same round were deliberately not made the rule:

- **The hardcoded constant** where the spec required derivation from configured values — a spec-compliance miss, weaker as a generalizable class.
- **The raw wall-clock read** the suite's injectable fake clock could not reach — the *enabler* that let the defect survive a green run, worth its own rule in a later round if it recurs, but not the lesson of this one.
