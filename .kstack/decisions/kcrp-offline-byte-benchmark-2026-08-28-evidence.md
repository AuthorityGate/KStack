# KCRP representative offline byte-benchmark evidence

| Field | Bound value |
| --- | --- |
| Date | `2026-08-28` |
| Status | `OFFLINE_MEASUREMENT_COMPLETE_WITH_QUALIFICATION_BLOCKERS` |
| Boundary | `OFFLINE_SUBSET_ONLY` |
| Dispatch authority | `NONE` |
| Provider measurement | `UNAVAILABLE` |
| Measurable lanes | `1 / 5` (`Memory`) |
| Blocked lanes | `4 / 5` (`Host`, `Domain`, `Release/Jira`, `ECR TC06`) |
| Raw source content retained here | `NO` |
| Machine-specific paths retained here | `NO` |

## 1. Qualification scope and method

This record is aggregate-only evidence for one representative, read-only use of
the closed KCRP offline subset. It does not persist a packet, source record,
artifact body, provider input, or provider output. The checked-in fixtures
persist only raw-content-free deterministic metadata needed to reconstruct and
rehash the Memory and ECR item maps from the current repository files.

The method was:

1. Resolve each candidate lane only from current repository-relative governing
   decision records and their exact SHA-256 identities.
2. Admit a whole canonical UTF-8/LF record as one full-span source only when the
   record's relationship to the requested item was explicit. No inferred
   excerpt, omission, dependency, or supersession was permitted.
3. Build an in-memory `kstack-kcrp-item-map-v1`, validate it, build the declared
   closure, and independently verify the closure against the same canonical
   artifact bytes and item-map digest.
4. Where the closure contained at least one included and one omitted item,
   build and verify full-required and reduced `kstack-kcrp-source-record-v1`
   packets, then build their offline dispatch manifests.
5. Feed exactly those immutable packet and manifest bytes to the closed offline
   byte benchmark. Execute an identical replay and require byte-identical report
   bytes and the same report digest.
6. If a complete local dependency graph or a nonempty omission set was absent,
   stop that lane without estimating bytes, tokens, cost, or quality.

The Memory full corpus is the eight operative canonical design/source records
listed below. The explicitly superseded historical objective and the
bookkeeping/review item ledger were not design-under-review packet content.
The source ledger remained included because Slice 1 binds it directly.

## 2. Exact offline implementation and validation identities

| Artifact | SHA-256 |
| --- | --- |
| `plugins/kstack/scripts/kstack-kcrp-json.mjs` | `f27f42839dcacd2cb6909fdb74747a3497d80538e7df8dd39287aee6f57eae99` |
| `plugins/kstack/scripts/kstack-kcrp-core.mjs` | `d0e7c7272989edcf6df84a3a65b030c9be6da4532612dc2ba9b702cb09e5c155` |
| `plugins/kstack/scripts/kstack-kcrp-dispatch-manifest.mjs` | `87e15cdda08552c643e10222da4fc5a8a6641385e4712c5f07f095528f5b099b` |
| `plugins/kstack/scripts/kstack-kcrp-byte-benchmark.mjs` | `521c3b3caa1b52dce912b187519a7ed3c35bc8d601dbe7aabf5b4feb3dfb21f2` |
| `tests/kcrp-core.test.mjs` | `9d911338fcb5f05ecf54323f62b9cb1b50ebab89a868e6cca1e0da01fde32f92` |
| `tests/kcrp-source-record.test.mjs` | `6c855b0ee1f5c542405bd073a6c1e9d1367489032db12984926d09b78c8738c4` |
| `tests/kcrp-dispatch-manifest.test.mjs` | `03518eed0b5baaf0085ee1a0b39e4879b17a98a9929a8a1abe40e9c42c49faeb` |
| `tests/kcrp-byte-benchmark.test.mjs` | `61239da471f42136d350dce84da3b5a5c703414aa339aef70a04c9cd140d5796` |
| `tests/fixtures/kcrp-memory-byte-replay-v1.json` | `faabee96773d51cb018d17739b35f7f9f95802280d6d476a69088ae1c97bff1c` |
| `tests/fixtures/kcrp-ecr-closure-replay-v1.json` | `507e2147210633f39cc2814aa368f502be1e136350c5c8f0aa7045799537edca` |
| `tests/helpers/kcrp-offline-byte-replay.mjs` | `e03b20d8a03cbfe316686b9e5feae6ff11f5823bbf42c42e0ba605b924882e92` |
| `tests/kcrp-offline-byte-replay.test.mjs` | `553161e09c07cdda66aedce5eb1b2d1f714fad1ce4b82ac9eaeea5d1f959afcd` |

The validation command covered all five named test files and returned five
passes, zero failures, zero skips, and zero cancellations.

The measurement identity bindings were:

| Identity | SHA-256 | Meaning |
| --- | --- | --- |
| Objective | `8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf` | Exact Memory option-selection record |
| Reviewer | `8c0712df91b9de8e9821474b7baf8429771ff45dc4947f1fe0674233c9db26b4` | Canonical digest of the domain-separated local Codex read-only identity framing in the replay fixture |
| Governance | `b93b7b2ed932cc5dfee6a1e728ac502cb3639dfa37929cb9773cdfbcb805d45b` | Canonical digest of the domain-separated exact core, dispatch-manifest, and byte-benchmark module SHA set in the replay fixture |

## 3. Memory governing source set

All records in this table are beneath `.kstack/decisions/`; only the
repository-relative basename and exact digest are retained.

| Item | Governing record | SHA-256 | Closure disposition for requested Slice 3 |
| --- | --- | --- | --- |
| Option | `memory-maturity-2026-08-26-option-selection.md` | `8611a99bddd92392a142b431d7693b3faa0a0d1e0328ea955f229cf133a208cf` | Included |
| Owner amendment | `memory-maturity-2026-08-26-option-selection-owner-record.md` | `c74d350ab4fa3ea912aa09a35963800d73bba63b4942ae466a4ef677726e2dfe` | Included |
| Source identity and license ledger | `memory-maturity-2026-08-26-source-ledger.md` | `baf70e2cde3f82ff17a34c97599797875d73a07eea3bdc6fa2685a6016374676` | Included |
| Slice 1 | `memory-maturity-2026-08-26-slice1-authority-citation.md` | `6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4` | Included |
| Slice 2 | `memory-maturity-2026-08-26-slice2-exact-bm25.md` | `9b8e303f8a7cbe1a2c7adac7b22e79f8e9aea5131b448175ab7dda499c2d206d` | Included |
| Slice 3 | `memory-maturity-2026-08-26-slice3-github-jira-ingestion.md` | `41f46d0159f84975403c5829cb7f014a8f93647b700cf65562a9e19d1206b16b` | Requested and included |
| Slice 4 | `memory-maturity-2026-08-26-slice4-encryption-deletion.md` | `7e652550ff287d834235a5a1ae83082b711fd4509aa1046d86b3b4a40e8b3207` | Omitted as an explicit later slice |
| Slice 5 | `memory-maturity-2026-08-26-slice5-sync-portability.md` | `58c2bbce85413aa264d4557306e965f3afcde9165cf504318c34c4b62958b8de` | Omitted as an explicit later slice |

The verified closure included six of eight records and omitted two. Its
in-memory item-map SHA-256 was
`1dd8d1e9adac2fbbea80e329d638241fab696cd838e182097bae0daf6b7fdc48`.

## 4. Memory aggregate byte result

| Measure | Full-required | Reduced | Delta |
| --- | ---: | ---: | ---: |
| Manifest bytes | 1,824 | 1,581 | 243 |
| Packet bytes | 151,869 | 83,322 | 68,547 |
| Total bytes | 153,693 | 84,903 | 68,790 |

| Result field | Exact value |
| --- | --- |
| Route | `reduced` |
| Status | `MEASURED` |
| Reason | `BYTE_SAVINGS_MEASURED` |
| Exact savings fraction | `22930 / 51231` |
| Decimal byte savings | `44.758057%` |
| Exact basis points | `229300000 / 51231` |
| Decimal basis points | `4475.8057` |
| Full packet SHA-256 | `ca334fef9003c5bf03d0344820d8b549269ac69b81c61bc31b219cb0e61da4b3` |
| Reduced packet SHA-256 | `1137a8f0673059217ebcf757717ed240940c41f12588a0a258b964b67d703112` |
| Full manifest SHA-256 | `cee87c390ae1e1a040fe53fb75639d71795f94c73ac465c6a455ede7ff7d70d7` |
| Reduced manifest SHA-256 | `bcd485cfa1be4eec370011a1971bbce2afdd843450c1d60a6892db6ce5ee5b38` |
| Aggregate benchmark report SHA-256 | `de2a66a3f3222856451c2277aa17e366980be1c8d17ada23e7444bea8975b45d` |
| Aggregate replay evidence SHA-256 | `2f5c9e3df519a6ea81d5326640af786ee91ecb57c3ef4892b970051ccaf34c76` |
| Replay result | `BYTE_IDENTICAL` |
| Pair count | `1` |
| Reduced outcomes | `1` |
| Full-fallback outcomes | `0` |
| Blocked outcomes | `0` |

### 4.1 Checked-in canonical replay

The replay is now a checked-in, read-only test harness rather than an
unrecorded one-shot construction. Run from the repository root:

```text
node tests/helpers/kcrp-offline-byte-replay.mjs
```

The helper reads only the two pinned raw-content-free fixture files and their
repository-relative sources, verifies every source and module digest, invokes
the closed KCRP modules in memory, and writes one canonical aggregate JSON line
to stdout. It has no provider, network, production configuration, or persistent
write integration.

All fixture, source, and governance reads share one bounded repository-file
reader. It rejects traversal and link/reparse-like components, confirms realpath
containment before and after descriptor-based reading, uses `O_NOFOLLOW` where
available, admits only size-bounded regular files, and revalidates
device/inode/size/mtime identity against the path after the read. Its failures
carry only a typed surface and closed reason; no path or file content is placed
in evidence.

| Rerun output | Exact value |
| --- | --- |
| Canonical report bytes, excluding final LF | `2,609` |
| Canonical report SHA-256, excluding final LF | `2f5c9e3df519a6ea81d5326640af786ee91ecb57c3ef4892b970051ccaf34c76` |
| Helper stdout bytes, including final LF | `2,610` |
| Helper stdout SHA-256, including final LF | `3a556c53038f6d00d9045308673ca52607fb98911fe12c4b3b3f6c46f8e0069b` |
| Memory fixture file SHA-256 | `faabee96773d51cb018d17739b35f7f9f95802280d6d476a69088ae1c97bff1c` |
| Memory fixture canonical preimage SHA-256 | `b3b85d02af9c42b129c788aa3dc452b99a1fc04329c4806d08cb912f78c7b262` |
| Memory item-map canonical preimage SHA-256 | `1dd8d1e9adac2fbbea80e329d638241fab696cd838e182097bae0daf6b7fdc48` |
| ECR fixture file SHA-256 | `507e2147210633f39cc2814aa368f502be1e136350c5c8f0aa7045799537edca` |
| ECR fixture canonical preimage SHA-256 | `61f1160b9cd45d004a9385f7faf103eef85420749ddbf6a0ed1362fdc4f1a363` |
| ECR item-map canonical preimage SHA-256 | `57a61fa441f2e25aec491bfa15cb59b060d96d2bdba30578c5303d539964edfe` |
| Memory replay outcome | `1 requested / 6 included / 2 omitted / reduced` |
| ECR replay outcome | `1 requested / 13 included / 0 omitted / no reduced arm` |
| Repeat check | `2 independent in-process runs; BYTE_IDENTICAL` |

The focused replay test also executes the reconstruction twice, compares the
complete canonical aggregate bytes, and pins every published packet, manifest,
item-map, report, identity, count, and exact-rational savings value.

## 5. Blocked lane inventory

### 5.1 Host breadth

| Governing record | SHA-256 |
| --- | --- |
| `host-breadth-option-selection-2026-08-26-owner-decision.md` | `1708c5af6c54c983d7a31202913e4858719c3936ac805f44af82cd30dfda910e` |
| `host-breadth-option-c-2026-08-26-item-ledger.md` | `535584acc9903ce765f12e6f2a5a88637862784d5929ebd2a957f0576b08880d` |
| `host-breadth-hb-tc01-2026-08-26-final-reviewed-delta.md` | `65dc5885d198751dcdcd345fd938e9e36a6885dd89194d2c676eab0d55a1139d` |
| `host-breadth-hb-tc02-2026-08-26-final-reviewed-delta.md` | `0291fd82057c943fe4f26effeca1c80455d41b57358988a972c890d084ad1f68` |
| `host-breadth-hb-tc03-2026-08-26-final-reviewed-delta.md` | `7b2dd804d16a795121cbea8e2658c95ae7a127957b145793d4b2a672fb877ec7` |
| `host-breadth-hb-tc04-2026-08-26-base-design.md` | `366f4f4a2f568f040258cfc5f23c92bbcc0a513975ef229ff73967ae2e206219` |
| `host-breadth-hb-tc04-2026-08-26-repair-r2.md` | `600f6de3513d66aecac820f9ff3d1cade8e07c61db3ced38b9fe020158f4a6c3` |
| `host-breadth-hb-tc04-2026-08-26-final-reviewed-delta.md` | `0d66619a18150a3234353ca36cec4addaab1e3720bae55b172c7e7b1fa91ec7c` |
| `host-breadth-hb-tc05-2026-08-27-design-candidate.md` | `eb09f43501678654e94fe714416b45f16f6f08f964976dec6719cd89ca02280f` |
| `host-breadth-hb-tc06-2026-08-27-design-candidate.md` | `98667edb88dcb5d24ad735335699977f48ea39cf1ec6cf56ba339675106b3427` |

Blocker: no persisted `kstack-kcrp-item-map-v1` binds this lane. TC01 through
TC03 also bind cumulative packet digests
`35e78d77bf8512b5d8699965b29e853d9d21477b4da5cabb68f7afaaabbece0c`,
`1a6584834d5b630a70d90bb031b3582b69e0b844b4f66ad2e9435cbfdb5be128`,
and `df1cd2d2e5fdcf5e2155c24316265187581d76510a198c6721fb81fb82d48c28`
without materializing those canonical packet bodies in the governing decision
set. A final delta cannot be treated as the full predecessor body.

### 5.2 Domain breadth

| Governing record | SHA-256 |
| --- | --- |
| `domain-breadth-acquisition-option-2026-08-26-owner-decision.md` | `a8b61a7665ccb1774c6890530ccc336b4804b65eb090e46553b83395fb3133a6` |
| `domain-breadth-packs-2026-08-26-round-1-clarification.md` | `18789e8d8e1967a61641bcdff39bcca321ce9132f819a767103f36ce4bfba3a1` |
| `domain-breadth-packs-2026-08-26-item-ledger.md` | `dc4dade13889acf392a542b4c17aec71f11c38ab2007b654bce63c617ffbf6ea` |
| `domain-breadth-packs-2026-08-27-d1-authenticated-identity.md` | `4947151d6d5ac746330b2c04f9669725700a8a43c0494edd6b6e2e04a5ebd1e7` |
| `domain-breadth-packs-2026-08-27-d2-f1-inventory-equality.md` | `a32b324ff819c6815bf15d0888bfbe7c546a1503332b6e8ab8b96e8941b4eac9` |
| `domain-breadth-packs-2026-08-27-d2-f2-policy-binding.md` | `e8144a0415a23a6e79bc73c2fd4e8ce15c6f5d890b1893b1f5baf991feb153ff` |
| `domain-breadth-packs-2026-08-27-d2-f3-selection-digest.md` | `5f1055afdc427f1931bb4de27e0b25237aed17dc6cd2051378394b4109913556` |
| `domain-breadth-packs-2026-08-27-d3-separation-of-duty.md` | `cb5e88f1977f2db5ecd2edb902bd6d9caed51a344538b62565fb78e52aede855` |
| `domain-breadth-packs-2026-08-27-d4-d10-result-evidence-contract.md` | `160052d5a69d94c12c60f35de8a89affc4cbb04cb0dbd0abe0ddfb24a6d45878` |
| `domain-breadth-packs-2026-08-27-d5-f1-schemas-digests.md` | `7ea2e55c349a8d1bc0259e57fea3d2c347347a2530633e49c7624614dbb4dd74` |
| `domain-breadth-packs-2026-08-27-d5-f2-atomic-activation.md` | `b5573d954810c452f52dd304d056ff83287d2387599896a89512cf4748116a8b` |
| `domain-breadth-packs-2026-08-27-d6-budget-applicability.md` | `60021b58354f7a7292028a2bd14d05ec6c2d93415cbb302faa84964ecd5c011d` |
| `domain-breadth-packs-2026-08-27-d7-evaluation.md` | `a977dbd90cdbd2dd7f646af80c414f96ca60a888c2b79d18eb67693eeaf6d46d` |
| `domain-breadth-packs-2026-08-27-d8-trusted-time.md` | `3abee40273ad534b53d9b2cb230ae4d1a72440ba7d294ace9cad7b2f35e47683` |

Blocker: no persisted KCRP item map exists. The governing ledger retains the
D0 whole-candidate digest
`fc241844ce6f1b245f127941dda2328bf7d01cbf4bf16b13c32e61d258f805fc`
without a canonical local D0 body, while later isolated records preserve or
import prior mechanisms. Omitting any such predecessor without its exact body
and dependency binding would be invented.

### 5.3 Release automation and Jira

| Governing record | SHA-256 |
| --- | --- |
| `release-automation-jira-2026-08-26-option-selection.md` | `4111cc68c347865ec53a72730885bf4d63fb27fdbae482c73a242cb2acb54f42` |
| `release-automation-jira-2026-08-26-option-selection-owner-decision.md` | `b5a5dec1d4e063a7896249f20d2c3a2694a148a20f83670645dd5505df21c6f7` |
| `release-automation-jira-2026-08-26-round-1-clarification.md` | `07a8f0dbbbcad7ff303b5e9cf3f592bb3847d32d8c73651d21d85fbbc16a9f8e` |
| `release-automation-jira-2026-08-26-item-ledger.md` | `6793b720295c7461b1b4409dc01f0595e342b38dd209e378e6c9edd21c178dca` |
| `release-automation-jira-2026-08-27-m1-correction1.md` | `7b4d86f6aa5fc0ed8ceed58d01d16d608b5989f9b47164d95ba759553c3fc523` |
| `release-automation-jira-2026-08-27-m1-correction2.md` | `a217f92d67f4cdee5deb178c9855c7de9ccb243cec12890b097c81ca86783e16` |
| `release-automation-jira-2026-08-26-m1-correction3.md` | `efdd3eddb9d78986ed9ebed335ccd6675f3f74b70bbaeaa337caa761d0556f0d` |
| `release-automation-jira-2026-08-27-m1-correction4.md` | `9addaaa63aaf1130b85260762a2609abf304fea4e20bd86b6cf42584fb841d2e` |
| `release-automation-jira-2026-08-27-m1-correction5.md` | `9dda35f801d332ee581d6e6566f7641b53facbc9f02711102a8f85d6277cd90f` |
| `release-automation-jira-2026-08-27-m2-one-executor-atomic-redemption.md` | `1109ed85ca5854bcb00d9490ddafa293612b156c4d25ffcb1e20d622b2513975` |
| `release-automation-jira-2026-08-27-m3-jira-mapping-reconciliation.md` | `4e47de7b1fc088623324beb6d80cea8daf0440ee23c5ad0305e52181c8232fb3` |
| `release-automation-jira-2026-08-27-m4-provider-status-independent-canary.md` | `2516889cc5d2325491e051fcf369654899714c497ff0a75562f5f07b37d0f28a` |
| `release-automation-jira-2026-08-27-m5-rollback-eligibility-execution.md` | `da6d2371421cea20eaa160d9d31b8970d5dd0491a95f98004202e2516b6ddf42` |
| `release-automation-jira-2026-08-27-m6-receipts-reports-gstack-provenance.md` | `eba586ceaf530653edfbcff5a59e1fd7261671219eada4eb5f69bddef4091ea2` |
| `release-automation-jira-2026-08-27-m7-target-qualification.md` | `77b670804240550203bf6e6df03d94828b0054fcc0cc2a5e360134c8bd02cc9f` |

Blocker: no persisted KCRP item map exists. Several final M3 through M7 files
are bounded repair deltas whose preceding round bodies remain referenced by
digest rather than materialized as a complete canonical local composition.
The M1 correction series likewise does not define an item-map closure over a
single locally complete base. A delta-only reconstruction would be lossy.

### 5.4 ECR TC06

| Governing record | SHA-256 |
| --- | --- |
| `encrypted-credential-repository-2026-08-27-initial-objective-design.md` | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| `encrypted-credential-repository-2026-08-27-tc01-contender-selection.md` | `95358294c90dcd88a57fd6a2ec329005348c73c4f1e2ee21e0a5e0b112617bc0` |
| `encrypted-credential-repository-2026-08-27-tc01-codex-closure.md` | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| `encrypted-credential-repository-2026-08-27-tc02-threat-identity-authority-policy.md` | `e03e4c298eb65314cf251095f9f9349f53733edb1efab009ee577c4f66d4b202` |
| `encrypted-credential-repository-2026-08-27-tc02-codex-closure.md` | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| `encrypted-credential-repository-2026-08-27-tc03-fips-owner-decision.md` | `6b4cf4fe2cff2ad016055a31333652cc35fd23672f0cdb1f9abebae75c1a38f8` |
| `encrypted-credential-repository-2026-08-27-tc03-cryptographic-format-design.md` | `16d7cd06aff3ecf111076252c1cbe80c80bf08f46f514ab62bb5db7268c49ca5` |
| `encrypted-credential-repository-2026-08-27-tc03-codex-closure.md` | `6d562b5473ef5965272a4400b95b1f29977b11fb06b0ab6b9893adf630b70438` |
| `encrypted-credential-repository-2026-08-27-tc04-platform-custody-recovery-design.md` | `2fed5c13961e132962dc469f2f91260cbddaf43bcdcc9d23f04c73c8b9abd54e` |
| `encrypted-credential-repository-2026-08-27-tc04-codex-closure.md` | `0759ded9c92165b8d3455b659f0bef5fbf839af9d906223e41b574b1b83081c1` |
| `encrypted-credential-repository-2026-08-27-tc05-transactional-store-design.md` | `3d38ee883d89405cbf0b275ebeb1ec117a8883092d53fbb5b9fbe1550a5d8968` |
| `encrypted-credential-repository-2026-08-28-tc06a-entry-currentness-design.md` | `2f438db8a2f177bc44fcd5fc1f956158286027291c3300d8735882e9e2214fd9` |
| `encrypted-credential-repository-2026-08-28-tc06b-transition-authority-lifecycle-design.md` | `e15ca3123d6054ac939db902f357f97be3c6fb1a41b36f6b46c2c5b013793dc4` |

The refreshed in-memory closure inventory was independently built and verified
at item-map SHA-256
`57a61fa441f2e25aec491bfa15cb59b060d96d2bdba30578c5303d539964edfe`.
That value is the digest of the exact canonical item-map preimage reconstructed
from the checked-in ECR replay fixture; it is not a digest-only substitute for
the source bytes. The helper rehashes all 13 listed source files before building
and verifying the map and closure.
Requesting final TC06B reaches all 13 of 13 records and omits zero. The closed
dispatch-manifest contract requires a reduced route to have a nonempty omitted
set, so no valid reduced arm exists. This is a qualification blocker, not a
zero-percent result; no byte saving is reported.

## 6. Explicit nonclaims

This evidence establishes only canonical offline byte counts for the one
measurable Memory pair and deterministic fail-closed disposition for the other
four lanes.

It does **not** establish or claim:

- token savings, tokenizer behavior, context-window fit, or prompt quality;
- provider usage (`U`, `W`, `R`, or `P`), provider acceptance, or model output;
- cost savings, latency savings, reviewer accuracy, finding recall, or semantic
  equivalence;
- safe outbound-secret admission, provider dispatch, gate integration,
  configuration, activation, deployment, or production readiness;
- that Host, Domain, Release/Jira, or ECR TC06 has zero savings;
- that an absent item map may be inferred from prose, a digest may substitute
  for missing bytes, or a final repair delta may substitute for its complete
  predecessor composition; or
- authority to implement, mutate external state, commit, push, publish, or
  enable any measured mechanism.

Any future cross-lane or overnight claim requires persisted canonical item
maps, complete locally resolvable predecessor bodies, fresh artifact hashes,
the same bounded source/manifest verification, and a new independently replayed
evidence record.
