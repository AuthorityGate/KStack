# Objective brief: KStack live post-deploy health check

**Date:** 2026-08-24 · **Depth:** deep (per `.kstack/config.json` `workflow.objectiveDepth`)
**Status:** ready for design

## Problem and affected users

KStack currently calls `./setup` successful when its installation operations
finish, but it does not then exercise the installed result through the same
runtime boundary that a loaded skill will use. File copying, symlink creation,
runtime-contract generation, and Codex marketplace registration are useful
preconditions; none alone proves that a freshly installed skill can resolve its
declared script dependencies and perform a real operation.

This gap caused a real incident on 2026-08-24. A modern Codex-plugin user
install reported success while Reflexion was silently non-functional. The
separately reviewed, currently uncommitted repair changes that branch from a
live-checkout marketplace to a native `.kstack-runtime` copy and makes the
marketplace and installed plugin point at that admitted root. The current
working-tree modifications to `setup` and `tests/setup.test.mjs` are evidence
for this design only and are not part of this thread's edit authority.

Affected users are operators running `./setup`, and downstream Codex or Claude
sessions that rely on the resulting skills. A false successful install is
particularly harmful because failure is deferred until an implementation or QC
workflow attempts Reflexion, at which point the deploy output no longer points
to the cause.

## Desired outcome and measurable evidence

Every successful `./setup` invocation performs a bounded, deterministic live
health check against each distinct installed execution root and each selected
host surface before it prints the final success message. At minimum, the check:

- invokes a lightweight Reflexion lookup by executing
  `scripts/kstack-reflexion.mjs` from the freshly installed execution root, so
  runtime-contract admission, module resolution, configuration loading, corpus
  resolution, and lookup rendering all run;
- resolves the script dependencies declared by installed KStack skills against
  the root those skills will use and executes a safe load or health operation
  for each covered dependency rather than checking only that a pathname exists;
- for a modern Codex user install, re-queries Codex's JSON marketplace and
  installed-plugin views and proves that the enabled `kstack@kstack` plugin and
  the `kstack` marketplace resolve canonically to the expected native runtime;
- distinguishes pass, failure, and not-applicable checks with stable diagnostic
  codes, does not claim interactive host activation when that cannot be tested
  deterministically, and exits according to an explicitly designed failure
  policy; and
- adds only a small, bounded cost to every setup run and never launches an LLM,
  performs network I/O, opens optional memory, or runs the full test suite.

Measurable success is a setup test matrix in which the live check passes for
Claude user, legacy Codex user, modern Codex-plugin user, Codex project, Claude
project, symlink, copy, single-host, and `--host all` paths; and in which an
incorrect marketplace root, incorrect plugin source, missing transitive script
dependency, stale/absent Reflexion contract, or execution-root mismatch makes
the health result fail with the expected stable code. A real install smoke test
must demonstrate the Reflexion no-match result through the installed script,
not through the source script by accident.

## Current behavior (observed, not assumed)

- `setup` resolves and freezes one absolute Node executable, strips
  `NODE_OPTIONS`, `NODE_PATH`, and `NODE_ICU_DATA`, and uses that runtime for
  Reflexion preparation. It verifies the runtime tuple, provisions the private
  `.codex-plugin` parent, invalidates the old contract, and runs
  `runtime-contract-generate` for each canonical execution root.
- `prepare_reflexion_root()` records roots as `admitted`, `unavailable`, or
  `hard-failed`. A contract-generation failure can deliberately become
  `unavailable` and allow installation to continue after a sentinel is
  established. This is an availability policy, not a functional lookup test.
- Symlink installs execute from `plugins/kstack`; copy installs execute from a
  host-local `<skills>/.kstack-runtime`. Copied `SKILL.md` files rewrite the
  `${CLAUDE_PLUGIN_ROOT}` placeholder to that runtime root.
- The current uncommitted modern Codex user branch creates
  `~/.codex/skills/.kstack-runtime`, copies scripts/native/vendor/node_modules,
  skills, references, manifest, and a rewritten local marketplace into it,
  prepares Reflexion there, and registers the marketplace/plugin against it.
  For `--host all --scope user` symlink mode, Claude skill links are then shared
  from that same native runtime.
- Project-scope Codex uses `<target>/.agents/skills`; project-scope Claude uses
  `<target>/.claude/skills`. User-scope legacy Codex uses `~/.codex/skills`, and
  user-scope Claude uses `~/.claude/skills` unless it shares the modern Codex
  runtime as described above.
- `install_one()` preserves a previous destination by renaming it with a
  timestamp before installing the new link or copy. `install_runtime()` does
  the same for an existing `.kstack-runtime`. Setup is therefore recoverable
  but not transactional across all skills, runtimes, and external Codex
  registration state.
- `kstack-reflexion.mjs` derives its installed root from its own real module
  path and admits the runtime contract before ordinary commands execute. Its
  `lookup` path then validates project configuration, resolves and validates
  the project corpus, performs matching, and renders an actor block. A
  read-only lookup run during this design investigation, before running setup,
  returned `KSTACK_REFLEXION_CONTRACT_ABSENT`; this is evidence that the command
  detects an unadmitted root, not evidence about any post-setup outcome.
- Installed skill instructions currently name several script entry points by
  `${CLAUDE_PLUGIN_ROOT}/scripts/...`, `../../scripts/...`, or the conceptual
  `<kstack-plugin-root>/scripts/...` form. Some entry points would launch model
  providers or mutate state if invoked with their normal command, so a live
  dependency probe must use explicitly safe import/health contracts rather than
  arbitrary example commands copied from Markdown.
- Current setup tests cover root preparation, hard-failure aggregation,
  symlink-root deduplication, modern Codex first/already-installed/stale
  marketplace flows, legacy fallback, and installed paths. They use a fake Node
  that records calls and makes runtime-contract generation fail; they do not
  execute a post-install functional lookup.
- The README explicitly warns that successful Codex marketplace validation and
  `codex plugin list` output do not prove that a fresh non-interactive session
  injected custom skills. A setup health check must not overstate that evidence.

## Constraints and non-goals

- Run on every setup invocation and remain cheap: bounded local subprocesses,
  no provider/model call, no network, no full `npm test`, and no optional PGLite
  memory initialization.
- Cover every existing host/scope/mode branch without making project scope
  depend on a pre-existing `.kstack/config.json` in the target repository.
- Use the same frozen Node and stripped Node-related environment as setup's
  Reflexion preparation. Do not let a different `node` on `PATH` create a false
  pass.
- Exercise only read-only behavior. A health check must not record Reflexion
  lessons, ingest memory, create project state, alter permissions, or repair an
  install. A self-contained temporary fixture is acceptable if it is private,
  bounded, and removed on both success and failure.
- Do not parse arbitrary shell examples from skill prose and execute them.
  Dependency coverage needs a closed, machine-readable safe-probe contract and
  a deterministic test that keeps it aligned with skill declarations.
- Preserve existing user changes and backup behavior. A nonzero health result
  must say whether installation state changed and how to recover; “failed” must
  not imply an atomic rollback unless one actually occurred.
- A modern Codex registration check may prove marketplace/plugin root
  agreement, installed/enabled flags, and manifest reachability. It cannot
  prove interactive skill injection without launching a fresh interactive host
  session, which is outside the every-setup cost and determinism budget.
- Do not change KStack's authority matrix, grant permissions, deploy anything,
  commit, push, or open a pull request as part of this design thread.
- Do not modify `setup` or `tests/setup.test.mjs` in this thread. Their current
  uncommitted diff belongs to a separate reviewed task.

## Required design decisions

The design must neutrally compare at least two viable core mechanisms and make
the following choices explicit for later owner confirmation:

1. whether the health logic is a central installed-root script called by thin
   setup adapters, inline shell probes, or a staged/transactional installer;
2. the exact safe probe contract for skill-declared scripts and how drift
   between Markdown declarations and that contract is detected;
3. when checks run and deduplicate for shared execution roots while retaining
   host-specific destination and marketplace checks;
4. whether a required health failure blocks install completion or warns and
   continues, including compatibility/rollout evidence that would justify the
   alternative;
5. rollback and recovery semantics after setup has already moved previous
   installs and possibly changed Codex marketplace state; and
6. the truthful user-visible claim: installed-runtime health versus interactive
   host activation.

## Process notes

This is Design & Architecture tier work and uses High reasoning effort for both
configured independent reviewers. Round 1 ends after the dual-review synthesis,
deterministic checks, and design-gate result. The separate coordinating session
will run the mandatory `kstack-design-clarify` gate; this thread must not run it,
start round 2, request approval, or implement the design.
