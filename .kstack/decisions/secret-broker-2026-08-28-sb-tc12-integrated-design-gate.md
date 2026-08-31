# KStack Secret Broker — SB-TC12 integrated design gate

| Field | Value |
|---|---|
| Thread | `secret-broker-2026-08-28` |
| Item | `SB-TC12` — integrated dependency graph, implementation sequence, milestone exits, residual risks, and final design gate |
| Status | `REVIEW-REQUIRED` |
| Research cutoff | 2026-08-31 |
| Objective | `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9` |

## 1. Decision requested

Determine whether the eleven accepted mechanism contracts form one coherent,
implementable design without importing their individual confidence scores.
Freeze cross-contract vocabulary and ownership, the acyclic dependency graph,
an implementation sequence with objective milestone exits, the current-code
gap classification, the residual-risk register, and the exact claim permitted
after final approval.

The requested final claim is only
`READY_FOR_PROJECT_LOCAL_IMPLEMENTATION`. It does not mean the existing broker
is conformant, a backend is qualified, a real credential may be entered, a
provider may be administered, source data may be deleted, or code may be
committed, pushed, merged, published, or deployed.

## 2. Frozen integrated package

| Item | Accepted digest | Integrated owner |
|---|---|---|
| SB-TC00 | `9a239374becf8e4736c5246fa09c60c355065b8f561aad0b1e64a6000caa73d9` | objective, terminology, authority, threat/value boundary |
| SB-TC01 | `7cce1f2fce8de5894c3b5e33c27a0d2754fe99afa18c702765f6e40c5564fe57` | reuse-first backend portfolio |
| SB-TC02 | `6710fb7d611d890d4e8bd8e7182aa3fb687c54d1a9ced6bba2569123dac37075` | primitive domains, opaque handles, safe public metadata |
| SB-TC03 | `b8aadd172e87a4c9f3c349890162b73b3f5e5682818c0428c25edb0534ac8c99` | identity, policy, preview, approval, lease, trusted time |
| SB-TC04 | `3cf4c46653c6562ebf3f52a4c08d3ae3cafd1023e8c92c527c264b855da47925` | backend identity, bootstrap, capability, readiness, value sink |
| SB-TC05 | `57f18fcbb172327ef85ea3e56be8fa29f7e40be233b8c884223fc793158e1d3d` | protected execution, containment, output, terminal precedence |
| SB-TC06 | `62e7863ff75922922d3b26bea25fd2aa7e8615d1c18a6d9412275d50d06b2e71` | lifecycle state, provider mutations, reconciliation |
| SB-TC07 | `6635aa11e3769c33541a0807fdedd7d497ae7274f01054d2ee9e83703a4d5a4b` | audit/head, receipts/errors, incidents, support, leak harness |
| SB-TC08 | `d15fdce75567e4dbb7d5e7400ae48aca21749a7d817f703d0947beb6b3ba966d` | host projections, user attestation, coordinator/scheduler |
| SB-TC09 | `f76640aabb05ae2af4288fcd7e06c6183f74edcdbe59e133c031882d95727137` | setup, no-echo/import, migration, recovery, uninstall/rollback |
| SB-TC10 | `a96c00d5e1d87ba690730ebf09856ab44cf8b99c18c2ea6b5127dbcce2b7168a` | exact-cell evidence, resources, promotion, rollout |
| SB-TC11 | `1ec9bccc8dde857c6d659cee36d10b535a2fbfad65b5fe79966d000ec12e70ee` | package/config, compatibility, provenance, health, docs |

Every implementation and review manifest binds this complete ordered digest
set. Editing any accepted candidate reopens that item and SB-TC12. A later
clarification may add a namespaced mapping already fixed below; it cannot alter
an item invariant under the SB-TC12 digest without a new integrated review.
Operational lifecycle labels are recorded outside these accepted files in a
separate mutable delivery-status artifact. Approval must never edit an accepted
objective or item merely to change its status, because that would invalidate
the digest set it claims to preserve.

## 3. Integrated non-compensating rules

1. No model-facing operation, package, config, diagnostic, fixture, test,
   receipt, evidence, Jira event, review, or support artifact contains a value,
   credential-equivalent derivative, protected locator, or provider/target body.
2. There is no generic read/reveal/export/template/shell/URL/environment API.
   Every effect is one registered typed operation under a consumed one-use
   authority and exact immutable cell.
3. Audit admission and an external current head precede contact. Authority is
   consumed before contact. Ambiguity burns retry authority and allows only
   read-only reconciliation.
4. Missing/expired/drifted identity, policy, evidence, readiness, containment,
   output, audit, resource, recovery, host, package, or compatibility state
   denies without fallback.
5. Installation, discovery, configuration, qualification, enrollment,
   lifecycle, migration, source retirement, uninstall, and provider destruction
   remain separate state machines and authority events.
6. Qualification is exact-cell, expiring, externally anchored, synthetic-first,
   and non-transferable. Automation can revoke/disable but not promote.
7. Production v1 is `openbao-v1` only. OS-local custody is development/pilot
   limited; current Windows/Linux helpers and JavaScript broker are precedents,
   not conformant cells.
8. Claude and Codex capability claims remain asymmetric. Codex has no KStack
   automatic ask interception; ordinary chat is instruction-only. Workers
   cannot ask, approve, lease, execute, or delegate.
9. This repository's Jira credential/executor remains WSL-only. Native Windows
   uses the credential-free WSL bridge. No implementation milestone creates or
   qualifies a second Windows Jira source.
10. Software/config rollback never rolls back protected state, audit/evidence
    heads, authority epochs, current generation, migration history, source
    retirement, or ambiguity fences.
11. Current experimental tests may remain as regression evidence but cannot be
    renamed or projected as SB-TC02–SB-TC11 conformance.
12. A milestone passes only on the exact integrated candidate with all required
    tests and zero open gate findings; partial percentages and waivers do not
    compensate.

## 4. Vocabulary reconciliation

The integrated implementation uses namespaced types; identical words in
different contracts never alias implicitly.

| Source term | Integrated type | Mapping |
|---|---|---|
| SB-TC02 lower-case `evidenceLevel` | `qualification.publicLevel.v1` | Exact presentation of SB-TC10 `DISCOVERED`, `CONFIGURED`, `SYNTHETIC_QUALIFIED`, `PILOT_VALIDATED`, `PRODUCTION_APPROVED`; authorization still checks protected active epoch/state. |
| SB-TC07 receipt `LOCAL-DEVELOPMENT` | `receipt.assuranceClass.v1` | Coarse presentation only for a permitted OS-local operation at SB-TC10 `SYNTHETIC_QUALIFIED` or `PILOT_VALIDATED`; never an authorization input. |
| SB-TC07 receipt `PRODUCTION-QUALIFIED` | `receipt.assuranceClass.v1` | Emitted only from current active `PRODUCTION_APPROVED` evidence; it does not replace the exact evidence ref. |
| SB-TC07 support `UNQUALIFIED` | `support.assuranceClass.v1` | Says no operation-level assurance is available; support bundles never prove evidence. |
| SB-TC08 capability `SYNTHETIC_QUALIFIED` | `host.capabilityState.v1` | One exact host-control predicate, required as one component of an SB-TC10 cell; not the cell's global level. |
| SB-TC09 `PILOT_VALIDATED` state | `migration.entryState.v1` | One per-entry migration gate before rotation/recovery/observation; distinct from `qualification.level.v1`. |
| `ready`, `available`, `qualified` | owner-qualified enum | Backend readiness, host capability, install health, evidence level, and user status never coerce across types. |

Public schema generation encodes these as separate named enums even when their
rendered strings match. No generic `status` or `evidenceLevel` parser is shared
across domains. SB-TC07's operation receipt cannot emit an unqualified class
because unqualified public operation execution is prohibited.

## 5. Acyclic dependency graph

```text
SB-TC00 objective/authority
  +--> SB-TC01 portfolio
  +--> SB-TC02 primitives/public boundary
          +--> SB-TC03 authority/lease
          |       +--> SB-TC07 audit/event foundation
          |       +--> SB-TC08 host approval projection
          +--> SB-TC04 backend adapter/readiness
                  +--> SB-TC05 protected executor/target adapter
                          +--> SB-TC06 lifecycle/reconciliation

SB-TC02..07 +--> SB-TC08 coordinator/scheduler
SB-TC02..08 +--> SB-TC09 setup/migration/recovery
SB-TC02..09 +--> SB-TC10 qualification/promotion
SB-TC00..10 +--> SB-TC11 package/config/health/docs
SB-TC00..11 +--> SB-TC12 integration and delivery order
```

The runtime contact path is stricter than document order:

```text
host request
 -> public schema/scope (02)
 -> prepare + identity/policy/preview (03,08)
 -> live package/cell/evidence/resource checks (10,11)
 -> backend/readiness/capability checks (04)
 -> conflict reservation + durable attempt consumption (03,06,08)
 -> externally anchored PRE_CONTACT audit (07)
 -> protected resolve + registered target crossing (04,05)
 -> lifecycle/local-state CAS where applicable (06)
 -> cleanup/output/terminal precedence (05)
 -> externally anchored terminal audit (07)
 -> content-free public receipt (07)
```

No cycle is solved by weakening a gate:

- installation creates a disabled exact cell; isolated synthetic qualification
  invokes it through a qualification-only authority unavailable to the public
  broker; activation follows admitted evidence;
- audit code is implemented before effects using the complete build-time closed
  vocabulary registry; synthetic effects then qualify its ordering/head logic;
- a release candidate is externally signed before exact-cell qualification;
  production approval is about the already signed immutable artifact, not an
  unsigned build later swapped beneath evidence; and
- new evidence is built in a non-authorizing candidate epoch while a prior
  current epoch may continue only until its real expiry/invalidation.

## 6. Component and process ownership

| Component | May hold value | May authorize | May contact provider/target | Model-facing output |
|---|---:|---:|---:|---|
| skill/host/model/public CLI | no | no; proposes only | no | closed metadata/request/result |
| coordinator | no | validates host attestations; cannot mint them | no | closed status/preview |
| policy/authority service | no | yes, exact prepared attempt only | no | decision/ref only |
| protected state adapter | only records whose frozen schema owns transient value crossing | no | custody backend only under typed call | none |
| backend adapter | transient bounded value | no | exact backend | protected sink only |
| protected supervisor/worker | transient bounded value | consumes existing authority | exact registered target | fixed terminal fact only |
| lifecycle adapter | transient generated/input value when operation requires | consumes exact mutation authority | exact provider/target | fixed lifecycle fact only |
| audit/evidence authority | no secret or secret-derived material | evidence/promotion only under role thresholds | external head/audit devices | content-free refs/classes |
| Jira projector | no | Jira tracking authority only | WSL Jira executor | content-free lifecycle events |

No process combines model conversation, value resolution, arbitrary command
execution, provider administration, release signing, evidence promotion, and
audit-head authority. Production identities and failure domains are distinct as
required by their contracts.

## 7. Current implementation disposition

The repository is `DESIGN_COMPLETE_IMPLEMENTATION_NONCONFORMANT` after this
item passes. Known current gaps include:

- `kstack-secret-broker.mjs` accepts caller-declared qualified-cell strings,
  uses broader inventory metadata, returns `handleDigest`/`targetDigest`, and
  emits a precise timestamp; these conflict with SB-TC02, SB-TC07, and SB-TC10;
- the Windows DPAPI and Linux Secret Service helpers are experimental protocol
  cells without the accepted handle, authority, external audit/evidence,
  containment, lifecycle, recovery, and exact qualification contracts;
- no production native worker, OpenBao adapter/bootstrap, protected state
  service, external audit/evidence authority, host-owned answer attestation,
  lifecycle engine, config-v2 migration, release publication authority, or
  install-health v2 exists;
- current Codex `plugin.json` uses `hooks` while the pinned local plugin
  validator rejects that field, so the Codex plugin host profile remains
  `BLOCKED_HOST_SCHEMA_DRIFT`; and
- current mechanism tests and the previously green repository suite prove only
  their named baseline behavior, not integrated conformance or production.

Existing WSL Jira tracking is intentionally outside this broker migration. It
continues through the enrolled source and fixed bridge while Secret Broker work
is disabled. No implementation test reads that credential as a fixture.

## 8. Delivery work packages

Each work package becomes a distinct Jira implementation item before code is
advanced. Item summaries and evidence remain value-free.

| WP | Work | Hard dependencies |
|---|---|---|
| WP00 | Conformance gap guard, feature disable, accepted-digest registry | SB-TC12 |
| WP01 | Public schemas, canonical codec, registry IDs, opaque refs, safe CLI | WP00; TC02, TC11 |
| WP02 | Config-v2 parser/migrator, release/content manifests, provenance verification | WP00–01; TC09, TC11 |
| WP03 | Protected-state adapter, monotonic authority epoch, external head primitives | WP01–02; TC02, TC03, TC07, TC10 |
| WP04 | Identity/policy/preview/approval/lease and host-owned answer attestations | WP03; TC03, TC08 |
| WP05 | Audit chain, external head, receipts/errors/incidents, evidence authority | WP03–04; TC07, TC10 |
| WP06 | Backend framework and OpenBao identity/bootstrap/readiness adapter | WP03–05; TC01, TC04 |
| WP07 | Protected supervisor/native worker and one registered synthetic Jira target adapter | WP03–06; TC05 |
| WP08 | Lifecycle engine, provider mutation profiles, ambiguity reconciliation | WP03–07; TC06 |
| WP09 | Host coordinator, conflict scheduler, Claude/Codex/direct profiles | WP04–08; TC08 |
| WP10 | Setup/no-echo/exact importer framework, migration/recovery/uninstall | WP03–09; TC09 |
| WP11 | Routed skill/docs, install-health v2, cache/direct-copy transforms | WP01–10; TC11 |
| WP12 | Full adversarial/leak/fault/resource qualification harness | WP01–11; TC10 |
| WP13-WIN | Optional Windows DPAPI local-development cell | WP07–12; exact Windows profile |
| WP13-LINUX | Optional Linux desktop Secret Service local-development cell | WP07–12; exact desktop D-Bus profile |
| WP13-MAC | macOS Keychain cell | deferred/unavailable until separately implemented and qualified |
| WP14 | Signed OpenBao/Jira exact-cell synthetic qualification | WP06–12 plus operator-provided isolated OpenBao/target |
| WP15 | Owner-authorized real-entry pilot | WP14 plus fresh separate authority |
| WP16 | Production canary/bounded/broad rollout | WP15 plus provider administration/deployment/publication authority |

WP07's Jira adapter uses only a generated credential and isolated fake or test
target until WP14. It does not touch the repository Jira source. A future real
Jira migration is one WP15 pilot entry with source retained and separate
retirement authority; it is not a Windows Jira credential project.

## 9. Implementation milestones and exits

### M0 — baseline fenced

Exit only when accepted digests are machine-bound, all nonconformant execution
paths report `UNAVAILABLE`, current WSL Jira tests still pass, and no current
experimental helper/receipt is described as conformant. No value path changes.

### M1 — source/package/public boundary

Complete WP01–02. Exit on hostile canonical/parser vectors, opaque-handle
property tests, exact public schema snapshots, config-v1 disabled read plus
two-phase v2 migration crash cuts, acyclic manifest checks, external provenance
negative controls, skill quick validation, plugin host-schema disposition, and
full repository regression. Claim: package/config scaffolding only.

### M2 — protected control plane

Complete WP03–05. Exit on protected-state rollback/fork/restart tests, trusted
identity/time/epoch/lease anti-replay, host-owned answer attestation forgery
tests, pre-contact audit ordering, terminal/outage precedence, evidence signer
roles/key epochs/candidate activation, and no public protected locator. Claim:
no provider/target operation yet.

### M3 — one synthetic end-to-end operation

Complete WP06–07 against isolated OpenBao and synthetic Jira target. Exit on
exact adapter/worker/image identity, least-privilege bootstrap, readiness/audit,
all injection/containment/output controls, value leak positive/negative cases,
every contact/crash cut, process/resource limits, cleanup, and ambiguity with
no retry. Claim: isolated synthetic development evidence only.

### M4 — lifecycle and concurrency

Complete WP08–09. Exit on every valid/invalid lifecycle transition, create,
rotation/cutover/overlap, revoke/expiry/recovery/delete semantics, provider/
target reconciliation outcomes, typed conflict races, audit phase serialization,
worker authority denial, host crash/cancel/compaction/restart, and no
cross-attempt transfer. Claim remains synthetic.

### M5 — setup and operational lifecycle

Complete WP10–11. Exit on no-scan discovery, no-echo/exact-import isolation,
source ownership/retention, ordered migration and observation, recovery drill
copy destruction, custody-preserving uninstall, forward-only repair, all
platform install/stage/cache/direct profiles, install-health truth, and docs
drift tests. The real repository Jira source remains untouched.

### M6 — exact-cell synthetic qualification

Complete WP12 and the desired WP13/WP14 cells. Exit only when the full SB-TC10
manifest passes on the immutable signed cell at 96/all-zero independent review,
with current external evidence head, confirmed fixture cleanup, 1x/2x load and
saturation results, no skips, and exact status projection. This permits
`SYNTHETIC_QUALIFIED/CURRENT` for that cell only.

### M7 — pilot

Requires new owner authorization; design approval does not start it. One real
entry completes bound use, replacement rotation, cutover, predecessor handling,
restart/failover, recovery, rollback/forward repair, and at least seven complete
24-hour observation intervals with source retained. Exit permits
`PILOT_VALIDATED/CURRENT` only. Any ambiguity/leak/incomplete control blocks.

### M8 — production rollout

Requires separate provider administration, release publication, deployment,
and production promotion authority. Exit requires current signed exact
`openbao-v1` cell, role-threshold promotion, two audit devices plus external
heads, HA/backup/recovery/monitoring/on-call/runbooks, enforced capacity plan,
seven-day canary, seven-day bounded rollout, and no invalidator. Broad rollout
remains allowlisted and evidence-expiring.

## 10. Verification ownership

Every implementation WP supplies:

- canonical source diff and generated manifest closure;
- unit/property/hostile/fault tests for its owned schemas and state;
- integration tests against the nearest preceding stable boundary;
- SB-TC07 leak positive/negative controls for every new sink;
- resource/deadline/cleanup observations where it creates work;
- upgrade/downgrade/crash evidence where it writes state;
- explicit claim language and current-gap update; and
- independent review on the exact candidate with at least 93 confidence and all
  four counters zero before the dependent WP consumes it.

The full `npm test` suite is necessary but insufficient. Platform claims require
real native runners. Provider/target claims require exact isolated provider and
target cells. Static scans, mocks, docs, install health, and unit tests remain
separate evidence classes.

No production or real-value evidence is stored in the repository. Protected
evidence is projected through closed refs and externally anchored state. Jira
receives only stable item IDs, fixed summaries, candidate/review digests, safe
state, and small-count-suppressed results.

## 11. Residual-risk register

| ID | Residual risk | Treatment / accepted boundary | Owner / next gate |
|---|---|---|---|
| RR01 | Same-user/admin/kernel/debugger can inspect OS-local developer cells | Explicit nonclaim; OS-local stops at pilot/local development; no production promotion | platform owner / WP13 |
| RR02 | User can paste a real value into chat before KStack acts | Treat exposed, block covered use, rotate; no retroactive containment claim | incident owner / TC07 |
| RR03 | Authorized target or provider administrator can misuse values | Outside no-model boundary; least privilege, target binding, audit, short TTL, operational controls | provider/target owner / WP14–16 |
| RR04 | Provider/target lost acknowledgement causes long ambiguity/availability loss | No retry; durable fence and read-only reconciliation; operator runbook | operations / WP08, M7 |
| RR05 | External audit/evidence/release heads create availability dependencies | HA, monitoring, capacity, recovery; fail closed, never local fallback | operations/security / WP05, M8 |
| RR06 | Codex lacks a KStack automatic semantic ask path | Instruction-only main-window ask plus host-owned one-use attestation; unavailable if attestation cannot be trusted | host owner / WP09 |
| RR07 | Current Codex plugin hook field conflicts with pinned validator | `BLOCKED_HOST_SCHEMA_DRIFT`; exact-host isolated resolution, no silent removal/ignore | packaging/host owner / WP11 |
| RR08 | Native memory zeroization/locking cannot defeat privileged inspection or prove forced-teardown clearing | Exact limited claims, dump/swap controls, cooperative acknowledgement; ambiguity on forced teardown | platform security / WP07 |
| RR09 | Delete/destroy cannot prove erasure of backups, replicas, screenshots, chat, or target copies | Honest logical/provider-specific claim; retention and source history preserved | lifecycle/provider owner / WP08, M7 |
| RR10 | Release/evidence signer compromise can authorize malicious artifacts/cells | Distinct threshold roles, external pinned roots/head, revocation epochs, incident disable/requalification | security/release owners / WP02, WP05 |
| RR11 | WSL Jira source remains a protected plaintext credential during implementation | Existing exact WSL custody remains sole route; never fixture/Windows copy; migration only in separately authorized pilot | repository owner / WP15 |
| RR12 | OpenBao provisioning, HA, audit, TLS, backup, workload identity, and on-call do not exist merely because adapters are implemented | Operator-provided infrastructure and evidence; KStack setup does not provision or claim it | infrastructure owner / WP14–16 |
| RR13 | macOS lacks an implemented qualified cell | Report `UNAVAILABLE`; no cross-platform inference | future platform owner / WP13-MAC |
| RR14 | Capacity plan can intentionally be conservative and shed demand | Claim is bound to enforced admitted rate; canary demand breach blocks expansion | operations / M6–M8 |
| RR15 | Dependency/toolchain vulnerabilities can invalidate signed artifacts after release | advisory monitor triggers cell-wide revocation; rebuild/review/requalify exact new cell | release/security / continuous |
| RR16 | User may confuse install health, discovery, capability, and qualification | Namespaced schemas and fixed status language; docs drift and UI tests | product/package owner / WP11 |

No residual risk permits a value in model context, fallback custody, automatic
retry, cross-cell evidence transfer, unsigned production artifact, missing audit
head, or source deletion without separate authority.

## 12. Authority and stopping points

The objective authorizes project-local implementation, packaging, metadata-only
planning, and synthetic validation after this final design gate. It does not
authorize:

- inspecting or importing a real credential source;
- OpenBao/provider account or infrastructure administration;
- production target mutation or deployment;
- a real-entry pilot without fresh explicit owner approval;
- source retirement/deletion;
- release key provisioning/publication;
- Git commit, push, PR, merge, or branch publication; or
- representing a synthetic/experimental cell as production.

Implementation stops and returns to design if a required OS/host/provider API
cannot implement the frozen contract, an unavoidable value/output channel is
found, a compatibility migration would require rollback of protected state, a
host user attestation cannot be made non-forgeable, a provider operation cannot
classify ambiguity safely, or a proposed optimization changes authority,
containment, audit, lifecycle, evidence, or failure consequences.

## 13. Final integrated gate

SB-TC12 may be approved only on one frozen digest when all are true:

1. every dependency digest exactly matches Section 2 and no accepted item has
   been edited or silently reinterpreted;
2. vocabulary collisions are namespaced and no status/evidence type can
   authorize through coercion;
3. the dependency/runtime graphs have no circular gate, alternate path,
   unaudited contact, or public qualification bypass;
4. component ownership keeps model, value, effect, audit, evidence, release,
   and Jira authority separated;
5. current code gaps are explicit and existing tests/helpers receive no
   conformance claim;
6. every work package has exact prerequisites and cannot advance before its
   milestone exit evidence;
7. qualification-only execution cannot reach real values/targets or promote
   itself, and production uses the exact signed qualified artifact;
8. setup/migration cannot precede custody, authority, audit, executor,
   lifecycle, host, and qualification foundations;
9. residual risks have honest boundaries, owners, and next gates without
   waiving the no-value/no-fallback/no-retry rules;
10. WSL remains the sole repository Jira credential route throughout delivery;
11. authority stops real pilot, provider administration, deletion, production,
    publication, and Git publication; and
12. final review is `approve`, confidence at least 93, with zero failed checks,
    security findings, material dissent, and unresolved questions on this
    exact candidate.

## 14. Final disposition meanings

- `READY_FOR_PROJECT_LOCAL_IMPLEMENTATION`: SB-TC00–SB-TC12 form an accepted
  design and WP00 may begin under existing project-local/synthetic authority.
- `IMPLEMENTED_UNQUALIFIED`: code exists and local tests pass, but no exact cell
  has current SB-TC10 evidence.
- `SYNTHETIC_QUALIFIED`, `PILOT_VALIDATED`, and `PRODUCTION_APPROVED`: only the
  exact SB-TC10 active epoch may use these terms.
- `BLOCKED_DESIGN`: an integrated invariant is unresolved; implementation of
  affected paths stops.
- `UNAVAILABLE`: the safe runtime result for absent/stale/unsupported cells; it
  is not a project failure and never triggers fallback.

If approved, record `design complete — implementation authorized within
existing boundaries` in a separate mutable delivery-status artifact without
editing any accepted candidate, mark SB-TC12 `VALIDATED`, create the distinct
implementation Jira items before their work begins, and start WP00. Do not
close KSTK-130 merely because the design is accepted if the project's Jira
workflow uses “done” to mean delivered code; project it as design-validated and
keep delivery tracked in the new WP items.
