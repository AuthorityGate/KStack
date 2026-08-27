# Memory slice 3: scoped GitHub/Jira ingestion and reconciliation

**Depends on slice 1:** `6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4`  
**Depends on slice 2:** `9b8e303f8a7cbe1a2c7adac7b22e79f8e9aea5131b448175ab7dda499c2d206d`  
**Status:** design review required  
**Authority:** design only; connectors are read-only; no external mutation

## Boundary

Git/GitHub supplies approved versioned KStack artifacts. Jira supplies only
allowlisted ticket/workflow/release fields. Connectors can read; they cannot
comment, transition, edit, create, delete, label, merge, commit, push, release,
deploy, or register webhooks. Jira prose is untrusted. No model path exists.

## Closed connector configuration

Configuration is owner-authored, schema-closed, and digest-bound to repository
policy generation. Unknown fields/wildcards deny.

`ProviderOriginV1 = {kind, stableProviderId, scheme:"https", canonicalHost,
port:443, networkZone, allowedCidrs, proxyOrigin|null, tlsPolicyDigest}` is an
owner-approved registry record bound to policy generation. Creation first
authenticates to the named origin, reads the stable repository/site ID, and
requires it equal `stableProviderId`; later runs require the same mapping.
Content/provider responses cannot create or change this registry.

`networkZone=public-only` rejects loopback, RFC1918/ULA, link-local, multicast,
documentation, unspecified, and reserved A/AAAA answers. `private-allowlist`
admits only exact owner-configured CIDRs but still always rejects link-local
metadata ranges. Each request resolves all answers, validates every answer,
pins one validated IP for the connection, sends TLS SNI/certificate validation
for `canonicalHost`, and verifies peer IP. DNS change causes a new full check;
mixed allowed/denied answers deny. Environment proxies are ignored. An explicit
proxy is a separate owner-approved `ProxyOriginV1` registry record with HTTPS
host/port, network zone/CIDRs, TLS policy digest, and credential handle. Its DNS
answers/peer IP/certificate are validated and pinned by the same rules. The
proxy transport may issue only `CONNECT canonicalHost:443`; provider
credentials are sent only inside the end-to-end provider TLS tunnel and proxy
credentials only to the validated proxy. Redirects are at most one and same scheme/host/port; cross-origin,
downgrade, credential-bearing URL, and peer mismatch deny before forwarding
credentials.

`GitSourceV1 = {repoId, providerRepositoryId, originRegistryId, refMode, refValue,
pathAllowlist, artifactClassByPath, maxBytes, pollSeconds}`.

- `refMode` is `immutable-commit` or `tracked-ref`. Immutable requires 40-hex.
  Tracked ref is a fully qualified `refs/heads/...` or `refs/tags/...`, owner
  configured, never derived from content; each poll resolves it to a full commit
  before reading.
- Paths use slice-1 canonical path bytes; entries are exact files or bounded
  trailing-`/**` prefixes. At most 1,024 entries, no root wildcard, deny entries
  take precedence, and each accepted path maps to one approved artifact class.
- Per-file cap is 1 MiB by default and at most 4 MiB; aggregate staged bytes per
  run are at most 64 MiB and 10,000 files. Symlinks, submodules, LFS pointer
  expansion, archives, devices, and non-blob tree entries deny. An LFS pointer
  may be indexed only as pointer text under an explicit artifact class.

`JiraSourceV1 = {siteId, originRegistryId, projectIds, issueScope, fieldSetId,
freshForSeconds, serveForSeconds, maxIssues, pollSeconds,
reconciliationScope|null, removeOnScopeExit}`.

- Stable site/project/issue IDs are verified from authenticated responses.
- `issueScope` is an explicit issue-ID set or KStack-owned JQL template whose
  only substitutions are validated project IDs and a stored watermark. Jira
  text cannot become JQL. At most 10 projects/10,000 issues per run.
- The versioned field set defines exact field IDs, scalar/array/leaf projection
  types from slice 1, per-field 1 MiB and observation 4 MiB caps, and redaction/
  retention/sensitivity. Description/comment/attachment/worklog and arbitrary
  custom fields are excluded unless individually owner allowlisted. Credentials,
  rendered HTML, remote media, and attachment bodies are always excluded.
- `reconciliationScope` is separately owner-approved. It is either an exact
  issue-ID set or explicit project IDs with `browse-all-issues` probe, cadence
  300-86,400 seconds, and cap <=50,000. It requests only issue ID, project ID,
  key, updated, and membership/security identifiers—never prose. If absent,
  incomplete, over cap, or probe fails, JQL scope exit cannot imply deletion.
  `removeOnScopeExit` requires this scope and explicit owner approval.

Credentials are opaque host-provided handles with read-only least-privilege
scopes. The memory body/catalog/config/audit never stores credential bytes or
environment-variable names. Connector launch resolves the handle through the
existing host secret boundary, sends it only to the exact canonical TLS origin,
disables redirects across origin, and redacts headers/errors before KStack sees
them. Authentication/scope is probed with a content-free endpoint before a run;
failure retries only transient classes and then stops unavailable—it never
widens scope or asks retrieved text for credentials.

## Receipt-first staging pipeline

Every run obtains an `ingest` capability, shared policy lease, random run ID,
configuration digest, start policy generation, and content-free intent receipt
before network access. Egress is limited to the configured provider origin.
The application-request inventory is statically `GET`/`HEAD` only. When an
approved `ProxyOriginV1` is present, the separate proxy-transport inventory is
statically one `CONNECT canonicalHost:443`; it carries no provider request or
provider credential outside the resulting end-to-end provider TLS tunnel.
Response bodies go to a mode-0600 private staging directory outside Git and
ordinary logs.

### GitHub acquisition

1. Resolve authenticated repository identity and configured ref to full commit;
   require expected `providerRepositoryId` and `repoId`.
2. Enumerate the commit tree with pagination and hard caps. Apply path deny then
   allow rules before any blob fetch.
3. Fetch each blob by immutable object/commit endpoint, require no redirect to
   another origin, strict length/UTF-8/artifact-class rules, and verify provider
   blob OID plus local SHA-256.
4. Build the slice-1 Git locator and stage exact original bytes. A ref move
   cannot mix bytes because reads use the initially resolved commit. For
   `tracked-ref`, activation re-resolves the ref; any change discards staging
   and restarts from the successor rather than activating the old commit.
   `immutable-commit` has no ref recheck.

### Jira acquisition

1. Verify site/project identities and obtain a TLS-authenticated Jira server
   time (response Date plus server-info agreement within 5 seconds). Freeze it
   as `upperUpdated`; clock disagreement stops unavailable.
2. Use keyset JQL fixed by KStack: configured scope AND `updated >=
   lowerUpdated` AND `updated <= upperUpdated` AND (`updated > lastUpdated` OR
   (`updated = lastUpdated` AND `id > lastId`)) ORDER BY `updated ASC, id ASC`.
   `lowerUpdated` is prior completed upper bound minus 5 minutes; first last
   tuple is lower bound with ID zero. Request only allowlisted/stable fields.
3. Each page must strictly increase `(updated,id)`, contain unique stable IDs,
   remain <= frozen upper bound, honor caps, and use exact origin/content type.
   Offset pagination is forbidden. Mutation moving an issue past upper bound is
   caught in the overlapped next window; the watermark advances to
   `upperUpdated` only after every keyset page activates atomically.
4. Project permitted scalars/arrays/leaves through slice-1 `KSF1`; rejected or
   over-limit field shape quarantines the issue, never falls back to raw JSON.
5. Create the required canonical observation snapshot and Jira locator. Compute
   `observedAt` only after the complete authenticated issue response is received.

`freshForSeconds`/`serveForSeconds` inherit slice 1's integer bounds
`60..2,592,000` and require serve >= fresh. `lastVerifiedAt` starts when a full
authenticated issue read with identical selected-field digest completes; it may
advance without changing immutable snapshot `observedAt`. Using slice 1's
trusted wall/monotonic clock: age <= fresh is fresh; fresh < age <= serve is
stale; explicit connector failure within serve is unavailable; age > serve is
expired and omitted. Successful identical verification returns fresh. Failure,
partial pagination, clock regression, or unverified scope never extends either
window. Catalog transition and the content-free verification receipt commit
atomically; Slice 2 consumes these exact states through `allowStale`.

Before activation, each staged artifact passes strict UTF-8/JSON rules as
applicable, shared credential/secret patterns, high-entropy screening, and a
versioned injection-pattern detector. A secret finding quarantines exact bytes
with no content in receipt. Injection findings may be admitted only under an
owner policy that preserves `UNTRUSTED_RETRIEVED_DATA`; they can never alter
configuration, field/path scope, capability, connector, or logs. Scanner
failure/timeout is quarantine, not pass.

Staging manifest entries bind run/config/repo/policy IDs, authority locator,
source/content/canonical-metadata digests, byte count, scanner versions/results,
freshness inputs, prior lineage, and intended operation (`activate`,
`supersede`, `observe-missing`). Manifest entries contain no body excerpt.

Activation acquires the repository exclusive lease, rechecks capability,
policy/config generation, grant/revocation, current ref observation only for
`tracked-ref`, source
identity, tombstone epoch, and every staged digest. It promotes body snapshot,
catalog record, and source watermark in one transaction or none. Slice 2 sees
only the new committed source set and builds a separate generation. Staging is
purged after commit/failure; quarantine is encrypted and retention-bound under
slice 4 before production enablement, otherwise production ingestion denies.

## Change detection, deletion, and recovery

Watermark state is provider-specific and non-authoritative:

- Git tracked ref: last resolved commit plus sorted activated path/blob/content
  digest set. A new commit produces per-path unchanged/add/change/missing by
  comparison; rename is missing+add unless exact blob/content permits a
  content-preserving alias receipt. Force-push never mutates old locators.
- Jira's sole persistent watermark is `completedUpperUpdated`, the frozen
  server-time upper bound of the last fully activated keyset window. Each run
  uses the fixed `lowerUpdated = completedUpperUpdated - 5 minutes`; the
  overlap is not configurable. `(lastUpdated,lastId)` is only the transient
  keyset cursor for that run. A checkpoint may persist that cursor only when it
  is bound to the run ID, configuration/policy digests, and exact frozen
  lower/upper bounds; it never becomes or advances the completed watermark and
  is invalid after any bound input changes. Results deduplicate by stable issue
  ID/revision/digest and order by `(jiraUpdated,issueId)`. Only the atomic
  activation after every page advances `completedUpperUpdated` to that run's
  frozen `upperUpdated`; failure leaves it unchanged.

Polling is the portable baseline. External webhooks may only enqueue a
content-free hint for an earlier full poll; they are untrusted, optional, and
cannot carry source bytes or activate state. This slice does not create/register
webhooks.

An authoritative absence is accepted only when a complete, authenticated,
non-truncated enumeration of the configured authority scope succeeds twice in
separate polls no earlier than the configured reconciliation cadence and never
less than 300 seconds apart. For Jira scope
exit, both polls must use the separately approved `reconciliationScope`, pass
its browse-all probe, request only its minimal fields, remain under its cap, and
show the issue absent or outside configured membership. If the scope is absent,
over cap, partial, or unauthorized, the record becomes unavailable but no
missing/deletion observation is emitted. Permission errors, rate limits,
partial pages, ref deletion, or outages are never deletion.

Confirmed absence with `removeOnScopeExit` emits `observe-missing` for slice
4's tombstone transaction; until that commits the old record is unavailable and
cannot serve. Reappearance cannot reactivate an older lineage. A Jira deletion
claim means only the authorized local snapshot lineage is purged/suppressed;
it never claims Jira itself was changed.

Runs are idempotent on `(repoId, authority locator, contentSha256,
configDigest)`. Duplicate delivery returns the existing record/receipt and does
not reset `observedAt`, retention, or activation epoch. A newer Jira observation
with identical selected bytes records freshness verification separately without
manufacturing a new content record. Conflicting bytes for the same immutable
Git locator quarantine the source and disable its active generation.

Retries use full-jitter exponential backoff for connect timeout, 408, 429 with
`Retry-After`, and 5xx: 1s/2s/4s, at most 3 retries and 30s each, with a
10-minute run deadline. For a valid nonnegative `Retry-After`, the exact delay
is `min(parsedDelay,30 seconds)`, so values above 30 seconds wait 30 seconds and
30 itself is accepted. If that capped delay exceeds the remaining run time,
the run instead checkpoints unavailable without sleeping past its deadline.
Invalid, negative, or past-date values use jitter. 400/401/403/404 and schema/digest errors do not retry
except the two-poll absence protocol. Rate-budget exhaustion checkpoints the
content-free cursor and reports unavailable; resume revalidates configuration,
policy, scope, and already staged digests before continuing.

Crash recovery enumerates private staging runs. It never trusts their manifest
alone: it reauthorizes, re-hashes all bytes, rechecks scanners/source/config/
tombstones, and either activates once or purges. Watermarks cannot advance
without the matching atomic activation receipt. Doctor reports identity/scope,
last successful full poll, freshness, quarantine counts/reasons, rate state,
and recovery state without source text or credentials.

## Acceptance and rollback

1. GitHub identity/ref/path/blob fixtures cover rename/transfer, force-push,
   pagination, symlink/submodule/LFS/archive/oversize denial, conflicting
   immutable bytes, and exact locator/digest readback. A tracked-ref change
   after staging always discards that staging and restarts from the successor;
   the old resolved commit never activates. Immutable-commit mode is unaffected
   by an external ref change.
2. Jira fixtures cover stable IDs versus labels, fixed JQL substitution,
   allowlisted scalar/array/leaf shapes, field/issue/page caps, identical-content
   freshness verification, revision tie ordering, and required snapshot bytes.
3. Static/dynamic network inventory separately proves provider application
   requests are only GET/HEAD to the exact configured provider origin and an
   approved proxy transport can issue only CONNECT to that exact provider
   host:443. Redirects, DNS/origin mismatch, webhook mutation, and every
   provider write endpoint/method deny. Fixtures include provider and proxy DNS
   rebinding, mixed public/private answers, IPv4/IPv6, metadata/link-local,
   explicit private CIDR, proxy certificate/SNI/peer validation and credential
   separation, tunneled provider TLS SNI/certificate/peer, stable-ID mismatch,
   and same/cross-origin redirect.
4. Credential fixtures prove handles/headers/env names/values cannot reach
   config, body, staging manifest, catalog, receipts, doctor, errors, or logs.
5. Secret/injection/scanner crash/timeout fixtures quarantine or preserve
   untrusted labeling without changing policy, query, connector, or activation.
6. Crash schedules at every fetch/page/stage/scan/lease/transaction step prove
   all-or-none activation, idempotency, and watermark non-advancement.
7. Concurrent policy/grant/config/tombstone changes before activation deny the
   stale run. A tracked-ref change uses the mandatory discard-and-successor
   restart in fixture 1, while immutable-commit mode has no ref recheck. Slice 2
   cannot observe a partial source set.
8. Two complete absence polls create one missing observation; 401/403/404,
   partial pages, rate limits, issue security change, and outage never delete.
   JQL membership exit denies deletion without reconciliation authority; minimal
   authorized reconciliation succeeds, while cap/probe/cadence failure denies.
9. Reappearance/older poll/replayed staging cannot resurrect a missing/deleted
   lineage or reset timestamps/retention.
10. Backoff/Retry-After/deadline/rate-resume vectors use a fake clock and prove
    bounded attempts, content-free checkpoints, and exact revalidation.
11. Linux/macOS/Windows fixtures reproduce canonical snapshots/manifests and
    leave no staging/quarantine plaintext after configured cleanup.
12. Static schema/source inventory rejects model/embedding/vector/semantic/
    reranking/expansion/Ollama fields or paths.
13. Jira keyset fixtures mutate issues before/after page boundaries and upper
    bound; every revision appears in the current or overlapped next run, no
    offset path exists, and watermark never crosses an incomplete window.
14. Fresh/serve exact-boundary, identical verification, outage, partial poll,
    expired omission, and wall/monotonic regression transitions match slices
    1-2 without extending windows.
15. Rollback preserves immutable original receipts, appends one compensating
    disposition chain, purges connector state, and retains crash/idempotency
    evidence under its existing retention.

Rollback takes the exclusive lease, disables connector schedules/hint intake,
cancels runs, purges staged/quarantine bytes and resumable cursors, and rolls
back Slice-3 connector configuration and watermarks. Intent/run/activation/
failure/recovery receipts are append-only under their slice-1 retention and are
never deleted or edited by rollback; rollback appends a compensating disposition
receipt binding every prior run/receipt and purge/retain outcome. Activated source
records remain governed by slices 1/4 and are marked unavailable until an owner
chooses retain or administrative delete; rollback cannot silently delete or
reactivate them. Slice 2 rebuilds from the resulting authorized active set.
Provider state and existing explicit KStack memory are unchanged. The manifest
records every connector/run/stage/quarantine/watermark disposition and any
incomplete cleanup keeps Slice 3 disabled.

## Codex closeout rule

Approve only at confidence 93+ with zero failed checks, security findings,
material dissent, or unresolved questions. At 84-92 fix only concrete Slice-3
defects; accepted slices 1-2 and the no-Ollama architecture remain fixed.
