# KCRP Host and Domain offline byte-replay evidence

**Date:** 2026-08-29  
**Updated:** 2026-08-30 (provider-trial preparation, outbound-scan repair, and D7 multi-pack profile binding)  
**Scope:** preparation for Host KCRP A/B (`KSTK-31`) and Domain KCRP A/B (`KSTK-21`)  
**Boundary:** `OFFLINE_SUBSET_ONLY`; dispatch authority `NONE`

## Outcome

The prior missing-item-map blocker is closed for two bounded, representative
implementation packets:

- Host HB-TC06 second-host proof: the selected progress record closes over its
  exact governing design, production module, and focused test. The independent
  Linux qualification module is omitted. The former unrelated OpenCode source
  was replaced because the exact full-arm bytes correctly triggered the
  outbound generic-assignment matcher; no scanner bypass or exception was used.
- Domain D7 evaluation: the selected focused test closes over its exact
  governing design and production module. The independent assurance-pack
  candidate is omitted.

Both fixtures reconstruct their item maps, declared dependency closures, source
packets, offline dispatch manifests, and byte-benchmark reports twice with
byte-identical output. Every input is repository-relative, bounded, digest
pinned, and read through the existing closed KCRP replay reader.

This is not a provider trial. It records no authenticated provider receipt and
makes no token, cost, quality, host-support, domain-support, or activation
claim. The required 30 paired tasks across six classes, three overnight
windows, authenticated usage, latency, rounds, quality adjudication, and
activation-threshold decision remain outstanding.

## Host packet

| Field | Exact value |
| --- | --- |
| Fixture | `tests/fixtures/kcrp-host-hb-tc06-byte-replay-v1.json` |
| Fixture SHA-256 | `9e959a742ff6972ebf5c6361e7771d96e4d387cddc8dbafc1511b850c1dc1b78` |
| Canonical config SHA-256 | `090bbc26286542fa9c5fbb450b6452ffae22b50461ae56c763c1c29bacc60b32` |
| Item-map SHA-256 | `5b7cc3077deb85319789a3aa79a6ee8be7d9b5375a5a92a2acdb52b16835ac88` |
| Requested item | `HOST_HB06_PROGRESS` |
| Included | `HOST_HB06_DESIGN`, `HOST_HB06_IMPLEMENTATION`, `HOST_HB06_PROGRESS`, `HOST_HB06_TEST` |
| Omitted | `HOST_LINUX_UNRELATED` |
| Full | `67402` total bytes (`65914` packet + `1488` manifest) |
| Reduced | `52524` total bytes (`51161` packet + `1363` manifest) |
| Byte delta | `14878` bytes (`22.073529%`) |
| Full packet SHA-256 | `e2b782fdc28ead242f5d49925a3d0ac70d272504e6fe72dd3b62c09cc8914e39` |
| Reduced packet SHA-256 | `8717b7eb436defc9aa65bfc8c4d76df64640245bc91f46352d2cc56bc235bb25` |
| Full manifest SHA-256 | `760787c03a5a4630199d3859d61606c62e10210f5fdf5965c64b515ce7113704` |
| Reduced manifest SHA-256 | `a20a0fc91766f8a6e69f038f71b416893348ac7ab03fdea60388561938f007ef` |
| Benchmark report SHA-256 | `d42e4843b3481af842da6f2808ea53d6d9f357f5f73e0c9f608d87f733dd2ba8` |
| Full review-input SHA-256 | `3b891711e6057c5fd4b776cc817b14999276d51f55ec8f808baf3c3a6f2938e8` |
| Reduced review-input SHA-256 | `31d8a5fcdbd6ff69e98a85032b326f859ba9d41eb6329cd0aa30c641310c5b29` |

## Domain packet

| Field | Exact value |
| --- | --- |
| Fixture | `tests/fixtures/kcrp-domain-d7-byte-replay-v1.json` |
| Fixture SHA-256 | `774c6574d6a5027aec7b97338e146596dfbbce1f7d482dcfe6faa955075be23a` |
| Canonical config SHA-256 | `3f41455f71b99685ca7bede1c1b2a45e1f0e76b51a488e127b73c4f85d8365bd` |
| Item-map SHA-256 | `67271efcf889960cee3ebf1a7704b3b6864591b071dd916b291b86234c50e355` |
| Requested item | `DOMAIN_D7_TEST` |
| Included | `DOMAIN_D7_DESIGN`, `DOMAIN_D7_IMPLEMENTATION`, `DOMAIN_D7_TEST` |
| Omitted | `DOMAIN_ASSURANCE_UNRELATED` |
| Full | `73117` total bytes (`71780` packet + `1337` manifest) |
| Reduced | `71482` total bytes (`70269` packet + `1213` manifest) |
| Byte delta | `1635` bytes (`1635 / 73117`, `2.236142%`) |
| Full packet SHA-256 | `4c47fa902829acc7cadbfd3dfa96f48a4273a1f8afcfb7c5d3906d5ea46185d5` |
| Reduced packet SHA-256 | `e1f0348a84f82e7d30cb1acd365002bdee658001639b644a8422193358fcb0b8` |
| Full manifest SHA-256 | `a7c2349c5a52c11848debe9bbff5fe91067edde95382e43fc1de92a81ff61677` |
| Reduced manifest SHA-256 | `3823a2a5d3e7ab4bdde1f5fc99b82b33e8ec46dec82f4e784927ce22636bd87a` |
| Benchmark report SHA-256 | `8230536224841f0cb5d401c084b016868f502316ab9035711e82a0780f7b7654` |
| Full review-input SHA-256 | `103a6bacb1907203e8af7d86d74384e3e6a145ddc08908bb5045a813d7317ba2` |
| Reduced review-input SHA-256 | `510d3f597aa67713284c3493e9e574fe1d84832098bdf4644431172f89c836b1` |

## Validation

- Focused replay suite: pass.
- Two independent in-process reconstructions per fixture: byte-identical.
- Provider usage fields: all `null`, closed by
  `OFFLINE_SUBSET_NO_AUTHENTICATED_PROVIDER_RECEIPT`.
- Provider claims: all `null`, closed by
  `OFFLINE_CANONICAL_BYTE_BENCHMARK_ONLY`.
- Formatting validation: `git diff --check` clean.
- Runtime maturity status report: intentionally unchanged pending genuine
  full-backlog closure.

## Provider-window preparation

The 2026-08-30 Window 1 plans are prepared offline with 30 fixed tasks, six
exact task classes, five tasks per class, 60 crossover invocations per lane,
content-bound payload digests, and MatcherSetV1 admission. Preparation invoked
no provider and grants no dispatch authority.

| Lane | Corpus SHA-256 | Plan SHA-256 | Payload-set SHA-256 | Authorization SHA-256 | Payload bytes |
| --- | --- | --- | --- | --- | ---: |
| Host | `517590de0403b70bde6bc9faa1f041cb80217c5f9ff927b34ad356ec71953f7f` | `9b71342efad08832ba2d8dd42be786816091e89e3f1e5d0d89f3aa32fb4d423d` | `5b98b34d24e25251697030e8fd731d7c220ceeecdb7d13b97b43f9aa1fce608a` | `74e089d5ca0be81d460afead7771ced769e8fc2981b806481324b308a970094d` | 3646986 |
| Domain | `5c937147845a70b91458c44da917d939dd2a930ccc6c2d1d20534abe40de0ff0` | `f77e6e57245c4d15a9897a1b4be7706e6ab3b2a2f389d4d0c23d42d1c484bdae` | `4bfd511b67ed110374dae222bdd559777fe2631599709a96d50a5967684ce777` | `0228f40eec350ee9888584e38a278eb2192abe905db94dcca70c31438555a6f5` | 4386276 |

## Remaining gate

These bounded fixtures make the Host and Domain lanes executable inputs for a
future representative provider A/B campaign. They do not satisfy that campaign.
`KSTK-31` and `KSTK-21` may move from Planned to Active, but not Done.
