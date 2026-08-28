# Encrypted Credential Repository: ECR-TC05 transactional store design

| Field | Bound value |
| --- | --- |
| Status | **REVIEW-REQUIRED / PROVISIONAL COMPOSE / NOT IMPLEMENTED** |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| ECR-TC01 closure | [ECR-TC01 Codex closure](encrypted-credential-repository-2026-08-27-tc01-codex-closure.md) |
| ECR-TC01 closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| ECR-TC02 closure | [ECR-TC02 Codex closure](encrypted-credential-repository-2026-08-27-tc02-codex-closure.md) |
| ECR-TC02 closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| ECR-TC03 candidate | [ECR-TC03 cryptographic and canonical-format design](encrypted-credential-repository-2026-08-27-tc03-cryptographic-format-design.md) |
| ECR-TC03 candidate SHA-256 | `16d7cd06aff3ecf111076252c1cbe80c80bf08f46f514ab62bb5db7268c49ca5` |
| ECR-TC03 closure | [ECR-TC03 Codex closure](encrypted-credential-repository-2026-08-27-tc03-codex-closure.md) |
| ECR-TC03 closure SHA-256 | `6d562b5473ef5965272a4400b95b1f29977b11fb06b0ab6b9893adf630b70438` |
| FIPS owner decision | [TC03 FIPS owner decision](encrypted-credential-repository-2026-08-27-tc03-fips-owner-decision.md) |
| FIPS owner decision SHA-256 | `6b4cf4fe2cff2ad016055a31333652cc35fd23672f0cdb1f9abebae75c1a38f8` |
| Closed ECR-TC04 candidate | [ECR-TC04 platform custody and recovery-carrier design](encrypted-credential-repository-2026-08-27-tc04-platform-custody-recovery-design.md) |
| Closed ECR-TC04 candidate SHA-256 | `2fed5c13961e132962dc469f2f91260cbddaf43bcdcc9d23f04c73c8b9abd54e` |
| ECR-TC04 closure | [ECR-TC04 Codex closure](encrypted-credential-repository-2026-08-27-tc04-codex-closure.md) |
| ECR-TC04 closure SHA-256 | `0759ded9c92165b8d3455b659f0bef5fbf839af9d906223e41b574b1b83081c1` |

## 1. Scope, authority, and closed direction

TC05 closes only the local transactional-store boundary: endpoint identity and
private-root admission; immutable generations; manifests; transaction intent,
effect, receipt, history, and proof mapping; compare-and-swap; concurrency and
writer fencing; allocation/burn persistence; crash recovery; rollback/fork
evidence; generation quarantine; protected metadata; backup substrate; and
separate-location restoration mechanics.

The direction is **PROVISIONAL COMPOSE**. KStack composes qualified platform
filesystem, locking, rollback-anchor, custody, and cryptographic services behind
the closed records below. This design does not select a database, filesystem,
anchor provider, operating-system API, binary, package, or deployment profile.
No backend is qualified merely because it offers transactions or `fsync`.

TC05 persists later-authorized effects; it does not authorize them. TC06 owns
entry, approval, lease, rotation, revocation, restriction, and erasure
authority. TC07 owns broker, IPC, adapter, action, and output containment. TC08
owns safe audit content, incidents, and reconciliation. TC09 owns backup,
recovery, migration, reconstruction, and activation authority and ceremonies.
TC10 owns dependencies, exact platform semantics, anchors, adverse testing,
deployment, and production qualification.

Normative interpretation is closed: every CDDL production and every tagged-
presence, field-equality, canonical-order, branch, cardinality, uniqueness, and
cross-record relation stated in prose is jointly binding. Generated validators
must enforce the intersection, never CDDL alone or prose alone. An inconsistent,
unconstructible, unresolved, or multiply interpreted row is `UNAVAILABLE`; it is
not normalized, defaulted, projected, or accepted by choosing the weaker rule.

## 2. Reuse-first inventory and disposition

| Local evidence | Reusable role | Disposition and gap |
| --- | --- | --- |
| `plugins/kstack/scripts/kstack-checkpoint.mjs` | Durability trace and bounded writer FIFO | **ADAPT trace only.** Append/fsync/head/parent/ack ordering is useful; it is not an ECR durable CAS or rollback anchor. |
| `plugins/kstack/scripts/reflexion/corpus-io.mjs:163-272,319-413` | Exclusive creation, descriptor/owner/mode verification, no-follow, fsync, replacement, expectation digest, quarantine, injectable I/O | **ADAPT pattern only.** One JSON corpus, cooperative wall-time lock, no generation chain/anchor; Windows durability is unqualified. |
| `plugins/kstack/scripts/kstack-safety-admin.mjs:28-64,136-149` | Trusted-root checks, private modes, exclusive temporary file, file/directory fsync, recoverable move | **ADAPT pattern only.** Repository-local and POSIX-oriented. |
| `plugins/kstack/scripts/kstack-jira.mjs:114-132,370-483` | Durable rename, random lock identity, no-replace election, inode/token fence | **ADAPT fencing seam only.** Heartbeat/stale break, PID, hostname, wall time, and post-write fence are not atomic ECR truth. |
| `plugins/kstack/scripts/reflexion/unavailable-sentinel.mjs` | No-follow exclusive creation, parent descriptor validation/fsync, fault seams | **ADAPT fault seam only.** Sentinel-specific. |
| `plugins/kstack/scripts/kstack-memory.mjs:167-189,269-281` and `@electric-sql/pglite` `0.5.4`, Apache-2.0, lockfile integrity-pinned | Existing local filesystem database and SQL transaction use | **CONTENDER, NOT SELECTED.** Bundled documentation says single user/connection; no qualification for multi-process fencing, crash durability, rollback, backup, hostile-store, or FIPS-bound use. |
| Node.js `>=20` built-ins | Descriptor I/O and digest seams | **COMPOSE candidate only.** Exact platform behavior/binaries remain TC10 work. |

No SQLite, LMDB, LevelDB, RocksDB, lockfile, or atomic-write dependency is
vendored for this role. **ADOPT** is unavailable on present evidence; **ADAPT**
supplies patterns but not a store; **BUILD** of cryptography, database, or anchor
primitives is rejected. **COMPOSE** is provisional: build only KStack-specific
record/transaction integration after backend and anchor qualification.

## 3. Non-waivable invariants

1. The store is outside every repository in an exact protected per-user
   application-data location. Git, Jira, repository files, shared temporary
   files, arguments, environment, standard streams, prompts, and model output
   are never store or backup paths.
2. One random 128-bit store ID identifies one endpoint object, not a pathname.
   Owner/ACL, direct-object identity, volume, filesystem, mount/namespace,
   reparse/link state, and case-collision policy all match.
3. Every admitted object is canonical, bounded, authenticated, versioned,
   content-addressed, immutable, and assigned to one immutable store generation.
4. Unknown schema/version/algorithm/field/enum/kind, duplicate ID/mapping,
   missing dependency, partial object, overflow, rollback, fork, or future record
   blocks. No permissive reader exists.
5. One external qualified rollback anchor selects one exact admission root.
   Filenames, slot order, timestamps, insertion order, PID, hostname, and row
   order never select truth.
6. Every mutation has one qualified intent, complete read/write sets, exact
   expected root/generation/history/anchor, writer fence, and effect digest.
7. A reader holds one immutable generation handle; later authority layers still
   fence stale use.
8. Allocation/attempt reservation is durable before any UI, OS, provider,
   crypto, carrier, adapter, or external-effect boundary; every terminal or
   ambiguous path burns permanently.
9. Rollback/fork, anchor ambiguity, incomplete commit, quarantine, or unproved
   currentness blocks. There is no old-generation fallback.
10. Only an exact manifest-admitted live-store object can quarantine. Caller,
    unknown-ID, wrong-scope, malformed, bounds, pre-admission, and offline
    recovery mismatch paths cannot mutate live quarantine.
11. Sensitive metadata is encrypted. The pre-root surface exposes only bounded
    random routing IDs, sizes, required custody class, mutation timing, and
    anchor commitments.
12. Receipt, history, proof, mapping, manifest, pointer, or anchor token alone
    grants nothing. Only the complete acyclic graph selected by the qualified
    anchor establishes commitment.

## 4. Endpoint identity and private root

The endpoint is opened from a platform-owned application-data parent with a
qualified handle-relative API. Every component is opened without following
links. The final descriptor is compared with the observed direct object before
and after namespace change. Symlink, junction, reparse, mount/bind/namespace
alias, non-directory, case/Unicode collision, unexpected hard link, owner/ACL/
mode drift, filesystem/volume replacement, and unsupported remote/removable
storage deny.

```cddl
endpoint-platform-v1 = "WINDOWS" / "MACOS" / "LINUX"
alias-policy-v1 = "NO_LINK_REPARSE_MOUNT_ALIAS"
case-policy-v1 = "EXACT_NFC_NO_COLLISION"
endpoint-state-v1 = "ACTIVE" / "SUSPENDED"
endpoint-instance-id-v1 = ["ECR.StoreEndpointInstance/1", bstr .size 16]
endpoint-volume-id-v1 = ["ECR.EndpointVolume/1", bstr .size (16..128)]
endpoint-directory-id-v1 = ["ECR.EndpointDirectory/1", bstr .size (16..128)]
endpoint-namespace-id-v1 = ["ECR.EndpointNamespace/1", bstr .size (16..256)]
endpoint-access-evidence-ref-v1 =
  [1, 2, "ECR-D1/OBJECT", "ECR.StoreEndpointAccessEvidence/1", sha256-v1]
endpoint-inspector-profile-ref-v1 =
  [1, 2, "ECR-D1/OBJECT", "ECR.EndpointInspectorProfile/1", sha256-v1]
qualified-endpoint-inspection-evidence-ref-v1 =
  [1, 2, "ECR-D1/EFFECT-EVIDENCE",
    "ECR.QualifiedEndpointInspectionEvidence/1", sha256-v1]
endpoint-inspector-build-provenance-ref-v1 =
  [1, 2, "ECR-D1/OBJECT",
    "ECR.EndpointInspectorBuildProvenance/1", sha256-v1]
endpoint-inspection-subject-ref-v1 =
  [1, 2, "ECR-D1/OBJECT", "ECR.EndpointInspectionSubject/1", sha256-v1]
endpoint-inspection-authentication-evidence-ref-v1 =
  [1, 2, "ECR-D1/EFFECT-EVIDENCE",
    "ECR.EndpointInspectionAuthenticationEvidence/1", sha256-v1]
endpoint-session-output-evidence-ref-v1 =
  [1, 2, "ECR-D1/EFFECT-EVIDENCE",
    "ECR.EndpointSessionOutputEvidence/1", sha256-v1]
endpoint-access-subject-v1 =
  [kind: "PRINCIPAL", principal-ref-v1] /
  [kind: "PLATFORM_SUBJECT", subject_id: bstr .size (16..128)]
endpoint-access-right-v1 = "READ" / "WRITE" / "LIST" / "CREATE" /
  "DELETE_CHILD" / "READ_METADATA" / "WRITE_METADATA" / "CHANGE_ACCESS"
endpoint-acl-entry-v1 = [
  subject: endpoint-access-subject-v1,
  disposition: "ALLOW" / "DENY",
  inheritance: "DIRECT" / "INHERITED",
  rights: [1*8 endpoint-access-right-v1]
]
endpoint-permissions-v1 =
  [kind: "POSIX_MODE", mode: uint .le 4095,
    owner_subject: endpoint-access-subject-v1,
    group_subject: endpoint-access-subject-v1,
    acl: [0*64 endpoint-acl-entry-v1]] /
  [kind: "PLATFORM_ACL", owner_subject: endpoint-access-subject-v1,
    group_subject: endpoint-access-subject-v1,
    acl: [1*64 endpoint-acl-entry-v1]]
endpoint-inspection-phase-v1 = "PRE_OPEN" / "POST_OPEN" /
  "PRE_NAMESPACE_REVALIDATION" / "POST_NAMESPACE_REVALIDATION"
endpoint-storage-class-v1 = "LOCAL_FIXED" / "LOCAL_REMOVABLE" /
  "REMOTE" / "UNKNOWN"
endpoint-inspection-retrieval-v1 = "COMPLETE" / "UNAVAILABLE" /
  "UNSUPPORTED"
endpoint-raw-acl-format-v1 = "WINDOWS_SELF_RELATIVE_SD" /
  "POSIX_STAT_ACL_XATTR" / "MACOS_STAT_ACL"
endpoint-inspector-api-profile-v1 = "WINDOWS_HANDLE_SECURITY_API_V1" /
  "LINUX_OPENAT2_STATX_ACL_XATTR_API_V1" /
  "MACOS_OPENAT_FSTAT_ACL_API_V1"
endpoint-acl-normalization-profile-v1 = "WINDOWS_ACL_NORMALIZER_V1" /
  "LINUX_MODE_ACL_XATTR_NORMALIZER_V1" /
  "MACOS_MODE_ACL_NORMALIZER_V1"
endpoint-raw-subject-v1 = bstr .size (16..128)
endpoint-raw-observation-v1 = [
  phase: endpoint-inspection-phase-v1,
  endpoint_volume_id-v1, endpoint_directory_id-v1, endpoint_namespace_id-v1,
  direct_object_token: bstr .size (16..128),
  object_type: "DIRECTORY" / "OTHER_OR_UNKNOWN", link_count: uint63,
  storage_class: endpoint-storage-class-v1,
  raw_storage_evidence: bstr .size (1..4096),
  raw_acl_format: endpoint-raw-acl-format-v1,
  raw_acl_bytes: bstr .size (1..65536),
  raw_owner_subject: endpoint-raw-subject-v1,
  raw_group_subject: endpoint-raw-subject-v1,
  alias_link_facts: bstr .size (1..4096),
  retrieval: endpoint-inspection-retrieval-v1
]
endpoint-object-observation-v1 = [
  phase: endpoint-inspection-phase-v1,
  endpoint_volume_id-v1, endpoint_directory_id-v1, endpoint_namespace_id-v1,
  direct_object_token: bstr .size (16..128),
  link_count: uint63, object_type: "DIRECTORY",
  storage_class: "LOCAL_FIXED",
  permissions: endpoint-permissions-v1,
  alias_state: "DIRECT_NO_ALIAS"
]
endpoint-inspector-profile-v1 = [
  "ECR.EndpointInspectorProfile/1", profile_id: id128-v1,
  issuer_store_service: principal-ref-v1,
  provider: provider-ref-v1,
  platform: endpoint-platform-v1,
  api_profile: endpoint-inspector-api-profile-v1,
  acl_normalization_profile: endpoint-acl-normalization-profile-v1,
  build_provenance: endpoint-inspector-build-provenance-ref-v1,
  supported_storage_class: "LOCAL_FIXED",
  qualification_epoch: uint63,
  status: "ACTIVE" / "SUSPENDED" / "REVOKED"
]
endpoint-owner-subject-mapping-v1 = [
  "ECR.EndpointOwnerSubjectMapping/1",
  store_ref-v1,
  endpoint_instance: endpoint-instance-id-v1,
  inspector_profile: endpoint-inspector-profile-ref-v1,
  issuer_store_service: principal-ref-v1,
  provider: provider-ref-v1,
  provider_session_id: id128-v1,
  platform: endpoint-platform-v1,
  owner_principal: principal-ref-v1,
  raw_platform_subject: endpoint-raw-subject-v1,
  authenticated_os_session: id128-v1,
  result: "EXACT_CURRENT_SUBJECT"
]
endpoint-inspection-subject-v1 = [
  "ECR.EndpointInspectionSubject/1", subject_id: id128-v1,
  store_ref-v1,
  inspector_profile: endpoint-inspector-profile-ref-v1,
  issuer_store_service: principal-ref-v1,
  provider: provider-ref-v1,
  provider_session_id: id128-v1,
  inspection_attempt_id: id128-v1,
  platform: endpoint-platform-v1,
  endpoint_instance: endpoint-instance-id-v1,
  owner_subject_mapping: endpoint-owner-subject-mapping-v1,
  trusted_time: trusted-time-input-ref-v1,
  utc_skew_evidence: utc-skew-evidence-ref-v1,
  raw_observations: [4*4 endpoint-raw-observation-v1]
]
endpoint-session-output-evidence-v1 = [
  "ECR.EndpointSessionOutputEvidence/1", output_id: id128-v1,
  authenticated_subject: endpoint-inspection-subject-ref-v1,
  inspector_profile: endpoint-inspector-profile-ref-v1,
  issuer_store_service: principal-ref-v1,
  provider: provider-ref-v1,
  provider_session_id: id128-v1,
  qualified_provider_session: qualified-provider-session-evidence-ref-v1,
  inspection_attempt_id: id128-v1,
  platform: endpoint-platform-v1,
  build_provenance: endpoint-inspector-build-provenance-ref-v1,
  trusted_time: trusted-time-input-ref-v1,
  utc_skew_evidence: utc-skew-evidence-ref-v1,
  result: "QUALIFIED_SESSION_AUTHENTICATED_EXACT_SUBJECT"
]
endpoint-inspection-authentication-evidence-v1 = [
  "ECR.EndpointInspectionAuthenticationEvidence/1", evidence_id: id128-v1,
  authenticated_subject: endpoint-inspection-subject-ref-v1,
  issuer_store_service: principal-ref-v1,
  provider: provider-ref-v1,
  provider_session_id: id128-v1,
  session_output_evidence: endpoint-session-output-evidence-ref-v1,
  build_provenance: endpoint-inspector-build-provenance-ref-v1,
  result: "AUTHENTICATED_EXACT_SUBJECT"
]
qualified-endpoint-inspection-evidence-v1 = [
  "ECR.QualifiedEndpointInspectionEvidence/1", evidence_id: id128-v1,
  inspection_subject: endpoint-inspection-subject-ref-v1,
  authentication_evidence: endpoint-inspection-authentication-evidence-ref-v1,
  result: "QUALIFIED_COMPLETE" / "UNAVAILABLE" / "UNSUPPORTED"
]
store-endpoint-access-evidence-v1 = [
  "ECR.StoreEndpointAccessEvidence/1", evidence_id: id128-v1,
  store_ref-v1, endpoint-instance-id-v1, endpoint-platform-v1,
  authenticated_owner: principal-ref-v1,
  qualified_inspection: qualified-endpoint-inspection-evidence-ref-v1,
  normalized_observations: [4*4 endpoint-object-observation-v1],
  result: "EXACT_PRIVATE_ROOT"
]
store-endpoint-identity-v1 = [
  "ECR.StoreEndpointIdentity/1", endpoint-instance-id-v1, store-ref-v1,
  endpoint-platform-v1, endpoint-volume-id-v1, endpoint-directory-id-v1,
  endpoint-namespace-id-v1, principal-ref-v1,
  endpoint-access-evidence-ref-v1, alias-policy-v1, case-policy-v1,
  epoch-vector-object-ref-v1, endpoint-state-v1
]
```

The field-specific identities are not mutually substitutable. The access record
is the closed TC05 schema containing exact owner, group, ACL entries, mode,
inheritance, link count, direct-object and pre/post-open observations; its digest
domain/schema tuple above is mandatory. Pathnames are diagnostics, never
authority. `SUSPENDED`, unavailable, unsupported, or changed evidence denies.

The four endpoint observations occur in the literal phase order shown and must
be pairwise equal in volume, directory, namespace, direct-object token, link
count, object type, permissions, and alias state. ACL entries and rights are
unique and deterministically ordered; `DENY` is not canceled by `ALLOW`. The
authenticated owner equals the identity's owner principal. The evidence ref is
exactly the typed SHA-256 reference to the canonical evidence body; any path-
only, caller-issued, digest-only-without-body, partial, or changed observation
denies endpoint admission.

The profile issuer resolves to one active `STORE_SERVICE` principal and is
distinct from the active `OWNER_HUMAN`. Platform fixes the sole API, raw ACL,
and normalizer family: Windows uses `WINDOWS_*`, Linux uses `LINUX_*` plus
`POSIX_STAT_ACL_XATTR`, and macOS uses `MACOS_*`. Its supported class is exactly
`LOCAL_FIXED`; status must be `ACTIVE` and its epoch current.

Qualified evidence is returned on the exact authenticated qualified provider
session; serializing, hashing, or possessing the body locally is insufficient.
Every field is equal only across bodies that contain it:

| Field | Exact byte-equality set |
| --- | --- |
| Store | subject, owner mapping, access evidence, endpoint identity |
| Endpoint instance | subject, owner mapping, access evidence, endpoint identity |
| Inspector profile | subject, owner mapping, session output |
| Issuer `STORE_SERVICE` | profile, subject, owner mapping, session output, authentication evidence |
| Provider | profile, subject, owner mapping, session output, authentication evidence, resolved `QualifiedProviderSessionEvidenceV1` |
| Provider session | subject, both mapping session fields, session output, authentication evidence, resolved `QualifiedProviderSessionEvidenceV1` |
| Platform | profile, subject, owner mapping, session output, access evidence, endpoint identity, raw/API/normalizer family |
| Build provenance | profile, session output, authentication evidence |
| Attempt | subject, session output |
| Trusted time and skew | subject, session output |
| Subject ref | session output, authentication evidence, qualified evidence |
| Owner `OWNER_HUMAN` | owner mapping, access evidence, endpoint identity |

All listed bodies resolve; absent fields are never invented for equality. The
profile epoch/status, provider session, time/skew/boot state, owner mapping, and
both principals must be current. The raw owner equals the mapping's platform
subject. The issuer and owner are distinct. The resolved general qualified-
session body must contain actual provider and provider-session fields, and those
fields byte-equal the subject, mapping, session-output, and authentication-
evidence values. If that later-qualified body lacks either field, is unresolved,
or names another otherwise-valid provider or session, inspection is unavailable
and denies; issuer/profile/build equality is required only if the resolved body
actually defines the corresponding field.

Construction is the strict backward-only DAG `inputs/profile/build/time ->
inspection subject -> qualified endpoint session output -> authentication
evidence -> qualified inspection evidence -> access evidence`. The subject
commits the complete store/provider/profile/session/attempt/endpoint/owner/time/
skew/raw-observation tuple. The qualified session output authenticates its exact
typed subject ref and commits the same profile/issuer/provider/session/attempt/
platform/build/time/skew fields plus the independently qualified general session
ref. Authentication evidence commits that exact subject and session-output ref;
qualified evidence commits that exact subject and authentication ref. No self,
reverse, transitive-back, projection, or final-to-ancestor edge is permitted.
TC10 must prove the field-specific output was returned by the authenticated
provider session; a caller-created graph fails even when every local hash is
internally consistent.

The raw and normalized arrays each contain exactly the four literal phases in
the displayed order. Phase, volume, directory, namespace, direct token, object
type, link count, storage classification, alias/link facts, owner, group, mode,
every ACE, disposition, inheritance flag, and right have one deterministic
qualified raw-to-normalized mapping. Raw owner equals the mapping subject;
normalized owner equals its owner principal. Re-encoding a normalized ACL is
not raw evidence. Unknown or conditional ACEs, unresolved SID/UID/GID, omitted,
truncated, duplicated, or reordered ACL/mode/xattr/capability/inheritance/right
facts, parse ambiguity, unrecognized mount flags, or any raw/normalized mismatch
deny. Except for the literal phase, all corresponding raw identity, content,
classification, retrieval, and alias/link facts are pairwise equal across the
four observations; one-phase drift denies.

Admission requires all four raw observations `COMPLETE` and `LOCAL_FIXED`, all
four normalized observations `LOCAL_FIXED`, qualified result
`QUALIFIED_COMPLETE`, and access result `EXACT_PRIVATE_ROOT`. Any
`LOCAL_REMOVABLE`, `REMOTE`, `UNKNOWN`, `UNAVAILABLE`, or `UNSUPPORTED` value,
or inability to classify, denies without relabeling, fallback, override, path
heuristic, caller assertion, or partial admission.

This inspection chain is a TC10 hard gate. TC10 must qualify the exact inspector
profile/build/API semantics, authenticated session and issuer, Windows/macOS/
Linux raw capture and TOCTOU order, owner-subject source, storage classifier,
ACL parser/normalizer, trusted-time/boot binding, and vectors. Until then the
only result is `UNAVAILABLE_PENDING_TC10_ENDPOINT_INSPECTION`; a typed reference,
canonical body, local hash, raw bytes, successful OS call, or principal reference
alone grants nothing. The build-provenance and provider-session evidence bodies
must have closed generated `Max05/Record05` before qualification.

For each endpoint admission or revalidation phase, the exact charge is:

```text
EndpointInspectMemberBodies05 = Record05(EndpointInspectorProfileV1) +
  Record05(EndpointInspectorBuildProvenanceV1) +
  Record05(QualifiedProviderSessionEvidenceV1) +
  Record05(PrincipalV1[issuer STORE_SERVICE]) +
  Record05(PrincipalV1[owner OWNER_HUMAN]) +
  Record05(TrustedTimeInputV1) + Record05(UtcSkewEvidenceV1) +
  Record05(EndpointInspectionSubjectV1[4 raw observations]) +
  Record05(EndpointSessionOutputEvidenceV1) +
  Record05(EndpointInspectionAuthenticationEvidenceV1) +
  Record05(QualifiedEndpointInspectionEvidenceV1) +
  Record05(StoreEndpointAccessEvidenceV1[4 normalized observations])
EndpointInspectWorkspace05(subject,access) =
  sum(i=1..4){
    length(canonical(subject.raw_observations[i])) +
    length(canonical(subject.raw_observations[i])) +
    Meta(subject.raw_observations[i]) +
    length(canonical(access.normalized_observations[i])) +
    Meta(access.normalized_observations[i])
  }
EndpointInspect05 = EndpointInspectMemberBodies05 +
  EndpointInspectWorkspace05(subject,access)
```

The nested owner mapping is charged once inside the subject. Its four raw
observations include four independently achievable 65,536-byte ACL blobs and
4,096-byte storage and alias/link blobs; access evidence independently includes
four normalized 64-entry ACL observations. No raw/normalized, provider-session,
time/skew, or currentness alias deduction is permitted. Every term's
`Max05/Record05` is generated from a complete relationally valid row. The
workspace is exactly one extra provider-output copy of each raw observation plus
one parser/canonical-comparison copy of each raw and normalized observation; it
contains no canonical body/reference charge. Standalone pre-read-set endpoint
admission charges full `EndpointInspect05`. Once a selected read set exists,
`ReadSetResolve05` is the sole charge for all endpoint member bodies and the live
phase adds only `EndpointInspectWorkspace05`. Same-phase canonical-body dedup is
permitted only where the governing rule already permits it, never between
observations or for live provider/currentness workspace. The charge is reserved
before endpoint provider call, root open, or CAS. Exact maxima are achievable;
a one-byte/item/cardinality excess denies first.

The root has exactly five ASCII literal namespaces: `admission` (two fixed slots),
`objects`, `transactions` (at most 64), `allocations` (at most 4096), and
`restore-candidates` (at most 16). Object placement is the exact three-level
lowercase-hex radix of routing-ID bytes 0, 1, and 2 (two characters and at most
256 children per level), followed by lowercase unpadded base32 of the full
16-byte ID (exactly 26 ASCII characters). Other child names use only that 26-byte
grammar. No other nesting, alias, or case-equivalent spelling is admitted. All
work remains handle-relative to the validated root descriptor.

## 5. Pre-root control plane and confidentiality boundary

TC04 requires exact slot/profile, historical authority/evidence/proof/receipt/
history, current environment/readback, bounds, and omission resolution before a
custody/provider root open. Those prerequisites cannot be authenticated only by
the root they authorize opening. TC05 therefore defines a pre-root admission
control plane and a separate root-encrypted protected-metadata plane.

The pre-root plane is **not qualified by this design**. It is a hard unavailable
predicate until TC10 qualifies one rollback-evident mechanism that authenticates
the complete selected admission root and either:

1. every complete bounded pre-root resolver body required by TC04; or
2. one closed inclusion-proof schema rooted in that admission root, including
   exact leaf bytes, index/order, sibling path, tree arity/depth, root digest,
   store/generation, object kind, and nonmembership/duplicate behavior.

TC05 invents no signature, MAC, hash-tree, key, or suite outside TC03. A caller-
supplied projection, proof, path, subset, or small mapping never authenticates
itself. If the qualified anchor cannot authenticate the full bounded resolver or
the later-closed inclusion proof before provider work, all custody remains
`UNAVAILABLE_PENDING_TC10_QUALIFICATION`.

No TC05 local file, local clock, Git state, process, caller, or root-encrypted
record can satisfy that predicate. The qualified mechanism must provide an
authenticated store ID, generation, admission-root digest, predecessor token,
and exact observation result (`TRUSTED`, `UNAVAILABLE`, or `MISMATCH`). Both
non-trusted results deny; `SUSPENDED` endpoint state also denies independently.

The pre-root plane may expose only random store/routing IDs, store/root
generation, exact byte digests/lengths, object kind/suite/profile class required
for custody, quarantine state, and anchor commitments. Human labels, repository
or environment names, policy, proof relationships, readback text, and scope AAD
remain confidential. TC10 must qualify the residual type/size/timing leakage.

After root open, all sensitive records resolve from TC03/TC05 protected metadata
and byte-equal the pre-root commitments. A mismatch is corruption, never a
fallback to either plane.

## 6. Closed records and typed references

TC05 imports the exact closed TC02/TC03/TC04 types, domain-separated references,
`Record(T)` equations, maxima, and reason mappings from the governing hashes.
Each alias below closes its TC03 digest domain and schema ID directly;
cross-kind substitution is invalid.

```cddl
store-intent-ref-v1 = [1,2,"ECR-D1/OBJECT","ECR.StoreIntent/1",sha256-v1]
store-effect-ref-v1 = [1,2,"ECR-D1/EFFECT-EVIDENCE","ECR.StoreEffect/1",sha256-v1]
store-receipt-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreTransactionReceipt/1",sha256-v1]
store-history-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreHistoryEvidence/1",sha256-v1]
store-generation-manifest-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreGenerationManifest/1",sha256-v1]
store-admission-root-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreAdmissionRoot/1",sha256-v1]
store-allocation-ref-v1 = [1,2,"ECR-D1/ATTEMPT","ECR.AllocationLedger/1",sha256-v1]
store-quarantine-ref-v1 = [1,2,"ECR-D1/AUDIT-RECORD","ECR.Quarantine/1",sha256-v1]
store-backup-manifest-ref-v1 =
  [1,2,"ECR-D1/BACKUP-MANIFEST","ECR.StoreBackupManifest/1",sha256-v1]
protected-metadata-envelope-ref-v1 =
  [1,2,"ECR-D1/ENVELOPE","ECR.TC05MetadataEnvelope/1",sha256-v1]
store-endpoint-identity-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreEndpointIdentity/1",sha256-v1]
store-schema-registry-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreSchemaRegistry/1",sha256-v1]
complete-read-set-ref-v1 = [1,2,"ECR-D1/OBJECT","ECR.StoreReadSet/1",sha256-v1]
read-set-anchor-observation-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.ReadSetAnchorObservation/1",sha256-v1]
read-set-membership-proof-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.ReadSetMembershipProof/1",sha256-v1]
store-object-index-page-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreObjectIndexPage/1",sha256-v1]
tc04-phase-ref-v1 = [1,2,"ECR-D1/OBJECT","ECR.TC04Phase/1",sha256-v1]
tc04-ceremony-authority-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.CustodyCeremonyAuthority/1",sha256-v1]
tc04-ceremony-proof-ref-v1 =
  [1,2,"ECR-D1/OBJECT",
    "ECR.CustodyCeremonyConsumptionProof/1",sha256-v1]
store-allocation-audit-evidence-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE",
    "ECR.StoreAllocationAuditEvidence/1",sha256-v1]
store-crash-audit-evidence-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE",
    "ECR.StoreCrashCompletionAuditEvidence/1",sha256-v1]
store-quarantine-observation-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE",
    "ECR.StoreAdmittedQuarantineObservation/1",sha256-v1]
store-backup-observation-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE",
    "ECR.StoreBackupSnapshotObservation/1",sha256-v1]
stored-object-failure-subject-ref-v1 =
  [1,2,"ECR-D1/OBJECT",
    "ECR.StoredObjectFailureSubject/1",sha256-v1]
qualified-stored-object-failure-evidence-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE",
    "ECR.QualifiedStoredObjectFailureEvidence/1",sha256-v1]
authenticated-manifest-contradiction-evidence-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE",
    "ECR.AuthenticatedManifestContradictionEvidence/1",sha256-v1]
authenticated-descriptor-contradiction-evidence-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE",
    "ECR.AuthenticatedDescriptorContradictionEvidence/1",sha256-v1]
store-internal-evidence-ref-v1 = store-allocation-audit-evidence-ref-v1 /
  store-crash-audit-evidence-ref-v1 /
  store-quarantine-observation-ref-v1 /
  store-backup-observation-ref-v1
store-crash-recovery-state-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.StoreCrashRecoveryState/1",sha256-v1]
writer-fence-evidence-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.WriterFenceEvidence/1",sha256-v1]
rollback-anchor-identity-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.RollbackAnchorIdentity/1",sha256-v1]
metadata-kdf-context-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.MetadataKwpContext/1",sha256-v1]
backup-kdf-context-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.BackupKwpContext/1",sha256-v1]
fips-entropy-evidence-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.FipsEntropyEvidence/1",sha256-v1]
qualified-provider-session-evidence-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.QualifiedProviderSessionEvidence/1",sha256-v1]
qualified-provider-generation-evidence-ref-v1 =
  [1,2,"ECR-D1/OBJECT","ECR.QualifiedProviderGenerationEvidence/1",sha256-v1]
tc06-authority-ref-v1 =
  [1,2,"ECR-D1/AUTHORITY-DECISION","ECR.TC06Authority/1",sha256-v1]
tc09-authority-ref-v1 =
  [1,2,"ECR-D1/AUTHORITY-DECISION","ECR.TC09Authority/1",sha256-v1]

store-object-kind-v1 = "PAYLOAD" / "TC04_RECORD" / "ALLOCATION" /
  "ENDPOINT" / "SCHEMA_REGISTRY" / "HISTORY" / "RECEIPT" /
  "PROOF_MAPPING" / "QUARANTINE" / "BACKUP" / "TOMBSTONE" / "AUDIT"
store-effect-kind-v1 = "ALLOCATION_RESERVE" / "ALLOCATION_TERMINAL" /
  "ORDINARY_MUTATION" / "TC04_BOOTSTRAP" / "TC04_CURRENTNESS" /
  "TC04_CEREMONY" / "ADMITTED_QUARANTINE" / "CRASH_COMPLETION" /
  "BACKUP_SNAPSHOT" / "RESTORE_CANDIDATE" / "TC06_MUTATION" / "TC09_MUTATION"

store-transaction-source-v1 =
  [kind: "ORDINARY_TC02", authority_request_ref-v1, authority-decision-ref-v1] /
  [kind: "TC04_CEREMONY", tc04-phase-ref-v1,
    tc04-ceremony-authority-ref-v1, tc04-ceremony-proof-ref-v1] /
  [kind: "INTERNAL_DETERMINISTIC", reason: "ADMITTED_QUARANTINE",
    evidence_ref: store-quarantine-observation-ref-v1] /
  [kind: "INTERNAL_DETERMINISTIC", reason: "BACKUP_SNAPSHOT",
    evidence_ref: store-backup-observation-ref-v1,
    authority_ref: tc09-authority-ref-v1] /
  [kind: "TC06_LATER", tc06-authority-ref-v1] /
  [kind: "TC09_LATER", tc09-authority-ref-v1]

writer-fence-evidence-v1 = [
  "ECR.WriterFenceEvidence/1", fence_id: id128-v1,
  store_ref-v1, store-endpoint-identity-ref-v1,
  endpoint-access-evidence-ref-v1,
  parent_generation: uint63,
  predecessor_admission_root: store-admission-root-ref-v1,
  writer_fence_generation: uint63,
  anchor_identity: rollback-anchor-identity-ref-v1,
  acquisition_token: bstr .size (16..128),
  status: "ACQUIRED_EXACT_PREDECESSOR"
]

tc04-phase-kind-v1 = "ORDINARY_SLOT_OPEN" / "CREATE_SOURCE" /
  "CREATE_DESTINATION" / "CONFIRM_SOURCE" / "CONFIRM_STAGED" /
  "CONFIRM_CURRENT" / "INITIALIZE_ROOT" / "RECOVERY_VERIFY" / "QUARANTINE"
tc04-current-control-v1 = [
  current_environment: environment-ref-v1,
  full_owner_readback: owner-readback-ref-v1,
  live_authority: tc04-ceremony-authority-ref-v1,
  authentication_evidence: custody-ceremony-authn-evidence-ref-v1,
  trusted_time: trusted-time-input-ref-v1,
  utc_skew_evidence: utc-skew-evidence-ref-v1,
  complete_epochs: epoch-vector-object-ref-v1,
  qualified_tuple: qualified-tuple-ref-v1
]
maybe-development-omission-ref-v1 = [0] /
  [1, development-recovery-omission-ref-v1]
tc04-phase-detail-v1 =
  [kind: "ORDINARY_SLOT_OPEN", root-slot-profile-ref-v1, slot_id: id128-v1,
    attempt_id: id128-v1, maybe-development-omission-ref-v1] /
  [kind: "CREATE_SOURCE" / "CREATE_DESTINATION",
    ceremony_kind: custody-ceremony-kind-v1, root-slot-profile-ref-v1,
    slot_id: id128-v1, attempt_id: id128-v1,
    tc04-ceremony-authority-ref-v1,
    custody-ceremony-authn-evidence-ref-v1,
    tc04-ceremony-proof-ref-v1, tc04-current-control-v1,
    maybe-development-omission-ref-v1] /
  [kind: "CONFIRM_SOURCE" / "CONFIRM_STAGED" / "CONFIRM_CURRENT",
    ceremony_kind: custody-ceremony-kind-v1, root-slot-profile-ref-v1,
    slot_id: id128-v1, attempt_id: id128-v1,
    tc04-ceremony-authority-ref-v1,
    custody-ceremony-authn-evidence-ref-v1,
    tc04-ceremony-proof-ref-v1, tc04-current-control-v1,
    maybe-development-omission-ref-v1] /
  [kind: "INITIALIZE_ROOT", ceremony_kind: "INITIALIZE_ROOT",
    root-slot-profile-ref-v1, slot_id: id128-v1, attempt_id: id128-v1,
    tc04-ceremony-authority-ref-v1,
    custody-ceremony-authn-evidence-ref-v1,
    tc04-ceremony-proof-ref-v1] /
  [kind: "RECOVERY_VERIFY", root-slot-profile-ref-v1,
    slot_id: id128-v1, attempt_id: id128-v1,
    carrier-currentness-ref-v1] /
  [kind: "QUARANTINE", store-admission-root-ref-v1,
    store-generation-manifest-ref-v1]
tc04-phase-v1 = [
  "ECR.TC04Phase/1", phase_id: id128-v1,
  store_ref-v1, store_generation: uint63, root_generation: uint63,
  environment_ref-v1, phase_kind: tc04-phase-kind-v1,
  phase: tc04-phase-detail-v1
]

read-set-selected-ref-v1 = store-ref-v1 /
  store-endpoint-identity-ref-v1 /
  endpoint-access-evidence-ref-v1 / endpoint-inspector-profile-ref-v1 /
  endpoint-inspector-build-provenance-ref-v1 /
  endpoint-inspection-subject-ref-v1 /
  endpoint-session-output-evidence-ref-v1 /
  endpoint-inspection-authentication-evidence-ref-v1 /
  qualified-endpoint-inspection-evidence-ref-v1 /
  qualified-provider-session-evidence-ref-v1 /
  store-generation-manifest-ref-v1 /
  store-admission-root-ref-v1 / store-allocation-ref-v1 /
  store-intent-ref-v1 / store-effect-ref-v1 / allocation-entry-ref-v1 /
  store-crash-recovery-state-ref-v1 /
  store-history-ref-v1 / store-receipt-ref-v1 /
  store-schema-registry-ref-v1 / protected-metadata-envelope-ref-v1 /
  store-internal-evidence-ref-v1 /
  stored-object-failure-subject-ref-v1 /
  qualified-stored-object-failure-evidence-ref-v1 /
  authenticated-manifest-contradiction-evidence-ref-v1 /
  authenticated-descriptor-contradiction-evidence-ref-v1 /
  writer-fence-evidence-ref-v1 / environment-ref-v1 / tc04-phase-ref-v1 /
  epoch-vector-object-ref-v1 / qualified-tuple-ref-v1 /
  store-object-index-page-ref-v1 / read-set-anchor-observation-ref-v1 /
  rollback-anchor-identity-ref-v1 /
  authority-request-ref-v1 / authority-decision-ref-v1 /
  tc04-ceremony-authority-ref-v1 / tc04-ceremony-proof-ref-v1 /
  custody-ceremony-authn-evidence-ref-v1 / root-slot-profile-ref-v1 /
  custody-slot-ref-v1 / principal-ref-v1 / owner-readback-ref-v1 /
  trusted-time-input-ref-v1 / utc-skew-evidence-ref-v1 /
  time-evidence-ref-v1 / freshness-ref-v1 / monotonic-evidence-ref-v1 /
  authentication-profile-ref-v1 / provider-ref-v1 /
  provider-tenant-target-ref-v1 / recipient-ref-v1 /
  repository-ref-v1 / state-evidence-ref-v1 / bound-dirty-state-ref-v1 /
  submodule-manifest-ref-v1 / custody-bootstrap-lineage-ref-v1 /
  platform-key-identity-ref-v1 / platform-policy-ref-v1 /
  fips-provider-profile-ref-v1 / custody-crossing-profile-ref-v1 /
  rollback-profile-ref-v1 / platform-evidence-set-ref-v1 /
  carrier-ui-profile-ref-v1 /
  carrier-binding-ref-v1 / carrier-confirmation-ref-v1 /
  carrier-currentness-ref-v1 / development-recovery-omission-ref-v1 /
  backup-freshness-policy-ref-v1 / tc09-authority-ref-v1 /
  store-quarantine-ref-v1 / store-backup-manifest-ref-v1
read-set-canonical-body-ref-v1 = read-set-selected-ref-v1
read-set-context-v1 = "GLOBAL" / "ORDINARY" / "CREATE_SOURCE" /
  "CREATE_DESTINATION" / "CONFIRM_SOURCE" / "CONFIRM_STAGED" /
  "CONFIRM_CURRENT" / "BOOTSTRAP" / "RECOVERY" / "QUARANTINE"
read-set-role-v1 = "STORE" / "ENDPOINT_IDENTITY" / "ENDPOINT_ACCESS" /
  "ENDPOINT_INSPECTOR_PROFILE" / "ENDPOINT_INSPECTOR_BUILD" /
  "ENDPOINT_INSPECTION_SUBJECT" / "ENDPOINT_SESSION_OUTPUT" /
  "ENDPOINT_INSPECTION_AUTHENTICATION" /
  "ENDPOINT_QUALIFIED_INSPECTION" / "ENDPOINT_PROVIDER_SESSION" /
  "ADMISSION_ROOT" / "GENERATION_MANIFEST" / "ANCHOR_OBSERVATION" /
  "ANCHOR_IDENTITY" / "WRITER_FENCE" / "ENVIRONMENT" /
  "TC04_PHASE" / "EPOCH_VECTOR" /
  "QUALIFIED_TUPLE" / "OBJECT_INDEX_ROOT" / "SCHEMA_REGISTRY" /
  "ALLOCATION" / "HISTORY" / "RECEIPT" / "PROTECTED_ENVELOPE" /
  "TRANSACTION_INTENT" / "TRANSACTION_EFFECT" / "ALLOCATION_ENTRY" /
  "CRASH_RECOVERY_STATE" / "INTERNAL_EVIDENCE" /
  "STORED_OBJECT_FAILURE_SUBJECT" / "QUALIFIED_OBJECT_FAILURE_EVIDENCE" /
  "AUTHENTICATED_MANIFEST_CONTRADICTION" /
  "AUTHENTICATED_DESCRIPTOR_CONTRADICTION" /
  "AUTHORITY_REQUEST" / "AUTHORITY_DECISION" / "CUSTODY_PROFILE" /
  "PORTABLE_PROFILE" / "RECOVERY_PROFILE" / "ROOT_SLOT_COMMON" /
  "ROOT_SLOT_BODY" / "PRINCIPAL_OWNER" / "PRINCIPAL_SERVICE" /
  "PRINCIPAL_OPERATOR" / "OWNER_READBACK" / "AUTHENTICATION_EVIDENCE" /
  "AUTHENTICATION_PROFILE" / "PROVIDER" /
  "PROVIDER_TENANT_TARGET" / "RECIPIENT" /
  "REPOSITORY_IDENTITY" / "REPOSITORY_STATE" / "SUBMODULE_MANIFEST" /
  "CEREMONY_AUTHORITY" / "CONSUMPTION_PROOF" / "TRUSTED_TIME" /
  "UTC_SKEW" / "TIME_EVIDENCE" / "FRESHNESS_EVIDENCE" /
  "MONOTONIC_EVIDENCE" / "BOOTSTRAP_LINEAGE" / "PLATFORM_KEY" /
  "PLATFORM_POLICY" / "FIPS_PROFILE" / "CROSSING_PROFILE" /
  "ROLLBACK_PROFILE" / "PLATFORM_EVIDENCE" / "UI_PROFILE" /
  "CARRIER_BINDING" / "CARRIER_CONFIRMATION" /
  "CARRIER_CURRENTNESS" / "DEVELOPMENT_OMISSION" /
  "CREATION_AUTHORITY" / "CREATION_AUTHENTICATION" /
  "CREATION_PROOF" / "CREATION_TIME" / "CREATION_SKEW" /
  "CREATION_RECEIPT" / "CREATION_HISTORY" / "CREATION_MAPPING" /
  "CONFIRMATION_AUTHORITY" / "CONFIRMATION_AUTHENTICATION" /
  "CONFIRMATION_PROOF" / "CONFIRMATION_TIME" /
  "CONFIRMATION_SKEW" / "CONFIRMATION_RECEIPT" /
  "CONFIRMATION_HISTORY" / "CONFIRMATION_MAPPING" /
  "CURRENT_ENVIRONMENT" / "CURRENT_OWNER_READBACK" /
  "CURRENT_AUTHORITY" / "CURRENT_AUTHENTICATION" / "CURRENT_TIME" /
  "CURRENT_SKEW" / "OMISSION_ENVIRONMENT" /
  "OMISSION_OWNER_READBACK" / "OMISSION_AUTHORITY" /
  "OMISSION_AUTHENTICATION" / "OMISSION_PROOF" / "OMISSION_TIME" /
  "OMISSION_SKEW" / "OMISSION_RECEIPT" / "OMISSION_HISTORY" /
  "OMISSION_MAPPING" / "QUARANTINE" / "BACKUP_FRESHNESS_POLICY" /
  "TC09_AUTHORITY" / "BACKUP_MANIFEST"
read-set-selector-v1 = [
  context: read-set-context-v1, role: read-set-role-v1,
  selected_ref: read-set-selected-ref-v1
]
read-set-member-v1 = [
  selectors: [1*32 read-set-selector-v1],
  canonical_body_ref: read-set-canonical-body-ref-v1,
  membership_proof: read-set-membership-proof-ref-v1
]
read-set-anchor-observation-v1 = [
  "ECR.ReadSetAnchorObservation/1", rollback-anchor-observation-v1
]
read-set-direct-role-v1 = "STORE" / "ENDPOINT_IDENTITY" /
  "ENDPOINT_ACCESS" / "ADMISSION_ROOT" / "GENERATION_MANIFEST" /
  "ANCHOR_OBSERVATION" / "WRITER_FENCE" / "ENVIRONMENT" /
  "TC04_PHASE" / "EPOCH_VECTOR" / "QUALIFIED_TUPLE" /
  "OBJECT_INDEX_ROOT"
read-set-proof-detail-v1 =
  [kind: "INDEX_PRESENT", existing_index_proof: store-object-index-proof-v1] /
  [kind: "READ_SET_DIRECT", direct_role: read-set-direct-role-v1] /
  [kind: "TRANSITIVE_REFERENCE",
    referrer_body_ref: read-set-canonical-body-ref-v1,
    reference_role: read-set-role-v1]
read-set-membership-proof-v1 = [
  "ECR.ReadSetMembershipProof/1", proof_id: id128-v1,
  store_ref-v1, parent_generation: uint63,
  parent_admission_root: store-admission-root-ref-v1,
  parent_manifest: store-generation-manifest-ref-v1,
  object_index_root: store-object-index-page-ref-v1,
  canonical_body_ref: read-set-canonical-body-ref-v1,
  detail: read-set-proof-detail-v1,
  result: "PRESENT_EXACT_BODY"
]
store-read-set-v1 = [
  "ECR.StoreReadSet/1", read_set_id: id128-v1,
  store_ref-v1, parent_generation: uint63,
  parent_admission_root: store-admission-root-ref-v1,
  parent_manifest: store-generation-manifest-ref-v1,
  endpoint: store-endpoint-identity-ref-v1,
  endpoint_access: endpoint-access-evidence-ref-v1,
  anchor_observation: read-set-anchor-observation-ref-v1,
  writer_fence: writer-fence-evidence-ref-v1,
  environment: environment-ref-v1,
  tc04_phase: tc04-phase-ref-v1,
  complete_epochs: epoch-vector-object-ref-v1,
  qualified_tuple: qualified-tuple-ref-v1,
  object_index_root: store-object-index-page-ref-v1,
  required_role_count: 1..8192,
  member_count: 1..256,
  members: [1*256 read-set-member-v1]
]

internal-selected-transaction-v1 = [
  transaction_id: bstr .size 16,
  intent: store-intent-ref-v1, effect: store-effect-ref-v1,
  receipt: store-receipt-ref-v1, history: store-history-ref-v1,
  manifest: store-generation-manifest-ref-v1,
  admission_root: store-admission-root-ref-v1
]
internal-selected-allocation-stage-v1 = [
  allocation_entry: allocation-entry-ref-v1,
  selected_manifest: store-generation-manifest-ref-v1,
  selected_root: store-admission-root-ref-v1,
  selected_anchor: read-set-anchor-observation-ref-v1
]
internal-allocation-audit-v1 = [
  kind: "ALLOCATION",
  reserve: internal-selected-allocation-stage-v1,
  materialized: internal-selected-allocation-stage-v1,
  terminal: internal-selected-allocation-stage-v1,
  terminal_selected_transaction: internal-selected-transaction-v1,
  observed_effect_kind: "ALLOCATION_TERMINAL",
  use: "POST_FACT_AUDIT_ONLY"
]
internal-crash-audit-v1 = [
  kind: "CRASH_COMPLETION",
  prior_selected_transaction: internal-selected-transaction-v1,
  before_state: store-crash-recovery-state-ref-v1,
  after_state: store-crash-recovery-state-ref-v1,
  use: "POST_FACT_AUDIT_ONLY"
]
stored-object-failure-operation-v1 = "AES_KWP_UNWRAP" / "AES_GCM_DECRYPT"
stored-object-failure-subject-v1 = [
  "ECR.StoredObjectFailureSubject/1", subject_id: id128-v1,
  detection_transaction_id: bstr .size 16,
  store_ref-v1, environment_ref-v1,
  admitted_generation: uint63,
  admitted_root: store-admission-root-ref-v1,
  admitted_manifest: store-generation-manifest-ref-v1,
  admitted_descriptor: store-object-descriptor-v1,
  admitted_object: read-set-canonical-body-ref-v1,
  admitted_envelope: protected-metadata-envelope-ref-v1,
  operation: stored-object-failure-operation-v1,
  provider_ref-v1, fips_provider_profile_ref-v1,
  provider_session_id: id128-v1,
  qualified_provider_session: qualified-provider-session-evidence-ref-v1,
  provider_attempt_id: id128-v1
]
qualified-stored-object-failure-evidence-v1 = [
  "ECR.QualifiedStoredObjectFailureEvidence/1", evidence_id: id128-v1,
  authenticated_subject: stored-object-failure-subject-ref-v1,
  detection_transaction_id: bstr .size 16,
  store_ref-v1, environment_ref-v1,
  admitted_generation: uint63,
  admitted_root: store-admission-root-ref-v1,
  admitted_manifest: store-generation-manifest-ref-v1,
  admitted_descriptor: store-object-descriptor-v1,
  admitted_object: read-set-canonical-body-ref-v1,
  admitted_envelope: protected-metadata-envelope-ref-v1,
  operation: stored-object-failure-operation-v1,
  provider_ref-v1, fips_provider_profile_ref-v1,
  provider_session_id: id128-v1,
  qualified_provider_session: qualified-provider-session-evidence-ref-v1,
  provider_attempt_id: id128-v1,
  uniform_failure: "AUTHENTICATION_FAILED",
  result: "AUTHENTICATED_QUALIFIED_UNIFORM_FAILURE"
]
authenticated-manifest-contradiction-evidence-v1 = [
  "ECR.AuthenticatedManifestContradictionEvidence/1",
  evidence_id: id128-v1, detection_transaction_id: bstr .size 16,
  store_ref-v1, environment_ref-v1,
  anchor_observation: read-set-anchor-observation-ref-v1,
  admission_root_ref: store-admission-root-ref-v1,
  admission_root_body: store-admission-root-v1,
  manifest_ref: store-generation-manifest-ref-v1,
  manifest_body: store-generation-manifest-v1,
  admitted_object: read-set-canonical-body-ref-v1,
  contradicted_relation: "ROOT_STORE" / "ROOT_GENERATION" /
    "MANIFEST_STORE",
  result: "AUTHENTICATED_EXACT_RELATION_CONTRADICTION"
]
authenticated-descriptor-contradiction-evidence-v1 = [
  "ECR.AuthenticatedDescriptorContradictionEvidence/1",
  evidence_id: id128-v1, detection_transaction_id: bstr .size 16,
  store_ref-v1, environment_ref-v1,
  anchor_observation: read-set-anchor-observation-ref-v1,
  admitted_root: store-admission-root-ref-v1,
  admitted_manifest: store-generation-manifest-ref-v1,
  admitted_object: read-set-canonical-body-ref-v1,
  routing_id: bstr .size 16,
  first_proof: store-object-index-proof-v1,
  first_descriptor: store-object-descriptor-v1,
  second_proof: store-object-index-proof-v1,
  second_descriptor: store-object-descriptor-v1,
  contradicted_relation: "SAME_ROOT_ROUTE_DIFFERENT_PRESENT_DESCRIPTOR",
  result: "AUTHENTICATED_EXACT_RELATION_CONTRADICTION"
]
internal-quarantine-cause-v1 =
  [kind: "KWP_INTEGRITY",
    failure_evidence: qualified-stored-object-failure-evidence-ref-v1] /
  [kind: "GCM_INTEGRITY",
    failure_evidence: qualified-stored-object-failure-evidence-ref-v1] /
  [kind: "MANIFEST_CONTRADICTION",
    contradiction_evidence:
      authenticated-manifest-contradiction-evidence-ref-v1] /
  [kind: "DESCRIPTOR_CONTRADICTION",
    contradiction_evidence:
      authenticated-descriptor-contradiction-evidence-ref-v1]
internal-quarantine-observation-v1 = [
  kind: "ADMITTED_QUARANTINE",
  detection_transaction_id: bstr .size 16,
  admitted_generation: uint63,
  admitted_root: store-admission-root-ref-v1,
  admitted_manifest: store-generation-manifest-ref-v1,
  admitted_descriptor: store-object-descriptor-v1,
  admitted_object: read-set-canonical-body-ref-v1,
  admitted_membership_proof: store-object-index-proof-v1,
  cause: internal-quarantine-cause-v1,
  use: "PRE_EFFECT_OBSERVATION_ONLY"
]
internal-backup-observation-v1 = [
  kind: "BACKUP_SNAPSHOT",
  snapshot_transaction_id: bstr .size 16,
  source_endpoint: store-endpoint-identity-ref-v1,
  source_endpoint_access: endpoint-access-evidence-ref-v1,
  source_generation: uint63,
  source_root: store-admission-root-ref-v1,
  source_manifest: store-generation-manifest-ref-v1,
  source_index_root: store-object-index-page-ref-v1,
  source_anchor: read-set-anchor-observation-ref-v1,
  freshness_policy: backup-freshness-policy-ref-v1,
  trusted_time: trusted-time-input-ref-v1,
  utc_skew_evidence: utc-skew-evidence-ref-v1,
  source_profile: store-profile-ref-v1,
  recipient: recipient-ref-v1,
  use: "PRE_EFFECT_OBSERVATION_ONLY"
]
store-internal-evidence-common-v1 = [
  evidence_id: id128-v1,
  store_ref-v1, environment_ref-v1,
  endpoint: store-endpoint-identity-ref-v1,
  endpoint_access: endpoint-access-evidence-ref-v1,
  fence: writer-fence-evidence-ref-v1,
  read_set: complete-read-set-ref-v1,
  anchor_observation: read-set-anchor-observation-ref-v1,
  result: "OBSERVED_NOT_AUTHORITY"
]
store-allocation-audit-evidence-v1 = [
  "ECR.StoreAllocationAuditEvidence/1",
  common: store-internal-evidence-common-v1,
  detail: internal-allocation-audit-v1
]
store-crash-audit-evidence-v1 = [
  "ECR.StoreCrashCompletionAuditEvidence/1",
  common: store-internal-evidence-common-v1,
  detail: internal-crash-audit-v1
]
store-quarantine-observation-v1 = [
  "ECR.StoreAdmittedQuarantineObservation/1",
  common: store-internal-evidence-common-v1,
  detail: internal-quarantine-observation-v1
]
store-backup-observation-v1 = [
  "ECR.StoreBackupSnapshotObservation/1",
  common: store-internal-evidence-common-v1,
  detail: internal-backup-observation-v1
]
store-internal-evidence-v1 = store-allocation-audit-evidence-v1 /
  store-crash-audit-evidence-v1 / store-quarantine-observation-v1 /
  store-backup-observation-v1

cek-context-ref-v1 = metadata-kdf-context-ref-v1 / backup-kdf-context-ref-v1
cek-scope-v1 =
  [kind: "METADATA", metadata_domain_ref-v1,
    store_generation: uint63, domain_generation: uint63,
    wrapping_generation: uint63] /
  [kind: "BACKUP", backup_domain_ref-v1,
    backup_generation: uint63, wrapping_generation: uint63]
qualified-provider-generation-evidence-v1 = [
  "ECR.QualifiedProviderGenerationEvidence/1", evidence_id: id128-v1,
  store_ref-v1, environment_ref-v1, content_suite: 1, scope: cek-scope-v1,
  envelope_id: id128-v1, cek_id: id128-v1,
  iv: bstr .size 12, logical_cek_handle_id: id128-v1,
  context_ref: cek-context-ref-v1,
  provider_ref-v1, fips_provider_profile_ref-v1,
  qualified_provider_session: qualified-provider-session-evidence-ref-v1,
  entropy_evidence: fips-entropy-evidence-ref-v1,
  result: "QUALIFIED_GENERATED_INDEPENDENT_NONEXPORT"
]
cek-generation-evidence-v1 = [
  "ECR.CekGenerationEvidence/1", evidence_id: id128-v1,
  store_ref-v1, environment_ref-v1, content_suite: 1, scope: cek-scope-v1,
  envelope_id: id128-v1, cek_id: id128-v1,
  iv: bstr .size 12, logical_cek_handle_id: id128-v1,
  envelope_id_materialization_ref: allocation-entry-ref-v1,
  cek_id_materialization_ref: allocation-entry-ref-v1,
  iv_materialization_ref: allocation-entry-ref-v1,
  cek_handle_materialization_ref: allocation-entry-ref-v1,
  context_ref: cek-context-ref-v1,
  provider_generation_evidence:
    qualified-provider-generation-evidence-ref-v1,
  use_state: "MATERIALIZED_UNUSED_ONE_EFFECT"
]

store-schema-registry-entry-v1 = [
  schema_id: uint .le 65535,
  schema_generation: uint .le 65535,
  schema_name: schema-id-v1,
  schema_version: uint63,
  owner_tc: 1..10,
  max_canonical_bytes: uint63,
  record_bytes: uint63,
  status: 1..2                 ; 1=active, 2=read-only-historical
]
store-schema-registry-v1 = [entries: [1*64 store-schema-registry-entry-v1]]
```

All arrays are definite-length and all sets use TC03 deterministic encoded-byte
order. Duplicate semantic or encoded values, unknown enum values, and unknown
fields fail closed. The registry is immutable per generation; a schema can become
read-only-historical but cannot be redefined under its ID.

The TC04 phase union is exhaustive and `phase_kind` byte-equals its detail tag.
`CREATE_SOURCE` and `CREATE_DESTINATION`
admit only `ADD_PLATFORM_SLOT`, `ADD_PORTABLE_SLOT`, `ADD_RECOVERY_SLOT`,
`STAGE_SUCCESSOR_SLOT`, or `REPLACE_LOST_SLOT`. The three `CONFIRM_*` rows admit
only `CONFIRM_PORTABLE_SLOT` or `CONFIRM_RECOVERY_SLOT`; `INITIALIZE_ROOT` admits
only its same-named ceremony. Ordinary, recovery-verify, and quarantine rows
carry no ceremony authority/proof fields. The phase body's store/generations/
environment and every duplicated profile/slot/attempt/authority/proof/current-
control value resolve and byte-equal their frozen TC04 bodies. Current control
resolves all six live bodies—environment, owner readback, authority,
authentication evidence, trusted time, and referenced UTC-skew evidence—plus
complete epochs and tuple. Development omission may be present only when frozen
`NeedsDevelopmentOmission04` is true for ordinary, Create-source, or Confirm-
source; it is tagged absent for every other phase. Another combination is
schema-invalid, not a future extension.

`RequiredBodies04(phase)` is the unique transitive fixed point of the exact
frozen `Resolve04`, applicable `ResolveDevelopmentOmission04`, `CurrentControl04`,
and the selected ordinary/Create/Confirm/bootstrap/recovery/quarantine branch.
It includes every actual source/staged/destination/current slot and common body;
custody/portable/recovery profile; selected owner, custody service, or recovery
operator principal; owner readback; authority, authentication evidence,
consumption proof, authority/proof trusted-time and referenced skew; receipt,
history, and manifest mapping; carrier binding/confirmation/currentness;
bootstrap lineage; platform key/policy/FIPS/crossing/rollback/evidence/UI body;
and the complete omission environment/owner/readback/authority/authentication/
proof/time/skew/receipt/history/mapping graph. Historical evidence is proven
valid at its recorded consumption, not reclassified as current-now; every live
authority/currentness input must still be current. The fixed point is unioned
with every direct TC05 read-set body and its transitive closure, including the
complete endpoint inspector/profile/build/subject/session-output/
authentication/qualified-session chain, anchor identity, fence, schema, index,
allocation, history, receipt, quarantine, backup, and protected-envelope bodies
actually selected by the phase.

The selector role fixes its imported reference type. Direct roles use their
same-named field-specific refs. Profile roles use exactly custody, portable, or
recovery profile refs; both root-slot roles use the selected custody-slot ref;
principal roles use `principal-ref-v1`; readback roles use
`owner-readback-ref-v1`; authority/authentication/proof roles use the exact
custody-ceremony authority/authentication/consumption-proof refs; time/skew roles
use the exact imported trusted-time, skew, time, freshness, and monotonic refs.
Authentication-profile, provider, recipient, repository/state/submodule, and
endpoint-inspection roles use only their same-named exact variants. Creation,
confirmation, current, and
omission role prefixes select only the corresponding frozen branch occurrence.
Their receipt/history roles use the frozen TC04 aliases; mapping roles select the
manifest body that canonically contains that exact mapping. Lineage, platform,
carrier, environment, epoch, tuple, allocation, schema, quarantine, backup, and
ordinary TC02 roles use only the exact variants in `read-set-selected-ref-v1`.
`TC09_AUTHORITY` uses exactly `tc09-authority-ref-v1` and is required for a
current backup-snapshot source; a separate `TC09_LATER` source row does not
satisfy it.
The four quarantine-cause roles use only, respectively,
`stored-object-failure-subject-ref-v1`,
`qualified-stored-object-failure-evidence-ref-v1`,
`authenticated-manifest-contradiction-evidence-ref-v1`, and
`authenticated-descriptor-contradiction-evidence-ref-v1`; cross-role evidence,
digest-only assertions, or locally reconstructed projections cannot substitute.
`PROVIDER_TENANT_TARGET` uses exactly `provider-tenant-target-ref-v1`; a provider,
tenant, target, or recomposed tuple cannot substitute.
Any role/ref mismatch or required body without an admitted variant is
schema-invalid and returns `UNAVAILABLE`, never a generic-digest fallback.

There is exactly one `ReadSetMemberV1` for each unique complete typed
`canonical_body_ref`. All exact selecting context/role/ref triples for that body
are carried once in its ordered `selectors`; every selector's `selected_ref`
byte-equals the member's complete typed `canonical_body_ref`. The same exact ref
selected under multiple roles is not recharged, while semantically equal but byte- or
domain/schema-distinct refs remain separate. Selectors and members are unique
and ordered by deterministic encoded bytes. `required_role_count` equals the
sum of selector counts, `member_count` equals both the member and proof counts,
and every direct read-set reference has one matching selector/member. The
read-set, membership-proof shells, and proof artifacts are excluded from
`RequiredBodies04` to prevent self or transitive recursion. A current pre-effect
branch-specific internal-evidence body is excluded from its own referenced read
set while every common/detail dependency is included. For a current
`StoreAdmittedQuarantineObservationV1` or
`StoreBackupSnapshotObservationV1` source, the intent commits both exact refs.
Exactly 32 roles for
one body, 8,192 total roles, and 256 unique bodies are valid when the relational
branch is achievable. More than any corresponding limit returns `UNAVAILABLE`;
a 257th body is never omitted.

Each member has exactly one unique `ReadSetMembershipProofV1`. Its store,
generation, admission root, manifest, index root, and body ref byte-equal the
read set and member. `INDEX_PRESENT` uses the same root, exactly four current
index pages, literal `PRESENT`, and one selected leaf whose routing ID and
descriptor identify the query. The descriptor digest equals the generated
canonical digest of the resolved member body; the registry independently binds
the exact role-selected domain/schema/kind, and canonical length equals the
resolved canonical body length. Neither digest nor registry metadata substitutes
for the member's complete typed ref. `READ_SET_DIRECT` is permitted only for the
closed direct-role enum and its canonical body ref must hash the body selected by
that exact direct field. `TRANSITIVE_REFERENCE` names an already proved member
whose resolved canonical body contains the exact selected field-specific ref in
the stated role; edges follow the deterministic member topological order and
cannot self-reference, point forward, or cycle. Registry domain/schema/kind and
resolved body agree for every branch. Proof reuse, extra proof, body without
proof, proof without body, caller projection, alternate root, reverse edge, or
digest/length/type substitution denies.

This proof shell is narrowly read-set-local. It authenticates the body/proof
bijection using current index semantics but neither changes nor qualifies the
global locator, index, manifest, or scan-free traversal design; the later F2
repair may replace it. Until the existing proof path and shell have closed
generated bounds and TC10 qualification, the read set is unavailable. Before
any provider/root work and again immediately before CAS, the complete endpoint,
access, anchor, fence, environment, phase, currentness, epoch, tuple, members,
selectors, proof shells, proof pages, and resolved bodies are re-read and
byte-compared. Any drift burns/restarts under the existing transaction rules.

The four branch-specific canonical bodies have disjoint topologies.
`StoreAllocationAuditEvidenceV1` and
`StoreCrashCompletionAuditEvidenceV1` are post-fact audit observations only.
Their typed refs cannot inhabit `store-transaction-source-v1`, bootstrap the
fact they describe, or authorize a later action.
`StoreAdmittedQuarantineObservationV1` and
`StoreBackupSnapshotObservationV1` are bounded pre-effect observations. Only
their exact field-specific refs can be the current `INTERNAL_DETERMINISTIC`
source because neither body contains the current intent, effect, receipt,
history, output manifest/root, or a descendant of any of them. The closed
source matrix is:

- reason `ADMITTED_QUARANTINE` ->
  `store-quarantine-observation-ref-v1` -> schema literal
  `ECR.StoreAdmittedQuarantineObservation/1` -> detail tag and current effect
  kind `ADMITTED_QUARANTINE`;
- reason `BACKUP_SNAPSHOT` -> `store-backup-observation-ref-v1` -> schema
  literal `ECR.StoreBackupSnapshotObservation/1` -> detail tag and current
  effect kind `BACKUP_SNAPSHOT`, conjunctively with the same source row's exact
  `tc09-authority-ref-v1`.

The current intent, branch detail, and effect transaction IDs are equal. Every
other reason/ref/schema/tag/effect combination is schema-invalid. In particular,
no generic `StoreInternalEvidence` schema or ref exists. The
`store-internal-evidence-v1` and `store-internal-evidence-ref-v1` names are only
closed type aliases over the four exact canonical bodies/refs for read-set and
accounting selection; neither is a serializable umbrella body or an authority
source. `ALLOCATION` and `CRASH_COMPLETION` are categorically post-fact
audit-only and never current sources; section 8 creates no crash-completion
transaction or effect.

The common outer store/environment/endpoint/access/fence/read-set/anchor bodies
resolve and byte-equal the branch and current gate. To break every evidence
cycle, each branch body is excluded from the read set it references while every
one of its already-existing common/detail dependencies is included exactly
once. A current quarantine/backup intent separately commits the exact branch ref
and that same read-set ref. A post-fact allocation or crash body cannot appear
in the prior transaction it observes or in its own referenced audit read set.
Any `intent -> evidence -> same
intent/effect/receipt/history/manifest/
root`, effect-descriptor-to-evidence-to-same-effect, self, reverse, descendant,
or transitive-back edge is schema-invalid.

The allocation branch resolves three already selected immutable entries. Reserve
is `RESERVED`; materialized references that reserve; terminal is exactly one of
`CONSUMED` or `BURNED` and references that materialized entry. Allocation ID,
kind, sequence, store, environment, suite, and kind-tagged value agree throughout.
Each entry is reachable from its exact selected manifest/root/anchor. The prior
terminal transaction tuple has one non-digest transaction ID and exact intent,
effect, receipt, history, manifest, and root; its effect kind is
`ALLOCATION_TERMINAL`, includes the terminal entry, and equals the terminal
stage's selected manifest/root. Evidence is created only afterward and outside
that effect/receipt/history/manifest/root graph.

The crash branch's prior tuple has the same exact transaction/effect/receipt/
history/manifest/root equality. The resolved before state is exactly
`ANCHOR_SELECTED_HEAD_MISSING`; the resolved after state is exactly
`PUBLISHED_ANCHOR_HEAD_EQUAL`; both observations use the same authenticated
anchor as the outer evidence. It records deterministic local-head completion
only—no current/self transaction ID, new effect, receipt, generation, anchor CAS,
or authority.

The quarantine branch binds one independent current detection transaction ID,
selected generation/root/manifest, exact typed admitted object, complete admitted
descriptor, and the existing bounded inline four-page
`store-object-index-proof-v1`. Proof root, route, `PRESENT` leaf, descriptor,
typed-ref digest/domain/schema, registry entry, length, and selected generation
are exact. The resolved selected manifest's `quarantine_ref` must be literal
`nil` for that same store/generation/root. Any non-nil value or mismatch denies;
there is no caller-chosen route, synthetic registry key, or absence proof.

The cause is one closed tag, never independent reason plus integrity assertions.
`KWP_INTEGRITY` resolves one exact
`QualifiedStoredObjectFailureEvidenceV1` whose subject operation is
`AES_KWP_UNWRAP`; `GCM_INTEGRITY` resolves the same exact evidence type with
operation `AES_GCM_DECRYPT`. Subject and evidence detection transaction,
store/environment, admitted generation/root/manifest/descriptor/typed object/
envelope, operation, provider/profile/session/qualified-session/attempt, and
uniform result byte-equal wherever present. The admitted descriptor is protected,
its envelope ref equals the subject envelope, and its typed object ref is fixed
by descriptor digest plus authenticated registry domain/schema. The resolved
qualified provider-session body carries the same actual provider/session.
Construction is admitted inputs -> failure subject -> authenticated qualified
failure evidence -> cause -> observation; no edge points to the current effect
or any output. TC10 must qualify the exact provider/profile/session build,
operation, field-specific authenticated output, uniform error/timing behavior,
and bounds. Until then both failure causes are
`UNAVAILABLE_PENDING_TC10_OBJECT_FAILURE_EVIDENCE`; a locally constructed body,
valid digest, provider error string, or session-ref possession grants nothing.
No cause/evidence/log contains or emits ciphertext samples, CEK/key material,
plaintext, secret-derived digest, algorithm-internal detail, or caller-visible
KWP-versus-GCM oracle; all external failures use one uniform result.
Cause/operation detail is protected store metadata available only to the later
qualified audit path, never clear routing metadata, API output, or diagnostic log.

`MANIFEST_CONTRADICTION` resolves the exact authenticated manifest-comparison
body. Its admission-root and manifest refs hash their complete inline canonical
bodies and its anchor is the selected trusted anchor. In every valid comparison,
`evidence.manifest_ref == admission_root_body.manifest_ref ==
observation.admitted_manifest`; an unequal root manifest ref is not a cause and
denies. The exact tag/LHS/RHS table is:

| Tag | Sole unequal LHS | RHS equality class |
| --- | --- | --- |
| `ROOT_STORE` | `admission_root_body.store_ref` | evidence/common/observation store and `manifest_body.store_ref` |
| `ROOT_GENERATION` | `admission_root_body.generation` | observation admitted generation, `manifest_body.generation`, and selected-anchor observed generation |
| `MANIFEST_STORE` | `manifest_body.store_ref` | evidence/common/observation store and `admission_root_body.store_ref` |

Normatively, with `e` the comparison and `o` the enclosing observation:

```text
expected_store = e.store_ref = o.common.store_ref
expected_environment = e.environment_ref = o.common.environment_ref
expected_generation = o.detail.admitted_generation =
  e.manifest_body.generation = resolve(e.anchor_observation).observed_generation
e.detection_transaction_id = o.detail.detection_transaction_id
e.admitted_object = o.detail.admitted_object
e.anchor_observation = o.common.anchor_observation
e.admission_root_ref = o.detail.admitted_root =
  resolve(e.anchor_observation).observed_admission_root
e.manifest_ref = e.admission_root_body.manifest_ref =
  o.detail.admitted_manifest
SHA256(canonical(e.admission_root_body)) = payload(e.admission_root_ref)
SHA256(canonical(e.manifest_body)) = payload(e.manifest_ref)
e.admission_root_body.manifest_canonical_length =
  length(canonical(e.manifest_body))
e.manifest_body.object_index_root_ref =
  o.detail.admitted_membership_proof.root_ref
e.manifest_body.quarantine_ref = nil
resolve(e.anchor_observation).trust_state = 1 (trusted)
```

For the selected row, LHS is unequal to every member of its RHS class; every
RHS member is byte-equal. The complete equality vector outside that one row is:
evidence and observation detection transaction, store, environment, admitted
object, admission-root ref, manifest ref, and anchor ref are byte-equal; each ref
hashes its inline canonical body; the trusted anchor selects that exact
admission-root ref and its observed generation equals the observation admitted
generation; root manifest ref equals the evidence/observation manifest ref;
manifest generation equals the observation/anchor generation; root and manifest
store equal the evidence/observation store except only the selected row's LHS;
and every other root/manifest field retains its authenticated canonical value.
Zero named inequalities, two inequality dimensions, a second tag, unlinked body,
alternate manifest ref, or cross-store/generation substitution outside the sole
LHS rejects.

`DESCRIPTOR_CONTRADICTION` resolves the exact authenticated descriptor-comparison
body: two raw authenticated page paths hash to the same selected root, use the
same routing ID, and each carries a `PRESENT` leaf entry matching its respective
canonical descriptor. The descriptors are unequal. Each path's hashes,
canonical bytes, levels, links, and local range are valid; the combined admitted
tree's duplicate same-route-to-different-descriptor uniqueness violation is the
sole named contradiction. A path is not required to establish global uniqueness
in isolation—doing so would erase the achievable contradiction witness. Both
comparison bodies repeat the current detection
transaction, store/environment, admitted lineage, and typed object exactly; a
caller projection, unauthenticated compared input, zero/two unequal relations,
or mutable summary denies. These causes prove only the frozen admitted
contradiction; they define no generation scope, propagation, clearing, retry, or
incident policy.

The current `ADMITTED_QUARANTINE` effect has the same detection transaction and
store and contains exactly one payload descriptor: kind `QUARANTINE`, exact
registry schema `ECR.Quarantine/1`, `DIRECT` location, and canonical body/ref
`store-quarantine-ref-v1`. The resolved record's store, admitted generation,
manifest, typed object, mapped reason (`KWP=1`, `GCM=2`, manifest=3,
descriptor=4), detection transaction, and anchor byte-equal the observation;
`prior_quarantine_ref` is literal `nil`. The descriptor/ref/hash/length/body and
the effect/intent/receipt/history/new-manifest mapping are exact. Missing, extra,
duplicate, wrong-kind, wrong-schema, wrong-location, wrong-payload, or cross-bound
records deny. Observation and cause bodies contain no record/effect/receipt/
history/successor-manifest ref, preserving the backward-only graph.

The backup branch binds the independent current snapshot transaction ID and
exact source endpoint/access/store/generation/root/manifest/index root/current
anchor, frozen freshness policy, trusted time and skew, source store profile,
and recipient. It contains no backup manifest/envelope, current effect/receipt/
history/output ref, complete-object-set digest, plaintext/secret digest, or
authority. This reproduces only source/freshness equality; F6/F7/F9/F10 retain
backup enumeration, recipient, transport, restore, and qualification policy.
For a current backup snapshot, its transaction source also carries one exact
TC09 authority ref. That authority is current, transaction/environment/store/
profile/recipient/effect bound, is a required `TC09_AUTHORITY` read-set member,
and is validated conjunctively with—not derived from or persisted inside—the
observation. Missing, stale, prior-transaction, cross-bound, or separately
present authority denies; the observation itself never grants authority.

`OBSERVED_NOT_AUTHORITY` is literal for every branch. Existence, possession,
digest resolution, or a locally valid graph grants no mutation, custody,
recovery, quarantine, backup, or later-TC authority.

`WriterFenceEvidenceV1` is an immutable acquisition fact, not the fencing
algorithm. Its typed anchor identity, token, predecessor, endpoint/access, store,
and monotonic generation must resolve and match the read set. TC10 must close and
qualify `ECR.RollbackAnchorIdentity/1`, including `Max/Record`, authenticated CAS
identity, token provenance, and platform durability; until then every fence is
unavailable. `CekGenerationEvidenceV1` exposes no CEK, provider handle, key/
plaintext/secret digest, or secret-derived value. It resolves the already-final
metadata/backup KDF context and four already-materialized allocation entries.
Envelope ID, CEK ID, IV, and opaque logical CEK-handle ID byte-equal the context,
protected header, allocation values, provider-generation evidence, and evidence
body. Provider identity/profile/session and entropy are authenticated only by the
resolved `QualifiedProviderGenerationEvidenceV1`; raw IDs cannot substitute.
The referenced `FipsProviderProfileV1`, `QualifiedProviderSessionEvidenceV1`, and
`FipsEntropyEvidenceV1` bodies, their exact `Max/Record`, qualified provider
session, independence, and non-export proof are hard TC10 gates; a typed
reference alone cannot make the evidence valid.

The CEK construction DAG is exact and every reference points backward:

```text
four reservations
  -> four materialized entries (ENVELOPE_ID, CEK_ID, NONCE, CEK_HANDLE)
  -> one final metadata/backup KDF context
  -> one QualifiedProviderGenerationEvidenceV1
  -> one CekGenerationEvidenceV1
  -> one wrapper/effect descriptor set
  -> four terminal CONSUMED-or-BURNED entries
```

The `CEK_HANDLE` materialized value is only its opaque logical 16-byte ID and is
distinct from CEK ID, envelope ID, IV, provider handle, and every evidence ref.
The final context contains all four materialized refs and their public values.
Provider-generation evidence authenticates that exact final context, logical
handle, provider/profile/session/entropy, independent non-export generation, and
result. CEK evidence repeats those public fields and refs and is included with
the wrapper in the same effect descriptor set. Exactly one CEK evidence maps to
one CEK-handle materialization, one context, one wrapper/effect, and one terminal
transition; reuse, a second effect, or a missing/multiple terminal is invalid.
No allocation entry points to CEK evidence, provider evidence, or a context, so
the graph cannot close a digest cycle.

`scope.kind` selects exactly the metadata or backup context alternative. Its
domain and store/backup/domain/wrapping generations byte-equal that context.
The literal `content_suite: 1` byte-equals the final KDF context's content-suite
literal and `suite_id: 1` in all four materialized allocation entries. CEK-
evidence store/environment equal provider-generation evidence and all four
allocation entries; context and both evidence bodies repeat identical envelope,
CEK, IV, logical-handle, and allocation values/refs wherever the field exists.
Provider/profile/session/entropy occur only in qualified provider-generation
evidence and are authenticated by its referenced qualified bodies; they are not
falsely claimed as KDF fields. Unknown, missing, additional, or cross-scope values
fail before provider use.

For each new TC05-owned body `T` in this repair—endpoint access evidence, writer
fence evidence, TC04 phase, store read set, each exact branch-specific internal
evidence body, the four quarantine cause/evidence bodies and quarantine record,
and CEK generation evidence plus qualified provider-generation evidence—`Max05(T)` is TC03's exact maximum over complete rule-valid
CDDL-plus-relational rows and `Record05(T)=max(x:T){2*length(x)+Meta(x)}`. Its
typed reference is exactly `[1,2,domain,schema,SHA-256(canonical(x))]` with the
literal domain/schema declared above. The registry entry's maximum and record
fields equal the generated values. No loose cap, unresolved body, alternate
domain/schema, digest-only assertion, or incompatible independent maxima pass.

```cddl
stored-object-location-v1 =
  [kind: 1, body_ref: digest-ref-v1] /
  [kind: 2, envelope_ref: protected-metadata-envelope-ref-v1]

store-object-descriptor-v1 = [
  routing_id: bstr .size 16,
  object_kind: store-object-kind-v1,
  schema_registry_entry_id: uint .le 65535,
  canonical_length: uint .le 1048000,
  canonical_digest: digest-ref-v1,
  location: stored-object-location-v1,
  lifecycle: 1..3              ; 1=live, 2=historical, 3=tombstone
]
store-object-descriptor-set-v1 = [1*256 store-object-descriptor-v1]
store-object-index-leaf-entry-v1 = [bstr .size 16, store-object-descriptor-v1]
store-object-index-branch-entry-v1 = [uint .le 255, store-object-index-page-ref-v1]
store-object-index-page-v1 =
  [level: 0, prefix: bstr .size 3,
    entries: [1*256 store-object-index-leaf-entry-v1]] /
  [level: 1..3, prefix: bstr .size (0..2),
    entries: [1*256 store-object-index-branch-entry-v1]]
store-object-index-proof-v1 = [
  root_ref: store-object-index-page-ref-v1,
  routing_id: bstr .size 16,
  pages_root_to_leaf: [4*4 store-object-index-page-v1],
  result: "PRESENT" / "ABSENT"
]

rollback-anchor-observation-v1 = [
  anchor_identity_ref: rollback-anchor-identity-ref-v1,
  observed_store_generation: uint63,
  observed_admission_root: store-admission-root-ref-v1,
  observation_token: bstr .size (16..128),
  trust_state: 1..3            ; 1=trusted, 2=unavailable, 3=mismatch
]

store-committed-effect-v1 = [
  store_ref: store-ref-v1,
  transaction_id: bstr .size 16,
  parent_generation: uint63,
  proposed_generation: uint63,
  writer_fence_generation: uint63,
  payload_object_descriptors: store-object-descriptor-set-v1,
  allocation_ref: store-allocation-ref-v1,
  effect_kind: store-effect-kind-v1
]

store-transaction-intent-v1 = [
  store_ref: store-ref-v1,
  transaction_id: bstr .size 16,
  parent_generation: uint63,
  proposed_generation: uint63,
  writer_fence_generation: uint63,
  complete_read_set_ref: complete-read-set-ref-v1,
  authority_source: store-transaction-source-v1,
  effect_ref: store-effect-ref-v1,
  allocation_ref: store-allocation-ref-v1,
  anchor_observation: rollback-anchor-observation-v1
]
```

The transaction-source tag is exact: ordinary operations require only the TC02
pair; TC04 ceremonies require only their phase/authority/proof; deterministic
admitted-integrity quarantine requires only its exact
`StoreAdmittedQuarantineObservationV1` ref; backup snapshot requires only its
exact `StoreBackupSnapshotObservationV1` ref **and** exact
`tc09-authority-ref-v1` in the same source row. Observation alone, a separate
`TC09_LATER` row, or either reference from another transaction cannot authorize
a backup snapshot. Allocation and crash-completion audit refs have no
source-union variant and cannot authorize or bootstrap a transaction. TC06/TC09
variants remain later-owned typed authority gates for their other exact effects.
TC06/TC09 tags remain unusable until those exact schemas
close. No source can carry another branch's fields.

`transaction_id` is an independently generated 16-byte identifier, never a
digest. `routing_id` is also independently random and unique within the complete
reachable set; it is not authority or identity. `object_kind` and `effect_kind`
literal registries above are closed and versioned only by a new schema
generation; unregistered values fail closed.

```cddl
store-history-evidence-v1 = [
  store_ref: store-ref-v1,
  transaction_id: bstr .size 16,
  parent_history_ref: nil / store-history-ref-v1,
  parent_generation: uint63,
  proposed_generation: uint63,
  intent_ref: store-intent-ref-v1,
  effect_ref: store-effect-ref-v1,
  exact_proof_refs: [1*64 digest-ref-v1],
  complete_current_evidence_digests: [1*256 digest-ref-v1]
]

store-transaction-receipt-v1 = [
  store_ref: store-ref-v1,
  transaction_id: bstr .size 16,
  parent_generation: uint63,
  proposed_generation: uint63,
  intent_ref: store-intent-ref-v1,
  effect_ref: store-effect-ref-v1,
  history_ref: store-history-ref-v1,
  proof_refs: [1*64 digest-ref-v1]
]

store-proof-mapping-v1 = [
  proof_ref: digest-ref-v1,
  transaction_id: bstr .size 16,
  receipt_ref: store-receipt-ref-v1,
  history_ref: store-history-ref-v1,
  effect_ref: store-effect-ref-v1
]

store-generation-manifest-v1 = [
  store_ref: store-ref-v1,
  generation: uint63,
  parent_generation: nil / uint63,
  parent_manifest_ref: nil / store-generation-manifest-ref-v1,
  schema_registry_ref: store-schema-registry-ref-v1,
  intent_ref: store-intent-ref-v1,
  effect_ref: store-effect-ref-v1,
  receipt_ref: store-receipt-ref-v1,
  history_ref: store-history-ref-v1,
  proof_mappings: [1*64 store-proof-mapping-v1],
  object_index_root_ref: store-object-index-page-ref-v1,
  complete_reachable_object_count: uint .le 1048576,
  allocation_ref: store-allocation-ref-v1,
  quarantine_ref: nil / store-quarantine-ref-v1
]

store-admission-root-v1 = [
  store_ref: store-ref-v1,
  generation: uint63,
  manifest_ref: store-generation-manifest-ref-v1,
  manifest_canonical_length: uint .le 1048576,
  complete_preroot_resolver_digest: digest-ref-v1,
  complete_preroot_resolver_length: uint .le 1048576,
  anchor_predecessor_token: bstr .size (16..128)
]
```

Every receipt and history record binds the non-digest transaction ID, effect
digest, and identical deterministically ordered proof set; every manifest map
equals one of those proof refs and repeats the exact transaction/receipt/history/
effect tuple. The single receipt form means only prepared; selectedness exists
only in the qualified rollback-anchor observation.

Except for the closed `ADMITTED_QUARANTINE` singleton relation above, the effect
descriptor set contains payload/allocation/TC04 bodies only and forbids intent,
history, receipt, manifest, admission-root, anchor, quarantine evidence, and any
descendant transaction-metadata record. The quarantine effect's descriptor set
is exactly its one new immutable `ECR.Quarantine/1` record and nothing else. The
manifest descriptor set excludes
its containing manifest and admission root; their fixed fields supply those
edges. The only digest direction is closed bodies -> effect -> intent; prior history
plus intent/effect/current evidence -> history; intent/effect/history/proofs ->
receipt; those complete records -> manifest -> admission root -> external
anchor. Proofs never reference a receipt or manifest; receipt/history never
reference their containing manifest; no record includes its own or a transitive
descendant digest.

Admission validates that exact descriptor partition and performs a complete
bounded transitive-closure walk. A forbidden back-edge, absent fixed-edge target,
duplicate, or cycle fails before provider or quarantine work.

The object index is a depth-4 authenticated radix tree over the first three
routing-ID bytes and a leaf's complete 16-byte IDs. Branch selectors are unique,
strictly increasing, equal the next routing byte, and byte-equal child prefixes;
leaf IDs are unique/increasing and match both prefix and descriptor. Empty pages,
compression, alternate depth, shared child, dangling page, count mismatch, and
more than 1,048,576 manifest-counted leaf entries reject. Lookup authenticates the
closed root-to-leaf proof and charges every complete page; insertion additionally
proves absence at the exact leaf. This is the only routing-ID collision proof.

Pre-root authentication charges and validates the complete admitted manifest and
resolver set. A smaller access is permitted only after TC10 closes and qualifies
the section 5 inclusion proof against the same admission root; caller projections
never reduce authenticated or charged bytes.

## 7. Protected metadata wrapper and AAD

TC05 profiles TC03's exact production SHA-256/HKDF-SHA-256/AES-256-KWP/
AES-256-GCM construction for the later-owned metadata kind. It adds a media kind
and closed contexts, not an algorithm; serialization is unavailable until TC10
qualifies this extension and its metadata-domain custody path.

```cddl
tc05-metadata-aad-v1 = [
  "ECR.MetadataAAD/1", envelope_id: id128-v1, cek_id: id128-v1,
  store_ref: store-ref-v1,
  store_generation: uint63,
  object_kind: store-object-kind-v1,
  schema_registry_entry_id: uint .le 65535,
  routing_id: bstr .size 16,
  ciphertext_length: uint63,
  metadata_domain_ref: metadata-domain-ref-v1,
  metadata_domain_generation: uint63,
  wrapping_generation: uint63,
  wrapped_cek: bstr .size 40,
  logical_cek_handle_id: id128-v1,
  envelope_id_allocation_ref: allocation-entry-ref-v1,
  cek_id_allocation_ref: allocation-entry-ref-v1,
  cek_handle_allocation_ref: allocation-entry-ref-v1,
  iv_allocation_ref: allocation-entry-ref-v1,
  protected_header: tc05-metadata-protected-header-v1
]
tc05-metadata-protected-header-v1 = {
  1: 3, 2: [-65537,-65538,-65539],
  3: "application/ecr-protected-metadata+cbor",
  4: id128-v1, 5: bstr .size 12,
  -65537: 1, -65538: 4, -65539: 1
}
tc05-metadata-kdf-context-v1 = [
  "ECR.MetadataKwpContext/1", 1, 1, 4,
  envelope_id: id128-v1, cek_id: id128-v1,
  store_ref: store-ref-v1, store_generation: uint63,
  metadata_domain_ref: metadata-domain-ref-v1, metadata_domain_generation: uint63,
  routing_id: bstr .size 16, object_kind: store-object-kind-v1,
  schema_registry_entry_id: uint .le 65535,
  ciphertext_length: uint63, wrapping_generation: uint63,
  logical_cek_handle_id: id128-v1,
  envelope_id_allocation_ref: allocation-entry-ref-v1,
  cek_id_allocation_ref: allocation-entry-ref-v1,
  cek_handle_allocation_ref: allocation-entry-ref-v1,
  iv_allocation_ref: allocation-entry-ref-v1,
  protected_header: tc05-metadata-protected-header-v1
]

tc05-protected-metadata-envelope-v1 = [
  aad: tc05-metadata-aad-v1,
  cose: cose-encrypt0-v1
]
metadata-domain-ref-v1 = [1,5,"METADATA",bstr .size 16]
```

The external AAD is the exact deterministic bytes of `tc05-metadata-aad-v1`.
Envelope/CEK/logical-handle IDs, store/generation, routing/object/schema,
allocation refs, wrapped CEK, and header are copied byte-equal into applicable outer, header, AAD, and KDF
positions. COSE's protected bstr is exactly the deterministic encoding of the
structured header; key ID/IV equal its CEK ID and exact independently reserved IV.
The metadata domain master derives wrapping material with TC03's exact salt rule
over that domain and canonical `tc05-metadata-kdf-context-v1`; every object has a
fresh independent CEK and IV whose separate anchor-selected reservations precede
generation and whose terminal transitions burn/consume on every path. KDF context excludes only wrapped CEK and COSE
ciphertext/tag. Domain/wrapping generations are authenticated inside the outer
envelope and context. Unknown/duplicate headers, mismatch, transplant, trailing
bytes, or noncanonical nested content fail before use. Only suite 1 is admitted.

The independently random metadata-domain master must itself resolve through a
later closed root-wrapped domain-slot body whose context binds store, domain,
generation, epochs, wrapping generation, and TC04 custody profile. TC05 does not
invent that body. Until TC06 closes it and TC10 qualifies its exact TC03 suite,
metadata wrapper creation/open is a hard unavailable predicate.

Visible AAD has only random IDs, store/generation, bounded object/schema class,
length, wrapped random CEK, and header. Sensitive labels, stable plaintext
digests, repository/environment/target identities, proof relations, and history
stay inside the encrypted canonical plaintext and are authenticated by GCM.
Fixed padding is not claimed; type/size/timing leakage remains TC10 work. Every
wrapper and plaintext body has separately registered closed `Max(T)` and
`Record(T)` equations; a wrapper bound cannot substitute for a plaintext bound.

## 8. Transaction, durability, and crash protocol

The transaction state machine is `RESERVED -> INTENT_DURABLE -> DATA_DURABLE ->
PREPARED -> ANCHOR_SELECTED -> LOCALLY_PUBLISHED -> RESPONSE_EMITTED_EPHEMERAL`;
any pre-anchor
failure becomes `ABANDONED`, with consumed allocations burned. Only the qualified
external rollback-anchor CAS from the exact predecessor to the proposed admission
root linearizes a commit.

For every ordinary, bootstrap, currentness, omission, creation, confirmation, or
current-control transaction, the implementation later qualified by TC10 must:

1. authenticate endpoint/root/current anchor and acquire a unique writer fence;
2. if allocation is needed, finish and locally publish a distinct anchor-selected
   reservation transaction, then begin this effect with a new fence;
3. snapshot the complete read set, including that reservation, and bind it to
   intent and fence generation before any UI/provider/custody/target work;
4. write immutable data/envelope files with exclusive creation, fsync each file,
   then fsync every staging directory;
5. write and fsync exact history, receipt, proof mapping, manifest, and admission-
   root candidates, then fsync their parent directories;
6. revalidate the complete read set, endpoint identity, fence, environment,
   rollback predecessor, and all TC04 currentness inputs;
7. CAS the qualified external anchor; a mismatch abandons without local publish;
8. durably select the matching local head/admission-root slot, fsync that file and
   all affected parent directories, re-read anchor/head equality, then acknowledge.

Before step 7, no candidate is visible authority. After successful step 7, crash
recovery must finish the exact local publish without rerunning provider/UI work.
No acknowledgement precedes all required file and parent-directory fsyncs.

Crash recovery recognizes exactly: `NO_INTENT`, `ABANDONED_PRE_ANCHOR`,
`PREPARED_UNSELECTED`, `ANCHOR_SELECTED_HEAD_MISSING`,
`PUBLISHED_ANCHOR_HEAD_EQUAL`, or `CORRUPT_AMBIGUOUS`. The classifier is a closed durable record
binding endpoint, fence, intent/effect/receipt/history/manifest/admission root,
observed anchor/head, completed fsync steps, and exact evidence refs. Local head
ahead of anchor is `CORRUPT_AMBIGUOUS`, never prepared. It never guesses. Bootstrap
and every TC04 ceremony set enumerate all required TC04 objects and become visible
all-or-none. Partial, malformed, over-bound, wrong-environment, or mixed-generation
sets remain unreachable and cannot be repaired by accepting a subset.

```cddl
local-head-observation-v1 =
  [state: "ABSENT"] /
  [state: "PRESENT", admission_root_ref: store-admission-root-ref-v1,
    raw_head_digest: digest-ref-v1]
store-recovery-observation-v1 = [
  store_ref-v1, store-endpoint-identity-ref-v1,
  rollback-anchor-observation-v1, local-head-observation-v1,
  intents: [0*64 store-intent-ref-v1],
  effects: [0*64 store-effect-ref-v1],
  receipts: [0*64 store-receipt-ref-v1],
  histories: [0*64 store-history-ref-v1],
  manifests: [0*64 store-generation-manifest-ref-v1],
  admission_roots: [0*64 store-admission-root-ref-v1]
]
store-crash-recovery-state-v1 = [
  "ECR.StoreCrashRecoveryState/1",
  state: "NO_INTENT" / "ABANDONED_PRE_ANCHOR" /
    "PREPARED_UNSELECTED" / "ANCHOR_SELECTED_HEAD_MISSING" /
    "PUBLISHED_ANCHOR_HEAD_EQUAL" / "CORRUPT_AMBIGUOUS",
  observation: store-recovery-observation-v1
]
```

The classifier is a pure deterministic function of one authenticated anchor
observation, direct immutable candidate bytes, and the re-read local head. Fsync,
CAS, acknowledgement, process, clock, and mutable status assertions are not
inputs. The named state is the unique row whose required references and exact
anchor/head relation match. An impossible relation,
multiple matching row, or no matching row is `CORRUPT_AMBIGUOUS` and blocks.
Any history/evidence record is emitted only after this classification and cannot
change it.

Acknowledgement is ephemeral protocol output, not a durable classifier state.
Crash immediately before or after response write reconstructs the same
`PUBLISHED_ANCHOR_HEAD_EQUAL` state and may replay the same receipt without
rerunning UI/provider work or claiming exactly-once response delivery.

`CRASH_COMPLETION` is deterministic repair of the local head to the already
anchor-selected admission root. It creates no generation, receipt, effect,
authority, or second anchor transaction and never reruns UI/provider work.
`transactions` holds at most 64 unselected candidate descriptors only; all
immutable bodies are already content-addressed under `objects`. After the anchor
has irreversibly advanced beyond a candidate's predecessor, a qualified cleaner
may unlink only that revalidated unselected descriptor, never a selected body or
historical record. At cap, creation denies until such cleanup or TC09 migration.
Crash at cap, cleanup race, candidate substitution, or uncertain anchor state
performs no unlink and no new transaction.

## 9. Concurrency, fencing, and immutable generations

There is one logical writer per store generation and arbitrarily many readers.
The writer fence covers the entire read set from admission through anchor CAS and
local publication. A contender reads the qualified anchor, obtains a new
monotonic fence generation, and uses exclusive immutable object creation. It
cannot overwrite or unlink any object. Before CAS it proves the predecessor,
fence, read-set digest, endpoint identity, and all TC04 observations remain exact.

PID, hostname, file age, heartbeat, wall clock, and lockfile ownership do not
break a fence. A stolen/stale writer cannot unlink or overwrite a successor and
cannot acknowledge. On conflict, a retry starts a new transaction, reservation,
read set, authority evaluation, and fence; it never reuses effectful work.

A reader pins one authenticated `(store_id, generation, admission_root)` handle
for its lifetime. It never follows mutable names after admission. Compaction may
not remove objects reachable by a reader handle or by any required historical
authority/evidence/proof/receipt/history chain.

## 10. Allocation and burn ledger

```cddl
allocation-entry-ref-v1 =
  [1,2,"ECR-D1/ATTEMPT","ECR.AllocationEntry/1",sha256-v1]
allocation-kind-v1 = "NONCE" / "PUBLIC_ARTIFACT_ID" / "SEQUENCE" /
  "TARGET_ATTEMPT" / "MIGRATION_ID" / "RESTORE_ID" /
  "ENVELOPE_ID" / "CEK_ID" / "CEK_HANDLE"
allocation-state-v1 = "RESERVED" / "MATERIALIZED" / "CONSUMED" / "BURNED"
cek-generation-evidence-ref-v1 =
  [1,2,"ECR-D1/EFFECT-EVIDENCE","ECR.CekGenerationEvidence/1",sha256-v1]
allocation-value-v1 =
  [kind: "NONCE", value: bstr .size 12] /
  [kind: "PUBLIC_ARTIFACT_ID", value: id128-v1] /
  [kind: "SEQUENCE", value: uint63] /
  [kind: "TARGET_ATTEMPT", value: id128-v1] /
  [kind: "MIGRATION_ID", value: id128-v1] /
  [kind: "RESTORE_ID", value: id128-v1] /
  [kind: "ENVELOPE_ID", value: id128-v1] /
  [kind: "CEK_ID", value: id128-v1] /
  [kind: "CEK_HANDLE", value: id128-v1]
allocation-transition-v1 =
  [state: "RESERVED"] /
  [state: "MATERIALIZED", reservation_ref: allocation-entry-ref-v1,
    value: allocation-value-v1] /
  [state: "CONSUMED", materialized_ref: allocation-entry-ref-v1] /
  [state: "BURNED", materialized_ref: allocation-entry-ref-v1]
allocation-ledger-entry-v1 = [
  store_ref: store-ref-v1,
  transaction_id: bstr .size 16,
  allocation_id: id128-v1,
  sequence: uint63,
  allocation_kind: allocation-kind-v1,
  transition: allocation-transition-v1,
  environment_identity_ref: environment-ref-v1,
  suite_id: 1..4
]
allocation-ledger-v1 = [entries: [1*4096 allocation-ledger-entry-v1]]
```

The tags are exhaustive. `RESERVED` has no value/ref. Exactly one anchor-selected
`MATERIALIZED` entry references it and carries a value whose tag equals the entry
kind. Exactly one later terminal (`CONSUMED` xor `BURNED`) references that
materialized entry; terminal entries have no successor. Any other presence,
missing/multiple transition, cross-kind/value/ref, transition from terminal, or
duplicate allocation ID is invalid. A CEK-handle allocation carries only a fresh
opaque logical handle ID; it is not a provider handle, CEK, evidence ref, key
digest, or secret-derived value.
Ledger entries contain no owner secret, input digest/MAC/check/hint/location,
decoded-input digest, or derived output. Suite 4 may retain only its independently
random public artifact ID. Its salt persists only in the protected authenticated
slot source and never in this global comparison index. Transaction IDs are
noncircular values of the already qualified anchor/fence transaction primitive;
they are not allocation-ledger values and grant no authority.

Reservation and materialization are separate complete anchor-selected TC05
transactions before the value or handle is used and before UI/provider/custody/
target/external-effect work. The effect/terminal transition is another distinct
transaction. Thus rollback or crash cannot erase a used value. Once allocated,
an identifier is never reused, including after
denial, ambiguity, cancellation, crash, timeout, lost acknowledgement, anchor
conflict, or restore. Suite-4 owner input and its decoded secret representation
are never admitted or persisted; only the public label/artifact ID, protected
salt/source, independent attempt reservation, burn, transient decoded artifact
ID, input, and lifetime are charged to the exact TC04 phase and TC09 handoff.

Allocation history is append-only and independently reachable from every later
manifest. Before use, the complete canonical ledger (maximum 4096 entries) is
authenticated and scanned with a bounded exact-ID index charged in `Pre05`; no
caller subset or probabilistic filter proves uniqueness. Allocation ID and actual
allocated-value uniqueness are global across generations, crashes, and restore.
For every envelope, materialized `ENVELOPE_ID`/`CEK_ID` values byte-equal outer,
AAD, header, and KDF IDs; materialized `NONCE` byte-equals the exact 12-byte
protected-header IV; materialized `CEK_HANDLE` is a distinct opaque logical ID
byte-equal in AAD, final KDF context, provider-generation evidence, and CEK
evidence. All four materialized entries have distinct allocation IDs/kinds and
the same store/environment/suite as CEK evidence. Their reservation/materialized/
terminal refs byte-equal. Retry,
crash, or ambiguity burns CEK handle, CEK ID, IV, and envelope ID together. There
is no rollover:
exhaustion, wrap, missing predecessor, duplicate ID, or fork is
`UNAVAILABLE_REQUIRES_TC09_MIGRATION`, never reset or best-effort continuation.

Across reserve -> materialize -> terminal, allocation ID, sequence, kind, store,
environment, and suite are byte-identical; only the tagged transition changes.
Logical ID/IV materialization occurs once after reservation and no consumer uses
them until all four materialization CASes and local publishes finish. Qualified
provider generation then consumes that exact final context once and emits the
closed evidence chain described above. Crash before provider generation burns
without use; crash afterward burns before retry. Until TC10 resolves and
qualifies the provider-profile/session/entropy evidence bodies and their
`Record(T)`, provider generation and every dependent wrapper remain unavailable.

## 11. Rollback/fork anchor and recovery

The anchor is a separately qualified, rollback-evident trust mechanism outside
the mutable store root. Its interface is an authenticated read plus atomic CAS of
`(store_id, predecessor generation/root/token) -> (successor generation/root/
token)`. TC05 selects no TPM, OS keychain, remote service, or filesystem backend;
TC10 must qualify identity, atomicity, durability, authorization, availability,
clone/restore behavior, and recovery.

Local head behind the anchor permits only deterministic completion of that exact
anchored generation. Local head ahead of the anchor is unauthorized/corrupt and
blocks. An unselected same-generation root or second prepared successor is inert
forensic garbage and cannot mutate quarantine. Only a contradiction within the
exact anchor-selected root/object lineage can quarantine the selected generation.
A local file, timestamp,
Git object, backup, caller assertion, or majority of mutable copies never repairs
or overrides anchor evidence.

## 12. Quarantine

```cddl
store-quarantine-record-v1 = [
  "ECR.Quarantine/1",
  store_ref: store-ref-v1,
  admitted_generation: uint63,
  admitted_manifest_ref: store-generation-manifest-ref-v1,
  admitted_object_ref: read-set-canonical-body-ref-v1,
  reason: 1..12,
  detection_transaction_id: bstr .size 16,
  anchor_observation: rollback-anchor-observation-v1,
  prior_quarantine_ref: nil / store-quarantine-ref-v1
]
```

Only an object first proven a member of the complete authenticated admitted
manifest, with matching store/scope/generation, may cause mutation to quarantine
state. Caller input, malformed/unknown/duplicate/over-bound pre-admission data,
wrong-scope data, stale offline carriers, failed decrypts before admission, and
untrusted projections deny with zero store mutation and zero provider/crypto
work. The first qualifying contradiction appends an immutable quarantine record;
once the selected manifest lineage resolves a non-nil quarantine ref, every
later access returns that existing quarantined state with no new observation,
effect, record, provider call, or crypto operation.

The evidence identifies the exact first admitted object, but quarantine denial
scope is the entire selected production generation. Its first admitted KWP/GCM
integrity failure appends one record and every later object fails with zero crypto.
Quarantine never propagates silently to another generation/store. It does not
delete, rewrite, rename, or redact evidence. Clearing or migrating quarantine
is a later authenticated TC09 ceremony that creates a fresh generation; TC05 has
no reset switch.

## 13. TC04 phase interfaces and historical reachability

Platform `INITIALIZE_ROOT` is one all-or-none transaction containing exact TC04
bootstrap lineage, authentication evidence, authority, creation consumption
proof, initial staged slot/profile, receipt/history commitment, and generation-1
manifest, plus TC05 endpoint, allocation ledger, registry, and admission root.
Portable initialization adds the exact precommitted `CarrierBindingV1`. Proof,
non-digest transaction ID, effect, receipt, history, and manifest mapping satisfy
section 6 equality. Every crash cut exposes the complete set or none.

Generation-1 `ADD_RECOVERY_SLOT` and `CONFIRM_RECOVERY_SLOT` are separate
transactions with distinct exact TC04 authority, authentication evidence,
consumption proof, attempt, trusted-time/skew, and receipt/history/mapping, while
both reopen only the byte-identical admitted staged bootstrap-lineage source.
ADD publishes binding/source/staged slot/proof; CONFIRM publishes the exact
`CarrierConfirmationV1`, precommitted confirmation proof,
`CarrierCurrentnessV1`, receipt/history commitment, and mapping. Later portable
add/confirm follows the same distinct-set rule without bootstrap lineage. Missing,
mixed, inferred, duplicated, or partially visible members deny.

Creation, confirmation, development-omission, current-control, and recovery
records remain reachable after expiry, replacement, revocation, compaction, and
backup. Expiry changes eligibility, never history. Every child manifest preserves
the complete lineage needed to prove authority/currentness and cannot compress it
to a lossy summary.

All authority, authentication evidence, proof, trusted-time/skew evidence,
readback, profile/slot, current-control, omission, transaction, and manifest
records bind the exact same TC02 environment identity. Repository path, clone,
worktree, rename, origin, or panel classification cannot substitute.

The development-omission resolver is closed to `NOT_NEEDED`, `PRESENT_VALID`, or
`REQUIRED_MISSING_INVALID`. Ordinary/source-side creation/source-side confirmation
slot opens include it exactly when TC04 `NeedsDevelopmentOmission04` is true;
destination-only creation, creation confirmation, bootstrap, and recovery add
zero. A caller flag cannot change the classifier. Present omission includes the
authenticated one-use authority/evidence/proof/trusted-time/readback/consumption
transaction and exact manifest mapping; reuse or mismatch denies.

For current creation/confirmation ceremonies, the store snapshots exactly the
six TC04 current-control bodies for the phase, including current environment and
readback resolver outputs. Current environment and full owner readback may dedup
only by identical canonical digest already charged in that same phase. Live
authority, authentication evidence, and trusted time/skew never deduplicate;
semantic equality and cross-phase reuse never deduplicate.

The stored phase enum is closed to ordinary slot-open, `Create04` source,
`Create04` destination, `Confirm04` source, `Confirm04` staged/current, bootstrap,
recovery, and quarantine. Creation and confirmation carry separate source/
destination/current read sets and budgets. Any drift before publish restarts with
a new transaction and burns the prior attempt.

TC04 suite 4 remains owner-selected and never synthesized by TC05. Its exact
owner-selected label/input lifecycle, decoded-identifier bytes, salt, allocation,
attempt burn, transient buffers, nonpersistence, and zeroization are manifest-
accounted. TC05 stores only the public artifact ID, protected authenticated
salt/source, independent attempt reservation, and burn evidence—never any input,
input/check/digest/MAC/hint/derivative. It provides no
TC09 activation, recovery, migration, or provider authority.

## 14. Backup substrate and separate-location restore

```cddl
backup-domain-ref-v1 = [1,5,"BACKUP",bstr .size 16]
backup-chunk-envelope-ref-v1 =
  [1,2,"ECR-D1/ENVELOPE","ECR.BackupChunkEnvelope/1",sha256-v1]
backup-manifest-envelope-ref-v1 =
  [1,2,"ECR-D1/ENVELOPE","ECR.BackupManifestEnvelope/1",sha256-v1]
backup-freshness-policy-ref-v1 =
  [1,2,"ECR-D1/POLICY","ECR.BackupFreshnessPolicy/1",sha256-v1]
backup-freshness-policy-v1 = [
  "ECR.BackupFreshnessPolicy/1", time-profile-ref-v1,
  maximum_age: duration-v1, complete_epochs: epoch-vector-v1
]
backup-protected-header-v1 = {
  1: 3, 2: [-65537,-65538,-65539],
  3: "application/ecr-backup-chunk+cbor" /
     "application/ecr-backup-manifest+cbor",
  4: id128-v1, 5: bstr .size 12,
  -65537: 1, -65538: 5, -65539: 1
}
backup-chunk-aad-v1 = [
  "ECR.BackupChunkAAD/1", part_kind: "MANIFEST" / "DATA",
  backup_id: id128-v1, chunk_index: uint63-zero,
  chunk_count: uint63, envelope_id: id128-v1, cek_id: id128-v1,
  backup_domain_ref: backup-domain-ref-v1, backup_generation: uint63,
  recipient_ref: recipient-ref-v1, wrapping_generation: uint63,
  canonical_plaintext_length: uint63, wrapped_cek: bstr .size 40,
  logical_cek_handle_id: id128-v1,
  envelope_id_allocation_ref: allocation-entry-ref-v1,
  cek_id_allocation_ref: allocation-entry-ref-v1,
  cek_handle_allocation_ref: allocation-entry-ref-v1,
  iv_allocation_ref: allocation-entry-ref-v1,
  protected_header: backup-protected-header-v1
]
backup-chunk-kdf-context-v1 = [
  "ECR.BackupKwpContext/1", 1, 1, 5,
  part_kind: "MANIFEST" / "DATA",
  backup_id: id128-v1, chunk_index: uint63-zero, chunk_count: uint63,
  envelope_id: id128-v1, cek_id: id128-v1,
  backup_domain_ref: backup-domain-ref-v1, backup_generation: uint63,
  recipient_ref: recipient-ref-v1, wrapping_generation: uint63,
  canonical_plaintext_length: uint63,
  logical_cek_handle_id: id128-v1,
  envelope_id_allocation_ref: allocation-entry-ref-v1,
  cek_id_allocation_ref: allocation-entry-ref-v1,
  cek_handle_allocation_ref: allocation-entry-ref-v1,
  iv_allocation_ref: allocation-entry-ref-v1,
  protected_header: backup-protected-header-v1
]
backup-chunk-envelope-v1 = [
  aad: backup-chunk-aad-v1, cose: cose-encrypt0-v1
]
backup-object-v1 = [
  routing_id: bstr .size 16, object_kind: store-object-kind-v1,
  schema_registry_entry_id: uint .le 65535,
  canonical_length: uint .le 1048000,
  canonical_digest: digest-ref-v1,
  canonical_bytes: bstr .size (1..1048000)
]
backup-chunk-plaintext-v1 = [
  "ECR.BackupChunkPlaintext/1", chunk_index: uint63,
  objects: [1*256 backup-object-v1]
]
backup-chunk-descriptor-v1 = [
  chunk_index: uint63, object_count: 1..256,
  canonical_plaintext_length: uint63,
  ordered_plaintext_digest: digest-ref-v1,
  envelope_ref: backup-chunk-envelope-ref-v1
]

store-backup-generation-v1 = [
  backup_id: id128-v1,
  source_store_ref: store-endpoint-identity-ref-v1,
  source_generation: uint63,
  source_admission_root: store-admission-root-ref-v1,
  source_anchor_observation: rollback-anchor-observation-v1,
  chunks: [1*4096 backup-chunk-descriptor-v1],
  complete_object_count: uint63,
  created_time_ref: trusted-time-input-ref-v1,
  predecessor_backup_ref: nil / store-backup-manifest-ref-v1
]

store-backup-manifest-v1 = [
  backup: store-backup-generation-v1,
  complete_object_set_digest: digest-ref-v1,
  complete_source_manifest_ref: store-generation-manifest-ref-v1,
  freshness_policy_ref: backup-freshness-policy-ref-v1,
  backup_profile_ref: recovery-profile-ref-v1,
  recipient_ref: recipient-ref-v1
]

backup-public-locator-v1 = [
  "ECR.BackupPublicLocator/1", backup_id: id128-v1,
  chunk_count: uint63,
  encrypted_manifest_ref: backup-manifest-envelope-ref-v1
]

restore-candidate-v1 = [
  restore_id: bstr .size 16,
  backup_manifest_ref: store-backup-manifest-ref-v1,
  destination_endpoint_ref: store-endpoint-identity-ref-v1,
  verification_result: 1..2,  ; 1=verified-not-authorized, 2=rejected
  verified_source_anchor: rollback-anchor-observation-v1
]
```

A backup is a separately authenticated/encrypted immutable generation under an
independent backup-domain master and recipient. Every chunk has fresh envelope/
CEK/IV IDs and the exact TC03 production salt/HKDF/KWP/GCM relations, with its
canonical AAD and KDF context copied from the admitted outer values. DATA chunks
have contiguous indices `1..chunk_count`, at most 256 whole objects each and 4096
chunks; MANIFEST has index zero and its distinct media/ref. Each plaintext is at
most 1,048,687 bytes (TC03's ciphertext maximum less the 16-byte tag), and every
object's bytes/length/digest/routing/kind/schema byte-equal its source descriptor.
`complete_object_count` equals the checked sum of chunk object counts and is at
most 1,048,576. Their concatenated deterministic order/digest/count equals the complete
source manifest/index. Missing, duplicate, reordered, truncated, or extra chunks
reject.

The complete set includes every live and historical encrypted object, policy,
restriction/revocation/tombstone, allocation, manifest/history/receipt/proof,
audit commitment, custody/currentness/omission record, schema registry, and
quarantine evidence reachable from the selected source generation. Exact source
endpoint, generation, admission root, anchor observation, freshness policy,
profile, recipient, and predecessor are bound. Backup is never live authority, a
rollback anchor, an active store head, or proof of restore authorization. Until
TC09 closes backup authority/recipient/transport and TC10 qualifies this kind,
backup creation is unavailable.

Only `BackupPublicLocatorV1` is carrier-visible: random backup ID, count, and
encrypted-manifest reference. `StoreBackupManifestV1`, source endpoint/root/
anchor, profile, recipient, freshness, object identities, and chunks are inside
the encrypted index-zero manifest or DATA envelopes. The independently random
backup-domain master has the same later closed/qualified root-wrapped domain-slot
gate as metadata; a domain ref supplies no key material. Outer/AAD/header/KDF
allocation and value-equality rules are identical to section 7 and include
plaintext length. Missing CEK/IV/envelope materialization blocks.

Restore treats the carrier and destination as hostile and separate. It validates
endpoint/private root, the full backup and source manifest/history/anchor chains,
all wrappers/AAD/bounds, and complete object membership without mutating the live
store. Success yields only `VERIFIED_NOT_AUTHORIZED` in a segregated candidate
namespace. TC09 alone may authenticate authority, create fresh destination IDs/
allocations/wrappers, and atomically publish a new destination generation. A
restore never reuses a source store ID, generation, nonce, salt, label, fence,
allocation, or anchor token.

## 15. Exact resource accounting

For every imported or new body `T`, the schema registry records the exact TC03
`Max(T)` and `Record(T)` equation, including CBOR heads/tags, wrapper, protected/
unprotected headers, nonce/tag, AAD, reference, parser, canonical-comparison,
decoded-ID, salt, allocation/burn, readback, trusted-time/skew, anchor, transaction,
manifest, history/receipt/proof, and fsync bookkeeping buffers. Integer widths are
bounded by the inherited `uint63` rule.

For concrete canonical `x:T`, TC05 reuses TC03 exactly:

```text
record05(x) = 2*length(x) + Meta(x)
Record05(T) = max(rule-valid x:T){record05(x)}
WrapperPre05(w) = 2*length(w) + Meta(w) + length(a) + Meta(a) +
  length(c) + Meta(c) + length(h) + Meta(h) + cipher(w) +
  DomainResolveWorkspace05(w)
WrapperPost05(w,p) = WrapperPre05(w) + 2*length(p) + Meta(p)
Index05(q) = sum(page in q.pages_root_to_leaf){record05(page)} + record05(q)
MembershipProofResolve05(p) = record05(p)
ReadSetResolve05(r) = record05(r) +
  sum(m in r.members){
    MembershipProofResolve05(resolve(m.membership_proof)) +
    record05(resolve(m.canonical_body_ref))
  }
InternalEvidenceStandalone05(e) = record05(e) +
  ReadSetResolve05(resolve(e.common.read_set))
InternalEvidenceSource05(P) =
  case source(P).reason of
    ADMITTED_QUARANTINE -> record05(resolve(source(P).evidence_ref))
    BACKUP_SNAPSHOT     -> record05(resolve(source(P).evidence_ref))
    otherwise           -> 0
Resolve05(r,subject,access) = ReadSetResolve05(r) +
  EndpointInspectWorkspace05(subject,access)
```

`a/c/h` are the exact TC05 metadata or backup AAD/KDF/header productions and
`cipher(w)` is its ciphertext plus provider copy.
`DomainResolveWorkspace05(w)` is only the qualified provider/custody transient
workspace after excluding every resolved domain-slot/custody/allocation body
charged by `ReadSetResolve05` and every fresh materialization record charged by
`NewPre05/NewPost05`; it contains no body/reference alias. It is `UNAVAILABLE`
until those bodies and workspace terms are qualified. `Meta` is TC03's exact formula;
there is no fixed parser arena. Each page/body is counted once while simultaneously
live. A qualified inclusion proof replaces only the full resolver term it proves,
never selected body/wrapper/accounting.

`record05(r)` already charges every embedded selector/member once, and
`MembershipProofResolve05` charges its tagged direct/transitive proof or its
complete inline four-page current index proof once; neither term is added again
through `Index05`. `ReadSetResolve05` then charges each unique resolved body once.
The generated relational maximum is taken separately for every exact phase and
RequiredBodies04 branch. A one-body/multi-role member is one body/proof charge;
distinct canonical refs never deduplicate. Counts 1 and 256 have achievable
witnesses. A 257th body, 33rd role on one body, 8,193rd role, malformed maximum
stream, checked-sum overflow, exact branch budget minus one, or any canonical
byte/item overage returns `UNAVAILABLE` before provider/root work.

`RequiredInternalBodies05(e)` is branch-specific, never a union sum. Every
branch includes the common store, environment, endpoint, access, fence,
read-set-anchor, and all transitive bodies. Allocation additionally selects the
three entries and each selected anchor/manifest/root plus the prior terminal
intent/effect/receipt/history/manifest/root. Crash additionally selects its
prior tuple, both closed crash-state bodies, and their shared anchor
observations. Quarantine additionally selects admitted root/manifest, the full
descriptor's referenced registry/location/object bodies, and every body selected
by its exact tagged cause. A failure cause adds its subject, qualified failure
evidence, provider/profile/session, envelope, and typed admitted-object bodies.
A manifest contradiction adds its authenticated comparison evidence and the
bodies referenced by the embedded root/manifest comparison. A descriptor
contradiction adds its authenticated comparison evidence and bodies selected by
both embedded `PRESENT` proofs. The observation's descriptor/proof and each
comparison body's inline canonical structures are embedded and charged by the
containing `record05`; their separately referenced bodies are read-set members.
There is no absence proof: the admitted manifest body itself is a member and its
`quarantine_ref` is literal `nil`. The new quarantine-record body/descriptor is
a current-effect output, never an observation dependency, and is charged exactly
once in the applicable `NewPre05/NewPost05` set. Backup
additionally selects source endpoint/access/root/manifest/index/anchor,
freshness policy, trusted-time/skew, store profile, and recipient. The exact
members of `resolve(e.common.read_set)` are the unique canonical body refs in
that selected closure; there are no extras, omissions, generic refs, or the
branch body itself. Thus `ReadSetResolve05` charges every body and proof once.
Duplicate typed refs within one branch charge once only when canonical bytes are
identical and simultaneously one live copy; cross-branch or semantic equality
never deducts. `Max05` and `Record05` are generated independently for each of
the four relational branches. `InternalEvidenceStandalone05` uses its own exact
read-set resolver. A live quarantine/backup transaction uses the same selected
`ReadSetResolve05` for every dependency and `InternalEvidenceSource05` for the
excluded current evidence body exactly once; allocation/crash source cost is
always zero because source use is invalid. A live backup read set additionally
contains and charges exactly one current `TC09_AUTHORITY` member. The authority
is not part of the observation body or `InternalEvidenceSource05`; the intent's
source row persists both exact refs, and receipt/history/manifest mappings bind
that complete source row. Zero, two, a prior authority, or a separately charged
authority alias is invalid.

For each exact branch type `T` in
`{StoreAllocationAuditEvidenceV1, StoreCrashCompletionAuditEvidenceV1,
StoreAdmittedQuarantineObservationV1, StoreBackupSnapshotObservationV1}` the
generated ledger records, separately and with checked arithmetic,
`Max05(T)=max(rule-valid x:T){length(x)}`,
`Record05(T)=max(rule-valid x:T){record05(x)}`, and
`Standalone05(T)=max(rule-valid x:T){InternalEvidenceStandalone05(x)}`.
Each maximum has its own canonical witness satisfying that branch's relation;
there is no union-sum or synthetic witness combining fields from two branches.
The quarantine branch ledger also generates independent exact
`Max05/Record05` rows for `StoredObjectFailureSubjectV1`,
`QualifiedStoredObjectFailureEvidenceV1`,
`AuthenticatedManifestContradictionEvidenceV1`,
`AuthenticatedDescriptorContradictionEvidenceV1`, and `StoreQuarantineRecordV1`,
then takes one reachable cause branch at a time. Inline proof/page/body bytes and
provider-session comparison workspace are included once; unavailable TC10
provider output is not assigned a zero-sized placeholder.

Let `Imported04(P)` select exactly one frozen TC04 branch, never a sum of branches:

```text
ORDINARY_PRE(x)      -> Pre04(x)
ORDINARY_POST(x)     -> Post04(x)
CREATE(x)            -> Create04(x)
CONFIRM(x)           -> Confirm04(x)
BOOTSTRAP(x)         -> exact INITIALIZE_ROOT branch of Create04(x)
RECOVERY_VERIFY(x)   -> exact TC04 recovery-present Post04(x)
```

The source, destination, staged/current, omission-present/zero, suite-4, and
current-control subphase is the exact mutually exclusive term already selected
inside that frozen expression. Define `Imported04MemberTerms(P)` as every
canonical `Record(T)` occurrence in that frozen expression whose typed ref is a
member of the selected read set. The checked partition is:

```text
Imported04Workspace(P) = checked_sub(Imported04(P),
                                     Imported04MemberTerms(P))
```

It retains only frozen provider/input/parser/Argon/decrypted-copy workspace and
no member body/reference. The subtraction must be exact, nonnegative, and
generated from the same branch; missing or extra terms are invalid.

For each live phase, `NewPre05(P)` and `NewPost05(P)` contain only fresh
transaction/reservation/output objects and output wrappers not selected by the
read set: proposed intent/effect/history/receipt/proof-mapping/manifest/admission
records, new allocation transitions, canonical output, and pending head bytes as
applicable. Parent endpoint/anchor/root/manifest/index/member bodies, source
wrappers, and every other `RequiredBodies04` ref are excluded. Generated
constants are:

```text
StorePre05(P) = EndpointInspectWorkspace05(subject(P),access(P)) +
                ReadSetResolve05(selected_read_set(P)) +
                InternalEvidenceSource05(P) +
                checked_sum{Record05(t) for nonwrapper t in NewPre05(P)} +
                checked_sum{WrapperPre05(w) for w in new_wrappers_pre(P)}
StorePost05(P) = EndpointInspectWorkspace05(subject(P),access(P)) +
                 ReadSetResolve05(selected_read_set(P)) +
                 InternalEvidenceSource05(P) +
                 checked_sum{Record05(t) for nonwrapper t in NewPost05(P)} +
                 checked_sum{WrapperPost05(w,p) for (w,p) in new_wrappers_post(P)}
Pre05(P)  = Imported04Workspace(P) + StorePre05(P)
Post05(P) = Imported04Workspace(P) + StorePost05(P)
```

`NewPre05(P)` and `NewPost05(P)` are disjoint from every read-set member by
complete typed-ref equality, from any current `InternalEvidenceSource05` body,
and from endpoint workspace by construction. If a
purported new term aliases any member ref, it is invalid rather than separately
charged. Thus `Resolve05`, `ORDINARY_PRE`, `ORDINARY_POST`,
`CREATE`, `CONFIRM`,
`BOOTSTRAP`, and `RECOVERY_VERIFY`, including every source, destination, staged,
current, omission-present/zero, suite-4, quarantine, backup, crash, allocation,
and later-authority live-store branch, charge `EndpointInspectWorkspace05`
exactly once.
The same branches charge `ReadSetResolve05` for the exact selected read set
exactly once and never add `Record05(StoreReadSetV1)` separately.
Quarantine/backup branches additionally charge their excluded current
`InternalEvidenceSource05` body exactly once; all other branches charge zero.
Neither `Imported04Workspace`, `DomainResolveWorkspace05`, `WrapperPre05`,
`WrapperPost05`, nor `Index05` contains either term or a member-body alias.
Instrumentation must
report count one for each unique member body/proof, the selected read-set
resolver, endpoint workspace, and applicable current internal-evidence body;
zero or two is an invalid equation before provider/root/CAS work. A phase uses either its
selected `Resolve05` expansion or the corresponding explicit `StorePre05`/
`StorePost05` expansion; it never adds those two representations together.

`NewPre05/NewPost05(P)` are generated separately for ordinary pre/post, Create source/destination,
Confirm source/staged/current, bootstrap, recovery verification, omission present/
zero, and each current-ceremony phase. No branch may use a union/sum upper bound.
Every `Max`, `Meta`, `Record`, `Index05`, `Store05`, `Pre05`, and `Post05` maximum
has a rule-valid relationally achievable constructor. The phase gate reserves
the generated exact value before root/provider work; exact budget succeeds and a
one-byte-over body, page, environment/readback, wrapper, allocation, or suite-4
workspace denies before that boundary. An imported TC04 record authenticated in
the pre-root plane is charged only by `ReadSetResolve05`; its simultaneously live
root-decrypted sensitive comparison copy is an exact named
`Imported04Workspace` byte term, never another `Record(T)` or member alias.
Provider copies stricter than TC03 are named workspace terms. TC09 owns final
combined runtime peak and activation.

### 15.1 Checked-in `TC05-BOUND-I1` generated ledger

This subsection is the normative, checked-in I1 bound ledger. Its identity is
`TC05-BOUND-I1/e640293c47525f3c9b86674d28fbce81e95bc44b125ecaa70c56c81bb84f0dea`.
The bound inputs and reproducibility evidence are:

| Input | SHA-256 / exact construction |
| --- | --- |
| Combined CDDL | `494ed54864c2ad40312caee04e9d897b4ddf3a2bb11c3e45a8148e543f8f865a`; concatenate, in TC02, TC03, TC04, TC05 order, every complete `cddl` fenced payload and one LF after each payload. |
| Current rules projection | `ec12dc404dcc97893fdf645fd6bcf2a266dd2187efb91590d89d3d576326006e`; exact projection algorithm is frozen in the independent verifier and masks only the exact self/binding hashes, per-row generated numeric/hash cells, selected-overall generated numeric/hash cells, four generated blocker measurements, and generated row count; all rule words, table identities/order, branch identities, limits, statuses, and prose remain hashed. |
| Generator/version | [`tc05-bound-i1-generator.mjs`](ecr-tc05-bound-i1/tc05-bound-i1-generator.mjs), `tc05-bound-i1-gen/1`; source SHA-256 `49a47da08e1744587a0acdf4fff95bee27bc4eaa5f27de3c40c3ab00e9d36162`. |
| Independent verifier/version | [`tc05-bound-i1-verifier.mjs`](ecr-tc05-bound-i1/tc05-bound-i1-verifier.mjs), `tc05-bound-i1-verify/1`; source SHA-256 `d0cead71553b0878a757cb2cc63d34922beb271294ba98ae9f818934dd5b73ca`. It imports no generator or shared encoder, tree walker, `Meta`, or accounting implementation. |
| Ordered recipes | [`tc05-bound-i1-recipes.jsonl`](ecr-tc05-bound-i1/tc05-bound-i1-recipes.jsonl); 81 LF-terminated canonical one-line JSON recipes, SHA-256 `a58e31f59c466f252b8d493adcb22fcf893012717a5faf11c44baf962bba1665`. |
| Ordered witness/trace corpus | [`tc05-bound-i1-traces.jsonl`](ecr-tc05-bound-i1/tc05-bound-i1-traces.jsonl); 81 LF-terminated canonical one-line JSON recipe+metric traces, SHA-256 `d16d28ee0617b328c086058d320b005276563e8defcc9943c624460870c02282`. |
| Canonical binding manifest | [`tc05-bound-i1-manifest.json`](ecr-tc05-bound-i1/tc05-bound-i1-manifest.json); exact one-line JSON plus LF; its file SHA-256 is the ledger identity above. |

Each recipe has an ordinal, schema, relational branch, constructor ID, and
complete constructor arguments. Either source reconstructs the exact witness
bytes with `--witness <constructor_id>` and emits the bound trace with
`--trace <constructor_id>`. `TRACE_JSONL=1` rebuilds the entire ordered corpus.
The verifier independently encodes, walks, accounts, hashes, and compares the
same fixtures; `--verify-bundle <manifest> <candidate>` additionally verifies
canonical manifest bytes, every artifact digest, the full corpus byte-for-byte,
the current rules projection, combined CDDL, row count, and candidate ledger
identity. It parses all 81 normative Markdown rows in order, rejects
add/remove/duplicate/reorder, recomputes each arithmetic relation, compares
every numeric/hash cell to its independently reconstructed fixture, and does
the same for all 27 selected-overall rows. Its built-in negative suite mutates
numeric, hash, arithmetic, order, cardinality, selection, and rule-word fields.
No fixture contains a credential, secret, key, plaintext digest, or
provider/store operation.

The generator is a fixed-constructor fixture emitter. For each of the 81
enumerated recipe keys it constructs exactly one hand-specified candidate
witness, encodes it as deterministic CBOR, and reports that witness's metrics.
It does **not** parse CDDL, enumerate the complete rule-valid solution space,
solve constraints, reparse CBOR, or prove that a witness is a true schema or
relational maximum. The independent verifier reconstructs and measures the
same fixed fixtures with separate encoding/accounting code; agreement proves
reproducibility and detects document/artifact drift, not maximality or schema
validity. Consequently every `*_max_*`, `Max`, `Record`, and selected-overall
label in this provisional I1 ledger is a *claimed bound attached to that fixed
fixture* and remains unavailable for qualification until later independent
CDDL/relational maximum proof accepts it. For every row,
`Meta = 64 + 32*Items + 16*Pairs + 8*Depth`. Columns `C` and `Rin` are
`canonical_max_bytes` and `record_max_input_bytes`; `I/P/D/M/Rout` are the
record witness's items, pairs, depth, meta, and final `Record` bytes. In this
corpus each fixed constructor supplies the same witness to the canonical and
record calculations, so `W-SHA` is normatively both
`canonical_max_witness_sha256` and `record_witness_sha256`; that equality is a
fixture-construction fact, not an independent maximization result.

| Schema | Branch | C | Rin | I | P | D | M | Rout | W-SHA |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `EndpointInspectorProfileV1` | `WINDOWS` | 374 | 374 | 32 | 0 | 3 | 1112 | 1860 | `2b297c0fa8ef847ab43726cacfdfbbec58052aeb51bcf9c8e710301b530a8c0a` |
| `EndpointInspectorProfileV1` | `LINUX` | 387 | 387 | 32 | 0 | 3 | 1112 | 1886 | `78e2548b6b5aec62ccc9ace85f18fd909798e3612454c4d3d3b76391287e9f7f` |
| `EndpointInspectorProfileV1` | `MACOS` | 374 | 374 | 32 | 0 | 3 | 1112 | 1860 | `13e99437704349211352b54a80412dd529715ac997e2f02e5b5b72165760bc6d` |
| `EndpointOwnerSubjectMappingV1` | `WINDOWS` | 627 | 627 | 50 | 0 | 3 | 1688 | 2942 | `26ee880d927a0124ee813a99ab0ca2a6a400220993b5bcb2539397350b69ee5c` |
| `EndpointOwnerSubjectMappingV1` | `LINUX` | 625 | 625 | 50 | 0 | 3 | 1688 | 2938 | `e371ae527e3317aba8f30ca53f8ff08562c4e89d0cd79983cdd4a9f030fb36a7` |
| `EndpointOwnerSubjectMappingV1` | `MACOS` | 625 | 625 | 50 | 0 | 3 | 1688 | 2938 | `e26058935db6e43b8ea01197202d6d790d53a99ac8ee7a317d59ae8097c91e1f` |
| `EndpointInspectionSubjectV1` | `WINDOWS` | 300497 | 300497 | 200 | 0 | 4 | 6496 | 607490 | `f7676c2cb7b5a9cb3b7caaa34cbb8181e16ee88653c0eaa235e4f7afc8ad8c68` |
| `EndpointInspectionSubjectV1` | `LINUX` | 300473 | 300473 | 200 | 0 | 4 | 6496 | 607442 | `eb92ee7fd311d6ff6c4b539b42aafabf900f187aca951f2b495932e403275773` |
| `EndpointInspectionSubjectV1` | `MACOS` | 300449 | 300449 | 200 | 0 | 4 | 6496 | 607394 | `7af89a47116b315c52660647a4a32fee173133c5c6419744f010b411c2a14675` |
| `EndpointSessionOutputEvidenceV1` | `WINDOWS` | 861 | 861 | 72 | 0 | 3 | 2392 | 4114 | `99a47db3a2d5a47f8ffc8fed95451233fb9f1a010b8472fbb02a5debdb7b230a` |
| `EndpointSessionOutputEvidenceV1` | `LINUX` | 859 | 859 | 72 | 0 | 3 | 2392 | 4110 | `87224c0ef92cb472229d8db5a4867292fec2217b033aad8643b147c5a8c8174c` |
| `EndpointSessionOutputEvidenceV1` | `MACOS` | 859 | 859 | 72 | 0 | 3 | 2392 | 4110 | `a4d1382607fa997b3c06ba915653806e701ee2e7e8c784d2a01bfb18e0c6c797` |
| `StoreEndpointIdentityV1` | `WINDOWS` | 1073 | 1073 | 53 | 0 | 3 | 1784 | 3930 | `c6a31f99af2dde30a44383a40a126ac667688115cfec40294b55da93ba5540d0` |
| `StoreEndpointIdentityV1` | `LINUX` | 1071 | 1071 | 53 | 0 | 3 | 1784 | 3926 | `505d47e7e7f9214fc332ce5cf9afbefa13d0a2a9878f45d29ed3c1dd24a69ee1` |
| `StoreEndpointIdentityV1` | `MACOS` | 1071 | 1071 | 53 | 0 | 3 | 1784 | 3926 | `64450d8cafc72594a8a47be26bbc0bd30dfcc8989684df4b3db8253e9ee8fd03` |
| `EndpointRawObservationV1` | `WINDOWS/PRE_OPEN` | 74803 | 74803 | 22 | 0 | 2 | 784 | 150390 | `c2360dac287aac99c1c975e8ee2afd1ea2bc3efc4cefcd7f0976b13b7af13736` |
| `EndpointRawObservationV1` | `WINDOWS/POST_OPEN` | 74804 | 74804 | 22 | 0 | 2 | 784 | 150392 | `3a9433b2d1fb41378e9f9d6e4f4c93fac0ae8e65edca142bf28ba7e0e32bb564` |
| `EndpointRawObservationV1` | `WINDOWS/PRE_NAMESPACE_REVALIDATION` | 74822 | 74822 | 22 | 0 | 2 | 784 | 150428 | `6574f94be061456ac896425d3f5f410e73a3522f24f91f0268d1a0fd7d14374c` |
| `EndpointRawObservationV1` | `WINDOWS/POST_NAMESPACE_REVALIDATION` | 74823 | 74823 | 22 | 0 | 2 | 784 | 150430 | `909c1902d20d29891609598a46914d605b89f0a72bd7fe60055487207bf115ce` |
| `EndpointRawObservationV1` | `LINUX/PRE_OPEN` | 74798 | 74798 | 22 | 0 | 2 | 784 | 150380 | `ed6c728e6b475709736e8ceb8e58619bbb9e326e83702cdec9ccc0a4406e0cfd` |
| `EndpointRawObservationV1` | `LINUX/POST_OPEN` | 74799 | 74799 | 22 | 0 | 2 | 784 | 150382 | `65b020478c2c5eb4ceda22a2de9eeca24cfc99c1690cdc477436cb2dc62ee52c` |
| `EndpointRawObservationV1` | `LINUX/PRE_NAMESPACE_REVALIDATION` | 74817 | 74817 | 22 | 0 | 2 | 784 | 150418 | `1237aaa80a6482bd4a90a8adc2ee2bbb6fa217e1e595891bd761e7c85527d28e` |
| `EndpointRawObservationV1` | `LINUX/POST_NAMESPACE_REVALIDATION` | 74818 | 74818 | 22 | 0 | 2 | 784 | 150420 | `f3d4247b1b57ec8710c8ce1573d13c90ea6357efb2da3d75e63037e07a932690` |
| `EndpointRawObservationV1` | `MACOS/PRE_OPEN` | 74792 | 74792 | 22 | 0 | 2 | 784 | 150368 | `020bb5936867cec4508d1f5452a737f7747fc65e8f79d95db0a0f3f39d64546e` |
| `EndpointRawObservationV1` | `MACOS/POST_OPEN` | 74793 | 74793 | 22 | 0 | 2 | 784 | 150370 | `5579bce054414127fb1005fff572a9538072ef5991de883cb39b4a20876c8a80` |
| `EndpointRawObservationV1` | `MACOS/PRE_NAMESPACE_REVALIDATION` | 74811 | 74811 | 22 | 0 | 2 | 784 | 150406 | `6476c60a9644683bc0e8b4f64ede2419aefbc38aaa05c43c83bfc8198a0aedb2` |
| `EndpointRawObservationV1` | `MACOS/POST_NAMESPACE_REVALIDATION` | 74812 | 74812 | 22 | 0 | 2 | 784 | 150408 | `b2c2957041d84533f3aeadb262be8e8b2f2cb4a8829b2b52204328eee60fa997` |
| `StoreEndpointAccessEvidenceV1` | `WINDOWS/PLATFORM_ACL` | 67483 | 67483 | 3972 | 0 | 7 | 127224 | 262190 | `efd4fecbd349406871351b46b5b82fb69b693b5156c3762b8e094d5c66041262` |
| `StoreEndpointAccessEvidenceV1` | `LINUX/POSIX_MODE` | 67485 | 67485 | 3976 | 0 | 7 | 127352 | 262322 | `8516ec3e1792ba909cd85dc33fb8b6ac985d15fade417fbaf37ae7d848ed8b56` |
| `StoreEndpointAccessEvidenceV1` | `MACOS/PLATFORM_ACL` | 67481 | 67481 | 3972 | 0 | 7 | 127224 | 262186 | `f82a0483bfb52343921f0676e594e02a8254c22ae7276a2523411a2bc688769c` |
| `EndpointPermissionsV1` | `POSIX_MODE` | 15993 | 15993 | 970 | 0 | 4 | 31136 | 63122 | `8977a6665fce12d165f446371c13bed451b2d4a51dcc9593d5ab7fb2ce252ada` |
| `EndpointPermissionsV1` | `PLATFORM_ACL` | 15992 | 15992 | 969 | 0 | 4 | 31104 | 63088 | `192353a6bdec27834c0f736db26765c3d8cce1a4085e04547baaf6cf2129152b` |
| `EndpointObjectObservationV1` | `POSIX_MODE/PRE_OPEN` | 16771 | 16771 | 986 | 0 | 5 | 31656 | 65198 | `cc8bdd015099fe77cfae7d45c74cca84cf0d1814e82264aaa2677e732548d6ad` |
| `EndpointObjectObservationV1` | `POSIX_MODE/POST_OPEN` | 16772 | 16772 | 986 | 0 | 5 | 31656 | 65200 | `5857191453c6c52819ac8a67c81207863676dbd4c9edd7f3fb31155c97e445fb` |
| `EndpointObjectObservationV1` | `POSIX_MODE/PRE_NAMESPACE_REVALIDATION` | 16790 | 16790 | 986 | 0 | 5 | 31656 | 65236 | `838ce74a60ff8e98c89d0a0d9da69193aabf19c8b25e54477483c7eed44bcca2` |
| `EndpointObjectObservationV1` | `POSIX_MODE/POST_NAMESPACE_REVALIDATION` | 16791 | 16791 | 986 | 0 | 5 | 31656 | 65238 | `a4923ef30fcafa20c48dbe47a9d8bb5fd508b6785e629df87258a49bd358259b` |
| `EndpointObjectObservationV1` | `PLATFORM_ACL/PRE_OPEN` | 16770 | 16770 | 985 | 0 | 5 | 31624 | 65164 | `39e39cc6dca9ba0848456cae84fdf6475a311d49efcaa8327edb2ab1cd846806` |
| `EndpointObjectObservationV1` | `PLATFORM_ACL/POST_OPEN` | 16771 | 16771 | 985 | 0 | 5 | 31624 | 65166 | `b26d577ed3592dffd9d714c9df04648ddc622773e658ed9880f6dd9a87a359b1` |
| `EndpointObjectObservationV1` | `PLATFORM_ACL/PRE_NAMESPACE_REVALIDATION` | 16789 | 16789 | 985 | 0 | 5 | 31624 | 65202 | `69cf81a808c6e50ac0c1bd8dffbce598397b1ee05b6ab1a9009ef58d872d31f1` |
| `EndpointObjectObservationV1` | `PLATFORM_ACL/POST_NAMESPACE_REVALIDATION` | 16790 | 16790 | 985 | 0 | 5 | 31624 | 65204 | `2a96819f40f65c84f1e449f396f053d497636f0f3d6b71e2dc751245eb820f8f` |
| `EndpointInspectionAuthenticationEvidenceV1` | `AUTHENTICATED` | 519 | 519 | 40 | 0 | 3 | 1368 | 2406 | `a5f3c70b11d354f378029def66284d06c0eeb3adea8c6e8dce907a41e2b7c835` |
| `QualifiedEndpointInspectionEvidenceV1` | `QUALIFIED_COMPLETE` | 272 | 272 | 16 | 0 | 2 | 592 | 1136 | `82b69483e805840cdd56c92d59917dd54145ba0cab956896ea9884d8af734d81` |
| `WriterFenceEvidenceV1` | `ACQUIRED_EXACT_PREDECESSOR` | 571 | 571 | 36 | 0 | 2 | 1232 | 2374 | `5ebea0e59b4f039da207ccb54c0cb56165ebf2e4d3723d21e2c81427d03e8728` |
| `TC04PhaseV1` | `ORDINARY_SLOT_OPEN/PRIMARY` | 404 | 404 | 40 | 0 | 4 | 1376 | 2184 | `85db96a8739d58b8fda84940b02ea866bf05b27abf503c7b783cc383652d2926` |
| `TC04PhaseV1` | `ORDINARY_SLOT_OPEN/OMISSION_ZERO` | 318 | 318 | 34 | 0 | 3 | 1176 | 1812 | `a1cebdd5915ab469b033bb772fd57c19e0f4855d1abbf3f34a6f1d0f27c97f20` |
| `TC04PhaseV1` | `CREATE_SOURCE/PRIMARY` | 1498 | 1498 | 137 | 0 | 5 | 4488 | 7484 | `c7aa7513a53d653789ac49f8046214e2d75d22fb65597f0ee1afe9c152f636c9` |
| `TC04PhaseV1` | `CREATE_SOURCE/OMISSION_ZERO` | 1412 | 1412 | 131 | 0 | 5 | 4296 | 7120 | `95065b8af6861e37f41ad874ccd73f9bbbb5a6f5901107e7893ccf7a0d82cbae` |
| `TC04PhaseV1` | `CREATE_DESTINATION/PRIMARY` | 1422 | 1422 | 131 | 0 | 5 | 4296 | 7140 | `2921644481302e586843053c6c0070baae9abf0f6bc146b65ee99264d16b0f78` |
| `TC04PhaseV1` | `CONFIRM_SOURCE/PRIMARY` | 1504 | 1504 | 137 | 0 | 5 | 4488 | 7496 | `4f610339b3388462f38239530a55186b45f59750393a11edfbf288e01abc0ab6` |
| `TC04PhaseV1` | `CONFIRM_SOURCE/OMISSION_ZERO` | 1418 | 1418 | 131 | 0 | 5 | 4296 | 7132 | `739bb01d3f0a3476361a8b70e9ffde3803a2d61a6fb5f15d79e57008e987303e` |
| `TC04PhaseV1` | `CONFIRM_STAGED/PRIMARY` | 1418 | 1418 | 131 | 0 | 5 | 4296 | 7132 | `46d5e9aff2e7851b8276ac1499e86e242b7c9c5554e124ea3a3c34cdef9a3867` |
| `TC04PhaseV1` | `CONFIRM_CURRENT/PRIMARY` | 1420 | 1420 | 131 | 0 | 5 | 4296 | 7136 | `7ad61d5c51f2d76ec21d53182f70b257ffce0157c0f6e94fa1663a389296f02d` |
| `TC04PhaseV1` | `INITIALIZE_ROOT/PRIMARY` | 595 | 595 | 51 | 0 | 3 | 1720 | 2910 | `19a536c225e38e28607285e5d0eec391d7ce438a6301344b79f738ddfa633cac` |
| `TC04PhaseV1` | `RECOVERY_VERIFY/PRIMARY` | 387 | 387 | 38 | 0 | 3 | 1304 | 2078 | `46b74d1172a2d86632bf260c7409dc09e5d5823f453593d6542679dbb70d1545` |
| `TC04PhaseV1` | `QUARANTINE/PRIMARY` | 388 | 388 | 37 | 0 | 3 | 1272 | 2048 | `69b483cc72ab99e8726122c9b01bfc1e77e6840c9c2519e371b2d87eaca0a216` |
| `ReadSetAnchorObservationV1` | `TRUSTED` | 332 | 332 | 18 | 0 | 3 | 664 | 1328 | `c889c54e52ac5f6b1fe93e3745567d77342757b5fdcc75a51a393a96ccaac804` |
| `ReadSetMembershipProofV1` | `INDEX_PRESENT` | 146288 | 146288 | 11838 | 0 | 10 | 378960 | 671536 | `5bfd47c48249e1781ade03b1d2a289f73ac9aa5fc5bcb8adb676ba80eab166a8` |
| `ReadSetMembershipProofV1` | `TRANSITIVE_REFERENCE` | 662 | 662 | 43 | 0 | 3 | 1464 | 2788 | `de6e0d8b29c8d4a02c9ef1738ed3de9c7dca6c9b3543837a724c13afae5884a5` |
| `ReadSetMembershipProofV1` | `READ_SET_DIRECT` | 507 | 507 | 37 | 0 | 2 | 1264 | 2278 | `d6c06eb550564eb4a1e3566224790c58a8ec8bd8319ca08b2d553f3372f02da8` |
| `StoreReadSetV1` | `CAP_256_MEMBERS_8192_ROLES` | 1434090 | 1434090 | 77401 | 0 | 6 | 2476944 | 5345124 | `18a2d93b1caabf259a184259b1643530c0aa0956fd7d0385ecf7518a45839302` |
| `StoredObjectFailureSubjectV1` | `KWP` | 1154 | 1154 | 86 | 0 | 4 | 2848 | 5156 | `69c9c2d74267cb31a7a7b68401897d3a7edb571bb7278b0d9b35eec5385b2f13` |
| `StoredObjectFailureSubjectV1` | `GCM` | 1155 | 1155 | 86 | 0 | 4 | 2848 | 5158 | `9f390e9a4d14ca886c617712b166b2d90c980216de3fa9c0077e74a921a2b132` |
| `QualifiedStoredObjectFailureEvidenceV1` | `KWP` | 1312 | 1312 | 94 | 0 | 4 | 3104 | 5728 | `c95595c40284b91d925fa650efa2f010bb2f4a7ea26a59e4182eb05b703a1dd4` |
| `QualifiedStoredObjectFailureEvidenceV1` | `GCM` | 1313 | 1313 | 94 | 0 | 4 | 3104 | 5730 | `313f8fcbbab7f6c7a3ea47442cfdd8aeef62a34c1e803f1b86334bb4b4b518ef` |
| `AuthenticatedManifestContradictionEvidenceV1` | `ROOT_STORE` | 26497 | 26497 | 1792 | 0 | 5 | 57448 | 110442 | `eed94b06a4b3e36646f00dba665cfad3296c891433cd2468bcee06dd236e7c77` |
| `AuthenticatedManifestContradictionEvidenceV1` | `ROOT_GENERATION` | 26502 | 26502 | 1792 | 0 | 5 | 57448 | 110452 | `62a1d69e423b90c5349c2fd99517941225d17da7806b472dce38e11cf363d431` |
| `AuthenticatedManifestContradictionEvidenceV1` | `MANIFEST_STORE` | 26501 | 26501 | 1792 | 0 | 5 | 57448 | 110450 | `871d008dc9efff73cd74a4ee1849a31fb7391f9e05b601af75141a8d91f4cc93` |
| `AuthenticatedDescriptorContradictionEvidenceV1` | `DUPLICATE_ROUTE` | 292936 | 292936 | 23692 | 0 | 9 | 758280 | 1344152 | `e516f15fc2ee9979e0bdc1c6f8ebd496678418af4066bcfd1e7eb055c646c92d` |
| `StoreAllocationAuditEvidenceV1` | `ALLOCATION` | 2118 | 2118 | 169 | 0 | 4 | 5504 | 9740 | `3932e0b0fd129f3ba43e145aaa39608bffef3ed570a5fbf45264186302fa6145` |
| `StoreCrashCompletionAuditEvidenceV1` | `CRASH_COMPLETION` | 1322 | 1322 | 105 | 0 | 4 | 3456 | 6100 | `e8cfa9e09e1c4e2651f00d58689a792b48a9d065a06545ac491e6cc41ec93f6e` |
| `StoreAdmittedQuarantineObservationV1` | `KWP_INTEGRITY` | 147227 | 147227 | 11905 | 0 | 10 | 381104 | 675558 | `108abec2df9a7d467888f8d1eee254b16a42aefe0eec33cdc909d5cba03e184f` |
| `StoreAdmittedQuarantineObservationV1` | `GCM_INTEGRITY` | 147227 | 147227 | 11905 | 0 | 10 | 381104 | 675558 | `3322cef22603182e3e904e927293ff695736bbe9820e3492ab78561d1b1c4650` |
| `StoreAdmittedQuarantineObservationV1` | `MANIFEST_CONTRADICTION` | 147242 | 147242 | 11905 | 0 | 10 | 381104 | 675588 | `38bd8870873b330131841d91361f59efaae4e8a277f46bdd905a6861fc328220` |
| `StoreAdmittedQuarantineObservationV1` | `DESCRIPTOR_CONTRADICTION` | 147247 | 147247 | 11905 | 0 | 10 | 381104 | 675598 | `8f376bc22b8564e0351cd49b7c4905b8f33fa6e3671bd28f9949b57d3f5a119d` |
| `StoreBackupSnapshotObservationV1` | `BACKUP_SNAPSHOT` | 1567 | 1567 | 133 | 0 | 4 | 4352 | 7486 | `cb2654488e459be923186bf1d89fe6084fd84babf15f4d240afe963d0d44c2e9` |
| `StoreQuarantineRecordV1` | `PRIOR_NIL` | 583 | 583 | 39 | 0 | 3 | 1336 | 2502 | `2dca34139e97cb4178a8afb24af3c10d06e2d52b3a1da660d685b7960d006e4a` |
| `StoreQuarantineRecordV1` | `PRIOR_PRESENT` | 656 | 656 | 44 | 0 | 3 | 1496 | 2808 | `4a606841840052778d8dee8a0f72ef4b3a5e1f65dc7185d460e0f057c0a75100` |
| `QualifiedProviderGenerationEvidenceV1` | `METADATA` | 749 | 749 | 65 | 0 | 3 | 2168 | 3666 | `6ffa7ceb51b2dba9a6b4d173c7a1f93a236a6f4a2e2327b15c5845d86b6a32cb` |
| `QualifiedProviderGenerationEvidenceV1` | `BACKUP` | 733 | 733 | 64 | 0 | 3 | 2136 | 3602 | `cb5b41f3d9870134bfd6fe2ec1a0f434fc844149ef838a9694fb8e55d32e58c2` |
| `CekGenerationEvidenceV1` | `METADATA` | 838 | 838 | 72 | 0 | 3 | 2392 | 4068 | `e938d137728cb065a77431448e2f7a4d72ee110c1fbd7fa0322dec4950ee2ec0` |
| `CekGenerationEvidenceV1` | `BACKUP` | 822 | 822 | 71 | 0 | 3 | 2360 | 4004 | `45f7ff19fa51f84f6ce751c27c13bbb7588f265f0d8d6f1a420ec753bb4ec9d5` |

For a schema with multiple rows, its registry `Max` is the greatest `C` and
its registry `Record` is the greatest `Rout`, selected independently; ties use
the lexicographic witness rule above. The selected branches are: endpoint
profile `LINUX`; owner mapping, inspection subject, session output, endpoint
identity, and raw observation `WINDOWS` (raw phase
`POST_NAMESPACE_REVALIDATION`); endpoint access `LINUX/POSIX_MODE`;
permissions `POSIX_MODE`; object observation
`POSIX_MODE/POST_NAMESPACE_REVALIDATION`; phase
`CONFIRM_SOURCE/PRIMARY`; membership proof `INDEX_PRESENT`; stored-object
failure and qualified failure `GCM`; manifest contradiction
`ROOT_GENERATION`; quarantine `DESCRIPTOR_CONTRADICTION`; provider and CEK
generation `METADATA`; quarantine record `PRIOR_PRESENT`. Every single-row
schema selects its only row. Those
selections and the numeric cells above are the exact registry values; a
registry mismatch is `UNAVAILABLE`, not a looser maximum.

The following table is the normative selected-overall projection parsed by the
independent verifier. `Cb` and `Rb` are the independently selected canonical
and record source branches; `C-SHA` and `R-SHA` are compared separately even
when equal.

| Selected schema | Cb | Rb | C | Rin | I | P | D | M | Rout | C-SHA | R-SHA |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `EndpointInspectorProfileV1` | `LINUX` | `LINUX` | 387 | 387 | 32 | 0 | 3 | 1112 | 1886 | `78e2548b6b5aec62ccc9ace85f18fd909798e3612454c4d3d3b76391287e9f7f` | `78e2548b6b5aec62ccc9ace85f18fd909798e3612454c4d3d3b76391287e9f7f` |
| `EndpointOwnerSubjectMappingV1` | `WINDOWS` | `WINDOWS` | 627 | 627 | 50 | 0 | 3 | 1688 | 2942 | `26ee880d927a0124ee813a99ab0ca2a6a400220993b5bcb2539397350b69ee5c` | `26ee880d927a0124ee813a99ab0ca2a6a400220993b5bcb2539397350b69ee5c` |
| `EndpointInspectionSubjectV1` | `WINDOWS` | `WINDOWS` | 300497 | 300497 | 200 | 0 | 4 | 6496 | 607490 | `f7676c2cb7b5a9cb3b7caaa34cbb8181e16ee88653c0eaa235e4f7afc8ad8c68` | `f7676c2cb7b5a9cb3b7caaa34cbb8181e16ee88653c0eaa235e4f7afc8ad8c68` |
| `EndpointSessionOutputEvidenceV1` | `WINDOWS` | `WINDOWS` | 861 | 861 | 72 | 0 | 3 | 2392 | 4114 | `99a47db3a2d5a47f8ffc8fed95451233fb9f1a010b8472fbb02a5debdb7b230a` | `99a47db3a2d5a47f8ffc8fed95451233fb9f1a010b8472fbb02a5debdb7b230a` |
| `StoreEndpointIdentityV1` | `WINDOWS` | `WINDOWS` | 1073 | 1073 | 53 | 0 | 3 | 1784 | 3930 | `c6a31f99af2dde30a44383a40a126ac667688115cfec40294b55da93ba5540d0` | `c6a31f99af2dde30a44383a40a126ac667688115cfec40294b55da93ba5540d0` |
| `EndpointRawObservationV1` | `WINDOWS/POST_NAMESPACE_REVALIDATION` | `WINDOWS/POST_NAMESPACE_REVALIDATION` | 74823 | 74823 | 22 | 0 | 2 | 784 | 150430 | `909c1902d20d29891609598a46914d605b89f0a72bd7fe60055487207bf115ce` | `909c1902d20d29891609598a46914d605b89f0a72bd7fe60055487207bf115ce` |
| `StoreEndpointAccessEvidenceV1` | `LINUX/POSIX_MODE` | `LINUX/POSIX_MODE` | 67485 | 67485 | 3976 | 0 | 7 | 127352 | 262322 | `8516ec3e1792ba909cd85dc33fb8b6ac985d15fade417fbaf37ae7d848ed8b56` | `8516ec3e1792ba909cd85dc33fb8b6ac985d15fade417fbaf37ae7d848ed8b56` |
| `EndpointPermissionsV1` | `POSIX_MODE` | `POSIX_MODE` | 15993 | 15993 | 970 | 0 | 4 | 31136 | 63122 | `8977a6665fce12d165f446371c13bed451b2d4a51dcc9593d5ab7fb2ce252ada` | `8977a6665fce12d165f446371c13bed451b2d4a51dcc9593d5ab7fb2ce252ada` |
| `EndpointObjectObservationV1` | `POSIX_MODE/POST_NAMESPACE_REVALIDATION` | `POSIX_MODE/POST_NAMESPACE_REVALIDATION` | 16791 | 16791 | 986 | 0 | 5 | 31656 | 65238 | `a4923ef30fcafa20c48dbe47a9d8bb5fd508b6785e629df87258a49bd358259b` | `a4923ef30fcafa20c48dbe47a9d8bb5fd508b6785e629df87258a49bd358259b` |
| `EndpointInspectionAuthenticationEvidenceV1` | `AUTHENTICATED` | `AUTHENTICATED` | 519 | 519 | 40 | 0 | 3 | 1368 | 2406 | `a5f3c70b11d354f378029def66284d06c0eeb3adea8c6e8dce907a41e2b7c835` | `a5f3c70b11d354f378029def66284d06c0eeb3adea8c6e8dce907a41e2b7c835` |
| `QualifiedEndpointInspectionEvidenceV1` | `QUALIFIED_COMPLETE` | `QUALIFIED_COMPLETE` | 272 | 272 | 16 | 0 | 2 | 592 | 1136 | `82b69483e805840cdd56c92d59917dd54145ba0cab956896ea9884d8af734d81` | `82b69483e805840cdd56c92d59917dd54145ba0cab956896ea9884d8af734d81` |
| `WriterFenceEvidenceV1` | `ACQUIRED_EXACT_PREDECESSOR` | `ACQUIRED_EXACT_PREDECESSOR` | 571 | 571 | 36 | 0 | 2 | 1232 | 2374 | `5ebea0e59b4f039da207ccb54c0cb56165ebf2e4d3723d21e2c81427d03e8728` | `5ebea0e59b4f039da207ccb54c0cb56165ebf2e4d3723d21e2c81427d03e8728` |
| `TC04PhaseV1` | `CONFIRM_SOURCE/PRIMARY` | `CONFIRM_SOURCE/PRIMARY` | 1504 | 1504 | 137 | 0 | 5 | 4488 | 7496 | `4f610339b3388462f38239530a55186b45f59750393a11edfbf288e01abc0ab6` | `4f610339b3388462f38239530a55186b45f59750393a11edfbf288e01abc0ab6` |
| `ReadSetAnchorObservationV1` | `TRUSTED` | `TRUSTED` | 332 | 332 | 18 | 0 | 3 | 664 | 1328 | `c889c54e52ac5f6b1fe93e3745567d77342757b5fdcc75a51a393a96ccaac804` | `c889c54e52ac5f6b1fe93e3745567d77342757b5fdcc75a51a393a96ccaac804` |
| `ReadSetMembershipProofV1` | `INDEX_PRESENT` | `INDEX_PRESENT` | 146288 | 146288 | 11838 | 0 | 10 | 378960 | 671536 | `5bfd47c48249e1781ade03b1d2a289f73ac9aa5fc5bcb8adb676ba80eab166a8` | `5bfd47c48249e1781ade03b1d2a289f73ac9aa5fc5bcb8adb676ba80eab166a8` |
| `StoreReadSetV1` | `CAP_256_MEMBERS_8192_ROLES` | `CAP_256_MEMBERS_8192_ROLES` | 1434090 | 1434090 | 77401 | 0 | 6 | 2476944 | 5345124 | `18a2d93b1caabf259a184259b1643530c0aa0956fd7d0385ecf7518a45839302` | `18a2d93b1caabf259a184259b1643530c0aa0956fd7d0385ecf7518a45839302` |
| `StoredObjectFailureSubjectV1` | `GCM` | `GCM` | 1155 | 1155 | 86 | 0 | 4 | 2848 | 5158 | `9f390e9a4d14ca886c617712b166b2d90c980216de3fa9c0077e74a921a2b132` | `9f390e9a4d14ca886c617712b166b2d90c980216de3fa9c0077e74a921a2b132` |
| `QualifiedStoredObjectFailureEvidenceV1` | `GCM` | `GCM` | 1313 | 1313 | 94 | 0 | 4 | 3104 | 5730 | `313f8fcbbab7f6c7a3ea47442cfdd8aeef62a34c1e803f1b86334bb4b4b518ef` | `313f8fcbbab7f6c7a3ea47442cfdd8aeef62a34c1e803f1b86334bb4b4b518ef` |
| `AuthenticatedManifestContradictionEvidenceV1` | `ROOT_GENERATION` | `ROOT_GENERATION` | 26502 | 26502 | 1792 | 0 | 5 | 57448 | 110452 | `62a1d69e423b90c5349c2fd99517941225d17da7806b472dce38e11cf363d431` | `62a1d69e423b90c5349c2fd99517941225d17da7806b472dce38e11cf363d431` |
| `AuthenticatedDescriptorContradictionEvidenceV1` | `DUPLICATE_ROUTE` | `DUPLICATE_ROUTE` | 292936 | 292936 | 23692 | 0 | 9 | 758280 | 1344152 | `e516f15fc2ee9979e0bdc1c6f8ebd496678418af4066bcfd1e7eb055c646c92d` | `e516f15fc2ee9979e0bdc1c6f8ebd496678418af4066bcfd1e7eb055c646c92d` |
| `StoreAllocationAuditEvidenceV1` | `ALLOCATION` | `ALLOCATION` | 2118 | 2118 | 169 | 0 | 4 | 5504 | 9740 | `3932e0b0fd129f3ba43e145aaa39608bffef3ed570a5fbf45264186302fa6145` | `3932e0b0fd129f3ba43e145aaa39608bffef3ed570a5fbf45264186302fa6145` |
| `StoreCrashCompletionAuditEvidenceV1` | `CRASH_COMPLETION` | `CRASH_COMPLETION` | 1322 | 1322 | 105 | 0 | 4 | 3456 | 6100 | `e8cfa9e09e1c4e2651f00d58689a792b48a9d065a06545ac491e6cc41ec93f6e` | `e8cfa9e09e1c4e2651f00d58689a792b48a9d065a06545ac491e6cc41ec93f6e` |
| `StoreAdmittedQuarantineObservationV1` | `DESCRIPTOR_CONTRADICTION` | `DESCRIPTOR_CONTRADICTION` | 147247 | 147247 | 11905 | 0 | 10 | 381104 | 675598 | `8f376bc22b8564e0351cd49b7c4905b8f33fa6e3671bd28f9949b57d3f5a119d` | `8f376bc22b8564e0351cd49b7c4905b8f33fa6e3671bd28f9949b57d3f5a119d` |
| `StoreBackupSnapshotObservationV1` | `BACKUP_SNAPSHOT` | `BACKUP_SNAPSHOT` | 1567 | 1567 | 133 | 0 | 4 | 4352 | 7486 | `cb2654488e459be923186bf1d89fe6084fd84babf15f4d240afe963d0d44c2e9` | `cb2654488e459be923186bf1d89fe6084fd84babf15f4d240afe963d0d44c2e9` |
| `StoreQuarantineRecordV1` | `PRIOR_PRESENT` | `PRIOR_PRESENT` | 656 | 656 | 44 | 0 | 3 | 1496 | 2808 | `4a606841840052778d8dee8a0f72ef4b3a5e1f65dc7185d460e0f057c0a75100` | `4a606841840052778d8dee8a0f72ef4b3a5e1f65dc7185d460e0f057c0a75100` |
| `QualifiedProviderGenerationEvidenceV1` | `METADATA` | `METADATA` | 749 | 749 | 65 | 0 | 3 | 2168 | 3666 | `6ffa7ceb51b2dba9a6b4d173c7a1f93a236a6f4a2e2327b15c5845d86b6a32cb` | `6ffa7ceb51b2dba9a6b4d173c7a1f93a236a6f4a2e2327b15c5845d86b6a32cb` |
| `CekGenerationEvidenceV1` | `METADATA` | `METADATA` | 838 | 838 | 72 | 0 | 3 | 2392 | 4068 | `e938d137728cb065a77431448e2f7a4d72ee110c1fbd7fa0322dec4950ee2ec0` | `e938d137728cb065a77431448e2f7a4d72ee110c1fbd7fa0322dec4950ee2ec0` |

The generated ledger also exposes four non-compensating activation blockers.
`ReadSetMembershipProofV1/INDEX_PRESENT` has depth 10,
`AuthenticatedDescriptorContradictionEvidenceV1` depth 9, and every
`StoreAdmittedQuarantineObservationV1` cause depth 10, all above TC03's depth-8
limit. `StoreReadSetV1/CAP_256_MEMBERS_8192_ROLES` is 1,434,090 canonical bytes,
above the current 1,048,000 indexed-object canonical-length cap. These rows are
`UNAVAILABLE_CURRENT_BOUND_VIOLATION`; their nonzero numbers remain binding and
must not be clipped, replaced by zero, or used as authority. I1e records the
defects but does not redesign the I1c/I1d schemas.

The following dependencies are `UNRESOLVED_NOT_ZERO`: every imported TC02/TC04
body not numerically present above; `EndpointInspectorBuildProvenanceV1`;
`QualifiedProviderSessionEvidenceV1`; qualified provider profile, FIPS provider
profile, FIPS entropy evidence, rollback-anchor identity/evidence, domain-slot
resolver, provider/parser workspace, and every later-owned TC06–TC10 authority
or evidence body. A missing row, corpus/schema/rule/generator hash drift,
arithmetic overflow, unresolved dependency, or current-bound violation makes
the containing phase `UNAVAILABLE`. No unresolved term is zero, deduplicated,
or estimated.

### 15.2 Disjoint I1 phase accounting

For one exact phase `P`, define these *sets of simultaneously live allocations*,
not algebraic aliases:

```text
E05(P) = EndpointInspectWorkspace05(P) only
F05(P) = FenceCompareWorkspace05(P) only
H05(P) = PhaseSelectWorkspace05(P) only
R05(P) = {record05(the selected StoreReadSetV1 shell)} disjoint-union
         {each selected member proof and each unique selected member body,
          exactly once, as ReadSetResolve05 specifies}
I05(P) = {} or {the one applicable prior/input internal-evidence body and its
                branch-only standalone dependencies}
G05(P) = {QualifiedProviderGenerationEvidenceV1,
          CekGenerationEvidenceV1} only after successful CEK generation

Lpre_I1(P)  = E05(P) disjoint-union F05(P) disjoint-union H05(P)
              disjoint-union R05(P) disjoint-union I05_pre(P)
Lpost_I1(P) = fresh(E05(P)) disjoint-union fresh(F05(P))
              disjoint-union fresh(H05(P)) disjoint-union fresh(R05(P))
              disjoint-union I05_post(P) disjoint-union G05(P)
Lpre(P)     = Lpre_rest(P) disjoint-union Lpre_I1(P)
Lpost(P)    = Lpost_rest(P) disjoint-union Lpost_I1(P)
```

`G05` is absent pre-provider, but its exact ledger-selected post peak must be
reserved before provider work. `E05` contains workspace only: all endpoint
profile/mapping/subject/raw/authentication/session/access/identity bodies are
members charged by `R05`. The selected fence and phase bodies are likewise
charged only by `R05`; `F05/H05` are the disjoint current-comparison and
phase-selection workspaces, respectively, and contain no canonical body bytes.
If an implementation cannot prove that distinction, or cannot supply their
nonzero qualified workspace bounds, the phase is unavailable. The
same rule applies to an I1d body selected as a read-set member: its body is in
`R05`; `I05` contains only an excluded current source body or branch-specific
workspace, never an alias.

Instantiate the equations independently for ordinary pre, ordinary post,
Create source, Create destination, Confirm source, Confirm staged, Confirm
current, bootstrap, recovery verification, allocation audit, crash completion,
quarantine, and backup. Omission-present and omission-zero are separate rows;
Create/Confirm source, destination, staged, and current never share live copies.
No cross-phase, semantic-equality, provider, authority/evidence, time/skew, or
fresh-revalidation deduction is permitted. An identical canonical body may be
charged once only inside the same selected `R05` under the exact I1c multi-role
rule. Imported TC04 workspace is charged once after exact subtraction of the
member bodies; an unresolved subtraction or negative result is unavailable.

### 15.3 Bound-ledger tests

`TC05-I1-B01` generates and reparses valid branch MIN, valid leaf `MAX-1`, and
the exact `MAX` witness for every one of the 81 rows. `TC05-I1-B02` independently
optimizes canonical length and `Record`, verifies both witness hashes, and
asserts runtime input bytes, canonical-output bytes, `Items`, `Pairs`, `Depth`,
`Meta`, and high-water `Record` equal the ledger. `TC05-I1-B03` truncates the
maximum stream by one byte and appends one trailing zero; both reject rather
than becoming a smaller/larger valid object. `TC05-I1-B04` raises each bounded
leaf or collection by one, including raw storage 4,096/4,097 bytes, raw ACL
65,536/65,537 bytes, normalized ACE 64/65, fence token 128/129 bytes, roles
32/33, total roles 8,192/8,193, and read-set members 256/257.

`TC05-I1-B05` gives each exact phase its generated budget and budget-minus-one;
the former proceeds only if every dependency row is resolved and the latter
denies before endpoint/root/provider/CAS work. `TC05-I1-B06` expands all
`Lpre/Lpost` sets and instruments every unique read-set body/proof and every
workspace: count one passes; zero, two, or a body/workspace alias denies.
`TC05-I1-B07` mutates each bound input hash, witness byte, table cell, branch
selection, registry cell, or corpus order and requires drift denial.
`TC05-I1-B08` attempts same-digest forbidden dedup, cross-phase dedup, unresolved
row-as-zero, signed/unsigned wrap, multiplication/addition overflow, and a
one-byte-or-one-item excess; all deny before work. `TC05-I1-B09` requires the
four `UNAVAILABLE_CURRENT_BOUND_VIOLATION` cases above to remain unreachable and
nonzero until a separately reviewed schema repair regenerates the entire ledger.


## 16. Later-TC boundaries and unavailable predicates

| Owner | TC05 output; explicit nonclaim |
| --- | --- |
| TC06 | Durable substrate and typed later-authority seam; no entry, lease, rotation, revocation, or erasure authority. |
| TC07 | Immutable admitted handles; no broker, IPC, injection, adapter, action, or output containment. |
| TC08 | Immutable history/receipt/proof/quarantine inputs; no audit disclosure, incident action, or reconciliation policy. |
| TC09 | Backup/restore candidate mechanics and peak handoff; no creation authority, recovery, migration, reconstruction, quarantine clearing, or activation. |
| TC10 | Qualification seams for filesystem, anchor, pre-root proof, domain slots, wrappers, provider, faults, budgets, and deployment; no current backend is qualified. |

An unresolved body/reference, unavailable pre-root authentication, unqualified
domain slot/anchor/durability primitive, unknown platform behavior, or missing
generated bound returns `UNAVAILABLE`, never fallback. This remains
**REVIEW-REQUIRED / PROVISIONAL COMPOSE / NOT IMPLEMENTED**.

## 17. Required synthetic tests (TC05-ST01–TC05-ST95)

| ID | Required future check |
| --- | --- |
| TC05-ST01 | Private root admits only exact four-phase raw plus normalized evidence returned on an authenticated qualified provider session by an active `STORE_SERVICE`, with current profile/build/API/normalizer/time/skew, exact active `OWNER_HUMAN` subject mapping, complete ACL/mode/direct-object evidence, and `LOCAL_FIXED`; forged, self-issued, locally replayed, raw-only, principal-only, profile-only, or drifted evidence denies. |
| TC05-ST02 | Endpoint volume/directory/namespace/owner/session/storage IDs cannot substitute, alias, link, mount, reparse, case-collide, or relabel `LOCAL_REMOVABLE`, `REMOTE`, `UNKNOWN`, `UNAVAILABLE`, or `UNSUPPORTED` as local fixed. |
| TC05-ST03 | Combined governing/TC05 CDDL and all relational rules close. Resolve valid endpoint-access/read-set/phase/internal/CEK/fence bodies and exact refs; remove, duplicate, reorder, overbound, cross-kind/domain/schema substitute, digest-without-body, or mutate each equality/branch/currentness field and reject. Generated valid `MAX/T` is achievable; `Max/Record` equality passes and exact canonical/body/cardinality one-byte-or-one-item over rejects before lookup/provider/CAS. |
| TC05-ST04 | Immutable objects/generations cannot be overwritten, relabeled into authority, or mutated. |
| TC05-ST05 | `uint63` generation/fence/sequence limits, overflow, zero, wrap, and skipped parents deny. |
| TC05-ST06 | Exact predecessor admission-root CAS is the sole linearization point. |
| TC05-ST07 | Concurrent writers yield one winner; losers burn and cannot unlink/overwrite successors. |
| TC05-ST08 | Readers pin one root/generation during publish and compaction. |
| TC05-ST09 | PID/host/time/heartbeat/lock age cannot acquire or break a fence. |
| TC05-ST10 | Fault after every write/fsync/dir-fsync/CAS/head/response yields one total reconstructed crash state. |
| TC05-ST11 | Crash classification uses authenticated anchor plus immutable artifacts/head; impossible/multiple rows block. |
| TC05-ST12 | Partial/mixed bootstrap, ceremony, currentness, or ordinary sets remain invisible. |
| TC05-ST13 | Namespace literal/radix/base32/case/traversal/nesting/cap corpus rejects. |
| TC05-ST14 | Reservation transaction is anchor-selected before generation/materialization. |
| TC05-ST15 | Materialization is separately anchor-selected before use; terminal is consumed xor burned. |
| TC05-ST16 | Crash at reserve/generate/materialize/use/terminal never reuses IV, ID, handle, attempt, salt, or sequence. |
| TC05-ST17 | Anchor absence/rollback/stale token/wrong store-root-generation/unavailable trust denies. |
| TC05-ST18 | Selected-root fork quarantines; unselected conflict causes zero mutation. |
| TC05-ST19 | Head ahead blocks; head behind exact selected root completes without new transaction. |
| TC05-ST20 | Caller/malformed/bounds/wrong-scope/pre-admission/offline inputs, self-issued failure bodies, unauthenticated comparison inputs, arbitrary absence routes, or non-nil admitted-manifest quarantine state never create a quarantine effect. |
| TC05-ST21 | First admitted integrity failure requires the exact TC10-qualified field-specific uniform-failure evidence DAG; manifest/descriptor contradiction requires exact authenticated compared inputs. The current effect emits exactly one mapped immutable quarantine record for the admitted object and generation. |
| TC05-ST22 | Every later access resolves the existing non-nil quarantine ref and performs zero new observation/effect/record/crypto/provider work. |
| TC05-ST23 | Quarantine record/effect survives every crash cut and restart/backup and cannot be duplicated, payload-substituted, or cleared by local flag/rewrite. |
| TC05-ST24 | Recovery mismatch never selects another root, slot, object, or generation. |
| TC05-ST25 | Prepared unselected set is inert; only exact anchor-selected set publishes. |
| TC05-ST26 | Backup snapshot binds selected source root, full index, chunks, recipient, freshness, and anchor. |
| TC05-ST27 | Separate-location restore verifies completely and yields only `VERIFIED_NOT_AUTHORIZED`. |
| TC05-ST28 | Stale/expired/wrong-recipient/wrong-profile/wrong-anchor backup rejects without live mutation. |
| TC05-ST29 | Restore race with live publish cannot change its pinned source/destination observations. |
| TC05-ST30 | TC09 activation must create fresh store/generation/IDs/CEKs/IVs/salts/fence/anchor CAS. |
| TC05-ST31 | Metadata observer learns only allowed random IDs, classes, bounds, and timing; scan stable scope/plaintext leakage. |
| TC05-ST32 | Namespace/index/ledger/schema/transaction/chunk exhaustion denies; no rollover/reset. |
| TC05-ST33 | Linux/macOS/Windows fault corpus proves exact qualified descriptor and durability behavior or marks unsupported. |
| TC05-ST34 | Claude and Codex paths resolve the same store records and have no direct filesystem authority. |
| TC05-ST35 | Cross-repo/environment queries, absence, timing, size, and error classes expose no protected labels. |
| TC05-ST36 | Platform bootstrap set is all-or-none; portable adds exact binding; mapping tuple equality holds. |
| TC05-ST37 | Empty-store trust is external; store/model/session/self-issued ceremony evidence rejects. |
| TC05-ST38 | Binding/proof bytes freeze under intent before wrap and cannot be replaced post-effect. |
| TC05-ST39 | Replay or duplicate transaction/proof/receipt/history/mapping rejects without external work. |
| TC05-ST40 | Proof + non-digest tx ID + effect + receipt + history map byte-equal across all required records. |
| TC05-ST41 | Complete digest DAG walk rejects self, reverse, descendant, descriptor-partition back-edge, and cycle. |
| TC05-ST42 | Expired/revoked/replaced creation/confirmation/omission evidence remains reachable but ineligible. |
| TC05-ST43 | Generation-1 ADD/CONFIRM use distinct authority/proof sets and the one exact staged lineage. |
| TC05-ST44 | Carrier currentness is atomic with confirmation/receipt/history/mapping and outside KDF. |
| TC05-ST45 | Duplicate/missing/mixed confirmation or currentness keeps staged state noncurrent. |
| TC05-ST46 | Suite-4 input/check/digest/MAC/hint/derived bytes never persist; only allowed public ID/protected salt source does. |
| TC05-ST47 | Historical authority/evidence/proof/receipt/history survives compaction, backup, expiry, and restart. |
| TC05-ST48 | Path/clone/worktree/rename/origin changes cannot alter repository/environment/store identity. |
| TC05-ST49 | Generated `Max/Meta/Record/Index05/Pre05/Post05`, including every I1 evidence/read-set/phase body, equals instrumented bytes for every phase. |
| TC05-ST50 | Lost acknowledgement reconstructs published state and replays receipt without provider/UI rerun or exactly-once claim. |
| TC05-ST51 | Omission authority/evidence/proof/readback/consumption commits atomically with exact environment/mapping. |
| TC05-ST52 | Caller/source flags cannot force, suppress, or redirect `NeedsDevelopmentOmission04`. |
| TC05-ST53 | Forged/self-issued/replayed/consumed omission rejects before custody and does not quarantine. |
| TC05-ST54 | Ordinary currentness requires exact admitted profile/slot/history/current environment/epochs. |
| TC05-ST55 | Suite-4 attempt, public artifact ID, salt source, CEK/IV/envelope allocations are independently reserved/materialized. |
| TC05-ST56 | Instrumented qualified RNG/provider calls prove independent IDs/CEKs/IVs and one-use handles. |
| TC05-ST57 | Metadata outer/AAD/header/KDF/domain/allocation/CEK-evidence values are constructible and byte-equal; mutate each field. |
| TC05-ST58 | Suite-4 binding/source/staged slot/proof/receipt/history/map publishes all-or-none. |
| TC05-ST59 | Timeout/cancel/mismatch/crash/ambiguity burns all attempt allocations before retry. |
| TC05-ST60 | Public label is exact 41-byte TC04 form and never selects/enumerates a slot. |
| TC05-ST61 | Exact 16-byte decoded public artifact ID is transient, charged, matched, and cleared. |
| TC05-ST62 | Suite-4 salt appears only in protected source; global ledger/index copies reject. |
| TC05-ST63 | Secret input/combined artifact/check/derivative/location scan passes every success/failure/crash surface. |
| TC05-ST64 | Suite-4 phase peak charges label, decoded ID, 128-byte input, Argon memory, provider overhead, and TC05 state. |
| TC05-ST65 | TC09 refuses weaker peak, reused source values, or activation without new authority/transaction. |
| TC05-ST66 | Restore candidate cannot unwrap, activate, relabel, or become local head under TC05. |
| TC05-ST67 | Every ceremony authority/evidence/proof/readback/slot/manifest environment is byte-identical. |
| TC05-ST68 | Same store/profile tuple in another environment rejects without fallback. |
| TC05-ST69 | Omission transplant across environment/owner/attempt/generation/epoch/transaction rejects. |
| TC05-ST70 | Missing/malformed/ambiguous omission resolver yields required-missing-invalid or unavailable, never zero. |
| TC05-ST71 | Applicable ordinary slot open includes omission resolver/record/accounting exactly once. |
| TC05-ST72 | Create source includes omission only when applicable; destination/emit contributes zero. |
| TC05-ST73 | Confirm source/current includes omission only when applicable; staged target contributes zero. |
| TC05-ST74 | INITIALIZE and exact generation-1 staged-lineage source resolve omission zero. |
| TC05-ST75 | Recovery-present, production/controlled, portable/recovery, unrelated store/env resolve omission zero. |
| TC05-ST76 | Injected omission/source/outer-operation flags cannot alter branch, store mutation, or charge. |
| TC05-ST77 | Live authority/evidence/time/skew never dedup; semantic-only and cross-phase dedup rejects. |
| TC05-ST78 | Current environment/readback same-phase identical digest dedups once; one-byte-over denies pre-provider. |
| TC05-ST79 | Snapshot/read-set drift at every current-ceremony phase burns and restarts from fresh authority. |
| TC05-ST80 | Restore/relabel/copy cannot transplant environment, AAD, KDF, recipient, domain, or allocation values. |
| TC05-ST81 | Each current-control phase contains the six exact TC04 bodies including current environment. |
| TC05-ST82 | Full owner readback body/reference matches authority/proof/request/slot and cannot be shortened. |
| TC05-ST83 | Cross-environment current-control body substitution rejects even with same store/profile/tuple. |
| TC05-ST84 | Only same-phase identical-canonical environment/readback dedup is accepted and charged once. |
| TC05-ST85 | Semantically equal but byte-distinct environment/readback cannot dedup. |
| TC05-ST86 | Authentication/authority/time/skew classes remain separately charged even if bytes repeat. |
| TC05-ST87 | No current-control or wrapper bytes dedup across Create/Confirm/source/staged/current phases. |
| TC05-ST88 | INITIALIZE emits exact platform set; portable emits it plus binding; no other row. |
| TC05-ST89 | Create source/destination sets, retained source, effect, and budgets are phase-isolated. |
| TC05-ST90 | Confirm source/staged/current sets, fresh attempt, effect, and budgets are phase-isolated. |
| TC05-ST91 | Any read-set, environment, endpoint, anchor, epoch, slot, or authority drift before CAS burns/restarts. |
| TC05-ST92 | Every phase has achievable exact `Pre05/Post05` witness; exact budget succeeds. |
| TC05-ST93 | One-byte/item-over endpoint-access/read-set/phase/internal/fence/CEK evidence, omission/environment/readback/index/wrapper/allocation denies before root/provider/CAS. |
| TC05-ST94 | One-byte-over suite-4 label/decoded-ID/input/Argon/provider/state denies before provider. |
| TC05-ST95 | Every later-owned schema/domain slot/inclusion proof/backend remains unavailable until closed `Record(T)`, vectors, and qualification exist. |

The TC10 corpus additionally mutates every metadata/backup outer, AAD, header,
KDF, domain/generation/wrapping, recipient, length, allocation, CEK-ID, IV, and
COSE field one at a time. The KDF is the complete non-circular projection of all
variable outer/AAD values except wrapped CEK and ciphertext/tag; source fields
must be byte-equal. Combined CDDL tests import frozen TC02–TC04 aliases, reject
duplicate definitions with unequal bytes, and reject generic/cross-domain/schema
reference substitution.

The focused I1 combined-schema corpus must also resolve all six new bodies from
canonical bytes and recompute their exact typed refs; test wrong literal, branch,
phase/ceremony pairing, omission presence, ACL order/right, four-observation
drift, missing/extra read-set member or index proof, stale fence predecessor/
token/generation, internal kind/detail mismatch, CEK context/provider/session/ID
mismatch, unresolved anchor/provider/entropy body, invalid maximum combination,
and exact byte/cardinality limit plus one. Every failure occurs before the
reference can influence admission, custody, provider work, CAS, or quarantine.

The focused I1a KAT constructs the exact DAG in section 6 and verifies a unique
topological order with no forward/reference cycle. Independently mutate or swap
each reservation/materialized/terminal ref, allocation ID/kind/value/sequence/
store/environment/suite, including one evidence/context/allocation wrong-suite
substitution, envelope ID, CEK ID, IV, logical handle ID, scope/domain/
generation, final context, provider/profile/session/entropy evidence, CEK
evidence, wrapper/effect membership, and one-use state. Test cross-envelope,
cross-domain, cross-generation, cross-provider/session, reused evidence, second
effect, missing/multiple terminal, generated-but-unmaterialized, and materialized-
but-unevidenced cuts. Each denies before CEK use and burns before retry. A scan of
all records, AAD, contexts, evidence, logs, and failures permits public random
IDs/IV and typed record/context digests only; CEK/key/provider-handle/plaintext/
secret values or their digests never occur.

The focused I1b corpus constructs exact maximum Windows/macOS/Linux inspection
rows and instruments `EndpointInspect05`. Independently forge, self-issue, omit,
duplicate, reorder, truncate, extend, replay, or substitute the body/reference,
store, provider, provider session, build, profile, issuer, platform/API/
normalizer, time/boot, owner principal/raw subject/OS session, attempt, phase,
volume/directory/namespace/direct token/type/link, storage evidence/class,
raw ACL format/bytes, session-output evidence,
owner/group, alias/link facts, retrieval, normalized mode/ACL, epoch, or result.
Replace only `qualified_provider_session` with a canonically valid body for a
different provider or provider session while every other field remains equal;
both substitutions deny before endpoint provider work.
Test same ACL with another owner, `LOCAL_REMOVABLE`/`REMOTE`/`UNKNOWN` relabeled
local, `UNAVAILABLE` relabeled complete, missing/truncated/extra/unknown or
conditional ACE, unresolved subject, dropped `DENY`/inheritance/right, caller
normalization, raw/normalized mismatch, phase reorder, and one-observation drift.
Exactly 4,096-byte raw storage and alias evidence, 65,536-byte raw ACLs, and 64
normalized ACEs pass in a complete maximum witness; 4,097, 65,537, or a 65th ACE
denies before endpoint provider work, root open, or CAS. Exact maximum and one-
less valid rows pass. No alternate provider, heuristic, normalization, or
fallback is tried, and an unresolved TC10 qualification body always returns
`UNAVAILABLE_PENDING_TC10_ENDPOINT_INSPECTION`. A construction KAT proves the
sole order `inputs/profile/build/time -> subject -> qualified session output ->
authentication -> qualified inspection -> access`; add any self, reverse,
transitive-back, projection, or final-to-ancestor edge, or cross-store/profile/
provider/session substitute the mapping, subject, session output,
authentication, or qualified evidence, and admission denies before endpoint
provider work. Standalone pre-read-set admission instruments one full
`EndpointInspect05`. Every `Resolve05`, `NewPre05`, and `NewPost05` live branch
instead instruments exactly one `EndpointInspectWorkspace05`; its endpoint
identity and all other inspection bodies occur only as read-set members.
Exact-budget witnesses pass; delete the workspace term, add a second copy, add
any inspection body outside the read-set resolver, or exceed any workspace or
total branch budget by one byte/item and deny before endpoint provider work,
root open, wrapper/domain resolution, or CAS.

The focused I1c oracle computes `RequiredBodies04(phase)` independently for
ordinary, every Create source/destination, every Confirm source/staged/current,
bootstrap, recovery, omission-present/zero, and quarantine branch, then compares
the exact selector-role multiset, unique canonical-body set, member count, and
one-to-one proof set. Independently remove, add, duplicate, reorder, or substitute
a selector, role, selected ref, canonical body ref, member, proof shell, proof
detail, referrer edge, index page, or direct field. Mutate store/environment/
generation/profile/slot/principal, authority/authentication/readback/time/skew,
platform/carrier/lineage, root/manifest/index root, route, descriptor domain/
schema/digest/length, `PRESENT`, or resolved body; reuse one proof for two members
or introduce a self/forward/reverse/cyclic transitive edge. Each fails before
provider/root work.
Replace only a valid `provider-tenant-target-ref-v1` selector/member with its
provider, tenant, target, or a recomposed composite while keeping the digest,
other roles, and proof otherwise valid; each substitution fails.

One body selected under multiple exact roles passes as one member/proof/body
charge; semantically equal but canonically or domain/schema-distinct refs remain
separate. Historical evidence valid at consumption passes after later expiry;
stale-at-consumption or any live currentness expiry/drift fails. Exercise one and
256 unique bodies, 32 roles on one body, 8,192 total roles, exact generated
`ReadSetResolve05` budget, and one-less valid witnesses. A 257th body, 33rd role,
8,193rd role, one byte/item over, legacy 512-member/256-proof split, missing
direct-field member, or drift on the pre-provider or pre-CAS re-read returns
`UNAVAILABLE` without omission. Instrument each embedded member, proof shell/
inline proof pages, and resolved body exactly once. Instrument exactly one
`ReadSetResolve05(selected_read_set(P))` in `Resolve05` and every `StorePre05`/
`StorePost05` branch; zero, two, a separately added `Record05(StoreReadSetV1)`,
or one byte/item over the exact resolver or total branch budget fails before
provider/root/CAS work. Fully expand each branch and tag every live term as
read-set shell, unique member body, unique membership proof, endpoint workspace,
imported-TC04 workspace, domain workspace, fresh nonmember output, or fresh
output-wrapper workspace. Every unique member body/proof has count exactly one.
Count zero/two, place endpoint/identity/root/manifest/anchor/index/source-wrapper
or any other member alias in a workspace/new-output set, overlap imported and
store partitions, or add one byte/item to any partition, and fail before work.
The corpus makes no scan-free
or global locator/index qualification claim; substituting the later F2 format
without its own frozen schema and qualification denies.

The focused I1d corpus first proves the exhaustive topology/matrix. Allocation
and crash bodies are accepted only after their observed facts and reject every
current-source placement. Quarantine requires the exact tagged cause, current
intent/effect transaction ID, singleton record effect, and effect kind; backup
requires its exact observation/authority source row and effect kind.
Inject self-intent, same-effect, effect-descendant, reverse, or transitive-back
refs; fabricate a crash effect/current transaction; put a current quarantine or
backup output manifest/effect/receipt/history/root in its evidence; or substitute
an undefined/generic evidence ref. Each rejects before provider/root/effect work.

For allocation, independently alter reserve/materialized/terminal predecessor,
state, allocation ID/kind/sequence/store/environment/suite/value, selected
manifest/root/anchor, terminal effect membership/kind, or prior selected tuple.
For crash, forge the prior intent/effect/receipt/history/manifest/root, either
closed state/ref, before/after state, local head, or shared anchor. For quarantine,
remove or alter the complete descriptor/typed object, admitted root/manifest/
generation, `PRESENT` membership proof, route/domain/schema/digest/length,
detection transaction, or cause tag/ref/body. Substitute KWP/GCM operation,
provider/profile/session/qualified-session/attempt, subject, envelope, uniform
result, or valid evidence from another object/transaction/store/environment.
Forge, locally issue, replay, or reverse-link failure evidence; vary outward
error/timing/detail; insert ciphertext, key/CEK, plaintext, secret digest, or
algorithm-internal detail. Until TC10 qualification, even an otherwise valid
failure vector returns unavailable without provider retry or oracle.

For manifest contradiction, independently mutate each table LHS and each RHS
member while holding the selected row and all other equality-vector fields
fixed; each expected single-row witness passes, while zero/two inequality
dimensions, another tag, unequal root manifest ref, unlinked ref/body/anchor, or
alternate cross-store/generation input denies. For descriptor contradiction,
the achievable witness is one authenticated selected tree containing two raw
root-to-leaf paths with the same routing ID and unequal `PRESENT` descriptors.
Change selected root, route, either path/hash/page/descriptor, `PRESENT`, make
descriptors equal, or add any second global violation; any unauthenticated or
caller-projected input denies. The oracle validates each raw path locally and
then requires the combined duplicate-route uniqueness violation; it never
incorrectly demands global uniqueness from either isolated path. Set the admitted manifest's
`quarantine_ref` non-nil or mismatch its store/generation/root; no alternate
route/absence proof is accepted. Remove, duplicate, or alter the current
quarantine record/descriptor; change its kind/schema/location/body/ref/hash/
length, mapped reason, store/generation/manifest/object/detection transaction/
anchor/prior-nil, or add any second effect payload. Missing/wrong/duplicate/
payload-substituted output denies while the observation remains output-free.
For backup,
alter source endpoint/access/store/generation/root/manifest/index/anchor,
freshness policy, trusted time/skew, profile, recipient, or snapshot transaction;
inserting an output ref or complete-object-set digest rejects. Remove the
conjunctive TC09 authority, move it to a separate `TC09_LATER` row, substitute a
valid authority for a prior/different transaction, store, environment, profile,
recipient, or effect, omit its read-set member, or charge it twice; each denies.
Observation-only backup never passes.

Named quarantine repair vectors are `TC05-I1D-R2-Q01-CAUSE-TAGGED-UNION`,
`TC05-I1D-R2-Q02-QUALIFIED-FAILURE-DAG`,
`TC05-I1D-R2-Q03-AUTHENTICATED-COMPARISON`,
`TC05-I1D-R2-Q04-MANIFEST-NIL-FIRST`,
`TC05-I1D-R2-Q05-SINGLETON-QUARANTINE-RECORD`,
`TC05-I1D-R2-Q06-NO-ORACLE`, and
`TC05-I1D-R2-Q07-EXACT-RESOURCE-BOUNDARY`. Each has one reachable pass witness,
the mutations above, exact branch budget, budget-minus-one, canonical maximum,
and one-byte/item-over pre-provider witness.
`TC05-I1D-R2-Q03-AUTHENTICATED-COMPARISON` has three independent manifest
sub-witnesses (`ROOT_STORE`, `ROOT_GENERATION`, `MANIFEST_STORE`) plus the
two-path duplicate-route descriptor witness; no root-manifest-ref inequality
vector is generated or accepted.

Generate separate minimum/maximum witnesses and `Max05/Meta/Record05` equations
for all four branches; never sum branch maxima. Standalone evidence charges its
exact dependency set once. Live quarantine/backup charges each dependency only
through `ReadSetResolve05` and the excluded evidence body once through
`InternalEvidenceSource05`; allocation/crash source charge remains zero. Exact
budget passes; budget-minus-one, one byte/item over, a duplicate body/proof,
zero/two evidence-body charges, or a dependency alias in another partition fails
before provider work. Scan every evidence/failure/log body and reject any CEK,
key, owner input, plaintext, secret-derived, or complete-object-set digest.

## 18. Internal design audit

- Governing hashes are exact and all links are repository-local.
- Reuse evidence supports ADAPT/COMPOSE only; no backend or anchor is selected.
- The transaction digest graph, anchor commit point, crash classifier, allocation
  lifecycle, quarantine trigger/scope, historical reachability, backup boundary,
  TC04 phases, and resource equations have closed fail-safe direction.
- Remaining unavailable predicates are explicit TC06/TC09/TC10 qualification
  work, not implementation permission or evidence of runtime support.

Internal author assessment: **93/100, REVIEW-REQUIRED**. The deduction is for
deliberately unqualified platform durability/anchor/pre-root/domain-slot/provider
interfaces and generated constants that TC10 must prove. No implementation,
dependency installation, credential use, contender execution, or production
qualification occurred.
