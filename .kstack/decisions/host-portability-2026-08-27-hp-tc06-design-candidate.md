# HP-TC06 design candidate: independent harness and bypass inventory

**Thread:** `host-portability-2026-08-26`
**Item:** `HP-TC06` only
**Status:** local design candidate; no host execution, qualification, or
support claim
**Predecessors:** HP-TC01 through HP-TC04 are validated design only; HP-TC05 is
a frozen, independently review-gated interface candidate

## Exact defect boundary

The round-one plan treated adapter/host-reported results as evidence and did not
enumerate alternate execution paths that bypass the nominal adapter. This item
defines an out-of-process oracle, protected immutable run protocol, exact
OpenCode bypass-inventory method, coverage closure, and per-operation evidence
production contract only.

It does not authenticate evidence/signers (HP-TC04), decide eligibility
(HP-TC05), authorize/broker action (HP-TC07), implement safe local mutation
(HP-TC08), authenticate MCP (HP-TC09), prove production provider outcomes
(HP-TC10), fence live operations (HP-TC11), or activate/rollback components
(HP-TC12). No design review or simulated run makes OpenCode supported.

## Reuse-first disposition

`COMPOSE-INTERNAL-PLUS-BUILD`. Compose HP-TC01 schemas, HP-TC03 time/replay,
HP-TC04's protected evidence producer interface, and the already validated
HB-TC05 executed-conformance protocol. Build KStack-native isolation, observers,
fixture coverage, bypass discovery, and oracle logic. The gstack test fan-out
pattern is useful provenance precedent but lacks protected observer ownership,
bypass closure, operation-level qualification, and no-promotion rules; source
reuse is rejected. No upstream bytes enter this design.

## Independent ownership and trust split

The harness executes under the HP-Q1 protected component, outside the host,
adapter, model, agent, plugin, skill, MCP, tool, shell, or fixture-subject
process. Its executable/config/fixture/observer/fake-provider digests are exact
members of the candidate active set and are remeasured before each group. The
subject receives no write handle or IPC method for expected outcomes, policy,
active-set pointer, clock, evidence catalog, observer state, signing key,
fixture verdict, or final aggregate.

`HarnessProfileV1` binds exact platform/isolation backend, launcher and
supervisor digests, observer-set digest, trusted-time/replay profiles,
environment-measurement profile, artifact/output limits, cleanup contract,
network policy, disposable target profile, fake-provider registry, and
qualification vector set. An unqualified platform/backend or missing protected
primitive is `HARNESS_UNAVAILABLE`, never emulated by a cooperative prompt.

The requirement oracle is compiled deterministically from the active
`OperationRequirementProfileV1`, stable expected native event schemas,
registered fixture definitions, and policy. Adapter/host output is one observed
channel only. It cannot supply expected results, waive a requirement, select an
observer, classify its own error, or mark a fixture passed.

## Isolation and side-effect budget

Every run receives a new disposable repository/root, process/session namespace,
credential namespace, network namespace or independently enforced network
double, fake broker/provider endpoints, output store, attempt ID, and cleanup
ledger. Production repositories, credentials, approval stores, Jira/GitHub
targets, deployments, devices, and endpoints are absent.

The protected launcher opens/validates disposable roots without following
links/reparse points, binds filesystem/volume identity, supplies only required
handles, sets hard deadline/input/output/process/descriptor limits, and records
the complete descendant identity set. Subject access outside the fixture budget
is independently denied and observed. A platform unable to prove the required
isolation may run diagnostic fixtures but cannot produce admissible evidence.

Ask/privileged fixtures use a protected fake broker and idempotent fake
providers that reproduce the registered protocol and receipt/reconciliation
semantics without external effect. A separately owner-approved disposable
external target would be a new test objective and evidence scope; it is not
authorized or implied here.

## Independent observer set

`ObserverProfileV1` binds observer ID/role, protected implementation/config
digests, supported platform/backend, exact event schema, authority/source,
capture point, limits, failure codes, and negative vectors. Each fixture names
all required observers and why their capture points are independent of the
subject. The minimum observer registry includes:

- handle/file-identity and filesystem-event observers for read/write/rename/
  delete, including mount, case, symlink/reparse, and parent replacement;
- process-tree, executable-image, descriptor, signal, deadline, cancellation,
  parent-death, and orphan observers;
- kernel/network-namespace or independently enforced connection observers for
  DNS/socket/TLS/endpoint attempts and byte budgets;
- protected broker sentinel, exact displayed-approval capture, credential-
  access sentinel, and fake-provider request/receipt/reconciliation observers;
- stdin/stdout/stderr/MCP frame collectors enforcing protocol purity, encoding,
  redaction, escaping, and byte/depth/item limits;
- host tool/plugin/subagent/custom-tool/MCP/hook/background event observers;
  and
- active-set/policy/environment/time/catalog/epoch remeasurement observers at
  fixture start, every action-capable boundary, and verdict publication.

For action-capable and security fixtures, observer truth requires at least two
independent capture points where the platform can supply them—for example fake-
provider request log plus broker dispatch record, or kernel filesystem event
plus handle-verified resulting bytes. Where only one authoritative platform
source exists, the profile names that limitation and a mutation/omission test;
the operation can qualify only if its requirement profile explicitly accepts
that assurance level. A subject-authored log never counts as the second source.

Missing, crashed, writable-by-subject, late, contradictory, truncated,
unbounded, wrong-environment, or schema-invalid observer output makes the
fixture `HARNESS_ERROR|AMBIGUOUS`. It never becomes a host failure or pass by
default. Contradictory admissible observers are preserved for HP-TC04 as
`CONTRADICTORY` evidence.

## Immutable run plan and state

`ConformanceRunPlanV1` is a closed/domain-addressed object binding one exact
host instance/build, adapter, platform, active set, policy, operation profile,
requirement profile, environment snapshot, harness, observer set, bypass
inventory, fixture/coverage matrix, isolation target, side-effect budget,
fake-provider set, trusted-time sample, and run expiry. All inputs are durably
stored and re-read by digest before state enters `RUNNING`.

`FixtureExecutionV1` transitions only:

```text
DECLARED -> DEPENDENCIES_SATISFIED -> ENVIRONMENT_BOUND -> RUNNING
RUNNING -> PASS | FAIL | NOT_RUN | CAPABILITY_UNAVAILABLE |
           HARNESS_ERROR | AMBIGUOUS
```

Only the protected supervisor appends transitions. `PASS` requires exact event
order, every positive/negative oracle assertion, all observer agreement rules,
zero forbidden side effects, output/limit compliance, and completed cleanup.
Skipped, filtered, flaky, retried-until-green, capability-unavailable,
ambiguous, harness-error, cleanup-failed, timed-out, or crashed runs are not
passes. A rerun is a new immutable attempt and cannot replace the prior record;
HP-TC04's supersession rules govern later evidence selection.

Crash before a proven action boundary may be `FAIL|HARNESS_ERROR` according to
the oracle. Crash, timeout, cancellation, or transport loss after a fake/local
action boundary is `AMBIGUOUS` unless independent observer/receipt evidence
proves the exact outcome. The harness never blind-retries an effect; HP-TC03
records the attempt/reconciliation state.

## Exact OpenCode bypass inventory method

`HostBypassInventoryV1` is per exact OpenCode build/platform/configuration and
operation profile. It is not a generic assertion that all host behavior is
known. The protected builder binds these four independently acquired inputs:

1. exact source/release provenance and build digest, with content-addressed
   static enumeration of every registered command, tool, protocol, extension,
   permission hook, process-launch, filesystem, network, and background path;
2. canonical official configuration/schema/CLI-help/protocol artifacts for the
   same build, acquired once and retained by digest without network at run time;
3. live protected enumeration of enabled/built-in tools, plugins, custom tools,
   skills/instructions, subagents, MCP endpoints, hooks, permission modes,
   remembered approvals, roots/worktrees, shells/wrappers, formatters/LSP,
   background facilities, environment-selected features, and remote/client
   interfaces; and
4. dynamic negative-probe traces exercising each declared surface plus generic
   file/process/network/broker sentinels that reveal undeclared effects.

The exact surface families are built-in read/write/patch/search/terminal and
process tools; direct shell and wrapper invocation; aliases and alternate
binary/search paths; plugin/custom-tool APIs; user/project/remote MCP resources,
prompts, and tools; subagents/delegation; instruction/skill loading; permission
hooks, auto/remembered/session modes; background tasks and descendants;
formatters/LSP/file watchers; VCS/credential helpers; network/provider SDKs;
additional/nested roots/worktrees; configuration reload; UI/daemon/remote
control protocols; and any native extension or protocol escape hatch exposed by
the exact build.

`BypassSurfaceV1` binds stable surface ID, family, source/provenance digest,
live registration digest, native event schema, reachable operation profiles,
required KStack mediation point, observer mapping, positive fixture IDs,
negative fixture IDs, status, and limitation codes. Status is exactly
`COVERED|DISABLED_PROVEN|UNREACHABLE_PROVEN|UNKNOWN|UNOBSERVABLE|BYPASS_FOUND`.

Static, documented, live, and dynamic inventories are joined by stable IDs and
must be mutually complete. A surface found in only one source is retained, not
dropped. `DISABLED_PROVEN` requires a live negative reachability test and exact
configuration binding. `UNREACHABLE_PROVEN` requires protected platform policy
and attempted-use denial evidence. Disabled-by-convention, absent from a menu,
or omitted from documentation is not proof.

An unknown/unobservable surface blocks only every operation profile it can
possibly reach, using a conservative registry mapping. `BYPASS_FOUND` produces
failing evidence and quarantine input; a nominal path pass cannot override it.
If reachability itself is unknown, all authority/effect classes potentially
reachable by that family remain unqualified. There is no host-wide `FULL` or
"mostly covered" claim.

## Requirement-to-fixture coverage closure

`ConformanceCoverageMatrixV1` contains one row for every tuple of operation
profile, mandatory capability, negative fixture, bypass surface, observer
requirement, and environment selector. Each row binds at least one positive and
one negative fixture unless the requirement is intrinsically negative, in which
case two distinct negative/mutation fixtures are required. Every fixture maps
back to exact requirement and surface IDs; orphan fixtures cannot inflate
coverage.

Closure requires set equality, not a percentage:

```text
registered requirement tuples == covered matrix tuples
registered bypass surfaces == matrix surface tuples
fixture-declared observers == profile-required observers
executed fixture IDs == selected matrix fixture IDs
```

Duplicate/missing/extra rows, an unmapped surface, an unexecuted fixture, or a
fixture whose environment changed makes the affected profile incomplete. A
waiver may only remove an operation profile from the supported candidate set;
it cannot mark an uncovered tuple passed.

## Fixture groups and evidence aggregation

The required fixture groups are exact process/build/config/currentness;
instruction/package discovery; public MCP list/read; repository/root/path;
native permission/approval; broker/credential/side-effect; result/receipt/
ambiguity; background lifecycle; output/redaction/protocol; host bypass;
resource exhaustion; and crash/recovery. Only groups applicable to the one
operation profile run, but the coverage matrix proves why every excluded group
is unreachable.

`ConformanceRunResultV1` binds the plan, attempt, immutable fixture result set,
observer evidence set, bypass inventory, coverage matrix, environment start/end
snapshots, cleanup result, limitation codes, started/completed trusted times,
and aggregate. Aggregate is exactly:

```text
PASS | FAIL | INCOMPLETE | AMBIGUOUS | HARNESS_ERROR
```

`PASS` requires every selected fixture `PASS`, exact coverage closure, no
`UNKNOWN|UNOBSERVABLE|BYPASS_FOUND` relevant surface, equal relevant start/end
environment, successful cleanup, and complete protected logs. Any fixture fail
or bypass is `FAIL`; missing/not-run/capability-unavailable coverage is
`INCOMPLETE`; possibly acted/conflicting outcome is `AMBIGUOUS`; harness or
observer integrity failure is `HARNESS_ERROR`. Precedence for reporting is
`HARNESS_ERROR`, `AMBIGUOUS`, `FAIL`, `INCOMPLETE`, then `PASS`, while all facts
are retained.

Only a complete result is handed to the HP-TC04 protected evidence producer.
The signer independently revalidates the plan/result/environment/coverage/log
digests and observer ownership. Adapter, host, model, or harness subject cannot
request a `PASS` anchor. HP-TC04/05 decide trust and eligibility; this item does
not emit `OperationEligibilityV1`.

Qualification is per exact `(host build, platform, configuration, adapter,
active set, policy, operation profile, environment measurement profile,
bypass inventory)` tuple. Passing local read does not qualify local write,
ask/privileged, background, MCP-private, another platform, another OpenCode
build, or Goose. Any bound change requires a new run; results do not inherit
across hosts or profiles.

## Stable failures and safe diagnostics

The closed reason families are `KSTACK_HARNESS_PROFILE_*`,
`KSTACK_HARNESS_ISOLATION_*`, `KSTACK_HARNESS_OBSERVER_*`,
`KSTACK_HARNESS_FIXTURE_*`, `KSTACK_HARNESS_CLEANUP_*`,
`KSTACK_HARNESS_AMBIGUOUS`, `KSTACK_BYPASS_INVENTORY_*`,
`KSTACK_BYPASS_FOUND`, `KSTACK_BYPASS_UNOBSERVABLE`,
`KSTACK_COVERAGE_*`, and `KSTACK_CONFORMANCE_ENVIRONMENT_CHANGED`.
Concrete codes are HP-TC01 registry-owned and map to one aggregate class.

Public/model-visible diagnostics contain only safe IDs, fixed text, statuses,
counts, and correlation digests. Raw paths, fixture inputs, host output,
exceptions, environment/config, principal, credential, approval, provider
payload, key, or secret never cross the projection boundary.

## Deterministic verification design

Golden vectors freeze run plans, fixture transitions, native event sequences,
observer joins, bypass inventories, coverage matrices, run results, cleanup
ledgers, and evidence-producer handoffs across independent Node and native/Rust
implementations.

Isolation tests attempt to write expected outcomes, observer state, evidence
catalog, clock, active pointer, signing key, other fixtures, parent roots, and
production endpoints. They cover symlink/reparse/mount/case/root replacement,
namespace escape, inherited descriptors, descendant/orphan processes, signal/
deadline races, stdout/stderr flooding, fork bombs, disk exhaustion, network/
DNS escape, and cleanup failure.

Observer tests omit, forge, reorder, truncate, contradict, delay, and make each
channel subject-writable. Fake providers act then drop responses, return
conflicting receipts, duplicate idempotency keys, and expose reconciliation
races. The only allowed outcomes are the exact conservative states; no retry
converts them to pass.

Bypass tests add one hidden surface in each family, change configuration after
enumeration, register a dynamic plugin/tool/MCP/subagent, invoke alternate
shell/binary paths, use formatter/LSP/background/file-watcher effects, reach an
additional root, bypass the broker, exploit remembered/auto permission, and
expose an undocumented native event. Each must appear as uncovered/bypass and
block affected operation profiles.

Coverage mutation tests remove/add/duplicate every requirement, surface,
observer, and fixture row. Property tests prove set-equality closure,
enumeration-order independence, and that no incomplete/unknown/ambiguous/
harness-error input aggregates to pass. Reproduction uses only the retained
content-addressed closure and disposable fakes; no production credential or
target is used.

## Review request

Review HP-TC06 only for independent oracle ownership, protected isolation,
complete observer semantics, exact OpenCode bypass discovery/inventory,
requirement-to-fixture set closure, conservative aggregation, and per-operation
claim boundaries. Closure requires Codex 93+ and empty failed, security,
dissent, and question arrays.

Do not review or close HP-TC08 through HP-TC12, invoke Opus, inspect/edit files,
use tools, implement, install/configure or execute a host, use credentials,
perform an external action, commit, push, deploy, publish, or edit reports.
