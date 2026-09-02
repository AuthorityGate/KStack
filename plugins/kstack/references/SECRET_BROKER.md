# KStack Secret Broker contract

The Secret Broker exposes safe metadata and opaque handles. It has no value
read, reveal, export, render, template, arbitrary-shell, arbitrary-URL, or
generic environment-injection operation.

## Current implementation fence

The accepted design is machine-bound, but the current implementation is not
conformant. `kstack-secret-broker.mjs status` therefore still reports exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. That top-level state is accurate
and not a placeholder: SB-TC10 makes the external evidence authority the only
source of an evidence level, and neither it nor the WP04 identity/time/lease and
WP05 audit-chain items exist yet, so no cell can hold any level above `NONE`.
Inventory validation and content-free planning remain available, but every plan
item is `UNAVAILABLE`; a caller-declared qualified cell is explicitly
non-authoritative.

One out-of-sequence fence narrowing on the WP13-LINUX cell, which is not a work
package, narrows the Linux half of that fence and only that half, under this
document's own rule that the fence may be narrowed by a later reviewed
implementation item. It holds no position in the SB-TC12 sequence: WP13-LINUX
depends on WP07–WP12, none of which are built, so the Linux cell has not begun
and this work must not be cited as evidence that it has. It is a
source-level narrowing, not a rollout-state transition: the cell has entered no
SB-TC10 section 10 state, because any rollout advance needs a threshold-signed
`ROLLOUT_CHANGED` event on an evidence authority that does not exist yet. The admitted set is bounded by the same
isolated-generated-fixture principle `DEV_SYNTHETIC` describes, without claiming
that state. The Linux worker admits exactly `Probe`, `SyntheticLifecycle`, and
`SyntheticJiraAdapter`, which use only newly generated non-production fixtures
and attempt to destroy them before reporting success. Only `Probe` verifies that
destruction by re-reading; the two synthetic modes rely on the backend reporting
its own clear succeeded, so a backend whose clear exits 0 without deleting would
leave a fixture behind and still report a pass. Isolation there is
by random handle rather than by namespace: `Probe` and an argument-less
`SyntheticLifecycle` run against the operator's real login keyring, so a fixture
they cannot confirm destroying is a fixture left in it, which is why an
unconfirmed cleanup fails the run instead of being reported as success.
`EnrollInteractive`, `RotateInteractive`, `Revoke`, `Inventory`, and
`JiraAuthCheck` — every mode that can reach an owner value or the persistent
handle root — still fail with the unchanged
`KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE` before probing custody,
changing state, resolving a value, or contacting a target. The admitted set is a
worker code constant; no file, environment variable, or caller argument can widen
it, because a writable rollout state would be exactly the caller-selected
authority SB-TC10 section 5 forbids. The Windows worker entry point is unchanged
and remains fenced in full.

`status` additionally reports a per-cell section carrying the cell identity, its
single adapter, and the admitted mode set, all from source constants. It
deliberately measures nothing about the host: present platform and session
prerequisites are the SB-TC10 section 9 `DISCOVERED` predicate, and section 5
forbids deriving qualification from a mutable index, so a freshly computed
prerequisite check published here would be exactly that index. The section is
fixed `evidenceLevel: "NONE"` and `claim: "BOUNDARY_ONLY_NOT_AUTHORITATIVE"`,
names no rollout state, and authorizes nothing. The remaining fence may be
narrowed only by a further reviewed implementation item on the accepted design
set.

WP02 supplies only the value-free configuration and package foundation. One
bounded duplicate-safe reader accepts exact legacy schema 1 as human-formatted
JSON, rejects a broker block there, and accepts schema 2 only as canonical JSON
with closed keys at every level. The synthetic migrator retains the exact v1
preimage, journals and fsyncs the change, serializes every known repository
config writer under one private lock derived only from the canonical config
path, and uses a durable candidate plus an exclusive claim/install protocol.
That protocol verifies the claimed inode after rename, never overwrites a path
occupied by another writer, and recovers a crash with the active path absent or
with either complete version installed. Journals, backups, fences, candidates,
and locks are published only after their complete bytes are fsynced. Every
artifact path must be distinct under portable case-folded normalization and,
when it already exists, filesystem identity, so a Windows case alias or hard
link cannot substitute for the retained preimage. The journal lock's
stale-owner path is serialized by a separate exclusive reaper; an existing
reaper is checked before main-lock acquisition, so even a reaper-only crash
state fails closed for explicit operator recovery rather than risking removal
of a newly acquired live lock. The native Windows Jira handoff
obtains only a fixed value-free projection from the shared WSL config reader
and never parses repository config directly. The
journal binds the only admitted fence path. An intact durable
`CONFIG_V2_COMMITTED` fence plus committed journal phase permanently denies v1
rollback through the WP02 API before any later protected effect may begin.
These same-principal files are not a custody or anti-tamper boundary: deletion
or mutation produces explicit drift and fails closed, while stronger protected
retention remains future work. WP02 does not migrate this repository's live
configuration or contact its credential source.

The Secret Broker release and source-audit manifests are deliberately acyclic:
the release manifest excludes both manifests, while the self-excluding source
audit includes and digest-binds the canonical completed release manifest.
Publication provenance is a
third external record signed by builder, security-approver, and publisher
principals with distinct references and distinct Ed25519 public keys. The WP02
verifier can prove only cryptographic agreement with caller-supplied bytes;
that result is explicitly `SIGNED_PUBLICATION_CALLER_VERIFIED` and is never
pilot- or production-eligible. No shipped installer or protected adapter
supplies an authenticated operator pin or installed-byte binding yet.
Consequently an ordinary checkout remains `UNSIGNED_DEVELOPMENT`, and
caller-created roots, keys, labels, or signatures cannot bootstrap trust.

WP03 adds only the protected-control-plane record and adapter boundary. Closed
canonical authority heads advance a positive epoch by exact compare-and-
advance, bind the prior head digest, and require adapter-issued 256-bit CSPRNG
update IDs that are retired on every attempted CAS, including mismatch. If a
pre-commit retirement write cannot be durably confirmed, the operation returns
only `ACKNOWLEDGEMENT_UNKNOWN` and deliberately retains a store-wide fence so
the attempted ID cannot be reused. The synthetic store binds its authority namespace once and
its audit namespace/initial epoch once, so another caller-selected lineage
cannot bypass the retained heads. Closed canonical audit heads expose only
`AcquireWriter`, `ReadHead`, and exact `CompareAndAdvance`; one unexpired writer
owns the bound namespace/epoch, every successor keeps its exact lease and
advances one ordinal, and any possibly committed failure is reconciled by
read-only exact comparison without retry.
The first locked entry after writer-lease expiry retains the store-wide fence:
mutating surfaces return only `ACKNOWLEDGEMENT_UNKNOWN`, while open and
read-only surfaces fail with the fixed locked-state error. Writer reacquisition,
update-ID issuance, authority work, mismatched audit CAS, and all later access
remain blocked pending explicit operator recovery. Non-string roots, throwing
prospective-object and exported head-codec accessors, invalid/throwing clocks,
lease deadlines beyond canonical UTC year 9999, and descriptor-read/close
failures normalize to fixed typed errors.
Neither interface has a generic set, reset, delete, truncate, import, locator,
value-read, caller-selected epoch, or caller-selected ordinal operation.

The shipped WP03 adapter is a file-backed fault-injection fixture, not protected
production storage. Its identity is permanently `SYNTHETIC_UNQUALIFIED` with
`productionEligible: false`. It can demonstrate restart durability and reject
an older or forked broker snapshot only when its private root is kept outside
that snapshot. It does not resist a principal who can copy, replace, or tamper
with both roots; it is not independently administered, hardware monotonic,
trusted-time qualified, or eligible for pilot/production evidence. Missing
state, identity drift, aliases, or lock residue fail closed without automatic
reset or reinitialization. Open, status, reads, snapshot verification, and
mutations all serialize through the same exclusive lock; retained uncertainty
fences make every one of those surfaces unavailable. WP04 still owns trusted identity/time/lease controls,
and WP05 still owns the audit event chain, MAC/key custody, receipts, incidents,
and evidence authority. The global runtime effect fence therefore remains
unchanged.

## Evidence levels

- `DISCOVERED`: a backend or adapter is present; no use claim.
- `CONFIGURED`: safe metadata and identity binding validate.
- `SYNTHETIC_QUALIFIED`: lifecycle and leakage fixtures pass using generated
  non-production values.
- `PILOT_VALIDATED`: one owner-authorized real entry completes target-bound use,
  rotation, recovery, and rollback with its source retained.
- `PRODUCTION_APPROVED`: the exact backend/platform/adapter cell has independent
  review, operational ownership, monitoring, and promotion approval.

No level can be inferred from another platform, backend, adapter, or target.

## Migration definition

Enrollment is not migration completion. A migration is complete only when the
destination record is read back, the intended target operation succeeds, a
replacement generation succeeds, recovery is proven, the observation window
passes, the source is separately retired, and non-resurrection checks pass.
Unknown target or provider outcomes remain ambiguous and block retry.

## Initial cells

Windows current-user DPAPI custody remains experimental generic broker work.
Its claim is limited to the logged-in Windows user boundary; it does not claim
protection from that user's compromised processes, administrator, kernel, or
debugger. Its Jira adapter is retired and must not be used to create a second
Jira credential path.

Linux has a separate desktop Secret Service implementation cell. It uses the
fixed `/usr/bin/secret-tool` interface in the logged-in D-Bus session and stores
only safe handle metadata in private Linux state. Under that fence narrowing its
`Probe`,
`SyntheticLifecycle`, and `SyntheticJiraAdapter` modes reach the backend; every
owner-value mode stays fenced. The cell remains unqualified regardless: passing
those three modes is a mechanism precedent, not evidence, until the exact cell
produces admitted evidence through the SB-TC10 authority. Headless Linux and WSL
without an admitted Secret Service provider fail closed at
`KSTACK_SECRET_LINUX_SERVICE_UNAVAILABLE`, which is a genuine absent-backend
result and never a qualification claim. This optional cell does not replace or
migrate an already enrolled repository Jira source.

The Linux cell serves only `jira-cloud-auth-v1` against
`https://TENANT.atlassian.net`. Its synthetic modes accept a protocol double
only through `--test-root` and `--test-secret-tool`, which are refused for
`Probe` and for every fenced mode, require a root the worker creates itself so
its own recursive cleanup can never reach a caller's existing tree, and are for
the repository's guarded test alone. A model-facing process must never spawn
this worker. Enrollment, stored-record validation, and the
migration planner all reject every other adapter, so no other credential class
can be migrated through this cell today. A credential bound to any other
provider API needs a new reviewed SB-TC04 adapter; it is not unblocked by that
fence change.

The KStack repository's Jira credential and executor remain solely in WSL at
the source enrolled by `.kstack/config.json`. Native Windows Jira work uses the
closed `kstack-jira-wsl.ps1` handoff to that WSL executor; credential bytes
never cross into Windows. Qualification does not transfer between Windows,
Linux desktop, and WSL.

OpenBao is the provisional production/self-hosted cell. It remains unavailable
until its version, workload identity or auto-auth bootstrap, namespace, policy,
audit admission, deadlines, ambiguity behavior, and recovery ownership are
independently qualified. There is no fallback from OpenBao to a local file or
development backend.

## Inventory boundary

Inventory entries contain purpose, credential kind, environment class, target
label, custody family, desired backend, adapter ID, rotation intent, and source
retention policy. They contain no value, path, endpoint, account, username,
tenant, host name, provider response, or free-form notes.

The source itself is opaque, including its apparent format. A request to learn
field names, delimiters, line counts, key count, or other structure is still a
source read and is forbidden through model-facing or generic tools. Only an
independently reviewed exact-format importer may consume an existing source;
otherwise the owner creates a replacement credential and enters it directly at
the trusted no-echo enrollment prompt. Any value emitted to a model-visible
channel is compromised and must be rotated before enrollment or use.

## Operational notes

2026-08-29: In downstream KStack-managed AGILB under AuthorityGate, an owner-
directed model-facing read of a plaintext credential file exposed an Atlassian
API token to model context. The value was treated as compromised and required
rotation before enrollment or use; it was neither enrolled nor reused. Even
when an owner says to "look at" or "use" a credential file, the implementer or
orchestrator must keep it opaque and redirect to the broker's no-echo enrollment
prompt.

Hosted account-level OAuth MCP connectors, including Jira/Atlassian connectors
authorized through interactive `/mcp`, have not reliably retained authorization
across sessions in this environment and have required repeated manual re-auth.
For automated or unattended Jira/Atlassian operations, use the exact credential
source already enrolled by the repository. Do not infer that an interactive
OAuth connector outage requires a new platform credential. Linux Secret Service
is an interactive desktop development cell, not a headless or production
credential source.
