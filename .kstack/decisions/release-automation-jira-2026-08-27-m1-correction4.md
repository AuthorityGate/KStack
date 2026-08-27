# Release Automation M1 - correction 4 preflight retrieval authorization

**Thread:** `release-automation-jira-2026-08-26`  
**Candidate:** M1 correction 4, Codex-only improvement pass 1  
**Scope:** authentication and abuse controls for `preflight-summary` seed
retrieval only  
**Review floor:** Codex 84 or higher with zero failed checks, zero security
findings, zero material dissent, and zero required unresolved questions  
**Status:** design delta only; no dispatch, implementation, configuration
change, or production activation is authorized

## Decision

`preflight-summary` authenticates to the broker with a GitHub OIDC assertion
bound to the correction-1 run and pinned workflow. After verification, the
broker issues exactly one short-lived, broker-signed
`SeedRetrievalCapabilityV1`. That capability is bound to one release, dispatch
attempt, repository, run, attempt 1, pinned workflow, logical preflight job,
exact `AudienceSeedV1` digest, OIDC `jti`, fixed response size, and expiry. The
same job immediately redeems it once through an atomic compare-and-set.

There is no public seed lookup, listing, identifier-only fetch, redirect, retry,
or capability renewal. Failure prevents `preflight-summary` from succeeding and
therefore prevents the environment-gated job from becoming an approval-evidence
candidate.

## Bound validated evidence

| Source | SHA-256 |
|---|---|
| Validated correction 1 | `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523` |
| Correction-1 final Codex report | `ae9c8bd95e75832ae82878e5b11d6f437df7b290da2045133484e82db8911749` |
| Correction-1 final Opus report | `9b2a4b47d905c1bab952eba0801243789912d367451b1f4d7e3b80d6de517445` |
| Validated correction 2 | `a217f92d67f4cdee5deb178c9855c7de9ccb243cec12890b097c81ca86783e16` |
| Correction-2 Codex report | `1609ecd8db470a91d6e488f3be7a5aea4ce99c5aca9a8a7b7dac9d7d7b210a29` |
| Correction-2 Codex envelope | `f4aadca289b9e689723dd087c7d02233e3a01d22bb7746e31a4a9d0175cc21e4` |
| Correction-2 Codex manifest | `e1e79a0766279725b35d1980b7e647c6aac997db9a405d6877a13f4c029f1f7b` |
| Correction-2 Opus report | `83265f6ceddefc5860501707c574f9ffe6373f503363ae93e32fc6f0141c1667` |
| Correction-2 Opus envelope | `12420035dcb58c71fd01b009611b917635578fc0eb1b0eadc2126e47c70f9157` |
| Correction-2 Opus final manifest | `3709f306aeab3098e38e96fb1bd847187e6945a1698c954acd3b4ae7c0463c81` |
| Review-routing amendment | `874e66cf3af2dd8dc7956db73e35a3fcd7030f4bd92fb4fdc9196bf624e295f6` |

Correction 1 passed 97/87 and correction 2 passed 95/87, each with zero defects
on the final shared digest. Both remain frozen.

## Frozen scope

| Item | Status here |
|---|---|
| M1 corrections 1 and 2 | `PRESERVED_VALIDATED` |
| M1 correction 3 - Q1-neutral approver predicate/posture | `OPEN_UNCHANGED` |
| M1 correction 5 - provider-side review-comment normalization fixture | `OPEN_UNCHANGED` |
| M2, M3, M4, M5, M6, M7 | `OPEN_UNCHANGED` |
| Q1, Q2, Q3 | `OPEN_UNCHANGED` |

## Exact job identity and capability mint

The dispatch inputs expose only closed typed `releaseId` and
`dispatchAttemptId` selectors. They confer no authority. `preflight-summary`
has `id-token: write` and every configurable repository permission set to
`none`. It requests one bootstrap OIDC token with:

```text
aud = "kstack-preflight-cap:v1:" + BASE64URL_NOPAD(SHA256(UTF8(JCS({
  "brokerAudience": <enrolled broker service ID>,
  "dispatchAttemptId": <closed selector>,
  "jobRole": "preflight-summary",
  "operation": "mint-seed-retrieval-capability",
  "protocol": "kstack-preflight-retrieval/v1",
  "releaseId": <closed selector>,
  "repositoryId": <native repository_id>,
  "runAttempt": 1,
  "runId": <native run_id>,
  "workflowRef": <native workflow_ref>,
  "workflowSha": <native workflow_sha>
}))))
```

The broker verifies signature, exact issuer/audience/subject, allowed key and
algorithm, time, `jti`, native `repository_id`, `run_id`, `run_attempt == 1`,
`workflow_ref`, and `workflow_sha`. These must match the correction-1 dispatch
journal, enrolled repository/control ref, and pinned workflow SHA. A native
`environment` claim or environment-form subject is rejected because this job is
the non-environment predecessor.

GitHub does not supply a native job-name claim here. Exact logical job identity
is the conjunction of the pinned workflow SHA/ref, correction-1-bound run,
attempt 1, non-environment subject, fixed `jobRole`/operation audience, and the
permission manifest in which only `preflight-summary` may request this audience.
A changed workflow changes `workflow_sha`; the environment-gated job has a
different subject/native environment posture and cannot mint this capability.

After all checks, the broker derives the exact signed correction-2
`AudienceSeedV1`, hashes its canonical bytes, creates a random 128-bit
capability nonce, and returns one domain-separated broker-signed object:

```text
SeedRetrievalCapabilityV1 = {
  "audienceSeedDigest": <sha256 of exact signed seed bytes>,
  "capabilityId": <base64url 128-bit random nonce>,
  "dispatchAttemptId": <bound attempt>,
  "expiresAt": <bounded UTC instant>,
  "jobRole": "preflight-summary",
  "keyGeneration": <broker signing generation>,
  "maxResponseBytes": 16384,
  "notBefore": <broker issue time>,
  "oidcJtiDigest": <domain-separated sha256 of verified jti>,
  "protocol": "kstack-seed-retrieval-capability/v1",
  "releaseId": <bound release>,
  "repositoryId": <bound numeric repository>,
  "runAttempt": 1,
  "runId": <bound numeric run>,
  "workflowRef": <bound workflow ref>,
  "workflowSha": <bound workflow SHA>,
  "signature": <broker signature over all preceding canonical fields>
}
```

`expiresAt` is the earliest of bootstrap OIDC `exp`, release approval-window
expiry, and `notBefore + 120 seconds`. Clock validation uses the inherited JWT
skew bound; the capability itself gains no additional grace. The broker stores
only a digest of `capabilityId`, its full bound tuple, expiry, and state
`ISSUED`. It issues at most one capability for that tuple and OIDC `jti`.

## Single-use redemption

The only retrieval route is authenticated `POST /v1/preflight-seeds/redeem`.
Its closed request contains the signed capability and the same bootstrap OIDC
token. The capability is never placed in a URL, query, path parameter, cookie,
log, workflow name, or public artifact.

The broker repeats token verification, verifies capability signature and every
bound equality, and recomputes `oidcJtiDigest`. For an authenticated,
otherwise-valid capability, it then reloads the exact signed seed and requires
its digest and encoded length to match. A missing seed or any mismatch performs
one durable CAS from `ISSUED` to terminal `BURNED`, keyed by the capability-ID
digest and full bound tuple, before returning the fixed denial. `BURNED` is
irreversible: later restoration, regeneration, or discovery of matching bytes
cannot redeem or reissue that capability. A matching seed instead performs one
durable CAS from `ISSUED` to `REDEEMED` on the same key. Exactly one concurrent
state transition may win. Losers receive the same fixed denial as every other
authorization failure and never receive seed bytes.

The endpoint's one-redeem-in-flight limit is a separate atomic admission lease
for availability only. It cannot read or mutate capability state and never
authorizes or releases seed bytes. The durable CAS in the production state
module remains the sole authority: only its unique `ISSUED -> REDEEMED` winner
returns an unforgeable in-process release permit, and response construction
requires that permit. Incorrect or absent admission serialization therefore
cannot replace or weaken the CAS.

CAS completes before response bytes are released. A crash or lost response
after CAS burns the capability; it is not reset, replayed, reissued, or searched
for. The preflight job fails and the inherited workflow gate stays closed. A
fresh release requires the inherited explicit-human path; availability never
weakens authorization.

## Closed transport and response bounds

| Surface | Request maximum | Success response | Denial response |
|---|---:|---:|---:|
| capability mint | 32 KiB total body; one seed selector and one OIDC token | exactly 4096 bytes, padded, no compression | HTTP 404 with exactly 512 redacted bytes |
| seed redemption | 32 KiB total body; one capability and the same OIDC token | exactly 16384 bytes, padded, no compression | HTTP 404 with exactly 512 redacted bytes |

The success wrapper contains protocol, exact content length, signed seed bytes,
and random padding; parsing rejects a seed over 8192 bytes. Padding carries no
meaning. Both endpoints require HTTPS at the fixed enrolled broker origin,
disable redirects, set `Cache-Control: no-store`, and accept only JSON/UTF-8 in
the closed request. `GET`, `HEAD`, listing, prefix search, status-by-ID, batch,
wildcard, and identifier-only lookup routes do not exist and return the same
fixed denial.

Every authorization failure exposes only `RETRIEVAL_DENIED` and a random public
correlation ID in the fixed body. Detailed fixed reason enums remain only in
redacted broker-local evidence. No response or log contains release ID, run ID,
repository, seed/capability digest, nonce, expiry, OIDC claim, protected value,
or whether a candidate exists.

The retrieved `AudienceSeedV1` is the non-secret, signed packet defined and
validated by frozen correction 2. `preflight-summary` writes its unchanged
bounded base64url bytes only to the GitHub Actions environment file that backs
the job's single declared `jobs.<id>.outputs` value; only the pinned
`approval-evidence` job consumes it through `needs`. It is never printed,
placed in summaries/artifacts/caches, or sent elsewhere. GitHub output transport
is not an authority boundary: correction 2 independently verifies signature,
generation, canonical bytes, digest, and every binding before use.

Capability signing generations have three states: `ISSUING`, `VERIFY_ONLY`, and
`REVOKED`. Rotation moves the prior generation to `VERIFY_ONLY` through at least
the latest capability expiry and new capabilities use only the new `ISSUING`
generation. Redemption accepts the exact bound generation while it is
`ISSUING` or unexpired `VERIFY_ONLY`. Revocation is immediate; an authenticated,
otherwise-valid capability under a `REVOKED` or prematurely absent generation
atomically moves `ISSUED -> BURNED` and never releases bytes. Generations are
never inferred, substituted, or fetched from caller input.

## Resource limits

Limits are enforced before response construction and never trigger fallback:

| Scope | Rate | Accepted bytes | Concurrency/state |
|---|---:|---:|---:|
| bound release/dispatch/run tuple | at most 4 authenticated mint-or-redeem requests per rolling 10 minutes | at most 128 KiB total bodies per rolling 10 minutes | one mint in flight, one redeem in flight, one issued capability, one successful CAS |
| verified repository ID | at most 120 authenticated mint-or-redeem requests per rolling 10 minutes | at most 2 MiB total bodies per rolling 10 minutes | 8 requests in flight and 32 unexpired issued capabilities |

The stricter applicable limit wins. Body-size rejection occurs during bounded
streaming parse before JSON materialization or signature work. Repository and
release counters are charged only after the OIDC signature and exact enrolled
repository/run selectors verify, so unauthenticated guesses cannot burn a named
release budget. Pre-verification traffic remains under the broker's fixed global
ingress ceiling but cannot allocate per-release state.

Limit excess returns the same 512-byte denial, never reports remaining quota,
and never changes `ISSUED` to `REDEEMED`. There is no client retry loop. Ordinary
protocol execution uses one mint and one redemption request.

## Threat model

| Threat | Control | Residual/fail-closed result |
|---|---|---|
| Confidential summary/seed disclosure | HTTPS fixed origin, OIDC proof, signed single-use capability, no-store, no logs/URLs, fixed-size wrapper | compromise of the running trusted job remains outside transport protection; all failures disclose no seed |
| Release/run enumeration | no public GET/list/status route; selector alone is useless; uniform 404/redacted fixed body | timing/resource exhaustion is limited and reveals no existence field |
| Request flooding | body caps, streaming parse, per-release/repository rates, concurrency and outstanding-cap ceilings | excess traffic may deny availability but cannot open the gate |
| Capability replay | token-bound `jti` digest, expiry, full tuple, durable one-winner CAS | replays and concurrent losers get fixed denial |
| Capability theft without OIDC token | redemption requires same verified token and `jti` | stolen capability alone is unusable |
| Wrong job or workflow | pinned workflow ref/SHA, non-environment subject, native run/repository/attempt, fixed job-role audience | no invented native job-name claim; changed workflow or environment job rejects |
| Redirect or origin substitution | exact enrolled HTTPS origin and zero redirects on both POSTs | any redirect fails without forwarding request material |
| Seed deletion or mismatch before redemption | authenticated otherwise-valid redemption atomically changes `ISSUED` to terminal `BURNED` | preflight and gate fail; restoration or regeneration cannot revive the capability |
| Seed or release record deletion after retrieval | correction 2 later cannot independently reconstruct | M1 cannot become valid; local loss event is recorded |
| Broker/JWKS/network unavailable | no unauthenticated or cached fallback | preflight fails; no summary/gate candidate |
| Crash after CAS before response | CAS is irreversible for this capability | availability loss; no replay or second response |
| Error-detail leakage | fixed public code/body; detailed local enums redact all protected values | operator uses correlation ID with protected local access only |

Deletion never creates proof of nonexistence and never permits regeneration under
the same capability. Availability failure cannot be converted to an anonymous
read, a longer expiry, a second capability, or an environment-gate bypass.

## Permission boundary

`preflight-summary` has exactly `id-token: write`; every current and future
configurable repository scope defaults to `none`. It performs no checkout and
receives no GitHub App, broker, target, Jira, or stored authentication material.
Its only outbound destinations are GitHub's official OIDC endpoint and the two
fixed broker POST routes. The broker capability service reads protected local
records and official issuer JWKS only; it has no provider or target mutation.

The bootstrap OIDC `jti` has one protocol lifecycle: one successful mint moves
it to `CAPABILITY_ISSUED`; one successful redemption CAS moves it to `CONSUMED`;
and a missing/mismatched bound seed moves it to terminal `BURNED`. Repeated
mint, redemption before mint, multiple capabilities, or any use after
`CONSUMED` or `BURNED` denies. Presenting the same assertion for its one bound
redemption is the defined second leg, not general replay.

## Required deterministic and target fixtures

1. Happy path: exact native claims and journal correlation mint one capability;
   one redemption returns a 16384-byte wrapper whose seed digest equals the
   correction-2 signed seed, and the job emits the unchanged seed.
2. Identity matrix: wrong issuer, key, signature, audience, subject, repository
   ID, run ID, attempt, workflow ref/SHA, time, `jti`, release/attempt selector,
   environment claim, and environment-form subject each deny.
3. Role isolation: only the pinned non-environment preflight permission layout
   passes; the environment-gated job and changed workflow SHA deny.
4. Capability matrix: mutate every signed field, signature, key generation,
   seed digest, `jti` digest, time bound, response bound, and capability ID;
   each denies with no seed bytes.
5. CAS concurrency: a storage-level harness invokes the exact compiled
   production capability-state transition function directly 32 times in
   parallel with one prevalidated immutable redemption context and matching
   seed. It bypasses only the HTTP ingress/admission limiter—there is no test
   implementation, flag, alternate state path, or production configuration
   change. Assert exactly one `ISSUED -> REDEEMED` transition, one in-process
   release permit, and one seed-byte release authorization; the other 31 calls
   lose the CAS and cannot construct a response. Separately, the public-route
   fixture proves the one-in-flight admission lease and request-rate limits
   reject excess calls without state mutation or a release permit.
6. Crash points before CAS, after CAS, and during response write prove that only
   pre-CAS failure leaves `ISSUED`; no lost-response path returns a second seed.
7. Expiry boundaries around not-before/expiry and each inherited earlier expiry
   prove there is no grace, renewal, or reissue.
8. Transport bounds: mint success is 4096 bytes, redemption success 16384,
   every denial 512, compression/redirect/cache disabled, seed over 8192 and
   body over 32 KiB rejected before unbounded allocation.
9. Enumeration: unsupported methods, guessed IDs, prefixes, listing/status,
   absent/existing releases, and malformed selectors share one public denial.
10. Flooding: exact release/repository rate, byte, concurrency, and outstanding-
    capability boundaries reject at limit+1 without a state transition;
    unauthenticated guesses cannot charge a verified release counter.
11. Redaction: unique canaries in seed, selectors, claims, capability, and parser
    exceptions never appear in public errors, URLs, metrics, or adjacent logs.
12. Replay/deletion/availability: repeated mint/redeem, capability without its
    matching assertion, deleted seed/intent, service/JWKS outage, and response
    loss all keep the gate closed and create no fallback. For an authenticated,
    otherwise-valid redemption after seed deletion or mismatch, assert the
    atomic `ISSUED -> BURNED` transition; then restore the original exact bytes
    and separately regenerate matching bytes and prove every later redemption
    still denies, state remains `BURNED`, and no replacement capability issues.
13. Both POST routes test `301`, `302`, `303`, `307`, and `308`; no second request
    or authorization/body forwarding occurs.
14. Key rotation: a capability minted just before rotation redeems under its
    unexpired `VERIFY_ONLY` generation; a new capability binds the new
    `ISSUING` generation; and revoking either generation before redemption
    atomically burns its issued capability. Generation substitution, retirement
    after the final bound expiry, and restore-after-revocation all deny without
    seed bytes or replacement issuance.

Fixture evidence stores only fixed classifications, safe digests, counts, and
times. It never stores capability, OIDC value, seed bytes, nonce, protected
selectors, or rejected input. These fixtures augment the inherited Round 3
staging set. Production remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until all
composed fixtures pass on the exact target.

## Rollback and Codex-only review request

If this correction fails, discard it and keep corrections 1 and 2 validated
while correction 4 remains open. Do not change correction 3 or 5, M2-M7, or
Q1-Q3. No code, workflow, provider/Jira state, or configuration changes here.

Codex must review only correction 4 and return decision, confidence, failed
checks, security findings, material dissent, and required unresolved questions.
Approval requires **84 or higher** with zero failed checks, zero security
findings, zero material dissent, and zero required unresolved questions.

Explicitly confirm: retrieval requires one broker-signed single-use capability;
release/run/workflow/preflight-role/seed/expiry correlation is exact; there is
no public lookup/listing; CAS has one winner; responses/errors are fixed and
redacted; resource limits are exact; confidentiality, enumeration, flooding,
replay, deletion, and availability fail closed; validated correction digests
remain unchanged; all frozen items remain open; and
`TARGET_FIXTURE_NOT_YET_QUALIFIED` remains in force.

This packet does not dispatch Codex or Claude, implement code, or authorize any
action outside correction 4.
