# KStack-to-Jira automated ticket queue — final consolidated design

Assembled from: Fable's round-6 architecture arbitration, round-8/9 patches
(non-locking), Fable's round-10 arbitration (locking/concurrency, first
pass), round-11's confirm-only findings, direct fixes for the
non-locking round-11 findings, Fable's round-12 arbitration
(locking/concurrency, second and convergence-final pass), round-13's
confirm-only findings, and a direct fix for round-13's one universally-
agreed critical gap (§7.7's missing zero-match verify-mode branch). Per
explicit owner direction after round 13, the remaining round-13 findings
(filesystem-semantics questions: directory fsync, `fs.rename` overwrite
safety, NFS `link()` semantics, `Retry-After` duration bounding, heartbeat
viability on this repo's own mount, and others — see "Open items" at the
end) are deferred as implementation-time verification tasks rather than
further design rounds, since they require testing against the real
filesystem/API to resolve, not additional paper review. Section numbering
preserved throughout for traceability across the full review history
(`.kstack/reviews/jira-ticket-queue-2026-08-17-r1` through `-r13`, and
`.kstack/qc/jira-design-fable-round6` / `-round10-locking` /
`-round12-locking`).

## §1. Config schema (final)

```
jira: {
  enabled: false,
  siteUrl: null,                    // https-only, no userinfo/path/query, no private/loopback/link-local host, hostname must match *.atlassian.net (enforced), validated at load
  projects: [
    { key: "KSTK", issueTypes: ["Task"], defaultFields: {} }
  ],
  credentialSource: {
    type: "env",                    // "env" | "file"
    emailEnvVar: "JIRA_EMAIL",
    tokenEnvVar: "JIRA_API_TOKEN"
    // "file" variant: { type: "file", path: "<absolute, outside repo>",
    //   allowInsecurePermissions: false }
    // File content: UTF-8 JSON, exactly {"email": "<str>", "token": "<str>"},
    // both non-empty, unknown keys rejected.
  },
  staticLabels: [],                 // non-empty strings; prefix "kstack-draft-" reserved/rejected
  timeoutMs: 15000,                 // range 1000-120000; governs request timeout and 429 in-invocation backoff only -- 408 never retries inline, see §7 (not locking, see §4.4)
  maxAttempts: 3,                   // range 1-5; governs in-invocation 429 retry count only (not locking, see §4.4)
  approvalTtlMs: 86400000,          // range 60000-604800000
  dryRun: false,                    // installation-wide safety switch, see §4 "submit --dry-run" below
  nodeMinVersion: "20.0.0"          // floor for global fetch, crypto.randomUUID, AbortSignal.timeout, String.prototype.isWellFormed
}
```

Validation at config load (via `kstack-config.mjs`, no parallel reader):
reject unknown keys; `siteUrl` HTTPS-only origin, no userinfo/path/query, no
private/loopback/link-local host, **and its hostname must match
`*.atlassian.net`** — **enforced, not merely declared** (round-14 fix: this
was previously stated as a design intent in prose without a matching
validation rule, which a reviewer correctly flagged as a real security-
policy gap, not a testing question — accepting arbitrary HTTPS origins
would let a misconfigured or malicious `siteUrl` receive the adopter's
Jira credentials). Data Center is an explicit v1 non-goal, consistent with
this enforcement and the private-host ban, stated in `--help` and the
skill; every `projects[].key` non-empty/unique, every
`issueTypes[]` non-empty; **`defaultFields` must not contain the reserved
keys `project`, `issuetype`, `summary`, `description`, or `labels`** (labels
is always program-controlled: `[idempotencyLabel, ...staticLabels]`; this
check is fully evaluable at load time since it doesn't depend on any
per-draft UUID); `credentialSource` matches exactly one of the two variants
above (no `keychain` variant present in v1 at all); a `file` source is
validated for existence/non-symlink/ownership/permissions at load
(`doctor`) — **fails closed**: not a regular non-symlink file, not owned by
the invoking user, or mode grants group/other access → config invalid (exit
1); on filesystems that don't enforce POSIX modes (e.g. `/mnt/*` drvfs
mounts — this repo's own filesystem), the check will typically fail unless
the file lives on a POSIX-honoring mount, or the adopter explicitly sets
`allowInsecurePermissions: true`, which `doctor` then flags loudly on every
run; **every string leaf AND every object key within a `defaultFields`
value tree, plus every `staticLabels` entry, must satisfy
`String.prototype.isWellFormed()`**, checked recursively at load time.

## §2. Draft file schema (final)

Path `.kstack/jira-queue/<uuid>.json`, one file per draft, `0700` directory,
`0600` files, temp-file-plus-fsync-plus-rename write idiom (the
`kstack-reflexion.mjs` idiom), guarded by the §4 locking primitive for
every mutation.

```json
{
  "schemaVersion": 1,
  "id": "<uuid>",
  "createdAt": "<ISO8601>",
  "updatedAt": "<ISO8601>",
  "sessionId": "<opaque, provenance only>",
  "state": "pending",
  "project": "KSTK",
  "issueType": "Task",
  "content": { "summary": "<text>", "descriptionText": "<plain text; ADF built in code only>" },
  "idempotencyLabel": "kstack-draft-<uuid>",
  "canonicalPayload": null,
  "payloadSha256": null,
  "configFingerprint": null,
  "approvedAt": null,
  "attempts": [],
  "audit": [],
  "result": null
}
```

`content.summary`/`content.descriptionText` must satisfy
`String.prototype.isWellFormed()`, enforced at `draft`/`edit` time (exit
13).

**State machine:** `pending ⇄ approved → submitting → submitted | failed |
unknown`, plus `discarded`, plus two additional edges introduced by
`resolve` (§4): `unknown → submitted` (entry state (a), multiple-match
reconcile resolved by a human) and `pending|approved → submitted` (entry
state (c), a stale-holder duplicate confirmed by a human via
`--issue-key`, §4.10's pre-discard/pre-unfreeze gate).

- `pending`: unfrozen (`canonicalPayload === null`) or frozen. Editable via
  `edit` (clears the freeze). Discardable — **unless refused by the
  ambiguous-history guard** (below).
- `approved`: frozen + human-confirmed, `approvedAt` set. Reversible to
  `pending` via `unfreeze` (audit-logged) — the recovery path for config
  drift or expired approval.
- `submitting`: written immediately before the POST, in the same guarded
  write that atomically appends the `attempts[]` row (`outcome: "in-flight"`,
  §4.10) — exactly one row per `submit` **invocation** by construction (see
  the cardinality note below — not one row per physical POST).
- `submitted`: confirmed success (via `submit`, `reconcile`, or `resolve`),
  `result` populated. `reconcile` remains valid in verify mode (§7.7) when
  triggered (§4.10).
- `failed`: definite non-retryable outcome. Strictly terminal. Recovery is
  `discard` + a fresh `draft --from <uuid>` (clones content, new UUID/label).
- `unknown`: ambiguous outcome. Requires `reconcile` before further action.
  A multiple-match reconcile stays `unknown` (never auto-discardable) unless
  resolved via `resolve` entry state (a).
- `discarded`: from `pending`/`failed` only.

**`attempts[]` cardinality (round-14 fix — corrects an internal
inconsistency two reviewers independently caught):** exactly one entry per
`submit` **invocation**, not per physical POST. A single `submit`
invocation may make multiple physical POST attempts internally (429
backoff retries, §7) — those intermediate attempts are logged to `audit[]`
(`{event: "retry-backoff", at, httpStatus, waitMs}`) as before; the
`attempts[]` row represents that invocation's *final* outcome only, created
`in-flight` at the `submitting` write and updated once mapped 1:1 from the
§7 response-classification table (`submitted` row → `success`; `failed`
row → `failed`; `unknown` row → `ambiguous`).

**Fenced-invocation exception, clarified (round-14 fix):** a process that
discovers it is fenced *before* attempting the `submitting` write cannot
author an `attempts[]` row at all — its outcome is recorded via a sidecar
file (§4.8), folded into `audit[]` as `stale-holder-outcome` by whichever
process later holds the lock (§4.7). This is distinct from the narrow §4.5
residue case: if the `submitting` write's rename physically lands
*before* the post-write fence recheck discovers the mismatch (the
disclosed microsecond race), the `in-flight` row genuinely exists on disk
despite the process being fenced at that instant — this is not a violation
of the exception, it is the already-disclosed residue, and that row's
presence is exactly what lets `reconcile` complete it later (as
`aborted-before-post` if a `posted:false` sidecar confirms no POST
occurred, or otherwise via the normal §4.10 recovery procedure). A
`reconcile` recovering a persisted `submitting` draft *completes* that
draft's existing `in-flight` row (never creates a new one). A `resolve`
transition from `pending`/`approved` (entry state (c), §4) synthesizes no
`attempts[]` row either — that path's evidence lives entirely in `audit[]`.

**Ambiguous-history discard guard:** `discard` is refused (exit 14)
whenever `attempts[]` contains an `ambiguous` outcome that has not been
cleared by a `verify-confirmed` audit entry (exact single-match verify-mode
result, §7.7) or a `duplicate-acknowledged` audit entry (human-resolved
duplicate, §4/resolve below) — checked against `attempts[]`/`audit[]`
history regardless of the draft's current state, so the
`unfreeze`→`pending`→`discard` path cannot bypass it. A human who wants to
discard anyway passes `--acknowledge-ambiguous-history` (required,
audit-logged: `{event: "ambiguous-discard-acknowledged", at, priorAmbiguousAttempts}`).
**This flag has no separate "clearing" semantics (round-14 clarification):**
it is a one-time override that permits `discard` to proceed despite the
unresolved ambiguity, not a claim that the ambiguity is resolved. There is
nothing further to clear because `discard` is terminal — once the draft is
gone, the guard has no further draft state to gate; the acknowledgment's
only lasting effect is the permanent audit-trail record of the override.
A bare `submitted` transition alone does **not** clear the guard — only an
explicit `verify-confirmed`/`duplicate-acknowledged` entry does, since a
submitted transition following an ambiguous attempt is exactly what verify
mode exists to double-check, not proof by itself. **This guard (keyed on
`attempts[]`) is independent of §4.10's pre-discard/pre-unfreeze gate
(keyed on `audit[]` evidence of a lock break) — each has its own clearing
entries, and clearing one never clears the other.**

## §3. Canonicalization (final)

JCS is not used. Exactly one process ever serializes the payload (at
`show`/freeze time); the resulting bytes are persisted verbatim in
`canonicalPayload` and every later operation reads and re-hashes those same
bytes, never reconstructing them. Fields object built in code with fixed
key emission order `[project, issuetype, summary, description, labels,
...defaultFields keys in adopter-configured order]` — no collision with the
five reserved keys is possible since §1 bans them from `defaultFields`.
**The unit hashed, stored, and transmitted is the UTF-8 encoding**:
`payloadBytes = Buffer.from(JSON.stringify(fieldsObject), 'utf8')`,
`payloadSha256 = sha256(payloadBytes)`, POST body is `payloadBytes` with
`Content-Type: application/json; charset=utf-8`. `canonicalPayload` stores
the JSON string form (lossless because §2 rejects non-well-formed input);
`submit` re-verifies `sha256(Buffer.from(canonicalPayload,'utf8')) ===
payloadSha256` before sending — mismatch is an internal-consistency error,
exit 15, state left unchanged (`approved`), flagged for investigation, not
blind retry.

**Authentication (round-14 fix — previously undefined despite everything
around it being precisely specified):** HTTP Basic auth, per Jira Cloud's
documented REST v3 contract. The resolved `email`/`token` pair (from
`credentialSource`, §1/§6) is combined as `base64(email + ':' + token)` and
sent as `Authorization: Basic <that value>` on every request (`show`'s
`createmeta` call, `submit`'s POST, `reconcile`'s search). Construction
happens in exactly one function — the same single choke point §6 already
requires for reading the credential in the first place — so the token is
never duplicated into more than one place in memory/logs. This header
value must be redacted by the shared redactor (§8) in any diagnostic output
exactly like the raw token itself, since it trivially decodes back to it.

## §4. Command surface and local locking/concurrency (final — Fable
## round-12 arbitration, convergence-final for the locking domain)

**Commands (authoritative list):** `doctor`, `draft [--from <uuid>]` (fully
offline — no `createmeta` call), `edit <uuid>` (`pending` only, clears
freeze fields), `show <uuid>` (`createmeta` preflight — checks every
required field is satisfiable **and that `labels` is a settable field for
the target project/issueType**, exit 3 listing what's missing/unsettable if
not, per round-14's fix closing a gap where `labels`' settability was
assumed but never actually checked; freezes, idempotent),
`approve <uuid> --payload-hash <sha>` (also TTL renewal on `approved`),
`unfreeze <uuid>` (`approved → pending`), `submit <uuid> [--dry-run]
[--live]` (`approved` only; the only command that initiates a POST),
`reconcile <uuid> [--verify]` (handles `unknown`, recovery from persisted
`submitting`, and `submitted` verify mode; `--verify` forces verify-mode
explicitly), `resolve <uuid> (--issue-key <KEY> | --distinct)` (three entry
states — see below), `list [--state]` (pure enumeration), `status`
(queue-wide health: sweeps the whole queue dir for unfolded sidecars,
tombstones, `released.*` files, and stale lock-tmp litter, folding/cleaning
per §4.7; surfaces every draft with an unsatisfied mandatory verify, an
unresolved `duplicate-detected`, or a held/stale lock — distinct from
`list`, which only enumerates), `discard <uuid> [--acknowledge-ambiguous-history]`
(`pending`/`failed` only, subject to the §2 guard and the §4.10 gate).

**Dry run.** `submit --dry-run` runs every pre-send check (fence check
§4.5, payload-integrity re-verification §3, `configFingerprint` drift check
§6) and prints the exact canonical payload plus target
`siteUrl`/`project`/`issueType` that would be sent, but never initiates the
network call and never writes `submitting` (a dry run must not trigger any
crash-recovery/verify machinery, since nothing was ever actually in
flight). State remains `approved`. Exit 0 if all pre-send checks pass
(matching what a real submit would do up to that point), else the same
exit code a real submit would produce at that check (8 or 15). Config-level
`dryRun: true` makes this the *default* behavior for every `submit`
invocation at that installation — `submit --live` is then required to
perform an actual POST, functioning as an installation-wide testing safety
switch. `submit --dry-run` on the command line always forces dry-run
regardless of config. (This item is outside the locking domain — confirmed
by Fable's round-12 arbitration as correctly out of its scope, not
re-examined there.)

**`resolve`'s three entry states:**

- (a) from `unknown` (multiple-match reconcile, §7.6) → `unknown →
  submitted`; `KEY` (via `--issue-key`) must be among the
  `reconcile-matches` entry's keys. Unchanged since round 9.
- (b) from `submitted` with an unresolved `duplicate-detected` (verify-mode
  found a problem, §7.7): state stays `submitted`; `KEY` must be among that
  entry's keys; updates `result` if different; writes `{event:
  "duplicate-acknowledged", at, chosenKey, staleKeys}` (also clears the §2
  discard guard). Unchanged since round 9.
- (c) from `pending`/`approved` with an unresolved `duplicate-detected`
  written by §4.10's pre-discard/pre-unfreeze gate. Two forms: **`--issue-key
  <KEY>`** (must be among that entry's keys) — the human attests the found
  issue **is** this draft, created by a stale holder → transitions
  `pending|approved → submitted`, sets `result` to `KEY`, writes
  `duplicate-acknowledged`. This synthesizes no `attempts[]` row (§2) — the
  record of the stale holder's POST is the `stale-holder-outcome` audit
  entry plus this `duplicate-acknowledged` entry. **`--distinct`** — the
  human attests the found issue(s) are **not** this draft → writes
  `{event: "duplicate-dismissed", at, dismissedKeys}`; state unchanged;
  `discard`/`unfreeze` now permitted. `duplicate-dismissed` clears only the
  §4.10 gate marker — §2's ambiguous-history guard is independent (see §2).
  This closes the gap round 11 found: §4.10's gate can produce
  `duplicate-detected` in ordinary v1 operation from `pending`/`approved`,
  not hypothetically, so this was required for v1 and is not deferred.

---

### §4.1 Scope of the guarantee — stated honestly, up front

The lock protects exactly one thing: the local state of
`.kstack/jira-queue/<uuid>.json` (draft + `attempts[]` + `audit[]`) against
lost updates and torn writes from concurrent local processes. It does not
and cannot fence the external POST to Jira; Jira has no knowledge of the
lock, and any claim that a local mechanism prevents a resumed stale process
from completing a POST is rejected by construction. The external side
effect is handled by detection (§4.8, §4.10), never by claimed prevention.
The local guarantee carries **two** disclosed microsecond-scale residues —
the §4.5 guarded-write residue and the §4.9 release-claim residue — both
enumerated in §8.

### §4.2 Lockfile: path, content, acquisition

- Path: `.kstack/jira-queue/<uuid>.lock` (sibling of the draft). Same
  commands require it as before (all draft mutations; read-only commands
  only where §4.10 gates write audit).
- **Acquisition — publish-then-link (universal, closes the empty-lockfile
  window):**
  1. Create `<uuid>.lock.tmp.<lockId>` with `O_CREAT|O_EXCL|O_WRONLY`, mode
     `0600`; write the lockfile JSON object (below); `fsync`.
  2. `link(<uuid>.lock.tmp.<lockId>, <uuid>.lock)` — atomic publication,
     fails `EEXIST` if the path is occupied. The content is complete
     *before* it becomes visible: **there is no empty/partial-lockfile
     window.** On success, unlink the tmp name; retain the open fd (same
     inode as the published lock).
  3. On `EEXIST`: unlink your own tmp file first (hygiene), then read/`stat`
     the existing lock: mtime age ≤ `LOCK_STALE_MS` → live → exit
     `EXIT_LOCK_HELD` (16), naming the holder; age > `LOCK_STALE_MS` →
     break protocol (§4.6).
- Lockfile content: `{lockId (random 128-bit per acquisition), pid,
  hostname, acquiredAt, op, stateAtAcquisition, brokePrevious}`. `op`/
  `stateAtAcquisition` let a later tombstone (§4.6) self-describe whether
  the broken lock was held by an in-flight `submit`.
- **Empty/unparseable existing lockfile** (foreign junk — the publish-then-
  link idiom cannot itself produce one): cannot belong to a fence-passing
  holder, since every fence check requires content-`lockId` equality and
  even the file's own writer would fail it. Still wait out `LOCK_STALE_MS`
  before breaking (conservatism against non-conforming writers); the break
  protocol's observed identity is then `(dev, ino, size, mtime)` in place of
  `lockId` (§4.6).

### §4.3 Heartbeat — liveness signal only

An async interval timer fires every `LOCK_HEARTBEAT_MS` and calls
`futimes(fd)` on the held fd — updating mtime on the inode the holder owns.
It never rewrites content, never unlinks, never renames, never re-creates
(an unlink-then-create idiom was tried and rejected in an earlier round —
it destroyed the mutual exclusion it claimed). The heartbeat runs
identically during 429 backoff sleeps, the in-flight POST, and reconcile's
≥30s bounded poll, and **runs until the release-rename of §4.9 step 2
completes** (not merely until release begins). If the lock was renamed/
unlinked out from under the holder, `futimes(fd)` still succeeds harmlessly
against the orphaned inode — heartbeat failure is never load-bearing;
fencing is done by the path checks in §4.5.

**Normative implementation constraint:** while holding a lock, no
synchronous blocking operation may exceed `LOCK_HEARTBEAT_MS` — no sync
sleeps, `Atomics.wait`, `spawnSync`/`execSync`, or long synchronous fs
calls. All waits (backoff, polls) must be async timers that yield the
event loop. Violating this starves `futimes` and manufactures false-stale
breaks during in-flight POSTs; §4.10's detection is the backstop for that
scenario, not a license to cause it routinely.

### §4.4 Constants

`LOCK_HEARTBEAT_MS = 5000`. `LOCK_STALE_MS = 90000` (18 missed beats). Code
constants, not adopter config — deliberately unrelated to `timeoutMs`,
`maxAttempts`, backoff, or reconcile budgets, since a live heartbeat covers
any legitimate operation length by construction, not by arithmetic. 90s is
generous against event-loop stalls, GC, and coarse filesystem mtime
granularity. A process silent for 90s is dead or suspended — both are what
the break protocol and detection layers exist for. System-wide suspend
causes at worst a false break on resume (the safe direction).

### §4.5 Fence checks and the guarded-write primitive (all draft mutations)

Every draft write by every command:

1. **Fence check:** open `<uuid>.lock` by path, read content, compare
   `lockId` to own (plus `(dev, ino)` comparison where reliable). Mismatch
   or read failure ⇒ fenced — must not write the draft (§4.8).
2. **Write:** temp-file + `fsync` + `rename` over `<uuid>.json`.
3. **Post-write re-check:** repeat the fence check. Mismatch ⇒ stop, write
   an orphan sidecar (§4.8) reflecting reality, exit per the corrected
   semantics below.

**Exit semantics (corrected — 17/18 distinguish residue, not "was a POST
sent"):**

- `17 EXIT_LOCK_FENCED_CLEAN` — fenced with **no residue**: no unrecorded
  POST, and no draft write landed after losing ownership. The draft on disk
  fully reflects what happened.
- `18 EXIT_LOCK_FENCED_DIRTY` — fenced with **residue**: a post-fence draft
  write may have landed, and/or an unrecorded POST may have occurred. The
  sidecar's `{posted, wroteAfterFence}` fields (§4.8) carry the specifics —
  callers must consult the sidecar, never infer POST status from 17/18
  alone.
- `posted` means "an unrecorded POST **may** have occurred," not "a POST
  was ever sent." A `submit` whose POST and response were fully recorded in
  the draft before it was fenced (e.g. fenced only at release, §4.9) writes
  `{posted: false}` and exits 17 — the draft already tells the whole story.
- Post-write re-check failure on an **offline** mutation (`edit`, `approve`,
  the pre-POST `submitting` write) ⇒ exit 18, sidecar `{posted: false,
  wroteAfterFence: true}`. Because this sidecar is authored after the
  invocation ceased all mutation, `posted: false` here is *definitive*
  no-POST evidence: on folding it, `reconcile` marks the affected
  `in-flight` attempt row `aborted-before-post` and returns the draft to
  `approved` — deterministic recovery, no `ambiguous` outcome, no mandatory
  verify from this alone.

**Stated residue:** step 2's rename is by path and can't be conditioned on
step 1's result; a process suspended between check and rename for longer
than `LOCK_STALE_MS` can clobber a successor's write. Requires suspension
onset inside a microseconds-wide window *and* duration >90s — disclosed,
not claimed away. The post-write re-check makes the clobber self-reported
via sidecar rather than silent.

Same fence check runs immediately before initiating the POST and
immediately after receiving the response in `submit` — best-effort
duplicate-window reduction, not prevention.

### §4.6 Stale-break protocol — atomic claim via tombstone rename

1. Record observed identity (`lockId` = X, mtime). Re-`stat` immediately
   before step 2; if mtime advanced, holder is alive → abort, exit
   `EXIT_LOCK_HELD` (16).
2. **Claim by rename:** `rename(<uuid>.lock, <uuid>.tombstone.<breakerId>.json)`
   — atomic; for a given inode exactly one breaker's rename succeeds.
   `ENOENT` ⇒ another breaker won ⇒ restart acquisition (§4.2).
3. **Verify the claim:** read the tombstone. `lockId == X` → correct lock
   broken; leave the tombstone (self-describing), proceed to acquire fresh
   via §4.2, recording `brokePrevious: {lockId: X, ...}`.
4. **Mis-claim path:** tombstone's `lockId ≠ X` (a double-break
   interleaving) → **check the `<uuid>.lock` path is absent, then
   `rename()` it back.** (Round-14 resolution — an accepted design
   tradeoff, not deferred testing: Node's `fs.rename` has no atomic
   `RENAME_NOREPLACE`, so this check-then-rename has a TOCTOU gap where a
   third process's freshly-created lock could theoretically be
   overwritten. Requiring a native `renameat2` binding to close this
   fully was judged not worth the added native-dependency surface for a
   window this narrow — it is the same disclosed class of residue as
   §4.5/§4.9's other microsecond races, accepted on the same basis: the
   failure direction is a falsely-fenced clean abort for whichever process
   loses the race, self-reported via the janitor, never a silent
   correctness violation.) If the rename fails or the path is occupied,
   leave as a tombstone, exit `EXIT_LOCK_BREAK_RACE` (19). The displaced
   live holder's next fence check fails → aborts cleanly (§4.8).
- **No-lockId case:** where the observed lockfile was empty/unparseable
  (§4.2), the observed identity is `(dev, ino, size, mtime)`; step-3
  verification compares by `stat` of the tombstone. Breaking an unparseable
  lock is safe regardless: no process can pass a fence check against
  unparseable content, so the worst case is a break of a lock nobody could
  use.
- **Invariant (restated honestly — retires an earlier, false "never two
  simultaneous holders" claim):** *at any instant, at most one process's
  fence check against the current `<uuid>.lock` content can pass* — lockIds
  are unique per acquisition and the path has exactly one content. Races
  resolve to falsely-fenced clean aborts or a restored holder. An
  interleaving may transiently leave two processes each holding an open fd
  (e.g. during the mis-claim window the path is briefly vacant and a fresh
  §4.2 acquisition can succeed while the displaced holder still holds its
  fd) — but never two processes that both pass fence checks, so every
  subsequent guarded write self-arbitrates. In the rename-back-succeeds
  sub-case the displaced holder's next fence check correctly **passes** —
  that is recovery, not a violation.

### §4.7 Janitor — folding tombstones, sidecars, and release leftovers

First draft operation after every lock acquisition, before the command's
own work: sweep this draft's `<uuid>.tombstone.*.json`, `<uuid>.orphan.*.json`,
`<uuid>.released.*.json`, and stale `<uuid>.lock.tmp.*` litter. `status` and
`reconcile` additionally sweep the whole queue dir (including `discarded`
drafts), folding by briefly acquiring each affected draft's lock.

- **Classification:** tombstones → `lock-broken`/`lock-break-race`; orphan
  sidecars → `stale-holder-outcome`. `released.*` files: content `lockId`
  matching the filename `lockId` ⇒ a crash between §4.9's rename and
  unlink — a clean, deliberate release; folds as `{event:
  "lock-released-late"}`, benign, does **not** arm §4.10 trigger (b).
  Mismatched `lockId` ⇒ a §4.9 mis-claim leftover; folds as
  `lock-break-race`. `*.lock.tmp.*` files older than `LOCK_STALE_MS` are
  crashed-acquirer litter: deleted without folding (never published).
- **Durability and idempotence:** orphan sidecars are written temp-file +
  `fsync` + `rename`, mode `0600` — same idiom as `<uuid>.json`; lockfiles
  and tmp files are `0600`; tombstones/`released.*` files inherit the
  fsync'd lockfile content via rename. Fold ordering: append the audit entry
  via the guarded-write primitive + `fsync`, **then** unlink the folded
  file. Folds are idempotent, keyed by the folded file's `lockId` + event
  type — if a matching audit entry already exists, skip straight to unlink.
  A crash between fold and unlink duplicates nothing and loses nothing;
  evidence (including a `posted: true` issue key) cannot be torn away by
  the janitor cycle.
- Load-bearing ordering unchanged: a `submit`/`reconcile` transitioning a
  draft to `submitted` must fold before that transition — a break is never
  "not yet folded" at §4.10's trigger-evaluation time.

### §4.8 Fenced/resumed-holder behavior — fully defined

- Sidecar path `<uuid>.orphan.<lockId>.json` (uniquely owned, uncontended);
  schema `{lockId, at, op, posted, wroteAfterFence, responseClass?,
  issueId?, issueKey?}`; written via the §4.7 idiom (temp + `fsync` +
  `rename`, `0600`).
- Exit code per §4.5's corrected semantics: no residue ⇒ 17; any residue
  (`posted: true` and/or `wroteAfterFence: true`) ⇒ 18.
- The sidecar is the durable handoff mechanism: written by the process with
  the information, at a path it uniquely owns, folded into `audit[]` by
  whichever process later holds the lock. A `posted: true` sidecar bearing
  an issue key is direct, deterministic duplicate evidence and **arms
  §4.10's gate immediately on folding, with no search required** (§4.10's
  direct-evidence rule).
- **`attempts[]` exception:** a fenced invocation never authors or
  completes an `attempts[]` row; its record is the sidecar, folded as a
  `stale-holder-outcome` audit entry.

### §4.9 Release — rename-claim protocol

1. Heartbeat still running. Fence check by content (§4.5); mismatch ⇒ skip
   removal entirely, write sidecar, exit fenced per §4.8.
2. `rename(<uuid>.lock, <uuid>.released.<lockId>.json)` — atomic claim of
   whatever inode occupies the path. `ENOENT` ⇒ another process broke or
   claimed the lock ⇒ treat as fenced: write sidecar (`posted` per its true
   definition — usually `false` here, since everything was recorded), exit
   per §4.8. Heartbeat stops only after this step.
3. Read the renamed file. Content `lockId` == own ⇒ unlink it (no audit
   entry needed — nothing was broken), stop heartbeat, close fd. Done.
4. Content `lockId` ≠ own — the resumed-releaser race: this process claimed
   a *successor's* lock. Check-then-rename it back to `<uuid>.lock` if that
   path is absent (same accepted check-then-rename tradeoff as §4.6 step
   4's mis-claim path — see that section's round-14 resolution note); if
   the rename-back fails or the path is occupied, leave the file for the
   janitor (folds as `lock-break-race`), exit `EXIT_LOCK_BREAK_RACE` (19).
   The successor is at worst falsely fenced into a clean abort — **its
   lock is never silently destroyed.**

**Residue:** a releaser suspended > `LOCK_STALE_MS` between steps 1 and 2
can claim a successor's lock — but steps 3-4 detect and recover rather than
destroy; same disclosed class as §4.5's residue, same safe direction (§8).

### §4.10 Detection: mandatory verify-mode triggers (extends §7.7)

Verify-mode reconcile is **mandatory, not recommended**. **The invocation
that transitions a draft into `submitted` — whether `submit` (via
`submitting`) or `reconcile` (recovering from persisted `submitting`) —
must run verify-mode inline before exiting** if any of:

(a) `attempts[]` contains an `ambiguous` outcome (existing trigger);
(b) `audit[]` contains a `lock-broken`/`lock-break-race` entry whose broken
lock had `op: "submit"` or `stateAtAcquisition: "submitting"` (scoped —
breaking an idle `edit` lock doesn't poison the draft forever);
(c) `audit[]` contains a `stale-holder-outcome` entry, or an unfolded
orphan sidecar exists for this draft;
(d) this invocation recovered the draft from `submitting` (crash-recovery —
reachable per the normative recovery procedure below; `resolve`'s
human-attested transitions to `submitted` are themselves resolutions and
carry no inline verify).

**Crash recovery from `submitting` (normative):** the `approved →
submitting` guarded write atomically appends the `attempts[]` row
`{attemptId, startedAt, outcome: "in-flight"}` in the same rename — exactly
one row per POST attempt by construction; the same invocation updates that
row on response. Any mutating command acquiring the lock over a persisted
`submitting` draft refuses and directs to `reconcile` (existing state-error
exit code). `reconcile` on `submitting`: run the janitor first (§4.7); if a
folded sidecar covers the in-flight `attemptId` — `posted: false` ⇒ row
`aborted-before-post`, state back to `approved`; `posted: true` with an
issue key ⇒ row completed, state `submitted`, `result` set, duplicate
evidence handled per the direct-evidence rule below; `posted: true` without
a key ⇒ row `ambiguous`. If no sidecar covers it, set the `in-flight` row's
outcome to `ambiguous`. Then proceed under trigger (d) with mandatory
verify and §7's reconcile semantics. Recovery *completes* the existing row;
it never creates one.

**Direct-evidence rule:** if `audit[]` contains a `stale-holder-outcome`
with `posted: true` and an issue key (or an unfolded such sidecar exists),
the gate writes `duplicate-detected` with that key **immediately, with no
network search** — and no search-based `verify-clear` can retire it, only
`resolve` can. Search-based gating applies only to evidence-free markers (a
broken submit-scoped lock, or `posted: true` without a key).

**Marker lifecycle:** a trigger-(b)/(c) marker is *unresolved* until a
later-sequenced `verify-clear`, `verify-confirmed`, `verify-inconclusive`
(§7's zero-match verify-mode outcome — round-14 fix: previously missing
from this list despite being a defined verify-mode result), 
`duplicate-acknowledged`, or `duplicate-dismissed` audit entry covers it. A
`verify-clear` retires all *search-eligible* markers sequenced before it;
subsequent `discard`/`unfreeze` invocations run no new search unless a new
marker has appeared since. Direct-evidence markers are excluded from
`verify-clear` retirement. `verify-inconclusive` retires only the specific
trigger-(d) marker of the invocation that produced it (it is not a
general-purpose clearer like `verify-clear`, since an inconclusive result
carries less information than an explicit zero-match-after-full-poll from
the pre-discard/pre-unfreeze gate).

**Pre-discard/pre-unfreeze gate:** read-only verify-mode search from
`pending`/`approved`, audit entries only, never state transitions: zero
matches ⇒ `verify-clear`, proceed; ≥1 match ⇒ `duplicate-detected`, refuse
pending human resolution via `resolve` entry state (c) (§4). **This gate
keys on `audit[]` evidence and is independent of §2's ambiguous-history
guard, which keys on `attempts[]`** — each has its own clearing entries,
and clearing one never clears the other. Inline verify network failure ⇒
audit `{event: "verify-network-failed", at}` (round-14 rename — was
`verify-incomplete`, one word away from `verify-inconclusive` and easily
confused despite carrying different lifecycle consequences: a network
failure means the check didn't run at all and must be retried, while
`verify-inconclusive` means the check ran and returned the expected
zero-match result); `status` surfaces every draft with an unsatisfied
mandatory verify; `reconcile --verify` re-runs it.

**Exit codes introduced by §4:** `16 EXIT_LOCK_HELD` · `17
EXIT_LOCK_FENCED_CLEAN` (no residue — draft reflects reality) · `18
EXIT_LOCK_FENCED_DIRTY` (residue — unrecorded POST possible and/or
post-fence write landed; consult sidecar) · `19 EXIT_LOCK_BREAK_RACE`.

**Implementation notes:** publish-then-link (§4.2) is the universal
acquisition idiom — it closes the empty-lockfile window everywhere and
subsumes any 9p/drvfs/NFS-specific carve-out; the retained fd is the
published inode, so heartbeat `futimes` behavior is unaffected. Coarse
mtime granularity (1-2s on some mounts) is why `LOCK_STALE_MS` is 18
heartbeats, not 2. Where `(dev, ino)` is unreliable, the content-`lockId`
comparison in §4.5 is primary and sufficient. Clock jumps/system suspend
cause at worst a false break. **Implementation-time task:** verify no stale
reference to the retired exit codes 10-13 / the old single "12 = lock busy"
meaning survives anywhere in the actual repo (`--help` text, SKILL.md
prose, scripts) before shipping — this design document's renumbering to
16-19 must be checked against the real codebase, not assumed.

## §5. Which process performs the network POST (final)

Implementation-time verification: whether `codex exec --sandbox
workspace-write` permits outbound HTTPS to the adopter's `siteUrl`. The
Codex-side flow stops at `pending` — `draft` is fully offline by design,
and skills are restricted to `draft` only (§9), so this is internally
consistent. Everything requiring egress (`doctor`, `show`'s createmeta,
`submit`, `reconcile`) or a TTY (`approve`) runs from the Claude-Code-side
session or a human shell. If Codex's sandbox permits egress, `show`/
`submit`/`reconcile` additionally work there, but `approve`'s TTY
requirement keeps the human step host-side either way.

## §6. `configFingerprint` contents (final)

```
configFingerprint = sha256(JSON.stringify({
  siteUrl, project, issueType,
  credentialSource: { type, emailEnvVar, tokenEnvVar },  // or { type, path } for file
  resolvedEmail: resolvedEmail.trim().toLowerCase()       // normalized; never the token
}))
```

Encoded as UTF-8 bytes per §3. Computed at `show` (freeze) time, re-verified
at `submit` time by re-resolving the credential source. Binds both the
credential *pointer* (catches config edited to point elsewhere) and the
resolved *identity* (catches the pointer resolving to a different account
behind the same names/path). If the credential source cannot be re-resolved
at submit time (env var unset, file missing/unreadable) → exit 8 (config
drift), state unchanged, message distinguishes "could not re-resolve" from
"resolved but different." Recovery: `unfreeze → show → approve`.

## §7. Response classification and search-then-retry (final — now
## exhaustive)

`fetch` invoked with `redirect: 'manual'`.

| Response | State / attempts[] outcome |
|---|---|
| 2xx with `id`+`key` | `submitted` / `success` |
| 2xx without `id`/`key` | `unknown` / `ambiguous` |
| 3xx | `unknown` / `ambiguous` (not `failed` — a redirect doesn't prove no side effect occurred) |
| DNS resolution failure, connection refused, TLS handshake failure (round-14 fix — resolved as a decision, not deferred: these are pre-connection failures, deterministically no request ever reached Jira) | `failed` / `failed` |
| 400 (with or without Jira error body) | `failed` / `failed` |
| 401 / 403 / 404 | `failed` / `failed` |
| 408 | `unknown` / `ambiguous` (no inline retry — an immediate retry after "took too long" can't rule out the original succeeding) |
| 429 | `Retry-After` honored, bounded inline retry up to `maxAttempts`, and bounded in total duration by `min(Retry-After, timeoutMs * 4)` per attempt (round-14 fix: an unbounded server-supplied `Retry-After` must not be honored verbatim while holding the lock); exhaustion → `unknown` / `ambiguous` |
| any other 4xx | `failed` / `failed` |
| 5xx / timeout / connection loss / crash while `submitting` | `unknown` / `ambiguous` (recovery per §4.10) |

**429 retry safety (round-14 clarification):** inline retry after 429 does
not risk creating a duplicate. `429 Too Many Requests` is returned by
Jira's rate limiter *before* request processing reaches issue-creation
logic — by definition, no issue can have been created for a request that
received 429. This is different from 408/5xx/timeout, where the request
may have reached processing before the failure, which is exactly why only
429 retries inline and every other ambiguous case does not (§7's table).

**Reconcile protocol:** doctor-proof precondition; cursor-paginated label
search (`POST /rest/api/3/search/jql`); bounded poll, **lower bound ≥3
probes over ≥30s, upper bound capped at 10 probes or 5 minutes total,
whichever is reached first** (round-14 fix: the poll previously had no
upper bound, which combined with the lock being held for its duration —
§4.10 runs this inline — could hold a lock for an unbounded time) — a poll
that hits the upper bound without resolving is treated the same as
exhausted-inconclusive (§7's verify-mode zero-match handling below; for
`reconcile`-from-`unknown` specifically, see the note on that distinction
just below). Zero matches → `approved` (not refreshing `approvedAt` — a
restored approval must re-clear the TTL check). One match → `submitted`.
Multiple matches → stays `unknown` (never `failed` — an unresolved
external side effect can never reach a discardable state), exit 6, keys
recorded in `reconcile-matches` audit entry, human resolves via `resolve`.

**Why reconcile-from-`unknown`'s zero-match handling differs from
verify-mode's (round-14 clarification, addressing an apparent
inconsistency that is actually two different priors):** `reconcile` from
`unknown` runs when there is **no confirmed prior success** — the POST's
outcome was genuinely ambiguous, so zero search matches is evidence
*consistent with* "nothing was created," and returning to `approved` (safe
to retry) is the correct inference. Verify mode from `submitted` runs
*after* a confirmed 2xx response with an issue key/id already in hand — the
POST's success is not in question, only whether the search index has
caught up — so zero matches there is index lag, not evidence of absence,
and is correctly treated as inconclusive rather than actionable. Same raw
evidence (zero matches), different prior confidence in whether creation
occurred, hence different — and both correct — conclusions.

**Verify mode** (mandatory per §4.10, or from `submitted` whenever
`attempts[]` has an `ambiguous` outcome): re-runs the search — except when
§4.10's direct-evidence rule already supplied a definitive answer, skipping
the search entirely. **Inherits the same bounded poll as reconcile (≥3
probes over ≥30s) before concluding a result** — this matters more here
than in reconcile, since §4.10 mandates verify run *inline immediately*
after a submit reaches `submitted`, which is precisely the point of
maximum index lag.

- **Exactly one match equal to `result.key`** → `verify-confirmed` audit
  entry, exit 0, no state change.
- **Zero matches** (the *expected*, common outcome when verify runs
  promptly after a genuine, freshly-confirmed success, not evidence of a
  problem): write `{event: "verify-inconclusive", at}` — not
  `verify-confirmed` (search absence isn't positive confirmation) and not
  `duplicate-detected` (there is no duplicate evidence). Exit 0, state
  remains `submitted`, `result.key` stands as recorded (the original 2xx
  response with an issue key/id is trusted over a not-yet-indexed search).
  `verify-inconclusive` does **not** clear the §2 ambiguous-history guard
  (only `verify-confirmed`/`duplicate-acknowledged` do) and does **not**
  gate `discard`/`unfreeze` on its own. `status` surfaces drafts whose only
  verify result is `verify-inconclusive` so a caller can optionally retry
  `reconcile --verify` later for stronger assurance — but nothing blocks on
  it, since treating the common case as alarming would make verify mode
  self-defeating.
- **Any other single match, or multiples** → `duplicate-detected` audit
  entry listing the keys, exit 6, state unchanged; human resolves via
  `resolve` or cleans up the surplus in Jira directly.

## §8. Hygiene and accepted residual risk (final)

- `.kstack/jira-queue/` added to `.gitignore` (not covered by existing
  `.kstack/reviews/`/`.kstack/tmp/` entries).
- `.kstack/decisions/` never receives draft/ticket content — only a
  post-`submitted` issue key/URL reference if a session wants to record
  that a ticket was created.
- No queue retention/GC policy in v1 (known limitation, not a gap).
  `schemaVersion: 1`, no migration logic yet.
- POSIX permission enforcement is best-effort; on non-POSIX-permission
  mounts (this repo's own `/mnt/e/...`), mode bits may not be enforced —
  known limitation, `allowInsecurePermissions` is the documented escape
  hatch.
- Every error/diagnostic path routes through the shared redactor already
  reused by `kstack-reflexion.mjs` from `kstack-memory.mjs`'s secret
  scanner — never a second implementation.

**Residual risk, layered (final):**

1. **Detected, deterministically given sidecar durability:** any stale
   holder that resumes and lives long enough to write its sidecar (§4.8) —
   regardless of when its POST lands or whether the draft was meanwhile
   discarded (queue-wide janitor sweep, §4.7). A `posted: true` sidecar
   with an issue key is direct duplicate evidence, no search needed.
   ("Deterministic" here is conditional on sidecar durability — fsync'd at
   write, idempotently folded keyed by `lockId`; loss requires
   filesystem-level data loss, not merely a crash.)
2. **Detected, via mandatory search:** duplicates landed/indexed by the
   time of the inline post-submit verify (§4.10 a-d) or the pre-discard/
   pre-unfreeze gate. Search-index lag is a named limitation here too.
3. **Genuinely undetected (irreducible, named):** a stale holder whose POST
   reached Jira but which died between the socket write and the sidecar
   write, when the resulting issue also lands after every verify point the
   draft ever passes — requires a lock break *plus* process death inside a
   narrow window *plus* unlucky timing. Accepted, alongside: the §4.5
   microsecond check→rename TOCTOU on local draft writes; the §4.9
   microsecond release-claim TOCTOU (same class, same disclosed direction);
   and search-index lag generally.

## §9. Skill integration (final)

`plugins/kstack/skills/kstack-jira/SKILL.md` (mirrors existing `kstack-*`
pattern), invoked as an optional extension point from `kstack-review`/
`kstack-design`/`kstack-implement`/`kstack-qc` only when `jira.enabled` is
true, only ever calling `draft` (fully offline, per §5) — never `approve`/
`submit`. New `.kstack/config.json` authority entry:
`externalTicketCreation: "ask"` (matches `commit`/`push`), enforced by the
calling skill's prose. The hash+TTY confirmation (§4's `approve`) is
"tamper-evident confirmation," never called an "approval gate" in any
user-facing text — the host's tool-permission prompt is named as the real
authority boundary in the same output.

## Open items carried into implementation

1. Four irreducible, empirical/owner-decision items (unchanged since round
   6): Codex sandbox egress capability (§5), real-world Jira search-index
   lag bound (§7), `allowInsecurePermissions` posture for this repo's own
   mount (§1), and Jira Data Center as a future non-goal decision (§1).
2. **Implementation-time test cases (per Fable's round-12 arbitration —
   these are test-writing tasks for `kstack-implement`, not further design
   rounds):** janitor fold idempotence across a crash between fold and
   unlink; `released.*` benign-vs-race classification; `resolve` entry
   state (c) both forms (`--issue-key`/`--distinct`), including guard
   independence from §2; recovery from `submitting` with each sidecar shape
   (`posted:false`, `posted:true`+key, `posted:true` no key, no sidecar);
   lint/test for synchronous-blocking calls in lock-holding code paths
   (§4.3's normative constraint); contended-acquisition tmp-litter cleanup;
   verify no stale reference to retired exit codes 10-13 survives in the
   actual repo.
3. **Round-13/14 filesystem-semantics findings — genuinely implementation-
   time verification tasks** (require testing against the real filesystem,
   which paper review has reached the limit of its usefulness for; the
   items resolvable on paper — `Retry-After` duration bound, pre-connection
   transport-failure classification, `fs.rename` overwrite safety, "Jira
   Cloud only" enforcement — were fixed directly above, not left here):
   - **Directory `fsync`:** neither draft/sidecar/lockfile writes nor
     `.kstack/jira-queue/` itself specify an `fsync` on the *containing
     directory* after a `rename`/`link`/`unlink`. Without it, the rename's
     durability is not guaranteed to survive a crash on some filesystems.
     Add directory `fsync` after every rename/link/unlink in §4's write
     paths, and re-verify §8's "deterministic given sidecar durability"
     framing once implemented.
   - **`link()` false-failure / NFS semantics:** the classic
     link-succeeded-but-reply-lost false-`EEXIST` on NFS-family filesystems
     isn't accounted for in §4.2's acquisition protocol. Needs a
     self-recognition check (e.g. re-reading the "existing" lock and
     checking if its `lockId` is actually this process's own) before
     treating an `EEXIST` as "someone else holds it," and empirical testing
     if NFS-hosted queues are a supported deployment target.
   - **Heartbeat viability on this repo's own filesystem:** §4.3's
     liveness mechanism depends on `futimes(fd)` reliably updating mtime in
     a way `stat` on the same path observes promptly. This repo lives on
     `/mnt/e` (WSL drvfs/9p) — verify this actually works as assumed on
     that mount before relying on it, rather than assuming POSIX semantics
     hold uniformly.
   - **`approvalTtlMs` expiry behavior on `submit`:** §1/§7 establish that
     an expired approval must be re-cleared, but `submit`'s exact behavior
     on encountering an expired `approvedAt` (state, audit event, exit
     code) was never spelled out — define it during implementation
     (natural fit: same treatment as the existing exit-9 TTL-expiry path
     already referenced elsewhere in this document).

This design has been through 14 dual-model review rounds and three Fable
arbitrations (round 6: architecture; round 10 and round 12: locking/
concurrency, convergence-final for that domain). Round 14's resolvable
findings (auth scheme specification, attempts[] cardinality, state-machine
edges, `labels` settability check, 429 duplicate-safety, bounded-poll upper
bound, verify-mode naming/marker-list gaps, `fs.rename` overwrite safety,
pre-connection failure classification, Jira Cloud enforcement) were fixed
directly. The remaining open items above are implementation-time
verification tasks against the real filesystem and API, not further
paper-review rounds.
