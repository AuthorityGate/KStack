# Per-item ledger: release automation with Jira

**Thread:** `release-automation-jira-2026-08-26`
**Status:** living document; item-level evidence only

`VALIDATED` applies only to the named mechanism and never authorizes production
activation or clears another release item.

| Item | Status | Evidence | Next action |
|---|---|---|---|
| M1 correction 1: GitHub dispatch response, pre-dispatch identity, total P0 disposition, and safe P0 records | `VALIDATED` | Frozen digest `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523`; Codex 97 and Claude 87; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Runtime remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until all inherited staging fixtures pass. |
| M1 correction 2: OIDC audience-preimage acquisition and trust path | `VALIDATED` | Frozen digest `a217f92d67f4cdee5deb178c9855c7de9ccb243cec12890b097c81ca86783e16`; Codex 95 and Claude 87; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Composed M1 still requires correction 4 and target staging qualification. |
| M1 correction 3: approver semantics and Q1 coupling | `VALIDATED-DESIGN-ONLY` | Owner answered M1-Q1 `Yes`. Final design digest `efdd3eddb9d78986ed9ebed335ccd6675f3f74b70bbaeaa337caa761d0556f0d`; Codex rounds 97 revise then 96 approve, closing with 0 failed checks, security findings, dissent, or questions. Exact cumulative review duration 111720 ms; no Opus. | Freeze design. `single-operator` permits the local requester to approve but claims no separation of duty; optional `distinct-reviewer` requires protected identity mapping and inequality. Runtime remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until inherited and added provider/identity/transient-policy fixtures pass. |
| M1 correction 4: preflight-summary retrieval authorization and threats | `VALIDATED` | Frozen digest `9addaaa63aaf1130b85260762a2609abf304fea4e20bd86b6cf42584fb841d2e`; Codex 94 and Claude 88; both approved with zero failed checks, security findings, dissent, or unresolved questions. | Preserve verbatim. Production remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until all composed fixtures pass on the exact target. |
| M1 correction 5: provider comment-normalization staging evidence | `VALIDATED` | Frozen design digest `9dda35f801d332ee581d6e6566f7641b53facbc9f02711102a8f85d6277cd90f`; Codex 95 and Claude 90 on that exact digest; both approved `DESIGN_READY` with zero failed checks, security findings, dissent, or unresolved questions. Review evidence: `.kstack/reviews/release-automation-jira-2026-08-26-m1-c5-codex15/` and `.kstack/reviews/release-automation-jira-2026-08-26-m1-c5-opus4/`. | Preserve verbatim. Runtime remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` until the separately authorized 17-run provider packet, static inspection, ACL/lifecycle checks, and matrix verification pass on the enrolled target. |
| M2: one executor and atomic operation redemption | `VALIDATED-DESIGN-ONLY` | Final digest `1109ed85ca5854bcb00d9490ddafa293612b156c4d25ffcb1e20d622b2513975`; Codex 99 clean in 147671 ms; cumulative exact provider-review duration 735690 ms. Opus not dispatched per owner Codex-only directive. | Freeze. M7 independent anti-rollback qualification, implementation, and staging/live writes remain outside closure; adapters stay observer-only. |
| M3: Jira mapping and reconciliation under approved Option E numbering | `VALIDATED-DESIGN-ONLY` | Ordered composition of round digests `aa412e046db3ae557dcbed09ca046b5331e2c58691e7eaf2b01e1071155a2094`, `87ded8044e450c29996388c81028c1b05d02fb56351a62b3d4d1b7b28f249f90`, `797f6cae847562947fb41bd5bf32759a74330fec58b07f7045881f48cb14381d`, and closing digest `4e47de7b1fc088623324beb6d80cea8daf0440ee23c5ad0305e52181c8232fb3`; Codex rounds 86/90/92/96 with final clean review in 6645 ms; no Opus. | Freeze. Runtime stays `TARGET_FIXTURE_NOT_YET_QUALIFIED` and observer-only without qualified sequencer/allocator/time/tenant/permission evidence. This does not close historical Q3 or validate M4-M7. |
| M4: provider status and independent canary under approved Option E numbering | `VALIDATED-DESIGN-ONLY` | Ordered composition of round digests `102cebd2919338d5282810a5887cf4868331dbb5c521c0772d518ce448c2dc2c`, `ac28589d119230ded16cbbaf4847763eda9c55227c6010b59298e79b9d2bb80f`, `200fca7c2a5d90813d525464be1c08d590c5d357868f0a955e8ee8e099435d83`, and closing digest `2516889cc5d2325491e051fcf369654899714c497ff0a75562f5f07b37d0f28a`; Codex rounds 87/92/92/97 with final clean review in 4217 ms; no Opus. | Freeze. Runtime stays `TARGET_FIXTURE_NOT_YET_QUALIFIED` until exact provider/observer/time/permission/common-cause/staging evidence passes. This does not decide rollback or validate M5-M7. |
| M5: rollback eligibility and execution under approved Option E numbering | `VALIDATED-DESIGN-ONLY` | Ordered composition of round digests `70d7315a1f3d71a668ea3df9f6ea66798e3bd6ce66f3388dca43ad3415346c51`, `912f810536ab671537a6c1219cd46abe970470178a9874f85843eb89729d2cbb`, `4bec7eca7bedf92338e7af925bf225d80cef310534e176559eed94bed0bb4c54`, and closing digest `da6d2371421cea20eaa160d9d31b8970d5dd0491a95f98004202e2516b6ddf42`; Codex rounds 88/92/92/96 with final clean review in 8183 ms; no Opus. | Freeze. Runtime stays `TARGET_FIXTURE_NOT_YET_QUALIFIED` and observer-only until M7, exact adapter/provider/time/permission/retention fixtures, synthetic staging, and live target qualification pass. This does not validate M6-M7. |
| M6: receipts, reports, and gstack provenance under approved Option E numbering | `VALIDATED-DESIGN-ONLY` | Ordered composition of round digests `29ec768910fbee532e7625fed97f2389e319b9a1f8b5620c06b41e1a4b312371`, `e7b14c101f7b4c0e908e2bf906ba52d3558cf495b4c5af908b7dc6dedb9cec3e`, and closing digest `eba586ceaf530653edfbcff5a59e1fd7261671219eada4eb5f69bddef4091ea2`; Codex rounds 88/92/96 with final clean review in 6255 ms; no Opus. | Freeze. M7 privacy/durability/anchor qualification, implementation, fixtures, packaging/notice verification, and target execution remain open; reports remain local non-authoritative projections. This does not validate M7. |
| M7: platform, durability, time, privacy, correlation, and target qualification under approved Option E numbering | `VALIDATED-DESIGN-ONLY` | Ordered composition of round digests `6f0251d327f7b92eec5a3b0c0ff4e82b4bb0b9e6aac7654955a801c2219e424c`, `bb4cd89148882a3d4aa9776bfe7b02f023fc59e875d36dae8b24d4c0340e16ed`, `d4223394a2820742e78a716a763b63a3232f9b6ab39c6d5c778dbb1766d1e4b8`, and closing digest `77b670804240550203bf6e6df03d94828b0054fcc0cc2a5e360134c8bd02cc9f`; Codex rounds 86/92/92/97 with final clean review in 5826 ms; no Opus. | Freeze design. Runtime remains `TARGET_FIXTURE_NOT_YET_QUALIFIED` and observer-only because no witness/time/KMS/attestor/host/provider/privileged/power/full-staging qualification packet ran. |

## Canonical reviewed design promotions

The final reviewed bytes formerly retained only below ignored review paths are
promoted into these nonignored decision files. Each canonical file is
byte-identical to its named review source and therefore preserves the exact
reviewed SHA-256. Promotion changes evidence durability only; it is not a new
review, implementation, composition pass, or runtime qualification.

| Item | Ignored reviewed source | Canonical nonignored decision | Exact SHA-256 |
|---|---|---|---|
| M1 correction 1 | `.kstack/reviews/release-automation-jira-2026-08-26-round9-codex/decision-brief.md` | [M1 correction 1](release-automation-jira-2026-08-27-m1-correction1.md) | `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523` |
| M1 correction 2 | `.kstack/reviews/release-automation-jira-2026-08-26-m1-c2-codex1/decision-brief.md` | [M1 correction 2](release-automation-jira-2026-08-27-m1-correction2.md) | `a217f92d67f4cdee5deb178c9855c7de9ccb243cec12890b097c81ca86783e16` |
| M1 correction 4 | `.kstack/reviews/release-automation-jira-2026-08-26-m1-c4-codex1/decision-brief.md` | [M1 correction 4](release-automation-jira-2026-08-27-m1-correction4.md) | `9addaaa63aaf1130b85260762a2609abf304fea4e20bd86b6cf42584fb841d2e` |
| M1 correction 5 | `.kstack/reviews/release-automation-jira-2026-08-26-m1-c5-codex1/decision-brief.md` | [M1 correction 5](release-automation-jira-2026-08-27-m1-correction5.md) | `9dda35f801d332ee581d6e6566f7641b53facbc9f02711102a8f85d6277cd90f` |
| M2 | `.kstack/reviews/release-automation-jira-2026-08-26-item-m2-r3/decision-brief.md` | [M2 one executor and atomic redemption](release-automation-jira-2026-08-27-m2-one-executor-atomic-redemption.md) | `1109ed85ca5854bcb00d9490ddafa293612b156c4d25ffcb1e20d622b2513975` |
| M3 | `.kstack/reviews/release-automation-jira-2026-08-26-item-m3-r4/decision-brief.md` | [M3 Jira mapping and reconciliation](release-automation-jira-2026-08-27-m3-jira-mapping-reconciliation.md) | `4e47de7b1fc088623324beb6d80cea8daf0440ee23c5ad0305e52181c8232fb3` |
| M4 | `.kstack/reviews/release-automation-jira-2026-08-26-item-m4-r4/decision-brief.md` | [M4 provider status and independent canary](release-automation-jira-2026-08-27-m4-provider-status-independent-canary.md) | `2516889cc5d2325491e051fcf369654899714c497ff0a75562f5f07b37d0f28a` |
| M5 | `.kstack/reviews/release-automation-jira-2026-08-26-item-m5-r4/decision-brief.md` | [M5 rollback eligibility and execution](release-automation-jira-2026-08-27-m5-rollback-eligibility-execution.md) | `da6d2371421cea20eaa160d9d31b8970d5dd0491a95f98004202e2516b6ddf42` |
| M6 | `.kstack/reviews/release-automation-jira-2026-08-26-item-m6-r3/decision-brief.md` | [M6 receipts, reports, and gstack provenance](release-automation-jira-2026-08-27-m6-receipts-reports-gstack-provenance.md) | `eba586ceaf530653edfbcff5a59e1fd7261671219eada4eb5f69bddef4091ea2` |
| M7 | `.kstack/reviews/release-automation-jira-2026-08-26-item-m7-r4/decision-brief.md` | [M7 target qualification](release-automation-jira-2026-08-27-m7-target-qualification.md) | `77b670804240550203bf6e6df03d94828b0054fcc0cc2a5e360134c8bd02cc9f` |

M1 correction 3 remains canonical separately at
`release-automation-jira-2026-08-26-m1-correction3.md`, exact reviewed SHA-256
`efdd3eddb9d78986ed9ebed335ccd6675f3f74b70bbaeaa337caa761d0556f0d`;
it was not copied or altered by this promotion.

All promoted artifacts remain `VALIDATED-DESIGN-ONLY` evidence in this ledger's
scope. Production is still `TARGET_FIXTURE_NOT_YET_QUALIFIED`; no promoted file
proves implementation, adapter availability, provider behavior, credential or
identity posture, staging execution, live release, rollback, or Jira write.

## Option E owner-lock integrity evidence

The immutable owner-decision record at SHA-256
`b5a5dec1d4e063a7896249f20d2c3a2694a148a20f83670645dd5505df21c6f7`
binds option brief SHA-256
`4111cc68c347865ec53a72730885bf4d63fb27fdbae482c73a242cb2acb54f42`.
A Codex-only integrity review returned confidence 99, `CLEAN`, with 0 failed
checks, 0 security findings, 0 material dissent, and 0 unresolved selection
questions. The review-output SHA-256 is
`1b1377c3218ece23dc520346a944bb4b5654297f1be6744b8eecc3c2c3c4217e`.
The ignored review artifact did not retain an exact duration, so none is
invented here. No Opus was dispatched. This validates faithful owner-lock
integrity only; it is not implementation or runtime qualification.

## M1 correction 3 Codex round evidence

`F/S/D/Q` means failed checks / security findings / material dissent /
unresolved questions. The owner-approved egress covered the exact candidate
and bounded correction rounds. No Opus was dispatched.

| Round | Reviewed design digest | Confidence | Decision | Duration | F/S/D/Q | Review-output SHA-256 |
|---|---|---:|---|---:|---:|---|
| M1-C3-R1 | `bd47e53c77888bc7bb18a3c058784547456277ee9707652573a34acbea4d5888` | 97 | revise | 100470 ms | 1/1/0/0 | `985efc4d06feb40fc055126015bac9ee1d32c2d97b2b1728009365206026e666` |
| M1-C3-R2 | `efdd3eddb9d78986ed9ebed335ccd6675f3f74b70bbaeaa337caa761d0556f0d` | 96 | approve design only | 11250 ms | 0/0/0/0 | `764f038ebba2b0f95d88a6fcc50d29d6d6c25b08bb352cf0fdc8f6609f1bc1d6` |

Round 1 found one high-severity TOCTOU defect: equal environment snapshots did
not exclude a transient `prevent_self_review` disable/approve/restore. The
bounded correction made that provider flag defense-in-depth rather than an
authority dependency, independently requires the qualifying reviewer ID to
differ from the exact-run OIDC workflow `actor_id`, retains the protected
local-requester/reviewer person inequality for `distinct-reviewer`, and adds
the transient fixtures. Round 2 closed that exact defect cleanly. This evidence
validates design only; it does not claim the provider or identity fixtures ran.

## M3-M7 Codex round evidence

`F/S/D/Q` means failed checks / security findings / material dissent /
unresolved questions. Durations are exact provider-review durations recorded
in the corresponding review outputs. Every digest below is the exact reviewed
packet/design digest; the last column preserves the exact review-output digest
so the evidence remains checkable after ignored review directories are
excluded from a sanitized commit.

| Item-round | Reviewed digest | Confidence | Decision | Duration | F/S/D/Q | Review-output SHA-256 |
|---|---|---:|---|---:|---:|---|
| M3-R1 | `aa412e046db3ae557dcbed09ca046b5331e2c58691e7eaf2b01e1071155a2094` | 86 | revise | 64178 ms | 11/4/0/0 | `c021a945d4172016ee9e68b85ab514f8ea185b388b1669c3b8c297e128e1bdce` |
| M3-R2 | `87ded8044e450c29996388c81028c1b05d02fb56351a62b3d4d1b7b28f249f90` | 90 | revise | 28351 ms | 5/2/0/0 | `2b0d78f8eb19cc9f1336204160eee44edd4ace560d8a893bad6e8d85e1dd27f2` |
| M3-R3 | `797f6cae847562947fb41bd5bf32759a74330fec58b07f7045881f48cb14381d` | 92 | revise | 20979 ms | 3/1/0/0 | `4c6733b5f99a3a6f148ecd058854c27014d64bd998509a1b55c5f90d8219907d` |
| M3-R4 | `4e47de7b1fc088623324beb6d80cea8daf0440ee23c5ad0305e52181c8232fb3` | 96 | approve design only | 6645 ms | 0/0/0/0 | `5db0a0c31c8fab6f098062240bc76f65962f0e593039e7b79637a2dc6a764639` |
| M4-R1 | `102cebd2919338d5282810a5887cf4868331dbb5c521c0772d518ce448c2dc2c` | 87 | revise | 27538 ms | 8/3/0/0 | `e79f35c9c5583a54b19419ed392300ecba2980951fb5f670f7486bc038fe8e83` |
| M4-R2 | `ac28589d119230ded16cbbaf4847763eda9c55227c6010b59298e79b9d2bb80f` | 92 | revise | 15082 ms | 3/0/0/0 | `b18a69fd18e2903a6d4d5f58ba99e7bb77706f466bd03693cebb79ec63189382` |
| M4-R3 | `200fca7c2a5d90813d525464be1c08d590c5d357868f0a955e8ee8e099435d83` | 92 | revise | 7772 ms | 1/0/0/0 | `b80bc6df93d6a63d9c9ba63b4683f6dde748cec2d9d9dc937aa182cbad76d4db` |
| M4-R4 | `2516889cc5d2325491e051fcf369654899714c497ff0a75562f5f07b37d0f28a` | 97 | approve design only | 4217 ms | 0/0/0/0 | `09f05d81625633f56e2b496ccca78de84f00bad58ddbf71589d2f59620d903de` |
| M5-R1 | `70d7315a1f3d71a668ea3df9f6ea66798e3bd6ce66f3388dca43ad3415346c51` | 88 | revise | 3206 ms | 5/3/0/0 | `e80cac5bf4e882dd3e0ba0ce3eb66e4a41f006aaf537dca5cad128f60276b911` |
| M5-R2 | `912f810536ab671537a6c1219cd46abe970470178a9874f85843eb89729d2cbb` | 92 | revise | 16309 ms | 3/1/0/0 | `7ecbeef8db1f75238755df705dfcb182c0518669cee092295d5fa776aeaf322f` |
| M5-R3 | `4bec7eca7bedf92338e7af925bf225d80cef310534e176559eed94bed0bb4c54` | 92 | revise | 16393 ms | 2/2/0/0 | `374be02f5f44c110ea1e55a430e98ef8f0a2e56a31debae6de8ab182ff5d0bc1` |
| M5-R4 | `da6d2371421cea20eaa160d9d31b8970d5dd0491a95f98004202e2516b6ddf42` | 96 | approve design only | 8183 ms | 0/0/0/0 | `c7a5de3e8fa01a078a72d9e24157c022830d47db03de3f5a4a4645d18a038549` |
| M6-R1 | `29ec768910fbee532e7625fed97f2389e319b9a1f8b5620c06b41e1a4b312371` | 88 | revise | 9664 ms | 5/2/0/0 | `927f2bebbff53ede447029afb81f6977803e3914e06732ed504c2d59c31acba6` |
| M6-R2 | `e7b14c101f7b4c0e908e2bf906ba52d3558cf495b4c5af908b7dc6dedb9cec3e` | 92 | revise | 13126 ms | 2/0/0/0 | `b12abec14396329edbe515d806f62a751556da9c2e328d836e62d381e3620978` |
| M6-R3 | `eba586ceaf530653edfbcff5a59e1fd7261671219eada4eb5f69bddef4091ea2` | 96 | approve design only | 6255 ms | 0/0/0/0 | `a9e457a36ce140bbc6ce48055578e3cb7e0d83b94146bc3ee305a5d2bcb01952` |
| M7-R1 | `6f0251d327f7b92eec5a3b0c0ff4e82b4bb0b9e6aac7654955a801c2219e424c` | 86 | revise | 9608 ms | 6/4/0/0 | `77b97d25c58a980c95f7128d302038c63589e25b3791f8b366913a222d22e56c` |
| M7-R2 | `bb4cd89148882a3d4aa9776bfe7b02f023fc59e875d36dae8b24d4c0340e16ed` | 92 | revise | 5700 ms | 3/1/0/0 | `bd036d974f4136598f854977f8f9c83d392eebe4600b20501274a367d24c9a18` |
| M7-R3 | `d4223394a2820742e78a716a763b63a3232f9b6ab39c6d5c778dbb1766d1e4b8` | 92 | revise | 9033 ms | 1/1/0/0 | `286a15faa65c028a3fb328b0872749f0e3f0afe8bb39b25a2df2e34fe1042313` |
| M7-R4 | `77b670804240550203bf6e6df03d94828b0054fcc0cc2a5e360134c8bd02cc9f` | 97 | approve design only | 5826 ms | 0/0/0/0 | `8dfd20852bde742da5a002b579305d24ba60a7accb83a9e963546577adea1f6b` |

Exact cumulative review durations are M3 120153 ms, M4 54609 ms, M5
44091 ms, M6 29045 ms, and M7 30167 ms.

## Final truth boundary

The clean closing rounds validate the named designs only. They do not prove an
implemented release system or a runtime pass. M1 corrections 1-5 and M2-M7
have closed design evidence, but production remains
`TARGET_FIXTURE_NOT_YET_QUALIFIED` and observer-only until the exact required
implementation, target, provider, identity, permission, time, durability,
privacy, privileged/power, Jira, and composed staging/live qualifications have
run. No owner lock, confidence value, or clean design round grants external
mutation, deployment, rollback, merge, commit, push, or publication authority.
