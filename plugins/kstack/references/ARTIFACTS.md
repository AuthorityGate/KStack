# Review artifacts

Keep artifacts project-local under `.kstack/` unless persistence is disabled.
The locked round-one clarification record is the exception: it is required to
continue beyond the first design round.

```text
.kstack/
├── config.json
├── objectives/<review-id>.md
├── backlogs/<thread-id>.json
├── reviews/<review-id>/
│   ├── brief.md
│   ├── environment.md
│   ├── repository.md
│   ├── design.md
│   ├── codex.md
│   ├── opus.md
│   ├── codex.json
│   ├── opus.json
│   ├── manifest.json
│   ├── checks.json
│   ├── gate.json
│   └── synthesis.md
├── interrogations/<interrogation-id>/
│   ├── brief.md
│   ├── reviewers.md
│   └── decision.md
├── qc/<qc-id>/
│   ├── brief.md
│   ├── reviewers.md
│   ├── evidence.md
│   └── decision.md
└── decisions/
    ├── <decision-id>.md
    └── <thread-id>-round-1-clarification-<date>.md
```

Do not store secrets, raw credentials, personal data, or unnecessary source
content. Record commands and summarized results sufficient to reproduce a
finding. Mark every statement as observed, inferred, user-stated, or proposed
when that distinction affects confidence.

The raw reports are audit material. The JSON envelopes, deterministic checks,
and gate are machine inputs bound to the exact design digest. Editing the design
invalidates the complete review invocation.

A round-one clarification record is a mandatory direct-user decision artifact,
not raw model output. It records `Status: LOCKED`, the objective and design
thread, the round-one invocation and design digest, source paths and digests,
the complete source inventory and scope-alignment check, every traceable
question and user-stated answer, accepted consequences, an empty unresolved
list, and final user confirmation. Ordinary raw-output retention may be off,
but later design rounds cannot begin without this project-local record. Never
edit a locked clarification in place; a user-confirmed revision is a new linked
decision record that explicitly supersedes affected answers.

A revised design records `supersedesDesignDigest` and the implementation
evidence that required alteration. It receives a new digest, invocation,
reviewer envelopes, checks, gate, and user approval. Earlier approval remains
historical evidence only and cannot authorize the revision.

A material design uses `KSTACK-DESIGN-10K-V1` and is deliberately marked
`Implementation-ready: no`. Its bound `kstack-delivery-backlog-v1` artifact
represents every approved architecture block exactly once, records confirmed
Jira keys when required, and permits at most one active block. The backlog
enables block refinement; it does not add implementation authority.

Interrogation artifacts record the prior design digest, proposed before/after
plan wording, Git state, reviewer roles, confidence metadata, findings, and the
result. QC artifacts additionally record the final plan, tested Git state,
verification commands and observed results, risk classification, remediation
round, and completion result. They are reproducible cooperative records, not
proof of reviewer identity. Any ordinary repository drift makes a pending
Interrogation or QC result stale.

When explicit memory is enabled, accepted artifacts may be copied into the
configured external private body. The PGLite index never belongs in this tree or
in the portable body.
