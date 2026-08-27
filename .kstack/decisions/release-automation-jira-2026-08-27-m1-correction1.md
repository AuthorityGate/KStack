# Release Automation M1 - correction 1 safe P0 record closure

**Thread:** `release-automation-jira-2026-08-26`  
**Candidate:** Round 9, Codex-only item improvement  
**Scope:** only the final Round 8 Claude safe-record and determinism items  
**Review floor:** Codex 84 or higher with zero failed checks, zero security
findings, zero material dissent, and zero required unresolved questions for
these items  
**Status:** design delta only; no dispatch, implementation, configuration
change, human clearance, or production activation is authorized

## Decision and inheritance

Preserve the complete Round 8 correction-1 candidate except for the exact
failure-record, fixture-coverage, `O7`, and intra-row selection replacements in
this packet. Remove `attemptIntentDigest` entirely. Define `priorRecordDigest`
from prior safe record bytes only. Extend leakage assertions to every failure
fixture, make `O7` failure-qualified, and choose one offending member by a fixed
declaration order.

## Bound Round 8 artifacts

| Source | SHA-256 |
|---|---|
| Round 8 decision brief | `867e78a50a85d53069f7e257f28fedd1cd3a50bda3fbb936fb4e9f4e9b63bf58` |
| Round 8 Codex report | `442d8dd5f94ecd30735068f5946107115b90534eb925c0e8d2fd63421f56995a` |
| Round 8 Codex envelope | `c1b568dc88cc7c4195ca748a87db6be06ce127ca463413ac35ac9dad0ba610bb` |
| Round 8 Codex manifest | `118254e05b6ec8c269a2ce3cc023e895d747bf2a1f33985d231a0652e704d62d` |
| Round 8 Opus report | `c8cee41dbf11d119a83d992ca2a9c16790cbff41f8dd94aa2cae89107b9a4aad` |
| Round 8 Opus envelope | `96ae00ee07810e3d760cbdc7cbe7f0d911eb7b9603eca0017bc194031ce19b77` |
| Round 8 Opus final manifest | `3a688d1e9ffdf27bf15e8dd686bbbd11f396186f8ec1531e06137655a67bce2e` |

Round 8 Codex approved at 96 with no defects. Round 8 Opus returned revise/74
and otherwise confirmed the first-match precedence, unsupported-profile
boundary, inherited fixture-set meaning, and F1-F7/F8 distinction.

## Frozen scope

| Item | Status here |
|---|---|
| Correction 1 Round 6/7/8 mechanisms outside this safe-record delta | `PRESERVED_UNCHANGED` |
| M1 correction 2 - non-native audience-preimage trust path | `OPEN_UNCHANGED` |
| M1 correction 3 - Q1-neutral approver predicate/posture | `OPEN_UNCHANGED` |
| M1 correction 4 - preflight retrieval authorization and threat surface | `OPEN_UNCHANGED` |
| M1 correction 5 - provider-side review-comment normalization fixture | `OPEN_UNCHANGED` |
| M2, M3, M4, M5, M6, M7 | `OPEN_UNCHANGED` |
| Q1, Q2, Q3 | `OPEN_UNCHANGED` |

## Closed safe failure-record schema

For `O1` through `O7`, the canonical RFC 8785 record has exactly these fields:

```text
{
  "classification": {
    "release": "APPROVAL_NOT_DISPATCHED",
    "target": <fixed target-state enum>
  },
  "offendingMember": <fixed member-name enum>,
  "observedAt": <broker UTC timestamp>,
  "priorRecordDigest": <null or sha256: lowercase digest>,
  "reasonCode": <fixed reason-code enum>,
  "schema": "kstack-safe-p0-failure/v1"
}
```

`attemptIntentDigest` is prohibited and absent. No extension or unknown field is
accepted. Round 8's prohibitions on raw values, free-form exceptions, stack
traces, value-derived digests, protected configuration, credentials, URI
userinfo, and rejected endpoint/profile substrings remain normative.

For the genesis safe P0 failure record, `priorRecordDigest` is JSON `null`. For
every later record it is computed exactly as:

```text
priorRecordDigest = "sha256:" + LOWERHEX(
  SHA256(
    ASCII("kstack-safe-p0-prior-record/v1") || 0x00 ||
    JCS_UTF8(previous_complete_safe_P0_failure_record)
  )
)
```

The preimage is only the immediately preceding complete canonical record under
the closed safe schema above, including that prior record's own
`priorRecordDigest`. It never includes a release intent, rejected input,
enrollment value, protected-config byte, endpoint/profile value, credential,
exception, diagnostic, or digest derived from any such material. Records from
another schema or noncanonical bytes are not eligible chain inputs.

## Deterministic `offendingMember`

When multiple faults match the same first-match row, emit only the earliest
fault in this fixed protected-enrollment declaration order:

1. `PROFILE_IDENTIFIER`
2. `PERMISSION_DECLARATION`
3. `API_ORIGIN`
4. `WEB_ORIGIN`
5. `REPOSITORY_ID`
6. `REPOSITORY_OWNER`
7. `REPOSITORY_NAME`
8. `WORKFLOW_IDENTITY`
9. `CONTROL_REF`
10. `RESPONSE_PROFILE_IDENTIFIER`
11. `IDENTITY_TUPLE`
12. `P0_UNKNOWN`

The implementation evaluates all candidate faults for the already-selected row
without serializing their values, chooses the lowest ordinal, and emits that
fixed enum with the applicable fixed reason code. `P0_UNKNOWN` is used only
when no earlier member enum applies.

This intentionally accepts single-fault disclosure. The record does not list,
count, hash, or aggregate later faults. After the human corrects the disclosed
fault, only a fresh explicitly human-authorized release attempt may evaluate
configuration again; that attempt may disclose the next earliest fault. Extra
human round trips are accepted to keep protected values out of durable evidence.

## Ordered-table correction

Round 8 row `O7` is replaced verbatim by this predicate:

> Any other P0 exception or failure condition not matched by O1-O6.

Its release result remains `APPROVAL_NOT_DISPATCHED`, target state remains
`M1_TARGET_CONFIGURATION_BLOCKED`, and only a corrected condition plus explicit
human authorization may create a fresh release attempt. A fully valid input is
not an exception or failure condition, so `O7` cannot shadow `O8`. The table
still stops at the first match and `O8` remains the sole valid transition.

## Leakage and determinism fixtures

Every failure fixture `P0-F1` through `P0-F7`, including all subcases, injects
unique raw-value and credential-shaped canaries into every reachable protected
member. Each scans the complete serialized safe record, its canonical bytes,
all adjacent P0 logs, and captured diagnostics. The scan must prove:

- no injected canary or component substring appears;
- no raw enrollment, protected-config, credential, URI userinfo, endpoint, or
  profile substring appears;
- `attemptIntentDigest` is absent;
- no stored digest equals a digest of any rejected value, canary, component,
  concatenation, normalized form, or rejected-value-containing structure; and
- `priorRecordDigest` equals only the domain-separated digest of the prior
  canonical safe record, or is `null` at genesis.

This blanket now expressly covers the existing `P0-F1`, `P0-F2`, `P0-F3`,
`P0-F4`, `P0-F5`, `P0-F6`, and `P0-F7` suites. `P0-F8` remains the valid-
transition exemption from Round 8 and creates no failure record.

Required added cases:

| Fixture case | Injection | Exact assertion |
|---|---|---|
| `P0-F1-safe-record` | Fully valid documented-unsupported profile plus unique non-secret/profile canaries | Void classification persists only safe enums/time/chain value; no raw or rejected-value digest |
| `P0-F4-safe-record` | Malformed permission declaration containing unique protected canaries | Configuration-blocked record chooses `PERMISSION_DECLARATION`; all record/log scans pass |
| `P0-F6-safe-record` | Identity-tuple construction failure with unique credential-shaped and tuple-fragment canaries | Configuration-blocked record chooses `IDENTITY_TUPLE`; all record/log/digest scans pass |
| `P0-F7-safe-record` | Unclassified sentinel whose exception and diagnostic contain unique canaries | Configuration-blocked record contains only `P0_UNKNOWN` plus fixed safe fields; all scans pass |
| `P0-F3-multi-fault-same-row` | Two invalid `O4` members: `REPOSITORY_OWNER` and `WORKFLOW_IDENTITY` | One record emits only `REPOSITORY_OWNER`, the earlier declared member; the later fault is neither disclosed nor persisted |
| `P0-chain-genesis` | First safe failure | `priorRecordDigest == null` |
| `P0-chain-next` | A second safe failure following a captured canonical first record | Exact domain-separated digest matches; mutations of rejected inputs cannot affect it when the prior safe record is unchanged |

The multi-fault case also proves that correcting `REPOSITORY_OWNER` does not
resume the old attempt. Without a new explicit human authorization, the target
remains blocked. With authorization, a fresh attempt may report
`WORKFLOW_IDENTITY` as the next single fault.

## Totality, rollback, and review request

The corrected chain preimage is mechanically checkable and contains safe record
bytes only. The fixed member order makes intra-row output deterministic. The
failure-qualified `O7` cannot consume `O8`. All other correction-1 state,
qualification, and rollback rules remain inherited, including
`TARGET_FIXTURE_NOT_YET_QUALIFIED`.

If an item here fails, discard Round 9 and retain Round 8 with its findings.
This packet changes no code, configuration, workflow, GitHub/Jira state, or
review state.

Codex must review only these final safe-record refinements. Return decision,
confidence, failed checks, security findings, material dissent, and required
unresolved questions. Approval requires **84 or higher** with zero failed
checks, zero security findings, zero material dissent, and zero required
unresolved questions.

Explicitly confirm: `attemptIntentDigest` is absent; `priorRecordDigest` has the
single exact safe preimage and null genesis; F1-F7 all scan records/logs and
reject rejected-value digests; `O7` cannot shadow `O8`; multi-fault selection is
fixed; single-fault disclosure plus a fresh human-authorized attempt is
intentional; every frozen item remains unchanged; and
`TARGET_FIXTURE_NOT_YET_QUALIFIED` remains in force.

This packet requests Codex-only assessment. It does not dispatch Codex or
Claude, implement code, or authorize action outside this correction.
