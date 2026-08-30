# HB-TC03 OpenCode instruction-only candidate — normative implementation reissue

**Status:** implementation contract  
**Scope:** HB-TC03 only  
**Ceiling:** `NO_OPERATION_QUALIFICATION`  
**Supersedes for implementation:** the distributed HB-TC03 base, round-2,
round-3, and final round-4 delta packet. Historical reviews remain evidence of
design evolution; this document is the complete current contract.

## 1. Claim boundary

HB-TC03 implements packaging and deterministic qualification machinery for an
OpenCode instruction-only candidate. It may establish only `DECLARED`,
`RENDERABLE_CANDIDATE`, `INSTALLABLE_CANDIDATE`, `INSTALLED_CANDIDATE`, and
`DISCOVERY_OBSERVED_INSTRUCTION_ONLY`. None means supported, governed,
enforced, operation-qualified, or eligible for ask, write, install, release,
credential, external, process-control, provider, Jira, commit, push, or deploy
operations. HB-TC05 and the applicable host-policy items are required for any
stronger host claim.

The OpenCode target is `CANDIDATE`. Canonical bytes and existing baseline target
outputs cannot change merely because the candidate exists. No gstack byte is
admitted. Its OpenCode adapter at commit
`ad8400543cd9ce8d07641362db48d44a95417e33`, path `hosts/opencode.ts`, raw
SHA-256 `9932fb91df227613fb2450115dd96684352b1094ebff9fabe1e482d630aaccf7`,
and MIT license are provenance for `REIMPLEMENT_PATTERN` only.

## 2. Exact packaging evidence

`OpenCodePackagingEvidenceV1` is a closed RFC 8785 JSON object addressed as
`SHA-256("KSTACK-OPENCODE-PACKAGING-EVIDENCE-V1" || 0x00 || canonical(body))`.
It contains exactly:

```text
schemaId: "kstack.opencode-packaging-evidence.v1"
schemaVersion: 1
registrySetDigest: DigestV1
targetId: "opencode"
officialSourceDigests: sorted unique non-empty DigestV1[]
observedHostBuildDigest: DigestV1
observedLiveConfigDigest: DigestV1
userSkillRootFact: normalized relative path | null
projectSkillRootFact: normalized relative path | null
entryFilenameFact: "SKILL.md" | null
invocationSyntaxFact: bounded public identifier | null
metadataFactSchemaDigest: DigestV1 | null
observationEvidenceDigests: sorted unique non-empty DigestV1[]
currentnessEvidenceDigest: DigestV1
expiresAtUtc: canonical RFC3339 timestamp
```

Every non-null fact must be supported by both pinned official-source evidence
and an executed read-only observation of the exact running build and live
config. At least one skill root, the entry filename, and invocation syntax are
required for renderability. A null, expired, stale, conflicting, unbound, or
gstack-only fact cannot be defaulted and blocks its dependent transition.
Executable presence is not running-process identity.

Destination roots are registered relative templates. No absolute or
environment-derived path, literal or regex replacement, shell interpolation,
arbitrary frontmatter, or executable metadata adapter is permitted.

## 3. Candidate projection and semantic content gate

The exact HB-TC01 projection plan must bind the registry, source bundle,
OpenCode packaging evidence, target build/config, metadata schema, resource
dispositions, affected operation/profile identifiers, and all typed token
uses. Only `INVOCATION_PREFIX`, `SKILL_ROOT`, `METADATA_PATH`, and `TOOL_NAME`
typed occurrences may be projected, and only in their admitted contexts.

The safe operation subset is derived from the operation registry and complete
transitive dependency graph. Every reachable operation must be `DISCOVERY`,
`READ_ONLY`, or `ADVISORY`. An ask, mutable, external, credential, process,
install, commit/push, deploy/release, Jira/provider, cross-model, or unknown
dependency excludes the member. Skill names and model claims never determine
eligibility.

OpenCode v1 members are limited to model-visible Markdown and closed
unsupported stubs. Scripts, code, binaries, command snippets, tool-call
metadata, model/skill invocation, executable-looking paths, code fences,
links, raw HTML, and autolinks are prohibited. A stub may state only an
unsupported status and closed reason, with no command or manual workaround.

`InstructionOnlyContentEvidenceV1` is a closed RFC 8785 object addressed in
domain `KSTACK-INSTRUCTION-ONLY-CONTENT-EVIDENCE-V1` and contains exactly:

```text
schemaId: "kstack.instruction-only-content-evidence.v1"
schemaVersion: 1
registrySetDigest: DigestV1
sourceBundleDigest: DigestV1
renderBundleDigest: DigestV1
memberPath: normalized relative path
memberDigest: DigestV1
clauseId: ClauseIdV1 | null
memberRole: "MODEL_VISIBLE_MARKDOWN" | "UNSUPPORTED_STUB"
canonicalMemberInventoryDigest: DigestV1
resourceDependencyGraphDigest: DigestV1
dependencyClosure: {
  roots: sorted unique OperationIdV1[]
  nodes: sorted unique [{operationId, class:
    "DISCOVERY"|"READ_ONLY"|"ADVISORY"}]
  edges: sorted unique [{from, to, kind: DependencyKindV1}]
  closureDigest: DigestV1
}
linter: {
  implementationDigest: DigestV1
  configDigest: DigestV1
  allowlistDigest: DigestV1
  markdownParserDigest: DigestV1
  outcome: "PASS"|"FAIL"|"AMBIGUOUS"
  findingDigests: sorted unique DigestV1[]
}
independentReview: {
  reviewerClass: "INDEPENDENT_CODEX"
  modelConfigDigest: DigestV1
  promptPacketDigest: DigestV1
  resultDigest: DigestV1
  outcome: "PASS"|"FAIL"|"AMBIGUOUS"
  findingDigests: sorted unique DigestV1[]
}
overall: "PASS"|"FAIL"|"AMBIGUOUS"
reasonCodes: sorted unique ContentReasonCodeV1[]
```

The canonical member inventory binds the same path, digest, role, and clause.
The resource dependency graph binds the canonical resource-to-resource,
resource-to-operation, and operation-to-operation graph for the exact registry.
The closure must equal the graph-reachable closure from both clause roots and
member dependencies. Missing, extra, or unknown graph material is ambiguous;
a complete unsafe closure fails.

The closed content reasons are `DEPENDENCY_UNSAFE`,
`DEPENDENCY_INCOMPLETE`, `FORBIDDEN_MEMBER_ROLE`, `FORBIDDEN_INSTRUCTION`,
`FORBIDDEN_MARKUP`, `ALLOWLIST_MISMATCH`, `LINTER_FAILED`, `REVIEW_FAILED`,
and `EVIDENCE_AMBIGUOUS`. `PASS` requires exact identity bindings, a complete
safe graph, deterministic linter pass with no findings, independent content
review pass with no findings, and no reason codes. Non-pass content is excluded;
neither a linter nor a model may waive a failed binding.

## 4. Lifecycle and status

The only state enum is:

1. `DECLARED`
2. `RENDERABLE_CANDIDATE`
3. `INSTALLABLE_CANDIDATE`
4. `INSTALLED_CANDIDATE`
5. `DISCOVERY_OBSERVED_INSTRUCTION_ONLY`
6. `CANDIDATE_INVALIDATED`

The only forward transitions are 1→2→3→4→5. States 2–5 may transition to 6
when a bound fact changes or expires. State 6 is terminal for that chain.
Recovery starts a new state-1 body and re-evaluates every gate; no prior
promotion is reused.

`CandidateStatusV1` is a closed RFC 8785 object externally addressed as
`SHA-256("KSTACK-CANDIDATE-STATUS-V1" || 0x00 || canonical(body))`. The digest
is not serialized inside the body. The exact fields are:

```text
schemaId: "kstack.candidate-status.v1"
schemaVersion: 1
registrySetDigest: DigestV1
targetId: "opencode"
runningHostBuildDigest: DigestV1
liveConfigDigest: DigestV1
currentnessEvidenceDigest: DigestV1
expiresAtUtc: canonical RFC3339 timestamp | null
previousStatusBodyDigest: DigestV1 | null
state: CandidateStateV1
maximumClaim: "NO_OPERATION_QUALIFICATION"
invalidationReason: CandidateInvalidationReasonV1 | null
changedFactEvidenceDigest: DigestV1 | null
refs: {
  packagingEvidence: EvidenceRefV1
  projectionPlan: EvidenceRefV1
  renderBundle: EvidenceRefV1
  installerProfile: EvidenceRefV1
  installReceipt: EvidenceRefV1
  discoveryObservation: EvidenceRefV1
}
```

`EvidenceRefV1` is exactly `{digest: DigestV1|null, unavailableReason:
EvidenceUnavailableCodeV1|null}` with exactly one non-null. Unavailable codes
are `STATE_NOT_REACHED`, `DEPENDENCY_FAILED`, `FACT_UNVERIFIED`, `FACT_STALE`,
and `CANDIDATE_INVALIDATED`. Invalidation reasons are `BUILD_CHANGED`,
`CONFIG_CHANGED`, `REGISTRY_CHANGED`, `SOURCE_CHANGED`, `RENDER_CHANGED`,
`INSTALL_CHANGED`, `EVIDENCE_STALE`, `EVIDENCE_FAILED`, and `EXPIRY_REACHED`.

Required digest references are: none at state 1; packaging, plan, and render at
state 2; those plus installer profile at state 3; those plus install receipt at
state 4; all six at state 5. Not-yet-required references use
`STATE_NOT_REACHED`. State 6 retains the immediately preceding valid refs only
for audit, requires the prior status digest plus both invalidation fields, and
its refs cannot promote another chain. Every forward state binds the immediate
prior external status digest. Expired or failed currentness cannot occupy a
non-invalidated state. Status always displays the ceiling and exact bindings.

## 5. Generic installer boundary

HB-TC02 accepts the candidate only after packaging, projection, render,
installer profile, destination template, activation primitive, and preservation
handoff all resolve. The generic installer may not branch on `opencode`. It
stages only exact selected render members, all non-executable, under a registered
relative destination template. It never copies gstack runtime roots, binaries,
browser/design builds, upgrade utilities, corpora, QA libraries, ethos, or DX
assets. Collision, atomicity, crash recovery, preservation, cleanup, and exact
manifest gates remain unchanged.

HB-TC03 implements and validates the installable-candidate inputs; it does not
authorize or perform a real OpenCode installation. That live boundary belongs
to HB-TC05.

## 6. Paired causal discovery protocol

A protected component generates two independent 256-bit tokens and records
distinct commitments before rendering. Tokens never appear in the generic
fixture prompt, filenames, status, host config, or ambient context. From one
base render it produces treatment and control renders differing only in one
closed inert challenge clause. Each is installed transactionally into a
separate otherwise-identical disposable read-only fixture. Fresh sessions use
the same generic prompt, randomized precommitted order, exact running build and
config, and independent blockers for tool, process, filesystem, network, and
credential effects. Outputs are bounded and committed before token reveal.

`OpenCodeDiscoveryObservationV1` is a closed RFC 8785 object addressed in
domain `KSTACK-OPENCODE-DISCOVERY-OBSERVATION-V1` and contains exactly:

```text
schemaId: "kstack.opencode-discovery-observation.v1"
schemaVersion: 1
registrySetDigest: DigestV1
targetId: "opencode"
baseRenderBundleDigest: DigestV1
pairCommitmentDigest: DigestV1
challengeGenerationReceiptDigest: DigestV1
treatmentTokenCommitmentDigest: DigestV1
controlTokenCommitmentDigest: DigestV1
fixtureId: FixtureIdV1
fixtureFactsDigest: DigestV1
fixturePromptDigest: DigestV1
randomizedOrderEvidenceDigest: DigestV1
adjudicatorConfigDigest: DigestV1
effectBlockerEvidenceDigest: DigestV1
sessions: [DiscoverySessionV1, DiscoverySessionV1]
revealRecordDigest: DigestV1
outcome: "OBSERVED"|"NOT_OBSERVED"|"AMBIGUOUS"
reasonCodes: sorted unique DiscoveryReasonCodeV1[]
```

Each closed session contains exactly `variant`, `observationRenderDigest`,
`installedMemberManifestDigest`, `hostSessionIdentityDigest`,
`runningHostBuildDigest`, `liveConfigDigest`, `fixtureFactsDigest`,
`committedTypedOutputDigest`, `outputReceiptDigest`, `attemptedEffects`, and
`effectEvidenceDigest`. There is exactly one treatment and one control, ordered
by variant, with distinct session identities. Both share the same bound fixture,
prompt, build, config, adjudicator, blocker, and base render facts. The fixture
facts bind the exact fixture ID, prompt, base render, challenge schema, variants,
and token non-disclosure rule; prompt and both variant manifests embed the same
fixture ID. Render and installed-manifest differences are limited to the one
challenge clause.

`OBSERVED` requires every binding to verify, treatment output exactly token A,
control output exactly token B, no extra bytes, both `attemptedEffects: NONE`,
two committed outputs before reveal, and valid commitments. Otherwise a proven
failure is `NOT_OBSERVED`; an unprovable condition is `AMBIGUOUS`. Non-pass
requires applicable reasons from `PAIR_BINDING_MISMATCH`, `TOKEN_DISCLOSED`,
`COMMITMENT_INVALID`, `CONTROL_MISSING`, `OUTPUT_MISMATCH`, `EXTRA_OUTPUT`,
`EFFECT_ATTEMPTED`, `HOST_FACT_CHANGED`, `PACKAGE_DIFFERENCE_INVALID`, and
`ADJUDICATION_AMBIGUOUS`. Only `OBSERVED` permits state 5, and it proves only
causal loading of the unique installed instruction for those exact facts.

## 7. Invalidation, security, and verification

Any registry, source, plan, render, member, install, build, config, packaging,
currentness, fixture, or discovery evidence change invalidates dependent state.
Re-render or reinstall never carries an old discovery observation forward.

Repository content, host/user/project instructions, plugins, custom tools,
user MCP servers, formatters, LSP hooks, external-directory grants, and
subagents are untrusted. A host prompt or auto mode is not KStack authority.
Diagnostics and output are bounded, escaped, credential-free, and never fed
back into normative clauses. Any attempted effect fails discovery.

Executable validation must prove:

1. Closed schemas, canonical ordering, domain separation, and exact digest
   bindings reject unknown keys and splice attacks.
2. Missing, stale, conflicting, expired, null-dependent, gstack-only, wrong
   build/config, or absolute-path packaging facts fail closed.
3. Full safe dependency closure and exact member/inventory/graph binding are
   required; unsafe, incomplete, ambiguous, or smuggled content is excluded.
4. The Markdown gate rejects prohibited effects, markup, snippets, tool/model
   invocation, bypasses, and hostile variants; closed stubs remain inert.
5. OpenCode projection is deterministic across ambient variation, accounts for
   every byte, and changes no canonical/Codex/Claude evidence.
6. Installer inputs contain only exact non-executable selected members and use
   the generic HB-TC02 path without an OpenCode branch.
7. State matrices, transitions, previous-status bindings, required refs,
   invalidation, expiry, terminal chains, and candidate-only ceiling are total.
8. Paired challenge generation, commitment, randomized order, fixture identity,
   manifest-difference constraint, output commitment/reveal, effect blocking,
   and all negative observation outcomes are executable and fail closed.
9. Memorized markers, prompt echo, equal/missing outputs, token disclosure,
   hostile repository text, plugins/subagents/user MCP, changed host facts, and
   ambiguous adjudication cannot pass.
10. The gstack provenance fixture binds exact repository, commit, path, hash,
    license, zero admitted ranges, improvements, and reviewed disposition.
11. Focused tests, generic installer tests, architecture gates, install-health,
    full regression, and diff checks all pass before primary readiness may be
    scored at 93.

## 8. Closure

Implementation closure requires current hashes, executable evidence for every
requirement above, primary readiness of at least 93, and a fresh non-authoring
independent final review. KStack's final-review policy requires a score of at
least 95 with empty failed-check, security, material-dissent, and unresolved-
question arrays. Review evidence is invalid after any packet drift. No report
edit, support claim, real OpenCode install/run, commit, push, deployment, or
publication is authorized by HB-TC03.
