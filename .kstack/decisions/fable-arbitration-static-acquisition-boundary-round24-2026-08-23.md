# Fable arbitration ruling — static acquisition boundary saga (round 24)

## The one decision that ends the loop

The saga is not looping because round 24 hasn't yet found the tight rule. It is looping because every round is defending a claim that is **impossible to make true** — "static AST analysis structurally prevents a hostile actor from acquiring capability or generating code." Rounds 20→23 are the empirical proof: each round closed the named instances (JSON.parse → require/vm → import allowlist → ambient roots + `.constructor` name), and each fresh review found a structurally new route to the same class (getBuiltinModule → constructor-chain → descriptor-map reflection). The supply of routes is infinite — Proxy traps, tagged templates, `Symbol.toPrimitive` coercion, computed keys built from joined char arrays, prototype walks via `Object`/`Reflect`/`Object.getOwnPropertyDescriptors` — and none of it is enumerable over syntax.

**The binding ruling changes the claim, and with it the review criterion.** From round 24 forward:

- A finding of the form *"a deliberately hostile editor could bypass the lint via technique X"* is **out of scope and non-blocking.** `KSTACK-R23-CONSTRUCTOR-DESCRIPTOR` / `R23-SEC-01`, and any successor, do not block round 24 or any later round. They are acknowledged, in-scope-as-residual, consistent with the design's existing same-user disclosure residuals.
- A finding of the form *"a plausible **accidental** introduction of a forbidden call by a well-meaning contributor would slip through the lint"* remains **in scope and blocking.**

The reviewers must be directed to grade round 24 against the reframed claim below. If they keep grading against the retired claim, this loop reaches round 25 on bypass #5 regardless of what round 24 implements.

## Q1 — Is comprehensive static closure achievable against a determined adversary?

**No.** Two independent reasons; the second is decisive.

1. **Technical (undecidability).** "Obtains a callable's constructor" / "acquires a forbidden capability" is a *semantic* property of a Turing-complete language, not a syntactic one. Proving a static bound on it is the same class of problem as Rice's theorem — you cannot decide it without evaluating arbitrary expressions. JavaScript's reflective surface (descriptor maps, Proxy, computed keys from joined strings, prototype traversal via `Object`/`Reflect`) is not enumerable over syntax, so no finite AST rule set closes it. Opus's "closing the named instances rather than the class" is correct, but the deeper truth is that *the class itself is not statically characterizable.* Opus's recommendation to allowlist every free identifier and forbid `Object.getPrototypeOf`/`getOwnPropertyDescriptor(s)`/`values`/`entries` would make the scan *more sound as a lint*, but it still cannot be a security boundary (a permitted opaque helper, or any value flowing in, can carry capability).

2. **Threat-model incoherence (decisive).** The stated adversary is a single trusted local-account operator with edit authority over the very files being scanned. That actor can edit the scanner, edit its allowlist, add an unscanned helper, or simply run `node -e`. A static scan of files the adversary can edit is not a boundary against that adversary — full stop. This makes the reframe *non-negotiable*: even if reason (1) were somehow solved, the claim would still be false. The reframe is not a concession to difficulty; it is the correction of an incoherent security claim.

Note this **preserves the owner-approved round-21 allowlist mechanism** — only the *claim about what it buys* changes.

## Q2 — The right mechanism given the threat model: rule (a), with (b) ruled out for round 24

**(a) is directed.** Keep the static allowlist as a **fail-closed lint**. Reframe its documented claim, verbatim intent:

> *This scan catches accidental or careless introduction of a forbidden acquisition or code-generation call by a well-meaning contributor. It is not a security boundary: a deliberately hostile actor with edit authority in the Reflexion namespace is explicitly out of scope, consistent with the design's existing same-user residual disclosures.*

This mirrors the reasoning-effort-policy round-9 prevention→attribution reframing and the citation-grounding proportionality reasoning: the mechanism stays, its claim is corrected to what it actually delivers.

Opus's allowlist-tightening (close over *every* free identifier, `import.meta` included, fail-closed on unknowns) is **permitted as optional rigor** to make the lint more reliable and maintainable — but it is **not a security requirement** and must **not** trigger further bypass-hunting rounds. Do not spend another round chasing reflective bypasses to defend a security claim that has been retired.

**(b) runtime isolation is NOT directed for round 24.** Parsing untrusted bytes with `JSON.parse` is not code execution. Runtime isolation (`vm.Context`/worker with no `process`/`require`/global reflection) is warranted **only if the module ever evaluates corpus-derived content *as code*** — which nothing in the current design does. Named condition for future revisiting: if a later design ever executes corpus-derived content, isolate that specific operation at runtime. Under the current stated architecture (trusted local operator, no code-eval-of-data path), (b) is disproportionate.

## Q3 — EREMOTEIO: both corrections, each independently justified

I rule on both offered options because they address different facets; the request's "pick one" is satisfied by the first as the binding minimum, and my latitude covers adding the second.

1. **Move `EREMOTEIO` into `AMBIGUOUS_ENDPOINT_ERRNOS`, leaving `EUCLEAN` as the sole durable-authorizing member.** Justification stands on three legs: `EREMOTEIO` denotes remote-I/O failure, not durable corruption (unlike `EUCLEAN` = "structure needs cleaning"); it is routinely transient on 9p/virtiofs — *the design's own explicit WSL2 target* — plus CIFS/NFS and USB/device-mapper; and it is internally inconsistent to demote `EIO`/`ENODEV`/`ENXIO` under the design's own "transport/device ambiguity must not silently replace recoverable data" principle while exempting a transport errno. Both reviewers converge here.

2. **Additionally require quarantine (rename-aside) for the remaining durable path.** This stands *independently* of the errno question: R23-SEC-04 shows `EUCLEAN` itself can arise from recoverable conditions (btrfs/ext4 metadata correctable on scrub/mirror), so irreversibly overwriting the sole copy without a digest-bearing observation is the exact data-loss class the redesign exists to eliminate. The draft's rejection ("safer than adding a quarantine lifecycle") is unpersuasive — preserving prior bytes is strictly safer than destroying them.

   **Minimal spec (do not exceed):** a single rename-aside of the replaced endpoint to a fixed-suffix sibling path before installing the candidate. No lifecycle, no cleanup automation, no retention policy — operator-owned deletion. This is deliberately one rename, not a subsystem, so it does not seed the next sub-saga.

## Q4 — Diagnosis digest oracle: drop the justification, gate the digest

1. **Drop the `--expect-sha256` parity justification (mandatory).** Opus is right and the argument is unsound in the direction that matters: `--expect-sha256` *consumes* a digest the operator already possesses; diagnosis *produces* one they may not. It is a strict increase in disclosure, not parity.

2. **Gate the digest behind an explicit authority tier.** Under plain **inspect** authority, `--diagnose-current` must **not** emit `expectSha256`. Digest emission requires an explicit higher tier — an `--emit-digest` flag / repair-equivalent authority. Rationale: the tool *itself* drew an inspect/repair line; a full-snapshot content-confirmation oracle exceeds "inspect status" and is a within-tool privilege escalation for an inspect-only-authorized context (and for pasted-into-untrusted output). For the local operator with full read access this changes nothing they can't already do with `sha256sum`, so the gate is proportionate, not obstructive.

3. **The default workflow stays intact.** Plain-inspect diagnosis still emits the full expectation class (the fifteen validation classes, `missing`, etc.); only `expectSha256` moves behind `--emit-digest`. The diagnose→repair path is not broken — repair callers that need the digest request the tier explicitly.

## Everything else in the round-23 reviews

Opus raised several real, non-arbitration items — the `process` manifest gaps (`cwd`/`env`/`on`/`once` for project-root discovery and SIGINT/SIGTERM lock+temp cleanup; the `exitCode` assignment-target and `typeof`/truthiness-guard use-sites), reserving `WebAssembly` and `import.meta` as roots, the pre-existing-`.kstack` 0755/0770 migration path, and carrying the rounds-18–22 text in the packet so "no regression" is reviewable. These are **ordinary revise-round work under the reframed lint claim**, handled by the normal Codex/Opus loop. They are neither dismissed nor arbitration scope — round 24 should address them as standard revise items.

## Round-24 directive summary (binding)

1. Reframe the static-scan claim from "structurally prevents a hostile actor" to "fail-closed lint against accidental introduction"; a hostile authorized editor is out of scope. **Direct reviewers to grade against this claim** — hostile-bypass findings are non-blocking; accidental-slip findings remain blocking.
2. Keep the round-21 allowlist; the every-free-identifier tightening is optional rigor, not a security requirement; stop bypass-hunting rounds.
3. Do **not** build runtime isolation now; named future condition = corpus-derived content ever evaluated as code.
4. Move `EREMOTEIO` → `AMBIGUOUS_ENDPOINT_ERRNOS`; add minimal single rename-aside quarantine for the remaining durable (`EUCLEAN`) path.
5. Drop the parity justification for the diagnosis oracle; gate `expectSha256` behind `--emit-digest`; default inspect diagnosis keeps its expectation class.
6. Address Opus's process-manifest / WebAssembly / `import.meta` / migration / packet-completeness items as ordinary revise work.

This ruling is subject to the unchanged authority and plan-change gates.
