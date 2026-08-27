# HP-TC10 design candidate: receipt trust by operation class

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC10` only
**Status:** local design candidate; no implementation, provider call, or outcome
claim
**Predecessors:** HP-TC01 through HP-TC04 and HP-TC07 are validated design only;
HP-TC05/06/08/09 interfaces are frozen and independently review-gated

## Exact defect boundary

The round-one plan let a protected local audit anchor stand in for proof that an
external provider performed an action. This item defines admissible producer/
observer evidence per operation class, exact receipt correlation, authenticated
provider read-back, ambiguity reconciliation, contradiction handling, and
terminal outcome derivation.

It does not authenticate the requester (HP-TC02), prevent duplicate effects
(HP-TC03), select host evidence/eligibility (HP-TC04/05), prove host conformance
(HP-TC06), authorize or dispatch (HP-TC07), mutate local state (HP-TC08), expose
MCP output (HP-TC09), fence an action (HP-TC11), or activate/rollback (HP-TC12).

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC03 attempt/ambiguity state,
HP-TC07 protected dispatch, HP-TC08 frozen local evidence, and the existing
KStack Jira/Git provider-adapter precedent. Build KStack-native receipt-profile,
provider-authentication, correlation, reconciliation, and outcome contracts.
Generic gstack ship/deploy success text or local command exit status cannot
prove a remote effect and is rejected. No upstream bytes enter.

## Receipt profiles and proof classes

`ReceiptTrustProfileV1` is protected/active-set bound and contains one exact row
per operation ID/profile/class. A row binds admissible receipt kinds, required
producer and observer profiles, minimum independent channels, exact correlation
fields, terminal mappings, reconciliation profile, retention, expiry, and
revocation behavior. Unknown, duplicate, or missing rows yield no proof.

The V1 class matrix is:

| Operation class | Minimum admissible evidence |
|---|---|
| `LOCAL_READ` | Protected local execution/result audit and exact output digest; no external-outcome claim. |
| `ADVISORY` | Protected local audit plus exact model/provider response digest and registered response identity when a remote provider is used; content correctness is not proven by receipt. |
| `LOCAL_WRITE` | HP-TC08 independent pre/post filesystem evidence plus protected mutation-ledger result; process exit alone is insufficient. |
| `ASK_SIDE_EFFECT` | Provider-authenticated effect receipt or authenticated immutable-ID read-back, plus protected dispatch/audit correlation. |
| `PRIVILEGED_SIDE_EFFECT` | Same as ask-side-effect, with the profile's stronger independent read-back/tenant/target fields and no local-only success path. |
| `BACKGROUND` | Protected lifecycle audit plus the receipt required by the underlying operation class; task completion alone does not prove its effect. |

A local audit proves only what the protected component observed: request,
dispatch boundary, bytes, timing, and local state. For an external action it
cannot independently prove provider processing, commit, visibility, durability,
or later state. HTTP success, CLI exit zero, stdout, adapter/model assertion,
webhook text without authenticated origin, or a locally signed paraphrase is
never a provider receipt.

## Producer trust profile

`ReceiptProducerProfileV1` binds exact provider/tenant/account IDs, endpoint and
TLS identity policy, API/protocol/schema version, authentication source,
credential non-export rule, request/response canonicalization, immutable action
ID fields, idempotency/correlation semantics, provider-status mapping, signed-
receipt verification when available, read-back/query method, pagination/
completeness rules, rate/error mappings, retention, and negative vectors.

Only HP-TC07's protected broker accesses provider authentication. The adapter,
host, model, MCP process, repository, logs, and receipt object never receive the
authentication material. Endpoint aliases, redirects, tenant/account inferred
from display text, unverified certificates, host-controlled proxy roots,
partial/paginated responses, unknown API versions, or schema fallback reject.

Where a provider supplies a cryptographically signed receipt, the profile binds
algorithm, protected trust roots, key ID/rotation/revocation, signature
transcript, and exact signed facts. Where it does not, the maximum honest claim
is `AUTHENTICATED_PROVIDER_OBSERVATION`: the protected broker captured a
schema-valid response over the qualified authenticated channel and re-queried
the same tenant/immutable action ID. It is operational evidence, not portable
nonrepudiation, and the receipt records that assurance level.

## Acyclic evidence and correlation

The operation result is finalized/addressed before `OperationReceiptV1`, as
fixed by HP-TC01. The receipt then binds that immutable `resultDigest`; the
result never embeds the receipt digest.

`ProviderReceiptEvidenceV1` is a closed/domain-addressed object binding:

```text
schemaId, schemaVersion, schemaSetDigest, producerProfileDigest,
providerId, tenantDigest, accountDigest, endpointIdentityDigest,
operationId, operationClassId, requestDigest, semanticEffectDigest,
idempotencyKeyDigest, providerAttemptDigest, immutableProviderActionIdDigest,
providerStatusId, canonicalFactSetDigest, rawProtectedResponseDigest,
channelObservationDigest, providerSignatureDigest|null,
readBackEvidenceDigest|null, observedAt, providerReportedAt|null,
trustedTimeSampleDigest, assuranceLevel
```

Provider time is an observed fact and never replaces HP-TC03 authoritative
time. Raw request/response bytes remain in bounded protected evidence storage;
only their digest and typed allowlisted facts enter durable/model-visible
records. Unknown/free-form fields cannot influence terminal status.

`ProtectedDispatchAuditV1` binds authority envelope, request/effect/
idempotency/attempt, exact serialized outbound body digest, tenant/target/
endpoint, producer profile, pre-dispatch fence, `DISPATCH_STARTED` transition,
transport outcome, bounded response digest or null, and trusted times. It
cannot prove provider success, but exact equality of every correlation field is
required before a provider observation may be joined to the attempt.

`OperationReceiptV1` contains the already validated HP-TC01 fields. For local
read/advisory, `localAuditDigest` is non-null and provider evidence is optional
according to profile. For local write, `localAuditDigest` addresses the HP-TC08
evidence and is mandatory. For external effects, both the protected dispatch
audit and provider evidence are mandatory; `producerReceiptDigest` addresses
the provider object. Nullability/status invariants reject every other shape.

Correlation is exact over operation, class, tenant/account, target/audience,
request, semantic effect, idempotency key, attempt, provider action ID, active
set/policy/fence, and producer profile. A receipt for another retry, branch,
repository, issue, deployment, account, environment, or provider is unrelated
even when human descriptions match.

## Reconciliation protocol

After durable `DISPATCH_STARTED`, absence/loss of an admissible response is
possibly acted. HP-TC03 records `OUTCOME_AMBIGUOUS` and invokes the exact
`ReceiptReconciliationProfileV1`, which binds query endpoint/method, immutable
action-ID or idempotency-key lookup, request correlation, bounded attempts,
backoff, total deadline, completeness/page rules, admissible terminal states,
and no-effect proof when the provider can supply one.

Reconciliation is read-only. Repeating the action-capable call is forbidden
unless the producer profile proves that the exact same provider idempotency key
is a query-or-return-existing primitive and the protected attempt/effect scope
is unchanged. Even then, the profile calls it reconciliation, not retry, and
records every response. A new nonce, attempt, session, active set, or user
"continue" cannot resend the same effect.

Provider eventual consistency never maps "not found" to not acted unless the
qualified profile supplies a complete authoritative negative query after its
documented maximum visibility window. Rate limit, incomplete pagination,
unavailable query, ambiguous status, expired credentials, or deadline leaves
the effect `AMBIGUOUS`. It does not become failed/safe-to-retry.

Conflicting original response, webhook, signed receipt, query, or later resource
state produces `CONTRADICTORY` and HP-TC04/05 quarantine input. The evaluator
does not choose the latest, majority, most favorable, or highest-status fact.

## Deterministic receipt evaluation

`ReceiptEvaluationV1` returns exactly:

```text
PROVEN_SUCCEEDED | PROVEN_FAILED | PROVEN_DENIED |
AMBIGUOUS | CONTRADICTORY | UNAVAILABLE | INVALID
```

Precedence is `INVALID`, `CONTRADICTORY`, `AMBIGUOUS`, `UNAVAILABLE`, then the
three proven terminal states. All applicable reason codes remain. A proven
terminal state requires one exact profile mapping and all mandatory channels;
unrecognized/transitional provider states are ambiguous, not success.

- `PROVEN_SUCCEEDED` requires authenticated provider/local post-state facts that
  exactly satisfy the operation's registered success predicate.
- `PROVEN_FAILED` requires authenticated terminal failure facts and does not by
  itself prove that no partial effect exists unless the profile says so.
- `PROVEN_DENIED` requires authenticated pre-effect denial or local protected
  no-dispatch evidence.
- `AMBIGUOUS` means the action may have occurred or terminal/partial state is
  not provable.
- `CONTRADICTORY` means admissible facts conflict.
- `UNAVAILABLE` means mandatory producer/observer/read-back evidence cannot be
  obtained.
- `INVALID` means schema/signature/channel/correlation/revocation/integrity
  validation failed.

The resulting immutable evaluation, receipt, and reason trace are appended to
the protected receipt log before `OperationResultV1` is released. For external
effects, only a proven terminal evaluation may support corresponding terminal
result status. Ambiguous/contradictory/unavailable/invalid maps the attempt to
ambiguity/reconciliation and blocks same-effect redispatch.

Cancellation before protected `DISPATCH_STARTED` may use local audit to prove
no dispatch. Cancellation, timeout, process death, or policy revocation after
that transition cannot erase provider evidence or assert not acted. It follows
the same reconciliation rules.

## Rotation, revocation, retention, and historical verification

Producer trust/signature profiles, endpoint roots, adapter versions, and
receipt schemas are content-addressed and retained with every receipt. A new
profile never reinterprets old bytes. Historical validation uses the exact
profile/root valid for the observation plus current revocation records.

Revocation binds producer/profile/key, exact invalid-from time, reason, evidence
epoch, and protected anchor. New evaluations immediately reject affected
evidence; caches and earlier local summaries cannot override. Compromise may
retroactively invalidate the declared interval and convert an earlier terminal
evaluation into quarantine input, but it never deletes the original record.

Receipt/evidence retention is at least the maximum of provider query/
idempotency windows, HP-TC03 ambiguity retention, operation audit policy, and
any unresolved effect. A protected non-replay tombstone survives archival.
Deletion policy may archive protected raw bodies after their retention window
only if typed facts, digests, trust closure, correlation, terminal evaluation,
and tombstone remain sufficient for the registered audit claim. An unresolved
ambiguous/contradictory effect is not deleted into retry eligibility.

## Stable failures and diagnostics

The closed reason families are `KSTACK_RECEIPT_PROFILE_*`,
`KSTACK_RECEIPT_PRODUCER_*`, `KSTACK_RECEIPT_CHANNEL_*`,
`KSTACK_RECEIPT_SIGNATURE_*`, `KSTACK_RECEIPT_CORRELATION_*`,
`KSTACK_RECEIPT_STATUS_*`, `KSTACK_RECEIPT_READBACK_*`,
`KSTACK_RECEIPT_REVOKED`, `KSTACK_RECEIPT_AMBIGUOUS`,
`KSTACK_RECEIPT_CONTRADICTORY`, `KSTACK_RECEIPT_UNAVAILABLE`, and
`KSTACK_RECEIPT_INVALID`. Concrete codes are HP-TC01 registry-owned.

Public/model-visible diagnostics contain fixed text, safe IDs/statuses/counts,
and correlation digests only. Raw provider/request/response text, URL query,
path, tenant/account label, principal, environment, exception, authentication
material, approval, key, or protected receipt bytes are excluded.

## Deterministic verification design

Golden vectors freeze producer profiles, outbound/correlation digests, provider
evidence, local audits, `OperationReceiptV1`, reconciliation plans, trust-root/
revocation objects, all seven evaluations, reason traces, and safe diagnostics
across independent Node and native/Rust implementations.

Class-matrix fixtures try local-only success for every external action; process
exit/stdout/HTTP status as receipt; provider receipt for the wrong tenant,
target, request, effect, key, attempt, branch/issue/deployment, account, profile,
active set/policy/fence, or operation class; missing mandatory channel; and a
background task completion without its underlying receipt.

Producer fixtures cover TLS/endpoint/root substitution, redirects, proxy-root
injection, API/schema downgrade, partial pagination, unknown fields/status,
forged/bad/rotated/revoked signatures, display-name identity, provider-time
rollback, raw-body/canonical-fact mismatch, immutable-ID reuse, and protected
authentication leakage.

Reconciliation fixtures make the provider act then drop the response, not act,
delay visibility, return not-found before/after the authoritative window,
rate-limit, lose pages, contradict a webhook/query/signed receipt, process the
same key twice, and expose no safe lookup. They prove no blind retry and no
ambiguous-to-failed/success shortcut.

Concurrency/crash tests stop before/after `DISPATCH_STARTED`, provider action,
response capture, protected audit append, query, receipt append, evaluation,
result release, revocation, and archival. They race policy/fence/profile/tenant/
endpoint changes and prove immutable historical interpretation plus immediate
restriction. Property tests prove no local-only evidence proves an external
effect and no nonterminal/unknown/conflicting fact maps to a proven terminal
state.

Tests use fake/disposable providers and synthetic identities only; no production
credential or target is used.

## Review request

Review HP-TC10 only for per-class receipt sufficiency, honest local-versus-
provider proof boundaries, exact producer/correlation trust, acyclic receipts,
read-only ambiguity reconciliation, deterministic terminal mapping, and
revocation/retention behavior. Closure requires Codex 93+ and empty failed,
security, dissent, and question arrays.

Do not review or close HP-TC11/12, invoke Opus, inspect/edit files, use tools,
implement, use credentials, call a provider, perform an external action, commit,
push, deploy, publish, or edit reports.
