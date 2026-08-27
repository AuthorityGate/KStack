# Fable round-12 arbitration — §4 locking/concurrency (convergence-final)

**Verdict: all four consensus findings are real and are fixed below; the remaining reviewer items are either fixed alongside them or explicitly dispositioned.** The round-10 architecture (tombstone-rename claim, sidecar handoff, mandatory verify) survives intact; every fix is a correction of mechanics inside that architecture, not a redesign. A note on delivery: this session's toolset has no file Read/Write and no ExitPlanMode/plan-file tooling, so per the packet's own fallback I worked from the packet text and this message is the deliverable, delivered inline.

## The four fixes, precisely

1. **§4.9 release race (codex):** check-then-`unlink` by path could silently delete a successor's lock. Replaced with a rename-claim release: the releaser atomically renames its lock to `<uuid>.released.<lockId>.json`, verifies the content is its own, and only then unlinks. A mis-claim of a successor's lock is detected and recovered (rename back, or janitor fold + `EXIT_LOCK_BREAK_RACE`), never silently destroyed. The `released.*` namespace is deliberately distinct from `tombstone.*` so a crashed-mid-release file folds as benign and cannot false-fire §4.10 trigger (b). Heartbeat now runs until the release-rename completes. Residue added to §8.

2. **Exit 17/18 contradiction (codex):** the codes no longer mean "POST sent or not." **17 = fenced, no residue** (the draft on disk reflects everything that happened); **18 = fenced with residue** (a post-fence draft write landed and/or an *unrecorded* POST may have occurred). The sidecar's `{posted, wroteAfterFence}` fields carry the specifics; callers never infer POST status from the exit code alone. `posted` is defined as "an unrecorded POST may have occurred" — so a `submit` that recorded its response and is fenced only at release exits 17, and `posted: false` becomes definitive "nothing happened that the draft doesn't already show," letting reconcile mark a pre-POST fence abort `aborted-before-post` and return the draft to `approved` deterministically.

3. **`duplicate-detected` wedge from `pending`/`approved` (both reviewers' dissent):** `resolve` gains entry state (c): from `pending`/`approved` with an unresolved gate-written `duplicate-detected`. `--issue-key <KEY>` attests the found issue *is* this draft → `submitted`; `--distinct` attests it isn't → writes `duplicate-dismissed`, gate opens. Open item #1 is hereby closed for v1, not deferred.

4. **Crash recovery from `submitting` unassigned / trigger (d) unreachable (both reviewers):** the `approved → submitting` guarded write atomically appends the `attempts[]` row (`outcome: "in-flight"`) — exactly one row per POST by construction. Recovery is normatively `reconcile`'s job, and §4.10's preamble now binds mandatory verify to *the invocation that transitions a draft into `submitted`* (whether `submit` or `reconcile`), making trigger (d) reachable.

---

## §4. Command surface and local locking/concurrency (corrected — Fable round-12)

Commands (this list is authoritative for the CLI): `doctor`, `draft [--from <uuid>]` (fully offline), `edit <uuid>` (`pending` only, clears freeze fields), `show <uuid>` (`createmeta` preflight, freezes, idempotent), `approve <uuid> --payload-hash <sha>` (also TTL renewal on `approved`), `unfreeze <uuid>` (`approved → pending`), `submit <uuid>` (`approved` only; the only command that initiates a POST), `reconcile <uuid> [--verify]`, `resolve <uuid> (--issue-key <KEY> | --distinct)`, `list [--state]`, `status`, `discard <uuid> [--acknowledge-ambiguous-history]` (`pending`/`failed` only, subject to the §2 guard and the §4.10 gate).

- **`status` (now normatively defined, distinct from `list`):** queue-wide health — sweeps the whole queue dir for unfolded sidecars, tombstones, `released.*` files, and stale `*.lock.tmp.*` litter (folding/cleaning per §4.7, briefly acquiring each affected draft's lock); surfaces every draft with an unsatisfied mandatory verify, an unresolved `duplicate-detected`, or a held/stale lock. `reconcile` performs the same queue-wide sweep. `list` remains pure enumeration.
- **`reconcile --verify`** re-runs verify-mode (§4.10); bare `reconcile <uuid>` handles `unknown`, recovery from persisted `submitting` (§4.10), and `submitted` verify mode.
- **`resolve` — three entry states:**
  - (a) from `unknown` (multiple-match reconcile, §7.6) → `unknown → submitted`; `KEY` must be among the `reconcile-matches` entry's keys. Unchanged.
  - (b) from `submitted` with an unresolved `duplicate-detected` (§7.7): state stays `submitted`; `KEY` must be among that entry's keys; updates `result` if different; writes `{event: "duplicate-acknowledged", at, chosenKey, staleKeys}` (also clears the §2 guard). Unchanged.
  - (c) **new** — from `pending`/`approved` with an unresolved `duplicate-detected` written by §4.10's pre-discard/pre-unfreeze gate. Two forms. `--issue-key <KEY>` (must be among that entry's keys): the human attests the found issue **is** this draft, created by a stale holder → transitions `pending|approved → submitted`, sets `result` to KEY, writes `duplicate-acknowledged`. This transition does **not** synthesize an `attempts[]` row — the record of the stale holder's POST is the `stale-holder-outcome` audit entry plus the `duplicate-acknowledged` entry, per §4.8's exception; the exactly-one-row invariant is not violated because this tool's own invocations authored no POST from this state. `--distinct`: the human attests the matches are **not** this draft → writes `{event: "duplicate-dismissed", at, dismissedKeys}`; state unchanged; `discard`/`unfreeze` now permitted. **`duplicate-dismissed` clears only the §4.10 gate marker; §2's ambiguous-history guard (keyed on `attempts[]`) is an independent mechanism with its own clearing entries (`verify-confirmed`/`duplicate-acknowledged`) — clearing one never clears the other.**

#### 4.1 Scope of the guarantee — stated honestly, up front

Unchanged from round 10, with one amendment: the local guarantee now carries **two** disclosed microsecond-scale residues — the §4.5 guarded-write residue and the §4.9 release-claim residue — both enumerated in §8. The external POST remains handled by detection (§4.8, §4.10), never claimed prevention.

#### 4.2 Lockfile: path, content, acquisition

- Path: `.kstack/jira-queue/<uuid>.lock`. Same commands require it as in round 10 (all draft mutations; read-only commands only where §4.10 gates write audit).
- **Acquisition — publish-then-link, universally (supersedes bare `O_CREAT|O_EXCL`):**
  1. Create `<uuid>.lock.tmp.<lockId>` with `O_CREAT|O_EXCL|O_WRONLY`, mode 0600; write the JSON object below; `fsync`.
  2. `link(<uuid>.lock.tmp.<lockId>, <uuid>.lock)` — atomic publication that fails with `EEXIST` if the path is occupied. The lock's content is complete *before* it becomes visible: **there is no empty/partial-lockfile window.** On success, unlink the tmp name and retain the open fd (same inode as the published lock).
  3. On `EEXIST`: unlink your own tmp file first (hygiene — see §4.7 for crashed-acquirer litter), then read and `stat` the existing lock: mtime age ≤ `LOCK_STALE_MS` → exit `EXIT_LOCK_HELD` (16), naming the holder; age > `LOCK_STALE_MS` → break protocol (§4.6).
- Lockfile content (unchanged): `{lockId (random 128-bit per acquisition), pid, hostname, acquiredAt, op, stateAtAcquisition, brokePrevious}`.
- **Empty/unparseable existing lockfile** (foreign junk or pre-idiom leftover — the idiom above can't produce one): such a file cannot belong to a fence-passing holder, because every fence check (§4.5) requires content-lockId equality and even the file's own writer would fail it. Still wait out `LOCK_STALE_MS` before breaking (conservatism against non-conforming writers); the break protocol's observed identity is then `(dev, ino, size, mtime)` in place of `lockId` (§4.6).

#### 4.3 Heartbeat — liveness signal only

Unchanged mechanics: an async timer every `LOCK_HEARTBEAT_MS` calls `futimes(fd)` on the held fd; never rewrites content, never unlinks/renames/re-creates; runs identically through 429 backoff, the in-flight POST, and reconcile's bounded poll; heartbeat failure is never load-bearing. Two additions:

- The heartbeat runs **until the release-rename of §4.9 step 2 completes** — not merely until release begins. This pins the release residue to the same class as §4.5's (requires whole-process suspension > `LOCK_STALE_MS` inside a microsecond window).
- **Normative implementation constraint:** while holding a lock, no synchronous blocking operation may exceed `LOCK_HEARTBEAT_MS` — no sync sleeps, `Atomics.wait`, `spawnSync`/`execSync`, or long synchronous fs calls. All waits (backoff, polls) must be async timers that yield the event loop. Violating this starves `futimes` and manufactures false-stale breaks during in-flight POSTs; §4.10's detection is the backstop for that scenario, not a license to cause it routinely.

#### 4.4 Constants

Unchanged: `LOCK_HEARTBEAT_MS = 5000`, `LOCK_STALE_MS = 90000` (18 missed beats), code constants not adopter config, same rationale.

#### 4.5 Fence checks and the guarded-write primitive

Steps unchanged: (1) fence check — open `<uuid>.lock` by path, compare content `lockId` to own (plus `(dev, ino)` where reliable); mismatch/read-failure ⇒ fenced, must not write (§4.8). (2) temp-file + `fsync` + `rename` over `<uuid>.json`. (3) post-write re-check; mismatch ⇒ stop, write orphan sidecar reflecting reality, exit 18.

**Corrected exit semantics (replaces "17/18 = whether a POST was sent"):**

- `17 EXIT_LOCK_FENCED_CLEAN` — fenced with **no residue**: no unrecorded POST, and no draft write landed after losing ownership. The draft on disk fully reflects what happened.
- `18 EXIT_LOCK_FENCED_DIRTY` — fenced with **residue**: a post-fence draft write may have landed, and/or an unrecorded POST may have occurred. The sidecar's `{posted, wroteAfterFence}` fields (§4.8) carry the specifics; callers must consult the sidecar, never infer POST status from 17/18 alone.
- `posted` means "**an unrecorded POST may have occurred**," not "a POST was ever sent." A `submit` whose POST and response were fully recorded in the draft before it was fenced (e.g. fenced only at release) writes `{posted: false}` and exits 17 — the draft already tells the whole story.
- Post-write re-check failure on an **offline** mutation (`edit`, `approve`, the pre-POST `submitting` write) ⇒ exit 18, sidecar `{posted: false, wroteAfterFence: true}`. Because the sidecar is authored after the invocation has ceased all mutation, `posted: false` is *definitive* no-POST evidence: on folding it, `reconcile` marks the affected `in-flight` attempt row `aborted-before-post` and returns the draft to `approved` — deterministic recovery, no `ambiguous` outcome, no mandatory verify from this alone.

Stated residue unchanged (suspension > `LOCK_STALE_MS` inside the check-to-rename window; post-write re-check makes it self-reported). Fence checks immediately before initiating and after receiving the POST unchanged — duplicate-window reduction, not prevention.

#### 4.6 Stale-break protocol — atomic claim via tombstone rename

Steps 1–4 unchanged in mechanics (record identity → re-`stat` → claim by `rename` to `<uuid>.tombstone.<breakerId>.json` → verify → mis-claim rename-back or exit 19), with two corrections:

- **No-lockId case:** where the observed lockfile was empty/unparseable (§4.2), the observed identity is `(dev, ino, size, mtime)`; step-3 verification compares by `stat` of the tombstone. Where `(dev, ino)` is unreliable, breaking an unparseable lock remains safe: no process can pass a fence check against unparseable content, so the worst case is a break of a lock nobody could use — no falsely-fenced live holder exists.
- **Invariant restated honestly (retires the false "never two simultaneous holders"):** *at any instant, at most one process's fence check against the current `<uuid>.lock` content can pass* — lockIds are unique per acquisition and the path has exactly one content. Races resolve to falsely-fenced clean aborts or a restored holder. Interleavings may transiently leave two processes each holding an open fd (e.g. during the mis-claim window the path is vacant and a fresh §4.2 acquisition can succeed while the displaced holder still holds its fd) — but never two processes that both pass fence checks, so every subsequent guarded write self-arbitrates. In the rename-back-succeeds sub-case the displaced holder's next fence check correctly **passes** — that is recovery, not a violation.

#### 4.7 Janitor — folding tombstones, sidecars, and release leftovers

First draft operation after every lock acquisition, before the command's own work; sweeps this draft's `<uuid>.tombstone.*.json`, `<uuid>.orphan.*.json`, `<uuid>.released.*.json`, and stale `<uuid>.lock.tmp.*` litter. `status` and `reconcile` additionally sweep the whole queue dir (including `discarded` drafts), folding by briefly acquiring each draft's lock.

- **Classification:** tombstones → `lock-broken` / `lock-break-race`; orphan sidecars → `stale-holder-outcome`. **`released.*` files (new):** content `lockId` == filename `lockId` ⇒ a crash between §4.9's rename and unlink — a clean, deliberate release; fold as `{event: "lock-released-late"}`, which is benign and does **not** arm §4.10 trigger (b). Content `lockId` ≠ filename `lockId` ⇒ a §4.9 mis-claim leftover; fold as `lock-break-race`. `*.lock.tmp.*` files older than `LOCK_STALE_MS` are crashed-acquirer litter: delete without folding (they were never published).
- **Durability and idempotence (new, normative):** orphan sidecars are written temp-file + `fsync` + `rename`, mode 0600 — same idiom as `<uuid>.json`; lockfiles and their tmp files are 0600 (§4.2); tombstones and `released.*` files inherit the fsync'd lockfile content via rename. Fold ordering is **append audit entry via the guarded-write primitive + `fsync`, then unlink the folded file**. Folds are idempotent, keyed by the folded file's `lockId` + event type: if a matching audit entry already exists, skip straight to the unlink. A crash between fold and unlink therefore duplicates nothing and loses nothing — evidence (including a `posted: true` issueKey) cannot be torn away by the janitor cycle.
- Load-bearing ordering unchanged: a `submit` must fold before it can transition to `submitted`.

#### 4.8 Fenced/resumed-holder behavior — fully defined

- Sidecar path `<uuid>.orphan.<lockId>.json` (uniquely owned, uncontended); schema `{lockId, at, op, posted, wroteAfterFence, responseClass?, issueId?, issueKey?}`; written per §4.7's idiom (temp + `fsync` + `rename`, 0600).
- Exit code per §4.5's corrected semantics: no residue ⇒ 17; any residue (`posted: true` and/or `wroteAfterFence: true`) ⇒ 18.
- The sidecar remains the durable handoff mechanism, folded into `audit[]` by whichever process later holds the lock. A `posted: true` sidecar bearing an issueKey is direct, deterministic duplicate evidence and **immediately arms §4.10's gate on folding, with no search required**.
- `attempts[]` exception unchanged: a fenced invocation never authors an `attempts[]` row; its record is the sidecar, folded as a `stale-holder-outcome` audit entry.

#### 4.9 Release — rename-claim protocol (replaces check-then-unlink)

1. Heartbeat still running. Fence check by content (§4.5); mismatch ⇒ skip removal entirely, write sidecar, exit fenced per §4.8.
2. `rename(<uuid>.lock, <uuid>.released.<lockId>.json)` — atomic claim of whatever inode occupies the path. `ENOENT` ⇒ another process broke or claimed the lock ⇒ treat as fenced: write sidecar (with `posted` per its true definition — usually `false` here, since everything was recorded), exit per §4.8. Heartbeat stops only after this step.
3. Read the renamed file. Content `lockId` == own ⇒ unlink it (no audit entry needed — nothing was broken), stop heartbeat, close fd. Done.
4. Content `lockId` ≠ own — the resumed-releaser race: we claimed a successor's lock. Rename it back to `<uuid>.lock` if that path is absent; if the rename-back fails or the path is occupied, leave the file for the janitor (folds as `lock-break-race`), exit `EXIT_LOCK_BREAK_RACE` (19). The successor is at worst falsely fenced into a clean abort; **its lock is never silently destroyed** — which is the codex finding, closed.

Residue (added to §8): a releaser suspended > `LOCK_STALE_MS` between steps 1 and 2 can claim a successor's lock — but steps 3–4 detect and recover rather than destroy; same disclosed class as §4.5's residue, same safe direction.

#### 4.10 Detection: mandatory verify-mode triggers (extends §7.7)

Verify-mode reconcile is mandatory, not recommended. **The invocation that transitions a draft into `submitted` — whether `submit` (via `submitting`) or `reconcile` (recovering from persisted `submitting`) — must run verify-mode inline before exiting** if any of triggers (a)–(d) holds. (`resolve`'s human-attested transitions to `submitted` are themselves resolutions and carry no inline verify.) Triggers (a)–(c) unchanged; (d) is "this invocation recovered the draft from `submitting`" — now reachable, because recovery is normatively assigned below.

**Crash recovery from `submitting` (normative):** the `approved → submitting` guarded write atomically appends the `attempts[]` row `{attemptId, startedAt, outcome: "in-flight"}` in the same rename — exactly one row per POST attempt by construction; the same invocation updates that row on response. Any mutating command acquiring the lock over a persisted `submitting` draft refuses and directs to `reconcile` (existing state-error exit code, not a lock code). `reconcile` on `submitting`: run the janitor first (§4.7); if a folded sidecar covers the in-flight `attemptId` — `posted: false` ⇒ row `aborted-before-post`, state back to `approved`; `posted: true` with issueKey ⇒ row completed, state `submitted`, `result` set, duplicate evidence handled per the gate below; `posted: true` without a key ⇒ row `ambiguous`. If no sidecar covers it, set the `in-flight` row's outcome to `ambiguous`. Then proceed under trigger (d) with mandatory verify and §7's reconcile semantics. Recovery *completes* the existing row; it never creates one.

**Direct-evidence rule:** if `audit[]` contains a `stale-holder-outcome` with `posted: true` and an issueKey (or an unfolded such sidecar exists), the gate writes `duplicate-detected` with that key **immediately, with no network search** — and no search-based `verify-clear` can retire it; only `resolve` can. Search-based gating applies only to evidence-free markers (a broken submit-scoped lock, or `posted: true` without a key). This closes the opus finding that a known issue key could be downgraded to a lag-prone search.

**Marker lifecycle (new — closes the forever-gate):** a trigger-(b)/(c) marker is *unresolved* until a later-sequenced `verify-clear`, `verify-confirmed`, `duplicate-acknowledged`, or `duplicate-dismissed` audit entry covers it. A `verify-clear` retires all *search-eligible* markers sequenced before it; subsequent `discard`/`unfreeze` invocations run no new search unless a new marker has appeared since. Direct-evidence markers are excluded from `verify-clear` retirement (previous paragraph).

**Pre-discard/pre-unfreeze gate:** unchanged shape — read-only verify search from `pending`/`approved`, audit entries only, never state transitions; zero matches ⇒ `verify-clear`, proceed; ≥1 match ⇒ `duplicate-detected`, refuse — now with a resolution path: `resolve` entry state (c). **This gate keys on `audit[]` evidence and is independent of §2's ambiguous-history guard, which keys on `attempts[]`; each has its own clearing entries, and clearing one never clears the other.** Inline verify network failure ⇒ audit `verify-incomplete`; `status` surfaces every draft with an unsatisfied mandatory verify; `reconcile --verify` re-runs it.

**Exit codes introduced by §4:** `16 EXIT_LOCK_HELD` · `17 EXIT_LOCK_FENCED_CLEAN` (no residue: draft reflects reality) · `18 EXIT_LOCK_FENCED_DIRTY` (residue: unrecorded POST possible and/or post-fence write landed — consult sidecar) · `19 EXIT_LOCK_BREAK_RACE`.

**Implementation notes:** publish-then-link (§4.2) is now the universal acquisition idiom — it closes the empty-lockfile window everywhere and subsumes the former 9p/drvfs/NFS carve-out; the retained fd is the published inode, so heartbeat `futimes` behavior is unchanged. Coarse-mtime, `(dev, ino)`-unreliability (content-`lockId` primary), and clock-jump/suspend notes unchanged. New implementation-time task: grep `--help` text, SKILL.md prose, and prior-round scripts for the retired "12 = lock busy" code and the old 10–13 lock numbering (opus's dissent is right that this packet cannot verify the renumbering was mechanical — it must be verified in the repo).

---

## Invariant re-verification (the packet's two questions, plus the rest)

1. **Does closing the release race reopen the break protocol?** No. Release-rename (§4.9) and break-rename (§4.6) racing on the same path are safe: `rename` is atomic per path, exactly one wins, the loser gets `ENOENT`, and both `ENOENT` paths are defined (breaker restarts acquisition; releaser exits fenced). The `released.*` namespace is disjoint from `tombstone.*`, so janitor classification is unambiguous and trigger (b) cannot false-fire on a clean-but-crashed release — that disjointness is why the release protocol does not reuse tombstone naming.
2. **Does the empty-lockfile fix interact with the heartbeat?** No. `link()` publishes the same inode the acquirer's fd references, so `futimes(fd)` updates exactly the mtime that `EEXIST` readers `stat`. The only new artifact is tmp-file litter, handled by §4.7.
3. **Fence invariant (restated form):** unique lockIds + one content per path ⇒ at most one fence-check passer at any instant. Every race in §§4.5/4.6/4.9 now resolves to detect-and-recover (false fencing, restored holder, or self-reported clobber via sidecar) — no interleaving silently destroys another process's lock or evidence.
4. **Exactly-one-attempt-per-submit:** the row is created atomically with the `submitting` transition; recovery completes rather than creates; fenced invocations never author rows (sidecar → audit only); `resolve` (c) explicitly synthesizes no row. Holds under every path.

## Disposition of every reviewer finding

**Codex:** §4.9 race — fixed (fix 1); 17/18 contradiction — fixed (fix 2); pending/approved wedge — fixed (fix 3); crash-recovery unassigned — fixed (fix 4); `status`/`reconcile --verify` undefined — fixed (command surface now authoritative, `status` normatively defined). Both codex dissents accepted and closed (release race is now fixed and its residue accounted; open item #1 resolved for v1).

**Opus:** wedge — fixed (fix 3); trigger (d) unreachable — fixed (fix 4); **`dryRun`/`nodeMinVersion` — real but out of locking scope; explicitly deferred to the next round with an owner needed** (it is not covered by this arbitration and must not be treated as resolved); `status`/CLI authority — fixed; sidecar write idiom/tearing — fixed (§4.7 durability + idempotent fold-then-delete); §4.6 invariant falsity — accepted, restated honestly; empty-lockfile window — eliminated (publish-then-link) with the residual foreign-junk case defined; §2 guard not arming on audit evidence — addressed via the direct-evidence rule (the gate, which controls the same `discard`/`unfreeze` actions, now arms immediately on `posted: true` + key with no search downgrade; §2's own text is out of this round's scope and unchanged); marker forever-gate — fixed (marker lifecycle); heartbeat starvation — fixed (normative sync-blocking ban, §4.3). Opus dissents: #1 accepted (closed); #2 accepted (§8 wording below); #3 accepted (invariant restated); #4 accepted (renumbering verification listed as an implementation-time repo task).

## §8 amendments (locking-relevant only)

- Add the §4.9 release-claim residue alongside the §4.5 write residue (same class, same disclosure).
- Soften residual-risk claim 1: detection via `posted: true` sidecar is "deterministic **given sidecar durability** — fsync'd at write, idempotently folded keyed by lockId; loss requires filesystem-level data loss," not unconditionally "deterministic."

## Implementation-time test cases (not further design rounds)

Grep/update stale references to retired exit codes 10–13/"12 = lock busy"; test janitor fold idempotence across a crash between fold and unlink; test the `released.*` benign-vs-race classification; test `resolve` (c) both forms including guard independence from §2; test recovery from `submitting` with each sidecar shape (`posted:false`, `posted:true`+key, `posted:true` no key, no sidecar); lint/test for sync-blocking calls in lock-holding paths; contended-acquisition tmp-litter cleanup.

**This is convergence-final for the locking domain.** One housekeeping note: the global AI-TODO session-update rule could not be performed this session — no file-write or shell tools are available in this toolset; the next session with normal tooling should log this round-12 arbitration in the KStack AI-TODO entry.
