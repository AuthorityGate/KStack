# KStack Secret Broker — SB-TC11 package and configuration contract

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC11` — skill/package layout, configuration schemas, install-health manifests, versioning, compatibility, and documentation boundaries |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Frozen dependencies | SB-TC00 `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9`; SB-TC01 `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57`; SB-TC02 `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075`; SB-TC03 `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99`; SB-TC04 `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925`; SB-TC05 `57f18fcbb172327ef85ea3e56be8fa29f7e40be233b8c884223fc793158e1d3d`; SB-TC06 `62e7863ff75922922d3b26bea25fd2aa7e8615d1c18a6d9412275d50d06b2e71`; SB-TC07 `6635aa11e3769c33541a0807fdedd7d497ae7274f01054d2ee9e83703a4d5a4b`; SB-TC08 `d15fdce75567e4dbb7d5e7400ae48aca21749a7d817f703d0947beb6b3ba966d`; SB-TC09 `f76640aabb05ae2af4288fcd7e06c6183f74edcdbe59e133c031882d95727137`; SB-TC10 `a96c00d5e1d87ba690730ebf09856ab44cf8b99c18c2ea6b5127dbcce2b7168a` |

## 1. Decision requested

Freeze how the accepted Secret Broker contracts become one installable KStack
surface without putting values or protected locators in the plugin, repository
configuration, skill context, release manifest, tests, Jira, or documentation.
Define the exact source/install/runtime artifacts, progressive skill routing,
closed public versus protected configuration, install-health claims, protocol
and schema version compatibility, cache/reinstall behavior, and truthful user
documentation.

This item does not implement the broker or qualify a host. Packaging must make
unavailable mechanisms fail closed and must not turn source-file presence into
an execution, interception, custody, or production claim.

## 2. Non-compensating rules

1. The plugin archive, skill files, agent metadata, repository configuration,
   schemas, examples, fixtures, release manifest, install-health record, and
   documentation contain no secret, secret-derived digest, backend locator,
   target locator, account/tenant identity, provider response, or protected
   state bytes.
2. Model-facing code receives closed public records and opaque random refs only.
   Protected configuration and evidence are resolved inside registered
   components after authorization; no generic config/resource/file reader is
   added to the plugin surface.
3. `kstack-secrets/SKILL.md` is a concise router and safety boundary. Detailed
   setup, operation, lifecycle, qualification, and incident procedures live in
   conditional references and are read only for the requested mode.
4. Skill text describes what the host can actually enforce. It never claims
   Codex automatic interception, treats an ordinary answer as approval, or
   turns a Claude hook result into a Codex/Windows/WSL/Linux claim.
5. Plugin, public API, protected store, worker, adapter, audit, qualification,
   configuration, and evidence versions are independent. Plugin SemVer or a
   Codex cachebuster never implies protocol compatibility or qualification.
6. Unknown fields, unknown enum members, noncanonical encodings, forward
   versions, partial migrations, and missing compatibility entries reject.
   There is no best-effort parsing, downgrade write, or “probably compatible”.
7. Install health proves only the exact bytes, paths, manifests, schemas, and
   declared non-secret probes it executed. It cannot claim interactive skill
   activation, hook enforcement by the live host, backend custody, target use,
   leak containment, migration, recovery, or SB-TC10 qualification.
8. A host manifest accepted by one validator/version cannot be inferred valid
   for another. Validator/host disagreement is `BLOCKED_HOST_SCHEMA_DRIFT`, not
   permission to remove a safety surface or ignore the failed validator.
9. Installation and cache refresh never read or migrate protected state, enroll
   a credential, enable a backend, contact a target, or create a parallel Jira
   source. This repository's Jira route stays WSL-only.
10. Software rollback may select a byte-identical compatible package pointer.
    It never restores protected state, evidence, audit head, secret generation,
    migration history, or retired source.
11. Examples use registry-safe identifiers and generated synthetic fixtures
    only. A documentation example is never executable production policy.
12. Release cannot proceed with an untracked artifact, stale audit manifest,
    unresolved host schema drift, failing skill/plugin validator, broken probe,
    or compatibility/migration gap.

## 3. Canonical source layout

The source plugin remains one `kstack` plugin. Secret Broker files use this
closed ownership layout:

```text
plugins/kstack/
|-- .codex-plugin/plugin.json
|-- .claude-plugin/plugin.json
|-- install-health-contract-v2.json
|-- install-health-audit-manifest-v2.json
|-- secret-broker-release-manifest-v1.json
|-- schemas/secret-broker/v1/
|   |-- public-config.schema.json
|   |-- public-request.schema.json
|   |-- public-result.schema.json
|   |-- qualification-public.schema.json
|   `-- compatibility.schema.json
|-- skills/kstack-secrets/
|   |-- SKILL.md
|   |-- agents/openai.yaml
|   `-- references/
|       |-- setup.md
|       |-- operations.md
|       |-- lifecycle.md
|       |-- qualification.md
|       `-- incidents.md
|-- references/SECRET_BROKER.md
|-- scripts/
|   |-- kstack-secret-broker.mjs
|   |-- kstack-secret-install-health.mjs
|   `-- secret-broker/                    # model-free shared modules
`-- workers/
|   |-- manifests/                        # closed worker/adaptor descriptors
|   `-- <versioned packaged native workers when implemented>

tests/fixtures/secret-broker/              # repository-only synthetic descriptors
```

`references/SECRET_BROKER.md` is the short repository-wide invariant and
evidence-level overview used by agents deciding whether the skill applies. It
does not duplicate operational procedures or machine schemas. The skill's
references are instructions for agents. Machine schemas and release manifests
are data consumed by deterministic validators; they are not loaded into model
context unless the user asks to design or inspect those interfaces.

Production native workers are packaged files with release-manifest entries.
JavaScript helpers and current Windows/Linux experiments stay explicitly
`development-precedent` until their SB-TC10 exact cells qualify. The source tree
does not reserve empty production-worker filenames or imply future platform
support.

No second secret skill, platform-specific Jira secret skill, generic vault MCP,
or value resource is added. All model-facing operations enter through
`kstack-secrets`; platform selection is protected registry behavior.

## 4. Entry skill and progressive disclosure

The entry `SKILL.md` contains only:

- the no-model-value/no-source-inspection rule;
- the difference among inventory, setup, operation, lifecycle, migration,
  recovery, incident response, and qualification;
- the WSL-only Jira rule and retired Windows Jira credential route;
- how to select exactly one relevant reference;
- the explicit value-free CLI entrypoint and its permitted public outcomes;
- the main-window approval boundary and no Codex interception claim; and
- the stopping rule for unavailable, stale, ambiguous, or compromised states.

Reference routing is exact:

| Request | Required reference |
|---|---|
| install, select backend, enroll, import, migrate, uninstall | `references/setup.md` |
| describe/list/prepare/execute one registered use | `references/operations.md` |
| create, rotate, renew, revoke, delete, recover generation | `references/lifecycle.md` |
| qualify, benchmark, canary, pilot, promote, roll out | `references/qualification.md` |
| pasted/exposed value, audit failure, ambiguous effect, support | `references/incidents.md` |

If one request spans modes, the skill reads only those rows. References link to
the stable `SECRET_BROKER.md` contract rather than copying its invariants. They
contain no host/home paths, tenant/account examples, provider response samples,
or generic commands that could expose values.

`agents/openai.yaml` keeps `allow_implicit_invocation: true` because user-facing
secret migration/use should be discoverable. Its `display_name`, 25–64 character
`short_description`, and one-sentence `default_prompt` stay consistent with the
skill; source metadata names `$kstack-secrets` exactly as required by the skill
validator. Plugin qualification proves that the host presents/resolves it as
the `kstack`-namespaced skill, while direct-copy qualification proves the
unqualified form. Installation does not rewrite the prompt or skill name. No
MCP dependency is declared unless an actual companion MCP exists; the broker
is not modeled as a generic MCP.

Skill validation uses the version-pinned validator named by the release
manifest plus behavior tests. Regex assertions can protect critical wording,
but cannot substitute for tests that model unsafe source inspection, fake
approval, direct helper invocation, unavailable backend, ambiguity, and
value-bearing output.

## 5. Model-facing public configuration

The repository may add only this closed, value-free block to
`.kstack/config.json` after an explicit migration to configuration schema 2:

```text
secretBroker = {
  schemaVersion: "kstack-secret-broker-public-config-v1",
  enabled: boolean,
  frontEndMode: "EXPLICIT_ONLY",
  portfolioPolicyId: registry-id-v1,
  brokerProfileId: registry-id-v1,
  inventoryMode: "OWNER_SUPPLIED_SAFE_METADATA_ONLY",
  desiredDevelopmentBackend: "OS_LOCAL" | "NONE",
  desiredProductionBackend: "OPENBAO" | "NONE",
  minimumEvidenceByEnvironment: {
    development: "SYNTHETIC_QUALIFIED",
    pilot: "PILOT_VALIDATED",
    production: "PRODUCTION_APPROVED"
  },
  directPathPolicy: "REGISTERED_DENY_V1",
  jiraRoute: "WSL_AUTHORITATIVE_V1",
  publicCompatibilityProfileId: registry-id-v1,
  publicQualificationRef: opaque-random-ref-v1 | "UNAVAILABLE"
}
```

Top-level configuration schema 1 does not silently accept this block even if
the current parser happens to ignore unknown top-level keys. A schema-2-capable
binary reads schema 1 only as the exact legacy schema and projects an in-memory
disabled broker; it writes only schema 2. Schema 2 rejects unknown keys at every
level and its exact default block has `enabled=false`, both desired backends
`NONE`, and qualification `UNAVAILABLE`. Enabling is a separate owner action.

Configuration migration is two-phase and journaled. Setup first stages and
health-validates the new binary while the active schema remains v1, then
activates that backwards-readable binary in broker-disabled mode. Only that
binary generates, validates, fsyncs, atomically replaces, and reads back the v2
config. Until the first broker enablement, protected-state open, provider/target
contact, or other protected effect, failure may restore the exact retained v1
bytes and the prior binary. The first such action requires a durable
`CONFIG_V2_COMMITTED` fence before contact; afterward v1 restoration and launch
of a v1-only binary are permanently denied. Failure uses a v2-capable software
rollback or reviewed forward repair. Neither path edits protected state.

Repository configuration never stores a handle, backend instance ref, provider
namespace/path/endpoint, target ref, worker path, credential source path,
account/tenant/user/host identity, policy body, audit locator, protected-state
locator, or evidence-store locator. `publicQualificationRef` is a fresh random
scope-bound reference that exposes no digest/equality across repositories and
cannot authorize work.

The parser has one canonical JSON encoding, exact keys, well-formed Unicode,
closed enums, byte/list limits, duplicate-key rejection before ordinary JSON
materialization, and a 65,536-byte whole-config maximum. The default/template,
validator, migration, documentation, and tests are generated or checked from
the same schema artifact; duplicated hand-maintained enum sets are release
blocking.

## 6. Protected configuration boundary

Protected configuration is not a repository file or model-facing resource. It
is a set of separately typed records held by the registered protected-state
adapter:

```text
secret-broker-protected-binding-v1 = {
  schemaVersion: "kstack-secret-broker-protected-binding-v1",
  repositoryScopeRef: protected-opaque-ref-v1,
  environmentScopeRef: protected-opaque-ref-v1,
  backendInstanceRef: protected-opaque-ref-v1,
  backendConfigurationRef: protected-opaque-ref-v1,
  bootstrapProfileRef: protected-opaque-ref-v1,
  auditProfileRef: protected-opaque-ref-v1,
  qualificationAuthorityRef: protected-opaque-ref-v1,
  activeEvidenceEpochRef: protected-opaque-ref-v1,
  registrySetDigest: digest-v1,
  authorityEpoch: monotonic-uint64-v1
}
```

Target, adapter, handle, lifecycle, audit, source-ownership, recovery, and
qualification records remain in their SB-TC02–SB-TC10 schemas and are reached
only through opaque protected refs. No protected record contains a plaintext
value unless its frozen contract explicitly owns the transient bounded value
crossing. The public config loader cannot open, validate, log, sanitize, back
up, or migrate protected records.

The protected adapter validates record version, canonical bytes, integrity,
scope, authority epoch, rollback/head relation, and exact cross-record digests
before use. A missing adapter or unsupported protected schema makes the broker
`UNAVAILABLE`; installation never creates a plaintext fallback.

## 7. Release manifest and compatibility matrix

```text
secret-broker-release-manifest-v1 = {
  schemaVersion: "kstack-secret-broker-release-manifest-v1",
  pluginBaseVersion: strict-semver-v1,
  contentEntries: sorted-list-of-content-entry-v1,
  contentSetDigest: digest-v1,
  contractDigests: exact-map-SB-TC00-through-SB-TC11-v1,
  publicConfigSchema: exact-version-v1,
  publicApiSchema: exact-version-v1,
  protectedRecordSchemas: sorted-closed-map-v1,
  workerProtocols: sorted-closed-map-v1,
  adapterProtocols: sorted-closed-map-v1,
  auditProtocol: exact-version-v1,
  qualificationProtocol: exact-version-v1,
  hostCompatibilityProfiles: sorted-list-of-host-compatibility-profile-v1,
  validatorArtifacts: sorted-list-of-artifact-digest-v1,
  installHealthContractDigest: digest-v1,
  sourceAuditProfileId: "kstack-release-audit-v2"
}
```

The release manifest is an acyclic leaf root. `contentEntries` binds every
Secret Broker-owned distributed artifact except the release manifest and the
self-excluding source-audit manifest; `contentSetDigest` is the domain-separated
digest of those ordered canonical entries, not of the release manifest itself.
The source-audit manifest is generated afterward, excludes only itself, and
therefore includes the completed release manifest plus all content entries.
Install health computes both independent digests and verifies that every
release content entry exactly matches one source-audit entry. Neither manifest
stores the other's final digest. The health result and signed publication
record bind the pair `(releaseManifestDigest, sourceAuditManifestDigest)`.

Package authenticity is supplied by a third acyclic object outside both
manifests:

```text
kstack-release-publication-v1 = {
  schemaVersion: "kstack-release-publication-v1",
  pluginBaseVersion: strict-semver-v1,
  sourceRevisionDigest: digest-v1,
  sourceTreeDigest: digest-v1,
  buildToolchainDigest: digest-v1,
  releaseManifestDigest: digest-v1,
  sourceAuditManifestDigest: digest-v1,
  releaseAuthorityPolicyEpoch: monotonic-uint64-v1,
  releaseAuthorityPolicyDigest: digest-v1,
  publishedAt: trusted-instant-v1,
  signatures: sorted-list-of-release-signature-v1
}
```

The release authority policy is operator/distribution trust state external to
the candidate archive, checkout, marketplace, cache, and installed runtime. It
binds distinct opaque principals for `RELEASE_BUILDER`,
`RELEASE_SECURITY_APPROVER`, and `RELEASE_PUBLISHER`; all three sign production
publication bytes. One principal cannot satisfy two roles. Key rotation or
revocation is signed under the prior policy and committed to an external
monotonic head; a package-supplied key or policy is never trusted to bootstrap
itself. The installer verifies the publication record before trusting either
manifest and rechecks the pair after staging.

A local source checkout without a separately pinned release authority may be
installed only as `UNSIGNED_DEVELOPMENT`. Its package/health checks still find
drift, but it cannot produce `PILOT_VALIDATED` or `PRODUCTION_APPROVED`, publish
a production artifact, or be relabeled through an override. First-install
trust bootstrap requires an operator-provisioned authority root or a previously
trusted signed installer; accepting a key shown by the candidate package is
forbidden.

One compatibility row binds exact reader, writer, migrator, and rollback rules:

```text
secret-broker-compatibility-row-v1 = {
  componentId: registry-id-v1,
  currentVersion: exact-version-v1,
  readableVersions: sorted-list-of-exact-version-v1,
  writableVersion: exact-version-v1,
  migrationEdges: sorted-list-of-exact-from-to-migrator-digest-v1,
  rollbackReadableVersions: sorted-list-of-exact-version-v1,
  hostProfileRefs: sorted-list-of-opaque-ref-v1
}
```

Readability is enumerated, never a range. A process writes only its one current
version. Every migration edge has canonical golden vectors, crash cuts before
and after durable replacement, idempotent read-only detection, and an exact
prior-byte backup where the record is value-free. Protected-state migration
uses its own adapter transaction and external head; its backup remains
protected. A process never writes an older version.

Unknown future versions disable the broker while preserving bytes. When a new
writer makes the old binary unable to read current protected state, software
rollback is `DISABLED_FORWARD_REPAIR`, not speculative launch. Cachebuster
metadata never appears in compatibility comparisons.

## 8. Plugin SemVer and cache identity

The release source uses strict SemVer, including prerelease when applicable.
Compatibility changes follow:

- patch: implementation fix with unchanged public/protected schemas and
  behavioral contract;
- minor: backward-readable additive capability with explicit new closed schema
  or optional artifact and migration edge;
- major: removed/changed public behavior, incompatible schema/protocol, or
  changed authority/security semantics; and
- prerelease identifiers: no stability claim and never production-approved
  merely because their numeric base matches a production release.

Codex local installation may replace one build-metadata suffix with
`+codex.<UTC-cachebuster>` to force a unique physical cache directory. The base
version is everything before `+`; stamping changes only `version` in the staged
Codex manifest and is verified against source equivalence with `version`
normalized. It never modifies source, appends repeated suffixes, changes
compatibility, or qualifies a cache.

Windows and WSL/Linux installations create platform-native staged copies and
run health from the copied execution root. They do not share an executable
cache across DrvFS/9p or copy credential/protected state. Direct project skill
copies are a separate `direct-skill` host profile with no plugin-hook claim.
After plugin reinstall, interactive pickup is tested in a new host session;
install health continues to report activation untested until that canary runs.

Marketplace files are distribution metadata, not Secret Broker configuration.
KStack preserves its existing repository marketplace name/order/policy and uses
the deterministic plugin install/update command path. No setup step hand-edits
a user's unrelated marketplace entries or assumes a non-default marketplace is
installed. Native staging may generate its own exact local marketplace copy
bound to that staged root.

## 9. Host compatibility profiles and the current hook conflict

```text
host-compatibility-profile-v1 = {
  hostFamily: "CODEX" | "CLAUDE_CODE" | "DIRECT_SKILL",
  hostVersion: exact-version-v1,
  platformClass: closed-platform-class-v1,
  pluginManifestSchemaDigest: digest-v1 | "NOT_APPLICABLE",
  acceptedManifestFields: sorted-closed-list-v1,
  skillValidatorDigest: digest-v1,
  pluginValidatorDigest: digest-v1 | "NOT_APPLICABLE",
  hookManifestDigest: digest-v1 | "UNAVAILABLE",
  hookRegistrationRoute: registry-id-v1 | "UNAVAILABLE",
  skillNamespaceMode: "PLUGIN_NAMESPACED" | "DIRECT_UNQUALIFIED",
  qualificationRef: opaque-ref-v1 | "UNAVAILABLE"
}
```

Source inspection on 2026-08-31 proves a live gap: KStack's current Codex
manifest declares `"hooks":"./hooks/codex-hooks.json"`, install health resolves
and launches that field, and native setup expects it; the current local
plugin-creator validator rejects the `hooks` field. This is recorded as
`BLOCKED_HOST_SCHEMA_DRIFT`. Neither side is silently declared authoritative.

Resolution requires an isolated matrix against the exact installed Codex
version and ingestion schema:

1. validate the canonical source manifest with the pinned plugin validator;
2. install into a fresh staged marketplace/cache;
3. query host JSON for exact source/version/enablement;
4. prove the registered hook manifest and both platform command fields launch;
5. run positive/negative live host envelopes without a value; and
6. bind the accepted field set, host version, validator digest, and hook route
   into one compatibility/qualification profile.

If the exact host accepts a documented/discovered default hook path without a
manifest field, the source may remove `hooks` only in a reviewed new profile
after live registration tests pass. If the host requires the field while the
validator rejects it, KStack pins a host-specific validated schema/validator or
keeps that Codex profile unavailable. Removing the field merely to make a
generic validator green is forbidden when it removes the safety hook. Keeping
the field merely because an older install worked is equally forbidden.

Official Codex documentation currently found for this design does not publish
the KStack-specific plugin/hook ingestion contract. Local host JSON, pinned
validator code, and isolated execution evidence therefore remain the mutable
compatibility evidence; documentation absence is not a capability claim.

## 10. Install-health v2

The source-audit manifest remains canonical, sorted, self-excluding, bounded,
and includes every distributed file except its own bytes. `v2` adds artifact
role, platform applicability, and mutation policy while preserving byte/type,
size, digest, and installed-mode checks:

```text
install-health-entry-v2 = {
  path: normalized-contained-relative-path-v1,
  artifactRole: "MANIFEST" | "SCHEMA" | "SKILL" | "REFERENCE" |
                "SCRIPT" | "WORKER" | "ADAPTER" | "HOOK" | "FIXTURE",
  platformClasses: nonempty-sorted-closed-set-v1,
  installTransformProfileRef: opaque-ref-v1 | "NONE",
  executable: boolean,
  size: nonnegative-safe-integer-v1,
  sha256: digest-v1
}
```

Only two v1 transform profiles exist. `CODEX_VERSION_CACHEBUSTER_V1` applies to
the staged `.codex-plugin/plugin.json`, parses the exact closed manifest,
replaces only `version` build metadata under Section 8, canonicalizes it, and
records source/output digests. `DIRECT_SKILL_ROOT_SUBSTITUTION_V1` applies only
to a listed direct-copy `SKILL.md`; it binds the source digest, exact algorithm
artifact digest, the closed literal-token set (`${CLAUDE_PLUGIN_ROOT}`,
`<kstack-plugin-root>`, and registered relative script-root tokens), a validated
installed-runtime root ref, and the output digest. The destination root/path is
kept in protected local install state and public receipts use an opaque ref.

The installer computes expected output from trusted source bytes and the
profile, writes that exact result, reads it back, and stores a canonical
`install-transform-receipt-v1`. Install health independently recomputes the
output and requires byte equality. A token added by runtime input, substitution
outside the closed source occurrences, canonicalization difference, unlisted
file, second transform, absolute-path text in a repository/review/Jira artifact,
or any other byte change fails. `agents/openai.yaml`, references, schemas,
workers, hooks, and scripts are never instruction-rewritten.

The central health contract enumerates every skill reference, script import,
schema validator, CLI probe, host manifest/validator profile, worker descriptor,
and applicable platform probe. A source file not owned by exactly one manifest
role fails generation; an installed extra executable in a broker-owned
directory also fails. Source, staged runtime, host cache, direct skill surface,
and reported host registration each have distinct root IDs and results.

Required broker probes are:

- source audit and release/compatibility cross-digest closure;
- skill quick validation plus reference routing and no-placeholder scan;
- public config/API schema golden/negative vectors and duplicate-key rejection;
- model-facing CLI import and fixed value-free unavailable/denied receipts;
- protected worker/adapter manifest signature and closure verification without
  launching or resolving a value;
- platform loader/image identity and non-value process containment smoke when
  a worker is present;
- exact host manifest validator plus isolated hook/skill registration probe;
- installed/cache byte equivalence with only declared mutation normalization;
- migration read/dry-run vectors without changing protected state; and
- proof that no probe opens a credential source, protected record, provider,
  target, Jira credential, clipboard, or model-visible value route.

Health states are `PASS`, `DEGRADED`, `FAILED`, and
`DEGRADED_OVERRIDE` only for non-security operational checks already eligible
under the install-health authority policy. Secret Broker schema, artifact,
signature, containment, hook registration, no-value boundary, WSL Jira route,
or migration failures are blocking and non-overridable. Third-party host JSON
unavailability may remain `DEGRADED` for general KStack installation, but the
affected Secret Broker host profile is `UNAVAILABLE` and cannot execute.

The machine record adds only value-free fields:

```text
secretBrokerHealth = {
  packageState: "PASS" | "FAILED",
  hostProfileState: "DISCOVERED" | "BLOCKED_SCHEMA_DRIFT" | "UNAVAILABLE",
  activationTested: false,
  qualificationLevel: "UNQUALIFIED",
  applicableProbeResults: sorted-list-of-fixed-probe-result-v1,
  releaseManifestDigest: digest-v1,
  compatibilityProfileRef: opaque-ref-v1 | "UNAVAILABLE"
}
```

Even a full `PASS` ends at `UNQUALIFIED`. SB-TC10 evidence, in a separate
protected authority, is the only route to higher levels.

## 11. Setup, upgrade, rollback, and uninstall packaging

Setup verifies externally pinned publication provenance and source audit before staging; copies a closed manifest set without
following links; applies only declared install mutations; validates staged
bytes/probes; atomically switches the software pointer; registers the exact
marketplace/plugin or direct skill profile; validates the installed/cache root;
and reports activation untested. It never edits a live root in place.

Before upgrade, a value-free compatibility preflight compares current/new
release manifests with the protected adapter's supported schema-version
inventory. It receives version IDs and state counts only, not record bodies.
Required migrations run through exact registered migrators after a separate
owner preview. New code is not activated until migrations and installed health
pass, subject to the config-v2 two-phase ordering in Section 5. Failure leaves
the old compatible pointer before the v2 commit fence or a disabled v2-capable
state afterward; it does not delete backups or run both versions concurrently.

Uninstall removes only selected software registrations/copies after proving the
broker is disabled. It preserves protected custody, audit/evidence, migration,
reconciliation, and recovery records per SB-TC09. Documentation must say how to
reinstall compatible code; it must not offer manual deletion of protected
state as cleanup.

## 12. Documentation claims

Documentation has one owner for each fact:

| Fact | Authoritative location |
|---|---|
| invariant, evidence levels, platform/Jira posture | `references/SECRET_BROKER.md` |
| agent routing and stops | `skills/kstack-secrets/SKILL.md` |
| mode procedure | matching skill reference |
| exact public shape | machine schema |
| installed artifacts/probes | release and install-health manifests |
| compatible versions/migrations | compatibility manifest |
| current cell status | protected SB-TC10 evidence projection |
| owner installation commands and status vocabulary | root `README.md` |

Generated schema tables may be published, but prose never hand-copies field
lists that can drift. README installation sections distinguish native Windows,
WSL, Linux desktop/headless, macOS, plugin, and direct skill profiles. They
state that `/kstack-*` is Claude syntax, `$kstack:kstack-*` is namespaced Codex
plugin syntax, and `$kstack-*` is direct-skill syntax.

User status uses only SB-TC08/SB-TC10 vocabulary: `BROKER AVAILABLE`,
`DIRECT DENY QUALIFIED`, `MAIN-WINDOW APPROVAL REQUIRED`, `INSTRUCTION ONLY`,
and `UNAVAILABLE`, each with exact scope. “Installed”, “hook file present”,
“health PASS”, or “provider found” never becomes “secure”, “intercepted”,
“migrated”, or “production ready”.

Windows documentation never instructs users to create a Windows Jira token or
copy the WSL source. Linux desktop Secret Service is not documented as WSL or
headless support. OpenBao quick starts/dev mode are not production examples.
Support instructions never request config/source/provider/audit dumps.

## 13. Verification and release gates

SB-TC11 implementation must prove:

1. every distributed broker artifact has one manifest owner and exact digest;
2. skill and agent metadata validate, route conditionally, remain concise, and
   preserve no-value, approval, capability, and WSL Jira boundaries;
3. public config/API schemas reject unknown/duplicate/overlong/noncanonical
   input and cannot represent protected locators or values;
4. protected config is inaccessible to model-facing config/resource readers;
5. compatibility rows enumerate exact read/write/migration/rollback versions,
   and crash/forward-version tests fail closed without state rollback;
6. plugin cache stamping changes only one build suffix and installed byte
   comparison normalizes only that declared field;
7. Windows, WSL/Linux, Claude, Codex plugin, and direct skill installs resolve
   distinct host profiles and never share qualification or custody;
8. the current Codex hook/validator disagreement is resolved by exact-host
   evidence, not by dropping the hook or ignoring validation;
9. install health runs every applicable non-secret probe, rejects extras/drift,
   and cannot claim activation or qualification;
10. upgrades stage/validate before switch and never read, copy, downgrade, or
    roll back a value/protected generation;
11. uninstall preserves custody and nonterminal/audit/evidence state; and
12. docs, schemas, skill references, release manifests, and observed status
    have nonoverlapping authority and fail the build on generated drift.

Release requires source validators, manifest regeneration `--check`, unit and
golden vectors, hostile parser vectors, install-health source/stage/cache tests,
native Windows and WSL/Linux profile tests, exact-host plugin/hook canary, and
SB-TC10 synthetic qualification for every claimed execution cell. A package can
ship disabled development scaffolding before cell qualification only when UI,
skill, CLI, and health all say `UNAVAILABLE` for execution.

## 14. Rejected alternatives

- **Put all broker contracts in `SKILL.md`:** rejected; it loads irrelevant
  detail, increases drift, and makes machine schemas unenforceable prose.
- **Expose protected configuration as an MCP resource:** rejected; locators,
  identities, policy, evidence, and state would enter model context.
- **Add secret fields to `.kstack/config.json`:** rejected; repository config,
  backups, diffs, reviews, Jira, and support are model-visible surfaces.
- **Let config schema 1 ignore a new top-level block:** rejected; accidental
  parser permissiveness is not an explicit migration or compatibility rule.
- **Treat SemVer/cachebuster as protocol qualification:** rejected; package
  identity cannot prove runtime/platform/provider behavior.
- **Remove Codex hooks just to satisfy the current generic validator:**
  rejected; it may silently remove a safety surface from hosts that require the
  manifest field.
- **Ignore the validator because current setup worked once:** rejected; host
  ingestion and validation are mutable and version-specific.
- **Install one shared runtime on Windows and WSL:** rejected; executable,
  filesystem, identity, and cache semantics differ, while Jira custody remains
  solely WSL.
- **Let install health run a real credential operation:** rejected; installation
  is not owner approval or qualification and must remain value-free.
- **Roll back protected state with an older plugin:** rejected; currentness,
  generations, audit, migration history, and evidence are monotonic.

## 15. Primary-source and local-evidence posture

- The repository's current plugin/skill manifests, setup scripts, install-health
  contract/tests, config parser/tests, and local system skill/plugin validators
  were inspected on 2026-08-31 and are version-pinned implementation evidence.
  The current plugin validator failure on the `hooks` field is a confirmed local
  compatibility gap, not a documentation inference.
- The system `skill-creator` guidance requires concise discriminating metadata,
  progressive disclosure, conditional references, meaningful behavior tests,
  and `quick_validate.py`; these rules shaped Section 4.
- The system `plugin-creator` guidance requires a `.codex-plugin/plugin.json`,
  strict manifest/marketplace validation, one replaced Codex cachebuster suffix,
  reinstall from the actual local marketplace, and a new session for pickup.
  Its current reference and validator disagree about the `hooks` field, which
  is why Section 9 requires exact-host resolution.
- [OpenAI developer documentation](https://developers.openai.com/) is mutable,
  read 2026-08-31. It confirms plugins and skills are current product surfaces,
  but the searched public pages did not provide the exact KStack Codex
  plugin/hook ingestion schema; no stronger hook claim is inferred.

## 16. Exit and handoff

Approval freezes package/configuration boundaries, not implementation or
qualification. Current `kstack-secrets` skill validation passes, but the current
Codex plugin manifest fails the pinned plugin validator because of `hooks`;
current experimental broker helpers remain below `SYNTHETIC_QUALIFIED`.

SB-TC12 must sequence the host-schema resolution, schema/config migration,
package split, protected/native implementation, install-health v2, exact-cell
qualification, and rollout without claiming the existing files already meet
SB-TC00–SB-TC11.
