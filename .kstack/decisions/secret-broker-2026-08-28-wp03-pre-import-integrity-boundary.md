# WP03 decision: pre-import intrinsic integrity is a launch-layer and TCB obligation, not a module-scope defense

**Thread:** `secret-broker-2026-08-28`
**Work package:** WP03
**Status:** non-authorizing implementation record. Records a consequence of accepted item SB-TC00; amends nothing.
**Relation to SB-TC00:** none. This record does not modify, narrow, or reinterpret
`.kstack/objectives/secret-broker-2026-08-28.md`
(SHA-256 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`) and is
deliberately excluded from `secret-broker-accepted-design-v1.json`, the release
manifest's `contractDigests`, and the item ledger's receipt rows.

## Statement

Every intrinsic capture in `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs`
and `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs`
(`APPLY`, `DEFINE_PROPERTY`, `GET_PROTOTYPE_OF`, `OWN_KEYS`, and the rest of each
file's module-scope capture block) is load-order dependent. If `Object.defineProperty`,
`Reflect.apply`, or another captured intrinsic is replaced before a file's capture
block evaluates, that file's prototype-pollution defenses are defeated. No code can
defend against tampering that precedes its own capture of the references it needs.

These files' prototype-pollution defenses therefore claim to resist **post-capture**
pollution only. That is the whole of the claim, and it is the claim WP03's review
rounds validated.

## This is not a blanket acceptance — where each pre-import vector is actually controlled

Pre-import pollution requires attacker code to execute inside the broker process
before module evaluation. Each route is controlled elsewhere in the accepted design,
and this record waives none of those controls:

1. **Altered broker source, entrypoint, or module graph.** SB-TC00 line 74 places the
   "exact broker executable/configuration" inside the qualification cell's trusted
   computing base. An altered executable is a violated TCB precondition, not a
   defended-against threat. Executable and configuration integrity remains a
   qualification obligation.
2. **Launch-environment injection** (`NODE_OPTIONS=--import=…`, `--require`, loader
   hooks, poisoned module resolution). **This record does not accept this vector as
   undefended and does not waive launch-environment sanitization.** SB-TC00 line 70
   treats ambient process state as untrusted and lines 82–86 require that a malicious
   model session create no value channel; line 49 defines the protected worker as
   "separately launched, identity-checked." The control for this vector is the launch
   and identity-check layer, not module-scope capture. Sanitizing the broker's launch
   environment remains a live obligation of the launch path and its qualification
   evidence.
3. **Substituted registered adapter.** SB-TC00 lines 82–84 require that a substituted
   adapter create no value channel; the control is version pinning and lease-bound
   adapter/executable identity at selection time. By contract an adapter is resolved at
   lease time, after control-plane initialization — stated here as a design requirement,
   not an observed load order, since no adapter and no broker entrypoint exist yet
   (`implementationState: UNAVAILABLE`). This record does not weaken that requirement.
   **If an adapter module is ever imported before `control-plane-v1.mjs` in the broker's
   evaluation order, that is an import-order fact governed by vector 1 and must be
   re-examined**, not covered by this paragraph.

The residual case — an attacker who already holds same-user code execution against the
broker process — is disclaimed by SB-TC00 line 77 ("Developer OS-local cells make no
same-user, administrator, kernel, debugger, memory-inspection, or
malicious-authorized-target resistance claim") and registered as RR01 in
`secret-broker-2026-08-28-sb-tc12-integrated-design-gate.md`.

## Scope

This record describes the **currently qualified developer OS-local cell posture only.**
It makes no statement about production cells. Per SB-TC00 lines 78–81, a production
claim requires separately executed evidence for its stronger service identity, process,
network, paging/dump, crash, and operator boundaries; nothing here pre-accepts or
forecloses any part of that evidence.

## Continuity caveat — re-check on every change to these two files

`ToPropertyDescriptor` tests for `get` and `set` with `HasProperty`, which consults
the prototype chain, not `HasOwnProperty`. An ordinary descriptor literal therefore
inherits `get`/`set` from a polluted `Object.prototype` and throws instead of
describing a data property. Before WP03 R18 that made every descriptor write in both
files throw under `Object.prototype.get` or `Object.prototype.set` pollution —
including the writes inside the error constructors themselves, so no coded broker
error could be constructed and the raw `TypeError` escaped uncoded.

Every runtime descriptor in both files is now built by a `dataDescriptor` helper on a
null-prototype object, which carries no inherited `get`/`set` for
`ToPropertyDescriptor` to reach. The class was always availability-only and never
forgeable — a descriptor carrying an inherited accessor could only make the call
throw, never silently install an attacker-controlled accessor — and it is now closed
outright rather than merely surfaced as a coded error.

As of this record the descriptor call sites are `control-plane-v1.mjs:126`, `:288`,
and `:316`, and `synthetic-protected-state-v1.mjs:84`, `:127`, `:172`, `:236`, and
`:267`. All of them route through `dataDescriptor` except
`synthetic-protected-state-v1.mjs:84`, which builds `ROOT_CREATE_OPTIONS` at module
scope, before any post-import pollution can exist, and is therefore immune by
construction under this record's own threat model.

**If a future change ever introduces a runtime descriptor literal that does not route
through `dataDescriptor`, that site reopens the availability class.** Re-verify this
property whenever either file changes.

A related conditional applies to vector 1 above, and its trigger is deliberately
wider than these two files. The window that matters is **everything that evaluates
before `control-plane-v1.mjs` in the broker's import order** — the entrypoint's
transitive import graph up to and including these two files — not merely the two
files' own imports. Today that window contains only Node builtins (`node:crypto`,
`node:fs`, `node:path`) plus the first-party sibling `./control-plane-v1.mjs`, and no
broker entrypoint exists yet (`implementationState: UNAVAILABLE`), so this condition
binds whoever writes one.

**If any module that evaluates before `control-plane-v1.mjs` ever pulls in a
third-party dependency, that dependency becomes a component whose integrity is assumed
but not enumerated by SB-TC00 line 74, and this record's vector-1 routing must be
re-examined before that change lands.** This fires even when neither file's own import
list changes — an entrypoint that imports a dependency-bearing sibling ahead of the
control plane is exactly the case the narrower wording would miss.
