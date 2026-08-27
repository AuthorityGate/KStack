# HP-TC06 round-2 repair: protected effect-choke-point completeness

**Prior packet:** `3b9c0870142b7ed26eb838e1fced2260c6895cccf1e8d1b72e76afa7bd2fc535`
**Prior result:** Codex 96 revise; 1 failed / 1 high security / 0 dissent /
0 questions; output `0b1787a3ceca1f27655710061f1c85be55660e19a5e967aef8fc68541697739e`
**Item/boundary:** HP-TC06 only; every unmodified harness, observer, isolation,
coverage, aggregation, test, and no-support clause remains frozen

## Exact defect

Joining static, documented, live, and dynamic inventories closes discovered
differences but does not prove an undiscovered dormant, generated, conditional,
dynamically loaded, or analyzer-missed effect path cannot execute. This delta
adds a protected completeness proof at the executable and OS effect boundaries.

## Protected closure object

`EffectChokePointClosureV1` binds the exact host build/platform/configuration,
executable and loaded-image closure, build/link/generated-artifact manifests,
interpreter/runtime entry registries, dynamic-loader policy, native extension/
FFI registry, executable-memory policy, protected sandbox profile, kernel effect
mediation profile, broker/credential mediation profile, effect-family registry,
coverage vectors, environment snapshot, and outcome.

Outcome is exactly `PROVEN|UNKNOWN|UNAVAILABLE|CONTRADICTORY`. Only `PROVEN`
may permit a bypass family to become `COVERED|DISABLED_PROVEN|UNREACHABLE_PROVEN`.

## Two independent completeness layers

The protected builder requires both layers:

1. **Executable closure.** Recompute the exact binary/build graph; enumerate
   every linked/embedded/generated script/module/command/tool/registration;
   monitor all executable/module/interpreter/FFI loads; deny unregistered code,
   writable-executable mappings, runtime downloads, alternate interpreters, and
   loader paths; and bind every accepted loaded digest to the inventory. Missing
   build provenance, an unobserved loader, conditional/generated artifact
   without a digest, event loss, or executable closure mismatch is `UNKNOWN`.
2. **Effect-boundary closure.** Run the subject in the qualified protected
   isolation backend where every filesystem mutation, process/exec, network,
   device, sensitive IPC, credential/approval, provider, and external-root
   effect crosses an independently observed kernel/broker boundary. Default
   policy denies every boundary not explicitly mapped to a stable effect-family
   ID and observer. A generated or undiscovered code path therefore cannot make
   an unobserved effect merely because source enumeration missed it.

The effect-family registry is a closed platform-qualified set derived from the
kernel/broker primitives available to the sandbox, not from host documentation.
An unmediated syscall/API, unsupported kernel path, native escape, observer
overflow, or effect whose family cannot be classified makes that family
`UNKNOWN`; it never disappears from the inventory.

## Conservative reachability rule

Every `UNKNOWN|UNAVAILABLE|CONTRADICTORY` family maps through a protected
conservative reachability table to all operation profiles whose inputs,
permissions, executable closure, or authority could possibly reach that effect.
All mapped profiles are incomplete and cannot aggregate `PASS`. If reachability
cannot itself be proven, the family maps to every operation profile for the
exact host build. An allowlist, passing nominal path, absent documentation, or
zero observed events cannot narrow this set.

The original four inventories remain required for semantic surface IDs and
fixture mapping, but set equality is now checked against both the executable
closure and effect-boundary event registry. A surface present only at either
protected layer is added as `UNKNOWN|BYPASS_FOUND` and blocks before evidence
signing.

## Verification repair

Negative vectors inject dormant commands, generated code, conditional feature
loads, dynamic plugins, alternate interpreters, native extensions, FFI calls,
writable-executable memory, runtime-downloaded modules, undocumented syscalls,
direct kernel effects, broker/credential bypass, and deliberate observer/event
overflow. Each must be denied or appear as an `UNKNOWN|BYPASS_FOUND` family and
block every conservatively reachable profile.

Mutation tests remove each build/load/effect registry entry, observer, loader
event, syscall family, reachability edge, and sandbox denial. Property tests
prove no executable/effect closure other than `PROVEN` permits an affected
profile to pass and unknown reachability expands rather than narrows scope.

## Review request

Review only whether this repair closes HP-TC06-F01 with a protected completeness
proof over executable/generated/dynamic code and all effect-enabling choke
points, while conservatively blocking unprovable families. Closure requires
Codex 93+ and 0 failed/security/dissent/questions.

Do not inspect other files, use tools, invoke Opus, implement, execute a host,
use credentials, perform external actions, commit, push, deploy, publish, edit
reports, or close another HP item.
