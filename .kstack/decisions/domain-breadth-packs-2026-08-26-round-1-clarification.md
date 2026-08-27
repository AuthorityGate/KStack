# Round 1 clarification: domain breadth packs

Status: LOCKED

- Thread: `domain-breadth-packs-2026-08-26`
- Invocation: `78b4c947-1515-413f-b26a-6eecd3558bb9`
- Design digest: `fc241844ce6f1b245f127941dda2328bf7d01cbf4bf16b13c32e61d258f805fc`
- Scores: Codex 48; Opus 64; combined 48
- Result: `ROUND_ONE_CLARIFICATION_BLOCKED`

## Bound sources

| Source | SHA-256 |
|---|---|
| objective | `1701f1b26a988e6601d3fa72367f501f9a544853c9e3ff39851891c63cbe4399` |
| decision brief | `fc241844ce6f1b245f127941dda2328bf7d01cbf4bf16b13c32e61d258f805fc` |
| Codex report | `731b6fc5d479567fc5be6f640810a4eed47270c5799c5f16de5de0052c5cdbaf` |
| Codex envelope | `1259bf53599e438c5f839bffc2bc765fb242b1ef6dde2bc2935986f3d124ce05` |
| Opus report | `a7da93c4fcdf9ab8e3edf491d7c0f378f6239239e2b837926ae718783dacd4f1` |
| Opus envelope | `ff5782b8842581e2c39cc42446b77ea026fbf504f19b40c680eab6a74ddec7ca` |
| synthesis | `ed3d1c808086359e9c3a36aa75c995b1f5ec2060e9674a5ccd888b51890c6afb` |
| manifest | `83db08a8a8e77230f3a377c7a14b0ca6e7de1b84df02559445767a2a98ebb15a` |

## Extraction and scope check

The complete objective, round-one decision brief, both raw reports, both
structured envelopes, synthesis, and manifest were inspected. The synthesis
maps every failed check, security finding, dissent item, hedge, and unresolved
question to T1-T8 or Q1-Q3. The three owner questions below are the only
remaining scope or policy decisions. This record does not reopen release,
confidence, host-portability, memory, or Ollama design.

## Owner decisions

### Q1 - authenticated identity and separation of duty

- **Question:** Must pack selection, required-pack waiver/policy weakening, and
  catalog activation use authenticated out-of-band attestations while ordinary
  repository collaborators remain in the threat model?
- **Owner answer:** Yes. Pack selection, required-pack waiver or policy
  weakening, and catalog activation require authenticated out-of-band
  principals and attestations. Required-pack waivers and policy weakening also
  require approval from an independent second party. Ordinary repository
  collaborators remain inside the threat model and cannot satisfy these
  requirements through repository-controlled assertions alone.
- **Disposition:** `RESOLVED`.
- **Consequence:** D1 and D3 may specify the exact fail-closed identity,
  attestation, freshness, separation-of-duty, and verification contracts. This
  answer does not select a vendor, credential mechanism, or implementation and
  does not authorize an activation, waiver, or policy change.

### Q2 - independent evaluation and deliberate gridlock

- **Owner answer:** A tie-breaker conflicts with KStack's value. KStack thrives
  in gridlock because sustained disagreement forces adoption work and new
  designs to surface. After multiple non-converging rounds, Fable or another
  independent agent may advise additional candidate solutions, but has no
  deciding vote and cannot clear the gate.
- **Disposition:** `RESOLVED`.
- **Consequence:** production activation requires the configured independent
  reviewers to converge. Persistent disagreement remains blocked; advisory
  escalation broadens the option set instead of arbitrating a winner.

### Q3 - evidence producer ownership

- **Owner answer:** Yes. Each governed workflow produces and attests its own
  evidence descriptors; the shared pack-result validator only consumes and
  verifies them.
- **Disposition:** `RESOLVED`.
- **Consequence:** `kstack-release` owns release, Jira, health, and rollback
  receipts. Domain packs cannot fetch or self-attest that evidence and cannot
  activate before the producer contract is qualified.

## Unresolved items

- None. All round-one owner questions are resolved.

## Confirmation

The owner answered Q1 `Yes` on 2026-08-27 after receiving the full question,
recommendation, consequences, blocked scope, and `Yes`/`No`/`Comment` choices.
This record is locked for subsequent item-level design. It authorizes neither
implementation nor external mutation.
