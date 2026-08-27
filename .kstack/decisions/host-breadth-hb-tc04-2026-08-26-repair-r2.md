# HB-TC04 round-2 concrete repair

**Prior packet:** `366f4f4a2f568f040258cfc5f23c92bbcc0a513975ef229ff73967ae2e206219`
**Frozen:** Option C, unauthenticated-reader ceiling, read-only resource facade,
repository isolation, confinement, non-promotion, no upstream bytes

This delta repairs only round 1's three failed checks and two corresponding
material dissents. Every unmodified HB-TC04 requirement remains normative.

## 1. Acyclic object construction

Replace the prior mutually digest-bound profile, catalog, and repository
binding with this strict construction order:

1. Build and address `McpFacadeProfileV1` from only protocol, transport,
   principal, method/notification allowlists, and numeric resource bounds.
   Remove `registrySetDigest`, `repositoryBindingDigest`,
   `resourceCatalogDigest`, and `projectionPolicyDigest` from its body.
2. Build and address `McpPublicProjectionPolicyV1` from only its closed source
   schema/output schema rows, public field allowlists, bounds, and replacement
   codes. It contains no profile, catalog, repository, active-set, registry,
   package, launch, or snapshot digest.
3. Build and address `McpResourceCatalogV1` from exactly
   `schemaId`, `schemaVersion`, `profileDigest`, `projectionPolicyDigest`, and
   its ordered duplicate-free `ResourceRuleV1` rows. It contains no repository,
   active-set, registry, package, launch, or snapshot digest.
4. Build and address `LaunchEvidenceV1` from the protected launcher's measured
   executable/confinement profile, already-open handle identities, launch
   nonce digest, and observation/expiry. It contains no repository-binding or
   snapshot digest.
5. Build and address `RepositoryBindingV1` from exactly its schema fields,
   canonical/opened repository identities, active-set and registry digests,
   plus the already-created profile, projection-policy, catalog, and launch-
   evidence digests.
6. Build `McpReadSnapshotV1` from that final repository binding and the
   previously defined observed source-object facts.

No object in a step may bind the digest of that step or a later step. The
external domain-separated address is never serialized into its own body.
Validation rejects any back-reference, self-reference, unknown digest edge,
or order violation. Exact cross-runtime construction vectors cover every step.

## 2. Protocol-valid concrete resource discovery

Keep `allowedRequestMethods` exactly `initialize`, `ping`, `resources/list`,
and `resources/read`; `resources/templates/list` remains absent. Rename the
catalog row type to `ResourceRuleV1`: these five internal rules are never
serialized as MCP `Resource` objects and their URI patterns are never returned
to clients.

For one immutable snapshot, `resources/list` deterministically materializes a
bounded ordered list of concrete MCP `Resource` entries only:

- one exact `kstack://schema/<digest>` URI for every public schema digest
  allowlisted by the active RegistrySet, bounded by the profile;
- one exact `kstack://registry/<active-registry-digest>` URI;
- one exact `kstack://package/<active-package-digest>/manifest` URI;
- `kstack://host/opencode/candidate-status`; and
- `kstack://status/current`.

Thus “five logical definitions” means five internal rules, not five returned
entries. No URI template is advertised. Each returned entry binds the current
snapshot digest through the protected cursor state, has a fixed public name
and `application/json` media type, and is readable by `resources/read` under
exactly one internal rule. List construction fails closed if schema enumeration
exceeds `maxListResources`, any candidate URI is ambiguous/noncanonical, or
the current active facts cannot be frozen. Pagination slices only this frozen
concrete ordered list; the existing cursor MAC binds its exact list digest and
snapshot. No object-store scan or client-supplied template expansion occurs.

## 3. Exact JSON-RPC error mapping

Replace the prior error enum and “method-not-found” prose with this closed
mapping. Each row fixes the JSON-RPC numeric `code` and literal `message`:

```text
PARSE_ERROR                   -32700  "Parse error"
INVALID_REQUEST               -32600  "Invalid Request"
METHOD_NOT_FOUND              -32601  "Method not found"
INVALID_PARAMS                -32602  "Invalid params"
INTERNAL_FAILURE              -32603  "Internal error"
RESOURCE_NOT_FOUND            -32001  "Resource not found"
RESOURCE_TOO_LARGE            -32002  "Resource too large"
INVALID_CURSOR                -32003  "Invalid cursor"
SNAPSHOT_EXPIRED              -32004  "Snapshot expired"
RESOURCE_SNAPSHOT_UNAVAILABLE -32005  "Resource snapshot unavailable"
RATE_LIMITED                  -32006  "Rate limited"
CANCELLED                     -32007  "Request cancelled"
```

`McpFacadeErrorV1` is a closed internal object with exactly `symbol`,
`jsonRpcCode`, `resourceId|null`, `retryable`, and `correlationDigest`; the
wire response has exactly JSON-RPC `jsonrpc`, validated request `id|null`, and
`error:{code,message,data}` where `data` is the bounded canonical projection
of `resourceId|null`, `retryable`, and `correlationDigest`. No other error data
is permitted.

Invalid JSON inside a bounded complete frame yields `PARSE_ERROR` with null
ID. A parsed but invalid JSON-RPC request, batch, duplicate-key object, or
invalid ID yields `INVALID_REQUEST` with null ID. A valid request for any
non-allowlisted method yields `METHOD_NOT_FOUND`. Invalid parameters to an
allowlisted method yield `INVALID_PARAMS`. An otherwise unclassified server
failure yields `INTERNAL_FAILURE`. Application failures use their exact
`-32001` through `-32007` rows. A framing violation that prevents finding a
bounded complete JSON value closes the connection without a response. A valid
notification never receives a response.

A request ID is accepted only as null, a bounded UTF-8 string, or an integer
in the closed safe range; accepted request IDs are echoed byte-for-byte as the
JSON value required by JSON-RPC. This protocol echo is not diagnostic text.
No message or data field interpolates request content, URI text, path,
exception, source, client metadata, or other diagnostic material. Cancellation
targets only an existing validated bounded ID and returns the fixed
`CANCELLED` mapping to that request; unknown cancellation targets are ignored
as notifications.

## Review request

Review only whether these three repairs remove the cyclic digest graph,
represent parameterized resources through a protocol-valid bounded concrete
`resources/list`, and make every framing/JSON-RPC/application error path exact
and internally consistent. Closure requires confidence 93+ and empty failed,
security, dissent, and question arrays. Do not redesign, invoke Opus, use
tools, inspect/edit files, implement, launch MCP, commit, push, deploy,
publish, or edit reports.
