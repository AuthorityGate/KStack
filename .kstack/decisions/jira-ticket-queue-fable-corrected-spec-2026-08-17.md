The Write tool is disabled in this session, so the arbitration below — delivered in full as this message — is the deliverable, in the same decision/recommendation form the other reviewers used.

---

# Fable arbitration — round 6, KStack-to-Jira automated ticket queue

**Decision: REVISE — but this is a convergent revise, not a disagreement.** Codex and Opus agree on architecture and independently found real, mostly complementary defects in the round-5 text. I verified every named finding; **all 22 are genuine** (none dismissed). The corrected spec below patches each one under the original section numbering. Round 7, if run at all, should be confirm-only against this text — no further invention pass is warranted.

**Confidence: 78.** The residual uncertainty is concentrated in the four open questions at the end, all of which are empirical or owner-decision items, not design work.

## Part 1 — Per-finding verdicts

**Codex findings — all valid:**

| # | Finding | Verdict → fix |
|---|---|---|
| C1 | Stale-lock ceiling (`timeoutMs × maxAttempts`) can undercut a legitimate reconcile's own mandated ≥30s poll | Valid (= Opus O5). Fixed: content-heartbeat lock with fixed constants, §4 |
| C2 | Zero-match → resubmit → `submitted` forbids the very reconcile that would catch a late-appearing duplicate | Valid — the strongest finding this round. Fixed: reconcile verify-mode from `submitted`, §4/§7 |
| C3 | `failed` re-approval path unreachable; multiple-match `failed` is discardable despite possible external side effects | Valid. Fixed: `failed` strictly terminal + `draft --from`; multiple matches now stay `unknown`, §2/§4 |
| C4 | Pending drafts can't represent unfrozen state; "freely editable" with no edit command | Valid. Fixed: nullable freeze fields + `edit`, §2/§4 |
| C5 | `file` credential variant has no defined file format | Valid. Fixed: JSON `{email, token}`, §1 |
| C6 | Response classification non-exhaustive (2xx-no-key, malformed 400, other 4xx, 3xx) | Valid. Fixed: exhaustive table, §7 |
| C7 | Drift refusal leaves state/recovery unspecified; fingerprint misses same-type credential swaps | Valid (= Opus O13). Fixed: `unfreeze` + fingerprint covers credential identity, §4/§6 |
| C8 | `defaultFields.labels` merging undefined, collides with program-emitted labels | Valid (= Opus O1). Fixed: `labels` banned from `defaultFields`, §1/§3 |

**Opus findings — all valid:**

| # | Finding | Verdict → fix |
|---|---|---|
| O1 | `defaultFields.labels` silently strips the idempotency label, collapsing every §7 recovery guarantee | Valid — Opus's strongest objection, and correctly so. Fixed §1/§3 |
| O2 | The "must not set the idempotency label" rule isn't evaluable at config-load (no UUID exists yet) | Valid. Fixed by banning the `labels` key wholesale — load-time evaluable, §1 |
| O3 | "Bytes hashed = bytes POSTed" fails for non-well-formed UTF-16; hash never defined over encoded bytes | Valid in substance. (The exact lone-surrogate byte-divergence mechanism is debatable under ES2019 well-formed `JSON.stringify`, but the defect stands: the spec never states the hash covers UTF-8 encoded bytes.) Fixed §2/§3 |
| O4 | `minGapMs` is an orphaned key with a dangling cross-reference | Valid. Removed; replaced by `approvalTtlMs`, §1 |
| O5 | Lock ceiling can fall below reconcile's own mandated poll with legal config values | Valid (= C1). Fixed §4 |
| O6 | "Resumed `submitting`" undefined for a one-shot CLI; no crashed-vs-live discriminator | Valid. Fixed: lock is the discriminator, made reliable by the heartbeat redesign, §2/§4 |
| O7 | `failed` recovery has no command | Valid (= C3). Fixed §2/§4 |
| O8 | Required audit events unrepresentable in network-shaped `attempts[]` | Valid. Fixed: separate `audit[]`, §2 |
| O9 | No-egress fallback breaks at `draft` (createmeta GET), not `submit` | Valid. Fixed: `draft` is fully offline; createmeta moves to `show`, §4/§5 |
| O10 | Deployment target (Cloud vs Data Center) never declared | Valid. Fixed: Jira Cloud only, §1 |
| O11 | "Safe to resubmit" asserted, not bounded; duplicate risk missing from accepted limitations | Valid. Fixed: documented residual risk, made *detectable* via verify-mode, §7/§8 |
| O12 | `submit` exit codes can't distinguish submitted/failed/unknown | Valid. Fixed: exit-code table, §4 |
| O13 | Fingerprint hashes only `credentialSource.type`, missing which identity submits | Valid (= C7). Fixed §6 |
| O14 | Credential-file permission check has no defined failure mode on the non-POSIX filesystems §8 itself names | Valid. Fixed: fail closed + explicit opt-out key, §1/§8 |

All four Opus dissents are accepted and absorbed into the fixes (encoded-bytes hashing; the lock redesign closes the *detection* gap, not just classification; approval TTL addresses "unexpiring authorizations"; the labels fix is a patch, not a third schema). Codex's material dissent — "search-then-retry is risk reduction, not idempotency; the packet overstates race detection" — is accepted and the corrected spec now says so explicitly (§7, §8).

## Part 2 — Corrected final specification

Same architecture, same section numbering. Changes from round 5 are the patches above; everything not mentioned as changed carries over verbatim.

### §1. Config schema (corrected)

```
jira: {
  enabled: false,
  siteUrl: null,                    // https-only, no userinfo/path/query, no private/loopback/link-local host, validated at load
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
    // both non-empty, unknown keys rejected.  [fixes C5]
  },
  staticLabels: [],                 // non-empty strings; the prefix "kstack-draft-" is reserved and rejected
  timeoutMs: 15000,                 // range 1000–120000  [fixes O5's unbounded-config leg]
  maxAttempts: 3,                   // range 1–5
  approvalTtlMs: 86400000,          // range 60000–604800000; replaces minGapMs [fixes O4; addresses Opus retention dissent]
  dryRun: false,
  nodeMinVersion: "20.0.0"          // also the floor for String.prototype.isWellFormed
}
```

Validation at config load via `kstack-config.mjs` (no parallel reader), as before, plus:

- **`defaultFields` must not contain any of the reserved keys `project`, `issuetype`, `summary`, `description`, or `labels`.** The `labels` field is entirely program-controlled: it is always `[idempotencyLabel, ...staticLabels]`. Adopters who want fixed labels use `staticLabels`. This check needs no per-draft UUID and is fully evaluable at load time. **[fixes O1/O2/C8 — the round's strongest objection]**
- `minGapMs` is removed. Unknown keys remain rejected, so a leftover `minGapMs` in an adopter's config is a load error with a migration hint in the message. **[fixes O4]**
- **Jira Cloud only.** This tool targets Jira Cloud REST API v3 exclusively (`/rest/api/3/search/jql` cursor pagination, Cloud-shaped `createmeta`). Jira Server/Data Center is an explicit non-goal of v1, stated in `--help` and the skill. This is consistent with (not merely implied by) the private-host ban on `siteUrl`. **[fixes O10]**
- `file` credential validation **fails closed**: not a regular non-symlink file, not owned by the invoking user, or mode grants group/other access → config invalid (exit 1). On filesystems that don't enforce POSIX modes (e.g. `/mnt/*` drvfs mounts), the reported mode will typically fail this check; the adopter must either move the file to a POSIX-honoring location (e.g. inside the WSL ext4 filesystem — the right answer for this very repo) or explicitly set `allowInsecurePermissions: true`, which `doctor` then flags loudly on every run. Degrading silently is not an option. **[fixes O14]**

### §2. Draft file schema (corrected)

Path, permissions, and temp-file-plus-fsync-plus-rename write idiom unchanged.

```
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
  "canonicalPayload": null,         // null until frozen; frozen ⇔ non-null  [fixes C4]
  "payloadSha256": null,            // null until frozen
  "configFingerprint": null,        // null until frozen
  "approvedAt": null,               // ISO8601, set by approve; consumed by the TTL check
  "attempts": [ /* network attempts only: {at, outcome: success|failed|ambiguous, httpStatus, errorCategory, redactedError} */ ],
  "audit": [ /* {at, event, detail} — events: override-non-interactive, lock-broken,
       submitting-recovered, unfrozen, approval-renewed, reconcile-matches,
       duplicate-detected, resolved */ ],   // [fixes O8]
  "result": null
}
```

- `content.summary` and `content.descriptionText` must satisfy `String.prototype.isWellFormed()` — enforced at `draft` and `edit` time (exit 13). This guarantees `JSON.stringify` round-trips losslessly and UTF-8 encoding is exact. **[fixes O3, first half]**

**State machine (corrected):**

`pending ⇄ approved → submitting → submitted | failed | unknown`

- `pending`: unfrozen or frozen (frozen ⇔ `canonicalPayload !== null`). Editable via `edit` (which clears the freeze). Discardable.
- `approved`: frozen + human-confirmed; `approvedAt` set. Reversible to `pending` via `unfreeze` (audit-logged) — this is the recovery path for config drift, expired approval, or a change of mind. **[fixes C7's stranded-approved leg]**
- `submitting`: written immediately before the POST. **Crashed-vs-live discrimination is by the lock, and only the lock** (§4): any state-mutating command that acquires the draft's lock and finds `submitting` first durably rewrites it to `unknown` with an `audit[]` `submitting-recovered` entry, then proceeds under its own validity rules. A live sibling submit still holds a heartbeat-fresh lock, so it can't be raced. `list` (lockless, read-only) reports such drafts as `submitting` annotated "presumed crashed (stale lock)" without rewriting. **[fixes O6]**
- `submitted`: confirmed success, `result` populated. Terminal for the payload — but `reconcile` remains valid in **verify mode** from `submitted` when `attempts[]` contains at least one `ambiguous` outcome (§7). **[fixes C2]**
- `failed`: definite non-retryable outcome. **Strictly terminal — the round-5 "re-approve" language is deleted as unreachable.** Recovery is `discard` + a fresh `draft` (convenience: `draft --from <uuid>` clones content into a new draft with a new UUID and new idempotency label). **[fixes C3/O7]**
- `unknown`: ambiguous outcome. **Multiple-match reconciles no longer transition to `failed` — they stay `unknown`** (§7), so an unresolved external side effect can never reach a discardable state. **[fixes C3's discard-conceals-side-effect leg]**
- `discarded`: from `pending`/`failed` only, unchanged.

### §3. Canonicalization (corrected)

JCS stays dropped; the single-serializer argument stands. Corrected statement of the guarantee:

- The fields object is built in code with the fixed key emission order `[project, issuetype, summary, description, labels, ...defaultFields keys in the adopter's configured order]`. Because §1 now bans the five reserved keys from `defaultFields`, **no collision with the fixed keys is possible**; `labels` is always exactly `[idempotencyLabel, ...staticLabels]`. **[fixes O1/C8]**
- **The unit that is hashed, stored, and transmitted is the UTF-8 encoding**: `payloadBytes = Buffer.from(JSON.stringify(fieldsObject), 'utf8')`; `payloadSha256 = sha256(payloadBytes)`; the POST body is `payloadBytes` with `Content-Type: application/json; charset=utf-8`. `canonicalPayload` stores the JSON string form, which is lossless because §2 rejects non-well-formed input, so re-encoding at submit time reproduces the identical bytes; `submit` re-verifies `sha256(Buffer.from(canonicalPayload,'utf8')) === payloadSha256` before sending. **[fixes O3]**

### §4. Command surface (corrected)

All round-5 commands retained; changes and additions:

- `doctor` — as before, with the visibility probe made concrete: `GET /rest/api/3/mypermissions?projectKey=<key>&permissions=BROWSE_PROJECTS,CREATE_ISSUES` per configured project, plus a JQL search probe. Warns loudly whenever `allowInsecurePermissions` is set.
- `draft` — **fully offline: no `createmeta` call.** Creates an unfrozen `pending` draft, validates well-formedness (exit 13 on failure). New convenience flag `--from <uuid>` clones content from any existing draft into a fresh UUID/label. **[fixes O9]**
- `edit <uuid>` — **new.** `pending` only; updates content, clears `canonicalPayload`/`payloadSha256`/`configFingerprint`, re-validates well-formedness. **[fixes C4]**
- `show <uuid>` — now performs the `createmeta` required-fields preflight (exit 3, listing missing field IDs) before freezing; freezes if unfrozen; idempotent on an already-frozen draft. `createmeta` thereby moves to the egress-capable side of the §5 split. **[fixes O9]**
- `approve <uuid> --payload-hash <sha>` — as before (`pending → approved`, sets `approvedAt`), plus: **valid on an already-`approved` draft as TTL renewal**, re-requiring `--payload-hash` and the TTY confirmation, refreshing `approvedAt`, audit-logged as `approval-renewed`. `--override-non-interactive` use is logged to `audit[]` (not `attempts[]`). **[fixes O8's audit leg]**
- `unfreeze <uuid>` — **new.** `approved → pending`; clears the three freeze fields and `approvedAt`; audit-logged. The defined recovery path after drift (exit 8) or expiry (exit 9). **[fixes C7]**
- `submit <uuid>` — `approved` only (exit 5). Preflight order: fingerprint drift check (exit 8, **state unchanged**), then approval-TTL check — `now − approvedAt > approvalTtlMs` → exit 9, state unchanged, re-approve to proceed. Then `submitting` → POST frozen bytes → outcome per §7. **Outcome exit codes: 0 = `submitted`, 10 = `failed`, 11 = `unknown`** — a calling skill can branch on exit status alone. **[fixes O12, C7, Opus retention dissent]**
- `reconcile <uuid>` — valid from `unknown`, from `submitting` (performing the crash rewrite first, per §2), and **from `submitted` in verify mode** when `attempts[]` contains an ambiguous outcome (§7). **[fixes C2]**
- `resolve <uuid> --issue-key <KEY>` — **new.** `unknown → submitted` by human attestation after a multiple-match reconcile; `KEY` must be among the match keys recorded in the latest `reconcile-matches` audit entry; audit-logged as `resolved`. Surplus issues are cleaned up by the human in Jira directly — the tool never deletes.
- `list`, `discard` — unchanged (discard still `pending`/`failed` only, exit 7).

**Locking (redesigned — fixes C1/O5/O6):** `<uuid>.lock` created `O_EXCL`, content JSON `{token, startedAt, heartbeatAt}`. The holder keeps the fd open and rewrites `heartbeatAt` **through the lockfile content** every `LOCK_HEARTBEAT_MS = 5000` during any long operation (reconcile polls, 429/408 waits). A lock is stale iff its content `heartbeatAt` is older than `LOCK_STALE_MS = 60000`. Both are **fixed code constants, not config-derived** — no legal config can make a live operation's lock breakable, and staleness does not depend on filesystem mtime semantics (which §8 concedes are unreliable on the mounts this repo lives on). Breaking a stale lock is audit-logged (`lock-broken`). Lock-busy exits 12.

**Exit codes (consolidated):** 0 success · 1 config invalid · 2 doctor live-check failed · 3 missing required fields (`show`) · 4 hash mismatch (`approve`) · 5 wrong state (`submit`) · 6 reconcile multiple/duplicate matches · 7 wrong state (`discard`) · 8 config drift · 9 approval expired · 10 submit → `failed` · 11 submit → `unknown` · 12 lock busy · 13 non-well-formed input.

### §5. Which process performs the network POST (corrected)

The implementation-time egress verification stands as the open item. The corrected split: **the Codex-side flow stops at `pending`, not `approved`** — `draft` is offline by design (§4), and §9 already restricts skills to `draft` only, so this is now internally consistent rather than contradictory. Everything requiring egress (`doctor`, `show`'s createmeta, `submit`, `reconcile`) or a TTY (`approve`) runs from the Claude-Code-side session or a human shell. If Codex's sandbox turns out to permit egress, `show`/`submit`/`reconcile` additionally work there, but `approve`'s TTY requirement keeps the human step host-side either way. Documented in the skill and `--help`. **[fixes O9]**

### §6. `configFingerprint` contents (corrected)

SHA-256 of the JSON-stringified object `{siteUrl, project, issueType, credentialSource}` where `credentialSource` is `{type, emailEnvVar, tokenEnvVar}` (env) or `{type, path}` (file) — **identity-bearing names and paths, never secret values**. Same-type credential swaps between `show` and `submit` now trip the guard. On drift: `submit` exits 8, state unchanged; recovery is `unfreeze → show → approve`. The time dimension formerly gestured at by `minGapMs` is now genuinely owned by `approvalTtlMs` (§1/§4). **[fixes C7/O13/O4]**

### §7. Response classification and search-then-retry (corrected — now exhaustive)

`fetch` is invoked with `redirect: 'manual'` so 3xx responses are observable rather than thrown. **[required for the 3xx rule below to be implementable]**

| Response | State |
|---|---|
| 2xx with body containing issue `id` + `key` | `submitted` |
| **2xx without `id`/`key`** | `unknown` — creation can't be ruled out **[fixes C6]** |
| **3xx** | `failed`, category `redirect` — siteUrl misconfiguration; credentials are never replayed cross-origin **[fixes C6]** |
| 400 — **with or without** a Jira error body | `failed` **[fixes C6]** |
| 401 / 403 / 404 | `failed` |
| **408** | timeout-class: bounded retry like 429-without-header; exhaustion → `unknown` **[fixes C6]** |
| 429 | `Retry-After` honored, bounded as before; exhaustion → `unknown` |
| **any other 4xx** | `failed` **[fixes C6]** |
| 5xx / timeout / connection loss / crash while `submitting` | `unknown` |

**Reconcile protocol (corrected):**

1–3. Doctor-proof precondition, cursor-paginated label search, bounded poll (≥3 probes over ≥30s) — unchanged.
4. **Zero matches** → `approved`, **without refreshing `approvedAt`** — a restored stale approval must re-clear the TTL check before resubmission; that is deliberate and the safe direction.
5. **One match** → `submitted`, `result` populated.
6. **Multiple matches** → **remains `unknown`** (not `failed`), exit 6; the match keys are recorded in an `audit[]` `reconcile-matches` entry; resolution is human, via `resolve` (§4). Unresolved external side effects can never reach a discardable state. **[fixes C3]**
7. **Verify mode** (from `submitted` with ambiguous history — **[fixes C2, Codex's strongest objection]**): re-runs the same search. Exactly one match equal to `result.key` → confirmed, exit 0, no state change. Any other single match, or multiples → `duplicate-detected` audit entry listing the keys, exit 6, state unchanged; the human deletes the surplus in Jira. The skill and `--help` state: **after any `submit` that follows an `unknown → reconcile → approved` cycle, run `reconcile` once more in verify mode.** This makes the late-index-lag duplicate *detectable*; it does not make it impossible — see §8.

### §8. Hygiene (corrected additions)

All round-5 items stand, plus:

- **Accepted residual risk, stated honestly:** search-then-retry is duplicate-risk *reduction*, not idempotency. Jira Cloud search-index lag exceeding the bounded poll can cause a zero-match resubmit to create a duplicate; §7's verify mode makes this detectable after the fact, and cleanup is manual. This is now listed among the accepted limitations rather than implied away. **[fixes O11 + Codex's material dissent]**
- Indefinitely-retained `approved` drafts are no longer unexpiring authorizations — `approvalTtlMs` bounds them (§4). Retention/GC of terminal drafts remains v1-out-of-scope as before.
- Credential-file permission checking **fails closed** with the explicit `allowInsecurePermissions` opt-out (§1); the WSL-mount caveat is now a defined behavior, not an unspecified one. **[fixes O14]**

### §9. Skill integration

Unchanged, and now consistent with §5 by construction (skills only ever call `draft`, which is offline). One addition: the skill documents the verify-after-resubmit recommendation from §7.7.

## Part 3 — Genuine irreducible open questions (flagged, not invented)

1. **Codex sandbox egress** — whether `codex exec --sandbox workspace-write` permits outbound HTTPS to the adopter's `siteUrl`. Empirical, implementation-time; the design works under both outcomes (§5). Already correctly framed as such.
2. **Jira Cloud search-index lag bound** — no documented SLA exists; the ≥3-probe/≥30s poll is a heuristic. Cannot be resolved without live measurement. Requires **owner acceptance** of §8's residual duplicate risk (detectable via verify mode, not eliminated).
3. **`allowInsecurePermissions` posture** — fail-closed is the right default, but note: **this repo itself sits on `/mnt/e`, so the owner's own deployment hits the fail-closed path immediately** unless the credential file lives on the WSL ext4 side (recommended) or the flag is set. Owner call on which.
4. **Cloud-only scope** — v1 declares Jira Data Center an explicit non-goal (§1). If DC support is ever wanted, that is a real design delta (different search API, different network posture), needing owner sign-off — flagging so the declaration is a decision, not an accident.

---

**Bottom line:** both reviewers were right, about different things, and the two "strongest objections" (Opus's silent idempotency-label strip, Codex's undetectable post-resubmit duplicate) were the two defects that would have shipped real data-integrity bugs. Every finding is patched above under its original section number. This spec is ready for a confirm-only pass or direct implementation; per the standing pipeline, implementation goes to Codex, with Opus validating against this approved design.

One process note: I attempted to save this arbitration to the plan file at `/home/lr427/.claude/plans/fable-arbitration-floating-barto.md`, but the Write tool is disabled for this session — this message is therefore the sole authoritative copy of the corrected spec, and whoever carries it into the next round should persist it into the design packet.
