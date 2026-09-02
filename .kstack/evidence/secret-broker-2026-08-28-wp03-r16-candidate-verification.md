# SB-WP03 R16 exact-candidate verification

This value-free companion record binds the exact candidate submitted for
independent R16 read-only review. It contains no credential, protected source,
Jira response, provider payload, private OS state, or model-visible secret.

**This candidate is PRE-COMMIT.** It exists only as uncommitted working-tree
state; there is no commit hash to bind it to. It is therefore bound below by
SHA-256 file identity rather than by a commit, and every result in this record
was produced against those exact bytes. If any listed file changes before the
candidate is committed, this record no longer describes what was reviewed.

## Candidate binding

| Field | Bound value |
|---|---|
| Candidate form | Uncommitted working-tree state on branch `Dev` |
| Working-tree HEAD at review time | `fc21ab5` (`fc21ab5f47e8e13664d27b3086d6d293703659e3`) |
| Prior candidate (R15 subject) | same uncommitted lineage, superseded |
| Fail-before baseline | the `fc21ab5` blobs of both source files |
| Review runtime | Node v24.12.0, Linux 6.18.33.2-microsoft-standard-WSL2 |
| Broker status during review | `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`, unchanged |

Because `HEAD` is `fc21ab5` itself, the entire working-tree diff for the two
source files is the delta from the R13 fix — that is, the R14 species fix and
the R15 residual fix are **both** uncommitted and both present in this
candidate. The seven new tests in `tests/secret-broker-protected-state.test.mjs`
are correspondingly the R14 round's four plus this round's three. R15 measured
18 tests with 4 new against `fc21ab5`; there are 21 now, so exactly **3 are new
this round**, which matches the fix report. Reviewers comparing against
`fc21ab5` should expect to attribute four of the seven to the prior round.

The standing WP03 review authorization applies; no new authorization question is
required.

### Files this review modified

`.kstack/reviews/secret-broker-2026-08-28-wp03-r16/opus.md` and this record.

One further edit was made and then fully reverted: the pre-import-pollution
paragraph was added to `.kstack/objectives/secret-broker-2026-08-28.md`, which
immediately failed `tests/secret-broker.test.mjs`. It was reverted and the file
re-hashed to `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`
— byte-identical to its pre-review state, absent from `git status`, and the test
back to 24 tests / 22 passed / 0 failed. See "Documentation boundary" below.

## Exact candidate file identities

Working-tree bytes at review time.

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `379f1fbbbcf08f3c0390c289d98350462fa2e2c694b03967ea8eeb20c4cd2975` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `1f394e7b45fa08ab2fcebbdc9c2424c738139df30c3c18ad708f0fab0a623db6` |
| `tests/secret-broker-protected-state.test.mjs` | `7c3778efb402000b884f8ccd74da606406bf919434307c7555b631f2d03a8ba4` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `f4abbeea959900fdcbc7e47bff9562499abf2b6c44300d677b9508e01fe0cc19` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `d0b67e5e2f6cdd74496b3b55d2030e47050b8e8a5969b799ce75d40365d92438` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `63e40e781c9ffb5216f4b311d996da0fe65efe074b93bf2011af6cf49179dc62` (no longer modified; concurrent thread settled) |
| `.kstack/objectives/secret-broker-2026-08-28.md` | `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9` (unmodified) |

Fail-before baseline blobs extracted from `fc21ab5`:

| Path | SHA-256 at `fc21ab5` |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `c9e539cb5356ec1d529bc36cde1aabdabc82f448d4428bf4fc97d79ba3088814` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `501d0b1fa0a3966dcd72ef3a63594725ae304ea8f51eb4a706a0846ab536bfe6` |

## Manifest genuineness

- `tests/helpers/generate-secret-broker-release-manifests.mjs --check`: **passed, exit 0.**
- `tests/helpers/generate-install-health-audit-manifest.mjs --check`: **passed, exit 0.**
  R15's `KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_STALE` blocker is resolved — the
  concurrent `kstack-design-gate.mjs` / `kstack-staged-review.mjs` thread has
  settled and that manifest is no longer modified in the working tree.
- Both secret-broker manifests were read directly and confirmed to carry the
  candidate's own file hashes: release manifest `contentEntries[13].sha256` =
  `sha256:379f1fbb…2975` (control-plane) and `contentEntries[17].sha256` =
  `sha256:1f394e7b…3db6` (synthetic), each also present under
  `validatorArtifacts`; the source-audit manifest carries the same values.
  These are byte-identical to the working-tree hashes computed independently
  above. **Not hand-edited.**

## Current qualification

- `tests/secret-broker-protected-state.test.mjs` against the current tree:
  **21 tests, 21 passed, 0 failed.**
- Same file against the `fc21ab5` blobs (import paths redirected in a scratch
  copy, no tree mutation): **21 tests, 14 passed, 7 failed.** The seven failures
  are exactly the seven new regression tests; all fourteen pre-existing tests
  pass unchanged at both revisions. No collateral failure and no pre-existing
  test was weakened to accommodate the fix.
- Full repository suite (`npm test`): **1113 tests, 1111 passed, 0 failed,
  2 expected environment-gated skips.** This is the first clean full-suite
  figure in the WP03 chain; R15 could only report 6 failures attributed to a
  concurrent thread, and those are now gone.

## Independent adversarial reproduction

Every attack below was written independently of the candidate's own tests and
run against both the `fc21ab5` blobs and the current tree from the same harness,
with pollution installed strictly after module import and removed afterwards.

| Attack | At `fc21ab5` | Current candidate |
|---|---|---|
| SEC-R15-01 — sparse array + non-index decoy + `Object.prototype['1']` as a data descriptor | **EXPLOITED.** `secretCanonicalBytes` emitted `["kept","FORGED"]` | **CLOSED.** `KSTACK_SECRET_CANONICAL_VALUE_INVALID` |
| Same, but `Object.prototype['1']` installed as an **accessor** (not previously tried) | **EXPLOITED.** Emitted `["kept","FORGED_VIA_GETTER"]`; getter invoked 1× | **CLOSED.** Rejected with the getter invoked **0×** — the inherited lookup never happens |
| Dense-array control under the same pollution | `["kept","second"]` | `["kept","second"]` — unchanged |
| SEC-R15-02 — `Object.prototype.requireAll = false` + `lastUpdateId = 'epoch-origin'` against a 4-key authority head | **EXPLOITED.** Accepted and returned a frozen 4-key head | **CLOSED.** `KSTACK_SECRET_AUTHORITY_HEAD_INVALID` |
| Same chain, `authorityHeadDigest` over the forged 4-key head | **EXPLOITED.** Returned `sha256:4320d8f70162171ac3f8077c861f49a8afdc93297ef8cb371cd7194877a3695e` — an off-schema head with a usable CAS identity | **CLOSED.** `KSTACK_SECRET_AUTHORITY_HEAD_INVALID` |
| Same chain + `writerLeaseDeadline` against a 6-key audit head | **EXPLOITED.** Accepted | **CLOSED.** `KSTACK_SECRET_AUDIT_HEAD_INVALID` |
| `authorityOrigin` under the identical pollution (legitimate-path control) | Correct 5-key head | Correct 5-key head — unchanged |
| SEC-R15-03 — `Object.prototype.recursive = true` over a pre-existing `0o700` directory | **EXPLOITED.** `ADOPTED` | **CLOSED.** `KSTACK_SECRET_PROTECTED_ROOT_CREATE_FAILED` |
| `Object.prototype.get` = function / `undefined` / `null`, and `Object.prototype.set` | `TypeError` at every `DEFINE_PROPERTY` site | **Identical.** Pre-existing, availability-only, unforgeable — see SEC-R16-01 |
| `Object.prototype.value` / `writable` / `enumerable` / `configurable` | No effect | No effect — unchanged |
| Accessor own property on the encoded value (object and array index) | `KSTACK_SECRET_CANONICAL_VALUE_INVALID` | Identical |
| Non-enumerable own data property (object and array index) | `KSTACK_SECRET_CANONICAL_VALUE_INVALID` | Identical |
| Symbol-keyed own property (object and array) | `KSTACK_SECRET_CANONICAL_VALUE_INVALID` | Identical |
| Proxy with lying `ownKeys` / `getOwnPropertyDescriptor` traps | Encodes what the traps report | Identical — the input describing itself, not a forgery of a validated value |
| Proxy over an array skewing `length` against its descriptor set | Proxy invariant `TypeError` | Identical |

### Behaviour-change control

The decisive check that the widening beyond R15's literal ask is inert for
legitimate callers. A full store lifecycle — `create`, `initializeAuthority`,
`issueUpdateId`, `compareAndAdvanceAuthority`, `acquireAuditWriter`,
`compareAndAdvanceAudit`, reopen and read-back — plus `authorityOrigin`,
`auditOrigin`, empty-array, nested-object and parse round-trip encodings were
run unpolluted against both trees from one harness and the outputs diffed.

**Every field is byte-identical across `fc21ab5` and the candidate.** The single
difference in the whole comparison is the intended one: `mkdirAdoption` goes
from `ADOPTED` to `KSTACK_SECRET_PROTECTED_ROOT_CREATE_FAILED`.

The reason there is no change is structural: `ownDescriptor` did not add the
`enumerable` or `HAS_OWN(descriptor, 'value')` predicates — both were already
present inline at `fc21ab5`. The only new predicate anywhere is the leading
`HAS_OWN(descriptors, key)`, which can fire only on a key the descriptor map
does not carry.

## Scope accuracy of the applied guard

Verified by reading the diff rather than the report:

| Site | Reported | Actual |
|---|---|---|
| `canonicalValue` array branch (control-plane-v1.mjs:170) | routed through `ownDescriptor` | correct |
| `canonicalValue` object key loop (:183) | routed through `ownDescriptor` | correct |
| `canonicalValue` object value read (:193) | routed through `ownDescriptor` | correct |
| `snapshotRecord` loop, both files | routed through `ownDescriptor` | **inline `HAS_OWN` only**, key drawn from `OWN_KEYS(descriptors)` — tautological, dead code |
| `frozen()` object branch (synthetic:254) | routed through `ownDescriptor` | **inline `HAS_OWN` only**; `descriptors[key].value` still read with no `enumerable` / data-descriptor check |

`ownDescriptor` is defined only in control-plane-v1.mjs; synthetic-protected-state-v1.mjs
has no such helper. The `frozen()` residual is not exploitable — `frozen` receives
only spreads of `snapshotRecord` output, `JSON.parse` results and local literals,
and `exactBytes(checked, source)` re-encodes `source` through the now-guarded
`canonicalValue` — but it is not what the report describes.

### Note on the `REGEXP_TEST` → `REGEXP_EXEC` change (prior round, not this one)

The diff also shows `REGEXP_TEST` removed and `regexpTest` re-implemented as
`APPLY(REGEXP_EXEC, pattern, [value]) !== null`, with a test covering it. This is
**R14-round work, not this candidate's**, and it was not undisclosed: it appears
here only because `HEAD` is `fc21ab5`, so the diff spans two fix rounds. R15's
own record already observed `RegExp.prototype.exec` replacement as CLOSED against
the then-current tree, which is only possible with `REGEXP_EXEC` already
captured. Recorded so a later round does not mistake it for an undeclared edit.
The change is correct hardening — `RegExp.prototype.test` performs a dynamic
`Get(R, "exec")` — and exactly equivalent, since `UPDATE_ID`, `DIGEST`,
`OPAQUE_REF` and `TIMESTAMP` all carry only the `u` flag.

## Documentation boundary

R14 and R15 both asked for the pre-import-pollution boundary to be written down
explicitly. It still is not, and this round established the obstacle:
`.kstack/objectives/secret-broker-2026-08-28.md` is digest-bound as accepted
design item SB-TC00 (`9a239374be…`) in
`plugins/kstack/secret-broker-accepted-design-v1.json`, and as
`contractDigests.SB-TC00` in the release manifest. Adding the paragraph failed
`tests/secret-broker.test.mjs` ("machine-binds the complete accepted design")
on the next run. The edit was reverted in full.

Recording the boundary is therefore a design re-acceptance action — it requires
re-deriving `secret-broker-accepted-design-v1.json` and the SB-TC00 digest — or
it belongs in a decision record that is not digest-bound. That decision belongs
to whoever holds design-acceptance authority, not to a reviewer. It should not
lapse a third time, but it is a documentation action and does not gate the code.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected store,
Jira credential, target, deployment, or secret value was contacted.

Independent R16 returns **approve** at confidence 92. All three R15 findings are
closed, SEC-R15-02 proved to be a real validator bypass rather than the contract
issue it was characterized as, no legitimate behaviour changed, the full suite is
clean for the first time in the chain, and the manifests are genuine. The
reservations are fix-report accuracy and one documentation action that a reviewer
is not authorized to perform.

Approving the candidate is not the same as closing the work package. The
objective's success-evidence section requires every isolated item to close "at
confidence `>=93` with zero failed checks, security findings, material dissent,
and unresolved questions on the same digest". This review returns 92 with all
four non-empty, so **WP03 does not formally close on this digest** — not because
code work remains, but because the fix report needs correcting and the
pre-import boundary needs recording through the design re-acceptance path
described above. No further code round is warranted.
