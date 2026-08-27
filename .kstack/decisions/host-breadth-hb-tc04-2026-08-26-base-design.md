# HB-TC04: bounded read-only MCP facade

**Thread:** `host-breadth-option-selection-2026-08-26`
**Item:** `HB-TC04` only
**Status:** design candidate; no implementation or host-support claim
**Frozen predecessors:** HB-TC01 `35e78d77bf8512b5d8699965b29e853d9d21477b4da5cabb68f7afaaabbece0c`, HB-TC02 `1a6584834d5b630a70d90bb031b3582b69e0b844b4f66ad2e9435cbfdb5be128`, HB-TC03 `df1cd2d2e5fdcf5e2155c24316265187581d76510a198c6721fb81fb82d48c28`
**Owner architecture:** Option C with the non-copy constraint
**Review route:** Codex only; closure requires confidence 93+ and empty failed/security/dissent/question arrays

## Decision boundary

Add one optional, repository-bound MCP server that exposes only bounded,
non-secret, read-only KStack descriptions through MCP resources. It exposes no
tools, prompts, completions, sampling, roots, logging control, mutation,
approval, credentials, broker operations, installation, dispatch, or network
access. It cannot qualify a host or operation or promote a lifecycle state.

This item does not claim to solve HP-TC09's authenticated-principal or general
MCP-output boundary. Every connection is assigned the least-authority principal
`UNAUTHENTICATED_LOCAL_READER`, and the complete initial resource set is safe
for that principal. Any authenticated, private, ask-tier, or effectful MCP
surface is separately HP-TC09-dependent and absent here.

## Frozen inputs and reuse disposition

The facade consumes only verified content-addressed objects produced by the
frozen HB-TC01 registry/package and protected read-only status snapshots derived
from HB-TC02/HB-TC03 artifacts. It never treats an installed prompt file as
authority and follows a digest only when it resolves exactly once under the
bound `RegistrySetV1`.

No gstack MCP source or bytes are admitted. The component disposition is
`REJECT-NO-APPLICABLE-UPSTREAM-UNIT`: reviewed gstack host registry/generator
patterns provide no such facade. This is a clean KStack-native design; the
repository-level gstack MIT notice and provenance rules remain unchanged.

## Closed facade profile and protocol

`McpFacadeProfileV1` is closed RFC 8785 JSON, externally addressed as
`SHA-256("KSTACK-MCP-FACADE-PROFILE-V1" || 0x00 || RFC8785(body))`, with exactly:

```text
schemaId: "kstack.mcp-facade-profile.v1"
schemaVersion: 1
registrySetDigest: DigestV1
profileId: FacadeProfileIdV1
repositoryBindingDigest: DigestV1
resourceCatalogDigest: DigestV1
projectionPolicyDigest: DigestV1
protocolVersion: closed supported MCP version
transport: "STDIO"
principalMode: "UNAUTHENTICATED_LOCAL_READER"
allowedRequestMethods: ["initialize", "ping", "resources/list", "resources/read"]
allowedNotifications: ["notifications/initialized", "notifications/cancelled"]
maxFrameBytes, maxConcurrentRequests, maxQueuedRequests, requestDeadlineMs,
maxResourceBytes, maxListPageItems: policy-bounded non-negative integers
```

The method arrays are ordered and equal those values. Size/deadline/page bounds
have closed maxima; zero is permitted only for `maxQueuedRequests`. STDIO is
the only transport. HTTP, SSE, sockets, extra inherited descriptors, and
listeners are forbidden. No executable, environment, path, credential,
endpoint, model, or template-language field exists.

At initialization only resources with `subscribe=false` and
`listChanged=false` are advertised. Tools, prompts, completions, logging,
experimental, sampling, elicitation, roots, and tasks are absent. Every other
request returns method-not-found before dispatch. The two notifications may
only establish initialization or cancel the named bounded in-flight read.

## Repository and launch binding

`RepositoryBindingV1` is a closed domain-addressed object binding `schemaId`,
`schemaVersion`, `canonicalRepositoryIdentityDigest`,
`openedRootIdentityDigest`, `activeSetDigest`, `registrySetDigest`,
`projectionPolicyDigest`, `facadeProfileDigest`, and `launchEvidenceDigest`.

The protected launcher opens the root without following a link/reparse-point
final component, measures stable filesystem identity, and constructs the
binding before launch. The server receives only already-open read-only handles
to the immutable object store and protected status source; it receives no path
authority. Root identity, active set, registry, policy, and profile are
remeasured before each snapshot. Change, ambiguity, replacement, revocation,
or unreadability returns `RESOURCE_SNAPSHOT_UNAVAILABLE`; it never falls back
to another root, global search path, environment, cwd, user config, or network.

STDIO locality is not authentication. Parentage, UID, terminal, client name/
version, initialization metadata, and host claims never promote the principal.
One instance binds one repository; cross-repository enumeration is absent.

## Closed resource catalog and URI grammar

`McpResourceCatalogV1` is closed/domain-addressed and binds the exact profile,
registry, repository, projection policy, and ordered duplicate-free
`ResourceDefinitionV1` rows. Each row contains exactly `resourceId`,
`uriTemplate`, `kind=IMMUTABLE_OBJECT|CURRENT_STATUS`,
`mediaType=application/json`, `sourceSchemaDigest`, `projectionSchemaDigest`,
`maximumClassification=PUBLIC_REPOSITORY_METADATA`, and `maxBytes` no greater
than the profile limit.

The complete initial catalog has only:

1. `kstack://schema/{digest}` for allowlisted public KStack JSON schemas;
2. `kstack://registry/{digest}` for the active public `RegistrySetV1`;
3. `kstack://package/{digest}/manifest` for the active canonical package's
   public manifest, clause inventory, and provenance, without member bodies;
4. `kstack://host/opencode/candidate-status` for an explicitly non-qualifying
   HB-TC03 projection; and
5. `kstack://status/current` for the bounded current snapshot.

URI parsing is byte-defined: valid UTF-8 and ASCII scheme/authority/path;
no userinfo, port, query, fragment, percent-encoded slash/backslash/NUL,
dot-segment, empty digest, Unicode normalization, or alternate case. A digest
is exactly 64 lower-case hexadecimal characters. No percent escape is decoded
before grammar validation. A URI must match exactly one row. Unknown,
ambiguous, noncanonical, oversized, or multiply resolving URIs return a fixed
`RESOURCE_NOT_FOUND` without lookup echo.

`resources/list` returns these five logical definitions, never an object-store
scan. If pagination is needed, a protected opaque cursor MAC-binds profile,
catalog, repository, active set, snapshot, last resource ID, page limit, and
expiry. Invalid, stale, cross-repository, replay-after-change, or out-of-order
cursors return `INVALID_CURSOR`; there is no partial fallback page.

## Snapshot and public projection

Every list/read first obtains one immutable `McpReadSnapshotV1`, addressed with
`KSTACK-MCP-READ-SNAPSHOT-V1`, binding:

```text
profileDigest, repositoryBindingDigest, openedRootIdentityDigest,
activeSetDigest, registrySetDigest, packageDigest, resourceCatalogDigest,
projectionPolicyDigest, candidateStatusBodyDigest|null,
orderedSourceObjectDigests, authoritativeReadSequence,
observedAtUtc, expiresAtUtc
```

Protected status supplies authoritative time and a monotonic read sequence;
expiry is policy-bounded. All referenced objects are opened and identity-
verified before visibility. One response uses one snapshot; mixed epochs or
partial substitution fail the entire request. An immutable requested digest
must equal an allowlisted source digest. A current response includes snapshot
digest and observation/expiry and makes no cache claim beyond expiry.

`McpPublicProjectionPolicyV1` is a closed/domain-addressed allowlist of source
schema digest, permitted JSON-pointer fields, output schema digest, size/depth/
count bounds, and closed replacement codes. Deterministic code projects only
objects that passed their bound closed source schemas. Unlisted fields/types
reject the response. There is no model, source-supplied regex or template,
plugin, callback, or arbitrary traversal.

Every body is canonical JSON satisfying its projection schema and contains
`schemaId`, `schemaVersion`, `resourceId`, `snapshotDigest`, `sourceDigest`,
`projectionPolicyDigest`, and `maximumClaim=READ_ONLY_NON_QUALIFYING`.
Candidate status may report only HB-TC03's states `DECLARED`, `PACKAGED`,
`RENDERED`, `INSTALLED`, `DISCOVERY_OBSERVED`, or `CANDIDATE_INVALIDATED`, plus
public reason/expiry codes. It cannot emit `SUPPORTED`, `FULL`, `QUALIFIED`,
`AUTHORIZED`, `APPROVED`, or operation eligibility. Missing, stale, failed, or
ambiguous evidence yields `status=UNAVAILABLE` with an allowlisted reason.

## Data and diagnostic boundary

Public projections exclude prompt/member bodies, user/model content, memory,
Jira/release data, paths, usernames, hostnames, process IDs, raw filesystem
identities, environment, command lines, credentials, tokens, approvals,
nonces, trust material, owner comments, raw receipts/evidence/logs, stack
traces, exception strings, and provider/client metadata. Only bounded snapshot
observation/expiry timestamps may appear. Unknown extension or host/adapter/
model/client/external-service strings are never serialized.

`McpFacadeErrorV1` is closed with only `code`, `resourceId|null`, `retryable`,
and `correlationDigest`. Codes are exactly `INVALID_REQUEST`,
`METHOD_NOT_ALLOWED`, `RESOURCE_NOT_FOUND`, `RESOURCE_TOO_LARGE`,
`INVALID_CURSOR`, `SNAPSHOT_EXPIRED`, `RESOURCE_SNAPSHOT_UNAVAILABLE`,
`RATE_LIMITED`, `CANCELLED`, and `INTERNAL_FAILURE`. Text is a fixed literal
selected by code and JSON-escaped; no input, URI, path, exception, source, or
diagnostic is interpolated. Detailed diagnostics remain in a protected,
non-model-visible sink outside this item, referenced only by correlation digest.

Before serialization the full tree is recursively checked against its schema,
public allowlist, bounds, and secret-pattern deny scanner. Failure rejects the
whole response rather than truncating it. STDOUT has MCP frames only. STDERR
has at most fixed non-sensitive lifecycle codes.

## Exhaustion, lifecycle, and confinement

The frame reader enforces length before allocation, strict JSON-RPC/MCP schema,
bounded nesting/strings/collections, and unique keys. Invalid UTF-8, duplicate
keys, non-finite numbers, trailing bytes, and batches reject. Queues/concurrency
are bounded. Excess receives `RATE_LIMITED`; no unbounded work is made. Each
request has cancellation/deadline plus fixed read, CPU, and response budgets.

On stdin EOF, parent death, fatal framing error, or protected invalidation, the
server stops intake, cancels reads, closes handles, writes no persistent state,
and exits. It has no persistent cache, subscription, refresh, watcher,
telemetry exporter, retry loop, child process, or outbound connection. OS
confinement denies writes and network; later executed tests remain mandatory.

## Non-promotion and dependency boundary

MCP success proves only a projection was returned. No frame, snapshot,
correlation digest, catalog entry, or client observation is admissible as HP
conformance, operation receipt, approval, eligibility, installation receipt,
source evidence, or candidate transition. HB-TC04 clears neither HP-TC09 nor
HP-TC12 and cannot enable HB-TC05. Reading every resource conveys no support.

## Deterministic verification design

Later independent tests must cover: exact cross-runtime vectors; capability
absence; URI encoding/traversal/ambiguity/substitution; identity non-promotion;
root/link/reparse/mount and active-set changes; mixed epochs and cursor replay;
malicious strings/secrets/paths/exceptions; oversized/deep/duplicate/frame-
smuggling input; cancellation/deadline/queue pressure; stdout contamination;
process no-write/no-network/no-child/no-cache confinement; candidate
invalidation; and downstream rejection of facade output as authority evidence.
Goldens cover exact bytes for all resources/errors/list order/pagination and
Codex/Claude preservation. OpenCode consumption after implementation evidence
still conveys no support claim.

## Authorization and review request

This is design-only. It authorizes no code, MCP launch, installation, reuse,
credentials, external test, commit, push, deploy, publication, or report edit.

Review HB-TC04 only for constructibility, strict read-only behavior, safety for
an unauthenticated local reader, repository isolation, non-promotion, protocol/
resource-exhaustion bounds, and independence from still-open HP-TC09/HP-TC12.
Report only current concrete defects and genuine owner questions. Do not
redesign predecessors, inspect files, use tools, invoke Opus, implement,
install/run MCP, commit, push, deploy, publish, or edit reports.
