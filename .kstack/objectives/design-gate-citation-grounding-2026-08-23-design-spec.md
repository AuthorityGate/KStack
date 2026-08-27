# Authoritative design specification: citation smoke exhaustion and state management

**Thread:** `design-gate-citation-grounding-2026-08-23`  
**Status:** proposed cumulative specification; design only  
**Baseline:** round 35 digest `f595927e81e412e28f24469d7dc694eb0dd701409eb149ed047ef24802cab0eb`, confidence 79  
**Evidence commit:** `2e664ba1e26043f838ab11f7d6fb96e851d383c0`

## Purpose, scope, and result

Citation grounding remains a deterministic packet-anchor-existence advisory,
not proof of semantic support, source truth, packet completeness, review
quality, or approval. This document covers only exact-reproduction smoke
exhaustion and its state-management operations. It authorizes no implementation
and does not reopen unrelated ledger items.

After three consecutive non-passing smoke starts for one deployment, another
start is refused only while an authenticated fixed 14-day lease is live. The
interval is half-open `[anchor, anchor + 14 days)`; the exact deadline begins a
new cycle.

The smoke command uses one convention everywhere: exhaustion is exactly bare
`SMOKE_ATTEMPTS_EXHAUSTED\n` and exit 2; invalid exhaustion-evaluation input
is exactly bare `STATE_MALFORMED\n` and exit 2. Neither has a parent reason,
detail, alias, or two-token form; both errors have no `.detail`. Missing state,
failed MAC, or local-instance-binding mismatch is authenticated absence, never
malformed, and starts generation/count/ordinal `1/1/1` without honoring raw
fields.

## Closed primitives

A primitive string/number has JavaScript type `string`/`number`. A plain
object is non-null, non-array, with `Object.prototype`; exact own keys means
its own enumerable string-key set exactly equals the stated set. A safe integer
satisfies `Number.isSafeInteger`; a nonnegative safe integer includes
`Number.MAX_SAFE_INTEGER`. hex-32/hex-64 are primitive lowercase ASCII
hexadecimal strings of exactly 32/64 characters.

A canonical timestamp is exactly `YYYY-MM-DDTHH:mm:ss.sssZ`, excludes year
`0000`, parses finitely, and round-trips through `Date.toISOString()`. The
process wall clock is only a valid `Date` or primitive finite millisecond
number. Strings, Booleans, null, BigInts, arrays, and coercible objects are not
times. Fourteen days is `14 * 24 * 60 * 60 * 1000` milliseconds.

Canonical JSON admits only null, primitive Unicode-scalar strings, Booleans,
nonnegative safe integers, arrays, and plain objects of admitted values.
Numbers use shortest decimal form, keys sort by UTF-8 bytes, strings use JSON
quoting/standard escapes, and there is no whitespace.

Atomic state replacement means complete canonical UTF-8 bytes are written to a
same-directory mode-0600 temporary regular file, flushed, renamed over the one
state path, then the directory is flushed. Failure before rename leaves old
state authoritative. The coordinator lock is the existing exclusive lock
serializing read/authenticate/validate/sign/replace. A provider invocation is
either external smoke reviewer call.

## Complete v2 schema and parse order

The Canonical-JSON state has exactly:

| Field | Contract |
|---|---|
| `stateSchemaVersion` | `kstack-citation-state-v2` |
| `deploymentFingerprint`, `stateRecordMac` | hex-64 |
| `platformReceiptBinding`, `localGateInstanceIdBinding` | closed objects below |
| `stateGeneration` | nonnegative safe integer, maximum admitted |
| `mutationInProgress` | null or closed mutation below |
| `smoke`, `shadow` | closed objects below |
| `advisoryRunsSinceGo` | integer 0..50 |

Local binding has exactly `bindingVersion` =
`kstack-local-gate-instance-binding-v1` and hex-64 `instanceIdDigest`.
Platform binding has exactly: `bindingVersion` =
`kstack-platform-receipt-state-binding-v1`; `receiptEncodingVersion` =
`kstack-receipt-binding-v1`; `receiptDigestVersion` =
`kstack-receipt-binding-digest-v1`; hex-64 `receiptDigest`;
`preconditionVersion` = `kstack-citation-filesystem-precondition-v1`;
primitive absolute paths `stateDirectoryPath`/`buildCacheRoot`;
shortest-form nonnegative decimal strings `stateDirectoryDevice`/
`buildCacheDevice`; `filesystemType` in `linux-9p`, `linux-ext`,
`linux-xfs`, `linux-btrfs`, `linux-tmpfs`, `linux-overlay`,
`linux-nfs`, `linux-cifs`, `linux-fuse`, `linux-ntfs3`, `linux-exfat`;
`buildCacheFilesystemType` in that list excluding 9p/nfs/cifs/fuse; and
`nativeAddonBinding` with exactly `abiVersion` =
`kstack-citation-fs-native-abi-v2`, hex-64 `artifactDigest`,
`packageName` = `@kstack/citation-fs-native`, nonempty primitive-string
`packageVersion` of at most 64 characters, and `targetTriple` =
`linux-x64-gnu` or `linux-arm64-gnu`.

Mutation has exactly `kind` (`smoke`/`shadow`), hex-32 `mutationId`, and
canonical `startedAt`. Shadow has exactly `judgment`, `dualRuns`,
`reasonCodes`, `completedAt`. Judgment is `not_run`/`go`/`no-go`.
Reason codes are at most eight entries selected from and ordered as
`no_material_loss`, `material_loss`, `semantic_distortion`,
`invocation_instability`, `overlay_unusable`, `other_review_needed`.
`not_run` requires 0 runs, empty reasons, null completion; `go`/`no-go`
requires 5..10 integer runs and canonical completion.

Smoke has exactly `result`, `smokeStartsThisCycle`, `attemptOrdinal`,
`fixtureHash`, `startedAt`, `completedAt`, `providerResultHashes`,
`providerStructuralCompleteness`, `providerExactMatchCounts`,
`combinedExactMatchCount`, `providerOrdinaryProseMismatchCounts`,
`combinedOrdinaryProseMismatchCount`. Result is `not_run`/`pass`/`fail`;
ordinal is integer 1..3; fixture/start are hex-64/canonical timestamp;
completion is null/canonical. Each provider array has two entries: hashes
null/hex-64, completeness Boolean, exact counts integer 0..50, prose counts
integer 0..30. Each combined count equals its two-entry sum.

Result invariants close the prior count/ordinal gap:

| Result | Count/ordinal | Evidence |
|---|---|---|
| `not_run` | count 1..3 equals ordinal | null completion/hashes, false completeness, zero counts |
| `fail` | count 1..3 equals ordinal | completion at/after start; pass condition false |
| `pass` | count 0; retained audit ordinal 1..3 | completion at/after start; pass condition true |

Pass means both completeness values are true, both hashes non-null, each exact
count at least 49, and each prose count zero. Pass resets count but retains the
completed attempt ordinal; equality is a non-pass invariant.

`parseCanonicalStateRecordV2(bytes)` rejects zero or more than 16,384 bytes,
fatal-UTF-8/JSON failure, any outer/nested validation failure, or Canonical-JSON
re-encoding unequal to input, all as bare `STATE_MALFORMED`. Only then does
authentication receive the parsed record. Tightening non-pass equality changes
no wire shape; current writers already satisfy it. A prior MAC-valid mismatch
becomes malformed.

## Authentication and immutable authority

The state MAC is HMAC-SHA-256 under a 32-byte key derived by HMAC-SHA-256 from
the 16-byte instance key and ASCII domain
`kstack-state-record-mac-key-v1`. Its message is the canonical record without
`stateRecordMac`, framed with
`kstack-state-record-mac-message-v1`. A frame is unsigned 64-bit big-endian
byte length plus bytes. Instance digest is SHA-256 over framed
`kstack-local-gate-instance-binding-digest-v1` and framed instance key.

After parsing: no file is authenticated absence; MAC mismatch is absence with
internal `macInvalid: true`; valid MAC but unequal current binding is absence
with internal `bindingMismatch: true`; only both valid create a wrapper.
Failure never becomes malformed and exposes no raw record.

```js
const authenticatedRecords = new WeakMap();
function makeAuthenticatedRecord(record) {
  const wrapper = Object.freeze({ status: 'authenticated' });
  authenticatedRecords.set(wrapper, structuredClone(record));
  return wrapper;
}
function authenticatedRecord(wrapper) {
  const record = wrapper && authenticatedRecords.get(wrapper);
  return record ? structuredClone(record) : null;
}
```

The wrapper exposes no nested record, lookalikes project to null, and each
projection is a fresh clone. This replaces the current shallow-frozen wrapper
whose nested cloned record remains mutable.

## Closed current inputs and saturated generation

Fresh deployment fingerprint must be primitive hex-64. Time is non-coercing:

```js
function smokeNowMilliseconds(now) {
  const value = now instanceof Date
    ? now.getTime()
    : (typeof now === 'number' ? now : Number.NaN);
  if (!Number.isFinite(value)) throw stateError('STATE_MALFORMED');
  return value;
}
function nextStateGenerationV1(generation) {
  if (!Number.isSafeInteger(generation) || generation < 0)
    throw stateError('STATE_MALFORMED');
  return Math.min(generation + 1, Number.MAX_SAFE_INTEGER);
}
```

`stateError(code)` creates an Error with exact `.code` and no `.detail`.
Every invalid time type/value or fresh fingerprint is bare `STATE_MALFORMED`
before write/provider. `nextStateGenerationV1` is the only authenticated
successor/terminal rule and saturates at the maximum. Authenticated absence
starts generation 1 regardless of raw bytes.

`STATE_MALFORMED` means invalid authenticated-exhaustion evaluation input, not
only bad file bytes. Remedy is closed: parser failure permits authorized
`reset-state` under lock; a parsed record with a persisted timestamp ahead of
the clock requires clock correction and waiting until the greatest timestamp;
a parsed record plus valid clock means reset correctly refuses—do not delete
valid state. Run `check-platform`, repair the internally supplied fingerprint/
time input, and retry; persistence is an internal defect to report. One bare
wire code therefore does not prescribe one destructive remedy.

`reset-state` is the admin operation that acquires the coordinator lock,
byte-stably rereads the one state file, deletes and directory-flushes it only
when canonical parsing returns `STATE_MALFORMED`, and otherwise refuses with
`STATE_NOT_QUALIFIED`. `check-platform` is the read-only admin validation of
the native filesystem preconditions and current deployment inputs; it does not
delete or reset state. `STATE_NOT_QUALIFIED` means an ordinary or maintenance
precondition is absent, `STATE_EXPIRED` means ordinary smoke/shadow
qualification is at least 14 days old, `LOCK_CONTENTION` means the coordinator
lock was not safely acquired, and `PLATFORM_PRECONDITION_FAILED` means a
required native/filesystem precondition failed.

## One authoritative four-leg predicate

The **Canonical Exhaustion Predicate** is true iff a genuinely authenticated
record has all four legs:

1. stored primitive hex-64 deployment fingerprint equals the freshly computed
   primitive hex-64 fingerprint by string value;
2. integer `smokeStartsThisCycle` is exactly 3;
3. result is `fail` or `not_run`, never `pass`; and
4. process time is strictly before the selected anchor plus 14 days.

`fail` selects non-null `completedAt`; `not_run` selects `startedAt`.
First validate fresh inputs and reject as `STATE_MALFORMED` if any present
smoke start/completion, shadow completion, or mutation start is after process
time. Pass and authenticated absence return false. The interval is exactly
`[anchor, anchor + 14 days)`; replay cannot move an authenticated anchor.

## Exhaustive successor and locked start

| Input | Generation/count/ordinal |
|---|---|
| missing, MAC-invalid, binding-mismatched | 1/1/1 |
| pass, fingerprint mismatch, or non-pass at/after deadline | saturated successor/1/1 |
| live authenticated non-pass count 1 or 2 | saturated successor/new count/new equal ordinal |
| live authenticated non-pass count 3 | no successor; bare `SMOKE_ATTEMPTS_EXHAUSTED` |
| invalid schema/time/result/count/ordinal/fingerprint/projection | no successor; bare `STATE_MALFORMED` |

There is no valid non-pass count 0. “Successor” always means
`nextStateGenerationV1`, including at the maximum.

Under the coordinator lock, smoke start reads/canonically parses, authenticates,
computes the successor once, creates complete `not_run` smoke with equal count/
ordinal, creates `mutationInProgress` kind `smoke` with fresh hex-32 ID and
the same canonical start time, sets valid `not_run` shadow and ordinary count
0, signs, validates the full v2 record, and atomically replaces state. Only
after publication does it unlock and invoke providers. Earlier error makes no
write/provider call. Authenticated absence intentionally lets generation 1
replace higher unauthenticated bytes without comparing untrusted generation.

## Complete locked pass/fail completion

After two provider summaries, completion reacquires the lock, rereads and
canonically parses, re-authenticates state/binding, and requires exact stored
smoke mutation-ID equality with this start. Mismatch makes no terminal write.

Terminal smoke preserves `attemptOrdinal`, sets canonical `completedAt` at or
after start, and writes exact two-provider hashes/completeness/exact/prose values
and sums. Computed pass sets result `pass` and count 0; otherwise result
`fail` preserves the published non-pass count, still equal to ordinal.
Terminal outer state uses saturated successor generation, clears mutation to
null, preserves other authenticated fields, signs, validates full v2, and
atomically replaces under lock. Only then does completion return. This makes
normative the actual behavior: 0 on pass, preserved on fail, re-authentication
under lock, cleared marker, sign, validate, atomic write.

## Command and ordinary-channel disjointness

The shared admin catch remains:

```js
main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(
    `${error.code ?? error.reason ?? 'CITATION_GROUNDING_COMMAND_FAILED'}`
    + `${error.detail ? ` ${error.detail}` : ''}\n`
  );
  process.exitCode = 2;
});
```

It preserves detail for other commands. Smoke's two `stateError` values have
no detail, so they print bare; detail is not globally removed.

Ordinary top-level reasons are `LOCK_CONTENTION`,
`PLATFORM_PRECONDITION_FAILED`, `STATE_MALFORMED`, `STATE_EXPIRED`,
`STATE_RUN_LIMIT_REACHED`, `STATE_NOT_QUALIFIED`.
`STATE_RUN_LIMIT_REACHED` means `advisoryRunsSinceGo >= 50` only in ordinary
qualification, is disjoint from smoke count, and formats
`CITATION_GROUNDING_ADVISORY_INACTIVE STATE_RUN_LIMIT_REACHED`.
Smoke exhaustion is neither an ordinary reason nor ordinary detail. Current
production has no ordinary producer supplying it. Removing its stale vocabulary
entry requires a production-call-site no-producer scan and permanent regression
check; if a producer appears, removal must stop.

## Availability, resets, and clock residuals

Start publication precedes providers. A crash after publishing third
`not_run` leaves a valid authenticated count-three record exhausting for the
remaining fixed lease without completion. V1 explicitly accepts this bounded
14-day refusal and has no stale-in-progress bypass. Wait for the deadline or
make an authorized real fingerprint change; `reset-state` correctly refuses
valid bytes.

One replaceable state file and no monotonic authority leave four lease-clearing
paths: replay authenticated count-one/two bytes; delete the file; replace with
structurally valid MAC/binding-invalid bytes (authenticated absence); or
authorized reset after canonical malformedness. Each admits at most three more
non-passing starts, but repetition permits unbounded aggregate work/cost. None
forges pass/shadow-go, activates advisory, bypasses platform/receipt/fingerprint,
or grants authority. Bounding aggregate cost against a state owner requires a
new reviewed monotonic authority.

Wall clock is not trusted remote time. Forward skew can expire early; backward
skew before persisted time is malformed; backward skew after all persisted
times can prolong the lease. Correct-clock/wait-first recovery avoids deletion.

## Complete resolution of round-37 F1, F3, F4, F5 and SEC-1..4

- **F1 prior finding:** coercive `Number(now)` contradicted the input contract,
  while non-state malformed causes had no remedy. **Resolved:** only valid Date
  or primitive finite number and primitive hex-64 fingerprint are admitted;
  every failure is the bare malformed code before effects, with separate
  malformed-file, clock, and valid-state/internal-input remedies above.
- **F3 prior finding:** outer schema, generation, shadow/mutation timestamp
  shapes, Canonical JSON, parser, and MAC/binding authority were missing.
  **Resolved:** all are defined inline above, including maximum generation,
  parse order, private authenticated storage, and both publications.
- **F4 prior finding:** saturation contradicted prose, the proposed catch
  globally dropped details, run limit was undefined, and stale ordinary-detail
  removal lacked proof. **Resolved:** one saturating helper is used everywhere;
  the shared catch preserves details while smoke errors have none; ordinary run
  limit is the disjoint 50-run predicate; no-producer evidence plus a regression
  scan guards vocabulary removal.
- **F5 prior finding:** completion/pass reset was absent and valid schema allowed
  non-pass count/ordinal mismatch. **Resolved:** schema enforces non-pass
  equality, pass has count 0 plus retained audit ordinal, and the locked start
  and re-authenticated terminal write are complete above.
- **SEC-1:** private WeakMap storage plus clone-on-projection removes mutable
  nested authority. **SEC-2:** no current ordinary producer plus regression
  scan prevents a removal-induced ordinary crash. **SEC-3:** third-start crash
  refusal is accepted with remedy. **SEC-4:** non-pass equality is enforced;
  pass's distinct audit ordinal is explicit.

## All round-37 primary-artifact facts

- `validateStateRecordV2` requires nonnegative safe-integer generation,
  admitting `Number.MAX_SAFE_INTEGER`; current successor/terminal writes
  saturate there.
- Actual completion sets count 0 on pass, preserves it on fail,
  re-authenticates under lock, clears mutation, signs, validates, atomically
  writes terminal state.
- Admin catch preserves `error.detail`; this must not be globally removed.
- `STATE_RUN_LIMIT_REACHED` is ordinary `advisoryRunsSinceGo >= 50`,
  disjoint from smoke-start count.
- No ordinary formatter currently produces exhaustion detail; this reduces but
  does not eliminate SEC-2 exploitability.
- Current authenticated wrapper is shallow-frozen with mutable cloned nested
  record; this limits its claim and is replaced by this design.
- Start write precedes providers; count-three `not_run` is exhausting, so a
  crash can create bounded 14-day refusal.
- Current `validSmoke` validates count/ordinal ranges independently, not
  equality; writers set them equal, and this design enforces non-pass equality.
- The current 14-test citation suite passes, validating current behavior only,
  not this proposed contract.

## Options, lanes, rollback, non-goals

**A selected — one file plus cumulative closed contract.** Keep round-35's
fixed authenticated lease and four reset classes; add the validation,
immutable projection, completion, output, and residual contracts above. No wire
shape migration; mismatched non-pass records intentionally become malformed.
Accept bounded crash refusal and unbounded repeated-reset work.

**B rejected — second monotonic authority.** A separately protected high-water
generation/spend counter could bound resets only if it survives and governs
every replay/deletion/tamper/reset, reopening the binding single-file decision
with migration, repair, backup, and custody. Material cost abuse inside the
stated actor boundary would change the recommendation.

**C rejected — indefinite fingerprint-sticky exhaustion.** It avoids clock
expiry but lets replay deny smoke indefinitely and contradicts the chosen fixed
lease. It needs a newly reviewed policy.

Product/UX gets stable bare automation errors and wait-first recovery.
Architecture uses one locked authority and publication before providers. Data
keeps v2 shape with intentional validator tightening. Security parses before
authentication, makes authenticated projection immutable, and states all
reset/skew/crash bounds. Operations retain non-smoke details and may monitor
starts/resets externally; telemetry is not authority. Rollback cannot add a
second file, weaken the half-open boundary, or rewrite history without a new
design digest.

Non-goals: semantic citation proof, blocking enforcement, remote trusted time,
preventing reset by a repository-state owner, new persistent budget, automatic
valid-state deletion, or implementation in this round.

## Deterministic validation contract

Digest-bound checks must prove:

1. every definition/schema, both locked publications, options, six lanes,
   rollback, remedies, residuals, and fixtures are present;
2. only valid Date/primitive finite number is accepted; coercible values fail;
3. generation 0, ordinary, maximum-minus-one, and maximum validate and saturate;
4. parsing plus count/result/time/ordinal validation precedes authentication;
5. absence/MAC/binding cases start 1/1/1 and ignore raw fields; forged/mutated
   wrapper cannot affect authority;
6. every predicate/successor row, before/equal/after boundary, pass, fingerprint
   mismatch, future persisted time, and invalid current input has exact effects;
7. locked signed validated atomic start precedes provider; completion rereads,
   authenticates, checks mutation ID, resets/preserves count, clears mutation,
   saturates, signs, validates, atomically writes;
8. non-pass equality, mismatch rejection, and pass count-0/audit-ordinal work;
9. shared details remain; smoke codes have no detail and exact stderr/exit 2;
10. ordinary run limit is only the disjoint 50-run predicate and production has
    no ordinary exhaustion-detail producer;
11. fixtures name third-start crash, four clearing paths, unbounded repeated
    reset, forward skew, both backward-skew cases, and all remedies;
12. current 14 tests pass as current evidence while proposed fixtures remain
    future implementation work; and
13. artifact secret scan passes.

Any parent/detail exhaustion, coercive time conversion, unqualified generation
“plus one,” mutable authenticated nested state, globally detail-dropping catch,
undefined run limit, omitted completion write, or omitted third-start crash
consequence fails.

## Rejected history

Round 36 (combined 68) mixed bare and parent/detail exhaustion results, omitted
timestamp/policy/successor/formatter definitions, and understated resets. Round
37 (combined 72) omitted outer schema/completion, coerced time, contradicted
saturation, widened command behavior, left run limit undefined, overclaimed
wrapper integrity, omitted crash refusal, and failed count/ordinal meaning.
Full reasoning and unreviewed-alternative warnings remain in
`.kstack/decisions/design-gate-citation-grounding-2026-08-23-rejected-options.md`.
This document starts from round 35 and incorporates primary-artifact
resolutions; it does not adopt either rejected packet.

## Self-containment verification

The completed document was reread as packet-only. Every predicate, code, field,
nested object, input type, timestamp, fingerprint, generation rule,
count/ordinal relation, authentication outcome, publication step, lock, atomic
replacement, command output, ordinary run-limit, remedy, residual, option, and
check used by the mechanism is defined inline. Remaining JavaScript/JSON terms
are standard primitives/built-ins. There are no unresolved questions.
