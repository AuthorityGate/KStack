# KStack Secret Broker — WP02 configuration and package foundation

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Work package | `SB-WP02` / Jira KSTK-133 |
| Jira stable item digest | `70252c51d142b93f76a0369d5a635c49af62a62943eaf8f93f5b3b2001362933` |
| Integrated dependency | SB-TC12 SHA-256 `0c516367cbf7ab6088f17f54594abd364119ad9020c90ca52ca64ed9739b681e` |
| Direct contracts | SB-TC09 SHA-256 `f76640aabb05ae2af4288fcd7e06c6183f74edcdbe59e133c031882d95727137`; SB-TC11 SHA-256 `1ec9bccc8dde857c6d659cee36d10b535a2fbfad65b5fe79966d000ec12e70ee` |
| Disposition | `VALIDATED_R5_APPROVE_97`; all four review counters zero |
| Runtime effect state | `UNAVAILABLE / IMPLEMENTATION_NONCONFORMANT` |

## Outcome

WP02 implements only the accepted value-free configuration and package
foundation:

- one 65,536-byte-bounded duplicate-safe config lexer rejects invalid UTF-8,
  BOMs, duplicate keys, unsafe numbers, depth/list/property excess, malformed
  Unicode, and trailing data before ordinary object materialization;
- legacy schema 1 remains human-formatted and exact at its top-level boundary,
  cannot contain `secretBroker`, and projects only the disabled broker;
- schema 2 requires canonical JSON, exact keys at every schema-defined level,
  and the closed disabled public broker block;
- operational config consumers, including Jira, review, memory, panels,
  Reflexion, safety, and citation selection, use the shared duplicate-safe
  boundary without changing the authoritative WSL Jira custody route;
- the synthetic-only migrator materializes effective defaults for every valid
  sparse v1 shape, retains exact v1 bytes, binds journal/backup/fence paths,
  serializes known repository config writers by config-path identity, publishes
  complete artifacts from fsynced staging files, and uses an exclusive
  claim/install exchange that preserves a competing writer rather than
  overwriting it while resuming every durable forward, fence, and rollback
  boundary, rejects portable case aliases and existing same-file artifact
  aliases, and fails closed before lock acquisition when a reaper-only crash
  artifact remains;
- the release manifest and self-excluding source audit form an acyclic pair;
  the release excludes both manifests and the audit includes the completed
  release plus every release content entry; and
- publication verification binds version and manifest-pair digests to builder,
  security-approver, and publisher principals with distinct references and
  distinct Ed25519 public keys, but caller-supplied roots remain only
  cryptographically verified and can never become pilot- or
  production-eligible. The current installers supply no protected trust
  binding, so an ordinary checkout remains `UNSIGNED_DEVELOPMENT`.

The live repository `.kstack/config.json` was not migrated. No credential
source, protected-state adapter, provider, target, Jira credential, clipboard,
or model-visible value route was opened by implementation or verification.

## Frozen implementation candidate

| Path | SHA-256 | Role |
|---|---|---|
| `plugins/kstack/scripts/secret-broker/config-document-v2.mjs` | `a2cadb431ceb6f9ac68489e9fc20620fed6c51a713387c5429e9bc89e9796694` | bounded duplicate-safe v1/canonical-v2 document boundary |
| `plugins/kstack/scripts/secret-broker/config-migration-v2.mjs` | `79288a57baa91898f44ce313bc49001bbcd9db5550ab0fde26ea636a3682cc67` | sparse-v1 completion, portable/same-file alias rejection, config-path lock, reaper-first fail-closed acquisition, staged artifact publication, exclusive claim/install recovery, bound commit fence, and pre-fence rollback |
| `plugins/kstack/scripts/secret-broker/release-manifest-v1.mjs` | `a7b432fb833811e6341056ff87d2f984358917a242f2eeb09c4511afaf955bfa` | closed release/source-audit construction, canonical release-entry binding, and source-independent semantic verification |
| `plugins/kstack/scripts/secret-broker/release-provenance-v1.mjs` | `eb218f4bca9a9169fb61c42285dd93916b559855885ba029540569ded76dc599` | distinct-key three-role cryptographic verification with permanently ineligible caller classification |
| `plugins/kstack/secret-broker-release-manifest-v1.json` | `88458532fe40f7267a31ea78829ca8d5dcb5162bbc46d9b59840c7897b9258ae` | canonical acyclic release leaf root |
| `plugins/kstack/secret-broker-source-audit-manifest-v1.json` | `3e1cd4dae01074212e5b50970b046a65f056401bf035604ee212509fbf50ab92` | canonical self-excluding release/content audit |
| `plugins/kstack/install-health-contract-v1.json` | `f45efac23544a69057ba33156e7fa327bb9c8063c9768025ee5b3f3c84c1521f` | 18-probe installed validation contract |
| `plugins/kstack/install-health-audit-manifest-v1.json` | `77bb7321d12eaf457b1f24eb4b48e766287962e6a6c407e94d48476f34f4d9fa` | whole distributed source byte closure containing both manifests |
| `plugins/kstack/scripts/kstack-citation-admin.mjs` | `df7b2aa5388d11b422039cd9b4407d262e5e90ea34d5a42ecdacab7f3984c3a3` | full shared config reader for citation administration |
| `plugins/kstack/scripts/kstack-citation-state.mjs` | `39cb71ce8206d85b6db5f07627f476d682b4ddb0456290662e780ff63be9bf33` | descriptor-bound citation selector using full v1/v2 document validation |
| `plugins/kstack/scripts/kstack-jira-bootstrap.mjs` | `2cd9e1db1f64574d6e643e1dab1e11992441a1aa00c6470d7380f420cbb614de` | authoritative WSL Jira config write serialized by the migration lock |
| `plugins/kstack/scripts/kstack-jira-wsl-config.mjs` | `8baa4dc86c729c25f7a992fb7ce57dd9d397732c3cf5f49ff56461a969dc6044` | fixed value-free native-Windows projection through the authoritative WSL reader |
| `plugins/kstack/scripts/kstack-safety-admin.mjs` | `1010c1760c4e1546c49db4beb38e6529ffa8688ba60e762c4243fa3ceb86825e` | descriptor-bound safety policy snapshot through the shared duplicate-safe parser |
| `plugins/kstack/references/SECRET_BROKER.md` | `705409bb7b7cbb54e9518c116d77a121cfc400dd50e3791889657704b84d122d` | truthful reader, portable path identity, reaper-only, replacement, fence, and caller-ineligible trust boundary |
| `setup` | `d139f655b04e5d5ff8291a56ef64e4ac158ecc942e753907fc56f72faeae3664` | POSIX/copy delivery of both manifests and cache equivalence |
| `setup.ps1` | `c987fbc7bdb1c6c739800be5c17e7311502a473a271bbcea482eeb5197e9d9d9` | native Windows delivery of both manifests |
| `tests/secret-broker-config.test.mjs` | `8ade640c141190211ba4e1b126737dc484fad8e540aba2c6c02e1b31a5ee56b0` | all hostile lexer bounds plus v1/v2 closed-schema vectors |
| `tests/secret-broker-config-migration.test.mjs` | `61bd54e2bcf83dbb0040b7eb6904ce63e20ae39018449cedaef42168445fedac` | sparse v1, staged creation, portable and same-file alias rejection, reaper-only and two-reclaimer behavior, every swap boundary, custom-path lock identity, competing-writer preservation, rollback, and fence vectors |
| `tests/secret-broker-release.test.mjs` | `9fc739b28b786c5bb04ae5dd6f886b9071059c6d2116aeb11251485fb7fdda9f` | acyclic closure, release-entry binding, closed semantic tampering, strict SemVer, distinct keys, signatures, and caller-ineligibility vectors |
| `tests/citation-grounding.test.mjs` | `17f1b5caaddb7fc10c448770481d0fdcaefbf8b663c628673b289e0f6d17aed8` | full-document citation selector v1/v2 rejection vectors |
| `tests/safety-hooks.test.mjs` | `56d13a0768e8471d074b362cf9c65f11eeaa4de92d847e6e4a5ad4206c4d3b5c` | duplicate-key safety-policy adoption regression |
| `tests/runtime-final-review-freeze.test.mjs` | `288ab4cebeeec24358f2d7b3a0f6ebaa436d5dde81ed5daac2975925355ed60e` | retained `.kstack/evidence/` classification regression |
| `tests/jira-wsl-bridge.test.mjs` | `00ca260987c0b924b039ee0bb7e2f0831ed0cf1d6083f294dd7bbe691b362505` | native handoff shared-parser adoption regression |
| `tests/reflexion-architecture-gate.mjs` | `81611d4671b43ecb851a48e307d9436518169873c77eb20dfc97a0cac3a77140` | exact importer/capability/use-site registration |

## Independent review and R1 repair

R1 receipt SHA-256
`afd1c6014466feab60a57a5dc5387b3fcb891ab45eaf28bd36025187afea83ae`
returned `revise/98` with 4 failed checks, 3 security findings, 1 material
dissent, and 2 unresolved questions. The revised candidate:

- moves citation administration and selection onto full shared document
  validation, closing the last ordinary repository-config readers;
- materializes effective defaults before canonical v2 emission, so every valid
  sparse legacy shape has an exact migration;
- journals before backup creation, binds the fence path, adds a committed
  journal phase, serializes the known Jira writer, performs a final exact-byte
  precondition check, and recovers every forward/fence/rollback crash cut;
- requires actual installed version/manifest digests and an external
  operator-pin digest, rejects repeated Ed25519 SPKI keys, and keeps both
  shipped installers unable to claim signed publication; and
- exercises every rejected parser resource/encoding class and retains local
  execution evidence at SHA-256
  `de41a81c15fc49afaf172407c01ff6b6379976a56a3542bd4cb8ec48bdb3faed`.

## R2 review and repair

R2 receipt SHA-256
`9759f83d6d3f8b22dc166fce6ebc204e438e44054ddb0bd6190c99c5bf100a3e`
returned `revise/99` with 4 failed checks, 2 security findings, 1 material
dissent, and 2 unresolved questions. The repaired candidate:

- classifies `.kstack/evidence/` as validation evidence and withdraws the
  superseded full-suite claim;
- routes safety policy parsing through the bounded duplicate-safe config
  document boundary;
- publishes journals, backups, fences, locks, and swap candidates only after
  complete fsynced staging, derives the shared lock only from `configPath`, and
  replaces check-then-rename with exclusive claim/install recovery that never
  overwrites a competing config path;
- fully validates manifest protocols, schemas, profiles, validator bindings,
  install-health digest syntax, roles, and strict SemVer without source checkout
  access; and
- makes caller-verified signing explicitly ineligible until a future protected
  installer/pin adapter exists.

## Prior R1 verification (superseded by R2)

- The R1 receipt recorded `npm test` as 1,044 tests with 1,042 passes, but R2
  correctly reproduced 1,041 passes, 1 failure, and 2 skips because the newly
  retained WP02 evidence path lacked a freeze role. That claim is withdrawn;
  the R2-repaired exact-candidate result must be retained separately.
- Focused Secret Broker, configuration, migration, compatibility, release,
  citation, install-health, and architecture suite: 77 tests; 75 passed; 0
  failed; 2 environment-gated skips.
- POSIX copy setup and real native Windows PowerShell setup: 14 tests; 14
  passed; 0 failed. Both installed runtimes passed the real health auditor.
- Source-audit and release-manifest regeneration checks passed.
- `git diff --check` passed.

## R3 review and repair

R3 receipt SHA-256
`100df9d7fd96462848160ba982a063f4e838448de3b83993e07d472a2dc1dcff`
returned `revise/99` with 4 failed checks, 2 security findings, 1 material
dissent, and 2 unresolved questions. The repaired candidate:

- routes the native Windows Jira handoff through a fixed value-free projection
  produced by the shared bounded WSL config reader;
- binds the source-audit release entry to the canonical supplied release bytes;
- serializes stale-owner reclamation with an exclusive reaper and fails closed
  on an abandoned reaper rather than risking deletion of a new live lock;
- adds the second-reclaimer, audit-entry substitution, and Windows direct-parse
  regressions; and
- limits fence irreversibility to the supported API with intact files, while
  stating that same-principal tamper resistance requires future protected
  retention.

The post-finalization exact-candidate command is bound by
`.kstack/evidence/secret-broker-2026-08-28-wp02-r3-repair-verification.md`,
SHA-256
`193e78bd53aa4fa1ed35cd8aac93582efe7d48ddc61a45a7cdfe098ea6181976`.
Any mismatch from its declared zero-failure result blocks R4 dispatch.

## R2 repair verification

The R2-repaired candidate passes 1,048 full-suite tests with 1,046 passed, zero
failed, and two environment-gated skips; the focused matrix passes 112 of 114
with the same two skips; and POSIX plus real native Windows installer coverage
passes 14/14. Both generated-manifest checks and diff hygiene pass. The retained
verification receipt is
`.kstack/evidence/secret-broker-2026-08-28-wp02-r2-repair-verification.md`,
SHA-256
`b30c2cef5d2b95cd6f5c06754dad89975111803b2099d909f73e6f0d2cbe19c6`.
The exact full suite is rerun after this record is finalized and before R3.

## R4 review and repair

R4 receipt SHA-256
`c2aaa9d6bf967666dac68e642a8fe620f1fb98bf0b8fa72aa55b0960f637e9b2`
returned `revise/98` with 3 failed checks, 1 security finding, 1 material
dissent, and 1 unresolved question. The repaired candidate:

- rejects all artifact-path collisions under portable Unicode-normalized,
  slash-normalized case folding and rejects already-existing paths that share
  filesystem device/inode identity;
- checks and validates an existing reaper before attempting main-lock
  acquisition, so a crash leaving only the reaper cannot admit a writer;
- adds portable case-alias, hard-link alias, and reaper-only crash regressions;
  and
- replaces the prospective R3 test declaration with retained observed command
  output and an explicit content binding for the baseline, tracked diff,
  untracked candidate files, and all prior review/evidence records. The
  verification record itself is self-excluded because an observed result
  cannot contain its own digest.

The R3 prospective receipt remains historical evidence only and is not used
as the R5 execution claim.

## R5 validation

The R5 independent read-only review reproduced the baseline, tracked binary
diff, 14-file untracked inventory, R1-R4 receipt inventory, implementation
record, and every frozen candidate digest. It returned `approve/97` with zero
failed checks, zero security findings, zero material dissent, and zero
unresolved questions. The review receipt is
`.kstack/reviews/secret-broker-2026-08-28-wp02-r5/codex.md`, SHA-256
`38f60de48e264dddfe51dd83a61322a0a7d636cc9c0b6a55872642bb0e86ab3c`.
The reviewed product candidate is the exact content binding retained in the
R4 observed-verification record; the validation and delivery-status lines in
this section are the reviewer-directed administrative closure delta.

## Residual boundary and handoff

WP02 does not implement protected registry state, authority leases, custody
adapters, target execution, lifecycle mutation, audit/evidence storage,
provider administration, no-echo enrollment, protected-source migration,
pilot, production, deployment, trusted publication classification, or signed
publication issuance. It can verify caller-supplied signatures and bindings,
but deliberately grants them no eligibility. The current installers own no
release authority or protected pin channel.

WP03 may begin after Jira KSTK-133 records this validated completion. WP03 must
preserve the global protected-effect fence until its own accepted exit
explicitly replaces it.

The WP02 fence is operationally irreversible only through the supported API
while its same-principal journal and fence files remain intact. It is not a
custody or anti-tamper primitive; same-principal deletion or mutation is
detected as drift and fails closed. Protected retention is outside WP02.
