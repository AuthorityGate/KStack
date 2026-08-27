# HP-TC04 design candidate: evidence trust, live measurement, and selection

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC04` only
**Status:** local design candidate; no implementation, evidence promotion, or
host-support claim
**Predecessors:** HP-TC01 through HP-TC03 are validated design only; HP-TC06
independent harness remains separately open
**Locked owner boundary:** HP-Q1 protected host-governance component is required

## Exact defect boundary

The round-one plan did not say who may attest host evidence, where trust roots
live, how signer rotation or revocation works, which running-environment facts
are measured, when mutable facts are remeasured, or how one exact evidence set
is selected without a "latest" race. This item defines those mechanisms only.

HP-TC04 does not derive request identity/class (HP-TC02), implement replay/time
(HP-TC03), decide operation eligibility or quarantine precedence (HP-TC05),
build the independent harness or bypass inventory (HP-TC06), authorize a
broker action (HP-TC07), mutate local state (HP-TC08), authenticate MCP
principals (HP-TC09), prove provider outcomes (HP-TC10), fence an in-flight
action (HP-TC11), or activate/rollback components (HP-TC12). An evidence object
being `VALID` is necessary input to later policy, never execution authority.

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC01's closed, domain-addressed
schemas, HP-TC03's authoritative-time comparisons, and the owner-locked HP-Q1
protected component. Build KStack-native trust-root, signature, environment-
measurement, revocation, supersession, and deterministic-selection contracts.
The gstack host registry/generator has no independent signed evidence trust
layer and is rejected for this item. No upstream bytes enter this design.

## Threat and ownership boundary

Repository collaborators, model/agent processes, host adapters, plugins,
skills, MCP servers, harness subjects, and ordinary host configuration may
supply observations but cannot write or choose trust roots, signing keys,
measurement keys, revocations, evidence epochs, catalog heads, or selection
outcomes. Those reside in the HP-Q1 protected component outside repository and
agent-writable roots. Repository files may reference exact protected-object
digests but cannot define or replace them.

The claim resists repository and agent-process compromise, forged adapter
claims, stale/replayed evidence, signer replacement, environment drift, and
partial catalog reads. Compromise of the protected component or a valid root-
administration quorum is outside this item and triggers incident recovery and
epoch invalidation; it is never represented as ordinary valid evidence.

## Trust-root and key lifecycle

V1 uses Ed25519 signatures as specified by RFC 8032 with canonical public keys
and signatures, SHA-256 domain addresses, and no algorithm negotiation. A later
algorithm requires a new schema/profile and independently reviewed migration;
unknown algorithms reject.

`EvidenceTrustRootV1` is a closed protected object binding exactly:

```text
schemaId, schemaVersion, schemaSetDigest, trustDomainId, rootGeneration,
previousRootDigest|null, rootAdminPublicKeys, threshold=2,
onlineSignerProfiles, evidenceEpoch, notBefore, notAfter,
trustedTimeProfileDigest, transitionProofDigest|null
```

There are exactly three distinct offline root-administration public keys and a
two-key threshold. An online signer profile binds one distinct public key,
`keyId`, role, producer-profile digests, allowed evidence-schema digests,
maximum evidence lifetime, issuance start/end, and state
`ISSUING|VERIFY_ONLY|REVOKED`. Root-administration and online-signer keys may
not overlap. Private keys are non-exportable from a protected OS keystore,
hardware-backed store, or separately qualified signing service named by the
profile; a plaintext repository/user-config key is invalid.

Genesis enrollment is an explicit local owner-administration ceremony that
writes the exact root digest into the protected component and records a
protected audit receipt. It is not accepted from repository content, a model,
an adapter, TOFU network discovery, or an unsigned import. A root transition
requires signatures from two distinct current root administrators over the
complete candidate-root digest plus self-possession proofs from two distinct
candidate administrators. It increments `rootGeneration`, retains the prior
root as verify-only through the longest unexpired evidence lifetime, and never
changes an existing evidence object's bytes.

`EvidenceRevocationV1` binds root generation, monotonically increasing
revocation sequence, revoked key/root/producer/profile digests, exact
`invalidFrom`, reason code, replacement digest or null, new evidence epoch,
authoritative-time sample, and two current root-administrator signatures. A
revocation is append-only. It takes effect for every new selection immediately
after its protected durable commit, including evidence signed earlier whose
claimed interval intersects `invalidFrom`; cached success cannot override it.
Restoring a revoked identifier/key is forbidden. Emergency handling uses the
same two-of-three threshold, may revoke all online signers, and always advances
the evidence epoch. Lost quorum is fail-closed until a separately governed
protected recovery procedure establishes a new trust domain; repository or
agent override is forbidden.

## Acyclic signed evidence

`EvidenceAnchorV1` is closed and binds exactly:

```text
schemaId, schemaVersion, schemaSetDigest, payloadDigest, payloadSchemaDigest,
producerProfileDigest, signerKeyId, signerRole, trustRootDigest,
rootGeneration, evidenceEpoch, environmentSnapshotDigest,
independentObservationSetDigest, issuedAt, expiresAt, signature
```

The signature transcript is exactly:

```text
ASCII("KSTACK-EVIDENCE-ANCHOR-SIGNATURE-V1") || 0x00 ||
RFC8785(anchor with signature omitted)
```

`payloadDigest` addresses the already-complete payload without its anchor.
The payload stores no anchor digest; a separate protected catalog row binds
payload and anchor, so construction is acyclic. A catalog row is published
only after payload, unsigned anchor, signature, and all referenced objects have
been durably stored and re-read by digest.

The protected signer signs only after a registered producer profile has
validated schema/domain closure, current environment binding, fixture closure,
and an `independentObservationSetDigest` produced outside the adapter/model or
subject process. Adapter, model, skill, MCP, or harness-subject output is
diagnostic and cannot be substituted for observer truth. Until HP-TC06's
independent harness/observer implementation is validated and active,
conformance evidence requiring it evaluates `UNAVAILABLE`, never `VALID`.

## Exact environment measurement

`EnvironmentMeasurementProfileV1` is protected/active-set bound and lists the
exact typed selectors, collection rules, platform probes, secret treatment,
mutable/immutable classification, maximum measurement age, and observer
implementation digests for one operation profile and host/platform tuple.
Unknown or unmeasurable mandatory selectors fail the snapshot.

`EnvironmentSnapshotV1` is closed/domain-addressed and binds:

```text
schemaId, schemaVersion, schemaSetDigest, measurementProfileDigest,
hostInstanceDigest, runningProcessIdentityDigest,
onDiskExecutableIdentityDigest, platformKernelDigest, adapterDigest,
nativePermissionModeDigest, hostModeDigest, hostConfigDigest,
pluginSetDigest, customToolSetDigest, subagentSetDigest, mcpEndpointSetDigest,
toolRegistryDigest, repositoryRootSetDigest, worktreeSetDigest,
mountCaseProfileDigest, shellWrapperSetDigest, formatterLspSetDigest,
backgroundFacilitySetDigest, brokerProfileDigest, activeSetDigest,
policyDigest, relevantEnvironmentDigest, secretMeasurementKeyGeneration,
measurementSequence, measuredAt, expiresAt, trustedTimeSampleDigest,
observerProfileSetDigest
```

The running process and on-disk executable are separate mandatory facts.
Running identity includes protected process identity/start marker, opened
executable image identity, loaded-image/module closure where the platform can
prove it, command/runtime build, parent/session identity, and adapter-facing
protocol build. On-disk identity is measured from an opened no-follow handle
and binds file identity, volume/mount identity, size, bytes digest, ownership,
and relevant permission metadata. A replaced on-disk file does not rewrite the
running identity; disagreement is explicit and invalidates profiles requiring
the current installed build.

Configuration measurement covers active host/global/project configuration,
native allow/ask/deny and auto/session modes, remembered approvals, plugins,
custom tools, subagents, user/project MCP endpoints, tool registrations,
additional roots/worktrees, symlink/reparse/mount/case behavior, shells and
wrappers, formatters/LSP hooks, background executors, broker route, policy, and
the complete active KStack component set. Each profile declares which source
wins and proves every alternate discovery source absent or measured; cwd,
search-path, environment, or global-config fallback is never implicit.

Relevant environment/config fields are enumerated by registered selector, not
copied wholesale. Public non-secret values use canonical typed bytes. Secret-
bearing values record only presence, source identity, metadata allowed by the
profile, and
`HMAC-SHA-256(protectedMeasurementKey, domain || selector || canonicalValue)`.
The HMAC key is non-exportable, is distinct from signature keys, and its
generation is bound in the snapshot. Raw secret, token, credential, nonce,
approval material, environment block, or unescaped host text never enters the
snapshot, evidence, public diagnostics, or model context. Low-entropy secrets
cannot be tested offline without the protected key.

## Live remeasurement and atomic snapshot publication

The protected component opens/identifies all measurable sources first, takes a
single HP-TC03 trusted-time sample, reads every field through registered probes,
then revalidates source identity and relevant metadata before publishing. A
source replacement, mixed generation, partial read, probe crash, unbounded
output, unknown alternate source, or changed active-set/policy/root produces no
snapshot. The component increments a protected measurement sequence and
atomically appends the complete snapshot plus catalog head.

Before every admission/selection and again at the handoff to HP-TC11, the
component remeasures every selector marked mutable and revalidates every opened
identity. The result must equal the evidence-bound snapshot on all profile-
relevant fields and be within both profile age and shortest referenced expiry.
Any change returns `STALE` or `INVALID` as defined below and advances no
authority. A protected `EvidenceAdmissionSnapshotV1` binds the current
environment digest, measurement sequence, active set, policy, root generation,
revocation sequence, evidence epoch, catalog head/sequence, requirement
profile, selected evidence digests, evaluation digest, trusted time sample,
and expiry.

This snapshot is an input to HP-TC05 and HP-TC11, not a lease or fence. A later
environment, root, policy, evidence-epoch, or catalog change invalidates it;
HP-TC11 must independently compare these fields at the action boundary.

## Deterministic evidence admission and selection

`EvidenceCatalogSnapshotV1` is a protected immutable head over an append-only
catalog. It binds the exact trust root/generation, revocation set and sequence,
evidence epoch, active set, policy, environment snapshot, producer registry,
schema/resolver set, catalog sequence, previous head, all candidate anchor
digests, supersession records, trusted-time sample, and snapshot expiry. The
selector never performs a partial/live query after freezing this head.

For one exact `OperationRequirementProfileV1`, selection proceeds in this
order and stops on the first failure:

1. validate the complete HP-TC01 schema/domain/resolver closure and all digest
   references; reject missing, duplicate, cyclic, extra, or unknown objects;
2. validate root chain, two-key transitions, signer role/profile/schema scope,
   Ed25519 signature, evidence epoch, revocation sequence, issuance interval,
   issued/expiry ordering, and HP-TC03 current time;
3. require exact host instance/build, adapter, active-set, policy, operation
   profile, producer, fixture set, observer set, and environment bindings;
4. require live remeasurement equality and exact fixture/requirement closure;
5. collect all applicable non-superseded evidence for every required
   capability and negative fixture; no score, adapter claim, or later success
   suppresses an applicable failure, ambiguity, harness error, unavailable
   observation, or contradiction;
6. sort solely by canonical `(capabilityId, fixtureId, producerProfileDigest,
   payloadDigest)` bytes and construct the evidence-set digest. Time, directory
   order, insertion order, host enumeration, and implementation preference are
   never tie-breakers.

`EvidenceSupersessionV1` is a protected, signed object binding old/new evidence
digests, identical requirement/fixture/environment scope, root-cause reason,
corrective-change digest, new independent run digest, effective time, evidence
epoch, and two root-administrator signatures. It never deletes or edits old
evidence. Supersession is admissible only for an explicitly corrected and
independently rerun scope; it cannot hide a still-applicable failure,
contradiction, compromised signer interval, or revoked producer. Replacement
increments the evidence epoch and forces a new catalog/admission snapshot.

There is no "newest wins," majority vote, confidence threshold, host-provided
preference, or positive-result override. If two valid, current, applicable
records assert incompatible outcomes and neither is validly superseded, the
scope is `CONTRADICTORY`. If any required scope has no admissible record it is
`UNAVAILABLE`. Selection produces one exact set or no set.

## Closed evaluation outcomes

`EvidenceEvaluationV1` returns exactly one of:

```text
VALID | INVALID | CONTRADICTORY | STALE | UNAVAILABLE
```

- `VALID`: all structural, cryptographic, scope, live-measurement, currentness,
  fixture, and observer checks pass for one exact selected set.
- `INVALID`: a present object has a bad signature/schema/binding, is revoked,
  contains a failing required fixture, or violates its trust/profile contract.
- `CONTRADICTORY`: independently admissible current facts conflict and no valid
  supersession resolves the exact scope.
- `STALE`: otherwise valid evidence or environment no longer matches/currently
  satisfies its bound time, epoch, sequence, root, policy, or active set.
- `UNAVAILABLE`: a required object, probe, observer, signer service, trust root,
  time source, or complete scope cannot be obtained/proven.

Precedence for reporting is `INVALID`, `CONTRADICTORY`, `STALE`,
`UNAVAILABLE`, then `VALID`; the complete reason-code set is retained. This is
diagnostic determinism only. HP-TC05 separately maps evidence evaluation plus
policy and alternates to eligibility/quarantine. No outcome here admits,
approves, executes, retries, activates, or supports an operation.

## Stable reason codes and safe diagnostics

The closed reason families are `KSTACK_EVIDENCE_SCHEMA_*`,
`KSTACK_EVIDENCE_SIGNATURE_*`, `KSTACK_EVIDENCE_ROOT_*`,
`KSTACK_EVIDENCE_SIGNER_*`, `KSTACK_EVIDENCE_REVOKED`,
`KSTACK_EVIDENCE_EPOCH_MISMATCH`, `KSTACK_EVIDENCE_SCOPE_MISMATCH`,
`KSTACK_EVIDENCE_FIXTURE_*`, `KSTACK_EVIDENCE_OBSERVER_*`,
`KSTACK_EVIDENCE_CONTRADICTORY`, `KSTACK_EVIDENCE_STALE`,
`KSTACK_EVIDENCE_UNAVAILABLE`, `KSTACK_ENVIRONMENT_CHANGED`,
`KSTACK_ENVIRONMENT_SOURCE_AMBIGUOUS`, and
`KSTACK_ENVIRONMENT_MEASUREMENT_FAILED`. Each concrete code is registry-owned
by the HP-TC01 vocabulary and maps to one outcome.

Human diagnostics are fixed escaped projections containing only safe IDs,
digests, outcome, count, and correlation digest. Raw path, principal, config,
environment, secret, credential, key material, request/host text, exception,
and signature bytes are excluded from public/model-visible output.

## Deterministic verification design

Golden vectors cover root/genesis/transition objects, threshold signatures,
anchor transcripts, revocations, supersessions, environment snapshots,
catalog heads, admission snapshots, selection ordering, and all five outcomes
across independent Node and native/Rust implementations.

Negative fixtures include one-of-three root signatures; duplicate signer;
root/online key overlap; unknown algorithm; malformed/noncanonical key or
signature; forged signature; wrong role/schema/producer; expired/verify-only
issuance; pre/post/retroactive revocation; root rotation and rollback; revoked
root restoration; lost quorum; stale cache after emergency epoch advance;
missing/corrupt catalog link; partial snapshot; and signature/payload
substitution.

Environment fixtures replace the running process, on-disk executable, loaded
module, config, plugin, tool, subagent, MCP endpoint, root/worktree, mount,
case profile, shell/wrapper, formatter/LSP, background executor, broker,
policy, or active component before, during, and after measurement. They cover
secret presence/value changes, HMAC-key rotation, raw-secret scans, symlink/
reparse/mount races, mixed-epoch reads, crashed/unbounded probes, and
unmeasurable mandatory facts.

Selection fixtures cover conflicting pass/fail, ambiguity, unavailable
observer, later pass without supersession, forged supersession, different
scope supersession, corrected independent rerun, expired evidence, equal-time
records, insertion/order changes, missing negative fixture, active-set/policy/
environment drift, remeasurement-to-handoff races, and a host/model attempting
to choose its preferred evidence. Property tests prove identical input
closures always yield identical bytes/outcome and no invalid, contradictory,
stale, or unavailable set becomes `VALID`.

No test uses production credentials or targets. Independent harness evidence
remains unavailable until HP-TC06 is separately implemented and validated.

## Review request

Review HP-TC04 only for protected evidence trust roots/signers, exact
rotation/revocation, acyclic anchor construction, complete live environment
measurement, action-time remeasurement handoff, deterministic evidence
selection/supersession, and fail-closed outcomes. Closure requires Codex 93+
and empty failed, security, dissent, and question arrays.

Do not review or close HP-TC05 through HP-TC12, invoke Opus, inspect/edit
files, use tools, implement, install/configure a host, use credentials, perform
an external action, commit, push, deploy, publish, or edit reports.
