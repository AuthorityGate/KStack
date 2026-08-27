# KStack Jira queue implementation contract

The Jira queue supports Jira Cloud only. Configure it under `jira` in
`.kstack/config.json`, then run `kstack-jira.mjs doctor` before relying on a new
site. The exact one-label `.atlassian.net` rule blocks typos and suffix tricks;
it does not stop credentials being sent to an attacker-owned Atlassian tenant.
Doctor's `/rest/api/3/myself` check only detects a wrong tenant after credentials
have been transmitted, and only when doctor runs. When Jira exposes
`emailAddress`, doctor compares it case-insensitively with the once-trimmed
`resolvedEmail`; when site-wide email visibility hides it, doctor warns that the
assertion was unavailable and reports `accountId` only.

Doctor smoke-tests the two paginated createmeta endpoints,
`mypermissions?projectKey=...&permissions=BROWSE_PROJECTS`, and cursor
pagination for `POST /rest/api/3/search/jql`. `BROWSE_PROJECTS` is necessary
but not sufficient evidence of issue visibility. Doctor warns when a project
has an issue-security scheme—or when that check cannot be completed—because a
project default, workflow, or automation may hide the created issue. Setting
the `security` field directly remains unsupported in v1.

`maxAttempts` means total physical POSTs, including the first; `1` disables
inline retry. Unclear Node/undici errors always classify as `unknown`; only a
positively recognized DNS, refusal, reachability, or TLS pre-connection code is
`failed`. A retry sequence cannot become definitely failed after an earlier
429, whose side-effect status is ambiguous.

Attempt outcomes are `in-flight`, `success`, `failed`, `ambiguous`, and
`aborted-before-post`. Recovery uses a matching `posted:false` sidecar as
definitive no-POST evidence only when it also carries
`responseClass: "aborted-before-post"`. Once any POST may have been
side-effecting, the invocation retains `posted:true` until the final response
classification is durably written.

Every submit preflight refuses unresolved `duplicate-detected` markers or
direct `posted:true` issue-key evidence with exit 6. `resolve` is required
before another POST. Direct evidence arriving after `discarded` can only be
acknowledged with `--issue-key`, never dismissed with `--distinct`; the
audit-only acknowledgment does not revive the draft. Direct evidence on
`unknown` is also accepted by `resolve` without requiring a prior
`reconcile-matches` entry.

A no-sidecar `submitting` recovery becomes `unknown`/`ambiguous` and follows
reconcile-from-unknown rules: only a completed, visibility-checked zero-match
poll returns it to `approved`. This is the chosen resolution of the trigger-(d)
wording; verify-mode zero-match semantics do not override the recovery state
transition. A matching `posted:false` sidecar instead returns directly to
`approved` as `aborted-before-post`.

Search-based `verify-clear` requires both a completed full poll and every marker
it retires to be at least as old as the §7 bounded poll minimum, with a 30-second
floor. Direct evidence is never retired by `verify-clear`.
An inline zero-match after a 429 retry remains an unsatisfied trigger-(e)
marker: `status` continues to surface it until a later explicit verify clears
or confirms it, and another `submit` is refused while it remains unsatisfied.
This prevents the immediate check from overclaiming coverage when the earlier
issue indexes later. `reconcile --verify` is accepted on an `approved` draft
for this recovery-only condition.
Queue-wide `status` and `reconcile` sweeps use skip-held-and-continue: held
drafts are reported while other drafts and artifacts are still processed.

Jira queue state-error exit code is 2. Exit code 20 means `unfreeze`, `submit`,
or `discard` was blocked solely because a completed zero-match search occurred
while a parseable youngest unresolved marker had measurable age below the Jira
search-index-lag floor. This specific duplicate-gate case previously surfaced
as exit 2; poll exhaustion, search failure, unmeasurable marker age, and
`submit`'s separate retry-verification-interval wait remain exit 2. Codes 10–12
are retired. Dry-run can return 0, 1, 2, 6, 8, 9, 13, 15, 20, or lock/fence codes
16–19. Code 1 covers config load/disabled-queue rejection; code 13 is reachable
when loading a hand-corrupted draft containing malformed Unicode.
`externalTicketCreation` is a calling-skill convention only; the Jira CLI does
not consult it.
