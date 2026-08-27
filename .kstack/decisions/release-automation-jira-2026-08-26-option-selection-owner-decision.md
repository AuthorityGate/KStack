# Owner decision: Release Automation + Jira architecture

**Thread:** `release-automation-jira-2026-08-26`
**Decision:** `REL-OPT-Q1`
**Decision date:** 2026-08-26
**Status:** `LOCKED-YES-OPTION-E`
**Owner answer:** `Yes`
**Reviewed option brief:**
`.kstack/decisions/release-automation-jira-2026-08-26-option-selection.md`
**Reviewed brief SHA-256:**
`4111cc68c347865ec53a72730885bf4d63fb27fdbae482c73a242cb2acb54f42`
**Review route:** Codex/local integrity review only; no Opus

## Full question shown to the owner

**Question `REL-OPT-Q1`:** Should KStack lock Option E as the Release
Automation direction: KStack's protected broker and Jira release ledger remain
authoritative; GitHub Environment approval, OIDC, Deployments, and SHA-pinned
reusable workflows become the first execution plane; the listed gstack
mechanics are adapted with MIT attribution but never inherit direct-agent or
fail-open mutation authority; and Argo Rollouts is available only as an
optional, separately qualified Kubernetes adapter?

**Recommendation shown:** Yes.

**If Yes:** freeze this composition and continue only the next isolated open
release item. Validated M1/M2 rows remain frozen. This does not authorize
implementation or any external action.

**If No:** keep option selection open. M1/M2 evidence remains valid, but the
remaining provider/Jira/health/rollback design cannot assume an execution
architecture.

**If Comment:** state the exact component to add, remove, or constrain. Only
that option slice is revised; the whole Release Automation plan is not
redesigned.

**Blocked pending answer:** selection of the composition used by remaining
M3-M7 work and the later implementation plan. No existing validated row is
blocked or reopened.

**Selectable responses presented:** `Yes`, `No`, `Comment`.

## Verbatim owner answer

`Yes`

## Locked answer mapping and readback

`REL-OPT-Q1 / Lock reviewed Option E -> Yes`.

The owner selects the exact composed architecture reviewed at brief digest
`4111cc68c347865ec53a72730885bf4d63fb27fdbae482c73a242cb2acb54f42`:

1. **KStack authority remains primary.** The protected release broker owns the
   immutable envelope, resource claims, crash journal, fencing, idempotency,
   reconciliation, and signed dispatch, observation, rollback, and Jira
   receipts. No contender replaces or weakens that authority boundary.
2. **Jira remains authoritative in its approved scope.** Jira is the durable
   human-facing release ledger and workflow surface when configured, including
   required production linkage. Jira prose, issue status, labels, and comments
   never create deployment authority or change an approved target.
3. **GitHub is the first execution plane.** GitHub Environments provide the
   sole production human-approval point for the first adapter. OIDC,
   Deployments, environment controls, and full-commit-SHA-pinned reusable
   workflows execute only an exact broker-approved request.
4. **Selected gstack mechanics may be adapted, not trusted as authority.** The
   admissible boundary is authoritative post-failure PR readback, merge-SHA
   deploy correlation, setup-discovery UX, evidence-freshness primitives,
   canary report UX, content-free receipt mechanics, the read-only landing
   collision dashboard, and the named regression-test patterns. Reuse retains
   MIT attribution and is reviewed component by component.
5. **Direct-agent and fail-open mutation semantics are rejected.** KStack does
   not inherit blanket `/ship` authority, direct agent `gh pr merge`,
   `git revert`, or `git push`, trusted mutable prose configuration, fail-open
   mutation receipts, screenshots as sole canary proof, conversational
   mark-healthy override, or mutable action tags.
6. **Argo Rollouts is optional and separately qualified.** It may appear only
   behind a typed, fenced Kubernetes adapter for an exact qualified target. It
   is not the KStack authority plane, is not a mandatory dependency, and does
   not broaden the first GitHub execution-plane decision.
7. **Health and rollback stay evidence-bound.** Terminal health requires the
   reviewed authenticated provider-status and independent-canary contract.
   The broker decides rollback eligibility from the current envelope and
   reversibility proof; unsupported or irreversible targets require manual
   action instead of a false automatic-rollback claim.

## Accepted consequences

- The selected direction carries a material integration and qualification
  burden across KStack, GitHub, Jira, provider adapters, and any optional Argo
  adapter; the reviewed 92/100 option score is an option-selection aid, not
  implementation confidence or runtime qualification.
- GitHub plan/tier behavior, environment reviewer and non-bypass semantics,
  OIDC trust, provider IAM, every workflow dependency, Jira scopes, and target
  provider behavior must be qualified before production claims are allowed.
- Adapted gstack material requires exact upstream provenance, retained MIT
  notice, immutable source binding, KStack-specific safety adaptation, and
  deterministic/adversarial tests before admission.
- Argo Rollouts adds Kubernetes-only operational and maintenance cost when a
  later target elects that adapter. Its automated promotion or rollback is
  provider evidence and execution, never independent KStack authority.
- Jira standard deployment views may be composed with KStack's exact bounded
  deployment API writes, but neither key-based linkage nor Jira text can
  authorize a release.

## Frozen and open work

- Every validated M1 correction remains frozen at its existing digest and
  evidence. This architecture lock does not rewrite or re-review it.
- M2 one-executor and atomic redemption remains `VALIDATED-DESIGN-ONLY` at
  digest `1109ed85ca5854bcb00d9490ddafa293612b156c4d25ffcb1e20d622b2513975`,
  Codex 99 clean. M7 anti-rollback qualification remains independent.
- M1 correction 3 remains separately open under its own unresolved approver
  semantics; this `REL-OPT-Q1` answer must not be misread as answering the
  earlier question on which that item depends.
- M3-M7 remain `OPEN-UNTESTED` and must be reviewed later as isolated items in
  dependency order. This decision supplies their selected composition, not
  their design validation.

## Authorization boundary

This record locks architecture selection only. It grants no authority to edit
product or skill/runtime code, copy upstream source, install dependencies,
configure GitHub or Jira, access credentials, qualify a target, mutate an
issue or deployment, merge, rollback, commit, push, deploy, publish, or edit an
assessment report.

There is no remaining owner question for Option E selection. Any future change
to the seven locked clauses requires a linked superseding owner decision that
names the exact clause, evidence, and consequence. Do not edit this locked
record in place after integrity review.
