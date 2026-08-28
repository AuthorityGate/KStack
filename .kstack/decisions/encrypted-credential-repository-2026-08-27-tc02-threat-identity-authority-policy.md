# Encrypted Credential Repository: ECR-TC02 threat, identity, authority, and policy design

| Field | Bound value |
| --- | --- |
| Status | **REVIEW-REQUIRED / NOT IMPLEMENTED** |
| Architecture | **PROVISIONAL COMPOSE** |
| Governing owner artifact | [Initial objective and design](encrypted-credential-repository-2026-08-27-initial-objective-design.md) |
| Governing owner SHA-256 | `b2c5167492d70ad1513a8bc76ababf124b0f2288841b9602373f2c051ba8388d` |
| Prior closure | [ECR-TC01 Codex closure](encrypted-credential-repository-2026-08-27-tc01-codex-closure.md) |
| Prior closure SHA-256 | `afa02ba0faa5c23600b10197e86d0f66f33b93ebfd1df6847e0d59d7bab523e3` |

## 1. Authority and scope

This candidate defines only threats, principals, authenticated repository and
environment identity, authority relationships, closed logical policy schemas,
decision precedence, safe reason codes, privacy obligations, and future TC02
synthetic checks. It authorizes no credentials, installation, implementation,
execution, external review, staging, commit, push, deployment, or production
use. It cannot close or authorize another ECR test case.

This candidate deliberately does not select or design:

- cryptographic algorithms, canonical byte encoding, digests, key hierarchy,
  nonces, or envelopes (ECR-TC03);
- Windows, macOS, Linux, hardware, or recovery custody mechanisms (ECR-TC04);
- store layout, transactions, generations, concurrency, rollback anchors, or
  backup format (ECR-TC05);
- entries, approvals' persistence, lease creation/redemption, budgets,
  revocation transactions, or rotation protocol (ECR-TC06);
- Claude/Codex adapter implementation, IPC, isolated injection, target/output
  containment, or broker executable behavior (ECR-TC07);
- audit persistence/redaction, incident/quarantine workflow, or provider
  reconciliation (ECR-TC08);
- migration, export/sync, restore, crypto-shredding, or recovery drills
  (ECR-TC09); or
- test harnesses, qualification, lifecycle installation, or activation
  (ECR-TC10).

References below such as `digest_ref`, `qualified_profile_ref`,
`trusted_time_input`, `approval_ref`, and `lease_ref` are typed contracts to
those later items, not implementations or claims that the mechanism exists.

## 2. Security claims and limits

The protected values, keys, protected metadata, approval state, policy and
restriction epochs, repository/environment bindings, and future leases are
assets. The design denies model-visible reveal, cross-scope discovery,
confused-deputy use, identity substitution, stale authority, and silent
downgrade.

Root-key non-export, entry plaintext release, broker-only action, and model
non-export remain separate claims. TC02 addresses who may request and approve an
action; it does not prove custody, plaintext containment, action execution, or
output safety.

### Same-user boundary

Claude Code, Codex CLI, their model conversations, plugins, hooks, MCP servers,
tools, and ordinary child processes are untrusted request origins. Production
same-user resistance requires a broker/control-plane process under a separately
authenticated OS or service identity, with authenticated IPC and a policy
decision derived inside that boundary. Possession of the interactive user's
session, path, environment, repository files, or CLI process is never approval.

If a platform cannot enforce the separate broker identity and authenticated
channel, the corresponding production profile is unavailable. A development
profile may handle synthetic/disposable values but makes no confidentiality
claim against a hostile process running as that same OS user. A compromised
kernel, administrator, debugger with equivalent privilege, owner identity, or
already-authorized target remains outside the confidentiality claim; this does
not convert compromise into legitimate ECR authority.

## 3. Threat and failure model

| Threat or failure | Required TC02 boundary and outcome |
| --- | --- |
| Hostile repository instructions or prompt injection | Repository content is data, never identity, policy, approval, or principal evidence; unsafe requests deny. |
| Compromised Claude/Codex plugin, MCP server, hook, tool, or child | A future qualified host adapter must accept only safe typed requests under an authenticated host principal and must prevent read, list, approve, widen, or redeem authority. The current repository does not establish that authenticated-host submission boundary. |
| Opportunistic same-user process | It cannot impersonate the separately identified broker or owner. Without that enforced separation, production is unsupported. |
| Another OS user | OS authentication and later custody/IPC profiles must isolate it; any identity ambiguity denies. |
| Kernel, administrator, debugger, owner, or authorized target compromise | Outside the confidentiality claim and recorded as residual risk; no claim of protection is made. |
| Repository clone, fork, new worktree, move, rename, or replacement | No authority inheritance. The instance must match protected registration evidence or receive an explicit owner-approved registration/rebind. |
| Origin, redirect, proxy, DNS/host-key, tenant, or remote substitution | Exact registered remote and peer identity must match; redirects are denied and an unregistered proxy cannot become equivalent. |
| Dirty tree/index/untracked-state substitution | Production defaults to clean; an explicitly allowed dirty state is bound exactly to the request and later action. |
| Submodule or nested repository confusion | Every nested repository is a separate registered instance; a parent grant never flows into it. |
| Symlink, junction, reparse, mount, namespace, or case collision | Trusted identity evidence must reject aliases, escapes, changes, and names that collide under the host filesystem comparison rules. |
| Development/production relabeling | Environment classification is owner-set and cryptographically/domain separated later; promotion creates a new production version rather than relabeling. |
| Stale policy, approval, restriction, revocation, or time | Any stale or unverifiable bound input denies; later stages must recheck current state. |
| Cross-repository probing | Unknown and unauthorized IDs have the same safe response class, shape, size class, and qualified timing class; no labels, counts, or reason distinctions escape. |
| Policy conflict, missing policy, unknown field/version, or evaluation fault | Explicit denial with a safe projected reason; never best effort, first-match allow, or fallback. |

## 4. Principals and authentication

`PrincipalV1` is a closed tagged union. Each instance contains exactly
`schema=ECR.Principal/1`, `principal_id`, `principal_kind`,
`authentication_profile_ref`, `status`, and `principal_epoch`. Unknown fields,
unknown kinds, duplicated encodings, an empty ID, or a non-current epoch deny.
`status` is the closed enum `STAGED`, `ACTIVE`, `SUSPENDED`, or `RETIRED`;
only `ACTIVE` may authenticate or contribute authority.

| `principal_kind` | Meaning and authority ceiling |
| --- | --- |
| `OWNER_HUMAN` | Authenticated owner able to create policies, register scopes, and issue exact approvals. It cannot waive invariant denials or impersonate another principal. |
| `DELEGATED_APPROVER` | Human explicitly named by an owner policy for a bounded approval class; it cannot create policy or expand scope. |
| `CLAUDE_CODE_HOST` | One authenticated Claude Code host/session identity. It may prepare safe typed requests only; a hook is not the broker or approver. |
| `CODEX_CLI_HOST` | One authenticated Codex CLI host/session identity distinct from Claude. Authority, approval, prepared handles, and future leases are not transferable between them. |
| `SERVICE_CALLER` | Separately approved unattended caller bound to one service profile, exact scope, finite budget reference, expiry, and qualified worker. |
| `SCHEDULER` | Future authenticated KStack scheduler identity that may relay a safe opaque owner question and result over a qualified private owner channel; it cannot approve, evaluate policy, or perform an action. The current main scheduler establishes neither that authenticated principal nor that private channel. |
| `CONTROL_PLANE` | Separately authenticated policy-evaluation service identity. It evaluates but does not itself approve or perform a target action. |
| `ACTION_BROKER` | Separately authenticated broker identity that may later receive a prepared action through the ECR-TC07 contract; it has no general reveal/read authority. |
| `PROTECTED_WORKER` | Separately authenticated isolated worker identity allowed only the exact later-prepared broker action; it has no policy, approval, list, or general read authority. |
| `CUSTODY_SERVICE` | Authenticated service principal for a later-qualified custody profile. A key slot, hardware device, OS API, or `qualified_profile_ref` is not itself a principal. |
| `STORE_SERVICE` | Authenticated service principal for a later-qualified store profile. A database, file, store ID, or store-profile reference is not itself a principal. |
| `REGISTERED_ADAPTER` | Exact adapter/executable identity registered for a bounded target/action profile; implementation and containment are ECR-TC07. |
| `TARGET_SERVICE` | Authenticated destination identity used as a constraint, never as caller or approver authority. |
| `AUDIT_READER` | Authenticated human or service role allowed only a later-defined safe audit projection; it has no protected-value, policy, approval, or action authority. |
| `MIGRATION_OPERATOR` | Authenticated human or service role for one later owner-approved migration ceremony; it has no ordinary action, reveal, or deletion authority. |
| `RECOVERY_OPERATOR` | Human recovery-ceremony role; it has no ordinary action authority and its mechanism is deferred to ECR-TC04/ECR-TC09. |

`authentication_profile_ref`, `qualified_profile_ref`, `adapter_profile_ref`,
`qualified_worker_ref`, custody/store profiles, audit sinks, target profiles,
and recovery profiles are non-principal references. They become associated with
a principal only when an exact active `PrincipalV1` record and policy name that
principal; possession or matching of a profile reference grants nothing.

Claude and Codex authentication evidence must bind host kind, executable/profile
identity, KStack session, interactive OS identity, broker channel, and a fresh
session identifier. A shared account, matching repository, or common model does
not merge these principals. Authentication mechanism and binary attestation are
qualified later, but absence or ambiguity returns `AUTHN_FAILED`.

## 5. Authenticated repository identity

A pathname, current directory, model label, repository file, remote URL alone,
Git object ID alone, or common Git directory alone is not repository authority.
V1 supports authenticated Git repositories only. Each permitted scope begins
with an owner-approved registration stored outside the repository and produces
one `RepositoryIdentityV1` record.

### Closed `RepositoryIdentityV1` logical schema

Every field below is required unless marked optional. Exact byte serialization
and digest algorithms are ECR-TC03; no implementation may add fields or infer a
default before that encoding is frozen.

| Field | Closed type and rule |
| --- | --- |
| `schema` | Literal `ECR.RepositoryIdentity/1` |
| `repository_id` | Non-empty opaque owner-recorded logical repository ID; never derived solely from a path, label, remote, or commit and never sufficient for authorization |
| `repository_instance_id` | Non-empty opaque ID unique to one registered working-tree instance |
| `repository_family_id` | Optional opaque owner-created grouping; absence is distinct from any family and never implies sharing |
| `vcs_kind` | Literal `GIT`; every other value is unsupported in V1 |
| `object_format` | Closed enum `GIT_SHA1` or `GIT_SHA256`; this records Git format and does not select ECR cryptography |
| `git_common_dir_identity_ref` | Trusted OS-object identity reference for the common Git directory |
| `git_dir_identity_ref` | Trusted OS-object identity reference for this worktree's Git directory |
| `registered_root_identity_ref` | Trusted OS-object identity reference for the registered working-tree root; a pathname is descriptive only |
| `worktree_registration_mode` | Literal `EXACT_INSTANCE`; no inherited worktree authority |
| `remote_set` | Canonically ordered, duplicate-free array of `RemoteIdentityV1`; empty is explicit and distinct from unknown |
| `remote_set_mode` | Literal `EXACT`; additions, removals, or changes require owner-approved rebind |
| `submodule_manifest_ref` | Reference to the exact canonical path-to-repository-instance mapping; an empty manifest is explicit |
| `case_collision_state` | Literal `NONE`; unknown or detected collision denies |
| `alias_state` | Literal `DIRECT`; symlink, junction, reparse, namespace, mount, or unresolved alias evidence denies |
| `dirty_rule` | Closed enum `CLEAN_ALL`, `CLEAN_TRACKED`, or `BOUND_DIRTY_STATE`; production default is `CLEAN_ALL` |
| `registered_location_ref` | Non-authoritative location constraint used to detect rename/move; mismatch requires owner rebind |
| `registration_owner_id` | One `OWNER_HUMAN` principal ID |
| `registration_epoch` | Unsigned monotonic integer; stale evidence denies |
| `state_evidence_ref` | Fresh trusted-verifier evidence binding all applicable fields and, for `BOUND_DIRTY_STATE`, the exact index/tree/untracked state |

`CLEAN_ALL` requires the bound `HEAD`, index, and tracked working tree to agree
and the untracked set to be empty. `CLEAN_TRACKED` requires the bound `HEAD`,
index, and tracked working tree to agree and binds an exact untracked manifest;
it does not ignore untracked files. `BOUND_DIRTY_STATE` binds the exact `HEAD`,
index, tracked content, and untracked manifest and requires an explicit matching
policy. Any post-evaluation state change invalidates the evidence.

`repository_id` equality is a non-authorizing logical relation between
separately registered instances. A clone or additional worktree may receive the
same logical ID only through explicit owner registration; a fork receives a new
logical ID by default. `repository_family_id` is a still broader owner-recorded
relation. Neither relation creates policy inheritance, environment membership,
enumeration, or action authority: only exact `repository_instance_id` values do.

`RemoteIdentityV1` is the following closed record:

| Field | Closed type and rule |
| --- | --- |
| `schema` | Literal `ECR.RemoteIdentity/1` |
| `remote_id` | Non-empty opaque ID |
| `transport_kind` | `SSH` or `HTTPS` |
| `network_authority` | Tagged union `DNS_ALABEL` with lowercase ASCII A-label and no trailing dot, `IPV4` with canonical dotted decimal, or `IPV6` with RFC 5952 canonical text; DNS resolution is not identity |
| `port` | Explicit unsigned integer from 1 through 65535; no scheme-derived default |
| `repository_namespace` | Non-empty ordered array of UTF-8 NFC segments; no empty, `.`, `..`, slash, backslash, NUL, wildcard, or percent-decoding ambiguity |
| `repository_name` | One non-empty UTF-8 NFC segment with the same exclusions; no implicit `.git` addition/removal or case folding |
| `peer_identity_ref` | Exact authenticated SSH host-key or TLS service-identity reference; mechanism is later-qualified |
| `proxy_mode` | `DENY` or `EXACT_REGISTERED` |
| `proxy_identity_ref` | Required only for `EXACT_REGISTERED`; absent for `DENY` |
| `redirect_mode` | Literal `DENY` |

User-info, URL fragments, implicit aliases, wildcard hosts/namespaces, and
model-supplied normalization are invalid. Exact endpoint authentication is
qualified in the later adapter/platform profile.

### Repository transition rules

| Event | Normative result |
| --- | --- |
| Clone | A clone has no inherited `repository_instance_id` or policy. It is denied until separately owner-registered. |
| Fork | A fork is a different repository scope even when commits match. Family membership, if desired, is explicit and does not itself grant access. |
| Additional Git worktree | Each worktree receives a distinct registered instance. Sharing a common Git directory is insufficient. |
| Rename or move | The old registration stops matching. An owner may rebind the same repository ID only after the protected verifier proves the registered Git/common-dir identity and exact state; otherwise register a new instance. |
| Origin or remote-set change | Deny until an owner-approved rebind. A matching repository name or commit history cannot substitute. |
| Dirty state | Production `CLEAN_ALL` denies any tracked or untracked change. `BOUND_DIRTY_STATE` is allowed only by explicit policy and binds the exact state into request and later action evidence. There is no unconstrained `ANY` mode. |
| Submodule or nested repository | It is a separate registered instance. Parent policy does not authorize it; the parent manifest must match and the request must name the nested instance. |
| Symlink, junction, reparse, mount, or namespace alias | Deny on the root, Git directories, submodule path, or any security-relevant path component. V1 admits only a separately registered direct root verified by a qualified handle-relative verifier; proving an aliased path resolves to that object does not admit the alias. |
| Case or Unicode collision | Deny when two security-relevant names compare equal under any supported host/filesystem rule while differing in bytes or normalized form. Paths never become cross-platform identity. |
| Remote redirect/proxy/peer change | Deny. Only the exact registered peer and optional exact proxy may be used; redirects do not rewrite policy. |
| Deleted/recreated or replaced root | OS-object or Git identity mismatch denies and requires new registration; a reused path is irrelevant. |

Repository family or global policy never authorizes an unregistered instance.
It merely permits an owner policy to enumerate multiple already authenticated
repository instance IDs explicitly.

### `RepositoryStateRuleV1`

`RepositoryStateRuleV1` is the closed repository-state predicate embedded in
`AuthorityPolicyV1`. It contains exactly the following fields:

| Field | Closed type and rule |
| --- | --- |
| `schema` | Literal `ECR.RepositoryStateRule/1` |
| `dirty_rule` | `CLEAN_ALL`, `CLEAN_TRACKED`, or `BOUND_DIRTY_STATE`; there is no `ANY`, ignore, wildcard, or inherited mode |
| `bound_dirty_state_ref` | Conditional protected reference governed by the tagged-presence matrix below |
| `remote_set_requirement` | Literal `MATCH_CURRENT_REGISTERED_EXACT` |
| `submodule_requirement` | Literal `MATCH_CURRENT_REGISTERED_MANIFEST` |
| `alias_requirement` | Literal `DIRECT_ONLY` |
| `case_collision_requirement` | Literal `NONE_ALLOWED` |
| `state_continuity_requirement` | Literal `FRESH_AND_UNCHANGED` |

Every field is required exactly once except `bound_dirty_state_ref`, whose
presence is governed only by this complete matrix:

| `dirty_rule` | `bound_dirty_state_ref` |
| --- | --- |
| `CLEAN_ALL` | Must be absent |
| `CLEAN_TRACKED` | Must be absent |
| `BOUND_DIRTY_STATE` | Required exactly once |

Every combination not listed, unknown field or literal, duplicate field, empty
required reference, or bound reference under either clean mode is
`POLICY_SCHEMA_UNSUPPORTED`.

`bound_dirty_state_ref` resolves inside protected state to one immutable exact
repository-state projection binding the selected `repository_instance_id`,
object format, `HEAD` state, index state, tracked working-tree content, and
untracked manifest. It is not a pathname, display label, Git commit alone,
model-provided digest, or verifier freshness token. Its exact byte encoding and
digest/reference representation are ECR-TC03.

For each request, evaluation resolves only its selected repository instance's
exact current protected `RepositoryIdentityV1` and fresh trusted
`state_evidence_ref`, then evaluates every applicable rule independently against
that instance. A `BOUND_DIRTY_STATE` policy must name exactly one
`repository_instance_id`, and its `bound_dirty_state_ref` must bind that same
instance; any other cardinality or binding is `POLICY_SCHEMA_UNSUPPORTED`.

1. The complete canonical remote set must equal that instance's protected
   `remote_set` under `remote_set_mode=EXACT`; remote sets never transfer.
2. The exact submodule/nested-repository mapping must equal that instance's
   protected manifest; every nested repository remains separately registered.
3. Root, Git directories, submodule paths, and every security-relevant path
   component must have `alias_state=DIRECT`.
4. `case_collision_state` must be `NONE` under every supported verifier rule.
5. Evidence must be current and invalidates evaluation after any bound change.
6. `CLEAN_ALL` requires matching `HEAD`, index, and tracked tree plus an empty
   untracked set.
7. `CLEAN_TRACKED` requires matching `HEAD`, index, and tracked tree; the exact
   current untracked manifest remains authenticated and bound, never ignored.
8. `BOUND_DIRTY_STATE` requires the protected current state projection to equal
   `bound_dirty_state_ref`. Any state change fails; permitting another state
   requires owner policy replacement, a new `policy_epoch`, and every applicable
   restriction or registration epoch update.

The protected registration, every applicable rule, and current evidence are
conjunctive and never union permissions. For the selected request instance,
layer 7 first rejects different non-empty applicable bound-state references as
`POLICY_CONFLICT_DENY`; only after forming one non-conflicting effective rule
does it evaluate the policy-specific clean or bound predicate. A clean rule
combined with a bound rule passes only when the bound state also satisfies the
clean predicate. A clean policy may span repositories, but each request is
compared only to its selected instance's own registration and evidence.
Existing owner-approved rebind rules still govern changed remotes, locations,
worktrees, manifests, or roots.

## 6. Authenticated environment identity and isolation

`EnvironmentIdentityV1` is the following closed record:

| Field | Closed type and rule |
| --- | --- |
| `schema` | Literal `ECR.EnvironmentIdentity/1` |
| `environment_id` | Non-empty opaque owner registration ID |
| `environment_class` | `SYNTHETIC_DEVELOPMENT`, `NONPRODUCTION_CONTROLLED`, or `PRODUCTION_USER_DATA` |
| `repository_instance_ids` | Non-empty canonically ordered, duplicate-free set of exact registered instances; logical/family IDs are invalid here |
| `provider_tenant_refs` | Non-empty canonically ordered, duplicate-free set of exact authenticated provider/tenant references |
| `qualified_profile_ref` | Exact non-principal reference to the required later-qualified custody/store/broker/output/audit/recovery profile tuple |
| `environment_domain_ref` | Exact non-principal domain-separation reference whose cryptographic meaning is ECR-TC03 |
| `registration_owner_id` | One active `OWNER_HUMAN` principal ID |
| `environment_epoch` | Unsigned monotonic integer; any non-current value denies |

`environment_class` is the closed enum `SYNTHETIC_DEVELOPMENT`,
`NONPRODUCTION_CONTROLLED`, or `PRODUCTION_USER_DATA`. Names such as `dev`,
`stage`, or `prod` are display metadata and grant nothing. The owner sets and
changes classification through a new registration epoch; a model, repository,
branch, environment variable, target, or adapter cannot select it.

- `SYNTHETIC_DEVELOPMENT` permits only synthetic/disposable values and makes no
  same-user confidentiality claim.
- `NONPRODUCTION_CONTROLLED` permits only entries explicitly classified for
  that environment and never inherits production authority.
- `PRODUCTION_USER_DATA` requires the separately qualified production custody,
  rollback, broker, output, audit, and recovery profiles assigned to later TCs.

### `QualifiedProfileTupleV1`

This protected logical binding record contains exactly
`schema=ECR.QualifiedProfileTuple/1`, `qualified_profile_tuple_id`,
`custody_profile_ref`, `store_profile_ref`, `broker_profile_ref`,
`adapter_profile_ref`, `output_profile_ref`, `output_policy_ref`,
`audit_profile_ref`, `recovery_profile_ref`, `qualification_epoch`, and
`status`. Every reference is non-empty, opaque, and case-sensitive. `status` is
`QUALIFIED_CURRENT`, `SUSPENDED`, `REVOKED`, or `RETIRED`; only
`QUALIFIED_CURRENT` at the exact protected current `qualification_epoch` can
contribute to eligibility. The record binds references only; the mechanisms and
qualification criteria remain owned by ECR-TC04, ECR-TC07, ECR-TC08, and
ECR-TC10.

`EnvironmentIdentityV1.qualified_profile_ref` resolves to exactly one such
record. Every applicable allow policy's `qualified_profile_refs` must contain
that exact `qualified_profile_tuple_id`; no union, alias, compatible profile,
or substitute tuple is accepted.

Development and production use distinct `environment_id` and
`environment_domain_ref` values. A policy cannot authorize both through a
wildcard. An entry cannot be relabeled across classes; promotion creates a new
production entry version through the later lifecycle design. A missing,
ambiguous, stale, or mismatched environment classification denies.

## 7. Closed logical schemas and canonical rules

TC02 freezes field sets, types, enums, absence semantics, comparison rules, and
evaluation behavior. TC03 must assign an unambiguous byte encoding and digest
suite without changing these meanings. Until TC03 closes, no serialized object
is implementation-authorized.

All TC02 schemas follow these rules:

1. `schema` is required and must equal the one supported literal. Unknown or
   future schema versions fail closed.
2. Every listed non-optional field occurs exactly once. Unknown, duplicate,
   null, non-finite, implicit, or type-coerced values are invalid.
3. IDs and references are opaque, non-empty, case-sensitive values. Display
   labels, paths, URLs, branch names, and user input never substitute for IDs.
4. Sets are encoded later as canonically sorted, duplicate-free arrays. Order
   has no policy meaning. An empty set means allow none, never allow all.
5. There are no wildcards, globs, regular expressions, implicit current
   repository/environment, negative-zero values, or default permissions.
6. Integers are unsigned and bounded by the later canonical encoding. Epoch
   comparison is exact integer comparison; overflow, wrap, or ambiguity denies.
7. Timestamps are UTC instants consumed only with a qualified
   `TrustedTimeInputV1`. Missing time evidence cannot be replaced by file time,
   Git time, model time, target time, or ordinary wall clock.
8. Text allowed only for fixed enum literals or non-authoritative safe display
   fields is UTF-8 NFC. Security identity is never derived from display text.

### `EpochVectorV1`

Every authority-bearing schema below binds a complete canonical epoch vector,
not one aggregate or maximum epoch. `EpochVectorV1` is a canonically sorted,
duplicate-free array of entries containing exactly `epoch_kind`, `scope_kind`,
`scope_id`, and `epoch`.

- `epoch_kind` is `POLICY`, `RESTRICTION`, or `QUALIFICATION`.
- `scope_kind` is `GLOBAL_STORE`, `PRINCIPAL`, `REPOSITORY_INSTANCE`,
  `ENVIRONMENT`, `ENTRY`, `POLICY`, `SERVICE_AUTHORITY`, `ADAPTER_PROFILE`, or
  `PORTABLE_DOWNGRADE_AUTHORITY`, or `QUALIFIED_PROFILE_TUPLE`.
- `scope_id` is the exact non-empty opaque ID for that kind.
- `epoch` is its unsigned current value.

Ordering is by the later TC03 canonical encoding of the tuple
`(epoch_kind, scope_kind, scope_id)`. The vector contains exactly one entry for
every applicable policy and restriction scope and no inapplicable entry.
Membership and every epoch value must equal the protected current vector;
missing, extra, duplicate, lower, higher, max-only, or scope-collapsed vectors
deny. Atomic persistence and current-vector acquisition remain ECR-TC05/ECR-TC06.

Every applicable qualified profile tuple contributes exactly one
`(QUALIFICATION, QUALIFIED_PROFILE_TUPLE, qualified_profile_tuple_id,
qualification_epoch)` entry. Changing its status or any bound member requires a
new `qualification_epoch`; stale authority cannot retain the old tuple under the
same ID. Missing, extra, or mismatched qualification entries deny.

### `AuthorityPolicyV1`

The policy contains exactly the following fields:

| Field | Closed type and rule |
| --- | --- |
| `schema` | Literal `ECR.AuthorityPolicy/1` |
| `policy_id` | Opaque ID |
| `policy_kind` | `OWNER_SCOPE`, `ENVIRONMENT_BASELINE`, `ENTRY_RESTRICTION`, or `SERVICE_PROFILE` |
| `effect` | `ALLOW` or `DENY`; an allow remains subject to every higher gate |
| `issuer_principal_id` | Authenticated `OWNER_HUMAN`; no model, service caller, broker, adapter, or delegated approver can issue policy |
| `issuer_principal_epoch` | Exact current epoch of that owner principal |
| `policy_epoch` | Monotonic version of this policy object; it must equal the single `(POLICY, POLICY, policy_id)` entry in `epoch_vector` and is not a restriction aggregate or substitute for any vector entry |
| `epoch_vector` | Complete exact applicable `EpochVectorV1`, including the policy's `(POLICY, POLICY, policy_id)` entry and every independently scoped current restriction entry; a scalar, maximum, lower bound, or scope-collapsed restriction representation is schema-invalid |
| `principal_ids` | Exact allowed caller IDs; Claude, Codex, and service identities are listed separately |
| `principal_kinds` | Exact allowed kinds; it cannot compensate for a missing exact principal ID |
| `repository_instance_ids` | Exact registered instances; a global scope still enumerates every instance |
| `repository_family_ids` | Optional extra constraint; family membership never replaces instance enumeration |
| `environment_ids` | Exact registered environments |
| `environment_classes` | Exact classes; production and non-production cannot share one allow rule |
| `entry_refs` | Exact opaque entry references; entry semantics are ECR-TC06 |
| `provider_tenant_target_refs` | Exact authenticated provider, tenant/account, and target tuples |
| `operation_refs` | Exact typed operation/class IDs; no shell or generic HTTP operation |
| `adapter_profile_refs` | Exact registered and later-qualified adapter/profile IDs |
| `output_policy_refs` | Exact duplicate-free set of permitted opaque output-policy references; empty permits none. Wildcards, defaults, inheritance, or adapter-selected substitution are invalid |
| `repository_state_rule` | One exact `RepositoryStateRuleV1`; evaluated conjunctively with protected current `RepositoryIdentityV1`, current repository evidence, and every applicable policy, it may only preserve or narrow repository-state eligibility |
| `approval_mode` | `CURRENT_HUMAN`, `DURABLE_EXACT_SCOPE`, or `SERVICE_PROFILE`; no `NONE` value. For `OWNER_SCOPE`, `ENVIRONMENT_BASELINE`, and `ENTRY_RESTRICTION` it constrains only the human authority branch. For `SERVICE_PROFILE` it is the exact service-branch tag. Modes are branch selectors, not ordered scope values, and are never unioned or treated as overrides |
| `approval_principal_ids` | Exact owner/delegated-approver IDs allowed for this policy |
| `service_authority_ref` | Conditional field governed only by the tagged-presence matrix below |
| `budget_ref` | Conditional field governed only by the tagged-presence matrix below; finite budget semantics are ECR-TC06 |
| `not_before` | Conditional trusted-time bound governed only by the tagged-presence matrix below |
| `expires_at` | Conditional exclusive trusted-time bound governed only by the tagged-presence matrix below |
| `qualified_profile_refs` | Exact later-qualified custody/store/broker/output/audit/recovery profile tuple |
| `safe_owner_question_template_id` | Fixed safe template ID; no protected or cross-scope text |
| `status` | `STAGED`, `ACTIVE`, `SUSPENDED`, or `RETIRED`; only `ACTIVE` can contribute to eligibility |

An `OWNER_SCOPE` policy is the only rule that can establish repository or
environment authority and must match the exact selected caller principal and
every request dimension. `ENVIRONMENT_BASELINE` and `ENTRY_RESTRICTION` can
only narrow that scope. `SERVICE_PROFILE` is an additional exact policy
required only by the service branch; it cannot establish owner scope, widen or
union any set, replace any deny, baseline, restriction, or profile predicate,
or authorize a caller absent from the matching `OWNER_SCOPE`.

The four conditional fields and `approval_mode` have this complete tagged
presence rule; every combination not listed is `POLICY_SCHEMA_UNSUPPORTED`:

| `policy_kind` | Allowed `approval_mode` | `service_authority_ref` | `budget_ref` | `not_before` | `expires_at` |
| --- | --- | --- | --- | --- | --- |
| `OWNER_SCOPE` | `CURRENT_HUMAN` or `DURABLE_EXACT_SCOPE` | Must be absent | Must be absent | Optional | Optional |
| `ENVIRONMENT_BASELINE` | `CURRENT_HUMAN` or `DURABLE_EXACT_SCOPE` | Must be absent | Must be absent | Optional | Optional |
| `ENTRY_RESTRICTION` | `CURRENT_HUMAN` or `DURABLE_EXACT_SCOPE` | Must be absent | Must be absent | Optional | Optional |
| `SERVICE_PROFILE` | Exactly `SERVICE_PROFILE` | Required | Required | Required | Required |

Thus a human approval mode can never be `SERVICE_PROFILE`, and a
`SERVICE_PROFILE` policy can never select a human approval mode. When optional
`not_before` or `expires_at` is absent, no corresponding policy time bound is
created; action/approval time limits assigned to ECR-TC06 are not weakened.

`DURABLE_EXACT_SCOPE` is valid only when every named environment has class
`SYNTHETIC_DEVELOPMENT` or `NONPRODUCTION_CONTROLLED`. It is invalid for, and
can never substitute for current human approval in, `PRODUCTION_USER_DATA`.
Ordinary production requests require a matching `CURRENT_HUMAN` policy and
current human `ApprovalEvidenceV1`. The sole unattended production exception is
a separately owner-approved, exact `SERVICE_PROFILE` plus valid
`ServiceAuthorityV1`; no other durable or background human grant is accepted.

### Deterministic authority-path composition

Policy scope and authority proof are evaluated on separate axes. Layers 1-7
first apply every invariant, deny, exact `OWNER_SCOPE` requirement,
environment/entry restriction, profile, time, output, budget, and epoch
predicate. Their non-authority constraints always intersect most
restrictively. `approval_mode`, `approval_ref`, and `service_authority_ref` are
then evaluated only by this closed matrix; they do not participate in a scalar
"stricter approval wins" comparison.

| Authority branch | Required exact composition |
| --- | --- |
| `HUMAN_CURRENT` | The request has `approval_ref`, or has zero paths solely to ask the owner; `service_authority_ref` is absent; the caller and every request dimension match exact `OWNER_SCOPE`; and the effective human mode is `CURRENT_HUMAN`. A valid current `ApprovalEvidenceV1` is required for eligibility. Zero paths may return `OWNER_APPROVAL_REQUIRED` only when approval is the sole missing predicate. |
| `HUMAN_DURABLE_NONPRODUCTION` | `approval_ref` is present and `service_authority_ref` absent; exact `OWNER_SCOPE` matches; every environment is `SYNTHETIC_DEVELOPMENT` or `NONPRODUCTION_CONTROLLED`; and the effective human mode is `DURABLE_EXACT_SCOPE`. Valid exact `ApprovalEvidenceV1` is required. Any production environment denies. |
| `SERVICE` | `service_authority_ref` is present and `approval_ref` absent; the caller is the exact `SERVICE_CALLER`; exact active `OWNER_SCOPE` enumerates that service principal and every request dimension; exactly one active matching `SERVICE_PROFILE` names the same service authority; `ServiceAuthorityV1.owner_policy_id` equals that `OWNER_SCOPE`; and all three scopes intersect without union. Valid `ServiceAuthorityV1` is the authority proof. Human `approval_mode` values on owner, baseline, and restriction policies are not a second proof requirement on this disjoint branch; every other field in those policies still narrows it. |
| `INVALID` | Both authority references, a service reference without every linked policy and record, a human reference under the service branch, multiple or ambiguous matching service profiles, or zero paths for a service request deny. |

For a human branch, the effective mode is `CURRENT_HUMAN` when any matching
non-service policy selects it and otherwise is `DURABLE_EXACT_SCOPE`; no policy
mode is ignored or unioned. The service branch is not an override or exception
to `OWNER_SCOPE` evaluation: failure or mismatch of `OWNER_SCOPE`,
`SERVICE_PROFILE`, `ServiceAuthorityV1`, or any shared predicate denies.
`SERVICE_PROFILE` can only narrow authority already explicitly scoped to that
`SERVICE_CALLER` by `OWNER_SCOPE`.

### `ServiceAuthorityV1`

This record contains exactly `schema=ECR.ServiceAuthority/1`,
`service_authority_id`, `service_principal_id`, `service_principal_epoch`, `owner_policy_id`,
`repository_instance_id`, `environment_id`, `entry_ref`,
`provider_tenant_target_ref`, `operation_ref`, `adapter_profile_ref`,
`requested_output_policy_ref`,
`qualified_worker_ref`, `budget_ref`, `receipt_requirement_ref`, `not_before`,
`expires_at`, `epoch_vector`, and `status`.

Every field is exact and singular. The service identity is separately
authenticated and owner-approved. The record cannot be copied to Claude,
Codex, another service identity, repository, target, or environment. Absence of
trusted time, finite budget, qualified worker, or receipt requirement denies.
`status` is the closed enum `STAGED`, `ACTIVE`, `SUSPENDED`, `REVOKED`,
`EXPIRED`, or `RETIRED`; only `ACTIVE` may contribute to an eligible decision,
and qualified time must still be strictly before `expires_at`.

`owner_policy_id` must resolve to the exact active matching `OWNER_SCOPE` used
by the service branch. That owner scope must enumerate the selected principal
as `SERVICE_CALLER` and match every applicable dimension represented by the
owner-scope and service-authority records. Exactly one active matching
`SERVICE_PROFILE` must reference that service authority. Zero, multiple, stale,
conflicting, or mismatched links deny with `SERVICE_IDENTITY_NOT_AUTHORIZED`,
unless an earlier-layer denial already has priority.

### `PortableProductionDowngradeAuthorityV1`

This closed Q3 record contains exactly
`schema=ECR.PortableProductionDowngradeAuthority/1`,
`downgrade_authority_id`, `owner_principal_id`, `owner_principal_epoch`,
`owner_policy_id`, `repository_instance_id`, `environment_id`,
`baseline_profile_ref`, `portable_profile_ref`, `accepted_risk_class`,
`risk_readback_ref`, `not_before`, `expires_at`, `epoch_vector`,
`later_audit_requirement_ref`, and `status`.

The owner is an authenticated active `OWNER_HUMAN`; the repository instance,
`PRODUCTION_USER_DATA` environment, baseline profile, and qualified portable
profile are singular and exact. `accepted_risk_class` is the literal
`PORTABLE_CUSTODY_RESIDUAL_ONLY`. `risk_readback_ref` binds the exact complete
owner-visible custody-risk readback. `not_before` is inclusive, `expires_at` is
exclusive, and both require accepted trusted time. `epoch_vector` is the
complete exact applicable vector. `later_audit_requirement_ref` binds the
future ECR-TC08 safe audit obligation. `status` is `STAGED`, `ACTIVE`,
`SUSPENDED`, `REVOKED`, `EXPIRED`, or `RETIRED`; only `ACTIVE` within the time
window is usable.

This authority accepts only the disclosed residual risk of portable production
root custody. It is additional to, and cannot replace, ordinary current-human
approval or a valid service authority. It cannot waive wrong principal,
repository, environment, target, corruption, revocation, redaction, rollback,
freshness, profile qualification, output containment, audit, recovery,
or any other failed predicate. It grants no reveal/export and no
action authority by itself.

### `AuthorityRequestV1`

This record contains exactly `schema=ECR.AuthorityRequest/1`, `request_id`,
`caller_principal_id`, `caller_principal_kind`, `caller_principal_epoch`, `host_session_id`,
`repository_identity_ref`, `repository_state_evidence_ref`,
`environment_identity_ref`, `entry_ref`, `provider_tenant_target_ref`,
`operation_ref`, `adapter_profile_ref`, `exact_action_digest_ref`,
`attempt_binding_ref`,
`approval_ref` (optional), `service_authority_ref` (optional),
`portable_production_downgrade_ref` (conditional), `observed_epoch_vector`,
`trusted_time_input_ref` (optional), and `requested_output_policy_ref`.

`portable_production_downgrade_ref` is required exactly once when a
`PRODUCTION_USER_DATA` request selects a qualified portable-only custody profile
and must otherwise be absent. A missing, extra, duplicate, non-current, or
scope-mismatched reference denies and cannot be converted into an owner approval
question.

At most one authority path is present: a human `approval_ref` or a
`service_authority_ref`; presenting both is `POLICY_SCHEMA_UNSUPPORTED`. Zero
paths is valid only to evaluate whether current human approval is the sole
missing predicate. In that case the only non-denial result is
`OWNER_APPROVAL_REQUIRED`. `ELIGIBLE_FOR_LATER_PREPARATION` requires exactly one
present, valid, current, policy-matching authority path. Zero paths under a
service profile, or zero paths with any other failed predicate, denies. The
model-facing host cannot provide trusted repository or environment evidence; it
supplies opaque request intent, and the protected control plane replaces or
verifies all identity references internally. The request does not contain a
credential, arbitrary command, generic URL, prompt, or free-form approval text.

`requested_output_policy_ref` is required exactly once, non-empty, opaque, and
case-sensitive. It must be a member of every applicable allow policy's
`output_policy_refs` intersection and must not match any applicable deny.
Missing, malformed, defaulted, normalized, aliased, wildcarded, or
non-intersecting values cannot reach eligibility.

For the human path, the request value must equal byte-for-byte the value in
`ApprovalSubjectV1` and `ApprovalEvidenceV1`; zero-path question generation
copies it without transformation. A mismatch returns `APPROVAL_INVALID`. For
the service path, it must equal byte-for-byte
`ServiceAuthorityV1.requested_output_policy_ref` and remain permitted by the
associated `SERVICE_PROFILE`, owner scope, environment baseline, and entry
restrictions. A mismatch returns `SERVICE_IDENTITY_NOT_AUTHORIZED`.

In either path, resolve the environment's exact current
`QualifiedProfileTupleV1`. The request's `adapter_profile_ref` must equal
byte-for-byte its `adapter_profile_ref`, and `requested_output_policy_ref` must
equal byte-for-byte its `output_policy_ref`. The service authority, when used,
must carry those same two values. The tuple's exact `output_profile_ref` is the
only output profile that later qualification may validate; TC02 never infers
compatibility or accepts a substitute. Any tuple, adapter, output-policy,
qualification status, or epoch mismatch returns `PROFILE_NOT_QUALIFIED`, and
later eligibility retains `TC07_ADAPTER_OUTPUT_QUALIFIED` bound to this exact
tuple and output-policy reference. Schema absence or malformed presence is
`POLICY_SCHEMA_UNSUPPORTED`; an empty restrictive intersection is
`POLICY_CONFLICT_DENY`; absence of applicable owner allow is
`POLICY_DEFAULT_DENY`. No mismatch can become an owner question.

### `AttemptBindingV1`

This logical record closes the TC02 attempt and possible-effect vocabulary. It
contains exactly `schema=ECR.AttemptBinding/1`, `attempt_id`,
`idempotency_key_ref`, `repository_identity_ref`, `environment_identity_ref`,
`entry_ref`, `provider_tenant_target_ref`, `operation_ref`,
`adapter_profile_ref`, `exact_action_digest_ref`, `effect_state`,
`effect_state_epoch`, and `last_effect_evidence_ref` (conditional).

`effect_state` is exactly `FRESH`, `RESERVED`, `DISPATCHED`,
`NO_EFFECT_PROVEN`, `POSSIBLE_EFFECT`, `EFFECT_CONFIRMED`,
`RECONCILED_NO_EFFECT`, or `RECONCILED_EFFECT`.
`last_effect_evidence_ref` is absent only for `FRESH`; it is required exactly
once for every other state. Unknown states or field combinations fail closed.
All scope and action fields must equal the enclosing request. The
`idempotency_key_ref` identifies the same exact target-side effect class across
attempts; `attempt_id` identifies one attempt and is never reusable.

Only an exact current `FRESH` binding may enter later preparation. A duplicate
`attempt_id`, or a prior record for the same idempotency key in `RESERVED`,
`DISPATCHED`, `POSSIBLE_EFFECT`, `EFFECT_CONFIRMED`, or
`RECONCILED_EFFECT`, returns `ATTEMPT_REPLAY_DENIED`. A transport loss,
timeout, crash, or other ambiguous result after dispatch is
`POSSIBLE_EFFECT`, returns `POSSIBLE_EFFECT_AMBIGUOUS`, and blocks retry,
replay, fresh authority, and owner-question generation. Only later qualified
reconciliation may establish `NO_EFFECT_PROVEN` or `RECONCILED_NO_EFFECT` and
permit a new attempt with a new `attempt_id`; it never revives the old attempt.
Reservation, persistence, dispatch handoff, reconciliation, and audit mechanics
belong to ECR-TC06/ECR-TC07/ECR-TC08.

This contract blocks duplicate or replayed ECR authority. It does **not** claim
exactly-once target effects: a target may have acted before an outcome became
ambiguous, and neither a retry denial nor an idempotency key proves otherwise.

### `AuthorityDecisionV1`

This record contains exactly `schema=ECR.AuthorityDecision/1`, `decision_id`,
`request_id`, `result`, `internal_reason_code`, `safe_projection_code`,
`applicable_policy_refs`, `effective_epoch_vector`, `identity_evidence_refs`,
`qualified_profile_refs`, `approval_requirement_ref` (result-tagged),
`effective_attempt_binding_ref`, and `later_stage_requirements`.

`effective_attempt_binding_ref` is required exactly once for every result. It
must resolve to the same attempt ID, idempotency key, scope, and action as the
request and to the protected current effect state used by this decision. A
missing, mismatched, stale, or unresolvable binding fails closed.

`approval_requirement_ref` has result-tagged presence: it is required exactly
once for `OWNER_APPROVAL_REQUIRED` and must be absent for `DENIED` and
`ELIGIBLE_FOR_LATER_PREPARATION`. Any missing, duplicate, or otherwise present
combination is schema-invalid and fails closed.

`result` is only `DENIED`, `OWNER_APPROVAL_REQUIRED`, or
`ELIGIBLE_FOR_LATER_PREPARATION`. TC02 never returns `ALLOW`, a credential, a
lease, a general read handle, or execution authority. Eligibility means only
that ECR-TC06/ECR-TC07 may later evaluate their own current predicates.

`later_stage_requirements` is an internal, canonically ordered, duplicate-free array of
the closed enum `TC04_CUSTODY_CURRENT`, `TC05_STORE_GENERATION_CURRENT`,
`TC06_ENTRY_CURRENT`, `TC06_APPROVAL_REQUIRED`, `TC06_AUTHORITY_CURRENT`,
`TC06_LEASE_REQUIRED`, `TC06_ATTEMPT_RESERVATION_CURRENT`,
`TC07_BROKER_WORKER_AUTHENTICATED`, `TC07_ADAPTER_OUTPUT_QUALIFIED`,
`TC07_EFFECT_STATE_HANDOFF`, `TC08_AUDIT_READY`, or
`TC08_EFFECT_RECONCILIATION_READY`. It must equal exactly one matrix row.
Missing, extra, duplicate, reordered, or inapplicable members are
`POLICY_SCHEMA_UNSUPPORTED`. The array never changes the safe projection or
authorizes a later action.

Define the eligible base set `B` as exactly `TC04_CUSTODY_CURRENT`,
`TC05_STORE_GENERATION_CURRENT`, `TC06_ENTRY_CURRENT`,
`TC06_AUTHORITY_CURRENT`, `TC06_LEASE_REQUIRED`,
`TC06_ATTEMPT_RESERVATION_CURRENT`, `TC07_BROKER_WORKER_AUTHENTICATED`,
`TC07_ADAPTER_OUTPUT_QUALIFIED`, `TC07_EFFECT_STATE_HANDOFF`, and
`TC08_AUDIT_READY`. `TC06_APPROVAL_REQUIRED` means approval acquisition for
`OWNER_APPROVAL_REQUIRED`, and TC06 revalidation and redemption of the already
present exact approval for human-path eligibility. `TC06_AUTHORITY_CURRENT`
revalidates the selected human or service authority; for a service path this
includes its budget, expiry, worker, and receipt bindings.

| Result | Authority branch and profile | Effect state | Exact requirements |
| --- | --- | --- | --- |
| `DENIED` | Any | `FRESH` | Empty array |
| `DENIED` | Any | `RESERVED` | `TC06_ATTEMPT_RESERVATION_CURRENT`, `TC07_EFFECT_STATE_HANDOFF`, `TC08_AUDIT_READY` |
| `DENIED` | Any | `DISPATCHED` or `POSSIBLE_EFFECT` | `TC07_EFFECT_STATE_HANDOFF`, `TC08_AUDIT_READY`, `TC08_EFFECT_RECONCILIATION_READY` |
| `DENIED` | Any | `EFFECT_CONFIRMED`, `RECONCILED_EFFECT`, `NO_EFFECT_PROVEN`, or `RECONCILED_NO_EFFECT` | `TC07_EFFECT_STATE_HANDOFF`, `TC08_AUDIT_READY` |
| `OWNER_APPROVAL_REQUIRED` | Zero-path human mode; any exact qualified standard or portable profile | `FRESH` | Exactly `TC06_APPROVAL_REQUIRED` |
| `ELIGIBLE_FOR_LATER_PREPARATION` | `HUMAN_CURRENT` or `HUMAN_DURABLE_NONPRODUCTION`; any exact qualified standard or portable profile | `FRESH` | Exactly `B` plus `TC06_APPROVAL_REQUIRED` |
| `ELIGIBLE_FOR_LATER_PREPARATION` | Exact `SERVICE`; any exact qualified standard or portable profile | `FRESH` | Exactly `B` |

`OWNER_APPROVAL_REQUIRED` or eligibility with a non-`FRESH` state is
schema-invalid, and a zero-path service request always denies. Standard and
portable custody profiles use the same set membership. For portable
production, `TC04_CUSTODY_CURRENT` binds the exact portable profile and valid
downgrade authority, while `TC08_AUDIT_READY` binds its downgrade-specific
audit obligation. `TC08_EFFECT_RECONCILIATION_READY` occurs only for
`DISPATCHED` or `POSSIBLE_EFFECT`. Requirements on a denied non-fresh attempt
permit only fencing, cleanup, audit, or reconciliation--never preparation,
retry, or a new owner question. After proven or reconciled no-effect, a new
attempt must have a distinct `FRESH` `attempt_id` and its own decision.

### `TrustedTimeInputV1`

This input contains exactly `schema=ECR.TrustedTimeInput/1`, `time_source_id`,
`source_class`, `trust_state`, `time_profile_ref`, `observed_utc`,
`uncertainty_bound`, `evidence_observed_monotonic`, `boot_id_ref`,
`monotonic_evidence_ref`, `freshness_ref`, `skew_evidence_ref`, and
`suspend_state`.

`source_class` is `SECURE_PLATFORM_UTC`, `HARDWARE_ATTESTED_UTC`,
`QUALIFIED_NETWORK_UTC`, or `BOOT_BOUND_MONOTONIC_UTC`. These are evidence
classes, not selected APIs. `trust_state` is `QUALIFIED_CURRENT`, `UNAVAILABLE`,
`STALE`, `ROLLBACK_SUSPECTED`, `CONTINUITY_LOST`, or `UNQUALIFIED`; only
`QUALIFIED_CURRENT` is accepted. `suspend_state` is
`NO_SUSPEND_SINCE_EVIDENCE`, `RESUME_CONTINUITY_PROVEN`, or `RESET_OR_LOSS`;
only the first two are accepted.

`uncertainty_bound` is a finite non-negative duration. The trusted UTC interval
is the closed interval from `observed_utc - uncertainty_bound` through
`observed_utc + uncertainty_bound`. Overflow, underflow, unbounded uncertainty,
or an unrepresentable endpoint denies.

`TrustedTimePolicyProfileV1` contains exactly
`schema=ECR.TrustedTimePolicyProfile/1`, `time_profile_id`,
`allowed_source_classes`, `allowed_reference_source_classes`,
`max_uncertainty`, `max_evidence_age`, `max_utc_skew`,
`require_boot_continuity`, and `suspend_rule`. The three bounds are explicit,
finite, non-negative durations. Both source-class sets are non-empty.
`require_boot_continuity` is literal `true` and
`suspend_rule` is literal `REQUIRE_PROVEN_CONTINUITY`. Missing or unqualified
profile evidence denies. Exact profile values are selected and qualified in the
later operating profile, not inferred at evaluation.

`skew_evidence_ref` resolves to a closed `UtcSkewEvidenceV1` containing exactly
`schema=ECR.UtcSkewEvidence/1`, `candidate_source_id`, `reference_source_id`,
`candidate_observed_utc`, `candidate_uncertainty_bound`,
`candidate_freshness_ref`, `candidate_monotonic_evidence_ref`,
`candidate_suspend_state`,
`reference_source_class`, `reference_trust_state`, `reference_observed_utc`,
`reference_uncertainty_bound`, `reference_freshness_ref`,
`reference_monotonic_evidence_ref`, `reference_suspend_state`,
`comparison_observed_monotonic`, and `boot_id_ref`. Candidate and reference
source IDs must be distinct. Every candidate field must exactly equal its
counterpart in the enclosing time input; the candidate source ID and boot ID
must also match. The reference class must be allowed by
`allowed_reference_source_classes`, its trust state must be
`QUALIFIED_CURRENT`, its uncertainty and age must meet the same profile maxima,
and its boot/monotonic/suspend evidence must be current and continuity-proven.

Let the candidate interval be `[C_low, C_high]` and the independently qualified
reference interval be `[R_low, R_high]`, each formed from its observed UTC plus
or minus its uncertainty. The conservative observed skew is
`max(abs(C_low - R_high), abs(C_high - R_low))`. It must be less than or equal
to `max_utc_skew`. Missing, stale, same-source, differently boot-bound,
unverifiable, overflowed, or out-of-bound skew evidence denies. Acquisition and
authentication of this evidence remain ECR-TC05/ECR-TC06/ECR-TC10.

TC02 accepts a time input only when its source class is allowed, trust state is
current, uncertainty is within the profile maximum, evidence age is within the
freshness maximum, UTC skew is within the profile maximum, boot/monotonic
continuity matches, and suspend state proves no continuity loss. A time-bound
predicate applies each present bound independently. If `not_before` alone is
present, the interval's lower endpoint must be greater than or equal to that
inclusive bound. If `expires_at` alone is present, the upper endpoint must be
strictly less than that exclusive bound. If both are present, both comparisons
must pass; if neither is present, they create no time predicate. An interval
that touches or overlaps an invalid side denies; uncertainty never rounds toward
permission.

Suspend with proven monotonic continuity may be accepted under the same finite
bounds. Unproven suspend, reboot, boot-ID change, monotonic reset/wrap, time
rollback, source loss, stale evidence, or continuity loss returns
`TRUSTED_TIME_UNAVAILABLE` and blocks time-dependent policy until new qualified
evidence is acquired. It never extends, revives, or converts authority.

TC02 consumes trusted time only for `not_before`, `expires_at`, approval
freshness, service/downgrade windows, or another explicit policy predicate. It
never uses time for repository identity, nonce choice, ordering store
generations, or proof of freshness by itself. Acquisition APIs, source/anchor
implementation, rollback-resistant persistence, suspend/resume evidence, and
atomic use are ECR-TC05/ECR-TC06; qualification is ECR-TC10.

### `ApprovalSubjectV1`

`ApprovalSubjectV1` is the closed canonical projection used for human approval.
It contains exactly `schema=ECR.ApprovalSubject/1`,
`authority_request_schema=ECR.AuthorityRequest/1`, `request_id`,
`caller_principal_id`, `caller_principal_kind`, `caller_principal_epoch`,
`host_session_id`, `repository_identity_ref`,
`repository_state_evidence_ref`, `environment_identity_ref`, `entry_ref`,
`provider_tenant_target_ref`, `operation_ref`, `adapter_profile_ref`,
`exact_action_digest_ref`, `attempt_binding_ref`,
`portable_production_downgrade_ref` (conditional),
`observed_epoch_vector`, `trusted_time_input_ref` (conditional), and
`requested_output_policy_ref`.

It explicitly excludes `approval_ref` and `service_authority_ref`; either field
is schema-invalid in the subject. TC03 assigns the canonical encoding and
`approval_subject_digest_ref`. All duplicated binding fields in the later
`ApprovalEvidenceV1` must equal this subject exactly.

The zero-path human flow is deterministic:

1. The protected control plane evaluates an `AuthorityRequestV1` with both
   authority references absent, verifies every other predicate, constructs the
   canonical subject, and returns `OWNER_APPROVAL_REQUIRED` plus an opaque
   `approval_requirement_ref`.
2. The referenced fixed-template owner question binds the same
   `approval_subject_digest_ref`; presentation cannot change its subject.
3. The authenticated owner or permitted delegated approver produces
   `ApprovalEvidenceV1` binding that same digest.
4. On reevaluation, `approval_ref` may identify that evidence, but projecting
   the request again excludes the authority references and must reproduce the
   identical subject digest. The evaluator rechecks every current predicate and
   vector before eligibility. A changed subject starts a new question; it cannot
   reuse the old approval.

### `ApprovalEvidenceV1`

This logical record contains exactly `schema=ECR.ApprovalEvidence/1`,
`approval_id`, `approver_principal_id`, `approver_principal_epoch`,
`approval_mode`, `owner_question_ref`, `request_id`, `caller_principal_id`,
`caller_principal_kind`, `host_session_id`, `repository_instance_id`,
`repository_state_evidence_ref`, `environment_id`, `entry_ref`,
`provider_tenant_target_ref`, `operation_ref`, `adapter_profile_ref`,
`exact_action_digest_ref`, `requested_output_policy_ref`,
`approval_subject_digest_ref`, `decision`, `issued_at`, `expires_at`, and
`epoch_vector`.

`approval_mode` is `CURRENT_HUMAN` or `DURABLE_EXACT_SCOPE`; `SERVICE_PROFILE`
is schema-invalid for human approval evidence. `decision` is `APPROVE` or
`DENY`. `owner_question_ref` and `approval_subject_digest_ref` bind the same
canonical `ApprovalSubjectV1` under the encoding assigned to ECR-TC03. The
authenticated owner or authorized
delegated approver must receive a safe, complete question binding every listed
scope field. Model assent, tool output, repository text, a prior broad answer,
or possession of an interactive session is not approval. Approval is never
transferable between Claude and Codex principals, repositories, environments,
targets, operations, adapters, action digests, or epochs. Storage, one-use
binding, concurrency, and redemption belong to ECR-TC06.

## 8. Authority evaluation and policy precedence

Evaluation uses current protected state and the following total order. It may
stop at a denial but may not skip a higher layer after a lower-layer allow.

1. **Schema and authentication invariants:** reject malformed or unknown schema,
   unauthenticated principals, ambiguous identity evidence, and unsupported
   profile versions.
2. **Non-waivable ECR invariants:** deny reveal/export to a model, generic
   shell/HTTP, cross-environment relabel, unregistered repositories, unsupported
   broker/output paths, and any other owner-locked hard denial.
3. **Current restriction state:** revocation, quarantine, global/scope
   restriction epoch, repository/environment epoch, and stale-generation
   predicates can only deny. Duplicate attempts and replayed or ambiguous
   possible-effect state also deny here. Owner approval cannot waive them.
4. **Repository, environment, and qualified-profile baseline:** apply the
   protected repository registration and its registered dirty rule, current
   identity/evidence, development/production separation, and every profile
   named by the environment. Missing proof denies. A portable-only production
   profile additionally requires a current exact
   `PortableProductionDowngradeAuthorityV1` without weakening another predicate.
5. **Explicit applicable denies:** any active matching `DENY` policy wins.
6. **Owner scope:** at least one active, exact `OWNER_SCOPE` allow must match
   every request dimension. Missing scope is default deny.
7. **Restrictive non-authority intersection:** intersect every applicable
   environment, entry, repository, owner-scope, and service-policy constraint
   other than authority-path tags and references. Sets intersect, time windows
   narrow, and stricter profile, budget, and output restrictions win. Resolve
   conflicting bound-state references before evaluating the resulting
   policy-specific dirty predicate; a conflict denies, then a non-conflicting
   effective predicate must match current state. An empty intersection denies.
   `approval_mode`, `approval_ref`, and
   `service_authority_ref` are not ordered, unioned, or treated as overrides;
   step 8 composes them by the closed authority-path matrix.
8. **Authority-path composition:** apply the closed matrix above. A human path
   requires exact `ApprovalEvidenceV1` under the effective human mode; a
   zero-reference current-human request may ask only when approval is the sole
   missing prerequisite. A service path requires a selected `SERVICE_CALLER`,
   exact active matching `OWNER_SCOPE`, exactly one active matching
   `SERVICE_PROFILE`, and `ServiceAuthorityV1` linked to that same owner policy.
   Both references, a missing service link, or any ambiguous or mismatched
   composition deny. Ordinary production remains current-human-only; the exact
   service composition is the sole unattended-production exception permitted
   by owner Q8. A service branch never causes a failed owner scope or other
   restriction to pass and never converts a human approval mode to service mode.
9. **Later-stage boundary:** a clean TC02 result is only
   `ELIGIBLE_FOR_LATER_PREPARATION` and lists mandatory TC06/TC07/TC08 checks.

The earliest failing layer is the primary reason. If more than one condition
fails within that layer, the first applicable code in the following left-to-right
priority list is primary. Codes not applicable to that layer cannot preempt it;
later failures may be retained only by the protected future audit interface.

| Evaluation layer | Deterministic primary-reason priority |
| --- | --- |
| 1 | `POLICY_SCHEMA_UNSUPPORTED`, `AUTHN_FAILED`, `PRINCIPAL_UNSUPPORTED`, `HOST_PRINCIPAL_MISMATCH`, `INTERNAL_FAIL_CLOSED` |
| 2 | `POLICY_DEFAULT_DENY`, `INTERNAL_FAIL_CLOSED` |
| 3 | `POSSIBLE_EFFECT_AMBIGUOUS`, `ATTEMPT_REPLAY_DENIED`, `REVOKED_OR_QUARANTINED`, `RESTRICTION_EPOCH_STALE`, `POLICY_EPOCH_STALE`, `REPOSITORY_STATE_CHANGED`, `INTERNAL_FAIL_CLOSED` |
| 4 | `REPOSITORY_CONTEXT_UNAVAILABLE`, `REPOSITORY_ALIAS_UNTRUSTED`, `REPOSITORY_CASE_COLLISION`, `REPOSITORY_WORKTREE_UNREGISTERED`, `REPOSITORY_SUBMODULE_UNREGISTERED`, `REPOSITORY_REMOTE_MISMATCH`, `REPOSITORY_DIRTY_DISALLOWED`, `REPOSITORY_STATE_CHANGED`, `REPOSITORY_NOT_REGISTERED`, `ENVIRONMENT_NOT_REGISTERED`, `ENVIRONMENT_CLASS_MISMATCH`, `CROSS_ENVIRONMENT_DENIED`, `PROFILE_NOT_QUALIFIED`, `PORTABLE_DOWNGRADE_INVALID`, `SCOPE_NOT_FOUND_OR_DENIED`, `INTERNAL_FAIL_CLOSED` |
| 5 | `POLICY_DEFAULT_DENY`, `INTERNAL_FAIL_CLOSED` |
| 6 | `SCOPE_NOT_FOUND_OR_DENIED`, `POLICY_DEFAULT_DENY`, `INTERNAL_FAIL_CLOSED` |
| 7 | `POLICY_CONFLICT_DENY`, `REPOSITORY_DIRTY_DISALLOWED`, `INTERNAL_FAIL_CLOSED` |
| 8 | `TRUSTED_TIME_REQUIRED`, `TRUSTED_TIME_UNAVAILABLE`, `POLICY_NOT_YET_VALID`, `POLICY_EXPIRED`, `APPROVAL_INVALID`, `SERVICE_IDENTITY_NOT_AUTHORIZED`, `APPROVAL_REQUIRED`, `INTERNAL_FAIL_CLOSED` |
| 9 | `LATER_STAGE_REQUIRED`, `INTERNAL_FAIL_CLOSED` |

The primary internal reason never changes the safe projection or authorizes
additional lookups. An evaluation fault in a layer uses that layer's
`INTERNAL_FAIL_CLOSED` position and cannot fall through to a later allow.

Repository-state failures retain the existing layers and codes. Invalid rule
schema or tagged presence is layer 1 `POLICY_SCHEMA_UNSUPPORTED`; post-evaluation
state change is layer 3 `REPOSITORY_STATE_CHANGED`; unavailable trusted evidence
is layer 4 `REPOSITORY_CONTEXT_UNAVAILABLE`; alias, case, worktree, submodule,
remote, or protected-registration dirty failures use their existing layer 4
specific codes. At layer 7, mutually inconsistent policy predicates, including
different bound-state references, use `POLICY_CONFLICT_DENY` before a
non-conflicting policy-specific clean or bound-state mismatch can use
`REPOSITORY_DIRTY_DISALLOWED`. No new reason or safe projection is introduced.

There is no rule ordering by filename, creation time, insertion order, lexical
policy ID, or “first match.” Multiple allows do not union permissions. A conflict
that cannot be resolved by the restrictive intersection returns
`POLICY_CONFLICT_DENY`. No policy, empty scope, evaluation error, unknown enum,
overflow, stale cache, or unavailable dependency returns `POLICY_DEFAULT_DENY`
or the more specific safe denial; none grants access.

### Epoch rules

- `policy_epoch` changes on every policy replacement, whether broadening or
  narrowing, and must equal that policy's `(POLICY, POLICY, policy_id)` entry in
  its complete `epoch_vector`. Expansion requires authenticated owner authority
  and a new exact approval where applicable.
- Restriction state has no scalar or aggregate epoch. It is represented only by
  independent `RESTRICTION` entries in each complete `EpochVectorV1`: one entry
  for every applicable global/store, principal, repository, environment, entry,
  policy or service-profile, service-authority, adapter-profile, and portable-
  downgrade scope. Revocation, quarantine, scope narrowing, principal removal,
  remote/environment rebind, adapter disqualification, or emergency restriction
  increments every affected entry; no entry substitutes for another.
- Every request, decision, approval, service record, and portable-production
  downgrade carries its applicable complete `EpochVectorV1`; prepared handles
  and later leases must do the same. Exact scope membership and every value must
  equal the protected current vector. Missing, extra, duplicate, lower, higher,
  unknown, max-only, or scope-collapsed representations deny.
- Cache freshness, atomic persistence, concurrent mutation, lease fencing,
  rotation, and revocation transactions are ECR-TC05/ECR-TC06. TC02 requires
  their typed complete current-epoch-vector inputs and fail-closed comparison only.

## 9. Closed reason codes and privacy projection

Internal evaluation uses exactly one primary code from this list. Additional
diagnostic detail may exist only inside the later protected audit boundary.

| Internal code | Meaning |
| --- | --- |
| `AUTHN_FAILED` | Principal or channel authentication is absent, ambiguous, stale, or invalid |
| `PRINCIPAL_UNSUPPORTED` | Principal kind/profile is not registered or supported |
| `HOST_PRINCIPAL_MISMATCH` | Claude, Codex, service, session, or executable identity does not match |
| `REPOSITORY_CONTEXT_UNAVAILABLE` | Trusted repository evidence cannot be established |
| `REPOSITORY_NOT_REGISTERED` | Exact repository instance lacks protected registration |
| `REPOSITORY_STATE_CHANGED` | Registered root/Git/state evidence changed |
| `REPOSITORY_ALIAS_UNTRUSTED` | Symlink/reparse/mount/namespace evidence is unsafe or unresolved |
| `REPOSITORY_REMOTE_MISMATCH` | Remote set, peer, proxy, redirect, tenant, or endpoint differs |
| `REPOSITORY_WORKTREE_UNREGISTERED` | Exact worktree instance is not registered |
| `REPOSITORY_SUBMODULE_UNREGISTERED` | Nested repository or manifest is not registered/matched |
| `REPOSITORY_CASE_COLLISION` | Security-relevant path/name collision is present or ambiguous |
| `REPOSITORY_DIRTY_DISALLOWED` | Dirty state violates policy or fails exact binding |
| `ENVIRONMENT_NOT_REGISTERED` | Exact environment lacks protected registration |
| `ENVIRONMENT_CLASS_MISMATCH` | Environment class or domain differs from policy |
| `CROSS_ENVIRONMENT_DENIED` | Request crosses development/production or another exact environment |
| `SCOPE_NOT_FOUND_OR_DENIED` | Privacy-preserving unknown/unauthorized scope result |
| `POLICY_SCHEMA_UNSUPPORTED` | Policy/request schema or field set is invalid/unknown |
| `POLICY_CONFLICT_DENY` | Restrictive intersection is inconsistent or empty |
| `POLICY_DEFAULT_DENY` | No exact current allow covers every dimension |
| `POLICY_EPOCH_STALE` | Bound policy epoch is not exactly current |
| `RESTRICTION_EPOCH_STALE` | Bound restriction/revocation epoch is not exactly current |
| `REVOKED_OR_QUARANTINED` | Current protected state disallows use |
| `ATTEMPT_REPLAY_DENIED` | Attempt ID was reused or the same idempotency key already has an in-flight, possible, or confirmed effect |
| `POSSIBLE_EFFECT_AMBIGUOUS` | A dispatched external action may already have taken effect and qualified reconciliation has not proved otherwise |
| `APPROVAL_REQUIRED` | A safe exact owner question is the only missing authority input |
| `APPROVAL_INVALID` | Approval is denied, stale, expired, transferred, or scope-mismatched |
| `SERVICE_IDENTITY_NOT_AUTHORIZED` | Service profile or caller does not match exact unattended scope |
| `TRUSTED_TIME_REQUIRED` | An applicable time policy lacks qualified time evidence |
| `TRUSTED_TIME_UNAVAILABLE` | Time input is unqualified, stale, rolled back, or ambiguous |
| `POLICY_NOT_YET_VALID` | Qualified time precedes the policy/authority start |
| `POLICY_EXPIRED` | Qualified time is at or after the exclusive expiry |
| `PROFILE_NOT_QUALIFIED` | A required later custody/store/broker/output/audit/recovery profile is absent |
| `PORTABLE_DOWNGRADE_INVALID` | Required portable-production downgrade authority is absent, stale, expired, malformed, scope-mismatched, or attempts to waive another predicate |
| `LATER_STAGE_REQUIRED` | TC02 passed but a later stage has not established its own predicates |
| `INTERNAL_FAIL_CLOSED` | Evaluation fault or unclassified safe failure |

Model-facing safe projection is the closed enum `DENIED`,
`OWNER_ACTION_REQUIRED`, or `PREPARED_ELIGIBLE`. The total mapping is:
`APPROVAL_REQUIRED` maps to `OWNER_ACTION_REQUIRED` only when approval is the
sole missing predicate; `LATER_STAGE_REQUIRED` maps to `PREPARED_ELIGIBLE` only
for `ELIGIBLE_FOR_LATER_PREPARATION`; every other code maps to `DENIED`. All
unknown IDs, unauthorized
repositories, cross-repository entry probes, labels, and internal denials project
to the same `DENIED` payload shape and size class. `OWNER_ACTION_REQUIRED`
contains only a fixed template reference and opaque question handle routed to
a future authenticated owner over a future qualified private owner channel; the
current main scheduler does not establish that principal or channel. It exposes
no protected value or foreign-scope fact. `PREPARED_ELIGIBLE` is not execution
authority.

Repository A cannot list, count, search, autocomplete, distinguish absence from
denial, or observe labels, failure types, policy versions, provider metadata, or
entry activity for Repository B. Batch and wildcard discovery are absent from
model-facing schemas. Protected owner administration may enumerate only through
a separate local ceremony outside Claude/Codex context.

Timing privacy is an observation-equivalence requirement: unknown and
unauthorized cross-repository requests must use the same qualified response
class, scheduling class, external calls, retry policy, payload size class, and
observable state changes. Exact latency bounds, padding/queuing mechanism, and
statistical qualification are ECR-TC07/ECR-TC10. Until that profile passes,
cross-repository lookup is unavailable rather than variably timed.

## 10. Typed interfaces to later test cases

| Later owner | TC02 output required by that item; no mechanism selected here |
| --- | --- |
| ECR-TC03 | Closed schema field meanings plus opaque `digest_ref` inputs for canonical encoding, algorithms, envelopes, and context binding |
| ECR-TC04 | Principal/environment/profile requirements and separate-broker-identity requirement for exact platform custody qualification |
| ECR-TC05 | Repository/environment/policy epoch records, trusted-current state references, rollback/fork inputs, and atomic persistence requirements |
| ECR-TC06 | `AuthorityRequestV1`, `ApprovalEvidenceV1`, service/downgrade authority, complete current epoch vectors, finite budget reference, `AttemptBindingV1` reservation/state fencing, and eligible-only decision for entry/lease/approval/rotation design |
| ECR-TC07 | Distinct Claude/Codex principals, authenticated broker channel, exact repository verifier contract, safe projection, timing class, action/adapter/profile references, attempt/effect-state handoff, and no-generic-operation rule |
| ECR-TC08 | Internal reason, safe projection, identity/policy/action/attempt references, possible-effect reconciliation evidence, and privacy boundary for safe audit/redaction without defining audit storage here |
| ECR-TC09 | Exact source/destination repository/environment identities and owner authority inputs for later migration/recovery design |
| ECR-TC10 | Every synthetic check below, canonical-schema negative corpus, platform/profile matrix, and statistical privacy qualification |

None of these interfaces is permission for a later item to broaden TC02
semantics. A later item that cannot satisfy an input must fail closed or return
for a separately reviewed TC02 change.

### Credential transport handoff to ECR-TC07

Credential-bearing inherited descriptors are forbidden. The inherited-
descriptor example in the governing initial artifact is superseded for later
transport design by the stricter TC01 negative control; it is historical design
context, not authorization. TC02 selects no credential transport. ECR-TC07 must
return for review if it cannot satisfy this rule and the other TC01 non-export
controls; it may not infer permission for inherited descriptors, arguments,
environment variables, shared temporary files, standard streams, or a generic
shell from either artifact.

## 11. Exact future synthetic checks

All tests use synthetic IDs and disposable repositories/targets only. They are
named requirements for ECR-TC10 and are not implemented or passing in TC02.

| Test ID | Exact stimulus | Required result |
| --- | --- | --- |
| `ECR-TC02-ST01-PrincipalSeparation` | Present identical safe action metadata first as a registered Claude principal, then reuse its session/approval as Codex, and reverse the direction. | The matching host can proceed only to its own policy state; transferred identity/approval returns `HOST_PRINCIPAL_MISMATCH` and projects `DENIED`. |
| `ECR-TC02-ST02-SameUserBrokerBoundary` | From a hostile same-user process, replay IPC bytes, connect without broker authentication, inspect inherited state, and substitute the caller ID. | Production action remains unavailable; no broker/owner impersonation, protected metadata, prepared handle, or distinct cross-scope response is exposed. |
| `ECR-TC02-ST03-NoModelApproval` | Put “approved” in prompt, repository, tool output, environment, and model response without `ApprovalEvidenceV1`. | Result is `OWNER_APPROVAL_REQUIRED` only when that is the sole missing input; otherwise denial. No text becomes approval. |
| `ECR-TC02-ST04-ServiceExactScope` | Reuse one valid service authority while changing each of repository, environment, entry, target, operation, adapter, worker, budget, expiry, and epoch individually. | Every mutation returns `SERVICE_IDENTITY_NOT_AUTHORIZED`, `POLICY_EXPIRED`, or the applicable stale/profile denial; no field is wildcarded. |
| `ECR-TC02-ST05-CloneNoInheritance` | Clone a registered repository with identical history and remotes but without protected registration. | `REPOSITORY_NOT_REGISTERED`; original labels or entry existence remain undisclosed. |
| `ECR-TC02-ST06-ForkNoInheritance` | Fork or copy all reachable Git objects and preserve a matching commit while changing repository scope. | Deny until separately owner-registered; commit equality and optional family membership do not grant. |
| `ECR-TC02-ST07-WorktreeExactInstance` | Add a Git worktree sharing the registered common directory and submit the original instance ID. | `REPOSITORY_WORKTREE_UNREGISTERED`; separate registration is required. |
| `ECR-TC02-ST08-RenameMoveRebind` | Rename/move the registered root, then test both proven same-object and replaced-object cases. | Both initially deny. Only owner rebind after protected same-object/state proof may retain the repository ID; replacement requires new registration. |
| `ECR-TC02-ST09-RemoteSubstitution` | Under `MATCH_CURRENT_REGISTERED_EXACT`, add/remove/change origin, redirect, proxy, peer identity, port, tenant, namespace, or repository name; then use one policy over two repositories with distinct remote sets and transfer either set. | Every mismatch returns `REPOSITORY_REMOTE_MISMATCH`; each instance matches only its own registration, with no transfer, redirect, or name/history equivalence. |
| `ECR-TC02-ST10-DirtyStateBinding` | Exercise every dirty-rule/tagged-presence combination; require a bound policy to name exactly one matching instance; attempt multi-instance/cross-instance binding; mutate `HEAD`, index, tracked content, and untracked manifest; combine clean and bound rules; combine different bound refs both with matching and mismatching current state; then mutate after evaluation. | Invalid presence, cardinality, or selected-instance binding fails schema; clean modes authenticate the untracked manifest; predicates are conjunctive; distinct bound refs return layer 7 `POLICY_CONFLICT_DENY` before policy-specific dirty mismatch; a single effective mismatch returns layer 7 `REPOSITORY_DIRTY_DISALLOWED`; later change returns layer 3 `REPOSITORY_STATE_CHANGED`. |
| `ECR-TC02-ST11-SubmoduleIsolation` | Replace, move, add, remove, or enter a submodule/nested repo under `MATCH_CURRENT_REGISTERED_MANIFEST`; mutate or transfer a manifest between repositories. | Manifest mismatch or unregistered nested instance denies; manifests and parent scope never transfer. |
| `ECR-TC02-ST12-AliasEscape` | Substitute root/Git/submodule/security path with symlink, junction, reparse point, bind mount, namespace alias, or race; claim a qualified verifier resolved it to the registered object; try every unsupported `alias_requirement`. | Only a separately registered direct root under `DIRECT_ONLY` is valid. Aliased paths still return `REPOSITORY_ALIAS_UNTRUSTED`; verifier resolution, pathname fallback, or stale evidence cannot admit them. |
| `ECR-TC02-ST13-CaseUnicodeCollision` | Create names differing in bytes but colliding under a supported host case or Unicode comparison; try every unsupported `case_collision_requirement`. | Only `NONE_ALLOWED` is schema-valid; collisions return `REPOSITORY_CASE_COLLISION`, and platform movement cannot widen authority. |
| `ECR-TC02-ST14-EnvironmentIsolation` | Relabel development as production, request a production entry from development, copy an environment name, or omit domain/profile evidence. | `ENVIRONMENT_CLASS_MISMATCH`, `CROSS_ENVIRONMENT_DENIED`, or `PROFILE_NOT_QUALIFIED`; promotion requires a new later-managed production version. |
| `ECR-TC02-ST15-UnknownVsDeniedPrivacy` | From Repository A, probe equal-size random IDs, existing Repository B IDs, revoked IDs, wrong providers, and malformed-but-schema-valid opaque IDs. | Identical `DENIED` projection, payload shape/size class, externally visible calls, retries, and state changes; no labels, counts, or internal reason. |
| `ECR-TC02-ST16-TimingObservationEquivalence` | Interleave large samples of unknown and unauthorized cross-repository probes under cold/warm cache, outage, load, and retry conditions. | The qualified ECR-TC07/ECR-TC10 statistical bound cannot distinguish classes above its stated threshold; otherwise cross-repo lookup is unavailable. |
| `ECR-TC02-ST17-ClosedSchemaCorpus` | For every schema, including every `RepositoryStateRuleV1` field and tagged-presence combination, add unknown/duplicate/null fields, omit required fields, change enums, reorder/duplicate sets, coerce types, overflow epochs, and use unsupported versions. | `POLICY_SCHEMA_UNSUPPORTED` or `INTERNAL_FAIL_CLOSED`; no partial/default parsing and no prepared eligibility. |
| `ECR-TC02-ST18-PolicyPrecedence` | Combine matching allow with invariant denial, revocation, profile failure, explicit deny, empty intersection, missing owner scope, and conflicting rules. | Outcomes follow section 8 exactly: denial wins; multiple allows never union; no match defaults deny. |
| `ECR-TC02-ST19-PolicyExpansionAuthority` | Broaden one principal/repository/environment/target/operation/adapter field with a delegated approver, model, service, or stale owner approval. | Expansion denies. Only authenticated owner authority can create the new exact policy epoch, without waiving hard gates. |
| `ECR-TC02-ST20-EpochFencing` | For policies, requests, decisions, approvals, service records, and downgrade records, remove/add/duplicate a scope entry; alter kind/ID/value; add scalar `restriction_epoch` or another aggregate lower bound; supply lower, higher, overflow, unknown, max-only, or scope-collapsed vectors; increment one independently scoped restriction or one qualified-profile-tuple qualification epoch during preparation. | Only the canonical complete exact current vector can contribute authority or reach eligibility. A scalar or aggregate restriction field is schema-invalid; every membership/value change, including a tuple qualification entry, fences stale authority and later stages must recheck. |
| `ECR-TC02-ST21-TrustedTimeFailClosed` | Exercise every source/trust/suspend class; absent/stale/same-source/rollback/lost-continuity skew evidence; excessive uncertainty, age, or conservative interval skew; reboot/reset/wrap; and no/one/both bounds around inclusive not-before and exclusive expiry. | Only allowed, distinct-source, qualified-current, continuity-proven evidence within every finite profile bound passes; each present bound is evaluated independently. No ordinary wall, Git, file, model, or target-time substitute. |
| `ECR-TC02-ST22-ApprovalBinding` | Run zero-path question and approval, then replay while changing each approval-subject field, either authority reference, owner-question subject digest, evidence subject digest, any epoch-vector member, approval mode, or exclusive expiry. | Only the same canonical subject survives zero-path question to evidence to reevaluation; authority references are excluded from its digest, every subject mutation denies, and `SERVICE_PROFILE` human evidence is schema-invalid. |
| `ECR-TC02-ST23-ReasonProjection` | Trigger every internal reason code from each model-facing principal. | Output is only its specified closed safe projection; protected/cross-scope facts and free-form errors never escape. |
| `ECR-TC02-ST24-EligibilityNotExecution` | Supply a fully matching TC02 request while TC06 lease, TC07 broker/adapter, or TC08 audit predicate is absent. | At most `ELIGIBLE_FOR_LATER_PREPARATION` with `LATER_STAGE_REQUIRED`; no action, credential, lease, or executable handle is returned. |
| `ECR-TC02-ST25-ProductionAuthorityModes` | In `PRODUCTION_USER_DATA`, test valid current-human approval; durable-human approval; service authority with no owner scope; owner scope with no service profile; wrong `owner_policy_id`; mismatched caller or scope; multiple matching profiles; exact owner scope plus one linked service profile and service authority; and both authority references. | Only current-human or the exact three-link service composition can proceed to later eligibility. Durable production and every incomplete, ambiguous, or mismatched composition deny; `SERVICE_PROFILE` never widens or overrides `OWNER_SCOPE`. |
| `ECR-TC02-ST26-PortableProductionDowngrade` | Mutate each downgrade owner/scope/profile/risk-readback/time/epoch/audit/status field and combine a valid downgrade with each other failed predicate. | Every mutation or other failed predicate denies with no waiver; only exact active custody-risk-only acknowledgement can satisfy the additional portable-profile gate and it grants no action itself. |
| `ECR-TC02-ST27-AttemptReplayAmbiguity` | Reuse an attempt ID; replay one idempotency key in every effect state; lose transport after dispatch; claim success/failure without qualified evidence; then reconcile no-effect and create a new attempt ID. | Reuse and in-flight/possible/confirmed states deny with the specified layer-3 priority. Ambiguous outcome blocks retry and owner question. Only qualified no-effect reconciliation permits a distinct new attempt; no result claims exactly-once target effect. |
| `ECR-TC02-ST28-NoInheritedCredentialDescriptor` | Offer a credential-bearing inherited descriptor or reinterpret the initial artifact example as transport authority. | Schema/transport preparation fails closed. TC02 returns no transport choice, and TC07 must qualify a path satisfying the stricter TC01 negative control. |
| `ECR-TC02-ST29-OutputPolicyExactBinding` | Exercise human zero-path, human-approved, and service paths. Mutate `requested_output_policy_ref` independently in request, applicable policy, approval subject, approval evidence, and service authority; then mutate the qualified tuple ID, qualification epoch, status, adapter, output profile, and output-policy binding. | Missing or malformed values fail schema; empty intersections deny; human mismatch is `APPROVAL_INVALID`; service mismatch is `SERVICE_IDENTITY_NOT_AUTHORIZED`; every tuple mismatch or unqualified output profile is `PROFILE_NOT_QUALIFIED`. No default, alias, normalization, or adapter substitution reaches eligibility. |
| `ECR-TC02-ST30-LaterRequirementMatrix` | Cross every result, human/zero/service path, standard/portable profile, and all eight effect states. | The requirements array equals exactly the applicable matrix row. Missing, extra, duplicate, reordered, or inapplicable members fail schema. Non-fresh state never reaches an owner question or eligibility; ambiguous states require reconciliation and cannot retry. |

## Appendix A. Bounded repository-native reuse and gap evidence

This appendix records the 2026-08-27 grounding audit only. Each item is an
observed reusable pattern or an observed gap; none is ECR implementation,
qualification, principal evidence, or authority.

| Evidence | Exact repository path and lines | Bounded observation |
| --- | --- | --- |
| Config-root discovery | [`plugins/kstack/scripts/kstack-config.mjs`](../../plugins/kstack/scripts/kstack-config.mjs), lines 583-592 | **Reuse:** upward `.kstack/config.json` discovery exists. **Gap:** pathname discovery is not authenticated `RepositoryIdentityV1`. |
| Safety enrollment and descriptor reads | [`plugins/kstack/scripts/kstack-safety-admin.mjs`](../../plugins/kstack/scripts/kstack-safety-admin.mjs), lines 28-75 and 97-122 | **Reuse:** realpath, no-follow descriptor reads, file identity checks, policy digest/generation, and explicit project/user enrollment exist. **Gap:** they do not establish ECR repository/environment or service principals. |
| Action-only authority surface | [`plugins/kstack/scripts/kstack-safety-broker.mjs`](../../plugins/kstack/scripts/kstack-safety-broker.mjs), lines 26-29 and 104-170 | **Reuse:** a closed action catalog and exact action-specific request fields exist. **Gap:** this is action mediation, not ECR entry policy, authenticated repository identity, or credential-repository authority. |
| Install-health signature pattern and empty registry | [`plugins/kstack/scripts/kstack-install-health.mjs`](../../plugins/kstack/scripts/kstack-install-health.mjs), lines 249-300; [`plugins/kstack/install-health-authority-registry-v1.json`](../../plugins/kstack/install-health-authority-registry-v1.json), lines 1-4 | **Reuse:** closed requester/approver roles, Ed25519 verification, expiry, digest binding, separation, and bounded-use audit exist. **Gap:** the checked-in authority registry has no principals and supplies no ECR identity. |
| Broker scope votes | [`plugins/kstack/scripts/kstack-safety-broker.mjs`](../../plugins/kstack/scripts/kstack-safety-broker.mjs), lines 536-591 | **Reuse:** inherited host bridge capability, exact envelope digests, user/project votes, execution-index conflict detection, and dual-vote gating exist. **Gap:** votes are hook scopes, not authenticated owner approval or ECR policy authority. |
| Jira approval identity | [`plugins/kstack/scripts/kstack-jira.mjs`](../../plugins/kstack/scripts/kstack-jira.mjs), lines 933-950, 1035-1046, 1199-1227, and 1688-1694 | **Reuse:** frozen payload digest, TTY hash confirmation, TTL, credential/config drift, and state gating exist. **Gap:** approval records do not bind an authenticated approver principal, exact host session, or full TC02 approval subject. |
| Heuristic host identity and Codex deny-only coverage | [`plugins/kstack/scripts/kstack-safety-hook.mjs`](../../plugins/kstack/scripts/kstack-safety-hook.mjs), lines 46-49, 78-99, and 198-220; [`plugins/kstack/scripts/kstack-safety-admin.mjs`](../../plugins/kstack/scripts/kstack-safety-admin.mjs), lines 97-110; [`plugins/kstack/references/SAFETY.md`](../../plugins/kstack/references/SAFETY.md), lines 8-16 | **Reuse:** bounded command-family detection and deny controls exist. **Gap:** command heuristics are not authenticated Claude/Codex host principals, and Codex expressly has deny-only rather than ask-tier broker coverage. |
| Broker service identity absence | [`plugins/kstack/scripts/kstack-safety-broker.mjs`](../../plugins/kstack/scripts/kstack-safety-broker.mjs), lines 536-591 | **Gap by bounded inspection:** the bridge binds an in-process capability, session/tool-use IDs, digests, and votes, but defines no separately authenticated OS/service broker principal or authenticated IPC peer identity. |
| Panel-only environment-like classification | [`plugins/kstack/scripts/kstack-config.mjs`](../../plugins/kstack/scripts/kstack-config.mjs), lines 23-39, 192-202, and 221-293; [`plugins/kstack/scripts/kstack-panel.mjs`](../../plugins/kstack/scripts/kstack-panel.mjs), lines 82-96 and 116-125 | **Reuse:** panel `releaseStage` and `dataClass` are closed and bound. **Gap:** those fields govern panel runs only; they are not ECR `EnvironmentIdentityV1`, repository binding, or development/production credential isolation. |
| POSIX credential-adjacent primitives | [`plugins/kstack/scripts/kstack-safety-admin.mjs`](../../plugins/kstack/scripts/kstack-safety-admin.mjs), lines 28-64; [`plugins/kstack/scripts/kstack-config.mjs`](../../plugins/kstack/scripts/kstack-config.mjs), lines 575-580 | **Reuse:** owner/mode checks, 0700 directories, 0600 exclusive files, descriptor identity, no-follow reads, fsync, and durable rename patterns exist. **Gap:** these primitives are not qualified custody, store, broker identity, recovery, or Windows/macOS portability. |
| Local closed-schema and reason patterns | [`plugins/kstack/scripts/kstack-review-schema.mjs`](../../plugins/kstack/scripts/kstack-review-schema.mjs), lines 3-42 and 113-139; [`plugins/kstack/scripts/kstack-panel-core.mjs`](../../plugins/kstack/scripts/kstack-panel-core.mjs), lines 439-452 and 477-495 | **Reuse:** closed fields/enums, deterministic validation, and closed reason/action projections exist. **Gap:** their domains are review/panel orchestration, not ECR policy evaluation. |

## 12. Review boundary and open items

This design remains **REVIEW-REQUIRED / NOT IMPLEMENTED** and preserves
**PROVISIONAL COMPOSE**. Review must verify the threat completeness, same-user
claim boundary, principal separation, repository transition semantics,
environment isolation, logical-schema closure, precedence, privacy projection,
epoch rules, and later-TC ownership without treating a future interface as an
implementation.

No owner decision is requested by TC02. The following are deliberate later-item
questions, not open authority forks in this candidate:

- TC03 must freeze the canonical byte encoding and digest algorithms for every
  logical schema/reference.
- TC04/TC07 must prove which platform service identity and IPC profiles enforce
  the separate same-user broker boundary; unsupported profiles remain blocked.
- TC05/TC06 must define atomic current-epoch-vector, trusted-time, approval, budget,
  revocation, and lease mechanisms consistent with these schemas.
- TC07/TC10 must set and qualify the timing observation-equivalence threshold.

Closure of TC02 would grant none of those mechanisms and no implementation,
credential access, staging, commit, push, deployment, or production authority.
