# KStack Secret Broker — WP03 protected control plane

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Work package | `SB-WP03` / Jira KSTK-135 |
| Jira stable item digest | `23e38221e7bc287a1add183da46795954e95f2e929b09bc008c2c5960a9bec40` |
| Integrated dependency | SB-TC12 SHA-256 `0c516367cbf7ab6088f17f54594abd364119ad9020c90ca52ca64ed9739b681e` |
| Direct contracts | SB-TC02 SHA-256 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 SHA-256 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC07 SHA-256 `6635aa11e3769c33541a0807fdedd7d497ae7274f01054d2ee9e83703a4d5a4b`; SB-TC10 SHA-256 `a96c00d5e1d87ba690730ebf09856ab44cf8b99c18c2ea6b5127dbcce2b7168a` |
| Dependency implementation | SB-WP02 final record SHA-256 `03184c8b95a070563caccb61d810f3cc7125908165a1a7c36a120e5f71e3118c` |
| Disposition | `R10_REPAIRED`; completion remains pending exact-candidate binding and independent R11 review |
| Runtime effect state | `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT` |

## Outcome

WP03 implements the value-free protected-control-plane primitives required by
the accepted design, plus an explicitly synthetic, unqualified adapter used
only to exercise them:

- closed canonical authority and audit head codecs reject extra fields,
  malformed or noncanonical bytes, invalid generations, invalid trusted
  instants, and malformed digests;
- authority epochs advance by exact compare-and-advance, bind the prior head
  digest, use adapter-issued canonical 256-bit CSPRNG update IDs that are
  retired on every attempted CAS; an unconfirmed retirement durably fences the
  entire store from reuse, epochs never decrement, and the interface exposes
  read-only `COMMITTED`, `UNCOMMITTED`, or `UNCERTAIN` reconciliation;
- the synthetic store binds one authority namespace and one audit namespace
  with fixed initial epoch one, preventing a stale client from minting a
  parallel lineage around the retained heads;
- audit heads grant at most one unexpired writer for the bound namespace/epoch,
  advance exactly one ordinal with the exact current lease and event digest,
  retire every update and writer-lease ID, detect writer-lease expiry before
  every locked entry action, retain the store-wide fence, and never retry an
  uncertain CAS;
- the synthetic adapter stores its fixed identity and current heads outside the
  caller-supplied broker snapshot root, uses private regular files and an
  exclusive lock for both reads and mutations, fsyncs state replacement,
  rejects symlinks/hard links,
  detects state loss and identity drift, refuses automatic stale-lock recovery,
  and makes open, readiness, read, and snapshot-verification surfaces
  unavailable while any lock residue exists; and
- rollback, fork, restart, expectation mismatch, acknowledgement loss, crash
  before/after commit, post-replacement filesystem failure, lease
  expiry/reacquisition, mismatch-ID retirement, unissued/retired-ID replay,
  retirement failure at every persistence boundary, competing read-lock
  acquisition, missing state, identity drift, and lock residue are executable
  regressions.

The adapter is permanently identified as `SYNTHETIC_UNQUALIFIED` with
`productionEligible: false`. It is not an OS protected store, HSM, TPM,
monotonic hardware counter, independently administered service, trusted-time
source, or production audit-head service. A caller must place its root outside
the broker snapshot for the rollback/fork fixtures to mean what they claim;
copying or tampering with both the broker and this synthetic store is outside
its security claim and is expected to be caught only by a later qualified
adapter.

## Closed interfaces

The authority record contains only schema version, opaque namespace reference,
positive epoch, prior-authority digest or genesis, and last update ID. The audit
record contains only schema version, opaque namespace reference, positive
epoch, ordinal, event digest or origin, opaque writer-lease reference, lease
deadline, and last update ID.

The adapter exposes only one-time initialization/read/exact-CAS/snapshot
verification for authority state, CSPRNG update-ID issuance, and one-time
namespace binding/acquire-writer/read/exact-CAS/snapshot verification for audit
state. It has no generic set, delete, reset, truncate, import, locator,
value read, value export, arbitrary namespace mutation, caller-selected epoch,
caller-selected ordinal, or production-promotion operation.

All prospective successor inputs and closed fault options are fully validated
before protected-state lookup or lock acquisition. A mismatched expected head
returns only `EXPECTATION_MISMATCH`; it does not reveal the current head, and
its update ID is permanently retired. Any error after a state replacement may
have committed is normalized to `ACKNOWLEDGEMENT_UNKNOWN`, reconciled by an
exact read comparison, and never resubmitted.

## R1 independent review and repair

The independent R1 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r1/codex.md` has SHA-256
`1e75bae179475c19a75638138cc90938bd6d05827b8fdf879cf8816fd9c6e709`
and returned `revise/98`, five failed checks, three security findings, zero
material dissent, and zero unresolved questions. It found that the R0 fixture
allowed parallel caller-selected lineages, accepted merely well-formed rather
than adapter-issued update IDs and reused mismatch IDs, reported ready through
lock residue, accepted open request/fault option shapes, leaked potentially
committed filesystem errors, accepted an epoch-one non-genesis authority head,
and contained an audit negative assertion that passed through an undefined
identifier.

The repaired implementation closes each finding directly. Authority and audit
lineages are one-time bindings; audit origin is fixed to epoch one; the adapter
issues CSPRNG update IDs and consumes each issued ID before evaluating the CAS;
all request and fault-option objects are closed and prevalidated; lock residue
blocks every readiness surface; post-replacement and post-release uncertainty
returns `ACKNOWLEDGEMENT_UNKNOWN`; the authority cross-field invariant is
bidirectional; and the audit digest test now checks the exact typed error. The
R0 verification record remains retained as superseded history and is not proof
for the repaired candidate.

## R2 independent review and repair

The independent R2 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r2/codex.md` has SHA-256
`19130cb64510064e26a00c7091e0d353524294479c72651fe4f557373d5d3a7d`
and returned `revise/99`, one failed check, one security finding, zero material
dissent, and zero unresolved questions. It reproduced a pre-rename filesystem
failure while persisting update-ID retirement: the raw error released the
exclusive lock, left the admitted ID reusable, and a retry advanced the
authority epoch. Adversarial follow-up also exposed a read-lock time-of-check /
time-of-use window in which a competing lock could appear after the absence
check.

The R2 repair classifies every failure before retirement replacement as
write-uncertain, returns only `ACKNOWLEDGEMENT_UNKNOWN`, and deliberately
retains the store-wide exclusive lock. The fenced store cannot open, report
ready, read, verify a snapshot, or admit another mutation until explicit
operator recovery; consequently the attempted update ID cannot be reused.
Every public read and status path now runs under the same exclusive lock, so a
competing lock cannot enter between validation and state access. Fault tests
cover temp-file open, write, fsync, close, and pre-rename retirement boundaries
for both authority and audit state, plus competing acquisition on every public
open, status, read, and snapshot surface.

## R3 independent review and repair

The independent R3 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r3/codex.md` has SHA-256
`1a2b0ffaf9e958c741b7c0be56dbbbc26716a3d2af9fe3eea5be7471a737f75d`
and returned `revise/98`, four failed checks, two security findings, zero
material dissent, and one sandbox-limitation question. It found that audit
writer-lease expiry returned an undeclared result and allowed reacquisition;
non-string roots, throwing clocks, and descriptor-close failures could escape
raw; the retirement and competing-lock matrix did not cover every claimed
boundary and public surface; and this record contained one incorrect WP02
dependency digest.

The R3 repair converts audit lease expiry to `ACKNOWLEDGEMENT_UNKNOWN` while
retaining the store-wide fence, so reacquisition and later advancement are
blocked pending explicit recovery. Root and clock validation plus descriptor
close failures now normalize to fixed typed errors. The test matrix covers all
five retirement persistence boundaries for authority and audit independently,
and injects a competing lock on every public open/status/read/snapshot surface.
The WP02 record digest is corrected to the inspected accepted bytes. R3's
read-only `/tmp` limitation is not implementation evidence; the writable
value-free verification run and the next independent review must execute the
matrix before closure.

## Ownership retained by later work packages

WP03 does not implement trusted identity, policy, approval previews, lease
authority, trusted time, reboot/suspend continuity, the canonical audit event
chain, audit MAC/key custody, evidence signer roles, candidate activation,
provider custody, target execution, lifecycle mutation, no-echo enrollment,
qualification, pilot, production promotion, deployment, or release authority.

WP04 owns identity/policy/approval/lease and trusted-time use. WP05 owns the
audit chain, MAC/key epoch, receipts, incidents, and evidence authority. The
release manifest therefore names only the protected head/store schemas and the
synthetic adapter protocol; the full audit and qualification protocols remain
`UNAVAILABLE`.

No credential, repository Jira source, provider, target, protected OS service,
clipboard, environment injection, or model-visible value route was contacted
or opened while implementing or testing WP03. The repository Jira executor
remains solely the enrolled WSL route.

## Concurrent owner-directed safety enrollment amendment

On 2026-09-01 the owner explicitly removed filesystem permission metadata as a
prerequisite for project safety-hook enrollment. The same review candidate
therefore also removes the group/world mode-bit rejection from canonical
project `.kstack` state while retaining canonical-path, regular-file,
descriptor/path identity, ownership where the runtime exposes it, bounded
parsing, policy-digest, and release-digest checks. Credential-store validation
is unchanged. The live Windows-mounted WSL workspace reports safety status
`ENABLED` without a DrvFS `metadata` option.

| Path | SHA-256 | Role |
|---|---|---|
| `plugins/kstack/scripts/kstack-safety-hook.mjs` | `f52c38f07803f0fd17f0e76914ca501e3c06ebed8b6d3c722fc7500d22cc15a7` | canonical project-state default trust with digest tamper detection |
| `tests/safety-hooks.test.mjs` | `0ece658084f6df8d5c8525761c968647d2871ea568fb24169005ce006fa00b98` | executable permissive-mode enrollment regression plus unchanged credential-store matrix |
| `plugins/kstack/references/SAFETY.md` | `dfe3705e3bea9a9fda6c779161b6998f03e596f31c28332f4d98476b495b9944` | current cross-platform project-state trust boundary |

## Frozen candidate files

| Path | SHA-256 | Role |
|---|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `07f2556b500341d973fd2e38ad635bc154ce7afccc2dd18d6d3aea9119437319` | closed authority/audit codecs with captured descriptor reflection, interceptor-safe fixed errors, single-snapshot caller-record validation, CSPRNG update-ID generator, successors, digests, and read-only reconciliation |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `dd7a7247183796eac33dda5a8bbe233b701feff0a926df28f16004133f5a2f54` | one-lineage synthetic exact-CAS store, module-private error provenance, descriptor-closed requests, common-entry expiry fence, canonical-time lease bounds, update-ID authority, immutable snapshot brand operation, and fault injection |
| `tests/secret-broker-protected-state.test.mjs` | `aca1d2c64227392feb02f875f18ee1cb40b6cef3f754480c7f481a3812e5e8ff` | lineage/freshness/rollback/restart/crash/ack/replay/all-boundary retirement/all-entry expiry/public-lock/stateful-accessor/prototype/error-interceptor/instance-spoof/symbol/non-enumerable/hostile-reflection/canonical-clock/loss regressions |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` | release closure for new modules, schemas, and synthetic protocol |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `f1eae3a3993cf02f3b294b4d695ecbebd8b66f672bbc6f2d90ccc1957b9c2ca3` | generated acyclic release leaf root |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `388da6ab40b896942c28ac30120ffdc610e44de02ba53000804bdcfa27f05c0c` | generated self-excluding source audit |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` | 20-probe installed validation contract |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `316352531d187322020ce23b698693af6f873303bb15477d71afefbc2e6347b1` | distributed source-byte closure |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` | truthful synthetic/production ownership and canonical-time boundary |
| `tests/reflexion-architecture-gate.mjs` | `c7ab9663ed4a64c49ce9f4029c84e5080e9319fdec3ac0db3665bb6f297b65e1` | exact importer/capability/use-site registration |
| `tests/install-health.test.mjs` | `bd233007b4d14b539ad7acaad538ac5a681d38d92b0b3442f764df0380f51030` | 20-probe and unavailable-mode regression |

## R6 independent review and repair

The independent R6 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r6/codex.md` has SHA-256
`eacd61de4065e0f53fffefee1e7efbeeb3f2214ef4411481da443ef4d29c0089`
and returned `revise/99`, two failed checks, one security finding, zero
material dissent, and zero unresolved questions. It reproduced that a caller
could throw the exported, publicly constructible `SecretControlPlaneError`
from a hostile head accessor and bypass the R5 catch/rethrow normalization. It
also found that hostile `getPrototypeOf` reflection during parser input type
classification occurred before the encoding-error boundary.

The R6 repair unconditionally replaces every exception raised while inspecting
a caller-supplied authority or audit head with the applicable fixed head error;
the public exception class is no longer treated as evidence of internal
provenance. Both parsers now classify byte input inside their fixed encoding-
error boundary. Direct regressions exercise ordinary errors and caller-created
`SecretControlPlaneError` instances through every validator, codec, digest,
successor, and reconciliation side, plus hostile parser-input proxies.

## R7 independent review and repair

The independent R7 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r7/codex.md` has SHA-256
`d028dd1cfbbfccca0f5fb1d22c7c933878e8bd4adfa902bc845dd712ca0d9f9f`
and returned `revise/99`, two failed checks, two security findings, zero
material dissent, and zero unresolved questions. It reproduced a time-of-check
/ time-of-use bypass in which non-throwing stateful head accessors passed live
validation and then changed while being copied, permitting returned or encoded
heads that failed immediate revalidation. It also reproduced raw diagnostic
escapes through hostile update-ID options and snapshot-adapter prototype
reflection.

The R7 repair snapshots each caller record exactly once from own property
descriptors inside the fixed-error boundary, accepts only a plain closed record
of enumerable data properties, validates that immutable snapshot, and returns
or encodes only the validated snapshot. Update-ID option extraction is now
inside the same boundary and its selectable error code is restricted to the
closed internal code set. Snapshot adapter classification catches all hostile
reflection first and then calls the prototype method directly to enforce the
real private-field brand. Regressions exercise stateful accessors and hostile
proxies through every authority/audit validator, codec, digest, successor,
reconciliation side, update-ID option boundary, and snapshot adapter boundary.

## R8 independent review and repair

The independent R8 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r8/codex.md` has SHA-256
`49e0d25b95f8f1b9201cb5e2f9b08d6bd4631d1dcc10bd90f95b740071d74d75`
and returned `revise/99`, three failed checks, two security findings, zero
material dissent, and zero unresolved questions. It reproduced that the R7
snapshot boundary dynamically read a mutable exported prototype method and
trusted mutable `Symbol.hasInstance` behavior. Same-realm mutation could
therefore forge canonical snapshot status for a plain object or expose a raw
private-field `TypeError`. It also corrected the named five-file focused matrix
from 65 tests to its actual 57; the separate runtime-faithful architecture
suite remains 9/9.

The R8 repair captures both `Reflect.apply` and the genuine status/private-field
brand operation in module-private bindings before any caller can mutate the
exported class. It no longer uses `instanceof` to authenticate either the
adapter or an exported error. Every caught status failure is reconstructed from
a closed allowlist as a fresh fixed error, and the returned status record must
match its exact fixed three-field shape before canonical output is emitted.
Regressions mutate the exported prototype method, its public `.call` property,
both exported classes' `Symbol.hasInstance` behavior, and a proxy-wrapped real
adapter; none can forge output or release raw diagnostics.

## R9 independent review and repair

The independent R9 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r9/codex.md` has SHA-256
`aee4275585796eec233b1785a566b8f9487d8df55a59b3086dac6ef25e580f4c`
and returned `revise/99`, three failed checks, two security findings, zero
material dissent, and zero unresolved questions. It reproduced that exported
error-prototype `name` or `code` setters could intercept fresh fixed-error
construction, that internal storage classification still trusted mutable
`SyntheticProtectedStateError[Symbol.hasInstance]`, and that three request
validators ignored symbol and non-enumerable fields.

The R9 repair defines every fixed/private error field through a captured own-
data-property operation, brands internal error provenance in a module-private
`WeakMap`, and eliminates all internal `instanceof` classification for the
exported control-plane and protected-state errors. Storage errors are reduced
only through the private brand; raw filesystem/runtime errors are normalized.
Open, advance, and audit-writer requests are captured once from own property
descriptors with `Reflect.ownKeys`, reject accessors, symbols, non-enumerable
fields, and unknown fields, and operate only on the captured record.
Regressions reproduce the R9 prototype-setter, mutable `Symbol.hasInstance`,
symbol-field, and non-enumerable-field attacks.

## R10 independent review and repair

The independent R10 receipt at
`.kstack/reviews/secret-broker-2026-08-28-wp03-r10/codex.md` has SHA-256
`e32a1e5d765fc242c0a92a620ea3fe29ea6a4a20f338b92c779e01fa24374a76`
and returned `revise/99`, two failed checks, two security findings, zero
material dissent, and zero unresolved questions. It reproduced post-import
mutation of `Array.prototype.some`/`includes`, `Set.prototype.has`, and
`RegExp.prototype.test` bypassing record closure, the fixed diagnostic
allowlist, and canonical update-ID validation before a protected CAS.

The R10 repair captures each of those exact intrinsics at module initialization
and invokes it only through captured `Reflect.apply`. All protected-state array
membership decisions now use the captured primitive as well. A post-import
mutation regression proves that symbol and string extras, caller-selected error
codes, and noncanonical update IDs remain fixed-error rejections, and that a
rejected advance does not consume its update ID.

## Observed verification

- R9-repaired exact five-file focused matrix: 57 tests, 57 passed, zero failed
  or skipped; duration `21807.206871ms`.
- R9-repaired runtime-faithful architecture matrix: 9 tests, 9 passed, zero
  failed or skipped; duration `5727.784043ms`.
- R9-repaired Secret Broker CLI matrix: 24 tests, 22 passed, zero failed, and
  two expected environment-gated skips; duration `506.164035ms`.
- R9-repaired full repository suite: 1,063 tests, 1,061 passed, zero failed,
  and two expected environment-gated skips; duration `79996.262578ms`.
- Both generated-manifest checks and `git diff --check` passed without output.

- R10-repaired exact five-file focused matrix: 57 tests, 57 passed, zero failed
  or skipped; duration `21788.363488ms`.
- R10-repaired runtime-faithful architecture matrix: 9 tests, 9 passed, zero
  failed or skipped; duration `5658.464581ms`.
- R10-repaired Secret Broker CLI matrix: 24 tests, 22 passed, zero failed, and
  two expected environment-gated skips; duration `456.280697ms`.
- R10-repaired full repository suite: 1,063 tests, 1,061 passed, zero failed,
  and two expected environment-gated skips; duration `75255.092903ms`.
- Both generated-manifest checks and `git diff --check` passed without output.

- R8-repaired exact five-file focused matrix: 57 tests, 57 passed, zero failed
  or skipped; duration `22153.295481ms`.
- R8-repaired runtime-faithful architecture matrix: 9 tests, 9 passed, zero
  failed or skipped; duration `5638.911579ms`.
- R8-repaired Secret Broker CLI matrix: 24 tests, 22 passed, zero failed, and
  two expected environment-gated skips; duration `460.985713ms`.
- R8-repaired full repository suite: 1,063 tests, 1,061 passed, zero failed,
  and two expected environment-gated skips; duration `86562.202941ms`.

- R7-repaired exact five-file focused matrix was 57 tests, not 65. R8
  independently reproduced the 57/57 result and corrected that historical
  count; its separately executed runtime-faithful architecture matrix passed
  9/9.
- R7-repaired full repository suite: 1,063 tests, 1,061 passed, zero failed,
  and two expected environment-gated skips; duration `113823.240241ms`.
- R7-repaired Secret Broker CLI matrix: 24 tests, 22 passed, zero failed, and
  two expected environment-gated skips; duration `554.106372ms`.

- R6-repaired combined protected-state, release, install-health, architecture,
  and safety matrix: 57 tests, 57 passed, zero failed or skipped; duration
  `22821.816697ms`.
- R6-repaired full repository suite after the owner-directed enrollment
  amendment: 1,063 tests, 1,061 passed, zero failed, and two expected
  environment-gated skips; duration `149304.352444ms`.
- Runtime-faithful architecture matrix: 9 tests, 9 passed, zero failed or
  skipped; duration `6317.366806ms`.
- The real native Windows PowerShell setup test passed inside the full suite.
- Release/source-audit generation check, install-health audit generation check,
  and `git diff --check` all passed without output.

R5 receipt SHA-256
`9095b5e999984fd2223fea35fba2082f394fde279af4371f38d2901da1bc2139`
returned `revise/99` with two failed checks and one security finding. The R5
repair normalizes reflection and property access inside every exported
authority/audit head validator and therefore every codec, digest, successor,
and reconciliation entry point that uses those validators. It also bounds
lease deadlines to the canonical four-digit-year trusted-instant domain before
`Date` construction. Direct exported-codec throwing-accessor tests plus
year-9999 equality and overflow tests exercise the repaired boundary. R6 then
identified and the current bytes repair exported-error spoofing and hostile
parser reflection. R7 then identified and the current bytes repair stateful
accessor instability plus the remaining exported-boundary raw-error escapes.
R8 identified and the current bytes repair mutable exported adapter/error
classification and the focused-count error. R9 identified and the current
bytes repair error-construction interception, remaining exported
`Symbol.hasInstance` trust, and symbol/non-enumerable request fields. R10
identified and the current bytes repair mutable array/set/regular-expression
intrinsics in the closed-record and update-ID decisions. Independent R11
remains required for the exact repaired candidate.

The two skips are the fenced real Windows protected worker and fenced real
Linux desktop Secret Service cell. The observed run made no network, Jira,
credential, provider, protected effect, publication, deployment, or rollback
contact.

## Exit gate

WP03 may close only after the exact candidate passes the focused matrix, both
generated-manifest checks, diff hygiene, the full repository suite, and an
independent read-only Codex review at confidence at least 93 with zero failed
checks, security findings, material dissent, and unresolved questions. Jira
KSTK-135 then records the same evidence before the next work package activates.
