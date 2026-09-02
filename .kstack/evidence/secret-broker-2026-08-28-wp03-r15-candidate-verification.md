# SB-WP03 R15 exact-candidate verification

This value-free companion record binds the exact candidate submitted for
independent R15 read-only review. It contains no credential, protected source,
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
| Prior rejected candidate (R14 subject) | `fc21ab5` |
| Candidate before that (R13 subject) | `613181cf69ac0df207aac2fbc9f17788294e4b16` |
| Review runtime | Node v24.12.0, Linux 6.18.33.2-microsoft-standard-WSL2 |
| Broker status during review | `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`, unchanged |
| Concurrent-thread exclusions | `kstack-design-gate.mjs`, `kstack-staged-review.mjs`, `kstack-workflow-contract.mjs`, `kstack-jira-tracking.mjs`, `reflexion-architecture-gate.mjs`, `DUAL_REVIEW.md`, `kstack-design/SKILL.md` are a concurrent agent's in-flight work, not candidate content |

The standing WP03 review authorization applies; no new authorization question is
required. No file outside `.kstack/reviews/secret-broker-2026-08-28-wp03-r15/`
and `.kstack/evidence/` was modified by this review.

## Exact candidate file identities

Working-tree bytes at review time.

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `206071896f5582c913befb8b0fb3c31d4c45dc80819b4eb693080af466bd0d98` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `235fb00e4d80a7493fec9ee58894e23eefd74ffb2cac474b0757e895d3b06b2f` |
| `tests/secret-broker-protected-state.test.mjs` | `bb5aad6b481c6bb1760a28c80055c2d12b8758b3be4f6a15588ff7c03b76e05b` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `105ab868d25cc57ee245f0ed1e4b516423106a7f82bb983997cb08bd1b12fd85` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `b8c30e0d36037d05252f1ce5640aa56c1ad216dc940ef5d407e90b1c90677c44` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `6783680a2631cbd54c9b885f41caeab1811653d13de46dbc84d1121c7ab92f91` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` (unchanged from `fc21ab5`) |

For contrast, the R14 subject blobs extracted from `fc21ab5` and used as the
fail-before baseline throughout this record:

| Path | SHA-256 at `fc21ab5` |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `c9e539cb5356ec1d529bc36cde1aabdabc82f448d4428bf4fc97d79ba3088814` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `501d0b1fa0a3966dcd72ef3a63594725ae304ea8f51eb4a706a0846ab536bfe6` |

## Manifest genuineness

- `generate-secret-broker-release-manifests.mjs --check`: **passed, exit 0.**
- Both secret-broker manifests were diffed entry by entry against HEAD. The only
  changes are the `sha256` and `size` of the two edited source files, plus the
  derived `contentSetDigest` and the release manifest's own hash inside the
  source-audit manifest. The recorded hashes `2060718…bd98` and `235fb00…b2c`
  are byte-identical to the values computed independently here, and the replaced
  hashes are byte-identical to the `fc21ab5` blobs. **Not hand-edited.**
- `generate-install-health-audit-manifest.mjs --check`: **failed, exit 1,
  `KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_STALE`.** Every one of the manifest's
  entries was recomputed against disk. Exactly two are stale:
  `scripts/kstack-design-gate.mjs` and `scripts/kstack-staged-review.mjs`. All
  four of this candidate's own entries are correct.
- Those two stale entries match **neither** the committed HEAD blobs **nor** the
  current working-tree bytes. A control check on an unmodified file
  (`scripts/kstack-config.mjs`) confirmed HEAD blob and working tree agree, so
  this is not a line-ending artifact. The manifest therefore snapshots a
  transient mid-edit state of the concurrent agent's files and describes no tree
  that ever existed. It must be regenerated after that thread settles and before
  this candidate is committed.

## Reflexion architecture gate

The gate tracks both candidate files. Its entries were recomputed independently
using the gate's own exported `staticSpecifiers`, `capabilityTokenInventory` and
`capabilityUseSiteDigest`:

| File | Imports | Token inventory | Use-site digest |
|---|---|---|---|
| `secret-broker/control-plane-v1.mjs` | match | match | `da243dd8…97a12` match |
| `secret-broker/synthetic-protected-state-v1.mjs` | match | match | `8f1daa8f…09975` match |

The gate's test failure is `capability use-site drift in kstack-design-gate.mjs`,
which the gate reaches before the secret-broker entries; it is unrelated to this
candidate.

## Current qualification

- `tests/secret-broker-protected-state.test.mjs` against the current tree:
  **18 tests, 18 passed, 0 failed.**
- Same file against the `fc21ab5` blobs (import paths redirected, no tree
  mutation): **18 tests, 14 passed, 4 failed.** The four failures are exactly
  the four new regression tests. No collateral failures, so the new tests are
  precisely targeted at the R14 findings and nothing else.
- Full repository suite: **1104 tests, 1096 passed, 6 failed, 2 expected
  environment-gated skips.** All six failures were individually attributed to
  the concurrent staged-review/design-gate thread: five report
  `KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_STALE` or
  `KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT`, and one reports `capability
  use-site drift in kstack-design-gate.mjs`. None involves the secret broker.

## Independent adversarial reproduction

Every attack was written independently of the candidate's own tests, run against
both the current tree and the `fc21ab5` blobs from the same harness, with
pollution installed strictly after module import and removed before read-back so
that persistence is proven rather than in-memory confusion.

| Attack | At `fc21ab5` | Current candidate |
|---|---|---|
| R14 SEC-01 — `Array.prototype.constructor` + `@@species` → Proxy with swallowing `defineProperty`, mismatched authority CAS | **EXPLOITED.** Reported `EXPECTATION_MISMATCH`, persisted epoch 999 | **CLOSED.** `EXPECTATION_MISMATCH`, persisted epoch 2 |
| R14 SEC-02 — same substitution driven by benign `issueUpdateId()` | **EXPLOITED.** Reported `ISSUED`, persisted epoch 999 | **CLOSED.** `ISSUED`, persisted epoch 1 |
| R14 SEC-03 — same substitution against `auditHeads` | **EXPLOITED.** Persisted ordinal 4242 | **CLOSED.** Persisted ordinal 0 |
| Species substitution swept across container allocations 1–8 rather than a guessed index | **EXPLOITED at every call index** | **CLOSED at every call index** |
| Species substitution with a lying `get`/`getOwnPropertyDescriptor` trap instead of `defineProperty` (not named in the fix report) | **EXPLOITED.** Persisted epoch 999 | **CLOSED.** Persisted epoch 1 |
| R14 SEC-04 — `Object.prototype.crashCut = 'BEFORE_COMMIT'` / `'AFTER_COMMIT'` / `acknowledgementCut = 'AFTER_COMMIT'` | **EXPLOITED.** Durable DoS and false `ACKNOWLEDGEMENT_UNKNOWN` on both authority and audit | **CLOSED.** `ADVANCED` on both paths in all three cases |
| `RegExp.prototype.exec` / `.test` / `@@match` replacement against the control-plane validators | **EXPLOITED.** `validateSecretDigest('NOT-A-DIGEST')` returned the invalid value | **CLOSED.** All four validators rejected; both valid inputs still accepted |
| `Array.prototype[Symbol.iterator]` replaced with a forging generator | CLOSED | **CLOSED.** `ADVANCED`, epoch 2 |
| `Object.prototype.constructor` + `Object`-side `@@species` against the object-spread paths | CLOSED | **CLOSED.** `ADVANCED`, epoch 2 |
| `Object.prototype['0']`/`['1']` numeric accessors during `arraySort`/`arrayAppend` | CLOSED | **CLOSED.** Epoch unchanged |
| Two-namespace state file probing the `validateState` double length read | — | **CLOSED.** `KSTACK_SECRET_PROTECTED_STATE_INVALID` |
| `Object.prototype.requireAll = false` against `exact()` — partial authority head, partial audit head, state file with a deleted list | No forge | **No forge.** All rejected; flag confirmed flipped |
| **All vectors installed simultaneously** (numeric accessors on both prototypes with faithful observers, `crashCut`, `acknowledgementCut`, `requireAll`, `recursive`, species substitution, `RegExp.prototype.test`) | — | **NO FORGERY.** Zero head writes reached an inherited setter; persisted epoch 2 and ordinal 1; both survived pollution removal and adapter reopen on clean prototypes |
| `Array.prototype.constructor[@@species]` read counter instrumented across a full `compareAndAdvanceAuthority` | — | **0 reads.** Container provenance holds by construction |

The last row is the decisive structural result. R14's recommendation identified
container *provenance* — that every authority-bearing array is allocated by this
module and populated only through `listDefine` — as the load-bearing invariant.
A species-counting Proxy on `Array.prototype.constructor` observed zero `@@species`
resolutions during a complete authority CAS, so the invariant is established by
construction rather than by any downstream check. `assertListClosure` is a
redundancy over that property, not a substitute for it; it compares
`frozen(source).authorityHeads` against the list the copy was derived from, and
would not by itself catch a reintroduced species-resolving container.

## Residual findings

All three are pre-existing at `fc21ab5` and earlier, reproduced identically in
both trees, and none is a regression introduced by this candidate.

| Finding | Status |
|---|---|
| `canonicalValue` array branch reads `descriptors[key]` as an ordinary get (control-plane-v1.mjs:158). With a hole plus a compensating non-index own property, the length guard at :152 passes and the missing index resolves through `Object.prototype`. `secretCanonicalBytes` emitted `["kept","FORGED"]`. | **Latent.** Not reachable from any present caller — the encoder is imported only by the two secret-broker modules and the test file, and every array reaching it there is dense and index-only. The object-key branch is safe (keys come from `Reflect.ownKeys`). Reachability was confirmed absent by driving the adapter under the same pollution: `ISSUED`, epoch unchanged. |
| `snapshotRecord`'s `{ requireAll = true } = {}` default reaches `Object.prototype.requireAll` in both files. | **Confirmed, no forge.** Every key in every record schema is independently value-checked, so partial records still fail. |
| `fs.mkdirSync(paths.root, { mode: 0o700 })` under `Object.prototype.recursive = true` adopts a pre-existing directory instead of failing `ROOT_CREATE_FAILED`. | **Confirmed, no forge.** A world-writable adopted root is still rejected, with `KSTACK_SECRET_PROTECTED_ROOT_UNTRUSTED` observed directly, and `O_EXCL` still protects identity and state. |

Additionally: under an `Array.prototype['0']` accessor whose getter returns a
constant for every read in the process, a full CAS returns
`ACKNOWLEDGEMENT_UNKNOWN` with the persisted epoch unchanged — reproduced
identically at `fc21ab5`. The mechanism was isolated and confirmed:
`path.join('/tmp/abc','def')` returns `'X/def'` under that pollution, so
`durableReplace`'s temp-path join points at a nonexistent directory, the write
fails `ENOENT`, and `StateWriteUncertainError` is mapped to
`ACKNOWLEDGEMENT_UNKNOWN`. The corruption is in Node's `path` internals rather
than in candidate code, it fails closed, and it is why the repository's own
regression tests deliberately use a faithful observer that preserves ordinary
assignment semantics.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected store,
Jira credential, target, deployment, or secret value was contacted.

Independent R15 returns **revise** at confidence 93. Every R14 finding is closed
and the closure is structural rather than case-by-case; the revise is narrow and
scoped to two remaining inherited-property reads in the same class plus the
install-health manifest that must be regenerated before commit.
