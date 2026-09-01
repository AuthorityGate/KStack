# KStack Secret Broker — WP03 protected control plane

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Work package | `SB-WP03` / Jira KSTK-135 |
| Jira stable item digest | `23e38221e7bc287a1add183da46795954e95f2e929b09bc008c2c5960a9bec40` |
| Integrated dependency | SB-TC12 SHA-256 `0c516367cbf7ab6088f17f54594abd364119ad9020c90ca52ca64ed9739b681e` |
| Direct contracts | SB-TC02 SHA-256 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 SHA-256 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC07 SHA-256 `6635aa11e3769c33541a0807fdedd7d497ae7274f01054d2ee9e83703a4d5a4b`; SB-TC10 SHA-256 `a96c00d5e1d87ba690730ebf09856ab44cf8b99c18c2ea6b5127dbcce2b7168a` |
| Dependency implementation | SB-WP02 final record SHA-256 `03184c8b95a070563caccb61d810f3cc7125908165a1a7c36a120e5f71e3118c` |
| Disposition | `R7_REPAIRED`; completion remains pending exact-candidate binding and independent R8 review |
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
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `a2e2da05fb21077b01835d1f3c1cbdbc1e6d8e7bc194885313e9dc60e4af02e4` | closed authority/audit codecs with single-snapshot caller-record validation, fixed-error reflection boundaries, CSPRNG update-ID generator, successors, digests, and read-only reconciliation |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `e504387c854002c45c20cca71d522798131eff0c3be68ad62fd24b5c9376938b` | one-lineage synthetic exact-CAS store, common-entry expiry fence, canonical-time lease bounds, update-ID authority, branded typed-error boundary, and fault injection |
| `tests/secret-broker-protected-state.test.mjs` | `311e2ba6c6909866e8148d796423efd4d4b3777554780720d4a64f034df83920` | lineage/freshness/rollback/restart/crash/ack/replay/all-boundary retirement/all-entry expiry/public-lock/stateful-accessor/hostile-reflection/canonical-clock/loss regressions |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` | release closure for new modules, schemas, and synthetic protocol |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `91cd0499261da863d855117b6fdc489a7010aa5de1733279f5161f95e9b6d251` | generated acyclic release leaf root |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `92cdedefd028afe0f2109f352ad322044270ec647e0d554251969540051e7b1e` | generated self-excluding source audit |
| `plugins/kstack/install-health-contract-v1.json` | `2060957fe40534c4c09bc0d2bb41d233db3c301cfde4987ec037eae5688f5a54` | 20-probe installed validation contract |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `c391a0c4fe209f391c28bf21aa20614f4740b394c93623703fba542e0d994602` | distributed source-byte closure |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` | truthful synthetic/production ownership and canonical-time boundary |
| `tests/reflexion-architecture-gate.mjs` | `0ab2092ec6834941d49c366ae18a196c234647e67c02d04efa3a7d77b5ccfff5` | exact importer/capability/use-site registration |
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

## Observed verification

- R7-repaired combined protected-state, release, install-health, architecture,
  and safety matrix: 65 tests, 65 passed, zero failed or skipped; duration
  `32931.602843ms`.
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
Independent R8 remains required for the exact repaired candidate.

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
