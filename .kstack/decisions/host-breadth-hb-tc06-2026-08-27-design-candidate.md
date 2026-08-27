# HB-TC06 design candidate: second-host abstraction proof

**Thread:** `host-breadth-option-selection-2026-08-26`
**Item:** `HB-TC06` only
**Status:** local design candidate; no second-host objective, adapter, or support
**Architecture:** locked Option C; OpenCode first, Goose later and separately
**Review route:** Codex only; no external review authorized by this artifact

## Decision boundary

Define how KStack will prove that its Host Adapter Kit is genuinely portable
after the OpenCode path is implemented and stable. The proof uses Goose as the
owner-locked materially different second-host candidate, but opens a separate
Goose objective before any adapter design, implementation, installation, or
execution. ACP remains deferred and KStack remains a governance layer rather
than an agent backend.

This item proves an abstraction only when the same registered KStack operation
profile independently qualifies on OpenCode and Goose while host-specific
behavior remains confined to declared projections/adapters. It never inherits
support from OpenCode, equates documentation with evidence, or lowers a common
requirement to fit the weaker host.

## Frozen predecessors and non-claims

- HB-TC01 through HB-TC05 are validated designs only. HB-TC05's reviewed
  packet is `eb09f43501678654e94fe714416b45f16f6f08f964976dec6719cd89ca02280f`
  at Codex 97 clean; no OpenCode conformance has actually run.
- HP-TC07 is validated design only; every other applicable HP item remains
  independently open until its own implementation and validation.
- The original Host Portability owner boundary preserves Codex/Claude,
  qualifies OpenCode first, and puts Goose in a later separate thread because
  Goose's lifecycle/provider/extension breadth may overlap KStack ownership.
- Existing external documentation observations are research leads only. A
  later Goose objective must refresh and content-address primary source/code
  evidence before selecting any reusable mechanism or making any behavior
  claim.

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Reuse KStack's already validated canonical
package, generic installer, public MCP facade, typed Host Portability contract,
and operation-level conformance protocol. Build a thin KStack-native Goose
projection/adapter candidate only after source-level research in the separate
objective. No Goose or gstack bytes are admitted here.

The generic gstack host-registry/generator pattern remains available only
through HB-TC01's zero-upstream-byte KStack reimplementation. Prompt rewrites,
recipes, extensions, provider declarations, MCP connection success, or agent
claims are rejected as authority or qualification evidence.

## OpenCode stability gate

`FirstHostStabilityGateV1` is a closed protected record binding exact active
Host Portability implementation digests, HB-TC01 through HB-TC05 implementation
and validation receipts, OpenCode build/config/environment digests, qualified
operation-profile evidence, requalification evidence, preservation results,
open-defect inventory digest, evaluated time, expiry, and status.

Status can be `SATISFIED|NOT_IMPLEMENTED|NOT_QUALIFIED|STALE|REGRESSED|OPEN_DEFECT`.
`SATISFIED` requires all of:

1. applicable HP-TC01 through HP-TC12 implementations are active and current;
2. HB-TC01 through HB-TC05 are implemented and independently validated;
3. one minimal shared profile—canonical instruction discovery plus bounded
   advisory/public-read behavior—has executed the complete HB-TC05 suite on an
   exact OpenCode build with a clean eligibility result;
4. a distinct later requalification after at least one bound adapter, KStack
   component, configuration, platform-image, or OpenCode-build change also
   passes, proving invalidation/requalification rather than one frozen demo;
5. Codex/Claude preservation baselines remain clean; and
6. no open defect affects the shared adapter contract or selected profile.

Elapsed time or number of ordinary runs alone cannot satisfy stability. The
protected component recomputes the gate before every second-host phase. Any
change or expiry returns the process to `BLOCKED_FIRST_HOST_UNSTABLE` without
altering OpenCode's existing evidence.

## Separate Goose objective gate

After the stability gate passes, KStack opens a new deep objective that must:

1. content-address current primary Goose source/docs for skill/instruction
   discovery, recipes, extensions, providers, subagents, MCP, permissions,
   workspace roots, background/session lifecycle, credentials, and updates;
2. classify every mechanism `ADOPT|ADAPT|COMPOSE|BUILD|REJECT` under the
   reuse-first gate with exact license/provenance and no default copying;
3. map semantic ownership between Goose and KStack, including double approval,
   double retry, duplicate memory, provider ownership, and direct-tool bypass;
4. select only one minimal advisory/public-read operation profile for the first
   proof; and
5. obtain its own owner clarification and Codex closure before implementation.

If current evidence shows Goose cannot remain a thin host adapter without
transferring KStack policy, session, credential, retry, or operation authority,
the disposition is `HOST_OVERLAP_REJECTED`. KStack does not redesign itself or
weaken OpenCode/Codex/Claude to force a second-host pass.

## Generic versus host-specific contract

`HostAdapterBoundaryV1` permits only these host-independent ports:

```text
bindHostInstance, bindRepositoryContext, discoverInstructionProjection,
observeNativeAction, requestNativeApprovalDisplay, routeProtectedBroker,
observeProcessLifecycle, observeStructuredOutput, observeCancellation
```

Each port accepts/returns only HP-TC01 closed artifact digests. The Governance
Kernel derives operation class, policy, eligibility, authority, and terminal
status. No adapter port accepts raw policy code, credential bytes, an allow
token, host-supplied eligibility, or a support tier.

`HostSpecificAdapterV1` binds host ID/build constraint, adapter digest, exact
port implementations, native-event schemas, projection plan, bypass inventory,
environment measurement profile, and conformance fixture mapping. Host-specific
code may parse native events and project instructions; it may not implement or
override kernel decisions, evidence selection, broker policy, receipt
admissibility, retry, activation, or migration.

The shared contract cannot contain `if host == opencode|goose` branches. A new
host difference is resolved in order:

1. express it as data in the host-specific adapter/registry when semantics stay
   unchanged;
2. add an optional port capability with a new schema/requirement profile when
   the semantic is genuinely generic and preservation tests pass; or
3. reject/degrade the affected operation when generalization would weaken an
   existing host or KStack invariant.

## Material-difference and ownership proof

`SecondHostDifferenceMatrixV1` has one closed row per lifecycle surface with
OpenCode behavior digest, Goose behavior digest, common semantic requirement,
host-specific adaptation digest, KStack owner, host owner, overlap outcome,
and test obligations. Required surfaces are instruction/recipe discovery,
extensions/tools, provider/credential lifecycle, subagents, MCP, permissions,
roots, background tasks, cancellation, retry/idempotency, session state,
memory/context, updates, and output/receipts.

The second host is materially different only when at least three registered
surfaces have distinct native event or ownership models requiring non-empty
host-specific adaptations, while the selected operation's kernel request,
requirement, eligibility, result, error, and receipt schemas remain byte-
identical. A cosmetic path/frontmatter difference is insufficient.

Every overlap row has exactly `KSTACK_OWNS|HOST_OWNS_UNDER_BOUNDARY|REJECT`.
`HOST_OWNS_UNDER_BOUNDARY` requires independent evidence that the host behavior
cannot bypass the KStack requirement. Ambiguous, shared, or model-negotiated
ownership rejects the affected operation.

## Abstraction proof protocol

`SecondHostAbstractionProofV1` binds the stability gate, separate Goose
objective/decision digests, primary-source ledger, reuse dispositions, shared
contract/schema/registry digests, both host adapter/build/environment digests,
difference/ownership matrix, same-profile fixture set, two independent
conformance evidence sets, preservation evidence, and expiry.

The proof sequence is:

1. freeze one minimal operation profile and exact shared artifact closure;
2. execute HB-TC05 independently on the current OpenCode path;
3. execute the same semantic fixtures through the Goose adapter using distinct
   subject processes, disposable roots, observers, evidence, and receipts;
4. compare canonical kernel inputs/results and declared normalized native-event
   traces; and
5. run Codex/Claude preservation plus cross-host no-promotion/bypass tests.

OpenCode fixture/evidence/receipt bytes cannot satisfy a Goose row. Shared
fixtures are definitions only; executions and observer evidence are host-
specific. A pass on advisory/public-read proves only that exact profile. Local
write, ask-tier, privileged, background, private MCP, or provider operations
remain separately unsupported until their own complete dependency and fixture
sets pass.

## Closed outcomes and non-promotion

The proof outcome is exactly:

- `ABSTRACTION_PROVEN_FOR_PROFILE` when both independent evidence sets are
  current/clean, the shared semantic artifacts are byte-identical, every host
  difference is confined and owned, and preservation passes;
- `SECOND_HOST_PROFILE_UNSUPPORTED` when Goose cannot meet the selected
  requirements without weakening them;
- `HOST_OVERLAP_REJECTED` when lifecycle/authority ownership cannot be made
  unambiguous;
- `FIRST_HOST_UNSTABLE` when the stability gate is not current; or
- `PROOF_INVALID` for missing, stale, mismatched, ambiguous, or contaminated
  evidence.

Even `ABSTRACTION_PROVEN_FOR_PROFILE` proves only the named abstraction and
operation profile on two exact builds/environments. It does not mean either
whole host is supported, authorize a third host, make ACP relevant, or permit
support inheritance.

## Negative and regression fixtures

Required tests cover: Goose recipe/extension text attempting authority
promotion; provider credentials bypassing the broker; host retries duplicating
KStack retries; subagent inheritance bypass; user MCP direct action; alternate
root/workspace escape; background/orphan behavior; host updates invalidating
evidence; adapter results contradicting independent observers; semantic fields
leaking into host-specific projections; OpenCode-only branches appearing in the
generic layer; Goose evidence substituted for OpenCode; and any shared-contract
change regressing Codex/Claude/OpenCode baselines.

Mutation tests change every proof digest, ownership row, port mapping, fixture,
expiry, and evidence reference. Cross-runtime goldens cover exact shared
artifacts and normalized traces. Secret/provenance/license scans cover all
candidate inputs; no production/user-data target is used.

## Failure and rollback boundary

All second-host work remains candidate-only until the separate objective and
implementation authorization. Failure removes only the unused Goose candidate
projection/adapter/evidence and leaves the stable OpenCode/Codex/Claude paths
unchanged. No generic contract version activates unless all preservation and
backward-resolution requirements independently pass under HP-TC11/12.

## Review request

Review HB-TC06 only for a constructible, dependency-gated proof that the Host
Adapter Kit generalizes from stable OpenCode to a materially different Goose
path without copying, lowest-common-denominator weakening, authority transfer,
support inheritance, or premature ACP expansion. Closure requires Codex 93+
and empty failed, security, dissent, and question arrays.

Do not open the Goose objective, browse, invoke Opus, inspect/edit files, use
tools, implement, install/configure/run a host, use credentials, perform an
external side effect, commit, push, deploy, publish, or edit reports.
