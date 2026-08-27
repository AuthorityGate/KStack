# Round 2 clarification: configurable design-confidence schedule

Status: LOCKED

- Thread: `design-confidence-schedule-2026-08-26`
- Invocation: `4c704196-a3c7-4045-8734-5428636aed3a`
- Design digest: `640c4514a3f034dd09ef636a2304e91b3dd6e35c3fdfd27a495c16b69cf3fa7a`
- Scores: Codex 48; Opus 68; combined 48
- Result: `ROUND_TWO_CLARIFICATION_LOCKED`
- Date: 2026-08-26

## Bound sources

| Source | SHA-256 |
|---|---|
| objective | `46427c63876ab956cb2c878704b826a1bebbc23d9a0faac46397c406ab447032` |
| decision brief | `640c4514a3f034dd09ef636a2304e91b3dd6e35c3fdfd27a495c16b69cf3fa7a` |
| Codex report | `6fb6e92b3005844f02a3d94d0d144f58cb7c3b680607499441b3ec3adc3cc482` |
| Codex envelope | `f2c4b9e13e3f6dec743c29dc005dea934322ccc11ba9ce483b3adbc2ce45cedb` |
| Opus report | `a704aa0266d81829b7a51557cf3679272f29e61c465ac98fafd513d6b2cc78ab` |
| Opus envelope | `704d1e545f5b4f7d25b94b344644323559f3592c4fa0f425c5ac24500ff153b0` |
| synthesis | `6373023e7c1c010ff35d9415339fed8fdead9b3d5836ae34088ea0fdfc64765a` |
| manifest | `3a27410ddd5e75a881c1f668b07b19e185def3b284dad3dea099663d4946e935` |

## Owner decisions

### Q1 - infrastructure retry accounting

Provider/infrastructure failure may retry the exact content digest at most two
times without consuming the design round or bug-fix content attempt. Every
provider call is counted and recorded. A complete valid quorum consumes the
content unit; exhausted infrastructure retries return user decision.

### Q2 - supersession cannot become score shopping

A predecessor must be sealed or terminated and may have exactly one accepted
successor. The successor restarts at round one under its own bound policy and
inherits the predecessor's forbidden reviewed-digest set and seal reason. Its
initial design bytes must be new; byte-identical resubmission is rejected.

### Q3 - native Windows user defaults

Native Windows user-default persistence returns
`USER_DEFAULTS_UNAVAILABLE` until an independently qualified native ACL,
owner, and reparse-point verifier exists. Repository-local overrides remain
available. Linux/WSL and macOS use their separately qualified rules.

## Mandatory corrections, no accepted residuals

The owner explicitly stated that none of the review defects is acceptable.
Round three must therefore also:

- publish literal populated policy/check records and constrain exact Codex/Opus
  quorum plus every zero-blocker boolean;
- bind zero-floor risk acknowledgement into the hashed repository policy;
- define numeric qualification independently from blocker-bearing verdicts;
- use atomic leased/CAS thread state with reservation, fencing, crash recovery,
  and exact round/attempt accounting;
- canonicalize blocker identity and make merge/supersede non-resolving unless
  both reviewers explicitly resolve the source blockers;
- keep rejected-candidate findings candidate-scoped unless they independently
  prove a defect in the active baseline;
- map exact legacy 90/80/70 to the built-in schedule and reject v1 continuation
  after v2 activation;
- journal migration before rename and claim fail-closed recovery rather than
  impossible multi-file atomicity;
- refuse rollback while a v2 thread is active and concretely exclude/scan
  rollback artifacts; and
- call extension evidence an owner-confirmed authorization receipt within the
  cooperative-local model, never unsupported cryptographic authentication.

No owner question remains. Round three is limited to these corrections and may
not reopen Capability Fabric or the other four threads.
