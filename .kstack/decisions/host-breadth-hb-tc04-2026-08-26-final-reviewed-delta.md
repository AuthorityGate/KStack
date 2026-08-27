# HB-TC04 round-3 snapshot-consistency repair

**Prior packet:** `600f6de3513d66aecac820f9ff3d1cade8e07c61db3ced38b9fe020158f4a6c3`
**Prior result:** Codex 97 revise; 1 failed / 0 security / 1 dissent / 1 question
**Frozen:** all HB-TC04 boundaries and both round-2 repairs that Codex accepted

This delta repairs only the incomplete binding between a concrete
`resources/list` entry and a later `resources/read` request. It does not add a
tool, template-list method, persistent cache, authority, mutation, or side
effect.

## Authenticated snapshot lease

Before returning any first page from `resources/list`, the server freezes one
`McpReadSnapshotV1`, constructs the complete bounded concrete resource list,
projects and validates every corresponding canonical public response body,
and installs them together as one immutable process-local `SnapshotLeaseV1`.
The closed lease binds exactly:

```text
schemaId, schemaVersion, leaseId, profileDigest, repositoryBindingDigest,
resourceCatalogDigest, projectionPolicyDigest, snapshotDigest,
resourceInventoryDigest,
ordered(resourceKeyDigest, sourceDigest|null, bodyDigest, byteCount) rows,
issuedAtUtc, expiresAtUtc
```

The profile adds positive closed maxima for `maxSnapshotLeases`,
`maxSnapshotLeaseBytes`, and `maxSnapshotLeaseLifetimeMs`. The sum of lease
bodies, rows, and token material is charged before installation. Capacity
failure returns `RATE_LIMITED`; a live lease is never partially installed or
evicted. Expired leases are removed before admission. The table is volatile
protocol state only: no disk, network, child process, cross-process recovery,
or cross-launch key exists. It is destroyed on EOF, fatal invalidation, parent
death, or server exit.

At process start the confined server obtains one protected random MAC key that
is non-exportable to resource bodies and diagnostics. For a lease it creates
`SnapshotReadTokenV1` as a canonical base64url path segment containing exactly
`schemaVersion`, `leaseId`, `snapshotDigest`, `repositoryBindingDigest`,
`resourceInventoryDigest`, and `expiresAtUtc`, plus
`HMAC-SHA-256("KSTACK-MCP-SNAPSHOT-READ-TOKEN-V1" || 0x00 || canonical-fields)`.
Validation decodes under strict size/canonical-alphabet bounds, verifies the
MAC in constant time, then requires exact equality with the live lease and
current server repository binding. A token is integrity and freshness proof
for public data only; it grants no identity, approval, lifecycle, or operation
authority.

Construction is acyclic. `resourceInventoryDigest` is computed before the
lease or token from ordered closed logical rows containing only resource ID,
source digest/null, fixed public name, media type, and resource-rule ID. A
`resourceKeyDigest` is the domain-separated digest of its corresponding
logical row. Neither digest contains a lease ID, token, scoped URI, cursor, or
lease digest. The lease is then addressed, the token is created from the
already-addressed facts, and snapshot-scoped URIs are created last. No digest
earlier in that order binds a later value.

## Protocol-valid snapshot-scoped URIs

Every concrete `Resource` returned by any page has a snapshot-scoped URI using
the same authenticated lease token:

```text
kstack://schema/<sourceDigest>/snapshot/<snapshotReadToken>
kstack://registry/<sourceDigest>/snapshot/<snapshotReadToken>
kstack://package/<sourceDigest>/manifest/snapshot/<snapshotReadToken>
kstack://host/opencode/candidate-status/snapshot/<snapshotReadToken>
kstack://status/current/snapshot/<snapshotReadToken>
```

The token is part of the URI path, so standard MCP `resources/read` carries it
without adding a method or parameter. No query, fragment, template, or hidden
client state is used. The internal five-rule matcher is updated only for these
exact forms. It validates the ordinary source digest, token, and exact URI-row
logical `resourceKeyDigest` before looking up the lease. `resources/list` returns no unscoped
mutable URI. Single-page responses therefore have the same binding as
multi-page responses.

The first list page creates the lease and its token, then constructs the exact
scoped URI list and its `scopedResourceListDigest`. Every pagination cursor
MAC-binds that exact token, lease digest, scoped-resource-list digest, and page
position; later pages can return only rows from the same lease. The cursor is
constructed last and is not bound by the token or lease. `resources/read`
validates the URI token, derives the logical key without its snapshot suffix, selects the
exact row from that lease, and returns the already-validated canonical body
whose embedded `snapshotDigest` equals the token and lease. It never
reprojects from current status or silently moves to a newer snapshot.

An expired authentic token returns `SNAPSHOT_EXPIRED`. A valid token with a
missing or invalidated bound lease returns `RESOURCE_SNAPSHOT_UNAVAILABLE`.
A malformed, noncanonical, MAC-invalid, cross-process, cross-repository,
row-mismatched, or invented token/URI returns fixed `RESOURCE_NOT_FOUND`
without lookup echo. These distinctions expose no private data. Cancellation
and deadlines release only request-local references; the immutable lease
remains until its bounded expiry so another listed resource can still be read.

## Verification delta

Add deterministic tests for single-page and multi-page list/read equality;
current-status change after list; candidate invalidation after list; cross-
repository, cross-process, expired, forged, truncated, noncanonical, and
row-substitution tokens; lease capacity and expiry races; cancellation; and
exact body/snapshot digest equality. Confinement tests prove the lease and MAC
key create no writes, network, child process, telemetry, or post-exit residue.
Downstream rejection tests preserve the non-promotion ceiling.

## Review request

Review only whether this bounded authenticated snapshot lease makes every
listed mutable resource readable against the exact listed snapshot through a
protocol-valid standard MCP URI, including single-page results, without
weakening any frozen HB-TC04 boundary. Closure requires confidence 93+ and
empty failed, security, dissent, and question arrays. Do not redesign, invoke
Opus, use tools, inspect/edit files, implement, launch MCP, commit, push,
deploy, publish, or edit reports.
