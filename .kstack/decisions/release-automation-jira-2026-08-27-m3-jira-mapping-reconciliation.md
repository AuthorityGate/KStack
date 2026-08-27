# Release M3 round 4 — terminal table closure

**Item:** `M3-JIRA-MAPPING-RECONCILIATION`
**Round:** 4
**Status:** `CODEX_REVIEW_CANDIDATE`
**Mode:** concrete bug fixes only
**Review route:** Codex only; no Opus

## Exact composition

This packet composes after M3 round 1 digest
`aa412e046db3ae557dcbed09ca046b5331e2c58691e7eaf2b01e1071155a2094`,
round 2 digest
`87ded8044e450c29996388c81028c1b05d02fb56351a62b3d4d1b7b28f249f90`,
and round 3 digest
`797f6cae847562947fb41bd5bf32759a74330fec58b07f7045881f48cb14381d`.
It fixes only the three findings in round 3 review digest
`4c6733b5f99a3a6f148ecd058854c27014d64bd998509a1b55c5f90d8219907d`.

All frozen boundaries and open external items remain unchanged.

## 1. Documented no-effect client responses

Add this row to the round 3 replacement table:

| Source | Event/guard | Next | Effect |
|---|---|---|---|
| `REQUEST_IN_FLIGHT` | authenticated 400, 404, or 413 from the exact Jira endpoint **and** the target qualification fixture proves that response cannot follow an applied write | `REJECTED_NO_EFFECT` | terminal |

If endpoint identity, response authenticity, or target no-effect qualification
is absent, the same response maps to `POSSIBLY_ACTED` and requires readback.
401/403 remain `AUTH_INVALID_POSSIBLY_ACTED`. This correction makes the closed
event set total without assuming all intermediaries share Jira's semantics.

## 2. Exact 202 acceptance and linkage guard

Replace “accepted deployment item” with this exhaustive split:

| Response | Next | Confirmation rule |
|---|---|---|
| exactly one accepted tuple equal to the bound pipeline/environment/deployment key; rejected set empty; unknown issue-key set empty; unknown-association set empty | `ACCEPTED_PENDING` | keyed GET must match update sequence, canonical payload, and exact bound issue association |
| accepted tuple present but any rejected, unknown-issue, unknown-association, duplicate, or foreign tuple also appears | `POSSIBLY_ACTED` | exact readback required; missing/wrong issue association is `DRIFT`, never confirmation |
| no accepted tuple and exactly the bound tuple is rejected; unknown sets empty | `REJECTED_NO_EFFECT` | terminal |
| any other well-formed or malformed combination | `POSSIBLY_ACTED` | exact readback or ambiguous expiry |

Deployment readback confirmation always compares the issue association after
resolving it to the bound stable `issueId`; matching deployment bytes without
that association cannot confirm `JIRA_SYNCED`.

## 3. Rate-limit cap and deadline derivation

For an operation whose latest attempt is `NO_EFFECT_RATE_LIMITED`, derive:

| Guard | Operation outcome | Aggregate effect |
|---|---|---|
| attempt cap remains, retry time and sync deadline are future | `PENDING` | `JIRA_SYNC_PENDING` |
| retry time arrives before deadline and every grant/binding/dependency/revision check passes | create the next child attempt | old attempt remains terminal |
| sync deadline arrives before another attempt begins | `EXPIRED_NO_EFFECT` | required channel contributes `JIRA_SYNC_FAILED` |
| four no-effect attempts have completed | `RATE_LIMIT_EXHAUSTED_NO_EFFECT` | required channel contributes `JIRA_SYNC_FAILED` |
| any revalidation fails | corresponding drift/auth/dependency result | no new attempt |

`EXPIRED_NO_EFFECT` and `RATE_LIMIT_EXHAUSTED_NO_EFFECT` are terminal operation
outcomes and are added to aggregate priority rows 5/6 wherever round 3 names
`REJECTED` or no-effect expiry. A later repair requires a fresh owner-bound
operation; it cannot revive an attempt or reset the four-attempt cap.

## Fixtures and gate

- Each 400/404/413 is tested as qualified no-effect and unqualified possibly
  acted.
- Every accepted/rejected/unknown 202 set combination is generated; only the
  single clean accepted tuple with exact stable issue association confirms.
- Retry time before/after deadline, attempts 1-4, cap exhaustion, revalidation
  failure, crash between attempts, and attempted cap reset are exhaustive.

Closure requires Codex confidence at least 93 with zero failed checks, security
findings, material dissent, and unresolved M3 questions on the exact composed
digest. No Opus or implementation is authorized.
