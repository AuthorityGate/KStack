# SB-WP03 R14 exact-candidate verification

This value-free companion record binds the exact committed candidate submitted
for independent R14 read-only review. It is self-excluded from that Git commit
because a record naming the commit cannot be contained by the commit it names.
It contains no credential, protected source, Jira response, provider payload,
private OS state, or model-visible secret.

## Candidate binding

| Field | Bound value |
|---|---|
| Exact candidate Git commit | `fc21ab5` (`fc21ab5f47e8e13664d27b3086d6d293703659e3`) |
| Candidate parent / prior reviewed candidate | `f182df186bb157a381501a6f3ded490aec1bdc01` |
| Prior rejected candidate (R13 subject) | `613181cf69ac0df207aac2fbc9f17788294e4b16` |
| Original WP03 implementation commit | `4fd55a0728d5e20beb4779de2747da6f4b37820c` |
| R13 review receipt SHA-256 | `94da8be47120cb4e80dcec3cc1e3fe69bc79d8eb0cd81567ed2e5a68f6af3aca` |
| R13 candidate-verification SHA-256 | `fff0f1587d5599e80fae03e12990d20b6620865de12f4befe16557f1af857436` |
| Review runtime | Node v24.12.0, linux (WSL2) |
| Local exclusions | owner-local `.kstack/config.json` change and untracked R13/R14 records are not candidate content |

The standing WP03 review authorization applies; no new authorization question
is required.

## Exact candidate file identities

All hashes taken from the `fc21ab5` blob content, not from the working tree.

| Path | SHA-256 |
|---|---|
| `plugins/kstack/scripts/secret-broker/control-plane-v1.mjs` | `c9e539cb5356ec1d529bc36cde1aabdabc82f448d4428bf4fc97d79ba3088814` |
| `plugins/kstack/scripts/secret-broker/synthetic-protected-state-v1.mjs` | `501d0b1fa0a3966dcd72ef3a63594725ae304ea8f51eb4a706a0846ab536bfe6` |
| `tests/secret-broker-protected-state.test.mjs` | `63e0b737bd51e82c1cf058008c754b648c117e80dc7e95e6c4765538e747c7f9` |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `54b82ea42d11d116c9785a80ddae243c6c3164530733c151e21f9e17fb472452` |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `f375790442a7e76b280ada7abf92b1800d242c16cc6a03e17a9cbd8969739a9c` |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `a07270a8e0e43a5e858422d060f3b0c3d5dbb40a3a296d980e7413c6643ef963` |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `008647f23b8b2699ad9bff1ecd4c1058491fe9d1b5eabd397eb4ab8e8f3657fc` |
| `plugins/kstack/references/SECRET_BROKER.md` | `67a915d51a5db40047e8eeffa3788d119419ce5b1851ea23f435d55d335a9070` |

The four secret-broker paths above plus the two secret-broker manifests were
confirmed byte-identical between `fc21ab5` and the working tree at review time,
so every adversarial result below was produced against the exact candidate.

## Current qualification

- Secret Broker protected-state, release, and control-plane matrices, run in
  isolation against the exact candidate: 20 tests, 20 passed, zero failed.
- Generated-manifest check `generate-secret-broker-release-manifests.mjs
  --check`: passed (exit 0). Both secret-broker manifests are genuinely
  regenerated, not hand-edited.
- `generate-install-health-audit-manifest.mjs --check`: reported
  `KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_STALE` in the working tree. Traced to
  concurrent agent edits to `kstack-design-gate.mjs`,
  `kstack-staged-review.mjs`, and `kstack-workflow-contract.mjs` made during
  this review. The committed manifest records sizes 25485 / 42691 / 14990,
  which match the `fc21ab5` blob sizes exactly; the manifest is correct for the
  candidate and the staleness is a working-tree artifact.
- Full repository suite: 1,096 tests, 1,089 passed, 5 failed, 2 expected
  environment-gated skips. All five failures resolve to
  `KSTACK_POST_DEPLOY_SOURCE_AUDIT_DIVERGENT` /
  `KSTACK_INSTALL_HEALTH_AUDIT_MANIFEST_STALE` from the same concurrent edits,
  not from candidate content. The commit's own claim of 1,088 / 1,086 / 0 / 2
  could not be reproduced on a clean tree during this review.

## Independent adversarial reproduction

Reproduced against the exact candidate, pollution installed strictly after
module import, and removed before read-back so persistence is proven rather
than in-memory confusion.

| Attack | Result |
|---|---|
| R13 finding 1 — no-op `Array.prototype[i]` setter, indices 0/1/3, canonical encoder and `reconcileAuthorityAdvance` | **CLOSED.** Encodings stayed distinct and complete; reconciliation returned `UNCOMMITTED`, never `COMMITTED`. |
| R13 finding 2 — selective `Array.prototype[i]` setter, indices 0/1/3, during CAS state copy | **CLOSED.** Persisted epoch stayed 1 in every case. |
| `Object.prototype[i]` numeric pollution against the canonical encoder | **CLOSED.** Encoding remained complete and correct. |
| `Array.prototype.sort` write-back over own data properties with inherited numeric setters installed | **CONFIRMED SAFE.** Sorted correctly; inherited setter fired zero times. Settles residual-doubt item 4 in isolation. |
| Values reaching an inherited numeric setter during a full CAS | Only two, both from `path.join` inside `durableReplace`: the temp directory path and `.state.<pid>.<uuid>.tmp`. No authority, head, namespace, digest, update-ID, or secret data. Settles residual-doubt item 5; the CAS additionally failed safe with no epoch change. |
| **`Array.prototype.constructor` + `@@species` container substitution, authority path** | **OPEN — durable forge.** `compareAndAdvanceAuthority` reported `EXPECTATION_MISMATCH` while the persisted head moved from epoch 1 to attacker-chosen epoch 999. Survived pollution removal, `open()`, and `readAuthorityHead`. |
| Same substitution driven by `issueUpdateId()` | **OPEN.** Reported `ISSUED` while silently rewriting the authority head to epoch 999. |
| Same substitution, audit path | **OPEN.** Persisted attacker-chosen audit ordinal 4242 while `issueUpdateId()` reported `ISSUED`. |
| `Object.prototype.crashCut` / `.acknowledgementCut` string-keyed pollution | **OPEN — availability/observability.** `'BEFORE_COMMIT'` fails every advance after retiring the update ID; `'AFTER_COMMIT'` on either key commits while reporting `ACKNOWLEDGEMENT_UNKNOWN`. |

Root cause of the three open forgeries: the remediation hardened indexed
*writes* but `validateState` still obtains its head arrays from
`Array.prototype.map`, whose `ArraySpeciesCreate` resolves the container
through `Array.prototype.constructor` and `@@species`. The validated heads are
discarded by the substituted container's traps, and the added final-state
revalidation compares the substituted object against itself, so it cannot
detect the swap. The map result is never re-validated and never re-checked with
`Array.isArray`.

`kstack-secret-broker.mjs status` remains exactly
`UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT`. No real provider, protected
store, Jira credential, target, deployment, or secret value was contacted.

Independent R14 returns **revise** at confidence 97 with six failed checks and
four security findings. WP03 cannot close at `fc21ab5`.
