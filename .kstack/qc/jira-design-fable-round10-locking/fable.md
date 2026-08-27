Advisor endorses the structure and gave eight specific tightenings, all of which I've folded in below. One process note first: **the plan file could not be written** — this session's tool set has no Write/Read/Task tools (only browser, image, and advisor tools), so per the advisor's guidance the complete §4 replacement text below is the deliverable itself, ready for the orchestrating session to paste into the spec. Where I depend on §2 details I could not read from disk, I state them as assumptions from the arbitration packet.

---

# Fable arbitration, round 10 — final §4 locking/concurrency design

## Verdict on the two prior attempts and the round-9 critiques

All four round-9 findings against Patch 3 are upheld: the unlink-then-create heartbeat destroys the mutual exclusion it claims; the double-break race is real; inode-orphaning protects only the lockfile, not the path-renamed draft JSON; and the verify-mode coverage claim was false because its entry condition (`ambiguous` in `attempts[]`) is not satisfied in the stale-resume scenario. Opus's round-9 simplification is **adopted in substance**: lock timing below governs only *break scheduling*; no safety property depends on `LOCK_STALE_MS` being exactly right, and verification is triggered by lock-lifecycle events, not by timing arithmetic. The worst outcome of any wrong staleness call in this design is a fenced clean abort plus a mandated verify — never an undetected dual writer.

The single structural fix that dissolves (rather than re-patches) most of the critique history: **the heartbeat updates the mtime of the lockfile's own inode via the held fd (`futimes`) and never touches the path.** Staleness therefore measures *heartbeat liveness*, not *operation duration*. A live process heartbeats through a 30-second reconcile poll, a 429 backoff sleep, and an in-flight POST alike (the heartbeat is an async timer independent of operation phase), so no legitimate operation of any length can trip the threshold. The entire `timeoutMs × maxAttempts + backoff + reconcile budget` derivation problem was an artifact of the broken idiom; `maxAttempts` drops out of the locking design entirely, eliminating one of the three conflicting readings Opus flagged (the other two are a §1/§7 documentation matter outside this round's scope — the locking design no longer references the key at all).

---

## §4 (replacement) — Local locking and concurrency

### 4.1 Scope of the guarantee — stated honestly, up front

The lock protects exactly one thing: **the local state of `.kstack/jira-queue/<uuid>.json` (draft + `attempts[]` + `audit[]`) against lost updates and torn writes from concurrent local processes.** It does not and cannot fence the external POST to Jira; Jira has no knowledge of the lock, and any claim that a local mechanism prevents a resumed stale process from completing a POST is rejected by construction (established rounds 8–9). The external side effect is handled by *detection* (§4.8, §4.10), never by claimed prevention. Even the local guarantee carries one microsecond-scale residue, stated precisely in §4.5 and §8 — this section never uses the phrase "mutual exclusion" without that qualification.

### 4.2 Lockfile: path, content, acquisition

- Path: `.kstack/jira-queue/<uuid>.lock` (sibling of the draft).
- Every command that mutates the draft (`edit`, `approve`, `unfreeze`, `discard`, `submit`, `reconcile` bookkeeping) acquires this lock first and holds it for the duration of the invocation. Read-only commands (`status`, verify-mode's search phase) do not require it, except where §4.10 requires a gate to write audit — those writes acquire the lock like any other mutation.
- Acquisition: `open(path, O_CREAT | O_EXCL | O_WRONLY)`. On success, write a single JSON object and `fsync`:

  ```json
  {
    "lockId": "<random 128-bit, unique per acquisition>",
    "pid": 12345,
    "hostname": "...",
    "acquiredAt": "<ISO-8601>",
    "op": "submit",
    "stateAtAcquisition": "approved",
    "brokePrevious": null | { "lockId": "...", "observedMtimeAgeMs": 123456 }
  }
  ```

  The fd is held open until release. `op` and `stateAtAcquisition` exist so that a later tombstone (§4.6) self-describes whether the broken lock was held by an in-flight `submit` — this is what lets the verify trigger in §4.10 be scoped instead of firing on every break forever.
- On `EEXIST`: read the existing lockfile's content and `stat` it. If mtime age ≤ `LOCK_STALE_MS`, the lock is live → exit with code `EXIT_LOCK_HELD` (10) and a message naming the holder (`lockId`, `pid`, `op`, age). No waiting/queueing in v1; the caller retries. If mtime age > `LOCK_STALE_MS`, enter the break protocol (§4.6).

### 4.3 Heartbeat — liveness signal only

- From acquisition to release, an async interval timer fires every `LOCK_HEARTBEAT_MS` and calls `futimes(fd)` on the *held fd* — updating mtime on the inode the holder owns. It never rewrites content, never unlinks, never renames, never re-creates. (This is the `proper-lockfile` touch idiom; the round-8/9 unlink-then-create idiom is expressly forbidden.)
- The heartbeat runs identically during 429 backoff sleeps, the in-flight POST, and reconcile's ≥30s bounded poll — these are `await`s; the timer still fires. Therefore the "must not regress below legitimate operation budgets" constraint (C1/O5) is satisfied *by construction*, with no arithmetic to get wrong.
- If the lock was renamed or unlinked out from under the holder, `futimes(fd)` still succeeds harmlessly against the orphaned/renamed inode. Heartbeat failure is never load-bearing; fencing is done by the path checks in §4.5.
- The heartbeat's only consumer is the staleness judgment in §4.2/§4.6. A late or racing heartbeat causes at worst a slightly early or late break — the safe direction (§4.6 makes any break outcome a clean abort for the loser, never a dual writer).

### 4.4 Constants

- `LOCK_HEARTBEAT_MS = 5000`. `LOCK_STALE_MS = 90000` (18 missed beats). Code constants, not adopter config.
- 90s is generous against event-loop stalls, GC, and coarse filesystem mtime granularity, and deliberately *unrelated* to `timeoutMs`, `maxAttempts`, backoff, or reconcile budgets — those bound operation duration, which staleness no longer measures. A process silent for 90s is either dead or suspended; both are exactly the cases the break protocol and detection layers exist for. System-wide suspend (laptop sleep) suspends would-be breakers too and causes at worst a false break on resume — again the safe direction.

### 4.5 Fence checks and the guarded-write primitive (all draft mutations)

Every draft write by every command goes through one primitive (this answers round-8 codex's finding that `edit`/`approve`/`unfreeze`/`discard`/reconcile lacked any fence rule):

1. **Fence check:** open `<uuid>.lock` by path, read content, compare `lockId` to own. Where the platform provides reliable inodes, additionally compare `(dev, ino)` from path-`stat` against `fstat` of the held fd. Mismatch, or `ENOENT`/any read failure, ⇒ **fenced** (the lock was broken or is mid-break). A fenced process must not write the draft — behavior per §4.8.
2. **Write:** temp-file + `fsync` + `rename` over `<uuid>.json` (the §2 idiom — assumed from the packet).
3. **Post-write re-check:** repeat the fence check. On mismatch, the process must assume its rename may have landed after losing ownership: stop immediately, write an orphan sidecar (§4.8) with `posted` reflecting reality, exit `EXIT_LOCK_FENCED_DIRTY` (12).

**Stated residue (goes in §8, never omitted from any restatement of this guarantee):** step 2's rename is by path and cannot be made conditional on step 1's result; a process suspended *between* check and rename for longer than `LOCK_STALE_MS` can clobber a successor's write. This requires suspension onset inside a microseconds-wide window *and* duration >90s. It is disclosed, not claimed away — round 9 Opus's point that "only the resource itself rejecting stale writers is real fencing" applies to the draft file too, and this design does not pretend otherwise. The post-write re-check exists so the clobber is at least self-reported via sidecar rather than silent.

The same fence check runs **immediately before initiating the POST** and **immediately after receiving the response** in `submit`. These are best-effort duplicate-window reductions, not prevention — consequences in §4.8.

### 4.6 Stale-break protocol — atomic claim via tombstone rename

To break a lock judged stale (§4.2):

1. Record the observed identity: content `lockId` (call it X) and mtime. Re-`stat` immediately before step 2; if mtime has advanced, the holder is alive → abort the break, exit `EXIT_LOCK_HELD`.
2. **Claim by rename:** `rename(<uuid>.lock, <uuid>.tombstone.<breakerUniqueId>.json)`. Rename of a path is atomic; for a given lock inode exactly one breaker's rename succeeds. `ENOENT` ⇒ another breaker won ⇒ restart acquisition from §4.2. (This replaces round 9's unlink-then-create, whose double-break race — both breakers unlink, both O_EXCL-create, two live holders — is upheld as fatal. Here the failure mode of every race is a *loser*, never a second winner.)
3. **Verify the claim:** read the tombstone. If its `lockId` == X → correct lock broken. Leave the tombstone in place (it self-describes the broken lock, including its `op` and `stateAtAcquisition`); proceed to acquire fresh via §4.2 `O_EXCL`, recording `brokePrevious: {lockId: X, …}`. If that `O_EXCL` loses to a third process, fine — the winner's janitor (§4.7) folds the tombstone.
4. **Mis-claim path:** if the tombstone's `lockId` ≠ X, the breaker renamed a *newer, live* lock (the double-break interleaving: another breaker broke X and re-acquired between steps 1 and 2). Rename it back to `<uuid>.lock` if that path is currently absent; if the rename-back fails or the path is occupied, leave it as a tombstone and exit `EXIT_LOCK_BREAK_RACE` (13). The displaced live holder's next fence check fails → it aborts cleanly per §4.8. **Invariant preserved by every interleaving: a race produces a falsely-fenced clean abort (liveness hiccup, self-announcing via sidecar/tombstone), never two simultaneous holders.** The janitor records a mismatched tombstone as audit `lock-break-race`.

### 4.7 Janitor — folding tombstones and sidecars; ordering rule

- **First draft operation after every lock acquisition, before the command's own work:** scan the queue dir for this draft's `<uuid>.tombstone.*.json` and `<uuid>.orphan.*.json`, append each to `audit[]` (`lock-broken` with the dead lock's `lockId`/`op`/`stateAtAcquisition`/age; `stale-holder-outcome` with the sidecar's content; `lock-break-race` for mismatched tombstones), fsync via the guarded-write primitive, then delete the folded files. This ordering is load-bearing: the verify trigger in §4.10 keys on these audit entries, so a `submit` must fold before it can transition to `submitted` — a break can never be "not yet folded" at trigger-evaluation time.
- **Queue-dir-wide sweep:** `status` and `reconcile` additionally scan the whole queue dir for orphan sidecars belonging to *any* draft, including `discarded` ones, and fold them (acquiring that draft's lock briefly). This closes codex round-9's scenario end-to-end: a sidecar written after its draft was discarded still gets folded and surfaced instead of rotting unfoldable.

### 4.8 Fenced/resumed-holder behavior — fully defined (no implementer guessing)

A process that finds itself fenced (§4.5 check fails at any checkpoint):

- **Fenced before the POST was initiated:** write nothing to the draft. Write an orphan sidecar `<uuid>.orphan.<lockId>.json` — a path containing its own `lockId`, hence uncontended and writable without any lock — with `{lockId, at, op, posted: false}`, then exit `EXIT_LOCK_FENCED_CLEAN` (11). The `posted: false` sidecar is cheap and positively tells the successor this invocation contributed no duplicate.
- **Fenced after the POST was sent** (post-send or post-response check fails, or post-write re-check per §4.5): write the sidecar with `{lockId, at, op, posted: true, responseClass, issueId?, issueKey?}` — whatever it knows — and exit `EXIT_LOCK_FENCED_DIRTY` (12). The two distinct exit codes exist precisely so the caller knows whether a POST may have happened.
- The sidecar **is** the durable handoff that rounds 8–9 found missing: written by the process that has the information, at a path it uniquely owns, folded into `audit[]` by whichever process later holds authority (§4.7). The round-8 "fencing-violation written through the new holder's identity" requirement is deleted, replaced by this implementable mechanism. A sidecar carrying `posted: true` with an `issueKey` is *direct, deterministic* duplicate evidence — better than search.
- **`attempts[]` 1:1 exception (explicit):** the established rule is one `attempts[]` row per `submit` invocation, *authored by that invocation*. A fenced invocation cannot author draft rows; its record is its sidecar, folded later as a `stale-holder-outcome` **audit** entry, not an `attempts[]` row. This is a stated exception to the 1:1 mapping, not an oversight.

### 4.9 Release

Fence-check (content == own `lockId`), then `unlink(<uuid>.lock)`, then stop the heartbeat and close the fd. The check→unlink TOCTOU residue has the same shape and same safe failure direction as §4.5: worst case a successor is falsely fenced and aborts cleanly. On fence-check failure at release, skip the unlink (the path is not yours) and exit with the fenced code appropriate to what preceded it.

### 4.10 Detection: mandatory verify-mode triggers (extends §7.7's entry condition)

Verify-mode reconcile is **mandatory, not recommended**, and its entry condition is extended beyond "`attempts[]` contains `ambiguous`" — adopting Opus round 9's direction and fixing the exact coverage gap both reviewers proved (stale-resume duplicate with `attempts[] = [success]` and no ambiguous row):

A `submit` invocation, upon reaching `submitted`, must run verify-mode inline before exiting if any of:
 (a) `attempts[]` contains an `ambiguous` outcome (existing trigger, unchanged);
 (b) `audit[]` contains a `lock-broken` or `lock-break-race` entry whose broken lock had `op: "submit"` or `stateAtAcquisition: "submitting"` (scoped deliberately — a break of an idle `edit` lock does not poison the draft forever);
 (c) `audit[]` contains any `stale-holder-outcome` entry, or an unfolded orphan sidecar exists for this draft (the janitor ordering in §4.7 makes this checkable);
 (d) this invocation recovered the draft from `submitting` (crash-recovery row of §7 — this also fixes round-8 Opus's finding that the crash row authored no `ambiguous` row and thus never fired the old trigger).
 If the inline verify's search fails (network), append audit `verify-incomplete`; `status` surfaces every draft with an unsatisfied mandatory verify, and `reconcile --verify` re-runs it.

**Pre-discard / pre-unfreeze gate (sanctioned by this round's "extend the trigger" clause):** when `discard` or `unfreeze` is invoked on a draft whose `audit[]` contains an *unresolved* trigger-(b)/(c) marker, a read-only verify-mode search (canonical fingerprint, existing §7.7 procedure) must run first — from `pending`/`approved`, writing **audit entries only, never state transitions**: zero matches ⇒ `verify-clear`, proceed; ≥1 match ⇒ `duplicate-detected`, refuse pending human resolution. This covers codex round-9's exact scenario (recover `submitting` → `approved` → discard while a stale POST may exist) up to the timing limit stated in §8. One incidental effect, noted for the orchestrator: this makes `verify-clear`/`verify-confirmed`-class audit events reachable in discardable states, which bears on round-9 Opus's "unreachable clearing conditions" finding — but the Patch 6–8 clearing machinery, `resolve` semantics, and `duplicate-detected` key-reachability remain **out of round-10 scope** and are not modified here.

### Exit codes introduced by §4

`10 EXIT_LOCK_HELD` · `11 EXIT_LOCK_FENCED_CLEAN` (no POST sent) · `12 EXIT_LOCK_FENCED_DIRTY` (POST may have been sent; sidecar written) · `13 EXIT_LOCK_BREAK_RACE`.

### Implementation notes (one line each, non-normative)

On 9p/drvfs/NFS-like filesystems where `O_EXCL` atomicity is doubtful, use the create-unique-then-`link()`-and-check-`nlink==2` idiom for §4.2. Coarse mtime granularity (1–2s on some mounts) is why `LOCK_STALE_MS` is 18 heartbeats, not 2. Where `(dev, ino)` is unreliable, the content-`lockId` comparison in §4.5 is the primary check and is sufficient. Clock jumps/system suspend can cause at worst a false break — the safe direction throughout.

---

## §8 additions — residual risk, layered coverage, and what remains genuinely undetected

Replace the round-9 coverage claim with this layered statement:

1. **Detected, deterministically:** any stale holder that *resumes and lives long enough to write its sidecar* — regardless of when its POST lands, what state the draft is in by then, or whether the draft was meanwhile discarded (queue-wide janitor, §4.7). A `posted: true` sidecar with an issue key is direct duplicate evidence requiring no search.
2. **Detected, via mandatory search:** duplicates that have landed and indexed by the time of (i) the inline post-submit verify (§4.10 a–d) or (ii) the pre-discard/pre-unfreeze gate. Search-index lag remains the already-listed limitation and applies here too.
3. **Genuinely undetected (irreducible, named):** a stale holder whose POST reached Jira but which died between the socket write and the sidecar write, when the resulting issue also lands after every verify point the draft ever passes. Requires a lock break *plus* process death inside a narrow window *plus* unlucky timing — accepted as a residual limitation, alongside: the microsecond check→rename TOCTOU on local draft writes (suspension onset inside the window lasting >90s; self-reported when the writer survives, silent when it doesn't); and duplicate creation via search-index lag (already listed). The §8 list must attribute duplicates to **both** paths — index lag *and* stale-holder POST — fixing round-8 Opus's finding that only the former was listed.

---

**For the orchestrating session:** this replaces §4 and the §8 risk list wholesale for the locking domain; Patches 3/5 (both rounds) are withdrawn in full, including the `fencing-violation` event and the `LOCK_STALE_MS` derivation formula. Nothing here alters config schema, canonicalization, response classification, credential fingerprinting, `resolve` semantics, or the Patch 6–8 clearing machinery. Per §4.10, the `attempts[]` 1:1 exception (§4.8) and the extended verify entry condition are the only touchpoints with §2/§7 text, and both are additive clarifications, not redesigns.
