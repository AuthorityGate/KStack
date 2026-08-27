# Release automation + Jira option-selection brief

**Thread:** `release-automation-jira-2026-08-26`
**Decision:** `REL-OPT-Q1`
**Status:** `OWNER_REVIEW_REQUIRED`
**Review route:** Codex/local analysis only; no Opus
**Authority:** design comparison only; no implementation, external write, commit,
push, merge, deployment, rollback, or publication

## Decision in one sentence

Select a **composed KStack architecture**: KStack's protected broker remains the
authority and crash-recovery plane; Jira remains the required human-facing
release ledger; GitHub Environments, OIDC, Deployments, and SHA-pinned reusable
workflows form the first execution adapter; carefully selected gstack mechanics
are adapted with MIT attribution; and Argo Rollouts is an optional typed adapter
for qualified Kubernetes targets.

This does not reopen validated M1 or M2. M2 is closed design-only at Codex 99 on
digest `1109ed85ca5854bcb00d9490ddafa293612b156c4d25ffcb1e20d622b2513975`.
M1 correction 3 and M3-M7 remain independently open, and no runtime target is
qualified.

## Why this option

No one contender covers KStack's full requirement:

- gstack has the strongest ready-made operator journey and post-merge reach,
  but it has no Jira authority model and performs merge/revert actions from the
  agent workflow.
- GitHub has the best first approval and execution substrate for this project,
  but not a cross-provider release state machine or independent canary policy.
- Argo Rollouts has the strongest Kubernetes-native progressive delivery and
  rollback engine, but it is not portable beyond Kubernetes and does not own
  Jira workflow semantics.
- A fully KStack-native build preserves every invariant but needlessly rebuilds
  queue handling, deployment status, progressive delivery, and operator UX.

Composition preserves KStack's authority boundary while buying mature reach at
the provider edges.

## Bound evidence

### Local gstack source

Inspected checkout: `/tmp/gstack-reuse-audit-20260826` at commit
`ad8400543cd9ce8d07641362db48d44a95417e33`, package version `1.69.0`, MIT.

| Source | Verified mechanism |
|---|---|
| `ship/SKILL.md` | Platform/base detection, full preflight, content-bound review freshness, idempotent ship actions, distribution-pipeline check, test-evidence gate, PR create/update path. |
| `land-and-deploy/SKILL.md` | First-run dry run, readiness report, merge queue polling, authoritative post-failure PR readback, merge-SHA correlation, deploy-workflow polling, staging-first flow, one-pass health verification, revert path, deploy report. |
| `canary/SKILL.md` | Bounded baseline/snapshot loop, page discovery, console/performance comparisons, severity handling, Markdown/JSON report. |
| `setup-deploy/SKILL.md` | Provider/config discovery, deploy fingerprint, production URL and health-command setup, first-run verification. |
| `bin/gstack-evidence` | Exact command hash, working-tree fingerprint, 0600 bounded logs, freshness checking, environment-scrub protection. |
| `lib/egress-receipt.ts`, `bin/gstack-egress*` | Receipt-before-send, content-free payload digest/size, hash-chained local ledger, static network-sink wiring tests. |
| `landing-report/SKILL.md` | Read-only workspace/version queue and collision dashboard. |
| Relevant tests | Evidence freshness, egress wiring, ship idempotency, deploy first-run/readiness/canary paths, and non-retry merge-failure reconciliation. |

Two limitations are explicit in the source and must not cross into KStack:
`gstack-evidence` treats bookkeeping failure as a warning, and the egress ledger
is forensic observability rather than an exfiltration control, with some
fail-open sinks. Those semantics are acceptable for local developer assistance,
not for a protected production release gate.

### Primary platform sources

- [GitHub deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments): required reviewers, prevent self-review, branch restrictions, wait timers, environment secrets, and custom protection rules.
- [GitHub deployment control](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments): environments, deployment objects, concurrency, protection gates, and run history.
- [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows): typed inputs/secrets and full-commit-SHA pinning as the safest reference.
- [GitHub continuous deployment](https://docs.github.com/en/actions/get-started/continuous-deployment): deterministic deployment workflows, environment controls, concurrency, and OIDC guidance.
- [Atlassian GitHub deployment linkage](https://support.atlassian.com/jira-cloud-administration/docs/link-github-workflows-and-deployments-to-jira-issues/): GitHub for Atlassian consumes GitHub deployment-status events linked through Jira work-item keys.
- [Jira deployment API](https://developer.atlassian.com/cloud/jira/software/rest/api-group-deployments/): authenticated deployment submit/read/delete/gating-status operations and scoped OAuth/Forge/Connect integration.
- [Argo Rollouts concepts](https://argoproj.github.io/argo-rollouts/concepts/): blue-green/canary delivery, metric analysis, and automated promotion or rollback.
- [Argo analysis](https://argoproj.github.io/argo-rollouts/features/analysis/): inline/background analysis, failure/inconclusive states, experiments, and pre/post-promotion gates.
- [Argo rollback windows](https://argo-rollouts.readthedocs.io/en/stable/features/rollback/): bounded fast rollback to retained revisions.
- [Argo CD automated sync](https://argo-cd.readthedocs.io/en/release-3.2/user-guide/auto_sync/): Git-driven reconciliation and its important rollback/auto-sync constraints.
- [Argo Rollouts repository](https://github.com/argoproj/argo-rollouts): Apache-2.0 provenance.

## Options compared

Scores use 1 (material gap) through 5 (strong native fit). Weighting reflects
the locked objective, not general product popularity: unattended reach 15,
Jira authority/workflow 15, rollback 15, security 15, canary evidence 10,
human approvals 10, portability 8, implementation effort 5, maintenance 4,
and licensing/provenance 3.

| Option | Reach | Jira | Rollback | Canary | Security | Approval | Portability | Effort | Maint. | License | Weighted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Adopt gstack release chain | 5 | 1 | 2 | 4 | 2 | 3 | 4 | 5 | 4 | 5 | 64/100 |
| B. GitHub-native Actions + Environments | 4 | 3 | 2 | 2 | 4 | 5 | 2 | 4 | 4 | 4 | 66/100 |
| C. Argo CD + Argo Rollouts | 5 | 2 | 5 | 5 | 4 | 3 | 1 | 2 | 2 | 5 | 72/100 |
| D. KStack-native only | 4 | 5 | 4 | 4 | 5 | 5 | 4 | 1 | 2 | 5 | 84/100 |
| **E. Compose broker + GitHub + Jira + optional Argo** | **5** | **5** | **5** | **5** | **5** | **5** | **4** | **2** | **2** | **4** | **92/100** |

The score is an option-selection aid, not design confidence. Option E does not
score 100 because it has the highest integration and qualification burden,
depends on SaaS contracts for its first adapter, and adds an optional
Kubernetes control plane that must be versioned and maintained.

## Criterion readout

| Criterion | A. gstack | B. GitHub | C. Argo | D. KStack native | E. Compose |
|---|---|---|---|---|---|
| Unattended post-ship reach | Excellent workflow breadth, but agent-directed. | Strong merge-to-deploy substrate. | Strong continuous reconciliation and rollout. | Correct but expensive to build. | GitHub first; typed provider adapters extend reach. |
| Jira authority/workflow | No first-class authority or mapping. | Official deployment visibility; key-based linkage is useful but insufficient authority. | Requires a separate Jira integration. | Exact state-to-Jira mapping. | KStack owns semantics; official integration supplies views/events. |
| Rollback | Git revert/revert PR after a human choice; no universal reversibility proof. | Provider-specific workflow must be authored. | Best Kubernetes canary abort/rollback. | Exact eligibility and reconciliation can be enforced. | Broker proves eligibility; Argo accelerates qualified Kubernetes rollback. |
| Canary/health evidence | Strong visual UX, but agent-owned observation is not independent proof. | Run status is not application health. | Metric-driven analysis is strong for Kubernetes. | Independent observer can be normative. | Adapt gstack UX over broker-qualified provider + independent evidence. |
| Security | Good local hygiene; release actions and some receipts are fail-open. | Strong environment/OIDC/secret controls, with plan/tier constraints and admin-bypass configuration to qualify. | Strong controller/RBAC model; cluster compromise remains material. | Strongest closed authority model. | KStack gate + GitHub OIDC + provider IAM + signed receipts. |
| Human approvals | Interactive workflow approvals. | Required reviewers and prevent-self-review fit the locked production decision. | Pauses/promotions exist but do not satisfy the locked GitHub approval decision alone. | Must build an external approval plane. | GitHub Environment is the sole production approval point. |
| Portability | GitHub/GitLab and many agent hosts, but deploy depth varies by provider. | GitHub-centric. | Kubernetes-only. | Provider-neutral by design. | Broker-neutral; GitHub first, Argo optional, later adapters isolated. |
| Effort/maintenance | Lowest initial effort. | Low-to-medium. | High operational footprint. | Highest build cost. | High integration cost, lower reinvention than native-only. |
| Licensing/provenance | MIT; copied code needs notice. | SaaS terms; third-party actions require provenance and immutable pins. | Apache-2.0. | KStack-owned. | Explicit MIT/Apache notices; prefer official APIs and SHA-pinned code. |

## Exact gstack reuse boundary

### Adapt or reuse with attribution

1. **Authoritative PR-state readback:** after a non-zero merge result, query PR
   state and merge commit; never blindly repeat the merge. Preserve the tested
   `MERGED`/`OPEN`/`CLOSED` branching and merge-queue wait pattern.
2. **Merge-SHA deploy correlation:** identify the deploy run by the exact merge
   SHA, poll with backoff, distinguish failed checks from unknown provider
   state, and retain timing.
3. **Setup discovery UX:** reuse provider detection, first-run dry-run, staging
   discovery, health endpoint discovery, and config-change fingerprinting.
4. **Evidence freshness primitives:** adapt exact command digests, content
   fingerprints, bounded logs, and stale/missing outcomes from
   `gstack-evidence`.
5. **Canary report UX:** reuse baseline/current/delta presentation, bounded
   sampling, screenshots, console/performance evidence, and Markdown/JSON
   reporting.
6. **Content-free receipt mechanics:** adapt receipt-before-send, payload digest
   and size, hash chaining, and the static sink-inventory test.
7. **Landing collision dashboard:** reuse the read-only queue/collision view as
   preflight evidence, not as release authority.
8. **Regression patterns:** port ship idempotency, post-failure merge readback,
   egress wiring, evidence freshness, and first-run deployment fixtures.

### Do not inherit

1. A prompt's instruction that `/ship` means blanket non-interactive authority.
2. Direct `gh pr merge`, `git revert`, or `git push` from the governed agent.
3. Trusted deployment configuration stored as mutable prose in `CLAUDE.md`.
4. A failed evidence-ledger write that merely warns and continues.
5. Fail-open egress receipts for mutation-capable release calls.
6. Agent/browser screenshots as the sole independent canary.
7. The ability to mark a failed health check healthy by conversation alone.
8. Mutable action tags. Atlassian's example names
   `chrnorm/deployment-action@releases/v1`; KStack must instead use the GitHub
   API directly or bind any action to a reviewed full commit SHA.

## Recommended composition

```text
Jira release record (human workflow / required production linkage)
        |
        v
KStack protected release broker
  - immutable envelope + resource claims
  - crash journal, fencing, idempotency, reconciliation
  - signed dispatch / observation / rollback / Jira receipts
        |
        v
GitHub Environment gate (sole production human approval)
  - required reviewer + prevent self-review
  - exact SHA-pinned reusable workflow
  - OIDC and least-privilege environment secrets
        |
        v
Typed provider adapter
  - GitHub/deploy provider in V1
  - optional Argo Rollouts only for qualified Kubernetes targets
        |
        v
Authenticated provider status + independent canary
        |
        +--> eligible typed rollback before human escalation
        |
        +--> bounded Jira deployment/status/receipt update
```

### Jira mapping

- Jira is the durable human-facing release record and workflow surface when
  configured; a linked record is required for production.
- Jira prose, issue status, labels, and comments never create deployment
  authority or change the target.
- KStack maps its exact release states to an allowlisted issue revision,
  fields, comments, and transitions with idempotency keys and readback.
- GitHub for Atlassian deployment-status events provide standard Jira views.
  The broker's Jira Deployment API writes provide the exact KStack lifecycle,
  health, ambiguity, and rollback semantics that key-based linkage alone lacks.
- Every write is bounded by the approved envelope; duplicate, stale,
  out-of-order, unauthorized-field, 429, timeout, and ambiguous results reconcile
  before any retry.

### Rollback and health

- The broker, not gstack or Argo, decides whether rollback is eligible under the
  approved envelope and current reversibility proof.
- Argo may execute a canary abort or rollback only through a typed, fenced
  Kubernetes adapter. Argo's automatic behavior is provider evidence, not
  KStack authority.
- Non-Kubernetes adapters must expose an exact previous artifact/config target
  plus authenticated no-effect/success lookup. Unsupported or irreversible
  targets end in manual action rather than a fake rollback guarantee.
- gstack's baseline/screenshot/console/performance model is retained as operator
  evidence, while terminal `HEALTHY` still requires the locked authenticated
  provider status plus independent canary contract.

### Approval and security

- Production requires GitHub Environment reviewers, prevent-self-review, a
  non-bypass policy that the target plan actually supports, and an approval
  principal distinct from requester and broker.
- The workflow and every dependency are pinned by full commit SHA; dynamic
  `uses`, mutable tags, arbitrary command payloads, and generic webhooks remain
  forbidden.
- Environment secrets release only after the gate; OIDC credentials are short
  lived, audience/subject/target scoped, and provider IAM remains the last
  enforcement boundary.
- KStack release mutation receipts fail closed. Content-free gstack receipt
  structure may be reused, but KStack adds authenticated broker identity,
  durable operation state, rotation, reconciliation, and retention policy.

## Delivery consequence

If approved, implementation still proceeds in isolated items:

1. Preserve frozen M1 corrections and M2 atomic redemption unchanged.
2. Resolve M1 correction 3's owner-dependent approver semantics.
3. Review M3 Jira mapping and reconciliation independently.
4. Review M4 provider status and independent canary evidence.
5. Review M5 rollback eligibility/execution, with Argo as an optional adapter.
6. Review M6 receipts/reporting and gstack provenance boundaries.
7. Complete M7 anti-rollback qualification and then stage on synthetic data.

No code or provider installation begins from this option decision alone.

## Owner question: REL-OPT-Q1

**Exact question:** Should KStack lock Option E as the Release Automation
direction: KStack's protected broker and Jira release ledger remain
authoritative; GitHub Environment approval, OIDC, Deployments, and SHA-pinned
reusable workflows become the first execution plane; the listed gstack
mechanics are adapted with MIT attribution but never inherit direct-agent or
fail-open mutation authority; and Argo Rollouts is available only as an
optional, separately qualified Kubernetes adapter?

**Recommendation:** Yes.

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

**Choices:** Yes / No / Comment
