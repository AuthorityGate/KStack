# Release Automation M1 - correction 5 provider comment normalization evidence

**Thread:** `release-automation-jira-2026-08-26`  
**Candidate:** M1 correction 5, Codex-only improvement pass 1  
**Scope:** staging qualification of provider-observed deployment-review comment bytes only  
**Review routing:** at Codex 84 or higher stop broad improvement and perform
only concrete bug fixes; Opus closure is eligible only at Codex 93 or higher
with zero defects  
**Status:** design/evidence delta only; no dispatch, implementation, configuration change, or production activation is authorized

**Two separate gates:** this packet is currently reviewed only for
`DESIGN_READY`—whether the protocol, classifications, fixtures, permissions,
and lifecycle are complete and internally consistent. No staging execution is
authorized or claimed, so unchecked fixtures and an absent signed 17-run packet
are expected and are not a design-review failure. `TARGET_QUALIFIED` is a later
runtime gate requiring the completed enrolled-target packet, static inspection
result, ACL/lifecycle checks, and all matrix outcomes. Until that separately
authorized execution succeeds, status remains
`TARGET_FIXTURE_NOT_YET_QUALIFIED` regardless of design-review score.

## Decision

M1 never normalizes a deployment-review comment. It parses the bounded GitHub
response, obtains the JSON-decoded `comment` string, encodes that scalar string
as UTF-8, and compares those bytes exactly with the canonical ASCII approval
digest: `"sha256:" + 64 lowercase hexadecimal characters`.

It does not trim, case-fold, Unicode-normalize, translate line endings,
extract a substring, accept a prefix, or reserialize the value. Correction 5
adds provider-observed staging evidence for that unchanged predicate. If the
provider changes any noncanonical submitted value into the canonical byte
sequence, the enrolled target fails qualification; the comparator is not
weakened to accommodate the transformation.

## Bound validated evidence

| Source | SHA-256 |
|---|---|
| Validated correction 1 | `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523` |
| Validated correction 2 | `a217f92d67f4cdee5deb178c9855c7de9ccb243cec12890b097c81ca86783e16` |
| Validated correction 4 | `9addaaa63aaf1130b85260762a2609abf304fea4e20bd86b6cf42584fb841d2e` |
| Correction-4 final Codex report | `0045f09f99698617f60bdfce3449c60ec89579af1509f60f2ec12b7d389bb2e9` |
| Correction-4 final Codex envelope | `3341a6f97c5a8b0a3c4cba0be5b68118c83d4de28191668a8fc24870510dc502` |
| Correction-4 Codex manifest | `8705050a34068f89f0de6d74614e97bc50f33d7f4e1385cd390f9143b1ea82d6` |
| Correction-4 final Opus report | `e9a27173f1e1129a6ac1f9fe9cfe38577d7a8c3cf8d116a12bd67137e7b06070` |
| Correction-4 final Opus envelope | `9f995c7668470d5467db528a88aef88c5fcbd9aed386c53c8f420bf1aa5599e5` |
| Correction-4 Opus final manifest | `4e036839763e5dc9993a98c1a93738281f9bbea8811967eb82f795dbda12aae3` |
| Official-source M1 evidence memo | `5ddd2ce422ddead918c863a37475538db21eddf2026814cbb73db35018a9c448` |
| Review-routing amendment | `9f08fcd1f924a8c6f47864839818d97fc9ee1b71cdd6f7e9f696b97d0dcc7d0c` |

The three validated correction design digests above are preserved verbatim.
Correction 5 changes none of their protocols or accepted predicates.

## Frozen scope

| Item | Status here |
|---|---|
| M1 corrections 1, 2, and 4 | `PRESERVED_VALIDATED` |
| M1 correction 3 - Q1-neutral approver predicate/posture | `OPEN_UNCHANGED` |
| M1 correction 5 - provider comment-normalization staging evidence | `THIS_SLICE_ONLY` |
| M2, M3, M4, M5, M6, M7 | `OPEN_UNCHANGED` |
| Q1, Q2, Q3 | `OPEN_UNCHANGED` |

The fixtures use one reviewer only to isolate comment transport. They do not
select an approver-cardinality rule, establish whether one or several review
records are authoritative, or resolve Q1. Whatever correction 3 later selects,
every selected record remains subject to this exact-byte predicate.

## Exact comparison boundary

The evidence reader uses the already-bound deployment-review history operation
and the exact run, environment, and reviewer correlation inherited from M1:

1. Accept the bounded HTTPS response only from the enrolled GitHub origin with
   redirects disabled and the inherited API version.
2. Parse JSON with duplicate-member rejection, bounded depth/count/length,
   valid Unicode scalar values, and no lone UTF-16 surrogate.
3. Select a record only under inherited run/environment/reviewer rules.
   Correction 5 adds no discovery or cardinality behavior.
4. Encode the parsed `comment` scalar string once as UTF-8 and compare those
   bytes with the locally reconstructed canonical digest bytes.
5. Treat JSON escape spelling and response serialization as evidence inputs,
   never comparison inputs.

Canonical approval is exactly 71 ASCII bytes: seven bytes for `sha256:` and 64
bytes in `[0-9a-f]`. Missing, null, non-string, empty, shortened,
differently-cased, whitespace-padded, newline-bearing, Unicode-lookalike,
duplicated, or prose-bearing values fail. The authority path contains no trim,
Unicode normalization, case conversion, newline conversion, regex extraction,
or substring comparison.

## Staging evidence protocol

Each case uses a fresh workflow run with `run_attempt == 1`, one exact staging
environment, the pinned workflow SHA, the enrolled numeric repository ID, and
the same configured reviewer numeric ID. A run is never reused across cases,
and cases are not interleaved.

For each case:

1. The local harness constructs the exact intended Unicode scalar sequence,
   UTF-8 bytes, hexadecimal display, and domain-separated SHA-256.
2. A human reviewer opens the exact environment review screen and pastes the
   case value. The harness does not click, approve, submit, or invoke a write
   API.
3. Immediately before the human clicks approval, a read-only browser probe
   records the comment control's DOM string as UTF-8 hex, byte length, and
   domain-separated SHA-256. A screenshot is optional context, never byte
   evidence.
4. After the human action, the evidence reader retrieves the bound run's review
   history. It records a SHA-256 of the bounded sanitized raw response and the
   exact UTF-8 bytes of the JSON-decoded `comment` string.
5. The normal M1 predicate runs unchanged and records `ALLOW` or `DENY`.

The human verifies that pre-submit DOM bytes equal intended bytes before
clicking. There is one narrow submission exception: for C5-F07, C5-F08, or
C5-F17 only, the human may proceed when the DOM bytes differ from intended bytes
by exactly the closed CRLF/CR-to-LF mapping defined below and the mapped DOM
remains noncanonical. That submission is solely an attempt to collect one of
the three `CONTROL_NORMALIZED_*_EXCLUSION` outcomes; it can never prove byte
preservation. Every other mismatch, inability to enter a case, absent or
ambiguous review record, wrong run/environment/reviewer tuple, malformed
response, or unavailable provider response is a recorded non-pass. The human
must not click on any mismatch outside that exact three-case exception.

## Required provider-observed matrix

For each fresh case run `i`, M1 first locally reconstructs that run's exact
canonical 71-byte digest `D_i` from its bound release inputs. The harness records
`D_i` in that case's evidence and derives every test value for that run from
`D_i`; it never assumes the digest is invariant across runs. A negative-case
`DENY` therefore cannot be attributed to an unrelated run's digest.

| Case | Exact intended comment | Required outcome |
|---|---|---|
| C5-F01 | `D_i` | provider-decoded bytes equal `D_i`; M1 `ALLOW` |
| C5-F02 | empty string | provider rejects before approval, or decoded bytes remain noncanonical and M1 `DENY` |
| C5-F03 | ASCII space + `D_i` | rejected, or observed noncanonical and `DENY` |
| C5-F04 | `D_i` + ASCII space | rejected, or observed noncanonical and `DENY` |
| C5-F05 | LF + `D_i` | rejected, or observed noncanonical and `DENY` |
| C5-F06 | `D_i` + LF | rejected, or observed noncanonical and `DENY` |
| C5-F07 | `D_i` + CRLF | rejected, or observed noncanonical and `DENY` |
| C5-F08 | first 20 bytes of `D_i` + CRLF + remainder | rejected, or observed noncanonical and `DENY` |
| C5-F09 | TAB + `D_i` + TAB | rejected, or observed noncanonical and `DENY` |
| C5-F10 | U+00A0 + `D_i` + U+00A0 | rejected, or observed noncanonical and `DENY` |
| C5-F11 | U+200B + `D_i` | rejected, or observed noncanonical and `DENY` |
| C5-F12 | `sha256` + U+FF1A + the 64 hex bytes | rejected, or observed noncanonical and `DENY` |
| C5-F13 | `D_i` with one lowercase `a-f` changed to uppercase | rejected, or observed noncanonical and `DENY` |
| C5-F14 | `sha256:` plus only the first 32 hex bytes | rejected, or observed noncanonical and `DENY` |
| C5-F15 | `approved ` + `D_i` | rejected, or observed noncanonical and `DENY` |
| C5-F16 | `D_i` + LF + `D_i` | rejected, or observed noncanonical and `DENY` |
| C5-F17 | `D_i` + CR | rejected, or observed noncanonical and `DENY` |

The packet stores hexadecimal UTF-8 values rather than relying on this table's
rendering. For C5-F13 the harness chooses release inputs whose `D_i` contains at least one `a-f`
and records the changed byte offset. U+00A0, U+200B, and U+FF1A are encoded by
scalar value, not pasted from this Markdown file.

## Transformation classification and qualification gate

For every case the harness assigns exactly one first-matching classification.
When an exact correlated approval record/M1 candidate exists,
`expectedDecision` is `ALLOW` for C5-F01 and `DENY` for C5-F02..C5-F17. When an
exact `UI_REJECTED` or `PROVIDER_REJECTED` observation proves no record exists,
both expected and observed decisions are `NOT_RUN_NO_RECORD` for any case.
That representation does not make C5-F01 pass: the separate qualification gate
still requires C5-F01 to reach `PRESERVED_CANONICAL_ALLOW`.
The evidence record always stores both expected and observed decisions.

| Classification | Predicate |
|---|---|
| `TRANSFORMED_TO_CANONICAL_FAIL` | noncanonical DOM bytes become exact canonical `D_i`, regardless of decision |
| `NONCANONICAL_ALLOW_FAIL` | exact provider-decoded `PRESENT` bytes differ from `D_i` and M1 returns `ALLOW`, regardless of case |
| `CONTROL_NORMALIZED_SAFE_EXCLUSION` | only C5-F07/F08/F17: DOM bytes equal the exact closed CRLF/CR-to-LF mapping of intended bytes, DOM remains noncanonical, and the provider returns noncanonical `PRESENT` bytes with M1 `DENY` |
| `CONTROL_NORMALIZED_UI_REJECTED_EXCLUSION` | only C5-F07/F08/F17: the same exact safe mapping holds, the UI explicitly rejects/disables submission of the mapped DOM value, no submit event or approval record exists, and bounded rejection evidence is retained |
| `CONTROL_NORMALIZED_PROVIDER_REJECTED_EXCLUSION` | only C5-F07/F08/F17: the same exact safe mapping holds, the provider returns an explicit rejection for the exact submission, no approval record exists after the fixed observation window, and bounded rejection evidence is retained |
| `INTENDED_DOM_MISMATCH_FAIL` | recorded intended bytes differ from immediate pre-submit DOM bytes and the exact safe-exclusion predicate above does not match |
| `PREDICATE_MISMATCH_FAIL` | record/bytes are unambiguous and `observedDecision != expectedDecision` |
| `PRESERVED_CANONICAL_ALLOW` | C5-F01 intended bytes equal DOM bytes equal provider-decoded canonical `D_i`, and M1 allows |
| `PRESERVED_NONCANONICAL_DENIAL` | a negative case has intended bytes equal DOM bytes equal provider-decoded `PRESENT` noncanonical bytes, and M1 denies |
| `UI_REJECTED` | intended bytes equal recorded DOM bytes, the human cannot submit that exact DOM value, and no approval record exists |
| `PROVIDER_REJECTED` | DOM equals intended, submission is rejected, and no approval record exists |
| `TRANSFORMED_SAFE_DENIAL` | provider-decoded `PRESENT` bytes differ from DOM bytes, remain noncanonical, and M1 denies |
| `PROVIDER_VALUE_ABSENT_SAFE_DENIAL` | an exact correlated approval record exists, its `comment` member is missing or null, and M1 denies without substituting bytes |
| `CORRELATION_OR_EVIDENCE_FAIL` | the exact record/bytes cannot be proven without ambiguity |

The target passes correction 5 only if C5-F01 is
`PRESERVED_CANONICAL_ALLOW`. Every C5-F02..C5-F17 case must be either
`PRESERVED_NONCANONICAL_DENIAL`, `TRANSFORMED_SAFE_DENIAL`, or
`PROVIDER_VALUE_ABSENT_SAFE_DENIAL` with observed M1 `DENY`; or
`UI_REJECTED`/`PROVIDER_REJECTED` with no approval record and therefore no M1
candidate. C5-F07/F08/F17 may instead be one of the three exact
`CONTROL_NORMALIZED_*_EXCLUSION` classifications; it is recorded as excluded,
never as preservation, and does not satisfy C5-F01 or any other case. The closed mapping
replaces each CRLF pair with one LF and then each remaining CR with one LF,
with every other byte unchanged. The UI/provider-rejection arms require an
explicit rejection event and a fixed 300-second exact-record observation;
unavailable, delayed, or ambiguous absence is
`CORRELATION_OR_EVIDENCE_FAIL`. If the mapped DOM becomes canonical, differs in
any other way, or later yields `ALLOW`, an earlier failing row wins.
`PROVIDER_VALUE_ABSENT_SAFE_DENIAL` is an allowed outcome for C5-F02
and any other negative case only when the run/environment/reviewer record is
otherwise uniquely and exactly correlated. Any intended/DOM mismatch outside
the exact three-case safe exclusion is `INTENDED_DOM_MISMATCH_FAIL`. A
`INTENDED_DOM_MISMATCH_FAIL`, `TRANSFORMED_TO_CANONICAL_FAIL`, `NONCANONICAL_ALLOW_FAIL`,
`PREDICATE_MISMATCH_FAIL`, or
`CORRELATION_OR_EVIDENCE_FAIL` result fails
qualification. A provider transform from one noncanonical value to another is
safe only because the unchanged exact comparator denies it; the transform is
still recorded.

Until the full matrix passes on the enrolled staging target, production remains
`TARGET_FIXTURE_NOT_YET_QUALIFIED`. Unit, mocked, replayed, or locally generated
responses cannot satisfy this provider-observed gate.

## Evidence record

Each case writes one bounded canonical `CommentTransportEvidenceV1` record:

```text
{
  protocol, caseId,
  target: {
    providerProduct, apiVersion, plan, repositoryVisibility,
    repositoryId, environmentId, environmentNameDigest,
    workflowSha, browserProbeVersion
  },
  runId, runAttempt: 1, reviewerId,
  reconstructedCanonicalUtf8Hex, reconstructedCanonicalDigest,
  fixtureChangedByteOffsetOrNull,
  intendedUtf8Hex, intendedByteLength, intendedDigest,
  domUtf8Hex, domByteLength, domDigest,
  commentObservation,
  rejectionEvidenceDigest-or-null,
  sanitizedRawResponseDigestOrNull,
  classification, expectedDecision, observedDecision,
  observedAt, priorRecordDigest
}
```

`fixtureChangedByteOffsetOrNull` is the zero-based byte offset changed from
`D_i` for C5-F13 and is null for every other case. The verifier recomputes that
offset by byte-comparing `intendedUtf8Hex` with
`reconstructedCanonicalUtf8Hex`; a missing, non-unique, or inconsistent offset
invalidates C5-F13.

`commentObservation` is exactly one closed canonical union arm:

```text
{ kind: "PRESENT", utf8Hex, byteLength, digest }
{ kind: "ABSENT", reason }
{ kind: "FAILURE", reason }
```

For `ABSENT`, `reason` is exactly `COMMENT_MEMBER_MISSING`, `COMMENT_MEMBER_NULL`,
`NO_APPROVAL_RECORD_UI_REJECTED`, or
`NO_APPROVAL_RECORD_PROVIDER_REJECTED`. `PRESENT` forbids `reason`; `ABSENT`
forbids byte fields. Missing/null require an otherwise exact correlated approval
record. No-record reasons require either the corresponding ordinary rejection
classification or its exact `CONTROL_NORMALIZED_*_REJECTED_EXCLUSION` variant,
plus `rejectionEvidenceDigest` and the fixed observation-window evidence. The union is serialized with RFC 8785 JCS; no empty-string
substitution or implementation-defined sentinel is permitted.

For `FAILURE`, `reason` is exactly `RESPONSE_UNAVAILABLE`,
`RESPONSE_MALFORMED`, `COMMENT_MEMBER_INVALID_TYPE`,
`CORRELATION_NONE_UNEXPLAINED`, `CORRELATION_MULTIPLE`, or
`CORRELATION_TUPLE_MISMATCH`. `FAILURE` forbids byte fields and is valid only
with classification `CORRELATION_OR_EVIDENCE_FAIL`. It can never satisfy any
matrix row or qualification gate. `sanitizedRawResponseDigestOrNull` is the
digest of a received bounded sanitized response; it is null only when no
response bytes were received. A null response digest with any reason other than
`RESPONSE_UNAVAILABLE`, or a non-null digest when no bytes were received,
invalidates the record.

`expectedDecision` and `observedDecision` each use the closed enum
`ALLOW | DENY | NOT_RUN_NO_RECORD | NOT_RUN_EVIDENCE_FAILURE`.
`NOT_RUN_NO_RECORD` is required for both
fields only in exactly correlated ordinary or control-normalized UI/provider
rejection cases;
it is forbidden when an approval record/M1 candidate exists. `ALLOW` or `DENY`
is required when M1 evaluates a candidate. `NOT_RUN_EVIDENCE_FAILURE` is
required for both fields only with a `FAILURE` observation and
`CORRELATION_OR_EVIDENCE_FAIL`; it records that no trustworthy M1 candidate
could be constructed and is unconditionally nonqualifying. No other null,
empty, or sentinel decision value is valid.

`rejectionEvidenceDigest` is non-null only for the four ordinary or
control-normalized UI/provider rejection classifications and binds the exact
probe/provider rejection event plus the 300-second record-observation result;
it is null for every approval-record classification. Absence without that
reproducing evidence is never a rejection classification.

Fixture values are digest-shaped test data, not user or release content.
Nevertheless, records omit reviewer login/display name, credentials, headers,
cookies, query material, unrelated response fields, and raw responses. An
absent value uses a fixed reason enum, never invented empty bytes. Records are
domain-separated, hash-chained, and signed by the existing local evidence
signer. This proves local packet integrity; it does not claim GitHub provides an
immutable audit record or prevents later deletion.

## Evidence access, retention, and disposal

Packets exist only in the protected local evidence store: owner-only directory
and file permissions (`0700`/`0600` or exact Windows ACL equivalent), no
symlinks, no repository/Jira/GitHub issue, log, summary, cache, or public
artifact copy. Only the evidence signer, qualification verifier, and owner
auditor may read them; the workflow and browser probe have no store access.

A packet is retained until the earliest of 90 days after `observedAt`, target-
tuple invalidation, superseding qualification, or owner revocation. At that
boundary it is deleted from primary and backup evidence storage. If no newer
complete packet exists, deletion/expiry atomically returns the target to
`TARGET_FIXTURE_NOT_YET_QUALIFIED`; missing evidence is never inferred as a
pass. Qualification verification rejects packets outside this lifecycle.

## Permission and authority boundary

| Actor | Allowed | Forbidden |
|---|---|---|
| Human staging reviewer | under explicit owner authorization for this qualification, manually create each fresh staging-only workflow run at the pinned SHA with `run_attempt == 1`, record the provider-returned `runId` into the case handoff, inspect that exact run/environment, and perform the provider UI approval | delegate credentials, create/re-run a production workflow, let the harness choose/discover a run, approve production, or waive a failed case |
| Read-only browser probe | read the rendered comment control immediately before the human click | click, type, submit, retain reviewer credentials, or call a write API |
| Evidence reader | use the inherited least-privilege read token for the exact run review-history operation | list/discover runs, mutate reviews, select another record on failure, or gain Jira/target credentials |
| Gated workflow job | consume only the inherited validated evidence path | receive fixture-harness, reviewer, Jira, deployment, or target credentials |

The staging-run authority above is narrow, explicit, and human-exercised; it is
not release or deployment authority. Correction 5 grants no production release,
production deployment, Jira, GitHub-review, or target authority. A pack,
workflow, or fixture cannot select itself or approve its own qualification.

## Threat model

| Threat | Control | Fail-closed result |
|---|---|---|
| Local/mock behavior is presented as provider fact | every case is a fresh provider run with bound target and response evidence | target stays unqualified |
| UI trims or canonicalizes before submit | intended and immediate pre-click DOM bytes are recorded separately | mismatch is a non-pass or explicit UI rejection, never preservation |
| Provider trims noncanonical input into canonical bytes | compare decoded bytes exactly and classify the transform | `TRANSFORMED_TO_CANONICAL_FAIL`; no comparator change |
| JSON escapes are confused with comment bytes | comparison uses the parsed scalar string encoded once as UTF-8 | malformed or ambiguous decode denies |
| Clipboard, Markdown, or screenshot hides a byte change | hexadecimal intended/DOM/provider fields and byte counts are authoritative | screenshot cannot satisfy a case |
| Wrong review record is sampled | fresh run per case plus exact run/environment/reviewer correlation | correlation failure; no alternate-record search |
| Run reuse or interleaving contaminates evidence | unique run per case, attempt exactly 1, serialized execution | contaminated case needs a fresh human-authorized staging run |
| Fixture records disclose protected data | fixed schema, sanitized raw-response digest, no identity strings or headers | unsafe record is rejected and target remains unqualified |
| Evidence outlives its staging purpose | protected-store ACL, earliest-of lifecycle, primary/backup deletion, qualification invalidation on absence | expired/deleted evidence cannot qualify a target |
| Provider behavior later changes | production comparison stays exact; qualification binds the complete target tuple | requalify after API/product/UI contract, plan, visibility, workflow, environment, or probe-version change |
| Review history is deleted or unavailable | no immutability assumption; signed local evidence is not provider non-deletion proof | absence cannot be converted into approval |

## Verification checklist

- [ ] The three validated design digests are byte-for-byte the correction 1,
  correction 2, and correction 4 digests listed above.
- [ ] Static inspection finds no normalization, trimming, case folding, newline
  conversion, regex extraction, or substring acceptance in the authority path.
- [ ] C5-F01 proves exact canonical preservation and `ALLOW` on one fresh run.
- [ ] C5-F02..C5-F17 each prove rejection or noncanonical provider-observed
  bytes plus `DENY` on distinct fresh runs.
- [ ] CR/LF, Unicode, uppercase, prefix-only, prose, and duplicate-digest cases
  reach provider-observed evidence or are explicitly rejected without being
  counted as preservation.
- [ ] All records bind the enrolled target tuple, run, attempt, environment,
  workflow SHA, API version, and reviewer numeric ID.
- [ ] No fixture automates human approval or receives reviewer credentials.
- [ ] Packet ACL, 90-day maximum, invalidation, primary/backup deletion, and
  absent-evidence fail-closed behavior pass on the target store.
- [ ] Any transformation into canonical bytes or any evidence ambiguity keeps
  status `TARGET_FIXTURE_NOT_YET_QUALIFIED`.
- [ ] For every case, mutate one intended or DOM byte before classification and
  prove the highest-precedence matching classification is reproduced. The test
  proves `INTENDED_DOM_MISMATCH_FAIL` wins over
  `PRESERVED_CANONICAL_ALLOW`, `PRESERVED_NONCANONICAL_DENIAL`, `UI_REJECTED`,
  `PROVIDER_REJECTED`, `TRANSFORMED_SAFE_DENIAL`, and
  `PROVIDER_VALUE_ABSENT_SAFE_DENIAL`. For C5-F07/F08/F17 only, a mutation that
  reproduces the exact closed CRLF/CR-to-LF mapping must instead yield the
  corresponding `CONTROL_NORMALIZED_*_EXCLUSION`; any mutation that does not
  reproduce that exact mapping must yield `INTENDED_DOM_MISMATCH_FAIL` unless a
  still-higher explicit FAIL row matches. This classifier self-test uses copies
  of recorded values and never mutates the signed/hash-chained evidence packet.
- [ ] Correction 3, M2-M7, and Q1-Q3 remain open and unchanged.

## Rollback and Codex-only review request

Before production activation this slice rolls back by discarding its candidate
evidence packet and retaining `TARGET_FIXTURE_NOT_YET_QUALIFIED`; frozen
corrections 1, 2, and 4 remain unchanged. After qualification, a bound target
change or contradictory observation invalidates correction-5 qualification and
returns to that same fail-closed state. Rollback never accepts a normalized
comment and never grants authority.

Review only correction 5. Confirm that the matrix observes real provider
behavior when later executed, that its authority comparison remains exact byte-for-byte, that no
noncanonical-to-canonical transformation can qualify, that permissions and
evidence retention are bounded, and that correction 3, M2-M7, and Q1-Q3 are
untouched. Return the standard KStack JSON envelope and Markdown report. At
Codex 84 or higher, request only concrete bug fixes; do not chase score. Opus
closure is eligible only if this exact digest reaches Codex 93 or higher with
zero defects, security findings, material dissent, or required unresolved
questions. One non-closing Opus advisory is separately allowed only after three
consecutive non-improving Codex rounds.

For this review return `APPROVE` only for `DESIGN_READY`; do not infer or report
`TARGET_QUALIFIED`. Absence of not-yet-authorized staging results is the stated
runtime status, not a failed design check. A genuine design defect is an
incomplete/contradictory protocol or a fixture incapable of proving its claim.
