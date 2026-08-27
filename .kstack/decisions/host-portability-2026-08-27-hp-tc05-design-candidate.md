# HP-TC05 design candidate: deterministic eligibility and quarantine

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC05` only
**Status:** local design candidate; no implementation, activation, or operation
authorization
**Predecessors:** HP-TC01 through HP-TC03 are validated design only; HP-TC04 is
a frozen, independently review-gated interface candidate

## Exact defect boundary

The round-one plan did not define deterministic precedence among policy denial,
missing or contradictory evidence, registered alternates, signer/producer
revocation, quarantine, and an invalidation that occurs after admission. This
item defines the pure eligibility decision, protected quarantine lifecycle, and
eligibility-epoch invalidation handoff only.

HP-TC05 does not authenticate evidence (HP-TC04), construct independent host
evidence (HP-TC06), grant approval/broker authority (HP-TC07), mutate local
state (HP-TC08), authenticate MCP (HP-TC09), prove an external result (HP-TC10),
implement an action fence (HP-TC11), or activate/rollback a set (HP-TC12).

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC01's exact requirement,
eligibility, and quarantine schemas; HP-TC02's protected operation/class
derivation; HP-TC03's authoritative time; and HP-TC04's frozen evaluation/
admission-snapshot interface. Build KStack-native precedence, alternate,
quarantine, and epoch rules. The gstack registry/generator has no equivalent
authority-bearing state machine and is rejected. No upstream bytes enter.

## Protected inputs and pure evaluator

The HP-Q1 protected component freezes one `EligibilityInputSnapshotV1` binding
exactly:

```text
schemaId, schemaVersion, schemaSetDigest, operationId,
requirementProfileDigest, trustedRequestContextDigest,
operationClassId, evidenceAdmissionSnapshotDigest,
evidenceEvaluationDigest, activeSetDigest, policyDigest,
eligibilityPolicyDigest, quarantineHeadDigest, revocationSequence,
evidenceEpoch, eligibilityEpoch, trustedTimeSampleDigest, evaluatedAt
```

Every digest resolves exactly once through the current HP-TC01 schema/resolver
closure and must agree on operation, class, repository, host instance, adapter,
environment, active set, policy, and time. The evaluator has no network,
filesystem discovery, host callback, model judgment, wall-clock read, mutable
global lookup, or "latest" query. It consumes only the frozen protected
snapshot and emits deterministic canonical bytes.

Caller/host/model fields cannot select operation class, policy, alternate,
quarantine scope, epoch, evidence record, or result. Approval is neither an
input to eligibility nor an override. A user can later authorize a separately
governed policy change or remediation, but cannot turn the current invalid
snapshot into `FULL` by clicking continue.

## Policy and alternate registry

`EligibilityPolicyV1` is protected and active-set bound. It contains one exact
row per operation ID with operation/class/requirement-profile digests, absolute
deny state, permitted host/platform constraints, minimum evidence status,
required/forbidden reason codes, alternate permission, ordered alternate
profile IDs, quarantine mappings, maximum result lifetime, and policy epoch.
Unknown, duplicate, or missing operation rows deny evaluation.

Absolute deny applies to the operation and every alternate. It cannot be
weakened by capability evidence, approval, remembered preference, a less-
privileged-looking class supplied by a host, or an alternate profile. A
repository policy may only tighten the protected base row. Widening requires a
separately authorized protected policy transition and a new policy digest/
epoch; it never mutates an existing eligibility record.

An alternate is eligible for consideration only when all are true:

- it appears in the primary `OperationRequirementProfileV1` and the protected
  policy's ordered list with maximum status `DEGRADED_REGISTERED`;
- its schema, operation semantics, output contract, authority ceiling, and
  exact `semanticEffectSubsetProofDigest` are active-set registered;
- it requires strictly no more authority/effect than the primary, never merely
  a differently named operation or class;
- the reason the primary cannot reach `FULL` is an explicitly alternate-
  eligible missing/unavailable capability, not denial, invalid evidence,
  contradiction, revocation, quarantine, context mismatch, or ambiguity; and
- the alternate independently satisfies every one of its own mandatory
  capabilities, policy constraints, live bindings, and negative fixtures.

The first fully satisfied profile in the protected ordered list is selected.
Order is content-addressed policy, not time, enumeration order, host/model
preference, or score. If two list entries share an ID/digest, a subset proof is
missing, or the order is absent/ambiguous, no alternate is selected.

## Deterministic decision precedence

The evaluator applies this exact precedence and retains all applicable stable
reason codes even after a terminal status is known:

1. **Input integrity/security quarantine.** Invalid schema/digest/signature,
   mismatched protected context, contradictory HP-TC04 evidence, revoked trust
   root/signer/producer/profile, catalog rollback/fork, invalid supersession,
   active quarantine event, or corrupt protected state yields `QUARANTINED`.
2. **Absolute policy denial.** A valid protected base/repository policy deny,
   prohibited host/platform/class, or operation removed from the active policy
   yields `UNSUPPORTED`; alternates are not evaluated.
3. **Currentness and exact binding.** Stale or unavailable evidence/time/
   environment, changed active set/policy/root/epoch, unmeasurable mandatory
   host fact, or request/context mismatch yields `UNSUPPORTED` unless the only
   failure is explicitly alternate-eligible and the alternate has independent
   current evidence.
4. **Mandatory primary capability closure.** If every mandatory primary
   requirement and negative fixture is proven and no forbidden reason is
   present, yield `FULL`.
5. **Registered alternate closure.** If primary closure fails only for an
   alternate-eligible reason and the first deterministic alternate passes its
   complete independent evaluation, yield `DEGRADED_REGISTERED` and bind only
   that alternate ID/profile. Otherwise yield `UNSUPPORTED`.

`QUARANTINED` is more restrictive than `UNSUPPORTED`, which is more restrictive
than `DEGRADED_REGISTERED`, which is more restrictive than `FULL`. Multiple
simultaneous conditions report the most restrictive status. A later or higher-
confidence pass cannot suppress an earlier applicable security/integrity fact.
No majority vote, numeric confidence, retry-until-green, user/model preference,
or "best available" rule exists.

Evidence outcome mapping is exact: HP-TC04 `INVALID|CONTRADICTORY` maps to
`QUARANTINED`; `STALE|UNAVAILABLE` maps to `UNSUPPORTED`; only `VALID` may
continue to policy/capability evaluation. A failing required conformance
fixture is `INVALID`. Absence of a required fixture is `UNAVAILABLE`. An
explicit policy deny remains `UNSUPPORTED` even when evidence is valid.

## Eligibility record construction

`OperationEligibilityV1` is emitted exactly as validated by HP-TC01. Its
`provenCapabilityIds` and `missingCapabilityIds` are disjoint, sorted, and their
union equals the primary requirement profile's registered capability set.
Capabilities satisfied only by a selected alternate remain missing from the
primary set; the alternate's independent partition is retained in an addressed
evaluation detail object.

The status matrix is:

| Status | alternateProfileId | Meaning |
|---|---|---|
| `FULL` | null | Every primary mandatory requirement is proven under current bindings. |
| `DEGRADED_REGISTERED` | selected ID | One exact pre-registered lower-authority alternate independently passes. |
| `UNSUPPORTED` | null | Policy, availability, currentness, or capability closure prevents use without an integrity incident. |
| `QUARANTINED` | null | Integrity/security/revocation/contradiction or protected-state corruption requires remediation. |

`evaluatedAt` is the HP-TC03 trusted sample time. `expiresAt` is the earliest of
request/context, evidence, environment, policy, quarantine/revocation snapshot,
active set, alternate proof, and operation-class maximum expiry. A zero or
already-expired intersection yields `UNSUPPORTED`; an implementation never
extends another object's lifetime.

The eligibility digest binds `EligibilityInputSnapshotV1`, the exact ordered
rule trace, all reason codes, selected alternate detail or null, and the
current eligibility epoch in a separate protected evaluation record. A cached
record is reusable only when every bound digest/sequence/epoch still equals the
current protected values and trusted time is before expiry. Cache mismatch
causes reevaluation, never stale reuse.

## Protected quarantine lifecycle

`QuarantineEventV1` is accepted only from the protected component and its HP-
TC04 anchor. Subject types are exactly trust root, signer, producer, evidence,
fixture, host instance/build, adapter, environment profile, active set, policy,
operation profile, repository context, or protected subsystem. `scopeOperationIds`
is a sorted exact set; an empty set means every operation present in the bound
policy snapshot, not an implementation-selected subset.

Automatic events are appended for invalid/contradictory evidence, revocation,
catalog/protected-state corruption, bypass evidence, environment identity
contradiction, or a failed mandatory security fixture. A policy administrator
may also append a bounded event through a separately authorized protected
action. Repository, adapter, model, host prompt, MCP text, or ordinary user file
cannot append, edit, expire, release, or shadow one.

Security/integrity events have `expiresAt:null` unless their registered reason
explicitly permits a bounded automatic expiry; revocation and corruption never
auto-expire. An elapsed expiry only removes that event from the next snapshot;
it does not restore old eligibility.

`QuarantineResolutionV1` is a new closed protected object binding the event,
subject/scope, incident/remediation evidence, replacement component/evidence or
null, independent verification digest, new evidence/policy/eligibility epochs,
authoritative time, resolver identity, and protected anchor. Resolution is
admissible only when the registered reason's remediation contract passes and
all referenced revocations remain enforced. It appends a resolution; it never
deletes the event or makes a revoked key/identifier valid again.

After resolution, the evaluator starts from a new complete input snapshot. It
does not reinstate the prior eligibility record. If current evidence is absent,
stale, invalid, or contradictory, the result remains `UNSUPPORTED` or
`QUARANTINED`. Quarantine is therefore a non-promotional containment state, not
a workflow for approving around failed checks.

## Eligibility epochs and in-flight invalidation handoff

The protected component maintains a monotonic `eligibilityEpoch` per repository
and operation scope. It advances before publishing any change to policy,
active set, requirement/alternate profile, evidence epoch/catalog head,
revocation sequence, quarantine head, environment binding, host process/build,
adapter, or protected subsystem status that can restrict a current result.

`EligibilityInvalidationV1` binds exactly:

```text
schemaId, schemaVersion, schemaSetDigest, repositoryContextDigest,
scopeOperationIds, priorEligibilityEpoch, newEligibilityEpoch,
changedSubjectType, changedSubjectDigest, reasonCode,
affectedEligibilityDigests, effectiveAt, trustedTimeSampleDigest,
protectedAnchorDigest
```

The epoch advance and invalidation append are one protected durable
transaction. Failure or ambiguity blocks new evaluation for that scope. A
restrictive event is never delayed for cache refresh, host cooperation, model
notification, or a replacement positive run.

HP-TC05 makes no claim that an external host action can be stopped. It supplies
the action-fence input contract to HP-TC11:

- before dispatch/action boundary, HP-TC11 must compare the eligibility record,
  epoch, active set, policy, evidence admission snapshot, environment sequence,
  revocation sequence, quarantine head, and expiry under its protected fence;
- a mismatch before action yields no dispatch and requires fresh evaluation;
- a restriction observed after the action may have crossed its boundary cannot
  be reported as cancelled/not acted: HP-TC03 records ambiguity and HP-TC10
  reconciliation evidence is required; and
- a later relaxation/new `FULL` record cannot retroactively legalize or retry an
  earlier fenced/ambiguous attempt.

For read/advisory output, invalidation before protected release suppresses the
output and requires reevaluation. If output was already released, the audit
record retains the eligibility/epoch used; no claim is made that disclosure can
be recalled. Background renewal and descendant cancellation remain HP-TC11.

## Stable reason codes and diagnostics

The exact reason-code families are:

```text
KSTACK_ELIGIBILITY_INPUT_INVALID
KSTACK_ELIGIBILITY_CONTEXT_MISMATCH
KSTACK_ELIGIBILITY_POLICY_DENIED
KSTACK_ELIGIBILITY_POLICY_UNAVAILABLE
KSTACK_ELIGIBILITY_EVIDENCE_INVALID
KSTACK_ELIGIBILITY_EVIDENCE_CONTRADICTORY
KSTACK_ELIGIBILITY_EVIDENCE_STALE
KSTACK_ELIGIBILITY_EVIDENCE_UNAVAILABLE
KSTACK_ELIGIBILITY_REQUIREMENT_MISSING
KSTACK_ELIGIBILITY_NEGATIVE_FIXTURE_FAILED
KSTACK_ELIGIBILITY_ALTERNATE_NOT_REGISTERED
KSTACK_ELIGIBILITY_ALTERNATE_AMBIGUOUS
KSTACK_ELIGIBILITY_ALTERNATE_NOT_PROVEN
KSTACK_ELIGIBILITY_REVOKED
KSTACK_ELIGIBILITY_QUARANTINED
KSTACK_ELIGIBILITY_EPOCH_CHANGED
KSTACK_ELIGIBILITY_EXPIRED
KSTACK_ELIGIBILITY_PROTECTED_STATE_UNAVAILABLE
KSTACK_ELIGIBILITY_PROTECTED_STATE_CORRUPT
```

Each code is registered in the HP-TC01 vocabulary and maps to one precedence
class. Human messages are fixed escaped projections containing safe IDs,
status, counts, and correlation digests only. Raw path, principal, configuration,
environment, evidence payload, host/model output, exception, credential,
approval, key, or secret is never interpolated into public/model-visible text.

## Deterministic verification design

Golden vectors freeze input snapshots, policy/alternate rows, exact rule traces,
capability partitions, all four eligibility records, quarantine events/
resolutions, epoch advances, invalidation objects, expiry intersections, and
safe diagnostics across independent Node and native/Rust evaluators.

The full precedence matrix covers every pair and triple of policy deny; valid,
invalid, contradictory, stale, and unavailable evidence; primary closure;
registered/unregistered alternate; active/expired quarantine; revocation;
environment/active-set/policy drift; and protected-state corruption. Permuting
input or catalog enumeration cannot change canonical output. Mutation tests
change every binding, sequence, epoch, reason, capability, alternate, scope,
time, or digest and require deterministic rejection/reevaluation.

Alternate tests cover semantic-effect expansion, class downgrade, missing
subset proof, two eligible alternates, reordered policy, alternate-only pass,
higher-priority failure, independent-evidence absence, absolute deny, primary
contradiction, revoked producer, and a host/model selecting a preferred profile.
No security/integrity condition may produce `DEGRADED_REGISTERED`.

Quarantine tests cover forged/repository events; global/operation scope;
overlapping events; revoked-key release; expired nonsecurity event; null expiry;
insufficient remediation; valid resolution with missing replacement evidence;
new contradiction after resolution; protected-log fork/rollback; and attempts
to reuse a pre-quarantine `FULL` record.

Concurrency/crash tests race policy, active set, environment, revocation,
catalog, quarantine, trusted time, and host process changes before/after every
evaluation and epoch-append step. They prove atomic epoch/invalidation
publication, no stale cache reuse, pre-action mismatch handoff, and post-action
ambiguity rather than false cancellation or retry. Property tests prove a more
restrictive input can never yield a less restrictive status.

No test uses production credentials or targets. This design does not implement
the HP-TC11 fence; test doubles validate only the handoff transcript.

## Review request

Review HP-TC05 only for pure protected eligibility evaluation, exact restrictive
precedence, registered alternate selection, non-promotional quarantine/
resolution, expiry/cache rules, and eligibility-epoch invalidation handoff.
Closure requires Codex 93+ and empty failed, security, dissent, and question
arrays.

Do not review or close HP-TC06 or HP-TC08 through HP-TC12, invoke Opus,
inspect/edit files, use tools, implement, use credentials, perform an external
action, commit, push, deploy, publish, or edit reports.
