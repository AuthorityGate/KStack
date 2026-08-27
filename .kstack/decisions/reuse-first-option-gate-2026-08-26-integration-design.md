# Reuse-first option gate — implementation integration design

**Status:** PROPOSED — CODEX REVIEW REQUIRED  
**Decision ID:** `REUSE-FIRST-GATE-INTEGRATION-2026-08-26`  
**Selected direction:** `RF-GATE-Q1 / Yes`  
**Scope:** implementation-ready design only  
**Implementation status:** NOT IMPLEMENTED  
**Authority:** project-local design/review artifacts only; no skill/runtime edit,
dependency installation, contender execution, commit, push, deployment, Jira
mutation, or other external write is authorized by this artifact

## 1. Outcome and invariant

Integrate the owner-selected reuse-first decision as a deterministic KStack
process gate between objective readiness and detailed design for each material
new capability. The gate must prove that KStack researched current,
source-level contenders and neutrally compared **Adopt**, **Adapt**,
**Compose**, and **Build** before detailed architecture, item remediation, or
implementation handoff begins.

The gate is not a preference for external code. Native `Build` remains a
first-class result. Research and selection never install, execute, activate,
or import a contender. External/composed selection authorizes only bounded
trial design; it cannot become the production implementation baseline until a
digest-bound `QUALIFIED_BASELINE` receipt exists.

This package does not change KStack's reviewer/model routing, confidence tiers,
authority matrix, direct-user clarification gate, design approval gate, or
implementation/QC gates. It adds an earlier prerequisite and binds later work
to its evidence.

## 2. Locked inputs and inspected implementation surface

The design preserves these exact decisions:

| Artifact | SHA-256 | Role |
|---|---|---|
| `.kstack/decisions/reuse-first-option-gate-2026-08-26.md` | `490132d09fd36f709e815e169f74457df374019284a08782f8ad57a8e68f93bd` | Codex-qualified process contract |
| `.kstack/decisions/reuse-first-option-gate-2026-08-26-owner-decision.md` | `b283b5770e041dc6330e296b313977c8c52c759196172ed30235f92ffeb8994c` | Owner selection and accepted consequences |
| `.kstack/decisions/reuse-first-option-gate-2026-08-26-codex-closure.md` | `fbc0d2ec5bd45e53217c484c5ce1cddbe318f70d4ddfe8c5c0c4f16415565aa1` | Prior process-design review history |
| `.kstack/objectives/worker-first-orchestration-2026-08-26.md` | `a32303597e70bece89c62ded2675a18d417045cf23019645108f165caebe1fcb` | Root/worker boundary and relay objective |
| `.kstack/decisions/worker-first-orchestration-2026-08-26-w3-readback-ack.md` | `24041c4fe9db37f46eb090db55990658bdcf544e98637d3395a3d1e17fd22b21` | Full readback, proceed-unless-corrected rule |

Inspected current implementation files and SHA-256 digests:

| Artifact | SHA-256 |
|---|---|
| `plugins/kstack/skills/kstack-objectives/SKILL.md` | `a70a2365032bef7cf856ad56ca589a37ad50147d9dc0c65697108433ef021783` |
| `plugins/kstack/skills/kstack-design/SKILL.md` | `76ad348c62f47908a609bfb55e294b6e5760cba95d0fa45278ceeb9e2d5fb6c7` |
| `plugins/kstack/skills/kstack-design-clarify/SKILL.md` | `10984cb552eadf037e0094b42f0b382e4f48575c9fef4f6acfd87b67f54f78e1` |
| `plugins/kstack/skills/kstack-interrogate/SKILL.md` | `dd5c2d7e4256a68de7f2ef03aea2517816bf0c09531b797fbbe9013cf1bc9819` |
| `plugins/kstack/skills/kstack-implement/SKILL.md` | `70addedd5bb0713d665e741e800b4fb717d48b910b58df6e87042174c1fa28ad` |
| `plugins/kstack/skills/kstack-review/SKILL.md` | `07414d460c2bb1fdb50211ea2ffa9a524c04b9486953fbfe03e0f638f1839549` |
| `plugins/kstack/scripts/kstack-config.mjs` | `a9ab0b9c4e679a77b7828331baf8bcd45cb8dcc39a284c5da0701923ab33bd46` |
| `plugins/kstack/scripts/kstack-design-gate.mjs` | `4738b1c0a997c5b276564b9653cb56d58205be59dad28e3122614a54b0f7d89f` |
| `plugins/kstack/references/ARTIFACTS.md` | `654ca57ac7f5a9a6bd728fcdbaf62bf09993528d4dd430bdb2dbd0cd7440e585` |
| `plugins/kstack/references/CONFIG.md` | `db4d93e700272f088f3daa066b3242115dfef7972c383f640662fbc804b0d87b` |
| `plugins/kstack/install-health-contract-v1.json` | `1195d241a3b40a24c1df5e81684cc3485dd6223028ef0ca93c86d5e1b3563862` |

Observed gaps:

1. Objectives emit no digest-bound reuse applicability record.
2. Design can begin detailed architecture/remediation without a reuse
   selection.
3. Clarification and Interrogation do not protect a selected strategy.
4. Implementation has no external/composed qualification preflight.
5. Configuration has no finite qualification-attempt budget.
6. Prose artifacts cannot prevent a state skip or stale binding.
7. The separately designed worker-first `references/ORCHESTRATION.md` is not
   implemented yet. This integration must link it, not copy its protocol.

## 3. Package boundary

Add exactly these shared units:

- `plugins/kstack/references/REUSE_FIRST.md`: normative workflow, schemas,
  transitions, selection, staleness, qualification, and migration.
- `plugins/kstack/scripts/kstack-reuse-gate.mjs`: dependency-free Node 20
  orchestration/validation layer for the immutable receipt chain and stage
  preflights. It never substitutes path-string checks for the helper below.
- `plugins/kstack/native/reuse-io/`: audited, vendored, versioned platform
  helper implementing only handle-relative open/read, identity/stat, snapshot,
  and atomic no-replace publication. It has no network/provider/contender or
  general command-execution surface. Linux, macOS/BSD, and Windows backends are
  separately compiled, hash-bound, capability-probed, and install-health
  qualified; an unavailable backend makes the gate fail closed.
- `tests/reuse-first-gate.test.mjs`: evaluator/receipt behavioral tests.
- `tests/reuse-first-integration.test.mjs`: skill/config/install integration.

Modify only the necessary surfaces:

- `kstack-objectives`, `kstack-design`, `kstack-design-clarify`,
  `kstack-interrogate`, `kstack-implement`, and `kstack-review` receive a short
  link plus phase-specific entry/exit behavior; shared rules stay in the
  reference.
- `kstack-config.mjs` and `CONFIG.md` add two bounded attempt settings.
- `ARTIFACTS.md` adds the reuse tree.
- `install-health-contract-v1.json` binds the evaluator, native helper, and the
  complete sorted set of vendored qualification profiles/reports to invoking
  skills; the audit manifest is mechanically regenerated after bytes are final.
- The worker-first package supplies `ORCHESTRATION.md`. Reuse-first does not
  redefine worker states, dashboards, fallback, relay, retry, or collisions.

Do not add a scheduler, daemon, crawler, dependency resolver, installer,
contender runner, provider wrapper, network client, model rule, or gate-disable
switch.

## 4. Configuration and compatibility

Add to the schema-v1 template:

```json
{"workflow":{"reuseFirst":{"maxQualificationAttempts":2,"qualificationLifetimeCap":20}}}
```

- The gate is mandatory when applicable and cannot be disabled.
- `maxQualificationAttempts` counts total physical attempts including the
  first, accepts 1–20, and defaults to 2 (one initial attempt plus one retry).
- `qualificationLifetimeCap` is the non-renewable total per capability
  generation across every alternative selection. It accepts 1–20
  and defaults to 20. It cannot change after the generation's first required
  event. That event is the sole budget carrier; every later operation derives
  both frozen values by traversing the generation chain back to it.
- Configuration requires `maxQualificationAttempts <=
  qualificationLifetimeCap`; the resolved pair is copied into the first
  required event and later config drift cannot change that generation.
- A schema-v1 project omitting `workflow.reuseFirst` stays valid and resolves
  to the same default. Omission is compatibility, not disablement.
- Unknown nested keys, booleans, strings, floats, zero, negatives, and values
  above 20 fail validation.
- Exhaustion never expands the ordinary budget implicitly. A later config edit
  does not retroactively authorize a run. Every `check`, `record`, and
  `reserve-attempt` compares the currently resolved pair to the first required
  event and returns `REUSE_CONFIG_INVALID` on drift; only a validated
  superseding generation may freeze a new pair. To change the pair, record
  supersession while the old pair still matches, then edit config before the
  successor `REUSE_GATE_REQUIRED` freezes the new pair. The owner may authorize exactly one
  named next ordinal at a time, but never above the generation's frozen
  `qualificationLifetimeCap`; reaching that cap permits only abort/redesign or
  selection of a reviewed alternative.
- The physical ordinal is monotonically increasing across the entire
  generation. It equals one plus the number of prior `QUALIFYING` events in
  that generation; changing option, returning to selection, or approving an
  extra attempt never resets or reuses it. Supersession closes the generation
  and its unused capacity rather than transferring it.
- Existing confidence/model/authority settings and `schemaVersion` do not
  change.

Export one `resolveReuseFirstConfig(config)` helper from `kstack-config.mjs` so
the CLI and tests share legacy/default resolution.

## 5. Immutable receipt chain

Store capability-local state under:

```text
.kstack/reuse/<capability-id>/
├── events/000001.json
├── evidence/sha256/<first-two-hex>/<sha256>
└── trials/<attempt-id>/<trial evidence>

.kstack/reuse-migrations/<capability-id>.json
```

The mandated rejected ledger remains
`.kstack/decisions/<thread-id>-reuse-options-rejected.md`; an event binds its
path/digest. Live briefs, decisions, reviews, dependency closures, and trial
evidence remain in their ordinary locations. Before an event treats any of
them as historical, the recorder snapshots the exact bytes into the
content-addressed evidence path above using the same bounded atomic publication
contract. A historical binding references both original path and retained
object; later original-path changes are irrelevant unless a proposed change
names that artifact.

### Common envelope

Each event is canonical UTF-8 JSON with one trailing LF, exact keys, no
duplicate members, and this envelope:

```json
{
  "schema":"kstack.reuse-event/v1",
  "threadId":"safe-id",
  "capabilityId":"safe-id",
  "generation":1,
  "sequence":1,
  "eventId":"safe-id",
  "state":"REUSE_GATE_REQUIRED",
  "recordedAt":"2026-08-27T00:00:00.000Z",
  "previousEventSha256":null,
  "objective":{"sourcePath":".kstack/objectives/x.md","retainedPath":".kstack/reuse/capability/evidence/sha256/ab/64-lower-hex","sha256":"64-lower-hex","byteCount":1,"role":"objective"},
  "capabilityBoundary":"bounded text",
  "payload":{}
}
```

- IDs are 1–128 ASCII characters matching
  `[A-Za-z0-9][A-Za-z0-9._-]*`; event IDs are chain-unique.
- `objective` is an `ArtifactBinding` with role `objective`, snapshotted before
  publication; the illustrative retained path above must be replaced by the
  exact digest-derived path.
- Sequence begins at 1 and is gapless. Each later event binds exact previous
  bytes. The final name is exactly the six-digit sequence plus `.json`; event
  ID exists only inside the event. Every writer for one next sequence therefore
  races on one fixed absent final path, never distinct event-ID filenames.
  Sequence 999999 is terminal for append capacity; a later append returns
  `REUSE_SEQUENCE_EXHAUSTED` and cannot widen or wrap the filename.
- `generation` begins at 1 and is constant until a
  `GENERATION_SUPERSEDED` event. Its successor is the event named by the
  supersession's `nextDisposition` at generation + 1 over the same stable
  capability ID, subject to the transition predicates below.
  A new generation never truncates or renumbers the capability chain.
- Artifact paths are normalized project-relative POSIX paths. Reject absolute,
  `..`, backslash, NUL/control/bidi, symlink, non-regular, out-of-root, and
  digest-mismatched inputs.
- Event files are at most 256 KiB; each directly bound artifact is at most
  8 MiB, with at most 128 bindings per event. A manifest is non-recursive,
  at most 256 KiB, contains 1–128 distinct regular-file entries, has nesting
  depth zero, and binds at most 32 MiB aggregate source bytes. A manifest may
  not name another manifest. Oversize, duplicate, or cyclic-looking input is
  rejected before artifact reads.
- Set arrays are bytewise sorted/unique. Union schemas reject unknown and
  state-inapplicable keys.
- Recording uses a same-directory 0600 temporary created with exclusive and
  no-follow flags, writes and fsyncs it, then publishes it with a same-filesystem
  hard-link-to-absent-final operation (`link`, never replacing), fsyncs the
  parent directory, and unlinks the temporary. A stale/concurrent append returns
  `REUSE_EVENT_CHAIN_CONFLICT`; it never overwrites.
- General recording and attempt reservation call the same `publishEvent`
  primitive. Each validates the current head, derives exactly `sequence+1`,
  and targets that fixed filename. `EEXIST` means another writer won and fails
  closed before any execution. Orphan `.tmp.<128-bit-random>` files are never
  events or authority; health fails closed until an owner-approved local
  reconciliation proves no final/active attempt, records their exact
  digests/disposition, and removes only those named temporary files.
- A receipt proves structurally valid recorded bytes only. It is not a
  signature, identity proof, owner authentication, upstream-freshness proof,
  or implementation authority.

### State-specific payloads

| State | Required payload/validation |
|---|---|
| `REUSE_GATE_REQUIRED` | Material trigger/reason, affected units, migration class (`new` or `owner-approved-unimplemented`), research authority, frozen ordinary/lifetime budgets, and `ScopeFreezeBinding` entries. Uncertainty maps here. |
| `REUSE_GATE_SATISFIED` | Exact-equivalence artifact, one stable selection anchor, the immediately preceding supersession event, and that event's pre-supersession equivalence head over the same objective/boundary. Similar prose fails. |
| `REUSE_GATE_NOT_APPLICABLE` | Concrete correction boundary/reason and explicit false values for architecture, authority, stored data, deployment/rollback, public behavior, material cost, external integration, and multiple-unit floors. True/unknown fails. |
| `RESEARCHING` | Worker assignment receipt or named `LOCAL_FALLBACK` evidence, frozen scope, authority, resolution method, and refresh reason. Read-only research only. |
| `OPTIONS_READY` | Research packet, option brief, rejected ledger, exact Adopt/Adapt/Compose/Build rows, source/license/provenance, freshness, comparison criteria, and scope-freeze digests. At least one path viable. |
| `CODEX_REVIEW` | Exact options digest and ordinary configured KStack review/gate artifacts that pass for it, plus the round-one clarification lock when applicable. This historical state name never narrows configured reviewers. |
| `OWNER_SELECTION_REQUIRED` | Full stable-ID question containing four dispositions, recommendation, objection, security/authority/lifecycle consequences, trial, blocked work, and exact Yes/No/Comment mappings. |
| `BUILD_SELECTED` | Locked decision/readback, answer form, Build option ID, options/rejected-ledger digests, native baseline, and scope-freeze digest. |
| `SELECTED_FOR_TRIAL` | Same owner bindings, mapped Adopt/Adapt/Compose option, exact contender revisions, and proposed KStack adapter boundary. Not qualification or implementation authority. |
| `TRIAL_DESIGN_APPROVED` | Selection; complete executable/build and license/notice closures; approved adapter/trial design and ordinary gate/user approval; fixed thresholds, fixtures, native baseline, isolation, abort, rollback. |
| `QUALIFYING` | Unique attempt ID/ordinal; trial design; exact inputs/artifacts/config/environment; thresholds/baseline; data class; authority; and retry delta after attempt 1. Production users/data require explicit approval plus risk acknowledgment. |
| `QUALIFIED_BASELINE` | Attempt; source/dependency/license closure; adapter/trial design; implementation artifact; config/environment; fixtures/results; comparison; rollback; qualification receipt; result `QUALIFIED`. |
| `NOT_QUALIFIED` | Attempt, failing checks/findings, retained evidence, rollback disposition, and rejected-ledger digest. Never falls through. |
| `INCONCLUSIVE` | Attempt, cause, retained evidence, rollback disposition, and exact retry delta. Advances only within budget. |
| `REDESIGN_REQUIRED` | Cause, rejected ledger, remaining paths or research refresh, and blocked work. |
| `REUSE_TRIAL_OWNER_DECISION_REQUIRED` | Exhausted count/budget, full attempt history, full Yes/No/Comment question, and separate abort/redesign, reviewed-alternative, or bounded-extra-attempt consequences. |
| `QUALIFICATION_ABORTED` | Active attempt, abort cause, termination/reconciliation evidence, retained outputs, rollback disposition, and proof no contender process or temporary baseline remains. |
| `GENERATION_SUPERSEDED` | Prior generation/head digest, exact stale/material trigger, changed live bindings, affected work, safe disposition of any active trial, and the next objective/boundary digest. |

Every artifact binding carries both source and immutable retained identities
from its first publication; immutable events never change class or acquire a
path later. Validation mode is derived, not stored: bindings in the current
generation's live objective, selected source/revision, license,
authority/trust, selection, adapter/composition, or qualification predicate,
including those reached through its current satisfied selection anchor, must
match both source and retained bytes. Other bindings in superseded generations,
completed attempts, rejected evidence, and unrelated scope freeze validate the
retained object only. A proposed change naming an old source as affected reads
the current source into a new binding and compares it; it never mutates the old
binding.

Migration uses this additional closed classification: every `ArtifactBinding`
nested in the immutable `MigrationReceipt` and in
`LineageComparison.prior` is retained-only; the comparison's
`proposedChange`, every binding in `LineageComparison.current`, and every other
binding used by the requested stage's live predicate are source-plus-retained.
The receipt's historical binding cannot substitute for the corresponding
current-lineage binding. A binding reached in two roles must satisfy the
stricter source-plus-retained mode; a binding not classified by these exhaustive
rules returns `REUSE_MIGRATION_MISMATCH`. A Markdown status, score alone,
silence, or latest-looking filename is never authority.

### Normative data contracts

All JSON accepted or emitted by this feature uses
`kstack-canonical-json/v1`. A duplicate-key-detecting parser accepts only
objects, arrays, strings, booleans, null, and integers in the JavaScript safe
integer range. It rejects floats, exponent notation, negative zero, invalid
UTF-8, unpaired surrogates, and non-NFC strings. Objects have unique keys sorted
by unsigned UTF-8 byte order. Integers use shortest base-10 form. Strings emit
raw NFC UTF-8 except `"`, `\`, and U+0000–U+001F, which use JSON's shortest
required escape with lowercase hex for `\u00xx`. Arrays preserve declared
order except fields explicitly typed `set<T>`, which are sorted by each
element's canonical bytes and reject duplicates. A document is its canonical
bytes followed by exactly one LF. Accepted candidate bytes must byte-equal that
canonical encoding; parsing never repairs and accepts noncanonical input.
Internally constructed output is canonicalized once before digest/publication.
Tests reject, rather than normalize, every noncanonical input.

`T?` below means a required key whose value is `T` or JSON null.
`set<T>[m..n]` is a canonically sorted unique array with inclusive bounds.

These reusable types are closed; every object rejects unknown keys:

| Type | Exact contract |
|---|---|
| `SafeId` | 1–128 ASCII bytes matching `[A-Za-z0-9][A-Za-z0-9._-]*` |
| `Sha256` | exactly 64 lowercase hexadecimal ASCII bytes |
| `uint16` / `uint32` / `uint53` | canonical non-negative integer bounded at 65535 / 4294967295 / 9007199254740991 |
| `Timestamp` | UTC RFC 3339 `YYYY-MM-DDTHH:mm:ss.sssZ`; real Gregorian date, years 1970–9999 |
| `RelPath` | 1–1024 NFC UTF-8 bytes, project-relative POSIX segments; no empty/`.`/`..` segment, backslash, colon-prefixed drive, leading slash, NUL, control, bidi-control, or trailing slash |
| `BoundedText` | NFC string, 1–16384 UTF-8 bytes unless a field gives a smaller bound |
| `GateStage` | `objective-ready|detailed-design|full-review|trial-design|trial-implementation|baseline-implementation|plan-change` |
| `OptionClass` | `Adopt|Adapt|Compose|Build` |
| `ReuseState` | exactly one of the 18 state names in the closed payload union |
| `Materiality8` | exactly `{architecture:boolean,authority:boolean,storedData:boolean,deploymentRollback:boolean,publicBehavior:boolean,materialCost:boolean,externalIntegration:boolean,multipleUnits:boolean}` |
| `Sequence` | integer 1–999999; final filename is exactly six zero-padded digits plus `.json` |
| `EventRef` | exactly `{generation:uint32,sequence:Sequence,eventId:SafeId,sha256:Sha256}` |
| `ArtifactBinding` | exactly `{sourcePath:RelPath,retainedPath:RelPath,sha256:Sha256,byteCount:uint53,role:SafeId}`; byteCount 0–8 MiB and retainedPath is exactly the capability/digest-derived evidence path. Every binding is snapshotted before its first event is published. |
| `ScopeFreezeBinding` | exactly `{itemId:SafeId,artifact:ArtifactBinding}`; validated in retained-only mode |
| `AuthorityGrant` | exactly `{action:SafeId,tier:"allow"|"ask"|"deny",ownerDecision:ArtifactBinding?}`; ask requires a decision, other tiers require null |
| `OwnerQuestion` | exactly `{questionId:SafeId,question:BoundedText,recommendedDisposition:SafeId,noDisposition:SafeId,commentRule:BoundedText,consequences:set<BoundedText>[3..8],blockedWork:set<SafeId>[1..128]}`; question <=32 KiB |
| `OwnerDecision` | exactly `{question:OwnerQuestion,answerForm:"yes"|"no"|"comment",verbatimAnswer:BoundedText,mappedDisposition:SafeId,readback:BoundedText,questionSha256:Sha256,readbackSha256:Sha256,recordedAt:Timestamp}`; readback <=32 KiB; Yes/No map exactly to the question and Comment preserves verbatim mapped meaning |
| `ProposedChange` | schema `kstack.reuse-proposed-change/v1`; exactly `{schema,threadId:SafeId,capabilityId:SafeId,generation:uint32,objective:ArtifactBinding,affectedUnits:set<SafeId>[1..128],changedBindings:set<ArtifactBinding>[0..128],materiality:Materiality8,rationale:BoundedText,ownerDecision:OwnerDecision?}`; <=256 KiB |
| `OptionRecord` | exactly `{optionId:SafeId,class:"Adopt"|"Adapt"|"Compose"|"Build",eligibility:"eligible"|"conditional"|"ineligible",sources:set<ArtifactBinding>[0..128],licenseEvidence:set<ArtifactBinding>[0..128],authority:set<AuthorityGrant>[1..32],rationale:BoundedText}`; Build has empty sources/licenseEvidence |
| `ThresholdRecord` | exactly `{checkId:SafeId,operator:"eq"|"ne"|"lt"|"lte"|"gt"|"gte",expectedInteger:uint53?,expectedDecimal:BoundedText?}`; exactly one expected value is non-null and decimal matches `0|[1-9][0-9]*([.][0-9]+)?` |
| `AbortDisposition` | exactly `{status:"not-started"|"completed"|"reconciled-blocked",evidence:set<ArtifactBinding>[0..128]}`; not-started requires empty evidence, other states require nonempty evidence |
| `AttemptRef` | exactly `{attemptId:SafeId,physicalOrdinal:uint16,qualifyingEvent:EventRef}` |
| `EvidenceManifest` | schema `kstack.reuse-evidence-manifest/v1`; exactly `{schema,manifestId:SafeId,entries:set<ArtifactBinding>[1..128],aggregateByteCount:uint53}`; <=256 KiB, aggregate equals entries and <=32 MiB, no manifest-role entry/nesting |
| `LineageIdentity` | exactly `{objectiveOutcome:ArtifactBinding,selectedMechanism:ArtifactBinding,composition:ArtifactBinding,architecture:ArtifactBinding,authorityBoundary:ArtifactBinding,securityPosture:ArtifactBinding,licenseBasis:ArtifactBinding,storageDataModel:ArtifactBinding,deploymentRollbackContract:ArtifactBinding,publicBehavior:ArtifactBinding,materialCost:ArtifactBinding,migrationModel:ArtifactBinding,qualificationBasis:ArtifactBinding,reviewBasis:ArtifactBinding,approvalIdentity:ArtifactBinding,ownerSelection:ArtifactBinding,rejectedOptionsLedger:ArtifactBinding,externalIntegrations:set<ArtifactBinding>[0..128],dependencyClosure:ArtifactBinding,affectedUnits:set<SafeId>[1..128]}`; each fixed field's role equals its key; an inapplicable predicate binds a canonical reviewed not-applicable artifact rather than null |
| `LineageComparison` | exactly `{proposedChange:ArtifactBinding,prior:LineageIdentity,current:LineageIdentity,materiality:Materiality8,uncertain:boolean,verdict:"exact-correction"|"required-generation"}`; exact-correction requires all eight false, uncertain false, and the equality algorithm below |
| `MigrationReceipt` | schema `kstack.reuse-migration/v1`; exactly `{schema,threadId:SafeId,capabilityId:SafeId,objective:ArtifactBinding,design:ArtifactBinding,approval:ArtifactBinding,implementationOrRelease:ArtifactBinding,class:"implementation-started"|"shipped",lineageBoundary:BoundedText,ownerDecision:OwnerDecision,historicalEvidence:set<ArtifactBinding>[1..128],recordedAt:Timestamp}`; every nested artifact is historical/retained-only and document <=256 KiB; result threadId comes only from this field and must equal `ProposedChange.threadId` when a change is supplied |

The earlier state table is a readability summary only. The following tables
are the exhaustive closed payload union; every key shown is required and no
other key is accepted:

| State | Exact payload object |
|---|---|
| `REUSE_GATE_REQUIRED` | `{trigger:BoundedText,reason:BoundedText,affectedUnits:set<SafeId>[1..128],migrationClass:"new"|"owner-approved-unimplemented",researchAuthority:set<AuthorityGrant>[1..32],scopeFreeze:set<ScopeFreezeBinding>[0..128],materiality:Materiality8,frozenOrdinaryBudget:uint16,frozenLifetimeCap:uint16}`; both budgets resolve from config at generation creation, ordinary <= lifetime, and at least one floor true or trigger states uncertainty |
| `REUSE_GATE_SATISFIED` | `{equivalenceProof:ArtifactBinding,selectionAnchor:EventRef,supersession:EventRef,priorEquivalenceHead:EventRef,priorObjective:ArtifactBinding,priorBoundarySha256:Sha256,materiality:Materiality8,scopeFreeze:set<ScopeFreezeBinding>[0..128]}`; all eight false; anchor is a still-usable `BUILD_SELECTED` or `QUALIFIED_BASELINE`; supersession is the immediately preceding `GENERATION_SUPERSEDED`; priorEquivalenceHead byte-equals that supersession payload's priorHead and is either the anchor or a satisfied event carrying the identical anchor |
| `REUSE_GATE_NOT_APPLICABLE` | `{correctionBoundary:BoundedText,reason:BoundedText,materiality:Materiality8,scopeFreeze:set<ScopeFreezeBinding>[0..128]}`; all eight false and no prior usable selection is reused |
| `RESEARCHING` | `{assignment:ArtifactBinding,mode:"worker"|"LOCAL_FALLBACK",scopeFreeze:set<ScopeFreezeBinding>[0..128],authority:set<AuthorityGrant>[1..32],resolutionMethod:"authoritative-upstream"|"qualified-cache",refreshReason:BoundedText?}` |
| `OPTIONS_READY` | `{researchPacket:ArtifactBinding,optionBrief:ArtifactBinding,rejectedLedger:ArtifactBinding,options:set<OptionRecord>[4..4],sourceLicenseManifest:ArtifactBinding,freshness:"current",comparisonCriteria:ArtifactBinding,scopeFreezeSha256:Sha256}`; exactly one of each class and at least one eligible/conditional |
| `CODEX_REVIEW` | `{options:ArtifactBinding,reviewGate:ArtifactBinding,clarificationLock:ArtifactBinding?}`; reviewGate proves ordinary configured routing passed |
| `OWNER_SELECTION_REQUIRED` | `{question:OwnerQuestion,options:ArtifactBinding,rejectedLedger:ArtifactBinding}` |
| `BUILD_SELECTED` | `{decision:OwnerDecision,optionId:SafeId,optionClass:"Build",options:ArtifactBinding,rejectedLedger:ArtifactBinding,nativeBaseline:ArtifactBinding,scopeFreezeSha256:Sha256}` |
| `SELECTED_FOR_TRIAL` | `{decision:OwnerDecision,optionId:SafeId,optionClass:"Adopt"|"Adapt"|"Compose",options:ArtifactBinding,rejectedLedger:ArtifactBinding,contenders:set<ArtifactBinding>[1..128],adapterBoundary:BoundedText,scopeFreezeSha256:Sha256}` |
| `TRIAL_DESIGN_APPROVED` | `{selection:EventRef,dependencyLicenseClosure:ArtifactBinding,trialDesign:ArtifactBinding,designGate:ArtifactBinding,ownerApproval:OwnerDecision,thresholds:set<ThresholdRecord>[1..128],fixtures:EvidenceManifest,nativeBaseline:ArtifactBinding,isolation:ArtifactBinding,abortPlan:ArtifactBinding,rollbackPlan:ArtifactBinding}` |
| `QUALIFYING` | `{attemptId:SafeId,physicalOrdinal:uint16,trialDesign:ArtifactBinding,inputs:EvidenceManifest,implementationArtifacts:EvidenceManifest,config:ArtifactBinding,environment:ArtifactBinding,thresholds:set<ThresholdRecord>[1..128],nativeBaseline:ArtifactBinding,dataClass:"development"|"production-no-user-data"|"production-user-data",authority:set<AuthorityGrant>[1..32],retryDelta:ArtifactBinding?,extraAttemptDecision:OwnerDecision?}`; both budgets are derived only from the generation's first required event |
| `QUALIFIED_BASELINE` | `{attempt:AttemptRef,sourceClosure:ArtifactBinding,dependencyLicenseClosure:ArtifactBinding,adapterTrialDesign:ArtifactBinding,implementationArtifact:ArtifactBinding,config:ArtifactBinding,environment:ArtifactBinding,fixturesResults:EvidenceManifest,comparison:ArtifactBinding,rollback:AbortDisposition,qualificationReceipt:ArtifactBinding,result:"QUALIFIED"}` |
| `NOT_QUALIFIED` | `{attempt:AttemptRef,failedChecks:ArtifactBinding,securityFindings:ArtifactBinding,retainedEvidence:EvidenceManifest,rollback:AbortDisposition,rejectedLedger:ArtifactBinding,result:"NOT_QUALIFIED"}` |
| `INCONCLUSIVE` | `{attempt:AttemptRef,cause:BoundedText,retainedEvidence:EvidenceManifest,rollback:AbortDisposition,retryDelta:ArtifactBinding,result:"INCONCLUSIVE"}` |
| `REDESIGN_REQUIRED` | `{cause:BoundedText,rejectedLedger:ArtifactBinding,remainingOptions:set<SafeId>[0..4],researchRefresh:ArtifactBinding?,blockedWork:set<SafeId>[1..128]}` |
| `REUSE_TRIAL_OWNER_DECISION_REQUIRED` | `{consumedPhysicalAttempts:uint16,attemptHistory:set<AttemptRef>[1..20],question:OwnerQuestion}`; consumed count equals all generation `QUALIFYING` events; question text states the chain-derived ordinary budget, lifetime cap, and exact next ordinal but does not become a budget carrier |
| `QUALIFICATION_ABORTED` | `{attempt:AttemptRef,cause:BoundedText,terminationEvidence:EvidenceManifest,retainedOutputs:EvidenceManifest,rollback:AbortDisposition,noProcessRemains:boolean}`; boolean must be true with evidence |
| `GENERATION_SUPERSEDED` | `{priorGeneration:uint32,priorHead:EventRef,trigger:BoundedText,changedLiveBindings:set<ArtifactBinding>[0..128],affectedWork:set<SafeId>[1..128],activeTrialDisposition:AbortDisposition,nextObjective:ArtifactBinding,nextBoundarySha256:Sha256,nextDisposition:"required"|"satisfied"|"not-applicable"}` |

For every `QUALIFYING`, `physicalOrdinal` equals one plus the count of all prior
`QUALIFYING` events in this generation regardless of option. The evaluator
walks to the generation's first `REUSE_GATE_REQUIRED` and derives its sole
`frozenLifetimeCap` and `frozenOrdinaryBudget`; ordinal may not exceed the
former. No later event carries or overrides either budget. Ordinal 1 requires
null retry/extra decision; budget-like text or bound config bytes in a later
event are informational evidence and never an authority source. Later ordinary
budget retries require non-null retryDelta and null extra decision; attempts
above ordinary budget require both retryDelta and the exact one-ordinal owner
decision. Production-user-data requires an ask-tier authority decision whose
question states the risk. Missing, extra, state-inapplicable, noncanonical,
wrong-generation, or unretained historical bytes fail closed.

All generation/sequence values begin at 1. Ordinary budget and lifetime cap
are 1–20; consumed count is 1–20 and cannot exceed cap; attempt histories have
exactly consumed-count entries. Every `schema` key equals the literal named by
its type row. Every nullable field is present even when null.

`reuse-event/v1` is the common envelope shown above plus exactly one closed
payload variant selected by `state`. Every payload field named in the
state-specific table is required, uses the types above, and has these
cross-field rules: all digests identify included bindings; option class is
exactly `Adopt|Adapt|Compose|Build`; attempt ordinal is uint16 in
1..frozen lifetime cap; attempt ID is unique within the capability chain;
thresholds are safe integers or finite decimal strings named by their owning
test; data class is `development|production-no-user-data|production-user-data`;
production-user-data requires an `OwnerDecision` whose question states the
risk; result is exactly `QUALIFIED|NOT_QUALIFIED|INCONCLUSIVE`; and every
rollback/abort disposition is `not-started|completed|reconciled-blocked` with
evidence required for the latter two. A state-inapplicable field, missing
field, extra field, wrong generation, or live binding to an absent byte stream
fails closed.

Stable `ReasonCode` is one of:
`REUSE_CONFIG_INVALID`, `REUSE_STATE_MISSING`, `REUSE_STATE_MALFORMED`,
`REUSE_EVENT_CHAIN_CONFLICT`, `REUSE_EVENT_TRANSITION_INVALID`,
`REUSE_BINDING_STALE`, `REUSE_PATH_UNSAFE`, `REUSE_IO_GUARANTEE_UNAVAILABLE`,
`REUSE_EVIDENCE_LIMIT_EXCEEDED`, `REUSE_OWNER_DECISION_REQUIRED`,
`REUSE_ATTEMPT_BUDGET_EXHAUSTED`, `REUSE_ATTEMPT_LIFETIME_EXHAUSTED`,
`REUSE_ATTEMPT_ACTIVE`, `REUSE_MIGRATION_MISMATCH`,
`REUSE_QUALIFICATION_REQUIRED`, `REUSE_FULL_DESIGN_REQUIRED`, or
`REUSE_UNKNOWN_STAGE`, or `REUSE_SEQUENCE_EXHAUSTED`. No free-form source
content appears in `reasons`.

### Allowed transitions

```text
START -> REUSE_GATE_REQUIRED | REUSE_GATE_NOT_APPLICABLE
REUSE_GATE_REQUIRED -> RESEARCHING
RESEARCHING -> OPTIONS_READY
OPTIONS_READY -> CODEX_REVIEW
CODEX_REVIEW -> OWNER_SELECTION_REQUIRED
OWNER_SELECTION_REQUIRED -> BUILD_SELECTED | SELECTED_FOR_TRIAL |
                            REDESIGN_REQUIRED
SELECTED_FOR_TRIAL -> TRIAL_DESIGN_APPROVED
TRIAL_DESIGN_APPROVED -> QUALIFYING
QUALIFYING -> QUALIFIED_BASELINE | NOT_QUALIFIED | INCONCLUSIVE
NOT_QUALIFIED -> REDESIGN_REQUIRED | OWNER_SELECTION_REQUIRED
INCONCLUSIVE -> QUALIFYING | REUSE_TRIAL_OWNER_DECISION_REQUIRED
REUSE_TRIAL_OWNER_DECISION_REQUIRED -> QUALIFYING |
                                       OWNER_SELECTION_REQUIRED |
                                       REDESIGN_REQUIRED
REDESIGN_REQUIRED -> RESEARCHING | OWNER_SELECTION_REQUIRED
QUALIFYING -> QUALIFICATION_ABORTED (validated staleness or reconciled abort)
QUALIFICATION_ABORTED -> GENERATION_SUPERSEDED
ANY_STATE_EXCEPT_QUALIFYING_OR_GENERATION_SUPERSEDED
  -> GENERATION_SUPERSEDED (only with a validated new-generation trigger)
GENERATION_SUPERSEDED -> REUSE_GATE_REQUIRED | REUSE_GATE_SATISFIED |
                         REUSE_GATE_NOT_APPLICABLE
```

The two non-required dispositions terminate only their objective/boundary
generation. Generation 1 cannot be satisfied because it has no prior
same-capability selection. A later objective/boundary refresh first appends
`GENERATION_SUPERSEDED`: any material or uncertain delta requires
`nextDisposition:required` and `REUSE_GATE_REQUIRED`; an all-eight-false exact
equivalence to the still-usable selection anchor carried by the immediately
prior generation's pre-supersession equivalence head uses `satisfied`; an
all-eight-false correction with no reusable selection uses
`not-applicable`. `REUSE_GATE_SATISFIED` carries one stable `selectionAnchor`
back to the actual selected event. Its `supersession` byte-equals the
immediately preceding chain event, which must be `GENERATION_SUPERSEDED` with
`nextDisposition:satisfied`; its `priorEquivalenceHead` byte-equals that
supersession event's `priorHead`. For the first satisfied generation,
`priorEquivalenceHead` equals the anchor. For every later satisfied generation,
it references the preceding generation's `REUSE_GATE_SATISFIED`, whose anchor
is byte-identical. The evaluator follows supersession -> priorEquivalenceHead
at every generation hop, then reaches the selected event, revalidates its
current source/authority/license/qualification predicates, and rejects a
missing/non-immediate supersession, wrong priorHead, gap, changed anchor,
unusable selection, or material/uncertain delta. Filenames or cross-capability
search never select an anchor.

The staleness transition is exhaustive: `REUSE_GATE_REQUIRED`, `RESEARCHING`,
`OPTIONS_READY`, `CODEX_REVIEW`, `OWNER_SELECTION_REQUIRED`, `BUILD_SELECTED`,
`SELECTED_FOR_TRIAL`, `TRIAL_DESIGN_APPROVED`, `QUALIFIED_BASELINE`,
`NOT_QUALIFIED`, `INCONCLUSIVE`, `REDESIGN_REQUIRED`,
`REUSE_TRIAL_OWNER_DECISION_REQUIRED`, `REUSE_GATE_SATISFIED`, and
`REUSE_GATE_NOT_APPLICABLE` may append `GENERATION_SUPERSEDED` for a validated
new objective/boundary generation. A nonterminal or stale current generation
can choose only required; satisfied additionally requires a still-usable prior
selection, all eight false, and exact equivalence. `QUALIFYING` must first append
`QUALIFICATION_ABORTED`; failure to prove termination, reconciliation, and
rollback leaves the capability blocked. Supersession cancels unused ordinals,
never transfers budget, and never converts an old selection into a new one.

`BUILD_SELECTED`, `SELECTED_FOR_TRIAL`, and `QUALIFIED_BASELINE` are usable only
while their bindings remain current. A changed objective or a bound refresh
showing changed selected source/content, dependency closure, license basis,
security posture, boundary, authority/trust boundary, composition, material
cost, migration model, qualification basis, review/approval, owner selection,
or rejected-options identity returns `REUSE_GATE_STALE`. The next valid append follows the supersession protocol
above; history is never overwritten.

Native `BUILD_SELECTED` needs no external trial but still requires ordinary
detailed-design and implementation approval. `SELECTED_FOR_TRIAL` permits only
trial design. Only `QUALIFIED_BASELINE` permits an external/composed production
baseline, still subject to ordinary authority/design/implementation/QC gates.

## 6. Evaluator interface and fail-closed results

```bash
node <plugin-root>/scripts/kstack-reuse-gate.mjs check \
  --project-root <root> --objective <relative-path> --capability-id <id> \
  --stage <objective-ready|detailed-design|full-review|trial-design|trial-implementation|baseline-implementation|plan-change> \
  [--proposed-change <relative-json>] [--out <relative-json>]

node <plugin-root>/scripts/kstack-reuse-gate.mjs record \
  --project-root <root> --candidate <relative-event-json>

node <plugin-root>/scripts/kstack-reuse-gate.mjs reserve-attempt \
  --project-root <root> --objective <relative-path> --capability-id <id> \
  --candidate <relative-qualifying-event-json>
```

`check` is read-only unless `--out` is supplied; `record` performs only an
authorized local append. `reserve-attempt` is the sole operation permitted to
append `QUALIFYING`; it does not execute the trial. No general `record` call
may append that state. None of the operations fetches, installs, executes, or
imports a contender; invokes a model; opens credentials; or performs Git,
Jira, network, deploy, or device work.

The Node layer invokes only the digest-pinned native helper's closed commands:
`probe`, `read`, `snapshot`, and `publish`. The helper accepts a pre-opened root
handle plus normalized components, never a shell or arbitrary command. `read`
walks one component at a time relative to the prior directory handle, rejects
links/reparse points and non-regular finals, reads from the verified handle,
then revalidates identity/size/link count before returning bytes and identity.
`snapshot` copies those handle bytes to the digest-derived retained path.
`publish` creates a 0600 temporary exclusively, fsyncs it, creates the one
fixed absent final link atomically, fsyncs the directory, then unlinks the
temporary. It never replaces.

Linux uses `openat2` with `RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|
RESOLVE_NO_MAGICLINKS`, `O_NOFOLLOW`, `fstat`, `linkat`, and `fsync`. macOS/BSD
uses component-wise `openat(O_NOFOLLOW)`, `fstatat(AT_SYMLINK_NOFOLLOW)`,
`linkat`, and `fsync`, with pre/post device/inode revalidation. Windows uses
handle-relative `NtCreateFile` with a held `RootDirectory`,
`OBJ_DONT_REPARSE`, and no-follow/open-reparse semantics; verifies volume/file
ID and reparse tag; and publishes with handle-relative
`FileLinkInformationEx` with replace disabled plus directory flush. Backend
build identity and each required primitive are probed at startup; missing or
weaker semantics fail `REUSE_IO_GUARANTEE_UNAVAILABLE` with no fallback.

The state/results directories must be owned by effective UID and mode 0700 on
POSIX; files are 0600; group/world write or an ACL granting another principal
write/delete fails. Windows DACL must grant write/delete only to the current
user SID, Administrators, and SYSTEM, with inheritance resolved and no
write/delete ACE for another SID. Input regular files with link count other
than one are rejected unless they are an already-verified retained object
published by this helper and currently link count one. State/input filesystem
identity must remain constant across the operation. Version 1 unconditionally
denies 9p, network, FUSE, and every remote/userspace filesystem; config or an
owner acknowledgment cannot override that deny.

Every allowed local target must match one vendored
`kstack.reuse-io-profile/v1` byte-for-byte by profile digest. The closed profile
is exactly `{schema,profileId,helperSha256,osFamily,osVersion,osBuild,arch,
filesystemType,filesystemDriverVersion,volumeFeatures,mountOptions,
requiredPrimitives,qualificationHarnessSha256,qualificationReportSha256,
qualifiedAt}`. Strings are 1–256 ASCII except typed IDs/digests/timestamp;
features/options are sorted unique sets of 0–128 strings. `requiredPrimitives`
is exactly `{handleRelativeOpen:true,noSymlinkOrReparse:true,
identityRevalidation:true,singleLinkInput:true,atomicNoReplaceLink:true,
fileFlush:true,directoryFlush:true,ownerAclEnforced:true,
crashRecoveryQualified:true}`.

The hash-pinned target qualification harness tests ancestor/final swaps,
links/reparse points, hard-link input, ACL/mode rejection, two-process
same-final publication, crash injection before write and after every write/
flush/link/unlink boundary, restart reconciliation, and volume/remount drift.
Its report binds every observed result and exact OS build, filesystem driver,
mount/volume features, helper, and harness. Startup does not claim to re-prove
crash durability: `probe` verifies helper self-digest and exact runtime tuple
against a vendored qualified profile, then reruns non-destructive primitive,
ACL, and identity checks in a fresh state-tree probe directory. Any unknown or
mismatched OS/build, filesystem/driver, feature, mount option, ACL semantic,
directory-flush behavior, helper digest, or primitive blocks. With no exact
qualified profile, return `CAPABILITY_REQUIREMENTS_UNMET` without touching
state; the gate reason is `REUSE_IO_GUARANTEE_UNAVAILABLE`.

`--out` accepts only a normalized absent child of
`.kstack/reuse-results/<capability-id>/`, never an arbitrary project path. It
uses the same 0600 temporary, fsync, atomic no-replace publication, and parent
sync contract. Existing targets, links, unsafe ancestors, and unsupported
durability return a stable failure without overwrite.

Result schema:

```json
{
  "schema":"kstack.reuse-gate-result/v1",
  "kind":"chain",
  "status":"REUSE_GATE_ALLOW",
  "stage":"detailed-design",
  "threadId":"safe-id",
  "capabilityId":"safe-id",
  "generation":1,
  "objectiveSha256":"64-lower-hex",
  "currentState":"BUILD_SELECTED",
  "currentEventSha256":"64-lower-hex",
  "selectedOptionClass":"Build",
  "qualificationSha256":null,
  "migrationReceiptSha256":null,
  "lineageComparisonSha256":null,
  "reasons":[]
}
```

The closed grandfathered variant has exactly:

```json
{
  "schema":"kstack.reuse-gate-result/v1",
  "kind":"migration",
  "status":"REUSE_GATE_ALLOW",
  "stage":"baseline-implementation",
  "threadId":"safe-id",
  "capabilityId":"safe-id",
  "generation":null,
  "objectiveSha256":"64-lower-hex",
  "currentState":null,
  "currentEventSha256":null,
  "selectedOptionClass":null,
  "qualificationSha256":null,
  "migrationReceiptSha256":"64-lower-hex",
  "lineageComparisonSha256":"64-lower-hex",
  "reasons":[]
}
```

The examples instantiate this exhaustive tagged union. Every variant has
exactly `{schema,kind,status,stage,threadId,capabilityId,generation,
objectiveSha256,currentState,currentEventSha256,selectedOptionClass,
qualificationSha256,migrationReceiptSha256,lineageComparisonSha256,reasons}`.
`schema` is the literal above; `stage` is `GateStage?`; digest fields are
`Sha256?`; ID fields are `SafeId?`; generation is `uint32?`; currentState is
`ReuseState?`; selectedOptionClass is `OptionClass?`; and reasons is a sorted
unique `set<ReasonCode>[0..32]`.

- `kind:chain` is allow-only: status allow; non-null thread/capability,
  stage, generation, objective, state, and event; migration fields null; reasons
  empty. Option class is non-null only for selected/qualified states and
  qualification digest only for qualified baseline.
- `kind:migration` is allow-only: status allow; non-null thread/capability,
  stage, objective, migration receipt, and lineage comparison; every chain/
  selection/qualification field null; reasons empty. Its threadId is copied
  only from validated `MigrationReceipt.threadId` and, when present, must equal
  `ProposedChange.threadId`. It cannot claim selection.
- `kind:failure` has non-allow status, reasons length 1–32, and every other
  nullable field populated only if validated before failure. Missing/malformed
  config or state may therefore return all identity/digest/state fields null.
  A non-null currentEvent requires non-null capability/generation/state; a
  non-null migration receipt requires non-null capability/objective and may
  bind a comparison only if that comparison parsed and validated. `stage` is
  null if and only if reasons is exactly `["REUSE_UNKNOWN_STAGE"]`; that error
  is returned before reading state and never echoes the untrusted requested
  stage. Every other failure carries the validated non-null `GateStage` input.

Unknown/missing keys, an allow with reasons, a failure without reasons, or a
cross-variant nullability violation is `REUSE_STATE_MALFORMED`. No migration
result can claim selection or qualification.

Statuses are `REUSE_GATE_ALLOW`, `REUSE_GATE_BLOCKED`, `REUSE_GATE_STALE`,
`REDESIGN_REQUIRED`, and `REUSE_TRIAL_OWNER_DECISION_REQUIRED`. Only allow
exits zero; all others exit 2 with stable, non-secret reason codes. Invalid
config/state, missing/unsafe files, unknown stage/state, stale digests, partial
chains, exhausted budgets, and ambiguous migration fail closed.

This is the sole normative stage-by-kind table. Section 10 routes migration
classes to a result kind but does not restate or alter any allow predicate:

| Stage | `kind:chain` allow predicate | `kind:migration` allow predicate |
|---|---|---|
| `objective-ready` | Current generation initial required/not-applicable, or later satisfied disposition | Exact receipt plus canonical no-change comparison |
| `detailed-design` | Current Build, selected-for-trial, qualified baseline, satisfied, or not-applicable; trial selection can design only adapter/trial and qualified baseline permits the external/composed production design | Receipt plus proposed change and recomputed exact-correction comparison |
| `full-review` | Same chain predicate as detailed design, bound into the ordinary review packet | Receipt, proposed change, and exact-correction comparison bound into review |
| `trial-design` | Current selected-for-trial only | Always blocked; grandfathering never authorizes a trial |
| `trial-implementation` | Current already-published Qualifying lease and exact attempt ID/ordinal only | Always blocked |
| `baseline-implementation` | Current Build or qualified baseline, plus ordinary approved-design bindings | Receipt plus proposed change and exact-correction comparison over prior/proposed implementation bytes, plus source-plus-retained `current.architecture` and `current.approvalIdentity` that bind the exact ordinary approved design |
| `plan-change` | Current chain plus canonical proposed change; changed strategy/revision/license/authority/security/composition/cost/migration/qualification/review/approval/owner selection or uncertainty requires design | Receipt plus proposed change and recomputed exact-correction comparison |

Every non-allow cell returns `kind:failure`. `trial-implementation` obtains its
lease only through `reserve-attempt`; a read-only check never reserves
authority. No stage falls from one kind to the other, and this table and the
class-to-kind routing in §10 are one policy layer rather than duplicate
predicate definitions.

`reserve-attempt` uses the shared fixed-sequence `publishEvent` transaction:
it validates the complete chain and live bindings; accepts predecessor
`TRIAL_DESIGN_APPROVED` for the next generation-wide physical ordinal,
`INCONCLUSIVE` within ordinary budget,
or `REUSE_TRIAL_OWNER_DECISION_REQUIRED` with an exact owner decision for one
named next ordinal; verifies the retry delta; verifies no attempt is active;
walks to the first required event, derives both frozen budgets, rejects current
config drift, and checks the ordinary budget and non-renewable lifetime cap;
and atomically publishes `QUALIFYING` before returning its digest. A retry from
the owner-decision state must bind the full question, verbatim answer, mapped
disposition, readback, and exact ordinal. A different ordinal, repeated answer,
config-only increase, or ordinal above the lifetime cap fails. Once
`QUALIFYING` exists, execution may start; a crash leaves an active blocked
lease until a result or reconciled `QUALIFICATION_ABORTED` event is recorded.

## 7. Phase integration

### `kstack-objectives`

After grounding but before declaring readiness, load `REUSE_FIRST.md`, bind
objective/capability/units/baseline/non-goals/success/data/research authority
and frozen identities, then record exactly one disposition for the current
generation. Generation 1 permits required or strict not-applicable only.
Material, new, replacement, external, or uncertain work is required. A later
generation may use satisfied only through the exact supersession/equivalence
topology above. Run
`objective-ready`; a blocked result makes the objective blocked, not “ready
with risks.” Proposed mechanisms remain candidates only.

### `kstack-design`

Before design lanes, detailed architecture, implementation sequence, item
ledger, or any new remediation round, run `detailed-design` for the affected
capability and current objective bytes.

If only required, enter **option-selection mode**. That mode may research,
build the neutral packet, compare four strategies, maintain the rejected
ledger, run the ordinary configured KStack review over the exact option brief,
complete ordinary round-one clarification when applicable, and relay the full
owner question. It may not produce chosen detailed architecture as though a
selection existed. The existing design gate—not a new reviewer route—must be
`READY_FOR_USER_APPROVAL` for the exact options brief before `CODEX_REVIEW`;
every current configured reviewer remains required.

After full owner readback, append `BUILD_SELECTED` or `SELECTED_FOR_TRIAL`,
rerun preflight, and start a separate ordinary detailed-design thread limited
to the selected option. Later briefs bind objective, selected event, research,
options, rejected ledger, selected sources, and scope freeze. Trial design also
binds complete dependency/license closure. External/composed production design
also binds qualification. Re-run preflight before each new detailed-design or
remediation item; staleness blocks only this capability.

### `kstack-design-clarify`

Load/cite the current selection during extraction and scope alignment. Treat it
as authoritative and map mechanisms to it. Do not repeat the selection
question. Ask only genuinely new disagreement, hedge, unverified assumption,
objective divergence, or conflicting evidence. A real conflict requires a
linked superseding owner decision and reuse events; it cannot be silently
re-litigated in clarification.

### `kstack-interrogate`

Bind current selection/source/qualification and a bounded proposed-change
record; run `plan-change` before reviewer classification. Changed strategy,
revision, license, authority/trust, composition, migration, qualification, or a
security/cost/review/approval/owner-selection predicate, or a new missing
subsystem returns `FULL_DESIGN_REQUIRED` with reuse refresh first.
An exact bug correction inside the approved option remains ordinary
Interrogation/QC. Uncertainty is material; never relabel a missing subsystem a
bug to bypass the gate.

### `kstack-implement` and `kstack-review`

Implementation runs `baseline-implementation` in addition to the current exact
design-gate checks and verifies the approved design binds the current reuse
event. Build passes without external trial; Adopt/Adapt/Compose fails without
qualification. Trial execution uses `trial-implementation` and cannot claim
production implementation.

Full review runs objective preflight, routes option-selection before ordinary
Stage 3, and carries the current result plus its exact chain or migration
evidence into readiness/transition. It cannot report
`READY` or hand off while reuse is blocked/stale.

### Worker-first orchestration

Research, review, question relay, status, capacity, retry, collision, and
fallback follow canonical `ORCHESTRATION.md` after its separately approved
implementation lands. Reuse-first adds capability states/artifacts only. A
capability-scoped worker owns evidence; a separate configured reviewer receives
the frozen brief; root schedules/displays/reconciles and relays full
Yes/No/Comment. One blocked capability does not stop unrelated workers.

Existing orchestration performs bounded validation, a short configured timeout,
and finite safe retries before relaying failure. Ambiguous dispatch or possible
side effect requires reconciliation, never automatic retry. Main fallback is
named and never disguised as a worker.

## 8. Research, license, and trust boundaries

`REUSE_FIRST.md` carries forward the locked contract:

- resolve live contenders from authoritative upstream after objective digest;
  record immutable revision/ref/time/repository digest, exact implementation
  and test paths, and raw-byte digests;
- record observed host/runtime behavior, maintenance, SPDX/license path/digest,
  notices, exceptions, dependency boundaries, and generated provenance;
- label observed, inferred, unavailable, and unverified claims;
- include the strongest credible candidates, not gstack alone, plus native;
- make `UNVERIFIED` freshness ineligible as a selected dependency while
  leaving evidenced Build available;
- before trial approval bind complete executable/build dependency closure,
  lock graph, fetched/vendored artifacts and licenses, build scripts/toolchain,
  optional features, and reproducible reconstruction command/manifest; and
- never let a score erase safety, authority, license, provenance, or evidence
  failure.

Repository content, issues, docs, model output, and marketplace data are
untrusted evidence, never instructions. The evaluator verifies local bindings;
it cannot claim the internet was searched or upstream remains current.

## 9. Owner selection and attempt handling

The question names stable ID, capability/objective digest, all four options,
recommendation/evidence, strongest objection, security/authority/lifecycle
tradeoffs, trial, blocked work, and exact mappings:

- **Yes:** only the explicitly recommended option.
- **No:** only one explicitly named safe fallback.
- **Comment:** exact owner alternative/combination/narrowing/rejection/change.

The decision stores full question, verbatim answer, exact mapping, selected
revisions, accepted risks, rejected-ledger digest, and scope freeze. Root shows
the complete readback then proceeds unless corrected under
`W3-Q-READBACK-ACK`; no second acknowledgment is required. Silence, score,
reviewer vote, or shorthand never selects.

Attempts use unique IDs and ordinals and are created only by the transactional
reservation protocol in §6. Inconclusive retry requires a specific delta and
remaining ordinary budget. Exhaustion requires the full owner question; its
Yes path authorizes exactly one stated next ordinal, No maps to the named
abort/redesign path, and Comment preserves a reviewed alternative. Every
extra-attempt question displays the exact chain-derived frozen lifetime cap and
remaining ordinals; its text is not a budget carrier. The decision cannot renew,
replace, or create a second cap. Config editing,
repeating an ID/readback, selecting another reviewed option, or selecting a
non-next ordinal does not reset the consumed count or authorize a reused
ordinal. Not-qualified updates history and returns to redesign/selection. No
failure weakens a check or falls through.

## 10. Migration

1. `new` and `owner-approved-unimplemented` material work requires the gate
   before its next detailed design/remediation or implementation handoff. Prior
   approval remains evidence, not selection.
2. `implementation-started` and `shipped` use a separate immutable
   `kstack.reuse-migration/v1` receipt under `.kstack/reuse-migrations/`, bound
   to objective/design/approval digests and concrete pre-gate implementation
   or release evidence. They do not fabricate a selection event. The receipt
   permits only the exact already-started/shipped lineage; a later replacement,
   newly added subsystem, or other material delta creates a new required chain.
3. A prior review substitutes only through a current exact-equivalence record
   proving every field and binding sources, review, owner mapping, rejected
   ledger, and qualification where applicable.
4. Validated unrelated items are content-addressed freeze identities, not
   mutable filesystem locks. Other legitimate work does not stale this chain.
   Reuse events cannot mark them affected/weakened/superseded/re-reviewed
   without a separate material proposal and owner direction.

Migration never rewrites an old decision, rejection, result, or attempt.

Migration class selects exactly one result kind; every stage then uses the sole
normative table in §6:

| Migration class | Required result kind | Additional routing invariant |
|---|---|---|
| `new` | `kind:chain` | First generation must record required or strict not-applicable; it never uses a grandfather receipt |
| `owner-approved-unimplemented` | `kind:chain` | Prior approval is evidence only; current chain predicates govern every stage |
| `implementation-started` | `kind:migration` | Exact receipt class and source-plus-retained current implementation lineage must match |
| `shipped` | `kind:migration` | Exact receipt class and source-plus-retained current shipped lineage must match |

No class row supplies a stage allow predicate. In particular, new and
owner-approved-unimplemented full review use the §6 chain cell, and both
migration baseline classes use the §6 migration cell including its ordinary
approved-design requirement. A migration request for `trial-design` or
`trial-implementation` reaches the normative always-blocked migration cell;
starting such a trial requires a new chain generation.

A grandfather receipt never manufactures `BUILD_SELECTED`,
`SELECTED_FOR_TRIAL`, or `QUALIFIED_BASELINE`, never authorizes a trial, and
never crosses capability or generation. Every stage rechecks its live lineage
bindings. Exact historical evidence remains historical; a claimed change to
it is evaluated as a live proposed-change predicate. Ambiguity or a missing
class/stage route returns `REUSE_MIGRATION_MISMATCH`, never ordinary allow.

For migration, `exact-correction` is mechanical. The evaluator compares the
complete canonical bytes—not only `sha256`—of each fixed `ArtifactBinding` in
`prior` and `current`: `objectiveOutcome`, `selectedMechanism`, `composition`,
`architecture`, `authorityBoundary`, `securityPosture`, `licenseBasis`,
`storageDataModel`, `deploymentRollbackContract`, `publicBehavior`,
`materialCost`, `migrationModel`, `qualificationBasis`, `reviewBasis`,
`approvalIdentity`, `ownerSelection`, `rejectedOptionsLedger`, and
`dependencyClosure`. It separately compares the complete canonical bytes of
the `externalIntegrations` and `affectedUnits` sets. Each current binding is
source-plus-retained; each prior binding is retained-only; field roles must
equal field names. A missing, extra, changed, stale, or unclassifiable identity
is unequal.

The evaluator recomputes `Materiality8` without trusting supplied booleans,
using this exhaustive, non-overlapping identity-to-floor mapping:

| Floor | Identity inputs whose inequality makes it true |
|---|---|
| `architecture` | `selectedMechanism`, `composition`, `architecture`, `migrationModel`, `qualificationBasis`, `rejectedOptionsLedger`, `dependencyClosure` |
| `authority` | `authorityBoundary`, `securityPosture`, `licenseBasis`, `reviewBasis`, `approvalIdentity`, `ownerSelection` |
| `storedData` | `storageDataModel` |
| `deploymentRollback` | `deploymentRollbackContract` |
| `publicBehavior` | `objectiveOutcome`, `publicBehavior` |
| `materialCost` | `materialCost` |
| `externalIntegration` | `externalIntegrations` |
| `multipleUnits` | `affectedUnits` |

The supplied materiality object must byte-equal that recomputation. The
proposed change is source-plus-retained, enumerates every implementation/test
byte changed outside the identity, and binds ordinary approval/test evidence.
Only complete equality of every identity, all eight recomputed false, and
`uncertain:false` permits `exact-correction`; otherwise the evaluator emits
`required-generation`. It never trusts the supplied verdict. This includes
security posture, license basis, cost, migration, qualification, and approval
changes even when a caller supplies false materiality flags.

## 11. Behavioral verification

### RF-I1 — schema/evaluator/config

Behavioral fixtures must prove:

1. required work cannot enter detailed design without selection;
2. external/composed baseline cannot proceed without exact qualification;
3. Build proceeds without external trial after valid selection;
4. all four classes have evidence or specific ineligibility, with one viable;
5. unknown license/provenance, incomplete closure, mutable source, or
   unremovable authority incompatibility blocks before trial implementation;
6. changed objective/source/license/selection invalidates only its capability;
7. rejected options survive rename, supersession, trial failure, and selection;
8. Yes/No bind named choices and Comment preserves exact text;
9. attempts are unique/bounded/delta-bound and exhaust without fallthrough;
10. gap, duplicate, reorder, tamper, partial write, oversize, unsafe path,
    symlink, digest mismatch, and concurrent append fail closed;
11. research/selection never executes or activates contender bytes; and
12. stable result reasons contain no source body or secret value;
13. every state in the exhaustive staleness table supersedes correctly, while
    active qualification requires abort/reconciliation first;
14. a later material delta supersedes both satisfied and not-applicable
    generations without changing capability identity;
15. reservation publishes `QUALIFYING` before execution, rejects concurrent or
    repeated reservations, binds retry delta and verbatim owner readback to one
    exact ordinal, and cannot exceed the frozen lifetime cap;
16. every migration class routes to exactly one result kind and then only the
    sole normative stage table can authorize it;
17. live bindings stale while historical unrelated freeze identities remain
    valid until a proposed change names them;
18. duplicate keys, noncanonical strings/numbers/order, unknown fields,
    state-inapplicable fields, nested/oversize/aggregate-overflow manifests,
    and every declared parser bound fail before mutation;
19. ancestor/final symlink, junction, reparse, hard-link escape, identity swap,
    unsupported filesystem, partial publication, and competing no-replace
    publication fail closed; and
20. `--out` rejects out-of-results-tree and existing targets and never clobbers
    bytes under crash or concurrency fixtures;
21. generation 1 rejects satisfied, while a later exact-equivalent refresh
    reaches satisfied and every material/uncertain refresh reaches required;
22. alternative selection after consumed attempts continues at the next
    generation-wide physical ordinal and never resets the lifetime count;
23. chain and migration result variants enforce exact nullability and a
    grandfathered allow always binds a canonical lineage comparison;
24. historical evidence survives legitimate source-path replacement by reading
    only its immutable retained object, while a named affected source becomes
    a live predicate; and
25. two writers with different event IDs targeting the same sequence yield one
    fixed-name winner and one conflict; Linux/macOS/Windows helper contract,
    ownership/ACL, link-count, 9p/network-filesystem, orphan-temp, and missing-
    primitive fixtures all fail or pass exactly as specified;
26. three or more satisfied generations each bind the immediately preceding
    supersession, whose priorHead equals priorEquivalenceHead, and retain one
    anchor; a wrong/gapped supersession, prior head, or anchor fails;
27. migration receipt/prior bindings validate retained-only, current/change/live
    bindings validate source-plus-retained, and any unclassifiable binding fails;
28. the first required event is the sole budget carrier; every later operation
    derives both values by chain traversal, and config drift blocks check,
    record, and reservation across alternative selection;
29. unknown stage returns a failure with null stage and only its stable reason,
    every other result has exact stage nullability, and migration threadId comes
    from the receipt and equals the proposed change;
30. the sole normative stage table admits qualified baseline production design
    and review, routes new-work review through chain, and requires the identical
    ordinary approved design in both baseline-implementation kinds;
31. every fixed LineageIdentity `ArtifactBinding` and canonical set is compared
    by complete canonical bytes; the exhaustive non-overlapping floor mapping
    forces a new generation for any security/license/cost/migration/
    qualification/approval or other identity mismatch, false supplied floor,
    missing role, or uncertainty;
32. sequence 999999 is final, 1000000 is never encoded, and qualified-profile
    matching rejects unknown tuples and always denies network/9p/FUSE; crash-
    qualification reports and runtime probe evidence are digest-bound.

### RF-I2 — objectives/migration

Cover material new, uncertain, non-material defect, approved/unimplemented,
implementation-started, shipped, exact equivalence, and unrelated freeze. A
“bug fix” adding a subsystem or crossing a floor must be required.

### RF-I3 — design/clarification

Drive option-selection before detailed design, bind the existing design gate
to exact options bytes, reject repeated selection questions, require
supersession for new conflict, keep unrelated work runnable, and reject stale
state before the next remediation item.

### RF-I4 — Interrogation/implementation

Classify every selected strategy/source/license/authority/composition/migration/
qualification change as full design; keep exact in-option bug fixes ordinary;
permit Build implementation, only bounded trial before qualification, and an
external production baseline only after qualification plus ordinary design.

### RF-I5 — packaging

Derive invoking skills from install-health contract; resolve one shared reuse
and orchestration link; reject copied protocol; import-probe the evaluator;
validate default/legacy config; regenerate/check audit manifest; run focused
setup/install-health, `git diff --check`, secret scan, and full `npm test`.
Tests must exercise behavior/bindings, not keywords alone.

## 12. Bite-sized implementation order

1. **RF-I0 dependency:** finish/rebind separately approved
   `ORCHESTRATION.md`. If absent, keep reuse-first unshipped, not duplicated.
2. **RF-I1 foundation:** reference, config resolver/validator, audited native
   I/O helper/backends, evaluator/recorder, and evaluator tests. No skill
   invokes it yet.
3. **RF-I2 objective entry:** applicability/migration receipts and fixtures.
4. **RF-I3 design entry:** option selection, ordinary review binding, owner
   decision, clarification, and staleness.
5. **RF-I4 downstream:** Interrogation, full-review transition, trial, and
   baseline implementation preflights.
6. **RF-I5 packaging:** cross-skill tests, config/artifact docs,
   install-health contract/audit manifest, focused/full validation.

Each slice records files, digest, tests, and rollback. It may be reviewed alone,
but the feature is “implemented” only after RF-I1–RF-I5 pass together and the
installed manifest binds the complete tree. This artifact itself is not an
implementation.

## 13. Rollout, failure, and rollback

Release one versioned plugin payload after full validation. Old schema-v1
configs resolve the mandatory default without migration writes; existing
project histories stay untouched until the next applicable objective.

Fail closed when an invoking skill cannot load the reference/evaluator, config
is invalid, state absent/stale/malformed, or install health finds divergent
bytes. Pause only the affected capability unless the installed control-plane
payload itself is inconsistent.

Rollback restores the prior complete payload and matching manifest. Preserve
all reuse events, rejected ledgers, owner decisions, trials, and evidence as
inert history; validate them before later reuse. Never rollback by deleting a
failed attempt, weakening classification, disabling the gate, or relabeling
material work a bug.

## 14. Risks and non-goals

- Receipt chains are locally tamper-evident, not signed attestations.
- Offline currentness is unprovable; `UNVERIFIED` must remain honest/ineligible.
- Materiality remains a reasoned classification; uncertainty fails required.
- Research/trial adds cost; capability-local blocking and workers contain it.
- No dependency vulnerability service, legal advice, marketplace trust,
  production-isolation implementation, or external approval service is added.
- No Codex/Opus/Fable policy changes or reviewer-as-tie-breaker are added.

## 15. Design closure criteria

Implementation approval requires a fresh independent Codex review of these
exact bytes at confidence **93 or higher**, with zero failed checks, security
findings, material dissent, unresolved questions, and no design-changing
strongest objection. A correction creates a new digest and round. Claude Opus
is excluded under the owner's current route.
