# HP-TC09 design candidate: MCP principal and output boundary

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC09` only
**Status:** local design candidate; no implementation, MCP activation, or
private-data release
**Predecessors:** HP-TC01 through HP-TC04 and HP-TC07 are validated design only;
HP-TC05/06/08 interfaces are frozen and independently review-gated

## Exact defect boundary

The round-one design treated stdio locality/client metadata as though it could
identify a caller and allowed diagnostic/tool text to cross sensitive or model-
visible boundaries without one typed release policy. This item defines the no-
principal public default, qualified authenticated private transports, exact
MCP ACL/session binding, method exposure, output classes, escaping/redaction,
and release-time revalidation.

It does not derive general host request identity (HP-TC02), decide evidence or
eligibility (HP-TC04/05), prove conformance (HP-TC06), grant broker authority
(HP-TC07), mutate files (HP-TC08), prove provider outcomes (HP-TC10), fence
actions (HP-TC11), or activate/rollback a server (HP-TC12).

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC02 trusted-context derivation,
HB-TC04's validated unauthenticated read-only resource facade, HP-TC05's frozen
eligibility interface, and HP-TC07's broker route. Build KStack-native MCP
transport assurance, ACL, capability surface, output classification, typed
projection, and session/revocation contracts. Generic gstack MCP/server text
does not supply these trust boundaries and is rejected. No upstream bytes enter.

## Public unauthenticated profile

STDIO is transport, not authentication. Parent process, UID/account, terminal,
cwd, inherited environment, executable name, `initialize` client name/version,
client capabilities, roots, sampling claims, elicitation claims, logging level,
or custom metadata cannot establish a principal, repository authority, approval,
or confidentiality entitlement.

`PUBLIC_UNAUTHENTICATED_V1` exposes only the exact HB-TC04 concrete read-only
MCP `resources/list` and `resources/read` methods for public, non-confidential,
non-authoritative status/schema data. It advertises no tools, prompts,
subscriptions, writes, sampling, elicitation, completion, restricted resources,
or authority-bearing method. Unknown/extra methods and capability substitution
return fixed protocol errors. Public content never promotes identity or becomes
evidence, approval, eligibility, receipt, lease, or host-support proof.

Each public request uses HB-TC04's snapshot-scoped immutable URI/lease contract.
Repository/root/active-set/policy/status sources are protected and read through
already-open handles. Stdio stdout contains protocol frames only; logs and
protected diagnostics go to a separate bounded sink. Server/client output,
exceptions, environment, or file text are never interpolated into JSON-RPC
errors.

## Qualified authenticated transport

Restricted MCP methods require a registered `McpTransportProfileV1` whose
protected implementation/config digests, peer-authentication primitive,
channel-binding construction, principal assurance, endpoint identity,
confidentiality/integrity, replay protection, limits, revocation source, and
negative vectors are members of the active set.

V1 qualifies only protected local IPC capable of binding an OS-authenticated
account/security principal plus peer process ID/start identity, executable
image/build, session, endpoint object identity, and a protected nonce/channel
transcript. The listener lives in the HP-Q1 boundary; socket/pipe ACLs deny
unregistered principals, and the server re-queries peer credentials from the
accepted handle rather than trusting a handshake field. Same-UID alone is
insufficient when policy requires a distinct protected client process.

Remote network transports, ordinary localhost, forwarded sockets, inherited
stdio, application-provided credentials, self-signed TOFU, and MCP client
metadata are unqualified in V1. A future remote profile requires a separately
reviewed exact identity, endpoint, authentication, and revocation contract. An
unqualified transport may use the public profile only; it never falls back to
restricted access.

## Principal and session binding

After transport authentication, HP-TC02 derives `McpPrincipalContextV1` with
exact transport profile/channel binding, principal/account identity, peer
process/build/start identity, host/session, repository/worktree/root, endpoint,
active set, policy, assurance level, issued/expiry time, and trusted-time sample.
Caller fields cannot override any derived value.

`McpSessionV1` binds context digest, a protected 256-bit nonce digest, monotonic
session sequence, offered/selected capability-set digests, ACL digest, output-
policy digest, maximum request/frame/output counts, created/expiry time,
revocation sequence, and state `ACTIVE|REVOKED|EXPIRED|CLOSED`. It is stored in
the protected replay/session ledger. A nonce/context/session is never reusable
across principal, peer process restart, repository/worktree/root, endpoint,
host session, active set, policy, or transport channel.

Every request carries a transport-internal session/sequence binding unavailable
to MCP content. The protected server rejects duplicate, skipped, reordered,
expired, cross-channel, or post-revocation sequences before method dispatch.
Connection reuse revalidates peer process/start identity and all mutable
context at each request and again before output release. Process replacement,
root change, session end, policy/active-set change, or endpoint revocation
closes the session rather than downgrading it to public in place.

## Exact ACL and capability surface

`McpAclV1` is protected and contains closed rows keyed by exact principal role,
repository context, transport assurance, method ID, resource/tool/prompt ID,
operation profile, input-schema digest, output-policy ID, maximum limits, and
required eligibility/authority class. Rows are deny-by-default and exact; no
wildcard, prefix, path glob, semantic similarity, client claim, host alias, or
model-selected scope exists.

Capability negotiation is set intersection over exact active-set registered
IDs, then ACL filtering. The server advertises only the resulting surface for
that session. A method absent from the advertised set remains denied even if a
client sends it directly. Capability, schema, ACL, active-set, or policy change
revokes the session and requires a new negotiation; method handlers never use a
global current registry behind an old advertised digest.

Restricted resource reads are repository- and principal-bound immutable
snapshot URIs. Restricted prompts are disabled in V1 because prompt text is a
model-instruction surface and no reviewed use is required. A tool row must map
exactly to one `OperationRequestV1` schema/profile and route through HP-TC02/03/
04/05/07 plus applicable later controls. The MCP server has no direct shell,
filesystem mutation, provider, Git, Jira, credential, or deployment executor.
Missing eligibility, approval, broker, fence, or receipt prerequisites denies
the tool; it is never emulated inside the MCP process.

## Typed output and release policy

Every response content item is first classified by protected producer/schema as
exactly one of:

```text
PUBLIC_SAFE | RESTRICTED_STRUCTURED | MODEL_VISIBLE_UNTRUSTED |
PROTECTED_DIAGNOSTIC | PROHIBITED
```

- `PUBLIC_SAFE` uses only the reviewed HB-TC04 projection and may cross the
  unauthenticated profile.
- `RESTRICTED_STRUCTURED` requires an authenticated session and exact ACL row;
  it is typed data whose fields each carry release classifications.
- `MODEL_VISIBLE_UNTRUSTED` is explicitly data, never instruction/authority,
  and requires a policy that permits that exact field/source to reach a model.
- `PROTECTED_DIAGNOSTIC` stays behind the protected correlation-digest lookup
  and cannot enter MCP/model-visible content.
- `PROHIBITED` is never emitted.

`McpOutputPolicyV1` binds method/output schema, allowed field classifications,
maximum bytes/items/depth/string length, encoding, escaping, redaction profile,
untrusted-content envelope, URI/media-type allowlist, truncation disposition,
and release-time revalidation requirements. Unknown fields/classes, free-form
exception serialization, schema mismatch, mixed public/restricted content,
invalid encoding, or a required redaction produces a fixed error rather than a
partially leaked response.

Sensitive source values are not made safe by generic regex replacement. The
producer must emit approved typed fields; credentials, approval material,
signing/session/replay values, raw environment/configuration, protected paths/
principals, provider request/response bodies, and unrestricted host/tool text
are excluded by schema. Shared defense-in-depth scanners operate on the bounded
projection and fail closed on a match, but never justify admitting an otherwise
prohibited source.

Untrusted text is canonical UTF-8, length bounded, escaped as JSON data, tagged
with source/digest/classification, and never concatenated into fixed system/
approval/error instructions. URI and media types are registry allowlisted.
Binary content is excluded in V1. Truncation is explicit and digest-bound; if a
schema requires completeness, overflow denies the whole response.

Before writing the first response byte, the protected server atomically
revalidates transport/peer/session/sequence, repository/root, ACL/capability,
active set, policy, eligibility/authority, revocation, output-policy digest,
trusted time, and snapshot currentness. Change suppresses the response. Once
bytes have been released, they cannot be recalled; the audit record binds the
exact release snapshot and byte digest without storing prohibited content.

Streaming is disabled for restricted/model-visible output in V1 so release is
all-or-nothing after complete validation. Public HB-TC04 responses remain one
bounded frame. Notifications/subscriptions are disabled; they would require a
separate long-lived revalidation and revocation design.

## Stable failures and audit boundary

The closed reason families are `KSTACK_MCP_TRANSPORT_*`,
`KSTACK_MCP_PRINCIPAL_*`, `KSTACK_MCP_SESSION_*`, `KSTACK_MCP_REPLAY_*`,
`KSTACK_MCP_CAPABILITY_*`, `KSTACK_MCP_ACL_*`, `KSTACK_MCP_METHOD_*`,
`KSTACK_MCP_OUTPUT_SCHEMA_*`, `KSTACK_MCP_OUTPUT_PROHIBITED`,
`KSTACK_MCP_OUTPUT_REDACTION_REQUIRED`, `KSTACK_MCP_OUTPUT_TOO_LARGE`,
`KSTACK_MCP_RELEASE_CONTEXT_CHANGED`, and `KSTACK_MCP_PUBLIC_ONLY`.
Concrete codes are HP-TC01 registry-owned and map to fixed JSON-RPC error
codes/messages without raw input interpolation.

`McpReleaseAuditV1` binds session/request/sequence/method, input/output schema
and safe byte digests, classification counts, ACL/output policy, repository,
active set/policy/eligibility, release snapshot, outcome, reason codes, and
trusted times. It stores no prohibited body, transport authenticator, raw
principal/path/config, or credential. HP-TC10 separately decides whether any
operation tool result requires another producer receipt.

## Deterministic verification design

Golden vectors freeze transport/channel/principal/session transcripts,
capability intersections, ACL decisions, method mappings, typed projections,
escaping/redaction, JSON-RPC frames/errors, release audits, and safe diagnostics
across independent Node and native/Rust implementations.

Authentication fixtures try stdio parent/UID/client metadata; PID/start reuse;
peer executable replacement; socket/pipe forwarding; endpoint/ACL replacement;
same-account unregistered process; channel/session/nonce substitution; replay,
reorder, skipped sequence; process/session/root/repository crossover; expiry and
revocation; and an unqualified remote transport. None may promote public access.

Surface fixtures send unadvertised/unknown methods, direct tools, prompts,
subscriptions, sampling, elicitation, writes, forged capability negotiation,
schema/profile substitution, ACL wildcard/prefix/case alias, cross-repository
URI, stale snapshot URI, changed active-set/policy, and tool execution with each
downstream prerequisite absent. Each denies before handler effect.

Output fixtures place credentials and protected values in every source/field,
embed hostile JSON/Markdown/XML/control characters and instruction-like text,
forge media types/URIs, add unknown fields, cause invalid UTF-8/depth/count/
size overflow, require truncation of a completeness-bound object, mix public/
restricted classes, throw hostile exceptions, write logs to stdout, and change
principal/ACL/eligibility/revocation after projection but before release.

Concurrency/crash tests race peer death/replacement, session revocation,
repository/root change, active set/policy/ACL/output policy, trusted time, and
eligibility around every request/response step. They prove no restricted bytes
release before the final atomic snapshot, no partial restricted stream exists,
and no stale session silently becomes public. Property tests prove output fields
cannot move to a less restrictive class and public profile capabilities remain
the exact HB-TC04 subset.

No test uses production credentials or endpoints.

## Review request

Review HP-TC09 only for the unauthenticated public default, qualified local
principal/channel binding, exact session/ACL/capability surface, broker-only
tool mapping, typed output classification, all-or-nothing release revalidation,
and safe diagnostics/audit. Closure requires Codex 93+ and empty failed,
security, dissent, and question arrays.

Do not review or close HP-TC10 through HP-TC12, invoke Opus, inspect/edit files,
use tools, implement or activate MCP, use credentials, perform an external
action, commit, push, deploy, publish, or edit reports.
