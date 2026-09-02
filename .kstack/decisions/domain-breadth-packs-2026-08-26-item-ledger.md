# Per-item ledger: domain breadth packs

**Thread:** `domain-breadth-packs-2026-08-26`
**Created:** 2026-08-26
**Status:** complete, design-only; every open item closed on a Codex >=93
all-zero final digest
**Review route:** Codex-only; no Opus

## Authority status

- Round-one Q1 is `RESOLVED-YES`: pack selection, required-pack waiver or
  policy weakening, and catalog activation require authenticated out-of-band
  principals and attestations; weakening and waivers also require an
  independent second party. Ordinary repository collaborators remain in the
  threat model.
- Round-one Q2 is `RESOLVED`: independent reviewers must converge; persistent
  gridlock remains blocked, and an advisory third model has no deciding vote.
- Round-one Q3 is `RESOLVED`: each governed workflow owns and attests its
  evidence descriptors; the shared pack-result validator only consumes and
  verifies them.
- The clarification record is `LOCKED`. Item-level design may proceed, but no
  isolated review approves the whole design or authorizes implementation.
- Acquisition decision DB-OPT-Q1 is `RESOLVED-YES`: Option B is locked only as
  a subordinate offline content-acquisition strategy. It does not resolve the
  unrelated round-one Q1 identity boundary, reopen D0, or alter D9.

## Status meanings

- `VALIDATED` — the isolated claim has item-specific review support at the
  applicable high-water; this is not whole-design approval.
- `REJECTED` — the reviewed mechanism is unsound; its replacement is named.
- `OPEN-UNTESTED` — a proposed correction exists but lacks isolated review.
- `OPEN-CONFIRMED-BUG` — round one confirmed the defect and no isolated clean
  fix exists.
- `BLOCKED-OWNER` — progress requires a genuine owner answer.

## Canonical reviewed item designs

These nonignored decision files are byte-identical promotions of the final
reviewed packets. Their SHA-256 values therefore remain the exact review-bound
digests. A sub-item packet may preserve review-time wording that a later
sub-item or Q1 was still open; the item ledger below is the authoritative
current status and records those later closures without mutating reviewed
bytes.

| Item | Canonical decision file | SHA-256 | Final result |
|---|---|---|---|
| D1 | `domain-breadth-packs-2026-08-27-d1-authenticated-identity.md` | `4947151d6d5ac746330b2c04f9669725700a8a43c0494edd6b6e2e04a5ebd1e7` | Codex 95 clean |
| D2-F1 | `domain-breadth-packs-2026-08-27-d2-f1-inventory-equality.md` | `a32b324ff819c6815bf15d0888bfbe7c546a1503332b6e8ab8b96e8941b4eac9` | Codex 97 clean |
| D2-F2 | `domain-breadth-packs-2026-08-27-d2-f2-policy-binding.md` | `e8144a0415a23a6e79bc73c2fd4e8ce15c6f5d890b1893b1f5baf991feb153ff` | Codex 96 clean |
| D2-F3 | `domain-breadth-packs-2026-08-27-d2-f3-selection-digest.md` | `5f1055afdc427f1931bb4de27e0b25237aed17dc6cd2051378394b4109913556` | Codex 96 clean |
| D3 | `domain-breadth-packs-2026-08-27-d3-separation-of-duty.md` | `cb5e88f1977f2db5ecd2edb902bd6d9caed51a344538b62565fb78e52aede855` | Codex 96 clean |
| D4+D10 | `domain-breadth-packs-2026-08-27-d4-d10-result-evidence-contract.md` | `160052d5a69d94c12c60f35de8a89affc4cbb04cb0dbd0abe0ddfb24a6d45878` | Codex 96 clean |
| D5-F1 | `domain-breadth-packs-2026-08-27-d5-f1-schemas-digests.md` | `7ea2e55c349a8d1bc0259e57fea3d2c347347a2530633e49c7624614dbb4dd74` | Codex 97 clean |
| D5-F2 | `domain-breadth-packs-2026-08-27-d5-f2-atomic-activation.md` | `b5573d954810c452f52dd304d056ff83287d2387599896a89512cf4748116a8b` | Codex 96 clean |
| D6 | `domain-breadth-packs-2026-08-27-d6-budget-applicability.md` | `60021b58354f7a7292028a2bd14d05ec6c2d93415cbb302faa84964ecd5c011d` | Codex 96 clean |
| D7 | `domain-breadth-packs-2026-08-27-d7-evaluation.md` | `a977dbd90cdbd2dd7f646af80c414f96ca60a888c2b79d18eb67693eeaf6d46d` | Codex 97 clean |
| D8 | `domain-breadth-packs-2026-08-27-d8-trusted-time.md` | `3abee40273ad534b53d9b2cb230ae4d1a72440ba7d294ace9cad7b2f35e47683` | Codex 97 clean |

## Item ledger

**Naming note (added 2026-09-02):** "D0" names two different things depending
on which document is read, and this has caused real confusion during
implementation (KSTK-57). The row below is this ledger's D0: the Option C
closed declarative catalog/bundle/compatibility mechanism from the round-1
decision brief, implemented under the `domain-d5f1-schemas` and
`domain-d5f2-activation` labels (`kstack-domain-schema.mjs`,
`kstack-domain-activation.mjs`) per
`.kstack/qualifications/domain-implementation-inventory.mjs`. Separately,
`.kstack/roadmaps/runtime-maturity-focused-2026-08-28.json` defines its own,
narrower `domain-d0-catalog-runtime` roadmap item: "the closed declarative
catalog and safe native rendering for legacy host-neutral analysis methods
only," explicitly not D2 pack admission or D5 activation. That item is
implemented in `plugins/kstack/scripts/kstack-domain-catalog.mjs`, whose own
exported `DOMAIN_RENDERING_SCOPE` constant states the same boundary. Jira
ticket KSTK-57 tracks the roadmap item, not this ledger row. When "D0" comes
up, check which document is the source before assuming they mean the same
artifact.

| ID | Item | Status | Evidence | Next action |
|---|---|---|---|---|
| D0 | Option C closed declarative catalog; four-pack roadmap; independent pack lifecycle | `VALIDATED` | Round 1 Codex and Opus both selected Option C and rejected reopening A/B/D. | Preserve; do not redesign the full mechanism. |
| D1 | Authenticated identity for selection, waiver/policy weakening, and activation | `VALIDATED` | Codex 95 clean on `4947151d...`; external trust root, qualified adapter, exact action binding, and replay boundary reviewed. | Preserve; design only. |
| D2 | Exact-byte selection and stale-catalog outcome | `VALIDATED` | F1 Codex 97 clean on `a32b324f...`; F2 Codex 96 clean on `e8144a04...`; F3 Codex 96 clean on `5f1055af...`. | Preserve all three independently reviewed fixes; design only. |
| D3 | Policy weakening/downgrade/quarantine separation of duty | `VALIDATED` | Codex 96 clean on `cb5e88f1...`; exact-target two-person/two-group quorum and no-bypass behavior reviewed. | Preserve; design only. |
| D4 | Pre-dispatch composition versus post-analysis result/validator | `VALIDATED` | D4+D10 Codex 98 revise -> 96 clean on `160052d5...`; pure validator and atomic broker transaction responsibilities are separated. | Preserve; design only. |
| D5 | Closed schemas, fixture digest, and atomic catalog/compatibility activation | `VALIDATED` | D5-F1 Codex 98 -> 96 -> 97 clean on `7ea2e55c...`; D5-F2 Codex 96 -> 96 clean on `b5573d95...`. | Preserve both independently reviewed sub-items; design only. |
| D6 | Deterministic prompt budget and bounded applicability | `VALIDATED` | Codex 96 clean on `60021b58...`; qualified whole-request accounting, caps, and catalog-owned applicability reviewed. | Preserve; design only. |
| D7 | Executable blinded evaluation and Q2 gridlock disposition | `VALIDATED` | Codex 88 -> 97 clean on `a977dbd9...`; case-level safety inference, fixed power, independent convergence, and deliberate gridlock reviewed. | Preserve; design only. |
| D8 | Trusted time/freshness policy | `VALIDATED` | Codex 88 -> 97 clean on `3abee402...`; authenticated time quorum, conservative predicates, and external rollback witnesses reviewed. | Preserve; design only. |
| D9 | `release-operations` remains analysis-only; other packs remain separate roadmap work | `VALIDATED` | Round 1 Codex and Opus explicitly agreed with T8 and the boundary. | Preserve unchanged. |
| D10 | Authenticated workflow-owned evidence descriptor contract | `VALIDATED` | Reviewed inseparably with D4: Codex 98 revise -> 96 clean on `160052d5...`; workflow-owned attestation and consumer/broker handshake closed. | Preserve; design only. |

## Content-acquisition decision ledger

This table is subordinate to the D0 runtime architecture. Its use of the name
`Option B` refers to the separately reviewed acquisition-strategy comparison,
not to an alternative to D0's validated Option C.

| ID | Decision | Status | Bound evidence | Next action |
|---|---|---|---|---|
| DB-OPT-Q1 | Exact-digest, v1-license-allowlisted external sources may be offline corpora for translation of selected non-executable material into governed KStack-native packs; predeclared qualification is mandatory; direct runtime marketplace loading is prohibited. | `OWNER-LOCKED-YES` | Owner record `domain-breadth-acquisition-option-2026-08-26-owner-decision.md`, SHA-256 `a8b61a7665ccb1774c6890530ccc336b4804b65eb090e46553b83395fb3133a6`; reviewed base `aa125e851d501e69351a3969d726b6ecfa84599d911ee23fa1a9db4441723ef7`; normative addendum `e013b0b7b7a304255280a5279994f2ff5ff16647933161fadcd5de2f61bfae5d`; Codex option review 96 clean. | Later design may specify the offline acquisition contract and exact seven-file assurance trial only. No implementation, translation, activation, or external action is authorized. |

## Score history

| Review | Item | Digest | Codex | Outcome |
|---|---|---|---:|---|
| Round 1 dual review | whole candidate | `fc241844ce6f1b245f127941dda2328bf7d01cbf4bf16b13c32e61d258f805fc` | 48 | revise; Opus 64; combined 48 |
| D2 pass 1 | D2 | `053429b745d7972b6774b4b6e1fce72fb1a5b92a1a4d5c458f71a459d29aaad5` | 82 | revise; three concrete bugs; no dissent/questions |
| D2 pass 2 | D2 | `590e3f8f86fb7c9dcf22befdd889e35e7ed7da860865f98da9b2d912c7adce5b` | 90 | revise; one concrete digest-domain bug; guard/input fixes accepted |
| D2 pass 3 | D2 | `0f29c20c1aab0135babc7c708eb0bf27cc54e1b6fa30e01d54517e9d35504d12` | 98 | approve clean; Opus closure eligible |
| D2 closure 1 | D2 | `0f29c20c1aab0135babc7c708eb0bf27cc54e1b6fa30e01d54517e9d35504d12` | 98 | Opus 80 revise; F1-F3 returned to Codex-only |
| Acquisition option round 1 | DB-OPT-Q1 candidate | `aa125e851d501e69351a3969d726b6ecfa84599d911ee23fa1a9db4441723ef7` | 68 | revise; 4 concrete defects; no security finding |
| Acquisition option round 2 | DB-OPT-Q1 candidate plus normative addendum | `e013b0b7b7a304255280a5279994f2ff5ff16647933161fadcd5de2f61bfae5d` | 96 | approve clean; owner question eligible; no Opus |
| Owner answer | DB-OPT-Q1 | owner record `a8b61a7665ccb1774c6890530ccc336b4804b65eb090e46553b83395fb3133a6` | n/a | Yes; Option B locked only within the stated no-authority and preserved-boundary limits |
| Owner-lock integrity | DB-OPT-Q1 exact owner record + pre-update ledger + normative addendum | owner `a8b61a7665ccb1774c6890530ccc336b4804b65eb090e46553b83395fb3133a6`; ledger `6cbe6bb95acaa345192c68da4fe7cf8b182b6da673aa14889f700dc23ac91d18`; addendum `e013b0b7b7a304255280a5279994f2ff5ff16647933161fadcd5de2f61bfae5d` | 98 | approve clean; 0 failed checks/security/dissent/questions; 16,890 ms; no Opus |
| D2 pass 4 | D2-F1 only | `a32b324ff819c6815bf15d0888bfbe7c546a1503332b6e8ab8b96e8941b4eac9` | 97 | approve clean; 0 failed checks/security/dissent/questions; 14,990 ms; F1 validated, F2/F3 still open |
| D2 pass 5 | D2-F2 only | `e8144a0415a23a6e79bc73c2fd4e8ce15c6f5d890b1893b1f5baf991feb153ff` | 96 | approve clean; 0 failed checks/security/dissent/questions; 10,790 ms; F2 validated, F3 still open |
| D2 pass 6 | D2-F3 only | `5f1055afdc427f1931bb4de27e0b25237aed17dc6cd2051378394b4109913556` | 96 | approve clean; 0 failed checks/security/dissent/questions; 14,150 ms; D2 validated design-only; no Opus |
| D1 pass 1 | D1 only | `4947151d6d5ac746330b2c04f9669725700a8a43c0494edd6b6e2e04a5ebd1e7` | 95 | approve clean; 0 failed checks/security/dissent/questions; 26,260 ms; D1 validated design-only; no Opus |
| D3 pass 1 | D3 only | `cb5e88f1977f2db5ecd2edb902bd6d9caed51a344538b62565fb78e52aede855` | 96 | approve clean; 0 failed checks/security/dissent/questions; 13,140 ms; D3 validated design-only; no Opus |
| D6 pass 1 | D6 only | `60021b58354f7a7292028a2bd14d05ec6c2d93415cbb302faa84964ecd5c011d` | 96 | approve clean; 0 failed checks/security/dissent/questions; 22,960 ms; D6 validated design-only; no Opus |
| D7 pass 1 | D7 only | `be688a6aee68745cb239bd46c0706d7c0a9acae1d9988d3d37c4834ba3e0b690` | 88 | revise; 1 failed check; 0 security/dissent/questions; 19,410 ms; finding-level exact bounds ignored case clustering |
| D7 pass 2 | D7 only | `a977dbd90cdbd2dd7f646af80c414f96ca60a888c2b79d18eb67693eeaf6d46d` | 97 | approve clean; 0 failed checks/security/dissent/questions; 9,810 ms; D7 validated design-only; no Opus |
| D4+D10 pass 1 | D4 and D10 inseparable handshake | `3a178860fe72453eb478c1850db00de3dabcb64bdc564f34aad910400f9ab2cd` | 98 | revise; 1 failed check; 1 high security finding; 0 dissent/questions; 32,190 ms; pure validator incorrectly owned mutation |
| D4+D10 pass 2 | D4 and D10 inseparable handshake | `160052d5a69d94c12c60f35de8a89affc4cbb04cb0dbd0abe0ddfb24a6d45878` | 96 | approve clean; 0 failed checks/security/dissent/questions; 12,440 ms; D4/D10 validated design-only; no Opus |
| D8 pass 1 | D8 only | `b6bffaa21613ba9b80d6387bc7d9362e39d4b27165f80dedecfc3a043fc5f340` | 88 | revise; 1 failed check; 1 high security finding; 0 dissent; 1 question; 26,310 ms; local chain could not detect full protected-state rollback |
| D8 pass 2 | D8 only | `3abee40273ad534b53d9b2cb230ae4d1a72440ba7d294ace9cad7b2f35e47683` | 97 | approve clean; 0 failed checks/security/dissent/questions; 6,600 ms; D8 validated design-only; no Opus |
| D5-F1 pass 1 | D5 schemas/digests | `f8703c386cb721b53e9bec2e40141c1a3c603fb319b25aace9846521342d4345` | 98 | revise; 8 failed checks; 5 security findings (3 high, 2 medium); 2 dissent; 6 questions; 55,160 ms |
| D5-F1 pass 2 | D5 schemas/digests | `1a6d95ad20d08531c2725fbc68f28a99959d9b1212ec68af74b515328bd95db1` | 96 | revise; 3 failed checks; 2 security findings (1 high, 1 medium); 0 dissent/questions; 82,900 ms |
| D5-F1 pass 3 | D5 schemas/digests | `7ea2e55c349a8d1bc0259e57fea3d2c347347a2530633e49c7624614dbb4dd74` | 97 | approve clean; 0 failed checks/security/dissent/questions; 23,190 ms; D5-F1 validated design-only; no Opus |
| D5-F2 pass 1 | D5 atomic activation | `b1c92028d8f8a2c1268da15a397510660a68a16934d793996f9547e8353183cc` | 96 | revise; 2 failed checks; 1 high security finding; 1 dissent; 0 questions; 40,430 ms; historical signed-pointer replay remained |
| D5-F2 pass 2 | D5 atomic activation | `b5573d954810c452f52dd304d056ff83287d2387599896a89512cf4748116a8b` | 96 | approve clean; 0 failed checks/security/dissent/questions; 15,740 ms; D5-F2 and D5 validated design-only; no Opus |

## Maintenance rule

Read and update this ledger before and after every item review. Record each
digest, score, defects, high-water, and next smallest change. A new item digest
reopens only that item. Codex 84-92 permits concrete bug fixes only; closure
requires Codex >=93 with no failed checks, security findings, material dissent,
or unresolved questions. Opus is not part of this completed lane.
