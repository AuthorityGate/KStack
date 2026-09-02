# WP03 — SB-TC00 interpretation check: is the pre-import-pollution boundary a restatement or an amendment?

**Thread:** `secret-broker-2026-08-28`
**Work package:** WP03
**Date:** 2026-09-01
**Task type:** read-and-interpret only. No source, digest, ledger, or accepted-design file was modified. No test was run.

---

## 1. What SB-TC00 actually is, and verification that I read the frozen text

`plugins/kstack/secret-broker-accepted-design-v1.json` lines 7–11 bind SB-TC00 to a
whole file, not a section:

```json
{
  "itemId": "SB-TC00",
  "repoRelativePath": ".kstack/objectives/secret-broker-2026-08-28.md",
  "sha256": "9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9"
}
```

I confirmed the working-tree file is byte-identical to the accepted digest before
interpreting it:

```
9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9  .kstack/objectives/secret-broker-2026-08-28.md
```

So the text quoted below is the accepted text, not a drifted copy. The file is 255
lines; SB-TC00 is the entire objective, and the "Threat and trust boundary" section
is lines 67–90.

---

## 2. Verbatim SB-TC00 text this ruling relies on

**Threat and trust boundary — `.kstack/objectives/secret-broker-2026-08-28.md` lines 67–90:**

> ```
>  67  ## Threat and trust boundary
>  68
>  69  - Treat prompts, repository content, model-authored requests, plugin/tool
>  70    input, target responses, provider error bodies, and ambient process state as
>  71    untrusted. Schema validation and authorization happen before backend contact.
>  72  - The qualification cell's trusted computing base is explicit and bounded to
>  73    the qualified OS/runtime isolation, custody provider and authenticated
>  74    connection, exact broker executable/configuration, registered adapter, and
>  75    authorized target component that necessarily receives or uses the value.
>  76    Trust in one component does not qualify another.
>  77  - Developer OS-local cells make no same-user, administrator, kernel, debugger,
>  78    memory-inspection, or malicious-authorized-target resistance claim. A
>  79    production claim requires separately executed evidence for its stronger
>  80    service identity, process, network, paging/dump, crash, and operator
>  81    boundaries.
>  82  - A malicious prompt, repository, model session, unrelated process, wrong
>  83    principal, wrong repository/environment, stale handle generation, substituted
>  84    backend/adapter/target, output echo, or ambiguous provider outcome must not
>  85    create a value channel. Missing evidence or an unqualified boundary makes the
>  86    operation unavailable without fallback.
>  87  - Secret entry is an explicit user-to-provider or no-echo broker crossing
>  88    outside model-visible chat. A value already pasted into chat is treated as
>  89    exposed; downstream blocking and rotation guidance do not retroactively
>  90    claim containment.
> ```

**Protected worker definition — lines 49–51:**

> ```
>  49  - **Protected worker** is the separately launched, identity-checked broker
>  50    component permitted to resolve one admitted handle for one prepared attempt.
>  51    It is not a generic shell, decrypt, read, export, template, or proxy service.
> ```

**Model-facing process definition — lines 45–48:**

> ```
>  45  - **Model-facing process** includes the coding agent, conversation/UI,
>  46    model-call construction, ordinary tool invocation and results, hooks,
>  47    plugins, terminal streams, diagnostics, telemetry, and any child or file
>  48    surface that can flow back into those paths.
> ```

**Registered target adapter definition — lines 52–55:**

> ```
>  52  - **Registered target adapter** is a version-pinned implementation with a
>  53    closed request and response contract for one operation family and admitted
>  54    target identity. Provider bodies, target echoes, and arbitrary output are not
>  55    returned through the contract.
> ```

**Explicitly excluded from v1 — lines 147–148:**

> ```
> 147  - Claiming protection from a compromised kernel/administrator/debugger or an
> 148    already-authorized malicious target.
> ```

**Corroborating (not relied on as the basis, but confirms altitude) —
`.kstack/decisions/secret-broker-2026-08-28-sb-tc12-integrated-design-gate.md` line 336,
residual-risk register:**

> ```
> 336  | RR01 | Same-user/admin/kernel/debugger can inspect OS-local developer cells | Explicit nonclaim; OS-local stops at pilot/local development; no production promotion | platform owner / WP13 |
> ```

---

## 3. Ruling

**(A) — restatement, with a mandatory scoping condition on how it is written.**

The pre-import-pollution boundary is a consequence at implementation altitude of
trust assumptions SB-TC00 already states. It does not narrow, weaken, or change what
SB-TC00 promises, **provided the decision record is scoped as specified in §5 rather
than written as the blanket sentence proposed in the request.** The unscoped blanket
form would be (B). This distinction is the substance of the ruling, not a caveat on
it — see §4.3.

Recording it in a new, non-digest-bound decision record is therefore faithful, and
SB-TC00's frozen text and digest must not be touched.

---

## 4. Reasoning

### 4.1 Enumerating the pre-import vectors, then routing each to where SB-TC00 already puts the control

Pre-import pollution of `Object.defineProperty` / `Reflect.apply` requires attacker
code to execute **inside the broker process, before the module-scope capture block
runs**. There are exactly three ways in. I checked each against SB-TC00's text rather
than accepting the "already covered" framing:

**Vector 1 — modified broker source, entrypoint, or module graph.**
SB-TC00 line 74 places "exact broker executable/configuration" *inside* the trusted
computing base. An altered executable is a violated precondition of the qualification
cell, not a threat the cell defends against. Restatement.

I checked the third-party-dependency variant of this vector specifically, because
line 76 ("Trust in one component does not qualify another") warns against assuming
transitive trust, and a malicious npm dependency loaded before the broker's modules
would not obviously be covered by "exact broker executable." It collapses cleanly:
both files import only Node builtins and one first-party sibling.

- `control-plane-v1.mjs:1` — `import crypto from 'node:crypto';` (sole import)
- `synthetic-protected-state-v1.mjs:1-3` — `node:crypto`, `node:fs`, `node:path`
- `synthetic-protected-state-v1.mjs:5-19` — a named import from `./control-plane-v1.mjs`

There is no third-party package in either module's own import graph, so there is no
component here whose integrity is assumed but unenumerated by line 74. Had there
been one, I would have named it as a genuine gap.

This is a fact about the current files, not a permanent truth, and the relevant window
is actually wider than the two files: what matters is every module evaluating before
`control-plane-v1.mjs` in the broker's import order. No broker entrypoint exists yet
(`implementationState: UNAVAILABLE`), so today the two graphs are the whole window —
but an entrypoint that imports a dependency-bearing sibling ahead of the control plane
would widen it without either file's imports changing. §5's record therefore states
the re-check trigger against the evaluation window rather than against these two files.

**Vector 2 — launch-environment injection (`NODE_OPTIONS=--import=…`, `--require`,
a loader hook, a poisoned module resolution path).**
This is the most realistic vector and the one that decides the ruling's wording.
SB-TC00 line 70 says "ambient process state" is untrusted, and lines 82–84 say a
"malicious ... model session" must not create a value channel — and the launcher of
the protected worker is squarely within the model-facing process (lines 45–48).

Read naively, "pre-import pollution is accepted and undefended" would waive
launch-environment sanitization, which lines 69–71 and 82–86 require. **That reading
is (B).** It stays (A) only because the module-scope capture block was never the
control for this vector: line 49 defines the protected worker as "separately
launched, identity-checked," which places launch-environment integrity in the launch
and identity-check layer, not in the module's own intrinsic capture. Accepting that
one file cannot defend itself against code that ran before it is not the same as
accepting that nothing defends the launch. §5's record must say both halves.

For the *developer OS-local* cell specifically, the residual case — an attacker who
already has same-user code execution to set `NODE_OPTIONS` on the broker process — is
disclaimed outright by line 77 ("no same-user ... resistance claim") and registered as
RR01 in SB-TC12's residual-risk table. Restatement.

For *production* cells, line 78–81 keeps stronger process boundaries open pending
"separately executed evidence." An acceptance written without a scope qualifier would
pre-emptively close a boundary SB-TC00 deliberately leaves open. §5's record is
scoped to the current developer OS-local posture for exactly this reason.

**Vector 3 — substituted registered adapter running code before the capture.**
This is the strongest candidate for (B) and deserves the adversarial treatment,
because line 83–84 says a "substituted backend/adapter/target ... must not create a
value channel" — an affirmative defensive claim, not a disclaimer.

It resolves, but the distinction is narrow and must be written down so the record
cannot be over-read. SB-TC00's substituted-adapter threat is about *runtime
selection* of a wrong or wrong-version adapter (line 52: "version-pinned"; the
control is identity and generation pinning at lease time, per line 188's lease
binding "adapter/executable identity"). Such an adapter is resolved and invoked
*after* the control plane is initialized, so intrinsic capture is not its control and
the impossibility statement takes nothing away from it. For a substituted adapter to
instead run *before* the control-plane capture block, an attacker must have already
altered the broker's entrypoint or module graph — which is Vector 1, inside the TCB.
The two are distinguishable, and the pre-import acceptance touches only the latter.

### 4.2 The "runtime boundary vs. source-module import-time" objection

The request asked me to test whether SB-TC00's TCB language is about the *deployed
broker's runtime* trust boundary and therefore subtly different from a claim about a
*source module's import-time* defense assumptions. I do not find daylight between
them.

Line 72 scopes the TCB to "the qualification cell" — the running broker. Module
evaluation, including the module-scope capture block, executes inside that same
running broker, within the "qualified OS/runtime isolation" of line 73. Import time
is not a separate epoch outside the TCB's coverage; it is the earliest part of the
covered runtime. Everything with the ability to act during it is either the broker
executable itself (line 74, trusted), or something injected into the process by the
launch environment (Vector 2, routed above). So the import-time assumption is an
instance of the runtime trust boundary rather than a distinct claim beside it.

Separately, SB-TC00 is an *objective* document: outcome, terminology, threat
boundary, success evidence, authority. It contains no discussion of JavaScript
intrinsics, module load order, or `Object.defineProperty` — correctly, since that is
implementation altitude. A statement about what a specific `.mjs` file's capture
block can and cannot defend belongs one level below SB-TC00 and does not need to be
inside it to be consistent with it.

### 4.3 Why the scoping condition is load-bearing rather than decorative

The blanket sentence proposed in the request — "pre-import prototype pollution is an
accepted, undefended boundary" with no scope — is broader than SB-TC00 supports in
two directions: it reads as waiving launch-environment sanitization (against lines
69–71 and 82–86), and it reads as applying to production cells (against lines 78–81).
Recorded that way it would be a real amendment. Recorded as in §5 — vector-routed,
scoped to developer OS-local cells, explicitly not waiving the launch layer — it
asserts nothing SB-TC00 does not already entail. The ruling is (A) for the §5 text
specifically.

### 4.4 Verification that a new decision record does not break the machine binding

Ruling (A) is only useful if the recommended placement does not reproduce the failure
that reverted the two prior attempts. `tests/secret-broker.test.mjs:91-112` enumerates
the accepted set from the registry itself, not from the filesystem:

```js
assert.equal(accepted.registry.acceptedItems.length, 13);
for (const item of accepted.registry.acceptedItems) {
  const bytes = fs.readFileSync(path.join(repositoryRoot, item.repoRelativePath));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256, item.itemId);
}
```

It iterates the 13 listed items and digests each named path. It does not glob
`.kstack/decisions/`, so an unlisted file in that directory is invisible to it.

Lines 103–104 digest one further file beyond the 13 items — `registry.closure`, which
resolves to `.kstack/reviews/secret-broker-2026-08-28-sb-tc12-r2/codex.md`
(`2b07ca34…`), the SB-TC12 R2 closure receipt. That completes the bound set at 14
named paths. Note what is *not* in it: `secret-broker-2026-08-28-item-ledger.md` is
not digest-bound by this test, so §5's instruction to add no ledger receipt row is a
process and attribution constraint (the ledger governs item attribution per SB-TC00
lines 250–254, and a non-authorizing record must not appear there as an accepted
item), not a test-breaking one. Do not treat the absence of a test as permission.

Precedent confirms this is an established pattern rather than a loophole:
`.kstack/decisions/secret-broker-2026-08-28-delivery-status.md` already lives in that
directory and appears in **neither** `secret-broker-accepted-design-v1.json` nor the
release manifest's `contractDigests` (grep count 0 in both). The item ledger's
SB-TC12 R1 integrity-correction row established exactly this device — moving mutable
lifecycle status "to a separate non-authorizing mutable artifact" after following a
handoff had mutated frozen SB-TC00. The recommended record follows that precedent.

I did not run the test suite; this is a reading of the test source, per the task's
read-only constraint.

---

## 5. Draft decision record (paste-ready, non-digest-bound)

Suggested path: `.kstack/decisions/secret-broker-2026-08-28-wp03-pre-import-integrity-boundary.md`

This file must **not** be added to `plugins/kstack/secret-broker-accepted-design-v1.json`,
to the release manifest's `contractDigests`, or to the item ledger's receipt rows. It
is a non-authorizing implementation-altitude record in the same class as
`secret-broker-2026-08-28-delivery-status.md`.

> ---
>
> # WP03 decision: pre-import intrinsic integrity is a launch-layer and TCB obligation, not a module-scope defense
>
> **Thread:** `secret-broker-2026-08-28`
> **Work package:** WP03
> **Status:** non-authorizing implementation record. Records a consequence of accepted item SB-TC00; amends nothing.
> **Relation to SB-TC00:** none. This record does not modify, narrow, or reinterpret
> `.kstack/objectives/secret-broker-2026-08-28.md`
> (SHA-256 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`) and is
> deliberately excluded from `secret-broker-accepted-design-v1.json`, the release
> manifest's `contractDigests`, and the item ledger's receipt rows.
>
> ## Statement
>
> Every intrinsic capture in `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs`
> and `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs`
> (`APPLY`, `DEFINE_PROPERTY`, `GET_PROTOTYPE_OF`, `OWN_KEYS`, and the rest of each
> file's module-scope capture block) is load-order dependent. If `Object.defineProperty`,
> `Reflect.apply`, or another captured intrinsic is replaced before a file's capture
> block evaluates, that file's prototype-pollution defenses are defeated. No code can
> defend against tampering that precedes its own capture of the references it needs.
>
> These files' prototype-pollution defenses therefore claim to resist **post-capture**
> pollution only. That is the whole of the claim, and it is the claim WP03's review
> rounds validated.
>
> ## This is not a blanket acceptance — where each pre-import vector is actually controlled
>
> Pre-import pollution requires attacker code to execute inside the broker process
> before module evaluation. Each route is controlled elsewhere in the accepted design,
> and this record waives none of those controls:
>
> 1. **Altered broker source, entrypoint, or module graph.** SB-TC00 line 74 places the
>    "exact broker executable/configuration" inside the qualification cell's trusted
>    computing base. An altered executable is a violated TCB precondition, not a
>    defended-against threat. Executable and configuration integrity remains a
>    qualification obligation.
> 2. **Launch-environment injection** (`NODE_OPTIONS=--import=…`, `--require`, loader
>    hooks, poisoned module resolution). **This record does not accept this vector as
>    undefended and does not waive launch-environment sanitization.** SB-TC00 line 70
>    treats ambient process state as untrusted and lines 82–86 require that a malicious
>    model session create no value channel; line 49 defines the protected worker as
>    "separately launched, identity-checked." The control for this vector is the launch
>    and identity-check layer, not module-scope capture. Sanitizing the broker's launch
>    environment remains a live obligation of the launch path and its qualification
>    evidence.
> 3. **Substituted registered adapter.** SB-TC00 lines 82–84 require that a substituted
>    adapter create no value channel; the control is version pinning and lease-bound
>    adapter/executable identity at selection time. By contract an adapter is resolved at
>    lease time, after control-plane initialization — stated here as a design requirement,
>    not an observed load order, since no adapter and no broker entrypoint exist yet
>    (`implementationState: UNAVAILABLE`). This record does not weaken that requirement.
>    **If an adapter module is ever imported before `control-plane-v1.mjs` in the broker's
>    evaluation order, that is an import-order fact governed by vector 1 and must be
>    re-examined**, not covered by this paragraph.
>
> The residual case — an attacker who already holds same-user code execution against the
> broker process — is disclaimed by SB-TC00 line 77 ("Developer OS-local cells make no
> same-user, administrator, kernel, debugger, memory-inspection, or
> malicious-authorized-target resistance claim") and registered as RR01 in
> `secret-broker-2026-08-28-sb-tc12-integrated-design-gate.md`.
>
> ## Scope
>
> This record describes the **currently qualified developer OS-local cell posture only.**
> It makes no statement about production cells. Per SB-TC00 lines 78–81, a production
> claim requires separately executed evidence for its stronger service identity, process,
> network, paging/dump, crash, and operator boundaries; nothing here pre-accepts or
> forecloses any part of that evidence.
>
> ## Continuity caveat — re-check on every change to these two files
>
> `Object.prototype.get` / `Object.prototype.set` pollution makes every
> `DEFINE_PROPERTY` call in both files throw, because `ToPropertyDescriptor` tests for
> `get` and `set` with `HasProperty` (which consults the prototype chain), not
> `HasOwnProperty`. This is **availability-only and unforgeable today**, and it is
> unforgeable for one specific reason: every descriptor literal in both files supplies
> its own `value` and `writable`, so a descriptor carrying an inherited accessor is
> rejected with a `TypeError` rather than silently installing an attacker-controlled
> accessor.
>
> As of this record the descriptor call sites are `control-plane-v1.mjs:113` and `:303`,
> and `synthetic-protected-state-v1.mjs:84`, `:115`, `:224`, and `:257`; all six supply
> own `value` and `writable`.
>
> **If a future change ever introduces a descriptor literal that omits `value` or
> `writable`, this analysis stops holding and the class becomes exploitable rather than
> availability-only.** Re-verify this property whenever either file changes.
>
> A related conditional applies to vector 1 above, and its trigger is deliberately
> wider than these two files. The window that matters is **everything that evaluates
> before `control-plane-v1.mjs` in the broker's import order** — the entrypoint's
> transitive import graph up to and including these two files — not merely the two
> files' own imports. Today that window contains only Node builtins (`node:crypto`,
> `node:fs`, `node:path`) plus the first-party sibling `./control-plane-v1.mjs`, and no
> broker entrypoint exists yet (`implementationState: UNAVAILABLE`), so this condition
> binds whoever writes one.
>
> **If any module that evaluates before `control-plane-v1.mjs` ever pulls in a
> third-party dependency, that dependency becomes a component whose integrity is assumed
> but not enumerated by SB-TC00 line 74, and this record's vector-1 routing must be
> re-examined before that change lands.** This fires even when neither file's own import
> list changes — an entrypoint that imports a dependency-bearing sibling ahead of the
> control plane is exactly the case the narrower wording would miss.
>
> ---

---

## 6. Constraints observed

- SB-TC00 (`.kstack/objectives/secret-broker-2026-08-28.md`) was read only; it remains
  byte-identical to `9a239374be…`.
- `plugins/kstack/secret-broker-accepted-design-v1.json`, the release manifest's
  `contractDigests`, and `.kstack/decisions/secret-broker-2026-08-28-item-ledger.md`
  were read only and not modified.
- No decision record was created. Placement is a design-acceptance-authority call,
  consistent with the WP03 R16 reviewer's position that a reviewer should not make it;
  §5 supplies paste-ready text for whoever holds that authority.
- No test suite was run and no source file was changed.
- Nothing was committed or pushed.
