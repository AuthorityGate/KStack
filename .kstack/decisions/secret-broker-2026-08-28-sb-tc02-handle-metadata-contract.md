# KStack Secret Broker — SB-TC02 handle and metadata contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC02` — opaque handle, safe metadata, namespace, enumeration resistance, and closed public schema |
| Status | `REVIEW-REQUIRED` |
| Inputs | SB-TC00 objective SHA-256 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 portfolio SHA-256 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57` |
| Implementation | authorized separately; this candidate defines no storage or executor mechanism |

## 1. Decision requested

Freeze the model-facing identity and metadata contract for one Secret Broker
handle. The contract must let a model select an already authorized credential
purpose without revealing value material, backend locators, private paths, raw
targets, tenant/account identities, or entries outside its effective scope.

This item owns identifiers, namespace binding, public describe/list behavior,
metadata admission, enumeration resistance, canonical encoding, and version
failure. SB-TC03 owns principal/policy authority; SB-TC04 owns backend storage
and locator resolution; SB-TC05 owns execution; SB-TC06 owns lifecycle
transitions; SB-TC07 owns receipts; SB-TC08 owns host projections.

## 2. Non-compensating invariants

1. A public handle is random, opaque, non-semantic, and non-authoritative.
   Possession never substitutes for current principal, repository,
   environment, policy, adapter, target, generation, or lifecycle checks.
2. Repository and environment scope come from the authenticated broker session,
   never from model-supplied path, name, tenant, endpoint, or environment text.
3. The same logical credential enrolled into another repository/environment has
   a distinct handle and no public stable cross-scope correlation key.
4. Unknown, malformed, absent, wrong-scope, unauthorized, stale-generation, and
   retired handles return the same pre-authorization failure. No backend lookup
   or provider contact occurs before this decision.
5. Public metadata contains no secret value or secret-derived material, backend
   locator, source path/format, raw endpoint, username/email/account ID, private
   tenant identity, provider response, free-form note, exact secret expiry, or
   lifecycle timestamp.
6. Unknown fields, duplicate JSON keys, invalid Unicode, noncanonical strings,
   oversized values, unsupported versions, and unregistered enum/registry IDs
   are rejected before lookup. There is no extension bag.
7. Listing is an authorized projection over one already established scope. It
   is not global discovery, substring search, provider search, path search, or
   a way to test arbitrary handles.
8. Internal metadata and model-facing safe metadata are distinct schemas. A
   serializer cannot expose an internal record by field filtering.

## 3. Primitive domains

The v1 wire format is UTF-8 JSON with I-JSON constraints. Parsers reject
duplicate keys, lone surrogates, non-integer numbers, negative zero, leading or
trailing non-JSON bytes, and any key not listed by the selected schema. When a
digest is required by a later item, the input is RFC 8785 JCS over a value that
already passed this closed-schema validation; parsing and validation never rely
on digest equality alone.

```text
handle-id-v1       = "ksh1_" + BASE64URL_NOPAD(random-32-bytes)
opaque-ref-v1      = "ksr1_" + BASE64URL_NOPAD(random-16-bytes)
registry-id-v1     = lowercase ASCII: [a-z][a-z0-9-]{0,62}[a-z0-9]
safe-label-v1      = NFC Unicode, 1..64 scalar values, 1..128 UTF-8 bytes
generation-v1      = JSON integer, 1..9007199254740991
page-size-v1       = JSON integer, 1..50
cursor-v1          = "ksc1_" + BASE64URL_NOPAD(opaque authenticated bytes)
```

`safe-label-v1` rejects C0/C1 controls, bidi formatting/override characters,
zero-width characters, noncharacters, private-use characters, unassigned code
points, leading/trailing whitespace, repeated whitespace, CR/LF/tab, URI user
info, and strings that resemble a credential, filesystem path, email address,
URL, IP address, hostname, UUID, JWT, PEM block, or authorization header. The
trusted enrollment UI requires the owner to classify the label as intentionally
model-visible. A format pass or owner assertion alone is insufficient: the
protected admission path also rejects literal, normalized, encoded, prefix, and
low-entropy equality with any value available during that enrollment attempt.

Labels are display-only. Authorization and equality use opaque references and
registered IDs, never label text. A cell that cannot establish safe-label
admission omits the optional label rather than substituting provider data.

## 4. Scope and handle binding

The broker creates private random identifiers for each enrolled repository and
environment. Filesystem paths, Git remotes, branch names, environment names,
and tenant strings are evidence used by later authenticated resolvers; they are
not public namespace keys.

The internal binding is one immutable tuple:

```text
handle-binding-v1 = {
  schemaVersion: "kstack-secret-handle-binding-v1",
  handleId: handle-id-v1,
  repositoryRef: opaque-ref-v1,
  environmentRef: opaque-ref-v1,
  backendFamilyId: registry-id-v1,
  backendInstanceRef: opaque-ref-v1,
  backendLocatorRef: opaque provider-owned bytes,
  adapterId: registry-id-v1,
  targetRef: opaque-ref-v1,
  purposeRef: opaque-ref-v1,
  generation: generation-v1,
  lifecycleState: "active" | "suspended" | "revoked" | "deleted",
  metadataRevision: generation-v1
}
```

This is a protected internal schema, not a model response. The backend locator
is bounded and interpreted only by its registered adapter; it is never accepted
from or returned to a model-facing caller. A backend or target change creates a
new handle generation through SB-TC06 authority. A handle ID is never reused,
even after deletion, rollback, restore, repository reenrollment, or collision.
Creation uses an OS CSPRNG and exclusive insert into a repository-wide retired-
ID registry; a collision discards the candidate and retries before publication.

The trusted session supplies `repositoryRef`, `environmentRef`, principal, host,
and session evidence out of band. No public request contains or overrides them.
SB-TC03 must bind them to the authorization decision before this item may emit
an available response.

## 5. Public safe metadata

```text
safe-handle-metadata-v1 = {
  schemaVersion: "kstack-secret-safe-handle-metadata-v1",
  handleId: handle-id-v1,
  purposeId: registry-id-v1,
  purposeLabel?: safe-label-v1,
  credentialKind: "password" | "api-token" | "client-credential" |
                  "certificate-handle" | "private-key-handle" |
                  "dynamic-credential" | "opaque",
  environmentClass: "development" | "test" | "staging" | "production" |
                    "recovery",
  backendFamilyId: registry-id-v1,
  backendLabel?: safe-label-v1,
  adapterId: registry-id-v1,
  targetRef: opaque-ref-v1,
  targetLabel?: safe-label-v1,
  tenantLabel?: safe-label-v1,
  lifecycleClass: "usable" | "attention" | "unavailable",
  generation: generation-v1,
  expiryClass: "not-applicable" | "unknown" | "valid" | "expiring-soon" |
               "expired",
  evidenceLevel: "discovered" | "configured" | "synthetic-qualified" |
                 "pilot-validated" | "production-approved"
}
```

Every registry ID resolves in a version-pinned protected registry whose entry
defines its allowed environments and safe public name. Optional labels are
separately admitted model-visible aliases; they are never populated from raw
provider fields. `targetRef` is a scope-local random reference, not a target
digest, endpoint hash, or provider identifier. Exact expiry and lifecycle facts
remain protected because their precision can disclose rotation schedules or
provider state. SB-TC06 maps them to the closed public classes.

`lifecycleClass` and `evidenceLevel` are claims, not authorization. A usable
entry can still be denied by policy, approval, target drift, stale evidence, or
backend health. An unavailable item may appear only to a caller already
authorized to inventory that item; its detailed cause uses later typed safe
diagnostics, never provider text.

## 6. Public operations

There are exactly two model-facing operations in this item.

### Describe

```json
{"schemaVersion":"kstack-secret-describe-request-v1","operation":"describe","handleId":"ksh1_<43 base64url characters>"}
```

A successful response contains exactly:

```json
{"schemaVersion":"kstack-secret-describe-result-v1","outcome":"available","item":{"...":"safe-handle-metadata-v1"}}
```

Every rejection before an authorized, current binding is established contains
exactly:

```json
{"schemaVersion":"kstack-secret-describe-result-v1","outcome":"unavailable","reason":"HANDLE_UNAVAILABLE"}
```

The unavailable path performs no provider contact, emits no suggested handle,
and is padded to a qualified response class. Constant-time behavior is not
claimed across an OS scheduler or network; qualification instead proves that
the response schema, provider-contact count, audit class, and configured timing
bucket do not distinguish malformed, absent, wrong-scope, unauthorized, stale,
revoked, or deleted candidates before authorization.

### List

```text
list-request-v1 = {
  schemaVersion: "kstack-secret-list-request-v1",
  operation: "list",
  purposeId?: registry-id-v1,
  adapterId?: registry-id-v1,
  environmentClass?: closed enum above,
  pageSize: page-size-v1,
  cursor?: cursor-v1
}
```

Filters are exact registered IDs/classes only. There is no text query, glob,
regex, backend locator, label filter, target filter, tenant filter, state probe,
sort key, offset, total count, or caller-supplied scope. The response contains
exactly `schemaVersion`, `outcome: "available"`, `items`, and optional
`nextCursor`; `items` has 0..50 `safe-handle-metadata-v1` values sorted by the
raw random bytes of `handleId`.

A cursor is authenticated, encrypted or server-side random state; reveals no
offset, count, scope, filter, identifier, or timestamp; binds the trusted
principal/session/repository/environment, exact filters, registry revisions,
authorization snapshot, and a maximum five-minute expiry; and is one-use. A
bad, expired, replayed, or wrong-context cursor returns the fixed
`CURSOR_UNAVAILABLE` response and cannot restart or widen the query. Later
policy change invalidates the cursor. Empty results do not reveal whether
unauthorized items exist.

## 7. Projection and storage separation

The public serializer accepts only an already-authorized internal handle ID and
constructs a new `safe-handle-metadata-v1` value field by field from registered
safe sources. It never serializes an internal object and deletes prohibited
keys afterward. Public response objects are recursively closed and copied into
a fresh bounded buffer before emission.

Internal records may contain sensitive locators and exact operational facts.
Their storage, ownership, durability, symlink/reparse defense, rollback
protection, and backend consistency belong to SB-TC04/SB-TC06. Until those
items close, this contract is design-only and no current experimental inventory
is conformant merely because it uses similar field names.

The existing Windows and Linux experimental cells expose UUID handles and
broader inventory metadata. They remain synthetic/experimental evidence and
must not be labeled SB-TC02-conformant until they adopt this exact scope,
projection, label-admission, cursor, and indistinguishable-unavailable contract.

## 8. Version and failure rules

- Schema literals are exact and case-sensitive. Unsupported versions return
  `SCHEMA_UNSUPPORTED` before handle parsing or lookup.
- A v1 parser accepts no aliases, coercions, null-for-omitted fields, numeric
  strings, additional properties, or nested extension objects.
- Registry removal makes affected metadata unavailable; it never falls back to
  unregistered display text or backend data.
- Any uncertainty about scope, label safety, registry currentness, cursor
  binding, generation, lifecycle mapping, or projection completeness denies the
  operation with a fixed safe reason.
- Logs and receipts may contain the schema ID, operation class, safe outcome,
  and a separately domain-separated audit reference. They do not contain a
  public handle, cursor, labels, protected refs, counts, or request body.

## 9. Deterministic confirmation checks

SB-TC02 closes only if the reviewer confirms all of the following on the same
candidate digest:

1. Handle bytes are CSPRNG-generated, nonsemantic, never reused, and do not
   authorize or correlate across repository/environment scope.
2. Trusted scope is out of band and cannot be asserted by the model request.
3. Public and internal schemas are structurally separate and recursively closed.
4. Public metadata has no secret, derivative, locator, path, endpoint, raw
   account/tenant identity, provider text, free-form note, or exact timestamp.
5. Optional labels require both restricted syntax and explicit model-visible
   admission; failure omits the label.
6. Describe produces no pre-authorization existence, scope, lifecycle, backend-
   contact, response-shape, audit-class, or configured timing-bucket oracle.
7. List is scoped, exact-filter-only, bounded, count-free, and cannot enumerate
   another principal/repository/environment.
8. Cursors are opaque, context-bound, expiring, one-use, and invalidated by
   relevant policy or registry change.
9. Generation and lifecycle classes are safe display facts, never authority.
10. Unsupported or ambiguous input fails before provider contact without
    fallback, coercion, or provider-derived diagnostics.
11. Current experimental cells receive no conformance claim from this design.
12. SB-TC03 through SB-TC08 retain their named authority and this item defines
    no storage, lifecycle transition, executor, receipt, or host interception.

## 10. Review instruction

Review only SB-TC02. Return `approve` only at confidence at least 93 with zero
failed checks, security findings, material dissent, and unresolved questions.
Do not inspect a real credential, private tenant/account configuration, or
personal path. A high score with any finding remains `revise`.
