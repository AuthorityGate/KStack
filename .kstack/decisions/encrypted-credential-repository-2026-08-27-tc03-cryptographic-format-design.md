# Encrypted Credential Repository: ECR-TC03 cryptographic and canonical-format design

| Field | Bound value |
| --- | --- |
| Status | **REVIEW-REQUIRED / PROVISIONAL COMPOSE / NOT IMPLEMENTED** |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| ECR-TC01 closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |
| ECR-TC02 closure SHA-256 | `1c8cf9e874ea5f137d39b4be32c7b1e066c6abc3bdb0df48be39cc8742286bf3` |
| FIPS decision SHA-256 | `6b4cf4fe2cff2ad016055a31333652cc35fd23672f0cdb1f9abebae75c1a38f8` |
| Closure | Codex confidence >=93 and zero failed checks, security findings, material dissent, unresolved questions, or design-changing objection |

## 1. Scope and closed decision

TC03 freezes byte representation, algorithms, references, digests, key
hierarchy, envelope bindings, limits, nonce rules, oracle behavior, and tests.
It does not qualify a provider, custody API, transactional store, broker,
adapter, recovery ceremony, or deployment.

Production has one active suite:
`ECR-PROD-FIPS-A256GCM-HKDFSHA256-A256KWP-SHA256-CBOR1/1`. It uses
deterministic CBOR, closed `COSE_Encrypt0`, AES-256-GCM with a 96-bit IV and
128-bit tag, SHA-256, HKDF-SHA-256, and AES-256-KWP.

Every production operation also requires a current TC10-qualified
FIPS-validated module, approved mode, exact operating environment, provider
configuration, algorithm validations, self-tests, and entropy path. Algorithm
names, API success, or a FIPS flag are not evidence. Missing, stale, disabled,
ambiguous, mismatched, mixed-provider, or out-of-boundary evidence blocks before
key generation, derive, wrap, encrypt, open, rewrap, rotate, migrate, restore,
recover, or release. There is no production fallback. All production platforms
remain `UNAVAILABLE_PENDING_TC04_TC09_TC10_QUALIFICATION`.

## 2. Reuse-first standards record

KStack adopts RFC 8949 deterministic CBOR and RFC 8610 CDDL; narrowly profiles
RFC 9052 `COSE_Encrypt0` and RFC 9053 algorithm 3; and adopts RFC 5869
HKDF-SHA-256, RFC 5649 AES-KWP, NIST SP 800-38D AES-GCM, and NIST SP 800-38F.
KStack composes only closed schemas, typed references, domain separation,
complete AAD, errors, and downgrade rules. Provider/dependency selection stays
in TC10.

AES-GCM-SIV lacks established required cross-platform/FIPS support. ChaCha20,
XChaCha20, HPKE, age/X25519, SOPS/age, and draft/private COSE algorithms receive
no production suite ID. Argon2id is nonproduction recovery only. PBKDF2 is not
default. Protobuf and JSON are not authoritative encodings. RFC 9106 applies
only to the nonproduction Argon2id profile.

## 3. Canonical CBOR profile

`ECR.Canonical/1` is length-first core deterministic CBOR:

1. Definite-length maps, arrays, byte strings, and text strings only.
2. Preferred shortest encoding for every integer, length, and tag.
3. Closed integer map labels in encoded-key order. Detect duplicate raw keys
   before a native map. Unknown, missing, duplicate, out-of-order, or wrong-type
   labels reject.
4. No floats, simple values, null, undefined, bignums, decimal fractions, tag
   55799, or tag other than required COSE tag 16, except that the sole literal
   simple value `true` is required at `TrustedTimePolicyProfileV1`
   `require_boot_continuity`. `false`, `true` at any other field, and every
   other simple value reject. Negative integers are
   forbidden in every ECR record/value except as the three exact protected-
   header map keys `-65537..-65539` and those same three label values in the
   exact `crit` array defined in section 7. All associated values remain
   nonnegative.
5. Opaque IDs, digests, references, nonces, keys, ciphertext, and credentials
   are byte strings. Schema/enums are exact ASCII. Permitted display text is
   already UTF-8 NFC under Unicode 15.1 and is rejected rather than normalized;
   no TC03 authority, reference, envelope, or plaintext schema contains free
   display text. Display text never becomes locale-comparative identity.
6. TC02 records are fixed arrays beginning once with the exact TC02 schema
   literal ending `/1`, then the remaining fields in exact TC02 declaration
   order. No additional logical version field is inserted. Optional is `[0]`
   absent or `[1,value]` present; null is never absent.
7. Sets are duplicate-free arrays sorted by full canonical member bytes.
8. Enforce section 11 bounds before allocation or cryptographic work.
9. Decode, validate, deterministically re-encode, and require byte equality.
10. Protected header, external AAD, and decrypted plaintext each undergo that
    process independently.

Frozen TC02 schema literals are `ECR.Principal/1`,
`ECR.RepositoryIdentity/1`, `ECR.RemoteIdentity/1`,
`ECR.RepositoryStateRule/1`, `ECR.EnvironmentIdentity/1`,
`ECR.QualifiedProfileTuple/1`, `ECR.AuthorityPolicy/1`, `ECR.ServiceAuthority/1`,
`ECR.PortableProductionDowngradeAuthority/1`, `ECR.AuthorityRequest/1`,
`ECR.AttemptBinding/1`, `ECR.AuthorityDecision/1`,
`ECR.TrustedTimeInput/1`, `ECR.TrustedTimePolicyProfile/1`,
`ECR.UtcSkewEvidence/1`, `ECR.ApprovalSubject/1`, and
`ECR.ApprovalEvidence/1`. New versions require new schemas; no
append/reinterpret.

TC02's schema-less epoch encoding is exactly:

```cddl
epoch-entry-v1 = [1 / 2 / 3, 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10,
                  id128-v1, uint63]
epoch-vector-v1 = [0*4096 epoch-entry-v1]
```

Epoch kinds 1..3 mean policy, restriction, and qualification. Every `scope_id`
is the same exact 16-byte `id128-v1` used by its referenced TC02 scope; text,
variable-length bytes, truncation, or normalization is invalid.
`MAX/epoch-vector-v1` remains achievable with 4,096 distinct 16-byte scope IDs
in required tuple order. Scope kinds
1..10 follow TC02's exact listed order from global store through qualified
profile tuple. There are at most 4,096 entries, sorted by canonical bytes of
the first three fields, with no duplicate tuple. `ECR.EpochVector/1` is only
the digest transcript's external schema identifier, not an inserted field.
`UtcInstantV1` is `["UtcInstantV1/1",seconds,nanoseconds]` with unsigned
63-bit Unix seconds and nanoseconds `0..999999999`.

```cddl
utc-instant-v1 = ["UtcInstantV1/1", uint63, 0..999999999]
```

The following CDDL completes the normative TC02 type graph. Every set uses the
section-3 canonical-member-byte order. Every named TC02 enum is the exact ASCII
literal frozen by TC02; only structural presence tags and the separately frozen
epoch kind/scope tags use assigned integers. A `maybe-*` value is the complete
tagged presence
encoding, not an extra logical field. TC02's conditional-presence matrices and
relational rules remain normative in addition to this structural CDDL.

```cddl
uint63-zero = 0..9223372036854775807
id128-v1 = bstr .size 16
maybe-id128-v1 = [0] / [1, id128-v1]
id128-set-v1 = [0*4096 id128-v1]
nonempty-id128-set-v1 = [1*4096 id128-v1]
duration-v1 = ["DurationV1/1", uint63-zero, 0..999999999]

principal-kind-v1 = "OWNER_HUMAN" / "DELEGATED_APPROVER" /
  "CLAUDE_CODE_HOST" / "CODEX_CLI_HOST" / "SERVICE_CALLER" / "SCHEDULER" /
  "CONTROL_PLANE" / "ACTION_BROKER" / "PROTECTED_WORKER" /
  "CUSTODY_SERVICE" / "STORE_SERVICE" / "REGISTERED_ADAPTER" /
  "TARGET_SERVICE" / "AUDIT_READER" / "MIGRATION_OPERATOR" /
  "RECOVERY_OPERATOR"
principal-status-v1 = "STAGED" / "ACTIVE" / "SUSPENDED" / "RETIRED"
principal-v1 = ["ECR.Principal/1", id128-v1, principal-kind-v1,
  authentication-profile-ref-v1, principal-status-v1, uint63]

network-authority-v1 =
  ["DNS_ALABEL", tstr .size (1..253)] /
  ["IPV4", tstr .size (7..15)] /
  ["IPV6", tstr .size (2..39)]
namespace-segment-v1 = tstr .size (1..255)
repository-namespace-v1 = [1*64 namespace-segment-v1]
maybe-proxy-ref-v1 = [0] / [1, proxy-identity-ref-v1]
remote-identity-v1 = ["ECR.RemoteIdentity/1", id128-v1, "SSH" / "HTTPS",
  network-authority-v1, 1..65535, repository-namespace-v1,
  namespace-segment-v1, peer-identity-ref-v1, "DENY" / "EXACT_REGISTERED",
  maybe-proxy-ref-v1, "DENY"]
remote-set-v1 = [0*4096 remote-identity-v1]
repository-identity-v1 = ["ECR.RepositoryIdentity/1", id128-v1,
  id128-v1, maybe-id128-v1, "GIT", "GIT_SHA1" / "GIT_SHA256",
  git-common-dir-identity-ref-v1, git-dir-identity-ref-v1,
  root-identity-ref-v1, "EXACT_INSTANCE", remote-set-v1, "EXACT",
  submodule-manifest-ref-v1, "NONE", "DIRECT",
  "CLEAN_ALL" / "CLEAN_TRACKED" / "BOUND_DIRTY_STATE",
  location-identity-ref-v1, id128-v1, uint63, state-evidence-ref-v1]

maybe-bound-dirty-state-ref-v1 = [0] / [1, bound-dirty-state-ref-v1]
repository-state-rule-v1 = ["ECR.RepositoryStateRule/1",
  "CLEAN_ALL" / "CLEAN_TRACKED" / "BOUND_DIRTY_STATE",
  maybe-bound-dirty-state-ref-v1, "MATCH_CURRENT_REGISTERED_EXACT",
  "MATCH_CURRENT_REGISTERED_MANIFEST", "DIRECT_ONLY", "NONE_ALLOWED",
  "FRESH_AND_UNCHANGED"]
provider-tenant-ref-set-v1 = [1*4096 provider-tenant-ref-v1]
environment-identity-v1 = ["ECR.EnvironmentIdentity/1", id128-v1,
  "SYNTHETIC_DEVELOPMENT" / "NONPRODUCTION_CONTROLLED" / "PRODUCTION_USER_DATA",
  nonempty-id128-set-v1, provider-tenant-ref-set-v1,
  qualified-tuple-ref-v1, repository-domain-ref-v1, id128-v1, uint63]
qualified-profile-tuple-v1 = ["ECR.QualifiedProfileTuple/1", id128-v1,
  custody-profile-ref-v1, store-profile-ref-v1, broker-profile-ref-v1,
  adapter-profile-ref-v1, output-profile-ref-v1, output-policy-ref-v1,
  audit-profile-ref-v1, recovery-profile-ref-v1, uint63,
  "QUALIFIED_CURRENT" / "SUSPENDED" / "REVOKED" / "RETIRED"]
```

```cddl
maybe-id128-set-v1 = [0] / [1, id128-set-v1]
principal-kind-set-v1 = [0*16 principal-kind-v1]
environment-class-v1 = "SYNTHETIC_DEVELOPMENT" /
  "NONPRODUCTION_CONTROLLED" / "PRODUCTION_USER_DATA"
environment-class-set-v1 = [0*3 environment-class-v1]
entry-ref-set-v1 = [0*4096 entry-ref-v1]
provider-tenant-target-ref-set-v1 = [0*4096 provider-tenant-target-ref-v1]
operation-ref-set-v1 = [0*4096 operation-ref-v1]
adapter-profile-ref-set-v1 = [0*4096 adapter-profile-ref-v1]
output-policy-ref-set-v1 = [0*4096 output-policy-ref-v1]
qualified-tuple-ref-set-v1 = [0*4096 qualified-tuple-ref-v1]
maybe-service-authority-ref-v1 = [0] / [1, service-authority-ref-v1]
maybe-budget-ref-v1 = [0] / [1, budget-ref-v1]
maybe-time-bound-v1 = [0] / [1, utc-instant-v1]

authority-policy-v1 = ["ECR.AuthorityPolicy/1", id128-v1,
  "OWNER_SCOPE" / "ENVIRONMENT_BASELINE" / "ENTRY_RESTRICTION" / "SERVICE_PROFILE",
  "ALLOW" / "DENY", id128-v1, uint63, uint63, epoch-vector-v1,
  id128-set-v1, principal-kind-set-v1, id128-set-v1, maybe-id128-set-v1,
  id128-set-v1, environment-class-set-v1, entry-ref-set-v1,
  provider-tenant-target-ref-set-v1, operation-ref-set-v1,
  adapter-profile-ref-set-v1, output-policy-ref-set-v1,
  repository-state-rule-v1,
  "CURRENT_HUMAN" / "DURABLE_EXACT_SCOPE" / "SERVICE_PROFILE",
  id128-set-v1, maybe-service-authority-ref-v1, maybe-budget-ref-v1,
  maybe-time-bound-v1, maybe-time-bound-v1, qualified-tuple-ref-set-v1,
  id128-v1, principal-status-v1]

service-authority-v1 = ["ECR.ServiceAuthority/1", id128-v1, id128-v1,
  uint63, id128-v1, id128-v1, id128-v1, entry-ref-v1,
  provider-tenant-target-ref-v1, operation-ref-v1, adapter-profile-ref-v1,
  output-policy-ref-v1, worker-ref-v1, budget-ref-v1,
  receipt-requirement-ref-v1, utc-instant-v1, utc-instant-v1,
  epoch-vector-v1,
  "STAGED" / "ACTIVE" / "SUSPENDED" / "REVOKED" / "EXPIRED" / "RETIRED"]

portable-production-downgrade-authority-v1 = [
  "ECR.PortableProductionDowngradeAuthority/1", id128-v1, id128-v1,
  uint63, id128-v1, id128-v1, id128-v1, baseline-profile-ref-v1,
  portable-profile-ref-v1, "PORTABLE_CUSTODY_RESIDUAL_ONLY",
  owner-readback-ref-v1, utc-instant-v1, utc-instant-v1,
  epoch-vector-v1, audit-requirement-ref-v1,
  "STAGED" / "ACTIVE" / "SUSPENDED" / "REVOKED" / "EXPIRED" / "RETIRED"]
```

```cddl
maybe-approval-ref-v1 = [0] / [1, approval-ref-v1]
maybe-portable-downgrade-ref-v1 = [0] / [1, portable-downgrade-ref-v1]
maybe-trusted-time-input-ref-v1 = [0] / [1, trusted-time-input-ref-v1]
maybe-effect-evidence-ref-v1 = [0] / [1, effect-evidence-ref-v1]
maybe-approval-requirement-ref-v1 = [0] / [1, approval-requirement-ref-v1]

authority-request-v1 = ["ECR.AuthorityRequest/1", id128-v1, id128-v1,
  principal-kind-v1, uint63, id128-v1, repository-ref-v1,
  state-evidence-ref-v1, environment-ref-v1, entry-ref-v1,
  provider-tenant-target-ref-v1, operation-ref-v1, adapter-profile-ref-v1,
  action-digest-ref-v1, attempt-binding-ref-v1, maybe-approval-ref-v1,
  maybe-service-authority-ref-v1, maybe-portable-downgrade-ref-v1,
  epoch-vector-v1, maybe-trusted-time-input-ref-v1, output-policy-ref-v1]

effect-state-v1 = "FRESH" / "RESERVED" / "DISPATCHED" /
  "NO_EFFECT_PROVEN" / "POSSIBLE_EFFECT" / "EFFECT_CONFIRMED" /
  "RECONCILED_NO_EFFECT" / "RECONCILED_EFFECT"
attempt-binding-v1 = ["ECR.AttemptBinding/1", id128-v1,
  idempotency-ref-v1, repository-ref-v1, environment-ref-v1, entry-ref-v1,
  provider-tenant-target-ref-v1, operation-ref-v1, adapter-profile-ref-v1,
  action-digest-ref-v1, effect-state-v1, uint63, maybe-effect-evidence-ref-v1]

authority-result-v1 = "DENIED" / "OWNER_APPROVAL_REQUIRED" /
  "ELIGIBLE_FOR_LATER_PREPARATION"
safe-projection-v1 = "DENIED" / "OWNER_ACTION_REQUIRED" / "PREPARED_ELIGIBLE"
internal-reason-v1 = "AUTHN_FAILED" / "PRINCIPAL_UNSUPPORTED" /
  "HOST_PRINCIPAL_MISMATCH" / "REPOSITORY_CONTEXT_UNAVAILABLE" /
  "REPOSITORY_NOT_REGISTERED" / "REPOSITORY_STATE_CHANGED" /
  "REPOSITORY_ALIAS_UNTRUSTED" / "REPOSITORY_REMOTE_MISMATCH" /
  "REPOSITORY_WORKTREE_UNREGISTERED" / "REPOSITORY_SUBMODULE_UNREGISTERED" /
  "REPOSITORY_CASE_COLLISION" / "REPOSITORY_DIRTY_DISALLOWED" /
  "ENVIRONMENT_NOT_REGISTERED" / "ENVIRONMENT_CLASS_MISMATCH" /
  "CROSS_ENVIRONMENT_DENIED" / "SCOPE_NOT_FOUND_OR_DENIED" /
  "POLICY_SCHEMA_UNSUPPORTED" / "POLICY_CONFLICT_DENY" /
  "POLICY_DEFAULT_DENY" / "POLICY_EPOCH_STALE" /
  "RESTRICTION_EPOCH_STALE" / "REVOKED_OR_QUARANTINED" /
  "ATTEMPT_REPLAY_DENIED" / "POSSIBLE_EFFECT_AMBIGUOUS" /
  "APPROVAL_REQUIRED" / "APPROVAL_INVALID" /
  "SERVICE_IDENTITY_NOT_AUTHORIZED" / "TRUSTED_TIME_REQUIRED" /
  "TRUSTED_TIME_UNAVAILABLE" / "POLICY_NOT_YET_VALID" /
  "POLICY_EXPIRED" / "PROFILE_NOT_QUALIFIED" /
  "PORTABLE_DOWNGRADE_INVALID" / "LATER_STAGE_REQUIRED" /
  "INTERNAL_FAIL_CLOSED"
authority-policy-ref-set-v1 = [0*4096 authority-policy-ref-v1]
identity-evidence-ref-set-v1 = [0*4096 identity-evidence-ref-v1]
later-requirement-v1 = "TC04_CUSTODY_CURRENT" /
  "TC05_STORE_GENERATION_CURRENT" / "TC06_ENTRY_CURRENT" /
  "TC06_APPROVAL_REQUIRED" / "TC06_AUTHORITY_CURRENT" /
  "TC06_LEASE_REQUIRED" / "TC06_ATTEMPT_RESERVATION_CURRENT" /
  "TC07_BROKER_WORKER_AUTHENTICATED" / "TC07_ADAPTER_OUTPUT_QUALIFIED" /
  "TC07_EFFECT_STATE_HANDOFF" / "TC08_AUDIT_READY" /
  "TC08_EFFECT_RECONCILIATION_READY"
later-requirement-set-v1 = [0*12 later-requirement-v1]
authority-decision-v1 = ["ECR.AuthorityDecision/1", id128-v1,
  id128-v1, authority-result-v1, internal-reason-v1, safe-projection-v1,
  authority-policy-ref-set-v1, epoch-vector-v1,
  identity-evidence-ref-set-v1, qualified-tuple-ref-set-v1,
  maybe-approval-requirement-ref-v1, attempt-binding-ref-v1,
  later-requirement-set-v1]
```

```cddl
time-source-class-v1 = "SECURE_PLATFORM_UTC" / "HARDWARE_ATTESTED_UTC" /
  "QUALIFIED_NETWORK_UTC" / "BOOT_BOUND_MONOTONIC_UTC"
time-source-class-set-v1 = [1*4 time-source-class-v1]
time-trust-state-v1 = "QUALIFIED_CURRENT" / "UNAVAILABLE" / "STALE" /
  "ROLLBACK_SUSPECTED" / "CONTINUITY_LOST" / "UNQUALIFIED"
suspend-state-v1 = "NO_SUSPEND_SINCE_EVIDENCE" /
  "RESUME_CONTINUITY_PROVEN" / "RESET_OR_LOSS"
trusted-time-input-v1 = ["ECR.TrustedTimeInput/1", id128-v1,
  time-source-class-v1, time-trust-state-v1, time-profile-ref-v1,
  utc-instant-v1, duration-v1, uint63, boot-ref-v1,
  monotonic-evidence-ref-v1, freshness-ref-v1, utc-skew-evidence-ref-v1,
  suspend-state-v1]
trusted-time-policy-profile-v1 = ["ECR.TrustedTimePolicyProfile/1",
  id128-v1, time-source-class-set-v1, time-source-class-set-v1,
  duration-v1, duration-v1, duration-v1, true,
  "REQUIRE_PROVEN_CONTINUITY"]
utc-skew-evidence-v1 = ["ECR.UtcSkewEvidence/1", id128-v1, id128-v1,
  utc-instant-v1, duration-v1, freshness-ref-v1,
  monotonic-evidence-ref-v1, suspend-state-v1, time-source-class-v1,
  time-trust-state-v1, utc-instant-v1, duration-v1, freshness-ref-v1,
  monotonic-evidence-ref-v1, suspend-state-v1, uint63, boot-ref-v1]

approval-subject-v1 = ["ECR.ApprovalSubject/1", "ECR.AuthorityRequest/1",
  id128-v1, id128-v1, principal-kind-v1, uint63, id128-v1,
  repository-ref-v1, state-evidence-ref-v1, environment-ref-v1,
  entry-ref-v1, provider-tenant-target-ref-v1, operation-ref-v1,
  adapter-profile-ref-v1, action-digest-ref-v1, attempt-binding-ref-v1,
  maybe-portable-downgrade-ref-v1, epoch-vector-v1,
  maybe-trusted-time-input-ref-v1, output-policy-ref-v1]
approval-evidence-v1 = ["ECR.ApprovalEvidence/1", id128-v1, id128-v1,
  uint63, "CURRENT_HUMAN" / "DURABLE_EXACT_SCOPE", owner-question-ref-v1,
  id128-v1, id128-v1, principal-kind-v1, id128-v1, id128-v1,
  state-evidence-ref-v1, id128-v1, entry-ref-v1,
  provider-tenant-target-ref-v1, operation-ref-v1, adapter-profile-ref-v1,
  action-digest-ref-v1, output-policy-ref-v1,
  approval-subject-digest-ref-v1, "APPROVE" / "DENY",
  utc-instant-v1, utc-instant-v1, epoch-vector-v1]
```

For each top-level schema in section 3, the corresponding lowercase `*-v1`
production above is its sole normative wire form. The tag alternatives for
`network-authority-v1`, proxy presence, dirty-state presence, policy
conditionals, authority-path references, approval requirement, effect evidence,
portable downgrade, and trusted time are exhaustive; their TC02 matrices may
narrow the structurally admitted alternatives. Text constraints in TC02
(ASCII/NFC, DNS A-label, canonical IP text, forbidden namespace segments) are
decode predicates and are checked before canonical re-encoding. No generic
reference production may substitute for a field-specific production.

## 4. Disjoint references and digests

No wire value decodes as two classes. The closed classes are `OpaqueIdV1`,
`DigestRefV1`, `ProtectedObjectRefV1`, `RegistryRefV1`, and `DomainRefV1`.
They use distinct type codes 1 through 5, respectively. All IDs are 16-byte
opaque byte strings; every digest is an untruncated 32-byte SHA-256 value.

`DigestRefV1` is exact immutable content. `ProtectedObjectRefV1` binds kind,
identity, generation, and digest. `RegistryRefV1` names a protected registry
key whose current status, resolution, qualification, restrictions, and epoch
vector are checked. `DomainRefV1` is an explicit cryptographic domain only.

Text, hex, base64, truncated/bare digests, aliases, cross-class substitution,
and caller projections are forbidden. Later-owned references such as leases or
unfinished action/output/evidence objects cannot appear finalized.

The normative reference CDDL is:

```cddl
uint63 = 1..9223372036854775807
sha256-v1 = bstr .size 32
digest-domain-v1 = "ECR-D1/OBJECT" / "ECR-D1/ACTION" /
  "ECR-D1/APPROVAL-SUBJECT" / "ECR-D1/REPOSITORY-STATE" /
  "ECR-D1/SUBMODULE-MANIFEST" / "ECR-D1/POLICY" /
  "ECR-D1/PROFILE-TUPLE" / "ECR-D1/OUTPUT-POLICY" /
  "ECR-D1/EPOCH-VECTOR" / "ECR-D1/AUTHORITY-REQUEST" /
  "ECR-D1/AUTHORITY-DECISION" / "ECR-D1/APPROVAL-EVIDENCE" /
  "ECR-D1/SERVICE-AUTHORITY" / "ECR-D1/PORTABLE-DOWNGRADE" /
  "ECR-D1/ATTEMPT" / "ECR-D1/EFFECT-EVIDENCE" /
  "ECR-D1/ENTRY-VERSION" / "ECR-D1/AUDIT-RECORD" /
  "ECR-D1/RECEIPT" / "ECR-D1/BACKUP-MANIFEST" /
  "ECR-D1/MIGRATION-MANIFEST" / "ECR-D1/ENVELOPE"
schema-id-v1 = tstr .size (1..64)
opaque-id-v1 = [1, 1, object-kind-v1, bstr .size 16]
digest-ref-v1 = [1, 2, digest-domain-v1, schema-id-v1, sha256-v1]
protected-object-ref-v1 =
  [1, 3, object-kind-v1, bstr .size 16, uint63, digest-ref-v1]
registry-ref-v1 = [1, 4, registry-kind-v1, bstr .size 16]
domain-ref-v1 = [1, 5, domain-kind-v1, bstr .size 16]

object-kind-v1 = "PRINCIPAL" / "REPOSITORY_IDENTITY" / "ENVIRONMENT_IDENTITY" /
  "REPOSITORY_STATE" / "AUTHORITY_REQUEST" / "AUTHORITY_DECISION" / "EPOCH_VECTOR" /
  "APPROVAL" / "APPROVAL_REQUIREMENT" / "ATTEMPT" /
  "TIME_EVIDENCE" / "STATE_EVIDENCE" / "EFFECT_EVIDENCE" /
  "POLICY_EVIDENCE" / "AUTHORITY_POLICY" / "POLICY_SET" / "SERVICE_AUTHORITY" /
  "PORTABLE_DOWNGRADE" / "SUBMODULE_MANIFEST" /
  "OWNER_QUESTION" / "OWNER_READBACK" / "ENVELOPE"
registry-kind-v1 = "ENTRY" / "TARGET" / "OPERATION" / "ADAPTER" / "ADAPTER_PROFILE" /
  "WORKER" / "OUTPUT_PROFILE" / "AUDIT_PROFILE" / "RECOVERY_PROFILE" /
  "MIGRATION_PROFILE" / "CUSTODY_PROFILE" / "STORE_PROFILE" /
  "QUALIFIED_PROFILE_TUPLE" / "OUTPUT_POLICY" /
  "AUTHENTICATION_PROFILE" / "BASELINE_PROFILE" / "TIME_PROFILE" /
  "PORTABLE_PROFILE" / "BROKER_PROFILE" / "STORE" / "DOMAIN_KEY" / "CUSTODY_SLOT" /
  "RECOVERY_SLOT" / "RECIPIENT" / "PROVIDER" / "TENANT" / "PROVIDER_TENANT" /
  "GIT_DIR_IDENTITY" / "GIT_COMMON_DIR_IDENTITY" / "ROOT_IDENTITY" /
  "LOCATION_IDENTITY" / "PEER_IDENTITY" / "PROXY_IDENTITY" /
  "PROVIDER_TENANT_TARGET" / "BUDGET" / "RECEIPT" /
  "RECEIPT_REQUIREMENT" / "AUDIT_REQUIREMENT" / "BOOT" / "IDEMPOTENCY"
domain-kind-v1 = "REPOSITORY_ENVIRONMENT" / "METADATA" / "AUDIT" /
  "BACKUP" / "MIGRATION" / "RECOVERY"

repository-digest-ref-v1 =
  [1, 2, "ECR-D1/OBJECT", "ECR.RepositoryIdentity/1", sha256-v1]
principal-digest-ref-v1 =
  [1, 2, "ECR-D1/OBJECT", "ECR.Principal/1", sha256-v1]
environment-digest-ref-v1 =
  [1, 2, "ECR-D1/OBJECT", "ECR.EnvironmentIdentity/1", sha256-v1]
authority-digest-ref-v1 =
  [1, 2, "ECR-D1/AUTHORITY-DECISION", "ECR.AuthorityDecision/1", sha256-v1]
authority-request-digest-ref-v1 =
  [1, 2, "ECR-D1/AUTHORITY-REQUEST", "ECR.AuthorityRequest/1", sha256-v1]
authority-policy-digest-ref-v1 =
  [1, 2, "ECR-D1/POLICY", "ECR.AuthorityPolicy/1", sha256-v1]
epoch-digest-ref-v1 =
  [1, 2, "ECR-D1/EPOCH-VECTOR", "ECR.EpochVector/1", sha256-v1]
policy-set-digest-ref-v1 =
  [1, 2, "ECR-D1/POLICY", "ECR.PolicySet/1", sha256-v1]
stored-envelope-digest-ref-v1 =
  [1, 2, "ECR-D1/ENVELOPE", "ECR.StoredEnvelope/1", sha256-v1]
action-digest-ref-v1 =
  [1, 2, "ECR-D1/ACTION", "ECR.PreparedAction/1", sha256-v1]
approval-subject-digest-ref-v1 =
  [1, 2, "ECR-D1/APPROVAL-SUBJECT", "ECR.ApprovalSubject/1", sha256-v1]

repository-ref-v1 =
  [1, 3, "REPOSITORY_IDENTITY", bstr .size 16, uint63, repository-digest-ref-v1]
environment-ref-v1 =
  [1, 3, "ENVIRONMENT_IDENTITY", bstr .size 16, uint63, environment-digest-ref-v1]
authority-decision-ref-v1 =
  [1, 3, "AUTHORITY_DECISION", bstr .size 16, uint63, authority-digest-ref-v1]
authority-request-ref-v1 =
  [1, 3, "AUTHORITY_REQUEST", bstr .size 16, uint63, authority-request-digest-ref-v1]
authority-policy-ref-v1 =
  [1, 3, "AUTHORITY_POLICY", bstr .size 16, uint63, authority-policy-digest-ref-v1]
epoch-vector-object-ref-v1 =
  [1, 3, "EPOCH_VECTOR", bstr .size 16, uint63, epoch-digest-ref-v1]
policy-set-ref-v1 =
  [1, 3, "POLICY_SET", bstr .size 16, uint63, policy-set-digest-ref-v1]
principal-ref-v1 =
  [1, 3, "PRINCIPAL", bstr .size 16, uint63, principal-digest-ref-v1]
approval-ref-v1 = [1, 3, "APPROVAL", bstr .size 16, uint63,
  [1, 2, "ECR-D1/APPROVAL-EVIDENCE", "ECR.ApprovalEvidence/1", sha256-v1]]
approval-requirement-ref-v1 = [1, 3, "APPROVAL_REQUIREMENT", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.ApprovalRequirement/1", sha256-v1]]
attempt-binding-ref-v1 = [1, 3, "ATTEMPT", bstr .size 16, uint63,
  [1, 2, "ECR-D1/ATTEMPT", "ECR.AttemptBinding/1", sha256-v1]]
service-authority-ref-v1 = [1, 3, "SERVICE_AUTHORITY", bstr .size 16, uint63,
  [1, 2, "ECR-D1/SERVICE-AUTHORITY", "ECR.ServiceAuthority/1", sha256-v1]]
portable-downgrade-ref-v1 = [1, 3, "PORTABLE_DOWNGRADE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/PORTABLE-DOWNGRADE",
   "ECR.PortableProductionDowngradeAuthority/1", sha256-v1]]
trusted-time-input-ref-v1 = [1, 3, "TIME_EVIDENCE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.TrustedTimeInput/1", sha256-v1]]
utc-skew-evidence-ref-v1 = [1, 3, "TIME_EVIDENCE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.UtcSkewEvidence/1", sha256-v1]]
state-evidence-ref-v1 = [1, 3, "STATE_EVIDENCE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/REPOSITORY-STATE", "ECR.RepositoryStateEvidence/1", sha256-v1]]
bound-dirty-state-ref-v1 = [1, 3, "REPOSITORY_STATE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/REPOSITORY-STATE", "ECR.BoundDirtyState/1", sha256-v1]]
submodule-manifest-ref-v1 = [1, 3, "SUBMODULE_MANIFEST", bstr .size 16, uint63,
  [1, 2, "ECR-D1/SUBMODULE-MANIFEST", "ECR.SubmoduleManifest/1", sha256-v1]]
effect-evidence-ref-v1 = [1, 3, "EFFECT_EVIDENCE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/EFFECT-EVIDENCE", "ECR.EffectEvidence/1", sha256-v1]]
time-evidence-ref-v1 = [1, 3, "TIME_EVIDENCE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.TimeEvidence/1", sha256-v1]]
owner-question-ref-v1 = [1, 3, "OWNER_QUESTION", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.OwnerQuestion/1", sha256-v1]]
owner-readback-ref-v1 = [1, 3, "OWNER_READBACK", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.OwnerReadback/1", sha256-v1]]
freshness-ref-v1 = [1, 3, "TIME_EVIDENCE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.FreshnessEvidence/1", sha256-v1]]
monotonic-evidence-ref-v1 = [1, 3, "TIME_EVIDENCE", bstr .size 16, uint63,
  [1, 2, "ECR-D1/OBJECT", "ECR.MonotonicEvidence/1", sha256-v1]]

store-ref-v1 = [1, 4, "STORE", bstr .size 16]
domain-key-ref-v1 = [1, 4, "DOMAIN_KEY", bstr .size 16]
entry-ref-v1 = [1, 4, "ENTRY", bstr .size 16]
provider-ref-v1 = [1, 4, "PROVIDER", bstr .size 16]
tenant-ref-v1 = [1, 4, "TENANT", bstr .size 16]
target-ref-v1 = [1, 4, "TARGET", bstr .size 16]
operation-ref-v1 = [1, 4, "OPERATION", bstr .size 16]
adapter-ref-v1 = [1, 4, "ADAPTER", bstr .size 16]
adapter-profile-ref-v1 = [1, 4, "ADAPTER_PROFILE", bstr .size 16]
output-policy-ref-v1 = [1, 4, "OUTPUT_POLICY", bstr .size 16]
qualified-tuple-ref-v1 = [1, 4, "QUALIFIED_PROFILE_TUPLE", bstr .size 16]
custody-slot-ref-v1 = [1, 4, "CUSTODY_SLOT", bstr .size 16]
authentication-profile-ref-v1 = [1, 4, "AUTHENTICATION_PROFILE", bstr .size 16]
baseline-profile-ref-v1 = [1, 4, "BASELINE_PROFILE", bstr .size 16]
broker-profile-ref-v1 = [1, 4, "BROKER_PROFILE", bstr .size 16]
custody-profile-ref-v1 = [1, 4, "CUSTODY_PROFILE", bstr .size 16]
store-profile-ref-v1 = [1, 4, "STORE_PROFILE", bstr .size 16]
output-profile-ref-v1 = [1, 4, "OUTPUT_PROFILE", bstr .size 16]
audit-profile-ref-v1 = [1, 4, "AUDIT_PROFILE", bstr .size 16]
recovery-profile-ref-v1 = [1, 4, "RECOVERY_PROFILE", bstr .size 16]
migration-profile-ref-v1 = [1, 4, "MIGRATION_PROFILE", bstr .size 16]
portable-profile-ref-v1 = [1, 4, "PORTABLE_PROFILE", bstr .size 16]
time-profile-ref-v1 = [1, 4, "TIME_PROFILE", bstr .size 16]
git-dir-identity-ref-v1 = [1, 4, "GIT_DIR_IDENTITY", bstr .size 16]
git-common-dir-identity-ref-v1 = [1, 4, "GIT_COMMON_DIR_IDENTITY", bstr .size 16]
root-identity-ref-v1 = [1, 4, "ROOT_IDENTITY", bstr .size 16]
location-identity-ref-v1 = [1, 4, "LOCATION_IDENTITY", bstr .size 16]
peer-identity-ref-v1 = [1, 4, "PEER_IDENTITY", bstr .size 16]
proxy-identity-ref-v1 = [1, 4, "PROXY_IDENTITY", bstr .size 16]
provider-tenant-ref-v1 = [1, 4, "PROVIDER_TENANT", bstr .size 16]
provider-tenant-target-ref-v1 = [1, 4, "PROVIDER_TENANT_TARGET", bstr .size 16]
worker-ref-v1 = [1, 4, "WORKER", bstr .size 16]
budget-ref-v1 = [1, 4, "BUDGET", bstr .size 16]
receipt-requirement-ref-v1 = [1, 4, "RECEIPT_REQUIREMENT", bstr .size 16]
audit-requirement-ref-v1 = [1, 4, "AUDIT_REQUIREMENT", bstr .size 16]
boot-ref-v1 = [1, 4, "BOOT", bstr .size 16]
idempotency-ref-v1 = [1, 4, "IDEMPOTENCY", bstr .size 16]
recipient-ref-v1 = [1, 4, "RECIPIENT", bstr .size 16]
repository-domain-ref-v1 = [1, 5, "REPOSITORY_ENVIRONMENT", bstr .size 16]

policy-set-v1 = ["ECR.PolicySet/1", 1*4096 authority-policy-ref-v1]
identity-evidence-ref-v1 = principal-ref-v1 / repository-ref-v1 /
  environment-ref-v1 / state-evidence-ref-v1 / time-evidence-ref-v1
```

`schema-id-v1` is an ASCII CBOR text string of 1..64 bytes and is the exact
identifier of one frozen schema named in
section 3, section 6, or a later independently closed schema; a consumer must
also have that identifier registered for the expected reference field. Merely
being syntactically valid text does not register it. Domain and schema in the
reference must equal the expected field domain/schema before digest comparison.

TC02 `_ref` mapping is exhaustive. `DigestRefV1`: `digest_ref`,
`approval_subject_digest_ref`, `exact_action_digest_ref`. `DomainRefV1`:
`environment_domain_ref`. `ProtectedObjectRefV1`: `approval_ref`,
`approval_requirement_ref`, `attempt_binding_ref`,
`effective_attempt_binding_ref`, `bound_dirty_state_ref`,
`repository_identity_ref`, `environment_identity_ref`,
`repository_state_evidence_ref`, `state_evidence_ref`, `freshness_ref`,
`candidate_freshness_ref`, `reference_freshness_ref`,
`monotonic_evidence_ref`, `candidate_monotonic_evidence_ref`,
`reference_monotonic_evidence_ref`, `skew_evidence_ref`,
`trusted_time_input_ref`, `last_effect_evidence_ref`, `identity_evidence_refs`,
`applicable_policy_refs`, `service_authority_ref`,
`portable_production_downgrade_ref`, `owner_question_ref`,
`risk_readback_ref`, and `submodule_manifest_ref`.

`RegistryRefV1`: every authentication, baseline, broker, custody, store,
adapter, audit, recovery, portable, time, output, and qualified-profile ref;
`qualified_worker_ref`; `git_dir_identity_ref`, `git_common_dir_identity_ref`,
`registered_root_identity_ref`, `registered_location_ref`, `peer_identity_ref`,
`proxy_identity_ref`; `entry_ref(s)`; `provider_tenant_ref(s)`,
`provider_tenant_target_ref(s)`; `operation_ref(s)`; `output_policy_ref(s)` and
`requested_output_policy_ref`; `budget_ref`; `receipt_requirement_ref`;
`later_audit_requirement_ref`; `idempotency_key_ref`; and `boot_id_ref`.
`lease_ref` is nonserializable until its owning later schema closes. Singular
and plural fields use the same member class; plural fields are canonical sets.
No unlisted TC02 `_ref` spelling is valid.

Each field also requires its exact kind literal: service authority,
portable downgrade, submodule manifest, approval requirement, and last-effect
fields use `SERVICE_AUTHORITY`, `PORTABLE_DOWNGRADE`, `SUBMODULE_MANIFEST`,
`APPROVAL_REQUIREMENT`, and `EFFECT_EVIDENCE`; repository/environment/principal,
approval, attempt, time/state/policy evidence, epoch vector, policy set, owner
readback, and envelope fields likewise use their same-named object kind.
`owner_question_ref` uses `OWNER_QUESTION`; `applicable_policy_refs` use
`AUTHORITY_POLICY`; `identity_evidence_refs` use only the closed
`identity-evidence-ref-v1` union.
Profile fields use the specific same-named registry kind, never generic
`QUALIFIED_PROFILE`, except `qualified_profile_ref(s)` which use
`QUALIFIED_PROFILE_TUPLE`. Store identity uses `STORE` and never
`STORE_PROFILE`; custody slot, recipient, migration profile, output policy,
authentication/baseline/portable/time profile, and Git/common/root/location/
peer/proxy identity fields use their exact same-named registry kind. A kind
mismatch rejects before lookup even if opaque bytes match.

`policy-set-v1` contains 1..4,096 exact current `AuthorityPolicyV1` protected
references sorted by complete canonical bytes with no duplicate identity or
bytes. Its digest is the section-4 transcript over the entire canonical array
under `ECR-D1/POLICY` and `ECR.PolicySet/1`. Empty, stale, extra, missing,
duplicate, or reordered policy sets reject before unwrap.

The digest transcript is SHA-256 over a length-framed tuple containing the
literal `ECR-DIGEST/1`, exact `ECR-D1/` domain identifier, exact schema
identifier, and complete canonical body. Identifier lengths are unsigned
big-endian 16-bit and body length is unsigned big-endian 64-bit. Domains cover
object, action, approval subject, repository state, manifests, policy/profile,
epoch vector, authority request/decision, evidence, attempt, entry version,
audit, receipt, and envelope. Git hashes never serve as ECR digests.

```text
SHA-256(
  ASCII("ECR-DIGEST/1") ||
  U16BE(length(domain_ascii)) || domain_ascii ||
  U16BE(length(schema_ascii)) || schema_ascii ||
  U64BE(length(canonical_body)) || canonical_body
)
```

The fixed literal is exactly the 12 displayed ASCII bytes and is not separately
framed. `domain_ascii` is exactly one of: `ECR-D1/OBJECT`, `ECR-D1/ACTION`,
`ECR-D1/APPROVAL-SUBJECT`, `ECR-D1/REPOSITORY-STATE`,
`ECR-D1/SUBMODULE-MANIFEST`, `ECR-D1/POLICY`, `ECR-D1/PROFILE-TUPLE`,
`ECR-D1/OUTPUT-POLICY`, `ECR-D1/EPOCH-VECTOR`,
`ECR-D1/AUTHORITY-REQUEST`, `ECR-D1/AUTHORITY-DECISION`,
`ECR-D1/APPROVAL-EVIDENCE`, `ECR-D1/SERVICE-AUTHORITY`,
`ECR-D1/PORTABLE-DOWNGRADE`, `ECR-D1/ATTEMPT`,
`ECR-D1/EFFECT-EVIDENCE`, `ECR-D1/ENTRY-VERSION`,
`ECR-D1/AUDIT-RECORD`, `ECR-D1/RECEIPT`, `ECR-D1/BACKUP-MANIFEST`,
`ECR-D1/MIGRATION-MANIFEST`, or `ECR-D1/ENVELOPE`. Positive and
wrong-domain vectors are mandatory for every row.

For public, noncredential objects: build a body without its own digest or
authentication output; canonicalize/hash; bind that digest and prior finalized
references; finalize; then put its finalized digest only in an external/later
object. For credential-bearing objects there is no plaintext body digest: AEAD
authenticates canonical plaintext and only the finalized ciphertext-bearing
envelope receives an external digest. No digest contains itself directly or
transitively. Audit links point backward. An epoch-vector digest never replaces
the complete protected vector.

An unkeyed digest of credential-bearing plaintext is never placed in a clear
header, AAD, index, manifest, reference, log, or receipt. For stored/transfer
plaintext the canonical bytes are authenticated by GCM and remain encrypted;
the externally referenceable envelope digest is computed only over the
finalized ciphertext-bearing envelope. Any later keyed internal plaintext
commitment requires a new closed domain and stays inside encrypted content.

## 5. Suite and hierarchy

The production tuple is SHA-256; HKDF-Extract/Expand with HMAC-SHA-256 and
32-byte output; AES-256-GCM with a fresh independent random 32-byte CEK,
12-byte IV, and exact 16-byte tag; AES-256-KWP with a 32-byte wrapping value and
exact 40-byte wrapped 32-byte child; and qualified CTR_DRBG-AES-256.

The DRBG profile requests 256-bit security, uses the derivation function, and
requests at most 64 output bytes per generate call. Prediction resistance is
enabled; a provider that cannot expose and validate that mode is unsupported.
Reseed occurs before `2^20` generate calls or the provider's stricter limit,
and after every process fork, restore, snapshot resume, provider restart, or
health-event boundary before further output. State cloning is forbidden. The
approved entropy source, instantiation/reseed evidence, request counter, and
fork/restart behavior are required future TC10 fields of the nonserializable
`FipsProviderProfileV1` template.

One independent random 256-bit vault root exists per store. Platform and
recovery custody slots wrap it; it never encrypts payloads or derives from user
input. Independent random domain masters exist for each repository/environment
plus metadata, audit, backup, migration, and recovery. Every object version has
an independent random CEK. All levels are independently generated.

Within qualified custody, HKDF derives context-specific wrapping material from
the parent level, a SHA-256 salt bound to the domain, and canonical context.
Context includes suite, envelope kind, store, repository, environment, domain,
parent/child identifiers, complete epochs, wrapping generation, and recipient.
AES-KWP has no AAD, so derivation and GCM AAD both bind the full context. Root,
domain-master, and derived wrapping material never leave qualified custody.
Unsupported custody blocks. Any CEK rewrap, wrapping-generation change,
custody/recipient change, or wrapped-CEK change emits a fresh envelope ID, CEK
ID, CEK, IV, ciphertext, tag, and outer digest. Only a root/domain-slot record
outside a content envelope may be rewrapped without changing entry ciphertext,
and only under its later closed authenticated record. No old ciphertext/tag
survives a CEK rewrap.

The exact derivation inputs are complete, non-circular projections of the
envelope being created or opened. They copy every variable envelope field,
including both random IDs, store generation inside the complete bindings,
kind-specific generation/profile/recipient/destination values, and the exact
canonical protected header. They exclude only the AES-KWP result and the COSE
ciphertext/tag. The fixed COSE tag, array shape, and empty unprotected map are
already fixed by section 7 and are not variable context fields.

```cddl
stored-kdf-context-v1 = [
  "ECR.KwpEnvelopeContext/1", 1, 1, 1, id128, id128,
  common-bindings-v1, custody-slot-ref-v1, uint63,
  ecr-protected-header-v1
]
nonprod-stored-kdf-context-v1 = [
  "ECR.KwpEnvelopeContext/1", 1, 2, 1, id128, id128,
  common-bindings-v1, custody-slot-ref-v1, uint63,
  ecr-protected-header-v1
]
recovery-kdf-context-v1 = [
  "ECR.KwpEnvelopeContext/1", 1, 1, 2, id128, id128,
  transfer-bindings-v1, stored-envelope-digest-ref-v1,
  recovery-profile-ref-v1, recipient-ref-v1,
  authority-decision-ref-v1, uint63, ecr-protected-header-v1
]
migration-kdf-context-v1 = [
  "ECR.KwpEnvelopeContext/1", 1, 1, 3, id128, id128,
  transfer-bindings-v1, stored-envelope-digest-ref-v1,
  migration-profile-ref-v1, recipient-ref-v1,
  authority-decision-ref-v1, repository-ref-v1, environment-ref-v1,
  repository-domain-ref-v1, uint63, ecr-protected-header-v1
]
```

```text
d = canonical(domain_ref)
salt = SHA-256(ASCII("ECR-HKDF-SALT/1") || U64BE(length(d)) || d)
info = canonical(the exact kind-specific context above)
wrapping_material = HKDF-SHA-256(parent_material, salt, info, 32)
```

After the context-schema literal, the next three values are context version,
content-suite ID, and kind. The following two values are the envelope and CEK
IDs. Stored context then includes the complete `common-bindings-v1`, custody
slot, wrapping generation, and protected header. Recovery and migration include
the complete `transfer-bindings-v1`, source envelope, profile, recipient,
the one request-linked authority decision, transfer generation, and protected
header; migration additionally includes destination repository, environment,
and domain. Thus the store and its generation, source and destination scope,
entry/version/value/exact provider-tenant-target tuple/operation/principal/adapter/output,
request/decision/policy/epoch/profile/lifecycle/expiry/predecessor bindings,
parent domain key and epoch, transfer authority, and recipient are all in the
KWP derivation transcript. Complete cross-runtime salt/info/output vectors are mandatory.
Production stored envelopes use only `stored-kdf-context-v1`; nonproduction
stored envelopes use only `nonprod-stored-kdf-context-v1`. Context suite must
byte-equal outer and protected-header suite. Cross-suite derivation rejects.
For each kind, construct the context only by copying the admitted envelope's
canonical decoded values; never accept a supplied context. Every copied value
must be byte-for-byte equal to its source canonical field. Context envelope ID
and CEK ID equal outer labels 3 and 4; CEK ID also equals protected key ID;
kind/suite equal outer labels 2 and 1 and protected labels `-65538`/`-65539`;
the complete bindings equal outer label 5; and every following context value
equals its same-position outer value. Recovery/migration decision equality also
obeys section 6's request/decision rule. The protected-header value is the
canonical decoded map whose exact encoded bytes are carried in COSE. Any
missing field or byte inequality rejects before KDF or unwrap. Transplanting a
wrapped CEK while changing any included field derives different wrapping
material and must fail KWP before GCM; no implementation may defer that
transplant check to GCM. The only omitted envelope outputs are the wrapped CEK
and COSE ciphertext/tag, which cannot circularly derive themselves.

## 6. Closed envelope records

The following CDDL is normative for structure; explicit equality, presence,
ordering, and resolution rules are also normative, while prose field names are
commentary. Counters are positive
uint63. Envelope and CEK IDs are fresh random 16-byte values. A wrapped 32-byte
CEK is exactly 40 bytes. Value-type and lifecycle are closed integer enums.

```cddl
id128 = bstr .size 16
maybe-registry-ref-v1 = [0] / [1, registry-ref-v1]
maybe-digest-ref-v1 = [0] / [1, digest-ref-v1]
maybe-utc-instant-v1 = [0] / [1, utc-instant-v1]
maybe-stored-envelope-ref-v1 = [0] / [1, stored-envelope-digest-ref-v1]
value-type-v1 = 1 / 2 / 3 / 4 / 5
lifecycle-v1 = 1 / 2 / 3 / 4
common-bindings-v1 = [
  1, store-ref-v1, uint63,
  repository-ref-v1, environment-ref-v1, repository-domain-ref-v1,
  domain-key-ref-v1, uint63,
  entry-ref-v1, uint63, value-type-v1,
  provider-tenant-target-ref-v1,
  operation-ref-v1, principal-ref-v1, adapter-profile-ref-v1,
  output-policy-ref-v1, authority-request-ref-v1, authority-decision-ref-v1,
  policy-set-digest-ref-v1, policy-set-ref-v1,
  epoch-digest-ref-v1, epoch-vector-object-ref-v1,
  qualified-tuple-ref-v1, lifecycle-v1, maybe-utc-instant-v1,
  maybe-stored-envelope-ref-v1
]
transfer-bindings-v1 = [
  1, store-ref-v1, uint63,
  repository-ref-v1, environment-ref-v1, repository-domain-ref-v1,
  domain-key-ref-v1, uint63,
  entry-ref-v1, uint63, value-type-v1,
  provider-tenant-target-ref-v1,
  operation-ref-v1, principal-ref-v1, adapter-profile-ref-v1,
  output-policy-ref-v1, authority-request-ref-v1, authority-decision-ref-v1,
  policy-set-digest-ref-v1, policy-set-ref-v1,
  epoch-digest-ref-v1, epoch-vector-object-ref-v1,
  qualified-tuple-ref-v1, lifecycle-v1, maybe-utc-instant-v1,
  [0]
]

stored-envelope-v1 = {
  0: 1, 1: 1, 2: 1, 3: id128, 4: id128,
  5: common-bindings-v1, 6: custody-slot-ref-v1,
  7: uint63, 8: bstr .size 40, 9: cose-encrypt0-v1
}
stored-envelope-aad-v1 = {
  0: 1, 1: 1, 2: 1, 3: id128, 4: id128,
  5: common-bindings-v1, 6: custody-slot-ref-v1,
  7: uint63, 8: bstr .size 40
}
nonprod-stored-envelope-v1 = {
  0: 1, 1: 2, 2: 1, 3: id128, 4: id128,
  5: common-bindings-v1, 6: custody-slot-ref-v1,
  7: uint63, 8: bstr .size 40, 9: cose-encrypt0-v1
}
nonprod-stored-envelope-aad-v1 = {
  0: 1, 1: 2, 2: 1, 3: id128, 4: id128,
  5: common-bindings-v1, 6: custody-slot-ref-v1,
  7: uint63, 8: bstr .size 40
}
```

In `common-bindings-v1`, positions after the leading version are store,
store generation, repository, environment, domain, parent domain-key reference,
parent epoch, entry, entry version, value
type, exact provider/tenant/target tuple, operation, caller principal,
exact adapter profile, exact output policy, authority request, authority decision,
applicable-policy-set digest and protected set,
epoch-vector digest, protected complete vector, qualified profile, lifecycle,
tagged optional expiry, and tagged optional prior-envelope digest. Value types 1..5 are user-auth,
bearer, service-auth, certificate, and opaque; lifecycle 1..4 is current,
superseded, revoked, and tombstoned. These bindings are authenticated and are
not replaced by the authority-decision reference.

The `provider-tenant-target-ref-v1` and output-policy/profile/policy-set fields
must byte-equal the authority request, decision, and qualified tuple wherever
that locked schema carries the field; provider, tenant, or target may not be
split, defaulted, omitted, recombined, or substituted. Its complete canonical
bytes are copied unchanged inside AAD label 5 and the KWP context's complete
bindings and are byte-compared before KDF or unwrap. The protected policy set
independently binds its
exact allowed-principal set, adapter set, output policy, operations, lifecycle,
and expiry; the direct principal/adapter/output/operation values must be members
and byte-equal the selected action. Effective expiry is the earliest exclusive
expiry across every applicable policy, human approval or service authority,
entry restriction, and later action bound. It is absent only when every
applicable source is absent. The envelope stores that result and recomputes it
from current protected policies, approval or service authority, and later
action bound referenced by the exact request and decision. Locked TC02 request
and decision schemas gain no expiry field. Any recomputed mismatch, later
value, or invalid absence denies.
The protected request reference must resolve to the immutable canonical
`AuthorityRequestV1`; its `request_id` must byte-equal the decision's
`request_id`. Exact action, approval evidence or service authority, adapter,
output policy, scope, epochs, and expiry inputs are recomputed through that
request and its protected references. Missing, stale, substituted, or
ambiguous resolution denies before unwrap.
Prior envelope is absent iff entry version is 1;
otherwise it is present and identifies the immediately prior finalized
envelope. Policy-set digest and protected set obey the same digest/resolution/
membership equality rule as the epoch vector.

The epoch digest must equal the digest inside the protected vector reference
and the digest recomputed from its resolved canonical `EpochVectorV1`. The
resolved vector must be exact and current. Mismatch, stale/ambiguous resolution,
or any extra/missing member rejects before unwrap.

Recovery and migration are separate maps and AAD projections:

```cddl
recovery-envelope-v1 = {
  0: 1, 1: 1, 2: 2, 3: id128, 4: id128,
  5: transfer-bindings-v1, 6: stored-envelope-digest-ref-v1,
  7: recovery-profile-ref-v1, 8: recipient-ref-v1,
  9: authority-decision-ref-v1, 10: uint63,
  11: bstr .size 40, 12: cose-encrypt0-v1
}
recovery-envelope-aad-v1 = {
  0: 1, 1: 1, 2: 2, 3: id128, 4: id128,
  5: transfer-bindings-v1, 6: stored-envelope-digest-ref-v1,
  7: recovery-profile-ref-v1, 8: recipient-ref-v1,
  9: authority-decision-ref-v1, 10: uint63, 11: bstr .size 40
}
migration-envelope-v1 = {
  0: 1, 1: 1, 2: 3, 3: id128, 4: id128,
  5: transfer-bindings-v1, 6: stored-envelope-digest-ref-v1,
  7: migration-profile-ref-v1, 8: recipient-ref-v1,
  9: authority-decision-ref-v1,
  10: repository-ref-v1, 11: environment-ref-v1,
  12: repository-domain-ref-v1, 13: uint63,
  14: bstr .size 40, 15: cose-encrypt0-v1
}
migration-envelope-aad-v1 = {
  0: 1, 1: 1, 2: 3, 3: id128, 4: id128,
  5: transfer-bindings-v1, 6: stored-envelope-digest-ref-v1,
  7: migration-profile-ref-v1, 8: recipient-ref-v1,
  9: authority-decision-ref-v1,
  10: repository-ref-v1, 11: environment-ref-v1,
  12: repository-domain-ref-v1, 13: uint63, 14: bstr .size 40
}
```

Recovery positions 6..11 are source envelope, recovery profile, recipient,
recovery authority, transfer generation, and wrapped CEK. Migration positions
6..14 are source envelope, migration profile, recipient, migration authority,
destination repository/environment/domain, transfer generation, and wrapped
CEK. No other label or conditional omission is valid.

`transfer-bindings-v1` is identical to stored common bindings except its final
prior-envelope slot is normatively `[0]`. Label 6 is the sole source/predecessor
for recovery and migration. Any present common prior, absent source, or mismatch
between label 6 and decrypted transfer plaintext rejects.
Recovery/migration label 9 must byte-equal the authority-decision reference
inside `transfer-bindings-v1`; it is a redundant kind-position binding, never a
second independent authority. The immutable request in transfer bindings is the
request linked to that same decision. Substituting only label 9, its decision,
or its request rejects before unwrap.

```cddl
stored-plaintext-v1 = {
  0: 1, 1: entry-ref-v1, 2: bstr .size (1..1048576)
}
transfer-plaintext-v1 = {
  0: 1, 1: entry-ref-v1, 2: bstr .size (1..1048576),
  3: stored-envelope-digest-ref-v1
}
```

Plaintext labels are version, entry, value, and—only for transfer—source
envelope. Inner references must byte-equal outer bindings. Prose names never
override the CDDL.

A stored envelope is never an export, sync, recovery, or migration artifact.
Relabeling or copying its COSE object or wrapped CEK is forbidden. Transfers
need current authority/epochs, a qualified recipient, and fresh envelope ID,
CEK ID, CEK, IV, and wrap. Destination installation creates a new stored
envelope in the destination domain. A transfer envelope cannot be installed.

## 7. Narrow COSE profile

```cddl
cose-encrypt0-v1 = #6.16([
  protected: bstr .size (1..512),
  unprotected: {},
  ciphertext_and_tag: bstr .size (17..1048703)
])
ecr-protected-header-v1 = {
  1: 3,
  2: [-65537, -65538, -65539],
  3: "application/ecr-entry+cbor" /
     "application/ecr-recovery+cbor" /
     "application/ecr-migration+cbor",
  4: id128,
  5: bstr .size 12,
  -65537: 1,
  -65538: 1 / 2 / 3,
  -65539: 1 / 2
}
enc-structure-v1 = ["Encrypt0", bstr, bstr]
```

The first COSE field is the exact canonical bytes of
`ecr-protected-header-v1`; the second is exactly empty; ciphertext is never
nil. Private labels mean header version, envelope kind, and suite ID in that
order. Media type/kind must agree with the outer kind; key ID equals outer CEK
ID. Unknown critical meaning, another tag, untagged structure, or unprotected
header rejects before unwrap. Kind 1 requires
`application/ecr-entry+cbor`; kind 2 requires
`application/ecr-recovery+cbor`; kind 3 requires
`application/ecr-migration+cbor`. No other pairing is valid.

For each envelope kind, `external_aad` is a bstr containing exactly the
deterministic CBOR bytes of its named `*-envelope-aad-v1` projection. The
projection is a separately valid closed schema and is the outer envelope minus
only the COSE field. It includes wrapped CEK and all common and transfer
bindings. GCM authenticates the canonical `enc-structure-v1` containing the
literal `Encrypt0`, exact protected-header bstr, and exact external-AAD bstr.
Empty, subset, reconstructed, JSON, or digest-only AAD is forbidden.

The scope references in external AAD are not public file metadata. TC05 must
store each complete content/transfer envelope, including its AAD-bearing outer
map, inside a separately encrypted `PROTECTED_METADATA` object under the
metadata domain. A raw content envelope may exist only inside the isolated
broker during an admitted operation and is never model-, caller-, log-, Git-,
Jira-, or filesystem-observer-visible. The at-rest observer may learn only
random metadata-page routing IDs, bounded object sizes, and mutation timing;
human labels, stable entry/scope references, credential digests, and envelope
AAD remain encrypted. If that containment is unavailable, production blocks.

## 8. Nonce, retry, and oracle rules

Every attempt reserves a fresh independent 32-byte CEK, 16-byte CEK ID, and
12-byte IV. These are one-attempt values and cannot be reused after success,
failure, timeout, cancellation, retry, crash/restore ambiguity, recovery,
migration, or rotation. A retry burns them and starts fresh. Uncertain emission
is fenced, never replayed.

IVs come only from a qualified DRBG. They never derive from time, path,
plaintext, digest, action, model input, entry ID, or public metadata. Collision,
rollback, exhaustion, RNG failure, or inability to durably fence blocks. TC05
owns durable allocation/concurrency; TC03 declares reuse invalid.

After bounded parsing, unwrap failure, wrong context, GCM failure, ciphertext
damage, plaintext canonicality failure, and inner/outer mismatch collapse to
one internal `ECR_ENVELOPE_AUTHENTICATION_FAILED`. No caller-visible detail,
parse position, existence signal, partial plaintext metadata, alternate trial,
or timing class escapes. TC08 owns safe audit; TC10 qualifies timing. No
key-commitment claim exceeds these exact bindings. Plaintext fingerprints,
equality oracles, and value-based deduplication are forbidden.

## 9. Suite, FIPS, and recovery rules

The immutable wire registry is: ID 1 =
`ECR-PROD-FIPS-A256GCM-HKDFSHA256-A256KWP-SHA256-CBOR1/1`, permitted only for
`PRODUCTION_USER_DATA` content; ID 2 = `ECR-NONPROD-AES-CONTENT-1`, permitted
only for `SYNTHETIC_DEVELOPMENT` and owner-permitted
`NONPRODUCTION_CONTROLLED` content; ID 3 =
`ECR-PROD-FIPS-RECOVERY-RAK-1`, permitted only for production recovery-slot
records; and ID 4 = `ECR-NONPROD-ARGON2ID-RECOVERY-1`, permitted only for
nonproduction recovery-slot records. IDs are never aliased or repurposed.
Unknown IDs reject. IDs 3 and 4 cannot occur as content-envelope suites. ID 2
occurs only in `nonprod-stored-envelope-v1` with byte-equal protected-header
suite and bound nonproduction environment/data-class policy; it has no
recovery, migration, promotion, or production envelope form.

Production accepts exactly format 1 and suite 1 selected by current policy
before creation. Unknown, zero, missing, duplicate, noncanonical, or mismatched
values reject before unwrap. There is no negotiation, ordered offer, older
suite, provider, or non-FIPS fallback. A later suite requires a new positive
ID, closed schema, owner approval, FIPS qualification, migration plan,
known-answer corpus, and downgrade tests. Existing IDs never change meaning.

`ECR-NONPROD-AES-CONTENT-1` may use the same byte-level algorithms through a
separately qualified nonvalidated provider only for `SYNTHETIC_DEVELOPMENT` or
permitted `NONPRODUCTION_CONTROLLED`. Its identity is disjoint. It cannot open,
copy, relabel, restore, recover, migrate into, or activate production.

`ECR-PROD-FIPS-RECOVERY-RAK-1` requires an independently generated uniformly
random 256-bit offline recovery artifact, HKDF-SHA-256, AES-256-KWP, exact FIPS
provider, separation of duties, and confirmed recovery. Its carrier, check
coding, split custody, and ceremony remain TC04/TC09.

`ECR-NONPROD-ARGON2ID-RECOVERY-1` is nonproduction only: Argon2id v1.3,
2,097,152 KiB memory, one iteration, four lanes, random 16-byte salt, and
32-byte output, followed by HKDF-SHA-256 and AES-256-KWP. Parameters are fixed,
authenticated, and never weakened. Failure to allocate omits the slot. It wraps
a random vault root and never generates one. It has no production activation,
migration, restore, or fallback path. The owner portable-custody downgrade
cannot waive FIPS or recovery.

Production activation requires at least one current qualified platform slot and
one confirmed offline random recovery slot for the same root generation. A
wrong recovery artifact gets one unwrap attempt per separately authenticated
ceremony, the same outward denial, and no mutation of the live generation.

## 10. FIPS provider evidence

`FipsProviderProfileV1` is a nonserializable TC10 template describing exact
module vendor/name/version, current validation certificate, security-policy and
module-binary digests, build provenance, OS/version/architecture and CPU
constraints, provider-configuration digest, entropy qualification, self-test
evidence, algorithm-validation references for AES-GCM, AES-KWP, SHA-256,
HMAC-SHA-256, HKDF-SHA-256 and CTR_DRBG-AES-256, permitted suites, complete
qualification epoch vector, inclusive not-before, exclusive expiry, and
`QUALIFIED` status. TC10 must close its schema, tagged presence, canonical field
types, and wire encoding before any finalized reference exists. Until then no
production profile can resolve, serialize, or activate it. Exact equality is
required after TC10 supplies and verifies the closed record.

One exact qualified boundary performs entropy/DRBG, generation, SHA/HMAC/HKDF,
KWP, GCM, and required self-tests. Canonical public metadata may be built
outside but its exact bytes enter as authenticated context. Sensitive values
exist only inside the isolated broker/provider memory path. TC04/TC10 must
qualify process isolation, import/handle behavior, boundary crossings, memory
lifecycle, and any zeroization claim. A separately validated OS/hardware
custody boundary must have an exact qualified crossing to the content provider.

## 11. Resource, usage, and failure bounds

The effective limit is always the strictest of the following normative bounds,
the exact schema-derived byte/accounting bounds below, and provider limits:

| Quantity | Maximum |
| --- | ---: |
| Credential/plaintext value | 1,048,576 bytes |
| Ciphertext plus 16-byte tag | 1,048,703 bytes |
| Protected COSE header bstr content | `Max(ecr-protected-header-v1)` and never over 512 bytes |
| CBOR nesting | `Depth(T)` for the selected closed schema and never over 8 |
| Closed fields | Exact selected schema count, never over 128 |
| Set/list or epoch-vector members | The selected production's explicit upper bound, never over 4,096 |
| Active plus retired custody/recovery slots per generation | 16 |
| Domain keys per generation | 65,536 |
| Entry versions per domain-key epoch | 1,048,576 |

Credential values cannot be empty. Checked unsigned 64-bit length arithmetic
rejects overflow before allocation. Reject trailing/concatenated objects,
oversized declarations, excess depth/cardinality, and incorrect length
relations. No streaming or partial plaintext release occurs before complete tag
verification.

Size ceilings are derived from the normative productions, never from a generic
record cap. Let `Head(n)` be the preferred CBOR argument/length header size:
1 byte through 23, 2 through 255, 3 through 65,535, 5 through `2^32-1`, and
9 thereafter. Let `Int(v)` be that exact preferred size for an unsigned value
or for CBOR's `-1-v` representation of a negative value; `Bytes(n)=Head(n)+n`,
`Text(n)=Head(n)+n` where `n` is UTF-8 byte length,
`Array(n,x)=Head(n)+sum(x)`, and `Map(n,k,v)=Head(n)+sum(k)+sum(v)`.
Tag 16 and literal `true` each add one byte.

`Max(T)` is computed recursively from that algebra: select the greatest
permitted integer and string byte length; take the maximum encoded size among
alternatives; use the declared upper repetition count; sum fixed array/map
members; and include tags. Ties select the lexicographically greatest canonical
bytes solely to make the vector unique. For a concrete canonical value `x`,
`Items(x)`, `Pairs(x)`, and `Depth(x)` count every CBOR item, every map pair,
and maximum container/tag nesting; repetitions count their actual members.
`Items(T)`, `Pairs(T)`, and `Depth(T)` are their independent maxima over all
rule-valid `x:T`. All arithmetic is checked unsigned
64-bit and overflow rejects. Where any normative tagged-presence, equality,
protected-header, ciphertext-length, or other relational rule narrows a
structural alternative, `Max(T)` ranges only over complete rule-valid
combinations; independently maximizing incompatible fields is forbidden.

The complete per-schema canonical byte maxima are:

| Frozen schema | Exact maximum |
| --- | ---: |
| `PrincipalV1` | `Max(principal-v1)` |
| `RemoteIdentityV1` | `Max(remote-identity-v1)` |
| `RepositoryIdentityV1` | `Max(repository-identity-v1)` |
| `RepositoryStateRuleV1` | `Max(repository-state-rule-v1)` |
| `EnvironmentIdentityV1` | `Max(environment-identity-v1)` |
| `QualifiedProfileTupleV1` | `Max(qualified-profile-tuple-v1)` |
| `EpochVectorV1` | `Max(epoch-vector-v1)` |
| `AuthorityPolicyV1` | `Max(authority-policy-v1)` |
| `ServiceAuthorityV1` | `Max(service-authority-v1)` |
| `PortableProductionDowngradeAuthorityV1` | `Max(portable-production-downgrade-authority-v1)` |
| `AuthorityRequestV1` | `Max(authority-request-v1)` |
| `AttemptBindingV1` | `Max(attempt-binding-v1)` |
| `AuthorityDecisionV1` | `Max(authority-decision-v1)` |
| `TrustedTimeInputV1` | `Max(trusted-time-input-v1)` |
| `TrustedTimePolicyProfileV1` | `Max(trusted-time-policy-profile-v1)` |
| `UtcSkewEvidenceV1` | `Max(utc-skew-evidence-v1)` |
| `ApprovalSubjectV1` | `Max(approval-subject-v1)` |
| `ApprovalEvidenceV1` | `Max(approval-evidence-v1)` |
| `PolicySetV1` | `Max(policy-set-v1)` |
| Stored/nonproduction/recovery/migration envelopes | `Max` of the exact selected `*-envelope-v1` production |
| Stored/transfer plaintext | `Max(stored-plaintext-v1)` / `Max(transfer-plaintext-v1)` |
| Stored/nonproduction/recovery/migration AAD | `Max` of the exact selected `*-envelope-aad-v1` production |
| Stored/nonproduction/recovery/migration KWP context | `Max` of the exact selected `*-kdf-context-v1` production |
| Protected header/COSE object | `Max(ecr-protected-header-v1)` / `Max(cose-encrypt0-v1)` |

These expressions are normative generated constants. Each runtime generates
them from the cited productions and compares the values and canonical bytes in
cross-runtime KATs; a hand-entered substitute is not conforming. They are
achievable, not loose caps. The unique `MAX/<production>` constructor uses the
`Max` branch, maximum lengths/cardinalities and integers, and distinct sorted
set members; duplicated envelope/context references are copied to preserve
equality. DNS/IP and namespace text use TC02-valid maximum-byte values. Tagged
presence uses the largest permitted complete row, and mutually exclusive
human/service authority uses the larger valid branch. Thus every `MAX` vector
is schema-valid and relationally constructible.

Field-specific aliases make an exact entry reference 26 bytes and an exact
stored-envelope digest reference 74 bytes: 1-byte array, two 1-byte integers,
16-byte encoded domain text, 21-byte encoded schema text, and a 34-byte encoded
32-byte digest (2-byte bstr header plus 32 bytes). These arithmetic fixtures,
the generated constants, and their canonical bytes are mandatory KATs.

Parser/accounting bytes are also derived rather than assigned an arena. For a
concrete value, `Meta(x)=64 + 32*Items(x) + 16*Pairs(x) + 8*Depth(x)`; the
schema bound `Meta(T)` is the maximum of `Meta(x)` over all rule-valid `x:T`.
The 64-byte root state,
32-byte item records include start/end offsets and type/length state, each
16-byte map-pair slot is the duplicate/raw-key-order table, and each 8-byte
depth slot is the active container stack. A conforming decoder is zero-copy
over its immutable input and allocates only this one metadata block. A runtime
whose actual bookkeeping exceeds `Meta(T)` uses its larger proven value as the
stricter provider limit; hidden growth, hash-table rehash, alternate parse
trees, and secondary allocation are forbidden.

Canonical encoding and comparison use those same bounded item records. The
64-byte root state contains eight unsigned 64-bit words: input start/end,
output cursor/capacity, left/right comparison cursors, current item index, and
status. The encoder walks item records in canonical order and writes directly
to one exact-size charged output buffer; it has no second tree, staging buffer,
string copy, recursion stack, or growable output. Equality is a complete
length-and-byte comparison between that output and immutable input slices using
the two comparison cursors. The raw outer `e` is compared with one charged
`length(e)` canonical output. The raw protected header is a slice of `e` and is
compared with one charged `length(h)` canonical output. AAD `a` and KWP context
`c` are each written once to their charged exact-size output by copying the
already validated canonical field values identified by `e`'s item offsets;
each copied value is byte-compared to its source slice before use. Their output
buffers are the cryptographic inputs, so no comparison copy exists. COSE
`Enc_structure` framing is fed incrementally from its fixed literal and the
existing `h` and `a` buffers; it is not materialized. A provider unable to
consume that exact incremental AAD must charge its complete additional buffer
as a stricter provider limit before admission.

For protected resolution define `record(x)=2*length(x)+Meta(x)` and
`Record(T)=max(x:T){record(x)}`. This accounts for one immutable encoded record,
one exact-size canonical re-encoding used for digest/equality, and parser
metadata without combining incompatible branch maxima. Policies are processed
in canonical reference order with the policy set retained and at most one
policy body live.
The exact closed-record resolver working set is:

```text
Core = record(request) + record(decision) + record(attempt) +
       record(repository) + record(environment) + record(principal) +
       record(qualified-profile-tuple) + record(epoch-vector) +
       record(policy-set) + record(one-current-policy)
Human = record(approval-subject) + record(approval-evidence)
Service = record(service-authority)
Time = record(trusted-time-input) + record(utc-skew-evidence)
Portable = record(portable-production-downgrade-authority)
ResolveMax = max(rule-valid linked states){
  Core + max(present Human, present Service) + present Time + present Portable
}
```

Absence makes the actual charge smaller. Later-owned schemas have no permitted
serialized body today and contribute no invented size; their owning TC must
add a closed `Record(T)` term and boundary vectors before activation. This is a
hard gate, not permission to resolve an unbounded or generic record.

For one rule-valid, fully linked operation state `x` of envelope kind `K`, let
`e`, `a`, `c`, `h`, and `p` be its concrete envelope, AAD projection, KWP
context, protected header, and plaintext. Let `Resolve(x)` be the concrete live
set above and `cipher(x)=length(p)+16`. The charged peaks are:

```text
pre(x) = 2*length(e) + Meta(e) + length(a) + Meta(a) +
         length(c) + Meta(c) + length(h) + Meta(h) +
         cipher(x) + Resolve(x)
post(x) = pre(x) + 2*length(p) + Meta(p)
Pre(K) = max(rule-valid fully linked x of kind K){pre(x)}
Post(K) = max(rule-valid fully linked x of kind K){post(x)}
```

The two `length(e)` terms are immutable raw outer input and its complete
canonical comparison output. The one `length(h)` term is header canonical
output because its raw bytes are already a slice of the charged outer. The
single `length(a)` and `length(c)` terms are their directly constructed outputs.
The separate `cipher(x)` charge covers a provider input copy while the outer
and comparison outputs remain live. The two plaintext terms are authenticated
plaintext and its canonical re-encoding; neither exists before successful tag
verification.
`Resolve(x)` includes all currently closed resolved records and re-encoding work
required before unwrap. Another provider copy or stricter alignment is added
as a provider limit. Admission reserves `Pre(K)` before resolution and
`Post(K)` before decryption; failure denies before cryptographic work, and no
secondary allocation is allowed.

For every production `T`, the corpus contains valid `MAX/T`, an exact
`Max(T)-1` byte stream made by removing its final byte, and an exact
`Max(T)+1` byte stream made by appending one trailing zero. The latter two are
deliberately malformed bounded inputs and reject without allocation past their
charge. Every variable leaf/repetition also has a valid limit-minus-one, valid
limit, and rejecting limit-plus-one declared length/cardinality vector.
`PEAK/K` holds the maximum raw outer plus canonical outer/AAD/context/header
outputs, provider copy, Core, the
larger authority branch, optional time/portable records, and authenticated
plaintext/re-encoding simultaneously; instrumentation must equal generated
`Pre(K)` and `Post(K)`. The maximizing state is retained as the achievable
`PEAK/K` fixture; one-byte-over variants fail reservation. This makes
schema maxima, metadata, protected resolution, canonical re-encoding, and peak
allocation reproducible at every runtime.

Each request permits at most one parse of each distinct encoded object: one
outer envelope/AAD projection, one protected header/COSE structure, and—only
after successful authentication—one plaintext. It permits one exact suite/
provider/key resolution, one unwrap, and one GCM verification; no alternate
trial exists.

Generation quarantine may be triggered only by an object selected by exact
identity from the qualified TC05 protected store after manifest, generation,
path, and scope verification. Caller-supplied, unknown-ID, wrong-scope, parse,
bounds, and pre-admission failures only deny and cannot mutate quarantine. The
first admitted stored-object KWP/GCM integrity failure semantically quarantines
the entire selected production generation: every later request for any object
in that generation performs zero cryptographic work. TC05 owns atomic durable
persistence and TC08 owns incident workflow, not the scope. If quarantine
persistence is ambiguous, production denies. Restart, time, caller, or later
success cannot reset it. First admitted failure and already-quarantined paths
share a TC10-qualified outward timing/result class.

An authenticated offline-recovery artifact mismatch is excluded from live-
generation quarantine. It terminates the one-attempt ceremony, marks only that
ceremony/slot candidate failed, and requires a new authenticated ceremony.
Recovery activates only a separately verified fresh generation.

## 12. Later-owned records and agility

Later TCs may close `PREPARED_ACTION`, `ROOT_PLATFORM_SLOT`,
`ROOT_RECOVERY_SLOT`, `PROTECTED_METADATA`, `AUDIT_RECORD`, `BACKUP_OBJECT`,
and `MIGRATION_OBJECT`. None may serialize until its owner freezes body and
complete AAD. Every future envelope binds schema/version, encoding, suite,
kind, store/key generations, IV, body digest, exact ciphertext length,
compression literal `NONE`, complete scope/policy/epoch inputs, and exact
prior/recipient/destination references.

Action, output-policy, lease, receipt, and evidence bodies remain templates,
not wire schemas. Final forms bind typed operation, repository/environment,
entry version, provider/tenant/target, adapter/worker/output profile,
attempt/idempotency, complete epoch vector, issuer/subject, freshness/boot/time,
and bounded safe result metadata as applicable. They cannot contain credentials,
generic URLs, free-form shell/environment assignments, model content, or
sensitive diagnostics.

Suite/provider migration creates a fresh destination generation, root, slots,
domains, CEKs, IVs, entry versions, registry digest, and manifest. It uses only
current qualified source and destination profiles. Changing only suite ID,
copying ciphertext, reusing wrapped material, or rewrapping development into
production is prohibited. Production promotion is a fresh authorized import.
Expired/dequalified source cannot be reopened merely to migrate it.

## 13. Fail-closed errors

Protected internal classes cover noncanonical encoding, unsupported schema,
reference/digest/domain mismatch, unsupported suite, unqualified provider,
required FIPS profile, invalid derivation parameters, unavailable/reused IV,
authentication failure, limit excess, stale/unavailable epoch, suspected
rollback, chain failure, recipient mismatch, and internal fail-closed.

They do not extend TC02 reason codes. Deterministic mapping preserves TC02's
earliest failing layer: decoding failure of **any** TC02 closed schema listed in
section 3, including any nested production, field-specific reference, tagged
presence, closed enum, set, or epoch vector required by that schema, maps to
`POLICY_SCHEMA_UNSUPPORTED`. This includes principal, remote/repository/state,
environment/profile, policy/service/downgrade, request/attempt/decision,
trusted-time/skew, approval-subject, and approval-evidence records; it is not
limited to policy or request. Unsupported TC03 envelope, COSE, canonical,
version, or suite bytes after admission map to `INTERNAL_FAIL_CLOSED`.
Absent/unqualified FIPS, provider, custody, or
suite profile maps to `PROFILE_NOT_QUALIFIED`; an exact stale restriction or
policy epoch maps respectively to `RESTRICTION_EPOCH_STALE` or
`POLICY_EPOCH_STALE`; revoked, quarantined, rollback-suspected, or destroyed
protected state maps to `REVOKED_OR_QUARANTINED`; exact repository/environment/
scope mismatches use TC02's corresponding repository, cross-environment, or
`SCOPE_NOT_FOUND_OR_DENIED` reason. Authentication, digest, derivation,
recipient, chain, and otherwise unclassified cryptographic faults map to
`INTERNAL_FAIL_CLOSED`. Ambiguous classification always maps there rather than
guessing a more specific fact.

Every internal reason retains TC02's existing safe `DENIED` projection and
privacy/priority rules. No parse, algorithm, recipient, scope, key, digest, or
authentication detail and no fallback encoding/cipher/provider/profile/
generation escapes.

## 14. Mandatory synthetic tests

| Test | Required proof |
| --- | --- |
| ST01 canonical integers/lengths | Wider or indefinite forms reject before crypto |
| ST02 duplicate/order/type/tag | Duplicate, unordered, float/null/text digest/wrong tag reject |
| ST03 schema closure | Every omitted/added/mistyped TC02/envelope field rejects |
| ST04 optional/set closure | Bad presence, duplicate, reordered set rejects |
| ST05 reference/domain confusion | Every class/type/domain substitution rejects |
| ST06 protected header | Moved/missing/unknown critical or unprotected value rejects |
| ST07 complete AAD | Mutating each outer field, including any byte of the one exact provider/tenant/target tuple, causes uniform authentication failure |
| ST08 inner/outer binding | Wrong entry/source inside valid plaintext fails uniformly |
| ST09 GCM profile | Wrong algorithm/key/IV/tag/length rejects without oracle |
| ST10 KWP/rewrap | KW, wrong size, or mutation/transplant of every envelope ID, CEK ID, complete binding, header, generation, profile, recipient, authority, source, or destination field derives a different KEK and fails at KWP before GCM; CEK rewrap preserves no old ciphertext/tag |
| ST11 one-use allocation | Reuse after success/failure/crash/retry/restore blocks and fences |
| ST12 suite downgrade | Unknown/zero/old/offered suite rejects without negotiation |
| ST13 FIPS gate | Wrong/stale module, mode, build, OE, entropy or self-test blocks early |
| ST14 forbidden algorithms | ChaCha/XChaCha/HPKE/age/draft/private production rejects |
| ST15 transfer relabel | Stored copy/relabel/direct transfer installation rejects |
| ST16 destination binding | Destination/profile/recipient/authority/epoch mutation rejects |
| ST17 bounds | Generated per-schema `MAX`, exact byte +/-1, leaf/cardinality +/-1, overflow/depth/trailing inputs reproduce `Max(T)` and reject boundedly |
| ST18 cross-runtime KAT | CBOR/digest/HKDF/KWP/COSE/GCM bytes match every platform |
| ST19 all TC02 schemas | Positive/negative canonical vectors match every platform |
| ST20 oracle collapse | Post-unwrap failures share safe result and qualified timing class |
| ST21 hierarchy crossing | Entry/meta/audit/backup/migration/recovery cross-open rejects |
| ST22 equality | Identical values create no stable fingerprint/equality oracle |
| ST23 chain/fork | Prior-version/audit/backup/migration rollback rejects/quarantines |
| ST24 quarantine | First failure persists; later request performs zero crypto |
| ST25 recovery | Wrong artifact/context is one generic terminated ceremony |
| ST26 nonproduction isolation | Argon2/SOPS/age/PBKDF2 cannot touch production |
| ST27 fresh promotion | Production import uses all-new generations and ciphertext |
| ST28 provider limits | Strictest invocation/usage bound is enforced |
| ST29 broker containment | Nothing sensitive reaches model/tool output, args, env, files, logs, Jira, Git, or clipboard |
| ST30 provenance | Exact source, signature, license, SBOM, build evidence closes |
| ST31 negative-label exception | Only exact COSE private keys/crit values accept negative integers |
| ST32 epoch pair | Digest, protected reference, resolved vector, exact 16-byte scope IDs, membership, and current epochs all match; variable/truncated scope IDs reject |
| ST33 metadata containment | Raw envelope/AAD never appears outside encrypted metadata and broker memory |
| ST34 quarantine admission | Caller input cannot quarantine; admitted corruption and prior quarantine are observation-equivalent |
| ST35 recovery exception | Artifact mismatch terminates only its ceremony and never mutates live-generation quarantine |
| ST36 field-specific references | Every wrong kind/domain/schema alias rejects before lookup/crypto; split/defaulted/recombined provider, tenant, or target cannot substitute for one exact `provider-tenant-target-ref-v1` |
| ST37 nonproduction suite | Suite 2 has positive KDF/KWP vectors only in its nonproduction schema; suite-1/2 context swaps reject |
| ST38 transfer predecessor | Transfer common prior is exactly absent and label 6 equals inner source |
| ST39 parser/peak accounting | Generated `Meta(T)`, `Record(T)`, `Pre(K)`, and `Post(K)` equal instrumented charges; raw outer, exact outer/AAD/context/header outputs, protected resolution/re-encoding, provider copy, and plaintext output are included; slice comparisons and incremental Enc_structure use no hidden allocation; one-byte-over denies with no secondary allocation |
| ST40 effective expiry | Recompute through referenced records; earliest differing expiry wins; invalid absence/later substitution rejects |
| ST41 generation quarantine | Another object in an admitted failed generation performs zero crypto |
| ST42 KDF parent/child | Parent reference/epoch or child CEK-ID substitution rejects before unwrap |
| ST43 reason ownership | Every closed TC02 top-level/nested/reference/tag/set/enum decode failure maps to `POLICY_SCHEMA_UNSUPPORTED`; TC03 envelope decoding maps to its distinct internal reason |
| ST44 request/decision link | Exact request digest/object/request-ID and decision request-ID match; approval/service/output/action substitution rejects; transfer label 9 equals the same decision/request link |

Fuzz hostile CBOR/COSE, truncation, extension, length abuse, duplicate fields,
allocation abuse, and safe-error/timing projection. Values are marked synthetic
and tests prove absence from errors, logs, traces, receipts, Jira, Git,
model-visible content, and clear metadata. These are future TC10 requirements,
not passing tests.

## 15. Later-TC ownership, nonclaims, and closure

TC04 owns exact Windows/macOS/Linux custody, selected validated boundary,
platform-slot crossing, and recovery carrier. TC05 owns transactions,
allocation/burn records, rollback protection, quarantine, and restoration. TC06
owns rotation/revocation and erasure authorization. TC07 owns broker/adapter/
output containment. TC08 owns safe audit, incident handling, and timing/privacy
interfaces. TC09 owns recovery, backup, migration, rate limiting, drills, and
destruction proof. TC10 owns exact certificates/security policies, binary and
configuration provenance, algorithm coverage, vectors, fault testing,
cross-platform qualification, requalification, and production activation.

TC03 does not claim a selected dependency/provider, FIPS validation, platform
custody, same-user isolation, crash-safe allocation, transactional or rollback-
resistant storage, entry/lease/approval lifecycle, safe transport, broker/
adapter/output containment, audit durability/redaction, recovery/migration/
deletion ceremony, exactly-once effects, erasure, or implementation.

This candidate authorizes no implementation, dependency installation, access
to protected values, generation of real cryptographic material, real-value
test, migration, staging, commit, push, deployment, publication, or activation.
It closes only after the bound Codex review reaches at least 93 with every
defect, dissent, and question at zero and no design-changing objection.

## 16. Standards references

- RFC 8949, *Concise Binary Object Representation*.
- RFC 8610, *Concise Data Definition Language*.
- RFC 9052 and RFC 9053, *CBOR Object Signing and Encryption*.
- RFC 5869, *HMAC-based Extract-and-Expand Key Derivation Function*.
- RFC 5649 and NIST SP 800-38F, *AES Key Wrap with Padding*.
- NIST SP 800-38D, *Galois/Counter Mode*.
- NIST CMVP validated-module certificates and exact security policies.
- RFC 9106, *Argon2*, for the closed nonproduction profile only.
