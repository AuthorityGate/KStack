# KStack Secret Broker item ledger

**Thread:** `secret-broker-2026-08-28`  
**Objective:** `.kstack/objectives/secret-broker-2026-08-28.md`  
**Status:** living design ledger  
**Closure rule:** each item and the final integrated design require Codex
`>=93` with zero failed checks, security findings, material dissent, and
unresolved questions on the same frozen digest  
**Implementation status:** not authorized; not started

## Status meanings

- `VALIDATED` — the exact item passed the thread closure rule. This does not
  approve another item or the integrated design.
- `REJECTED` — the exact proposed mechanism is unsound; the successor is named.
- `OPEN-UNTESTED` — scoped but not reviewed on its own frozen candidate.
- `OPEN-CONFIRMED-BUG` — a current defect/gap is proven but no accepted design
  closes it.

## Operating rule

Review and repair the smallest coherent mechanism. Do not redesign the whole
broker in one round. Preserve accepted item evidence; never carry confidence
across digests or from one item to another. A score never compensates for a
finding. At confidence 84 or higher, stop broad redesign and repair only named
defects until the item reaches 93/all-zero. No Opus invocation is part of this
thread unless the owner separately changes the route.

## Item ledger

| ID | Item | Status | Evidence | Next action |
|---|---|---|---|---|
| SB-TC00 | Objective, terminology, authority, threat boundary, and no-model-value invariant | `OPEN-UNTESTED` | Focused objective created from current repository evidence and owner requirements. | Run an isolated completeness review after SB-TC01 research so provider facts cannot silently widen scope. |
| SB-TC01 | Reuse-first contender evaluation and v1 backend portfolio | `OPEN-CONFIRMED-BUG` | R1 reviewed candidate SHA-256 `b2c1d01223674780c3374793719b3032cf5346ee742a64178fe10794726f056c`: Codex `revise/96`, 2 failed checks, 1 security finding, 0 dissent, 1 unresolved question. Option A was retained; the sole defect class was absence of a portfolio-level audit admission rule for OpenBao success, failure, stall, and ambiguity. The candidate now requires qualified OpenBao audit-backed success plus durable KStack audit ordering before value release. | Freeze the repaired digest and request explicit approval for Codex R2 over only this item. |
| SB-TC02 | Opaque handle, safe metadata, repository/environment namespace, enumeration resistance, and closed public schema | `OPEN-UNTESTED` | Existing broker bans credential-bearing keys but has no general secret-handle contract. | Design after SB-TC01 freezes backend identity semantics. |
| SB-TC03 | Principal identity, policy, target binding, approval, prepared operation, lease, TTL/use count, and anti-replay | `OPEN-UNTESTED` | Existing Git broker supplies a narrow prepare/scan/execute precedent. | Design independently from backend transport. |
| SB-TC04 | Backend adapter contract, bootstrap authentication/custody, capability discovery, health, and degradation | `OPEN-UNTESTED` | Current Git/Jira files are transitional; provider-neutral adapter does not exist. | Design against the SB-TC01 selected portfolio. |
| SB-TC05 | Protected executor, injection channels, executable/adapter identity, child/process containment, memory lifetime, and output suppression | `OPEN-UNTESTED` | POSIX Git worker and askpass socket are narrow implemented precedents. | Define registered adapters; keep arbitrary shell execution excluded. |
| SB-TC06 | Secret creation/input, rotation, revocation, expiry, version overlap, deletion, provider-side mutation, and ambiguity reconciliation | `OPEN-UNTESTED` | ECR TC06A/TC06B provide design evidence but external-provider lifecycle is not integrated. | Design provider-neutral state machine without importing ECR storage assumptions. |
| SB-TC07 | Audit chain, content-free receipts, safe errors, incident response, pasted-secret handling, and support diagnostics | `OPEN-UNTESTED` | Existing broker sanitizes receipts and KStack has Gitleaks/Reflexion boundaries. | Define exact safe schemas and positive-control leak harness. |
| SB-TC08 | Claude/Codex host projections, main-window questions, direct-path denial, capability truth, and multi-worker scheduling | `OPEN-UNTESTED` | Claude bounded ask and Codex deny-only are observed; claims must remain asymmetric. | Design without claiming unavailable Codex interception. |
| SB-TC09 | Setup, backend selection, repository enrollment, no-echo UX, migration from protected files, recovery, uninstall, and rollback | `OPEN-UNTESTED` | Current init has no Secret Broker workflow. | Design reversible user journeys after lifecycle and adapter contracts. |
| SB-TC10 | Cross-platform qualification, adversarial test matrix, synthetic fixtures, performance/resource bounds, rollout, and production promotion | `OPEN-UNTESTED` | Existing host and native qualification disciplines are reusable precedents. | Define evidence levels and exact promotion gates after mechanism items. |
| SB-TC11 | Skill/package layout, configuration schemas, install-health manifests, versioning, compatibility, and documentation boundaries | `OPEN-UNTESTED` | `skill-creator` requires a concise entry skill with conditional references and validated UI metadata. | Design after public behavior and adapters stabilize. |
| SB-TC12 | Integrated dependency graph, implementation sequence, milestone exits, residual-risk register, and final design gate | `OPEN-UNTESTED` | Integration cannot inherit validation automatically from item rows. | Review last on the frozen complete package; require 93/all-zero. |

## Round log

| Item / round | Candidate SHA-256 | Decision / confidence | Open counters | Disposition |
|---|---|---|---|---|
| SB-TC01 / R1 | `b2c1d01223674780c3374793719b3032cf5346ee742a64178fe10794726f056c` | `revise / 96` | failed 2; security 1; dissent 0; questions 1 | Retain Option A; repair only OpenBao/KStack audit admission and ambiguous failure semantics. |

## Rejected whole-mechanism options

| Option | Status | Reason | Successor |
|---|---|---|---|
| Return plaintext to the model or expose a generic `getValue`/MCP resource | `REJECTED` | Violates the primary objective and expands every prompt/tool/log sink into the trusted computing base. | Opaque metadata plus registered broker execution only. |
| Generic environment-variable or arbitrary-shell injection | `REJECTED` | Environment inheritance, process inspection, debug output, shell expansion, and arbitrary children make containment and target binding unprovable. | Registered narrow target adapters with closed injection channels. |
| Automatically ingest discovered `.env` or credential files | `REJECTED` | Discovery cannot prove ownership, scope, currency, or authorization and import can create an irreversible second secret copy. | Explicit preview, no-echo entry/provider import, read-back, and separately approved source retirement. |
| Build the complete KStack-native vault before testing external/OS adapters | `REJECTED` | Duplicates mature custody/lifecycle work and increases cryptographic and recovery risk before insufficiency is proven. | Compose provider/OS custody first; retain ECR as a bounded fallback. |

## Source boundary

No review packet may include a real secret, tenant identifier, account identity,
personal filesystem path, or local configuration. Research citations must be
primary vendor, standards, or platform documentation and must state mutable
versus version-pinned status.
