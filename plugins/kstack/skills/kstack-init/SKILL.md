---
name: kstack-init
description: Configure KStack for the current repository through an explicit setup conversation. Use only when the user invokes KStack initialization or when kstack-review finds no .kstack/config.json. Do not trigger implicitly for ordinary setup, configuration, review, or coding requests.
---

# KStack Init

Configure KStack without changing the host agent, global memory, or permissions.

## Procedure

1. Read `../../references/CONFIG.md` and `../../references/SAFETY.md` relative
   to this skill directory.
2. Inspect the repository read-only to discover facts that should not be asked:
   roots, languages, wrappers, CI, existing agent instructions, deployment
   scripts, and whether `.kstack/config.json` exists.
3. If a config exists, validate it with
   `node ../../scripts/kstack-config.mjs validate .kstack/config.json`. Ask
   whether to review, reconfigure, or leave it unchanged.
4. Conduct the initialization conversation in small groups of no more than
   three decisions. Explain the operational consequence of each choice.
5. Cover every category in `CONFIG.md`, including phase role selection, the
   design/interrogation/QC gates, optional explicit memory, optional Jira Cloud
   queue configuration, and the `externalTicketCreation` convention. Prefer the
   active host for init, objectives, and ordinary review; ask which one or two
   roles should design, implement, interrogate deviations, and perform QC.
   Explain that roles change responsibility and token use, never authority.
   Obtain the design review round limit (`maxRounds`) and explain that every
   material round dispatches both Codex and Opus. Track rounds, not wall-clock
   timing. Round-limit exhaustion always returns control to the user; it is not
   an automatic approval or an unbounded retry permission. Configure the design
   confidence tiers: rounds
   1-10 use `minimumConfidence`, round 11+ uses
   `minimumConfidenceRound11Plus`, and only an owner-explicit skill-class tag
   uses `minimumConfidenceSkillClass` regardless of round. Never infer that
   per-thread tag from content.
   Never infer external authority from repository capabilities or from a broad
   statement such as "full access."
6. Explain that after the first completed design round, a mandatory
   `kstack-design-clarify` session asks the human user every question derived
   from reviewer disagreement, uncertainty, unverified assumptions, and scope
   divergence, then writes a locked project-local decision record. It is not
   configurable and is distinct from `kstack-interrogate`, which classifies
   later implementation-plan drift. If persistence or edit authority prevents
   the locked record, design cannot proceed to round 2.
7. Restate the complete authority matrix and dual-model fallback behavior for
   confirmation before writing.
8. Generate the base JSON with `node ../../scripts/kstack-config.mjs template`,
   apply the confirmed answers, and write `.kstack/config.json` with the host's
   normal file-editing tool.
9. Validate the written file. Fix schema errors only; do not change a confirmed
   preference to make validation pass.
   When memory is enabled, run `kstack-memory.mjs status`. Report `empty` as an
   incomplete rollout and offer to ingest one accepted Markdown/JSON artifact;
   initialization must not describe memory as operational while both artifact
   counts are zero.
10. Summarize the active configuration and show the host-native commands:
   `$kstack-review`, `$kstack-interrogate`, and `$kstack-qc` in Codex; the same
   names with `/` in Claude Code. When memory is enabled, also show
   `$kstack-memory` and `/kstack-memory`. When Jira is enabled, show
   `$kstack-jira`/`/kstack-jira` for offline drafting and the host-side
   `kstack-jira.mjs doctor` command; initialization itself never contacts Jira.
   When citation grounding is advisory, also provision the committed
   `.kstack/fixtures/citation-grounding/exact-reproduction-v1.json` fixture and
   show the host-side `kstack-citation-admin.mjs check-platform`, `smoke`, and
   `shadow` sequence. Host invocations such as
   `kstack-init --check-citation-grounding-platform`,
   `--smoke-citation-grounding`, `--shadow-citation-grounding`,
   `--sweep-citation-grounding-staging`, and the documented repair/reset flags
   map one-for-one to that script's same-named long options. Run maintenance
   commands only when explicitly requested.

## Boundaries

- Do not edit product code during initialization.
- Do not install CLIs, authenticate providers, or test deployments.
- A missing Codex or Claude CLI is a capability result, not permission to
  substitute another model silently.
- Default memory to off unless the user explicitly enables it. If enabled,
  automatic per-turn injection remains disabled and Git synchronization remains
  manual.
- Legacy configuration without `workflow.phaseModels` remains readable, but
  Interrogation and QC require re-running initialization before they can gate a
  workflow.
