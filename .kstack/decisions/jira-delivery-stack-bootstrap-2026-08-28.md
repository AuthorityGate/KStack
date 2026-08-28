# Jira delivery-stack bootstrap design

**Date:** 2026-08-28  
**Thread:** `release-automation-v2-2026-08-28 / jira-bootstrap`  
**Status:** implemented; business/native-board path live-qualified; software-board path fixture-qualified

## Outcome

KStack initialization must ask one repository-scoped Jira question with three
answers: connect an existing delivery stack, create a new delivery stack, or
skip Jira. An existing Jira project with no suitable board/backlog is a
supported subcase of connect-existing. Initialization performs discovery,
questions, offline planning, and read-only validation only. It never silently
creates or modifies Jira resources.

A separate Jira bootstrap lifecycle performs `preview -> approve -> apply ->
verify/reconcile`. Its default new-stack topology is compatible with Jira Free:

- one dedicated Jira project/space per ordinary product repository by default;
- one primary Kanban board and backlog;
- one saved filter binding the board to the project;
- Jira versions for releases;
- repository, primary/development branch, and deployment-environment mappings;
- optional Dev or Release boards only when the owner selects them in preview.

Initialization also asks whether the repository belongs to a larger program or
whether one unusually large task needs separately governed phases. A program
may intentionally use multiple project/spaces, and a large task may use
multiple phase scopes, but each scope needs its own key, repository/branch and
environment mapping, preview digest, approval, operation ledger, and
qualification evidence. The current executable bootstrap provisions one
project/space per preview; multi-space orchestration is a recorded requirement,
not a shipped capability.

The preview binds the Jira provider shape. A Jira Software project uses a
saved filter plus the Jira Software Agile-board API. A Jira Business project
uses the project-management template, the same saved delivery filter, and its
native business-space Board view. Apply reads the tenant's accessible project
types before project creation and fails before mutation when the selected type
is unavailable. It never tries to create a Jira Software board for a Business
space.

Jira board/project counts are not the limiting Free-plan resource. KStack must
minimize dependence on Jira automation because Jira Free currently permits only
100 successful automation rule runs per month. GitHub Actions and KStack remain
the execution plane; Jira is the human delivery and release ledger.

## Persisted onboarding states

The project-local delivery-stack record uses a closed versioned schema and one
of these states:

| State | Meaning | Mutation allowed |
|---|---|---|
| `skipped` | Owner declined Jira for this repository. | No |
| `existing-unverified` | Existing identifiers were recorded but not proven. | No |
| `existing-validated` | Tenant, project, board/filter, permissions, and mapping were read back. | No |
| `new-previewed` | Exact proposed resources and operations were written and hashed. | No |
| `new-approved` | Owner confirmed the exact preview hash in an interactive approval. | Apply only |
| `applying` | One bounded execution owns the operation ledger. | No concurrent execution |
| `ambiguous` | A request may have taken effect but read-back is inconclusive. | Reconcile only |
| `verified` | Every planned resource exists with the exact admitted identity and mapping. | No |
| `failed` | A proven pre-effect or rejected operation failed. | Re-preview or reconcile |

Configuration alone never upgrades an onboarding state. `kstack-design` may
consume only `existing-validated` or `verified` as a real delivery mapping.

## Preview schema and binding

The canonical preview binds:

- Jira tenant origin and expected account identity (never credentials);
- mode (`existing`, `new`, or `existing-add-board`);
- project key, name, Jira project type, and template identifier;
- every saved filter name and canonical JQL;
- every board name, type, purpose, and filter reference;
- issue types, workflow expectation, components, and version policy;
- GitHub repository identity, default/development branches, and environments;
- ordered resource operations and their stable local operation IDs;
- KStack configuration digest and preview schema version.

The canonical UTF-8 JSON bytes are SHA-256 hashed. Approval is valid only for
that hash and expires using the Jira approval TTL. Any plan, config, identity,
tenant, repository, or target-state drift invalidates approval.

## Existing-stack validation

Read-only validation must prove:

1. `/myself` resolves the intended Jira account as far as tenant privacy permits.
2. The project ID/key and type exist and the identity can browse it.
3. The selected board exists, is Scrum or Kanban as declared, and resolves to
   the admitted saved filter.
4. The filter JQL is project-bounded and readable by the executing identity.
5. Issue types and create metadata satisfy the configured ticket queue.
6. Version/release access and the GitHub repository/branch/environment mapping
   are explicit; unavailable GitHub linkage is reported, never inferred.

The validator reports `existing-unverified` on incomplete evidence. It does not
offer to create missing resources without a newly hashed preview.

## Apply and reconciliation

New-stack apply uses the Jira Cloud project, filter, and provider-appropriate
board APIs in the preview's order. Business-space board verification reads the
project workflow and requires the `new`, `indeterminate`, and `done` status
categories; it does not issue a Jira Software board POST. Before every POST it
checks whether the exact intended resource already exists. After every POST it reads the resource back and stores
only IDs, normalized metadata, response class, timestamps, and request/response
digests with secret-bearing fields excluded.

Known 4xx rejection before an effect is `failed`. Connection failure proven to
occur before transmission is `failed`. Timeout, redirect, 5xx, malformed
success, connection loss after an uncertain write, duplicate-name ambiguity,
or inconclusive read-back is `ambiguous`. An ambiguous operation is never
retried by apply. Reconciliation searches by the exact admitted identity and
  either adopts one exact match, proves absence and returns to `new-previewed`
  for fresh approval, or requires a human decision for multiple/mismatched
  candidates.

Project, filter, or board deletion is not automatic rollback. Deletion is a
separate destructive action; a partial stack remains inventoried with manual
cleanup guidance. This prevents recovery from destroying a pre-existing Jira
resource that happened to share a name.

Bounded, sanitized Jira `errorMessages`, field errors, and top-level messages
are retained for deterministic failures. Authorization headers, credential
values, arbitrary response fields, and more than 1,024 characters are never
persisted. This makes a rejected request diagnosable without expanding the
secret boundary.

## Authority and secret boundary

Ticket creation and Jira administration are separate actions. Project, filter,
board, workflow, component, version-policy, or repository-link mutations require
an explicit Jira-administration approval in addition to any ticket-creation
setting. Init, discovery, preview, show, validation, and reconciliation searches
do not imply mutation authority.

No token or password may appear in a preview, hash-confirmation prompt, receipt,
review packet, or model-visible command. The existing Jira credential resolver
is transitional; the new secret broker will replace ordinary environment/file
custody without changing the bootstrap state machine.

## Skill behavior

`kstack-init`:

- asks existing/new/skip in a group of no more than three decisions;
- discovers repository, branches, CI, and environments instead of asking for
  facts already available;
- writes `skipped`, `existing-unverified`, or `new-previewed` evidence;
- never invokes apply.

`kstack-design`:

- reads the delivery-stack record when Jira is enabled;
- uses only validated mappings for Jira work-item drafting and release linkage;
- reports incomplete onboarding as a release-readiness gap;
- may offer a new offline preview but never Jira mutation.

The host-side bootstrap executor owns approval, apply, and reconciliation. A
host that cannot enforce approval truthfully reports the command as unavailable
and prints the manual approved command; it cannot downgrade to detect-only and
claim completion.

## Verification

Tests must cover:

- existing/new/skip and existing-add-board previews;
- deterministic canonicalization and approval invalidation on every bound field;
- Free-compatible one-project/one-Kanban default and optional-board opt-in;
- accessible project-type preflight and both Software/Agile and
  Business/native-board provider paths;
- project/filter/board read-back success and mismatches;
- no POST during init, preview, show, validate, or reconcile-search-only paths;
- exact-match adoption, proven absence, duplicate ambiguity, timeout, redirect,
  4xx, 5xx, malformed success, and crash cuts after each operation;
- approval expiry, config/identity/tenant drift, concurrency, and resume fencing;
- receipts and all failure output contain no credential or authorization value;
- legacy `.kstack/config.json` and existing ticket-queue behavior remain valid.

Live Jira qualification is separate from mocked conformance. On 2026-08-28 an
enrolled Jira Cloud tenant exercised authentication, unavailable-type failure,
known-4xx diagnostics, partial project/filter creation, read-only
reconciliation, a newly hashed Business/native-board repair, exact-match
adoption, and final project/filter/workflow read-back. No tenant URL, account,
credential, local resource ID, or user-specific configuration is part of this
design record. The Business/native-board target is therefore qualified for
this path. Jira Software board creation and multi-space orchestration remain
unqualified until separately exercised.

## Primary references

- Jira plans and Free limits:
  <https://www.atlassian.com/software/jira/guides/more/jira-editions>
- Jira project API:
  <https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/>
- Jira board API:
  <https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/>
- Jira and GitHub workflow/deployment linkage:
  <https://support.atlassian.com/jira-cloud-administration/docs/link-github-workflows-and-deployments-to-jira-issues/>
