# Domain breadth D8 - trusted time and freshness

**Parent item:** D8 trusted time/freshness policy  
**Route:** Codex-only, supplied-packet-only review; no Opus  
**Scope:** time evidence and conservative temporal decisions only

## Policy and source trust

Temporal decisions use an exact-digest, broker-protected, repository-external
`TrustedTimePolicyV1`, never repository timestamps or unqualified wall clock:

```text
{
  artifactType: "kstack-trusted-time-policy",
  schemaVersion: 1,
  projectId,
  sources: [{ sourceId, adapterId, adapterVersion, endpointIdentity,
              trustMaterialDigest, independenceGroupId }],
  rollbackWitnesses: [{ witnessId, adapterId, adapterVersion,
                        endpointIdentity, trustMaterialDigest,
                        independenceGroupId, namespaceId }],
  minimumRemoteSources: 2,
  minimumIndependenceGroups: 2,
  minimumRollbackWitnesses: 2,
  minimumWitnessIndependenceGroups: 2,
  maxSampleAgeMs,
  maxIntervalWidthMs,
  maxWallMonotonicDivergenceMs,
  maxFutureEvidenceSkewMs,
  rollbackToleranceMs,
  policyVersion
}
```

V1 qualifies authenticated Network Time Security adapters whose request/
response correlation, server identity, protocol version, era handling, offset,
delay, dispersion, uncertainty calculation, and negative fixtures are fixed by
adapter version. At least two fresh successful samples from distinct configured
independence groups are required. The trusted interval is the intersection of
their conservative UTC intervals; no overlap, excessive width, stale sample,
unknown leap/era, authentication failure, or insufficient independent sources
is `TRUSTED_TIME_UNAVAILABLE`. A local kernel wall clock is a continuity sensor,
not a remote quorum vote.

Repository content cannot add a source, key, endpoint, tolerance, adapter, or
independence claim. Policy replacement follows the existing broker owner
ceremony; policy weakening follows D3. There is no unauthenticated NTP, HTTP
Date, Git timestamp, Jira text, model output, or user-entered time fallback.

## Broker-external rollback witnesses

V1 also requires two independently operated, broker-external, linearizable
compare-and-set witnesses. Each qualified witness stores only one monotonic
tuple per immutable `(projectId, namespaceId)`:
`(sequence, anchorHeadDigest)`. Its authenticated API accepts
`expectedSequence`, `expectedHeadDigest`, `newSequence=expectedSequence+1`,
`newHeadDigest`, and a unique operation nonce. It either atomically installs
the exact successor and returns a signed receipt binding all request fields and
the resulting tuple, or returns the current signed tuple without mutation.
Deletion, decrement, blind overwrite, namespace reuse, and repository-supplied
credentials are unsupported by the adapter contract. Witness identity, trust
material, namespace, protocol, authentication source, linearizability tests,
and independence group are fixed outside the repository by the policy.

Before any temporal decision the broker reads both witnesses and requires them
to agree with the current local chain head. A lower local sequence/head with a
higher agreeing witness tuple is `PROTECTED_STATE_ROLLBACK_DETECTED`; it blocks
before receipt or effect and requires recovery from separately retained anchor
evidence. Equal sequence with different heads, witness regression, two
different advanced heads, invalid signature, insufficient witnesses, or
inability to establish independence is `TIME_WITNESS_CONFLICT` and blocks.

Initialization is a one-time broker/owner ceremony. Both fresh witness
namespaces must return the qualified adapter's signed `ABSENT` state. The
broker durably prepares one canonical genesis anchor binding project, policy,
and both namespace identities, CAS-creates tuple `(0, genesisDigest)` at both
witnesses, then commits the identical local genesis head. An existing namespace,
partial genesis, changed policy, or lost pending record enters reconciliation
or blocks; it never reinitializes or adopts repository state.

For an update the broker first durably writes a local pending record containing
old/new tuples, exact new anchor bytes/digest, witness requests, and operation
nonce. It then compare-and-sets both witnesses. Only after two matching signed
success receipts are durable may it commit the local chain head and clear the
pending record. A crash or one-witness partial success enters reconciliation:
if every advanced witness names the pending new tuple and every other witness
still names the exact old tuple, the broker may finish the remaining CAS and
commit; any other state blocks. No time receipt is emitted until both witnesses
and the local committed head agree. Restoring the entire local protected state
to an older self-consistent snapshot cannot restore either external tuple and
therefore deterministically blocks.

## Protected continuity anchor

The broker maintains an append-only `TimeAnchorV1` chain in protected state,
with its current head made rollback-detecting by the external witnesses. Each
record binds sequence, previous-record digest, boot ID,
kernel realtime, kernel monotonic/boottime, remote interval lower/upper bounds,
source-evidence digests, policy digest, and durable-write receipt. On first use
or after boot-ID change, two-source remote qualification is mandatory before a
temporal decision. Across one boot, monotonic time must advance and realtime
progression must remain within the policy's exact divergence/rollback bounds.
Sequence rollback, chain truncation, monotonic regression, realtime rollback,
wall/monotonic divergence, missing durable evidence, or policy mismatch blocks.

The broker samples remote time immediately before the operation and rechecks
local wall/monotonic/boot identity immediately after it. It widens each remote
interval by authenticated uncertainty plus measured request round-trip bounds,
intersects the intervals, and then widens the result by local elapsed time until
receipt publication. Checked integer nanoseconds over a fixed UTC epoch and a
closed leap-second/era table prevent float, locale, or rollover ambiguity.

## Trusted-time receipt

After durable anchor update, the broker emits:

```text
TrustedTimeReceiptV1 = {
  artifactType: "kstack-trusted-time-receipt",
  schemaVersion: 1,
  projectId,
  policyDigest,
  anchorSequence,
  anchorDigest,
  rollbackWitnessReceiptDigests,
  witnessedSequence,
  witnessedAnchorHeadDigest,
  bootIdDigest,
  sourceEvidenceDigests,
  lowerUtcNs,
  upperUtcNs,
  monotonicNs,
  wallUtcNs,
  issuedAtIntervalDigest
}
```

Its digest is
`"KSTACK-TRUSTED-TIME-RECEIPT-V1\n" || canonicalV1(receipt)`. The operation
inventory holds exact source evidence, anchor, and receipt bytes. Consumers
recompute all digests and require the policy, project, boot identity, chain
head, and maximum age to remain current at the guarded use point. A historical
receipt explains the decision made then but cannot authorize a new action.

## Conservative decision rules

All timestamps are canonical signed 64-bit UTC nanoseconds validated against
closed range bounds. Given trusted interval `[L,U]`:

- `notBefore=T` passes only when `L >= T`.
- `expiresAt=T` is usable only when `U < T`; overlap or equality blocks as
  temporally ambiguous.
- A maximum-age rule `maxAge=A` for authenticated evidence time `O` passes only
  when `O <= U`, `O >= U-A`, and `O <= L+maxFutureEvidenceSkew`. This uses the
  oldest possible age and rejects excessive future skew.
- An evidence timestamp is admitted only when D10's workflow-owned authenticated
  descriptor and producer receipt bind its exact value and source clock domain.
  Repository-authored or model-authored timestamps are untrusted regardless of
  apparent freshness.
- Waiver, selection acceptance, D1/D3 identity receipt, catalog activation,
  evidence freshness, and result validation each record the time-receipt digest
  and their exact temporal predicate inputs. Missing time converts none of them
  to pass, active, current, or unexpired.

If a remote provider supplies an event timestamp, source-specific qualification
must prove the provider response authentic and bind immutable provider object
identity plus timestamp. The provider timestamp is evidence about that event,
not the current clock and not a substitute for the trusted interval.

## Race and restart behavior

The consuming broker transaction rechecks chain head, boot ID, policy digest,
sample age, and local monotonic progression immediately before effect. If the
decision interval crosses an expiry/freshness boundary, the transaction returns
`TEMPORAL_BOUNDARY_AMBIGUOUS` and requires a fresh sample; it never chooses the
favorable endpoint. A crash before durable anchor/receipt publication produces
no time receipt. A crash after publication but before action consumption leaves
a valid historical receipt that still must pass freshness and guarded-state
checks on retry. Host suspend/resume or large monotonic gap forces fresh remote
qualification under a named policy threshold.

## Deterministic verification

- Golden protocol fixtures fix authenticated source evidence, interval
  arithmetic, intersection, uncertainty/RTT widening, anchor bytes, receipt
  bytes, and temporal predicates at equality and one nanosecond on each side.
- Test one/zero sources, two sources in one independence group, disjoint or
  overly wide intervals, stale/replayed response, invalid authentication,
  era/leap ambiguity, delay overflow, and partial response; block.
- Roll wall clock backward/forward, regress monotonic time, change boot ID,
  truncate/replay the anchor chain, restore an older protected-state snapshot,
  suspend/resume, race policy replacement, and cross an expiry during guarded
  consumption; block or require fresh qualification with no success action.
- Crash before either witness CAS, after only one witness CAS, after both CAS
  operations, and before/after local commit; recover only the single exact
  pending successor. Inject witness decrement, equal-sequence head conflict,
  divergent advanced heads, namespace reuse, stale signed response, missing
  pending record, and restoration of local chain plus local head; block before
  receipt or effect.
- Supply Git/Jira/repository/model timestamps, authentic provider timestamps
  without D10 binding, future-skewed evidence, equality at expiry, and a prior
  historical time receipt for a new action; reject.
- Verify unavailable trusted time yields explicit closed outcomes and no waiver,
  activation, evidence-pass, composition-admission, or dispatch receipt.

## Claim boundary

This design resists repository collaborators, ordinary clock drift/rollback,
single-source failure, replay, reboot, and time-of-check races. Compromise of
the broker/root or enough independent configured time authorities is outside
the claim and is recorded as an incident/revocation condition, not silently
treated as verified time.

## Review request

Review only whether this design closes D8 trusted-time, freshness, rollback,
source-authentication, and boundary-race defects. Report current concrete
defects only. Closure requires confidence >=93 and zero failed checks,
security findings, material dissent, and unresolved questions.
