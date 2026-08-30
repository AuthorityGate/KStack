---
name: kstack-post-deploy
description: Validate an already deployed, identity-bound application with a KStack-owned browser canary and the repository's full Playwright suite. Use after deployment or rollback; it does not authorize deployment, data mutation, or rollback.
---

# KStack Post-Deploy Validation

Prove the deployed application works; do not infer health from provider status.

## Entry

1. Read `../../references/POST_DEPLOY_VALIDATION.md`. For a v2 user-facing
   plan, also read `../../references/PRODUCT_EXPERIENCE.md` and validate its
   exact experience contract before browser launch.
2. Validate `.kstack/config.json` and the selected post-deploy plan.
3. Require exact release ID, provider deployment ID, commit OID, artifact
   SHA-256, environment, and deployed base URL. A branch name or “latest” is
   not artifact identity.
4. Confirm the provider reports a terminal successful deployment. Preserve that
   observation separately; it is not browser evidence.
5. Apply the authority matrix independently. Browser observation is a test.
   Account creation, writes, purchases, messages, cleanup, or any other product
   mutation needs its own authority and must use approved synthetic/isolated
   data. Deployment authority does not grant it.
6. Never place credentials, cookies, tokens, storage state, or password values
   in the plan, prompt, command arguments, receipt, Jira, or reviewer packet.

## Run

Invoke:

```bash
node <kstack-plugin-root>/scripts/kstack-post-deploy.mjs run \
  --project-root . --plan <plan> --base-url <exact-url> \
  --release-id <id> --deployment-id <id> \
  --commit-sha <oid> --artifact-sha256 <sha256> \
  --jira-config .kstack/config.json --thread-id <thread> --item-id <item>
```

The function runs the independent canary first. Only a passing canary may
release the repository's full Playwright suite. Do not edit tests, lower
assertions, allow skips, ignore console/network failures, change the target, or
update snapshots to manufacture a pass.
For a v2 plan, the suite receives a unique `KSTACK_EXPERIENCE_RESULT_PATH` and
the exact contract digest. It must produce a same-run evidence manifest whose
individual files, performance provenance, release binding, and visual manifest
are reopened and hashed by KStack. KStack also re-hashes the contract and
governed sources after Playwright exits. It must produce all required
experience lanes bound to the release/deployment/commit/artifact. Missing,
stale, malformed, or
failing evidence blocks handoff even when generic tests pass.

When Playwright, a selected browser, authentication, or the target is
unavailable, troubleshoot the exact capability first. A bounded retry is
allowed only after a concrete repair or after the configured short readiness
window; do not blindly rerun a possibly mutating suite. If capability remains
unavailable, relay the full failure and recovery question to the user.

## Result

- `READY_FOR_USER_VALIDATION`: provider success plus independent canary plus a nonempty,
  zero-failed, zero-flaky, zero-interrupted suite; required skips are zero.
- `JIRA_TRACKING_PENDING`: browser validation passed, but required Jira
  completion/validation/release events are only queued or could not be
  projected. Do not hand off yet.
- `EXPERIENCE_REVIEW_REQUIRED`: objective experience lanes pass, but review of
  the exact screenshot/state manifest remains pending.
- `EXPERIENCE_REMEDIATION_REQUIRED`: a journey, accessibility, responsive,
  visual, brand, content, state, performance, identity, or evidence check
  fails. Create category-specific Jira work and do not hand off.
- `REMEDIATION_REQUIRED`: preserve the receipt and evidence. The runtime
  appends the failure to the existing Jira item and creates bounded follow-up
  work for functional, performance, flaky/inconsistent, timeout, coverage,
  browser-console, request, or canary-health defects. Evaluate the
  approved rollback contract before asking the user, but execute rollback only
  when its exact authority and reversibility predicates are already satisfied.
- Owner skip: record `OBSERVATION_SKIPPED_BY_OWNER`; never call it healthy.

After an authorized rollback, run this skill again against the restored target
and retain both append-only receipts. A successful restored-target run proves
current health; it does not erase the failed release.

On a healthy release, the runtime records `QC_VALIDATED`, `ITEM_DONE`, and
`ITEM_RELEASED` against the linked Jira item and uses the receipt SHA-256 as
release evidence. `READY_FOR_USER_VALIDATION` means the automated boundary is
complete; it never claims the user's deeper validation has happened. Report
the evidence path, exact status, test counts, failed/skipped/flaky counters,
unrun checks, Jira projection state, and whether the tested suite was read-only
or separately authorized to mutate synthetic data.
