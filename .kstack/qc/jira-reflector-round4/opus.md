No file tools are available in this session (`Read`, `Write`, `Bash` all disabled), so I can't create the plan file or check rounds 1–3 for rule collision. Delivering the Reflector output directly.

---

## Round 4 Rule

**NEVER let a shared setup path — config load, bootstrap, DI construction — open, read, or parse a resource that only some callers consume; validate and materialize a credential, file, handle, or connection inside the command that actually uses it, at the moment it uses it.**

**Why:** because a precondition placed in the shared path silently becomes a precondition of every caller, including the one deliberately designed to have none.

---

Two notes on scope, since they affect how this gets recorded:

- The rule is deliberately centered on the **zero-precondition invariant**, not on config loading. That generalizes past the `loadJiraState()` → `validateConfig()` → `validateCredentialFileConfig()` chain to any common path that quietly raises the floor for its narrowest caller, and it avoids colliding with any credential-specific rule an earlier round may already hold (credential handling was remediated once in c9064a5, so collision is plausible — I could not verify).
- I did **not** fold the stat-level-vs-content-level distinction into the rule. That distinction is the symptom in this instance; the defect class is the coupling itself, and hedging the rule with it would weaken it.

For recording: this belongs in a `jira-reflector-round4/` artifact alongside the existing rounds, and appended to `.kstack/reflexion-lessons.json` using whatever entry schema rounds 1–3 established — verify that schema and check for a near-duplicate prior rule before writing, since I couldn't.
