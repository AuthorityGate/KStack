# Post-deploy Playwright validation

`kstack-post-deploy.mjs` turns an already deployed, identity-bound release into
browser evidence. It does not deploy, approve, roll back, create test users, or
grant authority.

## Evidence model

A legacy v1 run has two required lanes:

1. A KStack-owned Playwright canary opens the exact approved base URL in an
   isolated browser context, refuses TLS-error bypass, checks the response and
   final origin, records browser-console and failed-request counters, and saves
   a screenshot and trace.
2. The repository's complete post-deploy Playwright suite runs with the exact
   release binding in fixed environment variables. KStack forces JSON results,
   trace retention on failures/retries, `forbid-only`, no snapshot updates, and
   fail-on-flaky behavior. Zero discovered tests is failure.

For a user-facing v2 plan, a third gate validates the exact experience contract
and requires a fresh, release-bound result plus exact case/performance evidence
defined in `PRODUCT_EXPERIENCE.md`. KStack reopens every evidence file and
re-hashes contract sources after the suite. A generic passing suite is
insufficient. A repository containing `.kstack/experience.json` cannot use the
legacy v1 plan.

`HEALTHY` requires every plan-required lane and configured runtime budget. Provider success, a KStack canary alone, a
project suite alone, a skipped required test, a flaky retry, a timeout, or a
missing browser never becomes healthy. KStack performs no blind outer retry.

Playwright is the final automated acceptance boundary before the user performs
their own deeper validation. It never substitutes for that user validation.
The handoff is `READY_FOR_USER_VALIDATION` only after browser health is clean
and, when required by the plan, the resulting lifecycle events have been
projected to Jira. A successful browser run with pending Jira projection is
`JIRA_TRACKING_PENDING`, not ready.

The repository suite receives:

- `KSTACK_POST_DEPLOY_BASE_URL`
- `KSTACK_POST_DEPLOY_RELEASE_ID`
- `KSTACK_POST_DEPLOY_DEPLOYMENT_ID`
- `KSTACK_POST_DEPLOY_COMMIT_SHA`
- `KSTACK_POST_DEPLOY_ARTIFACT_SHA256`

V2 experience suites additionally receive:

- `KSTACK_EXPERIENCE_RESULT_PATH`
- `KSTACK_EXPERIENCE_CONTRACT_PATH`
- `KSTACK_EXPERIENCE_CONTRACT_SHA256`

Tests must consume `KSTACK_POST_DEPLOY_BASE_URL` instead of embedding a target.
The independent canary proves the bound target was reachable; it cannot prove
that arbitrary repository tests used the variable correctly. Review that
contract as product code. A suite that changes data is an external mutation and
requires its own authority, synthetic/isolated data, cleanup, and recovery
plan. Deployment authority does not authorize test-data mutation.

## Plan

Store a non-secret, project-local plan such as
`.kstack/post-deploy-validation.json`:

```json
{
  "schemaVersion": "kstack-post-deploy-validation-plan-v2",
  "planId": "production-browser-validation",
  "environment": "production",
  "allowedOrigins": ["https://app.example.com"],
  "handoff": {
    "jiraRequired": true,
    "maxCanaryDurationMs": 30000,
    "maxSuiteDurationMs": 600000
  },
  "experience": {
    "required": true,
    "contractPath": ".kstack/experience.json"
  },
  "playwright": {
    "configPath": "playwright.config.ts",
    "testPaths": ["tests/post-deploy"],
    "projects": ["chromium", "firefox", "webkit"],
    "canaryBrowser": "chromium",
    "navigationTimeoutMs": 30000,
    "testTimeoutMs": 60000,
    "globalTimeoutMs": 600000,
    "retries": 1,
    "workers": 1,
    "expectedStatuses": [200],
    "waitUntil": "load",
    "failOnConsoleError": true,
    "failOnRequestFailure": true,
    "allowSkipped": false
  }
}
```

Production origins must use HTTPS. Paths must be normalized, project-relative,
regular files/directories without symlinks. The source manifest is bounded to
2,048 files and 32 MiB. Retries are capped at two and are still classified as
flaky when a failure later passes.

Validate without network or browser launch:

```bash
node <kstack-plugin-root>/scripts/kstack-post-deploy.mjs validate-plan \
  --project-root . \
  --plan .kstack/post-deploy-validation.json
```

Run after provider deployment success and exact artifact identification:

```bash
node <kstack-plugin-root>/scripts/kstack-post-deploy.mjs run \
  --project-root . \
  --plan .kstack/post-deploy-validation.json \
  --base-url https://app.example.com/ \
  --release-id release-2026-08-28 \
  --deployment-id provider-deployment-id \
  --commit-sha 0123456789abcdef0123456789abcdef01234567 \
  --artifact-sha256 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
  --jira-config .kstack/config.json \
  --thread-id release-thread \
  --item-id accepted-work-item
```

The target repository must already have `@playwright/test` and its selected
browsers installed. Missing capability returns
`KSTACK_POST_DEPLOY_PLAYWRIGHT_UNAVAILABLE` or
`KSTACK_POST_DEPLOY_BROWSER_UNAVAILABLE`; install or repair it through the
repository's approved dependency workflow, then validate the plan again.

## Receipts and release handling

Raw evidence is written with private permissions below
`.kstack/post-deploy-evidence/`; this directory must remain ignored. The
canonical receipt binds plan bytes, test-source bytes, target, release,
deployment, commit, artifact, Playwright version, canary result, suite counts,
experience contract/source/result/screenshot digests when v2 is active, and
evidence digests. It deliberately deletes the raw JSON reporter payload
after extracting counters and its digest because test output may contain
sensitive values. Screenshots and traces can still contain user data and must
not be committed or sent to a reviewer without a separate content check and
approval.

The runtime derives bounded defect work from failed canary health, browser
console errors, request failures, acceptance-test failures, flaky behavior,
timeouts/interruption, required skips, and configured canary/suite performance
budgets, plus journey, accessibility, responsive, visual, brand, content,
state, experience-performance, and evidence failures for v2. On `FAILED`, it appends the receipt digest to the linked Jira work item
and creates one stable follow-up item per observed defect category. Exact replay
is idempotent. Jira receives summaries and digests, never raw Playwright output,
screenshots, traces, cookies, or customer data. Then evaluate the already approved rollback contract. Run
automatic rollback only when the release envelope already authorized it and
the release design proves the change reversible; otherwise surface the full
failure and exact recovery question. After rollback, validate the restored
target with a new run and receipt. Never rewrite the failed receipt.

If the owner skips validation, record `OBSERVATION_SKIPPED_BY_OWNER`; do not
substitute `HEALTHY`, `PASSED`, or `RELEASED`.

On `HEALTHY`, the runtime appends `QC_VALIDATED`, `ITEM_DONE`, and
`ITEM_RELEASED` to the linked Jira item. Automatic tracking must read back and
project those events before the handoff becomes `READY_FOR_USER_VALIDATION`.
Approval-queued tracking preserves the events and drafts but remains pending.
