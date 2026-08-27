# Round 1 clarification: configurable design-confidence schedule

Status: LOCKED

- Thread ID: `design-confidence-schedule-2026-08-26`
- Invocation ID: `aa301ff8-aa0f-45ca-bffb-69dd759bcf3e`
- Design digest: `794652cf53163066ae4781dc8a3008971719d249b6e2f365beeb895842afac17`
- Scores: Codex 52; Opus 64; combined 52
- Result: `ROUND_ONE_CLARIFICATION_LOCKED`
- Confirmation date: 2026-08-26

## Bound sources

| Source | SHA-256 |
|---|---|
| objective | `46427c63876ab956cb2c878704b826a1bebbc23d9a0faac46397c406ab447032` |
| decision brief | `794652cf53163066ae4781dc8a3008971719d249b6e2f365beeb895842afac17` |
| Codex report | `f6ba81f64f8c640306b9e14b2efe13bd03ce5260e92260d8614346d5de8014c4` |
| Codex envelope | `a5d39aca4c4e3e87d18ffaf117df6cd4c6fe1c0ef064db6eab580c736ebf7e51` |
| Opus report | `296ea832e0aae192d68bdfb90564ff9a8a5d073c25a63c4c5e477b5ba041982c` |
| Opus envelope | `3f1338b9a06b944269f428405c9e2464453b535f95385a9400dc8758e5291d6a` |
| synthesis | `a162e32bd18a088e47721f77bb9af3d7372801c1f6938d0d5b110d2013b43fa7` |
| manifest | `75606d0637aff3671c0a5502b0836df30b5c42deda9731672929ce4f40f24df0` |

## Owner decisions

### Q1 - terminal trigger timing

- **Question:** Does `onBelow` fire immediately on first entry into its terminal
  segment, round 42 by default, independent of a longer custom budget?
- **Answer:** Yes.
- **Consequence:** A below-threshold round at terminal-segment entry returns
  `REDESIGN_OPTIONS_REQUIRED` and ends that direction. Later rounds in that
  lineage are unreachable. A qualifying score with blockers transitions to the
  separate bug-fix verification state.

### Q2 - separate bug-fix verification budget

- **Question:** Once score qualifies with blockers, do design rounds stop and a
  separate three-attempt bug-fix verification budget begin, extendable only by
  explicit user approval?
- **Answer:** Yes.
- **Consequence:** Later schedule segments cannot raise the already-selected
  numeric floor. The qualifying segment/minimum is frozen for bug-fix attempts.
  Attempts may alter only recorded blocker remediation bounds. Exhaustion
  returns `USER_DECISION_REQUIRED`; an extension is an authenticated amendment
  to the bug-fix budget only, not a schedule/thread change.

### Q3 - zero threshold

- **Question:** May overrides use 0-100, with zero requiring explicit risk
  acknowledgement because it disables only the numeric floor?
- **Answer:** Yes.
- **Consequence:** Zero is valid only when setup stores a risk-acknowledgement
  receipt bound to the schedule/repository. Approval still requires approve
  verdicts, complete quorum, exact artifacts, passed deterministic checks, zero
  security findings, zero material dissent, and no required unresolved
  questions.

## Reviewer questions resolved without new product scope

- Owner authorization for 93/81/71/63 and skill-class removal is already in the
  locked parent Capability Fabric clarification; round 2 embeds those excerpts.
- RFC 8785/JCS canonicalizes closed policy and thread records.
- Policy-subtree digests replace whole-config digests.
- The gate itself rejects over-budget and unchanged-digest dispatch.
- Stable finding digests and bounded change manifests make bug-fix scope
  inspectable; collateral tests/docs/generated outputs must be declared.
- A below-floor bug-fix candidate is rejected while the last qualified baseline
  and open ledger remain active; it cannot be repeatedly reviewed unchanged.
- In-flight v1 lineages block migration and require a superseding thread.
- Backup creation is exclusive/no-follow/unpredictable; rollback is
  compare-and-swap; post-rename durability uncertainty has a recovery state.
- User-config environment overrides require explicit init opt-in and identical
  safety checks.
- Exact Codex/Opus quorum and artifact binding remain mandatory.
- Activation receipts and compatibility version determine v1/v2 precedence.

No unresolved owner question remains. Round 2 must change only these isolated
confidence-policy defects. No implementation is authorized.
