# KStack Secret Broker — out-of-sequence fence narrowing on the WP13-LINUX cell

**Date:** 2026-09-02
**Thread:** `secret-broker-2026-08-28`
**Status:** implementation complete; independent review pending
**Prior:** SB-WP00 baseline fence, SB-WP01 public boundary, SB-WP02 config/package
foundation, SB-WP03 protected control plane

This is the "later reviewed implementation item" that `SECRET_BROKER.md` names as
the only way to narrow the global implementation fence. It narrows the Linux half
of that fence and nothing else. It amends no accepted SB-TC00–SB-TC12 item, and
every accepted digest is unchanged.

## 0. Work-package label, and what this item is not

An earlier draft of this document was filed as `SB-WP06`. That label was wrong and
has been corrected. SB-TC12's accepted sequence table reserves WP06 for the
"backend framework and OpenBao identity/bootstrap/readiness adapter" — different
work entirely. The Linux Secret Service cell is WP13-LINUX in that same table:
"optional Linux desktop Secret Service local-development cell."

This item is **out-of-sequence fence narrowing on the WP13-LINUX cell, not a work
package**, and the distinction is load-bearing rather than cosmetic. SB-TC12
section 8 is a closed table of delivery units with no precursor category, so
attaching any sequence-relative status to work the table does not authorize would
repeat the rejected `DEV_SYNTHETIC` rollout claim in a new form. Section 8 also
requires a distinct Jira implementation item *before* code is advanced; this work
cites none, and calling it a work-package precursor would leave a conformance gap
that cannot be closed retroactively. Naming it maintenance on a package that has
not begun is the only label that leaves no violation behind.

SB-TC12 makes WP13-LINUX depend
on WP07–WP12, and none of those exist: there is no protected supervisor (WP07), no
lifecycle engine (WP08), no host coordinator (WP09), no importer framework (WP10),
no routed skill/install-health v2 (WP11), and no adversarial qualification harness
(WP12). WP04 (identity/policy/lease) and WP05 (audit chain, external head,
evidence authority) are likewise unbuilt, and WP05's absence is the same missing
authority that made this item's earlier `DEV_SYNTHETIC` rollout claim
unsupportable — see section 2.

So this item claims only what it did: it replaced an unconditional fence with a
mode-class gate, and produced the first runtime evidence that the Linux worker's
lifecycle code executes at all, against protocol doubles. It does not open,
satisfy, or partially discharge WP13-LINUX, whose entry conditions remain blocked
behind six unbuilt work packages. No future item should cite this one as evidence
that the Linux cell has begun.

## 1. Problem

`kstack-secret-broker.mjs status` reported `UNAVAILABLE /
IMPLEMENTATION_NONCONFORMANT`, and every Linux worker mode failed at a single
unconditional `fail('KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE')` placed
between argument parsing and mode dispatch. The worker's own lifecycle,
adapter, enrollment, rotation, revocation, and inventory implementations were
complete but had never executed. Nothing downstream of that line had ever been
observed running, so the repository held a fully written Linux cell with zero
runtime evidence that any of it worked.

## 2. What this item changes

The unconditional fence becomes a mode-class gate. Its authorization is this
document's own clause in `SECRET_BROKER.md` that the fence may be narrowed by a
later reviewed implementation item — **not** an SB-TC10 section 10 rollout-state
transition. An earlier draft of this item claimed the cell had entered
`DEV_SYNTHETIC`; independent review correctly rejected that as motivated
reasoning, because section 5's threshold table requires a threshold-signed
`ROLLOUT_CHANGED` event for any rollout advance and no such authority exists.
The admitted set is bounded by the same isolated-generated-fixture principle
`DEV_SYNTHETIC` describes, and the code constant retains that name to mark the
intent, but no artifact asserts the cell is in that state:

| Mode | Disposition | Reason |
|---|---|---|
| `Probe` | admitted | generated fixture, isolated handle namespace, confirmed clear-and-verify |
| `SyntheticLifecycle` | admitted | generated fixtures only, isolated state root, cleanup asserted |
| `SyntheticJiraAdapter` | admitted | generated fixture against a loopback target |
| `EnrollInteractive` | fenced | accepts an owner value |
| `RotateInteractive` | fenced | accepts an owner value |
| `Revoke` | fenced | mutates the persistent handle root |
| `JiraAuthCheck` | fenced | resolves a stored value and contacts a real target |
| `Inventory` | fenced | reads the persistent handle root; no DEV_SYNTHETIC purpose |

Fenced modes keep the identical `KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE`
code and still fail before probing custody, changing state, resolving a value, or
contacting a target.

`status` gains a `cells` section reporting the cell identity, its single adapter,
and the admitted mode set, all from source constants, at fixed
`evidenceLevel: "NONE"` and `claim: "BOUNDARY_ONLY_NOT_AUTHORITATIVE"`. It
reports no rollout state and measures nothing about the host; see section 12
finding 5 for why.

The synthetic test seam is tightened as a direct consequence of admitting these
modes. `--test-root` must name a path the worker creates itself: an existing
path is refused, so the recursive cleanup that runs on every exit path can only
ever delete the worker's own tree.

The Windows worker is untouched and remains fenced in full. The WP03 control
plane is untouched.

## 3. Why the admitted set is a code constant

The admitted modes are a `Set` literal in the worker source. There is
deliberately no rollout-state file, environment variable, config key, or CLI
argument that can widen it.

SB-TC10 section 5 requires that qualification currentness never derive from a
mutable index and that a caller-supplied index cannot authorize work. A writable
rollout state would be exactly that: any principal who can write the repository
could promote the cell to a state admitting owner values. Advancing beyond
`DEV_SYNTHETIC` therefore requires editing reviewed source, which is a reviewed
implementation item, which is the control SB-TC10 section 10 actually asks for
("advancement is a host-owned operator action"; "automation cannot advance a
state").

A regression test asserts the admitted set and its complement exactly, so
silently widening the gate fails the suite rather than passing unnoticed.

## 4. Why `Probe` is admitted

`Probe` contacts the real Secret Service, which SB-TC10 section 9 `DISCOVERED`
forbids, so it is not admitted as discovery. It is admitted as an isolated
synthetic fixture: section 2 rule 3 permits newly generated non-production
credentials, and section 6.B names a qualification-only canary as a mandatory
case that cannot be executed at all while `Probe` stays fenced. `Probe`
generates a random 32-byte value, stores it under a random UUID handle, reads it
back, clears it, verifies the clear, and reports only a fixed availability
record. It never touches the persistent handle root and never sees an owner
value. It refuses `--test-root` and `--test-secret-tool` twice over — once in
argument parsing and once by nulling both before use — so the real-backend canary
cannot be satisfied with the protocol double.

Two honest qualifications on this. First, `Probe` and an argument-less
`SyntheticLifecycle` run against the operator's real login keyring, which is not
the "fresh isolated backend namespace" section 5 asks for; the isolation is by
random handle, not by namespace. Second, cleanup is now confirmed rather than
assumed: the store is treated as having happened before the call returns, so a
provider that writes the item and then emits any output still gets cleaned up.
In the two synthetic modes an unconfirmable discard on an otherwise successful
run fails that run with `KSTACK_SECRET_LINUX_CLEANUP_UNCONFIRMED` and withholds
the PASS record entirely; cleanup uncertainty on an already-failing run does not
mask the original error. That guarantee is narrower than it first appears, and
the next paragraph states its real limit. `Probe` alone confirms cleanup inline,
clearing and then re-reading inside its own success path, so it needs no post-run
escalation.

Third, that inline verification was itself defeated until round 3. `lookupSecret`
treated exit 1 with empty stdout as a confirmed absence without inspecting
stderr, and a locked Secret Service collection produces exactly that shape. A
`Probe` whose collection locked after the store therefore read "absent" from a
lookup that had actually failed, concluded the clear had worked, and exited 0
reporting available custody while its generated value stayed in the operator's
real login keyring. Independent review demonstrated this against the shipped
worker. The early return now additionally requires empty stderr, matching
`storeSecret` and `clearSecret`, which already treated any stderr byte as
failure; that early return was the only place in the worker that did not.

The regression coverage is narrower than the defect, and the gap is worth stating
exactly. `tests/helpers/locked-collection-secret-tool.mjs` pins the fix through
`SyntheticLifecycle` only, verified by mutation: with the stderr condition
removed the same run exits 0 and publishes a full PASS record, and with it
present the run fails `KSTACK_SECRET_LINUX_CLEANUP_UNCONFIRMED` with empty
stdout. `Probe` cannot be covered this way, because it refuses
`--test-secret-tool` by design so that the real-backend canary cannot be
satisfied with a double — the property that makes `Probe` trustworthy is the
same property that makes its own defect untestable here. `SyntheticJiraAdapter`
still holds its item when cleanup runs, so the locked branch never fires and it
passes with or without the fix. `Probe`'s fix therefore rests on the shared code
path and on review's demonstration, not on a test in this suite, and confirming
it needs a real Linux desktop session under
`KSTACK_LINUX_SECRET_QUALIFICATION=1`.

A residual limitation is recorded rather than fixed here, because closing it is a
separate change that should be reviewed on its own. `discardSecret` looks the
item up and clears it, but never re-reads afterward, so a provider whose `clear`
exits 0 without deleting is still reported as `CONFIRMED`. Review demonstrated
this against both synthetic modes: each published a complete PASS record at exit
0 with the item still present.

An earlier draft of this paragraph claimed `Probe` and `SyntheticLifecycle` were
both covered because each re-reads after clearing. That is false for
`SyntheticLifecycle` and the correction matters, because it is the difference
between one uncovered mode and three. Its clear of generation 2 is followed by a
read of generation 1, not of the generation it cleared; its clear of generation 1
is followed by a denial served from the tombstone through `readRecord`, which is
a filesystem check and never a backend lookup. No cleared generation is re-read
from the backend in that mode. `Probe` is the only mode that re-reads what it
cleared, so `Probe` alone is covered.

`SyntheticJiraAdapter` is where this gap is worst, and an earlier draft of this
paragraph said the opposite. It claimed the shape was "unreachable" there because
the mode's clear is its final backend call. That inverts the finding. What is
unreachable in that mode is the *observation*, not the defect: a lying clear
always fires there and nothing will ever notice, because the mode never re-reads
and no later call can contradict the clear's own exit status. It is the mode with
no coverage at all, and the earlier sentence read as reassurance about exactly
that. A reader should take it as the first place to look, not the last.

Two distinct gaps are involved and they should not be run together. The one above
is the no-op clear, which no mode detects except `Probe`. Separately, the
locked-collection escalation that round 3 fixed *is* reachable in the adapter:
its `discardSecret` takes the same `missingAllowed` path as every other mode, and
review drove it there with a double that locks after the first successful lookup
rather than on clear, confirming the adapter discriminates that fix as cleanly as
`SyntheticLifecycle` does. This suite's fixture cannot reach it, but the mode
can, so section 13 item 4 records it as reachable and unpinned rather than as
absent coverage.

## 5. What this does NOT change

1. **Top-level status is unchanged and still accurate.** `UNAVAILABLE /
   IMPLEMENTATION_NONCONFORMANT` remains correct: SB-TC10 section 5 makes the
   external evidence authority the sole source of an evidence level, and that
   authority does not exist. Neither does WP04 (trusted identity/time/lease) nor
   WP05 (audit event chain, MAC/key custody, receipts). No cell can hold a level
   above `NONE`, so the accepted-design registry is unchanged and
   `loadSecretBrokerDesignRegistry` still requires it to declare exactly those
   two strings.
2. **No cell is qualified.** Passing the three admitted modes is a mechanism
   precedent, exactly as SB-TC10 section 15 says of existing tests. It is not
   `SYNTHETIC_QUALIFIED`, which additionally requires the full section 6 matrix,
   the leak positive-control harness of section 7, the resource envelope of
   section 8, confirmed cleanup, an unbroken evidence chain, and an independent
   security review recorded through the section 5 authority.
3. **No new credential class is unblocked.** See section 7.
4. **No enforcement is added anywhere.** See section 6.

## 6. Owner requirement: never block without a replacement

The owner's hard requirement is that plain-file use must never be blocked or
deprecated before a working replacement exists. This item satisfies it by
construction, and the current state was verified rather than assumed:

- Nothing in this repository prevents an owner from using a plain credential
  file in their own code or runtime. This item adds no gate, hook, lint,
  pre-commit check, or deprecation warning.
- The one enforcement that does exist is unchanged and predates this work: the
  KStack safety hook (`plugins/kstack/hooks/hooks.json` ->
  `kstack-safety-hook.mjs` with `kstack-safety-matchers.mjs`) scans tool inputs
  and denies *model-facing* reads that would surface secret-shaped bytes into
  model context. That is the control the 2026-08-29 operational note in
  `SECRET_BROKER.md` exists to enforce, and it protects the owner's values rather
  than restricting their use.
- The direction of this item is strictly permissive: modes that previously all
  failed now partly succeed. There is no state in which this change causes a
  workflow that worked before to stop working.

A regression test asserts that the fenced mode set did not shrink, which is the
mechanical form of "this item removed no capability."

## 7. Known gap this item does NOT close

The Linux cell serves only `jira-cloud-auth-v1` against
`https://TENANT.atlassian.net`. Four independent places enforce it:
`enroll` rejects any other `adapterId`; `assertTarget` rejects any non-Atlassian
origin; `readRecord` rejects any stored record with another adapter; and
`createSecretMigrationPlan` marks every non-Jira inventory entry
`TARGET_ADAPTER_NOT_IMPLEMENTED`.

A credential for any other provider API — including the third-party email service
credential that motivated this work — therefore cannot be enrolled through this
broker even with the fence fully lifted and a real keyring attached. That gap is
an adapter gap, not a fence gap. Closing it requires a new reviewed SB-TC04
adapter item and is explicitly out of scope here. `SECRET_BROKER.md` and the
`kstack-secrets` skill now both state this plainly so no future session plans a
migration the worker will reject.

## 8. Evidence produced

Against the deterministic protocol double
(`tests/helpers/fake-secret-tool.mjs`), on this host:

- `SyntheticLifecycle`: `enrollment`, `use`, `rotation`, `recovery`,
  `revocation`, and `nonResurrection` all `PASS`, `valueOutputBytes: 0`.
- `SyntheticJiraAdapter`: `targetBinding` and `authentication` `PASS`,
  `redirectsDisabled: true`, `responseBodyDiscarded: true`,
  `valueOutputBytes: 0`.
- Both isolated state roots absent after the run.

This is the first time any of that code has executed. It is fixture evidence
against a double and is explicitly not backend qualification.

## 9. Evidence NOT produced, and why

`Probe` against a real Secret Service did not run. This host is WSL2 with no
`/usr/bin/secret-tool` and no admitted Secret Service provider. `Probe` fails
with `KSTACK_SECRET_LINUX_SERVICE_UNAVAILABLE` — a genuine absent-backend result,
and the proof that the implementation fence actually lifted, since the previous
failure code was `KSTACK_SECRET_LINUX_IMPLEMENTATION_UNAVAILABLE`. A regression
test asserts exactly this distinction.

`secret-broker-linux-jira-2026-08-31.md` already records that repository
authority denies device installation, so no package was installed and no real
backend claim is made. Completing real qualification needs, in order:

1. an owner decision to install `gnome-keyring` and `libsecret-tools`, or a real
   Linux desktop session with a provider already admitted;
2. `Probe`, `SyntheticLifecycle`, and `SyntheticJiraAdapter` passing against that
   provider in that exact session, via
   `KSTACK_LINUX_SECRET_QUALIFICATION=1` which unskips the regression test that
   already encodes this;
3. the SB-TC10 section 6 matrix, section 7 leak harness, and section 8 envelope,
   none of which exist yet;
4. WP04, WP05, and the section 5 external evidence authority before any level
   above `NONE` can be claimed.

Steps 3 and 4 are substantially larger than this item.

## 10. Files changed

- `plugins/kstack/scripts/kstack-secret-linux.mjs` — `DEV_SYNTHETIC_MODES`
  constant; unconditional fence replaced by the mode-class gate.
- `plugins/kstack/scripts/kstack-secret-broker.mjs` — `secretBrokerCellBoundary`
  and the `cells` field on baseline status.
- `plugins/kstack/references/SECRET_BROKER.md` — fence and Linux-cell sections
  rewritten; adapter limitation stated.
- `plugins/kstack/skills/kstack-secrets/SKILL.md` — work steps 1 and 2 corrected;
  adapter limitation stated.
- `tests/secret-broker.test.mjs` — nine tests replacing the three fence tests;
  32 tests total, 30 passing with two environment-gated skips.
- `tests/helpers/unconfirmable-secret-tool.mjs` (new) — protocol double whose
  absent lookups exit 2, driving cleanup into `CLEANUP_UNCONFIRMED`.
- `tests/helpers/locked-collection-secret-tool.mjs` (new) — protocol double that
  answers an absence it cannot vouch for with a lock diagnostic on stderr.
- `tests/reflexion-architecture-gate.mjs` — capability token and use-site pins.
- `plugins/kstack/secret-broker-release-manifest-v1.json`,
  `plugins/kstack/secret-broker-source-audit-manifest-v1.json`,
  `plugins/kstack/install-health-audit-manifest-v1.json` — regenerated by their
  own generators, not hand-edited.

**Manifest co-binding caveat.** `install-health-audit-manifest-v1.json` digests
every plugin script, so regenerating it in this working tree also absorbed
uncommitted work-in-progress content for
`plugins/kstack/scripts/kstack-jira-tracking.mjs` that was already staged in the
tree. That entry is not part of this item and is committed nowhere. This manifest is
therefore co-bound to whatever that file settles at: regenerate it once that
content resolves. `tests/reflexion-architecture.test.mjs` is red in this working
tree for the same reason — the staged content does not match its pinned
capability use-site digest. Neither the failure nor the fix belongs to this item, and
neither affects CI, which sees only committed content.

Two working practices came out of this and are worth keeping rather than
rediscovering. Regenerate both manifests as the last step before a suite run, not
partway through a change: doing it mid-change produced a spurious ten-failure run
here whose only cause was the worker moving after the manifests were built. That
run is the author's own observation and was not reproduced or corroborated by
review, which saw only single-failure reds. And the underlying weakness is not
this instance — a gate that any agent's unrelated edit turns red will keep
producing it. That belongs to whoever owns the architecture gate, as its own
item, not to this one.

## 11. Independent review round 1

An independent adversarial reviewer that did not write this change returned
`revise / 82` and confirmed by execution that the gate itself cannot be widened
by any argument, environment variable, or file; that all five fenced modes fail
with the exact original code; that no admitted mode reaches the persistent handle
root; that all 13 accepted item digests plus the closure receipt still match; and
that the Windows worker and WP03 control plane are untouched.

Findings accepted and fixed in this revision:

1. **High — `--test-root` was a live destructive primitive.** The synthetic modes
   recursively delete their root on every exit path, and the root was taken
   verbatim from the caller. Because `ensurePrivateDirectory` chmods a directory
   rather than rejecting it, a user-owned `0755` tree was accepted and destroyed.
   This was pre-existing code that only became reachable when the fence lifted.
   Fixed: the worker now refuses an existing path and creates the root itself
   non-recursively, so the delete is provably confined to its own tree. Verified
   by re-running the reviewer's exploit against a populated victim tree on all
   three failure paths.
2. **High — the skill authorized a model-facing process to spawn the worker.**
   Step 1's prohibition had been narrowed to owner-value modes and step 2 read
   "may now run", which contradicted this document's own section 9 and made
   finding 1 model-reachable. Fixed: the prohibition covers all worker modes
   again, and qualification is routed through the guarded test.
3. **Medium — `Probe` could leave its generated value in the real keyring.** The
   `stored` flag was set after `storeSecret` returned, so a provider that stored
   the item and then emitted a warning byte skipped cleanup entirely, and
   `discardSecret` swallowed every failure in a bare `catch {}`. Fixed as
   described in section 4.
4. **Medium — `status` asserted an unauthorized rollout state.** Fixed; see
   section 2.
5. **Medium — `cells` published the section 9 `DISCOVERED` predicate as a mutable
   index,** using a weaker tool check than the worker's own. Fixed by removing
   the host measurements entirely rather than by relabelling them.
6. **Medium — the install-health manifest absorbed another agent's file.**
   Documented in section 10 rather than silently carried.
7. **Medium — the drift test bound one of three mirrored constants.** Fixed by
   deleting the two unbound constants, which finding 5 made unnecessary; the one
   that remains is genuinely bound.
8. **Medium — the newly live test seam had no behavioral coverage.** Fixed by
   adding spawn-based tests for an existing root, a relative root, a
   group-writable tool, a non-`.mjs` tool, each half of the pair supplied alone,
   and `Probe` refusing the double.

Not adopted, with reasons: the reviewer's note that `probe()` allocates an unused
temporary directory is correct but is pre-existing dead code outside this item's
scope; the `schemaVersion` on baseline status is left at `-v1` because nothing in
or outside the repository consumes it with exact-key semantics and bumping it
would churn the release manifests for no consumer benefit. Both are recorded
here so a later item can pick them up.

### Round 2 — two further defects found in the round-1 fixes

Reviewing my own fixes surfaced two more, both confirmed by execution before
being corrected:

9. **The cleanup escalation published a PASS record before it fired.** Both
   synthetic modes called `safeResult(...)` as the last statement inside `try`,
   while the `CLEANUP_UNCONFIRMED` check ran after `finally`. A run that could
   not confirm cleanup therefore wrote a complete
   `enrollment/use/rotation/recovery/revocation/nonResurrection: PASS` record to
   stdout and *then* exited 1 — a false-success artifact worse than the silent
   no-op it replaced, since SB-TC10 section 5 makes UNCONFIRMED block the run.
   Fixed: both modes now build the record inside `try` and publish it only after
   cleanup reports success, so a published pass is never one the worker already
   knew had failed to clean up. It is not proof the item is gone; see section 4.
   The single
   `process.stdout.write` call site is unchanged. Proved with a new protocol
   double, `tests/helpers/unconfirmable-secret-tool.mjs`, which exits 2 rather
   than 1 on the lookup of an absent key so that only cleanup, never the run
   itself, becomes unconfirmable; the regression test asserts exit 1, the exact
   error code, and empty stdout.
10. **`probe()`'s post-`finally` check was unreachable on every path.** On
    success `stored` is already false when `finally` runs, so `cleanup` was never
    assigned; on failure the original exception propagates past the check. An
    earlier draft of section 4 claimed the escalation guarded Probe, which was
    vacuous. Removed the dead check and its variable: Probe's real protections
    are the pessimistic `stored` flag and its inline clear-and-verify, and the
    escalation guards the two synthetic modes, where it is genuinely reachable.

## 12. Deterministic review checks

This item closes only if a reviewer confirms:

1. no accepted SB-TC00–SB-TC12 digest changed and the design registry is
   byte-identical;
2. every mode that can reach an owner value or the persistent handle root is
   still fenced at the unchanged error code;
3. the admitted set cannot be widened by any file, environment variable, or
   caller argument;
4. `status` reports no evidence level and cannot be read as authorization;
5. the change removes no capability and adds no enforcement;
6. real backend qualification is claimed nowhere; and
7. the Jira-only adapter limitation is stated wherever a future session would
   plan a migration.

## 13. Recorded, not closed

Independent review returned `revise / 88` on the round-3 tree with one blocking
finding, the locked-collection false absence, which section 4 records as closed.
Everything below was raised by that review, judged real, and deliberately left
open. None of it is claimed as done, and a later session should treat this as the
starting worklist rather than assuming the cell is clean.

1. **Failure-path cleanup state is discarded in all three modes.** When the body
   throws, `discardSecret` still runs in `finally` and its result is assigned,
   but the original error propagates past the check that would report it. So the
   path where residue is most likely — the store succeeded and the provider then
   failed — is the one path that never surfaces an unconfirmed cleanup. The
   escalation only fires on runs that otherwise succeeded.

   Review reproduced this by execution rather than by reading. Against a double
   that stores successfully and then reports every lookup as a locked collection,
   both synthetic modes issue `store` and then only failing lookups, never a
   `clear`, and exit 1 with `KSTACK_SECRET_LINUX_LOOKUP_FAILED`. The fixture is
   left in the backend. `discardSecret` returned `UNCONFIRMED` — it could not do
   otherwise, its own lookup threw — and that result was assigned and then
   stepped over. A run that left a credential behind and a run that cleaned up
   perfectly report the identical thing, and on a real desktop session the
   difference is a synthetic credential resting in the operator's login keyring.
   This is the round-3 finding's mirror: cleanup uncertainty silently resolved as
   fine, relocated from the success path to the failure path, and the failure
   path is the likelier one in practice because a provider that fails mid-run is
   exactly when residue happens.

   Severity is medium and deferral is deliberate. No PASS is published, the run
   fails loudly, and the receipt stays content-free, so nothing downstream treats
   a bad run as good; this is a missing disclosure on an already-failing run, not
   a false success. There is no one-line fix, and the open question is a genuine
   design tension the next session should inherit rather than rediscover: the
   receipt is a single fixed code, the current comment deliberately prefers the
   original error as the more informative one, and surfacing residue means
   choosing among a distinct error code, a second stderr line that breaks the
   fixed-receipt shape, or a retry that can itself fail. Each has a real argument
   against it, which is why this belongs in its own reviewed round alongside
   item 2.
2. **`discardSecret` never verifies its own clear.** It looks the item up, clears
   it if present, and returns `CONFIRMED` without re-reading. A provider whose
   `clear` exits 0 without deleting is therefore reported as confirmed, and
   review demonstrated both synthetic modes publishing a full PASS record with
   the item still present. Only `Probe` re-reads what it cleared; see section 4
   for why `SyntheticLifecycle` does not, despite appearances.
   `SyntheticJiraAdapter` is the worst case and the first place to look: a lying
   clear always fires there and nothing can ever notice, because no later call
   contradicts the clear's own exit status. Closing this changes cleanup
   semantics in all three modes and belongs in its own round.
3. **Test-boundary rejection cases are unpinned.** A symlinked `--test-root`,
   both dangling and pointing at a populated tree, and a symlinked parent
   component are all correctly refused, but nothing pins that. These are the
   exact bypass class for the `existsSync` guard added for the round-1
   destructive-delete finding, so they are the highest-value missing tests.
4. **`SyntheticJiraAdapter`'s cleanup escalation branch is reachable but
   unpinned.** Review reached it with a double that locks after the first
   successful lookup rather than on clear, and confirmed it discriminates the
   round-3 fix as cleanly as `SyntheticLifecycle` does. Only this suite's fixture
   cannot reach it; the mode can.

5. **`probe` clears its `stored` flag on the backend's own report.** It sets
   `stored = false` immediately after `clearSecret`, then the next statement
   re-reads precisely because that report is not trusted. If the re-read finds
   residue, `PROBE_CLEAR_FAILED` fires and the `finally` skips `discardSecret`
   because the flag is already false — so the one mode that detects a lying clear
   is the one that then declines to clean up after it. Moving `stored = false`
   below the check closes it. Low severity: the run fails loudly either way.
6. **A nonexistent `--test-secret-tool` surfaces as
   `KSTACK_SECRET_LINUX_INTERNAL_ERROR`** rather than the specific
   `TEST_TOOL_UNTRUSTED`.
7. **Not verifiable in this environment.** Whether a real gnome-keyring emits
   stderr on store and lookup, and whether a locked collection genuinely returns
   exit 1 with a diagnostic, both remain unconfirmed. The code-level defect in
   section 4 stands regardless, but its real-world severity rests on that shape
   being common. Confirming it needs a real Linux desktop session with an
   unlocked keyring under `KSTACK_LINUX_SECRET_QUALIFICATION=1`, which this
   headless WSL environment cannot provide. Whether a real `secret-tool clear`
   can exit 0 without deleting is unverified for the same reason: item 2 above
   records what the worker does if that happens, not evidence that it does.
   `Probe` compounds this, because it refuses the test seam by design, so the
   fix site that motivated the round-3 finding is exercisable only in that same
   unavailable real-backend test.
