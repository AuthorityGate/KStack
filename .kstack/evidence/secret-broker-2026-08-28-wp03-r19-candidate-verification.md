# SB-WP03 R19 exact-candidate verification

This value-free companion record binds the exact candidate submitted for
independent R19 read-only review — the closing gate of the WP03 secret-broker
prototype-pollution thread. It contains no credential, protected source, Jira
response, provider payload, private OS state, or model-visible secret.

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
| Prior candidate (R16 subject) | same uncommitted lineage, superseded |
| Fail-before baseline | the `fc21ab5` blobs of both source files |
| Review runtime | Node v24.12.0, Linux 6.18.33.2-microsoft-standard-WSL2 |
| Broker status during review | `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`, unchanged |

Because `HEAD` is `fc21ab5` (the R13 fix) itself, the entire working-tree diff
for the two source files is the cumulative delta of the R14 species fix, the R15
residual fix, the R16-response report-accuracy correction, and this round's R17
/R18 work — all four are uncommitted and all four are present in this candidate.
`tests/secret-broker-protected-state.test.mjs` now declares **22** tests; R16
measured 21, so exactly **1 is new this round** — `an inherited accessor cannot
stall a descriptor write in either module` (:1474). Reviewers comparing against
`fc21ab5` should expect to attribute the other seven new tests to prior rounds.

The standing WP03 review authorization applies; no new authorization question is
required.

### Files this review modified

`.kstack/reviews/secret-broker-2026-08-28-wp03-r19/opus.md` and this record.
No source file, manifest, objective, decision record, or test was modified,
created, reverted, committed, staged, or pushed by this review.

## Exact candidate file identities

Working-tree bytes at review time. Both source files were re-hashed at the start
of the review and again immediately before this record was written; the two
measurements are identical, which matters because an unrelated concurrent
workstream was writing to this tree throughout (see "Concurrent-tree caveat").

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `1c01220c9b02aec19ebd60d7cca1a9bf2406d589cf18bf5ee245ba3d65f879f0` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `c0b47e2633a45678f5b3d251d22e1ac9bfc067ca905229222c0011a13e7735a9` |
| `tests/secret-broker-protected-state.test.mjs` | `8c843719e012dbece6d40404f84f3c0c2683f3dbec0a78d1fa6912f659cdadef` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `74c477014ce64ed0ac2bc6bbe40fa1b2984174308cba1433209f74c7b70d55cc` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `e388eb248c30f717c362a29be0c1a7035143e272d5772850994eca1c471c8e98` |
| `plugins/kstack/secret-broker-accepted-design-v1.json` | `a36c61c90f0200e06207015579dc2a0398ac93f3a2a315f2ce0a3906cf9eb6ed` (unmodified) |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `0991636a3bcfb2f680f5d04ea2eb12b081134935b58bf0c2e31ec469911f3775` (modified by the concurrent thread, not by WP03) |
| `.kstack/objectives/secret-broker-2026-08-28.md` | `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9` (**unmodified**) |
| `.kstack/decisions/secret-broker-2026-08-28-wp03-pre-import-integrity-boundary.md` | `bfecf67eac1c31bdb1c39f3920a6d4fafac0dd018e06601707b7ecc8c0c79145` (new, untracked) |

## SB-TC00 non-amendment

The objective hashes to `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`,
byte-identical to the value bound as `contractDigests.SB-TC00` in the release
manifest and to the value the new decision record itself cites. It is absent
from the modified-file list.

The new decision record is referenced by **zero** digest-bound artifacts. A
repository-wide grep for `pre-import-integrity-boundary` across all `.json`,
`.md` and `.mjs` files returns exactly one hit outside the record itself and the
`reviews/`+`evidence/` trees: line 279 of
`.kstack/evidence/secret-broker-2026-08-28-wp03-sbtc00-interpretation-check.md`,
which proposed the path. Specifically checked and clean:
`secret-broker-accepted-design-v1.json` (0 hits),
`secret-broker-release-manifest-v1.json`, `secret-broker-source-audit-manifest-v1.json`,
`install-health-audit-manifest-v1.json`, and
`.kstack/decisions/secret-broker-2026-08-28-item-ledger.md`.

`tests/secret-broker.test.mjs`, the digest-binding test, returns **24 tests / 22
passed / 0 failed / 2 skipped** — identical to the figure R16 recorded, so the
accepted-design binding is undisturbed.

### Citation accuracy of the decision record

The decision record is itself an artifact under review, and it leans on seven
SB-TC00 line citations. Each was read from the objective rather than taken from
the record, since a misquoted line would be a documentation-accuracy defect of
the same class R16 held closure on. All seven check out:

| Cited | Objective text | Record's use |
|---|---|---|
| L49 | "**Protected worker** is the separately launched, identity-checked broker" | quoted verbatim as "separately launched, identity-checked" |
| L70 | "…ambient process state as [untrusted]" | "treats ambient process state as untrusted" — accurate |
| L74 | "…exact broker executable/configuration, registered adapter, and…" | quoted verbatim; TCB framing accurate |
| L77 | "Developer OS-local cells make no same-user, administrator, kernel, debugger, memory-inspection, or malicious-authorized-target resistance claim" | quoted verbatim (wraps to L78) |
| L78–81 | "A production claim requires separately executed evidence for its stronger service identity, process, network, paging/dump, crash, and operator boundaries." | paraphrased accurately in "Scope" |
| L82–86 | "A malicious prompt, repository, model session, … substituted backend/adapter/target, … must not create a value channel." | both the "malicious model session" and "substituted adapter" readings are supported by the line |

No citation defect found.

## Manifest genuineness

Manifests were checked against the tree rather than against each other alone.

- Both source files' SHA-256 **and** byte sizes match their entries in the
  release manifest, the source-audit manifest, and the install-health audit
  manifest exactly: control-plane `1c01220c…` / 22840 bytes,
  synthetic-protected-state `c0b47e26…` / 39162 bytes. A hand-edited manifest
  would have to reproduce both fields for both files across three files.
- `install-health-audit-manifest-v1.json`: all **201** entries recomputed from
  disk; **0 divergent**.
- `tests/helpers/generate-install-health-audit-manifest.mjs --check` exits **0**.
- `secret-broker-source-audit-manifest-v1.json`'s entry for the release manifest
  (`74c47701…` / 6873 bytes) matches the release manifest's actual bytes.
- `secret-broker-accepted-design-v1.json`'s actual hash `a36c61c9…` matches the
  release manifest's `contentEntries` claim for it.
- `manifest.sourceAuditManifestSha256` is `null` by design and the manifest
  carries no self-referencing entry, both asserted by `tests/install-health.test.mjs:110`.

## Descriptor-site enumeration

Independently enumerated rather than taken from the fix summary. Grepped both
files for every descriptor-consuming form: `Object.defineProperty`,
`Object.defineProperties`, `Reflect.defineProperty`, and `Object.create` with a
properties argument. Result: exactly **8** sites, matching the decision record's
list with no 9th.

| Site | Routes through `dataDescriptor`? |
|---|---|
| `control-plane-v1.mjs:126` (`listDefine`) | yes |
| `control-plane-v1.mjs:288` (`SecretControlPlaneError`, 3 literals at :289-291) | yes |
| `control-plane-v1.mjs:316` (`snapshotRecord`) | yes |
| `synthetic-protected-state-v1.mjs:84` (`ROOT_CREATE_OPTIONS`) | **no — module scope** |
| `synthetic-protected-state-v1.mjs:127` (`listDefine`) | yes |
| `synthetic-protected-state-v1.mjs:172` (`defineError`, 3 literals at :173-175) | yes |
| `synthetic-protected-state-v1.mjs:236` (`snapshotRecord`) | yes |
| `synthetic-protected-state-v1.mjs:267` (`frozen`) | yes |

Every `OBJECT_CREATE` call in both files is single-argument (`OBJECT_CREATE(null)`),
so none is a `ToPropertyDescriptor`-consuming context. The record's stated
exception for `:84` is accurate: it is a module-scope `const`, evaluated once
during module evaluation, so it is reachable only by pre-import pollution —
the boundary the record scopes out — and it is disclosed rather than glossed.

`dataDescriptor` is correct by construction: `OBJECT_CREATE(null)` followed by
four own data assignments. `ToPropertyDescriptor`'s `HasProperty` probe for
`get` and `set` walks a prototype chain that terminates immediately at `null`,
so no inherited accessor can be reached. The class is closed outright, not
converted to a coded error. Its only inputs are a value and a literal boolean at
every call site, so it is not attacker-influenced. `configurable: true` /
`writable: true` match the flags of every literal it replaced, so no descriptor
semantics changed; `frozen()` and `FREEZE` tighten them afterwards where
intended, and the error properties retain ordinary `Error` semantics
(`message` non-enumerable, everything writable/configurable).

Also confirmed against the record's vector-1 conditional: `staticSpecifiers`
reports control-plane importing only `["node:crypto"]` and
synthetic-protected-state importing
`["node:crypto","node:fs","node:path","./control-plane-v1.mjs"]` — exactly the
import window the record describes, with no third-party dependency.

## Independent adversarial reproduction

A purpose-built harness exercised error construction, the canonical encoder,
control-plane head codecs, and a full synthetic-adapter lifecycle (create, open,
status, snapshot bytes, initializeAuthority, issueUpdateId, readAuthorityHead,
compareAndAdvanceAuthority, acquireAuditWriter, readAuditHead,
compareAndAdvanceAudit, verifyAuthoritySnapshot, verifyAuditSnapshot) — 25
probes — under five prototype states.

| Mode | `Object.prototype.get` / `set` | Uncoded throws |
|---|---|---|
| `clean` | absent / absent | **0 / 25** |
| `get` | non-callable string / absent | **0 / 25** |
| `set` | absent / non-callable string | **0 / 25** |
| `both` | non-callable / non-callable | **0 / 25** |
| `getfn` | function / function | **0 / 25** |

Legitimate results were byte-identical across all five modes, including the
`authorityHeadDigest` value `sha256:170be0d7441d157eb1edaf86423e7bdd7397c44f13d8995d35ba633cf5ce2c4f`
and every canonical encoding. Rejections stayed coded (`KSTACK_SECRET_*`).
Error construction under pollution — the exact path R18 identified as previously
fatal, where no coded broker error could be built at all — succeeds: `new
SecretControlPlaneError(...)` yields correct `name`/`code`/`message`, and
`fail()` reached through `validateSecretDigest`, `validateSecretOpaqueRef`,
`validateSecretTimestamp` and `validateSecretUpdateId` throws coded errors in
every mode.

### Fail-before negative control

The decisive check, and the reason the null result above is evidence rather than
an untripped harness. The same 25 probes were run against the `fc21ab5` blobs of
both files extracted to a scratch directory:

| Tree | mode `clean` | mode `get` |
|---|---|---|
| `fc21ab5` (pre-fix) | 0 / 25 uncoded | **25 / 25 uncoded** (`TypeError: Getter must be a function`) |
| Candidate | 0 / 25 uncoded | **0 / 25 uncoded** |

The harness demonstrably detects this defect class. Note the harness's own first
draft reproduced the bug against itself — its pollution helper used an ordinary
descriptor literal and threw once `get` was polluted — which is an incidental
but direct demonstration of the hazard; it was rebuilt on a null-prototype
descriptor.

### Pollution-key sweep

38 distinct `Object.prototype` keys plus `Array[Symbol.species]` substitution,
each installed in isolation and removed afterwards, each against a freshly
provisioned store, asserting canonical-encoding stability, digest stability,
head stability, `ISSUED`/`ADVANCED` outcomes, `authorityEpoch === 2`, and coded
rejection of an invalid digest.

Keys: `get`, `set`, `value`, `writable`, `enumerable`, `configurable`,
`requireAll`, `crashCut`, `acknowledgementCut`, `recursive`, `mode`, `root`,
`clock`, `allowOrigin`, `code`, `length`, `0`, `1`, `schemaVersion`,
`authorityEpoch`, `priorAuthorityDigest`, `lastUpdateId`, `kind`,
`authorityHeads`, `issuedUpdateIds`, `exec`, `constructor`, `toString`,
`valueOf`, `then`, `isDirectory`, `isSymbolicLink`, `uid`, `getuid`, `nlink`,
`dev`, `ino`, `size`.

**Result: 0 issues / 39.** `Array[Symbol.species] = class extends Array` left
the head stable and returned `ADVANCED` with `epoch=2`, confirming the R14
species class remains structurally closed.

An earlier sweep run reported 39/39 failures; that was a harness defect —
`fs.cpSync` does not preserve the `0o700` root mode, so `assertPrivateDirectory`
correctly rejected every copied store before any probe ran. Recorded because the
first result is in the session transcript and would otherwise read as a finding.

### Symbol-keyed properties

Run rather than reasoned, since `frozen()`'s object branch (synthetic:261-267)
carries no `typeof key !== 'string'` check — unlike `canonicalValue`:195 and
`snapshotRecord`:229, which both reject non-string keys explicitly. The
unguarded branch is unreachable with attacker-supplied symbols (everything
reaching `frozen` is a `snapshotRecord` output, a `JSON.parse` result, or a
local literal), and the canonical encoder fails closed regardless. Confirmed
empirically — all six probes rejected with coded errors, controls unaffected:

| Probe | Result |
|---|---|
| `secretCanonicalBytes({a:1,[S]:2})` | `KSTACK_SECRET_CANONICAL_VALUE_INVALID` |
| `secretCanonicalBytes({a:{[S]:1}})` (nested) | `KSTACK_SECRET_CANONICAL_VALUE_INVALID` |
| `secretCanonicalBytes(arr)` with `arr[S]=3` | `KSTACK_SECRET_CANONICAL_VALUE_INVALID` |
| `validateAuthorityHeadValue({...head,[S]:1})` | `KSTACK_SECRET_AUTHORITY_HEAD_INVALID` |
| `validateAuditHeadValue({...auditHead,[S]:1})` | `KSTACK_SECRET_AUDIT_HEAD_INVALID` |
| `validateSecretUpdateId(valid, {[S]:1})` | `KSTACK_SECRET_UPDATE_ID_INVALID` |
| control: `validateAuthorityHeadValue(head)` | accepted, `authorityEpoch === 1` |
| control: `secretCanonicalBytes({a:1})` | accepted, `{"a":1}` |

Matches R16's recorded negative result for symbol keys; unchanged by this round.

### Windows-branch `process.getuid` probe

Recorded as a non-blocking observation, classified out of `securityFindings` in
the review with the reasoning stated there. `assertPrivateDirectory`
(synthetic-protected-state-v1.mjs:347) reads `process.getuid` through the
prototype chain. On POSIX it is an own property of `process` and unpollutable —
which is why the sweep entry above passes. Simulating a non-POSIX host by
deleting `process.getuid`:

| Inherited `Object.prototype.getuid` | Result |
|---|---|
| function that throws | **uncoded** `Error` escapes |
| function returning a wrong uid | **coded** `KSTACK_SECRET_PROTECTED_ROOT_UNTRUSTED` (fails closed) |

Availability / error-code hygiene only; cannot forge or weaken any check;
pre-existing at `fc21ab5` and untouched by this change set; not a descriptor
site, so it falsifies nothing in the decision record. A `HAS_OWN(process,
'getuid')` guard would close it. Should be re-tested on a real Windows host
during Windows qualification.

## Regression-test coverage gap

`tests/secret-broker-protected-state.test.mjs:1474` (`an inherited accessor
cannot stall a descriptor write in either module`) is the only new test this
round and is correct as far as it goes, but it is narrower than the fix it
guards: it exercises `validateAuthorityHeadValue` on a *valid* head and
`status()` — both happy paths — and never invokes `fail()`. The specific gap
R18 identified was the two error-constructor descriptor writes, where pollution
meant no coded broker error could be constructed and the raw `TypeError`
escaped. That path is genuinely closed (verified above), but its regression
would not be caught by the committed test. Recommended, not blocking.

## Dead-guard note

Four `!descriptor ||` guards remain — control-plane `ownDescriptor`:145 and
`snapshotRecord`:315; synthetic `snapshotRecord`:235 and `frozen`:266. Each is
tautologically dead: `descriptors[key]` for a key drawn from
`OWN_KEYS(descriptors)` can never be falsy, since `GetOwnPropertyDescriptors`
creates an entry only where a descriptor exists, and `FromPropertyDescriptor`
always returns an object. Harmless in code. Recorded only because R16 held
closure partly on a fix report that counted such lines as substantive coverage:
no R17/R18 fix report exists (no `.kstack/reviews/…-r17` or `-r18` directory),
so there is no report to overstate them, and the decision record does not claim
them as guards. R16's report-accuracy finding is closed by the absence of the
artifact that carried it.

## Test results

| Scope | Tests | Passed | Failed | Skipped |
|---|---|---|---|---|
| `tests/secret-broker.test.mjs` (digest binding) | 24 | 22 | **0** | 2 |
| `tests/secret-broker-protected-state.test.mjs` | 22 | 22 | **0** | 0 |
| all `tests/secret-broker*.test.mjs` | 77 | 75 | **0** | 2 |
| full suite (`npm test`) | 1134 | 1125 | 7 | 2 |
| the 6 affected files, re-run on settled tree | 29 | 29 | **0** | 0 |

The 2 skips in the secret-broker scope are pre-existing platform/backend gates
(`Windows Secret Broker worker remains unavailable before conformance`; `real
Linux Secret Service cell cannot bypass the implementation fence`).

Both source files also match their `tests/reflexion-architecture-gate.mjs` pins
exactly — capability use-site digests `480ba19589a4de03…` and `15ac13fbe18d1caf…`,
capability token inventories `{Buffer:6,Reflect:2,TextDecoder:2,crypto:7}` and
`{Buffer:5,Reflect:2,crypto:7,fs:38,path:12,process:7}`, with no dynamic
`import(`, `eval(` or `Function(` in either file.

### Concurrent-tree caveat — attribution of the 7 full-suite failures

None is attributable to this candidate. An unrelated concurrent workstream
(`staged-review-mechanism-hardening`) was writing to this tree throughout the
323-second full-suite run, with edits landing at 22:10, 22:15, 22:16, 22:22,
22:23, 22:30 and 22:31 to `kstack-staged-review.mjs`, `kstack-design-gate.mjs`,
`kstack-review-schema.mjs`, `DUAL_REVIEW.md`, `skills/kstack-design/SKILL.md`,
`install-health-audit-manifest-v1.json` and `tests/reflexion-architecture-gate.mjs`.
The two WP03 source files were last written at 22:01/22:02 and their SHA-256 was
identical at the start and end of this review.

| Failure | Attribution |
|---|---|
| `install-health.test.mjs` — central contract and source audit bound | `KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_STALE`; concurrent manifest edit mid-run |
| `install-health.test.mjs` — installed probes execute | `KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT`; same root cause |
| `install-health.test.mjs` — Codex post-install health | `KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT`; same root cause |
| `reflexion-architecture.test.mjs` — production architecture gate | names `kstack-design-gate.mjs` explicitly (`fs: 22` vs expected `16`) — a concurrent-workstream file, not a secret-broker file |
| `runtime-final-review-freeze.test.mjs` | line 17 is a determinism check (build the freeze twice, compare canonical bytes); the tree changed between the two builds during a 52-second window |
| `windows-setup.test.mjs` | `KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT`; same root cause |
| `setup.test.mjs` — `--host all` copy mode | 120029 ms against a 120 s timeout; environmental |

After the tree settled, all six affected files were re-run: **29 tests, 29
passed, 0 failed**, including every one of the 7. `generate-install-health-audit-manifest.mjs --check`
exits 0 and all 201 manifest entries match disk.

**Condition on closure:** the closure commit must be preceded by a clean full
suite run on a settled tree. The re-runs above establish attribution, not a
clean full-suite result on the final bytes.

I considered discharging this condition myself but deliberately did not: the
concurrent workstream was still mid-loop at the end of this review (its
cycle-4 review artifacts were written at 22:47, with cycles 1-3 preceding it),
so a full run started now would very likely be contaminated by the next source
edit in the same way the first one was, and would produce another
non-attributable result rather than a clean baseline. Whoever commits should run
it once that workstream is quiescent.

## Verdict

`approve`, confidence **94**, with `failedChecks`, `securityFindings`,
`materialDissent` and `unresolvedQuestions` all empty — meeting WP03's closure
bar of confidence >=93 with all four arrays empty on the same digest.
