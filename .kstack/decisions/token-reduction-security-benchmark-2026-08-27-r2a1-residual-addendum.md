# R2a.1 normative addendum: split envelope/auth transport, normalized persistence, hardlink closure

Status: PROPOSED DESIGN-ONLY RESIDUAL REPAIR  
Date: 2026-08-27  
Amends base: `token-reduction-security-benchmark-2026-08-27.md`  
Base SHA-256: `264941a83b6fd4bdf04c01059243e7995e1a1060cbd82f09954d3114b845d558`  
Amends R2a: `token-reduction-security-benchmark-2026-08-27-r2a-provider-security-addendum.md`  
R2a SHA-256: `1f0b3bfb284f10e4af02103dd012fa2aafafc9f67a6d57a062ed4c238750f16d`  
Scope: three exact residuals only.  
Implementation/external-review authority: none granted.

This addendum controls where it narrows or corrects R2a. It does not qualify a
provider route or authorize ECR use.

## 1. Separate model-visible content from trusted authentication transport

### 1.1 `ModelVisibleEnvelopeV1`

R2a `ProviderEnvelopeV1` is renamed and narrowed to
`ModelVisibleEnvelopeV1`. It exact-byte binds **all and only model-visible,
non-authentication content and controls**: system/developer/user/history,
tools/results/schemas, attachments, wrappers, source records, response schema,
model/reasoning/sampling controls, cache controls that affect inference, and
every provider/SDK/CLI/server-added model-visible byte or metadata field.

Unknown or implicit model-visible content remains forbidden. The envelope
contains no authentication material, authentication handle, OS account/keychain
locator, transport session identifier, request signature, cookie/header value,
or digest derived from any of those. `ModelVisibleEnvelopeV1` remains fully
scanned and exact-bound before transport authorization.

### 1.2 `TrustedAuthTransportV1`

`TrustedAuthTransportV1` is a separate host security boundary. It may be a
pinned, code-identified, isolated provider CLI or minimal transport principal.
It is not KStack, a benchmark worker, packet builder, content renderer, provider
child content plane, or general shell helper.

The trusted principal may obtain/use OS-protected authentication only after the
supervisor redeems a one-shot capability binding route; pinned principal/binary;
qualified destination and TLS/server policy; `ModelVisibleEnvelopeV1` digest
and size; invocation/model/cache/retention; expiry/nonce; request method/path
class; and authenticated supervisor/broker/principal IPC identities.

The OS-protected value is inaccessible to KStack, workers, packet/content
processes, model input, tools, and provider-visible output. The trusted principal
may use it only for the bound destination, envelope, invocation, and one request
or explicitly bounded stream. It cannot return, export, duplicate, delegate,
refresh, replay, or redirect authorization. KStack receives only closed result
labels and authoritative numeric usage fields.

R2a section 5 is corrected accordingly: the pinned isolated trusted principal
may use OS-protected authentication; KStack, workers, and the content plane may
not. Authentication in argv, environment, stdin, cwd, repository/home/shared
configuration, generic inherited descriptors, prompt/history/attachments,
stdout/stderr, or persistent artifacts remains forbidden.

### 1.3 Isolation and canary qualification

The trusted principal runs with a minimal allowlisted environment and empty
private working directory; no shared home/configuration, shell, child spawn,
arbitrary file reads, or broad egress. Debug ports, tracing, core/crash dumps,
packet capture, proxy inheritance, telemetry, analytics, update checks,
diagnostic uploads, verbose request logging, terminal inheritance, and raw
transport logs are disabled and independently denied. Only the volatile
inspector receives provider response channels.

Qualification pins executable/library digest, code-signing identity where
available, host/runtime, sandbox, destination policy, OS-protected
authentication mechanism, and provider version. Synthetic canaries are placed
separately in every forbidden channel; evidence must prove none appears in
arguments, environment, stdin, cwd/shared config, model-visible request,
response/error channels, logs, telemetry, crash material, or unrelated network
destinations. Attempted export, alternate destination, redirect, debug attach,
crash, retry/replay, and concurrent use must fail closed.

Canaries contain no real credential material. A missing observation point,
uncontrolled redirect/proxy, unverifiable server wrapper, or principal capable
of general export leaves the route `UNSUPPORTED`.

## 2. Provider free text is volatile only

The volatile inspector may consume provider-generated text solely to validate
the response schema and convert it into a closed local vocabulary. No provider
free text, excerpt, token sequence, summary, paraphrase, embedding, fingerprint,
or digest of provider free text may enter a persistent record, receipt, report,
corpus, cache, retry packet, history, or later model prompt.

Persistent normalized result schemas contain only:

- versioned closed enums for decision, severity, failure class, fallback reason,
  scanner disposition, and provider terminal class;
- booleans;
- bounded integers or finite bounded numeric usage/latency values;
- timestamps as bounded integers from the local trusted clock; and
- random local opaque IDs generated before dispatch and unrelated to provider
  text, authentication material, user data, or rejected content.

Strings are limited to exact enum spellings and fixed field names.
Provider-supplied IDs, filenames, URLs, messages, rationales, recommendations,
citations, stack traces, and unknown metadata reject persistence. Counts are
emitted only for predeclared categories; unknown categories become the closed
label `UNCLASSIFIED` without retaining text.

Conversion occurs inside the volatile boundary after complete scan. The
converter is a closed parser/lookup table, not a model or summarizer. It emits
labels only on exact schema/type/range matches. Raw buffers are then
overwritten/released. Ambiguity, unknown required fields, overflow, free-text
persistence attempts, or destruction failure trigger the R2a global incident
stop.

Persistent equality uses only the canonical normalized-result digest, never a
raw-output digest. Human display of provider text would require a later approved
volatile-view design and is not authorized here.

## 3. Hardlink-closed immutable sources

An admitted regular file with link count greater than one rejects by default.
It may pass only when an approved immutable-corpus manifest enumerates **every**
hardlink to the same platform file identity and proves every link is inside the
approved corpus root on the same qualified filesystem snapshot.

Acceptance requires:

- complete mount/snapshot-scoped enumeration with independently proved
  coverage, not a corpus-root-only search;
- canonical relative paths for every link and no outside-root path, alternate
  stream, bind alias, reparse/magic path, or unenumerated name;
- no-follow open beneath an already-open root for each path, all bound to the
  same volume/mount and file identity;
- bound pre-read and post-read link count, enumerated link-set digest, file
  identity, metadata/version, immutable snapshot/lease identity, and admitted
  source-bytes digest; and
- final pre-spawn proof that snapshot/lease and link set remain current. Packet
  building continues from descriptor-read bytes only.

If the platform cannot enumerate all links on the relevant filesystem or
prevent/detect link-set mutation through dispatch, link count above one returns
`SOURCE_HARDLINK_UNPROVEN`. Owner/mode, `realpath`, equal inode/file ID, or an
inside-root scan cannot waive rejection.

Negative tests create an outside-root hardlink before admission, between open
and read, after read but before spawn, and concurrently with enumeration. Every
case rejects before provider dispatch even when inside-root paths and bytes are
unchanged. Tests also cover an unenumerated inside-root link, link
removal/replacement, snapshot/volume change, enumeration truncation, and false
reported count. A multi-link fixture passes only on a qualified immutable
snapshot with complete manifest equality before/after read and at pre-spawn.

## 4. Self-assessment

R2a.1 design-readiness self-score: **97/100**.  
Independent R2a.1 review: **not run**.  
Residuals addressed: **three of three**.  
Qualified routes: **zero; qualification remains required**.  
Implementation/runtime changes: **none**.

Open qualification work is fail-closed: prove the host-specific trusted
principal, canary observation points, and filesystem-wide hardlink
enumeration/immutability substrate. These are not permissions for weaker
fallbacks.
